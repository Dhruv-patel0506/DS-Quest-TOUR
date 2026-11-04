'use strict';
/* Loads every Picture Class lesson (public and private) into plain data, the same way tools/verify_picture.js does, and tells which module each belongs to.
   Used by tools/make_rooms.js. Returns { lessons: [ {id, mod, les, group, title, icon, sub, story, setup, steps, quiz, remember, lab, file, priv} ] }. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), JS = path.join(ROOT, 'public', 'js'), PRIV = path.join(ROOT, 'content-private', 'js', 'picture');
module.exports = function loadPic() {
  const ctx = vm.createContext({ console, Math, JSON, Date, Set, Array, Object, Number, String, window: {}, document: {}, picEsc: s => String(s), pjClampLocal: (v, a, b) => Math.max(a, Math.min(b, v)) });
  vm.runInContext('const PIC = { lessons: [], scenes: {} }; PIC.lesson = l => { PIC.lessons.push(l); return l; };', ctx);
  const player = fs.readFileSync(path.join(JS, '42_picture_player.js'), 'utf8'), pm = /PIC\.place = (\{[\s\S]*?\n\});/.exec(player), PLACE = pm ? vm.runInContext('(' + pm[1] + ')', ctx) : {};
  const where = f => (fs.existsSync(path.join(JS, f)) ? [path.join(JS, f), false] : [path.join(PRIV, f), true]);
  const names = [...new Set([...fs.readdirSync(JS), ...(fs.existsSync(PRIV) ? fs.readdirSync(PRIV) : [])])].filter(n => /^\d\d[a-z]?_picture_.*\.js$/.test(n) && !/_scenes\d?\.js$/.test(n) && !/_(picture|player)\.js$/.test(n)).sort();
  /* scene tables some lesson files lean on */
  for (const f of ['34d_picture_scenes3.js', '34e_picture_scenes4.js', '34f_picture_scenes5.js', '34g_picture_scenes6.js', '38_picture_data.js']) { const p = path.join(JS, f); if (fs.existsSync(p)) { try { vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); } catch (e) { } } }
  const out = []; let pre = vm.runInContext('PIC.lessons.length', ctx);
  for (const f of names) {
    const [p, priv] = where(f), n0 = vm.runInContext('PIC.lessons.length', ctx);
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); } catch (e) { console.error('note: ' + f + ' did not load alone: ' + e.message.slice(0, 80)); continue; }
    const all = vm.runInContext('PIC.lessons', ctx); for (let i = n0; i < all.length; i++) { const l = all[i]; if (l.embed) continue; const pl = PLACE[l.id]; out.push(Object.assign({}, l, { mod: pl ? pl[0] : l.mod, les: pl ? pl[1] : l.les, file: f, priv })); }
  }
  return { lessons: out, PLACE };
};
