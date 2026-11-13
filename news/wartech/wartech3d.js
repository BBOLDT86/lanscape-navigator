/* Iran war tech in 3-D: every dollar as volume. For each company a glass cube whose volume is its Pentagon contract
   ceiling, and inside it a glowing cube whose volume is the political money tied to the company or its leaders — one
   scale for both colors, so the orange cube's share of the glass is the real ratio. three.js r170 (vendored by the wave).
   Views: overview (slow orbit), tour (the camera visits each company with a caption), focus (tap a company).
   The numbers match the report 2026-11-12-iran-war-tech-pentagon-contracts-political-money. window.WT3D controls it. */
import * as THREE from '../wave/lib/three.module.min.js';

// millions of dollars; c = contract ceiling, p = political money
const CO = [
  { id: 'anduril', name: 'Anduril', c: 20000, p: 3.2, row: 0 },
  { id: 'palantir', name: 'Palantir', c: 11300, p: 17.6, row: 0 },
  { id: 'cloud', name: 'AWS · Microsoft · Google · Oracle', short: 'The cloud four', c: 9000, p: 48.6, row: 0 },
  { id: 'musk', name: 'xAI + SpaceX', c: 6100, p: 366, row: 1 },
  { id: 'openai', name: 'OpenAI', c: 200, p: 51, row: 1 },
  { id: 'anthropic', name: 'Anthropic', c: 200, p: 40.8, row: 1 },
];

const L = (() => { // the language the page asked for, else the reader's choice on The Watch
  const q = new URLSearchParams(location.search).get('lang');
  if (q && /^(en|pt|de)$/.test(q)) return q;
  try { const s = localStorage.getItem('watch.lang'); if (s && /^(en|pt|de)$/.test(s)) return s; } catch (e) { /* storage off */ }
  return 'en';
})();

