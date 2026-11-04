'use strict';
/* Lists every file the service worker should keep and stamps a version into public/sw.js.
   Run after changing any file under public/ and before deploying:  node tools/build_sw.js
     shell  = the app itself (small, downloaded on first visit)
     pack   = the Python engine, wheels and notebooks (big, downloaded on first use or by the "Make available offline" button) */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const PUB = path.join(__dirname, '..', 'public');
const walk = (d, o = []) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p, o) : o.push(p); } return o; };
const rel = p => path.relative(PUB, p).split(path.sep).join('/');
const SKIP = new Set(['sw.js', 'precache.json']);
const isPack = r => /^vendor\/(pyodide|wheels)\//.test(r) || /^notebooks\/.+\.ipynb$/.test(r);
const all = walk(PUB).map(p => ({ p, r: rel(p) })).filter(x => !SKIP.has(x.r)).sort((a, b) => a.r.localeCompare(b.r));
const shell = all.filter(x => !isPack(x.r) && !/^demo\/preview\//.test(x.r)), pack = all.filter(x => isPack(x.r) && !/\/files\.json$/.test(x.r));
const hash = crypto.createHash('sha1');
for (const x of shell) { hash.update(x.r); hash.update(fs.readFileSync(x.p)); }
const version = hash.digest('hex').slice(0, 10);
const man = JSON.parse(fs.readFileSync(path.join(PUB, 'vendor', 'manifest.json'), 'utf8'));
const out = { version, pyodide: man.pyodide, shell: ['./', 'precache.json'].concat(shell.map(x => x.r)), pack: pack.map(x => ({ u: x.r, n: fs.statSync(x.p).size })) };
fs.writeFileSync(path.join(PUB, 'precache.json'), JSON.stringify(out));
const swp = path.join(PUB, 'sw.js');
let sw = fs.readFileSync(swp, 'utf8');
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`).replace(/const PACK = '[^']*';/, `const PACK = 'dsq-pack-${man.pyodide}';`);
fs.writeFileSync(swp, sw);
const mb = n => (n / 1048576).toFixed(1) + ' MB';
console.log(`sw version ${version}: shell ${shell.length} files ${mb(shell.reduce((a, x) => a + fs.statSync(x.p).size, 0))}, pack ${pack.length} files ${mb(out.pack.reduce((a, x) => a + x.n, 0))}`);
