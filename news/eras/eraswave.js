/* The Watch · Three waves: the homepage's 3-D county wave, replayed election by election for 1924–1932, 2004–2012 and
   2016–2026. Each county is a block; its height is how far it moved since the previous presidential election (or, in
   "margin" view, how far ahead the winner was), blue toward Democrats, red toward Republicans. Beside the map: the
   electoral and popular vote, the House and the governors after each election.
   Data: data/era1.json, era2.json, era3.json (tools/build.py) and data/national.json; the map and geometry are the wave's. */
import * as THREE from '../wave/lib/three.module.min.js';
import { loadGeo, buildCounties, flatShape, outlines, PAL, shiftColor } from '../wave/wave.js';

const BASE = new URL('./', import.meta.url).href;
const NUM = new Intl.NumberFormat('en-US');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const fm = v => v == null ? '—' : Math.abs(v) < 0.05 ? 'even' : (v > 0 ? 'D+' : 'R+') + Math.abs(v).toFixed(1);
const cache = {};
const getJSON = u => cache[u] || (cache[u] = fetch(BASE + u).then(r => { if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); }));

const VS = `precision highp float; uniform mat4 modelViewMatrix, projectionMatrix; attribute vec3 position;
attribute float aTop; attribute float aH; attribute float aHp; attribute float aDelay; attribute float aId; attribute vec3 aColor; attribute vec3 aColorP; attribute vec3 aNormal;
uniform float uT; uniform float uExag; uniform float uWin; uniform vec3 uLight; uniform float uHover; uniform float uFogNear;
varying vec3 vColor; varying float vTop; varying float vLight; varying float vFog; varying float vH; varying float vHover;
float backOut(float x){ float c1=1.15; float c3=c1+1.; float y=x-1.; return 1.+c3*y*y*y+c1*y*y; }
void main(){
  float p = clamp((uT - aDelay)/uWin, 0., 1.);
  float e = backOut(p);
  float h = mix(aHp, aH, e) * uExag;
  vec3 pos = vec3(position.x, aTop * max(h, 0.), position.z);
  float nd = max(dot(aNormal, normalize(uLight)), 0.);
  vLight = 0.50 + 0.62 * nd + 0.10 * aNormal.y;
  vColor = mix(aColorP, aColor, smoothstep(0., 1., p)); vTop = aTop; vH = h; vHover = step(abs(aId - uHover), 0.5);
  vec4 mv = modelViewMatrix * vec4(pos, 1.);
  vFog = clamp((-mv.z - uFogNear) / 2200., 0., 1.);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `precision highp float; uniform vec3 uFog; uniform float uDim;
