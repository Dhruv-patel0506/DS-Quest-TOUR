'use strict';
/* =====================================================================
   3-D shape library for the holograms: solid-looking glass shapes (box, cylinder, frustum/funnel, sphere, matrix of cells, database stack,
   page, ring, arrow) built from the polygons and lines Plot3D draws. Faces are lit from a fixed direction so a cylinder looks round,
   edges glow, and every shape takes an optional `glow` (0..1) for highlights. All functions return arrays of Plot3D items.
   ===================================================================== */
const SH = (() => {
  const L = (() => { const v = [-.4, -.55, .75], m = Math.hypot(...v); return v.map(x => x / m); })();
  const rgb = hex => { const h0 = String(hex).replace('#', ''), n = parseInt(h0.length === 3 ? h0.split('').map(c => c + c).join('') : h0.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (hex, k, a) => { const [r, g, b] = rgb(hex); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgba(${f(r)},${f(g)},${f(b)},${a})`; };
  const normal = p => { const a = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], b = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]], n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], m = Math.hypot(...n) || 1; return n.map(x => x / m); };
  const lit = (p, color, o) => { const n = normal(p), k = .55 + .6 * Math.abs(n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) + (o.glow || 0) * .35; return { t: 'poly', pts: p, fill: mix(color, k, Math.min(1, (o.a ?? .3) + (o.glow || 0) * .25)), stroke: false }; };
  const edge = (a, b, color, o) => ({ t: 'line', a, b, color: mix('#' + rgb(color).map(v => Math.min(255, v + 70).toString(16).padStart(2, '0')).join(''), 1, Math.min(1, (o.edge ?? .8) + (o.glow || 0) * .2)), w: o.w || 1.3 });
  const add = (c, v) => [c[0] + v[0], c[1] + v[1], c[2] + v[2]];

  /* an axis-aligned local frame: the shape is built along z and then rotated so its axis points along x or y */
  const turn = (p, axis) => axis === 'x' ? [p[2], p[1], -p[0]] : axis === 'y' ? [p[0], p[2], -p[1]] : p;
  const place = (c, p, axis) => add(c, turn(p, axis));

  function box(c, s, color, o = {}) {
    const [a, b, d] = s.map(v => v / 2), P = [[-a, -b, -d], [a, -b, -d], [a, b, -d], [-a, b, -d], [-a, -b, d], [a, -b, d], [a, b, d], [-a, b, d]].map(q => add(c, q)), out = [];
    [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]].forEach(f => out.push(lit(f.map(i => P[i]), color, o)));
    [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([i, j]) => out.push(edge(P[i], P[j], color, o)));
    return out;
  }
  function frustum(c, r1, r2, h, color, o = {}) {
    const n = o.sides || 22, ax = o.axis || 'z', out = [], bot = [], top = [];
    for (let i = 0; i < n; i++) { const t = i / n * 6.2832; bot.push(place(c, [Math.cos(t) * r1, Math.sin(t) * r1, -h / 2], ax)); top.push(place(c, [Math.cos(t) * r2, Math.sin(t) * r2, h / 2], ax)); }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; out.push(lit([bot[i], bot[j], top[j], top[i]], color, o)); }
    if (r1 > .001) out.push(lit(bot, color, Object.assign({}, o, { a: (o.a ?? .3) * .8 })));
    if (r2 > .001) out.push(lit(top, color, o));
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (r1 > .001) out.push(edge(bot[i], bot[j], color, o)); if (r2 > .001) out.push(edge(top[i], top[j], color, o)); if (i % Math.max(2, Math.round(n / 6)) === 0) out.push(edge(bot[i], top[i], color, Object.assign({}, o, { edge: (o.edge ?? .8) * .7 }))); }
    return out;
  }
  const cyl = (c, r, h, color, o = {}) => frustum(c, r, r, h, color, o);
  function sphere(c, r, color, o = {}) {
    const la = o.lat || 5, lo = o.lon || 9, out = [], pt = (i, j) => { const th = Math.PI * i / la, ph = 6.2832 * j / lo; return add(c, [r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th)]); };
    for (let i = 0; i < la; i++) for (let j = 0; j < lo; j++) out.push(lit([pt(i, j), pt(i, j + 1), pt(i + 1, j + 1), pt(i + 1, j)], color, o));
    for (let i = 1; i < la; i++) if (i % 2 === 1 || la < 4) for (let j = 0; j < lo; j++) out.push(edge(pt(i, j), pt(i, j + 1), color, Object.assign({}, o, { edge: (o.edge ?? .8) * .6 })));
    return out;
  }
  const plate = (c, w, d, th, color, o) => box(c, [w, d, th], color, o);
  function db(c, r, h, color, o = {}) { const out = []; for (let k = 0; k < 3; k++) out.push(...cyl([c[0], c[1], c[2] + (k - 1) * h * .36], r, h * .3, color, Object.assign({ a: .34 }, o))); return out; }
  function ring(c, r, th, color, o = {}) { const n = o.sides || 28, out = []; for (let i = 0; i < n; i++) { const a = i / n * 6.2832, b = (i + 1) / n * 6.2832; out.push(edge(add(c, [Math.cos(a) * r, Math.sin(a) * r, 0]), add(c, [Math.cos(b) * r, Math.sin(b) * r, 0]), color, Object.assign({ w: th }, o))); } return out; }
  /* a rows x cols matrix of little cells; vals(i, j) in 0..1 gives each cell's brightness */
  function matrix(c, rows, cols, cell, color, o = {}, vals) { const out = [], gap = cell * .12; for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const v = vals ? vals(i, j) : .5, p = [c[0] + (j - (cols - 1) / 2) * (cell + gap), c[1], c[2] + ((rows - 1) / 2 - i) * (cell + gap)]; out.push(...box(p, [cell, cell * .35, cell], color, Object.assign({}, o, { a: .15 + .5 * v, glow: v * .6, w: .8 }))); } return out; }
  /* a page with a folded corner and text lines (documents, chunks) */
  function page(c, w, h, color, o = {}) { const out = box(c, [w, .06, h], color, Object.assign({ a: .4 }, o)); for (let k = 0; k < 4; k++) out.push({ t: 'line', a: add(c, [-w * .36, -.05, h * .25 - k * h * .17]), b: add(c, [w * (k === 3 ? .1 : .36), -.05, h * .25 - k * h * .17]), color: mix(color, 1.5, .9), w: 1.2 }); return out; }
  function arrow(a, b, color, o = {}) { const out = [{ t: 'line', a, b, color: o.col || mix(color, 1.3, .9), w: o.w || 2 }], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], m = Math.hypot(...d) || 1, u = d.map(v => v / m), s = o.head || .22, base = [b[0] - u[0] * s, b[1] - u[1] * s, b[2] - u[2] * s], q = Math.abs(u[2]) > .9 ? [1, 0, 0] : [0, 0, 1], v1 = [u[1] * q[2] - u[2] * q[1], u[2] * q[0] - u[0] * q[2], u[0] * q[1] - u[1] * q[0]], m1 = Math.hypot(...v1) || 1, w1 = v1.map(v => v / m1 * s * .38); out.push({ t: 'line', a: b, b: [base[0] + w1[0], base[1] + w1[1], base[2] + w1[2]], color: o.col || mix(color, 1.3, .9), w: o.w || 2 }, { t: 'line', a: b, b: [base[0] - w1[0], base[1] - w1[1], base[2] - w1[2]], color: o.col || mix(color, 1.3, .9), w: o.w || 2 }); return out; }
  const dot = (p, color, r = 6) => ({ t: 'pt', p, r, color, ring: 'rgba(255,255,255,.7)' });
  const label = (p, s, o = {}) => Object.assign({ t: 'txt', p, s, size: 11, bold: true, color: '#cfeaff' }, o);
  return { rgb, mix, box, cyl, frustum, sphere, plate, db, ring, matrix, page, arrow, dot, label, add };
})();
