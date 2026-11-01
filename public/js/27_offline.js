'use strict';
/* =====================================================================
   Offline: registers the service worker (public/sw.js) and shows the "Offline" page.
   The app files are kept automatically after the first visit. The Python engine (about 70 MB: Python, numpy, pandas,
   matplotlib, scikit-learn, scipy and the web-framework wheels) and the practice notebooks are kept on first use,
   or all at once with the "Make available offline" button, so every lesson and exercise runs with no internet.
   ===================================================================== */
const OFFLINE = (() => {
  const supported = 'serviceWorker' in navigator && 'caches' in window && /^https?:$/.test(location.protocol);
  let list = null, installEvt = null;
  const mb = n => (n / 1048576).toFixed(n > 1e8 ? 0 : 1) + ' MB';
  async function manifest() { if (!list) { const r = await fetch('precache.json', { cache: 'no-cache' }); list = await r.json(); } return list; }
  const packName = l => 'dsq-pack-' + l.pyodide;
  const abs = u => new URL(u, document.baseURI).href;
  async function status() {
    const l = await manifest(), c = await caches.open(packName(l)), have = new Set((await c.keys()).map(r => r.url));
    let n = 0, bytes = 0, total = 0;
    for (const f of l.pack) { total += f.n; if (have.has(abs(f.u))) { n++; bytes += f.n; } }
    const sc = (await caches.keys()).find(k => k.startsWith('dsq-shell-')), shell = sc ? (await (await caches.open(sc)).keys()).length : 0;
    let est = null; try { est = navigator.storage && (await navigator.storage.estimate()); } catch (e) { }
    return { files: l.pack.length, have: n, bytes, total, shell, shellTotal: l.shell.length, est, version: l.version };
  }
  async function download(onProgress, signal) {
    const l = await manifest(), c = await caches.open(packName(l));
    try { navigator.storage && navigator.storage.persist && await navigator.storage.persist(); } catch (e) { }
    const have = new Set((await c.keys()).map(r => r.url)), todo = l.pack.filter(f => !have.has(abs(f.u))), total = l.pack.reduce((a, f) => a + f.n, 0);
    let done = l.pack.reduce((a, f) => a + (have.has(abs(f.u)) ? f.n : 0), 0), idx = 0, fail = 0;
    onProgress(done, total, 0);
    const worker = async () => {
      while (idx < todo.length && !(signal && signal.aborted)) {
        const f = todo[idx++];
        try { const r = await fetch(abs(f.u), { signal }); if (!r.ok) throw new Error(r.status); await c.put(abs(f.u), r); done += f.n; }
        catch (e) { if (!(signal && signal.aborted)) fail++; }
        onProgress(done, total, fail);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return { fail, aborted: !!(signal && signal.aborted) };
  }
  async function clearPack() { for (const k of await caches.keys()) if (k.startsWith('dsq-pack-')) await caches.delete(k); }
  function register() {
    if (!supported) return;
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('service worker not registered', e));
  }
  return { supported, status, download, clearPack, register, mb, canInstall: () => !!installEvt, install: async () => { if (installEvt) { installEvt.prompt(); await installEvt.userChoice; installEvt = null; } } };
})();
OFFLINE.register();
/* Offline first: right after the first visit the app saves its own files and the Python engine in the background, a few files at a time,
   and carries on after a closed tab or a lost connection. A small chip shows the progress; the Offline page can switch it off. */
OFFLINE.autoOn = () => localStorage.getItem('dsq.offlineAuto') !== 'off';
OFFLINE.auto = async () => {
  try {
    if (!OFFLINE.supported || !navigator.onLine || !OFFLINE.autoOn() || OFFLINE._running) return;
    const c = navigator.connection; if (c && (c.saveData || /^(slow-)?2g$/.test(c.effectiveType || ''))) return;
    const s = await OFFLINE.status(); if (s.have >= s.files) { OFFLINE._done = true; return; }
    OFFLINE._running = true; const chip = h('div', { class: 'off-chip', role: 'status', title: 'DS Quest is saving itself for offline use. Turn this off in Offline mode.' }, 'Saving for offline use… 0%'); document.body.append(chip);
    const ctl = new AbortController(); OFFLINE._ctl = ctl;
    const r = await OFFLINE.download((d, t) => { chip.textContent = 'Saving for offline use… ' + Math.round(100 * d / t) + '%'; }, ctl.signal).catch(e => ({ fail: 1 }));
    OFFLINE._running = false; chip.remove();
    if (!r.aborted && !r.fail) { OFFLINE._done = true; if (typeof toast === 'function') toast('Saved. DS Quest now works with no internet on this device.'); }
  } catch (e) { OFFLINE._running = false; }
};
setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(() => OFFLINE.auto(), { timeout: 8000 }) : OFFLINE.auto()), 5000);
window.addEventListener('online', () => setTimeout(() => OFFLINE.auto(), 1500));

