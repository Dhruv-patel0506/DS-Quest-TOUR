'use strict';
/* =====================================================================
   The in-app notebook: cells that share one running Python (like Jupyter), inside the page.
   - code cells run in the same Python session, the last expression is shown, plots and tables appear below;
   - Shift+Enter runs and moves on, Ctrl+Enter runs in place;
   - notebooks are saved with your account (your progress), and can be downloaded as a real .ipynb;
   - dataset notebooks start with load('name'): your own copy, rebuilt from the original every time.
   ===================================================================== */
const NB = {
  list() { const s = S.st; s.nbk = s.nbk || { list: [] }; return s.nbk.list; },
  get(id) { return NB.list().find(n => n.id === id); },
  create(title, cells) { const nb = { id: 'n' + Date.now().toString(36), title, cells, at: Date.now() }; NB.list().unshift(nb); S.save(); return nb; },
  starter(dsId, with3d) {
    const d = BIG.catalog.find(x => x.id === dsId);
    if (!d) return NB.create('Untitled notebook', [{ k: 'md', s: '# Untitled notebook\nWrite Python in a code cell and press **Shift+Enter**. All cells share one Python session, so a variable made in one cell is there in the next.' }, { k: 'code', s: 'import numpy as np\nimport pandas as pd\n\nx = np.arange(10)\nx ** 2' }]);
    const id = d.id;
    const nb3 = NB.create(d.title, [
      { k: 'md', s: `# ${d.title}\n${d.blurb}\nPress **Shift+Enter** in a cell to run it. \`load('${id}')\` gives you a fresh copy of the original every time, so you can experiment freely.` },
      { k: 'code', s: `from dsq_data import load\n\ndf = load('${id}')      # your own copy of ${BIG.fmt(BIG.n())} rows\ndf.head()` },
      { k: 'code', s: 'df.shape' },
      { k: 'code', s: 'df.info()' },
      { k: 'code', s: 'df.describe().T' },
      { k: 'code', s: 'df.isna().mean().sort_values(ascending=False).head(8)' },
      { k: 'code', s: 'df.select_dtypes("number").iloc[:, :4].hist(figsize=(9, 5), bins=40)' },
      { k: 'md', s: `## Now it is yours\nTry breaking the table: \`df = df.iloc[:10]\`, \`df['${(BIG.catalog.find(x => x.id === id) || {}).id ? 'new_col' : 'x'}'] = 0\`. Then re-run the first code cell: the original is back.\nFor a table with duplicates, blanks and mixed spelling use \`load('${id}', messy=True)\`.` },
      { k: 'code', s: `# your analysis here\n` },
    ].concat(with3d ? [{ k: 'md', s: '## Change the data with code, watch it in 3-D\nOpen the **3-D view** above, choose three numeric columns and press **Load**. Then run the cell below: it clips each numeric column to its 1st-99th percentile. With **Follow my code** on, the pane refreshes by itself: grey lines show how far points moved. Try `df = df.dropna()` or `df = df[df.index % 2 == 0]` too, and the removed rows appear as red crosses.' }, { k: 'code', s: 'num = df.select_dtypes("number").columns[1:4]\nfor c in num:\n    df[c] = df[c].clip(df[c].quantile(.01), df[c].quantile(.99))\ndf[num].describe().T' }] : []));
    if (with3d) nb3.open3d = true;
    return nb3;
  },
  ipynb(nb) {
    const src = s => s.split('\n').map((l, i, a) => i < a.length - 1 ? l + '\n' : l);
    return JSON.stringify({ nbformat: 4, nbformat_minor: 5, metadata: { kernelspec: { name: 'python3', display_name: 'Python 3', language: 'python' }, language_info: { name: 'python' } },
      cells: nb.cells.map(c => c.k === 'md' ? { cell_type: 'markdown', metadata: {}, source: src(c.s) } : { cell_type: 'code', metadata: {}, execution_count: null, outputs: [], source: src(c.s) }) }, null, 1);
  },
};
DSQ.NB = NB;

