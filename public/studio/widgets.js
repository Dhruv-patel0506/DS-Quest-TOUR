'use strict';
/* Animated visual widgets. Each one works out its picture in the page (so it answers instantly while you drag a slider)
   and has a "check with real NumPy" button that runs the same thing in the real Python engine and says whether the two agree. */
const NP = 'import numpy as np';
const wShell = (title, ctls, stage) => h('div', { class: 'widget' }, h('div', { class: 'w-head' }, '🧪 ' + title, h('span', { class: 'pill' }, 'LIVE')), h('div', { class: 'w-body' }, h('div', { class: 'w-ctl' }, ctls), h('div', { class: 'w-stage' }, stage)));
const shp = s => '(' + s.join(', ') + (s.length === 1 ? ',' : '') + ')';
const fmtN = v => (Number.isInteger(v) ? String(v) : String(+v.toFixed(4)));
function gridHost(rows, o) { return gridOf(rows, o); }
function cellsOf(g) { return $$('.cell:not(.hdr)', g); }
function checkBtn(getCode, getJs, resultVar, onNote) {
  const note = h('div', { class: 'w-note' }, 'Press the button to run the same thing in real NumPy and compare.');
  const btn = h('button', { class: 'btn ghost', type: 'button', onclick: async () => {
    note.className = 'w-note'; note.textContent = 'Running in real NumPy…'; const res = await runPy(getCode(), [resultVar], NP);
    if (res.error) { const want = getJs(); if (want && want.error) { note.className = 'w-note ok'; note.innerHTML = `✓ Real NumPy also refuses: <code>${esc(res.error.type)}: ${esc(res.error.msg)}</code>`; } else { note.className = 'w-note bad'; note.innerHTML = `Real NumPy said <code>${esc(res.error.type + ': ' + res.error.msg)}</code>`; } return; }
    const want = getJs(); if (want && want.error) { note.className = 'w-note bad'; note.textContent = 'This picture says it should fail, but NumPy computed it. Please report this.'; return; }
    const got = res.vars[resultVar]; const a = JSON.stringify(got.v), b = JSON.stringify(want.rows); const same = a === b || (got.k === 'sc' && fmtN(got.v) === fmtN(want.rows));
    note.className = 'w-note ' + (same ? 'ok' : 'bad'); note.innerHTML = same ? `✓ Real NumPy agrees: result ${got.shape ? 'shape ' + shp(got.shape) : 'is ' + esc(fmtV(got.v))}.` : `The picture and real NumPy disagree. NumPy: <code>${esc(a.slice(0, 120))}</code>`;
  } }, '✔ Check with real NumPy');
  return [btn, note];
}

