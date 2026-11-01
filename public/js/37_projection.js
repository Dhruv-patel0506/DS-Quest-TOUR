'use strict';
/* =====================================================================
   3D Projection: a full-screen, see-through 3D layer that floats ON TOP of the whole app, so the picture is not a drawing inside a box but an object in the room.
   The page underneath stays usable (click-through) until "Hands on" is switched on; then you can turn the object with the mouse and zoom with the wheel.
   The 3D engine (vendor/three.min.js) is loaded only when this is opened. Scenes are plain functions in PROJ.scenes: (T, X, spec) -> { update(dt, t), apply(spec), dispose() }
   car (matrices on a street), net (a real tiny network, trained in the browser), llm (tokens through a tower, attention, next word), descent (gradient descent on a loss landscape), rag (a map of meaning)
   ===================================================================== */
const PROJ = {
  scenes: {}, st: null, _p: null,
  lessonMap: { 'la-car': 'car', 'nn-full': 'net', 'llm-flow': 'llm', 'rag-library': 'rag' },
  list: [
    { id: 'car', icon: '🚗', short: 'Car & matrix', title: 'A real car on a street, moved by a matrix', sub: 'Zoom, stretch, shear, mirror, rotate and squash the whole street. Watch the car and the grid bend together, and read the determinant.' },
    { id: 'net', icon: '🧠', short: 'Neural network', title: 'A neural network in full, learning for real', sub: 'Every neuron and every weight. Send data through, then train it: the colours of the weights change because a real tiny network is learning in your browser.' },
    { id: 'llm', icon: '💬', short: 'Language model', title: 'Tokens climbing a language-model tower', sub: 'Words rise through the layers, attention arcs show who looks at whom, and the next word is chosen from odds that a temperature slider reshapes.' },
    { id: 'descent', icon: '⛰️', short: 'Gradient descent', title: 'A ball rolling down a loss landscape', sub: 'This is how training works: always step downhill. Change the learning rate, break it, and try other starting points.' },
    { id: 'rag', icon: '📚', short: 'RAG', title: 'RAG, step by step: map, search, prompt, answer', sub: 'Chunks sit on a map of meaning; the question lands among them; a circle fetches the nearest chunks; they are pasted into the prompt; the model answers from them.' },
  ],
};
PROJ.webgl = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };
PROJ.load = () => PROJ._p || (PROJ._p = new Promise((res, rej) => {
  if (window.THREE) return res();
  const s = document.createElement('script'); s.src = 'vendor/three.min.js'; s.onload = () => (window.THREE ? res() : (PROJ._p = null, rej(new Error('The 3D engine did not start')))); s.onerror = () => { PROJ._p = null; rej(new Error('Could not load the 3D engine (vendor/three.min.js)')); }; document.head.appendChild(s);
}));
PROJ.open = async function (name, opts) {
  opts = opts || {}; if (!PROJ.scene(name)) name = 'car';
  if (PROJ.st) { PROJ.hold(name, opts); return PROJ.st; }
  if (!PROJ.webgl()) { toast('3D is switched off in this browser (WebGL). The flat pictures still work.', 'bad'); return null; }
  try { await PROJ.load(); } catch (e) { toast(e.message, 'bad'); return null; }
  if (PROJ.st) { PROJ.hold(name, opts); return PROJ.st; }
  return pjStart(name, opts);
};
PROJ.scene = n => PROJ.scenes[n] || (typeof PIC3 !== 'undefined' && PIC3.scenes[n]) || null;
PROJ.hold = (name, opts) => { const st = PROJ.st; if (st.name === name && st.scene && st.scene.apply && opts && opts.type) st.scene.apply(opts); else st.show(name, opts); };
PROJ.close = () => { if (PROJ.st) PROJ.st.close(); };
PROJ.sync = (L, s) => { const st = PROJ.st; if (!st || !st.scene || !s || !s.scene) return; if (PROJ.lessonMap[L.id] === st.name && st.scene.apply) st.scene.apply(s.scene); };

/* ---------- small helpers ---------- */
const pjClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pjRng = seed => { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
const pjHash = str => { let x = 7; for (let i = 0; i < str.length; i++) x = (Math.imul(x, 31) + str.charCodeAt(i)) >>> 0; return (x % 1000) / 1000; };
const pjEase = k => (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/* a text label that is always facing the viewer. The canvas size is fixed at creation (from o.sample or the text) so set(text) can redraw it safely. */
function pjLabel(T, text, o) {
  o = o || {}; if (!o.bg && !o.plain) o = Object.assign({}, o, { bg: 'rgba(7,12,34,.86)' }); const px = o.px || 56, cv = document.createElement('canvas'), g = cv.getContext('2d'), font = '700 ' + px + 'px system-ui, Segoe UI, sans-serif';
  g.font = font; const w = Math.ceil(g.measureText(o.sample || text).width + px * .7), hh = Math.round(px * 1.4); cv.width = w; cv.height = hh;
  const tex = new T.CanvasTexture(cv), sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: o.depthTest !== false }));
  sp.set = txt => {
    g.clearRect(0, 0, w, hh); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (o.bg) { g.fillStyle = o.bg; g.beginPath(); if (g.roundRect) g.roundRect(0, 0, w, hh, hh / 3); else g.rect(0, 0, w, hh); g.fill(); }
    else { g.lineWidth = px * .14; g.lineJoin = 'round'; g.strokeStyle = o.stroke || 'rgba(6,12,28,.8)'; g.strokeText(txt, w / 2, hh / 2 + 2); }
    g.fillStyle = o.color || '#ffffff'; g.fillText(txt, w / 2, hh / 2 + 2); tex.needsUpdate = true;
  };
  sp.set(text); const k = (o.size || .5) / hh; sp.scale.set(w * k, hh * k, 1); return sp;
}

function pjCar(T) {
  const g = new T.Group(), body = new T.MeshPhongMaterial({ color: 0xd63b2f, shininess: 90, specular: 0x777777 }), glass = new T.MeshPhongMaterial({ color: 0x1b2b44, shininess: 160, specular: 0xaaccff, transparent: true, opacity: .8 }),
    dark = new T.MeshPhongMaterial({ color: 0x14161b, shininess: 25 }), rim = new T.MeshPhongMaterial({ color: 0xd3dae6, shininess: 120 });
  const ext = (pts, depth, bev, mat) => { const s = new T.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]))); s.closePath(); const geo = new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 8 }); geo.translate(0, 0, -depth / 2); const m = new T.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; };
  g.add(ext([[-2.1, .36], [2.1, .36], [2.2, .72], [1.55, .98], [-1.95, .98], [-2.2, .75]], 1.5, .1, body));
  g.add(ext([[-1.15, .98], [-.78, 1.5], [.55, 1.5], [1.05, .98]], 1.36, .04, glass));
  const roof = new T.Mesh(new T.BoxGeometry(1.35, .07, 1.5), body); roof.position.set(-.115, 1.53, 0); roof.castShadow = true; g.add(roof);
  [-1, 1].forEach(s => {
    const hl = new T.Mesh(new T.SphereGeometry(.13, 14, 10), new T.MeshBasicMaterial({ color: 0xfff2b0 })); hl.scale.set(.5, 1, 1.2); hl.position.set(2.2, .74, s * .56); g.add(hl);
    const tl = new T.Mesh(new T.BoxGeometry(.06, .13, .32), new T.MeshBasicMaterial({ color: 0xff3b3b })); tl.position.set(-2.25, .8, s * .58); g.add(tl);
  });
  const bump = new T.Mesh(new T.BoxGeometry(.18, .2, 1.62), dark); bump.position.set(2.22, .46, 0); g.add(bump); const bump2 = bump.clone(); bump2.position.x = -2.24; g.add(bump2);
  const wheels = [];
  [[1.35, .9], [1.35, -.9], [-1.35, .9], [-1.35, -.9]].forEach(p => {
    const w = new T.Group(), spin = new T.Group(); w.position.set(p[0], .38, p[1]);
    const tire = new T.Mesh(new T.CylinderGeometry(.38, .38, .3, 28).rotateX(Math.PI / 2), dark), hub = new T.Mesh(new T.CylinderGeometry(.22, .22, .32, 20).rotateX(Math.PI / 2), rim); tire.castShadow = true; spin.add(tire, hub);
    [0, Math.PI / 2].forEach(a => { const sp = new T.Mesh(new T.BoxGeometry(.4, .05, .34), dark); sp.rotation.z = a; spin.add(sp); });
    w.add(spin); g.add(w); wheels.push(spin);
  });
  return { g, wheels };
}

