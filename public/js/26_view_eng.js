'use strict';
/* =====================================================================
   Three engineering visuals:
   ringView      - consistent hashing: servers on a ring, keys assigned to the next server clockwise, add/remove a server and watch how few keys move
                   (compared with "hash mod N", which reshuffles nearly everything). Virtual nodes even out the load.
   reconcileView - the Kubernetes reconcile loop: you declare how many pods you want; a controller compares with what is running and creates or removes pods.
                   Kill pods, crash a node, change the desired count, roll out version 2 with maxSurge 1 / maxUnavailable 1.
   contrastView  - WCAG contrast: the arithmetic from colours to a ratio, the AA / AAA verdicts, a colour-blindness simulation and an automatic fix.
   ===================================================================== */
const fnv = s => { let h32 = 2166136261; for (let i = 0; i < s.length; i++) { h32 ^= s.charCodeAt(i); h32 = Math.imul(h32, 16777619); } h32 ^= h32 >>> 13; h32 = Math.imul(h32, 0x5bd1e995); h32 ^= h32 >>> 15; return (h32 >>> 0) / 4294967296; };
const SRV_COL = ['#2F6FE0', '#D2600F', '#1E8E5A', '#7A4FD0', '#0E8FA3', '#C2418A', '#B8860B', '#5b6b7f'];

