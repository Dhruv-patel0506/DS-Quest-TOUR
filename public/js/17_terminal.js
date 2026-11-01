'use strict';
/* =====================================================================
   The in-browser terminal: a small Linux shell with Git, pip/venv and Docker (public/dsq_shell.py, dsq_docker.py).
   Nothing needs to be installed on the learner's computer, so the lessons work for everyone.
   termBlock(ex, {onPass}) is a lesson exercise: the learner types real commands, the sandbox keeps its own files, and the goals
   (checked on the sandbox state after every command) tick off. viewTerminal() is the free practice terminal.
   ===================================================================== */
const TERM_LOGS = {};      /* in-memory transcripts so a lesson page keeps its history while you move around */
const TERM_CMDS = ['cd', 'ls', 'pwd', 'cat', 'echo', 'mkdir', 'touch', 'rm', 'cp', 'mv', 'grep', 'head', 'tail', 'wc', 'sort', 'uniq', 'find', 'tree', 'export', 'env', 'python', 'pip', 'git', 'docker', 'clear', 'help', 'history', 'source'];

async function termCall(tid, action, payload) {
  const files = await BIG.files();
  const r = await Py.cell('import json\nimport dsq_shell as _s\nprint(_s.term(' + JSON.stringify(tid) + ',' + JSON.stringify(action) + ', json.loads(' + JSON.stringify(JSON.stringify(payload || {})) + ')))', 120000, files);
  if (r.error) throw new Error(r.error.type + ': ' + r.error.msg);
  try { return JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch (e) { throw new Error('The terminal did not answer: ' + (r.stdout || '').slice(0, 200)); }
}

function terminalPane(tid, spec, hooks = {}) {
  const log = TERM_LOGS[tid] = TERM_LOGS[tid] || { lines: [], hist: [] };
  const out = h('pre', { class: 'term-out', tabindex: 0, 'aria-label': 'terminal output' }), promptEl = h('span', { class: 'term-prompt' }, '$'), input = h('input', { class: 'term-in', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'type a command and press Enter' });
  const line = h('div', { class: 'term-line' }, promptEl, input), screen = h('div', { class: 'term-screen' }, out, line);
  const fileList = h('div', { class: 'term-files' }), editor = h('textarea', { class: 'term-ed', spellcheck: 'false', placeholder: 'Click a file to edit it here', disabled: true }), saveBtn = h('button', { class: 'btn sm primary', type: 'button', disabled: true }, 'Save file'), cur = h('span', { class: 'muted mono', style: { fontSize: '12px' } }, 'no file open');
  let state = { files: [], goals: [], prompt: '$ ' }, openPath = null, hi = log.hist.length, busy = false;
  const render = () => { out.textContent = log.lines.join('\n'); screen.scrollTop = screen.scrollHeight; };
  const apply = st => {
    state = st; promptEl.textContent = st.prompt; fileList.innerHTML = '';
    st.files.forEach(f => fileList.append(h('button', { type: 'button', class: 'term-file' + (f === openPath ? ' on' : ''), onclick: () => openFile(f) }, f)));
    hooks.onState && hooks.onState(st);
  };
  async function openFile(f) {
    try { const r = await termCall(tid, 'read', { path: '~/' + f }); openPath = f; editor.value = r.text; editor.disabled = saveBtn.disabled = false; cur.textContent = '~/' + f; apply(state); } catch (e) { toast(e.message); }
  }
  saveBtn.addEventListener('click', async () => { if (!openPath) return; try { apply(await termCall(tid, 'write', { path: '~/' + openPath, text: editor.value })); log.lines.push('# saved ~/' + openPath); render(); toast('Saved ' + openPath); } catch (e) { toast(e.message); } });
  const newBtn = h('button', { class: 'btn sm', type: 'button', onclick: async () => { const n = (prompt('Name of the new file (for example Dockerfile or notes.md)') || '').trim(); if (!n || /[^\w./-]/.test(n)) return; try { apply(await termCall(tid, 'new', { path: '~/' + n })); await openFile(n); } catch (e) { toast(e.message); } } }, '+ New file');
  async function run(cmd) {
    if (busy) return; busy = true; input.disabled = true;
    log.lines.push(state.prompt + cmd); log.hist.push(cmd); hi = log.hist.length; render();
    try { const st = await termCall(tid, 'run', { cmd }); if (st.out === '\x0c') log.lines.length = 0; else if (st.out) log.lines.push(st.out); apply(st); if (openPath) { const r = await termCall(tid, 'read', { path: '~/' + openPath }); if (document.activeElement !== editor) editor.value = r.text; } }
    catch (e) { log.lines.push('! ' + e.message); }
    busy = false; input.disabled = false; render(); input.focus();
  }
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const c = input.value; input.value = ''; if (c.trim()) run(c); else { log.lines.push(state.prompt); render(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) { hi--; input.value = log.hist[hi]; } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi < log.hist.length - 1) { hi++; input.value = log.hist[hi]; } else { hi = log.hist.length; input.value = ''; } }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); log.lines.length = 0; render(); }
    else if (e.key === 'Tab') {
      e.preventDefault(); const v = input.value, parts = v.split(/\s+/), last = parts[parts.length - 1], pool = parts.length === 1 ? TERM_CMDS : state.files.concat(state.files.map(f => f.split('/')[0]).filter((x, i, a) => a.indexOf(x) === i)), hits = pool.filter(x => x.startsWith(last) && x !== last);
      if (hits.length === 1) { parts[parts.length - 1] = hits[0]; input.value = parts.join(' '); } else if (hits.length > 1) { log.lines.push(state.prompt + v); log.lines.push(hits.join('  ')); render(); }
    }
  });
  screen.addEventListener('click', () => { if (!window.getSelection().toString()) input.focus(); });
  const files = h('div', { class: 'term-side' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '13px' } }, 'Files'), newBtn), fileList, cur, editor, h('div', { class: 'row' }, saveBtn));
  const root = h('div', { class: 'term-wrap' }, screen, files);
  (async () => {
    try { const st = await termCall(tid, 'open', spec); if (!log.lines.length) log.lines.push('A practice terminal that runs inside your browser: real commands, nothing to install. Type "help" for a list.'); render(); apply(st); } catch (e) { out.textContent = 'Could not start the terminal: ' + e.message; }
  })();
  return { el: root, run, input, reset: async () => { log.lines.length = 0; log.hist.length = 0; openPath = null; editor.value = ''; editor.disabled = saveBtn.disabled = true; cur.textContent = 'no file open'; const st = await termCall(tid, 'open', Object.assign({}, spec, { reset: true })); log.lines.push('(exercise reset)'); render(); apply(st); } };
}

