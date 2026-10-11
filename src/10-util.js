/* ===================================================================
   LANscape Navigator — utilities, storage, state
   =================================================================== */
const VERSION = '4.1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad = (n, w) => String(n).padStart(w, '0');
const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
const MOD = isMac ? '⌘' : 'Ctrl+';

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) e.style.setProperty(sk, v[sk]); else e.style[sk] = v[sk]; } }
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
function hash32(s) {
  let h = 0x811c9dc5;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function rng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function debounce(fn, ms) {
  let t = null, args = [];
  const f = (...a) => { args = a; clearTimeout(t); t = setTimeout(() => { t = null; fn(...args); }, ms); };
  f.flush = () => { if (t) { clearTimeout(t); t = null; fn(...args); } };   // run a waiting call now
  return f;
}
function fmtBytes(n) {
  n = n || 0;
  if (n < 1024) return n + ' bytes';
  if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + 'K';
  if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
  return (n / 1073741824).toFixed(2) + ' GB';
}
function fmtK(n) { return Math.max(1, Math.round((n || 0) / 1024)) + 'k'; }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(ts, withTime) {
  if (!ts) return '—';
  const d = new Date(ts);
  let s = MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  if (withTime) { let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; s += ' ' + h + ':' + pad(d.getMinutes(), 2) + ' ' + ap; }
  return s;
}
function fmtShort(ts) { const d = new Date(ts); return pad(d.getMonth() + 1, 2) + '/' + pad(d.getDate(), 2) + '/' + String(d.getFullYear()).slice(2); }
function dayKey(ts) { const d = new Date(ts == null ? Date.now() : ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2); }
function ago(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' hr ago';
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : d + ' days ago';
}
function slug(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'x';
}
function extOf(name) { const m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }
function uniq(arr) { return Array.from(new Set(arr)); }
const MIME = {
  html: 'text/html', htm: 'text/html', xhtml: 'application/xhtml+xml', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript',
  json: 'application/json', txt: 'text/plain', md: 'text/plain', csv: 'text/csv', xml: 'application/xml', svg: 'image/svg+xml',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', bmp: 'image/bmp',
  pdf: 'application/pdf', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime'
};
Object.assign(MIME, {
  flac: 'audio/flac', oga: 'audio/ogg', opus: 'audio/ogg', aac: 'audio/aac', weba: 'audio/webm', mid: 'audio/midi', midi: 'audio/midi', kar: 'audio/midi', rmi: 'audio/midi', aif: 'audio/aiff', aiff: 'audio/aiff', wave: 'audio/wav',
  m4v: 'video/mp4', ogv: 'video/ogg', mkv: 'video/x-matroska', avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv', mpg: 'video/mpeg', mpeg: 'video/mpeg', '3gp': 'video/3gpp', flv: 'video/x-flv',
  vtt: 'text/vtt', srt: 'text/plain', tsv: 'text/tab-separated-values', rtf: 'application/rtf', zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint',
  tif: 'image/tiff', tiff: 'image/tiff', jfif: 'image/jpeg', jpe: 'image/jpeg', heic: 'image/heic', heif: 'image/heif'
});
const PAGE_EXT = new Set(['html', 'htm', 'xhtml', 'shtml']);
const IMG_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp']);
/** text from bytes: honours BOMs, prefers UTF-8, falls back to Windows-1252 for old files */
function decodeText(u8) {
  if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) return new TextDecoder('utf-8').decode(u8.subarray(3));
  if (u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder('utf-16le').decode(u8.subarray(2));
  if (u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder('utf-16be').decode(u8.subarray(2));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) { /* not UTF-8 */ }
  try { return new TextDecoder('windows-1252').decode(u8); } catch (e) { return new TextDecoder('utf-8').decode(u8); }
}
async function blobText(b) { return decodeText(new Uint8Array(await b.arrayBuffer())); }
const fmtDur = s => { s = Math.max(0, Math.round(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + pad(m, 2) : m) + ':' + pad(x, 2); };

/* ---------------- IndexedDB (with graceful in-memory fallback) ---------------- */
const DB = (() => {
  let db = null, ok = false;
  // mthumbs: picture thumbnails and video posters, read on demand (there can be thousands)
  const STORES = { meta: 'path', content: 'path', thumbs: 'path', kv: 'k', mthumbs: 'path' };
  function open() {
    return new Promise(res => {
      let req;
      try { req = indexedDB.open('lanscape-navigator', 2); } catch (e) { res(false); return; }
      const timer = setTimeout(() => res(false), 4000);
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const s in STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: STORES[s] });
      };
      req.onsuccess = () => { clearTimeout(timer); db = req.result; ok = true; res(true); };
      req.onerror = () => { clearTimeout(timer); res(false); };
      req.onblocked = () => { clearTimeout(timer); res(false); };
    });
  }
  function run(store, mode, fn) {
    if (!ok) return Promise.resolve(undefined);
    return new Promise(res => {
      let t, out;
      try { t = db.transaction(store, mode); out = fn(t.objectStore(store)); } catch (e) { res(undefined); return; }
      t.oncomplete = () => { try { res(out && typeof out === 'object' && 'readyState' in out ? out.result : true); } catch (e) { res(undefined); } };
      t.onerror = () => res(undefined);
      t.onabort = () => res(undefined);
    });
  }
  // every key that starts with a folder path (keys are paths, so a folder is one key range)
  const under = prefix => IDBKeyRange.bound(prefix, prefix + '￿￿', false, false);
  return {
    open,
    get ok() { return ok; },
    get: (st, k) => run(st, 'readonly', s => s.get(k)),
    getAll: st => run(st, 'readonly', s => s.getAll()),
    put: (st, v) => run(st, 'readwrite', s => { s.put(v); }),
    putMany: (st, arr) => run(st, 'readwrite', s => { for (const v of arr) s.put(v); }),
    del: (st, k) => run(st, 'readwrite', s => { s.delete(k); }),
    delMany: (st, keys) => run(st, 'readwrite', s => { for (const k of keys) s.delete(k); }),
    clear: st => run(st, 'readwrite', s => { s.clear(); }),
    /** forget every record under a folder */
    delPrefix: (st, prefix) => run(st, 'readwrite', s => { s.delete(under(prefix)); }),
    /** move every record under one folder to another (one transaction; records already at the destination are replaced) */
    movePrefix: (st, from, to, fix) => run(st, 'readwrite', s => {
      const kp = s.keyPath;
      const req = s.getAll(under(from));
      req.onsuccess = () => {
        s.delete(under(from));
        for (const v of req.result || []) {
          const nv = Object.assign({}, v);
          nv[kp] = to + String(v[kp]).slice(from.length);
          if (fix) fix(nv);
          s.put(nv);
        }
      };
    })
  };
})();

