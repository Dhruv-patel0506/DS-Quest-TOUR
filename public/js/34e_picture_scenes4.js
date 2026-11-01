'use strict';
/* =====================================================================
   Picture Class scenes, part 5: groupby (rows fall into piles and are summed), join (two tables matched on a key), classify (decision regions you can click),
   anatomy (the parts of a matplotlib figure, click one to see its code) and chart (bar, pie, box and stacked charts).
   ===================================================================== */
(function (M) {
  /* a plain k-nearest-neighbours vote and a logistic probability, the same maths the lessons check against scikit-learn */
  M.knn = (pts, x, y, k) => { const d = pts.map(p => ({ d: (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y), c: p[2], p })).sort((a, b) => a.d - b.d).slice(0, k), n1 = d.filter(q => q.c === 1).length; return { p1: n1 / k, label: n1 * 2 > k ? 1 : 0, near: d.map(q => q.p) }; };
  M.sigmoid = z => 1 / (1 + Math.exp(-z));
  M.agg = { sum: a => a.reduce((x, y) => x + y, 0), mean: a => a.reduce((x, y) => x + y, 0) / a.length, count: a => a.length, max: a => Math.max.apply(null, a), min: a => Math.min.apply(null, a) };
  /* merge two tables on a key; how = inner | left | right | outer. Rows are arrays; returns { cols, rows } */
  M.join = (L, R, li, ri, how) => {
    const rows = [], usedR = new Set(), cols = L.cols.concat(R.cols.filter((_, j) => j !== ri));
    L.rows.forEach(lr => { const ms = R.rows.map((r, j) => [r, j]).filter(q => q[0][ri] === lr[li]); if (ms.length) ms.forEach(q => { usedR.add(q[1]); rows.push({ cells: lr.concat(q[0].filter((_, j) => j !== ri)), kind: 'both', l: lr, r: q[0] }); }); else if (how === 'left' || how === 'outer') rows.push({ cells: lr.concat(R.cols.filter((_, j) => j !== ri).map(() => 'NaN')), kind: 'left_only', l: lr }); });
    if (how === 'right' || how === 'outer') R.rows.forEach((r, j) => { if (!usedR.has(j)) rows.push({ cells: L.cols.map((_, c) => (c === li ? r[ri] : 'NaN')).concat(r.filter((_, c) => c !== ri)), kind: 'right_only', r }); });
    return { cols, rows };
  };
})(PIC.math);

/* ---------------------------------------------------------------------------------------------
   Scene: groupby. spec: { cols, rows, key, val, agg, cap }  (key and val are column numbers)
   --------------------------------------------------------------------------------------------- */
