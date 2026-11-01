'use strict';
/* =====================================================================
   NumPy visuals: slicer (+ slice sniper game), broadcast, axisReduce, reshape, cube3d, mask, dotcos, histLive
   ===================================================================== */

/* numpy-like printing of a number list (used in the visual output panels) */
function npFmt(arr) {
  const flat = arr.flat(Infinity), isInt = flat.every(Number.isInteger);
  let dec = 0;
  if (!isInt) { for (const v of flat) { let d = 0; while (d < 8 && Math.abs(v * 10 ** d - Math.round(v * 10 ** d)) > 1e-9 * Math.max(1, Math.abs(v))) d++; dec = Math.max(dec, d); } }
  const f = v => (isInt ? String(v) : (Number.isInteger(v) && dec === 0 ? v.toFixed(0) + '.' : v.toFixed(dec)));
  const w = Math.max(...flat.map(v => f(v).length));
  const rec = (a, depth) => (Array.isArray(a[0]) ? '[' + a.map(x => rec(x, depth + 1)).join(',\n' + ' '.repeat(depth + 1)) + ']' : '[' + a.map(v => f(v).padStart(w)).join(' ') + ']');
  return rec(arr, 6).replace(/\[\s+/g, '[');
}
DSQ.npFmt = npFmt;

/* python slice semantics */
function sliceIdx(n, start, stop, step) {
  step = step == null ? 1 : step; if (step === 0) throw new Error('slice step cannot be zero');
  const idx = [];
  if (step > 0) {
    const s = start == null ? 0 : start < 0 ? Math.max(start + n, 0) : Math.min(start, n), e = stop == null ? n : stop < 0 ? Math.max(stop + n, 0) : Math.min(stop, n);
    for (let i = s; i < e; i += step) idx.push(i);
  } else {
    const s = start == null ? n - 1 : start < 0 ? Math.max(start + n, -1) : Math.min(start, n - 1), e = stop == null ? -1 : stop < 0 ? Math.max(stop + n, -1) : Math.min(stop, n - 1);
    for (let i = s; i > e; i += step) idx.push(i);
  }
  return idx;
}
/* parse "a[1:3, ::2]" or "1:3, ::2" -> per-axis {idx[], scalar} */
function parseSlices(src, shape) {
  let s = String(src).trim().replace(/^[A-Za-z_]\w*\s*\[/, '').replace(/\]\s*$/, '');
  const parts = s.split(',').map(x => x.trim()); if (parts.length > shape.length) throw new Error(`IndexError: too many indices for array: array is ${shape.length}-dimensional, but ${parts.length} were indexed`);
  while (parts.length < shape.length) parts.push(':');
  return parts.map((p, ax) => {
    const n = shape[ax];
    if (/^[-+]?\d+$/.test(p)) { let k = +p; if (k < -n || k >= n) throw new Error(`IndexError: index ${k} is out of bounds for axis ${ax} with size ${n}`); if (k < 0) k += n; return { idx: [k], scalar: true }; }
    const m = /^(-?\d*)\s*:\s*(-?\d*)\s*(?::\s*(-?\d*))?$/.exec(p); if (!m) throw new Error(`SyntaxError: cannot read "${p}" - use start:stop:step`);
    const num = x => (x === '' || x == null ? null : +x);
    return { idx: sliceIdx(n, num(m[1]), num(m[2]), num(m[3])), scalar: false };
  });
}
DSQ.parseSlices = parseSlices;

DSQ.viz.slicer = (c, a) => {
  const rng = RNG(a.seed || 7);
  let R = a.rows || 5, Cc = a.cols || 6, data, expr = a.expr || 'a[1:4, ::2]', target = null, tExpr = '', won = false, one = !!a.oneD;
  if (one) R = 1;
  const mk = () => { data = range(R).map(i => range(Cc).map(j => i * Cc + j)); };
  const sel = () => { const ax = parseSlices(expr, one ? [Cc] : [R, Cc]); return one ? { rows: [0], cols: ax[0].idx, ax } : { rows: ax[0].idx, cols: ax[1].idx, ax }; };
  const CS = 48, W = Cc * CS + 20, Hh = R * CS + 24;
  function build() {
    c.stage.innerHTML = svgOpen(W, Hh) + data.map((row, i) => row.map((v, j) => `<g><rect id="t${i}_${j}" x="${6 + j * CS}" y="${8 + i * CS}" width="${CS + 4 - 4 + 4}" height="${CS + 4 - 4 + 4}" rx="11" fill="none" stroke="none"/><rect class="gcell" id="s${i}_${j}" x="${10 + j * CS}" y="${12 + i * CS}" width="${CS - 4}" height="${CS - 4}" rx="8" fill="var(--surface)" stroke="var(--line)" stroke-width="1.5"/>` +
      `<text class="mono" x="${10 + j * CS + CS / 2 - 2}" y="${12 + i * CS + CS / 2 + 4}" text-anchor="middle" font-size="14" font-weight="700">${v}</text></g>`).join('')).join('') + '</svg>';
  }
  function maskOf(rows, cols) { return rows.flatMap(r => cols.map(cc => r * Cc + cc)).sort((x, y) => x - y).join(','); }
  function paint() {
    let s; try { s = sel(); } catch (e) { c.say(`<span class="r">${esc(e.message)}</span>`); return; }
    const on = new Set(s.rows.flatMap(r => s.cols.map(cc => r + '_' + cc)));
    for (let i = 0; i < R; i++) for (let j = 0; j < Cc; j++) {
      const el = $('#s' + i + '_' + j, c.stage), isOn = on.has(i + '_' + j);
      el.setAttribute('fill', isOn ? 'var(--c0s)' : 'var(--surface)'); el.setAttribute('stroke', isOn ? 'var(--c0)' : 'var(--line)'); el.setAttribute('stroke-width', isOn ? 3 : 1.5);
      el.style.opacity = isOn || !a.dim ? 1 : .55;
      if (target) { const tr = $('#t' + i + '_' + j, c.stage), tOn = target.has(i * Cc + j); tr.setAttribute('stroke', tOn ? 'var(--c5)' : 'none'); tr.setAttribute('stroke-width', 3.5); tr.setAttribute('stroke-dasharray', '6 4'); }
    }
    const keepR = s.rows, keepC = s.cols;
    let res = one ? keepC.map(j => data[0][j]) : (s.ax[0].scalar && s.ax[1].scalar ? data[keepR[0]][keepC[0]] : s.ax[0].scalar ? keepC.map(j => data[keepR[0]][j]) : s.ax[1].scalar ? keepR.map(i => data[i][keepC[0]]) : keepR.map(i => keepC.map(j => data[i][j])));
    const shape = Array.isArray(res) ? (Array.isArray(res[0]) ? [res.length, res[0] ? res[0].length : 0] : [res.length]) : [];
    const empty = Array.isArray(res) && (res.length === 0 || (Array.isArray(res[0]) && res[0].length === 0));
    c.say(`<span class="y">${esc(one ? 'a' : 'a')}</span>${esc(expr.replace(/^a/, ''))}\n` + (empty ? '[]' : (Array.isArray(res) ? npFmt(res) : String(res))) + `\n<span class="g">shape = (${shape.join(', ')}${shape.length === 1 ? ',' : ''})</span>`);
    if (target && !won && maskOf(s.rows, s.cols) === [...target].sort((x, y) => x - y).join(',')) {
      won = true; c.say($('.out', c.box).innerHTML + `\n<span class="g">Hit! Same cells as the target.</span>`);
      if (DSQ.S && DSQ.S.st) { DSQ.S.st.games.sniper = (DSQ.S.st.games.sniper || 0) + 1; DSQ.S.award(8, 'Slicing drill'); confetti(40); }
    }
  }
  function round() {
    won = false; mk(); build();
    const pickSl = (n) => { const st = rng.int(0, n - 2), en = rng.int(st + 1, n), stp = rng.pick([1, 1, 2, 2, 3]); return `${st || ''}:${en === n ? '' : en}${stp > 1 ? ':' + stp : ''}`; };
    for (let k = 0; k < 20; k++) {
      tExpr = one ? `a[${pickSl(Cc)}]` : `a[${pickSl(R)}, ${pickSl(Cc)}]`;
      const s = parseSlices(tExpr, one ? [Cc] : [R, Cc]); const rows = one ? [0] : s[0].idx, cols = one ? s[0].idx : s[1].idx;
      if (rows.length * cols.length >= 2 && rows.length * cols.length < R * Cc * .7) { target = new Set(rows.flatMap(r => cols.map(cc => r * Cc + cc))); break; }
    }
    paint();
  }
  if (a.sniper) {
    c.button('New target', () => { expr = one ? 'a[:]' : 'a[:, :]'; ti.value = expr; round(); });
    c.ctl.append(h('span', { class: 'muted' }, 'Type a slice that selects exactly the dashed gold cells.'));
  }
  const ti = c.text('numpy:', expr, v => { expr = v; paint(); }, '14em');
  mk(); build();
  if (a.sniper) round(); else paint();
};

/* ---------------------------------------------------------------------
   broadcast
   --------------------------------------------------------------------- */
DSQ.viz.broadcast = (c, a) => {
  const SH = ['(3, 4)', '(3, 1)', '(1, 4)', '(4,)', '(3,)', '(1, 1)', '()', '(3, 3)', '(2, 4)'];
  let sa = a.a || '(3, 4)', sb = a.b || '(4,)', cancel = null;
  const parse = s => (s.replace(/[() ]/g, '') === '' ? [] : s.replace(/[() ]/g, '').split(',').filter(x => x !== '').map(Number));
  const pr = s => s.replace(', )', ',)');
  function draw() {
    cancel && cancel();
    const A = parse(sa), B = parse(sb), nd = Math.max(A.length, B.length), pa = [...Array(nd - A.length).fill(1), ...A], pb = [...Array(nd - B.length).fill(1), ...B];
    const res = pa.map((x, i) => (x === pb[i] ? x : x === 1 ? pb[i] : pb[i] === 1 ? x : null)), ok = !res.includes(null);
    const dimTxt = pa.map((x, i) => `<span class="${x === pb[i] || x === 1 || pb[i] === 1 ? 'g' : 'r'}">${x} vs ${pb[i]}</span>`).join('   ');
    c.say(`A.shape = ${pr(sa)}     B.shape = ${pr(sb)}\nright-align:  A ${JSON.stringify(pa)}  B ${JSON.stringify(pb)}\ncompare each dimension:  ${dimTxt}\n` + (ok ? `<span class="g">result shape = (${res.join(', ')}${res.length === 1 ? ',' : ''})</span>` : `<span class="r">ValueError: operands could not be broadcast together with shapes ${sa.replace(/ /g, '')} ${sb.replace(/ /g, '')}</span>`));
    const rA = pa.length === 1 ? 1 : pa[pa.length - 2], cA = pa[pa.length - 1], rB = pb.length === 1 ? 1 : pb[pb.length - 2], cB = pb[pb.length - 1];
    const rR = ok ? (res.length === 1 ? 1 : res[res.length - 2]) : Math.max(rA, rB), cR = ok ? res[res.length - 1] : Math.max(cA, cB);
    const CS = 34, gap = 46, W = 2 * 12 + (cA + cR + cR) * CS + gap * 3, Hh = Math.max(rA, rB, rR) * CS + 56;
    const grid = (r, cc, x0, vals, style) => range(r).map(i => range(cc).map(j => `<g><rect x="${x0 + j * CS}" y="${34 + i * CS}" width="${CS - 3}" height="${CS - 3}" rx="6" ${style(i, j)}/><text class="mono" x="${x0 + j * CS + CS / 2 - 1}" y="${34 + i * CS + CS / 2 + 4}" text-anchor="middle" font-size="12" font-weight="700">${vals(i, j)}</text></g>`).join('')).join('');
    const xA = 12, xB = xA + cA * CS + gap, xR = xB + cR * CS + gap;
    const Av = (i, j) => i * cA + j, Bv = (i, j) => (j % cB + 1) * 10 + (i % rB) * 0;
    const stage = t => {
      const stretch = ok ? t : 0;
      c.stage.innerHTML = svgOpen(W, Hh) +
        `<text x="${xA}" y="22" font-weight="800">A ${esc(sa)}</text><text x="${xB}" y="22" font-weight="800">B ${esc(sb)} stretched</text><text x="${xR}" y="22" font-weight="800">A + B</text>` +
        grid(rA, cA, xA, Av, () => 'fill="var(--c0s)" stroke="var(--c0)" stroke-width="2"') +
        // B real cells, then ghost copies
        grid(rR, cR, xB, (i, j) => Bv(i, j), (i, j) => { const real = i < rB && j < cB; return real ? 'fill="var(--c1s)" stroke="var(--c1)" stroke-width="2"' : `fill="var(--c1s)" stroke="var(--c1)" stroke-dasharray="4 3" opacity="${(.15 + .75 * stretch).toFixed(2)}"`; }) +
        `<text x="${xB - gap / 2}" y="${34 + rR * CS / 2 + 5}" text-anchor="middle" font-size="22" font-weight="800">+</text><text x="${xR - gap / 2}" y="${34 + rR * CS / 2 + 5}" text-anchor="middle" font-size="22" font-weight="800">=</text>` +
        (ok ? grid(rR, cR, xR, (i, j) => Av(i % rA, j % cA) + Bv(i, j), () => `fill="var(--c2s)" stroke="var(--c2)" stroke-width="2" opacity="${(.2 + .8 * stretch).toFixed(2)}"`)
          : `<g><rect x="${xR}" y="34" width="${Math.max(cR * CS, 120)}" height="${Math.max(rR * CS, 56)}" rx="10" fill="var(--bad-soft)" stroke="var(--bad)" stroke-width="2"/><text x="${xR + Math.max(cR * CS, 120) / 2}" y="${34 + Math.max(rR * CS, 56) / 2 + 5}" text-anchor="middle" fill="var(--bad)" font-weight="800">ValueError</text></g>`) + '</svg>';
    };
    cancel = anim(1100, stage);
  }
  c.select('A', SH, sa, v => { sa = v; draw(); }); c.select('B', SH, sb, v => { sb = v; draw(); });
  c.button('Replay', draw); draw();
  return { destroy: () => cancel && cancel() };
};

/* ---------------------------------------------------------------------
   axisReduce : sum / mean / max / min along an axis
   --------------------------------------------------------------------- */
DSQ.viz.axisReduce = (c, a) => {
  const rng = RNG(a.seed || 11); const R = 3, Cc = 4, M = range(R).map(() => range(Cc).map(() => rng.int(1, 9)));
  let fn = a.fn || 'sum', axis = a.axis ?? 0, cancel = null;
  const F = { sum: v => sum(v), mean: v => mean(v), max: v => Math.max(...v), min: v => Math.min(...v) };
  const col = j => M.map(r => r[j]), row = i => M[i];
  function draw() {
    cancel && cancel(); const CS = 54, x0 = 20, y0 = 20, W = x0 + Cc * CS + 150, Hh = y0 + R * CS + 86;
    let out; if (axis === 'None') out = F[fn](M.flat()); else if (axis === 0) out = range(Cc).map(j => F[fn](col(j))); else out = range(R).map(i => F[fn](row(i)));
    const code = `a.${fn}(${axis === 'None' ? '' : 'axis=' + axis})`;
    const pr = Array.isArray(out) ? npFmt(out) : (Number.isInteger(out) ? String(out) : (+out.toFixed(6)).toString());
    c.say(`a =\n${npFmt(M)}\n<span class="y">${code}</span>\n${pr}\n<span class="g">axis=${axis === 'None' ? 'None: every element' : axis + ': ' + (axis === 0 ? 'collapse the rows, one answer per column' : 'collapse the columns, one answer per row')}</span>`);
    cancel = anim(1100, t => {
      let s = svgOpen(W, Hh);
      M.forEach((r, i) => r.forEach((v, j) => {
        const hot = axis === 'None' || (axis === 0 ? true : true);
        const colr = axis === 0 ? colv(j) : axis === 1 ? colv(i) : colv(0);
        s += `<rect x="${x0 + j * CS}" y="${y0 + i * CS}" width="${CS - 5}" height="${CS - 5}" rx="9" fill="var(--surface)" stroke="${colr}" stroke-width="2.5" opacity="${hot ? 1 : .4}"/><text class="mono" x="${x0 + j * CS + CS / 2 - 3}" y="${y0 + i * CS + CS / 2 + 4}" text-anchor="middle" font-size="15" font-weight="800">${v}</text>`;
      }));
      if (axis === 0) range(Cc).forEach(j => { const yy = lerp(y0 + R * CS - 6, y0 + R * CS + 14, t); s += `<path d="M${x0 + j * CS + CS / 2 - 3} ${y0 + 4} V${yy}" stroke="${colv(j)}" stroke-width="3" opacity="${.6 * t}" stroke-dasharray="4 4"/><rect x="${x0 + j * CS}" y="${y0 + R * CS + 14}" width="${CS - 5}" height="${CS - 5}" rx="9" fill="${colSoft(j)}" stroke="${colv(j)}" stroke-width="2.5" opacity="${t}"/><text class="mono" x="${x0 + j * CS + CS / 2 - 3}" y="${y0 + R * CS + 14 + CS / 2 + 4}" text-anchor="middle" font-size="15" font-weight="800" opacity="${t}">${+out[j].toFixed(2)}</text>`; });
      else if (axis === 1) range(R).forEach(i => { const xx = lerp(x0 + Cc * CS - 6, x0 + Cc * CS + 14, t); s += `<path d="M${x0 + 4} ${y0 + i * CS + CS / 2 - 3} H${xx}" stroke="${colv(i)}" stroke-width="3" opacity="${.6 * t}" stroke-dasharray="4 4"/><rect x="${x0 + Cc * CS + 14}" y="${y0 + i * CS}" width="${CS - 5}" height="${CS - 5}" rx="9" fill="${colSoft(i)}" stroke="${colv(i)}" stroke-width="2.5" opacity="${t}"/><text class="mono" x="${x0 + Cc * CS + 14 + CS / 2 - 3}" y="${y0 + i * CS + CS / 2 + 4}" text-anchor="middle" font-size="15" font-weight="800" opacity="${t}">${+out[i].toFixed(2)}</text>`; });
      else s += `<rect x="${x0 + Cc * CS + 14}" y="${y0 + R * CS / 2 - 24}" width="70" height="48" rx="10" fill="var(--c2s)" stroke="var(--c2)" stroke-width="2.5" opacity="${t}"/><text class="mono" x="${x0 + Cc * CS + 49}" y="${y0 + R * CS / 2 + 5}" text-anchor="middle" font-size="16" font-weight="800" opacity="${t}">${+out.toFixed(2)}</text>`;
      c.stage.innerHTML = s + '</svg>';
    });
  }
  c.select('function', ['sum', 'mean', 'max', 'min'], fn, v => { fn = v; draw(); });
  c.select('axis', [['None', 'None'], [0, '0 (down)'], [1, '1 (across)']], axis, v => { axis = v === 'None' ? 'None' : +v; draw(); });
  draw(); return { destroy: () => cancel && cancel() };
};

/* ---------------------------------------------------------------------
   reshape : 12 numbers move into a new shape (order C or F)
   --------------------------------------------------------------------- */
DSQ.viz.reshape = (c, a) => {
  const N = a.n || 12; const shapes = range(N).map(i => i + 1).filter(r => N % r === 0).map(r => [r, N / r]);
  let sh = shapes.find(s => s[0] === 3) || shapes[2], order = 'C', cancel = null, prev = null;
  const CS = 40, gap = 12;
  const pos = (k, s, ord) => { const [r, cc] = s; return ord === 'C' ? { i: Math.floor(k / cc), j: k % cc } : { i: k % r, j: Math.floor(k / r) }; };
  function draw() {
    cancel && cancel(); const from = prev || { s: [1, N], ord: 'C' }, to = { s: sh, ord: order }; const W = Math.max(N, sh[1]) * CS + 30, Hh = sh[0] * CS + 160;
    c.say(`<span class="y">a</span> = np.arange(${N})\n<span class="y">b</span> = a.reshape(${sh[0]}, ${sh[1]}${order === 'F' ? ", order='F'" : ''})\n${npFmt(range(sh[0]).map(i => range(sh[1]).map(j => 0)).map((r, i) => r.map((_, j) => range(N).find(k => { const p = pos(k, sh, order); return p.i === i && p.j === j; }))))}\n<span class="g">b.shape = (${sh[0]}, ${sh[1]}); a and b share the same ${N} numbers</span>`);
    cancel = anim(1000, t => {
      let s = svgOpen(W, Hh) + `<text x="12" y="20" font-weight="800">a = arange(${N})</text><text x="12" y="${68 + CS}" font-weight="800" class="m">becomes shape (${sh[0]}, ${sh[1]})</text>`;
      for (let k = 0; k < N; k++) {
        const p0 = pos(k, from.s, from.ord), p1 = pos(k, to.s, to.ord);
        const x = lerp(14 + k * CS * 0 + p0.j * CS, 14 + p1.j * CS, t), y = lerp(30 + p0.i * CS, 90 + CS + p1.i * CS, t);
        const y2 = lerp(30, 90 + CS + p1.i * CS - 0, t);
        s += `<g><rect x="${x}" y="${y2}" width="${CS - 4}" height="${CS - 4}" rx="8" fill="${colSoft(k % 7)}" stroke="${colv(k % 7)}" stroke-width="2"/><text class="mono" x="${x + CS / 2 - 2}" y="${y2 + CS / 2 + 3}" text-anchor="middle" font-size="13" font-weight="800">${k}</text></g>`;
      }
      c.stage.innerHTML = s + '</svg>';
    });
    prev = null;
  }
  c.select('shape', shapes.map(s => [s.join('x'), `(${s[0]}, ${s[1]})`]), sh.join('x'), v => { sh = v.split('x').map(Number); draw(); });
  c.select('order', [['C', 'C: row by row'], ['F', 'F: column by column']], order, v => { order = v; draw(); });
  draw(); return { destroy: () => cancel && cancel() };
};

/* ---------------------------------------------------------------------
   cube3d : a 3-D array as a block; pick a slice
   --------------------------------------------------------------------- */
DSQ.viz.cube3d = (c, a) => {
  let D = a.d || 3, Rr = a.r || 3, Cc = a.c || 4, ax = a.axis ?? 0, k = 0, cancel = null;
  const p3 = Plot3D(c.stage, { w: 640, h: 420, az: .75, el: .5 }); c.onDestroy(() => { p3.destroy(); cancel && cancel(); });
  const cube = (x, y, z, col, alpha, stroke) => {
    const s = .44, V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(v => [x + v[0] * s, y + v[1] * s, z + v[2] * s]);
    return [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]].map(f => ({ t: 'poly', pts: f.map(i => V[i]), fill: col, alpha, stroke, sw: 1 }));
  };
  function draw() {
    cancel && cancel(); const lim = [D, Rr, Cc][ax]; k = Math.min(k, lim - 1);
    const items = [];
    for (let d = 0; d < D; d++) for (let r = 0; r < Rr; r++) for (let cc = 0; cc < Cc; cc++) {
      const on = [d, r, cc][ax] === k, X = cc - (Cc - 1) / 2, Y = d - (D - 1) / 2, Z = -(r - (Rr - 1) / 2);
      cube(X, Y, Z, on ? '#D2600F' : '#2F6FE0', on ? .92 : .13, on ? '#fff' : 'rgba(47,111,224,.45)').forEach(p => { p.t0 = (d + r + cc) / (D + Rr + Cc) * .8; items.push(p); });
    }
    const lab = (s, p) => items.push({ t: 'txt', p, s, bold: true, size: 12, t0: .9, bg: true });
    lab('axis 2: cols (' + Cc + ')', [0, -D / 2 - .9, -Rr / 2 - .9]); lab('axis 1: rows (' + Rr + ')', [-Cc / 2 - 1.1, -D / 2 - .9, 0]); lab('axis 0: depth (' + D + ')', [Cc / 2 + 1.0, 0, Rr / 2 + .9]);
    p3.set(items, [0, 0, 0], Math.max(D, Rr, Cc) * .95); cancel = anim(1000, t => p3.draw(t));
    const sl = ['a[' + k + ']', 'a[:, ' + k + ']', 'a[:, :, ' + k + ']'][ax], rs = [[Rr, Cc], [D, Cc], [D, Rr]][ax];
    c.say(`a = np.arange(${D * Rr * Cc}).reshape(${D}, ${Rr}, ${Cc})\na.shape = (${D}, ${Rr}, ${Cc})   a.ndim = 3   a.size = ${D * Rr * Cc}\n<span class="y">${sl}</span> -> shape (${rs[0]}, ${rs[1]})   <span class="g"># the orange layer</span>`);
  }
  c.slider('axis 0', 1, 4, 1, D, v => { D = v; draw(); }); c.slider('axis 1', 1, 4, 1, Rr, v => { Rr = v; draw(); }); c.slider('axis 2', 1, 5, 1, Cc, v => { Cc = v; draw(); });
  c.select('slice along', [[0, 'axis 0: a[k]'], [1, 'axis 1: a[:, k]'], [2, 'axis 2: a[:, :, k]']], ax, v => { ax = +v; draw(); });
  c.slider('k', 0, 3, 1, 0, v => { k = v; draw(); });
  c.button('Spin', () => p3.spin(true)); draw();
};

