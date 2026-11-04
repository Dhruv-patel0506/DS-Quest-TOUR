'use strict';
/* =====================================================================
   Learner history. Everything a learner does is written to a small queue on the device first (so nothing is lost offline) and sent in batches
   to the Django history service (backend/dsqhist, reached at /hist/*) with a short-lived pass from our own API. Each event has a client id, so a
   resend after a dropped connection never makes a duplicate. If the service is not switched on, the queue simply stays on the device and
   the History page shows it from there.
   Kinds: activity (everything S.log records), tutor (question + answer), run (code + output), project (saved / published).
   #/history shows the summary, the lists, search, an export of everything, and a button that erases it all.
   ===================================================================== */
const HIST = (() => {
  const CAP = 2000, BATCH = 100;
  let tok = null, tokExp = 0, down = 0, busy = false, timer = 0, lastSync = 0, svc = 'unknown', lastRun = { code: '', at: 0 };
  const user = () => ((typeof S !== 'undefined' && S.me && S.me.username) || '').toLowerCase();
  const qk = () => 'dsq.histq.' + user();
  const load = () => { try { return JSON.parse(localStorage.getItem(qk()) || '[]'); } catch (e) { return []; } };
  const save = a => { try { localStorage.setItem(qk(), JSON.stringify(a.slice(-CAP))); } catch (e) { } };
  const uid = () => { const a = new Uint8Array(15); crypto.getRandomValues(a); return Array.from(a, b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join(''); };
  const enabled = () => !!user() && !API.demo && !API.local;
  const clip = (v, n) => (typeof v === 'string' && v.length > n ? v.slice(0, n) : v);
  const slim = d => { const o = {}; for (const k in d) { const v = d[k]; o[k] = typeof v === 'string' ? clip(v, 6000) : (v && typeof v === 'object' ? undefined : v); } return o; };

  function add(kind, ref, data, sub) {
    if (!enabled()) return;
    const q = load(); q.push({ cid: uid(), kind, sub: sub || '', ref: String(ref || '').slice(0, 80), ts: Date.now(), data: slim(data || {}) }); save(q);
    clearTimeout(timer); timer = setTimeout(flush, 3000);
  }
  async function token() {
    if (tok && Date.now() < tokExp) return tok;
    let r; try { r = await API.get('/api/history/token'); } catch (e) { return null; }
    if (!r || !r.available) { svc = 'off'; down = Date.now() + 30 * 60000; return null; }
    tok = r.token; tokExp = Date.now() + (r.expiresIn || 3000) * 1000; return tok;
  }
  async function call(path, opt) {
    const t = await token(); if (!t) throw new Error('history is not available');
    let r = await fetch('/hist' + path, Object.assign({ headers: { Authorization: 'Bearer ' + t } }, opt));
    if (r.status === 401) { tok = null; const t2 = await token(); if (!t2) throw new Error('history is not available'); r = await fetch('/hist' + path, Object.assign({}, opt, { headers: Object.assign({}, (opt || {}).headers, { Authorization: 'Bearer ' + t2 }) })); }
    return r;
  }
  async function flush() {
    if (busy || !enabled() || navigator.onLine === false || Date.now() < down || !load().length) return;
    busy = true;
    try {
      for (let guard = 0; guard < 30; guard++) {
        const batch = load().slice(0, BATCH); if (!batch.length) break;
        const r = await call('/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: batch }) });
        if (!r.ok) { svc = r.status === 503 || r.status === 404 ? 'off' : 'error'; down = Date.now() + (svc === 'off' ? 5 * 60000 : 60000); break; }
        const sent = new Set(batch.map(e => e.cid)); save(load().filter(e => !sent.has(e.cid))); lastSync = Date.now(); svc = 'on';
      }
    } catch (e) { if (svc !== 'off') down = Date.now() + 60000; }
    busy = false;
  }
  /* code runs: one event per run, but not the same code twice within 20 seconds (live-run mode would flood it) */
  function run(code, res) {
    if (!enabled() || !code) return; const now = Date.now(); if (code === lastRun.code && now - lastRun.at < 20000) return; lastRun = { code, at: now };
    const err = res && res.error; add('run', (location.hash || '').slice(0, 80), { code: clip(String(code), 8000), out: clip(String((res && res.stdout) || ''), 3000), ok: !err, err: err ? clip(String(err.type || 'Error') + ': ' + String(err.msg || ''), 300) : '', ms: res && res.ms || 0 }, err ? 'err' : 'ok');
  }
  addEventListener('online', () => { down = 0; flush(); }); setInterval(flush, 60000);
  return { add, run, flush, call, load, user, enabled, status: () => ({ svc, pending: load().length, lastSync, offline: navigator.onLine === false }) };
})();
DSQ.HIST = HIST;

/* the existing activity log feeds it, and every Python run is recorded */
(function () {
  const log0 = S.log; S.log = function (o) { log0.call(this, o); try { if (o && o.type) HIST.add('activity', o.id || o.ex || '', o, o.type); } catch (e) { } };
  const run0 = Py.run; Py.run = async function (o) { const r = await run0.call(this, o); try { HIST.run(o && o.code, r); } catch (e) { } return r; };
})();

/* ---------- the page ---------- */
function viewHistory() {
  const root = h('div', { class: 'stack' }), box = h('div', { class: 'stack' });
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Account'), h('h1', {}, 'My history'), h('p', { class: 'muted lead' }, 'What you did, what you asked the tutor, the code you ran and your projects. It is saved to your account, so it follows you to any device.'))), box);
  const when = t => new Date(t).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const LABEL = { lesson: 'Finished a lesson', ex: 'Passed an exercise', quiz: 'Took a quiz', run: 'Ran an exercise', typing: 'Typing practice', nbcell: 'Ran a notebook cell', demo: 'Tried a demo', datatask: 'Did a data task', ask: 'Asked the tutor', tutor: 'Used the explainer' };
  const tabs = [['activity', 'Activity'], ['tutor', 'Tutor chats'], ['run', 'Code runs'], ['project', 'Projects'], ['pay', 'Payments']];
  const st = { tab: 'activity', q: '', list: [], next: null, unsynced: [] };
  const banner = h('div', { class: 'callout', role: 'status' }), tiles = h('div', { class: 'row', style: { gap: '12px', flexWrap: 'wrap' } }), tabRow = h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }), search = h('input', { class: 'input', placeholder: 'Search this tab', 'aria-label': 'Search', style: { maxWidth: '280px' } }), list = h('div', { class: 'stack' }), more = h('button', { class: 'btn', type: 'button', hidden: true }, 'Load older');
  const tile = (n, l) => h('div', { class: 'card pad', style: { minWidth: '130px' } }, h('div', { style: { fontSize: '26px', fontWeight: 800 } }, String(n)), h('div', { class: 'muted', style: { fontSize: '13px' } }, l));
  function paintBanner() {
    const s = HIST.status(); banner.className = 'callout' + (s.svc === 'on' && !s.pending ? ' ok' : ' warn');
    banner.textContent = !HIST.enabled() ? 'History is saved in your account when you are signed in (not in the guided tour or browser-only mode).'
      : s.svc === 'off' ? 'The history service is not switched on for this site yet. Your history is kept on this device (' + s.pending + ' events) and will upload once it is.'
        : s.offline ? 'You are offline. ' + s.pending + ' events are saved on this device and upload by themselves when you are back online.'
          : s.pending ? s.pending + ' events are waiting to upload.' : 'All saved to your account' + (s.lastSync ? ' (last upload ' + when(s.lastSync) + ').' : '.');
  }
  const row1 = (e, extra) => {
    const t = h('span', { class: 'muted', style: { fontSize: '12.5px' } }, when(e.ts) + (extra ? ' · not uploaded yet' : ''));
    if (e.kind === 'tutor') return h('div', { class: 'card pad stack', style: { gap: '6px' } }, h('div', {}, h('b', {}, e.data.q || ''), ' ', t), h('div', { style: { whiteSpace: 'pre-wrap' } }, e.data.a || ''), e.data.provider ? h('div', { class: 'muted', style: { fontSize: '12px' } }, 'answered by ' + e.data.provider) : null);
    if (e.kind === 'run') return h('div', { class: 'card pad stack', style: { gap: '6px' } }, h('div', {}, h('span', { class: 'chip ' + (e.data.ok ? 'ok' : 'bad') }, e.data.ok ? 'ran fine' : (e.data.err || 'error')), ' ', t, e.ref ? h('span', { class: 'muted', style: { fontSize: '12px' } }, ' · ' + e.ref) : null), h('pre', { class: 'tout', style: { maxHeight: '180px', overflow: 'auto' } }, e.data.code || ''), e.data.out ? h('pre', { class: 'tout', style: { maxHeight: '120px', overflow: 'auto' } }, e.data.out) : null);
    if (e.kind === 'project') return h('div', { class: 'card pad' }, h('b', {}, e.data.title || e.ref), ' ', t, e.data.live ? h('div', {}, h('a', { href: e.data.live, target: '_blank' }, 'Open the live page')) : null);
    const d = e.data || {}; return h('div', { class: 'row', style: { gap: '10px', padding: '6px 0', borderBottom: '1px solid var(--line, #e6e6ee)' } }, h('b', {}, LABEL[e.sub || d.type] || (e.sub || d.type || 'Activity')), e.ref ? h('code', {}, e.ref) : null, d.tries ? h('span', { class: 'muted' }, d.tries + ' tries') : null, d.hints ? h('span', { class: 'muted' }, d.hints + ' hints') : null, h('span', { class: 'grow' }), t);
  };
  async function paintList(append) {
    if (!append) { list.innerHTML = ''; st.next = null; }
    if (st.tab === 'pay') {
      try { const m = await API.get('/api/pay/mine'); const rows = (m.pay || []).slice().sort((a, b) => b.at - a.at); list.append(...(rows.length ? rows.map(p => h('div', { class: 'row', style: { gap: '10px', padding: '6px 0', borderBottom: '1px solid var(--line, #e6e6ee)' } }, h('b', {}, p.src === 'manual' ? 'Access given by the owner' : p.src === 'coupon' ? 'Access with a coupon' : 'Payment'), h('span', { class: 'chip ' + (p.status === 'paid' ? 'ok' : '') }, p.status), p.amount ? h('span', {}, money(p.amount, p.currency)) : null, h('span', { class: 'muted' }, p.days ? p.days + ' days' : 'lifetime'), h('span', { class: 'grow' }), h('span', { class: 'muted' }, when(p.at)))) : [h('p', { class: 'muted' }, 'No payments or access grants yet.')])); } catch (e) { list.append(h('p', { class: 'muted' }, 'Could not load payments: ' + e.message)); }
      more.hidden = true; return;
    }
    const local = !append ? HIST.load().filter(e => e.kind === st.tab && (!st.q || JSON.stringify(e.data).toLowerCase().includes(st.q.toLowerCase()))).reverse() : [];
    local.forEach(e => list.append(row1(e, true)));
    try {
      const qs = new URLSearchParams({ kind: st.tab, limit: '40' }); if (st.q) qs.set('q', st.q); if (append && st.next) qs.set('before', String(st.next));
      const r = await HIST.call('/events?' + qs); if (!r.ok) throw new Error(r.status === 503 || r.status === 404 ? 'service off' : 'HTTP ' + r.status);
      const j = await r.json(); st.next = j.next; j.events.forEach(e => list.append(row1(e, false)));
      more.hidden = !j.next; if (!j.events.length && !local.length && !append) list.append(h('p', { class: 'muted' }, st.q ? 'Nothing matches that search.' : 'Nothing here yet. Do a lesson, ask the tutor or run some code and it shows up here.'));
    } catch (e) { more.hidden = true; if (!local.length && !append) list.append(h('p', { class: 'muted' }, 'Nothing to show from the account right now (' + e.message + ').')); }
  }
  async function paintSummary() {
    tiles.innerHTML = '';
    try {
      const r = await HIST.call('/summary?tz=' + new Date().getTimezoneOffset()); if (!r.ok) throw new Error('off'); const s = await r.json();
      tiles.append(tile(s.streak, 'day streak'), tile(s.activeDays, 'days active'), tile(s.lessonsDone, 'lessons finished'), tile(s.exercisesPassed, 'exercises passed'), tile((s.byKind || {}).tutor || 0, 'tutor questions'), tile((s.byKind || {}).run || 0, 'code runs'));
      const days = Object.entries(s.days || {}); if (days.length) { const mx = Math.max(...days.map(d => d[1])), W = 12, svg = days.map(([d, n], i) => '<rect x="' + (i * (W + 3)) + '" y="' + (50 - Math.max(3, Math.round(n / mx * 50))) + '" width="' + W + '" height="' + Math.max(3, Math.round(n / mx * 50)) + '" rx="2" fill="#3B3CD6"><title>' + esc(d) + ': ' + n + '</title></rect>').join(''); const c = h('div', { class: 'card pad' }, h('div', { class: 'muted', style: { fontSize: '13px' } }, 'Last 30 days of activity')); const wrap = h('div', {}); wrap.innerHTML = '<svg viewBox="0 0 ' + (days.length * (W + 3)) + ' 52" width="100%" height="64" preserveAspectRatio="none" role="img" aria-label="Activity per day">' + svg + '</svg>'; c.append(wrap); tiles.append(c); }
    } catch (e) { tiles.append(h('p', { class: 'muted' }, 'Totals appear here once the history service is on and your events have uploaded.')); }
  }
  function paintTabs() { tabRow.innerHTML = ''; tabs.forEach(([k, l]) => tabRow.append(h('button', { class: 'btn sm' + (st.tab === k ? ' primary' : ''), type: 'button', onclick: () => { st.tab = k; st.q = ''; search.value = ''; search.hidden = !(k === 'tutor' || k === 'run'); paintTabs(); paintList(false); } }, l))); }
  search.hidden = true; let tm = 0; search.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { st.q = search.value.trim(); paintList(false); }, 350); });
  more.onclick = () => paintList(true);
  const exportBtn = h('button', { class: 'btn', type: 'button', onclick: async () => { try { const r = await HIST.call('/export'); if (!r.ok) throw new Error('not available'); const b = await r.blob(), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'dsquest-history.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } catch (e) { toast('Could not export: ' + e.message); } } }, 'Download everything (JSON)');
  const eraseBtn = h('button', { class: 'btn', type: 'button', onclick: async () => { const w = prompt('This permanently deletes all of your saved history from your account (your progress and access are not touched). Type ERASE to confirm.'); if (w !== 'ERASE') return; try { const r = await HIST.call('/erase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'ERASE' }) }); if (!r.ok) throw new Error('not available'); try { localStorage.removeItem('dsq.histq.' + HIST.user()); } catch (e) { } toast('Your history was erased.'); paintSummary(); paintList(false); paintBanner(); } catch (e) { toast('Could not erase: ' + e.message); } } }, 'Erase my history');
  box.append(banner, tiles, h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, tabRow, h('span', { class: 'grow' }), search), list, more, h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, exportBtn, eraseBtn), h('p', { class: 'muted', style: { fontSize: '12.5px' } }, 'Your history is private to your account. We keep it so you can look back and so the tutor and your progress follow you between devices. You can download or erase it any time.'));
  paintTabs(); paintBanner(); HIST.flush().then(() => { paintBanner(); paintSummary(); }); paintList(false);
  return root;
}
