'use strict';
/* =====================================================================
   Picture Class scenes, part 2: car (linear algebra as a car being stretched and turned), net (a neural network drawn in full, with real numbers
   flowing), pipeline (stations and moving items, for RAG and automation), llm (tokens, attention, next-word odds, the layer tower).
   ===================================================================== */

/* ---- a car drawn around (0,0), nose pointing right, about 100 wide ---- */
const picCar = (s = 1, body = '#d63b2f', id = 'cb') => `<g transform="scale(${s})"><ellipse cx="0" cy="22" rx="50" ry="5" fill="rgba(0,0,0,.18)"/>
<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${body}"/><stop offset="1" stop-color="#8e2118"/></linearGradient></defs>
<path d="M-52 12 L-50 0 Q-48 -6 -38 -8 L-20 -10 L-9 -23 Q-6 -27 2 -27 L24 -27 Q31 -27 35 -22 L43 -10 L50 -7 Q55 -5 55 2 L55 12 Q55 17 50 17 L-48 17 Q-52 17 -52 12 Z" fill="url(#${id})" stroke="#6e1a12" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M-6 -10 L2 -21 L23 -21 L31 -10 Z" fill="#cfe8ff" stroke="#6e1a12" stroke-width="1.2"/><line x1="13" y1="-21" x2="13" y2="-10" stroke="#6e1a12" stroke-width="1.2"/>
<rect x="-30" y="-1" width="9" height="3" rx="1.5" fill="#6e1a12" opacity=".6"/><rect x="10" y="-1" width="9" height="3" rx="1.5" fill="#6e1a12" opacity=".6"/>
<circle cx="52" cy="2" r="3.2" fill="#ffe66d" stroke="#a07b00" stroke-width=".8"/><rect x="-53" y="-1" width="4" height="8" rx="2" fill="#ff5a5a"/>
<g><circle cx="-31" cy="17" r="10" fill="#1d1d22"/><circle cx="-31" cy="17" r="4.6" fill="#c9ccd3"/><circle cx="31" cy="17" r="10" fill="#1d1d22"/><circle cx="31" cy="17" r="4.6" fill="#c9ccd3"/></g></g>`;
const picMul = (A, B) => [[A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]], [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]];
const picMixM = (A, B, t) => A.map((r, i) => r.map((v, j) => v + (B[i][j] - v) * t));