/* ---------------------------------------------------------------------
   mask : boolean masks
   --------------------------------------------------------------------- */
DSQ.viz.mask = (c, a) => {
  const rng = RNG(a.seed || 5); const v = range(12).map(() => rng.int(1, 20)); let op = '>', th = 10, cancel = null;
  const test = x => (op === '>' ? x > th : op === '<' ? x < th : op === '==' ? x === th : op === '>=' ? x >= th : op === '!=' ? x !== th : x <= th);
  function draw() {
    cancel && cancel(); const W = 640, Hh = 260, bw = 40, x0 = 24, base = 200, sc = 9;
    const m = v.map(test);
    c.say(`a    = ${JSON.stringify(v).replace(/,/g, ', ')}\n<span class="y">mask</span> = a ${op} ${th}\n       ${m.map(b => (b ? 'T' : 'F')).join('  ')}   <span class="g"># dtype=bool</span>\n<span class="y">a[mask]</span> = ${JSON.stringify(v.filter(test)).replace(/,/g, ', ')}\n<span class="y">a[mask].sum()</span> = ${sum(v.filter(test))}    <span class="y">mask.sum()</span> = ${m.filter(Boolean).length} <span class="g"># True counts as 1</span>`);
    cancel = anim(700, t => {
      let s = svgOpen(W, Hh) + `<line x1="10" x2="${W - 10}" y1="${base - th * sc}" y2="${base - th * sc}" stroke="var(--c1)" stroke-width="2.5" stroke-dasharray="6 4"/><text x="14" y="${base - th * sc - 6}" text-anchor="start" fill="var(--c1)" font-weight="800">threshold ${th}</text>`;
      v.forEach((x, i) => { const on = m[i], hh = x * sc * t; s += `<rect x="${x0 + i * (bw + 6)}" y="${base - hh}" width="${bw}" height="${hh}" rx="6" fill="${on ? 'var(--c2)' : 'var(--gr)'}" opacity="${on ? 1 : .8}"/><text class="mono" x="${x0 + i * (bw + 6) + bw / 2}" y="${base - hh - 5}" text-anchor="middle" font-weight="800" font-size="12">${x}</text><text class="mono" x="${x0 + i * (bw + 6) + bw / 2}" y="${base + 20}" text-anchor="middle" font-size="12" fill="${on ? 'var(--ok)' : 'var(--muted)'}" font-weight="800">${on ? 'True' : 'False'}</text>`; });
      c.stage.innerHTML = s + '</svg>';
    });
  }
  c.select('operator', ['>', '>=', '<', '<=', '==', '!='], op, x => { op = x; draw(); }); c.slider('threshold', 1, 20, 1, th, x => { th = x; draw(); });
  draw(); return { destroy: () => cancel && cancel() };
};

