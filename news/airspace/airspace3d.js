/* The Watch · The quiet sky: every aircraft the ADSB.lol network tracked over the United States on Nov. 13, 2026,
   from 2 p.m. to 11 p.m. Eastern, replayed in 3-D. Each point is one real aircraft at its recorded position, lifted
   by its recorded altitude (exaggerated); its tail is where it was over the last few minutes.
   Data: data/tracks.bin.gz and data/meta.json (tools/fetch.py); the map is the wave's. */
import * as THREE from '../wave/lib/three.module.min.js';
import { loadGeo, flatShape, outlines } from '../wave/wave.js';

const BASE = new URL('./', import.meta.url).href;
const NUM = new Intl.NumberFormat('en-US');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const Q = 16, ALT_Y = 0.21; // map units per 250 ft: about 14 times true scale, so cruise sits ~33 units over a 975-unit map
const TRAIL = 7; // minutes of tail

// d3.geoAlbersUsa().scale(1300).translate([487.5, 305]), lower 48 (the same math as tools/proj.py)
const project = (() => {
  const r = Math.PI / 180, p0 = 29.5 * r, p1 = 45.5 * r, sy0 = Math.sin(p0), n = (sy0 + Math.sin(p1)) / 2, c = 1 + sy0 * (2 * n - sy0), r0 = Math.sqrt(c) / n;
  const raw = (l, p) => { const q = Math.sqrt(c - 2 * n * Math.sin(p)) / n; return [q * Math.sin(l * n), r0 - q * Math.cos(l * n)]; };
  const [cx, cy] = raw(-0.6 * r, 38.7 * r);
  return (lon, lat) => { const [x, y] = raw((lon + 96) * r, lat * r); return [487.5 + 1300 * (x - cx), 305 - 1300 * (y - cy)]; };
})();

// the 30 busiest passenger airports of the lower 48 (FAA code, lon, lat)
const HUBS = [['ATL', -84.428, 33.637], ['DFW', -97.038, 32.897], ['DEN', -104.673, 39.856], ['ORD', -87.905, 41.978], ['LAX', -118.408, 33.943], ['JFK', -73.779, 40.640],
  ['CLT', -80.943, 35.214], ['LAS', -115.152, 36.080], ['MCO', -81.309, 28.429], ['MIA', -80.291, 25.793], ['PHX', -112.012, 33.434], ['SEA', -122.309, 47.449],
  ['SFO', -122.375, 37.619], ['EWR', -74.169, 40.693], ['IAH', -95.341, 29.984], ['BOS', -71.005, 42.364], ['MSP', -93.222, 44.882], ['FLL', -80.153, 26.073],
  ['LGA', -73.874, 40.777], ['DTW', -83.353, 42.212], ['PHL', -75.241, 39.872], ['SLC', -111.978, 40.788], ['BWI', -76.668, 39.175], ['DCA', -77.038, 38.852],
  ['SAN', -117.190, 32.734], ['IAD', -77.456, 38.944], ['TPA', -82.533, 27.975], ['BNA', -86.678, 36.124], ['AUS', -97.670, 30.194], ['MDW', -87.752, 41.786]];
const LABELED = new Set(['ATL', 'DFW', 'DEN', 'ORD', 'LAX', 'JFK', 'SEA', 'SFO', 'MIA', 'PHX', 'BOS', 'MSP', 'IAH', 'SLC', 'CLT', 'LAS']);

const P_VS = `precision highp float; uniform mat4 modelViewMatrix, projectionMatrix; attribute vec3 position; attribute float aAlt;
uniform float uPx; uniform float uSize; uniform float uGround; varying float vAlt; varying float vFog;
void main(){ vec3 p = position; if (uGround > 0.5) p.y = 0.25; vec4 mv = modelViewMatrix * vec4(p, 1.);
  vAlt = aAlt; vFog = clamp((-mv.z - 900.) / 1900., 0., 1.);
  gl_PointSize = clamp(uSize * uPx * 900. / -mv.z, 1.2 * uPx, 9. * uPx); gl_Position = projectionMatrix * mv; }`;
