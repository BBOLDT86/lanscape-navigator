// MKV playback through the converter (Media Source Extensions) in a real browser, and Rewind's fallback to it.
const { chromium } = require('./pw');
const http = require('http');
const fs = require('fs');
const path = require('path');
const OUT = process.env.OUT || require('path').join(require('os').tmpdir(), 'lanscape-shots');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (name, cond, extra) => results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  — ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(fs.readFileSync(path.join(__dirname, '../index.html'))); }).listen(8767);
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') logs.push('[console] ' + m.text()); });
  const wait = ms => page.waitForTimeout(ms);
  try {
    await page.goto('http://localhost:8767/');
    await wait(1500);
    await page.evaluate(() => { window.showDirectoryPicker = undefined; window.LAN.S.prefs.deep = false; });
    await page.setInputFiles('#dirInput', path.join(__dirname, 'Movies'));
    await wait(2500);
    await page.evaluate(() => window.LAN.folderLock(() => null));
    const n = await page.evaluate(() => [...window.LAN.S.docs.values()].filter(d => d.ext === 'mkv').length);
    ok('the MKV files are on the LANscape', n >= 11, n);

    /* ---- the converter on its own ---- */
    const play = await page.evaluate(async () => {
      const L = window.LAN, d = [...L.S.docs.values()].find(x => x.name === 'long_vp9.mkv');
      const p = await L.MkvPlayer.open(await L.getBlob(d));
      const v = document.createElement('video');
      v.muted = true; v.style.cssText = 'position:fixed;right:0;bottom:0;width:240px;z-index:99';
      document.body.append(v);
      window.__p = p; window.__v = v;
      await p.attach(v, 0);
      await v.play();
      await new Promise(r => setTimeout(r, 2500));
      return { t: v.currentTime, w: v.videoWidth, h: v.videoHeight, dur: v.duration, src: v.src.slice(0, 5), info: p.info, audio: v.webkitAudioDecodedByteCount || 0, problem: p.problem };
    });
    ok('a VP9/Opus MKV plays through the converter', play.src === 'blob:' && play.t > 1.2 && play.w === 480 && play.h === 270 && play.dur > 74 && play.dur < 76 && !play.problem, play);
    ok('…with sound', play.audio > 1000, play.audio);
    const jump = await page.evaluate(async () => {
      const v = window.__v;
      v.currentTime = 50;
      await new Promise(r => setTimeout(r, 3000));
      const b = []; for (let i = 0; i < v.buffered.length; i++) b.push([+v.buffered.start(i).toFixed(1), +v.buffered.end(i).toFixed(1)]);
      return { t: v.currentTime, paused: v.paused, buffered: b, err: v.error && v.error.code };
    });
    ok('jumping ahead to 0:50 keeps playing from there', jump.t > 50.5 && jump.t < 56 && !jump.paused && !jump.err, jump);
    const back = await page.evaluate(async () => {
      const v = window.__v;
      v.currentTime = 5;
      await new Promise(r => setTimeout(r, 2500));
      return { t: v.currentTime, paused: v.paused };
    });
    ok('…and back to 0:05', back.t > 5.3 && back.t < 9, back);
    const ended = await page.evaluate(async () => {
      const v = window.__v;
      v.currentTime = 72;
      await new Promise(r => { v.addEventListener('ended', r, { once: true }); setTimeout(r, 9000); });
      return { ended: v.ended, t: v.currentTime, state: window.__p.ms.readyState };
    });
    ok('…and to the end, where the video ends properly', ended.ended && ended.t > 74 && ended.state === 'ended', ended);
    await page.evaluate(() => { window.__p.detach(); window.__v.remove(); });

    // subtitles stored in the file
    const subs = await page.evaluate(async () => {
      const L = window.LAN, d = [...L.S.docs.values()].find(x => x.name === 'vp9_opus.mkv');
      const p = await L.MkvPlayer.open(await L.getBlob(d));
      const v = document.createElement('video'); v.muted = true; document.body.append(v);
      await p.attach(v, 0);
      v.textTracks[0].mode = 'hidden';
      await v.play();
      await new Promise(r => setTimeout(r, 1800));
      const tr = v.textTracks[0];
      const out = { tracks: v.textTracks.length, label: tr.label, cues: tr.cues ? Array.from(tr.cues).map(c => [+c.startTime.toFixed(2), c.text]) : null };
      p.detach(); v.remove();
      return out;
    });
    ok('subtitles stored in the MKV become a subtitle track', subs.tracks === 1 && subs.cues && subs.cues.length === 2 && subs.cues[0][1] === 'Hello, world\nsecond line' && Math.abs(subs.cues[0][0] - 1) < 0.05, subs);

    // a live recording (no index): a jump lands on the next keyframe and plays
    const live = await page.evaluate(async () => {
      const L = window.LAN, d = [...L.S.docs.values()].find(x => x.name === 'long_live.mkv');
      const p = await L.MkvPlayer.open(await L.getBlob(d));
      const v = document.createElement('video'); v.muted = true; document.body.append(v);
      await p.attach(v, 0);
      await v.play();
      await new Promise(r => setTimeout(r, 800));
      v.currentTime = 41;
      await new Promise(r => setTimeout(r, 3500));
      const out = { t: v.currentTime, paused: v.paused, dur: v.duration };
      p.detach(); v.remove();
      return out;
    });
    ok('a file with no index still jumps (to the nearest keyframe) and plays', live.t > 41 && live.t < 47 && !live.paused && live.dur > 74, live);

    /* ---- Rewind ---- */
    const urlOf = name => page.evaluate(n => [...window.LAN.S.docs.values()].find(x => x.name === n).url, name);
    const fr = async () => (await page.$('#frame')).contentFrame();
    // forced through the converter (Chromium in this test would play VP9 itself)
    await page.evaluate(() => { window.LAN.mkvDirect = true; });
    await page.evaluate(u => window.LAN.go(u), await urlOf('vp9_opus.mkv'));
    await wait(3500);
    let f = await fr();
    let st = await f.evaluate(() => { const v = document.querySelector('.rwp video'); return v && { src: v.src.slice(0, 5), t: v.currentTime, w: v.videoWidth, bad: !!document.querySelector('.rwp .bad'), tracks: v.textTracks.length }; });
    ok('Rewind plays an MKV through the converter', st && st.src === 'blob:' && st.t > 1 && st.w === 320 && !st.bad && st.tracks === 1, st);
    await f.click('.rwp button[aria-label="Subtitles and speed"]');
    await wait(300);
    const menu = await f.evaluate(() => Array.from(document.querySelectorAll('.rwp .menu button')).map(b => b.textContent));
    ok('…and its subtitle menu lists the subtitles inside the file', menu.includes('Subtitles'), menu);
    await f.click('.rwp .menu button:has-text("Subtitles")');
    await page.evaluate(() => { const fr2 = document.querySelector('#frame').contentDocument.querySelector('.rwp video'); fr2.currentTime = 5.2; });
    await wait(1500);
    const shown = await f.evaluate(() => document.querySelector('.rwp .subs').textContent);
    ok('…and shows them on screen', /Commas, in, text/.test(shown), shown);
    await page.screenshot({ path: OUT + '/M0-rewind-mkv.png' });
    await page.evaluate(() => { window.LAN.mkvDirect = false; });
    // an MKV this browser can't decode at all: the reason is spelled out
    await page.evaluate(u => window.LAN.go(u), await urlOf('hevc_ac3.mkv'));
    await wait(4000);
    f = await fr();
    const bad = await f.evaluate(() => { const b = document.querySelector('.rwp .bad'); return b ? b.textContent : null; });
    ok('an MKV this browser can\'t decode says exactly why (H.265)', bad && /H\.265 \(HEVC\)/.test(bad) && /Safari/.test(bad), bad);
    await page.screenshot({ path: OUT + '/M1-rewind-hevc.png' });
    // a file an older LANscape had written off is looked at again
    const relook = await page.evaluate(async () => {
      const L = window.LAN, d = [...L.S.docs.values()].find(x => x.name === 'av1_opus.mkv');
      d.meta.playable = false; d.meta.probedFor = d.mtime; delete d.meta.probeV; delete d.meta.via;
      const before = L.videoProbed(d);
      await L.learnVideo(d);
      return { before, after: L.videoProbed(d), playable: d.meta.playable, dur: Math.round(d.meta.duration), poster: !!(await L.MThumbs.get('poster:' + d.path, d.mtime)) };
    });
    ok('MKV files an older version gave up on are looked at again', relook.before === false && relook.after === true && relook.playable === true && relook.dur === 12 && relook.poster, relook);
    // the converter paints posters too
    const poster = await page.evaluate(async () => {
      const L = window.LAN, d = [...L.S.docs.values()].find(x => x.name === 'long_vp9.mkv');
      d.meta.via = 'mkv';
      const info = await L.probeVideo(d, true);
      return { via: info.via, playable: info.playable, w: info.width, poster: (info.poster || '').slice(0, 15), dur: Math.round(info.duration) };
    });
    ok('posters for MKV files come through the converter', poster.via === 'mkv' && poster.playable && poster.w === 480 && poster.poster === 'data:image/jpeg' && poster.dur === 75, poster);
  } catch (e) { results.push('FAIL (crashed) ' + e.message.split('\n')[0]); }
  console.log(results.join('\n'));
  const bad = logs.filter(l => !/allow-same-origin/.test(l));
  if (bad.length) console.log('LOGS:\n' + bad.slice(0, 20).join('\n'));
  console.log(results.filter(r => r.startsWith('PASS')).length + ' passed, ' + results.filter(r => r.startsWith('FAIL')).length + ' failed');
  await browser.close();
  server.close();
})();
