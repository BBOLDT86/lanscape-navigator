/* ===================================================================
   Sites hosted on this server, next to LANscape itself.
   Each one gets a LANscape domain name and opens inside the browser window,
   straight from the same server (or from the public copy when LANscape was
   saved to disk), so it is part of the intranet: on the home page, in the
   Directory, on the Hotlist, in HyperHound and in the Location bar.
   =================================================================== */
const HOSTED_HOME = 'https://bboldt86.github.io/lanscape-navigator/';
const HOSTED_SITES = [
  {
    id: 'sextant', host: 'www.sextantnews.com', title: 'Sextant', dir: 'news/', since: '2026-10-24', bytes: 5.2e5,
    glyph: '⚓', color: '#15243B', panel: '#D6B25E', lines: ['SEXTANT', 'NEWS'], cat: 'News & Media',
    blurb: 'The news six times a day, one edition for each ship’s watch (midnight, 4 a.m., 8 a.m., noon, 4 p.m. and 8 p.m. Eastern), read from about 120 live sources. It groups the stories several outlets are covering so you can compare them side by side, and its For You picks learn from what you open and how long you stay with it, privately, in your browser.',
    mobile: 'Made for phones too: the sections scroll, stories open in a sheet, and it can be added to the home screen.',
    keywords: 'sextant news headlines today top stories breaking world us politics business tech science health sports culture cars travel food long reads for you personalized feed rss watch edition newspaper'
  },
  {
    id: 'inbox-atlas', host: 'www.inboxatlas.com', title: 'Inbox Atlas', dir: 'inbox-atlas/', since: '2026-10-17', bytes: 8.4e6,
    glyph: '✉', color: '#1b2838', panel: '#e8d7a9', lines: ['INBOX', 'ATLAS'], cat: 'News & Media',
    blurb: 'A reading room for the released Epstein emails: 5,775 emails, 104 recovered text-message logs and 2,020 documents from the House Oversight and DOJ releases, with 26 sourced stories, films that replay the conversations on simulated phone and mail screens, reading trails, maps, Sankey flows, one edition per year and a studio for writing your own stories.',
    mobile: 'Made for phones too: the films play full-screen on an iPhone or Android, and the page can be added to the home screen.',
    keywords: 'inbox atlas epstein emails email jmail house oversight doj files stories films trails sankey maps flows editions studio hot mic abc wolff bannon summers texts imessage'
  },
  {
    id: 'the-hinge', host: 'www.thehinge.com', title: 'The Hinge', dir: 'the-hinge/', since: '2026-10-11', bytes: 9.6e5,
    glyph: '⚖', color: '#7d2f2f', panel: '#ffd34d', lines: ['THE', 'HINGE'], cat: 'Politics',
    blurb: 'A single-file forecast of the 2026 U.S. Senate, House and Ohio governor races. It blends a calibrated polling model, a history-only model built on presidential approval, real incomes and war, and live prices from Kalshi, Polymarket and PredictIt, and lets you change how much each one counts. A Money tab follows the money in every race.',
    mobile: '',
    keywords: 'hinge election forecast 2026 senate house governor ohio polls polling kalshi polymarket predictit midterms money ads prediction markets'
  },
  {
    id: 'election2026', host: 'www.electiondesk2026.com', title: 'Election Desk 2026', dir: 'election2026/', since: '2026-10-23', bytes: 1.0e6,
    glyph: '\u2714', color: '#0a0f1e', panel: '#f0c45a', lines: ['ELECTION', 'DESK'], cat: 'Politics',
    blurb: 'A live desk for the 2026 midterms: a map that drills from the country to every county for all 35 Senate and 36 governor races, the balance of power, early and mail voting by state, polls and the three major ratings, prediction markets, the news feed and, on election night, results with the time of every number. Rebuilt by an automated updater through Election Day.',
    mobile: 'Works on a phone: the map, the rail and the tables stack.',
    keywords: 'election desk 2026 midterms map county results senate governor house early vote early voting mail ballots polls ratings cook sabato inside elections markets kalshi polymarket election night live ap calls balance of power'
  }
];
const HOSTED_BY_HOST = {};
for (const s of HOSTED_SITES) HOSTED_BY_HOST[s.host] = s;
/** served over http(s): the sites sit next to this page; saved to disk: use the public copy */
function hostedBase(site) {
  if (/^https?:$/.test(location.protocol)) { try { return new URL(site.dir, location.href).href; } catch (e) { /* fall through */ } }
  return HOSTED_HOME + site.dir;
}
function hostedSrc(site, path, search, hash) {
  const p = (path || '/').replace(/^\/+/, '');
  return hostedBase(site) + (p === 'index.html' ? '' : p) + (search || '') + (hash || '');
}
function hostedUrl(site, hash) { return 'http://' + site.host + '/' + (hash || ''); }
function hostedButton(site) { return drawButton({ color: site.color, panel: site.panel, glyph: site.glyph, lines: site.lines }); }
const HOSTED_FAV = new Map();
function hostedFavicon(site) {
  if (HOSTED_FAV.has(site.id)) return HOSTED_FAV.get(site.id);
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 16;
  const c = cv.getContext('2d');
  c.fillStyle = site.color; c.fillRect(0, 0, 16, 16);
  c.fillStyle = site.panel; c.fillRect(2, 2, 12, 12);
  c.fillStyle = site.color; c.font = 'bold 11px Georgia,serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(site.title.charAt(0), 8, 8.5);
  const url = cv.toDataURL('image/png');
  HOSTED_FAV.set(site.id, url);
  return url;
}
function hostedRow(site, withButton) {
  return '<div class="hs">' + (withButton ? A(hostedUrl(site), '<img class="b88" src="' + hostedButton(site) + '" alt="' + esc(site.title) + '">') : '') +
    '<div><b>' + A(hostedUrl(site), esc(site.title)) + '</b> <span class="mini">' + esc(site.host) + '</span><br><span class="mini">' + esc(clip(site.blurb, 150)) + '</span><br>' +
    A(hostedUrl(site), 'Visit it!') + ' &middot; ' + A('lanscape:hosted-full?id=' + site.id, 'Full screen', ' title="Open it in a tab of its own, outside LANscape"') + '</div></div>';
}
/** the box on LANscape Home */
function hostedBox() {
  return '<div class="box"><div class="bh">&#9733; Also on This Server</div><div class="bb">' + HOSTED_SITES.map(s => hostedRow(s, true)).join('') +
    '<p class="mini" style="margin:6px 0 0">' + A('http://home.lanscape.net/hosted', 'About these sites...') + '</p></div></div>';
}
/** http://home.lanscape.net/hosted */
function hostedPage() {
  const items = HOSTED_SITES.map(s => '<h2 class="sec">' + s.glyph + ' ' + esc(s.title) + ' <span style="font-weight:normal">(' + esc(s.cat) + ')</span></h2>' +
    '<table cellpadding="6"><tr><td valign="top">' + A(hostedUrl(s), '<img class="b88" src="' + hostedButton(s) + '" alt="">') + '</td><td>' +
    '<p style="margin:0 0 6px"><b>' + A(hostedUrl(s), esc(s.title)) + '</b> &mdash; <span class="mini" style="color:#008000">' + esc(s.host) + '</span></p><p style="margin:0 0 6px">' + esc(s.blurb) + '</p>' +
    (s.mobile ? '<p class="mini" style="margin:0 0 6px">' + esc(s.mobile) + '</p>' : '') +
    '<p class="mini" style="margin:0">Online since ' + esc(s.since) + ' &middot; ' + A(hostedUrl(s), 'Visit it!') + ' &middot; ' + A('lanscape:hosted-full?id=' + s.id, 'Full screen') + ' &middot; <span class="mini">lives at <tt>' + esc(s.dir) + '</tt> on this server</span></p></td></tr></table>').join('');
  return page('Also on This Server', `<div class="wrap">${lanNav('Home')}
<h1 style="font:bold 24px Arial,sans-serif">&#9733; Also on This Server</h1>
<p>These sites live on the same server as LANscape, in folders next to it, so they are part of your intranet: each has a domain name on your LANscape, opens right here in the browser window, and shows up in the Directory, on the Hotlist and in HyperHound. They are not built from your folders; they are published pages of their own.</p>
${items}${badgeRow()}</div>`, { css: HOME_CSS + '.hs{display:flex;gap:10px;align-items:flex-start;margin:0 0 10px}.hs img{flex:none}' });
}
/** HyperHound: a hosted site whose title or keywords match the query */
function hostedHits(query) {
  const words = String(query || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1);
  if (!words.length) return [];
  return HOSTED_SITES.filter(s => { const hay = (s.title + ' ' + s.keywords).toLowerCase(); return words.some(w => hay.includes(w)); });
}
function hostedHitsHTML(query) {
  const hits = hostedHits(query);
  if (!hits.length) return '';
  return '<p class="also">On this server: ' + hits.map(s => A(hostedUrl(s), '<b>' + esc(s.title) + '</b>') + ' <span class="u">' + esc(s.host) + '</span>').join(' &middot; ') + '</p>';
}
/** the Hotlist wall and the Directory block */
function hostedHotlist() {
  return '<h2 style="font:bold 16px Arial,sans-serif;color:#ffff66;margin:18px 0 6px">&#9733; This Server</h2><div class="wall">' + HOSTED_SITES.map(s => A(hostedUrl(s), '<img class="b88" src="' + hostedButton(s) + '" alt="' + esc(s.title) + '" title="' + esc(s.title) + '">')).join(' ') + '</div>';
}
function hostedDirBlock() {
  return '<h2 class="sec">&#9733; Also on This Server <span style="font-weight:normal">(' + HOSTED_SITES.length + ' sites)</span></h2><div class="dir">' +
    HOSTED_SITES.map(s => '<div class="cat">' + A(hostedUrl(s), esc(s.title)) + ' <span class="mini">(' + esc(s.cat) + ')</span><span class="sub">' + esc(clip(s.blurb, 110)) + '</span></div>').join('') + '</div>';
}

