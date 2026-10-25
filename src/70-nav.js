/* ===================================================================
   Router, renderer, history, status bar, modem simulation
   =================================================================== */
let frame = $('#frame');
// A fresh iframe per page: re-using one iframe would add every page to the
// browser's own session history behind LANscape's back.
function bindFrame(f) {
  f.addEventListener('load', onFrameLoad);
  f.addEventListener('mouseenter', () => { if (openMenuIdx >= 0) closeMenus(); });
}
function freshFrame(sandbox, setup) {
  const f = document.createElement('iframe');
  f.id = 'frame';
  f.title = 'Page';
  f.setAttribute('referrerpolicy', 'no-referrer');
  if (sandbox) f.setAttribute('sandbox', sandbox);
  setup(f);
  bindFrame(f);
  frame.replaceWith(f);
  frame = f;
  return f;
}
/* mirror LANscape's history into the real tab so its Back button, refresh and bookmarks work */
let realHistoryOK = false;
function pushReal(url, replace) {
  try {
    const st = { lanIdx: S.tab.idx }, h = '#go=' + encodeURIComponent(url);
    if (replace) history.replaceState(st, '', h); else history.pushState(st, '', h);
    realHistoryOK = true;
  } catch (e) { realHistoryOK = false; }
}
window.addEventListener('popstate', async e => {
  const st = e.state;
  if (st && typeof st.lanIdx === 'number' && st.lanIdx !== S.tab.idx && st.lanIdx < S.tab.stack.length) {
    if (!(await canLeave())) { pushReal(S.cur ? S.cur.url : 'http://home.lanscape.net/', false); return; }
    goHistory(st.lanIdx);
  }
});
const SANDBOX_TRUSTED = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-pointer-lock';
const SANDBOX_STRICT = 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';
const PORTAL_ROUTES = {
  'home.lanscape.net': portalHome,
  'www.hyperhound.com': portalHound,
  'www.ringhub.org': portalRingHub,
  'www.netropolis.com': portalNetropolis,
  'members.lanscape.net': portalMembers
};
const PORTAL_ALIAS = { 'www.lanscape.net': 'home.lanscape.net', 'lanscape.net': 'home.lanscape.net', 'hyperhound.com': 'www.hyperhound.com', 'ringhub.org': 'www.ringhub.org', 'netropolis.com': 'www.netropolis.com' };
const SPEEDS = {
  lan: { label: 'LAN', bps: Infinity }, t1: { label: 'T1', bps: 1544000 }, isdn: { label: 'ISDN', bps: 128000 },
  k56: { label: '56K', bps: 53300 }, k28: { label: '28.8K', bps: 28800 }, k14: { label: '14.4K', bps: 14400 }
};