PIC.scenes.car = (stage, sp, ctx) => {
  const W = 560, H = 390, U = sp.unit || 34, ox = W / 2, oy = H / 2 + 6, I = [[1, 0], [0, 1]], from0 = sp.from || I;
  const targets = []; if (sp.seq) { let P = from0; sp.seq.forEach(M => { P = picMul(M, P); targets.push(P); }); } else targets.push(sp.mat || I);
  const car = sp.car || [2.6, 1.3], showCar = sp.car !== false, minis = sp.minis || [];
  let grid = ''; for (let i = -8; i <= 8; i++) { grid += `<line x1="${ox + i * U}" x2="${ox + i * U}" y1="0" y2="${H}" class="pc-g"/>`; } for (let j = -6; j <= 6; j++) grid += `<line x1="0" x2="${W}" y1="${oy - j * U}" y2="${oy - j * U}" class="pc-g"/>`;
  let warp = ''; if (sp.warp) { for (let i = -9; i <= 9; i++) warp += `<line x1="${i * U}" y1="${-9 * U}" x2="${i * U}" y2="${9 * U}" class="pc-warp"/>`; for (let j = -9; j <= 9; j++) warp += `<line x1="${-9 * U}" y1="${-j * U}" x2="${9 * U}" y2="${-j * U}" class="pc-warp"/>`; }
  const eig = (sp.eigLines || []).map(v => { const n = Math.hypot(v[0], v[1]), k = 9 * U / n; return `<line x1="${ox - v[0] * k}" y1="${oy + v[1] * k}" x2="${ox + v[0] * k}" y2="${oy - v[1] * k}" class="pc-eig"/>`; }).join('');
  const arrow = c => `<marker id="pa-${c}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="pc-ar-${c}"/></marker>`;
  stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="pc-svg pc-carsvg" role="img" aria-label="${picEsc(sp.title || 'a car transformed by a matrix')}"><defs>${arrow('i')}${arrow('j')}${arrow('p')}</defs>${grid}<line x1="0" x2="${W}" y1="${oy}" y2="${oy}" class="pc-ax"/><line x1="${ox}" x2="${ox}" y1="0" y2="${H}" class="pc-ax"/>${eig}
<g class="pc-warpg">${warp}</g>
${showCar ? `<g class="pc-carg"><g transform="translate(${car[0] * U},${-car[1] * U})">${picCar(U / 40 * 1.0, '#d63b2f', 'cbA')}</g></g>` : ''}
${minis.map((m, k) => `<g class="pc-mini" data-k="${k}"><g transform="translate(${m.pos[0] * U},${-m.pos[1] * U})">${picCar(U / 40 * 0.55, m.color || '#2f6fe0', 'cbm' + k)}</g></g>`).join('')}
${sp.vec === false ? '' : `<line class="pc-vec" x1="${ox}" y1="${oy}" x2="${ox}" y2="${oy}" marker-end="url(#pa-p)"/>`}
${sp.basis === false ? '' : `<line class="pc-bi" x1="${ox}" y1="${oy}" x2="${ox + U}" y2="${oy}" marker-end="url(#pa-i)"/><line class="pc-bj" x1="${ox}" y1="${oy}" x2="${ox}" y2="${oy - U}" marker-end="url(#pa-j)"/><text class="pc-bit" x="${ox + U + 6}" y="${oy + 14}">i</text><text class="pc-bjt" x="${ox + 8}" y="${oy - U - 4}">j</text>`}
<text class="pc-origin" x="${ox - 8}" y="${oy + 16}" text-anchor="end">origin</text></svg>
<div class="pc-readout"><div class="pc-mathead"></div><div class="pc-matlive"></div><div class="pc-det"></div></div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}<button type="button" class="btn sm pc-replay" hidden>↻ Replay</button>`;
  const q = s => stage.querySelector(s), carG = q('.pc-carg'), warpG = q('.pc-warpg'), bi = q('.pc-bi'), bj = q('.pc-bj'), bit = q('.pc-bit'), bjt = q('.pc-bjt'), vec = q('.pc-vec'), head = q('.pc-mathead'), live = q('.pc-matlive'), detEl = q('.pc-det'), replay = q('.pc-replay'), miniEls = [...stage.querySelectorAll('.pc-mini')];
  const set = M => {
    const [a, b, c, d] = [M[0][0], M[0][1], M[1][0], M[1][1]], tf = `translate(${ox},${oy}) matrix(${a},${-c},${-b},${d},0,0)`;
    if (carG) carG.setAttribute('transform', tf); warpG.setAttribute('transform', tf); miniEls.forEach(m => m.setAttribute('transform', tf));
    bi.setAttribute('x2', ox + a * U); bi.setAttribute('y2', oy - c * U); bj.setAttribute('x2', ox + b * U); bj.setAttribute('y2', oy - d * U); if (bit) { bit.setAttribute('x', ox + a * U + 6); bit.setAttribute('y', oy - c * U + 14); bjt.setAttribute('x', ox + b * U + 8); bjt.setAttribute('y', oy - d * U - 4); }
    if (vec) { const px = a * car[0] + b * car[1], py = c * car[0] + d * car[1]; vec.setAttribute('x2', ox + px * U); vec.setAttribute('y2', oy - py * U); }
    live.innerHTML = `<span class="pc-mb">[</span><span class="pc-mm"><i>${picNum(a)}</i><i>${picNum(b)}</i><i>${picNum(c)}</i><i>${picNum(d)}</i></span><span class="pc-mb">]</span>`; const det = a * d - b * c;
    detEl.innerHTML = `area × <b>${picNum(Math.round(det * 100) / 100)}</b> ${Math.abs(det) < 0.02 ? ' · <span class="pc-flat">flattened: this cannot be undone</span>' : det < 0 ? ' · flipped like a mirror' : ''}`;
  };
  const go = () => {
    replay.hidden = true; let k = 0, prev = from0; set(prev); head.textContent = sp.seqNames ? sp.seqNames[0] : (sp.name || 'the matrix');
    const nextT = () => {
      if (ctx.dead) return; if (k >= targets.length) { replay.hidden = false; return; } const A = prev, B = targets[k]; head.textContent = (sp.seqNames && sp.seqNames[k]) || sp.name || 'the matrix'; const kk = k++;
      ctx.wait(kk === 0 ? 600 : 500, () => ctx.tween(sp.ms || 1800, e => set(picMixM(A, B, e)), () => { prev = B; ctx.wait(900, nextT); }));
    }; nextT();
  };
  replay.onclick = go; go();
};

/* ---- a neural network drawn in full ---- */
const picRng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
function picNetModel(sp) {
  const r = picRng(sp.seed || 7), sizes = sp.sizes, Ws = [], Bs = [];
  for (let l = 0; l < sizes.length - 1; l++) { Ws.push(Array.from({ length: sizes[l] }, () => Array.from({ length: sizes[l + 1] }, () => Math.round((r() * 2 - 1) * 100) / 100))); Bs.push(Array.from({ length: sizes[l + 1] }, () => Math.round((r() * 0.6 - 0.3) * 100) / 100)); }
  const x0 = sp.input || Array.from({ length: sizes[0] }, () => Math.round(r() * 10) / 10), A = [x0], Z = [null];
  for (let l = 0; l < sizes.length - 1; l++) { const z = Bs[l].map((b, j) => A[l].reduce((s, a, i) => s + a * Ws[l][i][j], b)); Z.push(z); let a = z.map(v => Math.max(0, v)); if (l === sizes.length - 2) { const m = Math.max(...z), e = z.map(v => Math.exp(v - m)), s = e.reduce((p, c) => p + c, 0); a = sp.out === 'sigmoid' ? z.map(v => 1 / (1 + Math.exp(-v))) : e.map(v => v / s); } A.push(a); }
  return { Ws, Bs, A, Z, sizes };
}
PIC.scenes.net = (stage, sp, ctx) => {
  const M = picNetModel(sp), sizes = M.sizes, L = sizes.length, maxN = Math.max(...sizes), colGap = sp.gap || 150, rowGap = sp.rowGap || 46, padL = sp.names && sp.names.in ? 120 : 60, padR = sp.names && sp.names.out ? 120 : 60;
  const W = padL + padR + (L - 1) * colGap, H = Math.max(260, maxN * rowGap + 70);
  const X = l => padL + l * colGap, Y = (l, i) => H / 2 + 10 + (i - (sizes[l] - 1) / 2) * rowGap, nodeR = sp.r || 15;
  const titles = sizes.map((n, l) => l === 0 ? 'Input' : l === L - 1 ? 'Output' : 'Hidden ' + l);
  let edges = '', nodes = '', labels = '';
  for (let l = 0; l < L - 1; l++) for (let i = 0; i < sizes[l]; i++) for (let j = 0; j < sizes[l + 1]; j++) { const w = M.Ws[l][i][j]; edges += `<line class="pc-edge ${w >= 0 ? 'pos' : 'neg'}" data-l="${l}" data-i="${i}" data-j="${j}" x1="${X(l)}" y1="${Y(l, i)}" x2="${X(l + 1)}" y2="${Y(l + 1, j)}" style="stroke-width:${(0.4 + Math.abs(w) * 1.7).toFixed(2)}"/>`; }
  for (let l = 0; l < L; l++) { labels += `<text class="pc-lt" x="${X(l)}" y="22" text-anchor="middle">${titles[l]}</text><text class="pc-lt2" x="${X(l)}" y="38" text-anchor="middle">${sizes[l]} neuron${sizes[l] > 1 ? 's' : ''}</text>`; for (let i = 0; i < sizes[l]; i++) nodes += `<g class="pc-node" data-l="${l}" data-i="${i}"><circle cx="${X(l)}" cy="${Y(l, i)}" r="${nodeR}"/><text x="${X(l)}" y="${Y(l, i) + 4}" text-anchor="middle" class="pc-nv"></text></g>`; }
  const names = sp.names || {}; if (names.in) names.in.forEach((t, i) => { labels += `<text class="pc-nm" x="${X(0) - nodeR - 8}" y="${Y(0, i) + 4}" text-anchor="end">${picEsc(t)}</text>`; }); if (names.out) names.out.forEach((t, i) => { labels += `<text class="pc-nm" x="${X(L - 1) + nodeR + 8}" y="${Y(L - 1, i) + 4}">${picEsc(t)}</text>`; });
  const weights = M.Ws.reduce((s, w) => s + w.length * w[0].length, 0), biases = M.Bs.reduce((s, b) => s + b.length, 0), neurons = sizes.reduce((a, b) => a + b, 0);
  stage.innerHTML = `<div class="pc-netbar"><button type="button" class="btn sm pc-fitbtn">Fit to screen</button><button type="button" class="btn sm pc-realbtn">Actual size</button><span class="muted pc-netinfo">${neurons} neurons · ${weights} weights · ${biases} biases = <b>${weights + biases} numbers the network learns</b></span></div><div class="pc-netscroll"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="pc-netsvg" role="img" aria-label="Neural network with ${sizes.join(', ')} neurons per layer">${edges}${labels}${nodes}</svg></div><div class="pc-eq" aria-live="polite"></div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}<button type="button" class="btn sm pc-replay" hidden>↻ Replay</button>`;
  const svg = stage.querySelector('svg'), scroll = stage.querySelector('.pc-netscroll'), eqBox = stage.querySelector('.pc-eq'), replay = stage.querySelector('.pc-replay');
  const edgeEls = [...svg.querySelectorAll('.pc-edge')], nodeEl = (l, i) => svg.querySelector(`.pc-node[data-l="${l}"][data-i="${i}"]`), edgesOf = l => edgeEls.filter(e => +e.dataset.l === l);
  const fit = () => { svg.style.width = '100%'; svg.style.height = 'auto'; svg.removeAttribute('width'); svg.removeAttribute('height'); scroll.classList.add('fit'); }, real = () => { svg.setAttribute('width', W); svg.setAttribute('height', H); svg.style.width = ''; svg.style.height = ''; scroll.classList.remove('fit'); };
  stage.querySelector('.pc-fitbtn').onclick = fit; stage.querySelector('.pc-realbtn').onclick = real; if (W > 640 || sp.fit) fit();
  const setVal = (l, i, v, show) => { const n = nodeEl(l, i), c = n.querySelector('circle'); n.querySelector('.pc-nv').textContent = show ? picNum(v) : ''; c.style.fill = show ? `rgba(36,87,214,${Math.min(1, 0.08 + Math.abs(v) * (l === L - 1 ? 1 : 0.55))})` : ''; n.classList.toggle('on', !!show); };
  for (let i = 0; i < sizes[0]; i++) setVal(0, i, M.A[0][i], sp.mode !== 'static');
  if (sp.mode === 'forward') {
    const run = () => {
      replay.hidden = true; for (let l = 1; l < L; l++) for (let i = 0; i < sizes[l]; i++) setVal(l, i, 0, false); edgeEls.forEach(e => e.classList.remove('flow')); eqBox.innerHTML = 'The input numbers enter on the left.';
      let l = 0; const next = () => {
        if (ctx.dead) return; if (l >= L - 1) { eqBox.innerHTML = `Done. The output numbers on the right are the network's answer${names.out ? ' (' + names.out.map((t, i) => t + ' ' + picNum(M.A[L - 1][i])).join(', ') + ')' : ''}.`; replay.hidden = false; return; }
        const k = l++; edgeEls.forEach(e => e.classList.remove('flow')); edgesOf(k).forEach(e => e.classList.add('flow')); eqBox.innerHTML = `Layer ${k + 1}: every neuron adds up <b>(input × weight)</b> from all ${sizes[k]} neurons on its left, adds its bias${k === L - 2 ? ' and turns the scores into probabilities (softmax)' : ', then keeps only positive results (ReLU)'}.`;
        ctx.wait(1300, () => { for (let i = 0; i < sizes[k + 1]; i++) setVal(k + 1, i, M.A[k + 1][i], true); ctx.wait(1100, next); });
      }; ctx.wait(700, next);
    }; replay.onclick = run; run();
  } else if (sp.mode === 'neuron') {
    const [fl, fi] = sp.neuron, ins = M.A[fl - 1], ws = ins.map((_, i) => M.Ws[fl - 1][i][fi]), b = M.Bs[fl - 1][fi], z = M.Z[fl][fi];
    for (let l = 1; l < L; l++) for (let i = 0; i < sizes[l]; i++) setVal(l, i, M.A[l][i], l <= fl); for (let i = 0; i < sizes[fl - 1]; i++) setVal(fl - 1, i, ins[i], true);
    edgeEls.forEach(e => { const mine = +e.dataset.l === fl - 1 && +e.dataset.j === fi; e.style.opacity = mine ? 1 : 0.05; if (mine) e.classList.add('flow'); }); nodeEl(fl, fi).classList.add('focus');
    const lab = document.createElementNS('http://www.w3.org/2000/svg', 'g'); ws.forEach((w, i) => { const x = (X(fl - 1) * 0.62 + X(fl) * 0.38), y = (Y(fl - 1, i) * 0.62 + Y(fl, fi) * 0.38); const t = document.createElementNS('http://www.w3.org/2000/svg', 'text'); t.setAttribute('x', x); t.setAttribute('y', y - 3); t.setAttribute('class', 'pc-wl'); t.textContent = 'w=' + picNum(w); lab.appendChild(t); }); svg.appendChild(lab);
    eqBox.innerHTML = `<b>One neuron, opened up.</b><br>z = ${ins.map((a, i) => `${picNum(a)}×${picNum(ws[i])}`).join(' + ')} + bias ${picNum(b)}<br>  = <b>${picNum(z)}</b> → ${fl === L - 1 ? (sp.out === 'sigmoid' ? 'sigmoid squashes it to ' + picNum(1 / (1 + Math.exp(-z))) : 'softmax') : 'ReLU keeps ' + picNum(Math.max(0, z))}`;
  } else if (sp.mode !== 'static') { for (let l = 1; l < L; l++) for (let i = 0; i < sizes[l]; i++) setVal(l, i, M.A[l][i], true); }
  else eqBox.innerHTML = sp.say || '';
};

