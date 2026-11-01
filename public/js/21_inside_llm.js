'use strict';
/* =====================================================================
   Inside a language model: a tiny transformer whose arithmetic you can watch.
   The model is real (embeddings, positions, attention with query / key / value, softmax, an MLP, logits, softmax again) but tiny: 12 numbers per word
   instead of thousands, a 20-word vocabulary, one attention head, one block. Its weights were set by hand (not trained) so that it completes a few kinds of
   sentences; a real model learns billions of weights from text. Every number on the screen is computed live by the code in LLMT below.
   ===================================================================== */
const LLMT = (() => {
  const DIMS = ['country', 'city', 'capital', 'animal', 'food', 'action', 'copula', 'article', 'fr', 'de', 'jp', 'in'];
  const D = DIMS.length, idx = Object.fromEntries(DIMS.map((d, i) => [d, i]));
  /* words already in the sentence are muted by 3 points: a real model learns not to repeat itself, here we do it by hand */
  const vec = o => { const v = new Array(D).fill(0); Object.entries(o).forEach(([k, x]) => { v[idx[k]] = x; }); return v; };
  const WORDS = {
    the: { article: 1 }, of: { article: .6 }, is: { copula: 1 }, capital: { capital: 1, city: .2, country: .2 },
    france: { country: 1, fr: 1 }, germany: { country: 1, de: 1 }, japan: { country: 1, jp: 1 }, india: { country: 1, in: 1 },
    paris: { city: 1, capital: .8, fr: 1 }, berlin: { city: 1, capital: .8, de: 1 }, tokyo: { city: 1, capital: .8, jp: 1 }, delhi: { city: 1, capital: .8, in: 1 },
    cat: { animal: 1 }, dog: { animal: 1 }, eats: { action: 1 }, apple: { food: 1 }, bread: { food: 1, action: .1 }, rice: { food: 1 }, fish: { food: .8, animal: .6 },
  };
  const vocab = Object.keys(WORDS), E = vocab.map(w => vec(WORDS[w]));
  /* weights chosen by hand: Wq lets a verb ask "which words tell me what I am talking about?", Wk and Wv keep the vectors, the MLP turns "country X" into "its city" and "animal that eats" into "food" */
  const eye = () => Array.from({ length: D }, (_, i) => Array.from({ length: D }, (_, j) => (i === j ? 1 : 0)));
  const Wq = Array.from({ length: D }, () => new Array(D).fill(0)); Wq[idx.copula][idx.country] = 9; Wq[idx.copula][idx.capital] = 9; Wq[idx.action][idx.animal] = 9;
  const Wk = eye(), Wv = eye(), Wo = eye().map(r => r.map(v => v * 1.0));
  const H = 6, W1 = Array.from({ length: D }, () => new Array(H).fill(0)), b1 = new Array(H).fill(0), W2 = Array.from({ length: H }, () => new Array(D).fill(0)), b2 = new Array(D).fill(0);
  /* neurons 0-3: "country + its identity + capital asked" -> its city; neuron 4: "animal + action" -> food; neuron 5: "animal alone" -> keeps it */
  [['fr', 0], ['de', 1], ['jp', 2], ['in', 3]].forEach(([k, n]) => { W1[idx[k]][n] = 2; W1[idx.capital][n] = 1; W1[idx.country][n] = .4; b1[n] = -.55; W2[n][idx.city] = 2.2; W2[n][idx.capital] = 1.4; W2[n][idx[k]] = 2.4; W2[n][idx.country] = -2; });
  W1[idx.animal][4] = 1.5; W1[idx.action][4] = 1.5; b1[4] = -1.6; W2[4][idx.food] = 3.2; W2[4][idx.animal] = -1.2; W2[4][idx.action] = -.8;
  const P = i => { const v = new Array(D).fill(0); v[idx.article] = 0; v[idx.copula] = 0; return v.map((x, k) => x + (k % 3 === 0 ? .02 * Math.sin(i * 1.3 + k) : 0)); };
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0), vm = (v, M) => M[0].map((_, j) => v.reduce((s, x, i) => s + x * M[i][j], 0)), add = (a, b) => a.map((v, i) => v + b[i]);
  const softmax = (z, T = 1) => { const m = Math.max(...z), e = z.map(v => Math.exp((v - m) / T)), s = e.reduce((a, b) => a + b, 0); return e.map(v => v / s); };
  function run(words, T = 1) {
    const ids = words.map(w => vocab.indexOf(w)), n = ids.length, X = ids.map((id, i) => add(E[id], P(i))), last = X[n - 1];
    const q = vm(last, Wq), K = X.map(x => vm(x, Wk)), V = X.map(x => vm(x, Wv)), raw = K.map(k => dot(q, k) / Math.sqrt(D)), a = softmax(raw), o = V[0].map((_, j) => V.reduce((s, v, i) => s + a[i] * v[j], 0)), proj = vm(o, Wo), h1 = add(last, proj);
    const pre = vm(h1, W1).map((v, j) => v + b1[j]), act = pre.map(v => Math.max(0, v)), m = vm(act, W2).map((v, j) => v + b2[j]), h2 = add(h1, m), logits = E.map((e, i) => dot(h2, e) - (ids.includes(i) ? 3 : 0)), probs = softmax(logits.map(v => v * 1.5), T);
    return { ids, X, q, K, V, raw, a, o, proj, h1, pre, act, m, h2, logits, probs, top: probs.map((p, i) => [i, p]).sort((u, v) => v[1] - u[1]) };
  }
  return { DIMS, D, vocab, E, run, softmax, WORDS };
})();

