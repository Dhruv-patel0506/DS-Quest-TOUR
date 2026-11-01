'use strict';
/* =====================================================================
   Plot + ML visuals: anatomy, plotTypes, gradDescent, linfit
   ===================================================================== */
DSQ.viz.anatomy = (c, a) => {
  const parts = [
    { id: 'fig', name: 'Figure', code: 'fig = plt.figure(figsize=(8, 5))', note: 'the whole canvas / window / image file' },
    { id: 'ax', name: 'Axes', code: 'fig, ax = plt.subplots()', note: 'one plot area. A figure can hold many axes.' },
    { id: 'title', name: 'Title', code: "ax.set_title('Sales by month')", note: 'say what the picture shows' },
    { id: 'xl', name: 'x label', code: "ax.set_xlabel('Month')", note: 'name + unit of the x axis' },
    { id: 'yl', name: 'y label', code: "ax.set_ylabel('Sales (thousand)')", note: 'name + unit of the y axis' },
    { id: 'line', name: 'Line', code: "ax.plot(x, y, label='2025')", note: 'one data series' },
    { id: 'leg', name: 'Legend', code: 'ax.legend()', note: 'needs label= on each series' },
    { id: 'grid', name: 'Grid', code: 'ax.grid(alpha=0.3)', note: 'light lines to read values' },
    { id: 'tick', name: 'Ticks', code: 'ax.set_xticks([0, 1, 2, 3])', note: 'the marks and numbers on the axes' },
  ];
  let cur = 'ax';
  const W = 560, Hh = 330;
  function draw() {
    const on = id => (cur === id ? 'stroke="var(--c1)" stroke-width="4"' : ''), hi = id => (cur === id ? 'var(--c1)' : 'var(--fg)');
    const xs = range(30).map(i => 90 + i * 14), ys = xs.map((x, i) => 215 - 70 * Math.sin(i / 4.5) * (1 - i / 60) - i * 1.5);
    c.stage.innerHTML = svgOpen(W, Hh) +
      `<rect x="6" y="6" width="${W - 12}" height="${Hh - 12}" rx="10" fill="var(--surface)" stroke="var(--ax)" stroke-dasharray="6 4" ${on('fig')} class="hit" data-id="fig"/>` +
      `<rect x="78" y="48" width="440" height="222" fill="var(--paper)" stroke="var(--ax)" ${on('ax')} class="hit" data-id="ax"/>` +
      range(5).map(i => `<line x1="${78 + i * 110}" x2="${78 + i * 110}" y1="48" y2="270" stroke="${cur === 'grid' ? 'var(--c1)' : 'var(--gr)'}" stroke-width="${cur === 'grid' ? 2 : 1}"/>` + `<line y1="${48 + i * 55.5}" y2="${48 + i * 55.5}" x1="78" x2="518" stroke="${cur === 'grid' ? 'var(--c1)' : 'var(--gr)'}" stroke-width="${cur === 'grid' ? 2 : 1}"/>`).join('') +
      `<path d="M${xs.map((x, i) => x + ' ' + ys[i].toFixed(1)).join('L')}" fill="none" stroke="var(--c0)" stroke-width="${cur === 'line' ? 5 : 3}" class="hit" data-id="line" stroke-linecap="round"/>` +
      range(5).map(i => `<line x1="${78 + i * 110}" x2="${78 + i * 110}" y1="270" y2="277" stroke="${hi('tick')}" stroke-width="2"/><text class="m" x="${78 + i * 110}" y="291" text-anchor="middle" font-size="11" fill="${hi('tick')}">${i * 3}</text>`).join('') +
      range(4).map(i => `<text class="m" x="70" y="${275 - i * 55.5}" text-anchor="end" font-size="11" fill="${hi('tick')}">${i * 20}</text>`).join('') +
      `<text x="${W / 2}" y="38" text-anchor="middle" font-weight="800" font-size="16" fill="${hi('title')}" class="hit" data-id="title">Sales by month</text>` +
      `<text x="${W / 2}" y="316" text-anchor="middle" font-size="13" font-weight="700" fill="${hi('xl')}" class="hit" data-id="xl">Month</text>` +
      `<text transform="translate(22 ${160}) rotate(-90)" text-anchor="middle" font-size="13" font-weight="700" fill="${hi('yl')}" class="hit" data-id="yl">Sales (thousand)</text>` +
      `<g class="hit" data-id="leg"><rect x="396" y="58" width="112" height="30" rx="6" fill="var(--surface)" stroke="${cur === 'leg' ? 'var(--c1)' : 'var(--ax)'}" stroke-width="${cur === 'leg' ? 3 : 1}"/><line x1="404" x2="426" y1="73" y2="73" stroke="var(--c0)" stroke-width="3"/><text x="434" y="77" font-size="12">2025</text></g></svg>`;
    $$('.hit', c.stage).forEach(e => { e.style.cursor = 'pointer'; e.addEventListener('click', ev => { ev.stopPropagation(); cur = e.dataset.id; draw(); }); });
    const p = parts.find(x => x.id === cur); c.say(`<span class="y">${esc(p.name)}</span>   ${esc(p.code)}\n<span class="g"># ${esc(p.note)}</span>`);
  }
  parts.forEach(p => c.button(p.name, () => { cur = p.id; draw(); }));
  draw();
};

