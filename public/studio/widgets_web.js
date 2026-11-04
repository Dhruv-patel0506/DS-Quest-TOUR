'use strict';
/* Widgets for the web and marketing rooms.
   webpad   a live editor (HTML, CSS, JavaScript) with a sandboxed preview, a console and checks that the learner's page passes or fails
   cssplay  real CSS applied to real boxes in the real browser, with the CSS written out as you change the controls
   boxmodel the CSS box model with sliders, and a "check with the real browser" button that measures an element
   funnel   an animated marketing funnel with every metric worked out, and a check against real Python */

/* ---------- webpad ---------- */
const WP_HARNESS = `(function(){var P=parent;function send(o){try{P.postMessage(o,'*')}catch(e){}}
var L=console.log;console.log=function(){var a=[].slice.call(arguments).map(function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(' ');send({dsq:'log',text:a});try{L.apply(console,arguments)}catch(e){}};
console.error=function(){var a=[].slice.call(arguments).join(' ');send({dsq:'err',text:a})};
window.onerror=function(m,u,l){send({dsq:'err',text:String(m)+(l?' (line '+l+')':'')})};
window.addEventListener('unhandledrejection',function(e){send({dsq:'err',text:'Unhandled promise error: '+(e.reason&&e.reason.message||e.reason)})});
window.fetch=function(u){var k=String(u),M=window.__mock||{};if(k in M)return Promise.resolve(new Response(JSON.stringify(M[k]),{status:200,headers:{'Content-Type':'application/json'}}));return Promise.reject(new TypeError('Failed to fetch: this practice page has no network. Only the practice URLs shown in the lesson work.'))};
addEventListener('message',function(e){var d=e.data||{};if(d.dsqTests){var r=d.dsqTests.map(function(t){try{return !!(new Function('return ('+t+')')())}catch(x){return false}});send({dsq:'tests',results:r})}});
send({dsq:'ready'})})();`;
BLK.webpad = b => {
  const src = { html: b.html || '', css: b.css || '', js: b.js || '' }, start = Object.assign({}, src), tabs = (b.tabs || ['html', 'css', 'js']).filter(t => b.consoleOnly ? t === 'js' : true);
  let tab = tabs[0], timer = 0; const root = h('div', { class: 'widget webpad' });
  const ta = h('textarea', { class: 'wp-ta', spellcheck: 'false', 'aria-label': 'code editor' }), frame = h('iframe', { class: 'wp-frame', sandbox: 'allow-scripts', title: 'Live preview' }), cons = h('pre', { class: 'wp-console' }), list = h('div', { class: 'wp-tests' });
  const tabRow = h('div', { class: 'tabs' }, tabs.map(t => h('button', { class: 'tab' + (t === tab ? ' on' : ''), type: 'button', onclick: () => { src[tab] = ta.value; tab = t; ta.value = src[t]; $$('.tab', tabRow).forEach(x => x.classList.toggle('on', x.dataset.t === t)); } , 'data-t': t }, { html: 'HTML', css: 'CSS', js: 'JavaScript' }[t])));
  ta.value = src[tab]; ta.style.height = (b.height || 230) + 'px';
  const doc = () => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:12px}${src.css}</style></head><body>${src.html}<script>window.__mock=${JSON.stringify(b.mock || {}).replace(/</g, '\\u003c')};${WP_HARNESS}<\/script><script>${src.js.replace(/<\/script/gi, '<\\/script')}<\/script></body></html>`;
  let results = (b.tests || []).map(() => null);
  const paintTests = () => { list.innerHTML = ''; (b.tests || []).forEach((t, i) => list.append(h('div', { class: 'wp-test ' + (results[i] === true ? 'ok' : results[i] === false ? 'no' : '') }, h('span', { class: 'tick' }, results[i] === true ? '✓' : results[i] === false ? '✗' : '•'), t.label))); };
  const run = () => { src[tab] = ta.value; cons.textContent = ''; results = (b.tests || []).map(() => null); paintTests(); frame.srcdoc = doc(); };
  window.addEventListener('message', e => {
    if (e.source !== frame.contentWindow) return; const d = e.data || {};
    if (d.dsq === 'log') { cons.textContent += (cons.textContent ? '\n' : '') + d.text; cons.scrollTop = 1e6; }
    else if (d.dsq === 'err') { cons.textContent += (cons.textContent ? '\n' : '') + '⚠ ' + d.text; cons.classList.add('bad'); }
    else if (d.dsq === 'ready') { cons.classList.remove('bad'); if ((b.tests || []).length) setTimeout(() => { try { frame.contentWindow.postMessage({ dsqTests: b.tests.map(t => t.js) }, '*'); } catch (x) { } }, b.testDelay || 250); }
    else if (d.dsq === 'tests') { results = d.results; paintTests(); const all = results.length && results.every(Boolean); root.classList.toggle('solved', all); if (all && !root._solved) { root._solved = true; toast('✓ All checks pass'); } }
  });
  ta.addEventListener('input', () => { src[tab] = ta.value; clearTimeout(timer); timer = setTimeout(run, 450); });
  ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); } });
  const dev = h('div', { class: 'chip-row' }, [['🖥️ Wide', '100%'], ['📱 Phone (360 px)', '360px']].map(([t, w], i) => h('button', { class: 'btn ghost', type: 'button', onclick: () => { frame.style.width = w; } }, t)));
  root.append(h('div', { class: 'w-head' }, '🧪 ' + (b.title || 'Live editor'), h('span', { class: 'pill' }, 'LIVE · real browser')), b.goal ? h('div', { class: 'w-note', html: '<b>Goal:</b> ' + md(b.goal) }) : null,
    h('div', { class: 'wp-grid' }, h('div', { class: 'wp-left' }, tabs.length > 1 ? tabRow : null, ta, h('div', { class: 'cell-bar' }, h('button', { class: 'btn', type: 'button', onclick: run }, '▶ Run'), h('button', { class: 'btn ghost', type: 'button', onclick: () => { Object.assign(src, start); ta.value = src[tab]; root._solved = false; run(); } }, '↺ Reset'), b.solution ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { if (confirm('Show the solution? Try a little longer first.')) { Object.assign(src, b.solution); ta.value = src[tab]; run(); } } }, '💡 Show solution') : null, h('button', { class: 'btn ghost', type: 'button', onclick: e => copyText(src[tab] = ta.value, e.target) }, 'Copy'))),
      h('div', { class: 'wp-right' }, b.consoleOnly ? null : dev, frame, h('div', { class: 'code-title' }, 'CONSOLE'), cons, (b.tests || []).length ? h('div', { class: 'code-title' }, 'CHECKS') : null, list)));
  if (b.consoleOnly) frame.style.cssText = 'width:0;height:0;border:0;position:absolute';
  paintTests(); root._api = { set: o => { Object.assign(src, o); ta.value = src[tab]; run(); }, results: () => results, run }; setTimeout(run, 30); return root;
};

/* ---------- cssplay: the real browser lays out the boxes ---------- */
BLK.cssplay = b => {
  const root = h('div', { class: 'widget' }), stage = h('div', { class: 'cp-stage' }), codeEl = h('code', {}); const boxes = Array.from({ length: b.items || 3 }, (_, i) => h('div', { class: 'cp-box', style: Object.assign({ background: ['#2a78d6', '#eb6834', '#1baf7a', '#6250d6', '#eda100', '#e34948'][i % 6] }, (b.itemStyle || [])[i] || {}) }, String(i + 1))); stage.append(...boxes);
  const ctls = b.props.map(p => { const c = control(Object.assign({ type: p.type || 'select' }, p, { label: p.label || p.css }), upd); c.id = p.css; c._p = p; return c; });
  function upd() { const css = []; ctls.forEach(c => { const v = c.get(); const val = c._p.unit ? v + c._p.unit : v; stage.style[c._p.css.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = val; css.push(`  ${c._p.css}: ${val};`); }); setCode(codeEl, `${b.selector || '.container'} {\n  display: ${b.display || 'flex'};\n${css.join('\n')}\n}`); }
  stage.style.display = b.display || 'flex'; if (b.stageStyle) Object.assign(stage.style, b.stageStyle);
  root.append(h('div', { class: 'w-head' }, '🧪 ' + (b.title || 'CSS lab'), h('span', { class: 'pill' }, 'LIVE · real browser')), h('div', { class: 'w-body' }, h('div', { class: 'w-ctl' }, ctls), h('div', { class: 'w-stage' }, stage, h('div', { class: 'code-wrap' }, h('button', { class: 'copy', onclick: e => copyText(codeEl._src, e.target) }, 'Copy'), h('pre', {}, codeEl)), b.note ? h('div', { class: 'w-note', html: md(b.note) }) : null)));
  setTimeout(upd, 0); return root;
};

/* ---------- box model ---------- */
BLK.boxmodel = b => {
  const mk = (id, label, min, max, value) => control({ id, type: 'range', label, min, max, value, fmt: v => v + ' px' }, upd), W = mk('w', 'content width', 60, 240, 160), P = mk('p', 'padding', 0, 40, 16), B = mk('b', 'border', 0, 20, 4), M = mk('m', 'margin', 0, 40, 12);
  const sizing = control({ type: 'select', label: 'box-sizing', options: [['content-box', 'content-box (default)'], ['border-box', 'border-box']], value: 'content-box' }, upd);
  const view = h('div', { class: 'bm-view' }), eq = h('div', { class: 'w-eq' }), note = h('div', { class: 'w-note' }), state = { cur: null };
  function upd() {
    const w = +W.get(), p = +P.get(), bd = +B.get(), m = +M.get(), bs = sizing.get(), cw = bs === 'border-box' ? Math.max(0, w - 2 * p - 2 * bd) : w, total = cw + 2 * p + 2 * bd, outer = total + 2 * m; view.innerHTML = '';
    const lay = (c, pad, label, inner) => h('div', { class: 'bm-l', style: { background: c, padding: Math.max(pad, 0) / 2 + 'px' } }, h('span', { class: 'bm-t' }, label), inner);
    view.append(lay('#fbe3cf', m, 'margin ' + m, lay('#f6cf86', bd, 'border ' + bd, lay('#cfe3c3', p, 'padding ' + p, h('div', { class: 'bm-c', style: { width: Math.round(cw / 2) + 'px' } }, 'content ' + cw)))));
    eq.innerHTML = bs === 'border-box' ? `width: ${w}px (border-box) → content ${w} − 2×${p} − 2×${bd} = <b>${cw}px</b> · the box is <b>${total}px</b> wide` : `content ${cw} + padding 2×${p} + border 2×${bd} = <b>${total}px</b> wide · with margins <b>${outer}px</b> of space`;
    note.innerHTML = md(bs === 'border-box' ? '`border-box` makes the width you set include padding and border, so boxes stay the size you wrote. Most sites turn it on for everything.' : 'With the default `content-box` the width you set is only the **content**; padding and border are added on top, which is why boxes come out wider than you expect.');
    state.cur = { w, p, bd, m, bs, total };
  }
  const check = h('button', { class: 'btn ghost', type: 'button', onclick: () => { const c = state.cur, f = h('iframe', { sandbox: 'allow-same-origin', style: { position: 'absolute', width: '600px', height: '200px', left: '-9999px' } }); document.body.append(f); const d = f.contentDocument; d.open(); d.write(`<div id=x style="width:${c.w}px;padding:${c.p}px;border:${c.bd}px solid #000;margin:${c.m}px;box-sizing:${c.bs}"></div>`); d.close(); const got = d.getElementById('x').offsetWidth; f.remove(); res.className = 'w-note ' + (got === c.total ? 'ok' : 'bad'); res.textContent = got === c.total ? `✓ The real browser measures ${got} px: the same as the picture.` : `The browser measured ${got} px but the picture says ${c.total} px.`; } }, '✔ Measure it in the real browser'), res = h('div', { class: 'w-note' }, 'Press the button: the page builds this exact box and measures it.');
  const w = h('div', { class: 'widget' }, h('div', { class: 'w-head' }, '🧪 ' + (b.title || 'Box model lab'), h('span', { class: 'pill' }, 'LIVE')), h('div', { class: 'w-body' }, h('div', { class: 'w-ctl' }, W, P, B, M, sizing), h('div', { class: 'w-stage' }, eq, view, note, check, res)));
  setTimeout(upd, 0); w._get = () => state.cur; return w;
};

/* ---------- marketing funnel ---------- */
BLK.funnel = b => {
  const mk = (id, label, min, max, step, value, fmt) => control({ id, type: 'range', label, min, max, step, value, fmt }, upd);
  const imp = mk('imp', 'impressions', 10000, 500000, 10000, 100000, v => v.toLocaleString()), ctr = mk('ctr', 'click-through rate (CTR)', 0.5, 6, 0.1, 2, v => v + '%'), cvr = mk('cvr', 'landing page conversion to lead', 1, 30, 0.5, 8, v => v + '%'), win = mk('win', 'lead to customer', 2, 50, 1, 15, v => v + '%'), cpc = mk('cpc', 'cost per click', 0.1, 5, 0.1, 0.8, v => '$' + v.toFixed(2)), val = mk('val', 'value of one customer', 10, 500, 5, 120, v => '$' + v);
  const stage = h('div', { class: 'w-stage' }), eq = h('div', { class: 'w-eq' }), res = h('div', { class: 'w-note' }); let cur = null;
  function upd() {
    const I = +imp.get(), C = +ctr.get() / 100, V = +cvr.get() / 100, W = +win.get() / 100, K = +cpc.get(), A = +val.get();
    const clicks = Math.round(I * C), leads = Math.round(clicks * V), cust = Math.round(leads * W), spend = clicks * K, rev = cust * A, cpa = cust ? spend / cust : 0, roas = spend ? rev / spend : 0, profit = rev - spend; cur = { clicks, leads, cust, spend: +spend.toFixed(2), rev, cpa: +cpa.toFixed(2), roas: +roas.toFixed(3), profit: +profit.toFixed(2) };
    const rows = [['Impressions', I, 1, '#9fb8e6'], ['Clicks', clicks, clicks / I, '#6f97dc'], ['Leads', leads, leads / I, '#3f76d3'], ['Customers', cust, cust / I, '#1f55b8']]; stage.innerHTML = '';
    const F = h('div', { class: 'fn-wrap' }); rows.forEach(([n, v, f, c], i) => F.append(h('div', { class: 'fn-row' }, h('div', { class: 'fn-lab' }, n), h('div', { class: 'fn-bar-wrap' }, h('div', { class: 'fn-bar', style: { width: Math.max(2, Math.pow(f, .4) * 100) + '%', background: c, animationDelay: i * 80 + 'ms' } })), h('div', { class: 'fn-v' }, v.toLocaleString())))); stage.append(F);
    stage.append(h('div', { class: 'grid g4' }, [['Spend', '$' + spend.toLocaleString(undefined, { maximumFractionDigits: 0 })], ['Revenue', '$' + rev.toLocaleString()], ['CPA', cust ? '$' + cpa.toFixed(2) : 'no customers'], ['ROAS', roas.toFixed(2) + '×']].map(([t, v], i) => h('div', { class: 'mini', style: { animation: `pop .4s ${i * .05}s both` } }, h('h4', {}, t), h('p', { style: { fontSize: '1.3rem', fontWeight: 700, color: 'var(--ink)' } }, v)))));
    eq.innerHTML = `profit = revenue − spend = <b>$${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b> &nbsp; · &nbsp; break-even ROAS is 1.0×`; eq.style.color = profit < 0 ? 'var(--bad)' : '';
  }
  const chk = h('button', { class: 'btn ghost', type: 'button', onclick: async () => { const c = cur; res.className = 'w-note'; res.textContent = 'Running in real Python…'; const r = await runPy(`I, C, V, W, K, A = ${+imp.get()}, ${+ctr.get() / 100}, ${+cvr.get() / 100}, ${+win.get() / 100}, ${+cpc.get()}, ${+val.get()}\nclicks = round(I * C)\nleads = round(clicks * V)\ncust = round(leads * W)\nspend = clicks * K\nrev = cust * A\nresult = {"clicks": clicks, "leads": leads, "cust": cust, "spend": round(spend, 2), "rev": rev, "roas": round(rev / spend, 3), "profit": round(rev - spend, 2)}`, ['result']); const got = r.vars && r.vars.result && r.vars.result.v; const ok = got && got.clicks === c.clicks && got.leads === c.leads && got.cust === c.cust && Math.abs(got.profit - c.profit) < 0.02 && Math.abs(got.roas - c.roas) < 0.002; res.className = 'w-note ' + (ok ? 'ok' : 'bad'); res.textContent = ok ? '✓ Real Python gets the same clicks, leads, customers, ROAS and profit.' : 'The picture and Python disagree: ' + JSON.stringify(got); } }, '✔ Check with real Python');
  const w = h('div', { class: 'widget' }, h('div', { class: 'w-head' }, '🧪 ' + (b.title || 'Funnel lab'), h('span', { class: 'pill' }, 'LIVE')), h('div', { class: 'w-body' }, h('div', { class: 'w-ctl' }, imp, ctr, cvr, win, cpc, val), h('div', { class: 'w-stage' }, stage, eq, chk, res)));
  setTimeout(upd, 0); return w;
};