/* ---- slicing: a[start:stop:step, start:stop:step] ---- */
const pySlice = (n, start, stop, step) => {
  if (step === 0) step = 1; const out = [];
  if (step > 0) { let s = start === null ? 0 : start < 0 ? Math.max(start + n, 0) : Math.min(start, n), e = stop === null ? n : stop < 0 ? Math.max(stop + n, 0) : Math.min(stop, n); for (let i = s; i < e; i += step) out.push(i); }
  else { let s = start === null ? n - 1 : start < 0 ? Math.max(start + n, -1) : Math.min(start, n - 1), e = stop === null ? -1 : stop < 0 ? Math.max(stop + n, -1) : Math.min(stop, n - 1); for (let i = s; i > e; i += step) out.push(i); }
  return out;
};
WIDGETS.slice = b => {
  const R = b.rows || 6, C = b.cols || 8, data = Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => r * C + c));
  const mk = (id, label, min, max, value, step) => control({ id, type: 'range', label, min, max, value, step: step || 1 }, upd);
  const rs = mk('rs', 'rows: start', -R, R, 1), re = mk('re', 'rows: stop', -R, R, R - 1), rt = mk('rt', 'rows: step', -3, 3, 1);
  const cs = mk('cs', 'cols: start', -C, C, 0), ce = mk('ce', 'cols: stop', -C, C, C), ct = mk('ct', 'cols: step', -3, 3, 2);
  const om = ['rs', 're', 'cs', 'ce'].map(id => ({ id, k: control({ type: 'check', label: 'leave ' + { rs: 'row start', re: 'row stop', cs: 'col start', ce: 'col stop' }[id] + ' empty', value: false }, upd) }));
  const eq = h('div', { class: 'w-eq' }), note = h('div', { class: 'w-note' }), stage = h('div', { class: 'w-row' }), resHost = h('div', {});
  const g = gridHost(data, { rowHdr: true, colHdr: true }); stage.append(h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('b', {}, 'a'), h('span', { class: 'meta' }, `shape ${shp([R, C])} · int64`)), g), h('div', { class: 'op' }, '→'), resHost);
  let cur = null;
  function upd() {
    const o = id => (om.find(x => x.id === id).k.get() ? null : { rs, re, cs, ce }[id].get());
    const st = { r: [o('rs'), o('re'), rt.get() || 1], c: [o('cs'), o('ce'), ct.get() || 1] };
    const ri = pySlice(R, ...st.r), ci = pySlice(C, ...st.c), fm = x => (x === null ? '' : x);
    const txt = (s, last) => `${fm(s[0])}:${fm(s[1])}` + (s[2] !== 1 ? ':' + s[2] : '');
    const expr = `a[${txt(st.r)}, ${txt(st.c)}]`; eq.innerHTML = `<b>${esc(expr)}</b>`;
    const hiR = new Set(ri), hiC = new Set(ci); cellsOf(g).forEach(c => { const on = hiR.has(+c.dataset.r) && hiC.has(+c.dataset.c); c.classList.toggle('hi', on); c.classList.toggle('dim', !on); });
    const rows = ri.map(r => ci.map(c => data[r][c])); cur = { rows, expr, shape: [ri.length, ci.length], st };
    resHost.innerHTML = ''; if (ri.length && ci.length) resHost.append(h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('b', {}, 'result'), h('span', { class: 'meta' }, 'shape ' + shp([ri.length, ci.length]))), gridHost(rows, { rowHdr: false, colHdr: false })));
    else resHost.append(h('div', { class: 'w-note bad' }, 'Empty result: shape ' + shp([ri.length, ci.length]) + '. The slice selects nothing (check the direction of the step).'));
    note.innerHTML = `Rows picked: <b>${ri.length ? ri.join(', ') : 'none'}</b> · columns picked: <b>${ci.length ? ci.join(', ') : 'none'}</b>. A slice is a <b>view</b>: it shows the same memory, it does not copy it.`;
  }
  const chk = checkBtn(() => `a = np.arange(${R * C}).reshape(${R}, ${C})\nresult = ${cur.expr}`, () => cur, 'result');
  const w = wShell(b.title || 'Slicing lab: a[start:stop:step, start:stop:step]', [rs, re, rt, ...om.slice(0, 2).map(x => x.k), cs, ce, ct, ...om.slice(2).map(x => x.k)], [eq, stage, note, ...chk]);
  setTimeout(upd, 0); return w;
};

