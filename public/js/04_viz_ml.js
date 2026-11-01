'use strict';
/* =====================================================================
   ML / DL / GenAI visuals (all computed live in JS from real algorithms):
   dataExplorer (3-D/2-D explorer for any project CSV), regplane, boundary, kmeans3d, pca3d,
   nnTrain, attention, vecsearch, graphFlow
   ===================================================================== */
const normPt = (arr, span = 4) => { const lo = Math.min(...arr), hi = Math.max(...arr), r = hi - lo || 1; return arr.map(v => (v - lo) / r * 2 * span - span); };
const catColor = i => `var(${COLS[((i % 7) + 7) % 7]})`;
const cssColor = i => ['#2F6FE0', '#D2600F', '#1E8E5A', '#7A4FD0', '#0E8FA3', '#B8860B', '#C2418A'][((i % 7) + 7) % 7];
function solveLin(A, b) {            // gaussian elimination, small systems
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r; [M[i], M[p]] = [M[p], M[i]]; for (let r = i + 1; r < n; r++) { const f = M[r][i] / (M[i][i] || 1e-12); for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]; } }
  const x = Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / (M[i][i] || 1e-12); } return x;
}
function jacobi3(C) {                 // eigen-decomposition of a symmetric 3x3
  let A = C.map(r => [...r]), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let it = 0; it < 40; it++) {
    let p = 0, q = 1, mx = Math.abs(A[0][1]); [[0, 2], [1, 2]].forEach(([i, j]) => { if (Math.abs(A[i][j]) > mx) { mx = Math.abs(A[i][j]); p = i; q = j; } });
    if (mx < 1e-12) break; const th = .5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]), c = Math.cos(th), s = Math.sin(th);
    for (let k = 0; k < 3; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = c * a - s * b; A[k][q] = s * a + c * b; }
    for (let k = 0; k < 3; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = c * a - s * b; A[q][k] = s * a + c * b; }
    for (let k = 0; k < 3; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b; }
  }
  const vals = [A[0][0], A[1][1], A[2][2]], idx = [0, 1, 2].sort((a, b) => vals[b] - vals[a]);
  return { vals: idx.map(i => vals[i]), vecs: idx.map(i => [V[0][i], V[1][i], V[2][i]]) };
}

/* ---------------------------------------------------------------------
   dataExplorer: 3-D scatter / 2-D scatter / histogram / image surface for ANY dataset csv
   --------------------------------------------------------------------- */
