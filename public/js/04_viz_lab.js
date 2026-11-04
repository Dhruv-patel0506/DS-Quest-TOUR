'use strict';
/* =====================================================================
   Data Lab: an interactive plane + box.
   - drag points in 2-D (x-y) and the dataset changes in real time (table + CSV)
   - lift to 3-D: a hidden third feature separates what overlapped in 2-D; click a point, move it in x, y AND z
   - an algorithm (k-means, regression, PCA, k-NN) reacts live; draw vectors; ask questions about the chart
   - "Use in Python" saves the edited data as data/lab.csv so your code can load exactly what you drew
   ===================================================================== */
DSQ.extraFiles = DSQ.extraFiles || {};
DSQ.viz.dataLab = (c, a) => {
  let ds = a.data || 'overlap', view = a.view || '2d', algo = a.algo || 'kmeans', K = a.k || 2, tool = 'move', sel = -1, vecs = [], pts = [], seed = 3, zf = view === '3d' ? 1 : 0, cancel = null, log = [], lastM = null;
  const W = 640, H = 440, R = 4.5, PAD = { l: 46, r: 16, t: 14, b: 36 }, stage = c.stage, wrap = h('div', { class: 'stagewrap' }), p3 = Plot3D(wrap, { w: 640, h: 440, az: .8, el: .5 }), host = h('div', { style: { width: '100%' } }), ro = h('div', { class: 'readout', hidden: true });
  let showGrid = true, lastO = null, hov = null; wrap.append(host, ro); stage.append(wrap); c.onDestroy(() => { p3.destroy(); cancel && cancel(); });
  const mean2 = v => v.reduce((s, x) => s + x, 0) / (v.length || 1);

  function gen() {
    const r = RNG(seed * 11 + 5); pts = []; sel = -1; vecs = []; log = []; lastM = null;
    const add = (x, y, z, cl) => pts.push({ x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), c: cl });
    if (ds === 'blobs') [[-2.2, -1.5, 0], [2.4, 1.8, 0], [-.5, 2.8, 0]].forEach((ce, k) => range(20).forEach(() => add(ce[0] + r.norm(0, .6), ce[1] + r.norm(0, .6), r.norm(0, .4), k)));
    else if (ds === 'overlap') range(44).forEach((i) => add(r.norm(0, .9), r.norm(0, .9), (i % 2 ? 2.4 : -2.4) + r.norm(0, .45), i % 2));
    else if (ds === 'line') range(36).forEach(() => { const x = r() * 6 - 3; add(x, .8 * x + .5 + r.norm(0, .55), .5 * x + r.norm(0, .5), 0); });
    else range(48).forEach((i) => { const t = r() * 6.28, rad = i % 3 ? 2.6 + r.norm(0, .2) : r() * .9; add(rad * Math.cos(t), rad * Math.sin(t), r.norm(0, .3) + (i % 3 ? 0 : 1.8), i % 3 ? 1 : 0); });
    if (algo === 'knn') pts.push({ x: .6, y: .4, z: 0, c: -1, q: true });
  }
  const dims = () => (view === '3d' ? 3 : 2), pv = p => (dims() === 3 ? [p.x, p.y, p.z] : [p.x, p.y]), d2 = (p, q) => p.reduce((s, v, i) => s + (v - q[i]) ** 2, 0);

  /* ---------- algorithms (real implementations) ---------- */
  function runAlgo() {
    const P = pts.filter(p => !p.q).map(pv), n = P.length, o = { n }; if (n < 3) return o;
    if (algo === 'kmeans') {
      const k = Math.min(K, n); let C = [P[0]]; while (C.length < k) { let best = null, bd = -1; P.forEach(p => { const d = Math.min(...C.map(q => d2(p, q))); if (d > bd) { bd = d; best = p; } }); C.push(best); }
      C = C.map(q => [...q]); let lab = [], it = 0;
      for (; it < 40; it++) { lab = P.map(p => { let b = 0, bd = 1e9; C.forEach((q, j) => { const d = d2(p, q); if (d < bd) { bd = d; b = j; } }); return b; }); const nc = C.map((q, j) => { const m = P.filter((_, i) => lab[i] === j); return m.length ? q.map((_, t) => mean2(m.map(p => p[t]))) : q; }); const mv = sum(nc.map((q, j) => Math.sqrt(d2(q, C[j])))); C = nc; if (mv < 1e-6) break; }
      const truth = pts.filter(p => !p.q).map(p => p.c); let hit = 0; for (let j = 0; j < k; j++) { const cnt = {}; truth.forEach((t, i) => { if (lab[i] === j) cnt[t] = (cnt[t] || 0) + 1; }); hit += Math.max(0, ...Object.values(cnt)); }
      Object.assign(o, { lab, C, it: it + 1, inertia: sum(P.map((p, i) => d2(p, C[lab[i]]))), purity: hit / n, sizes: C.map((_, j) => lab.filter(l => l === j).length) });
    } else if (algo === 'regression') {
      { const mx = mean2(P.map(p => p[0])), my = mean2(P.map(p => p[1])), sxx = sum(P.map(p => (p[0] - mx) ** 2)) || 1e-9, m = sum(P.map(p => (p[0] - mx) * (p[1] - my))) / sxx, b = my - m * mx, ss = sum(P.map(p => (p[1] - my) ** 2)) || 1e-9; Object.assign(o, { m, b, r2: 1 - sum(P.map(p => (p[1] - (m * p[0] + b)) ** 2)) / ss }); }
      if (dims() === 3) { const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], rh = [0, 0, 0]; P.forEach(p => { const f = [p[0], p[1], 1]; for (let i = 0; i < 3; i++) { rh[i] += f[i] * p[2]; for (let j = 0; j < 3; j++) A[i][j] += f[i] * f[j]; } }); const w = solveLin(A, rh), mz = mean2(P.map(p => p[2])), ss = sum(P.map(p => (p[2] - mz) ** 2)) || 1e-9; Object.assign(o, { w, r2xy: o.r2, r2: 1 - sum(P.map(p => (p[2] - (w[0] * p[0] + w[1] * p[1] + w[2])) ** 2)) / ss }); }
    } else if (algo === 'pca') {
      const d = dims(), mu = [...Array(d).keys()].map(t => mean2(P.map(p => p[t]))), Z = P.map(p => p.map((v, t) => v - mu[t])), C = [...Array(d).keys()].map(i => [...Array(d).keys()].map(j => sum(Z.map(z => z[i] * z[j])) / (n - 1)));
      if (d === 2) { const t = .5 * Math.atan2(2 * C[0][1], C[0][0] - C[1][1]), v1 = [Math.cos(t), Math.sin(t)], l1 = C[0][0] * v1[0] ** 2 + 2 * C[0][1] * v1[0] * v1[1] + C[1][1] * v1[1] ** 2, l2 = C[0][0] + C[1][1] - l1; Object.assign(o, { mu, vecs: [v1, [-v1[1], v1[0]]], vals: [l1, l2] }); }
      else { const E = jacobi3(C); Object.assign(o, { mu, vecs: E.vecs, vals: E.vals }); }
    } else if (algo === 'knn') {
      const q = pts.find(p => p.q); if (q) { const qq = pv(q), others = pts.filter(p => !p.q).map(p => ({ p, d: d2(pv(p), qq) })).sort((u, w) => u.d - w.d).slice(0, K); const votes = {}; others.forEach(x => { votes[x.p.c] = (votes[x.p.c] || 0) + 1; }); const win = Object.keys(votes).sort((u, w) => votes[w] - votes[u])[0]; Object.assign(o, { near: others.map(x => x.p), votes, win }); }
    }
    return o;
  }

  function metric() {
    const o = runAlgo(); if (algo === 'kmeans' && o.C) return { txt: `inertia ${o.inertia.toFixed(1)}, agreement ${(o.purity * 100).toFixed(0)}%` };
    if (algo === 'regression') return o.w && dims() === 3 ? { txt: `plane R2 ${o.r2.toFixed(2)}` } : o.m != null ? { txt: `slope ${o.m.toFixed(2)}, R2 ${o.r2.toFixed(2)}` } : null;
    if (algo === 'pca' && o.vals) return { txt: `PC1 keeps ${(o.vals[0] / sum(o.vals) * 100).toFixed(0)}%` };
    if (algo === 'knn' && o.near) return { txt: `predicted class ${o.win}` }; return null;
  }
  function commit(msg) { const m = metric(); if (m) { log.push(msg + ': ' + (lastM ? lastM.txt + '  ->  ' : '') + m.txt); if (log.length > 40) log.shift(); lastM = m; } draw(); }
  /* ---------- drawing ---------- */
  const IW = W - PAD.l - PAD.r, IH = H - PAD.t - PAD.b, X = x => PAD.l + (x + R) / (2 * R) * IW, Y = y => H - PAD.b - (y + R) / (2 * R) * IH, wx = px => (px - PAD.l) / IW * 2 * R - R, wy = py => (H - PAD.b - py) / IH * 2 * R - R;
  const colFor = (p, i, o) => (p.q ? '#111' : algo === 'kmeans' && o.lab ? cssColor(o.lab[pts.filter(z => !z.q).indexOf(p)]) : algo === 'knn' ? cssColor(p.c) : '#2F6FE0');
  function draw() {
    const o = lastO = runAlgo(); p3.cv.hidden = view !== '3d'; host.hidden = view === '3d'; p3.grid = showGrid; ro.hidden = true;
    if (view === '2d') draw2(o); else draw3(o);
    table(); explain(o);
  }
  function draw2(o) {
    const fr = DSQ.frame2(W, H, PAD, [-R, R], [-R, R], { grid: showGrid, xl: 'x', yl: 'y' });
    let s = svgOpen(W, H, 'style="touch-action:none;cursor:crosshair;max-height:460px"') + `<defs><clipPath id="dlc"><rect x="${PAD.l}" y="${PAD.t}" width="${IW}" height="${IH}"/></clipPath></defs>` + fr.svg + '<g clip-path="url(#dlc)">';
    if (algo === 'regression' && o.m != null) s += pts.map(p => `<line x1="${X(p.x)}" x2="${X(p.x)}" y1="${Y(p.y)}" y2="${Y(o.m * p.x + o.b)}" stroke="var(--bad)" stroke-width=".8" stroke-dasharray="2 2" opacity=".7"/>`).join('') + `<path d="M${X(-R)} ${Y(o.m * -R + o.b)}L${X(R)} ${Y(o.m * R + o.b)}" stroke="var(--c1)" stroke-width="1.5" fill="none"/>`;
    if (algo === 'pca' && o.vecs) o.vecs.forEach((v, i) => { const L = Math.sqrt(o.vals[i]) * 2; s += `<path d="M${X(o.mu[0] - v[0] * L)} ${Y(o.mu[1] - v[1] * L)}L${X(o.mu[0] + v[0] * L)} ${Y(o.mu[1] + v[1] * L)}" stroke="${['#C8323C', '#1E8E5A'][i]}" stroke-width="1.5"/>`; });
    if (algo === 'knn' && o.near) { const q = pts.find(p => p.q); o.near.forEach(p => { s += `<line x1="${X(q.x)}" y1="${Y(q.y)}" x2="${X(p.x)}" y2="${Y(p.y)}" stroke="var(--fg)" stroke-width=".8" stroke-dasharray="3 3"/>`; }); }
    s += pts.map((p, i) => `<circle data-i="${i}" cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.q ? 5.2 : i === sel ? 4.6 : 3.2}" fill="${colFor(p, i, o)}" fill-opacity="${p.q ? 1 : .85}" stroke="${i === sel ? 'var(--fg)' : p.q ? 'var(--surface)' : 'rgba(0,0,0,.45)'}" style="stroke-width:${i === sel ? 1.4 : .7}px;cursor:grab"/>`).join('');
    if (algo === 'kmeans' && o.C) s += o.C.map((q, j) => `<path d="M${X(q[0]) - 7} ${Y(q[1])}h14M${X(q[0])} ${Y(q[1]) - 7}v14" stroke="${cssColor(j)}" stroke-width="1.6"/><circle cx="${X(q[0])}" cy="${Y(q[1])}" r="7.5" fill="none" stroke="var(--fg)" style="stroke-width:.9px"/>`).join('');
    s += vecs.map(v => `<line x1="${X(v[0])}" y1="${Y(v[1])}" x2="${X(v[2])}" y2="${Y(v[3])}" stroke="#7A4FD0" stroke-width="1.6" marker-end="url(#vh)"/>`).join('') + '</g>';
    if (algo === 'regression' && o.m != null) s += `<text x="${PAD.l + 8}" y="${PAD.t + 16}" class="m" style="font:600 12px var(--f-mono);fill:var(--c1)">y = ${o.m.toFixed(2)}x ${o.b < 0 ? '-' : '+'} ${Math.abs(o.b).toFixed(2)}    R\u00b2 = ${o.r2.toFixed(2)}</text>`;
    s += `<line id="xhx" class="xh" y1="${PAD.t}" y2="${H - PAD.b}" stroke="var(--fg)" stroke-width=".6" stroke-dasharray="3 3" opacity="0" /><line id="xhy" class="xh" x1="${PAD.l}" x2="${W - PAD.r}" stroke="var(--fg)" stroke-width=".6" stroke-dasharray="3 3" opacity="0"/><defs><marker id="vh" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7z" fill="#7A4FD0"/></marker></defs></svg>`;
    host.innerHTML = s; wire2();
  }
  let drag = -1, vstart = null;       /* drag state lives outside the svg: the svg is rebuilt on every change */
  const curSvg = () => $('svg', host), locIn = (svg, e) => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  const onWinMove = e => {
    if (drag < 0 && !vstart) return; const svg = curSvg(); if (!svg) return; const [px, py] = locIn(svg, e);
    if (vstart) { const v = vecs[vecs.length - 1]; v[2] = wx(px); v[3] = wy(py); draw(); return; }
    pts[drag].x = +clamp(wx(px), -R, R).toFixed(2); pts[drag].y = +clamp(wy(py), -R, R).toFixed(2); draw();
  };
  const onWinUp = () => { if (drag >= 0) { const d = drag; drag = -1; commit('moved point #' + d); } vstart = null; };
  window.addEventListener('pointermove', onWinMove); window.addEventListener('pointerup', onWinUp); window.addEventListener('pointercancel', onWinUp);
  c.onDestroy(() => { window.removeEventListener('pointermove', onWinMove); window.removeEventListener('pointerup', onWinUp); window.removeEventListener('pointercancel', onWinUp); });
  function wire2() {
    const svg = curSvg(), loc = e => locIn(svg, e); const xhx = $('#xhx', svg), xhy = $('#xhy', svg);
    const showRO = (e, px, py) => {
      const inside = px >= PAD.l && px <= W - PAD.r && py >= PAD.t && py <= H - PAD.b; xhx.setAttribute('opacity', inside ? .6 : 0); xhy.setAttribute('opacity', inside ? .6 : 0);
      if (!inside) { ro.hidden = true; return; }
      xhx.setAttribute('x1', px); xhx.setAttribute('x2', px); xhy.setAttribute('y1', py); xhy.setAttribute('y2', py);
      let near = -1, bd = 9; pts.forEach((p, i) => { const d = Math.hypot(X(p.x) - px, Y(p.y) - py); if (d < bd) { bd = d; near = i; } });
      const r = wrap.getBoundingClientRect(); ro.hidden = false; ro.style.left = Math.min(e.clientX - r.left + 14, r.width - 150) + 'px'; ro.style.top = Math.max(0, e.clientY - r.top - 30) + 'px';
      ro.textContent = near >= 0 ? `row ${near}: x=${pts[near].x.toFixed(2)}  y=${pts[near].y.toFixed(2)}` : `x=${wx(px).toFixed(2)}  y=${wy(py).toFixed(2)}`;
    };
    svg.addEventListener('pointerleave', () => { ro.hidden = true; xhx.setAttribute('opacity', 0); xhy.setAttribute('opacity', 0); });
    svg.addEventListener('pointerdown', e => {
      const [px, py] = loc(e), t = e.target.dataset && e.target.dataset.i;
      if (tool === 'vector') { vstart = [wx(px), wy(py)]; vecs.push([...vstart, ...vstart]); return; }
      if (t != null && t !== '') { if (tool === 'delete') { pts.splice(+t, 1); sel = -1; commit('deleted point #' + t); syncSel(); return; } drag = +t; sel = drag; syncSel(); draw(); return; }
      if (tool === 'add') { pts.push({ x: +clamp(wx(px), -R, R).toFixed(2), y: +clamp(wy(py), -R, R).toFixed(2), z: 0, c: pts.length ? pts[pts.length - 1].c : 0 }); commit('added a point'); }
    });
    svg.addEventListener('pointermove', e => { if (drag < 0 && !vstart) { const [px, py] = loc(e); showRO(e, px, py); } });
  }
  const wire2last = () => { };
  function draw3(o) {
    const items = [], f = zf;
    pts.forEach((p, i) => items.push({ t: 'pt', p: [p.x, p.y, p.z * f], r: i === sel ? 8 : p.q ? 8 : 5, color: colFor(p, i, o), ring: i === sel ? '#000' : p.q ? '#fff' : null }));
    if (sel >= 0 && pts[sel]) { const p = pts[sel]; items.push({ t: 'line', a: [p.x, p.y, -R], b: [p.x, p.y, p.z * f], color: '#C8323C', w: 1.2, dash: [3, 3] }); items.push({ t: 'pt', p: [p.x, p.y, -R], r: 3, color: '#C8323C' }); }
    if (algo === 'kmeans' && o.C) o.C.forEach((q, j) => items.push({ t: 'pt', p: [q[0], q[1], (q[2] || 0) * f], r: 11, color: cssColor(j), ring: '#000' }));
    if (algo === 'regression' && o.w) {
      const G = 8, Rr = R * .9, fz = (x, y) => o.w[0] * x + o.w[1] * y + o.w[2]; for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const x0 = -Rr + 2 * Rr * i / G, x1 = -Rr + 2 * Rr * (i + 1) / G, y0 = -Rr + 2 * Rr * j / G, y1 = -Rr + 2 * Rr * (j + 1) / G, q = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(t => [t[0], t[1], clamp(fz(t[0], t[1]), -R, R)]); items.push({ t: 'poly', pts: q, fill: 'rgba(210,96,15,.09)', stroke: 'rgba(210,96,15,.35)', sw: .5 }); }
      if (o.m != null) { const y0 = clamp(o.m * -R + o.b, -R, R), y1 = clamp(o.m * R + o.b, -R, R); items.push({ t: 'line', a: [-R, o.m * -R + o.b, 0], b: [R, o.m * R + o.b, 0], color: '#D2600F', w: 1.6 }); items.push({ t: 'txt', p: [R * .55, clamp(o.m * R * .55 + o.b, -R, R), 0.35], s: `y = ${o.m.toFixed(2)}x ${o.b < 0 ? '-' : '+'} ${Math.abs(o.b).toFixed(2)} (the 2-D line)`, color: '#D2600F', size: 10, mono: true, bg: true }); }
    } else if (algo === 'regression' && o.m != null) items.push({ t: 'line', a: [-R, o.m * -R + o.b, 0], b: [R, o.m * R + o.b, 0], color: '#D2600F', w: 1.6 });
    if (algo === 'pca' && o.vecs) o.vecs.forEach((v, i) => { const L = Math.sqrt(o.vals[i]) * 2; items.push({ t: 'line', a: o.mu.map((m, t) => m - v[t] * L), b: o.mu.map((m, t) => m + v[t] * L), color: ['#C8323C', '#1E8E5A', '#7A4FD0'][i], w: 1.8 }); });
    if (algo === 'knn' && o.near) { const q = pts.find(p => p.q); o.near.forEach(p => items.push({ t: 'line', a: [q.x, q.y, q.z * f], b: [p.x, p.y, p.z * f], color: '#555', dash: [3, 3], w: 1 })); }
    if (hov) { items.push({ t: 'line', a: [hov.x, -R, -R], b: [hov.x, R, -R], color: '#555', w: 1, dash: [2, 3] }); items.push({ t: 'line', a: [-R, hov.y, -R], b: [R, hov.y, -R], color: '#555', w: 1, dash: [2, 3] }); items.push({ t: 'pt', p: [hov.x, hov.y, -R], r: 4, color: '#111' }); }
    DSQ.axes3(R, ['x', 'y', 'z']).forEach(it => items.push(it)); p3.set(items, [0, 0, 0], R * 1.45); p3.draw(1);
  }
  p3.onHover = (cx, cy) => {
    if (view !== '3d' || cx == null) { if (hov) { hov = null; if (view === '3d') draw3(lastO); } ro.hidden = true; return; }
    let best = -1, bd = 12; pts.forEach((p, i) => { const q = p3.proj([p.x, p.y, p.z * zf]); const d = Math.hypot(q[0] - cx, q[1] - cy); if (d < bd) { bd = d; best = i; } });
    const u = p3.unproject(cx, cy, -R); hov = u && Math.abs(u[0]) <= R && Math.abs(u[1]) <= R ? { x: u[0], y: u[1] } : null;
    const r = wrap.getBoundingClientRect(), cr = p3.cv.getBoundingClientRect(); ro.hidden = !(best >= 0 || hov); ro.style.left = Math.min((cx * cr.width / W) + 14, r.width - 190) + 'px'; ro.style.top = Math.max(0, (cy * cr.height / H) - 30) + 'px';
    ro.textContent = best >= 0 ? `row ${best}: x=${pts[best].x.toFixed(2)} y=${pts[best].y.toFixed(2)} z=${pts[best].z.toFixed(2)}` : hov ? `floor grid: x=${hov.x.toFixed(2)}  y=${hov.y.toFixed(2)}` : '';
    draw3(lastO);
  };
  p3.onClick = (cx, cy) => { let best = -1, bd = 18; pts.forEach((p, i) => { const q = p3.proj([p.x, p.y, p.z * zf]); const d = Math.hypot(q[0] - cx, q[1] - cy); if (d < bd) { bd = d; best = i; } }); sel = best; draw(); syncSel(); };

  /* ---------- table, CSV, explanation ---------- */
  const tbl = h('div', { style: { padding: '8px 14px', overflow: 'auto', maxHeight: '190px' } }); c.box.insertBefore(tbl, c.out);
  const csvOf = () => 'x,y,z,label\n' + pts.filter(p => !p.q).map(p => [p.x, p.y, p.z, p.c].join(',')).join('\n');
  function table() {
    DSQ.extraFiles['data/lab.csv'] = csvOf();
    tbl.innerHTML = `<div class="muted mono" style="font-size:11px;font-weight:700;margin-bottom:4px">YOUR DATASET (live copy, ${pts.filter(p => !p.q).length} rows) - changes as you drag</div>` + dfHTML(['x', 'y', 'z', 'label'], pts.filter(p => !p.q).slice(0, 7).map(p => [p.x, p.y, p.z, p.c]), { cls: (i, j) => (pts.filter(p => !p.q).indexOf(pts[sel]) === i ? 'hl' : '') });
  }
  function explain(o) {
    const d = dims(), n = o.n || 0; let t = '';
    if (algo === 'kmeans') t = o.C ? `km = KMeans(n_clusters=${Math.min(K, n)}).fit(X)    <span class="g"># X has ${d} columns: ${d === 3 ? 'x, y, z' : 'x, y'}</span>\n<span class="y">iterations</span> ${o.it}   <span class="y">inertia_</span> ${o.inertia.toFixed(1)}   <span class="y">cluster sizes</span> ${JSON.stringify(o.sizes)}\n<span class="y">agreement with the true groups</span>: ${(o.purity * 100).toFixed(0)}%   ` + (ds === 'overlap' ? (view === '2d' ? '<span class="r"># in 2-D the two groups sit on top of each other, so k-means cannot separate them - press "Lift to 3-D"</span>' : '<span class="g"># with the third feature the groups are far apart: the algorithm succeeds. More features can make a problem easier.</span>') : '') : 'add more points';
    else if (algo === 'regression') t = view === '2d' ? (o.m != null ? `LinearRegression().fit(x, y)\n<span class="y">y = ${o.m.toFixed(2)}x + ${o.b.toFixed(2)}</span>   <span class="y">R2</span> = ${o.r2.toFixed(3)}   <span class="g"># drag a point far away: the line is pulled toward it (least squares hates big gaps)</span>` : '') : (o.w ? `LinearRegression().fit(X[["x","y"]], z)\n<span class="y">z = ${o.w[0].toFixed(2)}x + ${o.w[1].toFixed(2)}y + ${o.w[2].toFixed(2)}</span>   <span class="y">R2</span> = ${o.r2.toFixed(3)}   <span class="g"># the orange plane. The orange line on the floor of the box is the SAME 2-D fit y = ${o.m.toFixed(2)}x + ${o.b.toFixed(2)} you saw flat: switch back and it is still there.</span>` : '');
    else if (algo === 'pca') t = o.vals ? `pca = PCA(n_components=${d}).fit(X)\n<span class="y">variance per component</span> = [${o.vals.map(v => v.toFixed(2)).join(', ')}]  <span class="y">PC1 keeps</span> ${(o.vals[0] / sum(o.vals) * 100).toFixed(0)}%   <span class="g"># red = longest direction of the cloud</span>` : '';
    else if (algo === 'knn') t = o.near ? `knn = KNeighborsClassifier(n_neighbors=${K}).fit(X, y)\n<span class="y">votes</span> ${JSON.stringify(o.votes)} -> predicted class <span class="y">${o.win}</span>   <span class="g"># drag the black query point across the plane and watch the vote flip near the boundary</span>` : '';
    if (vecs.length) { const v = vecs.map(q => [q[2] - q[0], q[3] - q[1]]), L = v[v.length - 1], len = Math.hypot(...L); t += `\n<span class="y">vector</span> ${vecs.length}: (${L[0].toFixed(2)}, ${L[1].toFixed(2)})  length ${len.toFixed(2)}  angle ${(Math.atan2(L[1], L[0]) * 180 / Math.PI).toFixed(0)} deg` + (v.length > 1 ? `   <span class="y">dot product with the previous</span> = ${(v[v.length - 2][0] * L[0] + v[v.length - 2][1] * L[1]).toFixed(2)}` : ''); }
    if (log.length) t += '\n<span class="y">what your recent edits did to the answer:</span>\n' + log.slice(-5).map(l => esc(l)).join('\n');
    c.say(t);
  }

  /* ---------- ask a question about the chart ---------- */
  const askIn = h('input', { type: 'text', class: 'ask', placeholder: 'Ask: how many points? is x related to y? which point is the outlier? why did k-means do that?' });
  function localAnswer(q) {
    q = q.toLowerCase(); const P = pts.filter(p => !p.q), n = P.length, g = k => P.map(p => p[k]), ax = (q.match(/\b([xyz])\b/) || [])[1], o = runAlgo();
    const pear = (u, v) => { const mu = mean2(u), mv = mean2(v), s = sum(u.map((x, i) => (x - mu) * (v[i] - mv))), d = Math.sqrt(sum(u.map(x => (x - mu) ** 2)) * sum(v.map(y => (y - mv) ** 2))) || 1; return s / d; };
    if (/how many|count|number of (points|rows)/.test(q)) return `There are ${n} points (rows) in the dataset.`;
    if (/mean|average/.test(q)) { const k = ax || 'x'; return `The mean of ${k} is ${mean2(g(k)).toFixed(2)} (np.mean(df["${k}"])).`; }
    if (/max|highest|largest|biggest|top/.test(q)) { const k = ax || 'y', v = Math.max(...g(k)); return `The largest ${k} is ${v.toFixed(2)}, point #${g(k).indexOf(v)}.`; }
    if (/min|lowest|smallest/.test(q)) { const k = ax || 'y', v = Math.min(...g(k)); return `The smallest ${k} is ${v.toFixed(2)}, point #${g(k).indexOf(v)}.`; }
    if (/correl|related|relationship|depend/.test(q)) { const r = pear(g('x'), g('y')), rz = pear(g('x'), g('z')); return `Correlation of x and y is r = ${r.toFixed(2)} (${Math.abs(r) > .7 ? 'strong' : Math.abs(r) > .35 ? 'moderate' : 'weak'} ${r > 0 ? 'positive' : 'negative'}); of x and z is ${rz.toFixed(2)}. Correlation is the cosine of the angle between the centred columns.`; }
    if (/outlier|unusual|odd|far|anomal/.test(q)) { const mx = mean2(g('x')), my = mean2(g('y')), sd = Math.sqrt(mean2(P.map(p => (p.x - mx) ** 2 + (p.y - my) ** 2))) || 1, d = P.map(p => Math.hypot(p.x - mx, p.y - my) / sd), i = d.indexOf(Math.max(...d)); return `Point #${i} (x=${P[i].x}, y=${P[i].y}) is the most unusual: ${d[i].toFixed(1)} standard distances from the centre. Drag it back and watch the algorithm settle.`; }
    if (/why|how does|explain|work/.test(q) && /this|algorithm|k-?means|cluster|regress|pca|knn|k-nn|neighbo|my (data|points)|\bdid\b/.test(q)) return { kmeans: 'k-means starts with k centres, assigns every point to its nearest centre, moves each centre to the average of its points and repeats until nothing moves. It only sees the columns you give it: with x, y only, groups that overlap in the plane stay mixed - add the z column and they separate.', regression: 'Least squares chooses the line (or plane) that makes the sum of squared vertical gaps as small as possible. A single far-away point has a huge squared gap, so it pulls the line toward itself.', pca: 'PCA rotates the axes to the directions where the cloud is widest. The first axis (red) keeps the most variance; dropping the last axes compresses the data with little loss.', knn: 'k-NN gives the query the majority class of its k closest points. Small k follows noise; large k smooths the boundary.' }[algo];
    if (/slope|line|trend|regress|fit/.test(q) && o.m != null) return `The best-fit line is y = ${o.m.toFixed(2)}x + ${o.b.toFixed(2)} with R2 = ${o.r2.toFixed(2)}.`;
    if (/cluster|group|segment/.test(q) && o.sizes) return `k-means found ${o.sizes.length} clusters with sizes ${JSON.stringify(o.sizes)} after ${o.it} iterations (inertia ${o.inertia.toFixed(1)}).`;
    if (/3d|third|dimension|z\b/.test(q)) return `The z column is a third feature. A box (3-D) gives points room to separate that overlapped on the flat plane (2-D): that is exactly why extra features can help an algorithm - and why too many can hurt (the "curse of dimensionality").`;
    return null;
  }
  const GLOSS = {
    'true positive': 'True positive (TP): the model said YES and the truth was YES (a spam mail caught as spam).', 'true negative': 'True negative (TN): the model said NO and the truth was NO (a normal mail left alone).', 'false positive': 'False positive (FP, "type I error"): the model said YES but the truth was NO (a normal mail sent to spam). Moving the decision threshold down creates more of these.', 'false negative': 'False negative (FN, "type II error"): the model said NO but the truth was YES (a spam mail reaches the inbox). Moving the threshold up creates more of these.',
    'confusion': 'A confusion matrix is a 2x2 count table: rows = truth, columns = prediction. Diagonal = correct (TP, TN); off-diagonal = mistakes (FP, FN). Accuracy = (TP+TN)/all; precision = TP/(TP+FP); recall = TP/(TP+FN).',
    'precision': 'Precision = TP / (TP + FP): of everything the model flagged YES, how much really was YES.', 'recall': 'Recall = TP / (TP + FN): of everything that really was YES, how much the model caught.', 'f1': 'F1 = 2 x precision x recall / (precision + recall): one number that is low if either precision or recall is low.',
    'determinant': 'The determinant of a matrix is the factor by which it scales area (2-D) or volume (3-D). Zero means the columns are dependent (squashed flat) - the matrix has no inverse.', 'matrix': 'A matrix is a rectangle of numbers; a dataset is one (rows = records, columns = features). Multiplying by a matrix transforms every point - rotate, stretch, project.', 'derivative': 'The derivative is the slope of a curve at one point: how fast y changes when x changes a tiny bit. Gradient descent follows it downhill to minimise error.', 'gradient': 'The gradient is the vector of slopes in every direction. It points uphill; learning steps go the opposite way.', 'integral': 'An integral adds up infinitely many tiny pieces: the area under a curve. For a probability density the total area is 1.',
    'overfit': 'Overfitting: the model memorises noise in the training data, so it scores well there and badly on new data. Fix with more data, simpler models, regularisation, and a held-out test set.', 'p-value': 'A p-value is how surprising your data would be if there were really no effect. Small (e.g. below 0.05) means "unlikely by chance" - it is not the probability that you are right.', 'probability': 'Probability is a number from 0 to 1 for how likely an event is. Independent events multiply; mutually exclusive events add; Bayes\' rule updates a belief with new evidence.',
  };
  const gloss = q => { const k = Object.keys(GLOSS).filter(t => q.toLowerCase().includes(t)); return k.length ? k.map(t => GLOSS[t]).join(' | ') : null; };
  const summary = () => `Data Lab. ${pts.filter(p => !p.q).length} points, view ${view}, algorithm ${algo}, k ${K}. Result: ${(metric() || { txt: 'n/a' }).txt}. First rows (x,y,z,label): ${JSON.stringify(pts.filter(p => !p.q).slice(0, 8).map(p => [p.x, p.y, p.z, p.c]))}`;
  async function ask() {
    const q = askIn.value.trim(); if (!q) return; let ans = localAnswer(q), src = 'computed from your data';
    if (!ans) {
      c.say(`<span class="y">Q:</span> ${esc(q)}\n<span class="g">thinking... (asking the tutor model)</span>`);
      try {
        const r = await API.post('/api/llm/ask', { question: q, context: { page: 'Data Lab', vizOut: summary() } });
        if (r.available) { ans = r.answer; src = 'AI tutor (' + (r.provider || 'model') + ')'; }
        else { ans = gloss(q); src = 'built-in glossary'; if (!ans) ans = 'The tutor model could not be reached right now (' + (r.hint || 'no provider answered') + (r.trail ? ' - tried: ' + JSON.stringify(r.trail).slice(0, 200) : '') + '). I can still answer from your data: counts, means, max/min, correlation, outliers, clusters, the fitted line; and I know the terms TP/TN/FP/FN, precision, recall, determinant, gradient, overfitting. Check the AI chip in the Ask panel to see which providers are ready.'; }
      } catch (e) { ans = gloss(q) || 'Could not reach the server (' + (e && e.message ? e.message : e) + '). Is the Dhruv Patel Academy server still running? Questions about your data (counts, means, outliers, line, clusters) still work offline.'; src = 'offline'; }
    }
    c.say(`<span class="y">Q:</span> ${esc(q)}\n<span class="g">A (${esc(src)}):</span> ${esc(ans)}`);
  }
  askIn.addEventListener('keydown', e => { if (e.key === 'Enter') ask(); });
  c.ctl.append(h('label', { style: { flex: '1 1 100%' } }, 'Ask', askIn, h('button', { class: 'btn sm', type: 'button', onclick: ask }, 'Answer')));

  /* ---------- controls ---------- */
  const selBox = h('span', { class: 'row', hidden: true }); const ss = ['x', 'y', 'z'].map(k => { const i = h('input', { type: 'range', min: -R, max: R, step: .05, value: 0 }); i.addEventListener('input', () => { if (pts[sel]) { pts[sel][k] = +(+i.value).toFixed(2); draw(); } }); i.addEventListener('change', () => { if (pts[sel]) commit('set point #' + sel + ' ' + k + ' = ' + pts[sel][k]); }); selBox.append(h('label', {}, k, i)); return i; });
  function syncSel() { selBox.hidden = sel < 0; if (sel >= 0 && pts[sel]) ['x', 'y', 'z'].forEach((k, i) => { ss[i].value = pts[sel][k]; }); }
  function lift(to) { cancel && cancel(); const from = zf; view = to; cancel = anim(1100, t => { zf = lerp(from, to === '3d' ? 1 : 0, t); if (to === '3d') p3.set3d(.8, lerp(.1, .5, t)); draw(); }, () => { syncSel(); }); viewSel.value = to; }
  c.select('dataset', [['overlap', 'two groups hidden in depth'], ['blobs', 'three blobs'], ['line', 'noisy line'], ['ring', 'ring + core']], ds, v => { ds = v; gen(); draw(); syncSel(); });
  const viewSel = c.select('view', [['2d', '2-D plane (x, y)'], ['3d', '3-D box (x, y, z)']], view, v => lift(v));
  c.select('algorithm', [['kmeans', 'k-means'], ['regression', 'regression'], ['pca', 'PCA'], ['knn', 'k-NN']], algo, v => { algo = v; if (v === 'knn' && !pts.some(p => p.q)) pts.push({ x: .6, y: .4, z: 0, c: -1, q: true }); if (v !== 'knn') pts = pts.filter(p => !p.q); sel = -1; draw(); syncSel(); });
  c.slider('k', 1, 6, 1, K, v => { K = v; draw(); });
  c.select('tool (2-D)', [['move', 'move points'], ['add', 'add point'], ['delete', 'delete point'], ['vector', 'draw vector']], tool, v => { tool = v; });
  c.button('Lift to 3-D', () => lift(view === '2d' ? '3d' : '2d')); c.button('Add point', () => { pts.push({ x: 0, y: 0, z: 0, c: 0 }); sel = pts.length - 1; commit('added a point at the origin'); syncSel(); });
  c.button('Delete selected', () => { if (sel >= 0) { const d = sel; pts.splice(sel, 1); sel = -1; commit('deleted point #' + d + ' (the CSV row disappears too)'); syncSel(); } }); c.button('Clear vectors', () => { vecs = []; draw(); });
  c.button('Download CSV', () => DSQ.Proj ? DSQ.Proj.download('lab.csv', csvOf()) : 0); c.button('Use in Python', () => { DSQ.extraFiles['data/lab.csv'] = csvOf(); toast('Saved as data/lab.csv - load it with pd.read_csv("data/lab.csv") in any code cell'); });
  const gb = h('button', { class: 'btn sm', type: 'button', onclick: () => { showGrid = !showGrid; gb.textContent = 'Grid: ' + (showGrid ? 'on' : 'off'); draw(); } }, 'Grid: on'); c.ctl.append(gb); c.button('New data', () => { seed++; gen(); draw(); }); c.ctl.append(selBox); c.button('Spin', () => p3.spin(true));
  gen(); draw(); lastM = metric();
};
