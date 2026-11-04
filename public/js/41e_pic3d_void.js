'use strict';
/* =====================================================================
   The DATA VOID: a 3D space with the axes drawn through the origin in every direction (arrows at both ends, numbered ticks), three faint walls, and the data points floating
   inside it. Every point throws a projection onto the three walls, so you can read where it is. Points can be picked up and moved (drag; the buttons choose where it may go),
   and whatever depends on them (the best-fit line, the decision surface, the cluster colours) is recalculated and glides to its new place.
   PIC3.void(T, X, opts) builds the space; regress, classify and cluster use it as their 3D view. The older "board" views are kept behind a button.
   ===================================================================== */
const pc3vFit = (pts, deg, weighted) => {
  const n = pts.length; deg = Math.max(0, Math.min(deg, n - 1)); const m = deg + 1, N = Array.from({ length: m }, () => new Array(m + 1).fill(0));
  for (const p of pts) { const w = weighted ? p.w : 1, pw = [1]; for (let k = 1; k < 2 * m; k++) pw.push(pw[k - 1] * p.x); for (let r = 0; r < m; r++) { for (let c = 0; c < m; c++) N[r][c] += w * pw[r + c]; N[r][m] += w * p.y * pw[r]; } }
  const tiny = 1e-9 * (1 + Math.abs(N[0][0]));
  for (let i = 0; i < m; i++) { let piv = i; for (let r = i + 1; r < m; r++) if (Math.abs(N[r][i]) > Math.abs(N[piv][i])) piv = r; if (Math.abs(N[piv][i]) < tiny) return null; [N[i], N[piv]] = [N[piv], N[i]]; for (let r = i + 1; r < m; r++) { const f = N[r][i] / N[i][i]; for (let c = i; c <= m; c++) N[r][c] -= f * N[i][c]; } }
  const c = new Array(m).fill(0); for (let i = m - 1; i >= 0; i--) { let s = N[i][m]; for (let k = i + 1; k < m; k++) s -= N[i][k] * c[k]; c[i] = s / N[i][i]; }
  return c;
};
const pc3vEval = (c, x) => { let s = 0; for (let k = c.length - 1; k >= 0; k--) s = s * x + c[k]; return s; };
const pc3vNice = span => { const raw = span / 5, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };
const pc3vFmt = v => String(Math.round(v * 100) / 100);