/* ---- broadcasting ---- */
const bShapes = [[[3, 4], '(3, 4)'], [[3, 1], '(3, 1)'], [[1, 4], '(1, 4)'], [[4], '(4,)'], [[3], '(3,)'], [[], '() a single number'], [[2, 3, 1], '(2, 3, 1)']];
function bcast(a, b) { const n = Math.max(a.length, b.length), A = [...Array(n - a.length).fill(1), ...a], B = [...Array(n - b.length).fill(1), ...b]; const out = []; for (let i = 0; i < n; i++) { if (A[i] === B[i] || B[i] === 1) out.push(A[i]); else if (A[i] === 1) out.push(B[i]); else return { error: `operands could not be broadcast together with shapes ${shp2(a)} ${shp2(b)}`, A, B }; } return { shape: out, A, B }; }
const shp2 = s => '(' + s.join(',') + (s.length === 1 ? ',' : '') + ')';
WIDGETS.broadcast = b => {
  const selA = control({ type: 'select', label: 'shape of a', options: bShapes.map(([s, l], i) => [i, l]), value: 0 }, upd), selB = control({ type: 'select', label: 'shape of b', options: bShapes.map(([s, l], i) => [i, l]), value: 3 }, upd);
  const stage = h('div', { class: 'w-stage' }), note = h('div', { class: 'w-note' }), eq = h('div', { class: 'w-eq' });
  let phase = 2, cur = null, timer = null;
  const make = (shape, base, step) => { const rows = shape.length === 0 ? [[base]] : shape.length === 1 ? [Array.from({ length: shape[0] }, (_, i) => base + i * step)] : shape.length === 2 ? Array.from({ length: shape[0] }, (_, r) => Array.from({ length: shape[1] }, (_, c) => base + (r * shape[1] + c) * step)) : null; return rows; };
  const to2 = (shape) => (shape.length <= 2 ? shape : [shape[0] * shape[1], shape[2]]);
  function draw() {
    stage.innerHTML = ''; const sa = bShapes[+selA.get()][0], sb = bShapes[+selB.get()][0], br = bcast(sa, sb); cur = { sa, sb, br };
    eq.innerHTML = `a.shape = <b>${shp(sa)}</b> &nbsp; b.shape = <b>${shp(sb)}</b> &nbsp; → &nbsp; ${br.error ? '<b style="color:var(--bad)">error</b>' : 'result shape <b>' + shp(br.shape) + '</b>'}`;
    const rule = h('div', { class: 'w-row' }, ['a', 'b'].map((n, i) => { const arr = i ? br.B : br.A; return h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('b', {}, n + ' (aligned from the right)')), h('div', { class: 'w-eq' }, arr.map((d, j) => { const other = (i ? br.A : br.B)[j]; const bad = d !== other && d !== 1 && other !== 1; return h('span', { style: { color: bad ? 'var(--bad)' : d === 1 && other !== 1 ? 'var(--accent-2)' : 'inherit', fontWeight: 700, margin: '0 6px' } }, String(d)); }))); }));
    stage.append(rule);
    if (br.error) { stage.append(h('div', { class: 'w-note bad' }, `ValueError: ${br.error}`), h('div', { class: 'w-note' }, 'Compare the shapes from the RIGHT: each pair must be equal, or one of them must be 1. Here one pair is different and neither is 1.')); note.textContent = ''; return; }
    if (br.shape.length > 2) { stage.append(h('div', { class: 'w-note' }, `This pair gives shape ${shp(br.shape)}. Each size-1 side is stretched to match the other (the picture is drawn for 1-D and 2-D shapes).`)); return; }
    const out = br.shape, rr = out.length === 1 ? 1 : out[0], cc = out[out.length - 1];
    const aRows = make(sa, 1, 1), bRows = make(sb, 10, 10); const A2 = aRows, B2 = bRows;
    const stretch = (rows, shape) => { const r0 = rows.length, c0 = rows[0].length; const alignedRows = shape.length < 2 ? 1 : shape[0]; return Array.from({ length: rr }, (_, r) => Array.from({ length: cc }, (_, c) => ({ v: rows[alignedRows === 1 ? 0 : r][rows[0].length === 1 ? 0 : c], ghost: (alignedRows === 1 && r > 0) || (rows[0].length === 1 && c > 0) }))); };
    const sA = stretch(A2, sa), sB = stretch(B2, sb);
    const show = (cells, cap, ghost) => { const g = gridOf(cells.map(r => r.map(x => x.v))); cellsOf(g).forEach((c, i) => { const r = Math.floor(i / cc), cI = i % cc; if (ghost && cells[r][cI].ghost) c.classList.add('ghost-cell'); }); return h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('b', {}, cap)), g); };
    const res = sA.map((r, i) => r.map((x, j) => x.v + sB[i][j].v));
    cur.rows = out.length === 1 ? [res[0]].flat() : res; if (out.length === 1) cur.rows = res[0];
    const row = h('div', { class: 'w-row' });
    if (phase === 0) row.append(h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('b', {}, 'a'), h('span', { class: 'meta' }, shp(sa))), gridOf(A2)), h('div', { class: 'op' }, '+'), h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('b', {}, 'b'), h('span', { class: 'meta' }, shp(sb))), gridOf(B2)));
    else if (phase === 1) row.append(show(sA, 'a stretched (dashed = copies)', true), h('div', { class: 'op' }, '+'), show(sB, 'b stretched (dashed = copies)', true));
    else row.append(show(sA, 'a stretched', true), h('div', { class: 'op' }, '+'), show(sB, 'b stretched', true), h('div', { class: 'op' }, '='), (() => { const g = gridOf(res); cellsOf(g).forEach(c => c.classList.add('res')); return h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('b', {}, 'a + b'), h('span', { class: 'meta' }, shp(out))), g); })());
    stage.append(row); note.innerHTML = 'Nothing is really copied in memory: NumPy <b>pretends</b> the size-1 side is repeated. The dashed cells show the pretend copies.';
  }
  function upd() { draw(); }
  const steps = h('div', { class: 'chip-row' }, [['1 · the two arrays', 0], ['2 · stretch the 1s', 1], ['3 · add', 2]].map(([t, p]) => h('button', { class: 'btn ghost', type: 'button', onclick: () => { clearInterval(timer); phase = p; draw(); } }, t)), h('button', { class: 'btn', type: 'button', onclick: () => { clearInterval(timer); phase = 0; draw(); timer = setInterval(() => { phase++; if (phase > 2) { clearInterval(timer); return; } draw(); }, 1300); } }, '▶ Animate'));
  const chk = checkBtn(() => `a = np.arange(1, ${cur.sa.reduce((x, y) => x * y, 1) + 1}).reshape(${shp2(cur.sa)})\nb = np.arange(10, ${10 + 10 * cur.sb.reduce((x, y) => x * y, 1)}, 10).reshape(${shp2(cur.sb)})\nresult = a + b`, () => (cur.br.error ? { error: cur.br.error } : { rows: cur.rows }), 'result');
  const w = wShell(b.title || 'Broadcasting lab: what happens when shapes differ?', [selA, selB, h('div', { class: 'w-note' }, 'Rule: line the shapes up from the right. Each pair must be equal, or one of them must be 1.')], [eq, steps, stage, note, ...chk]);
  setTimeout(draw, 0); return w;
};

