'use strict';
/* =====================================================================
   Python runtime: Pyodide (CPython + numpy/pandas/matplotlib/sklearn in WebAssembly)
   runs in a Web Worker so an infinite loop can be stopped without freezing the page.
   Py.run({code, tests, files, prelude, timeout}) ->
     {stdout, error:{line,type,msg,src,where}|null, figs:[base64 png], checks:[{ok,msg,hint}], ms}
   ===================================================================== */
const PY_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
/* Self-hosted copy first (public/vendor, filled by tools/fetch_offline.js, cached by the service worker so it works with no internet);
   the CDN is only the fallback when those files are not there. */
const PY_WHERE = (async () => {
  try {
    const r = await fetch(new URL('vendor/manifest.json', document.baseURI), { cache: 'no-cache' });
    const m = r.ok ? await r.json() : null;
    if (m && m.pyodide) {
      const wheels = m.files.filter(f => /^vendor\/wheels\/.+\.whl$/.test(f)).map(f => new URL(f, document.baseURI).href);
      return { base: new URL('vendor/pyodide/', document.baseURI).href, wheels, local: true };
    }
  } catch (e) { }
  return { base: PY_CDN, wheels: null, local: false };
})();

const PY_HARNESS = String.raw`
import sys, io, json, traceback, base64, os

def _fmt_err(e, code, prelude):
    if isinstance(e, SyntaxError):
        fn = e.filename or ''
        line = e.lineno or 0
        src = (code if fn == '<your code>' else prelude).split('\n')[line-1] if line else ''
        return {'line': line, 'type': 'SyntaxError', 'msg': e.msg, 'src': src.strip(), 'where': 'code' if fn == '<your code>' else 'earlier'}
    tb = traceback.extract_tb(e.__traceback__)
    mine = [f for f in tb if f.filename == '<your code>']
    early = [f for f in tb if f.filename == '<prelude>']
    where = 'code'
    if mine:
        line = mine[-1].lineno; src = code.split('\n')[line-1]
    elif early:
        line = early[-1].lineno; src = prelude.split('\n')[line-1]; where = 'earlier'
    else:
        line = 0; src = ''
    return {'line': line, 'type': type(e).__name__, 'msg': str(e)[:400], 'src': src.strip(), 'where': where}


import types

def _snap(v):
    t = type(v).__name__
    try:
        import numpy as _np
    except Exception:
        _np = None
    try:
        if _np is not None and isinstance(v, _np.ndarray):
            d = {'t': 'arr', 'shape': list(v.shape), 'dtype': str(v.dtype)}
            if v.ndim <= 2 and v.size <= 64:
                d['data'] = _np.round(v.astype(float), 4).tolist() if v.dtype.kind in 'fiub' else v.astype(str).tolist()
            return d
        if _np is not None and isinstance(v, (_np.integer, _np.floating, _np.bool_)):
            return {'t': 'num', 'r': repr(v.item())}
        if isinstance(v, (bool, int, float)) or v is None:
            return {'t': 'num' if v is not None else 'none', 'r': repr(v)}
        if isinstance(v, str):
            return {'t': 'str', 'r': repr(v)[:60]}
        if isinstance(v, (list, tuple, set)):
            d = {'t': t, 'r': repr(v)[:90], 'n': len(v)}
            if len(v) <= 14 and all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in v):
                d['data'] = [list(map(float, v))] if not isinstance(v, set) else None
            return d
        if isinstance(v, dict):
            return {'t': 'dict', 'r': repr(v)[:100], 'n': len(v)}
        mod = type(v).__module__ or ''
        if mod.startswith('pandas'):
            if hasattr(v, 'columns'):
                return {'t': 'df', 'shape': list(v.shape), 'cols': [str(c) for c in list(v.columns)[:8]], 'head': [[str(x)[:10] for x in row] for row in v.head(4).values.tolist()]}
            if hasattr(v, 'index') and hasattr(v, 'values'):
                return {'t': 'series', 'shape': list(v.shape), 'head': [str(x)[:10] for x in list(v.values[:6])]}
        return {'t': t, 'r': repr(v)[:50]}
    except Exception:
        return {'t': t, 'r': '?'}

def _dsq_trace(payload):
    p = json.loads(payload)
    code = p['code']; files = p.get('files') or {}; prelude = p.get('prelude') or ''
    for name, content in files.items():
        d = os.path.dirname(name)
        if d: os.makedirs(d, exist_ok=True)
        with open(name, 'w') as f: f.write(content)
    ns = {'__name__': '__main__'}
    buf = io.StringIO(); old = (sys.stdout, sys.stderr)
    events = []; err = None; trunc = [False]
    SKIP = {'np', 'pd', 'plt', 'sns', 'matplotlib', 'sklearn'}
    class _Stop(Exception): pass
    depth = [0]
    def tracer(frame, event, arg):
        if frame.f_code.co_filename != '<your code>':
            return None
        if event == 'call':
            depth[0] += 1
            return tracer if depth[0] <= 3 else None
        if event == 'return':
            depth[0] -= 1
            if frame.f_code.co_name != '<module>':
                events.append({'line': frame.f_lineno, 'fn': frame.f_code.co_name, 'ret': _snap(arg), 'vars': {}, 'out': buf.getvalue()[-300:]})
            return tracer
        if event == 'line':
            if len(events) >= 260:
                trunc[0] = True
                raise _Stop()
            loc = frame.f_globals if frame.f_code.co_name == '<module>' else frame.f_locals
            vs = {}
            for k, v in list(loc.items()):
                if k.startswith('_') or k in SKIP or callable(v) or isinstance(v, types.ModuleType):
                    continue
                vs[k] = _snap(v)
            events.append({'line': frame.f_lineno, 'fn': frame.f_code.co_name, 'vars': vs, 'out': buf.getvalue()[-300:]})
        return tracer
    sys.stdout = buf; sys.stderr = buf
    try:
        if 'matplotlib' in code or 'plt' in code:
            import matplotlib; matplotlib.use('agg')
        if prelude:
            exec(compile(prelude, '<prelude>', 'exec'), ns)
            buf.seek(0); buf.truncate(0)
        sys.settrace(tracer)
        try:
            exec(compile(code, '<your code>', 'exec'), ns)
        finally:
            sys.settrace(None)
    except _Stop:
        pass
    except BaseException as e:
        err = _fmt_err(e, code, prelude)
    finally:
        sys.stdout, sys.stderr = old
    try:
        import matplotlib.pyplot as _plt; _plt.close('all')
    except Exception:
        pass
    return json.dumps({'events': events, 'error': err, 'stdout': buf.getvalue()[:4000], 'truncated': trunc[0]})

def _dsq_run(payload):
    p = json.loads(payload)
    code = p['code']; tests = p.get('tests') or ''; files = p.get('files') or {}; prelude = p.get('prelude') or ''
    for name, content in files.items():
        d = os.path.dirname(name)
        if d: os.makedirs(d, exist_ok=True)
        with open(name, 'w') as f: f.write(content)
    ns = {'__name__': '__main__'}
    res = {'stdout': '', 'error': None, 'figs': [], 'checks': []}
    buf = io.StringIO(); old = (sys.stdout, sys.stderr); sys.stdout = buf; sys.stderr = buf
    plt = None
    allsrc = code + prelude + tests
    try:
        if any(k in allsrc for k in ('matplotlib', 'seaborn', 'plt', '.hist(', '.plot(', '.boxplot(', '.bar(', '.scatter(')):
            import matplotlib; matplotlib.use('agg'); import matplotlib.pyplot as plt; plt.close('all')
        if prelude:
            exec(compile(prelude, '<prelude>', 'exec'), ns)
            buf.seek(0); buf.truncate(0)
            if plt is not None: plt.close('all')
        exec(compile(code, '<your code>', 'exec'), ns)
    except BaseException as e:
        res['error'] = _fmt_err(e, code, prelude)
    finally:
        sys.stdout, sys.stderr = old
    res['stdout'] = buf.getvalue()[:20000]
    if res['error'] is None and tests:
        checks = res['checks']
        def check(cond, msg, hint=''):
            ok = bool(cond)
            checks.append({'ok': ok, 'msg': msg, 'hint': '' if ok else hint})
            return ok
        tns = dict(ns); tns['check'] = check; tns['OUT'] = res['stdout']
        for _m, _a in (('numpy', 'np'), ('pandas', 'pd')):
            if _a not in tns:
                try: tns[_a] = __import__(_m)
                except Exception: pass
        if plt is not None and 'plt' not in tns: tns['plt'] = plt
        try:
            exec(compile(tests, '<tests>', 'exec'), tns)
        except BaseException as e:
            checks.append({'ok': False, 'msg': 'A check could not finish: ' + type(e).__name__ + ': ' + str(e)[:200], 'hint': 'Did you create every variable name the task asks for?'})
        res['ns'] = {k: repr(v)[:200] for k, v in ns.items() if not k.startswith('_') and k in ('result', 'answer')}
    if plt is not None:
        try:
            for n in plt.get_fignums():
                b = io.BytesIO(); plt.figure(n).savefig(b, format='png', dpi=80, bbox_inches='tight')
                res['figs'].append(base64.b64encode(b.getvalue()).decode())
        except Exception as e:
            res['figs_err'] = str(e)[:200]
        plt.close('all')
    return json.dumps(res)
_KNS = {'__name__': '__main__'}
def _dsq_kreset():
    _KNS.clear(); _KNS['__name__'] = '__main__'

def _dsq_cell(payload):
    import ast
    _p = json.loads(payload); code = _p['code']
    for _n, _c in (_p.get('files') or {}).items():
        with open(_n, 'w') as _f: _f.write(_c)
    res = {'stdout': '', 'error': None, 'figs': [], 'value': None}
    buf = io.StringIO(); old = (sys.stdout, sys.stderr); sys.stdout = buf; sys.stderr = buf
    plt = None
    try:
        if any(k in code for k in ('matplotlib', 'seaborn', 'plt', '.hist(', '.plot(', '.boxplot(', '.bar(', '.scatter(')):
            import matplotlib; matplotlib.use('agg'); import matplotlib.pyplot as plt; plt.close('all'); _KNS.setdefault('plt', plt)
        tree = ast.parse(code, '<cell>', 'exec')
        last = None
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last = ast.Expression(tree.body.pop().value)
        exec(compile(tree, '<cell>', 'exec'), _KNS)
        if last is not None:
            v = eval(compile(last, '<cell>', 'eval'), _KNS)
            if v is not None:
                try:
                    if hasattr(v, '_repr_html_') and type(v).__module__.startswith('pandas'):
                        res['value'] = {'html': v._repr_html_()[:60000], 'text': repr(v)[:400]}
                    else:
                        res['value'] = {'text': repr(v)[:6000]}
                except Exception:
                    res['value'] = {'text': object.__repr__(v)}
                _KNS['_'] = v
    except BaseException as e:
        tb = traceback.extract_tb(e.__traceback__)
        mine = [f for f in tb if f.filename == '<cell>']
        line = mine[-1].lineno if mine else (getattr(e, 'lineno', 0) or 0)
        lines_ = code.splitlines()
        src = lines_[line-1].strip() if line and line <= len(lines_) else ''
        res['error'] = {'line': line, 'type': type(e).__name__, 'msg': (e.msg if isinstance(e, SyntaxError) else str(e))[:400], 'src': src}
    finally:
        sys.stdout, sys.stderr = old
    res['stdout'] = buf.getvalue()[:400000]
    if plt is not None:
        try:
            for n in plt.get_fignums():
                b = io.BytesIO(); plt.figure(n).savefig(b, format='png', dpi=80, bbox_inches='tight')
                res['figs'].append(base64.b64encode(b.getvalue()).decode())
        except Exception as e:
            res['figs_err'] = str(e)[:200]
        plt.close('all')
    return json.dumps(res)
`;

