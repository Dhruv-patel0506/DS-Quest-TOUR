'use strict';
/* =====================================================================
   Visual library core
   - mountViz(spec): builds a card {controls | stage | output | caption} and calls DSQ.viz[spec.viz](ctx, spec.args)
   - compileExpr(): safe expression parser for equations (x, y, sin, cos, exp, ...), also prints the NumPy form
   - Plot3D(): small canvas 3D engine (drag to rotate) used by surfaces, cubes, planes, descent paths
   - viz.sketch: type an equation, the curve draws itself;  viz.surface3d: z = f(x,y) draws itself in 3D
   ===================================================================== */
const SVGNS = 'http://www.w3.org/2000/svg';
const svgOpen = (w, hh, extra = '') => `<svg viewBox="0 0 ${w} ${hh}" xmlns="${SVGNS}" ${extra}>`;
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const COLS = ['--c0', '--c1', '--c2', '--c3', '--c4', '--c5', '--c6'];
const colv = i => `var(${COLS[((i % 7) + 7) % 7]})`;
const colSoft = i => `var(--c${((i % 7) + 7) % 7}s)`;

function mountViz(spec) {
  const fn = DSQ.viz[spec.viz];
  const ctl = h('div', { class: 'ctl' }), stage = h('div', { class: 'stage' }), out = h('div', { class: 'out', hidden: true });
  const cap = h('div', { class: 'cap', html: inl(spec.caption || '') });
  const box = h('div', { class: 'card viz' }, ctl, stage, out, spec.caption ? cap : null);
  const dead = [];
  const ctx = {
    ctl, stage, out, cap, args: spec.args || {}, spec, onDestroy: f => dead.push(f), box,
    slider(label, min, max, step, val, on, show) {
      const v = h('b', {}, show ? show(val) : val), i = h('input', { type: 'range', min, max, step, value: val });
      i.addEventListener('input', () => { v.textContent = show ? show(+i.value) : i.value; on(+i.value); });
      ctl.append(h('label', {}, label, i, v)); return i;
    },
    select(label, opts, val, on) {
      const s = h('select', {}, opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(v) === String(val) }, t); }));
      s.addEventListener('change', () => on(s.value)); ctl.append(h('label', {}, label, s)); return s;
    },
    text(label, val, on, width) {
      const i = h('input', { type: 'text', value: val, spellcheck: 'false', style: width ? { minWidth: width } : null });
      let tm; i.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => on(i.value), 260); });
      ctl.append(h('label', {}, label, i)); return i;
    },
    button(label, on) { const b = h('button', { class: 'btn sm', type: 'button' }, label); b.addEventListener('click', on); ctl.append(b); return b; },
    say(html) { out.hidden = !html; out.innerHTML = html || ''; },
  };
  if (!fn) { stage.append(h('p', { class: 'muted' }, 'Visual "' + spec.viz + '" is not available.')); return box; }
  let r; try { r = fn(ctx, ctx.args); } catch (e) { console.error(e); stage.append(h('p', { class: 'muted' }, 'This visual hit an error: ' + e.message)); }
  if (!ctl.children.length) ctl.hidden = true;
  box._destroy = () => { dead.forEach(f => { try { f(); } catch (e) { } }); r && r.destroy && r.destroy(); };
  return box;
}
DSQ.mountViz = mountViz;

/* ---------------------------------------------------------------------
   Expression compiler:  "sin(x)*x/3 + 2x^2"  ->  {fn(vars), py, ast}
   --------------------------------------------------------------------- */