/* ---- reductions along an axis ---- */
const AXD = [[3, 1, 4, 1, 5], [9, 2, 6, 5, 3], [5, 8, 9, 7, 9], [3, 2, 3, 8, 4]];
WIDGETS.axis = b => {
  const fn = control({ type: 'select', label: 'function', options: ['sum', 'mean', 'max', 'min', 'argmax'], value: 'sum' }, upd), ax = control({ type: 'select', label: 'axis', options: [['None', 'None (everything)'], ['0', '0 (down the rows)'], ['1', '1 (across the columns)']], value: '0' }, upd), kd = control({ type: 'check', label: 'keepdims=True', value: false }, upd);
  const eq = h('div', { class: 'w-eq' }), stage = h('div', { class: 'w-row' }), note = h('div', { class: 'w-note' }); let cur = null;
  const F = { sum: a => a.reduce((x, y) => x + y, 0), mean: a => a.reduce((x, y) => x + y, 0) / a.length, max: a => Math.max(...a), min: a => Math.min(...a), argmax: a => a.indexOf(Math.max(...a)) };
  const pal = ['#2a78d6', '#eb6834', '#1baf7a', '#6250d6', '#eda100'];
  function upd() {
    const f = fn.get(), a = ax.get(), keep = kd.get(), R = AXD.length, C = AXD[0].length; stage.innerHTML = '';
    const g = gridOf(AXD, { rowHdr: true, colHdr: true }); let rows, groups;
    if (a === 'None') { const flat = AXD.flat(); rows = [[F[f](flat)]]; groups = [flat.map((_, i) => [Math.floor(i / C), i % C])]; }
    else if (a === '0') { rows = [Array.from({ length: C }, (_, c) => F[f](AXD.map(r => r[c])))]; groups = Array.from({ length: C }, (_, c) => AXD.map((_, r) => [r, c])); }
    else { rows = AXD.map(r => [F[f](r)]); groups = AXD.map((_, r) => Array.from({ length: C }, (_, c) => [r, c])); }
    cellsOf(g).forEach(c => { const r = +c.dataset.r, cc = +c.dataset.c; let gi = -1; groups.forEach((gr, i) => { if (gr.some(([x, y]) => x === r && y === cc)) gi = i; }); c.style.outline = `3px solid ${pal[gi % pal.length]}`; c.style.outlineOffset = '-2px'; c.style.background = `color-mix(in srgb, ${pal[gi % pal.length]} 16%, #fff)`; c.style.animationDelay = (gi * 120) + 'ms'; });
    const shapeOut = a === 'None' ? [] : a === '0' ? [C] : [R]; const outShape = keep ? (a === 'None' ? [1, 1] : a === '0' ? [1, C] : [R, 1]) : shapeOut;
    const disp = a === 'None' ? [[rows[0][0]]] : a === '0' ? (keep ? rows : rows) : (keep ? rows : [rows.map(r => r[0])]);
    const res = gridOf(disp); cellsOf(res).forEach((c, i) => { c.classList.add('res'); const col = pal[i % pal.length]; if (a !== 'None') c.style.outlineColor = col; });
    cur = { rows: a === 'None' ? (keep ? [[rows[0][0]]] : rows[0][0]) : a === '0' ? (keep ? rows : rows[0]) : (keep ? rows : rows.map(r => r[0])), a, f, keep };
    stage.append(h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('b', {}, 'a'), h('span', { class: 'meta' }, 'shape (4, 5)')), g), h('div', { class: 'op' }, '→'), h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('b', {}, 'result'), h('span', { class: 'meta' }, 'shape ' + shp(outShape.length || keep ? outShape : []).replace('()', '()'))), res));
    eq.innerHTML = `<b>np.${f}(a${a === 'None' ? '' : ', axis=' + a}${keep ? ', keepdims=True' : ''})</b>`;
    note.innerHTML = a === 'None' ? 'No axis: all 20 numbers are folded into one.' : a === '0' ? '<b>axis=0</b> walks <b>down</b> the rows. The 4 rows disappear and one result is left for each of the 5 columns (each colour is one group).' : '<b>axis=1</b> walks <b>across</b> the columns. The 5 columns disappear and one result is left for each of the 4 rows.';
  }
  const chk = checkBtn(() => `a = np.array(${JSON.stringify(AXD)})\nresult = np.${cur.f}(a${cur.a === 'None' ? '' : ', axis=' + cur.a}${cur.keep ? ', keepdims=True' : ''})`, () => cur, 'result');
  const w = wShell(b.title || 'Axis lab: np.sum(a, axis=…)', [fn, ax, kd], [eq, stage, note, ...chk]); setTimeout(upd, 0); return w;
};