/* ---- stations and moving items (RAG, automation, ML factory) ---- */
PIC.scenes.pipeline = (stage, sp, ctx) => {
  const lanes = sp.lanes || [{ name: '', stations: sp.stations, tokens: sp.tokens }];
  stage.innerHTML = `<div class="pc-lanes">${lanes.map((ln, k) => `<div class="pc-lane" data-k="${k}"><div class="pc-lanename">${picEsc(ln.name || '')}</div><div class="pc-sts">${ln.stations.map((s, i) => `<div class="pc-st ${s.shared ? 'shared' : ''}" data-i="${i}"><div class="pc-ico">${s.icon}</div><b>${picEsc(s.name)}</b><small>${picEsc(s.sub || '')}</small></div>${i < ln.stations.length - 1 ? '<div class="pc-conv" aria-hidden="true"></div>' : ''}`).join('')}</div><div class="pc-track"></div></div>`).join('')}</div><div class="pc-does" aria-live="polite"></div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}<button type="button" class="btn sm pc-replay" hidden>↻ Replay</button>`;
  const does = stage.querySelector('.pc-does'), replay = stage.querySelector('.pc-replay');
  const runLane = (k, done) => {
    const ln = lanes[k], laneEl = stage.querySelector(`.pc-lane[data-k="${k}"]`), track = laneEl.querySelector('.pc-track'), sts = [...laneEl.querySelectorAll('.pc-st')]; track.innerHTML = ''; sts.forEach(s => s.classList.remove('lit'));
    const tr = track.getBoundingClientRect(), cx = i => { const r = sts[i].getBoundingClientRect(); return r.left + r.width / 2 - tr.left; };
    const place = (c, i, txt) => { const old = c.textContent; if (txt != null) c.textContent = txt; const w = c.offsetWidth; c.textContent = old; return Math.max(0, Math.min(tr.width - w, cx(i) - w / 2)); }, textAt = (ti, i) => ln.tokens[ti].texts[Math.min(i, ln.tokens[ti].texts.length - 1)];
    const chips = (ln.tokens || []).map((t, ti) => { const c = document.createElement('div'); c.className = 'pc-chip'; c.textContent = t.texts[0]; c.style.top = (ti * 30) + 'px'; track.appendChild(c); c.style.transform = `translateX(${place(c, 0)}px)`; return c; });
    track.style.minHeight = Math.max(40, (ln.tokens || []).length * 30 + 6) + 'px'; let i = 0;
    const step = () => {
      if (ctx.dead) return; sts.forEach(s => s.classList.remove('lit')); sts[i].classList.add('lit'); does.innerHTML = `<b>${picEsc(ln.stations[i].name)}.</b> ${ln.stations[i].does || ''}`;
      chips.forEach((c, ti) => { const txt = textAt(ti, i); if (c.textContent !== txt) { c.textContent = txt; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); } });
      if (i >= sts.length - 1) { ctx.wait(1800, done); return; }
      ctx.wait(2200, () => { i++; chips.forEach((c, ti) => { c.style.transitionDelay = (ti * 120) + 'ms'; c.style.transform = `translateX(${place(c, i, textAt(ti, i))}px)`; }); ctx.wait(1000, step); });
    }; step();
  };
  const all = () => { replay.hidden = true; let k = 0; const nextLane = () => { if (ctx.dead) return; if (k >= lanes.length) { replay.hidden = false; return; } stage.querySelectorAll('.pc-lane').forEach((e, j) => e.classList.toggle('dimlane', j !== k)); runLane(k++, nextLane); }; ctx.wait(500, nextLane); };
  replay.onclick = all; all();
};

