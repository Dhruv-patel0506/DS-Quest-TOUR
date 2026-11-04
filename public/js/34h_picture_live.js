'use strict';
/* =====================================================================
   Live data in the flat Picture Class pictures: the dots of regress, classify and cluster can be dragged, and whatever depends on them (the mistakes, the best-fit
   line, the decision regions, the cluster colours) is recalculated on every move and glides to its new place.
   This file is the shared part: dragging dots that live in an SVG with the pc3.frame margins (left 46, right 14, top 14, bottom 36).
   ===================================================================== */
const pc3Live = {
  /* svg: the picture; sel: CSS selector of the dots (each with data-i); f(i, x, y, phase): data coordinates, phase 'move' while dragging and 'drop' when let go */
  drag(svg, W, H, xr, yr, sel, f) {
    let cur = -1, moved = false;
    const at = e => { const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * W, vy = (e.clientY - r.top) / r.height * H; return [Math.max(xr[0], Math.min(xr[1], xr[0] + (vx - 46) / (W - 60) * (xr[1] - xr[0]))), Math.max(yr[0], Math.min(yr[1], yr[0] + (H - 36 - vy) / (H - 50) * (yr[1] - yr[0])))]; };
    svg.addEventListener('pointerdown', e => { const c = e.target.closest && e.target.closest(sel); if (!c || c.dataset.i == null) return; cur = +c.dataset.i; moved = false; try { svg.setPointerCapture(e.pointerId); } catch (x) { } e.preventDefault(); });
    svg.addEventListener('pointermove', e => { if (cur < 0) return; moved = true; svg.style.cursor = 'grabbing'; const p = at(e); f(cur, +p[0].toFixed(2), +p[1].toFixed(2), 'move'); });
    const up = e => { if (cur < 0) return; const p = at(e), i = cur; cur = -1; svg.style.cursor = ''; if (moved) f(i, +p[0].toFixed(2), +p[1].toFixed(2), 'drop'); };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    /* a drag ends with a click on the picture: that click must not count as "ask the model about a new point" */
    svg.addEventListener('click', e => { if (moved) { e.stopImmediatePropagation(); e.preventDefault(); moved = false; } }, true);
  },
  /* make `get()` glide to its target: a number array eased toward `to` every frame; draw(values) paints; stops when still or when the stage is gone */
  glide(stage, from, to, draw, tol, rate) {
    let shown = from.slice(); const tgt = to.slice(); let raf = 0;
    const frame = () => { raf = 0; if (!stage.isConnected) return; let mv = false; shown = shown.map((v, i) => { const d = tgt[i] - v; if (Math.abs(d) > tol) { mv = true; return v + d * (rate || .3); } return tgt[i]; }); draw(shown); if (mv) raf = requestAnimationFrame(frame); };
    frame(); return { to(n) { n.forEach((v, i) => { tgt[i] = v; }); if (!raf) raf = requestAnimationFrame(frame); }, now: () => shown.slice() };
  },
};
