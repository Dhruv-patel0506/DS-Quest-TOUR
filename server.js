'use strict';
/* =====================================================================
   DS Quest server  -  zero dependencies (Node 18+)
   ---------------------------------------------------------------------
   * serves ./public
   * accounts: scrypt-hashed passwords, httpOnly session cookie
   * progress: one JSON blob per user (XP, lessons, skill log, project state)
   * projects: writes the learner's project into workspace/<user>/<project>/,
     commits it with git (one commit per milestone + one when finished) and
     pushes ONLY if the admin has configured a remote in data/config.json
   * serves finished projects at /u/<user>/<project>/
   * optional /api/judge proxy to a local OpenAI-compatible model
   Run:  node server.js     (PORT, HOST env vars are honoured)
   ===================================================================== */
const http = require('http');
const fs = require('fs');
const { sendMail, mailConfig } = require('./lib/mailer');
const CONTENT = require('./lib/content');
const path = require('path');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = process.env.DSQ_DATA_DIR || path.join(ROOT, 'data'); /* DSQ_DATA_DIR lets tests use a throwaway folder */
const WORK = path.join(ROOT, 'workspace');
const PORT = +process.env.PORT || 5177;
const HOST = process.env.HOST || '127.0.0.1';
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });

/* ---------- tiny JSON "database" ---------- */
const F_USERS = path.join(DATA, 'users.json');
const F_SESS = path.join(DATA, 'sessions.json');
const F_CONF = path.join(DATA, 'config.json');
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const writeJson = (f, o) => { const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(o)); fs.renameSync(t, f); };
let users = readJson(F_USERS, {});          // key = lower-case username
let sessions = readJson(F_SESS, {});        // token -> {u, t}
let config = readJson(F_CONF, { remote: '', judgeUrl: '', judgeModel: '' });
const saveUsers = () => writeJson(F_USERS, users);
const saveSessions = () => writeJson(F_SESS, sessions);

/* ---------- passwords ---------- */
const hashPw = (pw, saltHex) => crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 }).toString('hex');
const newCred = pw => { const salt = crypto.randomBytes(16).toString('hex'); return { salt, hash: hashPw(pw, salt) }; };
const checkPw = (u, pw) => {
  const h = Buffer.from(hashPw(pw, u.salt), 'hex'), g = Buffer.from(u.hash, 'hex');
  return h.length === g.length && crypto.timingSafeEqual(h, g);
};

/* The owner account. Only a scrypt hash is used, never the password, and it is NOT kept in the source:
   put {"username","display","salt","hash"} in data/admin.json (git-ignored) to seed the owner/flagship account. */
let ADMIN = null;
try { ADMIN = JSON.parse(fs.readFileSync(path.join(DATA, 'admin.json'), 'utf8')); } catch (e) { console.log('(no data/admin.json: no owner account is seeded)'); }
if (ADMIN && !users[ADMIN.username.toLowerCase()]) {
  users[ADMIN.username.toLowerCase()] = { username: ADMIN.username, display: ADMIN.display, salt: ADMIN.salt, hash: ADMIN.hash,
    role: 'admin', tier: 'flagship', created: Date.now(), state: null, projects: {} };
  saveUsers();
}

/* ---------- names the owner reserved (no look-alike sign-ups) ---------- */
const RESERVED = ['dhruv', 'dstar', 'distar', 'dharmesh', 'darmesh', 'dharmesha', 'asha'];
const lev = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/1/g, 'i').replace(/0/g, 'o').replace(/3/g, 'e').replace(/\$/g, 's');
const isReserved = name => {
  const n = norm(name);
  return RESERVED.some(r => (r.length < 5 ? lev(n, r) <= 1 : n.includes(r) || lev(n, r) <= 1));
};

