'use strict';
/* =====================================================================
   3D versions for the analytics and engineering pictures (see 40_pic3d.js): heat (a field of pillars), funnel (slabs getting narrower), series (lines as ribbons you can hide),
   dag (boxes and arrows on a floor, click to make one fail). Same (T, X, spec) contract as the other 3D scenes.
   ===================================================================== */
PIC3.scenes.heat = (T, X, sp) => {
  const ctl = X.ctl, grp = new T.Group(), R = sp.rows, nr = R.length, nc = R[0].length, hi = sp.hi || Math.max.apply(null, [].concat.apply([], R).filter(v => v != null)), fmt = v => (sp.fmt === 'pct' ? Math.round(v) + '%' : sp.fmt === 'num' ? String(Math.round(v * 100) / 100) : String(v)); X.world.add(grp); let lt = 0;
  const base = new T.Mesh(new T.BoxGeometry(nc + 1.6, .1, nr + 1.6), pc3dMat(T, 0x17294a)); base.position.set(0, -.06, 0); base.receiveShadow = true; grp.add(base);
  const bars = []; R.forEach((row, i) => row.forEach((v, j) => { if (v == null) return; const hgt = Math.max(.06, v / hi * 4), b = new T.Mesh(new T.BoxGeometry(.86, 1, .86), pc3dMat(T, new T.Color().setHSL(.62 - .5 * v / hi, .7, .5).getHex())); b.castShadow = true; b.position.set(j - (nc - 1) / 2, 0, i - (nr - 1) / 2); b.userData = { hgt, i, j, v }; grp.add(b); bars.push(b); }));
  sp.colLabels.forEach((c, j) => { const t = X.label(String(c), { size: .38, color: '#cfe0ff' }); t.position.set(j - (nc - 1) / 2, 0, -(nr - 1) / 2 - 1); grp.add(t); }); sp.rowLabels.forEach((r, i) => { const t = X.label(String(r), { size: .38, color: '#cfe0ff' }); t.position.set(-(nc - 1) / 2 - 1.5, 0, i - (nr - 1) / 2); grp.add(t); });
  const pick = (i, j) => { bars.forEach(b => b.material.emissive.setHex(b.userData.i === i || b.userData.j === j ? 0x222a44 : 0)); X.info('<b>' + picEsc(sp.rowLabels[i]) + '</b>, <b>' + picEsc(sp.colLabels[j]) + '</b>: <b>' + fmt(R[i][j]) + '</b>'); };
  ctl.append(h('div', { class: 'pic3-row' }, pc3dRange(0, nr - 1, 1, 0, v => { const j = R[v].findIndex(x => x != null); pick(v, Math.max(0, j)); }, 'row'), pc3dRange(0, nc - 1, 1, 0, v => { const i = R.findIndex(r => r[v] != null); pick(Math.max(0, i), v); }, 'column'), pc3dBtn('↻ rise again', () => { lt = 0; })));
  X.info(sp.title ? picEsc(sp.title) + '<br><span class="pic3-note">height and colour = the number; move the sliders to read a cell</span>' : 'height and colour = the number');
  X.setCam({ th: .6, ph: 1.0, ty: 1.2 }); X.fit(Math.max(nc, nr) / 2 + 3, 3.4);
  return { update(dt) { lt += dt; bars.forEach(b => { const p = pjClamp((lt - (b.userData.i + b.userData.j) * .1) / .6, 0, 1), e = pjEase(p); b.scale.y = Math.max(.01, b.userData.hgt * e); b.position.y = b.scale.y / 2; }); } };
};

