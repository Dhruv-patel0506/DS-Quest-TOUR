'use strict';
/* =====================================================================
   Game widgets: exerciseBlock (fill-the-blanks / write / debug with auto-tests),
   quizBlock (static + generated questions), typingBlock (WPM + accuracy),
   logicLab (explain the logic in words; accepted plan unlocks the code), radar chart
   ===================================================================== */
const ERR_HINT = {
  NameError: 'A name is used before it exists. Check the spelling, or create the variable first (and make sure no ___ blank is left).',
  SyntaxError: 'Python could not read this line. Look for a missing bracket, quote or colon, or a ___ blank you have not filled.',
  IndentationError: 'Lines inside a block (after a colon) must be indented by the same amount.',
  TypeError: 'A value of the wrong kind was used (for example text + number, or calling something that is not a function).',
  ValueError: 'The value has the right kind but does not fit - often array shapes that do not line up.',
  KeyError: 'That label or column name does not exist. Print df.columns (or the dict keys) to see the real names.',
  IndexError: 'You asked for a position outside the array/list. Remember positions start at 0.',
  AttributeError: 'That object has no such method or attribute. Check the spelling and what type the object really is.',
  ModuleNotFoundError: 'That library is not available in the in-browser Python.',
  ZeroDivisionError: 'You divided by zero.',
  Timeout: 'Your code ran too long. Look for a loop that never ends.',
};
const fmtErr = e => `Line ${e.line || '?'} - ${e.type}: ${e.msg}${e.src ? '\n    ' + e.src : ''}${e.where === 'earlier' ? '\n(this error is inside the code of an EARLIER step - fix that step first)' : ''}`;

function outputPane(parent) {
  const body = h('div'), el = h('div', { class: 'outpane' }, h('div', { class: 'hd2' }, h('span', {}, 'Output'), h('span', { class: 'tm' })), body);
  parent.append(el);
  return {
    el,
    clear(msg) { body.innerHTML = ''; body.append(h('pre', { class: 'muted' }, msg || 'Press Run (Ctrl+Enter) to see what your code prints.')); $('.tm', el).textContent = ''; },
    show(res, o = {}) {
      body.innerHTML = ''; $('.tm', el).textContent = res.ms ? res.ms + ' ms' : '';
      if (res.stdout) body.append(h('pre', {}, res.stdout));
      if (res.error) body.append(h('pre', { class: 'err' }, fmtErr(res.error)), h('pre', { style: { color: '#9aa7b8' } }, ERR_HINT[res.error.type] || ''));
      if (!res.stdout && !res.error && !(res.figs && res.figs.length)) body.append(h('pre', { class: 'muted' }, '(no printed output - use print(...) to look at a value)'));
      if (res.figs && res.figs.length) body.append(h('div', { class: 'figs' }, res.figs.map(b => h('img', { src: 'data:image/png;base64,' + b, alt: 'plot produced by your code' }))));
      if (res.checks && res.checks.length && o.checks !== false) body.append(h('div', { class: 'checks' }, res.checks.map(k => h('div', { class: k.ok ? 'p' : 'x' }, h('b', {}, k.ok ? '✓' : '✗'), h('span', {}, k.msg, k.hint ? h('small', {}, k.hint) : null)))));
    },
  };
}

/* ---------------------------------------------------------------------
   exerciseBlock(ex, {prelude, files, onPass, compact})
   ex: {id,title,prompt,starter,solution,tests,bank[],hints[],files,est,xp,live,logic}
   --------------------------------------------------------------------- */
