'use strict';
/* =====================================================================
   Function sheets (#/sheets, #/sheet/<module>): "every function, explained, runnable".
   One Python session per page: the items of a section run top to bottom, like notebook cells, so a later line can use what an earlier line made.
   ===================================================================== */
function sheetMods() { return (DSQ.modules || []).filter(m => m.sheet && DSQ.sheets[m.id]); }
const SHEET_ID = (sec, i) => sec.id + '-' + i;

function viewSheets() {
  const mods = sheetMods(), root = h('div', { class: 'stack' });
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Learn'), h('h1', {}, 'Function sheets'), h('p', { class: 'muted lead' }, 'Every function of a topic in one place, in the order you meet it. Each one has a plain-words explanation, the pieces of the line named, a line you can run and change, and the mistake to avoid. No coding experience needed.'))));
  if (!mods.length) root.append(h('div', { class: 'card pad' }, 'No sheets are available for your account yet.'));
  const seen = (S.st.sheet = S.st.sheet || {});
  root.append(h('div', { class: 'mods' }, mods.map(m => {
    const sh = DSQ.sheets[m.id], total = sh.sections.reduce((n, s) => n + s.items.length, 0), done = Object.keys(seen[m.id] || {}).length;
    return h('a', { class: 'card mod', href: '#/sheet/' + m.id }, h('span', { class: 'ic', style: { background: colv(m.color || 0) } }, m.icon || '?'), h('h4', {}, sh.title || m.title), h('p', {}, total + ' functions in ' + sh.sections.length + ' groups'), h('div', { class: 'bar' }, h('i', { style: { width: Math.round(100 * done / total) + '%' } })), h('span', { class: 'badge chip' }, done + ' of ' + total + ' understood'));
  })));
  return root;
}

function viewSheet(id) {
  const m = (DSQ.modules || []).find(x => x.id === id), sh = DSQ.sheets[id];
  if (!m || !sh) return h('div', { class: 'card pad' }, 'This sheet is not available. ', h('a', { href: '#/sheets' }, 'See all sheets'));
  const root = h('div', { class: 'stack sheet' }), seen = ((S.st.sheet = S.st.sheet || {})[id] = S.st.sheet[id] || {});
  const total = sh.sections.reduce((n, s) => n + s.items.length, 0);
  const prog = h('span', { class: 'chip' });
  const paintProg = () => { prog.textContent = Object.keys(seen).length + ' of ' + total + ' understood'; };
  const status = h('span', { class: 'chip' });
  const paintStatus = () => { status.textContent = 'Python: ' + (Py.state === 'ready' ? 'ready' : Py.state === 'err' ? 'error' : Py.state === 'loading' ? 'loading ' + Py.pct + '%' : 'starts when you run'); status.className = 'chip ' + (Py.state === 'ready' ? 'ok' : ''); };
  Py.on(paintStatus); paintProg();
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Find a function, e.g. "average" or "sort"', 'aria-label': 'Search this sheet' });
  let sections = [];
  root.append(h('a', { href: '#/sheets', class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← All function sheets'),
    h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, m.title), h('h1', {}, sh.title || (m.title + ': function sheet')), h('div', { class: 'muted lead', html: sh.intro || '' }))),
    h('div', { class: 'card pad stack' }, h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, prog, status, h('span', { class: 'grow' }),
      h('button', { class: 'btn sm', type: 'button', onclick: async () => { await Py.kreset(); sections.forEach(s => { s.ran = false; }); toast('Python session restarted'); } }, 'Restart Python session')), search,
      h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, sh.sections.map((s, i) => h('a', { class: 'chip', href: '#', onclick: e => { e.preventDefault(); sections[i].open(true); sections[i].el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, s.title)))));
  sections = sh.sections.map(sec => sectionView(id, sec, seen, paintProg));
  sections.forEach(s => root.append(s.el));
  search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    sections.forEach(s => { const hits = s.filter(q); s.el.hidden = !!q && !hits; if (q && hits) s.open(true, true); });
  };
  return root;
}

