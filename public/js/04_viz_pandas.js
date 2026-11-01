'use strict';
/* =====================================================================
   pandas visuals (HTML tables): dfSelect, dfFilter, dfSort, dfGroup, dfMerge, dfNA
   ===================================================================== */
const STUDENTS = {
  cols: ['name', 'city', 'age', 'score', 'passed'],
  rows: [['Asha', 'Pune', 21, 88, true], ['Ben', 'Delhi', 24, 72, true], ['Chen', 'Pune', 22, 95, true], ['Dara', 'Mumbai', 20, 55, false], ['Esha', 'Delhi', 23, 81, true],
    ['Farid', 'Mumbai', 25, 47, false], ['Gita', 'Pune', 22, 69, true], ['Hari', 'Delhi', 21, 90, true], ['Isha', 'Mumbai', 24, 76, true], ['Jay', 'Pune', 23, 38, false]],
};
const showv = v => (v == null || (typeof v === 'number' && Number.isNaN(v)) ? 'NaN' : v === true ? 'True' : v === false ? 'False' : String(v));
function dfHTML(cols, rows, o = {}) {
  const idx = o.index || rows.map((_, i) => i);
  return `<div class="dfwrap"><table class="dft"><thead><tr><th></th>${cols.map((c, j) => `<th class="${(o.colCls && o.colCls(j)) || ''}">${esc(c)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map((r, i) => `<tr data-k="${o.keys ? o.keys[i] : i}" class="${(o.rowCls && o.rowCls(i)) || ''}" style="${o.rowStyle ? o.rowStyle(i) : ''}"><td class="ix">${idx[i]}</td>${r.map((v, j) => `<td class="${(typeof v === 'number' && !Number.isNaN(v) ? 'num ' : '') + (v == null || Number.isNaN(v) ? 'nan ' : '') + ((o.cls && o.cls(i, j)) || '')}">${esc(showv(v))}</td>`).join('')}</tr>`).join('') + '</tbody></table></div>';
}
DSQ.dfHTML = dfHTML;
const pyv = v => (typeof v === 'string' ? `'${v}'` : v === true ? 'True' : v === false ? 'False' : String(v));

DSQ.viz.dfSelect = (c, a) => {
  const D = STUDENTS, ci = n => D.cols.indexOf(n);
  const CH = [
    { code: "df['name']", rows: D.rows.map((_, i) => i), cols: [0], note: 'one column -> a Series (a single labelled column)' },
    { code: "df[['name', 'score']]", rows: D.rows.map((_, i) => i), cols: [0, 3], note: 'a list of names -> a smaller DataFrame' },
    { code: 'df.loc[2]', rows: [2], cols: D.cols.map((_, j) => j), note: 'loc picks by LABEL: the row labelled 2' },
    { code: "df.loc[1:3, 'city':'score']", rows: [1, 2, 3], cols: [1, 2, 3], note: 'loc slices INCLUDE the end label (3 and score are in)' },
    { code: 'df.iloc[1:3, 1:3]', rows: [1, 2], cols: [1, 2], note: 'iloc picks by POSITION and excludes the end, like Python slices' },
    { code: 'df.iloc[[0, 4, 9], [0, 3]]', rows: [0, 4, 9], cols: [0, 3], note: 'lists of positions work too' },
    { code: "df[df['score'] > 80]", rows: D.rows.map((r, i) => (r[3] > 80 ? i : -1)).filter(i => i >= 0), cols: D.cols.map((_, j) => j), note: 'a True/False mask keeps only the True rows' },
    { code: "df.loc[df['city'] == 'Pune', ['name', 'score']]", rows: D.rows.map((r, i) => (r[1] === 'Pune' ? i : -1)).filter(i => i >= 0), cols: [0, 3], note: 'rows by condition AND columns by name, in one loc call' },
  ];
  let k = a.pick || 0;
  function draw() {
    const ch = CH[k], R = new Set(ch.rows), Cs = new Set(ch.cols);
    c.stage.innerHTML = dfHTML(D.cols, D.rows, { cls: (i, j) => (R.has(i) && Cs.has(j) ? 'hl' : 'dim'), colCls: j => (Cs.has(j) ? 'hlh' : ''), rowCls: i => (R.has(i) ? '' : 'dimr') });
    const rr = ch.rows.map(i => D.rows[i]).map(r => ch.cols.map(j => r[j]));
    c.say(`<span class="y">${esc(ch.code)}</span>\n<span class="g"># ${esc(ch.note)}</span>\nresult: ${rr.length} row${rr.length === 1 ? '' : 's'} x ${ch.cols.length} column${ch.cols.length === 1 ? '' : 's'}`);
  }
  c.select('select with', CH.map((x, i) => [i, x.code]), k, v => { k = +v; draw(); }, '24em');
  draw();
};

DSQ.viz.dfFilter = (c, a) => {
  const D = STUDENTS; let col = 'score', op = '>', val = 70, op2 = 'none', col2 = 'city', val2 = 'Pune';
  const test = (r, cn, o, v) => { const x = r[D.cols.indexOf(cn)]; const t = isNaN(+v) ? v : +v; return o === '>' ? x > t : o === '<' ? x < t : o === '>=' ? x >= t : o === '<=' ? x <= t : o === '==' ? x == t : x != t; };
  function draw() {
    const m = D.rows.map(r => test(r, col, op, val) && (op2 === 'none' ? true : op2 === 'and' ? test(r, col2, '==', val2) : true) || (op2 === 'or' && test(r, col2, '==', val2)));
    c.stage.innerHTML = dfHTML(D.cols, D.rows, { rowCls: i => (m[i] ? 'keep' : 'dimr'), cls: (i, j) => (D.cols[j] === col || (op2 !== 'none' && D.cols[j] === col2) ? 'hlc' : '') });
    const q1 = `df['${col}'] ${op} ${pyv(isNaN(+val) ? val : +val)}`, q2 = `df['${col2}'] == ${pyv(val2)}`;
    const code = op2 === 'none' ? `df[${q1}]` : `df[(${q1}) ${op2 === 'and' ? '&' : '|'} (${q2})]`;
    c.say(`<span class="y">${esc(code)}</span>\nmask = [${m.map(b => (b ? 'T' : 'F')).join(' ')}]   <span class="g"># True keeps the row</span>\n<span class="g">${m.filter(Boolean).length} of ${m.length} rows kept.  Use & (and), | (or), ~ (not) and ALWAYS put brackets around each condition.</span>`);
  }
  c.select('column', ['age', 'score'], col, v => { col = v; draw(); }); c.select('op', ['>', '>=', '<', '<=', '==', '!='], op, v => { op = v; draw(); });
  c.slider('value', 20, 95, 1, val, v => { val = v; draw(); });
  c.select('and / or city = Pune', [['none', 'no second test'], ['and', 'AND city == Pune'], ['or', 'OR city == Pune']], op2, v => { op2 = v; draw(); });
  draw();
};

DSQ.viz.dfSort = (c, a) => {
  const D = STUDENTS; let col = 'score', asc = false;
  function draw(first) {
    const old = {}; $$('tr[data-k]', c.stage).forEach(tr => { old[tr.dataset.k] = tr.getBoundingClientRect().top; });
    const ci = D.cols.indexOf(col), ord = D.rows.map((_, i) => i).sort((x, y) => { const A = D.rows[x][ci], B = D.rows[y][ci]; const r = A < B ? -1 : A > B ? 1 : x - y; return asc ? r : (A === B ? x - y : -r); });
    c.stage.innerHTML = dfHTML(D.cols, ord.map(i => D.rows[i]), { index: ord, keys: ord, cls: (i, j) => (j === ci ? 'hlc' : '') });
    if (!first) $$('tr[data-k]', c.stage).forEach(tr => { const d = old[tr.dataset.k] - tr.getBoundingClientRect().top; if (d) { tr.style.transform = `translateY(${d}px)`; tr.style.transition = 'none'; requestAnimationFrame(() => requestAnimationFrame(() => { tr.style.transition = 'transform .7s ease'; tr.style.transform = ''; })); } });
    c.say(`<span class="y">df.sort_values('${col}', ascending=${asc ? 'True' : 'False'})</span>\n<span class="g"># the row LABELS (left column) travel with their rows; the original df is unchanged unless you assign it back</span>\n<span class="y">.reset_index(drop=True)</span> <span class="g"># renumbers 0..n-1 if you want fresh labels</span>`);
  }
  c.select('sort by', ['name', 'city', 'age', 'score'], col, v => { col = v; draw(); }); c.select('order', [['false', 'descending'], ['true', 'ascending']], String(asc), v => { asc = v === 'true'; draw(); });
  draw(true);
};

DSQ.viz.dfGroup = (c, a) => {
  const D = STUDENTS; let by = 'city', agg = 'mean', phase = 3, cancel = null;
  const F = { mean: v => mean(v), sum: v => sum(v), max: v => Math.max(...v), min: v => Math.min(...v), count: v => v.length };
  function draw() {
    cancel && cancel(); const bi = D.cols.indexOf(by), keys = [...new Set(D.rows.map(r => r[bi]))].sort(), si = 3;
    const res = keys.map(k => F[agg](D.rows.filter(r => r[bi] === k).map(r => r[si])));
    const out = (p) => {
      const sorted = p >= 1 ? D.rows.map((r, i) => i).sort((x, y) => keys.indexOf(D.rows[x][bi]) - keys.indexOf(D.rows[y][bi]) || x - y) : D.rows.map((_, i) => i);
      let html = `<div class="gbs"><div>${dfHTML(D.cols, sorted.map(i => D.rows[i]), { index: sorted, rowStyle: i => (p >= 1 ? `--g:${colv(keys.indexOf(D.rows[sorted[i]][bi]))};box-shadow:inset 6px 0 0 ${colv(keys.indexOf(D.rows[sorted[i]][bi]))}` : ''), cls: (i, j) => (D.cols[j] === by ? 'hlc' : '') })}</div>`;
      if (p >= 2) { const mx = Math.max(...res.map(Math.abs)) || 1; html += `<div class="gres"><div class="muted" style="font:700 12px var(--f-mono)">${agg}(score) per ${by}</div>` + keys.map((k, i) => `<div class="gbar"><span>${esc(k)}</span><div><i style="width:${Math.abs(res[i]) / mx * 100 * (p >= 3 ? 1 : .0)}%;background:${colv(i)}"></i></div><b>${Number.isInteger(res[i]) ? res[i] : res[i].toFixed(1)}</b></div>`).join('') + '</div>'; }
      c.stage.innerHTML = html + '</div>';
    };
    c.say(`<span class="y">df.groupby('${by}')['score'].${agg}()</span>\n` + `${by}\n` + keys.map((k, i) => `${k.padEnd(8)} ${Number.isInteger(res[i]) ? res[i] : res[i].toFixed(6).replace(/0+$/, '')}`).join('\n') + `\nName: score, dtype: ${Number.isInteger(res[0]) && agg !== 'mean' ? 'int64' : 'float64'}\n<span class="g"># split into groups -> apply ${agg} to each -> combine into one result</span>`);
    cancel = anim(1800, t => { const p = t < .33 ? 0 : t < .66 ? 1 : 2; if (p !== phase) { phase = p; out(phase === 0 ? 0 : phase === 1 ? 1 : 3); } });
    phase = -1; out(0);
  }
  c.select('group by', ['city', 'passed'], by, v => { by = v; draw(); }); c.select('aggregate', ['mean', 'sum', 'max', 'min', 'count'], agg, v => { agg = v; draw(); }); c.button('Replay', draw);
  draw(); return { destroy: () => cancel && cancel() };
};

DSQ.viz.dfMerge = (c, a) => {
  const L = { cols: ['id', 'name'], rows: [[1, 'Asha'], [2, 'Ben'], [3, 'Chen'], [4, 'Dara']] }, Rr = { cols: ['id', 'course'], rows: [[2, 'Stats'], [3, 'ML'], [4, 'SQL'], [5, 'Viz']] };
  let how = a.how || 'inner';
  function draw() {
    const ks = how === 'inner' ? [2, 3, 4] : how === 'left' ? [1, 2, 3, 4] : how === 'right' ? [2, 3, 4, 5] : [1, 2, 3, 4, 5];
    const lk = k => L.rows.find(r => r[0] === k), rk = k => Rr.rows.find(r => r[0] === k);
    const rows = ks.map(k => [k, lk(k) ? lk(k)[1] : NaN, rk(k) ? rk(k)[1] : NaN]);
    c.stage.innerHTML = `<div class="mrg"><div><b>left (students)</b>${dfHTML(L.cols, L.rows, { cls: (i, j) => (j === 0 ? 'hlc' : ''), rowCls: i => (ks.includes(L.rows[i][0]) ? 'keep' : 'dimr') })}</div>` +
      `<div><b>right (courses)</b>${dfHTML(Rr.cols, Rr.rows, { cls: (i, j) => (j === 0 ? 'hlc' : ''), rowCls: i => (ks.includes(Rr.rows[i][0]) ? 'keep' : 'dimr') })}</div>` +
      `<div class="mres"><b>result: how='${how}'</b>${dfHTML(['id', 'name', 'course'], rows, { cls: (i, j) => (j === 0 ? 'hlc' : '') })}</div></div>`;
    c.say(`<span class="y">pd.merge(left, right, on='id', how='${how}')</span>\n<span class="g">${how === 'inner' ? 'inner: only ids found in BOTH tables' : how === 'left' ? "left: every id from the left table; missing right values become NaN" : how === 'right' ? 'right: every id from the right table' : 'outer: every id from either table, NaN where one side is missing'}</span>\n${rows.length} rows in the result`);
  }
  c.select('how', ['inner', 'left', 'right', 'outer'], how, v => { how = v; draw(); }); draw();
};

DSQ.viz.dfNA = (c, a) => {
  const base = { cols: ['name', 'age', 'score', 'city'], rows: [['Asha', 21, 88, 'Pune'], ['Ben', NaN, 72, 'Delhi'], ['Chen', 22, NaN, 'Pune'], ['Dara', 20, 55, null], ['Esha', 23, 81, 'Delhi'], ['Farid', NaN, 47, 'Mumbai']] };
  let act = 'isna', cancel = null;
  function draw() {
    const rows = base.rows.map(r => r.slice()); let note = '', code = '', hl = () => '', keep = rows.map(() => true);
    const colMean = j => mean(base.rows.map(r => r[j]).filter(v => typeof v === 'number' && !Number.isNaN(v)));
    if (act === 'isna') { code = "df.isna().sum()"; hl = (i, j) => (rows[i][j] == null || Number.isNaN(rows[i][j]) ? 'bad' : ''); note = 'age: ' + base.rows.filter(r => Number.isNaN(r[1])).length + ', score: ' + base.rows.filter(r => Number.isNaN(r[2])).length + ', city: ' + base.rows.filter(r => r[3] == null).length + ' missing'; }
    if (act === 'dropna') { code = 'df.dropna()'; keep = rows.map(r => r.every(v => v != null && !Number.isNaN(v))); note = keep.filter(Boolean).length + ' complete rows survive; ' + keep.filter(b => !b).length + ' rows thrown away (you lose data!)'; }
    if (act === 'fillmean') { code = "df.fillna({'age': df['age'].mean(), 'score': df['score'].mean()})"; rows.forEach(r => { if (Number.isNaN(r[1])) r[1] = +colMean(1).toFixed(2); if (Number.isNaN(r[2])) r[2] = +colMean(2).toFixed(2); }); hl = (i, j) => ((Number.isNaN(base.rows[i][j]) && j > 0) ? 'fix' : ''); note = `age mean = ${colMean(1).toFixed(2)}, score mean = ${colMean(2).toFixed(2)} written into the gaps`; }
    if (act === 'fillconst') { code = "df.fillna({'city': 'Unknown'})"; rows.forEach(r => { if (r[3] == null) r[3] = 'Unknown'; }); hl = (i, j) => (base.rows[i][j] == null ? 'fix' : ''); note = 'text gaps get a label instead of a number'; }
    if (act === 'ffill') { code = 'df.ffill()'; rows.forEach((r, i) => { if (i) r.forEach((v, j) => { if (v == null || Number.isNaN(v)) r[j] = rows[i - 1][j]; }); }); hl = (i, j) => (base.rows[i][j] == null || Number.isNaN(base.rows[i][j]) ? 'fix' : ''); note = 'each gap copies the value from the row above (good for time series)'; }
    c.stage.innerHTML = dfHTML(base.cols, rows, { cls: hl, rowCls: i => (keep[i] ? '' : 'dimr') });
    c.say(`<span class="y">${esc(code)}</span>\n<span class="g"># ${esc(note)}</span>`);
  }
  c.select('operation', [['isna', 'find them: isna'], ['dropna', 'drop rows: dropna'], ['fillmean', 'fill with mean'], ['fillconst', 'fill text'], ['ffill', 'forward fill']], act, v => { act = v; draw(); });
  draw();
};
