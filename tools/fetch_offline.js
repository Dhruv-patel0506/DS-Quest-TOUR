'use strict';
/* Downloads everything DS Quest needs to run with NO internet into public/vendor/ :
     vendor/pyodide/       Pyodide core + every package the lessons import (resolved from pyodide-lock.json)
     vendor/wheels/        pure-python wheels that pip would normally fetch (seaborn, fastapi, django ...)
     vendor/fonts/         Inter, Source Serif 4, JetBrains Mono (latin) + fonts.css
     vendor/html2canvas.min.js
   Usage:  node tools/fetch_offline.js          (download what is missing)
           node tools/fetch_offline.js --dry    (only print sizes)
   Re-running is safe: files that already exist with the right size are skipped. */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', 'public', 'vendor');
const PYV = '0.27.7', CDN = `https://cdn.jsdelivr.net/pyodide/v${PYV}/full/`;
const DRY = process.argv.includes('--dry');
// top-level packages the lessons import (names as in pyodide-lock.json)
const ROOTS = ['numpy', 'pandas', 'matplotlib', 'scikit-learn', 'scipy', 'pydantic', 'micropip', 'sqlite3', 'beautifulsoup4', 'requests', 'pillow', 'packaging', 'tzdata', 'six', 'typing-extensions', 'ssl', 'openssl', 'lzma', 'hashlib', 'regex', 'pytz', 'python-dateutil', 'networkx'];
// pip wheels installed at runtime via micropip (seaborn is pure python, the rest are web frameworks)
const PIPS = ['seaborn', 'fastapi==0.115.6', 'httpx', 'django', 'anyio<4.7', 'sniffio'];
const CORE = ['pyodide.js', 'pyodide.mjs', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];

const mkdir = d => fs.mkdirSync(d, { recursive: true });
async function get(url, dest, expect) {
  if (fs.existsSync(dest) && (!expect || fs.statSync(dest).size === expect)) return fs.statSync(dest).size;
  if (DRY) return 0;
  const r = await fetch(url); if (!r.ok) throw new Error(url + ' -> ' + r.status);
  const b = Buffer.from(await r.arrayBuffer()); mkdir(path.dirname(dest)); fs.writeFileSync(dest, b); return b.length;
}
const mb = n => (n / 1048576).toFixed(1) + ' MB';

async function pyodide() {
  const dir = path.join(ROOT, 'pyodide'); mkdir(dir);
  const lockUrl = CDN + 'pyodide-lock.json', lockFile = path.join(dir, 'pyodide-lock.json');
  fs.writeFileSync(lockFile, Buffer.from(await (await fetch(lockUrl)).arrayBuffer()));
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8')), pk = lock.packages;
  const nm = n => n.toLowerCase().replace(/[-_.]+/g, '-');
  const byName = {}; for (const [k, v] of Object.entries(pk)) byName[nm(k)] = v;
  const need = new Set(), q = ROOTS.map(nm);
  while (q.length) {
    const n = q.pop(); if (need.has(n)) continue; const p = byName[n]; if (!p) { console.log('  (not in pyodide: ' + n + ')'); continue; }
    need.add(n); (p.depends || []).forEach(d => q.push(nm(d)));
  }
  let total = 0; const files = [...CORE.filter(f => f !== 'pyodide-lock.json')];
  need.forEach(n => files.push(byName[n].file_name));
  for (const f of files) total += await get(CDN + f, path.join(dir, f));
  // the lock file only lists packages we vendored, so the runtime can never ask for one we do not have
  const keep = {}; need.forEach(n => { const key = Object.keys(pk).find(k => nm(k) === n); keep[key] = pk[key]; });
  lock.packages = keep; fs.writeFileSync(lockFile, JSON.stringify(lock));
  console.log('pyodide: ' + need.size + ' packages, ' + mb(total || files.reduce((a, f) => a + (fs.existsSync(path.join(dir, f)) ? fs.statSync(path.join(dir, f)).size : 0), 0)));
  fs.writeFileSync(path.join(dir, 'files.json'), JSON.stringify(files));
  return files.map(f => 'vendor/pyodide/' + f);
}

