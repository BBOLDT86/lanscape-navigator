// RingHub Pinball: table, physics sanity, scoring, missions, multiball, tilt, game over + high scores.
const { chromium } = require('./pw');
const path = require('path');
const fs = require('fs');
const OUT = process.env.OUT || require('path').join(require('os').tmpdir(), 'lanscape-shots');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (name, cond, extra) => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  — ' + extra : '')); };
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') logs.push('[console] ' + m.text()); });
  try {
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.LAN.go('http://pinball.lanscape.net/'));
  await page.waitForTimeout(2500);
  const f = await (await page.$('#frame')).contentFrame();
  let st = await f.evaluate(() => { const p = window.__pinball; return p && { mode: p.G.mode, balls: p.G.balls.length, cv: !!document.querySelector('canvas.pb-cv'), w: document.querySelector('canvas.pb-cv').clientWidth, h: document.querySelector('canvas.pb-cv').clientHeight }; });
  ok('table loads in attract mode with a demo ball', st && st.mode === 'attract' && st.balls === 1 && st.cv && st.h > 600, JSON.stringify(st));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + '/B0-pinball-attract.png' });
  // a long simulated demo: the ball must stay on the table and never go NaN
  st = await f.evaluate(() => {
    const p = window.__pinball; p.pause(true);
    let bad = 0, drains = 0, maxSp = 0, stuck = 0, still = 0;
    const origDrain = p.G.balls.length;
    for (let i = 0; i < 900 * 60; i++) { // a simulated minute
      p.demo(); p.releaseHeld(); p.step(1 / 900);
      for (const b of p.G.balls) {
        if (!isFinite(b.x) || !isFinite(b.y)) bad++;
        if (b.x < 8 || b.x > 592 || b.y < 8) bad++;
        const sp = Math.hypot(b.vx, b.vy); maxSp = Math.max(maxSp, sp);
        if (!b.held && !b.lane && sp < 2) still++; else still = 0;
        if (still > 900 * 4) { stuck++; still = 0; }
      }
      if (p.G.balls.length === 0) drains++;
    }
    p.pause(false);
    return { bad, maxSp: Math.round(maxSp), stuck };
  });
  ok('a simulated minute of play: ball stays on the table', st.bad === 0 && st.stuck === 0, JSON.stringify(st));
  // new game
  await page.keyboard.press('F2');
  await page.waitForTimeout(400);
  st = await f.evaluate(() => { const p = window.__pinball; return { mode: p.G.mode, ball: p.G.ball, lane: p.G.balls[0] && p.G.balls[0].lane, score: p.G.score }; });
  ok('F2 starts a game with ball 1 on the plunger', st.mode === 'play' && st.ball === 1 && st.lane && st.score === 0, JSON.stringify(st));
  // plunge
  await page.keyboard.down(' ');
  await page.waitForTimeout(700);
  const pull = await f.evaluate(() => window.__pinball.T.plunger.pull);
  await page.keyboard.up(' ');
  await page.waitForTimeout(80);
  st = await f.evaluate(() => { const b = window.__pinball.G.balls[0]; return { vy: Math.round(b.vy), y: Math.round(b.y) }; });
  ok('holding Space pulls the plunger; letting go launches', pull > 0.5 && st.vy < -500, 'pull ' + pull.toFixed(2) + ' ' + JSON.stringify(st));
  await page.waitForTimeout(1500);
  st = await f.evaluate(() => { const b = window.__pinball.G.balls[0]; return b && { x: Math.round(b.x), y: Math.round(b.y), lane: b.lane }; });
  ok('the ball leaves the shooter lane into the table', st && !st.lane && st.x < 545, JSON.stringify(st));
  // flippers
  await page.keyboard.down('z');
  await page.waitForTimeout(120);
  st = await f.evaluate(() => window.__pinball.T.flippers.map(f => +f.a.toFixed(2)));
  await page.keyboard.up('z');
  ok('Z raises the left flipper', st[0] < 0 && st[1] > 2.5, JSON.stringify(st));
  await page.keyboard.down('/');
  await page.waitForTimeout(120);
  st = await f.evaluate(() => window.__pinball.T.flippers.map(f => +f.a.toFixed(2)));
  await page.keyboard.up('/');
  ok('/ raises the right flipper', st[1] > 3.4, JSON.stringify(st));
  // controlled shots (paused, stepping by hand)
  const shot = (setup, frames) => f.evaluate(([setup, frames]) => {
    const p = window.__pinball; p.pause(true);
    const b = p.G.balls[0] || (p.G.balls.push({ inside: new Set() }), p.G.balls[0]);
    Object.assign(b, { held: 0, lane: false, ejectedAt: 0 }, setup);
    b.inside = new Set();
    const s0 = p.G.score;
    for (let i = 0; i < frames; i++) { p.releaseHeld(); p.step(1 / 900); }
    const out = { gained: p.G.score - s0, x: Math.round(b.x), y: Math.round(b.y), vx: Math.round(b.vx), vy: Math.round(b.vy), held: !!b.held };
    p.pause(false);
    return out;
  }, [setup, frames]);
  st = await shot({ x: 236, y: 196, vx: 0, vy: 400 }, 120);
  ok('pop bumper kicks the ball and scores', st.gained >= 1000 && st.vy < 0, JSON.stringify(st));
  st = await shot({ x: 170, y: 489, vx: -900, vy: 0 }, 150);
  let drops = await f.evaluate(() => window.__pinball.T.drops.map(d => d.up));
  ok('drop target goes down when hit', drops[0] === false && st.gained >= 750, JSON.stringify(drops) + ' ' + JSON.stringify(st));
  st = await shot({ x: 455, y: 320, vx: 0, vy: 300 }, 200);
  ok('HyperHound hole captures a slow ball', st.held && st.gained >= 7500, JSON.stringify(st));
  await page.waitForTimeout(1800);
  st = await f.evaluate(() => { const b = window.__pinball.G.balls[0]; return { held: !!b.held, vy: Math.round(b.vy), x: Math.round(b.x) }; });
  ok('…and kicks it back out', !st.held, JSON.stringify(st));
  // mission 1: R-I-N-G
  st = await f.evaluate(() => {
    const p = window.__pinball; p.pause(true);
    const b = p.G.balls[0];
    const r0 = p.G.rank;
    for (const x of p.T.laneX) { Object.assign(b, { x, y: 100, vx: 0, vy: 250, held: 0, lane: false }); b.inside = new Set(); for (let i = 0; i < 160; i++) p.step(1 / 900); }
    p.pause(false);
    return { rank: p.G.rank, r0, mission: p.G.mission, lanes: p.G.lanes.join('') };
  });
  ok('lighting R-I-N-G completes a mission and ranks you up', st.rank === st.r0 + 1 && st.mission === 1, JSON.stringify(st));
  await page.waitForTimeout(300);
  st = await f.evaluate(() => ({ rank: document.querySelector('.pb-rank').textContent, mis: document.querySelector('.pb-mis b').textContent }));
  ok('panel shows the new rank and the next mission', st.rank === 'LURKER' && st.mis === 'Dial Up', JSON.stringify(st));
  // orbit shot: up the left channel and round the dome
  st = await f.evaluate(() => {
    const p = window.__pinball; p.pause(true);
    const b = p.G.balls[0]; const s0 = p.G.score;
    Object.assign(b, { x: 43, y: 430, vx: 0, vy: -2400, held: 0, lane: false }); b.inside = new Set();
    let maxX = 0;
    for (let i = 0; i < 900 * 1.6; i++) { p.step(1 / 900); maxX = Math.max(maxX, b.x); }
    p.pause(false);
    return { gained: p.G.score - s0, maxX: Math.round(maxX) };
  });
  ok('a hard shot up the left orbit goes round the dome and scores', st.gained >= 5000 && st.maxX > 480, JSON.stringify(st));
  await page.screenshot({ path: OUT + '/B1-pinball-play.png' });
  // tilt
  st = await f.evaluate(() => { const p = window.__pinball; for (let i = 0; i < 7; i++) p.nudge(160, -60); return p.G.tilted; });
  ok('nudging too hard tilts the table', st === true);
  // drain the remaining balls: game over and a high score
  st = await f.evaluate(() => {
    const p = window.__pinball; p.pause(true);
    p.G.score = 2000000;
    let guard = 0;
    while (p.G.mode === 'play' && guard++ < 10) { const b = p.G.balls[0]; if (!b) break; p.G.saveUntil = 0; p.drain(b); }
    p.pause(false);
    return { mode: p.G.mode, ball: p.G.ball };
  });
  ok('three balls and the game is over', st.mode === 'over', JSON.stringify(st));
  await page.waitForTimeout(400);
  const nameIn = await f.$('.pb-name input');
  ok('a high score asks for initials', !!nameIn);
  if (nameIn) { await nameIn.fill('BRD'); await nameIn.press('Enter'); }
  await page.waitForTimeout(400);
  st = await f.evaluate(() => [...document.querySelectorAll('.pb-hs li')].map(l => l.textContent));
  ok('high score table updated', /BRD/.test(st[0] || ''), JSON.stringify(st));
  st = await page.evaluate(async () => { const r = await window.LAN.DB.get('kv', 'pinball:scores'); return r && r.v[0]; });
  ok('high scores are saved', st && st.n === 'BRD' && st.s >= 2000000, JSON.stringify(st));
  // reachable from Programs and RingHub
  await page.evaluate(() => window.LAN.go('http://home.lanscape.net/programs'));
  await page.waitForTimeout(1500);
  const pf = await (await page.$('#frame')).contentFrame();
  st = await pf.evaluate(() => [...document.querySelectorAll('a')].some(a => /pinball\.lanscape\.net/.test(a.href)));
  ok('Program Manager lists RingHub Pinball', st);
  await page.evaluate(() => window.LAN.go('http://www.ringhub.org/'));
  await page.waitForTimeout(1500);
  const rf = await (await page.$('#frame')).contentFrame();
  st = await rf.evaluate(() => [...document.querySelectorAll('a')].some(a => /pinball\.lanscape\.net/.test(a.href)));
  ok('RingHub links to the pinball table', st);
  } catch (e) { results.push('FAIL (crashed) ' + e.message.split('\n')[0]); }
  console.log(results.join('\n'));
  if (logs.length) console.log('LOGS:\n' + logs.slice(0, 20).join('\n'));
  console.log(results.filter(r => r.startsWith('PASS')).length + ' passed, ' + results.filter(r => r.startsWith('FAIL')).length + ' failed');
  await browser.close();
})();
