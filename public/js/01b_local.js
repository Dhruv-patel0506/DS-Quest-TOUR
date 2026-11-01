'use strict';
/* =====================================================================
   Browser mode: when there is no DS Quest server behind the page (for example the static copy hosted on Vercel),
   accounts, progress and projects are kept in THIS browser (localStorage) and the /api/* calls are answered here.
   Not available in browser mode: pushing to git, live project pages, the AI tutor, the leaderboard of other people,
   the owner console. Everything that runs in the browser (lessons, Python, labs, games, quizzes, notebooks) works.
   ===================================================================== */
const LOCAL = (() => {
  const KEY = 'dsq.local.v1', RESERVED = ['dhruv', 'dstar', 'distar', 'dharmesh', 'darmesh', 'dharmesha', 'asha'];
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { users: {}, session: null }; } catch (e) { return { users: {}, session: null }; } };
  const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { throw new Error('This browser blocked storage, so progress cannot be saved here.'); } };
  const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/1/g, 'i').replace(/0/g, 'o').replace(/3/g, 'e').replace(/\$/g, 's');
  const reserved = name => { const n = norm(name); return RESERVED.some(r => (r.length < 5 ? lev(n, r) <= 1 : n.includes(r) || lev(n, r) <= 1)); };
  const bytes = s => new TextEncoder().encode(s), hex = a => [...new Uint8Array(a)].map(x => x.toString(16).padStart(2, '0')).join('');
  const hash = async (pw, salt) => { const k = await crypto.subtle.importKey('raw', bytes(pw), 'PBKDF2', false, ['deriveBits']); return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salt), iterations: 150000 }, k, 256)); };
  const pub = u => ({ username: u.username, display: u.display, role: 'learner', tier: 'standard', gitRemote: u.gitRemote || '', hasToken: false, linkedin: u.linkedin || '' });
  const err = (m, status = 400) => { const e = new Error(m); e.status = status; return e; };
  const cur = d => { const u = d.session && d.users[d.session]; if (!u) throw err('not signed in', 401); return u; };
  const linkedinPost = (u, p, links) => {
    const tags = (p.skills || []).slice(0, 5).map(x => '#' + String(x).replace(/[^A-Za-z0-9]/g, ''));
    const text = 'I just finished a new data project: ' + (p.title || 'my project') + '.\n\n' + (p.pitch ? p.pitch.slice(0, 230) + (p.pitch.length > 230 ? '...' : '') + '\n\n' : '') +
      (Array.isArray(p.milestones) && p.milestones.length ? 'What I built, step by step:\n' + p.milestones.slice(0, 8).map((x, i) => (i + 1) + '. ' + String(x).slice(0, 90)).join('\n') + '\n\n' : '') +
      (p.logic ? 'How it works: ' + p.logic.replace(/\s+/g, ' ').slice(0, 280) + (p.logic.length > 280 ? '...' : '') + '\n\n' : '') +
      'Built with: ' + ((p.skills || []).slice(0, 5).join(', ') || 'Python') + '.\n' + (links.site ? 'Live: ' + links.site + '\n' : '') + (links.repo ? 'Code: ' + links.repo + '\n' : '') + (u.linkedin ? 'More about me: ' + u.linkedin + '\n' : '') +
      '\nLearning data science by building it, step by step, in DS Quest.\n\n' + tags.concat(['#DataScience', '#Python', '#BuildInPublic']).slice(0, 8).join(' ');
    return { text, url: 'https://www.linkedin.com/feed/?shareActive=true&text=' + encodeURIComponent(text), shareUrl: links.site ? 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(links.site) : null };
  };
  const seg = s => String(s || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 60);
  async function handle(method, url, body) {
    body = body || {}; const route = method + ' ' + url.split('?')[0], d = load();
    if (route === 'POST /api/signup') {
      const name = String(body.username || '').trim(), pw = String(body.password || ''), disp = String(body.display || name).trim().slice(0, 30);
      if (!/^[A-Za-z0-9_.-]{3,24}$/.test(name)) throw err('Username: 3-24 letters, digits, _ . -');
      if (pw.length < 8) throw err('Password needs at least 8 characters.');
      if (d.users[name.toLowerCase()]) throw err('That username is taken in this browser.', 409);
      if (reserved(name)) throw err('That name is reserved. Please pick another.', 409);
      const salt = hex(crypto.getRandomValues(new Uint8Array(12)));
      d.users[name.toLowerCase()] = { username: name, display: disp || name, salt, pw: await hash(pw, salt), created: Date.now(), state: null, projects: {}, gitRemote: '', linkedin: '' }; d.session = name.toLowerCase(); save(d);
      const u = d.users[d.session]; return { user: pub(u), state: u.state, projects: u.projects, judge: false };
    }
    if (route === 'POST /api/login') {
      const u = d.users[String(body.username || '').trim().toLowerCase()]; if (!u || u.pw !== await hash(String(body.password || ''), u.salt)) throw err('Wrong username or password (accounts made in browser mode live in this browser only).', 401);
      d.session = u.username.toLowerCase(); save(d); return { user: pub(u), state: u.state, projects: u.projects, judge: false };
    }
    if (route === 'POST /api/logout') { d.session = null; save(d); return { ok: true }; }
    if (route === 'GET /api/me') { const u = cur(d); return { user: pub(u), state: u.state, projects: u.projects, judge: false, nb: [] }; }
    const u = cur(d);
    if (route === 'PUT /api/progress') { if (!body.state || typeof body.state !== 'object') throw err('state missing'); u.state = body.state; u.last = Date.now(); save(d); return { ok: true }; }
    if (route === 'GET /api/leaderboard') return { rows: Object.values(d.users).map(x => ({ display: x.display, xp: (x.state && x.state.xp) || 0, level: (x.state && x.state.level) || 1, me: x === u })).sort((a, b) => b.xp - a.xp).slice(0, 20), local: true };
    if (route === 'PUT /api/me/git') { const g = String(body.gitRemote || '').trim(); if (g && !/^https:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/[\w.-]+\/[\w.-]+?(\.git)?\/?$/.test(g)) throw err('Use a URL like https://github.com/you/my-repo'); u.gitRemote = g; save(d); return { ok: true, user: pub(u) }; }
    if (route === 'PUT /api/me/profile') {
      const li = String(body.linkedin || '').trim(); if (li && !/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/(in|company)\/[A-Za-z0-9_%\-.]+\/?$/.test(li)) throw err('Use your profile address, like https://www.linkedin.com/in/your-name');
      u.linkedin = li; if (body.display) u.display = String(body.display).trim().slice(0, 30) || u.display; save(d); return { ok: true, user: pub(u) };
    }
    if (route === 'POST /api/project/save' || route === 'POST /api/project/publish') {
      const final = route.endsWith('publish'), pdir = seg(body.moduleId) + '-' + seg(body.variantId), meta = body.meta || {}, old = u.projects[pdir] || {};
      u.projects[pdir] = Object.assign(old, { moduleId: body.moduleId, variantId: body.variantId, title: meta.title, updated: Date.now(), done: final || old.done || false, live: null, meta: final ? { title: meta.title, pitch: meta.pitch, skills: meta.skills, module: meta.module, logic: meta.logic, milestones: meta.milestones, dataset: meta.dataset } : old.meta, files: Object.assign(old.files || {}, { 'solution.py': String((body.files || {})['solution.py'] || (old.files || {})['solution.py'] || '') }) });
      save(d); return { ok: true, git: { committed: false, pushed: false, commit: '', note: 'browser mode: nothing is pushed anywhere - your files stay in this browser (use Download below)' }, live: null };
    }
    if (route === 'POST /api/linkedin') { const pdir = seg(body.moduleId) + '-' + seg(body.variantId), p = u.projects[pdir]; if (!p) throw err('Publish the project first.', 404); return { linkedin: linkedinPost(u, Object.assign({}, p.meta || {}, body.meta || {}), p.links || {}) }; }
    if (route === 'GET /api/ship/status') return { owner: false, local: true, github: { token: false, remoteConfigured: false }, vercel: { loggedIn: false } };
    if (route === 'POST /api/ship') throw err('One-click shipping needs the local DS Quest server (it uses your own git and Vercel logins). Here you can download your project and copy the LinkedIn post.', 501);
    if (route === 'GET /api/llm/status') return { providers: [], ready: false };
    if (route === 'POST /api/llm/ask') return { available: false, trail: [], hint: 'This hosted copy has no AI model attached. Run DS Quest on your own computer (node server.js) with Ollama or a free Gemini/Groq key to get the AI tutor. The built-in explanations and glossaries still work.' };
    if (route === 'POST /api/judge' || route === 'POST /api/ask') return { available: false };
    if (route === 'GET /api/nb/key') throw err('Reporting notebook results needs the local server. The notebook checker itself works anywhere.', 501);
    throw err('Not available in browser mode', 404);
  }
  return { handle, linkedinPost };
})();
