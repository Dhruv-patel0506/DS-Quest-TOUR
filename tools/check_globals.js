'use strict';
/* node tools/check_globals.js
   Every classic <script> shares one global scope, so two files that both write `const NAME = ...` at the top level break the second one with
   "Identifier 'NAME' has already been declared" (and nothing in it runs). This lists every top-level name declared in more than one file under
   public/js and content-private/js. Run it after adding a script. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), files = [], walk = d => { if (!fs.existsSync(d)) return; fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.js$/.test(e.name)) files.push(p); }); };
walk(path.join(root, 'public', 'js')); walk(path.join(root, 'content-private'));
const seen = {}, kinds = {};
files.forEach(f => fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l, i) => { const m = l.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/) || l.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/); if (m) { const isVar = /^var\s/.test(l); (seen[m[1]] = seen[m[1]] || []).push(path.relative(root, f).split(path.sep).join('/') + ':' + (i + 1)); (kinds[m[1]] = kinds[m[1]] || []).push(isVar); } }));
const dup = Object.entries(seen).filter(([k, v]) => v.length > 1 && !kinds[k].every(Boolean)); /* the same name declared with var in both halves of a split file (tools/split_picture.js) is allowed */
console.log(dup.length ? dup.length + ' name(s) declared in more than one file:' : 'no top-level name is declared twice');
dup.forEach(([k, v]) => console.log('  ' + k + ' -> ' + v.join('   ')));
process.exit(dup.length ? 1 : 0);
