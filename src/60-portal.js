/* ===================================================================
   Generated sites: LANscape Home, HyperHound, RingHub, Netropolis,
   per-site Links + Guestbook, 404s and about: pages
   =================================================================== */
const BASE_CSS = `body{margin:8px;font:16px/1.3 "Times New Roman",Times,"Liberation Serif",serif;color:#000;background:#fff}
a{color:#0000ee}a:visited,a.v{color:#551a8b}a:active{color:#ee0000}
.sans{font-family:Arial,Helvetica,"Liberation Sans",sans-serif}.small{font-size:12px}.tiny{font-size:11px}
img.b88{width:88px;height:31px;image-rendering:pixelated;border:0;vertical-align:middle}
table.grid{border-collapse:collapse}table.grid th{background:#000080;color:#fff;font:bold 12px Arial,Helvetica,sans-serif;padding:4px 8px;text-align:left}
table.grid td{border-bottom:1px solid #ccc;padding:4px 8px;font:13px Arial,Helvetica,sans-serif;vertical-align:top}
.pv{display:block;width:120px;height:90px;object-fit:cover;object-position:top;border:1px solid #808080;background:#eee}
.pvbox{display:flex;align-items:center;justify-content:center;text-align:center;width:120px;height:90px;border:1px solid #808080;font:bold 11px/1.2 Verdana,Arial,sans-serif;padding:6px;box-sizing:border-box;overflow:hidden}
.btnlink{display:inline-block;padding:6px 14px;background:#c0c0c0;color:#000;text-decoration:none;font:bold 13px Arial,sans-serif;border:2px outset #fff}
.btnlink:active{border-style:inset}
.foot{margin-top:24px;text-align:center;color:#555;font:11px Arial,Helvetica,sans-serif}
code,tt,pre{font-family:"Courier New",Courier,monospace}`;
function page(title, body, opt = {}) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + BASE_CSS + (opt.css || '') + '</style></head><body' + (opt.attrs ? ' ' + opt.attrs : '') + '>' + body + '</body></html>';
}
const vcls = url => (S.visited.has(url) ? ' class="v"' : '');
const A = (url, text, extra = '') => '<a href="' + esc(url) + '"' + vcls(url) + extra + '>' + text + '</a>';
const sitesAll = () => S.sites;
const docsAll = () => (S.ix ? S.ix.docs : []);
// lists show one entry per set of copies and versions (the main one)
const webDocs = () => docsShown().filter(isSiteKind);
const hasUser = () => S.sites.some(s => !s.demo);
function isNewDoc(d) { const f = S.firstSeen[d.path] || d.mtime; return Date.now() - f < 7 * 864e5; }
function isUpdDoc(d) { return !isNewDoc(d) && Date.now() - (d.mtime || 0) < 7 * 864e5; }
function badges(d) {
  let b = '';
  if (isNewDoc(d)) b += '<span class="newbadge">NEW!</span>';
  else if (isUpdDoc(d)) b += '<span class="updbadge">UPDATED</span>';
  if ((S.visits[d.path] || 0) >= 10) b += '<span class="coolbadge">COOL</span>';
  return b;
}
const KIND_COLOR = { pdf: '#c62828', docx: '#2b579a', legacy: '#2b579a', rtf: '#6b4fbb', md: '#444444', text: '#666666', sheet: '#217346', slides: '#d24726', code: '#00838f', audio: '#7b3fbf', video: '#222222', image: '#3a6ea5', archive: '#8a6d00', font: '#444444', other: '#777777' };
function preview(d, w = 120, h = 90) {
  const t = S.thumbs.get(d.path) || (d.kind === 'audio' && d.meta.artKey ? S.thumbs.get('art:' + d.meta.artKey) : null);
  if (t) return '<img class="pv" src="' + t + '" alt="" style="width:' + w + 'px;height:' + h + 'px">';
  if (d.kind !== 'html') {
    const c = KIND_COLOR[d.kind] || '#777';
    return '<span class="pvbox" style="width:' + w + 'px;height:' + h + 'px;background:#fff;color:#222;border-top:14px solid ' + c + ';flex-direction:column;gap:4px"><b style="color:' + c + ';font-size:13px">' + esc(badgeFor(d)) + '</b>' + esc(clip(d.meta.title, 44)) + '</span>';
  }
  const pal = d.meta.palette || [];
  const c = pal[0] || RETRO[hash32(d.path) % RETRO.length];
  const bg = d.meta.paletteBg && /^#/.test(d.meta.paletteBg) ? d.meta.paletteBg : '#ffffff';
  return '<span class="pvbox" style="width:' + w + 'px;height:' + h + 'px;background:' + esc(bg) + ';color:' + esc(c) + ';border-top:8px solid ' + esc(c) + '">' + esc(clip(d.meta.title, 60)) + '</span>';
}
function dailyPick(salt = 0, day = dayKey()) {
  const docs = sitesAll().map(s => s.index);
  if (!docs.length) return null;
  const pool = hasUser() ? docs.filter(d => !d.demo) : docs;
  return pool[hash32(day + ':' + salt) % pool.length];
}
function topVisited(n) {
  return webDocs().filter(d => S.visits[d.path]).sort((a, b) => S.visits[b.path] - S.visits[a.path]).slice(0, n);
}
function totals() {
  const docs = webDocs();
  return {
    sites: sitesAll().length, pages: docs.length, rings: S.rings.length, files: docsAll().length, folded: S.foldStats ? S.foldStats.folded : 0,
    words: docs.reduce((a, d) => a + Math.max(d.meta.words || 0, d.meta.deepWords || 0), 0), bytes: docs.reduce((a, d) => a + (d.size || 0), 0),
    terms: S.ix ? S.ix.df.size : 0
  };
}
const NAV_LINKS = () => [['http://home.lanscape.net/', 'Home'], ['http://home.lanscape.net/new', "What's New"], ['http://home.lanscape.net/cool', "What's Cool"],
  ['http://www.ringhub.org/', 'Web Rings'], ['http://www.hyperhound.com/', 'HyperHound'], ['http://home.lanscape.net/dir/', 'Directory'],
  ['http://home.lanscape.net/hotlist', 'Hotlist'], ['http://home.lanscape.net/help', 'Help']];
function lanNav(active) {
  return '<div class="lnav">' + NAV_LINKS().map(([u, t]) => t === active ? '<b>' + t + '</b>' : A(u, t)).join(' | ') + '</div>';
}
function badgeRow() {
  return '<p style="text-align:center;margin-top:22px">' + ['now', 'ringhub', 'hound', 'spider', 'y2k', 'res', 'hand'].map(k => '<img class="b88" src="' + BADGES[k]() + '" alt="">').join(' ') + '</p>';
}

