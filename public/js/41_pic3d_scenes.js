'use strict';
/* =====================================================================
   3D versions of the lesson pictures (see 40_pic3d.js). Same contract as PROJ.scenes: (T, X, spec) -> { update(dt, t), dispose() }.
   Every scene can be turned with the mouse and has buttons or sliders of its own; the numbers come from PIC.math, the same code the 2D pictures use.
   ===================================================================== */
const pc3dBtn = (txt, fn, on) => { const b = h('button', { type: 'button', class: 'pic3-btn', 'aria-pressed': on == null ? null : String(!!on) }, txt); b.onclick = () => { if (on != null) { on = !on; b.setAttribute('aria-pressed', String(on)); } fn(on); }; return b; };
const pc3dRange = (min, max, step, val, fn, label) => h('label', { class: 'pic3-rng' }, label || '', h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(val), oninput: e => fn(+e.target.value) }));
const pc3dCol = ['#2457d6', '#e0701c', '#0f8a5f', '#7a4fd0', '#cb3a46'];
const pc3dMat = (T, c, o) => new T.MeshPhongMaterial(Object.assign({ color: c, shininess: 60 }, o || {}));
const pc3dCyl = (T, a, b, r, mat) => { const dir = new T.Vector3().subVectors(b, a), len = dir.length() || 1e-6, m = new T.Mesh(new T.CylinderGeometry(r, r, 1, 10), mat); m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize()); m.scale.set(1, len, 1); return m; };
const pc3dSet = (T, m, a, b) => { const dir = new T.Vector3().subVectors(b, a), len = dir.length() || 1e-6; m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize()); m.scale.set(1, len, 1); };
/* a vertical board with a grid and numbered axes, like a sheet of graph paper standing in the room */
function pc3dBoard(T, X, grp, xr, yr, WX, WY, xlab, ylab, nx, ny) {
  const sx = x => -WX / 2 + (x - xr[0]) / (xr[1] - xr[0]) * WX, sy = y => (y - yr[0]) / (yr[1] - yr[0]) * WY, g = [];
  nx = nx || 5; ny = ny || 5;
  for (let i = 0; i <= nx; i++) { const v = xr[0] + (xr[1] - xr[0]) * i / nx; g.push(sx(v), 0, 0, sx(v), WY, 0); const t = X.label(String(Math.round(v * 100) / 100), { size: .36, color: '#b9c8e6' }); t.position.set(sx(v), -.4, 0); grp.add(t); }
  for (let i = 0; i <= ny; i++) { const v = yr[0] + (yr[1] - yr[0]) * i / ny; g.push(-WX / 2, sy(v), 0, WX / 2, sy(v), 0); const t = X.label(String(Math.round(v * 100) / 100), { size: .36, color: '#b9c8e6' }); t.position.set(-WX / 2 - .7, sy(v), 0); grp.add(t); }
  const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(g, 3)); grp.add(new T.LineSegments(gg, new T.LineBasicMaterial({ color: 0x6f8fd0, transparent: true, opacity: .35 })));
  const back = new T.Mesh(new T.PlaneGeometry(WX, WY), new T.MeshBasicMaterial({ color: 0x142340, transparent: true, opacity: .55, side: T.DoubleSide })); back.position.set(0, WY / 2, -.06); grp.add(back);
  if (xlab) { const t = X.label(xlab, { size: .46, color: '#ffffff' }); t.position.set(0, -1.05, 0); grp.add(t); } if (ylab) { const t = X.label(ylab, { size: .46, color: '#ffffff' }); t.position.set(-WX / 2 - 1.2, WY + .6, 0); grp.add(t); }
  return { sx, sy };
}

