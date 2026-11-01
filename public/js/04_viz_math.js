'use strict';
/* =====================================================================
   Math labs, drawn like real graphs (thin lines, numbered axes, optional grid):
   matrixLab   - a matrix transforms the plane (2-D) or the box (3-D): determinant = area / volume scale
   calcLab     - derivative (secant -> tangent), integral (rectangles -> area), gradient + descent on a 3-D surface
   confusionLab- two score distributions, a threshold, the confusion matrix, precision / recall, ROC
   cltLab      - sampling distributions: the average of many samples is bell-shaped (and a confidence interval)
   ===================================================================== */
const path2 = (pts, X, Y) => 'M' + pts.map(p => X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('L');
const det2 = m => m[0] * m[3] - m[1] * m[2];

/* ---------------------------------------------------------------- matrixLab */
DSQ.viz.matrixLab = (c, a) => {
  const W = 560, H = 440, PAD = { l: 38, r: 12, t: 12, b: 28 }, ID2 = [1, 0, 0, 1], ID3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  let dim = a.dim || '2d', M = a.m ? [...a.m] : [1.5, 0.5, 0.2, 1], M3 = [...ID3], t = 1, grid = true, cancel = null;
  const stage = c.stage, wrap = h('div', { class: 'stagewrap' }), p3 = Plot3D(wrap, { w: 560, h: 420, az: .7, el: .45 }), host = h('div', { style: { width: '100%' } });
  wrap.append(host); stage.append(wrap); c.onDestroy(() => { p3.destroy(); cancel && cancel(); });
  const r = RNG(7), cloud = range(26).map(() => [r.norm(0, .7), r.norm(0, .7)]);
  const PRE2 = { identity: ID2, 'rotate 40deg': [Math.cos(.7), -Math.sin(.7), Math.sin(.7), Math.cos(.7)], 'stretch x': [2, 0, 0, 1], shear: [1, 1, 0, 1], flip: [-1, 0, 0, 1], 'squash (singular)': [1, 2, .5, 1], 'collapse to a line': [1, 1, 1, 1] };
  const PRE3 = { identity: ID3, 'rotate z': [Math.cos(.7), -Math.sin(.7), 0, Math.sin(.7), Math.cos(.7), 0, 0, 0, 1], 'scale': [1.6, 0, 0, 0, 1, 0, 0, 0, .6], shear: [1, .6, 0, 0, 1, 0, 0, 0, 1], 'flat (singular)': [1, 0, 1, 0, 1, 1, 1, 1, 2] };
  const det3 = m => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  const cur2 = () => ID2.map((v, i) => lerp(v, M[i], t)), cur3 = () => ID3.map((v, i) => lerp(v, M3[i], t));
  const ap2 = (m, p) => [m[0] * p[0] + m[1] * p[1], m[2] * p[0] + m[3] * p[1]], ap3 = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];
  const eig2 = m => { const tr = m[0] + m[3], d = det2(m), disc = tr * tr / 4 - d; if (disc < 0) return null; const s = Math.sqrt(disc), l = [tr / 2 + s, tr / 2 - s]; return l.map(L => { let v = Math.abs(m[1]) > 1e-9 ? [m[1], L - m[0]] : Math.abs(m[2]) > 1e-9 ? [L - m[3], m[2]] : (L === m[0] ? [1, 0] : [0, 1]); const n = Math.hypot(...v) || 1; return { L, v: [v[0] / n, v[1] / n] }; }); };
  function draw2() {
    const m = cur2(), R = 4, fr = DSQ.frame2(W, H, PAD, [-R, R], [-R, R], { grid, xl: 'x', yl: 'y' }), X = fr.X, Y = fr.Y, d = det2(m);
    let s = svgOpen(W, H) + `<defs><clipPath id="mlc"><rect x="${PAD.l}" y="${PAD.t}" width="${W - PAD.l - PAD.r}" height="${H - PAD.t - PAD.b}"/></clipPath><marker id="ma" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7z" fill="#D03A3A"/></marker><marker id="mb" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7z" fill="#1F9D55"/></marker></defs>` + fr.svg + '<g clip-path="url(#mlc)">';
    for (let k = -4; k <= 4; k++) { const A = [ap2(m, [k, -5]), ap2(m, [k, 5])], B = [ap2(m, [-5, k]), ap2(m, [5, k])]; s += `<path d="${path2(A, X, Y)}" stroke="var(--c0)" stroke-width=".7" opacity=".45" fill="none"/><path d="${path2(B, X, Y)}" stroke="var(--c0)" stroke-width=".7" opacity=".45" fill="none"/>`; }
    const sq = [[0, 0], [1, 0], [1, 1], [0, 1]].map(p => ap2(m, p));
    s += `<path d="${path2(sq, X, Y)}Z" fill="${Math.abs(d) < 1e-3 ? 'var(--bad)' : 'var(--c1)'}" fill-opacity=".22" stroke="var(--c1)" stroke-width="1.2"/>`;
    const eg = eig2(m); if (eg) eg.forEach((e, i) => { s += `<line x1="${X(-e.v[0] * 6)}" y1="${Y(-e.v[1] * 6)}" x2="${X(e.v[0] * 6)}" y2="${Y(e.v[1] * 6)}" stroke="var(--c3)" stroke-width="1" stroke-dasharray="5 4"/>`; });
    s += cloud.map(p => { const q = ap2(m, p); return `<circle cx="${X(q[0])}" cy="${Y(q[1])}" r="2.4" fill="var(--c2)" fill-opacity=".8"/>`; }).join('');
    s += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(m[0])}" y2="${Y(m[2])}" stroke="#D03A3A" stroke-width="1.8" marker-end="url(#ma)"/><line x1="${X(0)}" y1="${Y(0)}" x2="${X(m[1])}" y2="${Y(m[3])}" stroke="#1F9D55" stroke-width="1.8" marker-end="url(#mb)"/></g>`;
    s += `<text x="${PAD.l + 8}" y="${PAD.t + 15}" style="font:600 11.5px var(--f-mono)" fill="var(--fg)">area of the unit square -> ${Math.abs(d).toFixed(2)}${d < 0 ? ' (flipped)' : ''}</text></svg>`;
    host.innerHTML = s;
    const inv = Math.abs(d) > 1e-6 ? (() => { const k = 1 / d; return [m[3] * k, -m[1] * k, -m[2] * k, m[0] * k]; })() : null, fx = v => (v >= 0 ? ' ' : '') + v.toFixed(2);
    c.say(`<span class="y">M</span> = [[${fx(m[0])}, ${fx(m[1])}], [${fx(m[2])}, ${fx(m[3])}]]   <span class="g"># red arrow = where (1,0) lands = column 1;  green = where (0,1) lands = column 2</span>\n<span class="y">det(M)</span> = ${m[0].toFixed(2)}x${m[3].toFixed(2)} - ${m[1].toFixed(2)}x${m[2].toFixed(2)} = <span class="y">${d.toFixed(3)}</span>   <span class="g"># every area is multiplied by |det|; the sign says whether the plane was flipped</span>\n` +
      (inv ? `<span class="y">inverse exists</span>: M^-1 = [[${fx(inv[0])}, ${fx(inv[1])}], [${fx(inv[2])}, ${fx(inv[3])}]]   <span class="g"># it undoes the transform</span>` : `<span class="r">det = 0: the whole plane is squashed onto a line. Information is lost, no inverse exists.</span>\n<span class="g"># This is what a REDUNDANT column does to a dataset: two columns carrying the same information give a determinant of 0 (see the Cleaning module).</span>`) +
      (eg ? `\n<span class="y">eigenvalues</span> ${eg.map(e => e.L.toFixed(2)).join(', ')}   <span class="g"># purple dashed lines: directions that are only stretched, never turned</span>` : `\n<span class="g"># no real eigen-directions: every direction is rotated</span>`));
  }
  function draw3() {
    const m = cur3(), items = [], d = det3(m), C = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map(p => ap3(m, p));
    [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]].forEach(f => items.push({ t: 'poly', pts: f.map(i => C[i]), fill: Math.abs(d) < 1e-3 ? 'rgba(200,50,60,.22)' : 'rgba(210,96,15,.16)', stroke: '#D2600F', sw: 1 }));
    cloud.forEach((p, i) => items.push({ t: 'pt', p: ap3(m, [p[0], p[1], (i % 5 - 2) * .3]), r: 4, color: '#1E8E5A' }));
    [['#D03A3A', 0], ['#1F9D55', 1], ['#2F6FE0', 2]].forEach(([col, j]) => items.push({ t: 'line', a: [0, 0, 0], b: [m[j], m[3 + j], m[6 + j]], color: col, w: 2.4 }));
    DSQ.axes3(3, ['x', 'y', 'z']).forEach(it => items.push(it)); p3.set(items, [.5, .5, .5], 4.2); p3.draw(1);
    const row = i => `[${[0, 1, 2].map(j => (m[3 * i + j] >= 0 ? ' ' : '') + m[3 * i + j].toFixed(1)).join(', ')}]`;
    c.say(`<span class="y">M</span> = ${row(0)}\n      ${row(1)}\n      ${row(2)}\n<span class="y">det(M)</span> = <span class="y">${d.toFixed(3)}</span>   <span class="g"># the unit cube becomes a slanted box; its VOLUME is |det|. ` + (Math.abs(d) < 1e-3 ? '</span><span class="r">det = 0: the box is flattened into a plane - one dimension of information is gone.</span>' : 'Drag the box to turn it.</span>'));
  }
  function draw() { p3.cv.hidden = dim !== '3d'; host.hidden = dim === '3d'; p3.grid = grid; dim === '3d' ? draw3() : draw2(); }
  const sl2 = ['a (1,1)', 'b (1,2)', 'c (2,1)', 'd (2,2)'].map((n, i) => c.slider(n, -3, 3, .05, M[i], v => { M[i] = v; t = 1; draw(); }));
  const sl3 = range(9).map(i => c.slider('m' + (Math.floor(i / 3) + 1) + (i % 3 + 1), -2.5, 2.5, .1, ID3[i], v => { M3[i] = v; t = 1; draw(); }));
  const syncSl = () => { sl2.forEach((s, i) => { s.parentNode.hidden = dim !== '2d'; s.value = M[i]; s.nextSibling.textContent = (+M[i]).toFixed(2).replace(/\.?0+$/, ''); }); sl3.forEach((s, i) => { s.parentNode.hidden = dim !== '3d'; s.value = M3[i]; s.nextSibling.textContent = (+M3[i]).toFixed(1).replace(/\.0$/, ''); }); };
  const presetSel = c.select('preset', Object.keys(PRE2), 'identity', k => { if (dim === '2d') M = [...PRE2[k]]; else M3 = [...(PRE3[k] || ID3)]; t = 1; syncSl(); draw(); });
  c.select('space', [['2d', '2-D plane (2x2 matrix)'], ['3d', '3-D box (3x3 matrix)']], dim, v => { dim = v; presetSel.innerHTML = ''; Object.keys(dim === '2d' ? PRE2 : PRE3).forEach(k => presetSel.append(h('option', { value: k }, k))); syncSl(); draw(); });
  c.button('Animate: identity -> M', () => { cancel && cancel(); cancel = anim(1400, u => { t = u; draw(); }, () => { t = 1; draw(); }); });
  const gb = c.button('Grid: on', () => { grid = !grid; gb.textContent = 'Grid: ' + (grid ? 'on' : 'off'); draw(); });
  syncSl(); draw();
};

