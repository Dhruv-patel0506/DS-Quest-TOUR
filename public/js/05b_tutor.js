'use strict';
/* =====================================================================
   Code Tutor: "why does my code do this?"
   Python runs your code once with a tracer, recording the line about to run and every variable
   after each step. The tutor replays it: highlighted line, plain-English explanation of that line,
   what changed (arrays drawn as cells), and the output so far.
   ===================================================================== */
const EXPLAIN = [
  [/^\s*import\s+numpy|^\s*import\s+numpy as np/, 'Loads NumPy, the array library, under the short name <code>np</code>.'],
  [/^\s*import\s+pandas/, 'Loads pandas (tables) under the short name <code>pd</code>.'],
  [/^\s*import\s+matplotlib|^\s*from\s+matplotlib/, 'Loads the plotting library.'],
  [/^\s*import\s+seaborn/, 'Loads seaborn, statistical charts built on matplotlib.'],
  [/^\s*(import|from)\s+sklearn|^\s*from\s+sklearn/, 'Imports a scikit-learn tool (model, scaler or metric).'],
  [/^\s*(import|from)\s/, 'Makes code from another module available.'],
  [/np\.array\(|numpy\.array\(/, '<code>np.array</code> copies the Python list into one typed block of memory (an ndarray) so maths runs on all elements at once.'],
  [/np\.arange\(/, '<code>arange</code> counts from start up to (but not including) stop in equal steps.'],
  [/np\.linspace\(/, '<code>linspace</code> makes n evenly spaced numbers and includes both ends.'],
  [/np\.(zeros|ones|full|eye|empty)\(/, 'Creates a new array already filled with the same value (or an identity matrix).'],
  [/\.reshape\(/, '<code>reshape</code> re-cuts the SAME numbers into a new shape - no value changes, only how they are grouped. -1 means "work this size out".'],
  [/\.T\b|np\.transpose/, 'Transposing swaps rows and columns (reverses the axes).'],
  [/np\.where\(/, '<code>np.where(condition, a, b)</code> is a vectorised if/else: for every element it picks a where the condition is True and b where it is False.'],
  [/\.(sum|mean|std|max|min|argmax|argmin)\(.*axis/, 'An aggregation along an <b>axis</b>: the axis you name is the one that disappears from the shape.'],
  [/\.(sum|mean|std|max|min|median)\(/, 'Collapses all the values into one summary number.'],
  [/argsort|\.sort_values|sorted\(/, 'Sorting: <code>argsort</code> returns the POSITIONS that would sort the data; <code>sort</code>/<code>sorted</code> return the sorted values.'],
  [/np\.dot|@|np\.matmul/, 'The dot / matrix product: multiply matching elements and add them up.'],
  [/linalg\.solve/, 'Solves the linear system A @ x = b for x.'],
  [/default_rng|np\.random/, 'Random numbers - the seed makes the same "random" numbers appear every run, so results are reproducible.'],
  [/pd\.read_csv|read_csv/, 'Reads the file into a DataFrame: a table whose columns are NumPy arrays with labels.'],
  [/pd\.DataFrame\(/, 'Builds a DataFrame (a labelled table) from the dictionary: keys become column names.'],
  [/\.groupby\(/, '<b>Split-apply-combine</b>: split the rows into groups by the key, apply the summary to each group, combine the answers into one result.'],
  [/\.merge\(|pd\.merge|pd\.concat/, 'Combines tables: merge matches rows by a key (like a SQL JOIN), concat stacks them.'],
  [/\.fillna\(|\.dropna\(/, 'Handles missing values: fill them with a value or drop the rows that have them.'],
  [/\.str\./, 'String methods applied to every value of the column at once.'],
  [/\.dt\./, 'Date parts (month, weekday, hour...) read from a datetime column.'],
  [/pd\.cut|pd\.qcut/, 'Turns numbers into bands (cut = your boundaries, qcut = equal-sized groups).'],
  [/rolling\(|resample\(/, 'Time-series windows: rolling = a moving window, resample = group by calendar period.'],
  [/plt\.subplots/, 'Creates the Figure (canvas) and the Axes (the plot areas) you will draw on.'],
  [/\.plot\(|\.scatter\(|\.bar\(|\.barh\(|\.hist\(|\.boxplot\(|\.imshow\(/, 'Draws the data on the axes. Nothing is shown yet - the picture appears when the code finishes.'],
  [/set_title|set_xlabel|set_ylabel|\.legend\(/, 'Labels make the chart readable: title, axis names with units, legend for several series.'],
  [/train_test_split/, 'Splits the rows at random into a training set (the model learns from it) and a test set (it is judged on data it never saw).'],
  [/\.fit\(/, '<b>Training</b>: the model looks at the examples and adjusts its internal numbers (parameters) to fit them.'],
  [/\.predict\(|\.transform\(/, 'Uses what was learned to produce outputs for new rows (predict) or to apply the learned scaling (transform).'],
  [/\.score\(|accuracy_score|r2_score|mean_squared_error/, 'Measures how good the predictions are - always on data the model did not train on.'],
  [/Pipeline|make_pipeline|ColumnTransformer/, 'A pipeline chains preprocessing and model so exactly the same steps run in training and prediction.'],
  [/StandardScaler/, 'Rescales each column to mean 0 and standard deviation 1 (learned from the training data only).'],
  [/KMeans/, 'K-means: pick k centres, assign every point to its nearest centre, move each centre to the mean of its points, repeat.'],
  [/PCA\(/, 'PCA finds the directions of greatest variation and rotates the data onto them.'],
  [/np\.exp|sigmoid/, 'Squashes numbers: exp grows fast; the sigmoid maps any number into (0, 1).'],
  [/^\s*for\s+(.+?)\s+in\s+(.+):/, 'A loop: the name takes each value of the sequence in turn and the indented lines run once per value.'],
  [/^\s*while\s/, 'Repeats the indented lines as long as the condition is True.'],
  [/^\s*(if|elif)\s/, 'Checks the condition. The indented lines run only when it is True.'],
  [/^\s*else\s*:/, 'The fallback: runs when none of the earlier conditions were True.'],
  [/^\s*def\s+(\w+)/, 'Defines a function: nothing runs yet; Python only remembers the recipe under that name.'],
  [/^\s*return\b/, '<code>return</code> hands the value back to whoever called the function and ends the function.'],
  [/^\s*try\s*:/, 'Tries the risky lines; if an error occurs Python jumps to the matching <code>except</code>.'],
  [/^\s*print\(/, '<code>print</code> writes the value as text to the output panel.'],
  [/^\s*\w+\s*\[.*\]\s*=[^=]/, 'Assigns into part of an existing container (item or slice).'],
  [/^\s*\w+\s*(\+|-|\*|\/)=/, 'Updates the variable in place using its old value.'],
  [/^\s*[\w, ]+\s*=\s*[^=]/, 'Python works out the right-hand side first, then stores the result under the name on the left.'],
];
const explainLine = src => { for (const [re, t] of EXPLAIN) if (re.test(src)) return t; return 'Runs this line.'; };

function cellGrid(v, prev) {
  const rows = v.data; if (!rows) return '';
  const flat = rows.length === 1 || !Array.isArray(rows[0]) ? [rows.flat()] : rows;
  const pr = prev && prev.data;
  return '<div class="tgrid">' + flat.slice(0, 8).map((r, i) => '<div>' + r.slice(0, 12).map((x, j) => { const ch = pr && JSON.stringify(((pr[i] || [])[j])) !== JSON.stringify(x) ? ' chg' : ''; return `<i class="${ch}">${esc(typeof x === 'number' ? (Number.isInteger(x) ? x : +x.toFixed(3)) : String(x))}</i>`; }).join('') + (r.length > 12 ? '<i class="more">...</i>' : '') + '</div>').join('') + '</div>';
}
function varCard(name, v, prev) {
  let body = '';
  if (v.t === 'arr') body = `<span class="chip">shape ${JSON.stringify(v.shape).replace('[', '(').replace(']', ')')}</span><span class="chip">${esc(v.dtype)}</span>` + cellGrid(v, prev);
  else if (v.t === 'df') body = `<span class="chip">DataFrame ${v.shape.join(' x ')}</span><div class="tgrid"><div>${v.cols.map(c => `<i class="hd">${esc(c)}</i>`).join('')}</div>${v.head.map(r => `<div>${r.map(x => `<i>${esc(x)}</i>`).join('')}</div>`).join('')}</div>`;
  else if (v.t === 'series') body = `<span class="chip">Series ${v.shape.join(' x ')}</span><div class="tgrid"><div>${v.head.map(x => `<i>${esc(x)}</i>`).join('')}</div></div>`;
  else body = `<code>${esc(v.r || '')}</code>` + (v.data && v.data[0] ? cellGrid({ data: v.data }, prev) : '') + (v.n != null ? `<span class="chip">${v.n} items</span>` : '');
  return `<div class="tvar${prev && JSON.stringify(prev) !== JSON.stringify(v) ? ' new' : (!prev ? ' new' : '')}"><b>${esc(name)}</b>${body}</div>`;
}

async function codeTutor(code, o = {}) {
  const root = h('div', { class: 'card tutor' }, h('div', { class: 'hd' }, h('span', {}, 'Code Tutor: why does it do this?')), h('div', { class: 'pad muted' }, 'Tracing your code...'));
  const res = await Py.trace({ code, files: o.files, prelude: o.prelude });
  root.innerHTML = '';
  root.append(h('div', { class: 'hd' }, h('span', {}, 'Code Tutor: why does it do this?'), h('span', { class: 'chip' }, res.events.length + ' steps' + (res.truncated ? ' (first ' + res.events.length + ')' : ''))));
  if (!res.events.length) { root.append(h('div', { class: 'pad' }, res.error ? 'The code stopped with an error before any step could be shown: ' + fmtErr(res.error) : 'Nothing to trace.')); return root; }
  const lines = code.split('\n'), ev = res.events; let i = 0, timer = null;
  const codeBox = h('div', { class: 'tcode' }), cap = h('div', { class: 'tcap' }), vars = h('div', { class: 'tvars' }), outBox = h('pre', { class: 'tout' });
  const slider = h('input', { type: 'range', min: 0, max: ev.length - 1, value: 0, 'aria-label': 'step' });
  const lbl = h('span', { class: 'muted mono' });
  const btn = (t, f) => h('button', { class: 'btn sm', type: 'button', onclick: f }, t);
  const play = btn('▶ Play', () => { if (timer) { stop(); } else { play.textContent = '❚❚ Pause'; timer = setInterval(() => { if (i >= ev.length - 1) stop(); else { i++; draw(); } }, 1000); } });
  const stop = () => { clearInterval(timer); timer = null; play.textContent = '▶ Play'; };
  root.append(h('div', { class: 'pad row', style: { borderBottom: '1px solid var(--line)' } }, btn('◀', () => { stop(); i = Math.max(0, i - 1); draw(); }), play, btn('▶', () => { stop(); i = Math.min(ev.length - 1, i + 1); draw(); }), slider, lbl),
    h('div', { class: 'tgrid2' }, h('div', {}, codeBox), h('div', { class: 'stack' }, cap, vars, h('div', {}, h('div', { class: 'muted mono', style: { fontSize: '11px', fontWeight: 700 } }, 'OUTPUT SO FAR'), outBox))));
  slider.addEventListener('input', () => { stop(); i = +slider.value; draw(); });
  function draw() {
    const e = ev[i], nx = ev[i + 1], after = nx ? nx.vars : e.vars, before = e.vars, ln = e.line;
    slider.value = i; lbl.textContent = `step ${i + 1} / ${ev.length}`;
    const from = Math.max(1, ln - 6), to = Math.min(lines.length, ln + 7);
    codeBox.innerHTML = lines.slice(from - 1, to).map((t, k) => `<div class="tl${from + k === ln ? ' on' : ''}"><span>${from + k}</span><code>${hlPy(t) || ' '}</code></div>`).join('');
    const src = lines[ln - 1] || '';
    let result = '';
    if (e.ret) result = `The function returns <code>${esc(e.ret.r || (e.ret.shape ? 'array ' + JSON.stringify(e.ret.shape) : ''))}</code>.`;
    else { const chg = Object.keys(after).filter(k => !before[k] || JSON.stringify(before[k]) !== JSON.stringify(after[k])); if (chg.length && nx) result = 'After this line: ' + chg.slice(0, 3).map(k => `<code>${esc(k)}</code> ${before[k] ? 'changed to' : 'is now'} ${after[k].t === 'arr' ? 'an array of shape ' + JSON.stringify(after[k].shape).replace('[', '(').replace(']', ')') : after[k].t === 'df' ? 'a DataFrame ' + after[k].shape.join('x') : '<code>' + esc(after[k].r || after[k].t) + '</code>'}`).join('; ') + '.'; }
    const fn = e.fn && e.fn !== '<module>' ? ` <span class="chip">inside ${esc(e.fn)}()</span>` : '';
    cap.innerHTML = `<div class="muted mono" style="font-size:11px;font-weight:700">LINE ${ln}${fn}</div><div><code>${esc(src.trim())}</code></div><p>${explainLine(src)}</p>${result ? `<p class="tres">${result}</p>` : ''}`;
    vars.innerHTML = Object.keys(after).slice(0, 10).map(k => varCard(k, after[k], before[k])).join('') || '<div class="muted">No variables yet.</div>';
    const nout = (nx ? nx.out : res.stdout) || ''; outBox.textContent = nout || '(nothing printed yet)';
    if (i === ev.length - 1 && res.error) cap.innerHTML += `<p class="tres" style="color:var(--bad)">Then Python stopped: ${esc(fmtErr(res.error))}</p>`;
  }
  draw(); root._stop = stop; return root;
}
DSQ.codeTutor = codeTutor;

/* add a "Why? Step through it" button + panel to an editor/output block */
function attachTutor(parent, getCode, o = {}) {
  const host = h('div'), btn = h('button', { class: 'btn', type: 'button' }, 'Why does it do this? Step through');
  btn.addEventListener('click', async () => {
    if (/\b___\b/.test(getCode())) { toast('Fill the ___ blanks first, then step through.'); return; }
    btn.disabled = true; host.innerHTML = ''; host.append(h('p', { class: 'muted' }, 'Tracing...'));
    const t = await codeTutor(getCode(), { files: o.files && o.files(), prelude: o.prelude && o.prelude() }); host.innerHTML = ''; host.append(t); btn.disabled = false;
    DSQ.S.log({ type: 'tutor' });
  });
  parent.append(btn, host); return btn;
}
DSQ.attachTutor = attachTutor;