function termBlock(ex, o = {}) {
  const st = S.st, tid = 'ex:' + ex.id; st.ex = st.ex || {};
  const left = h('div', { class: 'stack' }), goalsEl = h('ul', { class: 'term-goals' }), hintBox = h('div', { class: 'hints' });
  let done = S.exDone(ex.id), hints = 0, fails = 0;
  const spec = { files: ex.files || {}, setup: ex.setup || [], cwd: ex.cwd, goals: ex.goals.map(g => g.test) };
  const pane = terminalPane(tid, spec, {
    onState: s => {
      goalsEl.innerHTML = ''; ex.goals.forEach((g, i) => goalsEl.append(h('li', { class: s.goals[i] ? 'ok' : '' }, h('b', {}, s.goals[i] ? '✓' : '○'), ' ', g.label, !s.goals[i] && g.hint && fails >= 3 ? h('small', {}, g.hint) : null)));
      if (s.goals.length && s.goals.every(Boolean) && !done) {
        done = true; const rec = st.ex[ex.id] = st.ex[ex.id] || { pass: false, tries: 0, hints: 0 };
        rec.pass = true; rec.tries = (rec.tries || 0) + 1; rec.hints = hints; rec.at = Date.now(); S.log({ type: 'ex', id: ex.id, tries: rec.tries, hints }); S.award(Math.max(3, Math.round((ex.xp || 25) * (hints ? .8 : 1))), 'Terminal task done'); confetti(70); S.save(); o.onPass && o.onPass();
        left.append(h('div', { class: 'callout ok' }, h('b', {}, 'All goals reached. '), 'On a real computer the very same commands do the same thing.'));
      }
    },
  });
  const hintBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { if (hints >= (ex.hints || []).length) return; hintBox.append(h('div', { class: 'hint-b', html: '<b>Hint ' + (hints + 1) + ':</b> ' + inl(ex.hints[hints]) })); hints++; if (hints >= ex.hints.length) hintBtn.disabled = true; } }, 'Need a hint?');
  const solBtn = h('button', { class: 'btn sm', type: 'button', onclick: e => { e.target.remove(); left.append(h('div', { class: 'callout warn', html: '<b>One way to do it</b> (type these, one per line):' }), h('pre', { class: 'codeblock' }, ex.solution.join('\n'))); fails = 99; } }, 'Stuck? Show one way');
  left.append(h('div', { class: 'xhead' }, h('span', { class: 'chip brand' }, 'Terminal task'), h('span', { class: 'chip' }, '+' + (ex.xp || 25) + ' pts'), done ? h('span', { class: 'chip ok' }, 'Solved ✓') : null),
    h('div', { class: 'prose', html: ex.prompt }), h('div', { class: 'callout' }, h('b', {}, 'Goals'), goalsEl), h('div', { class: 'row' }, (ex.hints || []).length ? hintBtn : null, solBtn, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { if (confirm('Reset this exercise to its starting state?')) pane.reset(); } }, 'Reset')), hintBox);
  const root = h('div', { class: 'termex' }, left, pane.el);
  setTimeout(() => pane.input.focus(), 400);
  return root;
}