function sectionView(modId, sec, seen, paintProg) {
  const body = h('div', { class: 'stack', style: { marginTop: '10px' } }), items = [];
  const det = h('details', { class: 'card pad shsec' }, h('summary', { class: 'shsum' }, h('b', {}, sec.title), h('span', { class: 'muted' }, ' ' + sec.items.length + ' functions')), body);
  const S_ = { el: det, ran: false, built: false };
  async function runItems(btn) {
    if (btn) btn.disabled = true;
    if (sec.setup) await Py.cell(sec.setup, 120000);
    for (const it of items) { const r = await it.run(); if (r && r.error) break; }
    S_.ran = true; if (btn) btn.disabled = false;
  }
  function build() {
    if (S_.built) return; S_.built = true;
    body.append(h('div', { class: 'muted', html: sec.intro || '' }));
    if (sec.setup && sec.setup.trim() && sec.setup.trim().split('\n').length > 1) body.append(h('details', { class: 'shsetup' }, h('summary', {}, 'The data used in this group (it runs first, you can read it)'), h('pre', { class: 'codeblock' }, sec.setup)));
    body.append(h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn sm primary', type: 'button', onclick: e => runItems(e.currentTarget) }, '▶ Run this whole group, top to bottom'), h('span', { class: 'muted', style: { fontSize: '12.5px' } }, 'Each line builds on the one above, like cells in a notebook.')));
    sec.items.forEach((f, i) => { const v = itemView(modId, sec, f, i, seen, paintProg); items.push(v); body.append(v.el); });
  }
  S_.open = (flag, quiet) => { build(); det.open = flag; if (flag && !S_.ran && !quiet) { S_.ran = true; setTimeout(() => runItems(), 50); } };
  det.addEventListener('toggle', () => { if (det.open) { build(); if (!S_.ran) { S_.ran = true; runItems(); } } });
  S_.filter = q => { if (!q) { items.forEach(v => { v.el.hidden = false; }); return true; } build(); let any = false; items.forEach(v => { const hit = v.text.includes(q); v.el.hidden = !hit; any = any || hit; }); return any; };
  return S_;
}

function itemView(modId, sec, f, i, seen, paintProg) {
  const key = SHEET_ID(sec, i), out = h('div', { class: 'nbout shout' });
  const parts = (f.parts && f.parts.length) ? h('table', { class: 't shparts' }, h('tbody', {}, f.parts.map(p => h('tr', {}, h('td', {}, h('code', {}, p[0])), h('td', { html: p[1] }))))) : null;
  const edBox = h('div', {}), ed = Editor(edBox, { code: f.code, minLines: Math.min(8, f.code.split('\n').length + 1), onRun: () => run() });
  const runBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => run() }, '▶ Run'), resetBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { ed.set(f.code); } }, 'Reset the line');
  const ok = h('input', { type: 'checkbox', checked: !!seen[key], onchange: e => { if (e.target.checked) seen[key] = 1; else delete seen[key]; S.save(); paintProg(); } });
  async function run() { out.innerHTML = ''; out.append(h('pre', { class: 'muted' }, 'running...')); runBtn.disabled = true; const r = await Py.cell(ed.get(), 120000); runBtn.disabled = false; nbOutput(out, r); out.classList.toggle('bad', !!r.error); return r; }
  const el = h('div', { class: 'shi' },
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'baseline' } }, h('code', { class: 'shfn' }, f.fn), f.excel ? h('span', { class: 'chip', title: 'The same idea in a spreadsheet' }, 'Like in Excel: ' + f.excel) : null),
    h('p', { class: 'shplain', html: f.plain }), parts ? h('div', {}, h('div', { class: 'eyebrow' }, 'Reading the line'), parts) : null,
    edBox, h('div', { class: 'row', style: { gap: '8px' } }, runBtn, resetBtn, h('span', { class: 'grow' }), h('label', { class: 'row', style: { gap: '6px', fontSize: '13px' } }, ok, 'I understand this')), out,
    f.watch ? h('div', { class: 'callout warn' }, h('b', {}, 'Watch out: '), h('span', { html: f.watch })) : null);
  return { el, run, text: (f.fn + ' ' + f.plain + ' ' + (f.excel || '')).toLowerCase().replace(/<[^>]+>/g, ' ') };
}
