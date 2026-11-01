'use strict';
/* Razorpay payments, end to end against a FAKE Razorpay (no network, no keys, no money).   node tools/test_payments.js
   The hosted API runs with an in-memory key-value store and an injected fetch that plays Razorpay's side. */
const crypto = require('crypto');
const createApi = require('../lib/hosted'), CONTENT = require('../lib/content');
const store = new Map(), exp = new Map();
const kv = {
  get: async k => { const e = exp.get(k); if (e && e < Date.now()) { store.delete(k); exp.delete(k); } return store.has(k) ? store.get(k) : null; },
  set: async (k, v, ex) => { store.set(k, String(v)); if (ex) exp.set(k, Date.now() + ex * 1000); else exp.delete(k); return 'OK'; },
  del: async k => (store.delete(k) ? 1 : 0), incr: async k => { const n = (+store.get(k) || 0) + 1; store.set(k, String(n)); return n; },
  expire: async () => 1, zsets: new Map(),
  zadd: async function (k, s, m) { const z = kv.zsets.get(k) || new Map(); z.set(m, +s); kv.zsets.set(k, z); return 1; },
  zrevrange: async function (k, a, b) { const z = [...(kv.zsets.get(k) || new Map())].sort((x, y) => y[1] - x[1]).slice(a, b + 1); return z.flatMap(([m, s]) => [m, String(s)]); },
};
/* ---- fake Razorpay ---- */
const RZ = { orders: {}, payments: {}, calls: [], down: false, seq: 0 };
const rid = p => p + crypto.randomBytes(7).toString('hex');
const fakeFetch = async (url, o = {}) => {
  const u = new URL(url), path = u.pathname.replace(/^\/v1/, ''), body = o.body ? JSON.parse(o.body) : {}, m = o.method || 'GET';
  RZ.calls.push(m + ' ' + path);
  const res = (status, j) => ({ ok: status < 400, status, json: async () => j });
  if (RZ.down) return res(500, { error: { description: 'down' } });
  if (!/^Basic /.test(o.headers.Authorization)) return res(401, { error: { description: 'auth' } });
  if (m === 'POST' && path === '/orders') { const id = rid('order_'); RZ.orders[id] = { id, amount: body.amount, currency: body.currency, notes: body.notes }; return res(200, RZ.orders[id]); }
  let mm = /^\/payments\/(pay_\w+)$/.exec(path); if (m === 'GET' && mm) return RZ.payments[mm[1]] ? res(200, RZ.payments[mm[1]]) : res(404, { error: { description: 'no payment' } });
  mm = /^\/payments\/(pay_\w+)\/capture$/.exec(path); if (m === 'POST' && mm) { const p = RZ.payments[mm[1]]; if (!p || p.amount !== body.amount) return res(400, { error: { description: 'bad capture' } }); p.status = 'captured'; return res(200, p); }
  mm = /^\/orders\/(order_\w+)\/payments$/.exec(path); if (m === 'GET' && mm) return res(200, { items: Object.values(RZ.payments).filter(p => p.order_id === mm[1]) });
  return res(404, { error: { description: 'unknown ' + path } });
};
const makePayment = (order_id, status = 'captured', over = {}) => { const o = RZ.orders[order_id], id = rid('pay_'); RZ.payments[id] = Object.assign({ id, order_id, amount: o.amount, currency: 'INR', status, amount_refunded: 0 }, over); return id; };

let bad = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL:', m); } };
const KEY = 'rzp_test_abc123', SEC = 'sekret_key_value', WH = 'whsec_value';
const ENV = { DSQ_SECRET: 's', DSQ_GATING: 'on', RAZORPAY_KEY_ID: KEY, RAZORPAY_KEY_SECRET: SEC, RAZORPAY_WEBHOOK_SECRET: WH, DSQ_PRICE_INR: '1000', DSQ_ACCESS_DAYS: '365' };
const sent = [];
const mk = env => createApi({ kv, env, mail: async m => { sent.push(m); }, fetchFn: fakeFetch });
const call = (api, method, p, o = {}) => api.handle({ method, path: p, body: o.body || {}, raw: o.raw, headers: Object.assign({ 'x-forwarded-for': '9.9.9.' + (o.ip || 1), host: 'x' }, o.headers || {}), query: o.query || {} });
const sigPay = (oid, pid, secret = SEC) => crypto.createHmac('sha256', secret).update(oid + '|' + pid).digest('hex');
const hook = (api, ev, evId, over = {}) => { const body = ev, raw = over.raw !== undefined ? over.raw : JSON.stringify(body); return call(api, 'POST', '/api/pay/webhook', { body, raw: over.noRaw ? undefined : raw, headers: Object.assign({ 'x-razorpay-signature': crypto.createHmac('sha256', over.secret || WH).update(raw).digest('hex'), 'x-razorpay-event-id': evId }, over.headers || {}) }); };
const evPay = (event, pid) => ({ event, payload: { payment: { entity: { id: pid } } } });
const ck = r => (r.headers['Set-Cookie'] || '').split(';')[0];