/* ---------------------------------------------------------------- calcLab */
DSQ.viz.calcLab = (c, a) => {
  const W = 560, H = 380, PAD = { l: 40, r: 12, t: 12, b: 28 };
  let mode = a.mode || 'derivative', src = a.f || 'x^3 - 3x', f = () => 0, x0 = 1, hh = 1.2, ia = -1, ib = 2, n = 6, cancel = null, grid = true, surf = 'valley', lr = .25, path = [], pos = [2.4, -2.2];
  const stage = c.stage, wrap = h('div', { class: 'stagewrap' }), host = h('div', { style: { width: '100%' } }), p3 = Plot3D(wrap, { w: 560, h: 420, az: .8, el: .55 }); wrap.append(host); stage.append(wrap); c.onDestroy(() => { p3.destroy(); cancel && cancel(); });
  const FNS = { 'x^2 - 2x': 'x^2 - 2x', 'x^3 - 3x': 'x^3 - 3x', 'sin(x)': 'sin(x)', 'exp(-x^2)': 'exp(-x^2)', '0.5x^2 - 2': '0.5x^2 - 2' };
  const SURF = { bowl: (x, y) => .2 * (x * x + y * y), saddle: (x, y) => .25 * (x * x - y * y), bumps: (x, y) => 1.6 * Math.sin(x * .9) * Math.cos(y * .9), valley: (x, y) => .1 * (x + y) ** 2 + .015 * (x - y) ** 2 * 3 };
  const setF = s => { try { const e = DSQ.compileExpr(s, ['x']); const g = x => { const v = e.fn({ x }); return Number.isFinite(v) ? v : NaN; }; g(0); f = g; src = s; return true; } catch (er) { return false; } };
  const df = x => (f(x + 1e-5) - f(x - 1e-5)) / 2e-5, integ = (u, v, N = 4000) => { let sacc = 0; const st = (v - u) / N; for (let i = 0; i < N; i++) sacc += f(u + (i + .5) * st) * st; return sacc; };
  const sz = (x, y) => SURF[surf](x, y), grad = (x, y) => [(sz(x + 1e-4, y) - sz(x - 1e-4, y)) / 2e-4, (sz(x, y + 1e-4) - sz(x, y - 1e-4)) / 2e-4];
  function plot2(fn, X, Y, lo, hi, col, w = 1.4) { const P = []; for (let i = 0; i <= 240; i++) { const x = lo + (hi - lo) * i / 240, y = fn(x); P.push(Number.isFinite(y) ? [x, y] : null); } let d = '', pen = false; P.forEach(p => { if (!p) { pen = false; return; } d += (pen ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); pen = true; }); return `<path d="${d}" stroke="${col}" stroke-width="${w}" fill="none"/>`; }
  function range2() { let lo = 1e9, hi = -1e9; for (let i = 0; i <= 120; i++) { const y = f(-4 + 8 * i / 120); if (Number.isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } } const pad = (hi - lo) * .12 || 1; return [Math.max(-12, lo - pad), Math.min(12, hi + pad)]; }
  function drawDeriv() {
    const yr = range2(), fr = DSQ.frame2(W, H, PAD, [-4, 4], yr, { grid, xl: 'x', yl: 'f(x)' }), X = fr.X, Y = fr.Y, y0 = f(x0), m = df(x0), sec = (f(x0 + hh) - y0) / hh;
    let s = svgOpen(W, H) + `<defs><clipPath id="clc"><rect x="${PAD.l}" y="${PAD.t}" width="${W - PAD.l - PAD.r}" height="${H - PAD.t - PAD.b}"/></clipPath></defs>` + fr.svg + '<g clip-path="url(#clc)">' + plot2(f, X, Y, -4, 4, 'var(--c0)', 1.5);
    const line = (m_, col, dash) => `<line x1="${X(-4)}" y1="${Y(y0 + m_ * (-4 - x0))}" x2="${X(4)}" y2="${Y(y0 + m_ * (4 - x0))}" stroke="${col}" stroke-width="1.2" ${dash ? 'stroke-dasharray="5 4"' : ''}/>`;
    s += line(m, 'var(--c2)', true) + line(sec, 'var(--c1)', false) + `<circle cx="${X(x0)}" cy="${Y(y0)}" r="3.4" fill="var(--c0)"/><circle cx="${X(x0 + hh)}" cy="${Y(f(x0 + hh))}" r="3.4" fill="var(--c1)"/></g></svg>`;
    const fr2 = DSQ.frame2(W, 190, { l: 40, r: 12, t: 8, b: 26 }, [-4, 4], (() => { let lo = 1e9, hi = -1e9; for (let i = 0; i <= 120; i++) { const y = df(-4 + 8 * i / 120); if (Number.isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } } const p = (hi - lo) * .12 || 1; return [Math.max(-20, lo - p), Math.min(20, hi + p)]; })(), { grid, xl: 'x', yl: "f'(x)" });
    s += svgOpen(W, 190) + fr2.svg + plot2(df, fr2.X, fr2.Y, -4, 4, 'var(--c2)', 1.5) + `<circle cx="${fr2.X(x0)}" cy="${fr2.Y(m)}" r="3.4" fill="var(--c2)"/><line x1="${fr2.X(x0)}" x2="${fr2.X(x0)}" y1="8" y2="164" stroke="var(--fg)" stroke-width=".6" stroke-dasharray="3 3" opacity=".6"/></svg>`;
    host.innerHTML = s;
    c.say(`<span class="y">f(x)</span> = ${esc(src)}   at x = ${x0.toFixed(2)}: f = ${y0.toFixed(3)}\n<span class="y">secant slope</span> (rise over run across h = ${hh.toFixed(3)}) = ${sec.toFixed(4)}   <span class="y">tangent slope f'(x)</span> = ${m.toFixed(4)}\n<span class="g"># shrink h with the slider (or press "Shrink h"): the orange secant rotates into the green tangent. The lower graph is the slope itself at every x: where it crosses 0 the curve is flat (a minimum or maximum).</span>`);
  }
  function drawInt() {
    const yr = range2(), fr = DSQ.frame2(W, H, PAD, [-4, 4], [Math.min(yr[0], 0) - .2, Math.max(yr[1], 0) + .2], { grid, xl: 'x', yl: 'f(x)' }), X = fr.X, Y = fr.Y, w = (ib - ia) / n;
    let s = svgOpen(W, H) + `<defs><clipPath id="clc2"><rect x="${PAD.l}" y="${PAD.t}" width="${W - PAD.l - PAD.r}" height="${H - PAD.t - PAD.b}"/></clipPath></defs>` + fr.svg + '<g clip-path="url(#clc2)">', rs = 0;
    for (let i = 0; i < n; i++) { const x = ia + i * w, v = f(x + w / 2); if (!Number.isFinite(v)) continue; rs += v * w; s += `<rect x="${X(x)}" y="${Math.min(Y(v), Y(0))}" width="${Math.max(.5, X(x + w) - X(x))}" height="${Math.abs(Y(v) - Y(0))}" fill="${v >= 0 ? 'var(--c0)' : 'var(--c1)'}" fill-opacity=".22" stroke="${v >= 0 ? 'var(--c0)' : 'var(--c1)'}" stroke-width=".6"/>`; }
    s += plot2(f, X, Y, -4, 4, 'var(--fg)', 1.4) + `<line x1="${X(ia)}" x2="${X(ia)}" y1="${PAD.t}" y2="${H - PAD.b}" stroke="var(--c3)" stroke-width="1" stroke-dasharray="4 3"/><line x1="${X(ib)}" x2="${X(ib)}" y1="${PAD.t}" y2="${H - PAD.b}" stroke="var(--c3)" stroke-width="1" stroke-dasharray="4 3"/></g></svg>`;
    host.innerHTML = s; const ex = integ(ia, ib);
    c.say(`<span class="y">area under f from ${ia.toFixed(2)} to ${ib.toFixed(2)}</span>\n${n} rectangles (width ${w.toFixed(3)}):  sum = <span class="y">${rs.toFixed(4)}</span>      exact integral = <span class="y">${ex.toFixed(4)}</span>      error = ${Math.abs(rs - ex).toExponential(1)}\n<span class="g"># an integral is "add up infinitely many thin rectangles". More rectangles -> the sum closes in on the exact area (press "More rectangles"). Blue = area above the axis (counts +), orange = below (counts -). For a probability density the whole area is 1.</span>`);
  }
  const L = 3, sc = 1, mesh = () => { const items = [], G = 18; for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const x0_ = -L + 2 * L * i / G, x1 = -L + 2 * L * (i + 1) / G, y0_ = -L + 2 * L * j / G, y1 = -L + 2 * L * (j + 1) / G, q = [[x0_, y0_], [x1, y0_], [x1, y1], [x0_, y1]].map(p => [p[0], p[1], sz(p[0], p[1])]), zc = (q[0][2] + q[2][2]) / 2; items.push({ t: 'poly', pts: q, fill: heat((zc + 2.2) / 6.5), alpha: .5, stroke: 'rgba(60,70,65,.35)', sw: .4 }); } return items; };
  function drawGrad() {
    const items = mesh(), g = grad(pos[0], pos[1]), z = sz(pos[0], pos[1]), gn = Math.hypot(...g);
    for (let i = 1; i < path.length; i++) items.push({ t: 'line', a: [path[i - 1][0], path[i - 1][1], sz(...path[i - 1]) + .05], b: [path[i][0], path[i][1], sz(...path[i]) + .05], color: '#C8323C', w: 2 });
    items.push({ t: 'line', a: [pos[0], pos[1], z], b: [pos[0] - g[0] / (gn || 1) * 1.2, pos[1] - g[1] / (gn || 1) * 1.2, z], color: '#1E8E5A', w: 2.2 });
    items.push({ t: 'pt', p: [pos[0], pos[1], z], r: 8, color: '#111', ring: '#fff' }); items.push({ t: 'line', a: [pos[0], pos[1], -4], b: [pos[0], pos[1], z], color: '#555', w: 1, dash: [2, 3] });
    DSQ.axes3(4, ['x', 'y', 'f(x,y)']).forEach(it => items.push(it)); p3.set(items, [0, 0, 0], 5.6); p3.draw(1);
    c.say(`<span class="y">surface</span> ${surf}   point (${pos[0].toFixed(2)}, ${pos[1].toFixed(2)})   height f = ${z.toFixed(3)}\n<span class="y">gradient</span> = (${g[0].toFixed(3)}, ${g[1].toFixed(3)})   steepness ${gn.toFixed(3)}   <span class="g"># green line = the DOWNHILL direction (minus the gradient). Gradient descent repeats: pos = pos - lr x gradient.</span>\n<span class="y">steps taken</span> ${Math.max(0, path.length - 1)}   learning rate ${lr}   <span class="g"># too large a rate overshoots and bounces; too small crawls. Try the "valley" with 0.9.</span>`);
  }
  function draw() { p3.cv.hidden = mode !== 'gradient'; host.hidden = mode === 'gradient'; p3.grid = grid; mode === 'derivative' ? drawDeriv() : mode === 'integral' ? drawInt() : drawGrad(); sync(); }
  const ui = { f: [], d: [], i: [], g: [] }; const reg = (k, el) => { ui[k].push(el); return el; };
  const fi = c.text('f(x) =', src, v => { if (setF(v)) { fi.style.outline = ''; draw(); } else fi.style.outline = '2px solid var(--bad)'; }, '9em'); reg('f', fi.parentNode);
  reg('f', c.select('examples', Object.keys(FNS), 'x^3 - 3x', k => { fi.value = k; setF(k); draw(); }).parentNode);
  reg('d', c.slider('x', -3.5, 3.5, .05, x0, v => { x0 = v; draw(); }).parentNode); reg('d', c.slider('h (secant width)', .01, 2, .01, hh, v => { hh = v; draw(); }).parentNode);
  reg('d', c.button('Shrink h', () => { cancel && cancel(); const h0 = hh; cancel = anim(1800, u => { hh = Math.max(.01, h0 * (1 - u)); draw(); }); }));
  reg('i', c.slider('from a', -3.5, 3.5, .05, ia, v => { ia = Math.min(v, ib - .1); draw(); }).parentNode); reg('i', c.slider('to b', -3.5, 3.5, .05, ib, v => { ib = Math.max(v, ia + .1); draw(); }).parentNode);
  reg('i', c.slider('rectangles', 1, 200, 1, n, v => { n = v; draw(); }).parentNode); reg('i', c.button('More rectangles', () => { cancel && cancel(); cancel = anim(2200, u => { n = Math.max(1, Math.round(1 + 199 * u * u)); draw(); }); }));
  reg('g', c.select('surface', Object.keys(SURF), surf, v => { surf = v; path = []; draw(); }).parentNode);
  reg('g', c.slider('learning rate', .02, 1.2, .01, lr, v => { lr = v; draw(); }).parentNode);
  reg('g', c.button('Descend', () => { cancel && cancel(); path = [[...pos]]; let k = 0; const step = () => { const g = grad(pos[0], pos[1]); pos = [clamp(pos[0] - lr * g[0], -L, L), clamp(pos[1] - lr * g[1], -L, L)]; path.push([...pos]); draw(); if (++k < 40 && Math.hypot(...g) > .01) cancel = (() => { const id = setTimeout(step, 90); return () => clearTimeout(id); })(); }; step(); }));
  reg('g', c.button('Random start', () => { path = []; pos = [(Math.random() * 2 - 1) * 2.6, (Math.random() * 2 - 1) * 2.6]; draw(); }));
  c.select('topic', [['derivative', 'Derivative: slope of a curve'], ['integral', 'Integral: area under a curve'], ['gradient', 'Gradient: downhill on a 3-D surface']], mode, v => { mode = v; cancel && cancel(); draw(); });
  const gb = c.button('Grid: on', () => { grid = !grid; gb.textContent = 'Grid: ' + (grid ? 'on' : 'off'); draw(); });
  function sync() { const show = { derivative: ['f', 'd'], integral: ['f', 'i'], gradient: ['g'] }[mode]; Object.keys(ui).forEach(k => ui[k].forEach(el => { el.hidden = !show.includes(k); })); }
  p3.onClick = (cx, cy) => { const u = p3.unproject(cx, cy, 0); if (u && Math.abs(u[0]) <= L && Math.abs(u[1]) <= L) { path = []; pos = [u[0], u[1]]; draw(); } };
  setF(src); draw();
};

