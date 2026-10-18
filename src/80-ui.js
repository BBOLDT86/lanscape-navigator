/* ===================================================================
   UI: menus, toolbar, location suggestions, sidebar, dialogs, managers
   =================================================================== */

/* ---------------- windows & message boxes ---------------- */
const Wins = [];
function openWin({ title, body, buttons = [], width, modal = true, onClose, cls, foot }) {
  const layer = $('#layer');
  const w = el('div', { class: 'win' + (cls ? ' ' + cls : ''), role: 'dialog', 'aria-modal': modal ? 'true' : 'false', 'aria-label': title });
  if (width) w.style.width = width;
  const x = el('button', { class: 'tbb', 'aria-label': 'Close', html: '<svg width="8" height="8" viewBox="0 0 8 8"><path d="M0 0h2l2 2 2-2h2v1L5 4l3 3v1H6L4 6 2 8H0V7l3-3-3-3z" fill="currentColor"/></svg>' });
  const tb = el('div', { class: 'titlebar' }, el('span', { class: 'tb-title', text: title }), el('span', { class: 'tb-btns' }, x));
  const bd = el('div', { class: 'win-body' });
  if (typeof body === 'string') bd.innerHTML = body; else if (body) bd.append(body);
  w.append(tb, bd);
  let resolver;
  const api = {
    el: w, body: bd, result: new Promise(r => { resolver = r; }),
    close(v) {
      if (!w.isConnected) return;
      w.remove();
      const i = Wins.indexOf(api); if (i >= 0) Wins.splice(i, 1);
      layer.classList.toggle('modal', Wins.some(x2 => x2.modal));
      if (onClose) onClose(v);
      resolver(v);
      if (!Wins.length) try { $('#loc').blur(); } catch (e) { /* ignore */ }
    },
    modal
  };
  if (buttons.length || foot) {
    const ft = el('div', { class: 'win-foot' });
    if (foot) ft.append(foot);
    for (const b of buttons) {
      const btn = el('button', { class: 'btn' + (b.primary ? ' primary' : ''), text: b.label, type: 'button' });
      btn.addEventListener('click', () => { const r = b.onClick ? b.onClick(api) : undefined; if (r !== false) api.close(b.value !== undefined ? b.value : b.label); });
      ft.append(btn);
      if (b.id) btn.id = b.id;
    }
    w.append(ft);
  }
  x.addEventListener('click', () => api.close(null));
  // drag by title bar
  tb.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const r = w.getBoundingClientRect();
    w.style.position = 'fixed'; w.style.left = r.left + 'px'; w.style.top = r.top + 'px'; w.style.margin = '0';
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const mv = ev => { w.style.left = clamp(ev.clientX - dx, -r.width + 60, innerWidth - 60) + 'px'; w.style.top = clamp(ev.clientY - dy, 0, innerHeight - 30) + 'px'; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });
  layer.append(w);
  Wins.push(api);
  layer.classList.toggle('modal', Wins.some(x2 => x2.modal));
  setTimeout(() => { const f = w.querySelector('[autofocus], input:not([type=hidden]):not([readonly]), select, textarea, .btn.primary'); if (f) f.focus(); }, 30);
  return api;
}
function msgBox(icon, title, html, buttons = ['OK']) {
  const body = el('div', { class: 'msg', html: (ICON[icon] || '') + '<div>' + html + '</div>' });
  const w = openWin({ title, body, buttons: buttons.map((b, i) => (typeof b === 'string' ? { label: b, primary: i === 0 } : b)), width: 'min(480px, 94vw)' });
  return w.result;
}

/* ---------------- menus ---------------- */
const chk = (label, get, set, extra = {}) => Object.assign({ label, check: get, act: () => set(!get()) }, extra);
const prefToggle = (label, key, after) => chk(label, () => !!S.prefs[key], v => { S.prefs[key] = v; saveState(); if (after) after(); });
const MENUS = [
  { label: 'File', items: () => [
    { label: 'New Document', act: () => go('http://write.lanscape.net/') },
    { label: 'New Spreadsheet', act: () => go('http://ledger.lanscape.net/') },
    { label: 'New Text File', act: () => go('http://notepad.lanscape.net/') },
    { sep: 1 },
    { label: 'Add Folder...', key: MOD + 'O', act: () => openFolder() },
    { label: 'Open File...', act: () => runAction('open-file') },
    { label: 'Manage Folders...', act: () => FolderManager.open() },
    { label: 'Re-sync Folders', act: () => resyncAll(), disabled: () => !diskRoots().length },
    { sep: 1 },
    { label: 'Open Location...', key: MOD + 'L', act: focusLoc },
    { label: 'Open in New Window', act: () => S.cur && openNewWindow(S.cur.url), disabled: () => !S.cur },
    { label: 'Edit Page Source', act: editSource, disabled: () => !(S.cur && S.cur.doc && isTextKind(S.cur.doc.kind)) },
    { label: S.cur && S.cur.app && S.cur.app.save ? 'Save' : 'Save Page As...', key: MOD + 'S', act: savePage, disabled: () => !S.cur },
    { label: 'Print...', key: MOD + 'P', act: printPage, disabled: () => !S.cur },
    { sep: 1 },
    { label: 'Export Settings...', act: exportSettings },
    { label: 'Import Settings...', act: () => { $('#importInput').value = ''; $('#importInput').click(); } },
    { label: 'Close All Folders', act: closeFolders, disabled: () => !S.roots.some(r => r.name !== VROOT) }
  ] },
  { label: 'Edit', items: () => [
    { label: 'Find in Page...', key: MOD + 'F', act: () => Finder.open() },
    { label: 'Find Again', key: 'F3', act: () => Finder.again() },
    { sep: 1 },
    { label: 'Copy Location', act: () => copyText(S.cur ? S.cur.url : '') },
    { label: 'Copy File Path', act: () => copyText(S.cur && S.cur.doc ? S.cur.doc.path : ''), disabled: () => !(S.cur && S.cur.doc) },
    { sep: 1 },
    { label: 'Preferences...', act: openPrefs }
  ] },
  { label: 'View', items: () => [
    { label: 'Reload', key: MOD + 'R', act: reload },
    { label: 'Stop Loading', key: 'Esc', act: stop },
    { sep: 1 },
    prefToggle('Explorer Sidebar', 'sidebar', applyChrome),
    prefToggle('Directory Buttons', 'showDir', applyChrome),
    prefToggle('Web Ring Bar', 'showRing', applyChrome),
    chk('Night Theme', () => S.prefs.theme === 'night', v => { S.prefs.theme = v ? 'night' : 'classic'; saveState(); applyChrome(); }),
    { sep: 1 },
    { label: 'Page Source', key: MOD + 'U', act: viewSource, disabled: () => !S.cur },
    { label: 'Page Info', key: MOD + 'I', act: pageInfo, disabled: () => !S.cur }
  ] },
  { label: 'Go', items: () => {
    const items = [
      { label: 'Back', key: 'Alt+←', act: back, disabled: () => S.tab.idx <= 0 },
      { label: 'Forward', key: 'Alt+→', act: forward, disabled: () => S.tab.idx >= S.tab.stack.length - 1 },
      { label: 'Home', act: goHome },
      { label: 'Random Site', act: randomSite },
      { sep: 1 }
    ];
    S.tab.stack.slice(-14).forEach((e, i, arr) => {
      const idx = S.tab.stack.length - arr.length + i;
      items.push({ label: clip(e.title || displayUrl(e.url), 56), radio: () => idx === S.tab.idx, act: () => stepHistory(idx - S.tab.idx) });
    });
    return items;
  } },
  { label: 'Bookmarks', items: () => [
    { label: 'Add Bookmark', key: MOD + 'D', act: addBookmark, disabled: () => !S.cur },
    { label: 'Go to Bookmarks', act: () => go('about:bookmarks') },
    { sep: 1 },
    ...(S.bookmarks || []).map(b => ({ label: clip(b.title || b.url, 60), act: () => go(b.url) }))
  ] },
  { label: 'Options', items: () => [
    { label: 'Preferences...', act: openPrefs },
    { sep: 1 },
    { mlabel: 'Connection speed' },
    ...Object.entries(SPEEDS).map(([k, v]) => ({ label: v.label + (k === 'lan' ? ' (instant)' : (k === 't1' || k === 'isdn') ? ' line' : ' modem'), radio: () => S.prefs.speed === k, act: () => { S.prefs.speed = k; saveState(); applyChrome(); } })),
    prefToggle('Modem Sounds', 'sounds'),
    prefToggle('"Hold on!" Ring Pages', 'interstitial'),
    { sep: 1 },
    prefToggle('Show the Demo Web', 'demo', () => { rebuildAll(); go('http://home.lanscape.net/'); }),
    chk('Fold Duplicates and Versions', () => foldLevel() > 0, v => { S.prefs.fold = v ? 'normal' : 'off'; saveState(); rebuildAll(); afterFolderChange(); if (S.cur && S.cur.route && S.cur.route.type === 'gen') reload(); }),
    prefToggle('Read Pages As I Browse (deep index)', 'deep'),
    prefToggle('Capture Page Previews', 'previews'),
    { sep: 1 },
    { label: 'Dial-Up Networking...', act: dialUp }
  ] },
  { label: 'Directory', items: () => [
    { label: 'LANscape Home', act: () => go('http://home.lanscape.net/') },
    { label: "What's New?", act: () => go('http://home.lanscape.net/new') },
    { label: "What's Cool?", act: () => go('http://home.lanscape.net/cool') },
    { label: 'Web Rings', act: () => go('http://www.ringhub.org/') },
    { label: 'Directory', act: () => go('http://home.lanscape.net/dir/') },
    { label: 'HyperHound Search', act: () => go('http://www.hyperhound.com/') },
    { label: 'The Ultimate Hotlist', act: () => go('http://home.lanscape.net/hotlist') },
    { sep: 1 },
    { label: 'Send out the Spider', act: () => Spider.start() },
    { label: 'Manage Folders...', act: () => FolderManager.open() },
    { label: 'DNS Manager...', act: openDNS },
    { label: 'Ring Manager...', act: openRingManager },
    { label: 'Duplicate Finder...', act: () => go('http://dupes.lanscape.net/') },
    { sep: 1 },
    { label: 'Disk Cache', act: () => go('about:cache') },
    { label: 'Hosts File', act: () => go('about:dns') }
  ] },
  { label: 'Programs', items: () => [
    ...PROGRAMS.map(p => p.id === 'lanamp' ? chk('LANamp Player', () => typeof LANamp !== 'undefined' && LANamp.isOpen(), () => LANamp.toggle()) : { label: APPS[p.id].name, act: () => go(p.url) }),
    { sep: 1 },
    { label: 'Program Manager', act: () => go('http://home.lanscape.net/programs') },
    { label: VROOT, act: () => go('ftp://' + (S.rootFtp.get(VROOT) || '') + '/'), disabled: () => !S.rootFtp.get(VROOT) },
    ...(S.ftpHosts.size ? [{ mlabel: 'FTP servers' }] : []),
    ...Array.from(S.ftpHosts.entries()).filter(([h, r]) => r !== VROOT).slice(0, 12).map(([h, r]) => ({ label: h + '  (' + clip(r, 24) + ')', act: () => go('ftp://' + h + '/') }))
  ] },
  { label: 'Help', items: () => [
    { label: 'The Internet for Beginners', act: () => go('http://home.lanscape.net/help') },
    { label: 'Search Tips', act: () => go('http://www.hyperhound.com/tips') },
    { label: 'Installed Plug-ins', act: () => go('about:plugins') },
    { sep: 1 },
    { label: 'About LANscape...', act: aboutBox }
  ] }
];
let openMenuIdx = -1;
function buildMenubar() {
  const bar = $('#menubar');
  MENUS.forEach((m, i) => {
    const b = el('button', { class: 'mitem', role: 'menuitem', 'aria-haspopup': 'true', text: m.label });
    b.addEventListener('mousedown', e => { e.preventDefault(); openMenuIdx === i ? closeMenus() : openMenu(i); });
    b.addEventListener('mouseenter', () => { if (openMenuIdx >= 0 && openMenuIdx !== i) openMenu(i); });
    b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openMenu(i, true); } });
    bar.append(b);
  });
}
function openMenu(i, focusFirst) {
  closeMenus();
  openMenuIdx = i;
  const btn = $$('#menubar .mitem')[i];
  btn.classList.add('open');
  const items = MENUS[i].items();
  const m = el('div', { class: 'menu', role: 'menu' });
  for (const it of items) {
    if (it.sep) { m.append(el('hr')); continue; }
    if (it.mlabel) { m.append(el('div', { class: 'mlabel', text: it.mlabel })); continue; }
    const b = el('button', { role: 'menuitem', type: 'button' }, el('span', { text: it.label }), it.key ? el('span', { class: 'k', text: it.key }) : null);
    if (it.check && it.check()) b.classList.add('chk');
    if (it.radio && it.radio()) b.classList.add('rad');
    if (it.disabled && it.disabled()) b.disabled = true;
    b.addEventListener('click', () => { closeMenus(); it.act && it.act(); });
    m.append(b);
  }
  m.addEventListener('keydown', e => {
    const list = $$('button:not(:disabled)', m), k = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (list[k + 1] || list[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (list[k - 1] || list[list.length - 1]).focus(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); openMenu((i + 1) % MENUS.length, true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); openMenu((i - 1 + MENUS.length) % MENUS.length, true); }
    else if (e.key === 'Escape') { closeMenus(); btn.focus(); }
  });
  $('#menus').append(m);
  const r = btn.getBoundingClientRect();
  m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 4) + 'px';
  m.style.top = r.bottom + 'px';
  if (focusFirst) { const f = m.querySelector('button:not(:disabled)'); if (f) f.focus(); }
}
function closeMenus() {
  openMenuIdx = -1;
  $('#menus').innerHTML = '';
  $$('#menubar .mitem.open').forEach(b => b.classList.remove('open'));
}
document.addEventListener('mousedown', e => {
  if (openMenuIdx >= 0 && !e.target.closest('.menu') && !e.target.closest('#menubar')) closeMenus();
  if (!e.target.closest('.loc-wrap')) hideSuggest();
});
window.addEventListener('blur', () => { closeMenus(); $('#app').classList.add('blur'); });
window.addEventListener('focus', () => $('#app').classList.remove('blur'));

