'use strict';
/* End-to-end test of the hosted API against an in-memory Redis-REST mock and a fake SMTP server.
   node tools/test_hosted.js */
const http = require('http'), net = require('net');
const createApi = require('../lib/hosted'), { redis } = require('../lib/redis');

/* ---- mock Redis REST ---- */
const store = new Map(), exp = new Map(), z = new Map();
const alive = k => { const e = exp.get(k); if (e && e < Date.now()) { store.delete(k); exp.delete(k); } return store.has(k); };
const run = a => {
  const [c, k, ...r] = a; switch (c.toUpperCase()) {
    case 'GET': return alive(k) ? store.get(k) : null;
    case 'SET': { store.set(k, r[0]); exp.delete(k); const i = r.findIndex(x => String(x).toUpperCase() === 'EX'); if (i >= 0) exp.set(k, Date.now() + r[i + 1] * 1000); return 'OK'; }
    case 'DEL': { const had = store.delete(k); exp.delete(k); return had ? 1 : 0; }
    case 'INCR': { const n = (alive(k) ? +store.get(k) : 0) + 1; store.set(k, String(n)); return n; }
    case 'EXPIRE': exp.set(k, Date.now() + r[0] * 1000); return 1;
    case 'ZADD': { const m = z.get(k) || new Map(); m.set(r[1], +r[0]); z.set(k, m); return 1; }
    case 'ZREVRANGE': { const m = [...(z.get(k) || new Map())].sort((x, y) => y[1] - x[1]).slice(+r[0], +r[1] + 1); return m.flatMap(([n, s]) => [n, String(s)]); }
  } throw new Error('mock: ' + c);
};
const redisSrv = http.createServer((q, s) => { let b = ''; q.on('data', d => b += d); q.on('end', () => { try { s.end(JSON.stringify({ result: run(JSON.parse(b)) })); } catch (e) { s.end(JSON.stringify({ error: e.message })); } }); });

/* ---- fake SMTP (plain) ---- */
const mails = [];
const smtp = net.createServer(sock => {
  let data = false, buf = '', cur = { raw: '' }; sock.write('220 mock\r\n');
  sock.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\r\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 2);
    if (data) { if (line === '.') { data = false; mails.push(cur); cur = { raw: '' }; sock.write('250 queued\r\n'); } else cur.raw += line + '\n'; continue; }
    if (/^EHLO/.test(line)) sock.write('250-mock\r\n250 AUTH LOGIN\r\n'); else if (line === 'AUTH LOGIN') { cur.auth = 1; sock.write('334 VXNlcm5hbWU6\r\n'); } else if (cur.auth === 1) { cur.auth = 2; sock.write('334 UGFzc3dvcmQ6\r\n'); } else if (cur.auth === 2) { cur.auth = 3; sock.write('235 ok\r\n'); }
    else if (/^MAIL FROM/.test(line) || /^RCPT TO/.test(line)) sock.write('250 ok\r\n'); else if (line === 'DATA') { data = true; sock.write('354 go\r\n'); } else if (line === 'QUIT') sock.end('221 bye\r\n'); } });
});

