'use strict';
/* =====================================================================
   Two "see inside it" pages.
   1. tsView: a time series wrapped round a cylinder. Seasonality shows up as bulges that line up above each other when you wrap at the right period;
      next to it the flat chart with a train/test split and four real forecasting methods (naive, seasonal naive, moving average, Holt-Winters)
      with their errors, and the seasonal strength you measure for the period you chose.
   2. convView: a convolution done step by step on a small image: the kernel slides, nine products are added into one output pixel, the feature map builds,
      then max-pooling halves it. Pick a kernel (edge, blur, sharpen...), draw your own pixels, or edit the kernel numbers.
   ===================================================================== */
function tsView(o = {}) {
  const K = viewKit(o, { title: 'Time series: wrap it round a clock', lead: 'A monthly series wrapped round a cylinder so that January sits above January. Choose the right period and the seasonal bulges stack up in straight lines; choose a wrong one and they smear into a spiral. Below it: four honest forecasts and their errors.', th: 240, az: .65, el: .5, zoom: 1.55 });
  const { S, p3, trace, side, info } = K;
  const P = { n: 96, H: 12, seed: 3, season: 12, amp: 6, trend: .35, noise: 1.5, wrap: 12, detrend: true, method: 'hw', hi: 0, prog: 0 };
  let y = [], dirty = true;
  const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  const gen = () => { const r = RNG(100 + P.seed); y = []; for (let t = 0; t < P.n; t++) y.push(20 + P.trend * t + P.amp * Math.sin(2 * Math.PI * t / P.season) + .4 * P.amp * Math.sin(4 * Math.PI * t / P.season + 1) + r.norm(0, P.noise)); P.prog = 0; dirty = true; };
  const linfit = a => { const n = a.length, mx = (n - 1) / 2, my = mean(a); let sxy = 0, sxx = 0; a.forEach((v, i) => { sxy += (i - mx) * (v - my); sxx += (i - mx) ** 2; }); const b = sxy / sxx; return { a: my - b * mx, b }; };
  const hw = (tr, m, H, a = .3, b = .05, g = .3) => { const l0 = mean(tr.slice(0, m)); let L = l0, B = (mean(tr.slice(m, 2 * m)) - l0) / m; const Sx = tr.slice(0, m).map(v => v - l0); for (let t = m; t < tr.length; t++) { const s = Sx[t % m], Lp = L; L = a * (tr[t] - s) + (1 - a) * (L + B); B = b * (L - Lp) + (1 - b) * B; Sx[t % m] = g * (tr[t] - L) + (1 - g) * s; } return Array.from({ length: H }, (_, h) => L + (h + 1) * B + Sx[(tr.length + h) % m]); };
  const methods = () => { const tr = y.slice(0, P.n - P.H), m = P.wrap, H = P.H, last = tr[tr.length - 1]; return { naive: Array(H).fill(last), snaive: Array.from({ length: H }, (_, h) => tr[tr.length - m + (h % m)]), ma: Array(H).fill(mean(tr.slice(-m))), hw: tr.length >= 2 * m ? hw(tr, m, H) : Array(H).fill(NaN) }; };
  const NAMES = { naive: 'Naive (repeat the last value)', snaive: 'Seasonal naive (repeat last season)', ma: 'Moving average (last season)', hw: 'Holt-Winters (level + trend + season)' }, COLS = { naive: '#8895a8', snaive: '#7A4FD0', ma: '#D2600F', hw: '#1E8E5A' };
  const strength = () => { const lf = linfit(y), d = y.map((v, i) => v - (lf.a + lf.b * i)), m = P.wrap, ph = Array.from({ length: m }, (_, k) => mean(d.filter((_, i) => i % m === k))), res = d.map((v, i) => v - ph[i % m]), vr = a => mean(a.map(v => v * v)) - mean(a) ** 2; return Math.max(0, 1 - vr(res) / vr(d)); };
  function scene() {
    const it = [], R = 2.1, m = P.wrap, lf = linfit(y), kk = P.detrend ? .1 : .05, upto = Math.floor(P.prog * P.n), mu = mean(y);
    const pos = t => { const th = 2 * Math.PI * t / m, v = P.detrend ? y[t] - (lf.a + lf.b * t) : y[t] - mu, r = Math.max(.35, R + kk * v * (P.detrend ? 1 : 1)); return [r * Math.cos(th), r * Math.sin(th), t / P.n * 6 - 3]; };
    for (let k = 0; k < m; k++) { const th = 2 * Math.PI * k / m; it.push({ t: 'line', a: [R * Math.cos(th), R * Math.sin(th), -3.2], b: [R * Math.cos(th), R * Math.sin(th), 3.2], color: k === P.hi % m ? 'rgba(255,214,102,.55)' : 'rgba(255,255,255,.08)', w: k === P.hi % m ? 1.6 : .7 }); if (m <= 24) it.push(SH.label([(R + .55) * Math.cos(th), (R + .55) * Math.sin(th), -3.35], String(k + 1), { size: 9.5, color: k === P.hi % m ? '#ffd166' : '#8895a8' })); }
    for (const z of [-3, 0, 3]) { let pv = null; for (let i = 0; i <= 48; i++) { const th = i / 48 * 6.2832, q = [R * Math.cos(th), R * Math.sin(th), z]; if (pv) it.push({ t: 'line', a: pv, b: q, color: 'rgba(255,255,255,.12)', w: .7 }); pv = q; } }
    let prev = null; for (let t = 0; t <= Math.min(upto, P.n - 1); t++) { const q = pos(t), test = t >= P.n - P.H, col = test ? '#ffb86b' : `hsl(${210 - t / P.n * 40},80%,${58 + (t % m === P.hi % m ? 12 : 0)}%)`; if (prev) it.push({ t: 'line', a: prev, b: q, color: test ? 'rgba(255,184,107,.8)' : 'rgba(140,190,255,.55)', w: 1.4 }); it.push({ t: 'pt', p: q, r: t % m === P.hi % m ? 6 : 3.2, color: col, ring: t % m === P.hi % m ? '#fff' : null }); prev = q; }
    const same = []; for (let t = P.hi % m; t < Math.min(upto + 1, P.n); t += m) same.push(pos(t)); for (let i = 0; i + 1 < same.length; i++) it.push({ t: 'line', a: same[i], b: same[i + 1], color: 'rgba(255,214,102,.9)', w: 1.6 });
    if (P.prog >= 1) { const f = methods()[P.method]; f.forEach((v, h) => { const t = P.n - P.H + h, th = 2 * Math.PI * t / m, vv = P.detrend ? v - (lf.a + lf.b * t) : v - mu, r = Math.max(.35, R + kk * vv); it.push({ t: 'pt', p: [r * Math.cos(th), r * Math.sin(th), t / P.n * 6 - 3], r: 5, color: 'rgba(0,0,0,0)', ring: COLS[P.method] }); }); }
    it.push(SH.label([0, 0, 3.55], `wrapped every ${m} steps · gold line = the same season position each cycle`, { size: 10.5, color: '#cfeaff' }));
    return it;
  }
  function chart() {
    const W = 760, Hh = 240, x0 = 38, x1 = 750, y0 = 14, y1 = 205, f = methods(), all = y.concat(...Object.values(f).map(a => a.filter(v => isFinite(v)))), lo = Math.min(...all) - 1, hi = Math.max(...all) + 1, X = t => x0 + t / (P.n - 1) * (x1 - x0), Y = v => y1 - (v - lo) / (hi - lo) * (y1 - y0), lf = linfit(y);
    const path = (arr, off = 0) => arr.map((v, i) => (i ? 'L' : 'M') + X(off + i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
    const upto = Math.floor(P.prog * P.n); let s = `<line x1="${X(P.n - P.H)}" x2="${X(P.n - P.H)}" y1="${y0}" y2="${y1}" stroke="#8895a8" stroke-dasharray="4 4"/><text x="${X(P.n - P.H) + 4}" y="${y0 + 8}" class="tk">test ${P.H}</text><text x="${x0}" y="${y0 + 8}" class="tk">train</text>`;
    s += `<path d="${path(y.slice(0, Math.max(2, upto + 1)))}" fill="none" stroke="#2F6FE0" stroke-width="1.8"/><path d="M${X(0)} ${Y(lf.a)}L${X(P.n - 1)} ${Y(lf.a + lf.b * (P.n - 1))}" stroke="#8895a8" stroke-width="1" stroke-dasharray="2 3"/>`;
    if (P.prog >= 1) Object.entries(f).forEach(([k, a]) => { if (a.every(isFinite)) s += `<path d="${path(a, P.n - P.H)}" fill="none" stroke="${COLS[k]}" stroke-width="${k === P.method ? 3 : 1.4}" opacity="${k === P.method ? 1 : .6}"/>`; });
    for (let k = P.hi % P.wrap; k < Math.min(upto + 1, P.n); k += P.wrap) s += `<circle cx="${X(k)}" cy="${Y(y[k])}" r="4" fill="#ffd166" stroke="#fff"/>`;
    trace.innerHTML = s + `<text x="${x0}" y="${Hh - 8}" class="tk">blue = the series; dotted = linear trend; gold dots = the same season position in each cycle; coloured lines = forecasts for the test months</text>`;
  }
  function num() {
    const f = methods(), act = y.slice(P.n - P.H), mae = Object.fromEntries(Object.entries(f).map(([k, a]) => [k, mean(a.map((v, i) => Math.abs(v - act[i])))])), best = Object.entries(mae).filter(([, v]) => isFinite(v)).sort((a, b) => a[1] - b[1])[0], st = strength();
    side.querySelector('#tsnum').innerHTML = K.num([['seasonal strength', `<b>${st.toFixed(2)}</b> at period ${P.wrap} (1 = a perfectly repeating pattern). Slide the period and watch it peak at the true one (${P.season}).`], ...Object.keys(NAMES).map(k => [k === P.method ? '▶ ' + NAMES[k].split(' (')[0] : NAMES[k].split(' (')[0], isFinite(mae[k]) ? `MAE <b>${mae[k].toFixed(2)}</b>${best && best[0] === k ? ' (best)' : ''}` : 'needs two full seasons of history']), ['honest test', 'Forecasts only use the first ' + (P.n - P.H) + ' points; errors are measured on the last ' + P.H + ' (a time-ordered split, never a random one).']]);
  }
  const bar = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, K.play, K.tb('Replay', () => { P.prog = 0; }), K.speed(), K.slider('wrap period', 2, 24, 1, P.wrap, v => { P.wrap = v; dirty = true; }, 'The cylinder is wrapped every this many steps'), K.slider('highlight position', 0, 23, 1, 0, v => { P.hi = v; dirty = true; }), K.check('remove trend', P.detrend, v => { P.detrend = v; }), K.select('forecast', Object.keys(NAMES).map(k => [k, NAMES[k].split(' (')[0]]), P.method, v => { P.method = v; dirty = true; }), ...K.zoomBar());
  side.append(h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '10px' } }, K.select('true season', [[7, '7 (weekly)'], [12, '12 (monthly)'], [24, '24 (hourly)']], P.season, v => { P.season = +v; P.wrap = +v; gen(); }), K.slider('season size', 0, 12, 1, P.amp, v => { P.amp = v; gen(); }), K.slider('trend', 0, 1, .05, P.trend, v => { P.trend = v; gen(); }), K.slider('noise', 0, 5, .25, P.noise, v => { P.noise = v; gen(); }), K.tb('New data', () => { P.seed++; gen(); })), h('div', { class: 'ill-num mono', id: 'tsnum' }));
  info.innerHTML = `<h3 style="margin:0 0 6px">What the cylinder shows</h3><p>A time series is usually drawn as a line from left to right. Wrap it round a cylinder so each turn is one season (12 months, 7 days, 24 hours) and the same position in every cycle lines up vertically. If there is <b>seasonality</b> at that period, the bulges stack: January is high every year. Wrap with the wrong period and the stack tilts into a spiral, because the pattern no longer repeats at that length. That is exactly how you pick a seasonal period.</p><p>The <b>trend</b> is the slow rise; switch it off to see only the repeating part. Then try the forecasts: the <b>naive</b> forecast repeats the last value, <b>seasonal naive</b> repeats last season, a <b>moving average</b> smooths, and <b>Holt-Winters</b> tracks level, trend and season together. Whichever has the lowest error on data it has not seen wins; with a clear season, the two seasonal methods beat the others easily.</p>`;
  gen();
  K.start((dt) => { if (S.playing && P.prog < 1) { P.prog = Math.min(1, P.prog + dt / 6500 * S.speed); dirty = true; } p3.set(scene(), [0, 0, 0], 7.2); p3.draw(1); if (dirty) { chart(); num(); dirty = false; } });
  p3.set3d(.65, .5);
  return K.build(bar);
}

