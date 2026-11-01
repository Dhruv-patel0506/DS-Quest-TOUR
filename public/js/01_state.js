'use strict';
/* =====================================================================
   DS Quest - API client, learner state, pts / levels / streaks / badges
   ===================================================================== */
const API = {
  local: false, cached: false,
  /* Offline first: the last signed-in account is kept on this device. When the server cannot be reached (no internet, server asleep) the app opens that saved copy
     and carries on; progress is kept and sent to the server the next time it answers. Log out removes the saved copy. */
  OFFME: 'dsq.offlineMe',
  saved() { try { return JSON.parse(localStorage.getItem(API.OFFME)); } catch (e) { return null; } },
  remember(dirty) { try { if (API.cached && !dirty) return; if (S.me && S.st) localStorage.setItem(API.OFFME, JSON.stringify({ user: S.me, state: S.st, projects: S.projects, judge: S.judge, dirty: !!dirty, at: Date.now() })); } catch (e) { } },
  forget() { try { localStorage.removeItem(API.OFFME); } catch (e) { } },
  async cachedCall(method, url, body) {
    const c = API.saved();
    if (c && method === 'GET' && url === '/api/me') { setTimeout(() => { try { toast('No connection: working from the copy saved on this device. Your progress is kept and synced when you are back online.'); } catch (e) { } }, 2500); return { user: c.user, state: c.state, projects: c.projects || {}, judge: !!c.judge }; }
    if (c && method === 'PUT' && url === '/api/progress') { c.state = body.state; c.dirty = true; c.at = Date.now(); try { localStorage.setItem(API.OFFME, JSON.stringify(c)); } catch (e) { } return { ok: true, offline: true }; }
    try { return await API.net(method, url, body); } catch (e) { if (!e.status) { const x = new Error('This needs an internet connection.'); x.status = 0; throw x; } throw e; }
  },
  async reconnect() {
    if (!API.cached) return false;
    try { const r = await fetch('/api/me', { credentials: 'same-origin' }); if (!r.ok || !/json/.test(r.headers.get('content-type') || '')) return false; }
    catch (e) { return false; }
    const c = API.saved(); API.cached = false;
    if (c && c.dirty) { try { await API.put('/api/progress', { state: c.state }); c.dirty = false; localStorage.setItem(API.OFFME, JSON.stringify(c)); } catch (e) { } }
    try { toast('Back online: your progress is saved to your account.'); } catch (e) { }
    return true;
  },
  async detect() { if (API.demo) return false; try { const r = await fetch('/api/me', { credentials: 'same-origin' }); if (!/json/.test(r.headers.get('content-type') || '') || r.status === 503) API.local = true; /* no server, or the server has no database yet: temporary browser mode */ } catch (e) { if (API.saved() && API.saved().user) API.cached = true; else API.local = true; } return API.local; },
  async net(method, url, body) {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    let j = {}; try { j = await r.json(); } catch (e) { }
    if (!r.ok) { const e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return j;
  },
  async call(method, url, body) {
    if (API.demo) return DEMO.handle(method, url, body);
    if (API.local) return LOCAL.handle(method, url, body);
    if (API.cached) return API.cachedCall(method, url, body);
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    let j = {}; try { j = await r.json(); } catch (e) { }
    if (!r.ok) { const e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return j;
  },
  get: u => API.call('GET', u), post: (u, b) => API.call('POST', u, b || {}), put: (u, b) => API.call('PUT', u, b),
};

const RANKS = ['Foundation', 'Developing', 'Applying', 'Proficient', 'Advanced', 'Specialist', 'Senior practitioner', 'Expert', 'Principal', 'Distinguished'];
const lvlFromXp = xp => Math.floor((1 + Math.sqrt(1 + xp / 10)) / 2);
const xpAt = n => 40 * n * (n - 1);
const rankOf = lv => RANKS[Math.min(RANKS.length - 1, Math.floor((lv - 1) / 3))];

const BADGES = [
  { id: 'first-run', name: 'First run', desc: 'Run your first Python cell', g: '>' },
  { id: 'first-pass', name: 'First pass', desc: 'Pass your first exercise', g: 'OK' },
  { id: 'no-hints', name: 'Independent work', desc: 'Pass 5 exercises on the first try', g: '5x' },
  { id: 'streak3', name: '3-day streak', desc: '3-day streak', g: '3d' },
  { id: 'streak7', name: '7-day streak', desc: '7-day streak', g: '7d' },
  { id: 'wpm30', name: 'Typing 30 WPM', desc: '30 WPM at 90% accuracy', g: '30' },
  { id: 'wpm50', name: 'Typing 50 WPM', desc: '50 WPM at 92% accuracy', g: '50' },
  { id: 'quiz-perfect', name: 'Perfect assessment', desc: 'Score 100% on a module assessment', g: '100' },
  { id: 'sniper', name: 'Slicing drill', desc: 'Win 5 slice-sniper rounds', g: '[:]' },
  { id: 'logic', name: 'Reasoning', desc: 'Get a plan accepted in the Logic Lab', g: 'IF' },
  { id: 'first-project', name: 'Published', desc: 'Publish your first project', g: 'GO' },
  { id: 'lvl5', name: 'Level 5', desc: 'Reach level 5', g: 'L5' },
];

const S = {
  me: null, st: null, projects: {}, judge: false, _t: null,
  fresh() {
    return { v: 1, xp: 0, level: 1, streak: { n: 0, last: '' }, days: {}, lessons: {}, ex: {}, quiz: {}, boss: {}, typing: [], badges: {}, proj: {}, pace: 'steady', theme: '', games: {}, log: [], seen: {} };
  },
  set(me, state, projects, judge) {
    this.me = me; this.projects = projects || {}; this.judge = !!judge;
    this.st = Object.assign(this.fresh(), state || {}); this.applyTheme();
  },
  save() { clearTimeout(this._t); API.remember(false); this._t = setTimeout(() => API.put('/api/progress', { state: this.st }).catch(() => { API.remember(true); }), 900); },
  flush() { clearTimeout(this._t); API.remember(false); return API.put('/api/progress', { state: this.st }).catch(() => { API.remember(true); }); },
  applyTheme() {
    document.documentElement.dataset.theme = 'light'; /* one theme: white */
  },
  log(o) { this.st.log.push(Object.assign({ t: Date.now() }, o)); if (this.st.log.length > 400) this.st.log.splice(0, this.st.log.length - 400); },

  /* ----- pts ----- */
  award(n, why) {
    const st = this.st; if (!n) return;
    const before = st.level; st.xp += n; st.level = lvlFromXp(st.xp);
    const d = today(); st.days[d] = (st.days[d] || 0) + n;
    if (st.streak.last !== d) { st.streak.n = (st.streak.last && dayDiff(st.streak.last, d) === 1) ? st.streak.n + 1 : 1; st.streak.last = d; }
    toast(`+${n} pts${why ? '  ' + why : ''}`, 'xp');
    if (st.level > before) { toast(`Level ${st.level}: ${rankOf(st.level)}`, 'lv'); confetti(140); }
    this.checkBadges(); this.save(); DSQ.refreshBar && DSQ.refreshBar();
  },
  badge(id) {
    if (this.st.badges[id]) return; const b = BADGES.find(x => x.id === id) || { name: id };
    this.st.badges[id] = Date.now(); toast('Badge: ' + b.name, 'lv'); confetti(60); this.save();
  },
  checkBadges() {
    const st = this.st;
    if (st.streak.n >= 3) this.badge('streak3'); if (st.streak.n >= 7) this.badge('streak7');
    if (st.level >= 5) this.badge('lvl5');
    const firsts = Object.values(st.ex).filter(e => e.pass && e.tries === 1 && !e.hints).length; if (firsts >= 5) this.badge('no-hints');
    if (Object.values(st.ex).some(e => e.pass)) this.badge('first-pass');
    if ((st.games.sniper || 0) >= 5) this.badge('sniper');
  },

  /* ----- records ----- */
  exDone(id) { return !!(this.st.ex[id] && this.st.ex[id].pass); },
  lessonDone(key) { return !!this.st.lessons[key]; },
  moduleProgress(m) {
    const ls = m.lessons || []; if (!ls.length) return 0;
    return ls.filter(l => this.lessonDone(m.id + '/' + l.id)).length / ls.length;
  },
  moduleStatus(m) {
    if (!m.lessons || !m.lessons.length) return 'planned';
    return this.moduleProgress(m) >= 1 ? 'done' : 'live';
  },

  /* ----- skill radar (all 0..100, computed from real logs) ----- */
  skills() {
    const st = this.st, ex = Object.values(st.ex).filter(e => e.pass);
    const ty = st.typing.slice(-5);
    const wpm = ty.length ? mean(ty.map(t => t.wpm)) : 0, acc = ty.length ? mean(ty.map(t => t.acc)) : 0;
    const typing = Math.min(100, (wpm / 50) * 100 * (acc >= 90 ? 1 : acc / 100));
    const coding = ex.length ? Math.round(100 * mean(ex.map(e => (e.tries === 1 ? 1 : e.tries === 2 ? .7 : .45) * (e.hints ? .85 : 1)))) : 0;
    const speedArr = ex.filter(e => e.ms && e.est).map(e => Math.min(1, e.est * 1000 / e.ms));
    const speed = speedArr.length ? Math.round(100 * mean(speedArr)) : 0;
    const q = Object.values(st.quiz).reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]);
    const knowledge = q[0] ? Math.round(100 * q[1] / q[0]) : 0;
    const dd = Object.keys(st.days), now = today();
    const consistency = Math.round(100 * dd.filter(d => dayDiff(d, now) >= 0 && dayDiff(d, now) < 14).length / 14);
    const mods = (DSQ.modules || []).filter(m => m.lessons && m.lessons.length);
    const breadth = mods.length ? Math.round(100 * mods.filter(m => this.moduleProgress(m) >= 1).length / mods.length) : 0;
    return { Typing: Math.round(typing), Coding: coding, Speed: speed, Knowledge: knowledge, Consistency: consistency, Breadth: breadth, _wpm: Math.round(wpm), _acc: Math.round(acc) };
  },
};
DSQ.S = S;

/* when the server answers again, send what was done offline */
setInterval(() => { if (API.cached) API.reconnect(); }, 15000);
window.addEventListener('online', () => setTimeout(() => API.reconnect(), 1500));
