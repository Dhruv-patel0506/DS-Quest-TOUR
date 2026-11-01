'use strict';
/* =====================================================================
   Dataset generators. Each takes (rng, tier) and returns CSV text.
   The rng is seeded from the learner's username, so every learner gets different numbers
   with the same structure. tier 'flagship' (owner account) gets bigger / richer data.
   Generated data is synthetic and says so in the project text; real public datasets are
   suggested as "go deeper" references.
   ===================================================================== */
const DS = {};
const f2 = x => (+x).toFixed(2);
const isoDate = (base, add) => { const d = new Date(Date.UTC(base[0], base[1] - 1, base[2]) + add * 864e5); return d.toISOString().slice(0, 10); };
const pick = (r, arr, w) => { if (!w) return r.pick(arr); const t = sum(w); let u = r() * t; for (let i = 0; i < arr.length; i++) { u -= w[i]; if (u <= 0) return arr[i]; } return arr[arr.length - 1]; };

/* ---- NumPy project 1: wearable heart-rate signal (t, signal) ---- */
DS.sensor = (r, tier) => {
  const hz = 50, secs = tier === 'flagship' ? 120 : 60, n = hz * secs, bpm = r.int(58, 92), period = 60 / bpm, beats = [];
  for (let t = 0.4 + r() * 0.3; t < secs; t += period * (1 + (r() - .5) * .08)) beats.push(t);
  const rows = ['t,signal'];
  for (let i = 0; i < n; i++) {
    const t = i / hz; let v = .2 * Math.sin(2 * Math.PI * .2 * t) + r.norm(0, .05);
    for (const b of beats) { const d = t - b; if (Math.abs(d) < .4) v += 1.0 * Math.exp(-(d * d) / (2 * .04 * .04)) + .25 * Math.exp(-((d - .25) ** 2) / (2 * .06 * .06)); }
    if (tier === 'flagship' && t > 40 && t < 43) v += r.norm(0, .5);       // motion-artifact burst
    rows.push(t.toFixed(2) + ',' + v.toFixed(4));
  }
  return rows.join('\n');
};

/* ---- NumPy project 2: grayscale photo as a pixel matrix (no header) ---- */
DS.photo = (r, tier) => {
  const N = tier === 'flagship' ? 96 : 64, cx = r.int(N * .3, N * .7), cy = r.int(N * .3, N * .7), rad = r.int(N * .14, N * .24), rx = r.int(2, N * .2), ry = r.int(2, N * .2), rw = r.int(N * .15, N * .3), rh = r.int(N * .1, N * .25);
  const rows = [];
  for (let y = 0; y < N; y++) {
    const row = [];
    for (let x = 0; x < N; x++) {
      let v = 40 + (x / N) * 70 + (y / N) * 30;
      if ((x - cx) ** 2 + (y - cy) ** 2 < rad * rad) v = 215;
      if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) v = 20;
      v += r.norm(0, 6); row.push(clamp(Math.round(v), 0, 255));
    }
    rows.push(row.join(','));
  }
  return rows.join('\n');
};

/* ---- NumPy project 3: cricket / match-day analytics (long format) ---- */
DS.cricket = (r, tier) => {
  const P = tier === 'flagship' ? 14 : 11, M = tier === 'flagship' ? 24 : 16, rows = ['player_id,match_no,runs,balls'];
  for (let p = 1; p <= P; p++) {
    const skill = 18 + r() * 40, sr = .7 + r() * .9, form = (r() - .5) * 1.2;
    for (let m = 1; m <= M; m++) {
      const balls = Math.max(1, Math.round(r.exp(1 / (14 + skill * .35)) + 2)), mood = 1 + form * (m / M - .5);
      const runs = Math.max(0, Math.round(balls * sr * mood * (.5 + r() * .9)));
      rows.push(`${p},${m},${runs},${balls}`);
    }
  }
  return rows.join('\n');
};

