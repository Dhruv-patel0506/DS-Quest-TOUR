'use strict';
/* node tools/show_outs.js <lesson file> [lesson id ...]: prints every printed output of a lesson file, for reading what --fill wrote */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = vm.createContext({ console, Math, JSON, Set, picEsc: s => s, picSql: r => r.map(x => x.join(' | ')).join('\n') });
vm.runInContext('const PIC = { lessons: [], scenes: {}, math: {} }; PIC.lesson = l => { PIC.lessons.push(l); return l; };', ctx);
['38_picture_data.js', '39_picture_lessons2.js'].forEach(f => { try { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', f), 'utf8').replace(/const picSql[^\n]*\n/, '').replace(/const picHot/, 'var picHot'), ctx); } catch (e) { } });
const n0 = vm.runInContext('PIC.lessons.length', ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', process.argv[2]), 'utf8'), ctx);
const only = process.argv.slice(3);
vm.runInContext('PIC.lessons', ctx).slice(n0).forEach(l => { if (only.length && !only.includes(l.id)) return; l.steps.forEach((s, i) => { if (s.out && !l.sql) console.log(l.id + '#' + (i + 1) + '\n' + s.out + '\n'); }); });
