/* The Pulse: the dashboard. Reads data/stats.json (written by fetch.py); before real readers exist it shows
   data/sample.json, labeled as made up. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return (n || 0).toLocaleString('en-US'); };
  var pct = function (a, b) { return b ? Math.round(100 * a / b) : 0; };
  var SITE = 'https://bboldt86.github.io/lanscape-navigator';
  var S = null, W = '30', sortK = 'views', sortDir = -1, shown = 40;

  // ---- this browser in or out ----
  function meLabel() { var off = false; try { off = localStorage.getItem('pulse.off') === '1'; } catch (e) {} $('#me').textContent = off ? 'You’re not counted · undo' : 'Don’t count me'; }
  $('#me').addEventListener('click', function () {
    try { if (localStorage.getItem('pulse.off') === '1') localStorage.removeItem('pulse.off'); else localStorage.setItem('pulse.off', '1'); } catch (e) {}
    meLabel();
  });
  meLabel();

  function get(u) { return fetch(u + '?v=' + Date.now()).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  Promise.all([get('data/stats.json').catch(function () { return null; }), get('data/audit.json').catch(function () { return null; })]).then(function (r) {
    var st = r[0], audit = r[1];
    var real = st && st.series && st.series.some(function (d) { return d.views; });
    if (real) { go(st, audit, false); return; }
    get('data/sample.json').then(function (sm) { go(sm, audit, true, st); }, function () { go(st || { windows: {}, series: [] }, audit, false); });
  });

  function go(st, audit, sample, realSt) {
    S = st; S.audit = audit;
    var b = '';
    var conn = realSt ? realSt.connected : st.connected;
    var err = realSt ? realSt.last_error : st.last_error;
    if (sample) b += '<div class="banner"><b>Sample numbers.</b> These are made up, to show what the page will look like. ' +
      (conn ? 'GoatCounter is connected; real counts appear here after the first readers arrive.' :
        'Real counts start once GoatCounter is connected: sign up at goatcounter.com with the code <code>thewatch-pulse</code>, then add an API token as the repo secret <code>GOATCOUNTER_TOKEN</code>.') + '</div>';
    if (err) b += '<div class="banner err"><b>Last read failed:</b> ' + esc(err) + '</div>';
    $('#banner').innerHTML = b;
    $('#upd').textContent = st.updated ? 'Updated ' + new Date(st.updated.replace('Z', ':00Z')).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    document.querySelectorAll('#win button').forEach(function (bt) {
      bt.addEventListener('click', function () {
        W = bt.dataset.w; shown = 40;
        document.querySelectorAll('#win button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === bt)); });
        render();
      });
    });
    $('#q').addEventListener('input', function () { shown = 40; table(); });
    $('#sec').addEventListener('change', function () { shown = 40; table(); });
    $('#morebtn').addEventListener('click', function () { shown += 60; table(); });
    render();
    tips();
    audits();
    window.addEventListener('resize', function () { clearTimeout(window.__rz); window.__rz = setTimeout(daily, 150); });
  }

  function win() { return (S.windows && S.windows[W]) || { pages: [], events: {}, sections: [] }; }

  function render() { tiles(); daily(); sections(); table(); sources(); doing(); notes(); }

  // ---- tiles ----
  function prevViews(days) {
    var s = S.series || [], n = +days;
    var cur = s.slice(-n).reduce(function (a, d) { return a + d.views; }, 0);
    var prev = s.slice(-2 * n, -n).reduce(function (a, d) { return a + d.views; }, 0);
    return s.length >= 2 * n && prev ? Math.round(100 * (cur - prev) / prev) : null;
  }
  function tiles() {
    var w = win(), e = w.events || {}, v = w.views || 0, ch = prevViews(W);
    var votes = (e.up || 0) + (e.down || 0);
    var T = [
      ['Page views', fmt(v), ch == null ? 'last ' + W + ' days' : '<span class="' + (ch >= 0 ? 'up' : 'dn') + '">' + (ch >= 0 ? '▲ ' : '▼ ') + Math.abs(ch) + '%</span> vs the ' + W + ' before'],
      ['Visitors', fmt(w.visitors), fmt(w.new) + ' first visits'],
      ['Read past half', pct(e.read50, v) + '%', fmt(e.read50) + ' visits'],
      ['Read to the end', pct(e.read100, v) + '%', fmt(e.read100) + ' visits'],
      ['Stayed 1 min+', pct(e.t60, v) + '%', pct(e.t180, v) + '% stayed 3 min+'],
      ['Shared', fmt(e.share), fmt(e.dl) + ' downloads'],
      ['Worth it?', votes ? pct(e.up, votes) + '% yes' : '—', fmt(votes) + ' votes · ' + fmt(e.note) + ' notes']
    ];
    $('#tiles').innerHTML = T.map(function (t) { return '<div class="tile"><div class="l">' + t[0] + '</div><div class="v">' + t[1] + '</div><div class="n">' + t[2] + '</div></div>'; }).join('');
  }

  // ---- what to do ----
  var TAG = { reach: 'Reach', gem: 'Hidden gem', leak: 'Losing readers', front: 'Front page', visual: 'Visual', verdict: 'Readers say', search: 'Searched', audit: 'Findability' };
  function tips() {
    var t = S.advice || [];
    $('#tips').innerHTML = t.length ? t.map(function (x) {
      var pg = x.page ? '<a href="' + esc(SITE + x.page) + '">' + esc(x.title || x.page) + '</a>: ' : '';
      return '<div class="tip"><span class="tag ' + x.kind + '">' + (TAG[x.kind] || x.kind) + '</span><p>' + pg + esc(x.text) + '</p></div>';
    }).join('') : '<p class="empty">Nothing stands out yet.</p>';
  }

  // ---- the daily chart ----
  function daily() {
    var el = $('#daily'), s = (S.series || []).slice(-(+W));
    $('#lg').innerHTML = '<span><i style="background:var(--s1)"></i>Page views</span><span><i style="background:var(--s2)"></i>Visitors</span>';
    if (!s.length) { el.innerHTML = '<p class="empty">No days yet.</p>'; return; }
    var Wd = Math.max(320, el.clientWidth || 800), H = Wd < 560 ? 220 : 260, L = 40, R = 12, T = 12, B = 26;
    var max = Math.max(4, Math.max.apply(null, s.map(function (d) { return Math.max(d.views, d.visitors); })));
    var step = Math.pow(10, Math.floor(Math.log10(max))); var nice = Math.ceil(max / step) * step; if (nice / step < 3) { step /= 2; }
    var x = function (i) { return L + (s.length < 2 ? 0 : i * (Wd - L - R) / (s.length - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - v / nice); };
    var g = '';
    for (var v = 0; v <= nice + 1e-9; v += step) g += '<line class="gl" x1="' + L + '" x2="' + (Wd - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="ax" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + fmt(v) + '</text>';
    var every = Math.ceil(s.length / (Wd < 560 ? 4 : 7));
    s.forEach(function (d, i) { if (i % every === 0 || i === s.length - 1) g += '<text class="ax" x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === s.length - 1 ? 'end' : 'middle') + '">' + day(d.d) + '</text>'; });
    var line = function (k) { return s.map(function (d, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d[k]).toFixed(1); }).join(''); };
    el.innerHTML = '<svg viewBox="0 0 ' + Wd + ' ' + H + '" role="img" aria-label="Page views and visitors per day">' + g +
      '<path class="ln" stroke="var(--s2)" d="' + line('visitors') + '"/><path class="ln" stroke="var(--s1)" d="' + line('views') + '"/>' +
      '<line class="hl" id="hl" y1="' + T + '" y2="' + (H - B) + '" style="display:none"/><circle id="h1" r="4" fill="var(--s1)" stroke="var(--raise)" stroke-width="2" style="display:none"/><circle id="h2" r="4" fill="var(--s2)" stroke="var(--raise)" stroke-width="2" style="display:none"/>' +
      '<rect x="' + L + '" y="0" width="' + (Wd - L - R) + '" height="' + H + '" fill="transparent" id="hit"/></svg><div class="tt" id="tt"></div>';
    var svg = el.querySelector('svg'), tt = $('#tt');
    function at(ev) {
      var r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * Wd / r.width;
      var i = Math.max(0, Math.min(s.length - 1, Math.round((px - L) / ((Wd - L - R) / Math.max(1, s.length - 1)))));
      var d = s[i], X = x(i);
      ['hl', 'h1', 'h2'].forEach(function (id) { svg.getElementById(id).style.display = ''; });
      svg.getElementById('hl').setAttribute('x1', X); svg.getElementById('hl').setAttribute('x2', X);
      svg.getElementById('h1').setAttribute('cx', X); svg.getElementById('h1').setAttribute('cy', y(d.views));
      svg.getElementById('h2').setAttribute('cx', X); svg.getElementById('h2').setAttribute('cy', y(d.visitors));
      tt.innerHTML = day(d.d, true) + '<br><b>' + fmt(d.views) + '</b> views · <b>' + fmt(d.visitors) + '</b> visitors';
      tt.style.left = (X * r.width / Wd) + 'px'; tt.style.top = (y(Math.max(d.views, d.visitors)) * r.height / H) + 'px'; tt.style.opacity = 1;
    }
    var hit = svg.getElementById('hit');
    hit.addEventListener('pointermove', at); hit.addEventListener('pointerdown', at);
    hit.addEventListener('pointerleave', function () { tt.style.opacity = 0; ['hl', 'h1', 'h2'].forEach(function (id) { svg.getElementById(id).style.display = 'none'; }); });
  }
  function day(iso, long) { var d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('en-US', long ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric' }); }

  // ---- horizontal bars ----
  function hbars(id, rows, opt) {
    opt = opt || {};
    var el = $(id);
    if (!rows || !rows.length) { el.innerHTML = '<p class="empty">' + (opt.empty || 'Nothing yet.') + '</p>'; return; }
    rows = rows.slice(0, opt.n || 10);
    var max = opt.max || Math.max.apply(null, rows.map(function (r) { return r[1]; })) || 1;
    el.innerHTML = '<div class="hb">' + rows.map(function (r) {
      var k = opt.link ? '<a href="' + esc(SITE + r[0]) + '">' + esc(r[2] || r[0]) + '</a>' : esc(r[2] || r[0]);
      return '<span class="hk" title="' + esc(r[2] || r[0]) + '">' + k + '</span><span class="b"><i style="width:' + (100 * r[1] / max).toFixed(1) + '%"></i></span><span class="v">' + (opt.fmt ? opt.fmt(r[1], r) : fmt(r[1])) + '</span>';
    }).join('') + '</div>';
  }

  function sections() {
    var s = (win().sections || []).filter(function (x) { return x.views; });
    hbars('#secv', s.map(function (x) { return [x.name, x.views]; }), { n: 14 });
    hbars('#secr', s.filter(function (x) { return x.views >= 5; }).map(function (x) { return [x.name, pct(x.read50, x.views)]; }).sort(function (a, b) { return b[1] - a[1]; }), { n: 14, max: 100, fmt: function (v) { return v + '%'; } });
  }

  // ---- pages table ----
  var COLS = [['p', 'Page'], ['views', 'Views'], ['depth', 'Read 25 · 50 · 75 · 100%'], ['t60', '1 min+'], ['votes', '👍 / 👎'], ['share', 'Shares'], ['src', 'Top source'], ['vd', '']];
  function verdict(p, med) {
    var e = p.e, v = p.views;
    if (v < 10) return '';
    if (pct(e.read75, v) >= 45 && v <= med) return ['gem', 'Hidden gem'];
    if (v >= Math.max(2 * med, 25) && pct(e.read25, v) < 35) return ['leak', 'Losing readers'];
    if (v >= 2 * med && pct(e.read50, v) >= 45) return ['hit', 'Hit'];
    return '';
  }
  function val(p, k) {
    var e = p.e;
    if (k === 'p') return (p.title || p.p).toLowerCase();
    if (k === 'views') return p.views;
    if (k === 'depth') return p.views ? (e.read50 || 0) / p.views : 0;
    if (k === 't60') return p.views ? (e.t60 || 0) / p.views : 0;
    if (k === 'votes') return (e.up || 0) - (e.down || 0);
    if (k === 'share') return e.share || 0;
    return 0;
  }
  function table() {
    var w = win(), pages = (w.pages || []).filter(function (p) { return !/^\/news\/r\//.test(p.p) && !/#\/q$/.test(p.p) && p.views > 0; });
    var secs = {}; pages.forEach(function (p) { secs[p.sec] = 1; });
    var sel = $('#sec'), cur = sel.value;
    sel.innerHTML = '<option value="">Every section</option>' + Object.keys(secs).sort().map(function (s) { return '<option' + (s === cur ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
    var q = $('#q').value.trim().toLowerCase();
    var vs = pages.filter(function (p) { return p.views >= 10; }).map(function (p) { return p.views; }).sort(function (a, b) { return a - b; });
    var med = vs.length ? vs[vs.length >> 1] : 0;
    var rows = pages.filter(function (p) { return (!cur || p.sec === cur) && (!q || (p.p + ' ' + (p.title || '')).toLowerCase().indexOf(q) >= 0); });
    rows.sort(function (a, b) { var x = val(a, sortK), y = val(b, sortK); return x < y ? -sortDir : x > y ? sortDir : b.views - a.views; });
    $('#pages thead').innerHTML = '<tr>' + COLS.map(function (c) {
      var s = c[0] === sortK ? ' aria-sort="' + (sortDir < 0 ? 'descending' : 'ascending') + '"' : '';
      return '<th scope="col"' + s + '>' + (c[1] && c[0] !== 'src' && c[0] !== 'vd' ? '<button type="button" data-k="' + c[0] + '">' + c[1] + (s ? (sortDir < 0 ? ' ↓' : ' ↑') : '') + '</button>' : c[1]) + '</th>';
    }).join('') + '</tr>';
    document.querySelectorAll('#pages th button').forEach(function (b) {
      b.addEventListener('click', function () { var k = b.dataset.k; if (sortK === k) sortDir = -sortDir; else { sortK = k; sortDir = k === 'p' ? 1 : -1; } table(); });
    });
    $('#pages tbody').innerHTML = rows.length ? rows.slice(0, shown).map(function (p) {
      var e = p.e, v = p.views || 0, vd = verdict(p, med);
      var d = [e.read25, e.read50, e.read75, e.read100].map(function (n) { return '<i style="height:' + Math.max(1, Math.round(22 * pct(n || 0, v) / 100)) + 'px" title="' + pct(n || 0, v) + '%"></i>'; }).join('');
      var src = p.src && p.src[0] ? esc(p.src[0][0]) : '<span style="color:var(--ink-3)">—</span>';
      return '<tr><td class="pn"><a href="' + esc(SITE + p.p) + '">' + esc(p.title || p.p) + '</a><small>' + esc(p.sec) + ' · ' + esc(p.p) + '</small></td>' +
        '<td>' + fmt(v) + '</td><td><span class="depth" aria-label="' + [e.read25, e.read50, e.read75, e.read100].map(function (n) { return pct(n || 0, v) + '%'; }).join(', ') + '">' + d + '</span><span>' + pct(e.read50, v) + '%</span></td>' +
        '<td>' + pct(e.t60, v) + '%</td><td>' + (e.up || 0) + ' / ' + (e.down || 0) + '</td><td>' + fmt(e.share) + '</td><td>' + src + '</td>' +
        '<td>' + (vd ? '<span class="vd ' + vd[0] + '">' + vd[1] + '</span>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="empty">No pages counted yet.</td></tr>';
    $('#morebtn').hidden = rows.length <= shown;
  }

  // ---- sources ----
  function sources() {
    var w = win();
    hbars('#refs', w.refs, { empty: 'No outside sites yet.' });
    hbars('#arr', w.arrivals, { empty: 'No tagged or referred arrivals yet.' });
    var DV = { phone: 'Phone', desktop: 'Computer', tablet: 'Tablet', unknown: 'Unknown' };
    hbars('#dev', (w.devices || []).map(function (r) { return [DV[r[0]] || r[0], r[1]]; }));
    var dn; try { dn = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) {}
    hbars('#loc', (w.countries || []).map(function (r) { var n = r[0]; try { n = dn && /^[A-Z]{2}$/.test(n) ? dn.of(n) : n; } catch (e) {} return [n, r[1]]; }));
  }
  function doing() {
    var w = win(), titles = {};
    (w.pages || []).forEach(function (p) { titles[p.p] = p.title; });
    hbars('#front', (w.front_clicks || []).map(function (r) { return [r[0], r[1], titles[r[0]] || r[0]]; }), { link: true, empty: 'No clicks from the front yet.' });
    var s = w.searches || [];
    $('#srch').innerHTML = s.length ? '<div class="chips">' + s.map(function (r) { return '<span class="chip">' + esc(r[0]) + '<b>' + r[1] + '</b></span>'; }).join('') + '</div>' : '<p class="empty">No searches yet.</p>';
    hbars('#outs', w.outbound, { empty: 'No outbound clicks yet.' });
    var dl = (w.downloads || []).map(function (r) { return ['⤓ ' + r[0], r[1]]; }).concat((w.shares || []).map(function (r) { return ['↗ shared via ' + r[0], r[1]]; })).sort(function (a, b) { return b[1] - a[1]; });
    hbars('#dls', dl, { empty: 'No downloads or shares yet.' });
  }
  function notes() {
    var n = win().notes || [];
    $('#notes').innerHTML = n.length ? n.slice(0, 40).map(function (x) {
      return '<div class="note"><q>' + esc(x.text) + '</q><div class="m">' + (x.vote === 'up' ? '👍 ' : x.vote === 'down' ? '👎 ' : '') + day(x.d, true) + ' · <a href="' + esc(SITE + x.p) + '">' + esc(x.p) + '</a></div></div>';
    }).join('') : '<p class="empty">No notes yet. Every piece now ends with a card that asks for one.</p>';
  }

  // ---- findability ----
  function audits() {
    var a = S.audit;
    if (!a) { $('#audit').innerHTML = '<p class="empty">Not checked yet.</p>'; return; }
    var c = a.counts, bad = a.pages.filter(function (p) { return p.issues.length; });
    $('#audit').innerHTML = '<p style="margin:0 0 10px">' + fmt(c.pages) + ' pages checked. <b>' + (c.pages - c.with_issues) + '</b> have a title, a description and a share image; ' +
      '<b>' + c.with_issues + '</b> are missing one. ' + fmt(c.minor) + ' have smaller things to fix (a long title, no canonical link).</p>' +
      (bad.length ? '<div class="hb" style="grid-template-columns:1fr auto">' + bad.slice(0, 16).map(function (p) {
        return '<span class="hk"><a href="' + esc(SITE + p.p) + '">' + esc(p.title || p.p) + '</a></span><span class="v">' + esc(p.issues.join(', ')) + '</span>';
      }).join('') + '</div>' : '');
  }
})();