const PY_WORKER_SRC = `
let py = null, initP = null, loaded = {};
const say = (text, pct) => postMessage({ type: 'status', text, pct });
let WHEELS = null;
async function init(w) {
  WHEELS = w.wheels;
  importScripts(w.base + 'pyodide.js');
  say(w.local ? 'Starting the Python engine' : 'Downloading the Python engine (cached after the first time)', 10);
  py = await loadPyodide({ indexURL: w.base });
  say('Starting Python', 60);
  py.runPython(${JSON.stringify(PY_HARNESS)});
  say('Ready', 100); postMessage({ type: 'ready' });
}
const PIPS = [
  ['seaborn', /\\bseaborn\\b/, ['seaborn'], ['matplotlib', 'pandas'], ['seaborn']],
  ['fastapi', /\\b(fastapi|starlette)\\b/, ['fastapi==0.115.6', 'httpx'], ['pydantic', 'ssl'], ['fastapi', 'starlette', 'anyio', 'sniffio', 'idna', 'h11', 'httpx', 'httpcore', 'certifi', 'typing_inspection']],
  ['django', /\\bdjango\\b/, ['django'], ['sqlite3'], ['django', 'asgiref', 'sqlparse']],
];
const localWheels = names => (WHEELS || []).filter(u => names.some(n => u.split('/').pop().toLowerCase().startsWith(n + '-')));
const fsrc = m => Object.entries(m.files || {}).filter(([k]) => k.endsWith('.py')).map(([, v]) => v).join('\\n');
async function ensure(all) {
  if (/\\.(hist|plot|boxplot|bar|barh|pie|scatter|area)\\(|\\bplt\\b/.test(all) && !loaded.mpl) { say('Loading matplotlib', 72); await py.loadPackage('matplotlib'); loaded.mpl = true; }
  for (const [key, re, pips, pre, wnames] of PIPS) {
    if (re.test(all) && !loaded[key]) {
      say('Installing ' + key + (WHEELS ? '' : ' (first time only)'), 75);
      await py.loadPackage(['micropip'].concat(pre));
      const lw = localWheels(wnames);
      if (lw.length) await py.runPythonAsync('import micropip\\nawait micropip.install(' + JSON.stringify(lw) + ', deps=False)');
      else await py.runPythonAsync('import micropip\\nawait micropip.install(' + JSON.stringify(pips) + ')');
      loaded[key] = true;
    }
  }
}
onmessage = async e => {
  const m = e.data;
  if (m.type === 'init') { initP = init(m).catch(err => postMessage({ type: 'fatal', error: String(err) })); return; }
  await initP; if (!py) return;
  if (m.type === 'run') {
    const t0 = Date.now();
    try {
      const all = (m.prelude || '') + '\\n' + m.code + '\\n' + (m.tests || '');
      say('Loading libraries', 70);
      await py.loadPackagesFromImports(all + '\\n' + fsrc(m), { messageCallback: () => { }, errorCallback: () => { } });
      await ensure(all);
      py.globals.set('_payload', JSON.stringify({ code: m.code, tests: m.tests, files: m.files, prelude: m.prelude }));
      const out = py.runPython('_dsq_run(_payload)');
      const r = JSON.parse(out); r.ms = Date.now() - t0;
      postMessage({ type: 'result', id: m.id, result: r });
    } catch (err) {
      postMessage({ type: 'result', id: m.id, result: { stdout: '', error: { line: 0, type: 'EngineError', msg: String(err).slice(0, 400), src: '' }, figs: [], checks: [], ms: Date.now() - t0 } });
    }
  }
  if (m.type === 'trace') {
    try {
      await py.loadPackagesFromImports((m.prelude || '') + '\\n' + m.code + '\\n' + fsrc(m), { messageCallback: () => { }, errorCallback: () => { } });
      await ensure((m.prelude || '') + ' ' + m.code);
      py.globals.set('_payload', JSON.stringify({ code: m.code, files: m.files, prelude: m.prelude }));
      postMessage({ type: 'result', id: m.id, result: JSON.parse(py.runPython('_dsq_trace(_payload)')) });
    } catch (err) { postMessage({ type: 'result', id: m.id, result: { events: [], error: { line: 0, type: 'EngineError', msg: String(err).slice(0, 300), src: '' }, stdout: '' } }); }
  }
  if (m.type === 'cell') {
    const t0 = Date.now();
    try {
      await py.loadPackagesFromImports(m.code + '\\n' + fsrc(m), { messageCallback: () => { }, errorCallback: () => { } });
      await ensure(m.code);
      py.globals.set('_payload', JSON.stringify({ code: m.code, files: m.files }));
      const r = JSON.parse(py.runPython('_dsq_cell(_payload)')); r.ms = Date.now() - t0;
      postMessage({ type: 'result', id: m.id, result: r });
    } catch (err) { postMessage({ type: 'result', id: m.id, result: { stdout: '', error: { line: 0, type: 'EngineError', msg: String(err).slice(0, 400), src: '' }, figs: [], ms: Date.now() - t0 } }); }
  }
  if (m.type === 'kreset') { try { py.runPython('_dsq_kreset()'); } catch (e) { } postMessage({ type: 'result', id: m.id, result: { ok: true } }); }
  if (m.type === 'warm') { try { await py.loadPackage(m.pkgs); postMessage({ type: 'warmed' }); } catch (e) { } }
};`;