PIC3.scenes.funnel = (T, X, sp) => {
  const ctl = X.ctl, grp = new T.Group(), S = sp.steps, mx = S[0].n, drops = S.map((s, i) => (i ? 1 - s.n / S[i - 1].n : 0)), worst = drops.indexOf(Math.max.apply(null, drops.slice(1))); X.world.add(grp); let lt = 0;
  const slabs = S.map((s, i) => { const w = 7 * s.n / mx + .3, m = new T.Mesh(new T.BoxGeometry(w, .9, 2.4), pc3dMat(T, i === worst ? 0xcb3a46 : 0x2457d6, { transparent: true, opacity: .9 })); m.position.set(0, (S.length - 1 - i) * 1.25 + .5, 0); m.castShadow = true; grp.add(m);
    const t = X.label(s.n.toLocaleString('en-US'), { size: .5, color: '#fff', depthTest: false }); t.position.set(0, m.position.y, 1.4); grp.add(t); const nm = X.label(s.name, { size: .42, color: '#cfe0ff' }); nm.position.set(5.2, m.position.y, 0); grp.add(nm); if (i) { const d = X.label(Math.round(s.n / S[i - 1].n * 100) + '% continue', { size: .34, color: i === worst ? '#ff9aa2' : '#9fb2d8' }); d.position.set(5.2, m.position.y - .45, 0); grp.add(d); } return m; });
  const fl = new T.Mesh(new T.BoxGeometry(9, .1, 4), pc3dMat(T, 0x17294a)); fl.position.y = -.06; fl.receiveShadow = true; grp.add(fl);
  ctl.append(h('div', { class: 'pic3-row' }, S.map((s, i) => pc3dBtn(s.name, () => { slabs.forEach((m, k) => m.material.emissive.setHex(k === i ? 0x555555 : 0)); X.info('<b>' + picEsc(s.name) + '</b>: ' + s.n.toLocaleString('en-US') + ' people' + (i ? ', ' + (S[i - 1].n - s.n).toLocaleString('en-US') + ' left here' : '')); })), pc3dBtn('↻ again', () => { lt = 0; })));
  X.info('overall <b>' + (S[S.length - 1].n / mx * 100).toFixed(1) + '%</b> reach the last step. The biggest leak (red): <b>' + picEsc(S[worst].name) + '</b>.'); X.setCam({ th: .45, ph: 1.15, tx: 1.5, ty: (S.length - 1) * .6 }); X.fit(7.5, (S.length) * .9 + 1);
  return { update(dt) { lt += dt; slabs.forEach((m, i) => { const p = pjClamp((lt - i * .4) / .5, 0, 1); m.scale.set(pjEase(p), 1, 1); m.visible = p > 0; }); } };
};

PIC3.scenes.series = (T, X, sp) => {
  const ctl = X.ctl, grp = new T.Group(), n = sp.x.length, all = [].concat.apply([], sp.lines.map(l => l.y)).filter(v => v != null), lo = sp.yr ? sp.yr[0] : Math.min.apply(null, all), hi = sp.yr ? sp.yr[1] : Math.max.apply(null, all), pad = sp.yr ? 0 : (hi - lo) * .08; X.world.add(grp); let lt = 0;
  const B = pc3dBoard(T, X, grp, [0, n - 1], [lo - pad, hi + pad], 12, 6, sp.xlab, sp.ylab, 5, 4), meshes = sp.lines.map((l, k) => { const pts = l.y.map((v, i) => (v == null ? null : new T.Vector3(B.sx(i), B.sy(v), .2 + k * .35))).filter(Boolean), g = new T.Group(); g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, false, 'catmullrom', 0), Math.max(24, n * 3), .07, 8), pc3dMat(T, new T.Color(pc3dCol[k % 5]).getHex(), { emissive: new T.Color(pc3dCol[k % 5]).multiplyScalar(.2).getHex() }))); if (n <= 40) pts.forEach(p => { const s = new T.Mesh(new T.SphereGeometry(.13, 12, 8), pc3dMat(T, new T.Color(pc3dCol[k % 5]).getHex())); s.position.copy(p); g.add(s); }); g.visible = !l.hidden; grp.add(g); return g; });
  const xl = Math.max(1, Math.ceil(n / 6)); for (let i = 0; i < n; i += xl) { const t = X.label(String(sp.x[i]), { size: .34, color: '#b9c8e6' }); t.position.set(B.sx(i), -.9, 0); grp.add(t); }
  ctl.append(h('div', { class: 'pic3-row' }, sp.lines.map((l, k) => pc3dBtn(l.name, v => { meshes[k].visible = v; }, !l.hidden)), pc3dBtn('↻ draw again', () => { lt = 0; })));
  X.info(sp.title ? picEsc(sp.title) : 'lines over time'); X.setCam({ th: .35, ph: 1.25, ty: 3 }); X.fit(8, 4.6);
  return { update(dt) { lt += dt; meshes.forEach((g, k) => { g.scale.x = 1; const p = pjClamp((lt - k * .4) / 1.2, 0, 1); g.children.forEach(c => { if (c.material) c.material.opacity = 1; }); g.position.z = (1 - pjEase(p)) * 6; }); } };
};

