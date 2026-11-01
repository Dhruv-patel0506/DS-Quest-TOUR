'use strict';
/* =====================================================================
   PIC3: the 3D and Overlay modes of the Picture Classes.
   Every lesson picture can be shown three ways, and all three can be touched:
     2D       the flat animated picture (hover for values, sliders, buttons, drag)
     3D       the same idea as a real 3D object inside the lesson (drag to turn, Ctrl + wheel to zoom, buttons and sliders under it)
     Overlay  a floating 3D window about half the size of the screen, only when you ask for it; the lesson stays where it is, the window follows the steps
   Scenes use the same (T, X, spec) contract as PROJ.scenes (the full-screen projection): PIC3.scenes adds the data pictures (hist, regress, cluster, tree, conv, table, matrix, trace, pipeline).
   ===================================================================== */
const PIC3 = { scenes: {}, win: null };

/* which 3D scene draws a given 2D scene spec (null = no 3D version yet) */
PIC3.pick = sp => {
  const t = sp && sp.type;
  if (t === 'net') return { name: 'net', spec: { sizes: sp.sizes, names: sp.names, seed: sp.seed, input: sp.input } };
  if (t === 'llm') return { name: 'llm', spec: {} };
  if (t === 'vecmap') return { name: 'rag', spec: sp };
  if (t === 'car') return { name: 'car', spec: sp };
  if (t === 'plot') return { name: 'regress', spec: PIC3.plotAsRegress(sp) };
  if (t === 'matrix') return { name: 'table', spec: PIC3.matrixAsTable(sp) };
  if (PIC3.scenes[t]) return { name: t, spec: sp };
  return null;
};
PIC3.plotAsRegress = sp => ({ type: 'regress', mode: sp.fit ? 'guess' : 'guess', pts: sp.pts || [], xr: [sp.xmin || 0, sp.xmax || 10], yr: [0, sp.ymax || 10], xlab: sp.xlab, ylab: sp.ylab, line: sp.fit && sp.pts.length > 1 ? (() => { const n = sp.pts.length, mx = PIC.math.mean(sp.pts.map(p => p[0])), my = PIC.math.mean(sp.pts.map(p => p[1])); let a = 0, b = 0; sp.pts.forEach(p => { a += (p[0] - mx) * (p[1] - my); b += (p[0] - mx) * (p[0] - mx); }); const w = a / b; return [w, my - w * mx]; })() : null, joined: sp.kind === 'line', bars: sp.kind === 'bar' });
PIC3.matrixAsTable = sp => ({ type: 'table', matrices: (sp.items || []).filter(i => i.m).map(i => ({ m: i.m, name: i.name || '', color: i.color })), cap: sp.cap });

