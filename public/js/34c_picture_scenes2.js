'use strict';
/* =====================================================================
   Picture Class scenes, part 3: arrows (vectors as trips, with a car that drives them) and vecmap (a map of meaning: the nearest chunks to a question).
   ===================================================================== */
PIC.scenes.arrows = (stage, sp, ctx) => {
  const W = 560, H = 360, U = sp.unit || 38, xr = sp.xr || [-3, 9], yr = sp.yr || [-2, 6], ox = 40 + (-xr[0]) * U, oy = H - 34 + yr[0] * U;
  const P = (x, y) => [ox + x * U, oy - y * U], col = { blue: '#2457d6', orange: '#e0701c', green: '#0f8a5f', red: '#cb3a46', purple: '#7a4fd0', gray: '#6b7a90' };
  let g = ''; for (let x = xr[0]; x <= xr[1]; x++) { const [px] = P(x, 0); g += `<line x1="${px}" x2="${px}" y1="${P(0, yr[1])[1]}" y2="${P(0, yr[0])[1]}" class="pc-g"/>${x % 2 === 0 ? `<text x="${px}" y="${P(0, yr[0])[1] + 14}" text-anchor="middle" class="pc-t">${x}</text>` : ''}`; } for (let y = yr[0]; y <= yr[1]; y++) { const [, py] = P(0, y); g += `<line y1="${py}" y2="${py}" x1="${P(xr[0], 0)[0]}" x2="${P(xr[1], 0)[0]}" class="pc-g"/>${y % 2 === 0 ? `<text x="${P(xr[0], 0)[0] - 6}" y="${py + 4}" text-anchor="end" class="pc-t">${y}</text>` : ''}`; }
  const mk = c => `<marker id="pa2-${c}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0 0L10 5L0 10z" fill="${col[c]}"/></marker>`;
  stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="pc-svg" role="img" aria-label="${picEsc(sp.title || 'vectors as arrows')}"><defs>${Object.keys(col).map(mk).join('')}</defs>${g}<line x1="${P(xr[0], 0)[0]}" x2="${P(xr[1], 0)[0]}" y1="${oy}" y2="${oy}" class="pc-ax"/><line x1="${ox}" x2="${ox}" y1="${P(0, yr[0])[1]}" y2="${P(0, yr[1])[1]}" class="pc-ax"/><text x="${ox - 6}" y="${oy + 15}" text-anchor="end" class="pc-t">${sp.origin == null ? 'garage' : picEsc(sp.origin)}</text><g class="pc-arrs"></g><g class="pc-drive" style="display:none"></g></svg>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}<div class="pc-formula"></div><button type="button" class="btn sm pc-replay" hidden>↻ Replay</button>`;
  const layer = stage.querySelector('.pc-arrs'), drive = stage.querySelector('.pc-drive'), note = stage.querySelector('.pc-formula'), replay = stage.querySelector('.pc-replay'), NS = 'http://www.w3.org/2000/svg';
  const go = () => {
    layer.innerHTML = ''; drive.style.display = 'none'; replay.hidden = true; note.textContent = ''; let k = 0; const A = sp.arrows;
    const next = () => {
      if (ctx.dead) return; if (k >= A.length) { if (sp.drive) driveCar(); else { replay.hidden = false; } return; }
      const a = A[k++], c = a.color || 'blue', [x1, y1] = P(a.from[0], a.from[1]), [x2, y2] = P(a.to[0], a.to[1]); const l = document.createElementNS(NS, 'line'); l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x1); l.setAttribute('y2', y1); l.setAttribute('stroke', col[c]); l.setAttribute('stroke-width', 3.2); l.setAttribute('marker-end', `url(#pa2-${c})`); if (a.dash) l.setAttribute('stroke-dasharray', '6 5'); layer.appendChild(l);
      const t = document.createElementNS(NS, 'text'); t.setAttribute('x', (x1 + x2) / 2 + (a.dx || 8)); t.setAttribute('y', (y1 + y2) / 2 + (a.dy || -8)); t.setAttribute('class', 'pc-alab'); t.setAttribute('fill', col[c]); t.textContent = a.label || ''; layer.appendChild(t); t.style.opacity = 0;
      note.innerHTML = a.say || ''; ctx.tween(900, e => { l.setAttribute('x2', x1 + (x2 - x1) * e); l.setAttribute('y2', y1 + (y2 - y1) * e); t.style.opacity = e; }, () => ctx.wait(450, next));
    }; ctx.wait(400, next);
    function driveCar() {
      const legs = A.filter(a => !a.dash && !a.ghost), pts = [legs[0].from].concat(legs.map(a => a.to)); drive.style.display = ''; let i = 0;
      const leg = () => { if (ctx.dead) return; if (i >= pts.length - 1) { replay.hidden = false; return; } const [x1, y1] = P(pts[i][0], pts[i][1]), [x2, y2] = P(pts[i + 1][0], pts[i + 1][1]), ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI, flip = Math.abs(ang) > 90; i++; ctx.tween(1300, e => { const x = x1 + (x2 - x1) * e, y = y1 + (y2 - y1) * e; drive.innerHTML = `<g transform="translate(${x},${y}) rotate(${flip ? ang + 180 : ang}) ${flip ? 'scale(-1,1)' : ''}">${picCar(0.42, '#d63b2f', 'cbD')}</g>`; }, () => ctx.wait(300, leg)); };
      const [sx, sy] = P(pts[0][0], pts[0][1]); drive.innerHTML = `<g transform="translate(${sx},${sy})">${picCar(0.42, '#d63b2f', 'cbD')}</g>`; ctx.wait(300, leg);
    }
  };
  replay.onclick = go; go();
};