const MF = { sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, log: Math.log, ln: Math.log, sqrt: Math.sqrt, abs: Math.abs, tanh: Math.tanh, floor: Math.floor, ceil: Math.ceil, sign: Math.sign, arctan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, min: Math.min, max: Math.max, pow: Math.pow, sigmoid: x => 1 / (1 + Math.exp(-x)), relu: x => Math.max(0, x) };
const PYF = { ln: 'np.log', log: 'np.log', arctan: 'np.arctan', sigmoid: 'sigmoid', relu: 'relu', min: 'np.minimum', max: 'np.maximum', pow: 'np.power' };
function compileExpr(src, vars = ['x']) {
  const s = String(src).replace(/\s+/g, '').replace(/\*\*/g, '^').replace(/π/g, 'pi');
  if (!s) throw new Error('empty');
  const re = /(\d+\.?\d*(?:e[-+]?\d+)?|\.\d+)|([a-zA-Z_]\w*)|([-+*\/^(),])/y;
  const toks = []; let pos = 0, m;
  while (pos < s.length) { re.lastIndex = pos; m = re.exec(s); if (!m) throw new Error('unexpected "' + s[pos] + '"'); toks.push(m[1] ? { n: +m[1] } : m[2] ? { id: m[2] } : { op: m[3] }); pos = re.lastIndex; }
  let i = 0; const peek = () => toks[i], eat = () => toks[i++];
  const isOp = (t, o) => t && t.op === o;
  function expr() { let l = term(); while (peek() && (isOp(peek(), '+') || isOp(peek(), '-'))) { const o = eat().op; l = ['b', o, l, term()]; } return l; }
  function term() {
    let l = unary();
    for (; ;) {
      const t = peek(); if (!t) break;
      if (isOp(t, '*') || isOp(t, '/')) { eat(); l = ['b', t.op, l, unary()]; }
      else if (t.n != null || t.id || isOp(t, '(')) l = ['b', '*', l, unary()];          // implicit multiplication: 2x, 3(x+1)
      else break;
    }
    return l;
  }
  function unary() { if (isOp(peek(), '-')) { eat(); return ['u', unary()]; } if (isOp(peek(), '+')) { eat(); return unary(); } return power(); }
  function power() { const b = atom(); if (isOp(peek(), '^')) { eat(); return ['b', '^', b, unary()]; } return b; }
  function atom() {
    const t = eat(); if (!t) throw new Error('unfinished');
    if (t.n != null) return ['n', t.n];
    if (t.id) {
      if (isOp(peek(), '(')) {
        eat(); const args = []; if (!isOp(peek(), ')')) { args.push(expr()); while (isOp(peek(), ',')) { eat(); args.push(expr()); } }
        if (!isOp(eat(), ')')) throw new Error('missing )');
        if (!MF[t.id]) throw new Error('unknown function ' + t.id); return ['f', t.id, args];
      }
      if (t.id === 'pi') return ['n', Math.PI]; if (t.id === 'e') return ['n', Math.E];
      if (!vars.includes(t.id)) throw new Error('unknown name ' + t.id); return ['v', t.id];
    }
    if (isOp(t, '(')) { const e = expr(); if (!isOp(eat(), ')')) throw new Error('missing )'); return e; }
    throw new Error('unexpected ' + (t.op || ''));
  }
  const ast = expr(); if (i < toks.length) throw new Error('unexpected ' + JSON.stringify(toks[i]).slice(0, 12));
  const ev = (a, v) => {
    switch (a[0]) {
      case 'n': return a[1]; case 'v': return v[a[1]]; case 'u': return -ev(a[1], v);
      case 'b': { const l = ev(a[2], v), r = ev(a[3], v); return a[1] === '+' ? l + r : a[1] === '-' ? l - r : a[1] === '*' ? l * r : a[1] === '/' ? l / r : Math.pow(l, r); }
      case 'f': return MF[a[1]](...a[2].map(x => ev(x, v)));
    }
  };
  const num = x => (Number.isInteger(x) ? String(x) : (Math.abs(x - Math.PI) < 1e-12 ? 'np.pi' : Math.abs(x - Math.E) < 1e-12 ? 'np.e' : String(+x.toPrecision(6))));
  const py = (a, top) => {
    switch (a[0]) {
      case 'n': return num(a[1]); case 'v': return a[1]; case 'u': return '-' + py(a[1]);
      case 'b': { const o = a[1] === '^' ? '**' : a[1]; const t = py(a[2]) + ' ' + o + ' ' + py(a[3]); return top ? t : '(' + t + ')'; }
      case 'f': return (PYF[a[1]] || 'np.' + a[1]) + '(' + a[2].map(x => py(x, true)).join(', ') + ')';
    }
  };
  return { fn: v => ev(ast, v), py: py(ast, true), ast };
}
DSQ.compileExpr = compileExpr;