PIC3.void = (T, X, o) => {
  const S = o.size || 10, names = o.names || ['x', 'y', 'z'], R = {};
  ['x', 'y', 'z'].forEach(a => { let [lo, hi] = o.ranges[a]; if (lo >= 0) lo -= (hi - lo) * .14; if (hi <= 0) hi += (hi - lo) * .14; R[a] = [lo, hi]; });
  const grp = new T.Group(); X.world.add(grp);
  const mid = a => (R[a][0] + R[a][1]) / 2, sc = a => S / (R[a][1] - R[a][0]), o0 = a => Math.max(R[a][0], Math.min(R[a][1], 0));
  const P = (x, y, z) => new T.Vector3((x - mid('x')) * sc('x'), (y - mid('y')) * sc('y'), (z - mid('z')) * sc('z'));
  const inv = v => ({ x: v.x / sc('x') + mid('x'), y: v.y / sc('y') + mid('y'), z: v.z / sc('z') + mid('z') });
  const AX = { x: 0xff8a3d, y: 0x16b383, z: 0x5aa8ff }, lineMat = (c, op) => new T.MeshBasicMaterial({ color: c, transparent: op != null, opacity: op == null ? 1 : op });
  const at = (a, v) => P(a === 'x' ? v : o0('x'), a === 'y' ? v : o0('y'), a === 'z' ? v : o0('z'));
  /* the axes, through the origin, in both directions */
  ['x', 'y', 'z'].forEach(a => {
    const lo = at(a, R[a][0]), hi = at(a, R[a][1]), dir = new T.Vector3().subVectors(hi, lo).normalize();
    grp.add(pc3dCyl(T, lo, hi, .035, lineMat(AX[a])));
    const cone = (p, d, op) => { const c = new T.Mesh(new T.ConeGeometry(.15, .45, 14), lineMat(AX[a], op)); c.position.copy(p); c.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d); grp.add(c); };
    cone(hi.clone().add(dir.clone().multiplyScalar(.1)), dir, 1); cone(lo.clone().sub(dir.clone().multiplyScalar(.1)), dir.clone().negate(), .55);
    const nm = X.label(names[['x', 'y', 'z'].indexOf(a)], { size: .5, color: '#' + AX[a].toString(16).padStart(6, '0') }); nm.position.copy(hi.clone().add(dir.clone().multiplyScalar(.95))); grp.add(nm);
    const st = pc3vNice(R[a][1] - R[a][0]); for (let v = Math.ceil(R[a][0] / st) * st; v <= R[a][1] + 1e-9; v += st) {
      const vv = Math.round(v / st) * st, p = at(a, vv), t = X.label(pc3vFmt(vv), { size: .3, color: '#b9c8e6' }); t.position.copy(p).add(a === 'x' ? new T.Vector3(0, -.42, .3) : a === 'y' ? new T.Vector3(-.5, 0, 0) : new T.Vector3(-.5, -.3, 0)); grp.add(t);
      const tk = new T.Mesh(new T.SphereGeometry(.06, 8, 6), lineMat(AX[a])); tk.position.copy(p); grp.add(tk);
    }
  });
  /* three faint walls with grid lines (floor, back, left) */
  const wall = (a, b, c, sideVal) => { const g = [], A = R[a], B = R[b], sa = pc3vNice(A[1] - A[0]), sb = pc3vNice(B[1] - B[0]), at3 = (u, v) => { const q = { [a]: u, [b]: v, [c]: sideVal }; return P(q.x, q.y, q.z); };
    for (let u = Math.ceil(A[0] / sa) * sa; u <= A[1] + 1e-9; u += sa) { const p = at3(u, B[0]), q = at3(u, B[1]); g.push(p.x, p.y, p.z, q.x, q.y, q.z); }
    for (let v = Math.ceil(B[0] / sb) * sb; v <= B[1] + 1e-9; v += sb) { const p = at3(A[0], v), q = at3(A[1], v); g.push(p.x, p.y, p.z, q.x, q.y, q.z); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(g, 3)); grp.add(new T.LineSegments(geo, new T.LineBasicMaterial({ color: 0x6f8fd0, transparent: true, opacity: .2 })));
    const q0 = at3(A[0], B[0]), q1 = at3(A[1], B[0]), q2 = at3(A[1], B[1]), q3 = at3(A[0], B[1]), pl = new T.BufferGeometry(); pl.setAttribute('position', new T.Float32BufferAttribute([q0, q1, q2, q0, q2, q3].flatMap(v => [v.x, v.y, v.z]), 3));
    grp.add(new T.Mesh(pl, new T.MeshBasicMaterial({ color: 0x1b3157, transparent: true, opacity: .22, side: T.DoubleSide, depthWrite: false }))); };
  wall('x', 'z', 'y', R.y[0]); wall('x', 'y', 'z', R.z[0]); wall('z', 'y', 'x', R.x[0]);
  const cube = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(S, S, S)), new T.LineBasicMaterial({ color: 0x8aa0cc, transparent: true, opacity: .3 })); grp.add(cube);

  /* the points, with their projections on the three walls */
  const pts = [], projGeo = new T.BufferGeometry(), proj = new T.LineSegments(projGeo, new T.LineBasicMaterial({ color: 0x9fb2d8, transparent: true, opacity: .3 })); grp.add(proj);
  const tip = X.label('(0, 0, 0)', { size: .38, color: '#ffe9a0', sample: '(-00.00, -00.00, -00.00)', depthTest: false }); tip.visible = false; grp.add(tip);
  const rebuildProj = () => { const a = []; pts.forEach(p => { if (!p.mesh.visible) return; const q = p.mesh.position, f = P(p.x, R.y[0], p.z), b = P(p.x, p.y, R.z[0]), s = P(R.x[0], p.y, p.z); a.push(q.x, q.y, q.z, f.x, f.y, f.z, q.x, q.y, q.z, b.x, b.y, b.z, q.x, q.y, q.z, s.x, s.y, s.z); }); projGeo.setAttribute('position', new T.Float32BufferAttribute(a, 3)); };
  const place = i => { const p = pts[i], v = P(p.x, p.y, p.z); p.mesh.position.copy(v); const f = P(p.x, R.y[0], p.z), b = P(p.x, p.y, R.z[0]), s = P(R.x[0], p.y, p.z);
    p.d[0].position.set(f.x, f.y + .01, f.z); p.d[1].position.set(b.x, b.y, b.z + .01); p.d[2].position.set(s.x + .01, s.y, s.z); };
  const kit = { grp, P, inv, R, pts, lock: o.lock || 'free', onMove: o.onMove, onDouble: o.onDouble, sel: -1 };
  kit.addPoint = p => {
    p = Object.assign({ x: 0, y: 0, z: 0, color: 0x4f86ff, r: .26, diamond: false }, p); const geo = p.diamond ? new T.OctahedronGeometry(p.r * 1.4) : new T.SphereGeometry(p.r, 18, 14);
    p.mesh = new T.Mesh(geo, pc3dMat(T, p.color, { emissive: 0x0a1330 })); p.mesh.castShadow = true; p.mesh.userData.i = pts.length; grp.add(p.mesh);
    const dm = () => new T.MeshBasicMaterial({ color: p.color, transparent: true, opacity: .55, side: T.DoubleSide }); p.d = [new T.Mesh(new T.CircleGeometry(.17, 14), dm()), new T.Mesh(new T.CircleGeometry(.17, 14), dm()), new T.Mesh(new T.CircleGeometry(.17, 14), dm())];
    p.d[0].rotation.x = -Math.PI / 2; p.d[2].rotation.y = Math.PI / 2; p.d.forEach(d => grp.add(d)); pts.push(p); place(pts.length - 1); rebuildProj(); return pts.length - 1;
  };
  kit.setPoint = (i, patch) => { const p = pts[i]; Object.assign(p, patch); if (patch.color != null) { p.mesh.material.color.setHex(p.color); p.d.forEach(d => d.material.color.setHex(p.color)); } if (patch.r != null) p.mesh.scale.setScalar(patch.r / .26); place(i); rebuildProj(); };
  kit.setVisible = (i, v) => { pts[i].mesh.visible = v; pts[i].d.forEach(d => { d.visible = v; }); rebuildProj(); };
  kit.showTip = i => { if (i < 0) { tip.visible = false; return; } const p = pts[i]; tip.set('(' + pc3vFmt(p.x) + ', ' + pc3vFmt(p.y) + ', ' + pc3vFmt(p.z) + ')'); tip.position.copy(p.mesh.position).add(new T.Vector3(0, .7, 0)); tip.visible = true; };

  /* picking and dragging: a ray from the pointer, a plane through the point, and the lock that says where the point may go */
  const box = (X.ctl.closest && X.ctl.closest('.pic3')) || X.ctl.parentNode, cv = box.querySelector('canvas'), ray = new T.Raycaster(), ndc = new T.Vector2();
  const aim = e => { const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1)); X.cam.updateMatrixWorld(); grp.updateMatrixWorld(true); ray.setFromCamera(ndc, X.cam); };
  const hit = e => { aim(e); const h = ray.intersectObjects(pts.filter(p => p.mesh.visible).map(p => p.mesh)); return h.length ? h[0].object.userData.i : -1; };
  let drag = null; const hov = new T.Color(0xffffff);
  const clampP = d => ({ x: Math.max(R.x[0], Math.min(R.x[1], d.x)), y: Math.max(R.y[0], Math.min(R.y[1], d.y)), z: Math.max(R.z[0], Math.min(R.z[1], d.z)) });
  const down = e => {
    if (e.target !== cv || e.button > 0) return; const i = hit(e); if (i < 0) return; e.stopPropagation(); e.preventDefault(); kit.sel = i;
    const p = pts[i], nrm = kit.lock === 'xy' ? new T.Vector3(0, 0, 1) : kit.lock === 'xz' ? new T.Vector3(0, 1, 0) : kit.lock === 'yz' ? new T.Vector3(1, 0, 0) : X.cam.getWorldDirection(new T.Vector3()).negate();
    drag = { i, plane: new T.Plane().setFromNormalAndCoplanarPoint(nrm, p.mesh.position.clone()), start: { x: p.x, y: p.y, z: p.z } }; cv.style.cursor = 'grabbing'; kit.showTip(i);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const move = e => { if (!drag) return; aim(e); const v = new T.Vector3(); if (!ray.ray.intersectPlane(drag.plane, v)) return; let d = inv(v); const s = drag.start;
    if (kit.lock === 'xy') d.z = s.z; else if (kit.lock === 'xz') d.y = s.y; else if (kit.lock === 'yz') d.x = s.x; else if (kit.lock === 'x') { d.y = s.y; d.z = s.z; } else if (kit.lock === 'y') { d.x = s.x; d.z = s.z; } else if (kit.lock === 'z') { d.x = s.x; d.y = s.y; }
    d = clampP(d); ['x', 'y', 'z'].forEach(a => { d[a] = Math.round(d[a] * 20) / 20; }); kit.setPoint(drag.i, d); kit.showTip(drag.i); if (kit.onMove) kit.onMove(drag.i, pts[drag.i], 'move'); };
  const up = () => { if (!drag) return; const i = drag.i; drag = null; cv.style.cursor = ''; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (kit.onMove) kit.onMove(i, pts[i], 'drop'); };
  const hover = e => { if (drag) return; const i = hit(e); cv.style.cursor = i >= 0 ? 'grab' : ''; kit.showTip(i >= 0 ? i : kit.sel >= 0 && kit.keepTip ? kit.sel : -1); };
  const dbl = e => { const i = hit(e); if (i >= 0 && kit.onDouble) { e.stopPropagation(); kit.onDouble(i); } };
  box.addEventListener('pointerdown', down, true); box.addEventListener('pointermove', hover); box.addEventListener('dblclick', dbl, true);
  kit.dispose = () => { box.removeEventListener('pointerdown', down, true); box.removeEventListener('pointermove', hover); box.removeEventListener('dblclick', dbl, true); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (cv) cv.style.cursor = ''; };

  /* the row of buttons that says where a picked point may go */
  kit.controls = () => {
    const opts = [['free', 'anywhere', 'move in the plane facing you'], ['xy', 'x · y', 'keep the depth (z) fixed'], ['xz', 'x · z', 'keep the height (y) fixed'], ['yz', 'y · z', 'keep x fixed'], ['x', 'x only', ''], ['y', 'y only', ''], ['z', 'z only', '']].filter(q => !o.locks || o.locks.includes(q[0])), bs = [];
    const paint = () => bs.forEach((b, i) => b.setAttribute('aria-pressed', String(opts[i][0] === kit.lock)));
    opts.forEach(q => { const b = pc3dBtn(q[1], () => { kit.lock = q[0]; paint(); }); b.title = q[2]; bs.push(b); }); paint();
    return h('div', { class: 'pic3-row' }, h('span', { class: 'pic3-rng' }, 'drag a point, moving it: '), bs);
  };
  X.setCam(o.cam || { th: .62, ph: 1.05, ty: 0 }); X.fit(S * .72, S * .64);
  if (window.__pc3debug) window.__pc3v = { kit, X, T };
  return kit;
};