PIC3.scenes.dag = (T, X, sp) => {
  const M = PIC.math, ctl = X.ctl, grp = new T.Group(), nodes = sp.nodes, edges = sp.edges, byId = {}; X.world.add(grp); let failed = (sp.failed || []).slice(), lt = 0, R = null; nodes.forEach(n => { byId[n.id] = n; });
  const gx = Math.max.apply(null, nodes.map(n => n.x)) || 1, gy = Math.max.apply(null, nodes.map(n => n.y)) || 1, P = n => new T.Vector3((n.x / gx - .5) * 13, 0, (n.y / gy - .5) * 7.5);
  const fl = new T.Mesh(new T.BoxGeometry(16, .1, 10.5), pc3dMat(T, 0x17294a)); fl.position.y = -.06; fl.receiveShadow = true; grp.add(fl);
  const boxes = {}; nodes.forEach(n => { const p = P(n), b = new T.Mesh(new T.BoxGeometry(2.3, .9, 1.3), pc3dMat(T, 0x2d4f8f, { transparent: true, opacity: .95 })); b.position.set(p.x, .45, p.z); b.castShadow = true; grp.add(b); const t = X.label(n.label, { size: .42, color: '#fff', depthTest: false }); t.position.set(p.x, 1.35, p.z); grp.add(t); if (n.sub || n.value != null) { const u = X.label(String(n.value != null ? n.value : n.sub), { size: .32, color: '#b9c8e6', depthTest: false }); u.position.set(p.x, .9, p.z + .75); grp.add(u); } boxes[n.id] = b; });
  const links = edges.map(e => { const a = P(byId[e[0]]), b = P(byId[e[1]]); a.y = b.y = .45; const dir = new T.Vector3().subVectors(b, a).normalize(), c = pc3dCyl(T, a.clone().add(dir.clone().multiplyScalar(1.2)), b.clone().sub(dir.clone().multiplyScalar(1.2)), .05, new T.MeshBasicMaterial({ color: 0x8aa0cc })); grp.add(c); const cone = new T.Mesh(new T.ConeGeometry(.17, .45, 12), new T.MeshBasicMaterial({ color: 0x8aa0cc })); cone.position.copy(b.clone().sub(dir.clone().multiplyScalar(1.35))); cone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir); grp.add(cone); return { c, cone, e }; });
  const run = () => { R = M.waves(nodes, edges, failed); lt = 0; Object.values(boxes).forEach(b => b.material.color.setHex(0x2d4f8f)); links.forEach(l => { l.c.material.color.setHex(0x8aa0cc); l.cone.material.color.setHex(0x8aa0cc); }); X.info(sp.mode === 'static' ? (sp.note || '') : 'running...'); };
  if (sp.mode !== 'static') ctl.append(h('div', { class: 'pic3-row' }, nodes.map(n => pc3dBtn('✗ ' + n.label, () => { failed = failed.includes(n.id) ? [] : [n.id]; run(); })), pc3dBtn('nothing fails', () => { failed = []; run(); }))); else ctl.append(h('div', { class: 'pic3-row' }, pc3dBtn('↻ again', () => run())));
  run(); X.setCam({ th: .35, ph: 1.0, ty: 0 }); X.fit(8.8, 5.6);
  return { update(dt) { lt += dt; if (sp.mode === 'static') { Object.values(boxes).forEach(b => b.material.color.setHex(0x0f8a5f)); return; } R.waves.forEach((w, k) => { if (lt < .5 + k * .9) return; w.run.forEach(id => { boxes[id].material.color.setHex(failed.includes(id) ? 0xcb3a46 : 0x0f8a5f); links.filter(l => l.e[1] === id).forEach(l => { l.c.material.color.setHex(0x0f8a5f); l.cone.material.color.setHex(0x0f8a5f); }); }); w.skipped.forEach(id => boxes[id].material.color.setHex(0x555d70)); }); if (lt > .7 + R.waves.length * .9 && !R.done) { R.done = 1; X.info(R.failed.length ? '<b>' + picEsc(byId[R.failed[0]].label) + '</b> failed: <b>' + R.skipped.length + '</b> later steps skipped' : 'all <b>' + nodes.length + '</b> steps passed in <b>' + R.waves.length + '</b> rounds (same round = in parallel)'); } } };
};