/* ---------------- toolbar + directory buttons ---------------- */
function buildToolbar() {
  const tools = $('#tools');
  const B = (id, icon, label, act, title) => {
    const b = el('button', { class: 'tool', id, title: title || label, 'aria-label': title || label, html: ICON[icon] + '<span>' + label + '</span>' });
    b.addEventListener('click', act);
    tools.append(b);
    return b;
  };
  B('bBack', 'back', 'Back', back, 'Back (Alt+Left)');
  B('bFwd', 'fwd', 'Forward', forward, 'Forward (Alt+Right)');
  B('bReload', 'reload', 'Reload', reload, 'Reload (' + MOD + 'R)');
  B('bHome', 'home', 'Home', goHome);
  tools.append(el('span', { class: 'sep' }));
  B('bSearch', 'search', 'Search', () => go('http://www.hyperhound.com/'), 'HyperHound search');
  B('bRings', 'rings', 'Rings', () => go('http://www.ringhub.org/'), 'Web rings');
  B('bOpen', 'open', 'Folders', foldersButton, 'Your folders: add folders, turn subfolders on and off, re-sync (' + MOD + 'O adds a folder)');
  B('bProgs', 'progs', 'Programs', () => go('http://home.lanscape.net/programs'), 'Program Manager: Write, Ledger, Calculator, Reader, Jukebox, Rewind, Pinball...');
  B('bSpider', 'spider', 'Spider', () => Spider.start(), 'Send out the Spider: read every page and PDF, capture previews');
  B('bPrint', 'print', 'Print', printPage);
  B('bStop', 'stop', 'Stop', stop, 'Stop (Esc)');
  $('#throbber').addEventListener('click', e => { e.preventDefault(); go('http://home.lanscape.net/'); });
  const dir = $('#dirrow');
  const D = (label, act, title) => { const b = el('button', { class: 'dbtn', text: label, title: title || label }); b.addEventListener('click', act); dir.append(b); };
  D("What's New?", () => go('http://home.lanscape.net/new'));
  D("What's Cool?", () => go('http://home.lanscape.net/cool'));
  D('Web Rings', () => go('http://www.ringhub.org/'));
  D('Net Search', () => go('http://www.hyperhound.com/'));
  D('Directory', () => go('http://home.lanscape.net/dir/'));
  D('Hotlist', () => go('http://home.lanscape.net/hotlist'));
  D('Random Site', randomSite);
  D('Add Folder...', () => openFolder());
  $('#bmkBtn').addEventListener('mousedown', e => { e.preventDefault(); openMenu(MENUS.findIndex(m => m.label === 'Bookmarks')); const m = $('.menu'); const r = $('#bmkBtn').getBoundingClientRect(); if (m) { m.style.left = r.left + 'px'; m.style.top = r.bottom + 'px'; } });
  $('#relBtn').addEventListener('click', () => { S.prefs.sidebar = true; S.prefs.sideTab = 'related'; saveState(); applyChrome(); });
  $$('.tb-btns .tbb', $('#titlebar')).forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.act;
    if (a === 'min') { const bands = $('#bands'); bands.hidden = !bands.hidden; }
    else if (a === 'max') $('#app').classList.toggle('restored');
    else if (a === 'close') dialUp(true);
  }));
}
function applyChrome() {
  const P = S.prefs;
  if (P.theme === 'night') document.documentElement.setAttribute('data-theme', 'night'); else document.documentElement.removeAttribute('data-theme');
  $('#dirbar').hidden = !P.showDir;
  $('#sidebar').hidden = !P.sidebar;
  $('#sbNetTxt').textContent = (SPEEDS[P.speed] || SPEEDS.lan).label;
  renderRingStrip();
  if (P.sidebar) refreshSidebar(true);
}

