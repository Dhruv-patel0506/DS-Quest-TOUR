'use strict';
/* Builds the page around a module: top bar, side menu, home, sections, cheat sheet, glossary, exam questions. Sections are built the first time they are opened. */
(function boot() {
  const id = new URLSearchParams(location.search).get('m'); window.__roomId = id;
  const D = (() => { try { return parent.DSQ.studio[id]; } catch (e) { return null; } })();
  const main = $('#main');
  if (!D) { main.append(h('div', { class: 'card' }, h('h2', {}, 'This study room is not available'), h('p', {}, 'Open it from the module page inside Dhruv Patel Academy.'))); return; }
  document.title = D.title + ' Studio | Dhruv Patel Academy';
  const secs = D.sections, ORDER = ['home'].concat(secs.map(s => s.id), D.cheat ? ['cheat'] : [], D.glossary ? ['gloss'] : [], D.exam ? ['exam'] : []);
  let state = { done: [] }; try { state = parent.DSQ.studioState(id) || state; } catch (e) { }
  const done = new Set(state.done || []); const built = new Set(); let current = 'home';
  const leave = () => { try { parent.location.hash = '#/m/' + id; } catch (e) { history.back(); } };
  /* top bar */
  const progBar = h('div', {}), progLabel = h('span', { class: 'progress-label' });
  $('#topbar').append(h('button', { class: 'tb-btn menu-btn', onclick: () => document.body.classList.toggle('side-open') }, '☰'), h('button', { class: 'tb-btn', title: 'Back to Dhruv Patel Academy', onclick: leave }, '← Dhruv Patel Academy'),
    h('div', { class: 'brand' }, h('div', { class: 'logo' }, D.icon || '📘'), h('span', {}, D.title + ' Studio')), h('div', { class: 'progress-wrap' }, h('div', { class: 'progress' }, progBar), progLabel),
    h('button', { class: 'tb-btn', title: 'Previous (←)', onclick: () => go(-1) }, '◀'), h('button', { class: 'tb-btn', title: 'Next (→)', onclick: () => go(1) }, '▶'),
    h('button', { class: 'tb-btn', title: 'Smaller text', onclick: () => fontStep(-1) }, 'A−'), h('button', { class: 'tb-btn', title: 'Larger text', onclick: () => fontStep(1) }, 'A+'),
    h('button', { class: 'tb-btn', title: 'Presentation mode (P)', onclick: togglePresent }, '🎬 Present'));
  /* side menu */
  const side = $('#sidebar'), navItems = {};
  const nav = (key, num, label) => { const it = h('div', { class: 'nav-item', onclick: () => show(key) }, h('div', { class: 'num' }, h('span', {}, num)), label); navItems[key] = it; side.append(it); };
  side.append(h('h4', {}, 'Start')); nav('home', '🏠', 'Welcome'); side.append(h('h4', {}, 'Sections'));
  secs.forEach((s, i) => nav(s.id, String(i + 1), s.title));
  if (D.cheat || D.glossary || D.exam) side.append(h('h4', {}, 'For revision'));
  if (D.cheat) nav('cheat', '📋', 'Cheat sheet'); if (D.glossary) nav('gloss', '📖', 'Glossary'); if (D.exam) nav('exam', '📝', 'Exam-style questions');
  function updateProgress() {
    const n = secs.filter(s => done.has(s.id)).length; progBar.style.width = (n / secs.length * 100) + '%'; progLabel.textContent = `${n} / ${secs.length} sections complete`;
    secs.forEach(s => navItems[s.id].classList.toggle('done', done.has(s.id)));
  }
  function markDone(secId, celebrate) {
    if (done.has(secId)) return; done.add(secId); updateProgress();
    try { parent.DSQ.studioProgress(id, secId, done.size, secs.length); } catch (e) { }
    if (celebrate !== false) { confetti(); toast('🎉 Section complete!'); }
  }
  function confetti() { const cols = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6']; for (let i = 0; i < 70; i++) { const c = h('div', { class: 'confetti' }); c.style.left = Math.random() * 100 + 'vw'; c.style.background = cols[i % cols.length]; c.style.animationDelay = Math.random() * .6 + 's'; c.style.borderRadius = Math.random() > .5 ? '50%' : '2px'; document.body.append(c); setTimeout(() => c.remove(), 3500); } }
  function fontStep(d) { const cur = parseFloat(getComputedStyle(document.documentElement).fontSize), v = Math.max(13, Math.min(24, cur + d)); document.documentElement.style.setProperty('--fs', v + 'px'); try { localStorage.setItem('dsq.studio.fs', v); } catch (e) { } }
  function togglePresent() { document.body.classList.toggle('present'); toast(document.body.classList.contains('present') ? '🎬 Presentation mode: press P to exit' : 'Menu restored'); }
  try { const fs = localStorage.getItem('dsq.studio.fs'); if (fs) document.documentElement.style.setProperty('--fs', fs + 'px'); } catch (e) { }

  /* pages */
  const pager = key => { const i = ORDER.indexOf(key), prev = ORDER[i - 1], next = ORDER[i + 1], sec = secs.find(s => s.id === key); return h('div', { class: 'pager' }, prev ? h('button', { class: 'btn ghost', onclick: () => show(prev) }, '◀ Previous') : h('span', {}), sec ? h('button', { class: 'btn complete-btn', onclick: () => markDone(key) }, '✓ Mark section complete') : h('span', {}), next ? h('button', { class: 'btn', onclick: () => show(next) }, 'Next ▶') : h('span', {})); };
  function pageHome() {
    const sec = h('section', { class: 'section', id: 'home' }); const words = D.words || ['Animated. Interactive.', 'Real Python, offline.', 'Learn by doing ✨'], typed = h('span', { class: 'typed' });
    sec.append(h('div', { class: 'hero' }, h('svg', { class: 'bg', viewBox: '0 0 1000 400', preserveAspectRatio: 'none', html: '<path d="M0,300 C120,120 220,120 330,260 S540,360 660,180 S860,40 1000,140" stroke="#3987e5"/><path d="M0,200 C150,330 260,330 380,180 S600,60 720,240 S900,330 1000,260" stroke="#eb6834" style="animation-delay:1s"/><path d="M0,350 L100,310 L200,330 L300,250 L400,270 L500,190 L600,210 L700,120 L800,150 L900,70 L1000,90" stroke="#1baf7a" style="animation-delay:2s"/>' }),
      h('h1', {}, D.title, h('br'), typed), h('p', {}, D.subtitle), h('div', { class: 'cta' }, h('button', { class: 'btn', onclick: () => show(secs[0].id) }, '🚀 Start with ' + secs[0].title), D.exam ? h('button', { class: 'btn ghost', onclick: () => show('exam') }, '📝 Exam-style questions') : null)));
    const pics = (() => { try { return parent.DSQ.studioPictures(D.id, D.pictures); } catch (e) { return []; } })();
    if (pics.length) sec.append(h('h2', {}, '🎬 Watch the ideas move'), h('p', { class: 'muted' }, 'Each of these is an animated lesson. Press one and it opens beside this page. Switch between 2D, 3D and Project 3D at the top of it.'), BLK.pictures({ items: pics }));
    sec.append(h('h2', {}, 'How this room works'), BLK.cards({ cols: 'g4', items: [['🎛️', 'Live labs', 'Move a slider or pick an option. The code is rewritten and **run again in real Python**.'], ['🐍', 'Real results', 'Every number and chart comes from the real library, not a drawing. It works **offline** once Dhruv Patel Academy has loaded.'], ['📋', 'Copy and run', 'Each code block has **Copy** and **Run**. You can **edit** a block and run your own version.'], ['✅', 'Quick checks', 'Every section ends with a short quiz. Press **P** to hide the menu for a projector; **← →** move between sections.']] }));
    sec.append(h('h2', {}, 'Course map'), h('div', { class: 'grid g3' }, secs.map((s, i) => h('div', { class: 'mini mod-card', style: { animation: `pop .5s ${i * .06}s both` }, onclick: () => show(s.id) }, h('span', { class: 'n' }, String(i + 1)), h('div', { class: 'ic' }, s.icon || '•'), h('h4', {}, `Section ${i + 1} · ${s.title}`), h('p', {}, s.sub || '')))));
    if (D.preview) sec.append(h('div', { class: 'callout warn' }, h('b', { class: 't' }, 'This is a preview'), h('span', {}, 'You are looking at the first of ' + (D.previewOf || 'the') + ' sections of this study room, with its real labs, so you can feel how it works. '), h('button', { class: 'btn', type: 'button', onclick: () => { try { parent.location.hash = '#/welcome'; } catch (e) { } } }, 'See curricula and packages')));
    if (D.about) sec.append(h('div', { class: 'callout tip' }, h('b', { class: 't' }, 'About this room'), h('span', { html: md(D.about) })));
    let w = 0, c = 0, del = false; (function tick() { const s = words[w]; typed.textContent = s.slice(0, c); if (!del && c < s.length) c++; else if (del && c > 0) c--; else if (!del) { del = true; return setTimeout(tick, 1800); } else { del = false; w = (w + 1) % words.length; } setTimeout(tick, del ? 35 : 75); })();
    return sec;
  }
  function pageSection(s, i) {
    const sec = h('section', { class: 'section', id: s.id });
    sec.append(h('div', { class: 'mod-head' }, h('div', { class: 'mod-badge' }, s.icon || '📘'), h('div', {}, h('h1', {}, `Section ${i + 1} · ${s.title}`), h('p', {}, s.sub || ''))));
    if (s.objectives) sec.append(h('div', { class: 'objectives' }, h('b', {}, '🎯 Learning objectives: you will be able to…'), h('ul', {}, s.objectives.map(o => h('li', { html: md(o) })))));
    if (s.simple) sec.append(BLK.simple({ text: s.simple }));
    if (s.real) sec.append(BLK.real({ text: s.real }));
    (s.blocks || []).forEach(b => { try { sec.append(build(Object.assign({ starter: D.starter, roomStarter: D.starter || '', shim: D.shim }, b))); } catch (e) { sec.append(h('div', { class: 'callout bad' }, 'Could not build a block: ' + e.message)); } });
    if (s.takeaways && s.takeaways.length) sec.append(h('div', { class: 'callout teach' }, h('b', { class: 't' }, '🧠 Remember'), h('ul', { style: { margin: 0 } }, s.takeaways.map(t => h('li', { html: md(t) })))));
    if (s.quiz && s.quiz.length) sec.append(h('h2', {}, '✅ Quick check'), buildQuiz(s.quiz, () => markDone(s.id)));
    sec.append(pager(s.id)); return sec;
  }
  function pageCheat() { const sec = h('section', { class: 'section', id: 'cheat' }); const body = h('tbody', {}); const rows = D.cheat; const f = q => { body.innerHTML = ''; rows.filter(([a, c]) => (a + c).toLowerCase().includes(q.toLowerCase())).forEach(([a, c]) => body.append(h('tr', {}, h('td', {}, a), h('td', {}, h('code', {}, c))))); };
    sec.append(h('div', { class: 'mod-head' }, h('div', { class: 'mod-badge' }, '📋'), h('div', {}, h('h1', {}, 'Cheat sheet'), h('p', {}, 'The lines you will type most often. Use the search box.'))), h('input', { class: 'search', placeholder: 'Search the cheat sheet…', oninput: e => f(e.target.value) }), h('div', { class: 'tbl-wrap' }, h('table', { class: 'cheat-tbl' }, h('thead', {}, h('tr', {}, h('th', {}, 'Task'), h('th', {}, 'Code'))), body)), pager('cheat')); f(''); return sec; }
  function pageGloss() { const sec = h('section', { class: 'section', id: 'gloss' }); const grid = h('div', { class: 'gloss' }); const f = q => { grid.innerHTML = ''; D.glossary.filter(([t, d]) => (t + d).toLowerCase().includes(q.toLowerCase())).forEach(([t, d]) => grid.append(h('div', { class: 'mini' }, h('h4', {}, t), h('p', { html: md(d) })))); };
    sec.append(h('div', { class: 'mod-head' }, h('div', { class: 'mod-badge' }, '📖'), h('div', {}, h('h1', {}, 'Glossary'), h('p', {}, 'Every new word in plain language.'))), h('input', { class: 'search', placeholder: 'Search the glossary…', oninput: e => f(e.target.value) }), h('div', { style: { height: '12px' } }), grid, pager('gloss')); f(''); return sec; }
  function pageExam() { const sec = h('section', { class: 'section', id: 'exam' }); sec.append(h('div', { class: 'mod-head' }, h('div', { class: 'mod-badge' }, '📝'), h('div', {}, h('h1', {}, 'Exam-style questions'), h('p', {}, 'Answer each one on paper first, then check yourself by running code in the sections above.'))), h('ol', {}, D.exam.map(q => h('li', { style: { margin: '8px 0' }, html: md(q) }))), pager('exam')); return sec; }
  function show(key) {
    if (!ORDER.includes(key)) key = 'home'; current = key;
    if (!built.has(key)) { built.add(key); const i = secs.findIndex(s => s.id === key); const node = key === 'home' ? pageHome() : key === 'cheat' ? pageCheat() : key === 'gloss' ? pageGloss() : key === 'exam' ? pageExam() : pageSection(secs[i], i); main.append(node); }
    $$('.section', main).forEach(s => s.classList.toggle('active', s.id === key)); Object.entries(navItems).forEach(([k, n]) => n.classList.toggle('active', k === key));
    document.body.classList.remove('side-open'); window.scrollTo(0, 0); try { parent.DSQ.studioAt && parent.DSQ.studioAt(id, key); } catch (e) { }
  }
  function go(d) { const i = ORDER.indexOf(current) + d; if (i >= 0 && i < ORDER.length) show(ORDER[i]); }
  document.addEventListener('keydown', e => { if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return; if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'p' || e.key === 'P') togglePresent(); else if (e.key === 'Escape') leave(); });
  updateProgress(); show((location.hash || '').slice(1) || state.at || 'home');
  window.__studio = { show, go, markDone, done, ORDER };
})();
