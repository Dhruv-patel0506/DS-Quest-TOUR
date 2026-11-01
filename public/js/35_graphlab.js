'use strict';
/* =====================================================================
   Graph Lab (#/graphlab): write matplotlib code and SEE the graph, drag the points and watch the code change, and replay how the line is drawn.
   Left: a drawing board with draggable points and an animated "pen". Right: the code and the real matplotlib figure.
   Code and picture stay in step both ways: dragging rewrites the x = [...] and y = [...] lines; editing those lines moves the points.
   ===================================================================== */
const GL = (() => {
  const W = 520, H = 360, ML = 46, MR = 14, MT = 14, MB = 38, XMAX = 10, YMAX = 10;
  const sx = v => ML + v / XMAX * (W - ML - MR), sy = v => H - MB - v / YMAX * (H - MT - MB);
  const ix = px => (px - ML) / (W - ML - MR) * XMAX, iy = py => (H - MB - py) / (H - MT - MB) * YMAX;
  const clamp1 = v => Math.max(0, Math.min(10, Math.round(v * 10) / 10));
  const START = [[1, 2.2], [2, 3.4], [3, 3.0], [4, 5.1], [5, 5.8], [6, 5.2], [7, 7.4], [8, 8.1]];
  const HEAD = (xs, ys) => `import matplotlib.pyplot as plt\nimport numpy as np\n\n# Your data. Drag the points in the picture and these two lists change.\nx = [${xs}]\ny = [${ys}]\n\n`;
  const BODY = {
    line: `fig, ax = plt.subplots(figsize=(6, 4))\nax.plot(x, y, marker="o", color="tab:blue")\nax.set_title("A line chart")\nax.set_xlabel("x")\nax.set_ylabel("y")\nax.grid(alpha=0.3)\nplt.show()`,
    scatter: `fig, ax = plt.subplots(figsize=(6, 4))\nax.scatter(x, y, s=70, color="tab:orange")\nax.set_title("A scatter plot")\nax.set_xlabel("x")\nax.set_ylabel("y")\nax.grid(alpha=0.3)\nplt.show()`,
    bar: `fig, ax = plt.subplots(figsize=(6, 4))\nax.bar(x, y, color="tab:green")\nax.set_title("A bar chart")\nax.set_xlabel("x")\nax.set_ylabel("y")\nplt.show()`,
    fit: `slope, intercept = np.polyfit(x, y, 1)\nprint("slope", round(slope, 2), "intercept", round(intercept, 2))\nfig, ax = plt.subplots(figsize=(6, 4))\nax.scatter(x, y, s=60, color="tab:blue", label="data")\nax.plot(x, slope * np.array(x) + intercept, color="tab:red", label="best line")\nax.set_title("The best straight line through the points")\nax.legend()\nax.grid(alpha=0.3)\nplt.show()`,
  };
  const fmt = a => a.map(v => String(Math.round(v * 10) / 10)).join(', ');
  const parse = (code, name) => { const m = new RegExp('^' + name + '\\s*=\\s*\\[([^\\]]*)\\]', 'm').exec(code); if (!m) return null; const v = m[1].split(',').map(s => s.trim()).filter(Boolean).map(Number); return v.every(Number.isFinite) ? v : null; };
  const setList = (code, name, vals) => code.replace(new RegExp('^(' + name + '\\s*=\\s*\\[)[^\\]]*(\\])', 'm'), (_, a, b) => a + fmt(vals) + b);
  return { W, H, ML, MR, MT, MB, sx, sy, ix, iy, clamp1, START, HEAD, BODY, fmt, parse, setList };
})();

