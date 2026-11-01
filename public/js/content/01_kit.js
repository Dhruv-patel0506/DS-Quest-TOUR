'use strict';
/* =====================================================================
   Content kit: tiny constructors so lesson files read like a book outline.
   A lesson is {id,title,minutes,blurb,pages:[...]} ; page types:
     RD(heading, html)                       read
     VZ(heading, vizName, args, caption, html)  interactive visual
     DM(heading, code, html, {live})         runnable, editable demo
     EX({...})                               graded exercise (blanks / write / debug) with tests
     QZ(tag, items, heading)                 multiple choice (static or generated)
     TY({id,title,code,goal})                typing sprint
   ===================================================================== */
const RD = (h, html) => ({ t: 'read', h, html });
const VZ = (h, viz, args, caption, html) => ({ t: 'viz', h, viz, args: args || {}, caption, html });
const DM = (h, code, html, o) => Object.assign({ t: 'demo', h, code, html }, o || {});
const EX = ex => ({ t: 'ex', ex });
const QZ = (tag, items, h) => ({ t: 'quiz', tag, items, h });
const TY = snip => ({ t: 'type', snip });
const NOTE = (kind, title, html) => `<div class="callout ${kind || ''}"><b>${title}</b> ${html}</div>`;
const TABLE = (head, rows) => `<table class="t"><thead><tr>${head.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const UL = items => '<ul>' + items.map(x => `<li>${x}</li>`).join('') + '</ul>';
/* shuffled-distractor helper for generated quizzes: unique, never equal to the answer */
const distract = (ans, cands) => [...new Set(cands.map(String))].filter(x => x !== String(ans));
/* tuple printer for generated shape questions */
const tup = a => '(' + a.join(', ') + (a.length === 1 ? ',' : '') + ')';

/* terminal exercise (Git, Docker, shell): the learner types real commands into an in-browser sandbox; goals are checked on its state */
const TERM = ex => ({ t: 'term', ex });
/* the same exercise as a plain Python case, so tools can verify "the solution reaches every goal and the starter does not" */
const termCase = (ex, withSolution) => {
  const q = JSON.stringify;
  const code = 'from dsq_shell import Shell\nsh = Shell(' + q(ex.files || {}) + ', ' + q(ex.cwd || '/home/learner') + ')\nfor _c in ' + q(ex.setup || []) + ':\n    sh.run(_c)\nsh.history.clear()\nfor _c in ' + q(withSolution ? ex.solution : []) + ':\n    sh.run(_c)\n';
  const tests = 'ns = {"sh": sh, "git": sh.git, "docker": sh.docker, "files": sh.files}\n' + ex.goals.map(g => 'check(bool(eval(' + q(g.test) + ', ns)), ' + q(g.label) + ', ' + q(g.hint || '') + ')').join('\n');
  return { code, tests };
};

/* ---------------------------------------------------------------------
   Function sheets: every function of a module, in the order you meet them, each explained in plain words with a runnable line.
     DSQ.defSheet('numpy', { title, intro, sections: [ SEC(id, title, intro, [ FN(...), ... ], setupCode) ] })
     FN(signature, plainWords, code, watchOut?, spreadsheetEquivalent?, parts?)   parts = [['np', 'what it is'], ...] explains the pieces of the line
   Each section is self-contained (its setup code runs first); the items inside it build on each other like notebook cells. tools/verify.js runs every section in a clean Python.
   --------------------------------------------------------------------- */
DSQ.sheets = DSQ.sheets || {};
DSQ.defSheet = (id, sheet) => { DSQ.sheets[id] = sheet; const m = (DSQ.modules || []).find(x => x.id === id); if (m) m.sheet = sheet; return sheet; };
const SEC = (id, title, intro, items, setup) => ({ id, title, intro, items, setup: setup || '' });
const FN = (fn, plain, code, watch, excel, parts) => ({ fn, plain, code, watch: watch || '', excel: excel || '', parts: parts || [] });
