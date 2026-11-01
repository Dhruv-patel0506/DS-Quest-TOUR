'use strict';
/* =====================================================================
   The rest of the biology, as three more tabs of the brain page (22_brain.js loads them by name):
   hh  - ION CHANNELS: the Hodgkin-Huxley model. Na+ and K+ gates in the membrane open and close with voltage, ions flow down their gradients, the pump
         restores them. Inject current, zap, block sodium (TTX) or potassium (TEA), change outside potassium. The equations are the 1952 ones (squid giant axon).
   syn - THE SYNAPSE: vesicles of transmitter, calcium, the cleft, AMPA / NMDA (magnesium-blocked) / GABA receptors, an astrocyte mopping up, vesicle depletion
         and facilitation (Tsodyks-Markram), and calcium-dependent strengthening or weakening of the synapse (LTP / LTD).
   map - THE WHOLE BRAIN: the main regions and the path a signal takes for five everyday tasks.
   The simulations (hhSim, synSim) are plain functions with no drawing code so they can be tested on their own.
   ===================================================================== */
const BRAINX = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const f1 = x => (Math.abs(x) < 1e-7 ? 1 : x / (1 - Math.exp(-x)));

  /* ---------------- Hodgkin-Huxley ---------------- */
  function hhSim() {
    const X = { V: -65, m: .0529, h: .5961, n: .3177, I: 0, zap: 0, ttx: false, tea: false, Kout: 20, t: 0, INa: 0, IK: 0, IL: 0, up: false, spikes: [], tr: [], gates: [], gNa: 120, gK: 36, gL: .3, ENa: 50, EL: -54.4, C: 1 };
    X.EK = () => 58 * Math.log10(X.Kout / 400);
    X.step = ms => {
      const dt = .01, gNa = X.ttx ? 0 : X.gNa, gK = X.tea ? 0 : X.gK, EK = X.EK();
      for (let s = 0; s < ms * 100; s++) {
        let { V, m, h, n } = X;
        const an = .1 * f1((V + 55) / 10), bn = .125 * Math.exp(-(V + 65) / 80), am = f1((V + 40) / 10), bm = 4 * Math.exp(-(V + 65) / 18), ah = .07 * Math.exp(-(V + 65) / 20), bh = 1 / (1 + Math.exp(-(V + 35) / 10));
        m += dt * (am * (1 - m) - bm * m); h += dt * (ah * (1 - h) - bh * h); n += dt * (an * (1 - n) - bn * n);
        const INa = gNa * m * m * m * h * (V - X.ENa), IK = gK * n * n * n * n * (V - EK), IL = X.gL * (V - X.EL), Iext = X.I + (X.zap > 0 ? 25 : 0);
        V += dt * (Iext - INa - IK - IL) / X.C; X.zap = Math.max(0, X.zap - dt); X.t += dt;
        X.V = V; X.m = m; X.h = h; X.n = n; X.INa = INa; X.IK = IK; X.IL = IL;
        if (V > 0 && !X.up) { X.up = true; X.spikes.push(X.t); if (X.spikes.length > 60) X.spikes.shift(); } else if (V < -20) X.up = false;
        if (s % 25 === 0) { X.tr.push([V, m, h, n]); if (X.tr.length > 320) X.tr.shift(); }
      }
    };
    return X;
  }

  /* ---------------- chemical synapse ---------------- */
  function synSim() {
    const Y = { t: 0, kind: 'glu', U: .5, u: .5, ves: Array.from({ length: 8 }, () => ({ st: 'docked', tm: 0, flash: 0 })), sA: 0, sN: 0, sG: 0, V: -70, hold: null, w: 1, ca: 0, tr: [], pre: [], hz: 0, nextPre: 0, queue: 0, ltp: 0, ltd: 0, nrel: 0, caFlash: 0, lastN: 0, mol: [], tauD: 400, tauF: 200 };
    const B = V => 1 / (1 + Math.exp(-.062 * V) / 3.57);
    Y.B = B;
    Y.fire = () => {
      Y.u = Y.u + Y.U * (1 - Y.u); let nr = 0; Y.caFlash = 1; Y.pre.push(Y.t); if (Y.pre.length > 80) Y.pre.shift();
      Y.ves.forEach((v, i) => { v.flash = Math.max(0, v.flash); if (v.st === 'docked' && Math.random() < Y.u) { v.st = 'cycling'; v.tm = 0; v.flash = 1; nr++; for (let k = 0; k < 9; k++) Y.mol.push({ x: -.95, y: (Math.random() - .5) * 1.1, z: (Math.random() - .5) * 1.1 + (i - 3.5) * .06, vx: .035 + Math.random() * .03, vy: (Math.random() - .5) * .05, vz: (Math.random() - .5) * .05, age: 0 }); } });
      if (Y.mol.length > 220) Y.mol.splice(0, Y.mol.length - 220);
      Y.lastN = nr; Y.nrel = nr;
      if (Y.kind === 'glu') { Y.sA = Math.min(1, Y.sA + .22 * nr * (1 - Y.sA)); Y.sN = Math.min(1, Y.sN + .08 * nr * (1 - Y.sN)); } else Y.sG = Math.min(1, Y.sG + .2 * nr * (1 - Y.sG));
    };
    Y.step = ms => {
      for (let s = 0; s < ms; s++) {
        Y.t += 1;
        if (Y.queue > 0 && Y.t >= Y.nextPre) { Y.fire(); Y.queue--; Y.nextPre = Y.t + 50; }
        else if (Y.hz > 0 && Y.t >= Y.nextPre) { Y.fire(); Y.nextPre = Y.t + 1000 / Y.hz; }
        Y.u = Y.U + (Y.u - Y.U) * Math.exp(-1 / Y.tauF);
        Y.ves.forEach(v => { v.flash = Math.max(0, v.flash - .03); if (v.st === 'cycling') { v.tm++; if (Math.random() < 1 / Y.tauD) v.st = 'docked'; } });
        Y.sA *= .7165; Y.sN *= .9835; Y.sG *= .905; Y.caFlash = Math.max(0, Y.caFlash - .05);
        const gA = .014 * Y.sA * Y.w, gN = .014 * Y.sN, gG = .03 * Y.sG;
        if (Y.hold != null) Y.V = Y.hold; else { const V = Y.V; Y.V += -(V + 70) / 20 + gA * (0 - V) + gN * B(V) * (0 - V) + gG * (-85 - V); }
        Y.ca = Y.ca * Math.exp(-1 / 60) + 0.5 * Y.sN * B(Y.V);
        if (Y.ca > 1.5) { const d = .002 * (3 - Y.w); Y.w += d; Y.ltp += d; } else if (Y.ca > .45) { const d = .0008 * (Y.w - .3); Y.w -= d; Y.ltd += d; }
        Y.tr.push(Y.V); if (Y.tr.length > 420) Y.tr.shift();
        Y.mol.forEach(p => { p.age++; if (p.age < 45) { p.x += p.vx; p.y += p.vy; p.z += p.vz; } else { p.z -= .03; p.y *= .99; } });
        Y.mol = Y.mol.filter(p => p.age < 110 && p.x < 1.0);
      }
    };
    return Y;
  }

  /* ---------------- tab builders (UI) ---------------- */
  function hh(c) {
    const { S, tb, trace, side, p3 } = c, X = hhSim(), rr = RNG(5);
    const chans = []; for (let i = 0; i < 12; i++) { const kind = (i + (i > 5 ? 1 : 0)) % 2 ? 'k' : 'na'; chans.push({ kind, x: -3.3 + (i % 6) * 1.32, y: i < 6 ? -.9 : .9 }); }
    ['na', 'k'].forEach(k => chans.filter(q => q.kind === k).forEach((q, j, a) => { q.u = (j + .5) / a.length; }));
    const dots = []; const dot = (kind, out, n) => { for (let i = 0; i < n; i++) dots.push({ kind, x: -4 + rr() * 8, y: -1.6 + rr() * 3.2, z: (out ? 1 : -1) * (.7 + rr() * 1.3), ph: rr() * 6.28 }); };
    dot('na', true, 16); dot('na', false, 3); dot('k', false, 16); dot('k', true, 3);
    let ions = [];
    const open = q => q.kind === 'na' ? q.u < clamp(X.m ** 3 * X.h / .35, 0, 1) && !X.ttx : q.u < clamp(X.n ** 4 / .4, 0, 1) && !X.tea;
    const info = `<h3 style="margin:0 0 6px">Why a neuron can fire: ion channels</h3><p>A cell is a bag of salty water inside a fatty membrane. <b style="color:#ff6b6b">Sodium (Na⁺)</b> is plentiful outside and scarce inside; <b style="color:#4dd2c0">potassium (K⁺)</b> is the opposite. Proteins in the membrane are <b>channels</b> that let one kind of ion through when their gate is open. At rest a few potassium channels are open, so K⁺ leaks out and the inside sits near <b>-65 mV</b>.</p><p>Push the voltage up a little and the <b style="color:#ff6b6b">sodium gates (m)</b> start to open. Sodium rushes in, which raises the voltage, which opens more sodium gates: a runaway that is the <b>upswing of the spike</b>. A moment later the sodium channels plug themselves (<b style="color:#ffa94d">h</b>, inactivation) and the slower <b style="color:#4dd2c0">potassium gates (n)</b> open, K⁺ rushes out and the voltage falls back, even undershooting rest. The <b>pump</b> then slowly pays the ions back, using ATP: this is where the brain's energy goes.</p><p>Try it: <b>TTX</b> (pufferfish toxin) blocks sodium and the spike never starts. <b>TEA</b> blocks potassium, so the cell cannot repolarise properly and the spike stalls on a plateau. Raise the outside potassium and the resting voltage creeps up, which is why high blood potassium disturbs nerves and the heart. These are the equations Hodgkin and Huxley fitted to the squid giant axon in 1952.</p>`;
    function scene() {
      const it = [], hot = clamp((X.V + 65) / 80, 0, 1);
      it.push(...SH.box([0, 0, 0], [9.2, 3.6, .55], '#d9a35b', { a: .2, glow: 0 }));
      for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) { const x = -4 + i, y = -1.35 + j * .9; it.push({ t: 'pt', p: [x, y, .3], r: 4, color: '#f2c27b' }); it.push({ t: 'pt', p: [x, y, -.3], r: 4, color: '#f2c27b' }); }
      chans.forEach(q => { const o = open(q), col = q.kind === 'na' ? '#ff6b6b' : '#4dd2c0'; it.push(...SH.cyl([q.x, q.y, 0], .24, .85, col, { axis: 'z', a: o ? .55 : .3, glow: o ? .9 : 0, sides: 10, w: .8 })); if (!o) it.push(...SH.box([q.x, q.y, .5], [.46, .46, .1], '#ffffff', { a: .75 })); });
      it.push(...SH.cyl([0, 0, 0], .34, .95, '#b07cff', { axis: 'z', a: .5, glow: .3, sides: 10 })); it.push(SH.label([0, 0, -.75], 'Na⁺/K⁺ pump (uses ATP)', { size: 10, color: '#d5bfff' }));
      dots.forEach(d => { const jx = Math.sin(X.t * .02 + d.ph) * .15, jz = Math.cos(X.t * .017 + d.ph) * .12; it.push({ t: 'pt', p: [d.x + jx, d.y, d.z + jz], r: 2.6, color: d.kind === 'na' ? 'rgba(255,107,107,.75)' : 'rgba(77,210,192,.75)' }); });
      ions.forEach(p => it.push({ t: 'pt', p: [p.x, p.y, p.z], r: 5, color: p.kind === 'na' ? '#ff6b6b' : '#4dd2c0', ring: '#fff' }));
      it.push(SH.label([-4.1, 0, 2.3], 'OUTSIDE the cell: lots of Na⁺ (red), little K⁺', { size: 11, color: '#cfeaff', align: 'left' }));
      it.push(SH.label([-4.1, 0, -2.4], 'INSIDE: lots of K⁺ (green), little Na⁺', { size: 11, color: '#cfeaff', align: 'left' }));
      it.push(SH.label([3.3, 0, 2.3], `${X.V.toFixed(0)} mV`, { size: 18, color: hot > .55 ? '#ffd166' : '#9be7ff' })); it.push(SH.label([3.3, 0, -2.4], 'white lid = gate shut; glowing = open', { size: 10, color: '#9bb' }));
      return it;
    }
    function step(dt) {
      X.step(dt); const rate = Math.min(.5, Math.abs(X.INa) / 1800), rk = Math.min(.5, Math.abs(X.IK) / 400);
      chans.forEach(q => { if (!open(q)) return; if (q.kind === 'na' && X.V < X.ENa && Math.random() < rate + .01) ions.push({ kind: 'na', x: q.x + (Math.random() - .5) * .15, y: q.y, z: 1.5, d: -1 }); if (q.kind === 'k' && X.V > X.EK() && Math.random() < rk + .01) ions.push({ kind: 'k', x: q.x + (Math.random() - .5) * .15, y: q.y, z: -1.5, d: 1 }); });
      if (Math.random() < .08) { ions.push({ kind: 'na', x: .05, y: 0, z: -.5, d: 1 }); } if (Math.random() < .05) ions.push({ kind: 'k', x: -.05, y: 0, z: .5, d: -1 });
      ions.forEach(p => { p.z += p.d * .13; }); ions = ions.filter(p => Math.abs(p.z) < 2.1); if (ions.length > 140) ions.splice(0, 40);
    }
    function drawTrace() {
      const n = X.tr.length; if (n < 2) return; const x = i => 8 + i / 320 * 744, yv = v => 112 - (v + 85) / 140 * 100, yg = g => 112 - g * 100;
      const path = (k, col, fy, w) => '<path d="' + X.tr.map((q, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + fy(q[k]).toFixed(1)).join('') + `" fill="none" stroke="${col}" stroke-width="${w}"/>`;
      trace.innerHTML = `<text x="12" y="12" class="tk">voltage (blue); gates: m Na opens (red), h Na plugs (orange), n K opens (green); 80 ms</text>` + path(0, '#2F6FE0', yv, 2) + path(1, '#ff6b6b', yg, 1.2) + path(2, '#ffa94d', yg, 1.2) + path(3, '#4dd2c0', yg, 1.2);
    }
    function num() {
      const el = $('#brnum', side); if (!el) return; const sp = X.spikes.filter(t => X.t - t < 100).length * 10;
      el.innerHTML = `<div class="nv"><span>voltage</span><i class="num"><b>${X.V.toFixed(1)} mV</b> (rest about -65, spike peaks near +40)</i></div><div class="nv"><span>currents</span><i class="num">Na⁺ in: <b>${Math.max(0, -X.INa).toFixed(0)}</b> &nbsp; K⁺ out: <b>${Math.max(0, X.IK).toFixed(0)}</b> (µA/cm²)</i></div><div class="nv"><span>gates</span><i class="num">m ${X.m.toFixed(2)} &nbsp; h ${X.h.toFixed(2)} &nbsp; n ${X.n.toFixed(2)} (0 = shut, 1 = open)</i></div><div class="nv"><span>Nernst</span><i class="num">E<sub>Na</sub> = ${X.ENa} mV (Na⁺ wants to go in) &nbsp; E<sub>K</sub> = <b>${X.EK().toFixed(1)} mV</b> = 58 x log10(${X.Kout} / 400)</i></div><div class="nv"><span>rate</span><i class="num">about <b>${sp}</b> spikes per second</i></div>`;
    }
    function buildSide() {
      side.innerHTML = '';
      const cur = h('input', { type: 'range', min: 0, max: 30, step: .5, value: X.I, oninput: e => { X.I = +e.target.value; e.target.nextSibling.textContent = X.I; } });
      const ko = h('input', { type: 'range', min: 5, max: 60, step: 1, value: X.Kout, oninput: e => { X.Kout = +e.target.value; e.target.nextSibling.textContent = X.Kout; } });
      const ttx = h('input', { type: 'checkbox', onchange: e => { X.ttx = e.target.checked; } }), tea = h('input', { type: 'checkbox', onchange: e => { X.tea = e.target.checked; } });
      side.append(h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '10px' } }, h('label', { class: 'sw' }, 'injected current (µA/cm²) ', cur, h('b', {}, String(X.I))), tb('Zap: one short pulse', () => { X.zap = 1; }, 'A 1 ms jolt of current'), h('label', { class: 'sw', title: 'Tetrodotoxin (pufferfish) blocks sodium channels' }, ttx, 'TTX: block sodium'), h('label', { class: 'sw', title: 'Tetraethylammonium blocks potassium channels' }, tea, 'TEA: block potassium'), h('label', { class: 'sw' }, 'potassium outside (mM) ', ko, h('b', {}, String(X.Kout)))), h('div', { class: 'ill-num mono', id: 'brnum' }));
    }
    buildSide();
    return { info, view: { az: .5, el: .42, center: [0, 0, 0], span: 4.8 }, tscale: .1, step, scene, trace: drawTrace, num, side: buildSide, X };
  }

  function syn(c) {
    const { S, tb, trace, side, p3 } = c, Y = synSim();
    const info = `<h3 style="margin:0 0 6px">The synapse: where one neuron talks to the next</h3><p>A spike reaching the <b>bouton</b> (left) opens <b>calcium</b> channels. Calcium makes <b>vesicles</b>, little bags of transmitter, fuse with the membrane and spill into the <b>cleft</b> (about 20 nanometres wide). The molecules drift across and fit into <b>receptors</b> on the receiving spine (right). <b style="color:#ffd166">AMPA</b> receptors open at once and let sodium in: a small, fast bump. <b style="color:#ff9a3d">NMDA</b> receptors are plugged by a magnesium ion until the cell is already depolarised: they only open when both neurons are active together, and then calcium flows in. An <b style="color:#4dd2c0">inhibitory</b> synapse (GABA) opens chloride channels and pulls the voltage down. An <b style="color:#7bd88f">astrocyte</b> mops up leftovers.</p><p>Fire a <b>burst</b> and watch the vesicle supply run down (depression) or, with a low release probability, build up (facilitation). Now hold the receiving cell depolarised and fire again: NMDA unplugs, calcium rises past a threshold, and the synapse <b>inserts more AMPA receptors</b>: long-term potentiation, the biological form of "learning". Weak calcium does the opposite (LTD). This is the natural weight update.</p>`;
    const rec = [{ k: 'A', y: -.8, z: .6 }, { k: 'A', y: 0, z: .65 }, { k: 'A', y: .8, z: .6 }, { k: 'A', y: -.4, z: -.1 }, { k: 'A', y: .4, z: -.1 }, { k: 'A', y: -.8, z: -.6 }, { k: 'A', y: 0, z: -.65 }, { k: 'A', y: .8, z: -.6 }, { k: 'N', y: -.4, z: .2 }, { k: 'N', y: .4, z: .2 }, { k: 'G', y: -.4, z: -.4 }, { k: 'G', y: .4, z: -.4 }];
    const slot = i => [-1.25 + (i % 2) * .22, ((i >> 1) % 2 ? .5 : -.5) + (i % 3 - 1) * .15, 1 - (i >> 2) * .62 + .1];
    function scene() {
      const it = [], exc = Y.kind === 'glu', Bv = Y.B(Y.V);
      it.push(...SH.sphere([-2.35, 0, 0], 1.35, '#6ea8ff', { a: .16, lat: 7, lon: 14, glow: Y.caFlash * .5 })); it.push(...SH.sphere([2.35, 0, 0], 1.35, '#ffb86b', { a: .14 + Math.max(0, (Y.V + 70) / 60) * .15, lat: 7, lon: 14 }));
      it.push(SH.label([-2.4, 0, 1.75], 'sending neuron: bouton', { size: 11, color: '#cfeaff' })); it.push(SH.label([2.4, 0, 1.75], 'receiving neuron: spine', { size: 11, color: '#ffd7a8' })); it.push(SH.label([0, 0, 1.25], 'cleft (about 20 nm)', { size: 10, color: '#9bb' }));
      for (let i = 0; i < 3; i++) { const z = -.9 + i * .9; it.push(...SH.cyl([-1.0, -1.1 + i * 1.1, 1.1 - i * .15], .12, .45, '#7fc8ff', { axis: 'x', a: .5, glow: Y.caFlash, sides: 8 })); }
      it.push(SH.label([-1.55, 0, 1.45], 'Ca²⁺ channels', { size: 9.5, color: '#7fc8ff' }));
      Y.ves.forEach((v, i) => { const p = slot(i), docked = v.st === 'docked'; it.push(...SH.sphere(docked ? p : [p[0] - .7, p[1], p[2]], docked ? .24 : .15, exc ? '#ffd166' : '#4dd2c0', { a: docked ? .6 : .25, glow: v.flash, lat: 4, lon: 8 })); });
      it.push(SH.label([-2.4, 0, -1.65], 'vesicles; pale = refilling', { size: 9.5, color: '#ffe3a1' }));
      const nA = clamp(Math.round(3 * Y.w), 1, 8); let a = 0;
      rec.forEach(q => { let show = true, col, open = 0; if (q.k === 'A') { show = a < nA; a++; col = '#ffd166'; open = Y.sA; } else if (q.k === 'N') { col = '#ff9a3d'; open = Y.sN * Bv; } else { col = '#4dd2c0'; open = Y.sG; } if (!show) return; if (q.k === 'G' && exc && Y.sG < .02) { col = '#4dd2c0'; } it.push(...SH.cyl([1.0, q.y, q.z], .16, .45, col, { axis: 'x', a: .5, glow: clamp(open * 3, 0, 1), sides: 8 })); if (q.k === 'N' && Bv < .45) it.push({ t: 'pt', p: [.9, q.y, q.z], r: 5, color: '#6ea8ff', ring: '#fff' }); });
      it.push(SH.label([2.4, 0, -1.65], 'receptors: AMPA yellow, NMDA orange (blue dot = Mg²⁺ plug), GABA green', { size: 9.5, color: '#ffd7a8' }));
      Y.mol.forEach(p => it.push({ t: 'pt', p: [p.x, p.y, p.z], r: 3, color: exc ? '#ffd166' : '#4dd2c0' }));
      it.push(...SH.sphere([0, 0, -2.0], .55, '#7bd88f', { a: .3, lat: 4, lon: 8 })); it.push(SH.label([0, 0, -2.7], 'astrocyte: mops up transmitter', { size: 10, color: '#a6e8b4' }));
      if (Y.ca > .05) for (let k = 0; k < Math.min(9, Math.floor(Y.ca * 3)); k++) it.push({ t: 'pt', p: [1.5 + Math.random() * .8, (Math.random() - .5) * 1.2, (Math.random() - .5) * 1.2], r: 3.5, color: '#ff6b6b' });
      return it;
    }
    function drawTrace() {
      const n = Y.tr.length; if (n < 2) return; const x = i => 8 + i / 420 * 744, hi = Y.hold != null ? 0 : -55, yv = v => 112 - clamp((v + 80) / (hi + 80), 0, 1) * 92;
      const d = Y.tr.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + yv(v).toFixed(1)).join(''), ticks = Y.pre.filter(t => Y.t - t < 420).map(t => `<line x1="${x(420 - (Y.t - t))}" x2="${x(420 - (Y.t - t))}" y1="14" y2="26" stroke="#D2600F" stroke-width="2"/>`).join('');
      trace.innerHTML = `<text x="12" y="12" class="tk">receiving cell voltage (blue; rest -70 mV); orange ticks mark spikes arriving at the bouton; about 400 ms shown</text>${ticks}<path d="${d}" fill="none" stroke="#2F6FE0" stroke-width="1.8"/>`;
    }
    function num() {
      const el = $('#brnum', side); if (!el) return; const docked = Y.ves.filter(v => v.st === 'docked').length;
      el.innerHTML = `<div class="nv"><span>vesicles</span><i class="num"><b>${docked}</b> of 8 ready; last spike released <b>${Y.lastN}</b>; release chance now ${(Y.u * 100).toFixed(0)}%</i></div><div class="nv"><span>receiving cell</span><i class="num"><b>${Y.V.toFixed(1)} mV</b>${Y.hold != null ? ' (held there by the experimenter)' : ''}; NMDA plug relief ${(Y.B(Y.V) * 100).toFixed(0)}%</i></div><div class="nv"><span>calcium</span><i class="num">${Y.ca.toFixed(2)} (above 1.5 strengthens, 0.45 to 1.5 weakens)</i></div><div class="nv"><span>strength</span><i class="num">synapse weight <b>${Y.w.toFixed(2)}x</b> (started at 1.00); ${Y.w > 1.05 ? 'potentiated' : Y.w < .95 ? 'depressed' : 'unchanged'}</i></div>`;
    }
    function buildSide() {
      side.innerHTML = '';
      const kind = h('select', { onchange: e => { Y.kind = e.target.value; } }, h('option', { value: 'glu' }, 'excitatory (glutamate)'), h('option', { value: 'gaba' }, 'inhibitory (GABA)'));
      const hold = h('select', { onchange: e => { Y.hold = e.target.value === 'free' ? null : +e.target.value; if (Y.hold == null) Y.V = -70; } }, h('option', { value: 'free' }, 'free-running'), h('option', { value: -50 }, 'held at -50 mV'), h('option', { value: -20 }, 'held at -20 mV'));
      const p0 = h('input', { type: 'range', min: .1, max: .9, step: .05, value: Y.U, oninput: e => { Y.U = +e.target.value; Y.u = Y.U; e.target.nextSibling.textContent = Y.U; } });
      const hz = h('input', { type: 'range', min: 0, max: 50, step: 1, value: 0, oninput: e => { Y.hz = +e.target.value; Y.nextPre = Y.t; e.target.nextSibling.textContent = Y.hz; } });
      side.append(h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '10px' } }, tb('Fire one spike', () => Y.fire(), ''), tb('Burst: 10 spikes at 20 Hz', () => { Y.queue = 10; Y.nextPre = Y.t; }, ''), h('label', { class: 'sw' }, 'transmitter ', kind), h('label', { class: 'sw' }, 'receiving cell ', hold), h('label', { class: 'sw', title: 'Low = facilitating synapse, high = depressing synapse' }, 'release probability ', p0, h('b', {}, String(Y.U))), h('label', { class: 'sw' }, 'steady train (Hz) ', hz, h('b', {}, '0')), tb('Reset synapse', () => { const k = Y.kind, hd = Y.hold; Object.assign(Y, synSim(), { kind: k, hold: hd }); }, '')), h('div', { class: 'ill-num mono', id: 'brnum' }));
    }
    buildSide();
    return { info, view: { az: .2, el: .2, center: [0, 0, -.3], span: 5.4 }, tscale: .25, step: Y.step, scene, trace: drawTrace, num, side: buildSide, Y };
  }

  /* ---------------- the whole brain ---------------- */
  const REG = {
    frontal: { name: 'Frontal lobe', col: '#6ea8ff', at: [[1.7, .6, 1.0], [1.0, 1.2, .95], [2.2, .0, .8]], job: 'Planning, decisions, working memory, self-control; Broca\'s area builds speech. Largest part of the human cortex.' },
    motor: { name: 'Motor cortex', col: '#ff8fb3', at: [[.2, 1.75, .45], [.55, 1.55, .4], [-.1, 1.85, .4]], job: 'A strip along the top that sends the commands to muscles. Hand and face get a disproportionate share.' },
    parietal: { name: 'Parietal lobe', col: '#9be7a0', at: [[-.9, 1.55, .9], [-1.5, 1.1, .85]], job: 'Touch, body position, and a map of the space around you. Where is the ball relative to my hand?' },
    occipital: { name: 'Occipital lobe', col: '#ffd166', at: [[-2.6, .5, .85], [-2.3, 1.0, .8], [-2.7, 0, .7]], job: 'Primary visual cortex (V1): edges and orientations first, then shapes. Almost entirely devoted to sight.' },
    temporal: { name: 'Temporal lobe', col: '#c79bff', at: [[.1, -.7, .95], [-.9, -.8, .9], [1.0, -.5, .85]], job: 'Hearing, recognising objects and faces, understanding words, and (with the hippocampus) memories.' },
    cerebellum: { name: 'Cerebellum', col: '#4dd2c0', at: [[-2.0, -1.6, .9], [-2.5, -1.4, .8], [-1.6, -1.9, .75]], job: 'Smooth, timed movement and learned skills. About 80 percent of all neurons live here, in a region a tenth of the brain\'s volume.' },
    stem: { name: 'Brainstem', col: '#ff9a3d', at: [[-.55, -1.1, .55], [-.6, -1.9, .5], [-.65, -2.7, .45]], job: 'Breathing, heart rate, sleep and alertness, and the road for nearly every signal between brain and body.' },
    thalamus: { name: 'Thalamus', col: '#ff6b6b', at: [[-.1, .1, .5]], job: 'The relay station: almost all senses (except smell) pass through it on the way to the cortex.' },
    hippo: { name: 'Hippocampus', col: '#f5a3ff', at: [[-.6, -.45, .38]], job: 'Turns experiences into lasting memories and builds a map for places. Damage here and new memories will not form.' },
    amyg: { name: 'Amygdala', col: '#ff5d73', at: [[.6, -.5, .34]], job: 'Tags things as emotionally important, fast: the quick route for fear, before you have thought about it.' },
    basal: { name: 'Basal ganglia', col: '#ffcf5c', at: [[.55, .45, .45]], job: 'Chooses which action to start and which to hold back; builds habits. Dopamine here signals reward and prediction errors.' },
    eye: { name: 'Eyes', col: '#ffffff', at: [[3.1, .25, .22]], job: 'The retina turns light into spikes; it already does edge detection before the brain gets anything.' },
    mouth: { name: 'Mouth and vocal cords', col: '#ffffff', at: [[2.3, -1.6, .22]], job: 'Muscles fed by the motor cortex and brainstem; speech needs more fine timing than almost any other movement.' },
    spinal: { name: 'Spinal cord and body', col: '#ffffff', at: [[-.7, -3.7, .3]], job: 'The cable to the body, with its own reflex circuits that act before the brain even hears about it.' },
    hand: { name: 'Hand', col: '#ffffff', at: [[1.9, -3.3, .24]], job: 'Thousands of touch, pressure and heat sensors per fingertip.' },
  };
  const TASKS = [
    { id: 'name', title: 'See a cat and say "cat"', path: [['eye', 'Light becomes spikes in the retina.'], ['thalamus', 'The thalamus relays the picture onward.'], ['occipital', 'V1 finds edges, then shapes.'], ['temporal', 'The temporal lobe recognises "cat" and finds the word.'], ['frontal', 'Broca\'s area plans the sounds.'], ['motor', 'Motor cortex commands lips, tongue and breath.'], ['mouth', 'You say it. All of this takes roughly a fifth of a second.']] },
    { id: 'ball', title: 'Catch a ball', path: [['eye', 'The ball\'s image reaches the retina.'], ['thalamus', 'Relay.'], ['occipital', 'Motion and position are extracted.'], ['parietal', 'Where will the ball be, relative to my hand?'], ['frontal', 'Decide to catch it.'], ['motor', 'Commands to the arm and hand.'], ['cerebellum', 'Timing is corrected on the fly; this is the skill you practised.'], ['spinal', 'Commands travel down the cord.'], ['hand', 'Fingers close.']] },
    { id: 'park', title: 'Remember where you parked', path: [['temporal', 'You recognise the street.'], ['hippo', 'The hippocampus retrieves the place memory it stored.'], ['thalamus', 'Signals are relayed back.'], ['frontal', 'Planning: which way to walk?'], ['basal', 'Choose to start walking.'], ['motor', 'Walking commands go out.']] },
    { id: 'fear', title: 'A sudden loud bang', path: [['thalamus', 'Sound arrives via the thalamus.'], ['amyg', 'FAST road: the amygdala flags danger within a few thousandths of a second.'], ['stem', 'Heart rate and breathing jump.'], ['spinal', 'Muscles tense: you flinch.'], ['temporal', 'SLOW road: the cortex works out it was a door.'], ['frontal', 'The frontal lobe tells the amygdala to calm down.']] },
    { id: 'hot', title: 'Touch a hot pan', path: [['hand', 'Heat sensors fire.'], ['spinal', 'REFLEX: a loop in the spinal cord pulls the hand back already.'], ['stem', 'The news climbs the cord.'], ['thalamus', 'Relay.'], ['parietal', 'You feel where and how much it hurts, a moment after you moved.']] },
  ];
  function map(c) {
    const { S, tb, trace, side, p3 } = c, M = { task: 0, t: 0, sel: 'frontal', speed: 1 };
    const info = `<h3 style="margin:0 0 6px">The whole brain, and the road a thought takes</h3><p>About <b>86 billion neurons</b> in roughly <b>1.4 kg</b>, running on about <b>20 watts</b> (a dim light bulb). Only around 16 billion are in the cortex, the wrinkled outer sheet; about 69 billion are in the small <b>cerebellum</b>. Each neuron makes thousands of synapses, so the total is on the order of a hundred trillion connections. Signals travel between 1 and 120 metres per second, far slower than a chip, but they run in parallel and the wiring itself is what learns.</p><p>Pick a task and watch the signal move through the regions that handle each step. Click a region to read what it does. The cortex is drawn as pale bubbles on the outside; the structures inside it (thalamus, hippocampus, amygdala, basal ganglia) are bright.</p>`;
    const stepsAt = () => { const t = TASKS[M.task], k = Math.floor(M.t / 60) % t.path.length; return { t, k }; };
    function scene() {
      const it = [], { t, k } = stepsAt(), act = new Set([t.path[k][0]]);
      const inner = new Set(['thalamus', 'hippo', 'amyg', 'basal']);
      Object.entries(REG).forEach(([id, R]) => { const on = act.has(id), sel = M.sel === id, edge = id === 'eye' || id === 'mouth' || id === 'hand' || id === 'spinal'; R.at.forEach(([x, z, r]) => { it.push(...SH.sphere([x, 0, z], inner.has(id) ? .26 : edge ? .24 : r * .55, R.col, { a: inner.has(id) ? .85 : edge ? .75 : .3, glow: on ? 1 : sel ? .5 : 0, lat: 5, lon: 9 })); }); if (id === 'stem' || id === 'spinal') it.push({ t: 'line', a: [R.at[0][0], 0, R.at[0][1] + .2], b: [R.at[0][0], 0, R.at[R.at.length - 1][1] - .2], color: R.col, w: 3 }); });
      /* the outline of the cortex, drawn as a few wrinkled rings so it reads as a brain */
      for (const y of [-.7, 0, .7]) { const sc = 1 - Math.abs(y) * .16; let prev = null; for (let i = 0; i <= 90; i++) { const th = i / 90 * 6.2832, sn = Math.sin(th), q = [-.15 + 2.95 * Math.cos(th) * sc, y, .85 + (sn > 0 ? 1.35 : .5) * sn * sc + .06 * Math.sin(th * 15 + y * 3)]; if (prev) it.push({ t: 'line', a: prev, b: q, color: 'rgba(190,210,255,.6)', w: 1 }); prev = q; } }
      it.push({ t: 'line', a: [-.6, 0, .4], b: [.35, 0, 1.2], color: 'rgba(190,210,255,.35)', w: 1 }); it.push({ t: 'line', a: [-.2, 0, 2.15], b: [-.45, 0, .5], color: 'rgba(190,210,255,.2)', w: 1 });
      const cx = -.15, cz = .9, big = new Set(['eye', 'mouth', 'hand', 'spinal']);
      const lab = id => { const R = REG[id], a = R.at[0], on = act.has(id), sel = M.sel === id; if (inner.has(id) && !on && !sel) return; let dx = a[0] - cx, dz = a[1] - cz; const m = Math.hypot(dx, dz) || 1; const off = big.has(id) ? .5 : inner.has(id) ? .45 : a[2] * .62 + .3; it.push(SH.label([a[0] + dx / m * off, 0, a[1] + dz / m * off], R.name, { size: 10.5, color: on ? '#ffffff' : sel ? '#ffd166' : '#b8c4d6', bg: on || sel })); };
      Object.keys(REG).forEach(lab);
      for (let i = 0; i + 1 < t.path.length; i++) { const a = REG[t.path[i][0]].at[0], b = REG[t.path[i + 1][0]].at[0]; it.push({ t: 'line', a: [a[0], 0, a[1]], b: [b[0], 0, b[1]], color: i < k ? 'rgba(255,214,102,.8)' : 'rgba(255,255,255,.18)', w: i < k ? 2.4 : 1 }); }
      if (k + 1 < t.path.length) { const a = REG[t.path[k][0]].at[0], b = REG[t.path[k + 1][0]].at[0], u = (M.t % 60) / 60; it.push({ t: 'pt', p: [a[0] + (b[0] - a[0]) * u, 0, a[1] + (b[1] - a[1]) * u], r: 9, color: '#ffffff', ring: '#ffd166' }); }
      return it;
    }
    function step(dt) { M.t += dt * M.speed; }
    function drawTrace() { const { t, k } = stepsAt(); trace.innerHTML = `<text x="12" y="14" class="tk">${t.title}: step ${k + 1} of ${t.path.length}</text>` + t.path.map((q, i) => `<rect x="${10 + i * (740 / t.path.length)}" y="30" width="${740 / t.path.length - 6}" height="${i === k ? 34 : 22}" rx="5" fill="${i <= k ? '#ffd166' : '#8895a8'}" opacity="${i === k ? 1 : .45}"/><text x="${14 + i * (740 / t.path.length)}" y="${i === k ? 52 : 46}" class="tk" style="fill:#10131a">${REG[q[0]].name.slice(0, Math.floor(740 / t.path.length / 7))}</text>`).join('') + `<text x="12" y="100" class="tk">${t.path[k][1].replace(/&/g, '&amp;')}</text>`; }
    function num() { const el = $('#brnum', side); if (!el) return; const R = REG[M.sel]; el.innerHTML = `<div class="nv"><span>${R.name}</span><i class="num">${R.job}</i></div>`; }
    function buildSide() {
      side.innerHTML = ''; const row = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, TASKS.map((t, i) => tb(t.title, () => { M.task = i; M.t = 0; Array.from(row.children).forEach((b, j) => b.classList.toggle('primary', j === i)); }, '')));
      Array.from(row.children).forEach((b, j) => b.classList.toggle('primary', j === M.task)); side.append(row, h('div', { class: 'ill-num mono', id: 'brnum' }));
    }
    buildSide();
    const onClick = (cx, cy) => { let best = null, bd = 26; Object.keys(REG).forEach(id => { const a = REG[id].at[0], q = p3.proj([a[0], 0, a[1]]), d = Math.hypot(q[0] - cx, q[1] - cy); if (d < bd) { bd = d; best = id; } }); if (best) M.sel = best; };
    return { info, view: { az: 0, el: .08, center: [.3, 0, -.6], span: 7.2 }, tscale: .035, step, scene, trace: drawTrace, num, side: buildSide, onClick, M };
  }

  return { hhSim, synSim, hh, syn, map, REG, TASKS };
})();