DSQ.viz.dataExplorer = (c, a) => {
  const lines = a.csv.trim().split('\n'), header = a.header !== false;
  const cols0 = header ? lines[0].split(',') : null;
  const body = lines.slice(header ? 1 : 0).map(l => l.split(','));
  let p3 = null, cancel = null;
  if (!header) {                      // an image: pixels become heights
    const N = body.length, step = Math.max(1, Math.floor(N / 48)); let mode = '3d';
    const px = []; for (let i = 0; i < N; i += step) { px.push([]); for (let j = 0; j < body[i].length; j += step) px[px.length - 1].push(+body[i][j]); }
    const R = px.length, Cc = px[0].length;
    p3 = Plot3D(c.stage, { w: 640, h: 440, az: .7, el: .75 }); c.onDestroy(() => { p3.destroy(); cancel && cancel(); });
    const draw = () => {
      cancel && cancel(); const items = [];
      for (let i = 0; i < R - 1; i++) for (let j = 0; j < Cc - 1; j++) {
        const z = v => v / 255 * 5, X = j / (Cc - 1) * 8 - 4, Y = (1 - i / (R - 1)) * 8 - 4, dx = 8 / (Cc - 1), dy = 8 / (R - 1);
        items.push({ t: 'poly', pts: [[X, Y, z(px[i][j])], [X + dx, Y, z(px[i][j + 1])], [X + dx, Y - dy, z(px[i + 1][j + 1])], [X, Y - dy, z(px[i + 1][j])]], fill: heat(px[i][j] / 255), alpha: .95, stroke: false, t0: i / R * .9 });
      }
      DSQ.axes3(4.6, ['col', 'row', 'brightness']).forEach(it => items.push(it)); p3.set(items, [0, 0, 2], 6.5); cancel = anim(1500, t => p3.draw(t));
      c.say(`<span class="y">img</span> = np.loadtxt('data/photo.csv', delimiter=',')   <span class="g"># ${N} x ${body[0].length} pixels</span>\nBright regions become <span class="y">hills</span>, dark regions valleys. Slices, masks and filters you write in NumPy just reshape this landscape. Drag to rotate.`);
    };
    c.button('Replay', draw); c.button('Spin', () => p3.spin(true)); draw(); return;
  }
  /* tabular */
  const isNum = j => { const v = body.map(r => r[j]).filter(x => x !== '' && x != null); return v.length > 5 && v.filter(x => !isNaN(+x)).length / v.length > .9; };
  const uniq = j => new Set(body.map(r => r[j])).size;
  const num = cols0.map((_, j) => j).filter(j => isNum(j) && uniq(j) > 6), cat = cols0.map((_, j) => j).filter(j => uniq(j) <= 12 && uniq(j) >= 2 && uniq(j) < body.length / 4);
  if (num.length < 2) { c.stage.innerHTML = '<p class="muted">Not enough numeric columns to explore.</p>'; return; }
  const rng = RNG(5), sample = body.length > 1200 ? rng.shuffle(body).slice(0, 1200) : body;
  const isId = j => /(^|_)id$/i.test(cols0[j]) || uniq(j) === body.length, pref = num.filter(j => !isId(j)).length >= 2 ? num.filter(j => !isId(j)) : num;
  let mode = pref.length >= 3 ? '3d' : '2d', xi = pref[0], yi = pref[1], zi = pref[2] ?? pref[1], ci = cat.length ? cat[0] : -1;
  p3 = Plot3D(c.stage, { w: 640, h: 440, az: .8, el: .5 }); c.onDestroy(() => { p3.destroy(); cancel && cancel(); });
  const svgHost = h('div', { hidden: true }); c.stage.append(svgHost);
  const val = (r, j) => { const v = +r[j]; return Number.isFinite(v) ? v : NaN; };
  function draw() {
    cancel && cancel(); const rows = sample.filter(r => [xi, yi, zi].every(j => Number.isFinite(val(r, j))));
    const groups = ci >= 0 ? [...new Set(rows.map(r => r[ci]))].sort() : [], gi = r => (ci >= 0 ? groups.indexOf(r[ci]) : 0);
    p3.cv.hidden = mode !== '3d'; svgHost.hidden = mode === '3d';
    const names = [cols0[xi], cols0[yi], cols0[zi]];
    if (mode === '3d') {
      let X = normPt(rows.map(r => val(r, xi))), Y = normPt(rows.map(r => val(r, yi))), Z = normPt(rows.map(r => val(r, zi)));
      const items = rows.map((r, i) => ({ t: 'pt', p: [X[i], Y[i], Z[i]], r: 3.6, color: cssColor(gi(r)), t0: i / rows.length * .85 }));
      DSQ.axes3(4.6, names.map(n => String(n))).forEach(it => items.push(it)); p3.set(items, [0, 0, 0], 6); cancel = anim(1400, t => p3.draw(t));
    } else if (mode === '2d') {
      const W = 640, Hh = 400, xs = rows.map(r => val(r, xi)), ys = rows.map(r => val(r, yi)), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const X = v => 56 + (v - x0) / (x1 - x0 || 1) * (W - 76), Y = v => Hh - 44 - (v - y0) / (y1 - y0 || 1) * (Hh - 64);
      cancel = anim(1200, t => { svgHost.innerHTML = svgOpen(W, Hh) + `<line x1="56" x2="56" y1="10" y2="${Hh - 44}" stroke="var(--ax)"/><line x1="56" x2="${W - 16}" y1="${Hh - 44}" y2="${Hh - 44}" stroke="var(--ax)"/><text x="${W / 2}" y="${Hh - 10}" text-anchor="middle" font-weight="700">${esc(names[0])}</text><text transform="translate(14 ${Hh / 2}) rotate(-90)" text-anchor="middle" font-weight="700">${esc(names[1])}</text>` + rows.slice(0, Math.ceil(rows.length * t)).map((r, i) => `<circle cx="${X(xs[i]).toFixed(1)}" cy="${Y(ys[i]).toFixed(1)}" r="3.4" fill="${cssColor(gi(r))}" opacity=".6"/>`).join('') + '</svg>'; });
    } else {
      const xs = rows.map(r => val(r, xi)), x0 = Math.min(...xs), x1 = Math.max(...xs), B = 24, cnt = range(B).map(() => 0); xs.forEach(v => { cnt[Math.min(B - 1, Math.floor((v - x0) / (x1 - x0 || 1) * B))]++; });
      const mx = Math.max(...cnt), W = 640, Hh = 360;
      cancel = anim(1000, t => { svgHost.innerHTML = svgOpen(W, Hh) + cnt.map((k, i) => `<rect x="${40 + i * (W - 60) / B}" y="${Hh - 40 - k / mx * (Hh - 70) * t}" width="${(W - 60) / B - 2}" height="${k / mx * (Hh - 70) * t}" rx="3" fill="var(--c0)"/>`).join('') + `<text x="${W / 2}" y="${Hh - 10}" text-anchor="middle" font-weight="700">${esc(names[0])}</text></svg>`; });
    }
    const leg = groups.length ? 'colour = ' + esc(cols0[ci]) + ': ' + groups.map((g, i) => `<span style="color:${cssColor(i)}">&#9679; ${esc(g)}</span>`).join('  ') : '';
    c.say(`<span class="y">${mode === '3d' ? 'ax = fig.add_subplot(projection="3d"); ax.scatter(df["' + names[0] + '"], df["' + names[1] + '"], df["' + names[2] + '"])' : mode === '2d' ? 'ax.scatter(df["' + names[0] + '"], df["' + names[1] + '"])' : 'ax.hist(df["' + names[0] + '"], bins=24)'}</span>   <span class="g"># ${rows.length} of ${body.length} rows shown</span>\n${leg}`);
  }
  const opts = num.map(j => [j, cols0[j]]);
  c.select('chart', [['3d', '3-D scatter'], ['2d', '2-D scatter'], ['hist', 'histogram']], mode, v => { mode = v; draw(); });
  c.select('x', opts, xi, v => { xi = +v; draw(); }); c.select('y', opts, yi, v => { yi = +v; draw(); }); c.select('z', opts, zi, v => { zi = +v; draw(); });
  if (cat.length) c.select('colour by', [[-1, 'none']].concat(cat.map(j => [j, cols0[j]])), ci, v => { ci = +v; draw(); });
  c.button('Spin', () => { if (mode === '3d') p3.spin(true); }); draw();
};

/* ---------------------------------------------------------------------
   regplane: least squares in 3-D (two features -> one target)
   --------------------------------------------------------------------- */