/* ---------------------------------------------------------------------
   dotcos : dot product and cosine similarity
   --------------------------------------------------------------------- */
DSQ.viz.dotcos = (c, a) => {
  let ta = a.ta ?? 30, tb = a.tb ?? 100, la = 4, lb = 3;
  function draw() {
    const A = [la * Math.cos(ta * Math.PI / 180), la * Math.sin(ta * Math.PI / 180)], B = [lb * Math.cos(tb * Math.PI / 180), lb * Math.sin(tb * Math.PI / 180)];
    const dot = A[0] * B[0] + A[1] * B[1], cs = dot / (la * lb), ang = Math.acos(clamp(cs, -1, 1)) * 180 / Math.PI;
    const W = 560, Hh = 320, cx = 190, cy = 250, S = 44, X = p => cx + p[0] * S, Y = p => cy - p[1] * S;
    const proj = dot / (lb * lb), P = [B[0] * proj, B[1] * proj];
    c.stage.innerHTML = svgOpen(W, Hh) + `<defs><marker id="ah0" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="var(--c0)"/></marker><marker id="ah1" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="var(--c1)"/></marker></defs>` +
      `<line x1="10" x2="${W - 10}" y1="${cy}" y2="${cy}" stroke="var(--gr)"/><line x1="${cx}" x2="${cx}" y1="10" y2="${Hh - 10}" stroke="var(--gr)"/>` +
      `<line x1="${X([0, 0])}" y1="${Y([0, 0])}" x2="${X(P)}" y2="${Y(P)}" stroke="var(--c2)" stroke-width="6" opacity=".45" stroke-linecap="round"/>` +
      `<line x1="${X(A)}" y1="${Y(A)}" x2="${X(P)}" y2="${Y(P)}" stroke="var(--ax)" stroke-dasharray="4 4"/>` +
      `<line x1="${cx}" y1="${cy}" x2="${X(A)}" y2="${Y(A)}" stroke="var(--c0)" stroke-width="3.5" marker-end="url(#ah0)"/><line x1="${cx}" y1="${cy}" x2="${X(B)}" y2="${Y(B)}" stroke="var(--c1)" stroke-width="3.5" marker-end="url(#ah1)"/>` +
      `<text x="${X(A) + 8}" y="${Y(A)}" fill="var(--c0)" font-weight="800">a</text><text x="${X(B) + 8}" y="${Y(B)}" fill="var(--c1)" font-weight="800">b</text>` +
      `<text x="${W - 190}" y="60" font-size="15" font-weight="800">angle = ${ang.toFixed(0)} deg</text><text x="${W - 190}" y="86" class="mono" font-size="14">a.b = ${dot.toFixed(2)}</text><text x="${W - 190}" y="110" class="mono" font-size="14">cos = ${cs.toFixed(3)}</text>` +
      `<text x="${W - 190}" y="140" class="m" font-size="12.5">${cs > .95 ? 'almost the same direction' : cs > .3 ? 'similar direction' : cs > -.3 ? 'nearly perpendicular (dot ~ 0)' : 'opposite-ish'}</text>` +
      `<text x="${W - 190}" y="162" class="m" font-size="12.5" fill="var(--c2)">green = shadow of a on b</text></svg>`;
    c.say(`a = np.array([${A.map(x => x.toFixed(2)).join(', ')}])   b = np.array([${B.map(x => x.toFixed(2)).join(', ')}])\n<span class="y">np.dot(a, b)</span> = ${dot.toFixed(3)}\n<span class="y">cos</span> = dot / (norm(a) * norm(b)) = ${dot.toFixed(3)} / (${la.toFixed(2)} * ${lb.toFixed(2)}) = ${cs.toFixed(3)}`);
  }
  c.slider('angle of a', 0, 180, 1, ta, v => { ta = v; draw(); }, v => v + '°'); c.slider('angle of b', 0, 180, 1, tb, v => { tb = v; draw(); }, v => v + '°');
  c.slider('|a|', 1, 5, .5, la, v => { la = v; draw(); }); c.slider('|b|', 1, 5, .5, lb, v => { lb = v; draw(); });
  draw();
};

