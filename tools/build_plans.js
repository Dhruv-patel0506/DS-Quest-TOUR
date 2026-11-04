'use strict';
/* Writes plans.default.json: the PACKAGES the server can sell, one per curriculum track (public/js/33_tracks.js), listing the paid modules each one opens.
   Prices are NOT here: the server prices a package as DSQ_PACKAGE_RATIO (default 0.5) of the all-access price, or exactly as the owner says in DSQ_PLANS.
     node tools/build_plans.js        (after changing the tracks or the free/premium list) */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = vm.createContext({ DSQ: {}, console, S: { st: {} }, App: { mods: [] }, h: () => null });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'js', '33_tracks.js'), 'utf8'), ctx, { filename: '33_tracks.js' });
const premium = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'content-manifest.json'), 'utf8')).premium);
const plans = ctx.DSQ.tracks.filter(t => t.id !== 'all' && t.ids).map(t => ({ id: t.id, name: t.title.replace(/\s*\(.*\)\s*$/, '') + ' package', blurb: t.blurb, modules: t.ids.filter(id => premium.has(id)) })).filter(p => p.modules.length >= 2);
fs.writeFileSync(path.join(ROOT, 'plans.default.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), plans }, null, 1));
console.log('packages: ' + plans.map(p => p.id + ' (' + p.modules.length + ' paid modules)').join(', '));
