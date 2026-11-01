'use strict';
/* =====================================================================
   App shell: auth, top bar, hash router, dashboard (roadmap), module page, lesson player,
   project page, arcade, profile, leaderboard, admin
   ===================================================================== */
const App = { root: $('#app'), dis: [], mods: [] };
const dispose = () => { App.dis.forEach(f => { try { f(); } catch (e) { } }); App.dis = []; };

function mergeCurriculum() {
  App.mods = DSQ.roadmap.map(r => { const c = DSQ.modules.find(m => m.id === r.id) || {}; return Object.assign({}, r, c, { live: !!(c.lessons && c.lessons.length), locked: DSQ.isLocked(r.id), free: !!(r.free || API.demo), real: (DSQ.realWorld || {})[r.id] || '' }); });
  DSQ.mods = App.mods;
}
const modById = id => App.mods.find(m => m.id === id);

/* ---------------------------------------------------------------------
   Auth screen
   --------------------------------------------------------------------- */
function authFrame(inner) {
  dispose(); document.body.dataset.view = 'auth'; ['askfab', 'askdock', 'markcv'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); document.body.classList.remove('askopen');
  const chart = '<svg viewBox="0 0 320 200" role="img" aria-label="A bar chart with a rising line"><g fill="none" stroke="#12151C" stroke-width="2"><path d="M30 170H300M30 170V20"/></g><g><rect x="50" y="120" width="34" height="50" fill="#3B3CD6"/><rect x="100" y="95" width="34" height="75" fill="#7C3AED"/><rect x="150" y="70" width="34" height="100" fill="#3B3CD6"/><rect x="200" y="48" width="34" height="122" fill="#7C3AED"/><rect x="250" y="28" width="34" height="142" fill="#3B3CD6"/></g><path d="M40 130 L100 100 L160 84 L220 52 L280 30" fill="none" stroke="#F59E0B" stroke-width="5" stroke-linecap="round"/><g fill="#F59E0B"><circle cx="40" cy="130" r="6"/><circle cx="100" cy="100" r="6"/><circle cx="160" cy="84" r="6"/><circle cx="220" cy="52" r="6"/><circle cx="280" cy="30" r="6"/></g></svg>';
  const hero = h('div', { class: 'hero' }, h('div', { class: 'brand' }, h('i', {}, 'DS'), 'DS ', h('span', { style: { color: '#FFC24D' } }, 'Quest')),
    h('div', {}, h('h1', { html: 'Build AI that works in the <em>real world</em>.' }), h('p', {}, 'Not just data science: how to build production-ready AI systems. Practical skills, not theory. Animated Picture Classes you can turn in 3D, real Python that runs in your browser (even offline), and a project after every module that you can defend.'),
      h('div', { class: 'hero-stage', 'aria-hidden': 'true' }, h('div', { class: 'hero-card', html: chart }))),
    h('div', { class: 'pts' }, h('div', {}, 'We start where the real work is: reading and cleaning data, the flagship module, free to try'), h('div', {}, 'Every number on screen comes from code that was really run and checked'), h('div', {}, 'Works offline. One payment for full access, no subscription')));
  App.root.innerHTML = ''; App.root.append(h('div', { class: 'auth' }, hero, h('div', { class: 'formside' }, h('div', { class: 'box' }, inner))));
}
function showAuth(msg) {
  let mode = 'login';
  const err = h('div', { class: 'errmsg' }, msg || '');
  const u = h('input', { class: 'input', placeholder: 'username or email', autocomplete: 'username', 'aria-label': 'username or email' }), p = h('input', { class: 'input', type: 'password', placeholder: 'password', autocomplete: 'current-password', 'aria-label': 'password' }), d = h('input', { class: 'input', placeholder: 'display name (optional)', hidden: true }), em = h('input', { class: 'input', type: 'email', placeholder: 'email (to reset a forgotten password)', autocomplete: 'email', hidden: true, 'aria-label': 'email' });
  const go = h('button', { class: 'btn primary', type: 'submit', style: { width: '100%', padding: '12px' } }, 'Log in');
  const gr = h('input', { class: 'input', placeholder: 'https://github.com/you/my-ds-projects' }), gt = h('input', { class: 'input', type: 'password', placeholder: 'GitHub token (optional, to auto-push)', autocomplete: 'off' });
  const gitBox = h('details', { hidden: true }, h('summary', { class: 'muted', style: { cursor: 'pointer', fontWeight: 700 } }, 'Connect my own GitHub repo (optional)'), h('div', { class: 'stack', style: { marginTop: '8px' } }, gr, gt, h('small', { class: 'muted' }, 'Finished projects are pushed here. Create an empty repo first; use a fine-grained token with Contents: write for that repo only. You can also add this later in Profile.')));
  const forgot = h('a', { href: '#', class: 'muted', style: { fontSize: '13px' }, onclick: e => { e.preventDefault(); showForgot(u.value); } }, 'Forgot password?');
  const tabs = h('div', { class: 'tabs' }, h('button', { type: 'button', class: 'on', onclick: () => sw('login') }, 'Log in'), h('button', { type: 'button', onclick: () => sw('signup') }, 'Create account'));
  function sw(m) { mode = m; $$('button', tabs).forEach((b, i) => b.classList.toggle('on', (i === 0) === (m === 'login'))); d.hidden = em.hidden = m === 'login'; forgot.hidden = m !== 'login'; gitBox.hidden = m === 'login'; u.placeholder = m === 'login' ? 'username or email' : 'username (3-24 letters, digits, _ . -)'; go.textContent = m === 'login' ? 'Log in' : 'Create my account'; p.autocomplete = m === 'login' ? 'current-password' : 'new-password'; err.textContent = ''; }
  const form = h('form', { class: 'stack', onsubmit: async e => {
    e.preventDefault(); err.textContent = ''; go.disabled = true;
    try { const r = await API.post(mode === 'login' ? '/api/login' : '/api/signup', { username: u.value, password: p.value, display: d.value || u.value, email: mode === 'signup' ? em.value : undefined, gitRemote: mode === 'signup' ? gr.value : undefined, gitToken: mode === 'signup' ? gt.value : undefined }); S.set(r.user, r.state, r.projects, r.judge); API.remember(false); startApp(); }
    catch (ex) { err.textContent = ex.message; } go.disabled = false;
  } }, tabs, h('label', { class: 'f' }, 'USERNAME', u), h('label', { class: 'f', hidden: false }, em), h('label', { class: 'f' }, 'PASSWORD', p), h('label', { class: 'f', hidden: false }, d), gitBox, err, go, forgot,
    API.local ? h('div', { class: 'callout warn' }, h('b', {}, 'Offline mode. '), 'No server could be reached, so your account and progress are saved in THIS browser only.') : null,
    API.demo ? null : h('button', { class: 'btn', type: 'button', style: { width: '100%' }, onclick: () => DSQ.startTour() }, 'Just looking? Take the guided tour (no sign-up)'),
    h('p', { class: 'muted', style: { fontSize: '13px', margin: 0 } }, 'New here? Create an account - your progress, scores and projects are stored on the server so you never start again. Passwords are stored hashed (scrypt), never in plain text.'),
    h('p', { class: 'muted', style: { fontSize: '12.5px', margin: 0 } }, 'By creating an account you agree to the ', h('a', { href: '#/legal/terms', onclick: e => { e.preventDefault(); showLegalPublic('terms'); } }, 'Terms'), ', ', h('a', { href: '#/legal/refund', onclick: e => { e.preventDefault(); showLegalPublic('refund'); } }, 'Refund policy'), ' and ', h('a', { href: '#/legal/privacy', onclick: e => { e.preventDefault(); showLegalPublic('privacy'); } }, 'Privacy policy'), '.'));
  authFrame(h('div', {}, h('h2', { style: { font: '700 1.7rem var(--f-body)' } }, 'Welcome'), form)); u.focus();
}
function showForgot(prefill) {
  const id = h('input', { class: 'input', placeholder: 'your email or username', value: prefill || '', autocomplete: 'username' }), msg = h('div', { class: 'callout', hidden: true }), go = h('button', { class: 'btn primary', type: 'submit', style: { width: '100%', padding: '12px' } }, 'Email me a reset link');
  const form = h('form', { class: 'stack', onsubmit: async e => { e.preventDefault(); go.disabled = true; msg.hidden = true; try { const r = await API.post('/api/forgot', { identifier: id.value }); msg.hidden = false; msg.className = 'callout ' + (r.mailConfigured === false ? 'warn' : 'ok'); msg.textContent = r.message || 'If an account matches, a reset link is on its way.'; } catch (ex) { msg.hidden = false; msg.className = 'callout warn'; msg.textContent = ex.message; } go.disabled = false; } },
    h('p', { class: 'muted', style: { margin: 0 } }, 'Enter the email you signed up with (or your username). We send a link that works for 30 minutes.'), id, go, msg, h('a', { href: '#', class: 'muted', onclick: e => { e.preventDefault(); showAuth(); } }, '← back to log in'));
  authFrame(h('div', {}, h('h2', { style: { font: '700 1.7rem var(--f-body)' } }, 'Forgot your password?'), form)); id.focus();
}
function showReset(token) {
  const p1 = h('input', { class: 'input', type: 'password', placeholder: 'new password (8+ characters)', autocomplete: 'new-password' }), p2 = h('input', { class: 'input', type: 'password', placeholder: 'repeat it', autocomplete: 'new-password' }), err = h('div', { class: 'errmsg' }), go = h('button', { class: 'btn primary', type: 'submit', style: { width: '100%', padding: '12px' } }, 'Set new password');
  const form = h('form', { class: 'stack', onsubmit: async e => { e.preventDefault(); err.textContent = ''; if (p1.value !== p2.value) { err.textContent = 'The two passwords differ.'; return; } go.disabled = true; try { const r = await API.post('/api/reset', { token, password: p1.value }); S.set(r.user, r.state, r.projects, r.judge); location.hash = '#/'; startApp(); } catch (ex) { err.textContent = ex.message; } go.disabled = false; } }, p1, p2, err, go, h('a', { href: '#', class: 'muted', onclick: e => { e.preventDefault(); location.hash = '#/'; showAuth(); } }, '← back to log in'));
  authFrame(h('div', {}, h('h2', { style: { font: '700 1.7rem var(--f-body)' } }, 'Choose a new password'), form)); p1.focus();
}

