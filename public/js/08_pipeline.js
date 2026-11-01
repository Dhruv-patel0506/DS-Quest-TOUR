'use strict';
/* =====================================================================
   Pipeline Lab: an n8n-style canvas. Drag algorithm blocks, wire them, and the diagram becomes real Python.
   - type-checked ports: a wrong connection shakes and explains WHY it does not fit
   - static checks: leakage (scaling before the split), task mismatch (regressor on a class label), missing inputs
   - Run: the generated code executes in the in-browser Python, data packets flow node to node with each node's output
   - "Step through the code" opens the Code Tutor on the generated script
   - challenges: build the right system for a scenario; then answer visual "what happens here?" questions about YOUR diagram
   ===================================================================== */
const PTYPES = { table: 'a table (DataFrame)', split: 'train/test split', fitted: 'a trained model', metrics: 'scores', docs: 'documents', chunks: 'text chunks', index: 'a vector index', hits: 'retrieved chunks', answer: 'an answer' };
const PN = {
  src_houses: { label: 'Dataset: houses', cat: 'Data', col: 0, out: 'table', task: 'reg', code: (i, o) => `TARGET = 'price_lakh'\n${o} = pd.read_csv('data/houses.csv')`, sum: o => `${o}.shape, list(${o}.columns)` },
  src_churn: { label: 'Dataset: churn', cat: 'Data', col: 0, out: 'table', task: 'clf', code: (i, o) => `TARGET = 'churned'\n${o} = pd.read_csv('data/churn.csv')`, sum: o => `${o}.shape, list(${o}.columns)` },
  clean: { label: 'Clean: drop duplicates / NaN', cat: 'Clean', col: 1, in: 'table', out: 'table', code: (i, o) => `${o} = ${i}.drop_duplicates().dropna()`, sum: o => `${o}.shape` },
  onehot: { label: 'One-hot encode text', cat: 'Clean', col: 1, in: 'table', out: 'table', code: (i, o) => `${o} = pd.get_dummies(${i}, dtype=float)`, sum: o => `${o}.shape` },
  scale_leaky: { label: 'Scale ALL rows (before split)', cat: 'Features', col: 2, in: 'table', out: 'table', leak: true, code: (i, o) => `num = [c for c in ${i}.columns if c != TARGET and pd.api.types.is_numeric_dtype(${i}[c])]\n${o} = ${i}.copy()\n${o}[num] = StandardScaler().fit_transform(${i}[num])   # fitted on ALL rows: leakage!`, sum: o => `${o}.shape` },
  split: { label: 'Train / test split', cat: 'Split', col: 3, in: 'table', out: 'split', code: (i, o) => `X = ${i}.drop(columns=TARGET)\ny = ${i}[TARGET]\nX_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0)\n${o} = 'split'`, sum: () => `X_train.shape, X_test.shape` },
  scale_train: { label: 'Scale (fit on train only)', cat: 'Features', col: 2, in: 'split', out: 'split', code: (i, o) => `sc = StandardScaler().fit(X_train)\nX_train, X_test = sc.transform(X_train), sc.transform(X_test)\n${o} = 'split'`, sum: () => `X_train.mean(axis=0).round(2)[:3], X_test.mean(axis=0).round(2)[:3]` },
  linreg: { label: 'Linear regression', cat: 'Model', col: 4, in: 'split', out: 'fitted', task: 'reg', code: (i, o) => `${o} = LinearRegression().fit(X_train, y_train)`, sum: o => `type(${o}).__name__` },
  forest_r: { label: 'Random forest (regressor)', cat: 'Model', col: 4, in: 'split', out: 'fitted', task: 'reg', code: (i, o) => `${o} = RandomForestRegressor(n_estimators=100, random_state=0).fit(X_train, y_train)`, sum: o => `type(${o}).__name__` },
  logreg: { label: 'Logistic regression', cat: 'Model', col: 4, in: 'split', out: 'fitted', task: 'clf', code: (i, o) => `${o} = LogisticRegression(max_iter=2000).fit(X_train, y_train)`, sum: o => `type(${o}).__name__` },
  forest_c: { label: 'Random forest (classifier)', cat: 'Model', col: 4, in: 'split', out: 'fitted', task: 'clf', code: (i, o) => `${o} = RandomForestClassifier(n_estimators=100, random_state=0).fit(X_train, y_train)`, sum: o => `type(${o}).__name__` },
  boost_c: { label: 'Gradient boosting (classifier)', cat: 'Model', col: 4, in: 'split', out: 'fitted', task: 'clf', code: (i, o) => `${o} = HistGradientBoostingClassifier(random_state=0).fit(X_train, y_train)`, sum: o => `type(${o}).__name__` },
  metrics: { label: 'Evaluate on the test rows', cat: 'Evaluate', col: 5, in: 'fitted', out: 'metrics', code: (i, o) => `pred = ${i}.predict(X_test)\n${o} = {'r2': r2_score(y_test, pred)} if TASK == 'reg' else {'accuracy': accuracy_score(y_test, pred)}`, sum: o => `{k: round(float(v), 3) for k, v in ${o}.items()}` },
  src_faq: { label: 'Documents: company FAQ', cat: 'RAG', col: 6, out: 'docs', code: (i, o) => `_all = pd.read_csv('data/faq.csv')\nqa = _all[_all.kind == 'question']\nQUESTION, TRUTH = qa.iloc[0].text, qa.iloc[0].title\n${o} = _all[_all.kind == 'doc']`, sum: o => `len(${o}), QUESTION` },
  chunk: { label: 'Chunk into sentences', cat: 'RAG', col: 6, in: 'docs', out: 'chunks', code: (i, o) => `${o} = [(r.id, s.strip()) for r in ${i}.itertuples() for s in r.text.split('.') if s.strip()]`, sum: o => `len(${o}), ${o}[0]` },
  embed: { label: 'Embed (TF-IDF vectors)', cat: 'RAG', col: 6, in: 'chunks', out: 'index', code: (i, o) => `vec = TfidfVectorizer(stop_words='english').fit([t for _, t in ${i}])\n${o} = (vec.transform([t for _, t in ${i}]), ${i})`, sum: o => `${o}[0].shape` },
  retrieve: { label: 'Retrieve top-3 (cosine)', cat: 'RAG', col: 6, in: 'index', out: 'hits', code: (i, o) => `M, chs = ${i}\nsims = cosine_similarity(vec.transform([QUESTION]), M)[0]\n${o} = [(chs[j][0], chs[j][1], round(float(sims[j]), 2)) for j in sims.argsort()[::-1][:3]]`, sum: o => `[(h[0], h[2]) for h in ${o}]` },
  generate: { label: 'Generate cited answer', cat: 'RAG', col: 6, in: 'hits', out: 'answer', code: (i, o) => `${o} = f"{${i}[0][1]} [source: {${i}[0][0]}]"`, sum: o => o },
  rag_eval: { label: 'Check: right doc retrieved?', cat: 'RAG', col: 6, in: 'hits', out: 'metrics', code: (i, o) => `${o} = {'hit_at_3': float(TRUTH in [h[0] for h in ${i}]), 'top1': float(${i}[0][0] == TRUTH)}`, sum: o => o },
};
const PCOL = i => cssColor(i);
const SCENARIOS = [
  { id: 'houses', title: 'Predict house prices without leakage', desc: 'Build: houses dataset -> (clean) -> train/test split -> a regression model -> evaluate on the test rows. If you scale features, do it AFTER the split.', need: ['src_houses', 'split', ['linreg', 'forest_r'], 'metrics'], order: ['src_houses', 'split', 'metrics'] },
  { id: 'churn', title: 'Churn classifier with text columns handled', desc: 'Build: churn dataset -> one-hot encode the text column -> split -> a classifier -> evaluate. Text columns must be turned into numbers BEFORE the model.', need: ['src_churn', 'onehot', 'split', ['logreg', 'forest_c', 'boost_c'], 'metrics'], order: ['src_churn', 'onehot', 'split', 'metrics'] },
  { id: 'rag', title: 'A RAG pipeline that finds the right policy', desc: 'Build: FAQ documents -> chunk -> embed -> retrieve -> check the right document was retrieved (and generate the cited answer).', need: ['src_faq', 'chunk', 'embed', 'retrieve', ['rag_eval', 'generate']], order: ['src_faq', 'chunk', 'embed', 'retrieve'] },
];