function wheels() {
  const dir = path.join(ROOT, 'wheels'); mkdir(dir);
  const skip = /^(numpy|pandas|matplotlib|scipy|scikit[-_]learn|pydantic|pydantic[-_]core|pillow|typing[-_]extensions|packaging|six|python[-_]dateutil|pytz|tzdata|contourpy|cycler|fonttools|kiwisolver|pyparsing|joblib|threadpoolctl|annotated[-_]types)$/i;
  if (fs.readdirSync(dir).some(f => f.endsWith('.whl'))) { console.log('wheels: already present'); return fs.readdirSync(dir).filter(f => f.endsWith('.whl')).map(f => 'vendor/wheels/' + f); }
  if (DRY) { console.log('wheels: (would resolve ' + PIPS.join(', ') + ')'); return []; }
  const tmp = path.join(require('os').tmpdir(), 'dsq_wheels'); mkdir(tmp);
  const rep = path.join(tmp, 'report.json');
  execFileSync('python', ['-m', 'pip', 'install', '--dry-run', '--ignore-installed', '--quiet', '--report', rep, ...PIPS], { stdio: 'inherit' });
  const items = JSON.parse(fs.readFileSync(rep, 'utf8')).install.map(i => i.metadata.name);
  const want = items.filter(n => !skip.test(n));
  console.log('wheels to vendor: ' + want.join(', '));
  const specs = want.map(n => { const f = PIPS.find(p => p.split('==')[0].toLowerCase() === n.toLowerCase()); return f || n; });
  execFileSync('python', ['-m', 'pip', 'download', '--no-deps', '--only-binary=:all:', '--python-version', '3.12', '--platform', 'any', '-d', dir, ...specs], { stdio: 'inherit' });
  const bad = fs.readdirSync(dir).filter(f => f.endsWith('.whl') && !/-none-any\.whl$/.test(f));
  if (bad.length) throw new Error('non-pure wheels: ' + bad.join(', '));
  const out = fs.readdirSync(dir).filter(f => f.endsWith('.whl'));
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(out));
  console.log('wheels: ' + out.length + ' files, ' + mb(out.reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0)));
  return out.map(f => 'vendor/wheels/' + f);
}

async function fonts() {
  const dir = path.join(ROOT, 'fonts'); mkdir(dir);
  if (fs.existsSync(path.join(dir, 'fonts.css'))) { console.log('fonts: already present'); return fs.readdirSync(dir).map(f => 'vendor/fonts/' + f); }
  if (DRY) { console.log('fonts: (would download)'); return []; }
  const css = await (await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:ital,wght@0,500;0,600;1,500;1,600&family=JetBrains+Mono:wght@400;600;700&display=swap', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' } })).text();
  // keep only the latin subset blocks
  const blocks = css.split('/* ').slice(1).map(b => '/* ' + b).filter(b => /^\/\* latin \*\//.test(b));
  let out = '', total = 0, n = 0;
  for (const b of blocks) {
    const m = b.match(/url\((https:[^)]+\.woff2)\)/); if (!m) continue;
    const name = 'f' + (n++) + '.woff2'; total += await get(m[1], path.join(dir, name));
    out += b.replace(m[1], name) + '\n';
  }
  fs.writeFileSync(path.join(dir, 'fonts.css'), out);
  console.log('fonts: ' + n + ' files, ' + mb(total));
  return fs.readdirSync(dir).map(f => 'vendor/fonts/' + f);
}

(async () => {
  mkdir(ROOT);
  const all = [];
  all.push(...await fonts());
  const h2c = path.join(ROOT, 'html2canvas.min.js');
  await get('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', h2c); all.push('vendor/html2canvas.min.js');
  all.push(...wheels());
  all.push(...await pyodide());
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify({ pyodide: PYV, files: all }));
  console.log('done. manifest lists ' + all.length + ' files');
})().catch(e => { console.error(e); process.exit(1); });
