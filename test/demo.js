// The built-in demo files: every one opens in its program.
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
  await page.waitForTimeout(2500);
  const fr = async () => (await page.$('#frame')).contentFrame();
  const go = async (u, w = 2000) => { await page.evaluate(x => window.LAN.go(x), u); await page.waitForTimeout(w); };
  const info = await page.evaluate(() => window.LAN.docsAll().filter(d => d.demo && !/\.html?$/.test(d.name)).map(d => ({ name: d.name, kind: d.kind, url: d.url, app: d.kind })));
  ok('demo files are on the LANscape', info.length >= 20, info.length + ' files');
  const urlOf = n => (info.find(x => x.name === n) || {}).url;
  const check = async (name, sel, test, wait) => {
    await go(urlOf(name), wait || 2200);
    const f = await fr();
    let st = null;
    try { st = await f.evaluate(new Function('return (' + test + ')(document)')); } catch (e) { st = 'ERR ' + e.message; }
    const err = await f.evaluate(() => (document.querySelector('.app-error') || {}).textContent || '');
    ok(name + ' opens (' + sel + ')', !err && st && st !== false && !/^ERR/.test(String(st)), (err || JSON.stringify(st)).slice(0, 140));
  };
  await check('README.TXT', 'Notepad', "d => d.querySelector('textarea') && d.querySelector('textarea').value.includes('LANSCAPE DEMO FILES')");
  await check('Webmaster Checklist.md', 'Write', "d => (d.querySelector('.wr-page h1') || {}).textContent");
  await check('Dial-Up Troubleshooting.rtf', 'Write', "d => (d.querySelector('.wr-page') || {}).textContent.includes('Listen for the dial tone')");
  await check('Y2K Readiness Memo.docx', 'Write', "d => (d.querySelector('.wr-page h1') || {}).textContent === 'Y2K Readiness Memo' && d.querySelectorAll('.wr-page td').length >= 9");
  await check('Top Sites 1998.csv', 'Ledger', "d => d.body.textContent.includes('Flat-Six Garage')");
  await check('LAN Party Budget.xlsx', 'Ledger', "d => window._wbTotal = d.body.textContent.includes('LAN Party Budget')", 2600);
  const total = await page.evaluate(() => { const app = window.LAN.S.cur && window.LAN.S.cur.app; const wb = app && app._wb; if (!wb) return null; const sh = wb.sheets[0]; const c = sh.cells.get(9 * 16384 + 3); return c && c.v; });
  ok('the budget formulas calculate', typeof total === 'number' && Math.abs(total - (6 * 12.99 + 10 * 1.49 + 8 * 4.5 + 39.95 + 25 + 3 * 7.99)) < 0.01, total);
  await check('LANscape Quick Start.pdf', 'Reader', "d => d.querySelectorAll('.rp-page').length === 2", 4500);
  await check('LANscape Tour.pptx', 'Slide Show', "d => d.querySelectorAll('.sv-out div').length === 3 && (d.querySelector('.sv-stage h1') || {}).textContent");
  await check('guestbook.pl', 'Notepad', "d => d.querySelector('textarea').value.includes('use CGI')");
  await check('homepage-kit.zip', 'ZIP Viewer', "d => d.querySelectorAll('.zv-list tbody tr').length === 4");
  await check('LANscape Desktop.png', 'Photos', "d => (d.querySelector('.ph-lb .stage img') || {}).naturalWidth === 800", 2600);
  await check('Under Construction.svg', 'Photos', "d => !!d.querySelector('.ph-lb .stage img')");
  // music
  await go('http://music.lanscape.net/', 2000);
  let f = await fr();
  let st = await f.evaluate(() => [...document.querySelectorAll('.jb-rows .jr')].map(r => r.children[1].textContent));
  ok('Jukebox has the synthesized demo songs', st.includes('Dial Tone Serenade') && st.includes('Ring Around the Hub') && st.includes('Under Construction Theme'), st.join(' | '));
  await go(urlOf('01 Dial Tone Serenade.wav'), 3000);
  st = await page.evaluate(() => { const p = window.LAN.Player; return { playing: p.playing(), t: p.time(), cur: p.current() && p.current().name, dur: p.duration() }; });
  ok('a demo song plays', st.playing && st.cur === '01 Dial Tone Serenade.wav' && st.t > 0.5 && st.dur > 25, JSON.stringify(st));
  st = await page.evaluate(() => { const u = new Uint8Array(1024); window.LAN.Player.wave(u); let mn = 255, mx = 0; for (const v of u) { mn = Math.min(mn, v); mx = Math.max(mx, v); } return mx - mn; });
  ok('…and it makes a sound', st > 20, st);
  f = await fr();
  st = await f.evaluate(() => { const i = document.querySelector('.jb-art img'); return i && i.src.startsWith('data:image/jpeg'); });
  ok('demo albums have cover art', st);
  await page.screenshot({ path: OUT + '/D0-demo-jukebox.png' });
  await page.evaluate(() => window.LAN.Player.pause());
  // video
  await go('http://www.rewindvideo.com/', 2500);
  f = await fr();
  st = await f.evaluate(() => ({ rows: [...document.querySelectorAll('.rw-row h2')].map(x => x.firstChild.textContent), posters: [...document.querySelectorAll('.rw-card')].filter(c => /url\(/.test(c.style.backgroundImage)).length }));
  ok('Rewind shows the demo videos with posters', st.rows.includes('Screen Savers') && st.posters >= 3, JSON.stringify(st));
  await page.screenshot({ path: OUT + '/D1-demo-rewind.png' });
  await go(urlOf('LANscape Intro (1998).webm'), 9500);
  f = await fr();
  st = await f.evaluate(() => { const v = document.querySelector('.rwp video'); return v && { t: v.currentTime, playing: !v.paused, w: v.videoWidth, bad: !!document.querySelector('.rwp .bad') }; });
  ok('a demo video is recorded on the spot and plays', st && !st.bad && st.w === 480 && st.t > 0.3, JSON.stringify(st));
  } catch (e) { results.push('FAIL (crashed) ' + e.message.split('\n')[0]); }
  console.log(results.join('\n'));
  if (logs.length) console.log('LOGS:\n' + logs.filter(l => !/allow-same-origin/.test(l)).slice(0, 20).join('\n'));
  console.log(results.filter(r => r.startsWith('PASS')).length + ' passed, ' + results.filter(r => r.startsWith('FAIL')).length + ' failed');
  await browser.close();
})();