(async () => {
  const off = mk({ DSQ_SECRET: 's' }), api = mk(ENV), man = CONTENT.manifest(), paid = man.files.filter(f => f.paid).length;
  /* payments off */
  const c0 = await call(off, 'GET', '/api/pay/config'); ok(c0.json.enabled === false && !c0.json.keyId, 'off: config says disabled, no key');
  const s0 = await call(off, 'POST', '/api/signup', { body: { username: 'buyer0', password: 'correct-horse-9', email: 'b0@example.com' } });
  ok((await call(off, 'POST', '/api/pay/order', { headers: { cookie: ck(s0) } })).status === 503, 'off: order refused with 503');

  /* on */
  const cfg = (await call(api, 'GET', '/api/pay/config')).json;
  ok(cfg.enabled && cfg.test && cfg.keyId === KEY && cfg.plan.inr === 1000 && cfg.plan.days === 365, 'config: enabled, test mode, plan from env');
  ok(!JSON.stringify(cfg).includes(SEC) && !JSON.stringify(cfg).includes(WH), 'config never contains a secret');
  const su = await call(api, 'POST', '/api/signup', { body: { username: 'buyer1', password: 'correct-horse-9', email: 'buyer1@example.com' } }), H = { cookie: ck(su) };
  const su2 = await call(api, 'POST', '/api/signup', { body: { username: 'buyer2', password: 'correct-horse-9', email: 'buyer2@example.com' } }), H2 = { cookie: ck(su2) };
  ok((await call(api, 'POST', '/api/pay/order')).status === 401, 'order needs sign-in');
  ok((await call(api, 'GET', '/api/content/bundle', { headers: H })).json.files.length === 0, 'before paying: no premium files (gating on)');

  ok((await call(api, 'POST', '/api/pay/order', { headers: H, body: {} })).status === 400, 'order refused until the buyer accepts the terms');
  ok((await call(api, 'POST', '/api/pay/order', { headers: H, body: { agree: 'yes' } })).status === 400, 'only a real true counts as accepting');
  /* the price comes from the server, whatever the browser sends */
  const o1 = await call(api, 'POST', '/api/pay/order', { headers: H, body: { agree: true, amount: 1, price: 1, code: '' } });
  ok(o1.status === 200 && o1.json.amount === 100000 && o1.json.keyId === KEY && /^order_/.test(o1.json.orderId), 'order: amount 100000 paise from the server, not the browser');
  ok(!JSON.stringify(o1.json).includes(SEC), 'order response has no secret');
  const oid = o1.json.orderId;

  /* verify: wrong signature, someone else's order, unpaid, then success */
  const pid = makePayment(oid, 'created');
  ok((await call(api, 'POST', '/api/pay/verify', { headers: H, body: { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: 'f'.repeat(64) } })).status === 400, 'verify: wrong signature refused');
  ok((await call(api, 'POST', '/api/pay/verify', { headers: H2, body: { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sigPay(oid, pid) } })).status === 404, 'verify: another account cannot claim this order');
  ok((await call(api, 'POST', '/api/pay/verify', { headers: H, body: { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sigPay(oid, pid, 'other-secret') } })).status === 400, 'verify: signature made with another secret refused');
  ok((await call(api, 'POST', '/api/pay/verify', { headers: H, body: { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sigPay(oid, pid) } })).status === 402, 'verify: valid signature but payment not captured -> not granted');
  ok((await call(api, 'GET', '/api/content/bundle', { headers: H })).json.files.length === 0, 'still nothing granted');
  RZ.payments[pid].status = 'authorized';
  let v = await call(api, 'POST', '/api/pay/verify', { headers: H, body: { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sigPay(oid, pid) } });
  ok(v.status === 200 && v.json.granted, 'verify: authorized payment is captured by us, then granted: ' + JSON.stringify(v.json));
  ok(RZ.calls.includes('POST /payments/' + pid + '/capture'), 'capture call was made');
  const b = await call(api, 'GET', '/api/content/bundle', { headers: H });
  ok(b.json.files.length === paid && b.json.modules.length === man.premium.length, 'after paying: all premium files arrive');
  const me = (await call(api, 'GET', '/api/me', { headers: H })).json.user;
  ok(me.ent && me.ent.all && me.ent.until > Date.now() + 360 * 86400000, 'account shows access for about a year');
  ok(sent.length === 0, 'no SMTP configured: no receipt attempted');
  /* idempotent */
  const until1 = me.ent.until;
  v = await call(api, 'POST', '/api/pay/verify', { headers: H, body: { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sigPay(oid, pid) } });
  ok(v.status === 200 && v.json.already, 'verify again: already applied, no double grant');
  ok((await call(api, 'GET', '/api/me', { headers: H })).json.user.ent.until === until1, 'access end date unchanged by the repeat');
  ok((await call(api, 'GET', '/api/pay/mine', { headers: H })).json.pay.length === 1, 'exactly one paid entry');
  /* a payment for the wrong amount or another order is not accepted */
  const o2 = (await call(api, 'POST', '/api/pay/order', { headers: H2, body: { agree: true } })).json, pidBad = makePayment(o2.orderId, 'captured', { amount: 100 });
  ok((await call(api, 'POST', '/api/pay/verify', { headers: H2, body: { razorpay_order_id: o2.orderId, razorpay_payment_id: pidBad, razorpay_signature: sigPay(o2.orderId, pidBad) } })).status === 402, 'amount mismatch -> refused');
  const pidOther = makePayment(oid, 'captured');
  ok((await call(api, 'POST', '/api/pay/verify', { headers: H2, body: { razorpay_order_id: o2.orderId, razorpay_payment_id: pidOther, razorpay_signature: sigPay(o2.orderId, pidOther) } })).status === 402, "a payment of another order is not accepted for this one");
  ok((await call(api, 'GET', '/api/content/bundle', { headers: H2 })).json.files.length === 0, 'buyer2 still has nothing');

  /* sync ("I already paid"): the browser never called back, Razorpay has the money */
  const pid2 = makePayment(o2.orderId, 'captured');
  RZ.payments[pidBad].order_id = 'order_zzzzzzzzzz';
  const sy = await call(api, 'POST', '/api/pay/sync', { headers: H2 });
  ok(sy.status === 200 && sy.json.granted, 'sync grants a captured payment the browser never reported');
  ok((await call(api, 'GET', '/api/content/bundle', { headers: H2 })).json.files.length === paid, 'buyer2 now has access');

  /* webhooks */
  const o3 = (await call(api, 'POST', '/api/pay/order', { headers: H, body: { agree: true } })).json, pid3 = makePayment(o3.orderId, 'captured');
  ok((await hook(api, evPay('payment.captured', pid3), 'ev_bad', { secret: 'wrong' })).status === 400, 'webhook: bad signature refused');
  const w1 = await hook(api, evPay('payment.captured', pid3), 'ev_1');
  ok(w1.status === 200 && w1.json.ok, 'webhook: payment.captured accepted');
  const mine1 = (await call(api, 'GET', '/api/pay/mine', { headers: H })).json;
  ok(mine1.pay.length === 2, 'webhook granted the second order');
  ok(mine1.ent.until > until1 + 360 * 86400000, 'a second purchase extends access from the first end date (stacks)');
  ok((await hook(api, evPay('payment.captured', pid3), 'ev_1')).json.duplicate, 'webhook: same event id is a duplicate, ignored');
  ok((await hook(api, evPay('payment.captured', pid3), 'ev_2')).status === 200 && (await call(api, 'GET', '/api/pay/mine', { headers: H })).json.pay.length === 2, 'webhook: same payment, new event id -> still only one entry');
  /* webhook whose body lies: claims captured but Razorpay says otherwise */
  const o4 = (await call(api, 'POST', '/api/pay/order', { headers: H, body: { agree: true } })).json, pid4 = makePayment(o4.orderId, 'failed');
  await hook(api, evPay('payment.captured', pid4), 'ev_lie');
  ok((await call(api, 'GET', '/api/pay/mine', { headers: H })).json.pay.length === 2, 'webhook claiming captured for a failed payment grants nothing (we ask Razorpay)');
  /* platform parsed the body already: no raw text -> still safe because we ask Razorpay */
  const o5 = (await call(api, 'POST', '/api/pay/order', { headers: H2, body: { agree: true } })).json, pid5 = makePayment(o5.orderId, 'captured');
  ok((await hook(api, evPay('payment.captured', pid5), 'ev_noraw', { noRaw: true, headers: { 'x-razorpay-signature': 'nope' } })).status === 200 && (await call(api, 'GET', '/api/pay/mine', { headers: H2 })).json.pay.length === 2, 'no raw body: verified through the API instead');
  ok((await hook(api, { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_../../x' } } } }, 'ev_junk')).json.ignored, 'a malformed payment id is ignored');
  RZ.payments[pid3].amount_refunded = 1000;
  const r1 = await hook(api, { event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_1', payment_id: pid3 } } } }, 'ev_part');
  ok(r1.status === 200 && (await call(api, 'GET', '/api/pay/mine', { headers: H })).json.pay.every(p => p.status === 'paid'), 'partial refund keeps access');
  /* full refunds of both orders remove access */
  for (const p of [pid, pid3]) RZ.payments[p].amount_refunded = RZ.payments[p].amount;
  await hook(api, { event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_2', payment_id: pid3 } } } }, 'ev_r2');
  ok((await call(api, 'GET', '/api/me', { headers: H })).json.user.ent.until > Date.now(), 'refunding the second order leaves the first order\'s access');
  await hook(api, { event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_3', payment_id: pid } } } }, 'ev_r3');
  ok(!(await call(api, 'GET', '/api/me', { headers: H })).json.user.ent, 'refunding the first order too removes all access');
  ok((await call(api, 'GET', '/api/content/bundle', { headers: H })).json.files.length === 0, 'and the files stop being served');
  RZ.down = true;
  ok((await hook(api, evPay('payment.captured', pid3), 'ev_down')).status === 500, 'Razorpay unreachable: webhook answers 500 so Razorpay retries');
  RZ.down = false;
  ok((await call(api, 'POST', '/api/pay/order', { headers: H, body: { agree: true } })).status === 200, 'ordering works again');
  RZ.down = true; const od = await call(api, 'POST', '/api/pay/order', { headers: H, body: { agree: true } }); RZ.down = false;
  ok(od.status === 502 && /Nothing was charged/.test(od.json.error), 'provider down at order time: clear message, nothing created');

  /* coupons + owner */
  const su3 = await call(api, 'POST', '/api/signup', { body: { username: 'buyer3', password: 'correct-horse-9', email: 'buyer3@example.com' } }), H3 = { cookie: ck(su3) };
  ok((await call(api, 'POST', '/api/admin/coupon', { headers: H3, body: { code: 'HALF', pct: 50 } })).status === 403, 'a learner cannot create coupons');
  ok((await call(api, 'GET', '/api/admin/pay', { headers: H3 })).status === 403, 'a learner cannot read the owner console');
  const own = JSON.parse(await kv.get('u:buyer3')); own.role = 'admin'; await kv.set('u:buyer3', JSON.stringify(own));
  ok((await call(api, 'POST', '/api/admin/coupon', { headers: H3, body: { code: 'HALF', pct: 50, max: 2, note: 'launch' } })).status === 200, 'owner creates a 50% coupon (2 uses)');
  ok((await call(api, 'POST', '/api/admin/coupon', { headers: H3, body: { code: 'bad code!', pct: 50 } })).status === 400, 'bad coupon code refused');
  ok((await call(api, 'POST', '/api/admin/coupon', { headers: H3, body: { code: 'FLAT300', flat: 300 } })).status === 200, 'flat coupon');
  ok((await call(api, 'POST', '/api/admin/coupon', { headers: H3, body: { code: 'FREE', pct: 100, max: 1 } })).status === 200, '100% coupon');
  ok((await call(api, 'POST', '/api/admin/coupon', { headers: H3, body: { code: 'OLD', pct: 10, until: '2020-01-01' } })).status === 200, 'expired coupon');
  const q = await call(api, 'POST', '/api/pay/quote', { headers: H, body: { code: 'half' } });
  ok(q.json.amount === 50000 && q.json.discount === 50000 && q.json.coupon === 'HALF', 'quote: HALF -> 500 rupees (case-insensitive)');
  ok((await call(api, 'POST', '/api/pay/quote', { headers: H, body: { code: 'FLAT300' } })).json.amount === 70000, 'quote: FLAT300 -> 700 rupees');
  ok((await call(api, 'POST', '/api/pay/quote', { headers: H, body: { code: 'OLD' } })).status === 400, 'expired coupon refused');
  ok((await call(api, 'POST', '/api/pay/quote', { headers: H, body: { code: 'NOPE' } })).status === 400, 'unknown coupon refused');
  const oc = (await call(api, 'POST', '/api/pay/order', { headers: H3, body: { agree: true, code: 'HALF' } })).json;
  ok(oc.amount === 50000 && RZ.orders[oc.orderId].amount === 50000, 'order with coupon is created for 50000 paise at Razorpay');
  const pc = makePayment(oc.orderId); await call(api, 'POST', '/api/pay/verify', { headers: H3, body: { razorpay_order_id: oc.orderId, razorpay_payment_id: pc, razorpay_signature: sigPay(oc.orderId, pc) } });
  const bu = [];
  for (const who of ['buyer1', 'buyer2']) { const x = JSON.parse(await kv.get('u:' + who)); bu.push(x); }
  ok((await call(api, 'GET', '/api/admin/pay', { headers: H3 })).json.coupons.find(c => c.code === 'HALF').used === 1, 'coupon use counted once, when paid');
  const free = await call(api, 'POST', '/api/pay/order', { headers: H, body: { agree: true, code: 'FREE' } });
  ok(free.json.free && free.json.granted && RZ.calls.slice(-1)[0] !== 'POST /orders' && !/^POST \/orders$/.test(RZ.calls.slice(-1)[0]), '100% coupon: granted without calling Razorpay');
  ok((await call(api, 'GET', '/api/me', { headers: H })).json.user.ent, 'free-coupon user has access');
  ok((await call(api, 'POST', '/api/pay/quote', { headers: H2, body: { code: 'FREE' } })).status === 400, 'a used-up coupon is refused for the next person');

  /* owner grant / revoke */
  ok((await call(api, 'POST', '/api/admin/grant', { headers: H3, body: { username: 'nobody', days: 30 } })).status === 404, 'grant: unknown user');
  ok((await call(api, 'POST', '/api/admin/grant', { headers: H3, body: { username: 'buyer1@example.com', days: 0 } })).status === 400, 'grant: needs days or lifetime');
  const g = await call(api, 'POST', '/api/admin/grant', { headers: H3, body: { username: 'buyer1', days: 30, note: 'friend' } });
  ok(g.status === 200 && g.json.ent.until > Date.now(), 'owner grants 30 days by username');
  const gl = await call(api, 'POST', '/api/admin/grant', { headers: H3, body: { username: 'buyer1@example.com', lifetime: true } });
  ok(gl.status === 200 && gl.json.ent.until === 0, 'owner grants lifetime by email');
  ok((await call(api, 'GET', '/api/content/bundle', { headers: H })).json.files.length === paid, 'granted user gets files');
  ok((await call(api, 'POST', '/api/admin/revoke', { headers: H3, body: { username: 'buyer1' } })).status === 200 && !(await call(api, 'GET', '/api/me', { headers: H })).json.user.ent, 'owner revokes everything');
  /* expiry */
  const e1 = JSON.parse(await kv.get('u:buyer2')); e1.pay.forEach(p => { p.at = Date.now() - 400 * 86400000; }); e1.ent = { all: true, until: Date.now() - 1000 }; await kv.set('u:buyer2', JSON.stringify(e1));
  ok((await call(api, 'GET', '/api/content/bundle', { headers: H2 })).json.files.length === 0, 'expired access: files stop');
  const ov = (await call(api, 'GET', '/api/admin/pay', { headers: H3 })).json;
  ok(ov.orders.length >= 6 && ov.revenuePaise > 0 && ov.config.test, 'owner overview lists orders, revenue, test-mode flag');
  ok(!JSON.stringify(ov).includes(SEC) && !JSON.stringify(ov).includes(WH), 'overview has no secrets');
  /* receipt mail when SMTP is configured */
  const withMail = mk(Object.assign({}, ENV, { SMTP_HOST: 'smtp.example.com', SMTP_USER: 'shop@example.com', SMTP_PASS: 'x' })), sm = await call(withMail, 'POST', '/api/signup', { body: { username: 'buyer4', password: 'correct-horse-9', email: 'buyer4@example.com' } });
  const o6 = (await call(withMail, 'POST', '/api/pay/order', { headers: { cookie: ck(sm) }, body: { agree: true } })).json, pid6 = makePayment(o6.orderId);
  await call(withMail, 'POST', '/api/pay/verify', { headers: { cookie: ck(sm) }, body: { razorpay_order_id: o6.orderId, razorpay_payment_id: pid6, razorpay_signature: sigPay(o6.orderId, pid6) } });
  await new Promise(r => setTimeout(r, 30));
  ok(sent.length === 1 && sent[0].to === 'buyer4@example.com' && /Rs 1000/.test(sent[0].text) && /not a tax invoice/.test(sent[0].text), 'receipt e-mail sent to the buyer with the paid amount');
  /* the owner always has access regardless */
  ok((await call(api, 'GET', '/api/content/bundle', { headers: H3 })).json.files.length === paid, 'owner (admin) always has everything');
  console.log(bad ? `\n${bad} of ${n} checks FAILED` : `\nall ${n} payment checks passed`); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
