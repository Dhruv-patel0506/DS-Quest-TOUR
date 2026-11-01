'use strict';
/* =====================================================================
   Paid access screens. #/buy: price, coupon, Razorpay checkout, "I already paid". #/payments: the owner's console (orders, grants, coupons).
   The browser never decides a price or grants access: it asks the server for an order, opens Razorpay's popup, and hands the result back for the server to confirm.
   ===================================================================== */
const inr = p => 'Rs ' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const dateOf = t => (t ? new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');
function loadCheckout() {
  return new Promise((res, rej) => {
    if (window.Razorpay) return res();
    const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = () => res(); s.onerror = () => rej(new Error('Could not load the payment window. Check your internet connection and try again.'));
    document.head.appendChild(s);
  });
}

function viewBuy() {
  const root = h('div', { class: 'stack' }), box = h('div', { class: 'stack' }); root.append(h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Account'), h('h1', {}, 'Full access'), h('p', { class: 'muted lead' }, 'Every module, every function sheet, every notebook. Works on your phone and offline once you have opened it.'))), box);
  (async () => {
    if (API.demo) { box.append(h('div', { class: 'card pad stack' }, h('h3', {}, 'You are on the guided tour'), h('p', {}, 'Create a free account to try the free modules, and buy full access from here whenever you like. Nothing can be bought inside the tour.'), h('button', { class: 'btn primary', type: 'button', onclick: () => DSQ.exitTour() }, 'Create my account'))); return; }
    let cfg; try { cfg = await API.get('/api/pay/config'); } catch (e) { cfg = { enabled: false }; }
    const me = S.me || {}, ent = me.ent, active = me.role === 'admin' || (ent && ent.all && (!ent.until || ent.until > Date.now()));
    const paidN = (DSQ.premium.ids || []).length, freeN = (DSQ.roadmap || []).length - paidN;
    if (active) box.append(h('div', { class: 'card pad stack' }, h('h3', {}, me.role === 'admin' ? 'You are the owner: everything is open for you' : 'Your access is active'), me.role === 'admin' ? null : h('p', {}, ent.until ? 'It runs until ' + dateOf(ent.until) + '.' : 'It never expires.'), h('a', { class: 'btn primary', href: '#/' }, 'Go to the curriculum')));
    if (!cfg.enabled) { box.append(h('div', { class: 'card pad' }, h('b', {}, 'Buying is not open yet. '), 'Payments are switched on by the owner. Check back soon' + (API.local ? ' (browser-only mode cannot take payments).' : '.'))); return; }
    const p = cfg.plan, state = { code: '', q: null }, msg = h('div', { class: 'muted', role: 'status' }), price = h('div', {}), code = h('input', { class: 'input', placeholder: 'Coupon code (optional)', 'aria-label': 'Coupon code', style: { maxWidth: '220px' } });
    const paint = () => { const q = state.q; price.innerHTML = ''; price.append(h('div', { style: { fontSize: '30px', fontWeight: 800 } }, inr(q ? q.amount : p.inr * 100)), ...(q && q.discount ? [h('div', { class: 'muted' }, 'Coupon ' + q.coupon + ' takes off ' + inr(q.discount) + '. List price ' + inr(q.base) + '.')] : []), h('div', { class: 'muted' }, p.days ? 'One payment, ' + p.days + ' days of access. No auto-renewal.' : 'One payment, access for life.')); };
    paint();
    const apply = h('button', { class: 'btn sm', type: 'button', onclick: async () => { const c = code.value.trim(); if (!c) { state.q = null; state.code = ''; msg.textContent = ''; paint(); return; } try { state.q = await API.post('/api/pay/quote', { code: c }); state.code = c; msg.textContent = 'Coupon applied.'; } catch (e) { state.q = null; state.code = ''; msg.textContent = e.message; } paint(); } }, 'Apply');
    const agree = h('input', { type: 'checkbox', id: 'agree' }), agreeRow = h('label', { class: 'row', style: { gap: '8px', fontSize: '13.5px', alignItems: 'flex-start' } }, agree, h('span', {}, 'I accept the ', h('a', { href: '#/legal/terms', target: '_blank' }, 'Terms'), ' and the ', h('a', { href: '#/legal/refund', target: '_blank' }, 'Refund policy' + (cfg.legal && cfg.legal.refundDays ? ' (' + cfg.legal.refundDays + ' days)' : '')), '. My payment is handled by Razorpay.')), pay = h('button', { class: 'btn primary', type: 'button' }, 'Pay securely'), already = h('button', { class: 'btn sm', type: 'button' }, 'I already paid, but I do not see my access');
    const done = granted => { box.innerHTML = ''; box.append(h('div', { class: 'card pad stack' }, h('h2', {}, granted ? 'Payment received. Welcome in.' : 'Payment received.'), h('p', {}, granted ? 'Your modules are unlocking now.' : 'Your payment is being confirmed. Refresh in a minute; if nothing changes use "I already paid".'), h('p', { class: 'muted' }, 'A receipt is e-mailed to you if mail is set up on this site.'))); setTimeout(() => location.assign('#/'), 1200); setTimeout(() => location.reload(), 1500); };
    pay.onclick = async () => {
      if (!agree.checked) { msg.textContent = 'Please tick the box to accept the Terms and the Refund policy.'; return; }
      pay.disabled = true; msg.textContent = 'Opening the payment window...';
      try {
        const o = await API.post('/api/pay/order', { code: state.code, agree: true });
        if (o.free) return done(o.granted);
        await loadCheckout();
        const rz = new window.Razorpay({ key: o.keyId, order_id: o.orderId, amount: o.amount, currency: o.currency, name: o.name, description: o.description, prefill: o.prefill, theme: { color: '#1f7a5a' },
          handler: async r => { msg.textContent = 'Confirming your payment...'; try { const v = await API.post('/api/pay/verify', r); done(v.granted || v.already); } catch (e) { msg.textContent = e.message; pay.disabled = false; } },
          modal: { ondismiss: () => { msg.textContent = 'Payment window closed. Nothing was charged unless you finished paying.'; pay.disabled = false; } } });
        rz.on('payment.failed', r => { msg.textContent = 'The payment did not go through: ' + ((r.error && r.error.description) || 'unknown reason') + '. You can try again.'; pay.disabled = false; });
        rz.open();
      } catch (e) { msg.textContent = e.message; pay.disabled = false; }
    };
    already.onclick = async () => { already.disabled = true; msg.textContent = 'Asking the payment provider...'; try { const r = await API.post('/api/pay/sync'); if (r.granted) return done(true); msg.textContent = 'No completed payment found for your recent attempts yet. If you were charged, wait a few minutes and try again, or contact the owner with your payment id.'; } catch (e) { msg.textContent = e.message; } already.disabled = false; };
    if (!active) box.append(h('div', { class: 'card pad stack' }, cfg.test ? h('div', { class: 'callout warn' }, h('b', {}, 'Test mode: '), 'no real money moves. Use the test card Razorpay shows in its window.') : null, h('h3', {}, p.name), price,
      h('ul', { class: 'syl' }, h('li', {}, freeN + ' free modules stay free for everyone'), h('li', {}, paidN + ' more modules with lessons, graded exercises, assessments and notebooks'), h('li', {}, 'Function sheets, projects and the practice arena'), h('li', {}, 'Use it on phone, tablet and laptop')),
      h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, code, apply), agreeRow, pay, msg, already,
      h('p', { class: 'muted', style: { fontSize: '12.5px' } }, 'Payments are handled by Razorpay (UPI, cards, net banking, wallets). We never see or store your card details. ' + (cfg.legal && cfg.legal.refundDays ? 'Not for you? Ask within ' + cfg.legal.refundDays + ' days and you get a full refund to your original payment method. ' : '') + 'Read the ', h('a', { href: '#/legal/privacy' }, 'Privacy policy'), '.')));
  })();
  return root;
}

function viewPayments() {
  const root = h('div', { class: 'stack' }), box = h('div', { class: 'stack' });
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Owner'), h('h1', {}, 'Payments'), h('p', { class: 'muted lead' }, 'Orders, who has access, coupons. Only you can see this page.'))), box);
  const field = (label, el) => h('label', { class: 'stack', style: { gap: '4px', fontSize: '13px' } }, label, el);
  async function load() {
    box.innerHTML = ''; let o; try { o = await API.get('/api/admin/pay'); } catch (e) { box.append(h('div', { class: 'card pad' }, e.message)); return; }
    const c = o.config, note = h('div', { class: 'muted', role: 'status' });
    const act = async (url, body, okMsg) => { try { await API.post(url, body); toast(okMsg); load(); } catch (e) { note.textContent = e.message; } };
    box.append(h('div', { class: 'card pad stack' }, h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, h('span', { class: 'chip ' + (c.enabled ? 'ok' : '') }, c.enabled ? (c.test ? 'Razorpay: TEST mode' : 'Razorpay: LIVE') : 'Razorpay: keys not set'), h('span', { class: 'chip ' + (c.webhook ? 'ok' : '') }, c.webhook ? 'Webhook secret set' : 'Webhook secret missing'), h('span', { class: 'chip' }, c.plan.name + ': Rs ' + c.plan.inr + (c.plan.days ? ' / ' + c.plan.days + ' days' : ' lifetime')), h('span', { class: 'chip ' + (c.legal.email ? 'ok' : '') }, c.legal.email ? 'Contact e-mail set' : 'Contact e-mail missing'), h('span', { class: 'chip ' + (c.legal.reviewed ? 'ok' : '') }, c.legal.reviewed ? 'Legal text reviewed' : 'Legal text still a draft'), h('a', { class: 'chip', href: '#/legal/terms' }, 'View legal pages'), h('span', { class: 'chip' }, 'Collected: ' + inr(o.revenuePaise))), note));
    const gu = h('input', { class: 'input', placeholder: 'username or email' }), gd = h('input', { class: 'input', type: 'number', min: 1, value: 30, style: { width: '90px' } }), gl = h('input', { type: 'checkbox' }), gn = h('input', { class: 'input', placeholder: 'note (optional)' });
    box.append(h('div', { class: 'card pad stack' }, h('h3', {}, 'Give or remove access by hand'), h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', alignItems: 'end' } }, field('Account', gu), field('Days', gd), field('Lifetime', gl), field('Note', gn),
      h('button', { class: 'btn primary', type: 'button', onclick: () => act('/api/admin/grant', { username: gu.value, days: +gd.value, lifetime: gl.checked, note: gn.value }, 'Access granted') }, 'Grant'),
      h('button', { class: 'btn', type: 'button', onclick: () => { if (gu.value && confirm('Remove all access for ' + gu.value + '?')) act('/api/admin/revoke', { username: gu.value }, 'Access removed'); } }, 'Remove all access'))));
    const cc = h('input', { class: 'input', placeholder: 'CODE', style: { width: '130px' } }), cp = h('input', { class: 'input', type: 'number', placeholder: '% off', style: { width: '90px' } }), cf = h('input', { class: 'input', type: 'number', placeholder: 'or Rs off', style: { width: '100px' } }), cm = h('input', { class: 'input', type: 'number', placeholder: 'max uses', style: { width: '100px' } }), cu = h('input', { class: 'input', type: 'date' });
    box.append(h('div', { class: 'card pad stack' }, h('h3', {}, 'Coupons'), h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', alignItems: 'end' } }, field('Code', cc), field('Percent', cp), field('Flat (Rs)', cf), field('Max uses', cm), field('Ends', cu), h('button', { class: 'btn primary', type: 'button', onclick: () => act('/api/admin/coupon', { code: cc.value, pct: +cp.value, flat: +cf.value, max: +cm.value, until: cu.value || '' }, 'Coupon saved') }, 'Create')),
      o.coupons.length ? h('table', { class: 't' }, h('thead', {}, h('tr', {}, ['Code', 'Off', 'Used', 'Ends', ''].map(x => h('th', {}, x)))), h('tbody', {}, o.coupons.map(k => h('tr', {}, h('td', {}, h('code', {}, k.code)), h('td', {}, k.pct ? k.pct + '%' : 'Rs ' + k.flat), h('td', {}, k.used + (k.max ? ' / ' + k.max : '')), h('td', {}, k.off ? 'disabled' : (k.until ? dateOf(k.until) : 'never')), h('td', {}, k.off ? '' : h('button', { class: 'btn sm', type: 'button', onclick: () => act('/api/admin/coupon/delete', { code: k.code }, 'Coupon disabled') }, 'Disable')))))) : h('p', { class: 'muted' }, 'No coupons yet.')));
    box.append(h('div', { class: 'card pad stack' }, h('h3', {}, 'Recent orders'), o.orders.length ? h('div', { style: { overflowX: 'auto' } }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, ['When', 'Account', 'Amount', 'Coupon', 'Status', 'Payment'].map(x => h('th', {}, x)))), h('tbody', {}, o.orders.map(r => h('tr', {}, h('td', {}, dateOf(r.created)), h('td', {}, r.user), h('td', {}, inr(r.amount)), h('td', {}, r.coupon || ''), h('td', {}, r.status + (r.refunded ? ' (refunded ' + inr(r.refunded) + ')' : '')), h('td', {}, h('code', {}, r.paymentId || '')))))))  : h('p', { class: 'muted' }, 'No orders yet.')));
  }
  load(); return root;
}