/* ---------------------------------------------------------------------
   Top bar
   --------------------------------------------------------------------- */
function renderBar() {
  const me = S.me, st = S.st, side = $('#topbar') || h('aside', { id: 'topbar', class: 'side' });
  const groups = [['Learn', [['#/', 'Curriculum'], ['#/library', 'Library'], ['#/practice', 'Practice'], ['#/data', 'Datasets'], ['#/explore', 'Explorer'], ['#/sheets', 'Function sheets'], ['#/notebook', 'Notebook']]], ['Workshop', [['#/graphlab', 'Graph Lab'], ['#/picture', 'Picture Classes'], ['#/projection', '3D Projection'], ['#/lab', 'Labs'], ['#/terminal', 'Terminal'], ['#/arcade', 'Drills'], ['#/jupyter', 'Local Jupyter']]], ['Account', [['#/profile', 'Progress'], ['#/board', 'Ranking'], ['#/buy', me.role === 'admin' ? 'Plan' : 'Full access'], ['#/offline', 'Offline mode']].concat(me.role === 'admin' ? [['#/payments', 'Payments'], ['#/admin', 'Admin']] : [])]];
  side.innerHTML = ''; document.body.classList.add('has-side');
  const menu = h('button', { class: 'side-toggle', type: 'button', 'aria-label': 'Menu', onclick: () => side.classList.toggle('open') }, 'Menu');
  side.append(h('div', { class: 'side-top' }, h('a', { class: 'brand', href: '#/' }, h('i', {}, 'DS'), h('span', {}, 'DS Quest')), menu),
    h('nav', { class: 'nav', onclick: () => side.classList.remove('open') }, groups.map(([t, items]) => h('div', { class: 'grp' }, h('div', { class: 'eyebrow' }, t), items.map(([href, label]) => h('a', { href, 'data-h': href }, label))))),
    h('div', { class: 'grow' }),
    h('div', { class: 'side-foot' },
      h('div', { class: 'sb-prog', title: 'Points accumulate from correct work; the level is a rough progress marker' }, h('div', { class: 'sb-l' }, h('span', { id: 'sb-lvl' }), h('span', { id: 'sb-pts' })), h('div', { class: 'sb-bar' }, h('i', { id: 'sb-bar' })), h('small', { id: 'sb-streak' })),
      h('div', { class: 'pyst', id: 'pyst', title: 'In-browser Python engine' }, h('i'), h('span', {}, 'Python')),
      h('div', { class: 'sb-user' }, h('span', { class: 'avatar' }, (me.display || me.username)[0].toUpperCase()), h('div', { class: 'sb-name' }, h('b', {}, me.display || me.username), h('small', {}, me.role === 'admin' ? 'owner' : 'learner')),
        h('button', { class: 'btn sm', type: 'button', onclick: async () => { await S.flush(); API.forget(); await API.post('/api/logout').catch(() => { }); try { await caches.delete('dsq-private'); } catch (e) { } S.me = null; showAuth(); } }, 'Log out'))));
  if (!side.parentNode) App.root.before(side);
  DSQ.refreshBar = () => {
    const x = st.xp, lv = st.level, lo = xpAt(lv), hi = xpAt(lv + 1), l = $('#sb-lvl'); if (!l) return;
    l.textContent = 'Level ' + lv + ' · ' + rankOf(lv); $('#sb-pts').textContent = x + ' pts'; $('#sb-bar').style.width = Math.round(100 * (x - lo) / (hi - lo)) + '%';
    $('#sb-streak').textContent = st.streak.n ? 'Study streak: ' + st.streak.n + ' day' + (st.streak.n === 1 ? '' : 's') : '';
  };
  DSQ.refreshBar();
  Py.on(p => { const el = $('#pyst'); if (!el) return; el.className = 'pyst ' + (p.state === 'ready' ? 'ready' : p.state === 'err' ? 'err' : 'loading'); $('span', el).textContent = p.state === 'ready' ? 'Python ready' : p.state === 'err' ? 'Python offline' : 'Python ' + p.pct + '%'; el.title = p.text; });
}
function markNav() { $$('#topbar nav a').forEach(a => { const h0 = a.dataset.h; a.classList.toggle('on', h0 === '#/' ? /^#?\/?$/.test(location.hash) || /^#\/(m|l|p|b)\//.test(location.hash) : location.hash.startsWith(h0)); }); }

/* ---------------------------------------------------------------------
   Router
   --------------------------------------------------------------------- */
async function startApp() {
  await DSQ.loadPremium();
  setTimeout(() => syncNotebook(), 1500);
  document.body.dataset.view = 'app'; mergeCurriculum(); renderBar(); Py.start(); initAsk(); DSQ.mountTour();
  if (!S.st.pace) S.st.pace = 'steady';
  window.onhashchange = route; if (!S.st.seenIntro && (!location.hash || location.hash === '#/')) location.hash = '#/intro'; route();
}
function route() {
  dispose(); const hsh = location.hash.replace(/^#/, '') || '/', parts = hsh.split('/').filter(Boolean);
  const view = (parts[0] || ''); markNav(); window.scrollTo(0, 0);
  const main = h('main'); App.root.innerHTML = ''; App.root.append(main);
  try {
    if (view === '') main.append(viewDashboard());
    else if (view === 'm') main.append(viewModule(parts[1]));
    else if (view === 'l') main.append(viewLesson(parts[1], parts[2]));
    else if (view === 'b') main.append(viewBoss(parts[1]));
    else if (view === 'p') main.append(viewProject(parts[1]));
    else if (view === 'lab') main.append(viewLab(parts[1]));
    else if (view === 'intro') main.append(viewIntro());
    else if (view === 'library') main.append(viewLibrary());
    else if (view === 'jupyter') main.append(viewJupyter(parts));
    else if (view === 'data') main.append(viewData(parts));
    else if (view === 'terminal') main.append(viewTerminal());
    else if (view === 'studio') main.append(viewStudio());
    else if (view === 'explore') main.append(viewExplore(parts));
    else if (view === 'notebook') main.append(viewNotebook(parts));
    else if (view === 'practice') main.append(viewPractice(parts[1]));
    else if (view === 'world') { location.replace('#/'); }
    else if (view === 'world-old') main.append(h('div', { class: 'stack' }, h('div', { class: 'page-h' }, h('div', {}, h('h1', { html: 'The <em>World</em>' }), h('p', { class: 'muted' }, 'Jump straight to any module with the cards, or walk the street and enter a building.'))), moduleCards(), viewWorld()));
    else if (view === 'arcade') main.append(viewArcade());
    else if (view === 'profile') main.append(viewProfile());
    else if (view === 'board') main.append(viewBoard());
    else if (view === 'offline') main.append(viewOffline());
    else if (view === 'sheets') main.append(viewSheets());
    else if (view === 'sheet') main.append(viewSheet(parts[1]));
    else if (view === 'buy') main.append(viewBuy());
    else if (view === 'graphlab') main.append(viewGraphLab());
    else if (view === 'picture') main.append(viewPicture(parts[1], parts[2]));
    else if (view === 'projection') main.append(viewProjection());
    else if (view === 'legal') legalPage(main, parts[1]);
    else if (view === 'payments' && S.me.role === 'admin') main.append(viewPayments());
    else if (view === 'admin' && S.me.role === 'admin') main.append(viewAdmin());
    else main.append(viewDashboard());
  } catch (e) { console.error(e); main.append(h('div', { class: 'card pad' }, 'Something went wrong showing this page: ' + e.message)); }
}

/* ---------------------------------------------------------------------
   Dashboard / roadmap
   --------------------------------------------------------------------- */
function nextStep() {
  const st = S.st;
  for (const m of App.mods.filter(x => x.live)) {
    { const g = gate(m); if (!g.open) return { m: g.prev, label: g.prev.title + ' practice', sub: g.bossOk ? `Raise your mastery score (${Math.round((g.score || 0) * 100)}%) to 70% to unlock ${m.title}` : `Pass the assessment quiz (70%) to unlock ${m.title}`, href: g.bossOk ? '#/practice/' + g.prev.id : '#/b/' + g.prev.id }; }
    const L = m.lessons.find(l => !S.lessonDone(m.id + '/' + l.id));
    if (L) return { m, label: (S.moduleProgress(m) === 0 ? 'Start ' : 'Continue ') + m.title, sub: `Lesson: ${L.title} (${L.minutes} min)`, href: `#/l/${m.id}/${L.id}` };
    const b = st.boss[m.id];
    if (!b || b.best < .7) return { m, label: m.title + ' module assessment', sub: 'Pass the assessment (70%) to unlock your project', href: `#/b/${m.id}` };
    if (m.project && !(st.proj[m.id] && st.proj[m.id].published)) return { m, label: m.title + ' project', sub: 'Build something real and publish it', href: `#/p/${m.id}` };
  }
  return null;
}
/* ---- grade gate: a module opens when the previous playable module's module assessment is passed (70%), or after 5 attempts ---- */
const MAX_TRIES = 5;
function gate(m) {
  if (!S.me || S.me.role === 'admin') return { open: true };
  if (m.free) return { open: true }; const live = visibleMods().filter(x => x.live && !x.free), i = live.findIndex(x => x.id === m.id); if (i <= 0) return { open: true };
  const p = live[i - 1]; if (!p.boss || !p.boss.length) return { open: true };
  const b = S.st.boss[p.id] || { best: 0, n: 0 }, ms = masteryOf(p);
  if (b.best >= .7 && ms.score >= .7) return { open: true };
  if (b.n >= MAX_TRIES) return { open: true, auto: true, prev: p };
  return { open: false, prev: p, left: MAX_TRIES - b.n, best: b.best, n: b.n, score: ms.score, bossOk: b.best >= .7 };
}
function lockCard(g, m) {
  return h('div', { class: 'card pad stack' }, h('h2', {}, m.title + ' is locked'),
    h('p', {}, 'Each module builds on the one before it. Reach a ', h('b', {}, '70% mastery score'), ' in ', h('b', {}, g.prev.title), ' to open it: the module assessment (70% needed) averaged with your recent practice answers' + (g.n ? ` (assessment best ${Math.round(g.best * 100)}%, mastery now ${Math.round((g.score || 0) * 100)}%, ${g.n} of ${MAX_TRIES} assessment attempts used)` : '') + '.'),
    h('p', { class: 'muted' }, `Not there yet? After ${MAX_TRIES} attempts the next module opens anyway - ${g.left} left. Before each new attempt you re-do the lessons, because that is where the learning happens.`),
    h('div', { class: 'row' }, h('a', { class: 'btn primary', href: g.bossOk ? '#/practice/' + g.prev.id : '#/b/' + g.prev.id }, g.bossOk ? 'Practise ' + g.prev.title + ' to raise your score' : 'Go to the ' + g.prev.title + ' module assessment'), h('a', { class: 'btn', href: '#/practice/' + g.prev.id }, 'Unlimited practice'), h('a', { class: 'btn', href: '#/m/' + g.prev.id }, 'Review ' + g.prev.title)));
}
const PACES = { sprint: [13, 'Sprint (3 months)'], steady: [26, 'Steady (6 months)'], relaxed: [39, 'Relaxed (9 months)'] };
function moduleCards() {
  const st = S.st, box = h('div', { class: 'stack' });
  DSQ.phases.forEach(ph => {
    const mods = visibleMods().filter(m => m.phase === ph.id); if (!mods.length) return;
    box.append(h('section', { class: 'phase' }, h('h3', {}, h('span', {}, 'Phase ' + ph.id), ph.name, h('small', { style: { textTransform: 'none', letterSpacing: 0, fontWeight: 600 } }, ph.blurb)),
      h('div', { class: 'mods' }, mods.map(m => {
        const pr = m.live ? S.moduleProgress(m) : 0, done = m.live && pr >= 1 && st.proj[m.id] && st.proj[m.id].published;
        return h('a', { class: 'card mod' + (m.live ? '' : ' planned') + (done ? ' done' : ''), href: '#/m/' + m.id },
          h('span', { class: 'ic', style: { background: colv(m.color) } }, m.icon), m.flagship ? h('span', { class: 'chip flag flagcard' }, '★ Flagship: the 70%') : null, h('h4', {}, m.title), h('p', {}, m.blurb),
          m.live ? h('div', { class: 'bar' }, h('i', { style: { width: Math.round(pr * 100) + '%' } })) : null,
          h('span', { class: 'badge chip ' + (m.live ? (done ? 'ok' : 'brand') : '') }, m.live ? (!gate(m).open ? 'locked' : done ? 'complete' : Math.round(pr * 100) + '%') : (m.locked ? 'Paid access' : m.hours + ' h')));
      }))));
  });
  return box;
}
function countUp(el, to, fmt) { const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; if (reduce || !to) { el.textContent = fmt(to); return; } const t0 = performance.now(); (function f(now) { const t = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - t, 3); el.textContent = fmt(to * e); if (t < 1) requestAnimationFrame(f); })(t0); }
function viewDashboard() {
  const st = S.st, root = h('div', { class: 'dash' }), nx = nextStep(), totalH = sum(App.mods.map(m => m.hours)), live = App.mods.filter(m => m.live);
  const lessonsAll = sum(live.map(m => m.lessons.length)), lessonsDone = live.reduce((n, m) => n + m.lessons.filter(l => S.lessonDone(m.id + '/' + l.id)).length, 0), solved = Object.values(st.ex).filter(e => e.pass).length;
  const passed = live.filter(m => { const b = st.boss[m.id]; return b && b.best >= .7; }).length, ms = live.map(masteryOf).filter(x => x.boss > 0), mast = ms.length ? sum(ms.map(x => x.score)) / ms.length : null;
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Curriculum'), h('h1', {}, trackHeading()), h('p', { class: 'muted lead' }, `Welcome back, ${S.me.display}. ${live.length} of ${App.mods.length} modules are available now; ${App.mods.some(m => m.locked) ? App.mods.filter(m => m.locked).length + ' more are part of paid access, and the rest' : 'the others'} show their syllabus and open as they are built. Each module ends with an assessment, a project and practice you can run in your own Jupyter.`))));
  const metric = (label, val, fmt, sub) => { const n = h('b', { class: 'num' }, fmt(0)); setTimeout(() => countUp(n, val, fmt), 60); return h('div', { class: 'metric' }, h('small', { class: 'eyebrow' }, label), n, h('span', { class: 'muted' }, sub)); };
  root.append(h('div', { class: 'dash-top' },
    h('div', { class: 'card pad cont' }, h('div', { class: 'eyebrow' }, nx ? 'Continue' : 'Up to date'), nx ? [h('h2', {}, nx.label), h('p', { class: 'muted' }, nx.sub), h('div', { class: 'row' }, h('a', { class: 'btn primary', href: nx.href }, 'Continue'), h('a', { class: 'btn', href: '#/practice' }, 'Practice'))] : [h('h2', {}, 'Everything available is complete'), h('p', { class: 'muted' }, 'More modules are in preparation. Keep your skills sharp with practice and drills.'), h('a', { class: 'btn primary', href: '#/practice' }, 'Open practice')]),
    h('div', { class: 'metrics card' }, metric('Lessons completed', lessonsAll ? lessonsDone / lessonsAll * 100 : 0, v => Math.round(v) + '%', `${lessonsDone} of ${lessonsAll}`), metric('Assessments passed', passed, v => Math.round(v) + ' / ' + live.length, '70% to pass'), metric('Exercises solved', solved, v => String(Math.round(v)), 'graded by tests'), metric('Mastery', mast == null ? 0 : mast * 100, v => (mast == null ? '–' : Math.round(v) + '%'), 'assessment + practice'))));
  root.append(uvpCard(), trackBar());
  root.append(h('section', { class: 'card pad' }, h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'wrap' } }, h('h3', { style: { margin: 0 } }, 'Learning path'), h('span', { class: 'muted', style: { fontSize: '13px' } }, 'Select a station to open the module.')), viewWorld()));
  root.append(h('div', { class: 'row tools' }, h('span', { class: 'eyebrow' }, 'Tools'), h('a', { class: 'btn sm', href: '#/intro' }, 'Overview (2 min)'), h('a', { class: 'btn sm', href: '#/lab/clean' }, 'Cleaning lab'), h('a', { class: 'btn sm', href: '#/lab' }, 'Data lab'), h('a', { class: 'btn sm', href: '#/lab/math' }, 'Maths and statistics labs'), h('a', { class: 'btn sm', href: '#/lab/mydata' }, 'Your own data')));
  const wk = PACES[st.pace || 'steady'][0], perWeek = totalH / wk;
  const plan = h('details', { class: 'card pad' }, h('summary', { style: { cursor: 'pointer', font: '600 14px var(--f-body)' } }, `Study plan: about ${Math.round(totalH)} hours in total, ${perWeek.toFixed(1)} hours a week at the ${PACES[st.pace || 'steady'][1]} pace`));
  const pc = h('div', { class: 'pace', style: { margin: '12px 0' } }, Object.entries(PACES).map(([k, [, t]]) => h('button', { type: 'button', class: (st.pace || 'steady') === k ? 'on' : '', onclick: () => { st.pace = k; S.save(); route(); } }, t)));
  let acc = 0; const rows = App.mods.map(m => { const a = acc / totalH * wk, b = (acc + m.hours) / totalH * wk; acc += m.hours; return h('tr', {}, h('td', {}, 'Week ' + (Math.floor(a) + 1) + (Math.ceil(b) > Math.floor(a) + 1 ? '-' + Math.ceil(b) : '')), h('td', {}, m.title), h('td', {}, m.hours + ' h'), h('td', {}, m.live ? h('span', { class: 'chip ok' }, 'available') : h('span', { class: 'chip' }, 'syllabus'))); });
  plan.append(pc, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['When', 'Module', 'Time', 'Status'].map(x => h('th', {}, x)))), h('tbody', {}, rows)), h('p', { class: 'muted', style: { fontSize: '13px' } }, 'Hours estimate lesson, exercise and project time. Going faster is fine.'));
  root.append(plan, h('h3', { class: 'sec-h' }, 'All modules'), moduleCards());
  return root;
}

