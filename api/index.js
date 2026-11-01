'use strict';
/* Vercel serverless entry: every /api/* request (and /u/* live project pages) is rewritten to this one function. */
const createApi = require('../lib/hosted'), { redis } = require('../lib/redis'), { SEC, SANDBOX } = require('../lib/shared');
let api = null;
const send = (res, status, ctype, text, headers) => { res.statusCode = status; res.setHeader('Content-Type', ctype); Object.entries(headers && headers.__sandbox ? SANDBOX : SEC).forEach(([k, v]) => res.setHeader(k, v)); Object.entries(headers || {}).filter(([k]) => k !== '__sandbox').forEach(([k, v]) => res.setHeader(k, v)); res.setHeader('Cache-Control', (headers && headers['Cache-Control']) || 'no-store'); res.end(text); };
/* The webhook signature needs the exact request text, so read the stream ourselves. If the platform already parsed the body, raw is null and
   lib/pay.js falls back to asking Razorpay's API about the payment (it never trusts the webhook body). */
async function readBody(req) {
  let raw = ''; try { if (req.readable && !req.readableEnded) { const ch = []; for await (const c of req) ch.push(c); raw = Buffer.concat(ch).toString('utf8'); } } catch (e) { }
  if (!raw) { const b = req.body; if (typeof b === 'string') raw = b; else if (Buffer.isBuffer(b)) raw = b.toString('utf8'); else if (b && typeof b === 'object') return { raw: null, body: b }; }
  let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch (e) { }
  return { raw, body };
}
module.exports = async (req, res) => {
  try {
    if (!api) { const kv = redis(process.env); if (!kv) return send(res, 503, 'application/json', JSON.stringify({ error: 'The account database is not connected yet (owner: add the Upstash Redis storage to this Vercel project).', setup: true })); api = createApi({ kv }); }
    const url = new URL(req.url, 'http://x'), routed = url.searchParams.get('p'); /* vercel.json rewrites /api/* and /u/* to this one function and passes the original path as ?p= */
    const { raw, body } = await readBody(req);
    if ((req.method === 'POST' || req.method === 'PUT') && !/application\/json/.test(req.headers['content-type'] || '')) return send(res, 415, 'application/json', JSON.stringify({ error: 'json only' }));
    const out = await api.handle({ method: req.method, path: routed && /^\/(api|u)\//.test(routed) ? routed.split('?')[0] : url.pathname, body: body || {}, raw, headers: req.headers, query: Object.fromEntries([...url.searchParams].filter(([k]) => k !== 'p')) });
    if (out.html) return send(res, out.status, 'text/html; charset=utf-8', out.html, Object.assign({}, out.headers, /^\/u\//.test(routed || '') ? { __sandbox: 1 } : {}));
    return send(res, out.status, 'application/json', JSON.stringify(out.json), out.headers);
  } catch (e) { console.error(e); return send(res, 500, 'application/json', JSON.stringify({ error: 'Server error' })); }
};

module.exports.config = { api: { bodyParser: false } };