/* ---------------- application state ---------------- */
const DEFAULT_PREFS = {
  theme: 'classic', speed: 'lan', sounds: false, interstitial: true, sandbox: 'trusted',
  deep: true, scriptIndex: true, scheme: 'vanity', demo: true,
  granularity: 1.0, cache: true, sidebar: false, sideTab: 'search', showDir: true, showRing: true,
  previews: true, startup: 'home', homepage: 'http://home.lanscape.net/', confirmExternal: true,
  author: '', ampOpen: false, ampEq: false, ampPl: false, ampPos: null, ampShade: false, ampVis: 0, ampRemain: false,
  vol: 0.8, bal: 0, shuffle: false, repeat: 'off', eqOn: false, eqPre: 0, eqBands: null, eqPreset: 'Flat',
  fold: 'normal'          // duplicates and old versions: off | copies | normal | loose
};
const S = {
  prefs: Object.assign({}, DEFAULT_PREFS),
  docs: new Map(),        // path -> record for every file (pages, documents, media, files)
  lower: new Map(),       // lowercased path -> real path (case-insensitive lookups)
  live: new Map(),        // path -> File (current session)
  fh: new Map(),          // path -> FileSystemFileHandle
  roots: [],              // [{name, src, mode, loadedAt, files, off, bytes, counts}]
  rootHandles: new Map(), // root name -> FileSystemDirectoryHandle
  excluded: [],           // folders taken off the LANscape ('Root/sub/'); their index is kept
  parked: new Map(),      // path -> record for files in those folders (searchable again the moment they're turned back on)
  offFiles: new Map(),    // path -> File or handle seen this session inside a folder that's turned off
  thumbs: new Map(),      // path -> dataURL
  thumbAt: new Map(),     // path -> mtime the preview was painted for
  hoods: new Map(), curNonce: null,
  blobs: new Map(),       // path -> object URL
  demoSrc: new Map(),     // path -> html/text/Blob/generator (demo web)
  bookmarks: null, history: [], visits: {}, guestbook: {}, dns: {}, ringNames: {}, ringMoves: {}, customRings: [],
  typed: [], firstSeen: {}, seenDemo: false,
  music: {},              // path -> {plays, last, rating, skips}
  playlists: [],          // [{id, name, paths:[]}]
  videoPos: {},           // path -> {t, d, ts} resume points
  recentDocs: [],         // [{path, ts}] files opened in the apps
  foldRules: { split: [], join: [], keep: [] },   // your corrections to the duplicate finder (by path)
  folds: new Map(), foldSig: '', foldStats: null, // groups of copies and versions
  ix: null, sites: [], siteByKey: new Map(), rings: [], ringById: new Map(), hostMap: new Map(),
  ftpHosts: new Map(),    // ftp host -> root folder
  rootFtp: new Map(),     // root folder -> ftp host
  slugs: new Map(),       // 'song:x' / 'video:x' / 'photo:x' / 'album:x' -> doc or path list
  tree: new Map(),        // folder path ('Root/sub/') -> {dirs:Set, files:[docs]}
  gen: 0,                 // bumps whenever the library is rebuilt (cache key for the apps)
  tab: { stack: [], idx: -1 }, navToken: 0, cur: null, visited: new Set()
};
const persisted = ['prefs', 'bookmarks', 'history', 'visits', 'guestbook', 'dns', 'ringNames', 'ringMoves', 'customRings', 'typed', 'firstSeen', 'seenDemo', 'music', 'playlists', 'videoPos', 'recentDocs', 'excluded', 'foldRules'];
const saveState = debounce(() => {
  const v = {};
  for (const k of persisted) v[k] = S[k];
  DB.put('kv', { k: 'state', v });
  try { localStorage.setItem('lanscape:prefs', JSON.stringify(S.prefs)); } catch (e) { /* storage blocked */ }
}, 350);
// closing or reloading the tab right after a change still saves it
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => saveState.flush());
async function loadState() {
  let v = null;
  const rec = await DB.get('kv', 'state');
  if (rec && rec.v) v = rec.v;
  if (!v) { try { const p = JSON.parse(localStorage.getItem('lanscape:prefs') || 'null'); if (p) v = { prefs: p }; } catch (e) { /* ignore */ } }
  if (v) for (const k of persisted) if (v[k] != null) S[k] = k === 'prefs' ? Object.assign({}, DEFAULT_PREFS, v[k]) : v[k];
  S.visited = new Set((S.history || []).map(h => h.url));
}
