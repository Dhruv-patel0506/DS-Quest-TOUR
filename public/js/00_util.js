'use strict';
/* =====================================================================
   DS Quest - utilities (loaded first; also loaded by tools/verify.js in node)
   ===================================================================== */
const DSQ = (typeof window !== 'undefined' ? (window.DSQ = window.DSQ || {}) : (global.DSQ = global.DSQ || {}));
DSQ.modules = DSQ.modules || [];
DSQ.viz = DSQ.viz || {};
DSQ.defModule = m => { DSQ.modules.push(m); return m; };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const range = n => Array.from({ length: n }, (_, i) => i);
const sum = a => a.reduce((s, x) => s + x, 0);
const mean = a => sum(a) / a.length;

/* element builder: h('div',{class:'x',onclick:fn,style:{}},child,...) ; html:'...' sets innerHTML */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}

/* string hash -> 32 bit int, and seeded RNG (mulberry32) */
function hash32(str) { let h1 = 2166136261; for (let i = 0; i < str.length; i++) { h1 ^= str.charCodeAt(i); h1 = Math.imul(h1, 16777619); } return h1 >>> 0; }
function RNG(seed) {
  let a = (seed >>> 0) || 1;
  const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
  f.norm = (mu = 0, s = 1) => { let u = 0; while (!u) u = f(); const v = f(); return mu + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.shuffle = arr => { arr = [...arr]; for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  f.choice = (arr, k) => f.shuffle(arr).slice(0, k);
  f.exp = (rate = 1) => -Math.log(1 - f()) / rate;
  return f;
}
const fmt = (x, d = 2) => (+x).toFixed(d);
const pad2 = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);

/* requestAnimationFrame animation: fn(t 0..1 eased), returns cancel fn */
function anim(ms, fn, done) {
  const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (RM) { fn(1); if (done) done(); return () => { }; }
  let raf, t0 = null, dead = false;
  const step = ts => {
    if (dead) return; if (t0 == null) t0 = ts;
    const p = clamp((ts - t0) / ms, 0, 1); fn(ease(p));
    if (p < 1) raf = requestAnimationFrame(step); else if (done) done();
  };
  raf = requestAnimationFrame(step);
  return () => { dead = true; cancelAnimationFrame(raf); };
}

/* toasts + confetti */
function toast(msg, cls = '') {
  const t = h('div', { class: 'toast ' + cls }, msg); const box = $('#toasts'); if (!box) return;
  box.append(t); setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = 0; setTimeout(() => t.remove(), 450); }, 2600);
}
function confetti(n = 90) {
  if (n < 150) return;   /* only for the big moments: a passed boss, a published project */
  const cv = $('#confetti'); if (!cv || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  cv.width = innerWidth; cv.height = innerHeight; const g = cv.getContext('2d');
  const cols = ['#2F6FE0', '#D2600F', '#1E8E5A', '#7A4FD0', '#0E8FA3', '#B8860B', '#C2418A'];
  const ps = range(n).map(() => ({ x: innerWidth / 2 + (Math.random() - .5) * 240, y: innerHeight * .35, vx: (Math.random() - .5) * 11, vy: -Math.random() * 11 - 3, r: 3 + Math.random() * 4, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6 }));
  let f = 0;
  (function loop() {
    g.clearRect(0, 0, cv.width, cv.height);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .28; p.a += .2; g.fillStyle = p.c; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); });
    if (++f < 120) requestAnimationFrame(loop); else g.clearRect(0, 0, cv.width, cv.height);
  })();
}

/* python highlighter -> html (blanks ___ are highlighted) */
const PY_KW = new Set(['import', 'from', 'as', 'def', 'return', 'for', 'in', 'if', 'elif', 'else', 'while', 'and', 'or', 'not', 'is', 'None', 'True', 'False', 'lambda', 'with', 'class', 'try', 'except', 'finally', 'pass', 'break', 'continue', 'yield', 'raise', 'assert', 'global', 'del']);
function hlPy(src) {
  const re = /(#[^\n]*)|("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$))|([fbrFBR]{0,2}"(?:\\.|[^"\\\n])*"?|[fbrFBR]{0,2}'(?:\\.|[^'\\\n])*'?)|(\b___\b)|(\b\d+(?:\.\d+)?(?:[eE][-+]?\d+)?\b|\.\d+\b)|([A-Za-z_]\w*)|([\s\S])/g;
  let out = '', m;
  while ((m = re.exec(src))) {
    if (m[1]) out += `<span class="c">${esc(m[1])}</span>`;
    else if (m[2] || m[3]) out += `<span class="s">${esc(m[2] || m[3])}</span>`;
    else if (m[4]) out += `<span class="bl">___</span>`;
    else if (m[5]) out += `<span class="n">${esc(m[5])}</span>`;
    else if (m[6]) { const w = m[6]; out += PY_KW.has(w) ? `<span class="k">${w}</span>` : (src[re.lastIndex] === '(' ? `<span class="f">${w}</span>` : w); }
    else out += esc(m[7]);
  }
  return out;
}

/* tiny markdown-ish for lesson prose: **bold**, `code`, newlines kept as given html */
const inl = s => String(s).replace(/`([^`]+)`/g, (_, c) => `<code>${esc(c)}</code>`).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

/* numpy-ish printing for generated quiz output */
const pyNum = x => (Number.isInteger(x) ? String(x) : String(+x.toFixed(6)));

if (typeof module !== 'undefined') module.exports = { DSQ };