const STR = {
  en: {
    title: 'Every dollar as volume',
    sub: 'Glass: the most each Pentagon contract allows. Orange: political money tied to the company or its leaders. One scale for both.',
    tour: 'Tour', pause: 'Pause', overview: 'Overview', full: 'Full screen', open: 'Open', exit: 'Exit full screen', hint: 'Drag to turn · tap a cube',
    ratio: r => r >= 10 ? `${fmtN(r)} to 1` : `money = ${Math.round(100 / r)}% of contract`,
    c: { anduril: '$20B', palantir: '$11.3B', cloud: '$9B shared', musk: '$6.1B+', openai: '$200M', anthropic: '$200M, ended' },
    p: { anduril: '$3.2M', palantir: '$17.6M', cloud: '$48.6M', musk: '$366M', openai: '$51M', anthropic: '$40.8M' },
    cl: 'contract', pl: 'political money',
    intro: 'Each cube’s volume is its dollars. The glass is the most a Pentagon contract allows; the orange inside is the political money tied to the company or its leaders.',
    cap: {
      anduril: 'Anduril: a $20 billion Army ceiling, $3.2 million in political money. The contract is about 6,300 times the money; the orange is a speck in the corner.',
      palantir: 'Palantir: $11.3 billion in ceilings, $17.6 million counting its $10 million ballroom pledge. About 640 to 1.',
      cloud: 'Amazon, Microsoft, Google and Oracle share a $9 billion cloud ceiling awarded in 2022, under Biden. $48.6 million, mostly inauguration and ballroom gifts. About 185 to 1.',
      musk: 'Musk’s companies: at least $6.1 billion with SpaceX’s launch award. His own $366 million is the biggest orange cube by far. About 17 to 1, the exception.',
      openai: 'OpenAI: a $200 million ceiling and $51 million from its leaders, given personally. The money is a quarter of the contract.',
      anthropic: 'Anthropic: $200 million, cancelled after a fight over how its AI could be used. $40.8 million, a fifth of the contract.',
    },
    outro: 'Where the contracts are biggest, the political money is a speck. It fills the most glass at the AI labs with the smallest contracts.',
    note: 'Ceilings are the most a contract allows, not money spent.',
  },
  pt: {
    title: 'Cada dólar como volume',
    sub: 'Vidro: o máximo que cada contrato do Pentágono permite. Laranja: dinheiro político ligado à empresa ou a seus líderes. Uma escala para os dois.',
    tour: 'Tour', pause: 'Pausar', overview: 'Visão geral', full: 'Tela cheia', open: 'Abrir', exit: 'Sair da tela cheia', hint: 'Arraste para girar · toque num cubo',
    ratio: r => r >= 10 ? `${fmtN(r)} para 1` : `dinheiro = ${Math.round(100 / r)}% do contrato`,
    c: { anduril: 'US$ 20 bi', palantir: 'US$ 11,3 bi', cloud: 'US$ 9 bi divididos', musk: 'US$ 6,1 bi+', openai: 'US$ 200 mi', anthropic: 'US$ 200 mi, encerrado' },
    p: { anduril: 'US$ 3,2 mi', palantir: 'US$ 17,6 mi', cloud: 'US$ 48,6 mi', musk: 'US$ 366 mi', openai: 'US$ 51 mi', anthropic: 'US$ 40,8 mi' },
    cl: 'contrato', pl: 'dinheiro político',
    intro: 'O volume de cada cubo são os seus dólares. O vidro é o máximo que um contrato do Pentágono permite; o laranja dentro é o dinheiro político ligado à empresa ou a seus líderes.',
    cap: {
      anduril: 'Anduril: um teto de US$ 20 bilhões do Exército, US$ 3,2 milhões em dinheiro político. O contrato é cerca de 6.300 vezes o dinheiro; o laranja é um grão no canto.',
      palantir: 'Palantir: US$ 11,3 bilhões em tetos, US$ 17,6 milhões contando a promessa de US$ 10 milhões para o salão de baile. Cerca de 640 para 1.',
      cloud: 'Amazon, Microsoft, Google e Oracle dividem um teto de nuvem de US$ 9 bilhões concedido em 2022, no governo Biden. US$ 48,6 milhões, quase tudo em doações para a posse e o salão de baile. Cerca de 185 para 1.',
      musk: 'As empresas de Musk: pelo menos US$ 6,1 bilhões com o contrato de lançamentos da SpaceX. Os US$ 366 milhões dele são de longe o maior cubo laranja. Cerca de 17 para 1, a exceção.',
      openai: 'OpenAI: um teto de US$ 200 milhões e US$ 51 milhões de seus líderes, como pessoas físicas. O dinheiro é um quarto do contrato.',
      anthropic: 'Anthropic: US$ 200 milhões, cancelados após uma briga sobre como sua IA podia ser usada. US$ 40,8 milhões, um quinto do contrato.',
    },
    outro: 'Onde os contratos são maiores, o dinheiro político é um grão. Ele ocupa mais vidro nos laboratórios de IA, que têm os menores contratos.',
    note: 'Tetos são o máximo que um contrato permite, não dinheiro gasto.',
  },
  de: {
    title: 'Jeder Dollar als Volumen',
    sub: 'Glas: das Höchste, was jeder Pentagon-Vertrag erlaubt. Orange: politisches Geld des Unternehmens oder seiner Führung. Ein Maßstab für beide.',
    tour: 'Rundgang', pause: 'Pause', overview: 'Überblick', full: 'Vollbild', open: 'Öffnen', exit: 'Vollbild beenden', hint: 'Ziehen zum Drehen · Würfel antippen',
    ratio: r => r >= 10 ? `${fmtN(r)} zu 1` : `Geld = ${Math.round(100 / r)} % des Vertrags`,
    c: { anduril: '20 Mrd. $', palantir: '11,3 Mrd. $', cloud: '9 Mrd. $ geteilt', musk: '6,1 Mrd. $+', openai: '200 Mio. $', anthropic: '200 Mio. $, beendet' },
    p: { anduril: '3,2 Mio. $', palantir: '17,6 Mio. $', cloud: '48,6 Mio. $', musk: '366 Mio. $', openai: '51 Mio. $', anthropic: '40,8 Mio. $' },
    cl: 'Vertrag', pl: 'politisches Geld',
    intro: 'Das Volumen jedes Würfels sind seine Dollar. Das Glas ist das Höchste, was ein Pentagon-Vertrag erlaubt; das Orange darin ist das politische Geld des Unternehmens oder seiner Führung.',
    cap: {
      anduril: 'Anduril: eine Obergrenze der Armee von 20 Milliarden Dollar, 3,2 Millionen politisches Geld. Der Vertrag ist etwa 6.300-mal so groß; das Orange ist ein Krümel in der Ecke.',
      palantir: 'Palantir: 11,3 Milliarden Dollar an Obergrenzen, 17,6 Millionen samt der Zusage von 10 Millionen für den Ballsaal. Etwa 640 zu 1.',
      cloud: 'Amazon, Microsoft, Google und Oracle teilen sich eine Cloud-Obergrenze von 9 Milliarden Dollar, vergeben 2022 unter Biden. 48,6 Millionen, meist Spenden für Amtseinführung und Ballsaal. Etwa 185 zu 1.',
      musk: 'Musks Unternehmen: mindestens 6,1 Milliarden Dollar mit dem Startauftrag von SpaceX. Seine eigenen 366 Millionen sind mit Abstand der größte orange Würfel. Etwa 17 zu 1, die Ausnahme.',
      openai: 'OpenAI: eine Obergrenze von 200 Millionen Dollar und 51 Millionen von der Führung, privat gegeben. Das Geld ist ein Viertel des Vertrags.',
      anthropic: 'Anthropic: 200 Millionen Dollar, gekündigt nach einem Streit darüber, wie seine KI eingesetzt werden darf. 40,8 Millionen, ein Fünftel des Vertrags.',
    },
    outro: 'Wo die Verträge am größten sind, ist das politische Geld ein Krümel. Am meisten Glas füllt es bei den KI-Laboren mit den kleinsten Verträgen.',
    note: 'Obergrenzen sind das Höchste, was ein Vertrag erlaubt, nicht ausgegebenes Geld.',
  },
};
const S = STR[L];
function fmtN(n) { return new Intl.NumberFormat(L === 'en' ? 'en-US' : L === 'pt' ? 'pt-BR' : 'de-DE', { maximumFractionDigits: 0 }).format(Math.round(n / (n > 1000 ? 100 : n > 100 ? 10 : 1)) * (n > 1000 ? 100 : n > 100 ? 10 : 1)); }

