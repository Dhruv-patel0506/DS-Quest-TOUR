'use strict';
/* =====================================================================
   3D versions of the content/design/app pictures: baseline (bars from a movable axis start), miniapp (a data app whose bars follow its widgets) and contrast
   (two colour tiles and a ratio tower with the WCAG levels marked). Same (T, X, spec) contract as the other PIC3 scenes; the numbers come from PIC.math.
   ===================================================================== */
PIC3.scenes.baseline = (T, X, sp) => {
  const ctl = X.ctl, grp = new T.Group(); X.world.add(grp); const n = sp.values.length, top = Math.max.apply(null, sp.values), lo = Math.min.apply(null, sp.values); let base = sp.base || 0; const target = [], shown = [];
  const flr = new T.Mesh(new T.BoxGeometry(n * 3 + 2, .1, 4.6), pc3dMat(T, 0x17294a)); flr.position.y = -.06; flr.receiveShadow = true; grp.add(flr);
  const bars = sp.values.map((v, i) => {
    const x = (i - (n - 1) / 2) * 3, b = new T.Mesh(new T.BoxGeometry(1.8, 1, 1.8), pc3dMat(T, new T.Color(pc3dCol[i % 5]).getHex())); b.castShadow = true; b.position.x = x; grp.add(b);
    const t = X.label(sp.labels[i], { size: .5, color: '#cfe0ff' }); t.position.set(x, .35, 2.1); grp.add(t); const val = X.label(String(v), { size: .5, color: '#ffe9a0', depthTest: false }); val.position.set(x, 1, 0); grp.add(val); b.userData = { val, x }; return b;
  });
  const set = () => {
    sp.values.forEach((v, i) => { target[i] = Math.max(.05, (v - base) / (top - base) * 6); if (shown[i] == null) shown[i] = target[i]; });
    const a = sp.values[0], b = sp.values[1], seen = (a - base) / (b - base), real = a / b;
    X.info('real difference: <b>' + ((real - 1) * 100).toFixed(1) + '%</b>. The bars show <b>' + (seen >= 1 ? ((seen - 1) * 100).toFixed(0) + '% taller' : ((1 - seen) * 100).toFixed(0) + '% shorter') + '</b>' + (base ? ' (lie factor ' + (Math.abs(seen - 1) / Math.abs(real - 1)).toFixed(1) + ')' : ' (honest: the axis starts at zero)'));
  };
  ctl.append(pc3dRange(0, Math.floor(lo * .98), Math.max(1, Math.round(lo / 100)), base, v => { base = v; set(); }, 'Where the axis starts '));
  X.setCam({ th: .45, ph: 1.1, ty: 2.8 }); X.fit(n * 1.6 + 2, 6.5); set();
  return { update(dt) { const k = Math.min(1, dt * 8); bars.forEach((b, i) => { shown[i] += (target[i] - shown[i]) * k; b.scale.y = shown[i]; b.position.y = shown[i] / 2; b.userData.val.position.set(b.userData.x, shown[i] + .7, 0); }); } };
};

