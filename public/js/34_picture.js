'use strict';
/* =====================================================================
   Picture Classes (#/picture): animated, step-by-step lessons. A separate option next to the normal curriculum; nothing there changed.
   Each lesson is a list of steps. A step has a few lines of code, a plain-words explanation and a "scene": a picture that moves to show exactly
   what those lines do, using real things (a car, a library, a factory) instead of abstract shapes.
   Scenes are plain functions registered in PIC.scenes (matrix, car, plot, net, pipeline, llm, table in the files 34 / 34b); lessons are in 36.
   PIC.lesson({ id, group, title, icon, sub, story, steps: [{ code, say, scene: { type, ... }, out }], quiz, remember })
   ===================================================================== */
const PIC = { lessons: [], scenes: {}, groups: [] };
PIC.lesson = l => { const i = PIC.lessons.findIndex(x => x.id === l.id); if (i >= 0 && PIC.lessons[i].locked) PIC.lessons.splice(i, 1, l); else if (i < 0) PIC.lessons.push(l); return l; };
/* Premium lessons are not in the page. public/picture-catalog.json lists their title and summary only; each one becomes a locked stub until the account is allowed to load the real lesson. */
PIC.addStubs = async function () {
  try { const cat = await (await fetch('picture-catalog.json', { cache: 'no-cache' })).json(); for (const c of cat) if (!PIC.lessons.some(x => x.id === c.id)) PIC.lessons.push({ id: c.id, mod: c.mod, les: c.les, group: c.group, title: c.title, icon: c.icon, sub: c.sub, locked: true, steps: { length: c.n } }); } catch (e) { }
};
const picReduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* a small runtime that owns the timers and animation frames of the scene on the stage, so changing step cleans up */
function picCtx() {
  const raf = new Set(), tm = new Set(); let dead = false, epoch = 0;
  const ctx = {
    get dead() { return dead; },
    /* tween(ms, f(t 0..1), done): eased progress, skips straight to the end for reduced motion */
    tween(ms, f, done) {
      if (dead) return; if (picReduce()) { f(1, 1); if (done) done(); return; }
      const t0 = performance.now(), my = epoch; let id = 0;
      const step = now => { raf.delete(id); if (dead || my !== epoch) return; const t = Math.min(1, (now - t0) / ms), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; f(e, t); if (t < 1) { id = requestAnimationFrame(step); raf.add(id); } else if (done) done(); };
      id = requestAnimationFrame(step); raf.add(id);
    },
    wait(ms, f) { if (dead) return; const my = epoch, id = setTimeout(() => { tm.delete(id); if (!dead && my === epoch) f(); }, picReduce() ? Math.min(ms, 30) : ms); tm.add(id); },
    /* cancel(): drop everything that is running but keep the context usable (the learner took over with a slider or a click) */
    cancel() { epoch++; raf.forEach(cancelAnimationFrame); tm.forEach(clearTimeout); raf.clear(); tm.clear(); },
    stop() { dead = true; raf.forEach(cancelAnimationFrame); tm.forEach(clearTimeout); raf.clear(); tm.clear(); },
  };
  return ctx;
}
const picEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const picNum = v => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));

/* ---------------------------------------------------------------------------------------------
   Scene: table (pandas-style picture of a DataFrame). spec: { cols, rows, idx, hlRows, hlCols, dimRows, newRows, newCols, cells:{"r,c":"hot"}, cap }
   --------------------------------------------------------------------------------------------- */
PIC.scenes.table = (stage, sp) => {
  const idx = sp.idx || sp.rows.map((_, i) => i), isIn = (a, v) => Array.isArray(a) && a.includes(v);
  const head = sp.cols.map(c => `<th class="${isIn(sp.hlCols, c) ? 'hl' : ''} ${isIn(sp.newCols, c) ? 'new' : ''}">${picEsc(c)}</th>`).join('');
  const body = sp.rows.map((r, i) => `<tr class="${isIn(sp.hlRows, i) ? 'hl' : ''} ${isIn(sp.dimRows, i) ? 'dim' : ''} ${isIn(sp.newRows, i) ? 'new' : ''}" style="animation-delay:${i * 70}ms"><th class="idx">${picEsc(idx[i])}</th>${r.map((v, c) => `<td class="${isIn(sp.hlCols, sp.cols[c]) ? 'hl' : ''} ${isIn(sp.newCols, sp.cols[c]) ? 'new' : ''} ${(sp.cells && sp.cells[i + ',' + c]) || ''}" style="animation-delay:${c * 90 + i * 40}ms">${picEsc(v)}</td>`).join('')}</tr>`).join('');
  stage.innerHTML = `<div class="pc-tablewrap"><table class="pc-table"><thead><tr><th class="idx"></th>${head}</tr></thead><tbody>${body}</tbody></table>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}</div>`;
};

