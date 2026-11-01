'use strict';
/* =====================================================================
   Datasets at real scale (50,000 to 500,000 rows).
   Each table is rebuilt from a seed by public/dsq_data.py inside the browser's Python, so:
   - the ORIGINAL cannot be damaged: every load() starts from scratch, a reset is just running it again;
   - every learner gets their own numbers (the seed comes from the username), so answers cannot be copied;
   - the owner account gets the largest size and the harder "flagship" tasks.
   Practice tasks are written from the learner's own data (a random group, threshold, column), checked against a
   reference computed on the same data, and a wrong answer is matched to the usual wrong routes to say what went wrong.
   ===================================================================== */
const BIG = {
  catalog: [
    { id: 'retail', ic: 'Rt', color: 1, title: 'Online retail orders', domain: 'Retail analytics', blurb: 'Two years of orders: category, region, price, discount, payment, returns and reviews.', skills: 'groupby, seasonality, returns, pricing' },
    { id: 'rides', ic: 'Rd', color: 3, title: 'Ride-hailing trips', domain: 'Operations', blurb: 'A year of trips in six cities with surge pricing, rain, fares, ratings and cancellations.', skills: 'time features, surge, cancellations' },
    { id: 'bank', ic: 'Bk', color: 2, title: 'Card transactions and fraud', domain: 'Finance and risk', blurb: 'About 1% of transactions are fraud: an imbalanced classification problem.', skills: 'imbalance, precision/recall, rules' },
    { id: 'clicks', ic: 'Wb', color: 0, title: 'Website sessions and conversion', domain: 'Product and growth', blurb: 'Four months of sessions by source, device and landing page, and who bought.', skills: 'funnels, A/B thinking, conversion' },
    { id: 'sensors', ic: 'Io', color: 5, title: 'Factory machine telemetry', domain: 'IoT and maintenance', blurb: 'Temperature, vibration and pressure per machine, with failures in the next 24 hours.', skills: 'time series, anomalies, prediction' },
    { id: 'social', ic: 'Sm', color: 4, title: 'Social media posts and engagement', domain: 'Content creation', blurb: 'A year of posts on five platforms: format, hook length, hashtags, hour and the engagement earned.', skills: 'what makes content work' },
  ],
  sizes: [50000, 100000, 250000, 500000],
  _src: null,
  fmt: n => Number(n).toLocaleString('en-US'),
  hash(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) & 0x7fffffff; },
  seed() { return BIG.hash('dsq:' + S.me.username.toLowerCase()); },
  tier() { return S.me.tier === 'flagship' ? 'flagship' : 'standard'; },
  n() { const b = S.st.big || {}; return b.n || (BIG.tier() === 'flagship' ? 500000 : 100000); },
  setN(n) { S.st.big = S.st.big || {}; S.st.big.n = n; S.save(); },
  HELPERS: ['dsq_data.py', 'dsq_http.py', 'dsq_django.py', 'dsq_pane.py', 'dsq_shell.py', 'dsq_docker.py'],
  _helpers: null,
  async files(extra) {
    if (!BIG._helpers) {
      const got = await Promise.all(BIG.HELPERS.map(async f => { const r = await fetch(f + '?v=9'); if (!r.ok) throw new Error('could not load ' + f); return [f, await r.text()]; }));
      BIG._helpers = Object.fromEntries(got);
    }
    return Object.assign({}, BIG._helpers, { 'dsq_cfg.py': `SEED = ${BIG.seed()}
DEFAULT_N = ${BIG.n()}
` }, extra || {});
  },
  /* the first printed JSON line of a run */
  json(r) { try { return JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch (e) { return null; } },
};
DSQ.BIG = BIG;

const sizeChips = (after) => h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('span', { class: 'muted mono', style: { fontSize: '12px', fontWeight: 700 } }, 'ROWS'), BIG.sizes.map(n => h('button', { type: 'button', class: 'btn sm' + (BIG.n() === n ? ' primary' : ''), onclick: () => { BIG.setN(n); if (Py.w) Py.kreset(); after(); } }, BIG.fmt(n))));

function viewData(parts) {
  const d = BIG.catalog.find(x => x.id === parts[1]);
  return d ? dataDetail(d) : dataIndex();
}

