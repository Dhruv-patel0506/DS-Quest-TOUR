"""A small Linux-like shell, with Git, pip and virtual environments, running in memory inside your browser.

It is a teaching sandbox: the commands, options, messages and mistakes follow the real tools closely, so what you learn here is what you type on a
real machine. It needs nothing installed, so it works for everyone. It is not the real Git: when something is not supported it says so.

    from dsq_shell import Shell
    sh = Shell({'app.py': 'print(1)'})
    print(sh.run('git init'))
"""
import contextlib
import difflib
import fnmatch
import hashlib
import io
import json
import os
import posixpath
import re
import shlex
import shutil
import sys
import tempfile
import time
import traceback

HOME = '/home/learner'
STDLIB_OK = set(sys.stdlib_module_names) if hasattr(sys, 'stdlib_module_names') else set()
SANDBOX_PKGS = {'numpy', 'pandas', 'matplotlib', 'scipy', 'sklearn'}
KNOWN_PKGS = {'requests': '2.32.3', 'flask': '3.0.3', 'fastapi': '0.115.6', 'uvicorn': '0.32.1', 'django': '5.1.4', 'pandas': '2.2.3', 'numpy': '2.1.3', 'matplotlib': '3.9.2', 'scikit-learn': '1.5.2',
              'pytest': '8.3.4', 'gunicorn': '23.0.0', 'pydantic': '2.10.3', 'sqlalchemy': '2.0.36', 'python-dotenv': '1.0.1', 'jupyter': '1.1.1', 'streamlit': '1.40.2', 'beautifulsoup4': '4.12.3',
              'seaborn': '0.13.2', 'scipy': '1.14.1', 'black': '24.10.0', 'httpx': '0.28.1', 'redis': '5.2.0', 'psycopg2-binary': '2.9.10', 'pyyaml': '6.0.2'}
IMPORT_NAME = {'scikit-learn': 'sklearn', 'beautifulsoup4': 'bs4', 'python-dotenv': 'dotenv', 'pyyaml': 'yaml', 'psycopg2-binary': 'psycopg2'}


