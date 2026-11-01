'use strict';
/* =====================================================================
   Cleaning Lab - the heart of data science, shown four ways at once:
     the CSV table (changed cells and removed rows flash)  |  the chart (before vs after, 2-D histogram or 3-D scatter)
     the pandas code (grows with every step)               |  the notes (what, why, and what it did to the numbers)
   - every messy dataset is generated randomly at four levels (easy -> complex), so no two practice rounds are the same
   - click operations in ANY order and see why order matters; "Run my code" executes the same code in real Python and checks it matches
   - Challenge: make the data analysis-ready; the checker verifies the invariants (no duplicates, no missing, consistent text, numeric, no outliers)
   - CL.* is also used by the random data-question generator (Drills -> Data practice)
   ===================================================================== */
const CL = {};
const CITIES = ['Pune', 'Delhi', 'Mumbai', 'Chennai', 'Kolkata', 'Jaipur'];
const isNum = v => typeof v === 'number' && Number.isFinite(v);
CL.q = (arr, p) => { const s = arr.slice().sort((a, b) => a - b), k = (s.length - 1) * p, i = Math.floor(k), f = k - i; return i + 1 < s.length ? s[i] + (s[i + 1] - s[i]) * f : s[i]; };
CL.med = a => CL.q(a, .5);
CL.gen = (seed, level) => {
  const r = RNG(seed * 7919 + level * 131 + 3), n = 18 + level * 2, rows = [];
  for (let i = 0; i < n; i++) rows.push({ id: i + 1, age: r.int(19, 58), city: r.pick(CITIES), income: Math.round((22000 + r() * 60000) / 500) * 500, signup: `2026-0${r.int(1, 9)}-${String(r.int(10, 28))}`, score: r.int(42, 99) });
  const spots = (k) => r.shuffle(rows.map((_, i) => i)).slice(0, k);
  if (level >= 1) { spots(3).forEach(i => { rows[i].age = null; }); spots(2).forEach(i => { rows[i].income = null; }); }
  if (level >= 2) { spots(5).forEach(i => { const c = rows[i].city; rows[i].city = r.pick([c.toUpperCase(), ' ' + c, c.toLowerCase(), c + ' ']); }); spots(2).forEach(i => rows.push(Object.assign({}, rows[i]))); }
  if (level >= 3) { spots(2).forEach(i => { if (isNum(rows[i].income)) rows[i].income *= 9; else rows[i].income = 400000; }); const w = spots(2); rows[w[0]].age = -3; rows[w[1]].age = 187; }
  if (level >= 4) { rows.forEach(x => { if (isNum(x.income)) x.income = x.income.toLocaleString('en-US'); }); rows[spots(1)[0]].income = 'n/a'; spots(2).forEach(i => { rows[i].score = null; }); spots(3).forEach(i => { const [y, m, d] = rows[i].signup.split('-'); rows[i].signup = `${d}/${m}/${y}`; }); }
  rows.forEach((x, i) => { x._k = i; });
  return rows;
};
const keyOf = x => JSON.stringify([x.age, x.city, x.income, x.signup, x.score, x.id]);
const titleCase = s => String(s).trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const clone = rows => rows.map(x => Object.assign({}, x));
CL.OPS = {
  numeric: { t: 'Make income a number', cols: ['income'], rel: R => R.some(x => !isNum(x.income) && x.income != null), run(R) { const ch = []; R.forEach((x, i) => { if (!isNum(x.income) && x.income != null) { const v = parseFloat(String(x.income).replace(/,/g, '')); x.income = Number.isFinite(v) ? v : null; ch.push(i + ':income'); } }); return { R, ch }; }, code: "df['income'] = pd.to_numeric(df['income'].astype(str).str.replace(',', ''), errors='coerce')", why: 'Numbers stored as text ("45,000") cannot be averaged or compared. to_numeric converts them; errors="coerce" turns junk like "n/a" into a proper missing value (NaN) instead of crashing.' },
  dates: { t: 'Parse the signup dates', cols: ['signup'], rel: R => R.some(x => /\//.test(String(x.signup))), run(R) { const ch = []; R.forEach((x, i) => { if (/\//.test(String(x.signup))) { const [d, m, y] = x.signup.split('/'); x.signup = `${y}-${m}-${d}`; ch.push(i + ':signup'); } }); return { R, ch }; }, code: "df['signup'] = pd.to_datetime(df['signup'], format='mixed', dayfirst=True)", why: 'Two different date styles in one column break sorting and month arithmetic. to_datetime reads both into one real date type (dayfirst because 04/03 means 4 March here).' },
  texts: { t: 'Tidy the city names', cols: ['city'], rel: R => R.some(x => x.city !== titleCase(x.city)), run(R) { const ch = []; R.forEach((x, i) => { const v = titleCase(x.city); if (v !== x.city) { x.city = v; ch.push(i + ':city'); } }); return { R, ch }; }, code: "df['city'] = df['city'].str.strip().str.title()", why: '"PUNE", " pune" and "Pune" are three different values to Python: a groupby would give three groups. Strip the spaces and use one casing so equal things look equal.' },
  dedupe: { t: 'Remove duplicate rows', cols: [], rel: R => new Set(R.map(x => keyOf(x))).size < R.length, run(R) { const seen = new Set(), keep = [], gone = []; R.forEach(x => { const k = JSON.stringify([x.age, x.city, x.income, x.signup, x.score, x.id]); if (seen.has(k)) gone.push(x._k); else { seen.add(k); keep.push(x); } }); return { R: keep, ch: [], gone }; }, code: 'df = df.drop_duplicates()', why: 'A repeated row counts the same person twice and biases every average. Always tidy text first - two rows only become identical once " Pune" and "Pune" match.' },
  impossible: { t: 'Blank impossible ages', cols: ['age'], rel: R => R.some(x => isNum(x.age) && (x.age < 0 || x.age > 100)), run(R) { const ch = []; R.forEach((x, i) => { if (isNum(x.age) && (x.age < 0 || x.age > 100)) { x.age = null; ch.push(i + ':age'); } }); return { R, ch }; }, code: "df.loc[~df['age'].between(0, 100), 'age'] = np.nan", why: 'An age of -3 or 187 is a data-entry error, not an extreme person. Turn it into missing, THEN decide how to fill it - otherwise the bad value corrupts the median.' },
  fill_age: { t: 'Fill missing age with the median', cols: ['age'], rel: R => R.some(x => x.age == null), run(R) { const m = CL.med(R.filter(x => isNum(x.age)).map(x => x.age)), ch = []; R.forEach((x, i) => { if (x.age == null) { x.age = m; ch.push(i + ':age'); } }); return { R, ch, m }; }, code: "df['age'] = df['age'].fillna(df['age'].median())", why: 'Dropping every row with a missing age would waste the rest of that row. The median is a safe typical value: unlike the mean it is not dragged by extremes.' },
  fill_score: { t: 'Fill missing score with the median', cols: ['score'], rel: R => R.some(x => x.score == null), run(R) { const m = CL.med(R.filter(x => isNum(x.score)).map(x => x.score)), ch = []; R.forEach((x, i) => { if (x.score == null) { x.score = m; ch.push(i + ':score'); } }); return { R, ch, m }; }, code: "df['score'] = df['score'].fillna(df['score'].median())", why: 'Same idea as age: keep the row, fill the gap with a typical value. Use the median for skewed numbers.' },
  drop_income: { t: 'Drop rows with no income', cols: ['income'], rel: R => R.some(x => x.income == null), run(R) { const gone = [], keep = R.filter(x => { if (x.income == null) { gone.push(x._k); return false; } return true; }); return { R: keep, ch: [], gone }; }, code: "df = df.dropna(subset=['income'])", why: 'Income is what we analyse, so a row without it is useless here. Dropping is right when the missing column is the target of the analysis, or when too little else is known about the row to fill it honestly.' },
  iqr_drop: { t: 'Remove income outliers (IQR rule)', cols: ['income'], rel: R => { const v = R.filter(x => isNum(x.income)).map(x => x.income); if (v.length < 6) return false; const q1 = CL.q(v, .25), q3 = CL.q(v, .75), f = 1.5 * (q3 - q1); return v.some(a => a < q1 - f || a > q3 + f); }, run(R) { const v = R.filter(x => isNum(x.income)).map(x => x.income), q1 = CL.q(v, .25), q3 = CL.q(v, .75), f = 1.5 * (q3 - q1), lo = q1 - f, hi = q3 + f, gone = [], keep = R.filter(x => { if (isNum(x.income) && (x.income < lo || x.income > hi)) { gone.push(x._k); return false; } return true; }); return { R: keep, ch: [], gone, lo, hi }; }, code: "q1, q3 = df['income'].quantile([0.25, 0.75])\niqr = q3 - q1\ndf = df[df['income'].between(q1 - 1.5 * iqr, q3 + 1.5 * iqr) | df['income'].isna()]", why: 'Values beyond Q1 - 1.5 x IQR or Q3 + 1.5 x IQR are far from the middle 50% of the data. They distort means and models. Look at each one first: a typo (remove or fix) is different from a real billionaire (keep, or model separately).' },
};
CL.ORDER = ['numeric', 'dates', 'texts', 'dedupe', 'impossible', 'fill_age', 'fill_score', 'drop_income', 'iqr_drop'];
CL.apply = (rows, ids) => { let R = clone(rows); const steps = []; for (const id of ids) { const before = clone(R), res = CL.OPS[id].run(R); R = res.R; steps.push(Object.assign({ id, before, after: clone(R) }, res)); } return { rows: R, steps }; };
CL.missing = (R, col) => R.filter(x => x[col] == null).length;
CL.csv = rows => 'id,age,city,income,signup,score\n' + rows.map(x => [x.id, x.age ?? '', x.city, /,/.test(String(x.income)) ? '"' + x.income + '"' : (x.income ?? ''), x.signup, x.score ?? ''].join(',')).join('\n');

DSQ.viz.cleanLab = (c, a) => {
  let level = a.level || 3, seed = a.seed || 1, rows0 = CL.gen(seed, level), applied = [], col = 'income', view = '2d', timer = null, p3 = null;
  const stage = c.stage; stage.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:start;padding:10px;place-items:stretch';
  const paneT = h('div', { class: 'cpane' }), paneC = h('div', { class: 'cpane' }), paneK = h('div', { class: 'cpane' }), paneN = h('div', { class: 'cpane' });
  const lab = (t, el) => { el.prepend(h('div', { class: 'cph' }, t)); return el; };
  stage.append(lab('1  CSV / table', paneT), lab('2  Chart', paneC), lab('3  pandas code', paneK), lab('4  Notes: what and why', paneN));
  const opsBar = h('div', { class: 'row', style: { padding: '8px 12px', borderBottom: '1px solid var(--line)' } }); c.box.insertBefore(opsBar, stage);
  const goalBox = h('div', { style: { padding: '0 12px 8px' } }); c.box.insertBefore(goalBox, stage);
  const cur = () => CL.apply(rows0, applied);
  function drawTable(st) {
    const last = st.steps[st.steps.length - 1], prev = last ? last.before : rows0, gone = new Set(last ? (last.gone || []) : []), ch = new Set(last ? last.ch : []);
    const cols = ['id', 'age', 'city', 'income', 'signup', 'score'], show = prev.slice(0, 40);
    paneT.querySelector('.tbl')?.remove();
    const wrap = h('div', { class: 'tbl', style: { maxHeight: '300px', overflow: 'auto' } });
    wrap.innerHTML = dfHTML(cols, show.map(x => cols.map(k => (x[k] == null ? NaN : x[k]))), { rowCls: i => (gone.has(show[i]._k) ? 'dimr strike' : ''), cls: (i, j) => { const bad = (cols[j] === 'age' && isNum(show[i].age) && (show[i].age < 0 || show[i].age > 100)); const was = last && last.after.find(y => y._k === show[i]._k); return (last && ch.has(prev.indexOf(show[i]) + ':' + cols[j])) || (last && was && was[cols[j]] !== show[i][cols[j]]) ? 'fix' : (bad ? 'bad' : ''); }, index: show.map(x => x._k) });
    paneT.append(wrap); paneT.querySelector('.cstat')?.remove();
    const R = st.rows; paneT.append(h('div', { class: 'cstat' }, `${R.length} rows now`, ' - missing: ', ['age', 'income', 'score'].map(k => `${k} ${CL.missing(R, k)}`).join(', '), ` - duplicates: ${R.length - new Set(R.map(keyOf)).size}`));
  }
  function drawChart(st) {
    paneC.querySelector('.cbody')?.remove(); const body = h('div', { class: 'cbody' }); paneC.append(body);
    const toggle = h('div', { class: 'row', style: { marginBottom: '6px' } }, h('select', { class: 'input', style: { width: 'auto', padding: '3px 8px' }, onchange: e => { col = e.target.value; draw(); } }, ['age', 'income', 'score'].map(k => h('option', { value: k, selected: k === col }, k))), h('button', { class: 'btn sm', type: 'button', onclick: () => { view = view === '2d' ? '3d' : '2d'; draw(); } }, view === '2d' ? 'Show in 3-D' : 'Show 2-D histogram'));
    body.append(toggle);
    const numsOf = R => R.map(x => (isNum(x[col]) ? x[col] : parseFloat(String(x[col]).replace(/,/g, '')))).filter(Number.isFinite);
    if (view === '2d') {
      const o = numsOf(rows0), n = numsOf(st.rows), lo = Math.min(...o, ...n), hi = Math.max(...o, ...n), B = 14, W = 330, Hh = 190, bw = (W - 30) / B;
      const hist = v => { const k = range(B).map(() => 0); v.forEach(x => { k[Math.min(B - 1, Math.floor((x - lo) / ((hi - lo) || 1) * B))]++; }); return k; }, ho = hist(o), hn = hist(n), mx = Math.max(...ho, ...hn, 1);
      let s = svgOpen(W, Hh) + `<line x1="20" x2="${W - 8}" y1="${Hh - 28}" y2="${Hh - 28}" stroke="var(--ax)"/>`;
      ho.forEach((k, i) => { s += `<rect x="${20 + i * bw}" y="${Hh - 28 - k / mx * (Hh - 50)}" width="${bw - 2}" height="${k / mx * (Hh - 50)}" fill="none" stroke="var(--ax)" stroke-dasharray="3 2"/>`; });
      hn.forEach((k, i) => { s += `<rect x="${20 + i * bw + 2}" y="${Hh - 28 - k / mx * (Hh - 50)}" width="${bw - 6}" height="${k / mx * (Hh - 50)}" fill="var(--c0)" opacity=".85"/>`; });
      if (col === 'income' && n.length > 5) { const q1 = CL.q(n, .25), q3 = CL.q(n, .75), f = 1.5 * (q3 - q1); [q1 - f, q3 + f].forEach(v => { if (v > lo && v < hi) s += `<line x1="${20 + (v - lo) / ((hi - lo) || 1) * (W - 30)}" x2="${20 + (v - lo) / ((hi - lo) || 1) * (W - 30)}" y1="10" y2="${Hh - 28}" stroke="var(--bad)" stroke-width="2" stroke-dasharray="5 3"/>`; }); }
      s += `<text x="20" y="${Hh - 10}" class="m" font-size="10">${Math.round(lo)}</text><text x="${W - 8}" y="${Hh - 10}" text-anchor="end" class="m" font-size="10">${Math.round(hi)}</text><text x="${W / 2}" y="14" text-anchor="middle" font-size="9" font-weight="800">${col}: dashed = before, blue = now${col === "income" ? ", red = IQR fences" : ""}</text></svg>`;
      body.append(h('div', { html: s }), h('div', { class: 'cstat' }, `n = ${n.length}, mean ${n.length ? (sum(n) / n.length).toFixed(1) : '-'}, median ${n.length ? CL.med(n).toFixed(1) : '-'} (before: mean ${(sum(o) / o.length).toFixed(1)}, median ${CL.med(o).toFixed(1)})`));
    } else {
      const holder = h('div'); body.append(holder); p3 && p3.destroy(); p3 = Plot3D(holder, { w: 480, h: 290, az: .8, el: .45 });
      const num = v => (isNum(v) ? v : parseFloat(String(v).replace(/,/g, ''))), ok = x => [x.age, x.income, x.score].every(v => Number.isFinite(num(v))), now = new Set(st.rows.map(x => x._k));
      const all = rows0.filter(ok); if (all.length < 3) { holder.textContent = 'Clean the numbers first - 3-D needs age, income and score.'; return; }
      const nm = k => normPt(all.map(x => num(x[k])), 3.4), X = nm('age'), Y = nm('income'), Z = nm('score');
      const items = all.map((x, i) => ({ t: 'pt', p: [X[i], Y[i], Z[i]], r: now.has(x._k) ? 4.4 : 3.4, color: now.has(x._k) ? '#2F6FE0' : '#C8323C' }));
      DSQ.axes3(3.9, ['age', 'income', 'score']).forEach(it => items.push(it)); p3.set(items, [0, 0, 0], 5.4); p3.draw(1); c.onDestroy(() => p3 && p3.destroy());
      body.append(h('div', { class: 'cstat' }, 'blue = rows still in the data, red = rows your cleaning removed. Outliers stand far from the cloud: drag to rotate.'));
    }
  }
  function drawCode(st) {
    paneK.querySelector('.ckode')?.remove(); const lines = ["import pandas as pd, numpy as np", "df = pd.read_csv('data/messy.csv')"]; const mark = [];
    applied.forEach((id, i) => { const L = CL.OPS[id].code.split('\n'); lines.push('# ' + CL.OPS[id].t); L.forEach(l => { lines.push(l); if (i === applied.length - 1) mark.push(lines.length - 1); }); });
    const box = h('div', { class: 'ckode' }); box.innerHTML = '<pre class="codeblock" style="margin:0;max-height:215px;overflow:auto">' + lines.map((l, i) => `<span class="${mark.includes(i) ? 'cl-on' : ''}">${hlPy(l) || ' '}</span>`).join('\n') + '</pre>'; paneK.append(box); c.code = lines.join('\n');
    const out = h('pre', { class: 'tout', hidden: true }), btn = h('button', { class: 'btn sm', type: 'button', onclick: async () => { btn.disabled = true; out.hidden = false; out.textContent = 'Running real pandas...'; const code = c.code + "\nprint(df.shape)\nprint(df.isna().sum().to_dict())"; const r = await Py.run({ code, files: { 'data/messy.csv': CL.csv(rows0) } }); const lab = cur().rows; out.textContent = r.error ? fmtErr(r.error) : r.stdout + `\nlab says: (${lab.length}, 6)  ->  ` + (r.stdout.startsWith('(' + lab.length + ', 6)') ? 'MATCH: your code and the picture agree' : 'differs (an operation order or detail differs)'); btn.disabled = false; } }, 'Run this code in real Python');
    box.append(h('div', { class: 'row', style: { marginTop: '6px' } }, btn), out);
  }
  function drawNotes(st) {
    paneN.querySelector('.cnotes')?.remove(); const last = st.steps[st.steps.length - 1], box = h('div', { class: 'cnotes prose' }); paneN.append(box);
    if (!last) { box.innerHTML = `<p><b>Level ${level}: ${['', 'easy', 'medium', 'hard', 'complex'][level]}.</b> Look at the table first (always!). What is wrong with it? Missing values, repeated rows, inconsistent text, text where numbers should be, impossible values, outliers.</p><p>Press a cleaning step above. Each step updates the table, the chart, the code and these notes. Try them in different orders - some orders give a different answer.</p>`; return; }
    const op = CL.OPS[last.id], bef = last.before.length, aft = last.after.length; let ex = '';
    if (last.m != null) ex = `<p>The median used to fill was <b>${last.m}</b>.</p>`; if (last.lo != null) ex = `<p>Fences: below <b>${Math.round(last.lo)}</b> or above <b>${Math.round(last.hi)}</b> counts as an outlier. ${last.gone.length} row(s) removed.</p>`;
    const tips = []; if (last.id === 'fill_age' && applied.includes('impossible') === false && last.before.some(x => isNum(x.age) && (x.age < 0 || x.age > 100))) tips.push('Warning: impossible ages (-3, 187) were still in the data when the median was computed. Blank them first.'); if (last.id === 'dedupe' && !applied.includes('texts') && rows0.some(x => x.city !== titleCase(x.city))) tips.push('Tip: tidy the city text first - duplicates that differ only by case or spaces were not recognised.'); if (last.id === 'fill_age' && applied.includes('iqr_drop') === false && CL.OPS.iqr_drop.rel(last.after)) tips.push('Note: outliers still exist in income - handle them before building models.');
    box.innerHTML = `<h4 style="margin:0">${esc(op.t)}</h4><p>${esc(op.why)}</p>${ex}<p><b>Effect:</b> rows ${bef} &rarr; ${aft}${bef !== aft ? ' (' + (bef - aft) + ' removed)' : ''}; ${last.ch.length ? last.ch.length + ' cell(s) changed (green in the table)' : 'no cell values changed'}.</p>` + tips.map(t => `<div class="callout warn" style="margin:4px 0">${esc(t)}</div>`).join('');
  }
  function drawOps(st) {
    opsBar.innerHTML = ''; CL.ORDER.forEach(id => { const op = CL.OPS[id], need = op.rel(st.rows); opsBar.append(h('button', { class: 'btn sm' + (applied.includes(id) ? ' ok' : ''), type: 'button', title: need ? 'there is something to fix here' : 'nothing to fix right now', style: { opacity: need || applied.includes(id) ? 1 : .55 }, onclick: () => { applied.push(id); draw(); } }, (need ? '● ' : '') + op.t)); });
    opsBar.append(h('button', { class: 'btn sm', type: 'button', onclick: () => { applied.pop(); draw(); } }, 'Undo'), h('button', { class: 'btn sm', type: 'button', onclick: () => { applied = []; draw(); } }, 'Reset'), h('button', { class: 'btn sm primary', type: 'button', onclick: auto }, 'Auto-clean (recommended order)'));
  }
  function auto() { clearInterval(timer); applied = []; draw(); let k = 0; timer = setInterval(() => { while (k < CL.ORDER.length && !CL.OPS[CL.ORDER[k]].rel(cur().rows)) k++; if (k >= CL.ORDER.length) { clearInterval(timer); return; } applied.push(CL.ORDER[k]); k++; draw(); }, 1500); }
  c.onDestroy(() => clearInterval(timer));
  function ready(R) { const bad = []; if (R.length !== new Set(R.map(keyOf)).size) bad.push('duplicate rows remain'); ['age', 'income', 'score'].forEach(k => { if (CL.missing(R, k)) bad.push(`${CL.missing(R, k)} missing ${k}`); }); if (R.some(x => x.city !== titleCase(x.city))) bad.push('city text is inconsistent'); if (R.some(x => !isNum(x.income) && x.income != null)) bad.push('income is still text'); if (R.some(x => isNum(x.age) && (x.age < 0 || x.age > 100))) bad.push('impossible ages remain'); if (R.some(x => /\//.test(String(x.signup)))) bad.push('dates are in two formats'); if (CL.OPS.iqr_drop.rel(R)) bad.push('income outliers remain'); return bad; }
  function goal(st) {
    goalBox.innerHTML = ''; const bad = ready(st.rows), expect = CL.apply(rows0, CL.ORDER.filter(id => true)).rows.length;
    goalBox.append(h('div', { class: 'callout ' + (bad.length ? 'warn' : 'ok'), style: { margin: 0 } }, h('b', {}, 'Challenge: make this data analysis-ready. '), bad.length ? 'Still wrong: ' + bad.join('; ') + '.' : `Ready! ${st.rows.length} rows kept (the recommended order keeps ${expect}).`));
    if (!bad.length && applied.length && !c.done) { c.done = true; DSQ.S.award(15 + level * 5, 'Dataset cleaned'); confetti(60); }
  }
  function draw() { const st = cur(); drawOps(st); drawTable(st); drawChart(st); drawCode(st); drawNotes(st); goal(st); c.say(`rows ${rows0.length} -> ${st.rows.length}   <span class="g">${applied.map(id => CL.OPS[id].t).join(' > ') || 'no cleaning yet'}</span>`); }
  c.select('level', [[1, 'easy'], [2, 'medium'], [3, 'hard'], [4, 'complex']], level, v => { level = +v; seed++; rows0 = CL.gen(seed, level); applied = []; c.done = false; draw(); });
  c.button('New random dataset', () => { seed++; rows0 = CL.gen(seed, level); applied = []; c.done = false; draw(); });
  c.button('Download this CSV', () => DSQ.Proj && DSQ.Proj.download('messy.csv', CL.csv(rows0))); c.button('Use in Python (data/messy.csv)', () => { DSQ.extraFiles['data/messy.csv'] = CL.csv(rows0); toast('Saved: load it with pd.read_csv("data/messy.csv")'); });
  draw();
};

/* ---------------------------------------------------------------------
   Random data questions (never the same twice): levels 1 easy ... 4 complex. Used by Drills -> Data practice.
   --------------------------------------------------------------------- */
DSQ.dataQuestions = level => {
  const tbl = rows => dfHTML(['id', 'age', 'city', 'income', 'signup', 'score'], rows.slice(0, 9).map(x => [x.id, x.age ?? NaN, x.city, x.income ?? NaN, x.signup, x.score ?? NaN]));
  const D = r => CL.gen(r.int(1, 99999), level), more = (ans, extra) => distract(ans, extra);
  const numAns = (ans, d = 1) => (+ans).toFixed(d);
  const T = {
    1: [
      r => { const R = D(r), k = r.pick(['age', 'income']), n = CL.missing(R, k); return { q: `Table (first 9 of ${R.length} rows):\n${tbl(R)}\nHow many rows have a MISSING \`${k}\` (in the whole table)?`, correct: n, wrong: more(n, [n + 1, n - 1 < 0 ? n + 2 : n - 1, R.length, 0, n + 2]), why: `isna().sum() on ${k} counts the empty cells: ${n}.` }; },
      r => { const R = D(r); return { q: `How many rows does this DataFrame have?\n${tbl(R)}\n(the table shows only the first 9; the data frame has all of them: \`df.shape[0]\`)`, correct: R.length, wrong: more(R.length, [9, R.length - 1, R.length + 2, R.length * 2]), why: 'len(df) / df.shape[0] counts every row, not only the visible ones.' }; },
      r => { const R = D(r), c = {}; R.forEach(x => { c[x.city] = (c[x.city] || 0) + 1; }); const top = Object.keys(c).sort((a, b) => c[b] - c[a] || a.localeCompare(b))[0], tie = Object.values(c).filter(v => v === c[top]).length > 1; if (tie) return null; return { q: `Which city appears most often in the WHOLE data?\n${tbl(R)}\n(\`df['city'].value_counts().idxmax()\`)`, correct: top, wrong: more(top, CITIES.filter(x => x !== top).slice(0, 4)), why: `value_counts gives ${top}: ${c[top]} rows.` }; },
    ],
    2: [
      r => { const R = D(r), n = CL.apply(R, ['dedupe']).rows.length; return { q: `This data has repeated rows (same id and values).\n${tbl(R)}\nAfter \`df = df.drop_duplicates()\` how many rows remain (whole data: ${R.length} rows)?`, correct: n, wrong: more(n, [R.length, n - 1, n + 1, n - 2 < 0 ? n + 3 : n - 2]), why: `${R.length - n} exact duplicate rows are dropped.` }; },
      r => { const R = D(r), v = R.filter(x => isNum(x.age)).map(x => x.age), m = CL.med(v); return { q: `What is \`df['age'].median()\` for the whole data (missing values are skipped)?\n${tbl(R)}`, correct: numAns(m), wrong: more(numAns(m), [numAns(sum(v) / v.length), numAns(m + 1), numAns(m - 2), numAns(Math.max(...v))]), why: `Sort the ${v.length} known ages and take the middle: ${m}.` }; },
      r => { const R = D(r), n = new Set(R.map(x => titleCase(x.city))).size, raw = new Set(R.map(x => x.city)).size; if (n === raw) return null; return { q: `City is typed inconsistently (case and spaces).\n${tbl(R)}\nAfter \`df['city'].str.strip().str.title()\`, how many DISTINCT cities (\`nunique\`) are there? (before cleaning \`nunique\` = ${raw})`, correct: n, wrong: more(n, [raw, n + 1, n - 1, 6]), why: `Tidied, equal names collapse to ${n} distinct cities.` }; },
    ],
    3: [
      r => { const R = D(r), a = CL.apply(R, ['impossible', 'fill_age']).rows, m = sum(a.map(x => x.age)) / a.length; return { q: `Steps: blank impossible ages (outside 0-100), then \`fillna(median)\` on age.\n${tbl(R)}\nWhat is the mean age afterwards (1 decimal, whole data of ${R.length} rows)?`, correct: numAns(m), wrong: more(numAns(m), [numAns(m + .6), numAns(m - .8), numAns(m + 2.3), numAns(sum(R.filter(x => isNum(x.age)).map(x => x.age)) / R.filter(x => isNum(x.age)).length)]), why: 'The impossible ages become missing first, so the median ignores them; then every gap gets that median and the mean is recomputed.' }; },
      r => { const R = D(r), a = CL.apply(R, ['numeric']).rows, v = a.filter(x => isNum(x.income)).map(x => x.income), q1 = CL.q(v, .25), q3 = CL.q(v, .75), f = 1.5 * (q3 - q1), n = v.filter(x => x < q1 - f || x > q3 + f).length; return { q: `Income has outliers. Using the IQR rule (below Q1 - 1.5 IQR or above Q3 + 1.5 IQR, quartiles with the pandas default), how many rows are outliers?\n${tbl(R)}\n(Q1 = ${Math.round(q1)}, Q3 = ${Math.round(q3)})`, correct: n, wrong: more(n, [n + 1, n + 2, Math.max(0, n - 1), 0]), why: `IQR = ${Math.round(q3 - q1)}, fences ${Math.round(q1 - f)} .. ${Math.round(q3 + f)}; ${n} values lie outside.` }; },
      r => { const R = D(r), a = CL.apply(R, ['numeric']).rows, n = a.filter(x => ['age', 'income', 'score'].every(k => x[k] != null)).length; return { q: `How many rows survive \`df.dropna()\` (drop a row if ANY of age, income, score is missing)?\n${tbl(R)}\n(whole data: ${R.length} rows)`, correct: n, wrong: more(n, [R.length, n + 1, n + 2, n - 1 < 0 ? 0 : n - 1]), why: 'Every row with at least one missing value is removed.' }; },
    ],
    4: [
      r => { const R = D(r), ids = ['numeric', 'texts', 'dedupe', 'drop_income', 'iqr_drop'], n = CL.apply(R, ids).rows.length; return { q: `Pipeline on the whole data (${R.length} rows):\n1) income text -> number  2) tidy city names  3) drop_duplicates  4) dropna on income  5) remove income outliers by the IQR rule\n${tbl(R)}\nHow many rows remain at the end?`, correct: n, wrong: more(n, [n + 1, n + 2, n - 1, R.length]), why: 'Apply the five steps in order; each one only sees the result of the previous.' }; },
      r => { const R = D(r), a = CL.apply(R, ['numeric', 'dates', 'texts', 'dedupe', 'impossible', 'fill_score', 'drop_income']).rows, m = sum(a.map(x => x.score)) / a.length; return { q: `Pipeline: numeric income, parse dates, tidy city, drop duplicates, blank impossible ages, fill missing score with the median, drop rows without income.\n${tbl(R)}\nWhat is the MEAN score of the result (1 decimal)?`, correct: numAns(m), wrong: more(numAns(m), [numAns(m + .7), numAns(m - .9), numAns(m + 2.1), numAns(CL.med(a.map(x => x.score)))]), why: 'The median fill keeps scores typical; dropping duplicates and rows without income shrinks the data before the mean.' }; },
      r => { const R = D(r), A = CL.apply(R, ['numeric', 'texts', 'dedupe', 'iqr_drop']).rows, B = CL.apply(R, ['numeric', 'texts', 'dedupe']).rows, mean = x => sum(x.filter(y => isNum(y.income)).map(y => y.income)) / x.filter(y => isNum(y.income)).length; const d = mean(B) - mean(A); return { q: `Outliers inflate averages. After numeric income, tidy city and dedupe, by how much does the MEAN income FALL (rounded to the nearest 100) when you also remove IQR outliers?\n${tbl(R)}`, correct: Math.round(d / 100) * 100, wrong: more(Math.round(d / 100) * 100, [Math.round(d / 100) * 100 + 1000, Math.round(d / 100) * 100 - 1000, Math.round(d / 100) * 100 + 5000, 0]), why: `mean before ${Math.round(mean(B))}, after ${Math.round(mean(A))}.` }; },
    ],
  };
  const arr = T[level]; return [].concat(arr, arr, arr).map(f => ({ gen: r => { for (let k = 0; k < 6; k++) { const o = f(r); if (o) return o; } return null; } }));
};