/* ---------- the overlay ---------- */
function pjStart(name0, opts0) {
  const T = window.THREE, reduce = picReduce(), st = { dead: false, name: '', scene: null, T };
  const cv = h('canvas', { class: 'proj-cv' }), r = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
  r.setClearColor(0x000000, 0); r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(38, 1, .1, 400), world = new T.Group(); scene.add(world);
  scene.add(new T.HemisphereLight(0xdbe8ff, 0x1c2a44, .85));
  const sun = new T.DirectionalLight(0xffffff, .95); sun.position.set(7, 13, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 45 }); sun.shadow.bias = -.0008; scene.add(sun);
  const rim = new T.PointLight(0x4aa8ff, .9, 70); rim.position.set(-8, 5, -7); scene.add(rim);
  const floor = new T.Mesh(new T.PlaneGeometry(90, 90), new T.ShadowMaterial({ opacity: .3 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const stage = new T.Group(); scene.add(stage); let pulseRing = null;
  const kill = o => o.traverse(n => { if (n.geometry) n.geometry.dispose(); const m = n.material; if (m) (Array.isArray(m) ? m : [m]).forEach(mm => { if (mm.map) mm.map.dispose(); mm.dispose(); }); });
  const cs = { th: .7, ph: 1.1, d: 18, tx: 0, ty: 1, tz: 0, th2: .7, ph2: 1.1, d2: 18 }, par = { x: 0, y: 0 };
  let hands = false, spin = false, drag = null, last = performance.now(), T0 = last, raf = 0, hudShift = 0;

  const root = h('div', { class: 'proj', role: 'dialog', 'aria-label': '3D projection' });
  const tabs = h('div', { class: 'proj-tabs' }, PROJ.list.map(s => h('button', { type: 'button', class: 'proj-tab', 'data-s': s.id, onclick: () => show(s.id, {}) }, s.icon + ' ' + s.short)));
  const ctl = h('div', { class: 'proj-ctl' }), info = h('div', { class: 'proj-info', 'aria-live': 'polite' });
  const tog = (label, on, f) => { const b = h('button', { type: 'button', class: 'proj-btn', 'aria-pressed': String(!!on) }, label); b.onclick = () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); f(v); }; return b; };
  const handsB = tog('✋ Hands on: drag to turn, wheel to zoom', false, v => { hands = v; root.classList.toggle('hands', v); });
  const spinB = tog('↻ Auto-turn', false, v => { spin = v; });
  const dimB = tog('◐ Dim the page', true, v => root.classList.toggle('nodim', !v));
  const fsB = h('button', { type: 'button', class: 'proj-btn', onclick: () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { } } }, '⛶ Full screen');
  const closeB = h('button', { type: 'button', class: 'proj-x', title: 'Close (Esc)', 'aria-label': 'Close 3D projection', onclick: () => st.close() }, '✕');
  const hud = h('div', { class: 'proj-hud' }, tabs, ctl, h('div', { class: 'proj-row' }, handsB, spinB, dimB, fsB));
  root.append(h('div', { class: 'proj-dim' }), h('div', { class: 'proj-glow' }), cv, h('div', { class: 'proj-scan' }), info, hud, closeB);
  document.body.append(root); document.body.classList.add('proj-on');

  const size = () => {
    const w = window.innerWidth, hh = window.innerHeight; r.setSize(w, hh, false); cam.aspect = w / hh; hudShift = Math.round(Math.min(140, hud.offsetHeight * .5)); cam.setViewOffset(w, hh, 0, hudShift, w, hh); cam.updateProjectionMatrix(); if (X && X.onResize) X.onResize();
  };
  const mkStage = (R, y) => {
    while (stage.children.length) { const c = stage.children[0]; stage.remove(c); kill(c); } pulseRing = null; stage.position.y = y || 0; floor.position.y = (y || 0) - .002;
    if (!R) return;
    const mk = op => { const m = new T.Mesh(new T.RingGeometry(R - .05, R, 112), new T.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: op, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; stage.add(m); return m; };
    mk(.75); pulseRing = mk(.5);
  };
  let X = null;
  function show(n, o) {
    if (!PROJ.scene(n)) n = 'car';
    if (st.scene && st.scene.dispose) { try { st.scene.dispose(); } catch (e) { console.error(e); } }
    while (world.children.length) { const c = world.children[0]; world.remove(c); kill(c); }
    ctl.replaceChildren(); info.innerHTML = ''; mkStage(0, 0); st.name = n; st.scene = null;
    tabs.querySelectorAll('.proj-tab').forEach(b => b.classList.toggle('on', b.dataset.s === n));
    X = {
      T, world, cam, cs, ctl, onResize: null, rng: pjRng, info: html => { info.innerHTML = html; }, label: (t, op) => pjLabel(T, t, op), stage: mkStage, dispose: kill,
      setCam: c => { Object.assign(cs, c); cs.th2 = cs.th; cs.ph2 = cs.ph; cs.d2 = cs.d; },
      fit: (hw, hh) => { const th = Math.tan(19 * Math.PI / 180); cs.d2 = cs.d = pjClamp(Math.max(hw / (th * cam.aspect), hh / th) * 1.1, 4, 80); },
    };
    try { st.scene = PROJ.scene(n)(T, X, o || {}); } catch (e) { console.error(e); info.innerHTML = '<b>This scene could not be built:</b> ' + picEsc(e.message); }
    requestAnimationFrame(() => { if (!st.dead) size(); });
  }
  st.show = show;
  st.render = () => r.render(scene, cam);
  st.close = () => {
    if (st.dead) return; st.dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', size); window.removeEventListener('pointermove', onMove); document.removeEventListener('keydown', onKey);
    if (st.scene && st.scene.dispose) { try { st.scene.dispose(); } catch (e) { } } kill(scene); r.dispose(); try { r.forceContextLoss(); } catch (e) { }
    root.remove(); document.body.classList.remove('proj-on'); if (document.fullscreenElement) try { document.exitFullscreen(); } catch (e) { } PROJ.st = null; if (PROJ.onclose) { const f = PROJ.onclose; PROJ.onclose = null; try { f(); } catch (e) { } }
  };
  /* mouse: parallax when the page is click-through, orbit when Hands on */
  const onMove = e => { par.x = e.clientX / window.innerWidth * 2 - 1; par.y = e.clientY / window.innerHeight * 2 - 1; };
  const onKey = e => { if (e.key === 'Escape') st.close(); };
  cv.addEventListener('pointerdown', e => { if (!hands) return; drag = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (x) { } });
  cv.addEventListener('pointermove', e => { if (!drag) return; cs.th2 -= (e.clientX - drag.x) * .008; cs.ph2 = pjClamp(cs.ph2 - (e.clientY - drag.y) * .006, .12, 1.55); drag.x = e.clientX; drag.y = e.clientY; });
  const up = () => { drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { if (!hands) return; e.preventDefault(); cs.d2 = pjClamp(cs.d2 * Math.exp(e.deltaY * .001), 3, 80); }, { passive: false });
  window.addEventListener('resize', size); window.addEventListener('pointermove', onMove); document.addEventListener('keydown', onKey);

  const frame = now => {
    if (st.dead) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000), t = (now - T0) / 1000; last = now;
    if (spin && !drag && !reduce) cs.th2 += dt * .3;
    const k = Math.min(1, dt * 7); cs.th += (cs.th2 - cs.th) * k; cs.ph += (cs.ph2 - cs.ph) * k; cs.d += (cs.d2 - cs.d) * k;
    const ox = reduce || hands ? 0 : par.x * .16, oy = reduce || hands ? 0 : par.y * .07, th = cs.th + ox, ph = pjClamp(cs.ph + oy, .1, 1.55);
    cam.position.set(cs.tx + cs.d * Math.sin(ph) * Math.sin(th), cs.ty + cs.d * Math.cos(ph), cs.tz + cs.d * Math.sin(ph) * Math.cos(th)); cam.lookAt(cs.tx, cs.ty, cs.tz);
    if (pulseRing) { const p = (t * .45) % 1; pulseRing.scale.setScalar(.12 + .88 * p); pulseRing.material.opacity = .55 * (1 - p); }
    if (st.scene && st.scene.update) { try { st.scene.update(dt, t); } catch (e) { console.error(e); st.scene.update = null; } }
    r.render(scene, cam);
  };
  PROJ.st = st; size(); show(name0, opts0); raf = requestAnimationFrame(frame);
  return st;
}