/* ---------------- hist: a histogram built from cubes that fall into place ---------------- */
PIC3.scenes.hist = (T, X, sp) => {
  const M = PIC.math, d = sp.data, ctl = X.ctl, WID = 12; let nb = sp.edges ? sp.edges.length - 1 : (sp.bins || 10), reb = false, grp, im, items = [], lt = 0, shv = .4, info = {}, flags = { mean: (sp.show || []).includes('mean'), median: (sp.show || []).includes('median'), sd: (sp.show || []).includes('sd'), normal: (sp.show || []).includes('normal') };
  const dummy = new T.Object3D(), parts = {};
  const build = () => {
    if (grp) { X.world.remove(grp); X.dispose(grp); } grp = new T.Group(); X.world.add(grp); lt = 0;
    const lo = sp.edges ? sp.edges[0] : Math.min.apply(null, d), hi = sp.edges ? sp.edges[sp.edges.length - 1] : Math.max.apply(null, d), edges = sp.edges && !reb ? sp.edges : Array.from({ length: nb + 1 }, (_, i) => lo + (hi - lo) * i / nb);
    const cnt = M.hist(d, edges), maxc = Math.max.apply(null, cnt), u = WID / (hi - lo), xw = v => (v - lo) * u - WID / 2, sh = Math.min(.45, 5.5 / maxc); shv = sh; const slots = new Array(cnt.length).fill(0);
    items = []; d.forEach((v, i) => { if (v < lo || v > hi) return; let b = cnt.length - 1; for (let k = 0; k < cnt.length; k++) if (v >= edges[k] && v < edges[k + 1]) { b = k; break; } items.push({ b, k: slots[b]++, rank: items.length, cx: (xw(edges[b]) + xw(edges[b + 1])) / 2, bw: (edges[b + 1] - edges[b]) * u * .9 }); });
    im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), pc3dMat(T, 0xffffff, { shininess: 30 }), Math.max(1, items.length)); im.castShadow = true; items.forEach((it, i) => im.setColorAt(i, new T.Color().setHSL(.6 - .12 * it.b / Math.max(1, cnt.length - 1), .65, .55))); grp.add(im);
    const base = new T.Mesh(new T.BoxGeometry(WID + 1.4, .1, 3.2), pc3dMat(T, 0x1d2c4d)); base.position.y = -.05; base.receiveShadow = true; grp.add(base);
    const step = Math.ceil(cnt.length / 8); edges.forEach((e, i) => { if (i % step) return; const t = X.label(String(Math.round(e * 100) / 100), { size: .4, color: '#cfe0ff' }); t.position.set(xw(e), -.5, 1.9); grp.add(t); });
    if (sp.xlab) { const t = X.label(sp.xlab, { size: .5, color: '#ffffff' }); t.position.set(0, -1.2, 1.9); grp.add(t); }
    parts.cnt = cnt.map((c, i) => { const t = X.label(String(c), { size: .42, color: '#ffe9a0' }); t.position.set((xw(edges[i]) + xw(edges[i + 1])) / 2, c * sh + .55, 0); t.visible = false; grp.add(t); return t; });
    const mean = M.mean(d), med = M.median(d), sd = M.std(d), H = Math.max(maxc * sh, 3) + 1.4, plane = (v, col, w, op) => { const m = new T.Mesh(new T.BoxGeometry(w, H, 2.8), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false })); m.position.set(xw(v), H / 2, 0); grp.add(m); return m; };
    parts.mean = plane(mean, 0xe0701c, .09, .9); parts.median = plane(med, 0x16b383, .09, .9); parts.sd = plane(mean, 0xe0701c, 2 * sd * u, .18); parts.sd2 = plane(mean, 0xe0701c, 4 * sd * u, .08);
    parts.lm = X.label('mean ' + Math.round(mean * 100) / 100, { size: .5, color: '#ffb37a' }); parts.lm.position.set(xw(mean), H + .4, 0); grp.add(parts.lm); parts.lmed = X.label('median ' + Math.round(med * 100) / 100, { size: .5, color: '#7fe3bd' }); parts.lmed.position.set(xw(med), H + 1.1, 0); grp.add(parts.lmed);
    const pts = []; for (let i = 0; i <= 120; i++) { const v = lo + (hi - lo) * i / 120, yv = d.length * ((hi - lo) / (edges.length - 1)) * Math.exp(-.5 * Math.pow((v - mean) / sd, 2)) / (sd * Math.sqrt(2 * Math.PI)); pts.push(new T.Vector3(xw(v), yv * sh, 1.5)); }
    parts.norm = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0xffa04d })); grp.add(parts.norm);
    info = { n: d.length, mean, med, sd }; vis(); X.setCam({ th: .5, ph: 1.15, ty: 2.6 }); X.fit(WID / 2 + 2, 4.6);
    X.info('<b>' + d.length + ' values</b> in ' + cnt.length + ' ranges · mean <b>' + Math.round(mean * 100) / 100 + '</b> · median <b>' + Math.round(med * 100) / 100 + '</b> · std <b>' + Math.round(sd * 100) / 100 + '</b><br><span class="pic3-note">Each cube is one value; it falls into its range. Move the slider to change the ranges.</span>');
  };
  const vis = () => { parts.mean.visible = parts.lm.visible = flags.mean; parts.median.visible = parts.lmed.visible = flags.median; parts.sd.visible = flags.sd; parts.sd2.visible = flags.sd && (sp.show || []).includes('sd2'); parts.norm.visible = flags.normal; };
  ctl.append(h('div', { class: 'pic3-row' }, pc3dRange(4, 24, 1, nb, v => { nb = v; reb = true; build(); }, 'ranges'), pc3dBtn('mean', v => { flags.mean = v; vis(); }, flags.mean), pc3dBtn('median', v => { flags.median = v; vis(); }, flags.median), pc3dBtn('spread (std)', v => { flags.sd = v; vis(); }, flags.sd), pc3dBtn('bell curve', v => { flags.normal = v; vis(); }, flags.normal), pc3dBtn('↻ drop again', () => { lt = 0; })));
  build();
  return { update(dt) {
    lt += dt; if (lt > 4) { if (lt < 4.2) parts.cnt.forEach(t => { t.visible = true; }); return; }
    items.forEach((it, i) => { const p = pjClamp((lt - it.rank / items.length * 2.2) / .6, 0, 1), y = (it.k + .5) * shv; dummy.position.set(it.cx, y + (1 - p * p) * 11, 0); dummy.scale.set(it.bw, shv * .96, 2.4); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.instanceMatrix.needsUpdate = true; if (lt > 2.9) parts.cnt.forEach(t => { t.visible = true; });
  } };
};

/* ---------------- regress: points, a line, mistakes, squares, learning on a loss surface, curves ---------------- */
PIC3.scenes.regress = (T, X, sp) => {
  const M = PIC.math, ctl = X.ctl, pts = sp.pts || [], test = sp.test || [], xr = sp.xr || [0, 10], yr = sp.yr || [0, 10], mode = sp.mode || 'guess', WX = 12, WY = 7, grp = new T.Group(); X.world.add(grp);
  const B = pc3dBoard(T, X, grp, xr, yr, WX, WY, sp.xlab, sp.ylab), sx = B.sx, sy = B.sy, V = (x, y, z) => new T.Vector3(sx(x), sy(y), z || 0);
  pts.forEach(p => { const s = new T.Mesh(new T.SphereGeometry(.17, 16, 12), pc3dMat(T, 0x4f86ff)); s.position.copy(V(p[0], p[1], .05)); s.castShadow = true; grp.add(s); });
  test.forEach(p => { const s = new T.Mesh(new T.SphereGeometry(.2, 14, 10), new T.MeshBasicMaterial({ color: 0xcfe0ff, wireframe: true })); s.position.copy(V(p[0], p[1], .05)); grp.add(s); });
  const line = new T.Mesh(new T.CylinderGeometry(.06, .06, 1, 10), pc3dMat(T, 0x16b383, { emissive: 0x053f2e })); line.visible = false; grp.add(line);
  const res = pts.map(() => { const m = new T.Mesh(new T.CylinderGeometry(.04, .04, 1, 8), new T.MeshBasicMaterial({ color: 0xff8a3d })); m.visible = false; grp.add(m); return m; });
  const sqs = pts.map(() => { const m = new T.Mesh(new T.BoxGeometry(1, 1, .3), new T.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: .3 })); m.visible = false; grp.add(m); return m; });
  const showRes = mode === 'resid' || mode === 'squares', showSq = mode === 'squares'; let w = sp.line ? sp.line[0] : 0, b = sp.line ? sp.line[1] : 0, lt = 0, tr = null, ball = null, trail = null, surf = null;
  const setLine = (ww, bb) => { w = ww; b = bb; line.visible = true; pc3dSet(T, line, V(xr[0], w * xr[0] + b, .03), V(xr[1], w * xr[1] + b, .03)); pts.forEach((p, i) => { const yh = w * p[0] + b, r = Math.abs(sy(p[1]) - sy(yh)); if (showRes) { res[i].visible = true; pc3dSet(T, res[i], V(p[0], p[1], .04), V(p[0], yh, .04)); } if (showSq) { sqs[i].visible = true; sqs[i].scale.set(Math.max(.01, r), Math.max(.01, r), .3); sqs[i].position.set(sx(p[0]) + r / 2, (sy(p[1]) + sy(yh)) / 2, .02); } }); };
  const fm = v => String(Math.round(v * 100) / 100);
  const report = () => X.info('y = <b>' + fm(w) + '</b>·x + <b>' + fm(b) + '</b> &nbsp; mean squared mistake (MSE) = <b>' + fm(M.mse(pts, w, b)) + '</b>' + (showRes ? '<br><span class="pic3-note">orange sticks = the mistakes' + (showSq ? ', orange squares = the mistakes squared' : '') + '</span>' : ''));
  let upd = () => { };
  if (mode === 'poly') {
    const f = M.polyfit(pts.map(p => p[0]), pts.map(p => p[1]), sp.deg), cp = []; for (let i = 0; i <= 160; i++) { const x = xr[0] + (xr[1] - xr[0]) * i / 160; cp.push(V(x, pjClamp(f(x), yr[0] - (yr[1] - yr[0]) * .15, yr[1] + (yr[1] - yr[0]) * .15), .03)); }
    grp.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(cp), 200, .06, 8), pc3dMat(T, 0x16b383, { emissive: 0x053f2e })));
    const tr_ = M.mean(pts.map(p => Math.pow(f(p[0]) - p[1], 2))), te = test.length ? M.mean(test.map(p => Math.pow(f(p[0]) - p[1], 2))) : null;
    X.info('degree <b>' + sp.deg + '</b>: error on the solid dots (learned from) <b>' + tr_.toFixed(4) + '</b>' + (te != null ? '<br>error on the hollow dots (new) <b>' + te.toFixed(4) + '</b>' : ''));
  } else if (mode === 'learn') {
    tr = M.gd(pts, sp.line[0], sp.line[1], sp.lr, sp.steps); const n = pts.length; let sxy = 0, sxx = 0, mx = M.mean(pts.map(p => p[0])), my = M.mean(pts.map(p => p[1])); pts.forEach(p => { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) * (p[0] - mx); }); const wo = sxy / sxx, bo = my - wo * mx, A = Math.max(Math.abs(sp.line[0] - wo), 1) * 1.25, Bn = Math.max(Math.abs(sp.line[1] - bo), 1) * 1.25;
    const wr = [wo - A, wo + A], br = [bo - Bn, bo + Bn], N = 36, g = new T.PlaneGeometry(7, 7, N, N); g.rotateX(-Math.PI / 2); const pa = g.attributes.position, col = new Float32Array(pa.count * 3); let lmax = 0; const Lv = [];
    for (let i = 0; i < pa.count; i++) { const ww = wr[0] + (pa.getX(i) / 7 + .5) * (wr[1] - wr[0]), bb = br[0] + (pa.getZ(i) / 7 + .5) * (br[1] - br[0]), L = Math.log(1 + M.mse(pts, ww, bb)); Lv.push(L); lmax = Math.max(lmax, L); }
    for (let i = 0; i < pa.count; i++) { pa.setY(i, Lv[i] / lmax * 4); const c = new T.Color().setHSL(.5 - .5 * Lv[i] / lmax, .75, .5); col.set([c.r, c.g, c.b], i * 3); } g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals();
    surf = new T.Group(); surf.position.set(11.5, 0, 0); surf.add(new T.Mesh(g, new T.MeshPhongMaterial({ vertexColors: true, side: T.DoubleSide, shininess: 30 }))); grp.add(surf);
    const P = t => new T.Vector3((t.w - wr[0]) / (wr[1] - wr[0]) * 7 - 3.5, Math.log(1 + t.loss) / lmax * 4 + .22, (t.b - br[0]) / (br[1] - br[0]) * 7 - 3.5);
    ball = new T.Mesh(new T.SphereGeometry(.22, 16, 12), pc3dMat(T, 0xffd23f, { emissive: 0x6b4a00 })); surf.add(ball); trail = new T.Line(new T.BufferGeometry().setFromPoints(tr.map(P)), new T.LineBasicMaterial({ color: 0xffffff })); trail.geometry.setDrawRange(0, 1); surf.add(trail);
    const sl = t => { const l = X.label(t, { size: .42, color: '#cfe0ff' }); return l; }; const l1 = sl('slope w'), l2 = sl('intercept b'), l3 = sl('error'); l1.position.set(11.5, -.3, 4.1); l2.position.set(15.7, -.3, 0); l3.position.set(11.5, 4.7, 0); grp.add(l1, l2, l3);
    upd = (dt) => { lt += dt; const i = Math.min(sp.steps, Math.floor(lt / (sp.ms ? sp.ms / 1000 : 7) * sp.steps)), t = tr[i]; setLine(t.w, t.b); ball.position.copy(P(t)); trail.geometry.setDrawRange(0, i + 1); X.info('step <b>' + i + '</b> &nbsp; w = <b>' + fm(t.w) + '</b> &nbsp; b = <b>' + fm(t.b) + '</b> &nbsp; error = <b>' + t.loss.toFixed(3) + '</b><br><span class="pic3-note">left: the line; right: the error for every possible (w, b). The ball rolls downhill.</span>'); };
    X.setCam({ th: .4, ph: 1.2, tx: 5.6, ty: 3 }); X.fit(14.5, 5.5);
  }
  if (mode !== 'poly' && mode !== 'learn') {
    if (sp.line) { setLine(w, b); report(); const w0 = w, b0 = b, wA = Math.max(1, Math.abs(w0)) * 2, bA = Math.max(1, Math.abs(b0)) * 1.2 + (yr[1] - yr[0]) * .1; ctl.append(h('div', { class: 'pic3-row' }, pc3dRange(w0 - wA, w0 + wA, .01, w0, v => { setLine(v, b); report(); }, 'slope w'), pc3dRange(b0 - bA, b0 + bA, .01, b0, v => { setLine(w, v); report(); }, 'start b'), pc3dBtn('↺ back', () => { setLine(w0, b0); report(); }))); }
    else if (sp.joined && pts.length > 1) grp.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => V(p[0], p[1], .03)), false, 'catmullrom', 0), 80, .06, 8), pc3dMat(T, 0x16b383)));
    else X.info(sp.note || (pts.length + ' dots'));
    if (sp.bars) pts.forEach(p => { const m = new T.Mesh(new T.BoxGeometry(.9, sy(p[1]), .6), pc3dMat(T, 0x4f86ff)); m.position.set(sx(p[0]), sy(p[1]) / 2, 0); grp.add(m); });
  } else if (mode === 'learn') ctl.append(h('div', { class: 'pic3-row' }, pc3dBtn('↻ roll again', () => { lt = 0; })));
  if (mode !== 'learn') { X.setCam({ th: .35, ph: 1.25, ty: 3.3 }); X.fit(8.5, 4.6); }
  return { update(dt) { upd(dt); } };
};