PIC.scenes.groupby = (stage, sp, ctx) => {
  const rows = sp.rows, cols = sp.cols, key = sp.key, val = sp.val, M = PIC.math; let agg = sp.agg || 'sum';
  const keys = [...new Set(rows.map(r => r[key]))].sort(), col = k => pc3.col[keys.indexOf(k) % 5];
  stage.innerHTML = `<div class="gb"><div class="gb-src"><div class="gb-h">the table</div>${rows.map((r, i) => `<div class="gb-row" data-i="${i}" style="--k:${col(r[key])}" title="row ${i}: ${picEsc(r.join(', '))}">${r.map((v, j) => `<span class="${j === key ? 'gb-key' : j === val ? 'gb-val' : ''}">${picEsc(v)}</span>`).join('')}</div>`).join('')}</div><div class="gb-arrow">&rarr;</div><div class="gb-piles">${keys.map(k => `<div class="gb-pile" data-k="${picEsc(k)}" style="--k:${col(k)}"><div class="gb-ph">${picEsc(cols[key])} = ${picEsc(k)}</div><div class="gb-items"></div><div class="gb-res"></div></div>`).join('')}</div></div><div class="pc3-try"><b>Summarise each pile with</b> ${['sum', 'mean', 'count', 'max', 'min'].map(a => `<button type="button" class="btn sm gb-a${a === agg ? ' primary' : ''}" data-a="${a}">${a}</button>`).join('')}</div><div class="pc-formula"></div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}<button type="button" class="btn sm pc-replay" hidden>&#8635; Replay</button>`;
  const note = stage.querySelector('.pc-formula'), replay = stage.querySelector('.pc-replay'), piles = {}; stage.querySelectorAll('.gb-pile').forEach(p => { piles[p.dataset.k] = p; });
  const show = () => { keys.forEach(k => { const vs = rows.filter(r => r[key] === k).map(r => r[val]), v = M.agg[agg](vs), r = piles[k].querySelector('.gb-res'); r.innerHTML = `<b>${agg}</b> = ${pc3.f(Math.round(v * 100) / 100)}`; r.classList.add('on'); }); note.innerHTML = `<b>df.groupby("${picEsc(cols[key])}")["${picEsc(cols[val])}"].${agg}()</b> &rarr; one number per pile`; };
  const go = () => {
    replay.hidden = true; note.innerHTML = 'split: every row goes to the pile of its key'; stage.querySelectorAll('.gb-items').forEach(e => { e.innerHTML = ''; }); stage.querySelectorAll('.gb-res').forEach(e => { e.innerHTML = ''; e.classList.remove('on'); });
    rows.forEach((r, i) => ctx.wait(500 + i * 260, () => { const src = stage.querySelector(`.gb-row[data-i="${i}"]`); src.classList.add('moved'); const c = document.createElement('span'); c.className = 'gb-chip'; c.textContent = pc3.f(r[val]); c.title = r.join(', '); piles[r[key]].querySelector('.gb-items').appendChild(c); }));
    ctx.wait(700 + rows.length * 260, () => { show(); replay.hidden = false; });
  };
  stage.querySelectorAll('.gb-a').forEach(b => { b.onclick = () => { agg = b.dataset.a; stage.querySelectorAll('.gb-a').forEach(x => x.classList.toggle('primary', x === b)); ctx.cancel(); rows.forEach((r, i) => { stage.querySelector(`.gb-row[data-i="${i}"]`).classList.add('moved'); }); stage.querySelectorAll('.gb-items').forEach(e => { e.innerHTML = ''; }); rows.forEach(r => { const c = document.createElement('span'); c.className = 'gb-chip'; c.textContent = pc3.f(r[val]); piles[r[key]].querySelector('.gb-items').appendChild(c); }); show(); replay.hidden = false; }; });
  replay.onclick = () => { stage.querySelectorAll('.gb-row').forEach(e => e.classList.remove('moved')); go(); }; go();
};

/* ---------------------------------------------------------------------------------------------
   Scene: join. spec: { left: { name, cols, rows }, right: { name, cols, rows }, on: [leftCol, rightCol], how, cap }
   --------------------------------------------------------------------------------------------- */