/* a map of meaning: chunks are dots, a question lands among them, the closest ones are fetched */
PIC.scenes.vecmap = (stage, sp, ctx) => {
  const W = 560, H = 340, X = x => 30 + x * (W - 60), Y = y => 24 + (1 - y) * (H - 60), pts = sp.points, q = sp.query, k = sp.k || 3, NS = 'http://www.w3.org/2000/svg';
  const dist = p => Math.hypot(p.x - q.x, p.y - q.y), order = pts.map((p, i) => i).sort((a, b) => dist(pts[a]) - dist(pts[b])), near = order.slice(0, k);
  stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="pc-svg pc-vmap" role="img" aria-label="Map of meaning: similar texts sit close together"><rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="14" class="pc-mapbg"/>${(sp.regions || []).map(r => `<text x="${X(r.x)}" y="${Y(r.y)}" class="pc-region" text-anchor="middle">${picEsc(r.name)}</text>`).join('')}<g class="pc-vl"></g><g class="pc-vd"></g><g class="pc-vq"></g></svg><div class="pc-fetched"></div>${sp.cap ? `<div class="pc-cap">${picEsc(sp.cap)}</div>` : ''}<button type="button" class="btn sm pc-replay" hidden>↻ Replay</button>`;
  const lines = stage.querySelector('.pc-vl'), dg = stage.querySelector('.pc-vd'), qg = stage.querySelector('.pc-vq'), fetched = stage.querySelector('.pc-fetched'), replay = stage.querySelector('.pc-replay');
  const go = () => {
    lines.innerHTML = dg.innerHTML = qg.innerHTML = fetched.innerHTML = ''; replay.hidden = true;
    pts.forEach((p, i) => ctx.wait(i * 160, () => { const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'pc-vp'); g.innerHTML = `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="8"/><text x="${X(p.x)}" y="${Y(p.y) - 13}" text-anchor="middle">${picEsc(p.label)}</text>`; dg.appendChild(g); }));
    ctx.wait(pts.length * 160 + 500, () => {
      const qx = X(q.x), qy = Y(q.y); qg.innerHTML = `<g class="pc-qstar"><circle class="pc-ring" cx="${qx}" cy="${qy}" r="6"/><circle cx="${qx}" cy="${qy}" r="10" class="pc-qdot"/><text x="${qx}" y="${qy + 4}" text-anchor="middle" class="pc-qq">?</text></g><text x="${W / 2}" y="${H - 14}" text-anchor="middle" class="pc-qlab">❓ ${picEsc(q.label)}</text>`;
      const ring = qg.querySelector('.pc-ring'); ctx.tween(1100, e => { ring.setAttribute('r', 6 + e * 130); ring.style.opacity = 1 - e; });
      near.forEach((idx, n) => ctx.wait(1200 + n * 700, () => { const p = pts[idx], l = document.createElementNS(NS, 'line'); l.setAttribute('x1', qx); l.setAttribute('y1', qy); l.setAttribute('x2', qx); l.setAttribute('y2', qy); l.setAttribute('class', 'pc-vline'); lines.appendChild(l); ctx.tween(500, e => { l.setAttribute('x2', qx + (X(p.x) - qx) * e); l.setAttribute('y2', qy + (Y(p.y) - qy) * e); }); dg.children[idx].classList.add('hit'); fetched.insertAdjacentHTML('beforeend', `<div class="pc-fch"><b>#${n + 1}</b> ${picEsc(p.text || p.label)} <span class="muted">(distance ${dist(p).toFixed(2)})</span></div>`); }));
      ctx.wait(1200 + near.length * 700 + 400, () => { replay.hidden = false; });
    });
  };
  replay.onclick = go; go();
};