/* ---------------- cluster: dots on the floor, diamond centres that walk to the middle of their dots ---------------- */
PIC3.scenes.cluster = (T, X, sp) => {
  const M = PIC.math, ctl = X.ctl, pts = sp.pts, xr = sp.xr, yr = sp.yr, grp = new T.Group(), WX = 12, WZ = 8; X.world.add(grp);
  const sx = x => -WX / 2 + (x - xr[0]) / (xr[1] - xr[0]) * WX, sz = y => WZ / 2 - (y - yr[0]) / (yr[1] - yr[0]) * WZ;
  const km = sp.init ? M.kmeans(pts, sp.init, 30) : null, rounds = sp.rounds == null ? 99 : sp.rounds;
  const fl = new T.Mesh(new T.BoxGeometry(WX + 1.6, .1, WZ + 1.6), pc3dMat(T, 0x17294a)); fl.position.y = -.06; fl.receiveShadow = true; grp.add(fl);
  const gg = []; for (let i = 0; i <= 5; i++) { const x = -WX / 2 + WX * i / 5, z = -WZ / 2 + WZ * i / 5; gg.push(x, 0, -WZ / 2, x, 0, WZ / 2, -WX / 2, 0, z, WX / 2, 0, z); const a = X.label(String(Math.round((xr[0] + (xr[1] - xr[0]) * i / 5) * 10) / 10), { size: .36, color: '#b9c8e6' }); a.position.set(x, 0, WZ / 2 + .7); grp.add(a); const c = X.label(String(Math.round((yr[1] - (yr[1] - yr[0]) * i / 5) * 10) / 10), { size: .36, color: '#b9c8e6' }); c.position.set(-WX / 2 - .8, 0, -WZ / 2 + WZ * i / 5); grp.add(c); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(gg, 3)); grp.add(new T.LineSegments(g, new T.LineBasicMaterial({ color: 0x6f8fd0, transparent: true, opacity: .3 })));
  [[sp.xlab, 0, WZ / 2 + 1.5], [sp.ylab, -WX / 2 - 2.2, 0]].forEach(a => { if (a[0]) { const t = X.label(a[0], { size: .44, color: '#fff' }); t.position.set(a[1], 0, a[2]); grp.add(t); } });
  const dots = pts.map(p => { const m = new T.Mesh(new T.SphereGeometry(.22, 16, 12), pc3dMat(T, 0x9aa5b4)); m.position.set(sx(p[0]), .24, sz(p[1])); m.castShadow = true; grp.add(m); return m; });
  const cents = (sp.init || []).map((c, k) => { const m = new T.Mesh(new T.OctahedronGeometry(.55), pc3dMat(T, new T.Color(pc3dCol[k]).getHex(), { emissive: new T.Color(pc3dCol[k]).multiplyScalar(.25).getHex() })); m.scale.y = 1.5; m.castShadow = true; m.position.set(sx(c[0]), 1.0, sz(c[1])); grp.add(m); return m; });
  const lines = pts.map(() => { const m = new T.Mesh(new T.CylinderGeometry(.025, .025, 1, 6), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .45 })); m.visible = false; grp.add(m); return m; });
  const states = []; if (km) { states.push({ cents: sp.init, assign: null }); km.hist.forEach((h2, r) => { if (r >= rounds) return; states.push({ cents: h2.from, assign: h2.assign, round: r + 1, what: 'assign' }); states.push({ cents: h2.to, assign: h2.assign, round: r + 1, what: 'move' }); }); }
  let idx = 0, from = null, tween = 1, auto = true, wait = 1.2; const cur = (km ? sp.init : []).map(c => c.slice());
  const apply = () => { const s = states[idx]; dots.forEach((d, i) => { d.material.color.set(s.assign ? pc3dCol[s.assign[i]] : '#9aa5b4'); }); lines.forEach((l, i) => { l.visible = !!s.assign && s.what === 'assign' || (!!s.assign && s.what === 'move'); if (s.assign) pc3dSet(T, l, dots[i].position, new T.Vector3(sx(s.what === 'move' ? s.cents[s.assign[i]][0] : s.cents[s.assign[i]][0]), 1, sz(s.cents[s.assign[i]][1]))); }); from = cur.map(c => c.slice()); tween = 0;
    X.info(s.what === 'assign' ? 'round <b>' + s.round + '</b>: every dot joins its <b>nearest</b> centre (lines)' : s.what === 'move' ? 'then each centre moves to the <b>middle</b> of its dots' : (km ? 'the dots and three starting centres' : 'the dots: no groups yet')); };
  if (km) { apply(); ctl.append(h('div', { class: 'pic3-row' }, pc3dBtn('▶ next step', () => { if (idx < states.length - 1) { idx++; apply(); wait = 99; } }), pc3dBtn('↻ restart', () => { idx = 0; cur.forEach((c, k) => { c[0] = sp.init[k][0]; c[1] = sp.init[k][1]; }); apply(); wait = 1.2; auto = true; }), pc3dBtn('auto', v => { auto = v; wait = 0; }, true))); } else X.info('the dots: nobody has told us any groups');
  X.setCam({ th: .55, ph: 1.0, ty: 0 }); X.fit(9, 5.2);
  return { update(dt) {
    if (!km) return; tween = Math.min(1, tween + dt / .9); const s = states[idx], e = pjEase(tween);
    cents.forEach((m, k) => { const t = s.cents[k], f = from[k]; cur[k][0] = f[0] + (t[0] - f[0]) * e; cur[k][1] = f[1] + (t[1] - f[1]) * e; m.position.set(sx(cur[k][0]), 1.0 + Math.sin(performance.now() / 500 + k) * .08, sz(cur[k][1])); m.rotation.y += dt; });
    if (auto && tween >= 1) { wait += dt; if (wait > 1.4 && idx < states.length - 1) { idx++; apply(); wait = 0; } }
    lines.forEach((l, i) => { if (l.visible && s.assign) { const c = s.what === 'move' ? new T.Vector3(sx(cur[s.assign[i]][0]), 1, sz(cur[s.assign[i]][1])) : new T.Vector3(sx(s.cents[s.assign[i]][0]), 1, sz(s.cents[s.assign[i]][1])); pc3dSet(T, l, dots[i].position, c); } });
  } };
};

