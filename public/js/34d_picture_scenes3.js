'use strict';
/* =====================================================================
   Picture Class scenes, part 4: trace (code stepping through memory), regress (a line learning to fit), cluster (k-means), tree (a decision tree growing),
   conv (a filter sliding over an image) and hist (a histogram with mean, median and spread).
   The small maths they share lives in PIC.math so tools/verify_picture.js can check every number against NumPy and scikit-learn.
   ===================================================================== */
PIC.math = PIC.math || {};
(function (M) {
  M.mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  M.median = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  M.std = a => { const m = M.mean(a); return Math.sqrt(M.mean(a.map(v => (v - m) * (v - m)))); };
  M.mse = (pts, w, b) => M.mean(pts.map(p => Math.pow(w * p[0] + b - p[1], 2)));
  /* gradient descent on the mean squared error of y = w*x + b */
  M.gd = (pts, w, b, lr, steps) => { const out = [{ w, b, loss: M.mse(pts, w, b) }], n = pts.length; for (let s = 0; s < steps; s++) { let gw = 0, gb = 0; pts.forEach(p => { const e = w * p[0] + b - p[1]; gw += 2 * e * p[0]; gb += 2 * e; }); w -= lr * gw / n; b -= lr * gb / n; out.push({ w, b, loss: M.mse(pts, w, b) }); } return out; };
  /* least-squares polynomial (modified Gram-Schmidt on t = 2x - 1 keeps degree 9 steady); returns a function */
  M.polyfit = (xs, ys, deg) => {
    const n = xs.length, m = deg + 1, t = xs.map(x => 2 * x - 1), A = Array.from({ length: m }, (_, j) => t.map(v => Math.pow(v, j))), Q = [], R = Array.from({ length: m }, () => new Array(m).fill(0));
    for (let j = 0; j < m; j++) { const v = A[j].slice(); for (let i = 0; i < j; i++) { R[i][j] = Q[i].reduce((s, q, k) => s + q * v[k], 0); for (let k = 0; k < n; k++) v[k] -= R[i][j] * Q[i][k]; } const nr = Math.sqrt(v.reduce((s, q) => s + q * q, 0)) || 1e-12; R[j][j] = nr; Q.push(v.map(q => q / nr)); }
    const qy = Q.map(q => q.reduce((s, v, k) => s + v * ys[k], 0)), c = new Array(m).fill(0);
    for (let j = m - 1; j >= 0; j--) { let s = qy[j]; for (let k = j + 1; k < m; k++) s -= R[j][k] * c[k]; c[j] = s / R[j][j]; }
    return x => { const tt = 2 * x - 1; return c.reduce((s, cj, j) => s + cj * Math.pow(tt, j), 0); };
  };
  /* k-means (Lloyd). hist[r] = { assign, from, to }: the last entry is the round in which nothing moved */
  M.kmeans = (pts, init, maxIter) => {
    let c = init.map(p => p.slice()); const hist = [];
    for (let it = 0; it < (maxIter || 30); it++) {
      const a = pts.map(p => { let b = 0, bd = 1e18; c.forEach((q, k) => { const d = (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]); if (d < bd) { bd = d; b = k; } }); return b; });
      const nc = c.map((q, k) => { const m = pts.filter((_, i) => a[i] === k); return m.length ? [M.mean(m.map(p => p[0])), M.mean(m.map(p => p[1]))] : q.slice(); });
      const moved = nc.some((q, k) => Math.hypot(q[0] - c[k][0], q[1] - c[k][1]) > 1e-9); hist.push({ assign: a, from: c, to: nc }); c = nc; if (!moved) break;
    }
    return { hist, cents: c };
  };
  M.inertia = (pts, cents, assign) => pts.reduce((s, p, i) => s + Math.pow(p[0] - cents[assign[i]][0], 2) + Math.pow(p[1] - cents[assign[i]][1], 2), 0);
  /* decision tree on [[f0, f1, label]]: greedy weighted Gini, like scikit-learn */
  M.gini = c => { const n = c.reduce((a, b) => a + b, 0); return n ? 1 - c.reduce((s, v) => s + (v / n) * (v / n), 0) : 0; };
  M.tree = (pts, K, depth, box) => {
    const nodes = [], counts = idx => { const c = new Array(K).fill(0); idx.forEach(i => c[pts[i][2]]++); return c; };
    const build = (idx, d, bounds) => {
      const c = counts(idx), node = { id: nodes.length, n: idx.length, counts: c, gini: M.gini(c), depth: d, bounds, pred: c.indexOf(Math.max.apply(null, c)) }; nodes.push(node);
      if (d >= depth || node.gini === 0) return node;
      let best = null;
      for (let f = 0; f < 2; f++) { const vs = [...new Set(idx.map(i => pts[i][f]))].sort((a, b) => a - b); for (let k = 0; k + 1 < vs.length; k++) { const th = (vs[k] + vs[k + 1]) / 2, l = idx.filter(i => pts[i][f] <= th), r = idx.filter(i => pts[i][f] > th), g = (l.length * M.gini(counts(l)) + r.length * M.gini(counts(r))) / idx.length; if (!best || g < best.g - 1e-12) best = { f, th, l, r, g }; } }
      if (!best || best.g >= node.gini - 1e-12) return node;
      node.split = { f: best.f, th: best.th }; const lb = bounds.slice(), rb = bounds.slice(); lb[best.f * 2 + 1] = best.th; rb[best.f * 2] = best.th;
      node.left = build(best.l, d + 1, lb); node.right = build(best.r, d + 1, rb); return node;
    };
    build(pts.map((_, i) => i), 0, box); return nodes;
  };
  M.conv2d = (img, k) => { const out = []; for (let i = 0; i + k.length <= img.length; i++) { const r = []; for (let j = 0; j + k[0].length <= img[0].length; j++) { let s = 0; for (let u = 0; u < k.length; u++) for (let v = 0; v < k[0].length; v++) s += img[i + u][j + v] * k[u][v]; r.push(s); } out.push(r); } return out; };
  M.relu = f => f.map(r => r.map(v => Math.max(0, v)));
  M.pool = (f, s) => { const out = []; for (let i = 0; i + s <= f.length; i += s) { const r = []; for (let j = 0; j + s <= f[0].length; j += s) { let m = -1e18; for (let u = 0; u < s; u++) for (let v = 0; v < s; v++) m = Math.max(m, f[i + u][j + v]); r.push(m); } out.push(r); } return out; };
  M.hist = (data, edges) => { const c = new Array(edges.length - 1).fill(0); data.forEach(v => { for (let i = 0; i < c.length; i++) if (v >= edges[i] && (v < edges[i + 1] || (i === c.length - 1 && v <= edges[i + 1]))) { c[i]++; break; } }); return c; };
})(PIC.math);

