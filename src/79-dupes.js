/* ===================================================================
   Duplicate Finder: every set of copies and versions LANscape folded
   into one entry, why they were folded, and buttons to fix it. Also
   the version bar over an older version, a site's /versions/ page,
   and Compare (a side-by-side diff of two files).
   =================================================================== */

/* ---------------- small helpers ---------------- */
/** what a group is called: the main entry's site title, the song, the video or the picture */
function foldTitle(g) {
  const p = g.primary, m = p.meta || {};
  if (g.cls === 'site') return (p.site && p.site.title) || cleanTitle(m.title || prettyName(p.name));
  if (g.cls === 'audio') return (m.artist && !/^Unknown/.test(m.artist) ? m.artist + ' — ' : '') + (m.title || prettyName(p.name));
  if (g.cls === 'video') return m.title || prettyName(p.name);
  return prettyName(p.name);
}
const dupesUrl = g => 'http://dupes.lanscape.net/' + (g ? '?g=' + encodeURIComponent(g.id) : '');
const compareUrl = (a, b) => 'http://dupes.lanscape.net/compare?a=' + encodeURIComponent(a.path) + '&b=' + encodeURIComponent(b.path);
function versionsUrl(g) { const ps = g.primary.site; return g.cls === 'site' && ps ? ps.url + 'versions/' : dupesUrl(g); }
/** the same page in another version of a copied website (or the version itself) */
function verCounterpart(d, member) {
  const g = d.fold;
  if (!g || !g.whole) return member;
  const w = g.dirs.get(member);
  const t = w && d.vsub ? lookupPath(w.dir + d.vsub) : null;
  return t ? t.doc : member;
}
/** the version a page belongs to (a copied website's front page stands for all of its pages) */
const verMember = d => (d.fold && d.fold.whole ? d.fold.members[d.vno - 1] || d : d);
async function foldSplitAsk(d) {
  const m = verMember(d), g = d.fold;
  const what = g && g.whole ? 'the website folder <b>' + esc(g.dirs.get(m).dir) + '</b>' : '<b>' + esc(d.name) + '</b>';
  const v = await msgBox('question', 'Not the Same', '<p>Keep ' + what + ' as its own ' + (g && g.whole ? 'website' : 'page') + '?</p><p class="hint">It gets its own address and shows up in search, rings and lists again. You can put it back in the Duplicate Finder.</p>', ['Keep Separate', 'Cancel']);
  if (v !== 'Keep Separate') return false;
  foldSplit(m.path);
  setStatus(prettyName(m.name) + ' now stands on its own.');
  return true;
}

/* ---------------- the ring bar button and the version bar ---------------- */
function versionsButton(site) {
  const g = site && site.index && site.index.fold;
  if (!g || g.primary !== site.index || g.cls !== 'site' || g.members.length < 2) return '';
  return '<button class="dbtn" data-site="versions" title="' + esc(foldWhy(site.index)) + '">Versions (' + g.members.length + ')</button>';
}
/** a yellow bar over an older version or a copy: which one it is, and the way to the newest */
function renderVerBar() {
  const vp = $('#viewport');
  let bar = $('#verbar');
  const cur = S.cur, d = cur && cur.doc, g = d && d.fold;
  const on = !!(g && g.cls === 'site' && isFolded(d) && cur.route && cur.route.type === 'doc' && !cur.verbarHidden);
  if (!on) { if (bar) bar.hidden = true; vp.classList.remove('vb'); return; }
  if (!bar) {
    bar = el('div', { class: 'verbar', id: 'verbar', role: 'status' });
    vp.append(bar);
    bar.addEventListener('click', onVerBarClick);
  }
  const m = verMember(d), p = g.primary, total = g.members.length;
  const title = (p.site && p.site.title) || cleanTitle(p.meta.title);
  const why = g.why.get(m) || {};
  const copy = why.reason === 'copy' || !!m.vtwin;
  let msg;
  if (g.whole) msg = '<span class="vb-w">This page is in <b>' + esc(g.dirs.get(m).dir.replace(/\/$/, '')) + '</b>, ' + (copy ? 'an exact copy' : 'another version') + ' of the website <b>' + esc(title) + '</b>.</span><span class="vb-n"><b>' + (copy ? 'Copy' : esc(d.vlabel || 'Older version')) + '</b> of ' + esc(title) + '</span>';
  else msg = '<span class="vb-w">You are looking at <b>' + esc(d.vlabel || 'version ' + d.vno) + '</b>, ' + (copy ? 'an exact copy of' : 'version ' + d.vno + ' of ' + total + ' of') + ' <b>' + esc(title) + '</b>.</span><span class="vb-n"><b>' + esc(d.vlabel || 'v' + d.vno) + '</b> · ' + (copy ? 'a copy' : d.vno + ' of ' + total) + '</span>';
  const btn = (v, label, dis, tip) => '<button class="dbtn" data-v="' + v + '"' + (dis ? ' disabled' : '') + (tip ? ' title="' + esc(tip) + '"' : '') + '>' + label + '</button>';
  bar.innerHTML = '<span class="vb-ico" aria-hidden="true">' + ICON.info + '</span><span class="vb-msg">' + msg + '</span>' +
    (copy ? '' : btn('older', '&#9664; Older', m.vno <= 1, 'Previous version') + btn('newer', 'Newer &#9654;', m.vno >= total, 'Next version')) +
    btn('newest', copy ? 'Go to the Original' : 'Newest Version') + btn('compare', 'Compare', false, 'What changed between this one and the main one') +
    btn('all', 'All Versions') + btn('split', 'Not the Same', false, 'This isn\'t a copy: give it its own address') +
    '<button class="vb-x" data-v="hide" title="Hide this bar" aria-label="Hide this bar">&#215;</button>';
  bar.hidden = false;
  vp.classList.add('vb');
}
function onVerBarClick(e) {
  const b = e.target.closest('[data-v]');
  if (!b || b.disabled) return;
  const cur = S.cur, d = cur && cur.doc, g = d && d.fold;
  if (!g) return;
  const v = b.dataset.v, m = verMember(d);
  if (v === 'hide') { cur.verbarHidden = true; renderVerBar(); return; }
  if (v === 'newest') return go(verCounterpart(d, g.primary).url);
  if (v === 'older' || v === 'newer') { const o = g.members[m.vno - 1 + (v === 'older' ? -1 : 1)]; if (o) go(verCounterpart(d, o).url); return; }
  if (v === 'compare') return go(compareUrl(d, verCounterpart(d, g.primary)));
  if (v === 'all') return go(versionsUrl(g));
  if (v === 'split') foldSplitAsk(d);
}

