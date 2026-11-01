'use strict';
/* =====================================================================
   Unlimited practice: every solved-style exercise becomes a fresh fill-in-the-blank question each time.
   A different set of words/numbers/operators in the reference solution is blanked out, with a shuffled word bank
   (right answers + decoys). The same tests judge it, the logic behind it stays the same, and a blank set you have
   already seen is not served again. Answers feed a "mastery" score that, with the module assessment, opens the next module.
   ===================================================================== */
const PRAC_KW = new Set(['False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield', 'print', 'self']);
const PRAC = {
  METHODS: ['mean', 'median', 'sum', 'max', 'min', 'std', 'var', 'count', 'sort_values', 'groupby', 'head', 'tail', 'reshape', 'astype', 'fillna', 'dropna', 'isna', 'drop_duplicates', 'apply', 'copy', 'cumsum', 'unique', 'value_counts', 'merge', 'argmax', 'argmin', 'plot', 'hist', 'scatter', 'bar', 'legend', 'append', 'keys', 'values', 'items', 'strip', 'lower', 'upper', 'split', 'join'],
  FUNCS: ['len', 'sum', 'max', 'min', 'sorted', 'round', 'abs', 'int', 'float', 'str', 'list', 'zip', 'enumerate', 'range', 'sqrt', 'array', 'where', 'arange', 'linspace', 'zeros', 'ones'],
  ATTRS: ['shape', 'T', 'values', 'columns', 'index', 'dtype', 'size', 'ndim', 'loc', 'iloc', 'str', 'dt', 'pi'],
  OPS: ['>', '<', '>=', '<=', '==', '!=', '&', '|', '@'],
  STRS: ['"a"', '"x"', '"y"', '"name"', '"mean"', '"index"', '"count"'],
  tokens(src) {
    const re = /#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|[rRbBfFuU]{0,2}"(?:\\.|[^"\\\n])*"|[rRbBfFuU]{0,2}'(?:\\.|[^'\\\n])*'|\d+\.?\d*(?:[eE][-+]?\d+)?|[A-Za-z_]\w*|>=|<=|==|!=|[<>&|@]|\S/g, out = []; let m;
    while ((m = re.exec(src))) out.push({ s: m[0], i: m.index, e: m.index + m[0].length }); return out;
  },
  candidates(src) {
    const T = PRAC.tokens(src), out = [], lineOf = i => { const a = src.lastIndexOf('\n', i - 1) + 1, b = src.indexOf('\n', i); return src.slice(a, b < 0 ? src.length : b); };
    const stack = [];   /* c = call, s = subscript, l = list literal, d = dict/set literal: numbers inside data literals are not guessable, so they are never blanked */
    T.forEach((t, k) => {
      const prev = T[k - 1], next = T[k + 1], line = lineOf(t.i);
      if (t.s === '(') stack.push('c'); else if (t.s === '[') stack.push(prev && ((/^[A-Za-z_]/.test(prev.s) && !PRAC_KW.has(prev.s)) || prev.s === ')' || prev.s === ']') ? 's' : 'l'); else if (t.s === '{') stack.push('d'); else if (t.s === ')' || t.s === ']' || t.s === '}') stack.pop(); if (/^\s*(import|from)\b/.test(line) || /^\s*def\b/.test(line) && prev && prev.s === 'def') return;
      let kind = null;
      if (t.s[0] === '#' || /^("""|''')/.test(t.s)) return;
      if (/^[rRbBuU]{0,2}['"]/.test(t.s)) { if (stack.includes('d')) return; if (t.s.length <= 26 && !/^\s*(print|assert)\b/.test(line) || t.s.length <= 14) kind = 'str'; }
      else if (/^\d/.test(t.s)) { if (!stack.includes('l') && !stack.includes('d')) kind = 'num'; }
      else if (/^[A-Za-z_]/.test(t.s)) { if (PRAC_KW.has(t.s)) return; if (prev && prev.s === '.') kind = next && next.s === '(' ? 'method' : 'attr'; else if (next && next.s === '(' && !(prev && (prev.s === 'def' || prev.s === 'class'))) kind = 'func'; }
      else if (PRAC.OPS.includes(t.s)) { if (t.s === '@' && /^\s*@/.test(line)) return; if (t.s === '>' && prev && prev.s === '-') return; kind = 'op'; }
      if (kind) out.push({ s: t.s, i: t.i, e: t.e, kind });
    });
    return out;
  },
  /* one question from an exercise; `seen` is the list of blank sets already served for it */
  make(ex, rng, seen) {
    const src = ex.solution || '', C = PRAC.candidates(src); if (C.length < 3) return null;
    let pick = null, key = '';
    for (let tries = 0; tries < 30; tries++) {
      const k = clamp(Math.round(C.length * (.22 + rng() * .18)), 2, 7), pool = rng.shuffle(C.slice()), chosen = [];
      for (const c of pool) { if (chosen.length >= k) break; if (chosen.filter(x => x.kind === c.kind).length >= Math.ceil(k * .6)) continue; chosen.push(c); }
      chosen.sort((a, b) => a.i - b.i); key = chosen.map(c => c.i).join(',');
      if (!seen.includes(key) || tries === 29) { pick = chosen; break; }
    }
    let starter = src; for (let j = pick.length - 1; j >= 0; j--) starter = starter.slice(0, pick[j].i) + '___' + starter.slice(pick[j].e);
    const answers = pick.map(c => c.s), kinds = [...new Set(pick.map(c => c.kind))], dec = [];
    const pools = { method: PRAC.METHODS.concat(C.filter(c => c.kind === 'method').map(c => c.s)), func: PRAC.FUNCS.concat(C.filter(c => c.kind === 'func').map(c => c.s)), attr: PRAC.ATTRS.concat(C.filter(c => c.kind === 'attr').map(c => c.s)), op: PRAC.OPS, str: PRAC.STRS.concat(C.filter(c => c.kind === 'str').map(c => c.s)), num: [] };
    kinds.forEach(kd => { const base = kd === 'num' ? answers.filter((a, i) => pick[i].kind === 'num').flatMap(a => [String(+a + 1), String(+a * 2), String(Math.max(0, +a - 1))]).concat(['0', '10']) : pools[kd]; rng.shuffle(base.slice()).filter(x => !answers.includes(x) && !dec.includes(x)).slice(0, 2).forEach(x => dec.push(x)); });
    const bank = rng.shuffle(answers.concat(dec.slice(0, Math.max(2, Math.min(4, answers.length)))).filter((x, i, a) => a.indexOf(x) === i));
    return { key, ex: { id: 'practice:' + ex.id, title: ex.title, prompt: ex.prompt + '<div class="callout"><b>Practice version.</b> Some words, numbers or operators of a correct solution are hidden (___). Use the bank (it has decoys), run it, then check.</div>', starter, solution: src, tests: ex.tests, bank, hints: ex.hints || [], est: ex.est || 150, xp: 6, lines: ex.lines } };
  },
};
DSQ.practice = PRAC;

/* ---------- mastery ---------- */
const practiceStats = mid => { const a = ((S.st.pract || {})[mid] || []).slice(-15); return { n: a.length, rate: a.length ? a.filter(x => x.ok).length / a.length : null, total: ((S.st.pract || {})[mid] || []).length }; };
const masteryOf = m => { const b = (S.st.boss[m.id] || { best: 0, n: 0 }), p = practiceStats(m.id); return { boss: b.best, tries: b.n, prac: p.rate, pn: p.n, score: p.n >= 5 ? (b.best + p.rate) / 2 : b.best }; };
function recordPractice(mid, exId, ok) { const st = S.st; st.pract = st.pract || {}; const a = st.pract[mid] = st.pract[mid] || []; a.push({ ok: ok ? 1 : 0, ex: exId, t: Date.now() }); if (a.length > 60) a.splice(0, a.length - 60); S.save(); }

function viewPractice(mid) {
  const root = h('div', { class: 'stack' });
  if (!mid) {
    root.append(h('div', { class: 'page-h' }, h('div', {}, h('h1', { html: 'Unlimited <em>practice</em>' }), h('p', { class: 'muted', style: { maxWidth: '75ch' } }, 'Fresh fill-in-the-blank questions made from what you have already learned. Every question hides different words, the word bank is shuffled and has decoys, and you never get the same blank set twice. Your recent answers become your mastery score.'))));
    root.append(h('div', { class: 'mods' }, App.mods.filter(m => m.live && JUP.modules().includes(m)).map(m => { const ms = masteryOf(m); return h('a', { class: 'card mod', href: '#/practice/' + m.id }, h('span', { class: 'ic', style: { background: colv(m.color) } }, m.icon), h('h4', {}, m.title), h('p', {}, ms.prac == null ? 'No practice yet' : `Practice ${Math.round(ms.prac * 100)}% over the last ${ms.pn}`), h('span', { class: 'badge chip ' + (ms.score >= .7 ? 'ok' : 'brand') }, 'mastery ' + Math.round(ms.score * 100) + '%')); })));
    return root;
  }
  const m = modById(mid); if (!m) return h('div', { class: 'card pad' }, 'Unknown module.');
  { const g = gate(m); if (!g.open) return lockCard(g, m); }
  const st = S.st; st.pseen = st.pseen || {}; st.pract = st.pract || {};
  const learned = m.lessons.filter(l => S.lessonDone(m.id + '/' + l.id) || (st.seen && st.seen[m.id + '/' + l.id] >= l.pages.length - 1));
  const exs = []; learned.forEach(l => l.pages.forEach(p => { if (p.t === 'ex' && p.ex.solution && !(p.ex.files && Object.keys(p.ex.files).length) && PRAC.candidates(p.ex.solution).length >= 3) exs.push(p.ex); }));
  const meter = h('div', { class: 'row', style: { flexWrap: 'wrap' } }), box = h('div'); let seq = 0, cur = null, answered = false;
  const paint = () => { const ms = masteryOf(m); meter.innerHTML = ''; meter.append(h('span', { class: 'chip ' + (ms.score >= .7 ? 'ok' : 'warn') }, 'Mastery ' + Math.round(ms.score * 100) + '% (unlocks the next module at 70%)'), h('span', { class: 'chip' }, 'module assessment ' + Math.round(ms.boss * 100) + '%'), h('span', { class: 'chip' }, ms.prac == null ? 'practice: answer 5 to count it' : 'practice ' + Math.round(ms.prac * 100) + '% (last ' + ms.pn + ')')); };
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('a', { href: '#/m/' + m.id, class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← ' + m.title), h('h1', { style: { marginTop: '6px' }, html: 'Practice: <em>' + esc(m.title) + '</em>' }), h('p', { class: 'muted' }, 'Questions come only from the lessons you have finished (' + learned.length + ' of ' + m.lessons.length + ').'))), meter, box);
  if (!exs.length) { box.append(h('div', { class: 'card pad stack' }, h('h3', {}, 'Finish a lesson first'), h('p', {}, 'Practice only asks about what you have been taught. Complete a lesson of this module, then come back.'), h('a', { class: 'btn primary', href: '#/m/' + m.id }, 'Go to the lessons'))); return root; }
  function next() {
    if (cur && !answered) recordPractice(m.id, cur.exId, false);
    paint(); box.innerHTML = ''; answered = false; seq++;
    const rng = RNG((Date.now() ^ (seq * 2654435761)) >>> 0), hist = (S.st.pract[m.id] || []).slice(-8).map(x => x.ex);
    const w = exs.map(e => { const a = (S.st.pract[m.id] || []).filter(x => x.ex === e.id); return (hist.includes(e.id) ? .15 : 1) * (a.length ? 1 + (1 - a.filter(x => x.ok).length / a.length) : 1.4); });
    let tot = w.reduce((s, x) => s + x, 0), r = rng() * tot, ex = exs[0]; for (let i = 0; i < exs.length; i++) { r -= w[i]; if (r <= 0) { ex = exs[i]; break; } }
    const seen = st.pseen[ex.id] = st.pseen[ex.id] || [], q = PRAC.make(ex, rng, seen); if (!q) { next(); return; }
    seen.push(q.key); if (seen.length > 40) seen.shift(); cur = { exId: ex.id };
    box.append(h('div', { class: 'row', style: { margin: '6px 0' } }, h('span', { class: 'chip' }, 'Question ' + seq), h('span', { class: 'chip' }, 'from: ' + ex.title), h('span', { class: 'grow' }), h('button', { class: 'btn sm', type: 'button', onclick: next }, 'Skip / new question ▸')));
    box.append(exerciseBlock(q.ex, { practice: true, onPass: () => { if (!answered) { answered = true; recordPractice(m.id, ex.id, true); paint(); box.append(h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn primary', type: 'button', onclick: next }, 'Next question ▸'))); } } }));
  }
  next(); App.dis.push(() => { if (cur && !answered) recordPractice(m.id, cur.exId, false); }); return root;
}
