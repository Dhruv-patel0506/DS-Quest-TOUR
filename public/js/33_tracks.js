'use strict';
/* =====================================================================
   Curriculum tracks: the same modules, grouped into separate curricula so a learner of content creation or business analytics does not walk through deep learning.
   "Everything" keeps the full original catalogue. A track picks and orders modules; the grade gate follows the track order.
   ===================================================================== */
DSQ.tracks = [
  { id: 'all', title: 'Everything', blurb: 'The complete catalogue, in the original order. Every module is taught for systems that run in the real world.' },
  { id: 'ds', title: 'Production-ready AI (data science and AI)', blurb: 'Build AI systems that work in the real world: start with the data (the flagship module, most of the real work), then models, LLMs, RAG and agents, and finish by shipping, monitoring and defending a system.',
    ids: ['python', 'numpy', 'pandas', 'eda', 'matplotlib', 'sql', 'stats', 'linalg', 'mlcore', 'ts', 'causal', 'uncertainty', 'nn', 'pytorch', 'cnn', 'nlp', 'tokens', 'genai', 'genmodels', 'multimodal', 'vectordb', 'rag', 'llmapps', 'agents', 'finetune', 'rl', 'inference', 'evals', 'respai', 'mlops', 'capstone'] },
  { id: 'aieng', title: 'AI engineering: GenAI, RAG, agents and LLMOps', blurb: 'The path for building products on language models: Python and SQL, tokens and generative foundations, embeddings and vector databases, RAG, LLM applications, agents, evaluation and guardrails, then APIs, containers and MLOps to ship them. Finish with the skills map and a portfolio project.',
    ids: ['python', 'numpy', 'pandas', 'sql', 'tokens', 'genai', 'vectordb', 'rag', 'llmapps', 'agents', 'evals', 'fastapi', 'django', 'docker', 'mlops', 'respai', 'inference', 'finetune', 'industry', 'capstone'] },
  { id: 'analytics', title: 'Data analytics for business', blurb: 'The analyst path, for decisions in the real world: SQL, pandas, cleaning data you can trust, KPIs, funnels, experiments and dashboards. No deep learning needed.',
    ids: ['python', 'sql', 'pandas', 'eda', 'matplotlib', 'stats', 'analytics', 'marketing', 'experiments', 'ts', 'dataapps', 'scraping'] },
  { id: 'creator', title: 'Content, freelancing and product', blurb: 'Turn data skills into work: content for data people, product and UI thinking, pricing, a portfolio and clients.',
    ids: ['content', 'copywriting', 'marketing', 'uiux', 'dataapps', 'freelance'] },
  { id: 'marketing', title: 'Digital marketing and copywriting', blurb: 'Grow an audience and a business with numbers you can defend: funnels and budgets, A/B tests, email, SEO and attribution, plus copy that is clear and tested.',
    ids: ['marketing', 'copywriting', 'content', 'analytics', 'experiments', 'freelance'] },
  { id: 'web', title: 'Web development', blurb: 'Build and ship pages and apps: HTML, CSS and JavaScript in a live editor, then APIs, Django, data apps, design and deployment.',
    ids: ['web', 'webapi', 'fastapi', 'django', 'dataapps', 'uiux', 'docker', 'devops'] },
  { id: 'eng', title: 'Engineering and deployment', blurb: 'Make it run in production: APIs, Django, Docker and Git, pipelines, DevOps, system design and MLOps. The skills that keep an AI system up.',
    ids: ['python', 'webapi', 'fastapi', 'django', 'docker', 'pipelines', 'devops', 'sysdesign', 'mlops'] },
];
const trackOf = () => { const id = (S.st && S.st.track) || 'all'; return DSQ.tracks.find(t => t.id === id) || DSQ.tracks[0]; };
/* the modules of the chosen track, in the track's own order (all modules, original order, for "Everything") */
function visibleMods() { const t = trackOf(); if (!t.ids) return App.mods; return t.ids.map(id => App.mods.find(m => m.id === id)).filter(Boolean); }
const trackHeading = () => (trackOf().id === 'all' ? 'Build production-ready AI systems' : trackOf().title);
/* what this product is for, stated once and shown where learners choose a path */
function uvpCard() {
  const pil = (n, t, d) => h('div', { class: 'uvp-pil' }, h('span', { class: 'uvp-n' }, n), h('div', {}, h('b', {}, t), h('p', {}, d)));
  return h('div', { class: 'card pad uvp' }, h('div', { class: 'eyebrow' }, 'What you are here to do'), h('h3', {}, 'Not just data science: build production-ready AI systems that operate in the real world.'),
    h('p', { class: 'muted', style: { margin: 0 } }, 'Practical skills over theory. Every module asks what it takes to run for real, with messy data, users, costs and failures.'),
    h('div', { class: 'uvp-grid' }, pil('1', 'Data you can trust', 'Most real work is reading, cleaning and validating data. This is the flagship module.'), pil('2', 'Models that hold up', 'Baselines, honest evaluation, uncertainty and failure modes before accuracy claims.'), pil('3', 'Systems that ship and stay up', 'APIs, containers, pipelines, monitoring and the design numbers behind them.')));
}
function trackBar() {
  const cur = trackOf(), count = t => (t.ids ? t.ids.length : App.mods.length);
  return h('div', { class: 'card pad stack', style: { gap: '10px' } },
    h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'wrap' } }, h('h3', { style: { margin: 0 } }, 'Choose your curriculum'), h('span', { class: 'muted', style: { fontSize: '13px' } }, 'Modules can appear in more than one track; your progress is shared.')),
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' }, role: 'tablist' }, DSQ.tracks.map(t => h('button', { type: 'button', role: 'tab', 'aria-selected': t.id === cur.id ? 'true' : 'false', class: 'btn' + (t.id === cur.id ? ' primary' : ''), onclick: () => { S.st.track = t.id; S.save(); route(); } }, t.title + ' (' + count(t) + ')'))),
    h('p', { class: 'muted', style: { margin: 0 } }, cur.blurb));
}
