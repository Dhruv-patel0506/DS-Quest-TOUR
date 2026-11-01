'use strict';
/* =====================================================================
   Picture Class scenes, part 7 (content, design, apps): contrast (two colour pickers and the WCAG ratio), baseline (a bar chart whose axis start you can move)
   and miniapp (a tiny data app: change a widget and the table and chart rerun). The maths is in PIC.math so tools/verify_picture.js can check it against Python.
   ===================================================================== */
(function (M) {
  const lin = c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  const rgb = hex => { const h = hex.replace('#', ''), f = h.length === 3 ? h.split('').map(x => x + x).join('') : h; return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)]; };
  M.lum = hex => { const [r, g, b] = rgb(hex); return .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b); };
  M.ratioText = r => { const x = Math.round(r * 100) / 100; return ((x >= 3 && r < 3) || (x >= 4.5 && r < 4.5) || (x >= 7 && r < 7) ? Math.floor(r * 100) / 100 : x).toFixed(2); };   /* rounds, but never shows a pass the maths does not give */
  M.contrast = (a, b) => { const x = M.lum(a), y = M.lum(b), hi = Math.max(x, y), lo = Math.min(x, y); return (hi + .05) / (lo + .05); };
  /* the rows of a data app after its widgets are applied: { cities: [...], min } */
  M.appRows = (data, st) => data.rows.filter(r => (!st.cities || st.cities.indexOf(r[0]) >= 0) && r[2] >= (st.min || 0));
})(PIC.math);
const pc7 = { hex: s => /^#[0-9a-fA-F]{6}$/.test(s) ? s : '#000000' };

/* ---------------------------------------------------------------------------------------------
   Scene: contrast. spec: { fg, bg, text, size, bold, cap }
   --------------------------------------------------------------------------------------------- */
PIC.scenes.contrast = (stage, sp, ctx) => {
  const M = PIC.math; let fg = sp.fg, bg = sp.bg;
  stage.innerHTML = `<div class="ct"><div class="ct-sample" style="background:${bg};color:${fg}"><div class="ct-big" style="font-weight:${sp.bold ? 800 : 500}">${picEsc(sp.text || 'Sample heading')}</div><div class="ct-small">${picEsc(sp.small || 'The quick brown fox jumps over the lazy dog. Small body text is where low contrast hurts first.')}</div></div><div class="ct-row"><label>text colour <input type="color" class="ct-fg" value="${fg}"></label><label>background <input type="color" class="ct-bg" value="${bg}"></label><button type="button" class="btn sm ct-swap">&#8644; swap</button></div><div class="ct-ratio"></div><div class="ct-badges"></div></div><div class="pc-formula">${sp.note || 'change the two colours: the ratio and the verdicts update'}</div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}`;
  const sample = stage.querySelector('.ct-sample'), ratio = stage.querySelector('.ct-ratio'), badges = stage.querySelector('.ct-badges'), inF = stage.querySelector('.ct-fg'), inB = stage.querySelector('.ct-bg');
  const upd = () => { fg = inF.value; bg = inB.value; sample.style.color = fg; sample.style.background = bg; const r = M.contrast(fg, bg), b = (ok, name, why) => `<span class="ct-b ${ok ? 'ok' : 'no'}" title="${why}">${ok ? '&#10003;' : '&#10007;'} ${name}</span>`; ratio.innerHTML = `contrast ratio <b>${M.ratioText(r)} : 1</b>`; badges.innerHTML = b(r >= 4.5, 'AA normal text', 'WCAG AA needs 4.5 : 1 for normal text') + b(r >= 3, 'AA large text', 'WCAG AA needs 3 : 1 for large text (18 pt, or 14 pt bold)') + b(r >= 7, 'AAA normal text', 'WCAG AAA needs 7 : 1 for normal text'); };
  inF.oninput = inB.oninput = upd; stage.querySelector('.ct-swap').onclick = () => { const t = inF.value; inF.value = inB.value; inB.value = t; upd(); }; upd();
};

/* ---------------------------------------------------------------------------------------------
   Scene: baseline. Bars drawn from a baseline you can move: how a cut axis exaggerates a small difference.
   spec: { labels, values, base, max, title, unit, cap }
   --------------------------------------------------------------------------------------------- */
PIC.scenes.baseline = (stage, sp, ctx) => {
  const W = 560, H = 300, n = sp.values.length, top = Math.max.apply(null, sp.values), lo = Math.min.apply(null, sp.values); let base = sp.base || 0;
  stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="pc-svg bl-svg" role="img" aria-label="${picEsc(sp.title || 'bars from a movable baseline')}"></svg><div class="pc-formula bl-note"></div><div class="pc3-try"><label><b>Where the axis starts</b> <input type="range" class="bl-r" min="0" max="${Math.floor(lo * .98)}" step="${Math.max(1, Math.round(lo / 100))}" value="${base}"> <span class="bl-v"></span></label></div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}`;
  const svg = stage.querySelector('.bl-svg'), note = stage.querySelector('.bl-note'), r = stage.querySelector('.bl-r'), v = stage.querySelector('.bl-v');
  const draw = () => {
    base = +r.value; v.textContent = base + (sp.unit ? ' ' + sp.unit : ''); const bw = 340 / n, sy = x => 250 - (x - base) / (top - base) * 190;
    svg.innerHTML = `${sp.title ? `<text x="${W / 2}" y="16" text-anchor="middle" class="pc-title">${picEsc(sp.title)}</text>` : ''}<line x1="60" x2="${W - 20}" y1="250" y2="250" class="pc-ax"/><line x1="60" x2="60" y1="40" y2="250" class="pc-ax"/><text x="54" y="254" text-anchor="end" class="pc-t">${base}</text><text x="54" y="64" text-anchor="end" class="pc-t">${top}</text>${sp.values.map((val, i) => `<rect x="${90 + i * (bw + 30)}" y="${sy(val)}" width="${bw}" height="${250 - sy(val)}" rx="4" style="fill:${pc3.col[i % 5]}"><title>${picEsc(sp.labels[i])}: ${val}</title></rect><text x="${90 + i * (bw + 30) + bw / 2}" y="${sy(val) - 6}" text-anchor="middle" class="pc-lab">${val}</text><text x="${90 + i * (bw + 30) + bw / 2}" y="270" text-anchor="middle" class="pc-t">${picEsc(sp.labels[i])}</text>`).join('')}`;
    const a = sp.values[0], b = sp.values[1], seen = (a - base) / (b - base), real = a / b;
    note.innerHTML = `the real difference: ${picEsc(sp.labels[0])} is <b>${((real - 1) * 100).toFixed(1)}%</b> ${real >= 1 ? 'above' : 'below'} ${picEsc(sp.labels[1])}. The bars show it as <b>${seen >= 1 ? ((seen - 1) * 100).toFixed(0) + '% taller' : ((1 - seen) * 100).toFixed(0) + '% shorter'}</b>${base ? ` (lie factor ${(Math.abs(seen - 1) / Math.abs(real - 1)).toFixed(1)})` : ' (honest: the baseline is zero)'}.`;
  };
  r.oninput = draw; draw();
};

/* ---------------------------------------------------------------------------------------------
   Scene: miniapp. A data app in miniature: widgets in, table and chart out. Every change reruns the whole "script".
   spec: { data: { cols, rows }, cities: [...], min, max, cap }
   --------------------------------------------------------------------------------------------- */
PIC.scenes.miniapp = (stage, sp, ctx) => {
  const M = PIC.math, cities = sp.cities; let st = { cities: cities.slice(), min: sp.min || 0 }, runs = 0;
  stage.innerHTML = `<div class="ma"><div class="ma-side"><div class="ma-h">sidebar (widgets)</div><div class="ma-w"><b>City</b>${cities.map(c => `<label><input type="checkbox" class="ma-c" value="${picEsc(c)}" checked> ${picEsc(c)}</label>`).join('')}</div><div class="ma-w"><label><b>Minimum amount</b> <span class="ma-mv"></span><input type="range" class="ma-m" min="0" max="${sp.max || 1500}" step="100" value="${st.min}"></label></div><div class="ma-runs"></div></div><div class="ma-main"><div class="ma-h">page (what the script draws)</div><div class="ma-metric"></div><div class="ma-chart"></div><div class="ma-table"></div></div></div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}`;
  const q = s => stage.querySelector(s), run = () => {
    runs++; const rows = M.appRows(sp.data, st), tot = rows.reduce((a, r) => a + r[2], 0), by = {}; rows.forEach(r => { by[r[1]] = (by[r[1]] || 0) + r[2]; }); const keys = Object.keys(by).sort(), mx = Math.max.apply(null, Object.values(by).concat(1));
    q('.ma-mv').textContent = '(' + st.min + ')'; q('.ma-runs').innerHTML = `the whole script has run <b>${runs}</b> time${runs === 1 ? '' : 's'}`; q('.ma-metric').innerHTML = `<span class="ma-big">${tot.toLocaleString('en-US')}</span> total from <b>${rows.length}</b> rows`;
    q('.ma-chart').innerHTML = keys.length ? keys.map((k, i) => `<div class="ma-bar"><span>${picEsc(k)}</span><i style="width:${by[k] / mx * 100}%;background:${pc3.col[i % 5]}"></i><b>${by[k].toLocaleString('en-US')}</b></div>`).join('') : '<div class="muted">nothing matches these widgets</div>';
    q('.ma-table').innerHTML = `<table><tr>${sp.data.cols.map(c => `<th>${picEsc(c)}</th>`).join('')}</tr>${rows.slice(0, 8).map(r => `<tr>${r.map(v => `<td>${picEsc(v)}</td>`).join('')}</tr>`).join('')}${rows.length > 8 ? `<tr><td colspan="3" class="muted">... ${rows.length - 8} more rows</td></tr>` : ''}</table>`;
  };
  stage.querySelectorAll('.ma-c').forEach(c => { c.onchange = () => { st.cities = [...stage.querySelectorAll('.ma-c')].filter(x => x.checked).map(x => x.value); run(); }; });
  q('.ma-m').oninput = e => { st.min = +e.target.value; run(); }; run();
};