/* ---------- scene: car ---------- */
PROJ.scenes.car = (T, X, o) => {
  const ctl = X.ctl, wrap = new T.Group(); wrap.matrixAutoUpdate = false; X.world.add(wrap);
  const car = pjCar(T); wrap.add(car.g);
  const box = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(4.5, 1.6, 1.85)), new T.LineBasicMaterial({ color: 0x45e0ff })); box.position.y = .8; wrap.add(box);
  const gp = []; for (let i = -12; i <= 12; i++) gp.push(i, .003, -12, i, .003, 12, -12, .003, i, 12, .003, i);
  const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(gp, 3)); wrap.add(new T.LineSegments(gg, new T.LineBasicMaterial({ color: 0x4d86ff, transparent: true, opacity: .42 })));
  const road = new T.Mesh(new T.PlaneGeometry(24, 3.6), new T.MeshPhongMaterial({ color: 0x2b3345, transparent: true, opacity: .9, side: T.DoubleSide })); road.rotation.x = -Math.PI / 2; road.position.y = .005; road.receiveShadow = true; wrap.add(road);
  for (let x = -11; x <= 11; x += 2.4) { const d = new T.Mesh(new T.PlaneGeometry(1.1, .14), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide })); d.rotation.x = -Math.PI / 2; d.position.set(x, .008, 0); wrap.add(d); }
  /* what it looked like before: a faint fixed grid and an outline of the car */
  const before = new T.LineSegments(gg.clone(), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .12 })); before.position.y = -.002; X.world.add(before);
  const ghost = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(4.5, 1.6, 1.85)), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5 })); ghost.position.y = .8; X.world.add(ghost);
  const tag = X.label('before', { size: .36, color: '#dfe8ff' }); tag.position.set(0, 2.2, 0); X.world.add(tag);
  X.stage(0, 0); X.setCam({ th: .8, ph: 1.0, ty: .6 }); X.fit(9.5, 4.2);

  let cur = [[1, 0], [0, 1]], anim = null, queue = [], drive = true;
  const emb = m => { wrap.matrix.set(m[0][0], 0, -m[0][1], 0, 0, 1, 0, 0, -m[1][0], 0, m[1][1], 0, 0, 0, 0, 1); wrap.matrixWorldNeedsUpdate = true; };
  const mul = (B, A) => [[B[0][0] * A[0][0] + B[0][1] * A[1][0], B[0][0] * A[0][1] + B[0][1] * A[1][1]], [B[1][0] * A[0][0] + B[1][1] * A[1][0], B[1][0] * A[0][1] + B[1][1] * A[1][1]]];
  const fmt = v => String(Math.round(v * 100) / 100);
  const say = (m, name) => {
    const d = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    const msg = Math.abs(d) < 1e-6 ? 'determinant <b>0</b>: the whole street is squashed onto one line, and there is no way back (no inverse)' : d < 0 ? 'determinant <b>' + fmt(d) + '</b>: areas change by ×' + fmt(Math.abs(d)) + ' and the picture is <b>flipped</b> like a mirror image' : Math.abs(d - 1) < 1e-6 ? 'determinant <b>1</b>: the area of every patch of road stays the same' : 'determinant <b>' + fmt(d) + '</b>: every patch of road becomes ' + fmt(d) + ' times as big';
    X.info('<b>' + picEsc(name) + '</b><br><span class="mono">[[' + fmt(m[0][0]) + ', ' + fmt(m[0][1]) + '], [' + fmt(m[1][0]) + ', ' + fmt(m[1][1]) + ']]</span><br>' + msg);
  };
  const go = (m, name, ms) => { anim = { from: cur.map(r => r.slice()), to: m, t: 0, ms: ms || 1500 }; say(m, name); };
  const runSeq = (seq, names) => { let acc = [[1, 0], [0, 1]]; const steps = seq.map((m, i) => { acc = mul(m, acc); return { m: acc, name: (names && names[i]) || ('step ' + (i + 1)) }; }); const f = steps.shift(); queue = steps; go(f.m, f.name, 1500); };
  const apply = sp => { if (!sp) return; if (sp.seq) runSeq(sp.seq, sp.seqNames); else if (sp.mat) go(sp.mat, sp.name || 'matrix', sp.ms || 1500); };
  const P = [['Normal', [[1, 0], [0, 1]]], ['Zoom ×1.5', [[1.5, 0], [0, 1.5]]], ['Stretch ×2', [[2, 0], [0, 1]]], ['Shear', [[1, 1], [0, 1]]], ['Mirror', [[-1, 0], [0, 1]]], ['Rotate 90°', [[0, -1], [1, 0]]], ['Squash (det 0)', [[1, 1], [1, 1]]]];
  const R90 = [[0, -1], [1, 0]], ST = [[2, 0], [0, 1]];
  const inp = v => h('input', { type: 'number', step: '0.1', value: String(v), class: 'proj-in', 'aria-label': 'matrix number' });
  const ci = [inp(1), inp(0), inp(0), inp(1)];
  ctl.append(h('div', { class: 'proj-row' }, P.map(p => h('button', { type: 'button', class: 'proj-btn', onclick: () => go(p[1], p[0]) }, p[0])),
    h('button', { type: 'button', class: 'proj-btn', onclick: () => runSeq([ST, R90], ['step 1: stretch ×2', 'step 2: rotate 90°']) }, 'Stretch, then rotate'), h('button', { type: 'button', class: 'proj-btn', onclick: () => runSeq([R90, ST], ['step 1: rotate 90°', 'step 2: stretch ×2']) }, 'Rotate, then stretch')),
    h('div', { class: 'proj-row' }, h('span', { class: 'proj-lab' }, 'Your own matrix'), h('span', { class: 'mono' }, '[['), ci[0], ci[1], h('span', { class: 'mono' }, '],['), ci[2], ci[3], h('span', { class: 'mono' }, ']]'),
      h('button', { type: 'button', class: 'proj-btn', onclick: () => go([[+ci[0].value || 0, +ci[1].value || 0], [+ci[2].value || 0, +ci[3].value || 0]], 'your matrix') }, 'Apply'),
      tog2('🚗 Drive', true, v => { drive = v; if (!v) car.g.position.x = 0; })));
  function tog2(label, on, f) { const b = h('button', { type: 'button', class: 'proj-btn', 'aria-pressed': String(on) }, label); b.onclick = () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); f(v); }; return b; }
  emb(cur); say(cur, 'normal street: nothing moved yet'); if (o.mat || o.seq) apply(o);
  return {
    apply,
    update(dt, t) {
      if (anim) {
        anim.t += dt * 1000; const k = Math.min(1, anim.t / anim.ms), e = pjEase(k);
        cur = [[0, 1].map(j => anim.from[0][j] + (anim.to[0][j] - anim.from[0][j]) * e), [0, 1].map(j => anim.from[1][j] + (anim.to[1][j] - anim.from[1][j]) * e)]; emb(cur);
        if (k >= 1) { anim = null; if (queue.length) { const q = queue.shift(); setTimeout(() => go(q.m, q.name, 1500), 450); } }
      }
      if (drive) { car.g.position.x = ((t * 2.4) % 16) - 8; car.wheels.forEach(w => { w.rotation.z -= dt * 2.4 / .38; }); }
    },
  };
};