/* ---- language models: tokens, attention, next-word odds, the layer tower ---- */
PIC.scenes.llm = (stage, sp, ctx) => {
  const mode = sp.mode || 'tokens', toks = sp.tokens || [];
  if (mode === 'tokens') {
    stage.innerHTML = `<div class="pc-llm"><div class="pc-sent">${picEsc(sp.sentence)}</div><div class="pc-toks">${toks.map((t, i) => `<div class="pc-tok" data-i="${i}"><div class="pc-tt">${picEsc(t)}</div><div class="pc-id"></div><div class="pc-vec2"></div></div>`).join('')}</div><div class="pc-does"></div></div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}<button type="button" class="btn sm pc-replay" hidden>↻ Replay</button>`;
    const els = [...stage.querySelectorAll('.pc-tok')], does = stage.querySelector('.pc-does'), replay = stage.querySelector('.pc-replay'), upto = sp.upto == null ? 3 : sp.upto, rr = picRng(11);
    const run = () => {
      replay.hidden = true; els.forEach(e => { e.classList.remove('split', 'idon', 'veon'); }); stage.querySelector('.pc-sent').classList.remove('gone'); does.textContent = 'A sentence is just text.';
      ctx.wait(800, () => { stage.querySelector('.pc-sent').classList.add('gone'); els.forEach((e, i) => ctx.wait(i * 90, () => e.classList.add('split'))); does.innerHTML = '<b>1. Tokenize:</b> the text is cut into pieces the model knows (words or parts of words).'; });
      if (upto >= 1) ctx.wait(3000, () => { els.forEach((e, i) => { e.querySelector('.pc-id').textContent = '#' + (sp.ids ? sp.ids[i] : 100 + i * 37); ctx.wait(i * 90, () => e.classList.add('idon')); }); does.innerHTML = '<b>2. Look up the number:</b> every token has a fixed id in the model\'s vocabulary. The model only ever sees numbers.'; });
      if (upto >= 2) ctx.wait(5600, () => { els.forEach((e, i) => { e.querySelector('.pc-vec2').innerHTML = Array.from({ length: 8 }, () => { const v = rr() * 2 - 1; return `<i style="height:${6 + Math.abs(v) * 30}px;background:${v >= 0 ? 'var(--c0)' : 'var(--c1)'}"></i>`; }).join(''); ctx.wait(i * 90, () => e.classList.add('veon')); }); does.innerHTML = '<b>3. Embed:</b> each id becomes a long list of numbers (here 8 bars; real models use thousands). Tokens with similar meaning get similar bars.'; ctx.wait(2600, () => { replay.hidden = false; }); });
      else ctx.wait(4600, () => { replay.hidden = false; });
    }; replay.onclick = run; run();
  } else if (mode === 'attention') {
    const n = toks.length, Wt = sp.weights; let sel = sp.sel == null ? n - 1 : sp.sel;
    stage.innerHTML = `<div class="pc-llm"><svg viewBox="0 0 560 230" class="pc-svg pc-att"><g class="pc-arcs"></g></svg><div class="pc-toks pc-attrow">${toks.map((t, i) => `<button type="button" class="pc-tok pc-attok" data-i="${i}"><div class="pc-tt">${picEsc(t)}</div><div class="pc-w"></div></button>`).join('')}</div><div class="pc-does"></div></div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}`;
    const arcs = stage.querySelector('.pc-arcs'), els = [...stage.querySelectorAll('.pc-attok')], does = stage.querySelector('.pc-does');
    const svgEl = stage.querySelector('.pc-att'), pos = i => { const sr = svgEl.getBoundingClientRect(), cr = els[i].getBoundingClientRect(); return sr.width ? (cr.left + cr.width / 2 - sr.left) * (560 / sr.width) : 40 + (i + 0.5) * (480 / n); }, draw = () => {
      arcs.innerHTML = ''; els.forEach((e, i) => { e.classList.toggle('sel', i === sel); e.querySelector('.pc-w').textContent = i <= sel ? picNum(Math.round(Wt[sel][i] * 100)) + '%' : ''; });
      let msg = []; for (let j = 0; j <= sel; j++) { const w = Wt[sel][j]; if (j === sel) continue; const x1 = pos(sel), x2 = pos(j), mid = (x1 + x2) / 2, hh = 30 + Math.abs(x1 - x2) * 0.45; const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', `M${x1} 215 Q${mid} ${215 - hh} ${x2} 215`); p.setAttribute('class', 'pc-arc'); p.style.strokeWidth = 1 + w * 14; p.style.opacity = 0.15 + w * 1.4; arcs.appendChild(p); const len = p.getTotalLength(); p.style.strokeDasharray = len; ctx.tween(700, e => { p.style.strokeDashoffset = len * (1 - e); }); if (w > 0.15) msg.push(`"${toks[j].trim()}" (${Math.round(w * 100)}%)`); }
      does.innerHTML = `While reading <b>"${picEsc(toks[sel].trim())}"</b> the model looks back and pays most attention to: ${msg.length ? msg.join(', ') : 'itself'}. <span class="muted">Click another word to change who is looking.</span>`;
    };
    els.forEach(e => e.onclick = () => { sel = +e.dataset.i; draw(); }); draw();
  } else if (mode === 'next') {
    const base = sp.logits; let temp = sp.temp || 1;
    stage.innerHTML = `<div class="pc-llm"><div class="pc-prompt">${picEsc(sp.prompt)} <span class="pc-cursor">▍</span></div><div class="pc-bars2"></div><label class="pc-temp">creativity (temperature) <input type="range" min="0.2" max="2.5" step="0.1" value="${temp}"><b></b></label><div class="pc-does"></div></div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}`;
    const box = stage.querySelector('.pc-bars2'), slider = stage.querySelector('input'), tl = stage.querySelector('.pc-temp b'), does = stage.querySelector('.pc-does'); let shown = base.map(() => 0);
    const draw = (animate) => {
      const e = base.map(([, v]) => Math.exp(v / temp)), s = e.reduce((a, b) => a + b, 0), P = e.map(v => v / s); tl.textContent = temp.toFixed(1);
      box.innerHTML = base.map(([w], i) => `<div class="pc-b2"><span>${picEsc(w)}</span><div class="pc-bt"><div class="pc-bf" style="width:${animate ? shown[i] * 100 : P[i] * 100}%"></div></div><em>${(P[i] * 100).toFixed(0)}%</em></div>`).join('');
      if (animate) { const from = shown.slice(); ctx.tween(900, t => { box.querySelectorAll('.pc-bf').forEach((b, i) => { b.style.width = (from[i] + (P[i] - from[i]) * t) * 100 + '%'; }); }, () => { shown = P; }); } else shown = P;
      does.innerHTML = temp < 0.6 ? 'Low temperature: the model almost always picks the top word. Safe, repetitive.' : temp > 1.6 ? 'High temperature: unlikely words get a real chance. Creative, but can go off the rails.' : 'The model does not pick "the" answer: it holds a probability for every word, then <b>samples</b> one.';
    };
    slider.oninput = () => { temp = +slider.value; draw(false); }; draw(true);
  } else if (mode === 'tower') {
    const blocks = sp.blocks; stage.innerHTML = `<div class="pc-llm pc-tower"><div class="pc-tstack">${blocks.slice().reverse().map((b, ri) => { const i = blocks.length - 1 - ri; return `<div class="pc-tb" data-i="${i}"><b>${picEsc(b[0])}</b><small>${picEsc(b[1])}</small></div>`; }).join('')}</div><div class="pc-trun"><div class="pc-tokchip">cat</div></div><div class="pc-does"></div></div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}<button type="button" class="btn sm pc-replay" hidden>↻ Replay</button>`;
    const els = [...stage.querySelectorAll('.pc-tb')], chip = stage.querySelector('.pc-tokchip'), does = stage.querySelector('.pc-does'), replay = stage.querySelector('.pc-replay'), host = stage.querySelector('.pc-tstack');
    const run = () => { replay.hidden = true; let i = 0; els.forEach(e => e.classList.remove('lit')); const next = () => { if (ctx.dead) return; if (i >= blocks.length) { replay.hidden = false; return; } els.forEach(e => e.classList.remove('lit')); els[i].classList.add('lit'); chip.style.top = (els[i].offsetTop + els[i].offsetHeight / 2 - 12) + 'px'; chip.textContent = blocks[i][2] || 'cat'; does.innerHTML = `<b>${picEsc(blocks[i][0])}.</b> ${blocks[i][3] || ''}`; i++; ctx.wait(2300, next); }; chip.style.top = host.offsetHeight + 'px'; ctx.wait(500, next); };
    replay.onclick = run; run();
  }
};