/* ---------------- chart: bars, pie slices, stacked columns and box plots as solid objects ---------------- */
PIC3.scenes.chart = (T, X, sp) => {
  const ctl = X.ctl, grp = new T.Group(); X.world.add(grp); let lt = 0; const grow = [], fmt = v => String(Math.round(v * 100) / 100);
  const fl = (w, d) => { const m = new T.Mesh(new T.BoxGeometry(w, .1, d), pc3dMat(T, 0x17294a)); m.position.y = -.06; m.receiveShadow = true; grp.add(m); };
  if (sp.kind === 'hbar') {
    const n = sp.values.length, mx = Math.max.apply(null, sp.values); fl(13, n * 1.5 + 1);
    sp.values.forEach((v, i) => { const w = Math.max(.05, v / mx * 8), z = (i - (n - 1) / 2) * 1.5, b = new T.Mesh(new T.BoxGeometry(1, .8, 1), pc3dMat(T, new T.Color(pc3dCol[i % 5]).getHex())); b.castShadow = true; b.userData = { w, z, x0: -3 }; grp.add(b); grow.push(b); const l = X.label(sp.labels[i], { size: .45, color: '#cfe0ff' }); l.position.set(-5.6, .5, z); grp.add(l); const t = X.label(fmt(v), { size: .45, color: '#ffe9a0', depthTest: false }); t.position.set(-3 + w + 1, .5, z); grp.add(t); });
    X.setCam({ th: .45, ph: 1.1, ty: .4 }); X.fit(8, Math.max(3.5, n * .9));
    ctl.append(h('div', { class: 'pic3-row' }, sp.labels.map((l, i) => pc3dBtn(l, () => X.info('<b>' + picEsc(l) + '</b>: ' + fmt(sp.values[i]))))));
  } else if (sp.kind === 'pie') {
    const tot = sp.values.reduce((a, b) => a + b, 0); let a0 = 0; const sl = []; fl(11, 11);
    sp.values.forEach((v, i) => { const ang = v / tot * Math.PI * 2, m = new T.Mesh(new T.CylinderGeometry(3.4, 3.4, 1.2, 48, 1, false, a0, ang), pc3dMat(T, new T.Color(pc3dCol[i % 5]).getHex())); m.castShadow = true; m.position.y = .6; const mid = a0 + ang / 2; m.userData = { dx: Math.sin(mid), dz: Math.cos(mid) }; grp.add(m); sl.push(m); const l = X.label(sp.labels[i] + ' ' + Math.round(v / tot * 100) + '%', { size: .46, color: '#fff', depthTest: false }); l.position.set(Math.sin(mid) * 4.9, 1.1, Math.cos(mid) * 4.9); grp.add(l); a0 += ang; });
    ctl.append(h('div', { class: 'pic3-row' }, sp.labels.map((l, i) => pc3dBtn('pull out: ' + l, on => { sl[i].position.x = on ? sl[i].userData.dx * .9 : 0; sl[i].position.z = on ? sl[i].userData.dz * .9 : 0; X.info('<b>' + picEsc(l) + '</b>: ' + fmt(sp.values[i]) + ' (' + Math.round(sp.values[i] / tot * 100) + '%)'); }, false))));
    X.setCam({ th: .3, ph: .9, ty: 0 }); X.fit(7, 6);
  } else if (sp.kind === 'stacked') {
    const n = sp.labels.length, tots = sp.labels.map((_, j) => sp.series.reduce((a, s) => a + s[j], 0)), mx = Math.max.apply(null, tots), parts = sp.series.map(() => []); fl(n * 2.4 + 2, 5);
    sp.labels.forEach((lab, j) => { let acc = 0; sp.series.forEach((s, i) => { const hgt = s[j] / mx * 6, b = new T.Mesh(new T.BoxGeometry(1.6, 1, 1.6), pc3dMat(T, new T.Color(pc3dCol[i % 5]).getHex())); b.castShadow = true; b.userData = { hgt, y0: acc, x: (j - (n - 1) / 2) * 2.4 }; acc += hgt; grp.add(b); grow.push(b); parts[i].push(b); }); const t = X.label(lab, { size: .45, color: '#cfe0ff' }); t.position.set((j - (n - 1) / 2) * 2.4, -.5, 1.8); grp.add(t); });
    ctl.append(h('div', { class: 'pic3-row' }, (sp.names || []).map((nm, i) => pc3dBtn(nm, on => { parts[i].forEach(b => { b.visible = on; }); }, true))));
    X.setCam({ th: .5, ph: 1.15, ty: 3 }); X.fit(n * 1.3 + 2, 4.5);
  } else {
    const all = [].concat.apply([], sp.series), lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), n = sp.series.length, Y = v => (v - lo) / (hi - lo) * 6, q = (a, p) => { const s = a.slice().sort((x, y) => x - y), i = (s.length - 1) * p, f = Math.floor(i); return s[f] + (s[Math.min(f + 1, s.length - 1)] - s[f]) * (i - f); }; fl(n * 3 + 2, 4);
    sp.series.forEach((a, i) => { const q1 = q(a, .25), q2 = q(a, .5), q3 = q(a, .75), iq = q3 - q1, wl = Math.min.apply(null, a.filter(v => v >= q1 - 1.5 * iq)), wh = Math.max.apply(null, a.filter(v => v <= q3 + 1.5 * iq)), x = (i - (n - 1) / 2) * 3, col = new T.Color(pc3dCol[i % 5]).getHex();
      const bx = new T.Mesh(new T.BoxGeometry(1.8, Math.max(.05, Y(q3) - Y(q1)), 1.2), pc3dMat(T, col, { transparent: true, opacity: .8 })); bx.position.set(x, (Y(q1) + Y(q3)) / 2, 0); grp.add(bx); const md = new T.Mesh(new T.BoxGeometry(1.9, .08, 1.3), pc3dMat(T, 0xffffff)); md.position.set(x, Y(q2), 0); grp.add(md); grp.add(pc3dCyl(T, new T.Vector3(x, Y(wl), 0), new T.Vector3(x, Y(wh), 0), .04, new T.MeshBasicMaterial({ color: 0xcfe0ff })));
      a.filter(v => v < wl || v > wh).forEach(v => { const s = new T.Mesh(new T.SphereGeometry(.17, 12, 8), pc3dMat(T, 0xffffff)); s.position.set(x, Y(v), 0); grp.add(s); }); const t = X.label(sp.labels[i], { size: .45, color: '#cfe0ff' }); t.position.set(x, -.5, 1.4); grp.add(t); });
    ctl.append(h('div', { class: 'pic3-row' }, sp.labels.map((l, i) => pc3dBtn(l, () => { const a = sp.series[i]; X.info('<b>' + picEsc(l) + '</b>: median ' + fmt(q(a, .5)) + ', middle half ' + fmt(q(a, .25)) + ' to ' + fmt(q(a, .75))); }))));
    X.setCam({ th: .4, ph: 1.15, ty: 3 }); X.fit(n * 1.7 + 2, 4.6);
  }
  X.info(sp.title ? picEsc(sp.title) : '');
  return { update(dt) { lt += dt; grow.forEach((b, i) => { const p = pjEase(pjClamp((lt - i * .12) / .7, 0, 1)); if (b.userData.w != null) { b.scale.set(Math.max(.01, b.userData.w * p), 1, 1); b.position.set(b.userData.x0 + b.userData.w * p / 2, .4, b.userData.z); } else { const hh = Math.max(.01, b.userData.hgt * p); b.scale.set(1, hh, 1); b.position.set(b.userData.x, b.userData.y0 * p + hh / 2, 0); } }); } };
};