/* ---------------- www.site.com/versions/ ---------------- */
const VERSIONS_CSS = `body{font:13px/1.4 Verdana,Arial,sans-serif;margin:0;background:#f4f1e8;color:#111}
.wrap{max-width:960px;margin:0 auto;padding:12px 14px}
h1{font:bold 22px Georgia,"Times New Roman",serif;margin:6px 0 2px;color:#5a2d0c}
.sub{color:#555;margin:0 0 12px}
table.vt{border-collapse:collapse;width:100%;background:#fff;border:1px solid #9a8a6a}
.vt th{background:#5a2d0c;color:#fff;text-align:left;font-size:11px;padding:5px 7px;white-space:nowrap}
.vt td{border-top:1px solid #e0d6c0;padding:6px 7px;vertical-align:top}
.vt tr.main td{background:#fffbe0}
.vt .lb{font-weight:bold;white-space:nowrap}
.vt .f{font:11px "Courier New",monospace;color:#555;word-break:break-all}
.vt .acts a{white-space:nowrap}
.star{color:#c08000;font-size:15px}
.tag{display:inline-block;font:bold 10px Arial,sans-serif;padding:1px 5px;border:1px solid #9a8a6a;background:#efe6cc;margin-left:4px}
.note{border:1px dashed #9a8a6a;background:#fffdf3;padding:8px 10px;margin:14px 0;font-size:12px}
.foot{text-align:center;font-size:11px;color:#777;margin:18px 0}`;
function versionsPage(site) {
  const g = site.index.fold;
  if (!g || g.primary !== site.index) {
    return page('Versions', '<div class="wrap"><h1>Version History</h1><p class="sub">' + A(site.url, esc(site.title)) + ' has no other versions or copies on your LANscape right now.</p><p>' + A(dupesUrl(), 'Open the Duplicate Finder') + '</p></div>', { css: VERSIONS_CSS });
  }
  const rows = g.members.slice().reverse().map(d => {
    const main = d === g.primary, w = g.whole ? g.dirs.get(d) : null;
    const why = main ? 'Main entry' : foldWhy(d);
    const words = Math.max(d.meta.words || 0, d.meta.deepWords || 0);
    const size = w ? w.size : d.size;
    const acts = [A(d.url, 'View')];
    if (!main) acts.push(A(compareUrl(d, g.primary), 'Compare'), A('lanscape:dupes-keep?p=' + encodeURIComponent(d.path), 'Make main'), A('lanscape:dupes-split?p=' + encodeURIComponent(d.path), 'Not the same'));
    return '<tr' + (main ? ' class="main"' : '') + '><td>' + (main ? '<span class="star" title="Main entry">&#9733;</span>' : d.vno) + '</td><td class="lb">' + esc(d.vlabel || '') + (d.vtwin ? '<span class="tag">COPY</span>' : '') + '</td>' +
      '<td>' + A(d.url, esc(w ? w.dir.split('/').filter(Boolean).pop() + '/' : d.name)) + '<div class="f">' + esc(w ? w.dir : d.dir) + '</div></td>' +
      '<td>' + esc(fmtDate(w ? w.mtime : d.mtime)) + '</td><td>' + fmtBytes(size || 0) + (w ? '<br><span class="f">' + w.pages.length + ' pages</span>' : words ? '<br><span class="f">' + words.toLocaleString() + ' words</span>' : '') + '</td>' +
      '<td>' + esc(why) + '</td><td class="acts">' + acts.join(' &middot; ') + '</td></tr>';
  }).join('');
  return page('Versions of ' + site.title, `<div class="wrap">
<p style="font-size:11px">${A(site.url, esc(displayUrl(site.url)))} &gt; <b>versions</b></p>
<h1>Version History: ${esc(site.title)}</h1>
<p class="sub">LANscape found <b>${g.members.length}</b> ${g.reason === 'copy' ? 'copies' : 'versions'} of this ${g.whole ? 'website' : 'page'} and shows only the main one in search, rings and lists. ${FOLD_REASON[g.reason] ? 'Why: <i>' + esc(FOLD_REASON[g.reason].toLowerCase()) + '</i>.' : ''}</p>
<table class="vt"><tr><th>#</th><th>Version</th><th>${g.whole ? 'Folder' : 'File'}</th><th>Saved</th><th>Size</th><th>Why it's here</th><th></th></tr>${rows}</table>
<div class="note">&#9998; <b>Make main</b> puts another one up front. <b>Not the same</b> gives it back its own address. Fine-tune everything in the ${A(dupesUrl(g), 'Duplicate Finder')}, or change how eager LANscape is under <b>Options &gt; Preferences</b>.</div>
<p class="foot">${A(site.url, 'Back to ' + esc(site.title))}</p></div>`, { css: VERSIONS_CSS });
}

