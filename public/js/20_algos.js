'use strict';
/* =====================================================================
   Algorithms as animated 3-D scenes. Each algorithm is a list of FRAMES (what the data looks like after each step, and which line of
   the code is running). The viewer glides between frames, so you watch the data actually move: points join the nearest centre and the
   centres walk to the middle of their group, a ball rolls down a surface, a plane tilts into the cloud, the axes of a cloud appear and the
   points flatten onto them. Next to the hologram: the code with the running line highlighted, the variables, a plain-English note,
   a flowchart whose active box lights up (with a data packet travelling along the arrow), and the number the algorithm is improving.
   ===================================================================== */
const ALGO_COL = ['#2F6FE0', '#D2600F', '#1E8E5A', '#7A4FD0', '#0E8FA3', '#C2418A'];
const alNorm = (v, lo, hi) => (v - lo) / ((hi - lo) || 1) * 2 - 1;
const al3 = (r, range) => [alNorm(r[0], range[0], range[1]), alNorm(r[1], range[2], range[3]), alNorm(r[2], range[4], range[5])];
const alD2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const alMean = pts => pts.length ? [0, 1, 2].map(k => pts.reduce((s, p) => s + p[k], 0) / pts.length) : [0, 0, 0];
const alBlobs = (r, k, n, sd, spread = 2.0) => { const cen = []; while (cen.length < k) { const c = [r.norm(0, spread), r.norm(0, spread), r.norm(0, spread)]; if (cen.every(o => alD2(o, c) > 5)) cen.push(c); } return { cen, pts: Array.from({ length: n }, (_, i) => { const c = cen[i % k]; return { p: [c[0] + r.norm(0, sd), c[1] + r.norm(0, sd), c[2] + r.norm(0, sd)], y: i % k }; }) }; };
const alPeaks = (x, y) => 3 * Math.exp(-((x - 1.6) ** 2 + (y - 1.2) ** 2) / 1.2) + 2.2 * Math.exp(-((x + 1.8) ** 2 + (y + 1.6) ** 2) / 1.0) + 1.5 * Math.exp(-((x + 1.2) ** 2 + (y - 2.0) ** 2) / .8) + .12 * Math.sin(2 * x) * Math.cos(2 * y);
const alLerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const ALGOS = {
  kmeans: {
    icon: 'Km', title: 'k-means clustering', blurb: 'Centres walk to the middle of the points that chose them. Watch it settle.', range: [-5, 5, -5, 5, -5, 5],
    opts: [{ key: 'k', label: 'k (clusters)', min: 2, max: 5, step: 1, value: 3 }, { key: 'n', label: 'points', min: 30, max: 240, step: 10, value: 90 }],
    code: ['centroids = pick_k_random_points(X, k)', 'repeat:', '    labels = nearest_centroid(X, centroids)      # assign', '    for j in range(k):', '        centroids[j] = X[labels == j].mean(axis=0)   # update', '    if centroids did not move: break', 'return labels, centroids'],
    flow: { nodes: [{ id: 'a', text: 'Pick k random points as centres', kind: 'start', x: 0, y: 0, lines: [0] }, { id: 'b', text: 'Assign every point to its nearest centre', kind: 'step', x: 1, y: 0, lines: [2] }, { id: 'c', text: 'Move each centre to the mean of its points', kind: 'step', x: 2, y: 0, lines: [3, 4] }, { id: 'd', text: 'Did a centre move?', kind: 'decision', x: 2, y: 1, lines: [5] }, { id: 'e', text: 'Done: labels and centres', kind: 'end', x: 1, y: 1, lines: [6] }], edges: [['a', 'b', ''], ['b', 'c', 'labels'], ['c', 'd', 'new centres'], ['d', 'b', 'yes'], ['d', 'e', 'no']] },
    metric: 'inertia (sum of squared distances to the centre)',
    build(r, o) {
      const k = o.k, { pts } = alBlobs(r, k, o.n, .6 + k * .06), X = pts.map(q => q.p), frames = [], pick = []; while (pick.length < k) { const i = r.int(0, X.length - 1); if (!pick.includes(i)) pick.push(i); }
      let C = pick.map(i => X[i].slice()), lab = X.map(() => -1);
      const ball = (c, j) => ({ k: 'ball', p: c, r: 11, color: ALGO_COL[j % 6], ring: '#000' }), inertia = () => X.reduce((s, p, i) => s + (lab[i] >= 0 ? alD2(p, C[lab[i]]) : 0), 0);
      frames.push({ line: 0, note: `Choose ${k} data points at random as the first centres (the big balls). The points have no group yet.`, vars: { iteration: 0, k }, pts: X, col: X.map(() => '#8a95a5'), extra: C.map(ball), metric: null });
      for (let it = 1; it <= 14; it++) {
        lab = X.map(p => { let b = 0, bd = Infinity; C.forEach((c, j) => { const d = alD2(p, c); if (d < bd) { bd = d; b = j; } }); return b; });
        const inr = inertia();
        frames.push({ line: 2, note: `Iteration ${it}, assign: every point joins the centre that is closest to it, so it takes that centre's colour. The thin lines show the distances being measured.`, vars: { iteration: it, inertia: +inr.toFixed(1) }, pts: X, col: lab.map(l => ALGO_COL[l % 6]), extra: C.map(ball).concat(X.map((p, i) => ({ k: 'line', a: p, b: C[lab[i]], color: ALGO_COL[lab[i] % 6], w: .6, alpha: .35 }))), metric: inr });
        const nc = C.map((c, j) => { const m = X.filter((_, i) => lab[i] === j); return m.length ? alMean(m) : c; }), moved = Math.max(...nc.map((c, j) => Math.sqrt(alD2(c, C[j]))));
        C = nc; const inr2 = inertia();
        frames.push({ line: 4, note: `Iteration ${it}, update: each centre moves to the average position of the points that chose it (largest move: ${moved.toFixed(2)}). Because the centres moved, some points may now prefer a different centre.`, vars: { iteration: it, inertia: +inr2.toFixed(1), 'largest move': +moved.toFixed(3) }, pts: X, col: lab.map(l => ALGO_COL[l % 6]), extra: C.map(ball).concat(X.map((p, i) => ({ k: 'line', a: p, b: C[lab[i]], color: ALGO_COL[lab[i] % 6], w: .6, alpha: .35 }))), metric: inr2 });
        if (moved < .02) { frames.push({ line: 6, note: `No centre moved, so the groups are stable. The algorithm stops after ${it} iterations. Different random starts can give different groups: run it again with "New data".`, vars: { iteration: it, inertia: +inr2.toFixed(1), converged: 'yes' }, pts: X, col: lab.map(l => ALGO_COL[l % 6]), extra: C.map(ball), metric: inr2 }); break; }
      }
      return frames;
    },
  },

  gd: {
    icon: 'GD', title: 'Gradient descent', blurb: 'A ball rolls downhill on a loss surface. Change the learning rate and watch it crawl, glide or overshoot.', range: [-3.2, 3.2, -3.2, 3.2, -.5, 7],
    opts: [{ key: 'lr', label: 'learning rate', min: .05, max: 1.4, step: .05, value: .35 }, { key: 'x0', label: 'start x', min: -3, max: 3, step: .2, value: -2.4 }, { key: 'y0', label: 'start y', min: -3, max: 3, step: .2, value: 2.2 }],
    code: ['w = starting_point', 'for step in range(max_steps):', '    g = gradient(loss, w)        # slope under the ball', '    w = w - learning_rate * g    # a step downhill', '    if length(g) < tolerance: break', 'return w'],
    flow: { nodes: [{ id: 'a', text: 'Start at a point w', kind: 'start', x: 0, y: 0, lines: [0] }, { id: 'b', text: 'Measure the slope g at w', kind: 'step', x: 1, y: 0, lines: [2] }, { id: 'c', text: 'Step: w = w - lr x g', kind: 'step', x: 2, y: 0, lines: [3] }, { id: 'd', text: 'Slope almost flat?', kind: 'decision', x: 2, y: 1, lines: [4] }, { id: 'e', text: 'Done: w is a minimum', kind: 'end', x: 1, y: 1, lines: [5] }], edges: [['a', 'b', ''], ['b', 'c', 'slope g'], ['c', 'd', 'new w'], ['d', 'b', 'no'], ['d', 'e', 'yes']] },
    metric: 'loss (height of the surface)',
    surfFn: (x, y) => .13 * x * x + .2 * y * y + .35 * Math.sin(1.5 * x) * Math.sin(1.5 * y) + 1.2, surfTop: 6.5,
    build(r, o) {
      const f = (x, y) => .13 * x * x + .2 * y * y + .35 * Math.sin(1.5 * x) * Math.sin(1.5 * y) + 1.2, gx = (x, y) => .26 * x + .525 * Math.cos(1.5 * x) * Math.sin(1.5 * y), gy = (x, y) => .4 * y + .525 * Math.sin(1.5 * x) * Math.cos(1.5 * y);
      let x = o.x0, y = o.y0; const frames = [], trail = [[x, y, f(x, y)]], ball = (p, c) => ({ k: 'ball', p, r: 12, color: c || '#ffd166', ring: '#000' });
      frames.push({ line: 0, note: `Start at (${x.toFixed(1)}, ${y.toFixed(1)}). The height of the surface is the loss: we want to get to the lowest point.`, vars: { step: 0, x: +x.toFixed(2), y: +y.toFixed(2), loss: +f(x, y).toFixed(3), 'learning rate': o.lr }, pts: [], col: [], extra: [ball(trail[0])], metric: f(x, y) });
      for (let s = 1; s <= 40; s++) {
        const g = [gx(x, y), gy(x, y)], gl = Math.hypot(...g), z0 = f(x, y), top = [x, y, z0];
        frames.push({ line: 2, note: `Step ${s}: measure the slope under the ball. The red arrow points uphill with length ${gl.toFixed(2)}: the steeper, the longer.`, vars: { step: s, x: +x.toFixed(2), y: +y.toFixed(2), loss: +z0.toFixed(3), 'slope length': +gl.toFixed(3) }, pts: [], col: [], extra: [{ k: 'trail', pts: trail.slice() }, ball(top), { k: 'arrow', a: top, b: [x + g[0] * .9, y + g[1] * .9, z0 + .0], color: '#ff5c8a' }], metric: z0 });
        x -= o.lr * g[0]; y -= o.lr * g[1]; x = Math.max(-3.2, Math.min(3.2, x)); y = Math.max(-3.2, Math.min(3.2, y)); const z1 = f(x, y); trail.push([x, y, z1]);
        frames.push({ line: 3, note: `Step ${s}: move downhill by learning rate (${o.lr}) times the slope, in the opposite direction. New loss ${z1.toFixed(3)} (${z1 < z0 ? 'lower: good' : 'HIGHER: the step was too big and overshot'}).`, vars: { step: s, x: +x.toFixed(2), y: +y.toFixed(2), loss: +z1.toFixed(3), 'learning rate': o.lr }, pts: [], col: [], extra: [{ k: 'trail', pts: trail.slice() }, ball(trail[trail.length - 1], z1 < z0 ? '#ffd166' : '#ff5c8a')], metric: z1 });
        if (gl < .03) { frames.push({ line: 5, note: `The slope is almost zero: the ball is at the bottom of a valley after ${s} steps. (Other start points may end in a different valley: this surface has several.)`, vars: { steps: s, x: +x.toFixed(2), y: +y.toFixed(2), loss: +z1.toFixed(3), converged: 'yes' }, pts: [], col: [], extra: [{ k: 'trail', pts: trail.slice() }, ball(trail[trail.length - 1], '#1e8e5a')], metric: z1 }); break; }
      }
      return frames;
    },
  },

  linreg: {
    icon: 'Lr', title: 'Linear regression (fitting a plane)', blurb: 'A plane tilts and shifts until it hugs the cloud. The red lines are the errors.', range: [-4, 4, -4, 4, -6, 6],
    opts: [{ key: 'noise', label: 'noise', min: .1, max: 2, step: .1, value: .8 }, { key: 'lr', label: 'learning rate', min: .005, max: .08, step: .005, value: .03 }],
    code: ['w = [0, 0, 0]                       # plane  z = w0*x + w1*y + w2', 'for epoch in range(n_epochs):', '    pred = X @ w', '    err = pred - z', '    grad = X.T @ err / len(z)', '    w = w - lr * grad', 'return w'],
    flow: { nodes: [{ id: 'a', text: 'Start with a flat plane w = 0', kind: 'start', x: 0, y: 0, lines: [0] }, { id: 'b', text: 'Predict z for every point', kind: 'step', x: 1, y: 0, lines: [2] }, { id: 'c', text: 'Error = prediction - truth', kind: 'step', x: 2, y: 0, lines: [3] }, { id: 'd', text: 'Gradient, then w = w - lr x grad', kind: 'step', x: 2, y: 1, lines: [4, 5] }, { id: 'e', text: 'Repeat, then return w', kind: 'end', x: 1, y: 1, lines: [6] }], edges: [['a', 'b', ''], ['b', 'c', 'predictions'], ['c', 'd', 'errors'], ['d', 'b', 'new plane'], ['d', 'e', 'enough epochs']] },
    metric: 'mean squared error',
    build(r, o) {
      const a = +r.norm(.6, .5).toFixed(2), b = +r.norm(-.4, .5).toFixed(2), c = +r.norm(.5, .8).toFixed(2), X = Array.from({ length: 60 }, () => { const x = r() * 6 - 3, y = r() * 6 - 3; return [x, y, a * x + b * y + c + r.norm(0, o.noise)]; });
      let w = [0, 0, 0]; const frames = [], mse = w2 => X.reduce((s, p) => s + (w2[0] * p[0] + w2[1] * p[1] + w2[2] - p[2]) ** 2, 0) / X.length, resid = w2 => X.map(p => ({ k: 'line', a: p, b: [p[0], p[1], w2[0] * p[0] + w2[1] * p[1] + w2[2]], color: '#ff5c8a', w: .9, alpha: .55 })), plane = w2 => ({ k: 'plane', coef: w2.slice(), color: '#D2600F' });
      frames.push({ line: 0, note: 'Start with a flat plane at height 0. It knows nothing yet.', vars: { epoch: 0, 'w0 (slope in x)': 0, 'w1 (slope in y)': 0, 'w2 (height)': 0, mse: +mse(w).toFixed(2) }, pts: X, col: X.map(() => ALGO_COL[0]), extra: [plane(w)].concat(resid(w)), metric: mse(w) });
      for (let ep = 1; ep <= 120; ep++) {
        const g = [0, 0, 0]; X.forEach(p => { const e = w[0] * p[0] + w[1] * p[1] + w[2] - p[2]; g[0] += e * p[0]; g[1] += e * p[1]; g[2] += e; }); g.forEach((v, i) => { g[i] = v / X.length; }); w = w.map((v, i) => v - o.lr * g[i]);
        if (ep <= 6 || ep % 8 === 0 || ep === 120) frames.push({ line: 5, note: `Epoch ${ep}: the gradient says how each of the three numbers should change to shrink the squared errors. The plane tilts a little. (The true plane is z = ${a}x + ${b}y + ${c}.)`, vars: { epoch: ep, 'w0 (slope in x)': +w[0].toFixed(2), 'w1 (slope in y)': +w[1].toFixed(2), 'w2 (height)': +w[2].toFixed(2), mse: +mse(w).toFixed(2) }, pts: X, col: X.map(() => ALGO_COL[0]), extra: [plane(w)].concat(resid(w)), metric: mse(w) });
      }
      frames.push({ line: 6, note: `Done: the plane z = ${w[0].toFixed(2)}x + ${w[1].toFixed(2)}y + ${w[2].toFixed(2)} follows the cloud. More epochs or a larger learning rate would get closer to the true plane; noise limits how small the error can become.`, vars: { 'w0': +w[0].toFixed(2), 'w1': +w[1].toFixed(2), 'w2': +w[2].toFixed(2), mse: +mse(w).toFixed(2) }, pts: X, col: X.map(() => ALGO_COL[2]), extra: [plane(w)], metric: mse(w) });
      return frames;
    },
  },

  pca: {
    icon: 'Pc', title: 'PCA (principal components)', blurb: 'Find the directions a cloud is stretched along, then flatten it onto the best two.', range: [-6, 6, -6, 6, -6, 6],
    opts: [{ key: 'stretch', label: 'how stretched', min: 1.2, max: 4, step: .1, value: 2.8 }, { key: 'n', label: 'points', min: 40, max: 200, step: 10, value: 100 }],
    code: ['Xc = X - X.mean(axis=0)               # centre the data', 'C = Xc.T @ Xc / (n - 1)               # covariance', 'values, vectors = eigh(C)               # axes and their variance', 'order = argsort(values)[::-1]          # biggest variance first', 'W = vectors[:, order[:2]]              # keep the top 2 axes', 'Z = Xc @ W                             # points on the new axes'],
    flow: { nodes: [{ id: 'a', text: 'Centre the data (subtract the mean)', kind: 'start', x: 0, y: 0, lines: [0] }, { id: 'b', text: 'Covariance: how columns vary together', kind: 'step', x: 1, y: 0, lines: [1] }, { id: 'c', text: 'Eigenvectors = the new axes', kind: 'step', x: 2, y: 0, lines: [2, 3] }, { id: 'd', text: 'Keep the biggest 2 axes', kind: 'step', x: 2, y: 1, lines: [4] }, { id: 'e', text: 'Project: flatten onto the plane', kind: 'end', x: 1, y: 1, lines: [5] }], edges: [['a', 'b', 'centred X'], ['b', 'c', 'matrix C'], ['c', 'd', 'axes + variance'], ['d', 'e', 'W']] },
    metric: 'share of variance kept',
    build(r, o) {
      const R = (() => { const a = r() * 6.28, b = r() * 3.14, c = r() * 6.28, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c); return [[ca * cb, ca * sb * sc - sa * cc, ca * sb * cc + sa * sc], [sa * cb, sa * sb * sc + ca * cc, sa * sb * cc - ca * sc], [-sb, cb * sc, cb * cc]]; })();
      const X = Array.from({ length: o.n }, () => { const q = [r.norm(0, o.stretch), r.norm(0, o.stretch * .5), r.norm(0, .55)]; return [0, 1, 2].map(i => R[i][0] * q[0] + R[i][1] * q[1] + R[i][2] * q[2] + [1, -.6, .8][i]); }), mu = alMean(X), Xc = X.map(p => p.map((v, i) => v - mu[i])), n = Xc.length;
      const C = [0, 1, 2].map(i => [0, 1, 2].map(j => Xc.reduce((s, p) => s + p[i] * p[j], 0) / (n - 1)));
      /* Jacobi eigenvalue method for the 3x3 symmetric covariance matrix */
      let A = C.map(row => row.slice()), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      for (let sweep = 0; sweep < 30; sweep++) { let p = 0, q = 1, mx = 0; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (Math.abs(A[i][j]) > mx) { mx = Math.abs(A[i][j]); p = i; q = j; } if (mx < 1e-10) break; const th = .5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]), c2 = Math.cos(th), s2 = Math.sin(th); for (let k = 0; k < 3; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c2 * akp - s2 * akq; A[k][q] = s2 * akp + c2 * akq; } for (let k = 0; k < 3; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c2 * apk - s2 * aqk; A[q][k] = s2 * apk + c2 * aqk; } for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c2 * vkp - s2 * vkq; V[k][q] = s2 * vkp + c2 * vkq; } }
      const ev = [0, 1, 2].map(i => ({ val: A[i][i], vec: [V[0][i], V[1][i], V[2][i]] })).sort((a, b) => b.val - a.val), tot = ev.reduce((s, e) => s + e.val, 0), share = i => ev[i].val / tot, scaleOf = i => Math.sqrt(ev[i].val) * 2, colr = ['#ff5c8a', '#ffd166', '#9be7ff'];
      const axis = i => ({ k: 'arrow', a: ev[i].vec.map(v => -v * scaleOf(i)), b: ev[i].vec.map(v => v * scaleOf(i)), color: colr[i], w: 3 }), frames = [];
      frames.push({ line: 0, note: 'A cloud of points in 3-D. It is clearly longer in some directions than others. The yellow cross marks its average position.', vars: { points: n, columns: 3 }, pts: X, col: X.map(() => ALGO_COL[0]), extra: [{ k: 'ball', p: mu, r: 8, color: '#ffd166', ring: '#000' }], metric: null });
      frames.push({ line: 0, note: 'Step 1: centre the data. Subtract the mean from every column so the cloud sits around the origin. Shape does not change, only position.', vars: { 'mean x': +mu[0].toFixed(2), 'mean y': +mu[1].toFixed(2), 'mean z': +mu[2].toFixed(2) }, pts: Xc, col: Xc.map(() => ALGO_COL[0]), extra: [{ k: 'ball', p: [0, 0, 0], r: 8, color: '#ffd166', ring: '#000' }], metric: null });
      frames.push({ line: 1, note: 'Step 2: the covariance matrix records how each pair of columns varies together. Its eigenvectors are the directions of the cloud; its eigenvalues say how much variance lies along each.', vars: { 'cov(x,x)': +C[0][0].toFixed(2), 'cov(y,y)': +C[1][1].toFixed(2), 'cov(z,z)': +C[2][2].toFixed(2), 'cov(x,y)': +C[0][1].toFixed(2) }, pts: Xc, col: Xc.map(() => ALGO_COL[0]), extra: [{ k: 'ball', p: [0, 0, 0], r: 8, color: '#ffd166', ring: '#000' }], metric: null });
      [0, 1, 2].forEach(i => frames.push({ line: 2, note: `Step 3: principal axis ${i + 1} (${['red', 'yellow', 'blue'][i]}) carries ${(share(i) * 100).toFixed(0)}% of the variance. ${i === 0 ? 'It points along the longest stretch of the cloud.' : i === 1 ? 'It is perpendicular to the first and follows the next-longest stretch.' : 'It is the thin direction: almost nothing varies here.'}`, vars: { axis: i + 1, 'variance (eigenvalue)': +ev[i].val.toFixed(2), 'share': +(share(i) * 100).toFixed(1) + '%' }, pts: Xc, col: Xc.map(p => { const t = Math.max(-1, Math.min(1, (p[0] * ev[0].vec[0] + p[1] * ev[0].vec[1] + p[2] * ev[0].vec[2]) / 5)); return `hsl(${230 - 100 * (t + 1)},70%,55%)`; }), extra: [0, 1, 2].filter(j => j <= i).map(axis), metric: ev.slice(0, i + 1).reduce((s, e) => s + e.val, 0) / tot }));
      const proj = Xc.map(p => { const c1 = p[0] * ev[0].vec[0] + p[1] * ev[0].vec[1] + p[2] * ev[0].vec[2], c2 = p[0] * ev[1].vec[0] + p[1] * ev[1].vec[1] + p[2] * ev[1].vec[2]; return [0, 1, 2].map(k => c1 * ev[0].vec[k] + c2 * ev[1].vec[k]); });
      frames.push({ line: 4, note: `Step 4: keep only the top two axes. Together they keep ${((share(0) + share(1)) * 100).toFixed(0)}% of the variance. Every point is dropped straight onto the plane spanned by the red and yellow axes.`, vars: { kept: +((share(0) + share(1)) * 100).toFixed(1) + '%', lost: +(share(2) * 100).toFixed(1) + '%' }, pts: proj, col: Xc.map(p => { const t = Math.max(-1, Math.min(1, (p[0] * ev[0].vec[0] + p[1] * ev[0].vec[1] + p[2] * ev[0].vec[2]) / 5)); return `hsl(${230 - 100 * (t + 1)},70%,55%)`; }), extra: [axis(0), axis(1), { k: 'line', a: Xc[0], b: proj[0], color: '#fff', w: .6, alpha: .3 }].concat(Xc.slice(1, 40).map((p, i) => ({ k: 'line', a: p, b: proj[i + 1], color: '#fff', w: .5, alpha: .25 }))), metric: share(0) + share(1) });
      frames.push({ line: 5, note: 'Step 5: Z holds the coordinates on the two new axes. Three columns became two with little loss: the cloud is now flat and easy to plot. This is dimensionality reduction.', vars: { 'new columns': 2, 'variance kept': +((share(0) + share(1)) * 100).toFixed(1) + '%' }, pts: proj, col: Xc.map(() => ALGO_COL[2]), extra: [axis(0), axis(1)], metric: share(0) + share(1) });
      return frames;
    },
  },

  knn: {
    icon: 'kN', title: 'k-nearest neighbours', blurb: 'A new point asks its closest neighbours to vote. Move k to see the vote change.', range: [-5, 5, -5, 5, -5, 5],
    opts: [{ key: 'k', label: 'k (neighbours)', min: 1, max: 15, step: 2, value: 5 }, { key: 'n', label: 'points', min: 30, max: 150, step: 10, value: 70 }],
    code: ['d = distance(query, X)                # to every known point', 'nearest = argsort(d)[:k]               # the k closest', 'votes = count(labels[nearest])         # one vote each', 'prediction = most_common(votes)       # the winner'],
    flow: { nodes: [{ id: 'a', text: 'A new point arrives (the query)', kind: 'start', x: 0, y: 0, lines: [] }, { id: 'b', text: 'Measure the distance to every point', kind: 'step', x: 1, y: 0, lines: [0] }, { id: 'c', text: 'Take the k closest', kind: 'step', x: 2, y: 0, lines: [1] }, { id: 'd', text: 'Each neighbour votes with its label', kind: 'step', x: 2, y: 1, lines: [2] }, { id: 'e', text: 'Majority wins: predict that class', kind: 'end', x: 1, y: 1, lines: [3] }], edges: [['a', 'b', 'query'], ['b', 'c', 'distances'], ['c', 'd', 'neighbours'], ['d', 'e', 'counts']] },
    metric: 'votes for the winning class',
    build(r, o) {
      const { pts } = alBlobs(r, 3, o.n, .8, 1.9), X = pts.map(q => q.p), y = pts.map(q => q.y), frames = [], qs = [[r.norm(0, 2.5), r.norm(0, 2.5), r.norm(0, 2.5)], [r.norm(0, 2.5), r.norm(0, 2.5), r.norm(0, 2.5)]], col = X.map((_, i) => ALGO_COL[y[i]]);
      qs.forEach((q, qi) => {
        const d = X.map(p => Math.sqrt(alD2(p, q))), order = d.map((v, i) => [i, v]).sort((a, b) => a[1] - b[1]), near = order.slice(0, o.k).map(x => x[0]), votes = [0, 0, 0]; near.forEach(i => { votes[y[i]]++; }); const win = votes.indexOf(Math.max(...votes)), qball = (c) => ({ k: 'ball', p: q, r: 13, color: c, ring: '#fff' });
        frames.push({ line: 0, note: `Query ${qi + 1}: a new point (white ring) arrives and we do not know its class. Everything else is labelled by colour.`, vars: { query: qi + 1, k: o.k }, pts: X, col, extra: [qball('#ffffff')], metric: null });
        frames.push({ line: 0, note: 'Measure the distance from the query to every known point. Brighter lines are shorter distances.', vars: { 'distances computed': X.length, nearest: +order[0][1].toFixed(2), farthest: +order[order.length - 1][1].toFixed(2) }, pts: X, col, extra: [qball('#ffffff')].concat(X.map((p, i) => ({ k: 'line', a: q, b: p, color: '#ffffff', w: .5, alpha: Math.max(.04, .6 - d[i] / 9) }))), metric: null });
        frames.push({ line: 1, note: `Keep only the ${o.k} closest points (the lines that stay). Everything else is ignored.`, vars: { k: o.k, 'k-th distance': +order[o.k - 1][1].toFixed(2) }, pts: X, col: X.map((_, i) => near.includes(i) ? col[i] : '#3b4350'), extra: [qball('#ffffff')].concat(near.map(i => ({ k: 'line', a: q, b: X[i], color: col[i], w: 1.8, alpha: .95 }))), metric: null });
        frames.push({ line: 2, note: `Each neighbour casts one vote for its own class: ${votes.map((v, i) => `${['blue', 'orange', 'green'][i]} ${v}`).join(', ')}.`, vars: { 'votes blue': votes[0], 'votes orange': votes[1], 'votes green': votes[2] }, pts: X, col: X.map((_, i) => near.includes(i) ? col[i] : '#3b4350'), extra: [qball('#ffffff')].concat(near.map(i => ({ k: 'line', a: q, b: X[i], color: col[i], w: 1.8, alpha: .95 }))), metric: Math.max(...votes) });
        frames.push({ line: 3, note: `The majority wins: the query is predicted to be ${['blue', 'orange', 'green'][win]} (${votes[win]} of ${o.k} votes), so it takes that colour. Try another k: with k = 1 a single odd neighbour can decide, with a large k the vote becomes smoother.`, vars: { prediction: ['blue', 'orange', 'green'][win], votes: votes[win] + ' of ' + o.k }, pts: X, col, extra: [qball(ALGO_COL[win])].concat(near.map(i => ({ k: 'line', a: q, b: X[i], color: col[i], w: 1.2, alpha: .5 }))), metric: votes[win] });
      });
      return frames;
    },
  },

  tree: {
    icon: 'Dt', title: 'Decision tree', blurb: 'Cut the space with flat walls, one question at a time, until each region is one colour.', range: [-5, 5, -5, 5, -5, 5],
    opts: [{ key: 'depth', label: 'max depth', min: 1, max: 4, step: 1, value: 3 }, { key: 'n', label: 'points', min: 40, max: 200, step: 10, value: 110 }],
    code: ['def build(points, depth):', '    if pure(points) or depth == max_depth:', '        return Leaf(majority(points))', '    feature, cut = best_split(points)   # lowest Gini impurity', '    left, right = split(points, feature, cut)', '    return Node(feature, cut, build(left, depth+1), build(right, depth+1))'],
    flow: { nodes: [{ id: 'a', text: 'Take the points in this region', kind: 'start', x: 0, y: 0, lines: [0] }, { id: 'b', text: 'Pure, or max depth?', kind: 'decision', x: 1, y: 0, lines: [1] }, { id: 'c', text: 'Make a leaf: predict the majority', kind: 'end', x: 1, y: 1, lines: [2] }, { id: 'd', text: 'Find the best feature and cut', kind: 'step', x: 2, y: 0, lines: [3] }, { id: 'e', text: 'Split into left and right regions', kind: 'step', x: 3, y: 0, lines: [4, 5] }], edges: [['a', 'b', ''], ['b', 'c', 'yes'], ['b', 'd', 'no'], ['d', 'e', 'cut'], ['e', 'a', 'each side']] },
    metric: 'points classified correctly',
    build(r, o) {
      const k = 3, { pts } = alBlobs(r, k, o.n, .75, 2.0), X = pts.map(q => q.p), y = pts.map(q => q.y), frames = [], names = ['x', 'y', 'z'], gini = idx => { if (!idx.length) return 0; const c = [0, 0, 0]; idx.forEach(i => { c[y[i]]++; }); return 1 - c.reduce((s, v) => s + (v / idx.length) ** 2, 0); }, major = idx => { const c = [0, 0, 0]; idx.forEach(i => { c[y[i]]++; }); return c.indexOf(Math.max(...c)); };
      const region = [-5, 5, -5, 5, -5, 5], leafOf = new Array(X.length).fill(0), walls = [], leafCol = { 0: '#8a95a5' };
      const colorsNow = () => X.map((_, i) => ALGO_COL[y[i]]), accuracy = () => { const groups = {}; X.forEach((_, i) => { (groups[leafOf[i]] = groups[leafOf[i]] || []).push(i); }); return Object.values(groups).reduce((s, g) => s + g.filter(i => y[i] === major(g)).length, 0); };
      let nextLeaf = 1; const queue = [{ idx: X.map((_, i) => i), box: region.slice(), depth: 0, id: 0 }];
      frames.push({ line: 0, note: 'All the points are in one big region and the classes are mixed. A decision tree will cut the space with flat walls.', vars: { regions: 1, depth: 0, impurity: +gini(queue[0].idx).toFixed(3) }, pts: X, col: colorsNow(), extra: [], metric: accuracy() });
      while (queue.length) {
        const nd = queue.shift(), g = gini(nd.idx), pure = g < .02;
        if (pure || nd.depth >= o.depth || nd.idx.length < 4) { frames.push({ line: 2, note: `This region has ${nd.idx.length} points and is ${pure ? 'pure (one class)' : 'at the depth limit'}, so it becomes a leaf that predicts ${['blue', 'orange', 'green'][major(nd.idx)]}.`, vars: { region: nd.id, points: nd.idx.length, impurity: +g.toFixed(3), prediction: ['blue', 'orange', 'green'][major(nd.idx)] }, pts: X, col: colorsNow(), extra: walls.map(w => w), metric: accuracy() }); continue; }
        let best = null; for (let f = 0; f < 3; f++) { const vals = nd.idx.map(i => X[i][f]).sort((a, b) => a - b); for (let t = 1; t < vals.length; t++) { const cut = (vals[t - 1] + vals[t]) / 2, L = nd.idx.filter(i => X[i][f] <= cut), R = nd.idx.filter(i => X[i][f] > cut); if (L.length < 2 || R.length < 2) continue; const w = (L.length * gini(L) + R.length * gini(R)) / nd.idx.length; if (!best || w < best.w) best = { f, cut, w, L, R }; } }
        if (!best) continue;
        const b = nd.box, f = best.f, wall = (() => { const [x0, x1, y0, y1, z0, z1] = b, c = best.cut; return f === 0 ? [[c, y0, z0], [c, y1, z0], [c, y1, z1], [c, y0, z1]] : f === 1 ? [[x0, c, z0], [x1, c, z0], [x1, c, z1], [x0, c, z1]] : [[x0, y0, c], [x1, y0, c], [x1, y1, c], [x0, y1, c]]; })();
        const wallItem = { k: 'rect', pts: wall, color: ALGO_COL[(walls.length + 3) % 6] }; walls.push(wallItem);
        const lb = b.slice(), rb = b.slice(); lb[f * 2 + 1] = best.cut; rb[f * 2] = best.cut; const lid = nextLeaf++, rid = nextLeaf++; best.L.forEach(i => { leafOf[i] = lid; }); best.R.forEach(i => { leafOf[i] = rid; });
        frames.push({ line: 3, note: `Region ${nd.id} (${nd.idx.length} points, impurity ${g.toFixed(2)}): try every feature and every cut and keep the one that makes the two sides purest. Best: ${names[f]} = ${best.cut.toFixed(2)} (weighted impurity ${best.w.toFixed(2)}).`, vars: { region: nd.id, depth: nd.depth, feature: names[f], cut: +best.cut.toFixed(2), 'impurity after': +best.w.toFixed(3) }, pts: X, col: colorsNow(), extra: walls.slice(), metric: accuracy() });
        frames.push({ line: 4, note: `The wall splits the region into a left part (${best.L.length} points) and a right part (${best.R.length} points). Each part is processed the same way: that is recursion.`, vars: { left: best.L.length, right: best.R.length, regions: nextLeaf }, pts: X, col: X.map((_, i) => nd.idx.includes(i) ? (best.L.includes(i) ? ALGO_COL[y[i]] : ALGO_COL[y[i]]) : ALGO_COL[y[i]]), extra: walls.slice(), metric: accuracy() });
        queue.push({ idx: best.L, box: lb, depth: nd.depth + 1, id: lid }, { idx: best.R, box: rb, depth: nd.depth + 1, id: rid });
      }
      frames.push({ line: 5, note: `The tree is finished: ${walls.length} walls, ${nextLeaf} regions. To classify a new point you ask the wall questions in order and read the colour of the region you end in. ${accuracy()} of ${X.length} training points are classified correctly; a deeper tree would fit even the odd ones, but may be memorising noise.`, vars: { walls: walls.length, regions: nextLeaf, correct: accuracy() + ' / ' + X.length }, pts: X, col: colorsNow(), extra: walls.slice(), metric: accuracy() });
      return frames;
    },
  },
  pso: {
    icon: 'Ps', title: 'Particle swarm optimisation', blurb: 'A flock searches for the highest peak. Each bird remembers its best spot and listens to the flock.', range: [-3.2, 3.2, -3.2, 3.2, -.4, 4.2], surfFn: alPeaks, surfTop: 3.6,
    opts: [{ key: 'n', label: 'particles', min: 6, max: 40, step: 2, value: 18 }, { key: 'social', label: 'pull to the flock', min: 0, max: 2.5, step: .1, value: 1.5 }, { key: 'inertia', label: 'inertia', min: .2, max: .95, step: .05, value: .72 }],
    code: ['particles = random_positions(n); velocity = small', 'for step in range(steps):', '    for each particle:', '        v = w*v + c1*r1*(my_best - x) + c2*r2*(flock_best - x)', '        x = x + v', '        if height(x) > height(my_best): my_best = x', '    flock_best = best of all my_best', 'return flock_best'],
    flow: { nodes: [{ id: 'a', text: 'Scatter particles at random', kind: 'start', x: 0, y: 0, lines: [0] }, { id: 'b', text: 'Pull toward my best and the flock best', kind: 'step', x: 1, y: 0, lines: [3] }, { id: 'c', text: 'Move: x = x + v', kind: 'step', x: 2, y: 0, lines: [4] }, { id: 'd', text: 'Better than my best? Remember it', kind: 'step', x: 2, y: 1, lines: [5, 6] }, { id: 'e', text: 'Enough steps: return the flock best', kind: 'end', x: 1, y: 1, lines: [7] }], edges: [['a', 'b', ''], ['b', 'c', 'velocity'], ['c', 'd', 'new spots'], ['d', 'b', 'repeat'], ['d', 'e', 'done']] },
    metric: 'height of the best spot found',
    build(r, o) {
      const n = o.n, P = Array.from({ length: n }, () => [r() * 6 - 3, r() * 6 - 3]), Vv = P.map(() => [r.norm(0, .15), r.norm(0, .15)]), B = P.map(p => p.slice()), z = p => alPeaks(p[0], p[1]); let G = B.reduce((a, b) => (z(b) > z(a) ? b : a), B[0]).slice();
      const lift = p => [p[0], p[1], z(p) + .05], pts = () => P.map(lift), col = () => P.map(p => `hsl(${230 - 190 * Math.max(0, Math.min(1, z(p) / 3.2))},80%,60%)`), best = () => ({ k: 'ball', p: [G[0], G[1], z(G) + .15], r: 14, color: '#ffd166', ring: '#000' }), frames = [];
      frames.push({ line: 0, note: `${n} particles are dropped at random on the landscape. Height is how good a spot is; we want the highest peak. There are three peaks, so a lone searcher can get stuck on a small one.`, vars: { step: 0, particles: n, 'best height': +z(G).toFixed(2) }, pts: pts(), col: col(), extra: [best()], metric: z(G) });
      for (let st = 1; st <= 22; st++) {
        const arrows = []; for (let i = 0; i < n; i++) { const r1 = r(), r2 = r(); Vv[i] = Vv[i].map((v, k) => o.inertia * v + 1.5 * r1 * (B[i][k] - P[i][k]) + o.social * r2 * (G[k] - P[i][k])); Vv[i] = Vv[i].map(v => Math.max(-.8, Math.min(.8, v))); if (i < 8) arrows.push({ k: 'arrow', a: lift(P[i]), b: lift([P[i][0] + Vv[i][0] * 1.4, P[i][1] + Vv[i][1] * 1.4]), color: '#ffffff' }); }
        frames.push({ line: 3, note: `Step ${st}: every particle works out a new velocity: a bit of its old velocity (inertia ${o.inertia}), a pull toward the best spot it has ever seen, and a pull toward the best spot the whole flock has seen (strength ${o.social}). White arrows show the velocities.`, vars: { step: st, 'best height': +z(G).toFixed(2), inertia: o.inertia, 'flock pull': o.social }, pts: pts(), col: col(), extra: [best()].concat(arrows), metric: z(G) });
        for (let i = 0; i < n; i++) { P[i] = P[i].map((v, k) => Math.max(-3.2, Math.min(3.2, v + Vv[i][k]))); if (z(P[i]) > z(B[i])) B[i] = P[i].slice(); if (z(P[i]) > z(G)) G = P[i].slice(); }
        frames.push({ line: 4, note: `Step ${st}: the particles move. Anyone who finds a better spot than its own best remembers it; if it beats the whole flock, the gold ball jumps there. Best height so far ${z(G).toFixed(2)}.`, vars: { step: st, 'best height': +z(G).toFixed(2), 'spread': +(P.reduce((s, p) => s + Math.hypot(p[0] - G[0], p[1] - G[1]), 0) / n).toFixed(2) }, pts: pts(), col: col(), extra: [best()], metric: z(G) });
      }
      frames.push({ line: 7, note: `The flock has gathered around the best spot found, height ${z(G).toFixed(2)} (the tallest peak is about 3.1). Lower inertia or less flock pull makes the search more careful but slower; too much pull makes everyone rush to the first good spot and miss the real peak.`, vars: { 'best height': +z(G).toFixed(2), 'peak height': 3.1 }, pts: pts(), col: col(), extra: [best()], metric: z(G) });
      return frames;
    },
  },

  ga: {
    icon: 'Ga', title: 'Genetic algorithm (evolution)', blurb: 'A population climbs a landscape by survival of the fittest: select, breed, mutate.', range: [-3.2, 3.2, -3.2, 3.2, -.4, 4.2], surfFn: alPeaks, surfTop: 3.6,
    opts: [{ key: 'n', label: 'population', min: 10, max: 40, step: 2, value: 24 }, { key: 'mut', label: 'mutation size', min: 0, max: 1.2, step: .05, value: .35 }],
    code: ['population = random_individuals(n)', 'for generation in range(G):', '    fitness = [height(p) for p in population]', '    parents = keep_the_best_half(population, fitness)', '    children = [mix(a, b) for a, b in random_pairs(parents)]', '    population = parents + mutate(children)', 'return best(population)'],
    flow: { nodes: [{ id: 'a', text: 'Random population', kind: 'start', x: 0, y: 0, lines: [0] }, { id: 'b', text: 'Fitness: how high is each one?', kind: 'step', x: 1, y: 0, lines: [2] }, { id: 'c', text: 'Selection: the best half survive', kind: 'step', x: 2, y: 0, lines: [3] }, { id: 'd', text: 'Crossover + mutation make children', kind: 'step', x: 2, y: 1, lines: [4, 5] }, { id: 'e', text: 'Return the best individual', kind: 'end', x: 1, y: 1, lines: [6] }], edges: [['a', 'b', ''], ['b', 'c', 'fitness'], ['c', 'd', 'parents'], ['d', 'b', 'next generation'], ['d', 'e', 'enough generations']] },
    metric: 'fitness (height) of the best individual',
    build(r, o) {
      const n = o.n, z = p => alPeaks(p[0], p[1]), lift = p => [p[0], p[1], z(p) + .05]; let pop = Array.from({ length: n }, () => [r() * 6 - 3, r() * 6 - 3]); const frames = [], clampP = p => p.map(v => Math.max(-3.2, Math.min(3.2, v))), bestOf = () => Math.max(...pop.map(z)), meanOf = () => pop.reduce((s, p) => s + z(p), 0) / pop.length;
      const colFit = (p, alive = true) => alive ? `hsl(${230 - 190 * Math.max(0, Math.min(1, z(p) / 3.2))},80%,60%)` : '#3b4350';
      frames.push({ line: 0, note: `A population of ${n} random individuals. Each one is a point (x, y) on the landscape: its "genes" are the two coordinates.`, vars: { generation: 0, best: +bestOf().toFixed(2), average: +meanOf().toFixed(2) }, pts: pop.map(lift), col: pop.map(p => colFit(p)), extra: [], metric: bestOf() });
      for (let g = 1; g <= 14; g++) {
        const order = pop.map((p, i) => [i, z(p)]).sort((a, b) => b[1] - a[1]), keep = order.slice(0, n >> 1).map(x => x[0]), drop = order.slice(n >> 1).map(x => x[0]);
        frames.push({ line: 2, note: `Generation ${g}, fitness: the height of each individual is measured. Warm colour = high, cool = low.`, vars: { generation: g, best: +bestOf().toFixed(2), average: +meanOf().toFixed(2) }, pts: pop.map(lift), col: pop.map(p => colFit(p)), extra: [], metric: bestOf() });
        frames.push({ line: 3, note: `Selection: the better half (bright) survive to become parents. The grey half will not reproduce.`, vars: { generation: g, parents: keep.length, culled: drop.length }, pts: pop.map(lift), col: pop.map((p, i) => keep.includes(i) ? colFit(p) : '#3b4350'), extra: [], metric: bestOf() });
        const child = drop.map(() => { const a = pop[keep[r.int(0, keep.length - 1)]], b = pop[keep[r.int(0, keep.length - 1)]], mixc = r() < .5 ? [a[0], b[1]] : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; return { c: mixc, a, b }; }), nxt = pop.map(p => p.slice()); drop.forEach((di, k) => { nxt[di] = child[k].c.slice(); });
        frames.push({ line: 4, note: `Crossover: each grey individual is replaced by a child that mixes the genes of two random parents (for example the x of one and the y of the other, or their average). The thin lines link children to parents.`, vars: { generation: g, children: child.length }, pts: nxt.map(lift), col: nxt.map((p, i) => keep.includes(i) ? colFit(p) : '#ffd166'), extra: drop.flatMap((di, k) => [{ k: 'line', a: lift(child[k].a), b: lift(child[k].c), color: '#ffd166', w: 1, alpha: .6 }, { k: 'line', a: lift(child[k].b), b: lift(child[k].c), color: '#ffd166', w: 1, alpha: .6 }]), metric: Math.max(...nxt.map(z)) });
        pop = nxt.map((p, i) => keep.includes(i) ? p : clampP([p[0] + r.norm(0, o.mut), p[1] + r.norm(0, o.mut)]));
        frames.push({ line: 5, note: `Mutation: the children are nudged randomly (size ${o.mut}), so the population explores near what already works. Best height ${bestOf().toFixed(2)}, average ${meanOf().toFixed(2)}: the average rises as generations pass.`, vars: { generation: g, best: +bestOf().toFixed(2), average: +meanOf().toFixed(2) }, pts: pop.map(lift), col: pop.map(p => colFit(p)), extra: [], metric: bestOf() });
      }
      frames.push({ line: 6, note: `After 14 generations the population has climbed toward a peak: best fitness ${bestOf().toFixed(2)}. With no mutation it can stall on a small hill; with too much it never settles.`, vars: { best: +bestOf().toFixed(2), average: +meanOf().toFixed(2) }, pts: pop.map(lift), col: pop.map(p => colFit(p)), extra: [], metric: bestOf() });
      return frames;
    },
  },

};

