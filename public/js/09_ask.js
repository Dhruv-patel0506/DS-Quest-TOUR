'use strict';
/* =====================================================================
   Ask the tutor: mark anything on screen with a pen / shapes (or select text), type a question, get an answer at the bottom.
   - the marked region is turned into TEXT (the lesson words, the code lines, the output under your marks) so even a text-only model answers
     with grounding; a screenshot with your marks is added only when a vision-capable provider is available
   - Sketch pad: draw boxes and arrows; the app extracts the structure ("A -> B"), the model improves it and writes + explains the code
   - the server tries free providers in order and falls back automatically (cloud first, so your VRAM stays free)
   - no AI reachable? you still get the local line-by-line explanations for the code you marked
   ===================================================================== */
const Ask = { open: false, hist: [], shapes: [], status: null, mode: 'page', tool: null, busy: false };

class Marker {
  constructor(cv, { page = false, onChange } = {}) { this.cv = cv; this.page = page; this.shapes = []; this.tool = null; this.cur = null; this.onChange = onChange; this.color = '#E5484D'; this.bind(); }
  pt(e) { const r = this.cv.getBoundingClientRect(); return [(e.clientX - r.left) * (this.cv.width / r.width) + (this.page ? scrollX : 0), (e.clientY - r.top) * (this.cv.height / r.height) + (this.page ? scrollY : 0)]; }
  bind() {
    const cv = this.cv;
    cv.addEventListener('pointerdown', e => { if (!this.tool) return; const p = this.pt(e); cv.setPointerCapture(e.pointerId); this.cur = { t: this.tool, pts: [p], p0: p, p1: p, c: this.color, label: '' }; this.shapes.push(this.cur); e.preventDefault(); });
    cv.addEventListener('pointermove', e => { if (!this.cur) return; const p = this.pt(e); this.cur.p1 = p; if (this.cur.t === 'pen') this.cur.pts.push(p); this.draw(); });
    const end = e => { if (!this.cur) return; const s = this.cur; this.cur = null; const d = Math.hypot(s.p1[0] - s.p0[0], s.p1[1] - s.p0[1]); if (d < 4 && s.t !== 'pen') this.shapes.pop(); else if (!this.page && s.t === 'box') this.askLabel(s, e); this.draw(); this.onChange && this.onChange(); };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }
  askLabel(s, e) {
    const x = Math.min(s.p0[0], s.p1[0]), y = Math.min(s.p0[1], s.p1[1]), r = this.cv.getBoundingClientRect(), k = r.width / this.cv.width;
    const inp = h('input', { class: 'lbl', placeholder: 'name it, Enter', style: { left: r.left + x * k + 'px', top: r.top + y * k + 'px' } }); document.body.append(inp); inp.focus();
    const done = () => { s.label = inp.value.trim(); inp.remove(); this.draw(); this.onChange && this.onChange(); }; inp.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === 'Escape') done(); }); inp.addEventListener('blur', done);
  }
  undo() { this.shapes.pop(); this.draw(); this.onChange && this.onChange(); }
  clear() { this.shapes = []; this.draw(); this.onChange && this.onChange(); }
  draw() {
    const g = this.cv.getContext('2d'), ox = this.page ? scrollX : 0, oy = this.page ? scrollY : 0; g.clearRect(0, 0, this.cv.width, this.cv.height); g.lineWidth = 3.5; g.lineCap = 'round'; g.lineJoin = 'round'; g.font = '700 14px sans-serif';
    for (const s of this.shapes) {
      g.strokeStyle = g.fillStyle = s.c; const [x0, y0] = [s.p0[0] - ox, s.p0[1] - oy], [x1, y1] = [s.p1[0] - ox, s.p1[1] - oy];
      if (s.t === 'pen' || s.t === 'hl') { g.globalAlpha = s.t === 'hl' ? .3 : 1; g.lineWidth = s.t === 'hl' ? 18 : 3.5; g.beginPath(); s.pts.forEach((p, i) => (i ? g.lineTo(p[0] - ox, p[1] - oy) : g.moveTo(p[0] - ox, p[1] - oy))); g.stroke(); g.globalAlpha = 1; g.lineWidth = 3.5; }
      else if (s.t === 'box') { g.strokeRect(x0, y0, x1 - x0, y1 - y0); if (s.label) { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(Math.min(x0, x1) + 4, Math.min(y0, y1) + 4, g.measureText(s.label).width + 8, 20); g.fillStyle = '#111'; g.fillText(s.label, Math.min(x0, x1) + 8, Math.min(y0, y1) + 19); } }
      else if (s.t === 'circle') { g.beginPath(); g.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, 6.3); g.stroke(); }
      else if (s.t === 'arrow') { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); const a = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 14 * Math.cos(a - .4), y1 - 14 * Math.sin(a - .4)); g.lineTo(x1 - 14 * Math.cos(a + .4), y1 - 14 * Math.sin(a + .4)); g.closePath(); g.fill(); }
    }
  }
  bbox(s) { const xs = s.t === 'pen' || s.t === 'hl' ? s.pts.map(p => p[0]) : [s.p0[0], s.p1[0]], ys = s.t === 'pen' || s.t === 'hl' ? s.pts.map(p => p[1]) : [s.p0[1], s.p1[1]]; return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
}

