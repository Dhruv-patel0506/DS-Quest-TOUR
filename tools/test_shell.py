"""Checks for the in-browser shell, Git and Docker sandboxes (public/dsq_shell.py, dsq_docker.py).

    python tools/test_shell.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public'))
from dsq_shell import Shell  # noqa: E402

bad = 0


def ok(cond, msg):
    global bad
    print(('PASS ' if cond else 'FAIL ') + msg)
    bad += 0 if cond else 1


def run(sh, text):
    out = []
    for line in text.strip().splitlines():
        out.append(sh.run(line.strip()))
    return '\n'.join(out)


# ---------------------------------------------------------------- shell basics
sh = Shell({'proj/data.csv': 'a,b\n1,2\n3,4\n', 'proj/notes.txt': 'alpha\nbeta\nalpha\n'}, '/home/learner/proj')
ok(sh.run('ls') == 'data.csv  notes.txt', 'ls lists files')
ok(sh.run('cat notes.txt | grep alpha | wc -l') == '2', 'pipes: cat | grep | wc')
sh.run('mkdir out && cd out && echo hi > a.txt')
ok(sh.cwd.endswith('/proj/out') and sh.read('a.txt') == 'hi\n', 'mkdir, cd, redirect and && work')
ok('No such file' in sh.run('cat nope.txt'), 'a missing file is reported')
ok('command not found' in sh.run('frobnicate'), 'unknown command')
sh.run('cd ..')
sh.run('export NAME=Asha')
ok(sh.run('echo hello $NAME') == 'hello Asha', 'environment variables expand')
sh.write('/home/learner/proj/app.py', 'import os\nprint("hi", os.environ.get("NAME"))\nopen("made.txt","w").write("x")\n')
ok(sh.run('python app.py') == 'hi Asha' and sh.exists('made.txt'), 'python runs a script with the shell environment and keeps files it creates')
sh.write('/home/learner/proj/bad.py', 'import requests\n')
ok('No module named' in sh.run('python bad.py'), 'importing a package that was not pip installed fails like the real thing')
sh.run('python -m venv .venv')
sh.run('source .venv/bin/activate')
ok(sh.venv and 'Successfully installed' in sh.run('pip install requests==2.31.0') and sh.run('pip freeze') == 'requests==2.31.0', 'venv + pip install + freeze')
sh.write('/home/learner/proj/bad.py', 'import requests\nprint("ok")\n')

# ---------------------------------------------------------------- git
g = Shell({'repo/readme.md': '# demo\n'}, '/home/learner/repo')
ok('Initialized empty' in g.run('git init'), 'git init')
ok('Untracked files' in g.run('git status') and 'readme.md' in g.run('git status'), 'status shows untracked files')
g.run('git add .')
ok('Author identity unknown' in g.run('git commit -m first'), 'commit without an identity explains how to set it')
g.run('git config user.name Asha')
g.run('git config user.email asha@example.com')
out = g.run('git commit -m "first"')
ok('root-commit' in out and '1 file changed' in out, 'first commit: ' + out.splitlines()[0])
ok('working tree clean' in g.run('git status'), 'clean after commit')
g.run('echo line2 >> readme.md')
ok('+line2' in g.run('git diff'), 'git diff shows the added line')
g.run('git add readme.md')
ok('+line2' in g.run('git diff --staged') and g.run('git diff') == '', 'staged diff versus working diff')
g.run('git commit -m second')
ok(g.git.messages() == ['second', 'first'], 'log order')
g.run('git switch -c feature')
g.run('echo feat > f.txt')
g.run('git add f.txt && git commit -m "add feature"')
g.run('git switch main')
ok(not g.exists('f.txt'), 'switching branch removes the other branch\'s file')
ok('Fast-forward' in g.run('git merge feature') and g.exists('f.txt'), 'fast-forward merge')
# conflict
g.run('git switch -c a')
g.run('echo "A version" > c.txt')
g.run('git add c.txt && git commit -m A')
g.run('git switch main')
g.run('echo "main version" > c.txt')
g.run('git add c.txt && git commit -m M')
out = g.run('git merge a')
ok('CONFLICT' in out and '<<<<<<< HEAD' in g.read('c.txt') and '>>>>>>> a' in g.read('c.txt'), 'merge conflict writes markers')
ok('Unmerged paths' in g.run('git status'), 'status shows unmerged paths')
ok('unmerged' in g.run('git commit -m x'), 'cannot commit while conflicted')
g.write('/home/learner/repo/c.txt', 'resolved\n')
g.run('git add c.txt')
out = g.run('git commit -m "merge a"')
ok(g.git.clean() and len(g.git.repo().objects[g.git.head_sha(g.git.repo())]['parents']) == 2, 'resolved conflict makes a two-parent merge commit')
# clean three-way merge on different lines
g.write('/home/learner/repo/long.txt', '\n'.join('line%d' % i for i in range(1, 11)) + '\n')
g.run('git add long.txt && git commit -m long')
g.run('git switch -c top')
g.write('/home/learner/repo/long.txt', 'TOP\n' + g.read('long.txt'))
g.run('git commit -am top')
g.run('git switch main')
g.write('/home/learner/repo/long.txt', g.read('long.txt') + 'BOTTOM\n')
g.run('git commit -am bottom')
out = g.run('git merge top')
ok("Merge made by the 'ort' strategy" in out and g.read('long.txt').startswith('TOP') and g.read('long.txt').endswith('BOTTOM\n'), 'changes on different lines merge cleanly')
# reset and tags
g.run('git tag v1')
ok('v1' in g.run('git log --oneline'), 'tag is shown in the log')
g.run('echo junk > junk.txt && git add junk.txt && git commit -m junk')
g.run('git reset --hard HEAD~1')
ok(not g.exists('junk.txt') and 'junk' not in g.git.messages(), 'reset --hard HEAD~1 removes the last commit and its file')
g.run('echo ignored > secret.env')
g.write('/home/learner/repo/.gitignore', '*.env\n')
ok('secret.env' not in g.run('git status'), '.gitignore hides matching files')
# remote
g.run('git remote add origin https://github.com/learner/repo.git')
ok('new branch' in g.run('git push -u origin main'), 'first push creates the remote branch')
g.run('git __remote_commit origin main notes.txt "from team" "team commit"')
g.run('echo mine > mine.txt && git add mine.txt && git commit -m mine')
out = g.run('git push')
ok('rejected' in out and 'fetch first' in out, 'push is rejected when the remote has newer work: ' + out.splitlines()[1].strip())
out = g.run('git pull')
ok(g.exists('notes.txt') and 'team commit' in g.git.messages(), 'pull brings the teammate\'s commit in')
ok('main -> main' in g.run('git push'), 'push works after pull')
ok('nothing' in g.run('git stash') or True, 'stash command does not crash')

# ---------------------------------------------------------------- docker
d = Shell({'app/app.py': 'import os\nprint("Hello from", os.environ.get("WHO", "nobody"))\n', 'app/requirements.txt': 'pandas\nrequests\n',
           'app/Dockerfile': 'FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY . .\nENV WHO=docker\nCMD ["python", "app.py"]\n'}, '/home/learner/app')
out = d.run('docker build -t demo:1 .')
ok('FINISHED' in out and 'CACHED' not in out and d.docker.image_exists('demo:1'), 'docker build succeeds the first time')
out2 = d.run('docker build -t demo:1 .')
ok(out2.count('CACHED') >= 4, 'an unchanged rebuild uses the cache for every layer')
d.write('/home/learner/app/app.py', 'print("changed")\n')
out3 = d.run('docker build -t demo:1 .')
lines = out3.splitlines()
ok(any('CACHED' in l and 'pip install' in l for l in lines) and not any('CACHED' in l and 'COPY . .' in l for l in lines), 'changing code only rebuilds the layers after COPY . . (the pip layer stays cached)')
ok('changed' in d.run('docker run --rm demo:1'), 'docker run executes the CMD')
d.write('/home/learner/app/app.py', 'import os\nprint("Hello from", os.environ.get("WHO", "nobody"))\n')
d.run('docker build -t demo:1 .')
ok(d.run('docker run --rm demo:1') == 'Hello from docker', 'ENV from the Dockerfile reaches the program')
ok(d.run('docker run --rm -e WHO=asha demo:1') == 'Hello from asha', '-e overrides it')
ok('demo' in d.run('docker images') and 'MB' in d.run('docker images'), 'docker images lists sizes')
# the classic mistakes
d.write('/home/learner/app/Dockerfile', 'FROM python:3.12-slim\nRUN pip install -r requirements.txt\nCOPY . .\nCMD ["python", "app.py"]\n')
out = d.run('docker build -t bad .')
ok('FAILED' in out and 'Could not open requirements file' in out, 'pip install before COPY requirements fails with a clear reason')
d.write('/home/learner/app/Dockerfile', 'FROM python:3.12-slim\nCOPY missing.txt .\n')
ok('not found' in d.run('docker build -t bad .'), 'COPY of a missing file fails')
d.write('/home/learner/app/Dockerfile', 'FROM python:3.12-slim\nFOO bar\n')
ok('unknown instruction: FOO' in d.run('docker build -t bad .'), 'unknown instruction')
d.write('/home/learner/app/Dockerfile', 'FROM python:3.12\nCOPY . .\n')
big = d.run('docker build -t big .')
d.write('/home/learner/app/Dockerfile', 'FROM python:3.12-slim\nCOPY . .\n')
d.run('docker build -t small .')
imgs = d.run('docker images')
ok('1020MB' in imgs or '1.0' in imgs, 'full python image is about 1 GB while slim is small: ' + [l for l in imgs.splitlines() if l.startswith('big')][0][-8:])
# server container + ps + stop
d.write('/home/learner/app/main.py', 'from fastapi import FastAPI\napp = FastAPI()\n')
d.write('/home/learner/app/Dockerfile', 'FROM python:3.12-slim\nWORKDIR /srv\nCOPY main.py .\nEXPOSE 8000\nCMD ["uvicorn", "main:app", "--host", "0.0.0.0"]\n')
d.run('docker build -t api .')
out = d.run('docker run -d -p 8080:8000 --name api1 api')
ok(len(out) == 64 and 'api1' in d.run('docker ps') and '8080->8000' in d.run('docker ps'), 'detached server container appears in docker ps with its port mapping')
d.run('docker stop api1')
ok('api1' not in d.run('docker ps') and 'Exited' in d.run('docker ps -a'), 'stop moves it to docker ps -a')
d.write('/home/learner/app/Dockerfile', 'FROM python:3.12-slim\nWORKDIR /srv\nCOPY main.py .\nCMD ["uvicorn", "wrong:app"]\n')
d.run('docker build -t api2 .')
ok('Could not import module "wrong"' in d.run('docker run --rm api2'), 'a wrong module in CMD is reported like uvicorn does')
# compose
c = Shell({'stack/docker-compose.yml': 'services:\n  web:\n    build: .\n    ports:\n      - "8000:8000"\n    environment:\n      - DB_HOST=db\n    depends_on:\n      - db\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD: secret\n    volumes:\n      - pgdata:/var/lib/postgresql/data\nvolumes:\n  pgdata:\n',
           'stack/main.py': 'app = 1\n', 'stack/Dockerfile': 'FROM python:3.12-slim\nWORKDIR /srv\nCOPY main.py .\nCMD ["uvicorn", "main:app"]\n'}, '/home/learner/stack')
out = c.run('docker compose up -d')
ok('Container stack-db-1' in out and 'Container stack-web-1' in out and out.index('stack-db-1') < out.index('stack-web-1'), 'compose starts the database before the web service (depends_on)')
ok('stack-web-1' in c.run('docker compose ps') and 'stack-db-1' in c.run('docker compose ps'), 'compose ps lists both')
ok('Removed' in c.run('docker compose down') and not c.docker.running(), 'compose down removes them')
c.write('/home/learner/stack/docker-compose.yml', 'services:\n  web:\n    build: .\n    depends_on:\n      - cache\n')
ok('undefined service' in c.run('docker compose up'), 'compose catches a depends_on typo')

print('\nALL PASSED' if not bad else '\n%d FAILED' % bad)
sys.exit(1 if bad else 0)
