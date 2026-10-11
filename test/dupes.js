// Duplicates and versions: copies, revisions, look-alikes, songs/videos/pictures, website folders, and the names.
// Uses test/Workbench (make it with: python3 test/make-workbench.py).
const { chromium } = require('./pw');
const http = require('http');
const fs = require('fs');
const path = require('path');
const OUT = process.env.OUT || require('path').join(require('os').tmpdir(), 'lanscape-shots');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (name, cond, extra) => results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  — ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''));
const WB = path.join(__dirname, 'Workbench');
if (!fs.existsSync(WB)) { console.error('Run python3 test/make-workbench.py first'); process.exit(2); }
const PORT = 8781;
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(fs.readFileSync(path.join(__dirname, '../index.html'))); }).listen(PORT);

(async () => {
  // a UTF-8 locale, like a real desktop: Chromium needs it for file names such as "Tracker — Rev 3.html"
  const browser = await chromium.launch({ env: Object.assign({}, process.env, { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }) });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') logs.push('[console] ' + m.text()); });
  page.on('crash', () => logs.push('[crash]'));
  const wait = ms => page.waitForTimeout(ms);
  const idle = () => page.evaluate(() => window.LAN.folderLock(() => null));
  const go = async (u, ms = 700) => { await page.evaluate(u => window.LAN.go(u), u); await wait(ms); };
  const groups = () => page.evaluate(() => Array.from(window.LAN.S.folds.values()).map(g => ({
    cls: g.cls, reason: g.reason, whole: !!g.whole, primary: g.primary.path.replace(/^Workbench\//, ''),
    members: g.members.map(d => d.path.replace(/^Workbench\//, '')), labels: g.members.map(d => d.vlabel)
  })));
  const find = (gs, p) => gs.find(g => g.members.includes(p));
  try {
    await page.goto('http://localhost:' + PORT + '/');
    await wait(1500);
    await page.evaluate(() => { window.showDirectoryPicker = undefined; window.LAN.S.prefs.deep = false; });
    await page.setInputFiles('#dirInput', WB);
    await wait(500); await idle(); await wait(800);
    for (let i = 0; i < 10; i++) { const n = await page.$('.win .btn:has-text("Not Now")'); if (n) { await n.click(); break; } await wait(200); }
    // the fingerprints for same-size files and same-name pictures arrive in the background
    await page.evaluate(() => window.LAN.Fingerprinter.run());
    await wait(600); await idle(); await wait(400);

    /* ---------- which files fold together ---------- */
    let gs = await groups();
    const expectGroup = (name, member, primary, n, extra) => {
      const g = find(gs, member);
      ok(name, !!g && g.primary === primary && g.members.length === n && (!extra || extra(g)), g || 'no group');
    };
    expectGroup('Rev 1..3 are one entry, Rev 3 main', 'Tools/Cayenne/Cayenne_958_Tracker_Rev1.html', 'Tools/Cayenne/Cayenne 958 Tracker — Rev 3.html', 3, g => g.labels.join() === 'Rev 1,Rev 2,Rev 3');
    expectGroup('v1, v2, v3_final: v3 main', 'Tools/Poker/Deep Run Tournament Trainer v1.html', 'Tools/Poker/Deep_Run_Tournament_Trainer_v3_final.html', 3);
    expectGroup('Rev 4, Rev 5, Rev6 (mixed spellings)', 'Tools/Crucible/Crucible Rev 4.html', 'Tools/Crucible/Crucible_Rev6.html', 3);
    expectGroup('download copies "(1)" and Downloads/ are exact copies; the plain name wins', 'Cruise/Coral Duchess Meal Planner (1).html', 'Cruise/Coral Duchess Meal Planner.html', 3, g => g.reason === 'copy');
    expectGroup('"Copy of" is a copy of the original', 'Cruise/Copy of Coral Duchess Dining Schedule.html', 'Cruise/Coral Duchess Dining Schedule.html', 2, g => g.reason === 'copy');
    expectGroup('Study_3 and Study_4: _4 main', 'Downloads/MoE_256GB_Build_Study_3.html', 'Downloads/MoE_256GB_Build_Study_4.html', 2);
    expectGroup('weekly dashboards: Week 5 main, labeled by week', 'Fantasy/Fantasy Matchup Dashboard Week 4.html', 'Fantasy/Fantasy Matchup Dashboard Week 5.html', 2, g => g.labels.join() === 'Week 4,Week 5');
    expectGroup('an edited "- Copy" that is newer becomes main', 'Italy/Italy Trip.html', 'Italy/Italy Trip - Copy.html', 2);
    expectGroup('a revision saved under a longer name elsewhere folds in, newest main', 'Tools/Cayenne/Cayenne Fuel Log.html', 'Downloads/Cayenne Diesel Fuel Log.html', 2);
    expectGroup('Spec Review and v2 (.docx)', 'Docs/Spec Review.docx', 'Docs/Spec Review v2.docx', 2);
    expectGroup('Budget and Budget (1) (.xlsx) are copies', 'Docs/LAN Party Budget (1).xlsx', 'Docs/LAN Party Budget.xlsx', 2, g => g.reason === 'copy');
    expectGroup('a copied website folder folds whole', 'Site copy/index.html', 'Site/index.html', 2, g => g.whole && g.reason === 'copy');
    expectGroup('MP3 + FLAC + backup MP3 = one song, FLAC main', 'Music/The Hypertext Kids - Dial Tone Serenade.mp3', 'Music/Lossless/Dial Tone Serenade.flac', 3);
    expectGroup('WebM + MKV of one episode = one video, WebM main', 'Videos/Old Rips/Oil Change S01E01.mkv', 'Videos/Oil Change S01E01.webm', 2);
    expectGroup('beach, beach (1), beach_small = one picture', 'Pictures/beach_small.jpg', 'Pictures/beach.jpg', 3);
    for (const p of ['Cruise/Mini-Suite B210 Cabin Dossier.html', 'Cruise/Mini-Suite B212 Cabin Dossier.html', 'Italy/Rome Days.html', 'Italy/Venice Days.html', 'Tools/Cayenne/notes.html', 'Tools/Poker/notes.html',
      'Pictures/sunset.jpg', 'Videos/Oil Change S01E02.webm', 'Music/The Hypertext Kids - Packet Loss.mp3', 'Fantasy/Fantasy Draft Board.html', 'Tools/Crucible/Crucible Prompt Library.html', 'Site/about.html'])
      ok('stays separate: ' + p, !find(gs, p) || (p === 'Site/about.html' && false), find(gs, p));
    ok('nothing else folded', gs.length === 15, gs.length + ' groups');

    /* ---------- one entry everywhere ---------- */
    const lists = await page.evaluate(() => {
      const L = window.LAN, S = L.S;
      const r1 = L.search('cayenne tracker'), r2 = L.search('cayenne tracker', { all: true });
      const titles = S.sites.map(s => s.title);
      return {
        hits: r1.results.map(r => r.doc.path.replace(/^Workbench\//, '')), more: r1.results.map(r => r.more || 0), omitted: r1.omitted,
        allHits: r2.results.map(r => r.doc.path.replace(/^Workbench\//, '')),
        siteTitles: titles, dupTitles: titles.filter((t, i) => titles.indexOf(t) !== i),
        shown: L.docsShown().length, all: L.docsAll().length,
        songs: L.docsShown().filter(d => d.kind === 'audio' && !d.demo).length, videos: L.docsShown().filter(d => d.kind === 'video' && !d.demo).length, pics: L.docsShown().filter(d => d.kind === 'image' && !d.demo).length
      };
    });
    ok('search shows Rev 3 once, not Rev 1 or Rev 2', lists.hits.includes('Tools/Cayenne/Cayenne 958 Tracker — Rev 3.html') && !lists.hits.some(p => /Rev[12]\.html$/.test(p)), lists.hits.slice(0, 6));
    ok('search says how many it folded', lists.omitted >= 2, lists.omitted);
    ok('search with every copy shows the old revisions', lists.allHits.some(p => /Rev1\.html$/.test(p)));
    ok('no two sites with the same title', !lists.dupTitles.length, lists.dupTitles);
    ok('generic "Notes" pages borrow their folder name', lists.siteTitles.includes('Cayenne Notes') && lists.siteTitles.includes('Poker Notes'), lists.siteTitles.filter(t => /notes/i.test(t)));
    ok('a folded page is listed by its plain name', lists.siteTitles.includes('Cayenne 958 Tracker') && lists.siteTitles.includes('Deep Run Tournament Trainer') && lists.siteTitles.includes('Fantasy Matchup Dashboard'), lists.siteTitles);
    ok('one song, video and picture each (+ the different ones)', lists.songs === 2 && lists.videos === 2 && lists.pics === 2, [lists.songs, lists.videos, lists.pics]);

    /* ---------- names: rings, badges, domains ---------- */
    const names = await page.evaluate(() => window.LAN.S.rings.map(r => ({ name: r.name, badge: r.badge, lead: r.lead, cat: r.cat && r.cat.name, terms: r.terms, sites: r.sites.length })));
    const JUNK = /csstext|innerhtml|00pm|\b\d+(st|nd|rd|th|pm|am|h)\b|workbench|downloads|copy\b/i;
    ok('no junk words in ring names', names.every(r => !JUNK.test(r.name)), names.map(r => r.name));
    ok('badges are whole words, 11 characters at most', names.every(r => r.badge.length <= 11 && r.badge.split(' ').every(w => r.lead.toUpperCase().includes(w) || r.badge === 'WANDERERS' || !/[AEIOU]/.test(w.slice(1)))), names.map(r => r.badge));
    ok('ring names come from what the pages are about', ['Cayenne', 'Poker', 'Cruise', 'Italy', 'Fantasy', 'Crucible'].every(w => names.some(r => r.name.includes(w))), names.map(r => r.name));
    ok('every ring has a directory category', names.every(r => r.cat), names.map(r => r.cat));
    ok('the Cayenne ring is filed under Autos, Poker under Games', names.find(r => /Cayenne/.test(r.name)).cat === 'Autos' && names.find(r => /Poker/.test(r.name)).cat === 'Games & Poker', names.map(r => r.name + ': ' + r.cat));
    const hosts = await page.evaluate(() => window.LAN.S.sites.map(s => s.host));
    ok('no junk in domain names', hosts.every(h => !/copy|final|rev\d|v\d\b|\(1\)|^www\.site\.|^www\.notes\./.test(h)), hosts);

    /* ---------- version addresses ---------- */
    await go('http://www.cayenne958tracker.net/versions/1', 900);
    let st = await page.evaluate(() => ({ path: window.LAN.S.cur.doc && window.LAN.S.cur.doc.path, url: window.LAN.S.cur.url, bar: !document.querySelector('#verbar').hidden && document.querySelector('#verbar').textContent, ring: document.querySelector('#ringstrip').textContent }));
    ok('/versions/1 opens Rev 1', /Rev1\.html$/.test(st.path || ''), st.path);
    ok('the version bar says which one it is', /Rev 1/.test(st.bar || '') && /Newest Version/.test(st.bar || ''), st.bar);
    ok('an older version sits in its main page\'s ring', /Cayenne/.test(st.ring), st.ring.slice(0, 80));
    await page.screenshot({ path: path.join(OUT, 'dupes-verbar.png') });
    await page.click('#verbar [data-v="newer"]'); await wait(800);
    st = await page.evaluate(() => window.LAN.S.cur.doc.path);
    ok('Newer goes to Rev 2', /Rev2\.html$/.test(st), st);
    await page.click('#verbar [data-v="newest"]'); await wait(800);
    st = await page.evaluate(() => ({ path: window.LAN.S.cur.doc.path, url: window.LAN.S.cur.url, bar: document.querySelector('#verbar').hidden, btn: !!document.querySelector('#ringstrip [data-site="versions"]') }));
    ok('Newest goes to the main page, at the plain address, without the bar', /Rev 3\.html$/.test(st.path) && st.url === 'http://www.cayenne958tracker.net/' && st.bar, st);
    ok('the main page has a Versions button', st.btn);
    await page.click('#ringstrip [data-site="versions"]'); await wait(900);
    st = await page.evaluate(() => ({ url: window.LAN.S.cur.url, title: window.LAN.S.cur.title }));
    ok('Versions opens the version history', st.url === 'http://www.cayenne958tracker.net/versions/' && /Versions of/.test(st.title), st);
    const vtext = await page.frameLocator('#frame').locator('body').innerText();
    ok('the history lists all three', /Rev 1/.test(vtext) && /Rev 2/.test(vtext) && /Rev 3/.test(vtext) && /Make main/.test(vtext), vtext.slice(0, 200));
    await page.screenshot({ path: path.join(OUT, 'dupes-history.png') });
    await go('http://www.cayenne958tracker.net/versions/3', 700);
    st = await page.evaluate(() => window.LAN.S.cur.url);
    ok('/versions/3 (the main one) goes to the plain address', st === 'http://www.cayenne958tracker.net/', st);
    await go('http://www.homebrewaiclub.org/versions/2/', 800);
    st = await page.evaluate(() => window.LAN.S.cur.doc && window.LAN.S.cur.doc.path);
    ok('a copied website opens at /versions/2/', st === 'Workbench/Site copy/index.html', st);
    await go('http://www.homebrewaiclub.org/versions/2/about.html', 800);
    st = await page.evaluate(() => window.LAN.S.cur.doc && window.LAN.S.cur.doc.path);
    ok('...and its other pages under it', st === 'Workbench/Site copy/about.html', st);
    const aboutUrl = await page.evaluate(() => window.LAN.S.docs.get('Workbench/Site copy/about.html').url);
    ok('pages in a copied website get /versions/2/ addresses', aboutUrl === 'http://www.homebrewaiclub.org/versions/2/about.html', aboutUrl);

    /* ---------- HyperHound ---------- */
    await go('http://www.hyperhound.com/search?q=cayenne+tracker', 900);
    let ht = await page.frameLocator('#frame').locator('body').innerText();
    ok('HyperHound links the older versions', /2 older versions/.test(ht), ht.slice(0, 400));
    ok('HyperHound says it folded some', /folded \d+ cop/.test(ht));
    await go('http://www.hyperhound.com/search?q=cayenne+tracker&fold=0', 900);
    ht = await page.frameLocator('#frame').locator('body').innerText();
    ok('...and shows every file on request', /Showing every copy/.test(ht) && /Rev 1/.test(ht), ht.slice(0, 300));

    /* ---------- the Duplicate Finder ---------- */
    await go('http://dupes.lanscape.net/', 1200);
    const fr = page.frameLocator('#frame');
    const nG = await fr.locator('.dp-g').count();
    ok('the Duplicate Finder lists every group', nG === 15, nG);
    await fr.locator('.dp-g', { hasText: 'Cayenne 958 Tracker' }).click(); await wait(300);
    const rows = await fr.locator('.dp-m tbody tr').count();
    ok('a group shows its files', rows === 3, rows);
    await page.screenshot({ path: path.join(OUT, 'dupes-finder.png') });
    await fr.locator('.dp-m tbody tr').nth(0).click();
    await fr.locator('.tbtn', { hasText: 'Compare' }).click(); await wait(1200);
    st = await page.evaluate(() => window.LAN.S.cur.url);
    ok('Compare opens a diff', /compare\?a=/.test(st), st);
    const diff = await fr.locator('table.cp tr.add, table.cp tr.chg, table.cp tr.del').count();
    ok('the diff marks changed lines', diff > 0, diff);
    await page.screenshot({ path: path.join(OUT, 'dupes-compare.png') });
    await fr.locator('.tbtn', { hasText: 'Source' }).click(); await wait(800);
    const diff2 = await fr.locator('table.cp tr.add, table.cp tr.chg, table.cp tr.del').count();
    ok('source view diffs the HTML', diff2 > 0, diff2);
    await fr.locator('.tbtn', { hasText: 'Inline' }).click(); await wait(600);
    ok('inline view', await fr.locator('table.cp td.mk').count() > 0);

    /* ---------- your corrections ---------- */
    const rev1 = 'Workbench/Tools/Cayenne/Cayenne_958_Tracker_Rev1.html', rev2 = 'Workbench/Tools/Cayenne/Cayenne_958_Tracker_Rev2.html';
    await page.evaluate(p => window.LAN.foldKeep(p), rev2); await wait(300);
    st = await page.evaluate(p => ({ main: window.LAN.S.docs.get(p).fold.primary.path, url: window.LAN.S.docs.get(p).url }), rev2);
    ok('Make Main puts Rev 2 up front at the plain address', st.main === rev2 && st.url === 'http://www.cayenne958tracker.net/', st);
    await page.evaluate(() => { const r = window.LAN.S.foldRules; r.keep = []; window.LAN.rebuildAll(); });
    await page.evaluate(p => window.LAN.foldSplit(p), rev1); await wait(700);
    st = await page.evaluate(p => ({ folded: window.LAN.isFolded(window.LAN.S.docs.get(p)), fold: !!window.LAN.S.docs.get(p).fold, url: window.LAN.S.docs.get(p).url }), rev1);
    ok('Not the Same gives Rev 1 its own address', !st.fold && !/versions/.test(st.url), st);
    // still split after a restart
    await page.reload(); await wait(2500); await idle(); await wait(800);
    st = await page.evaluate(p => { const d = window.LAN.S.docs.get(p); return d ? { fold: !!d.fold, rules: window.LAN.S.foldRules.split.length } : null; }, rev1);
    ok('...and it stays that way after a restart', st && !st.fold && st.rules === 1, st);
    gs = await groups();
    ok('the rest of the groups come back after a restart', gs.length === 15, gs.length);
    await page.evaluate(p => window.LAN.foldUnsplit(p), rev1); await wait(300);
    st = await page.evaluate(p => window.LAN.isFolded(window.LAN.S.docs.get(p)), rev1);
    ok('Put Back folds it in again', st === true);

    /* ---------- you know better: fold two things together, then take it back ---------- */
    const rome = 'Workbench/Italy/Rome Days.html', venice = 'Workbench/Italy/Venice Days.html';
    await go('http://www.hyperhound.com/related?url=' + encodeURIComponent(await page.evaluate(p => window.LAN.S.docs.get(p).url, rome)), 900);
    const relText = await page.frameLocator('#frame').locator('body').innerText();
    ok('Similar pages offer Compare', /Compare/.test(relText), relText.slice(0, 160));
    await go('http://dupes.lanscape.net/compare?a=' + encodeURIComponent(rome) + '&b=' + encodeURIComponent(venice), 1200);
    await page.frameLocator('#frame').locator('.tbtn', { hasText: 'Fold Together' }).click(); await wait(900);
    st = await page.evaluate(([a, b]) => { const A = window.LAN.S.docs.get(a), B = window.LAN.S.docs.get(b); return { same: !!A.fold && A.fold === B.fold, reason: A.fold && A.fold.reason }; }, [rome, venice]);
    ok('Fold Together makes two pages one entry', st.same && st.reason === 'manual', st);
    await page.frameLocator('#frame').locator('.tbtn', { hasText: 'Not the Same' }).click(); await wait(500);
    await page.click('.win .btn:has-text("Keep Separate")'); await wait(900);
    st = await page.evaluate(([a, b]) => { const A = window.LAN.S.docs.get(a), B = window.LAN.S.docs.get(b); return { a: !!A.fold, b: !!B.fold, rules: window.LAN.S.foldRules }; }, [rome, venice]);
    ok('...and Not the Same takes it back', !st.a && !st.b, st);
    await page.evaluate(() => { const r = window.LAN.S.foldRules; r.split = []; r.join = []; window.LAN.rebuildAll(); });

    /* ---------- folding off ---------- */
    st = await page.evaluate(() => { const S = window.LAN.S; S.prefs.fold = 'off'; window.LAN.rebuildAll(); const r = { groups: S.folds.size, shown: window.LAN.docsShown().length, all: window.LAN.docsAll().length, sites: S.sites.length }; S.prefs.fold = 'normal'; window.LAN.rebuildAll(); r.sitesOn = S.sites.length; return r; });
    ok('folding off shows every file', st.groups === 0 && st.shown === st.all && st.sites > st.sitesOn, st);
    st = await page.evaluate(() => { const S = window.LAN.S; S.prefs.fold = 'copies'; window.LAN.rebuildAll(); const r = Array.from(S.folds.values()).map(g => g.reason); S.prefs.fold = 'normal'; window.LAN.rebuildAll(); return r; });
    ok('"exact copies only" folds only copies', st.length > 0 && st.every(r => r === 'copy'), st);

    /* ---------- home page ---------- */
    await go('http://home.lanscape.net/', 900);
    const home = await page.frameLocator('#frame').locator('body').innerText();
    ok('the home page directory is grouped by category', /Travel & Vacations/.test(home) && /Autos/.test(home), home.slice(0, 200));
    ok('the home page counts what was folded', /Copies and old versions/.test(home));
    await page.screenshot({ path: path.join(OUT, 'dupes-home.png') });
  } catch (e) {
    ok('test ran without throwing', false, e.stack || e.message);
  }
  ok('no page errors', !logs.length, logs.slice(0, 8));
  console.log(results.join('\n'));
  const fails = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\n' + (results.length - fails) + ' passed, ' + fails + ' failed');
  await browser.close();
  server.close();
  process.exit(fails ? 1 : 0);
})();