const pc3 = {
  col: ['#2457d6', '#e0701c', '#0f8a5f', '#7a4fd0', '#cb3a46'],
  f: v => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)),
  /* axes with a grid; returns the scale functions and the SVG text */
  frame(W, H, L, R, T, B, xr, yr, o) {
    o = o || {}; const sx = x => L + (x - xr[0]) / (xr[1] - xr[0]) * (W - L - R), sy = y => H - B - (y - yr[0]) / (yr[1] - yr[0]) * (H - B - T), xt = o.xt || (xr[1] - xr[0]) / 5, yt = o.yt || (yr[1] - yr[0]) / 5; let s = '';
    for (let i = 0; xr[0] + i * xt <= xr[1] + 1e-9; i++) { const x = xr[0] + i * xt; s += `<line x1="${sx(x)}" x2="${sx(x)}" y1="${T}" y2="${H - B}" class="pc-g"/><text x="${sx(x)}" y="${H - B + 15}" text-anchor="middle" class="pc-t">${pc3.f(+x.toFixed(6))}</text>`; }
    for (let i = 0; yr[0] + i * yt <= yr[1] + 1e-9; i++) { const y = yr[0] + i * yt; s += `<line y1="${sy(y)}" y2="${sy(y)}" x1="${L}" x2="${W - R}" class="pc-g"/><text x="${L - 6}" y="${sy(y) + 4}" text-anchor="end" class="pc-t">${pc3.f(+y.toFixed(6))}</text>`; }
    s += `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="pc-ax"/><line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" class="pc-ax"/>`; return { sx, sy, svg: s };
  },
  labels: (W, H, xl, yl) => `<text x="${(W + 30) / 2}" y="${H - 3}" text-anchor="middle" class="pc-lab">${picEsc(xl || '')}</text><text x="12" y="${H / 2}" transform="rotate(-90 12 ${H / 2})" text-anchor="middle" class="pc-lab">${picEsc(yl || '')}</text>`,
  tail: sp => `<div class="pc-formula"></div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}<button type="button" class="btn sm pc-replay" hidden>↻ Replay</button>`,
};

/* ---------------------------------------------------------------------------------------------
   Scene: trace. Code stepping through memory: lists as rows of numbered cells, variables as labelled boxes, a pointer that moves.
   spec: { lists: [{ name, items }], states: [{ vars: { name: value }, ptr: { list, i }, note }], types: { name: 'int' }, ms, cap }
   --------------------------------------------------------------------------------------------- */
PIC.scenes.trace = (stage, sp, ctx) => {
  const lists = sp.lists || [], S = sp.states, names = []; S.forEach(s => Object.keys(s.vars || {}).forEach(k => { if (names.indexOf(k) < 0) names.push(k); }));
  stage.innerHTML = `<div class="pc3-trace">${lists.map(l => `<div class="pc3-list" data-n="${picEsc(l.name)}"><div class="pc3-lname">${picEsc(l.name)}</div><div class="pc3-cells">${l.items.map((v, i) => `<div class="pc3-cell" data-i="${i}"><span class="pc3-idx">${i}</span><b>${picEsc(v)}</b></div>`).join('')}</div></div>`).join('')}<div class="pc3-vars">${names.map(k => `<div class="pc3-var" data-k="${picEsc(k)}"><span class="pc3-vname">${picEsc(k)}</span><b>—</b>${sp.types && sp.types[k] ? `<span class="pc3-vtype">${picEsc(sp.types[k])}</span>` : ''}</div>`).join('')}</div></div>${pc3.tail(sp)}`;
  const note = stage.querySelector('.pc-formula'), replay = stage.querySelector('.pc-replay'); let prev = {};
  const apply = s => {
    Object.keys(s.vars || {}).forEach(k => { const box = stage.querySelector(`.pc3-var[data-k="${CSS.escape(k)}"]`), v = String(s.vars[k]); if (prev[k] !== v) { box.querySelector('b').textContent = v; box.classList.remove('chg'); void box.offsetWidth; box.classList.add('chg'); } prev[k] = v; });
    stage.querySelectorAll('.pc3-cell').forEach(c => c.classList.remove('on')); if (s.ptr) { const c = stage.querySelector(`.pc3-list[data-n="${CSS.escape(s.ptr.list)}"] .pc3-cell[data-i="${s.ptr.i}"]`); if (c) c.classList.add('on'); }
    note.innerHTML = s.note || '';
  };
  const row = document.createElement('div'); row.className = 'pc3-try'; row.innerHTML = '<b>Step through it yourself</b> <button type="button" class="btn sm tp">&#9664; back</button> <button type="button" class="btn sm tn">next &#9654;</button>'; stage.appendChild(row); let cur = -1;
  const manual = k => { ctx.cancel(); cur = Math.max(0, Math.min(S.length - 1, k)); prev = {}; stage.querySelectorAll('.pc3-var b').forEach(b => { b.textContent = '\u2014'; }); apply(S[cur]); replay.hidden = false; };
  row.querySelector('.tp').onclick = () => manual(cur - 1); row.querySelector('.tn').onclick = () => manual(cur + 1);
  const go = () => { cur = -1; prev = {}; replay.hidden = true; stage.querySelectorAll('.pc3-var b').forEach(b => { b.textContent = '—'; }); let i = 0; const next = () => { if (ctx.dead) return; if (i >= S.length) { replay.hidden = S.length < 2; return; } cur = i; apply(S[i++]); ctx.wait(sp.ms || 1100, next); }; ctx.wait(250, next); };
  replay.onclick = go; go();
};

/* ---------------------------------------------------------------------------------------------
   Scene: regress. A straight line meeting points. mode: guess | resid | squares | learn | poly
   spec: { pts, test, xr, yr, xt, yt, line: [w, b], lr, steps, deg, xlab, ylab, cap }
   --------------------------------------------------------------------------------------------- */
