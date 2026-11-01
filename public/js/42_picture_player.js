'use strict';
/* =====================================================================
   The Picture Classes player and the course map.
   COURSES: the four curricula (Data science and AI, Data analytics for business, Content and freelancing, Engineering and deployment) each have the modules of the
   normal curriculum, and each module lists the lessons of that module. A Picture Class is attached to the lesson(s) it teaches (PIC.place, or mod / les on the lesson).
   PLAYER: every lesson can be watched three ways, always interactive: 2D (flat, hover / sliders / buttons), 3D (a real 3D object in the lesson) and Overlay (a floating 3D window).
   ===================================================================== */
PIC.place = {
  'py-first': ['python', [2, 3, 4, 5]], 'auto-files': ['python', [5, 7]], 'np-register': ['numpy', [0, 2, 3, 6]], 'la-car': ['linalg', [0]], 'plot-draw': ['matplotlib', [0]],
  'sql-tables': ['sql', [0, 1, 2]], 'stats-see': ['stats', [2]], 'ml-overfit': ['mlcore', [0]], 'ml-line': ['mlcore', [1]], 'ml-tree': ['mlcore', [3]], 'ml-kmeans': ['mlcore', [4]],
  'nn-full': ['nn', [0, 1]], 'llm-flow': ['nlp', [3]], 'rag-library': ['rag', [0, 1]], 'cnn-conv': ['cnn', [0]], 'torch-loop': ['pytorch', [2]], 'auto-report': ['pipelines', [0]],
  'pandas-1': ['pandas', [0, 1]], 'pandas-2': ['pandas', [2, 3, 4, 5]],
};
PIC.modOf = l => (PIC.place[l.id] ? PIC.place[l.id][0] : l.mod);
PIC.lesOf = l => (PIC.place[l.id] ? PIC.place[l.id][1] : (l.les || []));
PIC.forModule = id => PIC.lessons.filter(l => PIC.modOf(l) === id);
PIC.covered = m => (m.lessons || []).filter((_, i) => PIC.forModule(m.id).some(l => PIC.lesOf(l).includes(i))).length;
const picStepsSeen = l => { const d = (S.st.picture || {})[l.id]; return d ? d.seen : 0; };