DSQ.viz.regplane = (c, a) => {
  const r = RNG(a.seed || 8), n = 40, X1 = range(n).map(() => r() * 6 - 3), X2 = range(n).map(() => r() * 6 - 3), Y = X1.map((x, i) => 1.4 * x - 0.9 * X2[i] + 1 + r.norm(0, .7));
  let w1 = 0, w2 = 0, b = 0, cancel = null;
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], rhs = [0, 0, 0];
  X1.forEach((x, i) => { const f = [x, X2[i], 1]; for (let p = 0; p < 3; p++) { rhs[p] += f[p] * Y[i]; for (let q = 0; q < 3; q++) A[p][q] += f[p] * f[q]; } });
  const best = solveLin(A, rhs); const p3 = Plot3D(c.stage, { w: 640, h: 440, az: .9, el: .4 }); c.onDestroy(() => { p3.destroy(); cancel && cancel(); });
  const sw = [];
  function draw() {
    const mse = mean(Y.map((y, i) => (y - (w1 * X1[i] + w2 * X2[i] + b)) ** 2)), items = [], G = 6, R = 3.4;
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const x0 = -R + 2 * R * i / G, x1 = -R + 2 * R * (i + 1) / G, y0 = -R + 2 * R * j / G, y1 = -R + 2 * R * (j + 1) / G, f = (x, y) => w1 * x + w2 * y + b; items.push({ t: 'poly', pts: [[x0, y0, f(x0, y0)], [x1, y0, f(x1, y0)], [x1, y1, f(x1, y1)], [x0, y1, f(x0, y1)]], fill: 'rgba(210,96,15,.35)', alpha: 1, stroke: 'rgba(210,96,15,.6)' }); }
    X1.forEach((x, i) => { const yh = w1 * x + w2 * X2[i] + b; items.push({ t: 'line', a: [x, X2[i], Y[i]], b: [x, X2[i], yh], color: '#C8323C', w: 1.2 }); items.push({ t: 'pt', p: [x, X2[i], Y[i]], r: 4, color: '#2F6FE0' }); });
    DSQ.axes3(4, ['x1', 'x2', 'y']).forEach(it => items.push(it)); p3.set(items, [0, 0, 0], 6); p3.draw(1);
    c.say(`model = LinearRegression().fit(X, y)    <span class="g"># X has two columns: x1, x2</span>\n<span class="y">your plane:</span>  y = ${w1.toFixed(2)}*x1 + ${w2.toFixed(2)}*x2 + ${b.toFixed(2)}     <span class="y">MSE</span> = ${mse.toFixed(3)}\n<span class="g">best fit:  coef_ = [${best[0].toFixed(2)}, ${best[1].toFixed(2)}], intercept_ = ${best[2].toFixed(2)}  - red sticks are the errors being squared</span>`);
  }
  sw[0] = c.slider('w1 (x1 slope)', -3, 3, .05, w1, v => { w1 = v; draw(); }, v => v.toFixed(2)); sw[1] = c.slider('w2 (x2 slope)', -3, 3, .05, w2, v => { w2 = v; draw(); }, v => v.toFixed(2)); sw[2] = c.slider('intercept', -4, 4, .05, b, v => { b = v; draw(); }, v => v.toFixed(2));
  c.button('Fit it (least squares)', () => { cancel && cancel(); const s = [w1, w2, b]; cancel = anim(1400, t => { w1 = lerp(s[0], best[0], t); w2 = lerp(s[1], best[1], t); b = lerp(s[2], best[2], t); sw.forEach((e, i) => { e.value = [w1, w2, b][i]; $('b', e.parentNode).textContent = [w1, w2, b][i].toFixed(2); }); draw(); }); });
  c.button('Spin', () => p3.spin(true)); draw();
};

/* ---------------------------------------------------------------------
   boundary: classifiers draw their decision regions on 2-D data (kNN, logistic regression, decision tree)
   --------------------------------------------------------------------- */
DSQ.viz.boundary = (c, a) => {
  let dsn = a.data || 'moons', model = a.model || 'knn', k = 5, depth = 3, deg = 2, seed = 4;
  const W = 520, G = 52, cv = h('canvas', { width: W, height: W }); cv.style.cssText = 'width:min(100%,520px);border-radius:12px;cursor:default'; c.stage.append(cv);
  const g = cv.getContext('2d'); let pts = [], info = '';
  function gen() {
    const r = RNG(seed * 13 + 1); pts = [];
    for (let i = 0; i < 90; i++) {
      const cls = i % 2; let x, y;
      if (dsn === 'moons') { const t = r() * Math.PI; x = cls ? 1 - Math.cos(t) : Math.cos(t); y = cls ? .45 - Math.sin(t) : Math.sin(t); x += r.norm(0, .17); y += r.norm(0, .17); x = (x - .5) * 3; y = (y - .1) * 3; }
      else if (dsn === 'blobs') { x = r.norm(cls ? 1.1 : -1.1, .9); y = r.norm(cls ? .8 : -.8, .9); }
      else if (dsn === 'circles') { const t = r() * 6.28, rad = (cls ? 2.0 : .8) + r.norm(0, .22); x = rad * Math.cos(t); y = rad * Math.sin(t); }
      else { x = r() * 4 - 2; y = r() * 4 - 2; pts.push({ x, y, c: (x > 0) !== (y > 0) ? 1 : 0 }); continue; }
      pts.push({ x, y, c: cls });
    }
  }
  function tree(P, d) {
    const cls = P.filter(p => p.c).length, node = { n: P.length, p1: cls / P.length };
    if (d === 0 || !cls || cls === P.length || P.length < 4) return node;
    const gi = S => { const q = S.filter(p => p.c).length / (S.length || 1); return 2 * q * (1 - q); }; let best = null;
    for (const ax of ['x', 'y']) { const v = P.map(p => p[ax]).sort((u, w) => u - w); for (let i = 1; i < v.length; i++) { const th = (v[i - 1] + v[i]) / 2, L = P.filter(p => p[ax] <= th), R = P.filter(p => p[ax] > th); if (!L.length || !R.length) continue; const sc = (L.length * gi(L) + R.length * gi(R)) / P.length; if (!best || sc < best.sc) best = { sc, ax, th, L, R }; } }
    if (!best) return node; node.ax = best.ax; node.th = best.th; node.l = tree(best.L, d - 1); node.r = tree(best.R, d - 1); return node;
  }
  const feats = (x, y) => { const f = [1]; for (let d = 1; d <= deg; d++) for (let i = 0; i <= d; i++) f.push(x ** (d - i) * y ** i); return f; };
  function draw() {
    gen(); let predict;
    const train = pts.slice(0, 60), test = pts.slice(60);
    if (model === 'knn') predict = (x, y) => { const d = train.map(p => [(p.x - x) ** 2 + (p.y - y) ** 2, p.c]).sort((u, w) => u[0] - w[0]).slice(0, k); return sum(d.map(q => q[1])) / k; };
    else if (model === 'tree') { const T = tree(train, depth); predict = (x, y) => { let n = T; while (n.ax) n = (n.ax === 'x' ? x : y) <= n.th ? n.l : n.r; return n.p1; }; }
    else { const F = train.map(p => feats(p.x, p.y)), nf = F[0].length, wv = Array(nf).fill(0); for (let it = 0; it < 500; it++) { const gr = Array(nf).fill(0); F.forEach((f, i) => { const z = clamp(sum(f.map((v, j) => v * wv[j])), -30, 30), p = 1 / (1 + Math.exp(-z)); f.forEach((v, j) => { gr[j] += (p - train[i].c) * v / F.length; }); }); wv.forEach((_, j) => { wv[j] -= .3 * gr[j]; }); } predict = (x, y) => 1 / (1 + Math.exp(-clamp(sum(feats(x, y).map((v, j) => v * wv[j])), -30, 30))); }
    const L = 3.4, cell = W / G; g.clearRect(0, 0, W, W);
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const x = (i + .5) / G * 2 * L - L, y = L - (j + .5) / G * 2 * L, p = predict(x, y); g.fillStyle = p > .5 ? `rgba(210,96,15,${.18 + .35 * Math.abs(p - .5) * 2})` : `rgba(47,111,224,${.18 + .35 * Math.abs(p - .5) * 2})`; g.fillRect(i * cell, j * cell, cell + .5, cell + .5); }
    pts.forEach((p, i) => { const X = (p.x + L) / (2 * L) * W, Y = (L - p.y) / (2 * L) * W; g.beginPath(); g.arc(X, Y, i < 60 ? 5 : 5, 0, 7); g.fillStyle = p.c ? '#D2600F' : '#2F6FE0'; g.globalAlpha = 1; g.fill(); g.lineWidth = i < 60 ? 2 : 2.5; g.strokeStyle = i < 60 ? '#fff' : '#111'; g.stroke(); });
    const acc = S => S.filter(p => (predict(p.x, p.y) > .5 ? 1 : 0) === p.c).length / S.length;
    const code = model === 'knn' ? `KNeighborsClassifier(n_neighbors=${k})` : model === 'tree' ? `DecisionTreeClassifier(max_depth=${depth})` : `make_pipeline(PolynomialFeatures(${deg}), LogisticRegression())`;
    c.say(`model = ${code}\nmodel.fit(X_train, y_train)\n<span class="y">train accuracy</span> = ${(acc(train) * 100).toFixed(0)}%    <span class="y">test accuracy</span> = ${(acc(test) * 100).toFixed(0)}%   <span class="g"># white-ringed = train points, black-ringed = test points</span>\n<span class="g">${acc(train) - acc(test) > .12 ? 'big gap between train and test: OVERFITTING - the boundary memorises noise' : acc(train) < .8 ? 'low on both: UNDERFITTING - the model is too simple for this shape' : 'train and test agree: a good fit'}</span>`);
  }
  c.select('data', ['moons', 'blobs', 'circles', 'xor'], dsn, v => { dsn = v; draw(); }); c.select('model', [['knn', 'k-NN'], ['tree', 'decision tree'], ['logreg', 'logistic regression']], model, v => { model = v; draw(); });
  c.slider('k (kNN)', 1, 25, 1, k, v => { k = v; draw(); }); c.slider('depth (tree)', 1, 10, 1, depth, v => { depth = v; draw(); }); c.slider('poly degree (logreg)', 1, 6, 1, deg, v => { deg = v; draw(); }); c.button('New data', () => { seed++; draw(); });
  draw();
};