/* ---------------- tree: cuts as walls on the floor, a tree of questions floating behind ---------------- */
PIC3.scenes.tree = (T, X, sp) => {
  const M = PIC.math, ctl = X.ctl, nodes = M.tree(sp.pts, sp.classes.length, sp.depth, [sp.xr[0], sp.xr[1], sp.yr[0], sp.yr[1]]), spl = nodes.filter(n => n.split).sort((a, b) => a.depth - b.depth || a.id - b.id), WX = 12, WZ = 8;
  let upto = sp.upto == null ? spl.length : sp.upto, grp, lt = 0;
  const sx = x => -WX / 2 + (x - sp.xr[0]) / (sp.xr[1] - sp.xr[0]) * WX, sz = y => WZ / 2 - (y - sp.yr[0]) / (sp.yr[1] - sp.yr[0]) * WZ;
  const build = () => {
    if (grp) { X.world.remove(grp); X.dispose(grp); } grp = new T.Group(); X.world.add(grp); lt = 0;
    const shown = new Set(spl.slice(0, upto).map(n => n.id)), vis = new Set([0]); nodes.forEach(n => { if (n.split && shown.has(n.id)) { vis.add(n.left.id); vis.add(n.right.id); } }); const open = n => n.split && shown.has(n.id);
    const fl = new T.Mesh(new T.BoxGeometry(WX + 1.6, .1, WZ + 1.6), pc3dMat(T, 0x17294a)); fl.position.y = -.06; fl.receiveShadow = true; grp.add(fl);
    nodes.filter(n => vis.has(n.id) && !open(n)).forEach(n => { const b = n.bounds, w = (sx(b[1]) - sx(b[0])), dpt = (sz(b[2]) - sz(b[3])), m = new T.Mesh(new T.BoxGeometry(w - .06, .06, dpt - .06), new T.MeshBasicMaterial({ color: new T.Color(pc3dCol[n.pred]), transparent: true, opacity: .28 })); m.position.set((sx(b[0]) + sx(b[1])) / 2, .02, (sz(b[2]) + sz(b[3])) / 2); grp.add(m); });
    nodes.filter(open).forEach(n => { const b = n.bounds, t = n.split.th, wall = n.split.f === 0 ? new T.Mesh(new T.BoxGeometry(.1, 2.6, sz(b[2]) - sz(b[3])), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .28 })) : new T.Mesh(new T.BoxGeometry(sx(b[1]) - sx(b[0]), 2.6, .1), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .28 })); if (n.split.f === 0) wall.position.set(sx(t), 1.3, (sz(b[2]) + sz(b[3])) / 2); else wall.position.set((sx(b[0]) + sx(b[1])) / 2, 1.3, sz(t)); grp.add(wall); const lab = X.label(sp.names[n.split.f] + ' ≤ ' + Math.round(t * 100) / 100, { size: .42, color: '#ffffff' }); lab.position.set(n.split.f === 0 ? sx(t) : (sx(b[0]) + sx(b[1])) / 2, 2.9, n.split.f === 0 ? sz(b[3]) - .2 : sz(t)); grp.add(lab); });
    sp.pts.forEach(p => { const m = new T.Mesh(new T.SphereGeometry(.24, 16, 12), pc3dMat(T, new T.Color(pc3dCol[p[2]]).getHex())); m.position.set(sx(p[0]), .28, sz(p[1])); m.castShadow = true; grp.add(m); });
    [[sp.names[0], 0, WZ / 2 + 1.1], [sp.names[1], -WX / 2 - 1.4, 0]].forEach(a => { const t = X.label(a[0], { size: .46, color: '#fff' }); t.position.set(a[1], 0, a[2]); grp.add(t); });
    /* the tree of questions */
    const slots = {}; let slot = 0; const lay = n => { if (!open(n)) { slots[n.id] = slot++; return; } lay(n.left); lay(n.right); slots[n.id] = (slots[n.left.id] + slots[n.right.id]) / 2; }; lay(nodes[0]); const tx = i => (slot > 1 ? -5.5 + i * 11 / (slot - 1) : 0), ty = d => 9 - d * 2.2, TZ = -WZ / 2 - 3.4;
    nodes.filter(n => vis.has(n.id)).forEach(n => {
      const x = tx(slots[n.id]), y = ty(n.depth), isOpen = open(n), box = new T.Mesh(new T.BoxGeometry(2.7, 1.3, .5), pc3dMat(T, isOpen ? 0x2a3f6a : new T.Color(pc3dCol[n.pred]).getHex(), { transparent: true, opacity: .92 })); box.position.set(x, y, TZ); box.castShadow = true; grp.add(box);
      const l1 = X.label(isOpen ? sp.names[n.split.f] + ' ≤ ' + Math.round(n.split.th * 100) / 100 + '?' : sp.classes[n.pred], { size: .46, color: '#fff', depthTest: false }); l1.position.set(x, y + .2, TZ + .35); grp.add(l1); const l2 = X.label('n=' + n.n + '  gini ' + n.gini.toFixed(2), { size: .3, color: '#cfe0ff', depthTest: false }); l2.position.set(x, y - .35, TZ + .35); grp.add(l2);
      if (isOpen) [n.left, n.right].forEach(c => { grp.add(pc3dCyl(T, new T.Vector3(x, y - .65, TZ), new T.Vector3(tx(slots[c.id]), ty(c.depth) + .65, TZ), .035, new T.MeshBasicMaterial({ color: 0x9fb4dd }))); });
    });
    const right = nodes.filter(n => vis.has(n.id) && !open(n) && n.gini === 0).length; X.info(upto === 0 ? 'no questions yet: one box that guesses <b>' + sp.classes[nodes[0].pred] + '</b> for everybody' : '<b>' + upto + '</b> question' + (upto > 1 ? 's' : '') + ' asked · <b>' + right + '</b> pure boxes<br><span class="pic3-note">white walls = the cuts, tiles = the boxes, floating tree = the questions</span>');
  };
  ctl.append(h('div', { class: 'pic3-row' }, pc3dBtn('− a question', () => { if (upto > 0) { upto--; build(); } }), pc3dBtn('+ a question', () => { if (upto < spl.length) { upto++; build(); } })));
  build(); X.setCam({ th: .5, ph: 1.12, ty: 3.5 }); X.fit(8.5, 7);
  return { update(dt) { lt += dt; } };
};

