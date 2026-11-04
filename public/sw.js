'use strict';
/* Dhruv Patel Academy service worker: makes the whole app run with no internet after the first visit.
   Generated numbers (VERSION, PACK) are written by tools/build_sw.js - run it before every deploy.
   - app files (html/js/css/fonts/helpers): kept in a versioned cache, served instantly, refreshed in the background
   - the Python engine pack (public/vendor/pyodide, wheels, notebooks): cache-first, kept across app updates
   - /api/content/bundle and notebooks (paid lessons): network first, last copy kept in 'dsq-private' for offline, removed when the learner signs out
   - all other /api/*, /hist/* and /u/* are live server routes and are never cached */
const VERSION = 'f22ec006d2';
const PACK = 'dsq-pack-0.27.7';
const SHELL = 'dsq-shell-' + VERSION;
const CDN_OK = /^https:\/\/(cdn\.jsdelivr\.net\/pyodide\/|pypi\.org\/simple\/|files\.pythonhosted\.org\/)/;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const list = await (await fetch('precache.json', { cache: 'no-cache' })).json();
    const c = await caches.open(SHELL);
    await Promise.all(list.shell.map(async u => { const r = await fetch(u, { cache: 'reload' }); if (r.ok) await c.put(new Request(u, { credentials: 'same-origin' }), r); }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('dsq-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function cacheFirst(name, req) {
  const c = await caches.open(name), hit = await c.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok && r.status === 200) c.put(req, r.clone());
  return r;
}

/* paid lesson files: the network decides (so access is checked every time); the last good copy is kept for offline use and wiped on sign-out */
async function networkFirst(name, req) {
  const c = await caches.open(name);
  try {
    const r = await fetch(req);
    if (r.ok && r.status === 200) c.put(req, r.clone());
    else if (r.status === 401 || r.status === 403) c.delete(req);
    return r;
  } catch (err) {
    const hit = await c.match(req);
    if (hit) return hit;
    throw err;
  }
}

async function swr(name, req, key) {
  const c = await caches.open(name), hit = await c.match(key || req);
  const fresh = fetch(req, { cache: 'no-cache' }).then(r => { if (r.ok) c.put(key || req, r.clone()); return r; });
  if (hit) { fresh.catch(() => { }); return hit; }
  return fresh;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    if (/\/api\/content\/(bundle|notebook\/)/.test(u.pathname)) { e.respondWith(networkFirst('dsq-private', req)); return; }
    if (/\/(api|u|hist)\//.test(u.pathname) && !/\/vendor\//.test(u.pathname)) return;
    if (/\/(vendor\/(pyodide|wheels)|notebooks)\//.test(u.pathname)) { e.respondWith(cacheFirst(PACK, req)); return; }
    if (req.mode === 'navigate' && u.pathname.indexOf('/picture/') < 0 && u.pathname.indexOf('/studio/') < 0) { e.respondWith(swr(SHELL, req, new Request(new URL('index.html', self.registration.scope)))); return; }
    /* the app asks for some files with a cache-busting query (dsq_http.py?v=9): one cache entry per path */
    e.respondWith(swr(SHELL, req, new Request(u.origin + u.pathname)).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  if (CDN_OK.test(u.href)) e.respondWith(cacheFirst(PACK, req));
});