function exerciseBlock(ex, o = {}) {
  const S = DSQ.S, st = S.st; st.code = st.code || {};
  const root = h('div', { class: 'exwrap' }), left = h('div', { class: 'stack' }), right = h('div', { class: 'stack' });
  root.append(left, right);
  const t0 = Date.now(); let fails = 0, hintsUsed = 0, solved = o.practice ? false : S.exDone(ex.id), unlocked = false, busy = false, dirty = false;
  const head = h('div', { class: 'xhead' }, h('span', { class: 'chip brand' }, ex.kind === 'debug' ? 'Fix the bug' : ex.starter && /\b___\b/.test(ex.starter) ? 'Fill the blanks' : 'Write it'), h('span', { class: 'chip' }, '+' + (ex.xp || 15) + ' pts'), solved ? h('span', { class: 'chip ok' }, 'Solved ✓') : null);
  left.append(head, h('div', { class: 'prose', html: ex.prompt }));
  const hintBox = h('div', { class: 'hints' });
  if (ex.bank && ex.bank.length) {
    const bank = h('div', { class: 'bank' }, ex.bank.map(w => h('button', { type: 'button', title: 'Click to drop into the next blank', onclick: () => ed.insert(w) }, w)));
    left.append(h('div', {}, h('div', { class: 'muted mono', style: { fontSize: '12px', marginBottom: '6px', fontWeight: 700 } }, 'FUNCTION BANK - click to fill the next blank (some are decoys)'), bank));
  }
  const hintBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { if (!(ex.hints || []).length) return; if (hintsUsed >= ex.hints.length) return; hintBox.append(h('div', { class: 'hint-b', html: '<b>Hint ' + (hintsUsed + 1) + ':</b> ' + inl(ex.hints[hintsUsed]) })); hintsUsed++; if (hintsUsed >= ex.hints.length) hintBtn.disabled = true; } }, 'Need a hint?');
  if ((ex.hints || []).length) left.append(h('div', { class: 'row' }, hintBtn, h('span', { class: 'muted', style: { fontSize: '13px' } }, 'Hints lower the pts a little.')), hintBox);

  const saved = o.practice ? null : st.code[ex.id];
  const ed = Editor(right, { code: saved && !/\b___\b/.test(ex.starter || '') ? saved : (saved || ex.starter || ''), minLines: ex.lines || 8, onRun: () => run(false), onChange: () => { dirty = true; if (!o.practice) { st.code[ex.id] = ed.get().slice(0, 8000); clearTimeout(o._dtm); o._dtm = setTimeout(() => S.save(), 2500); } if (live.checked) schedule(); } });
  const btns = h('div', { class: 'row' });
  const runBtn = h('button', { class: 'btn', type: 'button', onclick: () => run(false) }, '▶ Run'), chkBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => run(true) }, '✓ Check my answer'),
    resetBtn = h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { ed.set(ex.starter || ''); outp.clear(); } }, 'Reset');
  const live = h('input', { type: 'checkbox' }); live.checked = !!ex.live;
  const liveL = ex.live !== undefined || ex.livePlot ? h('label', { class: 'sw', title: 'Re-run automatically when you pause typing - the plot redraws as you code' }, live, 'Live sketch') : null;
  btns.append(runBtn, chkBtn, resetBtn, liveL || '');
  right.append(btns);
  const outp = outputPane(right); outp.clear();
  attachTutor(right, () => ed.get(), { files: () => Object.assign({}, o.files || {}, ex.files || {}), prelude: () => (typeof o.prelude === 'function' ? o.prelude() : (o.prelude || '')) });
  const solBox = h('div');
  right.append(solBox);
  let tm; const schedule = () => { clearTimeout(tm); tm = setTimeout(() => run(false), 800); };

  async function run(check) {
    if (busy) { dirty = true; return; } busy = true; dirty = false;
    const code = ed.get();
    if (check && /\b___\b/.test(code)) { busy = false; outp.show({ stdout: '', error: null, figs: [], checks: [{ ok: false, msg: 'There are still ___ blanks. Fill every blank, then press Check.', hint: 'Click a word in the function bank, or type the answer.' }] }); return; }
    runBtn.disabled = chkBtn.disabled = true; outp.clear('Running...'); $('.tm', outp.el).textContent = Py.state === 'ready' ? '' : 'starting Python...';
    const prelude = typeof o.prelude === 'function' ? o.prelude() : (o.prelude || '');
    const res = await Py.run({ code, tests: check ? ex.tests : '', files: Object.assign({}, o.files || {}, ex.files || {}), prelude, timeout: ex.timeout || 30000 });
    runBtn.disabled = chkBtn.disabled = false; busy = false;
    if (!o.practice) st.code[ex.id] = code.slice(0, 8000);
    outp.show(res, { checks: check });
    if (!check) { S.log({ type: 'run', ex: ex.id, err: !!res.error }); S.save(); if (dirty && live.checked) schedule(); return; }
    const allOk = !res.error && res.checks.length > 0 && res.checks.every(k => k.ok);
    const rec = o.practice ? (o._rec = o._rec || { pass: false, tries: 0, hints: 0 }) : (st.ex[ex.id] || (st.ex[ex.id] = { pass: false, tries: 0, hints: 0 }));
    rec.tries++; rec.hints = Math.max(rec.hints, hintsUsed);
    if (allOk) {
      fails = 0;
      if (!rec.pass) {
        rec.pass = true; rec.ms = Date.now() - t0; rec.est = ex.est || 150; rec.at = Date.now();
        const base = ex.xp || 15, mult = (rec.tries === 1 ? 1 : rec.tries === 2 ? .8 : .6) * (hintsUsed ? Math.max(.6, 1 - .15 * hintsUsed) : 1) * (unlocked ? .4 : 1);
        S.log({ type: 'ex', id: ex.id, tries: rec.tries, hints: hintsUsed, ms: rec.ms });
        S.award(Math.max(3, Math.round(base * mult)), rec.tries === 1 && !hintsUsed ? 'Correct first time' : 'Solved'); confetti(70);
      } else toast('Still correct. Already counted.');
      head.append(h('span', { class: 'chip ok' }, 'Solved ✓')); solved = true; S.save();
      o.onPass && o.onPass(code);
    } else {
      fails++; S.save();
      if (fails >= 3 && ex.solution && !unlocked) solBox.append(h('button', { class: 'btn sm', type: 'button', onclick: e => { unlocked = true; e.target.remove(); solBox.append(h('div', { class: 'callout warn', html: '<b>Worked solution</b> (pts for this one is reduced)' }), codeBlock(ex.solution)); } }, 'Stuck? Show a worked solution'));
    }
  }
  /* optional "explain your logic" gate */
  if (ex.logic) {
    const gate = logicLab(ex.logic, code => { ed.set(code); toast('Plan accepted - code written for you. Press Run!', 'lv'); S.badge('logic'); });
    left.append(gate);
  }
  return root;
}
DSQ.exerciseBlock = exerciseBlock;