/* ---- pandas / matplotlib project 1: city bike-share trips (messy on purpose) ---- */
DS.bikes = (r, tier) => {
  const n = tier === 'flagship' ? 4000 : 1500, stations = ['Kothrud', 'Baner', 'Hinjewadi', 'Camp', 'Viman Nagar', 'Hadapsar'], rows = ['trip_id,start_date,start_hour,station,user_type,distance_km,duration_min,fare,rating'];
  const sw = [1.2, 1, 1.3, .8, .9, .7];
  for (let i = 1; i <= n; i++) {
    const d = r.int(0, 89), date = isoDate([2026, 1, 1], d), dow = new Date(date).getUTCDay(), wk = dow === 0 || dow === 6;
    const hour = wk ? r.int(8, 20) : pick(r, [7, 8, 9, 10, 12, 14, 17, 18, 19, 21], [3, 4, 2, 1, 1, 1, 3, 4, 2, 1]);
    let st = pick(r, stations, sw), ut = r() < (wk ? .5 : .3) ? 'casual' : 'member', dist = Math.max(.3, r.norm(wk ? 4.5 : 3.2, 1.6)), dur = Math.max(2, dist * (4.2 + r() * 2.5) + r.norm(0, 2));
    let fare = ut === 'member' ? Math.max(0, dur * 0.9 - 8) : 15 + dur * 1.6; if (r() < .02) dur = ''; else dur = f2(dur);
    let rating = r() < .22 ? '' : String(clamp(Math.round(4.4 - dist * .08 + r.norm(0, .9)), 1, 5));
    if (r() < .04) st = r.pick([st.toUpperCase(), st.toLowerCase(), ' ' + st + ' ']);
    rows.push([i, date, hour, st, ut, f2(dist), dur, f2(fare), rating].join(','));
    if (r() < .01) rows.push(rows[rows.length - 1]);        // duplicate row
  }
  return rows.join('\n');
};

/* ---- pandas / matplotlib project 2: online store orders ---- */
DS.orders = (r, tier) => {
  const n = tier === 'flagship' ? 4500 : 1600, cats = { Electronics: [[1500, 9000], ['Earbuds', 'Phone case', 'Power bank', 'Smart watch', 'Keyboard']], Home: [[200, 3000], ['Lamp', 'Cushion', 'Kettle', 'Organiser']], Books: [[150, 900], ['Novel', 'Textbook', 'Comic', 'Cookbook']], Fashion: [[400, 3500], ['T-shirt', 'Jeans', 'Sneakers', 'Jacket']], Beauty: [[200, 1800], ['Serum', 'Shampoo', 'Perfume']] };
  const cn = Object.keys(cats), cities = ['Pune', 'Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Kolkata'], pays = ['UPI', 'Card', 'COD', 'Wallet'], rows = ['order_id,customer_id,order_date,category,product,qty,unit_price,discount_pct,city,payment,returned'];
  for (let i = 1; i <= n; i++) {
    const cat = pick(r, cn, [2, 2, 1.4, 2.2, 1.2]), [lo, hi] = cats[cat][0], d = r.int(0, 179), month = new Date(isoDate([2026, 1, 1], d)).getUTCMonth();
    const boost = (month === 2 || month === 4) ? 1.25 : 1, price = Math.round((lo + r() * (hi - lo)) / 10) * 10;
    const disc = r() < .45 ? r.pick([5, 10, 15, 20, 30]) : 0, pay = pick(r, pays, [4, 2.5, 2, 1.2]);
    const ret = r() < (cat === 'Fashion' ? .16 : cat === 'Electronics' ? .07 : .04) ? 'yes' : 'no';
    rows.push([i, r.int(1, Math.round(n / 3)), isoDate([2026, 1, 1], d), cat, r.pick(cats[cat][1]), Math.max(1, Math.round(r.exp(.9) * boost)), price, disc, pick(r, cities, [2, 2.5, 2.5, 2.2, 1.2, 1]), pay, ret].join(','));
  }
  return rows.join('\n');
};

/* ---- pandas / matplotlib project 3: hospital outpatient visits ---- */
DS.opd = (r, tier) => {
  const n = tier === 'flagship' ? 3500 : 1300, deps = ['General', 'Cardiology', 'Orthopaedics', 'Paediatrics', 'ENT', 'Dermatology'], rows = ['visit_id,visit_date,department,age,gender,wait_min,consult_min,cost,insured,follow_up'];
  for (let i = 1; i <= n; i++) {
    const dep = pick(r, deps, [4, 1.6, 1.8, 2.2, 1.2, 1.4]), d = r.int(0, 119), dow = new Date(isoDate([2026, 1, 1], d)).getUTCDay();
    const age = dep === 'Paediatrics' ? r.int(0, 14) : Math.round(clamp(r.norm(dep === 'Cardiology' ? 58 : 38, 17), 1, 92));
    const busy = dow === 1 ? 1.4 : dow === 0 ? .6 : 1, wait = Math.max(2, Math.round(r.exp(1 / (18 * busy * (dep === 'General' ? 1.3 : 1)))));
    const consult = Math.max(4, Math.round(r.norm(dep === 'Cardiology' ? 22 : 12, 4))), base = { General: 400, Cardiology: 1400, Orthopaedics: 1000, Paediatrics: 500, ENT: 600, Dermatology: 700 }[dep];
    const ins = r() < .55 ? 'yes' : 'no', cost = Math.round(base * (.8 + r() * .6) / 10) * 10, fu = r() < (dep === 'Cardiology' ? .5 : .25) ? 'yes' : 'no';
    rows.push([i, isoDate([2026, 1, 1], d), dep, age, r() < .5 ? 'F' : 'M', wait, consult, cost, ins, fu].join(','));
  }
  return rows.join('\n');
};