/* ---- reshape ---- */
WIDGETS.reshape = b => {
  const N = 12, opts = ['(3, 4)', '(4, 3)', '(2, 6)', '(6, 2)', '(2, 2, 3)', '(-1, 4)', '(3, -1)', '(12,)', '(1, 12)', '(5, 3)'];
  const sh = control({ type: 'select', label: 'new shape', options: opts, value: '(3, 4)' }, upd), od = control({ type: 'select', label: "order", options: [['C', "'C' row by row (default)"], ['F', "'F' column by column"]], value: 'C' }, upd);
  const eq = h('div', { class: 'w-eq' }), stage = h('div', { class: 'w-stage' }), note = h('div', { class: 'w-note' }); let cur = null;
  const hue = i => `hsl(${i * 30},70%,86%)`;
  function upd() {
    stage.innerHTML = ''; const raw = JSON.parse(sh.get().replace(/\(/g, '[').replace(/\)/g, ']').replace(/,\s*]/, ']')); const order = od.get();
    const known = raw.filter(x => x !== -1).reduce((x, y) => x * y, 1), shape = raw.map(x => (x === -1 ? N / known : x));
    const flat = h('div', { class: 'grid-nd', style: { gridTemplateColumns: `repeat(${N},auto)` } }); for (let i = 0; i < N; i++) { const c = h('div', { class: 'cell', style: { '--i': i, '--c': hue(i) } }, String(i)); flat.append(c); }
    stage.append(h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('b', {}, 'a = np.arange(12)'), h('span', { class: 'meta' }, '(12,)')), flat));
    const total = shape.reduce((x, y) => x * y, 1);
    eq.innerHTML = `<b>a.reshape(${sh.get()}${order === 'F' ? ", order='F'" : ''})</b>`;
    if (Number.isInteger(shape.reduce((x, y) => x * y, 1)) && total === N && shape.every(Number.isInteger)) {
      const rows = []; const [R, Cc, D = 1] = shape.length === 1 ? [1, shape[0]] : shape.length === 2 ? shape : [shape[0], shape[1], shape[2]];
      const idx = (r, c, d) => (order === 'C' ? (r * Cc + c) * D + d : r + R * (c + Cc * d));
      const mk = d => Array.from({ length: R }, (_, r) => Array.from({ length: Cc }, (_, c) => idx(r, c, d)));
      const mats = shape.length === 3 ? Array.from({ length: shape[2] }, (_, d) => mk(d)) : [shape.length === 1 ? [mk(0)[0]] : mk(0)];
      // for 3-D shape (a,b,c) show a matrices of b x c
      let view;
      if (shape.length === 3) { const [A, B2, C2] = shape; const get = (a, b, c) => (order === 'C' ? (a * B2 + b) * C2 + c : a + A * (b + B2 * c)); view = h('div', { class: 'stack3' }, Array.from({ length: A }, (_, a) => h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('span', { class: 'meta' }, `[${a}]`)), (() => { const rowsA = Array.from({ length: B2 }, (_, bb) => Array.from({ length: C2 }, (_, c) => get(a, bb, c))); const g = gridOf(rowsA); cellsOf(g).forEach((c, i) => { c.style.setProperty('--c', hue(rowsA.flat()[i])); }); return g; })()))); cur = { shape, order, rows: Array.from({ length: A }, (_, a) => Array.from({ length: B2 }, (_, bb) => Array.from({ length: C2 }, (_, c) => get(a, bb, c)))) }; }
      else { const m = mats[0]; const g = gridOf(m, { rowHdr: true, colHdr: true }); cellsOf(g).forEach((c, i) => c.style.setProperty('--c', hue(m.flat()[i]))); view = h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('b', {}, 'result'), h('span', { class: 'meta' }, shp(shape))), g); cur = { shape, order, rows: shape.length === 1 ? m[0] : m }; }
      stage.append(h('div', { class: 'op', style: { transform: 'rotate(90deg)' } }, '→'), view);
      note.className = 'w-note'; note.innerHTML = order === 'C' ? 'Same 12 numbers, same order in memory, just a new way of cutting them up. <b>C order</b> fills each row before moving to the next row.' : '<b>F order</b> fills each column before moving to the next column, so the colours run downwards. Compare it with C order.'; if (raw.includes(-1)) note.innerHTML += ` The <code>-1</code> means: work this one out for me (here ${shape[raw.indexOf(-1)]}).`;
    } else { cur = { error: 1 }; stage.append(h('div', { class: 'w-note bad' }, `ValueError: cannot reshape array of size ${N} into shape ${sh.get()}`)); note.className = 'w-note'; note.innerHTML = `${raw.filter(x => x !== -1).join(' × ')}${raw.includes(-1) ? ' × ?' : ''} must multiply to exactly <b>12</b>: reshape never adds or removes numbers.`; }
  }
  const chk = checkBtn(() => `a = np.arange(12)\nresult = a.reshape(${sh.get()}${od.get() === 'F' ? ", order='F'" : ''})`, () => (cur.error ? { error: 1 } : { rows: cur.rows }), 'result');
  const w = wShell(b.title || 'Reshape lab: same numbers, new shape', [sh, od, h('div', { class: 'w-note' }, 'Each number keeps its colour, so you can follow where it goes.')], [eq, stage, note, ...chk]); setTimeout(upd, 0); return w;
};

