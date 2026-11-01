"""Checks every Picture Class lesson against real Python.
Called by tools/verify_picture.js with one JSON document on stdin:
  { lessons: [{ id, setup, sql, steps: [{ n, code, out, check, skip }] }], scenes: [{ id, step, kind, spec, js }] }
1. code: every step with an `out` is run (in the lesson's own namespace, like a notebook) and what it prints must equal `out`.
   Steps without `out` are still run so later steps see their variables. SQL lessons (sql: true) run each step on SQLite and compare rows with `check`.
2. scenes: the numbers the animated pictures compute in the browser (PIC.math) must equal NumPy / scikit-learn for the same data."""
import sys, json, ast, io, contextlib, os, tempfile, sqlite3, warnings, math, linecache
warnings.filterwarnings('ignore')
import numpy as np

doc = json.load(sys.stdin)
bad = 0; checked = 0; fills = {}


def fail(msg):
    global bad
    bad += 1
    print('FAIL', msg)


import re


def norm(s):
    """Compare the way a reader would: ignore spacing inside arrays, NumPy 2 np.float64(...) wrappers and float noise beyond 6 decimals."""
    s = re.sub(r'np\.(?:float|int)(?:64|32)\((.*?)\)', r'\1', str(s).strip())
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r' ?, ?', ', ', s)
    s = re.sub(r'(?<=[\[(]) ', '', s)
    s = re.sub(r' (?=[\])])', '', s)
    s = re.sub(r'-?\d+\.\d+(?:e[+-]?\d+)?', lambda m: ('%.6f' % float(m.group())).rstrip('0').rstrip('.'), s)
    return '\n'.join(l.strip() for l in s.split('\n'))


def run_repl(code, ns):
    """Run code like a notebook cell: print() goes to the output, a last bare expression is echoed with repr()."""
    tree = ast.parse(code)
    buf = io.StringIO()
    # register the source so inspect.getsource works on functions defined in a step (Streamlit's AppTest.from_function needs it)
    fname = '<step-%d>' % (len(linecache.cache) + 1)
    linecache.cache[fname] = (len(code), None, code.splitlines(True), fname)
    with contextlib.redirect_stdout(buf):
        last = None
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last = ast.Expression(tree.body.pop().value)
        exec(compile(tree, fname, 'exec'), ns)
        if last is not None:
            v = eval(compile(last, fname, 'eval'), ns)
            if v is not None:
                print(repr(v))
    return buf.getvalue()


for L in doc['lessons']:
    ns = {'__name__': '__lesson__'}
    cwd = os.getcwd()
    tmp = tempfile.mkdtemp()
    os.chdir(tmp)
    try:
        if L.get('setup'):
            exec(L['setup'], ns)
        for s in L['steps']:
            if s.get('skip'):
                continue
            tag = '%s step %d' % (L['id'], s['n'])
            try:
                if L.get('sql'):
                    if 'check' in s:
                        rows = [list(r) for r in ns['db'].execute(s['code']).fetchall()]
                        checked += 1
                        nrm = lambda R: json.dumps([[int(v) if isinstance(v, float) and v == int(v) else v for v in row] for row in R])
                        if nrm(rows) != nrm(s['check']):
                            fail('%s: SQL gave %s, lesson shows %s' % (tag, rows, s['check']))
                    else:
                        ns['db'].executescript(s['code'])
                    continue
                got = run_repl(s['code'], ns)
                if s.get('fill'):
                    fills.setdefault(L['id'], {})[str(s['n'])] = got.rstrip('\n')
                elif 'out' in s:
                    checked += 1
                    if norm(got) != norm(s['out']):
                        fail('%s: Python printed\n%s\n   but the lesson shows\n%s' % (tag, norm(got), norm(s['out'])))
            except Exception as e:  # a lesson whose code does not run is a bug
                fail('%s: code raised %s: %s' % (tag, type(e).__name__, e))
    finally:
        os.chdir(cwd)

