'use strict';
/* =====================================================================
   More animated algorithms (same viewer as 20_algos.js): simulated annealing, Dijkstra's shortest path, DBSCAN clustering.
   Each is a list of frames with the running code line, the variables, a plain-English note and the number being improved.
   ===================================================================== */
Object.assign(ALGOS, {
  sa: {
    icon: 'Sa', title: 'Simulated annealing', blurb: 'A hiker who accepts a step downhill when the world is "hot", and becomes pickier as it cools: a way out of small peaks.', range: [-3.2, 3.2, -3.2, 3.2, -.4, 4.2], surfFn: alPeaks, surfTop: 3.6,
    opts: [{ key: 't0', label: 'start temperature', min: .2, max: 3, step: .1, value: 1.6 }, { key: 'cool', label: 'cooling per step', min: .8, max: .98, step: .01, value: .9 }, { key: 'step', label: 'step size', min: .2, max: 1.2, step: .1, value: .6 }],
    code: ['x = random_point(); T = T0', 'for step in range(steps):', '    y = x + random_step()', '    dE = height(y) - height(x)', '    if dE > 0 or random() < exp(dE / T):', '        x = y                       # accept (sometimes even a worse spot)', '    T = T * cooling', 'return best point seen'],
    flow: { nodes: [{ id: 'a', text: 'Start somewhere, hot', kind: 'start', x: 0, y: 0, lines: [0] }, { id: 'b', text: 'Propose a nearby point', kind: 'step', x: 1, y: 0, lines: [2] }, { id: 'c', text: 'Better? accept. Worse? accept with probability exp(dE/T)', kind: 'step', x: 2, y: 0, lines: [3, 4, 5] }, { id: 'd', text: 'Cool down: T = T x cooling', kind: 'step', x: 2, y: 1, lines: [6] }, { id: 'e', text: 'Return the best point seen', kind: 'end', x: 1, y: 1, lines: [7] }], edges: [['a', 'b', ''], ['b', 'c', 'candidate'], ['c', 'd', 'new position'], ['d', 'b', 'repeat'], ['d', 'e', 'cold']] },
    metric: 'best height seen',
    build(r, o) {
      const z = p => alPeaks(p[0], p[1]), lift = p => [p[0], p[1], z(p) + .08], clip = v => Math.max(-3.1, Math.min(3.1, v)); let x = [r() * 5 - 2.5, r() * 5 - 2.5], T = o.t0, best = x.slice(); const trail = [x.slice()], frames = [];
      const trailPts = () => trail.map(lift), trailCol = () => trail.map((_, i) => `hsla(45,95%,${40 + 40 * i / trail.length}%,${.25 + .6 * i / trail.length})`);
      const ball = (p, c, rr = 13) => ({ k: 'ball', p: lift(p), r: rr, color: c, ring: '#000' });
      frames.push({ line: 0, note: `The hiker (gold ball) starts at a random spot with temperature ${T.toFixed(2)}. A hot hiker accepts almost any move, so it can leave a small hill to look for a taller one.`, vars: { step: 0, T: +T.toFixed(2), height: +z(x).toFixed(2) }, pts: trailPts(), col: trailCol(), extra: [ball(x, '#ffd166')], metric: z(best) });
      for (let st = 1; st <= 26; st++) {
        const y = [clip(x[0] + r.norm(0, o.step)), clip(x[1] + r.norm(0, o.step))], dE = z(y) - z(x), pAcc = dE > 0 ? 1 : Math.exp(dE / T), take = r() < pAcc;
        frames.push({ line: 3, note: `Step ${st}: propose a nearby point (white ball). It is ${dE >= 0 ? 'higher' : 'lower'} by ${Math.abs(dE).toFixed(2)}. ${dE > 0 ? 'Better spots are always accepted.' : `A worse spot is accepted with probability exp(${dE.toFixed(2)} / ${T.toFixed(2)}) = ${(pAcc * 100).toFixed(0)}%.`}`, vars: { step: st, T: +T.toFixed(2), dE: +dE.toFixed(2), 'P(accept)': +pAcc.toFixed(2) }, pts: trailPts(), col: trailCol(), extra: [ball(x, '#ffd166'), ball(y, '#ffffff', 10), { k: 'line', a: lift(x), b: lift(y), color: '#ffffff', w: 1.2, alpha: .8 }], metric: z(best) });
        if (take) { x = y; trail.push(x.slice()); if (z(x) > z(best)) best = x.slice(); }
        T *= o.cool;
        frames.push({ line: take ? 5 : 6, note: `${take ? 'Accepted: the hiker moves.' : 'Rejected: the hiker stays.'} Then it cools to T = ${T.toFixed(2)}, so worse moves become less likely. The best height seen so far is ${z(best).toFixed(2)}.`, vars: { step: st, T: +T.toFixed(2), 'best height': +z(best).toFixed(2) }, pts: trailPts(), col: trailCol(), extra: [ball(x, '#ffd166'), ball(best, '#1E8E5A', 9)], metric: z(best) });
      }
      frames.push({ line: 7, note: `Cold now: the hiker only climbs. The best spot found has height ${z(best).toFixed(2)} (the tallest peak is about 3.1). Start hotter or cool more slowly to explore more; cool too fast and it freezes on the first hill.`, vars: { 'best height': +z(best).toFixed(2), 'peak height': 3.1 }, pts: trailPts(), col: trailCol(), extra: [ball(best, '#1E8E5A', 14)], metric: z(best) });
      return frames;
    },
  },

  dijkstra: {
    icon: 'Dj', title: "Dijkstra's shortest path", blurb: 'Always settle the closest unsettled place, then check whether it gives its neighbours a shorter way. The map fills in like a spreading ripple.', range: [-5, 5, -5, 5, -5, 5],
    opts: [{ key: 'n', label: 'places', min: 6, max: 16, step: 1, value: 10 }, { key: 'k', label: 'roads per place', min: 2, max: 4, step: 1, value: 3 }],
    code: ['dist = {start: 0}; others = infinity', 'while unsettled places remain:', '    u = unsettled place with the smallest dist', '    mark u settled', '    for each road (u, v, w):', '        if dist[u] + w < dist[v]:', '            dist[v] = dist[u] + w          # a shorter way found', 'return dist'],
    flow: { nodes: [{ id: 'a', text: 'Start at 0, everyone else infinity', kind: 'start', x: 0, y: 0, lines: [0] }, { id: 'b', text: 'Pick the unsettled place with the smallest distance', kind: 'step', x: 1, y: 0, lines: [2, 3] }, { id: 'c', text: 'Relax its roads: is dist[u] + w shorter?', kind: 'step', x: 2, y: 0, lines: [4, 5, 6] }, { id: 'd', text: 'All settled?', kind: 'step', x: 2, y: 1, lines: [1] }, { id: 'e', text: 'Return the distances', kind: 'end', x: 1, y: 1, lines: [7] }], edges: [['a', 'b', ''], ['b', 'c', 'u'], ['c', 'd', 'new distances'], ['d', 'b', 'no'], ['d', 'e', 'yes']] },
    metric: 'places settled',
    build(r, o) {
      const n = o.n, P = Array.from({ length: n }, () => [r.norm(0, 2.4), r.norm(0, 2.4), r.norm(0, 2.4)]), E = new Map(), key = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
      P.forEach((p, i) => { P.map((q, j) => [j, Math.sqrt(alD2(p, q))]).filter(t => t[0] !== i).sort((a, b) => a[1] - b[1]).slice(0, o.k).forEach(([j, d]) => E.set(key(i, j), +d.toFixed(1))); });
      const adj = P.map(() => []); E.forEach((w, k) => { const [a, b] = k.split('-').map(Number); adj[a].push([b, w]); adj[b].push([a, w]); });
      const dist = P.map(() => Infinity), done = P.map(() => false), prev = P.map(() => -1), frames = []; dist[0] = 0;
      const allEdges = () => [...E.keys()].map(k => { const [a, b] = k.split('-').map(Number); return { k: 'line', a: P[a], b: P[b], color: '#8895a8', w: .6, alpha: .28 }; });
      const tree = () => prev.map((p, v) => (p >= 0 && done[v] ? { k: 'line', a: P[p], b: P[v], color: '#1E8E5A', w: 2.4, alpha: .95 } : null)).filter(Boolean);
      const colr = () => P.map((_, i) => (done[i] ? '#1E8E5A' : isFinite(dist[i]) ? '#D2600F' : '#5b6b7f')), shown = () => Object.fromEntries(dist.slice(0, 6).map((d, i) => ['d' + i, isFinite(d) ? +d.toFixed(1) : 'inf']));
      frames.push({ line: 0, note: `${n} places joined by roads (grey lines, length = cost). Place 0 is the start with distance 0; every other place is "infinity" (unknown, grey-blue).`, vars: shown(), pts: P, col: colr(), extra: allEdges(), metric: 0 });
      for (let step = 0; step < n; step++) {
        let u = -1, best = Infinity; dist.forEach((d, i) => { if (!done[i] && d < best) { best = d; u = i; } }); if (u < 0) break; done[u] = true;
        const ring = { k: 'ball', p: P[u], r: 13, color: '#ffd166', ring: '#000' };
        frames.push({ line: 2, note: `Settle place ${u}: it has the smallest distance among the unsettled places (${dist[u].toFixed(1)}), so no shorter way to it can exist: every other route is already longer. It turns green.`, vars: Object.assign({ settled: step + 1, current: u }, shown()), pts: P, col: colr(), extra: allEdges().concat(tree(), [ring]), metric: step + 1 });
        const relax = []; adj[u].forEach(([v, w]) => { if (done[v]) return; if (dist[u] + w < dist[v]) { dist[v] = +(dist[u] + w).toFixed(2); prev[v] = u; relax.push({ k: 'line', a: P[u], b: P[v], color: '#ffd166', w: 2, alpha: .95 }); } });
        frames.push({ line: 5, note: relax.length ? `Relax the roads out of place ${u}: ${relax.length} neighbour${relax.length > 1 ? 's' : ''} can now be reached by a shorter way (gold roads), so their distances are updated (orange).` : `Relax the roads out of place ${u}: none of its neighbours is reached any faster than before.`, vars: Object.assign({ settled: step + 1, current: u }, shown()), pts: P, col: colr(), extra: allEdges().concat(tree(), relax, [ring]), metric: step + 1 });
      }
      frames.push({ line: 7, note: `Every reachable place is settled. The green lines are the shortest-path tree: following them back from any place gives the cheapest route to the start. Distances: ${dist.slice(0, 6).map((d, i) => `${i}: ${isFinite(d) ? d.toFixed(1) : 'inf'}`).join(', ')}...`, vars: shown(), pts: P, col: colr(), extra: allEdges().concat(tree()), metric: done.filter(Boolean).length });
      return frames;
    },
  },

  dbscan: {
    icon: 'Db', title: 'DBSCAN clustering', blurb: 'Clusters are crowds: a dense neighbourhood starts a cluster, and it grows through neighbours of neighbours. Lonely points are noise.', range: [-5, 5, -5, 5, -5, 5],
    opts: [{ key: 'eps', label: 'neighbourhood radius', min: .4, max: 1.6, step: .1, value: .9 }, { key: 'minPts', label: 'points to be a crowd', min: 3, max: 8, step: 1, value: 4 }, { key: 'n', label: 'points', min: 40, max: 160, step: 10, value: 90 }],
    code: ['for each unvisited point p:', '    neighbours = points within eps of p', '    if len(neighbours) < min_pts: mark p as noise (for now); continue', '    start a new cluster with p', '    queue = neighbours', '    while queue:', '        q = queue.pop()', '        if q was noise or unvisited: add q to the cluster', '        if q is a core point: queue += its neighbours', 'return cluster labels, noise = -1'],
    flow: { nodes: [{ id: 'a', text: 'Pick an unvisited point', kind: 'start', x: 0, y: 0, lines: [0] }, { id: 'b', text: 'Count neighbours within eps', kind: 'step', x: 1, y: 0, lines: [1] }, { id: 'c', text: 'Enough? Start a cluster. Too few? Noise.', kind: 'step', x: 2, y: 0, lines: [2, 3] }, { id: 'd', text: 'Grow: add neighbours of core points', kind: 'step', x: 2, y: 1, lines: [4, 5, 6, 7, 8] }, { id: 'e', text: 'All points visited: return labels', kind: 'end', x: 1, y: 1, lines: [9] }], edges: [['a', 'b', 'p'], ['b', 'c', 'count'], ['c', 'd', 'seed'], ['d', 'a', 'next'], ['d', 'e', 'done']] },
    metric: 'clusters found',
    build(r, o) {
      const { pts } = alBlobs(r, 3, Math.floor(o.n * .85), .55, 2.2), X = pts.map(q => q.p); while (X.length < o.n) X.push([r() * 9 - 4.5, r() * 9 - 4.5, r() * 9 - 4.5]);
      const eps2 = o.eps * o.eps, nb = i => X.map((q, j) => (alD2(X[i], q) <= eps2 ? j : -1)).filter(j => j >= 0), lab = X.map(() => -2); let cid = -1; const frames = [];
      const colr = () => lab.map(l => (l === -2 ? '#8a95a5' : l === -1 ? '#3b4350' : ALGO_COL[l % 6])), ball = (i, c) => ({ k: 'ball', p: X[i], r: 12, color: c, ring: '#fff' });
      frames.push({ line: 0, note: `${X.length} points; grey ones are not visited yet. Two settings define a "crowd": a radius eps = ${o.eps} and the number of points needed inside it, minPts = ${o.minPts}.`, vars: { eps: o.eps, minPts: o.minPts, clusters: 0 }, pts: X, col: colr(), extra: [], metric: 0 });
      for (let p = 0; p < X.length; p++) {
        if (lab[p] !== -2) continue; const N = nb(p);
        if (N.length < o.minPts) { lab[p] = -1; continue; }
        cid++; lab[p] = cid; const queue = N.slice(), seen = new Set([p]);
        frames.push({ line: 3, note: `Point ${p} has ${N.length} points within the radius (at least ${o.minPts}), so it is a core point and starts cluster ${cid + 1}. The lines show its neighbourhood.`, vars: { clusters: cid + 1, neighbours: N.length }, pts: X, col: colr(), extra: [ball(p, ALGO_COL[cid % 6])].concat(N.map(j => ({ k: 'line', a: X[p], b: X[j], color: ALGO_COL[cid % 6], w: .9, alpha: .7 }))), metric: cid + 1 });
        while (queue.length) { const q = queue.pop(); if (seen.has(q)) continue; seen.add(q); if (lab[q] < 0) lab[q] = cid; const Nq = nb(q); if (Nq.length >= o.minPts) Nq.forEach(j => { if (!seen.has(j)) queue.push(j); }); }
        frames.push({ line: 8, note: `Cluster ${cid + 1} grows through neighbours of neighbours (only core points pass the crowd on). It now has ${lab.filter(l => l === cid).length} points. Border points join but do not spread further.`, vars: { clusters: cid + 1, size: lab.filter(l => l === cid).length }, pts: X, col: colr(), extra: [], metric: cid + 1 });
      }
      const noise = lab.filter(l => l === -1).length;
      frames.push({ line: 9, note: `Done: ${cid + 1} cluster${cid ? 's' : ''} and ${noise} noise point${noise === 1 ? '' : 's'} (dark). Unlike k-means DBSCAN needs no k, finds odd shapes and labels outliers. Make eps smaller and clusters split and noise grows; make it larger and clusters merge.`, vars: { clusters: cid + 1, noise }, pts: X, col: colr(), extra: [], metric: cid + 1 });
      return frames;
    },
  },
});
