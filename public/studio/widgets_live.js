'use strict';
/* Live data lab. One dataset, three ways to change it, one picture that follows all of them:
     - drag a point in the graph (double-click empty space adds a point, double-click a point removes it, the mouse wheel over a point changes its weight)
     - type in the table
     - edit the code (x = [...], y = [...], w = [...]); the code is rewritten when you drag
   The fitted line or curve is re-calculated on every change and glides to its new place (it is not redrawn from scratch), so you can watch what a single point does.
   "Weight" is how much a point counts: a weighted fit pulls the line toward heavy points. "Check with real NumPy" runs np.polyfit on the same data and compares. */

/* least squares for y = c0 + c1 x + ... by the normal equations (weights w; all 1 when not weighted). Returns null when the points cannot decide a curve. */
function lfFit(pts, deg, weighted) {
  const n = pts.length; deg = Math.max(0, Math.min(deg, n - 1)); const m = deg + 1, N = Array.from({ length: m }, () => new Array(m + 1).fill(0));
  for (const p of pts) {
    const w = weighted ? p.w : 1, pw = [1]; for (let k = 1; k < 2 * m; k++) pw.push(pw[k - 1] * p.x);
    for (let r = 0; r < m; r++) { for (let c = 0; c < m; c++) N[r][c] += w * pw[r + c]; N[r][m] += w * p.y * pw[r]; }
  }
  const tiny = 1e-9 * (1 + Math.abs(N[0][0]));
  for (let i = 0; i < m; i++) {
    let piv = i; for (let r = i + 1; r < m; r++) if (Math.abs(N[r][i]) > Math.abs(N[piv][i])) piv = r;
    if (Math.abs(N[piv][i]) < tiny) return null;
    [N[i], N[piv]] = [N[piv], N[i]];
    for (let r = i + 1; r < m; r++) { const f = N[r][i] / N[i][i]; for (let c = i; c <= m; c++) N[r][c] -= f * N[i][c]; }
  }
  const c = new Array(m).fill(0); for (let i = m - 1; i >= 0; i--) { let s = N[i][m]; for (let k = i + 1; k < m; k++) s -= N[i][k] * c[k]; c[i] = s / N[i][i]; }
  return { c, deg };
}
const lfEval = (c, x) => { let s = 0; for (let k = c.length - 1; k >= 0; k--) s = s * x + c[k]; return s; };
const lfNum = v => (Math.abs(v) >= 1000 ? String(Math.round(v)) : String(+v.toFixed(3)));
const lfCode = pts => 'x = [' + pts.map(p => +p.x.toFixed(2)).join(', ') + ']\ny = [' + pts.map(p => +p.y.toFixed(2)).join(', ') + ']\nw = [' + pts.map(p => +p.w.toFixed(1)).join(', ') + ']';

