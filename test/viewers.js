// Photo Album, Slide Show, ZIP viewer, Font viewer, Media viewer, File Properties.
const { chromium } = require('./pw');
const path = require('path');
const fs = require('fs');
const OUT = process.env.OUT || require('path').join(require('os').tmpdir(), 'lanscape-shots');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (name, cond, extra) => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  — ' + extra : '')); };
async function dismissSpiderPrompt(page) { for (let i = 0; i < 20; i++) { const b = await page.$('.win .btn:has-text("Not Now")'); if (b) { await b.click(); return true; } await page.waitForTimeout(150); } return false; }
(async () => {
  const browser = await chromium.launch();
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctxB.newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') logs.push('[console] ' + m.text()); });
  try {
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window.showDirectoryPicker = undefined; });
  await page.setInputFiles('#dirInput', path.join(__dirname, 'AllTypes'));
  await page.waitForTimeout(4500);
  await dismissSpiderPrompt(page);
  const fr = async () => (await page.$('#frame')).contentFrame();
  const go = async (u, w = 1800) => { await page.evaluate(x => window.LAN.go(x), u); await page.waitForTimeout(w); };
  const urlOf = name => page.evaluate(n => window.LAN.docsAll().find(d => d.name === n).url, name);
  const loc = () => page.$eval('#loc', e => e.value);
  /* ---------- Photos ---------- */
  await go('http://photos.lanscape.net/', 2500);
  let f = await fr();
  let st = await f.evaluate(() => ({ albums: [...document.querySelectorAll('.ph-album b')].map(b => b.textContent), recent: document.querySelectorAll('.ph-print').length }));
  ok('Photo Album lists one album per folder (website images left out)', st.albums.join('|') === 'Garage|Vacation 2019|Tutorials' || (st.albums.length === 3 && st.albums.includes('Garage') && st.albums.includes('Vacation 2019')), st.albums.join('|'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + '/C0-photos.png' });
  await f.click('.ph-album:has-text("Vacation 2019")');
  await page.waitForTimeout(900);
  st = await f.evaluate(() => ({ prints: document.querySelectorAll('.ph-print').length, thumbs: [...document.querySelectorAll('.ph-print .im')].filter(i => /url\(/.test(i.style.backgroundImage)).length }));
  ok('album shows its pictures as prints with thumbnails', st.prints === 2 && st.thumbs === 2, JSON.stringify(st));
  ok('album has an address', /photos\.lanscape\.net\/album\/vacation-2019/.test(await loc()), await loc());
  await f.click('.ph-print:has-text("Grand Turk Beach")');
  await page.waitForTimeout(900);
  st = await f.evaluate(() => { const i = document.querySelector('.ph-lb .stage img'); return i && { w: i.naturalWidth, t: document.querySelector('.ph-lb .bar .t').textContent }; });
  ok('lightbox shows the full picture', st && st.w === 1600 && /Grand Turk Beach/.test(st.t), JSON.stringify(st));
  ok('the picture has its own address', /photos\.lanscape\.net\/photo\/grand-turk-beach/.test(await loc()), await loc());
  await page.keyboard.press('i');
  await page.waitForTimeout(1500);
  st = await f.evaluate(() => document.querySelector('.ph-lb .info').textContent);
  ok('Info reads the EXIF camera details', /Kodak DC40/.test(st) && /1\/250 s/.test(st) && /f\/5\.6/.test(st) && /2019-07-04/.test(st), st.slice(0, 200));
  await page.screenshot({ path: OUT + '/C1-photos-lightbox.png' });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);
  st = await f.evaluate(() => document.querySelector('.ph-lb .bar .t').textContent);
  ok('arrow keys step through the album', /Sunset Over Cozumel/.test(st), st);
  await page.keyboard.press('r');
  await page.waitForTimeout(300);
  st = await f.evaluate(() => document.querySelector('.ph-lb .stage img').style.transform);
  ok('R rotates the view', /rotate\(90deg\)/.test(st), st);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // slideshow
  await f.click('.ph-top .ph-bt:has-text("Slide Show")');
  await page.waitForTimeout(1500);
  st = await f.evaluate(() => ({ on: !!document.querySelector('.ph-show'), shown: document.querySelectorAll('.ph-show .sl.on').length, cap: (document.querySelector('.ph-show .cap') || {}).textContent }));
  ok('slide show runs', st.on && st.shown === 1 && /1 \/ 2/.test(st.cap || ''), JSON.stringify(st));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok('Esc ends the slide show', await f.evaluate(() => !document.querySelector('.ph-show')));
  // publish a web album
  await f.click('.ph-top .ph-bt:has-text("Publish Web Album")');
  await page.waitForTimeout(2500);
  st = await page.evaluate(() => { const d = window.LAN.S.docs.get('My Documents/Web Albums/Vacation 2019/index.html'); return d && { url: d.url, kind: d.kind }; });
  ok('Publish Web Album writes a page into My Documents', st && st.kind === 'html', JSON.stringify(st));
  const visit = await page.$('.win .btn:has-text("Visit It")');
  if (visit) { await visit.click(); await page.waitForTimeout(2200); }
  f = await fr();
  st = await f.evaluate(() => ({ marquee: !!document.querySelector('marquee'), imgs: [...document.querySelectorAll('img')].filter(i => i.src.startsWith('data:image')).length }));
  ok('the published album is a 90s web page with thumbnails', st.marquee && st.imgs === 2, JSON.stringify(st));
  // a photo address opens straight into the lightbox
  await go(await urlOf('Cayenne Front.jpg'), 2200);
  f = await fr();
  st = await f.evaluate(() => (document.querySelector('.ph-lb .bar .t') || {}).textContent);
  ok('a photo address opens the lightbox', /Cayenne Front/.test(st || ''), st);
  /* ---------- Slide Show ---------- */
  await go(await urlOf('Garage Tour.pptx'), 2500);
  f = await fr();
  st = await f.evaluate(() => ({ outline: [...document.querySelectorAll('.sv-out div span')].map(s => s.textContent), h1: (document.querySelector('.sv-stage .slide h1') || {}).textContent, tpl: document.querySelector('.sv-stage .slide').className }));
  ok('pptx opens in Slide Show with an outline', st.outline.length >= 2 && st.h1 && /tpl-/.test(st.tpl), JSON.stringify(st));
  await page.screenshot({ path: OUT + '/C2-slides.png' });
  await f.selectOption('select[aria-label="Design"]', 'tie');
  await page.waitForTimeout(200);
  st = await f.evaluate(() => document.querySelector('.sv-stage .slide').className);
  ok('design templates restyle the slides', /tpl-tie/.test(st), st);
  await f.click('.sv-stage');
  await page.keyboard.press('F5');
  await page.waitForTimeout(600);
  st = await f.evaluate(() => !!document.querySelector('.sv-show .slide'));
  ok('F5 presents full screen', st);
  for (let i = 0; i < 3; i++) { await page.keyboard.press(' '); await page.waitForTimeout(700); }
  st = await f.evaluate(() => (document.querySelector('.sv-show .end') || {}).textContent);
  ok('…and ends with the classic black screen', st === 'End of slide show, click to exit.', st);
  await page.keyboard.press('Escape');
  /* ---------- ZIP ---------- */
  await go(await urlOf('project-backup.zip'), 2200);
  f = await fr();
  st = await f.evaluate(() => [...document.querySelectorAll('.zv-list tbody tr')].map(r => r.dataset.n));
  ok('ZIP viewer lists the archive', st.length >= 2, JSON.stringify(st));
  await f.click('.zv-list tbody tr >> nth=0');
  await page.waitForTimeout(500);
  st = await f.evaluate(() => document.querySelector('.zv-prev').textContent.length);
  ok('selecting a file previews it', st > 5, st);
  await f.click('.tb .tbtn:has-text("Test")');
  await page.waitForTimeout(500);
  st = await page.evaluate(() => (document.querySelector('.win .win-body') || {}).textContent);
  ok('Test checks every CRC', /No errors detected/.test(st || ''), st);
  await page.click('.win .btn:has-text("OK")');
  await f.click('.zv-list tbody tr >> nth=0');
  await page.keyboard.press('Control+a');
  await f.click('.tb .tbtn:has-text("Extract to My Documents")');
  await page.waitForTimeout(300);
  await page.click('.win .btn:has-text("Extract")');
  await page.waitForTimeout(2500);
  st = await page.evaluate(() => window.LAN.docsAll().filter(d => d.path.startsWith('My Documents/project-backup/')).map(d => d.path.replace('My Documents/project-backup/', '')));
  ok('Extract to My Documents adds the files to your LANscape', st.length === 3, JSON.stringify(st));
  const okBtn = await page.$('.win .btn:has-text("OK")'); if (okBtn) await okBtn.click();
  /* ---------- Font ---------- */
  await go(await urlOf('DejaVuSans-Bold.ttf'), 2200);
  f = await fr();
  st = await f.evaluate(() => ({ h1: document.querySelector('.fv-head h1').textContent, glyphs: /Glyphs\s*(\d+)/.exec(document.querySelector('.fv-head').textContent), loaded: [...document.fonts].some(ff => ff.status === 'loaded' && /LANscapePreview/.test(ff.family)) }));
  ok('Font viewer names the font and loads it', /DejaVu Sans Bold/.test(st.h1) && st.glyphs && +st.glyphs[1] > 1000 && st.loaded, JSON.stringify({ h1: st.h1, glyphs: st.glyphs && st.glyphs[1], loaded: st.loaded }));
  await page.screenshot({ path: OUT + '/C3-font.png' });
  /* ---------- File properties ---------- */
  await go(await urlOf('firmware.bin'), 1800);
  f = await fr();
  st = await f.evaluate(() => ({ hex: (document.querySelector('.hex') || {}).textContent || '', head: (document.querySelector('.props-head b') || {}).textContent }));
  ok('other files get a properties page with a hex dump', st.head === 'firmware.bin' && /^00000000/.test(st.hex), st.hex.slice(0, 60));
  /* ---------- Media viewer for a website's own picture ---------- */
  await go(await urlOf('logo.png'), 1800);
  f = await fr();
  st = await f.evaluate(() => { const i = document.querySelector('.mv-stage img'); return i && { w: i.naturalWidth, fit: i.classList.contains('fit') }; });
  ok('a website\'s picture opens in the Media Viewer', st && st.w === 200 && st.fit, JSON.stringify(st));
  } catch (e) { results.push('FAIL (crashed) ' + e.message.split('\n')[0]); }
  console.log(results.join('\n'));
  if (logs.length) console.log('LOGS:\n' + logs.slice(0, 20).join('\n'));
  console.log(results.filter(r => r.startsWith('PASS')).length + ' passed, ' + results.filter(r => r.startsWith('FAIL')).length + ' failed');
  await browser.close();
})();