const K = 0.32;                         // side = K * cube root of millions: volume is proportional to dollars
const side = m => K * Math.cbrt(m);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const bounce = t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; };

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,170,110,0.95)'); r.addColorStop(0.25, 'rgba(235,104,52,0.45)'); r.addColorStop(1, 'rgba(235,104,52,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function mount(root, opts = {}) {
  const rec = !!opts.rec;                // frame-by-frame recording: time comes from seek()
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: rec, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x081120, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', S.title + '. ' + S.intro);
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x081120, 0.022);
  const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 500);
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x0b1426, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-18, 30, 22); scene.add(key);
  const rim = new THREE.DirectionalLight(0x5a8fff, 0.9); rim.position.set(20, 12, -26); scene.add(rim);

  // floor: a dark mirror-ish plane, a fine grid and a soft pool of light
  const floor = new THREE.Mesh(new THREE.CircleGeometry(80, 96), new THREE.MeshStandardMaterial({ color: 0x0a1628, roughness: 0.55, metalness: 0.35 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const grid = new THREE.GridHelper(120, 120, 0x16304f, 0x10223a); grid.position.y = 0.002; grid.material.transparent = true; grid.material.opacity = 0.55; scene.add(grid);

  // layout: biggest contracts at the back. Wide screens get two rows of three, tall ones three rows of two
  const GAP = 2.6, wide = (root.clientWidth || 800) / Math.max(1, root.clientHeight || 500) >= 1.05;
  const ROWS = (wide ? [[0, 1, 2], [3, 4, 5]] : [[0, 1], [2, 3], [4, 5]]).map(r => r.map(i => CO[i]));
  let zc = 0; const zs = [];
  ROWS.forEach((row, ri) => {
    const big = Math.max(...row.map(c => side(c.c)));
    if (ri) zc += big / 2 + GAP + Math.max(...ROWS[ri - 1].map(c => side(c.c))) / 2;
    zs.push(zc);
    const xg = GAP + (ri === ROWS.length - 1 ? (wide ? 1.4 : 3.2) : 0), w = row.reduce((s, c) => s + side(c.c), 0) + xg * (row.length - 1);
    let x = -w / 2;
    for (const c of row) { const s = side(c.c); c.x = x + s / 2; c.s = s; c.o = side(c.p); c.row = ri; c.zr = zc; x += s + xg; }
  });
  const zmid = (zs[0] + zs[zs.length - 1]) / 2;
  CO.forEach(c => { c.z = c.zr - zmid; });
  const BR = Math.max(...CO.map(c => Math.hypot(c.x, c.z) + c.s * 0.72)); // bounding radius of the whole set

  const glassMat = new THREE.MeshStandardMaterial({ color: 0x4a95ff, emissive: 0x123a8a, emissiveIntensity: 0.9, transparent: true, opacity: 0.2, roughness: 0.1, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xa8d0ff, transparent: true, opacity: 1 });
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xff8a50, emissive: 0xff4a10, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.05 });
  const plateMat = new THREE.MeshBasicMaterial({ color: 0x3f8cff, transparent: true, opacity: 0.16, depthWrite: false });
  const glowTex = glowTexture();
  const box = new THREE.BoxGeometry(1, 1, 1), boxEdges = new THREE.EdgesGeometry(box);

  for (const c of CO) {
    const g = new THREE.Group(); g.position.set(c.x, 0, c.z); scene.add(g);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(c.s, c.s), plateMat); plate.rotation.x = -Math.PI / 2; plate.position.y = 0.01; g.add(plate);
    const glassPivot = new THREE.Group(); g.add(glassPivot);                    // grows from the floor
    const glass = new THREE.Mesh(box, glassMat); glass.scale.set(c.s, c.s, c.s); glass.position.y = c.s / 2; glassPivot.add(glass);
    const edges = new THREE.LineSegments(boxEdges, edgeMat); edges.scale.copy(glass.scale); edges.position.copy(glass.position); glassPivot.add(edges);
    const m = 0.06 * c.s;                                                       // the orange cube sits in the front-left corner
    const core = new THREE.Mesh(box, coreMat); core.scale.set(c.o, c.o, c.o);
    core.userData.home = new THREE.Vector3(-c.s / 2 + c.o / 2 + m, c.o / 2, c.s / 2 - c.o / 2 - m); core.position.copy(core.userData.home); g.add(core);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 }));
    glow.scale.setScalar(Math.max(2.2, c.o * 4.2)); core.add(glow); glow.scale.divideScalar(c.o); // sprite inherits the core's scale
    const lamp = new THREE.PointLight(0xff6a2a, 0, c.s * 1.6, 1.6); lamp.position.copy(core.userData.home); lamp.position.y = c.o * 1.1; g.add(lamp); // the orange lights its glass from inside
    c.g = g; c.glassPivot = glassPivot; c.core = core; c.glow = glow; c.lamp = lamp; c.hit = glass;
  }

  // dust: slow motes drifting up through the scene
  const N = 420, pos = new Float32Array(N * 3), spd = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 60; pos[i * 3 + 1] = Math.random() * 18; pos[i * 3 + 2] = (Math.random() - .5) * 40; spd[i] = 0.15 + Math.random() * 0.35; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x9cc3ff, size: 0.07, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  // HUD
  const hud = document.createElement('div'); hud.className = 'wt-hud'; root.appendChild(hud);
  hud.innerHTML = `<div class="wt-labels"></div>
    <div class="wt-top"><h2>${S.title}</h2><p class="wt-sub">${S.sub}</p><div class="wt-cap" aria-live="polite"><p></p></div></div>
    <div class="wt-bar"><button type="button" data-a="tour" aria-pressed="false"></button><button type="button" data-a="overview">${S.overview}</button>${opts.embed ? `<a href="./${L !== 'en' ? '?lang=' + L : ''}" target="_blank" rel="noopener">${S.open} ↗</a>` : `<button type="button" data-a="full">${S.full}</button>`}<span class="wt-hint">${S.hint}</span></div>`;
  const labWrap = hud.querySelector('.wt-labels'), capP = hud.querySelector('.wt-cap p'), tourBtn = hud.querySelector('[data-a=tour]');
  for (const c of CO) {
    const d = document.createElement('button'); d.type = 'button'; d.className = 'wt-lab'; d.dataset.id = c.id;
    const narrow = root.clientWidth < 560;
    d.innerHTML = narrow ? `<b>${c.short || c.name}</b><span><i class="g"></i>${S.c[c.id].replace(/, .*/, '')} <i class="o"></i>${S.p[c.id]}</span>` : `<b>${c.name}</b><span><i class="g"></i>${S.c[c.id]}</span><span><i class="o"></i>${S.p[c.id]}</span>`;
    d.addEventListener('click', e => { e.stopPropagation(); select(c.id, true); });
    labWrap.appendChild(d); c.lab = d;
  }

  // camera: spherical around a target, eased toward a goal
  const camS = { th: -0.55, ph: 1.08, r: 46, tx: 0, ty: 3.2, tz: 0 }, goal = { ...camS };
  const OVER = () => { // back off far enough that the whole set fits at any turn
    const a = root.clientWidth / Math.max(1, root.clientHeight), vh = THREE.MathUtils.degToRad(cam.fov / 2), hh = Math.atan(Math.tan(vh) * a);
    return { th: goal.th, ph: 1.0, r: BR / Math.sin(Math.min(vh, hh)) * (a < 1.05 ? 0.92 : 0.98), tx: 0, ty: 1.2, tz: 0 }; };
  function focusGoal(c) { // aim between the glass's middle and the orange in its front-left corner
    const a = root.clientWidth / Math.max(1, root.clientHeight), small = c.s < 3;
    return { th: -0.5 + (c.row ? 0.12 : -0.12), ph: small ? 0.92 : 1.1, r: Math.max(c.s * (a < 0.9 ? 4.2 : 2.9), a < 0.9 ? 12 : 9.5), tx: c.x - c.s * 0.2, ty: c.s * 0.3, tz: c.z + c.s * 0.2 }; }

  let mode = 'overview', sel = null, tourI = -1, tourT = 0, auto = true, lastUser = -1e9, t0 = performance.now(), simT = 0;
  const STEP = 5.6, STEPS = ['intro', ...CO.map(c => c.id), 'outro'];
  function setCap(txt) { capP.textContent = txt || ''; capP.parentNode.classList.toggle('on', !!txt); hud.classList.toggle('has-cap', !!txt); }
  function setTourBtn() { const on = mode === 'tour'; tourBtn.setAttribute('aria-pressed', String(on)); tourBtn.textContent = on ? S.pause : '▶ ' + S.tour; }
  function select(id, user) {
    const c = CO.find(x => x.id === id); if (!c) return;
    if (user) { mode = 'focus'; setTourBtn(); lastUser = simT; }
    sel = c; Object.assign(goal, focusGoal(c));
    setCap(S.cap[c.id] + (user ? '' : ''));
    CO.forEach(x => x.lab.classList.toggle('sel', x === c));
  }
  function overview(user) {
    if (user) { mode = 'overview'; setTourBtn(); lastUser = simT; }
    sel = null; Object.assign(goal, OVER()); CO.forEach(x => x.lab.classList.remove('sel'));
    setCap(user ? S.intro : '');
  }
  function startTour() { mode = 'tour'; tourI = -1; tourT = 0; nextStep(); setTourBtn(); }
  function nextStep() {
    tourI = (tourI + 1) % STEPS.length; tourT = 0;
    const s = STEPS[tourI];
    if (s === 'intro') { overview(false); setCap(S.intro); }
    else if (s === 'outro') { overview(false); goal.th -= 0.5; setCap(S.outro); }
    else select(s, false);
  }
  hud.querySelector('.wt-bar').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'tour') { if (mode === 'tour') { mode = 'overview'; setTourBtn(); } else startTour(); }
    if (b.dataset.a === 'overview') overview(true);
    if (b.dataset.a === 'full') opts.onFull && opts.onFull();
  });

  // input: drag to turn (horizontal on touch, so the page still scrolls), wheel to zoom, tap to pick
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let drag = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, th: goal.th, ph: goal.ph, moved: false, touch: e.pointerType === 'touch' }; });
  addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
    if (!drag.moved) return;
    goal.th = drag.th - dx * 0.006; if (!drag.touch) goal.ph = clamp(drag.ph - dy * 0.004, 0.45, 1.45);
    if (mode === 'tour') { mode = sel ? 'focus' : 'overview'; setTourBtn(); }
    lastUser = simT;
  });
  addEventListener('pointerup', e => {
    if (drag && !drag.moved) {
      const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const hit = ray.intersectObjects(CO.map(c => c.hit), false)[0];
      if (hit) select(CO.find(c => c.hit === hit.object).id, true); else if (mode === 'focus') overview(true);
    }
    drag = null;
  });
  el.addEventListener('wheel', e => { e.preventDefault(); goal.r = clamp(goal.r * (1 + Math.sign(e.deltaY) * 0.08), 5, 90); lastUser = simT; }, { passive: false });

  // size
  function resize() {
    const w = root.clientWidth, h = root.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h;
    cam.setViewOffset(w, h, 0, -h * (w / h < 1.05 ? 0.13 : 0.15), w, h); // leave the top of the frame to the title and caption
    cam.updateProjectionMatrix();
    if (mode === 'overview' && !sel) Object.assign(goal, OVER());
  }
  new ResizeObserver(resize).observe(root); resize();
  Object.assign(camS, OVER(), { th: -1.1, r: OVER().r * 1.35, ph: 0.9 }); Object.assign(goal, OVER());

  // play only while on screen
  let visible = true, started = false;
  if ('IntersectionObserver' in window && !rec) new IntersectionObserver(es => { visible = es[0].isIntersecting && es[0].intersectionRatio > 0.25; if (visible && !started) { started = true; if (opts.autoplay !== false) setTimeout(() => { if (mode === 'overview' && simT - lastUser > 2) startTour(); }, 4200); } }, { threshold: [0, 0.25, 0.6] }).observe(root);
  else { started = true; }

  const v = new THREE.Vector3();
  function frame(dt) {
    simT += dt;
    // the build: glass rises one by one, then the orange drops in
    CO.forEach((c, i) => {
      const a = clamp((simT - 0.3 - i * 0.22) / 1.3, 0, 1), y = easeOut(a);
      c.glassPivot.scale.set(1, Math.max(0.001, y), 1); c.glassPivot.visible = a > 0;
      const b = clamp((simT - 2.0 - i * 0.18) / 1.1, 0, 1);
      c.core.visible = b > 0; c.core.position.y = c.core.userData.home.y + (1 - bounce(b)) * (c.s + 5);
      c.glow.material.opacity = (0.75 + 0.25 * Math.sin(simT * 2.1 + i)) * b;
      c.lamp.intensity = b * (6 + 2 * Math.sin(simT * 2.1 + i)) * Math.max(1, c.o);
      c.lab.style.opacity = String(clamp((simT - 2.6 - i * 0.18) / 0.6, 0, 1));
    });
    // dust
    const p = dustGeo.attributes.position.array;
    for (let i = 0; i < N; i++) { p[i * 3 + 1] += spd[i] * dt; if (p[i * 3 + 1] > 18) p[i * 3 + 1] = 0; }
    dustGeo.attributes.position.needsUpdate = true;
    // tour and idle orbit
    if (mode === 'tour') { tourT += dt; if (tourT > STEP) nextStep(); goal.th += dt * 0.05; }
    else if (mode === 'overview' && simT - lastUser > 3) goal.th += dt * 0.06;
    const k = 1 - Math.pow(0.0025, dt);
    for (const key of ['th', 'ph', 'r', 'tx', 'ty', 'tz']) camS[key] = lerp(camS[key], goal[key], k);
    cam.position.set(camS.tx + camS.r * Math.sin(camS.ph) * Math.sin(camS.th), camS.ty + camS.r * Math.cos(camS.ph), camS.tz + camS.r * Math.sin(camS.ph) * Math.cos(camS.th));
    cam.lookAt(camS.tx, camS.ty, camS.tz);
    renderer.render(scene, cam);
    // labels over the top of each glass cube
    const w = root.clientWidth, h = root.clientHeight;
    for (const c of CO) {
      v.set(c.x, c.s * c.glassPivot.scale.y + 0.35, c.z).project(cam);
      const off = v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2;
      c.lab.style.display = off ? 'none' : '';
      c.lab.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px,${((1 - v.y) / 2 * h).toFixed(1)}px) translate(-50%,-100%)`;
    }
  }

  let last = performance.now(), raf = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible && started) return;
    frame(dt);
  }
  setTourBtn();
  if (!rec) raf = requestAnimationFrame(loop);

  const api = {
    tour: startTour, overview: () => overview(true), select: id => select(id, true),
    seek(t, step = 1 / 30) { while (simT < t) frame(step); }, // recording: advance the simulation to time t
    hideHud(on) { hud.classList.toggle('off', on); },
    stop() { cancelAnimationFrame(raf); },
  };
  window.WT3D = api;
  return api;
}
