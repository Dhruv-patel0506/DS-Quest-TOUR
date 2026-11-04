'use strict';
/* =====================================================================
   Welcome (#/welcome) and the tour of a curriculum (#/welcome/<track>).
   A student should not have to choose blind. This page lists every curriculum and module, and lets anyone WATCH an animated lesson (2D, 3D, Project 3D) and TRY a real study
   room from every module before paying. For paid modules the sample is the first animated lesson and the first room section (public/demo/preview/, built by
   tools/build_previews.js); free modules open in full. Packages and prices come from the server (/api/pay/config), so what is shown is what is charged.
   ===================================================================== */
DSQ.previews = DSQ.previews || {};
let wcIdx = null;
const wcIndex = async () => { if (wcIdx) return wcIdx; try { wcIdx = (await (await fetch('demo/preview/index.json')).json()).modules; } catch (e) { wcIdx = {}; } return wcIdx; };
DSQ.loadPreview = id => new Promise(res => { if (DSQ.previews[id]) return res(DSQ.previews[id]); const s = document.createElement('script'); s.src = 'demo/preview/' + id + '.js'; s.onload = () => res(DSQ.previews[id] || null); s.onerror = () => res(null); document.head.append(s); });
/* make the sample lesson of a paid module playable (it replaces the locked stub, for this visit only) */
DSQ.unlockSample = async mid => {
  const info = (await wcIndex())[mid]; if (!info) return null; if (info.free) return info.sampleLesson ? info.sampleLesson.id : null;
  const pv = await DSQ.loadPreview(mid); if (!pv || !pv.lesson) return null; const stub = PIC.lessons.find(x => x.id === pv.lesson.id);
  if (!stub || stub.locked) PIC.lesson(Object.assign({}, pv.lesson, { mod: stub ? stub.mod : mid, les: stub ? stub.les : [0], preview: true })); return pv.lesson.id;
};
DSQ.previewLesson = async mid => { const id = await DSQ.unlockSample(mid); if (!id) { toast('There is no animated sample for this one yet.'); return false; } DSQ.studioDock(id); return true; };
DSQ.previewRoom = async mid => {
  const info = (await wcIndex())[mid]; if (!info || !info.room) { toast('There is no study room for this one yet.'); return false; }
  if (!info.free && !DSQ.studio[mid]) { const pv = await DSQ.loadPreview(mid); if (!pv || !pv.room) { toast('The preview could not be loaded.'); return false; } DSQ.studio[mid] = pv.room; await DSQ.unlockSample(mid); }
  location.hash = '#/study/' + mid; return true;
};

