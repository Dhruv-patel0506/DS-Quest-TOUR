'use strict';
/* =====================================================================
   Paid access with Razorpay (INR). Used by lib/hosted.js.
   The rules this file keeps:
   - The PRICE is decided here, on the server. The browser only says "buy" and an optional coupon code.
   - Access is never granted from what the browser or a webhook SAYS. Before granting we ask Razorpay's own API for the payment and check
     status = captured, the order it belongs to, and the amount we stored when the order was made.
   - Granting is idempotent (a lock per order), so the browser callback, the webhook and "I already paid" can all arrive in any order.
   - Access is DERIVED from the list of paid orders (u.pay), so a refund or a manual revoke just changes one entry and access follows.
   Keys come from the environment only: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET.
   A second provider is optional: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (hosted Checkout page: cards, Apple Pay, Google Pay, local methods in many countries).
   A third provider is optional: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET (PAYPAL_API for the sandbox, PAYPAL_WEBHOOK_ID for refund and backup events). PayPal takes the buyer to its own page and the server captures
   and CONFIRMS the order with PayPal before granting (status COMPLETED, our order id, the stored amount and currency). An Indian PayPal business account can only receive foreign-currency (for example USD) payments.
   Packages: one price for everything ("all") and one package per curriculum track (plans.default.json, built by tools/build_plans.js). A package is priced at DSQ_PACKAGE_RATIO (default 0.5)
   of the all-access price unless DSQ_PLANS says otherwise, e.g. DSQ_PLANS='[{"id":"ds","inr":1499,"prices":{"USD":19}},{"id":"web","off":true}]'. Access is kept per module (u.ent.mods) so packages and all-access can be combined.
   More currencies: DSQ_PRICES='{"USD":29,"EUR":27}' (whole units, two-decimal currencies only). DSQ_MANUAL_PAY_TEXT is shown as a 'pay another way' note.
   Price/plan: DSQ_PRICE_INR (default 1999), DSQ_ACCESS_DAYS (default 365, 0 = lifetime), DSQ_PLAN_NAME.
   ===================================================================== */
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const DAY = 86400000;
const hmac = (secret, text) => crypto.createHmac('sha256', String(secret)).update(String(text)).digest('hex');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const PAY_ID = /^pay_[A-Za-z0-9]{6,32}$/, ORDER_ID = /^order_[A-Za-z0-9]{6,32}$/, CODE = /^[A-Z0-9_-]{3,20}$/;
const rupees = p => (p / 100).toFixed(2).replace(/\.00$/, '');