/* ---------------------------------------------------------------------
   kmeans3d: Lloyd's algorithm step by step in 3-D
   --------------------------------------------------------------------- */
DSQ.viz.kmeans3d = (c, a) => {
  let K = a.k || 3, seed = 2, step = 0, state = null, timer = null;
  const p3 = Plot3D(c.stage, { w: 640, h: 440, az: .8, el: .45 }); c.onDestroy(() => { p3.destroy(); clearInterval(timer); });
  function init() {
    const r = RNG(seed * 7 + 3), cent = [[-2.5, -2, -1.5], [2.5, 1.5, -2], [0, 2.5, 2.6], [-2, 2.5, 2.5]], P = [];
    for (let i = 0; i < 120; i++) { const ce = cent[i % 4]; P.push(ce.map(v => v + r.norm(0, .9))); }
    const C = r.shuffle(P).slice(0, K).map(p => [...p]); state = { P, C, lab: P.map(() => -1), hist: [C.map(x => [...x])], done: false, it: 0 }; assign(); draw();
  }
  const d2 = (p, q) => sum(p.map((v, i) => (v - q[i]) ** 2));
  function assign() { state.lab = state.P.map(p => argmin(state.C.map(q => d2(p, q)))); }
  const argmin = arr => arr.indexOf(Math.min(...arr));
  function update() { const old = state.C.map(x => [...x]); state.C = state.C.map((q, k) => { const m = state.P.filter((_, i) => state.lab[i] === k); return m.length ? [0, 1, 2].map(j => mean(m.map(p => p[j]))) : q; }); state.hist.push(state.C.map(x => [...x])); const moved = sum(old.map((q, k) => Math.sqrt(d2(q, state.C[k])))); state.it++; assign(); if (moved < 1e-4) state.done = true; }
  function draw() {
    const items = state.P.map((p, i) => ({ t: 'pt', p, r: 3.6, color: cssColor(state.lab[i]) }));
    state.hist.forEach((hh, s) => { if (s === 0) return; hh.forEach((q, k) => items.push({ t: 'line', a: state.hist[s - 1][k], b: q, color: cssColor(k), w: 2.5 })); });
    state.C.forEach((q, k) => items.push({ t: 'pt', p: q, r: 9, color: cssColor(k), ring: '#000' }));
    DSQ.axes3(4.6, ['x', 'y', 'z']).forEach(it => items.push(it)); p3.set(items, [0, 0, 0], 6); p3.draw(1);
    const inertia = sum(state.P.map((p, i) => d2(p, state.C[state.lab[i]])));
    c.say(`km = KMeans(n_clusters=${K}, n_init=1).fit(X)\n<span class="y">iteration</span> ${state.it}   <span class="y">inertia_</span> = ${inertia.toFixed(1)}   ${state.done ? '<span class="g"># converged: the centres stopped moving</span>' : '<span class="g"># 1) assign every point to its nearest centre  2) move each centre to the mean of its points</span>'}`);
  }
  c.slider('k clusters', 2, 6, 1, K, v => { K = v; init(); }); c.button('Step', () => { if (!state.done) { update(); draw(); } });
  c.button('Run to the end', () => { clearInterval(timer); timer = setInterval(() => { if (state.done || state.it > 25) { clearInterval(timer); return; } update(); draw(); }, 450); }); c.button('New start', () => { seed++; clearInterval(timer); init(); }); c.button('Spin', () => p3.spin(true)); init();
};

/* ---------------------------------------------------------------------
   pca3d: principal axes of a 3-D cloud and projection onto fewer dimensions
   --------------------------------------------------------------------- */
