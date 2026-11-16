/* The Watch in the reader's language, for the article pages (everything that is not the front page).
 *
 * The front page translates itself (news/index.html, T() and news/i18n/<lang>.json). The article pages are static
 * HTML written by a dozen builders, so they are translated from outside: news/i18n/translate.py reads every page,
 * cuts it into segments, has them translated once (Claude, Message Batches) into a translation memory, and writes
 * one small dictionary per page: news/i18n/pt/<page path>.json, {key: translation}. This script, on every page,
 * cuts the page into the SAME segments, looks each one up and swaps it in place. Elements are moved, never rebuilt,
 * so links, listeners and charts keep working. Text the page's own scripts draw later (HUDs, cards, notes loaded
 * from JSON) is caught by a watcher and looked up in the same dictionaries plus news/i18n/pt/ui.json and the
 * bundles made for the JSON files the page fetches (news/i18n/pt/_data/...).
 *
 * The language: ?lang=pt|en, then the reader's last choice (localStorage watch.lang, shared with the front page),
 * then the browser's languages. A segment with no translation stays in English; nothing breaks.
 *   ?lang=xx   test mode: nothing is translated, every segment the dictionaries lack is listed in window.__watchMissing
 *   window.__watchLang.segments()  the page's segments (what translate.py must also find; used by the self-test)
 *
 * KEEP IN STEP with translate.py: SKIP, BLOCK, hasText(), norm(), the serializer and key(). tools/selftest.py checks.
 */