/* ---------- scene: net (a real tiny network, trained here) ---------- */
PROJ.scenes.net = (T, X, o) => {
  const ctl = X.ctl, PRE = { small: [4, 6, 6, 3], big: [8, 12, 12, 12, 6, 3], deep: [6, 10, 10, 10, 10, 10, 10, 4], custom: o.sizes || [4, 6, 6, 3] }, NAMES = (o.names && o.names.out) || ['cat', 'dog', 'bird', 'fish'], nm = i => NAMES[i] || 'class ' + (i + 1), rnd = X.rng(7 + (Date.now() % 997));
  const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  let key = o.sizes ? 'custom' : (o.size || 'small'), S, L, W, B, data, nodes, grp, ecol, eGeo, pGeo, pcol, ppos, E, epos, outLab, training = false, epoch = 0, loss = 0, acc = 0, fw = null, pick = 0, accT = 0, frames = 0, sp, maxN, gap = .82;
  const fwd = x => { const A = [x]; for (let l = 0; l < L - 1; l++) { const z = W[l].map((row, j) => { let s = B[l][j]; for (let i = 0; i < row.length; i++) s += row[i] * A[l][i]; return s; }); if (l === L - 2) { const mx = Math.max.apply(null, z), ex = z.map(v => Math.exp(v - mx)), sm = ex.reduce((a, b) => a + b, 0); A.push(ex.map(v => v / sm)); } else A.push(z.map(v => Math.max(0, v))); } return A; };
  const step = lr => {
    const gW = W.map(m => m.map(r => r.map(() => 0))), gB = B.map(b => b.map(() => 0)); let ls = 0, ok = 0;
    data.forEach(d => {
      const A = fwd(d.x), out = A[L - 1]; ls -= Math.log(out[d.y] + 1e-9); if (out.indexOf(Math.max.apply(null, out)) === d.y) ok++;
      let delta = out.slice(); delta[d.y] -= 1;
      for (let l = L - 2; l >= 0; l--) { const nd = new Array(S[l]).fill(0); for (let j = 0; j < S[l + 1]; j++) { gB[l][j] += delta[j]; for (let i = 0; i < S[l]; i++) { gW[l][j][i] += delta[j] * A[l][i]; nd[i] += W[l][j][i] * delta[j]; } } if (l > 0) delta = nd.map((v, i) => (A[l][i] > 0 ? v : 0)); }
    });
    const n = data.length; for (let l = 0; l < L - 1; l++) for (let j = 0; j < S[l + 1]; j++) { B[l][j] -= lr * gB[l][j] / n; for (let i = 0; i < S[l]; i++) W[l][j][i] -= lr * gW[l][j][i] / n; }
    loss = ls / n; acc = ok / n; epoch++;
  };
  const paintEdges = () => {
    let q = 0; for (let l = 0; l < L - 1; l++) for (let j = 0; j < S[l + 1]; j++) for (let i = 0; i < S[l]; i++) {
      const w = W[l][j][i], m = Math.min(1, Math.abs(w) / 1.3), b = w >= 0 ? [.23, .51, .96] : [.94, .27, .27], gr = [.5, .55, .62];
      for (let v = 0; v < 2; v++) { ecol[q++] = gr[0] + (b[0] - gr[0]) * m; ecol[q++] = gr[1] + (b[1] - gr[1]) * m; ecol[q++] = gr[2] + (b[2] - gr[2]) * m; }
    }
    eGeo.attributes.color.needsUpdate = true;
  };
  const light = (A, tfn) => nodes.forEach((col, l) => { const mx = Math.max.apply(null, A[l]) || 1; col.forEach((m, i) => { const b = (A[l][i] / (l === L - 1 ? 1 : mx)) * tfn(l); const out = l === L - 1; m.material.emissive.setRGB(out ? .1 * b : 1 * b, out ? .9 * b : .62 * b, out ? .45 * b : .15 * b); }); });
  const labels = A => { const out = A[L - 1], best = out.indexOf(Math.max.apply(null, out)); outLab.forEach((s, i) => s.set(nm(i) + ' ' + Math.round(out[i] * 100) + '%' + (i === best ? ' ◀' : ''))); };
  const send = () => { const d = data[(pick++ * 7 + 3) % data.length]; fw = { t: 0, A: fwd(d.x), y: d.y }; };
  const report = () => X.info('<b>' + L + ' layers, ' + S.reduce((a, n, l) => a + (l ? n * S[l - 1] + n : 0), 0) + ' learned numbers</b> (' + E + ' weights shown as lines: <span style="color:#6aa2ff">blue = positive</span>, <span style="color:#ff6b6b">red = negative</span>)<br>round <b>' + epoch + '</b> · loss <b>' + loss.toFixed(3) + '</b> · accuracy <b>' + Math.round(acc * 100) + '%</b><br><span class="proj-note">A real tiny network learning made-up data, running right here in your browser.</span>');
  function build(k) {
    key = k; if (grp) { X.world.remove(grp); X.dispose(grp); } grp = new T.Group(); X.world.add(grp);
    S = PRE[k]; L = S.length; epoch = 0; training = false; fw = null; if (trainB) trainB.textContent = '🎓 Train it'; loss = Math.log(S[L - 1]); acc = 0; maxN = Math.max.apply(null, S); sp = Math.min(3.4, 24 / (L - 1));
    W = []; B = []; for (let l = 0; l < L - 1; l++) { W.push(Array.from({ length: S[l + 1] }, () => Array.from({ length: S[l] }, () => gauss() * Math.sqrt(2 / S[l])))); B.push(new Array(S[l + 1]).fill(0)); }
    const K = S[L - 1], D = S[0], ctr = Array.from({ length: K }, () => Array.from({ length: D }, () => (rnd() * 2 - 1) * 1.6)); data = []; for (let c = 0; c < K; c++) for (let n = 0; n < 12; n++) data.push({ x: ctr[c].map(v => v + gauss() * .5), y: c });
    const pos = S.map((n, l) => Array.from({ length: n }, (_, i) => new T.Vector3((l - (L - 1) / 2) * sp, (i - (n - 1) / 2) * gap, Math.sin(i * 1.9 + l * .7) * .55)));
    nodes = pos.map(col => col.map(p => { const m = new T.Mesh(new T.SphereGeometry(.24, 20, 14), new T.MeshPhongMaterial({ color: 0x5b6b86, emissive: 0x000000, shininess: 90 })); m.position.copy(p); m.castShadow = true; grp.add(m); return m; }));
    E = 0; for (let l = 0; l < L - 1; l++) E += S[l] * S[l + 1];
    epos = new Float32Array(E * 6); ecol = new Float32Array(E * 6); ppos = new Float32Array(E * 3); pcol = new Float32Array(E * 3); let q = 0;
    for (let l = 0; l < L - 1; l++) for (let j = 0; j < S[l + 1]; j++) for (let i = 0; i < S[l]; i++) { const a = pos[l][i], b = pos[l + 1][j]; epos.set([a.x, a.y, a.z, b.x, b.y, b.z], q * 6); q++; }
    eGeo = new T.BufferGeometry(); eGeo.setAttribute('position', new T.BufferAttribute(epos, 3)); eGeo.setAttribute('color', new T.BufferAttribute(ecol, 3));
    grp.add(new T.LineSegments(eGeo, new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .6 })));
    pGeo = new T.BufferGeometry(); pGeo.setAttribute('position', new T.BufferAttribute(ppos, 3)); pGeo.setAttribute('color', new T.BufferAttribute(pcol, 3));
    grp.add(new T.Points(pGeo, new T.PointsMaterial({ size: .24, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false })));
    const below = -(maxN * gap) / 2 - .9;
    for (let l = 0; l < L; l++) { const t = X.label((l === 0 ? 'input' : l === L - 1 ? 'output' : 'hidden ' + l) + ' (' + S[l] + ')', { size: .4, color: '#cfe0ff' }); t.position.set((l - (L - 1) / 2) * sp, below, 0); grp.add(t); }
    outLab = nodes[L - 1].map((m, i) => { const t = X.label(nm(i) + ' 100% ◀', { size: .38, color: '#aef5cf', sample: nm(i) + ' 100% ◀' }); t.set(nm(i)); t.position.set(m.position.x + 1.5, m.position.y, m.position.z); grp.add(t); return t; });
    X.stage(0, below - .9); X.setCam({ th: .45, ph: 1.32, ty: 0 }); X.fit((L - 1) * sp / 2 + 3, maxN * gap / 2 + 1.8); paintEdges(); send(); report();
  }
  const bt = (txt, f) => h('button', { type: 'button', class: 'proj-btn', onclick: f }, txt), trainB = bt('🎓 Train it', () => { training = !training; trainB.textContent = training ? '⏸ Pause training' : '🎓 Train it'; });
  ctl.append(h('div', { class: 'proj-row' }, h('span', { class: 'proj-lab' }, 'Size'), bt('Small 4-6-6-3', () => build('small')), bt('Bigger 8-12-12-12-6-3', () => build('big')), bt('Deep 8 layers', () => build('deep')), h('span', { class: 'proj-lab' }, ' '), bt('▶ Send data through', send), trainB, bt('↺ New weights', () => build(key))));
  build(key);
  return {
    update(dt) {
      if (training) { for (let n = 0; n < 5; n++) step(.12); if (frames % 3 === 0) paintEdges(); if (!fw || fw.t > 99 || frames % 20 === 0) { const d = data[(pick * 7 + 3) % data.length]; fw = { t: 100, A: fwd(d.x), y: d.y }; } }
      frames++;
      if (fw) {
        fw.t += dt; const SEG = .85; light(fw.A, l => pjClamp((fw.t - l * SEG + .15) / .4, 0, 1));
        for (let l = 0, q = 0; l < L - 1; l++) { const p = (fw.t - l * SEG) / SEG; for (let j = 0; j < S[l + 1]; j++) for (let i = 0; i < S[l]; i++, q++) { const a = q * 6, v = p > 0 && p < 1 ? Math.sin(Math.PI * p) : 0, u = pjClamp(p, 0, 1); ppos[q * 3] = epos[a] + (epos[a + 3] - epos[a]) * u; ppos[q * 3 + 1] = epos[a + 1] + (epos[a + 4] - epos[a + 1]) * u; ppos[q * 3 + 2] = epos[a + 2] + (epos[a + 5] - epos[a + 2]) * u; pcol[q * 3] = v; pcol[q * 3 + 1] = v * .9; pcol[q * 3 + 2] = v * .6; } }
        pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
        if (fw.t > (L - 1) * .85 && !fw.done) { fw.done = true; labels(fw.A); }
      }
      accT += dt; if (accT > .25) { accT = 0; report(); if (training && fw) labels(fw.A); }
    },
  };
};