function viewPipelineLab() {
  const S = DSQ.S, root = h('div', { class: 'stack' });
  let nodes = [], edges = [], nid = 1, linkFrom = null, selNode = null, scn = SCENARIOS[0], last = null, tab = 'code', playing = null;
  const W = 900, Hh = 430, NW = 168, NH = 46, files = {};
  const need = f => { if (!files['data/' + f + '.csv']) files['data/' + f + '.csv'] = DS[f](RNG(7), 'standard'); };
  const taskOf = () => { const s = nodes.find(n => PN[n.t].task && PN[n.t].out === 'table'); return s ? PN[s.t].task : null; };
  const svg = h('div', { class: 'pcanvas' }), side = h('div', { class: 'stack' }), msg = h('div');

  const nodeBy = id => nodes.find(n => n.id === id), inEdge = id => edges.find(e => e.to === id);
  function addNode(t, x, y) { const n = { id: nid++, t, x: x ?? 40 + (nodes.length % 4) * 200, y: y ?? 30 + Math.floor(nodes.length / 4) * 90 + (nodes.length % 2) * 14 }; nodes.push(n); draw(); return n; }
  function say(txt, ok) { msg.innerHTML = `<div class="pmsg ${ok ? 'ok' : ''}">${txt}</div>`; }
  const reaches = (a, b) => { const seen = new Set(), st = [a]; while (st.length) { const x = st.pop(); if (x === b) return true; if (seen.has(x)) continue; seen.add(x); edges.filter(e => e.from === x).forEach(e => st.push(e.to)); } return false; };
  const FIX = { fitted: 'A model must be trained on training rows, so put a Train/test split in front of it.', metrics: 'Scores come from comparing a trained model with the test rows - connect a model.', split: 'Splitting works on a table: connect a dataset (or a cleaning step).', table: 'This block needs a table. Use a dataset or a cleaning/encoding step.', docs: 'Chunking works on documents: start from the FAQ documents block.', chunks: 'Embedding turns text chunks into vectors: chunk the documents first.', index: 'Retrieval searches a vector index: embed the chunks first.', hits: 'Generation/evaluation needs the retrieved chunks: add a Retrieve block.' };
  function tryLink(a, b, el) {
    const A = nodeBy(a), B = nodeBy(b); if (a === b) return;
    if (PN[A.t].out !== PN[B.t].in) { el && el.classList.add('shake'); setTimeout(() => el && el.classList.remove('shake'), 400); say(`<b>Does not fit.</b> "${PN[A.t].label}" outputs <b>${PTYPES[PN[A.t].out]}</b> but "${PN[B.t].label}" needs <b>${PTYPES[PN[B.t].in] || 'nothing (it is a source)'}</b>. ${FIX[PN[B.t].in] || ''}`); return; }
    if (inEdge(b)) edges = edges.filter(e => e.to !== b);
    if (reaches(b, a)) { say('That would make a loop. Pipelines here flow one way.'); return; }
    edges.push({ from: a, to: b }); say(`Connected: data of type <b>${PTYPES[PN[A.t].out]}</b> now flows from "${PN[A.t].label}" into "${PN[B.t].label}".`, true); linkFrom = null; draw(); refresh();
  }

  /* ---------- drawing ---------- */
  function draw(active, packet) {
    let s = svgOpen(W, Hh) + `<defs><marker id="pa" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9z" fill="var(--ax)"/></marker></defs><rect width="${W}" height="${Hh}" fill="transparent"/>`;
    edges.forEach(e => { const A = nodeBy(e.from), B = nodeBy(e.to), x1 = A.x + NW, y1 = A.y + NH / 2, x2 = B.x, y2 = B.y + NH / 2, mx = (x1 + x2) / 2; s += `<path class="pedge" data-from="${e.from}" data-to="${e.to}" d="M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" fill="none" stroke="var(--ax)" stroke-width="3" marker-end="url(#pa)" style="cursor:pointer"><title>click to delete this connection</title></path><text x="${mx}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle" class="m" font-size="10">${PTYPES[PN[A.t].out]}</text>`; });
    nodes.forEach(n => { const P = PN[n.t], on = active === n.id, bad = (last && last.bad && last.bad.includes(n.id)); s += `<g class="pnode" data-id="${n.id}" transform="translate(${n.x} ${n.y})"><rect width="${NW}" height="${NH}" rx="11" fill="${on ? 'var(--c1s)' : 'var(--surface)'}" stroke="${bad ? 'var(--bad)' : selNode === n.id ? 'var(--fg)' : PCOL(P.col)}" stroke-width="${on || bad || selNode === n.id ? 4 : 2.5}"/><text x="${NW / 2}" y="${NH / 2 + 4}" text-anchor="middle" font-weight="800" font-size="11.5">${esc(P.label.length > 27 ? P.label.slice(0, 26) + '.' : P.label)}</text>` +
      (P.in ? `<circle class="pin" data-id="${n.id}" cx="0" cy="${NH / 2}" r="7" fill="var(--surface)" stroke="${PCOL(P.col)}" stroke-width="3"/>` : '') + (P.out ? `<circle class="pout" data-id="${n.id}" cx="${NW}" cy="${NH / 2}" r="7" fill="${linkFrom === n.id ? 'var(--c1)' : PCOL(P.col)}" stroke="var(--surface)" stroke-width="2"/>` : '') + '</g>'; });
    if (packet) s += `<circle cx="${packet[0]}" cy="${packet[1]}" r="8" fill="var(--c1)" stroke="#fff" stroke-width="2"/>`;
    svg.innerHTML = s + '</svg>'; wire();
  }
  function wire() {
    const sv = $('svg', svg); const loc = e => { const r = sv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * Hh / r.height]; };
    $$('.pout', sv).forEach(e => e.addEventListener('pointerdown', ev => { ev.stopPropagation(); linkFrom = +e.dataset.id; say('Now click the left dot (input) of the block that should receive this data.'); draw(); }));
    $$('.pin', sv).forEach(e => e.addEventListener('pointerdown', ev => { ev.stopPropagation(); if (linkFrom != null) tryLink(linkFrom, +e.dataset.id, e.parentNode); }));
    $$('.pedge', sv).forEach(e => e.addEventListener('click', () => { edges = edges.filter(x => !(x.from == e.dataset.from && x.to == e.dataset.to)); say('Connection removed.'); draw(); refresh(); }));
    $$('.pnode', sv).forEach(g => g.addEventListener('pointerdown', ev => {
      const id = +g.dataset.id, n = nodeBy(id), [px, py] = loc(ev), ox = n.x - px, oy = n.y - py; selNode = id; let moved = false; g.setPointerCapture(ev.pointerId);
      const mv = e => { const [x, y] = loc(e); n.x = clamp(x + ox, 0, W - NW); n.y = clamp(y + oy, 0, Hh - NH); moved = true; g.setAttribute('transform', `translate(${n.x} ${n.y})`); $$('.pedge', sv).forEach(pe => { const A = nodeBy(+pe.dataset.from), B = nodeBy(+pe.dataset.to), x1 = A.x + NW, y1 = A.y + NH / 2, x2 = B.x, y2 = B.y + NH / 2, mx = (x1 + x2) / 2; pe.setAttribute('d', `M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`); }); };
      g.addEventListener('pointermove', mv); g.addEventListener('pointerup', () => { g.removeEventListener('pointermove', mv); if (!moved) { draw(); } }, { once: true });
    }));
    sv.addEventListener('pointerdown', e => { if (e.target === sv || e.target.tagName === 'rect' && !e.target.closest('.pnode')) { linkFrom = null; selNode = null; } });
  }

  /* ---------- code generation + checks ---------- */
  function order() {   // topological order of nodes reachable from sources
    const out = [], seen = new Set(); const visit = id => { if (seen.has(id)) return; seen.add(id); const e = inEdge(id); if (e) visit(e.from); out.push(id); };
    nodes.forEach(n => visit(n.id)); return out;
  }
  function gen() {
    const ids = order(), lines = ['import numpy as np, pandas as pd', 'from sklearn.preprocessing import StandardScaler', 'from sklearn.model_selection import train_test_split', 'from sklearn.linear_model import LinearRegression, LogisticRegression', 'from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, HistGradientBoostingClassifier', 'from sklearn.metrics import r2_score, accuracy_score', 'from sklearn.feature_extraction.text import TfidfVectorizer', 'from sklearn.metrics.pairwise import cosine_similarity', '', `TASK = '${taskOf() || 'reg'}'`, ''];
    ids.forEach(id => { const n = nodeBy(id), P = PN[n.t], e = inEdge(id), i = e ? 'n' + e.from : null, o = 'n' + id; lines.push(`# --- ${P.label} ---`); if (P.in && !i) lines.push(`# (nothing is connected to this block yet)`); else { lines.push(P.code(i, o)); lines.push(`print('##${id}', ${P.sum(o)})`); } lines.push(''); });
    return lines.join('\n');
  }
  function validate() {
    const issues = [], bad = [], task = taskOf();
    nodes.forEach(n => { const P = PN[n.t]; if (P.in && !inEdge(n.id)) { issues.push(`<b>${P.label}</b> has no input connected.`); bad.push(n.id); } if (P.task && P.out === 'fitted' && task && P.task !== task) { issues.push(`<b>${P.label}</b> predicts ${P.task === 'reg' ? 'numbers' : 'classes'}, but this dataset's target is ${task === 'reg' ? 'a number' : 'a class (0/1)'}. Pick a ${task === 'reg' ? 'regression' : 'classification'} model.`); bad.push(n.id); } if (P.leak && nodes.some(m => m.t === 'split' && reaches(n.id, m.id))) { issues.push(`<b>Leakage!</b> "${P.label}" learns the mean and spread from ALL rows, including the future test rows, and only then you split. The test score becomes optimistic. Move scaling after the split ("Scale (fit on train only)").`); bad.push(n.id); } });
    const up = id => { const out = [], st = [id]; while (st.length) { const x = st.pop(), e = inEdge(x); if (e) { out.push(nodeBy(e.from).t); st.push(e.from); } } return out; };
    nodes.filter(n => PN[n.t].out === 'fitted' && inEdge(n.id)).forEach(n => { const u = up(n.id); if (u.includes('src_churn') && !u.includes('onehot')) { issues.push(`<b>${PN[n.t].label}</b> would receive the text column <code>plan</code> ("basic", "premium"...). Models only understand numbers: add <b>One-hot encode text</b> before the split.`); bad.push(n.id); } });
    if (nodes.filter(n => n.t === 'split').length > 1) issues.push('You have more than one split; the generated code expects exactly one.');
    return { issues, bad };
  }
  function refresh() { last = validate(); if (tab === 'code') showTab(); }

  /* ---------- run ---------- */
  async function run() {
    refresh(); if (!nodes.length) { say('Add some blocks first.'); return; }
    ['houses', 'churn', 'faq'].forEach(need); const code = gen(); tab = 'out'; side.innerHTML = '<p class="muted">Running in Python...</p>'; showHeader();
    const r = await Py.run({ code, files, timeout: 60000 }); const ids = order(), outs = {};
    (r.stdout || '').split('\n').forEach(l => { const m = /^##(\d+) (.*)$/.exec(l); if (m) outs[+m[1]] = m[2]; });
    last = Object.assign(last, { out: outs, err: r.error, stdout: r.stdout }); showTab();
    let k = 0; clearInterval(playing); playing = setInterval(() => { if (k >= ids.length) { clearInterval(playing); draw(); return; } const id = ids[k], e = inEdge(id); draw(id); if (e) { const A = nodeBy(e.from), B = nodeBy(id); anim(500, t => draw(id, [lerp(A.x + NW, B.x, t), lerp(A.y + NH / 2, B.y + NH / 2, t)])); } k++; }, 650);
  }

  /* ---------- tabs ---------- */
  function showHeader() { const t = h('div', { class: 'ptabs' }, [['code', 'Generated code'], ['out', 'Run output'], ['check', 'Check & explain']].map(([k, l]) => h('button', { class: 'btn sm' + (tab === k ? ' primary' : ''), type: 'button', onclick: () => { tab = k; showTab(); } }, l))); side.prepend(t); }
  function showTab() {
    side.innerHTML = ''; side.append(msg); showHeader();
    const v = last || validate();
    if (tab === 'code') {
      side.append(h('pre', { class: 'pcode', html: hlPy(gen()) }), h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => { ['houses', 'churn', 'faq'].forEach(need); const host = h('div'); side.append(host); codeTutor(gen(), { files }).then(t => host.append(t)); } }, 'Step through this code (Code Tutor)'), h('button', { class: 'btn', type: 'button', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(gen()); toast('Code copied'); } }, 'Copy')));
      if (v.issues.length) side.append(h('div', { html: v.issues.map(x => `<div class="pmsg">${x}</div>`).join('') }));
    } else if (tab === 'out') {
      if (!last || !last.out) side.append(h('p', { class: 'muted' }, 'Press Run to push the data through your pipeline.'));
      else { order().forEach(id => { const n = nodeBy(id); side.append(h('div', { class: 'card pad', style: { padding: '8px 12px' } }, h('b', {}, PN[n.t].label), h('div', { class: 'mono', style: { fontSize: '12.5px', color: 'var(--muted)' } }, last.out[id] || '(no output)'))); }); if (last.err) side.append(h('div', { class: 'callout warn', html: '<b>Python stopped:</b> ' + esc(fmtErr(last.err)) + (/could not convert string/.test(last.err.msg || '') ? '<br><b>Why:</b> a text column reached a step that needs numbers. One-hot encode text columns first.' : '') })); if (v.issues.length) side.append(h('div', { html: v.issues.map(x => `<div class="pmsg">${x}</div>`).join('') })); }
    } else check();
  }
  function check() {
    side.append(h('div', { class: 'card pad stack' }, h('b', {}, 'Challenge'), h('select', { class: 'input', onchange: e => { scn = SCENARIOS.find(x => x.id === e.target.value); showTab(); } }, SCENARIOS.map(s => h('option', { value: s.id, selected: s.id === scn.id }, s.title))), h('div', { class: 'prose', html: '<p>' + inl(scn.desc) + '</p>' }), h('button', { class: 'btn primary', type: 'button', onclick: grade }, 'Check my system')));
  }
  function grade() {
    refresh(); const types = nodes.map(n => n.t), miss = [];
    scn.need.forEach(r => { const ok = Array.isArray(r) ? r.some(x => types.includes(x)) : types.includes(r); if (!ok) miss.push(Array.isArray(r) ? r.map(x => PN[x].label).join(' / ') : PN[r].label); });
    const pos = scn.order.map(t => nodes.find(n => n.t === t)), wired = pos.every((n, i) => !i || (pos[i - 1] && n && reaches(pos[i - 1].id, n.id)));
    const issues = last.issues, box = h('div', { class: 'stack' }); side.querySelectorAll('.gradebox').forEach(x => x.remove()); box.className += ' gradebox';
    if (miss.length) box.append(h('div', { class: 'pmsg', html: '<b>Missing blocks:</b> ' + miss.join('; ') }));
    else if (!wired) box.append(h('div', { class: 'pmsg', html: '<b>All the blocks are there, but not connected in the right order.</b> Follow the data: ' + scn.order.map(t => PN[t].label).join(' &rarr; ') }));
    if (issues.length) box.append(h('div', { class: 'pmsg', html: issues.join('<br>') }));
    if (!miss.length && wired && !issues.length) {
      box.append(h('div', { class: 'pmsg ok', html: '<b>Correct system.</b> Now prove you understand it - answer questions about YOUR diagram:' }));
      if (!S.st.pipes) S.st.pipes = {}; if (!S.st.pipes[scn.id]) { S.st.pipes[scn.id] = true; S.award(60, 'Pipeline built'); confetti(100); S.save(); }
      box.append(quizBlock(explainQs(), { tag: 'pipeline', count: 3 }));
    }
    side.append(box);
  }
  function explainQs() {
    const L = t => PN[t].label, ts = nodes.map(n => n.t), model = ts.find(t => PN[t].out === 'fitted'), rag = ts.includes('retrieve');
    if (rag) return [
      { q: 'In your pipeline, which block turns TEXT into NUMBERS so similarity can be computed?', o: [L('embed'), L('chunk'), L('generate'), L('src_faq')], a: 0, why: 'Embedding maps each chunk to a vector (here TF-IDF); retrieval compares vectors with cosine similarity.' },
      { q: 'What does the Retrieve block compare with the question?', o: ['The vectors of every chunk (cosine similarity)', 'The raw files on disk', 'Only the first document', 'The final answer'], a: 0, why: 'It scores each chunk vector against the question vector and keeps the top 3.' },
      { q: 'Why does the answer carry a [source: ...] tag?', o: ['So the reader can verify it against the retrieved document', 'To make the text longer', 'Because TF-IDF requires it', 'It is a random id'], a: 0, why: 'Citations make RAG answers checkable and reduce hallucination.' },
      { q: 'If chunks are too big, what usually goes wrong?', o: ['Each vector mixes many topics, so retrieval gets blurry', 'The answer is always perfect', 'The index becomes empty', 'Nothing'], a: 0, why: 'Chunking is a precision/recall trade-off.' },
    ];
    return [
      { q: 'Which block first touches the TEST rows in your diagram?', o: [L('metrics'), L('split').replace('Train / test split', 'Train / test split (it only sets them aside)'), L(model || 'linreg') + ' (training)', 'Clean'], a: 0, why: 'The split sets the test rows aside; only the evaluation block uses them to judge the model.' },
      { q: `What does "${L(model || 'linreg')}" learn from?`, o: ['The training rows only', 'The training and test rows', 'The test rows only', 'Only the column names'], a: 0, why: 'fit() sees X_train and y_train. Peeking at the test rows would be leakage.' },
      { q: 'If you moved scaling BEFORE the split, what would change?', o: ['The test rows would influence the scaling: leakage', 'Nothing - same result', 'The model would train faster', 'The split would fail'], a: 0, why: 'The scaler would learn the mean and spread of rows the model is supposed to never see.' },
      { q: 'You connect a regression model to a dataset whose target is 0/1 churn. What is the better choice?', o: ['A classifier (logistic regression, forest, boosting)', 'A bigger regressor', 'More columns', 'No model'], a: 0, why: 'Classification predicts classes/probabilities; regression predicts numbers.' },
    ];
  }

  /* ---------- palette + layout ---------- */
  const pal = h('div', { class: 'card pal' }); let cat = '';
  Object.entries(PN).forEach(([t, P]) => { if (P.cat !== cat) { cat = P.cat; pal.append(h('h5', {}, cat)); } pal.append(h('button', { type: 'button', onclick: () => addNode(t) }, h('i', { style: { background: PCOL(P.col) } }), P.label)); });
  const bar = h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: run }, '▶ Run pipeline'), h('button', { class: 'btn', type: 'button', onclick: () => { tab = 'code'; refresh(); showTab(); } }, 'Show code'),
    h('button', { class: 'btn', type: 'button', onclick: () => { nodes = []; edges = []; nid = 1; last = null; draw(); showTab(); say('Canvas cleared. Add blocks from the palette on the left, then drag from a right dot to a left dot to connect them.'); } }, 'Clear'),
    h('button', { class: 'btn', type: 'button', onclick: () => { selNode != null && (nodes = nodes.filter(n => n.id !== selNode), edges = edges.filter(e => e.from !== selNode && e.to !== selNode), selNode = null, draw(), refresh()); } }, 'Delete selected block'),
    h('button', { class: 'btn', type: 'button', onclick: example }, 'Load a leaky example'));
  function example() { nodes = []; edges = []; nid = 1; const a = addNode('src_churn', 10, 30), o1 = addNode('onehot', 10, 130), b = addNode('scale_leaky', 200, 130), c = addNode('split', 390, 130), d = addNode('logreg', 580, 130), e = addNode('metrics', 580, 230); [[a, o1], [o1, b], [b, c], [c, d], [d, e]].forEach(([x, y]) => edges.push({ from: x.id, to: y.id })); say('This diagram scales before splitting. Press Show code: the checker flags LEAKAGE and the red block. Replace it with "Scale (fit on train only)" after the split.'); refresh(); draw(); showTab(); }
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('h1', { html: 'Pipeline <em>Lab</em>' }), h('p', { class: 'muted', style: { maxWidth: '75ch' } }, 'Build systems from blocks instead of typing them: wire datasets, cleaning, splits, models, evaluation or a whole RAG chain. The diagram turns into real Python that you can run, step through and be quizzed on. Click a right dot, then a left dot, to connect; a wrong connection explains why it does not fit.'))));
  root.append(bar, h('div', { class: 'plab' }, pal, h('div', { class: 'stack' }, svg, side)));
  say('Pick a challenge in "Check & explain", or load the leaky example to see what the checker catches.');
  draw(); tab = 'check'; showTab(); App.dis.push(() => clearInterval(playing));
  return root;
}
DSQ.viewPipelineLab = viewPipelineLab;