/* ---------------------------------------------------------------------
   Module page
   --------------------------------------------------------------------- */
function nbCard(m) {
  const stat = h('span', { class: 'chip' }, JUP.conn ? 'connected?' : 'not connected');
  JUP.probe().then(ok => { stat.className = 'chip ' + (ok ? 'ok' : 'warn'); stat.textContent = ok ? 'Jupyter connected' : (JUP.conn ? 'Jupyter not running' : 'not connected'); });
  return h('div', { class: 'card pad stack' }, h('div', { class: 'row' }, h('h3', { style: { margin: 0 } }, 'Practice in Jupyter'), stat),
    h('p', { class: 'muted', style: { margin: 0, fontSize: '13px' } }, 'Opens your own JupyterLab right beside the lessons. Answer in a fill-in-the-blank notebook or a blank page; the checker runs in the notebook and solved questions count here.'),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { S.st.nbDl = S.st.nbDl || {}; S.st.nbDl[m.id] = true; S.save(); openJupyter(m.id); } }, 'Open beside the lessons'), h('a', { class: 'btn sm', href: '#/jupyter' }, 'Set up / connect')),
    h('a', { class: 'muted', style: { fontSize: '12px', cursor: 'pointer' }, href: '#', onclick: e => { e.preventDefault(); DSQ.downloadNotebook(m.id); } }, 'no Jupyter yet? download the notebook file instead'));
}
function viewModule(id) {
  const m = modById(id); if (!m) return h('div', { class: 'card pad' }, 'Unknown module.');
  const st = S.st, root = h('div', { class: 'stack' });
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('a', { href: '#/', class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← Curriculum'), h('h1', { style: { marginTop: '6px' } }, m.title), h('p', { class: 'muted', style: { margin: '4px 0 0', maxWidth: '70ch' } }, m.blurb), m.real ? h('div', { class: 'realnote' }, h('b', {}, 'In the real world: '), m.real) : null), h('div', { class: 'row' }, m.flagship ? h('span', { class: 'chip flag' }, '★ Flagship') : null, (typeof PIC !== 'undefined' && PIC.forModule(m.id).length) ? h('a', { class: 'btn sm', href: '#/picture/m/' + m.id }, 'Picture Classes (' + PIC.forModule(m.id).length + ')') : null, m.sheet ? h('a', { class: 'btn sm primary', href: '#/sheet/' + m.id }, 'Function sheet') : null, h('span', { class: 'chip' }, m.hours + ' h'), h('span', { class: 'chip brand' }, 'Phase ' + m.phase))));
  if (!m.live) {
    root.append(h('div', { class: 'layout2' }, h('div', { class: 'card pad stack' }, h('h3', {}, 'What this module will teach'), h('ul', { class: 'syl' }, m.syllabus.map(s => h('li', {}, s))), m.locked ? h('div', { class: 'callout warn' }, h('a', { class: 'btn sm primary', href: '#/buy', style: { float: 'right', marginLeft: '10px' } }, 'See full access'), h('b', {}, 'Paid access: '), 'the lessons, exercises, assessment and notebooks of this module are part of paid access' + (DSQ.premium.loaded ? ' and are not included in this account yet.' : '. Sign in with an account that has access to open them.')) : h('div', { class: 'callout warn' }, h('b', {}, 'Status: '), 'the playable version of this module (interactive lessons, graded exercises, module assessment and personal projects) is next in the build order. Finish the earlier modules first - they are the foundation.')),
      h('div', { class: 'card pad stack' }, h('h3', {}, 'Capstone project'), h('p', {}, m.capstone), h('p', { class: 'muted' }, 'Like every module, you will get a project variant that is different from other learners\'.'))));
    return root;
  }
  { const g = gate(m); if (!g.open) { root.append(lockCard(g, m)); return root; } if (g.auto) root.append(h('div', { class: 'callout' }, h('b', {}, 'Opened after ' + MAX_TRIES + ' attempts. '), 'You can still go back and beat the ' + g.prev.title + ' module assessment whenever you like.')); }
  const lessons = h('div', { class: 'lessons' }, m.lessons.map((l, i) => { const done = S.lessonDone(m.id + '/' + l.id); return h('a', { class: 'card lrow' + (done ? ' done' : ''), href: `#/l/${m.id}/${l.id}` }, h('span', { class: 'num' }, done ? '✓' : i + 1), h('div', { class: 'grow' }, h('h4', {}, l.title), h('small', {}, l.blurb)), h('span', { class: 'chip' }, l.minutes + ' min')); }));
  const allDone = m.lessons.every(l => S.lessonDone(m.id + '/' + l.id)), boss = st.boss[m.id], bossOk = boss && boss.best >= .7, pub = st.proj[m.id] && st.proj[m.id].published;
  const v = m.project && DSQ.Proj.variantFor(m, S.me.username, S.me.tier);
  const side = h('div', { class: 'stack' },
    h('div', { class: 'card pad stack' }, h('h3', {}, 'You will be able to'), h('ul', { style: { margin: 0, paddingLeft: '20px' } }, (m.outcomes || []).map(o => h('li', {}, o)))),
    h('div', { class: 'card pad stack' }, h('div', { class: 'row' }, h('h3', {}, 'Module assessment'), bossOk ? h('span', { class: 'chip ok' }, 'passed ' + Math.round(boss.best * 100) + '%') : h('span', { class: 'chip' }, allDone ? 'ready' : 'after lessons')), h('p', { class: 'muted', style: { margin: 0 } }, '10 questions, different numbers every attempt. 70% unlocks your project.'), h('a', { class: 'btn', href: '#/b/' + m.id }, bossOk ? 'Play again' : 'Start the assessment')),
    v ? h('div', { class: 'card pad stack' }, h('div', { class: 'row' }, h('h3', {}, 'Your project'), S.me.tier === 'flagship' ? h('span', { class: 'edition' }, '★ Flagship') : null, pub ? h('span', { class: 'chip ok' }, 'published') : null),
      h('b', {}, bossOk || S.me.role === 'admin' ? v.title : 'Locked until you beat the module assessment'), h('p', { class: 'muted', style: { margin: 0 } }, bossOk || S.me.role === 'admin' ? v.pitch : 'Every learner gets a different project, built on a dataset generated for them.'), bossOk || S.me.role === 'admin' ? h('a', { class: 'btn primary', href: '#/p/' + m.id }, pub ? 'Open project' : 'Start project') : h('button', { class: 'btn', disabled: true }, 'Locked')) : null);
  if (m.lessons.some(l => l.pages.some(pg => pg.t === 'ex'))) { const ms = masteryOf(m); side.append(h('div', { class: 'card pad stack' }, h('div', { class: 'row' }, h('h3', { style: { margin: 0 } }, 'Mastery'), h('span', { class: 'chip ' + (ms.score >= .7 ? 'ok' : 'warn') }, Math.round(ms.score * 100) + '%')), h('div', { class: 'meter' }, h('i', { style: { width: Math.round(ms.score * 100) + '%' } })), h('p', { class: 'muted', style: { margin: 0, fontSize: '13px' } }, `Module assessment ${Math.round(ms.boss * 100)}%` + (ms.prac == null ? '; answer 5 practice questions to count practice too.' : ` + practice ${Math.round(ms.prac * 100)}% (last ${ms.pn}). 70% opens the next module.`)), h('a', { class: 'btn', href: '#/practice/' + m.id }, 'Unlimited practice (new blanks every time)')), nbCard(m)); }
  root.append(h('div', { class: 'layout2' }, h('div', { class: 'stack' }, h('h3', { style: { font: '700 1.2rem var(--f-body)' } }, 'Lessons'), lessons), side));
  return root;
}

/* ---------------------------------------------------------------------
   Lesson player
   --------------------------------------------------------------------- */
function demoBlock(pg) {
  const root = h('div', { class: 'stack' });
  if (pg.html) root.append(h('div', { class: 'prose', html: pg.html }));
  const ed = Editor(root, { code: pg.code, minLines: 5, onRun: () => run(), onChange: () => { if (live.checked) { clearTimeout(tm); tm = setTimeout(run, 900); } } });
  const live = h('input', { type: 'checkbox' }), outp = outputPane(root); outp.clear(); let tm, busy = false;
  const btn = h('button', { class: 'btn primary', type: 'button', onclick: () => run() }, '▶ Run (Ctrl+Enter)');
  root.insertBefore(h('div', { class: 'row' }, btn, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { ed.set(pg.code); outp.clear(); } }, 'Reset'), h('label', { class: 'sw', title: 'Re-run when you pause typing - plots redraw as you code' }, live, 'Live sketch'), h('span', { class: 'muted', style: { fontSize: '13px' } }, 'Edit the code - it is yours to play with.')), ed.el);
  attachTutor(root, () => ed.get(), { files: () => pg.files || {} });
  if (pg.live) live.checked = true;
  async function run() { if (busy) return; busy = true; btn.disabled = true; outp.clear('Running...'); const r = await Py.run({ code: ed.get(), files: pg.files || {} }); busy = false; btn.disabled = false; outp.show(r, { checks: false }); DSQ.S.log({ type: 'demo', ok: !r.error }); DSQ.S.save(); }
  return root;
}