/* ---------------------------------------------------------------------
   logicLab(spec, onAccept)
   spec: {task, minWords, rubric:[{id,label,any:[regex source,...],code,hint}] , ordered?:bool}
   The learner writes the plan in words. Each rubric idea is matched against the text;
   when every idea is present the code for those ideas is assembled and handed to onAccept.
   If the admin connected a local model (/api/judge), it may also accept a correct plan the patterns missed.
   --------------------------------------------------------------------- */
function logicLab(spec, onAccept) {
  const S = DSQ.S, root = h('div', { class: 'card pad logic stack' });
  const ta = h('textarea', { placeholder: spec.placeholder || 'Write your plan in plain English: first..., then..., finally... (no code needed)' });
  const slots = h('div', { class: 'slots' }, spec.rubric.map(r => h('span', { class: 'slot', 'data-id': r.id }, r.label)));
  const fb = h('div', { class: 'prose' });
  const btn = h('button', { class: 'btn primary', type: 'button' }, 'Check my logic');
  root.append(h('div', { class: 'row' }, h('b', {}, 'Logic Lab'), h('span', { class: 'chip brand' }, 'tell me the plan, I write the code')),
    h('div', { class: 'prose', html: inl(spec.task) }), ta, slots, h('div', { class: 'row' }, btn, h('span', { class: 'muted', style: { fontSize: '13px' } }, 'The ideas below light up as you cover them. Missing ideas get a nudge, never the answer.')), fb);
  const norm = s => s.toLowerCase().replace(/[^a-z0-9_.\[\]()<>=!%*/+\-\s']/g, ' ').replace(/\s+/g, ' ');
  btn.addEventListener('click', async () => {
    const txt = norm(ta.value), words = txt.split(' ').filter(Boolean).length;
    if (words < (spec.minWords || 8)) { fb.innerHTML = '<div class="callout warn">Write a little more - describe each step of your plan (at least ' + (spec.minWords || 8) + ' words).</div>'; return; }
    const hits = spec.rubric.map(r => r.any.some(p => new RegExp(p, 'i').test(txt)));
    spec.rubric.forEach((r, i) => $('.slot[data-id="' + r.id + '"]', root).classList.toggle('hit', hits[i]));
    let ok = hits.every(Boolean), via = 'rubric';
    if (spec.ordered && ok) {   // ideas must appear in the intended order
      const pos = spec.rubric.map(r => Math.min(...r.any.map(p => { const m = new RegExp(p, 'i').exec(txt); return m ? m.index : 1e9; })));
      if (pos.some((p, i) => i && p < pos[i - 1] - 40)) { ok = false; fb.innerHTML = '<div class="callout warn">All the ideas are there, but the <b>order</b> is off. Think about what must happen first.</div>'; return; }
    }
    if (!ok && S.judge) {
      btn.disabled = true; btn.textContent = 'Asking the local model...';
      try { const j = await API.post('/api/judge', { task: spec.task, logic: ta.value, rubric: spec.rubric.map(r => r.label) }); if (j.available && j.accepted) { ok = true; via = 'local model'; } } catch (e) { }
      btn.disabled = false; btn.textContent = 'Check my logic';
    }
    if (ok) {
      const code = spec.rubric.map(r => r.code).filter(Boolean).join('\n');
      fb.innerHTML = `<div class="callout ok"><b>Logic accepted</b> (${via}). You described every step. Here is your plan as code - read it, then run it:</div>`; fb.append(codeBlock(code));
      S.award(spec.xp || 20, 'Logic accepted'); onAccept && onAccept(code);
    } else {
      const miss = spec.rubric.filter((r, i) => !hits[i]);
      fb.innerHTML = `<div class="callout warn"><b>Not quite yet.</b> ${hits.filter(Boolean).length} of ${spec.rubric.length} ideas found.<ul>${miss.slice(0, 2).map(r => `<li>${inl(r.hint)}</li>`).join('')}</ul></div>`;
      S.log({ type: 'logic-miss', n: miss.length });
    }
  });
  return root;
}
DSQ.logicLab = logicLab;

/* ---------------------------------------------------------------------
   quizBlock(items, {tag, count, boss, onDone})
   item: {q, o:[options], a:index, why}  or  {gen: r => ({q, correct, wrong:[], why})}
   --------------------------------------------------------------------- */
function quizBlock(items, o = {}) {
  const S = DSQ.S, root = h('div', { class: 'stack' }), r = RNG((Date.now() ^ hash32(o.tag || 'q')) >>> 0);
  let pool = r.shuffle(items).slice(0, o.count || items.length), i = 0, right = 0;
  const mk = it => {
    if (!it.gen) { const ans = it.o[it.a], opts = r.shuffle(it.o); return { q: it.q, opts, a: opts.indexOf(ans), why: it.why }; }
    for (let k = 0; k < 8; k++) { const g = it.gen(RNG(r.int(1, 1e9))); if (!g) continue; const wrong = [...new Set(g.wrong.map(String))].filter(w => w !== String(g.correct)); if (wrong.length < 2) continue; const opts = r.shuffle([String(g.correct), ...r.shuffle(wrong).slice(0, 3)]); return { q: g.q, opts, a: opts.indexOf(String(g.correct)), why: g.why }; }
    return null;
  };
  pool = pool.map(mk).filter(Boolean);
  function show() {
    root.innerHTML = '';
    if (i >= pool.length) { done(); return; }
    const q = pool[i], card = h('div', { class: 'card qcard' });
    card.append(h('div', { class: 'row' }, h('span', { class: 'chip' }, 'Question ' + (i + 1) + ' of ' + pool.length), o.boss ? h('span', { class: 'chip warn' }, 'Module assessment') : null), h('div', { class: 'qt', html: inl(q.q).replace(/\n/g, '<br>') }));
    const opts = h('div', { class: 'opts' }), why = h('div'); let answered = false;
    q.opts.forEach((t, k) => opts.append(h('button', { class: 'opt', type: 'button', onclick: e => {
      if (answered) return; answered = true; const good = k === q.a;
      $$('.opt', opts).forEach((b, j) => { b.disabled = true; if (j === q.a) b.classList.add('ok'); else if (j === k) b.classList.add('bad'); });
      const tq = S.st.quiz[o.tag || 'misc'] || (S.st.quiz[o.tag || 'misc'] = [0, 0]); tq[0]++; if (good) { tq[1]++; right++; S.award(o.boss ? 3 : 4, 'Correct'); } S.log({ type: 'quiz', tag: o.tag, ok: good });
      why.append(h('div', { class: 'why', html: (good ? '<b style="color:var(--ok)">Yes.</b> ' : '<b style="color:var(--bad)">Not this time.</b> ') + inl(q.why || '') }), h('button', { class: 'btn primary', type: 'button', onclick: () => { i++; show(); } }, i + 1 < pool.length ? 'Next question' : 'See my score'));
    } }, h('i', {}, 'ABCD'[k]), h('span', { html: inl(t) }))));
    card.append(opts, why); root.append(card);
  }
  function done() {
    const pct = pool.length ? right / pool.length : 0, pass = pct >= (o.pass || .7);
    if (o.boss) {
      const b = S.st.boss[o.tag] || { best: 0, n: 0 }; b.n++; if (pct > b.best) b.best = pct; S.st.boss[o.tag] = b;
      if (pass && !b.paid) { b.paid = true; S.award(40, 'Assessment passed'); confetti(160); } if (pct === 1) S.badge('quiz-perfect');
      if (pass) { b.need = false; } else { b.need = true; b.rev = {}; }
    }
    S.save();
    root.append(h('div', { class: 'card pad stack' }, h('h3', {}, pass ? 'Nice work' : 'Keep practising'), h('p', {}, `You got ${right} of ${pool.length} (${Math.round(pct * 100)}%).` + (o.boss ? (pass ? ' Assessment passed - the module project is unlocked.' : ` You need 70% to unlock the project and the next module. Attempt ${(S.st.boss[o.tag] || {}).n} of 5 used - re-do the lessons, then the questions change each time.`) : '')),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { if (o.boss && !pass && o.onDone) { o.onDone(pct, pass); return; } i = 0; right = 0; pool = r.shuffle(items).slice(0, o.count || items.length).map(mk).filter(Boolean); show(); } }, 'Try again with new questions'), o.onDone ? h('button', { class: 'btn', type: 'button', onclick: () => o.onDone(pct, pass) }, 'Continue') : null)));
    o.onDone && o.autoDone && o.onDone(pct, pass);
  }
  show(); return root;
}
DSQ.quizBlock = quizBlock;

