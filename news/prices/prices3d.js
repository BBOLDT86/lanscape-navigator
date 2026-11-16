/* The Watch · The Checkout: the 3-D stage.
   "Aisle": one ribbon per staple, running from 1980 at the back to this month at the front. Height is the official average
   price as a multiple of the item's first month on record; color is the 12-month change. Receipt prices from the ledger
   float over the ribbons as pins: green if they passed the checks, grey if unverified, red if rejected.
   "Map": the four census regions (the finest geography BLS publishes average prices for) rising and falling for one item.
   Data: data/view.json (tools/verify.py). three.js and the U.S. map are the wave's. */
import * as THREE from '../wave/lib/three.module.min.js';
import { loadGeo, flatShape, outlines } from '../wave/wave.js';

const BASE = new URL('./', import.meta.url).href;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const MON = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const usd = v => v == null ? '—' : '$' + v.toFixed(2);
const REGION = { '0100': ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'], '0200': ['IL', 'IN', 'MI', 'OH', 'WI', 'IA', 'KS', 'MN', 'MO', 'NE', 'ND', 'SD'], '0300': ['DE', 'DC', 'FL', 'GA', 'MD', 'NC', 'SC', 'VA', 'WV', 'AL', 'KY', 'MS', 'TN', 'AR', 'LA', 'OK', 'TX'] };
const regionOf = st => { for (const k in REGION) if (REGION[k].includes(st)) return k; return '0400'; };
const TIER = { solid: 0x3ddc97, unverified: 0xaab4c4, rejected: 0xff5a45 };

// 12-month change -> color: teal when falling, sand when flat, orange to red when rising fast
function heat(ch, out) {
  const stops = [[-0.10, [0.16, 0.66, 0.72]], [0.0, [0.55, 0.60, 0.62]], [0.04, [0.93, 0.78, 0.42]], [0.12, [0.96, 0.52, 0.22]], [0.30, [0.93, 0.22, 0.20]]];
  const c = clamp(ch, stops[0][0], stops[stops.length - 1][0]);
  for (let i = 1; i < stops.length; i++) if (c <= stops[i][0]) { const f = (c - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]); for (let k = 0; k < 3; k++) out[k] = lerp(stops[i - 1][1][k], stops[i][1][k], f); return out; }
  return out;
}

const VS = `precision highp float; uniform mat4 modelViewMatrix, projectionMatrix; attribute vec3 position; attribute vec3 aColor; attribute float aK; attribute float aShade;
varying vec3 vColor; varying float vK; varying float vY; varying float vFog;
void main(){ vColor = aColor * aShade; vK = aK; vY = position.y; vec4 mv = modelViewMatrix * vec4(position, 1.); vFog = clamp((-mv.z - 500.) / 1600., 0., 1.); gl_Position = projectionMatrix * mv; }`;
const FS = `precision highp float; uniform float uK; uniform float uDim; uniform vec3 uFog; varying vec3 vColor; varying float vK; varying float vY; varying float vFog;
void main(){ if (vK > uK) discard; float edge = smoothstep(uK - 5., uK, vK); vec3 c = vColor * (0.82 + 0.18 * clamp(vY / 60., 0., 1.)); c = mix(c, vec3(1.), edge * 0.35); c = mix(c, uFog, vFog * 0.8 + uDim); gl_FragColor = vec4(c, 1.); }`;

function label(text, size = 44, color = '#9fb0c6') {
  const c = document.createElement('canvas'); const g = c.getContext('2d'); g.font = `600 ${size}px Instrument Sans, system-ui, sans-serif`;
  c.width = Math.ceil(g.measureText(text).width) + 16; c.height = size + 16; g.font = `600 ${size}px Instrument Sans, system-ui, sans-serif`; g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 8, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(c.width / 4.4, c.height / 4.4, 1); return s;
}

