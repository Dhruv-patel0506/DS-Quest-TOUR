'use strict';
/* Many currencies and a second provider (Stripe Checkout), end to end against FAKE Razorpay and Stripe (no network, no keys, no money).
   node tools/test_payments_global.js */
const crypto = require('crypto');
const createApi = require('../lib/hosted'), CONTENT = require('../lib/content');
const store = new Map();
const kv = {
  get: async k => (store.has(k) ? store.get(k) : null), set: async (k, v) => { store.set(k, String(v)); return 'OK'; }, del: async k => (store.delete(k) ? 1 : 0),
  incr: async k => { const n = (+store.get(k) || 0) + 1; store.set(k, String(n)); return n; }, expire: async () => 1, zsets: new Map(),
  zadd: async function (k, s, m) { const z = kv.zsets.get(k) || new Map(); z.set(m, +s); kv.zsets.set(k, z); return 1; },
  zrevrange: async function (k, a, b) { const z = [...(kv.zsets.get(k) || new Map())].sort((x, y) => y[1] - x[1]).slice(a, b + 1); return z.flatMap(([m, s]) => [m, String(s)]); },
};
const rid = p => p + crypto.randomBytes(7).toString('hex');
const RZ = { orders: {}, calls: [] }, ST = { sessions: {}, calls: [], bodies: [] };
const fakeFetch = async (url, o = {}) => {
  const u = new URL(url), m = o.method || 'GET', res = (status, j) => ({ ok: status < 400, status, json: async () => j });
  if (u.hostname === 'api.razorpay.com') {
    const path = u.pathname.replace(/^\/v1/, ''), body = o.body ? JSON.parse(o.body) : {}; RZ.calls.push(m + ' ' + path);
    if (m === 'POST' && path === '/orders') { const id = rid('order_'); RZ.orders[id] = { id, amount: body.amount, currency: body.currency }; return res(200, RZ.orders[id]); }
    return res(404, { error: { description: 'unknown ' + path } });
  }
  if (u.hostname === 'api.stripe.com') {
    const path = u.pathname.replace(/^\/v1/, ''); ST.calls.push(m + ' ' + path);
    if (o.headers.Authorization !== 'Bearer sk_test_abc') return res(401, { error: { message: 'auth' } });
    if (m === 'POST' && path === '/checkout/sessions') {
      const f = new URLSearchParams(o.body), id = 'cs_test_' + crypto.randomBytes(6).toString('hex'); ST.bodies.push(Object.fromEntries(f));
      ST.sessions[id] = { id, url: 'https://checkout.stripe.com/c/pay/' + id, payment_status: 'unpaid', client_reference_id: f.get('client_reference_id'), amount_total: +f.get('line_items[0][price_data][unit_amount]'), currency: f.get('line_items[0][price_data][currency]'), payment_intent: 'pi_' + crypto.randomBytes(5).toString('hex') };
      return res(200, ST.sessions[id]);
    }
    const mm = /^\/checkout\/sessions\/(cs_\w+)$/.exec(path); if (m === 'GET' && mm) return ST.sessions[mm[1]] ? res(200, ST.sessions[mm[1]]) : res(404, { error: { message: 'no session' } });
  }
  return res(404, {});
};
let bad = 0, n = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL:', m); } };
const SW = 'whsec_stripe_value', both = { DSQ_SECRET: 's', DSQ_GATING: 'on', APP_URL: 'https://shop.test', RAZORPAY_KEY_ID: 'rzp_test_k', RAZORPAY_KEY_SECRET: 'rz_secret', RAZORPAY_WEBHOOK_SECRET: 'rzwh', STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_WEBHOOK_SECRET: SW, DSQ_PRICE_INR: '1000', DSQ_PRICES: '{"USD":29,"EUR":27.5,"JPY":4000,"xx":5,"GBP":-1}', DSQ_MANUAL_PAY_TEXT: 'UPI: pay@bank, then email the receipt' };
const sent = []; const mk = env => createApi({ kv, env, mail: async x => { sent.push(x); }, fetchFn: fakeFetch });
const call = (api, method, p, o = {}) => api.handle({ method, path: p, body: o.body || {}, raw: o.raw, headers: Object.assign({ 'x-forwarded-for': '8.8.8.' + (o.ip || 1), host: 'x' }, o.headers || {}), query: {} });
const ck = r => (r.headers['Set-Cookie'] || '').split(';')[0];
const sign = (raw, t = Math.floor(Date.now() / 1000), secret = SW) => 't=' + t + ',v1=' + crypto.createHmac('sha256', secret).update(t + '.' + raw).digest('hex');
const stHook = (api, ev, o = {}) => { const raw = JSON.stringify(ev); return call(api, 'POST', '/api/pay/webhook/stripe', { body: ev, raw: o.noRaw ? undefined : raw, headers: { 'stripe-signature': o.sig || sign(raw, o.t, o.secret) } }); };
const completed = (id, oid) => ({ id, type: 'checkout.session.completed', data: { object: { client_reference_id: oid } } });