/* ---------------- location bar + suggestions ---------------- */
const loc = $('#loc'), sug = $('#suggest');
let sugItems = [], sugIdx = -1;
function focusLoc() { loc.focus(); loc.select(); }
function hideSuggest() { sug.hidden = true; sugIdx = -1; }
function suggestions(text) {
  const t = text.trim().toLowerCase();
  if (!t) return [];
  const out = [];
  const bare = t.replace(/^https?:\/\//, '').replace(/^www\./, '');
  const sites = [];
  for (const s of S.sites) {
    const addr = displayUrl(s.url).toLowerCase(), a2 = addr.replace(/^www\./, ''), ti = s.title.toLowerCase();
    let sc = 0;
    if (a2.startsWith(bare)) sc = 4; else if (ti.startsWith(t)) sc = 3; else if (addr.includes(bare)) sc = 2; else if (ti.includes(t)) sc = 1;
    if (sc) sites.push({ kind: 'site', url: s.url, title: s.title, addr: displayUrl(s.url), sc });
  }
  for (const h of ['home.lanscape.net', 'www.hyperhound.com', 'www.ringhub.org'].concat(Object.keys(APP_HOSTS).filter(x => x !== 'rewindvideo.com'), Array.from(S.ftpHosts.keys()))) if (h.replace(/^www\./, '').startsWith(bare)) sites.push({ kind: 'site', url: (h.startsWith('ftp.') ? 'ftp://' : 'http://') + h + '/', title: h, addr: h, sc: 3.5 });
  for (const hs of HOSTED_SITES) { const a2 = hs.host.replace(/^www\./, ''), ti = hs.title.toLowerCase(); const sc = a2.startsWith(bare) ? 4 : ti.startsWith(t) ? 3 : a2.includes(bare) || ti.includes(t) ? 2 : 0; if (sc) sites.push({ kind: 'site', url: hostedUrl(hs), title: hs.title, addr: hs.host, sc }); }
  sites.sort((a, b) => b.sc - a.sc);
  out.push(...sites.slice(0, 5));
  if (!/^[a-z]+:/.test(t)) {
    const r = search(text, { prefix: true });
    for (const x of r.results) { if (out.length >= 10) break; if (!out.some(o => o.url === x.doc.url)) out.push({ kind: 'page', tag: SUGG_TAG(x.doc), url: x.doc.url, title: x.doc.meta.title, addr: displayUrl(x.doc.url) }); }
    out.push({ kind: 'search', url: 'http://www.hyperhound.com/search?q=' + encodeURIComponent(text.trim()), title: 'Search HyperHound for “' + text.trim() + '”' });
  }
  return out;
}
const SUGG_TAG = d => d.kind === 'html' ? 'PAGE' : d.kind === 'audio' ? 'SONG' : d.kind === 'video' ? 'VIDEO' : d.kind === 'image' ? 'PIC' : K(d).cls === 'document' ? badgeFor(d) : 'FILE';
function showSuggest(list, header) {
  sugItems = list;
  sugIdx = -1;
  if (!list.length) { hideSuggest(); return; }
  sug.innerHTML = (header ? '<div class="sg-h">' + esc(header) + '</div>' : '') + list.map((s, i) => '<div class="sg" role="option" data-i="' + i + '">' +
    (s.kind === 'search' ? '<span class="tag">SEARCH</span><b>' + esc(s.title) + '</b>' : s.kind === 'typed' ? '<span>' + esc(s.title) + '</span>' : '<span class="tag">' + (s.kind === 'site' ? 'SITE' : esc(s.tag || 'PAGE')) + '</span><b>' + esc(clip(s.title, 60)) + '</b><span class="u">' + esc(s.addr) + '</span>') + '</div>').join('');
  sug.hidden = false;
}
function moveSuggest(d) {
  const els = $$('.sg', sug);
  if (!els.length) return;
  sugIdx = (sugIdx + d + els.length) % els.length;
  els.forEach((e, i) => e.classList.toggle('on', i === sugIdx));
  els[sugIdx].scrollIntoView({ block: 'nearest' });
  loc.value = sugItems[sugIdx].kind === 'search' ? loc.dataset.typed : sugItems[sugIdx].url;
}
const updateSuggest = debounce(() => { if (document.activeElement === loc && loc.value.trim() && loc.dataset.typed === loc.value) showSuggest(suggestions(loc.value)); }, 90);
loc.addEventListener('input', () => { loc.dataset.typed = loc.value; updateSuggest(); });
let selectOnUp = false;
loc.addEventListener('focus', () => { selectOnUp = true; });
loc.addEventListener('mouseup', e => { if (selectOnUp) { selectOnUp = false; if (loc.selectionStart === loc.selectionEnd) { e.preventDefault(); loc.select(); } } });
loc.addEventListener('blur', () => { selectOnUp = false; loc.dataset.typed = ''; setTimeout(() => { if (document.activeElement !== loc) hideSuggest(); }, 150); });
loc.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); if (sug.hidden) showSuggest(suggestions(loc.value || '')); else moveSuggest(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveSuggest(-1); }
  else if (e.key === 'Escape') { hideSuggest(); loc.value = S.cur ? S.cur.url : ''; loc.blur(); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    const pick = sugIdx >= 0 ? sugItems[sugIdx] : null;
    const val = pick ? pick.url : loc.value;
    if (!pick && loc.value.trim()) { S.typed = [loc.value.trim(), ...S.typed.filter(x => x !== loc.value.trim())].slice(0, 15); saveState(); }
    hideSuggest(); loc.blur();
    if (e.metaKey || e.ctrlKey) { const n = normalizeInput(val); if (n) openNewWindow(n); } else go(val, { typed: true });
  }
});
sug.addEventListener('mousedown', e => {
  const r = e.target.closest('.sg');
  if (!r) return;
  e.preventDefault();
  const s = sugItems[+r.dataset.i];
  hideSuggest(); loc.blur();
  go(s.url, { typed: true });
});
$('#locDrop').addEventListener('mousedown', e => {
  e.preventDefault();
  if (!sug.hidden) { hideSuggest(); return; }
  const typed = (S.typed || []).map(t => ({ kind: 'typed', url: t, title: t }));
  const recent = S.history.slice(0, 8).map(h => ({ kind: 'page', url: h.url, title: h.title || h.url, addr: displayUrl(h.url) }));
  showSuggest(typed.length ? typed : recent, typed.length ? 'Recently typed' : 'Recently visited');
});

