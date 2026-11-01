'use strict';
/* =====================================================================
   What a network of nodes can look like: the SAME knowledge graph drawn four ways (plain graph, spider web, atoms, galaxies) that morph into
   each other. The picture changes, the data does not. Ask a question and watch retrieval spread through the graph hop by hop, the way GraphRAG
   finds connected facts that a plain text search would miss.
   ===================================================================== */
const SKIN_NODES = [
  /* community 0: sales */ ['Refund policy', 0, 'Customers may return goods within 30 days for a full refund.'], ['Invoice', 0, 'Every order produces an invoice with a unique number.'], ['Customer', 0, 'A person or company that buys. Has an account and an order history.'], ['Order', 0, 'A basket of items bought at one time.'], ['Discount', 0, 'Codes that lower the price; above 20% they double the return rate.'], ['Return window', 0, '30 days from delivery; extended to 45 in December.'], ['Support ticket', 0, 'A customer question or complaint, tracked until solved.'], ['Payment', 0, 'Card, UPI or cash on delivery; refunds go back the same way.'],
  /* community 1: engineering */ ['API', 1, 'The FastAPI service all apps talk to.'], ['Database', 1, 'PostgreSQL: customers, orders and invoices live here.'], ['Deploy', 1, 'Containers built by CI and released on Render.'], ['Auth service', 1, 'Logins, tokens and password resets.'], ['Cache', 1, 'Redis: keeps hot answers for 60 seconds.'], ['Logging', 1, 'Every request and error is recorded for debugging.'], ['Queue', 1, 'Background jobs: emails, invoices, refunds.'], ['Model service', 1, 'Serves the churn and fraud models.'],
  /* community 2: people */ ['Asha', 2, 'Support lead. Owns ticket quality and refund disputes.'], ['Ravi', 2, 'Backend engineer. Maintains the API and deploys.'], ['Meera', 2, 'Finance. Approves refunds above 10,000 rupees.'], ['Kabir', 2, 'Data scientist. Built the fraud and churn models.'], ['Team lead', 2, 'Sets priorities and approves releases.'], ['On-call rota', 2, 'Who gets the alert at 3 a.m.'], ['Training', 2, 'Onboarding for new support staff.'], ['Policy owner', 2, 'Writes and updates company policies.'],
];
const SKIN_EDGES = [[0, 5], [0, 7], [0, 6], [0, 2], [1, 3], [1, 2], [1, 7], [2, 3], [3, 4], [3, 7], [4, 5], [6, 2], [6, 5], [8, 9], [8, 11], [8, 12], [8, 14], [9, 10], [9, 12], [10, 13], [10, 14], [11, 9], [13, 14], [15, 8], [15, 9], [16, 6], [16, 0], [16, 22], [17, 8], [17, 10], [18, 1], [18, 7], [18, 0], [19, 15], [19, 4], [20, 16], [20, 17], [21, 13], [21, 17], [22, 16], [23, 0], [23, 20], [3, 8], [2, 9], [6, 21]];
const SKIN_QS = [['Who handles a refund dispute?', [0, 6]], ['What happens to a payment when an order is returned?', [7, 5]], ['Who can fix a failing deploy at night?', [10, 21]], ['Which model is used on orders?', [15, 3]]];
const SKIN_COL = ['#2F6FE0', '#D2600F', '#1E8E5A'];

