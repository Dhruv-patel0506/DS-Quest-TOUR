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
   Price/plan: DSQ_PRICE_INR (default 1999), DSQ_ACCESS_DAYS (default 365, 0 = lifetime), DSQ_PLAN_NAME.
   ===================================================================== */
const crypto = require('crypto');
const DAY = 86400000;
const hmac = (secret, text) => crypto.createHmac('sha256', String(secret)).update(String(text)).digest('hex');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const PAY_ID = /^pay_[A-Za-z0-9]{6,32}$/, ORDER_ID = /^order_[A-Za-z0-9]{6,32}$/, CODE = /^[A-Z0-9_-]{3,20}$/;
const rupees = p => (p / 100).toFixed(2).replace(/\.00$/, '');

function createPay({ kv, env, mail, mailConfig, getUser, putUser, fetchFn = fetch, now = Date.now }) {
  const keyId = env.RAZORPAY_KEY_ID || '', keySecret = env.RAZORPAY_KEY_SECRET || '', whSecret = env.RAZORPAY_WEBHOOK_SECRET || '';
  const API = (env.RAZORPAY_API || 'https://api.razorpay.com/v1').replace(/\/$/, '');
  const enabled = !!(keyId && keySecret);
  const plan = () => { const inr = Math.max(1, Math.round(+env.DSQ_PRICE_INR || 1999)), days = env.DSQ_ACCESS_DAYS === undefined || env.DSQ_ACCESS_DAYS === '' ? 365 : Math.max(0, Math.round(+env.DSQ_ACCESS_DAYS) || 0); return { id: 'all', name: env.DSQ_PLAN_NAME || 'DS Quest full access', inr, paise: inr * 100, days, currency: 'INR' }; };
  const legal = () => ({ business: env.DSQ_BUSINESS_NAME || 'DS Quest', email: env.DSQ_CONTACT_EMAIL || '', address: env.DSQ_BUSINESS_ADDRESS || '', refundDays: env.DSQ_REFUND_DAYS === undefined || env.DSQ_REFUND_DAYS === '' ? 7 : Math.max(0, Math.round(+env.DSQ_REFUND_DAYS) || 0), law: env.DSQ_JURISDICTION || '', reviewed: env.DSQ_LEGAL_REVIEWED === 'yes' });
  const config = () => { const p = plan(); return { legal: legal(), enabled, keyId: enabled ? keyId : '', test: /^rzp_test_/.test(keyId), webhook: !!whSecret, plan: { id: p.id, name: p.name, inr: p.inr, days: p.days, currency: p.currency } }; };

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
    let until = 0, life = false;
    for (const p of act) { if (!p.days) life = true; else until = Math.max(until, p.at) + p.days * DAY; }
    u.ent = { all: true, until: life ? 0 : until };
  }

  /* ---------- coupons ---------- */
  const getCoupon = async code => { const c = CODE.test(String(code || '').toUpperCase()) && await kv.get('cp:' + String(code).toUpperCase()); return c ? JSON.parse(c) : null; };
  async function quote(codeIn) {
    const p = plan(); let base = p.paise, discount = 0, coupon = null;
    const code = String(codeIn || '').trim().toUpperCase();
    if (code) {
      const c = await getCoupon(code);
      if (!c || c.off) return { error: 'That coupon code is not valid.' };
      if (c.until && c.until < now()) return { error: 'That coupon has expired.' };
      if (c.max && (+await kv.get('cpu:' + code) || 0) >= c.max) return { error: 'That coupon has been used up.' };
      discount = c.pct ? Math.floor(base * Math.min(100, c.pct) / 100) : Math.min(base, Math.round((c.flat || 0) * 100));
      coupon = code;
    }
    return { base, discount, amount: Math.max(0, base - discount), coupon, currency: 'INR' };
  }

  /* ---------- granting (idempotent) ---------- */
  async function applyPaid(order, paymentId, src) {
    if ((await kv.incr('og:' + order.id)) !== 1) { await kv.expire('og:' + order.id, 60); return { already: true }; }
    await kv.expire('og:' + order.id, 600);
    const u = await getUser(order.user); if (!u) return { error: 'account not found' };
    const p = plan(); u.pay = u.pay || [];
    if (!u.pay.some(x => x.id === order.id)) u.pay.push({ id: order.id, src, days: order.days, amount: order.amount, at: now(), status: 'paid', pid: paymentId || '' });
    recompute(u); await putUser(u);
    order.status = 'paid'; order.paymentId = paymentId || ''; order.paidAt = now(); await kv.set('o:' + order.id, JSON.stringify(order));
    if (paymentId) await kv.set('op:' + paymentId, order.id);
    if (order.coupon) await kv.incr('cpu:' + order.coupon);
    receipt(u, order, p).catch(() => { });
    return { granted: true, until: u.ent ? u.ent.until : 0 };
  }
  async function receipt(u, order, p) {
    const cfg = mailConfig(env); if (!cfg || !u.email) return;
    await mail({ ...cfg, to: u.email, subject: 'Your DS Quest receipt', text: `Hi ${u.display},\n\nThank you. Your payment was received and your access is active.\n\nItem: ${p.name}\nAmount paid: Rs ${rupees(order.amount)}${order.coupon ? ' (coupon ' + order.coupon + ')' : ''}\nOrder: ${order.id}${order.paymentId ? '\nPayment: ' + order.paymentId : ''}\nAccess: ${order.days ? order.days + ' days' : 'lifetime'}\n\nThis is a payment receipt, not a tax invoice. Questions or a refund request: just reply to this email.\n` });
  }
  const getOrder = async id => { const v = ORDER_ID.test(String(id)) && await kv.get('o:' + id); return v ? JSON.parse(v) : null; };

  /* Ask Razorpay itself. Returns the payment only when it is captured, belongs to this order and has the amount we stored. */
  async function confirmPayment(order, paymentId) {
    if (!PAY_ID.test(String(paymentId))) return null;
    let pay = await rzp('GET', '/payments/' + paymentId);
    if (pay.status === 'authorized') pay = await rzp('POST', '/payments/' + paymentId + '/capture', { amount: order.amount, currency: 'INR' });
    return pay.status === 'captured' && pay.order_id === order.id && pay.amount === order.amount && pay.currency === 'INR' ? pay : null;
  }

  /* ---------- the buyer's calls ---------- */
  async function createOrder(u, codeIn, agree) {
    if (!enabled) return { status: 503, json: { error: 'Payments are not switched on yet.' } };
    if (agree !== true) return { status: 400, json: { error: 'Please tick the box to accept the Terms and the Refund policy first.' } };
    const q = await quote(codeIn); if (q.error) return { status: 400, json: { error: q.error } };
    const p = plan(), id0 = 'order_free' + crypto.randomBytes(8).toString('hex');
    if (q.amount === 0) {
      const o = { id: id0, user: u.username.toLowerCase(), plan: p.id, days: p.days, amount: 0, base: q.base, coupon: q.coupon, status: 'created', created: now(), agreed: now() };
      await kv.set('o:' + o.id, JSON.stringify(o)); await kv.zadd('ol', now(), o.id);
      const r = await applyPaid(o, '', 'coupon'); return { status: 200, json: { free: true, granted: !!r.granted } };
    }
    if (q.amount < 100) return { status: 400, json: { error: 'This amount is below the payment minimum. Ask the owner.' } };
    let rz; try { rz = await rzp('POST', '/orders', { amount: q.amount, currency: 'INR', receipt: 'dsq_' + crypto.randomBytes(6).toString('hex'), notes: { user: u.username, plan: p.id, coupon: q.coupon || '' } }); } catch (e) { return { status: 502, json: { error: 'The payment provider did not answer (' + e.message + '). Nothing was charged. Try again.' } }; }
    if (!ORDER_ID.test(rz.id || '') || rz.amount !== q.amount) return { status: 502, json: { error: 'The payment provider returned an unexpected order. Nothing was charged.' } };
    const o = { id: rz.id, user: u.username.toLowerCase(), plan: p.id, days: p.days, amount: q.amount, base: q.base, coupon: q.coupon, status: 'created', created: now(), agreed: now() };
    await kv.set('o:' + o.id, JSON.stringify(o)); await kv.zadd('ol', now(), o.id);
    u.orders = (u.orders || []).concat(o.id).slice(-20); await putUser(u);
    return { status: 200, json: { orderId: o.id, amount: o.amount, currency: 'INR', keyId, name: 'DS Quest', description: p.name, prefill: { name: u.display || u.username, email: u.email || '' } } };
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
      try { const list = await rzp('GET', '/orders/' + id + '/payments'); for (const p of (list.items || [])) { const pay = await confirmPayment(order, p.id); if (pay) { const r = await applyPaid(order, p.id, 'razorpay'); granted = granted || !!r.granted; break; } } } catch (e) { }
    }
    return { status: 200, json: { ok: true, granted } };
  }
  const mine = u => ({ pay: (u.pay || []).map(p => ({ id: p.id, src: p.src, amount: p.amount, at: p.at, days: p.days, status: p.status })), ent: u.ent || null });

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
    return { config: config(), orders, coupons, revenuePaise: orders.filter(o => o.status === 'paid').reduce((n, o) => n + o.amount, 0) };
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
  return { config, quote, createOrder, verify, sync, mine, webhook, overview, grant, revoke, makeCoupon, dropCoupon, recompute, hmac };
}
module.exports = { createPay, hmac };
