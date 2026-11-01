'use strict';
/* =====================================================================
   Natural intelligence: how a brain cell works, a network of them, the ion channels, the synapse and the whole brain (the last three live in 22b_brain_bio.js).
   1. One neuron: a 3-D neuron (dendrites, cell body, myelinated axon, synapses) driven by four noisy input lines. A real leaky integrate-and-fire
      simulation: each input spike nudges the membrane potential, it leaks back, and when it crosses the threshold the neuron fires an action potential that
      jumps down the axon. Beside it, the ARTIFICIAL neuron (weighted sum + activation) computed from the same inputs, so you see what the maths keeps and what it throws away.
   2. A network: 36 neurons, excitatory and inhibitory, with spikes travelling along their connections. Click a neuron to stimulate it. Switch on
      "connections that fire together grow stronger" (a simple spike-timing rule) and watch the wiring change.
   The simulations are small but real; time is slowed down so you can watch (1 ms of brain time = a fraction of a second here).
   ===================================================================== */
function brainView(o = {}) {
  const root = h('div', { class: 'stack explorer brain' }), W = 760, H = 460;
  const S = { tab: 'one', speed: 1, playing: true, hebb: false, noise: 22, stim: -1, t: 0 };
  const holo = h('div', { class: 'ex-holo' }); const p3 = Plot3D(holo, { w: W, h: H, az: .5, el: .35, wheel: true, zoom: 2.0, label: '3-D view of neurons. Drag to rotate, wheel to zoom.' });
  const trace = document.createElementNS(SVGNS, 'svg'); trace.setAttribute('viewBox', '0 0 760 120'); trace.setAttribute('class', 'ex-svg');
  const info = h('div', { class: 'card pad prose' }), side = h('div', { class: 'card pad stack' });
  const tb = (t, f, title) => h('button', { class: 'btn sm', type: 'button', title, onclick: f }, t);
  const tabBtns = {}; const setTab = t => { S.tab = t; Object.entries(tabBtns).forEach(([k, b]) => b.classList.toggle('primary', k === t)); build(); };
  tabBtns.one = tb('One neuron', () => setTab('one'), 'A single brain cell versus an artificial neuron'); tabBtns.net = tb('A brain network', () => setTab('net'), '36 neurons that fire and learn');
  tabBtns.hh = tb('Ion channels', () => setTab('hh'), 'Sodium and potassium gates: why a spike happens'); tabBtns.syn = tb('A synapse', () => setTab('syn'), 'Vesicles, receptors, calcium and learning'); tabBtns.map = tb('The whole brain', () => setTab('map'), 'Regions and the road a signal takes');
  const EXT = { hh: BRAINX.hh, syn: BRAINX.syn, map: BRAINX.map }; let ext = null;
  const r = RNG(BIG.hash('brain:' + (DSQ.S && DSQ.S.me ? DSQ.S.me.username : 'guest')));

  /* ===================== one neuron ===================== */
  const ONE = { V: -70, thr: -55, rest: -70, tau: 18, refr: 0, rate: [18, 12, 25, 8], w: [3.2, 2.4, 1.8, 3.8], flash: [0, 0, 0, 0], spikes: [], pulses: [], trace: [], tt: 0, post: 0, geom: null, released: [] };
  function geomOne() {
    const rr = RNG(7), seg = [], tips = []; const branch = (p, d, len, depth) => { const e = p.map((v, i) => v + d[i] * len); seg.push([p, e, depth]); if (depth > 0) for (let k = 0; k < 2; k++) { const nd = d.map(v => v + rr.norm(0, .55)), m = Math.hypot(...nd) || 1; branch(e, nd.map(v => v / m), len * .68, depth - 1); } else tips.push(e); };
    for (let k = 0; k < 6; k++) { const a = Math.PI * (.62 + .76 * k / 5) - 0, dir = [Math.cos(a) * 1.0, Math.sin(a) * .8, rr.norm(0, .45)]; const m = Math.hypot(...dir); branch([-.35, 0, 0], dir.map(v => v / m), 1.1, 3); }
    const nodes = []; for (let i = 0; i <= 6; i++) nodes.push([.5 + i * 1.05, 0, 0]);
    return { seg, tips, nodes, term: [[7.4, .5, .6], [7.4, -.5, .5], [7.5, .3, -.6], [7.5, -.4, -.5]], post: [8.7, 0, 0] };
  }
  ONE.geom = geomOne();
  function stepOne(dt) {
    ONE.tt += dt; ONE.sp = ONE.sp || 0; for (let i = 0; i < 4; i++) ONE.flash[i] = Math.max(0, ONE.flash[i] - dt / 90);
    if (ONE.sp > 0) { ONE.sp -= dt; ONE.V = ONE.sp > 0 ? 30 : -78; }
    else {
      for (let i = 0; i < 4; i++) if (r() < ONE.rate[i] * dt / 1000) { ONE.V += ONE.refr > 0 ? ONE.w[i] * .2 : ONE.w[i]; ONE.flash[i] = 1; }
      ONE.V += (ONE.rest - ONE.V) * dt / ONE.tau; if (ONE.refr > 0) { ONE.refr -= dt; ONE.V = Math.min(ONE.V, ONE.rest - 3); }
      if (ONE.V >= ONE.thr && ONE.refr <= 0) { ONE.spikes.push(ONE.tt); if (ONE.spikes.length > 80) ONE.spikes.shift(); ONE.V = 30; ONE.sp = 1.6; ONE.refr = 6; ONE.pulses.push({ t0: ONE.tt }); }
    }
    ONE.pulses = ONE.pulses.filter(p => ONE.tt - p.t0 < 90); ONE.post = Math.max(0, ONE.post - dt / 140);
    ONE.pulses.forEach(p => { if (!p.hit && ONE.tt - p.t0 > 70) { p.hit = true; ONE.post = 1; for (let k = 0; k < 8; k++) ONE.released.push({ t0: ONE.tt, k }); } }); ONE.released = ONE.released.filter(q => ONE.tt - q.t0 < 60);
    ONE.trace.push(ONE.V); if (ONE.trace.length > 420) ONE.trace.shift();
  }
  function sceneOne(now) {
    const g = ONE.geom, it = [], v = ONE.V, hot = Math.max(0, Math.min(1, (v + 70) / 45)), spiking = ONE.sp > 0, soma = spiking ? '#ffffff' : hot > .5 ? '#ffd166' : '#6ea8ff';
    g.seg.forEach(([a, b, d]) => it.push({ t: 'line', a, b, color: `rgba(150,220,255,${.35 + .12 * d})`, w: .8 + d * .5 }));
    g.tips.forEach((t, i) => { const f = ONE.flash[i % 4]; it.push({ t: 'pt', p: t, r: 3 + 5 * (i % 4 === 0 ? f : f * .4), color: f > .1 ? '#ffd166' : '#9be7ff' }); });
    it.push(...SH.sphere([0, 0, 0], .6, soma, { a: .55 + .3 * hot, glow: hot + (spiking ? 1 : 0), lat: 5, lon: 9 })); it.push(SH.label([0, 0, -1.0], 'cell body: adds up inputs', { size: 11, color: '#cfeaff' }));
    it.push({ t: 'line', a: [.6, 0, 0], b: [.5 + 6 * 1.05, 0, 0], color: 'rgba(255,255,255,.28)', w: 1.2 });
    for (let i = 0; i < 6; i++) it.push(...SH.cyl([.5 + .52 + i * 1.05 + .0, 0, 0], .2, .78, '#ffd7a8', { axis: 'x', a: .5, glow: .3, sides: 10, w: .8 }));
    g.nodes.forEach((n, i) => it.push({ t: 'pt', p: n, r: 3, color: '#ffffff55' })); it.push(SH.label([3.6, 0, .8], 'axon wrapped in myelin (insulation)', { size: 10.5, color: '#ffd7a8' })); it.push(SH.label([4.4, 0, -.8], 'gaps between sheaths: the spike jumps', { size: 10, color: '#9bb' }));
    g.term.forEach(t => { it.push({ t: 'line', a: [7.0, 0, 0], b: t, color: 'rgba(255,255,255,.35)', w: 1 }); it.push(...SH.sphere(t, .12, '#ff8fb3', { a: .8, glow: .5, lat: 3, lon: 6 })); });
    it.push(...SH.sphere(g.post, .45, ONE.post > .1 ? '#ffd166' : '#6ea8ff', { a: .4 + .3 * ONE.post, glow: ONE.post, lat: 4, lon: 8 })); it.push(SH.label([g.post[0], 0, -.9], 'next neuron', { size: 11, color: '#cfeaff' })); it.push(SH.label([7.6, 0, 1.3], 'synapses (chemical gap)', { size: 10.5, color: '#ff9ab5' }));
    ONE.pulses.forEach(p => { const e = ONE.tt - p.t0, u = Math.min(1, e / 70), m = 6, k = Math.min(m - 1, Math.floor(u * m)), f = u * m - k, ease = 1 - Math.pow(1 - Math.min(1, f * 1.6), 3), x = .5 + (k + ease) * 1.05; it.push({ t: 'pt', p: [x, 0, 0], r: 10, color: '#ffffff', ring: '#ffd166' }); });
    ONE.released.forEach(q => { const u = (ONE.tt - q.t0) / 60, t = ONE.geom.term[q.k % 4]; it.push({ t: 'pt', p: [t[0] + (g.post[0] - .5 - t[0]) * u, t[1] * (1 - u), t[2] * (1 - u)], r: 3, color: '#ff8fb3' }); });
    for (let i = 0; i < 4; i++) { const t = g.tips[i * Math.floor(g.tips.length / 4)], f = ONE.flash[i]; it.push(SH.label([t[0] - .6, t[1], t[2] + .3], 'input ' + (i + 1), { size: 10, color: f > .1 ? '#ffd166' : '#9bb' })); }
    return it;
  }
  function sideOne() {
    side.innerHTML = '';
    const z = ONE.rate.reduce((s, rt, i) => s + ONE.w[i] * rt / 10, 0) - 8, relu = Math.max(0, z), sig = 1 / (1 + Math.exp(-z / 3)), rate = ONE.spikes.filter(t => ONE.tt - t < 1000).length;
    const sl = (lab, arr, i, min, max, step) => h('label', { class: 'sw' }, lab + ' ', h('input', { type: 'range', min, max, step, value: arr[i], oninput: e => { arr[i] = +e.target.value; e.target.nextSibling.textContent = arr[i]; sideNum(); } }), h('b', {}, String(arr[i])));
    const rows = h('div', { class: 'stack' }, [0, 1, 2, 3].map(i => h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, h('b', { style: { width: '4.5em' } }, 'Input ' + (i + 1)), sl('rate (Hz)', ONE.rate, i, 0, 60, 1), sl('strength (mV)', ONE.w, i, 0, 8, .2))));
    const num = h('div', { class: 'ill-num mono', id: 'brnum' }); side.append(h('b', {}, 'Four input lines, noisy like real life'), rows, num); sideNum();
  }
  function sideNum() {
    const el = $('#brnum', side); if (!el) return; const z = ONE.rate.reduce((s, rt, i) => s + ONE.w[i] * rt / 10, 0) - 8, relu = Math.max(0, z), rate = ONE.spikes.filter(t => ONE.tt - t < 1000).length;
    el.innerHTML = `<div class="nv"><span>ARTIFICIAL neuron</span><i class="num">z = ${ONE.rate.map((rt, i) => `${ONE.w[i]}x${(rt / 10).toFixed(1)}`).join(' + ')} - 8 = <b>${z.toFixed(2)}</b></i></div><div class="nv"><span></span><i class="num">output = ReLU(z) = <b>${relu.toFixed(2)}</b>: one number, no time, no noise</i></div><div class="nv"><span>NATURAL neuron</span><i class="num">membrane = <b>${ONE.V > 20 ? '+30 (spike)' : ONE.V.toFixed(1)} mV</b> (rest -70, fires at -55)</i></div><div class="nv"><span></span><i class="num">spikes in the last second: <b>${rate}</b>. Same inputs, but the answer is a pattern in time</i></div>`;
  }
  function traceOne() {
    const tr = ONE.trace; if (tr.length < 2) return; const X = i => 8 + i / 420 * 744, Y = v => 112 - (v + 85) / 125 * 100; let d = ''; tr.forEach((v, i) => { d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(Math.min(v, 30)).toFixed(1); });
    trace.innerHTML = `<line x1="8" x2="752" y1="${Y(ONE.thr)}" y2="${Y(ONE.thr)}" stroke="#D2600F" stroke-dasharray="5 4"/><text x="12" y="${Y(ONE.thr) - 4}" class="tk" style="fill:#D2600F">threshold -55 mV</text><text x="12" y="12" class="tk">membrane potential of the neuron (mV) over time</text><path d="${d}" fill="none" stroke="#2F6FE0" stroke-width="1.8"/>`;
  }

  /* ===================== network ===================== */
  const NET = { N: [], E: [], q: [], t: 0, lastSpike: [], spikeLog: [], pulses: [], learned: 0 };
  function buildNet() {
    const rr = RNG(11), n = 36; NET.N = Array.from({ length: n }, (_, i) => { const u = rr() * 6.28, v = Math.acos(2 * rr() - 1), R = 2.2 * Math.cbrt(rr()) + .3; return { p: [Math.sin(v) * Math.cos(u) * R * 1.4, Math.sin(v) * Math.sin(u) * R, Math.cos(v) * R * .9], V: -70 + rr() * 8, inh: i % 5 === 0, refr: 0, glow: 0 }; });
    NET.E = []; NET.N.forEach((a, i) => { const d = NET.N.map((b, j) => [j, Math.hypot(...a.p.map((v, k) => v - b.p[k]))]).filter(x => x[0] !== i).sort((x, y) => x[1] - y[1]).slice(0, 4); d.forEach(([j, dist]) => { const w = a.inh ? -5 : 4.6 + rr() * 2; NET.E.push({ a: i, b: j, w, w0: w, delay: 3 + dist * 5 }); }); });
    NET.q = []; NET.t = 0; NET.lastSpike = new Array(n).fill(-1e9); NET.spikeLog = []; NET.pulses = []; NET.learned = 0;
  }
  function stepNet(dt) {
    NET.t += dt; const n = NET.N.length, thr = -55;
    NET.N.forEach((nu, i) => { nu.V += (-70 - nu.V) * dt / 16; nu.glow = Math.max(0, nu.glow - dt / 120); if (nu.refr > 0) { nu.refr -= dt; return; } if (r() < S.noise * dt / 1000 + (S.stim === i ? .25 : 0)) nu.V += 7; });
    NET.q = NET.q.filter(ev => { if (NET.t >= ev.t) { const nu = NET.N[ev.b]; if (!nu.refr) nu.V += ev.w; return false; } return true; });
    NET.N.forEach((nu, i) => { if (nu.V >= thr && !nu.refr) { nu.V = -70; nu.refr = 5; nu.glow = 1; NET.spikeLog.push(NET.t); if (NET.spikeLog.length > 400) NET.spikeLog.shift();
      const prev = NET.lastSpike[i]; NET.lastSpike[i] = NET.t;
      NET.E.forEach(e => { if (e.a === i) { NET.q.push({ t: NET.t + e.delay, b: e.b, w: e.w }); NET.pulses.push({ e, t0: NET.t, t1: NET.t + e.delay }); if (S.hebb && !NET.N[e.a].inh) { const dtp = NET.t - NET.lastSpike[e.b]; if (dtp > 0 && dtp < 60) e.w = Math.max(1, e.w - .35 * Math.exp(-dtp / 15)); } } if (e.b === i && S.hebb && !NET.N[e.a].inh) { const dtp = NET.t - NET.lastSpike[e.a]; if (dtp > 0 && dtp < 60) { const g = .6 * Math.exp(-dtp / 15); e.w = Math.min(10, e.w + g); if (g > .05) NET.learned++; } } });
    } });
    NET.pulses = NET.pulses.filter(p => NET.t < p.t1 + 5); if (NET.pulses.length > 400) NET.pulses.splice(0, 100);
  }
  function sceneNet() {
    const it = []; NET.E.forEach(e => { const a = NET.N[e.a].p, b = NET.N[e.b].p, st = Math.abs(e.w); it.push({ t: 'line', a, b, color: e.w < 0 ? `rgba(110,168,255,${.15 + st * .06})` : `rgba(255,214,102,${.1 + Math.min(.7, (e.w - 3) * .1)})`, w: .5 + (st / 10) * 4.5 }); });
    NET.N.forEach((nu, i) => { const hot = Math.max(nu.glow, (nu.V + 70) / 30 * .5); it.push(...SH.sphere(nu.p, .2 + .1 * nu.glow, nu.inh ? '#6ea8ff' : '#ffd166', { a: .35 + .5 * hot, glow: Math.min(1, hot * 1.4), lat: 4, lon: 8 })); if (S.stim === i) it.push({ t: 'pt', p: nu.p, r: 14, color: 'rgba(255,255,255,.2)', ring: '#fff' }); });
    NET.pulses.forEach(p => { const u = (NET.t - p.t0) / (p.t1 - p.t0); if (u < 0 || u > 1) return; const a = NET.N[p.e.a].p, b = NET.N[p.e.b].p; it.push({ t: 'pt', p: a.map((v, k) => v + (b[k] - v) * u), r: 4, color: p.e.w < 0 ? '#6ea8ff' : '#fff' }); });
    return it;
  }
  function traceNet() {
    const bins = 60, win = 600, c = new Array(bins).fill(0); NET.spikeLog.forEach(t => { const k = Math.floor((NET.t - t) / win * bins); if (k >= 0 && k < bins) c[bins - 1 - k]++; }); const mx = Math.max(6, ...c);
    trace.innerHTML = `<text x="12" y="12" class="tk">spikes per time slice (all ${NET.N.length} neurons, last ${win} ms)</text>` + c.map((v, i) => `<rect x="${8 + i * 12.4}" y="${112 - v / mx * 92}" width="10" height="${v / mx * 92}" fill="#2F6FE0" opacity=".75"/>`).join('');
  }
  function sideNet() {
    side.innerHTML = ''; const hb = h('input', { type: 'checkbox' }); hb.checked = S.hebb; hb.addEventListener('change', () => { S.hebb = hb.checked; });
    const noise = h('input', { type: 'range', min: 0, max: 60, step: 1, value: S.noise, oninput: e => { S.noise = +e.target.value; e.target.nextSibling.textContent = S.noise; } });
    side.append(h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '10px' } }, h('label', { class: 'sw', title: 'When neuron A fires just before neuron B, the connection A to B grows (and shrinks the other way round)' }, hb, 'connections that fire together grow stronger'), h('label', { class: 'sw' }, 'background noise (Hz) ', noise, h('b', {}, String(S.noise))), tb('Reset the wiring', () => { buildNet(); }, ''), tb('Calm (stop stimulus)', () => { S.stim = -1; }, '')), h('div', { class: 'ill-num mono', id: 'brnum' }));
  }
  function numNet() { const el = $('#brnum', side); if (!el) return; const exc = NET.E.filter(e => e.w > 0), avg = exc.reduce((s, e) => s + e.w, 0) / exc.length, grown = exc.filter(e => e.w > e.w0 + 1.2).length; el.innerHTML = `<div class="nv"><span>time</span><i class="num">${(NET.t / 1000).toFixed(2)} s of brain time</i></div><div class="nv"><span>firing</span><i class="num">${NET.spikeLog.filter(t => NET.t - t < 1000).length} spikes in the last second</i></div><div class="nv"><span>wiring</span><i class="num">average strength ${avg.toFixed(2)}; ${grown} of ${exc.length} excitatory links grown by learning; ${NET.learned} strengthening events</i></div><div class="nv"><span>click</span><i class="num">a neuron to stimulate it and watch the spike spread (yellow = excitatory, blue = inhibitory)</i></div>`; }
  p3.onClick = (cx, cy) => { if (ext && ext.onClick) return ext.onClick(cx, cy); if (S.tab !== 'net') return; let best = -1, bd = 22; NET.N.forEach((nu, i) => { const q = p3.proj(nu.p), d = Math.hypot(q[0] - cx, q[1] - cy); if (d < bd) { bd = d; best = i; } }); S.stim = best === S.stim ? -1 : best; };

  function build() {
    const t1 = S.tab === 'one'; ext = null;
    if (EXT[S.tab]) { ext = EXT[S.tab]({ S, r, tb, trace, side, p3 }); info.innerHTML = ext.info; ext.side(); p3.set3d(ext.view.az, ext.view.el); p3.resetZoom(); p3.focus(ext.view.center, ext.view.span); return; }
    info.innerHTML = t1 ? `<h3 style="margin:0 0 6px">One brain cell, and the artificial copy of it</h3><p>Inputs arrive on the <b>dendrites</b> (the tree on the left) as tiny electrical bumps. The <b>cell body</b> adds them up, but the sum leaks away unless inputs arrive quickly enough. If the membrane potential reaches the <b>threshold</b>, the neuron fires an all-or-nothing <b>spike</b> that jumps along the <b>axon</b> (insulated by myelin) to the <b>synapses</b>, where chemicals cross a gap to the next neuron.</p><p>An <b>artificial neuron</b> keeps only the idea: multiply the inputs by weights, add them, apply an activation. It drops time, leaking, spikes and noise. That is why it is fast on a computer, and why brain-like (spiking) hardware is a different design. Change the input rates and strengths and compare the two numbers below.</p>` : `<h3 style="margin:0 0 6px">A small piece of brain tissue</h3><p>Each neuron connects to its four nearest neighbours. Most connections <b style="color:#B8860B">excite</b> (yellow); one in five <b style="color:#2F6FE0">inhibits</b> (blue), which keeps activity from exploding. Random background input makes neurons fire now and then, and a spike travels along each connection with a delay that depends on its length.</p><p>Switch on learning: when neuron A fires shortly <i>before</i> neuron B, the link A &rarr; B grows. Stimulate a few neurons repeatedly and the paths you use become thicker: that is how experience reshapes connections, the natural version of "training".</p>`;
    if (t1) sideOne(); else { buildNet(); sideNet(); }
    p3.set3d(t1 ? .35 : .5, .35); p3.resetZoom(); p3.focus(t1 ? [4, 0, 0] : [0, 0, 0], t1 ? 6 : 4.4);
  }
  const playBtn = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { S.playing = !S.playing; playBtn.textContent = S.playing ? '❚❚ Pause' : '▶ Play'; } }, '❚❚ Pause');
  const bar = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, tabBtns.one, tabBtns.net, tabBtns.hh, tabBtns.syn, tabBtns.map, playBtn, h('label', { class: 'sw' }, 'speed ', h('input', { type: 'range', min: .2, max: 3, step: .1, value: 1, oninput: e => { S.speed = +e.target.value; } })), tb('Zoom +', () => p3.zoomBy(1.4), ''), tb('Zoom -', () => p3.zoomBy(1 / 1.4), ''), tb('Reset view', () => build(), ''));
  let raf = 0, last = 0, acc = 0;
  function loop(now) {
    if (!root.isConnected) { cancelAnimationFrame(raf); return; } const dt = Math.min(50, now - (last || now)); last = now;
    if (S.playing) { acc += dt * S.speed * (ext ? ext.tscale : .6); while (acc >= 1) { acc -= 1; if (ext) ext.step(1); else if (S.tab === 'one') stepOne(1); else stepNet(1); } }
    if (ext) { p3.set(ext.scene(now), ext.view.center, ext.view.span); ext.trace(); if (now - (S.lastNum || 0) > 250) { S.lastNum = now; ext.num(); } }
    else if (S.tab === 'one') { p3.set(sceneOne(now), [4, 0, 0], 6); traceOne(); if (now - (S.lastNum || 0) > 250) { S.lastNum = now; sideNum(); } } else { p3.set(sceneNet(), [0, 0, 0], 4.4); traceNet(); if (now - (S.lastNum || 0) > 300) { S.lastNum = now; numNet(); } } p3.draw(1); raf = requestAnimationFrame(loop);
  }
  root.append(...(o.embedded ? [] : [h('div', { class: 'page-h' }, h('div', {}, h('a', { href: '#/explore', class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← All concepts'), h('h1', {}, 'What natural intelligence looks like'), h('p', { class: 'muted lead' }, 'A real neuron, simulated at four levels: the whole cell next to the artificial neuron, the ion channels that make a spike (Hodgkin-Huxley), the chemical synapse where learning is stored, and a small network that rewires itself. Then the whole brain, and the road a signal takes for five everyday tasks.')))]), h('div', { class: 'card pad stack' }, bar, holo, trace), info, side);
  setTab('one'); raf = requestAnimationFrame(loop);
  root._destroy = () => { cancelAnimationFrame(raf); p3.destroy(); }; if (!o.embedded) App.dis.push(() => root._destroy());
  return root;
}