/* ---------------- Explorer sidebar ---------------- */
const SIDE_TABS = [['search', 'Search'], ['rings', 'Rings'], ['history', 'History'], ['bookmarks', 'Bookmarks'], ['related', 'Related']];
function buildSidebar() {
  const tabs = $('#sbTabs');
  for (const [k, l] of SIDE_TABS) {
    const b = el('button', { class: 'tab', role: 'tab', text: l, 'data-tab': k });
    b.addEventListener('click', () => { S.prefs.sideTab = k; saveState(); refreshSidebar(true); });
    tabs.append(b);
  }
  $('#sbClose').addEventListener('click', () => { S.prefs.sidebar = false; saveState(); applyChrome(); });
  $('#sbPanes').addEventListener('click', e => {
    const x = e.target.closest('[data-del]');
    if (x) { e.stopPropagation(); S.bookmarks.splice(+x.dataset.del, 1); saveState(); refreshSidebar(true); return; }
    const r = e.target.closest('[data-toggle]');
    if (r) { const k = r.dataset.toggle; openRingsInTree.has(k) ? openRingsInTree.delete(k) : openRingsInTree.add(k); refreshSidebar(true); return; }
    const a = e.target.closest('[data-go]');
    if (a) go(a.dataset.go);
  });
}
const openRingsInTree = new Set();
let sideQuery = '';
function refreshSidebar(force) {
  if (!S.prefs.sidebar) return;
  const tab = S.prefs.sideTab || 'search';
  $$('#sbTabs .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const panes = $('#sbPanes');
  if (!force && tab === 'search' && panes.dataset.tab === 'search') return;
  panes.dataset.tab = tab;
  const cur = S.cur;
  if (tab === 'search') {
    panes.innerHTML = '<div class="pane"><input class="field" id="sbq" type="search" placeholder="Search your LANscape..." aria-label="Search"><div class="hint" id="sbqInfo"></div><div class="list" id="sbqList"></div></div>';
    const q = $('#sbq');
    q.value = sideQuery;
    const run = () => {
      sideQuery = q.value;
      const L = $('#sbqList'), info = $('#sbqInfo');
      if (!q.value.trim()) { L.innerHTML = '<div class="empty">Type to search every page instantly.<br>Press Enter for full HyperHound results.</div>'; info.textContent = ''; return; }
      const r = search(q.value, { prefix: true });
      info.textContent = r.total + ' page' + (r.total === 1 ? '' : 's') + ' in ' + r.ms.toFixed(1) + ' ms' + (r.suggestion ? ' · did you mean “' + r.suggestion + '”?' : '');
      L.innerHTML = r.results.slice(0, 60).map(({ doc }) => '<div class="li" data-go="' + esc(doc.url) + '">' + (S.prefs.previews && S.thumbs.has(doc.path) ? '<img class="th" src="' + S.thumbs.get(doc.path) + '" alt="">' : '') +
        '<div><span class="t">' + esc(doc.meta.title) + '</span><span class="u">' + esc(displayUrl(doc.url)) + '</span><span class="s">' + snippet(doc, r.stems, 120) + '</span></div></div>').join('') || '<div class="empty">No matches.</div>';
    };
    q.addEventListener('input', debounce(run, 60));
    q.addEventListener('keydown', e => { if (e.key === 'Enter' && q.value.trim()) go('http://www.hyperhound.com/search?q=' + encodeURIComponent(q.value.trim())); });
    run();
  } else if (tab === 'rings') {
    const curRing = cur && cur.site && cur.site.ring;
    if (curRing) openRingsInTree.add(curRing.id);
    panes.innerHTML = '<div class="pane"><div class="hint">' + S.rings.length + ' rings · ' + S.sites.length + ' sites</div><div class="list tree">' + S.rings.map(r =>
      '<div class="ring" data-toggle="' + esc(r.id) + '"><span class="dot" style="background:' + r.color + '"></span>' + (openRingsInTree.has(r.id) ? '▾' : '▸') + ' ' + esc(r.name) + '<span class="n">' + r.sites.length + '</span></div>' +
      (openRingsInTree.has(r.id) ? '<div class="kids">' + r.sites.map(s => '<div class="kid' + (cur && cur.site === s ? ' on' : '') + '" data-go="' + esc(s.url) + '" title="' + esc(displayUrl(s.url)) + '">' + esc(s.title) + '</div>').join('') + '</div>' : '')).join('') + '</div></div>';
  } else if (tab === 'history') {
    const groups = [['Today', 0], ['Yesterday', 1], ['Earlier', 2]];
    const today = dayKey(), yday = dayKey(Date.now() - 864e5);
    const bucket = h => (dayKey(h.ts) === today ? 0 : dayKey(h.ts) === yday ? 1 : 2);
    panes.innerHTML = '<div class="pane"><div class="list">' + (groups.map(([name, i]) => {
      const list = S.history.filter(h => bucket(h) === i).slice(0, 120);
      return list.length ? '<div class="sg-h">' + name + '</div>' + list.map(h => '<div class="li" data-go="' + esc(h.url) + '"><div><span class="t">' + esc(h.title || displayUrl(h.url)) + '</span><span class="u">' + esc(displayUrl(h.url)) + ' · ' + esc(new Date(h.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) + '</span></div></div>').join('') : '';
    }).join('') || '<div class="empty">No history yet.</div>') + '</div></div>';
  } else if (tab === 'bookmarks') {
    panes.innerHTML = '<div class="pane"><button class="btn" id="sbAddBm" type="button">Add This Page</button><div class="list">' + ((S.bookmarks || []).map((b, i) => '<div class="li" data-go="' + esc(b.url) + '"><div><span class="t">' + esc(b.title || b.url) + '</span><span class="u">' + esc(displayUrl(b.url)) + '</span></div><button class="x" data-del="' + i + '" title="Delete bookmark" aria-label="Delete bookmark">✕</button></div>').join('') || '<div class="empty">No bookmarks.</div>') + '</div></div>';
    $('#sbAddBm').addEventListener('click', addBookmark);
  } else if (tab === 'related') {
    const doc = cur && cur.doc;
    if (!doc) { panes.innerHTML = '<div class="pane"><div class="empty">Open one of your pages to see what\'s related to it.</div></div>'; return; }
    const rel = relatedDocs(doc, 14);
    panes.innerHTML = '<div class="pane"><div class="hint">Pages that use the same words as <b>' + esc(clip(doc.meta.title, 50)) + '</b></div><div class="list">' + (rel.map(([d, s]) =>
      '<div class="li" data-go="' + esc(d.url) + '">' + (S.thumbs.has(d.path) ? '<img class="th" src="' + S.thumbs.get(d.path) + '" alt="">' : '<img class="b88" src="' + siteButton(d.site) + '" alt="">') +
      '<div style="flex:1;min-width:0"><span class="t">' + esc(d.meta.title) + '</span><span class="u">' + esc(displayUrl(d.url)) + '</span><span class="s">shares: ' + esc(sharedTerms(doc.vec, d.vec, 4).join(', ')) + '</span><span class="bar"><i style="width:' + Math.round(Math.min(1, s * 1.6) * 100) + '%"></i></span></div></div>').join('') || '<div class="empty">Nothing similar yet.</div>') + '</div></div>';
  }
}

/* ---------------- actions & shortcuts ---------------- */
async function runAction(a) {
  a = String(a).replace(/^\/+/, '');
  if (a === 'open-folder' || a === 'add-folder') return openFolder();
  if (a === 'folders') return FolderManager.open();
  if (a === 'resync') return resyncAll();
  if (a === 'spider') return Spider.start();
  if (a === 'dns') return openDNS();
  if (a === 'rings') return openRingManager();
  if (a === 'prefs') return openPrefs();
  if (a === 'dialup') return dialUp();
  if (a === 'clear-cache') return clearCache();
  if (a === 'lanamp') return LANamp.toggle(true);
  if (a === 'open-file') { const d = await openFileDialog({ title: 'Open File' }); if (d) go(d.url); return; }
  if (a === 'edit-source') return editSource();
  if (a === 'dupes') return go('http://dupes.lanscape.net/');
  const hf = /^hosted-full\?id=(.+)$/.exec(a);
  if (hf) { const hs = HOSTED_SITES.find(s => s.id === hf[1]); if (hs) window.open(hostedBase(hs), '_blank', 'noopener'); return; }
  // from a site's version history page: make one the main entry, or say it's its own thing
  const dm = /^dupes-(keep|split|unsplit)\?p=(.+)$/.exec(a);
  if (dm) {
    let p = dm[2];
    try { p = decodeURIComponent(p); } catch (e) { /* keep */ }
    const d = S.docs.get(p);
    if (!d) { setStatus('That file is no longer on your LANscape.'); return; }
    if (dm[1] === 'keep') { foldKeep(p); go(d.url, { replace: true }); setStatus(prettyName(d.name) + ' is now the main entry.'); }
    else if (dm[1] === 'split') { if (await foldSplitAsk(d)) reload(); }
    else { foldUnsplit(p); reload(); }
    return;
  }
  setStatus('Unknown LANscape action: ' + a);
}
function handleKey(e, fromFrame) {
  const k = e.key, mod = e.ctrlKey || e.metaKey;
  const lower = typeof k === 'string' ? k.toLowerCase() : '';
  if ((e.altKey && k === 'ArrowLeft') || (e.metaKey && k === '[')) { back(); return true; }
  if ((e.altKey && k === 'ArrowRight') || (e.metaKey && k === ']')) { forward(); return true; }
  if (e.altKey && k === 'Home') { goHome(); return true; }
  if (k === 'F5' || (mod && lower === 'r' && !e.shiftKey)) { reload(); return true; }
  if (k === 'F6' || (mod && lower === 'l')) { focusLoc(); return true; }
  if (mod && lower === 'd') { addBookmark(); return true; }
  if (mod && lower === 'u') { viewSource(); return true; }
  if (mod && lower === 'i') { pageInfo(); return true; }
  if (fromFrame) return false;
  if (mod && lower === 'o') { openFolder(); return true; }
  if (mod && lower === 'b') { S.prefs.sidebar = !S.prefs.sidebar; saveState(); applyChrome(); return true; }
  if (mod && lower === 'k') { S.prefs.sidebar = true; S.prefs.sideTab = 'search'; saveState(); applyChrome(); setTimeout(() => { const q = $('#sbq'); if (q) q.focus(); }, 20); return true; }
  if (mod && lower === 'f') { Finder.open(); return true; }
  if (k === 'F3') { Finder.again(); return true; }
  if (mod && lower === 's') { savePage(); return true; }
  if (mod && e.shiftKey && lower === 'e') { editSource(); return true; }
  if (mod && lower === 'p') { printPage(); return true; }
  if (k === 'Escape') { if (Wins.length) { Wins[Wins.length - 1].close(null); return true; } if (openMenuIdx >= 0) { closeMenus(); return true; } stop(); return true; }
  return false;
}
document.addEventListener('keydown', e => {
  if (e.target === loc && !(e.ctrlKey || e.metaKey || e.altKey) && e.key !== 'Escape' && e.key !== 'F5' && e.key !== 'F6') return;
  const inField = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target !== loc;
  if (inField && !(e.ctrlKey || e.metaKey) && e.key !== 'Escape') return;
  if (inField && e.key === 'Escape' && !Wins.length) return;
  if (handleKey(e, false)) e.preventDefault();
});

/* ---------------- small commands ---------------- */
function copyText(t) {
  if (!t) return;
  const done = () => setStatus('Copied: ' + clip(t, 100));
  try { navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done)); } catch (e) { fallbackCopy(t, done); }
}
function fallbackCopy(t, done) {
  const ta = el('textarea', { style: { position: 'fixed', left: '-9999px' } });
  ta.value = t; document.body.append(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { setStatus('Copy failed. Select the text and copy it yourself.'); }
  ta.remove();
}
function addBookmark() {
  if (!S.cur) return;
  const url = S.cur.url, title = S.cur.title || displayUrl(url);
  S.bookmarks = S.bookmarks || [];
  if (!S.bookmarks.some(b => b.url === url)) S.bookmarks.push({ url, title, ts: Date.now() });
  saveState();
  setStatus('Bookmark added: ' + title);
  refreshSidebar(true);
}
async function currentSource() {
  const cur = S.cur;
  if (!cur) return '';
  if (cur.doc && isTextKind(cur.doc.kind)) { try { return String(await getText(cur.doc)); } catch (e) { return ''; } }
  return cur.route && typeof cur.route.html === 'string' ? cur.route.html : cur.html || (cur.appName ? '<!-- ' + ((APPS[cur.appName] || {}).name || 'A LANscape program') + ' is showing ' + (cur.doc ? cur.doc.name : 'this page') + '. It runs inside LANscape, so there is no HTML file to show. -->' : '');
}
function download(name, blob) {
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
async function savePage() {
  const cur = S.cur;
  if (!cur) return;
  if (cur.app && cur.app.save) { await cur.app.save(); return; }
  if (cur.doc && !isTextKind(cur.doc.kind)) { const b = await getBlob(cur.doc); download(cur.doc.name, b); return; }
  const src = await currentSource();
  const name = cur.doc ? cur.doc.name : (slug(cur.title || 'page') + '.html');
  download(name, new Blob([src], { type: 'text/html' }));
  setStatus('Saved ' + name + ' to your Downloads.');
}
/** open the file behind this page in Notepad (handy for single-file tools) */
function editSource() {
  const d = S.cur && S.cur.doc;
  if (!d || !isTextKind(d.kind)) { setStatus('Only pages and text files can be edited in Notepad.'); return; }
  go('http://notepad.lanscape.net/edit?url=' + encodeURIComponent(d.url));
}
function printPage() {
  if (!S.cur) return;
  try { if (S.prefs.sandbox !== 'sandboxed') { frame.contentWindow.focus(); frame.contentWindow.print(); return; } } catch (e) { /* fall back */ }
  postToFrame({ cmd: 'print' });
}
async function viewSource() {
  if (!S.cur) return;
  const src = await currentSource();
  const pre = el('pre', { class: 'source' });
  const MAXC = 400000;
  const body = src.length > MAXC ? src.slice(0, MAXC) : src;
  pre.innerHTML = colorize(body) + (src.length > MAXC ? '\n\n<span class="cm">… ' + fmtBytes(src.length - MAXC) + ' more. Use File &gt; Save Page As to see everything.</span>' : '');
  openWin({
    title: 'Source of: ' + S.cur.url, body: pre, width: 'min(1000px, 96vw)', modal: false,
    buttons: [{ label: 'Copy All', onClick: () => { copyText(src); return false; } }, { label: 'Save As...', onClick: () => { savePage(); return false; } }, { label: 'Close', primary: true }]
  });
}
function colorize(src) {
  const out = [];
  const re = /(<!--[\s\S]*?-->)|(<!doctype[^>]*>)|(<\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?>)|([^<]+|<)/gi;
  let m, n = 0;
  while ((m = re.exec(src)) && n++ < 300000) {
    if (m[1]) out.push('<span class="cm">' + esc(m[1]) + '</span>');
    else if (m[2]) out.push('<span class="dt">' + esc(m[2]) + '</span>');
    else if (m[4]) {
      const attrs = esc(m[5]).replace(/([\w:-]+)(=)(&quot;[\s\S]*?&quot;|&#39;[\s\S]*?&#39;|[^\s&]+)/g, '<span class="at">$1</span>$2<span class="st">$3</span>');
      out.push('<span class="tg">' + esc(m[3] + m[4]) + '</span>' + attrs + '<span class="tg">' + esc(m[6]) + '</span>');
    } else out.push(esc(m[7]));
  }
  return out.join('');
}
function pageInfo() {
  const cur = S.cur;
  if (!cur) return;
  const d = cur.doc;
  const wrap = el('div', { style: { maxWidth: '640px' } });
  if (!d) {
    wrap.innerHTML = '<dl class="kv"><dt>Title</dt><dd>' + esc(cur.title || '—') + '</dd><dt>Location</dt><dd class="mono">' + esc(cur.url) + '</dd><dt>Type</dt><dd>Generated by LANscape (' + fmtBytes((cur.html || '').length) + ')</dd></dl>';
  } else {
    const inbound = docsAll().filter(x => x !== d && x.site && (x.meta.links || []).some(h => { try { const p = resolveFsPath(/^\//.test(h) ? x.site.dir : x.dir, h.split('#')[0].split('?')[0]); return p === d.path; } catch (e) { return false; } }));
    const rel = relatedDocs(d, 5);
    const kw = (d.kw || []).slice(0, 14).map((s, i) => '<span class="chip" title="weight ' + (d.kwScore[i] || 0).toFixed(1) + '">' + esc(surface(s)) + '</span>').join('');
    const r = d.site ? d.site.ring : null;
    wrap.innerHTML = '<div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">' + (S.thumbs.has(d.path) ? '<img src="' + S.thumbs.get(d.path) + '" alt="" style="width:160px;border:1px solid var(--shadow);flex:none">' : d.site ? '<img src="' + siteButton(d.site) + '" alt="" style="width:88px;height:31px;image-rendering:pixelated">' : '<span style="flex:none">' + iconFor(d).replace('width="16" height="16"', 'width="48" height="48"') + '</span>') +
      '<dl class="kv" style="flex:1;min-width:260px"><dt>Title</dt><dd><b>' + esc(d.meta.title) + '</b></dd><dt>Location</dt><dd class="mono">' + esc(d.url) + '</dd><dt>File</dt><dd class="mono">' + esc(d.path) + '</dd>' +
      '<dt>Type</dt><dd>' + esc(K(d).label) + (d.asset ? ' (part of a website)' : '') + '</dd><dt>FTP</dt><dd class="mono">' + esc(d.ftp || '') + '</dd>' +
      '<dt>Size</dt><dd>' + fmtBytes(d.size) + ' · ' + (Math.max(d.meta.words || 0, d.meta.deepWords || 0)).toLocaleString() + ' words' + (d.meta.jsBytes ? ' · ' + fmtBytes(d.meta.jsBytes) + ' of script' : '') + '</dd>' +
      '<dt>Modified</dt><dd>' + esc(fmtDate(d.mtime, true)) + '</dd><dt>First seen</dt><dd>' + esc(fmtDate(S.firstSeen[d.path] || d.mtime, true)) + '</dd>' +
      '<dt>Web ring</dt><dd>' + (r ? esc(r.name) + ' (site ' + (d.site.ringPos + 1) + ' of ' + r.sites.length + ')' : '—') + '</dd><dt>Visits</dt><dd>' + (S.visits[d.path] || 0) + '</dd>' +
      '<dt>Indexed</dt><dd>' + (d.meta.deep ? 'Live text captured ' + esc(fmtDate(d.indexedAt, true)) : 'Static text only (send out the Spider for more)') + '</dd>' +
      '<dt>Links</dt><dd>' + (d.meta.links || []).length + ' out · ' + inbound.length + ' in' + (inbound.length ? ' (' + inbound.slice(0, 4).map(x => esc(clip(x.meta.title, 30))).join(', ') + ')' : '') + '</dd>' +
      (d.fold ? '<dt>' + (d.fold.cls === 'site' && d.fold.reason !== 'copy' ? 'Versions' : 'Copies') + '</dt><dd>' + (d === d.fold.primary ? 'Main entry · ' : esc(d.vlabel || '') + ' · ') + esc(foldWhy(d)) + ' · <a href="#" data-go="' + esc(dupesUrl(d.fold)) + '">Duplicate Finder</a></dd>' : '') +
      '</dl></div>' +
      '<p style="margin:10px 0 4px"><b>Top keywords</b></p><div class="chips">' + kw + '</div>' +
      '<p style="margin:10px 0 4px"><b>Most similar</b></p><div>' + rel.map(([x, s]) => '<div>' + Math.round(s * 100) + '% · <a href="#" data-go="' + esc(x.url) + '">' + esc(x.meta.title) + '</a></div>').join('') + '</div>';
  }
  const w = openWin({ title: 'Page Info', body: wrap, width: 'min(700px, 96vw)', buttons: d ? [d.site ? { label: 'Rename Domain...', onClick: () => { openDNS(d.site.key); } } : null, isTextKind(d.kind) ? { label: 'View Source', onClick: () => { viewSource(); } } : null, { label: 'Close', primary: true }].filter(Boolean) : [{ label: 'Close', primary: true }] });
  w.body.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); w.close(); go(a.dataset.go); } });
}
function aboutBox() {
  const t = totals();
  openWin({
    title: 'About LANscape Navigator', width: 'min(520px, 96vw)', buttons: [{ label: 'OK', primary: true }],
    body: '<div style="text-align:center"><div style="overflow:hidden;max-width:100%">' + lanscapeBanner() + '</div><p><b>LANscape Navigator ' + VERSION + '</b><br>The serverless browser for the hypertext on your own disk.</p><p>' + t.sites + ' sites · ' + t.pages + ' pages · ' + t.rings + ' web rings · ' + t.terms.toLocaleString() + ' words indexed</p><p class="hint">Everything runs inside this one HTML file. No servers, no uploads, no tracking.<br>Storage: ' + (DB.ok ? 'IndexedDB (cached pages survive a restart)' : 'memory only') + '.</p></div>'
  });
}

/* ---------------- Find ---------------- */
const Finder = {
  w: null, q: '', cs: false, back: false,
  open() {
    if (this.w && this.w.el.isConnected) { $('#findq').focus(); return; }
    const body = el('div', { html: '<div class="frow"><label for="findq">Find what:</label><input class="field" id="findq" style="flex:1;min-width:180px" value="' + esc(this.q) + '"></div><div class="frow"><label class="check"><input type="checkbox" id="findcs"' + (this.cs ? ' checked' : '') + '> Match case</label><label class="check"><input type="checkbox" id="findup"' + (this.back ? ' checked' : '') + '> Search up</label></div><div class="hint" id="findmsg"></div>' });
    this.w = openWin({ title: 'Find', body, modal: false, width: 'min(400px, 94vw)', buttons: [{ label: 'Find Next', primary: true, onClick: () => { this.next(); return false; } }, { label: 'Cancel' }] });
    $('#findq').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.next(); } });
  },
  next() {
    this.q = $('#findq') ? $('#findq').value : this.q;
    this.cs = $('#findcs') ? $('#findcs').checked : this.cs;
    this.back = $('#findup') ? $('#findup').checked : this.back;
    if (!this.q) return;
    postToFrame({ cmd: 'find', q: this.q, cs: this.cs, back: this.back });
  },
  again() { if (this.q) postToFrame({ cmd: 'find', q: this.q, cs: this.cs, back: this.back }); else this.open(); },
  result(ok, i, n) {
    const m = $('#findmsg');
    if (m) m.textContent = ok ? 'Match ' + i + ' of ' + n : 'Search string not found.';
    setStatus(ok ? 'Found “' + this.q + '”: ' + i + ' of ' + n : 'Search string “' + this.q + '” not found.');
  }
};

/* ---------------- DNS / external-link prompts ---------------- */
async function dnsError(host, url, opts = {}) {
  setStatus('Unable to locate the server: ' + host);
  busy(false);
  const looksReal = /\.[a-z]{2,}$/i.test(host) && !/\.(local|lan)$/i.test(host);
  const words = String(host).replace(/^www\./, '').replace(/\.[a-z.]+$/, '').replace(/[-_.]+/g, ' ');
  const btns = [{ label: 'Search HyperHound', value: 'search' }];
  if (looksReal) btns.push({ label: 'Try the Real Internet', value: 'real' });
  btns.push({ label: 'OK', value: 'ok', primary: true });
  const v = await msgBox('error', 'LANscape', '<p><b>LANscape is unable to locate the server ' + esc(host) + '.</b></p><p>The server has no DNS entry on your LANscape. Check the name in the Location bar and try again.</p><p class="hint">Your pages live at names like <span class="mono">' + esc(S.sites[0] ? S.sites[0].host : 'www.example.com') + '</span>. See them all in the DNS Manager.</p>', btns);
  if (v === 'search') go('http://www.hyperhound.com/search?q=' + encodeURIComponent(words));
  else if (v === 'real') window.open(url, '_blank', 'noopener');
  else if (S.cur) setLocation(S.cur.url);
}
async function leaveLAN(url) {
  if (!S.prefs.confirmExternal) { window.open(url, '_blank', 'noopener'); return; }
  const body = el('div', { html: '<p>This link leaves your LANscape and goes out to the real Internet:</p><p class="mono" style="word-break:break-all"><b>' + esc(url) + '</b></p><label class="check"><input type="checkbox" id="extNoAsk"> Don\'t ask me again</label>' });
  const w = openWin({ title: 'Leaving LANscape', body: el('div', { class: 'msg' }, el('span', { html: ICON.question }), body), width: 'min(480px, 94vw)', buttons: [{ label: 'Open in New Tab', value: 'open', primary: true }, { label: 'Cancel', value: null }] });
  const v = await w.result;
  if ($('#extNoAsk', body) && $('#extNoAsk', body).checked) { S.prefs.confirmExternal = false; saveState(); }
  if (v === 'open') window.open(url, '_blank', 'noopener');
}

/* ---------------- DNS Manager ---------------- */
function openDNS(focusKey) {
  const body = el('div');
  body.innerHTML = '<p class="note">Every site on your LANscape has a domain name. Type a new one and press Enter. A folder with an <span class="mono">index.html</span> is one site; everything else is one site per page.</p>' +
    '<div class="frow"><label for="dnsFilter">Filter:</label><input class="field" id="dnsFilter" style="flex:1;min-width:160px" placeholder="title, domain or file"><label for="dnsScheme">Domain style:</label><select class="field" id="dnsScheme"><option value="vanity">Vanity .com domains</option><option value="hoods">Netropolis neighborhoods</option><option value="tilde">~tilde member pages</option></select></div>' +
    '<div class="tscroll"><table class="grid-table"><thead><tr><th>Address</th><th>Title</th><th>Ring</th><th>Pages</th></tr></thead><tbody id="dnsRows"></tbody></table></div><div class="hint" id="dnsMsg" style="margin-top:6px"></div>';
  const fill = () => {
    const f = ($('#dnsFilter', body).value || '').toLowerCase();
    const rows = S.sites.filter(s => !f || (s.title + ' ' + s.host + s.base + ' ' + s.key).toLowerCase().includes(f));
    $('#dnsRows', body).innerHTML = rows.map(s => '<tr data-key="' + esc(s.key) + '"><td><input class="field" value="' + esc(s.host + (s.base !== '/' ? s.base : '')) + '" aria-label="Address for ' + esc(s.title) + '">' + (S.dns[s.key] ? ' <button class="btnsm raised" data-reset="1" title="Back to the automatic name">Auto</button>' : '') + '</td><td>' + esc(clip(s.title, 48)) + '<div class="hint mono">' + esc(s.group ? s.dir : s.index.path) + '</div></td><td>' + esc(s.ring ? clip(s.ring.name, 30) : '') + '</td><td>' + s.docs.length + '</td></tr>').join('');
  };
  const w = openWin({ title: 'DNS Manager', body, width: 'min(940px, 96vw)', buttons: [{ label: 'Export Hosts File', onClick: () => { exportHosts(); return false; } }, { label: 'Close', primary: true }] });
  $('#dnsScheme', body).value = S.prefs.scheme;
  $('#dnsScheme', body).addEventListener('change', e => { S.prefs.scheme = e.target.value; saveState(); relayDNS(); afterDNSChange(); fill(); $('#dnsMsg', body).textContent = 'Domain style changed. Custom names you typed are kept.'; });
  $('#dnsFilter', body).addEventListener('input', fill);
  const commit = inp => {
    const tr = inp.closest('tr'), key = tr.dataset.key, site = S.siteByKey.get(key);
    const a = parseAddr(inp.value);
    const msg = $('#dnsMsg', body);
    if (!a) { inp.classList.add('bad'); msg.textContent = 'That isn’t a valid host name. Try something like www.mysite.com'; return; }
    if (PORTAL_HOSTS.has(a.host) && a.base === '/') { inp.classList.add('bad'); msg.textContent = a.host + ' belongs to a LANscape portal.'; return; }
    const clash = S.sites.find(s => s !== site && s.host === a.host && (s.base === a.base || a.base === '/' || s.base === '/'));
    if (clash) { inp.classList.add('bad'); msg.textContent = a.host + ' is already used by ' + clash.title + '.'; return; }
    inp.classList.remove('bad');
    S.dns[key] = a.host + a.base;
    saveState();
    relayDNS();
    afterDNSChange();
    msg.textContent = site.title + ' now lives at http://' + site.host + site.base;
    fill();
  };
  body.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('#dnsRows input')) { e.preventDefault(); commit(e.target); } });
  body.addEventListener('change', e => { if (e.target.matches('#dnsRows input')) commit(e.target); });
  body.addEventListener('click', e => { const b = e.target.closest('[data-reset]'); if (b) { delete S.dns[b.closest('tr').dataset.key]; saveState(); relayDNS(); afterDNSChange(); fill(); } });
  fill();
  if (focusKey) setTimeout(() => { const tr = $('#dnsRows tr[data-key="' + CSS.escape(focusKey) + '"]', body); if (tr) { tr.classList.add('sel'); tr.scrollIntoView({ block: 'center' }); const i = $('input', tr); i.focus(); i.select(); } }, 60);
  return w;
}
function afterDNSChange() {
  if (S.cur && S.cur.doc && !(S.cur.route && S.cur.route.url) && S.cur.route && S.cur.route.type === 'doc') {
    S.cur.site = S.cur.doc.site || S.cur.doc.home || null;
    if (S.cur.doc.active) { S.cur.url = S.cur.doc.url + (/#/.test(S.cur.url) ? '#' + S.cur.url.split('#')[1] : ''); S.cur.entry.url = S.cur.url; setLocation(S.cur.url, S.cur.doc.meta.favicon); pushReal(S.cur.url, true); }
  }
  for (const e of S.tab.stack) if (e.path && S.docs.get(e.path)) e.url = S.docs.get(e.path).url;
  renderRingStrip();
  renderVerBar();
  refreshSidebar(true);
}
function exportHosts() {
  const lines = ['# LANscape hosts file - ' + new Date().toISOString(), '# address            host                                   file'];
  for (const s of S.sites) lines.push('127.0.0.1   ' + (s.host + (s.base !== '/' ? s.base : '')).padEnd(40) + ' # ' + (s.group ? s.dir : s.index.path));
  download('hosts.txt', new Blob([lines.join('\n') + '\n'], { type: 'text/plain' }));
}

/* ---------------- Ring Manager ---------------- */
function openRingManager() {
  let sel = (S.cur && S.cur.site && S.cur.site.ring && S.cur.site.ring.key) || (S.rings[0] && S.rings[0].key);
  const body = el('div');
  body.innerHTML = '<div class="frow"><label for="rmGran">Ring size:</label><span class="hint">more, smaller rings</span><input type="range" id="rmGran" min="0.3" max="2.6" step="0.1" style="flex:1;min-width:120px;direction:rtl" aria-label="Ring size"><span class="hint">fewer, bigger rings</span><b id="rmCount"></b></div>' +
    '<div class="cols2" style="margin-top:8px"><div><div class="ringlist" id="rmList"></div><div class="frow"><button class="btn" id="rmNew" type="button">New Ring</button><button class="btn" id="rmDel" type="button">Delete</button></div></div>' +
    '<div style="min-width:0"><div class="frow"><label for="rmName">Ring name:</label><input class="field" id="rmName" style="flex:1;min-width:160px"><button class="btn" id="rmRename" type="button">Rename</button></div><div class="frow" id="rmIdeas" style="flex-wrap:wrap;gap:4px;align-items:center"></div><div class="tscroll" style="max-height:40vh"><table class="grid-table"><thead><tr><th>Site</th><th>Move to</th></tr></thead><tbody id="rmMembers"></tbody></table></div><div class="hint" id="rmMsg"></div></div></div>';
  const ringByKey = k => S.rings.find(r => r.key === k);
  const fill = () => {
    if (!ringByKey(sel) && S.rings[0]) sel = S.rings[0].key;
    $('#rmCount', body).textContent = S.rings.length + ' rings';
    $('#rmList', body).innerHTML = S.rings.map(r => '<div class="rl' + (r.key === sel ? ' on' : '') + '" data-k="' + esc(r.key) + '"><i style="background:' + r.color + '"></i><span>' + esc(r.name) + '</span><b>' + r.sites.length + '</b></div>').join('');
    const r = ringByKey(sel);
    $('#rmName', body).value = r ? r.name : '';
    // other names LANscape would give it, from the phrases and words its sites share
    const ideas = r && !r.wander && !r.custom ? uniq([r.autoName].concat((r.suggest || []).filter(c => c.score >= ((r.suggest[0] || {}).score || 0) * 0.4).slice(0, 6).map(c => 'The ' + c.label.replace(/^the\s+/i, '').replace(/\s+(web\s*)?ring$/i, '') + ' Ring'))).filter(t => t && t !== r.name).slice(0, 6) : [];
    $('#rmIdeas', body).innerHTML = (ideas.length ? '<span class="hint">Ideas:</span>' + ideas.map(t => '<button class="btn" type="button" style="min-width:0;padding:2px 8px" data-idea="' + esc(t) + '">' + esc(t) + '</button>').join('') : '') +
      (r && S.ringNames[r.key] ? '<button class="btn" type="button" style="min-width:0;padding:2px 8px" data-auto="1" title="Let LANscape name it again">Automatic Name</button>' : '');
    $('#rmDel', body).disabled = !(r && r.custom && r.key.startsWith('custom:'));
    const opts = S.rings.map(x => '<option value="' + esc(x.key) + '">' + esc(clip(x.name, 40)) + '</option>').join('');
    $('#rmMembers', body).innerHTML = r ? r.sites.map(s => '<tr data-site="' + esc(s.key) + '"><td>' + esc(clip(s.title, 46)) + '<div class="hint">' + esc(displayUrl(s.url)) + (S.ringMoves[s.key] ? ' · moved by you' : '') + '</div></td><td><select class="field">' + opts.replace('value="' + esc(r.key) + '"', 'value="' + esc(r.key) + '" selected') + '</select></td></tr>').join('') || '<tr><td colspan="2"><i>Empty ring. Move some sites here.</i></td></tr>' : '';
  };
  const rebuild = () => { rebuildRingsOnly(); fill(); };
  const w = openWin({ title: 'Ring Manager', body, width: 'min(900px, 96vw)', buttons: [{ label: 'Reset My Changes', onClick: () => { S.ringMoves = {}; S.ringNames = {}; S.customRings = []; S.prefs.granularity = 1; $('#rmGran', body).value = 1; saveState(); rebuild(); $('#rmMsg', body).textContent = 'Back to the automatic rings.'; return false; } }, { label: 'Close', primary: true }] });
  const g = $('#rmGran', body);
  g.value = S.prefs.granularity;
  g.addEventListener('input', debounce(() => { S.prefs.granularity = +g.value; saveState(); rebuild(); }, 120));
  $('#rmList', body).addEventListener('click', e => { const d = e.target.closest('[data-k]'); if (d) { sel = d.dataset.k; fill(); } });
  $('#rmMembers', body).addEventListener('change', e => {
    const tr = e.target.closest('tr'); if (!tr) return;
    S.ringMoves[tr.dataset.site] = e.target.value;
    saveState(); rebuild();
    $('#rmMsg', body).textContent = 'Moved. Manual moves stick even when the rings are rebuilt.';
  });
  $('#rmRename', body).addEventListener('click', () => { const v = $('#rmName', body).value.trim(); if (!v) return; S.ringNames[sel] = v; const c = S.customRings.find(x => x.key === sel); if (c) c.name = v; saveState(); rebuild(); });
  $('#rmName', body).addEventListener('keydown', e => { if (e.key === 'Enter') $('#rmRename', body).click(); });
  $('#rmIdeas', body).addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.auto) delete S.ringNames[sel]; else S.ringNames[sel] = b.dataset.idea;
    saveState(); rebuild();
  });
  $('#rmNew', body).addEventListener('click', () => { const key = 'custom:' + Date.now().toString(36); S.customRings.push({ key, name: 'My New Ring ' + (S.customRings.length + 1) }); sel = key; saveState(); rebuild(); $('#rmName', body).focus(); $('#rmName', body).select(); });
  $('#rmDel', body).addEventListener('click', () => {
    S.customRings = S.customRings.filter(x => x.key !== sel);
    for (const k in S.ringMoves) if (S.ringMoves[k] === sel) delete S.ringMoves[k];
    delete S.ringNames[sel];
    saveState(); rebuild();
  });
  fill();
  return w;
}
function rebuildRingsOnly() {
  S.rings = buildRings(S.sites);
  S.ringById = new Map(S.rings.map(r => [r.id, r]));
  relayDNS();
  afterDNSChange();
}