const P_FS = `precision highp float; uniform float uGround; uniform float uAlpha; varying float vAlt; varying float vFog;
void main(){ vec2 d = gl_PointCoord - .5; float r = length(d) * 2.; if (r > 1.) discard; float a = 1. - smoothstep(.25, 1., r);
  vec3 lo = vec3(1.0, .69, .32), hi = vec3(.80, .93, 1.0); vec3 c = mix(lo, hi, smoothstep(24., 110., vAlt));
  if (uGround > .5) { gl_FragColor = vec4(.36, .56, .86, a * .22 * (1. - vFog)); return; }
  gl_FragColor = vec4(c, a * uAlpha * (1. - vFog * .55)); }`;
const T_VS = `precision highp float; uniform mat4 modelViewMatrix, projectionMatrix; attribute vec3 position; attribute float aA; attribute float aAlt; varying float vA; varying float vAlt;
void main(){ vA = aA; vAlt = aAlt; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const T_FS = `precision highp float; varying float vA; varying float vAlt;
void main(){ vec3 c = mix(vec3(1.0, .69, .32), vec3(.62, .82, 1.0), smoothstep(24., 110., vAlt)); gl_FragColor = vec4(c, vA * .5); }`;
const H_VS = `precision highp float; uniform mat4 modelViewMatrix, projectionMatrix; attribute vec3 position; uniform float uPx; uniform float uPulse;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = clamp((26. + 10. * uPulse) * uPx * 900. / -mv.z, 6. * uPx, 44. * uPx); gl_Position = projectionMatrix * mv; }`;
const H_FS = `precision highp float; uniform vec3 uColor; uniform float uPulse; uniform float uOn;
void main(){ float r = length(gl_PointCoord - .5) * 2.; if (r > 1.) discard; float g = pow(1. - r, 2.2); float core = 1. - smoothstep(.0, .22, r);
  gl_FragColor = vec4(uColor, (g * (.30 + .30 * uPulse) + core * .7) * uOn); }`;

async function loadTracks() {
  const res = await fetch(BASE + 'data/tracks.bin.gz'); if (!res.ok) throw new Error('tracks ' + res.status);
  let buf = await res.arrayBuffer();
  const h = new Uint8Array(buf, 0, 2);
  if (h[0] === 0x1f && h[1] === 0x8b) { // still gzipped (the host served the file as it is)
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot unpack the flight data.');
    buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  const dv = new DataView(buf); if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'WAIR') throw new Error('bad flight data');
  const nF = dv.getUint16(5, true), t0 = dv.getUint32(7, true), step = dv.getUint16(11, true), n = dv.getUint32(13, true), tot = dv.getUint32(17, true);
  let o = 21; const take = (Type, count) => { const bytes = count * Type.BYTES_PER_ELEMENT; const a = new Type(buf.slice(o, o + bytes)); o += bytes; return a; };
  const start = take(Uint16Array, n), len = take(Uint16Array, n), flags = take(Uint8Array, n), x0 = take(Int16Array, n), y0 = take(Int16Array, n), cs = take(Uint8Array, n * 8);
  const alt = take(Uint8Array, tot), dx = take(Int8Array, tot - n), dy = take(Int8Array, tot - n);
  const X = new Int16Array(tot), Y = new Int16Array(tot), off = new Uint32Array(n + 1);
  let p = 0, d = 0, maxEnd = 0;
  for (let i = 0; i < n; i++) { off[i] = p; let x = x0[i], y = y0[i]; X[p] = x; Y[p] = y; p++; for (let j = 1; j < len[i]; j++) { x += dx[d]; y += dy[d]; d++; X[p] = x; Y[p] = y; p++; } maxEnd = Math.max(maxEnd, start[i] + len[i]); }
  off[n] = p;
  // the most aircraft in any one frame, to size the buffers
  const per = new Int32Array(nF + 1); for (let i = 0; i < n; i++) { per[start[i]]++; per[Math.min(nF, start[i] + len[i])]--; }
  let run = 0, cap = 0; for (let f = 0; f < nF; f++) { run += per[f]; cap = Math.max(cap, run); }
  return { nF, t0, step, n, tot, start, len, flags, cs, alt, X, Y, off, cap };
}

export const fmtClock = (unix) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(unix * 1000)).replace('AM', 'a.m.').replace('PM', 'p.m.');

export async function mount(el, opts = {}) {
  const O = Object.assign({ autoplay: true, rec: false, embed: false, dur: 64, events: [], stop: null, lift: null, onFull: null, vertical: false }, opts);
  el.classList.add('aq-root'); if (O.vertical) el.classList.add('aq-vertical');
  el.innerHTML = `<canvas class="aq-canvas" aria-hidden="true"></canvas><div class="aq-labels" aria-hidden="true"></div>
  <div class="aq-hud">
    <div class="aq-title"><p class="aq-kicker">Nov. 13, 2026 · recorded aircraft positions</p><div class="aq-clock"><b>–</b><span class="aq-badge" hidden>Ground stop in force</span></div><p class="aq-cap"></p></div>
    <div class="aq-count"><b data-n="us">–</b><span>aircraft in the air<i class="wide"> over the lower 48</i></span><div class="aq-sub"><i data-n="pct"></i><i data-n="high"></i></div></div>
    <div class="aq-legend"><span class="sw lo"></span>below 6,000 ft <span class="sw hi"></span>cruising altitude <span class="sw hub"></span>major airport</div>
    <div class="aq-bar">
      <button type="button" class="aq-play" aria-label="Pause"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-pause" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/><path class="i-play" d="M8 5l11 7-11 7z"/></svg></button>
      <div class="aq-line"><svg class="aq-spark" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"></svg><div class="aq-marks"></div><input type="range" min="0" max="1000" value="0" step="1" aria-label="Time of day"><div class="aq-head"></div></div>
      <div class="aq-btns"><button type="button" data-a="view" aria-pressed="false">Top view</button>${O.embed ? `<a href="./" target="_blank" rel="noopener">Open ↗</a>` : `<button type="button" data-a="full">Full screen</button>`}</div>
    </div>
    <div class="aq-tip" hidden></div>
  </div>`;
  const canvas = el.querySelector('canvas'), hud = el.querySelector('.aq-hud'), tip = el.querySelector('.aq-tip'), labels = el.querySelector('.aq-labels');
  const $ = s => hud.querySelector(s);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!O.rec, powerPreference: 'high-performance' });
  const dpr = O.dpr || Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr); renderer.setClearColor(0x060b16, 1);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 10, 7000);

  const [geo, D, meta] = await Promise.all([loadGeo(), loadTracks(), fetch(BASE + 'data/meta.json').then(r => r.json())]);
  const cx = (geo.bbox[0] + geo.bbox[2]) / 2, cz = (geo.bbox[1] + geo.bbox[3]) / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshBasicMaterial({ color: 0x060b16 })); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, -3, cz); scene.add(floor);
  scene.add(new THREE.Mesh(flatShape(geo.states, -1), new THREE.MeshBasicMaterial({ color: 0x0f1b30 })));
  scene.add(new THREE.LineSegments(outlines(geo.states, 0), new THREE.LineBasicMaterial({ color: 0x4a628a, transparent: true, opacity: 0.42 })));

  /* ---------- aircraft ---------- */
  const cap = D.cap + 16;
  const pos = new Float32Array(cap * 3), palt = new Float32Array(cap), ids = new Uint32Array(cap);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); pg.setAttribute('aAlt', new THREE.BufferAttribute(palt, 1).setUsage(THREE.DynamicDrawUsage));
  const mk = ground => new THREE.RawShaderMaterial({ vertexShader: P_VS, fragmentShader: P_FS, transparent: true, depthWrite: false, depthTest: false, blending: ground ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms: { uPx: { value: dpr }, uSize: { value: ground ? 2.2 : 3.4 }, uGround: { value: ground ? 1 : 0 }, uAlpha: { value: 0.95 } } });
  const gpts = new THREE.Points(pg, mk(true)), pts = new THREE.Points(pg, mk(false));
  gpts.frustumCulled = pts.frustumCulled = false;
  const tpos = new Float32Array(cap * TRAIL * 6), ta = new Float32Array(cap * TRAIL * 2), talt = new Float32Array(cap * TRAIL * 2);
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(tpos, 3).setUsage(THREE.DynamicDrawUsage)); tg.setAttribute('aA', new THREE.BufferAttribute(ta, 1).setUsage(THREE.DynamicDrawUsage)); tg.setAttribute('aAlt', new THREE.BufferAttribute(talt, 1).setUsage(THREE.DynamicDrawUsage));
  const trails = new THREE.LineSegments(tg, new THREE.RawShaderMaterial({ vertexShader: T_VS, fragmentShader: T_FS, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  trails.frustumCulled = false;
  scene.add(gpts, trails, pts);

  /* ---------- airports ---------- */
  const hubXY = HUBS.map(([c, lo, la]) => { const [x, y] = project(lo, la); return { c, x, y }; });
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(hubXY.flatMap(h => [h.x, 0.4, h.y]), 3));
  const hmat = new THREE.RawShaderMaterial({ vertexShader: H_VS, fragmentShader: H_FS, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: dpr }, uPulse: { value: 0 }, uColor: { value: new THREE.Color(0x5f8fd0) }, uOn: { value: 1 } } });
  const hubs = new THREE.Points(hg, hmat); hubs.frustumCulled = false; scene.add(hubs);
  const hubLabels = hubXY.filter(h => LABELED.has(h.c)).map(h => { const s = document.createElement('span'); s.textContent = h.c; labels.appendChild(s); return { h, s }; });

  /* ---------- the clock ---------- */
  const S = { t: 0, playing: false, raf: 0, last: 0, n: 0, top: false, dragging: false, userCam: 0 };
  const total = D.nF - 1;
  const fStop = O.stop != null ? (O.stop - D.t0) / D.step : -1, fLift = O.lift != null ? (O.lift - D.t0) / D.step : -1;
  const us = meta.counts.us, high = meta.counts.high;
  const atStop = fStop >= 0 ? us[Math.round(fStop)] : Math.max(...us);
  const evs = O.events.map(e => ({ f: (e.at - D.t0) / D.step, text: e.text })).filter(e => e.f >= 0 && e.f <= total).sort((a, b) => a.f - b.f);

  function fill(t) { // aircraft positions and tails at time t (in frames)
    const k = clamp(Math.floor(t), 0, total), fr = clamp(t - k, 0, 1);
    const { start, len, off, X, Y, alt, n } = D;
    let m = 0, v = 0;
    for (let i = 0; i < n; i++) {
      const s = start[i]; if (s > k) break;
      const j = k - s; if (j >= len[i]) continue;
      const o = off[i] + j, last = j + 1 >= len[i];
      const x = last ? X[o] : X[o] + (X[o + 1] - X[o]) * fr, y = last ? Y[o] : Y[o] + (Y[o + 1] - Y[o]) * fr, a = last ? alt[o] : alt[o] + (alt[o + 1] - alt[o]) * fr;
      const px = x / Q, pz = y / Q, py = a * ALT_Y;
      pos[m * 3] = px; pos[m * 3 + 1] = py; pos[m * 3 + 2] = pz; palt[m] = a; ids[m] = i; m++;
      // the tail: from here back through the last TRAIL recorded minutes
      let hx = px, hy = py, hz = pz, ha = 1;
      for (let q = 0; q < TRAIL && j - q >= 0; q++) {
        const b = o - q, bx = X[b] / Q, bz = Y[b] / Q, by = alt[b] * ALT_Y, ba = 1 - (q + fr) / TRAIL;
        if (q === 0 && fr < 0.02) continue;
        tpos[v * 3] = hx; tpos[v * 3 + 1] = hy; tpos[v * 3 + 2] = hz; ta[v] = ha; talt[v] = a; v++;
        tpos[v * 3] = bx; tpos[v * 3 + 1] = by; tpos[v * 3 + 2] = bz; ta[v] = Math.max(0, ba); talt[v] = a; v++;
        hx = bx; hy = by; hz = bz; ha = Math.max(0, ba);
      }
    }
    S.n = m;
    pg.setDrawRange(0, m); pg.attributes.position.needsUpdate = true; pg.attributes.aAlt.needsUpdate = true;
    tg.setDrawRange(0, v); tg.attributes.position.needsUpdate = true; tg.attributes.aA.needsUpdate = true; tg.attributes.aAlt.needsUpdate = true;
  }

  /* ---------- camera ---------- */
  const cam = { az: 0.34, el: 0.62, zoom: 1 }, center = new THREE.Vector3(cx, 0, cz + 10);
  function fitDist() { const w = el.clientWidth || 800, h = el.clientHeight || 500, asp = w / h; return Math.max(1250, (geo.bbox[2] - geo.bbox[0]) * 1.13 / (2 * Math.tan(15 * Math.PI / 180) * asp)); }
  function place() {
    const p = S.t / total, tall = el.clientHeight > el.clientWidth * 1.1;
    let az, e, dist = fitDist() * cam.zoom;
    if (S.top) { az = 0; e = 1.5; dist *= 0.9; }
    else { az = cam.az + (S.userCam ? 0 : lerp(0.0, -0.62, p)); e = cam.el + (tall && !S.userCam ? 0.16 : 0); }
    camera.position.set(center.x + dist * Math.cos(e) * Math.sin(az), dist * Math.sin(e), center.z + dist * Math.cos(e) * Math.cos(az));
    camera.up.set(0, 1, 0); camera.lookAt(center.x, tall ? 30 : 10, center.z + (tall ? -40 : 0));
  }
  function resize() { const w = el.clientWidth || 800, h = el.clientHeight || 500; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(() => { resize(); draw(); }).observe(el);

  /* ---------- HUD ---------- */
  const range = $('input[type=range]'), headEl = $('.aq-head'), capEl = $('.aq-cap'), clockEl = $('.aq-clock b'), badge = $('.aq-badge');
  { // the count as a line under the scrubber, with the same hours a week earlier where the archive has them
    const base = meta.baseline && meta.baseline.us, top = Math.max(...us, ...(base || [0])) * 1.06 || 1;
    const path = a => a.map((v, i) => `${i ? 'L' : 'M'}${(i / total * 1000).toFixed(1)},${(100 - v / top * 100).toFixed(1)}`).join('');
    $('.aq-spark').innerHTML = (fStop >= 0 && fLift >= 0 ? `<rect class="stop" x="${(fStop / total * 1000).toFixed(1)}" y="0" width="${((fLift - fStop) / total * 1000).toFixed(1)}" height="100"/>` : '')
      + (base ? `<path class="base" d="${path(base)}"/>` : '') + `<path class="area" d="${path(us)}L1000,100L0,100Z"/><path class="line" d="${path(us)}"/>`;
    const marks = [[fStop, fmtClock(D.t0 + fStop * D.step).replace(' p.m.', '') + ' stop'], [fLift, fmtClock(D.t0 + fLift * D.step).replace(' p.m.', '') + ' lifted']].filter(m => m[0] >= 0 && m[0] <= total);
    $('.aq-marks').innerHTML = marks.map(([f, l]) => `<span style="left:${(f / total * 100).toFixed(2)}%">${l}</span>`).join('')
      + `<em style="left:0">${fmtClock(D.t0)}</em><em style="right:0">${fmtClock(D.t0 + total * D.step)}</em>` + (base ? `<u>dashed: a week earlier</u>` : '');
  }
  let lastCap = -2, lastMin = -1;
  function hudUpdate() {
    const k = clamp(Math.round(S.t), 0, total);
    if (k !== lastMin) {
      lastMin = k;
      clockEl.textContent = fmtClock(D.t0 + k * D.step) + ' ET';
      $('[data-n="us"]').textContent = NUM.format(us[k]);
      const inStop = fStop >= 0 && S.t >= fStop && S.t < fLift;
      badge.hidden = !inStop; el.classList.toggle('is-stop', inStop);
      $('[data-n="pct"]').textContent = fStop >= 0 && S.t >= fStop && atStop ? `${Math.round(us[k] / atStop * 100)}% of the ${fmtClock(D.t0 + fStop * D.step).replace(' p.m.', '')} level` : '';
      $('[data-n="high"]').textContent = `${NUM.format(high[k])} at 18,000 ft or higher`;
      hmat.uniforms.uColor.value.set(inStop ? 0xff4a3a : 0x5f8fd0);
    }
    let ci = -1; for (let i = 0; i < evs.length; i++) if (evs[i].f <= S.t + 0.01) ci = i;
    if (ci !== lastCap) { lastCap = ci; capEl.textContent = ci >= 0 ? evs[ci].text : ''; capEl.classList.remove('pop'); void capEl.offsetWidth; capEl.classList.add('pop'); }
    range.value = Math.round(S.t / total * 1000); headEl.style.left = (S.t / total * 100).toFixed(2) + '%';
  }
  const v3 = new THREE.Vector3();
  function placeLabels() {
    const w = el.clientWidth, h = el.clientHeight, show = w >= 560;
    labels.style.display = show ? '' : 'none'; if (!show) return;
    for (const { h: hb, s } of hubLabels) { v3.set(hb.x, 0.4, hb.y).project(camera); s.style.transform = `translate(${((v3.x + 1) / 2 * w).toFixed(1)}px,${((1 - v3.y) / 2 * h).toFixed(1)}px)`; }
  }
  function draw() {
    fill(S.t); place();
    const inStop = fStop >= 0 && S.t >= fStop && S.t < fLift;
    hmat.uniforms.uPulse.value = inStop ? 0.5 + 0.5 * Math.sin(S.t * 0.9) : 0.15;
    renderer.render(scene, camera); hudUpdate(); placeLabels();
  }
  function tick(now) {
    S.raf = 0;
    const dt = S.last ? Math.min(0.1, (now - S.last) / 1000) : 0; S.last = now;
    if (S.playing) { S.t += dt * total / O.dur; if (S.t >= total) { S.t = total; pause(); } }
    draw();
    if (S.playing) S.raf = requestAnimationFrame(tick);
  }
  function play() { if (S.t >= total - 0.01) S.t = 0; S.playing = true; S.last = 0; el.classList.add('is-playing'); $('.aq-play').setAttribute('aria-label', 'Pause'); if (!S.raf) S.raf = requestAnimationFrame(tick); }
  function pause() { S.playing = false; el.classList.remove('is-playing'); $('.aq-play').setAttribute('aria-label', 'Play'); }
  const kick = () => { if (!S.playing && !S.raf) S.raf = requestAnimationFrame(tick); };
  $('.aq-play').addEventListener('click', () => S.playing ? pause() : play());
  range.addEventListener('input', () => { pause(); S.t = range.value / 1000 * total; kick(); });
  hud.querySelector('[data-a="view"]').addEventListener('click', e => { S.top = !S.top; e.currentTarget.setAttribute('aria-pressed', S.top); e.currentTarget.textContent = S.top ? '3-D view' : 'Top view'; kick(); });
  hud.querySelector('[data-a="full"]')?.addEventListener('click', () => O.onFull && O.onFull());

  // drag to turn (mouse: also tilt), wheel with ctrl or in full screen to zoom, hover or tap for the flight
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, az: cam.az + (S.userCam ? 0 : lerp(0, -0.62, S.t / total)), el: cam.el, moved: false }; });
  addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointermove', e => {
    if (drag && (e.buttons || e.pointerType === 'touch')) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved && !S.top) { S.userCam = 1; cam.az = drag.az - dx * 0.005; if (e.pointerType !== 'touch') cam.el = clamp(drag.el + dy * 0.004, 0.18, 1.45); kick(); tip.hidden = true; return; }
    }
    if (O.rec) return;
    const b = el.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top;
    let best = -1, bd = 18 * 18;
    for (let i = 0; i < S.n; i++) { v3.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).project(camera); const sx = (v3.x + 1) / 2 * b.width, sy = (1 - v3.y) / 2 * b.height, dd = (sx - mx) ** 2 + (sy - my) ** 2; if (dd < bd) { bd = dd; best = i; } }
    if (best < 0) { tip.hidden = true; return; }
    const i = ids[best]; let cs = ''; for (let q = 0; q < 8; q++) { const ch = D.cs[i * 8 + q]; if (!ch) break; cs += String.fromCharCode(ch); }
    const ft = Math.round(palt[best] * 250 / 100) * 100;
    tip.innerHTML = `<b>${cs || 'Aircraft'}</b><span>${NUM.format(ft)} ft</span>`;
    tip.hidden = false; tip.style.left = Math.min(b.width - 130, mx + 14) + 'px'; tip.style.top = Math.max(8, my - 12) + 'px';
  });
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; });
  canvas.addEventListener('wheel', e => { if (!(e.ctrlKey || document.fullscreenElement || el.classList.contains('is-fs'))) return; e.preventDefault(); cam.zoom = clamp(cam.zoom * (e.deltaY > 0 ? 1.08 : 0.93), 0.35, 1.6); kick(); }, { passive: false });

  resize(); draw(); el.classList.add('is-ready');
  if (O.autoplay) play();
  return {
    play, pause, meta, data: { frames: D.nF, t0: D.t0, step: D.step, tracks: D.n, points: D.tot },
    seek(t) { S.t = clamp(t, 0, total); pause(); draw(); }, // for recording: set the clock (in frames), render once
    frameOf: unix => (unix - D.t0) / D.step, total,
    view(top) { S.top = !!top; draw(); }, cam(az, e, zoom) { S.userCam = 1; cam.az = az; cam.el = e; if (zoom) cam.zoom = zoom; draw(); },
    get state() { return { t: S.t, n: S.n, playing: S.playing }; }
  };
}