/* ---------- scene: llm ---------- */
PROJ.scenes.llm = (T, X) => {
  const ctl = X.ctl, STAGES = [[['mat', 4.0], ['floor', 3.1], ['sofa', 2.6], ['bed', 2.1], ['moon', .3]], [['.', 3.6], ['and', 2.7], ['while', 1.9], ['today', 1.2], ['quietly', .9]]];
  const NL = 4, GAP = 2.2, LY = k => .45 + (k + 1) * 2.1; let words = ['The', 'cat', 'sat', 'on', 'the'], grp, cubes, arcs, bars, barLabs, probs = [], lt = 0, temp = 1, picked = 0, tempB, pickB;
  const softmax = (lg, tp) => { const z = lg.map(v => v / Math.max(.05, tp)), mx = Math.max.apply(null, z), ex = z.map(v => Math.exp(v - mx)), s = ex.reduce((a, b) => a + b, 0); return ex.map(v => v / s); };
  const score = (i, j, k) => Math.sin(pjHash(words[i]) * 11 + pjHash(words[j]) * 7 + k * 2.1) * 1.5 + (j - i === 1 ? 1 : 0) + (i === 0 ? .4 : 0);
  function build() {
    if (grp) { X.world.remove(grp); X.dispose(grp); } grp = new T.Group(); X.world.add(grp); const n = words.length, PW = n * GAP + 1.6;
    for (let k = 0; k < NL; k++) { const p = new T.Mesh(new T.BoxGeometry(PW, .22, 3.2), new T.MeshPhongMaterial({ color: 0x2a3f6a, transparent: true, opacity: .42, emissive: 0x0b1a3a, shininess: 80 })); p.position.y = LY(k) - .5; grp.add(p); const t = X.label('layer ' + (k + 1) + ': attention + MLP', { size: .42, color: '#a8c4ff' }); t.position.set(-PW / 2 - 1.6, LY(k) - .5, 0); grp.add(t); }
    cubes = words.map((w, i) => { const c = new T.Mesh(new T.BoxGeometry(1.5, .9, .9), new T.MeshPhongMaterial({ color: 0x4488ff, shininess: 70 })); c.castShadow = true; const lb = X.label(w, { size: .62, color: '#ffffff', depthTest: false }); lb.position.set(0, 0, .6); c.add(lb); c.position.set((i - (n - 1) / 2) * GAP, .45, 0); grp.add(c); return c; });
    arcs = []; for (let k = 0; k < NL; k++) for (let j = 1; j < n; j++) { const ex = []; let sum = 0; for (let i = 0; i <= j; i++) { const e = Math.exp(score(i, j, k)); ex.push(e); sum += e; } const mx = Math.max.apply(null, ex.map(v => v / sum)); for (let i = 0; i < j; i++) { const w = ex[i] / sum, xi = cubes[i].position.x, xj = cubes[j].position.x, y = LY(k) + .1, curve = new T.QuadraticBezierCurve3(new T.Vector3(xi, y, 0), new T.Vector3((xi + xj) / 2, y + .5 + (xj - xi) * .22, 0), new T.Vector3(xj, y, 0)); const m = new T.Mesh(new T.TubeGeometry(curve, 24, .02 + .1 * w / mx, 6), new T.MeshBasicMaterial({ color: new T.Color().setHSL(.55 + k * .1, .85, .62), transparent: true, opacity: 0, depthWrite: false })); grp.add(m); arcs.push({ m, k, a: .25 + .75 * w / mx }); } }
    const bx = (n - 1) / 2 * GAP + 4.2, by = LY(NL - 1) + .2; bars = []; barLabs = [];
    for (let c = 0; c < 5; c++) { const b = new T.Mesh(new T.BoxGeometry(.75, 1, .75), new T.MeshPhongMaterial({ color: 0xffb02e, emissive: 0x331a00, shininess: 60 })); b.position.set(bx + c * 1.15, by, 0); b.visible = false; grp.add(b); bars.push(b); const lb = X.label('word 100%', { size: .4, color: '#ffe3a8', sample: 'quietly 100%' }); lb.position.set(bx + c * 1.15, by - .55, 0); lb.visible = false; grp.add(lb); barLabs.push(lb); }
    const cap = X.label('next-word odds', { size: .5, color: '#ffe3a8' }); cap.position.set(bx + 2.3, by + 4.2, 0); grp.add(cap);
    lt = 0; X.stage(0, 0); X.setCam({ th: .5, ph: 1.32, tx: 2.4, ty: 6.2 }); X.fit(n * GAP / 2 + 9.5, 7.8); ratio(); if (pickB) pickB.disabled = picked >= STAGES.length;
  }
  function ratio() {
    const st = STAGES[Math.min(picked, STAGES.length - 1)], tp = softmax(st.map(s => s[1]), temp); probs = tp;
    bars.forEach((b, i) => { barLabs[i].set(st[i][0] + ' ' + Math.round(tp[i] * 100) + '%'); });
    X.info('<b>' + words.join(' ') + ' …</b><br>temperature <b>' + temp.toFixed(2) + '</b>: ' + (temp < .5 ? 'almost always the top word' : temp > 1.6 ? 'adventurous: unlikely words get a real chance' : 'a sensible mix') + '<br><span class="proj-note">Attention arcs and odds are illustrative numbers; the structure (tokens, layers, causal attention, softmax over next words) is the real one.</span>');
  }
  const bt = (txt, f) => h('button', { type: 'button', class: 'proj-btn', onclick: f }, txt); tempB = h('input', { type: 'range', min: '0.1', max: '2.5', step: '0.05', value: '1', class: 'proj-range', 'aria-label': 'temperature', oninput: e => { temp = +e.target.value; ratio(); } });
  pickB = bt('🎲 Pick the next word', () => { if (lt < 7.9 || picked >= STAGES.length) return; const st = STAGES[picked], r = Math.random(); let a = 0, idx = 0; for (let i = 0; i < probs.length; i++) { a += probs[i]; if (r <= a) { idx = i; break; } } words = words.concat(st[idx][0]); picked++; if (picked >= STAGES.length) pickB.disabled = true; build(); });
  ctl.append(h('div', { class: 'proj-row' }, bt('↻ Replay the climb', () => { lt = 0; }), h('span', { class: 'proj-lab' }, 'temperature'), tempB, pickB, bt('↺ Start again', () => { words = ['The', 'cat', 'sat', 'on', 'the']; picked = 0; build(); })));
  build();
  return {
    update(dt) {
      lt += dt; const T_L = 1.5, prog = Math.max(0, (lt - .4) / T_L), kf = Math.min(NL, prog), fin = pjClamp(prog - NL, 0, 1);
      cubes.forEach((c, i) => { c.position.y = .45 + kf * 2.1; c.material.color.setHSL((i * .11 + kf * .09) % 1, .62, .54); });
      arcs.forEach(a => { const up = pjClamp(kf - a.k, 0, 1), later = pjClamp(kf - (a.k + 1.4), 0, 1); a.m.material.opacity = up * (1 - .8 * later) * a.a; });
      const st = STAGES[Math.min(picked, STAGES.length - 1)];
      bars.forEach((b, i) => { const hgt = Math.max(.05, 4 * (probs[i] || 0) * pjEase(fin)); b.visible = fin > 0; barLabs[i].visible = fin > .3; b.scale.y = hgt; b.position.y = LY(NL - 1) + .2 + hgt / 2; b.material.color.setHSL(.1 + .05 * i, .9, .55); });
    },
  };
};

