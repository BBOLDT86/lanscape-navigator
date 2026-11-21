/* The Stack in 3-D: one WebGL scene behind the feed. A copper chip drops onto the stack for every idea read, and the topic's
   object rides on top. stack.js announces the card on screen with a 'stack:card' event ({t, color, n, i}); without WebGL
   (or if this file fails) the app keeps its flat look, because the 'gl' class on #app is only set once a frame has drawn. */
import * as THREE from '../wave/lib/three.module.min.js';
const app = document.getElementById('app'), canvas = document.getElementById('gl'), feed = document.getElementById('feed');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' }); } catch (e) { /* flat look stays */ }
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#121A24');
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50); cam.position.set(0, 0, 9);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a5568, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(3, 6, 7); scene.add(sun);
  const rig = new THREE.Group(); rig.rotation.x = 0.42; scene.add(rig);
  const chips = new THREE.Group(), lift = new THREE.Group(); rig.add(chips, lift);

  const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.5, metalness: 0.1 }, o));
  const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
  const box = (w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
  const COPPER = M(0xE3A857, { metalness: 0.6, roughness: 0.32 }), BONE = M(0xF4F1EA, { emissive: 0x2c2a26 }), INK = M(0x15181C);
  const CH = 0.2, chipGeo = new THREE.CylinderGeometry(1, 1, CH * 0.86, 48), baseGeo = new THREE.CylinderGeometry(1.18, 1.18, 0.07, 48);
  const BASE = M(0x000000, { transparent: true, opacity: 0.28 });

  const TOTEM = {
    electronics() { const g = new THREE.Group();
      g.add(box(1.8, 0.08, 1.25, M(0x0A3A2C), 0, 0.04, 0), box(0.82, 0.2, 0.6, INK, -0.15, 0.18, 0));
      for (let k = 0; k < 6; k++) g.add(box(0.07, 0.06, 0.16, COPPER, -0.5 + k * 0.14, 0.11, 0.36), box(0.07, 0.06, 0.16, COPPER, -0.5 + k * 0.14, 0.11, -0.36));
      [[0.55, 0.42, 0.5], [0.55, 0.1, 0.34], [0.55, -0.3, 0.42]].forEach(([x, z, w]) => g.add(box(w, 0.012, 0.04, COPPER, x, 0.086, z)));
      g.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 20), M(0x2D4F8E), 0.62, 0.25, -0.34));
      g.add(mesh(new THREE.SphereGeometry(0.1, 20, 14), M(0xFF5A4A, { emissive: 0xFF2A1A, emissiveIntensity: 1.2 }), 0.62, 0.17, 0.42));
      return g; },
    poker() { const g = new THREE.Group(), RED = M(0xC8323C);
      [[-0.2, 0.2, 0, INK], [0.24, -0.16, 0.06, RED]].forEach(([x, rz, z, pip]) => { const c = new THREE.Group();
        c.add(box(0.92, 1.3, 0.035, BONE, 0, 0.65, 0)); const d = box(0.3, 0.3, 0.045, pip, 0, 0.66, 0); d.rotation.z = Math.PI / 4; c.add(d);
        c.position.set(x, 0.02, z); c.rotation.z = rz; g.add(c); });
      return g; },
    money() { const g = new THREE.Group(), gold = M(0xF2C14E, { metalness: 0.7, roughness: 0.28 });
      [[-0.62, 3], [0, 5], [0.62, 8]].forEach(([x, n]) => { for (let k = 0; k < n; k++) g.add(mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.085, 28), gold, x + (k % 2 ? 0.012 : -0.012), 0.05 + k * 0.1, 0)); });
      return g; },
    mind() { const g = new THREE.Group(), geo = new THREE.IcosahedronGeometry(0.66, 0);
      const core = mesh(geo, M(0xCDB8F2, { flatShading: true, roughness: 0.35 }), 0, 0.86, 0); g.add(core);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xE3A857 })); edges.scale.setScalar(1.22); edges.position.y = 0.86; g.add(edges);
      const p = geo.getAttribute('position'), seen = {};
      for (let k = 0; k < p.count; k++) { const key = [p.getX(k), p.getY(k), p.getZ(k)].map(v => v.toFixed(2)).join(); if (seen[key]) continue; seen[key] = 1;
        g.add(mesh(new THREE.SphereGeometry(0.065, 12, 8), COPPER, p.getX(k) * 1.22, 0.86 + p.getY(k) * 1.22, p.getZ(k) * 1.22)); }
      return g; },
    world() { const g = new THREE.Group(), ball = new THREE.Group();
      const s = new THREE.SphereGeometry(0.66, 28, 18); ball.add(mesh(s, M(0x2F78B7, { roughness: 0.6 })));
      ball.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(0.68, 12, 8)), new THREE.LineBasicMaterial({ color: 0xF4F1EA, transparent: true, opacity: 0.55 })));
      const ring = mesh(new THREE.TorusGeometry(1.0, 0.014, 8, 64), BONE); ring.rotation.x = Math.PI / 2; ball.add(ring, mesh(new THREE.SphereGeometry(0.1, 16, 12), BONE, 1.0, 0, 0));
      ball.position.y = 0.9; ball.rotation.z = 0.41; g.add(ball); return g; },
    life() { const g = new THREE.Group();
      g.add(box(1.1, 0.62, 0.86, BONE, 0, 0.31, 0));
      const roof = mesh(new THREE.ConeGeometry(0.92, 0.52, 4), M(0xC8553D, { flatShading: true }), 0, 0.88, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
      g.add(box(0.22, 0.4, 0.02, COPPER, -0.18, 0.2, 0.44), box(0.24, 0.2, 0.02, M(0x1C6A78), 0.26, 0.36, 0.44), box(0.14, 0.4, 0.14, BONE, 0.32, 0.95, -0.12));
      return g; },
  };

  let st = { t: '', n: 0, i: -1, key: '' }, bgTo = new THREE.Color('#121A24'), totem = null, spin = 0, lastTop = feed.scrollTop;
  const pose = { x: 0, y: 0, s: 1 }, to = { x: 0, y: 0, s: 1 };
  function layout() {
    const w = app.clientWidth, h = app.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    const visH = 2 * cam.position.z * Math.tan(cam.fov * Math.PI / 360), u = visH / h, halfW = visH * cam.aspect / 2, halfH = visH / 2;
    if (st.i <= 0) { to.s = Math.min(0.78, halfW / 1.75); to.x = 0; to.y = halfH - Math.max(235, h * 0.345) * u; }   // cover: large, upper half
    else { to.s = 22 * u; to.x = halfW - 38 * u; to.y = halfH - (176 + (h < 700 ? -22 : 0)) * u; }             // idea card: small, top right, above the rail
  }
  function setCard(d) {
    const key = d.t + '|' + d.n + '|' + d.color;
    if (key !== st.key) {
      bgTo.set(d.color);
      chips.clear(); chips.add(mesh(baseGeo, BASE, 0, -0.035, 0));
      for (let k = 0; k < d.n; k++) { const c = mesh(chipGeo, COPPER, (k % 3 - 1) * 0.035, CH / 2 + k * CH, ((k * 7) % 5 - 2) * 0.02); c.rotation.y = k * 1.3; c.visible = false; c.userData = { y: c.position.y, drop: 0 }; chips.add(c); }
      if (totem) lift.remove(totem); totem = (TOTEM[d.t] || TOTEM.mind)(); lift.add(totem);
      st.key = key; st.i = -1;
    }
    chips.children.slice(1).forEach((c, k) => { const on = k < d.i; if (on && !c.visible && !still && d.i - st.i <= 2) c.userData.drop = 1; c.visible = on; });
    st.t = d.t; st.n = d.n; st.i = d.i; layout();
    if (still) { Object.assign(pose, to); frame(0, true); }
  }
  let prev = 0, drew = false;
  function frame(now, once) {
    const dt = Math.min(0.05, (now - prev) / 1000 || 0.016); prev = now;
    const k = once ? 1 : 1 - Math.pow(0.0012, dt);
    pose.x += (to.x - pose.x) * k; pose.y += (to.y - pose.y) * k; pose.s += (to.s - pose.s) * k;
    rig.position.set(pose.x, pose.y, 0); rig.scale.setScalar(pose.s);
    scene.background.lerp(bgTo, once ? 1 : Math.min(1, dt * 7));
    const top = feed.scrollTop; spin += (top - lastTop) * 0.006; lastTop = top; if (!still) spin += dt * 0.45;
    chips.children.slice(1).forEach(c => { const d = c.userData; if (d.drop > 0) { d.drop = Math.max(0, d.drop - dt * 2.6); const e = d.drop * d.drop; c.position.y = d.y + e * 3.2 + (d.drop < 0.25 ? Math.sin(d.drop * 12.6) * 0.05 : 0); } else c.position.y = d.y; });
    const top3 = Math.max(0, st.i) * CH; lift.position.y += (top3 - lift.position.y) * (once ? 1 : Math.min(1, dt * 9)); lift.rotation.y = spin;
    chips.rotation.y = spin * 0.25;
    renderer.render(scene, cam);
    if (!drew) { drew = true; app.classList.add('gl'); }
  }
  function loop(now) { if (!document.hidden && app.dataset.view === 'feed') frame(now); if (!still) requestAnimationFrame(loop); }
  addEventListener('stack:card', e => setCard(e.detail));
  new ResizeObserver(() => { layout(); if (still) frame(0, true); }).observe(app);
  canvas.addEventListener('webglcontextlost', () => app.classList.remove('gl'));
  layout(); if (window.__stackCard) setCard(window.__stackCard);
  if (still) frame(0, true); else requestAnimationFrame(loop);
  window.S3D = { scene, setCard };
}