let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  await new Promise(r => redisSrv.listen(0, '127.0.0.1', r)); await new Promise(r => smtp.listen(0, '127.0.0.1', r));
  const env = { KV_REST_API_URL: 'http://127.0.0.1:' + redisSrv.address().port, KV_REST_API_TOKEN: 't', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.address().port), SMTP_SECURE: '0', SMTP_USER: 'bot@example.com', SMTP_PASS: 'x', APP_URL: 'https://app.test', DSQ_SECRET: 'unit-test-secret' };
  const api = createApi({ kv: redis(env), env });
  let cookieJar = ''; const call = async (method, path, body, o = {}) => { const r = await api.handle({ method, path, body, headers: { cookie: o.nocookie ? '' : cookieJar, 'x-forwarded-for': o.ip || '1.2.3.4' } }); const sc = r.headers && r.headers['Set-Cookie']; if (sc) cookieJar = sc.split(';')[0]; return r; };
  let r = await call('POST', '/api/signup', { username: 'ana_k', password: 'pass12345', email: 'Ana@Example.com', display: 'Ana' }); ok(r.status === 200 && r.json.user.username === 'ana_k', 'signup works');
  ok((await call('POST', '/api/signup', { username: 'ana_k', password: 'pass12345', email: 'x@y.co' })).status === 409, 'duplicate username refused');
  ok((await call('POST', '/api/signup', { username: 'bob_k', password: 'pass12345', email: 'ana@example.com' })).status === 409, 'duplicate email refused');
  ok((await call('POST', '/api/signup', { username: 'dstar1', password: 'pass12345', email: 'd@y.co' })).status === 409, 'reserved look-alike name refused');
  ok((await call('POST', '/api/signup', { username: 'cy_k', password: 'short', email: 'c@y.co' })).status === 400, 'short password refused');
  ok((await call('POST', '/api/signup', { username: 'cy_k', password: 'pass12345', email: 'nope' })).status === 400, 'bad email refused');
  r = await call('GET', '/api/me'); ok(r.status === 200 && r.json.user.email === 'a***@example.com', 'me works with the session cookie; email is masked');
  r = await call('PUT', '/api/progress', { state: { xp: 120, level: 2, lessons: { 'python/x': 1 } } }); ok(r.status === 200, 'progress saved');
  /* a second browser logs in with the EMAIL and sees the saved progress */
  cookieJar = ''; r = await call('POST', '/api/login', { username: 'ana@example.com', password: 'pass12345' }); ok(r.status === 200 && r.json.state && r.json.state.xp === 120, 'login by email restores saved progress');
  cookieJar = ''; r = await call('POST', '/api/login', { username: 'ana_k', password: 'WRONGpass1' }); ok(r.status === 401, 'wrong password refused');
  r = await call('POST', '/api/login', { username: 'ana_k', password: 'pass12345' }); ok(r.status === 200, 'login by username');
  r = await call('GET', '/api/leaderboard'); ok(r.json.rows.length === 1 && r.json.rows[0].xp === 120 && r.json.rows[0].me, 'leaderboard lists saved xp');
  /* forgot / reset */
  const oldJar = cookieJar; r = await call('POST', '/api/forgot', { identifier: 'ana@example.com' }, { nocookie: true }); ok(r.status === 200 && r.json.mailConfigured, 'forgot request accepted');
  ok(mails.length === 1 && /To: ana@example\.com/.test(mails[0].raw), 'a reset email was sent over SMTP');
  const bodyText = Buffer.from(mails[0].raw.split('\n\n').slice(1).join('').replace(/\n/g, ''), 'base64').toString('utf8'), token = (/#\/reset\/([0-9a-f]{64})/.exec(bodyText) || [])[1]; ok(!!token && /^https:\/\/app\.test/.test(/https:\/\/\S+/.exec(bodyText)[0]), 'email holds a one-time link on the app origin');
  r = await call('POST', '/api/forgot', { identifier: 'ghost@nowhere.io' }, { nocookie: true }); ok(r.status === 200 && mails.length === 1, 'unknown account: same answer, no email sent');
  ok((await call('POST', '/api/reset', { token: 'a'.repeat(64), password: 'newpass123' }, { nocookie: true })).status === 400, 'random token refused');
  r = await call('POST', '/api/reset', { token, password: 'newpass123' }, { nocookie: true }); ok(r.status === 200 && r.json.state.xp === 120, 'reset with the token works and signs in');
  ok((await call('POST', '/api/reset', { token, password: 'again12345' }, { nocookie: true })).status === 400, 'the token cannot be used twice');
  cookieJar = oldJar; ok((await call('GET', '/api/me')).status === 401, 'old sessions stop working after a reset');
  cookieJar = ''; ok((await call('POST', '/api/login', { username: 'ana_k', password: 'pass12345' })).status === 401 && (await call('POST', '/api/login', { username: 'ana_k', password: 'newpass123' })).status === 200, 'old password dead, new password works');
  /* rate limit */
  let blocked = false; for (let i = 0; i < 12; i++) { const x = await call('POST', '/api/login', { username: 'ana_k', password: 'bad' + i }, { ip: '9.9.9.9', nocookie: true }); if (x.status === 429) blocked = true; } ok(blocked, 'repeated bad logins are rate limited');
  /* projects + live page + linkedin */
  r = await call('POST', '/api/project/publish', { moduleId: 'eda', variantId: 'cleansweep', files: { 'solution.py': 'print("<b>hi</b>")' }, images: { chart: 'data:image/png;base64,iVBORw0KGgo=' }, meta: { title: 'CleanSweep', pitch: 'Clean a messy export.', skills: ['pandas', 'EDA'], module: 'EDA', logic: 'I fixed types then outliers.', output: 'rows 300\nmissing 0', dataset: 'messy.csv (300 rows)' } });
  ok(r.status === 200 && r.json.live === '/u/ana_k/eda-cleansweep/', 'project published with a live path');
  r = await call('GET', '/u/ana_k/eda-cleansweep/'); ok(r.status === 200 && r.html.includes('CleanSweep') && r.html.includes('&lt;b&gt;hi&lt;/b&gt;') && !r.html.includes('<b>hi</b>'), 'live page renders and escapes the code');
  r = await call('GET', '/api/live/ana_k/eda-cleansweep'); ok(r.status === 200, 'rewrite path /api/live works');
  r = await call('POST', '/api/linkedin', { moduleId: 'eda', variantId: 'cleansweep' }); ok(r.status === 200 && /Key results: rows 300/.test(r.json.linkedin.text) && /Live: https:\/\/app\.test\/u\/ana_k/.test(r.json.linkedin.text), 'LinkedIn post has the details and the live link');
  r = await call('GET', '/api/me'); ok(r.json.projects['eda-cleansweep'].done === true, 'project is listed in the account');
  /* token sealing + notebook key */
  r = await call('PUT', '/api/me/vercel', { vercelToken: 'secret-token' }); ok(r.status === 200 && r.json.user.hasVercel && !JSON.stringify(r.json).includes('secret-token'), 'vercel token stored, never returned');
  ok(![...store.values()].some(v => v.includes('secret-token')), 'vercel token is encrypted at rest');
  const k = (await call('GET', '/api/nb/key')).json.key; r = await call('POST', '/api/nb/report', { key: k, qid: 'np-9-1', ok: true }, { nocookie: true }); ok(r.status === 200 && r.json.solved === 1, 'notebook reports a solved question with its key');
  ok((await call('GET', '/api/me', null, { nocookie: true })).status === 401, 'no cookie = not signed in');
  /* tutor chain: first model rate-limited -> next one answers; rests; same question is cached; all down -> honest "busy" */
  r = await call('POST', '/api/llm/ask', { question: 'what is a mean?' }); ok(r.status === 200 && r.json.available === false && /not configured/.test(r.json.hint), 'no tutor key: honest hint, no crash');
  const seen = []; let groqUp = true;
  const fake = async (url) => { seen.push(url); const g = /generativelanguage/.test(url), q = /groq/.test(url); const reply = (st, body) => ({ ok: st < 400, status: st, json: async () => body });
    if (g) return reply(429, { error: { message: 'quota' } }); if (q && groqUp) return reply(200, { choices: [{ message: { content: 'The mean is the sum divided by the count.' } }] }); return reply(503, {}); };
  const api2 = createApi({ kv: redis(env), env: Object.assign({}, env, { GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q' }), fetchFn: fake });
  const call2 = async (method, path, body) => api2.handle({ method, path, body, headers: { cookie: cookieJar, 'x-forwarded-for': '1.2.3.4' } });
  r = await call2('POST', '/api/llm/ask', { question: 'what is a mean?', context: { page: 'stats', lesson: 'averages' } });
  ok(r.status === 200 && r.json.available && r.json.provider === 'groq' && r.json.trail.length === 2 && r.json.trail[0].ok === false && Array.isArray(r.json.trail), 'gemini 429 falls through to groq; the response carries a trail');
  ok(!seen.some(u => /key=/.test(u)), 'the Gemini key is never put in the URL');
  r = await call2('GET', '/api/llm/status'); ok(r.json.ready && r.json.providers.find(p => p.id === 'gemini').ok === false && r.json.providers.find(p => p.id === 'groq').ok === true, 'status shows gemini resting, groq ready');
  const n = seen.length; r = await call2('POST', '/api/llm/ask', { question: 'what is a mean?', context: { page: 'stats', lesson: 'averages' } }); ok(r.json.cached === true && seen.length === n, 'the same question is served from the cache without calling a model');
  groqUp = false; r = await call2('POST', '/api/llm/ask', { question: 'and the median?', context: { page: 'stats' } }); ok(r.status === 200 && r.json.available === false && /busy/.test(r.json.hint), 'every model down: honest busy message, 200 not a crash');
  /* history pass for the Django service */
  r = await call('GET', '/api/history/token'); ok(r.status === 200 && r.json.available === false, 'history token: off when no shared secret is set');
  const api3 = createApi({ kv: redis(env), env: Object.assign({}, env, { DSQ_HIST_SECRET: 'hist-shared' }) });
  const hr = await api3.handle({ method: 'GET', path: '/api/history/token', headers: { cookie: cookieJar, 'x-forwarded-for': '1.2.3.4' } });
  const [hp, hs] = hr.json.token.split('.'), pl = JSON.parse(Buffer.from(hp, 'base64url').toString());
  ok(hr.json.available && pl.u === 'ana_k' && pl.v === 1 && pl.exp > Date.now() / 1000 + 3000 && hs === require('crypto').createHmac('sha256', 'hist-shared').update(hp).digest('hex'), 'history token: signed with the shared secret, carries the learner and an expiry');
  ok((await api3.handle({ method: 'GET', path: '/api/history/token', headers: { 'x-forwarded-for': '1.2.3.4' } })).status === 401, 'history token: needs sign-in');
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall hosted API checks passed'); redisSrv.close(); smtp.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