/* ---------- scene: descent (gradient descent on a loss landscape) ---------- */
PROJ.scenes.descent = (T, X) => {
  const ctl = X.ctl, SC = .2, f = (x, z) => .3 * (x * x + z * z) + 3 * Math.sin(.9 * x) * Math.cos(.9 * z), gx = (x, z) => .6 * x + 2.7 * Math.cos(.9 * x) * Math.cos(.9 * z), gz = (x, z) => .6 * z - 2.7 * Math.sin(.9 * x) * Math.sin(.9 * z);
  const N = 80, HALF = 7, geo = new T.PlaneGeometry(HALF * 2, HALF * 2, N, N); geo.rotateX(-Math.PI / 2); const pa = geo.attributes.position, col = new Float32Array(pa.count * 3); let lo = 1e9, hi = -1e9;
  for (let i = 0; i < pa.count; i++) { const y = f(pa.getX(i), pa.getZ(i)); pa.setY(i, y * SC); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  for (let i = 0; i < pa.count; i++) { const k = pjClamp((pa.getY(i) / SC - lo) / (hi - lo), 0, 1), c = new T.Color().setHSL(.48 - .48 * Math.pow(k, .8), .8, .5); col.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const surf = new T.Mesh(geo, new T.MeshPhongMaterial({ vertexColors: true, shininess: 40, side: T.DoubleSide, transparent: true, opacity: .93 })); X.world.add(surf);
  X.world.add(new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: .07 })));
  const ball = new T.Mesh(new T.SphereGeometry(.34, 24, 16), new T.MeshPhongMaterial({ color: 0xffd23f, emissive: 0x6b4a00, shininess: 120 })); X.world.add(ball);
  const MAXP = 600, tg = new T.BufferGeometry(), tp = new Float32Array(MAXP * 3); tg.setAttribute('position', new T.BufferAttribute(tp, 3)); tg.setDrawRange(0, 0); const trail = new T.Line(tg, new T.LineBasicMaterial({ color: 0xffffff })); trail.frustumCulled = false; X.world.add(trail);
  const arrow = new T.ArrowHelper(new T.Vector3(0, -1, 0), new T.Vector3(), 1.8, 0xffffff, .5, .3); X.world.add(arrow);
  X.stage(0, -1.2); X.setCam({ th: .9, ph: 1.0, ty: 1.4 }); X.fit(11.5, 7.5);
  const STARTS = [[-5.5, 4.5], [5, -3], [1.5, 5.5]]; let x = 0, z = 0, steps = 0, np = 0, run = true, lrV = 40, state = 'running', acc = 0, tx = 0, tz = 0, g2 = 0;
  const lr = () => .02 * Math.pow(200, lrV / 100), bt = (txt, fn) => h('button', { type: 'button', class: 'proj-btn', onclick: fn }, txt);
  const addP = () => { if (np < MAXP) { tp.set([x, f(x, z) * SC + .06, z], np * 3); np++; tg.setDrawRange(0, np); tg.attributes.position.needsUpdate = true; } };
  const report = () => { const fv = f(x, z), msg = state === 'exploded' ? '<b style="color:#ff8a8a">It blew up:</b> the learning rate is too big, so every step overshoots the valley and lands higher up. This is why training "diverges".' : state === 'settled' ? '<b style="color:#8affc1">Settled in a valley.</b> The slope is almost flat. Try another start: a different valley can be reached, and it may not be the deepest one.' : 'Rolling downhill: each step moves against the slope.'; X.info('step <b>' + steps + '</b> · loss <b>' + fv.toFixed(3) + '</b> · slope <b>' + Math.sqrt(g2).toFixed(3) + '</b> · learning rate <b>' + lr().toFixed(3) + '</b><br>' + msg); };
  const reset = i => { x = tx = STARTS[i][0]; z = tz = STARTS[i][1]; steps = 0; np = 0; state = 'running'; run = true; addP(); ball.position.set(x, f(x, z) * SC + .34, z); report(); };
  const lrIn = h('input', { type: 'range', min: '0', max: '100', step: '1', value: String(lrV), class: 'proj-range', 'aria-label': 'learning rate', oninput: e => { lrV = +e.target.value; report(); } });
  ctl.append(h('div', { class: 'proj-row' }, h('span', { class: 'proj-lab' }, 'learning rate (step size)'), lrIn, bt('⏯ Run / pause', () => { run = !run; }), bt('Start A', () => reset(0)), bt('Start B', () => reset(1)), bt('Start C', () => reset(2))));
  reset(0);
  return {
    update(dt) {
      if (run && state === 'running') {
        acc += dt; while (acc > .09) {
          acc -= .09; const a = gx(x, z), b = gz(x, z); g2 = a * a + b * b; x -= lr() * a; z -= lr() * b; steps++;
          if (!isFinite(x) || !isFinite(z) || Math.abs(x) > 11 || Math.abs(z) > 11) { x = pjClamp(x, -HALF, HALF); z = pjClamp(z, -HALF, HALF); state = 'exploded'; addP(); break; }
          tx = x; tz = z; addP(); if (g2 < 4e-4 && steps > 3) { state = 'settled'; break; } if (steps > 500) { state = 'settled'; break; }
        } report();
      }
      const bx = ball.position.x + (tx - ball.position.x) * Math.min(1, dt * 9), bz = ball.position.z + (tz - ball.position.z) * Math.min(1, dt * 9); ball.position.set(bx, f(bx, bz) * SC + .34, bz);
      const a = gx(bx, bz), b = gz(bx, bz), d = new T.Vector3(-a, -(a * a + b * b) * SC, -b); arrow.visible = d.length() > .02 && state === 'running'; if (arrow.visible) { arrow.setDirection(d.normalize()); arrow.position.copy(ball.position); }
    },
  };
};

/* ---------- scene: rag (retrieval-augmented generation, step by step) ----------
   1 chunks of text sit on a MAP OF MEANING (close = similar meaning), grouped by topic
   2 the question is turned into numbers and lands on the same map
   3 a search circle grows until it holds the k nearest chunks (and only those are fetched)
   4 the fetched chunks are pasted into the PROMPT together with the question
   5 the language model writes the ANSWER from that prompt (here the "model" only joins the chunks; a real one rewrites them in its own words) */
