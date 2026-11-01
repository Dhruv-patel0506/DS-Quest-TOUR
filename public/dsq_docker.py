"""A Docker teaching sandbox that runs in memory inside your browser (used by dsq_shell.py).

It reads real Dockerfiles and docker-compose files, builds layers with a layer cache (so you can feel why the order of instructions matters),
checks the mistakes people really make (a COPY of a missing file, pip install before the requirements file is copied, a wrong module in the
CMD), and runs python programs inside the "container". It does not run Linux programs, and it is not the real Docker: it needs nothing installed
so everyone can practise, and the files you write here are exactly what you use with the real thing.
"""
import copy
import hashlib
import json
import posixpath
import re
import shlex

BASES = {  # image -> size in MB
    'python:3.12': 1020, 'python:3.12-slim': 125, 'python:3.12-alpine': 52, 'python:3.11': 1010, 'python:3.11-slim': 124, 'python:latest': 1020, 'python:3-slim': 125,
    'ubuntu:22.04': 78, 'ubuntu:24.04': 78, 'ubuntu:latest': 78, 'alpine:latest': 8, 'alpine:3.19': 8, 'debian:bookworm-slim': 74, 'node:20': 1100, 'node:20-slim': 240, 'node:20-alpine': 135,
    'nginx:latest': 188, 'nginx:alpine': 48, 'postgres:16': 435, 'postgres:latest': 435, 'redis:7': 117, 'redis:latest': 117, 'mysql:8': 590, 'jupyter/base-notebook:latest': 1290,
    'continuumio/miniconda3:latest': 680, 'busybox:latest': 4, 'hello-world:latest': 0.02,
}
SERVERS = ('uvicorn', 'gunicorn', 'flask', 'streamlit', 'nginx', 'postgres', 'redis-server', 'jupyter', 'mysqld', 'python -m http.server')
PKG_MB = {'numpy': 30, 'pandas': 55, 'scikit-learn': 85, 'matplotlib': 40, 'scipy': 45, 'torch': 700, 'tensorflow': 520, 'fastapi': 6, 'uvicorn': 4, 'flask': 4, 'django': 12, 'requests': 2, 'pydantic': 8, 'streamlit': 80, 'jupyter': 90}


def sha(s):
    return hashlib.sha1(s.encode('utf-8')).hexdigest()


class DockerError(Exception):
    pass


# ----------------------------------------------------------------------------- tiny YAML (enough for compose files)
def _scalar(s):
    s = s.strip()
    if s == '' or s in ('~', 'null'):
        return None
    if s[0] in '"\'' and s[-1] == s[0] and len(s) > 1:
        return s[1:-1]
    if s in ('true', 'True'):
        return True
    if s in ('false', 'False'):
        return False
    if s.startswith('[') and s.endswith(']'):
        return [_scalar(x) for x in s[1:-1].split(',') if x.strip()]
    if re.match(r'^-?\d+$', s):
        return int(s)
    if re.match(r'^-?\d+\.\d+$', s):
        return float(s)
    return s


def parse_yaml(text):
    lines = []
    for raw in text.splitlines():
        body = re.sub(r'\s+#.*$', '', raw.rstrip())
        if body.strip() and not body.strip().startswith('#'):
            lines.append((len(body) - len(body.lstrip(' ')), body.strip()))
    pos = [0]

    def block(indent):
        if pos[0] >= len(lines):
            return None
        if lines[pos[0]][1].startswith('- ') or lines[pos[0]][1] == '-':
            out = []
            while pos[0] < len(lines) and lines[pos[0]][0] == indent and (lines[pos[0]][1].startswith('- ') or lines[pos[0]][1] == '-'):
                item = lines[pos[0]][1][2:].strip()
                pos[0] += 1
                m = re.match(r'^([^:\s][^:]*):(?:\s+(.*))?$', item)
                if m and not item.startswith(('"', "'")) and '://' not in item.split(':')[0]:
                    d = {m.group(1).strip(): _scalar(m.group(2)) if m.group(2) not in (None, '') else None}
                    if m.group(2) in (None, '') and pos[0] < len(lines) and lines[pos[0]][0] > indent:
                        d[m.group(1).strip()] = block(lines[pos[0]][0])
                    while pos[0] < len(lines) and lines[pos[0]][0] > indent and not lines[pos[0]][1].startswith('- '):
                        k = lines[pos[0]]
                        km = re.match(r'^([^:]+):(?:\s+(.*))?$', k[1])
                        pos[0] += 1
                        if km:
                            d[km.group(1).strip()] = _scalar(km.group(2)) if km.group(2) not in (None, '') else (block(lines[pos[0]][0]) if pos[0] < len(lines) and lines[pos[0]][0] > k[0] else None)
                    out.append(d)
                else:
                    out.append(_scalar(item))
            return out
        out = {}
        while pos[0] < len(lines) and lines[pos[0]][0] == indent:
            m = re.match(r'^([^:]+):(?:\s+(.*))?$', lines[pos[0]][1])
            if not m:
                raise DockerError('yaml: line %r is not "key: value"' % lines[pos[0]][1])
            pos[0] += 1
            if m.group(2) not in (None, ''):
                out[m.group(1).strip()] = _scalar(m.group(2))
            elif pos[0] < len(lines) and (lines[pos[0]][0] > indent or (lines[pos[0]][0] == indent and lines[pos[0]][1].startswith('- '))):
                out[m.group(1).strip()] = block(lines[pos[0]][0])
            else:
                out[m.group(1).strip()] = None
        return out
    return block(lines[0][0]) if lines else {}