/* ---------------- conv: an image as pillars, a window sliding over it, the result growing beside it ---------------- */
PIC3.scenes.conv = (T, X, sp) => {
  const M = PIC.math, ctl = X.ctl, img = sp.img, k = sp.kernel, F = M.conv2d(img, k), R = M.relu(F), P = M.pool(R, 2), view = sp.view || 'conv', src = view === 'conv' ? img : view === 'relu' ? F : R, out = view === 'conv' ? F : view === 'relu' ? R : P, win = view === 'conv' ? k.length : view === 'pool' ? 2 : 1, step = view === 'pool' ? 2 : 1, grp = new T.Group(); X.world.add(grp);
  const smax = Math.max.apply(null, [].concat.apply([], src).map(Math.abs).concat(1)), omax = Math.max.apply(null, [].concat.apply([], out).map(Math.abs).concat(1)), n = src.length, m = src[0].length, no = out.length, mo = out[0].length, GAP = 2.4, ox = n / 2 + GAP + mo / 2 + 1;
  const pillar = (v, mx, color, x, z) => { const hgt = Math.max(.04, Math.abs(v) / mx * 2.6), b = new T.Mesh(new T.BoxGeometry(.86, hgt, .86), pc3dMat(T, color)); b.position.set(x, v < 0 ? -hgt / 2 : hgt / 2, z); b.castShadow = true; grp.add(b); return b; };
  const sc = src.map((r, i) => r.map((v, j) => pillar(view === 'conv' ? Math.max(v, .01) : v, smax, view === 'conv' ? new T.Color().setHSL(.6, .15, .3 + v / 9 * .5).getHex() : v < 0 ? 0xe0701c : 0x2457d6, j - (m - 1) / 2, i - (n - 1) / 2)));
  const oc = out.map((r, i) => r.map((v, j) => { const b = pillar(v, omax, v < 0 ? 0xe0701c : v > 0 ? 0x2457d6 : 0x34456b, ox + j - (mo - 1) / 2, i - (no - 1) / 2); b.visible = false; return b; }));
  const frame = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(win, 3.1, win)), new T.LineBasicMaterial({ color: 0xff8a3d })); frame.position.y = 1.4; grp.add(frame);
  const fl = new T.Mesh(new T.BoxGeometry(m + 1.2, .1, n + 1.2), pc3dMat(T, 0x17294a)); fl.position.set(0, -.06, 0); grp.add(fl); const fo = new T.Mesh(new T.BoxGeometry(mo + 1.2, .1, no + 1.2), pc3dMat(T, 0x17294a)); fo.position.set(ox, -.06, 0); grp.add(fo);
  const t1 = X.label(view === 'conv' ? 'image' : view === 'relu' ? 'filter result' : 'after ReLU', { size: .5, color: '#fff' }); t1.position.set(0, 0, n / 2 + 1.1); grp.add(t1); const t2 = X.label(view === 'conv' ? 'filter result' : view === 'relu' ? 'after ReLU' : 'after max-pool', { size: .5, color: '#fff' }); t2.position.set(ox, 0, no / 2 + 1.1); grp.add(t2);
  if (view === 'conv') { const kt = X.label('filter ' + k.map(r => r.join(' ')).join(' / '), { size: .4, color: '#ffb37a' }); kt.position.set(0, 0, -n / 2 - 1.2); grp.add(kt); }
  const tot = no * mo; let pos = 0, auto = true, lt = 0, shown = -1;
  const set = p => { pos = pjClamp(Math.round(p), 0, tot - 1); for (let q = 0; q < tot; q++) oc[Math.floor(q / mo)][q % mo].visible = q <= pos; const i = Math.floor(pos / mo), j = pos % mo; frame.position.set((j * step + (win - 1) / 2) - (m - 1) / 2, 1.4, (i * step + (win - 1) / 2) - (n - 1) / 2);
    if (view === 'conv') { const terms = []; for (let u = 0; u < k.length; u++) for (let v = 0; v < k[0].length; v++) terms.push(src[i + u][j + v] * k[u][v]); X.info('<b>' + (terms.filter(t => t !== 0).map(t => (t < 0 ? '(' + t + ')' : t)).join(' + ') || '0') + ' = ' + out[i][j] + '</b><br><span class="pic3-note">window position ' + (pos + 1) + ' of ' + tot + '</span>'); } else X.info(view === 'relu' ? Math.round(F[i][j]) + ' → <b>' + out[i][j] + '</b>' : 'biggest of the 2×2 block = <b>' + out[i][j] + '</b>'); };
  ctl.append(h('div', { class: 'pic3-row' }, pc3dRange(0, tot - 1, 1, 0, v => { auto = false; set(v); }, 'window position'), pc3dBtn('↻ slide again', () => { auto = true; lt = 0; set(0); })));
  set(0); X.setCam({ th: .5, ph: 1.0, tx: ox / 2, ty: 1 }); X.fit(ox / 2 + m / 2 + 1.5, 4);
  return { update(dt) { if (!auto) return; lt += dt; const p = Math.floor(lt / 4.2 * tot); if (p !== shown && p < tot) { shown = p; set(p); } } };
};

