'use strict';
/* Verifies the Picture Class lessons against real Python (NumPy, pandas, scikit-learn, PyTorch, SQLite).
   node tools/verify_picture.js [lessonId ...]
   - every step that shows an `out` is run in Python and must print exactly that
   - the numbers the animated scenes compute (PIC.math: k-means, tree, convolution, histogram, polynomial fit, gradient descent) must equal NumPy / scikit-learn
   Needs local Python with numpy, scikit-learn and (for the PyTorch lesson) torch. */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const js = path.join(__dirname, '..', 'public', 'js'), jsPriv = path.join(__dirname, '..', 'content-private', 'js', 'picture'), where = f => (fs.existsSync(path.join(js, f)) ? path.join(js, f) : path.join(jsPriv, f)), fillMode = process.argv.includes('--fill'), only = process.argv.slice(2).filter(a => a !== '--fill'), fileOf = [];
const ctx = vm.createContext({ console, Math, JSON, Date, Set, Array, Object, Number, String, window: {}, document: {}, picEsc: s => String(s), pjClampLocal: (v, a, b) => Math.max(a, Math.min(b, v)) });
vm.runInContext('const PIC = { lessons: [], scenes: {} }; PIC.lesson = l => { PIC.lessons.push(l); return l; };', ctx);
for (const f of ['34d_picture_scenes3.js', '34e_picture_scenes4.js', '34f_picture_scenes5.js', '34g_picture_scenes6.js', '38_picture_data.js'].concat([...fs.readdirSync(js), ...(fs.existsSync(jsPriv) ? fs.readdirSync(jsPriv) : [])].filter(n => /^(36|39|4[3-9]|[5-9]\d)_picture_.*\.js$/.test(n)).sort())) { const p = where(f); if (fs.existsSync(p)) { const n0 = vm.runInContext('PIC.lessons.length', ctx); vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); const n1 = vm.runInContext('PIC.lessons.length', ctx); for (let q = n0; q < n1; q++) fileOf.push(f); } }
const L = vm.runInContext('PIC.lessons', ctx), M = vm.runInContext('PIC.math', ctx);
const lessons = [], scenes = [];
for (const l of L) {
  if (l.embed || (only.length && !only.includes(l.id))) continue;
  lessons.push({ id: l.id, setup: l.setup || '', sql: !!l.sql, steps: l.steps.map((s, i) => ({ n: i + 1, code: s.code || '', out: s.out === '@@' ? undefined : s.out, fill: s.out === '@@' || undefined, check: s.check, skip: !!l.pseudo || !!s.nocheck || !s.code })).map(s => { if (s.out === undefined) delete s.out; if (s.check === undefined) delete s.check; if (!s.fill) delete s.fill; return s; }) });
  l.steps.forEach((s, i) => {
    const sp = s.scene; if (!sp) return;
    if (sp.type === 'regress' && sp.mode === 'poly') { const f = M.polyfit(sp.pts.map(p => p[0]), sp.pts.map(p => p[1]), sp.deg); scenes.push({ id: l.id, step: i + 1, kind: 'poly', spec: sp, js: { train: M.mean(sp.pts.map(p => Math.pow(f(p[0]) - p[1], 2))), test: sp.test ? M.mean(sp.test.map(p => Math.pow(f(p[0]) - p[1], 2))) : null } }); }
    if (sp.type === 'regress' && sp.mode === 'learn') { const t = M.gd(sp.pts, sp.line[0], sp.line[1], sp.lr, sp.steps), e = t[t.length - 1]; scenes.push({ id: l.id, step: i + 1, kind: 'learn', spec: sp, js: { w: e.w, b: e.b } }); }
    if (sp.type === 'cluster' && sp.init) { const k = M.kmeans(sp.pts, sp.init, 30), last = k.hist[k.hist.length - 1]; scenes.push({ id: l.id, step: i + 1, kind: 'kmeans', spec: sp, js: { cents: k.cents, labels: last.assign, inertia: M.inertia(sp.pts, k.cents, last.assign) } }); }
    if (sp.type === 'tree' && sp.depth >= 1) { const nodes = M.tree(sp.pts, sp.classes.length, sp.depth, [0, 1, 0, 1]), pre = []; const walk = n => { if (!n.split) return; pre.push({ f: n.split.f, th: n.split.th, n: n.n }); walk(n.left); walk(n.right); }; walk(nodes[0]); scenes.push({ id: l.id, step: i + 1, kind: 'tree', spec: sp, js: { pre } }); }
    if (sp.type === 'classify' && sp.model) { const G = [[.5, 1], [1, 5], [2, 2], [3, 3], [3.5, 3.5], [4, 6], [5, 2], [6, 7], [3.2, 3.9], [3.6, 3.0], [4, 3.6]]; scenes.push({ id: l.id, step: i + 1, kind: 'classify', spec: sp, grid: G, js: { p: G.map(g => (sp.model === 'knn' ? M.knn(sp.pts, g[0], g[1], sp.k || 3).p1 : M.sigmoid(sp.coef[0] * g[0] + sp.coef[1] * g[1] + sp.intercept))) } }); }
    if (sp.type === 'compare' && sp.kind !== 'drift') scenes.push({ id: l.id, step: i + 1, kind: 'abpower', spec: sp, js: { power: M.abPower(sp.p0, sp.p0 + sp.lift, sp.n, sp.alpha || .05) } });
    if (sp.type === 'compare' && sp.kind === 'drift') scenes.push({ id: l.id, step: i + 1, kind: 'psi', spec: sp, js: { psi: M.psi(sp.ref, sp.cur, sp.edges) } });
    if (sp.type === 'dag' && !(sp.failed && sp.failed.length)) scenes.push({ id: l.id, step: i + 1, kind: 'dag', spec: sp, js: { waves: M.waves(sp.nodes, sp.edges, []).waves.map(w => w.run.slice().sort()) } });
    if (sp.type === 'contrast') scenes.push({ id: l.id, step: i + 1, kind: 'contrast', spec: sp, js: { ratio: M.contrast(sp.fg, sp.bg) } });
    if (sp.type === 'miniapp') { const sts = [{ cities: sp.cities, min: sp.min || 0 }, { cities: sp.cities.slice(0, 1), min: 0 }, { cities: sp.cities, min: 800 }]; scenes.push({ id: l.id, step: i + 1, kind: 'miniapp', spec: sp, states: sts, js: { out: sts.map(st => { const r = M.appRows(sp.data, st); return [r.length, r.reduce((a, q) => a + q[2], 0)]; }) } }); }
    if (sp.type === 'conv') { const F = M.conv2d(sp.img, sp.kernel), R = M.relu(F); scenes.push({ id: l.id, step: i + 1, kind: 'conv', spec: sp, js: { F, R, P: M.pool(R, 2) } }); }
    if (sp.type === 'hist') { const d = sp.data, lo = Math.min.apply(null, d), hi = Math.max.apply(null, d), edges = sp.edges || Array.from({ length: (sp.bins || 10) + 1 }, (_, q) => lo + (hi - lo) * q / (sp.bins || 10)); scenes.push({ id: l.id, step: i + 1, kind: 'hist', spec: sp, js: { counts: M.hist(d, edges), mean: M.mean(d), median: M.median(d), std: M.std(d) } }); }
  });
}
const r = cp.spawnSync(process.env.DSQ_PYTHON || 'python', ['-W', 'ignore', path.join(__dirname, 'verify_picture.py')], { input: JSON.stringify({ lessons, scenes, fill: fillMode }), encoding: 'utf8', maxBuffer: 1 << 26, env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', MPLBACKEND: 'Agg' }), timeout: 1200000 });
if (r.error || r.signal) { console.log('FAIL the Python run did not finish: ' + (r.error ? r.error.message : r.signal)); process.exitCode = 1; }
const outText = r.stdout || '', fi = outText.indexOf('FILLJSON:');
if (fillMode && fi >= 0) {
  /* write the real outputs into the lesson files, in step order, where the source says out: `@@` */
  const got = JSON.parse(outText.slice(fi + 9).split('\n')[0]), esc = t => t.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${').replace(/\r?\n/g, '\\n');
  const byFile = {}; L.forEach((l, i) => { if (!l.embed && got[l.id]) (byFile[fileOf[i]] = byFile[fileOf[i]] || []).push(l); });
  Object.keys(byFile).forEach(f => { const p = where(f); let text = fs.readFileSync(p, 'utf8'), n = 0; const crlf = text.includes('\r\n'); if (crlf) text = text.replace(/\r\n/g, '\n');
    byFile[f].forEach(l => l.steps.forEach((st, i) => { if (st.out === '@@') { const o = got[l.id][String(i + 1)]; if (o === undefined) return; const at = text.indexOf('out: `@@`'); if (at < 0) return; text = text.slice(0, at) + 'out: `' + esc(o) + '`' + text.slice(at + 9); n++; } }));
    fs.writeFileSync(p, crlf ? text.replace(/\n/g, '\r\n') : text); console.log('filled ' + n + ' outputs in ' + f); });
}
process.stdout.write(outText.split('\n').filter(l => !l.startsWith('FILLJSON:')).join('\n') + (r.stderr || '').split('\n').filter(l => !/pynvml/.test(l)).join('\n'));
process.exit(r.status || 0);
