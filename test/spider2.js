// The Spider reads PDFs, probes videos and thumbnails big pictures too.
const { chromium } = require('./pw');
const path = require('path');
const results = [];
const ok = (name, cond, extra) => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  — ' + extra : '')); };
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  try {
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window.showDirectoryPicker = undefined; });
  await page.setInputFiles('#dirInput', path.join(__dirname, 'AllTypes'));
  let offered = null;
  for (let i = 0; i < 40; i++) { offered = await page.$('.win .btn:has-text("Send out the Spider")'); if (offered) break; await page.waitForTimeout(200); }
  const txt = await page.evaluate(() => (document.querySelector('.win .win-body') || {}).textContent || '');
  ok('the Spider is offered for pages and files', !!offered && /pages and files/.test(txt), txt.slice(-80));
  await offered.click();
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(500); if (!(await page.evaluate(() => window.LAN.Spider.running))) break; }
  const st = await page.evaluate(() => {
    const d = window.LAN.docsAll().find(x => x.name === 'Spec Sheet 480V UPS.pdf');
    const v = window.LAN.docsAll().filter(x => x.kind === 'video' && x.ext === 'webm');
    return { deep: d.meta.deepFor === d.mtime, thumb: window.LAN.S.thumbs.has(d.path), body: /Double-conversion efficiency/.test(d.meta.deep || ''), videos: v.map(x => x.meta.probedFor === x.mtime && x.meta.duration > 5) };
  });
  ok('PDF text read and page-1 preview painted', st.deep && st.thumb && st.body, JSON.stringify(st));
  ok('videos probed for posters and length', st.videos.length === 2 && st.videos.every(Boolean), JSON.stringify(st.videos));
  // search now finds words that are only inside the PDF's later pages
  await page.evaluate(() => window.LAN.go('http://www.hyperhound.com/search?q=ECO+mode+efficiency'));
  await page.waitForTimeout(2000);
  const f = await (await page.$('#frame')).contentFrame();
  const hit = await f.evaluate(() => document.body.textContent.includes('Spec Sheet'));
  ok('HyperHound finds words from inside the PDF', hit);
  } catch (e) { results.push('FAIL (crashed) ' + e.message.split('\n')[0]); }
  console.log(results.join('\n'));
  if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
  console.log(results.filter(r => r.startsWith('PASS')).length + ' passed, ' + results.filter(r => r.startsWith('FAIL')).length + ' failed');
  await browser.close();
})();