const Py = {
  state: 'idle', text: '', pct: 0, w: null, nextId: 1, pend: new Map(), subs: [], _ready: null, _res: null,
  on(fn) { this.subs.push(fn); fn(this); },
  _emit() { this.subs.forEach(f => f(this)); },
  start() {
    if (this.w) return; this.state = 'loading'; this.text = 'Waking the Python engine'; this.pct = 3;
    this._ready = new Promise(r => (this._res = r));
    const url = URL.createObjectURL(new Blob([PY_WORKER_SRC], { type: 'text/javascript' }));
    const w = this.w = new Worker(url);
    w.onmessage = e => {
      const m = e.data;
      if (m.type === 'status') { this.text = m.text; this.pct = m.pct; this._emit(); }
      else if (m.type === 'ready') { this.state = 'ready'; this.text = 'Python ready'; this.pct = 100; this._res(); this._emit(); }
      else if (m.type === 'fatal') { this.state = 'err'; this.text = 'Could not load Python: ' + m.error; this._emit(); this._res(); }
      else if (m.type === 'result') { const p = this.pend.get(m.id); if (p) { this.pend.delete(m.id); clearTimeout(p.timer); p.ok(m.result); } }
    };
    w.onerror = () => { this.state = 'err'; this.text = 'Python worker error'; this._emit(); this._res(); };
    PY_WHERE.then(wh => { this.where = wh; if (this.w === w) w.postMessage({ type: 'init', base: wh.base, wheels: wh.wheels, local: wh.local }); }); this._emit();
  },
  restart() {
    if (this.w) { this.w.terminate(); this.w = null; }
    this.pend.forEach(p => { clearTimeout(p.timer); }); this.pend.clear();
    this.state = 'idle'; this.start();
  },
  async run(o) {
    this.start(); await this._ready; DSQ.prime && await DSQ.prime();
    if (this.state === 'err') return { stdout: '', error: { line: 0, type: 'EngineError', msg: this.text, src: '' }, figs: [], checks: [], ms: 0 };
    const id = this.nextId++, timeout = o.timeout || 30000;
    return new Promise(ok => {
      const timer = setTimeout(() => {
        this.pend.delete(id); this.restart();
        ok({ stdout: '', error: { line: 0, type: 'Timeout', msg: 'This took longer than ' + Math.round(timeout / 1000) + ' seconds and was stopped. An infinite loop, maybe? Python was restarted.', src: '' }, figs: [], checks: [], ms: timeout });
      }, timeout);
      this.pend.set(id, { ok, timer });
      this.w.postMessage({ type: 'run', id, code: o.code, tests: o.tests || '', files: Object.assign({}, DSQ.extraFiles || {}, o.files || {}), prelude: o.prelude || '' });
    }).then(r => { DSQ.S && DSQ.S.st && !DSQ.S.st.badges['first-run'] && DSQ.S.badge('first-run'); return r; });
  },
  async trace(o) {
    this.start(); await this._ready; DSQ.prime && await DSQ.prime();
    const id = this.nextId++;
    return new Promise(ok => {
      const timer = setTimeout(() => { this.pend.delete(id); this.restart(); ok({ events: [], error: { line: 0, type: 'Timeout', msg: 'Tracing took too long.', src: '' }, stdout: '' }); }, 30000);
      this.pend.set(id, { ok, timer });
      this.w.postMessage({ type: 'trace', id, code: o.code, files: Object.assign({}, DSQ.extraFiles || {}, o.files || {}), prelude: o.prelude || '' });
    });
  },
  async cell(code, timeout, files) {
    this.start(); await this._ready; DSQ.prime && await DSQ.prime();
    if (this.state === 'err') return { stdout: '', error: { line: 0, type: 'EngineError', msg: this.text, src: '' }, figs: [], value: null, ms: 0 };
    const id = this.nextId++; timeout = timeout || 60000;
    return new Promise(ok => {
      const timer = setTimeout(() => { this.pend.delete(id); this.restart(); ok({ stdout: '', error: { line: 0, type: 'Timeout', msg: 'This cell ran longer than ' + Math.round(timeout / 1000) + ' seconds and was stopped. The notebook memory was reset - run the cells again from the top.', src: '' }, figs: [], value: null, ms: timeout, reset: true }); }, timeout);
      this.pend.set(id, { ok, timer });
      this.w.postMessage({ type: 'cell', id, code, files: Object.assign({}, DSQ.extraFiles || {}, files || {}) });
    });
  },
  async kreset() {
    this.start(); await this._ready; const id = this.nextId++;
    return new Promise(ok => { this.pend.set(id, { ok, timer: setTimeout(() => ok({}), 5000) }); this.w.postMessage({ type: 'kreset', id }); });
  },
  warm(pkgs) { this.start(); this._ready.then(() => this.w && this.w.postMessage({ type: 'warm', pkgs })); },
};
DSQ.Py = Py;