/* ---- ML: house prices (regression) ---- */
DS.houses = (r, tier) => {
  const n = tier === 'flagship' ? 900 : 420, rows = ['sqft,bedrooms,age_years,distance_km,price_lakh'], k = 0.04 + r() * 0.015;
  for (let i = 0; i < n; i++) {
    const sqft = Math.round(r.norm(1150, 380) / 10) * 10, bed = clamp(Math.round(sqft / 450 + r.norm(0, .6)), 1, 5), age = r.int(0, 35), dist = +(r() * 18 + 1).toFixed(1);
    const price = 8 + sqft * k + bed * 2.5 - age * .32 - dist * 1.6 + (sqft > 1500 ? (sqft - 1500) * .012 : 0) + r.norm(0, 4);
    rows.push([Math.max(350, sqft), bed, age, dist, price.toFixed(1)].join(','));
  }
  return rows.join('\n');
};
/* ---- ML: telecom churn (classification) ---- */
DS.churn = (r, tier) => {
  const n = tier === 'flagship' ? 1200 : 600, rows = ['tenure_months,monthly_spend,support_calls,plan,churned'], plans = ['basic', 'standard', 'premium'], pe = { basic: .5, standard: 0, premium: -.6 };
  for (let i = 0; i < n; i++) {
    const ten = r.int(1, 72), pl = r.pick(plans), sp = Math.max(10, Math.round(r.norm(pl === 'basic' ? 35 : pl === 'standard' ? 60 : 95, 12))), sc = Math.min(8, Math.round(r.exp(.7)));
    const z = -.6 + .55 * sc - .045 * ten + .012 * (sp - 55) + pe[pl] + r.norm(0, .5), p = 1 / (1 + Math.exp(-z));
    rows.push([ten, sp, sc, pl, r() < p ? 1 : 0].join(','));
  }
  return rows.join('\n');
};
/* ---- DL: machine faults on a ring (needs a non-linear model) ---- */
DS.faults = (r, tier) => {
  const n = tier === 'flagship' ? 700 : 360, rows = ['vibration,temperature,fault'], rad = 1.0 + r() * .4;
  for (let i = 0; i < n; i++) { const x = r() * 4 - 2, y = r() * 4 - 2, d = Math.hypot(x - .2, y + .1); rows.push([x.toFixed(3), y.toFixed(3), (d > rad ? 1 : 0)].join(',')); }
  return rows.join('\n');
};
/* ---- RAG: a company's FAQ documents plus test questions (kind = doc | question) ---- */
DS.faq = (r, tier) => {
  const v = { d: r.pick([7, 10, 14, 15, 30]), dd: r.pick([3, 5, 7]), s1: r.int(2, 3), s2: r.int(4, 7), th: r.pick([499, 799, 999, 1499]), fee: r.pick([49, 59, 79, 99]), w: r.pick([6, 12, 18, 24]), cod: r.pick([3000, 5000, 8000]), cf: r.pick([20, 30, 40]), ina: r.pick([12, 18, 24]), pts: r.pick([1, 2, 5]), red: r.pick([4, 5, 10]), cx: r.pick([2, 4, 6, 12]), end: r.pick([6, 8, 9]), sla: r.pick([12, 24, 48]) };
  const docs = [
    ['refund', 'Refund and returns policy', `You can return an item within ${v.d} days of delivery for a full refund to the original payment method. Digital items are refundable within ${v.dd} days if they have not been downloaded.`, 'how many days do I have to send a product back and get my money returned'],
    ['shipping', 'Shipping and delivery', `Standard delivery takes ${v.s1} to ${v.s2} business days. Orders above ${v.th} rupees ship free; below that the delivery fee is ${v.fee} rupees.`, 'what is the delivery charge and how long does shipping take'],
    ['warranty', 'Warranty for electronics', `Electronics carry a ${v.w} month warranty that covers manufacturing defects but not accidental damage or water damage.`, 'is a broken phone screen covered under warranty and for how many months'],
    ['payments', 'Payment methods', `We accept UPI and cards and wallets. Cash on delivery is available up to ${v.cod} rupees and adds a ${v.cf} rupee handling fee.`, 'can I pay cash when the parcel arrives and is there an extra fee'],
    ['account', 'Account and password', `Reset your password from the login page using the link we email you. Accounts stay active for ${v.ina} months without a login before they are archived.`, 'I forgot my login password how do I get back into my account'],
    ['loyalty', 'Loyalty points', `Earn ${v.pts} points for every 100 rupees spent. ${v.red} points are worth 1 rupee off your next order.`, 'how do reward points work and what are they worth'],
    ['cancel', 'Order cancellation', `Orders can be cancelled free of charge until they are packed which usually happens within ${v.cx} hours of ordering.`, 'until when can I cancel an order I just placed'],
    ['support', 'Customer support hours', `Our team answers chat from 9am to ${v.end}pm every day and replies to email within ${v.sla} hours.`, 'when can I talk to someone at support and how fast do they answer email'],
  ];
  if (tier === 'flagship') docs.push(['gift', 'Gift cards', `Gift cards never expire; they can be used on any category and cannot be exchanged for cash.`, 'do gift vouchers expire or can I turn them into cash'], ['bulk', 'Bulk orders', `Orders of more than ${r.pick([20, 50])} units qualify for a business discount; contact sales for a quote.`, 'I want to buy a large quantity for my company is there a discount'], ['intl', 'International shipping', `We ship to ${r.int(12, 40)} countries; customs duties are paid by the buyer and delivery takes ${r.int(8, 15)} business days.`, 'do you deliver abroad and who pays the customs duty'], ['privacy', 'Privacy and data', `We keep order history for ${r.pick([3, 5, 7])} years and you can ask us to delete your personal data at any time.`, 'how long do you store my personal information and can I have it removed']);
  const rows = ['id,kind,title,text']; docs.forEach(d => rows.push([d[0], 'doc', d[1], d[2]].join(',')));
  r.shuffle(docs).forEach((d, i) => rows.push(['q' + (i + 1), 'question', d[0], d[3]].join(',')));
  return rows.join('\n');
};
/* ---- Agents: an order desk the agent can query with tools ---- */
DS.agentorders = (r, tier) => {
  const n = tier === 'flagship' ? 90 : 45, items = ['earbuds', 'kettle', 'novel', 'sneakers', 'lamp', 'backpack', 'router', 'blender'], rows = ['order_id,item,price,status,days_since_order'];
  for (let i = 0; i < n; i++) rows.push([1001 + i, r.pick(items), r.int(3, 90) * 50, pick(r, ['packed', 'shipped', 'delivered', 'cancelled'], [1, 2, 4, .6]), r.int(0, 40)].join(','));
  return rows.join('\n');
};