/* nice tick values for a range, and a 2-D plot frame in "calculator" style: thin axes with numbers, minor + major grid */
function niceTicks(lo, hi, want = 8) {
  const span = hi - lo || 1, raw = span / want, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag, st = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag, out = [];
  for (let k = Math.ceil(lo / st - 1e-9); k * st <= hi + 1e-9; k++) out.push(+(k * st).toPrecision(12));
  return { step: st, ticks: out };
}
function frame2(W, H, pad, xr, yr, o = {}) {
  const [x0, x1] = xr, [y0, y1] = yr, X = x => pad.l + (x - x0) / (x1 - x0) * (W - pad.l - pad.r), Y = y => H - pad.b - (y - y0) / (y1 - y0) * (H - pad.t - pad.b);
  const tx = niceTicks(x0, x1, o.nx || 9), ty = niceTicks(y0, y1, o.ny || 7), fm = v => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v) ? v.toExponential(0) : String(+v.toFixed(4)));
  let s = '';
  if (o.grid !== false) {
    const minor = (t, f, a, b, hor) => { const st = t.step / 5; for (let v = Math.ceil(a / st) * st; v <= b + 1e-9; v += st) { const p = f(v); s += hor ? `<line x1="${pad.l}" x2="${W - pad.r}" y1="${p}" y2="${p}" class="gm"/>` : `<line y1="${pad.t}" y2="${H - pad.b}" x1="${p}" x2="${p}" class="gm"/>`; } };
    minor(tx, X, x0, x1, false); minor(ty, Y, y0, y1, true);
    tx.ticks.forEach(v => { s += `<line y1="${pad.t}" y2="${H - pad.b}" x1="${X(v)}" x2="${X(v)}" class="gM"/>`; });
    ty.ticks.forEach(v => { s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(v)}" y2="${Y(v)}" class="gM"/>`; });
  }
  s += `<rect x="${pad.l}" y="${pad.t}" width="${W - pad.l - pad.r}" height="${H - pad.t - pad.b}" class="fr"/>`;
  if (x0 < 0 && x1 > 0) s += `<line x1="${X(0)}" x2="${X(0)}" y1="${pad.t}" y2="${H - pad.b}" class="ax0"/>`;
  if (y0 < 0 && y1 > 0) s += `<line y1="${Y(0)}" y2="${Y(0)}" x1="${pad.l}" x2="${W - pad.r}" class="ax0"/>`;
  tx.ticks.forEach(v => { s += `<line x1="${X(v)}" x2="${X(v)}" y1="${H - pad.b}" y2="${H - pad.b + 4}" class="tk"/><text x="${X(v)}" y="${H - pad.b + 15}" text-anchor="middle" class="tkl">${fm(v)}</text>`; });
  ty.ticks.forEach(v => { s += `<line y1="${Y(v)}" y2="${Y(v)}" x1="${pad.l - 4}" x2="${pad.l}" class="tk"/><text y="${Y(v) + 3.5}" x="${pad.l - 7}" text-anchor="end" class="tkl">${fm(v)}</text>`; });
  if (o.xl) s += `<text x="${(pad.l + W - pad.r) / 2}" y="${H - 4}" text-anchor="middle" class="axl">${o.xl}</text>`;
  if (o.yl) s += `<text transform="translate(11 ${(pad.t + H - pad.b) / 2}) rotate(-90)" text-anchor="middle" class="axl">${o.yl}</text>`;
  return { svg: s, X, Y, ix: px => x0 + (px - pad.l) / (W - pad.l - pad.r) * (x1 - x0), iy: py => y0 + (H - pad.b - py) / (H - pad.t - pad.b) * (y1 - y0), box: [pad.l, pad.t, W - pad.r, H - pad.b] };
}
DSQ.niceTicks = niceTicks; DSQ.frame2 = frame2;

