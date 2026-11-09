/* The Mandate in 3-D: the 30 chapters of the Mandate for Leadership as towers, one block per proposal The Watch tracks, lit by
   what became of it. three.js (vendored by the wave, r170). Views: city (five rows, one per section of the book), status (the
   same blocks regrouped into one tower per status), tour (the city with a camera path and captions). window.M3D controls it. */
import * as THREE from '../wave/lib/three.module.min.js';

const COL = { done: 0xEBD08E, 'in progress': 0xA7843A, partial: 0x6B5A2C, 'blocked by courts': 0xE8705A, reversed: 0x6F7D90, 'not attempted': 0x8494A9 };
const EMIT = { done: 0x6E500C, 'in progress': 0x2a2010, partial: 0x1a150a, 'blocked by courts': 0x5a1a10, reversed: 0x0e141c, 'not attempted': 0x000000 };
const ORDER = ['done', 'in progress', 'partial', 'blocked by courts', 'reversed', 'not attempted'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const BH = 0.9, GAP = 0.12, FOOT = 1.7, DX = 3.0, DZ = 6.5;

function label(text, size = 48, color = '#cfdbeb', weight = 400, font = 'Instrument Sans, system-ui, sans-serif') {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  ctx.font = `${weight} ${size}px ${font}`;
  const w = Math.ceil(ctx.measureText(text).width) + 24, h = size + 24;
  c.width = w; c.height = h;
  ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, 12, h / 2);
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const s = 0.022; sp.scale.set(w * s, h * s, 1);
  return sp;
}