(async () => {
  const api = mk(both), stripeOnly = mk({ DSQ_SECRET: 's', DSQ_GATING: 'on', APP_URL: 'https://shop.test', STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_WEBHOOK_SECRET: SW });
  const cfg = (await call(api, 'GET', '/api/pay/config')).json;
  ok(cfg.enabled && cfg.providers.razorpay && cfg.providers.stripe && cfg.providers.stripeTest, 'config lists both providers');
  ok(JSON.stringify(cfg.currencies.map(c => c.code)) === '["INR","USD","EUR"]', 'currencies: INR, USD, EUR only (zero-decimal, junk code and negative price dropped): ' + JSON.stringify(cfg.currencies));
  ok(cfg.manual === 'UPI: pay@bank, then email the receipt', 'the pay-another-way note is in the config');
  ok(!JSON.stringify(cfg).includes('sk_test_abc') && !JSON.stringify(cfg).includes(SW) && !JSON.stringify(cfg).includes('rz_secret'), 'config never contains a secret');
  const cs = (await call(stripeOnly, 'GET', '/api/pay/config')).json; ok(cs.enabled && !cs.providers.razorpay && cs.providers.stripe, 'Stripe alone is enough to open payments');

  const su = await call(api, 'POST', '/api/signup', { body: { username: 'gbuyer', password: 'correct-horse-9', email: 'g@example.com' } }), H = { cookie: ck(su) };
  const q = (await call(api, 'POST', '/api/pay/quote', { headers: H, body: { currency: 'usd' } })).json; ok(q.amount === 2900 && q.currency === 'USD', 'quote in USD: 2900 cents');
  ok((await call(api, 'POST', '/api/pay/quote', { headers: H, body: { currency: 'EUR' } })).json.amount === 2750, 'quote in EUR: 2750 cents');
  ok((await call(api, 'POST', '/api/pay/quote', { headers: H, body: { currency: 'JPY' } })).status === 400, 'a currency that is not offered is refused');
  ok((await call(api, 'POST', '/api/pay/quote', { headers: H, body: {} })).json.amount === 100000, 'default is still INR');
  /* coupons: create through the pay module's own store (as the owner would) */
  await kv.set('cp:FLAT100', JSON.stringify({ code: 'FLAT100', pct: 0, flat: 100, created: 1 })); await kv.set('cp:HALF', JSON.stringify({ code: 'HALF', pct: 50, flat: 0, created: 1 }));
  ok((await call(api, 'POST', '/api/pay/quote', { headers: H, body: { code: 'FLAT100', currency: 'USD' } })).status === 400, 'a flat rupee coupon is refused in USD');
  ok((await call(api, 'POST', '/api/pay/quote', { headers: H, body: { code: 'HALF', currency: 'USD' } })).json.amount === 1450, 'a percent coupon works in USD (1450)');
  ok((await call(api, 'POST', '/api/pay/quote', { headers: H, body: { code: 'FLAT100', currency: 'INR' } })).json.amount === 90000, 'the flat rupee coupon still works in INR');

  /* Razorpay in USD (international payments) */
  const ro = await call(api, 'POST', '/api/pay/order', { headers: H, body: { agree: true, currency: 'USD', provider: 'razorpay' } });
  ok(ro.status === 200 && ro.json.currency === 'USD' && ro.json.amount === 2900 && RZ.orders[ro.json.orderId].currency === 'USD', 'Razorpay order is made in USD with the server price');

  /* Stripe order */
  ok((await call(api, 'POST', '/api/pay/order', { headers: H, body: { currency: 'USD', provider: 'stripe' } })).status === 400, 'Stripe order needs the terms accepted too');
  const so = await call(api, 'POST', '/api/pay/order', { headers: H, body: { agree: true, currency: 'EUR', provider: 'stripe' } });
  ok(so.status === 200 && /^https:\/\/checkout\.stripe\.com\//.test(so.json.redirect) && /^order_st/.test(so.json.orderId), 'Stripe order returns a checkout address on stripe.com');
  const sb = ST.bodies[0]; ok(sb.mode === 'payment' && sb['line_items[0][price_data][unit_amount]'] === '2750' && sb['line_items[0][price_data][currency]'] === 'eur' && sb.client_reference_id === so.json.orderId && sb.success_url === 'https://shop.test/#/buy/paid' && sb.customer_email === 'g@example.com', 'the session carries server price, currency, order id, return address, e-mail');
  ok((await call(api, 'GET', '/api/content/bundle', { headers: H })).json.files.length === 0, 'unpaid: no premium files');
  const sync0 = await call(api, 'POST', '/api/pay/sync', { headers: H }); ok(!sync0.json.granted, 'sync before paying grants nothing');

  /* webhook security */
  const sid = so.json.orderId, sess = Object.values(ST.sessions).find(s => s.client_reference_id === sid);
  ok((await stHook(api, completed('evt_1', sid), { sig: 't=1,v1=abc' })).status === 400, 'bad signature is refused');
  ok((await stHook(api, completed('evt_1b', sid), { t: Math.floor(Date.now() / 1000) - 4000 })).status === 400, 'an old timestamp (replay) is refused');
  ok((await stHook(api, completed('evt_1c', sid), { secret: 'wrong' })).status === 400, 'a signature made with another secret is refused');
  const forged = await stHook(api, completed('evt_2', sid)); ok(forged.status === 200, 'a correctly signed event is accepted');
  ok((await call(api, 'GET', '/api/content/bundle', { headers: H })).json.files.length === 0, 'a signed event for an UNPAID session grants nothing (Stripe is asked, not believed)');
  /* amount mismatch: the session says paid but for less */
  sess.payment_status = 'paid'; sess.amount_total = 100;
  await stHook(api, completed('evt_3', sid)); ok((await call(api, 'GET', '/api/content/bundle', { headers: H })).json.files.length === 0, 'paid but the wrong amount: nothing granted');
  sess.amount_total = 2750; sess.currency = 'usd';
  await stHook(api, completed('evt_3b', sid)); ok((await call(api, 'GET', '/api/content/bundle', { headers: H })).json.files.length === 0, 'paid but the wrong currency: nothing granted');
  sess.currency = 'eur';
  /* the real thing */
  const good = await stHook(api, completed('evt_4', sid)); ok(good.status === 200, 'paid event accepted');
  const bundle = (await call(api, 'GET', '/api/content/bundle', { headers: H })).json; ok(bundle.files.length > 0, 'after the verified payment the premium files are sent');
  const dup = await stHook(api, completed('evt_4', sid)); ok(dup.json.duplicate === true, 'the same event twice is ignored');
  await stHook(api, completed('evt_5', sid)); const mine = (await call(api, 'GET', '/api/pay/mine', { headers: H })).json; ok(mine.pay.filter(p => p.status === 'paid').length === 1, 'a second event for the same order does not grant twice');
  ok((await call(api, 'POST', '/api/pay/sync', { headers: H })).status === 200, 'sync still fine afterwards');

  /* refund removes access */
  const pi = sess.payment_intent;
  const refund = { id: 'evt_6', type: 'charge.refunded', data: { object: { payment_intent: pi, amount: 2750, amount_refunded: 2750 } } };
  await stHook(api, refund); ok((await call(api, 'GET', '/api/content/bundle', { headers: H })).json.files.length === 0, 'a full refund takes the access away');

  /* "I paid but nothing happened": sync with no webhook at all, on a fresh buyer */
  const su2 = await call(api, 'POST', '/api/signup', { body: { username: 'gbuyer2', password: 'correct-horse-9', email: 'g2@example.com' } }), H2 = { cookie: ck(su2) };
  const o2 = await call(api, 'POST', '/api/pay/order', { headers: H2, body: { agree: true, currency: 'USD', provider: 'stripe' } });
  Object.values(ST.sessions).find(s => s.client_reference_id === o2.json.orderId).payment_status = 'paid';
  ok((await call(api, 'POST', '/api/pay/sync', { headers: H2 })).json.granted === true, 'return from Stripe + sync grants access even if the webhook never arrived');
  ok((await call(api, 'GET', '/api/content/bundle', { headers: H2 })).json.files.length > 0, 'and the files are sent');

  /* provider switched off */
  const rzOnly = mk({ DSQ_SECRET: 's', DSQ_GATING: 'on', RAZORPAY_KEY_ID: 'rzp_test_k', RAZORPAY_KEY_SECRET: 'x' }), s3 = await call(rzOnly, 'POST', '/api/signup', { body: { username: 'gbuyer3', password: 'correct-horse-9', email: 'g3@example.com' } });
  ok((await call(rzOnly, 'POST', '/api/pay/order', { headers: { cookie: ck(s3) }, body: { agree: true, provider: 'stripe' } })).status === 503, 'asking for a provider that is off gives a clear 503');
  ok((await stHook(rzOnly, completed('evt_9', 'order_st0000000000000000'))).json.ignored === 'stripe off', 'Stripe webhook on a site without Stripe is ignored');
  console.log(bad ? '\n' + bad + ' of ' + n + ' FAILED' : 'all ' + n + ' global payment checks passed'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
