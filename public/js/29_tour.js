'use strict';
/* =====================================================================
   Showcase tour (#/tour): anyone can walk through the whole app as if they owned everything, without an account.
   - a demo visitor account (nothing is saved anywhere, no request reaches the real API)
   - every module is open; the premium ones are loaded from public/demo/modules.json, an EXCERPT built by tools/build_demo.js
     (first paragraph of each reading, exercise question + skeleton, no solutions or tests, one quiz question per quiz)
   - a bar at the bottom (Guide / Create account / Exit) and a short guided path through the best parts
   ===================================================================== */
const TOUR_KEY = 'dsq.tour';
const tourWanted = () => { try { return /^#\/tour/.test(location.hash) || sessionStorage.getItem(TOUR_KEY) === '1'; } catch (e) { return /^#\/tour/.test(location.hash); } };
const DEMO = (() => {
  const err = (m, s) => { const e = new Error(m); e.status = s || 404; return e; };
  const user = { username: 'visitor', display: 'Visitor', role: 'learner', tier: 'standard', gitRemote: '', hasToken: false, linkedin: '', email: '', hasEmail: false };
  async function handle(method, url) {
    const route = method + ' ' + url.split('?')[0];
    if (route === 'GET /api/me') return { user, state: null, projects: {}, judge: false, nb: [] };
    if (route === 'PUT /api/progress') return { ok: true };
    if (route === 'POST /api/logout') { DSQ.exitTour(); return { ok: true }; }
    if (route === 'GET /api/leaderboard') return { rows: [{ display: 'Visitor (tour)', xp: 0, level: 1, me: true }], local: true };
    if (route === 'GET /api/llm/status') return { providers: [], ready: false };
    if (route === 'POST /api/llm/ask' || route === 'POST /api/ask' || route === 'POST /api/judge') return { available: false, trail: [], hint: 'The AI tutor is part of the full course.' };
    if (route === 'GET /api/ship/status') return { owner: false, local: true, github: { token: false, remoteConfigured: false }, vercel: { loggedIn: false } };
    throw err('This is part of the full course, not the tour.');
  }
  return { handle };
})();
if (tourWanted()) API.demo = true;

DSQ.tour = { on: !!API.demo };
DSQ.startTour = at => { try { sessionStorage.setItem(TOUR_KEY, '1'); } catch (e) { } location.hash = typeof at === 'string' && /^#\//.test(at) ? at : '#/'; location.reload(); };
DSQ.exitTour = () => { try { sessionStorage.removeItem(TOUR_KEY); } catch (e) { } location.hash = '#/'; location.reload(); };

/* the premium modules, as an excerpt */
DSQ.loadDemoModules = async function () {
  try {
    const j = await (await fetch('demo/modules.json')).json();
    for (const m of j.modules) if (!DSQ.modules.some(x => x.id === m.id)) DSQ.modules.push(m);
    DSQ.premium.loaded = true; return true;
  } catch (e) { toast('The tour could not load its content. Check the connection and reload.'); return false; }
};

const TOUR_STEPS = [
  { href: '#/welcome', t: 'Every curriculum, with a tour of each', d: 'Pick a curriculum, watch an animated lesson and try a study room from every module, then decide. Packages and prices are on the same page.' },
  { href: '#/', t: 'The curriculum', d: 'Forty-two modules in nine phases, from Python to RAG, agents, diffusion models and causal inference. In the real course each one ends with an assessment and a project.' },
  { href: '#/m/rag', t: 'A module', d: 'Outcomes, lessons with time estimates, a module assessment, a project and practice notebooks. This tour shows an excerpt of each lesson.' },
  { href: '#/l/python/basics', t: 'A lesson', d: 'Short pages: reading, a diagram or 3-D view, a worked demo, an exercise, a quiz and a typing sprint. Press Continue to reach the exercise on page 3.' },
  { href: '#/explore/diffusion', t: 'Diagram + 3-D hologram', d: 'Every big idea comes as a diagram and a 3-D model you can turn, zoom and step through. Press Tour.' },
  { href: '#/explore/kmeans', t: 'An algorithm in motion', d: 'Watch k-means, gradient descent, DBSCAN, Dijkstra and more run step by step, with the code highlighted beside them.' },
  { href: '#/explore/brain', t: 'Inside a neuron', d: 'Real simulations: a spiking neuron, ion channels, synapses and a brain map, all running in your browser.' },
  { href: '#/sheet/numpy', t: 'Function sheets: every function explained', d: 'For each topic, every function in the order you meet it: what it does in plain words, the pieces of the line named, a line you can run and change, and the mistake to avoid. Built for people who have never coded.' },
  { href: '#/notebook', t: 'A notebook with live Python', d: 'Python runs inside the page (numpy, pandas, scikit-learn, matplotlib). Nothing is installed and nothing is sent anywhere.' },
  { href: '#/offline', t: 'Works without internet', d: 'Save the Python engine once and keep learning on a plane. On a phone, "Add to home screen" turns it into an app.' },
];
DSQ.tourSteps = TOUR_STEPS;

DSQ.mountTour = function () {
  if (!DSQ.tour.on || document.getElementById('tourbar')) return;
  document.body.classList.add('tour');
  let step = Math.max(0, TOUR_STEPS.findIndex(s => s.href === location.hash || (location.hash === '' && s.href === '#/')));
  const card = h('div', { id: 'tourcard', hidden: true });
  const paint = () => {
    const s = TOUR_STEPS[step];
    card.replaceChildren(h('div', { class: 'tc-n' }, 'Step ' + (step + 1) + ' of ' + TOUR_STEPS.length), h('h4', {}, s.t), h('p', {}, s.d),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', disabled: step === 0, onclick: () => go(step - 1) }, 'Back'),
        h('button', { class: 'btn sm primary', type: 'button', onclick: () => go(step + 1 < TOUR_STEPS.length ? step + 1 : 0) }, step + 1 < TOUR_STEPS.length ? 'Next' : 'Start over'),
        h('button', { class: 'btn sm', type: 'button', onclick: () => { card.hidden = true; } }, 'Hide')));
  };
  const go = i => { step = Math.max(0, Math.min(TOUR_STEPS.length - 1, i)); paint(); location.hash = TOUR_STEPS[step].href; card.hidden = false; };
  const bar = h('div', { id: 'tourbar' }, h('span', { class: 'tb-t' }, h('b', {}, 'Showcase tour'), ' an excerpt of the full course'),
    h('span', { class: 'grow' }),
    h('button', { class: 'btn sm', type: 'button', onclick: () => { paint(); card.hidden = !card.hidden; } }, 'Guide'),
    h('button', { class: 'btn sm primary', type: 'button', onclick: () => DSQ.exitTour() }, 'Create account'),
    h('button', { class: 'btn sm', type: 'button', onclick: () => DSQ.exitTour() }, 'Exit'));
  document.body.append(card, bar); paint();
  if (/^#\/tour/.test(location.hash)) location.replace('#/');
  let seen = false; try { seen = sessionStorage.getItem('dsq.tourcard') === '1'; sessionStorage.setItem('dsq.tourcard', '1'); } catch (e) { }
  if (!seen) setTimeout(() => { card.hidden = false; }, 1200);
};

DSQ.downloadNotebook = DSQ.downloadNotebook || (() => { });
if (DSQ.tour.on) { const real = DSQ.downloadNotebook; DSQ.downloadNotebook = () => toast('Practice notebooks are part of the full course.'); DSQ._realDownload = real; }