/* ---------------------------------------------------------------------
   Plot3D: orthographic canvas engine. Items:
     {t:'poly',pts:[[x,y,z]..],fill,stroke,t0}  {t:'line',a,b,color,w,dash,t0}  {t:'pt',p,r,color,t0}  {t:'txt',p,s,color,t0}
   draw(prog): items with t0 <= prog are visible (progressive reveal).  Drag to rotate.
   --------------------------------------------------------------------- */
function Plot3D(host, o = {}) {
  const W = o.w || 640, H = o.h || 420, dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = h('canvas', { width: W * dpr, height: H * dpr, 'aria-label': o.label || '3D plot (drag to rotate)', role: 'img' });
  cv.style.aspectRatio = W + '/' + H; host.append(cv);
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  let az = o.az ?? .75, el = o.el ?? .5, items = [], center = [0, 0, 0], span = 10, prog = 1, spin = false, raf = 0, dragging = false, zoom = o.zoom || 1, panning = false;
  const api = {
    cv,
    set(its, c, sp) { items = its; if (c) center = c; if (sp) span = sp; },
    draw(p) { if (p != null) prog = p; render(); },
    spin(on) { spin = on; if (on && !raf) loop(); },
    destroy() { spin = false; cancelAnimationFrame(raf); },
    view: () => ({ az, el }),
    proj: p => proj(p),
    unproject(sx, sy, z) { const ce = Math.cos(el), se = Math.sin(el), sc = Math.min(W, H) * .42 / span * zoom; if (Math.abs(se) < .06) return null; const x1 = (sx - W / 2) / sc, y1 = ((H / 2 - sy) / sc - (z - center[2]) * ce) / se, ca = Math.cos(az), sa = Math.sin(az); return [x1 * ca + y1 * sa + center[0], -x1 * sa + y1 * ca + center[1]]; },
    local: e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; },
    onClick: null, onHover: null, grid: true, set3d: (a, e) => { az = a; el = e; render(); },
    /* optional point dragging: grab(cx, cy) -> true claims the gesture (no rotation); onGrabMove(dx, dy) in canvas pixels; onGrabEnd() */
    grab: null, onGrabMove: null, onGrabEnd: null, scale: () => Math.min(W, H) * .42 / span * zoom, size: { W, H },
    /* zoom about the current centre (focus() first to stay in the middle of a cluster), pan the view, read the camera */
    zoomBy(f) { zoom = Math.max(.15, Math.min(60, zoom * f)); render(); }, getZoom: () => zoom, resetZoom() { zoom = o.zoom || 1; render(); },
    focus(c, sp) { center = c.slice(); if (sp) span = sp; render(); }, getCenter: () => center.slice(),
    pan(dx, dy) { const { az: a, el: e } = { az, el }, s = Math.min(W, H) * .42 / span * zoom, ca = Math.cos(a), sa = Math.sin(a), ce = Math.cos(e), se = Math.sin(e), dx1 = dx / s, dz = -ce * dy / s, dy1 = -se * dy / s; center = [center[0] - (dx1 * ca + dy1 * sa), center[1] - (-dx1 * sa + dy1 * ca), center[2] - dz]; render(); },
  };
  const proj = p => {
    const x = p[0] - center[0], y = p[1] - center[1], z = p[2] - center[2];
    const ca = Math.cos(az), sa = Math.sin(az), x1 = x * ca - y * sa, y1 = x * sa + y * ca;
    const ce = Math.cos(el), se = Math.sin(el), sc = Math.min(W, H) * .42 / span * zoom;
    return [W / 2 + x1 * sc, H / 2 - (z * ce + y1 * se) * sc, y1 * ce - z * se];
  };
  function render() {
    g.clearRect(0, 0, W, H);
    const fg = cssv('--fg') || '#222', mu = cssv('--muted') || '#777', ln = cssv('--line') || '#ccc';
    const vis = items.filter(it => (it.t0 || 0) <= prog + 1e-9 && (!it.g || api.grid)).map(it => {
      let d = 0, pj;
      if (it.t === 'poly') { pj = it.pts.map(proj); d = sum(pj.map(q => q[2])) / pj.length; }
      else if (it.t === 'line') { pj = [proj(it.a), proj(it.b)]; d = (pj[0][2] + pj[1][2]) / 2; }
      else { pj = [proj(it.p)]; d = pj[0][2]; if (it.t === 'txt') d = 1e9; }
      return { it, pj, d };
    }).sort((a, b) => b.d - a.d);
    for (const { it, pj } of vis) {
      if (it.t === 'poly') {
        g.beginPath(); pj.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
        g.globalAlpha = it.alpha ?? 1; g.fillStyle = it.fill || 'rgba(100,150,255,.4)'; g.fill(); g.globalAlpha = 1;
        if (it.stroke !== false) { g.strokeStyle = it.stroke || ln; g.lineWidth = it.sw || .6; g.stroke(); }
      } else if (it.t === 'line') {
        g.beginPath(); g.moveTo(pj[0][0], pj[0][1]); g.lineTo(pj[1][0], pj[1][1]); g.strokeStyle = it.color || mu; g.lineWidth = Math.min(it.w || 1.2, 2.4) * .72;
        g.setLineDash(it.dash || []); g.stroke(); g.setLineDash([]);
      } else if (it.t === 'pt') {
        g.beginPath(); g.arc(pj[0][0], pj[0][1], Math.max(2, (it.r || 3.5) * .6), 0, 6.3); g.fillStyle = it.color || '#2F6FE0'; g.fill();
        g.strokeStyle = it.ring || 'rgba(0,0,0,.35)'; g.lineWidth = it.ring ? 1 : .6; g.stroke();
      } else if (it.t === 'txt') {
        g.font = (it.bold ? '700 ' : '500 ') + (it.size || 12) + 'px ' + (it.mono ? 'JetBrains Mono, monospace' : 'Plus Jakarta Sans, sans-serif');
        g.textAlign = it.align || 'center';
        if (it.bg) { const w = g.measureText(it.s).width + 12, sz = it.size || 12; g.fillStyle = cssv('--surface') || '#fff'; g.globalAlpha = .88; g.beginPath(); g.roundRect ? g.roundRect(pj[0][0] - w / 2, pj[0][1] - sz - 1, w, sz + 8, 7) : g.rect(pj[0][0] - w / 2, pj[0][1] - sz - 1, w, sz + 8); g.fill(); g.globalAlpha = 1; }
        g.fillStyle = it.color || fg; g.fillText(it.s, pj[0][0], pj[0][1]);
      }
    }
  }
  let px = 0, py = 0;
  let moved = 0;
  let gdrag = false;
  cv.addEventListener('pointerdown', e => { if (api.grab && api.grab(...api.local(e), e)) { gdrag = true; px = e.clientX; py = e.clientY; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'move'; return; } if ((e.shiftKey || e.button === 2) && o.wheel) { panning = true; px = e.clientX; py = e.clientY; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'move'; return; } dragging = true; moved = 0; px = e.clientX; py = e.clientY; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; spin = false; });
  cv.addEventListener('pointerleave', () => { api.onHover && api.onHover(null); });
  cv.addEventListener('pointermove', e => { if (panning) { const r = cv.getBoundingClientRect(); api.pan((e.clientX - px) * W / r.width, (e.clientY - py) * H / r.height); px = e.clientX; py = e.clientY; return; } if (gdrag) { const r = cv.getBoundingClientRect(); api.onGrabMove && api.onGrabMove((e.clientX - px) * W / r.width, (e.clientY - py) * H / r.height, e); px = e.clientX; py = e.clientY; return; } if (!dragging) { api.onHover && api.onHover(...api.local(e)); return; } moved += Math.abs(e.clientX - px) + Math.abs(e.clientY - py); az += (e.clientX - px) * .01; el = clamp(el + (e.clientY - py) * .008, -.1, 1.45); px = e.clientX; py = e.clientY; render(); });
  const up = e => { if (panning) { panning = false; cv.style.cursor = 'grab'; return; } if (gdrag) { gdrag = false; cv.style.cursor = 'grab'; api.onGrabEnd && api.onGrabEnd(); return; } if (dragging && moved < 5 && api.onClick && e && e.clientX != null) api.onClick(...api.local(e)); dragging = false; cv.style.cursor = 'grab'; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { dragging = false; gdrag = false; panning = false; });
  if (o.wheel) { cv.addEventListener('wheel', e => { e.preventDefault(); api.zoomBy(Math.exp(-e.deltaY * .0016)); }, { passive: false }); cv.addEventListener('contextmenu', e => e.preventDefault()); }
  function loop() { if (!spin) { raf = 0; return; } az += .006; render(); raf = requestAnimationFrame(loop); }
  return api;
}
DSQ.Plot3D = Plot3D;