function viewGraphLab() {
  const root = h('div', { class: 'stack graphlab' });
  let kind = 'line', pts = GL.START.map(p => ({ x: p[0], y: p[1] })), anim = null, runTimer = null, syncing = false, runSeq = 0;
  const codeFor = k => GL.HEAD(GL.fmt(pts.map(p => p.x)), GL.fmt(pts.map(p => p.y))) + GL.BODY[k];
  const status = h('span', { class: 'chip' }), note = h('div', { class: 'muted', style: { fontSize: '13px' }, role: 'status' });
  const edBox = h('div', {}), out = h('div', { class: 'nbout shout' });
  const ed = Editor(edBox, { code: codeFor(kind), minLines: 18, onRun: () => run(), onChange: () => fromCode() });

  /* ---- the drawing board ---- */
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', `0 0 ${GL.W} ${GL.H}`); svg.setAttribute('class', 'gl-svg'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Drawing board: drag the dots; the line passes through them in order.');
  let g = '';
  for (let i = 0; i <= 10; i += 2) { g += `<line x1="${GL.sx(i)}" x2="${GL.sx(i)}" y1="${GL.MT}" y2="${GL.H - GL.MB}" class="gl-grid"/><line x1="${GL.ML}" x2="${GL.W - GL.MR}" y1="${GL.sy(i)}" y2="${GL.sy(i)}" class="gl-grid"/><text x="${GL.sx(i)}" y="${GL.H - GL.MB + 16}" class="gl-tick" text-anchor="middle">${i}</text><text x="${GL.ML - 8}" y="${GL.sy(i) + 4}" class="gl-tick" text-anchor="end">${i}</text>`; }
  svg.innerHTML = `<rect x="${GL.ML}" y="${GL.MT}" width="${GL.W - GL.ML - GL.MR}" height="${GL.H - GL.MT - GL.MB}" class="gl-plot"/>${g}<line x1="${GL.ML}" x2="${GL.ML}" y1="${GL.MT}" y2="${GL.H - GL.MB}" class="gl-axis"/><line x1="${GL.ML}" x2="${GL.W - GL.MR}" y1="${GL.H - GL.MB}" y2="${GL.H - GL.MB}" class="gl-axis"/><text x="${GL.W / 2}" y="${GL.H - 4}" class="gl-lab" text-anchor="middle">x</text><text x="12" y="${GL.H / 2}" class="gl-lab" text-anchor="middle" transform="rotate(-90 12 ${GL.H / 2})">y</text><g class="gl-bars"></g><path class="gl-line" d=""/><path class="gl-pen-trail" d=""/><g class="gl-dots"></g><circle class="gl-pen" r="7" cx="-20" cy="-20"/><text class="gl-read" x="${GL.ML + 8}" y="${GL.MT + 16}"></text>`;
  const pathEl = svg.querySelector('.gl-line'), trail = svg.querySelector('.gl-pen-trail'), dots = svg.querySelector('.gl-dots'), bars = svg.querySelector('.gl-bars'), pen = svg.querySelector('.gl-pen'), read = svg.querySelector('.gl-read');
  const order = () => pts.map((p, i) => i).sort((a, b) => pts[a].x - pts[b].x);
  function drawBoard() {
    const o = order(), d = o.map((i, k) => (k ? 'L' : 'M') + GL.sx(pts[i].x).toFixed(1) + ' ' + GL.sy(pts[i].y).toFixed(1)).join('');
    pathEl.setAttribute('d', kind === 'line' || kind === 'fit' ? d : ''); pathEl.style.display = kind === 'line' ? '' : 'none';
    bars.innerHTML = kind === 'bar' ? pts.map(p => `<rect x="${GL.sx(p.x) - 12}" y="${GL.sy(p.y)}" width="24" height="${GL.sy(0) - GL.sy(p.y)}" class="gl-bar"/>`).join('') : '';
    if (kind === 'fit' && pts.length > 1) { const n = pts.length, mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n, sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0), sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0), m = sxx ? sxy / sxx : 0, b = my - m * mx; pathEl.setAttribute('d', `M${GL.sx(0)} ${GL.sy(b)}L${GL.sx(10)} ${GL.sy(m * 10 + b)}`); pathEl.style.display = ''; pathEl.classList.add('gl-fit'); } else pathEl.classList.remove('gl-fit');
    let have = dots.children.length; while (have < pts.length) { const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 9); c.setAttribute('class', 'gl-dot'); c.setAttribute('tabindex', '0'); dots.appendChild(c); have++; }
    while (dots.children.length > pts.length) dots.lastChild.remove();
    [...dots.children].forEach((c, i) => { c.setAttribute('cx', GL.sx(pts[i].x)); c.setAttribute('cy', GL.sy(pts[i].y)); c.dataset.i = i; c.setAttribute('aria-label', `Point ${i + 1}: x ${pts[i].x}, y ${pts[i].y}. Arrow keys move it.`); });
  }
  /* drag, keyboard, add (click on empty board), remove (double-click) */
  let dragI = -1;
  svg.addEventListener('pointerdown', e => { const c = e.target.closest && e.target.closest('.gl-dot'); if (c) { dragI = +c.dataset.i; svg.setPointerCapture(e.pointerId); c.classList.add('on'); stopAnim(); e.preventDefault(); } });
  const toData = e => { const r = svg.getBoundingClientRect(), k = GL.W / r.width; return { x: GL.clamp1(GL.ix((e.clientX - r.left) * k)), y: GL.clamp1(GL.iy((e.clientY - r.top) * k)) }; };
  svg.addEventListener('pointermove', e => { if (dragI < 0) return; const p = toData(e); pts[dragI].x = p.x; pts[dragI].y = p.y; drawBoard(); toCode(false); read.textContent = `point ${dragI + 1}: x = ${p.x}, y = ${p.y}`; });
  const endDrag = () => { if (dragI < 0) return; [...dots.children].forEach(c => c.classList.remove('on')); dragI = -1; read.textContent = ''; toCode(true); };
  svg.addEventListener('pointerup', endDrag); svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('dblclick', e => { const c = e.target.closest && e.target.closest('.gl-dot'); if (c && pts.length > 2) { pts.splice(+c.dataset.i, 1); drawBoard(); toCode(true); } });
  svg.addEventListener('click', e => { if (e.target.closest('.gl-dot') || e.detail > 1) return; if (!e.target.classList.contains('gl-plot') && !e.target.classList.contains('gl-grid')) return; if (pts.length >= 20) { note.textContent = 'Up to 20 points.'; return; } const p = toData(e); pts.push(p); drawBoard(); toCode(true); });
  svg.addEventListener('keydown', e => { const c = e.target.closest && e.target.closest('.gl-dot'); if (!c) return; const i = +c.dataset.i, step = e.shiftKey ? 1 : 0.1, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key]; if (!d) return; e.preventDefault(); pts[i].x = GL.clamp1(pts[i].x + d[0]); pts[i].y = GL.clamp1(pts[i].y + d[1]); drawBoard(); toCode(true); dots.children[i].focus(); });

  /* ---- code <-> picture ---- */
  function toCode(runNow) {
    syncing = true; let code = ed.get();
    const ok = GL.parse(code, 'x') && GL.parse(code, 'y');
    if (ok) { code = GL.setList(GL.setList(code, 'x', pts.map(p => p.x)), 'y', pts.map(p => p.y)); ed.set(code); note.textContent = 'Dragging rewrites the x and y lists in the code, then the real figure is redrawn.'; }
    else note.textContent = 'The code has no  x = [...]  and  y = [...]  lines, so dragging cannot change it. Press "Reset code" to get them back.';
    syncing = false; if (runNow) schedule(350);
  }
  function fromCode() {
    if (syncing) return; const x = GL.parse(ed.get(), 'x'), y = GL.parse(ed.get(), 'y');
    if (x && y && x.length === y.length && x.length >= 2 && x.length <= 20) { pts = x.map((v, i) => ({ x: GL.clamp1(v), y: GL.clamp1(y[i]) })); drawBoard(); }
  }
  const schedule = ms => { clearTimeout(runTimer); runTimer = setTimeout(run, ms); };
  async function run() {
    clearTimeout(runTimer); const my = ++runSeq; status.textContent = 'drawing...'; out.innerHTML = '';
    const r = await Py.cell(ed.get(), 120000); if (my !== runSeq) return;
    status.textContent = r.error ? 'error in the code' : 'figure ready'; nbOutput(out, r); out.classList.toggle('bad', !!r.error);
  }

  /* ---- the animated pen: the line is drawn through the points, one after another ---- */
  function stopAnim() { if (anim) { cancelAnimationFrame(anim.raf); anim = null; } trail.setAttribute('d', ''); pen.setAttribute('cx', -20); pen.setAttribute('cy', -20); [...dots.children].forEach(c => c.classList.remove('hit')); if (pathEl.dataset.hide) { pathEl.style.opacity = ''; delete pathEl.dataset.hide; } }
  function play() {
    stopAnim(); const o = order(); if (o.length < 2) return; const P = o.map(i => [GL.sx(pts[i].x), GL.sy(pts[i].y)]); pathEl.style.opacity = '.18'; pathEl.dataset.hide = '1';
    const segLen = []; let total = 0; for (let k = 1; k < P.length; k++) { const l = Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]); segLen.push(l); total += l; }
    const dur = Math.max(2200, Math.min(7000, total * 9)), t0 = performance.now(); anim = { raf: 0 }; let reached = -1;
    const frame = now => {
      if (!anim) return; const f = Math.min(1, (now - t0) / dur); let d = f * total, k = 0; while (k < segLen.length - 1 && d > segLen[k]) { d -= segLen[k]; k++; }
      const t = segLen[k] ? Math.min(1, d / segLen[k]) : 1, x = P[k][0] + (P[k + 1][0] - P[k][0]) * t, y = P[k][1] + (P[k + 1][1] - P[k][1]) * t;
      pen.setAttribute('cx', x); pen.setAttribute('cy', y);
      trail.setAttribute('d', P.slice(0, k + 1).map((p, j) => (j ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('') + 'L' + x.toFixed(1) + ' ' + y.toFixed(1));
      const near = f >= 1 ? P.length - 1 : (t > 0.985 ? k + 1 : k); if (near > reached) { reached = near; dots.children[o[near]] && dots.children[o[near]].classList.add('hit'); read.textContent = `through point ${near + 1} of ${P.length}: x = ${pts[o[near]].x}, y = ${pts[o[near]].y}`; }
      if (f < 1) anim.raf = requestAnimationFrame(frame); else setTimeout(() => { if (anim) { stopAnim(); read.textContent = ''; } }, 900);
    }; anim.raf = requestAnimationFrame(frame);
  }

  /* ---- layout ---- */
  const kinds = [['line', 'Line'], ['scatter', 'Scatter'], ['bar', 'Bars'], ['fit', 'Best-fit line']];
  const kindBtns = kinds.map(([k, label]) => h('button', { type: 'button', class: 'btn sm' + (k === kind ? ' primary' : ''), 'data-k': k, onclick: () => { kind = k; syncing = true; ed.set(codeFor(k)); syncing = false; kindBtns.forEach(b => b.classList.toggle('primary', b.dataset.k === k)); drawBoard(); run(); } }, label));
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Workshop'), h('h1', {}, 'Graph Lab'), h('p', { class: 'muted lead' }, 'Write the code, see the graph. Drag a point and watch the numbers in the code change; edit the numbers and watch the point move. Press "Show how the line is drawn" to see the pen travel through the points one by one.'))));
  root.append(h('div', { class: 'gl-grid2' },
    h('div', { class: 'card pad stack' }, h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, kindBtns), svg,
      h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn primary', type: 'button', onclick: play }, '▶ Show how the line is drawn'), h('button', { class: 'btn', type: 'button', onclick: () => { stopAnim(); pts = GL.START.map(p => ({ x: p[0], y: p[1] })); drawBoard(); syncing = true; ed.set(codeFor(kind)); syncing = false; run(); } }, 'Reset'),
        h('span', { class: 'muted', style: { fontSize: '12.5px' } }, 'Click empty space to add a point, double-click a point to remove it, arrow keys move a focused point.'))),
    h('div', { class: 'card pad stack' }, h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' } }, h('h3', { style: { margin: 0 } }, 'Code'), h('div', { class: 'row', style: { gap: '8px' } }, status, h('button', { class: 'btn primary sm', type: 'button', onclick: () => run() }, '▶ Run'))),
      edBox, note, h('h3', { style: { margin: '6px 0 0' } }, 'The real matplotlib figure'), out)));
  drawBoard(); setTimeout(run, 60); App.dis.push(() => { stopAnim(); clearTimeout(runTimer); });
  return root;
}