# ----------------------------------------------------------------------------- Dockerfile
INSTR = {'FROM', 'RUN', 'CMD', 'LABEL', 'EXPOSE', 'ENV', 'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK', 'SHELL', 'MAINTAINER'}


def parse_dockerfile(text):
    out, cur, start = [], '', 0
    for n, raw in enumerate(text.splitlines(), 1):
        line = raw.rstrip()
        if not cur and (not line.strip() or line.strip().startswith('#')):
            continue
        if line.strip().startswith('#') and cur:
            continue
        if not cur:
            start = n
        if line.endswith('\\'):
            cur += line[:-1] + ' '
            continue
        cur += line
        parts = cur.strip().split(None, 1)
        word = parts[0].upper()
        if word not in INSTR:
            raise DockerError('dockerfile parse error on line %d: unknown instruction: %s' % (start, parts[0]))
        out.append((start, word, parts[1].strip() if len(parts) > 1 else '', cur.strip()))
        cur = ''
    return out


def exec_form(arg):
    arg = arg.strip()
    if arg.startswith('['):
        try:
            v = json.loads(arg)
            if isinstance(v, list):
                return [str(x) for x in v]
        except ValueError:
            pass
    return ['/bin/sh', '-c', arg]


def mb(n):
    return '%.0fMB' % n if n >= 10 else ('%.1fMB' % n if n >= 0.1 else '%.2fMB' % n)


