'use strict';
/* Runs every piece of code in every study room (public/js/studio/*.js and content-private/js/studio/*.js) in REAL CPython, the way the page runs it:
   stepper steps (cumulative), lab defaults and the ends of every slider, explorer items, code and compare blocks.
   It fails when code raises (unless the block says expectError), when a variable a block asks to show is missing, when an `expect` text is not in the output,
   or when a widget name is not in public/studio/widgets.js.
     DSQ_PY=path/to/python node tools/verify_studio.js [numpy ...]      (that Python needs numpy, pandas, matplotlib)  */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), PY = process.env.DSQ_PY || 'python';
const only = process.argv.slice(2);
const eng = fs.readFileSync(path.join(ROOT, 'public', 'studio', 'engine.js'), 'utf8'), wid = fs.readFileSync(path.join(ROOT, 'public', 'studio', 'widgets.js'), 'utf8');
const PRE = new Function('return `' + /const PRE = `([\s\S]*?)`;/.exec(eng)[1] + '`')();
const SHIMS = vm.runInNewContext('(function(){' + fs.readFileSync(path.join(ROOT, 'public', 'studio', 'shims.js'), 'utf8') + '; return SHIMS; })()');
const widAll = ['widgets.js', 'widgets_web.js', 'widgets_ai.js', 'widgets_live.js'].map(f => (fs.existsSync(path.join(ROOT, 'public', 'studio', f)) ? fs.readFileSync(path.join(ROOT, 'public', 'studio', f), 'utf8') : '')).join('\n');
const WIDGETS = new Set([...widAll.matchAll(/WIDGETS\.(\w+) =/g)].map(m => m[1]));
const files = [];
for (const d of [path.join(ROOT, 'public', 'js', 'studio'), path.join(ROOT, 'content-private', 'js', 'studio')]) if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (f.endsWith('.js')) files.push(path.join(d, f));
const ctx = vm.createContext({ DSQ: { studio: {} }, console }); for (const f of files) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const rooms = ctx.DSQ.studio, problems = [], jobs = [];
const fill = (tpl, v) => tpl.replace(/\{\{(\w+)(\|py)?\}\}/g, (_, k, py) => (py ? JSON.stringify(String(v[k])) : typeof v[k] === 'boolean' ? (v[k] ? 'True' : 'False') : v[k]));
function visit(room, sec, b, where) {
  const add = (code, show, o) => jobs.push(Object.assign({ room: room.id, where, code, show: show || [], starter: (b.starter !== undefined ? b.starter : room.starter) || '', echo: !!b.echo, shim: (b.shim !== undefined ? b.shim : room.shim) ? SHIMS[b.shim !== undefined ? b.shim : room.shim] : '' }, o || {}));
  if (b.t === 'code') add(b.code, b.show, { expectError: b.expectError });
  else if (b.t === 'compare') b.items.forEach((it, i) => add(it.code, it.show, { where: where + ' compare#' + i, expectError: it.expectError }));
  else if (b.t === 'stepper') { if (!b.static) b.steps.forEach((s, i) => add(b.steps.slice(0, i + 1).map(x => (x.run !== undefined ? x.run : x.code)).join('\n'), s.show || b.show, { where: where + ' stepper step ' + (i + 1), expect: s.expect })); }
  else if (b.t === 'explorer') b.items.forEach((it, i) => add(b.cumulative ? b.items.slice(0, i + 1).map(x => x.code).join('\n') : it.code, it.show, { where: where + ' explorer: ' + it.name, expect: it.expect, starter: (it.starter !== undefined ? it.starter : b.starter !== undefined ? b.starter : room.starter) || '' }));
  else if (b.t === 'lab') {
    const base = Object.fromEntries(b.controls.map(c => [c.id, c.value])); add(fill(b.code, base), b.show, { where: where + ' lab defaults' });
    b.controls.forEach(c => { const ends = c.type === 'range' ? [c.min, c.max] : c.type === 'select' ? c.options.map(o => (Array.isArray(o) ? o[0] : o)) : c.type === 'check' ? [true, false] : (c.alt || []); ends.forEach(e => add(fill(b.code, Object.assign({}, base, { [c.id]: e })), b.show, { where: `${where} lab ${c.id}=${e}` })); });
  } else if (b.t === 'exercise') {
    if (!b.solution || !b.tests) problems.push(`${where}: an exercise needs a solution and tests`);
    else { const st = (room.starter || '') + '\n' + (b.setup || ''); add(b.solution, [], { where: where + ' exercise solution', tests: b.tests, expectPass: true, starter: st, echo: false }); add(b.starter || '', [], { where: where + ' exercise starter', tests: b.tests, expectFail: true, starter: st, echo: false }); }
  } else if (b.t === 'widget') { if (!WIDGETS.has(b.w)) problems.push(`${where}: unknown widget "${b.w}"`); }
  else if (b.t === 'tabs') b.tabs.forEach((t, i) => (t.blocks || []).forEach((x, j) => visit(room, sec, x, where + ` tab${i}.${j}`)));
}
for (const room of Object.values(rooms)) {
  if (only.length && !only.includes(room.id)) continue;
  room.sections.forEach(sec => { (sec.blocks || []).forEach((b, i) => visit(room, sec, b, `${room.id}/${sec.id}#${i} ${b.t}`)); (sec.quiz || []).forEach((q, i) => { if (!(q.a >= 0 && q.a < q.o.length)) problems.push(`${room.id}/${sec.id} quiz ${i + 1}: answer index out of range`); }); });
}
const runner = `
import sys, json, io, contextlib, traceback
import matplotlib; matplotlib.use('agg')
jobs = json.load(sys.stdin); pre = jobs['pre']; out = []
for j in jobs['jobs']:
    ns = {'__name__': '__main__'}; buf = io.StringIO(); err = None
    try:
        exec(compile(pre, '<pre>', 'exec'), ns)
        if j.get('shim'): exec(compile(j['shim'], '<shim>', 'exec'), ns)
        if j['starter']: exec(compile(j['starter'], '<starter>', 'exec'), ns)
        code = ('_dsq_echo_run(' + json.dumps(j['code']) + ')' if j.get('echo') else j['code']) + ('\\n_dsq_dump(' + json.dumps(j['show']) + ')\\n' if j['show'] else '')
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
            exec(compile(code, '<code>', 'exec'), ns)
    except BaseException as e:
        err = type(e).__name__ + ': ' + str(e)
    checks = None
    if j.get('tests') and err is None:
        checks = []
        def check(cond, msg, hint=''):
            checks.append(bool(cond)); return bool(cond)
        tns = dict(ns); tns['check'] = check; tns['OUT'] = buf.getvalue()
        try:
            exec(compile(j['tests'], '<tests>', 'exec'), tns)
        except BaseException as e:
            checks.append(False); err = 'tests raised ' + type(e).__name__ + ': ' + str(e)
    o = buf.getvalue()
    missing = []
    if '\\x01DUMP' in o:
        d = json.loads(o.split('\\x01DUMP')[1].split('\\n')[0])
        missing = [k for k, v in d.items() if v.get('v') == '(not defined yet)']
    try:
        import matplotlib.pyplot as plt; plt.close('all')
    except Exception: pass
    out.append({'err': err, 'out': o.split('\\x01DUMP')[0], 'missing': missing, 'checks': checks})
print(json.dumps(out))
`;
const res = cp.spawnSync(PY, ['-c', runner], { input: JSON.stringify({ pre: PRE, jobs }), encoding: 'utf8', maxBuffer: 1 << 28, timeout: +process.env.DSQ_TIMEOUT || 1800000 });
if (res.status !== 0) { console.error('python failed:', (res.stderr || '').slice(-600)); process.exit(1); }
const results = JSON.parse(res.stdout.trim().split('\n').pop());
results.forEach((r, i) => {
  const j = jobs[i];
  if (j.expectPass) { if (r.err) problems.push(`${j.where}: ${r.err}`); else if (!r.checks || !r.checks.length || !r.checks.every(Boolean)) problems.push(`${j.where}: the solution does not pass all its checks (${JSON.stringify(r.checks)})`); return; }
  if (j.expectFail) { if (!r.err && r.checks && r.checks.length && r.checks.every(Boolean)) problems.push(`${j.where}: the starter code already passes every check`); return; }
  if (j.expectError) { if (!r.err) problems.push(`${j.where}: was meant to fail with "${j.expectError}" but it ran`); else if (!r.err.includes(j.expectError)) problems.push(`${j.where}: wrong error: ${r.err}`); return; }
  if (r.err) problems.push(`${j.where}: ${r.err}`);
  if (r.missing.length) problems.push(`${j.where}: shows undefined variables ${r.missing.join(', ')}`);
  if (j.expect && !r.out.includes(j.expect)) problems.push(`${j.where}: output does not contain ${JSON.stringify(j.expect)}; got ${JSON.stringify(r.out.slice(-120))}`);
});
console.log(`${Object.keys(rooms).length} room(s), ${jobs.length} code runs in real Python, ${problems.length} problem(s)`);
problems.forEach(p => console.log('  PROBLEM ' + p));
process.exit(problems.length ? 1 : 0);