/* ---------- helpers ---------- */
const { SEC, SANDBOX } = require('./lib/shared');
const send = (res, code, obj, headers = {}) => {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
  res.writeHead(code, Object.assign({ 'Content-Type': typeof obj === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store' }, SEC, headers));
  res.end(body);
};
const readBody = (req, limit = 1.5e6) => new Promise((ok, no) => {
  let n = 0; const chunks = [];
  req.on('data', c => { n += c.length; if (n > limit) { no(new Error('too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { no(new Error('bad json')); } });
  req.on('error', no);
});
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(a => a[0]).map(a => [a[0], a.slice(1).join('=')]));
const sessionUser = req => {
  const tok = cookies(req).dsq; const s = tok && sessions[tok];
  if (!s) return null;
  if (Date.now() - s.t > 30 * 864e5) { delete sessions[tok]; return null; }
  return users[s.u] || null;
};
const cleanRemote = r => { r = String(r || '').trim(); return /^https:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/[\w.-]+\/[\w.-]+?(\.git)?$/.test(r) ? r : ''; };
const maskEmail = e => (e ? e.replace(/^(.).*(@.*)$/, '$1***$2') : '');
const validEmail = e => /^[^\s@<>]{1,64}@[^\s@<>]{1,200}\.[^\s@<>]{2,}$/.test(String(e || '')) && String(e).length <= 254;
const resetTokens = new Map(); /* sha256(token) -> { name, exp } */
const userByEmail = e => Object.values(users).find(x => x.email && x.email === String(e).toLowerCase());
const publicUser = u => ({ email: maskEmail(u.email), hasEmail: !!u.email, username: u.username, display: u.display, role: u.role || 'learner', tier: u.tier || 'standard', gitRemote: u.gitRemote || '', hasToken: !!u.gitToken, linkedin: u.linkedin || '' });
const safeSeg = s => String(s).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'x';

/* ---------- login throttle ---------- */
const attempts = new Map();
const throttled = key => {
  const now = Date.now(); const a = (attempts.get(key) || []).filter(t => now - t < 60000);
  attempts.set(key, a); return a.length >= 6;
};
const noteFail = key => { const a = attempts.get(key) || []; a.push(Date.now()); attempts.set(key, a); };

/* ---------- git ---------- */
const git = (cwd, args, timeout = 30000) => new Promise(ok => {
  execFile('git', args, { cwd, timeout, windowsHide: true }, (err, stdout, stderr) => ok({ ok: !err, out: String(stdout || '').trim(), err: String(stderr || (err && err.message) || '').trim() }));
});
async function commitProject(u, projDir, message) {
  const repo = path.join(WORK, safeSeg(u.username));
  fs.mkdirSync(repo, { recursive: true });
  if (!fs.existsSync(path.join(repo, '.git'))) {
    const r = await git(repo, ['init', '-b', 'main']);
    if (!r.ok) return { committed: false, pushed: false, note: 'git is not available: ' + r.err };
  }
  await git(repo, ['config', 'user.name', u.display || u.username]);
  await git(repo, ['config', 'user.email', safeSeg(u.username) + '@dsquest.local']);
  await git(repo, ['add', '-A']);
  const st = await git(repo, ['status', '--porcelain']);
  let committed = false;
  if (st.out) {
    const c = await git(repo, ['commit', '-m', message]);
    committed = c.ok;
    if (!c.ok) return { committed: false, pushed: false, note: c.err.slice(0, 300) };
  }
  const head = await git(repo, ['rev-parse', '--short', 'HEAD']);
  let pushed = false, pushNote = 'no repo connected yet (add yours in Profile); committed locally';
  const remote = u.gitRemote || (u.role === 'admin' ? config.remote : '');
  if (remote) {
    const tok = u.gitToken || '';
    if (u.role !== 'admin' && !tok) pushNote = 'repo saved; add an access token in Profile to enable auto-push (committed locally)';
    else {
      /* learners push ONLY with their own token and never through this machine's stored git credentials */
      const url = tok && /^https:\/\//.test(remote) ? remote.replace('https://', 'https://x-access-token:' + encodeURIComponent(tok) + '@') : remote;
      const args = tok ? ['-c', 'credential.helper=', 'push', url, 'HEAD:main'] : ['push', url, 'HEAD:main'];
      const p = await git(repo, args, 60000);
      pushed = p.ok; pushNote = p.ok ? 'pushed to ' + remote : 'push failed (the repo must exist and be empty): ' + (tok ? p.err.split(tok).join('***') : p.err).slice(0, 220);
    }
  }
  return { committed: committed || !!head.out, commit: head.out, pushed, note: pushNote };
}

const runCli = (cmd, args, cwd, timeout = 120000, env) => new Promise(ok => {
  const win = process.platform === 'win32' && cmd !== 'git';
  execFile(win ? cmd + '.cmd' : cmd, args, { cwd, timeout, windowsHide: true, shell: win, env: Object.assign({}, process.env, env || {}), maxBuffer: 4e6 },
    (err, stdout, stderr) => ok({ ok: !err, out: String(stdout || '').trim(), err: String(stderr || (err && err.message) || '').trim() }));
});
const ghApi = async (token, method, url, body) => {
  const r = await fetch('https://api.github.com' + url, { method, headers: { Authorization: 'Bearer ' + token, 'User-Agent': 'ds-quest', Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(25000) });
  const j = await r.json().catch(() => ({})); return { status: r.status, j };
};
const linkedinPost = (u, p, links) => {
  const tags = (p.skills || []).slice(0, 5).map(x => '#' + String(x).replace(/[^A-Za-z0-9]/g, ''));
  const text = 'I just shipped a new data project: ' + (p.title || 'my project') + '.\n\n' + (p.pitch ? p.pitch.slice(0, 230) + (p.pitch.length > 230 ? '...' : '') + '\n\n' : '') +
    (p.logic ? 'How it works: ' + String(p.logic).replace(/\s+/g, ' ').slice(0, 280) + (String(p.logic).length > 280 ? '...' : '') + '\n\n' : '') + (Array.isArray(p.milestones) && p.milestones.length ? 'What I built, step by step:\n' + p.milestones.slice(0, 8).map((x, i) => (i + 1) + '. ' + String(x).slice(0, 90)).join('\n') + '\n\n' : '') + 'What I built it with: ' + ((p.skills || []).slice(0, 5).join(', ') || 'Python') + '.\n' + (links.site ? 'Live: ' + links.site + '\n' : '') + (links.repo ? 'Code: ' + links.repo + '\n' : '') + (u.linkedin ? 'More about me: ' + u.linkedin + '\n' : '') +
    '\nBuilt step by step in DS Quest, learning data science by building.\n\n' + tags.concat(['#DataScience', '#Python', '#BuildInPublic']).slice(0, 8).join(' ');
  return { text, url: 'https://www.linkedin.com/feed/?shareActive=true&text=' + encodeURIComponent(text), shareUrl: links.site ? 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(links.site) : null };
};

/* =====================================================================
   LLM / VLM gateway: an ordered chain of FREE providers with automatic fallback.
   Default order keeps your GPU idle: Ollama cloud model -> Gemini free tier -> Groq free tier -> OpenRouter free models -> a SMALL local model.
   Keys come only from environment variables (never stored, never sent to the browser).
   ===================================================================== */
const LLM_HOST_OK = /^(localhost|127\.0\.0\.1|api\.groq\.com|generativelanguage\.googleapis\.com|openrouter\.ai|api\.mistral\.ai|api\.cerebras\.ai|integrate\.api\.nvidia\.com|api\.together\.xyz|ollama\.com)$/;
function defaultProviders() {
  const E = process.env, p = [];
  p.push({ id: 'ollama-cloud', kind: 'ollama', base: 'http://127.0.0.1:11434', model: 'auto:cloud', vision: true, note: 'a big model hosted by Ollama (uses no VRAM). One-time: ollama signin, then ollama pull gpt-oss:120b-cloud (and qwen3-vl:235b-cloud for pictures). Names change - check ollama.com/search?c=cloud' });
  if (E.GEMINI_API_KEY) p.push({ id: 'gemini', kind: 'gemini', model: 'gemini-2.5-flash', vision: true, keyEnv: 'GEMINI_API_KEY', note: 'free tier, sees images' });
  if (E.GROQ_API_KEY) p.push({ id: 'groq', kind: 'openai', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', visionModel: 'meta-llama/llama-4-scout-17b-16e-instruct', keyEnv: 'GROQ_API_KEY', note: 'free tier, very fast' });
  if (E.OPENROUTER_API_KEY) p.push({ id: 'openrouter', kind: 'openai', base: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free', visionModel: 'qwen/qwen2.5-vl-72b-instruct:free', keyEnv: 'OPENROUTER_API_KEY', note: 'models with the :free suffix' });
  p.push({ id: 'ollama-local', kind: 'ollama', base: 'http://127.0.0.1:11434', model: 'auto:local', vision: true, note: 'small local model as the offline fallback (uses VRAM only while answering, then unloads)' });
  if (config.judgeUrl) p.push({ id: 'custom', kind: 'openai', base: config.judgeUrl.replace(/\/chat\/completions.*$/, ''), model: config.judgeModel || 'local', note: 'your own OpenAI-compatible endpoint' });
  return p;
}
const providers = () => (config.llm && Array.isArray(config.llm.providers) && config.llm.providers.length ? config.llm.providers : defaultProviders());
const hostOf = u => { try { return new URL(u).hostname; } catch (e) { return ''; } };
const fetchJson = async (url, opt, ms) => { const r = await fetch(url, Object.assign({ signal: AbortSignal.timeout(ms || 45000) }, opt)); const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch (e) { } if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (j.error && (j.error.message || j.error) || t.slice(0, 120))); return j; };
let tagCache = { t: 0, v: null };
async function ollamaModels(base) {
  if (tagCache.v && Date.now() - tagCache.t < 20000) return tagCache.v;
  try { const j = await fetchJson(base + '/api/tags', {}, 2500); tagCache = { t: Date.now(), v: (j.models || []).map(m => m.name) }; } catch (e) { tagCache = { t: Date.now(), v: [] }; }
  return tagCache.v;
}
const VIS_RE = /(vl|vision|llava|gemma3|minicpm-v|moondream|llama4|gpt-4o|pixtral|mistral-small3)/i;
async function pickOllama(pv, wantVision) {
  const all = await ollamaModels(pv.base), cloud = all.filter(n => /cloud$/.test(n)), local = all.filter(n => !/cloud$/.test(n));
  if (pv.model === 'auto:cloud') return (wantVision ? cloud.find(n => VIS_RE.test(n)) : cloud.find(n => !VIS_RE.test(n)) || cloud[0]) || null;
  if (pv.model === 'auto:local') { const small = local.filter(n => !/(70b|72b|120b|235b|405b|480b|671b|32b|34b)/i.test(n)); return (wantVision ? small.find(n => VIS_RE.test(n)) : small.find(n => /(qwen|llama|gemma|phi|mistral)/i.test(n)) || small[0]) || null; }
  return pv.model;
}
async function callProvider(pv, messages, image, ms) {
  const wantVision = !!image;
  if (pv.kind === 'ollama') {
    const model = (await pickOllama(pv, wantVision)) || (wantVision ? await pickOllama(pv, false) : null); if (!model) throw new Error('no suitable ' + (pv.model.endsWith('cloud') ? 'cloud' : 'local') + ' model installed' + (wantVision ? ' (needs a vision model)' : ''));
    const useImg = wantVision && (pv.forceVision || VIS_RE.test(model));
    const msgs = messages.map((m, i) => (i === messages.length - 1 && useImg ? Object.assign({}, m, { images: [image.b64] }) : m));
    const j = await fetchJson(pv.base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: msgs, stream: false, keep_alive: '1m', options: { temperature: 0.2, num_ctx: 6144 } }) }, ms);
    return { text: j.message && j.message.content, model, sawImage: useImg };
  }
  const key = pv.keyEnv ? process.env[pv.keyEnv] : ''; if (pv.keyEnv && !key) throw new Error('no ' + pv.keyEnv + ' set');
  if (pv.kind === 'gemini') {
    const sys = messages.find(m => m.role === 'system'), turns = messages.filter(m => m.role !== 'system').map((m, i, a) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }].concat(i === a.length - 1 && image ? [{ inline_data: { mime_type: image.mime, data: image.b64 } }] : []) }));
    const j = await fetchJson('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(pv.model) + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ systemInstruction: sys ? { parts: [{ text: sys.content }] } : undefined, contents: turns, generationConfig: { temperature: 0.2, maxOutputTokens: 1400 } }) }, ms);
    const t = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts.map(x => x.text).join(''); return { text: t, model: pv.model, sawImage: !!image };
  }
  /* openai-compatible (Groq, OpenRouter, Mistral, a local llama.cpp server...) */
  const model = image && pv.visionModel ? pv.visionModel : pv.model, useImg = !!image && !!pv.visionModel;
  const msgs = messages.map((m, i) => (i === messages.length - 1 && useImg ? { role: m.role, content: [{ type: 'text', text: m.content }, { type: 'image_url', image_url: { url: 'data:' + image.mime + ';base64,' + image.b64 } }] } : m));
  const j = await fetchJson(pv.base + '/chat/completions', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { Authorization: 'Bearer ' + key } : {}), body: JSON.stringify({ model, messages: msgs, temperature: 0.2, max_tokens: 1400 }) }, ms);
  return { text: j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content, model, sawImage: useImg };
}
/* tries each provider in order; returns the first real answer plus the trail of what happened */
async function llmChat(messages, image, opts = {}) {
  const trail = [];
  for (const pv of providers()) {
    if (pv.disabled) continue; const t0 = Date.now();
    try { const r = await callProvider(pv, messages, image, opts.timeout || 45000); if (!r.text || !String(r.text).trim()) throw new Error('empty answer'); trail.push({ id: pv.id, ok: true, ms: Date.now() - t0, model: r.model }); return { text: String(r.text).trim(), provider: pv.id, model: r.model, sawImage: r.sawImage, trail }; }
    catch (e) { trail.push({ id: pv.id, ok: false, ms: Date.now() - t0, err: String(e.message).slice(0, 140) }); }
  }
  return { text: null, trail };
}
const TUTOR_SYSTEM = 'You are the friendly tutor inside DS Quest, a course that teaches data science, ML, deep learning, RAG and agents by building. ' +
  'Answer the learner\'s question using ONLY the lesson context, code, output and marked region supplied, plus well-established general knowledge. ' +
  'If the context does not contain what you need, say so plainly and explain the general idea instead of guessing. Never invent function names, numbers or outputs. ' +
  'Teach, do not just tell: first the idea in plain words, then what each relevant line does, then a tiny example or a next experiment. ' +
  'When you give code use fenced ```python blocks that run in Pyodide (numpy, pandas, matplotlib, scikit-learn, networkx), keep it short, and explain it line by line. ' +
  'If the learner sent a sketch description, restate what you understood, improve it, then give the code and explain it. Keep answers under about 350 words.';
const askLog = new Map();
const allowAsk = u => { const now = Date.now(), a = (askLog.get(u) || []).filter(t => now - t < 60000); askLog.set(u, a); if (a.length >= 20) return false; a.push(now); return true; };
const PAGE_CSS = 'body{font-family:system-ui,Segoe UI,sans-serif;max-width:860px;margin:30px auto;padding:0 16px;color:#1d2421;background:#f4f6f2;line-height:1.55}' +
  'pre{background:#12161d;color:#e3e9f0;padding:12px 14px;border-radius:10px;overflow:auto;font-size:13px}img{max-width:100%;border:1px solid #d6ddd8;border-radius:10px;background:#fff}' +
  'h1{margin-bottom:0}.meta{color:#5e6a64}.tag{display:inline-block;background:#dceafb;color:#1c6ed0;padding:2px 10px;border-radius:99px;font-size:13px;margin-right:6px}' +
  'table{border-collapse:collapse}td,th{border:1px solid #d6ddd8;padding:4px 10px}';
const escH = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------- the learner's own JupyterLab, started from the page (local server only) ----------
   GET /api/jupyter/status -> { state: idle|installing|starting|ready|stopped|error, installed, python, url, token, log[] }
   POST /api/jupyter/start { install } starts public/dsquest_jupyter.py in the background; it never installs anything unless install is true. */
const JY = { state: 'idle', log: [], child: null, py: null, installed: null };
const jyHome = path.join(require('os').homedir(), 'dsquest');
const jyConn = () => { try { return JSON.parse(fs.readFileSync(path.join(jyHome, 'connection.json'), 'utf8')); } catch (e) { return null; } };
const jyAlive = async c => { if (!c) return false; try { const r = await fetch(c.url + '/api/status', { headers: { Authorization: 'token ' + c.token }, signal: AbortSignal.timeout(2500) }); return r.ok; } catch (e) { return false; } };
const jyRun = (cmd, args) => new Promise(ok => execFile(cmd, args, { timeout: 15000, windowsHide: true }, (err, out) => ok(err ? null : String(out).trim())));
async function jyPython() {
  if (JY.py) return JY.py;
  for (const c of [['python', []], ['py', ['-3']], ['python3', []]]) { if (await jyRun(c[0], c[1].concat(['-c', 'print(1)'])) === '1') return (JY.py = c); }
  return null;
}
async function jyInstalled() { const p = await jyPython(); if (!p) return null; return (await jyRun(p[0], p[1].concat(['-c', 'import jupyterlab;print(1)']))) === '1'; }
async function jyStatus() {
  if (JY.state !== 'ready' || !(await jyAlive(JY.conn))) { const c = jyConn(); if (await jyAlive(c)) { JY.conn = c; JY.state = 'ready'; } else if (JY.state === 'ready') JY.state = 'stopped'; }
  if (JY.installed === null || JY.state === 'idle' || JY.state === 'stopped' || JY.state === 'error') JY.installed = await jyInstalled();
  return { state: JY.state, installed: JY.installed, python: !!(await jyPython()), url: JY.state === 'ready' ? JY.conn.url : undefined, token: JY.state === 'ready' ? JY.conn.token : undefined, log: JY.log.slice(-12) };
}
async function jyStart(origin, install) {
  if (JY.state === 'ready' || JY.state === 'starting' || JY.state === 'installing') return;
  const py = await jyPython(); if (!py) { JY.state = 'error'; JY.log = ['Python was not found. Install Python from python.org (tick "Add to PATH"), then try again.']; return; }
  JY.log = []; JY.state = 'starting';
  const args = py[1].concat(['-u', path.join(__dirname, 'public', 'dsquest_jupyter.py'), '--app', origin, '--no-open', '--port', '8899']); if (install) args.push('--yes');
  const ch = spawn(py[0], args, { cwd: __dirname, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); JY.child = ch;
  const eat = d => String(d).split(/\r?\n/).filter(Boolean).forEach(l => { JY.log.push(l.slice(0, 200)); if (/Installing|pip install|Collecting/i.test(l) && JY.state === 'starting') JY.state = 'installing'; if (/Starting JupyterLab/i.test(l)) JY.state = 'starting'; });
  ch.stdout.on('data', eat); ch.stderr.on('data', eat);
  ch.on('exit', code => { JY.child = null; if (JY.state !== 'ready') { JY.state = 'error'; if (!JY.log.length) JY.log.push('Jupyter stopped (code ' + code + ').'); } else JY.state = 'stopped'; });
  ch.on('error', e => { JY.state = 'error'; JY.log.push(String(e.message)); });
}
process.on('exit', () => { try { if (JY.child) JY.child.kill(); } catch (e) { } });

/* ---------- API ---------- */
async function api(req, res, url) {
  const route = req.method + ' ' + url.pathname;
  const ip = req.socket.remoteAddress || '';
  let body = {};
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!/application\/json/.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'json only' });
    try { body = await readBody(req, route === 'POST /api/project/save' || route === 'POST /api/project/publish' ? 12e6 : route === 'POST /api/llm/ask' ? 3.2e6 : 1.5e6); }
    catch (e) { return send(res, 400, { error: e.message }); }
  }

  if (route === 'POST /api/signup') {
    const name = String(body.username || '').trim(), pw = String(body.password || ''), disp = String(body.display || name).trim().slice(0, 30);
    if (!/^[A-Za-z0-9_.-]{3,24}$/.test(name)) return send(res, 400, { error: 'Username: 3-24 letters, digits, _ . -' });
    if (pw.length < 8) return send(res, 400, { error: 'Password needs at least 8 characters.' });
    if (users[name.toLowerCase()]) return send(res, 409, { error: 'That username is taken.' });
    const email = String(body.email || '').trim().toLowerCase();
    if (isReserved(name) && !(process.env.RESERVED_OK_EMAILS || '').toLowerCase().split(/[\s,;]+/).filter(Boolean).includes(email)) return send(res, 409, { error: 'That name is reserved for the site owner and family. Pick another, or sign up with the email the owner approved.' });
    if (!validEmail(email)) return send(res, 400, { error: 'Enter a valid email address - it is how you reset a forgotten password.' });
    if (userByEmail(email)) return send(res, 409, { error: 'That email already has an account. Use "Forgot password" if it is yours.' });
    const gr = cleanRemote(body.gitRemote);
    if (body.gitRemote && !gr) return send(res, 400, { error: 'Git repo must look like https://github.com/you/repo' });
    users[name.toLowerCase()] = Object.assign({ username: name, display: disp || name, email, role: 'learner', tier: 'standard', created: Date.now(), state: null, projects: {}, gitRemote: gr || '', gitToken: String(body.gitToken || '').slice(0, 200) }, newCred(pw));
    saveUsers();
    return startSession(res, users[name.toLowerCase()]);
  }
  if (route === 'POST /api/login') {
    const name = String(body.username || '').trim().toLowerCase(), key = ip + '|' + name;
    if (throttled(key)) return send(res, 429, { error: 'Too many attempts. Wait a minute.' });
    const u = name.includes('@') ? userByEmail(name) : users[name];
    if (!u || !checkPw(u, String(body.password || ''))) { noteFail(key); return send(res, 401, { error: 'Wrong username or password.' }); }
    return startSession(res, u);
  }
  if (route === 'POST /api/logout') {
    const tok = cookies(req).dsq; if (tok) { delete sessions[tok]; saveSessions(); }
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'dsq=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict' });
  }

  if (route === 'POST /api/forgot') {
    if (throttled('forgot|' + ip)) return send(res, 429, { error: 'Too many requests. Try again in a minute.' }); noteFail('forgot|' + ip);
    const id = String(body.identifier || '').trim().toLowerCase(), cfg = mailConfig(process.env), u0 = id.includes('@') ? userByEmail(id) : users[id];
    const generic = { ok: true, mailConfigured: !!cfg, message: cfg ? 'If an account matches, a reset link is on its way (check spam). It works for 30 minutes.' : 'No email service is configured on this computer, so the reset link was printed in the DS Quest server window.' };
    if (u0 && u0.email) { const token = require('crypto').randomBytes(32).toString('hex'), link = (process.env.APP_URL || 'http://' + (req.headers.host || '127.0.0.1:' + PORT)) + '/#/reset/' + token; resetTokens.set(require('crypto').createHash('sha256').update(token).digest('hex'), { name: u0.username.toLowerCase(), exp: Date.now() + 30 * 60e3 });
      if (cfg) { try { await sendMail(Object.assign({}, cfg, { to: u0.email, subject: 'Reset your DS Quest password', text: 'Hi ' + u0.display + ',\n\nOpen this link within 30 minutes to choose a new password for "' + u0.username + '":\n' + link + '\n\nIf it was not you, ignore this email.\n' })); } catch (e) { console.error('mail failed:', e.message); } }
      else console.log('[password reset for ' + u0.username + '] ' + link); }
    return send(res, 200, generic);
  }
  if (route === 'POST /api/reset') {
    const token = String(body.token || ''), pw = String(body.password || ''); if (!/^[0-9a-f]{64}$/.test(token)) return send(res, 400, { error: 'This reset link is not valid.' });
    if (pw.length < 8) return send(res, 400, { error: 'Password needs at least 8 characters.' });
    const hk = require('crypto').createHash('sha256').update(token).digest('hex'), rec = resetTokens.get(hk); resetTokens.delete(hk);
    if (!rec || rec.exp < Date.now() || !users[rec.name]) return send(res, 400, { error: 'This reset link has expired or was already used. Ask for a new one.' });
    const u1 = users[rec.name]; u1.salt = require('crypto').randomBytes(16).toString('hex'); u1.hash = hashPw(pw, u1.salt); for (const [k, v] of Object.entries(sessions)) if (v && v.u === u1.username.toLowerCase()) delete sessions[k]; saveUsers(); saveSessions();
    return startSession(res, u1);
  }
  /* a learner's own Jupyter notebook reports solved questions with a personal key (no cookie needed) */
  if (route === 'POST /api/nb/report') {
    const key = String(body.key || ''), u2 = key.length >= 16 ? Object.values(users).find(x => x.nbKey === key) : null;
    if (!u2) return send(res, 401, { error: 'unknown key - copy it again from the module page' });
    const qid = String(body.qid || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 40); if (!qid) return send(res, 400, { error: 'qid missing' });
    u2.nb = u2.nb || {}; if (body.ok) u2.nb[qid] = Date.now(); else if (!u2.nb[qid]) u2.nb[qid] = 0;
    saveUsers(); return send(res, 200, { ok: true, solved: Object.values(u2.nb).filter(Boolean).length });
  }
  const u = sessionUser(req);
  if (!u) return send(res, 401, { error: 'not signed in' });
  /* premium lesson files (same rules as the hosted API; here every signed-in user is entitled unless DSQ_GATING=on) */
  if (route === 'GET /api/jupyter/status' || route === 'POST /api/jupyter/start') {
    if (!/^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ip)) return send(res, 403, { error: 'Jupyter can only be started from the computer this server runs on.' });
    if (route === 'POST /api/jupyter/start') await jyStart('http://' + (req.headers.host || '127.0.0.1:' + PORT), body.install === true);
    return send(res, 200, await jyStatus());
  }
  if (route === 'GET /api/pay/config') return send(res, 200, { enabled: false, local: true, legal: { business: 'DS Quest', email: '', address: '', refundDays: 7, law: '', reviewed: false } });
  if (route === 'GET /api/content/manifest') return send(res, 200, { premium: CONTENT.premium(), entitled: CONTENT.entitled(u, process.env), gating: process.env.DSQ_GATING === 'on', available: CONTENT.available(), expected: CONTENT.manifest().files.filter(f => f.paid).length });
  if (route === 'GET /api/content/bundle') { const out = CONTENT.bundle(CONTENT.entitled(u, process.env)); return send(res, 200, { files: out.files, modules: out.modules, premium: CONTENT.premium(), gating: process.env.DSQ_GATING === 'on' }); }
  { const nbm = req.method === 'GET' && /^\/api\/content\/notebook\/([a-z0-9-]+\.ipynb)$/.exec(url.pathname);
    if (nbm) { const nb = CONTENT.notebook(nbm[1]); if (!nb) return send(res, 404, { error: 'not found' }); if (!CONTENT.entitled(u, process.env).includes(nb.id)) return send(res, 403, { error: 'This notebook is part of paid access.' }); return send(res, 200, JSON.parse(nb.text)); } }
  if (route === 'GET /api/nb/key') { if (!u.nbKey) { u.nbKey = require('crypto').randomBytes(12).toString('hex'); saveUsers(); } return send(res, 200, { key: u.nbKey, solved: Object.values(u.nb || {}).filter(Boolean).length }); }
  const uk = u.username.toLowerCase();


  if (route === 'PUT /api/me/git') {
    const gr = cleanRemote(body.gitRemote);
    if (body.gitRemote && !gr) return send(res, 400, { error: 'Use a URL like https://github.com/you/my-repo (GitHub, GitLab or Bitbucket).' });
    u.gitRemote = gr; if (typeof body.gitToken === 'string' && body.gitToken !== '') u.gitToken = body.gitToken.slice(0, 200); if (body.clearToken) u.gitToken = '';
    saveUsers(); return send(res, 200, { ok: true, user: publicUser(u) });
  }
  /* ask a question about a chart/data: answered by the local model when the owner connected one */
  if (route === 'POST /api/ask') {
    if (!allowAsk(u.username)) return send(res, 200, { available: false });
    const prompt = 'Data summary:\n' + String(body.context || '').slice(0, 1800) + '\nQuestion: ' + String(body.question || '').slice(0, 300) + '\nAnswer in at most 4 sentences, using only the numbers given.';
    const r = await llmChat([{ role: 'system', content: TUTOR_SYSTEM }, { role: 'user', content: prompt }], null, { timeout: 25000 });
    return send(res, 200, r.text ? { available: true, answer: r.text.slice(0, 900), provider: r.provider } : { available: false });
  }
  if (route === 'PUT /api/me/profile') {
    const li = String(body.linkedin || '').trim(); if (li && !/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/(in|company)\/[A-Za-z0-9_%\-.]+\/?$/.test(li)) return send(res, 400, { error: 'Use your profile address, like https://www.linkedin.com/in/your-name' });
    if (body.email !== undefined && String(body.email).trim().toLowerCase() !== (u.email || '')) { const em = String(body.email).trim().toLowerCase(); if (!validEmail(em)) return send(res, 400, { error: 'Enter a valid email address.' }); if (u.email && !checkPw(u, String(body.password || ''))) return send(res, 403, { error: 'Enter your current password to change the email.' }); const o = userByEmail(em); if (o && o !== u) return send(res, 409, { error: 'That email belongs to another account.' }); u.email = em; }
    u.linkedin = li; if (body.display) u.display = String(body.display).trim().slice(0, 30) || u.display; saveUsers(); return send(res, 200, { ok: true, user: publicUser(u) });
  }
  if (route === 'GET /api/me') return send(res, 200, { user: publicUser(u), state: u.state, projects: u.projects, judge: true, nb: Object.entries(u.nb || {}).filter(e => e[1]).map(e => e[0]) });
  if (route === 'PUT /api/progress') {
    if (!body.state || typeof body.state !== 'object') return send(res, 400, { error: 'state missing' });
    u.state = body.state; u.last = Date.now(); saveUsers(); return send(res, 200, { ok: true });
  }
  if (route === 'GET /api/leaderboard') {
    const rows = Object.values(users).map(x => ({ display: x.display, xp: (x.state && x.state.xp) || 0, level: (x.state && x.state.level) || 1, me: x === u }))
      .sort((a, b) => b.xp - a.xp).slice(0, 20);
    return send(res, 200, { rows });
  }

  /* projects: milestone autosave (commit) and final publish (commit + live page) */
  if (route === 'POST /api/project/save' || route === 'POST /api/project/publish') {
    const final = route.endsWith('publish');
    const pdir = safeSeg(body.moduleId) + '-' + safeSeg(body.variantId);
    const dir = path.join(WORK, safeSeg(u.username), pdir);
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'figures'), { recursive: true });
    const files = body.files || {}, images = body.images || {};
    for (const [n, c] of Object.entries(files)) {
      const rel = String(n).replace(/\\/g, '/').replace(/^\/+/, '');
      if (rel.includes('..') || rel.startsWith('.')) continue;
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), String(c).slice(0, 4e6));
    }
    const imgNames = [];
    for (const [n, d] of Object.entries(images)) {
      const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(d)); if (!m) continue;
      const nm = safeSeg(n.replace(/\.png$/, '')) + '.png'; imgNames.push(nm);
      fs.writeFileSync(path.join(dir, 'figures', nm), Buffer.from(m[1], 'base64'));
    }
    const meta = body.meta || {};
    if (final) {
      const code = String(files['solution.py'] || '');
      fs.writeFileSync(path.join(dir, 'index.html'),
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escH(meta.title || pdir)}</title><style>${PAGE_CSS}</style>` +
        `<h1>${escH(meta.title || pdir)}</h1><p class="meta">by ${escH(u.display)} &middot; ${escH(meta.module || '')} &middot; ${new Date().toISOString().slice(0, 10)}</p>` +
        `<p><span class="tag">${escH(meta.edition || 'Standard edition')}</span><span class="tag">${escH(meta.dataset || '')}</span></p>` +
        `<p>${escH(meta.pitch || '')}</p><h2>My approach (in my own words)</h2><p>${escH(meta.logic || '').replace(/\n/g, '<br>')}</p>` +
        `<h2>Results</h2>${imgNames.map(n => `<p><img src="figures/${n}" alt="${n}"></p>`).join('')}` +
        `<h2>Output</h2><pre>${escH(meta.output || '')}</pre><h2>Code</h2><pre>${escH(code)}</pre>`);
      fs.writeFileSync(path.join(dir, 'README.md'),
        `# ${meta.title || pdir}\n\n${meta.pitch || ''}\n\n- Built by **${u.display}** in DS Quest (${meta.module || ''})\n- Edition: ${meta.edition || 'Standard'}\n- Dataset: ${meta.dataset || ''}\n\n## Approach\n\n${meta.logic || ''}\n\n## Run it\n\n\`\`\`bash\npip install numpy pandas matplotlib\npython solution.py\n\`\`\`\n\n## Results\n\n${imgNames.map(n => `![${n}](figures/${n})`).join('\n\n')}\n`);
    }
    const msg = final ? `Finish project: ${meta.title || pdir}` : `Milestone ${meta.milestone || ''}: ${meta.milestoneTitle || ''}`.trim();
    const g = await commitProject(u, dir, msg);
    u.projects[pdir] = Object.assign(u.projects[pdir] || {}, { moduleId: body.moduleId, variantId: body.variantId, title: meta.title, updated: Date.now(), done: final || (u.projects[pdir] && u.projects[pdir].done) || false,
      live: final ? `/u/${encodeURIComponent(safeSeg(u.username))}/${pdir}/` : (u.projects[pdir] || {}).live, meta: final ? { title: meta.title, pitch: meta.pitch, skills: meta.skills, module: meta.module, logic: String(meta.logic || '').slice(0, 1500), milestones: (Array.isArray(meta.milestones) ? meta.milestones : []).slice(0, 12).map(x => String(x).slice(0, 120)), dataset: meta.dataset, output: String(meta.output || '').slice(0, 600) } : (u.projects[pdir] || {}).meta });
    saveUsers();
    return send(res, 200, { ok: true, git: g, live: u.projects[pdir].live || null });
  }

  /* optional model judge for the "explain your logic" boxes */
  if (route === 'POST /api/judge') {
    if (!allowAsk(u.username)) return send(res, 200, { available: false });
    try {
      const prompt = 'You grade a learner\'s plain-English plan for a data-science task. Task: ' + String(body.task || '').slice(0, 800) +
        '\nA correct plan must contain these ideas:\n' + (body.rubric || []).map((r, i) => (i + 1) + '. ' + r).join('\n') +
        '\nLearner plan:\n' + String(body.logic || '').slice(0, 1500) +
        '\nReply with JSON only: {"accepted":true|false,"missing":[numbers of missing ideas],"feedback":"one short sentence"}';
      const r = await llmChat([{ role: 'user', content: prompt }], null, { timeout: 25000 });
      const m = r.text && /\{[\s\S]*\}/.exec(r.text); if (!m) return send(res, 200, { available: false });
      return send(res, 200, Object.assign({ available: true }, JSON.parse(m[0])));
    } catch (e) { return send(res, 200, { available: false, error: String(e.message).slice(0, 120) }); }
  }



  /* ---- tutor: one endpoint for questions, marked regions, sketches ---- */
  if (route === 'GET /api/llm/status') {
    const out = [];
    for (const pv of providers()) {
      let ok = true, detail = pv.note || '', vis = !!pv.vision || !!pv.visionModel;
      if (pv.kind === 'ollama') { const all = await ollamaModels(pv.base), m = await pickOllama(pv, false); ok = !!m; detail = m ? 'will use ' + m : (all.length ? 'no matching model installed' : 'Ollama is not running'); }
      else if (pv.keyEnv) { ok = !!process.env[pv.keyEnv]; detail = ok ? pv.note : 'set ' + pv.keyEnv; }
      out.push({ id: pv.id, kind: pv.kind, ok, vision: vis, detail, disabled: !!pv.disabled });
    }
    return send(res, 200, { providers: out, ready: out.some(x => x.ok && !x.disabled) });
  }
  if (route === 'POST /api/llm/ask') {
    if (!allowAsk(u.username)) return send(res, 429, { error: 'Slow down a little - 20 questions a minute.' });
    const q = String(body.question || '').slice(0, 1200).trim(); if (!q) return send(res, 400, { error: 'Type a question.' });
    const c = body.context || {}, cut = (x, n) => String(x == null ? '' : x).slice(0, n);
    let image = null; const m = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || '')); if (m && m[2].length < 2.2e6) image = { mime: m[1], b64: m[2] };
    const ctx = ['PAGE: ' + cut(c.page, 160), 'LESSON TEXT: ' + cut(c.lesson, 1800), c.code ? 'LEARNER CODE:\n' + cut(c.code, 1800) : '', c.output ? 'OUTPUT / ERROR:\n' + cut(c.output, 900) : '', c.vizOut ? 'VISUAL PANEL:\n' + cut(c.vizOut, 700) : '', c.marked ? 'THE LEARNER MARKED THIS (pen/shape/selection):\n' + cut(c.marked, 1500) : '', c.sketch ? 'THE LEARNER DREW A SKETCH. Structure I extracted from it:\n' + cut(c.sketch, 1500) : ''].filter(Boolean).join('\n\n');
    const hist = (Array.isArray(body.history) ? body.history : []).slice(-4).map(x => ({ role: x.role === 'assistant' ? 'assistant' : 'user', content: cut(x.content, 900) }));
    const messages = [{ role: 'system', content: TUTOR_SYSTEM }].concat(hist, [{ role: 'user', content: ctx + '\n\nQUESTION: ' + q }]);
    const r = await llmChat(messages, image);
    if (!r.text) return send(res, 200, { available: false, trail: r.trail, hint: 'No AI provider answered. Start Ollama (cloud or a small local model) or set GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY, then restart the server.' });
    return send(res, 200, { available: true, answer: r.text.slice(0, 6000), provider: r.provider, model: r.model, sawImage: !!r.sawImage, imageSent: !!image, trail: r.trail });
  }
  /* ship: status, one-button publish (owner only: uses this machine's own git/Vercel/GitHub credentials), LinkedIn text */
  if (route === 'GET /api/ship/status') {
    const v = await runCli('vercel', ['whoami'], ROOT, 20000);
    return send(res, 200, { owner: u.role === 'admin', vercel: { installed: !/not found|not recognized|ENOENT/i.test(v.err), user: v.ok ? v.out.split('\n').pop() : null }, github: { token: !!process.env.GITHUB_TOKEN, remoteConfigured: !!config.remote } });
  }
  if (route === 'POST /api/ship') {
    const pdir = safeSeg(body.moduleId) + '-' + safeSeg(body.variantId), proj = u.projects[pdir], src = path.join(WORK, safeSeg(u.username), pdir);
    if (!proj || !proj.done || !fs.existsSync(path.join(src, 'index.html'))) return send(res, 400, { error: 'Finish and publish the project first.' });
    const meta = Object.assign({}, proj.meta || {}, body.meta || {}); proj.meta = meta; saveUsers();
    const steps = [], links = { local: proj.live };
    if (u.role !== 'admin') {
      steps.push({ name: 'GitHub + Vercel', ok: false, detail: 'One-button publishing uses the owner\'s own GitHub/Vercel login on this machine, so it is limited to the owner account. Copy your project folder from workspace/ and publish it from your own accounts.' });
      return send(res, 200, { steps, links, linkedin: linkedinPost(u, meta, links) });
    }
    const slug = safeSeg(u.username + '-' + pdir), tmp = path.join(WORK, '_ship', slug);
    fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
    fs.cpSync(src, tmp, { recursive: true, filter: f => !f.includes(path.sep + '.git') });
    fs.writeFileSync(path.join(tmp, 'vercel.json'), JSON.stringify({ cleanUrls: true }, null, 2));
    await git(tmp, ['init', '-b', 'main']); await git(tmp, ['config', 'user.name', u.display || u.username]); await git(tmp, ['config', 'user.email', safeSeg(u.username) + '@dsquest.local']);
    await git(tmp, ['add', '-A']); const c = await git(tmp, ['commit', '-m', 'Ship: ' + (meta.title || pdir)]);
    steps.push({ name: 'Prepare repo', ok: c.ok, detail: c.ok ? 'committed' : c.err.slice(0, 200) });
    const tok = process.env.GITHUB_TOKEN;
    if (tok) {
      try {
        const me = await ghApi(tok, 'GET', '/user'); const login = me.j.login;
        if (!login) throw new Error('token rejected (' + me.status + ')');
        const mk = await ghApi(tok, 'POST', '/user/repos', { name: slug, description: (meta.pitch || meta.title || '').slice(0, 200), private: false, auto_init: false });
        if (mk.status !== 201 && mk.status !== 422) throw new Error('create repo failed: ' + mk.status);
        const push = await git(tmp, ['push', '-f', 'https://x-access-token:' + tok + '@github.com/' + login + '/' + slug + '.git', 'HEAD:main'], 90000);
        links.repo = 'https://github.com/' + login + '/' + slug;
        steps.push({ name: 'GitHub push', ok: push.ok, detail: push.ok ? links.repo : push.err.split(tok).join('***').slice(0, 250) });
      } catch (e) { steps.push({ name: 'GitHub push', ok: false, detail: String(e.message).split(tok).join('***').slice(0, 250) }); }
    } else if (config.remote) {
      await git(tmp, ['remote', 'add', 'origin', config.remote]); const push = await git(tmp, ['push', '-f', 'origin', 'HEAD:main'], 90000);
      steps.push({ name: 'GitHub push', ok: push.ok, detail: push.ok ? 'pushed to ' + config.remote : push.err.slice(0, 250) }); if (push.ok) links.repo = config.remote.replace(/\.git$/, '');
    } else steps.push({ name: 'GitHub push', ok: false, detail: 'Start the server with the GITHUB_TOKEN environment variable set (fine-grained token: Administration + Contents write) and this button creates the repo and pushes. Or set a remote in the Owner console.' });
    const who = await runCli('vercel', ['whoami'], tmp, 20000);
    if (!who.ok) steps.push({ name: 'Vercel deploy', ok: false, detail: 'Vercel CLI is not logged in. Run "vercel login" once in a terminal, then press the button again.' });
    else {
      const d = await runCli('vercel', ['deploy', '--prod', '--yes', '--name', slug], tmp, 240000);
      const m = /https:\/\/[^\s]+\.vercel\.app/.exec(d.out + ' ' + d.err);
      if (d.ok && m) { links.site = m[0]; steps.push({ name: 'Vercel deploy', ok: true, detail: m[0] }); } else steps.push({ name: 'Vercel deploy', ok: false, detail: (d.err || d.out).slice(-300) });
    }
    proj.links = links; saveUsers();
    return send(res, 200, { steps, links, linkedin: linkedinPost(u, meta, links) });
  }
  if (route === 'POST /api/linkedin') {
    const pdir = safeSeg(body.moduleId) + '-' + safeSeg(body.variantId), proj = u.projects[pdir]; if (!proj) return send(res, 404, { error: 'no such project' });
    return send(res, 200, { linkedin: linkedinPost(u, Object.assign({}, proj.meta || {}, body.meta || {}), proj.links || { local: proj.live }) });
  }

  /* admin */
  if (u.role === 'admin') {
    if (route === 'GET /api/admin/users')
      return send(res, 200, { users: Object.values(users).map(x => ({ username: x.username, display: x.display, role: x.role, xp: (x.state && x.state.xp) || 0, last: x.last || null, created: x.created, projects: Object.keys(x.projects || {}).length })), config });
    if (route === 'GET /api/admin/llm') return send(res, 200, { providers: providers(), custom: !!(config.llm && config.llm.providers && config.llm.providers.length), env: { GEMINI_API_KEY: !!process.env.GEMINI_API_KEY, GROQ_API_KEY: !!process.env.GROQ_API_KEY, OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY } });
    if (route === 'POST /api/admin/llm') {
      if (body.reset) { delete config.llm; writeJson(F_CONF, config); return send(res, 200, { ok: true, providers: providers() }); }
      const list = Array.isArray(body.providers) ? body.providers.slice(0, 10) : null; if (!list) return send(res, 400, { error: 'providers must be a list' });
      const clean = [];
      for (const x of list) {
        const pv = { id: String(x.id || '').replace(/[^\w-]/g, '').slice(0, 24), kind: x.kind, model: String(x.model || '').slice(0, 80), note: String(x.note || '').slice(0, 200), disabled: !!x.disabled, vision: !!x.vision };
        if (!pv.id || !['ollama', 'openai', 'gemini'].includes(pv.kind) || !pv.model) return send(res, 400, { error: 'each provider needs id, kind (ollama/openai/gemini) and model' });
        if (x.base) { if (!LLM_HOST_OK.test(hostOf(x.base))) return send(res, 400, { error: 'host not allowed: ' + hostOf(x.base) }); pv.base = String(x.base).replace(/\/+$/, ''); } else if (pv.kind !== 'gemini') return send(res, 400, { error: pv.id + ' needs a base URL' });
        if (x.visionModel) pv.visionModel = String(x.visionModel).slice(0, 80); if (x.forceVision) pv.forceVision = true;
        if (x.keyEnv) { if (!/^[A-Z][A-Z0-9_]{2,40}$/.test(x.keyEnv)) return send(res, 400, { error: 'keyEnv must be an environment variable name' }); pv.keyEnv = x.keyEnv; }
        clean.push(pv);
      }
      config.llm = { providers: clean }; writeJson(F_CONF, config); tagCache = { t: 0, v: null }; return send(res, 200, { ok: true, providers: providers() });
    }
    if (route === 'POST /api/admin/config') {
      const rm = String(body.remote || '').trim(), jd = String(body.judgeUrl || '').trim();
      if (rm && !/^(https:\/\/|git@|ssh:\/\/)[^\s;|&]+$/.test(rm)) return send(res, 400, { error: 'remote must be an https/ssh git URL' });
      if (jd && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(jd)) return send(res, 400, { error: 'judge URL must be local (127.0.0.1 or localhost)' });
      config = { remote: rm, judgeUrl: jd, judgeModel: String(body.judgeModel || '').slice(0, 80) }; writeJson(F_CONF, config);
      return send(res, 200, { ok: true, config });
    }
  }
  return send(res, 404, { error: 'no such route' });
}