WIDGETS.livefit = b => {
  const START = (b.data || [[1, 2.2, 1], [2, 3.1, 1], [3, 3.4, 1], [4, 5.2, 1], [5, 5.1, 1], [6, 6.8, 1], [7, 7.4, 1], [8, 8.1, 1]]).map(r => ({ x: +r[0], y: +r[1], w: r[2] == null ? 1 : +r[2] }));
  let pts = START.map(p => Object.assign({}, p)), sel = -1, target = null, shown = null, raf = 0, last = 0, drag = -1, fitMsg = '';
  const W = 520, H = 340, L = 46, R = 14, T = 12, B = 34, PW = W - L - R, PH = H - T - B;
  const fitSel = control({ type: 'select', label: 'what to fit', options: [['line', 'straight line (least squares)'], ['wline', 'weighted line (heavy points count more)'], ['poly', 'curve (polynomial)']], value: b.mode || 'line' }, onOpt);
  const degC = control({ type: 'range', label: 'curve degree', min: 2, max: 6, step: 1, value: b.deg || 3 }, onOpt);
  const resC = control({ type: 'check', label: 'show the mistakes (sticks)', value: true }, () => draw());
  const sqC = control({ type: 'check', label: 'show the squares of the mistakes', value: false }, () => draw());
  const svgHost = h('div', { class: 'lab-canvas' }), eq = h('div', { class: 'w-eq' }), note = h('div', { class: 'w-note' }), res = h('div', { class: 'w-note' });
  const tbl = h('table', { class: 'lf-tbl' }), codeBox = h('textarea', { class: 'lf-code', spellcheck: 'false', rows: 5, 'aria-label': 'the dataset as code' }), codeMsg = h('div', { class: 'lf-msg' }), py = h('pre', { class: 'lf-py' });
  const mode = () => fitSel.get(), weighted = () => mode() === 'wline', deg = () => (mode() === 'poly' ? +degC.get() : 1);
  const range = () => {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y), x0 = b.xr ? b.xr[0] : 0, x1 = b.xr ? b.xr[1] : 10, y0 = b.yr ? b.yr[0] : 0, y1 = b.yr ? b.yr[1] : 10;
    const lo = (a, d) => Math.min(d, Math.floor(Math.min.apply(null, a) - 1)), hi = (a, d) => Math.max(d, Math.ceil(Math.max.apply(null, a) + 1));
    return { xr: [lo(xs, x0), hi(xs, x1)], yr: [lo(ys, y0), hi(ys, y1)] };
  };
  let RG = range(); const sx = x => L + (x - RG.xr[0]) / (RG.xr[1] - RG.xr[0]) * PW, sy = y => T + PH - (y - RG.yr[0]) / (RG.yr[1] - RG.yr[0]) * PH;
  const rad = p => (weighted() ? 4.5 + 2.6 * Math.sqrt(p.w) : 6.5);
  function retarget() {
    RG = range(); const f = lfFit(pts, deg(), weighted()); fitMsg = f ? '' : (pts.length < 2 ? 'Add at least two points.' : 'These points cannot decide a ' + (deg() > 1 ? 'curve' : 'line') + ' (are all the x values the same?).');
    if (f) { target = f.c; if (!shown) shown = [pts.reduce((s, p) => s + p.y, 0) / pts.length]; } else target = null;
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick(t) {
    raf = 0; if (!svgHost.isConnected && last) return; const dt = Math.min(.05, (t - last) / 1000 || .016); last = t; let moving = false;
    if (target && shown) { const k = 1 - Math.exp(-dt * 11), len = Math.max(shown.length, target.length); for (let i = 0; i < len; i++) { const s = shown[i] || 0, g = target[i] || 0; shown[i] = s + (g - s) * k; if (Math.abs(g - shown[i]) > 1e-4 * (1 + Math.abs(g))) moving = true; else shown[i] = g; } if (!moving) shown = target.slice(); }
    draw(); if (moving) raf = requestAnimationFrame(tick); else last = 0;
  }
  function stats(c) {
    const wt = p => (weighted() ? p.w : 1), sw = pts.reduce((s, p) => s + wt(p), 0) || 1, my = pts.reduce((s, p) => s + wt(p) * p.y, 0) / sw;
    const sse = pts.reduce((s, p) => s + wt(p) * Math.pow(p.y - lfEval(c, p.x), 2), 0), sst = pts.reduce((s, p) => s + wt(p) * Math.pow(p.y - my, 2), 0);
    return { mse: sse / sw, r2: sst > 1e-12 ? 1 - sse / sst : 1 };
  }
  function draw() {
    const g = []; g.push(`<svg viewBox="0 0 ${W} ${H}" class="lf-svg" role="img" aria-label="points and the fitted line; drag a point to change the data"><defs><clipPath id="lfclip"><rect x="${L}" y="${T}" width="${PW}" height="${PH}"/></clipPath></defs><rect x="${L}" y="${T}" width="${PW}" height="${PH}" fill="#fff"/>`);
    const tick = (a, bb) => { const span = bb - a, step = span <= 12 ? 1 : span <= 30 ? 5 : Math.pow(10, Math.floor(Math.log10(span / 5))) * (span / Math.pow(10, Math.floor(Math.log10(span / 5))) <= 10 ? 1 : 2); const o = []; for (let v = Math.ceil(a / step) * step; v <= bb + 1e-9; v += step) o.push(+v.toFixed(6)); return o; };
    tick(RG.xr[0], RG.xr[1]).forEach(v => { g.push(`<line x1="${sx(v)}" y1="${T}" x2="${sx(v)}" y2="${T + PH}" stroke="#eee"/><text x="${sx(v)}" y="${H - 14}" font-size="11" text-anchor="middle" fill="#777">${v}</text>`); });
    tick(RG.yr[0], RG.yr[1]).forEach(v => { g.push(`<line x1="${L}" y1="${sy(v)}" x2="${L + PW}" y2="${sy(v)}" stroke="#eee"/><text x="${L - 6}" y="${sy(v) + 4}" font-size="11" text-anchor="end" fill="#777">${v}</text>`); });
    g.push(`<text x="${L + PW / 2}" y="${H - 1}" font-size="12" text-anchor="middle" fill="#555">${b.xlab || 'x'}</text><text x="12" y="${T + PH / 2}" font-size="12" text-anchor="middle" fill="#555" transform="rotate(-90 12 ${T + PH / 2})">${b.ylab || 'y'}</text>`);
    let st = null;
    if (shown && target) {
      st = stats(shown); const xs = []; for (let i = 0; i <= 140; i++) xs.push(RG.xr[0] + (RG.xr[1] - RG.xr[0]) * i / 140);
      if (sqC.get()) pts.forEach(p => { const yy = lfEval(shown, p.x), a = Math.abs(sy(yy) - sy(p.y)); g.push(`<rect x="${sx(p.x)}" y="${Math.min(sy(p.y), sy(yy))}" width="${a}" height="${a}" class="lf-sq" clip-path="url(#lfclip)"/>`); });
      if (resC.get()) pts.forEach(p => g.push(`<line x1="${sx(p.x)}" y1="${sy(p.y)}" x2="${sx(p.x)}" y2="${sy(lfEval(shown, p.x))}" class="lf-res" clip-path="url(#lfclip)"/>`));
      g.push(`<path d="${xs.map((x, i) => (i ? 'L' : 'M') + sx(x).toFixed(1) + ' ' + sy(lfEval(shown, x)).toFixed(1)).join('')}" class="lf-curve" clip-path="url(#lfclip)"/>`);
    }
    pts.forEach((p, i) => g.push(`<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="${rad(p)}" class="lf-pt${i === sel ? ' sel' : ''}${p.fresh ? ' new' : ''}" data-i="${i}"><title>x = ${lfNum(p.x)}, y = ${lfNum(p.y)}, weight ${lfNum(p.w)}</title></circle>`));
    g.push('</svg>'); svgHost.innerHTML = g.join('');
    if (shown && target) {
      const c = shown, nm = (v, k) => (k === 0 ? lfNum(v) : (v < 0 ? '- ' : '+ ') + lfNum(Math.abs(v)) + '·x' + (k > 1 ? '^' + k : ''));
      eq.innerHTML = `<b>y = ${c.length === 2 ? lfNum(c[1]) + '·x ' + (c[0] < 0 ? '- ' : '+ ') + lfNum(Math.abs(c[0])) : c.map((v, k) => nm(v, k)).join(' ')}</b> &nbsp; ${weighted() ? 'weighted ' : ''}mistake (MSE) <b>${st.mse.toFixed(3)}</b> &nbsp; R² <b>${st.r2.toFixed(3)}</b>`;
    } else eq.innerHTML = fitMsg || 'Nothing fitted yet.';
  }
  const rows = () => { while (tbl.rows.length) tbl.deleteRow(0); const hd = tbl.insertRow(); ['#', 'x', 'y', 'weight', ''].forEach(t => hd.append(h('th', {}, t)));
    pts.forEach((p, i) => { const r = tbl.insertRow(), inp = k => { const el = h('input', { type: 'number', step: k === 'w' ? '0.5' : '0.1', value: String(+p[k].toFixed(2)), 'aria-label': k + ' of point ' + (i + 1), disabled: k === 'w' && !weighted() }); el.dataset.k = k; el.dataset.i = i; el.oninput = () => { const v = parseFloat(el.value); if (isNaN(v)) return; p[k] = k === 'w' ? Math.max(.1, v) : v; changed('table'); }; el.onfocus = () => { sel = i; draw(); }; return el; };
      r.insertCell().textContent = i + 1; r.insertCell().append(inp('x')); r.insertCell().append(inp('y')); r.insertCell().append(inp('w')); r.insertCell().append(h('button', { class: 'btn ghost sm', type: 'button', title: 'remove this point', 'aria-label': 'remove point ' + (i + 1), disabled: pts.length <= 2, onclick: () => { pts.splice(i, 1); sel = -1; rows(); changed('table'); } }, '✕')); }); };
  const syncRows = () => { [...tbl.querySelectorAll('input')].forEach(el => { if (el === document.activeElement) return; const p = pts[+el.dataset.i]; if (p) el.value = String(+p[el.dataset.k].toFixed(2)); }); };
  const pyText = () => { const d = deg(), ww = weighted(); return `coef = np.polyfit(x, y, ${d}${ww ? ', w=np.sqrt(w)' : ''})[::-1]   # intercept first\n# ${ww ? 'weights: a point with w = 4 counts four times as much' : 'every point counts the same'}`; };
  function changed(from) { pts.forEach(p => { p.fresh = false; }); retarget(); if (from !== 'code' && document.activeElement !== codeBox) codeBox.value = lfCode(pts); if (from !== 'table') syncRows(); py.textContent = pyText(); }
  function onOpt() { degC.style.display = mode() === 'poly' ? '' : 'none'; [...tbl.querySelectorAll('input')].forEach(el => { if (el.dataset.k === 'w') el.disabled = !weighted(); }); note.innerHTML = noteText(); changed('opt'); }
  const noteText = () => weighted() ? 'Weights change who the line listens to. <b>Scroll the mouse wheel over a point</b> (or edit the weight column) to make it count more, and watch the line lean toward it.' : mode() === 'poly' ? 'A curve with a high degree bends to reach every point, even odd ones. Drag one point far away and see how the curve chases it.' : 'Drag a point and the line follows at once. A single far-away point can tilt the whole line: that is why outliers matter.';
  /* the code box: edits become data */
  const parse = name => { const m = new RegExp('(?:^|\\n)\\s*' + name + '\\s*=\\s*\\[([^\\]]*)\\]').exec(codeBox.value); if (!m) return null; const a = m[1].split(',').map(s => s.trim()).filter(Boolean).map(Number); return a.some(v => !isFinite(v)) ? 'bad' : a; };
  let codeTimer = 0; codeBox.oninput = () => { clearTimeout(codeTimer); codeTimer = setTimeout(() => {
    const xs = parse('x'), ys = parse('y'), ws = parse('w'); codeMsg.className = 'lf-msg';
    if (xs === 'bad' || ys === 'bad' || ws === 'bad') { codeMsg.textContent = 'A value in the lists is not a number.'; codeMsg.classList.add('bad'); return; }
    if (!xs || !ys) { codeMsg.textContent = 'Write the data as x = [...] and y = [...].'; codeMsg.classList.add('bad'); return; }
    if (xs.length !== ys.length || xs.length < 2) { codeMsg.textContent = 'x and y need the same length (at least 2).'; codeMsg.classList.add('bad'); return; }
    pts = xs.map((x, i) => ({ x, y: ys[i], w: ws && ws.length === xs.length ? Math.max(.1, ws[i]) : (pts[i] ? pts[i].w : 1) })); codeMsg.textContent = 'Read ' + pts.length + ' points. The graph follows what you type.'; codeMsg.classList.add('ok'); rows(); changed('code');
  }, 160); };
  /* the graph: drag, add, remove, weigh */
  const at = e => { const svg = svgHost.querySelector('svg'), r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * W, vy = (e.clientY - r.top) / r.height * H; return { x: RG.xr[0] + (vx - L) / PW * (RG.xr[1] - RG.xr[0]), y: RG.yr[0] + (T + PH - vy) / PH * (RG.yr[1] - RG.yr[0]), inside: vx >= L && vx <= L + PW && vy >= T && vy <= T + PH }; };
  const clampP = v => ({ x: Math.max(RG.xr[0], Math.min(RG.xr[1], v.x)), y: Math.max(RG.yr[0], Math.min(RG.yr[1], v.y)) });
  svgHost.addEventListener('pointerdown', e => { const c = e.target.closest && e.target.closest('.lf-pt'); if (!c) return; drag = +c.dataset.i; sel = drag; try { svgHost.setPointerCapture(e.pointerId); } catch (x) { } e.preventDefault(); draw(); });
  svgHost.addEventListener('pointermove', e => { if (drag < 0 || !pts[drag]) return; const v = clampP(at(e)); pts[drag].x = v.x; pts[drag].y = v.y; changed('graph'); });
  const up = () => { if (drag >= 0) { drag = -1; codeBox.value = lfCode(pts); syncRows(); } }; svgHost.addEventListener('pointerup', up); svgHost.addEventListener('pointercancel', up);
  svgHost.addEventListener('dblclick', e => { const c = e.target.closest && e.target.closest('.lf-pt'); if (c) { if (pts.length > 2) { pts.splice(+c.dataset.i, 1); sel = -1; rows(); changed('table'); codeBox.value = lfCode(pts); } return; } const v = at(e); if (!v.inside) return; pts.push({ x: v.x, y: v.y, w: 1, fresh: true }); sel = pts.length - 1; rows(); changed('graph'); codeBox.value = lfCode(pts); });
  svgHost.addEventListener('wheel', e => { const c = e.target.closest && e.target.closest('.lf-pt'); if (!c || !pts[+c.dataset.i]) return; e.preventDefault(); const p = pts[+c.dataset.i]; p.w = Math.max(.5, Math.min(12, p.w + (e.deltaY < 0 ? .5 : -.5))); sel = +c.dataset.i; if (!weighted()) { fitSel.querySelector('select').value = 'wline'; onOpt(); } else changed('graph'); codeBox.value = lfCode(pts); }, { passive: false });
  const chk = h('button', { class: 'btn ghost', type: 'button', onclick: async () => {
    res.className = 'w-note'; res.textContent = 'Running in real NumPy…'; const d = deg(), ww = weighted(), f = lfFit(pts, d, ww); if (!f) { res.textContent = 'Nothing to check yet.'; return; }
    const code = `x = np.array(${JSON.stringify(pts.map(p => p.x))})\ny = np.array(${JSON.stringify(pts.map(p => p.y))})\nw = np.array(${JSON.stringify(pts.map(p => p.w))})\ncoef = [float(v) for v in np.polyfit(x, y, ${f.deg}${ww ? ', w=np.sqrt(w)' : ''})[::-1]]`;
    const r = await runPy(code, ['coef'], 'import numpy as np'), got = r.vars && r.vars.coef && r.vars.coef.v;
    const ok = Array.isArray(got) && got.length === f.c.length && got.every((v, k) => Math.abs(v - f.c[k]) <= 1e-5 * (1 + Math.abs(v)));
    res.className = 'w-note ' + (ok ? 'ok' : 'bad'); res.textContent = ok ? '✓ Real NumPy (np.polyfit) finds the same ' + (f.deg === 1 ? 'line' : 'curve') + ': ' + got.map(lfNum).join(', ') + ' (intercept first).' : 'The picture and NumPy disagree: ' + JSON.stringify(got) + ' against ' + JSON.stringify(f.c.map(lfNum));
  } }, '✔ Check with real NumPy');
  const w = wShell(b.title || 'Live data lab: move the data, watch the line', [fitSel, degC, resC, sqC, note], [svgHost, eq, h('div', { class: 'lf-two' }, h('div', {}, h('b', { class: 'lf-h' }, 'The data as a table'), h('div', { class: 'lf-tw' }, tbl)), h('div', {}, h('b', { class: 'lf-h' }, 'The data as code (edit it)'), codeBox, codeMsg, py)), chk, res]);
  rows(); codeBox.value = lfCode(pts); py.textContent = pyText(); note.innerHTML = noteText(); degC.style.display = mode() === 'poly' ? '' : 'none'; setTimeout(() => { retarget(); }, 0); return w;
};
