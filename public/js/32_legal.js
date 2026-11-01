'use strict';
/* =====================================================================
   Terms, Refund policy, Privacy (#/legal/terms | refund | privacy). Readable without an account (the boot code shows them before sign-in).
   DRAFT TEXT: written in plain language for a small online course sold from India; it is not legal advice. The owner's details come from the
   server settings (DSQ_BUSINESS_NAME, DSQ_CONTACT_EMAIL, DSQ_BUSINESS_ADDRESS, DSQ_REFUND_DAYS, DSQ_JURISDICTION); a missing one shows as a visible
   "[owner: set ...]" marker, and the "draft" banner stays until DSQ_LEGAL_REVIEWED=yes.
   ===================================================================== */
const LEGAL_TITLES = { terms: 'Terms of use', refund: 'Refund policy', privacy: 'Privacy policy' };
const LEGAL_UPDATED = '1 November 2026';

function legalDocs(L, plan) {
  const biz = L.business || 'DS Quest', mail = L.email || '[owner: set DSQ_CONTACT_EMAIL]', law = L.law || '[owner: set DSQ_JURISDICTION, for example "the courts of Ahmedabad, India"]';
  const days = L.refundDays, access = plan && plan.days ? plan.days + ' days' : 'the period shown at checkout', price = plan ? 'Rs ' + plan.inr : 'the price shown at checkout';
  return {
    terms: [
      ['Who we are', `DS Quest is an online course and practice site run by ${biz}${L.address ? ', ' + L.address : ''}. You can reach us at ${mail}. By creating an account or buying access you agree to these terms.`],
      ['Your account', 'You need an account to save progress and to buy access. Give a real e-mail address (it is how you reset a forgotten password), keep your password private, and tell us if you think someone else is using your account. You are responsible for what happens under your account. One account is for one person.'],
      ['Free and paid parts', `Some modules are free for everyone. The rest, with their lessons, exercises, assessments, function sheets and notebooks, are part of paid access. Paid access costs ${price} as one payment and lasts ${access} from the day you pay, unless we agreed something else with you in writing. It does not renew by itself. If you buy again while you still have access, the new period is added to the end of the old one.`],
      ['What you may do', 'You may use the course for your own learning, on your own devices, including offline copies the app saves for you. You may share your own finished projects, screenshots of your own work and what you learned.'],
      ['What you may not do', 'Do not share your login or give others access; copy, resell, publish, scrape or mass-download the lessons, solutions, notebooks or function sheets; take the content apart to rebuild a competing course; try to get around the paid-access checks; or use the site in a way that harms it or other people. If you do, we may close your account, and a closed account for this reason is not refunded.'],
      ['Payment', 'Payments are taken by Razorpay (UPI, cards, net banking, wallets). We never see or store your card or bank details. The price is set on our server at the time you pay; the amount you see in the payment window is the amount you are charged. Your access starts when Razorpay confirms the payment, normally within seconds. If you paid and do not see access, use "I already paid" on the Full access page, or write to us with your payment id.'],
      ['Refunds', `Refunds follow the Refund policy page. In short: ${days ? 'ask within ' + days + ' days of paying' : 'see the policy'}.`],
      ['Content and ownership', `All lessons, code, notebooks, exercises, images and the app itself belong to ${biz} or its licensors. Buying access gives you a personal, non-transferable licence to use them as described above; it does not transfer ownership. The code you write yourself in the exercises and projects is yours.`],
      ['No promises about results', 'We work hard to make the material correct and clear, but we cannot promise any job, income, grade or outcome. Code examples are for learning, run in your browser and are provided as they are. Computers, browsers and networks differ, so an example may behave differently on your device. Free tiers of outside services (such as the AI tutor) can change or stop.'],
      ['Availability and changes', 'We may update, add or remove lessons and features, and the site may be unavailable at times. If we remove a paid part for good during your paid period, we will give you a fair remedy, which may be a replacement, an extension or a partial refund. We may change these terms; the date at the top says when they last changed, and material changes will be shown in the app. Continuing to use the site after a change means you accept it.'],
      ['Limits of our responsibility', 'To the extent the law allows, we are not liable for indirect or consequential loss, lost profit or lost data, and our total liability for anything connected with the course is limited to the amount you paid us in the 12 months before the problem. Nothing here limits rights you have under law that cannot be limited.'],
      ['Ending your account', 'You can stop using the site at any time and ask us to delete your account (see the Privacy policy). We may suspend or close an account that breaks these terms. Closing an account for a breach ends paid access without a refund; closing it for any other reason on our side comes with a fair refund for the unused period.'],
      ['Governing law', `These terms are governed by the laws of India. Disputes go to ${law}. Please write to us first at ${mail}; most problems are solved that way.`],
    ],
    refund: [
      ['The short version', days ? `If paid access is not right for you, ask for your money back within ${days} days of paying and you get a full refund. No long forms and no arguments.` : 'Please read the details below.'],
      ['How to ask', `Write to ${mail} from the e-mail address on your account. Give your username and, if you can, the order or payment id from your receipt (it is also on the Full access page). We reply within 3 working days.`],
      ['How the money comes back', 'We refund to the same payment method you used, through Razorpay. Your bank usually shows it in 5 to 7 working days; UPI is often faster. We cannot send a refund to a different account or method.'],
      ['What happens to your access', 'When a full refund is made, paid access ends at once and paid parts lock again. Free modules and your progress stay. If you bought with a coupon, you get back what you actually paid.'],
      ['After the refund period', days ? `After ${days} days we do not refund, except for: being charged twice for the same purchase, being charged but never getting access, or a fault on our side that we cannot fix within a reasonable time. In those cases write to us and we put it right.` : 'Refunds outside the window are decided case by case.'],
      ['Not refundable', 'Accounts closed for breaking the Terms (for example sharing access or mass-downloading the content). Partial refunds for time already used are not given inside the refund period because it is a full refund, and not after it for the reasons above.'],
      ['Chargebacks', `If something is wrong with a payment, please write to us before asking your bank to reverse it; we can usually fix it faster. We may suspend access on a payment that is reversed through your bank.`],
    ],
    privacy: [
      ['The short version', 'We keep what is needed to run your account and to take payments, we do not sell your data, and you can ask us for a copy or for deletion at any time.'],
      ['What we collect', 'When you sign up: your username, display name, e-mail address and a scrambled (hashed) password; we never store the password itself. While you learn: your progress, scores, notes and the projects you save or publish. If you choose to: a GitHub or Vercel token for publishing your projects, which we store encrypted and use only for that. When you pay: the order id, payment id, amount, coupon used and date. Card, UPI and bank details go to Razorpay and never touch our servers.'],
      ['Why we use it', 'To let you sign in and keep your progress; to unlock what you paid for; to send you password-reset links and receipts; to stop abuse and fraud; and to keep the service running and fix faults. We do not use your data for advertising and we do not sell it.'],
      ['Who else sees it', 'Only the services we need to run the site: Vercel (hosting), Upstash (database), Razorpay (payments), and an e-mail provider for resets and receipts. If the AI tutor is switched on, the question you type and the lesson text around it are sent to the AI provider (Google Gemini) to get an answer; do not type personal secrets into it. The leaderboard shows only your display name and score. Published projects are public pages you chose to publish. We may share information if the law requires it.'],
      ['Cookies and your browser', 'We set one sign-in cookie so you stay logged in. Your browser also keeps your settings, your own offline copy of the lessons and, in offline mode, your progress, on your device. We use no advertising or tracking cookies.'],
      ['How long we keep it', 'Account data stays while your account exists. Payment records are kept as long as accounting and tax rules require, even if you delete your account. Backups are overwritten in the normal course.'],
      ['Your choices', `You can ask us to show you what we hold, correct it, or delete your account and progress, by writing to ${mail} from your account e-mail. You can also change your display name, e-mail and tokens in the app. We answer within 30 days. Where India's Digital Personal Data Protection Act 2023 or another law gives you more rights, those apply too.`],
      ['Security', 'Passwords are hashed, saved tokens are encrypted, paid lesson files are not publicly reachable, and sign-in attempts are rate limited. No system is perfectly safe; if something affecting your data goes wrong we will tell you.'],
      ['Children', 'DS Quest is for people aged 18 and over, or younger learners using it with a parent or guardian who agrees to these policies.'],
      ['Changes and contact', `We may update this policy; the date at the top says when. Questions: ${mail}${L.address ? ' or by post at ' + L.address : ''}.`],
    ],
  };
}

