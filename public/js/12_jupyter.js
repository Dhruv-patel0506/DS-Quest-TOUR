'use strict';
/* =====================================================================
   Your own Jupyter, beside the lesson.
   The learner runs ONE command (public/dsquest_jupyter.py) which starts JupyterLab from their own Python / Anaconda
   on 127.0.0.1 with a random token and lets only this page embed it. DS Quest then shows it in a resizable pane next to
   the lesson: either the fill-in-the-blank notebook or a blank page. Answers are checked inside the notebook.
   ===================================================================== */
const JUP = {
  get conn() { try { return JSON.parse(localStorage.getItem('dsq.jupyter') || 'null'); } catch (e) { return null; } },
  set(c) { try { localStorage.setItem('dsq.jupyter', JSON.stringify(c)); } catch (e) { } },
  clear() { try { localStorage.removeItem('dsq.jupyter'); } catch (e) { } },
  async probe(c) { c = c || JUP.conn; if (!c) return false; try { const r = await fetch(c.url + '/api/status', { headers: { Authorization: 'token ' + c.token }, signal: AbortSignal.timeout(3500) }); return r.ok; } catch (e) { return false; } },
  /* tell the notebook helper who you are, so solved questions count in your account */
  async link(c) {
    if (API.local) return false;
    try { const k = await API.get('/api/nb/key'); const r = await fetch(c.url + '/api/contents/dsquest/dsq_config.json', { method: 'PUT', headers: { Authorization: 'token ' + c.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'file', format: 'text', content: JSON.stringify({ url: location.origin, key: k.key }) }), signal: AbortSignal.timeout(5000) }); return r.ok; } catch (e) { return false; }
  },
  modules() { return App.mods.filter(m => m.live && m.lessons.some(l => l.pages.some(p => p.t === 'ex'))); },
  routeModule() { const m = /^#\/(?:m|l|b|p)\/([a-z0-9_-]+)/i.exec(location.hash); return m && JUP.modules().some(x => x.id === m[1]) ? m[1] : null; },
};
const JUP_CMD = () => `python -c "import urllib.request as u; exec(u.urlopen('${location.origin}/dsquest_jupyter.py').read())"` + (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(location.origin) ? ` --app ${location.origin}` : '') + (JUP.key ? ` --key ${JUP.key}` : '');

/* When DS Quest runs on the learner's own computer (start.bat), the page can start JupyterLab itself:
   returns null on the hosted site (there the one-line command is the way), else { el, stop } with progress and a button. */
async function jupAutoBlock(onReady) {
  let st; try { st = await API.get('/api/jupyter/status'); } catch (e) { return null; }
  if (!st || st.state === undefined) return null;
  const wrap = h('div', { class: 'stack', style: { gap: '8px' } }), msg = h('div', { role: 'status' }), log = h('pre', { class: 'codeblock', hidden: true, style: { maxHeight: '130px', overflow: 'auto', fontSize: '12px', whiteSpace: 'pre-wrap' } });
  const btn = h('button', { class: 'btn primary', type: 'button' }, 'Start Jupyter for me');
  let dead = false, timer = null; const stop = () => { dead = true; clearTimeout(timer); };
  const paint = s => {
    log.hidden = !s.log || !s.log.length; log.textContent = (s.log || []).join('\n'); log.scrollTop = log.scrollHeight;
    if (s.state === 'installing') msg.textContent = 'Installing JupyterLab. This takes a minute or two the first time...';
    else if (s.state === 'starting') msg.textContent = 'Starting Jupyter...';
    else if (s.state === 'error') msg.textContent = 'Jupyter could not start. See the lines below, or use the manual command.';
    else if (s.python === false) msg.textContent = 'Python was not found on this computer. Install it from python.org (tick "Add to PATH") and reload.';
    else if (!s.installed) msg.textContent = 'JupyterLab is not installed on this computer yet. One click installs it (jupyterlab, numpy, pandas, matplotlib, seaborn) and starts it.';
    btn.disabled = s.state === 'installing' || s.state === 'starting' || s.python === false; btn.textContent = s.installed ? 'Start Jupyter for me' : 'Install JupyterLab and start';
  };
  const poll = async () => {
    if (dead || !wrap.isConnected) return;
    try {
      const s = await API.get('/api/jupyter/status');
      if (s.state === 'ready' && s.url && s.token) { JUP.set({ url: s.url, token: s.token }); stop(); onReady(); return; }
      paint(s); if (s.state === 'installing' || s.state === 'starting') timer = setTimeout(poll, 1500);
    } catch (e) { msg.textContent = 'Lost contact with DS Quest: ' + e.message; }
  };
  btn.onclick = async () => { btn.disabled = true; try { await API.post('/api/jupyter/start', { install: !st.installed }); } catch (e) { msg.textContent = e.message; btn.disabled = false; return; } poll(); };
  wrap.append(h('b', {}, 'Jupyter is not running yet'), msg, btn, log); paint(st);
  if (st.state === 'ready' && st.url) { JUP.set({ url: st.url, token: st.token }); setTimeout(onReady, 0); }
  else if (st.python !== false && st.installed && st.state !== 'error') btn.click(); /* nothing to install: just start it */
  return { el: wrap, stop };
}