function insideLLMView(o = {}) {
  const root = h('div', { class: 'stack explorer ill' }), W = 760, H = 470;
  const S = { words: ['the', 'capital', 'of', 'france', 'is'], stage: 0, playing: false, T: 1, speed: 1, t0: performance.now(), tStage: 0, gen: [] }, STAGES = ['Words in', 'Words become vectors', 'Attention: who should I listen to?', 'Mixing: the information flows in', 'MLP: the model thinks', 'Scores for every word', 'The next word'];
  const p3 = Plot3D(h('div'), { w: W, h: H, az: .55, el: .42, wheel: true, zoom: 1.9, label: '3-D animation of a tiny language model' }), holoWrap = h('div', { class: 'ex-holo' }); holoWrap.append(p3.cv);
  const promptIn = h('input', { class: 'input', value: S.words.join(' '), style: { minWidth: '260px' }, 'aria-label': 'prompt made of words from the vocabulary' }), msg = h('div', { class: 'muted', style: { fontSize: '13px', minHeight: '1.3em' } });
  const examples = [['the capital of france is', 'France'], ['the capital of japan is', 'Japan'], ['the capital of india is', 'India'], ['the cat eats', 'cat eats'], ['the dog eats', 'dog eats'], ['the capital of germany is', 'Germany']];
  const tb = (t, f, title) => h('button', { class: 'btn sm', type: 'button', title, onclick: f }, t);
  const stageBar = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px' } }), noteEl = h('div', { class: 'card pad prose ill-note' }), numEl = h('div', { class: 'card pad ill-num mono' });
  let R = null;
  const word = i => LLMT.vocab[i], fmt = v => (v >= 0 ? ' ' : '') + v.toFixed(2);
  function setPrompt(text) {
    const ws = text.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean), bad = ws.filter(w => !LLMT.vocab.includes(w));
    if (!ws.length || bad.length) { msg.textContent = bad.length ? `Not in this toy vocabulary: ${bad.join(', ')}. Words it knows: ${LLMT.vocab.join(', ')}.` : 'Type a few words.'; return; }
    msg.textContent = ''; S.words = ws.slice(-8); S.gen = []; promptIn.value = S.words.join(' '); recompute(); setStage(0);
  }
  function recompute() { R = LLMT.run(S.words, S.T); }
  function setStage(i) { S.stage = Math.max(0, Math.min(STAGES.length - 1, i)); S.t0 = performance.now(); drawText(); }
  function barsFor(v, c, color, scale = .42, w = .1) { const it = []; v.forEach((x, k) => { const hh = Math.max(.02, Math.abs(x) * scale); it.push(...SH.box([c[0] + (k - (v.length - 1) / 2) * w * 1.25, c[1], c[2] + (x >= 0 ? hh / 2 : -hh / 2)], [w, w, hh], x >= 0 ? color : '#ff7a9c', { a: .55, glow: Math.min(1, Math.abs(x)), w: .6 })); }); return it; }
  function drawText() {
    stageBar.innerHTML = ''; STAGES.forEach((s, i) => stageBar.append(h('button', { class: 'btn sm' + (i === S.stage ? ' primary' : ''), type: 'button', onclick: () => { S.playing = false; playBtn.textContent = '▶ Play'; setStage(i); } }, (i + 1) + '. ' + s)));
    const n = S.words.length, last = S.words[n - 1], L = LLMT;
    const txt = [
      `<p>The model reads your words: <b>${S.words.map(esc).join(' ')}</b>. Computers cannot do arithmetic on words, so step one is to turn each word into numbers. (A real model first cuts text into <i>tokens</i>; here every word is one token.)</p>`,
      `<p>Each word becomes a <b>vector</b>: a list of ${L.D} numbers, looked up in a table (the embedding). Each little bar is one number; pink means negative. Words with similar meaning get similar bars: look at <b>france</b> and <b>paris</b>, or <b>cat</b> and <b>dog</b>. In this toy we named the dimensions (${L.DIMS.join(', ')}); in a real model nobody names them, they are learned.</p>`,
      `<p>Now the last word, <b>${esc(last)}</b>, must decide which earlier words matter. It makes a <b>query</b> vector (what am I looking for?) and compares it with every word's <b>key</b> (what do I offer?) using a dot product, divided by &radic;${L.D}. Softmax turns the scores into weights that add up to 1. The arcs show the weights: thicker = more attention.</p>`,
      `<p>Each word also has a <b>value</b> vector, the information it passes on. The new vector for <b>${esc(last)}</b> is the <b>weighted sum</b> of the values, added to what it already had (a residual connection). Look: the vector for the last word now carries traces of the words it attended to.</p>`,
      `<p>The <b>MLP</b> is a small layer of ${6} neurons. Each neuron multiplies the vector by its weights, adds a bias and applies ReLU (negative becomes zero). A neuron that lights up here means "this pattern was present". Their outputs are mixed back into the vector. This is where the toy turns <i>country + capital</i> into <i>its city</i>, and <i>animal + eats</i> into <i>food</i>.</p>`,
      `<p>Finally the finished vector is compared (dot product) with the vector of <b>every word in the vocabulary</b>. The bigger the dot product, the more that word fits. These scores are called <b>logits</b>; softmax turns them into probabilities. Temperature changes how sharp the choice is.</p>`,
      `<p>The most probable next word is <b>${esc(word(R.top[0][0]))}</b> (${(R.top[0][1] * 100).toFixed(0)}%). The model appends it and runs the whole process again for the following word: that loop writes entire answers. ${S.gen.length ? 'Generated so far: <b>' + S.gen.map(esc).join(' ') + '</b>.' : 'Press "Add the word and continue" to loop.'}</p>`,
    ];
    noteEl.innerHTML = `<h3 style="margin:0 0 6px">${S.stage + 1}. ${esc(STAGES[S.stage])}</h3>` + txt[S.stage];
    const hm = (v, lab) => `<div class="nv"><span>${lab}</span>${v.map(x => `<i style="background:${x >= 0 ? `rgba(47,111,224,${Math.min(1, Math.abs(x) * .8)})` : `rgba(255,92,138,${Math.min(1, Math.abs(x) * .8)})`}" title="${x.toFixed(3)}">${x.toFixed(1)}</i>`).join('')}</div>`;
    let html = '';
    if (S.stage === 0) html = `<div class="nv"><span>word</span>${S.words.map((w, i) => `<b class="wd">${esc(w)}</b>`).join('')}</div><div class="nv"><span>id</span>${R.ids.map(i => `<b class="wd">${i}</b>`).join('')}</div>`;
    else if (S.stage === 1) html = `<div class="nv"><span>dimension</span>${L.DIMS.map(d => `<i class="dn">${d.slice(0, 4)}</i>`).join('')}</div>` + S.words.map((w, i) => hm(R.X[i], esc(w))).join('');
    else if (S.stage === 2) html = hm(R.q, 'query (' + esc(last) + ')') + S.words.map((w, i) => `<div class="nv"><span>${esc(w)}</span><i class="num">q.k/&radic;${L.D} = ${R.raw[i].toFixed(2)}</i><i class="num">softmax = <b>${(R.a[i] * 100).toFixed(0)}%</b></i></div>`).join('');
    else if (S.stage === 3) html = S.words.map((w, i) => hm(R.V[i].map(v => v * R.a[i]), esc(w) + ' x ' + (R.a[i] * 100).toFixed(0) + '%')).join('') + hm(R.o, 'sum = attention output') + hm(R.h1, 'h = word + output');
    else if (S.stage === 4) html = `<div class="nv"><span>neuron</span>${R.act.map((v, i) => `<i class="num${v > 0 ? ' on' : ''}">n${i + 1}: ${v.toFixed(2)}</i>`).join('')}</div>` + hm(R.m, 'MLP output') + hm(R.h2, 'h after MLP');
    else html = R.top.slice(0, 8).map(([i, p]) => `<div class="nv"><span>${esc(word(i))}</span><i class="bar" style="width:${Math.max(2, p * 260)}px"></i><i class="num">${(p * 100).toFixed(1)}%  (logit ${R.logits[i].toFixed(2)})</i></div>`).join('');
    numEl.innerHTML = html;
  }
  function scene(now) {
    if (!R) return [];
    const t = (now - S.t0) / 1000, st = S.stage, n = S.words.length, it = [], L = LLMT, sp = 1.5, X0 = i => (i - (n - 1) / 2) * sp, Z = (k) => k * .9;
    const E = '#4fd1ff'; for (let i = 0; i < 4; i++) it.push({ t: 'line', a: [-6, -2 + i * 1.3, -1.3], b: [6, -2 + i * 1.3, -1.3], color: 'rgba(79,209,255,.08)', w: .6, g: true });
    const label = (p, s, o2) => SH.label(p, s, Object.assign({ size: 12 }, o2 || {}));
    for (let i = 0; i < n; i++) {
      const w = S.words[i], x = X0(i), last = i === n - 1;
      if (st === 0) { it.push(...SH.box([x, 0, 0], [1.2, .5, .5], last ? '#ffd166' : '#4fd1ff', { a: .3, glow: .4 })); it.push(label([x, 0, .6], w, { size: 13, color: '#fff' })); it.push(label([x, 0, -.55], 'id ' + R.ids[i], { size: 10, color: '#9bb' })); }
      else {
        const rise = Math.min(1, t * 1.2), base = st === 1 ? 0 : 0; it.push(label([x, 0, -.9], w, { size: 12, color: last ? '#ffd166' : '#cfeaff' }));
        const vec = st >= 4 && last ? R.h2 : st >= 3 && last ? R.h1 : R.X[i];
        it.push(...barsFor(st === 1 && !last ? R.X[i].map(v => v * rise) : vec.map(v => v * (st === 1 ? rise : 1)), [x, 0, .1 + (st === 1 ? 0 : 0)], last ? '#ffd166' : '#6ea8ff', .62, .09));
      }
    }
    if (st === 2 || st === 3) {
      const lx = X0(n - 1), top = [lx, 0, 1.0];
      for (let i = 0; i < n - 1; i++) { const x = X0(i), wgt = R.a[i], mid = [(x + lx) / 2, 0, 1.2 + 1.4 * Math.abs(i - (n - 1)) / n], A = [x, 0, .8];
        let prev = A; for (let k = 1; k <= 14; k++) { const u = k / 14, pt = [x + (lx - x) * u, 0, .8 + (mid[2] - .8) * 4 * u * (1 - u) + (top[2] - .8) * u * .0]; it.push({ t: 'line', a: prev, b: pt, color: `rgba(255,214,102,${.25 + .7 * Math.min(1, wgt * 2.4)})`, w: .8 + 6 * wgt }); prev = pt; }
        it.push(label([mid[0], 0, mid[2] + .3], (wgt * 100).toFixed(0) + '%', { size: 11, color: '#ffd166' }));
        if (st === 3) { const u = (t * .5 + i * .17) % 1; it.push({ t: 'pt', p: [x + (lx - x) * u, 0, .8 + (mid[2] - .8) * 4 * u * (1 - u)], r: 5 + 12 * wgt, color: '#fff', ring: '#ffd166' }); }
      }
      it.push(label([lx, 0, 1.9], st === 2 ? 'asks: which of you matter?' : 'receives the weighted sum', { size: 11, color: '#ffd166' }));
    }
    if (st === 4) {
      const lx = X0(n - 1); for (let k = 0; k < 6; k++) { const a = R.act[k], p = [lx + (k - 2.5) * .5, 1.8, .9]; it.push(...SH.sphere(p, .13 + .2 * Math.min(1, a * .6), a > 0 ? '#ffd166' : '#4fd1ff', { a: a > 0 ? .85 : .3, glow: a > 0 ? 1 : 0, lat: 4, lon: 7 })); it.push({ t: 'line', a: [lx, 0, .9], b: p, color: a > 0 ? 'rgba(255,214,102,.8)' : 'rgba(79,209,255,.25)', w: a > 0 ? 2 : .8 }); }
      it.push(label([lx, 1.8, 1.55], 'MLP neurons (lit = active)', { size: 11, color: '#ffd166' }));
    }
    if (st >= 5) {
      const V = LLMT.vocab.length, bx = i => (i - (V - 1) / 2) * .62, top = R.top[0][0];
      LLMT.vocab.forEach((w, i) => { const p = R.probs[i], hh = Math.max(.03, p * 3.4), isTop = i === top, pos = [bx(i), 2.6, hh / 2 - .9]; it.push(...SH.box(pos, [.4, .4, hh], isTop ? '#ffd166' : '#6ea8ff', { a: .55, glow: isTop ? 1 : p * 2, w: .8 })); it.push({ t: 'txt', p: [bx(i), 2.6, -1.05], s: w.slice(0, 7), size: 9, color: isTop ? '#ffd166' : '#9bb', mono: true }); });
      const lx = X0(n - 1); const u = (t * .6) % 1; it.push({ t: 'pt', p: [lx + (bx(top) - lx) * u, 2.6 * u, .5 + (-.3) * u], r: 7, color: '#fff', ring: '#ffd166' });
      it.push(label([0, 2.6, 2.2], st === 5 ? 'every word gets a score (dot product with the final vector)' : 'highest probability wins: "' + word(top) + '"', { size: 12, color: '#ffd166' }));
    }
    return it;
  }
  const playBtn = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { S.playing = !S.playing; playBtn.textContent = S.playing ? '❚❚ Pause' : '▶ Play'; S.t0 = performance.now(); S.autoAt = performance.now(); } }, '▶ Play');
  const temp = h('input', { type: 'range', min: .2, max: 3, step: .1, value: 1, 'aria-label': 'temperature', oninput: e => { S.T = +e.target.value; recompute(); drawText(); } });
  const spd = h('input', { type: 'range', min: .4, max: 3, step: .1, value: 1, 'aria-label': 'speed', oninput: e => { S.speed = +e.target.value; } });
  const cont = tb('Add the word and continue', () => { const w = word(R.top[0][0]); S.gen.push(w); S.words = S.words.concat(w).slice(-8); promptIn.value = S.words.join(' '); recompute(); setStage(0); }, 'Append the predicted word and run the model again');
  const controls = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, playBtn, tb('◀ Step', () => { S.playing = false; playBtn.textContent = '▶ Play'; setStage(S.stage - 1); }, ''), tb('Step ▶', () => { S.playing = false; playBtn.textContent = '▶ Play'; setStage(S.stage + 1); }, ''), h('label', { class: 'sw' }, 'speed ', spd), h('label', { class: 'sw' }, 'temperature ', temp), cont, tb('Zoom +', () => p3.zoomBy(1.4), ''), tb('Zoom -', () => p3.zoomBy(1 / 1.4), ''), tb('Reset view', () => { p3.resetZoom(); p3.set3d(.55, .42); }, ''));
  const promptRow = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, h('b', {}, 'Prompt'), promptIn, tb('Run', () => setPrompt(promptIn.value), ''), ...examples.map(([t, l]) => tb(l, () => setPrompt(t), t)));
  promptIn.addEventListener('keydown', e => { if (e.key === 'Enter') setPrompt(promptIn.value); });
  let raf = 0;
  function loop(now) { if (!root.isConnected) { cancelAnimationFrame(raf); return; } if (S.playing && now - (S.autoAt || now) > 4200 / S.speed) { S.autoAt = now; if (S.stage < STAGES.length - 1) setStage(S.stage + 1); else { S.playing = false; playBtn.textContent = '▶ Play'; } } p3.set(scene(now), [0, .8, .9], 5.0); p3.draw(1); raf = requestAnimationFrame(loop); }
  root.append(...(o.embedded ? [] : [h('div', { class: 'page-h' }, h('div', {}, h('a', { href: '#/explore', class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← All concepts'), h('h1', {}, 'Inside a language model'), h('p', { class: 'muted lead' }, 'A tiny transformer whose arithmetic you can watch: words become vectors, attention decides what to listen to, a small network thinks, and every word in the vocabulary gets a score. The numbers are really computed here. The weights are set by hand (not trained), so it only knows a few kinds of sentences: real models learn billions of weights from text.')))]),
    h('div', { class: 'card pad stack' }, promptRow, msg, stageBar, controls, holoWrap), noteEl, numEl);
  setPrompt(S.words.join(' ')); raf = requestAnimationFrame(loop);
  root._destroy = () => { cancelAnimationFrame(raf); p3.destroy(); }; if (!o.embedded) App.dis.push(() => root._destroy());
  return root;
}
