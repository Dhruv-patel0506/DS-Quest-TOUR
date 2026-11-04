'use strict';
/* =====================================================================
   3D versions for the pandas and Matplotlib pictures that had only a flat one (see 40_pic3d.js): groupby (rows fly into piles of cubes), join (cards slide
   together on a shared key) and anatomy (a Matplotlib figure as layers you can pull apart). Same (T, X, spec) contract as the other PIC3 scenes;
   the numbers come from PIC.math, the same code the 2D pictures use.
   ===================================================================== */

/* ---------------- groupby: every row of the table flies to the pile of its key; the pile is summed ---------------- */
PIC3.scenes.groupby = (T, X, sp) => {
  const M = PIC.math, ctl = X.ctl, rows = sp.rows, cols = sp.cols, key = sp.key, val = sp.val, n = rows.length, fmt = v => String(Math.round(v * 100) / 100);
  const keys = [...new Set(rows.map(r => r[key]))].sort(), tot = {}; rows.forEach(r => { tot[r[key]] = (tot[r[key]] || 0) + (+r[val] || 0); });
  const vmax = Math.max.apply(null, rows.map(r => +r[val] || 0)) || 1, maxTot = Math.max.apply(null, Object.values(tot)) || 1, sc = Math.min(1.5 / vmax, 5 / maxTot);
  const colour = k => new T.Color(pc3dCol[keys.indexOf(k) % 5]).getHex(), TILE_X = -7, PILE_X = k => -1 + keys.indexOf(k) * 3.2;
  let agg = sp.agg || 'sum', grp, lt = 0, cubes = [], results = [], tiles = [], btns = [];
  const build = skip => {
    if (grp) { X.world.remove(grp); X.dispose(grp); } grp = new T.Group(); X.world.add(grp); lt = skip ? 99 : 0; cubes = []; results = []; tiles = [];
    const maxX = PILE_X(keys[keys.length - 1]) + 1.6, minX = TILE_X - 1.9; grp.position.x = -(minX + maxX) / 2;
    const fl = new T.Mesh(new T.BoxGeometry(maxX - minX + 1.4, .1, 4.6), pc3dMat(T, 0x17294a)); fl.position.set((minX + maxX) / 2, -.06, 0); fl.receiveShadow = true; grp.add(fl);
    const th = X.label('the table', { size: .46, color: '#cfe0ff' }); th.position.set(TILE_X, n * .62 + .55, 0); grp.add(th);
    rows.forEach((r, i) => {
      const y = (n - 1 - i) * .62 + .4, m = new T.Mesh(new T.BoxGeometry(3.3, .5, .5), pc3dMat(T, colour(r[key]), { transparent: true, opacity: .95 })); m.position.set(TILE_X, y, 0); m.castShadow = true; grp.add(m);
      const t = X.label(r[key] + '   ' + fmt(+r[val]), { size: .34, color: '#ffffff', depthTest: false }); t.position.set(TILE_X, y, .5); grp.add(t); tiles.push({ m, t, y });
    });
    keys.forEach(k => {
      const pl = new T.Mesh(new T.BoxGeometry(2.5, .1, 2.5), pc3dMat(T, 0x22365e)); pl.position.set(PILE_X(k), .05, 0); pl.receiveShadow = true; grp.add(pl);
      const t = X.label(cols[key] + ' = ' + k, { size: .42, color: '#cfe0ff' }); t.position.set(PILE_X(k), -.45, 1.9); grp.add(t);
    });
    const acc = {}; rows.forEach((r, i) => {
      const k = r[key], h = Math.max(.28, (+r[val] || 0) * sc), y0 = acc[k] || 0; acc[k] = y0 + h;
      const c = new T.Mesh(new T.BoxGeometry(1, 1, 1), pc3dMat(T, colour(k))); c.castShadow = true; c.visible = false; grp.add(c);
      const lab = X.label(fmt(+r[val]), { size: .34, color: '#ffffff', depthTest: false }); lab.visible = false; grp.add(lab);
      cubes.push({ c, lab, i, k, h, tx: PILE_X(k), ty: y0 + h / 2 + .1, sx: TILE_X + .2, sy: tiles[i].y, t0: .5 + i * .3 });
    });
    keys.forEach(k => {
      const v = M.agg[agg](rows.filter(r => r[key] === k).map(r => +r[val])), t = X.label(agg + ' = ' + fmt(v), { size: .52, color: '#ffe9a0', depthTest: false }); t.position.set(PILE_X(k), (acc[k] || 1) + 1.3, 0); t.visible = false; grp.add(t); results.push(t);
    });
    X.info('<b>df.groupby("' + picEsc(cols[key]) + '")["' + picEsc(cols[val]) + '"].' + agg + '()</b><br><span class="pic3-note">Each row of the table flies to the pile of its ' + picEsc(cols[key]) + '. Each cube is one row, as tall as its ' + picEsc(cols[val]) + '. Then every pile is summarised into one number.</span>');
    X.setCam({ th: .5, ph: 1.12, ty: 2.4 }); X.fit((maxX - minX) / 2 + 1.5, 4.4);
  };
  const paint = () => btns.forEach(b => b.setAttribute('aria-pressed', String(b.textContent === agg)));
  ctl.append(h('div', { class: 'pic3-row' }, ['sum', 'mean', 'count', 'max', 'min'].map(a => { const b = pc3dBtn(a, () => { agg = a; build(true); paint(); }); btns.push(b); return b; }), pc3dBtn('↻ fly again', () => build(false))));
  build(false); paint();
  return { update(dt) {
    lt += dt; let done = true;
    cubes.forEach((q, i) => {
      const p = pjClamp((lt - q.t0) / .8, 0, 1), e = pjEase(p); if (p < 1) done = false; q.c.visible = p > 0; q.lab.visible = p > 0; tiles[q.i].m.material.opacity = p > 0 ? .3 : .95; tiles[q.i].t.visible = p === 0;
      const x = q.sx + (q.tx - q.sx) * e, y = q.sy + (q.ty - q.sy) * e + Math.sin(Math.PI * p) * 3, s = .35 + .65 * e;
      q.c.position.set(x, y, 0); q.c.scale.set(1.7 * s, q.h * s, 1.7 * s); q.lab.position.set(x, y, 1);
    });
    if (done && lt > .5 + n * .3 + .9) results.forEach(t => { t.visible = true; });
  } };
};

