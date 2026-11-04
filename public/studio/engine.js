'use strict';
/* =====================================================================
   Studio engine. One page template for every module: the look of the Matplotlib reference page, driven by data.
   A module is an object  { id, icon, title, subtitle, sections:[ { id, icon, title, sub, objectives, simple, blocks, quiz } ], cheat, glossary, exam }.
   Everything that prints or draws runs in the REAL Python engine of Dhruv Patel Academy (Pyodide, kept offline), so the numbers and pictures are not painted by hand.
   Blocks (b.t): h2 p simple teach tip warn cards table code compare stepper lab widget explorer tabs pipeline activity
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/* tiny markup for authors: `code` and **bold**; everything else is escaped */
const md = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
function h(tag, a, ...kids) {
  const e = document.createElement(tag);
  for (const k in (a || {})) { const v = a[k]; if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v); else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800); }
const P = (() => { try { return parent !== window && parent.DSQ && parent.DSQ.pyRun ? parent : null; } catch (e) { return null; } })();

/* ---------- Python syntax colours (same as the reference page) ---------- */
const PY_KW = new Set('import from as def return for in if else elif with True False None lambda and or not class while try except is pass break continue yield global'.split(' '));
function hl(code) {
  const re = /(#[^\n]*)|([rfb]?"""[\s\S]*?"""|[rfb]?'''[\s\S]*?'''|[rfb]?"(?:[^"\\\n]|\\.)*"|[rfb]?'(?:[^'\\\n]|\\.)*')|(\b\d+\.?\d*(?:e-?\d+)?\b)|(\b[A-Za-z_]\w*\b)(\s*\()?|(%\w+)/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index)); last = re.lastIndex;
    if (m[1]) out += `<span class="tk-c">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="tk-s">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="tk-n">${m[3]}</span>`;
    else if (m[4]) {
      if (PY_KW.has(m[4])) out += `<span class="tk-k">${m[4]}</span>` + (m[5] || '');
      else if (m[5]) out += `<span class="tk-f">${m[4]}</span>${m[5]}`;
      else if (/^(plt|sns|np|pd|fig|ax|axes|df|g|sk|torch)$/.test(m[4])) out += `<span class="tk-b">${m[4]}</span>`;
      else out += m[4];
    } else if (m[6]) out += `<span class="tk-k">${m[6]}</span>`;
  }
  return out + esc(code.slice(last));
}
function setCode(codeEl, src) {
  const prev = codeEl._src ? codeEl._src.split('\n') : null; codeEl._src = src;
  const raw = src.split('\n'), lines = hl(src).split('\n');
  codeEl.innerHTML = lines.map((l, i) => (prev && prev[i] !== raw[i]) ? `<span class="line-flash">${l || ' '}</span>` : l).join('\n');
}
function codeBox(src, title) {
  const pre = h('pre', {}, h('code', {})); setCode(pre.firstChild, src);
  const wrap = h('div', { class: 'code-wrap' }, h('button', { class: 'copy', onclick: e => copyText(src, e.target) }, 'Copy'), pre);
  return title ? h('div', {}, h('div', { class: 'code-title' }, title), wrap) : wrap;
}
function copyText(t, btn) { const done = () => { if (btn) { const o = btn.textContent; btn.textContent = '✓ Copied'; setTimeout(() => btn.textContent = o, 1400); } toast('Code copied'); }; try { navigator.clipboard.writeText(t).then(done, () => { }); } catch (e) { } }