export async function mount(root) {
  const data = await (await fetch(root.dataset.src, { cache: 'no-store' })).json();
  const full = root.dataset.full === '1';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(0x0b1526, 1);
  root.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x0b1526, 70, 160);
  const cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 400);
  scene.add(new THREE.HemisphereLight(0xdfe8f3, 0x1b2a3f, 1.15));
  const sun = new THREE.DirectionalLight(0xfff2d6, 1.6); sun.position.set(30, 50, 20); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x7fb0ff, 0.5); fill.position.set(-40, 20, -30); scene.add(fill);

  // the ground and its grid
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x0f1d31, roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; scene.add(ground);
  const grid = new THREE.GridHelper(160, 64, 0x1c3049, 0x162740); grid.position.y = 0; scene.add(grid);

  // layouts: where each chapter's tower stands in each view
  const chapters = data.chapters.slice().sort((a, b) => a.section - b.section || a.num - b.num);
  const bySec = new Map(); chapters.forEach(c => { if (!bySec.has(c.section)) bySec.set(c.section, []); bySec.get(c.section).push(c); });
  const rows = [...bySec.keys()].sort();
  const cityPos = new Map(); let maxRowW = 0;
  rows.forEach((s, ri) => { const list = bySec.get(s); const w = (list.length - 1) * DX; maxRowW = Math.max(maxRowW, w); list.forEach((c, i) => cityPos.set(c.num, { x: i * DX - w / 2, z: (ri - (rows.length - 1) / 2) * DZ })); });
  const center = new THREE.Vector3(0, 2, 0);

  // the blocks
  const blocks = []; const towers = new Map(); const geo = new THREE.BoxGeometry(FOOT, BH, FOOT); const edgeGeo = new THREE.EdgesGeometry(geo);
  const mats = {}; for (const k of ORDER) mats[k] = new THREE.MeshStandardMaterial({ color: COL[k], emissive: EMIT[k], emissiveIntensity: k === 'done' ? 0.55 : 0.35, roughness: 0.55, metalness: 0.15 });
  const ghostMat = new THREE.MeshStandardMaterial({ color: 0x8494a9, transparent: true, opacity: 0.12, roughness: 1 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x8494a9, transparent: true, opacity: 0.8 });
  const group = new THREE.Group(); scene.add(group);
  chapters.forEach(c => {
    const t = { chapter: c, meshes: [], base: null, lab: null };
    const p = cityPos.get(c.num);
    const base = new THREE.Mesh(new THREE.BoxGeometry(FOOT + 0.5, 0.18, FOOT + 0.5), new THREE.MeshStandardMaterial({ color: 0x1a2c44, roughness: 0.9 }));
    base.position.set(p.x, 0.09, p.z); group.add(base); t.base = base;
    const lab = label(String(c.num), 44, '#D6B25E', 400, 'Instrument Serif, Georgia, serif'); lab.position.set(p.x, 0.9, p.z + FOOT / 2 + 0.9); group.add(lab); t.lab = lab;
    const list = c.blocks.slice().sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
    if (!list.length) { // not tracked yet: a faint ghost of the chapter's proposals
      const n = Math.max(1, Math.min(c.proposals || 1, 4));
      for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, ghostMat); m.scale.y = 0.35; m.position.set(p.x, 0.18 + 0.2 + i * 0.38, p.z); m.userData = { chapter: c, ghost: true }; group.add(m); t.meshes.push(m); blocks.push(m); }
    }
    list.forEach((b, i) => {
      let m;
      if (b.status === 'not attempted') { m = new THREE.LineSegments(edgeGeo, edgeMat); m.userData.hollow = true; }
      else m = new THREE.Mesh(geo, mats[b.status]);
      m.userData = Object.assign(m.userData || {}, { chapter: c, block: b, i });
      m.position.set(p.x, 0.18 + BH / 2 + i * (BH + GAP), p.z); group.add(m); t.meshes.push(m); blocks.push(m);
    });
    towers.set(c.num, t);
  });
  // section names along the left edge
  const secLabels = rows.map((s, ri) => { const list = bySec.get(s); const w = (list.length - 1) * DX; const sp = label(data.sections[s] || `Section ${s + 1}`, 40, '#e9f0f8', 600); sp.position.set(-w / 2 - 2.6, 0.7, (ri - (rows.length - 1) / 2) * DZ); sp.center.set(1, 0.5); group.add(sp); return sp; });
  // status columns for the sorted view
  const statusLabels = ORDER.map((k, i) => { const sp = label(data.statuses[k] || k, 36, '#cfdbeb', 600); sp.position.set((i - 2.5) * 4.2, 0.9, 4.2); sp.visible = false; group.add(sp); return sp; });

  // targets per view
  const targets = new Map(); // mesh -> {x,y,z}
  function layout(view) {
    if (view === 'status') {
      const count = {}; ORDER.forEach(k => count[k] = 0);
      blocks.forEach(m => { const k = m.userData.block ? m.userData.block.status : null; if (!k) { targets.set(m, { x: 0, y: -5, z: 40 }); return; } const i = ORDER.indexOf(k); const n = count[k]++; targets.set(m, { x: (i - 2.5) * 4.2, y: 0.18 + BH / 2 + n * (BH + GAP), z: 0 }); });
      towers.forEach(t => { t.base.userData.target = { vis: false }; t.lab.userData.target = { vis: false }; });
      secLabels.forEach(s => s.userData.target = { vis: false }); statusLabels.forEach(s => s.userData.target = { vis: true });
    } else {
      blocks.forEach(m => { const p = cityPos.get(m.userData.chapter.num); const i = m.userData.i || 0; const y = m.userData.ghost ? m.position.y : 0.18 + BH / 2 + i * (BH + GAP); targets.set(m, { x: p.x, y: m.userData.ghost ? m.userData.gy || (m.userData.gy = m.position.y) : y, z: p.z }); });
      towers.forEach(t => { t.base.userData.target = { vis: true }; t.lab.userData.target = { vis: true }; });
      secLabels.forEach(s => s.userData.target = { vis: true }); statusLabels.forEach(s => s.userData.target = { vis: false });
    }
  }
  let morph = 1; // 0..1 progress of the move between layouts
  const from = new Map();
  function setLayout(view) { blocks.forEach(m => from.set(m, m.position.clone())); layout(view); morph = 0; }

  // the camera: an orbit around the center, driven by autoplay, the tour or the reader
  const camState = { az: 0.9, el: 0.52, dist: full ? 44 : 40, pan: new THREE.Vector3() };
  let userCam = null, autoplay = true, mode = 'city', t0 = performance.now(), tourT = 0, lastT = performance.now();
  function place() {
    const c = center.clone().add(camState.pan);
    cam.position.set(c.x + camState.dist * Math.cos(camState.el) * Math.sin(camState.az), c.y + camState.dist * Math.sin(camState.el), c.z + camState.dist * Math.cos(camState.el) * Math.cos(camState.az));
    cam.lookAt(c);
  }
  // the tour: captions and camera stops, from the data or built from the sections
  const tour = (data.tour && data.tour.length) ? data.tour : rows.map((s, ri) => {
    const list = bySec.get(s); const tot = list.reduce((a, c) => a + c.blocks.length, 0); const done = list.reduce((a, c) => a + c.blocks.filter(b => b.status === 'done').length, 0); const blk = list.reduce((a, c) => a + c.blocks.filter(b => b.status === 'blocked by courts').length, 0);
    return { dur: 7, section: s, caption: data.sections[s], sub: tot ? `${done} of the ${tot} proposals we track here are done; ${blk} blocked by the courts.` : 'Chapters not yet tracked.', az: 0.6 + ri * 0.35, el: 0.42, dist: 22 };
  });
  const tourLen = tour.reduce((a, s) => a + (s.dur || 7), 0) + 3;
  function tourAt(t) { let acc = 0; for (let i = 0; i < tour.length; i++) { const d = tour[i].dur || 7; if (t < acc + d) return { i, p: (t - acc) / d }; acc += d; } return { i: tour.length - 1, p: 1 }; }
  function tourTarget(stop) {
    const pan = new THREE.Vector3(); if (stop.section !== undefined) { const ri = rows.indexOf(stop.section); pan.set(0, 0, (ri - (rows.length - 1) / 2) * DZ); }
    if (stop.chapter !== undefined && cityPos.get(stop.chapter)) { const p = cityPos.get(stop.chapter); pan.set(p.x, 0, p.z); }
    return { az: stop.az ?? 0.8, el: stop.el ?? 0.45, dist: stop.dist ?? 20, pan };
  }

  // HUD
  const hud = document.createElement('div'); hud.className = 'm3d-hud'; root.appendChild(hud);
  const cap = document.createElement('div'); cap.className = 'm3d-cap'; root.appendChild(cap);
  const leg = document.createElement('div'); leg.className = 'm3d-leg'; leg.innerHTML = ORDER.map(k => `<span><i style="background:#${COL[k].toString(16).padStart(6, '0')};${k === 'not attempted' ? 'background:transparent;box-shadow:inset 0 0 0 1.5px #8494a9' : ''}"></i>${data.statuses[k] || k}</span>`).join(''); root.appendChild(leg);
  const tip = document.createElement('div'); tip.className = 'm3d-tip'; tip.hidden = true; root.appendChild(tip);
  const total = blocks.filter(m => m.userData.block).length, nDone = blocks.filter(m => m.userData.block && m.userData.block.status === 'done').length, nBlk = blocks.filter(m => m.userData.block && m.userData.block.status === 'blocked by courts').length;
  function hudText(h2, p) { hud.innerHTML = `<span class="k">The Watch · The Mandate</span><h2>${h2}</h2><p>${p}</p>`; }
  hudText('Project 2025, chapter by chapter', `${chapters.length} chapters, ${total} proposals tracked: ${nDone} done, ${nBlk} blocked by the courts. One tower per chapter, one block per proposal.`);

  // picking
  const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2(); let hoverTower = null;
  const card = document.getElementById('chapterCard');
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect(); ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, cam); const hits = ray.intersectObjects(blocks.filter(m => m.isMesh), false);
    return hits.length ? hits[0].object.userData.chapter : null;
  }
  function describe(c) { const n = c.blocks.length, d = c.blocks.filter(b => b.status === 'done').length, b = c.blocks.filter(b => b.status === 'blocked by courts').length; return n ? `${n} tracked · ${d} done · ${b} blocked` : `${c.proposals || 0} proposals, none tracked yet`; }
  root.addEventListener('pointermove', ev => {
    if (dragging && dragging.moved) return;
    const c = pick(ev); hoverTower = c;
    if (!c) { tip.hidden = true; return; }
    const r = root.getBoundingClientRect(); tip.style.left = (ev.clientX - r.left) + 'px'; tip.style.top = (ev.clientY - r.top) + 'px';
    tip.innerHTML = `<b>Chapter ${c.num}: ${c.title}</b>${c.authors && c.authors.length ? c.authors.join(', ') + ' · ' : ''}${describe(c)}`; tip.hidden = false;
  });
  root.addEventListener('pointerleave', () => { tip.hidden = true; });
  function showChapter(c) {
    if (!card) return; card.hidden = false;
    const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const cls = { done: 's-done', 'in progress': 's-prog', partial: 's-part', 'blocked by courts': 's-block', reversed: 's-rev', 'not attempted': 's-none' };
    card.innerHTML = `<span class="k">Chapter ${c.num} · ${esc(data.sections[c.section] || '')}${c.agency ? ' · ' + esc(c.agency) : ''}</span><b>${esc(c.title)}</b>${c.authors && c.authors.length ? `<span class="muted"> — ${esc(c.authors.join(', '))}</span>` : ''}
      <ul>${c.blocks.map(b => `<li><span class="pill ${cls[b.status] || 's-none'}">${esc(data.statuses[b.status] || b.status)}</span><span><a href="scorecard.html#${esc(b.id)}">${esc(b.proposal)}</a>${b.action ? ` <span class="muted">${esc(b.action)}</span>` : ''}</span></li>`).join('') || '<li class="muted">No proposals from this chapter are tracked yet; the scorecard grows with each sprint.</li>'}</ul>
      <p class="src"><a href="scorecard.html#ch-${c.num}">This chapter on the scorecard ›</a></p>`;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // the reader's hand
  let dragging = null, pinch = null;
  root.addEventListener('pointerdown', ev => { dragging = { x: ev.clientX, y: ev.clientY, az: camState.az, el: camState.el, moved: false }; root.setPointerCapture(ev.pointerId); });
  root.addEventListener('pointermove', ev => { if (!dragging) return; const dx = ev.clientX - dragging.x, dy = ev.clientY - dragging.y; if (Math.abs(dx) + Math.abs(dy) > 4) dragging.moved = true; if (!dragging.moved) return; userCam = userCam || { az: camState.az, el: camState.el, dist: camState.dist, pan: camState.pan.clone() }; userCam.az = dragging.az - dx * 0.006; userCam.el = clamp(dragging.el + dy * 0.004, 0.12, 1.35); Object.assign(camState, { az: userCam.az, el: userCam.el }); tip.hidden = true; });
  root.addEventListener('pointerup', ev => { if (dragging && !dragging.moved) { const c = pick(ev); if (c) showChapter(c); } dragging = null; });
  root.addEventListener('wheel', ev => { ev.preventDefault(); userCam = userCam || { az: camState.az, el: camState.el, dist: camState.dist, pan: camState.pan.clone() }; userCam.dist = clamp(userCam.dist * (1 + ev.deltaY * 0.001), 8, 90); camState.dist = userCam.dist; }, { passive: false });
  root.addEventListener('touchstart', ev => { if (ev.touches.length === 2) pinch = Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY); }, { passive: true });
  root.addEventListener('touchmove', ev => { if (ev.touches.length === 2 && pinch) { const d = Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY); userCam = userCam || { az: camState.az, el: camState.el, dist: camState.dist, pan: camState.pan.clone() }; userCam.dist = clamp(userCam.dist * pinch / d, 8, 90); camState.dist = userCam.dist; pinch = d; } }, { passive: true });
  root.addEventListener('dblclick', () => { userCam = null; });

  // size
  function resize() { const w = root.clientWidth || 640, h = root.clientHeight || 360; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(root); resize();

  // the loop
  const tmp = new THREE.Vector3();
  function frame(now) {
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    if (morph < 1) { morph = Math.min(1, morph + dt / 1.3); const e = ease(morph); blocks.forEach(m => { const a = from.get(m), b = targets.get(m); if (a && b) m.position.set(lerp(a.x, b.x, e), lerp(a.y, b.y, e), lerp(a.z, b.z, e)); }); }
    [...towers.values()].forEach(t => { [t.base, t.lab].forEach(o => { const tg = o.userData.target; if (!tg) return; const want = tg.vis ? 1 : 0; const mat = o.material; mat.transparent = true; mat.opacity = lerp(mat.opacity ?? 1, want, Math.min(1, dt * 4)); o.visible = mat.opacity > 0.02; }); });
    [...secLabels, ...statusLabels].forEach(o => { const tg = o.userData.target; if (!tg) return; const want = tg.vis ? 1 : 0; o.material.opacity = lerp(o.material.opacity, want, Math.min(1, dt * 4)); o.visible = o.material.opacity > 0.02; });
    if (mode === 'tour' && autoplay) {
      tourT += dt; if (tourT > tourLen) tourT = 0;
      const { i, p } = tourAt(tourT); const stop = tour[i]; const tg = tourTarget(stop);
      const k = Math.min(1, dt * 1.8); camState.az = lerp(camState.az, tg.az + p * 0.25, k); camState.el = lerp(camState.el, tg.el, k); camState.dist = lerp(camState.dist, tg.dist, k); camState.pan.lerp(tg.pan, k);
      cap.innerHTML = `<b>${stop.caption || ''}</b><span>${stop.sub || ''}</span>`; cap.style.opacity = p < 0.08 ? p / 0.08 : p > 0.92 ? (1 - p) / 0.08 : 1;
      if (stop.chapter !== undefined) towers.forEach((t, n) => t.meshes.forEach(m => { if (m.material && m.material.emissiveIntensity !== undefined && !m.userData.ghost) m.material.emissiveIntensity = n === stop.chapter ? 0.9 : (m.userData.block && m.userData.block.status === 'done' ? 0.55 : 0.35); }));
    } else if (autoplay && !userCam) {
      camState.az += dt * 0.09; camState.el = lerp(camState.el, mode === 'status' ? 0.38 : 0.52, Math.min(1, dt)); camState.dist = lerp(camState.dist, mode === 'status' ? 36 : (full ? 44 : 40), Math.min(1, dt)); camState.pan.lerp(tmp.set(0, mode === 'status' ? 4 : 0, 0), Math.min(1, dt * 2));
      cap.innerHTML = '';
    } else if (userCam) { camState.pan.lerp(userCam.pan, Math.min(1, dt * 3)); }
    place(); renderer.render(scene, cam); requestAnimationFrame(frame);
  }
  layout('city'); blocks.forEach(m => { const b = targets.get(m); if (b) m.position.set(b.x, b.y, b.z); });
  requestAnimationFrame(frame);

  const ctl = {
    get playing() { return autoplay; },
    play() { autoplay = true; userCam = null; }, pause() { autoplay = false; },
    replay() { tourT = 0; autoplay = true; userCam = null; },
    setView(v) { mode = v; userCam = null; autoplay = true; if (v === 'status') { setLayout('status'); hudText('The same blocks, sorted by what became of them', `${total} proposals: ${ORDER.map(k => `${blocks.filter(m => m.userData.block && m.userData.block.status === k).length} ${(data.statuses[k] || k).toLowerCase()}`).join(', ')}.`); } else { if (targets.size && mode !== 'status') { } setLayout('city'); if (v === 'tour') { tourT = 0; hudText('The fly-through', 'The five sections of the Mandate in order, with what became of each.'); } else hudText('Project 2025, chapter by chapter', `${chapters.length} chapters, ${total} proposals tracked: ${nDone} done, ${nBlk} blocked by the courts. One tower per chapter, one block per proposal.`); cap.innerHTML = ''; } },
    showChapter,
  };
  window.M3D = ctl;
  return ctl;
}

const root = document.getElementById('m3d');
if (root) mount(root).catch(e => { root.insertAdjacentHTML('beforeend', '<div class="m3d-hud"><h2>The 3-D view needs WebGL.</h2><p>Your browser could not start it. The scorecard below has every block as a row.</p></div>'); console.warn(e); });