close = lambda a, b, t=1e-6: abs(a - b) <= t * max(1, abs(b))
for sc in doc['scenes']:
    tag = '%s step %d (%s)' % (sc['id'], sc['step'], sc['kind'])
    sp, js = sc['spec'], sc['js']
    checked += 1
    try:
        if sc['kind'] == 'poly':
            x = np.array([p[0] for p in sp['pts']]); y = np.array([p[1] for p in sp['pts']]); cf = np.polyfit(x, y, sp['deg'])
            tr = float(np.mean((np.polyval(cf, x) - y) ** 2)); te = None
            if sp.get('test'):
                xt = np.array([p[0] for p in sp['test']]); yt = np.array([p[1] for p in sp['test']]); te = float(np.mean((np.polyval(cf, xt) - yt) ** 2))
            if not close(tr, js['train'], 1e-3) and abs(tr - js['train']) > 1e-6 or (te is not None and abs(te - js['test']) > 1e-3 * max(1, te)):
                fail('%s: NumPy train/test error %s/%s, picture %s/%s' % (tag, tr, te, js['train'], js['test']))
        elif sc['kind'] == 'learn':
            x = np.array([p[0] for p in sp['pts']], float); y = np.array([p[1] for p in sp['pts']], float); w, b = sp['line']
            for _ in range(sp['steps']):
                e = w * x + b - y; w -= sp['lr'] * 2 * np.mean(e * x); b -= sp['lr'] * 2 * np.mean(e)
            if not (close(w, js['w']) and close(b, js['b'])):
                fail('%s: gradient descent ends at %s,%s but the picture at %s,%s' % (tag, w, b, js['w'], js['b']))
        elif sc['kind'] == 'kmeans':
            from sklearn.cluster import KMeans
            P = np.array(sp['pts'], float); km = KMeans(len(sp['init']), init=np.array(sp['init'], float), n_init=1).fit(P)
            if not (np.allclose(km.cluster_centers_, np.array(js['cents']), atol=1e-6) and abs(km.inertia_ - js['inertia']) < 1e-6 and km.labels_.tolist() == js['labels']):
                fail('%s: scikit-learn KMeans disagrees with the picture' % tag)
        elif sc['kind'] == 'tree':
            from sklearn.tree import DecisionTreeClassifier
            P = np.array(sp['pts'], float); t = DecisionTreeClassifier(max_depth=sp['depth'], random_state=0).fit(P[:, :2], P[:, 2].astype(int)).tree_
            mine = [(n['f'], n['th'], n['n']) for n in js['pre']]  # preorder, splits only
            ref = [(int(t.feature[i]), float(t.threshold[i]), int(t.n_node_samples[i])) for i in range(t.node_count) if t.children_left[i] != -1]
            order = []
            def pre(i):
                if t.children_left[i] == -1: return
                order.append(i); pre(t.children_left[i]); pre(t.children_right[i])
            pre(0); ref = [(int(t.feature[i]), float(t.threshold[i]), int(t.n_node_samples[i])) for i in order]
            if len(mine) != len(ref) or any(a[0] != b[0] or abs(a[1] - b[1]) > 1e-9 or a[2] != b[2] for a, b in zip(mine, ref)):
                fail('%s: scikit-learn tree %s but the picture %s' % (tag, ref, mine))
        elif sc['kind'] == 'classify':
            P = np.array(sp['pts'], float); G = np.array(sc['grid'], float)
            if sp['model'] == 'knn':
                from sklearn.neighbors import KNeighborsClassifier
                ref = KNeighborsClassifier(sp.get('k', 3)).fit(P[:, :2], P[:, 2].astype(int)).predict_proba(G)[:, 1]
            else:
                from sklearn.linear_model import LogisticRegression
                m = LogisticRegression().fit(P[:, :2], P[:, 2].astype(int)); ref = m.predict_proba(G)[:, 1]
                if not (np.allclose(m.coef_[0], sp['coef'], atol=1e-6) and abs(m.intercept_[0] - sp['intercept']) < 1e-6):
                    fail('%s: scikit-learn coefficients %s %s differ from the picture' % (tag, m.coef_, m.intercept_))
            if not np.allclose(ref, js['p'], atol=1e-6):
                fail('%s: scikit-learn probabilities %s but the picture %s' % (tag, np.round(ref, 3), np.round(js['p'], 3)))
        elif sc['kind'] == 'abpower':
            from statistics import NormalDist
            nd = NormalDist(); p0 = sp['p0']; p1 = p0 + sp['lift']; n = sp['n']; al = sp.get('alpha', .05); pb = (p0 + p1) / 2
            se0 = (2 * pb * (1 - pb) / n) ** .5; se1 = (p0 * (1 - p0) / n + p1 * (1 - p1) / n) ** .5; zc = nd.inv_cdf(1 - al / 2) * se0; d = p1 - p0
            pw = 1 - nd.cdf((zc - d) / se1) + nd.cdf((-zc - d) / se1)
            if abs(pw - js['power']) > 1e-4: fail('%s: power %s but the picture %s' % (tag, pw, js['power']))
        elif sc['kind'] == 'psi':
            ref = np.array(sp['ref'], float); cur = np.array(sp['cur'], float); e = np.array(sp['edges'], float)
            r = np.histogram(ref, bins=e)[0] / len(ref); q = np.histogram(cur, bins=e)[0] / len(cur); r = np.maximum(r, 1e-4); q = np.maximum(q, 1e-4); ps = float(np.sum((q - r) * np.log(q / r)))
            if abs(ps - js['psi']) > 1e-6: fail('%s: PSI %s but the picture %s' % (tag, ps, js['psi']))
        elif sc['kind'] == 'dag':
            from graphlib import TopologicalSorter
            deps = {n['id']: set() for n in sp['nodes']}
            for a2, b2 in sp['edges']: deps[b2].add(a2)
            ts = TopologicalSorter(deps); ts.prepare(); rounds = []
            while ts.is_active():
                rd = ts.get_ready(); rounds.append(sorted(rd)); ts.done(*rd)
            if rounds != js['waves']: fail('%s: graphlib rounds %s but the picture %s' % (tag, rounds, js['waves']))
        elif sc['kind'] == 'contrast':
            def lum(h):
                h = h.lstrip('#'); h = ''.join(c * 2 for c in h) if len(h) == 3 else h
                ch = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]; lin = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in ch]
                return .2126 * lin[0] + .7152 * lin[1] + .0722 * lin[2]
            a2, b2 = lum(sp['fg']), lum(sp['bg']); ratio = (max(a2, b2) + .05) / (min(a2, b2) + .05)
            if abs(ratio - js['ratio']) > 1e-9: fail('%s: WCAG ratio %s but the picture %s' % (tag, ratio, js['ratio']))
        elif sc['kind'] == 'miniapp':
            import pandas as pd
            df = pd.DataFrame(sp['data']['rows'], columns=sp['data']['cols']); got = []
            for st in sc['states']:
                d = df[df[sp['data']['cols'][0]].isin(st['cities']) & (df[sp['data']['cols'][2]] >= st['min'])]; got.append([len(d), int(d[sp['data']['cols'][2]].sum())])
            if got != js['out']: fail('%s: pandas gives %s but the picture %s' % (tag, got, js['out']))
        elif sc['kind'] == 'conv':
            img = np.array(sp['img']); k = np.array(sp['kernel'])
            F = np.array([[(img[i:i + k.shape[0], j:j + k.shape[1]] * k).sum() for j in range(img.shape[1] - k.shape[1] + 1)] for i in range(img.shape[0] - k.shape[0] + 1)])
            R = np.maximum(F, 0); h, w = R.shape; P = R[:h // 2 * 2, :w // 2 * 2].reshape(h // 2, 2, w // 2, 2).max(axis=(1, 3))
            if not (np.array_equal(F, np.array(js['F'])) and np.array_equal(R, np.array(js['R'])) and np.array_equal(P, np.array(js['P']))):
                fail('%s: NumPy convolution disagrees with the picture' % tag)
        elif sc['kind'] == 'hist':
            d = np.array(sp['data'], float)
            edges = sp['edges'] if sp.get('edges') else np.linspace(d.min(), d.max(), sp.get('bins', 10) + 1)
            c, _ = np.histogram(d, bins=edges)
            if not (c.tolist() == js['counts'] and close(d.mean(), js['mean']) and close(np.median(d), js['median']) and close(d.std(), js['std'])):
                fail('%s: NumPy histogram/mean/median/std disagree with the picture' % tag)
    except Exception as e:
        fail('%s: %s: %s' % (tag, type(e).__name__, e))

if doc.get('fill'):
    print('FILLJSON:' + json.dumps(fills))
print('%d checks, %d problems' % (checked, bad))
sys.exit(1 if bad else 0)