/* ---------------------------------------------------------------------
   typingBlock(snip) - type real code, measure speed + accuracy
   --------------------------------------------------------------------- */
function typingBlock(snip, o = {}) {
  const S = DSQ.S, target = snip.code.replace(/\t/g, '    ').replace(/\s+$/, '');
  const view = h('div', { class: 'tgt' }), ta = h('textarea', { spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Type the code shown' });
  view.append(ta);
  const stats = h('div', { class: 'tstats' }), root = h('div', { class: 'typing' });
  let t0 = 0, keys = 0, errs = 0, finished = false, prevLen = 0;
  const box = (k, label) => { const b = h('b', {}, '-'); stats.append(h('div', { class: 'tstat', 'data-k': k }, b, h('small', {}, label))); return b; };
  const bW = box('w', 'WPM'), bA = box('a', 'accuracy'), bT = box('t', 'seconds');
  root.append(h('div', { class: 'row' }, h('b', {}, snip.title || 'Typing sprint'), h('span', { class: 'chip' }, target.length + ' characters'), snip.goal ? h('span', { class: 'chip brand' }, 'goal ' + snip.goal + ' WPM') : null), view, stats);
  const msg = h('div', { class: 'prose' }); root.append(msg);
  function paint() {
    const v = ta.value; view.querySelectorAll('span').forEach(s => s.remove());
    let html = '';
    for (let i = 0; i < target.length; i++) {
      const ch = target[i] === '\n' ? '↵\n' : esc(target[i]); let cls = '';
      if (i < v.length) cls = v[i] === target[i] ? 'ok' : 'bad'; else if (i === v.length) cls = 'cur';
      html += `<span class="${cls}">${ch === ' ' ? '&nbsp;' : ch}</span>`;
    }
    view.insertAdjacentHTML('afterbegin', html);
    if (t0) { const sec = (Date.now() - t0) / 1000; bT.textContent = sec.toFixed(0); const good = [...v].filter((c, i) => c === target[i]).length; bW.textContent = sec > 1 ? Math.round((good / 5) / (sec / 60)) : '-'; bA.textContent = keys ? Math.round(100 * (1 - errs / keys)) + '%' : '-'; }
  }
  ta.addEventListener('keydown', e => {
    if (finished) return;
    if (e.key === 'Enter') { e.preventDefault(); let v = ta.value; if (target[v.length] === '\n') { v += '\n'; while (target[v.length] === ' ') v += ' '; ta.value = v; keys++; ta.dispatchEvent(new Event('input')); } else { errs++; keys++; } }
    if (e.key === 'Tab') e.preventDefault();
  });
  ta.addEventListener('input', () => {
    if (finished) return; if (!t0) t0 = Date.now();
    let v = ta.value; if (v.length > target.length) v = ta.value = v.slice(0, target.length);
    if (v.length > prevLen) { keys += v.length - prevLen; for (let i = prevLen; i < v.length; i++) if (v[i] !== target[i]) errs++; }
    prevLen = v.length; paint();
    if (v.length === target.length) finish();
  });
  function finish() {
    finished = true; const sec = Math.max(1, (Date.now() - t0) / 1000), v = ta.value, good = [...v].filter((c, i) => c === target[i]).length;
    const wpm = Math.round((good / 5) / (sec / 60)), acc = Math.round(100 * (1 - errs / Math.max(keys, 1)));
    bW.textContent = wpm; bA.textContent = acc + '%'; bT.textContent = sec.toFixed(0);
    if (wpm > 250) { msg.innerHTML = '<div class="callout warn"><b>That is faster than any human can type</b> (' + wpm + ' WPM), so it was not recorded. Type it by hand to earn pts.</div>'; return; }
    S.st.typing.push({ t: Date.now(), wpm, acc, len: target.length, id: snip.id }); if (S.st.typing.length > 120) S.st.typing.shift();
    const prev = (S.st.seenTyping = S.st.seenTyping || {})[snip.id] || 0; S.st.seenTyping[snip.id] = Math.max(prev, wpm);
    const xp = prev === 0 ? 10 + Math.round(wpm / 4) + (acc >= 95 ? 5 : 0) : wpm > prev ? 6 : 2;
    if (wpm >= 30 && acc >= 90) S.badge('wpm30'); if (wpm >= 50 && acc >= 92) S.badge('wpm50');
    msg.innerHTML = `<div class="callout ok"><b>${wpm} WPM at ${acc}% accuracy.</b> ${acc < 90 ? 'Slow down a little: accuracy first, speed follows.' : wpm < 25 ? 'Good start. Repeat the sprint tomorrow - speed builds with practice.' : 'Strong typing. Try the next sprint.'}${prev && wpm > prev ? ' <b>New personal best for this snippet!</b>' : ''}</div>`;
    S.log({ type: 'typing', wpm, acc }); S.award(xp, 'Typing sprint'); o.onDone && o.onDone(wpm, acc);
    msg.append(h('button', { class: 'btn', type: 'button', onclick: () => { ta.value = ''; prevLen = 0; t0 = 0; keys = 0; errs = 0; finished = false; msg.innerHTML = ''; paint(); ta.focus(); } }, 'Go again'));
  }
  ta.addEventListener('paste', e => { e.preventDefault(); toast('Pasting is off in typing sprints - type it!'); });
  view.addEventListener('click', () => ta.focus()); paint();
  return root;
}
DSQ.typingBlock = typingBlock;

/* ---------------------------------------------------------------------
   charts for the profile: radar + sparkline
   --------------------------------------------------------------------- */
function radarSVG(vals) {
  const keys = Object.keys(vals).filter(k => !k.startsWith('_')), W = 340, Hh = 300, cx = W / 2, cy = Hh / 2 + 6, R = 100, n = keys.length;
  const P = (i, f) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + R * f * Math.cos(a), cy + R * f * Math.sin(a)]; };
  let s = svgOpen(W, Hh);
  [.25, .5, .75, 1].forEach(f => { s += `<polygon points="${keys.map((_, i) => P(i, f).join(',')).join(' ')}" fill="none" stroke="var(--line)"/>`; });
  keys.forEach((k, i) => { const [x, y] = P(i, 1), [lx, ly] = P(i, 1.2); s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)"/><text x="${lx}" y="${ly + 4}" text-anchor="middle" font-size="12" font-weight="700">${k}</text><text x="${lx}" y="${ly + 17}" text-anchor="middle" class="m" font-size="11">${vals[k]}</text>`; });
  s += `<polygon points="${keys.map((k, i) => P(i, clamp(vals[k] / 100, .03, 1)).join(',')).join(' ')}" fill="var(--c0)" fill-opacity=".25" stroke="var(--c0)" stroke-width="2.5" stroke-linejoin="round"/>`;
  keys.forEach((k, i) => { const [x, y] = P(i, clamp(vals[k] / 100, .03, 1)); s += `<circle cx="${x}" cy="${y}" r="4" fill="var(--c0)"/>`; });
  return s + '</svg>';
}
function sparkSVG(vals, w = 300, hh = 70, color = 'var(--c0)') {
  if (vals.length < 2) return `<div class="muted" style="font-size:13px">Not enough data yet.</div>`;
  const mx = Math.max(...vals), mn = Math.min(...vals), X = i => 8 + i * (w - 16) / (vals.length - 1), Y = v => hh - 10 - (mx === mn ? .5 : (v - mn) / (mx - mn)) * (hh - 24);
  return `<svg viewBox="0 0 ${w} ${hh}"><path d="M${vals.map((v, i) => X(i) + ' ' + Y(v)).join('L')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>${vals.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="${color}"/>`).join('')}</svg>`;
}
