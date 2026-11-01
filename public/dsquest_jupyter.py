"""DS Quest <-> your own Jupyter, in one command.

Run it once in the terminal you normally use for Python (Anaconda Prompt, PowerShell, bash):

    python dsquest_jupyter.py                      # uses the app address printed on the DS Quest "Jupyter" page

What it does:
  1. uses the Jupyter that is installed in THIS Python / Anaconda environment (offers to install it if missing),
  2. copies the practice notebooks for every module into  ~/dsquest/  (never overwrites your own edits),
  3. starts JupyterLab on 127.0.0.1 only, with a random one-time token, allowing ONLY the DS Quest page to embed it,
  4. opens DS Quest in your browser, which connects and shows Jupyter beside the lesson.

Nothing leaves your computer except the notebook download from the DS Quest site. Stop with Ctrl+C.
"""
import argparse, json, os, re, secrets, shutil, socket, subprocess, sys, urllib.request, webbrowser

DEFAULT_APP = os.environ.get('DSQUEST_APP', 'https://ds-quest-silk.vercel.app')


def have(mod):
    try:
        __import__(mod)
        return True
    except Exception:
        return False


def free_port(want):
    for p in range(want, want + 30):
        with socket.socket() as s:
            if s.connect_ex(('127.0.0.1', p)) != 0:
                return p
    raise SystemExit('no free port near %d' % want)


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'dsquest-launcher'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--app', default=DEFAULT_APP, help='DS Quest address (default %s)' % DEFAULT_APP)
    ap.add_argument('--port', type=int, default=8899)
    ap.add_argument('--dir', default=os.path.join(os.path.expanduser('~'), 'dsquest'))
    ap.add_argument('--refresh', action='store_true', help='overwrite notebooks that already exist')
    ap.add_argument('--no-open', action='store_true', help='do not open the browser')
    ap.add_argument('--yes', action='store_true', help='install JupyterLab without asking if it is missing')
    ap.add_argument('--key', default='', help='your personal notebook key (shown in the app); needed for the paid-access notebooks')
    a = ap.parse_args()
    app = a.app.rstrip('/')

    if not have('jupyterlab'):
        print('JupyterLab is not installed in this Python (%s).' % sys.executable)
        if not a.yes and input('Install jupyterlab numpy pandas matplotlib seaborn now? [y/N] ').strip().lower() != 'y':
            raise SystemExit('Install it with:  %s -m pip install jupyterlab numpy pandas matplotlib seaborn' % sys.executable)
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'jupyterlab', 'numpy', 'pandas', 'matplotlib', 'seaborn'])

    nbdir = os.path.join(a.dir, 'dsquest'); os.makedirs(nbdir, exist_ok=True)
    try:
        ids = json.loads(fetch(app + '/notebooks/index.json'))
        got = 0
        for m in ids:
            for suffix in ('', '-blank'):
                name = m + suffix + '.ipynb'; dest = os.path.join(nbdir, name)
                if os.path.exists(dest) and not a.refresh:
                    continue
                with open(dest, 'wb') as f:
                    f.write(fetch('%s/notebooks/%s' % (app, name)))
                got += 1
        if a.key:
            skipped = 0
            for m in json.loads(fetch(app + '/api/content/manifest')).get('premium', []):
                for suffix in ('', '-blank'):
                    name = m + suffix + '.ipynb'; dest = os.path.join(nbdir, name)
                    if os.path.exists(dest) and not a.refresh:
                        continue
                    try:
                        data = fetch('%s/api/content/notebook/%s?key=%s' % (app, name, a.key))
                    except Exception:
                        skipped += 1; continue
                    with open(dest, 'wb') as f:
                        f.write(data)
                    got += 1
            if skipped:
                print('%d paid-access notebooks were not available for this account.' % skipped)
        print('Notebooks ready in %s (%d new)' % (nbdir, got))
    except Exception as e:
        print('Could not download the notebooks from %s (%s). Using what is already in %s.' % (app, e, nbdir))

    port = free_port(a.port); token = secrets.token_urlsafe(24)
    origins = [app, 'http://127.0.0.1:5177', 'http://localhost:5177']
    m = re.match(r'^(https?)://(127\.0\.0\.1|localhost)(:\d+)?$', app)
    if m:  # the page may be opened as 127.0.0.1 or as localhost: allow both spellings of the same port
        origins += ['%s://%s%s' % (m.group(1), h, m.group(3) or '') for h in ('127.0.0.1', 'localhost')]
    origins = sorted(set(origins))
    esc = lambda s: re.escape(s)
    pat = '^(' + '|'.join(esc(o) for o in origins) + ')$'
    csp = "frame-ancestors 'self' " + ' '.join(origins)
    cfg = {
        'url': 'http://127.0.0.1:%d' % port, 'token': token, 'dir': nbdir,
    }
    with open(os.path.join(a.dir, 'connection.json'), 'w') as f:
        json.dump(cfg, f)
    cmd = [sys.executable, '-m', 'jupyterlab', '--no-browser', '--ServerApp.ip=127.0.0.1', '--port=%d' % port, '--ServerApp.port_retries=0',
           '--ServerApp.token=' + token, '--ServerApp.root_dir=' + a.dir, '--ServerApp.allow_origin_pat=' + pat,
           '--ServerApp.tornado_settings=' + repr({'headers': {'Content-Security-Policy': csp}}),
           '--ServerApp.cookie_options=' + repr({'SameSite': 'None', 'Secure': True}),
           '--IdentityProvider.token=' + token]
    link = '%s/#/jupyter/connect/%d/%s' % (app, port, token)
    print('\nStarting JupyterLab on 127.0.0.1:%d ...' % port)
    print('DS Quest link (opens and connects automatically):\n  ' + link + '\n')
    if not a.no_open:
        try:
            webbrowser.open(link)
        except Exception:
            pass
    try:
        subprocess.call(cmd)
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