function viewLegal(which, cfg) {
  const L = (cfg && cfg.legal) || { business: 'DS Quest', refundDays: 7 }, plan = cfg && cfg.plan, docs = legalDocs(L, plan), key = docs[which] ? which : 'terms';
  const root = h('div', { class: 'stack legal', style: { maxWidth: '760px' } });
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Legal'), h('h1', {}, LEGAL_TITLES[key]), h('p', { class: 'muted' }, 'Last updated ' + LEGAL_UPDATED + '.'))),
    h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, Object.keys(LEGAL_TITLES).map(k => h('a', { class: 'chip' + (k === key ? ' ok' : ''), href: '#/legal/' + k }, LEGAL_TITLES[k]))));
  if (!L.reviewed) root.append(h('div', { class: 'callout warn' }, h('b', {}, 'Draft. '), 'This text has not been reviewed by a lawyer yet and may change before it is final.'));
  for (const [t, body] of docs[key]) root.append(h('section', { class: 'card pad stack' }, h('h3', { style: { margin: 0 } }, t), h('p', { style: { margin: 0, lineHeight: 1.65 } }, body)));
  return root;
}
async function legalCfg() { try { return await API.get('/api/pay/config'); } catch (e) { return null; } }
/* before sign-in: a plain page with a way back */
async function showLegalPublic(which) {
  const cfg = await legalCfg(); App.root.innerHTML = '';
  App.root.append(h('div', { style: { padding: '18px 16px', maxWidth: '800px', margin: '0 auto' } }, h('a', { href: '#', style: { fontWeight: 700, textDecoration: 'none' }, onclick: e => { e.preventDefault(); location.hash = ''; showAuth(); } }, '← Back to sign in'), viewLegal(which, cfg)));
  window.scrollTo(0, 0);
}
async function legalPage(main, which) { main.append(h('div', { class: 'muted' }, 'Loading...')); const cfg = await legalCfg(); main.innerHTML = ''; main.append(viewLegal(which, cfg)); }