/* ---------------- full screen ---------------- */
let fsDimTimer = null;
function toggleKiosk(on) {
  const app = $('#app');
  const want = on == null ? !app.classList.contains('kiosk') : !!on;
  if (want === app.classList.contains('kiosk')) return want;
  app.classList.toggle('kiosk', want);
  if (want) {
    try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* not on this device */ }
    clearTimeout(fsDimTimer); $('#fsExit').classList.remove('dim'); fsDimTimer = setTimeout(() => $('#fsExit').classList.add('dim'), 2600);
  } else {
    app.classList.remove('coop');
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) { /* ignore */ }
  }
  // tell a hosted page that cooperates (Inbox Atlas shows its own button)
  try { if (frame && frame.contentWindow) frame.contentWindow.postMessage({ lanscape: 'fullscreen-ok', on: want }, '*'); } catch (e) { /* ignore */ }
  setStatus(want ? 'Full screen. Press F11 or tap LANscape to come back.' : 'Document: Done');
  return want;
}
function hostedOrigin() { try { return new URL(HOSTED_HOME).origin; } catch (e) { return ''; } }
window.addEventListener('message', e => {
  const d = e.data;
  if (!d || d.lanscape !== 'fullscreen') return;
  if (e.origin !== location.origin && e.origin !== hostedOrigin()) return;
  const on = toggleKiosk(d.on == null ? undefined : !!d.on);
  // the page has its own way out, so the chip steps aside
  $('#app').classList.toggle('coop', !!on);
});
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && $('#app').classList.contains('kiosk')) { /* the browser's own exit (Esc): keep the kiosk layout, the chip still restores the chrome */ } });
$('#fsEnter').addEventListener('click', () => toggleKiosk(true));
$('#fsExit').addEventListener('click', () => toggleKiosk(false));
$('#fsExit').addEventListener('mouseenter', () => { clearTimeout(fsDimTimer); $('#fsExit').classList.remove('dim'); });