DSQ.viz.pca3d = (c, a) => {
  let kk = 3, cancel = null, t = 0; const r = RNG(a.seed || 6), P = range(150).map(() => { const u = r.norm(0, 2.2), v = r.norm(0, 1.1), w = r.norm(0, .35); return [u * .8 + v * .3 + w * .1 - 0, u * .5 - v * .6 + w * .4, u * .3 + v * .7 + w * .9]; });
  const mu = [0, 1, 2].map(j => mean(P.map(p => p[j]))), Z = P.map(p => p.map((v, j) => v - mu[j])), C = [0, 1, 2].map(i => [0, 1, 2].map(j => sum(Z.map(z => z[i] * z[j])) / (Z.length - 1)));
  const E = jacobi3(C), tot = sum(E.vals), ratio = E.vals.map(v => v / tot);
  const p3 = Plot3D(c.stage, { w: 640, h: 440, az: .7, el: .4 }); c.onDestroy(() => { p3.destroy(); cancel && cancel(); });
  const proj = (z, k) => { let out = [0, 0, 0]; for (let i = 0; i < k; i++) { const d = sum(z.map((v, j) => v * E.vecs[i][j])); out = out.map((o, j) => o + d * E.vecs[i][j]); } return out; };
  function draw(f) {
    const items = Z.map((z, i) => { const q = proj(z, kk), p = z.map((v, j) => lerp(v, q[j], f)); return { t: 'pt', p, r: 3.4, color: cssColor(Math.min(2, Math.floor((sum(z.map((v, j) => v * E.vecs[0][j])) + 5) / 3.4))) }; });
    E.vecs.forEach((v, i) => { const L = Math.sqrt(E.vals[i]) * 2.2; items.push({ t: 'line', a: v.map(x => -x * L), b: v.map(x => x * L), color: ['#C8323C', '#1E8E5A', '#7A4FD0'][i], w: 3.2 }); items.push({ t: 'txt', p: v.map(x => x * (L + .5)), s: 'PC' + (i + 1), bold: true, color: ['#C8323C', '#1E8E5A', '#7A4FD0'][i], bg: true }); });
    DSQ.axes3(4.6, ['x1', 'x2', 'x3']).forEach(it => items.push(it)); p3.set(items, [0, 0, 0], 6.5); p3.draw(1);
  }
  function go() { cancel && cancel(); const f0 = kk === 3 ? 0 : 0; cancel = anim(1200, f => draw(f)); c.say(`pca = PCA(n_components=${kk}).fit(X)\n<span class="y">explained_variance_ratio_</span> = [${ratio.map(v => v.toFixed(3)).join(', ')}]   <span class="g"># PC1 alone keeps ${(ratio[0] * 100).toFixed(0)}% of the information</span>\nkeeping ${kk} component${kk > 1 ? 's' : ''} -> ${(sum(ratio.slice(0, kk)) * 100).toFixed(1)}% of the variance${kk < 3 ? '  <span class="g"># points slide onto the ' + (kk === 1 ? 'line PC1' : 'plane PC1-PC2') + '</span>' : ''}`); }
  c.slider('components kept', 1, 3, 1, kk, v => { kk = v; go(); }); c.button('Replay', go); c.button('Spin', () => p3.spin(true)); go();
};

/* ---------------------------------------------------------------------
   nnTrain: a real tiny neural network trains in front of you (backprop in JS)
   --------------------------------------------------------------------- */