/* ---------------- table (and matrix): rows of numbered tiles ---------------- */
PIC3.scenes.table = (T, X, sp) => {
  const ctl = X.ctl, grp = new T.Group(); X.world.add(grp); let lt = 0;
  const tiles = [], put = (txt, x, z, w, col, y, pop, op) => { const t = new T.Mesh(new T.BoxGeometry(w, .22, .86), pc3dMat(T, col, op)); t.position.set(x, y || 0, z); t.castShadow = true; grp.add(t); const l = X.label(String(txt), { size: .46, color: '#fff', depthTest: false }); l.scale.multiplyScalar(Math.min(1, (w * .94) / l.scale.x)); l.position.set(x, (y || 0) + .5, z + .05); grp.add(l); tiles.push({ t, l, pop, y: y || 0 }); return t; };
  if (sp.matrices) {
    let x0 = 0, maxR = 1; sp.matrices.forEach(mx => { const R = mx.m.length, C = mx.m[0].length; maxR = Math.max(maxR, R); const lab = X.label(mx.name, { size: .5, color: '#ffe9a0' }); lab.position.set(x0 + (C - 1) * .6, 0, -.9); grp.add(lab); mx.m.forEach((r, i) => r.forEach((v, j) => put(Math.round(v * 100) / 100, x0 + j * 1.2, i * 1.05, 1.1, mx.color === 'orange' ? 0xe0701c : mx.color === 'green' ? 0x0f8a5f : 0x2457d6, 0, i * 4 + j))); x0 += C * 1.2 + 1.6; });
    X.setCam({ th: .35, ph: .95, tx: (x0 - 1.6) / 2 - .6, ty: 0, tz: (maxR - 1) / 2 * 1.05 }); X.fit(Math.max(4, x0 / 2 + 1), Math.max(3, maxR * .8)); X.info(sp.cap || 'each tile is one number');
  } else {
    const cols = sp.cols, rows = sp.rows, w = cols.map((c, j) => Math.max(1.5, ...[String(c)].concat(rows.map(r => String(r[j]))).map(s => s.length * .26 + .6))), xs = []; let acc = 0; w.forEach(v => { xs.push(acc + v / 2); acc += v + .12; });
    cols.forEach((c, j) => put(c, xs[j] - acc / 2, -1.05, w[j], 0x1f3a6e, .05)); rows.forEach((r, i) => r.forEach((v, j) => { const hot = (sp.hlRows || []).includes(i) || (sp.hlCols || []).includes(cols[j]) || (sp.cells && sp.cells[i + ',' + j]), dim = (sp.dimRows || []).includes(i), nw = (sp.newRows || []).includes(i); put(v, xs[j] - acc / 2, i * 1.05, w[j], hot ? 0xe0701c : dim ? 0x2a3350 : 0x2d4f8f, hot ? .35 : 0, nw ? i : null, dim ? { transparent: true, opacity: .55 } : null); }));
    X.setCam({ th: .18, ph: .6, ty: 0, tz: (rows.length - 1) * .5 }); X.fit(Math.max(5, acc / 2 + 1), Math.max(3.5, rows.length * .62)); X.info(sp.cap || (rows.length + ' rows × ' + cols.length + ' columns'));
  }
  ctl.append(h('div', { class: 'pic3-row' }, pc3dBtn('↻ pop in again', () => { lt = 0; })));
  return { update(dt) { lt += dt; tiles.forEach(o => { const p = pjClamp((lt - (o.pop == null ? 0 : o.pop * .09)) / .5, 0, 1); o.t.scale.y = .2 + .8 * p; o.t.position.y = o.y + (1 - p) * 4; o.l.position.y = o.t.position.y + .5; o.t.visible = o.l.visible = p > 0; }); } };
};

/* ---------------- trace: code stepping through memory ---------------- */
PIC3.scenes.trace = (T, X, sp) => {
  const ctl = X.ctl, grp = new T.Group(), S = sp.states, lists = sp.lists || [], names = []; X.world.add(grp); S.forEach(s => Object.keys(s.vars || {}).forEach(k => { if (names.indexOf(k) < 0) names.push(k); }));
  const cells = {}; lists.forEach((L, li) => { const z = -2.4 - li * 1.8, lab = X.label(L.name, { size: .5, color: '#ffe9a0' }); lab.position.set(-(L.items.length) * .65 - .6, .1, z); grp.add(lab); cells[L.name] = L.items.map((v, i) => { const b = new T.Mesh(new T.BoxGeometry(1.2, .5, 1.1), pc3dMat(T, 0x2d4f8f)); b.position.set(i * 1.3 - (L.items.length - 1) * .65, .25, z); b.castShadow = true; grp.add(b); const t = X.label(String(v), { size: .55, color: '#fff', depthTest: false }); t.position.set(b.position.x, .8, z + .1); grp.add(t); const ix = X.label(String(i), { size: .3, color: '#9fb4dd' }); ix.position.set(b.position.x, 0, z + .75); grp.add(ix); return b; }); });
  const vars = {}; names.forEach((k, i) => { const x = (i - (names.length - 1) / 2) * 3.0, b = new T.Mesh(new T.BoxGeometry(2.4, .9, 1.4), pc3dMat(T, 0x2457d6)); b.position.set(x, .45, 1.6); b.castShadow = true; grp.add(b); const nm = X.label(k, { size: .44, color: '#ffe9a0' }); nm.position.set(x, 1.3, 1.6); grp.add(nm); const val = X.label('—', { size: .6, color: '#fff', depthTest: false, sample: '"Asha" 0.000' }); val.position.set(x, .6, 2.35); grp.add(val); vars[k] = { b, val, v: '—' }; });
  const ptr = new T.Mesh(new T.ConeGeometry(.3, .7, 14), pc3dMat(T, 0xff8a3d, { emissive: 0x663300 })); ptr.rotation.x = Math.PI; ptr.visible = false; grp.add(ptr);
  let idx = -1, auto = true, wait = 1; const go = i => { idx = pjClamp(i, 0, S.length - 1); const s = S[idx]; Object.keys(s.vars || {}).forEach(k => { const v = String(s.vars[k]); if (vars[k].v !== v) { vars[k].val.set(v); vars[k].v = v; vars[k].b.scale.y = 1.6; } }); Object.keys(cells).forEach(n => cells[n].forEach(c => { c.material.color.setHex(0x2d4f8f); c.position.y = .25; })); ptr.visible = false; if (s.ptr && cells[s.ptr.list]) { const c = cells[s.ptr.list][s.ptr.i]; c.material.color.setHex(0xe0701c); c.position.y = .55; ptr.visible = true; ptr.position.set(c.position.x, 1.9, c.position.z); } X.info((s.note || '') + '<br><span class="pic3-note">step ' + (idx + 1) + ' of ' + S.length + '</span>'); };
  ctl.append(h('div', { class: 'pic3-row' }, pc3dBtn('◀ back', () => { auto = false; go(idx - 1); }), pc3dBtn('next ▶', () => { auto = false; go(idx + 1); }), pc3dBtn('↻ replay', () => { names.forEach(k => { vars[k].val.set('—'); vars[k].v = '—'; }); idx = -1; auto = true; wait = 0; })));
  X.setCam({ th: .35, ph: 1.08, ty: .6 }); X.fit(Math.max(5, names.length * 1.6), 3.6);
  return { update(dt) { Object.keys(vars).forEach(k => { vars[k].b.scale.y += (1 - vars[k].b.scale.y) * Math.min(1, dt * 6); }); if (auto) { wait -= dt; if (wait <= 0 && idx < S.length - 1) { go(idx + 1); wait = (sp.ms || 1100) / 1000 + .3; } } if (ptr.visible) ptr.position.y = 1.9 + Math.sin(performance.now() / 300) * .12; } };
};

