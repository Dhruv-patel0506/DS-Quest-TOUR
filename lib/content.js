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
   otherwise      -> every signed-in user (the safe default while nobody can buy yet: the files are still not public)
   DSQ_FREE_USERS="name1,name2" -> those usernames always get everything, even with gating on (the owner and people the owner gives full access for free) */
const freeUsers = env => new Set(String((env && env.DSQ_FREE_USERS) || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean));
function entitled(u, env) {
  if (!u) return [];
  const all = premium();
  if (!env || env.DSQ_GATING !== 'on' || u.role === 'admin' || freeUsers(env).has(String(u.username || '').toLowerCase())) return all;
  const e = u.ent; if (!e) return [];
  if (e.all && e.until && e.until < Date.now()) { if (!e.mods) return []; return all.filter(id => id in e.mods && (e.mods[id] === 0 || e.mods[id] > Date.now())); }
  if (e.all) return all;
  const now = Date.now(), mods = e.mods || {};
  return all.filter(id => (e.modules || []).includes(id) || (id in mods && (mods[id] === 0 || mods[id] > now)));
}
const isFree = (u, env) => !!u && freeUsers(env).has(String(u.username || '').toLowerCase());
module.exports = { isFree, bundle, premium, notebook, notebookIds, manifest, entitled, available };