function picIndex() {
  const root = h('div', { class: 'stack picture' }), cur = trackOf(), mods = visibleMods().filter(m => (m.lessons || []).length);
  const total = mods.reduce((a, m) => a + m.lessons.length, 0), done = mods.reduce((a, m) => a + PIC.covered(m), 0), nLess = new Set([].concat.apply([], mods.map(m => PIC.forModule(m.id).map(l => l.id)))).size;
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Learn by watching, turning and touching'), h('h1', {}, 'Picture Classes'), h('p', { class: 'muted lead' }, 'Every course has its modules, and every module the same lessons as the normal curriculum, taught with pictures that move. Watch each picture flat (2D), as a real 3D object you can turn (3D), or in a floating 3D window on top of the lesson (Overlay). In every mode you can touch it: hover for numbers, drag, press buttons, move sliders. This is a separate option; the normal curriculum is unchanged.'))));
  root.append(h('div', { class: 'card pad stack', style: { gap: '10px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' } }, h('h3', { style: { margin: 0 } }, 'Choose your course'), h('span', { class: 'muted', style: { fontSize: '13px' } }, nLess + ' Picture Classes written · ' + done + ' of ' + total + ' lessons in this course have one')),
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' }, role: 'tablist' }, DSQ.tracks.map(t => h('button', { type: 'button', role: 'tab', 'aria-selected': t.id === cur.id ? 'true' : 'false', class: 'btn' + (t.id === cur.id ? ' primary' : ''), onclick: () => { S.st.track = t.id; S.save(); route(); } }, t.title))), h('p', { class: 'muted', style: { margin: 0 } }, cur.blurb)));
  root.append(h('div', { class: 'mods' }, mods.map(m => { const c = PIC.covered(m), n = m.lessons.length, ls = PIC.forModule(m.id);
    return h('a', { class: 'card mod' + (c ? '' : ' planned'), href: '#/picture/m/' + m.id }, h('span', { class: 'ic', style: { background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: '22px' } }, m.icon || '▶'), h('h4', {}, m.title), h('p', {}, m.blurb || m.tagline || ''), h('div', { class: 'pc-cover' }, h('span', { style: { width: Math.round(c / n * 100) + '%' } })), h('span', { class: 'badge chip' }, c + ' of ' + n + ' lessons · ' + ls.length + ' Picture Class' + (ls.length === 1 ? '' : 'es'))); })));
  return root;
}

function picModule(id) {
  const m = App.mods.find(x => x.id === id); if (!m) return picIndex();
  const root = h('div', { class: 'stack picture' }), ls = PIC.forModule(m.id), lessons = m.lessons || [];
  root.append(h('a', { href: '#/picture', class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← All courses and modules'), h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, trackOf().title), h('h1', {}, (m.icon || '') + ' ' + m.title), h('p', { class: 'muted lead' }, (m.blurb || '') + ' ' + PIC.covered(m) + ' of its ' + lessons.length + ' lessons have a Picture Class so far.'))));
  lessons.forEach((L, i) => {
    const mine = ls.filter(l => PIC.lesOf(l).includes(i));
    root.append(h('div', { class: 'card pad stack', style: { gap: '8px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' } }, h('h3', { style: { margin: 0 } }, 'Lesson ' + (i + 1) + ': ' + L.title), h('a', { class: 'btn sm', href: '#/l/' + m.id + '/' + L.id }, 'Open the text lesson')),
      L.blurb ? h('p', { class: 'muted', style: { margin: 0 } }, L.blurb) : null,
      mine.length ? h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, mine.map(l => h('a', { class: 'btn primary', href: '#/picture/' + l.id }, (l.icon || '▶') + ' ' + l.title + (l.embed ? ' (from your files)' : ' · ' + l.steps.length + ' steps' + (picStepsSeen(l) ? ' · ' + Math.min(picStepsSeen(l), l.steps.length) + ' seen' : ''))))) : h('p', { class: 'muted', style: { margin: 0 } }, 'A Picture Class for this lesson is not written yet.')));
  });
  const extra = ls.filter(l => !PIC.lesOf(l).length); if (extra.length) root.append(h('div', { class: 'card pad stack' }, h('h3', { style: { margin: 0 } }, 'More for this module'), h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, extra.map(l => h('a', { class: 'btn', href: '#/picture/' + l.id }, (l.icon || '▶') + ' ' + l.title)))));
  return root;
}

/* a premium lesson the account may not open yet: what it is, what it teaches and how to get it. The lesson itself is not in the page. */
function picLocked(L, mod, back) {
  return h('div', { class: 'stack picture' }, back, h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, (mod ? mod.title + ' · ' : '') + (L.group || 'Picture Class')), h('h1', {}, (L.icon || '') + ' ' + L.title), h('p', { class: 'muted lead' }, L.sub || ''))),
    h('div', { class: 'card pad stack lockcard' }, h('h3', { style: { margin: 0 } }, 'This Picture Class is part of full access'), h('p', { class: 'muted', style: { margin: 0 } }, 'It has ' + L.steps.length + ' animated steps, each with real Python that was run and checked, in 2D, 3D and the live Wrap 3D mode. The free modules show how every lesson works.'),
      h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, h('a', { class: 'btn primary', href: '#/buy' }, 'Get full access'), h('a', { class: 'btn', href: '#/picture' }, 'Try the free lessons'), h('a', { class: 'btn', href: '#/tour' }, 'Take the guided tour'))));
}