/* ---------------- pipeline: stations on a belt (one belt per lane), chips riding along ---------------- */
PIC3.scenes.pipeline = (T, X, sp) => {
  const ctl = X.ctl, grp = new T.Group(), lanes = sp.lanes || [{ name: '', stations: sp.stations, tokens: sp.tokens }], GAP = 4.2, LZ = 6.5, parts = []; X.world.add(grp); let lt = 0;
  lanes.forEach((ln, k) => {
    const st = ln.stations, n = st.length, x0 = -(n - 1) * GAP / 2, z0 = (k - (lanes.length - 1) / 2) * LZ;
    const belt = new T.Mesh(new T.BoxGeometry((n - 1) * GAP + 3, .25, 1.6), pc3dMat(T, 0x1d2c4d)); belt.position.set(0, -.12, z0 + 1); belt.receiveShadow = true; grp.add(belt);
    if (ln.name) { const t = X.label(ln.name, { size: .5, color: '#ffe9a0' }); t.position.set(x0 - 1.5, .2, z0 + 3.2); grp.add(t); }
    const boxes = st.map((s, i) => { const b = new T.Mesh(new T.BoxGeometry(2.4, 1.6, 2.2), pc3dMat(T, 0x2d4f8f, { transparent: true, opacity: .88 })); b.position.set(x0 + i * GAP, .9, z0 - 1.2); b.castShadow = true; grp.add(b); const t = X.label((s.icon ? s.icon + ' ' : '') + s.name, { size: .46, color: '#fff', depthTest: false }); t.position.set(b.position.x, 2.4, z0 - 1.2); grp.add(t); if (s.sub) { const u = X.label(s.sub, { size: .32, color: '#b9c8e6', depthTest: false }); u.position.set(b.position.x, 1.85, z0 - .1); grp.add(u); } grp.add(pc3dCyl(T, new T.Vector3(b.position.x, .1, z0 - .1), new T.Vector3(b.position.x, .1, z0 + .8), .05, new T.MeshBasicMaterial({ color: 0x5aa8ff }))); return b; });
    const chips = (ln.tokens || []).map((tk, ti) => { const m = new T.Mesh(new T.BoxGeometry(1.5, .7, .9), pc3dMat(T, new T.Color(pc3dCol[ti % 5]).getHex())); m.castShadow = true; grp.add(m); const l = X.label(tk.texts[0], { size: .38, color: '#fff', depthTest: false, sample: tk.texts.reduce((a, b) => (b.length > a.length ? b : a), '') + 'x' }); grp.add(l); return { m, l, tk, ti }; });
    parts.push({ n, x0, z0, boxes, chips, st });
  });
  const show = (k, i) => { parts.forEach((p, pk) => p.boxes.forEach((b, bi) => b.material.color.setHex(pk === k && bi === i ? 0xe0701c : 0x2d4f8f))); const s = parts[k].st[i]; X.info('<b>' + picEsc(s.name) + '</b> ' + (s.sub ? '· ' + picEsc(s.sub) : '') + '<br>' + picEsc(s.does || '')); };
  ctl.append(h('div', { class: 'pic3-col' }, parts.map((p, k) => h('div', { class: 'pic3-row' }, p.st.map((s, i) => pc3dBtn((s.icon || '') + ' ' + s.name, () => show(k, i)))))), h('div', { class: 'pic3-row' }, pc3dBtn('↻ run again', () => { lt = 0; })));
  const nmax = Math.max.apply(null, parts.map(p => p.n)); X.setCam({ th: .4, ph: lanes.length > 1 ? .95 : 1.1, ty: .8 }); X.fit((nmax - 1) * GAP / 2 + 3.5, lanes.length > 1 ? lanes.length * LZ / 2 + 1 : 3.2); X.info(sp.cap || 'press a station to read what it does');
  return { update(dt) { lt += dt; parts.forEach(p => p.chips.forEach(c => { const start = c.ti * .9, q = Math.max(0, (lt - start) / 1.5), x = p.x0 + Math.min(p.n - 1, q) * GAP; c.m.position.set(x, .6, p.z0 + 1); c.l.position.set(x, 1.3, p.z0 + 1); const idx = Math.min(p.n - 1, Math.floor(q + .5)), txt = c.tk.texts[Math.min(idx, c.tk.texts.length - 1)] || ''; if (c.cur !== txt) { c.cur = txt; c.l.set(txt); } c.m.visible = c.l.visible = lt > start; })); } };
};