/* small markdown: headings, **bold**, `code`, paragraphs and - lists */
function nbMd(s) {
  const out = []; let list = false;
  s.split('\n').forEach(raw => {
    const l = raw.trimEnd(), m = /^(#{1,3})\s+(.*)$/.exec(l), li = /^[-*]\s+(.*)$/.exec(l);
    if (list && !li) { out.push('</ul>'); list = false; }
    if (m) out.push(`<h${m[1].length + 1}>${inl(esc(m[2]))}</h${m[1].length + 1}>`);
    else if (li) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inl(esc(li[1]))}</li>`); }
    else if (l) out.push(`<p>${inl(esc(l))}</p>`);
  });
  if (list) out.push('</ul>'); return out.join('');
}

function viewNotebook(parts) {
  const arg = parts[1];
  if (arg === 'new' || (arg && arg.startsWith('new:'))) { const [, ds, flag] = arg.split(':'); const nb = NB.starter(ds, flag === '3d'); location.replace('#/notebook/' + nb.id); return h('div'); }
  const nb = arg && NB.get(arg);
  return nb ? notebookEditor(nb) : notebookList();
}

function notebookList() {
  const root = h('div', { class: 'stack' }), list = NB.list();
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Notebook'), h('h1', {}, 'Write and run Python, right here'),
    h('p', { class: 'muted lead' }, 'A notebook with cells and a live Python session, in this page. It reads the same datasets as the practice tasks, keeps your work with your account, and exports to a real .ipynb for Jupyter, VS Code or Colab.'))));
  root.append(h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('a', { class: 'btn primary', href: '#/notebook/new' }, '+ New blank notebook'), h('a', { class: 'btn', href: '#/data' }, 'Start from a dataset'), h('a', { class: 'btn ghost', href: '#/jupyter' }, 'Use Jupyter on your own computer instead')));
  root.append(h('div', { class: 'card pad stack' }, h('h3', {}, 'Start from a dataset'), h('div', { class: 'row', style: { flexWrap: 'wrap' } }, BIG.catalog.map(d => h('a', { class: 'btn sm', href: '#/notebook/new:' + d.id }, d.title)))));
  root.append(h('div', { class: 'card pad stack' }, h('h3', {}, 'Your notebooks'), list.length ? h('div', { class: 'stack' }, list.map(nb => h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid var(--line)', paddingBottom: '8px' } },
    h('a', { href: '#/notebook/' + nb.id, style: { fontWeight: 700, textDecoration: 'none', color: 'var(--fg)' } }, nb.title), h('span', { class: 'muted', style: { fontSize: '13px' } }, nb.cells.filter(c => c.k === 'code').length + ' code cells · ' + new Date(nb.at).toLocaleDateString()),
    h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { if (confirm('Delete "' + nb.title + '"?')) { const l = NB.list(); l.splice(l.indexOf(nb), 1); S.save(); route(); } } }, 'Delete')))) : h('p', { class: 'muted' }, 'Nothing here yet.')));
  return root;
}

function nbOutput(el, r) {
  el.innerHTML = '';
  if (r.stdout) el.append(h('pre', {}, r.stdout));
  if (r.value) { if (r.value.html) el.append(h('div', { class: 'tscroll nbdf', html: r.value.html })); else el.append(h('pre', { class: 'nbval' }, r.value.text)); }
  if (r.figs && r.figs.length) el.append(h('div', { class: 'figs' }, r.figs.map(b => h('img', { src: 'data:image/png;base64,' + b, alt: 'plot from this cell' }))));
  if (r.error) el.append(h('pre', { class: 'err' }, fmtErr(r.error)), h('pre', { class: 'nbhint' }, ERR_HINT[r.error.type] || ''));
  if (r.reset) el.append(h('pre', { class: 'err' }, 'The Python session was restarted: run the cells again from the top.'));
  if (!el.childNodes.length) el.append(h('pre', { class: 'muted' }, '(no output)'));
}

function notebookEditor(nb) {
  const root = h('div', { class: 'stack nbk' }), cellsEl = h('div'), status = h('span', { class: 'chip' }, 'Python: not started');
  let count = 0, tm, running = false, pane = null;
  const paneBox = h('div', { hidden: true });
  const save = () => { nb.at = Date.now(); clearTimeout(tm); tm = setTimeout(() => S.save(), 1200); };
  const refreshStatus = () => { status.textContent = 'Python: ' + (Py.state === 'ready' ? 'ready' : Py.state === 'err' ? 'error' : Py.state === 'loading' ? 'loading (' + Py.pct + '%)' : 'starts when you run a cell'); status.className = 'chip ' + (Py.state === 'ready' ? 'ok' : ''); };
  Py.on(refreshStatus);
  const title = h('input', { class: 'nbtitle', value: nb.title, 'aria-label': 'Notebook title', oninput: e => { nb.title = e.target.value.slice(0, 80); save(); } });
  const bar = h('div', { class: 'row nbbar' }, title, status, h('span', { class: 'grow' }),
    h('button', { class: 'btn sm primary', type: 'button', onclick: runAll }, '▶▶ Run all'), h('button', { class: 'btn sm', type: 'button', title: 'See a DataFrame as a rotatable 3-D cloud: move points by hand, or change the data with code and watch it', onclick: () => { if (!pane) { pane = pane3D({ onApplied: () => { } }); paneBox.append(pane.el); } paneBox.hidden = !paneBox.hidden; } }, '3-D view'),
    h('button', { class: 'btn sm', type: 'button', onclick: async () => { await Py.kreset(); count = 0; $$('.nbk .nbn', root).forEach(x => x.textContent = '[ ]'); pane && pane.reset(); toast('Python session restarted: variables cleared'); } }, 'Restart session'),
    h('button', { class: 'btn sm', type: 'button', onclick: () => addCell(nb.cells.length, 'code') }, '+ Code'), h('button', { class: 'btn sm', type: 'button', onclick: () => addCell(nb.cells.length, 'md') }, '+ Text'),
    h('button', { class: 'btn sm', type: 'button', onclick: () => { const b = new Blob([NB.ipynb(nb)], { type: 'application/json' }), a = h('a', { href: URL.createObjectURL(b), download: (nb.title || 'notebook').replace(/[^\w.-]+/g, '_') + '.ipynb' }); document.body.append(a); a.click(); a.remove(); } }, 'Download .ipynb'));
  root.append(h('a', { href: '#/notebook', class: 'muted', style: { textDecoration: 'none', fontWeight: 700 } }, '← All notebooks'), bar, h('p', { class: 'muted', style: { fontSize: '13px', margin: 0 } }, 'Shift+Enter runs a cell and moves to the next. Ctrl+Enter runs it in place. All code cells share one Python session. Saved with your account.'), paneBox, cellsEl);

    async function runCell(c, node) {
    const out = $('.nbout', node), n = $('.nbn', node); n.textContent = '[*]'; out.innerHTML = ''; out.append(h('pre', { class: 'muted' }, 'running...'));
    const r = await Py.cell(c.s, 180000); count++; n.textContent = '[' + count + ']'; nbOutput(out, r); out.classList.toggle('bad', !!r.error); S.log({ type: 'nbcell', err: !!r.error }); if (!r.error && pane && !paneBox.hidden && pane.follow()) pane.refresh(); return r;
  }
  async function runAll() { if (running) return; running = true; for (const node of $$('.nbcell', cellsEl)) { const c = nb.cells[+node.dataset.i]; if (c && c.k === 'code') { const r = await runCell(c, node); if (r.error) break; } } running = false; S.save(); }

  function build() {
    cellsEl.innerHTML = '';
    nb.cells.forEach((c, i) => {
      const node = h('div', { class: 'nbcell ' + c.k, 'data-i': i }), tools = h('div', { class: 'nbtools' });
      const move = d => { const j = i + d; if (j < 0 || j >= nb.cells.length) return; [nb.cells[i], nb.cells[j]] = [nb.cells[j], nb.cells[i]]; save(); build(); };
      tools.append(h('button', { class: 'btn sm ghost', type: 'button', title: 'Move up', onclick: () => move(-1) }, '↑'), h('button', { class: 'btn sm ghost', type: 'button', title: 'Move down', onclick: () => move(1) }, '↓'),
        h('button', { class: 'btn sm ghost', type: 'button', title: 'Add a code cell below', onclick: () => addCell(i + 1, 'code') }, '+'),
        h('button', { class: 'btn sm ghost', type: 'button', title: 'Delete this cell', onclick: () => { nb.cells.splice(i, 1); save(); build(); } }, '✕'));
      if (c.k === 'code') {
        const edBox = h('div'), runBtn = h('button', { class: 'btn sm primary', type: 'button', title: 'Run (Ctrl+Enter)', onclick: () => runCell(c, node) }, '▶');
        node.append(h('div', { class: 'nbrow' }, h('div', { class: 'nbin' }, h('span', { class: 'nbn mono' }, '[ ]'), runBtn), edBox, tools), h('div', { class: 'nbout' }));
        const ed = Editor(edBox, { code: c.s, minLines: 2, onChange: v => { c.s = v.slice(0, 20000); save(); }, onRun: () => runCell(c, node), onRunNext: async () => { await runCell(c, node); const nx = $$('.nbcell', cellsEl)[i + 1]; if (nx) { const ta = $('textarea', nx); ta ? ta.focus() : nx.click(); } else addCell(i + 1, 'code'); } });
      } else {
        const view = h('div', { class: 'prose nbmd', html: nbMd(c.s) || '<p class="muted">(empty text cell - double-click to write)</p>' });
        const ta = h('textarea', { class: 'nbmdta', rows: 3, spellcheck: 'false' }); ta.value = c.s; ta.hidden = true;
        const toggle = () => { if (ta.hidden) { ta.hidden = true; view.hidden = true; ta.hidden = false; ta.focus(); } else { c.s = ta.value.slice(0, 20000); view.innerHTML = nbMd(c.s) || '<p class="muted">(empty)</p>'; ta.hidden = true; view.hidden = false; save(); } };
        view.addEventListener('dblclick', toggle); ta.addEventListener('blur', () => { if (!ta.hidden) toggle(); }); ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey)) { e.preventDefault(); toggle(); } });
        node.append(h('div', { class: 'nbrow' }, h('div', { class: 'nbin' }, h('span', { class: 'chip', title: 'Double-click the text to edit' }, 'text')), h('div', {}, view, ta), tools));
      }
      cellsEl.append(node);
    });
  }
  function addCell(at, k) { nb.cells.splice(at, 0, { k, s: k === 'md' ? 'Write notes here. Use # for headings.' : '' }); save(); build(); const t = $$('.nbcell', cellsEl)[at]; if (t) { const ta = $('textarea', t); ta && ta.focus(); t.scrollIntoView({ block: 'center' }); } }
  build(); refreshStatus(); Py.start();
  if (nb.open3d) { nb.open3d = false; pane = pane3D({}); paneBox.append(pane.el); paneBox.hidden = false; (async () => { const first = $$('.nbcell', cellsEl).find(n => nb.cells[+n.dataset.i].k === 'code'); if (first) { const r = await runCell(nb.cells[+first.dataset.i], first); if (!r.error) pane.load(); } })(); }
  App.dis.push(() => { clearTimeout(tm); pane && pane.destroy(); S.save(); });
  return root;
}