/* ---------------- compare: the A/B outcomes as two bell-shaped hills, or the live data against the training data ---------------- */
PIC3.scenes.compare = (T, X, sp) => {
  const M = PIC.math, ctl = X.ctl, grp = new T.Group(); X.world.add(grp);
  const fl = new T.Mesh(new T.BoxGeometry(15, .1, 6), pc3dMat(T, 0x17294a)); fl.position.y = -.06; fl.receiveShadow = true; grp.add(fl);
  if (sp.kind === 'drift') {
    const e = sp.edges, c = a => M.hist(a, e).map(v => v / a.length), r = c(sp.ref), q = c(sp.cur), mx = Math.max.apply(null, r.concat(q)), psi = M.psi(sp.ref, sp.cur, e), n = e.length - 1, w = 12 / n;
    for (let i = 0; i < n; i++) { [[r[i], -.55, 0x2457d6], [q[i], .55, 0xe0701c]].forEach(a => { const b = new T.Mesh(new T.BoxGeometry(w * .8, Math.max(.04, a[0] / mx * 5), 1), pc3dMat(T, a[2])); b.castShadow = true; b.position.set(-6 + w * (i + .5), Math.max(.04, a[0] / mx * 5) / 2, a[1]); grp.add(b); }); const t = X.label(String(e[i]), { size: .38, color: '#cfe0ff' }); t.position.set(-6 + w * i, 0, 2.2); grp.add(t); }
    const l1 = X.label('blue: training data', { size: .42, color: '#8fb0ff' }); l1.position.set(-4, 5.6, 0); const l2 = X.label('orange: live data', { size: .42, color: '#ffb37a' }); l2.position.set(3, 5.6, 0); grp.add(l1, l2);
    X.info('PSI = <b>' + psi.toFixed(3) + '</b>: ' + (psi < .1 ? 'stable' : psi < .25 ? 'watch' : 'a real shift') + '<br><span class="pic3-note">front row blue, back row orange: the same bins side by side</span>'); X.setCam({ th: .45, ph: 1.1, ty: 2 }); X.fit(8, 4.4);
    return { update() { } };
  }
  let n = sp.n, lift = sp.lift, hills = []; const p0 = sp.p0, alpha = sp.alpha || .05;
  const draw = () => {
    hills.forEach(o => { grp.remove(o); X.dispose(o); }); hills = [];
    const p1 = p0 + lift, pb = (p0 + p1) / 2, se0 = Math.sqrt(2 * pb * (1 - pb) / n), se1 = Math.sqrt(p0 * (1 - p0) / n + p1 * (1 - p1) / n), zc = M.zcrit(alpha) * se0, pw = M.abPower(p0, p1, n, alpha), lo = Math.min(-4 * se0, lift - 4 * se1), hi = Math.max(4 * se0, lift + 4 * se1), pdf = (x, m, s) => Math.exp(-.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI)), top = Math.max(pdf(0, 0, se0), pdf(lift, lift, se1)), X0 = x => -6 + (x - lo) / (hi - lo) * 12, Y0 = v => v / top * 4.2;
    const hill = (m, s, z, col, from, to, op) => { const pts = []; for (let i = 0; i <= 80; i++) { const x = from + (to - from) * i / 80; pts.push(new T.Vector2(X0(x), Y0(pdf(x, m, s)))); } const sh = new T.Shape([new T.Vector2(X0(from), 0)].concat(pts, [new T.Vector2(X0(to), 0)])), mesh = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: .8, bevelEnabled: false }), pc3dMat(T, col, { transparent: true, opacity: op })); mesh.position.z = z; grp.add(mesh); hills.push(mesh); };
    hill(0, se0, -1.2, 0x8a94a8, lo, hi, .55); hill(lift, se1, 1.0, 0x2457d6, lo, hi, .55); hill(lift, se1, 1.0, 0x0f8a5f, zc, hi, .95); hill(0, se0, -1.2, 0xcb3a46, zc, hi, .95); hill(0, se0, -1.2, 0xcb3a46, lo, -zc, .95);
    const wall = new T.Mesh(new T.BoxGeometry(.06, 5, 4), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .3 })); wall.position.set(X0(zc), 2.5, 0); grp.add(wall); hills.push(wall);
    X.info((p0 * 100).toFixed(1) + '% to ' + (p1 * 100).toFixed(1) + '% with <b>' + n.toLocaleString('en-US') + '</b> per group: power <b>' + (pw * 100).toFixed(0) + '%</b>.<br><span class="pic3-note">back hill: if nothing changed (red = false alarm zone); front hill: if the lift is real (green = the part the test would catch)</span>');
  };
  ctl.append(h('div', { class: 'pic3-row' }, pc3dRange(2, 5, .01, Math.log10(n), v => { n = Math.round(Math.pow(10, v)); draw(); }, 'people per group (log)'), pc3dRange(.002, .04, .001, lift, v => { lift = v; draw(); }, 'real lift')));
  draw(); X.setCam({ th: .45, ph: 1.1, ty: 1.8 }); X.fit(8, 4.4);
  return { update() { } };
};