/* ---- turn marks into words the model can use ---- */
function describeSketch(shapes) {
  const nodes = shapes.filter(s => s.t === 'box' || s.t === 'circle').map((s, i) => ({ i, name: s.label || ('shape ' + (i + 1)), kind: s.t === 'box' ? 'box' : 'circle', b: [Math.min(s.p0[0], s.p1[0]), Math.min(s.p0[1], s.p1[1]), Math.max(s.p0[0], s.p1[0]), Math.max(s.p0[1], s.p1[1])] }));
  const near = p => { let best = null, bd = 1e9; nodes.forEach(n => { const cx = clamp(p[0], n.b[0], n.b[2]), cy = clamp(p[1], n.b[1], n.b[3]), d = Math.hypot(p[0] - cx, p[1] - cy); if (d < bd) { bd = d; best = n; } }); return bd < 70 ? best : null; };
  const edges = shapes.filter(s => s.t === 'arrow').map(s => [near(s.p0), near(s.p1)]);
  const order = nodes.slice().sort((a, b) => a.b[0] - b.b[0] || a.b[1] - b.b[1]).map(n => n.name);
  return JSON.stringify({ blocks: nodes.map(n => ({ name: n.name, shape: n.kind, x: Math.round(n.b[0]), y: Math.round(n.b[1]) })), arrows: edges.map(([a, b]) => (a ? a.name : '?') + ' -> ' + (b ? b.name : '?')), left_to_right: order, freehand_strokes: shapes.filter(s => s.t === 'pen').length, note: 'blocks are boxes/circles the learner drew; arrows show data flow' });
}
function gatherContext(marker, sketchMarker) {
  const c = {}; const vis = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  c.page = (location.hash || '#/') + ' | ' + ((document.querySelector('.page h2, main h1, main h2') || {}).innerText || '').replace(/\n/g, ' - ');
  c.lesson = [...document.querySelectorAll('.page .prose, .card .prose')].filter(vis).map(e => e.innerText).join('\n').slice(0, 1800);
  const eds = [...document.querySelectorAll('.ed textarea')].filter(vis); c.code = eds.map(t => t.value).join('\n# ---- next cell ----\n').slice(0, 1800);
  c.output = [...document.querySelectorAll('.outpane, .tout')].filter(vis).map(e => e.innerText).join('\n').slice(0, 900); c.vizOut = [...document.querySelectorAll('.viz .out')].filter(vis).map(e => e.innerText).join('\n').slice(0, 700);
  const parts = [], sel = String(getSelection() || '').trim(); if (sel) parts.push('SELECTED TEXT: ' + sel.slice(0, 600));
  const seen = new Set();
  marker.shapes.forEach(s => {
    const [x0, y0, x1, y1] = marker.bbox(s).map((v, i) => v - (i % 2 ? scrollY : scrollX));
    eds.forEach(t => { const r = t.getBoundingClientRect(); if (x1 < r.left || x0 > r.right || y1 < r.top || y0 > r.bottom) return; const lh = 21.45, l0 = Math.max(0, Math.floor((y0 - r.top - 12) / lh)), l1 = Math.floor((y1 - r.top - 12) / lh), lines = t.value.split('\n'); const key = 'c' + l0 + '-' + l1; if (seen.has(key)) return; seen.add(key); parts.push(`CODE LINES ${l0 + 1}-${Math.min(l1 + 1, lines.length)}:\n` + lines.slice(l0, l1 + 1).join('\n')); });
    for (let i = 0; i < 9; i++) { const px = x0 + (x1 - x0) * ((i % 3) + .5) / 3, py = y0 + (y1 - y0) * (Math.floor(i / 3) + .5) / 3; document.elementsFromPoint(px, py).forEach(el => { if (el.closest('#askdock,#askfab,#markcv') || el.tagName === 'HTML' || el.tagName === 'BODY' || el.tagName === 'TEXTAREA') return; const t = (el.innerText || '').trim(); if (t && t.length < 420 && !seen.has(t)) { seen.add(t); parts.push('ON SCREEN: ' + t.replace(/\n+/g, ' / ')); } }); }
  });
  if (parts.length || marker.shapes.length) c.marked = (marker.shapes.length ? `(${marker.shapes.length} marks: ${[...new Set(marker.shapes.map(s => s.t))].join(', ')})\n` : '') + parts.slice(0, 8).join('\n');
  if (sketchMarker && sketchMarker.shapes.length) c.sketch = describeSketch(sketchMarker.shapes);
  return c;
}
async function capture(marker) {
  try {
    if (!window.html2canvas) await new Promise((ok, no) => { const s = h('script', { src: 'vendor/html2canvas.min.js' }); s.onload = ok; s.onerror = no; document.head.append(s); });
    const cv = await html2canvas(document.body, { x: scrollX, y: scrollY, width: innerWidth, height: innerHeight, scale: Math.min(1, 1100 / innerWidth), logging: false, useCORS: true, ignoreElements: el => el.id === 'askdock' || el.id === 'askfab' });
    return cv.toDataURL('image/jpeg', .72);
  } catch (e) { return null; }
}

