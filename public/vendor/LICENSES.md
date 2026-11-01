# Third-party software shipped with DS Quest

DS Quest bundles the following open-source components under `public/vendor/` so the app works offline. Each keeps its own licence; the licence text for every Python
package is inside its wheel (`*.dist-info/`). This list is a convenience, not legal advice. Re-check it whenever `tools/fetch_offline.js` is run.

| component | where | licence |
|---|---|---|
| Pyodide 0.27.7 (CPython for WebAssembly) | `vendor/pyodide/` | Mozilla Public License 2.0 (keep the files unmodified and keep the notice; CPython itself: PSF licence) |
| NumPy, SciPy, pandas, scikit-learn, matplotlib, joblib, threadpoolctl and their dependencies | `vendor/pyodide/` | BSD-style / PSF-style licences (matplotlib: PSF-based) |
| pydantic, annotated-types | `vendor/pyodide/` | MIT |
| seaborn, FastAPI, Starlette, anyio, sniffio, httpx, httpcore, h11, idna, typing-inspection | `vendor/wheels/` | BSD-3 / MIT |
| certifi | `vendor/wheels/` | MPL 2.0 |
| Django, asgiref, sqlparse | `vendor/wheels/` | BSD-3 |
| html2canvas 1.4.1 | `vendor/html2canvas.min.js` | MIT |
| Inter, Source Serif 4, JetBrains Mono (latin subsets) | `vendor/fonts/` | SIL Open Font License 1.1 |
| three.js r149 (3D engine for the 3D Projection) | `vendor/three.min.js`, licence in `vendor/three.LICENSE.txt` | MIT |

Course text, exercises, diagrams and code written for DS Quest are the project owner's own work. Trademarks (Python, NumPy, PyTorch, Kubernetes, ...) belong to their owners and are used only to name the technology.