/* ---------------------------------------------------------------------------------------------
   Scene: matrix. spec: { items: [ {m:[[..]], name:'A', color:'blue', hl:{row,col}} , {op:'×'}, {text:'...'} ], anim:'matmul'|'dot'|'transpose', cap }
   anim 'matmul' needs items [A, op, B, op, C(empty:true)]: it walks the result cell by cell, lighting the row of A and the column of B.
   --------------------------------------------------------------------------------------------- */
PIC.scenes.matrix = (stage, sp, ctx) => {
  const cellHtml = (it, r, c) => { const v = it.m[r][c], hot = it.hl && ((it.hl.row === r) || (it.hl.col === c) || (it.hl.cell && it.hl.cell[0] === r && it.hl.cell[1] === c)); return `<span class="pc-cell ${hot ? 'hot' : ''} ${it.empty ? 'blank' : ''}" data-r="${r}" data-c="${c}">${it.empty ? '' : picEsc(picNum(v))}</span>`; };
  const matHtml = (it, k) => {
    if (it.op) return `<div class="pc-op">${picEsc(it.op)}</div>`; if (it.text) return `<div class="pc-mtext">${picEsc(it.text)}</div>`;
    const rows = it.m.length, cols = it.m[0].length;
    return `<div class="pc-matbox c-${it.color || 'blue'}" data-k="${k}"><div class="pc-matname">${picEsc(it.name || '')}</div><div class="pc-mat" style="grid-template-columns:repeat(${cols},auto)">${it.m.map((row, r) => row.map((_, c) => cellHtml(it, r, c)).join('')).join('')}</div><div class="pc-shape">${rows} × ${cols}</div></div>`;
  };
  stage.innerHTML = `<div class="pc-matrow">${sp.items.map(matHtml).join('')}</div><div class="pc-formula" aria-live="polite"></div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}<button type="button" class="btn sm pc-replay" hidden>↻ Replay</button>`;
  const formula = stage.querySelector('.pc-formula'), replay = stage.querySelector('.pc-replay');
  const box = k => stage.querySelector(`.pc-matbox[data-k="${k}"]`), cell = (k, r, c) => box(k).querySelector(`.pc-cell[data-r="${r}"][data-c="${c}"]`);
  if (sp.anim === 'matmul') {
    const ai = sp.items.findIndex(x => x.m), A = sp.items[ai].m, bi = sp.items.findIndex((x, i) => x.m && i > ai), B = sp.items[bi].m, ci = sp.items.findIndex((x, i) => x.m && i > bi), m = A.length, n = A[0].length, p = B[0].length;
    const clear = () => stage.querySelectorAll('.pc-cell.hot,.pc-cell.hotc').forEach(e => e.classList.remove('hot', 'hotc'));
    const walk = () => {
      stage.querySelectorAll(`.pc-matbox[data-k="${ci}"] .pc-cell`).forEach(e => { e.textContent = ''; e.classList.add('blank'); e.classList.remove('pop'); }); clear(); formula.innerHTML = 'Each cell of the answer = one <b>row</b> of the first matrix times one <b>column</b> of the second.'; replay.hidden = true;
      const cells = []; for (let i = 0; i < m; i++) for (let j = 0; j < p; j++) cells.push([i, j]); let k = 0;
      const next = () => {
        if (ctx.dead) return; if (k >= cells.length) { clear(); formula.innerHTML = 'Done: the answer has ' + m + ' rows (from the first) and ' + p + ' columns (from the second).'; replay.hidden = false; return; }
        const [i, j] = cells[k++]; clear(); for (let t = 0; t < n; t++) { cell(ai, i, t).classList.add('hot'); cell(bi, t, j).classList.add('hotc'); }
        const terms = A[i].map((a, t) => `${picNum(a)}×${picNum(B[t][j])}`), val = A[i].reduce((s, a, t) => s + a * B[t][j], 0);
        formula.innerHTML = `row ${i + 1} · column ${j + 1}:  ${terms.join(' + ')}  =  <b>${picNum(val)}</b>`;
        ctx.wait(650, () => { const c = cell(ci, i, j); c.classList.remove('blank'); c.textContent = picNum(val); c.classList.add('pop'); ctx.wait(750, next); });
      }; next();
    };
    replay.onclick = walk; walk();
  } else if (sp.anim === 'dot') {
    const [a, b] = sp.items.filter(x => x.m).map(x => x.m), flat = x => x.flat(), u = flat(a), v = flat(b); let k = 0, run = 0;
    const next = () => { if (ctx.dead) return; if (k >= u.length) { formula.innerHTML = `${u.map((x, i) => `${picNum(x)}×${picNum(v[i])}`).join(' + ')}  =  <b>${picNum(u.reduce((s, x, i) => s + x * v[i], 0))}</b>`; replay.hidden = false; return; } stage.querySelectorAll('.pc-cell').forEach(e => e.classList.remove('hot')); const els = stage.querySelectorAll('.pc-cell'); els[k].classList.add('hot'); els[u.length + k].classList.add('hot'); run += u[k] * v[k]; formula.innerHTML = `${u.slice(0, k + 1).map((x, i) => `${picNum(x)}×${picNum(v[i])}`).join(' + ')}  =  ${picNum(run)}`; k++; ctx.wait(900, next); };
    replay.onclick = () => { k = 0; run = 0; replay.hidden = true; next(); }; next();
  } else if (sp.anim === 'transpose') {
    const ai = sp.items.findIndex(x => x.m), bi = sp.items.findIndex((x, i) => x.m && i > ai), R = sp.items[ai].m.length; let k = 0;
    const next = () => { if (ctx.dead) return; stage.querySelectorAll('.pc-cell.hot').forEach(e => e.classList.remove('hot')); if (k >= R) { formula.innerHTML = 'Rows became columns: row 1 is now column 1, row 2 is now column 2.'; replay.hidden = false; return; } stage.querySelectorAll(`.pc-matbox[data-k="${ai}"] .pc-cell[data-r="${k}"]`).forEach(e => e.classList.add('hot')); stage.querySelectorAll(`.pc-matbox[data-k="${bi}"] .pc-cell[data-c="${k}"]`).forEach(e => e.classList.add('hot')); formula.innerHTML = `row ${k + 1} of the first  →  column ${k + 1} of the second`; k++; ctx.wait(1000, next); };
    replay.onclick = () => { k = 0; replay.hidden = true; next(); }; next();
  } else if (sp.say) formula.innerHTML = sp.say;
};