/* ---------------- join: two tables of cards; the rows that share a key slide together into the result ---------------- */
PIC3.scenes.join = (T, X, sp) => {
  const M = PIC.math, ctl = X.ctl, L = sp.left, R = sp.right, li = sp.on[0], ri = sp.on[1];
  const keys = [...new Set(L.rows.map(r => r[li]).concat(R.rows.map(r => r[ri])))], colour = k => new T.Color(pc3dCol[keys.indexOf(k) % 5]).getHex();
  const KIND = { both: null, left_only: 0xe0701c, right_only: 0x7a4fd0 }, XL = -8.6, XR = 8.6, XC = 0;
  let how = sp.how || 'inner', grp, lt = 0, flights = [], btns = [];
  const card = (txt, x, y, z, color, w, o) => {
    const m = new T.Mesh(new T.BoxGeometry(w, .72, .2), pc3dMat(T, color, Object.assign({ transparent: true, opacity: .95 }, o || {}))); m.position.set(x, y, z); m.castShadow = true; grp.add(m);
    const t = X.label(txt, { size: .34, color: '#ffffff', depthTest: false }); t.position.set(x, y, z + .2); grp.add(t); return { m, t };
  };
  const width = cells => Math.max(2.8, cells.join('  ').length * .2 + .8);
  const build = () => {
    if (grp) { X.world.remove(grp); X.dispose(grp); } grp = new T.Group(); X.world.add(grp); lt = 0; flights = [];
    const res = M.join(L, R, li, ri, how), cnt = { both: 0, left_only: 0, right_only: 0 }; res.rows.forEach(r => { cnt[r.kind]++; });
    const top = Math.max(L.rows.length, R.rows.length, res.rows.length), Y = i => (top - 1 - i) * 1.05 + .5, matchedL = new Set(), matchedR = new Set();
    res.rows.forEach(r => { if (r.kind === 'both') { matchedL.add(r.l); matchedR.add(r.r); } });
    const fl = new T.Mesh(new T.BoxGeometry(22, .1, 6), pc3dMat(T, 0x17294a)); fl.position.set(0, -.06, 0); fl.receiveShadow = true; grp.add(fl);
    const name = (txt, x) => { const t = X.label(txt, { size: .46, color: '#cfe0ff' }); t.position.set(x, top * 1.05 + .6, 0); grp.add(t); };
    name(L.name, XL); name(R.name, XR); name('result: merge(..., how="' + how + '")', XC);
    const lpos = L.rows.map((r, i) => { const w = width(r), c = card(r.join('  '), XL, Y(i), -1.2, colour(r[li]), w, matchedL.has(r) || how === 'left' || how === 'outer' ? {} : { opacity: .35 }); return { x: XL, y: Y(i), z: -1.2, w }; });
    const rpos = R.rows.map((r, i) => { const w = width(r), c = card(r.join('  '), XR, Y(i), -1.2, colour(r[ri]), w, matchedR.has(r) || how === 'right' || how === 'outer' ? {} : { opacity: .35 }); return { x: XR, y: Y(i), z: -1.2, w }; });
    res.rows.forEach((r, i) => {
      const w = width(r.cells), k = (r.l || r.r)[r.l ? li : ri], c = card(r.cells.join('  '), XC, Y(i), 1.3, KIND[r.kind] || colour(k), w), src = r.l ? lpos[L.rows.indexOf(r.l)] : rpos[R.rows.indexOf(r.r)];
      c.m.visible = c.t.visible = false; flights.push({ c, sx: src.x, sy: src.y, sz: src.z, tx: XC, ty: Y(i), tz: 1.3, t0: .3 + i * .28 });
      if (r.kind === 'both') [[lpos[L.rows.indexOf(r.l)], -1], [rpos[R.rows.indexOf(r.r)], 1]].forEach(([p, d]) => { const a = new T.Vector3(p.x + d * -p.w / 2, p.y, p.z), b = new T.Vector3(XC + d * w / 2, Y(i), 1.3); grp.add(pc3dCyl(T, a, b, .03, new T.MeshBasicMaterial({ color: colour(k), transparent: true, opacity: .55 }))); });
    });
    X.info('<b>' + res.rows.length + ' row' + (res.rows.length === 1 ? '' : 's') + '</b>: ' + cnt.both + ' matched' + (cnt.left_only ? ', ' + cnt.left_only + ' only on the left (orange, NaN on the right)' : '') + (cnt.right_only ? ', ' + cnt.right_only + ' only on the right (purple, NaN on the left)' : '') + '<br><span class="pic3-note">Same colour = same key. Cards that find no partner are faded out of an inner join.</span>');
    X.setCam({ th: .38, ph: 1.1, ty: top * .5 }); X.fit(10.6, top * .5 + 2.2);
  };
  const paint = () => btns.forEach(b => b.setAttribute('aria-pressed', String(b.textContent === how)));
  ctl.append(h('div', { class: 'pic3-row' }, ['inner', 'left', 'right', 'outer'].map(a => { const b = pc3dBtn(a, () => { how = a; build(); paint(); }); btns.push(b); return b; }), pc3dBtn('↻ slide again', () => { build(); })));
  build(); paint();
  return { update(dt) {
    lt += dt;
    flights.forEach(f => { const p = pjClamp((lt - f.t0) / .9, 0, 1), e = pjEase(p), vis = p > 0; f.c.m.visible = f.c.t.visible = vis; const x = f.sx + (f.tx - f.sx) * e, y = f.sy + (f.ty - f.sy) * e + Math.sin(Math.PI * p) * 1.2, z = f.sz + (f.tz - f.sz) * e; f.c.m.position.set(x, y, z); f.c.t.position.set(x, y, z + .2); });
  } };
};