DSQ.viz.nnTrain = (c, a) => {
  let dsn = a.data || 'circles', H = 8, lr = .5, net = null, pts = [], loss = [], running = false, raf = 0, epoch = 0, act = 'tanh';
  const W = 440, G = 44, cv = h('canvas', { width: W, height: W }); cv.style.cssText = 'width:min(100%,440px);border-radius:12px'; const lossBox = h('div', { style: { width: '100%' } });
  c.stage.style.gridTemplateColumns = 'minmax(0,1fr) minmax(0,1fr)'; c.stage.style.gap = '12px'; c.stage.append(cv, lossBox); const g = cv.getContext('2d');
  const A = { tanh: [Math.tanh, y => 1 - y * y], relu: [x => Math.max(0, x), y => (y > 0 ? 1 : 0)] };
  function init() {
    const r = RNG(11); pts = [];
    for (let i = 0; i < 140; i++) { const cls = i % 2; let x, y; if (dsn === 'circles') { const t = r() * 6.28, rad = (cls ? 2 : .8) + r.norm(0, .15); x = rad * Math.cos(t); y = rad * Math.sin(t); } else if (dsn === 'spiral') { const t = r() * 3 + .3, s = cls ? 3.14 : 0; x = t * Math.cos(t * 2 + s) * .8 + r.norm(0, .12); y = t * Math.sin(t * 2 + s) * .8 + r.norm(0, .12); } else { x = r() * 4 - 2; y = r() * 4 - 2; pts.push({ x, y, c: (x > 0) !== (y > 0) ? 1 : 0 }); continue; } pts.push({ x, y, c: cls }); }
    const rr = RNG(5), mk = (n, m) => range(n).map(() => range(m).map(() => rr.norm(0, Math.sqrt(2 / m)))); net = { W1: mk(H, 2), b1: Array(H).fill(0), W2: mk(1, H)[0], b2: 0 }; loss = []; epoch = 0; draw();
  }
  const fwd = (x, y) => { const f = A[act][0], hid = net.W1.map((w, i) => f(w[0] * x + w[1] * y + net.b1[i])); const z = sum(hid.map((v, i) => v * net.W2[i])) + net.b2; return { hid, p: 1 / (1 + Math.exp(-clamp(z, -30, 30))) }; };
  function stepTrain() {
    const df = A[act][1]; let L = 0; const gW1 = net.W1.map(() => [0, 0]), gb1 = Array(H).fill(0), gW2 = Array(H).fill(0); let gb2 = 0;
    pts.forEach(p => { const { hid, p: pr } = fwd(p.x, p.y), d = pr - p.c; L += -(p.c * Math.log(pr + 1e-9) + (1 - p.c) * Math.log(1 - pr + 1e-9)); gb2 += d; hid.forEach((hv, i) => { gW2[i] += d * hv; const dh = d * net.W2[i] * df(hv); gW1[i][0] += dh * p.x; gW1[i][1] += dh * p.y; gb1[i] += dh; }); });
    const n = pts.length; net.W1.forEach((w, i) => { w[0] -= lr * gW1[i][0] / n; w[1] -= lr * gW1[i][1] / n; net.b1[i] -= lr * gb1[i] / n; net.W2[i] -= lr * gW2[i] / n; }); net.b2 -= lr * gb2 / n; loss.push(L / n); epoch++;
  }
  function draw() {
    const Lm = 3.2, cell = W / G; g.clearRect(0, 0, W, W);
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const x = (i + .5) / G * 2 * Lm - Lm, y = Lm - (j + .5) / G * 2 * Lm, p = fwd(x, y).p; g.fillStyle = p > .5 ? `rgba(210,96,15,${.12 + .5 * Math.abs(p - .5) * 2})` : `rgba(47,111,224,${.12 + .5 * Math.abs(p - .5) * 2})`; g.fillRect(i * cell, j * cell, cell + .5, cell + .5); }
    pts.forEach(p => { g.beginPath(); g.arc((p.x + Lm) / (2 * Lm) * W, (Lm - p.y) / (2 * Lm) * W, 4.5, 0, 7); g.fillStyle = p.c ? '#D2600F' : '#2F6FE0'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke(); });
    const accv = pts.filter(p => (fwd(p.x, p.y).p > .5 ? 1 : 0) === p.c).length / pts.length, mx = Math.max(...loss, .8), Wl = 300, Hl = 200;
    lossBox.innerHTML = svgOpen(Wl, Hl) + `<line x1="34" x2="34" y1="10" y2="${Hl - 28}" stroke="var(--ax)"/><line x1="34" x2="${Wl - 8}" y1="${Hl - 28}" y2="${Hl - 28}" stroke="var(--ax)"/><text x="${Wl / 2}" y="${Hl - 6}" text-anchor="middle" class="m" font-size="11">epoch</text><text x="4" y="22" class="m" font-size="11">loss</text>` + (loss.length > 1 ? `<path d="M${loss.map((l, i) => (34 + i / Math.max(loss.length - 1, 60) * (Wl - 44)).toFixed(1) + ' ' + (Hl - 28 - l / mx * (Hl - 44)).toFixed(1)).join('L')}" fill="none" stroke="var(--c1)" stroke-width="2.5"/>` : '') + `</svg>`;
    c.say(`model = nn.Sequential(nn.Linear(2, ${H}), nn.${act === 'tanh' ? 'Tanh' : 'ReLU'}(), nn.Linear(${H}, 1), nn.Sigmoid())   <span class="g"># trained here with plain backprop</span>\n<span class="y">epoch</span> ${epoch}   <span class="y">loss</span> = ${loss.length ? loss[loss.length - 1].toFixed(3) : '-'}   <span class="y">accuracy</span> = ${(accv * 100).toFixed(0)}%   <span class="g"># each epoch: forward pass -> loss -> gradients -> w -= lr * grad</span>`);
  }
  function loopF() { if (!running) return; for (let i = 0; i < 6; i++) stepTrain(); draw(); if (epoch > 4000) running = false; raf = requestAnimationFrame(loopF); }
  c.onDestroy(() => { running = false; cancelAnimationFrame(raf); });
  c.select('data', ['circles', 'spiral', 'xor'], dsn, v => { dsn = v; running = false; init(); }); c.slider('hidden units', 2, 24, 1, H, v => { H = v; running = false; init(); }); c.slider('learning rate', .05, 2, .05, lr, v => { lr = v; }, v => v.toFixed(2));
  c.select('activation', ['tanh', 'relu'], act, v => { act = v; running = false; init(); });
  const pb = c.button('Train / Pause', () => { running = !running; if (running) loopF(); }); c.button('Reset', () => { running = false; init(); }); init();
};

/* ---------------------------------------------------------------------
   attention: scaled dot-product attention on a sentence (untrained weights: shows the mechanism)
   --------------------------------------------------------------------- */
DSQ.viz.attention = (c, a) => {
  let text = a.text || 'the cat sat on the mat', temp = 1, sel = 2; const D = 6;
  const emb = w => { const r = RNG(hash32(w.toLowerCase())); return range(D).map(() => r.norm(0, 1)); }, Wq = range(D).map((_, i) => range(D).map((_, j) => (RNG(100 + i * 7 + j)()) * 2 - 1)), Wk = range(D).map((_, i) => range(D).map((_, j) => (RNG(300 + i * 5 + j)()) * 2 - 1));
  const mv = (M, v) => M.map(r => sum(r.map((x, i) => x * v[i])));
  function draw() {
    const toks = text.trim().split(/\s+/).slice(0, 9), X = toks.map(emb), Q = X.map(x => mv(Wq, x)), K = X.map(x => mv(Wk, x)), n = toks.length; sel = Math.min(sel, n - 1);
    const S = Q.map(q => K.map(k => sum(q.map((v, i) => v * k[i])) / Math.sqrt(D) / temp)), Aw = S.map(row => { const m = Math.max(...row), e = row.map(v => Math.exp(v - m)), z = sum(e); return e.map(v => v / z); });
    const Wd = 600, cs = Math.min(46, 330 / n), x0 = 90, y0 = 40, svg = [svgOpen(Wd, y0 + n * cs + 60)];
    toks.forEach((t, i) => { svg.push(`<text x="${x0 + i * cs + cs / 2}" y="${y0 - 8}" text-anchor="middle" font-weight="700" font-size="12" transform="rotate(-25 ${x0 + i * cs + cs / 2} ${y0 - 8})">${esc(t)}</text><text x="${x0 - 8}" y="${y0 + i * cs + cs / 2 + 4}" text-anchor="end" font-weight="${i === sel ? 800 : 600}" font-size="12" fill="${i === sel ? 'var(--c1)' : 'var(--fg)'}" style="cursor:pointer" data-q="${i}">${esc(t)}</text>`); Aw[i].forEach((w, j) => svg.push(`<rect x="${x0 + j * cs}" y="${y0 + i * cs}" width="${cs - 2}" height="${cs - 2}" rx="5" fill="var(--c0)" opacity="${(.06 + .94 * w).toFixed(2)}" stroke="${i === sel ? 'var(--c1)' : 'none'}" stroke-width="2"/><text x="${x0 + j * cs + cs / 2 - 1}" y="${y0 + i * cs + cs / 2 + 3}" text-anchor="middle" font-size="10" fill="${w > .5 ? '#fff' : 'var(--fg)'}">${w.toFixed(2)}</text>`)); });
    // arcs for the selected query
    const bx = 400, by = y0 + 10; toks.forEach((t, j) => { svg.push(`<text x="${bx + 70}" y="${by + j * 26 + 4}" font-size="12" font-weight="700">${esc(t)}</text><rect x="${bx - 40}" y="${by + j * 26 - 8}" width="${Aw[sel][j] * 100}" height="14" rx="4" fill="var(--c1)" opacity=".85"/>`); });
    svg.push(`<text x="${bx - 40}" y="${by - 16}" font-size="12" font-weight="800" fill="var(--c1)">"${esc(toks[sel])}" looks at:</text></svg>`);
    c.stage.innerHTML = svg.join(''); $$('text[data-q]', c.stage).forEach(e => e.addEventListener('click', () => { sel = +e.dataset.q; draw(); }));
    const top = Aw[sel].map((w, j) => [w, toks[j]]).sort((u, v) => v[0] - u[0]);
    c.say(`scores = Q @ K.T / np.sqrt(d)      <span class="g"># how well each query matches each key</span>\nweights = softmax(scores, axis=-1)    <span class="g"># every row sums to 1</span>\noutput  = weights @ V                 <span class="g"># each token = a weighted mix of all tokens' values</span>\n<span class="y">"${esc(toks[sel])}"</span> attends most to <span class="y">"${esc(top[0][1])}"</span> (${top[0][0].toFixed(2)}).  <span class="g"># weights here are random and untrained: the picture shows the MECHANISM; training makes the pattern meaningful</span>`);
  }
  c.text('sentence', text, v => { text = v || 'hello world'; draw(); }, '18em'); c.slider('temperature', .3, 4, .1, temp, v => { temp = v; draw(); }, v => v.toFixed(1)); draw();
};

