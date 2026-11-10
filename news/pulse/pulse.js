/* The Pulse: how The Watch is read.
 *
 * One script on every page of The Watch. It counts, without cookies and without anything that identifies a person:
 *   a visit to the page, how far down it was read (25/50/75/100%), how long it held the reader (30 s, 1, 3, 10 min of
 *   active time), which links were followed, shares, downloads, video plays, the first touch on a 3-D map or chart,
 *   searches on the front page, and the reader's own verdict (worth it / not really, and an optional note).
 * Counts go to GoatCounter (no cookies, no personal data; https://www.goatcounter.com). news/pulse/fetch.py reads them
 * back on GitHub Actions into news/pulse/data/stats.json, which the dashboard (news/pulse/) and Claude read.
 *
 * Event names: "<kind>|<page>[|<detail>]", e.g. "read50|/news/wave/", "out|/news/wave/|nytimes.com".
 * A browser can opt out (Brad's own, for one): open any page with ?pulse=off (and ?pulse=on to undo).
 * Pages opt out of the reader card with <body data-pulse-card="off">, out of everything with data-pulse="off".
 */
(function () {
  'use strict';
  if (window.__pulse) return;
  window.__pulse = true;

  var CODE = 'thewatch-pulse';            // GoatCounter site code: https://<CODE>.goatcounter.com
  var ENDPOINT = 'https://' + CODE + '.goatcounter.com/count';
  var BASE = '/lanscape-navigator';
  var SITE = 'https://bboldt86.github.io' + BASE;

  var d = document, w = window, ls = null;
  try { ls = w.localStorage; } catch (e) {}
  function lget(k) { try { return ls && ls.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { ls && (v == null ? ls.removeItem(k) : ls.setItem(k, v)); } catch (e) {} }

  // ---- opt-out and who not to count -------------------------------------------------------------------------------
  var q = location.search;
  if (/[?&]pulse=off\b/.test(q)) lset('pulse.off', '1');
  if (/[?&]pulse=on\b/.test(q)) lset('pulse.off', null);
  var off = lget('pulse.off') === '1' || navigator.webdriver ||
    /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === 'file:' ||
    (d.body && d.body.dataset && d.body.dataset.pulse === 'off') ||
    /bot|crawl|spider|headless|lighthouse|preview/i.test(navigator.userAgent) ||
    (d.visibilityState === 'prerender');
  var DEBUG = /[?&]pulse=debug\b/.test(q) || lget('pulse.debug') === '1';
  if (/[?&]pulse=debug\b/.test(q)) lset('pulse.debug', '1');
  if (/[?&]pulse=nodebug\b/.test(q)) lset('pulse.debug', null);

  // ---- the page's name --------------------------------------------------------------------------------------------
  function pagePath() {
    var p = location.pathname;
    if (p.indexOf(BASE) === 0) p = p.slice(BASE.length) || '/';
    p = p.replace(/index\.html?$/, '');
    var h = location.hash || '';
    // The front page is one page with many views (#/s/politics, #/a/…): each view counts as its own page.
    if (/^\/news\/$/.test(p) && /^#\//.test(h)) {
      h = h.replace(/^#\/q\/.*$/, '#/q');           // searches are counted as searches, not as pages
      p = p + h.split('?')[0].slice(0, 120);
    }
    return p;
  }
  function clean(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f|]+/g, ' ').trim().slice(0, n || 200); }

  // ---- sending ----------------------------------------------------------------------------------------------------
  var sent = {};                                       // one of each event per page view
  function send(path, title, event, extra) {
    var o = { p: path, t: clean(title || d.title, 300), rnd: Math.random().toString(36).slice(2, 8) };
    if (event) o.e = 'true';
    else {
      o.r = d.referrer || '';
      o.s = [screen.width, screen.height, Math.round((w.devicePixelRatio || 1) * 100) / 100].join(',');
      o.q = location.search;                            // GoatCounter reads utm_*/ref/s for campaigns
    }
    if (extra) for (var k in extra) o[k] = extra[k];
    if (DEBUG) try { console.log('[pulse]', event ? 'event' : 'view', path, o.t); } catch (e) {}
    if (off) return;
    var qs = Object.keys(o).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&');
    var url = ENDPOINT + '?' + qs;
    try { if (navigator.sendBeacon && navigator.sendBeacon(url)) return; } catch (e) {}
    var img = new Image(); img.src = url;
  }
  function ev(kind, detail, title) {
    var name = kind + '|' + PAGE + (detail ? '|' + clean(detail, 400) : '');
    if (sent[name]) return;
    sent[name] = 1;
    send(name, title || kind, true);
  }
  window.pulse = { event: function (kind, detail) { ev(clean(kind, 24), detail); }, off: function () { lset('pulse.off', '1'); off = true; }, on: function () { lset('pulse.off', null); } };

  // ---- the page view, and where the reader came from --------------------------------------------------------------
  var PAGE, depth, active, lastAct, timer;
  function view() {
    PAGE = pagePath(); sent = {}; depth = 0; active = 0; lastAct = Date.now();
    send(PAGE, d.title, false);
    var m = /[?&](?:s|ref|utm_source)=([\w.-]{1,40})/.exec(location.search);
    if (m) ev('src', m[1]);
    else if (/\/news\/r\//.test(d.referrer)) ev('src', 'shared-link');
    else if (d.referrer) {
      try { var r = new URL(d.referrer); if (r.host !== location.host) ev('src', r.host.replace(/^www\./, '')); } catch (e) {}
    }
  }

  // ---- reading: depth and active time -----------------------------------------------------------------------------
  function act() { lastAct = Date.now(); }
  ['scroll', 'pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'].forEach(function (t) { w.addEventListener(t, act, { passive: true }); });
  function measure() {
    var h = Math.max(d.documentElement.scrollHeight, d.body ? d.body.scrollHeight : 0);
    var seen = (w.scrollY || d.documentElement.scrollTop) + w.innerHeight;
    var f = h > 0 ? seen / h : 1;
    // Only a reader who has spent a few seconds on the page counts as having read it.
    if (active < 5) return;
    [25, 50, 75, 100].forEach(function (p) { if (f >= (p === 100 ? 0.96 : p / 100) && depth < p) { depth = p; ev('read' + p); } });
  }
  function tick() {
    // Active time: the page is on screen and the reader did something in the last minute (a 3-D replay that is being
    // watched counts while the tab is visible and the pointer was used recently).
    if (d.visibilityState === 'visible' && Date.now() - lastAct < 60000) {
      active++;
      if (active === 30) ev('t30');
      if (active === 60) ev('t60');
      if (active === 180) ev('t180');
      if (active === 600) ev('t600');
    }
    measure();
  }
  w.addEventListener('scroll', function () { clearTimeout(timer); timer = setTimeout(measure, 250); }, { passive: true });

  // ---- what readers do --------------------------------------------------------------------------------------------
  function samePage(u) { return u.host === location.host && u.pathname === location.pathname && u.hash && u.hash.indexOf('#/') !== 0; }
  d.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    var sh = t.closest('[data-share],.share,[aria-label*="hare" i]');
    if (sh && !t.closest('a[href^="http"]:not([href*="' + location.host + '"])')) ev('share', sh.getAttribute('data-share') || 'button');
    var a = t.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/^(mailto|tel|sms):/.test(href)) { ev('contact', href.split(':')[0]); return; }
    if (/^javascript:/.test(href)) return;
    var u; try { u = new URL(a.href, location.href); } catch (er) { return; }
    var file = /\.(mp4|mov|webm|png|jpe?g|gif|svg|pdf|csv|json|zip|xlsx|docx|pptx)$/i.test(u.pathname);
    if (a.hasAttribute('download') || (file && u.host === location.host)) { ev('dl', u.pathname.split('/').pop()); return; }
    if (u.host !== location.host) {
      var host = u.host.replace(/^www\./, '');
      if (/twitter\.com|x\.com|facebook\.com|reddit\.com|linkedin\.com|threads\.net|bsky\.app|wa\.me|whatsapp/.test(host) && /share|intent|submit|sharer|send/.test(u.href)) ev('share', host);
      else ev('out', host);
      return;
    }
    if (samePage(u)) return;                              // a jump within the page
    var to = u.pathname.indexOf(BASE) === 0 ? u.pathname.slice(BASE.length) : u.pathname;
    to = to.replace(/index\.html?$/, '') + (/^\/news\/$/.test(to.replace(/index\.html?$/, '')) && u.hash.indexOf('#/') === 0 ? u.hash.slice(0, 80) : '');
    ev('go', to);
  }, true);

  // A first touch on a 3-D map, a chart or a canvas means the reader is playing with the visual.
  d.addEventListener('pointerdown', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('canvas,svg,.wave-root,.viz,.stage,[data-viz]') && !t.closest('a,button')) ev('viz');
  }, { passive: true, capture: true });
  d.addEventListener('play', function (e) {
    var v = e.target; if (!v || !/VIDEO|AUDIO/.test(v.tagName)) return;
    ev('play', (v.currentSrc || v.src || '').split('/').pop().split('?')[0] || 'media');
  }, true);
  d.addEventListener('ended', function (e) {
    var v = e.target; if (!v || !/VIDEO|AUDIO/.test(v.tagName)) return;
    ev('done', (v.currentSrc || v.src || '').split('/').pop().split('?')[0] || 'media');
  }, true);
  d.addEventListener('fullscreenchange', function () { if (d.fullscreenElement) ev('full'); });

  // Searches on the front page: what readers look for, once they stop typing.
  var sT = null;
  function searchWatch() {
    var m = /^#\/q\/(.+)$/.exec(location.hash);
    clearTimeout(sT);
    if (m) sT = setTimeout(function () { var term = decodeURIComponent(m[1]).toLowerCase().trim(); if (term.length > 1) ev('search', term.slice(0, 60)); }, 1600);
  }

  // The front page and other one-page apps change views through the hash: a new view is a new page.
  var lastPage = null;
  function routed() {
    searchWatch();
    var p = pagePath();
    if (p === lastPage || /#\/q$/.test(p)) return;
    lastPage = p;
    view();
    placeCard();
  }
  w.addEventListener('hashchange', routed);

  // ---- the reader card: worth it? a note? pass it on --------------------------------------------------------------
  var CSS = '.pulse-card{max-width:720px;margin:48px auto 40px;padding:20px 22px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:14px;font:inherit;font-size:16px;line-height:1.45;color:inherit;background:color-mix(in srgb,currentColor 3%,transparent);box-sizing:border-box}' +
    '.pulse-wrap{padding:0 20px}@media (max-width:640px){.pulse-wrap{padding:0 16px}.pulse-card{margin:36px auto 28px;padding:18px}}' +
    '.pulse-card h2{font:600 18px/1.3 inherit;margin:0 0 12px;letter-spacing:0}' +
    '.pulse-card .pulse-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
    '.pulse-card button{font:inherit;font-size:15px;cursor:pointer;color:inherit;background:transparent;border:1px solid color-mix(in srgb,currentColor 28%,transparent);border-radius:999px;padding:8px 16px;min-height:40px;display:inline-flex;align-items:center;gap:8px}' +
    '.pulse-card button:hover{border-color:currentColor}.pulse-card button[aria-pressed=true]{background:#A9852F;border-color:#A9852F;color:#fff}' +
    '.pulse-card button.pulse-solid{background:#A9852F;border-color:#A9852F;color:#fff}' +
    '.pulse-card textarea{width:100%;min-height:84px;margin:12px 0 8px;font:inherit;font-size:15px;color:inherit;background:transparent;border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:10px;padding:10px 12px;resize:vertical;box-sizing:border-box}' +
    '.pulse-card .pulse-fine{font-size:13px;opacity:.7;margin:0 0 10px}' +
    '.pulse-card .pulse-pass{margin-top:16px;padding-top:14px;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent);display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}' +
    '.pulse-card .pulse-pass p{margin:0;font-size:15px}.pulse-card .pulse-ok{font-size:15px;margin:4px 0 0}';
  var cardEl = null;
  function placeCard() {
    if (cardEl) { cardEl.remove(); cardEl = null; }
    var b = d.body;
    if (!b || b.dataset.pulseCard === 'off' || b.dataset.pulse === 'off') return;
    if (/^\/news\/(#.*)?$/.test(PAGE) || /^\/news\/pulse\//.test(PAGE)) return;   // not on the front or the dashboard
    // Only pages that are read (they scroll); full-screen visuals and apps get no card.
    var h = Math.max(d.documentElement.scrollHeight, b.scrollHeight);
    if (h < w.innerHeight * 1.6) return;
    if (!d.getElementById('pulse-css')) { var st = d.createElement('style'); st.id = 'pulse-css'; st.textContent = CSS; d.head.appendChild(st); }
    var key = 'pulse.v.' + PAGE, prev = lget(key);
    var wrap = d.createElement('aside'); wrap.className = 'pulse-wrap'; wrap.setAttribute('aria-label', 'Reader feedback');
    wrap.innerHTML = '<div class="pulse-card"><h2>Was this worth your time?</h2>' +
      '<div class="pulse-row"><button type="button" data-v="up" aria-pressed="' + (prev === 'up') + '"><span aria-hidden="true">👍</span>Yes</button>' +
      '<button type="button" data-v="down" aria-pressed="' + (prev === 'down') + '"><span aria-hidden="true">👎</span>Not really</button></div>' +
      '<div class="pulse-more" hidden><label><span class="pulse-q"></span><textarea maxlength="280" placeholder="Optional"></textarea></label>' +
      '<p class="pulse-fine">Notes go to the editor and may be quoted on The Watch. Please leave out names and contact details.</p>' +
      '<button type="button" class="pulse-solid" data-send>Send note</button></div><p class="pulse-ok" hidden></p>' +
      '<div class="pulse-pass"><p>Know someone who’d read this?</p><button type="button" data-pass><span aria-hidden="true">↗</span>Send it to them</button></div></div>';
    var card = wrap.firstChild, more = card.querySelector('.pulse-more'), ok = card.querySelector('.pulse-ok');
    card.querySelectorAll('[data-v]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.dataset.v;
        card.querySelectorAll('[data-v]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === btn)); });
        if (lget(key) !== v) { lset(key, v); ev(v); }
        more.hidden = false;
        card.querySelector('.pulse-q').textContent = v === 'up' ? 'What made it worth it? What should The Watch do next?' : 'What would have made it worth it?';
        ok.hidden = true;
      });
    });
    card.querySelector('[data-send]').addEventListener('click', function () {
      var ta = card.querySelector('textarea');
      var txt = ta.value.replace(/\s+/g, ' ').trim();
      if (!txt) { ta.focus(); return; }
      // Strip the obvious personal details before the note leaves the browser.
      txt = txt.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').replace(/\+?\d[\d\s().-]{7,}\d/g, '[number]');
      ev('note', (lget(key) || '-') + ' ' + txt.slice(0, 280));
      more.hidden = true; ta.value = '';
      ok.hidden = false; ok.textContent = 'Thank you. The editor reads every note.';
    });
    card.querySelector('[data-pass]').addEventListener('click', function () {
      var u = new URL(location.href);
      u.searchParams.delete('pulse'); u.searchParams.set('s', 'friend');
      var url = u.href;
      var data = { title: d.title, url: url };
      ev('share', 'card');
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () {
        ok.hidden = false; ok.textContent = 'Link copied. Paste it to a friend.';
      }, function () { w.prompt('Copy this link', url); });
    });
    var host = d.querySelector('main') || d.querySelector('article');
    var foot = d.querySelector('body > footer, footer.foot, .foot');
    if (host && host.contains(foot)) host = null;
    if (foot && foot.parentNode) foot.parentNode.insertBefore(wrap, foot);
    else if (host) host.appendChild(wrap);
    else b.appendChild(wrap);
    cardEl = wrap;
  }

  // ---- go ---------------------------------------------------------------------------------------------------------
  function start() {
    if (d.body && d.body.dataset.pulse === 'off') { off = true; }
    lastPage = pagePath();
    view();
    setInterval(tick, 1000);
    // The card waits for the page's own scripts to lay it out.
    setTimeout(placeCard, 1200);
    w.addEventListener('pagehide', measure);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