function viewWelcome(parts) {
  const root = h('div', { class: 'stack wl' }), box = h('div', { class: 'stack' }); root.append(box);
  const track = (parts || [])[1];
  (async () => {
    const [idx, cfg] = await Promise.all([wcIndex(), API.get('/api/pay/config').catch(() => ({ enabled: false }))]);
    const mods = DSQ.roadmap, mod = id => mods.find(m => m.id === id), tracks = DSQ.tracks;
    const plans = cfg.plans && cfg.plans.length ? cfg.plans : [], cur = (() => { try { return guessCurrency(cfg.currencies || [{ code: 'INR' }]); } catch (e) { return 'INR'; } })();
    const priceOf = id => { const pl = plans.find(x => x.id === id); if (!pl) return ''; const pr = (pl.prices || []).find(c => c.code === cur) || (pl.prices || [])[0]; return pr ? money(Math.round(pr.amount * 100), pr.code) : ''; };
    const total = k => Object.values(idx).reduce((n, v) => n + (v[k] || 0), 0), nFree = Object.values(idx).filter(v => v.free).length, nRooms = Object.values(idx).filter(v => v.room).length;
    const hrs = ids => ids.reduce((n, id) => n + ((mod(id) || {}).hours || 0), 0);
    const sampled = () => { try { return JSON.parse(localStorage.getItem('dsq.sampled') || '{}'); } catch (e) { return {}; } }, mark = id => { try { const s = sampled(); s[id] = 1; localStorage.setItem('dsq.sampled', JSON.stringify(s)); } catch (e) { } };
    const badges = id => { const i = idx[id] || {}; return h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, i.free ? h('span', { class: 'chip ok' }, 'free') : h('span', { class: 'chip' }, 'sample free'), i.lessons ? h('span', { class: 'chip' }, i.lessons + ' animated lesson' + (i.lessons === 1 ? '' : 's')) : null, i.picture3d ? h('span', { class: 'chip' }, '2D · 3D') : null, i.room ? h('span', { class: 'chip' }, 'study room, ' + i.sections + ' sections') : null); };
    const sampleBtns = (id, after) => { const i = idx[id] || {}; return h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
      i.sampleLesson ? h('button', { class: 'btn primary', type: 'button', title: i.sampleLesson.title, onclick: async () => { if (await DSQ.previewLesson(id)) { mark(id); if (after) after(); } } }, '▶ Watch an animated lesson') : null,
      i.room ? h('button', { class: 'btn', type: 'button', onclick: async () => { mark(id); await DSQ.previewRoom(id); } }, '🧪 Try the study room') : null,
      h('a', { class: 'btn ghost', href: '#/m/' + id }, 'Module details')); };

    if (track && tracks.some(t => t.id === track)) {   /* ---------- the tour of one curriculum ---------- */
      const t = tracks.find(x => x.id === track), ids = (t.ids || mods.map(m => m.id)), pl = plans.find(x => x.id === track), done = () => ids.filter(id => sampled()[id]).length;
      const prog = h('span', { class: 'chip' }), paintProg = () => { prog.textContent = 'You have sampled ' + done() + ' of ' + ids.length + ' modules'; };
      box.append(h('a', { href: '#/welcome', class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← All curricula'),
        h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Tour of a curriculum'), h('h1', {}, t.title), h('p', { class: 'muted lead' }, t.blurb))),
        h('div', { class: 'card pad stack' }, h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, h('span', { class: 'chip' }, ids.length + ' modules'), h('span', { class: 'chip' }, hrs(ids) + ' hours'), prog),
          h('p', { class: 'muted', style: { margin: 0 } }, 'Go through the modules in order. For each one, watch an animated lesson (switch between 2D, 3D and Project 3D, drag the points) and try its study room. Nothing is saved and nothing is charged. When you have seen enough, decide.')));
      paintProg();
      ids.forEach((id, n) => { const m = mod(id); if (!m) return; const i = idx[id] || {};
        box.append(h('div', { class: 'card pad wl-mod', style: { animation: 'pop .45s ' + Math.min(n, 8) * .05 + 's both' } },
          h('div', { class: 'wl-n' }, String(n + 1)), h('div', { class: 'stack', style: { gap: '8px' } },
            h('div', { class: 'row', style: { gap: '10px', alignItems: 'center', flexWrap: 'wrap' } }, h('h3', { style: { margin: 0 } }, m.title), h('span', { class: 'muted' }, m.hours + ' h')),
            h('p', { class: 'muted', style: { margin: 0 } }, m.blurb), badges(id),
            m.syllabus ? h('ul', { class: 'syl' }, m.syllabus.slice(0, 4).map(x => h('li', {}, x))) : null,
            m.capstone ? h('div', { class: 'callout' }, h('b', {}, 'You build: '), m.capstone) : null,
            i.sampleLesson ? h('div', { class: 'muted', style: { fontSize: '.85rem' } }, 'Sample: ' + i.sampleLesson.icon + ' ' + i.sampleLesson.title + ' (' + i.sampleLesson.steps + ' animated steps)') : null,
            sampleBtns(id, paintProg)))); });
      box.append(h('div', { class: 'card pad stack wl-buy' }, h('h3', { style: { margin: 0 } }, 'Ready to learn all of it?'),
        pl ? h('p', { style: { margin: 0 } }, h('b', {}, pl.name), ': ' + pl.modules.length + ' paid modules for ', h('b', {}, priceOf(track)), '. Other curricula stay locked until you add them.') : h('p', { style: { margin: 0 } }, 'Everything in this curriculum is in full access' + (priceOf('all') ? ': ' + priceOf('all') : '') + '.'),
        h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, h('a', { class: 'btn primary', href: pl ? '#/buy/plan/' + track : '#/buy' }, pl ? 'Get the ' + t.title.replace(/\s*\(.*\)\s*$/, '') + ' package' : 'See full access'), h('a', { class: 'btn', href: '#/welcome' }, 'Compare packages'),
          h('a', { class: 'btn ghost', href: '#/legal/refund' }, cfg.legal && cfg.legal.refundDays ? cfg.legal.refundDays + '-day refund' : 'Refund policy'))));
      box.append(h('div', { style: { height: '10px' } })); root.append(); return;
    }

    /* ---------- the catalogue ---------- */
    box.append(h('div', { class: 'wl-hero' }, h('div', { class: 'eyebrow' }, 'Welcome'), h('h1', {}, 'Try every curriculum before you choose.'),
      h('p', { class: 'lead' }, 'Practical skills for data, AI, web and marketing work. Every idea is animated, can be turned in 3D, and runs as real code in your browser. Take the tour of any curriculum, watch a lesson from each module, try its study room, and only then pay.'),
      h('div', { class: 'row', style: { gap: '18px', flexWrap: 'wrap' } }, [[tracks.filter(x => x.id !== 'all').length, 'curricula'], [mods.length, 'modules'], [total('lessons'), 'animated lessons'], [nRooms, 'study rooms'], [nFree, 'modules free for everyone']].map(([n, l]) => h('div', { class: 'wl-stat' }, h('b', {}, String(n)), h('span', {}, l)))),
      h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, h('a', { class: 'btn primary', href: '#/welcome/' + (tracks.find(x => x.id !== 'all') || tracks[0]).id }, 'Start a tour'), h('a', { class: 'btn', href: '#/buy' }, 'Packages and prices'))));
    box.append(h('h2', {}, 'Pick a curriculum'));
    box.append(h('div', { class: 'wl-grid' }, tracks.filter(x => x.id !== 'all' && x.ids).map((t, n) => { const pl = plans.find(x => x.id === t.id), nSamples = t.ids.filter(id => (idx[id] || {}).sampleLesson).length;
      return h('div', { class: 'card pad stack wl-card', style: { animation: 'pop .45s ' + n * .05 + 's both' } }, h('h3', { style: { margin: 0 } }, t.title), h('p', { class: 'muted', style: { margin: 0, flex: 1 } }, t.blurb),
        h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, h('span', { class: 'chip' }, t.ids.length + ' modules'), h('span', { class: 'chip' }, hrs(t.ids) + ' hours'), h('span', { class: 'chip' }, nSamples + ' samples to try')),
        pl ? h('div', { class: 'wl-price' }, 'Package ', h('b', {}, priceOf(t.id)), h('span', { class: 'muted' }, ' · ' + pl.modules.length + ' paid modules')) : null,
        h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, h('a', { class: 'btn primary', href: '#/welcome/' + t.id }, 'Take the tour'), pl ? h('a', { class: 'btn', href: '#/buy/plan/' + t.id }, 'Buy this package') : null)); })));
    box.append(h('h2', {}, 'Or everything'), h('div', { class: 'card pad stack' }, h('h3', { style: { margin: 0 } }, plans[0] ? plans[0].name : 'Full access'), h('p', { class: 'muted', style: { margin: 0 } }, 'Every module, function sheet, notebook and study room, in every curriculum. One payment, no subscription' + (cfg.legal && cfg.legal.refundDays ? ', ' + cfg.legal.refundDays + '-day refund' : '') + '.'),
      h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, priceOf('all') ? h('b', { style: { fontSize: '1.4rem' } }, priceOf('all')) : null, h('a', { class: 'btn primary', href: '#/buy' }, 'See full access'), h('a', { class: 'btn', href: '#/welcome/all' }, 'Tour all ' + mods.length + ' modules'))));
    box.append(h('h2', {}, 'Every module'), h('p', { class: 'muted' }, 'Sample any of them. Free modules open in full; for the others you see the first animated lesson and the first part of the study room.'));
    const phases = [...new Set(mods.map(m => m.phase))].sort((a, b) => a - b), names = (DSQ.phases || []).reduce((o, p) => { o[p.id] = p.name; return o; }, {});
    phases.forEach(ph => { box.append(h('h3', {}, names[ph] || 'Phase ' + ph), h('div', { class: 'wl-list' }, mods.filter(m => m.phase === ph).map(m => h('div', { class: 'card pad wl-row' }, h('div', { class: 'stack', style: { gap: '4px', flex: 1, minWidth: '220px' } }, h('b', {}, m.title), h('span', { class: 'muted', style: { fontSize: '.88rem' } }, m.blurb), badges(m.id)), sampleBtns(m.id))))); });
    box.append(h('div', { class: 'callout' }, h('b', {}, 'Nothing here costs anything to try. '), 'The samples are the real lessons and rooms, not videos. If a module is not for you, you have not lost a rupee.'));
  })();
  return root;
}