/* ---------- the real Python engine ---------- */
const DUMP = '\x01DUMP';
const PRE = `
import json as _json, math as _math
def _dsq_clean(x):
    if isinstance(x, bool) or x is None or isinstance(x, (int, str)): return x
    if isinstance(x, float):
        if _math.isnan(x): return '__nan__'
        if _math.isinf(x): return '__inf__' if x > 0 else '__-inf__'
        return round(x, 6)
    if isinstance(x, complex): return str(x)
    if isinstance(x, (list, tuple)): return [_dsq_clean(i) for i in x]
    if isinstance(x, dict): return {str(k): _dsq_clean(v) for k, v in x.items()}
    return repr(x)[:300]
def _dsq_val(v):
    try:
        import numpy as _np
    except Exception:
        _np = None
    try:
        import pandas as _pd
    except Exception:
        _pd = None
    if _np is not None and isinstance(v, _np.generic): v = v.item() if v.ndim == 0 else v
    if _np is not None and isinstance(v, _np.ndarray):
        a = v
        if a.ndim == 0: return {'k': 'sc', 'v': _dsq_clean(a.item()), 't': str(a.dtype)}
        if a.ndim > 3: return {'k': 'txt', 'v': repr(a)[:400], 'shape': list(a.shape), 'dtype': str(a.dtype)}
        cut = a[:24] if a.ndim == 1 else a[:10, :12] if a.ndim == 2 else a[:3, :6, :8]
        return {'k': 'nd', 'shape': list(a.shape), 'dtype': str(a.dtype), 'v': _dsq_clean(cut.tolist()), 'cut': list(cut.shape)}
    if _pd is not None and isinstance(v, _pd.DataFrame):
        d = v.iloc[:10, :8]
        return {'k': 'df', 'shape': list(v.shape), 'cols': [str(c) for c in d.columns], 'idx': [str(i) for i in d.index], 'v': _dsq_clean(d.values.tolist()), 'dt': [str(t) for t in d.dtypes]}
    if _pd is not None and isinstance(v, _pd.Series):
        d = v.iloc[:12]
        return {'k': 'sr', 'shape': [len(v)], 'name': str(v.name), 'idx': [str(i) for i in d.index], 'v': _dsq_clean(d.tolist()), 'dtype': str(v.dtype)}
    if isinstance(v, (list, tuple, dict, str, int, float, bool, complex)) or v is None: return {'k': 'sc', 'v': _dsq_clean(v), 't': type(v).__name__}
    return {'k': 'txt', 'v': repr(v)[:400], 't': type(v).__name__}
import ast as _ast
def _dsq_echo_run(src):
    tree = _ast.parse(src, '<your code>', 'exec'); g = globals()
    if tree.body and isinstance(tree.body[-1], _ast.Expr):
        last = tree.body.pop(); exec(compile(tree, '<your code>', 'exec'), g)
        v = eval(compile(_ast.Expression(last.value), '<your code>', 'eval'), g)
        if v is not None: print(repr(v))
    else: exec(compile(tree, '<your code>', 'exec'), g)
import sys as _sys, types as _types
_K = _sys.modules.get('_dsq_k')
if _K is None:
    _K = _types.ModuleType('_dsq_k'); _K.d = {}; _sys.modules['_dsq_k'] = _K
def _dsq_kstep(key, src, reset):
    if reset or key not in _K.d:
        _K.d[key] = {k: v for k, v in globals().items() if k != '__builtins__'}
        _K.d[key]['__name__'] = '__main__'
    g = _K.d[key]; tree = _ast.parse(src, '<your code>', 'exec')
    if tree.body and isinstance(tree.body[-1], _ast.Expr):
        last = tree.body.pop(); exec(compile(tree, '<your code>', 'exec'), g)
        v = eval(compile(_ast.Expression(last.value), '<your code>', 'eval'), g)
        if v is not None: print(repr(v))
    else: exec(compile(tree, '<your code>', 'exec'), g)
import os as _os, shutil as _shutil
if not hasattr(_K, 'base'): _K.base = set(_os.listdir('.'))
def _dsq_fs_clean(keep):
    for n in set(_os.listdir('.')) - _K.base - set(keep):
        try:
            if _os.path.isdir(n) and not _os.path.islink(n): _shutil.rmtree(n)
            else: _os.remove(n)
        except Exception: pass
def _dsq_sql(db, sql):
    for stmt in [x.strip() for x in sql.split(';') if x.strip()]:
        cur = db.execute(stmt)
        for row in cur.fetchall(): print(' | '.join(str(v) for v in row))
def _dsq_dump(names, g=None):
    out = {}
    if g is None: g = globals()
    for n in names:
        try: out[n] = _dsq_val(g[n])
        except KeyError: out[n] = {'k': 'txt', 'v': '(not defined yet)'}
        except Exception as e: out[n] = {'k': 'txt', 'v': type(e).__name__ + ': ' + str(e)[:200]}
    print('\\x01DUMP' + _json.dumps(out))
`;
let chain = Promise.resolve();
/* runs one piece of code; runs are queued one after the other (one Python engine) */
function runPy(code, show, starter, timeout, opt) {
  if (opt && opt.shim && SHIMS[opt.shim]) starter = SHIMS[opt.shim] + '\n' + (starter || '');
  const job = chain.then(async () => {
    if (!P) return { stdout: '', error: { type: 'NoEngine', msg: 'The Python engine is only available when this page is opened inside Dhruv Patel Academy.' }, figs: [], vars: {}, ms: 0 };
    const kern = opt && opt.kernel, body = kern ? '_dsq_kstep(' + JSON.stringify(kern.key) + ',' + JSON.stringify(code) + ',' + (kern.reset ? 'True' : 'False') + ')' : opt && opt.echo ? '_dsq_echo_run(' + JSON.stringify(code) + ')' : code;
    const full = body + (show && show.length ? '\n_dsq_dump(' + JSON.stringify(show) + (kern ? ', _K.d[' + JSON.stringify(kern.key) + ']' : '') + ')\n' : '');
    const t0 = performance.now(); let r;
    const keep = (() => { try { return [...new Set(Object.keys(parent.DSQ.extraFiles || {}).map(k => k.split('/')[0]))]; } catch (e) { return []; } })(), noclean = !!(kern && !kern.reset);
    try { r = await P.DSQ.pyRun({ code: full, prelude: PRE + '\n_DSQ_KEEP = ' + JSON.stringify(keep) + '\nif not ' + (noclean ? 'True' : 'False') + ': _dsq_fs_clean(_DSQ_KEEP)\n' + (starter || ''), timeout: timeout || (opt && opt.shim ? 120000 : 60000) }); } catch (e) { return { stdout: '', error: { type: 'EngineError', msg: String(e.message || e) }, figs: [], vars: {}, ms: 0 }; }
    let out = r.stdout || '', vars = {}; const i = out.lastIndexOf(DUMP);
    if (i >= 0) { try { vars = JSON.parse(out.slice(i + DUMP.length).split('\n')[0]); } catch (e) { } out = out.slice(0, i); }
    return { stdout: out, error: r.error || null, figs: r.figs || [], vars, ms: Math.round(performance.now() - t0) };
  });
  chain = job.catch(() => { });
  return job;
}