/* ---------------- Preferences ---------------- */
function openPrefs() {
  const P = S.prefs;
  const body = el('div', { style: { maxWidth: '620px' } });
  const rad = (name, val, label, hint) => '<label class="check"><input type="radio" name="' + name + '" value="' + val + '"' + (P[name] === val ? ' checked' : '') + '><span>' + label + (hint ? '<br><span class="hint">' + hint + '</span>' : '') + '</span></label>';
  const cb = (key, label, hint) => '<label class="check"><input type="checkbox" data-pref="' + key + '"' + (P[key] ? ' checked' : '') + '><span>' + label + (hint ? '<br><span class="hint">' + hint + '</span>' : '') + '</span></label>';
  body.innerHTML =
    '<fieldset><legend>Appearance</legend>' + rad('theme', 'classic', 'Classic gray') + rad('theme', 'night', 'Night shift') + cb('showDir', 'Show the directory buttons') + cb('showRing', 'Show the web ring bar') + cb('sidebar', 'Show the Explorer sidebar') + '</fieldset>' +
    '<fieldset><legend>Network</legend><div class="frow"><label for="pSpeed">Connection speed</label><select class="field" id="pSpeed">' + Object.entries(SPEEDS).map(([k, v]) => '<option value="' + k + '"' + (P.speed === k ? ' selected' : '') + '>' + v.label + (k === 'lan' ? ' (instant)' : '') + '</option>').join('') + '</select></div>' + cb('sounds', 'Modem sounds', 'A little handshake chirp when pages load over a modem speed.') + cb('interstitial', 'Show "Hold on!" pages between ring sites') + cb('confirmExternal', 'Ask before opening real Internet links') + '</fieldset>' +
    '<fieldset><legend>Your web</legend>' + rad('scheme', 'vanity', 'Vanity domains', 'www.cayennetracker.com') + rad('scheme', 'hoods', 'Netropolis neighborhoods', 'www.netropolis.com/PokerAlley/4521/') + rad('scheme', 'tilde', '~tilde member pages', 'members.lanscape.net/~cayenne/') +
    cb('demo', 'Include the Demo Web') + cb('scriptIndex', 'Index text found inside scripts', 'Single-file apps keep most of their words in JavaScript.') +
    '<div class="frow" style="margin-top:6px"><label for="pFold">Duplicates</label><select class="field" id="pFold">' + [['off', 'Show every file, even copies'], ['copies', 'Fold exact copies only'], ['normal', 'Fold copies and versions (recommended)'], ['loose', 'Also fold close look-alikes']].map(([k, v]) => '<option value="' + k + '"' + ((P.fold || 'normal') === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select><a href="#" id="pDupes">Duplicate Finder...</a></div>' + '<p class="hint" style="margin:6px 0 0">Every file in your folders gets an address: pages and documents get domains, songs live at music.lanscape.net, videos at rewindvideo.com, pictures at photos.lanscape.net, and everything else on the folder\'s own FTP server.</p></fieldset>' +
    '<fieldset><legend>Programs</legend><div class="frow"><label for="pAuthor">Your name</label><input class="field" id="pAuthor" style="flex:1;min-width:200px" placeholder="Shown on PDF comments and new documents" value="' + esc(P.author || '') + '"></div></fieldset>' +
    '<fieldset><legend>Pages</legend>' + rad('sandbox', 'trusted', 'Trusted', 'Pages run like they do from disk and can use browser storage. Best for your own tools.') + rad('sandbox', 'sandboxed', 'Sandboxed', 'Pages are isolated from LANscape and each other. Pages that save data may break.') +
    cb('deep', 'Read pages as I browse', 'Captures the text a page actually shows, for better search.') + cb('previews', 'Capture page previews', 'Paints a small preview of each page for search results.') + '</fieldset>' +
    '<fieldset><legend>Start-up and storage</legend>' + rad('startup', 'home', 'Start on the LANscape home page') + rad('startup', 'last', 'Start on the last page I visited') +
    '<div class="frow"><label>Home page</label><input class="field" id="pHome" style="flex:1;min-width:200px" value="' + esc(P.homepage) + '"><button class="btn" id="pHomeCur" type="button">Use Current</button></div>' +
    cb('cache', 'Keep a copy of my pages in this browser', 'So your web still works after a restart without re-opening the folder.') + '<div class="frow"><button class="btn" id="pClear" type="button">Empty the Cache</button><span class="hint" id="pStore"></span></div></fieldset>';
  const w = openWin({ title: 'Preferences', body, width: 'min(680px, 96vw)', buttons: [{ label: 'Close', primary: true }] });
  const needRebuild = new Set(['demo', 'scheme', 'scriptIndex', 'fold']);
  body.addEventListener('change', e => {
    const t = e.target;
    let key = null;
    if (t.dataset.pref) { key = t.dataset.pref; P[key] = t.checked; }
    else if (t.type === 'radio') { key = t.name; P[key] = t.value; }
    else if (t.id === 'pSpeed') { key = 'speed'; P.speed = t.value; }
    else if (t.id === 'pFold') { key = 'fold'; P.fold = t.value; }
    else if (t.id === 'pHome') { key = 'homepage'; P.homepage = t.value.trim() || DEFAULT_PREFS.homepage; }
    else if (t.id === 'pAuthor') { key = 'author'; P.author = t.value.trim().slice(0, 60); }
    if (!key) return;
    saveState();
    applyChrome();
    if (needRebuild.has(key)) { rebuildAll(); if (key === 'fold') afterFolderChange(); else afterDNSChange(); if (key === 'demo') go('http://home.lanscape.net/'); }
    if (key === 'sandbox') reload();
  });
  $('#pDupes', body).addEventListener('click', e => { e.preventDefault(); w.close(); go('http://dupes.lanscape.net/'); });
  $('#pHomeCur', body).addEventListener('click', () => { if (S.cur) { P.homepage = S.cur.url; $('#pHome', body).value = S.cur.url; saveState(); } });
  $('#pClear', body).addEventListener('click', clearCache);
  if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(est => { const s = $('#pStore', body); if (s) s.textContent = 'Using ' + fmtBytes(est.usage || 0) + ' of browser storage.'; }).catch(() => { /* ignore */ });
  return w;
}

/* ---------------- dial-up networking ---------------- */
function dialUp(disconnected) {
  const body = el('div', { class: 'msg', html: ICON.modem + '<div><p id="duMsg">' + (disconnected ? 'You have been disconnected from LANscape.' : 'Connect to LANscape using a 56K modem.') + '</p><div class="sunken progress"><i id="duBar"></i></div><p class="hint" id="duHint">Dialing 555-1998 · Modem sounds play through your speakers.</p></div>' });
  let timers = [];
  const w = openWin({
    title: disconnected ? 'Connection Lost' : 'Dial-Up Networking', body, width: 'min(440px, 94vw)',
    onClose: () => timers.forEach(clearTimeout),
    buttons: [{ label: disconnected ? 'Reconnect' : 'Connect', primary: true, onClick: () => { connect(); return false; } }, { label: 'Cancel' }]
  });
  const connect = () => {
    const ms = Math.max(6500, dialUpSound() || 6500);
    const steps = [[0, 'Dialing...'], [ms * .25, 'Waiting for answer...'], [ms * .45, 'Negotiating...'], [ms * .75, 'Verifying username and password...'], [ms * .92, 'Logging on to network...']];
    steps.forEach(([t, m]) => timers.push(setTimeout(() => { const e1 = $('#duMsg', body); if (e1) e1.textContent = m; }, t)));
    const t0 = performance.now();
    const tick = () => { const p = Math.min(1, (performance.now() - t0) / ms); const b = $('#duBar', body); if (b) b.style.width = (p * 100) + '%'; if (p < 1 && w.el.isConnected) requestAnimationFrame(tick); };
    tick();
    timers.push(setTimeout(() => { const e1 = $('#duMsg', body); if (e1) e1.innerHTML = '<b>Connected at 53,333 bps.</b>'; setStatus('Connected at 53,333 bps.'); timers.push(setTimeout(() => w.close('ok'), 1200)); }, ms));
  };
  return w;
}

/* ---------------- progress dialog ---------------- */
function progressWin(title, msg) {
  const body = el('div', { class: 'msg', style: { maxWidth: '460px' }, html: '<svg class="spider-art" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 0V18" stroke="#888" stroke-width="1"/><g class="leg" stroke="#111" stroke-width="2.2" fill="none" stroke-linecap="round"><path d="M32 26 L14 12 M32 29 L8 26 M32 34 L8 40 M32 37 L14 54 M32 26 L50 12 M32 29 L56 26 M32 34 L56 40 M32 37 L50 54"/></g><ellipse cx="32" cy="35" rx="8" ry="10" fill="#222"/><circle cx="32" cy="23" r="6" fill="#333"/><circle cx="30" cy="22" r="1.2" fill="#f33"/><circle cx="34" cy="22" r="1.2" fill="#f33"/></svg><div style="flex:1;min-width:0"><p id="pgMsg" style="overflow-wrap:anywhere;white-space:pre-line">' + esc(msg) + '</p><div class="sunken progress"><i id="pgBar"></i></div><p class="hint" id="pgHint" style="overflow-wrap:anywhere;white-space:pre-line"></p></div>' });
  const api = { cancelled: false };
  const w = openWin({ title, body, width: 'min(520px, 94vw)', buttons: [{ label: 'Cancel', onClick: () => { api.cancelled = true; } }], onClose: () => { api.cancelled = true; } });
  api.update = (p, m, hint) => { const b = $('#pgBar', body); if (b) b.style.width = clamp(p * 100, 0, 100) + '%'; if (m != null) $('#pgMsg', body).textContent = m; if (hint != null) $('#pgHint', body).textContent = hint; };
  api.close = () => { api.closing = true; w.close('done'); api.cancelled = false; };
  return api;
}

/* ---------------- settings import/export ---------------- */
function exportSettings() {
  const v = { app: 'LANscape Navigator', version: VERSION, exported: new Date().toISOString() };
  for (const k of persisted) v[k] = S[k];
  download('lanscape-settings.json', new Blob([JSON.stringify(v, null, 2)], { type: 'application/json' }));
}
$('#importInput').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  try {
    const v = JSON.parse(await f.text());
    for (const k of persisted) if (v[k] != null) S[k] = k === 'prefs' ? Object.assign({}, DEFAULT_PREFS, v[k]) : v[k];
    S.visited = new Set((S.history || []).map(h => h.url));
    setExcluded(Array.isArray(S.excluded) ? S.excluded : []);
    applyExclusions();
    saveState(); applyChrome(); rebuildAll(); afterFolderChange(); FolderManager.refresh();
    msgBox('info', 'Import Settings', '<p>Settings imported: bookmarks, domain names, rings, guestbooks and preferences.</p>');
  } catch (err) { msgBox('error', 'Import Settings', '<p>That file isn’t a LANscape settings file.</p>'); }
});