function viewOffline() {
  const root = h('div', { class: 'stack' });
  const body = h('div', { class: 'card pad stack' });
  const bar = h('i', { style: { display: 'block', height: '100%', width: '0%', background: 'var(--brand, #3b5bdb)', borderRadius: 'inherit', transition: 'width .2s' } });
  const prog = h('div', { style: { height: '10px', borderRadius: '6px', background: 'rgba(120,120,140,.22)', overflow: 'hidden', display: 'none' } }, bar);
  const msg = h('div', { class: 'muted' }), stats = h('div', { class: 'stack' });
  let ctl = null;
  const net = h('span', { class: 'chip' });
  const paintNet = () => { net.textContent = navigator.onLine ? 'Online' : 'Offline right now'; net.className = 'chip ' + (navigator.onLine ? 'ok' : 'warn'); };
  paintNet(); window.addEventListener('online', paintNet); window.addEventListener('offline', paintNet);
  const dl = h('button', { class: 'btn primary', type: 'button' }, 'Make available offline'), stop = h('button', { class: 'btn', type: 'button', style: { display: 'none' } }, 'Stop');
  const rm = h('button', { class: 'btn', type: 'button' }, 'Remove the offline Python copy'), inst = h('button', { class: 'btn', type: 'button', style: { display: 'none' } }, 'Install as an app');
  async function paint() {
    if (!OFFLINE.supported) { stats.replaceChildren(h('p', {}, 'This browser (or this way of opening the page) cannot keep files for offline use. Open DS Quest from its web address in a current Chrome, Edge, Firefox or Safari.')); dl.disabled = rm.disabled = true; return; }
    try {
      const s = await OFFLINE.status(), full = s.have === s.files, ctrl = !!navigator.serviceWorker.controller;
      stats.replaceChildren(
        h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, net,
          h('span', { class: 'chip ' + (ctrl ? 'ok' : 'warn') }, ctrl ? 'App files saved' : 'App files will be saved after one reload'),
          h('span', { class: 'chip ' + (full ? 'ok' : 'warn') }, full ? 'Python engine saved' : 'Python engine: ' + OFFLINE.mb(s.bytes) + ' of ' + OFFLINE.mb(s.total))),
        h('p', { class: 'muted' }, full ? 'Everything is saved on this device. You can turn the internet off and keep learning: lessons, exercises, notebooks, labs and Python all run locally. Your progress is stored in this browser.' : 'Press the button while you are online. About ' + OFFLINE.mb(s.total - s.bytes) + ' will be saved once; after that nothing needs the internet.'),
        s.est && s.est.quota ? h('small', { class: 'muted' }, 'Browser storage in use: ' + OFFLINE.mb(s.est.usage) + ' of about ' + OFFLINE.mb(s.est.quota) + ' allowed.') : null);
      dl.textContent = full ? 'Check again' : (s.have ? 'Continue downloading' : 'Make available offline');
      inst.style.display = OFFLINE.canInstall() ? '' : 'none';
    } catch (e) { stats.replaceChildren(h('p', { class: 'muted' }, 'Could not read the offline status yet. Reload the page once and open this tab again.')); }
  }
  dl.onclick = async () => {
    if (ctl) return; ctl = new AbortController(); dl.disabled = true; stop.style.display = ''; prog.style.display = ''; msg.textContent = 'Downloading the Python engine...';
    const r = await OFFLINE.download((d, t, f) => { bar.style.width = Math.round(100 * d / t) + '%'; msg.textContent = OFFLINE.mb(d) + ' of ' + OFFLINE.mb(t) + (f ? ' (' + f + ' file(s) failed, will retry next time)' : ''); }, ctl.signal).catch(e => ({ fail: 1, err: e }));
    ctl = null; dl.disabled = false; stop.style.display = 'none';
    msg.textContent = r.aborted ? 'Stopped. Press the button again to continue where it left off.' : r.fail ? 'Some files could not be downloaded. Check the connection and press the button again.' : 'Done. DS Quest now works without internet on this device.';
    paint();
  };
  stop.onclick = () => ctl && ctl.abort();
  rm.onclick = async () => { if (!confirm('Remove the saved Python engine? It will be downloaded again the next time you run code online.')) return; await OFFLINE.clearPack(); msg.textContent = 'Removed.'; prog.style.display = 'none'; paint(); };
  inst.onclick = async () => { await OFFLINE.install(); paint(); };
  const auto = h('label', { class: 'row', style: { gap: '6px', fontSize: '13px' } }, h('input', { type: 'checkbox', checked: OFFLINE.autoOn(), onchange: e => { localStorage.setItem('dsq.offlineAuto', e.target.checked ? 'on' : 'off'); if (e.target.checked) OFFLINE.auto(); else if (OFFLINE._ctl) OFFLINE._ctl.abort(); } }), 'Save everything automatically in the background (recommended)');
  body.append(stats, h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, dl, stop, inst, rm), auto, prog, msg);
  root.append(h('div', { class: 'page-h' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Account'), h('h1', {}, 'Offline mode'), h('p', { class: 'muted lead' }, 'Use DS Quest on a plane, on a bad connection or with no Wi-Fi at all. Nothing is sent anywhere: the Python engine runs inside your browser.'))), body,
    h('div', { class: 'card pad stack' }, h('h3', {}, 'What works with no internet'),
      h('ul', {}, h('li', {}, 'All lessons, diagrams, 3-D views and algorithm animations.'), h('li', {}, 'Every code exercise and the in-browser notebook (numpy, pandas, matplotlib, scikit-learn, scipy, seaborn, FastAPI and Django lessons).'), h('li', {}, 'Practice notebooks you download to run in your own Jupyter.'), h('li', {}, 'Your progress, saved in this browser.')),
      h('h3', {}, 'What needs the internet'), h('ul', {}, h('li', {}, 'Loading a dataset from a web address, LinkedIn sharing, the AI tutor and pushing projects to Git.'), h('li', {}, 'Moving your progress to another device (progress lives in this browser; use another device with the same browser profile or export your work).'))));
  paint(); return root;
}