function renderPage(pg, L, next) {
  const box = h('div', { class: 'page' }); const eye = h('small', {}, L.title);
  if (pg.t === 'read') box.append(h('h2', {}, eye, pg.h), h('div', { class: 'prose', html: pg.html }));
  if (pg.t === 'viz') { box.append(h('h2', {}, eye, pg.h)); if (pg.html) box.append(h('div', { class: 'prose', html: pg.html })); const v = mountViz(pg); box.append(v); App.dis.push(() => v._destroy && v._destroy()); }
  if (pg.t === 'demo') box.append(h('h2', {}, eye, pg.h), demoBlock(pg));
  if (pg.t === 'ex') { box.append(h('h2', {}, eye, pg.ex.title)); box.append(exerciseBlock(pg.ex, { onPass: () => { next && next(); } })); }
  if (pg.t === 'term') { box.append(h('h2', {}, eye, pg.ex.title)); box.append(termBlock(pg.ex, { onPass: () => { next && next(); } })); }
  if (pg.t === 'quiz') box.append(h('h2', {}, eye, pg.h || 'Quick check'), quizBlock(pg.items, { tag: pg.tag, count: Math.min(pg.items.length, 4) }));
  if (pg.t === 'type') box.append(h('h2', {}, eye, 'Typing sprint'), typingBlock(pg.snip));
  return box;
}

