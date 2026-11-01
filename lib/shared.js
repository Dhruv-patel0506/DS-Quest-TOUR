'use strict';
/* Small helpers shared by the hosted API (api/) - password hashing, reserved names, escaping. */
const crypto = require('crypto');
const hashPw = (pw, saltHex) => crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 }).toString('hex'); /* same recipe as server.js, so one owner hash works in both */
const verifyPw = (pw, u) => { try { const a = Buffer.from(hashPw(pw, u.salt), 'hex'), b = Buffer.from(u.hash, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); } catch (e) { return false; } };
const RESERVED = ['dhruv', 'dstar', 'distar', 'dharmesh', 'darmesh', 'dharmesha', 'asha'];
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/1/g, 'i').replace(/0/g, 'o').replace(/3/g, 'e').replace(/\$/g, 's');
const isReserved = name => { const n = norm(name); return RESERVED.some(r => (r.length < 5 ? lev(n, r) <= 1 : n.includes(r) || lev(n, r) <= 1)); };
const escH = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const validEmail = e => /^[^\s@<>]{1,64}@[^\s@<>]{1,200}\.[^\s@<>]{2,}$/.test(String(e || '')) && String(e).length <= 254;
/* secrets (learner's own Vercel / GitHub tokens) are encrypted at rest with DSQ_SECRET */
const keyOf = secret => crypto.createHash('sha256').update(String(secret)).digest();
const seal = (text, secret) => { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', keyOf(secret), iv), ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]); return [iv, c.getAuthTag(), ct].map(b => b.toString('base64')).join('.'); };
const unseal = (blob, secret) => { const [iv, tag, ct] = String(blob).split('.').map(x => Buffer.from(x, 'base64')), d = crypto.createDecipheriv('aes-256-gcm', keyOf(secret), iv); d.setAuthTag(tag); return Buffer.concat([d.update(ct), d.final()]).toString('utf8'); };
/* Security headers for every page and API answer. The page needs inline and eval'd script (the lesson bundle, the Python worker) and WebAssembly, so the policy
   limits WHERE things may come from (this site, the Python CDN fallback, Razorpay) rather than banning inline code. Learners' own published project pages
   (/u/...) are served with SANDBOX so their scripts get an empty origin: they cannot read the app's data or call its API as the visitor. */
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://cdn.jsdelivr.net https://pypi.org https://files.pythonhosted.org https://api.razorpay.com https://lumberjack.razorpay.com; worker-src 'self' blob:; frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";
const SEC = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'same-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), display-capture=(self)', 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' };
const SANDBOX = { 'Content-Security-Policy': 'sandbox allow-scripts allow-forms allow-popups allow-modals', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
module.exports = { hashPw, verifyPw, isReserved, escH, validEmail, seal, unseal, crypto, SEC, SANDBOX };