/* ---------------------------------------------------------------------
   vecsearch: embeddings as points; nearest neighbours by cosine similarity (the heart of RAG)
   --------------------------------------------------------------------- */
DSQ.viz.vecsearch = (c, a) => {
  const topics = [['sports', [3, 0, 0], ['match won', 'final score', 'coach resigns', 'league table', 'goal scored', 'tournament draw', 'player injured', 'cricket series', 'sprint record', 'transfer news']], ['finance', [0, 3, 0], ['stock rally', 'interest rate cut', 'quarterly profit', 'bond yields', 'budget deficit', 'loan approval', 'inflation falls', 'IPO opens', 'bank merger', 'tax filing']], ['cooking', [0, 0, 3], ['pasta recipe', 'bake bread', 'spice mix', 'grill chicken', 'soup stock', 'knife skills', 'vegan curry', 'dough rise', 'sauce reduce', 'fresh herbs']], ['tech', [2, 2, 2], ['new GPU', 'python release', 'cloud outage', 'vector database', 'open source LLM', 'chip shortage', 'API design', 'data pipeline', 'security patch', 'edge devices']]];
  const r = RNG(17), docs = []; topics.forEach(([tn, ce, titles], ti) => titles.forEach(t => docs.push({ t, topic: tn, ti, v: ce.map(x => x + r.norm(0, .75)) })));
  let q = 'finance', k = 5, noise = .6, p3 = Plot3D(c.stage, { w: 640, h: 440, az: .75, el: .45 }), cancel = null; c.onDestroy(() => { p3.destroy(); cancel && cancel(); });
  const cos = (a, b) => sum(a.map((x, i) => x * b[i])) / (Math.hypot(...a) * Math.hypot(...b));
  function draw() {
    const ce = topics.find(t => t[0] === q)[1], rr = RNG(99), qv = ce.map(x => x + rr.norm(0, noise)); const sc = docs.map(d => ({ d, s: cos(qv, d.v) })).sort((u, w) => w.s - u.s), top = sc.slice(0, k);
    const items = docs.map(d => ({ t: 'pt', p: d.v.map(x => x - 1.5), r: top.some(z => z.d === d) ? 7 : 3.6, color: cssColor(d.ti), ring: top.some(z => z.d === d) ? '#000' : null }));
    top.forEach((z, i) => items.push({ t: 'line', a: qv.map(x => x - 1.5), b: z.d.v.map(x => x - 1.5), color: '#000', w: 1.6, dash: [4, 3], t0: i / k * .8 })); items.push({ t: 'pt', p: qv.map(x => x - 1.5), r: 10, color: '#C8323C', ring: '#000' }); items.push({ t: 'txt', p: qv.map(x => x - 1.2), s: 'QUERY', bold: true, color: '#C8323C', bg: true });
    DSQ.axes3(2.6, ['dim1', 'dim2', 'dim3'], [0, 0, 0]).forEach(it => items.push(it)); p3.set(items, [0, 0, 0], 4.2); cancel && cancel(); cancel = anim(900, t => p3.draw(t));
    c.say(`q = embed("a ${q} question")           <span class="g"># text -> vector (here simulated in 3-D; real models use 384-3072 dims)</span>\nscores = docs @ q / (norms)            <span class="g"># cosine similarity to every document</span>\ntop_k = np.argsort(-scores)[:${k}]      <span class="g"># -> these become the CONTEXT given to the LLM (RAG)</span>\n` + top.map((z, i) => `${i + 1}. <span class="y">${z.s.toFixed(2)}</span> ${esc(z.d.t)} <span class="g">[${z.d.topic}]</span>`).join('\n') + `\n<span class="g">retrieved from the right topic: ${top.filter(z => z.d.topic === q).length}/${k}  (raise "query noise" to see retrieval break)</span>`);
  }
  c.select('query topic', topics.map(t => t[0]), q, v => { q = v; draw(); }); c.slider('top-k', 1, 10, 1, k, v => { k = v; draw(); }); c.slider('query noise', 0, 2.2, .1, noise, v => { noise = v; draw(); }, v => v.toFixed(1)); c.button('Spin', () => p3.spin(true)); draw();
};

