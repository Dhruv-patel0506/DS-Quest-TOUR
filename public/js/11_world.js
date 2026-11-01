'use strict';
/* =====================================================================
   Learning path: the curriculum as a transit-style map.
   One line per phase, one station per module, in the order they should be studied. The line fills as modules are
   completed; the current station is ringed; locked stations stay locked until the grade gate opens (reason on click).
   Drawn as SVG; motion is limited to the line drawing in and a slow halo on the current station.
   ===================================================================== */
function viewWorld() {
  const st = S.st, mods = visibleMods(), phases = DSQ.phases.filter(p => mods.some(m => m.phase === p.id));
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stateOf = m => {
    if (!m.live) return 'soon'; const g = gate(m); if (!g.open) return 'locked';
    const b = st.boss[m.id], done = S.moduleProgress(m) >= 1 && b && (b.best >= .7 || b.n >= MAX_TRIES) && (!m.project || (st.proj[m.id] && st.proj[m.id].published));
    return done ? 'done' : 'open';
  };
  const step = nextStep(), curId = step ? step.m.id : null;
  const rows = phases.map(p => ({ p, ms: mods.filter(m => m.phase === p.id) }));
  const maxN = Math.max(...rows.map(r => r.ms.length)), W = 1120, L = 210, R = 70, RH = 92, T = 40, H = T + rows.length * RH, stepX = maxN > 1 ? (W - L - R) / (maxN - 1) : 0;
  const X = j => L + j * stepX, Y = i => T + i * RH;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="cmap" role="group" aria-label="Curriculum path: ${rows.length} phases, ${mods.length} modules" xmlns="${SVGNS}">`;
  rows.forEach((r, i) => {
    const y = Y(i), n = r.ms.length, x1 = X(n - 1), states = r.ms.map(stateOf), lastDone = states.reduce((a, c, k) => (c === 'done' ? k : a), -1);
    s += `<text x="0" y="${y - 4}" class="cm-ph">PHASE ${r.p.id}</text><text x="0" y="${y + 14}" class="cm-pn">${esc(r.p.name)}</text>`;
    s += `<path d="M${X(0)} ${y}H${x1}" class="cm-track"/>`;
    if (lastDone >= 0) s += `<path d="M${X(0)} ${y}H${X(lastDone)}" class="cm-fill" style="--len:${X(lastDone) - X(0)}"/>`;
    if (i < rows.length - 1) { const nx = X(0), my = y + RH / 2; s += `<path d="M${x1} ${y + 14}V${my}H${nx}V${Y(i + 1) - 14}" class="cm-link"/>`; }
    r.ms.forEach((m, j) => {
      const state = states[j], cur = m.id === curId, x = X(j), tip = `${m.title} - ` + (state === 'soon' ? 'syllabus only (not built yet)' : state === 'locked' ? 'locked' : state === 'done' ? 'completed' : `${Math.round(S.moduleProgress(m) * 100)}% of lessons`);
      const title = m.title.length > 24 ? m.title.slice(0, 23) + '…' : m.title, words = title.split(' '), l1 = []; let cut = 0; for (const w of words) { if ((l1.join(' ') + ' ' + w).length > 15 && l1.length) break; l1.push(w); cut++; } const a = l1.join(' '), b = words.slice(cut).join(' ');
      s += `<a class="cm-node cm-${state}${cur ? ' cm-cur' : ''}" data-id="${m.id}" data-state="${state}" href="#/m/${m.id}" aria-label="${esc(tip)}"><title>${esc(tip)}</title>`;
      if (cur) s += `<circle cx="${x}" cy="${y}" r="19" class="cm-halo"/>`;
      s += `<circle cx="${x}" cy="${y}" r="12" class="cm-dot"/>`;
      s += state === 'done' ? `<path d="M${x - 4.6} ${y + .4}l3.2 3.3l6-6.6" class="cm-tick"/>` : state === 'locked' ? `<g class="cm-lock"><rect x="${x - 4}" y="${y - 1}" width="8" height="6.4" rx="1.4"/><path d="M${x - 2.6} ${y - 1}v-1.6a2.6 2.6 0 0 1 5.2 0v1.6"/></g>` : `<text x="${x}" y="${y + 3.6}" class="cm-num">${mods.indexOf(m) + 1}</text>`;
      s += `<text x="${x}" y="${y + 31}" class="cm-t">${esc(a)}</text>` + (b ? `<text x="${x}" y="${y + 44}" class="cm-t">${esc(b)}</text>` : '') + '</a>';
    });
  });
  s += '</svg>';
  const root = h('div', { class: 'cm-wrap' }, h('div', { class: 'cm-scroll', html: s }), h('div', { class: 'cm-legend' }, [['done', 'completed'], ['cur', 'you are here'], ['open', 'available'], ['locked', 'locked until the previous module is mastered'], ['soon', 'syllabus only']].map(([k, t]) => h('span', {}, h('i', { class: 'cm-key cm-key-' + k }), t))));
  const svg = $('svg', root);
  svg.addEventListener('click', e => { const a = e.target.closest('.cm-node'); if (!a) return; if (a.dataset.state === 'locked') { e.preventDefault(); const m = mods.find(x => x.id === a.dataset.id), g = gate(m); toast(`Locked: reach 70% mastery in ${g.prev.title} (assessment + practice), or use up ${MAX_TRIES} assessment attempts (${g.left} left).`); } });
  if (!reduce) requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.add('cm-in')));
  else svg.classList.add('cm-in');
  return root;
}