PIC.scenes.regress = (stage, sp, ctx) => {
  const W = 560, H = 330, xr = sp.xr || [0, 10], yr = sp.yr || [0, 10], F = pc3.frame(W, H, 46, 14, 14, 36, xr, yr, { xt: sp.xt, yt: sp.yt }), sx = F.sx, sy = F.sy, pts = sp.pts.map(p => p.slice()), test = sp.test || [], mode = sp.mode || 'guess', M = PIC.math; let livePaint = null;
  stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="pc-svg" role="img" aria-label="${picEsc(sp.title || 'a line fitted to points')}"><defs><clipPath id="pc3clip"><rect x="46" y="14" width="${W - 60}" height="${H - 50}"/></clipPath></defs>${F.svg}${pc3.labels(W, H, sp.xlab || 'x', sp.ylab || 'y')}<g class="rg-sq" clip-path="url(#pc3clip)"></g><g class="rg-res"></g><path class="rg-curve" fill="none" clip-path="url(#pc3clip)"/><line class="rg-line" style="display:none" clip-path="url(#pc3clip)"/><g class="rg-pts"></g></svg>${mode === 'learn' ? '<svg viewBox="0 0 560 84" class="pc-svg pc3-mini" role="img" aria-label="the error falling as the line learns"><text x="8" y="14" class="pc-t">error (MSE, log scale)</text><path class="rg-loss" fill="none"/></svg>' : ''}${pc3.tail(sp)}`;
  const line = stage.querySelector('.rg-line'), res = stage.querySelector('.rg-res'), sq = stage.querySelector('.rg-sq'), curve = stage.querySelector('.rg-curve'), note = stage.querySelector('.pc-formula'), replay = stage.querySelector('.pc-replay'), lossP = stage.querySelector('.rg-loss'), NS = 'http://www.w3.org/2000/svg';
  stage.querySelector('.rg-pts').innerHTML = pts.map((p, i) => `<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="5.5" class="rg-p" data-i="${i}"><title>x = ${p[0]}, y = ${p[1]}</title></circle>`).join('') + test.map(p => `<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="5.5" class="rg-t"><title>new point: x = ${p[0]}, y = ${p[1]}</title></circle>`).join('');
  const setLine = (w, b, k) => { const x2 = xr[0] + (xr[1] - xr[0]) * (k == null ? 1 : k); line.style.display = ''; line.setAttribute('x1', sx(xr[0])); line.setAttribute('y1', sy(w * xr[0] + b)); line.setAttribute('x2', sx(x2)); line.setAttribute('y2', sy(w * x2 + b)); line.setAttribute('class', 'rg-line'); };
  const fmt = v => pc3.f(Math.round(v * 100) / 100);
  const go = () => {
    replay.hidden = true; res.innerHTML = sq.innerHTML = ''; curve.setAttribute('d', ''); line.style.display = 'none'; note.innerHTML = '';
    if (mode === 'poly') {
      const f = M.polyfit(pts.map(p => p[0]), pts.map(p => p[1]), sp.deg), xs = []; for (let i = 0; i <= 160; i++) xs.push(xr[0] + (xr[1] - xr[0]) * i / 160);
      const tr = M.mean(pts.map(p => Math.pow(f(p[0]) - p[1], 2))), te = test.length ? M.mean(test.map(p => Math.pow(f(p[0]) - p[1], 2))) : null, d = xs.map((x, i) => (i ? 'L' : 'M') + sx(x) + ' ' + sy(Math.max(yr[0] - 5, Math.min(yr[1] + 5, f(x))))).join('');
      curve.setAttribute('d', d); curve.setAttribute('class', 'rg-curve on'); const len = curve.getTotalLength ? curve.getTotalLength() : 1000; curve.style.strokeDasharray = len; curve.style.strokeDashoffset = len;
      ctx.tween(1400, e => { curve.style.strokeDashoffset = len * (1 - e); }, () => { note.innerHTML = `degree <b>${sp.deg}</b>: error on the dots it learned from = <b>${tr.toFixed(4)}</b>` + (te != null ? `, error on <b>new</b> dots (hollow) = <b>${te.toFixed(4)}</b>` : ''); replay.hidden = false; }); return;
    }
    if (!sp.line) { note.innerHTML = sp.note || ''; return; }
    const w0 = sp.line[0], b0 = sp.line[1];
    if (mode === 'learn') {
      const tr = M.gd(pts, w0, b0, sp.lr, sp.steps), mx = Math.max.apply(null, tr.map(t => t.loss)), P = i => `${20 + (i / sp.steps) * 520} ${72 - (Math.log(1 + tr[i].loss) / Math.log(1 + mx)) * 52}`; setLine(w0, b0); lossP.setAttribute('d', ''); let last = -1;
      ctx.tween(sp.ms || 5200, e => { const i = Math.round(e * sp.steps); if (i === last) return; last = i; const t = tr[i]; setLine(t.w, t.b); lossP.setAttribute('d', tr.slice(0, i + 1).map((_, k) => (k ? 'L' : 'M') + P(k)).join('')); note.innerHTML = `step <b>${i}</b> &nbsp; w = <b>${fmt(t.w)}</b> &nbsp; b = <b>${fmt(t.b)}</b> &nbsp; error = <b>${t.loss.toFixed(3)}</b>`; }, () => { replay.hidden = false; }); return;
    }
    const loss = M.mse(pts, w0, b0); ctx.tween(900, e => setLine(w0, b0, e), () => {
      if (mode === 'guess') { note.innerHTML = `line: y = <b>${fmt(w0)}</b>·x + <b>${fmt(b0)}</b>`; replay.hidden = false; return; }
      pts.forEach(p => { const l = document.createElementNS(NS, 'line'); l.setAttribute('class', 'rg-r'); l.setAttribute('x1', sx(p[0])); l.setAttribute('x2', sx(p[0])); l.setAttribute('y1', sy(p[1])); l.setAttribute('y2', sy(p[1])); l.dataset.t = sy(w0 * p[0] + b0); res.appendChild(l); });
      ctx.tween(800, e => { [...res.children].forEach((l, i) => l.setAttribute('y2', sy(pts[i][1]) + (+l.dataset.t - sy(pts[i][1])) * e)); }, () => {
        if (mode === 'resid') { note.innerHTML = `each orange stick is one <b>mistake</b> (how far the line is from that dot)`; replay.hidden = false; return; }
        pts.forEach(p => { const r = Math.abs(sy(w0 * p[0] + b0) - sy(p[1])), q = document.createElementNS(NS, 'rect'); q.setAttribute('class', 'rg-sqr'); q.setAttribute('x', sx(p[0])); q.setAttribute('y', Math.min(sy(p[1]), sy(w0 * p[0] + b0))); q.setAttribute('width', r); q.setAttribute('height', r); sq.appendChild(q); });
        note.innerHTML = `a mistake of 3 costs 9, of 1 only 1. Mean of the squares = <b>${loss.toFixed(3)}</b> (the MSE)`; replay.hidden = false;
      });
    });
  };
  replay.onclick = go; go();
  if (sp.line && mode !== 'learn' && mode !== 'poly') {
    const w0 = sp.line[0], b0 = sp.line[1], wA = Math.max(1, Math.abs(w0)) * 2, bA = Math.max(1, Math.abs(b0)) * 1.2 + (yr[1] - yr[0]) * .1, row = document.createElement('div'); row.className = 'pc3-try';
    row.innerHTML = `<b>Try your own line</b> <label>slope w <input type="range" class="tw" min="${w0 - wA}" max="${w0 + wA}" step="0.01" value="${w0}"></label> <label>start b <input type="range" class="tb" min="${b0 - bA}" max="${b0 + bA}" step="0.01" value="${b0}"></label> <button type="button" class="btn sm tz">&#8634; back</button>`; stage.appendChild(row);
    const tw = row.querySelector('.tw'), tb = row.querySelector('.tb'), paint = (w, b) => {
      ctx.cancel(); res.innerHTML = sq.innerHTML = ''; setLine(w, b);
      if (mode === 'resid' || mode === 'squares') pts.forEach(p => { const l = document.createElementNS(NS, 'line'); l.setAttribute('class', 'rg-r'); l.setAttribute('x1', sx(p[0])); l.setAttribute('x2', sx(p[0])); l.setAttribute('y1', sy(p[1])); l.setAttribute('y2', sy(w * p[0] + b)); res.appendChild(l); });
      if (mode === 'squares') pts.forEach(p => { const r = Math.abs(sy(w * p[0] + b) - sy(p[1])), q = document.createElementNS(NS, 'rect'); q.setAttribute('class', 'rg-sqr'); q.setAttribute('x', sx(p[0])); q.setAttribute('y', Math.min(sy(p[1]), sy(w * p[0] + b))); q.setAttribute('width', r); q.setAttribute('height', r); sq.appendChild(q); });
      note.innerHTML = `line: y = <b>${fmt(w)}</b>&middot;x + <b>${fmt(b)}</b> &nbsp; mean squared mistake (MSE) = <b>${M.mse(pts, w, b).toFixed(2)}</b>`; replay.hidden = false;
    };
    tw.oninput = tb.oninput = () => paint(+tw.value, +tb.value); row.querySelector('.tz').onclick = () => { tw.value = w0; tb.value = b0; go(); }; livePaint = () => paint(+tw.value, +tb.value);
  }
  /* live data: drag a dot and the mistakes, the squares and the best-fit line follow */
  {
    const svg = stage.querySelector('svg'), ptsG = stage.querySelector('.rg-pts'), best = document.createElementNS(NS, 'line'), orig = pts.map(p => p.slice()), row2 = document.createElement('div');
    best.setAttribute('class', 'rg-best'); best.setAttribute('clip-path', 'url(#pc3clip)'); ptsG.parentNode.insertBefore(best, ptsG);
    row2.className = 'pc3-try'; row2.innerHTML = '<b>Drag the dots</b> and everything follows.' + (mode === 'poly' ? '' : ' <label><input type="checkbox" class="lv-b" checked> dashed line = the best straight line for these dots</label>') + ' <button type="button" class="btn sm lv-r">&#8634; put the dots back</button>'; stage.appendChild(row2);
    const chkB = row2.querySelector('.lv-b'), lineY = () => { if (pts.length < 2 || new Set(pts.map(p => p[0])).size < 2) return null; const f = M.polyfit(pts.map(p => p[0]), pts.map(p => p[1]), 1); return [f(xr[0]), f(xr[1])]; };
    let glide = null;
    const drawBest = v => { best.setAttribute('x1', sx(xr[0])); best.setAttribute('x2', sx(xr[1])); best.setAttribute('y1', sy(v[0])); best.setAttribute('y2', sy(v[1])); };
    const retarget = () => { const t = chkB && chkB.checked ? lineY() : null; best.style.display = t ? '' : 'none'; if (!t) return; if (!glide) glide = pc3Live.glide(stage, t, t, drawBest, (yr[1] - yr[0]) * 1e-3, .3); else glide.to(t); };
    const polyNow = () => { const f = M.polyfit(pts.map(p => p[0]), pts.map(p => p[1]), sp.deg), xs = []; for (let i = 0; i <= 160; i++) xs.push(xr[0] + (xr[1] - xr[0]) * i / 160); curve.style.strokeDasharray = 'none'; curve.style.strokeDashoffset = 0; curve.setAttribute('d', xs.map((x, i) => (i ? 'L' : 'M') + sx(x) + ' ' + sy(Math.max(yr[0] - 5, Math.min(yr[1] + 5, f(x))))).join('')); note.innerHTML = `degree <b>${sp.deg}</b>: error on the dots it learned from = <b>${M.mean(pts.map(p => Math.pow(f(p[0]) - p[1], 2))).toFixed(4)}</b>`; };
    const place = i => { const c = ptsG.querySelector(`.rg-p[data-i="${i}"]`); c.setAttribute('cx', sx(pts[i][0])); c.setAttribute('cy', sy(pts[i][1])); c.querySelector('title').textContent = `x = ${pts[i][0]}, y = ${pts[i][1]}`; };
    const after = drop => { if (mode === 'poly') polyNow(); else if (livePaint) livePaint(); else if (mode === 'learn' && drop) { ctx.cancel(); go(); } retarget(); };
    pc3Live.drag(svg, W, H, xr, yr, '.rg-p', (i, x, y, phase) => { pts[i][0] = x; pts[i][1] = y; place(i); after(phase === 'drop'); });
    if (chkB) chkB.onchange = retarget; row2.querySelector('.lv-r').onclick = () => { pts.forEach((p, i) => { p[0] = orig[i][0]; p[1] = orig[i][1]; place(i); }); after(true); };
    retarget();
  }
};

