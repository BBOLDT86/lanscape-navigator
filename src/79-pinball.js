/* ===================================================================
   RingHub Pinball: a space table straight out of a 1995 Plus! pack,
   built on the RingHub planet. Flippers, pop bumpers, slingshots, an
   orbit around the hub, drop targets, a kickout hole, missions that
   rank you up from Newbie to Cyber Legend, multiball, tilt, sounds,
   music and a high score table. Canvas physics, no images.
   =================================================================== */
const PB_W = 600, PB_H = 1000, PB_R = 12, PB_G = 1750;
const PB_RANKS = ['Newbie', 'Lurker', 'Surfer', 'Netizen', 'Webmaster', 'Ringmaster', 'Sysop', 'Cyber Legend'];
const PB_MISSIONS = [
  { id: 'ring', name: 'Join the Ring', how: 'Light R-I-N-G in the top lanes', need: 4 },
  { id: 'dial', name: 'Dial Up', how: 'Knock down the 5-6-K targets', need: 3 },
  { id: 'orbit', name: 'Orbit the Hub', how: 'Shoot the left orbit twice', need: 2 },
  { id: 'fetch', name: 'Fetch!', how: 'Sink the HyperHound hole twice', need: 2 },
  { id: 'bump', name: 'Server Load', how: 'Hit the pop bumpers 15 times', need: 15 },
  { id: 'www', name: 'Surf the Web', how: 'Hit all three W-W-W targets', need: 3 },
  { id: 'planet', name: 'Planetfall', how: 'Hit the planet 4 times', need: 4 }
];
const PINBALL_CSS = `body.app-pinball{background:#000 radial-gradient(ellipse at 30% 20%,#1b1440,#05030f 70%);color:#ddd;font:12px Tahoma,Verdana,"DejaVu Sans",sans-serif}
.app-pinball .mb{background:var(--face);color:#000;box-shadow:inset 0 -1px var(--sh)}
.app-pinball .btn{color:#000}
.app-pinball .btn:disabled{color:var(--sh)}
.pb{flex:1;min-height:0;display:flex;justify-content:center;align-items:stretch;gap:0;padding:6px;overflow:hidden}
.pb-tw{position:relative;flex:none;display:flex;align-items:center;justify-content:center;min-width:0}
.pb-cv{display:block;touch-action:none;outline:none;border:3px solid #000;box-shadow:0 0 0 2px #5a5f6e,0 0 0 4px #1a1c22,0 6px 30px rgba(0,0,0,.8);background:#000;cursor:default}
.pb-side{width:248px;flex:none;margin-left:12px;display:flex;flex-direction:column;gap:8px;min-height:0;overflow:auto}
.pb-logo{text-align:center;padding:6px 0 2px}
.pb-logo svg{width:100%;height:auto;max-height:110px}
.pb-led{background:#000;border:2px solid #2b2f3b;box-shadow:inset 0 0 12px rgba(0,0,0,.9),0 0 0 1px #000;padding:8px 10px;border-radius:4px}
.pb-led .lb{font:bold 10px/1 Tahoma,sans-serif;color:#8a8fb0;letter-spacing:2px}
.pb-led .sc{font:bold 30px/1.1 "Courier New",Courier,monospace;color:#ff3b30;text-shadow:0 0 8px rgba(255,59,48,.7);text-align:right;letter-spacing:1px;white-space:nowrap;overflow:hidden}
.pb-row{display:flex;gap:8px}
.pb-row .pb-led{flex:1;text-align:center}
.pb-row .v{font:bold 22px/1.1 "Courier New",monospace;color:#ffd400;text-shadow:0 0 6px rgba(255,212,0,.6)}
.pb-msg{min-height:58px;font:bold 13px/1.35 "Courier New",monospace;color:#3cff7a;text-shadow:0 0 6px rgba(60,255,122,.6);white-space:pre-line;text-transform:uppercase}
.pb-mis{font-size:11px;color:#c9cbe0}
.pb-mis b{color:#7fe3ff}
.pb-bar{height:6px;background:#1a1d2a;border:1px solid #333;margin-top:5px}
.pb-bar i{display:block;height:100%;background:linear-gradient(90deg,#00e5ff,#ff2bd6)}
.pb-rank{font:bold 15px Tahoma,sans-serif;color:#ff66ff;text-shadow:0 0 8px rgba(255,102,255,.6);text-align:center;letter-spacing:1px}
.pb-hs{font:12px/1.5 "Courier New",monospace;color:#bfc4e6}
.pb-hs h4{margin:0 0 4px;font:bold 11px Tahoma,sans-serif;letter-spacing:2px;color:#8a8fb0}
.pb-hs ol{margin:0;padding-left:22px}
.pb-hs li span{float:right}
.pb-hs li.me{color:#ffd400}
.pb-keys{font-size:10.5px;color:#8a8fb0;line-height:1.5}
.pb-keys kbd{display:inline-block;min-width:16px;padding:0 3px;border:1px solid #555;border-radius:2px;background:#222;color:#ddd;font:10px Tahoma,sans-serif;text-align:center}
.pb-btns{display:flex;gap:6px;flex-wrap:wrap}
.pb-btns button{flex:1;min-width:0}
.pb-name{display:flex;gap:6px;align-items:center}
.pb-name input{width:70px;font:bold 22px "Courier New",monospace;text-transform:uppercase;background:#000;color:#ffd400;border:2px solid #444;text-align:center;letter-spacing:4px}
.pb-touch{display:none;position:absolute;left:0;right:0;bottom:0;height:34%;pointer-events:none}
.pb-touch i{position:absolute;bottom:8px;width:72px;height:72px;border-radius:50%;border:2px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);pointer-events:none}
.pb-touch i.l{left:10px}.pb-touch i.r{right:10px}
@media (pointer:coarse){.pb-touch{display:block}}
@media (max-width:720px){.pb{flex-direction:column;align-items:center;justify-content:flex-start;overflow:auto;padding:4px}.pb-side{width:min(100%,520px);margin:6px 0 0;flex-direction:row;flex-wrap:wrap;overflow:visible}.pb-side>*{flex:1 1 45%}.pb-logo,.pb-keys,.pb-hs{display:none}}`;
const PB_LOGO = '<svg viewBox="0 0 240 104" aria-label="RingHub Pinball"><defs><radialGradient id="pbpl" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ffd27a"/><stop offset=".55" stop-color="#e8862a"/><stop offset="1" stop-color="#7a2e08"/></radialGradient><linearGradient id="pbtx" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff9a8"/><stop offset=".5" stop-color="#ffd400"/><stop offset="1" stop-color="#ff8a00"/></linearGradient></defs><ellipse cx="44" cy="44" rx="40" ry="11" fill="none" stroke="#3cff7a" stroke-width="3" transform="rotate(-18 44 44)" opacity=".55"/><circle cx="44" cy="44" r="25" fill="url(#pbpl)"/><path d="M5.5 52.5A40 11-18 0 0 82.5 35.5" fill="none" stroke="#3cff7a" stroke-width="3.2" transform="rotate(0)"/><circle cx="80" cy="30" r="3" fill="#ff66ff"/><text x="80" y="52" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="30" fill="url(#pbtx)" stroke="#5a2a00" stroke-width="1">RingHub</text><text x="122" y="92" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="25" letter-spacing="5" fill="#7fe3ff" stroke="#002a40" stroke-width="1" font-style="italic">PINBALL</text></svg>';
/* ---------- the table ---------- */
function pbBuildTable() {
  const T = { walls: [], posts: [], bumpers: [], slings: [], drops: [], stands: [], sensors: [], rails: [] };
  const seg = (ax, ay, bx, by, o) => { const s = Object.assign({ ax, ay, bx, by, e: 0.42, kind: 'wall' }, o || {}); T.walls.push(s); return s; };
  const poly = (pts, o, rail) => { for (let i = 0; i < pts.length - 1; i++) seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], o); if (rail !== false) T.rails.push(pts); };
  const arcPts = (cx, cy, r, a0, a1, n) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; };
  // outline: left wall, the dome, the shooter lane
  T.dome = { cx: 300, cy: 300, r: 280 };
  poly([[20, 1040], [20, 300]]);
  poly(arcPts(300, 300, 280, Math.PI, Math.PI * 2, 64));
  poly([[580, 300], [580, 1040]]);
  poly([[545, 1040], [545, 312]]);
  T.posts.push({ x: 545, y: 306, r: 6, e: 0.4 });
  // one-way gates (solid only for a ball above them)
  // (tilted, so a ball that lands on one rolls off into the playfield)
  const gate = (ax, ay, bx, by, up) => { const L = Math.hypot(bx - ax, by - ay); let nx = -(by - ay) / L, ny = (bx - ax) / L; if (ny > 0) { nx = -nx; ny = -ny; } return seg(ax, ay, bx, by, { kind: 'gate', front: [nx, ny], e: 0.3 }); };
  gate(547, 298, 580, 282);
  gate(22, 246, 64, 258);
  // left orbit channel
  poly([[66, 444], [66, 270]]);
  T.posts.push({ x: 66, y: 266, r: 5, e: 0.4 }, { x: 66, y: 448, r: 6, e: 0.5 });
  // top lanes R I N G
  T.laneX = [286, 334, 382, 430];
  for (const x of [262, 310, 358, 406, 454]) { poly([[x, 116], [x, 160]]); T.posts.push({ x, y: 112, r: 5, e: 0.5 }, { x, y: 164, r: 6, e: 0.55 }); }
  T.laneX.forEach((x, i) => T.sensors.push({ kind: 'lane', i, x, y: 140, r: 12 }));
  // pop bumpers
  T.bumpers.push({ x: 236, y: 252, r: 25, c: '#ff2bd6', lit: 0 }, { x: 348, y: 246, r: 25, c: '#00e5ff', lit: 0 }, { x: 292, y: 330, r: 25, c: '#ffd400', lit: 0 });
  // the planet
  T.planet = { x: 282, y: 520, r: 34, lit: 0 };
  // drop targets 5 6 K (left) with a backstop
  T.drops = [{ ax: 104, ay: 476, bx: 104, by: 502, ch: '5' }, { ax: 104, ay: 510, bx: 104, by: 536, ch: '6' }, { ax: 104, ay: 544, bx: 104, by: 570, ch: 'K' }].map(d => seg(d.ax, d.ay, d.bx, d.by, { kind: 'drop', front: [1, 0], e: 0.35, ch: d.ch, up: true, lit: 0 }));
  poly([[104, 470], [90, 466], [90, 580], [104, 576]]);
  // stand-up targets W W W (right)
  T.stands = [450, 484, 518].map((y, i) => seg(531, y, 531, y + 26, { kind: 'stand', front: [-1, 0], e: 0.4, i, lit: 0 }));
  // kickout hole
  T.hole = { x: 455, y: 346, r: 14 };
  // orbit sensors
  T.sensors.push({ kind: 'orbitIn', x: 43, y: 330, r: 18 }, { kind: 'orbitTop', x: 520, y: 150, r: 34 });
  // inlanes, outlanes, slingshots
  // the inlane guides end just above the flipper's top surface, so a slow ball rolls onto the flipper
  const L = [[52, 650], [52, 828], [172, 889]];
  poly(L); poly(L.map(([x, y]) => [564 - x, y]));
  T.posts.push({ x: 52, y: 646, r: 6, e: 0.55 }, { x: 512, y: 646, r: 6, e: 0.55 });
  const sl = [[100, 692], [100, 806], [162, 846]];
  for (const side of [0, 1]) {
    const P = sl.map(([x, y]) => (side ? [564 - x, y] : [x, y]));
    seg(P[0][0], P[0][1], P[1][0], P[1][1], { e: 0.6 });
    seg(P[1][0], P[1][1], P[2][0], P[2][1], { e: 0.6 });
    const face = seg(P[0][0], P[0][1], P[2][0], P[2][1], { kind: 'sling', e: 0.6, side });
    T.slings.push({ pts: P, face, lit: 0 });
    for (const p of P) T.posts.push({ x: p[0], y: p[1], r: 5, e: 0.6 });
  }
  T.sensors.push({ kind: 'outlane', x: 36, y: 760, r: 12 }, { kind: 'inlane', x: 76, y: 760, r: 12 }, { kind: 'inlane', x: 488, y: 760, r: 12 }, { kind: 'outlane', x: 528, y: 760, r: 12 });
  // flippers
  T.flippers = [
    { px: 176, py: 906, len: 90, rest: 0.52, up: -0.46, a: 0.52, w: 0, key: false, side: 0 },
    { px: 388, py: 906, len: 90, rest: Math.PI - 0.52, up: Math.PI + 0.46, a: Math.PI - 0.52, w: 0, key: false, side: 1 }
  ];
  T.plunger = { x: 562.5, y: 972, pull: 0 };
  return T;
}
async function mountPinball(ctx) {
  const { h, doc, win } = ctx;
  const T = pbBuildTable();
  const saved = (await ctx.kv.get('pinball:prefs')) || {};
  const prefs = Object.assign({ sound: true, music: true, name: (S.prefs.author || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'YOU' }, saved);
  let scores = (await ctx.kv.get('pinball:scores')) || [{ n: 'LAN', s: 1500000, t: 0 }, { n: 'WWW', s: 1000000, t: 0 }, { n: 'BBS', s: 750000, t: 0 }, { n: 'ISP', s: 500000, t: 0 }, { n: 'URL', s: 250000, t: 0 }];
  const saveP = () => ctx.kv.set('pinball:prefs', prefs);
  /* ---------- DOM ---------- */
  const cv = h('canvas', { class: 'pb-cv', tabindex: '0', 'aria-label': 'Pinball table. Z and slash flip, Space launches.' });
  const touchHints = h('div', { class: 'pb-touch' }, h('i', { class: 'l' }), h('i', { class: 'r' }));
  const scoreEl = h('div', { class: 'sc', text: '0' });
  const ballEl = h('div', { class: 'v', text: '-' }), playerEl = h('div', { class: 'v', text: '1' });
  const msgEl = h('div', { class: 'pb-msg' });
  const rankEl = h('div', { class: 'pb-rank' });
  const misName = h('b'), misHow = h('div'), misBar = h('i');
  const hsBox = h('div', { class: 'pb-hs' });
  const newBtn = h('button', { class: 'btn', type: 'button', text: 'New Game (F2)', onclick: () => newGame() });
  const launchBtn = h('button', { class: 'btn', type: 'button', text: 'Launch', onclick: () => { autoLaunch(); cv.focus(); } });
  const side = h('div', { class: 'pb-side' },
    h('div', { class: 'pb-logo', html: PB_LOGO }),
    h('div', { class: 'pb-led' }, h('div', { class: 'lb', text: 'SCORE' }), scoreEl),
    h('div', { class: 'pb-row' }, h('div', { class: 'pb-led' }, h('div', { class: 'lb', text: 'BALL' }), ballEl), h('div', { class: 'pb-led' }, h('div', { class: 'lb', text: 'PLAYER' }), playerEl)),
    h('div', { class: 'pb-led' }, rankEl),
    h('div', { class: 'pb-led pb-msg-w' }, msgEl),
    h('div', { class: 'pb-led pb-mis' }, h('div', { class: 'lb', text: 'MISSION' }), h('div', { style: { marginTop: '4px' } }, misName), misHow, h('div', { class: 'pb-bar' }, misBar)),
    h('div', { class: 'pb-btns' }, newBtn, launchBtn),
    h('div', { class: 'pb-led' }, hsBox),
    h('div', { class: 'pb-keys', html: '<kbd>Z</kbd> left flipper &nbsp; <kbd>/</kbd> right flipper<br>Shift keys and ← → work too<br><kbd>Space</kbd> hold &amp; release to launch<br><kbd>X</kbd> <kbd>.</kbd> <kbd>↑</kbd> nudge (careful: tilt!)<br><kbd>F2</kbd> new game &nbsp; <kbd>P</kbd> pause &nbsp; <kbd>M</kbd> music' }));
  const tw = h('div', { class: 'pb-tw' }, cv, touchHints);
  const wrap = h('div', { class: 'pb' }, tw, side);
  const menus = appMenubar(ctx, [
    { label: 'Game', items: () => [{ label: 'New Game', key: 'F2', act: newGame }, { label: 'Launch Ball', key: 'Space', act: autoLaunch, disabled: () => !waitingLaunch() }, { label: paused ? 'Resume' : 'Pause', key: 'P', act: togglePause }, { sep: 1 }, { label: 'High Scores...', act: showScores }, { label: 'Demo Mode', act: () => { endGame(true); attract(); } }, { sep: 1 }, { label: 'Exit', act: () => back() }] },
    { label: 'Options', items: () => [{ label: 'Sound Effects', check: () => prefs.sound, act: () => { prefs.sound = !prefs.sound; saveP(); } }, { label: 'Music', key: 'M', check: () => prefs.music, act: toggleMusic }, { sep: 1 }, { label: 'Full Screen', key: 'F4', act: fullscreen }, { label: 'Your Initials...', act: askName }] },
    { label: 'Help', items: () => [{ label: 'How to Play', act: help }, { label: 'About RingHub Pinball', act: () => ctx.msg('info', 'About RingHub Pinball', '<p><b>RingHub Pinball</b> ' + esc(VERSION) + '</p><p>A space table for the LANscape web: orbit the RingHub planet, dial up the 56K targets and fetch with HyperHound.</p><p>Everything here, from the physics to the music, is drawn and synthesized live in your browser.</p>') }] }
  ]);
  ctx.root.append(menus.el, wrap);
  /* ---------- sound ---------- */
  let ac = null, master = null, musicGain = null;
  const audio = () => {
    if (!ac) {
      const AC = win.AudioContext || win.webkitAudioContext; if (!AC) return null;
      ac = new AC(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination); musicGain = ac.createGain(); musicGain.gain.value = 0.18; musicGain.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  };
  ctx.cleanup(() => { try { if (ac) ac.close(); } catch (e) { /* closed */ } });
  let noiseBuf = null;
  const quiet = () => !prefs.sound || G.mode !== 'play' || !audio();
  function tone(f, dur, type, vol, f2, delay) {
    if (quiet()) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function hiss(dur, vol, freq, type, delay) {
    if (quiet()) return;
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 2000;
    const g = ac.createGain(); g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }
  const SFX = {
    flip: () => { hiss(0.05, 0.25, 1800, 'highpass'); tone(90, 0.06, 'square', 0.12, 50); },
    bump: i => { tone([520, 660, 780][i % 3], 0.16, 'square', 0.18, [260, 330, 390][i % 3]); hiss(0.05, 0.15, 3000); },
    sling: () => { tone(180, 0.09, 'sawtooth', 0.18, 90); hiss(0.06, 0.2, 1200); },
    lane: i => tone(880 + i * 110, 0.12, 'triangle', 0.18),
    drop: () => { tone(140, 0.12, 'square', 0.2, 70); hiss(0.08, 0.18, 800, 'lowpass'); },
    stand: () => tone(1046, 0.08, 'square', 0.12),
    hole: () => { tone(600, 0.5, 'sine', 0.25, 120); },
    kick: () => { hiss(0.12, 0.3, 600, 'lowpass'); tone(110, 0.15, 'square', 0.18, 220); },
    launch: p => { hiss(0.25, 0.25 * p + 0.05, 700, 'lowpass'); tone(80, 0.2, 'triangle', 0.2, 260); },
    planet: () => tone(330, 0.25, 'sine', 0.22, 660),
    orbit: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.12, 0, i * 0.07)); },
    drain: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.28, 'triangle', 0.2, f * 0.97, i * 0.22)); },
    complete: () => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.14, 'square', 0.13, 0, i * 0.09)); },
    extra: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.2, 'triangle', 0.2, 0, i * 0.12)); },
    tilt: () => { tone(60, 0.8, 'sawtooth', 0.25, 50); },
    warn: () => tone(150, 0.25, 'square', 0.2),
    skill: () => { [659, 880, 1318].forEach((f, i) => tone(f, 0.18, 'square', 0.15, 0, i * 0.08)); },
    multi: () => { for (let i = 0; i < 10; i++) tone(400 + i * 120, 0.09, 'square', 0.12, 0, i * 0.05); }
  };
  /* ---------- music: a little original space groove, played live ---------- */
  let musicT = null, beat = 0, nextAt = 0;
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function note(m, t, dur, type, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = mtof(m);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + dur + 0.05);
  }
  function startMusic() {
    if (musicT || !prefs.music || !audio()) return;
    nextAt = ac.currentTime + 0.05;
    const spb = 60 / 116 / 4;
    musicT = setInterval(() => {
      if (!ac) return;
      while (nextAt < ac.currentTime + 0.12) {
        const ch = CHORDS[Math.floor(beat / 16) % 4], s = beat % 16;
        if (s % 4 === 0) note(ch[0] - 24, nextAt, spb * 3.5, 'triangle', 0.5);
        if (s === 10) note(ch[0] - 12, nextAt, spb * 1.5, 'triangle', 0.35);
        note(ch[[0, 1, 2, 1][s % 4]] + (s >= 8 ? 12 : 0), nextAt, spb * 0.9, 'square', 0.07);
        if (s % 2 === 1 && noiseBuf) { const src = ac.createBufferSource(); src.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ac.createGain(); g.gain.setValueAtTime(0.06, nextAt); g.gain.exponentialRampToValueAtTime(0.001, nextAt + 0.04); src.connect(f); f.connect(g); g.connect(musicGain); src.start(nextAt); src.stop(nextAt + 0.05); }
        if (s === 4 || s === 12) { const src = ac.createBufferSource(); if (noiseBuf) { src.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g = ac.createGain(); g.gain.setValueAtTime(0.12, nextAt); g.gain.exponentialRampToValueAtTime(0.001, nextAt + 0.12); src.connect(f); f.connect(g); g.connect(musicGain); src.start(nextAt); src.stop(nextAt + 0.15); } }
        nextAt += spb; beat++;
      }
    }, 30);
  }
  function stopMusic() { clearInterval(musicT); musicT = null; }
  ctx.cleanup(stopMusic);
  function toggleMusic() { prefs.music = !prefs.music; saveP(); if (prefs.music && G.mode === 'play') startMusic(); else stopMusic(); }
  /* ---------- game state ---------- */
  const G = { t: 0, mode: 'attract', score: 0, ball: 0, balls: [], extraBalls: 0, rank: 0, mission: 0, prog: 0, set: new Set(), mult: 1, bonus: 0, tilt: 0, tilted: false, warned: 0, saveUntil: 0, skillLane: -1, skillOpen: false, lanes: [0, 0, 0, 0], www: [0, 0, 0], orbitArm: 0, lockLit: false, holeCount: 0, demo: false, over: false, msgs: [], bigMsg: '', bigUntil: 0 };
  let paused = false;
  function say(text, ms) { G.msgs.push({ text, until: 0, ms: ms || 2400 }); }
  function big(text, ms) { G.bigMsg = text; G.bigUntil = performance.now() + (ms || 1800); }
  function add(pts) { if (G.mode !== 'play' || G.tilted) return; G.score += pts; }
  const mission = () => PB_MISSIONS[G.mission % PB_MISSIONS.length];
  function progress(kind, key) {
    if (G.mode !== 'play' || G.tilted) return;
    const m = mission();
    if (m.id !== kind) return;
    if (key != null) { if (G.set.has(key)) return; G.set.add(key); G.prog = G.set.size; } else G.prog++;
    if (G.prog >= m.need) {
      const pts = 25000 * (G.rank + 1);
      add(pts);
      G.rank = Math.min(PB_RANKS.length - 1, G.rank + 1);
      SFX.complete();
      big('MISSION COMPLETE', 2200);
      say('Mission complete: ' + m.name + '\n+' + pts.toLocaleString() + '\nPromoted to ' + PB_RANKS[G.rank] + '!', 3800);
      if (G.rank === 3 || G.rank === 6) { G.extraBalls++; SFX.extra(); say('Extra ball!', 2600); }
      G.mission++; G.prog = 0; G.set = new Set();
      say('New mission: ' + mission().name + '\n' + mission().how, 3500);
    }
  }
  function newBall(first) {
    const b = { x: T.plunger.x, y: T.plunger.y - PB_R - 1, vx: 0, vy: 0, held: 0, lane: true, id: Math.random(), inside: new Set() };
    G.balls.push(b);
    G.skillLane = Math.floor(Math.random() * 4);
    G.skillOpen = true;
    if (first) say('Ball ' + G.ball + (G.ball === 3 ? ' — last ball!' : '') + '\nMission: ' + mission().name, 3000);
    return b;
  }
  function newGame() {
    audio();
    Object.assign(G, { mode: 'play', score: 0, ball: 1, balls: [], extraBalls: 0, rank: 0, mission: 0, prog: 0, set: new Set(), mult: 1, bonus: 0, tilt: 0, tilted: false, warned: 0, saveUntil: 0, lanes: [0, 0, 0, 0], www: [0, 0, 0], orbitArm: 0, lockLit: false, holeCount: 0, demo: false, over: false, msgs: [], msgReset: true, spawnAt: 0, dropResetAt: 0 });
    for (const d of T.drops) d.up = true;
    newBall(true);
    say('Welcome, ' + PB_RANKS[0] + '!\nMission: ' + mission().name + '\n' + mission().how, 4200);
    if (prefs.music) startMusic();
    paused = false;
    cv.focus();
  }
  function endGame(silent) {
    G.mode = 'over'; G.balls = []; stopMusic();
    if (silent) return;
    big('GAME OVER', 3000);
    say('Game over\nFinal score ' + G.score.toLocaleString(), 6000);
    const pos = scores.findIndex(x => G.score > x.s);
    if (G.score > 0 && (pos >= 0 || scores.length < 5)) askInitials(pos < 0 ? scores.length : pos);
    renderScores();
  }
  function attract() {
    Object.assign(G, { mode: 'attract', balls: [], msgs: [], msgReset: true, tilted: false, demo: true });
    newBall(false);
    say('RingHub Pinball\nPress F2 to play', 100000);
  }
  function drainBall(b) {
    G.balls = G.balls.filter(x => x !== b);
    if (G.mode === 'attract') { if (!G.balls.length) newBall(false); return; }
    if (G.mode !== 'play') return;
    if (G.t < G.saveUntil && !G.tilted) { say('Ball saved!', 1800); big('BALL SAVED', 1200); newBall(false); G.skillOpen = false; launchSoon(); return; }
    if (G.balls.length) return; // multiball continues
    SFX.drain();
    const bonus = G.tilted ? 0 : G.bonus * 500 * G.mult;
    if (bonus) { add(bonus); say('Bonus ' + G.bonus + ' × 500 × ' + G.mult + '\n= ' + bonus.toLocaleString(), 3000); }
    G.bonus = 0; G.mult = 1; G.tilted = false; G.tilt = 0; G.warned = 0;
    G.lanes = [0, 0, 0, 0];
    if (G.extraBalls > 0) { G.extraBalls--; say('Shoot again!', 2400); big('SHOOT AGAIN', 1600); newBall(false); return; }
    if (G.ball >= 3) { endGame(); return; }
    G.ball++;
    newBall(true);
  }
  let autoT = null;
  function launchSoon() { clearTimeout(autoT); autoT = setTimeout(() => { if (ctx.alive()) { const b = G.balls.find(x => x.lane); if (b) { T.plunger.pull = 0.75; releasePlunger(); } } }, 900); }
  ctx.cleanup(() => clearTimeout(autoT));
  const waitingLaunch = () => G.balls.some(b => b.lane && b.y > T.plunger.y - 40);
  function autoLaunch() { if (G.mode !== 'play') { newGame(); return; } if (waitingLaunch()) { T.plunger.pull = 0.82; releasePlunger(); } }
  /* ---------- input ---------- */
  let plungerHeld = false;
  function releasePlunger() {
    const p = T.plunger.pull;
    plungerHeld = false;
    // full power just clears the top of the dome and drops into the lanes; a soft one falls back
    for (const b of G.balls) if (b.lane && b.y > T.plunger.y - 30 && Math.abs(b.x - T.plunger.x) < 20) { b.vy = -(1380 + p * 520); b.vx = 0; SFX.launch(p); }
    T.plunger.pull = 0;
    if (G.mode === 'play') G.saveUntil = Math.max(G.saveUntil, G.t + 9);
  }
  const flip = (i, on) => {
    const f = T.flippers[i];
    if (G.tilted && on) return;
    if (f.key !== on && on) SFX.flip();
    f.key = on;
    // lane change: the flippers slide the lit lanes left and right
    if (on && G.mode === 'play') { const L = G.lanes; G.lanes = i === 0 ? [L[1], L[2], L[3], L[0]] : [L[3], L[0], L[1], L[2]]; }
  };
  function nudge(dx, dy) {
    if (G.mode !== 'play' || G.tilted) return;
    for (const b of G.balls) if (!b.held && !b.lane) { b.vx += dx; b.vy += dy; }
    shake = 6;
    G.tilt += 1;
    if (G.tilt > 2.6 && G.warned < 2) { G.warned++; SFX.warn(); big('DANGER', 900); say('Danger! Careful with that nudge.', 1500); }
    if (G.tilt > 4) { G.tilted = true; SFX.tilt(); big('TILT', 4000); say('TILT\nFlippers are dead until the ball drains.', 4000); for (const f of T.flippers) f.key = false; }
  }
  let shake = 0;
  ctx.on(doc, 'keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key, code = e.code;
    if (k === 'F2') { e.preventDefault(); newGame(); return; }
    if (k === 'F3' || k === 'p' || k === 'P') { e.preventDefault(); togglePause(); return; }
    if (k === 'F4') { e.preventDefault(); fullscreen(); return; }
    if (k === 'm' || k === 'M') { e.preventDefault(); toggleMusic(); return; }
    if (paused) return;
    if (G.mode !== 'play' && (k === ' ' || k === 'Enter')) { e.preventDefault(); newGame(); return; }
    if (k === 'z' || k === 'Z' || code === 'ShiftLeft' || k === 'ArrowLeft') { e.preventDefault(); flip(0, true); return; }
    if (k === '/' || k === '?' || code === 'ShiftRight' || k === 'ArrowRight') { e.preventDefault(); flip(1, true); return; }
    if (k === ' ' || k === 'ArrowDown' || k === 'Enter') { e.preventDefault(); if (!e.repeat) plungerHeld = true; return; }
    if (e.repeat) return;
    if (k === 'x' || k === 'X') { e.preventDefault(); nudge(160, -60); return; }
    if (k === '.' || k === '>') { e.preventDefault(); nudge(-160, -60); return; }
    if (k === 'ArrowUp') { e.preventDefault(); nudge(0, -220); }
  });
  ctx.on(doc, 'keyup', e => {
    const k = e.key, code = e.code;
    if (k === 'z' || k === 'Z' || code === 'ShiftLeft' || k === 'ArrowLeft') flip(0, false);
    if (k === '/' || k === '?' || code === 'ShiftRight' || k === 'ArrowRight') flip(1, false);
    if ((k === ' ' || k === 'ArrowDown' || k === 'Enter') && plungerHeld) releasePlunger();
  });
  // touch / mouse: left and right halves flip, the shooter lane launches
  const pointers = new Map();
  cv.addEventListener('pointerdown', e => {
    cv.focus();
    audio();
    if (G.mode !== 'play' && e.pointerType !== 'mouse') { newGame(); return; }
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * PB_W, y = (e.clientY - r.top) / r.height * PB_H;
    let what;
    if (x > 540 && y > 600) what = 'plunger';
    else if (e.pointerType === 'mouse' && e.button === 0) what = x < 282 ? 'L' : 'R';
    else if (e.pointerType !== 'mouse') what = x < 282 ? 'L' : 'R';
    if (!what) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
    pointers.set(e.pointerId, what);
    if (what === 'plunger') plungerHeld = true; else flip(what === 'L' ? 0 : 1, true);
  });
  const lift = e => { const what = pointers.get(e.pointerId); if (!what) return; pointers.delete(e.pointerId); if (what === 'plunger') releasePlunger(); else if (![...pointers.values()].includes(what)) flip(what === 'L' ? 0 : 1, false); };
  cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  function togglePause() { paused = !paused; if (paused) { stopMusic(); big('PAUSED', 1e9); } else { G.bigUntil = 0; if (G.mode === 'play' && prefs.music) startMusic(); } }
  ctx.on(win, 'blur', () => { if (G.mode === 'play' && !paused) togglePause(); for (const f of T.flippers) f.key = false; });
  ctx.on(doc, 'visibilitychange', () => { if (doc.hidden && G.mode === 'play' && !paused) togglePause(); });
  function fullscreen() { try { if (doc.fullscreenElement) doc.exitFullscreen(); else wrap.requestFullscreen(); } catch (e) { /* not allowed */ } }
  /* ---------- physics ---------- */
  function hitSeg(b, s, R) {
    if (s.kind === 'drop' && !s.up) return 0;
    const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy;
    let t = ((b.x - s.ax) * dx + (b.y - s.ay) * dy) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = s.ax + dx * t, cy = s.ay + dy * t;
    let nx = b.x - cx, ny = b.y - cy;
    const d2 = nx * nx + ny * ny;
    if (d2 >= R * R) return 0;
    if (s.front && ((b.x - s.ax) * s.front[0] + (b.y - s.ay) * s.front[1]) < 0) return 0;
    const d = Math.sqrt(d2) || 1e-4;
    nx /= d; ny /= d;
    if (s.front && nx * s.front[0] + ny * s.front[1] < 0.2) { nx = s.front[0]; ny = s.front[1]; }
    b.x = cx + nx * R; b.y = cy + ny * R;
    return bounce(b, nx, ny, s.e, 0, 0);
  }
  function hitCircle(b, c, R, e) {
    const nx0 = b.x - c.x, ny0 = b.y - c.y, d2 = nx0 * nx0 + ny0 * ny0, rr = R + c.r;
    if (d2 >= rr * rr) return 0;
    const d = Math.sqrt(d2) || 1e-4, nx = nx0 / d, ny = ny0 / d;
    b.x = c.x + nx * rr; b.y = c.y + ny * rr;
    return bounce(b, nx, ny, e, 0, 0) || 1e-3;
  }
  function bounce(b, nx, ny, e, svx, svy) {
    const rvx = b.vx - svx, rvy = b.vy - svy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return 1e-3;
    const ee = -vn < 40 ? 0 : e;
    const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
    // friction only on real impacts, so a rolling ball keeps rolling
    const nvn = -vn * ee, nvt = -vn > 60 ? vt * 0.97 : vt;
    b.vx = svx + nx * nvn + tx * nvt; b.vy = svy + ny * nvn + ty * nvt;
    return -vn;
  }
  function flipperHit(b, f) {
    const tipx = f.px + Math.cos(f.a) * f.len, tipy = f.py + Math.sin(f.a) * f.len;
    const dx = tipx - f.px, dy = tipy - f.py, L2 = dx * dx + dy * dy;
    let t = ((b.x - f.px) * dx + (b.y - f.py) * dy) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const rad = 11 - 4.5 * t;
    const cx = f.px + dx * t, cy = f.py + dy * t;
    let nx = b.x - cx, ny = b.y - cy;
    const d2 = nx * nx + ny * ny, rr = PB_R + rad;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 1e-4;
    nx /= d; ny /= d;
    b.x = cx + nx * rr; b.y = cy + ny * rr;
    // surface velocity of the flipper at the contact point
    const rx = cx - f.px, ry = cy - f.py;
    const svx = -f.w * ry, svy = f.w * rx;
    bounce(b, nx, ny, 0.32, svx, svy);
  }
  function step(dt) {
    G.t += dt;
    // flippers
    for (const f of T.flippers) {
      const target = f.key && !G.tilted ? f.up : f.rest;
      const delta = target - f.a, maxd = (f.key ? 24 : 14) * dt;
      if (Math.abs(delta) <= maxd) { f.w = delta / dt; f.a = target; } else { f.w = Math.sign(delta) * (f.key ? 24 : 14); f.a += Math.sign(delta) * maxd; }
      if (f.a === target && Math.abs(delta) < 1e-6) f.w = 0;
    }
    if (plungerHeld) T.plunger.pull = Math.min(1, T.plunger.pull + dt * 1.1);
    for (const b of G.balls) {
      if (b.held) continue;
      b.vy += PB_G * dt;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 3300) { b.vx *= 3300 / sp; b.vy *= 3300 / sp; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      // the plunger is the floor of the shooter lane
      if (b.x > 545 && b.y > T.plunger.y + T.plunger.pull * 34 - PB_R) { b.y = T.plunger.y + T.plunger.pull * 34 - PB_R; if (b.vy > 0) b.vy = -b.vy * 0.15; if (Math.abs(b.vy) < 30) b.vy = 0; b.vx = 0; }
      if (b.y < 300 || b.x < 545) b.lane = b.x > 545 && b.y > 300;
      for (const f of T.flippers) flipperHit(b, f);
      for (const s of T.walls) {
        const imp = hitSeg(b, s, PB_R);
        if (!imp) continue;
        if (s.kind === 'sling' && imp > 140) { const n = slingNormal(s); b.vx += n[0] * 620; b.vy += n[1] * 620; const sl = T.slings[s.side]; sl.lit = 1; SFX.sling(); add(110); G.bonus++; }
        else if (s.kind === 'drop' && s.up && imp > 60) { s.up = false; s.lit = 1; SFX.drop(); add(750); G.bonus++; progress('dial', s.ch); if (T.drops.every(d => !d.up)) { add(15000); say('56K connected!\n+15,000', 2200); big('56K CONNECT', 1400); G.dropResetAt = G.t + 2.5; } }
        else if (s.kind === 'stand' && imp > 60) { s.lit = 1; SFX.stand(); add(500); G.www[s.i] = 1; progress('www', s.i); if (G.www.every(Boolean)) { add(10000); say('W-W-W complete\n+10,000', 2000); G.www = [0, 0, 0]; G.mult = Math.min(5, G.mult + 1); say('Bonus multiplier ' + G.mult + '×', 1800); } }
      }
      for (const p of T.posts) hitCircle(b, p, PB_R, p.e);
      for (const bm of T.bumpers) {
        const imp = hitCircle(b, bm, PB_R, 0.5);
        if (imp) {
          const nx = b.x - bm.x, ny = b.y - bm.y, d = Math.hypot(nx, ny) || 1;
          const kick = 1050;
          b.vx = (nx / d) * kick + b.vx * 0.15; b.vy = (ny / d) * kick + b.vy * 0.15;
          if (!bm.cool || G.t > bm.cool) { bm.lit = 1; bm.cool = G.t + 0.06; SFX.bump(T.bumpers.indexOf(bm)); add(1000); G.bonus++; progress('bump'); }
        }
      }
      const pi = hitCircle(b, T.planet, PB_R, 0.62);
      if (pi > 80) { T.planet.lit = 1; SFX.planet(); add(2500); progress('planet'); }
      // sensors
      for (const s of T.sensors) {
        const inside = Math.hypot(b.x - s.x, b.y - s.y) < s.r;
        const was = b.inside.has(s);
        if (inside && !was) { b.inside.add(s); sensor(b, s); }
        else if (!inside && was) b.inside.delete(s);
      }
      // the kickout hole
      const hd = Math.hypot(b.x - T.hole.x, b.y - T.hole.y);
      if (hd < T.hole.r && Math.hypot(b.vx, b.vy) < 1100 && !b.ejectedAt) capture(b);
      if (b.ejectedAt && G.t - b.ejectedAt > 0.6) b.ejectedAt = 0;
    }
    // balls bump into each other in multiball
    for (let i = 0; i < G.balls.length; i++) for (let j = i + 1; j < G.balls.length; j++) {
      const a = G.balls[i], c = G.balls[j];
      if (a.held || c.held) continue;
      const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
      if (d >= PB_R * 2 || d === 0) continue;
      const nx = dx / d, ny = dy / d, ov = (PB_R * 2 - d) / 2;
      a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
      const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (rv < 0) { const j2 = -rv * 0.95; a.vx -= nx * j2; a.vy -= ny * j2; c.vx += nx * j2; c.vy += ny * j2; }
    }
    for (const b of G.balls.slice()) if (b.y > PB_H + 40 || b.x < -40 || b.x > PB_W + 40) drainBall(b);
  }
  const slingNormal = s => { const dx = s.bx - s.ax, dy = s.by - s.ay, L = Math.hypot(dx, dy); let nx = -dy / L, ny = dx / L; if ((282 - s.ax) * nx + (700 - s.ay) * ny < 0) { nx = -nx; ny = -ny; } return [nx, ny]; };
  function sensor(b, s) {
    if (s.kind === 'lane') {
      SFX.lane(s.i); add(500);
      if (G.skillOpen && G.mode === 'play') { if (s.i === G.skillLane) { add(25000); SFX.skill(); big('SKILL SHOT', 1600); say('Skill shot!\n+25,000', 2400); } G.skillOpen = false; }
      if (!G.lanes[s.i]) { G.lanes[s.i] = 1; progress('ring', s.i); }
      if (G.lanes.every(Boolean)) { add(10000); G.mult = Math.min(5, G.mult + 1); say('R-I-N-G complete\nBonus ' + G.mult + '×', 2200); big('RING!', 1000); G.lanes = [0, 0, 0, 0]; }
    } else if (s.kind === 'orbitIn' && b.vy < 0) { G.orbitArm = G.t; }
    else if (s.kind === 'orbitTop' && b.vx > 0 && G.orbitArm && G.t - G.orbitArm < 2.5) { G.orbitArm = 0; SFX.orbit(); add(5000); progress('orbit'); say('Orbit!\n+5,000', 1600); }
    else if (s.kind === 'inlane') { add(250); SFX.lane(1); }
    else if (s.kind === 'outlane') { add(1000); if (G.t >= G.saveUntil && G.mode === 'play') say('Outlane... ouch.', 1500); }
    if (G.skillOpen && s.kind !== 'lane' && s.kind !== 'orbitTop' && b.y > 200) G.skillOpen = false;
  }
  function capture(b) {
    b.held = G.t + 1.5; b.x = T.hole.x; b.y = T.hole.y; b.vx = 0; b.vy = 0;
    SFX.hole(); add(7500); G.holeCount++; G.bonus += 2;
    progress('fetch');
    say('HyperHound fetched it!\n+7,500', 1800);
    if (G.mode === 'play' && G.holeCount % 3 === 0 && G.balls.length === 1) { // multiball
      big('MULTIBALL!', 2500); SFX.multi(); say('Multiball!\nEvery hit counts.', 3000);
      G.spawnAt = G.t + 0.9;
    }
  }
  function releaseHeld() {
    const now = G.t;
    if (G.spawnAt && now > G.spawnAt) {
      G.spawnAt = 0;
      if (G.mode === 'play') { for (let k = 0; k < 2; k++) G.balls.push({ x: T.hole.x - 22 - k * 26, y: T.hole.y + 14, vx: -380 - k * 120, vy: 260 + k * 60, held: 0, lane: false, id: Math.random(), inside: new Set(), ejectedAt: now }); G.saveUntil = now + 12; }
    }
    if (G.dropResetAt && now > G.dropResetAt) { G.dropResetAt = 0; for (const d of T.drops) d.up = true; }
    for (const b of G.balls) if (b.held && now > b.held) { b.held = 0; b.x = T.hole.x - 16; b.y = T.hole.y + 12; b.vx = -430 + Math.random() * 60; b.vy = 380; b.ejectedAt = now; SFX.kick(); }
  }
  /* ---------- demo player ---------- */
  // the attract-mode player: flips when a ball comes down onto a flipper, never holds a cradle for long
  const demoState = [{ until: 0, cool: 0 }, { until: 0, cool: 0 }];
  function demoFlip() {
    const now = G.t;
    for (let i = 0; i < 2; i++) {
      const f = T.flippers[i], ds = demoState[i];
      if (f.key && now > ds.until) { f.key = false; ds.cool = now + 0.35; }
      if (f.key || now < ds.cool) continue;
      for (const b of G.balls) {
        if (b.held || b.lane) continue;
        const dx = b.x - f.px, dy = b.y - f.py;
        const along = i === 0 ? dx : -dx;
        if (along > 8 && along < f.len + 6 && dy > -45 && dy < 28 && b.vy > -150) {
          f.key = true; ds.until = now + 0.12 + Math.random() * 0.1;
          break;
        }
      }
    }
    for (const b of G.balls) if (b.lane && b.y > T.plunger.y - 30 && b.vy === 0 && !plungerHeld) { T.plunger.pull = 0.6 + Math.random() * 0.4; releasePlunger(); }
  }
  /* ---------- drawing ---------- */
  const c2 = cv.getContext('2d');
  let scale = 1, dpr = 1, staticLayer = null;
  function layout() {
    const sideW = win.innerWidth > 720 ? 260 : 0;
    const availH = wrap.clientHeight - 16, availW = wrap.clientWidth - sideW - 16;
    let w = availH * (PB_W / PB_H), hh = availH;
    if (w > availW) { w = availW; hh = w * (PB_H / PB_W); }
    if (win.innerWidth <= 720) { hh = Math.min(hh, win.innerHeight * 0.68); w = hh * (PB_W / PB_H); }
    w = Math.max(160, Math.floor(w)); hh = Math.max(260, Math.floor(hh));
    dpr = Math.min(win.devicePixelRatio || 1, 2);
    cv.style.width = w + 'px'; cv.style.height = hh + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr);
    scale = (w * dpr) / PB_W;
    staticLayer = null;
  }
  function domePath(c) {
    c.beginPath();
    c.moveTo(20, PB_H + 40); c.lineTo(20, 300);
    c.arc(300, 300, 280, Math.PI, Math.PI * 2);
    c.lineTo(580, PB_H + 40); c.closePath();
  }
  function drawStatic() {
    const L = doc.createElement('canvas');
    L.width = cv.width; L.height = cv.height;
    const c = L.getContext('2d');
    c.setTransform(scale, 0, 0, scale, 0, 0);
    // cabinet
    c.fillStyle = '#14161c'; c.fillRect(0, 0, PB_W, PB_H);
    // space
    c.save(); domePath(c); c.clip();
    const sky = c.createLinearGradient(0, 0, 0, PB_H);
    sky.addColorStop(0, '#0a0730'); sky.addColorStop(0.45, '#120a3a'); sky.addColorStop(1, '#03020e');
    c.fillStyle = sky; c.fillRect(0, 0, PB_W, PB_H);
    const neb = (x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
    neb(140, 420, 260, 'rgba(160,40,200,.28)'); neb(450, 640, 240, 'rgba(0,160,200,.22)'); neb(300, 160, 220, 'rgba(255,90,160,.16)');
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 260; i++) { const x = rnd() * PB_W, y = rnd() * PB_H, r = rnd() * 1.4 + 0.3; c.fillStyle = 'rgba(255,255,255,' + (0.35 + rnd() * 0.65).toFixed(2) + ')'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
    // the planet's glow, a dotted orbit path and a couple of moons
    neb(282, 520, 130, 'rgba(255,150,40,.18)');
    c.save(); c.translate(282, 560); c.rotate(-0.32); c.setLineDash([3, 7]); c.strokeStyle = 'rgba(127,227,255,.22)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, 190, 70, 0, 0, Math.PI * 2); c.stroke(); c.restore();
    c.setLineDash([]);
    const moon = (x, y, r, col) => { const g = c.createRadialGradient(x - r / 3, y - r / 3, 1, x, y, r); g.addColorStop(0, '#fff'); g.addColorStop(0.4, col); g.addColorStop(1, '#000'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
    moon(130, 640, 7, '#7fe3ff'); moon(440, 600, 5, '#ff66ff'); moon(380, 720, 4, '#ffd400');
    c.fillStyle = 'rgba(255,255,255,.07)'; c.font = '900 34px "Arial Black",Arial,sans-serif'; c.textAlign = 'center'; c.fillText('LANSCAPE', 282, 790);
    // playfield art: orbit arrow, lane letters, labels
    c.font = '900 13px "Arial Black",Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(127,227,255,.55)';
    c.save(); c.translate(43, 500); c.rotate(-Math.PI / 2); c.fillText('ORBIT ▶', 0, 0); c.restore();
    c.fillStyle = 'rgba(255,212,0,.5)'; c.font = 'bold 10px Arial,sans-serif';
    c.fillText('HYPERHOUND', T.hole.x, T.hole.y + 30);
    c.fillStyle = 'rgba(255,102,255,.5)'; c.fillText('DIAL-UP', 112, 596);
    c.save(); c.translate(512, 497); c.rotate(Math.PI / 2); c.fillStyle = 'rgba(0,229,255,.5)'; c.fillText('SURF THE WEB', 0, 0); c.restore();
    // inlane / outlane arrows
    c.fillStyle = 'rgba(255,255,255,.18)';
    for (const x of [36, 76, 488, 528]) { c.beginPath(); c.moveTo(x - 7, 730); c.lineTo(x + 7, 730); c.lineTo(x, 744); c.fill(); }
    // apron
    c.restore();
    const ap = c.createLinearGradient(0, 950, 0, PB_H);
    ap.addColorStop(0, '#2a2e3a'); ap.addColorStop(1, '#101218');
    c.fillStyle = ap;
    c.fillRect(20, 952, 140, 48); c.fillRect(404, 952, 141, 48);
    c.fillStyle = '#ffd400'; c.font = '900 15px "Arial Black",Arial,sans-serif'; c.textAlign = 'center';
    c.fillText('RINGHUB', 90, 978); c.fillStyle = '#7fe3ff'; c.fillText('PINBALL', 474, 978);
    // rails (metal guides)
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const pts of T.rails) {
      for (const [w, col] of [[9, '#05060a'], [6, '#8b93a7'], [2.2, '#e6ebf5']]) {
        c.lineWidth = w; c.strokeStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.stroke();
      }
    }
    // gates
    for (const s of T.walls) if (s.kind === 'gate') { c.strokeStyle = '#ffd400'; c.lineWidth = 3; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by); c.stroke(); c.setLineDash([]); }
    // slingshot bodies
    for (const sl of T.slings) {
      const [a, b, d] = sl.pts;
      const g = c.createLinearGradient(a[0], a[1], d[0], d[1]); g.addColorStop(0, '#5a1f8f'); g.addColorStop(1, '#2a0f50');
      c.fillStyle = g; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.closePath(); c.fill();
      c.strokeStyle = '#ff66ff'; c.lineWidth = 2; c.stroke();
    }
    // drop target backstop
    c.fillStyle = '#2b2f3b'; c.fillRect(90, 466, 12, 114);
    // the hole
    const hg = c.createRadialGradient(T.hole.x, T.hole.y, 2, T.hole.x, T.hole.y, T.hole.r + 6);
    hg.addColorStop(0, '#000'); hg.addColorStop(0.7, '#111'); hg.addColorStop(1, '#ffd400');
    c.fillStyle = hg; c.beginPath(); c.arc(T.hole.x, T.hole.y, T.hole.r + 5, 0, Math.PI * 2); c.fill();
    // posts
    for (const p of T.posts) { c.fillStyle = '#05060a'; c.beginPath(); c.arc(p.x, p.y, p.r + 1.5, 0, Math.PI * 2); c.fill(); const pg = c.createRadialGradient(p.x - p.r / 3, p.y - p.r / 3, 0.5, p.x, p.y, p.r); pg.addColorStop(0, '#fff'); pg.addColorStop(1, '#8b93a7'); c.fillStyle = pg; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill(); }
    // plunger lane floor marks
    c.fillStyle = 'rgba(255,255,255,.06)'; for (let y = 400; y < 940; y += 40) c.fillRect(551, y, 23, 2);
    staticLayer = L;
  }
  function glow(c, x, y, r, col, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace('A', a.toFixed(2))); g.addColorStop(1, col.replace('A', '0')); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  function draw(now) {
    if (!staticLayer) drawStatic();
    const c = c2;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const sx = shake ? (Math.random() - 0.5) * shake * scale : 0, sy = shake ? (Math.random() - 0.5) * shake * scale : 0;
    shake = Math.max(0, shake - 0.6);
    c.drawImage(staticLayer, sx, sy);
    c.setTransform(scale, 0, 0, scale, sx, sy);
    const blink = Math.floor(now / 250) % 2 === 0;
    // top lane letters
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 20px "Arial Black",Arial,sans-serif';
    'RING'.split('').forEach((ch, i) => {
      const x = T.laneX[i], on = G.lanes[i], sk = G.skillOpen && G.skillLane === i && blink;
      if (on || sk) glow(c, x, 140, 26, sk ? 'rgba(255,212,0,A)' : 'rgba(60,255,122,A)', 0.55);
      c.fillStyle = on ? '#3cff7a' : sk ? '#ffd400' : 'rgba(255,255,255,.22)'; c.fillText(ch, x, 140);
    });
    // mission insert lights
    const mid = mission().id;
    const insert = (x, y, col, lit) => { c.fillStyle = lit ? col : 'rgba(255,255,255,.08)'; c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 9, y + 7); c.lineTo(x - 9, y + 7); c.closePath(); c.fill(); if (lit) glow(c, x, y, 22, col.replace('rgb', 'rgba').replace(')', ',A)'), 0.35); };
    insert(43, 420, 'rgb(0,229,255)', mid === 'orbit' && blink);
    insert(455, 380, 'rgb(255,212,0)', mid === 'fetch' && blink);
    insert(128, 523, 'rgb(255,102,255)', mid === 'dial' && blink);
    insert(500, 497, 'rgb(0,229,255)', mid === 'www' && blink);
    insert(282, 590, 'rgb(255,150,40)', mid === 'planet' && blink);
    // the planet
    const P = T.planet;
    c.save(); c.translate(P.x, P.y); c.rotate(-0.32);
    c.strokeStyle = 'rgba(60,255,122,.45)'; c.lineWidth = 5; c.beginPath(); c.ellipse(0, 0, 78, 20, 0, Math.PI, Math.PI * 2); c.stroke();
    c.restore();
    const pg = c.createRadialGradient(P.x - 12, P.y - 14, 3, P.x, P.y, P.r + 2);
    pg.addColorStop(0, '#ffe29a'); pg.addColorStop(0.55, '#e8862a'); pg.addColorStop(1, '#6a2606');
    c.fillStyle = pg; c.beginPath(); c.arc(P.x, P.y, P.r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(122,46,8,.6)'; c.lineWidth = 3; c.beginPath(); c.arc(P.x, P.y, P.r * 0.72, 0.2, 1.6); c.stroke();
    if (P.lit > 0) { glow(c, P.x, P.y, P.r + 30, 'rgba(255,220,120,A)', P.lit * 0.7); P.lit = Math.max(0, P.lit - 0.04); }
    c.save(); c.translate(P.x, P.y); c.rotate(-0.32);
    c.strokeStyle = '#3cff7a'; c.lineWidth = 5; c.shadowColor = '#3cff7a'; c.shadowBlur = 10; c.beginPath(); c.ellipse(0, 0, 78, 20, 0, 0, Math.PI); c.stroke();
    c.shadowBlur = 0; c.fillStyle = '#ff66ff'; c.beginPath(); c.arc(70, -12, 4, 0, Math.PI * 2); c.fill();
    c.restore();
    // bumpers
    T.bumpers.forEach(bm => {
      c.fillStyle = '#05060a'; c.beginPath(); c.arc(bm.x, bm.y + 3, bm.r + 3, 0, Math.PI * 2); c.fill();
      const bg = c.createRadialGradient(bm.x - 8, bm.y - 10, 2, bm.x, bm.y, bm.r);
      bg.addColorStop(0, '#fff'); bg.addColorStop(0.35, bm.c); bg.addColorStop(1, '#1a1030');
      c.fillStyle = bg; c.beginPath(); c.arc(bm.x, bm.y, bm.r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2; c.beginPath(); c.arc(bm.x, bm.y, bm.r - 6, 0, Math.PI * 2); c.stroke();
      if (bm.lit > 0) { glow(c, bm.x, bm.y, bm.r + 26, 'rgba(255,255,255,A)', bm.lit * 0.8); bm.lit = Math.max(0, bm.lit - 0.06); }
    });
    // slingshot rubbers
    for (const sl of T.slings) {
      const [a, , d] = sl.pts;
      c.strokeStyle = sl.lit > 0 ? '#fff' : '#ff66ff'; c.lineWidth = sl.lit > 0 ? 5 : 3.5;
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(d[0], d[1]); c.stroke();
      if (sl.lit > 0) { glow(c, (a[0] + d[0]) / 2, (a[1] + d[1]) / 2, 40, 'rgba(255,102,255,A)', sl.lit * 0.6); sl.lit = Math.max(0, sl.lit - 0.08); }
    }
    // drop targets
    c.font = 'bold 13px Arial,sans-serif';
    for (const d of T.drops) {
      if (d.up) {
        c.fillStyle = '#ff66ff'; c.fillRect(d.ax - 4, d.ay, 9, d.by - d.ay);
        c.fillStyle = '#fff'; c.fillText(d.ch, d.ax + 0.5, (d.ay + d.by) / 2 + 1);
      } else { c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(d.ax - 1, d.ay, 3, d.by - d.ay); }
      if (d.lit > 0) { glow(c, d.ax, (d.ay + d.by) / 2, 26, 'rgba(255,102,255,A)', d.lit); d.lit = Math.max(0, d.lit - 0.06); }
    }
    // stand-ups
    T.stands.forEach((s, i) => {
      const on = G.www[i];
      c.fillStyle = on ? '#00e5ff' : '#1d5f75'; c.fillRect(s.ax - 4, s.ay, 9, s.by - s.ay);
      c.fillStyle = on ? '#002' : '#cfefff'; c.fillText('W', s.ax + 0.5, (s.ay + s.by) / 2 + 1);
      if (s.lit > 0) { glow(c, s.ax, (s.ay + s.by) / 2, 26, 'rgba(0,229,255,A)', s.lit); s.lit = Math.max(0, s.lit - 0.06); }
    });
    // the hole glows when something is in it
    if (G.balls.some(b => b.held)) glow(c, T.hole.x, T.hole.y, 40, 'rgba(255,212,0,A)', blink ? 0.7 : 0.35);
    // plunger
    const py = T.plunger.y + T.plunger.pull * 34;
    c.strokeStyle = '#8b93a7'; c.lineWidth = 2; c.beginPath();
    for (let i = 0; i <= 10; i++) { const y = py + 4 + (i / 10) * (PB_H - py - 4); c.lineTo(T.plunger.x + (i % 2 ? 7 : -7), y); }
    c.stroke();
    const kg = c.createLinearGradient(T.plunger.x - 12, 0, T.plunger.x + 12, 0); kg.addColorStop(0, '#6c7480'); kg.addColorStop(0.5, '#f4f6fa'); kg.addColorStop(1, '#6c7480');
    c.fillStyle = kg; c.fillRect(T.plunger.x - 12, py, 24, 8);
    if (plungerHeld) { c.fillStyle = 'rgba(255,212,0,.8)'; c.fillRect(548, 990 - T.plunger.pull * 120, 4, T.plunger.pull * 120); }
    // flippers
    for (const f of T.flippers) {
      const tx = f.px + Math.cos(f.a) * f.len, ty = f.py + Math.sin(f.a) * f.len;
      const nx = -Math.sin(f.a), ny = Math.cos(f.a);
      const shape = (r0, r1) => { c.beginPath(); c.moveTo(f.px + nx * r0, f.py + ny * r0); c.lineTo(tx + nx * r1, ty + ny * r1); c.arc(tx, ty, r1, f.a + Math.PI / 2, f.a - Math.PI / 2, true); c.lineTo(f.px - nx * r0, f.py - ny * r0); c.arc(f.px, f.py, r0, f.a - Math.PI / 2, f.a + Math.PI / 2, true); c.closePath(); };
      c.fillStyle = 'rgba(0,0,0,.45)'; c.save(); c.translate(3, 5); shape(11, 6.5); c.fill(); c.restore();
      shape(11, 6.5); c.fillStyle = '#e8261d'; c.fill();
      shape(8.5, 4.5); const fg = c.createLinearGradient(f.px, f.py - 10, f.px, f.py + 10); fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, '#c9ced8'); c.fillStyle = fg; c.fill();
      c.fillStyle = '#8b93a7'; c.beginPath(); c.arc(f.px, f.py, 3.5, 0, Math.PI * 2); c.fill();
    }
    // balls
    for (const b of G.balls) {
      c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(b.x + 4, b.y + 6, PB_R, PB_R * 0.8, 0, 0, Math.PI * 2); c.fill();
      const bg = c.createRadialGradient(b.x - 4, b.y - 5, 1, b.x, b.y, PB_R);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.35, '#d7dce6'); bg.addColorStop(0.8, '#6f7685'); bg.addColorStop(1, '#2a2e38');
      c.fillStyle = bg; c.beginPath(); c.arc(b.x, b.y, PB_R, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(127,227,255,.35)'; c.beginPath(); c.arc(b.x + 3, b.y + 4, 4, 0, Math.PI * 2); c.fill();
    }
    // big messages
    if (G.bigMsg && now < G.bigUntil) {
      c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '900 46px "Arial Black",Arial,sans-serif';
      const a = Math.min(1, (G.bigUntil - now) / 300);
      c.globalAlpha = a; c.lineWidth = 6; c.strokeStyle = '#000'; c.strokeText(G.bigMsg, 282, 690);
      const tg = c.createLinearGradient(0, 665, 0, 715); tg.addColorStop(0, '#fff9a8'); tg.addColorStop(0.5, '#ffd400'); tg.addColorStop(1, '#ff6a00');
      c.fillStyle = tg; c.fillText(G.bigMsg, 282, 690);
      c.restore();
    }
    if (G.mode !== 'play' && blink && !(G.bigMsg && now < G.bigUntil)) {
      c.textAlign = 'center'; c.font = '900 22px "Arial Black",Arial,sans-serif'; c.fillStyle = '#ffd400'; c.strokeStyle = '#000'; c.lineWidth = 4;
      const touch = win.matchMedia && win.matchMedia('(pointer:coarse)').matches;
      const t = G.mode === 'over' ? (touch ? 'GAME OVER · TAP TO PLAY' : 'GAME OVER · F2 TO PLAY') : (touch ? 'TAP TO PLAY' : 'PRESS F2 TO PLAY');
      c.strokeText(t, 282, 700); c.fillText(t, 282, 700);
    }
  }
  /* ---------- side panel ---------- */
  let lastScore = -1, msgCur = null;
  function panel(now) {
    if (G.score !== lastScore) { lastScore = G.score; scoreEl.textContent = G.score.toLocaleString(); }
    ballEl.textContent = G.mode === 'play' ? String(G.ball) + (G.extraBalls ? '+' : '') : '-';
    rankEl.textContent = PB_RANKS[G.rank].toUpperCase();
    const m = mission();
    misName.textContent = m.name;
    misHow.textContent = m.how + ' (' + Math.min(G.prog, m.need) + '/' + m.need + ')';
    misBar.style.width = (Math.min(1, G.prog / m.need) * 100) + '%';
    if (G.msgReset) { G.msgReset = false; msgCur = null; }
    if (!msgCur || now > msgCur.until) {
      msgCur = G.msgs.shift() || null;
      if (msgCur) { msgCur.until = now + msgCur.ms; msgEl.textContent = msgCur.text; }
      else if (G.mode === 'play') msgEl.textContent = G.tilted ? 'TILT' : (waitingLaunch() ? 'Hold Space to pull the plunger,\nlet go to launch' : PB_RANKS[G.rank] + '\nBonus ' + G.bonus + ' × ' + G.mult);
    }
    launchBtn.disabled = G.mode === 'play' && !waitingLaunch();
  }
  function renderScores(meIdx) {
    hsBox.replaceChildren(h('h4', { text: 'HIGH SCORES' }), h('ol', {}, ...scores.slice(0, 5).map((x, i) => h('li', { class: i === meIdx ? 'me' : '' }, x.n, h('span', { text: x.s.toLocaleString() })))));
  }
  function askInitials(at) {
    const inp = h('input', { maxlength: '3', value: prefs.name || '', 'aria-label': 'Your initials' });
    const box = h('div', { class: 'pb-led' }, h('div', { class: 'lb', text: 'NEW HIGH SCORE! YOUR INITIALS' }), h('div', { class: 'pb-name', style: { marginTop: '6px' } }, inp, h('button', { class: 'btn', type: 'button', text: 'OK', onclick: () => done() })));
    side.insertBefore(box, hsBox.parentNode);
    setTimeout(() => { inp.focus(); inp.select(); }, 50);
    const done = () => {
      const n = (inp.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'ACE');
      prefs.name = n; saveP();
      scores.splice(at, 0, { n, s: G.score, t: Date.now() });
      scores = scores.slice(0, 5);
      ctx.kv.set('pinball:scores', scores);
      renderScores(at);
      box.remove();
      cv.focus();
    };
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') done(); });
  }
  async function askName() { const v = await ctx.ask('Your Initials', 'Initials for the high score table:', prefs.name); if (v) { prefs.name = v.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase(); saveP(); } }
  function showScores() { ctx.msg('info', 'High Scores', '<ol>' + scores.map(x => '<li><b>' + esc(x.n) + '</b> — ' + x.s.toLocaleString() + (x.t ? ' <span style="color:#666">(' + esc(fmtShort(x.t)) + ')</span>' : '') + '</li>').join('') + '</ol>'); }
  function help() {
    ctx.msg('info', 'How to Play', '<p><b>Launch:</b> hold Space (or the Launch button), let go to shoot. Land in the blinking top lane for a <b>skill shot</b>.</p><p><b>Flippers:</b> Z / left Shift / ← and / / right Shift / →. On a touch screen, tap the left or right half.</p><p><b>Missions</b> rank you up from Newbie to Cyber Legend: light R-I-N-G, dial up the 5-6-K targets, orbit the hub, feed the HyperHound hole, load the bumpers, surf the W-W-W targets and hit the planet. Rank 3 and rank 6 earn extra balls. Every third HyperHound capture starts <b>multiball</b>.</p><p><b>Nudge</b> with X, . and ↑, but nudge too hard and the table <b>tilts</b>.</p>');
  }
  /* ---------- the loop ---------- */
  let raf = 0, last = 0;
  function frame(now) {
    if (!ctx.alive()) return;
    const dt = last ? Math.min(0.034, (now - last) / 1000) : 0.016;
    last = now;
    if (!paused) {
      if (G.mode !== 'play') demoFlip();
      releaseHeld();
      G.tilt = Math.max(0, G.tilt - dt * 0.55);
      const n = Math.max(1, Math.ceil(dt / (1 / 900)));
      for (let i = 0; i < n; i++) step(dt / n);
    }
    draw(now);
    panel(now);
    raf = win.requestAnimationFrame(frame);
  }
  ctx.cleanup(() => win.cancelAnimationFrame(raf));
  ctx.on(win, 'resize', debounce(layout, 60));
  ctx.on(doc, 'fullscreenchange', () => setTimeout(layout, 50));
  layout();
  renderScores();
  attract();
  raf = win.requestAnimationFrame(frame);
  cv.focus({ preventScroll: true });
  // test hook
  ctx.win.__pinball = { G, T, newGame, step, flip, releasePlunger, demo: demoFlip, releaseHeld, nudge, setPull: p => { T.plunger.pull = p; }, drain: b => drainBall(b), pause: v => { paused = v; }, get paused() { return paused; } };
  return { title: 'RingHub Pinball' };
}