/* mounts a 3D view in `box`; returns { show(name, spec), close(), el } or null when WebGL is missing */
PIC3.mount = async function (box, o) {
  o = o || {}; box.innerHTML = '';
  if (!PROJ.webgl()) { box.append(h('div', { class: 'callout warn' }, '3D drawing (WebGL) is switched off or not available in this browser. The 2D pictures still work.')); return null; }
  try { await PROJ.load(); } catch (e) { box.append(h('div', { class: 'callout warn' }, e.message)); return null; }
  const T = window.THREE, reduce = picReduce();
  box.classList.add('pic3');
  const cv = h('canvas', { class: 'pic3-cv', tabindex: '0', 'aria-label': '3D picture: drag to turn it' }), info = h('div', { class: 'pic3-info', 'aria-live': 'polite' }), hint = h('div', { class: 'pic3-hint' }, o.wheel ? 'drag to turn · wheel to zoom' : 'drag to turn · Ctrl + wheel to zoom'), view = h('div', { class: 'pic3-view' }, cv, info, hint), ctl = h('div', { class: 'pic3-ctl' });
  box.append(view, ctl);
  const r = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); r.setClearColor(0x000000, 0); r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(38, 1.6, .1, 400), world = new T.Group(); scene.add(world);
  scene.add(new T.HemisphereLight(0xdbe8ff, 0x1c2a44, .9));
  const sun = new T.DirectionalLight(0xffffff, .95); sun.position.set(7, 13, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 45 }); sun.shadow.bias = -.0008; scene.add(sun);
  const rim = new T.PointLight(0x4aa8ff, .9, 70); rim.position.set(-8, 5, -7); scene.add(rim);
  const floor = new T.Mesh(new T.PlaneGeometry(90, 90), new T.ShadowMaterial({ opacity: .3 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const stage = new T.Group(); scene.add(stage);
  const kill = ob => ob.traverse(n => { if (n.geometry) n.geometry.dispose(); const m = n.material; if (m) (Array.isArray(m) ? m : [m]).forEach(mm => { if (mm.map) mm.map.dispose(); mm.dispose(); }); });
  const cs = { th: .7, ph: 1.1, d: 18, tx: 0, ty: 1, tz: 0, th2: .7, ph2: 1.1, d2: 18 }, inst = { dead: false, name: '', scene: null, el: box };
  let drag = null, last = performance.now(), T0 = last, raf = 0, X = null;
  const size = () => { const w = Math.max(200, view.clientWidth), hh = Math.max(160, view.clientHeight); r.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); if (X && X.onResize) X.onResize(); };
  const mkStage = (R, y) => { while (stage.children.length) { const c = stage.children[0]; stage.remove(c); kill(c); } stage.position.y = y || 0; floor.position.y = (y || 0) - .002; if (!R) return; const m = new T.Mesh(new T.RingGeometry(R - .05, R, 112), new T.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: .6, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; stage.add(m); };
  inst.show = (name, spec) => {
    const fn = PROJ.scenes[name] || PIC3.scenes[name];
    if (inst.scene && inst.scene.dispose) { try { inst.scene.dispose(); } catch (e) { console.error(e); } }
    while (world.children.length) { const c = world.children[0]; world.remove(c); kill(c); }
    ctl.replaceChildren(); info.innerHTML = ''; mkStage(0, 0); inst.name = name; inst.scene = null;
    if (!fn) { info.innerHTML = 'There is no 3D version of this picture yet.'; return; }
    X = {
      T, world, cam, cs, ctl, onResize: null, rng: pjRng, info: html => { info.innerHTML = html; }, label: (t, op) => pjLabel(T, t, op), stage: mkStage, dispose: kill,
      setCam: c => { Object.assign(cs, c); cs.th2 = cs.th; cs.ph2 = cs.ph; cs.d2 = cs.d; },
      fit: (hw, hh) => { const th = Math.tan(19 * Math.PI / 180); cs.d2 = cs.d = pjClamp(Math.max(hw / (th * cam.aspect), hh / th) * 1.08, 4, 80); },
    };
    try { inst.scene = fn(T, X, spec || {}); } catch (e) { console.error(e); info.innerHTML = '<b>This 3D picture could not be built:</b> ' + picEsc(e.message); }
  };
  inst.close = () => { if (inst.dead) return; inst.dead = true; cancelAnimationFrame(raf); ro.disconnect(); if (inst.scene && inst.scene.dispose) { try { inst.scene.dispose(); } catch (e) { } } kill(scene); r.dispose(); try { r.forceContextLoss(); } catch (e) { } box.classList.remove('pic3'); box.innerHTML = ''; };
  inst.render = () => r.render(scene, cam);
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (x) { } cv.classList.add('grab'); });
  cv.addEventListener('pointermove', e => { if (!drag) return; cs.th2 -= (e.clientX - drag.x) * .008; cs.ph2 = pjClamp(cs.ph2 - (e.clientY - drag.y) * .006, .12, 1.55); drag.x = e.clientX; drag.y = e.clientY; });
  const up = () => { drag = null; cv.classList.remove('grab'); }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { if (!o.wheel && !e.ctrlKey && !e.altKey) return; e.preventDefault(); cs.d2 = pjClamp(cs.d2 * Math.exp(e.deltaY * .001), 3, 80); }, { passive: false });
  cv.addEventListener('keydown', e => { const k = { ArrowLeft: [-.15, 0], ArrowRight: [.15, 0], ArrowUp: [0, -.1], ArrowDown: [0, .1] }[e.key]; if (k) { e.preventDefault(); cs.th2 += k[0]; cs.ph2 = pjClamp(cs.ph2 + k[1], .12, 1.55); } else if (e.key === '+' || e.key === '=') cs.d2 = pjClamp(cs.d2 * .9, 3, 80); else if (e.key === '-') cs.d2 = pjClamp(cs.d2 * 1.1, 3, 80); });
  const ro = new ResizeObserver(size); ro.observe(view);
  const frame = now => {
    if (inst.dead) return; if (!box.isConnected) { inst.close(); return; } raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000), t = (now - T0) / 1000; last = now; const k = Math.min(1, dt * 7);
    cs.th += (cs.th2 - cs.th) * k; cs.ph += (cs.ph2 - cs.ph) * k; cs.d += (cs.d2 - cs.d) * k;
    cam.position.set(cs.tx + cs.d * Math.sin(cs.ph) * Math.sin(cs.th), cs.ty + cs.d * Math.cos(cs.ph), cs.tz + cs.d * Math.sin(cs.ph) * Math.cos(cs.th)); cam.lookAt(cs.tx, cs.ty, cs.tz);
    if (inst.scene && inst.scene.update) { try { inst.scene.update(dt, t); } catch (e) { console.error(e); inst.scene.update = null; } }
    r.render(scene, cam);
  };
  size(); raf = requestAnimationFrame(frame); PIC3.last = inst; return inst;
};

