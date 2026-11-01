'use strict';
/* =====================================================================
   Module projects
   - every learner gets a DIFFERENT project variant per module (hash of username + module)
   - the owner/admin account gets the Flagship edition: the premier variant, a bigger dataset and extra milestones
   - dataset: generated from a per-user seed, downloadable, and auto-mounted at data/<file> in the Python sandbox
   - milestones: fill-the-blank exercises with tests (optionally with a Logic Lab gate); each pass is committed to git
   - finish: write the approach in your own words -> solution.py + README + figures + live page, committed
   ===================================================================== */
const Proj = {
  variantFor(mod, user, tier) {
    const vs = mod.project && mod.project.variants || []; if (!vs.length) return null;
    if (tier === 'flagship') return vs.find(v => v.flagship) || vs[0];
    return vs[hash32(String(user).toLowerCase() + ':' + mod.id) % vs.length];
  },
  seedFor: (user, mod, v) => hash32(String(user).toLowerCase() + '|' + mod.id + '|' + v.id + '|data'),
  dataset(mod, v, user, tier) {
    const rng = RNG(Proj.seedFor(user, mod, v)); const csv = v.dataset.gen(rng, tier === 'flagship' ? 'flagship' : 'standard');
    return { path: 'data/' + v.dataset.file, csv };
  },
  milestones(v, tier) { return (v.milestones || []).concat(tier === 'flagship' ? (v.flagship_ms || []) : []); },
  parseCsv(txt, max = 6) {
    const lines = txt.trim().split('\n'); return { cols: lines[0].split(','), rows: lines.slice(1, 1 + max).map(l => l.split(',')), n: lines.length - 1 };
  },
  download(name, text) { const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/csv' })), download: name }); document.body.append(a); a.click(); a.remove(); },
};
DSQ.Proj = Proj;

function projectView(mod, o = {}) {
  const S = DSQ.S, st = S.st, user = S.me.username, tier = S.me.tier, root = h('div', { class: 'stack' });
  let v = Proj.variantFor(mod, user, tier);
  if (!v) { root.append(h('div', { class: 'card pad' }, 'This module has no project yet.')); return root; }
  if (S.me.role === 'admin' && o.variantId) v = mod.project.variants.find(x => x.id === o.variantId) || v;
  const pr = st.proj[mod.id] = st.proj[mod.id] || {}; if (pr.variant !== v.id) { pr.variant = v.id; pr.ms = {}; pr.published = false; }
  const ds = Proj.dataset(mod, v, user, tier), ms = Proj.milestones(v, tier), flag = tier === 'flagship';
  const files = { [ds.path]: ds.csv };
  const code = (upto) => ms.slice(0, upto).map(m => (pr.ms[m.id] && pr.ms[m.id].code) || '').join('\n\n');
  const doneN = () => ms.filter(m => pr.ms[m.id] && pr.ms[m.id].done).length;

  /* ----- header ----- */
  const cp = Proj.parseCsv(ds.csv, 5, v.dataset.header !== false);
  root.append(h('div', { class: 'card pad stack' },
    h('div', { class: 'row' }, h('span', { class: 'chip warn' }, 'Project'), flag ? h('span', { class: 'edition' }, '★ Flagship edition') : h('span', { class: 'chip' }, 'Standard edition'), h('span', { class: 'chip' }, ms.length + ' milestones'), h('span', { class: 'chip' }, '~' + (v.hours || 3) + ' h'), S.me.gitRemote ? h('span', { class: 'chip ok' }, 'git: pushing to ' + S.me.gitRemote.replace('https://', '')) : h('a', { class: 'chip warn', href: '#/profile', style: { textDecoration: 'none' } }, 'git: no repo connected - add yours')),
    h('h2', { style: { font: '700 1.8rem var(--f-body)' } }, v.title),
    h('div', { class: 'prose', html: '<p>' + inl(v.pitch) + '</p><div class="callout ok"><b>Real-world analogue:</b> ' + inl(v.real) + '</div>' + (flag ? '<div class="callout warn"><b>Flagship extras:</b> ' + inl(v.flagship_note || 'a larger dataset, extra milestones, and a case-study report.') + '</div>' : '') }),
    o.otherVariants ? o.otherVariants : null));

  /* ----- dataset ----- */
  root.append(h('div', { class: 'card' }, h('div', { class: 'hd' }, h('span', {}, 'Your dataset'), h('button', { class: 'btn sm', type: 'button', onclick: () => Proj.download(v.dataset.file, ds.csv) }, '↓ Download ' + v.dataset.file)),
    h('div', { class: 'pad stack' },
      h('div', { class: 'prose', html: '<p>' + inl(v.dataset.desc) + ' It is generated from <b>your account\'s</b> seed, so it differs from other learners\' data (same structure, different numbers). Download it to explore in Excel/Jupyter; the in-browser Python already has it mounted at <code>' + ds.path + '</code>.</p>' }),
      h('div', { html: dfHTML(cp.cols, cp.rows.map(r => r.map(x => (x !== '' && !isNaN(+x) ? +x : x)))) }),
      h('p', { class: 'muted', style: { margin: 0, fontSize: '13px' } }, cp.n + ' rows. First 5 shown.'),
      h('table', { class: 't' }, h('tbody', {}, (v.dataset.columns || []).map(c => h('tr', {}, h('td', {}, c[0]), h('td', {}, c[1]))))),
      v.refs && v.refs.length ? h('div', { class: 'prose', html: '<h4>References &amp; where to go deeper</h4><ul>' + v.refs.map(r => '<li>' + inl(r) + '</li>').join('') + '</ul>' }) : null)));

  /* ----- see your data in 3-D / 2-D ----- */
  const exploreHost = h('div', { class: 'card' }, h('div', { class: 'hd' }, h('span', {}, 'Explore your data: 3-D and 2-D (drag to rotate)')));
  const ex = mountViz({ viz: 'dataExplorer', args: { csv: ds.csv, header: v.dataset.header !== false }, caption: '' }); ex.style.border = '0'; ex.style.boxShadow = 'none'; exploreHost.append(ex);
  if (typeof App !== 'undefined') App.dis.push(() => ex._destroy && ex._destroy());
  root.append(exploreHost);

  /* ----- milestones ----- */
  const list = h('div', { class: 'mstones' }), stageEl = h('div'), gitEl = h('div', { class: 'row' });
  let cur = Math.min(doneN(), ms.length - 1);
  const unlocked = i => i === 0 || (pr.ms[ms[i - 1].id] && pr.ms[ms[i - 1].id].done);
  function drawList() {
    list.innerHTML = '';
    ms.forEach((m, i) => list.append(h('button', { class: 'ms' + (pr.ms[m.id] && pr.ms[m.id].done ? ' done' : '') + (i === cur ? ' cur' : '') + (!unlocked(i) ? ' lock' : '') + (m.star ? ' star' : ''), type: 'button', onclick: () => { if (unlocked(i)) { cur = i; drawList(); drawStage(); } } },
      h('span', { class: 'n' }, pr.ms[m.id] && pr.ms[m.id].done ? '✓' : (m.star ? '★' : i + 1)), h('span', {}, m.title))));
  }
  function drawStage() {
    stageEl.innerHTML = ''; if (cur >= ms.length) return; const m = ms[cur], prior = () => code(cur);
    const ex = Object.assign({ est: 240, xp: 25, kind: 'write' }, m, { id: 'p:' + mod.id + ':' + m.id });
    stageEl.append(h('div', { class: 'card pad stack' }, h('h3', { style: { font: '700 1.2rem var(--f-body)' } }, `Milestone ${cur + 1}: ${m.title}`), exerciseBlock(ex, { prelude: prior, files, onPass: async c => {
      pr.ms[m.id] = { done: true, code: c }; S.save(); drawList();
      try {
        const sol = ms.map(x => (pr.ms[x.id] && pr.ms[x.id].code) ? `# --- ${x.title} ---\n${pr.ms[x.id].code}` : '').filter(Boolean).join('\n\n');
        const r = await API.post('/api/project/save', { moduleId: mod.id, variantId: v.id, files: { 'solution.py': sol, [ds.path]: ds.csv }, meta: { milestone: cur + 1, milestoneTitle: m.title } });
        gitEl.innerHTML = ''; gitEl.append(h('span', { class: 'chip ok' }, 'git: committed ' + (r.git.commit || '')), h('span', { class: 'muted', style: { fontSize: '13px' } }, r.git.note));
      } catch (e) { gitEl.innerHTML = '<span class="chip bad">could not save to git: ' + esc(e.message) + '</span>'; }
      if (cur < ms.length - 1) { toast('Milestone done. Next one unlocked.'); const card = stageEl.firstChild; if (card && !$('.next-ms', card)) card.append(h('button', { class: 'btn primary next-ms', type: 'button', onclick: () => { cur++; drawList(); drawStage(); window.scrollTo(0, 0); } }, 'Next milestone ▸')); }
      drawFinish();
    } })));
  }
  root.append(h('div', { class: 'layout2' }, h('div', { class: 'stack' }, h('div', { class: 'card pad stack' }, h('h3', { style: { font: '700 1.1rem var(--f-body)' } }, 'Milestones'), list, gitEl)), stageEl));
  root.querySelector('.layout2').style.gridTemplateColumns = 'minmax(240px,.34fr) minmax(0,1fr)';


  /* ----- ship: one button -> GitHub repo + Vercel site + LinkedIn post ----- */
  function shipCard() {
    const out = h('div', { class: 'stack' }), st = h('div', { class: 'row' }), body = { moduleId: mod.id, variantId: v.id, meta: { skills: [mod.title].concat((mod.syllabus || []).slice(0, 3)) } };
    const go = h('button', { class: 'btn primary', type: 'button' }, '\u{1F680} Ship it: GitHub + Vercel + LinkedIn'.replace('\u{1F680} ', ''));
    const post = h('button', { class: 'btn', type: 'button' }, 'Just make my LinkedIn post');
    const show = r => {
      out.innerHTML = '';
      out.append(h('div', { class: 'stack' }, r.steps.map(x => h('div', { class: 'callout ' + (x.ok ? 'ok' : 'warn') }, h('b', {}, (x.ok ? '\u2713 ' : '\u2717 ') + x.name), x.detail && /^https?:/.test(x.detail) ? h('a', { href: x.detail, target: '_blank', rel: 'noopener' }, x.detail) : x.detail))));
      if (r.linkedin) {
        const ta = h('textarea', { class: 'input', rows: 9 }); ta.value = r.linkedin.text;
        out.append(h('h4', { style: { margin: '6px 0 0' } }, 'Your LinkedIn post'), ta, h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(ta.value); toast('Post copied'); } }, 'Copy text'),
          h('a', { class: 'btn primary', href: 'https://www.linkedin.com/feed/?shareActive=true&text=' + encodeURIComponent(ta.value), target: '_blank', rel: 'noopener' }, 'Open LinkedIn composer'),
          r.linkedin.shareUrl ? h('a', { class: 'btn', href: r.linkedin.shareUrl, target: '_blank', rel: 'noopener' }, 'Share the live link') : null),
          h('p', { class: 'muted', style: { fontSize: '13px', margin: 0 } }, 'LinkedIn does not allow apps to post for you without an approved developer app, so the composer opens with your text filled in - you press Post.'));
      }
    };
    go.addEventListener('click', async () => { go.disabled = true; out.innerHTML = '<p class="muted">Shipping... (this can take a minute: git, GitHub, Vercel build)</p>'; try { show(await API.post('/api/ship', body)); S.badge('first-project'); } catch (e) { out.innerHTML = '<div class="callout warn">' + esc(e.message) + '</div>'; } go.disabled = false; });
    post.addEventListener('click', async () => { try { show(await API.post('/api/linkedin', body).then(r => ({ steps: [], linkedin: r.linkedin }))); } catch (e) { out.innerHTML = '<div class="callout warn">' + esc(e.message) + '</div>'; } });
    if (API.local) { go.hidden = true; st.append(h('span', { class: 'chip warn' }, 'browser mode: LinkedIn post + download only')); }
    else API.get('/api/ship/status').then(r => { if (r.hosted) { st.append(h('span', { class: 'chip ok' }, 'public page: ready'), h('span', { class: 'chip ' + (r.github.token && r.github.remoteConfigured ? 'ok' : 'warn') }, 'GitHub: ' + (r.github.token && r.github.remoteConfigured ? 'repo + token set' : 'add a repo + token in Profile')), h('span', { class: 'chip ' + (r.vercel.token ? 'ok' : 'warn') }, 'Your Vercel: ' + (r.vercel.token ? 'token set' : 'add a token in Profile')), h('a', { href: '#/profile', class: 'chip' }, 'set up in Profile')); return; } st.append(h('span', { class: 'chip ' + (r.owner ? 'ok' : '') }, r.owner ? 'owner: one-button ship enabled' : 'learner: LinkedIn post only'), h('span', { class: 'chip ' + (r.github.token || r.github.remoteConfigured ? 'ok' : 'warn') }, 'GitHub: ' + (r.github.token ? 'token set' : r.github.remoteConfigured ? 'remote set' : 'needs GITHUB_TOKEN')), h('span', { class: 'chip ' + (r.vercel.user ? 'ok' : 'warn') }, 'Vercel: ' + (r.vercel.user ? 'logged in as ' + r.vercel.user : r.vercel.installed ? 'run vercel login' : 'CLI missing'))); if (!r.owner) go.disabled = true; }).catch(() => { });
    return h('div', { class: 'card pad stack' }, h('h3', { style: { font: '700 1.3rem var(--f-body)' } }, 'Ship it'), h('p', { class: 'prose', style: { margin: 0 } }, 'One click: your project becomes its own GitHub repo, is deployed to Vercel as a live website, and a LinkedIn post is written for you with the links, skills and hashtags.'), st, h('div', { class: 'row' }, go, post, API.local ? h('button', { class: 'btn', type: 'button', onclick: () => { const p = (S.me && JSON.parse(localStorage.getItem('dsq.local.v1') || '{}').users || {}); const u = p[(S.me.username || '').toLowerCase()] || {}, pr = (u.projects || {})[mod.id + '-' + v.id] || {}; const txt = '# ' + (v.title) + '\n\n' + v.pitch + '\n\n## My approach\n\n' + ((pr.meta && pr.meta.logic) || '') + '\n\n## Code\n\n```python\n' + ((pr.files && pr.files['solution.py']) || '') + '\n```\n'; DSQ.Proj.download((mod.id + '-' + v.id) + '.md', txt); } }, 'Download my project (.md)') : null), out);
  }

  /* ----- finish & publish ----- */
  const fin = h('div');
  function drawFinish() {
    fin.innerHTML = ''; if (doneN() < ms.length) return;
    const approach = h('textarea', { class: 'input', rows: 5, placeholder: 'In your own words: what question did you ask, how did you solve it, what did you learn? (at least 30 words)' }); approach.value = pr.approach || '';
    const msg = h('div'); const btn = h('button', { class: 'btn ok', type: 'button' }, pr.published ? 'Publish again (new commit)' : 'Finish and publish my project');
    btn.addEventListener('click', async () => {
      const words = approach.value.trim().split(/\s+/).filter(Boolean).length; if (words < 30) { msg.innerHTML = '<div class="callout warn">Write at least 30 words about your approach (you wrote ' + words + ').</div>'; return; }
      pr.approach = approach.value; btn.disabled = true; msg.innerHTML = '<p class="muted">Running your whole solution once to collect the charts...</p>';
      const sol = ms.map(x => `# --- ${x.title} ---\n${pr.ms[x.id].code}`).join('\n\n');
      const res = await Py.run({ code: ms.map(x => pr.ms[x.id].code).join('\n\n'), files, timeout: 60000 });
      if (res.error) { msg.innerHTML = '<div class="callout warn">Your combined solution raised an error: ' + esc(fmtErr(res.error)) + '</div>'; btn.disabled = false; return; }
      const images = {}; (res.figs || []).forEach((b, i) => { images['figure-' + (i + 1)] = 'data:image/png;base64,' + b; });
      try {
        const r = await API.post('/api/project/publish', { moduleId: mod.id, variantId: v.id, files: { 'solution.py': sol, [ds.path]: ds.csv }, images,
          meta: { title: v.title, module: mod.title, skills: [mod.title].concat((mod.syllabus || []).slice(0, 3)), pitch: v.pitch, dataset: v.dataset.file + ' (' + cp.n + ' rows)', edition: flag ? 'Flagship edition' : 'Standard edition', logic: approach.value, output: res.stdout, milestones: ms.map(x => x.title) } });
        pr.published = true; pr.live = r.live; S.projects[mod.id + '-' + v.id] = { live: r.live }; S.badge('first-project'); S.award(flag ? 150 : 100, 'Project published'); confetti(220); S.save();
        const oldShip = $('.ship-wrap', fin); if (oldShip) oldShip.remove(); fin.append(h('div', { class: 'ship-wrap' }, shipCard()));
        msg.innerHTML = ''; msg.append(h('div', { class: 'callout ok' }, h('b', {}, r.live ? 'Your project is live. ' : 'Your project is saved in this browser. '), 'Git: ' + (r.git.committed ? 'committed ' + (r.git.commit || '') : 'not committed') + ' - ' + r.git.note + '. ', r.live ? [h('a', { href: r.live, target: '_blank', rel: 'noopener' }, 'Open the live page'), ' (also saved as README.md + solution.py in workspace/' + user.toLowerCase() + ').'] : null));
      } catch (e) { msg.innerHTML = '<div class="callout warn">Could not publish: ' + esc(e.message) + '</div>'; }
      btn.disabled = false;
    });
    fin.append(h('div', { class: 'card pad stack' }, h('h3', { style: { font: '700 1.3rem var(--f-body)' } }, 'All milestones done - ship it'), h('p', { class: 'prose' }, 'Describe your approach, then publish. DS Quest runs your complete solution, saves the code, data, charts and a README into your own git repository, commits it, and opens a live page you can put on your resume.' + (flag ? ' (Flagship case-study page.)' : '')), approach, h('div', { class: 'row' }, btn), msg));
    if (pr.published) fin.append(h('div', { class: 'ship-wrap' }, shipCard()));
  }
  root.append(fin);
  drawList(); drawStage(); drawFinish();
  return root;
}
DSQ.projectView = projectView;