function skinsView(o = {}) {
  const root = h('div', { class: 'stack explorer skins' }), W = 760, H = 480, n = SKIN_NODES.length;
  const S = { skin: 'graph', sel: -1, morph: 1, from: null, speed: 1, q: null, qt: 0, pos: [] };
  const holo = h('div', { class: 'ex-holo' }), p3 = Plot3D(holo, { w: W, h: H, az: .5, el: .42, wheel: true, zoom: 1.65, label: 'A network drawn as a web, atoms or galaxies. Drag to rotate, wheel to zoom, click a node.' });
  const deg = new Array(n).fill(0), adj = Array.from({ length: n }, () => []); SKIN_EDGES.forEach(([a, b]) => { deg[a]++; deg[b]++; adj[a].push(b); adj[b].push(a); });
  const rr = RNG(5), com = i => SKIN_NODES[i][1], members = c => SKIN_NODES.map((_, i) => i).filter(i => com(i) === c).sort((a, b) => deg[b] - deg[a]);
  /* plain graph: a small force-directed layout computed once */
  const FG = (() => { let P = Array.from({ length: n }, () => [rr.norm(0, 1.4), rr.norm(0, 1.4), rr.norm(0, 1.4)]); for (let it = 0; it < 260; it++) { const F = P.map(() => [0, 0, 0]); for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = P[i].map((v, k) => v - P[j][k]), L = Math.hypot(...d) + .01, f = .9 / (L * L); d.forEach((v, k) => { F[i][k] += v / L * f; F[j][k] -= v / L * f; }); } SKIN_EDGES.forEach(([a, b]) => { const d = P[b].map((v, k) => v - P[a][k]), L = Math.hypot(...d) + .01, f = (L - 1.0) * .12; d.forEach((v, k) => { F[a][k] += v / L * f; F[b][k] -= v / L * f; }); }); P = P.map((p, i) => p.map((v, k) => v + Math.max(-.2, Math.min(.2, (F[i][k] - v * .02) * .4)))); } const m = Math.max(...P.map(p => Math.hypot(...p))); return P.map(p => p.map(v => v / m * 3.3)); })();
  const target = (skin, t) => SKIN_NODES.map((_, i) => {
    const c = com(i), mem = members(c), j = mem.indexOf(i);
    if (skin === 'graph') return FG[i];
    if (skin === 'web') { const sec = 6.2832 / 3, a = c * sec + .35 + (j % 4 + (j > 3 ? .5 : 0)) / 4.2 * (sec - .7), ring = 1 + (j % 4) * .8 + (j > 3 ? .4 : 0), z = -.05 * ring * ring; return [Math.cos(a) * ring, Math.sin(a) * ring, z]; }
    if (skin === 'atom') { const ca = c * 2.094 + .4, ctr = [Math.cos(ca) * 3.2, Math.sin(ca) * 3.2, [0, .9, -.9][c]]; if (j === 0) return ctr; const orbit = 1 + ((j - 1) % 3), rad = .75 + orbit * .5, ang = (j * 2.4) + t * (1.4 / orbit) * S.speed, tilt = [.3, 1.0, 1.7][orbit - 1] + c * .3; const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad; return [ctr[0] + x, ctr[1] + y * Math.cos(tilt), ctr[2] + y * Math.sin(tilt)]; }
    const ca = c * 2.094 + .6, ctr = [Math.cos(ca) * 3.2, Math.sin(ca) * 3.2, [0, .6, -.6][c]], arm = j % 2, th = j * .75 + arm * 3.1416 + t * .12 * S.speed, rad = .35 + j * .2;
    return [ctr[0] + Math.cos(th) * rad, ctr[1] + Math.sin(th) * rad, ctr[2] + Math.sin(j * 2.3) * .12];
  });
  const dust = Array.from({ length: 140 }, () => [rr.norm(0, 4.4), rr.norm(0, 4.4), rr.norm(0, 3)]);
  const fixes = { graph: 'The same facts as a plain graph: nodes pulled together by their links.', web: 'A spider web: three sectors, one per team; the best-connected facts sit nearest the centre, links are threads.', atom: 'Atoms: the best-connected fact is the nucleus, the others orbit it like electrons; links between teams are bonds.', universe: 'Galaxies: each team is a spiral galaxy, brighter stars are better connected; links are faint gas filaments.' };
  const info = h('div', { class: 'card pad prose' }), retr = h('div', { class: 'card pad stack' });
  const tb = (t, f, title) => h('button', { class: 'btn sm', type: 'button', title, onclick: f }, t);
  const skinBtns = {};
  const setSkin = k => { S.from = S.pos.map(p => p.slice()); S.skin = k; S.morph = 0; Object.entries(skinBtns).forEach(([a, b]) => b.classList.toggle('primary', a === k)); drawInfo(); };
  [['graph', 'Plain graph'], ['web', 'Spider web'], ['atom', 'Atoms'], ['universe', 'Universe']].forEach(([k, t]) => { skinBtns[k] = tb(t, () => setSkin(k), ''); });
  function drawInfo() {
    const sel = S.sel; info.innerHTML = `<p style="margin:0">${fixes[S.skin]} <b>Same data, different picture.</b> The meaning lives in the connections.</p>` + (sel >= 0 ? `<h3 style="margin:10px 0 4px">${esc(SKIN_NODES[sel][0])}</h3><p style="margin:0">${esc(SKIN_NODES[sel][2])}</p><p class="muted" style="font-size:13px;margin:4px 0 0">Connected to: ${adj[sel].map(j => esc(SKIN_NODES[j][0])).join(', ')}.</p>` : '<p class="muted" style="font-size:13px;margin:6px 0 0">Click a node to read its fact and light up its neighbours.</p>');
  }
  /* GraphRAG-style retrieval: spreading activation from the entities in the question */
  function ask(qi) {
    const [text, seeds] = SKIN_QS[qi], hop = new Array(n).fill(-1); let frontier = seeds.slice(); seeds.forEach(s => { hop[s] = 0; }); for (let h2 = 1; h2 <= 2; h2++) { const next = []; frontier.forEach(a => adj[a].forEach(b => { if (hop[b] < 0) { hop[b] = h2; next.push(b); } })); frontier = next; }
    S.q = { text, seeds, hop }; S.qt = 0; retr.innerHTML = ''; const got = hop.map((v, i) => [v, i]).filter(x => x[0] >= 0).sort((a, b) => a[0] - b[0] || deg[b[1]] - deg[a[1]]);
    retr.append(h('b', {}, 'Question: ' + text), h('p', { class: 'muted', style: { margin: 0, fontSize: '13px' } }, 'Retrieval starts at the entities named in the question (hop 0), then spreads along links to their neighbours (hop 1) and theirs (hop 2). The facts it collects are put in the prompt. A plain text search would only find the words in the question.'), h('div', { class: 'stack' }, got.slice(0, 9).map(([v, i]) => h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'chip', style: { background: SKIN_COL[com(i)], color: '#fff' } }, 'hop ' + v), h('b', {}, SKIN_NODES[i][0]), h('span', { class: 'muted', style: { fontSize: '13px' } }, SKIN_NODES[i][2])))));
  }
  p3.onClick = (cx, cy) => { let best = -1, bd = 24; S.pos.forEach((p, i) => { const q = p3.proj(p), d = Math.hypot(q[0] - cx, q[1] - cy); if (d < bd) { bd = d; best = i; } }); S.sel = best === S.sel ? -1 : best; drawInfo(); };
  const qRow = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } }, h('b', {}, 'Ask the graph'), ...SKIN_QS.map(([t], i) => tb(t, () => ask(i), '')), tb('Clear', () => { S.q = null; retr.innerHTML = ''; }, ''));
  const bar = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, ...Object.values(skinBtns), h('label', { class: 'sw' }, 'speed ', h('input', { type: 'range', min: .2, max: 3, step: .1, value: 1, oninput: e => { S.speed = +e.target.value; } })), tb('Zoom +', () => p3.zoomBy(1.4), ''), tb('Zoom -', () => p3.zoomBy(1 / 1.4), ''), tb('Reset view', () => { p3.resetZoom(); p3.set3d(.5, .42); }, ''));
  let raf = 0, last = 0, T = 0;
  function scene() {
    const it = [], tg = target(S.skin, T), e = S.morph < 1 ? 1 - Math.pow(1 - S.morph, 3) : 1;
    S.pos = tg.map((p, i) => (S.from && S.morph < 1) ? S.from[i].map((v, k) => v + (p[k] - v) * e) : p);
    const P = S.pos, act = S.q ? S.q.hop : null, qt = S.qt, lit = i => act && act[i] >= 0 && qt > act[i] * 1.1, sel = S.sel, nb = sel >= 0 ? new Set(adj[sel]) : null;
    if (S.skin === 'universe') dust.forEach(d => it.push({ t: 'pt', p: d, r: 1.4, color: 'rgba(200,220,255,.45)' }));
    if (S.skin === 'web') { for (let k = 1; k <= 5; k++) { let prev = null; for (let a = 0; a <= 36; a++) { const th = a / 36 * 6.2832, rad = k * .8 + .2, q = [Math.cos(th) * rad, Math.sin(th) * rad, -.05 * rad * rad]; if (prev) it.push({ t: 'line', a: prev, b: q, color: 'rgba(200,230,255,.13)', w: .7 }); prev = q; } } for (let a = 0; a < 18; a++) { const th = a / 18 * 6.2832; it.push({ t: 'line', a: [0, 0, 0], b: [Math.cos(th) * 4.2, Math.sin(th) * 4.2, -.05 * 17.6], color: 'rgba(200,230,255,.1)', w: .7 }); } }
    if (S.skin === 'atom') for (let c = 0; c < 3; c++) { const ca = c * 2.094 + .4, ctr = [Math.cos(ca) * 3.2, Math.sin(ca) * 3.2, [0, .9, -.9][c]]; [1, 2, 3].forEach(orbit => { const rad = .75 + orbit * .5, tilt = [.3, 1.0, 1.7][orbit - 1] + c * .3; let prev = null; for (let a = 0; a <= 36; a++) { const th = a / 36 * 6.2832, x = Math.cos(th) * rad, y = Math.sin(th) * rad, q = [ctr[0] + x, ctr[1] + y * Math.cos(tilt), ctr[2] + y * Math.sin(tilt)]; if (prev) it.push({ t: 'line', a: prev, b: q, color: SKIN_COL[c] + '55', w: .8 }); prev = q; } }); }
    SKIN_EDGES.forEach(([a, b]) => { const cross = com(a) !== com(b), hot = sel >= 0 && (a === sel || b === sel), on = act && lit(a) && lit(b) && Math.abs(act[a] - act[b]) === 1; it.push({ t: 'line', a: P[a], b: P[b], color: on ? '#ffd166' : hot ? '#ffffff' : cross ? (S.skin === 'atom' ? 'rgba(255,170,90,.7)' : 'rgba(255,170,90,.35)') : (S.skin === 'universe' ? 'rgba(150,180,255,.16)' : 'rgba(155,231,255,.3)'), w: on || hot ? 2.6 : cross ? 1.3 : .9 }); if (on) { const u = (qt * .8) % 1; it.push({ t: 'pt', p: P[a].map((v, k) => v + (P[b][k] - v) * (act[a] < act[b] ? u : 1 - u)), r: 5, color: '#fff' }); } });
    P.forEach((p, i) => { const c = com(i), big = S.skin === 'atom' && members(c)[0] === i, r0 = .1 + deg[i] * .028 + (big ? .2 : 0), isSel = i === sel, isNb = nb && nb.has(i), on = lit(i) || (act && act[i] === 0 && qt > 0);
      const col = S.skin === 'universe' ? ['#9bc2ff', '#ffb27a', '#8be3b0'][c] : SKIN_COL[c]; it.push(...SH.sphere(p, r0 * (isSel ? 1.5 : 1) * (on ? 1.35 : 1), on ? '#ffd166' : col, { a: .45 + (isSel || isNb || on ? .4 : 0) + (S.skin === 'universe' ? .1 : 0), glow: isSel ? 1 : on ? 1 : isNb ? .6 : S.skin === 'universe' ? .5 : 0, lat: big ? 5 : 4, lon: big ? 10 : 8 }));
      if (S.skin === 'universe') it.push({ t: 'pt', p, r: 3 + deg[i] * .9, color: 'rgba(255,255,255,.25)' }); if (isSel || isNb || on || S.skin === 'graph' || big) it.push(SH.label([p[0], p[1], p[2] + r0 + .22], SKIN_NODES[i][0], { size: isSel ? 12 : 10, color: isSel || on ? '#fff' : '#cfeaff' })); });
    return it;
  }
  function loop(now) { if (!root.isConnected) { cancelAnimationFrame(raf); return; } const dt = Math.min(.05, (now - (last || now)) / 1000); last = now; T += dt; if (S.morph < 1) S.morph = Math.min(1, S.morph + dt / 1.3); if (S.q) S.qt += dt * S.speed; p3.set(scene(), [0, 0, 0], 4.4); p3.draw(1); raf = requestAnimationFrame(loop); }
  root.append(...(o.embedded ? [] : [h('div', { class: 'page-h' }, h('div', {}, h('a', { href: '#/explore', class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← All concepts'), h('h1', {}, 'What a network looks like: web, atom, universe'), h('p', { class: 'muted lead' }, 'The same company knowledge graph (24 facts, 45 links) drawn four ways. Switch the picture and the nodes glide to their new places. Then ask a question and watch GraphRAG retrieval spread from the entities in the question, hop by hop, through the links.')))]), h('div', { class: 'card pad stack' }, bar, holo, qRow), info, retr);
  setSkin('graph'); S.morph = 1; S.pos = target('graph', 0); drawInfo(); raf = requestAnimationFrame(loop);
  root._destroy = () => { cancelAnimationFrame(raf); p3.destroy(); }; if (!o.embedded) App.dis.push(() => root._destroy());
  return root;
}

/* the "inside the machine" pages, listed on the Explorer home */
const INSIDE = {
  insidellm: { icon: 'Ll', title: 'Inside a language model', blurb: 'Words become vectors, attention weighs them, a small network thinks, every word gets a score. Real arithmetic, tiny sizes.', view: () => insideLLMView() },
  brain: { icon: 'Br', title: 'What natural intelligence looks like', blurb: 'A real neuron spiking, the artificial neuron beside it, and a small brain that rewires itself.', view: () => brainView() },
  skins: { icon: 'Wb', title: 'A network as web, atom or universe', blurb: 'The same knowledge graph in four shapes that morph into each other, and a question spreading through it.', view: () => skinsView() },
};
