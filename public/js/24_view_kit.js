'use strict';
/* =====================================================================
   A small kit for the "see inside it" pages (time series, convolution, autograd, word vectors, LoRA, DAGs, DOM, A/B tests, drift).
   viewKit(o, T) gives a page shell: a 3-D hologram (Plot3D), an SVG strip for charts, an explanation card and a side card for controls and numbers,
   plus an animation loop that stops itself when the page is left. Each view only supplies its simulation and its drawing.
   ===================================================================== */
function viewKit(o, T) {
  const root = h('div', { class: 'stack explorer vk' }), holo = h('div', { class: 'ex-holo' });
  const p3 = Plot3D(holo, { w: T.W || 760, h: T.H || 440, az: T.az ?? .5, el: T.el ?? .35, wheel: true, zoom: T.zoom || 1.6, label: T.label || '3-D view. Drag to rotate, wheel to zoom.' });
  const trace = document.createElementNS(SVGNS, 'svg'); trace.setAttribute('viewBox', '0 0 760 ' + (T.th || 130)); trace.setAttribute('class', 'ex-svg');
  const info = h('div', { class: 'card pad prose' }), side = h('div', { class: 'card pad stack' });
  const K = { S: { playing: true, speed: 1 }, root, holo, p3, trace, info, side };
  K.tb = (t, f, title) => h('button', { class: 'btn sm', type: 'button', title: title || '', onclick: f }, t);
  K.slider = (label, min, max, step, val, on, title) => h('label', { class: 'sw', title: title || '' }, label + ' ', h('input', { type: 'range', min, max, step, value: val, oninput: e => { const v = +e.target.value; e.target.nextSibling.textContent = v; on(v); } }), h('b', {}, String(val)));
  K.check = (label, val, on, title) => h('label', { class: 'sw', title: title || '' }, h('input', { type: 'checkbox', checked: !!val, onchange: e => on(e.target.checked) }), label);
  K.select = (label, opts, val, on) => h('label', { class: 'sw' }, label + ' ', h('select', { onchange: e => on(e.target.value) }, opts.map(([v, t]) => h('option', { value: v, selected: String(v) === String(val) }, t))));
  K.play = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { K.S.playing = !K.S.playing; K.play.textContent = K.S.playing ? '❚❚ Pause' : '▶ Play'; } }, '❚❚ Pause');
  K.zoomBar = () => [K.tb('Zoom +', () => p3.zoomBy(1.4)), K.tb('Zoom -', () => p3.zoomBy(1 / 1.4)), K.tb('Reset view', () => { p3.resetZoom(); T.onReset && T.onReset(); })];
  K.speed = () => h('label', { class: 'sw' }, 'speed ', h('input', { type: 'range', min: .2, max: 3, step: .1, value: 1, oninput: e => { K.S.speed = +e.target.value; } }));
  let raf = 0, last = 0;
  K.start = (frame) => { const loop = now => { if (!root.isConnected) { cancelAnimationFrame(raf); return; } const dt = Math.min(50, now - (last || now)); last = now; frame(dt, now); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); };
  K.build = (bar, extra) => {
    root.append(...(o.embedded ? [] : [h('div', { class: 'page-h' }, h('div', {}, h('a', { href: '#/explore', class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← All concepts'), h('h1', {}, T.title), h('p', { class: 'muted lead' }, T.lead)))]), h('div', { class: 'card pad stack' }, bar, holo, trace), ...(extra || []), info, side);
    root._destroy = () => { cancelAnimationFrame(raf); p3.destroy(); }; if (!o.embedded) App.dis.push(() => root._destroy());
    return root;
  };
  K.num = (rows) => rows.map(([a, b]) => `<div class="nv"><span>${a}</span><i class="num">${b}</i></div>`).join('');
  return K;
}
/* every view registered here is listed on the Explorer home and can be embedded in a lesson with VZ(..., 'inside', { id }) */
const MORE_VIEWS = {};
function registerInside(id, meta, view) { MORE_VIEWS[id] = view; if (typeof INSIDE !== 'undefined') INSIDE[id] = Object.assign({}, meta, { view: (o) => view(o || {}) }); }