def sha(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()


class Shell:
    def __init__(self, files=None, cwd=HOME, env=None):
        self.files = {}
        self.dirs = {'/', '/home', HOME, '/tmp', '/usr', '/usr/bin'}
        self.cwd = HOME
        self.env = {'HOME': HOME, 'USER': 'learner', 'PATH': '/usr/local/bin:/usr/bin:/bin', 'PWD': HOME, 'SHELL': '/bin/bash'}
        self.env.update(env or {})
        self.status = 0
        self.history = []
        self.venv = None
        self.gconfig = {}
        self.pkgs = {}            # environment name -> {package: version}
        self.clock = 1704103200   # a fixed start so histories are repeatable
        self.repos = {}
        for p, c in (files or {}).items():
            self.write(self.abspath(p), c)
        self.cwd = self.abspath(cwd) if cwd != HOME else HOME
        self.mkdirs(self.cwd)
        self.env['PWD'] = self.cwd
        self.git = Git(self)
        from dsq_docker import Docker
        self.docker = Docker(self)

    # ------------------------------------------------------------------ file system
    def abspath(self, p):
        if p == '~' or p.startswith('~/'):
            p = HOME + p[1:]
        if not p.startswith('/'):
            p = self.cwd.rstrip('/') + '/' + p
        return posixpath.normpath(p)

    def mkdirs(self, path):
        parts = [x for x in path.split('/') if x]
        for i in range(len(parts)):
            self.dirs.add('/' + '/'.join(parts[:i + 1]))

    def write(self, path, text, append=False):
        self.mkdirs(posixpath.dirname(path))
        self.files[path] = (self.files.get(path, '') if append else '') + text

    def isdir(self, p):
        return p in self.dirs

    def isfile(self, p):
        return p in self.files

    def exists(self, p):
        p = self.abspath(p)
        return p in self.files or p in self.dirs

    def read(self, p):
        return self.files[self.abspath(p)]

    def children(self, path):
        prefix = path.rstrip('/') + '/'
        names = set()
        for f in list(self.files) + list(self.dirs):
            if f.startswith(prefix) and f != path:
                names.add(f[len(prefix):].split('/')[0])
        return sorted(n for n in names if n)

    def remove(self, path):
        for f in [f for f in self.files if f == path or f.startswith(path + '/')]:
            del self.files[f]
        for d in [d for d in self.dirs if d == path or d.startswith(path + '/')]:
            self.dirs.discard(d)

    def tick(self):
        self.clock += 60
        return self.clock

    def glob(self, tok):
        if not any(c in tok for c in '*?['):
            return [tok]
        base = posixpath.dirname(tok)
        pat = posixpath.basename(tok)
        d = self.abspath(base) if base else self.cwd
        hits = [posixpath.join(base, n) if base else n for n in self.children(d) if fnmatch.fnmatch(n, pat) and (pat.startswith('.') or not n.startswith('.'))]
        return hits or [tok]

    # ------------------------------------------------------------------ running a line
    def prompt(self):
        short = '~' + self.cwd[len(HOME):] if self.cwd == HOME or self.cwd.startswith(HOME + '/') else self.cwd
        tag = '(%s) ' % posixpath.basename(self.venv) if self.venv else ''
        branch = ''
        r = self.git.repo()
        if r:
            branch = ' (%s)' % (r.head[1] if r.head[0] == 'branch' else r.head[1][:7])
        return '%slearner@dsquest:%s%s$ ' % (tag, short, branch)

    def run_all(self, text):
        out = []
        for line in text.strip().splitlines():
            line = line.strip()
            if line and not line.startswith('#'):
                out.append(self.prompt() + line)
                o = self.run(line)
                if o:
                    out.append(o)
        return '\n'.join(out)

    def _tokens(self, line):
        lex = shlex.shlex(line, posix=True, punctuation_chars='|&;<>')
        lex.whitespace_split = True
        lex.commenters = ''
        return list(lex)

    def _expand(self, tok):
        return re.sub(r'\$\{?(\w+)\}?', lambda m: self.env.get(m.group(1), ''), tok)

    def run(self, line):
        line = line.strip()
        if not line or line.startswith('#'):
            return ''
        self.history.append(line)
        try:
            toks = self._tokens(line)
        except ValueError as e:
            self.status = 2
            return 'bash: syntax error: ' + str(e)
        out_all, segs, cur = [], [], []
        for t in toks:
            if t in ('&&', ';', '&'):
                segs.append((cur, t))
                cur = []
            else:
                cur.append(t)
        segs.append((cur, ''))
        for cmd, op in segs:
            if not cmd:
                continue
            out, code = self._pipeline(cmd)
            self.status = code
            if out:
                out_all.append(out)
            if code != 0 and op == '&&':
                break
        return '\n'.join(o.rstrip('\n') for o in out_all if o is not None)

    def _pipeline(self, toks):
        stages, cur = [], []
        for t in toks:
            if t == '|':
                stages.append(cur)
                cur = []
            else:
                cur.append(t)
        stages.append(cur)
        data, code = '', 0
        for i, st in enumerate(stages):
            data, code = self._command(st, data if i else None)
            if code != 0 and i < len(stages) - 1:
                pass
        return data, code

    def _command(self, toks, stdin):
        redirect, target, args = None, None, []
        i = 0
        while i < len(toks):
            t = toks[i]
            if t in ('>', '>>') and i + 1 < len(toks):
                redirect, target = t, self.abspath(self._expand(toks[i + 1]))
                i += 2
                continue
            if t == '2>' or t == '<':
                i += 2
                continue
            args.append(t)
            i += 1
        args = [self._expand(a) for a in args]
        temp = {}
        while args and re.match(r'^[A-Za-z_]\w*=', args[0]):
            k, v = args.pop(0).split('=', 1)
            temp[k] = v
        if not args:
            self.env.update(temp)
            return '', 0
        name = args[0]
        rest = []
        for a in args[1:]:
            rest.extend(self.glob(a) if name not in ('echo', 'printf', 'grep', 'git', 'docker', 'docker-compose', 'python', 'python3', 'pip', 'pip3', 'export') else [a])
        saved = {k: self.env.get(k) for k in temp}
        self.env.update(temp)
        fn = getattr(self, 'c_' + name.replace('-', '_').replace('.', '_'), None)
        try:
            if fn is None:
                out, code = 'bash: %s: command not found' % name, 127
            else:
                out, code = fn(rest, stdin)
        except Exception as e:  # a bug in the sandbox must not crash the lesson
            out, code = 'bash: %s: internal error (%s: %s)' % (name, type(e).__name__, e), 1
        for k, v in saved.items():
            if v is None:
                self.env.pop(k, None)
            else:
                self.env[k] = v
        if redirect:
            if self.isdir(target):
                return 'bash: %s: Is a directory' % target, 1
            self.write(target, (out + '\n') if out and not out.endswith('\n') else out, append=(redirect == '>>'))
            return '', code
        return out, code

    # ------------------------------------------------------------------ commands
    def c_pwd(self, a, i):
        return self.cwd, 0

    def c_cd(self, a, i):
        t = self.abspath(a[0]) if a else HOME
        if not self.isdir(t):
            return 'bash: cd: %s: %s' % (a[0], 'Not a directory' if t in self.files else 'No such file or directory'), 1
        self.cwd = t
        self.env['PWD'] = t
        return '', 0

    def c_ls(self, a, i):
        flags = ''.join(x[1:] for x in a if x.startswith('-'))
        paths = [x for x in a if not x.startswith('-')] or ['.']
        out = []
        for p in paths:
            ap = self.abspath(p)
            if ap in self.files:
                names, label = [posixpath.basename(ap)], None
                base = posixpath.dirname(ap)
            elif self.isdir(ap):
                names = self.children(ap)
                if 'a' not in flags:
                    names = [n for n in names if not n.startswith('.')]
                else:
                    names = ['.', '..'] + names
                label = p if len(paths) > 1 else None
                base = ap
            else:
                out.append("ls: cannot access '%s': No such file or directory" % p)
                continue
            if label:
                out.append(label + ':')
            if 'l' in flags:
                for n in names:
                    full = posixpath.join(base, n)
                    isd = self.isdir(full) or n in ('.', '..')
                    size = 4096 if isd else len(self.files.get(full, '').encode())
                    out.append('%s 1 learner learner %5d Jan  1 10:00 %s' % ('drwxr-xr-x' if isd else '-rw-r--r--', size, n))
            elif names:
                out.append('  '.join(names))
        return '\n'.join(out), 0 if out and not any('cannot access' in x for x in out) else (2 if out else 0)

    def c_mkdir(self, a, i):
        parents = '-p' in a
        for p in [x for x in a if not x.startswith('-')]:
            ap = self.abspath(p)
            if ap in self.dirs and not parents:
                return "mkdir: cannot create directory '%s': File exists" % p, 1
            if not parents and posixpath.dirname(ap) not in self.dirs:
                return "mkdir: cannot create directory '%s': No such file or directory" % p, 1
            self.mkdirs(ap)
        return '', 0

    def c_touch(self, a, i):
        for p in a:
            ap = self.abspath(p)
            if ap not in self.files:
                self.write(ap, '')
        return '', 0

    def c_cat(self, a, i):
        if not a:
            return (i or ''), 0
        out = []
        for p in a:
            ap = self.abspath(p)
            if ap in self.files:
                out.append(self.files[ap].rstrip('\n'))
            else:
                return 'cat: %s: %s' % (p, 'Is a directory' if ap in self.dirs else 'No such file or directory'), 1
        return '\n'.join(out), 0

    def c_echo(self, a, i):
        nl = True
        if a and a[0] == '-n':
            nl, a = False, a[1:]
        text = ' '.join(a)
        if a and a[0] == '-e':
            text = ' '.join(a[1:]).replace('\\n', '\n').replace('\\t', '\t')
        return text + ('' if nl else ''), 0

    def c_printf(self, a, i):
        return (a[0] if a else '').replace('\\n', '\n'), 0

    def c_rm(self, a, i):
        flags = ''.join(x[1:] for x in a if x.startswith('-'))
        for p in [x for x in a if not x.startswith('-')]:
            ap = self.abspath(p)
            if ap in self.dirs:
                if 'r' not in flags and 'R' not in flags:
                    return "rm: cannot remove '%s': Is a directory" % p, 1
                self.remove(ap)
            elif ap in self.files:
                del self.files[ap]
            elif 'f' not in flags:
                return "rm: cannot remove '%s': No such file or directory" % p, 1
        return '', 0

    def c_rmdir(self, a, i):
        for p in a:
            ap = self.abspath(p)
            if self.children(ap):
                return "rmdir: failed to remove '%s': Directory not empty" % p, 1
            self.dirs.discard(ap)
        return '', 0

    def c_cp(self, a, i):
        rec = any(x in ('-r', '-R', '-a') for x in a)
        pa = [x for x in a if not x.startswith('-')]
        if len(pa) < 2:
            return 'cp: missing destination file operand', 1
        *srcs, dst = pa
        for s in srcs:
            sp, dp = self.abspath(s), self.abspath(dst)
            if self.isdir(dp):
                dp = posixpath.join(dp, posixpath.basename(sp))
            if sp in self.files:
                self.write(dp, self.files[sp])
            elif sp in self.dirs:
                if not rec:
                    return "cp: -r not specified; omitting directory '%s'" % s, 1
                self.mkdirs(dp)
                for f in [f for f in self.files if f.startswith(sp + '/')]:
                    self.write(dp + f[len(sp):], self.files[f])
            else:
                return "cp: cannot stat '%s': No such file or directory" % s, 1
        return '', 0

    def c_mv(self, a, i):
        pa = [x for x in a if not x.startswith('-')]
        if len(pa) < 2:
            return 'mv: missing destination file operand', 1
        *srcs, dst = pa
        for s in srcs:
            sp, dp = self.abspath(s), self.abspath(dst)
            if self.isdir(dp):
                dp = posixpath.join(dp, posixpath.basename(sp))
            if sp in self.files:
                self.write(dp, self.files.pop(sp))
            elif sp in self.dirs:
                self.mkdirs(dp)
                for f in [f for f in self.files if f.startswith(sp + '/')]:
                    self.write(dp + f[len(sp):], self.files.pop(f))
                self.remove(sp)
            else:
                return "mv: cannot stat '%s': No such file or directory" % s, 1
        return '', 0

    def _lines(self, a, i):
        pa = [x for x in a if not x.startswith('-')]
        if pa:
            f = self.abspath(pa[-1])
            if f not in self.files:
                return None, '%s: No such file or directory' % pa[-1]
            return self.files[f].splitlines(), ''
        return (i or '').splitlines(), ''

    def _n(self, a, default=10):
        for k, x in enumerate(a):
            if x == '-n' and k + 1 < len(a):
                return int(a[k + 1]), a[:k] + a[k + 2:]
            if re.match(r'^-\d+$', x):
                return int(x[1:]), a[:k] + a[k + 1:]
        return default, a

    def c_head(self, a, i):
        n, a = self._n(a)
        lines, err = self._lines(a, i)
        return (err, 1) if lines is None else ('\n'.join(lines[:n]), 0)

    def c_tail(self, a, i):
        n, a = self._n(a)
        lines, err = self._lines(a, i)
        return (err, 1) if lines is None else ('\n'.join(lines[-n:] if n else []), 0)

    def c_wc(self, a, i):
        flags = ''.join(x[1:] for x in a if x.startswith('-'))
        pa = [x for x in a if not x.startswith('-')]
        text = (i or '') if not pa else (self.files.get(self.abspath(pa[0])))
        if text is None:
            return 'wc: %s: No such file or directory' % pa[0], 1
        vals = {'l': text.count('\n') + (0 if text.endswith('\n') or not text else 1), 'w': len(text.split()), 'c': len(text.encode())}
        keys = [k for k in 'lwc' if k in flags] or list('lwc')
        return ' '.join(str(vals[k]) for k in keys) + ((' ' + pa[0]) if pa else ''), 0

    def c_grep(self, a, i):
        flags = ''.join(x[1:] for x in a if x.startswith('-') and len(x) > 1 and not x[1].isdigit())
        pa = [x for x in a if not x.startswith('-')]
        if not pa:
            return 'Usage: grep [OPTION]... PATTERNS [FILE]...', 2
        pat, files = pa[0], pa[1:]
        try:
            rx = re.compile(pat, re.I if 'i' in flags else 0)
        except re.error:
            rx = re.compile(re.escape(pat))
        sources = []
        if files:
            for f in files:
                ap = self.abspath(f)
                if ap in self.files:
                    sources.append((f, self.files[ap]))
                elif ap in self.dirs and 'r' in flags:
                    for ff in sorted(x for x in self.files if x.startswith(ap + '/')):
                        sources.append((posixpath.relpath(ff, self.cwd), self.files[ff]))
                else:
                    return 'grep: %s: No such file or directory' % f, 2
        else:
            sources.append((None, i or ''))
        out, hit = [], 0
        for name, text in sources:
            n = 0
            for k, line in enumerate(text.splitlines(), 1):
                ok = bool(rx.search(line)) != ('v' in flags)
                if ok:
                    n += 1
                    if 'c' not in flags:
                        pre = (name + ':' if name and (len(sources) > 1 or 'r' in flags) else '') + (str(k) + ':' if 'n' in flags else '')
                        out.append(pre + line)
            hit += n
            if 'c' in flags:
                out.append((name + ':' if name and len(sources) > 1 else '') + str(n))
        return '\n'.join(out), 0 if hit else 1

    def c_sort(self, a, i):
        lines, err = self._lines(a, i)
        if lines is None:
            return err, 1
        key = (lambda s: float(s.split()[0]) if s.split() and re.match(r'^-?\d', s.split()[0]) else 0) if '-n' in a else None
        return '\n'.join(sorted(lines, key=key, reverse='-r' in a)), 0

    def c_uniq(self, a, i):
        lines, err = self._lines(a, i)
        out, prev = [], None
        for ln in lines or []:
            if ln != prev:
                out.append(ln)
            prev = ln
        return '\n'.join(out), 0

    def c_find(self, a, i):
        start = a[0] if a and not a[0].startswith('-') else '.'
        name = a[a.index('-name') + 1] if '-name' in a else None
        base = self.abspath(start)
        hits = [x for x in sorted(list(self.files) + list(self.dirs)) if x == base or x.startswith(base.rstrip('/') + '/')]
        out = []
        for h in hits:
            if name is None or fnmatch.fnmatch(posixpath.basename(h), name):
                out.append(start.rstrip('/') + h[len(base):] if start != '.' else '.' + h[len(base):])
        return '\n'.join(out), 0

    def c_tree(self, a, i):
        base = self.abspath(a[0] if a else '.')
        lines = [a[0] if a else '.']

        def walk(d, pre):
            names = [n for n in self.children(d) if not n.startswith('.')]
            for k, n in enumerate(names):
                last = k == len(names) - 1
                lines.append(pre + ('└── ' if last else '├── ') + n)
                if self.isdir(posixpath.join(d, n)):
                    walk(posixpath.join(d, n), pre + ('    ' if last else '│   '))
        walk(base, '')
        return '\n'.join(lines), 0

    def c_export(self, a, i):
        for x in a:
            if '=' in x:
                k, v = x.split('=', 1)
                self.env[k] = v
        return '', 0

    def c_env(self, a, i):
        return '\n'.join('%s=%s' % kv for kv in sorted(self.env.items())), 0

    c_printenv = c_env

    def c_clear(self, a, i):
        return '\x0c', 0

    def c_whoami(self, a, i):
        return 'learner', 0

    def c_history(self, a, i):
        return '\n'.join('%5d  %s' % (k, h) for k, h in enumerate(self.history, 1)), 0

    def c_which(self, a, i):
        return ('/usr/bin/' + a[0]) if a and (a[0] in ('python', 'python3', 'git', 'docker', 'pip', 'ls', 'cat', 'grep')) else '', 0 if a and a[0] in ('python', 'python3', 'git', 'docker', 'pip') else 1

    def c_chmod(self, a, i):
        return '', 0

    def c_sleep(self, a, i):
        return '', 0

    def c_date(self, a, i):
        return time.strftime('%a %b %d %H:%M:%S UTC %Y', time.gmtime(self.clock)), 0

    def c_true(self, a, i):
        return '', 0

    def c_false(self, a, i):
        return '', 1

    def c_nano(self, a, i):
        return 'This browser terminal has no text editor. Click the file in the Files panel to edit it, or use echo "text" > file.', 1

    c_vim = c_vi = c_code = c_nano

    def c_help(self, a, i):
        return ('Commands: pwd cd ls mkdir touch cat echo rm cp mv head tail wc grep sort uniq find tree export env history which clear\n'
                'Tools: git, python, pip, docker (including docker compose)\n'
                'Pipes (|), redirects (> >>), && and $VARIABLES work. Edit files in the Files panel.'), 0

    # ------------------------------------------------------------------ environments, pip, python
    def _envname(self):
        return self.venv or 'system'

    def c_source(self, a, i):
        if not a:
            return 'bash: source: filename argument required', 2
        ap = self.abspath(a[0])
        m = re.match(r'^(.*)/bin/activate$', ap)
        if ap in self.files and m:
            self.venv = m.group(1)
            self.env['VIRTUAL_ENV'] = self.venv
            self.pkgs.setdefault(self.venv, {})
            return '', 0
        return 'bash: %s: No such file or directory' % a[0], 1

    c_source_ = c_source

    def c_deactivate(self, a, i):
        self.venv = None
        self.env.pop('VIRTUAL_ENV', None)
        return '', 0

    def _parse_req(self, line):
        line = line.split('#')[0].strip()
        if not line or line.startswith('-'):
            return None
        m = re.match(r'^([A-Za-z0-9_.\-]+)\s*(?:(==|>=|<=|~=|>|<)\s*([\w.]+))?', line)
        return (m.group(1).lower(), m.group(3) if m.group(2) == '==' else None) if m else None

    def c_pip(self, a, i):
        if not a:
            return 'Usage: pip <command> [options]', 1
        sub, rest = a[0], a[1:]
        env = self.pkgs.setdefault(self._envname(), {})
        if sub == 'install':
            specs = []
            if '-r' in rest:
                f = self.abspath(rest[rest.index('-r') + 1])
                if f not in self.files:
                    return 'ERROR: Could not open requirements file: [Errno 2] No such file or directory: %r' % rest[rest.index('-r') + 1], 1
                specs = [s for s in map(self._parse_req, self.files[f].splitlines()) if s]
            specs += [s for s in (self._parse_req(x) for x in rest if not x.startswith('-') and (rest.index(x) == 0 or rest[rest.index(x) - 1] != '-r')) if s]
            if not self.venv and not rest:
                return 'ERROR: You must give at least one requirement to install', 1
            new = []
            for name, ver in specs:
                if name not in KNOWN_PKGS and name.replace('_', '-') not in KNOWN_PKGS:
                    return 'ERROR: Could not find a version that satisfies the requirement %s (from versions: none)\nERROR: No matching distribution found for %s' % (name, name), 1
                name = name.replace('_', '-')
                v = ver or KNOWN_PKGS[name]
                if env.get(name) == v:
                    continue
                env[name] = v
                new.append('%s-%s' % (name, v))
            if not new:
                return '\n'.join('Requirement already satisfied: ' + n for n, _ in specs), 0
            return 'Collecting ' + ', '.join(n.split('-')[0] for n in new) + '\nSuccessfully installed ' + ' '.join(new), 0
        if sub == 'freeze':
            return '\n'.join('%s==%s' % (k, v) for k, v in sorted(env.items())), 0
        if sub == 'list':
            return 'Package    Version\n---------- -------\n' + '\n'.join('%-10s %s' % (k, v) for k, v in sorted(env.items())), 0
        if sub == 'uninstall':
            for n in [x for x in rest if not x.startswith('-')]:
                env.pop(n, None)
            return 'Successfully uninstalled ' + ' '.join(x for x in rest if not x.startswith('-')), 0
        if sub == '--version':
            return 'pip 24.0 from /usr/lib/python3.12/site-packages/pip (python 3.12)', 0
        return 'ERROR: unknown command "%s"' % sub, 1

    c_pip3 = c_pip

    def c_python(self, a, i):
        if a[:2] == ['-m', 'venv']:
            name = a[2] if len(a) > 2 else 'venv'
            ap = self.abspath(name)
            self.mkdirs(ap + '/bin')
            self.mkdirs(ap + '/lib')
            self.write(ap + '/bin/activate', '# source this file to activate the environment\n')
            self.write(ap + '/pyvenv.cfg', 'home = /usr/bin\nversion = 3.12.1\n')
            self.pkgs.setdefault(ap, {})
            return '', 0
        if a[:2] == ['-m', 'pip']:
            return self.c_pip(a[2:], i)
        if a and a[0] in ('--version', '-V'):
            return 'Python 3.12.1', 0
        if a[:2] == ['-m', 'http.server']:
            return 'Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...', 0
        if a[:1] == ['-c'] and len(a) > 1:
            return self.run_python(a[1], ['-c'], '<string>')
        if a:
            ap = self.abspath(a[0])
            if ap not in self.files:
                return "python: can't open file '%s': [Errno 2] No such file or directory" % ap, 2
            return self.run_python(self.files[ap], a, ap)
        return 'Python 3.12.1 (interactive mode is not available here; run a script: python app.py)', 0

    c_python3 = c_python

    def run_python(self, code, argv, filename):
        """Run Python code against the files of this shell (copied to a scratch folder and copied back afterwards)."""
        for m in re.finditer(r'^\s*(?:from|import)\s+([A-Za-z_][\w]*)', code, re.M):
            mod = m.group(1)
            if mod in STDLIB_OK or mod in sys.builtin_module_names or mod in ('dsq_shell', 'dsq_docker'):
                continue
            local = any(self.isfile(posixpath.join(self.cwd, mod + '.py')) or self.isdir(posixpath.join(self.cwd, mod)) for _ in [0])
            if local:
                continue
            pkg = next((k for k, v in IMPORT_NAME.items() if v == mod), mod.replace('_', '-'))
            if mod not in SANDBOX_PKGS and (pkg not in self.pkgs.get(self._envname(), {})):
                return ("Traceback (most recent call last):\n  File \"%s\", line %d, in <module>\nModuleNotFoundError: No module named '%s'" % (filename, code[:m.start()].count('\n') + 1, mod)), 1
        tmp = tempfile.mkdtemp(prefix='dsqsh')
        old_cwd, old_path, old_env, old_argv = os.getcwd(), list(sys.path), dict(os.environ), list(sys.argv)
        before_mods = set(sys.modules)
        try:
            for p, c in self.files.items():
                dst = tmp + p
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                with open(dst, 'w', encoding='utf-8') as f:
                    f.write(c)
            workdir = tmp + self.cwd
            os.makedirs(workdir, exist_ok=True)
            os.chdir(workdir)
            sys.path.insert(0, workdir)
            os.environ.update(self.env)
            sys.argv = [os.path.basename(filename) if filename != '<string>' else '-c'] + argv[1:]
            buf = io.StringIO()
            import builtins
            real_open, real_makedirs, real_mkdir, real_listdir, real_remove = builtins.open, os.makedirs, os.mkdir, os.listdir, os.remove
            real_exists, real_isfile, real_isdir = os.path.exists, os.path.isfile, os.path.isdir
            keep = ('/lib', '/usr', '/proc', '/dev', '/etc', '/sys', '/home/pyodide', '/dsq', sys.prefix, tmp, tempfile.gettempdir())

            def m(p):
                return tmp + p if isinstance(p, str) and p.startswith('/') and not p.startswith(keep) else p
            builtins.open = lambda f, *a, **k: real_open(m(f), *a, **k)
            os.makedirs = lambda p, *a, **k: real_makedirs(m(p), *a, **k)
            os.mkdir = lambda p, *a, **k: real_mkdir(m(p), *a, **k)
            os.listdir = lambda p='.': real_listdir(m(p))
            os.remove = lambda p, *a, **k: real_remove(m(p), *a, **k)
            os.path.exists = lambda p: real_exists(m(p))
            os.path.isfile = lambda p: real_isfile(m(p))
            os.path.isdir = lambda p: real_isdir(m(p))
            code_obj = compile(code, filename.replace(self.cwd + '/', '') if filename != '<string>' else '<string>', 'exec')
            rc = 0
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                try:
                    exec(code_obj, {'__name__': '__main__', '__file__': filename})
                except SystemExit as e:
                    rc = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
                    if isinstance(e.code, str):
                        buf.write(e.code + '\n')
                except BaseException as e:
                    rc = 1
                    tb = traceback.extract_tb(e.__traceback__)
                    mine = [f for f in tb if f.filename == code_obj.co_filename]
                    buf.write('Traceback (most recent call last):\n')
                    for f in mine:
                        buf.write('  File "%s", line %d, in %s\n' % (f.filename, f.lineno, f.name))
                        if f.line:
                            buf.write('    %s\n' % f.line)
                    buf.write('%s: %s\n' % (type(e).__name__, e))
            # copy back what the program created or changed
            seen = set()
            for root, _dirs, fs in os.walk(tmp):
                for d in _dirs:
                    self.mkdirs(root[len(tmp):] + '/' + d)
                for fn in fs:
                    full = os.path.join(root, fn)
                    vp = full[len(tmp):].replace(os.sep, '/')
                    seen.add(vp)
                    try:
                        with open(full, encoding='utf-8') as f:
                            txt = f.read()
                    except Exception:
                        continue
                    if self.files.get(vp) != txt and '__pycache__' not in vp and '/.cache/' not in vp and '/.config/' not in vp:
                        self.write(vp, txt)
            for vp in [p for p in self.files if p not in seen]:
                del self.files[vp]
            return buf.getvalue().rstrip('\n'), rc
        finally:
            try:
                builtins.open, os.makedirs, os.mkdir, os.listdir, os.remove = real_open, real_makedirs, real_mkdir, real_listdir, real_remove
                os.path.exists, os.path.isfile, os.path.isdir = real_exists, real_isfile, real_isdir
            except NameError:
                pass
            os.chdir(old_cwd)
            sys.path[:] = old_path
            sys.argv = old_argv
            os.environ.clear()
            os.environ.update(old_env)
            for m in set(sys.modules) - before_mods:
                f = getattr(sys.modules[m], '__file__', None)
                if f and f.startswith(tmp):
                    del sys.modules[m]
            shutil.rmtree(tmp, ignore_errors=True)

    # ------------------------------------------------------------------ git, docker
    def c_git(self, a, i):
        return self.git.run(a, i)

    def c_docker(self, a, i):
        return self.docker.run(a, i)

    def c_docker_compose(self, a, i):
        return self.docker.run(['compose'] + a, i)

    # ------------------------------------------------------------------ helpers for lesson checks
    def snapshot(self):
        return {'files': dict(self.files), 'cwd': self.cwd}


# ====================================================================== Git
class Repo:
    def __init__(self, root):
        self.root = root
        self.objects = {}        # sha -> blob text or commit dict
        self.branches = {}       # name -> commit sha
        self.head = ('branch', 'main')
        self.index = {}          # path -> blob sha
        self.tags = {}
        self.config = {}
        self.remotes = {}        # name -> url
        self.remote_store = {}   # name -> {'branches': {name: sha}, 'objects': {...}}
        self.merge_head = None
        self.merge_name = None
        self.conflicts = set()
        self.stash = []
        self.remote_refs = {}   # (remote, branch) -> sha
        self.seq = 0


def _split_lines(t):
    return t.splitlines(keepends=True)


def merge3(base, ours, theirs):
    """Line-based three-way merge. Returns (lines, had_conflict)."""
    def regions(x):
        return [(i1, i2, x[j1:j2]) for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, base, x, autojunk=False).get_opcodes() if tag != 'equal']
    A, B = regions(ours), regions(theirs)
    out, pos, conflict = [], 0, False

    def apply(reg, s, e):
        res, p = [], s
        for i1, i2, new in reg:
            if i1 >= s and i2 <= e or (i1 == i2 and s <= i1 <= e):
                res += base[p:i1] + new
                p = i2
        return res + base[p:e]
    while A or B:
        if A and B:
            a, b = A[0], B[0]
            overlap = a[0] <= b[1] and b[0] <= a[1]
        else:
            overlap = False
        if not overlap:
            r = A.pop(0) if (A and (not B or A[0][0] < B[0][0] or (A[0][0] == B[0][0] and False))) else B.pop(0)
            out += base[pos:r[0]] + r[2]
            pos = r[1]
            continue
        s, e = min(A[0][0], B[0][0]), max(A[0][1], B[0][1])
        ga, gb = [A.pop(0)], [B.pop(0)]
        grew = True
        while grew:
            grew = False
            while A and A[0][0] <= e:
                ga.append(A.pop(0)); e = max(e, ga[-1][1]); grew = True
            while B and B[0][0] <= e:
                gb.append(B.pop(0)); e = max(e, gb[-1][1]); grew = True
        mine, theirs_t = apply(ga, s, e), apply(gb, s, e)
        out += base[pos:s]
        if mine == theirs_t:
            out += mine
        else:
            conflict = True
            out += ['<<<<<<< HEAD\n'] + [l if l.endswith('\n') else l + '\n' for l in mine] + ['=======\n'] + [l if l.endswith('\n') else l + '\n' for l in theirs_t] + ['>>>>>>> MERGE\n']
        pos = e
    out += base[pos:]
    return out, conflict