function ringView(o = {}) {
  const K = viewKit(o, { title: 'Consistent hashing: a ring of servers', lead: 'How a cache or database spreads keys over many servers so that adding a server moves only a few of them. Each key goes to the first server clockwise from its hash.', th: 150, az: .2, el: .75, zoom: 1.3 });
  const { S, p3, trace, side, info } = K;
  const R = { servers: [0, 1, 2], vnodes: 1, nkeys: 240, nextId: 3, moved: 0, movedMod: 0, flash: {}, lastN: 3 };
  let keys = [], ring = [], owner = {};
  const buildRing = () => { ring = []; R.servers.forEach(s => { for (let j = 0; j < R.vnodes; j++) ring.push({ pos: fnv('S' + s + '#' + j), s }); }); ring.sort((a, b) => a.pos - b.pos); };
  const own = pos => { for (const v of ring) if (v.pos >= pos) return v.s; return ring[0].s; };
  const makeKeys = () => { keys = Array.from({ length: R.nkeys }, (_, i) => ({ id: i, pos: fnv('key' + i) })); };
  const assign = (flashMoved) => { const old = owner, nw = {}; let moved = 0, movedMod = 0; keys.forEach(k => { nw[k.id] = own(k.pos); if (flashMoved && old[k.id] !== undefined && old[k.id] !== nw[k.id]) { moved++; R.flash[k.id] = 1; } }); if (flashMoved) { const n0 = R.lastN, n1 = R.servers.length; keys.forEach(k => { if (Math.floor(k.pos * 1e6) % n0 !== Math.floor(k.pos * 1e6) % n1) movedMod++; }); R.moved = moved / keys.length; R.movedMod = movedMod / keys.length; } owner = nw; R.lastN = R.servers.length; };
  const counts = () => { const c = {}; R.servers.forEach(s => c[s] = 0); keys.forEach(k => { c[owner[k.id]]++; }); return c; };
  const rebuild = (flash) => { buildRing(); assign(flash); };
  const P = (pos, r, z = 0) => [r * Math.cos(pos * 6.2832 - 1.5708), -r * Math.sin(pos * 6.2832 - 1.5708), z];
  function scene() {
    const it = [], Rr = 3, c = counts(), mx = Math.max(1, ...Object.values(c));
    let pv = null; for (let i = 0; i <= 96; i++) { const q = P(i / 96, Rr); if (pv) it.push({ t: 'line', a: pv, b: q, color: 'rgba(255,255,255,.25)', w: 1.2 }); pv = q; }
    keys.forEach(k => { const f = R.flash[k.id] || 0, s = owner[k.id], col = SRV_COL[s % 8]; it.push({ t: 'pt', p: P(k.pos, Rr - .25 - (f > 0 ? .2 : 0)), r: f > 0 ? 5 : 2.6, color: f > 0 ? '#ffffff' : col }); });
    ring.forEach(v => { it.push({ t: 'pt', p: P(v.pos, Rr), r: 7, color: SRV_COL[v.s % 8], ring: '#fff' }); });
    R.servers.forEach(s => { const first = ring.find(v => v.s === s), h0 = c[s] / mx * 2.6 + .2; if (first) { it.push(...SH.cyl(P(first.pos, Rr + .9, h0 / 2), .24, h0, SRV_COL[s % 8], { axis: 'z', a: .7, glow: .3, sides: 10 })); it.push(SH.label(P(first.pos, Rr + .9, h0 + .35), `S${s + 1}: ${c[s]}`, { size: 11, color: '#fff' })); } });
    it.push(SH.label([0, 0, 0], `${R.servers.length} servers · ${R.vnodes} virtual node${R.vnodes > 1 ? 's' : ''} each`, { size: 11, color: '#cfeaff' })); it.push(SH.label([0, 0, -.5], 'bar height = keys held', { size: 10, color: '#9bb' }));
    return it;
  }
  function num() {
    const c = counts(), vals = Object.values(c), m = vals.reduce((a, b) => a + b, 0) / vals.length, sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length);
    side.querySelector('#rgnum').innerHTML = K.num([['balance', `keys per server: min <b>${Math.min(...vals)}</b>, max <b>${Math.max(...vals)}</b>, spread (sd / mean) <b>${(sd / m * 100).toFixed(0)}%</b>. More virtual nodes make this smaller.`], ['last change', R.moved || R.movedMod ? `consistent hashing moved <b>${(R.moved * 100).toFixed(0)}%</b> of keys; <code>hash mod N</code> would have moved about <b>${(R.movedMod * 100).toFixed(0)}%</b>` : 'add or remove a server to see how many keys move'], ['ideal', `adding a server to ${R.servers.length} should move about 1/${R.servers.length + 1} = ${(100 / (R.servers.length + 1)).toFixed(0)}% of keys (only the ones the new server takes over)`]]);
    trace.innerHTML = `<text x="12" y="20" class="tk">key hash in [0,1) goes round the ring; the owner is the first server point at or after it (clockwise)</text>` + R.servers.map((s, i) => `<rect x="${12 + i * 90}" y="40" width="80" height="${Math.max(4, c[s] / Math.max(1, ...vals) * 70)}" fill="${SRV_COL[s % 8]}" opacity=".85"/><text x="${14 + i * 90}" y="132" class="tk">S${s + 1}: ${c[s]}</text>`).join('');
  }
  const bar = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, K.tb('Add a server', () => { if (R.servers.length < 8) { R.servers.push(R.nextId++); rebuild(true); } }), K.tb('Remove a server', () => { if (R.servers.length > 1) { R.servers.splice(Math.floor(Math.random() * R.servers.length), 1); rebuild(true); } }), K.slider('virtual nodes', 1, 50, 1, R.vnodes, v => { R.vnodes = v; rebuild(false); }, 'Each server owns this many points on the ring'), K.slider('keys', 60, 600, 20, R.nkeys, v => { R.nkeys = v; makeKeys(); owner = {}; rebuild(false); }), ...K.zoomBar());
  side.append(h('div', { class: 'ill-num mono', id: 'rgnum' }));
  info.innerHTML = `<h3 style="margin:0 0 6px">Why not just use hash(key) mod N?</h3><p>The simple rule <code>server = hash(key) % N</code> works until N changes. Add one server and the answer changes for almost every key, so almost every cached item is suddenly on the "wrong" machine: a stampede on the database. <b>Consistent hashing</b> puts servers and keys on the same circle. A key belongs to the next server clockwise, so adding a server only takes over the keys between it and its neighbour: about 1/N of them. Removing a server hands its keys to the next one.</p><p>With few points the slices are uneven. Give each server many <b>virtual nodes</b> (many points on the ring) and the load evens out. Dynamo, Cassandra, memcached clients and CDN routers all use this idea.</p>`;
  makeKeys(); rebuild(false); owner = {}; assign(false);
  K.start((dt) => { Object.keys(R.flash).forEach(k => { R.flash[k] = Math.max(0, R.flash[k] - dt / 1400); if (!R.flash[k]) delete R.flash[k]; }); p3.set(scene(), [0, 0, 1], 7.4); p3.draw(1); if (!R._t || performance.now() - R._t > 300) { R._t = performance.now(); num(); } });
  p3.set3d(.2, .75);
  return K.build(bar);
}