PIC3.scenes.miniapp = (T, X, sp) => {
  const M = PIC.math, ctl = X.ctl, grp = new T.Group(); X.world.add(grp); let st = { cities: sp.cities.slice(), min: sp.min || 0 }, runs = 0;
  const prods = Array.from(new Set(sp.data.rows.map(r => r[1]))).sort(), full = {}; sp.data.rows.forEach(r => { full[r[1]] = (full[r[1]] || 0) + r[2]; });
  const mx = Math.max.apply(null, Object.values(full)), target = prods.map(() => 0), shown = prods.map(() => 0), fmt = v => v.toLocaleString('en-US');
  const flr = new T.Mesh(new T.BoxGeometry(prods.length * 3 + 2, .1, 4.6), pc3dMat(T, 0x17294a)); flr.position.y = -.06; flr.receiveShadow = true; grp.add(flr);
  const bars = prods.map((p, i) => {
    const x = (i - (prods.length - 1) / 2) * 3, b = new T.Mesh(new T.BoxGeometry(1.8, 1, 1.8), pc3dMat(T, new T.Color(pc3dCol[i % 5]).getHex())); b.castShadow = true; b.position.x = x; grp.add(b);
    const t = X.label(p, { size: .5, color: '#cfe0ff' }); t.position.set(x, .35, 2.1); grp.add(t); b.userData = { val: null, x, n: -1 }; return b;
  });
  const run = () => {
    runs++; const rows = M.appRows(sp.data, st), by = {}; rows.forEach(r => { by[r[1]] = (by[r[1]] || 0) + r[2]; });
    prods.forEach((p, i) => { target[i] = (by[p] || 0) / mx * 6; const u = bars[i].userData, n = by[p] || 0; if (u.n !== n) { if (u.val) { grp.remove(u.val); if (u.val.material) { if (u.val.material.map) u.val.material.map.dispose(); u.val.material.dispose(); } } u.n = n; u.val = X.label(fmt(n), { size: .5, color: '#ffe9a0', depthTest: false }); u.val.position.set(u.x, Math.max(.04, shown[i]) + .7, 0); grp.add(u.val); } });
    X.info(rows.length ? '<b>' + fmt(rows.reduce((a, r) => a + r[2], 0)) + '</b> total from <b>' + rows.length + '</b> rows · the script has run <b>' + runs + '</b> time' + (runs === 1 ? '' : 's') : 'nothing matches these widgets · run ' + runs);
  };
  ctl.append(h('div', { class: 'pic3-row' }, sp.cities.map(c => pc3dBtn(c, on => { st.cities = on ? st.cities.concat([c]) : st.cities.filter(x => x !== c); run(); }, true))));
  ctl.append(pc3dRange(0, sp.max || 1500, 100, st.min, v => { st.min = v; run(); }, 'Minimum amount '));
  X.setCam({ th: .45, ph: 1.1, ty: 2.8 }); X.fit(prods.length * 1.6 + 2, 6.5); run();
  return { update(dt) { const k = Math.min(1, dt * 8); bars.forEach((b, i) => { shown[i] += (target[i] - shown[i]) * k; const hh = Math.max(.04, shown[i]); b.scale.y = hh; b.position.y = hh / 2; b.userData.val.position.set(b.userData.x, hh + .7, 0); }); } };
};

PIC3.scenes.contrast = (T, X, sp) => {
  const M = PIC.math, ctl = X.ctl, grp = new T.Group(); X.world.add(grp); let fg = sp.fg, bg = sp.bg, txt = null, rl = null, target = 1, shown = 1;
  const slab = new T.Mesh(new T.BoxGeometry(7, .5, 4), pc3dMat(T, new T.Color(bg).getHex(), { shininess: 10 })); slab.position.set(-3, .25, 0); slab.castShadow = true; slab.receiveShadow = true; grp.add(slab);
  const meter = new T.Mesh(new T.BoxGeometry(1.6, 1, 1.6), pc3dMat(T, 0x2457d6)); meter.castShadow = true; meter.position.x = 3.5; grp.add(meter);
  [[3, 'AA large 3'], [4.5, 'AA 4.5'], [7, 'AAA 7']].forEach(l => { const y = l[0] / 21 * 7, bar = new T.Mesh(new T.BoxGeometry(2.8, .06, 2.2), new T.MeshBasicMaterial({ color: 0xffe9a0 })); bar.position.set(3.5, y, 0); grp.add(bar); const t = X.label(l[1], { size: .42, color: '#ffe9a0', depthTest: false }); t.position.set(5.9, y, 0); grp.add(t); });
  const draw = () => {
    slab.material.color.set(bg); if (txt) { grp.remove(txt); } if (rl) { grp.remove(rl); }
    txt = X.label(sp.text || 'Sample heading', { size: .9, color: fg, depthTest: false }); txt.position.set(-3, 1.3, 0); grp.add(txt);
    const r = M.contrast(fg, bg); target = Math.max(.05, r / 21 * 7); meter.material.color.set(r >= 4.5 ? 0x0f8a5f : r >= 3 ? 0xe0701c : 0xcb3a46);
    rl = X.label(M.ratioText(r) + ' : 1', { size: .6, color: '#fff', depthTest: false }); rl.position.set(3.5, 0, 0); grp.add(rl);
    X.info('contrast ratio <b>' + M.ratioText(r) + ' : 1</b> · ' + (r >= 7 ? 'passes AAA' : r >= 4.5 ? 'passes AA for normal text' : r >= 3 ? 'passes only for large text' : 'fails every level'));
  };
  const pick = (name, get, set) => h('label', { class: 'pic3-rng' }, name + ' ', h('input', { type: 'color', value: get(), oninput: e => { set(e.target.value); draw(); } }));
  ctl.append(pick('text colour', () => fg, v => { fg = v; }), pick('background', () => bg, v => { bg = v; }));
  X.setCam({ th: .35, ph: 1.05, ty: 1.4 }); X.fit(8.4, 3.6); draw();
  return { update(dt) { shown += (target - shown) * Math.min(1, dt * 8); meter.scale.y = shown; meter.position.y = shown / 2; if (rl) rl.position.y = shown + .7; } };
};
