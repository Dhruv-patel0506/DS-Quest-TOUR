'use strict';
/* =====================================================================
   Dhruv Patel Academy hosted API (Vercel serverless): accounts, sessions, progress, leaderboard, password reset by email,
   projects + live project pages, LinkedIn post text, optional "ship" with the learner's OWN Vercel / GitHub tokens.
   Storage is a Redis REST database (Upstash via the Vercel Marketplace): kv = { get, set(k,v,ex?), del, incr, expire, zadd, zrevrange }.
   ===================================================================== */
const { hashPw, verifyPw, isReserved, escH, validEmail, seal, unseal, crypto } = require('./shared');
const { sendMail, mailConfig } = require('./mailer');
const CONTENT = require('./content');
const { createPay } = require('./pay');

const PAGE_CSS = 'body{font:16px/1.6 system-ui,sans-serif;max-width:860px;margin:32px auto;padding:0 18px;color:#1c2420}h1{margin:.2em 0}img{max-width:100%}pre{background:#f3f6f4;padding:12px;overflow:auto;border-radius:8px;font-size:13px}.tag{display:inline-block;background:#e4efe9;border-radius:99px;padding:2px 10px;font-size:13px;margin-right:6px}.meta{color:#5b6a62}';
const slug = s => String(s || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 60);
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const maskEmail = e => (e ? e.replace(/^(.).*(@.*)$/, '$1***$2') : '');

