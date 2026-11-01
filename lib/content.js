'use strict';
/* Paid lesson files. They live OUTSIDE public/ (content-private/), so a URL cannot fetch them; the API hands them to signed-in, entitled users.
   content-manifest.json (written by tools/split_content.js) says which files and notebooks are premium and which module ids they hold.
   Shared by the hosted API (lib/hosted.js) and the local server (server.js). */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PRIV = path.join(ROOT, 'content-private');
let M = null; const cache = new Map();
const manifest = () => (M = M || JSON.parse(fs.readFileSync(path.join(ROOT, 'content-manifest.json'), 'utf8')));
const read = rel => { if (!cache.has(rel)) cache.set(rel, fs.readFileSync(path.join(PRIV, rel), 'utf8')); return cache.get(rel); };

/* entitled: array of module ids this user may open. Returns the premium script files whose modules are ALL entitled, in load order. */
function bundle(entitled) {
  const ok = new Set(entitled), files = [];
  for (const f of manifest().files) if (f.paid && f.modules.every(id => ok.has(id))) files.push({ n: f.f, src: read('js/' + f.f) });
  return { files, modules: manifest().premium.filter(id => ok.has(id)) };
}
const premium = () => manifest().premium.slice();
/* notebook file names such as "rag.ipynb" / "rag-blank.ipynb"; returns {id, text} or null when the name is unknown */
function notebook(name) {
  const m = /^([a-z0-9]+)(-blank)?\.ipynb$/.exec(String(name || '')); if (!m) return null;
  if (!manifest().notebooks.includes(m[1])) return null;
  try { return { id: m[1], text: read('notebooks/' + m[0]) }; } catch (e) { return null; }
}
const notebookIds = () => manifest().notebooks.slice();
/* how many premium files can this deployment actually read? (a deploy health check; no content is revealed) */
const available = () => manifest().files.filter(f => f.paid && fs.existsSync(path.join(PRIV, 'js', f.f))).length;
/* Which premium modules may this user open?
   DSQ_GATING=on  -> only the owner (role admin) and users whose record has ent = { all: true | modules: [...], until: ms-timestamp }
   otherwise      -> every signed-in user (the safe default while nobody can buy yet: the files are still not public) */
function entitled(u, env) {
  if (!u) return [];
  const all = premium();
  if (!env || env.DSQ_GATING !== 'on' || u.role === 'admin') return all;
  const e = u.ent; if (!e || (e.until && e.until < Date.now())) return [];
  return e.all ? all : all.filter(id => (e.modules || []).includes(id));
}
module.exports = { bundle, premium, notebook, notebookIds, manifest, entitled, available };
