# Dhruv Patel Academy

A browser-based academy for data science and AI engineering: interactive lessons, code exercises that run **in the browser**, 3-D concept models and algorithm animations,
practice notebooks, and a verification harness that proves every exercise is solvable. It runs on phones and **works offline**.

> **Live tour (no sign-up):** open the deployed site and add `#/welcome` to the address (every curriculum, with a tour of each: watch an animated lesson and try a study room from every module), or `#/tour` for the guided walk-through.
> The tour shows an excerpt of every module, with all solutions withheld.

This is the **public showcase** of the project. The full course is a paid product: its 39 premium modules, their solutions and practice notebooks are **not** in this repository.
What is here: the whole engine, 10 complete free modules (Python, NumPy, pandas, Matplotlib, SQL, LLM evaluation, uncertainty, responsible AI) and the tooling.


## What is technically interesting

| area | what it does |
|---|---|
| **In-browser Python** | Pyodide (CPython compiled to WebAssembly) runs in a Web Worker with a time limit, so an infinite loop can be stopped without freezing the page. numpy, pandas, matplotlib, scikit-learn, scipy and even FastAPI and Django lessons run client-side. See `public/js/02_py.js`. |
| **Offline first** | A service worker keeps the app and the self-hosted Python engine (~74 MB) on the device; the app boots and runs lessons with the server switched off. Tested by stopping the server and running exercises (`public/sw.js`, `tools/build_sw.js`). |
| **Content you can trust** | Every exercise (700+ in the full course) has a reference solution and tests. `node tools/verify.js` runs all solutions through the same Python harness the browser uses and also requires every starter to FAIL, so no exercise is trivial. |
| **3-D engine from scratch** | A small canvas renderer (`Plot3D`) with lit solid shapes, a concept explorer that shows each idea as a diagram and a hologram, and 11 step-by-step algorithm animations (k-means, gradient descent, DBSCAN, Dijkstra, ...). No WebGL library. |
| **Real simulations** | Hodgkin-Huxley neuron, synapse plasticity, a hand-weighted toy transformer, consistent hashing, a Kubernetes reconcile loop. Pure functions, tested in Node. |
| **Serverless API** | Accounts, sessions, progress and password reset on Vercel functions with a Redis REST store (`lib/hosted.js`); per-user rate limits; scrypt password hashing. |
| **Paid-access design** | Premium lessons live outside the public folder and are served by the API only to entitled accounts; a sanitised excerpt powers the public tour, and a build step fails if any solution line leaks into it (`lib/content.js`, `public/js/28_premium.js`, `public/js/29_tour.js`). The tooling for that is private. |
| **No framework** | Plain JavaScript modules and a small `h()` helper; the whole front end is readable top to bottom. |

## Run it locally

```bash
node server.js                # http://127.0.0.1:5177  (Node 18+, no dependencies)
node tools/fetch_offline.js   # optional: download the Python engine for offline use (about 70 MB)
node tools/build_sw.js        # after fetching, stamp the service-worker cache
node tools/verify.js          # check every exercise in the included modules (needs Python with numpy, pandas, matplotlib, scikit-learn)
```

Without `tools/fetch_offline.js` the app loads Python from a public CDN instead. Accounts are stored in `data/` (ignored by git).

## Layout

```
public/            the web app (index.html, css, js, notebooks, tour excerpt)
public/js/content/ lesson files of the free modules (DSQ.defModule)
lib/ api/          serverless API and shared code
server.js          zero-dependency local server with the same API
tools/             verification, offline packaging, service-worker builder
```

## Licence

Source-available, all rights reserved: you may read it and run it locally to evaluate it. See `LICENSE`. Third-party notices: `LICENSES-vendor.md`.