/* ---------------- LANscape Home ---------------- */
const HOME_CSS = `body{background:#fff;font:13px/1.35 Arial,Helvetica,"Liberation Sans",sans-serif;margin:0}
.wrap{max-width:980px;margin:0 auto;padding:10px 12px}
.mast{display:flex;gap:12px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap}
.mast svg{max-width:100%;height:auto;display:block;border:1px solid #000}
.mast .meta{font-size:12px;text-align:right;color:#333}
.lnav{background:#000066;color:#fff;padding:5px 8px;margin:8px 0;font:bold 12px Arial,sans-serif}
.lnav a{color:#ffff99}.lnav a.v{color:#ffcc66}.lnav b{color:#fff;text-decoration:underline}
marquee{background:#ffffcc;border:1px solid #cc9;padding:3px 0;font:12px Arial,sans-serif}
.search{background:#e8e8ff;border:1px solid #99c;padding:10px;margin:10px 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.search input[type=text]{flex:1;min-width:180px;font:14px Arial,sans-serif;padding:3px}
.welcome{border:3px double #c00;background:#fff8e1;padding:12px 14px;margin:10px 0}
.welcome h2{margin:0 0 6px;color:#c00;font:bold 20px Georgia,"Times New Roman",serif}
.cols{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:14px;margin-top:6px}
@media (max-width:760px){.cols{grid-template-columns:1fr}}
h2.sec{font:bold 14px Arial,sans-serif;background:#336699;color:#fff;padding:4px 8px;margin:10px 0 6px}
.dir{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;padding:0 4px}
@media (max-width:520px){.dir{grid-template-columns:1fr}}
.dir .cat a{font-weight:bold;font-size:14px}.dir .sub{display:block;font-size:11.5px;color:#444}.dir .sub a{font-weight:normal;font-size:11.5px}
.dir .glyph{display:inline-block;width:18px;color:#c00}
.box{border:1px solid #888;margin-bottom:12px;background:#fdfdfd}
.box .bh{background:linear-gradient(#ffcc33,#ff9900);color:#000;font:bold 13px Arial,sans-serif;padding:4px 8px;border-bottom:1px solid #888}
.box .bb{padding:8px}
.box ul{margin:0;padding-left:18px}.box li{margin:3px 0}
.hot{display:flex;gap:10px;align-items:flex-start}
.stat{border-collapse:collapse;width:100%}.stat td{border-bottom:1px dotted #bbb;padding:3px 6px}.stat td:last-child{text-align:right;font-weight:bold}
.mini{font-size:11px;color:#666}
.progs{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px}
.progs a{display:flex;flex-direction:column;align-items:center;gap:3px;text-decoration:none;color:#000;font-size:11px;text-align:center;padding:3px}
.progs a:hover span{background:#000080;color:#fff}
.progs svg{width:32px;height:32px}`;
function portalHome(path, q) {
  if (path === '/' || path === '/index.html') return { title: 'LANscape Home', html: homePage() };
  if (path === '/new') return { title: "What's New on your LANscape", html: newPage() };
  if (path === '/cool') return { title: "What's Cool?", html: coolPage() };
  if (path === '/hotlist') return { title: 'The Ultimate Hotlist', html: hotlistPage() };
  if (path === '/help') return { title: 'LANscape Help: The Internet for Beginners', html: helpPage() };
  if (path === '/dir' || path === '/dir/') return { title: 'LANscape Directory', html: dirIndexPage() };
  if (path === '/programs' || path === '/programs/') return { title: 'Program Manager', html: programsPage() };
  const m = /^\/dir\/([^/]+)\/?$/.exec(path);
  if (m) { const r = S.ringById.get(decodeURIComponent(m[1])); if (r) return { title: 'LANscape Directory: ' + r.name, html: dirPage(r) }; }
  return null;
}
function homePage() {
  const t = totals(), now = Date.now();
  const hot = dailyPick();
  const recent = webDocs().sort((a, b) => (b.mtime || 0) - (a.mtime || 0)).slice(0, 7);
  const lib = libraryCounts();
  const cool = topVisited(5);
  const rings = S.rings;
  const ticker = [
    t.sites + ' sites on ' + t.rings + ' web rings',
    hot ? 'Hot Spot of the Day: ' + hot.meta.title : '',
    recent[0] ? 'Latest update: ' + recent[0].meta.title + ' (' + ago(recent[0].mtime) + ')' : '',
    'HyperHound has indexed ' + t.terms.toLocaleString() + ' unique words',
    S.roots.length ? 'Folders online: ' + S.roots.filter(r => !exclusionOf(r.name + '/')).map(r => r.name).join(', ') : 'Open a folder to build your own Internet'
  ].filter(Boolean).map(s => '&#9733; ' + esc(s)).join(' &nbsp; &nbsp; ');
  let welcome = '';
  if (!hasUser()) {
    welcome = `<div class="welcome"><h2>Build your own Internet in one click</h2>
<p>Point LANscape at a folder: web pages, Word and Excel files, PDFs, songs, videos and pictures. Every page gets its own domain name, similar pages are linked into <b>web rings</b>, <b>HyperHound</b> indexes every word, and each file opens in a program of its own, so you can surf it all like it's 1998.</p>
<p>${A('lanscape:open-folder', '<span class="btnlink">Open a Folder...</span>')} &nbsp; ${A('http://home.lanscape.net/help', 'How does it work?')}</p>
<p class="mini">Right now you're surfing the <b>Demo Web</b>: ${t.sites} sample sites on ${t.rings} rings, plus demo songs, videos, pictures and documents to try every program. Nothing ever leaves your computer.</p></div>`;
  }
  const dir = dirCategories().map(({ cat, rings: rs, n }) => {
    const sub = rs.map(r => A('http://home.lanscape.net/dir/' + r.id, esc(r.name)) + ' <span class="mini">(' + r.sites.length + ')</span>').join(', ');
    return '<div class="cat"><span class="glyph">' + cat.glyph + '</span><b>' + esc(cat.name) + '</b> <span class="mini">(' + n + ')</span><span class="sub">' + sub + '</span></div>';
  }).join('');
  const roots = S.roots.map(r => {
    const off = exclusionOf(r.name + '/');
    return '<tr><td>Folder <b>' + esc(r.name) + '</b></td><td>' + (off ? 'off' : (r.files || 0).toLocaleString() + ' files') + '</td></tr><tr><td class="mini" colspan="2">' +
      (off ? 'Taken off your LANscape (index kept)' : (r.name === VROOT ? 'Kept in this browser' : 'Synced ' + esc(fmtDate(r.loadedAt, true))) + (r.off ? ' &middot; ' + r.off.toLocaleString() + ' files in folders that are off' : '')) +
      ' &middot; ' + (r.name !== VROOT && !off ? A('lanscape:resync', 'Re-sync') + ' &middot; ' : '') + A('lanscape:folders', 'Manage') + '</td></tr>';
  }).join('');
  return page('LANscape Home', `<div class="wrap">
<div class="mast"><div>${lanscapeBanner()}</div><div class="meta">Today is <b>${esc(fmtDate(now))}</b><br>${t.sites} sites &middot; ${t.pages} pages &middot; ${t.rings} rings<br>${A('lanscape:add-folder', 'Add Folder...')} &middot; ${A('lanscape:folders', 'Manage Folders...')}</div></div>
${lanNav('Home')}
<marquee scrollamount="4">${ticker}</marquee>
${welcome}
<form class="search" action="http://www.hyperhound.com/search"><b>Search your LANscape:</b><input type="text" name="q" size="36" aria-label="Search"><input type="submit" value="HyperHound It!"> ${A('http://www.hyperhound.com/tips', 'tips', ' class="mini"')}</form>
<div class="cols"><div>
<h2 class="sec">LANscape Directory &mdash; ${rings.length} Web Rings</h2>
<div class="dir">${dir || '<p>No rings yet.</p>'}</div>
<h2 class="sec">Your Internet at a Glance</h2>
<table class="stat"><tr><td>Web sites</td><td>${t.sites}</td></tr><tr><td>Pages</td><td>${t.pages}</td></tr><tr><td>Web rings</td><td>${t.rings}</td></tr>
<tr><td>Words of hypertext</td><td>${t.words.toLocaleString()}</td></tr><tr><td>Total size</td><td>${fmtBytes(t.bytes)}</td></tr><tr><td>Unique words indexed</td><td>${t.terms.toLocaleString()}</td></tr>
<tr><td>Page previews captured</td><td>${docsAll().filter(d => S.thumbs.has(d.path)).length}</td></tr>
<tr><td>${A('http://www.hyperhound.com/search?t=docs&q=', 'Documents')} (Word, PDF, spreadsheets...)</td><td>${lib.documents}</td></tr>
<tr><td>${A('http://music.lanscape.net/', 'Songs')}</td><td>${lib.songs}</td></tr><tr><td>${A('http://www.rewindvideo.com/', 'Videos')}</td><td>${lib.videos}</td></tr>
<tr><td>${A('http://photos.lanscape.net/', 'Pictures')}</td><td>${lib.pictures}</td></tr><tr><td>Other files on ${S.ftpHosts.size} FTP server${S.ftpHosts.size === 1 ? '' : 's'}</td><td>${lib.files}</td></tr>
${t.folded ? '<tr><td>' + A('http://dupes.lanscape.net/', 'Copies and old versions') + ' <span class="mini">(folded away)</span></td><td>' + t.folded + '</td></tr>' : ''}${roots}</table>
</div><div>
${hot ? `<div class="box"><div class="bh">&#9728; Hot Spot of the Day</div><div class="bb hot">${A(hot.url, preview(hot, 120, 90))}<div><b>${A(hot.url, esc(hot.meta.title))}</b><br><span class="mini">${esc(displayUrl(hot.url))}</span><p style="margin:4px 0">${esc(clip(hot.meta.desc, 150))}</p>${A(hot.url, 'Visit it!')}</div></div></div>` : ''}
<div class="box"><div class="bh">&#9654; Programs</div><div class="bb"><div class="progs">${PROGRAMS.map(p => A(p.url, PROG_ICON[p.id] + '<span>' + esc(progName(p)) + '</span>', ' title="' + esc(progBlurb(p)) + '"')).join('')}</div><p class="mini" style="margin:6px 0 0">${A('http://home.lanscape.net/programs', 'Program Manager...')} &middot; ${Array.from(S.ftpHosts.keys()).slice(0, 3).map(h => A('ftp://' + h + '/', esc(h))).join(' &middot; ')}</p></div></div>
<div class="box"><div class="bh">What's New?</div><div class="bb"><ul>${recent.map(d => '<li>' + A(d.url, esc(clip(d.meta.title, 60))) + ' ' + badges(d) + ' <span class="mini">' + esc(ago(d.mtime)) + '</span></li>').join('')}</ul><p class="mini">${A('http://home.lanscape.net/new', 'More new stuff...')}</p></div></div>
<div class="box"><div class="bh">What's Cool?</div><div class="bb">${cool.length ? '<ol style="margin:0;padding-left:20px">' + cool.map(d => '<li>' + A(d.url, esc(clip(d.meta.title, 54))) + ' <span class="mini">(' + S.visits[d.path] + ' visits)</span></li>').join('') + '</ol>' : '<p class="mini">Visit some pages and the coolest will show up here.</p>'}<p class="mini">${A('http://home.lanscape.net/cool', 'More cool sites...')}</p></div></div>
<div class="box"><div class="bh">Webmaster Tools</div><div class="bb"><ul><li>${A('lanscape:folders', 'Manage Folders')} <span class="mini">(add folders, turn subfolders on and off)</span></li><li>${A('lanscape:spider', 'Send out the Spider')} <span class="mini">(deep index + previews)</span></li><li>${A('lanscape:dns', 'DNS Manager')} <span class="mini">(rename domains)</span></li><li>${A('lanscape:rings', 'Ring Manager')} <span class="mini">(move sites between rings)</span></li><li>${A('http://dupes.lanscape.net/', 'Duplicate Finder')} <span class="mini">(copies and versions${t.folded ? ': ' + t.folded + ' folded' : ''})</span></li><li>${A('lanscape:prefs', 'Preferences')}</li><li>${A('about:cache', 'Disk cache')}</li></ul></div></div>
</div></div>
${badgeRow()}
<p class="foot">Copyright &copy; 1996&ndash;${new Date().getFullYear()} You. All rights reserved. &middot; LANscape Navigator ${VERSION} &middot; Best viewed at 800&times;600 or higher.</p></div>`, { css: HOME_CSS });
}
function newPage() {
  const docs = webDocs().sort((a, b) => (b.mtime || 0) - (a.mtime || 0)).slice(0, 150);
  const rows = docs.map(d => '<tr><td><tt>' + esc(fmtShort(d.mtime)) + '</tt></td><td>' + (d.kind !== 'html' ? '<b class="mini">[' + esc(badgeFor(d)) + ']</b> ' : '') + A(d.url, '<b>' + esc(d.meta.title) + '</b>') + ' ' + badges(d) + '<br><span class="mini">' + esc(displayUrl(d.url)) + '</span></td><td>' + (d.site && d.site.ring ? A('http://home.lanscape.net/dir/' + d.site.ring.id, esc(d.site.ring.name)) : '') + '</td><td>' + fmtK(d.size) + '</td></tr>').join('');
  return page("What's New", `<div class="wrap">${lanNav("What's New")}
<h1 style="font:bold 28px Georgia,serif;color:#c00"><span class="newbadge">NEW!</span> What's New on your LANscape</h1>
<p>Fresh pages and recent updates, newest first. A page wears the <span class="newbadge">NEW!</span> badge for a week after it first shows up, and <span class="updbadge">UPDATED</span> after you change it.</p>
<table class="grid" width="100%"><tr><th>Date</th><th>Page</th><th>Web Ring</th><th>Size</th></tr>${rows}</table>
${badgeRow()}</div>`, { css: HOME_CSS });
}
function coolPage() {
  const top = topVisited(10);
  const picks = [], seen = new Set();
  for (let i = 0; i < 12 && picks.length < 5; i++) { const d = dailyPick(100 + i); if (d && !seen.has(d.path)) { seen.add(d.path); picks.push(d); } }
  const hist = [];
  for (let i = 0; i < 7; i++) { const day = dayKey(Date.now() - i * 864e5); const d = dailyPick(0, day); if (d) hist.push([day, d]); }
  return page("What's Cool?", `<div class="wrap">${lanNav("What's Cool")}
<h1 style="font:bold 28px Georgia,serif;color:#0066cc">&#9733; What's Cool? &#9733;</h1>
<h2 class="sec">Top 10 Most Visited</h2>${top.length ? '<ol>' + top.map(d => '<li>' + A(d.url, '<b>' + esc(d.meta.title) + '</b>') + ' &mdash; <span class="lan-odo">' + String(S.visits[d.path]).padStart(4, '0').split('').map(x => '<b>' + x + '</b>').join('') + '</span></li>').join('') + '</ol>' : '<p>Nobody has visited anything yet. Go surf!</p>'}
<h2 class="sec">Today's Cool Picks</h2><table cellpadding="6">${picks.map(d => '<tr><td>' + A(d.url, preview(d, 96, 72)) + '</td><td>' + A(d.url, '<b>' + esc(d.meta.title) + '</b>') + '<br><span class="mini">' + esc(clip(d.meta.desc, 160)) + '</span></td></tr>').join('')}</table>
<h2 class="sec">Hot Spot of the Day: the Archive</h2><ul>${hist.map(([day, d]) => '<li><tt>' + day + '</tt> &mdash; ' + A(d.url, esc(d.meta.title)) + '</li>').join('')}</ul>
${badgeRow()}</div>`, { css: HOME_CSS });
}
function hotlistPage() {
  const blocks = S.rings.map(r => '<h2 style="font:bold 16px Arial,sans-serif;color:#ffff66;margin:18px 0 6px">' + '<img class="b88" src="' + ringButton(r) + '" alt=""> ' + esc(r.name) + '</h2><div class="wall">' +
    r.sites.map(s => A(s.url, '<img class="b88" src="' + siteButton(s) + '" alt="' + esc(s.title) + '" title="' + esc(s.title) + '">')).join(' ') + '</div>').join('');
  return page('The Ultimate Hotlist', `<center><font face="Impact,Arial Black,Arial" size="7" color="#ff00ff">THE ULTIMATE HOTLIST</font><br><font face="Arial" color="#00ffff">Every site on your LANscape, one 88&times;31 button each. Click one!</font></center>
<div style="max-width:900px;margin:0 auto">${blocks}</div><hr class="rainbow"><center><font face="Arial" size="2">${A('http://home.lanscape.net/', 'Back to LANscape Home')}</font></center>${badgeRow()}`,
  { attrs: 'class="bg-stars" text="#ffffff" link="#00ffff" vlink="#ff99ff"', css: '.wall{display:flex;flex-wrap:wrap;gap:6px}.wall a{line-height:0}body{font-family:Arial,sans-serif}a{color:#00ffff}a.v{color:#ff99ff}' });
}
/** the directory's top level: categories (Travel, Autos...) with their rings, biggest first */
function dirCategories() {
  const by = new Map();
  for (const r of S.rings) {
    const c = r.cat || { id: 'misc', name: 'Miscellaneous', glyph: '★' };
    let e = by.get(c.id);
    if (!e) by.set(c.id, e = { cat: c, rings: [], n: 0 });
    e.rings.push(r); e.n += r.sites.length;
  }
  for (const e of by.values()) e.rings.sort((a, b) => b.sites.length - a.sites.length || a.name.localeCompare(b.name));
  return Array.from(by.values()).sort((a, b) => (a.cat.id === 'misc') - (b.cat.id === 'misc') || b.n - a.n || a.cat.name.localeCompare(b.cat.name));
}
function dirIndexPage() {
  const blocks = dirCategories().map(({ cat, rings: rs, n }) => '<h2 class="sec">' + cat.glyph + ' ' + esc(cat.name) + ' <span style="font-weight:normal">(' + n + ' site' + (n === 1 ? '' : 's') + ')</span></h2><div class="dir">' +
    rs.map(r => '<div class="cat">' + A('http://home.lanscape.net/dir/' + r.id, esc(r.name)) + ' <span class="mini">(' + r.sites.length + ')</span><span class="sub">' + esc((r.terms || []).slice(0, 5).join(', ')) + '</span></div>').join('') + '</div>').join('');
  return page('LANscape Directory', `<div class="wrap">${lanNav('Directory')}
<h1 style="font:bold 24px Arial,sans-serif">LANscape Directory</h1><p class="mini">Top : Categories</p>
${blocks || '<p>No rings yet.</p>'}${badgeRow()}</div>`, { css: HOME_CSS });
}
function dirPage(r) {
  const related = S.rings.filter(x => x !== r).map(x => [x, cos(r.vec, x.vec)]).sort((a, b) => b[1] - a[1]).slice(0, 4).filter(x => x[1] > 0.01);
  const items = r.sites.slice().sort((a, b) => a.title.localeCompare(b.title)).map(s => {
    const d = s.index;
    const g = d.fold && d.fold.primary === d && d.fold.members.length > 1 ? d.fold : null;
    const more = (s.docs.length > 1 ? ' <span class="mini">(' + s.docs.length + ' pages)</span>' : '') + (g ? ' <span class="mini">[' + A(s.url + 'versions/', g.members.length + ' ' + (g.reason === 'copy' ? 'copies' : 'versions')) + ']</span>' : '');
    return '<li>' + A(s.url, '<b>' + esc(s.title) + '</b>') + more + ' ' + badges(d) + ' &mdash; ' + esc(clip(d.meta.desc, 180)) + '<br><span class="mini" style="color:#008000">' + esc(displayUrl(s.url)) + '</span></li>';
  }).join('');
  return page('Directory: ' + r.name, `<div class="wrap">${lanNav('Directory')}
<form class="search" action="http://www.hyperhound.com/search"><input type="text" name="q" size="30" aria-label="Search"><input type="hidden" name="ring" value="${esc(r.id)}"><input type="submit" value="Search this category"></form>
<p class="mini">${A('http://home.lanscape.net/', 'Top')} : ${A('http://home.lanscape.net/dir/', esc((r.cat && r.cat.name) || 'Web Rings'))} : <b>${esc(r.name)}</b></p>
<h1 style="font:bold 22px Arial,sans-serif">${r.glyph} ${esc(r.name)}</h1>
<p>${r.sites.length} site${r.sites.length === 1 ? '' : 's'} about <i>${esc((r.terms || []).slice(0, 5).join(', '))}</i>. ${A('http://www.ringhub.org/ring/' + r.id, 'Visit this ring\'s hub at RingHub')}.</p>
<ul class="dirlist" style="line-height:1.45">${items}</ul>
${related.length ? '<h3 style="font:bold 14px Arial,sans-serif">Related Categories</h3><ul>' + related.map(([x]) => '<li>' + A('http://home.lanscape.net/dir/' + x.id, esc(x.name)) + ' <span class="mini">(' + x.sites.length + ')</span></li>').join('') + '</ul>' : ''}
${badgeRow()}</div>`, { css: HOME_CSS });
}
function helpPage() {
  const k = (a, b) => '<tr><td><tt>' + a + '</tt></td><td>' + b + '</td></tr>';
  return page('Help', `<div class="wrap">${lanNav('Help')}
<h1 style="font:bold 28px Georgia,serif">The Internet for Beginners</h1>
<p><b>LANscape Navigator</b> turns a folder of HTML files on your computer into a small, private 1990s Internet. Nothing is uploaded anywhere: the files are read by your browser, indexed in your browser, and cached in your browser's own storage.</p>
<h2 class="sec">1. Add your folders</h2><p>Use <b>File &gt; Add Folder</b>, the ${A('lanscape:add-folder', 'Add Folder...')} link, or drag folders onto the window. Subfolders are included. Add as many folders as you like: each one joins the others and nothing already on your LANscape is read again. Add a folder that holds one you already have (your whole Documents folder after your Music folder, say) and the smaller one is folded in, with its search text, previews, ratings and notes intact.</p>
<p>${A('lanscape:folders', 'Manage Folders')} shows every folder as a tree. Uncheck a folder or subfolder to take it off your LANscape. LANscape keeps everything it learned about those files, so checking it again brings them back instantly. <b>Remove</b> takes a whole folder away, keeping its index or forgetting it, your choice. In Chrome and Edge, LANscape can re-read folders by itself (<b>Re-sync</b>) so edits show up; other browsers ask you to pick the folder again, and only what changed is read.</p>
<h2 class="sec">2. Domain names (DNS)</h2><p>Every page gets a web address made from its title, like <tt>www.cayennetracker.com</tt>. A subfolder that contains an <tt>index.html</tt> becomes one multi-page website. Rename any domain in the ${A('lanscape:dns', 'DNS Manager')}, or pin one from inside the page with <tt>&lt;meta name="lanscape:host" content="www.mysite.com"&gt;</tt>. Prefer old-school addresses? Switch <b>Options &gt; Preferences &gt; Domain style</b> to Netropolis neighborhoods or ~tilde member pages.</p>
<h2 class="sec">3. Web rings</h2><p>LANscape reads every page, measures how similar each pair is (TF-IDF over titles, headings, text and even the strings inside scripts), and links neighbors into rings with a community-detection pass. Use the ring bar under the page to go <b>Prev / Random / Next</b>. Move sites or rename rings in the ${A('lanscape:rings', 'Ring Manager')}, or pin a page with <tt>&lt;meta name="lanscape:ring" content="My Ring"&gt;</tt>.</p>
<h2 class="sec">4. Searching with HyperHound</h2><p>Type words in the Location bar or at ${A('http://www.hyperhound.com/', 'HyperHound')}. Results show matching words in bold, a <b>Cached</b> text copy and <b>Similar pages</b>. Tricks: <tt>"exact phrase"</tt>, <tt>-exclude</tt>, <tt>site:cayenne</tt>, <tt>ring:poker</tt>, <tt>intitle:planner</tt>, and <tt>OR</tt>. ${A('http://www.hyperhound.com/tips', 'All search tips')}.</p>
<h2 class="sec">5. The Spider</h2><p>Many single-file apps build their text with JavaScript. ${A('lanscape:spider', 'Send out the Spider')} and LANscape opens each page in a hidden window, reads what it actually renders, and paints a little preview for search results and the directory. Pages you visit are also re-indexed as you browse.</p>
<h2 class="sec">6. Copies and versions</h2><p>Save a tool as <tt>v1</tt>, <tt>v2</tt>, <tt>Rev 3</tt> or <tt>_final</tt>, download it twice and get <tt>Plan (1).html</tt>, copy a whole website folder: LANscape notices and shows each thing <b>once</b>, normally its newest version, in search, rings, the directory and every program. Exact copies, near-identical look-alikes, the same song in MP3 and FLAC, a video in two formats and a picture with its resized copy fold the same way. Older versions are a click away at the page's own <tt>/versions/</tt> address, with a yellow bar to step between them and a <b>Compare</b> button that shows what changed. If LANscape folded two things that are really different, press <b>Not the Same</b>; pick which one leads with <b>Make Main</b>. Everything is in the ${A('http://dupes.lanscape.net/', 'Duplicate Finder')}, and <b>Options &gt; Preferences &gt; Duplicates</b> sets how eager it is.</p>
<h2 class="sec">7. Guestbooks, counters and links pages</h2><p>Every site gets a hit counter, a <tt>/guestbook</tt> (handy as sticky notes for that page) and a <tt>/links</tt> page of similar sites. They're stored only in this browser.</p>
<h2 class="sec">Keyboard shortcuts</h2><table class="grid">${k(MOD + 'L', 'Focus the Location bar')}${k('Alt+&larr; / Alt+&rarr;', 'Back / Forward')}${k(MOD + 'R or F5', 'Reload the page')}${k(MOD + 'D', 'Bookmark this page')}${k(MOD + 'U', 'View page source')}${k(MOD + 'I', 'Page info')}${k(MOD + 'O', 'Open a folder')}${k(MOD + 'B', 'Show or hide the Explorer sidebar')}${k(MOD + 'K', 'Search in the sidebar')}${k('Esc', 'Stop loading')}</table>
<h2 class="sec">Security mode</h2><p>Pages run with scripts enabled so your tools work. In <b>Trusted</b> mode (default) pages share storage with each other and with LANscape, exactly as they would opened from disk. <b>Sandboxed</b> mode isolates them, but pages that save data in the browser won't be able to.</p>
<p style="text-align:center;margin-top:18px"><span class="uc"><i></i><span>THIS PAGE IS ALWAYS UNDER CONSTRUCTION</span><i></i></span></p>
${badgeRow()}</div>`, { css: HOME_CSS });
}

/* ---------------- HyperHound ---------------- */
const HOUND_CSS = `body{font:13px/1.35 Arial,Helvetica,"Liberation Sans",sans-serif;margin:0;background:#fff}
.hh-top{display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid #ccc}
.hh-top form{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.hh-top input[type=text]{width:min(420px,70vw);font:14px Arial,sans-serif;padding:3px}
.bar{background:#e5ecf9;border-top:1px solid #3366cc;padding:4px 12px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px}
.res{padding:6px 12px;max-width:760px}
.r{margin:0 0 15px;display:flex;gap:10px;align-items:flex-start}
.r .rt{font-size:16px}.r .rt a{text-decoration:underline}
.r .sn{color:#000}.r .sn b{color:#000}
.r .u{color:#008000}
.r .ex{color:#77c;font-size:12px}.r .ex a{color:#77c}
.r .ring{font-size:11px;color:#666}
.dym{color:#c00;font-size:15px;margin:8px 0}
.pages{font-size:14px;margin:18px 0;text-align:center}
.pages b{color:#a00}
.home{text-align:center;padding-top:40px}
.home form{margin:18px 0}
.home input[type=text]{width:min(460px,86vw);font:16px Arial,sans-serif;padding:4px}
.tips td{padding:4px 10px;border-bottom:1px solid #ddd}
.cache-hd{border:1px solid #999;background:#ffffcc;padding:8px;margin:10px;font-size:12px}
.cache{padding:0 14px;max-width:820px;font:14px/1.5 "Times New Roman",serif}
.cache mark{background:#ffff66}
.pvw{flex:none}
.tabs{display:flex;gap:18px;padding:6px 12px 4px;font-size:13px;flex-wrap:wrap}
.tabs b{color:#000;border-bottom:3px solid #3366cc;padding-bottom:2px}
.tabs .n{color:#888;font-size:11px}
.ft{font:bold 11px Arial,sans-serif;color:#7a1a1a}
.also{font-size:13px;margin:4px 0 14px;color:#444}
.res.wide{max-width:none}
.igrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}
.igrid .ic{font-size:12px;text-align:center}
.igrid img{width:140px;height:105px;object-fit:cover;border:1px solid #888;background:#eee;display:block;margin:0 auto 4px}
.igrid .u,.vgrid .u{color:#008000;font-size:11px}
.vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.vgrid img,.vgrid .nop{width:192px;height:108px;object-fit:cover;display:flex;align-items:center;justify-content:center;text-align:center;background:#111;color:#e50914;font:bold 12px Arial,sans-serif;border:1px solid #444}
.vgrid .vc{font-size:12px}
table.songs{border-collapse:collapse;font-size:13px;min-width:min(760px,100%)}
table.songs th{text-align:left;background:#e5ecf9;padding:4px 8px;border-bottom:1px solid #3366cc}
table.songs td{padding:3px 8px;border-bottom:1px solid #eee;vertical-align:middle}
table.songs tr:nth-child(even) td{background:#f6f9ff}
table.songs td a{text-decoration:none}`;
function houndBox(q, extraHidden = '') {
  return '<form action="http://www.hyperhound.com/search"><input type="text" name="q" value="' + esc(q || '') + '" aria-label="Search terms">' + extraHidden + '<input type="submit" value="HyperHound Search"><input type="submit" name="lucky" value="Lucky Dog!"></form>';
}
function portalHound(path, q) {
  if (path === '/' || path === '/index.html') return { title: 'HyperHound', html: houndHome() };
  if (path === '/search') {
    if (q.get('lucky') != null) { const r = search(q.get('q') || ''); if (r.results.length) return { redirect: r.results[0].doc.url }; }
    return { title: (q.get('q') || '') + ' - HyperHound Search', html: houndResults(q) };
  }
  if (path === '/images') return { redirect: 'http://www.hyperhound.com/search?t=images&q=' + encodeURIComponent(q.get('q') || '') };
  if (path === '/music') return { redirect: 'http://www.hyperhound.com/search?t=music&q=' + encodeURIComponent(q.get('q') || '') };
  if (path === '/related') return { title: 'Similar pages - HyperHound', html: houndRelated(q.get('url') || '') };
  if (path === '/cache') return { title: 'HyperHound cache', html: houndCache(q.get('url') || '', q.get('q') || '') };
  if (path === '/tips') return { title: 'HyperHound Search Tips', html: houndTips() };
  return null;
}
function houndHome() {
  const t = totals();
  return page('HyperHound', `<div class="home">${houndLogo(true)}
${houndBox('')}
<p class="small">Searching <b>${t.files.toLocaleString()}</b> files and <b>${t.terms.toLocaleString()}</b> unique words on your LANscape.</p>
<p class="small">${HOUND_TABS.slice(1).map(([k, label]) => A('http://www.hyperhound.com/search?t=' + k + '&q=', label)).join(' &middot; ')}</p>
<p class="small">${A('http://www.hyperhound.com/tips', 'Search Tips')} &middot; ${A('http://home.lanscape.net/dir/', 'Browse the Directory')} &middot; ${A('lanscape:spider', 'Send out the Spider')}</p>
<p class="tiny" style="color:#777;margin-top:40px">&copy;1998 HyperHound. Good dog.</p></div>`, { css: HOUND_CSS });
}
function hostOf(u) { try { return new URL(u).host; } catch (e) { return ''; } }
const HOUND_TABS = [['web', 'Web'], ['docs', 'Documents'], ['images', 'Images'], ['music', 'Music'], ['video', 'Video'], ['files', 'Files']];
function groupResults(results) {
  const g = { web: [], docs: [], images: [], music: [], video: [], files: [] };
  for (const r of results) {
    const d = r.doc;
    if (isSiteKind(d)) g.web.push(r);
    if (K(d).cls === 'document') g.docs.push(r);
    else if (d.kind === 'image') g.images.push(r);
    else if (d.kind === 'audio') g.music.push(r);
    else if (d.kind === 'video') g.video.push(r);
    else if (d.kind !== 'html') g.files.push(r);
  }
  return g;
}
async function houndResults(q) {
  const query = q.get('q') || '', start = Math.max(0, parseInt(q.get('start') || '0', 10) || 0), ring = q.get('ring') || '';
  const pv = q.get('pv') != null ? q.get('pv') === '1' : S.prefs.previews;
  const all = q.get('fold') === '0';
  // an empty query on a type tab lists everything of that type
  const res = query.trim() ? search(query, { ring, all }) : { results: (all ? docsAll() : docsShown()).filter(d => !ring || (ringOfDoc(d) && ringOfDoc(d).id === ring)).map(d => ({ doc: d, score: d.mtime || 0 })).sort((a, b) => b.score - a.score), total: 0, stems: [], ms: 0, P: parseQuery(''), omitted: all ? 0 : docsAll().length - docsShown().length };
  const groups = groupResults(res.results);
  let tab = q.get('t') || '';
  if (!HOUND_TABS.some(t => t[0] === tab)) tab = groups.web.length || !res.results.length ? 'web' : (HOUND_TABS.find(t => groups[t[0]].length) || ['web'])[0];
  const list = groups[tab];
  const N = list.length, per = tab === 'images' || tab === 'video' ? 30 : tab === 'music' || tab === 'files' ? 50 : 10;
  const ringObj = ring ? S.ringById.get(ring) : null;
  const hidden = (ring ? '<input type="hidden" name="ring" value="' + esc(ring) + '">' : '') + (tab !== 'web' ? '<input type="hidden" name="t" value="' + esc(tab) + '">' : '');
  const qs = (extra) => { const p = new URLSearchParams({ q: query }); if (ring) p.set('ring', ring); if (tab !== 'web') p.set('t', tab); if (all) p.set('fold', '0'); for (const k in extra) p.set(k, extra[k]); return 'http://www.hyperhound.com/search?' + p.toString(); };
  const tabs = '<div class="tabs">' + HOUND_TABS.map(([k, label]) => (k === tab ? '<b>' + label + '</b>' : A(qs({ t: k, start: 0 }), label)) + (groups[k].length ? ' <span class="n">' + groups[k].length + '</span>' : '')).join('') + '</div>';
  const slice = list.slice(start, start + per);
  let items = '';
  if (tab === 'web' || tab === 'docs') {
    items = slice.map(({ doc: d }) => {
      const ringLink = d.site && d.site.ring ? ' &middot; ' + A('http://home.lanscape.net/dir/' + d.site.ring.id, esc(d.site.ring.name)) : '';
      const g = d.fold && d.fold.members.length > 1 ? d.fold : null;
      const vers = g && !all ? ' - ' + (d === g.primary ? A(versionsUrl(g), (g.members.length - 1) + (g.reason === 'copy' || g.cls !== 'site' ? ' more cop' + (g.members.length > 2 ? 'ies' : 'y') : ' older version' + (g.members.length > 2 ? 's' : ''))) : '<b>' + esc(d.vlabel || 'older version') + '</b> of ' + A(g.primary.url, esc(clip(foldTitle(g), 40)))) : '';
      const thumb = pv ? '<div class="pvw">' + A(d.url, preview(d, 96, 72)) + '</div>' : '';
      const tag = d.kind !== 'html' ? '<span class="ft">[' + esc(badgeFor(d)) + ']</span> ' : '';
      return '<div class="r">' + thumb + '<div><div class="rt">' + tag + A(d.url, esc(d.meta.title || displayUrl(d.url))) + ' ' + badges(d) + '</div>' +
        '<div class="sn">' + snippet(d, res.stems) + '</div>' +
        '<div><span class="u">' + esc(clip(displayUrl(d.url), 80)) + '</span> - ' + fmtK(d.size) + ' - <span class="ex">' + A('http://www.hyperhound.com/cache?url=' + encodeURIComponent(d.url) + '&q=' + encodeURIComponent(query), d.kind === 'html' ? 'Cached' : 'View as text') + ' - ' + A('http://www.hyperhound.com/related?url=' + encodeURIComponent(d.url), 'Similar pages') + vers + '</span><span class="ring">' + ringLink + '</span></div></div></div>';
    }).join('');
    if (tab === 'web' && start === 0) {
      const more = HOUND_TABS.slice(2).filter(([k]) => groups[k].length).map(([k, label]) => A(qs({ t: k, start: 0 }), groups[k].length + ' ' + label.toLowerCase()));
      if (more.length) items = '<p class="also">Also on your LANscape: ' + more.join(' &middot; ') + '</p>' + items;
    }
  } else if (tab === 'images') {
    const cells = [];
    for (const { doc: d } of slice) {
      const src = await mediaThumbURL(d);
      cells.push('<div class="ic">' + A(d.url, '<img src="' + esc(src || '') + '" alt="' + esc(d.name) + '" loading="lazy">') + '<div>' + esc(clip(d.name, 26)) + '</div><div class="u">' + fmtK(d.size) + ' &middot; ' + esc((d.ext || '').toUpperCase()) + '</div></div>');
    }
    items = '<div class="igrid">' + cells.join('') + '</div>';
  } else if (tab === 'music') {
    items = '<table class="songs"><tr><th></th><th>Song</th><th>Artist</th><th>Album</th><th>Time</th></tr>' + slice.map(({ doc: d }) => {
      const m = d.meta;
      return '<tr><td>' + A(d.url, '&#9654;', ' title="Play in the Jukebox"') + '</td><td>' + A(d.url, esc(m.title || d.name)) + '</td><td>' + A('http://music.lanscape.net/artist/' + slug(m.artist || ''), esc(m.artist || '')) + '</td><td>' + A('http://music.lanscape.net/album/' + (m.artKey || albumKey(m.artist, m.album)), esc(m.album || '')) + '</td><td>' + (m.duration ? fmtDur(m.duration) : '') + '</td></tr>';
    }).join('') + '</table>';
  } else if (tab === 'video') {
    const cells = [];
    for (const { doc: d } of slice) {
      const p = await MThumbs.get('poster:' + d.path);
      cells.push('<div class="vc">' + A(d.url, p ? '<img src="' + p + '" alt="">' : '<span class="nop">&#9654;<br>' + esc(clip(d.meta.title, 30)) + '</span>') + '<div><b>' + A(d.url, esc(clip(d.meta.title, 40))) + '</b></div><div class="u">' + (d.meta.duration ? fmtDur(d.meta.duration) + ' &middot; ' : '') + fmtBytes(d.size) + '</div></div>');
    }
    items = '<div class="vgrid">' + cells.join('') + '</div>';
  } else {
    items = '<table class="songs"><tr><th></th><th>File</th><th>Folder</th><th>Size</th><th>Modified</th></tr>' + slice.map(({ doc: d }) => '<tr><td>' + iconFor(d) + '</td><td>' + A(d.url, esc(d.name)) + '</td><td><span class="u">' + A(d.ftp.replace(/[^/]*$/, ''), esc(displayUrl(d.ftp.replace(/[^/]*$/, '')))) + '</span></td><td>' + fmtK(d.size) + '</td><td>' + esc(fmtShort(d.mtime)) + '</td></tr>').join('') + '</table>';
  }
  let pages = '';
  if (N > per) {
    const total = Math.ceil(N / per), cur = Math.floor(start / per);
    const links = [];
    if (cur > 0) links.push(A(qs({ start: (cur - 1) * per }), '&laquo; Previous'));
    for (let i = Math.max(0, cur - 5); i < Math.min(total, cur + 6); i++) links.push(i === cur ? '<b>' + (i + 1) + '</b>' : A(qs({ start: i * per }), String(i + 1)));
    if (cur < total - 1) links.push(A(qs({ start: (cur + 1) * per }), 'Next &raquo;'));
    pages = '<div class="pages">Result Page: ' + links.join(' ') + '</div>';
  }
  const dym = res.suggestion ? '<div class="dym">Did you mean: ' + A(qs({ q: res.suggestion }).replace(/q=[^&]*/, 'q=' + encodeURIComponent(res.suggestion)), '<b><i>' + esc(res.suggestion) + '</i></b>') + '?</div>' : '';
  const fb = res.fallback ? '<p class="small" style="color:#a00">No file contains all of your words, so here are files that contain some of them.</p>' : '';
  const what = { web: 'pages', docs: 'documents', images: 'images', music: 'songs', video: 'videos', files: 'files' }[tab];
  const none = !N ? (query.trim() ? '<p>Your search - <b>' + esc(query) + '</b> - did not match any ' + what + ' on your LANscape.</p>' + (tab === 'web' ? '<p>Suggestions:</p><ul><li>Make sure all words are spelled correctly.</li><li>Try different or fewer keywords.</li><li>' + A('lanscape:spider', 'Send out the Spider') + ' to index text your pages build with JavaScript and the words inside PDFs.</li></ul>' : '') : '<p>There are no ' + what + ' on your LANscape yet.</p>') : '';
  const toggle = tab === 'web' || tab === 'docs' ? ' &middot; ' + A(qs({ start, pv: pv ? '0' : '1' }), pv ? 'Hide previews' : 'Show previews') : '';
  // copies and older versions were folded into the results: say so once, on the last page
  const omitted = !all && res.omitted && (start + per >= N) ? '<p class="small" style="margin:14px 0;color:#555"><i>HyperHound folded ' + res.omitted + ' cop' + (res.omitted === 1 ? 'y or older version' : 'ies and older versions') + ' into the results above. ' + A(qs({ fold: '0', start: 0 }), 'Show every file') + ' or open the ' + A('http://dupes.lanscape.net/', 'Duplicate Finder') + '.</i></p>' : '';
  const unfolded = all ? '<p class="small" style="margin:6px 0;color:#555">Showing every copy and version. ' + A(qs({ fold: '1', start: 0 }), 'Fold them again') + '.</p>' : '';
  return page(query + ' - HyperHound', `<div class="hh-top">${A('http://www.hyperhound.com/', houndLogo(false))}${houndBox(query, hidden)}</div>
${tabs}<div class="bar"><span>Searched ${ringObj ? '<b>' + esc(ringObj.name) + '</b>' : 'the LANscape'}${query.trim() ? ' for <b>' + esc(query) + '</b>' : ''}.${N ? ' Results <b>' + (start + 1) + '</b> - <b>' + Math.min(N, start + per) + '</b> of about <b>' + N + '</b>.' : ''}</span><span>Search took <b>${(res.ms / 1000).toFixed(3)}</b> seconds.${toggle}</span></div>
<div class="res${tab === 'images' || tab === 'video' || tab === 'music' || tab === 'files' ? ' wide' : ''}">${unfolded}${dym}${fb}${none}${items}${omitted}${pages}</div>
<div class="hh-top" style="border-top:1px solid #ccc;border-bottom:0;justify-content:center">${houndBox(query, hidden)}</div>
<p class="foot">${A('http://www.hyperhound.com/tips', 'Search Tips')} &middot; ${A('http://home.lanscape.net/', 'LANscape Home')} &middot; &copy;1998 HyperHound</p>`, { css: HOUND_CSS });
}
function houndRelated(url) {
  const r = resolveDocUrl(url);
  if (!r) return page('Similar pages', '<div class="res"><p>HyperHound doesn\'t know that page.</p></div>', { css: HOUND_CSS });
  const rel = relatedDocs(r, 15);
  const items = rel.map(([d, s]) => '<div class="r"><div class="pvw">' + A(d.url, preview(d, 96, 72)) + '</div><div><div class="rt">' + A(d.url, esc(d.meta.title)) + '</div><div class="sn">' + esc(clip(d.meta.desc, 200)) + '</div><div><span class="u">' + esc(displayUrl(d.url)) + '</span> - <b>' + Math.round(s * 100) + '% similar</b> <span class="ex">- ' + A(compareUrl(r, d), 'Compare') + '</span> <span class="ring">&middot; shares: ' + esc(sharedTerms(r.vec, d.vec, 5).join(', ')) + '</span></div></div></div>').join('');
  return page('Similar pages', `<div class="hh-top">${A('http://www.hyperhound.com/', houndLogo(false))}${houndBox('')}</div>
<div class="bar"><span>Pages similar to <b>${esc(displayUrl(r.url))}</b> (${esc(r.meta.title)})</span><span>${rel.length} found</span></div>
<div class="res">${items || '<p>No similar pages found.</p>'}</div>`, { css: HOUND_CSS });
}
function houndCache(url, q) {
  const d = resolveDocUrl(url);
  if (!d) return page('Cache', '<div class="res"><p>Not in the cache.</p></div>', { css: HOUND_CSS });
  const stems = new Set(parseQuery(q).terms.map(stem));
  const mark = s => esc(s).replace(/[A-Za-z0-9][A-Za-z0-9']*/g, w => stems.has(stem(normText(w).replace(/'s$/, '').replace(/'/g, ''))) ? '<mark>' + w + '</mark>' : w);
  const text = d.meta.deep || d.meta.body || '';
  const paras = text.split(/(?<=[.!?])\s+(?=[A-Z])/).reduce((acc, s) => { const last = acc[acc.length - 1]; if (last && last.length < 500) acc[acc.length - 1] = last + ' ' + s; else acc.push(s); return acc; }, []).slice(0, 400);
  return page('HyperHound cache', `<div class="cache-hd">This is <b>HyperHound</b>'s ${d.kind === 'html' ? 'cache' : 'text version'} of ${A(d.url, esc(d.url))}. It is the text the Hound indexed on ${esc(fmtDate(d.indexedAt || d.mtime, true))}${d.meta.deep ? ' (captured from the live page)' : ''}. The page may have changed since then. ${A(d.url, 'Click here for the current page')}.${stems.size ? '<br>These search terms have been highlighted: ' + [...stems].map(s => '<mark>' + esc(surface(s)) + '</mark>').join(' ') : ''}</div>
<div class="cache"><h2>${esc(d.meta.title)}</h2>${d.meta.headings ? '<p><i>' + mark(clip(d.meta.headings, 600)) + '</i></p>' : ''}${paras.map(p => '<p>' + mark(p) + '</p>').join('') || '<p><i>(No readable text. Try sending out the Spider.)</i></p>'}
${d.meta.script && !d.meta.deep ? '<h3>Text found inside scripts</h3><p style="color:#555">' + mark(clip(d.meta.script, 4000)) + '</p>' : ''}</div>`, { css: HOUND_CSS });
}
function houndTips() {
  const k = (a, b) => '<tr><td><tt>' + esc(a) + '</tt></td><td>' + b + '</td></tr>';
  return page('Search Tips', `<div class="hh-top">${A('http://www.hyperhound.com/', houndLogo(false))}${houndBox('')}</div><div class="res">
<h2>Search Tips</h2><p>HyperHound finds pages that contain <b>all</b> of your words, ranks them with BM25 (titles count five times as much as body text), and stems words so <i>cooking</i> also finds <i>cook</i>.</p>
<table class="tips">${k('porsche cayenne', 'pages with both words')}${k('"final table"', 'the exact phrase')}${k('cruise -dining', 'cruise pages that don\'t mention dining')}${k('poker OR fantasy', 'either word')}${k('site:grandmaruth', 'only pages whose address contains grandmaruth')}${k('ring:poker', 'only sites in a ring whose name contains poker')}${k('intitle:planner', 'the word must be in the title')}</table>
<p>Typing in the Location bar works too: anything that isn't a web address becomes a HyperHound search, and suggestions appear as you type.</p></div>`, { css: HOUND_CSS });
}

/* ---------------- RingHub ---------------- */
const RING_CSS = `body{font:14px/1.4 Verdana,Arial,sans-serif;margin:0;color:#e8e8ff}
.wrap{max-width:900px;margin:0 auto;padding:14px}
a{color:#39ff14}a.v{color:#ff66ff}
.rh-nav{text-align:center;margin:6px 0 14px;font-size:12px}
table.rings{border-collapse:collapse;width:100%;background:rgba(0,0,40,.75)}
table.rings td,table.rings th{border:1px solid #33337a;padding:6px 8px;vertical-align:middle}
table.rings th{background:#20206b;color:#ffff66;font-size:12px;text-align:left}
.kw{font-size:11px;color:#aab}
.panel{background:rgba(0,0,40,.8);border:2px solid #39ff14;padding:12px;margin:12px 0}
.code{background:#000;color:#0f0;font:12px "Courier New",monospace;padding:8px;white-space:pre-wrap;word-break:break-all;border:1px solid #333}
.mem td{vertical-align:top}
.go{text-align:center;padding-top:80px;font:18px Verdana,sans-serif}
.dots::after{content:"...";animation:dots 1s steps(4) infinite;display:inline-block;width:1.2em;text-align:left;overflow:hidden;vertical-align:bottom}
@keyframes dots{0%{width:0}100%{width:1.2em}}`;
function ringNavHTML(site) {
  const r = site && site.ring;
  if (!r) return '';
  const g = d => 'http://www.ringhub.org/go?ring=' + encodeURIComponent(r.id) + '&amp;dir=' + d + '&amp;from=' + encodeURIComponent(site.key);
  return '<table class="lan-ring"><tr><td colspan="5" class="rn"><img class="b88" src="' + ringButton(r) + '" alt="" style="width:88px;height:31px;vertical-align:middle"> This site is a member of <b>' + esc(r.name) + '</b></td></tr><tr>' +
    '<td><a href="' + g('prev') + '">&laquo; Prev</a></td><td><a href="' + g('random') + '">Random</a></td><td><a href="http://www.ringhub.org/ring/' + esc(r.id) + '">List Sites</a></td><td><a href="' + g('next') + '">Next &raquo;</a></td><td><a href="http://www.ringhub.org/">RingHub</a></td></tr>' +
    '<tr><td colspan="5" style="font-size:11px">Site ' + (site.ringPos + 1) + ' of ' + r.sites.length + '</td></tr></table>';
}
function portalRingHub(path, q) {
  if (path === '/' || path === '/index.html') return { title: 'RingHub', html: ringhubHome() };
  const m = /^\/ring\/([^/]+)\/?$/.exec(path);
  if (m) { const r = S.ringById.get(decodeURIComponent(m[1])); if (r) return { title: r.name + ' - RingHub', html: ringPage(r) }; }
  if (path === '/go') {
    const r = S.ringById.get(q.get('ring') || '');
    if (!r || !r.sites.length) return null;
    const dir = q.get('dir') || 'next';
    const from = S.siteByKey.get(q.get('from') || '');
    let i = from && from.ring === r ? r.sites.indexOf(from) : -1;
    let target;
    if (dir === 'random') { const pool = r.sites.filter(s => s !== from); target = (pool.length ? pool : r.sites)[Math.floor(Math.random() * (pool.length || r.sites.length))]; }
    else if (dir === 'prev') target = r.sites[(i < 0 ? 0 : i - 1 + r.sites.length) % r.sites.length];
    else target = r.sites[(i + 1) % r.sites.length];
    const word = dir === 'prev' ? 'previous' : dir === 'random' ? 'a random' : 'the next';
    return {
      title: 'RingHub: transporting', interstitial: true, to: target.url,
      html: page('RingHub', `<div class="go">${ringhubLogo()}<p>Hold on to your mouse! You are being transported to ${word} site in<br><b style="color:#ffff66">${esc(r.name)}</b><span class="dots"></span></p><p style="font-size:14px">&raquo; ${A(target.url, esc(target.title))} &laquo;</p></div>`, { css: RING_CSS, attrs: 'class="bg-stars"' })
    };
  }
  if (path === '/random') {
    const all = S.sites;
    if (!all.length) return null;
    return { redirect: all[Math.floor(Math.random() * all.length)].url };
  }
  return null;
}
function ringhubHome() {
  const day = dayKey();
  const rotd = S.rings.length ? S.rings[hash32('ring' + day) % S.rings.length] : null;
  const rows = S.rings.map(r => '<tr><td style="width:96px">' + A('http://www.ringhub.org/ring/' + r.id, '<img class="b88" src="' + ringButton(r) + '" alt="">') + '</td><td>' + A('http://www.ringhub.org/ring/' + r.id, '<b>' + esc(r.name) + '</b>') + '<br><span class="kw">' + (r.terms || []).slice(0, 6).map(esc).join(' &middot; ') + '</span></td><td style="text-align:center">' + r.sites.length + '</td><td style="white-space:nowrap">' + A('http://www.ringhub.org/go?ring=' + r.id + '&dir=random&from=', 'Random') + ' | ' + A(r.sites[0] ? r.sites[0].url : '#', 'Start') + '</td></tr>').join('');
  return page('RingHub', `<div class="wrap"><center>${ringhubLogo()}</center>
<div class="rh-nav">${A('http://home.lanscape.net/', 'LANscape Home')} | ${A('http://www.ringhub.org/random', 'Surf a Random Site')} | ${A('lanscape:rings', 'Ring Manager')} | ${A('http://www.hyperhound.com/', 'HyperHound')}</div>
<div class="panel"><b style="color:#ffff66">What's a web ring?</b> A circle of sites about the same thing. Every member links to the next one, so you can surf the whole topic without a search engine. RingHub grew these ${S.rings.length} rings automatically by reading your pages and linking the ones that talk about the same things.</div>
<div class="panel" style="border-color:#00e5ff;display:flex;gap:14px;align-items:center"><span style="font-size:30px">&#127921;</span><div><b style="color:#00e5ff">NEW! RingHub Pinball</b> &mdash; orbit the hub, dial up the 56K targets and rank up from Newbie to Cyber Legend. ${A('http://pinball.lanscape.net/', '<b>Play now &raquo;</b>')}</div></div>
${rotd ? '<div class="panel" style="border-color:#ff66ff"><b style="color:#ff66ff">&#9733; Ring of the Day:</b> ' + A('http://www.ringhub.org/ring/' + rotd.id, '<b>' + esc(rotd.name) + '</b>') + ' &mdash; ' + rotd.sites.length + ' sites about ' + esc((rotd.terms || []).slice(0, 3).join(', ')) + '</div>' : ''}
<table class="rings"><tr><th></th><th>Ring</th><th>Sites</th><th>Surf</th></tr>${rows}</table>${badgeRow()}</div>`, { css: RING_CSS, attrs: 'class="bg-stars"' });
}
function ringPage(r) {
  const first = r.sites[0];
  const vers = s => { const g = s.index.fold; return g && g.primary === s.index && g.members.length > 1 ? ' <span class="kw">[' + A(s.url + 'versions/', g.members.length + ' ' + (g.reason === 'copy' ? 'copies' : 'versions')) + ']</span>' : ''; };
  const mem = r.sites.map((s, i) => '<tr><td style="text-align:right;color:#ffff66">#' + (i + 1) + '</td><td>' + A(s.url, '<img class="b88" src="' + siteButton(s) + '" alt="">') + '</td><td>' + A(s.url, '<b>' + esc(s.title) + '</b>') + vers(s) + ' ' + badges(s.index) + '<br><span class="kw">' + esc(displayUrl(s.url)) + '</span><br><span style="font-size:12px">' + esc(clip(s.index.meta.desc, 170)) + '</span></td></tr>').join('');
  const code = ringNavHTML(first).replace(/<img[^>]*>/, '<img src="ringbutton.gif">');
  return page(r.name, `<div class="wrap"><center>${A('http://www.ringhub.org/', ringhubLogo())}</center>
<div class="panel"><table><tr><td><img class="b88" src="${ringButton(r)}" alt=""></td><td style="padding-left:10px"><b style="font-size:20px;color:#ffff66">${esc(r.name)}</b><br>${r.sites.length} sites about ${esc((r.terms || []).slice(0, 5).join(', '))}. Ring Master: you.</td></tr></table>
<p>${first ? A(first.url, '&raquo; Start surfing at site #1') : ''} &nbsp; ${A('http://www.ringhub.org/go?ring=' + r.id + '&dir=random&from=', '&raquo; Random site')} &nbsp; ${A('http://home.lanscape.net/dir/' + r.id, '&raquo; Directory listing')} &nbsp; ${A('lanscape:rings', '&raquo; Manage this ring')}</p></div>
<table class="rings mem">${mem}</table>
<div class="panel"><b style="color:#ffff66">Add this ring to your page:</b><div class="code">${esc(code)}</div></div>${badgeRow()}</div>`, { css: RING_CSS, attrs: 'class="bg-stars"' });
}

/* ---------------- Netropolis + members ---------------- */
function portalNetropolis(path) {
  const hoods = S.rings.map(r => ({ r, name: r.hood || (S.hoods && S.hoods.get(r.id)) || capWord((r.terms || ['Mystery'])[0]) + 'Heights' }));
  const css = 'body{font:14px Verdana,Arial,sans-serif;margin:0;background:#dfe9f5}.wrap{max-width:900px;margin:0 auto;padding:10px}svg{max-width:100%;height:auto}.hood{background:#fff;border:2px solid #1a2a4a;padding:10px;margin:10px 0}';
  if (path === '/' || path === '/index.html') {
    return { title: 'Netropolis', html: page('Netropolis', `<div class="wrap">${netropolisLogo()}<p>Welcome to Netropolis, where every homepage has a neighborhood. ${S.prefs.scheme === 'hoods' ? '' : '<i>(Your LANscape currently uses vanity domains. Switch the Domain style in Preferences to move everyone here.)</i>'}</p>
${hoods.map(h => '<div class="hood"><b>' + A('http://www.netropolis.com/' + encodeURIComponent(h.name) + '/', esc(h.name)) + '</b> &mdash; ' + h.r.sites.length + ' homesteaders &middot; <span class="small">' + esc((h.r.terms || []).slice(0, 4).join(', ')) + '</span></div>').join('')}${badgeRow()}</div>`, { css }) };
  }
  const m = /^\/([^/]+)\/?$/.exec(path);
  if (m) {
    const h = hoods.find(x => x.name.toLowerCase() === decodeURIComponent(m[1]).toLowerCase());
    if (h) return { title: h.name + ' - Netropolis', html: page(h.name, `<div class="wrap">${netropolisLogo()}<h2>${esc(h.name)}</h2><p>Part of ${esc(h.r.name)}.</p><ul>${h.r.sites.map(s => '<li>' + A(s.url, esc(s.title)) + ' <span class="small">' + esc(displayUrl(s.url)) + '</span></li>').join('')}</ul></div>`, { css }) };
  }
  return null;
}
function portalMembers(path) {
  if (path !== '/' && path !== '/index.html') return null;
  const list = S.sites.slice().sort((a, b) => a.title.localeCompare(b.title));
  return { title: 'LANscape Member Pages', html: page('Member Pages', `<h1>LANscape Member Homepages</h1><p>${list.length} members.</p><ul>${list.map(s => '<li>' + A(s.url, esc(s.title)) + ' <tt>' + esc(displayUrl(s.url)) + '</tt></li>').join('')}</ul>`) };
}

/* ---------------- per-site virtual pages ---------------- */
function siteLinksPage(site) {
  const rel = [];
  const seen = new Set([site.key]);
  for (const [d, s] of relatedDocs(site.index, 30)) { if (seen.has(d.site.key)) continue; seen.add(d.site.key); rel.push([d.site, s]); if (rel.length >= 8) break; }
  const items = rel.map(([s]) => '<tr><td>' + A(s.url, '<img class="b88" src="' + siteButton(s) + '" alt="">') + '</td><td>' + A(s.url, '<b>' + esc(s.title) + '</b>') + '<br><font size="2">' + esc(clip(s.index.meta.desc, 140)) + '</font></td></tr>').join('');
  const myBtn = siteButton(site);
  const code = '<a href="' + site.url + '"><img src="' + site.words.join('') + '.gif" width="88" height="31" alt="' + site.title + '"></a>';
  return page(site.title + ' - My Favorite Links', `<center><font face="Comic Sans MS,Arial" size="6" color="#ffff00">~*~ My Favorite Links ~*~</font><br><font face="Arial" size="3">from ${A(site.url, esc(site.title))}</font></center><hr class="rainbow">
<table align="center" cellpadding="8" style="max-width:720px">${items || '<tr><td>No links yet!</td></tr>'}</table><hr class="rainbow">
<center><font face="Arial" size="3"><b>Link to me!</b> Copy this code onto your page:</font><br><img class="b88" src="${myBtn}" alt=""><br>
<textarea rows="3" cols="60" readonly style="font:12px Courier New,monospace;max-width:92vw">${esc(code)}</textarea>
<p><font face="Arial" size="2">${A(site.url, 'Back to my homepage')} &middot; ${A(site.url.replace(/\/$/, '') + '/guestbook', 'Sign my guestbook')}</font></p></center>`, { attrs: 'class="bg-stars" text="#ffffff" link="#00ffff" vlink="#ff99ff"', css: 'a{color:#00ffff}a.v{color:#ff99ff}body{font-family:Arial,sans-serif}' });
}
function siteGuestbookPage(site, thanks) {
  const entries = (S.guestbook[site.key] || []).slice().reverse();
  const list = entries.map(e => '<tr><td style="border-bottom:1px dashed #8b5a2b;padding:8px 4px"><b>' + esc(e.name || 'Anonymous') + '</b>' + (e.from ? ' <i>from ' + esc(e.from) + '</i>' : '') + ' <font size="2" color="#6b4e2b">&middot; ' + esc(fmtDate(e.ts, true)) + (e.how ? ' &middot; found me via ' + esc(e.how) : '') + '</font><br>' + esc(e.msg).replace(/\n/g, '<br>') + '</td></tr>').join('');
  const opts = ['Surfing around', 'A web ring', 'HyperHound', 'A friend', 'My bookmarks'].map(o => '<option>' + o + '</option>').join('');
  return page('Guestbook - ' + site.title, `<center><font face="Georgia,Times" size="6" color="#5a2d0c"><i>Sign My Guestbook!</i></font><br><font face="Georgia" size="3">for ${A(site.url, esc(site.title))}</font></center>
${thanks ? '<center><p><font face="Arial" color="#006400" size="4"><b>Thanks for signing my guestbook!</b></font></p></center>' : ''}
<table align="center" width="92%" style="max-width:720px" cellpadding="4"><tr><td>
<form action="${esc(site.url.replace(/\/$/, '') + '/guestbook/sign')}"><table cellpadding="4">
<tr><td><font face="Arial" size="2">Your name:</font></td><td><input name="name" size="30"></td></tr>
<tr><td><font face="Arial" size="2">Hometown:</font></td><td><input name="from" size="30"></td></tr>
<tr><td><font face="Arial" size="2">How did you find me?</font></td><td><select name="how">${opts}</select></td></tr>
<tr><td valign="top"><font face="Arial" size="2">Comments:</font></td><td><textarea name="msg" rows="5" cols="44" style="max-width:70vw"></textarea></td></tr>
<tr><td></td><td><input type="submit" value="Sign It!"> <input type="reset" value="Clear"></td></tr></table></form>
<p><font face="Arial" size="2">${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}, newest first. Guestbooks are stored only in this browser, so they double as sticky notes for the page.</font></p>
<table width="100%" cellspacing="0">${list || '<tr><td><i>Be the first to sign!</i></td></tr>'}</table>
</td></tr></table>`, { attrs: 'class="bg-paper" text="#3b2410" link="#8b0000" vlink="#5a2d0c"' });
}
function notFoundPage(url, host) {
  let path = '/';
  try { path = decodeURI(new URL(url).pathname); } catch (e) { /* keep */ }
  const words = tokenize(path.replace(/[\/_.-]+/g, ' ')).join(' ');
  return page('404 Not Found', `<h1>Not Found</h1><p>The requested URL ${esc(path)} was not found on this server.</p>
<p>${words ? 'Try ' + A('http://www.hyperhound.com/search?q=' + encodeURIComponent(words), 'searching HyperHound for <i>' + esc(words) + '</i>') + ' or go to ' : 'Go to '}${A('http://' + host + '/', 'the site\'s home page')}.</p><hr><address>LANscape-HTTPD/1.0 Server at ${esc(host)} Port 80</address>`);
}
function aboutPage(name) {
  if (name === 'blank') return page('', '');
  if (name === 'cache') {
    const docs = docsAll().slice().sort((a, b) => a.path.localeCompare(b.path));
    let total = 0;
    const rows = docs.slice(0, 3000).map(d => { total += d.size || 0; return '<tr><td>' + A(d.url, esc(d.path)) + '</td><td>' + esc(K(d).label) + (d.asset ? ' (site file)' : '') + '</td><td align="right">' + fmtBytes(d.size) + '</td><td>' + (d.demo ? 'built-in' : d.root === VROOT ? 'in browser' : S.live.has(d.path) || S.fh.has(d.path) ? 'live' : 'cached') + '</td></tr>'; }).join('');
    const c = libraryCounts();
    return page('Disk Cache', `<h1 class="sans">Disk Cache</h1><p class="sans small">${docs.length} files (${fmtBytes(docs.reduce((a, x) => a + (x.size || 0), 0))}): ${c.pages} pages, ${c.documents} documents, ${c.songs} songs, ${c.videos} videos, ${c.pictures} pictures and ${c.files} other files. Storage: ${DB.ok ? 'IndexedDB in this browser (small files are copied; music and video are read from the folder)' : 'memory only (this browser blocks storage for local files)'}. ${S.parked.size ? S.parked.size.toLocaleString() + ' more files sit in folders you turned off; their index is kept (' + A('lanscape:folders', 'Manage Folders') + '). ' : ''}${A('lanscape:clear-cache', 'Empty the cache')}.</p>
<table class="grid"><tr><th>File</th><th>Type</th><th>Size</th><th>Source</th></tr>${rows}</table>${docs.length > 3000 ? '<p class="sans small">...and ' + (docs.length - 3000) + ' more.</p>' : ''}`);
  }
  if (name === 'history') {
    const groups = new Map();
    for (const h of S.history) { const k = dayKey(h.ts); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(h); }
    return page('History', '<h1 class="sans">History</h1>' + Array.from(groups).map(([k, list]) => '<h3 class="sans">' + esc(fmtDate(new Date(k + 'T12:00').getTime())) + '</h3><ul>' + list.map(h => '<li>' + A(h.url, esc(h.title || h.url)) + ' <span class="small sans">' + esc(new Date(h.ts).toLocaleTimeString()) + '</span></li>').join('') + '</ul>').join('') || '<p>No history yet.</p>');
  }
  if (name === 'bookmarks') {
    return page('Bookmarks', '<h1>Bookmarks for You</h1><dl><dt><h3>Bookmarks</h3></dt><dd><dl>' + (S.bookmarks || []).map(b => '<dt>' + A(b.url, esc(b.title || b.url)) + '</dt>').join('') + '</dl></dd></dl>');
  }
  if (name === 'dns') {
    const rows = S.sites.map(s => '<tr><td>127.0.0.1</td><td>' + A(s.url, esc(s.host + (s.base !== '/' ? s.base : ''))) + '</td><td>' + esc(s.group ? s.dir : s.index.path) + '</td></tr>').join('');
    return page('Hosts', `<h1 class="sans">LANscape hosts file</h1><p class="sans small">${S.sites.length} entries. Edit them in the ${A('lanscape:dns', 'DNS Manager')}.</p><table class="grid"><tr><th>Address</th><th>Host</th><th>File</th></tr>${rows}</table>`);
  }
  if (name === 'plugins') {
    const p = [['HyperHound Index Engine', 'BM25F ranking, stemming, phrase and site: queries over every kind of file'], ['RingHub Weaver', 'TF-IDF similarity + Louvain community detection; names rings from the phrases their pages share'],
      ['Duplicate Folder', 'Folds exact copies, saved revisions ("v2", "Rev 3", "_final", "(1)"), MinHash look-alikes, same songs, videos and pictures, and copied website folders into one entry; Myers diff for Compare'], ['LANscape Spider', 'Renders pages off-screen to read script-built text and paint previews; reads PDFs; frames posters for videos'], ['Office Open XML Filters', 'Reads and writes .docx and .xlsx, reads .pptx, .rtf, .csv and Markdown'], ['PDF.js ' + '3.11', 'Mozilla\'s PDF renderer, for LANscape Reader'], ['pdf-lib 1.17', 'Writes your mark-ups into a PDF copy'], ['Tag Reader', 'ID3v1/v2, MP4, FLAC, Ogg Vorbis and WAV song tags with album art'], ['88x31 Button Factory', 'Paints a button for every site with a 5x7 pixel font'], ['Dial-Up Synthesizer', 'Recreates the modem handshake with the Web Audio API'], ['LANscape Audio Engine', '10-band equalizer, balance, spectrum analyzer and visualizer for Jukebox and LANamp'], ['MIDI Synthesizer', 'Plays .mid, .kar and .rmi files with a built-in software synth'], ['Formula Engine', 'Over 140 spreadsheet functions for Ledger'], ['RingHub Pinball Physics', 'Flippers, bumpers and slingshots, 900 physics steps a second'], ['MKV Converter', 'Plays Matroska (.mkv) files your browser won\'t take by repackaging them as MP4 while they play: H.264, H.265, VP9 and AV1 picture with AAC, Dolby Digital, Opus, MP3 or FLAC sound, plus the subtitles inside. Nothing is re-encoded.']];
    return page('Installed plug-ins', '<h1 class="sans">Installed plug-ins</h1>' + p.map(([a, b]) => '<h3 class="sans">' + a + '</h3><p class="sans small">' + b + '</p>').join(''));
  }
  if (name === 'lanscape' || name === 'about') {
    return page('About LANscape', `<center><div style="margin-top:30px">${lanscapeBanner()}</div><h2 class="sans">LANscape Navigator ${VERSION}</h2><p class="sans small">A serverless web browser for the hypertext on your own disk.<br>Domain names, web rings, a search engine and guestbooks, all computed in this browser window.</p>${badgeRow()}</center>`);
  }
  return null;
}