PROJ.scenes.rag = (T, X, o) => {
  const ctl = X.ctl, DEF = {
    points: [{ x: .12, y: .22, label: '7-day refunds', text: 'Refunds are paid back within 7 days' }, { x: .22, y: .12, label: 'refund form', text: 'Fill in the refund form on the orders page' }, { x: .26, y: .3, label: 'money-back rule', text: 'Unused plans get a full money-back' }, { x: .76, y: .2, label: 'delivery times', text: 'Orders ship in 2-4 working days' }, { x: .86, y: .32, label: 'tracking', text: 'Track a parcel with the link in your email' }, { x: .7, y: .34, label: 'courier fees', text: 'Courier fees depend on weight' }, { x: .18, y: .76, label: 'plans', text: 'Pro and Team plans compared' }, { x: .3, y: .88, label: 'discounts', text: 'Students get 40% off yearly plans' }, { x: .08, y: .9, label: 'invoices', text: 'Download invoices from Billing' }, { x: .62, y: .8, label: 'passwords', text: 'Reset a password from the sign-in page' }, { x: .78, y: .9, label: '2-factor', text: 'Turn on two-factor sign-in in Security' }, { x: .86, y: .72, label: 'data privacy', text: 'We never sell your data' }],
    query: { x: .2, y: .27, label: 'How do I get my money back?' }, k: 3, regions: [{ x: .18, y: .1, name: 'REFUNDS' }, { x: .78, y: .08, name: 'SHIPPING' }, { x: .2, y: .98, name: 'PRICING' }, { x: .76, y: 1.0, name: 'SECURITY' }],
  };
  const PAL = [0x4aa8ff, 0xffa24a, 0x5cf0a8, 0xd78bff, 0xff6b9a, 0xf3e45a], WX = 14, WZ = 9, mx = x => (x - .5) * WX, mz = y => (y - .5) * WZ, CY = 1.25, OY = 2.7;
  let grp, sp = DEF, kUse = 3, lt = 0, cards = [], orb = null, searchRing = null, searchDisc = null, beams = [], dists = [], flows = [], promptP = null, answerP = null, near = [], hits = {}, topicOf = [], SR = 1, ph = -1, tm = {}, replayB, kSlider, kLab;
  const hex = c => '#' + new T.Color(c).getHexString();
  const wrapText = (g, text, x, y, maxW, lh, maxLines) => { const words = String(text).split(' '); let line = '', n = 0; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; if (++n >= maxLines - 1) { const rest = words.slice(words.indexOf(w)).join(' '); g.fillText(g.measureText(rest).width > maxW ? rest.slice(0, Math.floor(rest.length * maxW / g.measureText(rest).width) - 1) + '…' : rest, x, y); return y + lh; } } else line = t; } g.fillText(line, x, y); return y + lh; };
  const panel = (w, hh, draw) => {
    const cv = document.createElement('canvas'); cv.width = 1100; cv.height = Math.round(1100 * hh / w); const g = cv.getContext('2d');
    g.fillStyle = 'rgba(7,12,34,.94)'; g.strokeStyle = 'rgba(150,200,255,.9)'; g.lineWidth = 7; g.beginPath(); if (g.roundRect) g.roundRect(6, 6, cv.width - 12, cv.height - 12, 34); else g.rect(6, 6, cv.width - 12, cv.height - 12); g.fill(); g.stroke(); draw(g, cv.width, cv.height);
    const m = new T.Mesh(new T.PlaneGeometry(w, hh), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: false })); m.renderOrder = 6; m.visible = false; return m;
  };
  const clean = t => String(t || '').replace(/[.\s]+$/, '');
  function build(spec) {
    sp = spec && spec.points ? spec : DEF; if (grp) { X.world.remove(grp); X.dispose(grp); } grp = new T.Group(); X.world.add(grp); lt = 0; hits = {}; ph = -1; beams = []; dists = []; flows = []; kLab && (kLab.textContent = kUse);
    const q = sp.query, kk = Math.max(1, Math.min(kUse, sp.points.length)), dn = p => Math.hypot(p.x - q.x, p.y - q.y), dw = p => Math.hypot(mx(p.x) - mx(q.x), mz(p.y) - mz(q.y));
    const order = sp.points.map((p, i) => i).sort((a, b) => dn(sp.points[a]) - dn(sp.points[b])); near = order.slice(0, kk);
    SR = dw(sp.points[near[near.length - 1]]) + .45;
    const regs = sp.regions && sp.regions.length ? sp.regions : [{ x: .5, y: .5, name: 'CHUNKS' }];
    topicOf = sp.points.map(p => { let bi = 0, bd = 1e9; regs.forEach((r, i) => { const d = Math.hypot(p.x - r.x, p.y - r.y); if (d < bd) { bd = d; bi = i; } }); return bi; });
    const grid = new T.GridHelper(WX, 14, 0x6fb4ff, 0x24468c); grid.scale.z = WZ / WX; grid.position.y = .01; grid.material.transparent = true; grid.material.opacity = .5; grp.add(grid);
    const ax = X.label('MAP OF MEANING: chunks with a similar meaning sit close together', { size: .34, color: '#cfe2ff' }); ax.position.set(0, .06, -WZ / 2 - .95); grp.add(ax);
    regs.forEach((r, ri) => {
      const mem = sp.points.map((p, i) => i).filter(i => topicOf[i] === ri); if (!mem.length) return; let cx = 0, cz = 0; mem.forEach(i => { cx += mx(sp.points[i].x); cz += mz(sp.points[i].y); }); cx /= mem.length; cz /= mem.length;
      let rd = 0; mem.forEach(i => { rd = Math.max(rd, Math.hypot(mx(sp.points[i].x) - cx, mz(sp.points[i].y) - cz)); }); rd += 1.05; const col = PAL[ri % PAL.length];
      const disc = new T.Mesh(new T.CircleGeometry(rd, 56), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .2, side: T.DoubleSide, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.set(cx, .03, cz); grp.add(disc);
      const rim = new T.Mesh(new T.RingGeometry(rd - .06, rd, 72), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .85, side: T.DoubleSide, depthWrite: false })); rim.rotation.x = -Math.PI / 2; rim.position.set(cx, .04, cz); grp.add(rim);
      const tl = X.label(r.name, { size: .52, color: hex(col) }); tl.position.set(cx, .08, cz - rd - .42); grp.add(tl);
    });
    cards = sp.points.map((p, i) => {
      const col = PAL[topicOf[i] % PAL.length], g = new T.Group(), body = new T.Mesh(new T.BoxGeometry(.95, 1.2, .09), new T.MeshPhongMaterial({ color: col, emissive: col, emissiveIntensity: .4, transparent: true, opacity: 1 })); g.add(body);
      for (let s = 0; s < 4; s++) { const ln = new T.Mesh(new T.BoxGeometry(s === 3 ? .4 : .72, .07, .02), new T.MeshBasicMaterial({ color: 0xffffff })); ln.position.set(s === 3 ? -.15 : 0, .38 - s * .21, .07); g.add(ln); }
      const lb = X.label(p.label, { size: .34, color: '#ffffff' }); lb.position.set(0, -.98, 0); g.add(lb);
      g.position.set(mx(p.x), CY, mz(p.y)); g.scale.setScalar(.001); g.userData = { i, body, lb, y: CY }; grp.add(g);
      const pole = new T.Mesh(new T.CylinderGeometry(.018, .018, CY - .6, 6), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .75 })); pole.position.set(mx(p.x), (CY - .6) / 2, mz(p.y)); grp.add(pole);
      const dot = new T.Mesh(new T.CircleGeometry(.13, 16), new T.MeshBasicMaterial({ color: col })); dot.rotation.x = -Math.PI / 2; dot.position.set(mx(p.x), .05, mz(p.y)); grp.add(dot);
      return g;
    });
    orb = new T.Group(); orb.add(new T.Mesh(new T.SphereGeometry(.38, 24, 16), new T.MeshBasicMaterial({ color: 0xffd23f })));
    orb.add(new T.Mesh(new T.SphereGeometry(.7, 24, 16), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .24, depthWrite: false, blending: T.AdditiveBlending })));
    const ql = X.label('? ' + q.label, { size: .5, color: '#ffe9a0' }); ql.position.set(0, 1.2, 0); orb.add(ql); orb.position.set(mx(q.x), OY, mz(q.y)); orb.visible = false; grp.add(orb);
    const qpole = new T.Mesh(new T.CylinderGeometry(.03, .03, OY, 8), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .8 })); qpole.position.set(mx(q.x), OY / 2, mz(q.y)); qpole.visible = false; orb.userData.pole = qpole; grp.add(qpole);
    const qdot = new T.Mesh(new T.CircleGeometry(.2, 20), new T.MeshBasicMaterial({ color: 0xffd23f })); qdot.rotation.x = -Math.PI / 2; qdot.position.set(mx(q.x), .07, mz(q.y)); qdot.visible = false; orb.userData.dot = qdot; grp.add(qdot);
    searchDisc = new T.Mesh(new T.CircleGeometry(1, 64), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .13, side: T.DoubleSide, depthWrite: false })); searchDisc.rotation.x = -Math.PI / 2; searchDisc.position.set(mx(q.x), .05, mz(q.y)); searchDisc.visible = false; grp.add(searchDisc);
    searchRing = new T.Mesh(new T.RingGeometry(.96, 1, 96), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .95, side: T.DoubleSide, depthWrite: false })); searchRing.rotation.x = -Math.PI / 2; searchRing.position.set(mx(q.x), .06, mz(q.y)); searchRing.visible = false; grp.add(searchRing);
    const sl = X.label('search circle: the ' + kk + ' nearest chunks', { size: .36, color: '#ffe9a0' }); sl.position.set(mx(q.x), .12, mz(q.y) + SR + .5); sl.visible = false; searchRing.userData.lab = sl; grp.add(sl);
    near.forEach((idx, n) => {
      const c = new T.Mesh(new T.CylinderGeometry(.06, .06, 1, 8).translate(0, .5, 0), new T.MeshBasicMaterial({ color: 0x5cf0a8 })); c.visible = false; grp.add(c); beams.push({ c, idx, n });
      const dl = X.label('distance ' + dn(sp.points[idx]).toFixed(2), { size: .3, color: '#bff7da' }); dl.visible = false; grp.add(dl); dists.push(dl);
    });
    const texts = near.map(i => clean(sp.points[i].text || sp.points[i].label));
    promptP = panel(6.2, 3.5, (g, w, hh) => { g.fillStyle = '#9fd0ff'; g.font = '700 38px system-ui,sans-serif'; g.fillText('PROMPT (what the model is given)', 48, 78); g.fillStyle = '#ffe9a0'; g.font = '600 40px system-ui,sans-serif'; let y = wrapText(g, 'Question: ' + q.label, 48, 150, w - 96, 50, 2); g.fillStyle = '#bff7da'; g.font = '600 36px system-ui,sans-serif'; g.fillText('Use only these ' + kk + ' chunks:', 48, y + 22); g.fillStyle = '#ffffff'; g.font = '500 37px system-ui,sans-serif'; y += 76; texts.forEach((t, n) => { y = wrapText(g, (n + 1) + '. ' + t, 48, y, w - 96, 46, 2); }); });
    const ans = texts.length ? texts.slice(0, 2).join('; ') : 'No chunk was fetched'; const answer = ans.charAt(0).toUpperCase() + ans.slice(1) + '.';
    answerP = panel(6.2, 3.1, (g, w, hh) => { g.fillStyle = '#9fd0ff'; g.font = '700 38px system-ui,sans-serif'; g.fillText('ANSWER (written from those chunks)', 48, 78); g.fillStyle = '#ffffff'; g.font = '600 44px system-ui,sans-serif'; wrapText(g, answer, 48, 156, w - 96, 56, 3); g.fillStyle = '#8fa6d6'; g.font = '500 31px system-ui,sans-serif'; wrapText(g, 'Sources: ' + near.map(i => sp.points[i].label).join(', ') + '. Here the model only joins the chunks; a real one rewrites them.', 48, hh - 96, w - 96, 40, 2); });
    promptP.position.set(-.2, 4.0, -WZ / 2 - 1.2); answerP.position.set(6.1, 3.8, -WZ / 2 - 1.2); grp.add(promptP, answerP);
    flows = near.map((idx, n) => { const a = new T.Vector3(mx(sp.points[idx].x), CY + .5, mz(sp.points[idx].y)), b = promptP.position.clone().add(new T.Vector3(0, -1.75, 0)), m = a.clone().lerp(b, .5).add(new T.Vector3(0, 2.2, 0)), curve = new T.QuadraticBezierCurve3(a, m, b), pts = curve.getPoints(48), geo = new T.BufferGeometry().setFromPoints(pts), line = new T.Line(geo, new T.LineBasicMaterial({ color: 0x5cf0a8, transparent: true, opacity: .95 })); geo.setDrawRange(0, 0); line.visible = false; grp.add(line); const dot = new T.Mesh(new T.SphereGeometry(.12, 10, 8), new T.MeshBasicMaterial({ color: 0xffffff })); dot.visible = false; grp.add(dot); return { line, dot, curve, n }; });
    const ab = new T.Vector3().copy(promptP.position).add(new T.Vector3(3.1, 0, 0)), bb = answerP.position.clone().add(new T.Vector3(-3.1, 0, 0)), ac = new T.QuadraticBezierCurve3(ab, ab.clone().lerp(bb, .5).add(new T.Vector3(0, .9, 0)), bb), ag = new T.BufferGeometry().setFromPoints(ac.getPoints(30)), al = new T.Line(ag, new T.LineBasicMaterial({ color: 0xffd23f })); ag.setDrawRange(0, 0); al.visible = false; grp.add(al); flows.arrow = { line: al, geo: ag };
    const t0 = cards.length * .1 + .9; tm = { orb: t0, ring: t0 + 1.3, beams: t0 + 3.0, prompt: t0 + 4.9, answer: t0 + 7.0 };
    X.stage(0, 0); X.setCam({ th: .26, ph: .86, ty: 2.5 }); X.fit(WX / 2 + 2.6, 7.4);
    X.info('<b>1 · The library is on a map.</b><br>Each card is a chunk of text. Chunks with a similar meaning sit close together, so topics form islands.');
  }
  const note = html => X.info(html), phase = n => {
    if (n === ph) return; ph = n;
    if (n === 1) note('<b>2 · The question lands on the map.</b><br>It is turned into numbers, exactly like the chunks were, so it lands where its meaning belongs.');
    if (n === 2) note('<b>3 · Search: grow a circle.</b><br>The circle grows until it holds the <b>' + near.length + '</b> nearest chunks. Only those are fetched; the rest are ignored.');
    if (n === 3) note('<b>3 · The nearest chunks, closest first.</b><br>' + near.map((i, k) => '<b>#' + (k + 1) + '</b> ' + picEsc(sp.points[i].text || sp.points[i].label) + ' <span class="proj-note">(distance ' + Math.hypot(sp.points[i].x - sp.query.x, sp.points[i].y - sp.query.y).toFixed(2) + ')</span>').join('<br>'));
    if (n === 4) note('<b>4 · Augment: paste them into the prompt.</b><br>The fetched chunks travel into the prompt next to the question. This is the "retrieval-augmented" part: the model is handed the facts.');
    if (n === 5) note('<b>5 · Generate: the model answers.</b><br>It writes the answer from the prompt, so it can quote your own documents instead of guessing. Move the slider to fetch more or fewer chunks and ask again.');
  };
  replayB = h('button', { type: 'button', class: 'proj-btn', onclick: () => build(sp) }, '↻ Ask again');
  kLab = h('b', {}, String(kUse)); kSlider = h('input', { type: 'range', min: '1', max: '5', value: String(kUse), 'aria-label': 'how many chunks to fetch', oninput: e => { kUse = +e.target.value; build(sp); } });
  ctl.append(h('div', { class: 'proj-row' }, replayB, h('label', { class: 'proj-note' }, 'chunks to fetch (k) ', kSlider, ' ', kLab), h('span', { class: 'proj-note' }, 'A real system does this with hundreds of numbers per chunk instead of two.')));
  build(o && o.points ? o : null);
  return {
    apply: s => { if (s && s.type === 'vecmap') build(s); },
    update(dt) {
      lt += dt; const camP = X.cam.position, V = pjClamp;
      cards.forEach((g, i) => {
        const k = pjEase(V((lt - i * .1) / .6, 0, 1)), isHit = near.indexOf(i) >= 0, reveal = lt > tm.ring + .35 + (isHit ? 0 : 99), picked = isHit && lt > tm.ring + 1.0, dim = !isHit && lt > tm.beams;
        g.scale.setScalar(Math.max(.001, k * (picked ? 1.3 : 1))); g.position.y = g.userData.y + (picked ? .4 + Math.sin(lt * 3) * .06 : 0); g.rotation.y = Math.atan2(camP.x - g.position.x, camP.z - g.position.z);
        g.userData.body.material.opacity = dim ? .22 : 1; g.userData.body.material.emissiveIntensity = picked ? 1 : .4; g.userData.lb.material.opacity = dim ? .3 : 1;
      });
      const qk = pjEase(V((lt - tm.orb) / .9, 0, 1)); orb.visible = lt > tm.orb; orb.userData.pole.visible = orb.userData.dot.visible = lt > tm.orb + .8; orb.position.y = OY + (1 - qk) * 6 + Math.sin(lt * 2) * .07; if (lt > tm.orb) phase(Math.max(ph, 1));
      const rk = pjEase(V((lt - tm.ring) / 1.3, 0, 1)); searchRing.visible = searchDisc.visible = lt > tm.ring; searchRing.userData.lab.visible = rk >= 1; searchRing.scale.setScalar(Math.max(.01, rk * SR)); searchDisc.scale.setScalar(Math.max(.01, rk * SR)); if (lt > tm.ring) phase(Math.max(ph, 2));
      beams.forEach(b => {
        const s = tm.beams + b.n * .45, p = pjEase(V((lt - s) / .55, 0, 1)); b.c.visible = dists[b.n].visible = p > 0; if (!p) return;
        const a = orb.position, c = cards[b.idx].position, dir = new T.Vector3().subVectors(c, a), len = dir.length(); b.c.position.copy(a); b.c.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize()); b.c.scale.set(1, len * p, 1); dists[b.n].position.copy(a).lerp(c, .5).add(new T.Vector3(0, .55, 0)); if (p >= 1) phase(Math.max(ph, 3));
      });
      promptP.visible = lt > tm.prompt; if (promptP.visible) { promptP.rotation.y = Math.atan2(camP.x - promptP.position.x, camP.z - promptP.position.z); promptP.scale.setScalar(pjEase(V((lt - tm.prompt) / .6, 0, 1)) || .001); phase(Math.max(ph, 4)); }
      flows.forEach(f => { const p = pjEase(V((lt - tm.prompt + .6 - f.n * .35) / 1.2, 0, 1)); f.line.visible = p > 0; f.line.geometry.setDrawRange(0, Math.floor(p * 49)); f.dot.visible = p > 0 && p < 1; if (f.dot.visible) f.dot.position.copy(f.curve.getPoint(p)); });
      answerP.visible = lt > tm.answer; if (answerP.visible) { answerP.rotation.y = Math.atan2(camP.x - answerP.position.x, camP.z - answerP.position.z); answerP.scale.setScalar(pjEase(V((lt - tm.answer) / .6, 0, 1)) || .001); phase(5); }
      const ar = flows.arrow; ar.line.visible = lt > tm.answer - .8; ar.geo.setDrawRange(0, Math.floor(pjEase(V((lt - tm.answer + .8) / .8, 0, 1)) * 31));
    },
  };
};

