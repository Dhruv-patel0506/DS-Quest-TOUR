'use strict';
/* Checks the fill-in-the-blank generator on every exercise: blanks appear, answers restore the solution, no repeats, bank has the answers. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..', 'public', 'js');
const ctx = vm.createContext({ console, global: null, setTimeout, clearTimeout, Math, JSON, Date }); ctx.global = ctx;
const load = f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
['00_util.js', '02_py.js'].forEach(f => load(path.join(root, f)));
['01_kit.js', '02_datasets.js', '00_roadmap.js'].forEach(f => load(path.join(root, 'content', f)));
require('./_content').moduleFiles().forEach(x => load(x.p));
load(path.join(root, '13_practice.js'));
const PRAC = vm.runInContext('PRAC', ctx), RNG = vm.runInContext('RNG', ctx), DSQ = ctx.DSQ;
let n = 0, skipped = 0, bad = 0, distinct = 0, sample = null;
for (const m of DSQ.modules) for (const L of m.lessons || []) for (const p of L.pages) if (p.t === 'ex') {
  const ex = p.ex; if (!ex.solution || (ex.files && Object.keys(ex.files).length)) { skipped++; continue; }
  const C = PRAC.candidates(ex.solution); if (C.length < 3) { skipped++; continue; }
  const seen = [], rng = RNG(12345 + n), sets = new Set();
  for (let r = 0; r < 6; r++) {
    const q = PRAC.make(ex, rng, seen); n++; if (!q) { bad++; console.log('no question', ex.id); continue; } seen.push(q.key); sets.add(q.key);
    const blanks = (q.ex.starter.match(/___/g) || []).length;
    let restored = q.ex.starter, ans = []; const cs = C.filter(c => q.key.split(',').includes(String(c.i))).sort((a, b) => a.i - b.i);
    cs.forEach(c => ans.push(c.s)); restored = q.ex.starter.replace(/___/g, () => ans.shift());
    if (blanks < 2 || blanks > 7 || restored !== ex.solution) { bad++; console.log('BAD restore', ex.id, blanks); }
    if (!cs.every(c => q.ex.bank.includes(c.s))) { bad++; console.log('answer missing from bank', ex.id); }
    if (!sample && ex.id === 'np-9-1') sample = q;
  }
  distinct += sets.size;
}
console.log('questions generated:', n, 'exercises skipped (files/too few blankable tokens):', skipped, 'problems:', bad, 'distinct blank sets per 6 draws (avg):', (distinct / (n / 6)).toFixed(1));
if (sample) console.log('\nSAMPLE starter:\n' + sample.ex.starter + '\nbank: ' + sample.ex.bank.join('  '));
process.exit(bad ? 1 : 0);