function jupPane() {
  let pane = document.getElementById('jpane'); if (pane) return pane;
  const mod = h('select', { class: 'input', 'aria-label': 'module' }, JUP.modules().map(m => h('option', { value: m.id }, m.title))), kind = h('select', { class: 'input', 'aria-label': 'notebook type' }, h('option', { value: '' }, 'Fill in the blanks'), h('option', { value: '-blank' }, 'Blank page'));
  const body = h('div', { class: 'jp-body' }), grip = h('div', { class: 'jp-grip', title: 'Drag to resize' });
  pane = h('div', { id: 'jpane' }, grip, h('div', { class: 'jp-head' }, h('b', {}, 'Jupyter'), mod, kind,
    h('button', { class: 'btn sm', type: 'button', title: 'Reload', onclick: () => fill() }, '⟳'), h('a', { class: 'btn sm', id: 'jp-new', target: '_blank', rel: 'noopener', href: '#' }, 'New tab'), h('button', { class: 'btn sm', type: 'button', onclick: () => closeJupyter() }, '✕')), body);
  document.body.append(pane);
  const url = () => { const c = JUP.conn; return c ? `${c.url}/lab/tree/dsquest/${mod.value}${kind.value}.ipynb?token=${encodeURIComponent(c.token)}&reset` : ''; };
  async function fill() {
    const c = JUP.conn; body.innerHTML = '';
    if (!c || !(await JUP.probe(c))) {
      const auto = await jupAutoBlock(() => fill()); if (auto) { pane._auto = auto; }
      const cmd = JUP_CMD(), box = h('div', { class: 'jp-setup stack' }, h('h3', { style: { margin: 0 } }, c ? 'Jupyter is not running' : 'Connect your Jupyter'), h('p', { class: 'muted', style: { margin: 0 } }, 'Run this one command in the terminal you use for Python (Anaconda Prompt, PowerShell or bash). It uses the Jupyter from your own Python/Anaconda, starts it on your computer only, and this page connects by itself.'),
        h('pre', { class: 'codeblock', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, cmd), h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(cmd); toast('Command copied'); } }, 'Copy command'), h('a', { class: 'btn', href: '/dsquest_jupyter.py', download: 'dsquest_jupyter.py' }, 'or download the launcher'), h('button', { class: 'btn primary', type: 'button', onclick: fill }, 'I started it - connect')),
        h('p', { class: 'muted', style: { fontSize: '12.5px', margin: 0 } }, 'First run installs JupyterLab if it is missing (it asks first). Your notebooks are saved in your home folder under dsquest/ and keep your edits. Waiting for Jupyter...'));
      if (auto) { body.append(auto.el, h('details', { class: 'jp-manual' }, h('summary', {}, 'Or start it yourself with a command'), box)); return; }
      body.append(box); clearTimeout(pane._t); pane._t = setTimeout(() => { if (document.getElementById('jpane') && !body.querySelector('iframe')) fill(); }, 4000); return;
    }
    JUP.link(c); const f = h('iframe', { src: url(), title: 'Jupyter', allow: 'clipboard-read; clipboard-write', referrerpolicy: 'no-referrer' }); body.append(f); $('#jp-new', pane).href = url();
  }
  mod.addEventListener('change', fill); kind.addEventListener('change', fill);
  let drag = false; grip.addEventListener('pointerdown', e => { drag = true; grip.setPointerCapture(e.pointerId); document.body.classList.add('jp-drag'); });
  grip.addEventListener('pointermove', e => { if (!drag) return; const w = clamp(window.innerWidth - e.clientX, 320, window.innerWidth * .75); document.documentElement.style.setProperty('--jw', w + 'px'); });
  const up = () => { if (drag) { drag = false; document.body.classList.remove('jp-drag'); try { localStorage.setItem('dsq.jw', getComputedStyle(document.documentElement).getPropertyValue('--jw')); } catch (e) { } } }; grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
  pane._fill = fill; pane._mod = mod; return pane;
}
function openJupyter(modId) {
  if (window.innerWidth < 900) { const c = JUP.conn; if (c) window.open(`${c.url}/lab/tree/dsquest/${modId || 'python'}.ipynb?token=${encodeURIComponent(c.token)}`, '_blank'); else location.hash = '#/jupyter'; return; }
  try { const w = localStorage.getItem('dsq.jw'); if (w) document.documentElement.style.setProperty('--jw', w.trim()); } catch (e) { }
  const pane = jupPane(); document.body.classList.add('jup-open'); const id = modId || JUP.routeModule() || (JUP.modules()[0] || {}).id; if (id) pane._mod.value = id; pane._fill();
}
function closeJupyter() { const p = document.getElementById('jpane'); if (p) { clearTimeout(p._t); if (p._auto) p._auto.stop(); p.remove(); } document.body.classList.remove('jup-open'); }
/* keep the notebook in step with the module you are looking at */
window.addEventListener('hashchange', () => { const p = document.getElementById('jpane'); if (!p) return; const id = JUP.routeModule(); if (id && p._mod.value !== id) { p._mod.value = id; p._fill(); } });

