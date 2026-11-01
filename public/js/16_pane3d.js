'use strict';
/* =====================================================================
   The 3-D data pane: look at three columns of a DataFrame in the notebook as a rotatable 3-D cloud,
   - move points by hand (drag a point, or type exact x / y / z) and write the edits back into the DataFrame,
   - change the data with code (clean, scale, clip, filter, drop) and press Refresh (or "Follow my code") to see what the code did:
     grey lines show how far each row moved, red crosses mark rows your code removed,
   - run k-means, a regression plane or PCA axes on the three columns and see them in the cloud.
   The pane reads the DataFrame through public/dsq_pane.py inside the notebook's own Python session.
   ===================================================================== */
function pane3D(o = {}) {
  const W = 760, H = 460, PAL = ['#2F6FE0', '#D2600F', '#1E8E5A', '#7A4FD0', '#0E8FA3', '#B8860B', '#C2418A', '#6B7280', '#9C3D2E', '#3A8F6F', '#5B5FD0', '#A0A030'];
  const S = { cols: [null, null, null], pts: [], gone: [], lo: [0, 0, 0], hi: [1, 1, 1], sel: -1, ids: null, edits: new Map(), colorKind: 'none', cats: [], ov: null, hov: -1, info: null, total: 0 };
  const root = h('div', { class: 'card pad stack p3d' }), cvHost = h('div', { class: 'p3d-cv' }), msg = h('div', { class: 'muted', style: { fontSize: '13px', minHeight: '1.3em' } }, 'Run a cell that creates a DataFrame (for example df = load(...)), then press Load.');
  const varIn = h('input', { class: 'input', value: 'df', size: 8, 'aria-label': 'DataFrame variable name', title: 'The name of the DataFrame variable in your notebook' });
  const sel = (label, cls) => { const s = h('select', { class: 'input', 'aria-label': label }); return s; };
  const sx = sel('x column'), sy = sel('y column'), sz = sel('z column'), sc = sel('colour by'), so = sel('overlay');
  const nIn = h('input', { class: 'input', type: 'number', value: 1500, min: 100, max: 5000, step: 100, style: { width: '84px' }, 'aria-label': 'sample size' });
  const kIn = h('input', { class: 'input', type: 'number', value: 3, min: 2, max: 8, style: { width: '56px' }, 'aria-label': 'k for k-means' });
  [['none', 'overlay: none'], ['kmeans', 'k-means centres'], ['plane', 'regression plane (z from x, y)'], ['pca', 'PCA axes']].forEach(([v, t]) => so.append(h('option', { value: v }, t)));
  const follow = h('input', { type: 'checkbox' }); follow.checked = true;
  const legend = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } }), readout = h('div', { class: 'mono', style: { fontSize: '12px', minHeight: '1.4em' } });
  const ex = h('input', { class: 'input', type: 'number', step: 'any', style: { width: '110px' } }), ey = h('input', { class: 'input', type: 'number', step: 'any', style: { width: '110px' } }), ez = h('input', { class: 'input', type: 'number', step: 'any', style: { width: '110px' } });
  const applyBtn = h('button', { class: 'btn primary sm', type: 'button', disabled: true, onclick: () => applyEdits() }, 'Apply 0 edits to the DataFrame'), discardBtn = h('button', { class: 'btn sm', type: 'button', disabled: true, onclick: () => discard() }, 'Discard edits');
  const p3 = Plot3D(cvHost, { w: W, h: H, az: .75, el: .45, wheel: true, label: '3-D view of your DataFrame. Drag empty space to rotate, drag a point to move it.' });
  const varName = () => { const v = varIn.value.trim(); if (!/^[A-Za-z_]\w*$/.test(v)) throw new Error('Variable name must be a plain Python name, like df'); return v; };
  const q = s => JSON.stringify(s);
  async function py(expr, v) {
    const r = await Py.cell('import json\nimport dsq_pane as _dp\nprint(' + expr + ')', 180000);
    if (r.error) { const m = r.error.type === 'NameError' ? 'There is no variable called ' + (v || 'df') + ' yet. Run the cell that creates it first.' : r.error.type + ': ' + r.error.msg; throw new Error(m); }
    try { return JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch (e) { throw new Error('Unexpected answer from Python: ' + (r.stdout || '').slice(0, 120)); }
  }
  const nrm = (i, v) => (v - S.lo[i]) / ((S.hi[i] - S.lo[i]) || 1) * 2 - 1, real = (i, n) => S.lo[i] + (n + 1) / 2 * ((S.hi[i] - S.lo[i]) || 1);
  const fmt = v => { const a = Math.abs(v); return a >= 1e5 ? v.toExponential(1) : a >= 100 ? String(Math.round(v)) : a >= 1 ? String(+v.toFixed(2)) : String(+v.toPrecision(2)); };
  const colorOf = p => { if (S.colorKind === 'none' || p.c == null) return '#2F6FE0'; if (S.colorKind === 'num') { const t = clamp((p.c - S.cmin) / ((S.cmax - S.cmin) || 1), 0, 1); return `hsl(${230 - 200 * t},70%,50%)`; } return PAL[S.cats.indexOf(p.c) % PAL.length]; };

  function items() {
    const it = [], E = '#8A958F';
    const c = [-1, 1]; for (const a of c) for (const b of c) { it.push({ t: 'line', a: [-1, a, b], b: [1, a, b], color: E, w: .8 }, { t: 'line', a: [a, -1, b], b: [a, 1, b], color: E, w: .8 }, { t: 'line', a: [a, b, -1], b: [a, b, 1], color: E, w: .8 }); }
    for (let i = 1; i < 4; i++) { const u = -1 + i * .5; it.push({ t: 'line', a: [u, -1, -1], b: [u, 1, -1], color: E, w: .4, g: true }, { t: 'line', a: [-1, u, -1], b: [1, u, -1], color: E, w: .4, g: true }); }
    [-1, 0, 1].forEach(u => { it.push({ t: 'txt', p: [u, -1.18, -1], s: fmt(real(0, u)), size: 10, mono: true }, { t: 'txt', p: [-1.18, u, -1], s: fmt(real(1, u)), size: 10, mono: true }, { t: 'txt', p: [-1.2, -1.2, u], s: fmt(real(2, u)), size: 10, mono: true }); });
    it.push({ t: 'txt', p: [0, -1.5, -1], s: S.cols[0] || 'x', size: 12, bold: true, color: '#C8323C' }, { t: 'txt', p: [-1.5, 0, -1], s: S.cols[1] || 'y', size: 12, bold: true, color: '#1E8E5A' }, { t: 'txt', p: [-1.45, -1.45, 0], s: S.cols[2] || 'z', size: 12, bold: true, color: '#2F6FE0' });
    S.pts.forEach((p, i) => { const n = [nrm(0, p.v[0]), nrm(1, p.v[1]), nrm(2, p.v[2])], on = [nrm(0, p.o[0]), nrm(1, p.o[1]), nrm(2, p.o[2])]; p.n = n; if (Math.hypot(n[0] - on[0], n[1] - on[1], n[2] - on[2]) > .03) it.push({ t: 'line', a: on, b: n, color: S.edits.has(p.id) ? '#D2600F' : 'rgba(120,130,140,.55)', w: .9 }); });
    S.gone.forEach(g => it.push({ t: 'txt', p: g.n, s: '×', size: 15, bold: true, color: '#C8323C' }));
    S.pts.forEach((p, i) => it.push({ t: 'pt', p: p.n, r: i === S.sel ? 9 : i === S.hov ? 7 : 4.5, color: colorOf(p), ring: i === S.sel ? '#000' : S.edits.has(p.id) ? '#D2600F' : null }));
    if (S.sel >= 0 && S.pts[S.sel]) { const n = S.pts[S.sel].n; it.push({ t: 'line', a: n, b: [n[0], n[1], -1], color: '#C8323C', w: 1, dash: [3, 3] }); }
    const ov = S.ov;
    if (ov && ov.kind === 'kmeans') ov.centers.forEach((c, j) => it.push({ t: 'pt', p: [nrm(0, c[0]), nrm(1, c[1]), nrm(2, c[2])], r: 12, color: PAL[j % PAL.length], ring: '#000' }));
    if (ov && ov.kind === 'plane') { const G = 8; for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const xs = [i, i + 1, i + 1, i].map(k => -1 + 2 * k / G), ys = [j, j, j + 1, j + 1].map(k => -1 + 2 * k / G); it.push({ t: 'poly', pts: xs.map((x, k) => [x, ys[k], clamp(nrm(2, ov.w[0] * real(0, x) + ov.w[1] * real(1, ys[k]) + ov.w[2]), -1.4, 1.4)]), fill: 'rgba(210,96,15,.10)', stroke: 'rgba(210,96,15,.35)', sw: .5 }); } }
    if (ov && ov.kind === 'pca') ov.vecs.forEach((v, j) => { const L = Math.sqrt(Math.max(ov.vals[j], 0)) * 2, a = ov.mu.map((m, t) => m - v[t] * L), b = ov.mu.map((m, t) => m + v[t] * L); it.push({ t: 'line', a: a.map((x, t) => nrm(t, x)), b: b.map((x, t) => nrm(t, x)), color: ['#C8323C', '#1E8E5A', '#7A4FD0'][j], w: 2 }); });
    return it;
  }
  const draw = () => { p3.set(items(), [0, 0, 0], 1.75); p3.draw(1); syncEdit(); };
  function syncEdit() {
    const p = S.sel >= 0 && S.pts[S.sel]; [ex, ey, ez].forEach((e, i) => { e.disabled = !p; if (p && document.activeElement !== e) e.value = +p.v[i].toFixed(4); });
    applyBtn.disabled = discardBtn.disabled = !S.edits.size; applyBtn.textContent = 'Apply ' + S.edits.size + ' edit' + (S.edits.size === 1 ? '' : 's') + ' to the DataFrame';
    readout.textContent = p ? `row ${p.id}:  ${S.cols[0]} = ${fmt(p.v[0])}   ${S.cols[1]} = ${fmt(p.v[1])}   ${S.cols[2]} = ${fmt(p.v[2])}${S.edits.has(p.id) ? '   (edited, not yet applied)' : ''}` : 'Click a point to select it. Drag a point to move it. Drag empty space to rotate.';
  }
  function status(extra) { msg.textContent = (S.pts.length ? `Showing ${BIG.fmt(S.pts.length)} of ${BIG.fmt(S.total)} rows` : '') + (S.gone.length ? `   |   your code removed ${BIG.fmt(S.gone.length)} of the sampled rows (red ×)` : '') + (S.hidden ? `   |   ${S.hidden} sampled rows have a blank in these columns and are not drawn` : '') + (extra ? '   |   ' + extra : ''); }
  function legendDraw() { legend.innerHTML = ''; if (S.colorKind === 'cat') S.cats.forEach((c, i) => legend.append(h('span', { class: 'chip' }, h('i', { class: 'dot', style: { background: PAL[i % PAL.length] } }), String(c)))); else if (S.colorKind === 'num') legend.append(h('span', { class: 'chip' }, 'colour: blue = low, red = high (' + fmt(S.cmin) + ' to ' + fmt(S.cmax) + ')')); }

  async function loadInfo() {
    const v = varName(), inf = await py('_dp.info(' + v + ')', v); S.info = inf;
    const fill = (s, list, pick, none) => { const cur = s.value; s.innerHTML = ''; if (none) s.append(h('option', { value: '' }, 'colour: none')); list.forEach(c => s.append(h('option', { value: c }, c))); s.value = list.includes(cur) ? cur : (pick || (none ? '' : list[0])); };
    const good = inf.numeric.filter(c => !/(^|_)id$|^id$|index/i.test(c)), pool = good.length >= 3 ? good : inf.numeric; fill(sx, inf.numeric, pool[0]); fill(sy, inf.numeric, pool[1]); fill(sz, inf.numeric, pool[2]); fill(sc, inf.color, '', true);
    if (inf.numeric.length < 3) throw new Error('Need at least 3 numeric columns; ' + v + ' has ' + inf.numeric.length + '.');
    if (!inf.unique_index) msg.textContent = 'Note: the index has repeated labels, so hand edits may change more than one row. Use df = df.reset_index(drop=True).';
    return inf;
  }
  async function load(fresh) {
    try {
      if (fresh && S.edits.size && !confirm('You have ' + S.edits.size + ' unapplied edits. Load a new sample and lose them?')) return;
      msg.textContent = 'Reading ' + varIn.value + ' from Python...';
      if (!S.info || fresh === 'info' || !sx.options.length) await loadInfo();
      const v = varName(), cols = [sx.value, sy.value, sz.value], colr = sc.value || null, reuse = !fresh && S.ids && cols.every((c, i) => c === S.cols[i]) && (colr || '') === (S.colorCol || '');
      const r = await py('_dp.sample(' + v + ',' + q(cols[0]) + ',' + q(cols[1]) + ',' + q(cols[2]) + ',' + (colr ? q(colr) : 'None') + ',' + (+nIn.value || 1500) + ',' + (reuse ? q(S.ids) : 'None') + ')', v);
      const prev = new Map(S.pts.map(p => [p.id, p]));
      S.total = r.total; S.hidden = r.hidden_nan;
      if (!reuse) { S.cols = cols; S.colorCol = colr; S.pts = []; S.gone = []; S.edits.clear(); S.sel = -1; S.ov = null; so.value = 'none';
        const ext = i => { const a = r[['x', 'y', 'z'][i]].slice().sort((u, v) => u - v), at = f => a[Math.min(a.length - 1, Math.max(0, Math.floor(f * (a.length - 1))))]; let lo = at(.01), hi = at(.99); if (hi === lo) { lo = a[0]; hi = a[a.length - 1]; } const pad = (hi - lo) * .12 || 1; S.lo[i] = lo - pad; S.hi[i] = hi + pad; }; ext(0); ext(1); ext(2); }
      S.ids = r.ids.slice().concat(reuse ? r.missing : []);
      if (r.c) { S.colorKind = r.c_numeric ? 'num' : 'cat'; if (r.c_numeric) { const f = r.c.filter(x => x != null); S.cmin = Math.min(...f); S.cmax = Math.max(...f); } else S.cats = [...new Set(r.c)].sort(); } else S.colorKind = 'none';
      const nextPts = r.ids.map((id, i) => { const old = prev.get(id), v3 = [r.x[i], r.y[i], r.z[i]]; return { id, v: v3, o: reuse && old ? old.o : v3.slice(), b: v3.slice(), c: r.c ? r.c[i] : null }; });
      if (reuse) { const keep = new Set(r.ids), goneOld = new Map(S.gone.map(g => [g.id, g])); S.gone = r.missing.map(id => { const old = prev.get(id); return goneOld.get(id) || (old ? { id, n: old.n || [nrm(0, old.v[0]), nrm(1, old.v[1]), nrm(2, old.v[2])] } : null); }).filter(Boolean); S.edits = new Map([...S.edits].filter(([id]) => keep.has(id))); }
      S.pts = nextPts; if (S.sel >= S.pts.length) S.sel = -1;
      S.edits.forEach((vals, id) => { const p = S.pts.find(x => x.id === id); if (p) p.v = vals.slice(); });
      legendDraw(); draw(); status(reuse ? 'refreshed from your code' : 'new sample'); if (S.ov) runOverlay(); o.onLoaded && o.onLoaded();
    } catch (e) { msg.textContent = e.message; }
  }
  async function runOverlay() {
    const kind = so.value; if (kind === 'none') { S.ov = null; draw(); return; }
    try { msg.textContent = 'Running ' + kind + ' on ' + S.cols.join(', ') + '...'; const v = varName(), r = await py('_dp.overlay(' + v + ',' + q(S.cols) + ',' + q(kind) + ',' + (+kIn.value || 3) + ')', v); if (r.error) throw new Error(r.error); S.ov = r; draw();
      msg.textContent = kind === 'kmeans' ? `k-means: cluster sizes ${JSON.stringify(r.sizes)}, inertia ${fmt(r.inertia)}` : kind === 'plane' ? `plane: ${S.cols[2]} = ${fmt(r.w[0])} * ${S.cols[0]} + ${fmt(r.w[1])} * ${S.cols[1]} + ${fmt(r.w[2])}   (R2 = ${r.r2.toFixed(3)})` : `PCA: share of variance per axis ${r.vals.map(x => (x / r.vals.reduce((a, b) => a + b, 0) * 100).toFixed(0) + '%').join(' / ')}`;
    } catch (e) { msg.textContent = e.message; }
  }
  async function applyEdits() {
    try { const v = varName(), obj = {}; S.edits.forEach((vals, id) => { obj[id] = vals; });
      const n = await py('_dp.apply(' + v + ',' + q(S.cols[0]) + ',' + q(S.cols[1]) + ',' + q(S.cols[2]) + ',' + JSON.stringify(obj) + ')', v);
      S.pts.forEach(p => { if (S.edits.has(p.id)) p.b = p.v.slice(); }); S.edits.clear(); draw(); status('wrote ' + n + ' row(s) into ' + v + '. Print it in a cell to see the new values'); toast('Edits written into ' + v); o.onApplied && o.onApplied(n);
    } catch (e) { msg.textContent = e.message; }
  }
  function discard() { S.pts.forEach(p => { if (S.edits.has(p.id)) p.v = p.b.slice(); }); S.edits.clear(); draw(); }

  /* hand editing: drag a point in the screen plane, or type exact values */
  const near = (cx, cy, r) => { let best = -1, bd = r; S.pts.forEach((p, i) => { if (!p.n) return; const q2 = p3.proj(p.n), d = Math.hypot(q2[0] - cx, q2[1] - cy); if (d < bd) { bd = d; best = i; } }); return best; };
  p3.grab = (cx, cy) => { const i = near(cx, cy, 11); if (i < 0) return false; S.sel = i; draw(); return true; };
  p3.onGrabMove = (dx, dy) => {
    const p = S.pts[S.sel]; if (!p) return; const { az, el } = p3.view(), s = p3.scale(), ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
    const dx1 = dx / s, dz = -ce * dy / s, dy1 = -se * dy / s, dn = [dx1 * ca + dy1 * sa, -dx1 * sa + dy1 * ca, dz];
    for (let i = 0; i < 3; i++) p.v[i] += dn[i] * ((S.hi[i] - S.lo[i]) / 2); S.edits.set(p.id, p.v.slice()); draw();
  };
  p3.onGrabEnd = () => { const p = S.pts[S.sel]; if (p && S.edits.has(p.id) && p.v.every((v, i) => v === p.b[i])) S.edits.delete(p.id); draw(); status(S.edits.size ? 'edits are only on screen until you press Apply' : ''); };
  p3.onHover = (cx, cy) => { const i = cx == null ? -1 : near(cx, cy, 10); if (i !== S.hov) { S.hov = i; draw(); if (i >= 0) { const p = S.pts[i]; readout.textContent = `row ${p.id}:  ${S.cols[0]} = ${fmt(p.v[0])}   ${S.cols[1]} = ${fmt(p.v[1])}   ${S.cols[2]} = ${fmt(p.v[2])}`; } } };
  [ex, ey, ez].forEach((e, i) => e.addEventListener('change', () => { const p = S.pts[S.sel]; if (!p || e.value === '' || !isFinite(+e.value)) return; p.v[i] = +e.value; S.edits.set(p.id, p.v.slice()); draw(); }));
  [sx, sy, sz, sc].forEach(s => s.addEventListener('change', () => { if (S.ids) load(true); }));
  so.addEventListener('change', runOverlay); kIn.addEventListener('change', () => { if (so.value === 'kmeans') runOverlay(); });
  const zoomRow = [h('button', { class: 'btn sm', type: 'button', title: 'Zoom in (or use the mouse wheel)', onclick: () => p3.zoomBy(1.4) }, 'Zoom +'), h('button', { class: 'btn sm', type: 'button', onclick: () => p3.zoomBy(1 / 1.4) }, 'Zoom -'), h('button', { class: 'btn sm', type: 'button', title: 'Back to the whole cloud', onclick: () => { p3.resetZoom(); p3.focus([0, 0, 0], 1.75); } }, 'Fit')];
  const spinBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { spinning = !spinning; p3.spin(spinning); spinBtn.textContent = spinning ? 'Stop' : 'Spin'; } }, 'Spin'); let spinning = false;
  root.append(h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, h('b', {}, '3-D view of'), varIn, sx, sy, sz, sc, h('label', { class: 'muted', style: { fontSize: '12px' } }, 'sample ', nIn), h('button', { class: 'btn primary sm', type: 'button', onclick: () => load('info') }, 'Load / new sample'), h('button', { class: 'btn sm', type: 'button', title: 'Re-read the same rows after your code changed the table', onclick: () => load(false) }, 'Refresh from code'), h('label', { class: 'sw', title: 'Refresh automatically after every cell you run' }, follow, 'Follow my code')),
    h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, so, h('label', { class: 'muted', style: { fontSize: '12px' } }, 'k ', kIn), spinBtn, ...zoomRow, h('span', { class: 'grow' }), h('span', { class: 'muted', style: { fontSize: '12px' } }, 'selected point:'), ex, ey, ez, applyBtn, discardBtn),
    cvHost, readout, legend, msg);
  draw();
  return { el: root, follow: () => follow.checked && S.ids != null, refresh: () => load(false), load: () => load('info'), destroy: () => p3.destroy(), reset: () => { S.ids = null; S.pts = []; S.gone = []; S.edits.clear(); S.info = null; draw(); msg.textContent = 'Python session restarted. Run the cell that creates your DataFrame, then press Load.'; } };
}