/* ---------------------------------------------------------------- Kubernetes reconcile loop ---------------------------------------------------------------- */
function reconcileView(o = {}) {
  const K = viewKit(o, { title: 'Kubernetes: declare it, the controller makes it so', lead: 'You state the desired number of pods. A controller keeps comparing that with what is actually running and creates or deletes pods to close the gap. Kill things and watch it heal; roll out version 2 safely.', th: 150, az: .45, el: .6, zoom: 1.9 });
  const { S, p3, trace, side, info } = K;
  const X = { desired: 5, pods: [], nodes: [{ up: true }, { up: true }, { up: true }], target: 1, id: 0, log: [], tickT: 0, tick: 0, surge: 1, unavail: 1 };
  const logE = t => { X.log.unshift(`t${X.tick}  ${t}`); if (X.log.length > 6) X.log.pop(); };
  const live = () => X.pods.filter(p => p.state !== 'terminating'), ready = () => X.pods.filter(p => p.state === 'ready');
  const place = () => { let best = -1, bc = 99; X.nodes.forEach((n, i) => { if (!n.up) return; const c = X.pods.filter(p => p.node === i && p.state !== 'terminating').length; if (c < bc && c < 9) { bc = c; best = i; } }); return best; };
  const create = ver => { const n = place(); if (n < 0) { logE('no node has room: pod stays unscheduled'); return false; } X.pods.push({ id: ++X.id, node: n, ver, state: 'pending', age: 0 }); logE(`create pod-${X.id} (v${ver}) on node ${n + 1}`); return true; };
  const kill = p => { if (p.state === 'terminating') return; p.state = 'terminating'; p.age = 0; logE(`terminate pod-${p.id} (v${p.ver})`); };
  function tick() {
    X.tick++;
    X.pods.forEach(p => { p.age++; if (p.state === 'pending' && p.age >= 2) { p.state = 'ready'; } });
    X.pods = X.pods.filter(p => !(p.state === 'terminating' && p.age >= 1));
    X.nodes.forEach((n, i) => { if (!n.up) { const lost = X.pods.filter(p => p.node === i); if (lost.length) { logE(`node ${i + 1} is down: ${lost.length} pod(s) lost`); X.pods = X.pods.filter(p => p.node !== i); } } });
    const l = live(), old = l.filter(p => p.ver !== X.target), nw = l.filter(p => p.ver === X.target);
    if (old.length) {
      if (l.length < X.desired + X.surge && nw.length < X.desired) create(X.target);
      if (ready().length - 1 >= X.desired - X.unavail) { const victim = old.find(p => p.state !== 'ready') || old[0]; kill(victim); }
    } else if (l.length < X.desired) { for (let i = l.length; i < X.desired; i++) if (!create(X.target)) break; }
    else if (l.length > X.desired) { l.slice().sort((a, b) => (a.state === 'ready') - (b.state === 'ready')).slice(0, l.length - X.desired).forEach(kill); }
  }
  const slot = p => { const mates = X.pods.filter(q => q.node === p.node).sort((a, b) => a.id - b.id); return mates.indexOf(p); };
  function scene() {
    const it = [], nx = [-4.2, 0, 4.2];
    X.nodes.forEach((n, i) => { it.push(...SH.box([nx[i], 0, -.15], [3.4, 3.4, .22], n.up ? '#5b6b7f' : '#3a2020', { a: n.up ? .45 : .6, glow: 0 })); it.push(SH.label([nx[i], -2.2, -.2], `node ${i + 1}${n.up ? '' : ' (DOWN)'}`, { size: 11, color: n.up ? '#cfeaff' : '#ff8a8a' })); });
    X.pods.forEach(p => { const s = slot(p), gx = s % 3, gy = Math.floor(s / 3), pos = [nx[p.node] + (gx - 1) * 1.05, (gy - 1) * 1.05, .35], fade = p.state === 'terminating' ? .35 : p.state === 'pending' ? .55 : .9, col = p.state === 'pending' ? '#ffd166' : p.state === 'terminating' ? '#ff6b6b' : p.ver === 1 ? '#2F6FE0' : '#1E8E5A'; it.push(...SH.box(pos, [.82, .82, .62], col, { a: fade, glow: p.state === 'ready' ? .2 : .6 })); it.push({ t: 'txt', p: [pos[0], pos[1], .85], s: 'v' + p.ver, size: 9.5, color: '#fff', bold: true }); });
    it.push(...SH.ring([0, 3.6, .6], 1.0, '#7a5fd0', { axis: 'z', a: .6, glow: .6 })); it.push(SH.label([0, 3.6, 1.3], 'controller: desired ' + X.desired + ' / running ' + ready().length, { size: 11, color: '#d5bfff' }));
    return it;
  }
  function num() {
    const r = ready().length, pe = X.pods.filter(p => p.state === 'pending').length, v1 = live().filter(p => p.ver === 1).length, v2 = live().filter(p => p.ver === 2).length;
    side.querySelector('#k8num').innerHTML = K.num([['desired', `<b>${X.desired}</b> pods of version ${X.target}`], ['actual', `ready <b>${r}</b>, starting <b>${pe}</b>; version 1: ${v1}, version 2: ${v2}`], ['status', r === X.desired && v1 + v2 === X.desired && (X.target === 1 ? v2 === 0 : v1 === 0) ? '<b style="color:#1E8E5A">in sync</b>: actual = desired' : '<b style="color:#D2600F">reconciling...</b>']]);
    trace.innerHTML = `<text x="12" y="18" class="tk">controller log (newest first)</text>` + X.log.map((t, i) => `<text x="12" y="${40 + i * 18}" class="tk" opacity="${1 - i * .13}">${t}</text>`).join('');
  }
  const bar = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, K.play, K.speed(), K.slider('desired pods', 0, 9, 1, X.desired, v => { X.desired = v; logE('you set desired = ' + v); }), K.tb('Kill a random pod', () => { const l = live().filter(p => p.state === 'ready'); if (l.length) { const p = l[Math.floor(Math.random() * l.length)]; X.pods = X.pods.filter(q => q !== p); logE(`pod-${p.id} crashed`); } }), ...[0, 1, 2].map(i => K.tb(`Crash / restore node ${i + 1}`, () => { X.nodes[i].up = !X.nodes[i].up; logE(`node ${i + 1} ${X.nodes[i].up ? 'is back' : 'goes down'}`); })), K.tb('Roll out version 2', () => { X.target = 2; logE('you changed the image to v2: rolling update'); }), K.tb('Roll back to v1', () => { X.target = 1; logE('rollback to v1'); }), ...K.zoomBar());
  side.append(h('div', { class: 'ill-num mono', id: 'k8num' }));
  info.innerHTML = `<h3 style="margin:0 0 6px">Declare the state you want; a loop makes it true</h3><p>In Kubernetes you do not say "start 5 containers". You say "I want <b>5 replicas</b> of this image" (a <b>Deployment</b>). A <b>controller</b> runs a loop forever: <i>observe</i> what is running, <i>compare</i> with what you declared, <i>act</i> to close the gap. A pod crashes: the count drops, the loop creates a new one. A node dies: its pods are lost and replacements start on the healthy nodes. This self-healing is why you rarely repair things by hand.</p><p>A <b>rolling update</b> changes the image without downtime: with <code>maxSurge 1</code> it may run one extra pod, and with <code>maxUnavailable 1</code> it may have one fewer ready pod than desired. So it starts a v2 pod, waits for it to be ready, removes a v1 pod, and repeats until all are v2. If the new version is bad, <b>roll back</b> by declaring the old image again.</p>`;
  for (let i = 0; i < 5; i++) { create(1); } X.pods.forEach(p => { p.state = 'ready'; }); X.log = [];
  K.start((dt) => { if (S.playing) { X.tickT += dt * S.speed; if (X.tickT > 900) { X.tickT = 0; tick(); } } p3.set(scene(), [0, .6, .5], 7.4); p3.draw(1); num(); });
  p3.set3d(.45, .6);
  return K.build(bar);
}

