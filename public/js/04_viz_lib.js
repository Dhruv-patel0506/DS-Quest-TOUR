'use strict';
/* =====================================================================
   Library visuals (real graphs / real tables, stepwise animation):
   matmulLab  - matrix multiplication cell by cell (row . column), shape rule, @ vs *
   vecLab     - dot and cross product of 3-D vectors: angle, projection, perpendicular, parallelogram area
   sqlCompare - pandas loc / iloc / filters / groupby next to the SQL that does the same, animated FROM -> WHERE -> SELECT
   heatmapLab - a correlation heatmap that fills cell by cell, reorders, changes colormap (seaborn/matplotlib)
   plotAnim   - a curve drawn frame by frame like matplotlib.animation.FuncAnimation, with the real code
   ===================================================================== */

/* ---------------------------------------------------------------- matmulLab */
DSQ.viz.matmulLab = (c, a) => {
  let m = 2, n = 3, nb = 3, p = 2, seed = 1, A = [], B = [], T = 0, timer = null;
  const gen = () => { const r = RNG(seed * 7 + 3); A = range(m).map(() => range(n).map(() => r.int(-2, 4))); B = range(nb).map(() => range(p).map(() => r.int(-2, 4))); T = 0; };
  const host = h('div', { class: 'row', style: { justifyContent: 'center', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }); c.stage.append(host);
  const tbl = (M, cls) => '<table class="mm">' + M.map((row, i) => '<tr>' + row.map((v, j) => `<td class="${cls(i, j)}">${v}</td>`).join('') + '</tr>').join('') + '</table>';
  const stop = () => { if (timer) { clearInterval(timer); timer = null; playBtn.textContent = 'Play'; } };
  function draw() {
    const ok = n === nb, per = n + 1, total = m * p * per; T = clamp(T, 0, total);
    const cellIdx = ok ? Math.min(m * p - 1, Math.floor(T / per)) : -1, sub = ok ? (T >= total ? n : T % per) : 0, ci = ok ? Math.floor(cellIdx / p) : -1, cj = ok ? cellIdx % p : -1, finished = ok ? (T >= total ? m * p : Math.floor(T / per)) : 0;
    const C = ok ? range(m).map(i => range(p).map(j => A[i].reduce((s, v, k) => s + v * B[k][j], 0))) : null;
    const Cshow = ok ? range(m).map(i => range(p).map(j => (i * p + j < finished ? C[i][j] : (i * p + j === cellIdx && sub === n && T < total ? C[i][j] : '·')))) : range(m).map(() => range(p).map(() => '?'));
    const inCur = T > 0 && T < total + 1;
    host.innerHTML = `<div><div class="muted mono" style="font-size:11px;text-align:center">A  (${m}, ${n})</div>${tbl(A, (i, j) => (ok && inCur && i === ci ? (j < sub ? 'hr' : 'hr dim2') : ''))}</div><b style="font-size:22px">@</b>` +
      `<div><div class="muted mono" style="font-size:11px;text-align:center">B  (${nb}, ${p})</div>${tbl(B, (i, j) => (ok && inCur && j === cj ? (i < sub ? 'hc' : 'hc dim2') : (!ok ? 'bad' : '')))}</div><b style="font-size:22px">=</b>` +
      `<div><div class="muted mono" style="font-size:11px;text-align:center">C  (${ok ? m + ', ' + p : 'error'})</div>${tbl(Cshow, (i, j) => (ok && i === ci && j === cj && T < total ? 'cur' : (ok && i * p + j < finished ? 'done' : '')))}</div>`;
    let say;
    if (!ok) say = `<span class="r">ValueError: matmul: Input operand 1 has a mismatch in its core dimension 0 (size ${nb} is different from ${n})</span>\n<span class="g"># The inner numbers must match: A has ${n} columns, so B must have ${n} rows. Shape rule: (m, n) @ (n, p) -> (m, p).</span>`;
    else {
      const terms = sub ? range(Math.min(sub, n)).map(k => `${A[ci][k]}x${B[k][cj]}`).join(' + ') : '', part = sub ? range(Math.min(sub, n)).reduce((s, k) => s + A[ci][k] * B[k][cj], 0) : 0;
      say = `<span class="y">C[${ci}][${cj}]</span> = row ${ci} of A . column ${cj} of B = ${terms || '...'}${sub ? ' = ' + part : ''}   <span class="g"># multiply matching pairs, add them up: that is a dot product</span>\n` +
        `<span class="y">numpy</span>  C = A @ B      <span class="g"># shape (${m}, ${n}) @ (${nb}, ${p}) -> (${m}, ${p});  A * B would multiply element by element and needs EQUAL shapes</span>\n` +
        `<span class="g">cells done: ${finished} of ${m * p}.  Each cell costs ${n} multiplications, so the whole product costs ${m * p * n}: this is why GPUs, which do many at once, train neural networks.</span>`;
    }
    c.say(say);
  }
  const sl = (lab, v, set) => c.slider(lab, 1, 4, 1, v, x => { stop(); set(x); gen(); draw(); });
  sl('A rows (m)', m, x => { m = x; }); sl('A columns (n)', n, x => { n = x; nb = x; sb.value = x; sb.nextSibling.textContent = x; }); const sb = sl('B rows', nb, x => { nb = x; }); sl('B columns (p)', p, x => { p = x; });
  c.button('Step', () => { stop(); T++; draw(); }); const playBtn = c.button('Play', () => { if (timer) { stop(); return; } if (T >= m * p * (n + 1)) T = 0; playBtn.textContent = 'Pause'; timer = setInterval(() => { T++; draw(); if (T >= m * p * (n + 1)) stop(); }, 520); });
  c.button('Reset', () => { stop(); T = 0; draw(); }); c.button('New numbers', () => { stop(); seed++; gen(); draw(); });
  c.onDestroy(stop); gen(); draw();
};

/* ---------------------------------------------------------------- vecLab */
DSQ.viz.vecLab = (c, a) => {
  let u = a.u || [2, 1, 0], v = a.v || [0.5, 2, 1], cancel = null, ang0 = 0, v0 = [...v];
  const p3 = Plot3D(c.stage, { w: 620, h: 430, az: .9, el: .5 }); c.onDestroy(() => { p3.destroy(); cancel && cancel(); });
  const dot = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2], cross = (x, y) => [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]], len = x => Math.hypot(...x), add = (x, y) => x.map((t, i) => t + y[i]), sc = (x, k) => x.map(t => t * k);
  const sig = x => x.map(t => (Math.abs(t) < 5e-3 ? 0 : +t.toFixed(2)));
  function draw() {
    const d = dot(u, v), lu = len(u), lv = len(v), cs = lu && lv ? d / (lu * lv) : 0, ang = Math.acos(clamp(cs, -1, 1)) * 180 / Math.PI, w = cross(u, v), lw = len(w), pr = lv ? sc(v, d / (lv * lv)) : [0, 0, 0], items = [];
    items.push({ t: 'poly', pts: [[0, 0, 0], u, add(u, v), v], fill: 'rgba(122,79,208,.16)', stroke: 'rgba(122,79,208,.55)', sw: .8 });
    const arrow = (b, col, lab) => { items.push({ t: 'line', a: [0, 0, 0], b, color: col, w: 2.4 }); items.push({ t: 'pt', p: b, r: 5, color: col }); items.push({ t: 'txt', p: b.map(t => t * 1.08), s: lab, bold: true, color: col }); };
    arrow(u, '#D03A3A', 'u'); arrow(v, '#2F6FE0', 'v'); if (lw > .02) arrow(w.map(t => clamp(t, -4.4, 4.4)), '#7A4FD0', 'u x v');
    if (lv) { items.push({ t: 'line', a: u, b: pr, color: '#555', w: 1, dash: [3, 3] }); items.push({ t: 'line', a: [0, 0, 0], b: pr, color: '#1E8E5A', w: 3 }); }
    DSQ.axes3(4.5, ['x', 'y', 'z']).forEach(it => items.push(it)); p3.set(items, [0, 0, 0], 6.2); p3.draw(1);
    const what = Math.abs(cs) < .02 ? 'perpendicular (dot = 0)' : cs > 0 ? 'pointing roughly the same way (dot > 0)' : 'pointing roughly opposite ways (dot < 0)';
    c.say(`<span class="y">u</span> = ${JSON.stringify(sig(u))}   <span class="y">v</span> = ${JSON.stringify(sig(v))}\n<span class="y">np.dot(u, v)</span> = ${d.toFixed(3)}   = |u| |v| cos(angle) = ${lu.toFixed(2)} x ${lv.toFixed(2)} x ${cs.toFixed(3)}   angle = <span class="y">${ang.toFixed(1)} deg</span>   <span class="g"># ${what}. Green = the shadow of u on v (projection).</span>\n` +
      `<span class="y">np.cross(u, v)</span> = ${JSON.stringify(sig(w))}   length ${lw.toFixed(3)} = <span class="y">area of the purple parallelogram</span>   <span class="g"># a vector perpendicular to BOTH u and v (right-hand rule); swap them and it flips. Parallel vectors give length 0.</span>\n` +
      `<span class="g"># dot answers "how aligned?" (a number: cosine similarity, attention scores, correlation). cross answers "what is perpendicular, and how big is the area?" (3-D only: normals, torque, geometry).</span>`);
  }
  const sls = []; ['u', 'v'].forEach((nm, k) => ['x', 'y', 'z'].forEach((ax, i) => sls.push(c.slider(nm + ax, -3, 3, .1, (k ? v : u)[i], x => { (k ? v : u)[i] = x; v0 = [...v]; draw(); }))));
  c.button('Rotate v around z', () => { cancel && cancel(); const b = [...v]; cancel = anim(3000, t => { const th = t * Math.PI * 2, ca = Math.cos(th), sa = Math.sin(th); v = [b[0] * ca - b[1] * sa, b[0] * sa + b[1] * ca, b[2]]; draw(); }, () => { v = b; draw(); }); });
  c.button('Make v perpendicular to u', () => { cancel && cancel(); const lu2 = dot(u, u) || 1, k = dot(v, u) / lu2, to = add(v, sc(u, -k)); const from = [...v]; cancel = anim(1000, t => { v = from.map((x, i) => lerp(x, to[i], t)); sls.slice(3).forEach((s, i) => { s.value = v[i]; s.nextSibling.textContent = v[i].toFixed(1); }); draw(); }); });
  const gb = c.button('Grid: on', () => { p3.grid = !p3.grid; gb.textContent = 'Grid: ' + (p3.grid ? 'on' : 'off'); draw(); }); draw();
};