PIC.scenes.join = (stage, sp, ctx) => {
  const M = PIC.math, L = sp.left, R = sp.right, li = sp.on[0], ri = sp.on[1]; let how = sp.how || 'inner';
  const keys = [...new Set(L.rows.map(r => r[li]).concat(R.rows.map(r => r[ri])))], col = k => pc3.col[keys.indexOf(k) % 5];
  const tbl = (T, ki) => `<div class="jn-t"><div class="jn-name">${picEsc(T.name)}</div><div class="jn-r jn-hd">${T.cols.map((c, j) => `<span class="${j === ki ? 'jn-key' : ''}">${picEsc(c)}</span>`).join('')}</div>${T.rows.map((r, i) => `<div class="jn-r" data-k="${picEsc(r[ki])}" style="--k:${col(r[ki])}">${r.map((v, j) => `<span class="${j === ki ? 'jn-key' : ''}">${picEsc(v)}</span>`).join('')}</div>`).join('')}</div>`;
  const render = () => {
    const res = M.join(L, R, li, ri, how), cnt = { both: 0, left_only: 0, right_only: 0 }; res.rows.forEach(r => cnt[r.kind]++);
    stage.innerHTML = `<div class="jn"><div class="jn-top">${tbl(L, li)}${tbl(R, ri)}</div><div class="jn-out"><div class="jn-name">result: <code>merge(..., how="${how}")</code></div><div class="jn-r jn-hd">${res.cols.map(c => `<span>${picEsc(c)}</span>`).join('')}</div>${res.rows.map((r, i) => `<div class="jn-r jn-res ${r.kind}" style="--k:${col((r.l || r.r)[r.l ? li : ri])};animation-delay:${i * 120}ms" title="${r.kind === 'both' ? 'key found in both tables' : r.kind === 'left_only' ? 'only in the left table' : 'only in the right table'}">${r.cells.map(v => `<span class="${v === 'NaN' ? 'jn-nan' : ''}">${picEsc(v)}</span>`).join('')}</div>`).join('')}</div></div><div class="pc3-try"><b>how =</b> ${['inner', 'left', 'right', 'outer'].map(a => `<button type="button" class="btn sm jn-b${a === how ? ' primary' : ''}" data-h="${a}">${a}</button>`).join('')}</div><div class="pc-formula">${res.rows.length} row${res.rows.length === 1 ? '' : 's'}: ${cnt.both} matched${cnt.left_only ? ', ' + cnt.left_only + ' only on the left (NaN on the right)' : ''}${cnt.right_only ? ', ' + cnt.right_only + ' only on the right (NaN on the left)' : ''}</div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}`;
    stage.querySelectorAll('.jn-b').forEach(b => { b.onclick = () => { how = b.dataset.h; render(); }; });
    stage.querySelectorAll('.jn-t .jn-r[data-k]').forEach(r => { r.onmouseenter = () => stage.querySelectorAll(`.jn-r[data-k="${CSS.escape(r.dataset.k)}"]`).forEach(e => e.classList.add('hot')); r.onmouseleave = () => stage.querySelectorAll('.jn-r.hot').forEach(e => e.classList.remove('hot')); });
  };
  render();
};

/* ---------------------------------------------------------------------------------------------
   Scene: classify. Two groups of dots; the background shows what a model would say at every spot. Click to ask it about a new point.
   spec: { pts: [[x, y, 0|1]], model: 'knn' | 'logistic', k, coef: [a, b], intercept, xr, yr, cap }
   --------------------------------------------------------------------------------------------- */