const heat = t => {     /* 0..1 -> blue, teal, green, gold, orange */
  const st = [[47, 111, 224], [14, 143, 163], [30, 142, 90], [184, 134, 11], [210, 96, 15]], k = clamp(t, 0, .9999) * (st.length - 1), i = Math.floor(k), f = k - i;
  return `rgb(${st[i].map((v, j) => Math.round(lerp(v, st[i + 1][j], f))).join(',')})`;
};
function axes3(span, labels = ['x', 'y', 'z'], c = [0, 0, 0], ticks = true) {
  const L = [], col = ['#D03A3A', '#1F9D55', '#2F6FE0'], st = span > 7 ? 2 : span > 3 ? 1 : span > 1.4 ? .5 : .25, mu = '#9AA5A0', gl = 'rgba(130,145,140,.28)';
  const n = Math.floor(span / st + 1e-9), fmt = v => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(2).replace(/0$/, ''));
  for (let k = -n; k <= n; k++) {      /* floor grid + the two back walls: thin, toggleable */
    const v = k * st;
    L.push({ t: 'line', a: [c[0] + v, c[1] - span, c[2] - span], b: [c[0] + v, c[1] + span, c[2] - span], color: gl, w: .8, g: true });
    L.push({ t: 'line', a: [c[0] - span, c[1] + v, c[2] - span], b: [c[0] + span, c[1] + v, c[2] - span], color: gl, w: .8, g: true });
    L.push({ t: 'line', a: [c[0] + v, c[1] + span, c[2] - span], b: [c[0] + v, c[1] + span, c[2] + span], color: gl, w: .8, g: true });
    L.push({ t: 'line', a: [c[0] - span, c[1] + span, c[2] + v], b: [c[0] + span, c[1] + span, c[2] + v], color: gl, w: .8, g: true });
  }
  L.push({ t: 'line', a: [c[0] - span, c[1], c[2]], b: [c[0] + span, c[1], c[2]], color: col[0], w: 1.6 });
  L.push({ t: 'line', a: [c[0], c[1] - span, c[2]], b: [c[0], c[1] + span, c[2]], color: col[1], w: 1.6 });
  L.push({ t: 'line', a: [c[0], c[1], c[2] - span], b: [c[0], c[1], c[2] + span], color: col[2], w: 1.6 });
  if (ticks) for (let k = -n; k <= n; k++) {
    if (!k) continue; const v = k * st, o = span * .035;
    L.push({ t: 'line', a: [c[0] + v, c[1] - o, c[2]], b: [c[0] + v, c[1] + o, c[2]], color: col[0], w: 1 });
    L.push({ t: 'line', a: [c[0] - o, c[1] + v, c[2]], b: [c[0] + o, c[1] + v, c[2]], color: col[1], w: 1 });
    L.push({ t: 'line', a: [c[0] - o, c[1], c[2] + v], b: [c[0] + o, c[1], c[2] + v], color: col[2], w: 1 });
    if (k % Math.max(1, Math.round(n / 4)) === 0) {
      L.push({ t: 'txt', p: [c[0] + v, c[1] - span * .09, c[2]], s: fmt(c[0] + v), color: col[0], size: 9.5, mono: true });
      L.push({ t: 'txt', p: [c[0] - span * .09, c[1] + v, c[2]], s: fmt(c[1] + v), color: col[1], size: 9.5, mono: true });
      L.push({ t: 'txt', p: [c[0] - span * .09, c[1], c[2] + v], s: fmt(c[2] + v), color: col[2], size: 9.5, mono: true, align: 'right' });
    }
  }
  L.push({ t: 'txt', p: [c[0] + span * 1.1, c[1], c[2]], s: labels[0], bold: true, color: col[0] }); L.push({ t: 'txt', p: [c[0], c[1] + span * 1.1, c[2]], s: labels[1], bold: true, color: col[1] }); L.push({ t: 'txt', p: [c[0], c[1], c[2] + span * 1.12], s: labels[2], bold: true, color: col[2] });
  return L;
}
DSQ.axes3 = axes3;