/* ---- the view switch: the void is the default 3D view; the older board view stays one button away ---- */
const pc3vWrap = (name, build) => {
  const board = PIC3.scenes[name];
  PIC3.scenes[name] = (T, X, sp) => {
    let cur = null, which = 'void';
    const clear = () => { if (cur && cur.dispose) { try { cur.dispose(); } catch (e) { } } while (X.world.children.length) { const c = X.world.children[0]; X.world.remove(c); X.dispose(c); } X.ctl.replaceChildren(); X.info(''); };
    const make = () => { cur = (which === 'void' ? build : board)(T, X, sp); const b = pc3dBtn(which === 'void' ? 'board view' : 'data void view', () => { clear(); which = which === 'void' ? 'board' : 'void'; make(); }); b.title = which === 'void' ? 'the older view: a flat board standing in the room' : 'axes in every direction with the points floating in space'; X.ctl.append(h('div', { class: 'pic3-row' }, b)); };
    make(); return { update(dt, t) { if (cur && cur.update) cur.update(dt, t); }, dispose() { if (cur && cur.dispose) cur.dispose(); } };
  };
};

/* ================= regress: x, y and a third axis for the WEIGHT of each point ================= */
pc3vWrap('regress', (T, X, sp) => {
  const M = PIC.math, ctl = X.ctl, xr = sp.xr || [0, 10], yr = sp.yr || [0, 10], deg = sp.mode === 'poly' ? sp.deg || 3 : 1, ZR = [0, 6];
  const data = (sp.pts || []).map(p => ({ x: p[0], y: p[1], w: 1 })), orig = data.map(d => Object.assign({}, d)); let weighted = true, target = null, shown = null, info = {};
  const kit = PIC3.void(T, X, { ranges: { x: xr, y: yr, z: ZR }, names: [sp.xlab || 'x', sp.ylab || 'y', 'weight'], onMove: (i, p, ph) => { if (p.z < .2) { kit.setPoint(i, { z: .2 }); } data[i].x = p.x; data[i].y = p.y; data[i].w = Math.max(.2, p.z); kit.setPoint(i, { r: .2 + .05 * data[i].w }); retarget(); } });
  const grp = kit.grp, R = kit.R, N = 60;
  data.forEach(d => kit.addPoint({ x: d.x, y: d.y, z: d.w, r: .25 }));
  /* the fitted line, extended along the weight axis as a ribbon so the points at any weight meet it; its two edges are drawn as lines */
  const ribPos = new Float32Array((N + 1) * 2 * 3), ribIdx = []; for (let i = 0; i < N; i++) { const a = i * 2; ribIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const ribGeo = new T.BufferGeometry(); ribGeo.setAttribute('position', new T.BufferAttribute(ribPos, 3)); ribGeo.setIndex(ribIdx);
  const rib = new T.Mesh(ribGeo, new T.MeshBasicMaterial({ color: 0x7a4fd0, transparent: true, opacity: .32, side: T.DoubleSide, depthWrite: false })); grp.add(rib);
  const edgeA = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({ color: 0xc9b2ff })), edgeB = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({ color: 0xc9b2ff, transparent: true, opacity: .5 })); grp.add(edgeA); grp.add(edgeB);
  const stick = new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial({ color: 0xff8a3d })); grp.add(stick);
  if (sp.line) { const f = x => sp.line[0] * x + sp.line[1], a = kit.P(R.x[0], f(R.x[0]), ZR[0]), b = kit.P(R.x[1], f(R.x[1]), ZR[0]), c = kit.P(R.x[0], f(R.x[0]), ZR[1]), d = kit.P(R.x[1], f(R.x[1]), ZR[1]); const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([a, b, c, b, d, c].flatMap(v => [v.x, v.y, v.z]), 3)); grp.add(new T.Mesh(g, new T.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: .16, side: T.DoubleSide, depthWrite: false }))); const e = new T.Line(new T.BufferGeometry().setFromPoints([a, b]), new T.LineBasicMaterial({ color: 0xffb37a })); grp.add(e); }
  const draw = c => {
    const xs = [], a = [], b = []; for (let i = 0; i <= N; i++) xs.push(R.x[0] + (R.x[1] - R.x[0]) * i / N);
    for (let i = 0; i <= N; i++) { const y = Math.max(R.y[0], Math.min(R.y[1], pc3vEval(c, xs[i]))), p0 = kit.P(xs[i], y, ZR[0]), p1 = kit.P(xs[i], y, ZR[1]); ribPos.set([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z], i * 6); a.push(p0); b.push(p1); }
    ribGeo.attributes.position.needsUpdate = true; ribGeo.computeBoundingSphere(); edgeA.geometry.setFromPoints(a); edgeB.geometry.setFromPoints(b);
    const s = []; data.forEach((d, i) => { const y = pc3vEval(c, d.x), q = kit.P(d.x, d.y, d.w), r = kit.P(d.x, Math.max(R.y[0], Math.min(R.y[1], y)), d.w); s.push(q.x, q.y, q.z, r.x, r.y, r.z); }); stick.geometry.setAttribute('position', new T.Float32BufferAttribute(s, 3));
  };
  const stats = c => { const wt = d => (weighted ? d.w : 1), sw = data.reduce((s, d) => s + wt(d), 0) || 1; return data.reduce((s, d) => s + wt(d) * Math.pow(d.y - pc3vEval(c, d.x), 2), 0) / sw; };
  const say = c => { const eq = c.length === 2 ? 'y = <b>' + pc3vFmt(c[1]) + '</b>·x ' + (c[0] < 0 ? '- ' : '+ ') + '<b>' + pc3vFmt(Math.abs(c[0])) + '</b>' : 'a degree-' + (c.length - 1) + ' curve'; X.info(eq + ' &nbsp; ' + (weighted ? 'weighted ' : '') + 'mistake (MSE) <b>' + stats(c).toFixed(3) + '</b><br><span class="pic3-note">Drag a point sideways or up to change its x or y: the purple sheet is the best-fit line and it glides to follow. Move a point along the <b>weight</b> axis (depth) to make it count more: the line leans toward heavy points.</span>'); };
  function retarget() { target = pc3vFit(data, deg, weighted); if (target && !shown) shown = target.slice(); }
  ctl.append(kit.controls(), h('div', { class: 'pic3-row' }, pc3dBtn('use the weights', v => { weighted = v; retarget(); }, true), pc3dBtn('↺ put the points back', () => { data.forEach((d, i) => { Object.assign(d, orig[i]); kit.setPoint(i, { x: d.x, y: d.y, z: d.w, r: .25 }); }); retarget(); })));
  retarget(); if (shown) { shown = new Array(shown.length).fill(0); shown[0] = data.reduce((s, d) => s + d.y, 0) / data.length; }
  return { dispose: kit.dispose, update(dt) {
    if (!target || !shown) return; const k = 1 - Math.exp(-dt * 9), len = Math.max(shown.length, target.length); for (let i = 0; i < len; i++) { const s = shown[i] || 0, g = target[i] || 0; shown[i] = Math.abs(g - s) < 1e-5 ? g : s + (g - s) * k; } if (shown.length > target.length && shown.slice(target.length).every(v => Math.abs(v) < 1e-5)) shown.length = target.length;
    draw(shown); say(shown);
  } };
});

