"""Checks the generated notebooks the way Jupyter would run them:
   python tools/test_notebooks.py
   - the setup cell loads, every reference solution passes dsq.check, every untouched starter does NOT."""
import json, os, sys, builtins, io, contextlib, glob, tempfile
os.environ.setdefault('MPLBACKEND', 'agg')
here = os.path.dirname(os.path.abspath(__file__)); nbdir = os.path.join(here, '..', 'public', 'notebooks')
bad = 0; total = 0
privdir = os.path.join(here, '..', 'content-private', 'notebooks')
for path in sorted(glob.glob(os.path.join(nbdir, '*.ipynb')) + glob.glob(os.path.join(privdir, '*.ipynb'))):
    nb = json.load(open(path, encoding='utf-8')); name = os.path.basename(path)
    cells = [c for c in nb['cells'] if c['cell_type'] == 'code']
    ns = {'__name__': '__main__'}
    class _IP:  # minimal get_ipython()
        user_ns = ns
    builtins.get_ipython = lambda: _IP
    with contextlib.redirect_stdout(io.StringIO()):
        exec(compile(''.join(cells[0]['source']), name + ':setup', 'exec'), ns)
    dsq = ns['dsq']
    # pair every starter cell with the check cell after it
    pairs = [(''.join(cells[i]['source']), ''.join(cells[i + 1]['source'])) for i in range(1, len(cells) - 1) if 'dsq.check(' in ''.join(cells[i + 1]['source'])]
    d = tempfile.mkdtemp(); old = os.getcwd(); os.chdir(d)
    for starter, chk in pairs:
        qid = chk.split('"')[1]; total += 1
        for mode in ('solution', 'starter'):
            for k in [k for k in list(ns) if k not in ('dsq', '__name__', '__builtins__') and not k.startswith('_')]: del ns[k]
            dsq.ok.pop(qid, None)
            try:
                import matplotlib.pyplot as _p; _p.close('all')
            except Exception: pass
            code = dsq.qs[qid]['solution'] if mode == 'solution' else starter
            buf = io.StringIO()
            try:
                with contextlib.redirect_stdout(buf):
                    exec(compile(code, qid, 'exec'), ns)
                    r = dsq.check(qid)
            except BaseException as e:
                r = False if mode == 'starter' else None
                if mode == 'solution': print('ERROR', name, qid, type(e).__name__, str(e)[:120]); bad += 1; continue
            if mode == 'solution' and not r: bad += 1; print('FAIL solution', name, qid); print(buf.getvalue()[-400:])
            if mode == 'starter' and r: bad += 1; print('FAIL starter passes', name, qid)
    os.chdir(old)
    try:
        import matplotlib.pyplot as plt; plt.close('all')
    except Exception: pass
print('notebook questions:', total, 'problems:', bad)
sys.exit(1 if bad else 0)