varying vec3 vColor; varying float vTop; varying float vLight; varying float vFog; varying float vH; varying float vHover;
void main(){
  if (vH < 0.2) discard;
  vec3 c = vColor * vLight * mix(0.66, 1.0, vTop);
  c = mix(c, vec3(1.0), vHover * 0.38);
  c = mix(c, uFog, vFog * 0.75 + uDim);
  gl_FragColor = vec4(c, 1.0);
}`;

export const ERA_KEYS = ['era1', 'era2', 'era3'];
export const ERA_NAMES = { era1: '1924–1932', era2: '2004–2012', era3: '2016–2026' };

export async function mountEras(el, opts = {}) {
  const O = Object.assign({ era: 'era1', mode: 'move', autoplay: true, loop: true, hold: 3.4, trans: 2.2, rec: false, onFrame: null }, opts);
  el.classList.add('ew-root');
  el.innerHTML = `<canvas class="ew-canvas" aria-hidden="true"></canvas>
  <div class="ew-hud">
    <div class="ew-title"><p class="ew-kicker"></p><h2></h2><p class="ew-sub"></p></div>
    <div class="ew-tally"><div class="ew-n blue"><b data-n="left">0</b><span></span></div><div class="ew-n red"><b data-n="right">0</b><span>moved right</span></div></div>
    <div class="ew-board"></div>
    <div class="ew-legend"></div>
    <div class="ew-bar">
      <button type="button" class="ew-play" aria-label="Pause"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-pause" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/><path class="i-play" d="M8 5l11 7-11 7z"/></svg></button>
      <div class="ew-years" role="tablist" aria-label="Election"></div>
      <div class="ew-modes" role="group" aria-label="Height shows"><button type="button" data-mode="move">Move</button><button type="button" data-mode="margin">Margin</button></div>
    </div>
    <div class="ew-tip" hidden></div>
  </div>`;
  const canvas = el.querySelector('canvas'), hud = el.querySelector('.ew-hud'), tip = el.querySelector('.ew-tip');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!O.rec, powerPreference: 'high-performance' });
  renderer.setPixelRatio(O.dpr || Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(PAL.fogDay, 1);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 10, 6000);
  const [geo, nat] = await Promise.all([loadGeo(), getJSON('data/national.json')]);
  const C = geo.counties;
  const cx = (geo.bbox[0] + geo.bbox[2]) / 2, cz = (geo.bbox[1] + geo.bbox[3]) / 2, center = new THREE.Vector3(cx, 0, cz + 20);
  scene.add(new THREE.Mesh(flatShape(geo.states, -1.5), new THREE.MeshBasicMaterial({ color: PAL.base })));
  scene.add(new THREE.LineSegments(outlines(geo.states, 0.6), new THREE.LineBasicMaterial({ color: PAL.line, transparent: true, opacity: 0.35 })));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshBasicMaterial({ color: PAL.fogDay })); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, -4, cz); scene.add(floor);
  const cg = buildCounties(geo);
  const nv = cg.getAttribute('aH').count;
  cg.setAttribute('aHp', new THREE.BufferAttribute(new Float32Array(nv), 1));
  cg.setAttribute('aColorP', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  const mat = new THREE.RawShaderMaterial({ vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 }, uExag: { value: 2.1 }, uWin: { value: 0.28 }, uLight: { value: new THREE.Vector3(-0.5, 0.85, 0.45) }, uFog: { value: PAL.fogDay }, uDim: { value: 0 }, uHover: { value: -1 }, uFogNear: { value: 700 } } });
  scene.add(new THREE.Mesh(cg, mat));
  const A = { h: cg.getAttribute('aH'), hp: cg.getAttribute('aHp'), c: cg.getAttribute('aColor'), cp: cg.getAttribute('aColorP'), d: cg.getAttribute('aDelay') };
  const vertIds = cg.userData.vertIds;
  const curH = new Float32Array(C.length), curC = new Float32Array(C.length * 3);
  const tmp = new THREE.Color();
  // the sweep: west to east, a little jitter per county
  const delay = C.map(c => 0.02 + 0.66 * clamp((c.cx - geo.bbox[0]) / (geo.bbox[2] - geo.bbox[0]), 0, 1) + ((c.id.charCodeAt(3) * 7 + c.id.charCodeAt(4) * 13) % 17) / 17 * 0.04);
  for (let v = 0; v < vertIds.length; v++) A.d.array[v] = delay[vertIds[v]];
  A.d.needsUpdate = true;

  const S = { era: O.era, data: null, frames: [], fi: 0, mode: O.mode, t: 0, playing: !!O.autoplay, raf: 0, last: 0, stat: [] };

  function target(fr) { // per county height + color for one frame
    const hs = new Float32Array(C.length), cs = new Float32Array(C.length * 3), stat = [];
    const moved = S.mode === 'move';
    for (let i = 0; i < C.length; i++) {
      const r = fr && fr.c[C[i].id];
      const v = r ? (moved ? r[1] : r[0]) : null;
      let col;
      if (v == null) { hs[i] = 0.45; col = PAL.dim; stat[i] = null; }
      else { hs[i] = moved ? clamp(Math.abs(v), 0.6, 80) : clamp(Math.abs(v) * 0.6, 0.6, 60); col = shiftColor(moved ? v : v * 0.7, tmp); stat[i] = r; }
      cs[i * 3] = col.r; cs[i * 3 + 1] = col.g; cs[i * 3 + 2] = col.b;
    }
    return { hs, cs, stat };
  }
  function apply(fr) { // morph from what is on screen now to this frame
    const T = target(fr);
    for (let v = 0; v < vertIds.length; v++) {
      const i = vertIds[v];
      A.hp.array[v] = curH[i]; A.h.array[v] = T.hs[i];
      A.cp.array[v * 3] = curC[i * 3]; A.cp.array[v * 3 + 1] = curC[i * 3 + 1]; A.cp.array[v * 3 + 2] = curC[i * 3 + 2];
      A.c.array[v * 3] = T.cs[i * 3]; A.c.array[v * 3 + 1] = T.cs[i * 3 + 1]; A.c.array[v * 3 + 2] = T.cs[i * 3 + 2];
    }
    curH.set(T.hs); curC.set(T.cs); S.stat = T.stat;
    A.h.needsUpdate = A.hp.needsUpdate = A.c.needsUpdate = A.cp.needsUpdate = true;
  }

  /* ---------- the HUD ---------- */
  const $ = s => hud.querySelector(s);
  const years = $('.ew-years');
  function hudFrame(fr) {
    const n = nat[fr.y] || {}, moved = S.mode === 'move', P = fr.kind === 'P';
    $('.ew-kicker').textContent = `${ERA_NAMES[S.era]} · ${P ? 'presidential election' : 'midterm'}`;
    let h2, sub;
    if (P && n.pres) {
      const p = n.pres, dw = p.ev_d > p.ev_r;
      h2 = `${fr.y}: ${dw ? p.d : p.r} ${p.pv_margin != null ? 'by ' + Math.abs(p.pv_margin).toFixed(1) : ''}`;
      if (p.pv_margin != null && (p.pv_margin > 0) !== dw) h2 = `${fr.y}: ${dw ? p.d : p.r} wins, loses the popular vote`;
    } else h2 = `${fr.y}: House vote ${fm(n.house && n.house.m)}`;
    if (fr.missing) sub = `No county returns for the ${fr.y} midterm in this set — the map holds ${fr.y - 2}. The national numbers are on the right.`;
    else if (moved) sub = `Height = each county’s move since ${fr.base}${P ? ' (presidential vote)' : ' (Senate race, else contested House vote' + (fr.y === 2026 ? '; Senate or governor in 2026' : '') + ')'}`;
    else sub = `Height = how far ahead the winner was in each county${P ? '' : ' (Senate race, else contested House vote)'}`;
    $('.ew-title h2').textContent = h2; $('.ew-sub').textContent = sub;
    const tally = $('.ew-tally'); tally.hidden = fr.missing || !moved;
    if (!fr.missing) {
      countTo($('[data-n="left"]'), fr.left); countTo($('[data-n="right"]'), fr.right);
      $('.ew-n.blue span').innerHTML = `of <i>${NUM.format(fr.counted)}</i> counties moved left`;
    }
    $('.ew-legend').innerHTML = moved
      ? `<span class="sw blue"></span>moved toward Democrats <span class="sw red"></span>toward Republicans <span class="sw grey"></span>no race or no count`
      : `<span class="sw blue"></span>Democrat ahead <span class="sw red"></span>Republican ahead <span class="sw grey"></span>no race or no count`;
    $('.ew-board').innerHTML = board(fr.y, n);
    years.querySelectorAll('button').forEach((b, i) => { b.setAttribute('aria-selected', i === S.fi); });
    mat.uniforms.uDim.value = fr.missing ? 0.28 : 0;
    if (O.onFrame) O.onFrame(fr, n);
  }
  function bar(d, r, o, total, label) {
    const w = x => (x / total * 100).toFixed(2) + '%';
    return `<div class="ew-row"><div class="ew-rl">${label}</div><div class="ew-bars"><i class="d" style="width:${w(d)}"></i>${o ? `<i class="o" style="width:${w(o)}"></i>` : ''}<i class="r" style="width:${w(r)}"></i><span class="mid" style="left:50%"></span></div>
      <div class="ew-nums"><b class="dn">${d}</b>${o ? `<span>${o} other</span>` : ''}<b class="rn">${r}</b></div></div>`;
  }
  function board(y, n) {
    let h = '';
    if (n.pres) {
      const p = n.pres;
      h += `<div class="ew-sec"><p>President</p><div class="ew-cands"><span class="dn">${p.d}</span><span class="rn">${p.r}</span></div>${bar(p.ev_d, p.ev_r, p.ev_o || 0, p.ev_d + p.ev_r + (p.ev_o || 0), 'Electoral votes')}
        <div class="ew-row pv"><div class="ew-rl">Popular vote</div><div class="ew-pv"><b class="dn">${(p.pv_d + 1e-9).toFixed(1)}%</b><span>${fm(p.pv_margin)}</span><b class="rn">${(p.pv_r + 1e-9).toFixed(1)}%</b></div></div></div>`;
    }
    if (n.house) h += `<div class="ew-sec"><p>House <span>${y === 2026 ? 'called so far' : 'after the election'}</span></p>${bar(n.house.d, n.house.r, n.house.o || 0, n.house.d + n.house.r + (n.house.o || 0) + (n.house.open || 0), `Seats · vote ${fm(n.house.m)}`)}${n.house.open ? `<p class="ew-note">${n.house.open} still uncalled</p>` : ''}</div>`;
    if (n.gov) h += `<div class="ew-sec"><p>Governors <span>after the election</span></p>${bar(n.gov.d, n.gov.r, n.gov.o || 0, n.gov.d + n.gov.r + (n.gov.o || 0) + (n.gov.open || 0), `Governorships · Democrats ${Math.round(n.gov.d / (n.gov.d + n.gov.r + (n.gov.o || 0) + (n.gov.open || 0)) * 100)}%`)}${n.gov.open ? `<p class="ew-note">${n.gov.open} still uncalled</p>` : ''}</div>`;
    return h;
  }
  function countTo(node, to) {
    const from = +(node.dataset.v || 0), t0 = performance.now(), dur = O.rec ? 1 : 900; node.dataset.v = to;
    const step = now => { const k = clamp((now - t0) / dur, 0, 1); node.textContent = NUM.format(Math.round(lerp(from, to, easeInOut(k)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---------- camera ---------- */
  const cam = { az: 0.5, el: 0.8, dist: 1500, pan: 0, tx: 0, tz: 0 };
  function fitDist() { const w = el.clientWidth || 800, h = el.clientHeight || 500, asp = w / h; const base = asp > 1.6 ? 1500 : asp > 1.25 ? 1500 + (1.6 - asp) * 500 : asp > 0.9 ? 1700 + (1.25 - asp) * 800 : 1880 + (0.9 - asp) * 1300; return Math.max(base, (geo.bbox[2] - geo.bbox[0]) * 1.2 / (2 * Math.tan(15 * Math.PI / 180) * asp)); }
  function place() {
    const total = S.frames.length * (O.trans + O.hold), p = clamp((S.fi * (O.trans + O.hold) + S.t) / total, 0, 1);
    const wide = el.clientWidth > 900, tall = el.clientHeight > el.clientWidth * 1.1;
    cam.az = lerp(0.48, 0.20, easeInOut(p)) * (tall ? 0.25 : 1); cam.el = lerp(0.84, 0.68, easeInOut(p)) + (tall ? 0.12 : 0); cam.dist = fitDist() * lerp(1.06, 0.96, easeInOut(p)) * (tall ? 0.97 : wide ? 1.1 : 1);
    cam.pan = tall ? -120 : 30; cam.tx = 0; cam.tz = 0; mat.uniforms.uFogNear.value = Math.max(700, cam.dist - 800);
    const d = cam.dist, e = cam.el, a = cam.az;
    camera.position.set(center.x + cam.tx + d * Math.cos(e) * Math.sin(a), d * Math.sin(e), center.z + cam.tz + d * Math.cos(e) * Math.cos(a));
    camera.lookAt(center.x + cam.tx, cam.pan, center.z + cam.tz);
  }
  function resize() { // on a wide stage the scoreboard takes the right side, so the map is drawn left of center
    const w = el.clientWidth || 800, h = el.clientHeight || 500; renderer.setSize(w, h, false); camera.aspect = w / h;
    if (w > 900 && w / h > 1.3) camera.setViewOffset(w, h, Math.round(w * 0.19), 0, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix(); }
  new ResizeObserver(() => { resize(); draw(); }).observe(el);

  function draw() { mat.uniforms.uT.value = clamp(S.t / O.trans, 0, 1.2) * 1.0 + 0.0; place(); renderer.render(scene, camera); }
  function go(i, morph = true) {
    S.fi = (i + S.frames.length) % S.frames.length; S.t = morph ? 0 : O.trans;
    const fr = S.frames[S.fi];
    if (!fr.missing) apply(fr); else { // a midterm with no county returns: hold the map, dimmed
      for (let v = 0; v < vertIds.length; v++) { const k = vertIds[v]; A.hp.array[v] = curH[k]; A.h.array[v] = curH[k]; A.cp.array.set(A.c.array.subarray(v * 3, v * 3 + 3), v * 3); }
      A.h.needsUpdate = A.hp.needsUpdate = A.cp.needsUpdate = true;
    }
    hudFrame(fr); draw();
  }
  function tick(now) {
    S.raf = 0;
    const dt = S.last ? Math.min(0.1, (now - S.last) / 1000) : 0; S.last = now;
    if (S.playing) {
      S.t += dt;
      if (S.t > O.trans + O.hold) { if (S.fi === S.frames.length - 1 && !O.loop) { S.playing = false; el.classList.remove('is-playing'); } else go(S.fi + 1); }
    }
    draw();
    if (S.playing || S.t < O.trans) S.raf = requestAnimationFrame(tick);
  }
  function play() { S.playing = true; S.last = 0; el.classList.add('is-playing'); $('.ew-play').setAttribute('aria-label', 'Pause'); if (!S.raf) S.raf = requestAnimationFrame(tick); }
  function pause() { S.playing = false; el.classList.remove('is-playing'); $('.ew-play').setAttribute('aria-label', 'Play'); }
  function kick() { S.last = 0; if (!S.raf) S.raf = requestAnimationFrame(tick); }

  async function loadEra(key, start = 0) {
    S.era = key; el.dataset.era = key;
    const d = await getJSON(`data/${key}.json`);
    S.data = d; S.frames = d.frames;
    { // scale the heights to the era: the 1932 moves are three times the modern ones
      const all = []; for (const f of d.frames) for (const v of Object.values(f.c)) if (v[1] != null) all.push(Math.abs(v[1]));
      all.sort((a, b) => a - b); const p75 = all.length ? all[Math.floor(all.length * 0.75)] : 12;
      mat.uniforms.uExag.value = 2.1 * clamp(11 / p75, 0.42, 1.15);
    }
    years.innerHTML = S.frames.map((f, i) => `<button type="button" role="tab" class="${f.kind === 'P' ? 'p' : 'm'}${f.missing ? ' nodata' : ''}" data-i="${i}">${f.y}<small>${f.kind === 'P' ? 'pres.' : 'mid.'}</small></button>`).join('');
    years.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { pause(); go(+b.dataset.i); kick(); }));
    curH.fill(0.2); curC.fill(0.15);
    go(start); kick();
  }
  $('.ew-play').addEventListener('click', () => S.playing ? pause() : play());
  hud.querySelectorAll('.ew-modes button').forEach(b => b.addEventListener('click', () => { S.mode = b.dataset.mode; hud.querySelectorAll('.ew-modes button').forEach(x => x.setAttribute('aria-pressed', x === b)); S.t = 0; const fr = S.frames[S.fi]; if (!fr.missing) apply(fr); hudFrame(fr); kick(); }));
  hud.querySelector(`.ew-modes [data-mode="${S.mode}"]`).setAttribute('aria-pressed', 'true');

  // hover: the nearest county centroid on screen
  const v3 = new THREE.Vector3();
  el.addEventListener('pointermove', ev => {
    if (O.rec || ev.target.closest('.ew-bar,.ew-board')) { tip.hidden = true; return; }
    const b = el.getBoundingClientRect(), mx = ev.clientX - b.left, my = ev.clientY - b.top;
    let best = -1, bd = 400;
    for (let i = 0; i < C.length; i++) {
      v3.set(C[i].cx, curH[i] * mat.uniforms.uExag.value, C[i].cy).project(camera);
      const sx = (v3.x + 1) / 2 * b.width, sy = (1 - v3.y) / 2 * b.height, dd = (sx - mx) ** 2 + (sy - my) ** 2;
      if (dd < bd) { bd = dd; best = i; }
    }
    mat.uniforms.uHover.value = best; if (!S.playing) draw();
    if (best < 0) { tip.hidden = true; return; }
    const c = C[best], r = S.stat[best], fr = S.frames[S.fi];
    tip.innerHTML = `<b>${c.n}${c.st ? ', ' + c.st : ''}</b>` + (r ? `<span>${fr.y} ${r[3] === 'P' ? 'president' : r[3] === 'S' ? 'Senate' : r[3] === 'G' ? 'governor' : 'House'}: ${fm(r[0])}</span>${r[1] != null ? `<span class="${r[1] >= 0 ? 'b' : 'r'}">${r[1] >= 0 ? 'Moved left' : 'Moved right'} ${Math.abs(r[1]).toFixed(1)} pts since ${fr.base}</span>` : ''}<span>${NUM.format(r[2])} votes</span>` : `<span>No ${fr.y} count here</span>`);
    tip.hidden = false; tip.style.left = Math.min(b.width - 200, mx + 14) + 'px'; tip.style.top = Math.max(8, my - 10) + 'px';
  });
  el.addEventListener('pointerleave', () => { tip.hidden = true; mat.uniforms.uHover.value = -1; if (!S.playing) draw(); });

  resize();
  await loadEra(S.era);
  if (S.playing) play();
  const api = {
    era: k => loadEra(k), play, pause, go: i => { go(i); kick(); }, get state() { return { era: S.era, fi: S.fi, mode: S.mode, frames: S.frames.length }; },
    // for recording: set the clock exactly, render, no animation frames
    seek(fi, t) { if (fi !== S.fi || t < S.t) { S.fi = -1; go(fi); } S.t = t; pause(); draw(); },
    setMode(m) { S.mode = m; }, durations: () => ({ trans: O.trans, hold: O.hold })
  };
  return api;
}
