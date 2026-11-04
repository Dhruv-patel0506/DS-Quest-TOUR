'use strict';
/* =====================================================================
   Study rooms ("Studio"). Clicking a module's Deep study button opens a full-screen room (public/studio/) built like the Matplotlib reference page:
   welcome, sections with animated labs and a step-by-step player, quick checks, cheat sheet, glossary, exam questions.
   A room is either data for the shared engine (DSQ.studio[id], files in js/studio/) or a finished page (DSQ.studioPages[id]).
   Rooms run the REAL Python engine of the app (Py.run), so results are not painted by hand, and everything works offline.
   This file: the registry, the route #/study/<id>[/<section>], progress for the account, and the 3D hologram for any chart.
   ===================================================================== */
DSQ.studio = DSQ.studio || {};
DSQ.studioPages = Object.assign({ matplotlib: 'studio/matplotlib.html' }, DSQ.studioPages || {});
/* the study room frame reaches the real Python engine through this (the engine itself is a script-level constant, not a window property) */
DSQ.pyRun = o => Py.run(o);
DSQ.hasStudio = id => !!(DSQ.studio[id] || DSQ.studioPages[id]);
DSQ.studioState = id => { const st = S.st && S.st.studio && S.st.studio[id]; return st ? { done: st.done || [], at: st.at || '', ex: st.ex || {} } : { done: [], at: '', ex: {} }; };
/* a graded exercise was solved: true the first time (30 XP once), so the room can celebrate only once */
DSQ.studioSolved = (id, ex) => { try { S.st.studio = S.st.studio || {}; const r = (S.st.studio[id] = S.st.studio[id] || { done: [] }); r.ex = r.ex || {}; if (r.ex[ex]) return false; r.ex[ex] = Date.now(); S.award(30, 'Study exercise'); S.log({ type: 'study-ex', id: id + ':' + ex }); S.save(); return true; } catch (e) { return false; } };
DSQ.studioAt = (id, key) => { try { S.st.studio = S.st.studio || {}; const r = (S.st.studio[id] = S.st.studio[id] || { done: [] }); r.at = key; } catch (e) { } };
DSQ.studioProgress = (id, sec, n, total) => {
  try {
    S.st.studio = S.st.studio || {}; const r = (S.st.studio[id] = S.st.studio[id] || { done: [] });
    if (r.done.includes(sec)) return; r.done.push(sec); S.award(40, 'Study section'); S.log({ type: 'study', id: id + ':' + sec });
    if (total && r.done.length >= total && !r.complete) { r.complete = Date.now(); S.award(150, 'Study room complete'); }
    S.save();
  } catch (e) { }
};
/* any chart a room draws can float in the 3D hologram */
DSQ.projectFigure = (src, title) => { if (typeof PROJ === 'undefined' || !PROJ.open) { toast('3D is not available here.'); return; } PROJ.open('plate', { image: src, title }); };
/* The animated Picture Class of a lesson, opened in a panel beside the room. It is the real player, so 2D, 3D and Project 3D all work there. */
DSQ.studioDockClose = () => {
  const d = DSQ.dock; if (!d) return; DSQ.dock = null;
  try { App.dis.splice(d.mark).forEach(f => { try { f(); } catch (e) { } }); } catch (e) { }
  d.el.remove(); document.body.classList.remove('dock-open');
};
DSQ.studioDock = id => {
  const L = typeof PIC !== 'undefined' && PIC.lessons.find(x => x.id === id);
  if (!L || typeof viewPicture !== 'function') { try { location.hash = '#/picture/' + id; } catch (e) { } return; }
  DSQ.studioDockClose(); const mark = App.dis.length; let body;
  try { body = viewPicture(id); } catch (e) { body = h('div', { class: 'callout warn' }, 'This lesson could not be opened: ' + e.message); }
  const el = h('aside', { class: 'studio-dock', 'aria-label': 'Animated lesson' }, h('div', { class: 'sd-bar' }, h('b', {}, (L.icon || '🎬') + ' ' + L.title), h('button', { class: 'btn', type: 'button', onclick: DSQ.studioDockClose }, '✕ Close')), h('div', { class: 'sd-body' }, body));
  document.body.append(el); document.body.classList.add('dock-open'); DSQ.dock = { el, mark };
};
/* the Picture Class lessons of a module (for the gallery on a room's welcome page) */
DSQ.studioPictures = (mod, extra) => {
  try {
    const row = l => ({ id: l.id, title: l.title, icon: l.icon || '🎬', steps: (l.steps || []).length, locked: !!l.locked });
    const list = PIC.forModule(mod).filter(l => !l.embed).map(row);
    (extra || []).forEach(id => { const L = PIC.lessons.find(x => x.id === id); if (L && !L.embed && !list.some(x => x.id === id)) list.push(row(L)); });
    return list;
  } catch (e) { return []; }
};
function viewStudyRoom(id, sec) {
  const page = DSQ.studio[id] ? 'studio/index.html?m=' + encodeURIComponent(id) : DSQ.studioPages[id];
  const m = (App.mods || []).find(x => x.id === id);
  if (!page) {
    const locked = typeof DSQ.isLocked === 'function' && DSQ.isLocked(id);
    return h('div', { class: 'card pad stack' }, h('h3', {}, locked ? 'This study room is part of full access' : 'No study room for this module yet'),
      h('p', { class: 'muted' }, locked ? 'Sign in with an account that has full access to open it. The free modules\' study rooms are open to everyone.' : 'Rooms are added module by module.'),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/m/' + id }, 'Back to the module'), locked ? h('a', { class: 'btn primary', href: '#/buy' }, 'See full access') : null));
  }
  const host = h('div', { class: 'studio-host' }, h('iframe', { src: page + (sec ? '#' + encodeURIComponent(sec) : ''), title: (m ? m.title : id) + ' study room', allow: 'fullscreen' }));
  document.body.classList.add('studio-open'); host.dispose = () => { DSQ.studioDockClose(); document.body.classList.remove('studio-open'); }; App.dis.push(host.dispose);
  return host;
}