/* ---------- show real values as animated grids, tables and chips ---------- */
const NANT = '__nan__';
const isNum = v => typeof v === 'number';
function cellColor(v, lo, hi) {
  if (v === true) return null; if (!isNum(v)) return null;
  const t = hi === lo ? .35 : (v - lo) / (hi - lo); return `rgba(42,120,214,${(0.1 + t * 0.5).toFixed(2)})`;
}
const fmtV = v => v === NANT ? 'nan' : v === '__inf__' ? 'inf' : v === '__-inf__' ? '-inf' : v === null ? 'None' : v === true ? 'True' : v === false ? 'False' : isNum(v) ? (Number.isInteger(v) ? String(v) : String(+v.toFixed(4))) : String(v);
function gridOf(rows, o) {
  o = o || {}; const nr = rows.length, nc = rows[0] ? rows[0].length : 0;
  const nums = rows.flat().filter(isNum), lo = Math.min(...nums), hi = Math.max(...nums);
  const g = h('div', { class: 'grid-nd', style: { gridTemplateColumns: `${o.rowHdr ? 'auto ' : ''}repeat(${nc},auto)` } });
  let i = 0;
  if (o.colHdr) { if (o.rowHdr) g.append(h('div', { class: 'cell hdr' })); for (let c = 0; c < nc; c++) g.append(h('div', { class: 'cell hdr' }, String(c))); }
  rows.forEach((row, r) => {
    if (o.rowHdr) g.append(h('div', { class: 'cell hdr' }, String(r)));
    row.forEach((v, c) => {
      const cls = ['cell']; if (v === NANT) cls.push('nan'); if (v === true) cls.push('t'); if (v === false) cls.push('f'); if (typeof v === 'string' && v !== NANT && !v.startsWith('__')) cls.push('txt');
      const col = cellColor(v, lo, hi), d = h('div', { class: cls.join(' '), style: { '--i': Math.min(i++, 60), '--c': col || '' } }, fmtV(v)); d.dataset.r = r; d.dataset.c = c; g.append(d);
    });
  });
  return g;
}
/* v is what _dsq_val returned */
function renderVal(name, v) {
  const cap = (extra) => h('div', { class: 'val-cap' }, h('b', {}, name), extra ? h('span', { class: 'meta' }, extra) : null);
  if (v.k === 'nd') {
    const meta = `shape (${v.shape.join(', ')}${v.shape.length === 1 ? ',' : ''}) · ${v.dtype}` + (v.cut && JSON.stringify(v.cut) !== JSON.stringify(v.shape) ? ' · first part shown' : '');
    let body;
    if (v.shape.length === 1) body = gridOf([v.v], { colHdr: true });
    else if (v.shape.length === 2) body = gridOf(v.v, { rowHdr: true, colHdr: true });
    else body = h('div', { class: 'stack3' }, v.v.map((m, k) => h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('span', { class: 'meta' }, `[${k}]`)), gridOf(m, { rowHdr: true, colHdr: true }))));
    return h('div', { class: 'val' }, cap(meta), body);
  }
  if (v.k === 'df') {
    const t = h('table', { class: 'df' }, h('thead', {}, h('tr', {}, h('th', {}, ''), v.cols.map(c => h('th', {}, c)))), h('tbody', {}, v.v.map((row, r) => h('tr', {}, h('td', { class: 'idx' }, v.idx[r]), row.map(x => h('td', {}, fmtV(x)))))));
    return h('div', { class: 'val' }, cap(`DataFrame ${v.shape[0]} rows × ${v.shape[1]} columns` + (v.shape[0] > 10 || v.shape[1] > 8 ? ' · first part shown' : '')), t);
  }
  if (v.k === 'sr') {
    const t = h('table', { class: 'df' }, h('tbody', {}, v.v.map((x, r) => h('tr', {}, h('td', { class: 'idx' }, v.idx[r]), h('td', {}, fmtV(x))))));
    return h('div', { class: 'val' }, cap(`Series · ${v.dtype} · length ${v.shape[0]}`), t);
  }
  const txt = v.k === 'sc' ? (typeof v.v === 'object' && v.v !== null ? JSON.stringify(v.v, (k, x) => (x === NANT ? 'nan' : x)).replace(/"/g, "'") : fmtV(v.v)) : v.v;
  return h('div', { class: 'val' }, cap(v.t || (v.dtype ? v.dtype : '')), h('div', { class: 'chipv' }, String(txt)));
}
function renderOut(host, res, o) {
  o = o || {}; host.innerHTML = '';
  const body = h('div', { class: 'out-b' });
  if (res.error) {
    const e = res.error; body.append(h('div', { class: 'err' }, h('b', {}, (e.type || 'Error') + ': '), h('code', {}, e.msg || ''), e.line ? h('div', { class: 'meta' }, 'line ' + e.line) : null));
  }
  const names = Object.keys(res.vars || {}).filter(n => !o.tables || ['nd', 'df', 'sr'].includes(res.vars[n].k)); if (names.length) body.append(h('div', { class: 'vals' }, names.map(n => renderVal(n, res.vars[n]))));
  if (res.stdout && res.stdout.trim()) body.append(h('pre', { class: 'stdout' }, res.stdout.replace(/\n$/, '')));
  (res.figs || []).forEach((b, i) => {
    const src = 'data:image/png;base64,' + b, img = h('img', { src, alt: 'figure ' + (i + 1) });
    const fb = h('div', { class: 'figbox' }, img);
    try { if (parent.DSQ && parent.DSQ.projectFigure) fb.append(h('button', { class: 'holo', type: 'button', title: 'Float this chart in 3D', onclick: () => parent.DSQ.projectFigure(src, o.title || 'Chart') }, '🔮 Project 3D')); } catch (e) { }
    body.append(fb);
  });
  if (!body.childNodes.length) body.append(h('div', { class: 'wait' }, '(ran with no output)'));
  host.append(h('div', { class: 'out-h' }, 'Output ', h('span', { class: 'badge-real' }, res.recorded ? '● recorded from a real run' : '● real Python'), h('span', { class: 'ms' }, res.ms + ' ms')), body);
}
const waitOut = host => { host.innerHTML = ''; host.append(h('div', { class: 'out-h' }, 'Output'), h('div', { class: 'out-b' }, h('div', { class: 'wait' }, h('span', { class: 'spin' }), P ? 'Running in Python…' : 'Python is not available here'))); };

/* ---------- inputs shared by labs and widgets ---------- */
function control(c, onChange) {
  const d = h('div', { class: 'ctl' + (c.type === 'check' ? ' chk' : '') }); let get;
  const show = v => (c.fmt ? c.fmt(v) : v);
  if (c.type === 'range') {
    const v = h('span', { class: 'v' }, show(c.value)), inp = h('input', { type: 'range', min: c.min, max: c.max, step: c.step || 1, value: c.value });
    inp.oninput = () => { v.textContent = show(+inp.value); onChange(); }; d.append(h('label', {}, c.label, v), inp); get = () => +inp.value;
  } else if (c.type === 'select') {
    const s = h('select', {}, c.options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(v) === String(c.value) }, l); }));
    s.onchange = onChange; d.append(h('label', {}, c.label), s); get = () => s.value;
  } else if (c.type === 'check') {
    const k = h('input', { type: 'checkbox', checked: !!c.value }); k.onchange = onChange; d.append(k, h('label', {}, c.label)); get = () => k.checked;
  } else if (c.type === 'textarea') { const k = h('textarea', { class: 'search', rows: c.rows || 4, style: { maxWidth: 'none', resize: 'vertical' } }); k.value = c.value; k.oninput = onChange; d.append(h('label', {}, c.label), k); get = () => k.value;
  } else if (c.type === 'color') { const v = h('span', { class: 'v' }, c.value), k = h('input', { type: 'color', value: c.value }); k.oninput = () => { v.textContent = k.value; onChange(); }; d.append(h('label', {}, c.label, v), k); get = () => k.value;
  } else { const k = h('input', { type: 'text', value: c.value, class: 'search' }); k.oninput = onChange; d.append(h('label', {}, c.label), k); get = () => k.value; }
  d.get = get; return d;
}