/* ---------------------------------------------------------------------
   viz.sketch : equation sketcher. args:{expr, a, b, n, showCode}
   --------------------------------------------------------------------- */
DSQ.viz.sketch = (c, a) => {
  let expr = a.expr || 'sin(x) * x / 3', lo = a.a ?? -6.3, hi = a.b ?? 6.3, n = a.n || 60, cancel = null;
  const W = 640, Hh = 330, M = { l: 44, r: 16, t: 14, b: 30 };
  const draw = () => {
    cancel && cancel();
    let f; try { f = compileExpr(expr, ['x']); f.fn({ x: 0 }); } catch (e) { c.say(`<span class="r">Cannot read that equation: ${esc(e.message)}</span>`); return; }
    const xs = range(n).map(i => lo + (hi - lo) * i / (n - 1)), ys = xs.map(x => f.fn({ x }));
    const fin = ys.filter(Number.isFinite); if (!fin.length) { c.say('<span class="r">No finite values in this range</span>'); return; }
    let y0 = Math.min(...fin), y1 = Math.max(...fin); if (Math.abs(y1 - y0) < 1e-9) { y0 -= 1; y1 += 1; }
    const pad = (y1 - y0) * .08; y0 -= pad; y1 += pad; y1 = Math.min(y1, y0 + 1e6);
    const X = x => M.l + (x - lo) / (hi - lo) * (W - M.l - M.r), Y = y => M.t + (1 - (clamp(y, y0, y1) - y0) / (y1 - y0)) * (Hh - M.t - M.b);
    const pts = xs.map((x, i) => [X(x), Y(ys[i]), Number.isFinite(ys[i])]);
    const d = pts.filter(p => p[2]).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    const zx = lo <= 0 && hi >= 0 ? X(0) : null, zy = y0 <= 0 && y1 >= 0 ? Y(0) : null;
    const tx = range(5).map(i => lo + (hi - lo) * i / 4), ty = range(5).map(i => y0 + (y1 - y0) * i / 4);
    const base = `${svgOpen(W, Hh)}` +
      range(5).map(i => `<line x1="${X(tx[i])}" x2="${X(tx[i])}" y1="${M.t}" y2="${Hh - M.b}" stroke="var(--gr)"/><text class="m" x="${X(tx[i])}" y="${Hh - 10}" text-anchor="middle" font-size="11">${(+tx[i].toPrecision(3))}</text>` +
        `<line y1="${Y(ty[i])}" y2="${Y(ty[i])}" x1="${M.l}" x2="${W - M.r}" stroke="var(--gr)"/><text class="m" x="${M.l - 6}" y="${Y(ty[i]) + 4}" text-anchor="end" font-size="11">${(+ty[i].toPrecision(3))}</text>`).join('') +
      (zx != null ? `<line x1="${zx}" x2="${zx}" y1="${M.t}" y2="${Hh - M.b}" stroke="var(--ax)" stroke-width="1.5"/>` : '') +
      (zy != null ? `<line y1="${zy}" y2="${zy}" x1="${M.l}" x2="${W - M.r}" stroke="var(--ax)" stroke-width="1.5"/>` : '');
    c.stage.innerHTML = base + `<path id="skp" d="${d}" fill="none" stroke="var(--c0)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>` +
      (n <= 80 ? pts.filter(p => p[2]).map((p, i) => `<circle class="skd" data-i="${i}" cx="${p[0]}" cy="${p[1]}" r="${n <= 30 ? 4 : 2.4}" fill="var(--c1)" opacity="0"/>`).join('') : '') +
      `<circle id="skpen" r="6" fill="var(--c1)" stroke="var(--surface)" stroke-width="2" cx="${pts[0][0]}" cy="${pts[0][1]}" opacity="0"/></svg>`;
    const path = $('#skp', c.stage), pen = $('#skpen', c.stage), dots = $$('.skd', c.stage), len = path.getTotalLength();
    cancel = anim(1500, t => {
      path.style.strokeDashoffset = 1 - t; pen.setAttribute('opacity', t > 0 && t < 1 ? 1 : 0);
      const pt = path.getPointAtLength(len * t); pen.setAttribute('cx', pt.x); pen.setAttribute('cy', pt.y);
      dots.forEach((dd, i) => dd.setAttribute('opacity', t * dots.length > i ? 1 : 0));
    });
    c.say(`<span class="y">x</span> = np.linspace(${+lo.toFixed(2)}, ${+hi.toFixed(2)}, ${n})\n<span class="y">y</span> = ${esc(f.py)}\n<span class="g"># ${n} sample points, joined by straight segments -> the curve you see</span>`);
  };
  if (a.editable !== false) c.text('y =', expr, v => { expr = v; draw(); }, '16em');
  c.slider('points n', 4, 200, 1, n, v => { n = v; draw(); });
  c.slider('x from', -10, 0, .5, lo, v => { lo = v; draw(); });
  c.slider('x to', .5, 10, .5, hi, v => { hi = v; draw(); });
  c.button('Redraw', draw);
  draw();
  return { destroy: () => cancel && cancel() };
};