/* ---------------- viewer ---------------- */
function algoView(id, o = {}) {
  const A = ALGOS[id], root = h('div', { class: 'stack explorer algo' }), W = 760, H = 460;
  const S = { opts: Object.fromEntries(A.opts.map(o => [o.key, o.value])), nonce: 0, frames: [], i: 0, prog: 1, playing: false, speed: 1, last: 0, hold: 0 };
  const seed = () => BIG.hash('algo:' + id + ':' + (DSQ.S && DSQ.S.me ? DSQ.S.me.username : 'guest') + ':' + S.nonce);
  const holo = h('div', { class: 'ex-holo' }), flowSvg = document.createElementNS(SVGNS, 'svg'), spark = document.createElementNS(SVGNS, 'svg');
  flowSvg.setAttribute('viewBox', '0 0 760 250'); flowSvg.setAttribute('class', 'ex-svg'); spark.setAttribute('viewBox', '0 0 760 90'); spark.setAttribute('class', 'ex-svg');
  const codeEl = h('div', { class: 'alg-code mono' }), varsEl = h('div', { class: 'alg-vars' }), noteEl = h('div', { class: 'card pad alg-note' }), stepLbl = h('span', { class: 'chip' });
  const p3 = Plot3D(holo, { w: W, h: H, az: .75, el: .42, wheel: true, zoom: 1.55, label: '3-D animation of the algorithm. Drag to rotate, wheel to zoom.' });
  const scrub = h('input', { type: 'range', min: 0, max: 1, value: 0, 'aria-label': 'step', style: { flex: '1 1 160px' } });
  const playBtn = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { if (!S.playing && S.i >= S.frames.length - 1) { S.i = 0; S.prog = 1; } S.playing = !S.playing; S.last = performance.now(); playBtn.textContent = S.playing ? '❚❚ Pause' : '▶ Play'; } }, '▶ Play');
  const tb = (t, f, title) => h('button', { class: 'btn sm', type: 'button', title, onclick: f }, t);
  const goto = (i, anim) => { S.i = Math.max(0, Math.min(S.frames.length - 1, i)); S.prog = anim ? 0 : 1; S.hold = 0; };
  const optBox = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '10px' } });
  A.opts.forEach(o => { const val = h('b', {}, String(o.value)), inp = h('input', { type: 'range', min: o.min, max: o.max, step: o.step, value: o.value, 'aria-label': o.label, oninput: e => { S.opts[o.key] = +e.target.value; val.textContent = e.target.value; }, onchange: () => rebuild() }); optBox.append(h('label', { class: 'sw' }, o.label + ' ', inp, val)); });
  function rebuild() { S.frames = A.build(RNG(seed()), Object.assign({}, S.opts)); scrub.max = S.frames.length - 1; goto(0, false); S.playing = false; playBtn.textContent = '▶ Play'; drawStatic(); }
  const bar = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, playBtn, tb('◀ Step', () => { S.playing = false; playBtn.textContent = '▶ Play'; goto(S.i - 1, true); }, 'Previous step'), tb('Step ▶', () => { S.playing = false; playBtn.textContent = '▶ Play'; goto(S.i + 1, true); }, 'Next step'), tb('↺ Restart', () => { goto(0, false); }, ''), h('label', { class: 'sw' }, 'speed ', h('input', { type: 'range', min: .3, max: 3, step: .1, value: 1, oninput: e => { S.speed = +e.target.value; } })), tb('New data', () => { S.nonce++; rebuild(); }, 'The same algorithm on different data'), tb('Zoom +', () => p3.zoomBy(1.4), ''), tb('Zoom -', () => p3.zoomBy(1 / 1.4), ''), tb('Reset view', () => { p3.resetZoom(); p3.set3d(.75, .42); }, ''), stepLbl);
  scrub.addEventListener('input', () => { S.playing = false; playBtn.textContent = '▶ Play'; goto(+scrub.value, false); });

  /* ---- scene ---- */
  const mixF = (a, b, t) => { if (!a || !b || a.k !== b.k) return b; const o = Object.assign({}, b); ['p', 'a', 'b', 'coef'].forEach(key => { if (a[key] && b[key] && a[key].length === b[key].length) o[key] = alLerp(a[key], b[key], t); }); if (a.pts && b.pts && a.pts.length === b.pts.length) o.pts = a.pts.map((q, i) => alLerp(q, b.pts[i], t)); return o; };
  function sceneItems(t) {
    const R = A.range, F = S.frames, cur = F[S.i], prev = S.prog < 1 && S.i > 0 ? F[S.i - 1] : null, e = S.prog < 1 ? 1 - Math.pow(1 - S.prog, 3) : 1, it = [], E = '#8A958F';
    const NN = q => al3(q, R), c2 = [-1, 1]; for (const a of c2) for (const b of c2) it.push({ t: 'line', a: [-1, a, b], b: [1, a, b], color: E, w: .8 }, { t: 'line', a: [a, -1, b], b: [a, 1, b], color: E, w: .8 }, { t: 'line', a: [a, b, -1], b: [a, b, 1], color: E, w: .8 });
    for (let i = 1; i < 4; i++) { const u = -1 + i * .5; it.push({ t: 'line', a: [u, -1, -1], b: [u, 1, -1], color: E, w: .4, g: true }, { t: 'line', a: [-1, u, -1], b: [1, u, -1], color: E, w: .4, g: true }); }
    [0, .5, 1].forEach(f => { it.push({ t: 'txt', p: [alNorm(R[0] + (R[1] - R[0]) * f, R[0], R[1]), -1.17, -1], s: stuF(R[0] + (R[1] - R[0]) * f), size: 10, mono: true }, { t: 'txt', p: [-1.17, alNorm(R[2] + (R[3] - R[2]) * f, R[2], R[3]), -1], s: stuF(R[2] + (R[3] - R[2]) * f), size: 10, mono: true }, { t: 'txt', p: [-1.2, -1.2, alNorm(R[4] + (R[5] - R[4]) * f, R[4], R[5])], s: stuF(R[4] + (R[5] - R[4]) * f), size: 10, mono: true }); });
    if (A.surfFn) { const f = A.surfFn, G = 22; for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const xs = [i, i + 1, i + 1, i].map(k => R[0] + (R[1] - R[0]) * k / G), ys = [j, j, j + 1, j + 1].map(k => R[2] + (R[3] - R[2]) * k / G), zs = xs.map((x, k) => f(x, ys[k])), h0 = (zs[0] + zs[2]) / 2 / A.surfTop; it.push({ t: 'poly', pts: xs.map((x, k) => al3([x, ys[k], zs[k]], R)), fill: `hsla(${230 - 190 * Math.max(0, Math.min(1, h0))},65%,${38 + 22 * Math.max(0, Math.min(1, h0))}%,.45)`, stroke: 'rgba(255,255,255,.12)', sw: .4 }); } }
    /* points */
    const pa = cur.pts || [], pb = prev && prev.pts && prev.pts.length === pa.length ? prev.pts : null;
    pa.forEach((q, i) => { const p = pb ? alLerp(pb[i], q, e) : q, col = (S.prog > .4 || !prev) ? cur.col[i] : (prev.col ? prev.col[i] : cur.col[i]); it.push({ t: 'pt', p: NN(p), r: 5, color: col || '#9be7ff', ring: 'rgba(255,255,255,.55)' }); });
    /* extras */
    const ea = cur.extra || [], eb = prev ? (prev.extra || []) : [];
    ea.forEach((x, i) => { const m = prev && eb[i] && eb[i].k === x.k ? mixF(eb[i], x, e) : x; if (prev && !eb[i] && x.k === 'line' && e < .3) return; drawExtra(it, m, NN, t); });
    return it;
  }
  function drawExtra(it, x, NN, t) {
    const R = A.range;
    if (x.k === 'ball') it.push(...SH.sphere(NN(x.p), .075 + (x.r || 10) / 160, x.color, { a: .85, glow: .8, lat: 4, lon: 8 }), { t: 'pt', p: NN(x.p), r: 4, color: '#fff' });
    else if (x.k === 'line') it.push({ t: 'line', a: NN(x.a), b: NN(x.b), color: x.color + (x.color.length === 7 ? Math.round((x.alpha ?? 1) * 255).toString(16).padStart(2, '0') : ''), w: x.w || 1 });
    else if (x.k === 'arrow') it.push(...SH.arrow(NN(x.a), NN(x.b), x.color, { w: x.w || 2.4, head: .18 }));
    else if (x.k === 'trail') { x.pts.forEach((p, i) => { if (i) it.push({ t: 'line', a: NN(x.pts[i - 1]), b: NN(p), color: 'rgba(255,209,102,.9)', w: 2 }); if (i % 1 === 0) it.push({ t: 'pt', p: NN(p), r: 3, color: '#ffd166' }); }); }
    else if (x.k === 'plane') { const G = 8, w = x.coef; for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const xs = [i, i + 1, i + 1, i].map(k => R[0] + (R[1] - R[0]) * k / G), ys = [j, j, j + 1, j + 1].map(k => R[2] + (R[3] - R[2]) * k / G); it.push({ t: 'poly', pts: xs.map((px, k) => { const z = w[0] * px + w[1] * ys[k] + w[2]; return NN([px, ys[k], Math.max(R[4], Math.min(R[5], z))]); }), fill: 'rgba(210,96,15,.16)', stroke: 'rgba(255,170,90,.4)', sw: .5 }); } }
    else if (x.k === 'rect') it.push({ t: 'poly', pts: x.pts.map(NN), fill: x.color + '33', stroke: x.color + 'cc', sw: 1.2 });
  }
  /* ---- code, variables, notes ---- */
  function drawText() {
    const f = S.frames[S.i]; codeEl.innerHTML = A.code.map((l, k) => `<div class="cl${f.line === k ? ' on' : ''}"><span>${k + 1}</span><code>${hlPy(l) || ' '}</code></div>`).join('');
    varsEl.innerHTML = Object.entries(f.vars || {}).map(([k, v]) => `<div class="vr"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join(''); noteEl.innerHTML = `<p style="margin:0">${f.note}</p>`;
    stepLbl.textContent = `step ${S.i + 1} / ${S.frames.length}`; scrub.value = S.i;
  }
  /* ---- flowchart ---- */
  function drawFlow() {
    const fl = A.flow, f = S.frames[S.i], cw = 170, ch = 54, X0 = 20, gx = 38, gy = 62; const pos = n => [X0 + n.x * (cw + gx) + cw / 2, 28 + n.y * (ch + gy) + ch / 2]; const byId = Object.fromEntries(fl.nodes.map(n => [n.id, n]));
    const active = fl.nodes.find(n => n.lines.includes(f.line)), prevN = S.i > 0 ? fl.nodes.find(n => n.lines.includes(S.frames[S.i - 1].line)) : null;
    let s = '<defs><marker id="ala" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9z" fill="var(--muted)"/></marker></defs>', eIdx = -1;
    fl.edges.forEach(([a, b, lab], ei) => { const A1 = pos(byId[a]), B1 = pos(byId[b]); let d, mx, my; const same = Math.abs(A1[1] - B1[1]) < 4, vert = Math.abs(A1[0] - B1[0]) < 4;
      if (same) { const dir = B1[0] > A1[0] ? 1 : -1; d = `M${A1[0] + dir * (cw / 2)} ${A1[1]}L${B1[0] - dir * (cw / 2 + 3)} ${B1[1]}`; mx = (A1[0] + B1[0]) / 2; my = A1[1] - 6; }
      else if (vert) { const dir = B1[1] > A1[1] ? 1 : -1; d = `M${A1[0]} ${A1[1] + dir * ch / 2}L${B1[0]} ${B1[1] - dir * (ch / 2 + 3)}`; mx = A1[0] + 6; my = (A1[1] + B1[1]) / 2; }
      else { const up = B1[1] < A1[1]; d = up ? `M${A1[0] - cw / 2} ${A1[1]}C${A1[0] - cw} ${A1[1]} ${B1[0] - cw / 2} ${B1[1] + 40} ${B1[0] - 10} ${B1[1] + ch / 2 + 3}` : `M${A1[0]} ${A1[1] + ch / 2}C${A1[0]} ${A1[1] + ch} ${B1[0] + cw / 3} ${B1[1] - ch / 2 - 20} ${B1[0] + 20} ${B1[1] - ch / 2 - 3}`; mx = (A1[0] + B1[0]) / 2; my = (A1[1] + B1[1]) / 2; }
      const on = active && prevN && prevN.id === a && active.id === b; if (on) eIdx = ei;
      s += `<path class="afe" id="afe${ei}" d="${d}" stroke="${on ? '#ffd166' : 'var(--muted)'}" stroke-width="${on ? 3 : 1.6}" marker-end="url(#ala)" fill="none"/>${lab ? `<text x="${mx}" y="${my}" text-anchor="middle" class="tk" style="paint-order:stroke;stroke:var(--surface2);stroke-width:4px">${esc(lab)}</text>` : ''}`; });
    fl.nodes.forEach(n => { const [x, y] = pos(n), on = active && active.id === n.id, col = n.kind === 'decision' ? '#D2600F' : n.kind === 'end' ? '#1E8E5A' : n.kind === 'start' ? '#7A4FD0' : '#2F6FE0', st = `fill="${col}" fill-opacity="${on ? .4 : .13}" stroke="${on ? '#ffd166' : col}" stroke-width="${on ? 3.4 : 1.7}"`;
      s += n.kind === 'decision' ? `<path d="M${x} ${y - ch / 2 - 6}L${x + cw / 2} ${y}L${x} ${y + ch / 2 + 6}L${x - cw / 2} ${y}Z" ${st}/>` : `<rect x="${x - cw / 2}" y="${y - ch / 2}" width="${cw}" height="${ch}" rx="${n.kind === 'start' || n.kind === 'end' ? 27 : 8}" ${st}/>`;
      const words = n.text.split(' '), l1 = []; let acc = ''; words.forEach(w => { if ((acc + ' ' + w).length > 24 && acc) { l1.push(acc); acc = w; } else acc = acc ? acc + ' ' + w : w; }); l1.push(acc); l1.slice(0, 3).forEach((t, k) => { s += `<text x="${x}" y="${y + 4 + (k - (Math.min(l1.length, 3) - 1) / 2) * 13}" text-anchor="middle" class="tk" style="fill:var(--fg);font-size:11px">${esc(t)}</text>`; }); });
    s += '<g id="afdot"></g>'; flowSvg.innerHTML = s; S._flowEdge = eIdx;
  }
  function drawSpark() {
    const ms = S.frames.map(f => f.metric).filter(v => v != null); if (ms.length < 2) { spark.innerHTML = '<text x="12" y="48" class="tk">This algorithm has no single number to track; read the notes.</text>'; return; }
    const lo = Math.min(...ms), hi = Math.max(...ms), idx = S.frames.map((f, i) => [i, f.metric]).filter(q => q[1] != null), X = i => 40 + i / (S.frames.length - 1) * 700, Y = v => 76 - (v - lo) / ((hi - lo) || 1) * 56;
    let s = `<text x="12" y="14" class="tk">${esc(A.metric)}</text><path d="${idx.map(([i, v], k) => (k ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('')}" fill="none" stroke="#2F6FE0" stroke-width="2"/>`; const c = S.frames[S.i]; if (c.metric != null) s += `<circle cx="${X(S.i)}" cy="${Y(c.metric)}" r="5.5" fill="#ffd166" stroke="#000"/><text x="${Math.min(700, X(S.i) + 8)}" y="${Y(c.metric) - 8}" class="tk">${stuF(c.metric)}</text>`; spark.innerHTML = s;
  }
  function drawStatic() { drawText(); drawFlow(); drawSpark(); }
  let raf = 0, lastLine = -1, lastI = -1;
  function loop(now) {
    if (!root.isConnected) { cancelAnimationFrame(raf); return; }
    const dt = Math.min(.05, (now - (S.last || now)) / 1000); S.last = now;
    if (S.playing) { if (S.prog < 1) S.prog = Math.min(1, S.prog + dt * S.speed / 1.1); else { S.hold += dt * S.speed; if (S.hold > .9) { if (S.i < S.frames.length - 1) goto(S.i + 1, true); else { S.playing = false; playBtn.textContent = '▶ Play'; } } } }
    else if (S.prog < 1) S.prog = Math.min(1, S.prog + dt * S.speed / 1.1);
    if (S.i !== lastI) { drawStatic(); lastI = S.i; }
    const dot = flowSvg.querySelector('#afdot'), ei = S._flowEdge; if (dot) { if (ei >= 0 && S.prog < 1) { const p = flowSvg.querySelector('#afe' + ei), L = p.getTotalLength(), q = p.getPointAtLength(L * S.prog); dot.innerHTML = `<circle cx="${q.x}" cy="${q.y}" r="6" fill="#fff" stroke="#ffd166" stroke-width="3"/>`; } else dot.innerHTML = ''; }
    p3.set(sceneItems(now / 1000), [0, 0, 0], 1.75); p3.draw(1); raf = requestAnimationFrame(loop);
  }
  const left = h('div', { class: 'stack' }, h('div', { class: 'card pad stack' }, bar, scrub, holo, optBox), noteEl), right = h('div', { class: 'stack' }, h('div', { class: 'card pad stack' }, h('b', {}, 'The code (the running line is lit)'), codeEl), h('div', { class: 'card pad stack' }, h('b', {}, 'Variables now'), varsEl));
  root.append(...(o.embedded ? [] : [h('div', { class: 'page-h' }, h('div', {}, h('a', { href: '#/explore', class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← All concepts'), h('h1', {}, A.title), h('p', { class: 'muted lead' }, A.blurb + ' Drag to rotate, wheel to zoom; press Play or step through it.')))]), h('div', { class: 'algo-grid' }, left, right),
    h('div', { class: 'card pad stack' }, h('b', {}, 'The workflow (the active box lights up; the white dot is the data moving to the next step)'), flowSvg, spark));
  rebuild(); raf = requestAnimationFrame(loop);
  root._destroy = () => { cancelAnimationFrame(raf); p3.destroy(); }; if (!o.embedded) App.dis.push(() => root._destroy());
  return root;
}
DSQ.viz.algo = (c, a) => { const v = algoView(a.id || 'kmeans', { embedded: true }); c.stage.append(v); c.onDestroy(() => v._destroy()); };
DSQ.viz.inside = (c, a) => { const f = { llm: insideLLMView, brain: brainView, skins: skinsView }[a.id || 'llm'] || (typeof MORE_VIEWS !== 'undefined' && MORE_VIEWS[a.id]), v = f({ embedded: true }); c.stage.append(v); c.onDestroy(() => v._destroy()); };