/* ---------- the page that lists the scenes ---------- */
function viewProjection() {
  const root = h('div', { class: 'stack picture' }), ok = PROJ.webgl();
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Workshop'), h('h1', {}, '3D Projection'),
    h('p', { class: 'muted lead' }, 'Bring the picture out of the page. A see-through 3D layer is laid over the whole screen, like a projector aimed at the room: the object floats on top of the app, casts a shadow, and shifts a little as you move the mouse. Keep using the page underneath, or switch on "Hands on" to grab the object and turn it. It is a separate option; the flat Picture Classes are unchanged.'))));
  if (!ok) root.append(h('div', { class: 'callout warn' }, '3D drawing (WebGL) is switched off or not available in this browser, so the projection cannot start here. The flat Picture Classes still work.'));
  root.append(h('div', { class: 'mods' }, PROJ.list.map(s => h('div', { class: 'card mod' }, h('span', { class: 'ic', style: { background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: '22px' } }, s.icon), h('h4', {}, s.title), h('p', {}, s.sub),
    h('button', { class: 'btn primary', type: 'button', disabled: !ok, onclick: () => PROJ.open(s.id) }, '🌐 Project it on my screen')))));
  root.append(h('div', { class: 'card pad stack' }, h('h3', {}, 'Tips'), h('ul', { class: 'syl' }, h('li', { html: 'Press <b>Esc</b> or the ✕ to close it. The ⛶ button makes the whole screen the projection.' }), h('li', { html: 'Open a Picture Class lesson and press <b>🌐 Project in 3D</b>: the 3D object follows the lesson step by step (the car takes each step matrix).' }), h('li', {}, 'Switch the scenes with the tabs at the bottom without closing it.'))));
  return root;
}