(function () {
  'use strict';
  if (window.__watchLang) return;
  var ROOT = '/lanscape-navigator/', BASE = ROOT + 'news/i18n/';
  var LANGS = { pt: { dir: 'pt', html: 'pt-BR', name: 'Português' } };
  var SKIP = 'script,style,noscript,template,textarea,code,pre,svg title,svg desc,[translate="no"],.notranslate,.sources ol,.srcs,.cite,.wl-ui';
  var BLOCK = { address: 1, article: 1, aside: 1, blockquote: 1, details: 1, dd: 1, div: 1, dl: 1, dt: 1, fieldset: 1, figcaption: 1, figure: 1, footer: 1, form: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, header: 1, hr: 1, li: 1, main: 1, nav: 1, ol: 1, p: 1, section: 1, table: 1, tbody: 1, thead: 1, tfoot: 1, tr: 1, td: 1, th: 1, ul: 1, summary: 1, select: 1, option: 1, button: 1, svg: 1, g: 1, text: 1, canvas: 1, video: 1, iframe: 1 };
  var ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
  var WS = /[ \t\n\r\f]+/g, LETTERS = /[A-Za-zÀ-ɏ]{2}/;
  function hasText(s) { return LETTERS.test(s); }
  function norm(s) { return s.replace(WS, ' '); }
  function trim(s) { return s.replace(/^ +| +$/g, ''); }
  function key(str) {  /* cyrb53 over UTF-16 code units, base 36 */
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  /* ---------- which language ---------- */
  var qs = new URLSearchParams(location.search), q = (qs.get('lang') || '').toLowerCase(), lang = 'en', TEST = q === 'xx';
  try {
    if (q === 'pt' || q === 'en' || q === 'de') { lang = q; localStorage.setItem('watch.lang', q); }
    else {
      var saved = localStorage.getItem('watch.lang');
      if (saved) lang = saved;
      else { var nl = (navigator.languages || [navigator.language || 'en']); for (var i = 0; i < nl.length; i++) { var two = String(nl[i]).slice(0, 2).toLowerCase(); if (two === 'en') break; if (LANGS[two]) { lang = two; break; } } }
    }
  } catch (e) { if (LANGS[q]) lang = q; }
  var L = LANGS[lang] || null;
  var here = location.pathname.replace(/\/$/, '/index.html');
  var rel = here.indexOf(ROOT) === 0 ? here.slice(ROOT.length) : null;   // "news/wave/texas.html"

  /* ---------- the segments (the same walk as translate.py) ---------- */
  function isEl(n) { return n.nodeType === 1; }
  function tag(el) { return (el.localName || '').toLowerCase(); }
  function skip(el) { try { return el.matches(SKIP); } catch (e) { return false; } }
  function serialize(el, ctx) {
    var out = '';
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) out += c.nodeValue;
      else if (isEl(c)) {
        var i = ++ctx.n; ctx.els[i] = c;
        if (skip(c)) out += '<' + i + '/>';
        else if (BLOCK[tag(c)] || !hasText(c.textContent)) { out += '<' + i + '/>'; ctx.later.push(c); }
        else { ctx.open[i] = 1; out += '<' + i + '>' + serialize(c, ctx) + '</' + i + '>'; }
      }
    }
    return out;
  }
  function directText(el) { for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && hasText(c.nodeValue)) return true; return false; }
  /* visit(el, onSeg, onAttr): onSeg(el, source, ctx), onAttr(el, attrName, source) */
  function visit(el, onSeg, onAttr) {
    if (!isEl(el) || skip(el)) return;
    for (var a = 0; a < ATTRS.length; a++) { var v = el.getAttribute(ATTRS[a]); if (v && hasText(v)) onAttr(el, ATTRS[a], trim(norm(v))); }
    if (directText(el)) {
      var ctx = { n: 0, els: {}, open: {}, later: [] }, raw = norm(serialize(el, ctx));
      onSeg(el, trim(raw), ctx, raw);
      for (var k = 1; k <= ctx.n; k++) if (ctx.open[k]) attrsOnly(ctx.els[k], onAttr);
      for (var j = 0; j < ctx.later.length; j++) visit(ctx.later[j], onSeg, onAttr);
    } else for (var c = el.firstElementChild; c; c = c.nextElementSibling) visit(c, onSeg, onAttr);
  }
  function attrsOnly(el, onAttr) { for (var a = 0; a < ATTRS.length; a++) { var v = el.getAttribute(ATTRS[a]); if (v && hasText(v)) onAttr(el, ATTRS[a], trim(norm(v))); } }
  function segments(doc) {
    doc = doc || document; var out = [];
    var t = doc.querySelector('head > title'); if (t && hasText(t.textContent)) out.push(trim(norm(t.textContent)));
    var m = doc.querySelector('head > meta[name="description"]'); if (m && hasText(m.getAttribute('content') || '')) out.push(trim(norm(m.getAttribute('content'))));
    if (doc.body) visit(doc.body, function (el, s) { out.push(s); }, function (el, a, s) { out.push(s); });
    return out.filter(Boolean);
  }

  /* ---------- the picker (on every page, whatever the language) ---------- */
  var UI = { en: { note: '', pick: 'Language' }, pt: { note: 'Traduzido por IA (Claude) do original em inglês.', orig: 'Ver o original', pick: 'Idioma' } };
  function choose(l) { try { localStorage.setItem('watch.lang', l); } catch (e) { } var u = new URL(location.href); u.searchParams.delete('lang'); if (!canStore()) u.searchParams.set('lang', l); location.href = u.toString(); }
  function canStore() { try { localStorage.setItem('watch.t', '1'); localStorage.removeItem('watch.t'); return true; } catch (e) { return false; } }
  function picker() {
    if (document.querySelector('.wl-ui')) return;
    var css = document.createElement('style');
    css.textContent = '.wl-pick{display:inline-flex;flex:none;white-space:nowrap;border:1px solid currentColor;border-radius:999px;overflow:hidden;font:600 11px/1 system-ui,-apple-system,Segoe UI,sans-serif;letter-spacing:.04em;opacity:.85;vertical-align:middle}' +
      '.wl-pick button{all:unset;cursor:pointer;padding:7px 10px;color:inherit;min-width:0}.wl-pick button[aria-pressed="true"]{background:currentColor}.wl-pick button[aria-pressed="true"] span{color:#fff;mix-blend-mode:difference}' +
      '.wl-pick button:focus-visible{outline:2px solid;outline-offset:-2px}' +
      '.wl-note{display:flex;align-items:center;justify-content:space-between;gap:12px;font:12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;padding:8px 16px;margin:0 auto;max-width:1100px}.wl-note>span{opacity:.75}.wl-note>span:empty{flex:1}.wl-note a{color:inherit;text-decoration:underline;cursor:pointer}' +
      '@media print{.wl-ui{display:none}}';
    document.head.appendChild(css);
    var box = document.createElement('span'); box.className = 'wl-ui wl-pick'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', (UI[lang] || UI.en).pick);
    [['en', 'EN', 'English'], ['pt', 'PT', 'Português']].forEach(function (o) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', String((L ? lang : 'en') === o[0])); b.title = o[2]; b.lang = o[0];
      var s = document.createElement('span'); s.textContent = o[1]; b.appendChild(s);
      b.addEventListener('click', function () { choose(o[0]); }); box.appendChild(b);
    });
    /* wide screens: in the masthead, beside Share; phones (no room there): a slim line at the top of the article */
    var mast = document.querySelector('.mast-r'), wide = !window.matchMedia || window.matchMedia('(min-width: 720px)').matches;
    var note = L && UI[lang] && UI[lang].note, inMast = wide && mast && mast.getClientRects().length;
    if (inMast) mast.insertBefore(box, mast.firstChild);
    if (note || !inMast) {
      var p = document.createElement('p'); p.className = 'wl-ui wl-note'; if (L) p.lang = L.html;
      var sp = document.createElement('span');
      if (note) {
        sp.appendChild(document.createTextNode(UI[lang].note + ' '));
        var a = document.createElement('a'); a.textContent = UI[lang].orig; a.href = '?lang=en'; a.addEventListener('click', function (e) { e.preventDefault(); choose('en'); }); sp.appendChild(a);
      }
      p.appendChild(sp); if (!inMast) p.appendChild(box);
      var main = document.querySelector('main') || document.body; main.insertBefore(p, main.firstChild);
    }
  }

  /* ---------- translating ---------- */
  var D = {}, missing = {}, done = new WeakMap(), attrDone = new WeakMap(), numDone = new WeakMap(), obs = null, loaded = {}, INDEX = null, pendingScan = false;
  function getJSON(u) { return _fetch(u, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  var _fetch = window.fetch ? window.fetch.bind(window) : null;
  function merge(d) { if (d) for (var k in d) D[k] = d[k]; }
  var NUM = /\d[\d,]*\.\d+|\d{1,3}(?:,\d{3})+|\d+/g, MASK = /<\/?\d+\/?>|\d[\d,]*\.\d+|\d{1,3}(?:,\d{3})+|\d+/g;
  function ptNum(s) { return /[.,]/.test(s) ? s.replace(/[.,]/g, function (c) { return c === ',' ? '.' : ','; }) : s; }
  function lookup(src) {
    var t = D[key(src)]; if (t != null) return t;
    if (/\d/.test(src.replace(/<\/?\d+\/?>/g, ''))) {  /* text with numbers the scripts fill in: "{1} of {2} counties" */
      var nums = [], masked = src.replace(MASK, function (m) { if (m.charAt(0) === '<') return m; nums.push(m); return '{' + nums.length + '}'; });
      t = D[key(masked)];
      if (t != null) return t.replace(/\{(\d+)\}/g, function (m, i) { return nums[i - 1] != null ? ptNum(nums[i - 1]) : m; });
    }
    return null;
  }
  function build(el, t, ctx, raw) {
    var toks = t.split(/(<\/?\d+\/?>)/), seen = {}, ok = true, n = 0;
    toks.forEach(function (x) { var m = /^<(\d+)\/?>$/.exec(x); if (m) { if (!ctx.els[m[1]] || seen[m[1]]) ok = false; seen[m[1]] = 1; n++; } });
    if (!ok || n !== ctx.n) return false;
    for (var i = 1; i <= ctx.n; i++) if (ctx.open[i]) while (ctx.els[i].firstChild) ctx.els[i].removeChild(ctx.els[i].firstChild);
    while (el.firstChild) el.removeChild(el.firstChild);
    var stack = [el];
    if (raw.charAt(0) === ' ') el.appendChild(document.createTextNode(' '));
    toks.forEach(function (x) {
      if (!x) return;
      var m = /^<(\/?)(\d+)(\/?)>$/.exec(x), top = stack[stack.length - 1];
      if (!m) { var tn = document.createTextNode(x); numDone.set(tn, x); top.appendChild(tn); }
      else if (m[1]) { if (stack.length > 1) stack.pop(); }
      else { top.appendChild(ctx.els[m[2]]); if (!m[3]) stack.push(ctx.els[m[2]]); }
    });
    if (raw.charAt(raw.length - 1) === ' ') el.appendChild(document.createTextNode(' '));
    return true;
  }
  function numbers(root) {  /* bare numbers in cells and labels: 1,234.5 -> 1.234,5 */
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function (n) {
      var v = n.nodeValue; if (!/\d[.,]\d/.test(v) || hasText(v) || numDone.get(n) === v) return;
      var p = n.parentElement; if (!p || p.closest(SKIP + ',input,select')) return;
      var nv = v.replace(NUM, ptNum); n.nodeValue = nv; numDone.set(n, nv);
    });
  }
  function apply(root) {
    if (!root || !isEl(root)) return;
    visit(root, function (el, src, ctx, raw) {
      if (done.get(el) === el.textContent) return;
      var t = lookup(src);
      if (t == null) { if (!done.has(el)) missing[src] = 1; return; }
      if (TEST) return;
      if (ctx.n === 0) { el.textContent = (raw.charAt(0) === ' ' ? ' ' : '') + t + (raw.charAt(raw.length - 1) === ' ' ? ' ' : ''); if (el.firstChild) numDone.set(el.firstChild, el.firstChild.nodeValue); }
      else if (!build(el, t, ctx, raw)) return;
      done.set(el, el.textContent);
    }, function (el, a, src) {
      var set = attrDone.get(el); if (set && set[a] === el.getAttribute(a)) return;
      var t = lookup(src); if (t == null) { missing[src] = 1; return; }
      if (!TEST && el.getAttribute(a) !== t) { el.setAttribute(a, t); if (!set) attrDone.set(el, set = {}); set[a] = t; }
    });
    if (!TEST) numbers(root);
  }
  function head() {
    var t = document.querySelector('head > title'), m = document.querySelector('head > meta[name="description"]'), x;
    if (t && (x = lookup(trim(norm(t.textContent)))) != null && !TEST) document.title = x;
    if (m && (x = lookup(trim(norm(m.content || '')))) != null && !TEST) m.content = x;
  }
  function scan() { pendingScan = false; if (!document.body) return; apply(document.body); if (obs) obs.takeRecords(); }
  function later() { if (!pendingScan) { pendingScan = true; setTimeout(scan, 30); } }
  function watch() {
    if (!window.MutationObserver) return;
    var roots = [], timer = 0;
    function flush() { timer = 0; var rs = roots.length > 40 ? [document.body] : roots; roots = []; rs.forEach(function (r) { if (document.body.contains(r)) apply(r); }); obs.takeRecords(); }
    obs = new MutationObserver(function (recs) {
      recs.forEach(function (r) {
        var n = r.type === 'characterData' ? r.target.parentElement : r.target;
        if (!n || !isEl(n) || !document.body.contains(n) || (n.closest && n.closest('.wl-ui'))) return;
        /* a change inside a segment re-translates the whole segment: climb to the element that holds the text */
        var up = n; while (up.parentElement && up !== document.body && !BLOCK[tag(up)]) up = up.parentElement;
        if (roots.indexOf(up) < 0) roots.push(up);
      });
      if (roots.length && !timer) timer = setTimeout(flush, 60);
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  /* the JSON a page fetches may have its own bundle of translations (county notes, House notes, captions) */
  function bundleFor(url) {
    try {
      var u = new URL(url, location.href); if (u.origin !== location.origin || u.pathname.indexOf(ROOT) !== 0) return;
      var r = u.pathname.slice(ROOT.length); if (!INDEX || !INDEX.data || !INDEX.data[r] || loaded[r]) return;
      loaded[r] = 1; getJSON(BASE + L.dir + '/_data/' + r + '?v=' + INDEX.data[r]).then(function (d) { merge(d); later(); });
    } catch (e) { }
  }
  var early = [];
  function hookFetch() {
    if (!_fetch) return;
    window.fetch = function (input, init) { var u = typeof input === 'string' ? input : (input && input.url) || ''; if (/\.json(\?|$)/.test(u)) { if (INDEX) bundleFor(u); else early.push(u); } return _fetch(input, init); };
  }

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function show() { document.documentElement.classList.remove('wl-wait'); }

  window.__watchLang = { lang: lang, segments: segments, key: key, missing: function () { return Object.keys(missing); }, apply: scan, choose: choose };
  Object.defineProperty(window, '__watchMissing', { get: function () { return Object.keys(missing); }, configurable: true });

  if (rel === null || /^news\/(index\.html)?$/.test(rel) || document.documentElement.hasAttribute('data-wl-off')) return;   // the front page does its own
  if (!L && !TEST) { getJSON(BASE + 'pt/index.json').then(function (ix) { if (ix && ix.pages && ix.pages[rel]) ready(picker); }); return; }
  if (TEST) { L = LANGS.pt; }

  /* translate: hide the page for at most 1.2 s while the dictionaries arrive, so readers do not watch it change */
  if (document.readyState === 'loading') document.documentElement.classList.add('wl-wait');
  var st = document.createElement('style'); st.textContent = 'html.wl-wait body{opacity:0}'; (document.head || document.documentElement).appendChild(st);
  setTimeout(show, 1200);
  hookFetch();
  getJSON(BASE + L.dir + '/index.json').then(function (ix) {
    INDEX = ix || {};
    if (!ix || !ix.pages || !ix.pages[rel]) { show(); return; }
    early.forEach(bundleFor); early = [];
    var v = '?v=' + ix.pages[rel];
    return Promise.all([getJSON(BASE + L.dir + '/' + rel.replace(/\.html$/, '.json') + v), getJSON(BASE + L.dir + '/ui.json?v=' + (ix.ui || 0))]).then(function (ds) {
      merge(ds[1]); merge(ds[0]);
      ready(function () {
        if (!TEST) document.documentElement.lang = L.html;
        head(); scan(); picker(); watch(); show();
        setTimeout(scan, 600); setTimeout(scan, 2500);
      });
    });
  }).catch(show);
})();