function viewPicture(id, arg) {
  if (!id) return picIndex(); if (id === 'm') return picModule(arg); const L = PIC.lessons.find(x => x.id === id); if (!L) return picIndex();
  const mod = App.mods.find(x => x.id === PIC.modOf(L)), back = mod ? h('a', { href: '#/picture/m/' + mod.id, class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← ' + mod.title) : h('a', { href: '#/picture', class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← All Picture Classes');
  if (L.embed) return h('div', { class: 'stack' }, back, h('iframe', { src: L.embed, title: L.title, class: 'pc-embed', loading: 'lazy' }));
  if (L.locked) return picLocked(L, mod, back);
  const root = h('div', { class: 'stack picture' }), done = ((S.st.picture = S.st.picture || {})[L.id] = S.st.picture[L.id] || { seen: 0 });
  let cur = 0, ctx = null, auto = null, voice = false, mode = S.st.picMode || '2d', inst3 = null, token = 0;
  if (typeof PIC3 === 'undefined') mode = '2d';
  const stage = h('div', { class: 'pc-stage' }), say = h('div', { class: 'pc-say', 'aria-live': 'polite' }), outBox = h('pre', { class: 'pc-out', hidden: true }), note3 = h('div', { class: 'pc-note3', hidden: true });
  const codeBox = h('div', { class: 'pc-code' }), dots = h('div', { class: 'pc-dots', role: 'tablist' }), counter = h('span', { class: 'chip' });
  const playBtn = h('button', { class: 'btn', type: 'button', onclick: () => toggle() }, '▶ Play'), prev = h('button', { class: 'btn', type: 'button', onclick: () => go(cur - 1) }, '◀ Back'), next = h('button', { class: 'btn primary', type: 'button', onclick: () => go(cur + 1) }, 'Next ▶');
  const voiceBox = h('input', { type: 'checkbox', onchange: e => { voice = e.target.checked; if (!voice && window.speechSynthesis) speechSynthesis.cancel(); else speak(); } });
  const speak = () => { if (!voice || !window.speechSynthesis) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance((L.steps[cur].say || '').replace(/<[^>]+>/g, ' ')); u.rate = .95; speechSynthesis.speak(u); };
  const edHost = h('div', {}); codeBox.append(edHost); let ed = null;
  const modeBtns = [['2d', '2D', 'flat picture: hover, press, drag'], ['3d', '3D', 'a real 3D object in the lesson: drag to turn it'], ['overlay', 'Project 3D', 'a see-through 3D hologram laid over the whole screen; it follows the lesson step by step']].map(m => h('button', { type: 'button', role: 'tab', class: 'pc-mode', 'data-m': m[0], title: m[2], onclick: () => setMode(m[0]) }, m[1]));
  const modeBar = h('div', { class: 'pc-modes', role: 'tablist', 'aria-label': 'how to watch the picture' }, h('span', { class: 'pc-modelab' }, 'Watch it in'), modeBtns);
  const leave3d = () => { token++; if (inst3) { inst3.close(); inst3 = null; } stage.classList.remove('is3d'); };
  const draw2D = s => { stage.innerHTML = ''; const sc = s.scene && PIC.scenes[s.scene.type]; if (sc) { try { sc(stage, s.scene, ctx); } catch (e) { stage.innerHTML = '<div class="callout warn">This picture could not be drawn: ' + picEsc(e.message) + '</div>'; console.error(e); } } };
  function show() {
    const s = L.steps[cur]; if (ctx) ctx.stop(); ctx = picCtx(); const pick = s.scene && typeof PIC3 !== 'undefined' ? PIC3.pick(s.scene) : null; note3.hidden = true;
    if (mode === '3d') {
      if (pick) { stage.classList.add('is3d'); if (inst3) inst3.show(pick.name, pick.spec); else { const my = ++token; stage.innerHTML = ''; PIC3.mount(stage, {}).then(i => { if (!i) return; if (my !== token) { i.close(); return; } inst3 = i; i.show(pick.name, pick.spec); }); } }
      else { leave3d(); draw2D(s); note3.hidden = false; note3.textContent = 'This picture has no 3D version yet, so here it is in 2D.'; }
    } else { leave3d(); draw2D(s); }
    if (mode === 'overlay') { if (pick && typeof PROJ !== 'undefined') { PROJ.open(pick.name, pick.spec).then(st => { if (st) PROJ.onclose = () => { PROJ.onclose = null; if (mode === 'overlay') setMode('2d', true); }; }); } else { if (typeof PROJ !== 'undefined') PROJ.close(); note3.hidden = false; note3.textContent = 'This picture has no 3D version yet.'; } }
    say.innerHTML = s.say || ''; outBox.hidden = !s.out; outBox.textContent = s.out || '';
    if (s.code) { if (!ed) ed = Editor(edHost, { code: s.code, readOnly: true, minLines: 3 }); else ed.set(s.code); codeBox.hidden = false; } else codeBox.hidden = true;
    [...dots.children].forEach((d, i) => { d.classList.toggle('on', i === cur); d.classList.toggle('past', i < cur); d.setAttribute('aria-selected', i === cur ? 'true' : 'false'); });
    counter.textContent = 'Step ' + (cur + 1) + ' of ' + L.steps.length; prev.disabled = cur === 0; next.textContent = cur === L.steps.length - 1 ? 'Finish ✓' : 'Next ▶';
    if (cur + 1 > done.seen) { done.seen = cur + 1; S.save(); } speak();
    if (typeof PROJ !== 'undefined') PROJ.sync(L, s);
  }
  function setMode(m, fromClose) {
    if (m === mode && !fromClose) return; if (mode === 'overlay' && !fromClose) { if (typeof PROJ !== 'undefined') { PROJ.onclose = null; PROJ.close(); } if (typeof PIC3 !== 'undefined') PIC3.closeWindow(); } mode = m; S.st.picMode = m; S.save();
    modeBtns.forEach(b => { const on = b.dataset.m === mode; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }); if (!root.isConnected && !fromClose) { /* first call before mount */ }
    if (L.steps[cur] && stage.isConnected !== false) show();
  }
  function go(i) { if (i < 0) return; if (i >= L.steps.length) { stopAuto(); finish(); return; } cur = i; show(); }
  function stopAuto() { if (auto) { clearTimeout(auto); auto = null; } playBtn.textContent = '▶ Play'; }
  function toggle() { if (auto) { stopAuto(); return; } playBtn.textContent = '⏸ Pause'; const tick = () => { if (cur >= L.steps.length - 1) { stopAuto(); return; } go(cur + 1); auto = setTimeout(tick, 9000); }; auto = setTimeout(tick, 9000); }
  function finish() {
    leave3d(); if (typeof PIC3 !== 'undefined') PIC3.closeWindow(); if (typeof PROJ !== 'undefined') { PROJ.onclose = null; PROJ.close(); } stage.innerHTML = ''; if (ctx) ctx.stop(); codeBox.hidden = true; outBox.hidden = true; dots.hidden = true; modeBar.hidden = true; prev.hidden = next.hidden = playBtn.hidden = true; counter.textContent = 'Lesson complete';
    const q = L.quiz, box = h('div', { class: 'stack' });
    if (q) { const res = h('div', { class: 'muted' }); box.append(h('h3', {}, '🧠 Quick check'), h('p', {}, q.q), h('div', { class: 'stack' }, q.opts.map((o, i) => h('button', { class: 'btn', type: 'button', onclick: e => { const ok = i === q.a; e.currentTarget.classList.add(ok ? 'primary' : 'bad'); res.innerHTML = (ok ? '✅ Correct. ' : '❌ Not quite. ') + picEsc(q.why); if (ok) { done.quiz = true; S.save(); } } }, o))), res); }
    if (L.remember) box.append(h('h3', {}, '📝 Remember'), h('ul', { class: 'syl' }, L.remember.map(x => h('li', { html: x }))));
    const nx = (() => { const ls = mod ? PIC.forModule(mod.id) : []; const i = ls.indexOf(L); return i >= 0 && ls[i + 1] ? ls[i + 1] : null; })();
    box.append(h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, nx ? h('a', { class: 'btn primary', href: '#/picture/' + nx.id }, 'Next: ' + nx.title) : null, L.lab ? h('a', { class: 'btn' + (nx ? '' : ' primary'), href: L.lab.href }, L.lab.label) : null, h('button', { class: 'btn', type: 'button', onclick: () => { dots.hidden = false; modeBar.hidden = false; prev.hidden = next.hidden = playBtn.hidden = false; go(0); } }, '↻ Watch again'), h('a', { class: 'btn', href: mod ? '#/picture/m/' + mod.id : '#/picture' }, mod ? 'Back to ' + mod.title : 'All Picture Classes')));
    stage.append(h('div', { class: 'card pad stack' }, box));
  }
  L.steps.forEach((_, i) => dots.append(h('button', { class: 'pc-dotbtn', type: 'button', role: 'tab', title: 'Step ' + (i + 1), onclick: () => { stopAuto(); go(i); } }, String(i + 1))));
  root.append(back, h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, (mod ? mod.title + ' · ' : '') + L.group), h('h1', {}, (L.icon || '') + ' ' + L.title), h('p', { class: 'muted lead', html: L.story || L.sub || '' }))),
    h('div', { class: 'pc-layout' }, h('div', { class: 'pc-left stack' }, codeBox, say, outBox), h('div', { class: 'pc-right stack' }, modeBar, h('div', { class: 'card pc-boardcard' }, stage), note3, h('div', { class: 'row pc-controls', style: { gap: '8px', flexWrap: 'wrap' } }, prev, playBtn, next, counter, h('label', { class: 'row', style: { gap: '5px', fontSize: '13px' } }, voiceBox, 'voice-over')), dots)));
  App.dis.push(() => { if (ctx) ctx.stop(); stopAuto(); leave3d(); if (typeof PIC3 !== 'undefined') PIC3.closeWindow(); if (typeof PROJ !== 'undefined') { PROJ.onclose = null; PROJ.close(); } if (window.speechSynthesis) speechSynthesis.cancel(); });
  const key = e => { if (!root.isConnected) { document.removeEventListener('keydown', key); return; } if (/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return; if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); };
  document.addEventListener('keydown', key);
  modeBtns.forEach(b => { const on = b.dataset.m === mode; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  show();
  return root;
}