/* ---------------------------------------------------------------------------------------------
   Scene: plot. spec: { pts:[[x,y],..], kind:'line'|'scatter'|'bar', fit:true, title, xlab, ylab, xmax, ymax, cap }
   Points drop in one by one, then a pen draws the line through them in order (or the best-fit line sweeps in).
   --------------------------------------------------------------------------------------------- */
PIC.scenes.plot = (stage, sp, ctx) => {
  const W = 560, H = 340, L = 50, R = 16, T = 34, B = 44, xs = sp.pts.map(p => p[0]), ys = sp.pts.map(p => p[1]);
  const xmax = sp.xmax || Math.ceil(Math.max(...xs) * 1.05), ymax = sp.ymax || Math.ceil(Math.max(...ys) * 1.15), xmin = sp.xmin == null ? 0 : sp.xmin;
  const X = v => L + (v - xmin) / (xmax - xmin) * (W - L - R), Y = v => H - B - v / ymax * (H - T - B);
  let g = ''; const nx = 5, ny = 5;
  for (let i = 0; i <= nx; i++) { const v = xmin + (xmax - xmin) * i / nx; g += `<line x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${H - B}" class="pc-g"/><text x="${X(v)}" y="${H - B + 17}" text-anchor="middle" class="pc-t">${picNum(v)}</text>`; }
  for (let i = 0; i <= ny; i++) { const v = ymax * i / ny; g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="pc-g"/><text x="${L - 7}" y="${Y(v) + 4}" text-anchor="end" class="pc-t">${picNum(v)}</text>`; }
  const path = sp.pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('');
  stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="pc-svg" role="img" aria-label="${picEsc(sp.title || 'chart')}"><text x="${W / 2}" y="20" text-anchor="middle" class="pc-title">${picEsc(sp.title || '')}</text>${g}<line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" class="pc-ax"/><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="pc-ax"/><text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" class="pc-lab">${picEsc(sp.xlab || 'x')}</text><text x="14" y="${H / 2}" text-anchor="middle" class="pc-lab" transform="rotate(-90 14 ${H / 2})">${picEsc(sp.ylab || 'y')}</text><g class="pc-bars"></g><path class="pc-fit" d=""/><path class="pc-line" d=""/><g class="pc-dots"></g><circle class="pc-pen" r="7" cx="-20" cy="-20"/><text class="pc-read" x="${L + 8}" y="${T + 16}"></text></svg>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}<button type="button" class="btn sm pc-replay" hidden>↻ Replay</button>`;
  const dots = stage.querySelector('.pc-dots'), line = stage.querySelector('.pc-line'), pen = stage.querySelector('.pc-pen'), read = stage.querySelector('.pc-read'), fit = stage.querySelector('.pc-fit'), bars = stage.querySelector('.pc-bars'), replay = stage.querySelector('.pc-replay');
  const NS = 'http://www.w3.org/2000/svg';
  const go = () => {
    dots.innerHTML = ''; line.setAttribute('d', ''); fit.setAttribute('d', ''); bars.innerHTML = ''; pen.setAttribute('cx', -20); read.textContent = ''; replay.hidden = true; const n = sp.pts.length; if (!n) { read.textContent = 'An empty sheet: the rulers (axes) are ready, nothing is drawn yet.'; return; }
    const finish = () => { replay.hidden = false; read.textContent = ''; };
    const drawLine = () => {
      if (sp.kind === 'scatter' || sp.kind === 'bar') { finish(); return; }
      const P = sp.pts.map(p => [X(p[0]), Y(p[1])]), seg = [], total = P.slice(1).reduce((a, p, i) => { const l = Math.hypot(p[0] - P[i][0], p[1] - P[i][1]); seg.push(l); return a + l; }, 0);
      ctx.tween(Math.max(1800, Math.min(4200, total * 7)), (_, t) => {
        let d = t * total, k = 0; while (k < seg.length - 1 && d > seg[k]) { d -= seg[k]; k++; } const u = seg[k] ? Math.min(1, d / seg[k]) : 1, x = P[k][0] + (P[k + 1][0] - P[k][0]) * u, y = P[k][1] + (P[k + 1][1] - P[k][1]) * u;
        pen.setAttribute('cx', x); pen.setAttribute('cy', y); line.setAttribute('d', P.slice(0, k + 1).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('') + 'L' + x.toFixed(1) + ' ' + y.toFixed(1));
        read.textContent = `pen between point ${k + 1} and point ${k + 2}`;
      }, () => { pen.setAttribute('cx', -20); if (sp.fit) fitLine(); else finish(); });
    };
    const fitLine = () => {
      const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n, m = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0), b = my - m * mx;
      fit.setAttribute('d', `M${X(xmin)} ${Y(m * xmin + b)}L${X(xmax)} ${Y(m * xmax + b)}`); read.textContent = `best line: y = ${picNum(m)} x + ${picNum(b)}`; const len = fit.getTotalLength(); fit.style.strokeDasharray = len; ctx.tween(1200, (e) => { fit.style.strokeDashoffset = len * (1 - e); }, finish);
    };
    let i = 0; const drop = () => {
      if (ctx.dead) return; if (i >= n) { ctx.wait(350, sp.fit && (sp.kind === 'scatter') ? fitLine : drawLine); return; }
      const p = sp.pts[i++]; if (sp.kind === 'bar') { const r = document.createElementNS(NS, 'rect'); r.setAttribute('x', X(p[0]) - 14); r.setAttribute('width', 28); r.setAttribute('y', Y(0)); r.setAttribute('height', 0); r.setAttribute('class', 'pc-bar'); bars.appendChild(r); ctx.tween(380, e => { r.setAttribute('y', Y(0) + (Y(p[1]) - Y(0)) * e); r.setAttribute('height', (Y(0) - Y(p[1])) * e); }); }
      else { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', X(p[0])); c.setAttribute('class', 'pc-dot'); c.setAttribute('r', 7); dots.appendChild(c); ctx.tween(380, e => c.setAttribute('cy', Y(p[1]) - (1 - e) * 60)); }
      read.textContent = `point ${i}: x = ${picNum(p[0])}, y = ${picNum(p[1])}`; ctx.wait(sp.kind === 'bar' ? 420 : 340, drop);
    }; drop();
  };
  replay.onclick = go; go();
};

/* the player, the course map (courses > modules > lessons) and the 2D / 3D / Overlay modes live in 42_picture_player.js */
