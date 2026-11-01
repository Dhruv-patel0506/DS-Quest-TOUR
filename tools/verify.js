'use strict';
/* Content verifier.
   node tools/verify.js [moduleId ...]
   1. loads util + kit + datasets + all content files in a vm (no browser)
   2. collects every exercise and every project milestone (standard AND flagship, several learners)
   3. runs the reference solution through the SAME Python harness the browser uses and requires every check to pass
   4. runs the starter code and requires that it does NOT pass (otherwise the exercise is trivial)
   Needs local python with numpy/pandas/matplotlib. */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.join(__dirname, '..', 'public', 'js');
const ctx = vm.createContext({ console, global: null, setTimeout, clearTimeout, Math, JSON, Date });
ctx.global = ctx;
const load = f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
['00_util.js', '02_py.js'].forEach(f => load(path.join(root, f)));
['01_kit.js', '02_datasets.js', '00_roadmap.js'].forEach(f => load(path.join(root, 'content', f)));
/* the helper modules the app writes next to every run (datasets, in-browser HTTP client, Django set-up) */
const helperFiles = src => { const out = {}; for (const f of ['dsq_data.py', 'dsq_http.py', 'dsq_django.py', 'dsq_shell.py', 'dsq_docker.py', 'dsq_pane.py']) if (src.includes(f.slice(0, -3))) out[f] = fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8'); return out; };
const only = process.argv.slice(2);
require('./_content').moduleFiles().forEach(x => load(x.p));
const DSQ = ctx.DSQ;
const harness = vm.runInContext('PY_HARNESS', ctx);
const TC = vm.runInContext('termCase', ctx);
const cases = [];
const users = ['Dstar', 'asha_k', 'rohan.m'];
for (const m of DSQ.modules) {
  if (only.length && !only.includes(m.id)) continue;
  for (const L of m.lessons || []) for (const p of L.pages) if (p.t === 'term') {
    const e = p.ex, sol = TC(e, true), st = TC(e, false);
    cases.push({ id: m.id + '/' + e.id, code: sol.code, starter: st.code, tests: sol.tests, files: helperFiles('dsq_shell dsq_docker'), prelude: '', kind: 'lesson' });
  }
  for (const L of m.lessons || []) for (const p of L.pages) if (p.t === 'ex') {
    const e = p.ex; if (e.browserOnly) continue; /* FastAPI / Django exercises need browser-only packages: tools/verify_browser.md */ cases.push({ id: m.id + '/' + e.id, code: e.solution, starter: e.starter, tests: e.tests, files: Object.assign(helperFiles(e.solution + e.starter + e.tests), e.files || {}), prelude: '', kind: 'lesson' });
  }
  if (m.project) for (const v of m.project.variants) for (const user of users) {
    const tier = user === 'Dstar' ? 'flagship' : 'standard';
    const vv = tier === 'flagship' ? v : v;
    const rng = ctx.RNG(ctx.hash32(user.toLowerCase() + '|' + m.id + '|' + v.id + '|data'));
    const csv = v.dataset.gen(rng, tier), files = { ['data/' + v.dataset.file]: csv };
    const ms = (v.milestones || []).concat(tier === 'flagship' ? (v.flagship_ms || []) : []);
    let prelude = '';
    for (const x of ms) {
      cases.push({ id: `${m.id}/${v.id}/${x.id} [${user}/${tier}]`, code: x.solution, starter: x.starter, tests: x.tests, files, prelude, kind: 'project' });
      prelude += (prelude ? '\n\n' : '') + x.solution;
    }
  }
}
const tmp = path.join(require('os').tmpdir(), 'dsq_verify'); fs.mkdirSync(tmp, { recursive: true });
const sheetCases = [];
for (const m of DSQ.modules) { if (only.length && !only.includes(m.id)) continue; if (!m.sheet) continue; for (const sec of m.sheet.sections) sheetCases.push({ id: m.id + '/' + sec.id, setup: sec.setup || '', items: sec.items.map(f => ({ fn: f.fn, code: f.code })) }); }
fs.writeFileSync(path.join(tmp, 'sheets.json'), JSON.stringify(sheetCases));
fs.writeFileSync(path.join(tmp, 'harness.py'), harness);
fs.writeFileSync(path.join(tmp, 'cases.json'), JSON.stringify(cases));
fs.writeFileSync(path.join(tmp, 'run.py'), `
import json, sys, os, tempfile, shutil, traceback
sys.path.insert(0, os.path.dirname(__file__))
exec(open(os.path.join(os.path.dirname(__file__), 'harness.py')).read())
cases = json.load(open(os.path.join(os.path.dirname(__file__), 'cases.json')))
bad = 0
for c in cases:
    d = tempfile.mkdtemp(); old = os.getcwd(); os.chdir(d); sys.path.insert(0, d)
    try:
        r = json.loads(_dsq_run(json.dumps({'code': c['code'], 'tests': c['tests'], 'files': c['files'], 'prelude': c['prelude']})))
        ok = r['error'] is None and r['checks'] and all(k['ok'] for k in r['checks'])
        if not ok:
            bad += 1
            print('FAIL solution:', c['id'])
            if r['error']: print('   error:', r['error'])
            for k in r['checks']:
                if not k['ok']: print('   check failed:', k['msg'])
            if not r['checks'] and not r['error']: print('   (no checks ran)')
        else:
            s = json.loads(_dsq_run(json.dumps({'code': c['starter'], 'tests': c['tests'], 'files': c['files'], 'prelude': c['prelude']})))
            if s['error'] is None and s['checks'] and all(k['ok'] for k in s['checks']):
                bad += 1; print('FAIL starter already passes:', c['id'])
    except Exception as e:
        bad += 1; print('CRASH', c['id'], repr(e)); traceback.print_exc()
    finally:
        os.chdir(old); shutil.rmtree(d, ignore_errors=True)
os.environ.setdefault('MPLBACKEND', 'agg')
import io, contextlib
sheets = json.load(open(os.path.join(os.path.dirname(__file__), 'sheets.json')))
nsheet = 0
for sc in sheets:
    d = tempfile.mkdtemp(); old = os.getcwd(); os.chdir(d); sys.path.insert(0, d)
    ns = {'__name__': '__main__'}
    try:
        for label, code in [('setup', sc['setup'])] + [(it['fn'], it['code']) for it in sc['items']]:
            if not code.strip(): continue
            nsheet += 1
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    exec(compile(code, '<sheet>', 'exec'), ns)
            except BaseException as e:
                bad += 1; print('FAIL sheet:', sc['id'], '::', label, '->', type(e).__name__, str(e)[:160])
    finally:
        os.chdir(old); shutil.rmtree(d, ignore_errors=True)
print('sheet lines run in clean sessions:', nsheet, 'in', len(sheets), 'groups')
print('cases:', len(cases), 'problems:', bad)
sys.exit(1 if bad else 0)
`);
console.log('collected', cases.length, 'cases from', DSQ.modules.map(m => m.id).join(', '));
const r = cp.spawnSync('python', ['-X', 'utf8', path.join(tmp, 'run.py')], { stdio: 'inherit' });
process.exit(r.status || 0);