/* ---------------------------------------------------------------- sqlCompare */
DSQ.viz.sqlCompare = (c, a) => {
  const names = ['Asha', 'Ben', 'Chitra', 'Dev', 'Esha', 'Farid', 'Gita', 'Hari', 'Isha', 'Jay'], city = ['Pune', 'Delhi', 'Pune', 'Mumbai', 'Delhi', 'Pune', 'Mumbai', 'Delhi', 'Pune', 'Mumbai'], dept = ['Eng', 'Ops', 'Eng', 'Sales', 'Eng', 'Ops', 'Sales', 'Eng', 'Ops', 'Eng'], sal = [72, 48, 66, 55, 81, 44, 59, 90, 51, 63], age = [29, 41, 27, 35, 31, 45, 38, 26, 33, 30];
  const COLS = ['name', 'city', 'dept', 'salary', 'age'], D = names.map((nm, i) => ({ id: 101 + i, name: nm, city: city[i], dept: dept[i], salary: sal[i] * 1000, age: age[i] }));
  const pos = id => id - 101, by = f => D.filter(f).map(r => r.id);
  const Q = [
    { t: 'one row by LABEL', py: 'df.loc[103]', sql: 'SELECT *\nFROM df\nWHERE id = 103;', run: () => ({ rows: [103], cols: COLS }), note: 'loc uses the index LABEL. The index here is the id column (101 ... 110), so 103 is the third row.' },
    { t: 'one row by POSITION', py: 'df.iloc[3]', sql: 'SELECT *\nFROM df\nLIMIT 1 OFFSET 3;', run: () => ({ rows: [104], cols: COLS }), note: 'iloc counts positions from 0, ignoring labels: position 3 is the FOURTH row (label 104). SQL has no row numbers; LIMIT/OFFSET is the nearest thing.' },
    { t: 'label slice (end INCLUDED)', py: 'df.loc[102:105, ["name", "salary"]]', sql: 'SELECT name, salary\nFROM df\nWHERE id BETWEEN 102 AND 105;', run: () => ({ rows: [102, 103, 104, 105], cols: ['name', 'salary'] }), note: 'loc slices include BOTH ends: 102, 103, 104 AND 105 - exactly like SQL BETWEEN.' },
    { t: 'position slice (end EXCLUDED)', py: 'df.iloc[2:5, [0, 3]]', sql: 'SELECT name, salary\nFROM df\nLIMIT 3 OFFSET 2;', run: () => ({ rows: [103, 104, 105], cols: ['name', 'salary'] }), note: 'iloc slices follow normal Python: 2:5 gives positions 2, 3, 4 (three rows). Columns 0 and 3 are name and salary.' },
    { t: 'filter rows', py: 'df[df["salary"] > 60000]', sql: 'SELECT *\nFROM df\nWHERE salary > 60000;', run: () => ({ rows: by(r => r.salary > 60000), cols: COLS }), note: 'A condition makes a True/False mask; only True rows survive. This is WHERE.' },
    { t: 'filter rows + choose columns', py: 'df.loc[df["city"] == "Pune", ["name", "city"]]', sql: 'SELECT name, city\nFROM df\nWHERE city = \'Pune\';', run: () => ({ rows: by(r => r.city === 'Pune'), cols: ['name', 'city'] }), note: 'loc[rows, columns] does WHERE and SELECT in one go: the mask picks rows, the list picks columns.' },
    { t: 'AND of two conditions', py: 'df[(df["dept"] == "Eng") & (df["age"] < 30)]', sql: 'SELECT *\nFROM df\nWHERE dept = \'Eng\' AND age < 30;', run: () => ({ rows: by(r => r.dept === 'Eng' && r.age < 30), cols: COLS }), note: 'Use & for AND, | for OR, ~ for NOT - and put EACH condition in brackets (Python precedence).' },
    { t: 'IN a list', py: 'df[df["city"].isin(["Pune", "Delhi"])]', sql: 'SELECT *\nFROM df\nWHERE city IN (\'Pune\', \'Delhi\');', run: () => ({ rows: by(r => ['Pune', 'Delhi'].includes(r.city)), cols: COLS }), note: 'isin is the pandas IN.' },
    { t: 'query() reads like SQL', py: 'df.query("salary > 50000 and city == \'Pune\'")', sql: 'SELECT *\nFROM df\nWHERE salary > 50000\n  AND city = \'Pune\';', run: () => ({ rows: by(r => r.salary > 50000 && r.city === 'Pune'), cols: COLS }), note: 'query() takes the condition as a string: and / or / not instead of & | ~ and no brackets.' },
    { t: 'top 3 by salary', py: 'df.sort_values("salary", ascending=False).head(3)', sql: 'SELECT *\nFROM df\nORDER BY salary DESC\nLIMIT 3;', run: () => ({ rows: [...D].sort((x, y) => y.salary - x.salary).slice(0, 3).map(r => r.id), cols: COLS, ordered: true }), note: 'Sorting happens AFTER filtering, LIMIT last: the same order as head(3) after sort_values.' },
    { t: 'average per group', py: 'df.groupby("dept")["salary"].mean()', sql: 'SELECT dept, AVG(salary)\nFROM df\nGROUP BY dept;', run: () => { const g = {}; D.forEach(r => { (g[r.dept] = g[r.dept] || []).push(r.salary); }); return { rows: D.map(r => r.id), cols: ['dept', 'salary'], agg: { head: ['dept', 'mean salary'], rows: Object.entries(g).map(([k, v]) => [k, Math.round(v.reduce((s, x) => s + x, 0) / v.length)]) } }; }, note: 'groupby = split by dept, apply mean to each piece, combine. SQL: GROUP BY dept with AVG().' },
    { t: 'count per group', py: 'df["city"].value_counts()', sql: 'SELECT city, COUNT(*)\nFROM df\nGROUP BY city\nORDER BY COUNT(*) DESC;', run: () => { const g = {}; D.forEach(r => { g[r.city] = (g[r.city] || 0) + 1; }); return { rows: D.map(r => r.id), cols: ['city'], agg: { head: ['city', 'count'], rows: Object.entries(g).sort((x, y) => y[1] - x[1]) } }; }, note: 'value_counts() is GROUP BY + COUNT + ORDER BY in one call.' },
  ];
  let qi = a.q || 0, stage = 3, timers = [];
  const host = h('div', { style: { width: '100%' } }); c.stage.append(host); c.onDestroy(() => timers.forEach(clearTimeout));
  function draw() {
    const q = Q[qi], r = q.run(), rs = new Set(r.rows), cs = new Set(r.cols), step = ['FROM df: all rows', 'WHERE / row selector: keep the rows', 'SELECT / column selector: keep the columns'];
    const rowsSel = stage >= 2, colsSel = stage >= 3;
    let t = `<table class="dft"><thead><tr><th>label</th><th>pos</th>${COLS.map(cn => `<th class="${colsSel && cs.has(cn) ? 'hcol' : ''}">${cn}</th>`).join('')}</tr></thead><tbody>`;
    D.forEach(row => { const on = rs.has(row.id); t += `<tr class="${rowsSel ? (on ? 'hrow' : 'dimrow') : ''}"><th>${row.id}</th><td class="muted">${pos(row.id)}</td>${COLS.map(cn => `<td class="${rowsSel && on && colsSel && cs.has(cn) ? 'hit' : (colsSel && rowsSel && on && !cs.has(cn) ? 'dimcol' : '')}">${row[cn]}</td>`).join('')}</tr>`; });
    t += '</tbody></table>';
    if (r.agg && stage >= 3) t += `<table class="dft" style="margin-top:8px"><thead><tr>${r.agg.head.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${r.agg.rows.map(x => `<tr>${x.map(v => `<td class="hit">${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    host.innerHTML = t + `<div class="muted mono" style="font-size:12px;margin-top:6px">step ${Math.min(stage, 3)} of 3 - ${step[Math.min(stage, 3) - 1]}</div>`;
    c.say(`<span class="y">pandas</span>\n${esc(q.py)}\n\n<span class="y">SQL</span>\n${esc(q.sql)}\n\n<span class="g"># ${esc(q.note)}</span>` + (r.ordered ? '\n<span class="g"># the rows come back in this order: ' + r.rows.join(', ') + '</span>' : ''));
  }
  const run = () => { timers.forEach(clearTimeout); timers = []; stage = 1; draw(); timers.push(setTimeout(() => { stage = 2; draw(); }, 650), setTimeout(() => { stage = 3; draw(); }, 1400)); };
  c.select('query', Q.map((q, i) => [i, q.t]), qi, v => { qi = +v; run(); }); c.button('Replay the steps', run); run();
};

/* ---------------------------------------------------------------- heatmapLab */
DSQ.viz.heatmapLab = (c, a) => {
  const W = 560, H = 470, names = ['age', 'income', 'spend', 'savings', 'debt', 'score'];
  let seed = 3, cmap = 'coolwarm', annot = true, tri = false, cols = [], C = [], order = [0, 1, 2, 3, 4, 5], shown = 99, cancel = null;
  const host = h('div', { class: 'stagewrap', style: { width: '100%' } }), ro = h('div', { class: 'readout', hidden: true }); c.stage.append(host); host.append(ro); const svgHost = h('div'); host.prepend(svgHost); c.onDestroy(() => cancel && cancel());
  function gen() { const r = RNG(seed * 5 + 1), n = 240, age = range(n).map(() => r.norm(40, 10)), income = age.map(x => .6 * x + r.norm(0, 6)), spend = income.map(x => .7 * x + r.norm(0, 5)), savings = income.map((x, i) => x - spend[i] + r.norm(0, 4)), debt = savings.map(x => -.5 * x + r.norm(0, 4)), score = age.map(x => .05 * x + r.norm(0, 3)); cols = [age, income, spend, savings, debt, score]; C = names.map((_, i) => names.map((_, j) => corr(cols[i], cols[j]))); }
  const corr = (x, y) => { const mx = mean(x), my = mean(y); let sxy = 0, sx = 0, sy = 0; x.forEach((v, i) => { sxy += (v - mx) * (y[i] - my); sx += (v - mx) ** 2; sy += (y[i] - my) ** 2; }); return sxy / Math.sqrt(sx * sy); };
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), mix = (A, B, t) => A.map((v, i) => Math.round(v + (B[i] - v) * t));
  const STOPS = { coolwarm: [[47, 111, 224], [245, 245, 245], [200, 50, 60]], viridis: [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]], magma: [[0, 0, 4], [81, 18, 124], [183, 55, 121], [252, 137, 97], [252, 253, 191]] };
  const color = v => { const S = STOPS[cmap], t = clamp((v + 1) / 2, 0, .9999) * (S.length - 1), i = Math.floor(t), rgb = mix(S[i], S[i + 1], t - i); return rgb; };
  const L = 74, T = 40, SZ = (W - L - 70) / 6, ease_ = x => x * x * (3 - 2 * x);
  let posF = order.map((_, i) => i);   /* float display positions (animated on reorder) */
  function draw() {
    let s = svgOpen(W, H) + `<text x="${L}" y="22" style="font:700 13px var(--f-body)" fill="var(--fg)">Correlation heatmap (${names.length} variables, 240 rows)</text>`, k = 0;
    names.forEach((nm, vi) => { const x = L + posF[vi] * SZ + SZ / 2, y = T + posF[vi] * SZ + SZ / 2; s += `<text x="${x}" y="${T - 6}" text-anchor="middle" class="tkl" style="font-size:11px">${nm}</text><text x="${L - 8}" y="${y + 4}" text-anchor="end" class="tkl" style="font-size:11px">${nm}</text>`; });
    const cells = []; names.forEach((_, i) => names.forEach((__, j) => cells.push([i, j])));
    cells.sort((u, v) => (posF[u[0]] * 6 + posF[u[1]]) - (posF[v[0]] * 6 + posF[v[1]])).forEach(([i, j], idx) => {
      const hide = (tri && posF[j] > posF[i] + .01) || idx >= shown; if (hide) return; const v = C[i][j], rgb = color(v), lum = (.299 * rgb[0] + .587 * rgb[1] + .114 * rgb[2]) / 255, x = L + posF[j] * SZ, y = T + posF[i] * SZ;
      s += `<g data-i="${i}" data-j="${j}"><rect x="${x}" y="${y}" width="${SZ}" height="${SZ}" fill="rgb(${rgb})" stroke="var(--paper)" stroke-width="1"/>` + (annot ? `<text x="${x + SZ / 2}" y="${y + SZ / 2 + 4}" text-anchor="middle" style="font:600 11.5px var(--f-mono)" fill="${lum > .55 ? '#222' : '#fff'}">${v.toFixed(2)}</text>` : '') + '</g>';
    });
    const cbx = L + 6 * SZ + 18; for (let q = 0; q < 60; q++) s += `<rect x="${cbx}" y="${T + q * (6 * SZ) / 60}" width="14" height="${6 * SZ / 60 + .6}" fill="rgb(${color(1 - q / 59 * 2)})"/>`;
    [1, .5, 0, -.5, -1].forEach(v => { const y = T + (1 - v) / 2 * 6 * SZ; s += `<line x1="${cbx + 14}" x2="${cbx + 19}" y1="${y}" y2="${y}" class="tk"/><text x="${cbx + 23}" y="${y + 3.5}" class="tkl">${v}</text>`; });
    svgHost.innerHTML = s + '</svg>';
    const nm = n => (n.length > 7 ? n.slice(0, 7) : n);
    c.say(`<span class="y">import seaborn as sns</span>\ncorr = df.corr()            <span class="g"># ${names.length}x${names.length} matrix: every pair of columns, values from -1 to +1</span>\nsns.heatmap(corr, annot=${annot ? 'True' : 'False'}, cmap="${cmap}", vmin=-1, vmax=1${tri ? ', mask=np.triu(np.ones_like(corr, dtype=bool))' : ''})\n<span class="g"># ${cmap === 'coolwarm' ? 'a DIVERGING map: blue = negative, white = none, red = positive. Always set vmin=-1, vmax=1 so colours mean the same on every plot.' : 'a SEQUENTIAL map: fine for counts, but it hides the sign of a correlation - prefer a diverging map here.'}</span>\n<span class="g"># the diagonal is 1 (a column vs itself); the matrix is symmetric, so mask=np.triu hides the repeated half. Spend and savings are strongly negative (money spent is not saved); debt falls as savings rise.</span>`);
  }
  function reorderTo(newOrder) { cancel && cancel(); const from = [...posF], to = names.map((_, vi) => newOrder.indexOf(vi)); cancel = anim(900, t => { posF = from.map((f, i) => lerp(f, to[i], ease_(t))); draw(); }, () => { posF = to; order = newOrder; draw(); }); }
  function replay() { cancel && cancel(); shown = 0; cancel = anim(1800, t => { shown = Math.round(t * 36); draw(); }, () => { shown = 99; draw(); }); }
  c.select('colormap', [['coolwarm', 'coolwarm (diverging)'], ['viridis', 'viridis (sequential)'], ['magma', 'magma (sequential)']], cmap, v => { cmap = v; draw(); });
  const ab = c.button('Numbers: on', () => { annot = !annot; ab.textContent = 'Numbers: ' + (annot ? 'on' : 'off'); draw(); }), tb = c.button('Lower triangle only: off', () => { tri = !tri; tb.textContent = 'Lower triangle only: ' + (tri ? 'on' : 'off'); draw(); });
  c.button('Fill cell by cell', replay); c.button('Group related variables', () => { const ref = 1, o = names.map((_, i) => i).sort((x, y) => Math.abs(C[y][ref]) - Math.abs(C[x][ref]) || x - y); reorderTo(o); }); c.button('Original order', () => reorderTo([0, 1, 2, 3, 4, 5])); c.button('New data', () => { seed++; gen(); draw(); });
  host.addEventListener('pointermove', e => { const g = e.target.closest && e.target.closest('g[data-i]'); if (!g) { ro.hidden = true; return; } const r = host.getBoundingClientRect(); ro.hidden = false; ro.style.left = (e.clientX - r.left + 12) + 'px'; ro.style.top = (e.clientY - r.top - 28) + 'px'; ro.textContent = `corr(${names[+g.dataset.i]}, ${names[+g.dataset.j]}) = ${C[+g.dataset.i][+g.dataset.j].toFixed(3)}`; });
  host.addEventListener('pointerleave', () => { ro.hidden = true; });
  gen(); draw(); replay();
};