/* ---------------------------------------------------------------------
   histLive : random numbers pile up into a histogram
   --------------------------------------------------------------------- */
DSQ.viz.histLive = (c, a) => {
  let dist = a.dist || 'normal', n = a.n || 500, bins = a.bins || 20, seed = 1, cancel = null;
  function draw() {
    cancel && cancel(); const r = RNG(seed * 977 + n); let xs;
    xs = range(n).map(() => (dist === 'normal' ? r.norm(0, 1) : dist === 'uniform' ? r() * 6 - 3 : dist === 'exponential' ? r.exp(1) - 1 : (r.norm(-1.6, .6) * (r() < .5 ? 1 : 0) + r.norm(1.6, .6) * (r() < .5 ? 0 : 1)) || r.norm(0, 1)));
    const lo = Math.min(...xs), hi = Math.max(...xs), bw = (hi - lo) / bins, cnt = range(bins).map(() => 0);
    xs.forEach(x => { cnt[Math.min(bins - 1, Math.floor((x - lo) / bw))]++; });
    const mx = Math.max(...cnt), W = 640, Hh = 300, ml = 36, pw = (W - ml - 12) / bins;
    const m = mean(xs), sd = Math.sqrt(mean(xs.map(x => (x - m) ** 2)));
    c.say(`rng = np.random.default_rng(${seed})\nx = rng.${dist === 'normal' ? 'normal(0, 1' : dist === 'uniform' ? 'uniform(-3, 3' : dist === 'exponential' ? 'exponential(1.0' : 'normal(0, 1'}, size=${n})\ncounts, edges = np.histogram(x, bins=${bins})\n<span class="y">x.mean()</span> = ${m.toFixed(3)}   <span class="y">x.std()</span> = ${sd.toFixed(3)}   <span class="y">max count</span> = ${mx}\n<span class="g"># same recipe as Python; exact digits differ because NumPy uses its own generator</span>`);
    cancel = anim(1000, t => {
      let s = svgOpen(W, Hh) + `<line x1="${ml}" x2="${W - 8}" y1="${Hh - 30}" y2="${Hh - 30}" stroke="var(--ax)"/>`;
      cnt.forEach((k, i) => { const hh = (k / mx) * (Hh - 70) * t; s += `<rect x="${ml + i * pw + 1}" y="${Hh - 30 - hh}" width="${pw - 2}" height="${hh}" rx="3" fill="var(--c0)" opacity=".85"/>`; });
      s += `<line x1="${ml + (m - lo) / (hi - lo) * pw * bins}" x2="${ml + (m - lo) / (hi - lo) * pw * bins}" y1="14" y2="${Hh - 30}" stroke="var(--c1)" stroke-width="2.5" stroke-dasharray="5 4"/><text x="${ml + (m - lo) / (hi - lo) * pw * bins + 6}" y="26" fill="var(--c1)" font-weight="800">mean</text>`;
      s += `<text class="m" x="${ml}" y="${Hh - 10}" font-size="11">${lo.toFixed(1)}</text><text class="m" x="${W - 8}" y="${Hh - 10}" font-size="11" text-anchor="end">${hi.toFixed(1)}</text>`;
      c.stage.innerHTML = s + '</svg>';
    });
  }
  c.select('distribution', ['normal', 'uniform', 'exponential', 'two humps'], dist === 'bimodal' ? 'two humps' : dist, v => { dist = v === 'two humps' ? 'bimodal' : v; draw(); });
  c.slider('samples n', 20, 5000, 20, n, v => { n = v; draw(); }); c.slider('bins', 5, 50, 1, bins, v => { bins = v; draw(); });
  c.button('New seed', () => { seed++; draw(); }); draw(); return { destroy: () => cancel && cancel() };
};