function viewLesson(mid, lid) {
  const m = modById(mid), L = m && m.lessons && m.lessons.find(l => l.id === lid); if (!L) return h('div', { class: 'card pad' }, 'Lesson not found.');
  { const g = gate(m); if (!g.open) return lockCard(g, m); }
  const key = m.id + '/' + L.id, st = S.st, root = h('div'), t0 = Date.now(); st.seen = st.seen || {};
  let i = Math.min(st.seen[key] || 0, L.pages.length), maxSeen = st.seen[key] || 0;
  const pbar = h('div', { class: 'pbar' }), top = h('div', { class: 'lp-top' }, h('a', { class: 'btn ghost sm', href: '#/m/' + m.id }, '✕ Exit'), pbar, h('button', { class: 'btn sm', type: 'button', title: 'Open your own Jupyter beside this lesson', onclick: () => openJupyter(m.id) }, 'Jupyter ▸'), h('span', { class: 'chip' }, L.minutes + ' min'));
  const stage = h('div'), nav = h('div', { class: 'lp-nav' });
  root.append(top, stage, nav);
  let disp = [];
  /* reaching the last page (and finishing it, when it is an exercise) completes the lesson: no extra Finish click needed */
  function completeNow() { if (!S.lessonDone(key)) { st.lessons[key] = { at: Date.now() }; S.award(30, 'Lesson complete'); confetti(120); S.log({ type: 'lesson', id: key }); S.save(); } }
  function draw() {
    stage.innerHTML = ''; App.dis.forEach(f => f()); App.dis = []; maxSeen = Math.max(maxSeen, i); st.seen[key] = maxSeen; S.save();
    pbar.innerHTML = ''; L.pages.forEach((p, k) => pbar.append(h('i', { class: (k < i || S.lessonDone(key) ? 'done' : '') + (k === i ? ' cur' : ''), title: p.h || (p.ex && p.ex.title) || p.t, onclick: () => { if (k <= maxSeen) { i = k; draw(); } } })));
    nav.innerHTML = '';
    if (i >= L.pages.length) { stage.append(recap()); nav.append(h('a', { class: 'btn', href: '#/m/' + m.id }, 'Back to module')); const nl = m.lessons[m.lessons.indexOf(L) + 1]; nav.append(nl ? h('a', { class: 'btn primary', href: `#/l/${m.id}/${nl.id}` }, 'Next lesson: ' + nl.title + ' ▸') : h('a', { class: 'btn primary', href: '#/b/' + m.id }, 'Module assessment ▸')); return; }
    const pg = L.pages[i], last = i === L.pages.length - 1, unsolved = (pg.t === 'ex' || pg.t === 'term') && !S.exDone(pg.ex.id);
    const fwd = h('button', { class: 'btn primary', type: 'button', onclick: () => { i++; draw(); window.scrollTo(0, 0); } }, unsolved ? 'Skip for now ▸' : (last ? 'Finish lesson ▸' : 'Continue ▸'));
    stage.append(renderPage(pg, L, () => { fwd.textContent = last ? 'Finish lesson ▸' : 'Continue ▸'; if (last) completeNow(); }));
    if (last && !unsolved) completeNow();
    nav.append(h('button', { class: 'btn', type: 'button', disabled: i === 0, onclick: () => { i--; draw(); } }, '◀ Back'), h('span', { class: 'muted', style: { alignSelf: 'center', fontSize: '13px' } }, `${i + 1} / ${L.pages.length}`), fwd);
  }
  function recap() {
    { const b = st.boss[m.id]; if (b && b.need) { const need = Math.min(90, L.pages.length * 6), el = (Date.now() - t0) / 1000; b.rev = b.rev || {}; if (el >= need || (st.seen[key] || 0) < 0) { b.rev[key] = true; S.save(); } else toast('Review counts after about ' + Math.ceil(need - el) + ' more seconds in this lesson - read it properly this time.'); } }
    completeNow();
    return h('div', { class: 'page' }, h('h2', {}, h('small', {}, 'Lesson complete'), L.title), h('div', { class: 'card pad stack' }, h('h3', {}, 'What you can do now'), h('ul', { class: 'prose', html: (L.recap || []).map(x => `<li>${inl(x)}</li>`).join('') })));
  }
  draw(); return root;
}