/* ---------- blocks ---------- */
const BLK = {};
BLK.h2 = b => h('h2', { html: md(b.text) });
BLK.h3 = b => h('h3', { html: md(b.text) });
BLK.p = b => h('p', { html: md(b.text) });
BLK.simple = b => h('div', { class: 'callout tip' }, h('b', { class: 't' }, b.title || '💬 In simple words'), h('span', { html: md(b.text) }));
BLK.tip = b => h('div', { class: 'callout tip' }, h('b', { class: 't' }, b.title || '💡 Tip'), h('span', { html: md(b.text) }));
BLK.teach = b => h('div', { class: 'callout teach' }, h('b', { class: 't' }, b.title || '🧠 Think of it like this'), h('span', { html: md(b.text) }));
BLK.warn = b => h('div', { class: 'callout warn' }, h('b', { class: 't' }, b.title || '⚠️ Common beginner mistakes'), b.items ? h('ul', { style: { margin: 0 } }, b.items.map(i => h('li', { html: md(i) }))) : h('span', { html: md(b.text) }));
BLK.real = b => h('div', { class: 'callout teach' }, h('b', { class: 't' }, b.title || '🌍 In the real world'), h('span', { html: md(b.text) }));
BLK.cards = b => h('div', { class: 'grid ' + (b.cols || 'g3') }, b.items.map(([ic, t, d], i) => h('div', { class: 'mini', style: { animation: `pop .5s ${i * .06}s both` } }, h('div', { class: 'ic' }, ic), h('h4', {}, t), h('p', { html: md(d) }))));
BLK.table = b => h('div', { class: 'tbl-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, b.head.map(x => h('th', {}, x)))), h('tbody', {}, b.rows.map(r => h('tr', {}, r.map(x => h('td', { html: md(x) })))))));
BLK.pipeline = b => h('div', { class: 'card' }, h('div', { class: 'pipe' }, b.nodes.flatMap(([t, s], i) => [h('div', { class: 'node', style: { animationDelay: i * .12 + 's' } }, t, s ? h('small', {}, s) : null), i < b.nodes.length - 1 ? h('div', { class: 'arrow' }) : null])));
BLK.activity = b => h('div', { class: 'callout teach' }, h('b', { class: 't' }, b.title || '🧑‍🏫 Try it yourself'), h('span', { html: md(b.text) }));
BLK.code = b => {
  const root = h('div', { class: 'cell-run' }); let src = b.code;
  const show = h('div', {}), out = h('div', { class: 'out', hidden: true });
  const paint = () => { show.innerHTML = ''; show.append(codeBox(src, b.title)); };
  const ta = h('textarea', { spellcheck: 'false', hidden: true }), edit = h('button', { class: 'btn ghost', type: 'button' }, '✏️ Edit');
  const run = h('button', { class: 'btn', type: 'button' }, '▶ Run in real Python');
  edit.onclick = () => { if (ta.hidden) { ta.value = src; ta.hidden = false; show.hidden = true; edit.textContent = '✓ Done editing'; ta.focus(); } else { src = ta.value; ta.hidden = true; show.hidden = false; edit.textContent = '✏️ Edit'; paint(); } };
  const go = async () => { if (!ta.hidden) { src = ta.value; } out.hidden = false; waitOut(out); renderOut(out, await runPy(src, b.show, b.starter || root._starter, undefined, { echo: b.echo, shim: b.shim }), { title: b.title, tables: b.tables }); };
  run.onclick = go; ta.style.height = Math.max(90, 22 * src.split('\n').length + 30) + 'px';
  paint(); root.append(show, ta, h('div', { class: 'cell-bar' }, run, edit, b.note ? h('span', { class: 'hint', html: md(b.note) }) : h('span', { class: 'hint' }, 'Change the code and run it again: it is yours to break.')), out);
  if (b.auto) setTimeout(go, 50);
  return root;
};
BLK.compare = b => h('div', { class: 'grid g2' }, b.items.map(it => BLK.code(Object.assign({}, it, { starter: b.starter }))));
BLK.tabs = b => {
  const tabs = h('div', { class: 'tabs' }), panels = b.tabs.map(() => h('div', { class: 'tab-panel' })), wrap = h('div', {});
  b.tabs.forEach((t, i) => { const bt = h('button', { class: 'tab' + (i ? '' : ' on'), type: 'button' }, t.title); bt.onclick = () => { $$('.tab', tabs).forEach(x => x.classList.remove('on')); bt.classList.add('on'); panels.forEach((p, j) => { p.classList.toggle('on', i === j); if (i === j && !p._built) { p._built = 1; (t.blocks || []).forEach(x => p.append(build(x))); } }); }; tabs.append(bt); });
  wrap.append(tabs, ...panels); (b.tabs[0].blocks || []).forEach(x => panels[0].append(build(x))); panels[0].classList.add('on'); panels[0]._built = 1; return wrap;
};
/* a stepper: each step ADDS lines; the page runs the code so far in real Python and shows what it made */
BLK.stepper = b => {
  const root = h('div', { class: 'stepper studio-st' }), N = b.steps.length; let k = 0, timer = null, seq = 0, lastK = -1;
  const dots = h('div', { class: 'dots' }, b.steps.map((_, i) => h('span', { onclick: () => { k = i; draw(); } })));
  const codeEl = h('code', { class: 'step-code' }), ex = h('div', { class: 'step-explain' }), outEl = h('div', { class: 'out' }), view = h('div', { class: 'st-view' }, outEl);
  const stop = () => { clearInterval(timer); timer = null; play.textContent = '⏯ Auto-play'; };
  const btn = (t, f, cls) => h('button', { class: 'btn ' + (cls || 'ghost'), type: 'button', onclick: f }, t), play = btn('⏯ Auto-play', () => { if (timer) return stop(); if (k >= N - 1) k = -1; timer = setInterval(() => { if (k < N - 1) { k++; draw(); } else stop(); }, 3600); play.textContent = '⏸ Pause'; if (k < N - 1) { k++; draw(); } });
  const codeSoFar = i => b.steps.slice(0, i + 1).map(s => s.code).join('\n'), runSoFar = i => b.steps.slice(0, i + 1).map(s => (s.run !== undefined ? s.run : s.code)).join('\n');
  async function draw() {
    const my = ++seq, src = codeSoFar(k), st = b.steps[k]; setCode(codeEl, src); ex.innerHTML = `<b>Step ${k + 1} of ${N}.</b> ` + md(st.say);
    $$('span', dots).forEach((d, i) => d.classList.toggle('on', i === k));
    if (b.static) { renderOut(outEl, { stdout: st.out || '', vars: {}, figs: [], ms: 0, recorded: true }); return; }
    const show = st.show || b.show || []; waitOut(outEl);
    /* kernel mode (slow lessons): going forward one step runs only the new code, in a namespace that is kept; any other move starts again and replays */
    const kopt = b.kernel ? (k === lastK + 1 ? { key: b.key || b.title, reset: false, code: st.run !== undefined ? st.run : st.code } : { key: b.key || b.title, reset: true, code: runSoFar(k) }) : null;
    const res = await runPy(kopt ? kopt.code : runSoFar(k), show, b.starter, undefined, kopt ? { kernel: kopt, shim: b.shim } : { echo: b.echo, shim: b.shim }); if (my !== seq) return; lastK = res.error ? -1 : k; renderOut(outEl, res, { title: b.title, tables: b.tables });
    $$('.cell', outEl).forEach(c => { c.classList.remove('hi'); });
  }
  root.append(h('div', { class: 'step-ctrl' }, btn('◀ Back', () => { stop(); if (k > 0) { k--; draw(); } }), btn('Next ▶', () => { stop(); if (k < N - 1) { k++; draw(); } }, ''), play, btn('↺ Reset', () => { stop(); k = 0; codeEl._src = ''; draw(); }), dots),
    h('div', { class: 'st-code' }, h('div', { class: 'code-wrap' }, h('button', { class: 'copy', onclick: e => copyText(codeEl._src, e.target) }, 'Copy'), h('pre', {}, codeEl))), view, ex);
  root._start = draw; setTimeout(draw, 30); return root;
};
/* a lab: move a control, the code is rewritten and run again in real Python */
BLK.lab = b => {
  const root = h('div', { class: 'lab' }); let seq = 0, timer = 0;
  const ctl = h('div', { class: 'lab-controls' }), outEl = h('div', { class: 'out' }), codeEl = h('code', {}), note = b.note ? h('div', { class: 'lab-note' }) : null;
  const ctls = b.controls.map(c => { const d = control(c, () => { clearTimeout(timer); timer = setTimeout(go, 200); }); d.id = c.id; ctl.append(d); return d; });
  const vals = () => Object.fromEntries(ctls.map(d => [d.id, d.get()]));
  /* {{name}} puts the value in; {{name|py}} puts it in as a safe Python string (for text a learner typed) */
  const fill = (tpl, v) => tpl.replace(/\{\{(\w+)(\|py)?\}\}/g, (_, k, py) => (py ? JSON.stringify(String(v[k])) : typeof v[k] === 'boolean' ? (v[k] ? 'True' : 'False') : v[k]));
  async function go() {
    const my = ++seq, v = vals(), src = fill(b.code, v); setCode(codeEl, src); if (note) note.innerHTML = b.note.replace(/\{\{(\w+)\}\}/g, (_, k) => esc(v[k]));
    waitOut(outEl); const res = await runPy(src, b.show, b.starter, undefined, { echo: b.echo, shim: b.shim }); if (my !== seq) return; renderOut(outEl, res, { title: b.title, tables: b.tables });
  }
  ctl.append(h('button', { class: 'btn ghost', type: 'button', onclick: go }, '▶ Run again'));
  root.append(h('div', { class: 'lab-head' }, '🧪 ' + b.title, ' ', h('span', { class: 'pill' }, 'LIVE · real Python')), ctl,
    h('div', { class: 'lab-out' }, outEl, h('div', { class: 'code-wrap' }, h('button', { class: 'copy', onclick: e => copyText(codeEl._src, e.target) }, 'Copy'), h('pre', {}, codeEl)), note));
  root._start = go; setTimeout(go, 30); return root;
};
/* explorer: a list of things on the left, the code and its real result on the right */
BLK.explorer = b => {
  const list = h('div', { class: 'xp-list' }), main = h('div', { class: 'xp-main' }); const root = h('div', { class: 'xp' }, list, main); let seq = 0;
  const pick = async i => {
    const it = b.items[i]; $$('.gal-btn', list).forEach((x, j) => x.classList.toggle('on', j === i)); const my = ++seq;
    const src = b.cumulative ? b.items.slice(0, i + 1).map(x => x.code).join('\n') : it.code;
    const out = h('div', { class: 'out' }); main.innerHTML = ''; main.append(h('p', { class: 'gal-desc', html: md(it.say || '') }), codeBox(src), out); waitOut(out);
    const res = await runPy(src, it.show, it.starter || b.starter, undefined, { echo: b.echo, shim: b.shim }); if (my === seq) renderOut(out, res, { title: it.name, tables: b.tables });
  };
  b.items.forEach((it, i) => list.append(h('button', { class: 'gal-btn', type: 'button', onclick: () => pick(i) }, it.name)));
  root._start = () => pick(0); setTimeout(() => pick(0), 30); return root;
};
const dockOpen = id => { try { parent.DSQ.studioDock(id); } catch (e) { try { parent.location.hash = '#/picture/' + id; } catch (e2) { } } };
BLK.picturelink = b => h('div', { class: 'callout tip pic-link' }, h('b', { class: 't' }, '🎬 See it move: 2D, 3D, Project 3D'), h('span', {}, 'The same idea as an animated lesson. It opens beside this page, so you can keep your code in view. '), h('button', { class: 'btn', type: 'button', onclick: () => dockOpen(b.id) }, '▶ Watch it here'), ' ', h('a', { class: 'btn ghost', href: '#', onclick: e => { e.preventDefault(); try { parent.location.hash = '#/picture/' + b.id; } catch (e2) { } } }, 'Open full page'));
/* a row of animated lessons (the ids, or every lesson of the room's module) */
BLK.pictures = b => h('div', { class: 'pic-gal' }, (b.items || []).map((it, i) => h('button', { class: 'pic-card', type: 'button', style: { animation: `pop .5s ${i * .06}s both` }, onclick: () => dockOpen(it.id) }, h('span', { class: 'ic' }, it.icon || '🎬'), h('b', {}, it.title), h('small', {}, (it.steps ? it.steps + ' animated steps · ' : '') + '2D · 3D · Project 3D'))));
BLK.links = b => h('div', { class: 'chip-row' }, b.items.map(([t, hash]) => h('button', { class: 'btn ghost', type: 'button', onclick: () => { try { parent.location.hash = hash; } catch (e) { } } }, t)));

/* a graded exercise: write code, press Check, real Python runs it and your checks. Solutions are tested by tools/verify_studio.js. */
BLK.exercise = b => {
  const room = window.__roomId || '', solvedBefore = (() => { try { return !!((parent.DSQ.studioState(room).ex || {})[b.id]); } catch (e) { return false; } })();
  const root = h('div', { class: 'widget exercise' + (solvedBefore ? ' solved' : '') }), ta = h('textarea', { class: 'wp-ta', spellcheck: 'false', 'aria-label': 'your code' }), out = h('div', { class: 'out', hidden: true }), hintBox = h('div', { class: 'w-note', hidden: true });
  ta.value = b.starter || ''; ta.style.height = Math.max(120, 22 * (ta.value.split('\n').length + 2)) + 'px';
  ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('    ', ta.selectionStart, ta.selectionEnd, 'end'); } });
  const show = async (withTests) => {
    out.hidden = false; waitOut(out);
    if (!P) { out.innerHTML = ''; out.append(h('div', { class: 'no-py' }, 'The Python engine is only available inside Dhruv Patel Academy.')); return; }
    const t0 = performance.now(); let r; try { r = await P.DSQ.pyRun({ code: ta.value, tests: withTests ? b.tests : '', prelude: PRE + '\n' + (b.shim && SHIMS[b.shim] ? SHIMS[b.shim] + '\n' : '') + (b.roomStarter || '') + '\n' + (b.setup || ''), timeout: b.shim ? 120000 : 60000 }); } catch (e) { r = { error: { type: 'EngineError', msg: String(e.message || e) }, stdout: '', figs: [], checks: [] }; }
    out.innerHTML = ''; const body = h('div', { class: 'out-b' });
    if (r.error) body.append(h('div', { class: 'err' }, h('b', {}, (r.error.type || 'Error') + ': '), h('code', {}, r.error.msg || ''), r.error.line ? h('div', { class: 'meta' }, 'line ' + r.error.line) : null));
    if (r.stdout && r.stdout.trim()) body.append(h('pre', { class: 'stdout' }, r.stdout.replace(/\n$/, '')));
    (r.figs || []).forEach(g => body.append(h('div', { class: 'figbox' }, h('img', { src: 'data:image/png;base64,' + g, alt: 'figure' }))));
    if (withTests && !r.error) {
      const cs = r.checks || [], all = cs.length > 0 && cs.every(c => c.ok);
      body.append(h('div', { class: 'wp-tests' }, cs.map(c => h('div', { class: 'wp-test ' + (c.ok ? 'ok' : 'no') }, h('span', { class: 'tick' }, c.ok ? '✓' : '✗'), c.msg + (c.ok || !c.hint ? '' : '  (hint: ' + c.hint + ')')))));
      if (all) { root.classList.add('solved'); body.append(h('div', { class: 'w-note ok' }, '✓ All checks pass.')); let first = false; try { first = parent.DSQ.studioSolved(room, b.id); } catch (e) { } if (first) toast('✓ Exercise solved: +30 XP'); }
    } else if (withTests && r.error) body.append(h('div', { class: 'w-note' }, 'Fix the error first, then press Check again.'));
    out.append(h('div', { class: 'out-h' }, withTests ? 'Checks' : 'Output', h('span', { class: 'badge-real' }, '● real Python'), h('span', { class: 'ms' }, Math.round(performance.now() - t0) + ' ms')), body);
  };
  const hintBtn = b.hint ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { hintBox.hidden = !hintBox.hidden; hintBox.innerHTML = '<b>Hint:</b> ' + md(b.hint); } }, '💡 Hint') : null;
  const solBtn = b.solution ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { if (confirm('Show the solution? Try a little longer first.')) ta.value = b.solution; } }, 'Show solution') : null;
  root.append(h('div', { class: 'w-head' }, '✍️ ' + (b.title || 'Exercise'), h('span', { class: 'pill' }, 'GRADED'), solvedBefore ? h('span', { class: 'chip ok' }, 'solved') : null), h('div', { class: 'w-note', html: md(b.prompt) }), ta,
    h('div', { class: 'cell-bar' }, h('button', { class: 'btn', type: 'button', onclick: () => show(true) }, '✔ Check my code'), h('button', { class: 'btn ghost', type: 'button', onclick: () => show(false) }, '▶ Just run it'), hintBtn, solBtn, h('button', { class: 'btn ghost', type: 'button', onclick: () => { ta.value = b.starter || ''; } }, '↺ Reset')), hintBox, out);
  root._api = { set: v => { ta.value = v; }, check: () => show(true) };
  return root;
};
BLK.widget = b => { const f = WIDGETS[b.w]; if (!f) return h('div', { class: 'callout bad' }, 'Unknown widget: ' + b.w); return f(b); };
const WIDGETS = {};
function build(b) { const f = BLK[b.t]; return f ? f(b) : h('div', { class: 'callout bad' }, 'Unknown block: ' + b.t); }

