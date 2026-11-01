'use strict';
/* =====================================================================
   Graph Studio: one place to look at data in many chart types, select any rows (from the table, by a rule, or in the chart),
   and move / add / delete / edit them. You always work on a COPY: the original data is kept and "Reset" brings it back.
   - 14 chart types (scatter, bubble, line, area, bar, histogram, box, density heat map, correlation matrix, pie, polar, radar, 3-D scatter, 3-D surface)
   - zoom with the wheel (about the cursor), pan, fit, centre on the selection
   - 3-D: pick the plane to move in (screen, x-y, x-z, y-z), Ctrl+drag to box-select, shift-click to add to the selection
   - function curves y=f(x) and z=f(x,y) with parameter sliders, lines, vectors (2-D and 3-D), Bezier curves, polygons, freehand sketches, all draggable
   - the Python code and live statistics rewrite themselves after every change; Run executes that code
   ===================================================================== */
const STU_COL = ['#2F6FE0', '#D2600F', '#1E8E5A', '#7A4FD0', '#0E8FA3', '#B8860B', '#C2418A', '#6B7280', '#9C3D2E', '#3A8F6F'];
const STU_MATH = 'sin|cos|tan|asin|acos|atan|exp|log|sqrt|abs|pow|min|max|floor|ceil|round|sign|PI|E';
const stuTicks = (lo, hi, n = 6) => { const span = hi - lo || 1, raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p, st = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, t = []; for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + st * 1e-6; v += st) t.push(+v.toFixed(10)); return t; };
const stuF = v => { const a = Math.abs(v); return a >= 1e5 || (a < 1e-3 && a) ? v.toExponential(1) : String(+v.toFixed(a >= 100 ? 0 : a >= 10 ? 1 : 2)); };
const stuN = v => +(+v).toFixed(4);

/* ---------------- data sets (complexity 1 = basic, 2 = medium, 3 = advanced) ---------------- */
const STU_SETS = {
  blobs: { name: 'Groups (blobs)', note: 'k groups hidden in 3-D; more groups and more overlap at higher complexity', gen(r, c) {
    const k = [2, 3, 5][c - 1], n = [60, 150, 400][c - 1], sd = [.5, .75, 1][c - 1], cen = Array.from({ length: k }, () => [r.norm(0, 2.4), r.norm(0, 2.4), r.norm(0, 2.4)]);
    return Array.from({ length: n }, (_, i) => { const g = i % k; return { x: cen[g][0] + r.norm(0, sd), y: cen[g][1] + r.norm(0, sd), z: cen[g][2] + r.norm(0, sd), g: 'ABCDE'[g] }; }); } },
  moons: { name: 'Two moons', note: 'two interleaved half circles: a straight line cannot separate them', gen(r, c) { const n = [80, 200, 500][c - 1], nz = [.08, .16, .28][c - 1];
    return Array.from({ length: n }, (_, i) => { const g = i % 2, t = r() * Math.PI; return { x: (g ? 1 - Math.cos(t) : Math.cos(t)) * 2 - 1 + r.norm(0, nz), y: (g ? .5 - Math.sin(t) : Math.sin(t)) * 2 + r.norm(0, nz), z: r.norm(0, nz) * 2, g: g ? 'B' : 'A' }; }); } },
  ring: { name: 'Ring and core', note: 'a dense core inside a ring: the 2-D view hides what the 3-D view shows', gen(r, c) { const n = [80, 220, 520][c - 1], nz = [.12, .25, .4][c - 1];
    return Array.from({ length: n }, (_, i) => { const g = i % 2, t = r() * 6.283, rad = g ? 3 : .8 * r(); return { x: Math.cos(t) * rad + r.norm(0, nz), y: Math.sin(t) * rad + r.norm(0, nz), z: (g ? 1.5 : -1.5) + r.norm(0, nz * 2), g: g ? 'ring' : 'core' }; }); } },
  spiral: { name: 'Spiral arms', note: 'arms that wind around the origin; z grows with the angle', gen(r, c) { const arms = [2, 3, 4][c - 1], n = [90, 240, 540][c - 1], nz = [.1, .2, .32][c - 1];
    return Array.from({ length: n }, (_, i) => { const a = i % arms, t = r() * 4 + .4; return { x: Math.cos(t + a * 6.283 / arms) * t * .8 + r.norm(0, nz), y: Math.sin(t + a * 6.283 / arms) * t * .8 + r.norm(0, nz), z: t - 2 + r.norm(0, nz), g: 'arm' + (a + 1) }; }); } },
  line: { name: 'Noisy line', note: 'y = a x + b plus noise: fit the line and drag a point to see the slope change', gen(r, c) { const n = [40, 120, 400][c - 1], nz = [.4, .8, 1.4][c - 1], a = +(r() * 1.6 + .4).toFixed(2), b = +(r.norm(0, 1)).toFixed(2);
    return Array.from({ length: n }, () => { const x = r() * 8 - 4; return { x, y: a * x + b + r.norm(0, nz), z: r.norm(0, .5), g: x > 0 ? 'right' : 'left' }; }); } },
  sine: { name: 'Sine wave', note: 'a wave with noise; at higher complexity a few outliers hide in it', gen(r, c) { const n = [60, 160, 420][c - 1], nz = [.15, .3, .5][c - 1], out = [0, 3, 12][c - 1];
    return Array.from({ length: n }, (_, i) => { const x = r() * 12 - 6, o = i < out; return { x, y: Math.sin(x) * 2 + r.norm(0, nz) + (o ? r.norm(0, 4) : 0), z: Math.cos(x) + r.norm(0, nz), g: o ? 'check' : 'normal' }; }); } },
  plane: { name: 'Tilted plane', note: 'z = a x + b y + c plus noise: a regression plane in 3-D', gen(r, c) { const n = [70, 180, 450][c - 1], nz = [.3, .7, 1.2][c - 1], a = +(r.norm(0, 1)).toFixed(2), b = +(r.norm(0, 1)).toFixed(2);
    return Array.from({ length: n }, () => { const x = r() * 8 - 4, y = r() * 8 - 4; return { x, y, z: a * x + b * y + 1 + r.norm(0, nz), g: x * y > 0 ? 'same' : 'opposite' }; }); } },
  outliers: { name: 'Cloud with outliers', note: 'one cloud and a few stray points: which ones would you remove?', gen(r, c) { const n = [60, 160, 420][c - 1], out = [3, 8, 25][c - 1];
    return Array.from({ length: n }, (_, i) => { const o = i < out, s = o ? 5 : 1; return { x: r.norm(0, s), y: r.norm(0, s), z: r.norm(0, o ? 4 : .8), g: 'point' }; }); } },
  species: { name: 'Four measurements, three species', note: 'four numeric columns and a species: for radar charts, correlations and grouping', gen(r, c) { const n = [60, 150, 360][c - 1], sd = [.35, .55, .8][c - 1], cen = [[5, 3.4, 1.5, .25], [6, 2.8, 4.3, 1.3], [6.6, 3, 5.6, 2.1]];
    return Array.from({ length: n }, (_, i) => { const g = i % 3, q = cen[g]; return { x: q[0] + r.norm(0, sd), y: q[1] + r.norm(0, sd * .7), z: q[2] + r.norm(0, sd), w: q[3] + r.norm(0, sd * .4), g: ['setosa', 'versicolor', 'virginica'][g] }; }); } },
};
const STU_COLS = { species: ['x', 'y', 'z', 'w'] };

const STU_TYPES = [['scatter', 'Scatter'], ['bubble', 'Bubble'], ['line', 'Line'], ['area', 'Area'], ['bar', 'Bar (mean by group)'], ['hist', 'Histogram'], ['box', 'Box plot'], ['heat', 'Density heat map'], ['corr', 'Correlation matrix'], ['pie', 'Pie / donut'], ['polar', 'Polar'], ['radar', 'Radar (group means)'], ['3d', '3-D scatter'], ['surface', '3-D surface (z = f(x, y))']];
const STU_PY = { sin: 'np.sin', cos: 'np.cos', tan: 'np.tan', asin: 'np.arcsin', acos: 'np.arccos', atan: 'np.arctan', exp: 'np.exp', log: 'np.log', sqrt: 'np.sqrt', abs: 'np.abs', pow: 'np.power', min: 'np.minimum', max: 'np.maximum', floor: 'np.floor', ceil: 'np.ceil', round: 'np.round', sign: 'np.sign', PI: 'np.pi', E: 'np.e' };

function stuCompile(expr, vars, strings) {
  const src = String(expr).replace(/\^/g, '**').replace(/\bpi\b/gi, 'PI');
  const bare = strings ? src.replace(/'[^']*'|"[^"]*"/g, '0') : src;
  if (!/^[\w\s+\-*\/().,%<>=!&|?:]*$/.test(bare)) throw new Error('Only numbers, column names, + - * / ** ( ) comparisons and functions like sin, cos, exp, sqrt are allowed.');
  const bad = (bare.match(/[A-Za-z_]\w*/g) || []).filter(w => !vars.includes(w) && !new RegExp('^(' + STU_MATH + ')$').test(w));
  if (bad.length) throw new Error('Unknown name: ' + bad[0] + '. Use ' + vars.join(', ') + ' and functions like sin, cos, exp, sqrt.');
  const fn = new Function(...vars, 'with (Math) { return (' + src + '); }');
  return (...a) => { const v = fn(...a); return typeof v === 'boolean' ? v : (typeof v === 'number' && isFinite(v) ? v : NaN); };
}
const stuPyExpr = e => String(e).replace(/\^/g, '**').replace(/\b(sin|cos|tan|asin|acos|atan|exp|log|sqrt|abs|pow|min|max|floor|ceil|round|sign)\b/g, m => STU_PY[m]).replace(/\bPI\b|\bpi\b/g, 'np.pi');
const stuParams = e => [...new Set((String(e).match(/\b[a-eA-E]\b/g) || []).filter(w => !new RegExp('^(' + STU_MATH + ')$').test(w)))];