/* module assessment */
function viewBoss(mid) {
  const m = modById(mid); if (!m || !m.boss || !m.boss.length) return h('div', { class: 'card pad' }, 'No module assessment for this module yet.');
  { const g = gate(m); if (!g.open) return lockCard(g, m); }
  const bs = S.st.boss[m.id];
  if (bs && bs.need && S.me.role !== 'admin') {
    bs.rev = bs.rev || {}; const left = m.lessons.filter(l => !bs.rev[m.id + '/' + l.id]);
    if (left.length) return h('div', { class: 'card pad stack' }, h('h2', {}, 'Re-do the lessons before the next attempt'),
      h('p', {}, `Attempt ${bs.n + 1} of ${MAX_TRIES} (best so far ${Math.round(bs.best * 100)}%). Go through each lesson below again, all the way to its last page. The module assessment opens when every one is ticked.`),
      h('div', { class: 'stack' }, m.lessons.map(l => h('a', { class: 'card lrow' + (bs.rev[m.id + '/' + l.id] ? ' done' : ''), href: `#/l/${m.id}/${l.id}` }, h('span', { class: 'num' }, bs.rev[m.id + '/' + l.id] ? '✓' : '·'), h('div', { class: 'grow' }, h('h4', {}, l.title), h('small', {}, bs.rev[m.id + '/' + l.id] ? 'reviewed' : 'to review'))))),
      h('p', { class: 'muted' }, bs.n >= MAX_TRIES - 1 ? 'This is your last attempt; the next module opens after it either way.' : `After ${MAX_TRIES} attempts the next module opens even without 70%.`));
  }
  const root = h('div', { class: 'stack' }); root.append(h('div', { class: 'page-h' }, h('div', {}, h('a', { href: '#/m/' + m.id, class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← ' + m.title), h('h1', { style: { marginTop: '6px' } }, 'Module assessment'), h('p', { class: 'muted' }, 'Ten questions mixing everything in this module. Numbers change each attempt.'))));
  root.append(quizBlock(m.boss, { tag: m.id, boss: true, count: 10, pass: .7, onDone: () => { location.hash = '#/m/' + m.id; } })); return root;
}

/* project */
function viewProject(mid) {
  const m = modById(mid); if (!m || !m.project) return h('div', { class: 'card pad' }, 'No project here yet.');
  { const g = gate(m); if (!g.open) return lockCard(g, m); }
  const b = S.st.boss[m.id], ok = (b && b.best >= .7) || S.me.role === 'admin';
  if (!ok) return h('div', { class: 'card pad stack' }, h('h2', {}, 'Project locked'), h('p', {}, 'Beat the ' + m.title + ' module assessment (70%) to unlock it.'), h('a', { class: 'btn primary', href: '#/b/' + m.id }, 'Go to the module assessment'));
  const wrap = h('div', { class: 'stack' }); let variantId = null;
  const draw = () => {
    wrap.innerHTML = ''; wrap.append(h('div', { class: 'page-h' }, h('div', {}, h('a', { href: '#/m/' + m.id, class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← ' + m.title), h('h1', { style: { marginTop: '6px' } }, 'Module project'))));
    let other = null; if (S.me.role === 'admin') other = h('div', { class: 'row' }, h('span', { class: 'muted mono', style: { fontSize: '12px' } }, 'ADMIN: preview any variant'), h('select', { class: 'input', style: { width: 'auto' }, onchange: e => { variantId = e.target.value; draw(); } }, m.project.variants.map(v => h('option', { value: v.id, selected: v.id === variantId }, v.id + (v.flagship ? ' (flagship pick)' : '')))));
    wrap.append(projectView(m, { variantId, otherVariants: other }));
  };
  draw(); return wrap;
}


/* ---------------------------------------------------------------------
   Lab: Data Lab (drag points, 2-D <-> 3-D, algorithms react) and Pipeline Lab (n8n-style blocks -> Python)
   --------------------------------------------------------------------- */
function viewLibrary() {
  const st = S.st, root = h('div', { class: 'stack' }), q = h('input', { type: 'text', class: 'input', placeholder: 'Filter: matrix, pandas, rag, confusion, derivative...', style: { maxWidth: '26em' } }), list = h('div', { class: 'stack' });
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('h1', { html: 'The <em>Library</em>' }), h('p', { class: 'muted', style: { maxWidth: '75ch' } }, 'Everything in one place. Jump straight to any lesson, any labs, any module assessment or project - in any order, any time. Prerequisites are suggested, never forced.'))), q);
  const labs = [['#/lab/clean', 'Cleaning Lab', 'table + chart + code + notes for every cleaning step'], ['#/lab/data', 'Data Lab', 'drag points, 2-D <-> 3-D, k-means / regression / PCA / k-NN'], ['#/lab/math', 'Math & stats labs', 'matrices, determinants, derivatives, integrals, gradient descent, TP/TN/FP/FN, ROC, CLT'], ['#/lab/mydata', 'Your data', 'upload a CSV or fetch one by URL and clean it'], ['#/lab/pipe', 'Pipeline Lab', 'n8n-style blocks that turn into Python'], ['#/arcade', 'Drills', 'typing sprint, data practice, mixed review'], ['#/practice', 'Unlimited practice', 'fresh fill-in-the-blank questions from what you learned'], ['#/jupyter', 'Your Jupyter', 'practice notebooks beside the lessons']];
  const draw = () => {
    const f = q.value.trim().toLowerCase(), hit = (...t) => !f || t.join(' ').toLowerCase().includes(f); list.innerHTML = '';
    const lb = labs.filter(l => hit(l[1], l[2])); if (lb.length) list.append(h('div', { class: 'card pad stack' }, h('h3', {}, 'Labs and practice'), h('div', { class: 'row', style: { flexWrap: 'wrap' } }, lb.map(l => h('a', { class: 'btn sm', href: l[0], title: l[2] }, l[1])))));
    [...new Set(App.mods.map(m => m.phase))].sort((a, b) => a - b).forEach(ph => {
      const ms = App.mods.filter(m => m.phase === ph); const cards = ms.map(m => {
        const ls = (m.lessons || []).filter(L => hit(m.title, L.title, L.blurb, m.blurb)); if (!ls.length && !hit(m.title, m.blurb)) return null;
        return h('div', { class: 'card pad stack' }, h('div', { class: 'row' }, h('a', { href: '#/m/' + m.id, style: { fontWeight: 800, textDecoration: 'none' } }, m.title), m.live ? h('span', { class: 'chip ok' }, 'playable') : h('span', { class: 'chip' }, 'syllabus'), h('span', { class: 'grow' }), m.live ? [h('a', { class: 'btn sm ghost', href: '#/b/' + m.id }, 'Module assessment'), m.project ? h('a', { class: 'btn sm ghost', href: '#/p/' + m.id }, 'Project') : null] : null),
          h('p', { class: 'muted', style: { margin: 0, fontSize: '13px' } }, m.blurb), m.live ? h('div', { class: 'row', style: { flexWrap: 'wrap' } }, ls.map(L => h('a', { class: 'chip', href: '#/l/' + m.id + '/' + L.id }, L.title))) : null);
      }).filter(Boolean); if (cards.length) list.append(h('h3', { style: { margin: '12px 0 0' } }, (DSQ.phases.find(x => x.id === ph) || { name: 'Phase ' + ph }).name), ...cards);
    });
    if (!list.children.length) list.append(h('p', { class: 'muted' }, 'Nothing matches that filter.'));
  };
  q.addEventListener('input', draw); root.append(list); draw(); return root;
}
function viewLab(which) {
  which = which || 'data'; const root = h('div', { class: 'stack' });
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('h1', { html: 'The <em>Lab</em>' }), h('p', { class: 'muted', style: { maxWidth: '75ch' } }, 'Touch the data. Drag points on the plane and the dataset changes; lift the plane into a 3-D box to see what the flat view hides; watch each algorithm react. Then build whole systems from blocks.'))),
    h('div', { class: 'pace' }, [['data', 'Graph Studio (2-D / 3-D)'], ['clean', 'Cleaning Lab'], ['math', 'Math & stats labs'], ['mydata', 'Your data'], ['pipe', 'Pipeline Lab (blocks to code)']].map(([k, t]) => h('a', { class: 'btn sm ' + (which === k ? 'primary' : 'ghost'), href: '#/lab/' + k, style: { border: 0 } }, t))));
  if (which === 'pipe') root.append(viewPipelineLab());
  else if (which === 'mydata') root.append(viewMyData());
  else if (which === 'math') {
    [['matrixLab', 'Matrices and determinants: move the plane or the box', 'A matrix moves every point; the determinant is the area (volume) scale; det = 0 squashes the space and removes the inverse.'], ['calcLab', 'Derivative, integral and gradient descent', 'Type any f(x). Shrink the secant into a tangent, add rectangles into an area, and walk downhill on a 3-D surface.'], ['confusionLab', 'True / false positives and negatives, precision, recall, ROC', 'Drag the threshold: the confusion matrix and the ROC point move together.'], ['cltLab', 'Sampling, the bell curve and confidence intervals', 'Averages of skewed data become bell-shaped; the green bar is a 95% confidence interval.']].forEach(([k, t, cap]) => { const v = mountViz({ viz: k, args: {}, caption: cap }); root.append(h('h3', { style: { margin: '14px 0 0' } }, t), v); App.dis.push(() => v._destroy && v._destroy()); });
  }
  else if (which === 'clean') { const v = mountViz({ viz: 'cleanLab', args: { level: 3 }, caption: 'Four views of one dataset: the table, the chart, the pandas code and the notes. Click a step (a dot means there is something to fix), try different orders, press Auto-clean to watch the recommended order, or run the code in real pandas.' }); root.append(v); App.dis.push(() => v._destroy && v._destroy()); }
  else root.append(viewStudio());
  return root;
}

/* ---------------------------------------------------------------------
   Drills
   --------------------------------------------------------------------- */
function viewArcade() {
  const root = h('div', { class: 'stack' }), st = S.st; let tab = 'sniper';
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('h1', { html: 'The <em>Drills</em>' }), h('p', { class: 'muted' }, 'Short timed drills that train the same skills: precise slicing, fast typing and quick recall. pts and badges count.'))));
  const tabs = h('div', { class: 'pace' }), stage = h('div');
  const T = [['sniper', 'Slicing drill'], ['type', 'Typing sprint'], ['data', 'Data practice'], ['quiz', 'Mixed review']]; let dlevel = 2;
  const pool = [];
  App.mods.filter(m => m.live).forEach(m => m.lessons.forEach(l => l.pages.forEach(p => { if (p.t === 'type') pool.push(p.snip); })));
  function draw() {
    tabs.innerHTML = ''; T.forEach(([k, t]) => tabs.append(h('button', { class: tab === k ? 'on' : '', type: 'button', onclick: () => { tab = k; draw(); } }, t)));
    App.dis.forEach(f => f()); App.dis = []; stage.innerHTML = '';
    if (tab === 'sniper') { const v = mountViz({ viz: 'slicer', args: { rows: 6, cols: 7, sniper: true, seed: Date.now() % 1000 }, caption: 'Select exactly the dashed gold cells with a NumPy slice. You have won ' + (st.games.sniper || 0) + ' rounds so far.' }); stage.append(v); App.dis.push(() => v._destroy && v._destroy()); }
    if (tab === 'type') { if (!pool.length) stage.append(h('p', {}, 'No typing snippets yet.')); else { let k = Math.floor(Math.random() * pool.length); const show = () => { stage.innerHTML = ''; stage.append(h('div', { class: 'row', style: { marginBottom: '10px' } }, h('button', { class: 'btn sm', onclick: () => { k = (k + 1) % pool.length; show(); } }, 'Another snippet'), h('span', { class: 'muted' }, 'Personal best on this one: ' + ((st.seenTyping || {})[pool[k].id] || '-') + ' WPM')), h('div', { class: 'card pad' }, typingBlock(pool[k], { onDone: () => { } }))); }; show(); } }
    if (tab === 'data') {
      const names = ['', 'easy', 'medium', 'hard', 'complex']; const bar = h('div', { class: 'pace' }, [1, 2, 3, 4].map(l => h('button', { class: dlevel === l ? 'on' : '', type: 'button', onclick: () => { dlevel = l; draw(); } }, names[l])));
      stage.append(h('p', { class: 'muted' }, 'Random messy datasets and questions, generated fresh every time (never the same twice), from counting missing values up to multi-step cleaning pipelines. Practise the cleaning itself in the ', h('a', { href: '#/lab/clean' }, 'Cleaning Lab'), '.'), bar, quizBlock(DSQ.dataQuestions(dlevel), { tag: 'datapractice', count: 8 }));
    }
    if (tab === 'quiz') {
      const items = []; App.mods.filter(m => m.live).forEach(m => { let any = false; m.lessons.forEach(l => { if (S.lessonDone(m.id + '/' + l.id) || (st.seen && st.seen[m.id + '/' + l.id] >= l.pages.length - 1)) { any = true; l.pages.forEach(p => { if (p.t === 'quiz') items.push(...p.items); }); } }); if (any) items.push(...(m.boss || [])); });
      stage.append(h('p', { class: 'muted' }, 'Mixed review: random, shuffled questions drawn ONLY from lessons you have finished (' + items.length + ' in the pool). Numbers change every time.'), items.length ? quizBlock(items, { tag: 'review', count: 10 }) : h('div', { class: 'callout warn' }, 'Finish a lesson first - this review only asks about what you have learned.'));
    }
  }
  root.append(tabs, stage); draw(); return root;
}

/* ---------------------------------------------------------------------
   Profile
   --------------------------------------------------------------------- */
function progressPost() {
  const st = S.st, done = App.mods.filter(m => m.live && S.moduleProgress(m) >= 1).map(m => m.title), solved = Object.values(st.ex).filter(e => e.pass).length, pj = Object.values(S.projects || {}).filter(p => p.title);
  const tags = ['#DataScience', '#Python', '#MachineLearning', '#BuildInPublic', '#LearningInPublic'];
  return `Learning data science by building it, in public.\n\nWhere I am: level ${st.level} (${rankOf(st.level)}), ${st.xp} pts, ${Object.keys(st.lessons).length} lessons and ${solved} coding exercises done` + (st.streak && st.streak.n > 1 ? `, ${st.streak.n}-day streak` : '') + '.\n' +
    (done.length ? 'Modules finished: ' + done.join(', ') + '.\n' : '') + (pj.length ? 'Projects: ' + pj.map(p => p.title).slice(0, 3).join('; ') + '.\n' : '') +
    'Every module ends with a real project on its own dataset, plus practice notebooks I run in my own Jupyter.\n' + (S.me.linkedin ? '\nFollow along: ' + S.me.linkedin + '\n' : '') + '\n' + tags.join(' ');
}
function accountCard() {
  const em = h('input', { class: 'input', type: 'email', placeholder: S.me.hasEmail ? 'current: ' + S.me.email : 'your email (for password reset)', autocomplete: 'email' }), pw = h('input', { class: 'input', type: 'password', placeholder: S.me.hasEmail ? 'current password (to change the email)' : '', autocomplete: 'current-password', hidden: !S.me.hasEmail }), msg = h('span', { class: 'muted', style: { fontSize: '13px' } });
  const vt = h('input', { class: 'input', type: 'password', placeholder: S.me.hasVercel ? 'Vercel token saved (type to replace)' : 'Vercel token (optional)', autocomplete: 'off' }), vmsg = h('span', { class: 'muted', style: { fontSize: '13px' } });
  const card = h('div', { class: 'card pad stack' }, h('h3', {}, 'Account & publishing'),
    h('p', { class: 'muted', style: { margin: 0 } }, 'Your progress, scores and projects are stored on the server under this account - log in from any device and carry on. Your email is only used to reset a forgotten password.'),
    h('div', { class: 'grid2' }, h('div', { class: 'stack' }, h('b', {}, 'Email'), em, pw, h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: async () => { try { const r = await API.put('/api/me/profile', { linkedin: S.me.linkedin || '', email: em.value, password: pw.value }); S.me = r.user; msg.textContent = 'Saved.'; } catch (e) { msg.textContent = e.message; } } }, 'Save email'), msg)),
      !API.local ? h('div', { class: 'stack' }, h('b', {}, 'Publish on your own Vercel'), h('p', { class: 'muted', style: { margin: 0, fontSize: '13px' } }, 'No account yet? Create a free one at vercel.com, then Settings > Tokens > Create token, and paste it here. "Ship it" on a finished project then deploys your project page to YOUR Vercel. The token is stored encrypted and never shown again.'), vt,
        h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: async () => { try { const r = await API.put('/api/me/vercel', { vercelToken: vt.value }); S.me = r.user; vt.value = ''; vmsg.textContent = 'Saved.'; } catch (e) { vmsg.textContent = 'Not available on this server.'; } } }, 'Save token'), h('a', { class: 'btn', href: 'https://vercel.com/signup', target: '_blank', rel: 'noopener' }, 'Create a Vercel account'), vmsg)) : null));
  return card;
}
function linkedinCard() {
  const inp = h('input', { class: 'input', value: S.me.linkedin || '', placeholder: 'https://www.linkedin.com/in/your-name' }), msg = h('span', { class: 'muted', style: { fontSize: '13px' } }), ta = h('textarea', { class: 'input', rows: 8 });
  ta.value = progressPost();
  return h('div', { class: 'card pad stack' }, h('h3', {}, 'LinkedIn'), h('p', { class: 'muted', style: { margin: 0 } }, 'Add your profile link. It is added to every project post, and you can post about your progress here at any time. LinkedIn only lets apps post with an approved developer app, so the composer opens with your text filled in and you press Post.'),
    h('div', { class: 'row' }, inp, h('button', { class: 'btn primary', type: 'button', onclick: async () => { try { const r = await API.put('/api/me/profile', { linkedin: inp.value }); S.me = r.user; ta.value = progressPost(); msg.textContent = r.user.linkedin ? 'Saved.' : 'Removed.'; } catch (e) { msg.textContent = e.message; } } }, 'Save'), S.me.linkedin ? h('a', { class: 'btn', href: S.me.linkedin, target: '_blank', rel: 'noopener' }, 'Open my profile') : null), msg,
    h('h4', { style: { margin: '6px 0 0' } }, 'Post about my progress'), ta,
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => { ta.value = progressPost(); } }, 'Refresh from my progress'), h('button', { class: 'btn', type: 'button', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(ta.value); toast('Post copied'); } }, 'Copy'),
      h('a', { class: 'btn primary', target: '_blank', rel: 'noopener', onclick: e => { e.target.href = 'https://www.linkedin.com/feed/?shareActive=true&text=' + encodeURIComponent(ta.value); } , href: 'https://www.linkedin.com/feed/?shareActive=true' }, 'Open LinkedIn composer')));
}
function viewProfile() {
  const st = S.st, sk = S.skills(), root = h('div', { class: 'stack' });
  const lo = xpAt(st.level), hi = xpAt(st.level + 1);
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('h1', { html: `${esc(S.me.display)} <em>${rankOf(st.level)}</em>` }), h('p', { class: 'muted' }, `Level ${st.level} - ${st.xp} pts - ${hi - st.xp} pts to level ${st.level + 1}`))));
  const days = range(14).map(i => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); const k = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); return st.days[k] || 0; });
  const mx = Math.max(1, ...days);
  root.append(h('div', { class: 'grid2' },
    h('div', { class: 'card pad stack' }, h('h3', {}, 'Skill radar'), h('div', { html: radarSVG(sk) }), h('p', { class: 'muted', style: { fontSize: '13px', margin: 0 } }, 'Typing = speed x accuracy of code sprints. Coding = first-try solves, fewer hints. Speed = solving faster than the estimate. Knowledge = quiz accuracy. Consistency = active days in the last 14. Breadth = modules finished.')),
    h('div', { class: 'stack' },
      h('div', { class: 'card pad stack' }, h('h3', {}, 'Typing speed'), h('div', { class: 'row' }, h('span', { class: 'chip brand' }, sk._wpm + ' WPM (last 5)'), h('span', { class: 'chip' }, sk._acc + '% accuracy')), h('div', { html: sparkSVG(st.typing.slice(-20).map(t => t.wpm)) }), h('a', { class: 'btn sm', href: '#/arcade', style: { width: 'fit-content' } }, 'Train in the Drills')),
      h('div', { class: 'card pad stack' }, h('h3', {}, 'pts, last 14 days'), h('div', { html: svgOpen(300, 80) + days.map((v, i) => `<rect x="${6 + i * 20.5}" y="${70 - v / mx * 60}" width="15" height="${Math.max(2, v / mx * 60)}" rx="3" fill="var(--c0)" opacity="${v ? 1 : .25}"/>`).join('') + '</svg>' })),
      h('div', { class: 'card pad stack' }, h('h3', {}, 'Numbers'), h('table', { class: 'tbl' }, h('tbody', {}, [['Exercises solved', Object.values(st.ex).filter(e => e.pass).length], ['...on the first try', Object.values(st.ex).filter(e => e.pass && e.tries === 1 && !e.hints).length], ['Lessons finished', Object.keys(st.lessons).length], ['Assessmentes passed', Object.values(st.boss).filter(b => b.best >= .7).length], ['Longest current streak', st.streak.n + ' days'], ['Quiz accuracy', sk.Knowledge + '%']].map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, String(b))))))))));
  root.append(h('div', { class: 'card pad stack' }, h('h3', {}, 'Badges'), h('div', { class: 'badges' }, BADGES.map(b => h('div', { class: 'bdg' + (st.badges[b.id] ? '' : ' off'), title: b.desc }, h('i', {}, b.g), h('b', { style: { fontSize: '13px' } }, b.name), h('small', {}, b.desc))))));
  const gUrl = h('input', { class: 'input', value: S.me.gitRemote || '', placeholder: 'https://github.com/you/my-ds-projects' }), gTok = h('input', { class: 'input', type: 'password', placeholder: S.me.hasToken ? 'token saved (type to replace)' : 'GitHub token (optional)', autocomplete: 'off' }), gMsg = h('span', { class: 'muted' });
  root.append(h('div', { class: 'card pad stack' }, h('h3', {}, 'My git repository'), h('p', { class: 'muted', style: { margin: 0 } }, 'Add the empty repo where your projects should live. Each finished milestone is committed locally and pushed here; the history becomes your public learning log.'), h('div', { class: 'grid2' }, h('label', { class: 'f' }, 'REPO URL', gUrl), h('label', { class: 'f' }, 'ACCESS TOKEN (stored on this server only)', gTok)),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: async () => { try { const r = await API.put('/api/me/git', { gitRemote: gUrl.value, gitToken: gTok.value }); S.me = r.user; gMsg.textContent = r.user.gitRemote ? 'Saved. Pushes go to ' + r.user.gitRemote : 'Saved: no repo (commits stay local).'; gTok.value = ''; } catch (e) { gMsg.textContent = e.message; } } }, 'Save'), gMsg)));
  root.append(accountCard(), linkedinCard());
  const pj = Object.entries(S.projects || {}).filter(([, v]) => v.title || v.live);
  root.append(h('div', { class: 'card pad stack' }, h('h3', {}, 'My projects'), pj.length ? h('table', { class: 'tbl' }, h('tbody', {}, pj.map(([k, v]) => h('tr', {}, h('td', {}, v.title || k), h('td', {}, v.done ? h('span', { class: 'chip ok' }, 'published') : h('span', { class: 'chip' }, 'in progress')), h('td', {}, v.live && v.done ? h('a', { href: v.live, target: '_blank', rel: 'noopener' }, 'live page') : '-'))))) : h('p', { class: 'muted' }, 'Finish a module to start your first project. Each one is committed to your personal git repository.')));
  return root;
}