/* the floating half-screen window */
PIC3.openWindow = async function (name, spec, title) {
  if (PIC3.win && !PIC3.win.dead) { PIC3.win.show(name, spec, title); return PIC3.win; }
  const W = Math.max(420, Math.round(window.innerWidth * .5)), H = Math.max(340, Math.round(window.innerHeight * .5));
  const body = h('div', { class: 'pic3w-body' }), ttl = h('span', { class: 'pic3w-title' }, title || '3D'), full = h('button', { type: 'button', class: 'pic3w-b', title: 'Full-screen projection over the whole app', onclick: () => { if (win.name) PROJ.open(win.name, win.spec); } }, '⛶'), x = h('button', { type: 'button', class: 'pic3w-b', title: 'Close', 'aria-label': 'Close the 3D window', onclick: () => win.close() }, '✕');
  const head = h('div', { class: 'pic3w-head' }, ttl, h('span', { class: 'pic3w-sp' }), full, x), el = h('div', { class: 'pic3w', role: 'dialog', 'aria-label': '3D window', style: { width: W + 'px', height: H + 'px', left: Math.max(8, window.innerWidth - W - 20) + 'px', top: Math.max(8, window.innerHeight - H - 20) + 'px' } }, head, body);
  document.body.append(el);
  let mv = null; head.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; mv = { x: e.clientX - el.offsetLeft, y: e.clientY - el.offsetTop }; head.setPointerCapture(e.pointerId); });
  head.addEventListener('pointermove', e => { if (!mv) return; el.style.left = pjClamp(e.clientX - mv.x, 0, window.innerWidth - 120) + 'px'; el.style.top = pjClamp(e.clientY - mv.y, 0, window.innerHeight - 40) + 'px'; });
  head.addEventListener('pointerup', () => { mv = null; });
  const win = { dead: false, el, name: '', spec: null, inst: null, show(n, sp, t) { win.name = n; win.spec = sp; if (t) ttl.textContent = t; if (win.inst) win.inst.show(n, sp); }, close() { if (win.dead) return; win.dead = true; if (win.inst) win.inst.close(); el.remove(); if (PIC3.win === win) PIC3.win = null; if (win.onclose) win.onclose(); } };
  PIC3.win = win; win.inst = await PIC3.mount(body, { wheel: true }); if (!win.inst) { return win; } win.show(name, spec, title); return win;
};
PIC3.closeWindow = () => { if (PIC3.win) PIC3.win.close(); };