class Git:
    def __init__(self, shell):
        self.sh = shell

    # --- repository plumbing
    def repo(self, path=None):
        p = path or self.sh.cwd
        while True:
            if p in self.sh.repos:
                return self.sh.repos[p]
            if p == '/':
                return None
            p = posixpath.dirname(p) or '/'

    def need(self):
        r = self.repo()
        if not r:
            raise GitError('fatal: not a git repository (or any of the parent directories): .git')
        return r

    def rel(self, r, p):
        return posixpath.relpath(p, r.root)

    def short(self, sha):
        return sha[:7]

    def commit_obj(self, r, sha):
        return r.objects[sha]

    def tree(self, r, sha):
        return dict(r.objects[sha]['tree']) if sha else {}

    def head_sha(self, r):
        return r.branches.get(r.head[1]) if r.head[0] == 'branch' else r.head[1]

    def ignore_rules(self, r):
        f = posixpath.join(r.root, '.gitignore')
        return [l.strip() for l in self.sh.files.get(f, '').splitlines() if l.strip() and not l.startswith('#')]

    def ignored(self, r, rel):
        for pat in self.ignore_rules(r):
            p = pat.rstrip('/')
            parts = rel.split('/')
            if pat.endswith('/') and any(fnmatch.fnmatch(x, p) for x in parts[:-1]):
                return True
            if fnmatch.fnmatch(rel, p.lstrip('/')) or any(fnmatch.fnmatch(x, p) for x in parts):
                return True
        return False

    def work(self, r):
        out = {}
        for p, c in self.sh.files.items():
            if p.startswith(r.root + '/'):
                rel = p[len(r.root) + 1:]
                if not rel.startswith('.git/'):
                    out[rel] = c
        return out

    def store(self, r, text):
        h = sha('blob ' + text)
        r.objects[h] = text
        return h

    def now(self):
        return self.sh.tick()

    # --- command dispatch
    def run(self, args, stdin=None):
        if not args:
            return 'usage: git [--version] <command> [<args>]', 1
        cmd, rest = args[0], args[1:]
        if cmd in ('--version', 'version'):
            return 'git version 2.43.0', 0
        fn = getattr(self, 'g_' + cmd.replace('-', '_'), None)
        if fn is None:
            return "git: '%s' is not a git command. See 'git --help'." % cmd, 1
        try:
            if cmd not in ('init', 'config', 'clone', '__remote_commit'):
                self.need()
            return fn(rest)
        except GitError as e:
            return str(e), 128 if str(e).startswith('fatal') else 1

    def g_init(self, a):
        path = self.sh.abspath([x for x in a if not x.startswith('-')][0]) if [x for x in a if not x.startswith('-')] else self.sh.cwd
        branch = a[a.index('-b') + 1] if '-b' in a else (a[a.index('--initial-branch') + 1] if '--initial-branch' in a else 'main')
        self.sh.mkdirs(path + '/.git')
        if path in self.sh.repos:
            return 'Reinitialized existing Git repository in %s/.git/' % path, 0
        r = Repo(path)
        r.head = ('branch', branch)
        self.sh.repos[path] = r
        return 'Initialized empty Git repository in %s/.git/' % path, 0

    def g_config(self, a):
        r = self.repo()
        local = '--local' in a
        a = [x for x in a if x not in ('--global', '--local')]
        allc = dict(self.sh.gconfig)
        allc.update(r.config if r else {})
        if a and a[0] in ('--list', '-l'):
            return chr(10).join('%s=%s' % kv for kv in sorted(allc.items())), 0
        if len(a) == 1:
            return (allc.get(a[0], ''), 0 if a[0] in allc else 1)
        if len(a) >= 2:
            (r.config if (local and r) else self.sh.gconfig)[a[0]] = a[1]
            return '', 0
        return 'usage: git config [<options>]', 129

    def ident(self, r):
        c = dict(getattr(self.sh, 'gconfig', {}))
        c.update(r.config)
        if not c.get('user.name') or not c.get('user.email'):
            raise GitError('Author identity unknown\n\n*** Please tell me who you are.\n\nRun\n\n  git config --global user.email "you@example.com"\n  git config --global user.name "Your Name"\n\nto set your account\'s default identity.\n\nfatal: unable to auto-detect email address (got \'learner@dsquest.(none)\')')
        return c['user.name'], c['user.email']

    # --- status
    def status_data(self, r):
        head = self.tree(r, self.head_sha(r))
        work = self.work(r)
        staged, unstaged, untracked = [], [], []
        for p in sorted(set(head) | set(r.index)):
            if p in r.conflicts:
                continue
            if p in r.index and p not in head:
                staged.append(('new file', p))
            elif p in r.index and head.get(p) != r.index[p]:
                staged.append(('modified', p))
            elif p in head and p not in r.index:
                staged.append(('deleted', p))
        for p in sorted(r.index):
            if p in r.conflicts:
                continue
            if p not in work:
                unstaged.append(('deleted', p))
            elif sha('blob ' + work[p]) != r.index[p]:
                unstaged.append(('modified', p))
        for p in sorted(work):
            if p not in r.index and p not in r.conflicts and not self.ignored(r, p):
                untracked.append(p)
        return staged, unstaged, untracked

    def g_status(self, a):
        r = self.need()
        staged, unstaged, untracked = self.status_data(r)
        if '-s' in a or '--short' in a:
            lines = []
            code = {'new file': 'A', 'modified': 'M', 'deleted': 'D'}
            names = {}
            for k, p in staged:
                names.setdefault(p, ['', ''])[0] = code[k]
            for k, p in unstaged:
                names.setdefault(p, ['', ''])[1] = code[k]
            for p, (x, y) in sorted(names.items()):
                lines.append('%s%s %s' % (x or ' ', y or ' ', p))
            for p in sorted(r.conflicts):
                lines.append('UU ' + p)
            lines += ['?? ' + p for p in untracked]
            return '\n'.join(lines), 0
        out = ['On branch %s' % r.head[1] if r.head[0] == 'branch' else 'HEAD detached at %s' % self.short(r.head[1])]
        if self.head_sha(r) is None:
            out += ['', 'No commits yet']
        if r.merge_head:
            out += ['You have unmerged paths.', '  (fix conflicts and run "git commit")', '  (use "git merge --abort" to abort the merge)'] if r.conflicts else ['All conflicts fixed but you are still merging.', '  (use "git commit" to conclude merge)']
        if staged:
            out += ['', 'Changes to be committed:', '  (use "git restore --staged <file>..." to unstage)'] + ['\t%-12s%s' % (k + ':', p) for k, p in staged]
        if r.conflicts:
            out += ['', 'Unmerged paths:', '  (use "git add <file>..." to mark resolution)'] + ['\tboth modified:   ' + p for p in sorted(r.conflicts)]
        if unstaged:
            out += ['', 'Changes not staged for commit:', '  (use "git add <file>..." to update what will be committed)', '  (use "git restore <file>..." to discard changes in working directory)'] + ['\t%-12s%s' % (k + ':', p) for k, p in unstaged]
        if untracked:
            out += ['', 'Untracked files:', '  (use "git add <file>..." to include in what will be committed)'] + ['\t' + p for p in untracked]
        if not (staged or unstaged or untracked or r.conflicts):
            out += ['nothing to commit, working tree clean'] if self.head_sha(r) else ['nothing to commit (create/copy files and use "git add" to track)']
        elif not staged and (unstaged or untracked):
            out += ['', 'no changes added to commit (use "git add" and/or "git commit -a")' if unstaged else 'nothing added to commit but untracked files present (use "git add" to track)']
        return '\n'.join(out), 0

    # --- add / rm / restore
    def g_add(self, a):
        r = self.need()
        paths = [x for x in a if not x.startswith('-')]
        if not paths and not any(x in ('-A', '--all', '-u') for x in a):
            return 'Nothing specified, nothing added.\nhint: Maybe you wanted to say \'git add .\'?', 0
        work = self.work(r)
        if any(x in ('-A', '--all') for x in a) or '.' in paths:
            targets = list(work)
            for p in list(r.index):
                if p not in work:
                    del r.index[p]
        else:
            targets = []
            for p in paths:
                rel = self.rel(r, self.sh.abspath(p))
                hits = [w for w in work if w == rel or w.startswith(rel + '/')]
                if not hits and rel not in r.index:
                    raise GitError("fatal: pathspec '%s' did not match any files" % p)
                targets += hits
                if rel in r.index and rel not in work:
                    del r.index[rel]
        for p in targets:
            if self.ignored(r, p) and p not in r.index:
                continue
            r.index[p] = self.store(r, work[p])
            r.conflicts.discard(p)
        return '', 0

    def g_rm(self, a):
        r = self.need()
        cached = '--cached' in a
        for p in [x for x in a if not x.startswith('-')]:
            rel = self.rel(r, self.sh.abspath(p))
            if rel not in r.index:
                raise GitError("fatal: pathspec '%s' did not match any files" % p)
            del r.index[rel]
            if not cached:
                self.sh.files.pop(posixpath.join(r.root, rel), None)
        return '\n'.join("rm '%s'" % x for x in a if not x.startswith('-')), 0

    def g_mv(self, a):
        r = self.need()
        s, d = self.sh.abspath(a[-2]), self.sh.abspath(a[-1])
        if s not in self.sh.files:
            raise GitError("fatal: bad source, source=%s, destination=%s" % (a[-2], a[-1]))
        self.sh.files[d] = self.sh.files.pop(s)
        rs, rd = self.rel(r, s), self.rel(r, d)
        if rs in r.index:
            r.index[rd] = r.index.pop(rs)
        return '', 0

    def g_restore(self, a):
        r = self.need()
        staged = '--staged' in a or '-S' in a
        head = self.tree(r, self.head_sha(r))
        for p in [x for x in a if not x.startswith('-')]:
            for rel in [x for x in (set(r.index) | set(head)) if x == self.rel(r, self.sh.abspath(p)) or x.startswith(self.rel(r, self.sh.abspath(p)) + '/')] or [self.rel(r, self.sh.abspath(p))]:
                if staged:
                    if rel in head:
                        r.index[rel] = head[rel]
                    else:
                        r.index.pop(rel, None)
                elif rel in r.index:
                    self.sh.write(posixpath.join(r.root, rel), r.objects[r.index[rel]])
                else:
                    raise GitError("error: pathspec '%s' did not match any file(s) known to git" % p)
        return '', 0

    # --- commit
    def stats(self, r, old, new):
        files = ins = dele = 0
        lines = []
        for p in sorted(set(old) | set(new)):
            if old.get(p) == new.get(p):
                continue
            a = r.objects[old[p]].splitlines() if p in old else []
            b = r.objects[new[p]].splitlines() if p in new else []
            i = d = 0
            for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
                if tag in ('replace', 'delete'):
                    d += i2 - i1
                if tag in ('replace', 'insert'):
                    i += j2 - j1
            files += 1
            ins += i
            dele += d
            lines.append((p, i, d, 'create' if p not in old else ('delete' if p not in new else '')))
        return files, ins, dele, lines

    def make_commit(self, r, msg, parents, tree=None):
        name, email = self.ident(r)
        c = {'tree': dict(tree if tree is not None else r.index), 'parents': parents, 'msg': msg, 'author': '%s <%s>' % (name, email), 'time': self.now()}
        r.seq += 1
        c['seq'] = r.seq
        h = sha(json.dumps([c['tree'], parents, msg, c['author'], c['time']], sort_keys=True))
        r.objects[h] = c
        return h

    def g_commit(self, a):
        r = self.need()
        msg = None
        amend = '--amend' in a
        for k, x in enumerate(a):
            if (x in ('-m', '--message') or re.match(r'^-[a-z]*m$', x)) and k + 1 < len(a):
                msg = a[k + 1]
            elif x.startswith('-m') and len(x) > 2 and not x.startswith('--'):
                msg = x[2:]
        if 'a' in ''.join(x[1:] for x in a if re.match(r'^-[a-z]+$', x)) or '--all' in a:
            for p in list(r.index):
                f = posixpath.join(r.root, p)
                if f in self.sh.files:
                    r.index[p] = self.store(r, self.sh.files[f])
                else:
                    del r.index[p]
        if r.conflicts:
            raise GitError('error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use \'git add/rm <file>\'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.')
        headsha = self.head_sha(r)
        head = self.tree(r, headsha)
        if r.merge_head:
            msg = msg or "Merge branch '%s'" % r.merge_name
            parents = [headsha, r.merge_head]
        else:
            if r.index == head and not amend:
                staged, unstaged, untracked = self.status_data(r)
                raise GitError(self.g_status([])[0].replace('\n\nno changes added to commit (use "git add" and/or "git commit -a")', '') + ('\nno changes added to commit (use "git add" and/or "git commit -a")' if unstaged else ''))
            parents = ([headsha] if headsha else [])
            if amend and headsha:
                parents = r.objects[headsha]['parents']
                msg = msg or r.objects[headsha]['msg']
        if msg is None:
            raise GitError('Aborting commit due to empty commit message.\nhint: this browser terminal cannot open an editor, so give the message with -m "message".')
        h = self.make_commit(r, msg, parents)
        r.merge_head = r.merge_name = None
        if r.head[0] == 'branch':
            r.branches[r.head[1]] = h
        else:
            r.head = ('detached', h)
        old = self.tree(r, parents[0]) if parents else {}
        files, ins, dele, lines = self.stats(r, old, r.objects[h]['tree'])
        label = r.head[1] if r.head[0] == 'branch' else 'detached HEAD'
        out = ['[%s%s %s] %s' % (label, ' (root-commit)' if not parents else '', self.short(h), msg.split('\n')[0]),
               ' %d file%s changed%s%s' % (files, '' if files == 1 else 's', ', %d insertion%s(+)' % (ins, '' if ins == 1 else 's') if ins else '', ', %d deletion%s(-)' % (dele, '' if dele == 1 else 's') if dele else '')]
        for p, i, d, kind in lines:
            if kind:
                out.append(' %s mode 100644 %s' % (kind, p))
        return '\n'.join(out), 0

    # --- history
    def ancestors(self, r, sha_):
        seen, stack = [], [sha_]
        done = set()
        while stack:
            s = stack.pop()
            if s is None or s in done:
                continue
            done.add(s)
            seen.append(s)
            stack.extend(r.objects[s]['parents'])
        return seen

    def decorations(self, r, s):
        names = []
        head = self.head_sha(r)
        for b, v in sorted(r.branches.items()):
            if v == s:
                names.append(('HEAD -> ' + b) if r.head == ('branch', b) else b)
        if r.head[0] == 'detached' and head == s:
            names.insert(0, 'HEAD')
        for t, v in sorted(r.tags.items()):
            if v == s:
                names.append('tag: ' + t)
        for rem, st in sorted(r.remote_store.items()):
            for b, v in sorted(st['branches'].items()):
                if v == s and r.remote_refs.get((rem, b)) == s:
                    names.append('%s/%s' % (rem, b))
        return (' (' + ', '.join(names) + ')') if names else ''

    def g_log(self, a):
        r = self.need()
        if self.head_sha(r) is None:
            raise GitError("fatal: your current branch '%s' does not have any commits yet" % r.head[1])
        n = None
        for k, x in enumerate(a):
            if x == '-n' and k + 1 < len(a):
                n = int(a[k + 1])
            elif re.match(r'^-\d+$', x):
                n = int(x[1:])
        starts = [self.head_sha(r)] if '--all' not in a else [self.head_sha(r)] + list(r.branches.values())
        allc = set()
        for s in starts:
            allc.update(self.ancestors(r, s))
        order = sorted(allc, key=lambda s: (r.objects[s]['time'], r.objects[s]['seq']), reverse=True)
        if n:
            order = order[:n]
        one = '--oneline' in a
        out = []
        for s in order:
            c = r.objects[s]
            if one:
                out.append('%s%s%s %s' % ('* ' if '--graph' in a else '', self.short(s), self.decorations(r, s), c['msg'].split('\n')[0]))
            else:
                out += ['commit %s%s' % (s, self.decorations(r, s))]
                if len(c['parents']) > 1:
                    out.append('Merge: ' + ' '.join(self.short(p) for p in c['parents']))
                out += ['Author: ' + c['author'], 'Date:   ' + time.strftime('%a %b %d %H:%M:%S %Y +0000', time.gmtime(c['time'])), '', '    ' + c['msg'].replace('\n', '\n    '), '']
        return '\n'.join(out).rstrip('\n'), 0

    def diff_text(self, a_name, b_name, a_txt, b_txt, new=False, gone=False):
        al, bl = a_txt.splitlines(), b_txt.splitlines()
        if al == bl:
            return ''
        ha, hb = sha('blob ' + a_txt)[:7], sha('blob ' + b_txt)[:7]
        head = ['diff --git a/%s b/%s' % (b_name, b_name)]
        if new:
            head.append('new file mode 100644')
        if gone:
            head.append('deleted file mode 100644')
        head.append('index %s..%s%s' % ('0000000' if new else ha, '0000000' if gone else hb, '' if (new or gone) else ' 100644'))
        body = list(difflib.unified_diff(al, bl, 'a/' + a_name if not new else '/dev/null', 'b/' + b_name if not gone else '/dev/null', lineterm='', n=3))
        return '\n'.join(head + body)

    def g_diff(self, a):
        r = self.need()
        staged = '--staged' in a or '--cached' in a
        paths = [self.rel(r, self.sh.abspath(x)) for x in a if not x.startswith('-')]
        head = self.tree(r, self.head_sha(r))
        out = []
        if staged:
            for p in sorted(set(head) | set(r.index)):
                if paths and not any(p == q or p.startswith(q + '/') for q in paths):
                    continue
                if head.get(p) != r.index.get(p):
                    out.append(self.diff_text(p, p, r.objects[head[p]] if p in head else '', r.objects[r.index[p]] if p in r.index else '', new=p not in head, gone=p not in r.index))
        else:
            work = self.work(r)
            for p in sorted(r.index):
                if paths and not any(p == q or p.startswith(q + '/') for q in paths):
                    continue
                cur = work.get(p)
                if cur is None:
                    out.append(self.diff_text(p, p, r.objects[r.index[p]], '', gone=True))
                elif sha('blob ' + cur) != r.index[p]:
                    out.append(self.diff_text(p, p, r.objects[r.index[p]], cur))
        return '\n'.join(x for x in out if x), 0

    def g_show(self, a):
        r = self.need()
        rev = a[0] if a else 'HEAD'
        s = self.resolve(r, rev)
        c = r.objects[s]
        out = ['commit %s%s' % (s, self.decorations(r, s)), 'Author: ' + c['author'], 'Date:   ' + time.strftime('%a %b %d %H:%M:%S %Y +0000', time.gmtime(c['time'])), '', '    ' + c['msg'], '']
        old = self.tree(r, c['parents'][0]) if c['parents'] else {}
        for p in sorted(set(old) | set(c['tree'])):
            if old.get(p) != c['tree'].get(p):
                out.append(self.diff_text(p, p, r.objects[old[p]] if p in old else '', r.objects[c['tree'][p]] if p in c['tree'] else '', new=p not in old, gone=p not in c['tree']))
        return '\n'.join(out), 0

    def resolve(self, r, rev):
        m = re.match(r'^(.*?)(?:~(\d+)|(\^+))?$', rev)
        base, n, ups = m.group(1), m.group(2), m.group(3)
        if base in ('HEAD', '@', ''):
            s = self.head_sha(r)
        elif base in r.branches:
            s = r.branches[base]
        elif base in r.tags:
            s = r.tags[base]
        elif '/' in base and base.split('/', 1)[0] in r.remote_store:
            s = r.remote_refs.get(tuple(base.split('/', 1)))
        else:
            hits = [h for h in r.objects if isinstance(r.objects[h], dict) and h.startswith(base) and len(base) >= 4]
            s = hits[0] if len(hits) == 1 else None
        if s is None:
            raise GitError("fatal: ambiguous argument '%s': unknown revision or path not in the working tree." % rev)
        for _ in range(int(n) if n else (len(ups) if ups else 0)):
            par = r.objects[s]['parents']
            if not par:
                raise GitError("fatal: ambiguous argument '%s': unknown revision or path not in the working tree." % rev)
            s = par[0]
        return s

    def g_rev_parse(self, a):
        r = self.need()
        if '--abbrev-ref' in a:
            return (r.head[1] if r.head[0] == 'branch' else 'HEAD'), 0
        if '--show-toplevel' in a:
            return r.root, 0
        return self.resolve(r, a[-1] if a else 'HEAD'), 0

    # --- branches
    def g_branch(self, a):
        r = self.need()
        names = [x for x in a if not x.startswith('-')]
        if '-d' in a or '-D' in a:
            for n in names:
                if n not in r.branches:
                    raise GitError("error: branch '%s' not found." % n)
                if r.head == ('branch', n):
                    raise GitError("error: Cannot delete branch '%s' checked out at '%s'" % (n, r.root))
                if '-D' not in a and r.branches[n] not in self.ancestors(r, self.head_sha(r)):
                    raise GitError("error: The branch '%s' is not fully merged.\nIf you are sure you want to delete it, run 'git branch -D %s'." % (n, n))
                out = 'Deleted branch %s (was %s).' % (n, self.short(r.branches.pop(n)))
            return out, 0
        if '-m' in a or '-M' in a:
            new = names[-1]
            old = names[-2] if len(names) > 1 else r.head[1]
            r.branches[new] = r.branches.pop(old) if old in r.branches else None
            if r.branches.get(new) is None:
                r.branches.pop(new, None)
            if r.head == ('branch', old):
                r.head = ('branch', new)
            return '', 0
        if names:
            if self.head_sha(r) is None:
                raise GitError("fatal: not a valid object name: '%s'." % r.head[1])
            if names[0] in r.branches:
                raise GitError("fatal: a branch named '%s' already exists" % names[0])
            r.branches[names[0]] = self.resolve(r, names[1]) if len(names) > 1 else self.head_sha(r)
            return '', 0
        lines = []
        for b in sorted(r.branches):
            lines.append(('* ' if r.head == ('branch', b) else '  ') + b)
        if r.head[0] == 'branch' and r.head[1] not in r.branches:
            lines.insert(0, '* ' + r.head[1])
        if '-a' in a or '-r' in a:
            for rem, st in sorted(r.remote_store.items()):
                lines += ['  remotes/%s/%s' % (rem, b) for b in sorted(st['branches']) if r.remote_refs.get((rem, b))]
        return '\n'.join(lines), 0

    def checkout_tree(self, r, target_sha, force=False):
        old = self.tree(r, self.head_sha(r))
        new = self.tree(r, target_sha)
        work = self.work(r)
        clash = [p for p in old if p in work and work[p] != r.objects[old[p]] and old.get(p) != new.get(p)]
        clash += [p for p in r.index if p in work and r.index[p] != old.get(p) and old.get(p) != new.get(p) and p not in clash]
        clash += [p for p in new if p in work and p not in old and p not in r.index and work[p] != r.objects[new[p]]]
        if clash and not force:
            raise GitError('error: Your local changes to the following files would be overwritten by checkout:\n' + '\n'.join('\t' + p for p in sorted(set(clash))) + '\nPlease commit your changes or stash them before you switch branches.\nAborting')
        for p in old:
            if p not in new:
                self.sh.files.pop(posixpath.join(r.root, p), None)
        for p, h in new.items():
            self.sh.write(posixpath.join(r.root, p), r.objects[h])
        r.index = dict(new)

    def g_switch(self, a):
        r = self.need()
        create = '-c' in a or '-C' in a
        names = [x for x in a if not x.startswith('-')]
        if not names:
            raise GitError('fatal: missing branch or commit argument')
        n = names[0]
        if create:
            if n in r.branches and '-C' not in a:
                raise GitError("fatal: a branch named '%s' already exists" % n)
            if self.head_sha(r) is None:
                r.head = ('branch', n)
                return "Switched to a new branch '%s'" % n, 0
            r.branches[n] = self.head_sha(r)
            r.head = ('branch', n)
            return "Switched to a new branch '%s'" % n, 0
        if n not in r.branches:
            raise GitError("fatal: invalid reference: %s" % n)
        if r.head == ('branch', n):
            return "Already on '%s'" % n, 0
        self.checkout_tree(r, r.branches[n])
        r.head = ('branch', n)
        return "Switched to branch '%s'" % n, 0

    def g_checkout(self, a):
        r = self.need()
        if '--' in a:
            return self.g_restore([x for x in a if x != '--'])
        names = [x for x in a if not x.startswith('-')]
        if '-b' in a:
            return self.g_switch(['-c'] + names)
        if names and names[0] not in r.branches:
            try:
                s = self.resolve(r, names[0])
            except GitError:
                f = self.rel(r, self.sh.abspath(names[0]))
                if f in r.index:
                    return self.g_restore(names)
                raise GitError("error: pathspec '%s' did not match any file(s) known to git" % names[0])
            self.checkout_tree(r, s)
            r.head = ('detached', s)
            return "Note: switching to '%s'.\n\nYou are in 'detached HEAD' state. Create a branch with: git switch -c <new-branch-name>\n\nHEAD is now at %s %s" % (names[0], self.short(s), r.objects[s]['msg'].split('\n')[0]), 0
        return self.g_switch(a)

    # --- merge
    def merge_base(self, r, a, b):
        anc_a = self.ancestors(r, a)
        anc_b = set(self.ancestors(r, b))
        for s in sorted(anc_a, key=lambda x: r.objects[x]['seq'], reverse=True):
            if s in anc_b:
                return s
        return None

    def g_merge(self, a):
        r = self.need()
        if '--abort' in a:
            if not r.merge_head:
                raise GitError('fatal: There is no merge to abort (MERGE_HEAD missing).')
            self.checkout_tree(r, self.head_sha(r), force=True)
            r.merge_head = r.merge_name = None
            r.conflicts.clear()
            return '', 0
        names = [x for x in a if not x.startswith('-')]
        if not names:
            raise GitError('fatal: No remote for the current branch.')
        n = names[0]
        theirs = r.branches.get(n) or (r.remote_refs.get(tuple(n.split('/', 1))) if '/' in n else None)
        if theirs is None:
            raise GitError('merge: %s - not something we can merge' % n)
        ours = self.head_sha(r)
        if r.merge_head:
            raise GitError('fatal: You have not concluded your merge (MERGE_HEAD exists).\nPlease, commit your changes before you merge.')
        if ours == theirs or theirs in self.ancestors(r, ours):
            return 'Already up to date.', 0
        staged, unstaged, _ = self.status_data(r)
        if staged or unstaged:
            raise GitError('error: Your local changes to the files would be overwritten by merge:\n\t' + '\n\t'.join(sorted({p for _, p in staged + unstaged})) + '\nPlease commit your changes or stash them before you merge.\nAborting')
        base = self.merge_base(r, ours, theirs)
        if ours in self.ancestors(r, theirs) and '--no-ff' not in a:
            stat = self.stats(r, self.tree(r, ours), self.tree(r, theirs))
            self.checkout_tree(r, theirs)
            r.branches[r.head[1]] = theirs
            lines = [' %s | %d %s' % (p, i + d, '+' * i + '-' * d) for p, i, d, _ in stat[3]]
            return 'Updating %s..%s\nFast-forward\n%s\n %d file%s changed, %d insertion%s(+)%s' % (self.short(ours), self.short(theirs), '\n'.join(lines), stat[0], '' if stat[0] == 1 else 's', stat[1], '' if stat[1] == 1 else 's', (', %d deletion%s(-)' % (stat[2], '' if stat[2] == 1 else 's')) if stat[2] else ''), 0
        bt, ot, tt = self.tree(r, base), self.tree(r, ours), self.tree(r, theirs)
        result, msgs, conflicts = {}, [], []
        for p in sorted(set(bt) | set(ot) | set(tt)):
            b, o, t = bt.get(p), ot.get(p), tt.get(p)
            if o == t:
                new = o
            elif o == b:
                new = t
            elif t == b:
                new = o
            elif o is None or t is None:
                conflicts.append(p)
                msgs.append('CONFLICT (modify/delete): %s deleted in %s and modified in %s.  Version %s of %s left in tree.' % (p, 'HEAD' if o is None else n, 'HEAD' if t is None else n, 'HEAD' if t is None else n, p))
                new = o or t
                result[p] = new
                continue
            else:
                msgs.append('Auto-merging ' + p)
                merged, bad = merge3(_split_lines(r.objects[b]) if b else [], _split_lines(r.objects[o]), _split_lines(r.objects[t]))
                text = ''.join(merged).replace('>>>>>>> MERGE', '>>>>>>> ' + n)
                new = self.store(r, text)
                if bad:
                    conflicts.append(p)
                    msgs.append('CONFLICT (%s): Merge conflict in %s' % ('add/add' if b is None else 'content', p))
                    self.sh.write(posixpath.join(r.root, p), text)
                    result[p] = new
                    continue
            if new is not None:
                result[p] = new
        for p, h in result.items():
            self.sh.write(posixpath.join(r.root, p), r.objects[h])
        for p in set(ot) - set(result):
            self.sh.files.pop(posixpath.join(r.root, p), None)
        r.index = {p: h for p, h in result.items() if p not in conflicts}
        if conflicts:
            r.conflicts = set(conflicts)
            r.merge_head, r.merge_name = theirs, n
            for p in conflicts:
                r.index.pop(p, None)
            return '\n'.join(msgs) + '\nAutomatic merge failed; fix conflicts and then commit the result.', 1
        h = self.make_commit(r, "Merge branch '%s'" % n, [ours, theirs])
        r.branches[r.head[1]] = h
        files, ins, dele, lines = self.stats(r, ot, r.objects[h]['tree'])
        return "Merge made by the 'ort' strategy.\n" + '\n'.join(' %s | %d %s' % (p, i + d, '+' * i + '-' * d) for p, i, d, _ in lines) + '\n %d file%s changed, %d insertion%s(+)' % (files, '' if files == 1 else 's', ins, '' if ins == 1 else 's') + ((', %d deletion%s(-)' % (dele, '' if dele == 1 else 's')) if dele else ''), 0

    # --- tags, reset, stash
    def g_tag(self, a):
        r = self.need()
        names = [x for x in a if not x.startswith('-')]
        if '-d' in a:
            r.tags.pop(names[0], None)
            return 'Deleted tag \'%s\'' % names[0], 0
        if not names:
            return '\n'.join(sorted(r.tags)), 0
        if names[0] in r.tags:
            raise GitError("fatal: tag '%s' already exists" % names[0])
        r.tags[names[0]] = self.resolve(r, names[1]) if len(names) > 1 else self.head_sha(r)
        return '', 0

    def g_reset(self, a):
        r = self.need()
        mode = 'mixed'
        for m in ('--soft', '--mixed', '--hard'):
            if m in a:
                mode = m[2:]
        names = [x for x in a if not x.startswith('-')]
        if names and not re.match(r'^(HEAD|[0-9a-f]{4,}|.*~\d+|.*\^+)', names[0]) and names[0] not in r.branches:
            return self.g_restore(['--staged'] + names)
        target = self.resolve(r, names[0] if names else 'HEAD')
        if r.head[0] == 'branch':
            r.branches[r.head[1]] = target
        else:
            r.head = ('detached', target)
        t = self.tree(r, target)
        if mode in ('mixed', 'hard'):
            r.index = dict(t)
        if mode == 'hard':
            for p in list(self.work(r)):
                if p not in t and (p in r.index or True) and not self.ignored(r, p) and p in self._tracked_before(r, p):
                    self.sh.files.pop(posixpath.join(r.root, p), None)
            for p, h in t.items():
                self.sh.write(posixpath.join(r.root, p), r.objects[h])
            r.merge_head = None
            r.conflicts.clear()
            return 'HEAD is now at %s %s' % (self.short(target), r.objects[target]['msg'].split('\n')[0]), 0
        return ('Unstaged changes after reset:\n' + '\n'.join('M\t' + p for _, p in self.status_data(r)[1])) if mode == 'mixed' and self.status_data(r)[1] else '', 0

    def _tracked_before(self, r, p):
        return [p] if any(p in r.objects[s]['tree'] for s in r.objects if isinstance(r.objects[s], dict)) else []

    def g_revert(self, a):
        r = self.need()
        s = self.resolve(r, [x for x in a if not x.startswith('-')][0])
        c = r.objects[s]
        old = self.tree(r, c['parents'][0]) if c['parents'] else {}
        cur = self.tree(r, self.head_sha(r))
        for p in set(old) | set(c['tree']):
            if old.get(p) != c['tree'].get(p):
                if cur.get(p) != c['tree'].get(p):
                    raise GitError('error: could not revert %s... %s\nhint: later commits changed the same file; resolve by hand.' % (self.short(s), c['msg']))
                if p in old:
                    cur[p] = old[p]
                    self.sh.write(posixpath.join(r.root, p), r.objects[old[p]])
                else:
                    cur.pop(p, None)
                    self.sh.files.pop(posixpath.join(r.root, p), None)
        r.index = dict(cur)
        msg = 'Revert "%s"\n\nThis reverts commit %s.' % (c['msg'].split('\n')[0], s)
        h = self.make_commit(r, msg, [self.head_sha(r)])
        r.branches[r.head[1]] = h
        return '[%s %s] Revert "%s"' % (r.head[1], self.short(h), c['msg'].split('\n')[0]), 0

    def g_stash(self, a):
        r = self.need()
        sub = a[0] if a and not a[0].startswith('-') else 'push'
        if sub == 'list':
            return '\n'.join('stash@{%d}: WIP on %s' % (k, s['branch']) for k, s in enumerate(reversed(r.stash))), 0
        if sub in ('pop', 'apply'):
            if not r.stash:
                raise GitError('No stash entries found.')
            s = r.stash.pop() if sub == 'pop' else r.stash[-1]
            for p, txt in s['files'].items():
                self.sh.write(posixpath.join(r.root, p), txt)
            return 'Dropped refs/stash@{0}' if sub == 'pop' else '', 0
        staged, unstaged, _ = self.status_data(r)
        if not staged and not unstaged:
            return 'No local changes to save', 0
        files = {}
        work = self.work(r)
        for _, p in staged + unstaged:
            if p in work:
                files[p] = work[p]
        r.stash.append({'files': files, 'branch': r.head[1]})
        head = self.tree(r, self.head_sha(r))
        for p in set(r.index) | set(head):
            if p in head:
                self.sh.write(posixpath.join(r.root, p), r.objects[head[p]])
            else:
                self.sh.files.pop(posixpath.join(r.root, p), None)
        r.index = dict(head)
        return 'Saved working directory and index state WIP on %s' % r.head[1], 0

    # --- remotes (a simulated server)
    def g_remote(self, a):
        r = self.need()
        if a[:1] == ['add'] and len(a) >= 3:
            if a[1] in r.remotes:
                raise GitError('error: remote %s already exists.' % a[1])
            r.remotes[a[1]] = a[2]
            r.remote_store[a[1]] = {'branches': {}, 'objects': {}}
            return '', 0
        if a[:1] == ['remove'] and len(a) > 1:
            r.remotes.pop(a[1], None)
            r.remote_store.pop(a[1], None)
            return '', 0
        if a[:1] == ['set-url'] and len(a) > 2:
            r.remotes[a[1]] = a[2]
            return '', 0
        if '-v' in a:
            return '\n'.join('%s\t%s (fetch)\n%s\t%s (push)' % (k, v, k, v) for k, v in sorted(r.remotes.items())), 0
        return '\n'.join(sorted(r.remotes)), 0

    def _remote_name(self, r, names):
        rem = names[0] if names else ('origin' if 'origin' in r.remotes else None)
        if rem is None or rem not in r.remotes:
            raise GitError("fatal: '%s' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists." % (rem or 'origin'))
        return rem

    def g_push(self, a):
        r = self.need()
        names = [x for x in a if not x.startswith('-')]
        if not r.remotes:
            raise GitError("fatal: No configured push destination.\nEither specify the URL from the command-line or configure a remote repository using\n\n    git remote add <name> <url>\n\nand then push using the remote name\n\n    git push <name>")
        rem = self._remote_name(r, names)
        branch = names[1] if len(names) > 1 else (r.head[1] if r.head[0] == 'branch' else None)
        if branch is None:
            raise GitError('fatal: You are not currently on a branch.')
        if branch not in r.branches:
            raise GitError("error: src refspec %s does not match any\nerror: failed to push some refs to '%s'" % (branch, r.remotes[rem]))
        st = r.remote_store[rem]
        url = r.remotes[rem]
        local = r.branches[branch]
        remote = st['branches'].get(branch)
        if remote and remote != local and remote not in self.ancestors(r, local) and '--force' not in a and '-f' not in a:
            return ("To %s\n ! [rejected]        %s -> %s (fetch first)\nerror: failed to push some refs to '%s'\nhint: Updates were rejected because the remote contains work that you do not have\nhint: locally. Integrate the remote changes (for example 'git pull ...') before pushing again." % (url, branch, branch, url)), 1
        for s in self.ancestors(r, local):
            st['objects'][s] = r.objects[s]
        st['branches'][branch] = local
        r.remote_refs[(rem, branch)] = local
        up = '\nbranch \'%s\' set up to track \'%s/%s\'.' % (branch, rem, branch) if ('-u' in a or '--set-upstream' in a) else ''
        return 'To %s\n %s %s -> %s%s' % (url, '* [new branch]     ' if remote is None else '%s..%s  ' % (self.short(remote), self.short(local)), branch, branch, up), 0

    def _fetch(self, r, rem):
        st = r.remote_store[rem]
        n = 0
        for b, s in st['branches'].items():
            if r.remote_refs.get((rem, b)) != s:
                n += 1
            r.remote_refs[(rem, b)] = s
            for h, c in st['objects'].items():
                r.objects.setdefault(h, c)
        return n

    def g_fetch(self, a):
        r = self.need()
        rem = self._remote_name(r, [x for x in a if not x.startswith('-')])
        n = self._fetch(r, rem)
        return ('From %s\n * updating %d remote-tracking branch(es)' % (r.remotes[rem], n)) if n else '', 0

    def g_pull(self, a):
        r = self.need()
        names = [x for x in a if not x.startswith('-')]
        rem = self._remote_name(r, names)
        self._fetch(r, rem)
        branch = names[1] if len(names) > 1 else (r.head[1] if r.head[0] == 'branch' else None)
        if (rem, branch) not in r.remote_refs:
            raise GitError("fatal: couldn't find remote ref %s" % branch)
        out, code = self.g_merge([rem + '/' + branch])
        return ('From %s\n' % r.remotes[rem] + out), code

    def g_clone(self, a):
        return 'fatal: git clone needs a real network. In this browser sandbox, practise with git init and a simulated remote: git remote add origin <url>.', 128

    def g___remote_commit(self, a):
        """Lesson set-up only: pretend a teammate pushed a commit. args: remote branch file text message"""
        r = self.need()
        rem, branch, path, text, msg = a[:5]
        st = r.remote_store[rem]
        parent = st['branches'].get(branch)
        tree = dict(r.objects[parent]['tree']) if parent else {}
        tree[path] = self.store(r, text if text.endswith('\n') else text + '\n')
        r.seq += 1
        c = {'tree': tree, 'parents': [parent] if parent else [], 'msg': msg, 'author': 'Teammate <team@example.com>', 'time': self.now(), 'seq': r.seq}
        h = sha(json.dumps([c['tree'], c['parents'], msg, c['time']], sort_keys=True))
        r.objects[h] = c
        st['objects'][h] = c
        st['branches'][branch] = h
        for p in self.ancestors(r, h):
            st['objects'][p] = r.objects[p]
        return '', 0

    # --- helpers for lesson checks
    def current_branch(self):
        r = self.repo()
        return r.head[1] if r and r.head[0] == 'branch' else None

    def messages(self, branch=None):
        r = self.repo()
        if not r:
            return []
        s = r.branches.get(branch) if branch else self.head_sha(r)
        if not s:
            return []
        return [r.objects[x]['msg'] for x in sorted(self.ancestors(r, s), key=lambda x: (r.objects[x]['time'], r.objects[x]['seq']), reverse=True)]

    def clean(self):
        r = self.repo()
        st, un, ut = self.status_data(r)
        return not (st or un or ut or r.conflicts)

    def tracked(self):
        r = self.repo()
        return sorted(self.tree(r, self.head_sha(r)))