/* ================= classify: two features on the floor, the probability as the height ================= */
pc3vWrap('classify', (T, X, sp) => {
  const M = PIC.math, ctl = X.ctl, xr = sp.xr, yr = sp.yr, model = sp.model, NX = 34, NZ = 34; let k = sp.k || 3, coef = sp.coef ? sp.coef.slice() : null, icpt = sp.intercept, train = 0;
  const data = sp.pts.map(p => ({ x: p[0], y: p[1], c: p[2] === 1 ? 1 : 0 })), orig = data.map(d => Object.assign({}, d));
  const prob = (x, y) => (model === 'knn' ? M.knn(data.map(d => [d.x, d.y, d.c]), x, y, k).p1 : model === 'logistic' ? M.sigmoid(coef[0] * x + coef[1] * y + icpt) : .5);
  const kit = PIC3.void(T, X, { ranges: { x: xr, y: [0, 1], z: yr }, names: [sp.xlab || 'feature 1', 'probability of class 1', sp.ylab || 'feature 2'], lock: 'xz', locks: ['xz', 'free', 'x', 'z'], onMove: (i, p, ph) => { data[i].x = p.x; data[i].y = p.z; kit.setPoint(i, { y: data[i].c }); if (model === 'knn') surf(); else if (model === 'logistic') { train = 0; learn(); } }, onDouble: i => flip(i) });
  const grp = kit.grp, R = kit.R; data.forEach(d => kit.addPoint({ x: d.x, y: d.c, z: d.y, color: new T.Color(pc3dCol[d.c]).getHex(), r: .26 }));
  const pos = new Float32Array((NX + 1) * (NZ + 1) * 3), col = new Float32Array((NX + 1) * (NZ + 1) * 3), idx = [];
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) { const a = i * (NZ + 1) + j, b = a + 1, c = a + (NZ + 1), d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.setIndex(idx);
  const mesh = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .78, side: T.DoubleSide })); grp.add(mesh);
  const half = new T.Mesh(new T.PlaneGeometry(10, 10), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .07, side: T.DoubleSide, depthWrite: false })); half.rotation.x = -Math.PI / 2; half.position.copy(kit.P((R.x[0] + R.x[1]) / 2, .5, (R.z[0] + R.z[1]) / 2)); grp.add(half);
  const c0 = new T.Color(pc3dCol[0]), c1 = new T.Color(pc3dCol[1]), cc = new T.Color();
  function surf() { for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) { const x = xr[0] + (xr[1] - xr[0]) * i / NX, y = yr[0] + (yr[1] - yr[0]) * j / NZ, p = prob(x, y), v = kit.P(x, p, y), n = (i * (NZ + 1) + j) * 3; pos[n] = v.x; pos[n + 1] = v.y; pos[n + 2] = v.z; cc.copy(c0).lerp(c1, p); col[n] = cc.r; col[n + 1] = cc.g; col[n + 2] = cc.b; } geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeBoundingSphere(); }
  function flip(i) { data[i].c = 1 - data[i].c; kit.setPoint(i, { y: data[i].c, color: new T.Color(pc3dCol[data[i].c]).getHex() }); if (model === 'knn') surf(); else if (model === 'logistic') { train = 0; learn(); } say(); }
  function learn() { if (model !== 'logistic' || data.length < 2) return; train = 1; }
  const gd = () => { const mx = M.mean(data.map(d => d.x)), my = M.mean(data.map(d => d.y)), sdx = M.std(data.map(d => d.x)) || 1, sdy = M.std(data.map(d => d.y)) || 1; let a = coef[0] * sdx, b = coef[1] * sdy, c = icpt + coef[0] * mx + coef[1] * my;
    for (let s = 0; s < 8; s++) { let da = 0, db = 0, dc = 0; data.forEach(d => { const u = (d.x - mx) / sdx, v = (d.y - my) / sdy, e = M.sigmoid(a * u + b * v + c) - d.c; da += e * u; db += e * v; dc += e; }); a -= 1.1 * (da / data.length + .01 * a); b -= 1.1 * (db / data.length + .01 * b); c -= 1.1 * dc / data.length; }
    coef = [a / sdx, b / sdy]; icpt = c - coef[0] * mx - coef[1] * my; };
  const say = () => X.info('<b>' + (model === 'knn' ? 'k-nearest neighbours (k = ' + k + ')' : model === 'logistic' ? 'logistic regression' : 'two groups of points') + '</b><br><span class="pic3-note">The coloured sheet is the probability that a spot belongs to class 1 (orange): high where orange points are, low near blue. Drag a point along the floor and the sheet reshapes' + (model === 'logistic' ? ' as the model trains again' : '') + '. Double-click a point to flip its class (it jumps between the floor and the top).</span>');
  ctl.append(kit.controls());
  if (model === 'knn') ctl.append(pc3dRange(1, 15, 2, k, v => { k = v; surf(); say(); }, 'neighbours that vote (k) '));
  ctl.append(h('div', { class: 'pic3-row' }, pc3dBtn('flip the last point I touched', () => { if (kit.sel >= 0) flip(kit.sel); }), pc3dBtn('↺ put the points back', () => { data.forEach((d, i) => { Object.assign(d, orig[i]); kit.setPoint(i, { x: d.x, z: d.y, y: d.c, color: new T.Color(pc3dCol[d.c]).getHex() }); }); coef = sp.coef ? sp.coef.slice() : null; icpt = sp.intercept; surf(); })));
  surf(); say();
  return { dispose: kit.dispose, update() { if (train && model === 'logistic') { gd(); surf(); if (++train > 90) train = 0; } } };
});