/* ---------------------------------------------------------------- confusionLab */
DSQ.viz.confusionLab = (c, a) => {
  const W = 520, H = 330, PAD = { l: 40, r: 12, t: 12, b: 30 };
  let sep = a.sep ?? 1.6, prev = a.prev ?? .4, thr = a.thr ?? .8, seed = 5, N = 240, data = [], grid = true, dragging = false;
  const stage = c.stage; stage.style.gridTemplateColumns = 'repeat(auto-fit,minmax(300px,1fr))'; stage.style.gap = '10px'; stage.style.alignItems = 'start';
  const host = h('div', { class: 'stagewrap' }), host2 = h('div', { class: 'stagewrap' }), tab = h('div', { style: { gridColumn: '1/-1' } }); stage.append(host, host2, tab);
  function gen() { const r = RNG(seed * 13 + 1); data = range(N).map(() => { const pos = r() < prev; return { y: pos ? 1 : 0, s: r.norm(pos ? sep : 0, 1) }; }); }
  const counts = t => { let TP = 0, FP = 0, TN = 0, FN = 0; data.forEach(d => { const p = d.s >= t; if (p && d.y) TP++; else if (p && !d.y) FP++; else if (!p && d.y) FN++; else TN++; }); return { TP, FP, TN, FN }; };
  const roc = () => { const ts = [...data.map(d => d.s)].sort((u, v) => v - u), P = data.filter(d => d.y).length || 1, Ng = data.length - data.filter(d => d.y).length || 1, pts = [[0, 0]]; ts.forEach(t => { const k = counts(t); pts.push([k.FP / Ng, k.TP / P]); }); pts.push([1, 1]); let auc = 0; for (let i = 1; i < pts.length; i++) auc += (pts[i][0] - pts[i - 1][0]) * (pts[i][1] + pts[i - 1][1]) / 2; return { pts, auc }; };
  function draw() {
    const xr = [-4, 6], fr = DSQ.frame2(W, H, PAD, xr, [0, 1], { grid, xl: 'model score', yl: 'share of each class' }), X = fr.X, Y = fr.Y, bw = .5, bins = {}; const hist = [[], []];
    for (let b = xr[0]; b < xr[1]; b += bw) { hist[0].push(0); hist[1].push(0); }
    data.forEach(d => { const i = Math.floor((d.s - xr[0]) / bw); if (i >= 0 && i < hist[0].length) hist[d.y][i]++; });
    const tot = [data.filter(d => !d.y).length || 1, data.filter(d => d.y).length || 1], mx = Math.max(...hist[0].map(v => v / tot[0]), ...hist[1].map(v => v / tot[1])) || 1;
    let s = svgOpen(W, H, 'style="touch-action:none;cursor:ew-resize"') + fr.svg;
    [0, 1].forEach(k => hist[k].forEach((v, i) => { const hgt = v / tot[k] / mx * .92; if (!hgt) return; s += `<rect x="${X(xr[0] + i * bw)}" y="${Y(hgt)}" width="${X(xr[0] + bw) - X(xr[0])}" height="${Y(0) - Y(hgt)}" fill="${k ? 'var(--c1)' : 'var(--c0)'}" fill-opacity=".28" stroke="${k ? 'var(--c1)' : 'var(--c0)'}" stroke-width=".7"/>`; }));
    s += `<rect x="${X(thr)}" y="${PAD.t}" width="${Math.max(0, X(xr[1]) - X(thr))}" height="${H - PAD.t - PAD.b}" fill="var(--fg)" fill-opacity=".04"/><line x1="${X(thr)}" x2="${X(thr)}" y1="${PAD.t}" y2="${H - PAD.b}" stroke="var(--fg)" stroke-width="1.4"/><text x="${X(thr) + 5}" y="${PAD.t + 12}" style="font:600 11px var(--f-mono)" fill="var(--fg)">threshold ${thr.toFixed(2)}</text>`;
    s += `<text x="${PAD.l + 8}" y="${PAD.t + 14}" style="font:600 11px var(--f-body)" fill="var(--c0)">actual NEGATIVE</text><text x="${PAD.l + 8}" y="${PAD.t + 28}" style="font:600 11px var(--f-body)" fill="var(--c1)">actual POSITIVE</text><text x="${W - PAD.r - 6}" y="${H - PAD.b - 8}" text-anchor="end" style="font:600 10.5px var(--f-body)" fill="var(--muted)">predicted positive ></text></svg>`;
    host.innerHTML = s;
    const R = roc(), k = counts(thr), P = k.TP + k.FN || 1, Ng = k.FP + k.TN || 1, fr2 = DSQ.frame2(W, H, { l: 40, r: 12, t: 12, b: 30 }, [0, 1], [0, 1], { grid, xl: 'false positive rate', yl: 'true positive rate (recall)', nx: 5, ny: 5 });
    host2.innerHTML = svgOpen(W, H) + fr2.svg + `<line x1="${fr2.X(0)}" y1="${fr2.Y(0)}" x2="${fr2.X(1)}" y2="${fr2.Y(1)}" stroke="var(--muted)" stroke-width=".8" stroke-dasharray="4 4"/><path d="${path2(R.pts, fr2.X, fr2.Y)}" stroke="var(--c3)" stroke-width="1.6" fill="none"/><circle cx="${fr2.X(k.FP / Ng)}" cy="${fr2.Y(k.TP / P)}" r="4.5" fill="var(--fg)"/><text x="${W - 16}" y="${H - 46}" text-anchor="end" style="font:600 12px var(--f-mono)" fill="var(--c3)">AUC = ${R.auc.toFixed(3)}</text></svg>`;
    const acc = (k.TP + k.TN) / N, prc = k.TP / ((k.TP + k.FP) || 1), rec = k.TP / P, f1 = 2 * prc * rec / ((prc + rec) || 1);
    const cell = (v, t, d, col) => `<td style="background:${col};padding:8px 12px;text-align:center"><b style="font-size:20px">${v}</b><br><span class="muted" style="font-size:11px">${t}</span><br><span style="font-size:11px">${d}</span></td>`;
    tab.innerHTML = `<table style="border-collapse:collapse;margin:0 auto 6px;font-size:13px"><tr><td></td><th style="padding:4px 12px">predicted POSITIVE</th><th style="padding:4px 12px">predicted NEGATIVE</th></tr><tr><th style="text-align:right;padding-right:8px">actually POSITIVE</th>${cell(k.TP, 'TRUE positive', 'caught correctly', 'var(--c2s)')}${cell(k.FN, 'FALSE negative', 'missed (type II)', 'var(--c1s)')}</tr><tr><th style="text-align:right;padding-right:8px">actually NEGATIVE</th>${cell(k.FP, 'FALSE positive', 'false alarm (type I)', 'var(--c1s)')}${cell(k.TN, 'TRUE negative', 'left alone correctly', 'var(--c2s)')}</tr></table>`;
    c.say(`<span class="y">accuracy</span> (TP+TN)/all = ${(acc * 100).toFixed(1)}%    <span class="y">precision</span> TP/(TP+FP) = ${(prc * 100).toFixed(1)}%    <span class="y">recall</span> TP/(TP+FN) = ${(rec * 100).toFixed(1)}%    <span class="y">F1</span> = ${f1.toFixed(3)}\n<span class="g"># slide the threshold right: fewer false alarms (precision up) but more missed positives (recall down). The black dot on the ROC curve moves with it. Accuracy alone can fool you: with 5% positives a model that says "negative" to everyone scores 95%.</span>`);
  }
  const svgX = e => { const sv = $('svg', host), r = sv.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width, fr = DSQ.frame2(W, H, PAD, [-4, 6], [0, 1], { grid: false }); return clamp(fr.ix(px), -3.9, 5.9); };
  host.addEventListener('pointerdown', e => { dragging = true; thr = svgX(e); sync(); draw(); }); const mv = e => { if (dragging) { thr = svgX(e); sync(); draw(); } }, up = () => { dragging = false; };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); c.onDestroy(() => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); });
  const ts = c.slider('threshold', -3, 5, .05, thr, v => { thr = v; draw(); }); const sync = () => { ts.value = thr; ts.nextSibling.textContent = thr.toFixed(2); };
  c.slider('class separation', 0, 4, .1, sep, v => { sep = v; draw(); }); c.slider('share of positives', .05, .8, .01, prev, v => { prev = v; gen(); draw(); }, v => (v * 100).toFixed(0) + '%');
  c.button('New sample', () => { seed++; gen(); draw(); }); const gb = c.button('Grid: on', () => { grid = !grid; gb.textContent = 'Grid: ' + (grid ? 'on' : 'off'); draw(); });
  gen(); draw();
};

