'use strict';
/* =====================================================================
   Premium lessons. Free modules are ordinary <script> files. The others are NOT public: after sign-in the server sends the files the account may open
   (GET /api/content/bundle) and they are run here exactly like the old script tags, so the rest of the app sees the same DSQ.modules.
   A premium module the account cannot open stays a syllabus card with a "Paid access" badge.
   ===================================================================== */
DSQ.premium = { ids: [], open: [], gating: false, loaded: false };
DSQ.isLocked = id => DSQ.premium.ids.includes(id) && !DSQ.premium.open.includes(id);

DSQ.loadPremium = async function () {
  if (API.demo) { const r = await DSQ.loadDemoModules(); if (typeof PIC !== 'undefined') await PIC.addStubs(); return r; }
  try {
    const r = await fetch('/api/content/bundle', { credentials: 'same-origin' });
    if (!r.ok) { try { const m = await (await fetch('/api/content/manifest', { credentials: 'same-origin' })).json(); DSQ.premium.ids = m.premium || []; DSQ.premium.gating = !!m.gating; } catch (e) { } if (typeof PIC !== 'undefined') await PIC.addStubs(); return false; }
    const b = await r.json();
    for (const f of b.files) { const s = document.createElement('script'); s.textContent = f.src + '\n//# sourceURL=premium/' + f.n; document.head.appendChild(s); s.remove(); }
    Object.assign(DSQ.premium, { ids: b.premium || [], open: b.modules || [], gating: !!b.gating, loaded: true });
    try { JUP.key = (await API.get('/api/nb/key')).key; } catch (e) { }
    if (typeof PIC !== 'undefined') await PIC.addStubs();
    return true;
  } catch (e) { return false; }
};

/* notebook download: premium ones come from the API (cookie), free ones are plain files */
DSQ.notebookUrl = (id, blank) => (DSQ.premium.ids.includes(id) ? '/api/content/notebook/' : 'notebooks/') + id + (blank ? '-blank' : '') + '.ipynb';
DSQ.downloadNotebook = async function (id, blank) {
  const name = id + (blank ? '-blank' : '') + '.ipynb', url = DSQ.notebookUrl(id, blank);
  try {
    const r = await fetch(url, { credentials: 'same-origin' }); if (!r.ok) throw new Error(r.status === 403 ? 'Notebooks for this module are part of paid access.' : 'Could not download this notebook (' + r.status + ').');
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = id + '-practice.ipynb'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  } catch (e) { toast(e.message); }
};