module.exports = function createApi({ kv, env = process.env, mail = sendMail, fetchFn }) {
  const SECRET = env.DSQ_SECRET || env.KV_REST_API_TOKEN || '', MAX_PROGRESS = 450000;
  const J = (status, json, headers) => ({ status, json, headers });
  const getUser = async name => { const v = name && await kv.get('u:' + String(name).toLowerCase()); return v ? JSON.parse(v) : null; };
  const putUser = u => kv.set('u:' + u.username.toLowerCase(), JSON.stringify(u));
  const pub = u => ({ username: u.username, display: u.display, role: u.role || 'learner', tier: u.tier || 'standard', gitRemote: u.gitRemote || '', hasToken: !!u.gitTokenEnc, linkedin: u.linkedin || '', email: maskEmail(u.email), hasEmail: !!u.email, hasVercel: !!u.vercelTokenEnc, ent: u.ent ? { all: !!u.ent.all, until: u.ent.until || 0, modules: u.ent.mods ? Object.keys(u.ent.mods) : [] } : CONTENT.isFree(u, env) ? { all: true, until: 0 } : null });
  const summary = u => u.projects || {};
  const cookie = (req, n) => { const m = new RegExp('(?:^|; )' + n + '=([^;]*)').exec(req.headers.cookie || ''); return m ? decodeURIComponent(m[1]) : ''; };
  const setSession = async (u) => { const sid = crypto.randomBytes(24).toString('hex'); await kv.set('s:' + sid, JSON.stringify({ n: u.username.toLowerCase(), v: u.pwv || 0 }), 30 * 86400); return { 'Set-Cookie': `dsq_sid=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 86400}` }; };
  const authed = async req => { const sid = cookie(req, 'dsq_sid'); if (!/^[0-9a-f]{48}$/.test(sid)) return null; const v = await kv.get('s:' + sid); if (!v) return null; const s = JSON.parse(v), u = await getUser(s.n); return u && (u.pwv || 0) === s.v ? u : null; };
  const limit = async (key, max, sec) => { const n = await kv.incr('rl:' + key); if (n === 1) await kv.expire('rl:' + key, sec); return n <= max; };
  const origin = req => (env.APP_URL || ('https://' + (req.headers['x-forwarded-host'] || req.headers.host))).replace(/\/$/, '');
  const PAY = createPay({ kv, env, mail, mailConfig, getUser, putUser, fetchFn });
  async function seedOwner() { try { if (!env.DSQ_ADMIN_JSON) return; const a = JSON.parse(env.DSQ_ADMIN_JSON); if (!a.username || await getUser(a.username)) return; const u = { username: a.username, display: a.display || a.username, salt: a.salt, hash: a.hash, email: a.email || '', role: 'admin', tier: 'flagship', created: Date.now(), state: null, projects: {}, pwv: 0 }; await putUser(u); if (u.email) await kv.set('e:' + u.email.toLowerCase(), u.username.toLowerCase()); } catch (e) { } }

  function linkedinPost(u, p, links) {
    const tags = (p.skills || []).slice(0, 5).map(x => '#' + String(x).replace(/[^A-Za-z0-9]/g, ''));
    const lines = String(p.output || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 4).join(' | ');
    const text = 'I just finished a new data project: ' + (p.title || 'my project') + '.\n\n' + (p.pitch ? p.pitch.slice(0, 230) + (p.pitch.length > 230 ? '...' : '') + '\n\n' : '') +
      (p.logic ? 'How it works: ' + p.logic.replace(/\s+/g, ' ').slice(0, 300) + (p.logic.length > 300 ? '...' : '') + '\n\n' : '') +
      (Array.isArray(p.milestones) && p.milestones.length ? 'What I built, step by step:\n' + p.milestones.slice(0, 8).map((x, i) => (i + 1) + '. ' + String(x).slice(0, 90)).join('\n') + '\n\n' : '') +
      (p.dataset ? 'Data: ' + p.dataset + '.\n' : '') + (lines ? 'Key results: ' + lines.slice(0, 260) + '\n' : '') +
      'Built with: ' + ((p.skills || []).slice(0, 5).join(', ') || 'Python') + '.\n' + (links.site ? 'Live: ' + links.site + '\n' : '') + (links.repo ? 'Code: ' + links.repo + '\n' : '') + (u.linkedin ? 'More about me: ' + u.linkedin + '\n' : '') +
      '\nLearning data science by building it, step by step, in Dhruv Patel Academy.\n\n' + tags.concat(['#DataScience', '#Python', '#BuildInPublic']).slice(0, 8).join(' ');
    return { text, url: 'https://www.linkedin.com/feed/?shareActive=true&text=' + encodeURIComponent(text), shareUrl: links.site ? 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(links.site) : null };
  }
  function liveHtml(u, p) {
    const m = p.meta || {}, imgs = Object.entries(p.images || {}).map(([n, d]) => `<p><img alt="${escH(n)}" src="${/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(d) ? d : ''}"></p>`).join('');
    return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escH(m.title || p.pdir)}</title><style>${PAGE_CSS}</style><h1>${escH(m.title || p.pdir)}</h1><p class="meta">by ${escH(u.display)} &middot; ${escH(m.module || '')} &middot; ${new Date(p.updated || Date.now()).toISOString().slice(0, 10)}</p><p><span class="tag">${escH(m.edition || 'Standard edition')}</span><span class="tag">${escH(m.dataset || '')}</span></p><p>${escH(m.pitch || '')}</p><h2>How it works (in my own words)</h2><p>${escH(m.logic || '').replace(/\n/g, '<br>')}</p><h2>Results</h2>${imgs}<h2>Output</h2><pre>${escH(m.output || '')}</pre><h2>Code</h2><pre>${escH((p.files || {})['solution.py'] || '')}</pre>`;
  }
  /* The tutor is a chain of free cloud models. Each one is used only if its key is set; when one is rate-limited or down it rests for a minute
     (shared across server instances through the KV) and the next one answers. Models can be changed with *_MODEL variables. */
  const doFetch = fetchFn || fetch;
  const oai = (id, keyVar, url, model) => ({ id, keyVar, model: () => env[id.toUpperCase() + '_MODEL'] || model, call: async (prompt, key, m) => {
    const r = await doFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ model: m, messages: [{ role: 'user', content: prompt }], max_tokens: 1200 }), signal: AbortSignal.timeout(9000) });
    const j = await r.json().catch(() => ({})); return { status: r.status, text: r.ok && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content };
  } });
  const TUTORS = [
    { id: 'gemini', keyVar: 'GEMINI_API_KEY', model: () => env.GEMINI_MODEL || 'gemini-2.0-flash', call: async (prompt, key, m) => {
      const r = await doFetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }), signal: AbortSignal.timeout(9000) });
      const j = await r.json().catch(() => ({})); return { status: r.status, text: r.ok && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts.map(x => x.text).join('') };
    } },
    oai('groq', 'GROQ_API_KEY', 'https://api.groq.com/openai/v1/chat/completions', 'llama-3.3-70b-versatile'),
    oai('cerebras', 'CEREBRAS_API_KEY', 'https://api.cerebras.ai/v1/chat/completions', 'llama3.1-8b'),
    oai('openrouter', 'OPENROUTER_API_KEY', 'https://openrouter.ai/api/v1/chat/completions', 'meta-llama/llama-3.3-70b-instruct:free'),
  ];
  const tutorsOn = () => TUTORS.filter(t => env[t.keyVar]);
  async function tutorChain(prompt) {
    const trail = [];
    for (const t of tutorsOn()) {
      const cool = 'llm:cool:' + t.id;
      try { if (await kv.get(cool)) { trail.push({ id: t.id, ok: false, err: 'resting after a rate limit' }); continue; } } catch (e) { }
      try {
        const m = t.model(), r = await t.call(prompt, env[t.keyVar], m);
        if (r.text) { trail.push({ id: t.id, ok: true }); return { text: r.text, provider: t.id, model: m, trail }; }
        trail.push({ id: t.id, ok: false, err: 'HTTP ' + r.status });
        if (r.status === 429 || r.status >= 500) { try { await kv.set(cool, '1', 60); } catch (e) { } }
      } catch (e) { trail.push({ id: t.id, ok: false, err: 'no answer in time' }); try { await kv.set(cool, '1', 30); } catch (e2) { } }
    }
    return { text: null, trail };
  }
  const ghPush = async (u, pdir, files) => {
    const m = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(u.gitRemote || ''); if (!m || !u.gitTokenEnc) return { ok: false, note: 'no GitHub repo + token set (Profile)' };
    let tok; try { tok = unseal(u.gitTokenEnc, SECRET); } catch (e) { return { ok: false, note: 'stored token unreadable - set it again' }; }
    const out = [];
    for (const [name, content] of Object.entries(files)) {
      const path = 'projects/' + pdir + '/' + name, url = `https://api.github.com/repos/${m[1]}/${m[2]}/contents/${path}`, H = { Authorization: 'Bearer ' + tok, 'User-Agent': 'ds-quest', Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
      try { let sha1; const g = await fetch(url, { headers: H, signal: AbortSignal.timeout(15000) }); if (g.ok) sha1 = (await g.json()).sha; const r = await fetch(url, { method: 'PUT', headers: H, body: JSON.stringify({ message: 'Dhruv Patel Academy: ' + pdir + ' ' + name, content: Buffer.from(content, 'utf8').toString('base64'), sha: sha1 }), signal: AbortSignal.timeout(20000) }); out.push(r.ok); if (!r.ok) return { ok: false, note: 'GitHub said ' + r.status + ' - the token needs Contents: read & write on that repo' }; } catch (e) { return { ok: false, note: 'GitHub unreachable' }; }
    }
    return { ok: true, note: 'pushed to ' + u.gitRemote };
  };

  async function handle(req) {
    const path = req.path, M = req.method, body = req.body || {}, ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'ip';
    await seedOwner();
    /* ---- live project page ---- */
    let mm = /^\/(?:u|api\/live)\/([^/]+)\/([^/]+)\/?$/.exec(path);
    if (mm && M === 'GET') { const u = await getUser(mm[1]), pv = u && await kv.get('p:' + u.username.toLowerCase() + ':' + slug(mm[2])); if (!u || !pv) return { status: 404, html: '<h1>Not found</h1>' }; const p = JSON.parse(pv); p.pdir = slug(mm[2]); return { status: 200, html: liveHtml(u, p), headers: { 'Cache-Control': 'public, max-age=60' } }; }
    if (!path.startsWith('/api/')) return J(404, { error: 'not found' });
    const route = M + ' ' + path;

    if (route === 'POST /api/signup') {
      if (!await limit('signup:' + ip, 12, 3600)) return J(429, { error: 'Too many sign-ups from here. Try again later.' });
      const name = String(body.username || '').trim(), pw = String(body.password || ''), email = String(body.email || '').trim().toLowerCase(), disp = String(body.display || name).trim().slice(0, 30);
      if (!/^[A-Za-z0-9_.-]{3,24}$/.test(name)) return J(400, { error: 'Username: 3-24 letters, digits, _ . -' });
      if (pw.length < 8) return J(400, { error: 'Password needs at least 8 characters.' });
      if (!validEmail(email)) return J(400, { error: 'Enter a valid email address - it is how you reset a forgotten password.' });
      if (await getUser(name)) return J(409, { error: 'That username is taken.' });
      if (isReserved(name) && !(env.RESERVED_OK_EMAILS || '').toLowerCase().split(/[\s,;]+/).filter(Boolean).includes(email)) return J(409, { error: 'That name is reserved for the site owner and family. Pick another, or sign up with the email the owner approved.' });
      if (await kv.get('e:' + email)) return J(409, { error: 'That email already has an account. Use "Forgot password" if it is yours.' });
      const salt = crypto.randomBytes(16).toString('hex'), u = { username: name, display: disp || name, salt, hash: hashPw(pw, salt), email, role: 'learner', tier: 'standard', created: Date.now(), state: null, projects: {}, pwv: 0, nb: {} };
      await putUser(u); await kv.set('e:' + email, name.toLowerCase());
      return J(200, { user: pub(u), state: null, projects: {}, judge: tutorsOn().length > 0 }, await setSession(u));
    }
    if (route === 'POST /api/login') {
      const id = String(body.username || '').trim().toLowerCase(); if (!id) return J(400, { error: 'Enter your username or email.' });
      if (!await limit('login:' + ip + ':' + id, 10, 900)) return J(429, { error: 'Too many attempts. Wait 15 minutes or reset your password.' });
      const u = await getUser(id.includes('@') ? await kv.get('e:' + id) : id);
      if (!u || !verifyPw(String(body.password || ''), u)) return J(401, { error: 'Wrong username/email or password.' });
      return J(200, { user: pub(u), state: u.state, projects: summary(u), judge: tutorsOn().length > 0 }, await setSession(u));
    }
    if (route === 'POST /api/forgot') {
      if (!await limit('forgot:' + ip, 6, 3600)) return J(429, { error: 'Too many requests. Try again in an hour.' });
      const id = String(body.identifier || body.username || body.email || '').trim().toLowerCase(), cfg = mailConfig(env);
      const generic = { ok: true, mailConfigured: !!cfg, message: cfg ? 'If an account matches, a reset link is on its way (check spam). It works for 30 minutes.' : 'Password reset by email is not set up on this server yet. Ask the owner to add the SMTP settings.' };
      if (!cfg || !id) return J(200, generic);
      const u = await getUser(id.includes('@') ? await kv.get('e:' + id) : id);
      if (u && u.email) { const token = crypto.randomBytes(32).toString('hex'); await kv.set('rt:' + sha(token), u.username.toLowerCase(), 1800); const link = origin(req) + '/#/reset/' + token; try { await mail({ ...cfg, to: u.email, subject: 'Reset your Dhruv Patel Academy password', text: `Hi ${u.display},\n\nSomeone (hopefully you) asked to reset the password for "${u.username}" on Dhruv Patel Academy.\n\nOpen this link within 30 minutes to choose a new password:\n${link}\n\nIf it was not you, ignore this email - your password stays the same.\n` }); } catch (e) { console.error('mail failed', e.message); } }
      return J(200, generic);
    }
    if (route === 'POST /api/reset') {
      const token = String(body.token || ''), pw = String(body.password || ''); if (!/^[0-9a-f]{64}$/.test(token)) return J(400, { error: 'This reset link is not valid.' });
      if (!await limit('reset:' + ip, 20, 3600)) return J(429, { error: 'Too many attempts.' });
      if (pw.length < 8) return J(400, { error: 'Password needs at least 8 characters.' });
      const name = await kv.get('rt:' + sha(token)), u = name && await getUser(name); if (!u) return J(400, { error: 'This reset link has expired or was already used. Ask for a new one.' });
      u.salt = crypto.randomBytes(16).toString('hex'); u.hash = hashPw(pw, u.salt); u.pwv = (u.pwv || 0) + 1; await putUser(u); await kv.del('rt:' + sha(token));
      return J(200, { ok: true, user: pub(u), state: u.state, projects: summary(u), judge: tutorsOn().length > 0 }, await setSession(u));
    }
    /* ---- premium lesson files: never public, only for signed-in, entitled users ---- */
    if (route === 'GET /api/content/manifest') { const me = await authed(req); return J(200, { premium: CONTENT.premium(), entitled: CONTENT.entitled(me, env), gating: env.DSQ_GATING === 'on', available: CONTENT.available(), expected: CONTENT.manifest().files.filter(f => f.paid).length }, { 'Cache-Control': 'private, no-store' }); }
    const nbm = M === 'GET' && /^\/api\/content\/notebook\/([a-z0-9-]+\.ipynb)$/.exec(path);
    if (nbm) {
      let who = await authed(req); const k = req.query && req.query.key;
      if (!who && /^[A-Za-z0-9_-]{16,64}$/.test(k || '')) { const n = await kv.get('nk:' + k); if (n) who = await getUser(n); }
      if (!who) return J(401, { error: 'not signed in' });
      const nb = CONTENT.notebook(nbm[1]); if (!nb) return J(404, { error: 'not found' });
      if (!CONTENT.entitled(who, env).includes(nb.id)) return J(403, { error: 'This notebook is part of paid access.' });
      return J(200, JSON.parse(nb.text), { 'Cache-Control': 'private, no-store' });
    }
    if (route === 'GET /api/pay/config') return J(200, PAY.config(), { 'Cache-Control': 'no-store' });
    if (route === 'GET /api/leaderboard') {
      const me = await authed(req); if (!me) return J(401, { error: 'not signed in' });
      const top = await kv.zrevrange('lb', 0, 19), rows = []; for (let i = 0; i < top.length; i += 2) { const u = await getUser(top[i]); if (u) rows.push({ display: u.display, xp: +top[i + 1] || 0, level: (u.state && u.state.level) || 1, me: u.username === me.username }); }
      return J(200, { rows });
    }
    const u = await authed(req); if (!u) return J(401, { error: 'not signed in' });
    if (route === 'GET /api/content/bundle') {
      if (!(await limit('cb:' + u.username.toLowerCase(), 120, 3600))) return J(429, { error: 'Too many downloads. Try again later.' });
      const out = CONTENT.bundle(CONTENT.entitled(u, env));
      return J(200, { files: out.files, modules: out.modules, premium: CONTENT.premium(), gating: env.DSQ_GATING === 'on' }, { 'Cache-Control': 'private, no-store' });
    }
    if (route === 'GET /api/pay/mine') return J(200, PAY.mine(u));
    if (route === 'POST /api/pay/quote') { const q = await PAY.quote(body.code, body.currency, body.plan); return q.error ? J(400, { error: q.error }) : J(200, q); }
    if (route === 'POST /api/pay/order' || route === 'POST /api/pay/verify' || route === 'POST /api/pay/sync') {
      if (!await limit('pay:' + u.username.toLowerCase(), 40, 3600)) return J(429, { error: 'Too many payment attempts. Try again later.' });
      const r = route.endsWith('order') ? await PAY.createOrder(u, body.code, body.agree, { currency: body.currency, provider: body.provider, plan: body.plan, origin: origin(req) }) : route.endsWith('verify') ? await PAY.verify(u, body) : await PAY.sync(u); return J(r.status, r.json);
    }
    if (route.startsWith('GET /api/admin/pay') || /^POST \/api\/admin\/(grant|revoke|coupon)/.test(route)) {
      if (u.role !== 'admin') return J(403, { error: 'owner only' });
      if (route === 'GET /api/admin/pay') return J(200, await PAY.overview());
      const r = route.endsWith('/grant') ? await PAY.grant(body) : route.endsWith('/revoke') ? await PAY.revoke(body) : route.endsWith('/coupon/delete') ? await PAY.dropCoupon(body) : await PAY.makeCoupon(body); return J(r.status, r.json);
    }
    if (route === 'POST /api/logout') { const sid = cookie(req, 'dsq_sid'); if (sid) await kv.del('s:' + sid); return J(200, { ok: true }, { 'Set-Cookie': 'dsq_sid=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' }); }
    if (route === 'GET /api/me') return J(200, { user: pub(u), state: u.state, projects: summary(u), judge: tutorsOn().length > 0, nb: Object.entries(u.nb || {}).filter(e => e[1]).map(e => e[0]) });
    if (route === 'PUT /api/progress') {
      const st = body.state; if (!st || typeof st !== 'object') return J(400, { error: 'state missing' }); const raw = JSON.stringify(st); if (raw.length > MAX_PROGRESS) return J(413, { error: 'progress too large' });
      u.state = st; u.last = Date.now(); await putUser(u); await kv.zadd('lb', +st.xp || 0, u.username.toLowerCase()); return J(200, { ok: true });
    }
    if (route === 'PUT /api/me/profile') {
      const li = String(body.linkedin || '').trim(); if (li && !/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/(in|company)\/[A-Za-z0-9_%\-.]+\/?$/.test(li)) return J(400, { error: 'Use your profile address, like https://www.linkedin.com/in/your-name' });
      u.linkedin = li; if (body.display) u.display = String(body.display).trim().slice(0, 30) || u.display;
      if (body.email !== undefined && String(body.email).trim().toLowerCase() !== (u.email || '')) {
        const em = String(body.email).trim().toLowerCase(); if (!validEmail(em)) return J(400, { error: 'Enter a valid email address.' });
        if (u.email && !verifyPw(String(body.password || ''), u)) return J(403, { error: 'Enter your current password to change the email.' });
        const owner = await kv.get('e:' + em); if (owner && owner !== u.username.toLowerCase()) return J(409, { error: 'That email belongs to another account.' });
        if (u.email) await kv.del('e:' + u.email); u.email = em; await kv.set('e:' + em, u.username.toLowerCase());
      }
      await putUser(u); return J(200, { ok: true, user: pub(u) });
    }
    if (route === 'PUT /api/me/git') {
      const g = String(body.gitRemote || '').trim(); if (g && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+?(\.git)?\/?$/.test(g)) return J(400, { error: 'Use a URL like https://github.com/you/my-repo' });
      u.gitRemote = g; if (typeof body.gitToken === 'string' && body.gitToken) u.gitTokenEnc = seal(body.gitToken.slice(0, 200), SECRET); if (body.clearToken) delete u.gitTokenEnc; await putUser(u); return J(200, { ok: true, user: pub(u) });
    }
    if (route === 'PUT /api/me/vercel') { if (typeof body.vercelToken === 'string' && body.vercelToken) u.vercelTokenEnc = seal(body.vercelToken.slice(0, 200), SECRET); if (body.clear) delete u.vercelTokenEnc; await putUser(u); return J(200, { ok: true, user: pub(u) }); }
    if (route === 'GET /api/nb/key') { if (!u.nbKey) { u.nbKey = crypto.randomBytes(12).toString('hex'); await putUser(u); await kv.set('nk:' + u.nbKey, u.username.toLowerCase()); } return J(200, { key: u.nbKey, solved: Object.values(u.nb || {}).filter(Boolean).length }); }
    if (route === 'POST /api/project/save' || route === 'POST /api/project/publish') {
      const final = route.endsWith('publish'), pdir = slug(body.moduleId) + '-' + slug(body.variantId), meta = body.meta || {}, key = 'p:' + u.username.toLowerCase() + ':' + pdir;
      const old = JSON.parse((await kv.get(key)) || '{}'), files = Object.assign(old.files || {}, { 'solution.py': String((body.files || {})['solution.py'] || (old.files || {})['solution.py'] || '').slice(0, 120000) });
      const images = {}; let total = 0; for (const [n, d] of Object.entries(body.images || {})) { if (/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(String(d)) && (total += d.length) < 700000) images[slug(n.replace(/\.png$/, ''))] = d; }
      const rec = { moduleId: body.moduleId, variantId: body.variantId, meta: final ? Object.assign({}, meta, { skills: (meta.skills || []).slice(0, 8), output: String(meta.output || '').slice(0, 3000), logic: String(meta.logic || '').slice(0, 2000), milestones: (Array.isArray(meta.milestones) ? meta.milestones : []).slice(0, 12).map(x => String(x).slice(0, 120)) }) : (old.meta || {}), files, images: final ? images : (old.images || {}), updated: Date.now() };
      await kv.set(key, JSON.stringify(rec));
      const live = final ? `/u/${encodeURIComponent(u.username)}/${pdir}/` : ((u.projects[pdir] || {}).live || null);
      u.projects[pdir] = Object.assign(u.projects[pdir] || {}, { moduleId: body.moduleId, variantId: body.variantId, title: meta.title || (u.projects[pdir] || {}).title, updated: Date.now(), done: final || (u.projects[pdir] && u.projects[pdir].done) || false, live, meta: final ? { title: meta.title, pitch: meta.pitch, skills: meta.skills, module: meta.module } : (u.projects[pdir] || {}).meta });
      await putUser(u); let git = { committed: true, pushed: false, commit: '', note: 'saved to your account' };
      if (final && u.gitRemote && u.gitTokenEnc) { const r = await ghPush(u, pdir, { 'solution.py': files['solution.py'], 'README.md': `# ${meta.title || pdir}\n\n${meta.pitch || ''}\n\n## How it works\n\n${meta.logic || ''}\n` }); git = { committed: true, pushed: r.ok, commit: '', note: 'saved to your account; ' + r.note }; }
      return J(200, { ok: true, git, live });
    }
    if (route === 'POST /api/linkedin') {
      const pdir = slug(body.moduleId) + '-' + slug(body.variantId), pv = await kv.get('p:' + u.username.toLowerCase() + ':' + pdir); if (!pv) return J(404, { error: 'Publish the project first.' });
      const p = JSON.parse(pv), live = (u.projects[pdir] || {}).live; return J(200, { linkedin: linkedinPost(u, Object.assign({}, p.meta || {}, body.meta || {}), { site: live ? origin(req) + live : null, repo: u.gitRemote || null }) });
    }
    if (route === 'GET /api/ship/status') return J(200, { owner: false, hosted: true, github: { token: !!u.gitTokenEnc, remoteConfigured: !!u.gitRemote }, vercel: { loggedIn: !!u.vercelTokenEnc, token: !!u.vercelTokenEnc } });
    if (route === 'POST /api/ship') {
      const steps = [], pdir = slug(body.moduleId) + '-' + slug(body.variantId), pv = await kv.get('p:' + u.username.toLowerCase() + ':' + pdir); if (!pv) return J(404, { error: 'Publish the project first.' });
      const p = JSON.parse(pv), links = { site: origin(req) + ((u.projects[pdir] || {}).live || ''), repo: u.gitRemote || null }; steps.push({ name: 'Saved in your Dhruv Patel Academy account', ok: true, detail: links.site });
      const gp = await ghPush(u, pdir, { 'solution.py': (p.files || {})['solution.py'] || '', 'README.md': `# ${(p.meta || {}).title || pdir}\n\n${(p.meta || {}).pitch || ''}\n\n## How it works\n\n${(p.meta || {}).logic || ''}\n` }); steps.push({ name: 'GitHub', ok: gp.ok, detail: gp.note });
      if (u.vercelTokenEnc) {
        try { const tok = unseal(u.vercelTokenEnc, SECRET), name = ('dsq-' + u.username + '-' + pdir).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 52), html = liveHtml(u, Object.assign({ pdir }, p));
          const r = await fetch('https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, files: [{ file: 'index.html', data: html }], projectSettings: { framework: null }, target: 'production' }), signal: AbortSignal.timeout(40000) }); const j = await r.json();
          if (r.ok) { links.site = 'https://' + ((j.alias && j.alias[0]) || j.url); steps.push({ name: 'Vercel (your own account)', ok: true, detail: links.site }); } else steps.push({ name: 'Vercel (your own account)', ok: false, detail: (j.error && j.error.message) || ('HTTP ' + r.status) }); } catch (e) { steps.push({ name: 'Vercel (your own account)', ok: false, detail: 'could not reach Vercel' }); }
      } else steps.push({ name: 'Vercel (your own account)', ok: false, detail: 'Add a Vercel token in Profile to publish on your own Vercel (create a free account at vercel.com first). Your project already has a public page above.' });
      return J(200, { steps, links, linkedin: linkedinPost(u, p.meta || {}, links) });
    }
    /* Short-lived pass for the Django history service (backend/dsqhist). It checks the signature with the same DSQ_HIST_SECRET; no cookie or password ever goes there. */
    if (route === 'GET /api/history/token') {
      if (!env.DSQ_HIST_SECRET) return J(200, { available: false }, { 'Cache-Control': 'no-store' });
      const payload = Buffer.from(JSON.stringify({ u: u.username.toLowerCase(), exp: Math.floor(Date.now() / 1000) + 3 * 3600, v: 1 })).toString('base64url');
      return J(200, { available: true, token: payload + '.' + crypto.createHmac('sha256', env.DSQ_HIST_SECRET).update(payload).digest('hex'), expiresIn: 3 * 3600 - 60 }, { 'Cache-Control': 'private, no-store' });
    }
    if (route === 'GET /api/llm/status') { const on = tutorsOn(), rest = await Promise.all(on.map(t => kv.get('llm:cool:' + t.id).catch(() => null))); return J(200, { providers: on.map((t, i) => ({ id: t.id, kind: 'cloud', ok: !rest[i], vision: false, detail: rest[i] ? 'resting for a minute after a rate limit' : 'free tier' })), ready: on.length > 0 }); }
    if (route === 'POST /api/llm/ask' || route === 'POST /api/ask') {
      if (!await limit('ask:' + u.username, 20, 60)) return J(429, { error: 'Slow down a little - 20 questions a minute.' });
      const c = body.context || {}, q = String(body.question || '').slice(0, 1200); if (!q) return J(400, { error: 'Type a question.' });
      if (!tutorsOn().length) return J(200, { available: false, trail: [], hint: 'The AI tutor is not configured on this server (no tutor key set). The built-in explanations still work.' });
      const hist = (Array.isArray(body.history) ? body.history : []).slice(-6).map(m => (m.role === 'assistant' ? 'TUTOR: ' : 'STUDENT: ') + String(m.content || '').slice(0, 600)).join('\n');
      const prompt = 'You are a patient data-science tutor. Use only the context given and say when it is not enough.\n\n' + (typeof c === 'string' ? c : ['PAGE: ' + (c.page || ''), 'LESSON: ' + String(c.lesson || '').slice(0, 1800), c.code ? 'CODE:\n' + String(c.code).slice(0, 1800) : '', c.output ? 'OUTPUT:\n' + String(c.output).slice(0, 900) : '', c.marked ? 'MARKED: ' + String(c.marked).slice(0, 1500) : '', c.vizOut ? 'VISUAL: ' + String(c.vizOut).slice(0, 700) : ''].filter(Boolean).join('\n')) + (hist ? '\n\nEARLIER IN THIS CHAT:\n' + hist : '') + '\n\nQUESTION: ' + q;
      /* the same question about the same lesson text is answered once, then served from the KV (saves the free quotas) */
      const ck = 'llm:ans:' + crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 40);
      try { const hit = await kv.get(ck); if (hit) { const a = JSON.parse(hit); return J(200, { available: true, answer: a.answer, provider: a.provider, model: a.model, trail: [{ id: a.provider, ok: true }], cached: true }); } } catch (e) { }
      const r = await tutorChain(prompt);
      if (!r.text) return J(200, { available: false, trail: r.trail, hint: 'Every tutor model is busy right now. Try again in a minute; the built-in explanations still work.' });
      const answer = r.text.slice(0, 6000); try { if (!hist) await kv.set(ck, JSON.stringify({ answer, provider: r.provider, model: r.model }), 86400 * 7); } catch (e) { }
      return J(200, { available: true, answer, provider: r.provider, model: r.model, trail: r.trail });
    }
    if (route === 'POST /api/judge') return J(200, { available: false });
    return J(404, { error: 'not found' });
  }
  /* the notebook reports with a personal key and no cookie */
  async function handlePublic(req) {
    if (req.method === 'POST' && req.path === '/api/nb/report') {
      const key = String((req.body || {}).key || ''), name = key.length >= 16 ? await kv.get('nk:' + key) : null, u = name && await getUser(name); if (!u) return J(401, { error: 'unknown key - copy it again from the module page' });
      const qid = String(req.body.qid || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 40); if (!qid) return J(400, { error: 'qid missing' });
      u.nb = u.nb || {}; if (req.body.ok) u.nb[qid] = Date.now(); else if (!u.nb[qid]) u.nb[qid] = 0; await putUser(u); return J(200, { ok: true, solved: Object.values(u.nb).filter(Boolean).length });
    }
    if (req.method === 'POST' && (req.path === '/api/pay/webhook' || req.path === '/api/pay/webhook/stripe' || req.path === '/api/pay/webhook/paypal')) {
      if (!await limit('wh:' + (String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'ip'), 120, 60)) return J(429, { error: 'slow down' });
      return (r => J(r.status, r.json))(await (req.path.endsWith('/stripe') ? PAY.stripeWebhook : req.path.endsWith('/paypal') ? PAY.paypalWebhook : PAY.webhook)({ raw: req.raw === undefined ? null : req.raw, headers: req.headers || {}, body: req.body || {} }));
    }
    return null;
  }
  return { handle: async req => (await handlePublic(req)) || handle(req) };
};