function viewStudio() {
  const root = h('div', { class: 'stack studio' });
  const W = 760, H = 440, M = { l: 54, r: 18, t: 14, b: 40 }, PW = W - M.l - M.r, PH = H - M.t - M.b;
  const S = {
    set: 'blobs', level: 2, nonce: 0, source: { kind: 'syn' }, cols: ['x', 'y', 'z', 'g'], nums: ['x', 'y', 'z'], cat: 'g', rows: [], orig: [], origCsv: '', nextId: 1,
    sel: new Set(), hist: [], redo: [], type: 'scatter', cx: 'x', cy: 'y', cz: 'z', cc: 'g', cs: 'z', bins: 12, tool: 'select', plane: 'screen', V: null, manual: false, n3: null,
    funcs: [], objs: [], overlay: 'none', k: 3, page: 0, tab: 'table', seq: 0, busy: false, step: .1,
  };
  const q = x => JSON.stringify(x);
  const seed = () => BIG.hash('stu:' + (S.me ? S.me.username : (window.DSQ && DSQ.S && DSQ.S.me ? DSQ.S.me.username : 'guest')).toLowerCase() + ':' + S.set + ':' + S.level + ':' + S.nonce);
  const rowsOf = () => S.rows, byId = new Map();
  const reindex = () => { byId.clear(); S.rows.forEach(r => byId.set(r.id, r)); };
  const clone = rows => rows.map(r => Object.assign({}, r));

  /* ---------------- loading ---------------- */
  function useRows(rows, cols, nums, cat, source, csvNote) {
    S.cols = cols; S.nums = nums; S.cat = cat; S.source = source; S.rows = rows; S.orig = clone(rows); S.sel.clear(); S.hist = []; S.redo = []; S.V = null; S.manual = false; S.n3 = null; S.page = 0; S.nextId = 1;
    S.cx = nums[0]; S.cy = nums[1] || nums[0]; S.cz = nums[2] || nums[1] || nums[0]; S.cc = cat || ''; S.cs = nums[2] || nums[0];
    S.origCsv = ['id,' + cols.join(','), ...rows.map(r => r.id + ',' + cols.map(c => typeof r[c] === 'number' ? stuN(r[c]) : r[c]).join(','))].join('\n');
    reindex(); fillSelects(); render(); toast(csvNote || (rows.length + ' rows loaded. This is a working copy: Reset brings the original back.'));
  }
  function loadSyn() {
    const def = STU_SETS[S.set], r = RNG(seed());
    const data = def.gen(r, S.level).map((p, i) => Object.assign({ id: i }, p));
    const cols = (STU_COLS[S.set] || ['x', 'y', 'z']).concat(['g']);
    useRows(data, cols, cols.filter(c => c !== 'g'), 'g', { kind: 'syn', set: S.set, level: S.level, seed: seed() });
    S.cur = def.name;
  }
  async function loadBig(id) {
    const d = BIG.catalog.find(x => x.id === id); busy(true, 'Reading ' + d.title + ' ...');
    try {
      const n = [300, 800, 2000][S.level - 1], files = await BIG.files();
      const r = await Py.cell(`import json, dsq_pane\nprint(dsq_pane.table(${q(id)}, ${n}, ${S.nonce}))`, 180000, files);
      if (r.error) throw new Error(r.error.type + ': ' + r.error.msg);
      const t = JSON.parse((r.stdout || '').trim().split('\n').pop());
      useRows(t.rows.map(x => Object.assign({}, x)), t.cols, t.nums, t.cat, { kind: 'big', id, n, nonce: S.nonce, pycols: t.pycols }, n + ' rows sampled from the ' + d.title + ' table (your own copy, rebuilt from its seed).');
    } catch (e) { toast('Could not load that table: ' + e.message); }
    busy(false);
  }
  const busy = (on, msg) => { S.busy = on; status.textContent = on ? msg : ''; };

  /* ---------------- history ---------------- */
  const snap = () => ({ rows: JSON.stringify(S.rows), sel: [...S.sel], nextId: S.nextId });
  function push() { S.hist.push(snap()); if (S.hist.length > 60) S.hist.shift(); S.redo = []; }
  function restore(s) { S.rows = JSON.parse(s.rows); S.sel = new Set(s.sel.filter(id => S.rows.some(r => r.id === id))); S.nextId = s.nextId; reindex(); }
  const undo = () => { if (!S.hist.length) return; S.redo.push(snap()); restore(S.hist.pop()); render(); };
  const redo = () => { if (!S.redo.length) return; S.hist.push(snap()); restore(S.redo.pop()); render(); };
  function resetData() { if (!S.hist.length && S.rows.length === S.orig.length && !S.rows.some((r, i) => S.orig[i] && S.cols.some(c => r[c] !== S.orig[i][c]))) return; push(); S.rows = clone(S.orig); S.sel.clear(); reindex(); render(); toast('Back to the original data (your edits are still in Undo).'); }

  /* ---------------- selection and editing ---------------- */
  const sel = () => S.rows.filter(r => S.sel.has(r.id));
  function setSel(ids, add) { if (!add) S.sel.clear(); ids.forEach(i => S.sel.add(i)); render(); }
  function toggle(id, add) { if (add) { S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); } else { S.sel = new Set([id]); } }
  function del() { if (!S.sel.size) return toast('Select some rows first (click a point or a table row).'); push(); S.rows = S.rows.filter(r => !S.sel.has(r.id)); S.sel.clear(); reindex(); render(); }
  function dup() { if (!S.sel.size) return; push(); const out = []; S.sel.forEach(id => { const r = byId.get(id); if (r) { const c = Object.assign({}, r, { id: 'n' + S.nextId++ }); S.nums.forEach(k => { c[k] = stuN(c[k] + (S.rows.length ? .05 : 0)); }); out.push(c); } }); S.rows.push(...out); reindex(); S.sel = new Set(out.map(r => r.id)); render(); }
  function addAt(vals) { push(); const base = {}; S.cols.forEach(c => { base[c] = S.nums.includes(c) ? 0 : (S.rows[0] ? S.rows[0][c] : ''); }); const r = Object.assign(base, vals, { id: 'n' + S.nextId++ }); if (S.cat && !vals[S.cat]) r[S.cat] = (sel()[0] || S.rows[0] || {})[S.cat] || ''; S.rows.push(r); reindex(); S.sel = new Set([r.id]); render(); }
  function rule(text) {
    try { const js = String(text).replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\b/g, '!').replace(/(\w+)\s*==\s*'?"?([A-Za-z]\w*)"?'?/g, (m, a, b) => S.cols.includes(a) && !S.nums.includes(a) ? a + "=='" + b + "'" : m); const f = stuCompile(js, S.cols, true);
      return S.rows.filter(r => f(...S.cols.map(c => r[c]))).map(r => r.id); } catch (e) { toast(e.message); return null; }
  }
  function setCol(col, expr) {
    if (!S.sel.size) return toast('Select some rows first.');
    try { const f = stuCompile(expr, S.cols); push(); sel().forEach(r => { const v = f(...S.cols.map(c => r[c])); if (!isNaN(v)) r[col] = stuN(v); }); render(); } catch (e) { toast(e.message); }
  }
  function nudge(dx, dy, dz) { if (!S.sel.size) return; push(); const st = S.step; sel().forEach(r => { r[S.cx] = stuN(r[S.cx] + dx * st); r[S.cy] = stuN(r[S.cy] + dy * st); if (dz) r[S.cz] = stuN(r[S.cz] + dz * st); }); render(); }

  /* ---------------- scales ---------------- */
  const ext = (col, pad = .07) => { let lo = Infinity, hi = -Infinity; S.rows.forEach(r => { const v = r[col]; if (typeof v === 'number') { if (v < lo) lo = v; if (v > hi) hi = v; } }); if (!isFinite(lo)) { lo = 0; hi = 1; } const p = (hi - lo) * pad || 1; return [lo - p, hi + p]; };
  function fitView() { const [a, b] = ext(S.cx), [c, d] = ext(S.cy); S.V = { x0: a, x1: b, y0: c, y1: d }; S.manual = false; }
  const sx = v => M.l + (v - S.V.x0) / (S.V.x1 - S.V.x0) * PW, sy = v => H - M.b - (v - S.V.y0) / (S.V.y1 - S.V.y0) * PH, ix = p => S.V.x0 + (p - M.l) / PW * (S.V.x1 - S.V.x0), iy = p => S.V.y0 + (H - M.b - p) / PH * (S.V.y1 - S.V.y0);
  const catIdx = () => { const m = new Map(); if (S.cc) S.rows.forEach(r => { const v = r[S.cc]; if (!m.has(v)) m.set(v, m.size); }); return m; };
  function colorFn() {
    if (!S.cc) return () => STU_COL[0];
    if (S.nums.includes(S.cc) && new Set(S.rows.map(r => r[S.cc])).size > 10) { const [a, b] = ext(S.cc, 0); return r => { const t = (r[S.cc] - a) / ((b - a) || 1); return `hsl(${230 - 200 * t},70%,50%)`; }; }
    const m = catIdx(); return r => STU_COL[m.get(r[S.cc]) % STU_COL.length];
  }

  /* ---------------- 2-D chart drawing ---------------- */
  const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'stu-svg'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'chart'); svg.style.touchAction = 'none';
  const cv3 = h('div', { class: 'stu-3d', hidden: true }), rubber = h('div', { class: 'stu-rubber', hidden: true });
  const stage = h('div', { class: 'stu-stage' }, svg, cv3, rubber);
  let p3 = null, groups = [];
  const gridAxes = (xl, yl) => {
    let s = '';
    stuTicks(S.V.x0, S.V.x1, 8).forEach(t => { const X = sx(t); s += `<line x1="${X}" x2="${X}" y1="${M.t}" y2="${H - M.b}" class="g"/><text x="${X}" y="${H - M.b + 15}" class="tk" text-anchor="middle">${stuF(t)}</text>`; });
    stuTicks(S.V.y0, S.V.y1, 6).forEach(t => { const Y = sy(t); s += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y}" y2="${Y}" class="g"/><text x="${M.l - 6}" y="${Y + 4}" class="tk" text-anchor="end">${stuF(t)}</text>`; });
    return s + `<rect x="${M.l}" y="${M.t}" width="${PW}" height="${PH}" class="fr"/><text x="${M.l + PW / 2}" y="${H - 6}" class="al" text-anchor="middle">${esc(xl)}</text><text transform="translate(13 ${M.t + PH / 2}) rotate(-90)" class="al" text-anchor="middle">${esc(yl)}</text>`;
  };
  const clip = '<defs><clipPath id="stuclip"><rect x="' + M.l + '" y="' + M.t + '" width="' + PW + '" height="' + PH + '"/></clipPath></defs>';
  function funcPath(f) {
    const fn = f.fn; if (!fn) return ''; const N = 200; let d = '', pen = false;
    for (let i = 0; i <= N; i++) { const x = S.V.x0 + (S.V.x1 - S.V.x0) * i / N, y = fn(x, ...f.vals); if (isNaN(y) || Math.abs(sy(y)) > 1e5) { pen = false; continue; } d += (pen ? 'L' : 'M') + sx(x).toFixed(1) + ' ' + sy(y).toFixed(1); pen = true; }
    return d;
  }
  function objSvg() {
    let s = '';
    S.objs.forEach((o, oi) => {
      const col = o.color || '#C8323C', P = o.p.map(p => [sx(p[0]), sy(p[1])]), cls = o.fresh ? ' fresh' : '';
      if (o.kind === 'func2d') return;
      if (o.kind === 'line') { const [a, b] = P; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ext2 = 2000; s += `<path class="ob${cls}" d="M${a[0] - dx / L * ext2} ${a[1] - dy / L * ext2}L${b[0] + dx / L * ext2} ${b[1] + dy / L * ext2}" stroke="${col}" stroke-dasharray="6 5" opacity=".55" fill="none"/><path class="ob${cls}" d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke="${col}" stroke-width="2.4" fill="none"/>`; }
      else if (o.kind === 'vector') { const [a, b] = P, ang = Math.atan2(b[1] - a[1], b[0] - a[0]), h1 = 11; s += `<path class="ob${cls}" d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke="${col}" stroke-width="2.4" fill="none"/><path class="ob${cls}" d="M${b[0]} ${b[1]}l${-h1 * Math.cos(ang - .4)} ${-h1 * Math.sin(ang - .4)}M${b[0]} ${b[1]}l${-h1 * Math.cos(ang + .4)} ${-h1 * Math.sin(ang + .4)}" stroke="${col}" stroke-width="2.4" fill="none"/>`; }
      else if (o.kind === 'bezier') { const t = (i, u) => { const m = 1 - u; return [0, 1].map(k => m * m * m * o.p[0][k] + 3 * m * m * u * o.p[1][k] + 3 * m * u * u * o.p[2][k] + u * u * u * o.p[3][k]); }; let d = ''; for (let i = 0; i <= 60; i++) { const [x, y] = t(0, i / 60); d += (i ? 'L' : 'M') + sx(x).toFixed(1) + ' ' + sy(y).toFixed(1); }
        s += `<path d="M${P[0][0]} ${P[0][1]}L${P[1][0]} ${P[1][1]}M${P[3][0]} ${P[3][1]}L${P[2][0]} ${P[2][1]}" stroke="${col}" stroke-dasharray="3 4" opacity=".5" fill="none"/><path class="ob${cls}" d="${d}" stroke="${col}" stroke-width="2.6" fill="none"/>`; }
      else if (o.kind === 'poly') s += `<path class="ob${cls}" d="M${P.map(p => p.join(' ')).join('L')}Z" stroke="${col}" stroke-width="2.2" fill="${col}" fill-opacity=".12"/>`;
      else if (o.kind === 'free') s += `<path class="ob${cls}" d="M${P.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L')}" stroke="${col}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (o.kind !== 'free') P.forEach((p, k) => { s += `<circle class="hd" data-o="${oi}" data-k="${k}" cx="${p[0]}" cy="${p[1]}" r="6.5" fill="#fff" stroke="${col}" stroke-width="2"/>`; });
    });
    return s;
  }
  function draw2d() {
    const t = S.type, C = colorFn();
    if (!S.V || !S.manual) fitView();
    let body = '', xl = S.cx, yl = S.cy; groups = [];
    const pts = r => `data-id="${r.id}"`;
    if (['scatter', 'bubble', 'line', 'area'].includes(t)) {
      const rows = (t === 'line' || t === 'area') ? S.rows.slice().sort((a, b) => a[S.cx] - b[S.cx]) : S.rows;
      body += gridAxes(xl, yl) + clip + '<g clip-path="url(#stuclip)">';
      if (t === 'area' && rows.length) body += `<path d="M${sx(rows[0][S.cx])} ${sy(Math.max(S.V.y0, 0))}${rows.map(r => 'L' + sx(r[S.cx]).toFixed(1) + ' ' + sy(r[S.cy]).toFixed(1)).join('')}L${sx(rows[rows.length - 1][S.cx])} ${sy(Math.max(S.V.y0, 0))}Z" fill="${STU_COL[0]}" fill-opacity=".14"/>`;
      if (t === 'line' || t === 'area') body += `<path d="${rows.map((r, i) => (i ? 'L' : 'M') + sx(r[S.cx]).toFixed(1) + ' ' + sy(r[S.cy]).toFixed(1)).join('')}" fill="none" stroke="${STU_COL[0]}" stroke-width="1.6" opacity=".8"/>`;
      S.funcs.forEach((f, i) => { body += `<path class="ob${f.fresh ? ' fresh' : ''}" d="${funcPath(f)}" stroke="${f.color}" stroke-width="2.4" fill="none"/>`; });
      if (S.overlay === 'fit') { const fit = linfit(S.rows, S.cx, S.cy); if (fit) body += `<path d="M${sx(S.V.x0)} ${sy(fit.m * S.V.x0 + fit.b)}L${sx(S.V.x1)} ${sy(fit.m * S.V.x1 + fit.b)}" stroke="#D2600F" stroke-width="2" fill="none"/>`; }
      if (S.overlay === 'kmeans') { const km = kmeans(S.rows, [S.cx, S.cy], S.k); km.C.forEach((c, j) => { body += `<path d="M${sx(c[0]) - 8} ${sy(c[1])}h16M${sx(c[0])} ${sy(c[1]) - 8}v16" stroke="${STU_COL[j % 10]}" stroke-width="2.4"/><circle cx="${sx(c[0])}" cy="${sy(c[1])}" r="9" fill="none" stroke="#000" stroke-width="1"/>`; }); }
      const sizeRange = t === 'bubble' ? ext(S.cs, 0) : null;
      rows.forEach(r => { const on = S.sel.has(r.id), rad = t === 'bubble' ? 3 + 14 * ((r[S.cs] - sizeRange[0]) / ((sizeRange[1] - sizeRange[0]) || 1)) : 3.6; if (isNaN(r[S.cx]) || isNaN(r[S.cy])) return; body += `<circle ${pts(r)} cx="${sx(r[S.cx]).toFixed(1)}" cy="${sy(r[S.cy]).toFixed(1)}" r="${on ? rad + 2 : rad}" fill="${C(r)}" fill-opacity="${t === 'bubble' ? .6 : .85}" ${on ? 'stroke="#000" stroke-width="2"' : 'stroke="rgba(0,0,0,.35)" stroke-width=".6"'} class="pt"/>`; });
      body += objSvg() + '</g>';
    } else if (t === 'polar') {
      const cx0 = W / 2, cy0 = H / 2, R = Math.min(PW, PH) / 2 - 10, [a, b] = ext(S.cx, 0), [c, d] = ext(S.cy, 0);
      const pos = r => { const th = (r[S.cx] - a) / ((b - a) || 1) * 6.2832, rr = (r[S.cy] - c) / ((d - c) || 1) * R; return [cx0 + Math.cos(th) * rr, cy0 - Math.sin(th) * rr]; };
      for (let k = 1; k <= 4; k++) body += `<circle cx="${cx0}" cy="${cy0}" r="${R * k / 4}" class="gc"/><text x="${cx0 + 4}" y="${cy0 - R * k / 4 - 2}" class="tk">${stuF(c + (d - c) * k / 4)}</text>`;
      for (let k = 0; k < 12; k++) { const th = k / 12 * 6.2832; body += `<line x1="${cx0}" y1="${cy0}" x2="${cx0 + Math.cos(th) * R}" y2="${cy0 - Math.sin(th) * R}" class="g"/><text x="${cx0 + Math.cos(th) * (R + 12)}" y="${cy0 - Math.sin(th) * (R + 12) + 4}" class="tk" text-anchor="middle">${stuF(a + (b - a) * k / 12)}</text>`; }
      S.rows.forEach(r => { const [X, Y] = pos(r), on = S.sel.has(r.id); body += `<circle ${pts(r)} cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="${on ? 5.6 : 3.6}" fill="${C(r)}" ${on ? 'stroke="#000" stroke-width="2"' : 'stroke="rgba(0,0,0,.35)" stroke-width=".6"'} class="pt"/>`; });
      S._polar = { cx0, cy0, R, a, b, c, d };
      body += `<text x="${M.l}" y="${M.t + 10}" class="al">angle = ${esc(S.cx)}, radius = ${esc(S.cy)}</text>`;
    } else if (t === 'hist') {
      const [a, b] = ext(S.cx, 0), n = S.bins, bw = (b - a) / n || 1, cnt = Array.from({ length: n }, () => []);
      S.rows.forEach(r => { const k = Math.min(n - 1, Math.max(0, Math.floor((r[S.cx] - a) / bw))); cnt[k].push(r.id); });
      const mx = Math.max(1, ...cnt.map(c => c.length)); const X = v => M.l + (v - a) / (b - a) * PW, Y = v => H - M.b - v / mx * PH;
      body += `<rect x="${M.l}" y="${M.t}" width="${PW}" height="${PH}" class="fr"/>`;
      stuTicks(0, mx, 5).forEach(v => { body += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}" class="g"/><text x="${M.l - 6}" y="${Y(v) + 4}" class="tk" text-anchor="end">${v}</text>`; });
      stuTicks(a, b, 8).forEach(v => { body += `<text x="${X(v)}" y="${H - M.b + 15}" class="tk" text-anchor="middle">${stuF(v)}</text>`; });
      cnt.forEach((c, k) => { const gi = groups.push(c) - 1, on = c.length && c.every(id => S.sel.has(id)); body += `<rect data-g="${gi}" x="${X(a + k * bw) + 1}" y="${Y(c.length)}" width="${Math.max(1, PW / n - 2)}" height="${H - M.b - Y(c.length)}" fill="${on ? '#D2600F' : STU_COL[0]}" fill-opacity=".8" class="pt"/>`; });
      body += `<text x="${M.l + PW / 2}" y="${H - 6}" class="al" text-anchor="middle">${esc(S.cx)}</text><text transform="translate(13 ${M.t + PH / 2}) rotate(-90)" class="al" text-anchor="middle">count</text>`;
    } else if (t === 'bar' || t === 'pie' || t === 'box' || t === 'radar') {
      const catc = S.cc && !S.nums.includes(S.cc) ? S.cc : S.cat, keys = [...new Set(S.rows.map(r => r[catc]))];
      if (!catc || !keys.length) { body = `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="al">This chart needs a category column (choose one under "colour by").</text>`; }
      else if (t === 'bar') {
        const stat = keys.map(k => { const g = S.rows.filter(r => r[catc] === k), m = g.reduce((s, r) => s + r[S.cy], 0) / (g.length || 1); return { k, m, ids: g.map(r => r.id) }; }), lo = Math.min(0, ...stat.map(s => s.m)), hi = Math.max(0, ...stat.map(s => s.m)) * 1.1 || 1, Y = v => H - M.b - (v - lo) / (hi - lo) * PH, bw = PW / keys.length;
        body += `<rect x="${M.l}" y="${M.t}" width="${PW}" height="${PH}" class="fr"/>`;
        stuTicks(lo, hi, 6).forEach(v => { body += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}" class="g"/><text x="${M.l - 6}" y="${Y(v) + 4}" class="tk" text-anchor="end">${stuF(v)}</text>`; });
        stat.forEach((s, i) => { const gi = groups.push(s.ids) - 1, on = s.ids.every(id => S.sel.has(id)); body += `<rect data-g="${gi}" x="${M.l + i * bw + bw * .15}" y="${Math.min(Y(s.m), Y(0))}" width="${bw * .7}" height="${Math.abs(Y(s.m) - Y(0))}" fill="${on ? '#D2600F' : STU_COL[i % 10]}" fill-opacity=".85" class="pt"/><text x="${M.l + i * bw + bw / 2}" y="${H - M.b + 15}" text-anchor="middle" class="tk">${esc(String(s.k))}</text><text x="${M.l + i * bw + bw / 2}" y="${Math.min(Y(s.m), Y(0)) - 4}" text-anchor="middle" class="tk">${stuF(s.m)}</text>`; });
        body += `<text transform="translate(13 ${M.t + PH / 2}) rotate(-90)" class="al" text-anchor="middle">mean of ${esc(S.cy)}</text>`;
      } else if (t === 'pie') {
        const tot = S.rows.length || 1; let a0 = -Math.PI / 2; const R = Math.min(PW, PH) / 2 - 12, cx0 = W / 2, cy0 = H / 2;
        keys.forEach((k, i) => { const ids = S.rows.filter(r => r[catc] === k).map(r => r.id), ang = ids.length / tot * 6.2832, a1 = a0 + ang, big = ang > Math.PI ? 1 : 0, gi = groups.push(ids) - 1, on = ids.every(id => S.sel.has(id));
          body += `<path data-g="${gi}" d="M${cx0 + Math.cos(a0) * R * .55} ${cy0 + Math.sin(a0) * R * .55}L${cx0 + Math.cos(a0) * R} ${cy0 + Math.sin(a0) * R}A${R} ${R} 0 ${big} 1 ${cx0 + Math.cos(a1) * R} ${cy0 + Math.sin(a1) * R}L${cx0 + Math.cos(a1) * R * .55} ${cy0 + Math.sin(a1) * R * .55}A${R * .55} ${R * .55} 0 ${big} 0 ${cx0 + Math.cos(a0) * R * .55} ${cy0 + Math.sin(a0) * R * .55}Z" fill="${STU_COL[i % 10]}" stroke="${on ? '#000' : 'var(--surface)'}" stroke-width="${on ? 3 : 1.5}" class="pt"/><text x="${cx0 + Math.cos((a0 + a1) / 2) * R * .78}" y="${cy0 + Math.sin((a0 + a1) / 2) * R * .78 + 4}" text-anchor="middle" class="tk" fill="#fff" style="fill:#fff">${esc(String(k))} ${(ids.length / tot * 100).toFixed(0)}%</text>`; a0 = a1; });
        body += `<text x="${cx0}" y="${cy0 + 4}" text-anchor="middle" class="al">${tot} rows</text>`;
      } else if (t === 'box') {
        const [lo, hi] = ext(S.cy, .05), Y = v => H - M.b - (v - lo) / (hi - lo) * PH, bw = PW / keys.length; body += gridAxesY(lo, hi, Y, S.cy);
        keys.forEach((k, i) => { const g = S.rows.filter(r => r[catc] === k).sort((a, b) => a[S.cy] - b[S.cy]), v = g.map(r => r[S.cy]), qf = p => v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))], q1 = qf(.25), q2 = qf(.5), q3 = qf(.75), iq = q3 - q1, fl = q1 - 1.5 * iq, fh = q3 + 1.5 * iq, inside = v.filter(x => x >= fl && x <= fh), w0 = Math.min(...inside), w1 = Math.max(...inside), X = M.l + i * bw + bw / 2, ids = g.map(r => r.id), gi = groups.push(ids) - 1;
          body += `<line x1="${X}" x2="${X}" y1="${Y(w0)}" y2="${Y(w1)}" stroke="${STU_COL[i % 10]}" stroke-width="1.6"/><rect data-g="${gi}" x="${X - bw * .25}" y="${Y(q3)}" width="${bw * .5}" height="${Math.max(1, Y(q1) - Y(q3))}" fill="${STU_COL[i % 10]}" fill-opacity=".35" stroke="${STU_COL[i % 10]}" stroke-width="2" class="pt"/><line x1="${X - bw * .25}" x2="${X + bw * .25}" y1="${Y(q2)}" y2="${Y(q2)}" stroke="#000" stroke-width="2"/><text x="${X}" y="${H - M.b + 15}" text-anchor="middle" class="tk">${esc(String(k))}</text>`;
          g.filter(r => r[S.cy] < fl || r[S.cy] > fh).forEach(r => { body += `<circle data-id="${r.id}" cx="${X}" cy="${Y(r[S.cy])}" r="${S.sel.has(r.id) ? 5 : 3.4}" fill="none" stroke="${S.sel.has(r.id) ? '#000' : STU_COL[i % 10]}" stroke-width="2" class="pt"/>`; }); });
      } else if (t === 'radar') {
        const cols = S.nums, cx0 = W / 2, cy0 = H / 2, R = Math.min(PW, PH) / 2 - 22, ex = cols.map(c => ext(c, 0)), pt = (c, v, k) => { const th = -Math.PI / 2 + k / cols.length * 6.2832, rr = (v - ex[k][0]) / ((ex[k][1] - ex[k][0]) || 1) * R; return [cx0 + Math.cos(th) * rr, cy0 + Math.sin(th) * rr]; };
        for (let k = 1; k <= 4; k++) body += `<path d="M${cols.map((c, j) => { const th = -Math.PI / 2 + j / cols.length * 6.2832; return (cx0 + Math.cos(th) * R * k / 4) + ' ' + (cy0 + Math.sin(th) * R * k / 4); }).join('L')}Z" class="gc" fill="none"/>`;
        cols.forEach((c, j) => { const th = -Math.PI / 2 + j / cols.length * 6.2832; body += `<line x1="${cx0}" y1="${cy0}" x2="${cx0 + Math.cos(th) * R}" y2="${cy0 + Math.sin(th) * R}" class="g"/><text x="${cx0 + Math.cos(th) * (R + 14)}" y="${cy0 + Math.sin(th) * (R + 14) + 4}" text-anchor="middle" class="tk">${esc(c)}</text>`; });
        const mean = g => cols.map(c => g.reduce((s, r) => s + r[c], 0) / (g.length || 1));
        keys.forEach((k, i) => { const g = S.rows.filter(r => r[catc] === k); if (!g.length) return; const m = mean(g), P = m.map((v, j) => pt(cols[j], v, j)); body += `<path d="M${P.map(p => p.join(' ')).join('L')}Z" stroke="${STU_COL[i % 10]}" stroke-width="2.4" fill="${STU_COL[i % 10]}" fill-opacity=".14"/>`; });
        if (S.sel.size) { const m = mean(sel()), P = m.map((v, j) => pt(cols[j], v, j)); body += `<path d="M${P.map(p => p.join(' ')).join('L')}Z" stroke="#000" stroke-width="2.4" stroke-dasharray="5 4" fill="none"/>`; }
        body += `<text x="${M.l}" y="${M.t + 10}" class="al">one polygon per ${esc(catc)}; dashed = your selection</text>`;
      }
    } else if (t === 'heat') {
      const [a, b] = ext(S.cx, 0), [c, d] = ext(S.cy, 0), n = S.bins, cnt = Array.from({ length: n * n }, () => []);
      S.rows.forEach(r => { const i = Math.min(n - 1, Math.max(0, Math.floor((r[S.cx] - a) / (b - a || 1) * n))), j = Math.min(n - 1, Math.max(0, Math.floor((r[S.cy] - c) / (d - c || 1) * n))); cnt[j * n + i].push(r.id); });
      const mx = Math.max(1, ...cnt.map(x => x.length)); body += `<rect x="${M.l}" y="${M.t}" width="${PW}" height="${PH}" class="fr"/>`;
      cnt.forEach((ids, k) => { if (!ids.length) return; const i = k % n, j = Math.floor(k / n), gi = groups.push(ids) - 1, t0 = ids.length / mx, on = ids.every(id => S.sel.has(id)); body += `<rect data-g="${gi}" x="${M.l + i * PW / n}" y="${H - M.b - (j + 1) * PH / n}" width="${PW / n}" height="${PH / n}" fill="hsl(${240 - 200 * t0},70%,${55 - 15 * t0}%)" stroke="${on ? '#000' : 'none'}" stroke-width="2" class="pt"/><text x="${M.l + (i + .5) * PW / n}" y="${H - M.b - (j + .5) * PH / n + 4}" text-anchor="middle" class="tk" style="fill:#fff">${ids.length}</text>`; });
      stuTicks(a, b, 6).forEach(v => { body += `<text x="${M.l + (v - a) / (b - a) * PW}" y="${H - M.b + 15}" class="tk" text-anchor="middle">${stuF(v)}</text>`; }); stuTicks(c, d, 5).forEach(v => { body += `<text x="${M.l - 6}" y="${H - M.b - (v - c) / (d - c) * PH + 4}" class="tk" text-anchor="end">${stuF(v)}</text>`; });
      body += `<text x="${M.l + PW / 2}" y="${H - 6}" class="al" text-anchor="middle">${esc(S.cx)}</text><text transform="translate(13 ${M.t + PH / 2}) rotate(-90)" class="al" text-anchor="middle">${esc(S.cy)}</text>`;
    } else if (t === 'corr') {
      const cols = S.nums, n = cols.length, cs = Math.min(PW, PH) / n, x0 = (W - cs * n) / 2 + 20, y0 = (H - cs * n) / 2 - 6;
      cols.forEach((a, i) => cols.forEach((b, j) => { const r = corr(S.rows, a, b); body += `<rect data-pair="${i},${j}" x="${x0 + j * cs}" y="${y0 + i * cs}" width="${cs}" height="${cs}" fill="${r >= 0 ? `rgba(210,96,15,${Math.abs(r)})` : `rgba(47,111,224,${Math.abs(r)})`}" stroke="var(--line)" class="pt"/><text x="${x0 + (j + .5) * cs}" y="${y0 + (i + .5) * cs + 4}" text-anchor="middle" class="tk" style="fill:var(--fg)">${r.toFixed(2)}</text>`; }));
      cols.forEach((c, i) => { body += `<text x="${x0 - 6}" y="${y0 + (i + .5) * cs + 4}" text-anchor="end" class="tk">${esc(c)}</text><text x="${x0 + (i + .5) * cs}" y="${y0 - 6}" text-anchor="middle" class="tk">${esc(c)}</text>`; });
      body += `<text x="${M.l}" y="${H - 8}" class="al">orange = move together, blue = move opposite. Click a cell to see that pair as a scatter plot. Drag points in the scatter and watch this change.</text>`;
    }
    svg.innerHTML = body;
  }
  const gridAxesY = (lo, hi, Y, label) => { let s = `<rect x="${M.l}" y="${M.t}" width="${PW}" height="${PH}" class="fr"/>`; stuTicks(lo, hi, 6).forEach(v => { s += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}" class="g"/><text x="${M.l - 6}" y="${Y(v) + 4}" class="tk" text-anchor="end">${stuF(v)}</text>`; }); return s + `<text transform="translate(13 ${M.t + PH / 2}) rotate(-90)" class="al" text-anchor="middle">${esc(label)}</text>`; };

  /* ---------------- maths helpers ---------------- */
  function corr(rows, a, b) { const n = rows.length; if (n < 2) return 0; let ma = 0, mb = 0; rows.forEach(r => { ma += r[a]; mb += r[b]; }); ma /= n; mb /= n; let sab = 0, saa = 0, sbb = 0; rows.forEach(r => { const u = r[a] - ma, v = r[b] - mb; sab += u * v; saa += u * u; sbb += v * v; }); return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0; }
  function linfit(rows, a, b) { const n = rows.length; if (n < 2) return null; let sx2 = 0, sy2 = 0, sxy = 0, sxx = 0; rows.forEach(r => { sx2 += r[a]; sy2 += r[b]; sxy += r[a] * r[b]; sxx += r[a] * r[a]; }); const den = n * sxx - sx2 * sx2; if (!den) return null; const m = (n * sxy - sx2 * sy2) / den, bb = (sy2 - m * sx2) / n, my = sy2 / n; let ssr = 0, sst = 0; rows.forEach(r => { ssr += (r[b] - (m * r[a] + bb)) ** 2; sst += (r[b] - my) ** 2; }); return { m, b: bb, r2: sst ? 1 - ssr / sst : 0 }; }
  function kmeans(rows, cols, k) { const X = rows.map(r => cols.map(c => r[c])); if (X.length < k) return { C: X, lab: [] }; let C = X.filter((_, i) => i % Math.max(1, Math.floor(X.length / k)) === 0).slice(0, k), lab = []; for (let it = 0; it < 25; it++) { lab = X.map(p => { let bi = 0, bd = Infinity; C.forEach((c, j) => { const d = p.reduce((s, v, t) => s + (v - c[t]) ** 2, 0); if (d < bd) { bd = d; bi = j; } }); return bi; }); C = C.map((c, j) => { const m = X.filter((_, i) => lab[i] === j); return m.length ? cols.map((_, t) => m.reduce((s, p) => s + p[t], 0) / m.length) : c; }); } return { C, lab }; }

  /* ---------------- 3-D ---------------- */
  function fit3() { const e = [S.cx, S.cy, S.cz].map(c => { const a = S.rows.map(r => r[c]).filter(v => typeof v === 'number').sort((u, v) => u - v), at = f => a[Math.min(a.length - 1, Math.max(0, Math.floor(f * (a.length - 1))))]; let lo = a.length ? at(.01) : 0, hi = a.length ? at(.99) : 1; if (hi === lo) { lo = a[0] - 1; hi = a[a.length - 1] + 1; } const pad = (hi - lo) * .12 || 1; return [lo - pad, hi + pad]; }); S.n3 = { lo: e.map(x => x[0]), hi: e.map(x => x[1]) }; if (p3) { p3.resetZoom(); p3.focus([0, 0, 0], 1.75); } }
  const nz = (i, v) => (v - S.n3.lo[i]) / ((S.n3.hi[i] - S.n3.lo[i]) || 1) * 2 - 1, rl = (i, n) => S.n3.lo[i] + (n + 1) / 2 * ((S.n3.hi[i] - S.n3.lo[i]) || 1);
  const P3 = r => [nz(0, r[S.cx]), nz(1, r[S.cy]), nz(2, r[S.cz])];
  function ensure3d() { if (p3) return; p3 = Plot3D(cv3, { w: W, h: H, az: .75, el: .45, wheel: true, label: '3-D chart. Drag to rotate, wheel to zoom, shift-drag to pan, drag a point to move it.' }); p3.grab = grab3; p3.onGrabMove = grabMove3; p3.onGrabEnd = grabEnd3; p3.onHover = hover3; }
  function draw3d() {
    ensure3d(); if (!S.n3) fit3(); const it = [], E = '#8A958F', C = colorFn();
    const c2 = [-1, 1]; for (const a of c2) for (const b of c2) it.push({ t: 'line', a: [-1, a, b], b: [1, a, b], color: E, w: .8 }, { t: 'line', a: [a, -1, b], b: [a, 1, b], color: E, w: .8 }, { t: 'line', a: [a, b, -1], b: [a, b, 1], color: E, w: .8 });
    for (let i = 1; i < 4; i++) { const u = -1 + i * .5; it.push({ t: 'line', a: [u, -1, -1], b: [u, 1, -1], color: E, w: .4, g: true }, { t: 'line', a: [-1, u, -1], b: [1, u, -1], color: E, w: .4, g: true }); }
    [-1, 0, 1].forEach(u => it.push({ t: 'txt', p: [u, -1.18, -1], s: stuF(rl(0, u)), size: 10, mono: true }, { t: 'txt', p: [-1.18, u, -1], s: stuF(rl(1, u)), size: 10, mono: true }, { t: 'txt', p: [-1.2, -1.2, u], s: stuF(rl(2, u)), size: 10, mono: true }));
    it.push({ t: 'txt', p: [0, -1.5, -1], s: S.cx, size: 12, bold: true, color: '#C8323C' }, { t: 'txt', p: [-1.5, 0, -1], s: S.cy, size: 12, bold: true, color: '#1E8E5A' }, { t: 'txt', p: [-1.45, -1.45, 0], s: S.cz, size: 12, bold: true, color: '#2F6FE0' });
    if (S.type === 'surface' || S.funcs.some(f => f.kind === 'surf')) S.funcs.filter(f => f.kind === 'surf').forEach(f => { const G = 16; for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const xs = [i, i + 1, i + 1, i].map(k => -1 + 2 * k / G), ys = [j, j, j + 1, j + 1].map(k => -1 + 2 * k / G); it.push({ t: 'poly', pts: xs.map((x, k) => { const z = f.fn(rl(0, x), rl(1, ys[k]), ...f.vals); return [x, ys[k], isNaN(z) ? 0 : Math.max(-1.15, Math.min(1.15, nz(2, z)))]; }), fill: f.color + '33', stroke: f.color + '88', sw: .5 }); } });
    if (S.overlay === 'fit' && S.type !== 'surface') { const p = planefit(S.rows, S.cx, S.cy, S.cz); if (p) { const G = 8; for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const xs = [i, i + 1, i + 1, i].map(k => -1 + 2 * k / G), ys = [j, j, j + 1, j + 1].map(k => -1 + 2 * k / G); it.push({ t: 'poly', pts: xs.map((x, k) => [x, ys[k], Math.max(-1.4, Math.min(1.4, nz(2, p.a * rl(0, x) + p.b * rl(1, ys[k]) + p.c)))]), fill: 'rgba(210,96,15,.10)', stroke: 'rgba(210,96,15,.35)', sw: .5 }); } } }
    if (S.overlay === 'kmeans') kmeans(S.rows, [S.cx, S.cy, S.cz], S.k).C.forEach((c, j) => it.push({ t: 'pt', p: [nz(0, c[0]), nz(1, c[1]), nz(2, c[2])], r: 12, color: STU_COL[j % 10], ring: '#000' }));
    S.objs.forEach(o => { const col = o.color || '#C8323C', Q = o.p.map(p => [nz(0, p[0]), nz(1, p[1]), nz(2, p[2] || 0)]);
      if (o.kind === 'vector' || o.kind === 'line') { it.push({ t: 'line', a: Q[0], b: Q[1], color: col, w: 2.4 }); if (o.kind === 'vector') it.push({ t: 'pt', p: Q[1], r: 6, color: col }); }
      else if (o.kind === 'poly') Q.forEach((q, k) => it.push({ t: 'line', a: q, b: Q[(k + 1) % Q.length], color: col, w: 2 }));
      else if (o.kind === 'bezier') { let prev = null; for (let i = 0; i <= 40; i++) { const u = i / 40, m = 1 - u, pt = [0, 1, 2].map(k => m * m * m * Q[0][k] + 3 * m * m * u * Q[1][k] + 3 * m * u * u * Q[2][k] + u * u * u * Q[3][k]); if (prev) it.push({ t: 'line', a: prev, b: pt, color: col, w: 2.6 }); prev = pt; } }
      else if (o.kind === 'free') Q.forEach((q, k) => { if (k) it.push({ t: 'line', a: Q[k - 1], b: q, color: col, w: 2 }); });
      if (o.kind !== 'free') Q.forEach((q, k) => it.push({ t: 'pt', p: q, r: 7, color: '#fff', ring: col, h: [S.objs.indexOf(o), k] })); });
    if (S.type !== 'surface') S.rows.forEach(r => { const on = S.sel.has(r.id); it.push({ t: 'pt', p: P3(r), r: on ? 9 : 4.6, color: C(r), ring: on ? '#000' : null, id: r.id }); });
    S._items3 = it; p3.set(it, [0, 0, 0], 1.75); if (!S._c3) { p3.focus([0, 0, 0], 1.75); S._c3 = 1; } p3.draw(1);
  }
  function planefit(rows, a, b, c) { const n = rows.length; if (n < 3) return null; const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], y = [0, 0, 0]; rows.forEach(r => { const v = [r[a], r[b], 1]; for (let i = 0; i < 3; i++) { y[i] += v[i] * r[c]; for (let j = 0; j < 3; j++) A[i][j] += v[i] * v[j]; } }); const det = M3(A); if (!det) return null; const sol = [0, 1, 2].map(k => M3(A.map((row, i) => row.map((val, j) => (j === k ? y[i] : val)))) / det); return { a: sol[0], b: sol[1], c: sol[2] }; }
  const M3 = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  let ctrlHeld = false, g3 = null;
  addEventListener('keydown', e => { if (e.key === 'Control') ctrlHeld = true; }); addEventListener('keyup', e => { if (e.key === 'Control') ctrlHeld = false; });
  function nearest3(cx, cy, rad) { let best = null, bd = rad; (S._items3 || []).forEach(it => { if (it.t !== 'pt' || (it.id == null && !it.h)) return; const q2 = p3.proj(it.p), d = Math.hypot(q2[0] - cx, q2[1] - cy); if (d < bd || (it.h && d < bd + 3)) { bd = d; best = it; } }); return best; }
  function grab3(cx, cy, ev) {
    if (S.type !== '3d' && S.type !== 'surface') return false;
    if (ctrlHeld || (ev && ev.ctrlKey)) { g3 = { box: true, x0: cx, y0: cy, x1: cx, y1: cy, add: ev && ev.shiftKey }; return true; }
    const hit = nearest3(cx, cy, 11);
    if (!hit) return S.tool === 'add' ? (addAt3(cx, cy), true) : false;
    if (hit.h) { g3 = { handle: hit.h }; push(); return true; }
    const add = ev && ev.shiftKey; if (!S.sel.has(hit.id) || add) { toggle(hit.id, add); if (!S.sel.has(hit.id)) return true; render(true); }
    g3 = { drag: true, moved: false }; push(); return true;
  }
  function planeMove(dx, dy) {
    const { az, el } = p3.view(), sc = p3.scale(), ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
    const J = [[ca * sc, -sa * sc, 0], [-sa * se * sc, -ca * se * sc, -ce * sc]];
    if (S.plane === 'screen') { const dx1 = dx / sc, dz = -ce * dy / sc, dy1 = -se * dy / sc; return [dx1 * ca + dy1 * sa, -dx1 * sa + dy1 * ca, dz]; }
    const ax = { xy: [0, 1], xz: [0, 2], yz: [1, 2] }[S.plane], a = ax[0], b = ax[1], A = J[0][a], B = J[0][b], Cc = J[1][a], D = J[1][b], lam = 1e-3 * sc * sc;
    const m11 = A * A + Cc * Cc + lam, m12 = A * B + Cc * D, m22 = B * B + D * D + lam, r1 = A * dx + Cc * dy, r2 = B * dx + D * dy, det = m11 * m22 - m12 * m12, out = [0, 0, 0];
    out[a] = (m22 * r1 - m12 * r2) / det; out[b] = (-m12 * r1 + m11 * r2) / det; return out;
  }
  function grabMove3(dx, dy) {
    if (!g3) return;
    if (g3.box) { g3.x1 += dx; g3.y1 += dy; const r = cv3.getBoundingClientRect(), k = r.width / W; Object.assign(rubber.style, { left: Math.min(g3.x0, g3.x1) * k + 'px', top: Math.min(g3.y0, g3.y1) * k + 'px', width: Math.abs(g3.x1 - g3.x0) * k + 'px', height: Math.abs(g3.y1 - g3.y0) * k + 'px' }); rubber.hidden = false; return; }
    const dn = planeMove(dx, dy);
    if (g3.handle) { const o = S.objs[g3.handle[0]], p = o.p[g3.handle[1]]; for (let i = 0; i < 3; i++) p[i] = stuN((p[i] || 0) + dn[i] * ((S.n3.hi[i] - S.n3.lo[i]) / 2)); drawAll(); return; }
    g3.moved = true; sel().forEach(r => { r[S.cx] = stuN(r[S.cx] + dn[0] * ((S.n3.hi[0] - S.n3.lo[0]) / 2)); r[S.cy] = stuN(r[S.cy] + dn[1] * ((S.n3.hi[1] - S.n3.lo[1]) / 2)); r[S.cz] = stuN(r[S.cz] + dn[2] * ((S.n3.hi[2] - S.n3.lo[2]) / 2)); }); draw3d();
  }
  function grabEnd3() {
    if (g3 && g3.box) { rubber.hidden = true; const x0 = Math.min(g3.x0, g3.x1), x1 = Math.max(g3.x0, g3.x1), y0 = Math.min(g3.y0, g3.y1), y1 = Math.max(g3.y0, g3.y1); const ids = S.rows.filter(r => { const q2 = p3.proj(P3(r)); return q2[0] >= x0 && q2[0] <= x1 && q2[1] >= y0 && q2[1] <= y1; }).map(r => r.id); setSel(ids, g3.add); }
    else if (g3 && g3.drag && !g3.moved) S.hist.pop();
    g3 = null; render();
  }
  function hover3(cx, cy) { if (cx == null) { readout.textContent = ''; return; } const h0 = nearest3(cx, cy, 10); if (h0 && h0.id != null) { const r = byId.get(h0.id); readout.textContent = 'row ' + r.id + ': ' + S.nums.map(c => c + ' = ' + stuF(r[c])).join('   ') + (S.cat ? '   ' + S.cat + ' = ' + r[S.cat] : ''); } }
  function addAt3(cx, cy) { const u = p3.unproject(cx, cy, -1); if (!u) return; addAt({ [S.cx]: stuN(rl(0, u[0])), [S.cy]: stuN(rl(1, u[1])), [S.cz]: stuN(rl(2, -1)) }); }

  /* ---------------- 2-D pointer interaction ---------------- */
  let D = null;
  const cap = e => { try { svg.setPointerCapture(e.pointerId); } catch (x) { /* synthetic events have no pointer to capture */ } };
  const loc = e => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  const movable = () => ['scatter', 'bubble', 'line', 'area', 'polar'].includes(S.type);
  svg.addEventListener('pointerdown', e => {
    const [cx, cy] = loc(e), t = e.target, add = e.shiftKey;
    if (t.dataset && t.dataset.o != null) { push(); D = { mode: 'handle', o: +t.dataset.o, k: +t.dataset.k }; cap(e); return; }
    if (t.dataset && t.dataset.pair != null) { const [i, j] = t.dataset.pair.split(',').map(Number); S.cx = S.nums[j]; S.cy = S.nums[i]; S.type = 'scatter'; S.manual = false; typeSel.value = 'scatter'; fillSelects(); render(); return; }
    if (t.dataset && t.dataset.g != null) { setSel(groups[+t.dataset.g], add); if (add) return; return; }
    if (t.dataset && t.dataset.id != null) {
      const id = isNaN(+t.dataset.id) ? t.dataset.id : +t.dataset.id; if (S.tool === 'delete') { S.sel = new Set([id]); del(); return; }
      if (!S.sel.has(id) || add) { toggle(id, add); render(true); if (!S.sel.has(id)) return; }
      if (movable()) { push(); D = { mode: 'move', lx: cx, ly: cy, moved: false }; cap(e); } return;
    }
    if (S.tool === 'sketch' && movable()) { push(); const o = { kind: 'free', p: [[ix(cx), iy(cy), 0]], color: '#C8323C' }; S.objs.push(o); D = { mode: 'sketch', o }; cap(e); return; }
    if (S.tool === 'add' && movable() && S.type !== 'polar') { addAt({ [S.cx]: stuN(ix(cx)), [S.cy]: stuN(iy(cy)) }); return; }
    if (S.tool === 'pan' || e.button === 1 || ctrlHeld && false) { D = { mode: 'pan', lx: cx, ly: cy }; cap(e); return; }
    if (['scatter', 'bubble', 'line', 'area', 'polar'].includes(S.type)) { D = { mode: e.shiftKey && false ? 'pan' : 'box', x0: cx, y0: cy, x1: cx, y1: cy, add }; cap(e); }
  });
  svg.addEventListener('pointermove', e => {
    const [cx, cy] = loc(e);
    if (!D) { if (e.target.dataset && e.target.dataset.id != null) { const r = byId.get(isNaN(+e.target.dataset.id) ? e.target.dataset.id : +e.target.dataset.id); if (r) readout.textContent = 'row ' + r.id + ': ' + S.nums.map(c => c + ' = ' + stuF(r[c])).join('   ') + (S.cat ? '   ' + S.cat + ' = ' + r[S.cat] : ''); } else if (S.V && S.type !== 'polar' && ['scatter', 'bubble', 'line', 'area', 'heat'].includes(S.type)) readout.textContent = S.cx + ' = ' + stuF(ix(cx)) + '   ' + S.cy + ' = ' + stuF(iy(cy)); return; }
    if (D.mode === 'move') {
      D.moved = true;
      if (S.type === 'polar') { const P = S._polar, th = (Math.atan2(P.cy0 - cy, cx - P.cx0) + 6.2832) % 6.2832, rr = Math.min(1.2, Math.hypot(cx - P.cx0, cy - P.cy0) / P.R), prim = sel()[0]; if (prim) { const nx = P.a + th / 6.2832 * (P.b - P.a), ny = P.c + rr * (P.d - P.c), dxx = nx - prim[S.cx], dyy = ny - prim[S.cy]; sel().forEach(r => { r[S.cx] = stuN(r[S.cx] + dxx); r[S.cy] = stuN(r[S.cy] + dyy); }); } }
      else { const ddx = (cx - D.lx) * (S.V.x1 - S.V.x0) / PW, ddy = -(cy - D.ly) * (S.V.y1 - S.V.y0) / PH; D.lx = cx; D.ly = cy; sel().forEach(r => { r[S.cx] = stuN(r[S.cx] + ddx); r[S.cy] = stuN(r[S.cy] + ddy); }); }
      drawAll(true);
    } else if (D.mode === 'handle') { const o = S.objs[D.o]; o.p[D.k][0] = stuN(ix(cx)); o.p[D.k][1] = stuN(iy(cy)); drawAll(true); }
    else if (D.mode === 'sketch') { const l = D.o.p[D.o.p.length - 1]; if (Math.hypot(sx(l[0]) - cx, sy(l[1]) - cy) > 3) { D.o.p.push([stuN(ix(cx)), stuN(iy(cy)), 0]); draw2d(); } }
    else if (D.mode === 'pan') { const ddx = (cx - D.lx) * (S.V.x1 - S.V.x0) / PW, ddy = (cy - D.ly) * (S.V.y1 - S.V.y0) / PH; D.lx = cx; D.ly = cy; S.V.x0 -= ddx; S.V.x1 -= ddx; S.V.y0 += ddy; S.V.y1 += ddy; S.manual = true; draw2d(); }
    else if (D.mode === 'box') { D.x1 = cx; D.y1 = cy; const r = svg.getBoundingClientRect(), k = r.width / W; Object.assign(rubber.style, { left: Math.min(D.x0, D.x1) * k + 'px', top: Math.min(D.y0, D.y1) * k + 'px', width: Math.abs(D.x1 - D.x0) * k + 'px', height: Math.abs(D.y1 - D.y0) * k + 'px' }); rubber.hidden = false; }
  });
  const endD = () => {
    if (!D) return; const d = D; D = null; rubber.hidden = true;
    if (d.mode === 'box') { if (Math.hypot(d.x1 - d.x0, d.y1 - d.y0) < 4) { if (!d.add) { S.sel.clear(); render(); } return; } const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1); const inside = r => { let X, Y; if (S.type === 'polar') { const P = S._polar, th = (r[S.cx] - P.a) / ((P.b - P.a) || 1) * 6.2832, rr = (r[S.cy] - P.c) / ((P.d - P.c) || 1) * P.R; X = P.cx0 + Math.cos(th) * rr; Y = P.cy0 - Math.sin(th) * rr; } else { X = sx(r[S.cx]); Y = sy(r[S.cy]); } return X >= x0 && X <= x1 && Y >= y0 && Y <= y1; }; setSel(S.rows.filter(inside).map(r => r.id), d.add); return; }
    if (d.mode === 'move' && !d.moved) S.hist.pop();
    if (d.mode === 'sketch' && d.o.p.length < 3) S.objs.pop();
    render();
  };
  svg.addEventListener('pointerup', endD); svg.addEventListener('pointercancel', endD);
  svg.addEventListener('wheel', e => {
    if (!S.V || ['hist', 'bar', 'pie', 'box', 'radar', 'corr', 'polar', 'heat'].includes(S.type)) return; e.preventDefault(); const [cx, cy] = loc(e), f = Math.exp(e.deltaY * .0015), X = ix(cx), Y = iy(cy);
    S.V = { x0: X + (S.V.x0 - X) * f, x1: X + (S.V.x1 - X) * f, y0: Y + (S.V.y0 - Y) * f, y1: Y + (S.V.y1 - Y) * f }; S.manual = true; draw2d(); readoutZoom();
  }, { passive: false });
  const readoutZoom = () => { zoomLbl.textContent = S.V && S.manual ? 'zoomed' : 'fit'; };

  /* ---------------- UI shell ---------------- */
  const status = h('span', { class: 'muted', style: { fontSize: '12.5px' } }), readout = h('div', { class: 'mono', style: { fontSize: '12px', minHeight: '1.5em' } }), zoomLbl = h('span', { class: 'chip' }, 'fit');
  const sel2 = (label, opts, cur, on) => { const s = h('select', { class: 'input', 'aria-label': label, title: label }, opts.map(([v, t]) => h('option', { value: v }, t))); s.value = cur; s.addEventListener('change', () => on(s.value)); return s; };
  const dsOpts = Object.entries(STU_SETS).map(([k, d]) => [k, d.name]).concat(BIG.catalog.map(d => ['big:' + d.id, 'Real table: ' + d.title]));
  const dsSel = sel2('data set', dsOpts, S.set, v => { S.set = v; S.nonce = 0; loadAny(); }), lvSel = sel2('complexity', [[1, 'Complexity: basic'], [2, 'Complexity: medium'], [3, 'Complexity: advanced']], S.level, v => { S.level = +v; loadAny(); });
  const typeSel = sel2('chart type', STU_TYPES, S.type, v => { S.type = v; S.manual = false; if (v === '3d' || v === 'surface') { S.n3 = null; S._c3 = 0; } render(); });
  let selX, selY, selZ, selC, selS; const selBox = h('span', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } });
  function fillSelects() {
    selBox.innerHTML = ''; const nums = S.nums.map(c => [c, c]), cats = [['', 'colour: none']].concat(S.cols.map(c => [c, 'colour: ' + c]));
    selX = sel2('x column', nums, S.cx, v => { S.cx = v; S.manual = false; S.n3 = null; render(); }); selY = sel2('y column', nums, S.cy, v => { S.cy = v; S.manual = false; S.n3 = null; render(); }); selZ = sel2('z column', nums, S.cz, v => { S.cz = v; S.n3 = null; render(); });
    selC = sel2('colour by', cats, S.cc, v => { S.cc = v; render(); }); selS = sel2('size by (bubble)', nums, S.cs, v => { S.cs = v; render(); });
    selBox.append(h('span', { class: 'muted', style: { fontSize: '12px' } }, 'x'), selX, h('span', { class: 'muted', style: { fontSize: '12px' } }, 'y'), selY, h('span', { class: 'muted', style: { fontSize: '12px' } }, 'z / size'), selZ, selS, selC);
  }
  async function loadAny() { if (S.set.startsWith('big:')) await loadBig(S.set.slice(4)); else loadSyn(); }
  const tb = (t, f, title, cls) => h('button', { class: 'btn sm ' + (cls || ''), type: 'button', title, onclick: f }, t);
  const toolBtns = {}; const toolRow = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } });
  [['select', 'Select / move', 'Click a point, shift-click to add, drag to box-select, drag a selected point to move it'], ['pan', 'Pan', 'Drag the background to move the view'], ['add', 'Add point', 'Click on the chart to add a row there'], ['delete', 'Delete on click', 'Click a point to delete it'], ['sketch', 'Sketch', 'Draw a freehand line on the chart']].forEach(([k, t, tt]) => { toolBtns[k] = tb(t, () => { S.tool = k; paintTools(); }, tt); toolRow.append(toolBtns[k]); });
  const paintTools = () => Object.entries(toolBtns).forEach(([k, b]) => b.classList.toggle('primary', S.tool === k));
  const planeSel = sel2('plane to move in (3-D)', [['screen', '3-D move: screen plane'], ['xy', 'move in x-y plane'], ['xz', 'move in x-z plane'], ['yz', 'move in y-z plane']], S.plane, v => { S.plane = v; });
  const ruleIn = h('input', { class: 'input', placeholder: 'select by rule, e.g.  x > 1 and y < 0', style: { minWidth: '210px' }, 'aria-label': 'select rows by a rule' });
  const setCsel = h('select', { class: 'input', 'aria-label': 'column to set' }), setIn = h('input', { class: 'input', placeholder: 'e.g.  y * 1.5 + 2', style: { width: '130px' }, 'aria-label': 'new value expression' });
  const ovSel = sel2('overlay', [['none', 'overlay: none'], ['fit', 'regression line / plane'], ['kmeans', 'k-means']], S.overlay, v => { S.overlay = v; render(); }), kIn = h('input', { class: 'input', type: 'number', min: 2, max: 8, value: S.k, style: { width: '56px' }, title: 'k for k-means', onchange: e => { S.k = +e.target.value || 3; render(); } });
  const binIn = h('input', { type: 'range', min: 4, max: 40, value: S.bins, title: 'bins', style: { width: '90px' }, oninput: e => { S.bins = +e.target.value; render(); } });
  const stepIn = h('input', { class: 'input', type: 'number', step: 'any', value: S.step, style: { width: '70px' }, title: 'arrow-key step', onchange: e => { S.step = +e.target.value || .1; } });
  const spinBtn = tb('Spin', () => { spinning = !spinning; if (p3) p3.spin(spinning); spinBtn.textContent = spinning ? 'Stop' : 'Spin'; }, 'Rotate the 3-D chart automatically'); let spinning = false;
  const zoom = f => { if (S.type === '3d' || S.type === 'surface') { ensure3d(); p3.zoomBy(f); } else if (S.V) { const cx = (S.V.x0 + S.V.x1) / 2, cy = (S.V.y0 + S.V.y1) / 2; S.V = { x0: cx + (S.V.x0 - cx) / f, x1: cx + (S.V.x1 - cx) / f, y0: cy + (S.V.y0 - cy) / f, y1: cy + (S.V.y1 - cy) / f }; S.manual = true; draw2d(); readoutZoom(); } };
  function focusSel() {
    const rows = S.sel.size ? sel() : S.rows; if (!rows.length) return;
    if (S.type === '3d' || S.type === 'surface') { ensure3d(); if (!S.n3) fit3(); const c = [0, 1, 2].map(i => rows.reduce((s, r) => s + nz(i, r[[S.cx, S.cy, S.cz][i]]), 0) / rows.length); p3.focus(c, 1.75); const spread = Math.max(.15, ...rows.map(r => Math.hypot(...P3(r).map((v, i) => v - c[i])))); p3.resetZoom(); p3.zoomBy(Math.min(8, 1.2 / spread)); }
    else { const xs = rows.map(r => r[S.cx]), ys = rows.map(r => r[S.cy]), px0 = Math.min(...xs), px1 = Math.max(...xs), py0 = Math.min(...ys), py1 = Math.max(...ys), mx = (px1 - px0) * .25 || 1, my = (py1 - py0) * .25 || 1; S.V = { x0: px0 - mx, x1: px1 + mx, y0: py0 - my, y1: py1 + my }; S.manual = true; draw2d(); readoutZoom(); }
  }
  const fitBtn = () => { if (S.type === '3d' || S.type === 'surface') { S.n3 = null; fit3(); draw3d(); } else { S.manual = false; render(); } };
  const bar1 = h('div', { class: 'row stu-bar' }, dsSel, lvSel, tb('New data', () => { S.nonce++; loadAny(); }, 'Generate a different data set of the same kind'), typeSel, selBox, ovSel, kIn, h('label', { class: 'muted', style: { fontSize: '12px' } }, 'bins ', binIn), status);
  const bar2 = h('div', { class: 'row stu-bar' }, toolRow, planeSel, tb('Zoom +', () => zoom(1.4), 'Zoom in (or use the mouse wheel)'), tb('Zoom -', () => zoom(1 / 1.4), 'Zoom out'), tb('Fit', fitBtn, 'Show everything'), tb('Centre on selection', focusSel, 'Zoom in on the selected points, or the middle of the whole cloud'), zoomLbl, spinBtn);
  const bar3 = h('div', { class: 'row stu-bar' }, tb('Select all', () => setSel(S.rows.map(r => r.id)), ''), tb('None', () => setSel([]), ''), tb('Invert', () => setSel(S.rows.filter(r => !S.sel.has(r.id)).map(r => r.id)), ''), ruleIn, tb('Select', () => { const ids = rule(ruleIn.value); if (ids) setSel(ids); toast(ids ? ids.length + ' rows match.' : ''); }, 'Select every row that matches the rule'),
    h('span', { class: 'grow' }), tb('Delete', del, 'Delete the selected rows from your copy (Delete key)'), tb('Duplicate', dup, 'Copy the selected rows'), tb('Undo', undo, 'Ctrl+Z'), tb('Redo', redo, 'Ctrl+Y'), tb('Reset to original', resetData, 'The original data is never changed: this brings the copy back to it', 'ghost'));
  const bar4 = h('div', { class: 'row stu-bar' }, h('span', { class: 'muted', style: { fontSize: '12px' } }, 'set selected'), setCsel, h('span', {}, '='), setIn, tb('Apply', () => setCol(setCsel.value, setIn.value), 'Change a column of the selected rows with an expression'), h('span', { class: 'muted', style: { fontSize: '12px', marginLeft: '10px' } }, 'arrow keys move the selection by'), stepIn, readout);

  /* ---------------- tabs: table, objects, code ---------------- */
  const tabBar = h('div', { class: 'row' }), tabBody = h('div', { class: 'stu-tab' }), tabs = {};
  [['table', 'Data table'], ['objects', 'Curves, lines, vectors, shapes'], ['code', 'Code and output']].forEach(([k, t]) => { tabs[k] = h('button', { class: 'btn sm', type: 'button', onclick: () => { S.tab = k; renderTab(); } }, t); tabBar.append(tabs[k]); });
  const statsEl = h('div', { class: 'stu-stats mono' });
  function renderTab() { Object.entries(tabs).forEach(([k, b]) => b.classList.toggle('primary', S.tab === k)); if (S.tab === 'table') tableTab(); else if (S.tab === 'objects') objectsTab(); else codeTab(); }
  function tableTab() {
    const per = 12, rows = S.showSel ? sel() : S.rows, pages = Math.max(1, Math.ceil(rows.length / per)); S.page = Math.min(S.page, pages - 1); const slice = rows.slice(S.page * per, S.page * per + per);
    const tbl = h('table', { class: 't stu-tbl' }, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'id'), S.cols.map(c => h('th', {}, c)))), h('tbody', {}, slice.map(r => h('tr', { class: S.sel.has(r.id) ? 'on' : '', onclick: e => { if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return; toggle(r.id, e.ctrlKey || e.metaKey || e.shiftKey || e.target.type === 'checkbox'); render(); } },
      h('td', {}, h('input', { type: 'checkbox', checked: S.sel.has(r.id) })), h('td', { class: 'muted' }, String(r.id)), S.cols.map(c => S.nums.includes(c) ? h('td', {}, h('input', { class: 'cell', type: 'number', step: 'any', value: stuN(r[c]), onchange: e => { push(); r[c] = +e.target.value; render(); } })) : h('td', {}, String(r[c])))))));
    const onlySel = h('input', { type: 'checkbox' }); onlySel.checked = !!S.showSel; onlySel.addEventListener('change', () => { S.showSel = onlySel.checked; S.page = 0; tableTab(); });
    tabBody.innerHTML = ''; tabBody.append(h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('span', { class: 'chip' }, S.rows.length + ' rows'), h('span', { class: 'chip ' + (S.sel.size ? 'brand' : '') }, S.sel.size + ' selected'), h('label', { class: 'sw' }, onlySel, 'show only selected'), h('span', { class: 'grow' }), tb('◀', () => { S.page = Math.max(0, S.page - 1); tableTab(); }, ''), h('span', { class: 'muted' }, (S.page + 1) + ' / ' + pages), tb('▶', () => { S.page = Math.min(pages - 1, S.page + 1); tableTab(); }, ''), tb('+ Add row', () => addAt({}), 'Add a row at the origin, then drag it')), h('div', { class: 'tscroll' }, tbl), h('p', { class: 'muted', style: { fontSize: '12px', margin: '4px 0 0' } }, 'Click a row to select it (ctrl / shift for several). Edit a number in place. Everything here is a copy: "Reset to original" restores the data.'));
  }
  function addObj(kind) {
    push(); const V = S.V || { x0: -4, x1: 4, y0: -4, y1: 4 }, cx = (V.x0 + V.x1) / 2, cy = (V.y0 + V.y1) / 2, sx0 = (V.x1 - V.x0) / 4, sy0 = (V.y1 - V.y0) / 4, col = STU_COL[(S.objs.length + 1) % 10];
    const o = { kind, color: col, fresh: true };
    if (kind === 'line') o.p = [[cx - sx0, cy - sy0, 0], [cx + sx0, cy + sy0, 0]]; else if (kind === 'vector') o.p = [[0, 0, 0], [cx + sx0, cy + sy0, 0]]; else if (kind === 'bezier') o.p = [[cx - sx0 * 1.5, cy, 0], [cx - sx0, cy + sy0 * 1.5, 0], [cx + sx0, cy - sy0 * 1.5, 0], [cx + sx0 * 1.5, cy, 0]]; else if (kind === 'poly') o.p = [[cx - sx0, cy - sy0, 0], [cx + sx0, cy - sy0, 0], [cx, cy + sy0, 0]];
    S.objs.push(o); render(); setTimeout(() => { o.fresh = false; }, 1500);
  }
  function addFunc(expr, three) {
    try { const e = String(expr).trim(), vars = three ? ['x', 'y'] : ['x'], ps = stuParams(e), fn = stuCompile(e, vars.concat(ps)), f = { kind: three ? 'surf' : 'func', expr: e, params: ps, vals: ps.map(() => 1), fn: (...a) => fn(...a), color: STU_COL[(S.funcs.length + 3) % 10], fresh: true }; f.vals = ps.map(p => ({ a: 1, b: 1, c: 0, d: 0, e: 0 }[p.toLowerCase()] ?? 1)); S.funcs.push(f); if (three && S.type !== 'surface') { typeSel.value = S.type = 'surface'; S.n3 = null; S._c3 = 0; } render(); setTimeout(() => { f.fresh = false; }, 1500); } catch (e) { toast(e.message); }
  }
  function objectsTab() {
    const fIn = h('input', { class: 'input', value: 'a * sin(b * x) + c', style: { minWidth: '200px' }, 'aria-label': 'function of x' }), sIn = h('input', { class: 'input', value: 'a * x + b * y + c', style: { minWidth: '200px' }, 'aria-label': 'function of x and y' });
    const list = h('div', { class: 'stack' });
    S.funcs.forEach((f, i) => list.append(h('div', { class: 'card pad stu-obj' }, h('div', { class: 'row' }, h('span', { class: 'chip', style: { background: f.color, color: '#fff' } }, f.kind === 'surf' ? 'z = f(x, y)' : 'y = f(x)'), h('code', {}, f.expr), h('span', { class: 'grow' }), tb('Remove', () => { push(); S.funcs.splice(i, 1); render(); }, '', 'ghost')),
      h('div', { class: 'row', style: { flexWrap: 'wrap' } }, f.params.map((p, k) => h('label', { class: 'sw' }, p + ' = ', h('input', { type: 'range', min: -5, max: 5, step: .05, value: f.vals[k], oninput: e => { f.vals[k] = +e.target.value; e.target.nextSibling.textContent = f.vals[k].toFixed(2); drawAll(true); updateCode(); } }), h('b', {}, f.vals[k].toFixed(2))))))));
    S.objs.forEach((o, i) => { const P = o.p; let info = ''; if (o.kind === 'line') { const m = (P[1][1] - P[0][1]) / ((P[1][0] - P[0][0]) || 1e-9); info = `slope ${m.toFixed(3)}, intercept ${(P[0][1] - m * P[0][0]).toFixed(3)}: y = ${m.toFixed(2)}x ${(P[0][1] - m * P[0][0]) < 0 ? '-' : '+'} ${Math.abs(P[0][1] - m * P[0][0]).toFixed(2)}`; } else if (o.kind === 'vector') { const v = P[1].map((c, k) => c - P[0][k]), len = Math.hypot(...v); info = `v = (${v.map(c => c.toFixed(2)).join(', ')}), length ${len.toFixed(3)}, angle ${(Math.atan2(v[1], v[0]) * 57.2958).toFixed(1)} deg`; const prev = S.objs.slice(0, i).filter(q => q.kind === 'vector').pop(); if (prev) { const u = prev.p[1].map((c, k) => c - prev.p[0][k]); info += `; dot with the previous = ${v.reduce((s, c, k) => s + c * u[k], 0).toFixed(3)}`; } } else if (o.kind === 'poly') { let a = 0, per = 0; P.forEach((p, k) => { const q = P[(k + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; per += Math.hypot(q[0] - p[0], q[1] - p[1]); }); info = `area ${Math.abs(a / 2).toFixed(3)}, perimeter ${per.toFixed(3)}`; } else if (o.kind === 'bezier') info = 'cubic Bezier: drag the four white handles'; else info = P.length + ' sketched points';
      list.append(h('div', { class: 'card pad stu-obj' }, h('div', { class: 'row' }, h('span', { class: 'chip', style: { background: o.color, color: '#fff' } }, o.kind), h('span', { class: 'muted', style: { fontSize: '13px' } }, info), h('span', { class: 'grow' }), tb('Remove', () => { push(); S.objs.splice(i, 1); render(); }, '', 'ghost')))); });
    tabBody.innerHTML = ''; tabBody.append(h('div', { class: 'stack' }, h('p', { class: 'muted', style: { margin: 0, fontSize: '13px' } }, 'Everything below is draggable on the chart (white handles). Vectors and shapes live in 3-D too: switch to the 3-D scatter or surface and drag the handles in any plane.'),
      h('div', { class: 'row', style: { flexWrap: 'wrap' } }, tb('+ Line', () => addObj('line'), ''), tb('+ Vector', () => addObj('vector'), ''), tb('+ Bezier curve', () => addObj('bezier'), ''), tb('+ Polygon', () => addObj('poly'), ''), tb('Sketch freehand', () => { S.tool = 'sketch'; paintTools(); toast('Drag on the chart to draw.'); }, ''), tb('▶ Replay drawing', replay, 'Redraw every object, line by line')),
      h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('span', { class: 'muted', style: { fontSize: '12px' } }, 'y ='), fIn, tb('+ Curve', () => addFunc(fIn.value, false), 'Plot y = f(x); letters a to e become sliders')),
      h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('span', { class: 'muted', style: { fontSize: '12px' } }, 'z ='), sIn, tb('+ Surface (3-D)', () => addFunc(sIn.value, true), 'Plot z = f(x, y) in the 3-D view')), list));
  }
  function replay() {
    if (S.type === '3d' || S.type === 'surface') { toast('Replay animates the 2-D chart: switch to a scatter, line or area chart.'); return; }
    const els = [...svg.querySelectorAll('path.ob')]; if (!els.length && !S.rows.length) return; let t0 = 0;
    svg.querySelectorAll('circle.pt').forEach((c, i) => c.animate([{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 350, delay: Math.min(900, i * 6), fill: 'backwards' }));
    els.forEach(el => { const L = el.getTotalLength ? el.getTotalLength() : 600; el.animate([{ strokeDasharray: L, strokeDashoffset: L }, { strokeDasharray: L, strokeDashoffset: 0 }], { duration: 900, delay: 400 + t0, fill: 'backwards', easing: 'ease-in-out' }); t0 += 700; });
  }

  /* ---- generated Python ---- */
  const py = v => typeof v === 'number' ? String(stuN(v)) : q(v);
  function genCode() {
    const o = new Map(S.orig.map(r => [r.id, r])), moved = [], dels = S.orig.filter(r => !byId.has(r.id)).map(r => r.id), adds = S.rows.filter(r => !o.has(r.id));
    S.rows.forEach(r => { const b = o.get(r.id); if (b && S.nums.some(c => stuN(b[c]) !== stuN(r[c]))) moved.push(r); });
    let c = 'import numpy as np\nimport pandas as pd\nimport matplotlib.pyplot as plt\n\n# 1) the original data: it is never changed\n';
    if (S.source.kind === 'syn') c += 'import io\nORIGINAL = """\n' + (S.origCsv.split('\n').slice(0, 1 + 60).join('\n')) + (S.orig.length > 60 ? '\n... (' + (S.orig.length - 60) + ' more rows, see the Data table tab)' : '') + '\n"""\ndf = pd.read_csv(io.StringIO(ORIGINAL), index_col="id")\n';
    else c += 'from dsq_data import load\ndf = load(' + q(S.source.id) + ').sample(' + S.source.n + ', random_state=' + S.source.nonce + ')[' + q(S.source.pycols || S.cols) + '].copy()\n';
    c += '\n# 2) your working copy and the edits you made\nwork = df.copy()\n';
    if (moved.length) { const m = moved.slice(0, 20); c += 'work.loc[' + q(m.map(r => r.id)) + ', ' + q(S.nums) + '] = ' + q(m.map(r => S.nums.map(k => stuN(r[k])))) + '   # ' + moved.length + ' moved/edited' + (moved.length > 20 ? ' (first 20 shown)' : '') + '\n'; }
    if (dels.length) c += 'work = work.drop(index=' + q(dels.slice(0, 40)) + ')   # ' + dels.length + ' deleted' + (dels.length > 40 ? ' (first 40 shown)' : '') + '\n';
    if (adds.length) c += 'work = pd.concat([work, pd.DataFrame(' + q(adds.slice(0, 20).map(r => Object.fromEntries(S.cols.map(k => [k, typeof r[k] === 'number' ? stuN(r[k]) : r[k]])))) + ', index=' + q(adds.slice(0, 20).map(r => r.id)) + ')])   # ' + adds.length + ' added\n';
    if (!moved.length && !dels.length && !adds.length) c += '# (no edits yet: drag a point, delete a row or add one and this block rewrites itself)\n';
    c += '\n# 3) the chart\n'; const x = q(S.cx), y = q(S.cy), z = q(S.cz), cc = S.cc && !S.nums.includes(S.cc) ? `, c=work[${q(S.cc)}].astype("category").cat.codes, cmap="tab10"` : '';
    const t = S.type, cat = S.cc && !S.nums.includes(S.cc) ? S.cc : S.cat;
    if (t === '3d' || t === 'surface') c += `fig = plt.figure(figsize=(7, 5.2))\nax = fig.add_subplot(projection="3d")\n` + (t === '3d' ? `ax.scatter(work[${x}], work[${y}], work[${z}]${cc}, s=14)\n` : '') + `ax.set_xlabel(${x}); ax.set_ylabel(${y}); ax.set_zlabel(${z})\n`;
    else if (t === 'polar') c += `fig = plt.figure(figsize=(6, 6))\nax = fig.add_subplot(projection="polar")\nth = 2 * np.pi * (work[${x}] - work[${x}].min()) / (work[${x}].max() - work[${x}].min())\nax.scatter(th, work[${y}]${cc}, s=14)\n`;
    else if (t === 'radar') c += `means = work.groupby(${q(cat)})[${q(S.nums)}].mean()\nangles = np.linspace(0, 2 * np.pi, len(means.columns), endpoint=False)\nfig = plt.figure(figsize=(6, 6)); ax = fig.add_subplot(projection="polar")\nfor name, row in means.iterrows():\n    ax.plot(np.append(angles, angles[0]), np.append(row.values, row.values[0]), label=name)\nax.set_xticks(angles); ax.set_xticklabels(means.columns); ax.legend()\n`;
    else if (t === 'corr') c += `fig, ax = plt.subplots(figsize=(6, 5))\ncorr = work[${q(S.nums)}].corr()\nim = ax.imshow(corr, cmap="coolwarm", vmin=-1, vmax=1)\nax.set_xticks(range(len(corr))); ax.set_xticklabels(corr.columns); ax.set_yticks(range(len(corr))); ax.set_yticklabels(corr.columns)\nfig.colorbar(im)\n`;
    else if (t === 'pie') c += `fig, ax = plt.subplots(figsize=(6, 5))\nwork[${q(cat)}].value_counts().plot.pie(ax=ax, autopct="%1.0f%%")\n`;
    else if (t === 'bar') c += `fig, ax = plt.subplots(figsize=(7, 4.5))\nwork.groupby(${q(cat)})[${y}].mean().plot.bar(ax=ax)\nax.set_ylabel("mean of " + ${y})\n`;
    else if (t === 'box') c += `fig, ax = plt.subplots(figsize=(7, 4.5))\nwork.boxplot(column=${y}, by=${q(cat)}, ax=ax)\n`;
    else if (t === 'hist') c += `fig, ax = plt.subplots(figsize=(7, 4.5))\nax.hist(work[${x}], bins=${S.bins})\nax.set_xlabel(${x})\n`;
    else if (t === 'heat') c += `fig, ax = plt.subplots(figsize=(7, 4.5))\nh = ax.hist2d(work[${x}], work[${y}], bins=${S.bins}, cmap="viridis")\nfig.colorbar(h[3])\n`;
    else if (t === 'line' || t === 'area') c += `fig, ax = plt.subplots(figsize=(7, 4.5))\nd = work.sort_values(${x})\nax.plot(d[${x}], d[${y}])\n` + (t === 'area' ? `ax.fill_between(d[${x}], d[${y}], alpha=.2)\n` : '') + `ax.scatter(work[${x}], work[${y}], s=10)\n`;
    else c += `fig, ax = plt.subplots(figsize=(7, 4.5))\nax.scatter(work[${x}], work[${y}]${cc}, ` + (t === 'bubble' ? `s=20 + 120 * (work[${q(S.cs)}] - work[${q(S.cs)}].min()) / (work[${q(S.cs)}].max() - work[${q(S.cs)}].min()), alpha=.6` : 's=16') + `)\nax.set_xlabel(${x}); ax.set_ylabel(${y})\n`;
    if (!['3d', 'surface', 'polar', 'radar', 'corr', 'pie', 'bar', 'box', 'hist', 'heat'].includes(t)) {
      if (S.funcs.some(f => f.kind === 'func')) c += `xs = np.linspace(${stuN(S.V ? S.V.x0 : -5)}, ${stuN(S.V ? S.V.x1 : 5)}, 300)\n`;
      S.funcs.filter(f => f.kind === 'func').forEach(f => { c += f.params.map((p, k) => `${p} = ${f.vals[k].toFixed(2)}`).join('; ') + (f.params.length ? '\n' : '') + `ax.plot(xs, ${stuPyExpr(f.expr).replace(/\bx\b/g, 'xs')}, label=${q('y = ' + f.expr)})\n`; });
      S.objs.forEach(ob => { const P = ob.p; if (ob.kind === 'line') c += `ax.axline((${stuN(P[0][0])}, ${stuN(P[0][1])}), (${stuN(P[1][0])}, ${stuN(P[1][1])}), color=${q(ob.color)})\n`; else if (ob.kind === 'vector') c += `ax.annotate("", xy=(${stuN(P[1][0])}, ${stuN(P[1][1])}), xytext=(${stuN(P[0][0])}, ${stuN(P[0][1])}), arrowprops=dict(arrowstyle="->", color=${q(ob.color)}, lw=2))\n`; else if (ob.kind === 'poly') c += `ax.fill(${q(P.map(p => stuN(p[0])))}, ${q(P.map(p => stuN(p[1])))}, alpha=.15, edgecolor=${q(ob.color)})\n`; else if (ob.kind === 'bezier') c += `t = np.linspace(0, 1, 80)[:, None]; P = np.array(${q(P.map(p => [stuN(p[0]), stuN(p[1])]))})\ncurve = (1-t)**3 * P[0] + 3*(1-t)**2*t * P[1] + 3*(1-t)*t**2 * P[2] + t**3 * P[3]\nax.plot(curve[:, 0], curve[:, 1], color=${q(ob.color)})\n`; else if (ob.kind === 'free') c += `ax.plot(${q(P.filter((_, k) => k % Math.max(1, Math.floor(P.length / 40)) === 0).map(p => stuN(p[0])))}, ${q(P.filter((_, k) => k % Math.max(1, Math.floor(P.length / 40)) === 0).map(p => stuN(p[1])))}, color=${q(ob.color)})\n`; });
    }
    if (t === '3d' || t === 'surface') { S.objs.forEach(ob => { const P = ob.p; if (ob.kind === 'vector') c += `ax.quiver(${P[0].map(stuN).join(', ')}, ${P[1].map((v, k) => stuN(v - P[0][k])).join(', ')}, color=${q(ob.color)})\n`; else if (ob.kind === 'line') c += `ax.plot(${q(P.map(p => stuN(p[0])))}, ${q(P.map(p => stuN(p[1])))}, ${q(P.map(p => stuN(p[2] || 0)))}, color=${q(ob.color)})\n`; }); S.funcs.filter(f => f.kind === 'surf').forEach(f => { c += f.params.map((p, k) => `${p} = ${f.vals[k].toFixed(2)}`).join('; ') + (f.params.length ? '\n' : '') + `X, Y = np.meshgrid(np.linspace(${stuN(S.n3 ? S.n3.lo[0] : -4)}, ${stuN(S.n3 ? S.n3.hi[0] : 4)}, 30), np.linspace(${stuN(S.n3 ? S.n3.lo[1] : -4)}, ${stuN(S.n3 ? S.n3.hi[1] : 4)}, 30))\nax.plot_surface(X, Y, ${stuPyExpr(f.expr).replace(/\bx\b/g, 'X').replace(/\by\b/g, 'Y')}, alpha=.5)\n`; }); }
    c += 'plt.tight_layout()\n\n# 4) numbers that follow your edits\nprint(len(work), "rows")\nprint(work[' + q(S.nums) + '].describe().round(2))\n';
    if (S.overlay === 'fit' && !['3d', 'surface'].includes(t)) c += `m, b = np.polyfit(work[${x}], work[${y}], 1)\nprint("y = %.3f x + %.3f" % (m, b))\n`;
    return c;
  }
  const codeEl = h('pre', { class: 'codeblock stu-code' }), outEl = h('div', { class: 'outpane' });
  function updateCode() { if (S.tab !== 'code') return; codeEl.innerHTML = hlPy(genCode()); }
  function codeTab() {
    const runBtn = h('button', { class: 'btn primary', type: 'button', onclick: async () => { runBtn.disabled = true; outEl.innerHTML = '<pre class="muted">Running your code...</pre>'; const files = await BIG.files(); const r = await Py.run({ code: genCode(), files, timeout: 120000 }); runBtn.disabled = false; outEl.innerHTML = ''; if (r.stdout) outEl.append(h('pre', {}, r.stdout)); if (r.error) outEl.append(h('pre', { class: 'err' }, fmtErr(r.error))); (r.figs || []).forEach(b => outEl.append(h('img', { src: 'data:image/png;base64,' + b, alt: 'figure drawn by the code', style: { maxWidth: '100%', background: '#fff', borderRadius: '8px' } }))); } }, '▶ Run this code');
    tabBody.innerHTML = ''; tabBody.append(h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('b', {}, 'The code for what you see'), h('span', { class: 'muted', style: { fontSize: '13px' } }, 'It rewrites itself after every change.'), h('span', { class: 'grow' }), runBtn, tb('Copy', () => { navigator.clipboard && navigator.clipboard.writeText(genCode()); toast('Copied'); }, ''), tb('Open in a notebook', () => { const nb = NB.create('Graph Studio: ' + (S.cur || 'my chart'), [{ k: 'md', s: '# From the Graph Studio\nThis is the code for the chart and the edits you made.' }, { k: 'code', s: genCode() }]); location.hash = '#/notebook/' + nb.id; }, '')), codeEl, outEl);
    updateCode();
  }

  /* ---------------- stats (live) ---------------- */
  function stats() {
    const n = S.rows.length, mean = c => S.rows.reduce((s, r) => s + r[c], 0) / (n || 1), sd = c => { const m = mean(c); return Math.sqrt(S.rows.reduce((s, r) => s + (r[c] - m) ** 2, 0) / (n || 1)); };
    const parts = [`${n} rows (${S.sel.size} selected)  |  ` + S.nums.slice(0, 4).map(c => `${c}: mean ${stuF(mean(c))}, sd ${stuF(sd(c))}`).join('   ')];
    if (S.nums.length > 1) { const f = linfit(S.rows, S.cx, S.cy); parts.push(`corr(${S.cx}, ${S.cy}) = ${corr(S.rows, S.cx, S.cy).toFixed(3)}` + (f ? `   fit: ${S.cy} = ${f.m.toFixed(3)} ${S.cx} ${f.b < 0 ? '-' : '+'} ${Math.abs(f.b).toFixed(3)}   R2 = ${f.r2.toFixed(3)}` : '')); }
    statsEl.innerHTML = parts.map(esc).join('<br>');
  }

  /* ---------------- render ---------------- */
  function drawAll(light) { const t3 = S.type === '3d' || S.type === 'surface'; svg.style.display = t3 ? 'none' : ''; cv3.hidden = !t3; if (t3) draw3d(); else draw2d(); stats(); if (S.tab === 'code') updateCode(); else if (S.tab === 'table' && !light) tableTab(); }
  function render(light) { drawAll(light); if (!light && S.tab === 'objects') objectsTab(); else if (!light && S.tab === 'table') tableTab(); if (setCsel) { const cur = setCsel.value; setCsel.innerHTML = ''; S.nums.forEach(c => setCsel.append(h('option', { value: c }, c))); if (S.nums.includes(cur)) setCsel.value = cur; } }

  addEventListener('keydown', e => {
    if (!root.isConnected) return; const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const k = e.key; if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); del(); } else if (k === 'Escape') setSel([]); else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); undo(); } else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'y') { e.preventDefault(); redo(); } else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'a') { e.preventDefault(); setSel(S.rows.map(r => r.id)); }
    else if (k.startsWith('Arrow') && S.sel.size) { e.preventDefault(); const t3 = S.type === '3d' || S.type === 'surface', d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[k]; if (t3 && e.shiftKey) nudge(0, 0, d[1]); else nudge(d[0], d[1], 0); }
  });
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Graph Studio'), h('h1', {}, 'Touch the data in any chart'),
    h('p', { class: 'muted lead' }, 'Pick a data set and how complex it is, then a chart. Select rows from the table, with a rule, or right in the chart (click, shift-click, drag a box; in 3-D hold Ctrl and drag). Move, add, delete or edit them: you are always working on a copy, and the original is one click away. Zoom with the wheel. The code and the numbers below rewrite themselves.'))),
    h('div', { class: 'card pad stack' }, bar1, bar2, bar3, bar4, stage, h('div', { class: 'muted', style: { fontSize: '12px' } }, '2-D: wheel = zoom, drag background = box select, Pan tool or middle button = move the view. 3-D: drag = rotate, wheel = zoom, shift-drag = pan, Ctrl-drag = box select, drag a point = move it in the chosen plane. Delete key = delete, arrows = nudge, Ctrl+Z = undo.'), statsEl),
    h('div', { class: 'card pad stack' }, tabBar, tabBody));
  fillSelects(); paintTools();
  loadAny().then(() => renderTab());
  root._destroy = () => { if (p3) p3.destroy(); };
  App.dis.push(() => root._destroy());
  return root;
}
