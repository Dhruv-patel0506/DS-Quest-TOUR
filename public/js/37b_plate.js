'use strict';
/* 3D hologram for any chart: PROJ.open('plate', { image: dataURL, title }). The picture floats as a glowing plate with depth echoes behind it and a beam to the floor. */
PROJ.scenes.plate = (T, X, o) => {
  const g = new T.Group(); X.world.add(g); let tex = null, front = null, echoes = [], alive = true, W = 8, H = 5;
  const img = new Image();
  img.onload = () => {
    if (!alive) return; const asp = img.width / img.height; W = asp >= 1.3 ? 9 : 7 * asp; H = W / asp; if (H > 6.2) { H = 6.2; W = H * asp; }
    tex = new T.Texture(img); tex.needsUpdate = true; if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    const y0 = H / 2 + 1.2;
    front = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: .97, side: T.DoubleSide })); front.position.y = y0; g.add(front);
    [[-.32, .2, 1.03], [-.7, .12, 1.06], [-1.1, .07, 1.09]].forEach(([z, op, sc]) => { const e = new T.Mesh(new T.PlaneGeometry(W * sc, H * sc), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, color: 0x6fb2ff, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); e.position.set(0, y0, z); g.add(e); echoes.push(e); });
    const frame = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(W + .14, H + .14)), new T.LineBasicMaterial({ color: 0x7cc0ff })); frame.position.y = y0; g.add(frame);
    const glow = new T.Mesh(new T.PlaneGeometry(W + 1.2, H + 1.2), new T.MeshBasicMaterial({ color: 0x3a8cff, transparent: true, opacity: .12, blending: T.AdditiveBlending, depthWrite: false })); glow.position.set(0, y0, -.05); g.add(glow);
    [-1, 1].forEach(s => { const beam = new T.Mesh(new T.PlaneGeometry(.06, y0 - H / 2), new T.MeshBasicMaterial({ color: 0x7cc0ff, transparent: true, opacity: .35, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); beam.position.set(s * W * .42, (y0 - H / 2) / 2, 0); g.add(beam); });
    const disc = new T.Mesh(new T.CircleGeometry(Math.max(W, 6) * .55, 64), new T.MeshBasicMaterial({ color: 0x3a8cff, transparent: true, opacity: .16, blending: T.AdditiveBlending, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = .02; g.add(disc);
    const ring = new T.Mesh(new T.RingGeometry(Math.max(W, 6) * .55 - .06, Math.max(W, 6) * .55, 96), new T.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: .8, side: T.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .03; g.add(ring);
    const lab = X.label(o.title || 'Chart', { size: .55 }); lab.position.set(0, y0 + H / 2 + .7, 0); g.add(lab);
    X.setCam({ th: .32, ph: 1.2, d: 14, tx: 0, ty: y0, tz: 0 }); X.fit(W / 2 * 1.4, (H / 2 + 1.5) * 1.4);
    X.info('<b>' + (o.title || 'Chart').replace(/</g, '&lt;') + '</b><br>Your chart, floating in 3D. Switch on <b>Hands on</b> to turn it around and zoom. Esc closes.');
  };
  img.src = o.image;
  return {
    update(dt, t) { g.position.y = Math.sin(t * 1.1) * .1; g.rotation.y = Math.sin(t * .45) * .08; echoes.forEach((e, i) => { e.material.opacity = (.2 - i * .06) * (.7 + .3 * Math.sin(t * 2 + i)); }); },
    apply() { }, dispose() { alive = false; if (tex) tex.dispose(); },
  };
};