/* ---------- quiz (random option order, explanation, score) ---------- */
function buildQuiz(qs, onAllRight) {
  const box = h('div', { class: 'quiz' }); let score = 0, answered = 0;
  const score_ = h('span', { class: 'score' }, `0 / ${qs.length}`); box.append(h('p', {}, 'Score: ', score_));
  qs.forEach((q, qi) => {
    const d = h('div', { class: 'q' }), order = q.o.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const why = h('div', { class: 'why', html: '💡 ' + md(q.w) }); d.append(h('div', { class: 'qt', html: `Q${qi + 1}. ` + md(q.q) }));
    order.forEach((oi, pos) => { const bt = h('button', { class: 'opt', type: 'button', html: `${String.fromCharCode(65 + pos)}. ` + md(q.o[oi]) });
      bt.onclick = () => { if (oi === q.a) { bt.classList.add('right'); $$('.opt', d).forEach(x => x.disabled = true); why.classList.add('show'); if (!d._wrong) score++; answered++; score_.textContent = `${score} / ${qs.length}`; if (answered === qs.length) { if (score === qs.length) onAllRight && onAllRight(); else toast(`Finished: ${score}/${qs.length}. Review and try again!`); } } else { bt.classList.add('wrong'); bt.disabled = true; d._wrong = true; } };
      d.append(bt); });
    d.append(why); box.append(d);
  });
  const again = h('button', { class: 'btn ghost', type: 'button', onclick: () => box.replaceWith(buildQuiz(qs, onAllRight)) }, '↺ Try the quiz again'); box.append(again); return box;
}