/* ---- EDA: a deliberately messy customer table (text prices, mixed dates, duplicates, impossible ages, outliers, redundant column) ---- */
DS.messy = (r, tier) => {
  const n = tier === 'flagship' ? 700 : 300, cities = ['Pune', 'Delhi', 'Mumbai', 'Chennai', 'Kolkata', 'Jaipur'], rows = ['customer_id,age,city,income,income_k,signup,score'];
  const out = [];
  for (let i = 1; i <= n; i++) {
    let age = r.int(19, 62), inc = Math.round((22000 + r() * 60000) / 500) * 500, sc = Math.round(clamp(50 + (inc - 50000) / 2500 + r.norm(0, 9), 20, 100)), city = r.pick(cities), m = r.int(1, 9), d = r.int(10, 28);
    const rr = r(); let incS = String(inc), k = (inc / 1000).toFixed(1), date = `2026-0${m}-${d}`;
    if (rr < .035) { age = ''; } else if (rr < .05) age = r.pick([-3, 187, 0, 240]);
    if (r() < .04) { inc = r.int(400, 900) * 1000; incS = String(inc); k = (inc / 1000).toFixed(1); }
    if (r() < .5) incS = inc.toLocaleString('en-US'); if (r() < .03) { incS = 'n/a'; k = ''; }
    if (r() < .06) city = r.pick([city.toUpperCase(), ' ' + city, city.toLowerCase(), city + ' ']);
    if (r() < .1) date = `${d}/0${m}/2026`; if (r() < .03) sc = '';
    out.push([i, age, city, incS.includes(',') ? '"' + incS + '"' : incS, k, date, sc].join(','));
    if (r() < .02) out.push(out[out.length - 1]);
  }
  return rows.concat(out).join('\n');
};
