# Verifying browser-only exercises (FastAPI, Django)

`node tools/verify.js` skips exercises flagged `browserOnly` because FastAPI/Django run on Pyodide's package set. Check them in the real in-browser Python:
start `node server.js`, sign in, open the dev console and paste:

```js
(async () => {
  for (const id of ['fastapi', 'django']) {
    const m = DSQ.modules.find(x => x.id === id);
    for (const L of m.lessons) for (const p of L.pages) if (p.t === 'ex') {
      const e = p.ex;
      const ok = await DSQ.Py.run({ code: e.solution, tests: e.tests, timeout: 400000 });
      const st = await DSQ.Py.run({ code: e.starter, tests: e.tests, timeout: 400000 });
      console.log(e.id, 'solution passes:', !ok.error && ok.checks.every(c => c.ok), '| starter fails:', !!st.error || !st.checks.every(c => c.ok));
    }
  }
})();
```

The first Django run downloads the package (up to a couple of minutes on a slow connection).