function viewJupyter(parts) {
  if (parts && parts[1] === 'connect' && /^\d{2,5}$/.test(parts[2] || '') && /^[A-Za-z0-9_-]{16,64}$/.test(parts[3] || '')) { JUP.set({ url: 'http://127.0.0.1:' + parts[2], token: parts[3] }); setTimeout(() => { location.hash = '#/jupyter'; }, 0); return h('div', { class: 'card pad' }, 'Connecting to your Jupyter...'); }
  const root = h('div', { class: 'stack' }), stat = h('span', { class: 'chip' }, 'checking...'), c = JUP.conn;
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('h1', { html: 'Your <em>Jupyter</em>' }), h('p', { class: 'muted', style: { maxWidth: '75ch' } }, 'Learn and code side by side: the lesson on the left, a real JupyterLab running on your own computer on the right. Answer in the fill-in-the-blank notebook, or switch to a blank page and write everything yourself. Checks run inside the notebook.'))));
  const cmd = JUP_CMD(), autoHolder = h('div', {});
  jupAutoBlock(() => { stat.className = 'chip ok'; stat.textContent = 'connected'; openJupyter(); }).then(a => { if (a) autoHolder.append(a.el); });
  root.append(h('div', { class: 'card pad stack' }, h('div', { class: 'row' }, h('h3', { style: { margin: 0 } }, 'Connection'), stat), autoHolder, h('ol', { class: 'prose' , style: { margin: 0, paddingLeft: '20px' } }, h('li', {}, 'Open the terminal you use for Python (Anaconda Prompt, PowerShell, bash).'), h('li', {}, 'Paste this one command and press Enter:'), h('pre', { class: 'codeblock', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }, cmd), h('li', {}, 'Your browser comes back to this page and connects. Leave the terminal open while you practise (Ctrl+C stops Jupyter).')),
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(cmd); toast('Command copied'); } }, 'Copy command'), h('a', { class: 'btn', href: '/dsquest_jupyter.py', download: 'dsquest_jupyter.py' }, 'Download the launcher'), h('button', { class: 'btn primary', type: 'button', onclick: () => openJupyter() }, 'Open Jupyter beside the lessons'), c ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { JUP.clear(); location.reload(); } }, 'Forget this connection') : null),
    h('p', { class: 'muted', style: { fontSize: '13px', margin: 0 } }, 'Security: Jupyter listens on 127.0.0.1 only, with a random token that is shown only to this browser, and it only lets ' + location.origin + ' embed it. Works best in Chrome or Edge; if your browser blocks third-party cookies for localhost, use the "New tab" button in the pane.')));
  JUP.probe().then(ok => { stat.className = 'chip ' + (ok ? 'ok' : 'warn'); stat.textContent = ok ? 'connected: ' + JUP.conn.url : (c ? 'saved connection is not running' : 'not connected'); });
  root.append(h('div', { class: 'card pad stack' }, h('h3', { style: { margin: 0 } }, 'Notebooks'), h('div', { class: 'row', style: { flexWrap: 'wrap' } }, JUP.modules().map(m => h('button', { class: 'btn sm', type: 'button', onclick: () => openJupyter(m.id) }, m.title)))));
  return root;
}

/* questions solved inside your own Jupyter count here too (pts once per question) */
async function syncNotebook() {
  if (API.local || !S.me) return; try {
    const r = await API.get('/api/me'), st = S.st, seen = (st.nbSeen = st.nbSeen || []), fresh = (r.nb || []).filter(q => !seen.includes(q));
    if (fresh.length) { seen.push(...fresh); S.award(12 * fresh.length, fresh.length + ' notebook question' + (fresh.length > 1 ? 's' : '') + ' solved'); S.save(); }
  } catch (e) { }
}
window.addEventListener('focus', () => { if (document.getElementById('jpane')) syncNotebook(); });
setInterval(() => { if (document.getElementById('jpane') && document.visibilityState === 'visible') syncNotebook(); }, 45000);
