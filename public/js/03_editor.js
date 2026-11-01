'use strict';
/* =====================================================================
   Code editor widget: textarea over a highlighted <pre>, line numbers, Tab / Shift-Tab,
   auto-indent, bracket pairing, jump between ___ blanks, function-bank insertion.
   Editor(parent, {code, readOnly, minLines, onChange, onRun}) -> {el, get, set, insert, focus}
   ===================================================================== */
function Editor(parent, o = {}) {
  const ta = h('textarea', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off', 'aria-label': 'Python code editor' });
  const pre = h('pre', { 'aria-hidden': 'true' });
  const gut = h('div', { class: 'gut' });
  const wrap = h('div', { class: 'wrap' }, pre, ta);
  const el = h('div', { class: 'ed' + (o.readOnly ? ' ro' : '') }, gut, wrap);
  parent.append(el);
  if (o.readOnly) ta.readOnly = true;
  const minLines = o.minLines || 6;

  function paint() {
    const v = ta.value, n = Math.max(minLines, v.split('\n').length + (o.readOnly ? 0 : 1));
    pre.innerHTML = hlPy(v) + '\n';
    gut.textContent = range(n).map(i => i + 1).join('\n');
    ta.style.height = (n * 21.45 + 24) + 'px'; pre.style.height = ta.style.height;
  }
  const api = {
    el, ta,
    get: () => ta.value,
    set(v) { ta.value = v; paint(); },
    focus() { ta.focus(); },
    blanks: () => (ta.value.match(/\b___\b/g) || []).length,
    /* put text into the current blank (selected or the first one at/after caret), else at caret */
    insert(txt) {
      let v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
      if (v.slice(s, e) !== '___') {
        const re = /\b___\b/g; let m, hit = null;
        while ((m = re.exec(v))) { if (m.index >= e) { hit = m; break; } }
        if (!hit) { re.lastIndex = 0; hit = re.exec(v); }
        if (hit) { s = hit.index; e = s + 3; }
      }
      ta.value = v.slice(0, s) + txt + v.slice(e);
      const np = s + txt.length; ta.selectionStart = ta.selectionEnd = np; paint(); ta.focus();
      o.onChange && o.onChange(ta.value);
    },
  };
  ta.addEventListener('input', () => { paint(); o.onChange && o.onChange(ta.value); });
  ta.addEventListener('scroll', () => { pre.scrollLeft = ta.scrollLeft; });
  ta.addEventListener('keydown', e => {
    if (o.readOnly) return;
    const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); o.onRun && o.onRun(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const lineStart = v.lastIndexOf('\n', s - 1) + 1;
      if (!e.shiftKey && s === en) {                       // jump to next blank if there is one after the caret
        const re = /\b___\b/g; re.lastIndex = en; const m = re.exec(v) || (re.lastIndex = 0, re.exec(v));
        if (m && /\b___\b/.test(v)) { ta.setSelectionRange(m.index, m.index + 3); return; }
      }
      if (s !== en || e.shiftKey) {                         // indent / dedent selected lines
        const endLine = v.indexOf('\n', en) < 0 ? v.length : v.indexOf('\n', en);
        const block = v.slice(lineStart, endLine).split('\n');
        const nb = block.map(l => e.shiftKey ? l.replace(/^( {1,4}|\t)/, '') : '    ' + l).join('\n');
        ta.value = v.slice(0, lineStart) + nb + v.slice(endLine); ta.setSelectionRange(lineStart, lineStart + nb.length);
      } else { ta.value = v.slice(0, s) + '    ' + v.slice(en); ta.selectionStart = ta.selectionEnd = s + 4; }
      paint(); o.onChange && o.onChange(ta.value); return;
    }
    if (e.key === 'Enter' && e.shiftKey && o.onRunNext) { e.preventDefault(); o.onRunNext(); return; }
    if (e.key === 'Enter' && !e.ctrlKey) {
      const ls = v.lastIndexOf('\n', s - 1) + 1, line = v.slice(ls, s), ind = /^\s*/.exec(line)[0];
      const extra = /[:\[({]\s*$/.test(line.replace(/#.*$/, '')) ? '    ' : '';
      e.preventDefault(); const ins = '\n' + ind + extra;
      ta.value = v.slice(0, s) + ins + v.slice(en); ta.selectionStart = ta.selectionEnd = s + ins.length; paint(); o.onChange && o.onChange(ta.value); return;
    }
    const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
    if (pairs[e.key] && s === en) {
      const nx = v[s];
      if ((e.key === '"' || e.key === "'") && (nx === e.key || /\w/.test(v[s - 1] || ''))) return;
      if (nx && /\w/.test(nx)) return;
      e.preventDefault(); ta.value = v.slice(0, s) + e.key + pairs[e.key] + v.slice(en); ta.selectionStart = ta.selectionEnd = s + 1; paint(); o.onChange && o.onChange(ta.value); return;
    }
    if ([')', ']', '}', '"', "'"].includes(e.key) && s === en && v[s] === e.key) { e.preventDefault(); ta.selectionStart = ta.selectionEnd = s + 1; return; }
    if (e.key === 'Backspace' && s === en && s > 0 && pairs[v[s - 1]] === v[s]) { e.preventDefault(); ta.value = v.slice(0, s - 1) + v.slice(s + 1); ta.selectionStart = ta.selectionEnd = s - 1; paint(); o.onChange && o.onChange(ta.value); }
  });
  api.set(o.code || '');
  return api;
}
DSQ.Editor = Editor;

/* static highlighted code block */
const codeBlock = src => h('pre', { class: 'codeblock', html: hlPy(src) });