PIC.scenes.classify = (stage, sp, ctx) => {
  const M = PIC.math, W = 560, H = 330, xr = sp.xr, yr = sp.yr, F = pc3.frame(W, H, 46, 14, 14, 36, xr, yr, { xt: sp.xt, yt: sp.yt }), sx = F.sx, sy = F.sy, pts = sp.pts; let k = sp.k || 3;
  const prob = (x, y) => (sp.model === 'knn' ? M.knn(pts, x, y, k).p1 : M.sigmoid(sp.coef[0] * x + sp.coef[1] * y + sp.intercept)), NX = 46, NY = 30;
  let cells = ''; if (sp.model) for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) { const x = xr[0] + (i + .5) / NX * (xr[1] - xr[0]), y = yr[0] + (j + .5) / NY * (yr[1] - yr[0]), p = prob(x, y); cells += `<rect x="${sx(xr[0] + i / NX * (xr[1] - xr[0]))}" y="${sy(yr[0] + (j + 1) / NY * (yr[1] - yr[0]))}" width="${(W - 60) / NX + .6}" height="${(H - 50) / NY + .6}" style="fill:${p >= .5 ? pc3.col[1] : pc3.col[0]};fill-opacity:${(.08 + Math.abs(p - .5) * .5).toFixed(2)}"/>`; }
  stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="pc-svg" role="img" aria-label="decision regions of a classifier; click to ask about a new point">${F.svg}${pc3.labels(W, H, sp.xlab, sp.ylab)}<g>${cells}</g><g class="cf-lines"></g><g>${pts.map(p => `<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="5.5" class="cl-p" style="fill:${pc3.col[p[2] === 1 ? 1 : 0]}"><title>(${p[0]}, ${p[1]}) class ${p[2]}</title></circle>`).join('')}</g><g class="cf-new"></g></svg>${sp.model === 'knn' ? `<div class="pc3-try"><b>Neighbours that vote (k)</b> <input type="range" class="cf-k" min="1" max="15" step="2" value="${k}"> <span class="cf-kv">k = ${k}</span></div>` : ''}<div class="pc-formula">${!sp.model ? 'two groups of dots, and no model yet' : sp.model === 'knn' ? 'k-nearest neighbours: every spot takes the majority colour of its ' + k + ' closest dots. <b>Click the picture</b> to ask about a new point.' : 'logistic regression: one straight boundary; the colour fades near it where the model is unsure. <b>Click the picture</b> to ask about a new point.'}</div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}`;
  const svg = stage.querySelector('svg'), nw = stage.querySelector('.cf-new'), lines = stage.querySelector('.cf-lines'), note = stage.querySelector('.pc-formula'); svg.style.cursor = sp.model ? 'crosshair' : 'default';
  svg.addEventListener('click', e => { const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * W, vy = (e.clientY - r.top) / r.height * H, x = xr[0] + (vx - 46) / (W - 60) * (xr[1] - xr[0]), y = yr[0] + (H - 36 - vy) / (H - 50) * (yr[1] - yr[0]); if (!sp.model || x < xr[0] || x > xr[1] || y < yr[0] || y > yr[1]) return; const p = prob(x, y); nw.innerHTML = `<circle cx="${sx(x)}" cy="${sy(y)}" r="8" style="fill:#fff;stroke:${p >= .5 ? pc3.col[1] : pc3.col[0]};stroke-width:4"/>`; lines.innerHTML = sp.model === 'knn' ? M.knn(pts, x, y, k).near.map(q => `<line x1="${sx(x)}" y1="${sy(y)}" x2="${sx(q[0])}" y2="${sy(q[1])}" class="cl-tr" style="stroke:${pc3.col[q[2] === 1 ? 1 : 0]}"/>`).join('') : ''; note.innerHTML = `new point (${x.toFixed(1)}, ${y.toFixed(1)}): the model says <b>class ${p >= .5 ? 1 : 0}</b> with probability <b>${(p >= .5 ? p : 1 - p).toFixed(2)}</b>` + (sp.model === 'knn' ? ' (the dashed lines go to the ' + k + ' voters)' : ''); });
  const sl = stage.querySelector('.cf-k'); if (sl) sl.oninput = e => { ctx.cancel(); stage.innerHTML = ''; PIC.scenes.classify(stage, Object.assign({}, sp, { k: +e.target.value }), ctx); };
};

/* ---------------------------------------------------------------------------------------------
   Scene: anatomy. A matplotlib figure with numbered parts. Hover or click a part to see its name and the line of code that makes it.
   spec: { parts: [{ id, name, code, say }] }   (ids: figure, axes, title, xlabel, ylabel, legend, ticks, grid, line, spine)
   --------------------------------------------------------------------------------------------- */
PIC.scenes.anatomy = (stage, sp, ctx) => {
  const W = 560, H = 340, parts = sp.parts, P = {
    figure: [8, 8, 544, 324, 'rect'], axes: [64, 40, 464, 232, 'rect'], title: [296, 28, 0, 0, 'pt'], xlabel: [296, 322, 0, 0, 'pt'], ylabel: [18, 156, 0, 0, 'pt'], legend: [440, 62, 0, 0, 'pt'], ticks: [150, 290, 0, 0, 'pt'], grid: [200, 110, 0, 0, 'pt'], line: [260, 150, 0, 0, 'pt'], spine: [64, 272, 0, 0, 'pt'],
  };
  const xs = [0, 1, 2, 3, 4, 5].map(i => 64 + 40 + i * 76), ys = [210, 180, 190, 130, 100, 70];
  stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="pc-svg an-svg" role="img" aria-label="the parts of a matplotlib figure"><rect class="an-fig" x="8" y="8" width="544" height="324" rx="10"/><rect class="an-ax" x="64" y="40" width="464" height="232"/>${[0, 1, 2, 3, 4].map(i => `<line class="pc-g" x1="${64 + i * 116}" x2="${64 + i * 116}" y1="40" y2="272"/>`).join('')}${[0, 1, 2, 3].map(i => `<line class="pc-g" y1="${40 + i * 77}" y2="${40 + i * 77}" x1="64" x2="528"/>`).join('')}<path class="an-line" d="${xs.map((x, i) => (i ? 'L' : 'M') + x + ' ' + ys[i]).join('')}"/>${xs.map((x, i) => `<circle cx="${x}" cy="${ys[i]}" r="4" class="rg-p"/>`).join('')}<line class="an-spine" x1="64" y1="272" x2="528" y2="272"/><line class="an-spine" x1="64" y1="40" x2="64" y2="272"/>${[0, 1, 2, 3, 4, 5].map(i => `<text class="pc-t" x="${xs[i]}" y="288" text-anchor="middle">${i + 1}</text>`).join('')}<text class="an-tt" x="296" y="30" text-anchor="middle">Monthly sales</text><text class="pc-lab" x="296" y="324" text-anchor="middle">Month</text><text class="pc-lab" x="22" y="156" transform="rotate(-90 22 156)" text-anchor="middle">Sales</text><rect x="420" y="50" width="100" height="26" rx="5" class="an-leg"/><line x1="428" x2="450" y1="63" y2="63" class="an-line"/><text x="456" y="67" class="pc-t">2026</text>${parts.map((p, i) => { const c = P[p.id]; return `<g class="an-pin" data-i="${i}" tabindex="0" role="button" aria-label="${picEsc(p.name)}"><circle cx="${c[0]}" cy="${c[1]}" r="11"/><text x="${c[0]}" y="${c[1] + 4}" text-anchor="middle">${i + 1}</text></g>`; }).join('')}</svg><div class="an-card"><b>Hover or click a numbered pin</b></div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}`;
  const card = stage.querySelector('.an-card'), pins = [...stage.querySelectorAll('.an-pin')];
  const pick = i => { pins.forEach((e, j) => e.classList.toggle('on', i === j)); const p = parts[i]; card.innerHTML = `<b>${i + 1}. ${picEsc(p.name)}</b> &nbsp;<code>${picEsc(p.code)}</code><br>${p.say || ''}`; };
  pins.forEach((e, i) => { e.onmouseenter = () => pick(i); e.onclick = () => pick(i); e.onfocus = () => pick(i); e.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') pick(i); }; }); pick(sp.start || 0);
};

/* ---------------------------------------------------------------------------------------------
   Scene: chart. spec: { kind: 'pie' | 'box' | 'hbar' | 'stacked', labels, values | series, title, cap }
   --------------------------------------------------------------------------------------------- */
PIC.scenes.chart = (stage, sp, ctx) => {
  const W = 560, H = 330, M = PIC.math; let body = '';
  if (sp.kind === 'pie') {
    const tot = sp.values.reduce((a, b) => a + b, 0), cx = 190, cy = 170, R = 120; let a0 = -Math.PI / 2;
    body = sp.values.map((v, i) => { const a1 = a0 + v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, d = `M${cx} ${cy} L${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A${R} ${R} 0 ${big} 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)} Z`, mid = (a0 + a1) / 2; a0 = a1; return `<path class="ch-sl" d="${d}" style="fill:${pc3.col[i % 5]}"><title>${picEsc(sp.labels[i])}: ${v} (${Math.round(v / tot * 100)}%)</title></path><text x="${cx + R * .62 * Math.cos(mid)}" y="${cy + R * .62 * Math.sin(mid) + 4}" text-anchor="middle" class="ch-pct">${Math.round(v / tot * 100)}%</text>`; }).join('') + sp.labels.map((l, i) => `<g transform="translate(340,${90 + i * 28})"><rect width="14" height="14" rx="3" style="fill:${pc3.col[i % 5]}"/><text x="22" y="12" class="pc-t" style="font-size:13px">${picEsc(l)} (${sp.values[i]})</text></g>`).join('');
  } else if (sp.kind === 'box') {
    const all = [].concat.apply([], sp.series), lo = Math.min.apply(null, all) - 2, hi = Math.max.apply(null, all) + 2, F = pc3.frame(W, H, 46, 14, 14, 40, [0, sp.series.length], [Math.floor(lo), Math.ceil(hi)], { xt: 1 }), q = (a, p) => { const s = a.slice().sort((x, y) => x - y), i = (s.length - 1) * p, f = Math.floor(i); return s[f] + (s[Math.min(f + 1, s.length - 1)] - s[f]) * (i - f); };
    body = F.svg + sp.series.map((a, i) => { const q1 = q(a, .25), q2 = q(a, .5), q3 = q(a, .75), iqr = q3 - q1, wl = Math.min.apply(null, a.filter(v => v >= q1 - 1.5 * iqr)), wh = Math.max.apply(null, a.filter(v => v <= q3 + 1.5 * iqr)), x = F.sx(i + .5), w = 52, out = a.filter(v => v < wl || v > wh); return `<g class="ch-box" style="--c:${pc3.col[i % 5]}"><title>${picEsc(sp.labels[i])}: median ${pc3.f(+q2.toFixed(2))}, Q1 ${pc3.f(+q1.toFixed(2))}, Q3 ${pc3.f(+q3.toFixed(2))}</title><line x1="${x}" x2="${x}" y1="${F.sy(wh)}" y2="${F.sy(wl)}" class="ch-wh"/><rect x="${x - w / 2}" y="${F.sy(q3)}" width="${w}" height="${F.sy(q1) - F.sy(q3)}" class="ch-bx"/><line x1="${x - w / 2}" x2="${x + w / 2}" y1="${F.sy(q2)}" y2="${F.sy(q2)}" class="ch-md"/>${out.map(v => `<circle cx="${x}" cy="${F.sy(v)}" r="4" class="ch-out"/>`).join('')}<text x="${x}" y="${H - 20}" text-anchor="middle" class="pc-lab">${picEsc(sp.labels[i])}</text></g>`; }).join('');
  } else if (sp.kind === 'hbar') {
    const mx = Math.max.apply(null, sp.values) * 1.1;
    body = sp.values.map((v, i) => `<g><text x="130" y="${52 + i * 44}" text-anchor="end" class="pc-lab">${picEsc(sp.labels[i])}</text><rect class="ch-hb" x="140" y="${34 + i * 44}" width="${(v / mx) * 390}" height="28" rx="5" style="fill:${pc3.col[0]}"><title>${picEsc(sp.labels[i])}: ${v}</title></rect><text x="${146 + (v / mx) * 390}" y="${53 + i * 44}" class="pc-t" style="font-size:12px">${v}</text></g>`).join('');
  } else {
    const tot = sp.series[0].map((_, j) => sp.series.reduce((a, s) => a + s[j], 0)), mx = Math.max.apply(null, tot) * 1.1, F = pc3.frame(W, H, 46, 14, 14, 40, [0, sp.labels.length], [0, mx], { xt: 1 });
    body = F.svg + sp.labels.map((l, j) => { let acc = 0; const x = F.sx(j + .5), w = 56; return sp.series.map((s, i) => { const y0 = acc; acc += s[j]; return `<rect x="${x - w / 2}" y="${F.sy(acc)}" width="${w}" height="${F.sy(y0) - F.sy(acc)}" style="fill:${pc3.col[i % 5]}" class="ch-st"><title>${picEsc(sp.names[i])} in ${picEsc(l)}: ${s[j]}</title></rect>`; }).join('') + `<text x="${x}" y="${H - 20}" text-anchor="middle" class="pc-lab">${picEsc(l)}</text>`; }).join('') + sp.names.map((n, i) => `<g transform="translate(${60 + i * 120},10)"><rect width="12" height="12" rx="3" style="fill:${pc3.col[i % 5]}"/><text x="18" y="11" class="pc-t" style="font-size:12px">${picEsc(n)}</text></g>`).join('');
  }
  stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="pc-svg" role="img" aria-label="${picEsc(sp.title || 'chart')}">${sp.title ? `<text x="${W / 2}" y="18" text-anchor="middle" class="pc-title">${picEsc(sp.title)}</text>` : ''}${body}</svg><div class="pc-formula">${sp.note || 'hover a part of the chart for its value'}</div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}`;
};