/* ---------------------------------------------------------------------------------------------
   Scene: cluster (k-means). spec: { pts, init, rounds, xr, yr, xlab, ylab, cap }
   --------------------------------------------------------------------------------------------- */
PIC.scenes.cluster = (stage, sp, ctx) => {
  const W = 560, H = 330, xr = sp.xr, yr = sp.yr, F = pc3.frame(W, H, 46, 14, 14, 36, xr, yr, { xt: sp.xt, yt: sp.yt }), sx = F.sx, sy = F.sy, pts = sp.pts.map(p => p.slice()), M = PIC.math, rounds = sp.rounds == null ? 99 : sp.rounds; sp = Object.assign({}, sp, sp.init ? { init: sp.init.map(c => c.slice()) } : {}); let km = sp.init ? M.kmeans(pts, sp.init, 30) : null;
  stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="pc-svg" role="img" aria-label="${picEsc(sp.title || 'points grouped around centres')}">${F.svg}${pc3.labels(W, H, sp.xlab, sp.ylab)}<g class="cl-trail"></g><g class="cl-pts">${pts.map((p, i) => `<circle class="cl-p" data-i="${i}" cx="${sx(p[0])}" cy="${sy(p[1])}" r="6"/>`).join('')}</g><g class="cl-cent"></g></svg>${pc3.tail(sp)}`;
  const dots = [...stage.querySelectorAll('.cl-p')], cg = stage.querySelector('.cl-cent'), tg = stage.querySelector('.cl-trail'), note = stage.querySelector('.pc-formula'), replay = stage.querySelector('.pc-replay'), NS = 'http://www.w3.org/2000/svg';
  const star = (c, k) => `<g class="cl-c" transform="translate(${sx(c[0])},${sy(c[1])})"><path d="M0 -13 L11 0 L0 13 L-11 0 Z" fill="${pc3.col[k]}" stroke="#fff" stroke-width="2.5"/><circle r="2.5" fill="#fff"/></g>`;
  const color = a => dots.forEach((d, i) => { d.style.fill = a ? pc3.col[a[i]] : ''; d.classList.toggle('free', !a); });
  const drawC = cs => { cg.innerHTML = cs.map(star).join(''); };
  const go = () => {
    replay.hidden = true; tg.innerHTML = ''; color(null); cg.innerHTML = ''; note.innerHTML = km ? 'the dots, and three starting centres' : 'the dots: nobody has told us any groups';
    if (!km) { replay.hidden = true; return; }
    drawC(sp.init); let r = 0; const fmtc = cs => cs.map(c => `(${c[0].toFixed(1)}, ${c[1].toFixed(1)})`).join('  ');
    const round = () => {
      if (ctx.dead) return; if (r >= km.hist.length || r >= rounds) { const last = km.hist[Math.min(r, km.hist.length) - 1]; note.innerHTML = (r >= km.hist.length ? 'nothing moves any more: <b>done</b>. ' : '') + `centres: ${fmtc(last ? last.to : sp.init)}` + (last ? ` &nbsp; spread = <b>${M.inertia(pts, last.from, last.assign).toFixed(1)}</b>` : ''); replay.hidden = false; return; }
      const h = km.hist[r++]; color(h.assign); note.innerHTML = `round <b>${r}</b>: every dot joins its <b>nearest</b> centre`;
      ctx.wait(1300, () => {
        const moved = h.to.some((c, k) => Math.hypot(c[0] - h.from[k][0], c[1] - h.from[k][1]) > 1e-9); if (!moved) { r = 99; round(); return; }
        note.innerHTML = `then each centre moves to the <b>middle</b> of its dots`; h.to.forEach((c, k) => { const l = document.createElementNS(NS, 'line'); l.setAttribute('class', 'cl-tr'); l.setAttribute('x1', sx(h.from[k][0])); l.setAttribute('y1', sy(h.from[k][1])); l.setAttribute('x2', sx(c[0])); l.setAttribute('y2', sy(c[1])); l.style.stroke = pc3.col[k]; tg.appendChild(l); });
        ctx.tween(1000, e => drawC(h.to.map((c, k) => [h.from[k][0] + (c[0] - h.from[k][0]) * e, h.from[k][1] + (c[1] - h.from[k][1]) * e])), () => ctx.wait(500, round));
      });
    };
    ctx.wait(1100, round);
  };
  replay.onclick = go; go();
  if (km) { const hint = document.createElement('div'); hint.className = 'pc3-try'; hint.innerHTML = '<b>Move a starting centre</b> click anywhere on the picture: the nearest diamond jumps there and k-means starts again'; stage.appendChild(hint); const svg = stage.querySelector('svg'); svg.style.cursor = 'crosshair'; svg.addEventListener('click', e => { const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * W, vy = (e.clientY - r.top) / r.height * H, x = xr[0] + (vx - 46) / (W - 60) * (xr[1] - xr[0]), y = yr[0] + (H - 36 - vy) / (H - 50) * (yr[1] - yr[0]); if (x < xr[0] || x > xr[1] || y < yr[0] || y > yr[1]) return; let k = 0, bd = 1e18; sp.init.forEach((c, i) => { const d = (c[0] - x) * (c[0] - x) + (c[1] - y) * (c[1] - y); if (d < bd) { bd = d; k = i; } }); sp.init = sp.init.map((c, i) => (i === k ? [x, y] : c)); km = M.kmeans(pts, sp.init, 30); ctx.cancel(); go(); }); }
  /* live data: drag a dot; its colour follows the nearest starting centre at once, and k-means starts again when you let go */
  { const svg = stage.querySelector('svg'); pc3Live.drag(svg, W, H, xr, yr, '.cl-p', (i, x, y, phase) => { pts[i][0] = x; pts[i][1] = y; dots[i].setAttribute('cx', sx(x)); dots[i].setAttribute('cy', sy(y)); if (!km) return; if (phase === 'drop') { km = M.kmeans(pts, sp.init, 30); ctx.cancel(); go(); return; } let k = 0, bd = 1e18; sp.init.forEach((c, j) => { const d = (c[0] - x) * (c[0] - x) + (c[1] - y) * (c[1] - y); if (d < bd) { bd = d; k = j; } }); dots[i].style.fill = pc3.col[k]; dots[i].classList.remove('free'); }); if (!km) { const hint = document.createElement('div'); hint.className = 'pc3-try'; hint.innerHTML = '<b>Drag the dots</b> to change the data.'; stage.appendChild(hint); } }
};

/* ---------------------------------------------------------------------------------------------
   Scene: tree. A decision tree growing: the dots get cut by lines (left) while the question boxes appear (right).
   spec: { pts: [[f0, f1, label]], names: ['f0', 'f1'], classes: ['no', 'yes'], depth, upto, xr, yr }
   --------------------------------------------------------------------------------------------- */
PIC.scenes.tree = (stage, sp, ctx) => {
  const W = 700, H = 340, M = PIC.math, xr = sp.xr, yr = sp.yr, F = pc3.frame(W, H, 44, 400, 14, 38, xr, yr, { xt: sp.xt, yt: sp.yt }), sx = F.sx, sy = F.sy, pts = sp.pts, K = sp.classes.length, nodes = M.tree(pts, K, sp.depth, [xr[0], xr[1], yr[0], yr[1]]);
  const splitters = nodes.filter(n => n.split).sort((a, b) => a.depth - b.depth || a.id - b.id), upto = sp.upto == null ? splitters.length : sp.upto, shown = new Set(splitters.slice(0, upto).map(n => n.id));
  /* which nodes are visible: the root, and the children of every split already shown */
  const vis = new Set([0]); nodes.forEach(n => { if (n.split && shown.has(n.id)) { vis.add(n.left.id); vis.add(n.right.id); } });
  const leafs = nodes.filter(n => vis.has(n.id) && !(n.split && shown.has(n.id))), isOpen = n => n.split && shown.has(n.id);
  const slots = {}; let slot = 0; const lay = n => { if (!isOpen(n)) { slots[n.id] = slot++; return; } lay(n.left); lay(n.right); slots[n.id] = (slots[n.left.id] + slots[n.right.id]) / 2; }; lay(nodes[0]);
  const TW = 372, bx = i => 322 + (slot > 1 ? 44 + i * (TW - 88) / (slot - 1) : TW / 2), by = d => 36 + d * 78;
  let s = ''; leafs.forEach(n => { const b = n.bounds; s += `<rect x="${sx(b[0])}" y="${sy(b[3])}" width="${sx(b[1]) - sx(b[0])}" height="${sy(b[2]) - sy(b[3])}" class="tr-reg" style="fill:${pc3.col[n.pred]}" />`; });
  nodes.filter(n => isOpen(n)).forEach(n => { const b = n.bounds, t = n.split.th; s += n.split.f === 0 ? `<line x1="${sx(t)}" x2="${sx(t)}" y1="${sy(b[3])}" y2="${sy(b[2])}" class="tr-cut"/>` : `<line y1="${sy(t)}" y2="${sy(t)}" x1="${sx(b[0])}" x2="${sx(b[1])}" class="tr-cut"/>`; });
  let e = ''; nodes.filter(n => isOpen(n)).forEach(n => [n.left, n.right].forEach((c, k) => { e += `<path d="M${bx(slots[n.id])} ${by(n.depth) + 22} L${bx(slots[c.id])} ${by(c.depth) - 22}" class="tr-edge"/><text x="${(bx(slots[n.id]) + bx(slots[c.id])) / 2 + (k ? 8 : -8)}" y="${(by(n.depth) + by(c.depth)) / 2 + 3}" class="pc-t" text-anchor="${k ? 'start' : 'end'}">${k ? 'no' : 'yes'}</text>`; }));
  let boxes = ''; nodes.filter(n => vis.has(n.id)).forEach(n => { const x = bx(slots[n.id]), y = by(n.depth), open = isOpen(n), q = open ? `${sp.names[n.split.f]} ≤ ${pc3.f(+n.split.th.toFixed(2))}?` : sp.classes[n.pred]; boxes += `<g class="tr-node"><rect x="${x - 44}" y="${y - 22}" width="88" height="44" rx="9" style="fill:${open ? 'var(--surface2)' : pc3.col[n.pred] + '33'};stroke:${open ? 'var(--line)' : pc3.col[n.pred]}"/><text x="${x}" y="${y - 4}" text-anchor="middle" class="tr-q">${picEsc(q)}</text><text x="${x}" y="${y + 12}" text-anchor="middle" class="pc-t">n=${n.n} gini=${n.gini.toFixed(2)}</text></g>`; });
  const dots = pts.map(p => `<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="5.5" class="tr-p" style="fill:${pc3.col[p[2]]}"/>`).join(''), leg = sp.classes.map((c, i) => `<g transform="translate(${330 + i * 90},${H - 12})"><circle r="5" style="fill:${pc3.col[i]}"/><text x="9" y="4" class="pc-t">${picEsc(c)}</text></g>`).join('');
  stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="pc-svg" role="img" aria-label="a decision tree and the cuts it makes">${F.svg}${pc3.labels(300, H, sp.names[0], sp.names[1]).replace('x="165"', 'x="172"')}${s}${dots}${e}${boxes}${leg}</svg>${pc3.tail(sp)}<div class="pc3-try"><b>Grow the tree</b> <button type="button" class="btn sm tr-less">&minus; a question</button> <button type="button" class="btn sm tr-more">+ a question</button></div>`;
  stage.querySelector('.tr-less').disabled = upto <= 0; stage.querySelector('.tr-more').disabled = upto >= splitters.length;
  const again = n => { ctx.cancel(); stage.innerHTML = ''; PIC.scenes.tree(stage, Object.assign({}, sp, { upto: n }), ctx); }; stage.querySelector('.tr-less').onclick = () => again(upto - 1); stage.querySelector('.tr-more').onclick = () => again(upto + 1);
  const note = stage.querySelector('.pc-formula'); stage.querySelector('.pc-replay').remove();
  const right = leafs.filter(n => n.gini === 0).length; note.innerHTML = upto === 0 ? `nothing split yet: a single box that guesses <b>${picEsc(sp.classes[nodes[0].pred])}</b> for everybody` : `<b>${upto}</b> question${upto > 1 ? 's' : ''} asked, <b>${leafs.length}</b> boxes, <b>${right}</b> of them pure (only one colour)`;
  stage.querySelectorAll('.tr-p').forEach((d, i) => { d.style.opacity = 0; ctx.wait(i * 25, () => { d.style.opacity = 1; }); });
};