export async function mount(el, opts = {}) {
  const O = Object.assign({ view: 'aisle', autoplay: true, dur: 40, rec: false }, opts);
  el.classList.add('ck-root');
  el.innerHTML = `<canvas class="ck-canvas" aria-hidden="true"></canvas><div class="ck-labels" aria-hidden="true"></div>
  <div class="ck-hud">
    <div class="ck-title"><p class="ck-kicker">Official average prices · U.S. cities</p><h2 class="ck-date">—</h2><p class="ck-sub"></p></div>
    <div class="ck-card"><p class="ck-ck">The Watch basket</p><b class="ck-basket">—</b><span class="ck-bsub"></span><span class="ck-cpi"></span></div>
    <div class="ck-legend"></div>
    <p class="ck-msg" hidden></p>
    <div class="ck-bar">
      <button type="button" class="ck-play" aria-label="Pause"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-pause" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/><path class="i-play" d="M8 5l11 7-11 7z"/></svg></button>
      <input class="ck-scrub" type="range" min="0" max="1000" value="0" aria-label="Month">
      <div class="ck-seg" role="group" aria-label="View"><button type="button" data-view="aisle">Aisle</button><button type="button" data-view="map">Map</button></div>
      <select class="ck-item" aria-label="Item"></select>
      <button type="button" class="ck-pins" aria-pressed="true">Receipts</button>
      <button type="button" class="ck-full" aria-label="Full screen">⤢</button>
    </div>
  </div>`;
  const $ = s => el.querySelector(s);
  const canvas = $('.ck-canvas'), labels = $('.ck-labels'), msg = $('.ck-msg');
  const V = await fetch(BASE + 'data/view.json', { cache: 'no-cache' }).then(r => r.json());
  if (!V.official || !V.items.length) { msg.hidden = false; msg.textContent = 'The official price series load on the next data run. The receipt ledger below is complete without them.'; el.classList.add('ck-empty'); return { ready: false }; }
  if (V.mock) { msg.hidden = false; msg.textContent = 'Sample numbers: made-up series for testing. Not real prices.'; msg.classList.add('warn'); }

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { msg.hidden = false; msg.textContent = 'This browser could not start WebGL; the tables below carry every number.'; return { ready: false }; }
  const FOG = new THREE.Color(0x0b1526);
  renderer.setClearColor(FOG, 1);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(36, 1, 1, 6000);
  const items = V.items.filter(i => O.items ? O.items.includes(i.id) : i.core !== false), N = items.length, NM = V.n_months;
  const DX = 30, W = 17, LEN = 620, HS = 26;
  const X = i => (i - (N - 1) / 2) * DX, Z = k => (k / (NM - 1) - 0.5) * LEN;
  const filled = items.map(it => { const a = []; let last = null; for (let k = 0; k < NM; k++) { if (it.m[k] != null) last = it.m[k]; a.push(k >= it.first ? last : null); } return a; });
  const base = items.map((it, i) => filled[i][it.first]);
  const idxAt = (i, kf) => { const a = filled[i]; const k0 = clamp(Math.floor(kf), 0, NM - 1), k1 = Math.min(k0 + 1, NM - 1); if (a[k0] == null) return null; const v = lerp(a[k0], a[k1] == null ? a[k0] : a[k1], kf - k0); return v; };

  /* ---------- aisle ---------- */
  const aisle = new THREE.Group(); scene.add(aisle);
  const mats = [];
  const tmp = [0, 0, 0];
  items.forEach((it, i) => {
    const pos = [], col = [], kk = [], sh = [], ind = [];
    const a = filled[i]; let n = 0;
    for (let k = it.first; k < NM; k++) {
      const h = a[k] / base[i] * HS, z = Z(k), x0 = X(i) - W / 2, x1 = X(i) + W / 2;
      const prev = k - 12 >= it.first ? a[k - 12] : null; heat(prev ? a[k] / prev - 1 : 0.02, tmp);
      // top (2), left wall (2), right wall (2)
      const vs = [[x0, h, z, 1], [x1, h, z, 1], [x0, 0, z, .52], [x0, h, z, .52], [x1, 0, z, .7], [x1, h, z, .7]];
      for (const v of vs) { pos.push(v[0], v[1], v[2]); col.push(tmp[0], tmp[1], tmp[2]); kk.push(k); sh.push(v[3]); }
      if (n) { const b = (n - 1) * 6, c = n * 6; ind.push(b, c, b + 1, b + 1, c, c + 1, b + 2, b + 3, c + 2, c + 2, b + 3, c + 3, b + 4, c + 4, b + 5, b + 5, c + 4, c + 5); }
      n++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aK', new THREE.Float32BufferAttribute(kk, 1)); g.setAttribute('aShade', new THREE.Float32BufferAttribute(sh, 1)); g.setIndex(ind);
    const m = new THREE.RawShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uK: { value: 0 }, uDim: { value: 0 }, uFog: { value: FOG } }, side: THREE.DoubleSide });
    mats.push(m); const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; aisle.add(mesh);
  });
  // the moving front face of each ribbon
  const heads = items.map((it, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(W, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })); m.position.x = X(i); aisle.add(m); return m; });
  // floor, year lines, the 1x line
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(N * DX + 120, LEN + 120), new THREE.MeshBasicMaterial({ color: 0x0f1d33 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.4; aisle.add(floor);
  const lp = []; const y0 = V.start;
  for (let y = y0; y <= y0 + Math.floor((NM - 1) / 12); y += 5) { const z = Z((y - y0) * 12); lp.push(-N * DX / 2 - 30, 0, z, N * DX / 2 + 10, 0, z); const s = label(String(y)); s.position.set(-N * DX / 2 - 52, 6, z); aisle.add(s); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); aisle.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a3d5c })));
  // receipt pins
  const pinG = new THREE.Group(); aisle.add(pinG);
  const pins = [];
  const byId = Object.fromEntries(items.map((it, i) => [it.id, i]));
  const postById = Object.fromEntries(V.posts.map(p => [p.id, p]));
  for (const r of V.rows) {
    const i = byId[r.item]; if (i == null || r.unit_price == null) continue;
    const k = (r.t - V.start) * 12; if (k < items[i].first || k > NM + 2) continue;
    const y = r.unit_price / base[i] * HS, z = Z(Math.min(k, NM - 1)), ref = idxAt(i, Math.min(k, NM - 1)) / base[i] * HS;
    const big = r.tier === 'rejected';
    const s = new THREE.Mesh(new THREE.SphereGeometry(big ? 5.2 : 3.6, 18, 12), new THREE.MeshBasicMaterial({ color: TIER[r.tier], depthTest: false, transparent: true })); s.renderOrder = 5; s.position.set(X(i), y, z + 1.5);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute([X(i), ref, z + 1.5, X(i), y, z + 1.5], 3));
    const st = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: TIER[r.tier], depthTest: false, transparent: true })); st.renderOrder = 4;
    pinG.add(s, st);
    const d = document.createElement('div'); d.className = 'ck-pin ' + r.tier; d.innerHTML = `<b>${usd(r.price)}</b> ${r.label.replace(/\s*\(.*\)$/, '')}<i>${r.tier === 'rejected' ? (postById[r.post] || {}).grade_name || 'Rejected' : r.kind === 'price check' ? 'Checked price' : r.tier === 'solid' ? 'Receipt' : 'Unverified receipt'} · ${r.date.slice(0, 4)}</i>`; labels.appendChild(d);
    pins.push({ k, s, st, d, r, i, y });
  }

  /* ---------- map ---------- */
  const map = new THREE.Group(); map.visible = false; scene.add(map);
  const regions = {}, annual = {}; let mapReady = false;
  loadGeo().then(geo => {
    const [minx, miny, maxx, maxy] = geo.bbox, S = 640 / (maxx - minx), cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    const plate = new THREE.Mesh(flatShape(geo.states, 0), new THREE.MeshBasicMaterial({ color: 0x13233c, side: THREE.DoubleSide })); const pg = new THREE.Group(); pg.add(plate); pg.scale.set(S, 1, S); pg.position.set(-cx * S, -0.5, -cy * S); map.add(pg);
    for (const a of ['0100', '0200', '0300', '0400']) {
      const sts = geo.states.filter(s => regionOf(s.st) === a);
      const top = new THREE.Mesh(flatShape(sts, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
      const wp = [], wi = [];
      for (const c of sts) for (const poly of c.polys) for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const b = wp.length / 3; wp.push(ring[j][0], 0, ring[j][1], ring[i][0], 0, ring[i][1], ring[i][0], 1, ring[i][1], ring[j][0], 1, ring[j][1]); wi.push(b, b + 1, b + 2, b, b + 2, b + 3); }
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setIndex(wi);
      const wall = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide }));
      const line = new THREE.LineSegments(outlines(sts, 1.001), new THREE.LineBasicMaterial({ color: 0x0b1526, transparent: true, opacity: .55 }));
      const g = new THREE.Group(); g.add(wall, top, line); g.scale.set(S, 1, S); g.position.set(-cx * S, 0, -cy * S); map.add(g);
      let sx = 0, sy = 0, sa = 0; for (const s of sts) { sx += s.cx * s.area; sy += s.cy * s.area; sa += s.area; }
      const d = document.createElement('div'); d.className = 'ck-reg'; labels.appendChild(d);
      regions[a] = { g, top, wall, d, c: new THREE.Vector3((sx / sa - cx) * S, 0, (sy / sa - cy) * S) };
    }
    mapReady = true;
  }).catch(() => { });

  /* ---------- state ---------- */
  const S = { view: O.view, t: 0, playing: O.autoplay, item: 0, pins: true, hold: 0, az: -0.55, el: 0.36, dist: 900, taz: -0.55, tel: 0.36, tdist: 900, drag: null, user: false };
  const sel = $('.ck-item'); sel.innerHTML = '<option value="-1">All items</option>' + items.map((it, i) => `<option value="${i}">${it.name}</option>`).join('');
  sel.value = '-1'; let focus = -1;
  const target = new THREE.Vector3(0, 40, 20);
  function preset() { if (S.view === 'aisle') { S.taz = -0.60; S.tel = 0.40; S.tdist = 1010; } else { S.taz = 0.0; S.tel = 0.78; S.tdist = 820; } S.user = false; }
  function setView(v) {
    S.view = v; aisle.visible = v === 'aisle'; map.visible = v === 'map'; el.dataset.view = v;
    el.querySelectorAll('.ck-seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === v));
    if (v === 'map' && focus < 0) { focus = Math.max(0, ['beef', 'bread', 'bacon'].map(k => byId[k]).find(i => i != null && Object.keys(items[i].regions).length === 4) ?? 0); sel.value = String(focus); }
    sel.options[0].disabled = v === 'map'; preset(); legend(); frame(true);
  }
  function legend() {
    $('.ck-legend').innerHTML = S.view === 'aisle'
      ? `<span class="sw"><i style="background:linear-gradient(90deg,#29a8b8,#8c999e,#edc76b,#f58538,#ed3833)"></i>12-month change: falling → rising fast</span><span class="dot solid">checked price</span><span class="dot unverified">unverified</span><span class="dot rejected">rejected</span>`
      : `<span class="sw"><i style="background:linear-gradient(90deg,#29a8b8,#8c999e,#f58538)"></i>15% cheaper than the U.S. average → 15% dearer</span>`;
    $('.ck-sub').textContent = S.view === 'aisle' ? 'Height: the price as a multiple of the item’s first month on record. Front edge: this month.' : 'The four census regions, the finest map the Bureau of Labor Statistics prices by. Height: the regional average price for the year. A region the bureau has stopped pricing for the item is grey, at its last figure.';
  }
  function resize() {
    const w = el.clientWidth, h = el.clientHeight; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  const v3 = new THREE.Vector3();
  const project = (x, y, z) => { v3.set(x, y, z).project(cam); return [(v3.x * .5 + .5) * el.clientWidth, (-v3.y * .5 + .5) * el.clientHeight, v3.z]; };
  const col = new THREE.Color();

  function frame(force) {
    const kf = S.t * (NM - 1), k = Math.round(kf);
    const narrow = cam.aspect < 0.9;
    S.az = lerp(S.az, S.taz, .08); S.el = lerp(S.el, S.tel, .08); S.dist = lerp(S.dist, S.tdist * (narrow ? clamp((S.view === 'aisle' ? 0.62 : 1.4) / cam.aspect, 1, 2.8) : 1), .08);
    const drift = S.playing && !S.user ? Math.sin(performance.now() / 9000) * 0.10 : 0;
    const az = S.az + drift + (narrow && S.view === 'aisle' && !S.user ? -0.5 : 0);
    target.set(S.view === 'aisle' ? 20 : 0, S.view === 'aisle' ? 34 : 30, S.view === 'aisle' ? 50 : 10);
    cam.position.set(target.x + Math.sin(az) * Math.cos(S.el) * S.dist, target.y + Math.sin(S.el) * S.dist, target.z + Math.cos(az) * Math.cos(S.el) * S.dist); cam.lookAt(target);
    const y = V.start + Math.floor(k / 12), mo = k % 12;
    $('.ck-date').textContent = MON[mo] + ' ' + y;
    if (V.basket) { const b = V.basket.m; let j = k; while (j >= 0 && b[j] == null) j--; const v = j >= 0 ? b[j] : null, f = b[V.basket.first]; $('.ck-basket').textContent = v == null ? 'not all priced yet' : usd(v); $('.ck-bsub').textContent = v == null ? '' : `${(v / f).toFixed(2)}× its ${V.start + Math.floor(V.basket.first / 12)} cost`; }
    const fh = V.indexes.food_home; if (fh) { const a = fh.m[k] ?? fh.m[k - 1], p = k >= 13 ? (fh.m[k - 12] ?? fh.m[k - 13]) : null; $('.ck-cpi').textContent = a && p ? `Groceries overall: ${(a / p - 1) * 100 >= 0 ? '+' : ''}${((a / p - 1) * 100).toFixed(1)}% in 12 months` : ''; }
    if (S.view === 'aisle') {
      const out = [];
      items.forEach((it, i) => {
        mats[i].uniforms.uK.value = kf; mats[i].uniforms.uDim.value = focus >= 0 && focus !== i ? 0.55 : 0;
        const v = idxAt(i, kf), hm = heads[i];
        if (v == null) { hm.visible = false; return; }
        const h = v / base[i] * HS; hm.visible = true; hm.scale.y = h; hm.position.set(X(i), h / 2, Z(kf));
        const pv = k - 12 >= it.first ? filled[i][k - 12] : null; heat(pv ? v / pv - 1 : 0.02, tmp); col.setRGB(tmp[0], tmp[1], tmp[2]).multiplyScalar(focus >= 0 && focus !== i ? 0.35 : 1.0); hm.material.color.copy(col);
        const p = project(X(i), h + 6, Z(kf)); out.push({ i, x: p[0], y: p[1], v, mult: v / base[i] });
      });
      // labels over the heads: two staggered rows, skip what would collide
      out.sort((a, b) => a.x - b.x); let html = ''; const lastX = [-999, -999]; const gap = narrow ? 46 : 78;
      for (const o of out) { const row = lastX[0] <= lastX[1] ? 0 : 1; if (o.x - lastX[row] < gap && focus !== o.i) continue; lastX[row] = o.x; html += `<div class="ck-lab${focus === o.i ? ' on' : ''}" style="left:${o.x.toFixed(1)}px;top:${(o.y - row * (narrow ? 26 : 30)).toFixed(1)}px"><b>${items[o.i].name}</b><span>${usd(o.v)} · ${o.mult.toFixed(1)}×</span></div>`; }
      $('.ck-labels').querySelectorAll('.ck-lab').forEach(n => n.remove()); $('.ck-labels').insertAdjacentHTML('afterbegin', html);
      let shown = 0;
      for (const p of pins) {
        const on = S.pins && kf >= p.k - 0.5 && (focus < 0 || focus === p.i); p.s.visible = p.st.visible = on;
        const lab = on && ((p.r.tier === 'rejected' && p.r.ratio > 1.6) || focus === p.i || (kf - p.k < 30 && shown < 2));
        if (lab) { const q = project(p.s.position.x, p.y + 7, p.s.position.z); p.d.style.cssText = `display:block;left:${q[0].toFixed(1)}px;top:${q[1].toFixed(1)}px`; if (p.r.tier !== 'rejected') shown++; } else p.d.style.display = 'none';
      }
      for (const a in regions) regions[a].d.style.display = 'none';
    } else {
      $('.ck-labels').querySelectorAll('.ck-lab').forEach(n => n.remove()); for (const p of pins) p.d.style.display = 'none';
      const it = items[focus < 0 ? 0 : focus], yf = kf / 12 - 0.5, y0i = clamp(Math.floor(yf), 0, 999), fr = clamp(yf - y0i, 0, 1);
      let mx = 0; for (const a in it.regions) for (const v of it.regions[a]) if (v) mx = Math.max(mx, v);
      const fi = focus < 0 ? 0 : focus; if (!annual[fi]) { annual[fi] = []; for (let yy = 0; yy * 12 < NM; yy++) { let s = 0, n = 0; for (let m = yy * 12; m < Math.min(NM, yy * 12 + 12); m++) if (it.m[m] != null) { s += it.m[m]; n++; } annual[fi].push(n ? s / n : null); } }
      const n0 = annual[fi][Math.min(y0i, annual[fi].length - 1)], n1 = annual[fi][Math.min(y0i + 1, annual[fi].length - 1)], nat = n0 == null ? null : lerp(n0, n1 == null ? n0 : n1, fr);
      $('.ck-date').textContent = String(V.start + Math.floor(kf / 12));
      for (const a in regions) {
        const R = regions[a], arr = it.regions[a]; const v0 = arr && arr[Math.min(y0i, arr.length - 1)], v1 = arr && arr[Math.min(y0i + 1, arr.length - 1)];
        let v = v0 == null ? null : lerp(v0, v1 == null ? v0 : v1, fr), stale = 0;
        if (v == null && arr) { for (let b = Math.min(y0i, arr.length - 1); b >= 0; b--) if (arr[b] != null) { v = arr[b]; stale = V.start + b; break; } }
        if (v == null || !mapReady) { R.g.visible = false; R.d.style.display = 'none'; continue; }
        const h = Math.max(1, v / mx * 150); R.g.visible = true; R.g.scale.y = h;
        { const u = clamp(nat ? (v / nat - 1) / 0.15 : 0, -1, 1), lo = [0.16, 0.66, 0.72], mid = [0.60, 0.65, 0.68], hi = [0.96, 0.52, 0.22], e = u < 0 ? lo : hi, f = Math.abs(u); col.setRGB(lerp(mid[0], e[0], f), lerp(mid[1], e[1], f), lerp(mid[2], e[2], f)); } if (stale) col.setRGB(0.30, 0.36, 0.44); R.top.material.color.copy(col); R.wall.material.color.copy(col).multiplyScalar(0.58);
        const q = project(R.c.x, h + 4, R.c.z); R.d.style.cssText = `display:block;left:${q[0].toFixed(1)}px;top:${q[1].toFixed(1)}px`; R.d.innerHTML = `<b>${usd(v)}</b>${V.areas[a]}${stale ? '<br>last priced ' + stale : ''}`;
      }
      $('.ck-kicker').textContent = `${it.long}, per ${it.unit} · U.S. ${usd(nat)} · yearly averages`;
    }
    if (S.view === 'aisle') $('.ck-kicker').textContent = 'Official average prices · U.S. cities';
    renderer.render(scene, cam);
    if (!S.drag) $('.ck-scrub').value = Math.round(S.t * 1000);
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (S.playing) { if (S.t >= 1) { S.hold += dt; if (S.hold > 6) { S.t = 0; S.hold = 0; } } else S.t = Math.min(1, S.t + dt / O.dur); }
    frame(); raf = requestAnimationFrame(tick);
  }
  let raf;
  /* ---------- controls ---------- */
  const playB = $('.ck-play');
  const setPlay = p => { S.playing = p; playB.classList.toggle('paused', !p); playB.setAttribute('aria-label', p ? 'Pause' : 'Play'); if (p && S.t >= 1) { S.t = 0; S.hold = 0; } };
  playB.onclick = () => setPlay(!S.playing);
  $('.ck-scrub').oninput = e => { S.t = e.target.value / 1000; S.drag = true; setPlay(false); }; $('.ck-scrub').onchange = () => { S.drag = null; };
  el.querySelectorAll('.ck-seg button').forEach(b => b.onclick = () => setView(b.dataset.view));
  sel.onchange = () => { focus = +sel.value; };
  $('.ck-pins').onclick = e => { S.pins = !S.pins; e.currentTarget.setAttribute('aria-pressed', S.pins); };
  $('.ck-full').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => el.classList.toggle('ck-theater')); else el.classList.toggle('ck-theater'); setTimeout(resize, 60); };
  document.addEventListener('fullscreenchange', () => setTimeout(resize, 60));
  let pd = null, pinch = 0; const pts = new Map();
  canvas.addEventListener('pointerdown', e => { pts.set(e.pointerId, e); canvas.setPointerCapture(e.pointerId); pd = { x: e.clientX, y: e.clientY, az: S.taz, el: S.tel }; S.user = true; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); } });
  canvas.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e); if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); if (pinch) S.tdist = clamp(S.tdist * pinch / d, 320, 1800); pinch = d; return; } if (!pd) return; S.taz = pd.az - (e.clientX - pd.x) * 0.006; S.tel = clamp(pd.el + (e.clientY - pd.y) * 0.004, 0.08, 1.35); });
  const up = e => { pts.delete(e.pointerId); pd = null; pinch = 0; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { if (!(e.ctrlKey || document.fullscreenElement || el.classList.contains('ck-theater'))) return; e.preventDefault(); S.tdist = clamp(S.tdist * (1 + e.deltaY * 0.001), 320, 1800); }, { passive: false });
  new ResizeObserver(resize).observe(el); resize();
  if (O.rec) el.classList.add('ck-rec');
  setView(S.view); setPlay(S.playing);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches && !O.rec) { S.t = 1; setPlay(false); }
  const io = new IntersectionObserver(es => { for (const e of es) { if (e.isIntersecting) { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } } else { cancelAnimationFrame(raf); raf = 0; } } }); io.observe(el);
  const api = { ready: true, seek(t) { S.t = clamp(t, 0, 1); frame(true); }, play: () => setPlay(true), pause: () => setPlay(false), setView, focus(id) { focus = byId[id] ?? -1; sel.value = String(focus); }, state: S };
  window.CK = api; return api;
}
