// Adding, folding in, turning off and back on, and removing folders and subfolders, without losing the index.
// Part 1 uses the file picker (no disk access); part 2 uses directory handles (OPFS, same API as Chrome's picker).
const { chromium } = require('./pw');
const http = require('http');
const fs = require('fs');
const path = require('path');
const OUT = process.env.OUT || require('path').join(require('os').tmpdir(), 'lanscape-shots');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (name, cond, extra) => results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  — ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));

// ---------- fixture folders on disk ----------
const T = path.join(__dirname, 'Shelf');
const TW = path.join(__dirname, 'Twins');
for (const d of [T, TW]) fs.rmSync(d, { recursive: true, force: true });
const put = (p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); };
function wav(seconds, freq) {
  const rate = 8000, n = Math.round(rate * seconds), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / rate * freq * 2 * Math.PI) * 9000), 44 + i * 2);
  return b;
}
put(path.join(T, 'welcome.html'), '<title>Welcome to the Shelf</title><h1>The Shelf</h1><p>Everything on one shelf: records, papers and photographs.</p>');
put(path.join(T, 'Music', 'Morning Raga.wav'), wav(1.2, 330));
put(path.join(T, 'Music', 'Evening Blues.wav'), wav(1.5, 220));
put(path.join(T, 'Music', 'liner-notes.html'), '<title>Liner Notes</title><h1>Liner notes</h1><p>Recorded live in the basement studio on a four-track tape deck.</p>');
put(path.join(T, 'Docs', 'budget-report.html'), '<title>Household Budget Report</title><h1>Budget</h1><p>Groceries, utilities, the furnace repair and a new snowblower.</p>');
put(path.join(T, 'Docs', 'reading-list.md'), '# Reading list\n\n- Neuromancer\n- Snow Crash\n- The Cuckoo\'s Egg\n');
put(path.join(T, 'Docs', 'Old', 'ancient-history.html'), '<title>Ancient History</title><p>Floppy disks, dial-up and the sound of a fax machine handshake.</p>');
put(path.join(T, 'Pictures', 'sunset.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="40"><rect width="64" height="40" fill="#f80"/><circle cx="32" cy="30" r="12" fill="#ff0"/></svg>');
put(path.join(TW, 'A', 'Music', 'polka-party.html'), '<title>Polka Party</title><p>Accordion polka night at the lodge.</p>');
put(path.join(TW, 'A', 'Music', 'tuba-tips.html'), '<title>Tuba Tips</title><p>Breathing exercises for tuba players.</p>');
put(path.join(TW, 'B', 'Music', 'synthwave-mix.html'), '<title>Synthwave Mix</title><p>Neon synthwave mixtape for night drives.</p>');
put(path.join(TW, 'B', 'Music', 'drum-machines.html'), '<title>Drum Machines</title><p>The 808 and the 909, side by side.</p>');

const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(fs.readFileSync(path.join(__dirname, '../index.html'))); }).listen(8766);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') logs.push('[console] ' + m.text()); });
  const wait = ms => page.waitForTimeout(ms);
  const idle = () => page.evaluate(() => window.LAN.folderLock(() => null));    // every queued folder job has finished
  const settle = async (ms = 300) => { await idle(); await wait(ms); await idle(); };
  const pick = async dir => { await page.setInputFiles('#dirInput', dir); await wait(300); await settle(400); };
  const state = () => page.evaluate(() => {
    const S = window.LAN.S;
    return { roots: S.roots.map(r => r.name), docs: [...S.docs.values()].filter(d => !d.demo).map(d => d.path).sort(), parked: [...S.parked.keys()].sort(), excluded: S.excluded.slice() };
  });
  const hits = q => page.evaluate(q => window.LAN.search(q).total, q);
  try {
    await page.goto('http://localhost:8766/');
    await wait(1500);
    await page.evaluate(() => { window.showDirectoryPicker = undefined; window.LAN.S.prefs.deep = false; });

    /* ======== part 1: the file picker (no disk access) ======== */
    await pick(path.join(T, 'Music'));
    let s = await state();
    ok('a subfolder goes on first, as its own folder', s.roots.join() === 'Music' && s.docs.length === 3, s);
    // things LANscape learns and you do: spidered text, a rating, a visit, a PDF-style note
    await page.evaluate(async () => {
      const L = window.LAN, S = L.S;
      const notes = S.docs.get('Music/liner-notes.html');
      L.applyDeep(notes, 'Liner notes quokka marmalade zeppelin');
      notes.__tag = 'same-object';
      L.Player.rate('Music/Morning Raga.wav', 4);
      S.visits['Music/liner-notes.html'] = 7;
      await L.DB.put('kv', { k: 'annots:Music/liner-notes.html', v: { list: [{ id: 1, type: 'note', text: 'hi' }] } });
      L.rebuildAll();
    });
    const firstSeen0 = await page.evaluate(() => window.LAN.S.firstSeen['Music/liner-notes.html']);
    ok('spidered words are searchable', (await hits('quokka')) === 1);

    await pick(T);
    s = await state();
    ok('adding the parent folds the subfolder in (one folder, nothing doubled)', s.roots.join() === 'Shelf' && s.docs.length === 8 && s.docs.includes('Shelf/Music/liner-notes.html') && !s.docs.some(p => p.startsWith('Music/')), s);
    let kept = await page.evaluate(async () => {
      const S = window.LAN.S, d = S.docs.get('Shelf/Music/liner-notes.html');
      const ann = await window.LAN.DB.get('kv', 'annots:Shelf/Music/liner-notes.html');
      const oldAnn = await window.LAN.DB.get('kv', 'annots:Music/liner-notes.html');
      return { tag: d && d.__tag, deep: d && d.meta.deep, rating: (S.music['Shelf/Music/Morning Raga.wav'] || {}).rating, oldRating: !!S.music['Music/Morning Raga.wav'], visits: S.visits['Shelf/Music/liner-notes.html'], ann: !!(ann && ann.v.list.length), oldAnn: !!oldAnn, first: S.firstSeen['Shelf/Music/liner-notes.html'] };
    });
    ok('…its files were not read again (same records)', kept.tag === 'same-object', kept);
    ok('…spidered text, rating, visits and notes came along', /quokka/.test(kept.deep || '') && kept.rating === 4 && !kept.oldRating && kept.visits === 7 && kept.ann && !kept.oldAnn && kept.first === firstSeen0, kept);
    ok('…and are still searchable', (await hits('quokka')) === 1);

    // take a subfolder off: gone from search, index kept
    await page.evaluate(() => window.LAN.applyDeep(window.LAN.S.docs.get('Shelf/Docs/budget-report.html'), 'Household budget snowblower furnace kumquat'));
    await page.evaluate(() => window.LAN.setFolderOn('Shelf/Docs/', false));
    s = await state();
    ok('unchecking a subfolder takes it off the LANscape', !s.docs.some(p => p.startsWith('Shelf/Docs/')) && s.parked.length === 3 && s.excluded.join() === 'Shelf/Docs/', s);
    ok('…its words drop out of search', (await hits('kumquat')) === 0 && (await hits('snowblower')) === 0);
    await page.evaluate(() => window.LAN.go('http://home.lanscape.net/'));
    await wait(600);
    await page.reload();
    await wait(1800);
    await page.evaluate(() => { window.showDirectoryPicker = undefined; window.LAN.S.prefs.deep = false; });
    s = await state();
    ok('after a restart it is still off, and still parked', s.parked.length === 3 && !s.docs.some(p => p.startsWith('Shelf/Docs/')) && (await hits('kumquat')) === 0, s);
    kept = await page.evaluate(() => { const S = window.LAN.S; return { rating: (S.music['Shelf/Music/Morning Raga.wav'] || {}).rating, deep: (S.docs.get('Shelf/Music/liner-notes.html') || { meta: {} }).meta.deep }; });
    ok('…and the folded-in folder kept its index across the restart', kept.rating === 4 && /quokka/.test(kept.deep || ''), kept);
    await page.evaluate(() => window.LAN.setFolderOn('Shelf/Docs/', true));
    await settle();
    ok('checking it again brings it back instantly, spidered text and all', (await hits('kumquat')) === 1 && (await state()).parked.length === 0);

    // nested switches remember themselves
    await page.evaluate(async () => { await window.LAN.setFolderOn('Shelf/Docs/Old/', false); await window.LAN.setFolderOn('Shelf/Docs/', false); await window.LAN.setFolderOn('Shelf/Docs/', true); });
    s = await state();
    ok('a subfolder you turned off stays off when its parent comes back', s.excluded.join() === 'Shelf/Docs/Old/' && s.parked.join() === 'Shelf/Docs/Old/ancient-history.html' && s.docs.includes('Shelf/Docs/budget-report.html'), s);

    // the same folder again = a re-sync; files in turned-off folders aren't read
    await pick(T);
    s = await state();
    ok('picking the same folder again re-syncs it (no second copy)', s.roots.join() === 'Shelf' && s.docs.length === 7 && s.parked.length === 1, s);
    // a folder inside it
    await pick(path.join(T, 'Docs'));
    s = await state();
    const st1 = await page.$eval('#sbMsg', e => e.textContent);
    ok('adding a folder that is already inside one refreshes it in place', s.roots.join() === 'Shelf' && s.docs.length === 7 && /already part of Shelf/.test(st1), st1);
    // turning Old back on in the same session: its file is ready to open
    await page.evaluate(() => window.LAN.setFolderOn('Shelf/Docs/Old/', true));
    await settle();
    const anc = await page.evaluate(async () => { const d = window.LAN.S.docs.get('Shelf/Docs/Old/ancient-history.html'); return d && (await window.LAN.getText(d)).includes('fax machine'); });
    ok('a parked file opens as soon as its folder is back on', anc === true);

    // two different folders with the same name
    await pick(path.join(TW, 'A', 'Music'));
    s = await state();
    ok('a new folder named Music joins (the old Music lives inside Shelf now)', s.roots.join() === 'Shelf,Music', s);
    await page.setInputFiles('#dirInput', path.join(TW, 'B', 'Music'));
    await page.waitForSelector('.win .btn:has-text("Different Folder")', { timeout: 4000 });
    await page.screenshot({ path: OUT + '/F0-same-name.png' });
    await page.click('.win .btn:has-text("Different Folder")');
    await settle(500);
    s = await state();
    ok('a different folder with the same name is added next to it, not over it', s.roots.join() === 'Shelf,Music,Music (2)' && s.docs.includes('Music (2)/synthwave-mix.html') && s.docs.includes('Music/polka-party.html'), s.roots);

    // the Folder Manager
    await page.click('#bOpen');
    await page.waitForSelector('.fm-tree .fm-row');
    let rows = await page.$$eval('.fm-row', rs => rs.map(r => r.dataset.p));
    ok('the Folders button opens the Folder Manager with every folder', ['Shelf/', 'Music/', 'Music (2)/', 'Shelf/Docs/', 'Shelf/Music/'].every(p => rows.includes(p)) && rows.includes('demo:'), rows);
    await page.click('.fm-row[data-p="Shelf/Pictures/"] .fm-cb');
    await settle();
    s = await state();
    ok('unchecking a folder in the manager parks it', s.excluded.includes('Shelf/Pictures/') && s.parked.includes('Shelf/Pictures/sunset.svg'), s.excluded);
    const ui = await page.evaluate(() => ({ checked: document.querySelector('.fm-row[data-p="Shelf/Pictures/"] .fm-cb').checked, partly: document.querySelector('.fm-row[data-p="Shelf/"] .fm-cb').indeterminate, status: document.querySelector('.fm-row[data-p="Shelf/Pictures/"] .fm-st').textContent, sum: document.querySelector('.fm-sum').textContent }));
    ok('…and shows it unchecked, its parent partly on', !ui.checked && ui.partly && /Off/.test(ui.status) && /index kept/.test(ui.sum), ui);
    await page.screenshot({ path: OUT + '/F1-folder-manager.png' });
    // keyboard: select the Pictures row and press Space to bring it back
    await page.click('.fm-row[data-p="Shelf/Pictures/"] .fm-nm');
    await page.keyboard.press('Space');
    await settle();
    s = await state();
    ok('Space turns the selected folder back on', !s.excluded.includes('Shelf/Pictures/') && s.docs.includes('Shelf/Pictures/sunset.svg'), s.excluded);
    // Remove, keeping the index
    await page.click('.fm-row[data-p="Music (2)/"] .fm-nm');
    await page.click('#fmRemove');
    await page.waitForSelector('.win .btn:has-text("Remove")');
    await page.click('.win:last-child .btn:has-text("Remove")');
    await settle();
    s = await state();
    ok('Remove (keep its index) turns the whole folder off', s.roots.includes('Music (2)') && s.excluded.includes('Music (2)/') && s.parked.includes('Music (2)/synthwave-mix.html'), s);
    // Remove, forgetting it
    await page.click('.fm-row[data-p="Music/"] .fm-nm');
    await page.click('#fmRemove');
    await page.waitForSelector('input[name=rmHow][value=forget]');
    await page.check('input[name=rmHow][value=forget]');
    await page.click('.win:last-child .btn:has-text("Remove")');
    await settle();
    s = await state();
    const dbGone = await page.evaluate(async () => !(await window.LAN.DB.get('meta', 'Music/polka-party.html')));
    ok('Remove (forget) deletes that folder and its index', !s.roots.includes('Music') && !s.docs.some(p => p.startsWith('Music/')) && dbGone, s.roots);
    await page.keyboard.press('Escape');
    await wait(200);

    // restart: everything is as we left it
    await page.reload();
    await wait(1800);
    s = await state();
    ok('after a restart: folders, switches and parked index are as you left them', s.roots.join() === 'Shelf,Music (2)' && s.excluded.join() === 'Music (2)/' && s.parked.length === 2 && s.docs.length === 8, s);

    /* ======== part 2: directory handles (Chrome and Edge) ======== */
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      try { await root.removeEntry('Garage', { recursive: true }); } catch (e) { /* first run */ }
      const g = await root.getDirectoryHandle('Garage', { create: true });
      const put = async (d, name, text) => { const fh = await d.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(text); await w.close(); };
      const tires = await g.getDirectoryHandle('Tires', { create: true });
      const brakes = await g.getDirectoryHandle('Brakes', { create: true });
      await put(g, 'garage-log.html', '<title>Garage Log</title><p>Oil, filters and a new battery.</p>');
      await put(tires, 'rotation.html', '<title>Tire Rotation</title><p>Rotate every five thousand miles.</p>');
      await put(tires, 'pressure.html', '<title>Tire Pressure</title><p>Thirty-five psi cold.</p>');
      await put(brakes, 'pads.html', '<title>Brake Pads</title><p>Ceramic brake pads squeal less.</p>');
      window.__g = g; window.__tires = tires; window.__brakes = brakes; window.__put = put;
    });
    await page.evaluate(() => window.LAN.mountFolder({ handle: window.__tires }));
    await settle();
    s = await state();
    ok('[disk] a subfolder goes on as its own folder', s.roots.includes('Tires') && s.docs.includes('Tires/rotation.html'), s.roots);
    await page.evaluate(() => { const d = window.LAN.S.docs.get('Tires/rotation.html'); window.LAN.applyDeep(d, 'Tire rotation wombat'); d.__tag = 'kept'; });
    await page.evaluate(() => window.LAN.mountFolder({ handle: window.__g }));
    await settle();
    s = await state();
    kept = await page.evaluate(() => { const d = window.LAN.S.docs.get('Garage/Tires/rotation.html'); return { tag: d && d.__tag, deep: d && d.meta.deep, handles: [...window.LAN.S.rootHandles.keys()] }; });
    ok('[disk] adding the parent folds it in (the browser says they are related)', s.roots.includes('Garage') && !s.roots.includes('Tires') && kept.tag === 'kept' && /wombat/.test(kept.deep || '') && !kept.handles.includes('Tires'), { roots: s.roots, kept });
    await page.evaluate(() => window.LAN.mountFolder({ handle: window.__tires }));
    await settle();
    s = await state();
    ok('[disk] the subfolder again is refreshed inside Garage, not added twice', !s.roots.includes('Tires') && /already part of Garage/.test(await page.$eval('#sbMsg', e => e.textContent)), s.roots);
    await page.evaluate(() => window.LAN.mountFolder({ handle: window.__g }));
    await settle();
    s = await state();
    ok('[disk] the same folder again is a re-sync', s.roots.filter(r => r.startsWith('Garage')).length === 1, s.roots);
    // turn Brakes off; files added to it while it's off show up when it comes back
    await page.evaluate(() => window.LAN.setFolderOn('Garage/Brakes/', false));
    await page.evaluate(() => window.__put(window.__brakes, 'rotors.html', '<title>Brake Rotors</title><p>Resurface or replace warped rotors.</p>'));
    await page.evaluate(() => window.LAN.resyncFolder('Garage/', { quiet: true }));
    await settle();
    s = await state();
    ok('[disk] re-sync skips a folder that is off and keeps its parked index', s.parked.includes('Garage/Brakes/pads.html') && !s.docs.includes('Garage/Brakes/rotors.html') && !s.parked.includes('Garage/Brakes/rotors.html'), s.parked);
    await page.evaluate(() => window.LAN.setFolderOn('Garage/Brakes/', true));
    await settle(600);
    s = await state();
    ok('[disk] turning it back on catches up with changes made while it was off', s.docs.includes('Garage/Brakes/pads.html') && s.docs.includes('Garage/Brakes/rotors.html'), s.docs.filter(p => p.startsWith('Garage')));
    // a file deleted on disk goes away when its subfolder is re-synced
    await page.evaluate(() => window.__tires.removeEntry('pressure.html'));
    await page.evaluate(() => window.LAN.resyncFolder('Garage/Tires/', { quiet: true }));
    await settle();
    s = await state();
    ok('[disk] re-syncing one subfolder drops files deleted from it, and nothing else', !s.docs.includes('Garage/Tires/pressure.html') && s.docs.includes('Garage/Tires/rotation.html') && s.docs.includes('Garage/garage-log.html'), s.docs.filter(p => p.startsWith('Garage')));
    // the Folder Manager knows Garage can be re-read by itself
    await page.evaluate(() => window.LAN.FolderManager.open('Garage/'));
    await page.waitForSelector('.fm-row[data-p="Garage/"]');
    await wait(400);
    const live = await page.$eval('.fm-row[data-p="Garage/"] .fm-st', e => e.textContent);
    ok('[disk] the manager shows Garage as Live', live === 'Live', live);
    await page.screenshot({ path: OUT + '/F2-folder-manager-disk.png' });
    await page.keyboard.press('Escape');
    // phone width
    await page.setViewportSize({ width: 390, height: 780 });
    await page.evaluate(() => window.LAN.FolderManager.open());
    await page.waitForSelector('.fm-row');
    await wait(300);
    const fit = await page.evaluate(() => { const w = document.querySelector('.fm-tree').closest('.win').getBoundingClientRect(); return w.left >= 0 && w.right <= innerWidth + 1; });
    ok('the Folder Manager fits a phone screen', fit);
    await page.screenshot({ path: OUT + '/F3-folder-manager-phone.png' });
  } catch (e) { results.push('FAIL (crashed) ' + e.message.split('\n')[0]); }
  console.log(results.join('\n'));
  const bad = logs.filter(l => !/allow-same-origin/.test(l));
  if (bad.length) console.log('LOGS:\n' + bad.slice(0, 20).join('\n'));
  console.log(results.filter(r => r.startsWith('PASS')).length + ' passed, ' + results.filter(r => r.startsWith('FAIL')).length + ' failed');
  await browser.close();
  server.close();
})();