function dataIndex() {
  const root = h('div', { class: 'stack' });
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Datasets'), h('h1', {}, 'Practise on data at real scale'),
    h('p', { class: 'muted lead' }, 'Six tables of 50,000 to 500,000 rows, generated in your browser. Load them in a notebook or in the practice tasks. They behave like real data: gaps, outliers, seasonality, imbalance and relationships to find.'))));
  root.append(h('div', { class: 'card pad stack' },
    h('h3', {}, 'Your copy and the original'),
    h('p', { html: 'The original table is never stored as a file you could damage. It is <b>rebuilt from a seed every time</b> you call <code>load()</code>, so deleting columns, overwriting values or dropping rows only changes your working copy. Run the cell again and you are back at the original. Your seed comes from your username, so you and your friends see different numbers, and so do the practice tasks.' }),
    h('p', { class: 'muted' }, 'Pick the size you want to work with:'), sizeChips(() => route())));
  root.append(h('div', { class: 'mods' }, BIG.catalog.map(d => h('a', { class: 'card mod', href: '#/data/' + d.id }, h('span', { class: 'ic', style: { background: colv(d.color) } }, d.ic), h('h4', {}, d.title), h('p', {}, d.blurb), h('span', { class: 'badge chip' }, d.domain), h('span', { class: 'muted', style: { fontSize: '12.5px' } }, d.skills)))));
  const done = Object.keys((S.st.big && S.st.big.done) || {}).length;
  root.append(h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/notebook' }, 'Open the notebook'), done ? h('span', { class: 'chip ok' }, done + ' data tasks solved') : null));
  return root;
}