/* ---------------- file-system style lookups ---------------- */
function resolveFsPath(baseDir, rel) {
  let r = rel;
  try { r = decodeURIComponent(rel); } catch (e) { /* keep raw */ }
  const parts = (baseDir + (r.startsWith('/') ? r.slice(1) : r)).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '' || p === '.') continue;
    if (p === '..') { if (out.length > 1) out.pop(); continue; }
    out.push(p);
  }
  return out.join('/');
}
function lookupPath(p) {
  if (!p) return null;
  let d = S.docs.get(p);
  if (!d) { const real = S.lower.get(p.toLowerCase()); if (real) d = S.docs.get(real); }
  return d && d.active ? { doc: d } : null;
}
function lookupDir(p) {
  return lookupPath(p + '/index.html') || lookupPath(p + '/index.htm') || lookupPath(p + '/default.htm');
}
function resolveDocUrl(url) {
  const r = resolve(url);
  return r && r.type === 'doc' ? r.doc : null;
}
function stripHash(u) { return String(u).replace(/#.*$/, ''); }

/* ---------------- input → URL ---------------- */
function normalizeInput(input) {
  let s = String(input == null ? '' : input).trim();
  if (!s) return null;
  if (/^about:/i.test(s)) return s.toLowerCase();
  if (/^lanscape:/i.test(s)) return s;
  if (/^(https?|ftp):\/\//i.test(s)) return s;
  if (/^ftp\.[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(s)) return 'ftp://' + s;
  if (/^file:/i.test(s)) {
    const name = decodeURIComponent(s.split('/').pop() || '');
    const d = Array.from(S.docs.values()).find(x => x.active && x.name === name);
    return d ? d.url : 'http://www.hyperhound.com/search?q=' + encodeURIComponent(name.replace(/\.[a-z]+$/i, ''));
  }
  if (!/\s/.test(s) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/.*)?$/i.test(s)) return 'http://' + s;
  if (/^[a-z0-9-]+$/i.test(s)) {
    const w = s.toLowerCase();
    for (const t of ['com', 'net', 'org', 'edu', 'travel']) {
      const h = 'www.' + w + '.' + t;
      if (S.hostMap.has(h) || PORTAL_ROUTES[h] || APP_HOSTS[h] || HOSTED_BY_HOST[h]) return 'http://' + h + '/';
    }
    if (APP_HOSTS[w + '.lanscape.net']) return 'http://' + w + '.lanscape.net/';
  }
  if (/\.[a-z0-9]{1,5}$/i.test(s) && !/\s/.test(s) && EXT_KIND[extOf(s)]) {
    const t = s.toLowerCase();
    const d = Array.from(S.docs.values()).find(x => x.active && (x.path.toLowerCase().endsWith(t) || x.name.toLowerCase() === t));
    if (d) return d.url;
  }
  return 'http://www.hyperhound.com/search?q=' + encodeURIComponent(s);
}

/* ---------------- router ---------------- */
function resolve(url) {
  if (/^about:/i.test(url)) {
    const name = url.slice(6).toLowerCase().replace(/[?#].*$/, '');
    const html = aboutPage(name || 'blank');
    return { type: 'gen', url: 'about:' + name, title: name === 'blank' ? '' : 'about:' + name, html: html || page('Not found', '<p>LANscape doesn\'t know <tt>about:' + esc(name) + '</tt>.</p>') };
  }
  if (/^lanscape:/i.test(url)) return { type: 'action', action: url.slice(9) };
  let u;
  try { u = new URL(url); } catch (e) { return { type: 'dns', host: String(url), url }; }
  if (u.protocol === 'ftp:') return resolveFtp(u);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { type: 'external', url };
  const host = u.hostname.toLowerCase();
  let path = u.pathname || '/';
  try { path = decodeURIComponent(path); } catch (e) { /* keep */ }
  const hash = u.hash || '';
  const q = u.searchParams;
  const sites = S.hostMap.get(host);
  if (sites) {
    for (const site of sites) {
      if (path === site.base.slice(0, -1) || path.startsWith(site.base)) return resolveInSite(site, path.slice(site.base.length), q, hash, u);
    }
  }
  if (PORTAL_ALIAS[host]) { u.hostname = PORTAL_ALIAS[host]; return { type: 'redirect', to: u.href }; }
  if (HOSTED_BY_HOST[host]) { const hs = HOSTED_BY_HOST[host]; return { type: 'frame', url: 'http://' + host + u.pathname + u.search + hash, src: hostedSrc(hs, u.pathname, u.search, hash), title: hs.title, hosted: hs, hash }; }
  if (APP_HOSTS[host]) return resolveApp(APP_HOSTS[host], path, q, hash, u);
  const P = PORTAL_ROUTES[host];
  if (P) {
    const r = P(path, q);
    const canon = 'http://' + host + u.pathname + u.search;
    if (r && r.redirect) return { type: 'redirect', to: r.redirect };
    if (r) return { type: 'gen', url: canon + hash, title: r.title, html: r.html, interstitial: r.interstitial, to: r.to, hash };
    return { type: 'gen', url: canon, title: '404 Not Found', html: notFoundPage(url, host), status: 404 };
  }
  if (!host.startsWith('www.') && (S.hostMap.has('www.' + host) || PORTAL_ROUTES['www.' + host] || APP_HOSTS['www.' + host] || HOSTED_BY_HOST['www.' + host])) { u.hostname = 'www.' + host; return { type: 'redirect', to: u.href }; }
  // the LANscape web is all plain http, so an unknown https:// address is the real Internet
  if (u.protocol === 'https:') return { type: 'external', url: u.href };
  return { type: 'dns', host, url };
}
function resolveInSite(site, rel, q, hash, u) {
  const url = u.href;
  if (rel === '' || isIndexName(rel)) return { type: 'doc', doc: site.index, hash };
  const fp = site.dir + rel.replace(/\/+$/, '');
  let t = lookupPath(fp);
  if (!t) t = rel.endsWith('/') ? lookupDir(fp) : (lookupDir(fp) || lookupPath(fp + '.html') || lookupPath(fp + '.htm'));
  if (t && t.doc) {
    const d = t.doc;
    if (isSiteKind(d) && d.site !== site) return { type: 'redirect', to: d.url + hash };
    // pictures, songs and other files are served right where they are
    return { type: 'doc', doc: d, hash, url: isSiteKind(d) ? null : url.replace(/#.*$/, '') };
  }
  // older versions and copies of this page (or of this whole website) live under /versions/
  const vr = resolveVersion(site, rel, hash, url);
  if (vr) return vr;
  const r = rel.replace(/\/+$/, '').toLowerCase();
  if (r === 'guestbook' || r === 'guestbook.html') return { type: 'gen', url: site.url + 'guestbook', title: 'Guestbook: ' + site.title, html: siteGuestbookPage(site, q.get('thanks')), site };
  if (r === 'guestbook/sign') {
    const msg = (q.get('msg') || '').trim(), name = (q.get('name') || '').trim();
    if (msg || name) {
      (S.guestbook[site.key] = S.guestbook[site.key] || []).push({ name: name.slice(0, 80), from: (q.get('from') || '').slice(0, 80), how: (q.get('how') || '').slice(0, 40), msg: msg.slice(0, 4000), ts: Date.now() });
      saveState();
    }
    return { type: 'redirect', to: site.url + 'guestbook?thanks=1', replace: true };
  }
  if (r === 'links' || r === 'links.html') return { type: 'gen', url: site.url + 'links', title: 'My Favorite Links: ' + site.title, html: siteLinksPage(site), site };
  // a folder without an index page gets the server's own listing, like Apache did
  const dir = fp.replace(/\/+$/, '') + '/';
  if (S.tree.has(dir)) {
    if (!rel.endsWith('/')) return { type: 'redirect', to: url.replace(/[?#].*$/, '') + '/' };
    return { type: 'gen', url, title: 'Index of /' + rel, html: indexOfPage(site, dir, rel, q), site };
  }
  return { type: 'gen', url, title: '404 Not Found', html: notFoundPage(url, site.host), status: 404, site };
}
/** www.site.com/versions/ (the list), /versions/2 (a page's older version), /versions/2/about.html (a copied website) */
function resolveVersion(site, rel, hash, url) {
  const m = /^versions(?:\/(?:(\d{1,4})(?:\/(.*))?)?)?$/i.exec(rel);
  if (!m) return null;
  const g = site.index && site.index.fold;
  if (!g || g.primary !== site.index || g.cls !== 'site') return null;
  if (!m[1]) {
    if (!/\/$/.test(rel)) return { type: 'redirect', to: site.url + 'versions/' + hash };
    return { type: 'gen', url: site.url + 'versions/', title: 'Versions of ' + site.title, html: versionsPage(site), site };
  }
  const vno = +m[1], rest = m[2] || '';
  const d = g.members.find(x => x.vno === vno);
  if (!d) return { type: 'gen', url, title: '404 Not Found', html: notFoundPage(url, site.host), status: 404, site };
  if (d === g.primary) return { type: 'redirect', to: site.url + rest + hash };
  if (!g.whole) return d.url && stripHash(url) !== d.url ? { type: 'redirect', to: d.url + hash } : { type: 'doc', doc: d, hash };
  const w = g.dirs.get(d);
  if (!rest) return /\/$/.test(rel) ? { type: 'doc', doc: d, hash } : { type: 'redirect', to: d.url + hash };
  const fp = w.dir + rest.replace(/\/+$/, '');
  const t = lookupPath(fp) || lookupDir(fp) || lookupPath(fp + '.html') || lookupPath(fp + '.htm');
  if (t && t.doc) return { type: 'doc', doc: t.doc, hash, url: isSiteKind(t.doc) ? null : stripHash(url) };
  return { type: 'gen', url, title: '404 Not Found', html: notFoundPage(url, site.host), status: 404, site };
}
function resolveFtp(u) {
  const host = u.hostname.toLowerCase();
  const root = S.ftpHosts.get(host);
  if (!root) return { type: 'dns', host, url: u.href, ftp: true };
  let path = u.pathname || '/';
  try { path = decodeURIComponent(path); } catch (e) { /* keep */ }
  const rel = path.replace(/^\/+/, '');
  const base = 'ftp://' + host + '/';
  if (!rel || rel.endsWith('/')) {
    const dir = root + '/' + rel;
    if (S.tree.has(dir)) return { type: 'gen', url: base + encPath(rel), title: 'Directory of ' + host + '/' + rel, html: ftpListing(host, root, dir, rel, u.searchParams) };
    return { type: 'gen', url: base + encPath(rel), title: 'FTP Error', html: ftpError(host, '/' + rel), status: 550 };
  }
  const t = lookupPath(root + '/' + rel);
  if (t) return { type: 'doc', doc: t.doc, hash: u.hash || '', url: base + encPath(rel) };
  if (S.tree.has(root + '/' + rel + '/')) return { type: 'redirect', to: base + encPath(rel) + '/' };
  return { type: 'gen', url: base + encPath(rel), title: 'FTP Error', html: ftpError(host, '/' + rel), status: 550 };
}
/** which program shows a file (null = the browser itself) */
function appFor(doc, route) {
  if (doc.kind === 'html') return null;
  const viaPath = route && route.url && route.url !== doc.url;
  if ((doc.asset || viaPath) && (doc.kind === 'image' || doc.kind === 'audio' || doc.kind === 'video')) return 'media';
  return K(doc).app;
}

/* ---------------- content ---------------- */
const isTextKind = k => TEXTUAL.has(k);
async function demoBlob(doc) {
  let v = S.demoSrc.get(doc.path);
  if (typeof v === 'function') { v = await v(); S.demoSrc.set(doc.path, v); }
  if (v == null) throw new Error('This demo file is missing.');
  return typeof v === 'string' ? new Blob([v], { type: MIME[doc.ext] || 'text/plain' }) : v;
}
/** the file itself, wherever it lives right now: the folder on disk, this session, or the cache */
async function getBlob(doc) {
  if (doc.demo) return demoBlob(doc);
  const fh = S.fh.get(doc.path);
  if (fh) {
    try {
      const f = await fh.getFile();
      if (f.lastModified !== doc.mtime || f.size !== doc.size) await refreshDocFromFile(doc, f);
      return f;
    } catch (e) {
      if (e && e.name === 'NotAllowedError' && await reconnectFolder(doc.root)) { try { return await fh.getFile(); } catch (e2) { /* fall through */ } }
    }
  }
  const live = S.live.get(doc.path);
  if (live) return live;
  const rec = await DB.get('content', doc.path);
  if (rec) return rec.blob || new Blob([rec.text != null ? rec.text : ''], { type: MIME[doc.ext] || 'text/plain' });
  throw new Error(doc.root === VROOT ? 'This file is missing from ' + VROOT + '.' : 'LANscape only keeps a copy of small files. Open the ' + doc.root + ' folder again to reconnect this one.');
}
async function getText(doc) {
  if (doc.demo) { const v = S.demoSrc.get(doc.path); if (typeof v === 'string') return v; }
  if (!S.fh.has(doc.path) && !S.live.has(doc.path) && !doc.demo) { const rec = await DB.get('content', doc.path); if (rec && rec.text != null) return rec.text; }
  return blobText(await getBlob(doc));
}
async function getContent(doc) { return textualKind(doc.kind, doc.ext) ? getText(doc) : getBlob(doc); }
const dirOf = p => p.slice(0, p.lastIndexOf('/') + 1);
async function assetURL(path, depth = 0) {
  if (S.blobs.has(path)) return S.blobs.get(path);
  const d = S.docs.get(path);
  if (!d) return null;
  let blob;
  try { blob = await getBlob(d); } catch (e) { return null; }
  const ext = extOf(path);
  if (ext === 'css' && depth < 3) {
    const css = await rewriteCSS(await blobText(blob), dirOf(path), depth + 1);
    blob = new Blob([css], { type: 'text/css' });
  } else if (MIME[ext] && blob.type !== MIME[ext]) blob = new Blob([blob], { type: MIME[ext] });
  if (S.blobs.has(path)) return S.blobs.get(path);
  const u = URL.createObjectURL(blob);
  S.blobs.set(path, u);
  return u;
}
const REL_OK = v => v && !/^\s*(?:[a-z][a-z0-9+.-]*:|\/\/|#|\{)/i.test(v) && !/[{}<>`$]/.test(v);
async function rewriteCSS(css, dir, depth) {
  const refs = new Map();
  css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, v) => { if (REL_OK(v)) refs.set(v, null); return m; });
  css.replace(/@import\s+(['"])([^'"]+)\1/gi, (m, q, v) => { if (REL_OK(v)) refs.set(v, null); return m; });
  for (const v of refs.keys()) {
    const t = lookupPath(resolveFsPath(dir, v.split(/[?#]/)[0]));
    if (t) refs.set(v, await assetURL(t.doc.path, depth));
  }
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, v) => refs.get(v) ? 'url("' + refs.get(v) + '")' : m)
    .replace(/@import\s+(['"])([^'"]+)\1/gi, (m, q, v) => refs.get(v) ? '@import "' + refs.get(v) + '"' : m);
}
async function rewriteHTML(html, doc) {
  const dir = doc.dir, siteDir = doc.site ? doc.site.dir : dir;
  const target = v => {
    const clean = v.split('#')[0].split('?')[0];
    if (!clean) return null;
    const p = resolveFsPath(clean.startsWith('/') ? siteDir : dir, clean);
    return lookupPath(p) || (clean.endsWith('/') ? lookupDir(p) : null);
  };
  const resMap = new Map(), anchorMap = new Map();
  const resTag = /<(img|script|link|source|video|audio|iframe|embed|track|input|object|image|use)\b[^>]*>/gi;
  const aTag = /<(a|area)\b[^>]*>/gi;
  const attr = /(\s)(src|href|poster|data|srcset|xlink:href)(\s*=\s*)("([^"]*)"|'([^']*)'|([^\s>"']+))/gi;
  const collect = (tagRe, into) => {
    let m;
    tagRe.lastIndex = 0;
    while ((m = tagRe.exec(html))) {
      let a;
      attr.lastIndex = 0;
      while ((a = attr.exec(m[0]))) {
        const name = a[2].toLowerCase(), v = a[5] != null ? a[5] : a[6] != null ? a[6] : a[7];
        if (name === 'srcset') { for (const part of v.split(',')) { const u = part.trim().split(/\s+/)[0]; if (REL_OK(u)) into.set(u, null); } }
        else if (REL_OK(v)) into.set(v, null);
      }
    }
  };
  collect(resTag, resMap);
  collect(aTag, anchorMap);
  const cssRefs = new Map();
  html.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, v) => { if (REL_OK(v) && !v.includes('\\')) cssRefs.set(v, null); return m; });
  if (!resMap.size && !anchorMap.size && !cssRefs.size) return html;
  for (const v of resMap.keys()) { const t = target(v); if (t) resMap.set(v, await assetURL(t.doc.path)); }
  for (const v of cssRefs.keys()) { const t = target(v); if (t && t.doc.kind !== 'html') cssRefs.set(v, await assetURL(t.doc.path)); }
  for (const v of anchorMap.keys()) {
    const t = target(v);
    if (t && t.doc && t.doc.url) { const h = v.indexOf('#'); anchorMap.set(v, t.doc.url + (h >= 0 ? v.slice(h) : '')); }
  }
  const replAttr = (tagRe, map) => {
    html = html.replace(tagRe, tag => tag.replace(attr, (all, sp, name, eq, quoted, v1, v2, v3) => {
      const v = v1 != null ? v1 : v2 != null ? v2 : v3;
      if (name.toLowerCase() === 'srcset') {
        const nv = v.split(',').map(part => { const bits = part.trim().split(/\s+/); if (map.get(bits[0])) bits[0] = map.get(bits[0]); return bits.join(' '); }).join(', ');
        return sp + name + eq + '"' + nv.replace(/"/g, '&quot;') + '"';
      }
      const nv = map.get(v);
      return nv ? sp + name + eq + '"' + nv.replace(/"/g, '&quot;') + '"' : all;
    }));
  };
  replAttr(resTag, resMap);
  replAttr(aTag, anchorMap);
  if (cssRefs.size) html = html.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, v) => cssRefs.get(v) ? 'url("' + cssRefs.get(v) + '")' : m);
  return html;
}
function injectHelper(html, cfg, retro) {
  const json = JSON.stringify(cfg).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const inj = '<script>(' + LAN_HELPER.toString() + ')(' + json + ');<\/script>' + (retro ? '<style>' + RETRO_CSS + '</style>' : '');
  // keep the page in standards mode: inject after any XML prolog / comments / doctype
  const m = /^\s*((?:<\?xml[^>]*>\s*|<!--[\s\S]*?-->\s*)*<!doctype[^>]*>)/i.exec(html);
  if (m) return m[1] + inj + html.slice(m[0].length);
  return inj + html;
}

/* ---------------- status bar, throbber, location ---------------- */
let statusLock = false, statusMsg = 'Document: Done';
function setStatus(msg, hover) {
  if (!hover) statusMsg = msg;
  $('#sbMsg').textContent = msg;
}
function hoverStatus(href) {
  if (!href) { setStatus(statusMsg, true); return; }
  if (/^javascript:/i.test(href)) { setStatus(href, true); return; }
  if (/^https?:/i.test(href)) {
    let host = '';
    try { host = new URL(href).hostname; } catch (e) { /* keep */ }
    const known = S.hostMap.has(host) || PORTAL_ROUTES[host] || PORTAL_ALIAS[host] || HOSTED_BY_HOST[host] || S.hostMap.has('www.' + host);
    setStatus(known ? href : href + '   (real Internet)', true);
  } else setStatus(href, true);
}
function busy(on) {
  $('#throbber').classList.toggle('busy', on);
  $('#sbLed').classList.toggle('busy', on);
  $('#bStop') && ($('#bStop').disabled = !on);
}
function progress(p) { $('#sbBar').style.width = clamp(p, 0, 100) + '%'; }
function setSecurity(kind) {
  const el = $('#sbSec');
  if (kind === 'doc') { el.innerHTML = ICON.lock; el.title = 'Loaded from your own disk. This page never touches the network.'; }
  else if (kind === 'gen') { el.innerHTML = ICON.globe; el.title = 'Generated by LANscape inside this browser window.'; }
  else { el.innerHTML = ICON.key; el.title = 'Not loaded'; }
}
function setLocation(url, fav) {
  const loc = $('#loc');
  if (document.activeElement !== loc) loc.value = url ? (url.startsWith('http://') ? url : url) : '';
  const f = $('#locFav');
  if (fav) { f.src = fav; f.hidden = false; } else { f.removeAttribute('src'); f.hidden = true; }
}
function setTitle(t) {
  const s = (t ? t + ' - ' : '') + 'LANscape Navigator';
  $('#winTitle').textContent = s;
  document.title = s;
}
function updateNavButtons() {
  const b = $('#bBack'), f = $('#bFwd');
  if (b) b.disabled = S.tab.idx <= 0;
  if (f) f.disabled = S.tab.idx >= S.tab.stack.length - 1;
}

/* ---------------- navigation ---------------- */
/** an open document with unsaved changes gets a chance to save before we leave it */
async function canLeave() {
  const app = S.cur && S.cur.app;
  if (!app || !app.isDirty || !app.isDirty()) return true;
  const name = (app.docName && app.docName()) || 'this document';
  const v = await msgBox('warn', (app.appName || 'LANscape'), '<p>Do you want to save the changes you made to <b>' + esc(name) + '</b>?</p><p class="hint">Your changes will be lost if you don\'t save them.</p>', ['Save', "Don't Save", 'Cancel']);
  if (v === 'Save') { try { return !!(await app.save()); } catch (e) { return false; } }
  if (v === "Don't Save") { if (app.discard) app.discard(); return true; }
  return false;
}
async function go(input, opts = {}) {
  hideSuggest();
  const url = normalizeInput(input);
  if (!url) return;
  let route = resolve(url), hops = 0;
  while (route.type === 'redirect' && hops++ < 8) { if (route.replace) opts.replace = true; route = resolve(route.to); }
  if (route.type === 'redirect') { setStatus('Too many redirects.'); return; }
  if (route.type === 'action') return runAction(route.action, opts);
  if (route.type === 'dns') return dnsError(route.host, route.url, opts);
  if (route.type === 'external') return leaveLAN(route.url);
  if (!opts.noCheck && !opts.fromHistory && !(await canLeave())) { if (S.cur) setLocation(S.cur.url); return; }
  if (route.type === 'gen' && route.interstitial) {
    if (!S.prefs.interstitial) return go(route.to, Object.assign({}, opts, { noCheck: true }));
    await render(route, { url: route.url, title: route.title, y: 0 }, { noHistory: true });
    const tok = S.navToken;
    setTimeout(() => { if (S.navToken === tok) go(route.to, Object.assign({}, opts, { replace: false, noCheck: true })); }, 900);
    return;
  }
  const finalUrl = route.type === 'doc' ? (route.url || route.doc.url) + (route.hash || '') : route.url;
  const entry = { url: finalUrl, title: '', y: 0, path: route.type === 'doc' && !route.url ? route.doc.path : null };
  if (!opts.fromHistory) {
    const replace = opts.replace && S.tab.idx >= 0;
    if (replace) S.tab.stack[S.tab.idx] = entry;
    else { S.tab.stack = S.tab.stack.slice(0, S.tab.idx + 1); S.tab.stack.push(entry); S.tab.idx = S.tab.stack.length - 1; }
    pushReal(finalUrl, replace || S.tab.stack.length === 1);
  } else if (opts.reload) pushReal(finalUrl, true);
  const e = opts.fromHistory ? S.tab.stack[S.tab.idx] : entry;
  if (opts.fromHistory) e.url = finalUrl;
  await render(route, e, opts);
}
function goHistory(i) {
  if (i < 0 || i >= S.tab.stack.length) return;
  const cur = S.tab.stack[S.tab.idx];
  if (cur && S.cur) cur.y = S.cur.y || cur.y;
  S.tab.idx = i;
  const e = S.tab.stack[i];
  let url = e.url;
  if (e.path && S.docs.get(e.path) && S.docs.get(e.path).active) url = S.docs.get(e.path).url + (/#/.test(e.url) ? '#' + e.url.split('#')[1] : '');
  go(url, { fromHistory: true, y: e.y || 0 });
}
async function stepHistory(d) {
  const i = S.tab.idx + d;
  if (i < 0 || i >= S.tab.stack.length) return;
  if (!(await canLeave())) return;
  goHistory(i);
  if (realHistoryOK) try { history.go(d); } catch (e) { /* ignore */ }
}
const back = () => stepHistory(-1);
const forward = () => stepHistory(1);
async function reload() {
  const e = S.tab.stack[S.tab.idx];
  if (!e) return;
  if (!(await canLeave())) return;
  if (S.cur) e.y = S.cur.y || 0;
  go(e.url, { fromHistory: true, y: e.y || 0, reload: true });
}
function stop() {
  S.navToken++;
  const c = $('#curtain');
  if (!c.hidden) { c.hidden = true; setStatus('Transfer interrupted!'); }
  busy(false); progress(0);
}
function goHome() { go(S.prefs.homepage || 'http://home.lanscape.net/'); }
function randomSite() {
  const all = S.sites;
  if (all.length) go(all[Math.floor(Math.random() * all.length)].url);
}
function openNewWindow(url) {
  try { window.open(location.href.split('#')[0] + '#go=' + encodeURIComponent(url), '_blank'); } catch (e) { go(url); }
}
window.addEventListener('beforeunload', e => {
  const app = S.cur && S.cur.app;
  if (app && app.isDirty && app.isDirty()) { e.preventDefault(); e.returnValue = ''; }
});

async function render(route, entry, opts = {}) {
  const token = ++S.navToken;
  const nonce = 'n' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const t0 = performance.now();
  const doc = route.doc || null;
  const appName = route.type === 'app' ? route.app : doc ? appFor(doc, route) : null;
  const site = doc ? (doc.site || doc.home || route.site || null) : route.site || null;
  let host = '';
  try { host = new URL(entry.url).hostname; } catch (e) { host = entry.url; }
  busy(true); progress(0);
  setStatus('Looking up host: ' + host + '...');
  setLocation(entry.url, doc ? doc.meta.favicon : route.hosted ? hostedFavicon(route.hosted) : null);
  let html = null, bytes = 0, retro = route.type !== 'doc' || !!(doc && doc.demo), kind = 'gen', title = route.title || '';
  try {
    if (route.type === 'frame') {
      kind = 'gen'; retro = false; bytes = route.hosted.bytes || 0;
    } else if (appName) {
      kind = 'app';
      title = appTitle(appName, doc, route);
      bytes = doc ? doc.size || 0 : 0;
      retro = false;
    } else if (doc) {
      kind = doc.kind;
      title = doc.meta.title;
      const content = await getText(doc);
      if (token !== S.navToken) return;
      html = await rewriteHTML(String(content), doc);
      bytes = (content && content.length) || doc.size || 0;
    } else {
      html = route.html;
      if (html && typeof html.then === 'function') html = await html;
      if (token !== S.navToken) return;
      bytes = (html || '').length;
    }
  } catch (err) {
    if (token !== S.navToken) return;
    html = page('Error', '<h2 class="sans">LANscape couldn\'t open this page</h2><p class="sans">' + esc(err && err.message || err) + '</p><p class="sans">The folder may have moved, or the browser cleared its cache. ' + A('lanscape:open-folder', 'Open the folder again') + ' or go ' + A('http://home.lanscape.net/', 'home') + '.</p>');
    kind = 'gen'; retro = false;
  }
  if (token !== S.navToken) return;
  // visit counting + history
  const vkey = doc ? doc.path : stripHash(entry.url);
  if (!opts.noHistory) {
    S.visits[vkey] = (S.visits[vkey] || 0) + 1;
    S.visited.add(stripHash(entry.url));
  }
  const counter = S.visits[vkey] || 1;
  const cur = { url: entry.url, entry, route, doc, site, nonce, kind, title, t0, y: entry.y || 0, gotDom: false, errs: 0, noHistory: !!opts.noHistory, appName };
  const prev = S.cur;
  S.cur = cur;
  S.curNonce = nonce;
  if (prev && prev.app) { try { prev.app.unmount(); } catch (e) { console.error(e); } prev.app = null; }
  const wantDeep = !!(doc && kind === 'html' && S.prefs.deep && doc.meta.deepFor !== doc.mtime);
  const wantThumb = !!(doc && kind === 'html' && S.prefs.previews && (!S.thumbs.has(doc.path) || (S.thumbAt.get(doc.path) || 0) !== doc.mtime));
  const cfg = {
    n: nonce, url: stripHash(entry.url), counter, retro, hash: route.hash || '', y: opts.y || 0, app: appName || '',
    deep: wantDeep, thumb: wantThumb, lastmod: doc ? fmtDate(doc.mtime) : '', ring: site ? ringNavHTML(site) : ''
  };
  // simulated connection
  const sp = SPEEDS[S.prefs.speed] || SPEEDS.lan;
  let transfer = 0;
  if (sp.bps !== Infinity) {
    const w = (a, b) => a + Math.random() * (b - a);
    await sleep(w(150, 420)); if (token !== S.navToken) return;
    setStatus('Contacting host: ' + host + '...');
    if (opts.sounds !== false && S.prefs.sounds && !opts.fromHistory) modemChirp();
    await sleep(w(200, 520)); if (token !== S.navToken) return;
    setStatus('Host contacted. Waiting for reply...');
    await sleep(w(120, 380)); if (token !== S.navToken) return;
    transfer = Math.min(4800, (Math.min(bytes, 2e6) / (sp.bps / 10)) * 1000);
  }
  // paint
  setSecurity(doc ? 'doc' : 'gen');
  $('#app').classList.toggle('framed', route.type === 'frame');
  setTitle(title || displayUrl(entry.url));
  entry.title = title;
  if (!opts.noHistory) recordHistory(entry.url, title, doc);
  updateNavButtons();
  renderRingStrip();
  renderVerBar();
  refreshSidebar();
  if (appName) {
    const api = await mountApp(appName, { doc, route, url: entry.url, title, params: route.params || null }, cfg, token);
    if (token !== S.navToken) return;
    cur.app = api;
    if (api && api.title) { cur.title = api.title; entry.title = api.title; setTitle(api.title); }
    if (doc) noteRecent(doc);
  } else if (route.type === 'frame') {
    // the same server as LANscape: trusted, loaded by address, with its own scripts and storage
    freshFrame(SANDBOX_TRUSTED, f => { f.src = route.src; });
  } else {
    const sb = S.prefs.sandbox === 'sandboxed' ? SANDBOX_STRICT : SANDBOX_TRUSTED;
    const src = injectHelper(html, cfg, retro);
    freshFrame(sb, f => { f.srcdoc = src; });
  }
  cur.html = html;
  if (transfer > 0) await curtain(transfer, bytes, host, token, sp);
  else { setStatus('Transferring data from ' + host + '...'); progress(100); if (appName) finishLoad(); }
}
function recordHistory(url, title, doc) {
  const h = S.history;
  if (h.length && h[0].url === url) { h[0].ts = Date.now(); h[0].title = title || h[0].title; }
  else h.unshift({ url, title, ts: Date.now(), path: doc ? doc.path : null });
  if (h.length > 1000) h.length = 1000;
  saveState();
}
function curtain(ms, bytes, host, token, sp) {
  const c = $('#curtain');
  c.hidden = false;
  c.style.top = '2px';
  const t0 = performance.now(), kps = (sp.bps / 10 / 1024);
  return new Promise(res => {
    const step = () => {
      if (token !== S.navToken) { c.hidden = true; res(); return; }
      const p = Math.min(1, (performance.now() - t0) / ms);
      c.style.top = 'calc(2px + ' + (p * 100).toFixed(2) + '%)';
      progress(p * 100);
      setStatus(Math.round(bytes * p / 1024) + 'K of ' + Math.max(1, Math.round(bytes / 1024)) + 'K (at ' + kps.toFixed(1) + 'K/sec)');
      if (p < 1) requestAnimationFrame(step);
      else { c.hidden = true; finishLoad(true); res(); }
    };
    requestAnimationFrame(step);
  });
}
function finishLoad(fromCurtain) {
  const cur = S.cur;
  if (!cur) return;
  if (!$('#curtain').hidden && !fromCurtain) return;
  const secs = ((performance.now() - cur.t0) / 1000).toFixed(2);
  cur.doneMsg = 'Document: Done (' + secs + ' secs)' + (cur.errs ? ' — ' + cur.errs + ' script error' + (cur.errs > 1 ? 's' : '') : '');
  setStatus(cur.doneMsg);
  busy(false);
  progress(0);
}
function onFrameLoad(ev) {
  const cur = S.cur;
  if (!cur || (ev && ev.target !== frame)) return;
  if (cur.blob) { finishLoad(); return; }
  if (cur.route && cur.route.type === 'frame') {
    try {
      const fw = frame.contentWindow;
      fw.addEventListener('hashchange', () => { if (S.cur !== cur) return; const h = fw.location.hash || ''; cur.url = stripHash(cur.url) + h; cur.entry.url = cur.url; setLocation(cur.url, hostedFavicon(cur.route.hosted)); });
    } catch (e) { /* cross-origin copy: the Location bar keeps the site's home address */ }
    finishLoad(); return;
  }
  let href = null, cross = false;
  try { href = frame.contentWindow.location.href; } catch (e) { cross = true; }
  if (!cross) {
    if (href === 'about:srcdoc' || href === 'about:blank') { finishLoad(); return; }
    if (/^(blob|data):/i.test(href)) { finishLoad(); return; }
    recoverEscape(href);
    return;
  }
  setTimeout(() => { if (S.cur === cur && !cur.gotDom && !cur.recovered) { cur.recovered = true; recoverEscape(null); } else finishLoad(); }, 500);
}
function recoverEscape(href) {
  const cur = S.cur;
  if (!cur || cur.recovered2) return;
  cur.recovered2 = true;
  const base = location.href.split('#')[0];
  if (href && href.startsWith(base) && href.includes('#')) { go(stripHash(cur.url) + '#' + href.split('#')[1], { replace: true }); return; }
  if (href && /^file:/i.test(href)) {
    const name = decodeURIComponent(href.split('/').pop().split(/[?#]/)[0]);
    const d = Array.from(S.docs.values()).find(x => x.active && x.name === name);
    if (d) { go(d.url); return; }
  }
  go(cur.url, { replace: true, fromHistory: true });
  setStatus('LANscape caught the page trying to leave its window' + (href ? ' (' + clip(href, 80) + ')' : '') + '.');
}

/* ---------------- messages from pages ---------------- */
window.addEventListener('message', e => {
  const m = e.data;
  if (!m || typeof m !== 'object' || !m.__lan) return;
  if (e.source === frame.contentWindow && S.cur && m.__lan === S.cur.nonce) onFrameMsg(m);
  else if (typeof Spider !== 'undefined' && Spider.accepts(e, m)) Spider.onMsg(m);
});
function onFrameMsg(m) {
  const cur = S.cur;
  switch (m.t) {
    case 'dom': cur.gotDom = true; break;
    case 'load': if (S.prefs.sandbox === 'sandboxed') finishLoad(); break;
    case 'nav': handleNav(m); break;
    case 'post': setStatus('Form submitted. LANscape has no server, so the data stayed on this page.'); break;
    case 'hover': hoverStatus(m.href); break;
    case 'title': if (cur.appName) break; if (m.title && cur.doc && !cur.doc.meta.title) { cur.title = m.title; setTitle(m.title); } else if (m.title && !cur.doc) { cur.title = m.title; } break;
    case 'hash': cur.url = stripHash(cur.url) + m.hash; cur.entry.url = cur.url; setLocation(cur.url, cur.doc && cur.doc.meta.favicon); if (!cur.noHistory) pushReal(cur.url, true); break;
    case 'key': handleKey(m, true); break;
    case 'scroll': cur.y = m.y; if (cur.entry) cur.entry.y = m.y; break;
    case 'deep': if (cur.doc) applyDeep(cur.doc, m.text); break;
    case 'thumb': if (cur.doc) applyThumb(cur.doc, m.data); break;
    case 'err': cur.errs = m.n; if (!busyNow()) { cur.doneMsg = 'Document: Done — ' + m.n + ' script error' + (m.n > 1 ? 's' : '') + ' (' + clip(m.msg, 80) + ')'; setStatus(cur.doneMsg); } break;
    case 'found': Finder.result(m.ok, m.i, m.n); break;
    default: break;
  }
}
const busyNow = () => $('#throbber').classList.contains('busy');
function handleNav(m) {
  let href = m.href;
  const cur = S.cur;
  if (m.raw && cur && cur.doc && !m.form && !/^\s*([a-z][a-z0-9+.-]*:|\/\/)/i.test(m.raw)) {
    const raw = m.raw.trim(), hashI = raw.indexOf('#');
    const clean = (hashI >= 0 ? raw.slice(0, hashI) : raw).split('?')[0];
    if (clean) {
      const p = resolveFsPath(clean.startsWith('/') && cur.doc.site ? cur.doc.site.dir : cur.doc.dir, clean);
      const t = lookupPath(p) || lookupDir(p);
      if (t && t.doc) href = t.doc.url + (hashI >= 0 ? raw.slice(hashI) : '');
    }
  }
  if (cur && /#/.test(href) && stripHash(href) === stripHash(cur.url) && !m.form) {
    postToFrame({ cmd: 'hash', hash: '#' + href.split('#')[1] });
    cur.url = href; cur.entry.url = href; setLocation(href);
    if (!cur.noHistory) pushReal(href, true);
    return;
  }
  if (m.mod) { openNewWindow(href); return; }
  go(href, { from: 'link' });
}
function postToFrame(msg) {
  if (!S.cur) return;
  msg.__lanCmd = S.cur.nonce;
  try { frame.contentWindow.postMessage(msg, '*'); } catch (e) { /* ignore */ }
}

/* ---------------- deep text, previews, live file changes ---------------- */
/** re-weigh the words after new text arrived; if that changed which files are copies of which, rebuild the web */
function reindexNow() {
  if (!S.ix) return;
  S.ix = buildIndex(S.ix.docs);
  if (S.ix.foldChanged) { rebuildAll(); afterFolderChange(); }
}
const scheduleReindex = debounce(() => {
  reindexNow();
  if (S.prefs.sidebar) refreshSidebar(true);
}, 1600);
const reindexSoon = debounce(reindexNow, 250);
function applyDeep(doc, text) {
  if (!doc || text == null) return;
  text = String(text).replace(/\s+/g, ' ').trim().slice(0, 120000);
  doc.meta.deepFor = doc.mtime;
  doc.indexedAt = Date.now();
  if (text && text !== doc.meta.deep) { doc.meta.deep = text; doc.meta.deepWords = (text.match(/\S+/g) || []).length; scheduleReindex(); }
  if (isKnownDoc(doc)) DB.put('meta', metaRecord(doc));
}
function applyThumb(doc, data) {
  if (!doc || !data || !/^data:image\//.test(data)) return;
  if (!doc.demo && !isKnownDoc(doc)) return;   // its folder was removed while the preview was being painted
  S.thumbs.set(doc.path, data);
  S.thumbAt.set(doc.path, doc.mtime);
  DB.put('thumbs', { path: doc.path, data, mtime: doc.mtime });
}
async function refreshDocFromFile(doc, file) {
  let r;
  try { r = await extractFor(file, doc.path, doc.kind, doc.asset); } catch (e) { r = { meta: extractOther(doc.name, doc.path, file.size, doc.kind) }; }
  const keepDeep = doc.meta && doc.meta.deep;
  doc.meta = r.meta;
  if (doc.asset) doc.meta.light = true;
  if (keepDeep) doc.meta.deep = keepDeep;
  doc.meta.deepFor = 0;
  doc.size = file.size;
  doc.mtime = file.lastModified;
  forgetBlob(doc.path);
  if (isKnownDoc(doc)) {
    DB.put('meta', metaRecord(doc));
    if (S.prefs.cache && cacheable(doc, file.size)) DB.put('content', textualKind(doc.kind, doc.ext) ? { path: doc.path, text: r.text != null ? r.text : await blobText(file) } : { path: doc.path, blob: file });
  }
  if (r.art) saveArt(doc.meta, r.art, doc.mtime);
  reindexSoon();
}
function metaRecord(d) { return { path: d.path, root: d.root, name: d.name, ext: d.ext, kind: d.kind, size: d.size, mtime: d.mtime, meta: d.meta, indexedAt: d.indexedAt || 0 }; }
function noteRecent(doc) {
  if (!doc || doc.demo && !S.prefs.demo) return;
  S.recentDocs = [{ path: doc.path, ts: Date.now() }].concat((S.recentDocs || []).filter(x => x.path !== doc.path)).slice(0, 30);
  saveState();
}

/* ---------------- ring strip ---------------- */
function renderRingStrip() {
  const el = $('#ringstrip');
  el.hidden = !S.prefs.showRing;
  if (el.hidden) return;
  const cur = S.cur;
  const site = cur && cur.site;
  const odo = n => '<span class="odo" title="Visitor counter">' + String(n || 0).padStart(6, '0').split('').map(d => '<b>' + d + '</b>').join('') + '</span>';
  if (site && site.ring && site.docs) {
    const r = site.ring, gb = (S.guestbook[site.key] || []).length;
    el.innerHTML = '<div class="rnav"><button class="dbtn" data-ring="prev" title="Previous site in this ring">&#9664; Prev</button><button class="dbtn" data-ring="random" title="Random site in this ring">Random</button><button class="dbtn" data-ring="hub" title="List every site in this ring">List</button><button class="dbtn" data-ring="next" title="Next site in this ring">Next &#9654;</button></div>' +
      '<div class="rinfo"><img src="' + ringButton(r) + '" alt="" data-ring="hub" title="Ring hub"><span class="nm" data-ring="hub" title="' + esc(r.name) + '">' + esc(r.name) + '</span><span class="hint">site ' + (site.ringPos + 1) + ' of ' + r.sites.length + '</span></div>' +
      '<div class="rextra">' + versionsButton(site) + '<button class="dbtn" data-site="links">Links</button><button class="dbtn" data-site="guestbook">Guestbook' + (gb ? ' (' + gb + ')' : '') + '</button>' + odo(cur.doc ? S.visits[cur.doc.path] : 0) + '</div>';
  } else {
    const where = cur && cur.appName ? 'You are using ' + ((APPS[cur.appName] && APPS[cur.appName].name) || 'a LANscape program') + '. ' : cur && cur.url && /^ftp:/.test(cur.url) ? 'You are on an FTP server. ' : cur && cur.route && cur.route.type === 'frame' ? 'You are on ' + cur.route.hosted.title + ', a site hosted on this server. ' : cur && cur.url && /^http/.test(cur.url) ? 'You are on a LANscape portal page. ' : '';
    el.innerHTML = '<div class="rnav"><button class="dbtn" data-act="random">Random Site</button><button class="dbtn" data-act="rings">Web Rings</button><button class="dbtn" data-act="programs">Programs</button></div><div class="rinfo"><span class="hint">' +
      where + S.sites.length + ' sites on ' + S.rings.length + ' web rings</span></div>';
  }
}
$('#ringstrip').addEventListener('click', e => {
  const b = e.target.closest('[data-ring],[data-site],[data-act]');
  if (!b) return;
  const site = S.cur && S.cur.site;
  if (b.dataset.act === 'random') return randomSite();
  if (b.dataset.act === 'rings') return go('http://www.ringhub.org/');
  if (b.dataset.act === 'programs') return go('http://home.lanscape.net/programs');
  if (!site) return;
  if (b.dataset.site === 'versions') return go(site.url + 'versions/');
  if (b.dataset.site) return go(site.url + b.dataset.site);
  const r = site.ring;
  if (b.dataset.ring === 'hub') return go('http://www.ringhub.org/ring/' + r.id);
  go('http://www.ringhub.org/go?ring=' + encodeURIComponent(r.id) + '&dir=' + b.dataset.ring + '&from=' + encodeURIComponent(site.key));
});

/* ---------------- dial-up audio ---------------- */
let AC = null;
function audio() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; } }
function tone(ctx, f1, f2, t, dur, vol = 0.06) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.setValueAtTime(vol, t + dur - 0.02); g.gain.linearRampToValueAtTime(0, t + dur);
  g.connect(ctx.destination);
  for (const f of [f1, f2].filter(Boolean)) { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + dur); }
}
function noise(ctx, t, dur, vol, freq) {
  const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq || 1800; bp.Q.value = 0.8;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start(t);
}
function modemChirp() { const c = audio(); if (!c) return; const t = c.currentTime; tone(c, 2100, 0, t, .18, .03); noise(c, t + .2, .25, .05, 2400); }
function dialUpSound() {
  const c = audio();
  if (!c) return 0;
  const DTMF = { 1: [697, 1209], 2: [697, 1336], 3: [697, 1477], 4: [770, 1209], 5: [770, 1336], 6: [770, 1477], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477], 0: [941, 1336] };
  let t = c.currentTime + 0.1;
  tone(c, 350, 440, t, 1.0, .04); t += 1.1;
  for (const d of '5551998') { tone(c, DTMF[d][0], DTMF[d][1], t, .09, .06); t += .14; }
  t += .5;
  tone(c, 440, 480, t, 1.2, .035); t += 1.6;
  tone(c, 2100, 0, t, 1.6, .045);
  for (let i = 1; i < 4; i++) tone(c, 2100, 0, t + i * .45, .02, 0);
  t += 1.7;
  tone(c, 980, 1180, t, .6, .03); noise(c, t + .1, .5, .05, 1200); t += .7;
  for (let i = 0; i < 6; i++) { tone(c, 1650 + i * 90, 0, t, .08, .03); t += .1; }
  noise(c, t, 1.6, .07, 2000); noise(c, t + .4, 1.2, .05, 3200); t += 1.7;
  return (t - c.currentTime) * 1000;
}
