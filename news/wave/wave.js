/* The Watch · The wave: every county's move since 2024, and election night as it happened.
   One module, two views, drawn with three.js (vendored in lib/). mount(el, opts) returns a controller.
   Data: data/shift.json and data/night.json (built by build.py), the county map ../../election2026/data/geo.json. */
import * as THREE from './lib/three.module.min.js';
import earcut from './lib/earcut.js';

const BASE = new URL('./', import.meta.url).href;
const ET = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
const NUM = new Intl.NumberFormat('en-US');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeInOut = t => { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const col = (hex) => new THREE.Color(hex);
const NORACE = new Set(['IN', 'MO', 'ND', 'UT', 'WA']);
const FIPS2ST = { '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY' };
const STATE_NAME = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'D.C.' };

/* ---------- data ---------- */
let geoP, shiftP, nightP;
async function getJSON(u) { const r = await fetch(u, { cache: 'force-cache' }); if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); }
function loadGeo() { return geoP || (geoP = getJSON(BASE + '../../election2026/data/geo.json').then(decodeTopo)); }
function loadShift() { return shiftP || (shiftP = getJSON(BASE + 'data/shift.json')); }
function loadNight() { return nightP || (nightP = getJSON(BASE + 'data/night.json')); }

function decodeTopo(g) { // TopoJSON -> {counties:[{id,n,st,rings:[[x,y]...],cx,cy,bbox}], states:[...]}
  const sc = g.transform.scale, tl = g.transform.translate;
  const arcs = g.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sc[0] + tl[0], y * sc[1] + tl[1]]; }); });
  const ring = idx => { const out = []; for (const i of idx) { const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]; for (let k = out.length ? 1 : 0; k < a.length; k++) out.push(a[k]); } if (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop(); return out; };
  const obj = (name) => g.objects[name].geometries.map(c => {
    const polys = c.type === 'Polygon' ? [c.arcs] : c.arcs; // each polygon: [outer, holes...]
    const rings = polys.map(p => p.map(ring)).filter(p => p[0] && p[0].length >= 3);
    if (!rings.length) return null;
    let sx = 0, sy = 0, n = 0, minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, area = 0, cx = 0, cy = 0;
    for (const p of rings) { const o = p[0]; let a = 0, px = 0, py = 0; for (let i = 0, j = o.length - 1; i < o.length; j = i++) { const f = o[j][0] * o[i][1] - o[i][0] * o[j][1]; a += f; px += (o[j][0] + o[i][0]) * f; py += (o[j][1] + o[i][1]) * f; } a /= 2; if (Math.abs(a) > 1e-9) { cx += px / 6; cy += py / 6; area += a; } for (const [x, y] of o) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); } }
    if (Math.abs(area) > 1e-9) { cx /= area; cy /= area; } else { const o = rings[0][0]; cx = o.reduce((s, p) => s + p[0], 0) / o.length; cy = o.reduce((s, p) => s + p[1], 0) / o.length; }
    return { id: c.id, n: c.n, st: FIPS2ST[c.id.slice(0, 2)] || '', polys: rings, cx, cy, bbox: [minx, miny, maxx, maxy], area: Math.abs(area) };
  }).filter(Boolean);
  const drop = id => id.startsWith('02') || id.startsWith('15'); // Alaska has no county map and Hawaii is off the frame: both are left out
  const counties = obj('counties').filter(c => !drop(c.id)), states = obj('states').filter(c => !drop(c.id));
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9; for (const c of states) { minx = Math.min(minx, c.bbox[0]); miny = Math.min(miny, c.bbox[1]); maxx = Math.max(maxx, c.bbox[2]); maxy = Math.max(maxy, c.bbox[3]); }
  return { counties, states, bbox: [minx, miny, maxx, maxy] };
}