/* ---- answer rendering: prose + code blocks with Copy / Run ---- */
function renderAnswer(text) {
  const box = h('div', { class: 'ans prose' }); const parts = text.split(/```(?:python|py)?\n?([\s\S]*?)```/g);
  parts.forEach((p, i) => {
    if (i % 2 === 0) { const html = esc(p.trim()).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>'); if (html) box.append(h('p', { html })); }
    else { const code = p.replace(/\n$/, ''), out = h('pre', { class: 'tout', hidden: true }); box.append(h('div', { class: 'ansCode' }, codeBlock(code), h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(code); toast('Copied'); } }, 'Copy'), h('button', { class: 'btn sm', type: 'button', onclick: async e => { e.target.disabled = true; out.hidden = false; out.textContent = 'Running...'; const r = await Py.run({ code }); out.textContent = (r.error ? fmtErr(r.error) : (r.stdout || '(no printed output)')) + (r.figs && r.figs.length ? '\n[' + r.figs.length + ' figure(s) drawn - open it in a lesson cell to see]' : ''); e.target.disabled = false; } }, 'Run'), h('button', { class: 'btn sm', type: 'button', onclick: async e => { const host = e.target.closest('.ansCode').querySelector('.tutHost'); host.innerHTML = ''; const t = await codeTutor(code, {}); host.append(t); } }, 'Step through'), out), h('div', { class: 'tutHost' }))); }
  });
  return box;
}