async function loadBoard(into) { try { const r = await API.get('/api/leaderboard'); into.innerHTML = ''; into.append(h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['#', 'Learner', 'Level', 'pts'].map(x => h('th', {}, x)))), h('tbody', {}, r.rows.map((u, i) => h('tr', { style: u.me ? { background: 'var(--brand-soft)', fontWeight: 800 } : null }, h('td', {}, i + 1), h('td', {}, u.display), h('td', {}, u.level), h('td', {}, u.xp)))))); } catch (e) { into.textContent = 'Could not load: ' + e.message; } }
function viewBoard() { const box = h('div', { class: 'card pad' }, 'Loading...'); loadBoard(box); return h('div', { class: 'stack' }, h('div', { class: 'page-h' }, h('div', {}, h('h1', { html: '<em>Leaderboard</em>' }), h('p', { class: 'muted' }, 'Top learners by pts.'))), box); }

/* ---------------------------------------------------------------------
   Admin
   --------------------------------------------------------------------- */
function llmCard() {
  const card = h('div', { class: 'card pad stack' }), list = h('div', { class: 'stack' }), ta = h('textarea', { class: 'input', rows: 12, style: { fontFamily: 'var(--f-mono)', fontSize: '12px' } }), msg = h('span', { class: 'muted' });
  async function load() {
    const [st, cfg] = await Promise.all([API.get('/api/llm/status'), API.get('/api/admin/llm')]);
    list.innerHTML = ''; st.providers.forEach((p, i) => list.append(h('div', { class: 'row' }, h('span', { class: 'chip' }, i + 1), h('span', { class: 'chip ' + (p.ok ? 'ok' : 'warn') }, p.ok ? 'ready' : 'not ready'), h('b', {}, p.id), h('span', { class: 'muted' }, p.kind + (p.vision ? ' - sees images' : ' - text') + ' - ' + p.detail))));
    ta.value = JSON.stringify(cfg.providers, null, 1); card.querySelector('.envs').textContent = 'API keys found in the server environment: ' + Object.entries(cfg.env).map(([k, v]) => k + (v ? ' yes' : ' no')).join(', ');
  }
  card.append(h('h3', {}, 'AI tutor providers (free chain, tried top to bottom)'), h('p', { class: 'muted', style: { margin: 0, fontSize: '13px' } }, 'Cloud models first so your GPU stays free; a small local model last as the offline fallback. Keys are read only from environment variables (GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY) - restart the server after setting them. Model names change often: check them in each provider\'s docs or with ollama list.'), h('div', { class: 'envs muted mono', style: { fontSize: '12px' } }), list, h('details', {}, h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, 'Edit the chain (JSON)'), ta,
    h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn primary', type: 'button', onclick: async () => { try { await API.post('/api/admin/llm', { providers: JSON.parse(ta.value) }); msg.textContent = 'Saved.'; load(); } catch (e) { msg.textContent = 'Not saved: ' + e.message; } } }, 'Save chain'), h('button', { class: 'btn', type: 'button', onclick: async () => { await API.post('/api/admin/llm', { reset: true }); msg.textContent = 'Back to the defaults.'; load(); } }, 'Reset to defaults'), msg)));
  load().catch(e => { list.textContent = e.message; }); return card;
}
function viewAdmin() {
  const root = h('div', { class: 'stack' }); root.append(h('div', { class: 'page-h' }, h('div', {}, h('h1', { html: 'Owner <em>console</em>' }), h('p', { class: 'muted' }, 'Learners, git publishing and the optional local AI judge.'))));
  const box = h('div', { class: 'card pad' }, 'Loading...'); root.append(box, llmCard());
  API.get('/api/admin/users').then(r => {
    box.innerHTML = ''; const cfg = r.config || {};
    const remote = h('input', { class: 'input', value: cfg.remote || '', placeholder: 'https://github.com/you/ds-quest-portfolio.git (leave empty = commit locally only)' }), jurl = h('input', { class: 'input', value: cfg.judgeUrl || '', placeholder: 'http://127.0.0.1:8080/v1/chat/completions (optional local OpenAI-compatible server)' }), jm = h('input', { class: 'input', value: cfg.judgeModel || '', placeholder: 'model name (optional)' }), msg = h('div', { class: 'muted' });
    box.append(h('h3', {}, 'Learners (' + r.users.length + ')'), h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['User', 'Role', 'pts', 'Projects', 'Last active'].map(x => h('th', {}, x)))), h('tbody', {}, r.users.map(u => h('tr', {}, h('td', {}, u.display + ' (' + u.username + ')'), h('td', {}, u.role), h('td', {}, u.xp), h('td', {}, u.projects), h('td', {}, u.last ? new Date(u.last).toLocaleString() : '-'))))),
      h('h3', { style: { marginTop: '20px' } }, 'Publishing and judge settings'), h('div', { class: 'stack' }, h('label', { class: 'f' }, 'GIT REMOTE FOR AUTO-PUSH', remote), h('label', { class: 'f' }, 'LOCAL AI JUDGE URL', jurl), h('label', { class: 'f' }, 'JUDGE MODEL', jm),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: async () => { try { await API.post('/api/admin/config', { remote: remote.value, judgeUrl: jurl.value, judgeModel: jm.value }); msg.textContent = 'Saved. Remote configured: ' + (remote.value ? 'yes' : 'no (commits stay local)'); } catch (e) { msg.textContent = 'Not saved: ' + e.message; } } }, 'Save'), msg),
        h('p', { class: 'muted', style: { fontSize: '13px' } }, 'Each learner\'s project lives in workspace/<username>/ as its own git repository. Commits are always local; a push only happens when a remote is set here. Nothing is pushed by default.')));
  }).catch(e => { box.textContent = e.message; });
  return root;
}