function dataDetail(d) {
  const root = h('div', { class: 'stack' }), info = h('div', { class: 'stack' }), tasks = h('div', { class: 'stack' });
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('a', { href: '#/data', class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← Datasets'), h('div', { class: 'eyebrow', style: { marginTop: '8px' } }, d.domain), h('h1', {}, d.title), h('p', { class: 'muted lead' }, d.blurb))));
  root.append(h('div', { class: 'card pad stack' }, sizeChips(() => route()), h('div', { class: 'row', style: { flexWrap: 'wrap' } },
    h('a', { class: 'btn primary', href: '#/notebook/new:' + d.id }, 'Explore in a notebook'), h('a', { class: 'btn', href: '#/notebook/new:' + d.id + ':3d' }, 'Explore in 3-D'), h('span', { class: 'muted', style: { fontSize: '13px' } }, 'Your copy: ' + BIG.fmt(BIG.n()) + ' rows, seed from your username. Messy version: load(\'' + d.id + '\', messy=True)'))), info);
  info.append(h('div', { class: 'card pad muted' }, 'Building ' + BIG.fmt(BIG.n()) + ' rows in your browser... (the first time also starts Python)'));
  (async () => {
    const files = await BIG.files().catch(e => null); if (!files) { info.innerHTML = ''; info.append(h('div', { class: 'card pad' }, 'Could not load the dataset engine. Check your connection and reload.')); return; }
    const r = await Py.run({ code: `from dsq_data import summary\nprint(summary('${d.id}'))`, files, timeout: 120000 }), s = BIG.json(r);
    info.innerHTML = '';
    if (!s) { info.append(h('div', { class: 'card pad' }, h('b', {}, 'Could not build the table. '), h('pre', { class: 'err' }, r.error ? fmtErr(r.error) : (r.stdout || '(no output)')))); return; }
    info.append(h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('span', { class: 'chip brand' }, BIG.fmt(s.rows) + ' rows'), h('span', { class: 'chip' }, s.cols.length + ' columns'), h('span', { class: 'chip' }, s.mb + ' MB in memory'), h('span', { class: 'chip' }, 'built in ' + r.ms + ' ms'), h('span', { class: 'chip' }, 'target: ' + s.target)),
      h('div', { class: 'card pad stack' }, h('h3', {}, 'Columns'), h('div', { class: 'tscroll', html: TABLE(['column', 'type', 'missing', 'example', 'meaning'], s.cols.map(c => ['<code>' + esc(c.name) + '</code>', esc(c.dtype), c.nulls ? BIG.fmt(c.nulls) : '0', esc(c.example), esc(c.desc)])) })),
      h('div', { class: 'card pad stack' }, h('h3', {}, 'First rows'), h('div', { class: 'tscroll', html: TABLE(s.cols.map(c => esc(c.name)), s.head.map(row => row.map(esc))) })));
    tasks.append(h('div', { class: 'page-h' }, h('div', {}, h('h2', {}, 'Practice tasks on this data'), h('p', { class: 'muted' }, 'Each task is written from your own copy: a different group, threshold or column every time, and an answer only your data gives. Press "New task" as often as you like.'))));
    dataTasks(d, tasks);
  })();
  root.append(tasks);
  return root;
}

function dataTasks(d, root) {
  const st = S.st; st.big = st.big || {}; st.big.k = st.big.k || {}; st.big.done = st.big.done || {};
  const box = h('div', { class: 'stack' }); root.append(box);
  async function next(bump) {
    if (bump) st.big.k[d.id] = (st.big.k[d.id] || 1) + 1; const k = st.big.k[d.id] = st.big.k[d.id] || 1;
    box.innerHTML = ''; box.append(h('div', { class: 'card pad muted' }, 'Writing a task from your data...'));
    const files = await BIG.files(), seed = BIG.seed(), tier = BIG.tier();
    const r = await Py.run({ code: `from dsq_data import task_public\nprint(task_public('${d.id}', ${seed}, ${k}, '${tier}'))`, files, timeout: 120000 }), t = BIG.json(r);
    box.innerHTML = '';
    if (!t) { box.append(h('div', { class: 'card pad' }, 'Could not write a task: ', h('pre', { class: 'err' }, r.error ? fmtErr(r.error) : (r.stdout || ''))), h('button', { class: 'btn', type: 'button', onclick: () => next(true) }, 'Try another')); return; }
    let fails = 0, busy = false, shown = false;
    const key = d.id + ':' + k, left = h('div', { class: 'stack' }), right = h('div', { class: 'stack' }), wrap = h('div', { class: 'exwrap' }, left, right);
    const solved = !!st.big.done[key];
    left.append(h('div', { class: 'xhead' }, h('span', { class: 'chip brand' }, 'Task ' + k), h('span', { class: 'chip' }, t.level >= 3 ? 'flagship' : t.level === 2 ? 'medium' : 'warm-up'), t.messy ? h('span', { class: 'chip warn' }, 'messy table') : null, h('span', { class: 'chip' }, '+20 pts'), solved ? h('span', { class: 'chip ok' }, 'Solved ✓') : null),
      h('h3', { style: { margin: '6px 0 2px' } }, t.title), h('div', { class: 'prose', html: '<p>' + t.q + '</p>' }),
      h('div', { class: 'callout' }, h('b', {}, 'How answers work. '), 'Store your result in the variable ', h('code', {}, 'answer'), '. A number, or a name for "which group" questions. Then press Check.'));
    const hintBox = h('div', { class: 'hints' });
    let hinted = false; left.append(h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', onclick: e => { if (hinted) return; hinted = true; e.target.disabled = true; hintBox.append(h('div', { class: 'hint-b', html: '<b>Hint:</b> ' + inl(t.hint ? 'Look at ' + t.hint : 'Print intermediate results.') })); } }, 'Need a hint?'), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => next(true) }, 'Skip: new task ▸')), hintBox);
    const ed = Editor(right, { code: t.starter, minLines: 9, onRun: () => run(false) });
    const runBtn = h('button', { class: 'btn', type: 'button', onclick: () => run(false) }, '▶ Run'), chk = h('button', { class: 'btn primary', type: 'button', onclick: () => run(true) }, '✓ Check my answer');
    right.append(h('div', { class: 'row' }, runBtn, chk, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => ed.set(t.starter) }, 'Reset code')));
    const outp = outputPane(right); outp.clear('Press Run to look at your data, Check to test the answer.');
    attachTutor(right, () => ed.get(), { files: () => files });
    const solBox = h('div'), after = h('div'); right.append(solBox, after);
    async function run(check) {
      if (busy) return; busy = true; runBtn.disabled = chk.disabled = true; outp.clear('Running on ' + BIG.fmt(BIG.n()) + ' rows...');
      const tests = `from dsq_data import judge\njudge('${d.id}', ${seed}, ${k}, '${tier}', None, globals().get('answer', Ellipsis), check)`;
      const res = await Py.run({ code: ed.get(), tests: check ? tests : '', files, timeout: 120000 });
      busy = false; runBtn.disabled = chk.disabled = false; outp.show(res, { checks: check });
      if (!check) return;
      const ok = !res.error && res.checks.length > 0 && res.checks.every(c => c.ok);
      if (ok) {
        if (!st.big.done[key]) { st.big.done[key] = Date.now(); S.award(fails ? 12 : 20, fails ? 'Data task solved' : 'Data task solved first time'); confetti(60); S.log({ type: 'datatask', id: key, tries: fails + 1 }); }
        S.save(); after.innerHTML = ''; after.append(h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn primary', type: 'button', onclick: () => next(true) }, 'New task ▸'), h('a', { class: 'btn', href: '#/notebook/new:' + d.id }, 'Explore further in a notebook')));
      } else {
        fails++;
        if (fails >= 2 && !shown) { shown = true; solBox.append(h('button', { class: 'btn sm', type: 'button', onclick: e => { e.target.remove(); solBox.append(h('div', { class: 'callout warn', html: '<b>One way to do it</b> (the points for this task drop)' }), codeBlock("from dsq_data import load\n\ndf = load('" + d.id + "'" + (t.messy ? ', messy=True' : '') + ')\n\n' + t.solution + '\nprint(answer)')); } }, 'Stuck? Show one way to do it')); }
      }
    }
    box.append(wrap);
  }
  next(false);
}

/* every exercise and notebook cell can `from dsq_data import load` and `from dsq_http import Client` */
DSQ.prime = async () => { if (!S.me) return; try { Object.assign(DSQ.extraFiles = DSQ.extraFiles || {}, await BIG.files()); } catch (e) { } };