/* ---------------------------------------------------------------------------------------------
   Scene: conv. A small filter sliding across an image. view: conv | relu | pool
   spec: { img, kernel, view, ms, cap }
   --------------------------------------------------------------------------------------------- */
PIC.scenes.conv = (stage, sp, ctx) => {
  const M = PIC.math, img = sp.img, k = sp.kernel, F = M.conv2d(img, k), R = M.relu(F), P = M.pool(R, 2), view = sp.view || 'conv', CS = 28;
  const src = view === 'conv' ? img : view === 'relu' ? F : R, out = view === 'conv' ? F : view === 'relu' ? R : P, win = view === 'conv' ? k.length : view === 'pool' ? 2 : 1, step = view === 'pool' ? 2 : 1;
  const color = (v, lo, hi) => v > 0 ? `rgba(36,87,214,${Math.min(1, v / (hi || 1)) * .85})` : v < 0 ? `rgba(224,112,28,${Math.min(1, -v / (-lo || 1)) * .85})` : 'transparent';
  const all = [].concat.apply([], src), lo = Math.min.apply(null, all.concat(0)), hi = Math.max.apply(null, all.concat(1)), olo = Math.min.apply(null, [].concat.apply([], out).concat(0)), ohi = Math.max.apply(null, [].concat.apply([], out).concat(1));
  const grid = (m, x0, y0, id, cl, cf) => m.map((r, i) => r.map((v, j) => `<g class="cv-c ${id}" data-i="${i}" data-j="${j}"><rect x="${x0 + j * CS}" y="${y0 + i * CS}" width="${CS - 2}" height="${CS - 2}" rx="4" style="fill:${cl(v, i, j)}" class="cv-r"/><text x="${x0 + j * CS + CS / 2 - 1}" y="${y0 + i * CS + CS / 2 + 3}" text-anchor="middle" class="cv-n">${cf(v)}</text></g>`).join('')).join('');
  const X0 = 12, Y0 = 34, KX = X0 + src[0].length * CS + 40, OX = KX + (view === 'conv' ? k[0].length * CS : 0) + 44, W = OX + out[0].length * CS + 12, H = Y0 + Math.max(src.length, out.length) * CS + 56;
  const imgFill = v => `rgba(27,33,40,${(1 - v / 9) * .15 + .02})`, srcCl = view === 'conv' ? (v => (v === 0 ? 'rgba(120,130,150,.12)' : `rgba(27,33,40,${.15 + v / 9 * .8})`)) : (v => color(v, lo, hi));
  stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="pc-svg pc3-conv" role="img" aria-label="a filter sliding over an image">` +
    `<text x="${X0}" y="20" class="pc-lab">${view === 'conv' ? 'image' : view === 'relu' ? 'filter result' : 'after ReLU'}</text>${grid(src, X0, Y0, 'src', srcCl, v => pc3.f(v))}<rect class="cv-win" x="${X0}" y="${Y0}" width="${win * CS - 2}" height="${win * CS - 2}" rx="5"/>` +
    (view === 'conv' ? `<text x="${KX}" y="20" class="pc-lab">filter</text>${grid(k, KX, Y0, 'ker', v => color(v, -1, 1), v => pc3.f(v))}<text x="${KX + k[0].length * CS + 22}" y="${Y0 + k.length * CS / 2 + 8}" text-anchor="middle" class="cv-arrow">→</text>` : `<text x="${OX - 24}" y="${Y0 + 8 * CS / 2}" text-anchor="middle" class="cv-arrow">→</text>`) +
    `<text x="${OX}" y="20" class="pc-lab">${view === 'conv' ? 'filter result' : view === 'relu' ? 'after ReLU (negatives → 0)' : 'after max-pool 2×2'}</text>${grid(out.map(r => r.map(() => null)), OX, Y0, 'out', () => 'transparent', () => '')}</svg>${pc3.tail(sp)}`;
  const winEl = stage.querySelector('.cv-win'), note = stage.querySelector('.pc-formula'), replay = stage.querySelector('.pc-replay'); const cells = {}; stage.querySelectorAll('.cv-c.out').forEach(c => { cells[c.dataset.i + ',' + c.dataset.j] = c; });
  const put = (i, j) => { const c = cells[i + ',' + j], v = out[i][j]; c.querySelector('rect').style.fill = color(v, olo, ohi); c.querySelector('text').textContent = pc3.f(v); c.querySelector('rect').classList.add('pop'); };
  const go = () => {
    replay.hidden = true; Object.keys(cells).forEach(key => { const c = cells[key]; c.querySelector('rect').style.fill = 'transparent'; c.querySelector('text').textContent = ''; c.querySelector('rect').classList.remove('pop'); }); note.innerHTML = '';
    const tot = out.length * out[0].length; let last = -1;
    ctx.tween(sp.ms || 4200, e => {
      const n = Math.min(tot - 1, Math.floor(e * tot)); if (n === last) return; for (let q = last + 1; q <= n; q++) put(Math.floor(q / out[0].length), q % out[0].length); last = n; const i = Math.floor(n / out[0].length), j = n % out[0].length;
      winEl.setAttribute('x', X0 + j * step * CS); winEl.setAttribute('y', Y0 + i * step * CS);
      if (view === 'conv') { const terms = []; for (let u = 0; u < k.length; u++) for (let v = 0; v < k[0].length; v++) terms.push(src[i + u][j + v] * k[u][v]); note.innerHTML = `<b>${terms.filter(t => t !== 0).map(t => (t < 0 ? '(' + t + ')' : t)).join(' + ') || '0'}</b> = <b>${out[i][j]}</b>`; }
      else if (view === 'relu') note.innerHTML = `${pc3.f(F[i][j])} → <b>${pc3.f(out[i][j])}</b>`; else note.innerHTML = `biggest of this 2×2 block = <b>${pc3.f(out[i][j])}</b>`;
    }, () => { replay.hidden = false; });
  };
  replay.onclick = go; go();
  const hint = document.createElement('div'); hint.className = 'pc3-try'; hint.innerHTML = '<b>Click any result cell</b> to see where its number came from'; stage.appendChild(hint);
  stage.querySelectorAll('.cv-c.out').forEach(c => { c.style.cursor = 'pointer'; c.addEventListener('click', () => {
    ctx.cancel(); const i = +c.dataset.i, j = +c.dataset.j; for (let a = 0; a < out.length; a++) for (let b2 = 0; b2 < out[0].length; b2++) if (a * out[0].length + b2 <= i * out[0].length + j) put(a, b2);
    winEl.setAttribute('x', X0 + j * step * CS); winEl.setAttribute('y', Y0 + i * step * CS);
    if (view === 'conv') { const terms = []; for (let u = 0; u < k.length; u++) for (let v = 0; v < k[0].length; v++) terms.push(src[i + u][j + v] * k[u][v]); note.innerHTML = `<b>${terms.filter(t => t !== 0).map(t => (t < 0 ? '(' + t + ')' : t)).join(' + ') || '0'}</b> = <b>${out[i][j]}</b>`; }
    else if (view === 'relu') note.innerHTML = `${pc3.f(F[i][j])} → <b>${pc3.f(out[i][j])}</b>`; else note.innerHTML = `biggest of this 2×2 block = <b>${pc3.f(out[i][j])}</b>`; replay.hidden = false;
  }); });
};

/* ---------------------------------------------------------------------------------------------
   Scene: hist. Dots become bars; mean, median and spread are drawn on top.
   spec: { data, edges | bins, show: ['mean','median','sd','sd2','normal'], xlab, title, cap, ms }
   --------------------------------------------------------------------------------------------- */
PIC.scenes.hist = (stage, sp, ctx) => {
  const M = PIC.math, d = sp.data, lo = sp.edges ? sp.edges[0] : Math.min.apply(null, d), hi = sp.edges ? sp.edges[sp.edges.length - 1] : Math.max.apply(null, d), nb = sp.bins || 10, edges = sp.edges || Array.from({ length: nb + 1 }, (_, i) => lo + (hi - lo) * i / nb), cnt = M.hist(d, edges), nbins = edges.length - 1, binw = (edges[nbins] - edges[0]) / nbins, sdv = M.std(d), peak = (sp.show || []).indexOf('normal') >= 0 ? d.length * binw / (sdv * Math.sqrt(2 * Math.PI)) : 0, top = Math.max(Math.max.apply(null, cnt), peak) * 1.1, mag = Math.pow(10, Math.floor(Math.log10(top / 5))), ystep = [1, 2, 2.5, 5, 10].map(m => m * mag).find(q => top / q <= 6), ymax = Math.ceil(top / ystep) * ystep;
  const W = 560, H = 330, F = pc3.frame(W, H, 46, 14, 16, 40, [lo, hi], [0, ymax], { xt: sp.xt || binw * Math.ceil(nbins / 8), yt: ystep }), sx = F.sx, sy = F.sy, show = sp.show || [], mean = M.mean(d), med = M.median(d), sd = M.std(d);
  let lines = ''; if (show.indexOf('sd2') >= 0) lines += `<rect x="${sx(mean - 2 * sd)}" y="16" width="${sx(mean + 2 * sd) - sx(mean - 2 * sd)}" height="${H - 56}" class="hs-sd2"/>`; if (show.indexOf('sd') >= 0) lines += `<rect x="${sx(mean - sd)}" y="16" width="${sx(mean + sd) - sx(mean - sd)}" height="${H - 56}" class="hs-sd"/>`;
  let nrm = ''; if (show.indexOf('normal') >= 0) { const bw = binw, pts = []; for (let i = 0; i <= 120; i++) { const x = lo + (hi - lo) * i / 120, y = d.length * bw * Math.exp(-0.5 * Math.pow((x - mean) / sd, 2)) / (sd * Math.sqrt(2 * Math.PI)); pts.push((i ? 'L' : 'M') + sx(x) + ' ' + sy(y)); } nrm = `<path d="${pts.join('')}" class="hs-norm"/>`; }
  const mk = (v, cls, name, row) => `<g class="hs-mk ${cls}" style="opacity:0"><line x1="${sx(v)}" x2="${sx(v)}" y1="16" y2="${H - 40}" class="hs-line ${cls}"/><text x="${sx(v) + (row ? -5 : 5)}" y="${30 + row * 15}" text-anchor="${row ? 'end' : 'start'}" class="hs-lab ${cls}">${name} ${pc3.f(+v.toFixed(2))}</text></g>`;
  if (show.indexOf('mean') >= 0) lines += mk(mean, 'mean', 'mean', 0); if (show.indexOf('median') >= 0) lines += mk(med, 'median', 'median', 1);
  stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="pc-svg" role="img" aria-label="${picEsc(sp.title || 'histogram')}">${F.svg}${pc3.labels(W, H, sp.xlab, 'how many')}<g class="hs-bars">${cnt.map((c, i) => `<rect class="hs-bar" x="${sx(edges[i]) + 1}" y="${sy(0)}" width="${sx(edges[i + 1]) - sx(edges[i]) - 2}" height="0" rx="3"><title>${pc3.f(+edges[i].toFixed(2))} to ${pc3.f(+edges[i + 1].toFixed(2))}: ${c} value${c === 1 ? '' : 's'}</title></rect><text class="hs-cn" x="${(sx(edges[i]) + sx(edges[i + 1])) / 2}" y="${sy(c) - 4}" text-anchor="middle" style="opacity:0">${c || ''}</text>`).join('')}</g>${lines}${nrm}</svg>${pc3.tail(sp)}<label class="pc3-try"><b>Change the ranges</b> <input type="range" class="hs-bins" min="4" max="24" step="1" value="${nbins}"> <span class="hs-nb">${nbins} ranges</span></label>`;
  stage.querySelector('.hs-bins').oninput = e => { stage.querySelector('.hs-nb').textContent = e.target.value + ' ranges'; ctx.cancel(); stage.innerHTML = ''; PIC.scenes.hist(stage, Object.assign({}, sp, { edges: null, bins: +e.target.value, ms: 500, show: sp.show }), ctx); };
  const bars = [...stage.querySelectorAll('.hs-bar')], cn = [...stage.querySelectorAll('.hs-cn')], mks = [...stage.querySelectorAll('.hs-mk')], sdr = [...stage.querySelectorAll('.hs-sd,.hs-sd2')], nm = stage.querySelector('.hs-norm'), note = stage.querySelector('.pc-formula'), replay = stage.querySelector('.pc-replay');
  const go = () => {
    replay.hidden = true; bars.forEach(b => { b.setAttribute('height', 0); b.setAttribute('y', sy(0)); }); cn.forEach(c => { c.style.opacity = 0; }); mks.forEach(m => { m.style.opacity = 0; }); sdr.forEach(r => { r.style.opacity = 0; }); if (nm) nm.style.opacity = 0; note.innerHTML = `${d.length} values`;
    ctx.tween(sp.ms || 1600, e => { bars.forEach((b, i) => { const k = pjClampLocal((e * (cnt.length + 2) - i) / 2, 0, 1), hh = (sy(0) - sy(cnt[i])) * k; b.setAttribute('height', hh); b.setAttribute('y', sy(0) - hh); }); }, () => {
      cn.forEach(c => { c.style.opacity = 1; }); let t = 0;
      sdr.forEach(r => { r.style.transition = 'opacity .6s'; r.style.opacity = 1; }); if (nm) { nm.style.transition = 'opacity .6s'; nm.style.opacity = 1; }
      mks.forEach(m => { ctx.wait(400 + t++ * 700, () => { m.style.transition = 'opacity .5s'; m.style.opacity = 1; }); });
      note.innerHTML = `mean <b>${pc3.f(+mean.toFixed(2))}</b> &nbsp; median <b>${pc3.f(+med.toFixed(2))}</b> &nbsp; std <b>${pc3.f(+sd.toFixed(2))}</b>`; replay.hidden = false;
    });
  };
  replay.onclick = go; go();
};
const pjClampLocal = (v, a, b) => Math.max(a, Math.min(b, v));