function startSession(res, u) {
  const tok = crypto.randomBytes(24).toString('hex');
  sessions[tok] = { u: u.username.toLowerCase(), t: Date.now() }; saveSessions();
  return send(res, 200, { user: publicUser(u), state: u.state, projects: u.projects, judge: true },
    { 'Set-Cookie': `dsq=${tok}; Path=/; Max-Age=${30 * 86400}; HttpOnly; SameSite=Strict` });
}

/* ---------- static files ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.csv': 'text/csv', '.md': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.zip': 'application/zip', '.whl': 'application/octet-stream', '.ipynb': 'application/json', '.py': 'text/plain; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' };
function serveFile(res, base, rel, sandbox) {
  let p = path.normalize(path.join(base, rel));
  if (!p.startsWith(base)) return send(res, 403, 'forbidden');
  if (rel.split(/[\\/]/).some(s => s.startsWith('.'))) return send(res, 404, 'not found');
  fs.stat(p, (e, st) => {
    if (!e && st.isDirectory()) p = path.join(p, 'index.html');
    fs.readFile(p, (e2, buf) => {
      if (e2) return send(res, 404, 'not found');
      res.writeHead(200, Object.assign({ 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }, sandbox ? SANDBOX : SEC));
      res.end(buf);
    });
  });
}

http.createServer((req, res) => {
  let url; try { url = new URL(req.url, 'http://x'); } catch (e) { return send(res, 400, 'bad url'); }
  const pn = decodeURIComponent(url.pathname);
  if (pn.startsWith('/api/')) return api(req, res, url).catch(e => { console.error(e); send(res, 500, { error: 'server error' }); });
  const m = /^\/u\/([^/]+)\/([^/]+)\/(.*)$/.exec(pn);
  if (m) return serveFile(res, path.join(WORK, safeSeg(m[1]), safeSeg(m[2])), m[3] || 'index.html', true);
  return serveFile(res, PUBLIC, pn === '/' ? 'index.html' : pn.replace(/^\/+/, ''));
}).listen(PORT, HOST, () => console.log(`DS Quest running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`));