/* ---------------------------------------------------------------------
   boot
   --------------------------------------------------------------------- */
(async function boot() {
  await API.detect();
  { const m = /^#\/reset\/([0-9a-f]{64})$/.exec(location.hash); if (m) { showReset(m[1]); return; } }
  const lg = /^#\/legal\/(terms|refund|privacy)$/.exec(location.hash);
  try { const r = await API.get('/api/me'); S.set(r.user, r.state, r.projects, r.judge); API.remember(false); startApp(); }
  catch (e) { document.documentElement.dataset.theme = 'light'; if (lg) showLegalPublic(lg[1]); else showAuth(); }
})();

/* ---------------------------------------------------------------------
   Self-test (owner/dev): runs every reference solution through the in-browser Python
   with the real tests. Start with DSQ.selftest({module:'pandas', starters:false}); read DSQ.stRes.
   --------------------------------------------------------------------- */
DSQ.selftest = function (o = {}) {
  const res = DSQ.stRes = { done: 0, total: 0, problems: [], running: true };
  const cases = [], users = o.users || ['Dstar', 'rohan.m'];
  for (const m of DSQ.modules) {
    if (o.module && m.id !== o.module) continue;
    for (const L of m.lessons || []) for (const p of L.pages) if (p.t === 'ex') cases.push({ id: m.id + '/' + p.ex.id, code: p.ex.solution, starter: p.ex.starter, tests: p.ex.tests, files: p.ex.files || {}, prelude: '' });
    if (m.project) for (const v of m.project.variants) for (const user of users) {
      const tier = user === 'Dstar' ? 'flagship' : 'standard';
      const csv = v.dataset.gen(RNG(hash32(user.toLowerCase() + '|' + m.id + '|' + v.id + '|data')), tier), files = { ['data/' + v.dataset.file]: csv };
      let prelude = ''; for (const x of (v.milestones || []).concat(tier === 'flagship' ? (v.flagship_ms || []) : [])) { cases.push({ id: `${m.id}/${v.id}/${x.id} [${tier}]`, code: x.solution, starter: x.starter, tests: x.tests, files, prelude }); prelude += (prelude ? '\n\n' : '') + x.solution; }
    }
  }
  res.total = cases.length;
  (async () => {
    for (const c of cases) {
      const r = await Py.run({ code: c.code, tests: c.tests, files: c.files, prelude: c.prelude, timeout: 60000 });
      const ok = !r.error && r.checks.length && r.checks.every(k => k.ok);
      if (!ok) res.problems.push(c.id + ' :: ' + (r.error ? fmtErr(r.error) : r.checks.filter(k => !k.ok).map(k => k.msg).join(' | ')));
      if (o.starters !== false && ok && c.starter) { const s = await Py.run({ code: c.starter, tests: c.tests, files: c.files, prelude: c.prelude, timeout: 60000 }); if (!s.error && s.checks.length && s.checks.every(k => k.ok)) res.problems.push(c.id + ' :: starter already passes'); }
      res.done++;
    }
    res.running = false;
  })();
  return 'started ' + cases.length + ' cases';
};