/* ================= cluster: k-means in the void (the third axis starts at 0 and the centres can be moved too) ================= */
pc3vWrap('cluster', (T, X, sp) => {
  const ctl = X.ctl, xr = sp.xr, yr = sp.yr, ZR = [-5, 5], data = sp.pts.map(p => [p[0], p[1], 0]), orig = data.map(d => d.slice()), init = (sp.init || []).map(c => [c[0], c[1], 0]), oinit = init.map(c => c.slice()), rounds = sp.rounds == null ? 99 : sp.rounds;
  const kit = PIC3.void(T, X, { ranges: { x: xr, y: yr, z: ZR }, names: [sp.xlab || 'x', sp.ylab || 'y', 'a third feature (starts at 0)'], onMove: (i, p, ph) => { if (i < data.length) { data[i] = [p.x, p.y, p.z]; if (init.length) paintNear(i); } else { init[i - data.length] = [p.x, p.y, p.z]; } if (ph === 'drop') restart(); } });
  const grp = kit.grp, n = data.length; data.forEach(d => kit.addPoint({ x: d[0], y: d[1], z: d[2], color: 0x8aa0cc, r: .22 }));
  const cent = init.map((c, k) => kit.addPoint({ x: c[0], y: c[1], z: c[2], color: new T.Color(pc3dCol[k % 5]).getHex(), r: .26, diamond: true }));
  const col = k => new T.Color(pc3dCol[k % 5]).getHex(), d2 = (a, b) => (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2]);
  const nearest = (p, cs) => { let k = 0, bd = 1e18; cs.forEach((c, j) => { const d = d2(p, c); if (d < bd) { bd = d; k = j; } }); return k; };
  const paintNear = i => kit.setPoint(i, { color: col(nearest(data[i], init)) });
  const run = () => { let cs = init.map(c => c.slice()); const hist = []; for (let it = 0; it < 30; it++) { const assign = data.map(p => nearest(p, cs)), to = cs.map((c, k) => { const m = data.filter((_, i) => assign[i] === k); return m.length ? [0, 1, 2].map(a => m.reduce((s, p) => s + p[a], 0) / m.length) : c; }); hist.push({ from: cs, assign, to }); const moved = to.some((c, k) => d2(c, cs[k]) > 1e-12); cs = to; if (!moved) break; } return hist; };
  let hist = [], r = 0, ph = 0, t = 0, done = false;
  const inertia = (cs, assign) => data.reduce((s, p, i) => s + d2(p, cs[assign[i]]), 0);
  function restart() { hist = init.length ? run() : []; r = 0; ph = 0; t = 0; done = false; data.forEach((_, i) => kit.setPoint(i, { color: 0x8aa0cc })); init.forEach((c, k) => kit.setPoint(data.length + k, { x: c[0], y: c[1], z: c[2] })); say(init.length ? 'the points, and the starting centres (diamonds)' : 'the points: nobody has told us any groups'); }
  function say(msg) { X.info(msg + '<br><span class="pic3-note">Drag any point or any diamond: k-means starts again from the starting centres. Pull a point along the third axis and watch the clusters still work: the idea does not care how many features there are.</span>'); }
  ctl.append(kit.controls(), h('div', { class: 'pic3-row' }, pc3dBtn('▶ run k-means again', restart), pc3dBtn('↺ put everything back', () => { data.forEach((d, i) => { data[i] = orig[i].slice(); kit.setPoint(i, { x: d[0], y: d[1], z: 0 }); }); init.forEach((c, k) => { init[k] = oinit[k].slice(); }); restart(); })));
  restart();
  return { dispose: kit.dispose, update(dt) {
    if (!hist.length || done) return; t += dt; const h0 = hist[r];
    if (r >= hist.length || r >= rounds) { done = true; const last = hist[Math.min(r, hist.length) - 1]; say((r >= hist.length ? 'nothing moves any more: <b>done</b>. ' : '') + 'spread = <b>' + inertia(last.to, last.assign).toFixed(1) + '</b>'); return; }
    if (ph === 0) { if (t < .05) { h0.assign.forEach((k, i) => kit.setPoint(i, { color: col(k) })); say('round <b>' + (r + 1) + '</b>: every point joins its <b>nearest</b> centre'); } if (t > 1.2) { ph = 1; t = 0; } }
    else { const e = pjEase(pjClamp(t / 1.1, 0, 1)); h0.to.forEach((c, k) => kit.setPoint(data.length + k, { x: h0.from[k][0] + (c[0] - h0.from[k][0]) * e, y: h0.from[k][1] + (c[1] - h0.from[k][1]) * e, z: h0.from[k][2] + (c[2] - h0.from[k][2]) * e })); if (t < .05) say('then each centre moves to the <b>middle</b> of its points'); if (t > 1.3) { ph = 0; t = 0; r++; } }
  } };
});