/* ---------------- Diff: Myers' algorithm in linear space ---------------- */
const Diff = (() => {
  const TOO_BIG = { tooBig: true };
  /** a, b: arrays of numbers. -> flat [op, i, j, op, i, j, ...] with op 0 same, 1 only in a, 2 only in b */
  function run(a, b, budget = 4e7) {
    const n = a.length, m = b.length, ops = [];
    const size = 2 * (n + m) + 6, off = n + m + 3;
    const vf = new Int32Array(size), vb = new Int32Array(size);
    let steps = 0;
    function snake(a0, a1, b0, b1) {
      const N = a1 - a0, M = b1 - b0, delta = N - M, odd = (delta & 1) !== 0, maxD = Math.ceil((N + M) / 2);
      vf[off + 1] = 0; vb[off + 1] = 0;
      for (let d = 0; d <= maxD; d++) {
        for (let k = -d; k <= d; k += 2) {
          let x = k === -d || (k !== d && vf[off + k - 1] < vf[off + k + 1]) ? vf[off + k + 1] : vf[off + k - 1] + 1;
          let y = x - k;
          const sx = x, sy = y;
          while (x < N && y < M && a[a0 + x] === b[b0 + y]) { x++; y++; }
          vf[off + k] = x;
          steps += 1 + x - sx;
          if (odd && k >= delta - (d - 1) && k <= delta + (d - 1) && x + vb[off + delta - k] >= N) return [a0 + sx, b0 + sy, a0 + x, b0 + y];
        }
        for (let k = -d; k <= d; k += 2) {
          let x = k === -d || (k !== d && vb[off + k - 1] < vb[off + k + 1]) ? vb[off + k + 1] : vb[off + k - 1] + 1;
          let y = x - k;
          const sx = x, sy = y;
          while (x < N && y < M && a[a1 - 1 - x] === b[b1 - 1 - y]) { x++; y++; }
          vb[off + k] = x;
          steps += 1 + x - sx;
          if (!odd && k >= delta - d && k <= delta + d && x + vf[off + delta - k] >= N) return [a1 - x, b1 - y, a1 - sx, b1 - sy];
        }
        if (steps > budget) throw TOO_BIG;
      }
      throw TOO_BIG;
    }
    function rec(a0, a1, b0, b1) {
      while (a0 < a1 && b0 < b1 && a[a0] === b[b0]) { ops.push(0, a0, b0); a0++; b0++; }
      const e = a1;
      while (a1 > a0 && b1 > b0 && a[a1 - 1] === b[b1 - 1]) { a1--; b1--; }
      const tailA = a1, tailB = b1;
      if (a0 === a1) for (let j = b0; j < b1; j++) ops.push(2, a0, j);
      else if (b0 === b1) for (let i = a0; i < a1; i++) ops.push(1, i, b0);
      else {
        const [x, y, u, v] = snake(a0, a1, b0, b1);
        rec(a0, x, b0, y);
        for (let i = x, j = y; i < u; i++, j++) ops.push(0, i, j);
        rec(u, a1, v, b1);
      }
      for (let i = tailA, j = tailB; i < e; i++, j++) ops.push(0, i, j);
    }
    try { rec(0, n, 0, m); return { ops, exact: true }; }
    catch (err) {
      if (err !== TOO_BIG) throw err;
      // too different to work out line by line in reasonable time: same start and end, everything between changed
      ops.length = 0;
      let i = 0;
      while (i < n && i < m && a[i] === b[i]) { ops.push(0, i, i); i++; }
      let ea = n, eb = m;
      while (ea > i && eb > i && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
      for (let x = i; x < ea; x++) ops.push(1, x, i);
      for (let y = i; y < eb; y++) ops.push(2, ea, y);
      for (let x = ea, y = eb; x < n; x++, y++) ops.push(0, x, y);
      return { ops, exact: false };
    }
  }
  /** lines (or any strings) -> numbers, shared between both sides so equal lines get equal numbers */
  function ids(listA, listB, norm) {
    const map = new Map();
    const f = l => l.map(s => { const k = norm ? norm(s) : s; let v = map.get(k); if (v == null) { v = map.size; map.set(k, v); } return v; });
    return [f(listA), f(listB)];
  }
  /** rows for display: same / changed (a paired with b) / only-left / only-right */
  function rows(A, B, res) {
    const out = [], ops = res.ops;
    let delA = [], insB = [];
    const flush = () => {
      const n = Math.max(delA.length, insB.length);
      for (let k = 0; k < n; k++) out.push({ t: delA[k] != null && insB[k] != null ? 'chg' : delA[k] != null ? 'del' : 'add', a: delA[k], b: insB[k] });
      delA = []; insB = [];
    };
    for (let k = 0; k < ops.length; k += 3) {
      const op = ops[k];
      if (op === 0) { flush(); out.push({ t: 'same', a: ops[k + 1], b: ops[k + 2] }); }
      else if (op === 1) delA.push(ops[k + 1]);
      else insB.push(ops[k + 2]);
    }
    flush();
    return out;
  }
  return { run, ids, rows };
})();

/* ---------------- the Duplicate Finder program ---------------- */
function dupesRoute(path, q) {
  if (path === '/compare') return { type: 'app', params: q, title: 'Compare - Duplicate Finder' };
  if (path === '/' || path === '' || path === '/index.html') return { type: 'app', params: q };
  return null;
}
const DUPES_CSS = `.tb .tbtn.txt{display:inline-flex;gap:4px;align-items:center}
.tb .tbtn.txt svg{width:14px;height:14px}
.dp-sum{padding:5px 8px;background:var(--tip);border-bottom:1px solid var(--sh);flex:none;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.dp-sum b{font-size:12px}
.dp-filters{display:flex;gap:2px;margin-left:auto}
.dp-filters button{border:0;padding:2px 8px;background:var(--face);cursor:default;box-shadow:inset -1px -1px var(--dk),inset 1px 1px var(--hi)}
.dp-filters button.on{box-shadow:inset -1px -1px var(--hi),inset 1px 1px var(--dk);background:repeating-conic-gradient(var(--face) 0 25%,var(--hi) 0 50%) 0 0/2px 2px;font-weight:bold}
.dp-main{flex:1;min-height:0;display:flex;gap:3px;padding:3px}
.dp-list{width:min(330px,42%);flex:none;overflow:auto;background:var(--field)}
.dp-detail{flex:1;min-width:0;overflow:auto;background:var(--field);padding:10px 12px}
.dp-g{display:flex;gap:6px;align-items:center;padding:4px 6px;cursor:default;border-bottom:1px dotted #ccc}
.dp-g:hover{background:#eef}
.dp-g.on{background:var(--sel);color:var(--selt)}
.dp-g svg{width:16px;height:16px;flex:none}
.dp-g .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dp-g .n{font-weight:bold;flex:none}
.dp-g .r{font-size:10px;opacity:.75;flex:none}
.dp-h{display:flex;gap:10px;align-items:flex-start;margin-bottom:8px}
.dp-h svg{width:32px;height:32px;flex:none}
.dp-h h2{margin:0;font:bold 15px var(--ui)}
.dp-h .why{color:#444;margin-top:2px}
.dp-h a{color:#00e}
table.dp-m{border-collapse:collapse;width:100%;font-size:11px}
.dp-m th{position:sticky;top:-10px;background:var(--face);text-align:left;padding:3px 6px;box-shadow:inset -1px -1px var(--sh),inset 1px 1px var(--hi);white-space:nowrap;font-weight:normal}
.dp-m td{padding:4px 6px;border-bottom:1px solid #e4e4e4;vertical-align:top}
.dp-m tr{cursor:default}
.dp-m tr.sel td{background:var(--sel);color:var(--selt)}
.dp-m tr.sel td .f{color:#dde}
.dp-m .f{font:10.5px var(--mono);color:#666;word-break:break-all}
.dp-m .star{color:#c08000;font-size:14px}
.dp-m tr.sel .star{color:#ffd34d}
.dp-hint{color:#555;margin:8px 0 0}
.dp-sec{margin-top:16px;border-top:1px solid #ccc;padding-top:8px}
.dp-sec h3{font:bold 12px var(--ui);margin:0 0 6px}
.dp-sec li{margin:3px 0}
.dp-sec button{font-size:10.5px;padding:1px 6px;min-width:0;min-height:0}
.dp-empty{padding:30px 16px;text-align:center;color:#333;font:13px/1.5 var(--ui)}
.dp-pics{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
.dp-pics figure{margin:0;text-align:center;font-size:10.5px}
.dp-pics img{max-width:160px;max-height:120px;border:1px solid var(--sh);display:block;margin:0 auto 3px;background:#eee}
/* compare */
.cp-head{display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:3px;flex:none}
.cp-head>div{background:var(--field);padding:5px 8px;min-width:0}
.cp-head b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-head .f{font:10.5px var(--mono);color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-head .old{border-top:3px solid #c62828}.cp-head .new{border-top:3px solid #2e7d32}
.cp-body{flex:1;min-height:0;overflow:auto;background:var(--field);margin:0 3px 3px}
table.cp{border-collapse:collapse;width:100%;table-layout:fixed;font:11.5px/1.45 var(--mono)}
.cp td{padding:0 6px;vertical-align:top;white-space:pre-wrap;word-break:break-word}
.cp td.ln{width:46px;text-align:right;color:#888;background:#f3f3f3;user-select:none;padding-right:4px}
.cp td.mk{width:14px;text-align:center;color:#888;user-select:none;padding:0}
.cp tr.del td.tx,.cp td.tx.del{background:#fde8e8}
.cp tr.add td.tx,.cp td.tx.add{background:#e6f4e6}
.cp td.tx.chg-a{background:#fdf0f0}.cp td.tx.chg-b{background:#eef8ee}
.cp del{background:#f5b5b5;text-decoration:none}.cp ins{background:#a8dca8;text-decoration:none}
.cp tr.gap td{background:#eef;color:#336;text-align:center;font:11px var(--ui);padding:3px;cursor:pointer}
.cp tr.gap td:hover{background:#dde}
.cp td.empty{background:repeating-linear-gradient(45deg,#fafafa 0 4px,#f0f0f0 4px 8px)}
.cp-props{border-collapse:collapse;margin:12px;font-size:12px;background:#fff}
.cp-props td,.cp-props th{border:1px solid #ccc;padding:4px 10px;text-align:left}
.cp-props tr.diff td{background:#fff7d6}
.cp-pics{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px}
.cp-pics img{max-width:100%;border:1px solid var(--sh);background:#eee}
.cp-pics figure{margin:0;text-align:center;font-size:11px}
@media (max-width:640px){.dp-main{flex-direction:column}.dp-list{width:auto;max-height:36%}.dp-filters{margin-left:0;flex-wrap:wrap}.dp-m th:nth-child(5),.dp-m td:nth-child(5){display:none}
.cp-head{grid-template-columns:1fr}.cp td.ln{width:30px}}`;

async function mountDupes(ctx) {
  const path = new URL(ctx.url).pathname;
  if (path === '/compare') return mountCompare(ctx);
  const { h, root } = ctx;
  let filter = ctx.params.get('t') || 'all', sort = 'size';
  let selG = ctx.params.get('g') || null;
  let sel = [];                // selected member paths (at most two)
  let gen = -1;
  const FILTERS = [['all', 'All'], ['site', 'Pages & Documents'], ['audio', 'Songs'], ['video', 'Videos'], ['image', 'Pictures'], ['file', 'Other Files']];
  const LEVELS = [['off', 'Off: show every file'], ['copies', 'Exact copies only'], ['normal', 'Copies and versions (normal)'], ['loose', 'Eager: also close look-alikes']];
  const groups = () => {
    let list = Array.from(S.folds.values());
    if (filter !== 'all') list = list.filter(g => g.cls === filter);
    const key = g => (sort === 'size' ? -(g.members.length * 1e12 + g.wasted) : sort === 'name' ? 0 : -Math.max(...g.members.map(d => d.mtime || 0)));
    return list.sort((a, b) => key(a) - key(b) || foldTitle(a).localeCompare(foldTitle(b)));
  };
  const curGroup = () => (selG && S.folds.get(selG)) || null;
  const selDocs = () => sel.map(p => S.docs.get(p)).filter(Boolean);
  const setLevel = k => { S.prefs.fold = k; saveState(); rebuildAll(); afterFolderChange(); draw(); ctx.status('Folding: ' + LEVELS.find(x => x[0] === k)[1] + '.'); };
  async function scan() {
    if (!foldLevel()) { ctx.status('Folding is off. Turn it on under Options first.'); return; }
    const todo = Fingerprinter.todo();
    const n = todo.qh.length + todo.dh.length;
    if (!n) { ctx.status('Every file that could be a copy has already been compared.'); return; }
    const prog = progressWin('Duplicate Finder', 'Comparing ' + n + ' files that might be copies...');
    try { const found = await Fingerprinter.run(prog); prog.close(); ctx.status(found ? 'Compared ' + found + ' files.' : 'No new copies found.'); }
    catch (e) { prog.close(); ctx.status('Couldn\'t compare: ' + (e.message || e)); }
  }
  const act = {
    keep: () => { const d = selDocs()[0]; if (!d) return; foldKeep(d.path); sel = [d.path]; draw(); ctx.status(prettyName(d.name) + ' is now the main entry.'); },
    split: async () => { const d = selDocs()[0]; if (!d) return; if (await foldSplitAsk(d)) { sel = []; draw(); } },
    unfold: async () => {
      const g = curGroup(); if (!g) return;
      const v = await ctx.msg('question', 'Unfold', '<p>Show all ' + g.members.length + ' of <b>' + esc(foldTitle(g)) + '</b> as separate ' + (g.cls === 'site' ? 'pages' : 'files') + ' again?</p>', ['Unfold', 'Cancel']);
      if (v !== 'Unfold') return;
      foldUnfold(g); selG = null; sel = []; draw();
    },
    compare: () => {
      const g = curGroup(); if (!g) return;
      const ds = selDocs();
      const a = ds[0] || g.members.find(d => d !== g.primary), b = ds[1] || (ds[0] && ds[0] !== g.primary ? g.primary : g.members.find(d => d !== g.primary && d !== a) || g.primary);
      if (a && b && a !== b) ctx.go(compareUrl(a, b)); else ctx.status('Pick a file to compare with the main one.');
    },
    open: () => { const d = selDocs()[0] || (curGroup() && curGroup().primary); if (d) ctx.go(d.url); }
  };
  const mb = appMenubar(ctx, [
    { label: 'File', items: () => [
      { label: 'Scan for Copies...', act: scan },
      { label: 'Open', act: act.open, disabled: () => !curGroup() },
      { label: 'Compare', act: act.compare, disabled: () => !curGroup() },
      { sep: 1 },
      { label: 'Close', act: () => ctx.go('http://home.lanscape.net/') }] },
    { label: 'Edit', items: () => [
      { label: 'Make This the Main One', act: act.keep, disabled: () => !selDocs()[0] || (curGroup() && curGroup().primary === selDocs()[0]) },
      { label: 'Not the Same', act: act.split, disabled: () => !selDocs()[0] },
      { label: 'Unfold This Group', act: act.unfold, disabled: () => !curGroup() }] },
    { label: 'View', items: () => [
      ...FILTERS.map(([k, label]) => ({ label, radio: () => filter === k, act: () => { filter = k; draw(); } })),
      { sep: 1 },
      { label: 'Sort by Most Copies', radio: () => sort === 'size', act: () => { sort = 'size'; draw(); } },
      { label: 'Sort by Newest', radio: () => sort === 'new', act: () => { sort = 'new'; draw(); } },
      { label: 'Sort by Name', radio: () => sort === 'name', act: () => { sort = 'name'; draw(); } }] },
    { label: 'Options', items: () => LEVELS.map(([k, label]) => ({ label, radio: () => (S.prefs.fold || 'normal') === k, act: () => setLevel(k) })) },
    { label: 'Help', items: () => [{ label: 'How Folding Works', act: help }] }
  ]);
  const tb = h('div', { class: 'tb noprint' },
    tbtn(ctx, I16.zoomIn, 'Scan for copies', scan, { class: 'tbtn txt', html: I16.zoomIn + ' Scan' }), tsep(ctx),
    tbtn(ctx, '', 'Compare two files', act.compare, { class: 'tbtn txt', html: '&#8644; Compare' }),
    tbtn(ctx, '', 'Make the selected file the main one', act.keep, { class: 'tbtn txt', html: '&#9733; Make Main' }),
    tbtn(ctx, '', 'The selected file is its own thing', act.split, { class: 'tbtn txt', html: '&#9986; Not the Same' }),
    tbtn(ctx, '', 'Show every file in this group separately', act.unfold, { class: 'tbtn txt', html: '&#8862; Unfold' }), tsep(ctx),
    tbtn(ctx, '', 'Open the selected file', act.open, { class: 'tbtn txt', html: '&#8599; Open' }));
  const sum = h('div', { class: 'dp-sum' });
  const list = h('div', { class: 'dp-list sunk', role: 'listbox', 'aria-label': 'Folded groups' });
  const detail = h('div', { class: 'dp-detail sunk' });
  const stA = h('span', { class: 'grow' }), stB = h('span');
  root.append(mb.el, tb, sum, h('div', { class: 'dp-main' }, list, detail), h('div', { class: 'status' }, stA, stB));

  function help() {
    ctx.msg('info', 'How Folding Works', '<p>LANscape folds files that are the same thing into one entry, so search, rings and lists show each once:</p><ul><li><b>Exact copies</b>: the same text (pages, documents) or the same bytes (everything else). Downloads like "Plan (1).html" and "Copy of Plan.html".</li><li><b>Versions</b>: the same name once "v2", "Rev 3", "_final", "(1)" and dates come off, with mostly the same words. The newest (or highest number) is the main one.</li><li><b>Look-alikes</b>: different names, nearly all the same words and a similar title.</li><li><b>Songs, videos and pictures</b>: the same song in MP3 and FLAC, a video in two formats, a picture and its resized copy.</li><li><b>Website folders</b>: a copied website folder folds into the original.</li></ul><p>Older versions stay one click away under the main page\'s <tt>/versions/</tt> address.</p>');
  }
  function groupRow(g) {
    const r = h('div', { class: 'dp-g' + (g.id === selG ? ' on' : ''), role: 'option', 'aria-selected': g.id === selG ? 'true' : 'false', 'data-g': g.id, title: foldTitle(g) },
      h('span', { html: iconFor(g.primary) }), h('span', { class: 't', text: foldTitle(g) }), h('span', { class: 'r', text: FOLD_REASON[g.reason] || '' }), h('span', { class: 'n', text: '×' + g.members.length }));
    return r;
  }
  function drawList() {
    const gs = groups();
    list.innerHTML = '';
    if (!gs.length) {
      list.append(h('div', { class: 'dp-empty', html: !foldLevel() ? 'Folding is turned off.<br>Turn it on under <b>Options</b>.' : S.folds.size ? 'Nothing of this kind was folded.' : 'No duplicates found.<br>Every file is one of a kind.' }));
      return gs;
    }
    for (const g of gs) list.append(groupRow(g));
    return gs;
  }
  function memberRows(g) {
    const rows = g.members.map(d => {
      const main = d === g.primary, w = g.whole ? g.dirs.get(d) : null, m = d.meta || {};
      const what = g.cls === 'audio' ? [(d.ext || '').toUpperCase(), m.bitrate ? m.bitrate + ' kbps' : '', m.duration ? fmtDur(m.duration) : ''].filter(Boolean).join(' · ') :
        g.cls === 'video' ? [(d.ext || '').toUpperCase(), m.height ? m.height + 'p' : '', m.duration ? fmtDur(m.duration) : ''].filter(Boolean).join(' · ') :
          w ? w.pages.length + ' pages' : d.vlabel || '';
      const tr = h('tr', { class: sel.includes(d.path) ? 'sel' : '', 'data-p': d.path, title: d.path },
        h('td', { html: main ? '<span class="star" title="Main entry">&#9733;</span>' : String(d.vno) }),
        h('td', {}, h('b', { text: w ? w.dir.split('/').filter(Boolean).pop() + '/' : d.name }), h('div', { class: 'f', text: w ? w.dir : d.dir })),
        h('td', { text: what }),
        h('td', { text: fmtBytes(w ? w.size : d.size || 0) }),
        h('td', { text: fmtShort(w ? w.mtime : d.mtime) }),
        h('td', { text: main ? 'Main entry' : foldWhy(d) }));
      return tr;
    });
    return h('table', { class: 'dp-m' }, h('thead', {}, h('tr', {}, h('th', { text: '' }), h('th', { text: g.whole ? 'Website folder' : 'File' }), h('th', { text: g.cls === 'site' ? 'Version' : 'Format' }), h('th', { text: 'Size' }), h('th', { text: 'Saved' }), h('th', { text: 'Why' }))), h('tbody', {}, ...rows));
  }
  async function drawDetail() {
    const g = curGroup();
    detail.innerHTML = '';
    if (!g) {
      const st = S.foldStats || { groups: 0 };
      detail.append(h('div', { class: 'dp-empty', html: st.groups ? '<b>Pick a group on the left</b> to see its files.<br><br>Every group shows as one entry everywhere else on your LANscape. Use <b>Make Main</b> to choose which one, or <b>Not the Same</b> when LANscape got it wrong.' : 'Nothing is folded right now.' }));
      drawSplits();
      return;
    }
    const p = g.primary;
    const head = h('div', { class: 'dp-h' }, h('span', { html: iconFor(p).replace('width="16" height="16"', 'width="32" height="32"') }),
      h('div', {}, h('h2', { text: foldTitle(g) }),
        h('div', { class: 'why', html: esc(FOLD_REASON[g.reason] || '') + ' · ' + g.members.length + (g.cls === 'site' ? (g.reason === 'copy' ? ' copies' : ' versions') : ' files') + (g.copies ? ' · ' + g.copies + ' exact cop' + (g.copies > 1 ? 'ies' : 'y') + ' (' + fmtBytes(g.wasted) + ')' : '') +
          ' · shown as <a href="#" data-open="' + esc(p.url) + '">' + esc(displayUrl(p.url)) + '</a>' + (g.cls === 'site' && p.site ? ' · <a href="#" data-open="' + esc(p.site.url + 'versions/') + '">version history</a>' : '') })));
    detail.append(head, memberRows(g), h('p', { class: 'dp-hint', text: 'Click a file to select it; Ctrl+click a second one to compare the two. Double-click opens it.' }));
    if (g.cls === 'image') {
      const pics = h('div', { class: 'dp-pics' });
      detail.append(pics);
      for (const d of g.members) {
        const u = await assetURL(d.path);
        pics.append(h('figure', {}, h('img', { src: u || '', alt: d.name, loading: 'lazy' }), h('figcaption', { text: d.name })));
      }
    }
    drawSplits();
  }
  function drawSplits() {
    const r = foldRules();
    const split = r.split.filter(p => S.docs.has(p));
    if (!split.length) return;
    const ul = h('ul');
    for (const p of split.slice(0, 200)) {
      const d = S.docs.get(p);
      ul.append(h('li', {}, h('span', { text: d.name + '  ' }), h('span', { class: 'f', style: { color: '#777', font: '10.5px var(--mono)' }, text: d.dir + '  ' }),
        h('button', { class: 'btn', type: 'button', text: 'Put Back', onclick: () => { foldUnsplit(p); draw(); } })));
    }
    detail.append(h('div', { class: 'dp-sec' }, h('h3', { text: 'Files you said are their own thing (' + split.length + ')' }), ul));
  }
  function draw() {
    gen = S.gen;
    const st = S.foldStats || { groups: 0, folded: 0, copies: 0, wasted: 0 };
    const lvl = S.prefs.fold || 'normal';
    sum.innerHTML = '';
    sum.append(h('span', { html: !foldLevel() ? '<b>Folding is off.</b> Every file shows on its own.' : st.groups ? '<b>' + st.folded + ' duplicate' + (st.folded === 1 ? '' : 's') + '</b> folded into <b>' + st.groups + '</b> entr' + (st.groups === 1 ? 'y' : 'ies') + (st.copies ? ' · ' + st.copies + ' exact cop' + (st.copies === 1 ? 'y' : 'ies') + ' using ' + fmtBytes(st.wasted) : '') : '<b>No duplicates</b> on your LANscape.' }));
    const fl = h('span', { class: 'dp-filters', role: 'tablist' });
    const counts = {};
    for (const g of S.folds.values()) counts[g.cls] = (counts[g.cls] || 0) + 1;
    for (const [k, label] of FILTERS) {
      if (k !== 'all' && !counts[k]) continue;
      fl.append(h('button', { type: 'button', class: filter === k ? 'on' : '', role: 'tab', 'aria-selected': filter === k ? 'true' : 'false', text: label + (k === 'all' ? '' : ' (' + counts[k] + ')'), onclick: () => { filter = k; draw(); } }));
    }
    sum.append(fl);
    const gs = drawList();
    if (selG && !S.folds.has(selG)) {
      // the group changed (a file moved out or in): follow the selected file to its new group
      const d = sel[0] && S.docs.get(sel[0]);
      selG = d && d.fold ? d.fold.id : null;
    }
    if (!selG && gs.length && root.ownerDocument.defaultView.innerWidth > 640) selG = gs[0].id;
    for (const r of list.children) r.classList.toggle('on', r.dataset.g === selG);
    sel = sel.filter(p => { const d = S.docs.get(p); return d && d.fold && d.fold.id === selG; });
    drawDetail();
    stA.textContent = gs.length + ' group' + (gs.length === 1 ? '' : 's') + (filter !== 'all' ? ' shown' : '');
    stB.textContent = 'Folding: ' + (LEVELS.find(x => x[0] === lvl) || LEVELS[2])[1];
    ctx.setTitle('Duplicate Finder' + (st.groups ? ' (' + st.groups + ')' : ''));
  }
  ctx.on(list, 'click', e => {
    const r = e.target.closest('[data-g]');
    if (!r) return;
    selG = r.dataset.g; sel = [];
    for (const x of list.children) { x.classList.toggle('on', x === r); x.setAttribute('aria-selected', x === r ? 'true' : 'false'); }
    drawDetail();
  });
  ctx.on(detail, 'click', e => {
    const a = e.target.closest('[data-open]');
    if (a) { e.preventDefault(); ctx.go(a.dataset.open); return; }
    const tr = e.target.closest('tr[data-p]');
    if (!tr) return;
    const p = tr.dataset.p;
    if (e.ctrlKey || e.metaKey || e.shiftKey) { sel = sel.includes(p) ? sel.filter(x => x !== p) : sel.concat([p]).slice(-2); }
    else sel = [p];
    for (const x of detail.querySelectorAll('tr[data-p]')) x.classList.toggle('sel', sel.includes(x.dataset.p));
  });
  ctx.on(detail, 'dblclick', e => { const tr = e.target.closest('tr[data-p]'); if (tr) { const d = S.docs.get(tr.dataset.p); if (d) ctx.go(d.url); } });
  // the index changes underneath (new fingerprints, a folder re-synced): redraw
  ctx.every(1200, () => { if (S.gen !== gen) draw(); });
  draw();
  return { title: 'Duplicate Finder' };
}

/* ---------------- Compare: two files side by side ---------------- */
const SOURCE_KINDS = new Set(['html', 'text', 'md', 'code', 'rtf']);
async function compareText(d, mode) {
  if (mode === 'source' && (SOURCE_KINDS.has(d.kind) || (d.kind === 'sheet' && (d.ext === 'csv' || d.ext === 'tsv')))) {
    const t = await getText(d);
    return String(t).replace(/\r\n?/g, '\n').split('\n');
  }
  // the words a reader sees, one sentence per line
  const m = d.meta || {};
  let t = String(m.deep || m.body || '');
  if (m.headings && !m.deep) t = m.headings + '. ' + t;
  const lines = [];
  for (const s of t.replace(/\s+/g, ' ').replace(/([.!?])\s+(?=[A-Z0-9"'(])/g, '$1\n').split('\n')) {
    let x = s.trim();
    while (x.length > 180) { let cut = x.lastIndexOf(' ', 160); if (cut < 60) cut = 160; lines.push(x.slice(0, cut)); x = x.slice(cut).trim(); }
    if (x) lines.push(x);
  }
  return lines;
}
/** mark the words that changed inside a pair of lines */
function wordDiff(a, b) {
  const ta = a.match(/\s+|[^\s]+/g) || [], tb = b.match(/\s+|[^\s]+/g) || [];
  if (ta.length * tb.length > 250000) return [esc(a), esc(b)];
  const [ia, ib] = Diff.ids(ta, tb);
  const r = Diff.run(ia, ib, 2e5);
  let A = '', B = '';
  const ops = r.ops;
  for (let k = 0; k < ops.length; k += 3) {
    const op = ops[k];
    if (op === 0) { A += esc(ta[ops[k + 1]]); B += esc(tb[ops[k + 2]]); }
    else if (op === 1) A += '<del>' + esc(ta[ops[k + 1]]) + '</del>';
    else B += '<ins>' + esc(tb[ops[k + 2]]) + '</ins>';
  }
  return [A.replace(/<\/del><del>/g, ''), B.replace(/<\/ins><ins>/g, '')];
}
async function mountCompare(ctx) {
  const { h, root } = ctx;
  let a = S.docs.get(ctx.params.get('a') || ''), b = S.docs.get(ctx.params.get('b') || '');
  if (!a || !b) {
    root.append(h('div', { class: 'empty-note', html: '<b>Nothing to compare.</b><br>Pick two files in the ' + '<a href="#" id="cpDp">Duplicate Finder</a>.' }));
    const l = root.querySelector('#cpDp');
    if (l) l.addEventListener('click', e => { e.preventDefault(); ctx.go(dupesUrl()); });
    return { title: 'Compare - Duplicate Finder' };
  }
  // the older one on the left (unless you swapped them)
  if (ctx.params.get('o') !== '1' && ((a.fold && a.fold === b.fold && a.vno > b.vno) || (!(a.fold && a.fold === b.fold) && (a.mtime || 0) > (b.mtime || 0)))) { const t = a; a = b; b = t; }
  const textual = d => SOURCE_KINDS.has(d.kind) || K(d).cls === 'document';
  const canSource = d => SOURCE_KINDS.has(d.kind) || (d.kind === 'sheet' && (d.ext === 'csv' || d.ext === 'tsv'));
  let mode = ctx.params.get('mode') || (a.kind === 'html' && !(a.meta.deep || a.meta.body || '').trim() ? 'source' : 'text');
  let view = ctx.params.get('view') || (root.ownerDocument.defaultView.innerWidth < 720 ? 'inline' : 'split');
  let onlyChanges = true;
  const label = d => (d.fold && d.vlabel ? d.vlabel + ' · ' : '') + d.name;
  const head = h('div', { class: 'cp-head' },
    h('div', { class: 'old' }, h('b', { text: '− ' + label(a) }), h('div', { class: 'f', text: a.dir }), h('div', { class: 'f', text: fmtDate(a.mtime, true) + ' · ' + fmtBytes(a.size || 0) })),
    h('div', { class: 'new' }, h('b', { text: '+ ' + label(b) }), h('div', { class: 'f', text: b.dir }), h('div', { class: 'f', text: fmtDate(b.mtime, true) + ' · ' + fmtBytes(b.size || 0) })));
  const body = h('div', { class: 'cp-body sunk' });
  const stA = h('span', { class: 'grow', text: 'Comparing...' }), stB = h('span');
  const btn = (txt, title, fn, on) => { const x = tbtn(ctx, '', title, fn, { class: 'tbtn txt' + (on ? ' on' : ''), html: txt }); return x; };
  const tb = h('div', { class: 'tb noprint' });
  const drawTb = () => {
    tb.innerHTML = '';
    if (textual(a) && textual(b)) {
      tb.append(btn('Words', 'Compare the words a reader sees', () => { mode = 'text'; drawTb(); drawBody(); }, mode === 'text'));
      if (canSource(a) && canSource(b)) tb.append(btn('Source', 'Compare the files line by line', () => { mode = 'source'; drawTb(); drawBody(); }, mode === 'source'));
      tb.append(tsep(ctx), btn('Side by Side', 'Old on the left, new on the right', () => { view = 'split'; drawTb(); drawBody(); }, view === 'split'),
        btn('Inline', 'One column, changes marked', () => { view = 'inline'; drawTb(); drawBody(); }, view === 'inline'), tsep(ctx),
        btn('Only Changes', 'Hide long runs of lines that are the same', () => { onlyChanges = !onlyChanges; drawTb(); drawBody(); }, onlyChanges), tsep(ctx));
    }
    tb.append(btn('&#8644; Swap', 'Swap left and right', () => ctx.go(compareUrl(b, a) + '&o=1', { replace: true })),
      btn('Open Left', 'Open ' + a.name, () => ctx.go(a.url)), btn('Open Right', 'Open ' + b.name, () => ctx.go(b.url)));
    if (a.fold && a.fold === b.fold) {
      const other = a === a.fold.primary ? b : a;
      tb.append(tsep(ctx), btn('Back to the Group', 'The Duplicate Finder', () => ctx.go(dupesUrl(a.fold))),
        btn('&#9986; Not the Same', other.name + ' is its own thing', async () => { if (await foldSplitAsk(other)) ctx.go(compareUrl(a, b), { replace: true }); }));
    } else if (foldClass(a) === foldClass(b) && !a.demo && !b.demo && !a.asset && !b.asset) {
      // you know better: these two are the same thing
      tb.append(tsep(ctx), btn('&#8862; Fold Together', 'Show these as one entry from now on', () => {
        foldJoin(a.path, b.path);
        ctx.status(a.fold && a.fold === b.fold ? 'Folded together. ' + prettyName(a.fold.primary.name) + ' is the main one.' : 'LANscape couldn\'t fold these two (one is part of a website folder).');
        ctx.go(compareUrl(a, b), { replace: true });
      }));
    }
  };
  root.append(appMenubar(ctx, [
    { label: 'File', items: () => [{ label: 'Open Left', act: () => ctx.go(a.url) }, { label: 'Open Right', act: () => ctx.go(b.url) }, { sep: 1 }, { label: 'Duplicate Finder', act: () => ctx.go(dupesUrl(a.fold && a.fold === b.fold ? a.fold : null)) }] },
    { label: 'View', items: () => [
      { label: 'Words', radio: () => mode === 'text', act: () => { mode = 'text'; drawTb(); drawBody(); }, disabled: () => !(textual(a) && textual(b)) },
      { label: 'Source', radio: () => mode === 'source', act: () => { mode = 'source'; drawTb(); drawBody(); }, disabled: () => !(canSource(a) && canSource(b)) },
      { sep: 1 },
      { label: 'Side by Side', radio: () => view === 'split', act: () => { view = 'split'; drawTb(); drawBody(); } },
      { label: 'Inline', radio: () => view === 'inline', act: () => { view = 'inline'; drawTb(); drawBody(); } },
      { label: 'Only Changes', check: () => onlyChanges, act: () => { onlyChanges = !onlyChanges; drawTb(); drawBody(); } }] }
  ]).el, tb, head, body, h('div', { class: 'status' }, stA, stB));
  drawTb();
  let tok = 0;
  async function drawBody() {
    const my = ++tok;
    body.innerHTML = '';
    // pictures, songs and videos: what differs about them
    if (!(textual(a) && textual(b))) {
      const ma = a.meta || {}, mb = b.meta || {};
      const rows = [['File', a.name, b.name], ['Folder', a.dir, b.dir], ['Type', (a.ext || '').toUpperCase(), (b.ext || '').toUpperCase()], ['Size', fmtBytes(a.size || 0), fmtBytes(b.size || 0)], ['Saved', fmtDate(a.mtime, true), fmtDate(b.mtime, true)]];
      if (a.kind === 'audio' || a.kind === 'video') rows.push(['Length', ma.duration ? fmtDur(ma.duration) : '', mb.duration ? fmtDur(mb.duration) : '']);
      if (a.kind === 'audio') rows.push(['Bit rate', ma.bitrate ? ma.bitrate + ' kbps' : '', mb.bitrate ? mb.bitrate + ' kbps' : ''], ['Artist', ma.artist || '', mb.artist || ''], ['Album', ma.album || '', mb.album || '']);
      if (a.kind === 'video') rows.push(['Picture', ma.height ? ma.width + '×' + ma.height : '', mb.height ? mb.width + '×' + mb.height : '']);
      rows.push(['Fingerprint', ma.qh || ma.dhash || '—', mb.qh || mb.dhash || '—']);
      body.append(h('table', { class: 'cp-props' }, h('tr', {}, h('th', { text: '' }), h('th', { text: 'Left' }), h('th', { text: 'Right' })), ...rows.map(([k, x, y]) => h('tr', { class: x !== y ? 'diff' : '' }, h('td', { text: k }), h('td', { text: x }), h('td', { text: y })))));
      if (a.kind === 'image' && b.kind === 'image') {
        const [ua, ub] = await Promise.all([assetURL(a.path), assetURL(b.path)]);
        if (my !== tok) return;
        const fig = (u, d) => { const im = h('img', { src: u || '', alt: d.name }); const cap = h('figcaption', { text: d.name }); im.addEventListener('load', () => { cap.textContent = d.name + ' · ' + im.naturalWidth + '×' + im.naturalHeight; }); return h('figure', {}, im, cap); };
        body.append(h('div', { class: 'cp-pics' }, fig(ua, a), fig(ub, b)));
      }
      stA.textContent = a.fold && a.fold === b.fold ? 'Folded together: ' + (FOLD_REASON[a.fold.reason] || '').toLowerCase() : 'Not folded together';
      return;
    }
    stA.textContent = 'Comparing...';
    let A, B;
    try { [A, B] = await Promise.all([compareText(a, mode), compareText(b, mode)]); }
    catch (e) { body.append(h('div', { class: 'empty-note', text: 'LANscape couldn\'t read both files: ' + (e.message || e) })); stA.textContent = ''; return; }
    if (my !== tok) return;
    const CAP = 30000;
    const cut = A.length > CAP || B.length > CAP;
    A = A.slice(0, CAP); B = B.slice(0, CAP);
    const norm = mode === 'source' ? (s => s.replace(/\s+$/, '')) : null;
    const [ia, ib] = Diff.ids(A, B, norm);
    const t0 = performance.now();
    const res = Diff.run(ia, ib);
    const rows = Diff.rows(A, B, res);
    let same = 0, del = 0, add = 0;
    for (const r of rows) { if (r.t === 'same') same++; else if (r.t === 'del') del++; else if (r.t === 'add') add++; else { del++; add++; } }
    const pct = Math.round(100 * same / Math.max(1, Math.max(A.length, B.length)));
    stA.textContent = (del || add ? (add ? add + ' line' + (add === 1 ? '' : 's') + ' added' : '') + (add && del ? ', ' : '') + (del ? del + ' removed' : '') + ' · ' + pct + '% the same' : 'No differences in ' + (mode === 'text' ? 'the words' : 'the source')) + (cut ? ' · first ' + CAP.toLocaleString() + ' lines' : '') + (res.exact ? '' : ' · rough comparison (very different files)');
    stB.textContent = (performance.now() - t0).toFixed(0) + ' ms';
    const table = h('table', { class: 'cp' });
    const split = view === 'split';
    if (split) table.append(h('colgroup', {}, h('col', { style: { width: '46px' } }), h('col'), h('col', { style: { width: '46px' } }), h('col')));
    else table.append(h('colgroup', {}, h('col', { style: { width: '46px' } }), h('col', { style: { width: '46px' } }), h('col', { style: { width: '14px' } }), h('col')));
    const tbody = h('tbody');
    table.append(tbody);
    const html = [];
    const line = r => {
      if (split) {
        let la = r.a != null ? esc(A[r.a]) : '', lb = r.b != null ? esc(B[r.b]) : '';
        if (r.t === 'chg') [la, lb] = wordDiff(A[r.a], B[r.b]);
        const ca = r.t === 'del' ? 'tx del' : r.t === 'chg' ? 'tx chg-a' : 'tx', cb = r.t === 'add' ? 'tx add' : r.t === 'chg' ? 'tx chg-b' : 'tx';
        return '<tr class="' + r.t + '"><td class="ln">' + (r.a != null ? r.a + 1 : '') + '</td><td class="' + (r.a == null ? 'empty' : ca) + '">' + la + '</td><td class="ln">' + (r.b != null ? r.b + 1 : '') + '</td><td class="' + (r.b == null ? 'empty' : cb) + '">' + lb + '</td></tr>';
      }
      if (r.t === 'chg') {
        const [la, lb] = wordDiff(A[r.a], B[r.b]);
        return '<tr class="del"><td class="ln">' + (r.a + 1) + '</td><td class="ln"></td><td class="mk">−</td><td class="tx">' + la + '</td></tr><tr class="add"><td class="ln"></td><td class="ln">' + (r.b + 1) + '</td><td class="mk">+</td><td class="tx">' + lb + '</td></tr>';
      }
      const mk = r.t === 'del' ? '−' : r.t === 'add' ? '+' : '';
      return '<tr class="' + r.t + '"><td class="ln">' + (r.a != null ? r.a + 1 : '') + '</td><td class="ln">' + (r.b != null ? r.b + 1 : '') + '</td><td class="mk">' + mk + '</td><td class="tx">' + esc(r.a != null ? A[r.a] : B[r.b]) + '</td></tr>';
    };
    // long runs of equal lines fold into a "N lines the same" row you can open
    const gaps = new Map();
    const CTX = 3;
    for (let i = 0; i < rows.length;) {
      if (rows[i].t !== 'same' || !onlyChanges) { html.push(line(rows[i])); i++; continue; }
      let j = i;
      while (j < rows.length && rows[j].t === 'same') j++;
      const startKeep = i === 0 ? 0 : CTX, endKeep = j === rows.length ? 0 : CTX;
      if (j - i > startKeep + endKeep + 2) {
        for (let k = i; k < i + startKeep; k++) html.push(line(rows[k]));
        const id = 'g' + gaps.size;
        gaps.set(id, rows.slice(i + startKeep, j - endKeep));
        html.push('<tr class="gap" data-gap="' + id + '"><td colspan="4">&#8942; ' + (j - i - startKeep - endKeep).toLocaleString() + ' lines the same &mdash; show them</td></tr>');
        for (let k = j - endKeep; k < j; k++) html.push(line(rows[k]));
      } else for (let k = i; k < j; k++) html.push(line(rows[k]));
      i = j;
    }
    if (!rows.length) html.push('<tr><td colspan="4" style="padding:20px;text-align:center;font:12px var(--ui)">Both are empty.</td></tr>');
    tbody.innerHTML = html.join('');
    tbody.addEventListener('click', e => {
      const g = e.target.closest('tr[data-gap]');
      if (!g) return;
      const list = gaps.get(g.dataset.gap) || [];
      const tmp = root.ownerDocument.createElement('tbody');
      tmp.innerHTML = list.map(line).join('');
      g.replaceWith(...Array.from(tmp.children));
    });
    body.append(table);
    const first = tbody.querySelector('tr.del,tr.add,tr.chg');
    if (first) body.scrollTop = Math.max(0, first.offsetTop - 60);
  }
  drawBody();
  return { title: 'Compare: ' + a.name + ' and ' + b.name + ' - Duplicate Finder' };
}