/* ---- UI ---- */
function initAsk() {
  if ($('#askfab')) return;
  const cv = h('canvas', { id: 'markcv' }); const resize = () => { cv.width = innerWidth; cv.height = innerHeight; marker.draw(); };
  const marker = new Marker(cv, { page: true, onChange: () => setCount() }); document.body.append(cv);
  const fab = h('button', { id: 'askfab', type: 'button', title: 'Ask the tutor about anything on screen' }, h('b', {}, '?'), ' Ask the tutor');
  const dock = h('div', { id: 'askdock', hidden: true });
  const ans = h('div', { class: 'ansArea' }), q = h('textarea', { class: 'input', rows: 2, placeholder: 'Ask anything: "what does this line do?", "why is my output empty?", "explain this chart", "turn my sketch into code"...' });
  const count = h('span', { class: 'chip' }, 'nothing marked'), prov = h('span', { class: 'chip' }, 'AI: checking...');
  const sketchCv = h('canvas', { width: 520, height: 230, class: 'sketchcv' }), sketch = new Marker(sketchCv, { onChange: () => setCount() }), sketchBox = h('div', { class: 'sketchbox', hidden: true }, sketchCv, h('div', { class: 'muted', style: { fontSize: '12px' } }, 'Draw boxes (name each one), arrows between them, freehand notes. The app reads the structure and the model improves it and writes the code.'));
  const withShot = h('input', { type: 'checkbox' }); withShot.checked = true;
  const TOOLS = [['pen', 'Pen'], ['hl', 'Highlight'], ['box', 'Box'], ['circle', 'Circle'], ['arrow', 'Arrow']];
  const tbtn = {}; let active = null, mode = 'page';
  const target = () => (mode === 'sketch' ? sketch : marker);
  function pick(t) { active = active === t ? null : t; marker.tool = mode === 'page' ? active : null; sketch.tool = mode === 'sketch' ? active : null; cv.style.pointerEvents = mode === 'page' && active ? 'auto' : 'none'; cv.style.cursor = 'crosshair'; sketchCv.style.cursor = 'crosshair'; Object.entries(tbtn).forEach(([k, b]) => b.classList.toggle('primary', k === active)); }
  const bar = h('div', { class: 'row askbar' }, ...TOOLS.map(([k, l]) => (tbtn[k] = h('button', { class: 'btn sm', type: 'button', onclick: () => pick(k) }, l))), h('button', { class: 'btn sm', type: 'button', onclick: () => target().undo() }, 'Undo'), h('button', { class: 'btn sm', type: 'button', onclick: () => target().clear() }, 'Clear marks'),
    h('button', { class: 'btn sm', type: 'button', onclick: e => { mode = mode === 'page' ? 'sketch' : 'page'; sketchBox.hidden = mode !== 'sketch'; e.target.textContent = mode === 'sketch' ? 'Back to marking the page' : 'Sketch pad'; pick(null); } }, 'Sketch pad'), count, prov, h('label', { class: 'sw', title: 'Send a picture of the screen with your marks when a vision model is available' }, withShot, 'screenshot'),
    );
  const CHIPS = [['Explain what I marked', 'Explain the part I marked or selected, step by step, assuming I am a beginner.'], ['Why this error / output?', 'Why do I get this output or error? What exactly should I change?'], ['Explain the code line by line', 'Explain the code line by line and why each line is there.'], ['Sketch -> code', 'Understand my sketch, restate it, improve the design, then give the Python code and explain it line by line.'], ['Quiz me on this', 'Ask me 3 short questions about this topic, one at a time, then wait for my answer.']];
  const send = h('button', { class: 'btn primary', type: 'button', onclick: () => ask(q.value) }, 'Ask');
  const head = h('div', { class: 'askhead' }, h('b', {}, 'Ask the tutor'), h('span', { class: 'muted', style: { fontSize: '13px' } }, 'Mark anything on the screen, then ask. Esc hides this panel.'), h('span', { class: 'grow' }),
    h('button', { class: 'btn sm', type: 'button', title: 'Hide the panel. Your marks and the conversation stay.', onclick: () => toggle(false) }, '\u25BE Minimize'),
    h('button', { class: 'btn sm primary', type: 'button', title: 'Hide the panel and remove the marks you drew', onclick: () => { marker.clear(); sketch.clear(); toggle(false); } }, '\u2715 Close'));
  dock.append(head, h('div', { class: 'askin' }, bar, sketchBox, h('div', { class: 'row' }, ...CHIPS.map(([l, t]) => h('button', { class: 'chipbtn', type: 'button', onclick: () => { q.value = t; ask(t); } }, l))), h('div', { class: 'row', style: { alignItems: 'stretch' } }, q, send)), ans);
  document.body.append(fab, dock);
  q.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) { e.preventDefault(); ask(q.value); } });
  function setCount() { const n = marker.shapes.length + sketch.shapes.length, sel = String(getSelection() || '').trim().length; count.textContent = n || sel ? `${marker.shapes.length} marks on page, ${sketch.shapes.length} in sketch${sel ? ', text selected' : ''}` : 'nothing marked'; }
  function toggle(on) { Ask.open = on === undefined ? !Ask.open : on; dock.hidden = !Ask.open; fab.hidden = Ask.open; document.body.classList.toggle('askopen', Ask.open); if (!Ask.open) { pick(null); } if (Ask.open) refreshStatus(); setCount(); }
  fab.addEventListener('click', () => toggle(true)); document.addEventListener('keydown', e => { if (e.key === 'Escape' && Ask.open) { e.preventDefault(); toggle(false); } }); document.addEventListener('selectionchange', () => { if (Ask.open) setCount(); }); addEventListener('resize', resize); addEventListener('scroll', () => marker.draw(), { passive: true }); resize();
  async function refreshStatus() { try { Ask.status = await API.get('/api/llm/status'); const ok = Ask.status.providers.filter(p => p.ok && !p.disabled); prov.className = 'chip ' + (ok.length ? 'ok' : 'warn'); prov.textContent = ok.length ? 'AI: ' + ok.map(p => p.id).join(' > ') + (ok.some(p => p.vision) ? ' (sees images)' : ' (text only)') : 'AI: none reachable (offline help only)'; prov.title = Ask.status.providers.map(p => `${p.id}: ${p.ok ? 'ready' : 'not ready'} - ${p.detail}`).join('\n'); } catch (e) { prov.textContent = 'AI: unknown'; } }
  async function ask(text) {
    text = String(text || '').trim(); if (!text || Ask.busy) { if (!text) toast('Type a question first (or press a chip).'); return; } Ask.busy = true; send.disabled = true;
    const turn = h('div', { class: 'turn' }, h('div', { class: 'qbub' }, text), h('div', { class: 'muted' }, 'Thinking...')); ans.prepend(turn);
    const ctx = gatherContext(marker, sketch); const canSee = Ask.status && Ask.status.providers.some(p => p.ok && p.vision && !p.disabled);
    let image = null; if (withShot.checked && canSee && (marker.shapes.length || sketch.shapes.length)) { if (mode === 'sketch' && sketch.shapes.length) image = sketchCv.toDataURL('image/png'); else image = await capture(marker); }
    try {
      const r = await API.post('/api/llm/ask', { question: text, context: ctx, image, history: Ask.hist });
      turn.lastChild.remove();
      if (r.available) {
        turn.append(renderAnswer(r.answer), h('div', { class: 'muted', style: { fontSize: '12px' } }, `answered by ${r.provider} (${r.model})` + (r.sawImage ? ' - it saw your screenshot' : image ? ' - screenshot not used by this model; your marks were sent as text' : '') + (r.trail.length > 1 ? ' - fallback trail: ' + r.trail.map(t => t.id + (t.ok ? ' ok' : ' x')).join(' > ') : '')));
        Ask.hist.push({ role: 'user', content: text }, { role: 'assistant', content: r.answer.slice(0, 800) }); DSQ.S.log({ type: 'ask' }); DSQ.S.award(2, 'Curiosity'); Ask.hist = Ask.hist.slice(-8);
      } else {
        turn.append(h('div', { class: 'callout warn' }, h('b', {}, 'No AI model answered. '), r.hint || '', h('details', {}, h('summary', {}, 'what was tried'), h('pre', { class: 'tout' }, (r.trail || []).map(t => `${t.id}: ${t.ok ? 'ok' : t.err}`).join('\n')))));
        const lines = (ctx.marked || '').match(/CODE LINES[^\n]*\n[\s\S]*?(?=\nON SCREEN|\nCODE LINES|$)/g) || [];
        if (lines.length) turn.append(h('div', { class: 'callout' }, h('b', {}, 'Offline help for the code you marked: '), h('ul', {}, lines.flatMap(b => b.split('\n').slice(1)).filter(l => l.trim()).slice(0, 6).map(l => h('li', { html: '<code>' + esc(l.trim()) + '</code> - ' + explainLine(l) })))));
      }
    } catch (e) { turn.lastChild && turn.lastChild.remove(); turn.append(h('div', { class: 'callout warn' }, 'Could not reach the tutor service: ' + e.message)); }
    Ask.busy = false; send.disabled = false; q.value = '';
  }
  DSQ.ask = ask; DSQ.askToggle = toggle; DSQ.askStatus = refreshStatus; DSQ.marker = marker; DSQ.sketch = sketch;
}
DSQ.initAsk = initAsk;