/* ---------------- anatomy: a Matplotlib figure as stacked layers; pull them apart and press a part to light it up ---------------- */
PIC3.scenes.anatomy = (T, X, sp) => {
  const ctl = X.ctl, parts = sp.parts, grp = new T.Group(); X.world.add(grp);
  const P = (px, py) => new T.Vector3((px - 280) / 40, (170 - py) / 40, 0), INK = '#ffffff', ACC = 0xe0701c;
  const POS = { figure: [8, 8], axes: [64, 40], title: [296, 28], xlabel: [296, 322], ylabel: [18, 156], legend: [440, 62], ticks: [150, 290], grid: [200, 110], line: [260, 150], spine: [64, 272] };
  const ORDER = ['figure', 'axes', 'grid', 'spine', 'ticks', 'xlabel', 'title', 'ylabel', 'line', 'legend'], LAYER = { figure: 0, axes: 1, grid: 2, spine: 3, ticks: 4, xlabel: 5, title: 5, ylabel: 5, line: 6, legend: 7 };
  const G = {}; ORDER.forEach(id => { G[id] = new T.Group(); grp.add(G[id]); });
  const flat = (g, w, hh, c, x, y, z, o) => { const m = new T.Mesh(new T.BoxGeometry(w, hh, .12), pc3dMat(T, c, Object.assign({ shininess: 20 }, o || {}))); m.position.set(x, y, z || 0); g.add(m); return m; };
  const txt = (g, s, size, p, color) => { const t = X.label(s, { size, color: color || INK }); t.position.copy(p); g.add(t); return t; };
  const mid = (a, b) => (a + b) / 2;
  flat(G.figure, 14.2, 8.7, 0xe9eefb, 0, 0, 0, { transparent: true, opacity: .96 });
  flat(G.axes, 11.6, 5.8, 0xffffff, (296 - 280) / 40, (170 - 156) / 40, 0, { transparent: true, opacity: .97 });
  const xs = [0, 1, 2, 3, 4, 5].map(i => 104 + i * 76), ys = [210, 180, 190, 130, 100, 70], gp = [];
  [0, 1, 2, 3, 4].forEach(i => { const a = P(64 + i * 116, 40), b = P(64 + i * 116, 272); gp.push(a.x, a.y, 0, b.x, b.y, 0); }); [0, 1, 2, 3].forEach(i => { const a = P(64, 40 + i * 77), b = P(528, 40 + i * 77); gp.push(a.x, a.y, 0, b.x, b.y, 0); });
  const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(gp, 3)); G.grid.add(new T.LineSegments(gg, new T.LineBasicMaterial({ color: 0x9fb0d0 })));
  const b1 = P(64, 272), b2 = P(528, 272), b3 = P(64, 40);
  flat(G.spine, b2.x - b1.x, .09, 0x1d2a44, mid(b1.x, b2.x), b1.y, 0); flat(G.spine, .09, b3.y - b1.y, 0x1d2a44, b1.x, mid(b1.y, b3.y), 0);
  xs.forEach((x, i) => txt(G.ticks, String(i + 1), .42, P(x, 292)));
  txt(G.title, 'Monthly sales', .62, P(296, 26)); txt(G.xlabel, 'Month', .5, P(296, 322)); txt(G.ylabel, 'Sales', .5, P(24, 156));
  const pts = xs.map((x, i) => P(x, ys[i])); G.line.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, false, 'catmullrom', 0), 60, .075, 8), pc3dMat(T, ACC, { emissive: 0x401a00 })));
  pts.forEach(p => { const s = new T.Mesh(new T.SphereGeometry(.16, 14, 10), pc3dMat(T, 0x2457d6)); s.position.copy(p); G.line.add(s); });
  const lg = P(470, 63); flat(G.legend, 2.6, .7, 0xf6f8ff, lg.x, lg.y, 0); const l1 = P(438, 63), l2 = P(450, 63); G.legend.add(pc3dCyl(T, l1, new T.Vector3(l2.x + .2, l2.y, 0), .05, pc3dMat(T, ACC))); txt(G.legend, '2026', .4, P(484, 63));
  /* numbered pins: each one sits beside the thing it names, then a small spacing pass pushes pins apart from each other and out of the text labels, so none overlap
     (a thin leader line links a pin to its part). A pin is a child of its layer, so it travels with the layer when you pull them apart. */
  const BOX = { title: [.4, 3.6, 4.4, .9], xlabel: [.4, -3.8, 2.0, .8], ylabel: [-6.4, .35, 1.4, .8], legend: [4.75, 2.68, 2.8, .8], ticks: [.4, -3.05, 10.3, .6] };
  const SIDE = { title: [-1, 0], xlabel: [1, 0], ylabel: [0, 1], legend: [-1, 0], ticks: [-1, 0] };
  const spot = parts.map(p => { const bx = BOX[p.id]; if (bx) { const s = SIDE[p.id]; return { bx, a: new T.Vector3(bx[0], bx[1], 0), x: bx[0] + s[0] * (bx[2] / 2 + .5), y: bx[1] + s[1] * (bx[3] / 2 + .5) }; } const c = POS[p.id] || [280, 170], a = P(c[0], c[1]), o = p.id === 'figure' ? .4 : 0; return { bx: null, a, x: a.x + o, y: a.y - o }; });
  for (let it = 0; it < 160; it++) {
    spot.forEach((q, i) => {
      spot.forEach((r, j) => { if (i >= j) return; const dx = q.x - r.x, dy = q.y - r.y, d = Math.hypot(dx, dy) || .01; if (d < .9) { const f = (.9 - d) / 2 / d; q.x += dx * f; q.y += dy * f; r.x -= dx * f; r.y -= dy * f; } });
      Object.keys(BOX).forEach(id => { const bx = BOX[id], hx = bx[2] / 2 + .35, hy = bx[3] / 2 + .35, dx = q.x - bx[0], dy = q.y - bx[1]; if (Math.abs(dx) < hx && Math.abs(dy) < hy) { if (hx - Math.abs(dx) < hy - Math.abs(dy)) q.x = bx[0] + (dx < 0 ? -1 : 1) * hx; else q.y = bx[1] + (dy < 0 ? -1 : 1) * hy; } });
      q.x = Math.max(-6.9, Math.min(6.9, q.x)); q.y = Math.max(-4.1, Math.min(4.1, q.y));
    });
  }
  const pins = parts.map((p, i) => {
    const q = spot[i], g = G[p.id] || grp, b = new T.Mesh(new T.SphereGeometry(.26, 16, 12), pc3dMat(T, 0x2457d6, { emissive: 0x101e55 })); b.position.set(q.x, q.y, .35); g.add(b);
    const t = X.label(String(i + 1), { size: .36, color: '#ffffff', depthTest: false }); t.position.set(q.x, q.y, .62); g.add(t);
    const tx = q.bx ? Math.max(q.bx[0] - q.bx[2] / 2, Math.min(q.bx[0] + q.bx[2] / 2, q.x)) : q.a.x, ty = q.bx ? Math.max(q.bx[1] - q.bx[3] / 2, Math.min(q.bx[1] + q.bx[3] / 2, q.y)) : q.a.y;
    if (Math.hypot(q.x - tx, q.y - ty) > .45) g.add(pc3dCyl(T, new T.Vector3(q.x, q.y, .3), new T.Vector3(tx, ty, .3), .025, new T.MeshBasicMaterial({ color: 0x2457d6 })));
    return { b, t };
  });
  let target = .6, ex = 0, cur = -1, lt = 0; const sprites = [];
  grp.traverse(o => { if (o.isSprite) { o.userData.base = o.scale.clone(); sprites.push(o); } });
  const hl = (id, on) => { const g = G[id]; if (!g) return; g.traverse(o => { if (o.material && o.material.emissive && !o.isSprite) o.material.emissive.setHex(on ? 0x6a4a10 : o.userData.em || 0); }); };
  grp.traverse(o => { if (o.material && o.material.emissive) o.userData.em = o.material.emissive.getHex(); });
  const pick = i => {
    if (cur >= 0) hl(parts[cur].id, false); cur = i; hl(parts[i].id, true); const p = parts[i];
    pins.forEach((q, j) => { q.b.material.color.setHex(j === i ? ACC : 0x2457d6); });
    X.info('<b>' + (i + 1) + '. ' + picEsc(p.name) + '</b> &nbsp;<code class="mono">' + picEsc(p.code) + '</code><br><span class="pic3-note">' + (p.say || '') + '</span>');
  };
  const btnRow = h('div', { class: 'pic3-row' }, parts.map((p, i) => pc3dBtn((i + 1) + ' ' + p.name, () => pick(i))));
  ctl.append(h('div', { class: 'pic3-row' }, pc3dRange(0, 1, .01, target, v => { target = v; }, 'pull the layers apart ')), btnRow);
  X.setCam({ th: .55, ph: 1.15, ty: 0 }); X.fit(9.6, 6); pick(Math.min(sp.start || 0, parts.length - 1));
  return { update(dt) {
    lt += dt; ex += (target - ex) * Math.min(1, dt * 5);
    ORDER.forEach(id => { G[id].position.z = LAYER[id] * (.06 + ex * .5); });
    const cid = parts[cur] && parts[cur].id, gs = G[cid]; sprites.forEach(s => { s.scale.copy(s.userData.base); });
    if (gs) gs.traverse(o => { if (o.isSprite) o.scale.copy(o.userData.base).multiplyScalar(1 + .14 * Math.sin(lt * 6)); });
  } };
};