/* ---------- geometry ---------- */
function buildCounties(geo) { // one BufferGeometry: top faces + walls, per-vertex attributes animated in the shader
  const pos = [], top = [], nrm = [], ids = [], tri2c = [];
  const cs = geo.counties;
  cs.forEach((c, ci) => {
    for (const poly of c.polys) {
      const outer = poly[0];
      const flat = [], holes = [];
      for (let r = 0; r < poly.length; r++) { if (r) holes.push(flat.length / 2); for (const [x, y] of poly[r]) flat.push(x, y); }
      const tris = earcut(flat, holes.length ? holes : null, 2);
      const base = pos.length / 3;
      for (let i = 0; i < flat.length; i += 2) { pos.push(flat[i], 0, flat[i + 1]); top.push(1); nrm.push(0, 1, 0); ids.push(ci); }
      for (let i = 0; i < tris.length; i += 3) { tri2c.push(ci); idx.push(base + tris[i], base + tris[i + 2], base + tris[i + 1]); }
      // walls: every ring edge is a quad; outward normal from the ring's winding
      for (let r = 0; r < poly.length; r++) {
        const ring = poly[r]; let area = 0;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
        const sgn = (area > 0 ? 1 : -1) * (r ? -1 : 1);
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [ax, ay] = ring[j], [bx, by] = ring[i];
          let nx = (by - ay) * sgn, nz = -(bx - ax) * sgn; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
          const b = pos.length / 3;
          pos.push(ax, 0, ay, bx, 0, by, bx, 0, by, ax, 0, ay); top.push(0, 0, 1, 1); nrm.push(nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz); ids.push(ci, ci, ci, ci);
          // y-up, map y is screen-down: the winding sign above already accounts for the handedness; faces are double-sided
          idx.push(b, b + 1, b + 2, b, b + 2, b + 3); tri2c.push(ci, ci);
        }
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
  g.setAttribute('aNormal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aId', new THREE.Float32BufferAttribute(ids, 1));
  const n = pos.length / 3;
  g.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aDelay', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setIndex(idx.length > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.userData.tri2c = tri2c; g.userData.vertIds = ids;
  idx.length = 0;
  return g;
}
const idx = [];

function flatShape(objs, y) { // the states as a flat plate (silhouette)
  const pos = [], ind = [];
  for (const c of objs) for (const poly of c.polys) {
    const flat = [], holes = [];
    for (let r = 0; r < poly.length; r++) { if (r) holes.push(flat.length / 2); for (const [x, yy] of poly[r]) flat.push(x, yy); }
    const tris = earcut(flat, holes.length ? holes : null, 2); const base = pos.length / 3;
    for (let i = 0; i < flat.length; i += 2) pos.push(flat[i], y, flat[i + 1]);
    for (let i = 0; i < tris.length; i += 3) ind.push(base + tris[i], base + tris[i + 2], base + tris[i + 1]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(ind); return g;
}
function outlines(objs, y) {
  const pos = [];
  for (const c of objs) for (const poly of c.polys) for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) pos.push(ring[j][0], y, ring[j][1], ring[i][0], y, ring[i][1]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g;
}

/* ---------- shaders ---------- */
const COUNTY_VS = `
attribute float aTop; attribute float aH; attribute float aDelay; attribute float aId; attribute vec3 aColor; attribute vec3 aNormal;
uniform float uT; uniform float uExag; uniform float uHover; uniform float uWin; uniform vec3 uLight;
varying vec3 vColor; varying float vTop; varying float vLight; varying float vFog; varying float vHover; varying float vH;
float backOut(float x){ float c1=1.25; float c3=c1+1.; float y=x-1.; return 1.+c3*y*y*y+c1*y*y; }
void main(){
  float p = clamp((uT - aDelay)/uWin, 0., 1.);
  float e = p < 1. ? backOut(p) : 1.;
  float h = aH * uExag * e;
  vec3 pos = vec3(position.x, aTop * h, position.z);
  float nd = max(dot(aNormal, normalize(uLight)), 0.);
  float side = 1. - aNormal.y;
  vLight = 0.50 + 0.62 * nd + 0.10 * (1. - side);
  vColor = aColor; vTop = aTop; vHover = step(abs(aId - uHover), 0.5); vH = h;
  vec4 mv = modelViewMatrix * vec4(pos, 1.);
  vFog = clamp((-mv.z - 700.) / 2200., 0., 1.);
  gl_Position = projectionMatrix * mv;
}`;
const COUNTY_FS = `
precision highp float;
uniform vec3 uFog; varying vec3 vColor; varying float vTop; varying float vLight; varying float vFog; varying float vHover; varying float vH;
void main(){
  if (vH < 0.2) discard;
  vec3 c = vColor * vLight * mix(0.66, 1.0, vTop);
  c = mix(c, vec3(1.0), vHover * 0.38);
  c = mix(c, uFog, vFog * 0.75);
  gl_FragColor = vec4(c, 1.0);
}`;
const SPIKE_VS = `
attribute float aTip; attribute float aVotes; attribute float aClose; attribute float aTau; attribute float aCeil; attribute float aJit; attribute vec3 aColor;
uniform float uTime; uniform float uHmax; varying vec3 vColor; varying float vA;
void main(){
  float dt = max(0., uTime - aClose - aJit);
  float f = aCeil * (1. - exp(-dt / aTau));
  float h = uHmax * sqrt(aVotes) * f;
  vec3 pos = vec3(position.x, aTip * h, position.z);
  vColor = aColor; vA = smoothstep(0., 2., h) * mix(0.45, 1.0, aTip);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
}`;
const SPIKE_FS = `precision highp float; varying vec3 vColor; varying float vA; void main(){ gl_FragColor = vec4(vColor, vA); }`;
const TIP_VS = `
attribute float aVotes; attribute float aClose; attribute float aTau; attribute float aCeil; attribute float aJit; attribute vec3 aColor;
uniform float uTime; uniform float uHmax; uniform float uPx; varying vec3 vColor; varying float vA;
void main(){
  float dt = max(0., uTime - aClose - aJit);
  float f = aCeil * (1. - exp(-dt / aTau));
  float h = uHmax * sqrt(aVotes) * f;
  vec3 pos = vec3(position.x, h, position.z);
  vec4 mv = modelViewMatrix * vec4(pos, 1.);
  gl_PointSize = clamp((2.0 + 2.6 * aVotes) * uPx * 1100. / -mv.z, 1.2, 10.);
  vColor = aColor; vA = smoothstep(0., 3., h);
  gl_Position = projectionMatrix * mv;
}`;
const TIP_FS = `precision highp float; varying vec3 vColor; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = smoothstep(0.5, 0.1, d); gl_FragColor = vec4(vColor * (0.7 + 0.6 * a), a * vA); }`;
const STREAM_VS = `
attribute vec3 aA; attribute vec3 aC; attribute vec3 aB; attribute float aU; attribute float aBirth; attribute vec3 aColor; attribute float aSeed;
uniform float uTime; varying vec3 vColor; varying float vA;
void main(){
  float age = uTime - aBirth;
  float head = clamp(age / 24., 0., 1.);   // the line reaches the seat in 24 minutes of replay time
  float u = aU * head;
  vec3 p = mix(mix(aA, aC, u), mix(aC, aB, u), u);
  float a = age < 0. ? 0. : (1. - smoothstep(60., 150., age));  // fades over the next hour and a half of replay
  a *= smoothstep(0., 0.05, head - aU + 0.05);
  float glow = exp(-abs(head - aU) * 30.) * 0.9;
  vColor = aColor * (0.55 + glow); vA = a * (0.18 + glow * 0.8) * (0.6 + 0.4 * aSeed);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
}`;
const STREAM_FS = `precision highp float; varying vec3 vColor; varying float vA; void main(){ gl_FragColor = vec4(vColor, vA); }`;
const SEAT_VS = `
attribute float aAt; attribute vec3 aColor; attribute float aBig;
uniform float uTime; uniform float uPx; varying vec3 vColor; varying float vOn; varying float vBig;
void main(){
  float on = aAt < 0. ? 0. : smoothstep(0., 6., uTime - aAt);
  vOn = on; vColor = aColor; vBig = aBig;
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_PointSize = (aBig > 0.5 ? 14. : 8.) * uPx * 1000. / -mv.z * (1. + 0.7 * smoothstep(8., 0., uTime - aAt) * step(0., aAt) * step(0., uTime - aAt));
  gl_Position = projectionMatrix * mv;
}`;
const SEAT_FS = `precision highp float; varying vec3 vColor; varying float vOn; varying float vBig;
void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5) discard;
  float ring = smoothstep(0.5, 0.42, d) * (1. - smoothstep(0.34, 0.28, d));
  float disc = smoothstep(0.5, 0.36, d);
  vec3 grey = vec3(0.42, 0.47, 0.56);
  vec3 c = mix(grey, vColor, vOn); float a = mix(ring * 0.75, disc, vOn);
  gl_FragColor = vec4(c, a); }`;

/* ---------- colors ---------- */
const PAL = {
  blueLo: col('#2a63b4'), blueHi: col('#9fd8ff'), redLo: col('#b8412f'), redHi: col('#ffa070'),
  grey: col('#44546e'), dim: col('#2a3648'), fogDay: col('#0b1526'), base: col('#182538'), line: col('#5f7390'),
  dem: col('#6fb2ff'), rep: col('#ff8f6b'), demDeep: col('#2f6fd0'), repDeep: col('#d2543c')
};
function shiftColor(sh, out) { // blue for a move left, red for a move right; brighter the bigger the move
  const t = clamp(Math.abs(sh) / 40, 0, 1);
  if (sh >= 0) out.copy(PAL.blueLo).lerp(PAL.blueHi, Math.pow(t, 0.8)); else out.copy(PAL.redLo).lerp(PAL.redHi, Math.pow(t, 0.8));
  return out;
}

/* ---------- the module ---------- */
export async function mount(el, opts = {}) {
  const O = Object.assign({ view: 'wave', mode: 'hero', autoplay: true, loop: true, race: 'auto', onReady: null, onTime: null, hud: true, interactive: true, dpr: null, focus: null, callouts: null, title: null, dur: null }, opts);
  el.classList.add('wave-root'); el.classList.toggle('wave-hero', O.mode === 'hero');
  el.innerHTML = `<canvas class="wave-canvas" aria-hidden="true"></canvas><svg class="wave-leaders" aria-hidden="true"></svg><div class="wave-hud" hidden></div><div class="wave-tip" hidden></div>`;
  const canvas = el.querySelector('canvas'), hud = el.querySelector('.wave-hud'), leaders = el.querySelector('.wave-leaders'), tip = el.querySelector('.wave-tip');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { el.classList.add('wave-nogl'); throw e; }
  const DPR = O.dpr || Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(PAL.fogDay, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 10, 6000);
  const [geo, shift] = await Promise.all([loadGeo(), loadShift()]);
  const C = geo.counties, ci = new Map(C.map((c, i) => [c.id, i]));
  let night = null; // the night view, built on demand
  const cx = (geo.bbox[0] + geo.bbox[2]) / 2, cz = (geo.bbox[1] + geo.bbox[3]) / 2;
  const center = new THREE.Vector3(cx, 0, cz + 20);
  const FOCUS = O.focus && O.focus.states ? new Set(O.focus.states) : null; let focusScale = 1;
  if (FOCUS) { // frame the region: its states' bounding box
    let a = 1e9, b = 1e9, c2 = -1e9, d = -1e9;
    for (const st of geo.states) if (FOCUS.has(st.st)) { a = Math.min(a, st.bbox[0]); b = Math.min(b, st.bbox[1]); c2 = Math.max(c2, st.bbox[2]); d = Math.max(d, st.bbox[3]); }
    if (O.focus.bbox) [a, b, c2, d] = O.focus.bbox;
    center.set((a + c2) / 2, 0, (b + d) / 2 + (O.focus.dz || 0));
    focusScale = Math.max((c2 - a) / (geo.bbox[2] - geo.bbox[0]), (d - b) / (geo.bbox[3] - geo.bbox[1]) * 0.95) * (O.focus.pad || 1.25);
  }

  // the base: a dark plate in the shape of the country, state lines on top
  const plate = new THREE.Mesh(flatShape(geo.states, -1.5), new THREE.MeshBasicMaterial({ color: PAL.base }));
  scene.add(plate);
  const lines = new THREE.LineSegments(outlines(geo.states, 0.6), new THREE.LineBasicMaterial({ color: PAL.line, transparent: true, opacity: 0.35 }));
  scene.add(lines);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshBasicMaterial({ color: PAL.fogDay }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, -4, cz); scene.add(floor);

  // the counties
  const cg = buildCounties(geo);
  const cmat = new THREE.RawShaderMaterial({
    vertexShader: 'precision highp float; uniform mat4 modelViewMatrix, projectionMatrix; attribute vec3 position;' + COUNTY_VS, fragmentShader: COUNTY_FS,
    uniforms: { uT: { value: 0 }, uExag: { value: 2.1 }, uHover: { value: -1 }, uWin: { value: 0.16 }, uLight: { value: new THREE.Vector3(-0.5, 0.85, 0.45) }, uFog: { value: PAL.fogDay } },
    side: THREE.DoubleSide
  });
  const counties = new THREE.Mesh(cg, cmat); scene.add(counties);
  const aH = cg.getAttribute('aH'), aDelay = cg.getAttribute('aDelay'), aColor = cg.getAttribute('aColor');
  const vertIds = cg.userData.vertIds; const tri2c = cg.userData.tri2c;
  const stat = new Array(C.length).fill(null); // per county: {sh, m24, m26, race, votes, e}
  let closeMin = {};
  const tmp = new THREE.Color();

  function paintWave(raceMode) { // raceMode: 'auto' (Senate where there is one, else governor), 'S' or 'G'
    const hs = new Float32Array(C.length), delay = new Float32Array(C.length), cols = new Float32Array(C.length * 3);
    let left = 0, right = 0, counted = 0;
    const cmin = 0, cmax = 300; // 6 p.m. to 11 p.m. ET; Alaska and Hawaii close later but are not drawn
    for (let i = 0; i < C.length; i++) {
      const c = C[i]; let row = shift.counties[c.id]; const alt = shift.alt && shift.alt[c.id];
      if (raceMode !== 'auto' && (!row || row[4] !== raceMode)) row = alt && alt[4] === raceMode ? alt : null;
      const st = c.st;
      let color, h;
      if (!row) { color = NORACE.has(st) ? PAL.grey : PAL.dim; h = NORACE.has(st) ? 0.9 : 0.45; stat[i] = null; }
      else {
        const sh = row[2]; h = clamp(Math.abs(sh), 0.6, 80); color = shiftColor(sh, tmp); counted++; if (sh > 0) left++; else if (sh < 0) right++;
        stat[i] = { sh, m24: row[0], m26: row[1], race: row[4], e: row[3], d: row[5], r: row[6], t: row[7], d24: row[8], r24: row[9], t24: row[10] };
      }
      if (FOCUS && !FOCUS.has(st)) color = tmp.copy(color).lerp(PAL.dim, 0.72);
      hs[i] = h; cols[i * 3] = color.r; cols[i * 3 + 1] = color.g; cols[i * 3 + 2] = color.b;
      const cl = closeMin[st] != null ? closeMin[st] : cmax;
      const xf = (c.cx - geo.bbox[0]) / (geo.bbox[2] - geo.bbox[0]); // 0 west .. 1 east
      delay[i] = row ? 0.03 + 0.66 * clamp((cl - cmin) / (cmax - cmin), 0, 1) + 0.10 * (1 - xf) + ((c.id.charCodeAt(3) * 7 + c.id.charCodeAt(4) * 13) % 17) / 17 * 0.05 : 0;
    }
    for (let v = 0; v < vertIds.length; v++) { const i = vertIds[v]; aH.array[v] = hs[i]; aDelay.array[v] = delay[i]; aColor.array[v * 3] = cols[i * 3]; aColor.array[v * 3 + 1] = cols[i * 3 + 1]; aColor.array[v * 3 + 2] = cols[i * 3 + 2]; }
    aH.needsUpdate = aDelay.needsUpdate = aColor.needsUpdate = true;
    // the tally counts every county in the data, including the few the map cannot draw (Hawaii's), so it matches the story
    left = right = counted = 0;
    for (const [f, row0] of Object.entries(shift.counties)) {
      let row = row0; const alt = shift.alt && shift.alt[f];
      if (raceMode !== 'auto' && row[4] !== raceMode) row = alt && alt[4] === raceMode ? alt : null;
      if (!row) continue; const st = FIPS2ST[f.slice(0, 2)];
      if (FOCUS && !FOCUS.has(st)) continue;
      counted++; if (row[2] > 0) left++; else if (row[2] < 0) right++;
    }
    if (raceMode !== 'auto' && shift.alt) for (const [f, alt] of Object.entries(shift.alt)) { if (shift.counties[f] || alt[4] !== raceMode) continue; const st = FIPS2ST[f.slice(0, 2)]; if (FOCUS && !FOCUS.has(st)) continue; counted++; if (alt[2] > 0) left++; else if (alt[2] < 0) right++; }
    return { left, right, counted };
  }

  /* ---------- camera ---------- */
  const cam = { az: 0.52, el: 0.72, dist: 1200, tx: 0, tz: 0, pan: 0 }; // azimuth (rad, 0 = from the south), elevation, distance
  let userCam = null, dragging = null;
  function fitDist() { // keep the whole map in view whatever the aspect
    const w = el.clientWidth || 800, h = el.clientHeight || 500, asp = w / h;
    const need = asp > 1.6 ? 1500 : asp > 1.25 ? 1500 + (1.6 - asp) * 500 : asp > 0.9 ? 1700 + (1.25 - asp) * 800 : 1880 + (0.9 - asp) * 1300;
    return need * focusScale;
  }
  function placeCamera(c) {
    const d = c.dist, e = c.el, a = c.az;
    const x = center.x + c.tx + d * Math.cos(e) * Math.sin(a), y = d * Math.sin(e), z = center.z + c.tz + d * Math.cos(e) * Math.cos(a);
    camera.position.set(x, y, z); camera.lookAt(center.x + c.tx, c.pan || 0, center.z + c.tz);
  }
  function resize() {
    const w = el.clientWidth || 800, h = el.clientHeight || Math.round(w * 0.62);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    leaders.setAttribute('viewBox', `0 0 ${w} ${h}`); leaders.setAttribute('width', w); leaders.setAttribute('height', h);
    cam.dist = fitDist(); if (night) night.resize(w, h);
  }
  const ro = new ResizeObserver(() => { resize(); draw(); }); ro.observe(el);

  /* ---------- HUD and callouts ---------- */
  const proj = new THREE.Vector3();
  function toScreen(x, y, z) { proj.set(x, y, z).project(camera); const w = el.clientWidth, h = el.clientHeight; return [(proj.x + 1) / 2 * w, (1 - proj.y) / 2 * h, proj.z < 1]; }
  const callouts = [];
  function callout(id, html, anchor, opts = {}) { // anchor: () => [x,y,z]; label placed at an offset, with a leader line
    const d = document.createElement('div'); d.className = 'wave-callout' + (opts.cls ? ' ' + opts.cls : ''); d.innerHTML = html; d.hidden = true; hud.appendChild(d);
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'path'); ln.setAttribute('class', 'wave-leader'); leaders.appendChild(ln);
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('class', 'wave-leader-dot'); dot.setAttribute('r', '3.2'); leaders.appendChild(dot);
    const o = { id, el: d, ln, dot, anchor, off: opts.off || [0.22, -0.28], on: false, t0: 0 };
    callouts.push(o); return o;
  }
  function placeCallouts() {
    const w = el.clientWidth, h = el.clientHeight;
    for (const c of callouts) {
      if (!c.on) { c.el.hidden = true; c.ln.setAttribute('d', ''); c.dot.setAttribute('r', '0'); continue; }
      const [x, y, z] = c.anchor(); const [sx, sy, vis] = toScreen(x, y, z);
      c.el.hidden = false;
      const r = c.el.getBoundingClientRect();
      let lx = sx + c.off[0] * w, ly = sy + c.off[1] * h;
      lx = clamp(lx, 12, w - r.width - 12); ly = clamp(ly, 12, h - r.height - 12);
      c.el.style.left = lx + 'px'; c.el.style.top = ly + 'px';
      const ex = lx + (sx < lx + r.width / 2 ? 0 : r.width), ey = ly + r.height - 6;
      const mx = ex + (sx < ex ? -14 : 14);
      c.ln.setAttribute('d', `M${sx},${sy} L${mx},${ey} L${ex},${ey}`); c.dot.setAttribute('cx', sx); c.dot.setAttribute('cy', sy); c.dot.setAttribute('r', vis ? '3.2' : '0');
    }
  }
  const tally = document.createElement('div'); tally.className = 'wave-tally';
  const title = document.createElement('div'); title.className = 'wave-title';
  const foot = document.createElement('div'); foot.className = 'wave-foot';
  const legend = document.createElement('div'); legend.className = 'wave-legend';
  hud.append(title, tally, legend, foot);

  /* ---------- the wave: the director ---------- */
  const W = { t: 0, dur: O.dur || 30, totals: null, playing: false, raf: 0, last: 0, race: O.race, ended: false };
  let view = O.view;
  const starr = ci.get('48427'), mo = geo.states.find(s => s.id === '29'), vt = geo.states.find(s => s.id === '50');
  const tallest = () => { let b = -1, bi = 0; for (let i = 0; i < C.length; i++) { const s = stat[i]; if (s && C[i].st !== 'TX' && s.sh > b && C[i].cx > cx + 60 && C[i].cy > cz - 40 && C[i].cy < cz + 160) { b = s.sh; bi = i; } } return bi; };
  const anchorCounty = i => () => { const c = C[i]; const s = stat[i]; return [c.cx, (s ? clamp(Math.abs(s.sh), 0.6, 80) : 1) * cmat.uniforms.uExag.value, c.cy]; };
  const CALL = {};
  function buildWaveHud() {
    hud.hidden = !O.hud; callouts.length = 0; hud.querySelectorAll('.wave-callout').forEach(x => x.remove()); leaders.innerHTML = '';
    const T = W.totals, pct = Math.round(T.left / T.counted * 100);
    const tt = O.title || {};
    title.innerHTML = `<p class="wave-kicker"><span class="wave-globe"></span>${tt.kicker || '2026 vote vs 2024 vote'}</p><h2>${tt.h2 || `${pct}% of counties counted<br>moved left since 2024`}</h2>`;
    tally.innerHTML = `<div class="wave-n blue"><b data-n="left">0</b><span>of <i data-n="counted">${NUM.format(T.counted)}</i> ${tt.what || 'counties'} moved left</span></div><div class="wave-n red"><b data-n="right">0</b><span>moved right</span></div>`;
    legend.innerHTML = `<span class="sw blue"></span>moved toward Democrats <span class="sw red"></span>toward Republicans <span class="sw grey"></span>no Senate or governor race`;
    const src = shift.asOf ? new Date(shift.asOf) : null;
    foot.innerHTML = `Height = how far the county moved: its Senate or governor vote vs Harris–Trump, in points. Counts: AP via The New York Times${src ? ', as of ' + src.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET' : ''}. Analysis: The Watch.`;
    if (O.callouts) { // the page's own callouts: {at:'county:48427'|'state:VT'|[x,y,z], html, off, from, to}
      O.callouts.forEach((o, k) => { const at = typeof o.at === 'string' && o.at.startsWith('county:') ? anchorCounty(ci.get(o.at.slice(7))) : typeof o.at === 'string' && o.at.startsWith('state:') ? (() => { const st = geo.states.find(x => x.st === o.at.slice(6)); return () => [st.cx, 24, st.cy]; })() : () => o.at; const c = callout('c' + k, o.html, at, { off: o.off }); c.from = o.from; c.to = o.to; });
      return;
    }
    const ti = tallest();
    CALL.height = callout('height', `<b>Height = how far it moved</b><span>Senate or governor vote vs Harris–Trump</span>`, anchorCounty(ti), { off: [0.06, -0.3] });
    CALL.blank = callout('blank', `<b>Blank states</b><span>no Senate or governor race</span>`, () => [mo.cx, 4, mo.cy], { off: [0.04, -0.26] });
    const sr = shift.texas && shift.texas.starr;
    CALL.texas = callout('texas', `<b>All ${shift.texas ? shift.texas.counties : 254} Texas counties</b><span>moved left${sr ? ', Starr County by ' + Math.round(sr[2]) + ' points' : ''}</span>`, anchorCounty(starr), { off: [0.1, 0.1] });
    const vtS = shift.states.VT; const vr = vtS && vtS.races && vtS.races[vtS.use];
    CALL.right = callout('right', `<b>Where it moved right</b><span>${vtS ? `Vermont's ${vtS.right} counties: ${vr && vr.rep ? vr.rep : 'Phil Scott'} (R) won re-election by ${vr ? Math.abs(Math.round(vr.m26)) : ''}</span><span>Harris won the state by ${vr ? Math.round(vr.m24) : 32}` : 'New England, mostly'}</span>`, () => [vt.cx, 30, vt.cy], { off: [-0.42, 0.04] });
  }
  function tickCount(T, p) {
    const q = easeOut(p); const l = Math.round(T.left * q), r = Math.round(T.right * q);
    const a = tally.querySelector('[data-n=left]'), b = tally.querySelector('[data-n=right]'); if (a) a.textContent = NUM.format(l); if (b) b.textContent = NUM.format(r);
  }
  function waveFrame(t) { // t seconds since the start of the sequence
    const reveal = clamp((t - 0.6) / Math.min(6.2, W.dur * 0.3), 0, 1.1);
    cmat.uniforms.uT.value = reveal;
    tickCount(W.totals, (t - 0.9) / Math.min(6.2, W.dur * 0.3));
    const seq = [['height', 3.2, 8.2], ['blank', 8.8, 12.4], ['texas', 13.0, 19.2], ['right', 19.8, 25.5]];
    for (const [k, a, b] of seq) { const c = CALL[k]; if (c) c.on = t >= a && t < b; }
    for (const c of callouts) if (c.from != null) c.on = t >= c.from && t < c.to;
    title.style.opacity = clamp(t / 0.8, 0, 1); tally.style.opacity = clamp((t - 1.0) / 0.8, 0, 1);
    foot.style.opacity = clamp((t - 1.6) / 0.8, 0, 1); legend.style.opacity = clamp((t - 1.6) / 0.8, 0, 1);
    if (!userCam) {
      const p = clamp(t / W.dur, 0, 1);
      cam.az = lerp(0.50, 0.22, easeInOut(p)); cam.el = lerp(0.82, 0.66, easeInOut(p)); cam.dist = fitDist() * lerp(1.04, 0.94, easeInOut(p)); cam.pan = lerp(10, 50, p); cam.tx = lerp(0, 20, p); cam.tz = lerp(0, -20, p);
    }
  }

  /* ---------- picking ---------- */
  let hoverId = -1, lastPick = 0;
  const pickTarget = new THREE.WebGLRenderTarget(1, 1); const pickBuf = new Uint8Array(4);
  const pickMat = new THREE.RawShaderMaterial({
    vertexShader: 'precision highp float; uniform mat4 modelViewMatrix, projectionMatrix; attribute vec3 position;' + COUNTY_VS.replace('varying vec3 vColor;', 'varying vec3 vColor; varying float vId;').replace('vColor = aColor;', 'vColor = aColor; vId = aId;'),
    fragmentShader: 'precision highp float; varying float vId; void main(){ float id = vId + 1.0; gl_FragColor = vec4(mod(id, 256.0) / 255.0, floor(id / 256.0) / 255.0, 0.0, 1.0); }',
    uniforms: cmat.uniforms, side: THREE.DoubleSide
  });
  function pick(ev) { // draw the county ids into one pixel under the pointer
    const r = el.getBoundingClientRect(); const x = (ev.clientX - r.left) * DPR, y = (ev.clientY - r.top) * DPR;
    const w = renderer.domElement.width, h = renderer.domElement.height;
    camera.setViewOffset(w, h, Math.floor(x), Math.floor(y), 1, 1);
    const old = counties.material; counties.material = pickMat; const oldClear = renderer.getClearColor(new THREE.Color()); renderer.setClearColor(0x000000, 1);
    plate.visible = lines.visible = floor.visible = false;
    renderer.setRenderTarget(pickTarget); renderer.render(scene, camera); renderer.readRenderTargetPixels(pickTarget, 0, 0, 1, 1, pickBuf);
    renderer.setRenderTarget(null); counties.material = old; renderer.setClearColor(oldClear, 1); camera.clearViewOffset(); plate.visible = lines.visible = floor.visible = true;
    const id = pickBuf[0] + pickBuf[1] * 256 - 1;
    return id >= 0 && id < C.length ? { i: id } : null;
  }
  function showTip(i, ev) {
    const c = C[i], s = stat[i]; const r = el.getBoundingClientRect();
    if (!s) { tip.innerHTML = `<b>${c.n}${c.st ? ', ' + c.st : ''}</b><span>${NORACE.has(c.st) ? 'No Senate or governor race in 2026' : 'No 2026 count reported yet'}</span>`; }
    else {
      const stt = shift.states[c.st], race = stt && stt.races && stt.races[s.race];
      const f = v => (v > 0 ? 'D+' : v < 0 ? 'R+' : 'Even ') + Math.abs(v).toFixed(1);
      tip.innerHTML = `<b>${c.n}${c.st ? ', ' + c.st : ''}</b><span class="${s.sh >= 0 ? 'b' : 'r'}">${s.sh >= 0 ? 'Moved left' : 'Moved right'} ${Math.abs(s.sh).toFixed(1)} pts</span><span>2024 Harris–Trump: ${f(s.m24)}</span><span>2026 ${race ? (race.key === 'S' ? 'Senate' : 'Governor') : ''}: ${f(s.m26)}${race ? ` (${race.dem.split(' ').pop()} v ${race.rep.split(' ').pop()})` : ''}</span><span>${NUM.format(s.t)} votes, ${s.e != null ? Math.round(s.e) : '–'}% of expected</span>`;
    }
    tip.hidden = false; const x = ev.clientX - r.left, y = ev.clientY - r.top; const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.transform = `translate(${clamp(x + 14, 6, r.width - tw - 6)}px, ${clamp(y - th - 10, 6, r.height - th - 6)}px)`;
  }
  function onMove(ev) {
    if (dragging) { const dx = ev.clientX - dragging.x, dy = ev.clientY - dragging.y; if (Math.abs(dx) + Math.abs(dy) > 3) dragging.moved = true; userCam = userCam || Object.assign({}, cam); userCam.az = dragging.az - dx * 0.006; userCam.el = clamp(dragging.el + dy * 0.004, 0.18, 1.35); Object.assign(cam, userCam); draw(); return; }
    if (!O.interactive || view !== 'wave') return;
    const now = performance.now(); if (now - lastPick < 40) return; lastPick = now;
    const h = pick(ev);
    const id = h ? h.i : -1; if (id !== hoverId) { hoverId = id; cmat.uniforms.uHover.value = id; draw(); }
    if (h) showTip(h.i, ev); else tip.hidden = true;
  }
  if (O.interactive) {
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', () => { tip.hidden = true; if (hoverId !== -1) { hoverId = -1; cmat.uniforms.uHover.value = -1; draw(); } });
    el.addEventListener('pointerdown', ev => { if (O.mode === 'hero') return; dragging = { x: ev.clientX, y: ev.clientY, az: cam.az, el: cam.el, moved: false }; el.setPointerCapture(ev.pointerId); });
    el.addEventListener('pointerup', ev => { if (dragging && !dragging.moved && ev.pointerType === 'touch') { const h = pick(ev); if (h) { hoverId = h.i; cmat.uniforms.uHover.value = h.i; showTip(h.i, ev); draw(); } else tip.hidden = true; } dragging = null; });
    el.addEventListener('wheel', ev => { if (O.mode === 'hero') return; ev.preventDefault(); userCam = userCam || Object.assign({}, cam); userCam.dist = clamp(userCam.dist * (1 + ev.deltaY * 0.001), 450, 3200); Object.assign(cam, userCam); draw(); }, { passive: false });
  }

  /* ---------- loop ---------- */
  function draw() { placeCamera(cam); renderer.render(scene, camera); if (view === 'wave') placeCallouts(); else if (night) night.hud(); }
  function frame(now) {
    W.raf = 0;
    if (!W.playing) return;
    const dt = Math.min(0.05, (now - (W.last || now)) / 1000); W.last = now;
    if (view === 'wave') {
      W.t += dt; if (W.t > W.dur) { if (O.loop) { W.t = 0; userCam = null; } else { W.t = W.dur; W.playing = false; W.ended = true; } }
      waveFrame(W.t);
    } else if (night) {
      night.step(dt);
    }
    if (O.onTime) O.onTime(view === 'wave' ? W.t / W.dur : night ? night.progress() : 0);
    draw();
    W.raf = requestAnimationFrame(frame);
  }
  function play() { if (W.ended && view === 'wave') { W.t = 0; W.ended = false; } W.playing = true; W.last = 0; if (!W.raf) W.raf = requestAnimationFrame(frame); el.classList.add('is-playing'); }
  function pause() { W.playing = false; if (W.raf) cancelAnimationFrame(W.raf); W.raf = 0; el.classList.remove('is-playing'); }

  // pause when off screen, resume when back
  const io = new IntersectionObserver(es => { for (const e of es) { if (e.isIntersecting) { if (W.wasPlaying) play(); } else { W.wasPlaying = W.playing; if (W.playing) pause(); } } }, { threshold: 0.05 });
  io.observe(el);
  const vis = () => { if (document.hidden) { W.wasPlaying = W.playing; if (W.playing) pause(); } else if (W.wasPlaying) play(); };
  document.addEventListener('visibilitychange', vis);

  /* ---------- the night view ---------- */
  async function ensureNight() {
    if (night) return night;
    const N = await loadNight();
    night = buildNight({ N, geo, C, ci, cx, cz, scene, camera, renderer, hud, leaders, el, cam, fitDist, toScreen, mode: O.mode, counties, cmat, plate, lines });
    return night;
  }
  async function setView(v) {
    if (v === view && (v === 'wave' || night)) return;
    tip.hidden = true;
    if (v === 'night') { await ensureNight(); view = 'night'; night.show(); el.dataset.view = 'night'; }
    else { if (night) night.hide(); view = 'wave'; el.dataset.view = 'wave'; buildWaveHud(); W.t = 0; userCam = null; W.ended = false; }
    counties.visible = view === 'wave';
    draw(); if (O.autoplay) play();
  }

  /* ---------- fullscreen ---------- */
  function fullscreen(on) {
    const target = O.fsTarget || el;
    if (on === undefined) on = !isFs();
    if (on) { if (target.requestFullscreen) target.requestFullscreen().catch(() => target.classList.add('wave-theater')); else target.classList.add('wave-theater'); }
    else { if (document.fullscreenElement) document.exitFullscreen(); target.classList.remove('wave-theater'); }
    setTimeout(() => { resize(); draw(); }, 80);
  }
  const isFs = () => !!document.fullscreenElement || (O.fsTarget || el).classList.contains('wave-theater');
  document.addEventListener('fullscreenchange', () => { setTimeout(() => { resize(); draw(); }, 60); });

  /* ---------- go ---------- */
  const nightMeta = await loadNight().catch(() => null);
  if (nightMeta) closeMin = nightMeta.close || {};
  W.totals = paintWave(W.race);
  resize();
  el.dataset.view = 'wave';
  buildWaveHud(); waveFrame(0); draw();
  if (view === 'night') await setView('night');
  const ctl = {
    play, pause, draw, fullscreen, isFs,
    get playing() { return W.playing; }, get view() { return view; },
    setView, seek(p) { if (view === 'wave') { W.t = clamp(p, 0, 1) * W.dur; userCam = null; waveFrame(W.t); } else if (night) night.seek(p); draw(); },
    replay() { if (view === 'wave') { W.t = 0; W.ended = false; userCam = null; } else if (night) night.seek(0); play(); },
    setRace(r) { W.race = r; W.totals = paintWave(r); buildWaveHud(); waveFrame(W.t); draw(); return W.totals; },
    totals() { return W.totals; }, shift, geo,
    resetCamera() { userCam = null; draw(); },
    destroy() { pause(); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', vis); renderer.dispose(); el.innerHTML = ''; }
  };
  if (O.onReady) O.onReady(ctl);
  if (O.autoplay) play();
  return ctl;
}

/* ================= election night ================= */
function buildNight(ctx) {
  const { N, geo, C, ci, cx, cz, scene, camera, hud, leaders, el, cam, fitDist, toScreen, mode, counties, cmat, plate, lines } = ctx;
  const group = new THREE.Group(); scene.add(group); group.visible = false;
  const T0 = 0, TEND = N.end || 540; // minutes since 6 p.m. ET
  const SPEED = mode === 'hero' ? TEND / 48 : TEND / 64; // replay minutes per real second
  const S = { t: 0, hold: 0, ended: false };
  const tmp = new THREE.Color();

  /* spikes: one per county, height from the House vote reported there, rising from the state's poll close */
  const sp = [], tipPos = [], sv = [], scl = [], stau = [], sce = [], sjit = [], scol = [], tipFlag = [];
  const cnt = N.counties; const byState = {};
  let maxVotes = 1;
  for (const c of C) { const v = cnt[c.id]; if (v && v[2] > maxVotes) maxVotes = v[2]; }
  for (const c of C) {
    const v = cnt[c.id]; if (!v || !v[2]) continue;
    const st = c.st; (byState[st] = byState[st] || []).push(c);
    const close = N.close[st] != null ? N.close[st] : 120, tau = N.tau[st] || 150, ceil = Math.min(1, (N.ceil[st] || 0.95) / 0.99);
    const jit = ((c.id.charCodeAt(2) * 31 + c.id.charCodeAt(4) * 17) % 100) / 100 * Math.min(40, tau * 0.35) + 2;
    const lead = v[0] >= v[1] ? PAL.dem : PAL.rep; const share = Math.abs(v[0] - v[1]) / v[2];
    tmp.copy(lead).lerp(col('#d7e3f4'), clamp(0.5 - share * 2.2, 0, 0.45));
    for (const tipv of [0, 1]) { sp.push(c.cx, 0, c.cy); tipFlag.push(tipv); sv.push(v[2] / maxVotes); scl.push(close); stau.push(tau); sce.push(ceil); sjit.push(jit); scol.push(tmp.r, tmp.g, tmp.b); }
    tipPos.push(c.cx, 0, c.cy);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('aTip', new THREE.Float32BufferAttribute(tipFlag, 1));
  sg.setAttribute('aVotes', new THREE.Float32BufferAttribute(sv, 1)); sg.setAttribute('aClose', new THREE.Float32BufferAttribute(scl, 1)); sg.setAttribute('aTau', new THREE.Float32BufferAttribute(stau, 1));
  sg.setAttribute('aCeil', new THREE.Float32BufferAttribute(sce, 1)); sg.setAttribute('aJit', new THREE.Float32BufferAttribute(sjit, 1)); sg.setAttribute('aColor', new THREE.Float32BufferAttribute(scol, 3));
  const HMAX = 260;
  const smat = new THREE.RawShaderMaterial({ vertexShader: 'precision highp float; uniform mat4 modelViewMatrix, projectionMatrix; attribute vec3 position;' + SPIKE_VS, fragmentShader: SPIKE_FS, uniforms: { uTime: { value: 0 }, uHmax: { value: HMAX } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const spikes = new THREE.LineSegments(sg, smat); group.add(spikes);
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(tipPos, 3));
  const every2 = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += 2 * n) for (let k = 0; k < n; k++) o.push(arr[i + k]); return o; };
  tg.setAttribute('aVotes', new THREE.Float32BufferAttribute(every2(sv, 1), 1)); tg.setAttribute('aClose', new THREE.Float32BufferAttribute(every2(scl, 1), 1)); tg.setAttribute('aTau', new THREE.Float32BufferAttribute(every2(stau, 1), 1));
  tg.setAttribute('aCeil', new THREE.Float32BufferAttribute(every2(sce, 1), 1)); tg.setAttribute('aJit', new THREE.Float32BufferAttribute(every2(sjit, 1), 1)); tg.setAttribute('aColor', new THREE.Float32BufferAttribute(every2(scol, 3), 3));
  const tmat = new THREE.RawShaderMaterial({ vertexShader: 'precision highp float; uniform mat4 modelViewMatrix, projectionMatrix; attribute vec3 position;' + TIP_VS, fragmentShader: TIP_FS, uniforms: { uTime: { value: 0 }, uHmax: { value: HMAX }, uPx: { value: 1 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const tips = new THREE.Points(tg, tmat); group.add(tips);

  /* the chamber: 435 House seats in rows on a half circle standing behind the map; the Senate's 35 on an inner arc */
  const H = N.races.filter(r => r.o === 'H' && !/^US/.test(r.id)), SN = N.races.filter(r => r.o === 'S'), GV = N.races.filter(r => r.o === 'G');
  const byTime = (a, b) => (a.at == null ? 1e9 : a.at) - (b.at == null ? 1e9 : b.at);
  const seatOrder = (list, total) => { // called seats fill from the outside in: Democrats from the left, Republicans from the right; uncalled stay in the middle
    const d = list.filter(r => r.p === 'D').sort(byTime), rr = list.filter(r => r.p === 'R').sort(byTime), u = list.filter(r => r.p !== 'D' && r.p !== 'R');
    const order = new Array(total); let L = 0, R = total - 1;
    d.forEach(r => { order[L++] = r; }); rr.forEach(r => { order[R--] = r; }); u.forEach(r => { order[L++] = r; });
    return order;
  };
  const CH = { x: cx + 10, y: 150, z: cz - 290, r0: 200, r1: 330, rows: 8, rS: 140 };
  function arcPoint(f, r) { const a = Math.PI * (1 - f); return [CH.x + r * Math.cos(a), CH.y + r * Math.sin(a), CH.z]; }
  const seatPos = [], seatAt = [], seatCol = [], seatBig = []; const seatOf = new Map();
  const hOrder = seatOrder(H, 435);
  { // distribute 435 across rows by circumference
    const rows = []; let tot = 0; for (let k = 0; k < CH.rows; k++) { const r = CH.r0 + (CH.r1 - CH.r0) * k / (CH.rows - 1); rows.push(r); tot += r; }
    let n = 0; const counts = rows.map((r, k) => k === rows.length - 1 ? 435 - n : (n += Math.round(435 * r / tot), Math.round(435 * r / tot)));
    const slots = []; counts.forEach((c, k) => { for (let i = 0; i < c; i++) slots.push([i / (c - 1), rows[k], i, k]); });
    slots.sort((a, b) => a[0] - b[0] || a[3] - b[3]); // by angle, then row
    slots.forEach((s, i) => { const r = hOrder[i]; const [x, y, z] = arcPoint(s[0], s[1]); seatPos.push(x, y, z); seatAt.push(r && r.at != null && r.at <= TEND + 2 ? r.at : -1); const c = r && r.p === 'D' ? PAL.dem : r && r.p === 'R' ? PAL.rep : PAL.grey; seatCol.push(c.r, c.g, c.b); seatBig.push(0); if (r) seatOf.set(r.id, [x, y, z]); });
  }
  const sOrder = seatOrder(SN, SN.length);
  sOrder.forEach((r, i) => { const [x, y, z] = arcPoint(SN.length > 1 ? i / (SN.length - 1) : 0.5, CH.rS); seatPos.push(x, y, z); seatAt.push(r && r.at != null && r.at <= TEND + 2 ? r.at : -1); const c = r && r.p === 'D' ? PAL.dem : r && r.p === 'R' ? PAL.rep : PAL.grey; seatCol.push(c.r, c.g, c.b); seatBig.push(1); if (r) seatOf.set(r.id, [x, y, z]); });
  const seatG = new THREE.BufferGeometry();
  seatG.setAttribute('position', new THREE.Float32BufferAttribute(seatPos, 3)); seatG.setAttribute('aAt', new THREE.Float32BufferAttribute(seatAt, 1)); seatG.setAttribute('aColor', new THREE.Float32BufferAttribute(seatCol, 3)); seatG.setAttribute('aBig', new THREE.Float32BufferAttribute(seatBig, 1));
  const seatMat = new THREE.RawShaderMaterial({ vertexShader: 'precision highp float; uniform mat4 modelViewMatrix, projectionMatrix; attribute vec3 position;' + SEAT_VS, fragmentShader: SEAT_FS, uniforms: { uTime: { value: 0 }, uPx: { value: 1 } }, transparent: true, depthWrite: false });
  const seats = new THREE.Points(seatG, seatMat); group.add(seats);

  /* streams: when a race is called, its counties reach up to its seat */
  const SEG = 18; const A = [], Cc = [], B = [], U = [], BIRTH = [], SCOL = [], SEED = [];
  const stateCounties = st => (byState[st] || []);
  let nStreams = 0;
  function addStream(c, seat, at, color, seed) {
    const h = HMAX * Math.sqrt((cnt[c.id] ? cnt[c.id][2] : 0) / maxVotes) * 0.8;
    const a = [c.cx, h, c.cy], b = seat;
    const mid = [(a[0] + b[0]) / 2 + (seed - 0.5) * 140, Math.max(a[1], b[1]) + 110 + seed * 130, (a[2] + b[2]) / 2 - 30];
    for (let s = 0; s < SEG; s++) { for (const u of [s / SEG, (s + 1) / SEG]) { A.push(...a); Cc.push(...mid); B.push(...b); U.push(u); BIRTH.push(at); SCOL.push(color.r, color.g, color.b); SEED.push(seed); } }
    nStreams++;
  }
  for (const r of N.races) {
    if (r.at == null || r.at > TEND + 2 || !r.p) continue;
    const seat = seatOf.get(r.id); if (!seat) continue;
    const color = r.p === 'D' ? PAL.dem : PAL.rep;
    const list = r.o === 'H' ? (r.u || []).map(f => C[ci.get(f)]).filter(Boolean) : stateCounties(r.st);
    list.forEach((c, k) => { if (r.o !== 'H' && list.length > 90 && k % 2) return; addStream(c, seat, r.at + (k % 7) * 0.6, color, ((k * 37) % 23) / 23); });
  }
  const stG = new THREE.BufferGeometry();
  stG.setAttribute('aA', new THREE.Float32BufferAttribute(A, 3)); stG.setAttribute('aC', new THREE.Float32BufferAttribute(Cc, 3)); stG.setAttribute('aB', new THREE.Float32BufferAttribute(B, 3));
  stG.setAttribute('aU', new THREE.Float32BufferAttribute(U, 1)); stG.setAttribute('aBirth', new THREE.Float32BufferAttribute(BIRTH, 1)); stG.setAttribute('aColor', new THREE.Float32BufferAttribute(SCOL, 3)); stG.setAttribute('aSeed', new THREE.Float32BufferAttribute(SEED, 1));
  stG.setAttribute('position', new THREE.Float32BufferAttribute(A, 3));
  const stMat = new THREE.RawShaderMaterial({ vertexShader: 'precision highp float; uniform mat4 modelViewMatrix, projectionMatrix; attribute vec3 position;' + STREAM_VS, fragmentShader: STREAM_FS, uniforms: { uTime: { value: 0 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const streams = new THREE.LineSegments(stG, stMat); group.add(streams);

  /* HUD */
  const box = document.createElement('div'); box.className = 'night-hud'; box.hidden = true; hud.appendChild(box);
  box.innerHTML = `
    <div class="n-side n-dem"><p class="n-lab">Democrats</p><b class="n-big" data-k="dv">0</b><span class="n-sub">votes counted</span><svg class="n-spark" viewBox="0 0 120 26" preserveAspectRatio="none"><path data-k="dpath" d=""/></svg><p class="n-called"><b data-k="dc">0</b> called</p><ul class="n-calls" data-k="dl"></ul></div>
    <div class="n-side n-rep"><p class="n-lab">Republicans</p><b class="n-big" data-k="rv">0</b><span class="n-sub">votes counted</span><svg class="n-spark" viewBox="0 0 120 26" preserveAspectRatio="none"><path data-k="rpath" d=""/></svg><p class="n-called"><b data-k="rc">0</b> called</p><ul class="n-calls" data-k="rl"></ul></div>
    <div class="n-mid"><div class="n-clock"><b data-k="clock">6:00 PM ET</b><span data-k="close"></span></div><ul class="n-states" data-k="states"></ul><p class="n-more" data-k="more"></p><p class="n-pct"><b data-k="pct">0%</b> of the expected vote in</p><p class="n-src">Calls and final counts: AP via The New York Times · county timing reconstructed by The Watch</p></div>
    <div class="n-end" data-k="end" hidden></div>`;
  const K = {}; box.querySelectorAll('[data-k]').forEach(e => K[e.dataset.k] = e);
  const dSeries = [], rSeries = []; let lastHud = -1;
  const finalVotes = Object.values(cnt).reduce((s, v) => s + v[2], 0);
  const closeGroups = {}; for (const [st, m] of Object.entries(N.close)) (closeGroups[m] = closeGroups[m] || []).push(st);
  const label = r => r.o === 'H' ? `${r.st}-${r.seat}` : r.o === 'S' ? `${r.st} Senate` : `${r.st} Gov.`;
  const clock = m => ET.format(new Date(Date.parse(N.t0) + m * 60000)).replace(' ', ' ') + ' ET';
  const progressOf = (st, t) => { const close = N.close[st] != null ? N.close[st] : 120, tau = N.tau[st] || 150, ceil = Math.min(1, (N.ceil[st] || 0.95) / 0.99); return t <= close ? 0 : ceil * (1 - Math.exp(-(t - close) / tau)); };
  function hudTick(t, force) {
    if (!force && t - lastHud < 2 && t !== 0) return; lastHud = t;
    let dv = 0, rv = 0, tv = 0; const margins = [];
    for (const [st, v] of Object.entries(N.stateVotes)) { const p = progressOf(st, t); dv += v[0] * p; rv += v[1] * p; tv += v[2] * p; if (p > 0) margins.push([st, (v[0] - v[1]) * p]); }
    K.clock.textContent = clock(t);
    K.dv.textContent = NUM.format(Math.round(dv)); K.rv.textContent = NUM.format(Math.round(rv));
    dSeries.push(dv); rSeries.push(rv); if (dSeries.length > 160) { dSeries.shift(); rSeries.shift(); }
    const spark = (arr, max) => arr.length < 2 ? '' : 'M' + arr.map((v, i) => `${(i / (arr.length - 1) * 120).toFixed(1)},${(25 - v / (max || 1) * 24).toFixed(1)}`).join(' L');
    const mx = Math.max(dSeries[dSeries.length - 1], rSeries[rSeries.length - 1], 1);
    K.dpath.setAttribute('d', spark(dSeries, mx)); K.rpath.setAttribute('d', spark(rSeries, mx));
    const called = N.races.filter(r => r.at != null && r.at <= t && r.p);
    const dc = called.filter(r => r.p === 'D'), rc = called.filter(r => r.p === 'R');
    K.dc.textContent = dc.length; K.rc.textContent = rc.length;
    K.dl.innerHTML = dc.sort((a, b) => b.at - a.at).slice(0, 2).map(r => `<li>${label(r)}<span>${clock(r.at).replace(' ET', '')}</span></li>`).join('');
    K.rl.innerHTML = rc.sort((a, b) => b.at - a.at).slice(0, 2).map(r => `<li>${label(r)}<span>${clock(r.at).replace(' ET', '')}</span></li>`).join('');
    margins.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const top = margins.slice(0, 9), fm = v => (Math.abs(v) >= 1e6 ? (Math.abs(v) / 1e6).toFixed(1) + 'M' : Math.round(Math.abs(v) / 1000) + 'K');
    K.states.innerHTML = top.map(([st, m]) => `<li class="${m >= 0 ? 'd' : 'r'}">${st} <b>+${fm(m)}</b></li>`).join('');
    K.more.textContent = margins.length > 9 ? `+${margins.length - 9} more` : '';
    const closing = Object.entries(closeGroups).filter(([m]) => t >= +m && t < +m + 28).map(([m, sts]) => sts).flat();
    K.close.textContent = closing.length ? 'Polls close ' + closing.join(' ') : '';
    K.pct.textContent = Math.round(tv / finalVotes * 100) + '%';
    if (t >= TEND - 0.01) {
      const ctl = N.control || {}; const h = ctl.H || {}, s = ctl.S || {};
      const left = N.races.filter(r => r.o !== 'H' && (r.at == null || r.at > TEND)).map(label);
      K.end.hidden = false;
      K.end.innerHTML = `<p class="k">By 3 a.m. ET</p><p><b class="b">${dc.filter(r => r.o === 'H').length}</b> House seats called for Democrats, <b class="r">${rc.filter(r => r.o === 'H').length}</b> for Republicans; Senate ${dc.filter(r => r.o === 'S').length}–${rc.filter(r => r.o === 'S').length} of 35 on the ballot.</p><p>Still counting at 3 a.m.: ${left.length ? left.join(', ') : 'nothing'}${H.filter(r => r.at == null || r.at > TEND).length ? ` and ${H.filter(r => r.at == null || r.at > TEND).length} House seats` : ''}.</p><p class="k">As of ${new Date(N.asOf).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET</p><p>House <b class="b">${h.D ?? '–'}</b>–<b class="r">${h.R ?? '–'}</b> (${h.called ?? '–'} of 435 called); Senate <b class="b">${s.D ?? '–'}</b>–<b class="r">${s.R ?? '–'}</b>.</p>`;
    } else K.end.hidden = true;
  }
  const night = {
    show() { group.visible = true; box.hidden = false; counties.visible = false; plate.visible = true; lines.visible = true; hud.querySelectorAll('.wave-title,.wave-tally,.wave-legend,.wave-foot,.wave-callout').forEach(e => e.hidden = true); leaders.innerHTML = ''; S.t = 0; S.hold = 0; S.ended = false; night.apply(); night.cam(); },
    hide() { group.visible = false; box.hidden = true; hud.querySelectorAll('.wave-title,.wave-tally,.wave-legend,.wave-foot').forEach(e => e.hidden = false); },
    step(dt) {
      if (S.ended) { S.hold += dt; if (S.hold > 6 && ctx.mode === 'hero') { S.t = 0; S.hold = 0; S.ended = false; dSeries.length = rSeries.length = 0; } else return; }
      S.t = Math.min(TEND, S.t + dt * SPEED); if (S.t >= TEND) S.ended = true;
      night.apply(); night.cam();
    },
    apply() { const t = S.t; smat.uniforms.uTime.value = t; tmat.uniforms.uTime.value = t; seatMat.uniforms.uTime.value = t; stMat.uniforms.uTime.value = t; hudTick(t, S.ended); },
    cam() { const p = S.t / TEND; cam.az = lerp(0.12, -0.10, p); cam.el = lerp(0.27, 0.31, p); cam.dist = fitDist() * lerp(1.22, 1.14, p); cam.pan = 95; cam.tx = 0; cam.tz = -120; },
    hud() { },
    progress() { return S.t / TEND; },
    seek(p) { S.t = clamp(p, 0, 1) * TEND; S.ended = S.t >= TEND; dSeries.length = rSeries.length = 0; lastHud = -1; night.apply(); night.cam(); },
    resize(w, h) { tmat.uniforms.uPx.value = Math.min(window.devicePixelRatio || 1, 2); seatMat.uniforms.uPx.value = Math.min(window.devicePixelRatio || 1, 2); },
    nStreams
  };
  night.resize();
  return night;
}