class GitError(Exception):
    pass


# ====================================================================== terminal sessions (used by the app)
_TERMS = {}


def term(tid, action, payload=None):
    """The app's terminal talks to the sandbox through this one function; everything is JSON."""
    payload = payload or {}
    if action == 'open':
        t = _TERMS.get(tid)
        if t is None or payload.get('reset'):
            sh = Shell(payload.get('files') or {}, payload.get('cwd') or HOME)
            for line in payload.get('setup') or []:
                sh.run(line)
            sh.history.clear()
            t = _TERMS[tid] = {'sh': sh, 'goals': payload.get('goals') or []}
        return _state(tid, '')
    t = _TERMS.get(tid)
    if t is None:
        return json.dumps({'error': 'terminal not open'})
    sh = t['sh']
    if action == 'run':
        out = sh.run(payload.get('cmd', ''))
        return _state(tid, out)
    if action == 'write':
        sh.write(sh.abspath(payload['path']), payload.get('text', ''))
        return _state(tid, '')
    if action == 'read':
        return json.dumps({'text': sh.files.get(sh.abspath(payload['path']), '')})
    if action == 'new':
        sh.write(sh.abspath(payload['path']), '')
        return _state(tid, '')
    return json.dumps({'error': 'unknown action'})


def goals_met(sh, goals):
    res = []
    env = {'sh': sh, 'git': sh.git, 'docker': sh.docker, 'files': sh.files}
    for g in goals:
        try:
            res.append(bool(eval(g, dict(env))))
        except Exception:
            res.append(False)
    return res


def _state(tid, out):
    t = _TERMS[tid]
    sh = t['sh']
    files = sorted(p for p in sh.files if '/.git/' not in p and not p.startswith('/tmp') and p.startswith(HOME))
    return json.dumps({'out': out, 'prompt': sh.prompt(), 'files': [p[len(HOME) + 1:] for p in files], 'goals': goals_met(sh, t['goals']), 'status': sh.status})