/* ---------------------------------------------------------------- WCAG contrast ---------------------------------------------------------------- */
const hexRgb = hx => { const n = parseInt(hx.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lin = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
const lum = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + .05) / (Math.min(la, lb) + .05); };
const PROTAN = [[.567, .433, 0], [.558, .442, 0], [0, .242, .758]], DEUTAN = [[.625, .375, 0], [.7, .3, 0], [0, .3, .7]], TRITAN = [[.95, .05, 0], [0, .433, .567], [0, .475, .525]];
const simCB = (c, m) => m.map(r => r[0] * c[0] + r[1] * c[1] + r[2] * c[2]);
function contrastView(o = {}) {
  const root = h('div', { class: 'stack explorer' }), st = { fg: '#777777', bg: '#ffffff' };
  const out = h('div', { class: 'card pad stack' }), prev = h('div', { class: 'card pad' });
  const fgIn = h('input', { type: 'color', value: st.fg, oninput: e => { st.fg = e.target.value; draw(); } }), bgIn = h('input', { type: 'color', value: st.bg, oninput: e => { st.bg = e.target.value; draw(); } });
  const badge = (ok, t) => `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-weight:700;font-size:12px;margin-right:6px;background:${ok ? '#1E8E5A' : '#C0392B'};color:#fff">${ok ? 'PASS' : 'FAIL'} ${t}</span>`;
  function fix() { let f = hexRgb(st.fg), b = hexRgb(st.bg), dark = lum(b) > .4; for (let i = 0; i < 80 && ratio(f, b) < 4.5; i++) f = f.map(v => dark ? v * .95 : v + (255 - v) * .06); st.fg = rgbHex(f); fgIn.value = st.fg; draw(); }
  function draw() {
    const f = hexRgb(st.fg), b = hexRgb(st.bg), r = ratio(f, b), lf = lum(f), lb = lum(b), ch = c => c.map(v => +(lin(v)).toFixed(3));
    prev.style.background = st.bg; prev.style.color = st.fg; prev.innerHTML = `<div style="font-size:28px;font-weight:700">Quarterly revenue is up 12%</div><div style="font-size:16px">Body text at normal size: the quick brown fox jumps over the lazy dog.</div><div style="font-size:13px">Small caption text, 13px. Can everyone read this?</div>`;
    const sims = [['normal vision', f, b], ['protanopia', simCB(f, PROTAN), simCB(b, PROTAN)], ['deuteranopia', simCB(f, DEUTAN), simCB(b, DEUTAN)], ['tritanopia', simCB(f, TRITAN), simCB(b, TRITAN)]];
    out.innerHTML = `<div>${badge(r >= 4.5, 'AA body text (4.5)')}${badge(r >= 3, 'AA large text (3)')}${badge(r >= 7, 'AAA body text (7)')}</div><div class="ill-num mono"><div class="nv"><span>step 1</span><i class="num">each channel / 255, then linearised: fg ${ch(f).join(', ')}; bg ${ch(b).join(', ')}</i></div><div class="nv"><span>step 2</span><i class="num">relative luminance L = 0.2126 R + 0.7152 G + 0.0722 B: fg <b>${lf.toFixed(3)}</b>, bg <b>${lb.toFixed(3)}</b></i></div><div class="nv"><span>step 3</span><i class="num">ratio = (L<sub>light</sub> + 0.05) / (L<sub>dark</sub> + 0.05) = <b style="font-size:16px">${r.toFixed(2)} : 1</b></i></div></div><div class="row" style="flex-wrap:wrap;gap:8px">${sims.map(([n, ff, bb]) => `<div style="padding:8px 12px;border-radius:8px;background:${rgbHex(bb)};color:${rgbHex(ff)};border:1px solid rgba(128,128,128,.4)"><b>${n}</b><br>${ratio(ff, bb).toFixed(2)} : 1</div>`).join('')}</div>`;
  }
  root.append(...(o.embedded ? [] : [h('div', { class: 'page-h' }, h('div', {}, h('a', { href: '#/explore', class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← All concepts'), h('h1', {}, 'Contrast: can everyone read it?'), h('p', { class: 'muted lead' }, 'The arithmetic behind the accessibility rule: from two colours to a luminance, to a ratio, to a pass or fail. Try grey text on white, then press Fix.')))]),
    h('div', { class: 'card pad stack' }, h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '14px', alignItems: 'center' } }, h('label', { class: 'sw' }, 'text colour ', fgIn), h('label', { class: 'sw' }, 'background ', bgIn), h('button', { class: 'btn sm', type: 'button', onclick: () => { [st.fg, st.bg] = [st.bg, st.fg]; fgIn.value = st.fg; bgIn.value = st.bg; draw(); } }, 'Swap'), h('button', { class: 'btn primary sm', type: 'button', onclick: fix }, 'Fix: darken or lighten the text until it passes AA'), h('button', { class: 'btn sm', type: 'button', onclick: () => { st.fg = '#777777'; st.bg = '#ffffff'; fgIn.value = st.fg; bgIn.value = st.bg; draw(); } }, 'Reset')), prev), out,
    h('div', { class: 'card pad prose', html: '<h3 style="margin:0 0 6px">The rule, and why it exists</h3><p>The Web Content Accessibility Guidelines ask for a contrast ratio of at least <b>4.5 : 1</b> for normal text and <b>3 : 1</b> for large text (18px bold or 24px and up). The ratio compares how much light each colour gives off, after undoing the gamma curve of the screen: a mid-grey that looks "50%" is far darker in real light. About 1 in 12 men and 1 in 200 women have a colour-vision difference, and everyone reads worse in sunlight or on a dim screen, so low contrast hurts more people than you expect. The coloured boxes show your pair as people with common colour blindness see it: if the ratio stays high, the pair does not rely on hue.</p>' }));
  draw(); root._destroy = () => {}; return root;
}

registerInside('hashring', { icon: 'Hr', title: 'Consistent hashing ring', blurb: 'Servers and keys on a ring: add a server and see how few keys move, compared with hash mod N.' }, ringView);
registerInside('k8s', { icon: 'K8', title: 'Kubernetes reconcile loop', blurb: 'Declare 5 pods; kill pods, crash a node, roll out v2, and watch the controller heal and update.' }, reconcileView);
registerInside('contrast', { icon: 'Ct', title: 'Colour contrast and accessibility', blurb: 'From two colours to a WCAG ratio, with colour-blindness simulation and an automatic fix.' }, contrastView);