function viewTerminal() {
  const root = h('div', { class: 'stack' });
  const files = { 'project/README.md': '# My project\n', 'project/data/sales.csv': 'day,units\nmon,12\ntue,18\nwed,9\n', 'project/app.py': 'import os\nprint("hello,", os.environ.get("NAME", "world"))\n', 'project/requirements.txt': 'pandas\nrequests\n' };
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Terminal'), h('h1', {}, 'A terminal, in your browser'),
    h('p', { class: 'muted lead' }, 'A Linux-style shell with Git, Python, pip, virtual environments and Docker (including compose). It runs entirely in this page, so it works the same for everyone, with nothing installed. It follows the real tools closely; what you learn here is what you type on a real machine.'))));
  const pane = terminalPane('free', { files, cwd: '/home/learner/project', setup: [], goals: [] });
  root.append(h('div', { class: 'card pad stack' }, pane.el, h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('button', { class: 'btn sm', type: 'button', onclick: () => { if (confirm('Throw away this sandbox and start again?')) pane.reset(); } }, 'Reset sandbox'), h('a', { class: 'btn sm', href: '#/m/docker' }, 'Go to the Git and Docker course'))));
  root.append(h('div', { class: 'card pad stack' }, h('h3', {}, 'Try these'), h('pre', { class: 'codeblock' }, 'ls\ncat data/sales.csv | grep tue\ngit init\ngit config user.name "Your Name"\ngit config user.email you@example.com\ngit add .\ngit commit -m "first commit"\ngit log --oneline\nprintf "FROM python:3.12-slim\\nCOPY . .\\nCMD [\\"python\\", \\"app.py\\"]" > Dockerfile\ndocker build -t demo .\ndocker run --rm -e NAME=Asha demo'), h('p', { class: 'muted', style: { fontSize: '13px' } }, 'Not supported here: programs that need a real Linux system (databases, web servers) are simulated, not run; git clone and anything needing the internet is explained instead of attempted.')));
  return root;
}