/* ---------------- arrows: vectors as trips on the ground, with a marker that drives them ---------------- */
PIC3.scenes.arrows = (T, X, sp) => {
  const ctl = X.ctl, grp = new T.Group(); X.world.add(grp); const xr = sp.xr || [-3, 9], yr = sp.yr || [-2, 6], A = sp.arrows || [], COL = { blue: 0x2457d6, orange: 0xe0701c, green: 0x0f8a5f, red: 0xcb3a46, purple: 0x7a4fd0, gray: 0x6b7a90 };
  const P = (x, y) => new T.Vector3(x - (xr[0] + xr[1]) / 2, .16, -(y - (yr[0] + yr[1]) / 2));
  const gg = []; for (let x = Math.ceil(xr[0]); x <= xr[1]; x++) gg.push(P(x, yr[0]).x, 0, P(0, yr[0]).z, P(x, yr[1]).x, 0, P(0, yr[1]).z); for (let y = Math.ceil(yr[0]); y <= yr[1]; y++) gg.push(P(xr[0], y).x, 0, P(0, y).z, P(xr[1], y).x, 0, P(0, y).z);
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(gg, 3)); grp.add(new T.LineSegments(g, new T.LineBasicMaterial({ color: 0x6f8fd0, transparent: true, opacity: .35 })));
  const fl = new T.Mesh(new T.BoxGeometry(xr[1] - xr[0] + 1, .1, yr[1] - yr[0] + 1), pc3dMat(T, 0x17294a)); fl.position.set(0, -.06, 0); fl.receiveShadow = true; grp.add(fl);
  const org = P(0, 0), og = X.label('start (0, 0)', { size: .4, color: '#ffe9a0' }); og.position.set(org.x, .1, org.z + .8); grp.add(og);
  const items = A.map(a => { const col = COL[a.color || 'blue'], a0 = P(a.from[0], a.from[1]), a1 = P(a.to[0], a.to[1]), m = pc3dMat(T, col, { emissive: new T.Color(col).multiplyScalar(.25).getHex() }), shaft = new T.Mesh(new T.CylinderGeometry(.07, .07, 1, 10), m), head = new T.Mesh(new T.ConeGeometry(.2, .5, 14), m); shaft.castShadow = head.castShadow = true; grp.add(shaft, head); const lab = X.label(a.label || '', { size: .42, color: '#fff' }); lab.position.set((a0.x + a1.x) / 2, .9, (a0.z + a1.z) / 2); grp.add(lab); return { a0, a1, shaft, head, lab, ghost: a.dash || a.ghost }; });
  const cart = new T.Mesh(new T.BoxGeometry(.9, .45, .55), pc3dMat(T, 0xd63b2f)); cart.visible = false; cart.castShadow = true; grp.add(cart);
  const legs = A.filter(a => !a.dash && !a.ghost), path = legs.length ? [P(legs[0].from[0], legs[0].from[1])].concat(legs.map(a => P(a.to[0], a.to[1]))) : []; let lt = 0;
  ctl.append(h('div', { class: 'pic3-row' }, pc3dBtn('↻ draw again', () => { lt = 0; })));
  X.setCam({ th: .35, ph: 1.0, ty: 0 }); X.fit(Math.max(5, (xr[1] - xr[0]) / 2 + 1.5), Math.max(3.5, (yr[1] - yr[0]) / 2 + 1.5)); X.info(sp.cap || 'arrows on the floor: each one is a trip');
  return { update(dt) {
    lt += dt; items.forEach((it, i) => { const p = pjClamp((lt - i * 1.1) / 1, 0, 1), e = pjEase(p), tip = new T.Vector3().lerpVectors(it.a0, it.a1, e), dir = new T.Vector3().subVectors(it.a1, it.a0); it.shaft.visible = it.head.visible = it.lab.visible = p > 0; if (p <= 0) return; const back = tip.clone().sub(dir.clone().setLength(.5)); pc3dSet(T, it.shaft, it.a0, p > .02 ? back : it.a0); it.head.position.copy(tip).sub(dir.clone().setLength(.25)); it.head.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize()); });
    if (sp.drive && path.length > 1) { const q = Math.max(0, (lt - items.length * 1.1 - .3) / 1.2), seg = Math.min(path.length - 2, Math.floor(q)); cart.visible = q > 0; if (cart.visible) { const f = Math.min(1, q - seg), pos = new T.Vector3().lerpVectors(path[seg], path[seg + 1], q >= path.length - 1 ? 1 : f); cart.position.set(pos.x, .4, pos.z); cart.rotation.y = -Math.atan2(path[seg + 1].z - path[seg].z, path[seg + 1].x - path[seg].x); } }
  } };
};

/* ---------------- classify: the model's answer at every spot as a landscape, dots on the floor, sliders to ask about a new point ---------------- */
PIC3.scenes.classify = (T, X, sp) => {
  const M = PIC.math, ctl = X.ctl, grp = new T.Group(), WX = 12, WZ = 8, xr = sp.xr, yr = sp.yr, HGT = 3; X.world.add(grp); let k = sp.k || 3, surf = null, mark = null, stick = null, qx = (xr[0] + xr[1]) / 2, qy = (yr[0] + yr[1]) / 2;
  const sx = x => -WX / 2 + (x - xr[0]) / (xr[1] - xr[0]) * WX, sz = y => WZ / 2 - (y - yr[0]) / (yr[1] - yr[0]) * WZ, model = sp.model;
  const prob = (x, y) => (model === 'knn' ? M.knn(sp.pts, x, y, k).p1 : model === 'logistic' ? M.sigmoid(sp.coef[0] * x + sp.coef[1] * y + sp.intercept) : .5);
  const fl = new T.Mesh(new T.BoxGeometry(WX + 1.6, .1, WZ + 1.6), pc3dMat(T, 0x17294a)); fl.position.y = -.06; fl.receiveShadow = true; grp.add(fl);
  sp.pts.forEach(p => { const m = new T.Mesh(new T.SphereGeometry(.24, 16, 12), pc3dMat(T, new T.Color(pc3dCol[p[2] === 1 ? 1 : 0]).getHex())); m.position.set(sx(p[0]), .3, sz(p[1])); m.castShadow = true; grp.add(m); });
  [[sp.xlab, 0, WZ / 2 + 1.1], [sp.ylab, -WX / 2 - 1.6, 0]].forEach(a => { if (a[0]) { const t = X.label(a[0], { size: .46, color: '#fff' }); t.position.set(a[1], 0, a[2]); grp.add(t); } });
  const build = () => {
    if (surf) { grp.remove(surf); X.dispose(surf); } if (!model) return; const N = 44, g = new T.PlaneGeometry(WX, WZ, N, N); g.rotateX(-Math.PI / 2); const pa = g.attributes.position, col = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) { const x = xr[0] + (pa.getX(i) / WX + .5) * (xr[1] - xr[0]), y = yr[0] + (.5 - pa.getZ(i) / WZ) * (yr[1] - yr[0]), p = prob(x, y), c = new T.Color(pc3dCol[p >= .5 ? 1 : 0]); pa.setY(i, p * HGT); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals(); surf = new T.Mesh(g, new T.MeshPhongMaterial({ vertexColors: true, side: T.DoubleSide, transparent: true, opacity: .62, shininess: 30 })); grp.add(surf); ask();
  };
  const ask = () => { if (!model) return; const p = prob(qx, qy); if (mark) { grp.remove(mark); grp.remove(stick); X.dispose(mark); X.dispose(stick); } mark = new T.Mesh(new T.SphereGeometry(.3, 18, 14), pc3dMat(T, 0xffffff, { emissive: 0x666666 })); mark.position.set(sx(qx), p * HGT + .3, sz(qy)); stick = pc3dCyl(T, new T.Vector3(sx(qx), 0, sz(qy)), new T.Vector3(sx(qx), p * HGT, sz(qy)), .04, new T.MeshBasicMaterial({ color: 0xffffff })); grp.add(mark, stick); X.info('hills = how sure the model is of the <b>orange</b> class (height 1 = certain, the flat middle = 50%)<br>new point (' + qx.toFixed(1) + ', ' + qy.toFixed(1) + '): <b>class ' + (p >= .5 ? 1 : 0) + '</b>, probability ' + (p >= .5 ? p : 1 - p).toFixed(2)); };
  if (model) { const row = [pc3dRange(xr[0], xr[1], .1, qx, v => { qx = v; ask(); }, 'new point x'), pc3dRange(yr[0], yr[1], .1, qy, v => { qy = v; ask(); }, 'new point y')]; if (model === 'knn') row.push(pc3dRange(1, 15, 2, k, v => { k = v; build(); }, 'k neighbours')); ctl.append(h('div', { class: 'pic3-row' }, row)); } else X.info('two groups of dots, and no model yet');
  build(); X.setCam({ th: .5, ph: 1.05, ty: 1 }); X.fit(8.5, 5);
  return { update() { } };
};
