'use strict';
/* Where the lesson files are: public/js/content (free) and content-private/js (premium). Shared by the build tools. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DIRS = [path.join(ROOT, 'public', 'js', 'content'), path.join(ROOT, 'content-private', 'js')];
const isModuleFile = f => /^m\d+.*\.js$/.test(f);
/* every module file, free and premium, sorted by name (the load order the app uses) */
function moduleFiles() {
  const out = [];
  for (const d of DIRS) if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (isModuleFile(f)) out.push({ f, p: path.join(d, f), paid: d.includes('content-private') });
  return out.sort((a, b) => a.f.localeCompare(b.f));
}
module.exports = { ROOT, DIRS, moduleFiles, isModuleFile };