/* ---------------------------------------------------------------- plotAnim */
DSQ.viz.plotAnim = (c, a) => {
  const W = 600, H = 360, PAD = { l: 44, r: 12, t: 12, b: 32 };
  let kind = a.kind || 'damped', frame = 0, N = 180, playing = true, raf = null, grid = true, speed = 1, last = 0;
  const host = h('div', { class: 'stagewrap', style: { width: '100%' } }); c.stage.append(host); c.onDestroy(() => cancelAnimationFrame(raf));
  const DATA = {
    damped: { x: [0, 12], f: x => Math.exp(-.3 * x) * Math.cos(3 * x), t: 'damped oscillation', code: 'y = np.exp(-0.3 * x) * np.cos(3 * x)' },
    sine: { x: [0, 6.3], f: x => Math.sin(x), t: 'sine wave', code: 'y = np.sin(x)' },
    growth: { x: [-6, 6], f: x => 1 / (1 + Math.exp(-x)), t: 'logistic (sigmoid) growth', code: 'y = 1 / (1 + np.exp(-x))' },
    two: { x: [0, 6.3], f: x => Math.sin(x), g: x => Math.cos(x), t: 'sin and cos together', code: 'y1, y2 = np.sin(x), np.cos(x)' },
  };
  function draw() {
    const d = DATA[kind], xs = range(N).map(i => d.x[0] + (d.x[1] - d.x[0]) * i / (N - 1)), ys = xs.map(d.f), ys2 = d.g ? xs.map(d.g) : null, all = ys.concat(ys2 || []), lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * .1 || .5;
    const fr = DSQ.frame2(W, H, PAD, d.x, [lo - pad, hi + pad], { grid, xl: 'x', yl: 'y' }), X = fr.X, Y = fr.Y, k = Math.max(1, Math.round(frame));
    const path = (Y_, col) => `<path d="${path2(xs.slice(0, k).map((x, i) => [x, Y_[i]]), X, Y)}" stroke="${col}" stroke-width="1.6" fill="none"/><circle cx="${X(xs[k - 1])}" cy="${Y(Y_[k - 1])}" r="3.6" fill="${col}"/>`;
    host.innerHTML = svgOpen(W, H) + fr.svg + path(ys, 'var(--c0)') + (ys2 ? path(ys2, 'var(--c1)') : '') + `<text x="${W - PAD.r - 6}" y="${PAD.t + 14}" text-anchor="end" style="font:600 11.5px var(--f-mono)" fill="var(--muted)">frame ${k} / ${N}</text></svg>`;
    c.say(`import numpy as np, matplotlib.pyplot as plt\nfrom matplotlib.animation import FuncAnimation\n\nx = np.linspace(${d.x[0]}, ${d.x[1]}, ${N})\n${d.code}\nfig, ax = plt.subplots()\nax.set_xlim(x.min(), x.max()); ax.set_ylim(y${d.g ? '1' : ''}.min() - 0.1, y${d.g ? '1' : ''}.max() + 0.1)\nline, = ax.plot([], [])\n\ndef update(frame):                       <span class="g"># called once per frame: 0, 1, 2, ...</span>\n    line.set_data(x[:frame], y[:frame])   <span class="g"># reveal the first 'frame' points  (now: ${k})</span>\n    return line,\n\nani = FuncAnimation(fig, update, frames=${N}, interval=30)   <span class="g"># 30 ms per frame</span>\nani.save("curve.gif")                    <span class="g"># in a notebook: HTML(ani.to_jshtml())</span>\n<span class="g"># ${esc(d.t)}: the picture is a stack of ${N} ordinary plots shown one after another. Drag the scrubber to jump to any frame.</span>`);
  }
  function tick(ts) { raf = requestAnimationFrame(tick); if (!playing) return; if (ts - last > 30 / speed) { last = ts; frame += 1; if (frame >= N) frame = 1; sl.value = frame; draw(); } }
  c.select('curve', Object.entries(DATA).map(([k, v]) => [k, v.t]), kind, v => { kind = v; frame = 1; draw(); });
  const sl = c.slider('frame', 1, N, 1, frame, v => { playing = false; pb.textContent = 'Play'; frame = v; draw(); }); c.slider('speed', .25, 4, .25, 1, v => { speed = v; }, v => v + 'x');
  const pb = c.button('Pause', () => { playing = !playing; pb.textContent = playing ? 'Pause' : 'Play'; }); const gb = c.button('Grid: on', () => { grid = !grid; gb.textContent = 'Grid: ' + (grid ? 'on' : 'off'); draw(); });
  frame = 1; draw(); raf = requestAnimationFrame(tick);
};