DSQ.viz.plotTypes = (c, a) => {
  const TY = ['line', 'scatter', 'bar', 'hist', 'box', 'pie', 'heatmap', 'area'];
  let ty = a.type || 'line', seed = 3, cancel = null;
  const CODE = {
    line: "ax.plot(x, y)                      # trends over a continuous x", scatter: "ax.scatter(x, y, c=z, s=40)         # relationship between 2 numbers", bar: "ax.bar(labels, values)             # compare categories",
    hist: "ax.hist(data, bins=15)             # distribution of one number", box: "ax.boxplot([g1, g2, g3])          # median, spread, outliers", pie: "ax.pie(parts, labels=names)        # share of a whole (use sparingly)",
    heatmap: "ax.imshow(matrix, cmap='viridis')   # a grid of values as colour", area: "ax.fill_between(x, y, alpha=0.4)   # a line with the area under it filled",
  };
  function draw() {
    cancel && cancel(); const r = RNG(seed * 31 + 5), W = 600, Hh = 330, L = 50, B = 36, T = 16, Rg = 16, pw = W - L - Rg, ph = Hh - B - T;
    const axes = `<line x1="${L}" x2="${L}" y1="${T}" y2="${Hh - B}" stroke="var(--ax)"/><line x1="${L}" x2="${W - Rg}" y1="${Hh - B}" y2="${Hh - B}" stroke="var(--ax)"/>` + range(5).map(i => `<line x1="${L}" x2="${W - Rg}" y1="${T + i * ph / 4}" y2="${T + i * ph / 4}" stroke="var(--gr)"/>`).join('');
    const N = 28, xs = range(N).map(i => i / (N - 1)), line = xs.map(x => .5 + .35 * Math.sin(x * 6) + (r() - .5) * .08), sc = xs.map(() => [r(), 0]); sc.forEach(p => { p[1] = clamp(.15 + .7 * p[0] + (r() - .5) * .3, .02, .98); });
    const bars = ['A', 'B', 'C', 'D', 'E'].map(() => .25 + r() * .7), hv = range(300).map(() => r.norm(0, 1)), hist = (() => { const k = 14, lo = -3, hi = 3, b = range(k).map(() => 0); hv.forEach(v => { const i = Math.floor((v - lo) / (hi - lo) * k); if (i >= 0 && i < k) b[i]++; }); return b; })();
    const pie = [.35, .25, .2, .12, .08], hm = range(8).map(i => range(10).map(j => Math.sin(i / 2) * Math.cos(j / 2.4) * .5 + .5 + (r() - .5) * .1));
    const boxes = [0, 1, 2].map(i => { const v = range(40).map(() => r.norm(.35 + i * .15, .08 + i * .04)).sort((x, y) => x - y); return { q1: v[10], m: v[20], q3: v[30], lo: v[1], hi: v[38], out: [v[0], v[39] + .08] }; });
    c.say(`<span class="y">${esc(CODE[ty].split('#')[0].trim())}</span>\n<span class="g">#${esc(CODE[ty].split('#')[1] || '')}</span>`);
    cancel = anim(1100, t => {
      let s = svgOpen(W, Hh), X = x => L + x * pw, Y = y => T + (1 - y) * ph;
      if (ty !== 'pie' && ty !== 'heatmap') s += axes;
      if (ty === 'line') s += `<path d="M${xs.map((x, i) => X(x).toFixed(1) + ' ' + Y(line[i]).toFixed(1)).join('L')}" fill="none" stroke="var(--c0)" stroke-width="3.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${1 - t}"/>`;
      if (ty === 'area') s += `<path d="M${X(0)} ${Y(0)}L${xs.map((x, i) => X(x).toFixed(1) + ' ' + Y(line[i] * t).toFixed(1)).join('L')}L${X(1)} ${Y(0)}Z" fill="var(--c4)" opacity=".4"/><path d="M${xs.map((x, i) => X(x).toFixed(1) + ' ' + Y(line[i] * t).toFixed(1)).join('L')}" fill="none" stroke="var(--c4)" stroke-width="3"/>`;
      if (ty === 'scatter') s += sc.map((p, i) => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="${(5 + 5 * p[0]) * seg(t, i / sc.length * .7, i / sc.length * .7 + .3)}" fill="${colv(Math.floor(p[1] * 4))}" opacity=".8"/>`).join('');
      if (ty === 'bar') s += bars.map((v, i) => `<rect x="${X(i / 5 + .02)}" y="${Y(v * t)}" width="${pw / 5 - 16}" height="${v * t * ph}" rx="5" fill="${colv(i)}"/><text class="m" x="${X(i / 5 + .02) + (pw / 5 - 16) / 2}" y="${Hh - 18}" text-anchor="middle">${'ABCDE'[i]}</text>`).join('');
      if (ty === 'hist') { const mx = Math.max(...hist); s += hist.map((k, i) => `<rect x="${L + i * pw / hist.length + 1}" y="${Y(k / mx * t * .95)}" width="${pw / hist.length - 2}" height="${k / mx * t * .95 * ph}" fill="var(--c0)" opacity=".85" rx="2"/>`).join(''); }
      if (ty === 'box') s += boxes.map((b, i) => { const cx = X(i / 3 + .17), w = 56; return `<g opacity="${t}"><line x1="${cx}" x2="${cx}" y1="${Y(b.lo)}" y2="${Y(b.hi)}" stroke="${colv(i)}" stroke-width="2"/><rect x="${cx - w / 2}" y="${Y(b.q3)}" width="${w}" height="${Y(b.q1) - Y(b.q3)}" fill="${colSoft(i)}" stroke="${colv(i)}" stroke-width="2.5" rx="4"/><line x1="${cx - w / 2}" x2="${cx + w / 2}" y1="${Y(b.m)}" y2="${Y(b.m)}" stroke="${colv(i)}" stroke-width="4"/>${b.out.map(o => `<circle cx="${cx}" cy="${Y(o)}" r="3.5" fill="none" stroke="${colv(i)}" stroke-width="2"/>`).join('')}<text class="m" x="${cx}" y="${Hh - 18}" text-anchor="middle">g${i + 1}</text></g>`; }).join('');
      if (ty === 'pie') { let ang = -Math.PI / 2; const cx = W / 2, cy = Hh / 2, R = 120; pie.forEach((p, i) => { const sweep = p * 2 * Math.PI * t, a2 = ang + sweep; s += `<path d="M${cx} ${cy}L${cx + R * Math.cos(ang)} ${cy + R * Math.sin(ang)}A${R} ${R} 0 ${sweep > Math.PI ? 1 : 0} 1 ${cx + R * Math.cos(a2)} ${cy + R * Math.sin(a2)}Z" fill="${colv(i)}" stroke="var(--surface)" stroke-width="2"/>`; ang += p * 2 * Math.PI; }); }
      if (ty === 'heatmap') { const cw = (W - 60) / 10, ch = (Hh - 30) / 8; s += hm.map((row, i) => row.map((v, j) => `<rect x="${30 + j * cw}" y="${15 + i * ch}" width="${cw - 2}" height="${ch - 2}" rx="4" fill="${heat(v)}" opacity="${seg(t, (i + j) / 20 * .6, (i + j) / 20 * .6 + .4)}"/>`).join('')).join(''); }
      c.stage.innerHTML = s + '</svg>';
    });
  }
  c.select('plot type', TY, ty, v => { ty = v; draw(); }); c.button('New data', () => { seed++; draw(); }); draw();
  return { destroy: () => cancel && cancel() };
};

/* gradient descent on f(x) = (x-2)^2 + 1 : learning-rate play */
DSQ.viz.gradDescent = (c, a) => {
  let lr = a.lr ?? .2, x0 = a.x0 ?? -3.5, steps = a.steps ?? 12, cancel = null;
  const f = x => (x - 2) ** 2 + 1, g = x => 2 * (x - 2);
  function draw() {
    cancel && cancel(); const path = [x0]; for (let i = 0; i < steps; i++) path.push(path[i] - lr * g(path[i]));
    const W = 620, Hh = 340, fr0 = DSQ.frame2(W, Hh, { l: 44, r: 12, t: 12, b: 32 }, [-5, 7], [0, 40], { grid: true, xl: 'x', yl: 'f(x)' }), X = fr0.X, cap = 40, Y = y => fr0.Y(Math.min(y, cap));
    const curve = range(121).map(i => { const x = -5 + 12 * i / 120; return X(x).toFixed(1) + ' ' + Y(f(x)).toFixed(1); }).join('L');
    const div = Math.abs(path[steps]) > 1e3 || !Number.isFinite(path[steps]);
    c.say(`lr = ${lr}\nx = ${x0}\nfor step in range(${steps}):\n    x = x - lr * 2 * (x - 2)      <span class="g"># gradient of (x-2)**2 + 1</span>\n<span class="y">path</span> = [${path.slice(0, 7).map(v => (Math.abs(v) > 1e6 ? v.toExponential(1) : v.toFixed(3))).join(', ')}${steps > 6 ? ', ...' : ''}]\n` + (div ? '<span class="r">diverged! the steps overshoot more each time - lower the learning rate</span>' : `<span class="g">final x = ${path[steps].toFixed(4)}  (the true minimum is x = 2)</span>`));
    cancel = anim(1600, t => {
      const k = Math.min(steps, Math.floor(t * (steps + .0001)) + (t >= 1 ? 0 : 0)), fr = t * steps - Math.floor(t * steps);
      let s = svgOpen(W, Hh) + `${fr0.svg}<path d="M${curve}" fill="none" stroke="var(--c0)" stroke-width="3"/><line x1="${X(2)}" x2="${X(2)}" y1="12" y2="${Hh - 32}" stroke="var(--c2)" stroke-dasharray="5 4"/><text x="${X(2) + 6}" y="26" fill="var(--c2)" font-weight="800" font-size="12">minimum</text>`;
      for (let i = 0; i < k; i++) { const p = path[i], q = path[i + 1]; if (Math.abs(p) < 8 && Math.abs(q) < 8) s += `<path d="M${X(p)} ${Y(f(p))}L${X(q)} ${Y(f(q))}" stroke="var(--c1)" stroke-width="2" opacity=".8" /><circle cx="${X(p)}" cy="${Y(f(p))}" r="4" fill="var(--c1)" opacity="${.35 + .5 * i / steps}"/>`; }
      const cx = path[Math.min(k, steps)], nx = path[Math.min(k + 1, steps)], bx = lerp(cx, nx, k < steps ? ease(fr) : 0);
      if (Math.abs(bx) < 8) s += `<circle cx="${X(bx)}" cy="${Y(f(bx))}" r="9" fill="var(--c1)" stroke="var(--surface)" stroke-width="3"/>`; else s += `<text x="${W / 2}" y="60" text-anchor="middle" fill="var(--bad)" font-weight="800" font-size="16">flew off the chart</text>`;
      c.stage.innerHTML = s + '</svg>';
    });
  }
  c.slider('learning rate', .01, 1.2, .01, lr, v => { lr = v; draw(); }, v => v.toFixed(2)); c.slider('start x', -5, 6, .5, x0, v => { x0 = v; draw(); }); c.slider('steps', 3, 40, 1, steps, v => { steps = v; draw(); });
  c.button('Replay', draw); draw(); return { destroy: () => cancel && cancel() };
};

/* line fitting: slope & intercept sliders, residuals, MSE, best-fit animation */
DSQ.viz.linfit = (c, a) => {
  const r = RNG(a.seed || 21), n = 14, xs = range(n).map(i => 1 + i * 0.7 + r() * .3), ys = xs.map(x => 2.1 * x + 1.5 + r.norm(0, 1.4));
  const mx = mean(xs), my = mean(ys), mBest = sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / sum(xs.map(x => (x - mx) ** 2)), bBest = my - mBest * mx;
  let m = a.m ?? 0.5, b = a.b ?? 8, sM, sB, cancel = null;
  function draw() {
    const W = 600, Hh = 340, fr0 = DSQ.frame2(W, Hh, { l: 44, r: 12, t: 12, b: 32 }, [0, 11], [0, 30], { grid: true, xl: 'x', yl: 'y' }), X = fr0.X, Y = fr0.Y;
    const mse = mean(xs.map((x, i) => (ys[i] - (m * x + b)) ** 2));
    let s = svgOpen(W, Hh) + fr0.svg + `<defs><clipPath id="lfc"><rect x="44" y="12" width="${W - 56}" height="${Hh - 44}"/></clipPath></defs><g clip-path="url(#lfc)">`;
    xs.forEach((x, i) => { const yh = m * x + b; s += `<line x1="${X(x)}" x2="${X(x)}" y1="${Y(ys[i])}" y2="${Y(yh)}" stroke="var(--bad)" stroke-width="2" opacity=".7"/>`; });
    s += `<line x1="${X(0)}" y1="${Y(b)}" x2="${X(11)}" y2="${Y(m * 11 + b)}" stroke="var(--c1)" stroke-width="3.5" stroke-linecap="round"/>` + xs.map((x, i) => `<circle cx="${X(x)}" cy="${Y(ys[i])}" r="5.5" fill="var(--c0)" stroke="var(--surface)" stroke-width="2"/>`).join('');
    s += `</g><text x="52" y="28" font-weight="800" font-size="14">y = ${m.toFixed(2)}x + ${b.toFixed(2)}</text><text x="52" y="48" class="m" font-size="12.5">MSE = ${mse.toFixed(2)}  (average of the red gaps, squared)</text></svg>`;
    c.stage.innerHTML = s;
    c.say(`m, b = ${m.toFixed(2)}, ${b.toFixed(2)}\nerror = y - (m * x + b)\n<span class="y">mse</span> = np.mean(error ** 2) = ${mse.toFixed(3)}\n<span class="g">np.polyfit(x, y, 1) finds the best pair: m = ${mBest.toFixed(3)}, b = ${bBest.toFixed(3)}</span>`);
  }
  sM = c.slider('slope m', -1, 5, .05, m, v => { m = v; draw(); }, v => v.toFixed(2)); sB = c.slider('intercept b', -5, 15, .1, b, v => { b = v; draw(); }, v => v.toFixed(1));
  c.button('Find best fit', () => {
    cancel && cancel(); const m0 = m, b0 = b; cancel = anim(1200, t => { m = lerp(m0, mBest, t); b = lerp(b0, bBest, t); sM.value = m; sB.value = b; $('b', sM.parentNode).textContent = m.toFixed(2); $('b', sB.parentNode).textContent = b.toFixed(1); draw(); });
  });
  draw(); return { destroy: () => cancel && cancel() };
};