/* ---------------------------------------------------------------- cltLab */
DSQ.viz.cltLab = (c, a) => {
  const W = 560, H = 330, PAD = { l: 40, r: 12, t: 12, b: 30 };
  let shape = 'skewed', n = 5, means = [], last = [], seed = 1, grid = true, cancel = null; const r = RNG(31);
  const draw1 = () => shape === 'normal' ? r.norm(50, 10) : shape === 'uniform' ? 20 + r() * 60 : -Math.log(1 - r()) * 20 + 20;
  const pop = { normal: [50, 10], uniform: [50, 60 / Math.sqrt(12)], skewed: [40, 20] };
  const host = h('div', { class: 'stagewrap', style: { width: '100%' } }); c.stage.append(host);
  function hist(vals, lo, hi, nb) { const bw = (hi - lo) / nb, b = new Array(nb).fill(0); vals.forEach(v => { const i = Math.floor((v - lo) / bw); if (i >= 0 && i < nb) b[i]++; }); return { b, bw }; }
  function draw() {
    const [mu, sd] = pop[shape], lo = shape === 'uniform' ? 10 : 0, hi = shape === 'skewed' ? 140 : 100, se = sd / Math.sqrt(n);
    const fr = DSQ.frame2(W, H, PAD, [lo, hi], [0, 1], { grid, xl: 'sample mean', yl: 'relative frequency' }), X = fr.X, Y = fr.Y; let s = svgOpen(W, H) + fr.svg;
    if (means.length) { const hh = hist(means, lo, hi, 50), mx = Math.max(...hh.b, 1); hh.b.forEach((v, i) => { if (!v) return; s += `<rect x="${X(lo + i * hh.bw)}" y="${Y(v / mx * .9)}" width="${X(lo + hh.bw) - X(lo)}" height="${Y(0) - Y(v / mx * .9)}" fill="var(--c0)" fill-opacity=".3" stroke="var(--c0)" stroke-width=".6"/>`; }); }
    const bell = []; for (let i = 0; i <= 200; i++) { const x = lo + (hi - lo) * i / 200; bell.push([x, .9 * Math.exp(-.5 * ((x - mu) / se) ** 2)]); } s += `<path d="${path2(bell, X, Y)}" stroke="var(--c1)" stroke-width="1.5" fill="none"/>`;
    s += `<line x1="${X(mu)}" x2="${X(mu)}" y1="${PAD.t}" y2="${H - PAD.b}" stroke="var(--fg)" stroke-width=".8" stroke-dasharray="4 3"/>`;
    if (last.length) { const m = last.reduce((p, q) => p + q, 0) / last.length, sdv = Math.sqrt(last.reduce((p, q) => p + (q - m) ** 2, 0) / (last.length - 1 || 1)), ci = 1.96 * sdv / Math.sqrt(last.length); s += `<line x1="${X(m - ci)}" x2="${X(m + ci)}" y1="${Y(.04)}" y2="${Y(.04)}" stroke="var(--c2)" stroke-width="2.2"/><circle cx="${X(m)}" cy="${Y(.04)}" r="3.6" fill="var(--c2)"/>`; }
    host.innerHTML = s + '</svg>';
    const mm = means.length ? means.reduce((p, q) => p + q, 0) / means.length : NaN, ms = means.length > 1 ? Math.sqrt(means.reduce((p, q) => p + (q - mm) ** 2, 0) / (means.length - 1)) : NaN;
    c.say(`<span class="y">population</span> = ${shape} (mean ${mu}, spread ${sd.toFixed(1)}) - NOT bell-shaped unless you chose normal.   <span class="y">samples of n = ${n}</span>\n<span class="y">${means.length}</span> sample means so far: their mean = ${Number.isFinite(mm) ? mm.toFixed(2) : '-'}, their spread = ${Number.isFinite(ms) ? ms.toFixed(2) : '-'}   <span class="g"># theory says the spread of the means is sd/sqrt(n) = ${se.toFixed(2)}  (orange bell)</span>\n<span class="g"># Central Limit Theorem: whatever the population looks like, averages of many samples pile up in a bell shape around the true mean. The green bar is a 95% confidence interval from the LAST single sample: about 95 of 100 such bars would contain the true mean (dashed line).</span>`);
  }
  const take = k => { for (let i = 0; i < k; i++) { last = range(n).map(draw1); means.push(last.reduce((p, q) => p + q, 0) / n); } draw(); };
  c.select('population', [['skewed', 'skewed (like incomes)'], ['uniform', 'uniform (dice-like)'], ['normal', 'normal']], shape, v => { shape = v; means = []; last = []; draw(); });
  c.slider('sample size n', 1, 60, 1, n, v => { n = v; means = []; last = []; draw(); });
  c.button('Draw 1 sample', () => take(1)); c.button('Draw 500 samples', () => { cancel && cancel(); let k = 0; cancel = anim(1600, u => { const want = Math.round(500 * u); take(want - k); k = want; }); });
  c.button('Reset', () => { means = []; last = []; draw(); }); const gb = c.button('Grid: on', () => { grid = !grid; gb.textContent = 'Grid: ' + (grid ? 'on' : 'off'); draw(); });
  c.onDestroy(() => cancel && cancel()); draw();
};