/* ---------------------------------------------------------------------
   graphFlow: LangGraph-style state machine, executed step by step with the state shown
   args.preset: 'agent' | 'rag'
   --------------------------------------------------------------------- */
const FLOWS = {
  agent: {
    nodes: { START: [60, 130], plan: [200, 130], tool: [350, 60], answer: [350, 200], END: [500, 130] },
    edges: [['START', 'plan'], ['plan', 'tool', 'needs a tool?'], ['tool', 'plan'], ['plan', 'answer', 'enough info'], ['answer', 'END']],
    script: [['START', {}, 'Graph starts with the initial state: the user question.'], ['plan', { thought: 'I need the current price', next: 'tool' }, 'The LLM node reads the state and decides: call a tool.'], ['tool', { tool_result: 'price = 412.5' }, 'The tool node runs the function and writes the result into the state.'], ['plan', { thought: 'I have the number', next: 'answer' }, 'Back to the LLM node (a loop!). Now it has enough information.'], ['answer', { answer: 'It costs 412.5.' }, 'The answer node writes the final message.'], ['END', {}, 'No more edges: the run ends and returns the final state.']],
    state: { question: 'What does the plan cost today?' },
    code: `graph = StateGraph(State)\ngraph.add_node("plan", plan_node)\ngraph.add_node("tool", tool_node)\ngraph.add_node("answer", answer_node)\ngraph.add_edge(START, "plan")\ngraph.add_conditional_edges("plan", route, {"tool": "tool", "answer": "answer"})\ngraph.add_edge("tool", "plan")\ngraph.add_edge("answer", END)\napp = graph.compile()`,
  },
  rag: {
    nodes: { START: [50, 130], rewrite: [170, 130], retrieve: [300, 60], grade: [300, 200], generate: [430, 130], END: [545, 130] },
    edges: [['START', 'rewrite'], ['rewrite', 'retrieve'], ['retrieve', 'grade'], ['grade', 'rewrite', 'poor context'], ['grade', 'generate', 'good context'], ['generate', 'END']],
    script: [['START', {}, 'The user question enters the graph.'], ['rewrite', { query: 'refund policy for digital items' }, 'Query rewriting: turn a chatty question into a good search query.'], ['retrieve', { docs: '3 chunks (scores .81 .77 .52)' }, 'Vector search returns the top-k chunks.'], ['grade', { relevant: 'false' }, 'A grader checks whether the chunks really answer the question: not good enough.'], ['rewrite', { query: 'digital goods refund within 14 days' }, 'Conditional edge: loop back and try a better query.'], ['retrieve', { docs: '3 chunks (scores .93 .88 .70)' }, 'Retrieve again.'], ['grade', { relevant: 'true' }, 'Now the context is relevant.'], ['generate', { answer: 'Digital items are refundable within 14 days [policy.md]' }, 'The LLM answers using ONLY the retrieved chunks, with a citation.'], ['END', {}, 'Done: answer plus its sources.']],
    state: { question: 'can i get my money back for an ebook?' },
    code: `graph.add_node("rewrite", rewrite)\ngraph.add_node("retrieve", retrieve)\ngraph.add_node("grade", grade_documents)\ngraph.add_node("generate", generate)\ngraph.add_conditional_edges("grade", decide, {"rewrite": "rewrite", "generate": "generate"})`,
  },
};
DSQ.viz.graphFlow = (c, a) => {
  let key = a.preset || 'agent', i = -1, timer = null;
  function draw() {
    clearInterval(timer); const F = FLOWS[key], W = 600, Hh = 270, cur = i >= 0 ? F.script[i][0] : null, st = Object.assign({}, F.state); for (let k = 0; k <= i; k++) Object.assign(st, F.script[k][1]);
    const nd = n => F.nodes[n]; let s = svgOpen(W, Hh) + '<defs><marker id="gar" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9z" fill="var(--ax)"/></marker></defs>';
    F.edges.forEach(([u, v, lab]) => { const [x1, y1] = nd(u), [x2, y2] = nd(v), mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + (u === 'tool' && v === 'plan' || u === 'grade' && v === 'rewrite' ? 22 : 0), on = i > 0 && F.script[i - 1][0] === u && cur === v; s += `<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" fill="none" stroke="${on ? 'var(--c1)' : 'var(--ax)'}" stroke-width="${on ? 4 : 2}" ${lab ? 'stroke-dasharray="6 4"' : ''} marker-end="url(#gar)"/>` + (lab ? `<text x="${mx}" y="${my - 6}" text-anchor="middle" class="m" font-size="10.5" font-style="italic">${esc(lab)}</text>` : ''); });
    Object.entries(F.nodes).forEach(([n, [x, y]]) => { const on = n === cur, term = n === 'START' || n === 'END'; s += `<g><rect x="${x - 40}" y="${y - 20}" width="80" height="40" rx="${term ? 20 : 10}" fill="${on ? 'var(--c1s)' : 'var(--surface)'}" stroke="${on ? 'var(--c1)' : 'var(--c0)'}" stroke-width="${on ? 4 : 2}"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-weight="800" font-size="13">${n}</text></g>`; });
    c.stage.innerHTML = s + '</svg>';
    c.say(`<span class="g"># state after step ${i + 1}</span>\n${JSON.stringify(st, null, 2).replace(/"([^"]+)":/g, '<span class="y">$1</span>:')}\n` + (i >= 0 ? `<span class="g"># ${esc(F.script[i][2])}</span>` : '<span class="g"># press Step: each node reads the shared state and returns an update to it</span>') + `\n\n${esc(F.code)}`);
  }
  c.select('graph', [['agent', 'tool-using agent'], ['rag', 'self-correcting RAG']], key, v => { key = v; i = -1; draw(); });
  c.button('Step', () => { if (i < FLOWS[key].script.length - 1) { i++; draw(); } }); c.button('Run', () => { clearInterval(timer); i = -1; draw(); timer = setInterval(() => { if (i >= FLOWS[key].script.length - 1) { clearInterval(timer); return; } i++; const t = timer; draw0(); }, 1300); }); c.button('Reset', () => { i = -1; draw(); });
  const draw0 = () => { const t = timer; draw(); timer = t; }; c.onDestroy(() => clearInterval(timer)); draw();
};