/* ---------------------------------------------------------------------
   viz.surface3d : z = f(x,y) drawn in 3D, reveals row by row. args:{expr, r}
   --------------------------------------------------------------------- */
DSQ.viz.surface3d = (c, a) => {
  let expr = a.expr || 'sin(sqrt(x^2 + y^2)) * 2', R = a.r || 4, N = 24, p3 = null, cancel = null;
  p3 = Plot3D(c.stage, { w: 640, h: 420, az: .8, el: .55 });
  c.onDestroy(() => { p3.destroy(); cancel && cancel(); });
  const draw = () => {
    cancel && cancel(); let f;
    try { f = compileExpr(expr, ['x', 'y']); f.fn({ x: 0, y: 0 }); } catch (e) { c.say(`<span class="r">Cannot read that: ${esc(e.message)}</span>`); return; }
    const zs = []; for (let i = 0; i <= N; i++) { zs.push([]); for (let j = 0; j <= N; j++) { const v = f.fn({ x: -R + 2 * R * i / N, y: -R + 2 * R * j / N }); zs[i].push(Number.isFinite(v) ? v : 0); } }
    const flat = zs.flat(), z0 = Math.min(...flat), z1 = Math.max(...flat), zr = Math.max(1e-6, z1 - z0), sc = R * 1.1 / Math.max(zr / 2, 1e-6) * Math.min(1, (zr / 2) / R) || 1;
    const Z = v => (v - (z0 + z1) / 2) * (R * .9 / (zr / 2 + 1e-9)) * Math.min(1, 1);
    const items = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([u, v]) => [-R + 2 * R * u / N, -R + 2 * R * v / N, Z(zs[u][v])]);
      const zm = (zs[i][j] + zs[i + 1][j] + zs[i + 1][j + 1] + zs[i][j + 1]) / 4;
      items.push({ t: 'poly', pts: q, fill: heat((zm - z0) / zr), alpha: .88, stroke: 'rgba(255,255,255,.35)', t0: (i + j * .0) / N * .9 });
    }
    axes3(R * 1.15, ['x', 'y', 'z']).forEach(it => items.push(it));
    p3.set(items, [0, 0, 0], R * 1.6);
    cancel = anim(1400, t => p3.draw(t));
    c.say(`<span class="y">x, y</span> = np.meshgrid(np.linspace(${-R}, ${R}, ${N + 1}), np.linspace(${-R}, ${R}, ${N + 1}))\n<span class="y">z</span> = ${esc(f.py)}\n<span class="g"># z ranges from ${z0.toFixed(2)} to ${z1.toFixed(2)} - drag the picture to rotate</span>`);
  };
  c.text('z =', expr, v => { expr = v; draw(); }, '18em');
  c.slider('grid', 8, 40, 2, N, v => { N = v; draw(); });
  c.button('Spin', () => p3.spin(true));
  draw();
};