/* ---------------------------------------------------------------- convolution ---------------------------------------------------------------- */
const CONV_KERNELS = {
  edge: ['Vertical edges', [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]], hedge: ['Horizontal edges', [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]], blur: ['Blur (average)', [[1, 1, 1], [1, 1, 1], [1, 1, 1]].map(r => r.map(v => +(v / 9).toFixed(3)))],
  sharp: ['Sharpen', [[0, -1, 0], [-1, 5, -1], [0, -1, 0]]], ident: ['Identity', [[0, 0, 0], [0, 1, 0], [0, 0, 0]]], custom: ['Your own', [[0, 1, 0], [1, -4, 1], [0, 1, 0]]],
};
const CONV_IMGS = {
  box: n => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i >= 2 && i < n - 2 && j >= 2 && j < n - 2 ? 1 : 0))),
  cross: n => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (Math.abs(i - j) <= 0 || Math.abs(i + j - (n - 1)) <= 0 ? 1 : 0))),
  digit: n => { const g = ['..####..', '.##..##.', '.....##.', '....##..', '...##...', '..##....', '.#######', '........']; return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (g[i] && g[i][j] === '#' ? 1 : 0))); },
  grad: n => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => j / (n - 1))),
};
function convView(o = {}) {
  const K = viewKit(o, { title: 'Convolution: a small window that slides', lead: 'The heart of a convolutional network. A 3 x 3 window of numbers (the kernel) slides over the image; at every stop it multiplies, adds and writes one number. The kernel decides what it responds to: edges, blur, sharp detail.', th: 150, az: .55, el: .8, zoom: 1.5 });
  const { S, p3, trace, side, info } = K, n = 8;
  const C = { img: 'digit', kern: 'edge', stride: 1, pad: 0, pos: 0, t: 0, pool: false, kernel: JSON.parse(JSON.stringify(CONV_KERNELS.edge[1])), image: CONV_IMGS.digit(n) };
  const outSize = () => Math.floor((n + 2 * C.pad - 3) / C.stride) + 1;
  const padded = () => { const p = C.pad, m = n + 2 * p; return Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => (i - p >= 0 && i - p < n && j - p >= 0 && j - p < n ? C.image[i - p][j - p] : 0))); };
  const feature = () => { const A = padded(), s = outSize(); return Array.from({ length: s }, (_, i) => Array.from({ length: s }, (_, j) => { let v = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) v += A[i * C.stride + a][j * C.stride + b] * C.kernel[a][b]; return v; })); };
  const pooled = F => { const s = Math.floor(F.length / 2); return Array.from({ length: s }, (_, i) => Array.from({ length: s }, (_, j) => Math.max(F[2 * i][2 * j], F[2 * i][2 * j + 1], F[2 * i + 1][2 * j], F[2 * i + 1][2 * j + 1]))); };
  const col = (v, lo, hi) => { const u = Math.max(0, Math.min(1, (v - lo) / ((hi - lo) || 1))); return `hsl(${220 - u * 190},75%,${28 + u * 38}%)`; };
  const grid = (M, ox, oy, z, lo, hi, cell = .5, hot) => { const out = []; M.forEach((r, i) => r.forEach((v, j) => { const x = ox + j * cell, yy = oy - i * cell, isHot = hot && hot(i, j); out.push(...SH.box([x, yy, z + (v - lo) / ((hi - lo) || 1) * .25 / 2], [cell * .92, cell * .92, .06 + (v - lo) / ((hi - lo) || 1) * .25], col(v, lo, hi), { a: .85, glow: isHot ? .8 : 0, edge: .35 })); })); return out; };
  function scene() {
    const A = padded(), F = feature(), s = F.length, flat = F.flat(), lo = Math.min(...flat), hi = Math.max(...flat), total = s * s, k = Math.min(total - 1, Math.floor(C.pos)), ki = Math.floor(k / s), kj = k % s, it = [], cell = .5, m = A.length;
    it.push(...grid(A, -4.2 - (m - 8) * .1, 1.4, 0, 0, 1, cell, (i, j) => i >= ki * C.stride && i < ki * C.stride + 3 && j >= kj * C.stride && j < kj * C.stride + 3));
    it.push(SH.label([-2.2, -2.6, 0], 'input image' + (C.pad ? ` (padded by ${C.pad})` : ''), { size: 11, color: '#cfeaff' }));
    const wx = -4.2 - (m - 8) * .1 + kj * C.stride * cell, wy = 1.4 - ki * C.stride * cell;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) it.push({ t: 'txt', p: [wx + b * cell, wy - a * cell, .5], s: String(+C.kernel[a][b].toFixed(2)), size: 9, color: '#ffd166', bold: true });
    it.push(...SH.box([wx + cell, wy - cell, .2], [cell * 3, cell * 3, .5], '#ffd166', { a: .12, glow: .5, edge: 1 }));
    const done = F.map((r, i) => r.map((v, j) => (i * s + j <= k ? v : lo)));
    it.push(...grid(done, 1.2, 1.4, 0, lo, hi, cell, (i, j) => i === ki && j === kj));
    it.push(SH.label([2.6, -2.6, 0], `feature map (${s} x ${s})`, { size: 11, color: '#cfeaff' }));
    it.push({ t: 'line', a: [wx + cell, wy - cell, .5], b: [1.2 + kj * cell, 1.4 - ki * cell, .4], color: 'rgba(255,214,102,.8)', w: 1.8 });
    if (C.pool && C.pos >= total - 1) { const Pm = pooled(F); it.push(...grid(Pm, 5.4, 1.4, 0, lo, hi, cell * 1.3)); it.push(SH.label([6.4, -1.4, 0], `max-pool 2x2 (${Pm.length} x ${Pm.length})`, { size: 11, color: '#cfeaff' })); }
    return it;
  }
  function drawTrace() {
    const A = padded(), F = feature(), s = F.length, k = Math.min(s * s - 1, Math.floor(C.pos)), ki = Math.floor(k / s), kj = k % s; let sum = 0, terms = [];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { const p = A[ki * C.stride + a][kj * C.stride + b] * C.kernel[a][b]; sum += p; terms.push(`${+A[ki * C.stride + a][kj * C.stride + b].toFixed(1)}x${+C.kernel[a][b].toFixed(2)}`); }
    trace.innerHTML = `<text x="12" y="20" class="tk" style="font-size:13px">output pixel (${ki}, ${kj}) = ${terms.join(' + ')}</text><text x="12" y="48" class="tk" style="font-size:15px;font-weight:700">= ${sum.toFixed(2)}</text><text x="12" y="76" class="tk">output size = floor((${n} + 2 x ${C.pad} - 3) / ${C.stride}) + 1 = ${s}</text><text x="12" y="104" class="tk">parameters in this layer: 3 x 3 = 9 weights (+1 bias) - the same 9 numbers are reused at every position, which is why a CNN needs far fewer weights than a dense layer</text><text x="12" y="132" class="tk">dense layer on the same image: ${n * n} inputs x ${s * s} outputs = ${n * n * s * s} weights</text>`;
  }
  const kEditor = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } });
  const setKernel = key => { C.kern = key; C.kernel = JSON.parse(JSON.stringify(CONV_KERNELS[key][1])); buildEditor(); C.pos = 0; };
  function buildEditor() { kEditor.innerHTML = ''; const g = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,64px)', gap: '4px' } }); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) g.append(h('input', { type: 'number', step: .1, value: C.kernel[a][b], style: { width: '64px' }, oninput: e => { C.kernel[a][b] = +e.target.value || 0; C.kern = 'custom'; C.pos = 0; } })); kEditor.append(g); }
  const bar = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, K.play, K.tb('Step', () => { S.playing = false; K.play.textContent = '▶ Play'; C.pos = Math.min(outSize() ** 2 - 1, Math.floor(C.pos) + 1); }), K.tb('Restart', () => { C.pos = 0; }), K.speed(), K.select('image', [['digit', 'a digit 7'], ['box', 'a square'], ['cross', 'a cross'], ['grad', 'a gradient']], C.img, v => { C.img = v; C.image = CONV_IMGS[v](n); C.pos = 0; }), K.select('kernel', Object.entries(CONV_KERNELS).map(([k, v]) => [k, v[0]]), C.kern, v => setKernel(v)), K.select('stride', [[1, 'stride 1'], [2, 'stride 2']], C.stride, v => { C.stride = +v; C.pos = 0; }), K.select('padding', [[0, 'no padding'], [1, 'pad 1 (same size)']], C.pad, v => { C.pad = +v; C.pos = 0; }), K.check('then max-pool', C.pool, v => { C.pool = v; }), ...K.zoomBar());
  side.append(h('b', {}, 'The kernel (edit any number: it becomes "Your own")'), kEditor); buildEditor();
  info.innerHTML = `<h3 style="margin:0 0 6px">Why convolution is the right tool for images</h3><p>A <b>convolution</b> lays the 3 x 3 kernel over a patch, multiplies each pixel by the matching kernel number, adds the nine products and writes the sum into the output. Then it slides one step (the <b>stride</b>) and repeats. The kernel <code>[-1 0 1; -2 0 2; -1 0 1]</code> subtracts the left side from the right, so it lights up wherever brightness changes from left to right: a vertical edge. A blur kernel averages, a sharpen kernel exaggerates the centre.</p><p>A CNN does not use hand-made kernels: it <b>learns</b> them by gradient descent, dozens per layer. Early layers learn edges and colours, later layers combine them into corners, textures, parts and objects. Two ideas make it efficient: <b>weight sharing</b> (the same nine numbers at every position, so far fewer parameters than a dense layer) and <b>pooling</b> (keep the strongest response in each 2 x 2 block, which shrinks the map and makes the result tolerant to small shifts). <b>Padding</b> keeps the size; <b>stride 2</b> halves it.</p>`;
  K.start((dt) => { const total = outSize() ** 2; if (S.playing) { C.pos = C.pos + dt / 260 * S.speed; if (C.pos > total + 3) C.pos = 0; } p3.set(scene(), [1.2, -.6, 0], 9); p3.draw(1); drawTrace(); });
  p3.set3d(.35, .85); p3.focus([1.0, -.4, 0], 9);
  return K.build(bar);
}

registerInside('timeseries', { icon: 'Ts', title: 'Time series on a cylinder', blurb: 'Wrap a series by season to see the pattern stack up; four honest forecasts and their errors.' }, tsView);
registerInside('conv', { icon: 'Cv', title: 'Convolution, step by step', blurb: 'A kernel slides over an image, nine products become one pixel, the feature map builds, pooling shrinks it.' }, convView);
