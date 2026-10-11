/* ===================================================================
   Page helper — stringified and injected at the top of every page.
   Must be fully self-contained (no references to the shell's scope).
   =================================================================== */
function LAN_HELPER(C) {
  if (window.__lanHelper) return;
  window.__lanHelper = true;
  var P = window.parent;
  function post(m) { m.__lan = C.n; try { P.postMessage(m, '*'); } catch (e) { /* detached */ } }
  function goHash(h) {
    var id = h.replace(/^#/, '');
    try { id = decodeURIComponent(id); } catch (e) { /* keep raw */ }
    if (!id || id === 'top') { window.scrollTo(0, 0); return; }
    var el = document.getElementById(id) || document.getElementsByName(id)[0];
    if (el && el.scrollIntoView) el.scrollIntoView();
  }
  function absURL(raw) { try { return new URL(raw, C.url).href; } catch (e) { return raw; } }

  if (C.spider) {
    try { HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }; } catch (e) { /* ignore */ }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { var Muted = function () { var c = new AC(); try { c.suspend(); } catch (e) { /* ignore */ } return c; }; window.AudioContext = window.webkitAudioContext = Muted; }
    } catch (e) { /* ignore */ }
    window.print = function () { };
    window.open = function () { return null; };
  } else {
    /* links: decide after the page's own handlers had their say */
    var onClick = function (e) {
      if (e.defaultPrevented || e.button > 1) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href],area[href]') : null;
      if (!a) return;
      var raw = a.getAttribute('href');
      if (raw == null) return;
      raw = raw.trim();
      if (/^(javascript|mailto|tel|sms|blob|data|about):/i.test(raw) || a.hasAttribute('download')) return;
      e.preventDefault();
      if (raw.charAt(0) === '#') { goHash(raw); post({ t: 'hash', hash: raw }); return; }
      post({ t: 'nav', href: absURL(raw), raw: raw, target: a.getAttribute('target') || '', mod: !!(e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) });
    };
    window.addEventListener('click', onClick, false);
    window.addEventListener('auxclick', function (e) { if (e.button === 1) onClick(e); }, false);
    window.addEventListener('submit', function (e) {
      if (e.defaultPrevented) return;
      var f = e.target;
      if (!f || f.tagName !== 'FORM') return;
      e.preventDefault();
      var action = f.getAttribute('action');
      var method = (f.getAttribute('method') || 'get').toLowerCase();
      var fd = new FormData(f);
      if (e.submitter && e.submitter.name) fd.append(e.submitter.name, e.submitter.value || '');
      var qs = new URLSearchParams(fd).toString();
      var u;
      try { u = new URL(action || C.url, C.url); } catch (er) { return; }
      if (method === 'get') { u.search = qs; post({ t: 'nav', href: u.href, raw: action || '', form: true }); }
      else post({ t: 'post', href: u.href, body: qs });
    }, false);
    var lastA = null;
    document.addEventListener('mouseover', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href],area[href]') : null;
      if (a === lastA) return;
      lastA = a;
      var h = '';
      if (a) {
        var raw = (a.getAttribute('href') || '').trim();
        h = /^javascript:/i.test(raw) ? raw : raw.charAt(0) === '#' ? C.url.replace(/#.*$/, '') + raw : absURL(raw);
      }
      post({ t: 'hover', href: h });
    }, true);
    window.addEventListener('keydown', function (e) {
      var k = e.key, mod = e.ctrlKey || e.metaKey;
      var tgt = e.target, ed = tgt && (tgt.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName));
      // inside LANscape's own programs the program owns its shortcuts (Ctrl+R, Ctrl+U...)
      // a program can claim browser keys for itself (Slide Show uses F5 to present)
      var own = document.body && document.body.getAttribute('data-own-keys');
      if (own && (' ' + own + ' ').indexOf(' ' + k + ' ') >= 0) return;
      var fwd = k === 'F5' || k === 'F6' ||
        (!ed && e.altKey && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home')) ||
        (!ed && e.metaKey && (k === '[' || k === ']')) ||
        (mod && !e.shiftKey && !e.altKey && (((k === 'l' || k === 'L') && !(C.app && ed)) || (!C.app && (k === 'r' || k === 'R')))) ||
        (!ed && !C.app && mod && !e.altKey && (k === 'd' || k === 'D' || k === 'u' || k === 'U' || k === 'i' || k === 'I'));
      if (!fwd) return;
      e.preventDefault();
      post({ t: 'key', key: k, alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey });
    }, true);
    var _open = window.open;
    window.open = function (u) {
      if (u && typeof u === 'string' && !/^(blob|data|about|javascript):/i.test(u.trim())) { post({ t: 'nav', href: absURL(u), raw: u, target: '_blank', open: true }); return null; }
      return _open.apply(window, arguments);
    };
    var st = null;
    window.addEventListener('scroll', function () { clearTimeout(st); st = setTimeout(function () { post({ t: 'scroll', y: Math.round(window.scrollY || 0) }); }, 160); }, { passive: true });
    var errs = 0;
    window.addEventListener('error', function (e) { errs++; post({ t: 'err', n: errs, msg: String((e && e.message) || 'Script error') }); });
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (e.source !== P || !d || d.__lanCmd !== C.n) return;
      if (d.cmd === 'find') {
        var res = doFind(String(d.q || ''), !!d.cs, !!d.back);
        post({ t: 'found', ok: res.ok, i: res.i, n: res.n });
      } else if (d.cmd === 'print') { try { window.print(); } catch (er) { /* ignore */ } }
      else if (d.cmd === 'top') window.scrollTo(0, 0);
      else if (d.cmd === 'snap') { var s = snapAll(); post({ t: 'thumb', data: s }); }
      else if (d.cmd === 'hash') goHash(d.hash);
    });
  }

  /* find in page: walk the text nodes, select and scroll to each match in turn */
  var fstate = { q: null, cs: false, i: -1, hits: [] };
  function findAll(q, cs) {
    var hits = [], nq = cs ? q : q.toLowerCase(), n;
    if (!q || !document.body) return hits;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while ((n = w.nextNode()) && hits.length < 5000) {
      var p = n.parentElement;
      if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(p.tagName)) continue;
      var t = cs ? n.nodeValue : n.nodeValue.toLowerCase(), k = t.indexOf(nq);
      while (k >= 0) { hits.push([n, k]); k = t.indexOf(nq, k + nq.length); }
    }
    return hits;
  }
  function doFind(q, cs, back) {
    if (q !== fstate.q || cs !== fstate.cs || (fstate.hits[0] && !fstate.hits[0][0].isConnected)) fstate = { q: q, cs: cs, i: -1, hits: findAll(q, cs) };
    var N = fstate.hits.length;
    if (!N) return { ok: false, i: 0, n: 0 };
    fstate.i = back ? (fstate.i <= 0 ? N - 1 : fstate.i - 1) : (fstate.i + 1) % N;
    var h = fstate.hits[fstate.i];
    try {
      var r = document.createRange();
      r.setStart(h[0], h[1]); r.setEnd(h[0], h[1] + q.length);
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      var el = h[0].parentElement;
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
    } catch (e) { /* node changed under us */ }
    return { ok: true, i: fstate.i + 1, n: N };
  }

  /* placeholders for retro pages: <x-counter>, <x-webring>, <x-lastmod> */
  function placeholders() {
    if (!C.retro) return;
    var digits = String(C.counter || 1);
    while (digits.length < 6) digits = '0' + digits;
    var odo = '<span class="lan-odo" title="Visitors">' + digits.split('').map(function (d) { return '<b>' + d + '</b>'; }).join('') + '</span>';
    var list = document.getElementsByTagName('x-counter');
    while (list.length) { var s1 = document.createElement('span'); s1.innerHTML = odo; list[0].replaceWith(s1); }
    list = document.getElementsByTagName('x-webring');
    while (list.length) { var s2 = document.createElement('div'); s2.innerHTML = C.ring || ''; list[0].replaceWith(s2); }
    list = document.getElementsByTagName('x-lastmod');
    while (list.length) { list[0].replaceWith(document.createTextNode(C.lastmod || '')); }
  }
  var lastTitle = null;
  function sendTitle() { var t = document.title; if (t !== lastTitle) { lastTitle = t; post({ t: 'title', title: t }); } }
  document.addEventListener('DOMContentLoaded', function () {
    placeholders();
    sendTitle();
    if (C.hash) goHash(C.hash);
    else if (C.y) window.scrollTo(0, C.y);
    post({ t: 'dom' });
  });
  var tick = 0, ti = setInterval(function () { sendTitle(); if (++tick > 20) { clearInterval(ti); setInterval(sendTitle, 3000); } }, 700);

  /* a stylised "screenshot": painted boxes + greeked text, read from the live layout */
  function bgOf(e) {
    if (!e) return null;
    var c = getComputedStyle(e).backgroundColor;
    return c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c) ? c : null;
  }
  function snap(noImg) {
    try {
      var vw = Math.max(320, Math.min(window.innerWidth || 1024, 1600)), vh = Math.round(vw * 0.75);
      var W = 240, H = 180, k = W / vw;
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var c = cv.getContext('2d');
      var sx = window.scrollX || 0, sy = window.scrollY || 0;
      c.fillStyle = bgOf(document.body) || bgOf(document.documentElement) || '#ffffff';
      c.fillRect(0, 0, W, H);
      var bi = document.body ? getComputedStyle(document.body).backgroundImage : '';
      var bm = bi && /(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i.exec(bi);
      if (bm) { c.fillStyle = bm[1]; c.fillRect(0, 0, W, H); }
      var els = document.body ? document.body.getElementsByTagName('*') : [];
      var n = 0;
      for (var i = 0; i < els.length && n < 2500; i++) {
        var e = els[i], tag = e.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE' || tag === 'BR') continue;
        var r = e.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        var top = r.top + sy, left = r.left + sx;
        if (top > vh || left > vw || top + r.height < 0 || left + r.width < 0) continue;
        var cs = getComputedStyle(e);
        if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05) continue;
        n++;
        var x = left * k, y = top * k, w = r.width * k, h = r.height * k;
        var bg = bgOf(e);
        if (bg) { c.fillStyle = bg; c.fillRect(x, y, w, h); }
        var gi = cs.backgroundImage;
        if (gi && gi.indexOf('gradient') >= 0) { var gm = /(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i.exec(gi); if (gm) { c.globalAlpha = 0.85; c.fillStyle = gm[1]; c.fillRect(x, y, w, h); c.globalAlpha = 1; } }
        var bw = parseFloat(cs.borderTopWidth) || 0;
        if (bw > 0 && cs.borderTopStyle !== 'none') { c.strokeStyle = cs.borderTopColor; c.lineWidth = Math.max(0.5, bw * k); c.strokeRect(x, y, w, h); }
        if (tag === 'IMG' || tag === 'CANVAS' || tag === 'VIDEO') {
          if (noImg) { c.fillStyle = 'rgba(128,128,128,.5)'; c.fillRect(x, y, w, h); }
          else { try { c.drawImage(e, x, y, w, h); } catch (er) { c.fillStyle = 'rgba(128,128,128,.5)'; c.fillRect(x, y, w, h); } }
        } else if (tag.toLowerCase() === 'svg') { c.fillStyle = 'rgba(110,120,170,.28)'; c.fillRect(x, y, w, h); }
      }
      if (document.body) {
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), t, tn = 0, rg = document.createRange();
        while ((t = walker.nextNode()) && tn < 3000) {
          if (!/\S/.test(t.nodeValue)) continue;
          var p = t.parentElement;
          if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION)$/.test(p.tagName)) continue;
          rg.selectNodeContents(t);
          var rects = rg.getClientRects();
          if (!rects.length) continue;
          var pcs = getComputedStyle(p);
          if (pcs.visibility === 'hidden') continue;
          c.fillStyle = pcs.color; c.globalAlpha = 0.6;
          for (var j = 0; j < rects.length && j < 60; j++) {
            var rr = rects[j], ty = (rr.top + sy) * k, tx = (rr.left + sx) * k;
            if (ty > H || tx > W || ty < -4) continue;
            var th = Math.max(1, rr.height * k * 0.48);
            c.fillRect(tx, ty + (rr.height * k - th) / 2, Math.max(1, rr.width * k), th);
          }
          c.globalAlpha = 1; tn++;
        }
      }
      return cv.toDataURL('image/jpeg', 0.74);
    } catch (e) { return null; }
  }
  function snapAll() { return snap(false) || snap(true); }
  window.addEventListener('load', function () {
    post({ t: 'load' });
    if (C.deep) setTimeout(function () {
      var txt = '';
      try { txt = (document.body && document.body.innerText) || ''; } catch (e) { txt = ''; }
      post({ t: 'deep', text: String(txt).slice(0, 200000) });
    }, C.spider ? 900 : 1300);
    if (C.thumb) setTimeout(function () { post({ t: 'thumb', data: snapAll() }); }, C.spider ? 1300 : 1700);
  });
}