/* ---- matrix multiplication ---- */
WIDGETS.matmul = b => {
  const m = control({ type: 'range', label: 'rows of A (m)', min: 1, max: 4, value: 2 }, upd), k = control({ type: 'range', label: 'columns of A = rows of B (k)', min: 1, max: 4, value: 3 }, upd), n = control({ type: 'range', label: 'columns of B (n)', min: 1, max: 4, value: 2 }, upd);
  const eq = h('div', { class: 'w-eq' }), stage = h('div', { class: 'w-row' }), note = h('div', { class: 'w-note' }), form = h('div', { class: 'w-eq' }); let cur = null, sel = [0, 0], timer = null;
  const play = h('button', { class: 'btn', type: 'button', onclick: () => { clearInterval(timer); if (play._on) { play._on = false; play.textContent = '▶ Animate every cell'; return; } play._on = true; play.textContent = '⏸ Pause'; let i = 0; timer = setInterval(() => { const M = +m.get(), N2 = +n.get(); sel = [Math.floor(i / N2) % M, i % N2]; i++; paint(); }, 1100); } }, '▶ Animate every cell');
  function upd() { sel = [0, 0]; paint(); }
  function paint() {
    const M = +m.get(), K = +k.get(), N2 = +n.get(); if (sel[0] >= M) sel[0] = 0; if (sel[1] >= N2) sel[1] = 0;
    const A = Array.from({ length: M }, (_, i) => Array.from({ length: K }, (_, j) => (i + 2 * j) % 4 + 1)), B = Array.from({ length: K }, (_, i) => Array.from({ length: N2 }, (_, j) => (2 * i + j) % 3 + 1));
    const Cm = A.map((row, i) => B[0].map((_, j) => row.reduce((s, v, t) => s + v * B[t][j], 0))); cur = { rows: Cm, A, B };
    const ga = gridOf(A), gb = gridOf(B), gc = gridOf(Cm);
    cellsOf(ga).forEach(c => { c.classList.toggle('hi', +c.dataset.r === sel[0]); c.style.animation = 'none'; }); cellsOf(gb).forEach(c => { c.classList.toggle('hi', +c.dataset.c === sel[1]); c.style.animation = 'none'; });
    cellsOf(gc).forEach(c => { const on = +c.dataset.r === sel[0] && +c.dataset.c === sel[1]; c.classList.toggle('res', on); c.style.animation = 'none'; c.style.cursor = 'pointer'; c.onclick = () => { clearInterval(timer); play._on = false; play.textContent = '▶ Animate every cell'; sel = [+c.dataset.r, +c.dataset.c]; paint(); }; });
    stage.innerHTML = ''; stage.append(h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('b', {}, 'A'), h('span', { class: 'meta' }, shp([M, K]))), ga), h('div', { class: 'op' }, '@'), h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('b', {}, 'B'), h('span', { class: 'meta' }, shp([K, N2]))), gb), h('div', { class: 'op' }, '='), h('div', { class: 'val' }, h('div', { class: 'val-cap' }, h('b', {}, 'A @ B'), h('span', { class: 'meta' }, shp([M, N2]) + ' · click a cell')), gc));
    const terms = A[sel[0]].map((v, t) => `${v}×${B[t][sel[1]]}`).join(' + '); form.innerHTML = `result[${sel[0]}, ${sel[1]}] = row ${sel[0]} of A · column ${sel[1]} of B = <b>${terms} = ${Cm[sel[0]][sel[1]]}</b>`;
    eq.innerHTML = `<b>A @ B</b> &nbsp; (${M}×${K}) @ (${K}×${N2}) → (${M}×${N2})`; note.innerHTML = 'The <b>inner</b> numbers (k) must match, and they disappear. The outer numbers (m and n) become the shape of the answer.';
  }
  const chk = checkBtn(() => `A = np.array(${JSON.stringify(cur.A)})\nB = np.array(${JSON.stringify(cur.B)})\nresult = A @ B`, () => cur, 'result');
  const w = wShell(b.title || 'Matrix multiplication lab', [m, k, n, play], [eq, stage, form, note, ...chk]); setTimeout(upd, 0); return w;
};