function createPay({ kv, env, mail, mailConfig, getUser, putUser, fetchFn = fetch, now = Date.now }) {
  /* the name the buyer sees at checkout and on the receipt (default: the project name). Card statements must show a name close to the PAN or business name Razorpay has on file, so DSQ_BRAND_NAME can be set to exactly that name; DSQ_BUSINESS_NAME is the legal seller on the Terms and Refund pages (default: the owner's name) */
  const brand = String(env.DSQ_BRAND_NAME || env.DSQ_BUSINESS_NAME || 'Dhruv Patel Academy').slice(0, 60);
  const keyId = env.RAZORPAY_KEY_ID || '', keySecret = env.RAZORPAY_KEY_SECRET || '', whSecret = env.RAZORPAY_WEBHOOK_SECRET || '';
  const API = (env.RAZORPAY_API || 'https://api.razorpay.com/v1').replace(/\/$/, '');
  const enabled = !!(keyId && keySecret), stripeKey = env.STRIPE_SECRET_KEY || '', stripeWh = env.STRIPE_WEBHOOK_SECRET || '', stripeOn = !!stripeKey;
  const ppId = env.PAYPAL_CLIENT_ID || '', ppSecret = env.PAYPAL_CLIENT_SECRET || '', ppApi = (env.PAYPAL_API || 'https://api-m.paypal.com').replace(/\/$/, ''), ppWh = env.PAYPAL_WEBHOOK_ID || '', ppOn = !!(ppId && ppSecret), ppSandbox = /sandbox/.test(ppApi), anyOn = enabled || stripeOn || ppOn;
  const NO2 = new Set('JPY KRW VND CLP ISK UGX XAF XOF XPF BIF DJF GNF KMF MGA PYG RWF VUV BHD KWD OMR JOD TND LYD IQD'.split(' '));
  const days0 = () => (env.DSQ_ACCESS_DAYS === undefined || env.DSQ_ACCESS_DAYS === '' ? 365 : Math.max(0, Math.round(+env.DSQ_ACCESS_DAYS) || 0));
  const allPrices = () => { const t = { INR: Math.max(1, Math.round(+env.DSQ_PRICE_INR || 1999)) }; let j = {}; try { j = JSON.parse(env.DSQ_PRICES || '{}'); } catch (e) { } for (const [c, v] of Object.entries(j || {})) { const k = String(c).toUpperCase(); if (/^[A-Z]{3}$/.test(k) && k !== 'INR' && !NO2.has(k) && +v > 0) t[k] = Math.round(+v * 100) / 100; } return t; };
  /* the packages: the generated list (one per curriculum track) with the owner's changes from DSQ_PLANS on top */
  let defPlans = null;
  const packages = () => {
    if (!defPlans) { try { defPlans = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'plans.default.json'), 'utf8')).plans || []; } catch (e) { defPlans = []; } }
    let over = []; try { over = JSON.parse(env.DSQ_PLANS || '[]'); } catch (e) { } if (!Array.isArray(over)) over = [];
    const out = defPlans.map(p => Object.assign({}, p)); const by = id => out.find(x => x.id === id);
    for (const o of over) { if (!o || !/^[a-z0-9_-]{2,24}$/.test(String(o.id || ''))) continue; const cur = by(o.id); if (o.off) { if (cur) out.splice(out.indexOf(cur), 1); continue; } if (cur) Object.assign(cur, o); else if (Array.isArray(o.modules) && o.modules.length) out.push(Object.assign({}, o)); }
    return out.filter(p => p.id !== 'all' && Array.isArray(p.modules) && p.modules.length);
  };
  const ratio = () => { const r = +env.DSQ_PACKAGE_RATIO; return r > 0 && r <= 1 ? r : .5; };
  const planDef = id => (id && id !== 'all' ? packages().find(p => p.id === id) || null : { id: 'all', name: env.DSQ_PLAN_NAME || (brand + ' full access'), modules: null });
  const prices = planId => {
    const t = allPrices(); if (!planId || planId === 'all') return t; const pl = planDef(planId); if (!pl) return t;
    const out = {}; for (const [c, v] of Object.entries(t)) out[c] = c === 'INR' ? Math.max(1, Math.round(v * ratio())) : Math.round(v * ratio() * 100) / 100;
    if (+pl.inr > 0) out.INR = Math.round(+pl.inr); for (const [c, v] of Object.entries(pl.prices || {})) { const k = String(c).toUpperCase(); if (/^[A-Z]{3}$/.test(k) && !NO2.has(k) && +v > 0 && (k === 'INR' || t[k])) out[k] = Math.round(+v * 100) / 100; }
    return out;
  };
  const plan = planId => { const d = planDef(planId) || planDef('all'), inr = prices(d.id).INR; return { id: d.id, name: d.id === 'all' ? d.name : d.name, inr, paise: inr * 100, days: d.days != null && d.id !== 'all' ? Math.max(0, Math.round(+d.days) || 0) : days0(), currency: 'INR', modules: d.modules || null }; };
  const legal = () => ({ business: env.DSQ_BUSINESS_NAME || 'Dhruv Dharmeshkumar Patel', email: env.DSQ_CONTACT_EMAIL || '', address: env.DSQ_BUSINESS_ADDRESS || '', refundDays: env.DSQ_REFUND_DAYS === undefined || env.DSQ_REFUND_DAYS === '' ? 7 : Math.max(0, Math.round(+env.DSQ_REFUND_DAYS) || 0), law: env.DSQ_JURISDICTION || '', reviewed: env.DSQ_LEGAL_REVIEWED === 'yes' });
  const config = () => { const p = plan(); return { brand, legal: legal(), enabled: anyOn, keyId: enabled ? keyId : '', test: enabled ? /^rzp_test_/.test(keyId) : stripeOn ? /^sk_test_/.test(stripeKey) : ppSandbox, webhook: enabled ? !!whSecret : !!stripeWh, providers: { razorpay: enabled, stripe: stripeOn, razorpayTest: enabled && /^rzp_test_/.test(keyId), stripeTest: stripeOn && /^sk_test_/.test(stripeKey), razorpayWebhook: !!whSecret, stripeWebhook: !!stripeWh, paypal: ppOn, paypalTest: ppOn && ppSandbox, paypalWebhook: !!ppWh }, currencies: Object.entries(prices('all')).map(([code, amount]) => ({ code, amount })), plans: [{ id: 'all', name: p.name, blurb: 'Every module, every function sheet, notebook and room.', modules: null, days: p.days, prices: Object.entries(prices('all')).map(([code, amount]) => ({ code, amount })) }].concat(packages().map(k => { const q = plan(k.id); return { id: k.id, name: k.name, blurb: k.blurb || '', modules: k.modules, days: q.days, prices: Object.entries(prices(k.id)).map(([code, amount]) => ({ code, amount })) }; })), manual: String(env.DSQ_MANUAL_PAY_TEXT || '').slice(0, 600), plan: { id: p.id, name: p.name, inr: p.inr, days: p.days, currency: p.currency } }; };

  async function rzp(method, path, body) {
    const r = await fetchFn(API + path, { method, headers: { Authorization: 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64'), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    let j = {}; try { j = await r.json(); } catch (e) { }
    if (!r.ok) { const e = new Error((j.error && j.error.description) || ('Razorpay said ' + r.status)); e.status = r.status; throw e; }
    return j;
  }

  /* ---------- access is derived from the paid entries ---------- */
  function recompute(u) {
    const act = (u.pay || []).filter(p => p.status === 'paid').sort((a, b) => a.at - b.at);
    if (!act.length) { delete u.ent; return; }
    let until = 0, life = false, allOn = false; const mods = {};
    for (const p of act) {
      if (!Array.isArray(p.modules) || !p.modules.length) { allOn = true; if (!p.days) life = true; else until = Math.max(until, p.at) + p.days * DAY; }
      else for (const m of p.modules) { if (mods[m] === 0) continue; if (!p.days) mods[m] = 0; else mods[m] = Math.max(mods[m] || 0, p.at) + p.days * DAY; }
    }
    u.ent = { all: allOn, until: allOn ? (life ? 0 : until) : 0 }; if (Object.keys(mods).length) u.ent.mods = mods;
  }

  /* ---------- coupons ---------- */
  const getCoupon = async code => { const c = CODE.test(String(code || '').toUpperCase()) && await kv.get('cp:' + String(code).toUpperCase()); return c ? JSON.parse(c) : null; };
  async function quote(codeIn, curIn, planIn) {
    if (planIn && planIn !== 'all' && !planDef(planIn)) return { error: 'That package does not exist.' };
    const p = plan(planIn), tab = prices(p.id), cur = String(curIn || 'INR').toUpperCase(); if (!tab[cur]) return { error: 'That currency is not offered.' };
    let base = Math.round(tab[cur] * 100), discount = 0, coupon = null;
    const code = String(codeIn || '').trim().toUpperCase();
    if (code) {
      const c = await getCoupon(code);
      if (!c || c.off) return { error: 'That coupon code is not valid.' };
      if (c.until && c.until < now()) return { error: 'That coupon has expired.' };
      if (c.max && (+await kv.get('cpu:' + code) || 0) >= c.max) return { error: 'That coupon has been used up.' };
      if (!c.pct && cur !== 'INR') return { error: 'That coupon is a flat amount in rupees. It works when you pay in INR.' };
      discount = c.pct ? Math.floor(base * Math.min(100, c.pct) / 100) : Math.min(base, Math.round((c.flat || 0) * 100));
      coupon = code;
    }
    return { base, discount, amount: Math.max(0, base - discount), coupon, currency: cur, plan: p.id };
  }

  /* ---------- granting (idempotent) ---------- */
  async function applyPaid(order, paymentId, src) {
    if ((await kv.incr('og:' + order.id)) !== 1) { await kv.expire('og:' + order.id, 60); return { already: true }; }
    await kv.expire('og:' + order.id, 600);
    const u = await getUser(order.user); if (!u) return { error: 'account not found' };
    const p = { name: order.planName || plan('all').name }; u.pay = u.pay || [];
    if (!u.pay.some(x => x.id === order.id)) u.pay.push({ id: order.id, src, plan: order.plan || 'all', modules: order.modules || null, days: order.days, amount: order.amount, currency: order.currency || 'INR', at: now(), status: 'paid', pid: paymentId || '' });
    recompute(u); await putUser(u);
    order.status = 'paid'; order.paymentId = paymentId || ''; order.paidAt = now(); await kv.set('o:' + order.id, JSON.stringify(order));
    if (paymentId) await kv.set('op:' + paymentId, order.id);
    if (order.coupon) await kv.incr('cpu:' + order.coupon);
    receipt(u, order, p).catch(() => { });
    return { granted: true, until: u.ent ? u.ent.until : 0 };
  }
  async function receipt(u, order, p) {
    const cfg = mailConfig(env); if (!cfg || !u.email) return;
    await mail({ ...cfg, to: u.email, subject: 'Your ' + brand + ' receipt', text: `Hi ${u.display},\n\nThank you. Your payment was received and your access is active.\n\nItem: ${p.name}\nAmount paid: ${order.currency && order.currency !== 'INR' ? order.currency + ' ' : 'Rs '}${rupees(order.amount)}${order.coupon ? ' (coupon ' + order.coupon + ')' : ''}\nOrder: ${order.id}${order.paymentId ? '\nPayment: ' + order.paymentId : ''}\nAccess: ${order.days ? order.days + ' days' : 'lifetime'}\n\nThis is a payment receipt, not a tax invoice. Questions or a refund request: just reply to this email.\n` });
  }
  const getOrder = async id => { const v = ORDER_ID.test(String(id)) && await kv.get('o:' + id); return v ? JSON.parse(v) : null; };

  /* Ask Razorpay itself. Returns the payment only when it is captured, belongs to this order and has the amount we stored. */
  async function confirmPayment(order, paymentId) {
    if (!PAY_ID.test(String(paymentId))) return null;
    let pay = await rzp('GET', '/payments/' + paymentId);
    if (pay.status === 'authorized') pay = await rzp('POST', '/payments/' + paymentId + '/capture', { amount: order.amount, currency: order.currency || 'INR' });
    return pay.status === 'captured' && pay.order_id === order.id && pay.amount === order.amount && pay.currency === (order.currency || 'INR') ? pay : null;
  }

  /* ---------- Stripe (optional second provider) ---------- */
  async function stripeCall(method, path, form) {
    const r = await fetchFn('https://api.stripe.com/v1' + path, { method, headers: { Authorization: 'Bearer ' + stripeKey, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form ? form.toString() : undefined, signal: AbortSignal.timeout(20000) });
    let j = {}; try { j = await r.json(); } catch (e) { }
    if (!r.ok) { const e = new Error((j.error && j.error.message) || ('Stripe said ' + r.status)); e.status = r.status; throw e; }
    return j;
  }
  /* Ask Stripe itself: paid, this order, the stored amount and currency */
  async function confirmStripe(order) {
    if (!/^cs_[A-Za-z0-9_]+$/.test(order.sessionId || '')) return null;
    const ss = await stripeCall('GET', '/checkout/sessions/' + order.sessionId);
    return ss.payment_status === 'paid' && ss.client_reference_id === order.id && ss.amount_total === order.amount && String(ss.currency || '').toUpperCase() === (order.currency || 'INR') ? ss : null;
  }
  async function stripeWebhook({ raw, headers, body }) {
    if (!stripeOn) return { status: 200, json: { ignored: 'stripe off' } };
    if (raw != null) {
      if (!stripeWh) return { status: 400, json: { error: 'webhook secret not set' } };
      const parts = String(headers['stripe-signature'] || '').split(',').map(x => x.trim().split('=')), t = (parts.find(x => x[0] === 't') || [])[1], sigs = parts.filter(x => x[0] === 'v1').map(x => x[1]);
      if (!t || !sigs.length || Math.abs(now() / 1000 - +t) > 300 || !sigs.some(g => same(hmac(stripeWh, t + '.' + raw), g))) return { status: 400, json: { error: 'bad signature' } };
    }
    const evId = String((body || {}).id || ''); if (evId) { if ((await kv.incr('ev:' + evId)) !== 1) return { status: 200, json: { duplicate: true } }; await kv.expire('ev:' + evId, 7 * 86400); }
    const ev = String((body || {}).type || ''), obj = ((body || {}).data || {}).object || {};
    if (/^checkout\.session\.(completed|async_payment_succeeded)$/.test(ev)) {
      const order = await getOrder(obj.client_reference_id); if (!order || order.provider !== 'stripe') return { status: 200, json: { ignored: 'not our order' } };
      let ss = null; try { ss = await confirmStripe(order); } catch (e) { return { status: 500, json: { error: 'confirm failed, retry' } }; }
      if (ss) await applyPaid(order, String(ss.payment_intent || ss.id), 'stripe'); return { status: 200, json: { ok: true } };
    }
    if (ev === 'charge.refunded') {
      const oid = obj.payment_intent && await kv.get('op:' + obj.payment_intent), order = oid && await getOrder(oid); if (!order) return { status: 200, json: { ignored: 'not our order' } };
      order.refunded = obj.amount_refunded || 0; await kv.set('o:' + order.id, JSON.stringify(order));
      if (obj.amount && obj.amount_refunded >= obj.amount && order.status === 'paid') {
        order.status = 'refunded'; await kv.set('o:' + order.id, JSON.stringify(order));
        const u = await getUser(order.user); if (u) { (u.pay || []).forEach(x => { if (x.id === order.id) x.status = 'refunded'; }); recompute(u); await putUser(u); }
      }
      return { status: 200, json: { ok: true } };
    }
    return { status: 200, json: { ignored: ev } };
  }

  /* ---------- PayPal (optional third provider; Orders v2) ---------- */
  let ppTok = null;
  async function ppToken() {
    if (ppTok && ppTok.exp > now() + 60000) return ppTok.t;
    const r = await fetchFn(ppApi + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(ppId + ':' + ppSecret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials', signal: AbortSignal.timeout(20000) });
    let j = {}; try { j = await r.json(); } catch (e) { }
    if (!r.ok || !j.access_token) { const e = new Error(j.error_description || ('PayPal said ' + r.status)); e.status = r.status; throw e; }
    ppTok = { t: j.access_token, exp: now() + (+j.expires_in || 300) * 1000 }; return ppTok.t;
  }
  async function ppCall(method, path, body, extra) {
    const r = await fetchFn(ppApi + path, { method, headers: Object.assign({ Authorization: 'Bearer ' + await ppToken(), 'Content-Type': 'application/json' }, extra || {}), body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    let j = {}; try { j = await r.json(); } catch (e) { }
    if (!r.ok) { const e = new Error(j.message || (j.details && j.details[0] && j.details[0].description) || ('PayPal said ' + r.status)); e.status = r.status; throw e; }
    return j;
  }
  const money2 = minor => (minor / 100).toFixed(2);
  /* Ask PayPal itself. Captures an approved order, then returns the capture only when it is COMPLETED, for this order id, the stored amount and the stored currency. */
  async function confirmPayPal(order) {
    if (!/^[A-Z0-9]{8,40}$/.test(order.ppId || '')) return null;
    let o = await ppCall('GET', '/v2/checkout/orders/' + order.ppId);
    if (o.status === 'APPROVED') o = await ppCall('POST', '/v2/checkout/orders/' + order.ppId + '/capture', {}, { 'PayPal-Request-Id': order.id });
    if (o.status !== 'COMPLETED') return null;
    const pu = (o.purchase_units || [])[0] || {}, cap = ((pu.payments || {}).captures || [])[0] || {};
    const refOk = pu.reference_id === order.id || pu.custom_id === order.id || cap.custom_id === order.id;
    return refOk && cap.status === 'COMPLETED' && cap.amount && cap.amount.value === money2(order.amount) && String(cap.amount.currency_code || '').toUpperCase() === (order.currency || 'USD') ? cap : null;
  }
  async function paypalWebhook({ headers, body }) {
    if (!ppOn) return { status: 200, json: { ignored: 'paypal off' } };
    if (!ppWh) return { status: 400, json: { error: 'webhook id not set' } };
    const h = k => String((headers || {})[k] || '');
    try {
      const v = await ppCall('POST', '/v1/notifications/verify-webhook-signature', { auth_algo: h('paypal-auth-algo'), cert_url: h('paypal-cert-url'), transmission_id: h('paypal-transmission-id'), transmission_sig: h('paypal-transmission-sig'), transmission_time: h('paypal-transmission-time'), webhook_id: ppWh, webhook_event: body || {} });
      if (v.verification_status !== 'SUCCESS') return { status: 400, json: { error: 'bad signature' } };
    } catch (e) { return { status: 500, json: { error: 'verify failed, retry' } }; }
    const evId = String((body || {}).id || ''); if (evId) { if ((await kv.incr('ev:' + evId)) !== 1) return { status: 200, json: { duplicate: true } }; await kv.expire('ev:' + evId, 7 * 86400); }
    const ev = String((body || {}).event_type || ''), res = (body || {}).resource || {};
    if (ev === 'PAYMENT.CAPTURE.COMPLETED' || ev === 'CHECKOUT.ORDER.APPROVED') {
      const oid = res.custom_id || ((res.purchase_units || [])[0] || {}).reference_id, order = await getOrder(oid); if (!order || order.provider !== 'paypal') return { status: 200, json: { ignored: 'not our order' } };
      let cap = null; try { cap = await confirmPayPal(order); } catch (e) { return { status: 500, json: { error: 'confirm failed, retry' } }; }
      if (cap) await applyPaid(order, String(cap.id), 'paypal'); return { status: 200, json: { ok: true } };
    }
    if (ev === 'PAYMENT.CAPTURE.REFUNDED' || ev === 'PAYMENT.CAPTURE.REVERSED') {
      const up = ((res.links || []).find(l => l.rel === 'up') || {}).href || '', capId = (up.match(/\/captures\/([A-Z0-9]+)$/) || [])[1] || (ev === 'PAYMENT.CAPTURE.REVERSED' ? res.id : ''), oid = capId && await kv.get('op:' + capId), order = oid && await getOrder(oid);
      if (!order) return { status: 200, json: { ignored: 'not our order' } };
      let cap; try { cap = await ppCall('GET', '/v2/payments/captures/' + capId); } catch (e) { return { status: 500, json: { error: 'lookup failed, retry' } }; }
      if (cap.status === 'REFUNDED' && order.status === 'paid') {
        order.status = 'refunded'; await kv.set('o:' + order.id, JSON.stringify(order));
        const u = await getUser(order.user); if (u) { (u.pay || []).forEach(x => { if (x.id === order.id) x.status = 'refunded'; }); recompute(u); await putUser(u); }
      }
      return { status: 200, json: { ok: true } };
    }
    return { status: 200, json: { ignored: ev } };
  }

  /* ---------- the buyer's calls ---------- */
  async function createOrder(u, codeIn, agree, opt) {
    opt = opt || {}; const prov = opt.provider === 'stripe' ? 'stripe' : opt.provider === 'paypal' ? 'paypal' : 'razorpay';
    if (!anyOn) return { status: 503, json: { error: 'Payments are not switched on yet.' } };
    if (prov === 'stripe' ? !stripeOn : prov === 'paypal' ? !ppOn : !enabled) return { status: 503, json: { error: (prov === 'stripe' ? 'Card checkout' : prov === 'paypal' ? 'PayPal' : 'UPI and card checkout') + ' is not switched on. Choose another way to pay.' } };
    if (agree !== true) return { status: 400, json: { error: 'Please tick the box to accept the Terms and the Refund policy first.' } };
    const q = await quote(codeIn, opt.currency, opt.plan); if (q.error) return { status: 400, json: { error: q.error } };
    const p = plan(opt.plan), id0 = 'order_free' + crypto.randomBytes(8).toString('hex');
    if (q.amount === 0) {
      const o = { id: id0, user: u.username.toLowerCase(), plan: p.id, planName: p.name, modules: p.modules, days: p.days, amount: 0, currency: q.currency, base: q.base, coupon: q.coupon, status: 'created', created: now(), agreed: now() };
      await kv.set('o:' + o.id, JSON.stringify(o)); await kv.zadd('ol', now(), o.id);
      const r = await applyPaid(o, '', 'coupon'); return { status: 200, json: { free: true, granted: !!r.granted } };
    }
    if (q.amount < 100) return { status: 400, json: { error: 'This amount is below the payment minimum. Ask the owner.' } };
    if (prov === 'stripe') {
      const oid = 'order_st' + crypto.randomBytes(8).toString('hex'), site = String(opt.origin || env.APP_URL || '').replace(/\/$/, '');
      if (!/^https?:\/\//.test(site)) return { status: 500, json: { error: 'The site address is not set (APP_URL). Ask the owner.' } };
      const f = new URLSearchParams(); f.set('mode', 'payment'); f.set('success_url', site + '/#/buy/paid'); f.set('cancel_url', site + '/#/buy/cancelled'); f.set('client_reference_id', oid);
      if (u.email) f.set('customer_email', u.email);
      f.set('line_items[0][quantity]', '1'); f.set('line_items[0][price_data][currency]', q.currency.toLowerCase()); f.set('line_items[0][price_data][unit_amount]', String(q.amount)); f.set('line_items[0][price_data][product_data][name]', p.name);
      f.set('metadata[order]', oid); f.set('metadata[user]', u.username);
      let ss; try { ss = await stripeCall('POST', '/checkout/sessions', f); } catch (e) { return { status: 502, json: { error: 'The payment provider did not answer (' + e.message + '). Nothing was charged. Try again.' } }; }
      if (!/^cs_[A-Za-z0-9_]+$/.test(ss.id || '') || !/^https:\/\/checkout\.stripe\.com\//.test(ss.url || '')) return { status: 502, json: { error: 'The payment provider returned an unexpected page. Nothing was charged.' } };
      const o = { id: oid, provider: 'stripe', sessionId: ss.id, user: u.username.toLowerCase(), plan: p.id, planName: p.name, modules: p.modules, days: p.days, amount: q.amount, currency: q.currency, base: q.base, coupon: q.coupon, status: 'created', created: now(), agreed: now() };
      await kv.set('o:' + o.id, JSON.stringify(o)); await kv.zadd('ol', now(), o.id); u.orders = (u.orders || []).concat(o.id).slice(-20); await putUser(u);
      return { status: 200, json: { redirect: ss.url, orderId: o.id } };
    }
    if (prov === 'paypal') {
      const oid = 'order_pp' + crypto.randomBytes(8).toString('hex'), site = String(opt.origin || env.APP_URL || '').replace(/\/$/, '');
      if (!/^https?:\/\//.test(site)) return { status: 500, json: { error: 'The site address is not set (APP_URL). Ask the owner.' } };
      let pp; try { pp = await ppCall('POST', '/v2/checkout/orders', { intent: 'CAPTURE', purchase_units: [{ reference_id: oid, custom_id: oid, description: p.name, amount: { currency_code: q.currency, value: money2(q.amount) } }], payment_source: { paypal: { experience_context: { brand_name: brand, user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING', return_url: site + '/#/buy/paid', cancel_url: site + '/#/buy/cancelled' } } } }, { 'PayPal-Request-Id': oid }); } catch (e) { return { status: 502, json: { error: 'PayPal did not accept the order (' + e.message + '). Nothing was charged.' + (q.currency === 'INR' ? ' An Indian PayPal business account cannot take INR: offer the price in USD (DSQ_PRICES).' : '') } }; }
      const link = (pp.links || []).find(l => l.rel === 'payer-action' || l.rel === 'approve') || {};
      if (!/^[A-Z0-9]{8,40}$/.test(pp.id || '') || !/^https:\/\/www\.(sandbox\.)?paypal\.com\//.test(link.href || '')) return { status: 502, json: { error: 'PayPal returned an unexpected answer. Nothing was charged.' } };
      const o = { id: oid, provider: 'paypal', ppId: pp.id, user: u.username.toLowerCase(), plan: p.id, planName: p.name, modules: p.modules, days: p.days, amount: q.amount, currency: q.currency, base: q.base, coupon: q.coupon, status: 'created', created: now(), agreed: now() };
      await kv.set('o:' + o.id, JSON.stringify(o)); await kv.zadd('ol', now(), o.id); u.orders = (u.orders || []).concat(o.id).slice(-20); await putUser(u);
      return { status: 200, json: { redirect: link.href, orderId: o.id } };
    }
    let rz; try { rz = await rzp('POST', '/orders', { amount: q.amount, currency: q.currency, receipt: 'dsq_' + crypto.randomBytes(6).toString('hex'), notes: { user: u.username, plan: p.id, coupon: q.coupon || '' } }); } catch (e) { return { status: 502, json: { error: 'The payment provider did not answer (' + e.message + '). Nothing was charged. Try again.' + (q.currency !== 'INR' ? ' Paying in ' + q.currency + ' needs international payments switched on in the Razorpay account.' : '') } }; }
    if (!ORDER_ID.test(rz.id || '') || rz.amount !== q.amount) return { status: 502, json: { error: 'The payment provider returned an unexpected order. Nothing was charged.' } };
    const o = { id: rz.id, user: u.username.toLowerCase(), plan: p.id, planName: p.name, modules: p.modules, days: p.days, amount: q.amount, currency: q.currency, base: q.base, coupon: q.coupon, status: 'created', created: now(), agreed: now() };
    await kv.set('o:' + o.id, JSON.stringify(o)); await kv.zadd('ol', now(), o.id);
    u.orders = (u.orders || []).concat(o.id).slice(-20); await putUser(u);
    return { status: 200, json: { orderId: o.id, amount: o.amount, currency: q.currency, keyId, name: brand, description: p.name, prefill: { name: u.display || u.username, email: u.email || '' } } };
  }
  /* the browser callback after the Razorpay popup: order id, payment id and Razorpay's signature */
  async function verify(u, b) {
    const oid = String(b.razorpay_order_id || ''), pid = String(b.razorpay_payment_id || ''), sig = String(b.razorpay_signature || '');
    const order = await getOrder(oid); if (!order || order.user !== u.username.toLowerCase()) return { status: 404, json: { error: 'Unknown order.' } };
    if (!same(hmac(keySecret, oid + '|' + pid), sig)) return { status: 400, json: { error: 'The payment signature did not match. Nothing was granted. If you were charged, press "I already paid" on the buy page.' } };
    let pay; try { pay = await confirmPayment(order, pid); } catch (e) { return { status: 502, json: { error: 'Could not confirm the payment with the provider yet. Press "I already paid" in a minute.' } }; }
    if (!pay) return { status: 402, json: { error: 'The payment is not complete yet.' } };
    const r = await applyPaid(order, pid, 'razorpay'); return { status: 200, json: { ok: true, granted: !!r.granted, already: !!r.already } };
  }
  /* "I paid but nothing happened": ask Razorpay what happened to this account's recent orders */
  async function sync(u) {
    let granted = false;
    for (const id of (u.orders || []).slice(-5)) {
      const order = await getOrder(id); if (!order || order.status === 'paid') continue;
      if (order.provider === 'stripe') { try { const ss = stripeOn && await confirmStripe(order); if (ss) { const r = await applyPaid(order, String(ss.payment_intent || ss.id), 'stripe'); granted = granted || !!r.granted; } } catch (e) { } continue; }
      if (order.provider === 'paypal') { try { const cap = ppOn && await confirmPayPal(order); if (cap) { const r = await applyPaid(order, String(cap.id), 'paypal'); granted = granted || !!r.granted; } } catch (e) { } continue; }
      if (!enabled) continue;
      try { const list = await rzp('GET', '/orders/' + id + '/payments'); for (const p of (list.items || [])) { const pay = await confirmPayment(order, p.id); if (pay) { const r = await applyPaid(order, p.id, 'razorpay'); granted = granted || !!r.granted; break; } } } catch (e) { }
    }
    return { status: 200, json: { ok: true, granted } };
  }
  const mine = u => ({ pay: (u.pay || []).map(p => ({ id: p.id, src: p.src, amount: p.amount, currency: p.currency || 'INR', at: p.at, days: p.days, status: p.status })), ent: u.ent || null });

  /* ---------- Razorpay -> us (webhook). raw = exact request text; null when the platform already parsed it ---------- */
  async function webhook({ raw, headers, body }) {
    if (!enabled) return { status: 200, json: { ignored: 'payments off' } };
    if (raw != null) { if (!whSecret) return { status: 400, json: { error: 'webhook secret not set' } }; if (!same(hmac(whSecret, raw), String(headers['x-razorpay-signature'] || ''))) return { status: 400, json: { error: 'bad signature' } }; }
    const evId = String(headers['x-razorpay-event-id'] || ''); if (evId) { if ((await kv.incr('ev:' + evId)) !== 1) return { status: 200, json: { duplicate: true } }; await kv.expire('ev:' + evId, 7 * 86400); }
    const ev = String((body || {}).event || ''), pl = (body || {}).payload || {};
    const pid = ((pl.payment || {}).entity || {}).id || ((pl.refund || {}).entity || {}).payment_id || '';
    if (!PAY_ID.test(pid)) return { status: 200, json: { ignored: 'no payment' } };
    let pay; try { pay = await rzp('GET', '/payments/' + pid); } catch (e) { return { status: 500, json: { error: 'lookup failed, retry' } }; }
    const order = await getOrder(pay.order_id); if (!order) return { status: 200, json: { ignored: 'not our order' } };
    if (/^(payment\.captured|payment\.authorized|order\.paid)$/.test(ev)) {
      let ok = null; try { ok = await confirmPayment(order, pid); } catch (e) { return { status: 500, json: { error: 'confirm failed, retry' } }; }
      if (ok) await applyPaid(order, pid, 'razorpay'); return { status: 200, json: { ok: true } };
    }
    if (/^refund\./.test(ev)) {
      order.refunded = pay.amount_refunded || 0; await kv.set('o:' + order.id, JSON.stringify(order));
      if (pay.amount && pay.amount_refunded >= pay.amount && order.status === 'paid') {
        order.status = 'refunded'; await kv.set('o:' + order.id, JSON.stringify(order));
        const u = await getUser(order.user); if (u) { (u.pay || []).forEach(p => { if (p.id === order.id) p.status = 'refunded'; }); recompute(u); await putUser(u); }
      }
      return { status: 200, json: { ok: true } };
    }
    return { status: 200, json: { ignored: ev } };
  }

  /* ---------- the owner's calls ---------- */
  const lookup = async who => { const id = String(who || '').trim().toLowerCase(); return id ? getUser(id.includes('@') ? await kv.get('e:' + id) : id) : null; };
  async function overview() {
    const ol = await kv.zrevrange('ol', 0, 59), orders = []; for (let i = 0; i < ol.length; i += 2) { const o = await getOrder(ol[i]); if (o) orders.push(o); }
    const cl = await kv.zrevrange('cpl', 0, 59), coupons = []; for (let i = 0; i < cl.length; i += 2) { const c = await getCoupon(cl[i]); if (c) coupons.push(Object.assign({ used: +await kv.get('cpu:' + c.code) || 0 }, c)); }
    return { config: config(), orders, coupons, revenuePaise: orders.filter(o => o.status === 'paid' && (o.currency || 'INR') === 'INR').reduce((n, o) => n + o.amount, 0), revenue: orders.filter(o => o.status === 'paid').reduce((m, o) => { const c = o.currency || 'INR'; m[c] = (m[c] || 0) + o.amount; return m; }, {}) };
  }
  async function grant(b) {
    const u = await lookup(b.username); if (!u) return { status: 404, json: { error: 'No such account.' } };
    const days = b.lifetime ? 0 : Math.round(+b.days); if (!b.lifetime && !(days > 0 && days <= 3660)) return { status: 400, json: { error: 'Give a number of days (1 to 3660) or tick lifetime.' } };
    u.pay = (u.pay || []).concat({ id: 'manual_' + now() + '_' + crypto.randomBytes(3).toString('hex'), src: 'manual', days, amount: 0, at: now(), status: 'paid', note: String(b.note || '').slice(0, 120) });
    recompute(u); await putUser(u); return { status: 200, json: { ok: true, ent: u.ent } };
  }
  async function revoke(b) {
    const u = await lookup(b.username); if (!u) return { status: 404, json: { error: 'No such account.' } };
    (u.pay || []).forEach(p => { if (p.status === 'paid') p.status = 'revoked'; }); recompute(u); await putUser(u); return { status: 200, json: { ok: true } };
  }
  async function makeCoupon(b) {
    const code = String(b.code || '').trim().toUpperCase(); if (!CODE.test(code)) return { status: 400, json: { error: 'Code: 3-20 letters, digits, - or _.' } };
    const pct = Math.round(+b.pct || 0), flat = Math.round(+b.flat || 0); if (!(pct >= 1 && pct <= 100) && !(flat >= 1)) return { status: 400, json: { error: 'Give a percent off (1-100) or a flat amount in rupees.' } };
    const c = { code, pct: pct >= 1 ? Math.min(100, pct) : 0, flat: pct >= 1 ? 0 : flat, max: Math.max(0, Math.round(+b.max || 0)), until: b.until ? +new Date(b.until) || 0 : 0, note: String(b.note || '').slice(0, 80), created: now() };
    await kv.set('cp:' + code, JSON.stringify(c)); await kv.zadd('cpl', now(), code); return { status: 200, json: { ok: true, coupon: c } };
  }
  async function dropCoupon(b) {
    const c = await getCoupon(b.code); if (!c) return { status: 404, json: { error: 'No such coupon.' } };
    c.off = true; await kv.set('cp:' + c.code, JSON.stringify(c)); return { status: 200, json: { ok: true } };
  }
  return { config, quote, createOrder, verify, sync, mine, webhook, stripeWebhook, overview, grant, revoke, paypalWebhook, makeCoupon, dropCoupon, recompute, hmac };
}
module.exports = { createPay, hmac };