class Docker:
    def __init__(self, shell):
        self.sh = shell
        self.images = {}       # 'repo:tag' -> image
        self.containers = []
        self.cache = {}
        self.volumes = {}      # named volume -> {path: text}
        self.last_build = ''
        self.counter = 0
        self.names = ['happy_turing', 'eager_lovelace', 'calm_hopper', 'brave_curie', 'quirky_knuth', 'bold_ritchie', 'keen_hamilton', 'lucid_ada']

    # --- helpers
    def norm(self, ref):
        return ref if ':' in ref.split('/')[-1] else ref + ':latest'

    def image_of(self, ref):
        return self.images.get(self.norm(ref))

    def ago(self, t):
        d = max(0, self.sh.clock - t)
        return 'About a minute ago' if 60 <= d < 120 else ('%d seconds ago' % d if d < 60 else '%d minutes ago' % (d // 60) if d < 3600 else '%d hours ago' % (d // 3600))

    def run(self, a, stdin=None):
        if not a:
            return 'Usage:  docker [OPTIONS] COMMAND', 0
        sub, rest = a[0], a[1:]
        if sub in ('--version', '-v'):
            return 'Docker version 26.1.4, build 5650f9b', 0
        fn = getattr(self, 'd_' + sub.replace('-', '_'), None)
        if fn is None:
            return "docker: '%s' is not a docker command.\nSee 'docker --help'" % sub, 1
        try:
            return fn(rest)
        except DockerError as e:
            return str(e), 1

    # --- images
    def d_version(self, a):
        return 'Client: Docker Engine (browser sandbox)\n Version:           26.1.4\n\nServer: sandbox\n Engine: simulated, no Linux kernel is involved', 0

    def d_pull(self, a):
        ref = [x for x in a if not x.startswith('-')][0]
        key = self.norm(ref)
        if key not in BASES:
            raise DockerError("Error response from daemon: pull access denied for %s, repository does not exist or may require 'docker login': denied: requested access to the resource is denied" % ref.split(':')[0])
        self.ensure_base(key)
        return '%s: Pulling from library/%s\nDigest: sha256:%s\nStatus: Downloaded newer image for %s\ndocker.io/library/%s' % (key.split(':')[1], key.split(':')[0], sha(key)[:64], key, key), 0

    def ensure_base(self, key):
        if key in self.images:
            return self.images[key]
        repo, tag = key.rsplit(':', 1)
        img = {'id': sha('base' + key)[:12], 'repo': repo, 'tag': tag, 'size': BASES[key], 'fs': {}, 'env': {'PATH': '/usr/local/bin:/usr/bin'}, 'workdir': '/', 'cmd': {'python': ['python3'], 'postgres': ['postgres'], 'redis': ['redis-server'], 'nginx': ['nginx', '-g', 'daemon off;'], 'mysql': ['mysqld'], 'node': ['node'], 'jupyter/base-notebook': ['jupyter', 'lab']}.get(repo, ['/bin/sh']), 'entrypoint': [], 'expose': [], 'user': 'root', 'pkgs': {}, 'created': self.sh.clock, 'layers': 1}
        self.images[key] = img
        return img

    def d_images(self, a):
        rows = ['%-20s %-10s %-14s %-18s %s' % ('REPOSITORY', 'TAG', 'IMAGE ID', 'CREATED', 'SIZE')]
        for k, i in sorted(self.images.items()):
            rows.append('%-20s %-10s %-14s %-18s %s' % (i['repo'], i['tag'], i['id'], self.ago(i['created']), mb(i['size'])))
        return '\n'.join(rows), 0

    def d_tag(self, a):
        src = self.image_of(a[0])
        if not src:
            raise DockerError('Error response from daemon: No such image: %s' % a[0])
        repo, tag = self.norm(a[1]).rsplit(':', 1)
        self.images[repo + ':' + tag] = dict(src, repo=repo, tag=tag)
        return '', 0

    def d_rmi(self, a):
        force = '-f' in a
        for ref in [x for x in a if not x.startswith('-')]:
            img = self.image_of(ref)
            if not img:
                raise DockerError('Error response from daemon: No such image: %s' % ref)
            users = [c for c in self.containers if c['image'] is img]
            if users and not force:
                raise DockerError('Error response from daemon: conflict: unable to remove repository reference "%s" (must force) - container %s is using its referenced image %s' % (ref, users[0]['id'][:12], img['id']))
            self.images.pop(self.norm(ref))
        return 'Untagged: ' + ', '.join(x for x in a if not x.startswith('-')), 0

    # --- build
    def d_build(self, a):
        tags, dockerfile, nocache, ctx = [], None, False, None
        k = 0
        while k < len(a):
            x = a[k]
            if x in ('-t', '--tag'):
                tags.append(a[k + 1]); k += 2; continue
            if x in ('-f', '--file'):
                dockerfile = a[k + 1]; k += 2; continue
            if x == '--no-cache':
                nocache = True
            elif x.startswith('-t') and len(x) > 2:
                tags.append(x[2:])
            elif x.startswith('--build-arg') or x.startswith('-'):
                if x == '--build-arg':
                    k += 1
            else:
                ctx = x
            k += 1
        if ctx is None:
            raise DockerError('"docker buildx build" requires exactly 1 argument.\nSee \'docker buildx build --help\'.')
        return self.build_image(ctx, dockerfile, tags, nocache)

    def build_image(self, ctx, dockerfile, tags, nocache=False, quiet=False):
        out, code = self._build_image(ctx, dockerfile, tags, nocache)
        self.last_build = out
        return out, code

    def _build_image(self, ctx, dockerfile, tags, nocache=False):
        sh = self.sh
        root = sh.abspath(ctx)
        if not sh.isdir(root):
            raise DockerError('ERROR: unable to prepare context: path "%s" not found' % ctx)
        df = sh.abspath(dockerfile) if dockerfile else root + '/Dockerfile'
        if df not in sh.files:
            raise DockerError('ERROR: failed to solve: failed to read dockerfile: open %s: no such file or directory' % (dockerfile or 'Dockerfile'))
        instrs = parse_dockerfile(sh.files[df])
        body = [i for i in instrs if i[1] != 'ARG']
        if not body or body[0][1] != 'FROM':
            raise DockerError('ERROR: failed to solve: dockerfile parse error: no build stage in current context' if not body else 'ERROR: failed to solve: dockerfile parse error on line %d: no build stage in current context' % body[0][0])
        ignore = [l.strip() for l in sh.files.get(root + '/.dockerignore', '').splitlines() if l.strip() and not l.startswith('#')]
        ctxfiles = {}
        for p, c in sh.files.items():
            if p.startswith(root + '/'):
                rel = p[len(root) + 1:]
                if any(re.fullmatch(re.escape(g.rstrip('/')).replace(r'\*', '[^/]*') + r'(/.*)?', rel) for g in ignore):
                    continue
                ctxfiles[rel] = c
        total = len([i for i in instrs if i[1] not in ('ARG',)])
        lines, stages, state, step, secs = [], {}, None, 0, 0.4
        lines.append(' => [internal] load build definition from Dockerfile')
        lines.append(' => [internal] load .dockerignore')
        failed = None
        arg_env = {}
        for ln, word, arg, raw in instrs:
            if word == 'ARG':
                k, _, v = arg.partition('=')
                arg_env[k.strip()] = v.strip()
                continue
            step += 1
            tag = '[%d/%d]' % (step, total)
            if word == 'FROM':
                m = re.match(r'^(\S+)(?:\s+[Aa][Ss]\s+(\S+))?$', arg)
                if not m:
                    raise DockerError('ERROR: failed to solve: dockerfile parse error on line %d: FROM requires either one or three arguments' % ln)
                ref, alias = m.group(1), m.group(2)
                if ref in stages:
                    state = copy.deepcopy(stages[ref])
                    lines.append(' => %s FROM %s' % (tag, ref))
                else:
                    key = self.norm(ref)
                    if key not in BASES:
                        raise DockerError("ERROR: failed to solve: %s: failed to resolve source metadata for docker.io/library/%s: pull access denied, repository does not exist or may require authorization" % (ref, key))
                    base = self.ensure_base(key)
                    state = {'fs': {}, 'env': dict(base['env']), 'workdir': '/', 'cmd': base['cmd'], 'entrypoint': [], 'expose': [], 'user': 'root', 'pkgs': {}, 'size': base['size'], 'layers': 1, 'parent': base['id']}
                    lines.append(' => [internal] load metadata for docker.io/library/%s' % key)
                    lines.append(' => %s FROM docker.io/library/%s' % (tag, key))
                if alias:
                    stages[alias] = state
                    state['_alias'] = alias
                continue
            if state is None:
                raise DockerError('ERROR: failed to solve: dockerfile parse error on line %d: no build stage in current context' % ln)
            ckey = None
            extra = ''
            if word in ('COPY', 'ADD'):
                parts = shlex.split(arg)
                src_stage = None
                if parts and parts[0].startswith('--from='):
                    src_stage = parts.pop(0)[7:]
                if len(parts) < 2:
                    raise DockerError('ERROR: failed to solve: dockerfile parse error on line %d: COPY requires at least two arguments, but only one was provided. Destination could not be determined' % ln)
                srcs, dst = parts[:-1], parts[-1]
                extra = json.dumps([[s, sha(ctxfiles.get(s.rstrip('/'), '')) if s in ctxfiles else ''] for s in srcs]) if not src_stage else src_stage
                if not src_stage and any(s in ('.', './') for s in srcs):
                    extra += sha(json.dumps(ctxfiles, sort_keys=True))
                elif not src_stage:
                    extra += sha(json.dumps({p: c for p, c in ctxfiles.items() if any(p == s.rstrip('/') or p.startswith(s.rstrip('/') + '/') for s in srcs)}, sort_keys=True))
            ckey = sha('|'.join([state.get('parent', ''), word, arg, extra, json.dumps(state['env'], sort_keys=True), state['workdir']]))
            hit = (not nocache) and ckey in self.cache
            t0 = 0.05
            if hit:
                state = copy.deepcopy(self.cache[ckey])
                lines.append(' => CACHED %s %s %s' % (tag, word, arg))
                continue
            try:
                t0 = self.apply(word, arg, state, ctxfiles, stages, arg_env)
            except DockerError as e:
                failed = (tag, word, arg, str(e))
                break
            secs += t0
            state['parent'] = sha(state.get('parent', '') + raw + extra)[:12]
            state['layers'] += 1
            self.cache[ckey] = copy.deepcopy(state)
            if '_alias' in state and state['_alias'] in stages:
                stages[state['_alias']] = state
            lines.append(' => %s %s %s%s' % (tag, word, arg, ('   %.1fs' % t0) if t0 >= .1 else ''))
        if failed:
            tag, word, arg, err = failed
            return '[+] Building %.1fs (%d/%d) FAILED\n%s\n------\n > %s %s %s:\n%s\n------\nERROR: failed to solve: process "/bin/sh -c %s" did not complete successfully: exit code: 1' % (secs, step - 1, total, '\n'.join(lines), tag, word, arg, '\n'.join('0.4 ' + x for x in err.splitlines()), re.sub(r'^RUN\s+', '', arg) if word == 'RUN' else arg) if word == 'RUN' else '[+] Building %.1fs FAILED\n%s\nERROR: failed to solve: %s' % (secs, '\n'.join(lines), err), 1
        self.sh.tick()
        final = state
        iid = sha(final.get('parent', '') + str(len(self.images)))[:12]
        img = {'id': iid, 'size': final['size'], 'fs': final['fs'], 'env': final['env'], 'workdir': final['workdir'], 'cmd': final['cmd'], 'entrypoint': final['entrypoint'], 'expose': final['expose'], 'user': final['user'], 'pkgs': final['pkgs'], 'created': self.sh.clock, 'layers': final['layers']}
        names = tags or []
        for t in names:
            repo, tg = self.norm(t).rsplit(':', 1)
            self.images[repo + ':' + tg] = dict(img, repo=repo, tag=tg)
        if not names:
            self.images['<none>:<none>#' + iid] = dict(img, repo='<none>', tag='<none>')
        head = '[+] Building %.1fs (%d/%d) FINISHED' % (secs, total, total)
        tail = [' => exporting to image', ' => => writing image sha256:%s' % (iid + sha(iid)[:52])] + [' => => naming to docker.io/library/%s' % self.norm(t) for t in names]
        return head + '\n' + '\n'.join(lines + tail), 0

    def apply(self, word, arg, st, ctxfiles, stages, arg_env):
        """Carry out one instruction on the build state; returns the (simulated) seconds it took."""
        def expand(s):
            return re.sub(r'\$\{?(\w+)\}?', lambda m: st['env'].get(m.group(1), arg_env.get(m.group(1), '')), s)
        if word == 'WORKDIR':
            p = expand(arg)
            st['workdir'] = p if p.startswith('/') else posixpath.normpath(st['workdir'].rstrip('/') + '/' + p)
            return 0.0
        if word in ('COPY', 'ADD'):
            parts = shlex.split(arg)
            src_stage = parts.pop(0)[7:] if parts[0].startswith('--from=') else None
            srcs, dst = parts[:-1], expand(parts[-1])
            absdst = dst if dst.startswith('/') else posixpath.normpath(st['workdir'].rstrip('/') + '/' + dst)
            asdir = dst.endswith('/') or dst in ('.', './') or len(srcs) > 1 or absdst == st['workdir']
            added = 0
            source = {('/' + p): c for p, c in ctxfiles.items()} if not src_stage else dict(stages[src_stage]['fs']) if src_stage in stages else None
            if source is None:
                raise DockerError('failed to resolve source: stage "%s" not found' % src_stage)
            for s in srcs:
                sp = s if src_stage else '/' + s.lstrip('./') if s not in ('.', './') else ''
                if src_stage and not sp.startswith('/'):
                    sp = '/' + sp
                sp = sp.rstrip('/') if sp != '/' else ''
                hits = {p: c for p, c in source.items() if p == sp or p.startswith(sp + '/') or sp == ''}
                if not hits:
                    raise DockerError('failed to compute cache key: failed to calculate checksum of ref %s: "/%s": not found' % (sha(s)[:8], s.lstrip('./')))
                for p, c in hits.items():
                    if p == sp and p in source and not any(q.startswith(sp + '/') for q in source):
                        target = posixpath.join(absdst, posixpath.basename(p)) if asdir else absdst
                    else:
                        target = posixpath.join(absdst, p[len(sp):].lstrip('/')) if (sp or asdir) else posixpath.join(absdst, p.lstrip('/'))
                    st['fs'][posixpath.normpath(target)] = c
                    added += len(c.encode())
            st['size'] += max(added / 1e6, 0.001)
            return 0.1
        if word == 'RUN':
            cmd = expand(arg)
            secs = 0.2
            for chunk in re.split(r'&&|;', cmd):
                chunk = chunk.strip()
                m = re.match(r'^(?:python3? -m )?pip3? install\s+(.*)$', chunk)
                if m:
                    toks = shlex.split(m.group(1))
                    pk = []
                    k = 0
                    while k < len(toks):
                        t = toks[k]
                        if t == '-r':
                            f = st['fs'].get(posixpath.normpath(toks[k + 1] if toks[k + 1].startswith('/') else st['workdir'].rstrip('/') + '/' + toks[k + 1]))
                            if f is None:
                                raise DockerError("ERROR: Could not open requirements file: [Errno 2] No such file or directory: '%s'\nHint: the file has to be COPY'd into the image before pip can read it." % toks[k + 1])
                            pk += [re.split(r'[=<>~! ]', l.strip())[0].lower() for l in f.splitlines() if l.strip() and not l.startswith(('#', '-'))]
                            k += 2
                            continue
                        if not t.startswith('-'):
                            pk.append(re.split(r'[=<>~!]', t)[0].lower())
                        k += 1
                    for p in pk:
                        st['pkgs'][p] = '1.0'
                        st['size'] += PKG_MB.get(p, 6)
                        secs += 0.9 + PKG_MB.get(p, 6) / 40
                    continue
                m = re.match(r'^apt-get install\s+(.*)$', chunk) or re.match(r'^apk add\s+(.*)$', chunk)
                if m:
                    pk = [t for t in shlex.split(m.group(1)) if not t.startswith('-')]
                    st['size'] += 25 * max(1, len(pk))
                    secs += 1.2 * len(pk)
                    continue
                m = re.match(r'^mkdir\s+(?:-p\s+)?(.*)$', chunk)
                if m:
                    continue
                if chunk.startswith('python') and ' ' in chunk:
                    script = chunk.split()[1]
                    p = posixpath.normpath(script if script.startswith('/') else st['workdir'].rstrip('/') + '/' + script)
                    if p not in st['fs'] and not script.startswith('-'):
                        raise DockerError("python: can't open file '%s': [Errno 2] No such file or directory" % p)
            return secs
        if word == 'ENV':
            for kv in ([arg.split(None, 1)] if '=' not in arg.split()[0] else [x.split('=', 1) for x in shlex.split(arg)]):
                st['env'][kv[0]] = expand(kv[1]) if len(kv) > 1 else ''
            return 0.0
        if word == 'EXPOSE':
            st['expose'] += [x for x in arg.split()]
            return 0.0
        if word == 'CMD':
            st['cmd'] = exec_form(arg)
            return 0.0
        if word == 'ENTRYPOINT':
            st['entrypoint'] = exec_form(arg)
            return 0.0
        if word == 'USER':
            st['user'] = arg
            return 0.0
        return 0.0

    # --- containers
    def new_name(self):
        n = self.names[self.counter % len(self.names)]
        self.counter += 1
        return n

    def d_run(self, a):
        opts = {'detach': False, 'rm': False, 'env': {}, 'ports': [], 'name': None, 'volumes': [], 'workdir': None, 'env_files': []}
        k = 0
        while k < len(a) and a[k].startswith('-'):
            x = a[k]
            if x in ('-d', '--detach'):
                opts['detach'] = True
            elif x == '--rm':
                opts['rm'] = True
            elif x in ('-e', '--env'):
                kv = a[k + 1].split('=', 1)
                opts['env'][kv[0]] = kv[1] if len(kv) > 1 else self.sh.env.get(kv[0], '')
                k += 1
            elif x == '--env-file':
                opts['env_files'].append(a[k + 1]); k += 1
            elif x in ('-p', '--publish'):
                opts['ports'].append(a[k + 1]); k += 1
            elif x == '--name':
                opts['name'] = a[k + 1]; k += 1
            elif x in ('-v', '--volume'):
                opts['volumes'].append(a[k + 1]); k += 1
            elif x in ('-w', '--workdir'):
                opts['workdir'] = a[k + 1]; k += 1
            elif x in ('-it', '-ti', '-i', '-t', '--init', '--privileged'):
                pass
            elif x in ('--network', '--restart', '--memory', '-m', '--cpus', '-u', '--user', '--entrypoint', '--platform'):
                k += 1
            k += 1
        if k >= len(a):
            raise DockerError('docker: "docker run" requires at least 1 argument.\nSee \'docker run --help\'.')
        ref, cmd_args = a[k], a[k + 1:]
        return self.start_container(ref, cmd_args, opts)

    def start_container(self, ref, cmd_args, opts, name=None, compose_service=None):
        sh = self.sh
        key = self.norm(ref)
        img = self.images.get(key)
        out = []
        if img is None:
            if key not in BASES:
                raise DockerError("Unable to find image '%s' locally\ndocker: Error response from daemon: pull access denied for %s, repository does not exist or may require 'docker login': denied: requested access to the resource is denied." % (key, ref.split(':')[0]))
            out.append("Unable to find image '%s' locally\n%s: Pulling from library/%s\nDigest: sha256:%s\nStatus: Downloaded newer image for %s" % (key, key.split(':')[1], key.split(':')[0], sha(key), key))
            img = self.ensure_base(key)
        if opts.get('name') and any(c['name'] == opts['name'] for c in self.containers):
            raise DockerError('docker: Error response from daemon: Conflict. The container name "/%s" is already in use by container "%s". You have to remove (or rename) that container to be able to reuse that name.' % (opts['name'], [c for c in self.containers if c['name'] == opts['name']][0]['id']))
        env = dict(img['env'])
        for f in opts.get('env_files', []):
            ap = sh.abspath(f)
            if ap not in sh.files:
                raise DockerError('docker: open %s: no such file or directory.' % f)
            for l in sh.files[ap].splitlines():
                if '=' in l and not l.startswith('#'):
                    kk, vv = l.split('=', 1)
                    env[kk.strip()] = vv.strip()
        env.update(opts.get('env', {}))
        workdir = opts.get('workdir') or img['workdir']
        cmd = (list(img['entrypoint']) + (cmd_args or img['cmd'])) if img['entrypoint'] else (cmd_args or img['cmd'])
        if cmd and cmd[0] == '/bin/sh' and len(cmd) == 3 and cmd[1] == '-c':
            line = cmd[2]
        else:
            line = ' '.join(shlex.quote(c) if re.search(r'\s', c) else c for c in cmd)
        from dsq_shell import Shell
        fs = dict(img['fs'])
        mounts = []
        for v in opts.get('volumes', []):
            src, _, dst = v.partition(':')
            dst = dst.split(':')[0]
            if src.startswith(('/', '.', '~')):
                hp = sh.abspath(src)
                for p, c in sh.files.items():
                    if p == hp or p.startswith(hp + '/'):
                        fs[dst + p[len(hp):]] = c
                mounts.append(('bind', hp, dst))
            else:
                vol = self.volumes.setdefault(src, {})
                for p, c in vol.items():
                    fs[dst + p] = c
                mounts.append(('vol', src, dst))
        cs = Shell(fs, workdir, env)
        cs.env['HOSTNAME'] = (name or opts.get('name') or 'container')[:12]
        cs.pkgs['system'] = dict(img['pkgs'])
        self.counter += 0
        cid = sha('c%d%s' % (len(self.containers) + self.counter, key)) + sha('x' + key)[:24]
        cont = {'id': cid, 'name': opts.get('name') or name or self.new_name(), 'image': img, 'ref': key, 'cmd': line, 'status': 'Exited (0)', 'running': False, 'ports': opts.get('ports', []), 'created': sh.clock, 'sh': cs, 'logs': '', 'service': compose_service, 'mounts': mounts}
        server = any(line.startswith(s) or (' ' + s) in (' ' + line) for s in SERVERS) or any(s in line for s in ('uvicorn ', 'gunicorn ', 'flask run', 'http.server'))
        logs = ''
        code = 0
        if server:
            m = re.search(r'(?:uvicorn|gunicorn)\s+([\w.]+):(\w+)', line)
            if m:
                modfile = '%s/%s.py' % (workdir.rstrip('/'), m.group(1).replace('.', '/'))
                if modfile not in cs.files:
                    logs = 'ERROR:    Error loading ASGI app. Could not import module "%s".' % m.group(1)
                    code = 1
                elif not re.search(r'^\s*%s\s*=' % re.escape(m.group(2)), cs.files[modfile], re.M):
                    logs = 'ERROR:    Error loading ASGI app. Attribute "%s" not found in module "%s".' % (m.group(2), m.group(1))
                    code = 1
            if not code:
                pm = re.search(r'--port[= ](\d+)', line) or re.search(r'-p (\d+)', line)
                port = pm.group(1) if pm else ('80' if 'nginx' in line else '5432' if 'postgres' in line else '6379' if 'redis' in line else '8000')
                cont['listen'] = port
                logs = ('INFO:     Started server process [1]\nINFO:     Waiting for application startup.\nINFO:     Application startup complete.\nINFO:     Uvicorn running on http://0.0.0.0:%s (Press CTRL+C to quit)' % port) if 'uvicorn' in line else ('database system is ready to accept connections' if 'postgres' in line else 'Ready to accept connections' if 'redis' in line else 'Serving on port %s' % port)
                cont['running'], cont['status'] = True, 'Up Less than a second'
        else:
            logs, code = cs.run(line), cs.status
            if cs.status == 127 and not logs:
                logs = 'exec: "%s": executable file not found in $PATH' % cmd[0]
            if cs.status != 0:
                cont['status'] = 'Exited (%d)' % cs.status
        # write back volumes
        for kind, src, dst in mounts:
            for p, c in cs.files.items():
                if p.startswith(dst + '/'):
                    if kind == 'vol':
                        self.volumes[src][p[len(dst):]] = c
                    else:
                        sh.write(src + p[len(dst):], c)
        cont['logs'] = logs
        if code and server:
            cont['status'] = 'Exited (%d)' % code
        sh.tick()
        if opts.get('rm') and not cont['running']:
            return '\n'.join(out + ([logs] if logs else [])), code
        self.containers.append(cont)
        if opts.get('detach'):
            return '\n'.join(out + [cid]), 0
        if server and cont['running']:
            logs += '\n(In this browser sandbox the container keeps running in the background; stop it with: docker stop %s)' % cont['name']
        return '\n'.join(out + ([logs] if logs else [])), code

    def find(self, ref):
        for c in self.containers:
            if ref == c['name'] or c['id'].startswith(ref):
                return c
        raise DockerError('Error response from daemon: No such container: %s' % ref)

    def d_ps(self, a):
        allc = '-a' in a or '--all' in a
        rows = ['%-14s %-18s %-24s %-16s %-24s %-24s %s' % ('CONTAINER ID', 'IMAGE', 'COMMAND', 'CREATED', 'STATUS', 'PORTS', 'NAMES')]
        for c in self.containers:
            if c['running'] or allc:
                ports = ', '.join('0.0.0.0:%s->%s/tcp' % (p.split(':')[0], p.split(':')[-1]) for p in c['ports'])
                rows.append('%-14s %-18s %-24s %-16s %-24s %-24s %s' % (c['id'][:12], c['ref'] if len(c['ref']) < 18 else c['ref'][:17], ('"%s"' % c['cmd'])[:22], self.ago(c['created']), c['status'], ports, c['name']))
        return '\n'.join(rows), 0

    def d_stop(self, a):
        for r in a:
            c = self.find(r)
            c['running'], c['status'] = False, 'Exited (0)'
        return '\n'.join(a), 0

    d_kill = d_stop

    def d_start(self, a):
        for r in a:
            c = self.find(r)
            if c.get('listen'):
                c['running'], c['status'] = True, 'Up Less than a second'
        return '\n'.join(a), 0

    def d_restart(self, a):
        return self.d_start(a)

    def d_rm(self, a):
        for r in [x for x in a if not x.startswith('-')]:
            c = self.find(r)
            if c['running'] and '-f' not in a:
                raise DockerError('Error response from daemon: cannot remove container "/%s": container is running: stop the container before removing or force remove' % c['name'])
            self.containers.remove(c)
        return '\n'.join(x for x in a if not x.startswith('-')), 0

    def d_logs(self, a):
        return self.find([x for x in a if not x.startswith('-')][-1])['logs'], 0

    def d_exec(self, a):
        names = [x for x in a if not x.startswith('-')]
        c = self.find(names[0])
        if not c['running']:
            raise DockerError('Error response from daemon: container %s is not running' % c['id'])
        return c['sh'].run(' '.join(shlex.quote(x) if re.search(r'\s', x) else x for x in names[1:])), c['sh'].status

    def d_volume(self, a):
        if a[:1] == ['ls']:
            return 'DRIVER    VOLUME NAME\n' + '\n'.join('local     ' + v for v in sorted(self.volumes)), 0
        return '', 0

    # --- compose
    def d_compose(self, a):
        sh = self.sh
        files = [f for f in ('docker-compose.yml', 'docker-compose.yaml', 'compose.yaml', 'compose.yml') if sh.cwd.rstrip('/') + '/' + f in sh.files]
        if not files:
            raise DockerError('no configuration file provided: not found')
        try:
            cfg = parse_yaml(sh.files[sh.cwd.rstrip('/') + '/' + files[0]]) or {}
        except DockerError as e:
            raise DockerError('yaml: ' + str(e))
        svcs = cfg.get('services')
        if not isinstance(svcs, dict) or not svcs:
            raise DockerError('services must be a mapping: invalid compose project')
        proj = re.sub(r'[^a-z0-9_-]', '', posixpath.basename(sh.cwd).lower()) or 'project'
        sub = a[0] if a else 'ps'
        if sub == 'config':
            return json.dumps(cfg, indent=2), 0
        for n, s in svcs.items():
            for dep in (s.get('depends_on') or []) if isinstance(s, dict) else []:
                dn = dep if isinstance(dep, str) else dep
                if dn not in svcs:
                    raise DockerError('service "%s" depends on undefined service "%s": invalid compose project' % (n, dn))
            if not isinstance(s, dict) or not (s.get('image') or s.get('build')):
                raise DockerError('service "%s" has neither an image nor a build context specified: invalid compose project' % n)
        order, seen = [], set()

        def visit(n):
            if n in seen:
                return
            seen.add(n)
            dep = svcs[n].get('depends_on') or []
            for d in (dep.keys() if isinstance(dep, dict) else dep):
                visit(d)
            order.append(n)
        for n in svcs:
            visit(n)
        if sub in ('up', 'start'):
            out = []
            done = 0
            for n in order:
                s = svcs[n]
                cname = '%s-%s-1' % (proj, n)
                if any(c['name'] == cname and c['running'] for c in self.containers):
                    out.append(' ✔ Container %-24s Running' % cname)
                    continue
                self.containers = [c for c in self.containers if c['name'] != cname]
                if s.get('build') and (self.image_of('%s-%s' % (proj, n)) is None or '--build' in a):
                    b = s['build']
                    ctx = b if isinstance(b, str) else b.get('context', '.')
                    r, code = self.build_image(ctx, b.get('dockerfile') if isinstance(b, dict) else None, ['%s-%s' % (proj, n)])
                    if code:
                        return r, code
                    out.append(' ✔ Service %s Built' % n)
                ref = ('%s-%s' % (proj, n)) if s.get('build') else s['image']
                env = s.get('environment') or {}
                if isinstance(env, list):
                    env = dict(x.split('=', 1) if '=' in x else (x, '') for x in env)
                opts = {'detach': True, 'env': {k: ('' if v is None else str(v)) for k, v in env.items()}, 'ports': [str(p) for p in (s.get('ports') or [])], 'name': cname, 'volumes': [str(v) for v in (s.get('volumes') or [])], 'workdir': s.get('working_dir')}
                cmd = s.get('command')
                args = shlex.split(cmd) if isinstance(cmd, str) else (cmd or [])
                r, code = self.start_container(ref, args, opts, compose_service=n)
                out.append(' ✔ Container %-24s %s' % (cname, 'Started' if code == 0 else 'Error'))
                if code:
                    out.append(self.find(cname)['logs'])
            out.insert(0, '[+] Running %d/%d\n ✔ Network %s_default       Created' % (len(order) + 1, len(order) + 1, proj))
            return '\n'.join(out), 0
        if sub == 'down':
            out = ['[+] Running %d/%d' % (len(order) + 1, len(order) + 1)]
            for n in reversed(order):
                cname = '%s-%s-1' % (proj, n)
                self.containers = [c for c in self.containers if c['name'] != cname]
                out.append(' ✔ Container %-24s Removed' % cname)
            out.append(' ✔ Network %s_default       Removed' % proj)
            return '\n'.join(out), 0
        if sub == 'build':
            out = []
            for n in order:
                if svcs[n].get('build'):
                    b = svcs[n]['build']
                    r, code = self.build_image(b if isinstance(b, str) else b.get('context', '.'), None, ['%s-%s' % (proj, n)])
                    out.append(r)
                    if code:
                        return '\n'.join(out), code
            return '\n'.join(out), 0
        if sub == 'ps':
            rows = ['%-24s %-22s %-24s %-14s %s' % ('NAME', 'IMAGE', 'SERVICE', 'STATUS', 'PORTS')]
            for c in self.containers:
                if c.get('service') and c['running']:
                    rows.append('%-24s %-22s %-24s %-14s %s' % (c['name'], c['ref'][:21], c['service'], 'running', ', '.join(c['ports'])))
            return '\n'.join(rows), 0
        if sub == 'logs':
            return '\n'.join('%s  | %s' % (c['name'], c['logs']) for c in self.containers if c.get('service')), 0
        return 'docker compose: unsupported subcommand %s in this sandbox' % sub, 1

    # --- helpers for lesson checks
    def image_exists(self, ref):
        return self.image_of(ref) is not None

    def running(self):
        return [c['name'] for c in self.containers if c['running']]

    def container(self, name):
        return next((c for c in self.containers if c['name'] == name), None)
