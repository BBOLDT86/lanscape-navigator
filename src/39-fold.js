/* ===================================================================
   Duplicates and versions. Exact copies, revisions ("v2", "Rev 3",
   "_final", "(1)", dated saves) and near-identical look-alikes fold into
   one entry, normally the newest; the others stay reachable as its
   versions. Songs, videos and pictures that are the same thing show once.
   =================================================================== */
const FOLD_LEVELS = { off: 0, copies: 1, normal: 2, loose: 3 };
const foldLevel = () => (Object.prototype.hasOwnProperty.call(FOLD_LEVELS, S.prefs.fold) ? FOLD_LEVELS[S.prefs.fold] : 2);
const isFolded = d => !!(d && d.fold && d.fold.primary !== d);
const foldMain = d => (d && d.fold ? d.fold.primary : d);
/** everything that shows in lists: one entry per set of duplicates */
const docsShown = () => docsAll().filter(d => !isFolded(d));
// these names alone don't say two files are the same thing ("notes.html" in two folders)
const GENERIC_BASE = new Set(('index default home untitled document doc page new test temp tmp file download image img screenshot scan readme notes note todo main app tool ' +
  'dashboard report draft copy backup output export data sheet book workbook presentation deck slides memo letter list log video clip movie song track audio photo picture').split(' '));
const LOSSLESS = new Set(['flac', 'wav', 'wave', 'aif', 'aiff', 'alac', 'ape']);
const NATIVE_VIDEO = new Set(['mp4', 'm4v', 'webm', 'mov', 'ogv']);
const FOLD_REASON = { copy: 'Exact copies', version: 'Versions', similar: 'Look-alikes', song: 'Same song', video: 'Same video', picture: 'Same picture', manual: 'Joined by you' };
const REASON_RANK = { manual: 6, copy: 5, version: 4, similar: 3, song: 2, video: 2, picture: 2 };
function foldClass(d) {
  if (isSiteKind(d)) return 'site';
  if (d.kind === 'audio' || d.kind === 'video' || d.kind === 'image') return d.kind;
  return 'file';
}
/* ---------------- what LANscape knows about each file, for comparing ---------------- */
function foldFeat(d) {
  const m = d.meta || {};
  const key = d.mtime + '|' + d.size + '|' + (m.deepFor || 0) + '|' + ((m.deep || '').length) + '|' + (m.title || '') + '|' + d.path + '|' + (S.prefs.scriptIndex ? 1 : 0);
  let f = d._ff;
  if (f && f.key === key) return f;
  const n = parseVersion(d.name, true), t = parseVersion(m.title || '', false);
  f = { key, n, t, num: n.num != null ? n.num : t.num, label: n.label || t.label, copy: n.copy || t.copy, marked: n.marked || t.marked, fp: null, ids: null, sig: null };
  d._ff = f;
  return f;
}
// words become small numbers so two files can be compared quickly (stable for the whole session)
const STEM_ID = new Map();
function foldIds(d, f) {
  if (f.ids) return f.ids;
  const out = [];
  if (d.tf) {
    for (const s of d.tf.keys()) {
      if (s.length < 3 || /\d/.test(s)) continue;
      let id = STEM_ID.get(s);
      if (id == null) { id = STEM_ID.size + 1; STEM_ID.set(s, id); }
      out.push(id);
    }
  }
  out.sort((a, b) => a - b);
  f.ids = Int32Array.from(out);
  f.sig = ophSig(f.ids);
  return f.ids;
}
function mix32(x) { x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); return (x ^ (x >>> 16)) >>> 0; }
/** one-permutation MinHash: 64 bins, so look-alikes can be found without comparing every pair */
function ophSig(ids) {
  const B = 64, raw = new Int32Array(B).fill(-1);
  for (let i = 0; i < ids.length; i++) {
    const h = mix32(Math.imul(ids[i], 0x9e3779b1) >>> 0);
    const b = h >>> 26, v = h & 0x3ffffff;
    if (raw[b] < 0 || v < raw[b]) raw[b] = v;
  }
  const sig = Int32Array.from(raw);
  // an empty bin borrows from the next full one, so two equal sets still match bin for bin
  for (let b = 0; b < B; b++) {
    if (raw[b] >= 0) continue;
    for (let k = 1; k < B; k++) { const j = (b + k) % B; if (raw[j] >= 0) { sig[b] = (raw[j] + k * 977) & 0x3ffffff; break; } }
  }
  return sig;
}
function jaccard(a, b) {
  if (!a || !b || !a.length || !b.length) return 0;
  let i = 0, j = 0, inter = 0;
  while (i < a.length && j < b.length) { if (a[i] === b[j]) { inter++; i++; j++; } else if (a[i] < b[j]) i++; else j++; }
  return inter / (a.length + b.length - inter);
}
const wordSet = s => new Set(String(s || '').split(' ').filter(w => w && !NAME_STOP.has(w)));
function setOverlap(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / (a.size + b.size - n);
}
function titleOverlap(A, B) {
  const fa = foldFeat(A), fb = foldFeat(B);
  return Math.max(setOverlap(wordSet(fa.t.base), wordSet(fb.t.base)), setOverlap(wordSet(fa.n.base), wordSet(fb.n.base)));
}
/** "Cayenne Tracker" and "Cayenne 958 Tracker": words added or dropped, none swapped for another number */
function renamedVersion(A, B) {
  const fa = foldFeat(A), fb = foldFeat(B);
  for (const [x, y] of [[fa.t.base, fb.t.base], [fa.n.base, fb.n.base]]) {
    const wa = wordSet(x), wb = wordSet(y);
    if (wa.size < 2 || wb.size < 2 || setOverlap(wa, wb) < 0.66) continue;
    const onlyA = [...wa].filter(w => !wb.has(w)), onlyB = [...wb].filter(w => !wa.has(w));
    if (onlyA.some(w => /\d/.test(w)) && onlyB.some(w => /\d/.test(w))) continue;
    if (onlyA.length && onlyB.length && onlyA.length + onlyB.length > 2) continue;
    return true;
  }
  return false;
}
/** pages and documents: identical text and size means an exact copy */
function siteFp(d, f) {
  if (f.fp == null) {
    const m = d.meta || {};
    // the title is left out: it's often made up from the file name ("Budget (1)"), and a page's own <title> is
    // inside its bytes anyway, so the size and the text already tell
    f.fp = d.kind + ':' + d.size + ':' + hash32((m.body || '') + '\u0001' + (m.headings || '') + '\u0001' + String(m.script || '').slice(0, 20000) + '\u0001' + (m.words || 0)).toString(36);
  }
  return f.fp;
}
/** songs: the same artist and title (remasters and "explicit" tags aside) */
function songKey(d) {
  const m = d.meta || {};
  const ti = normName(String(m.title || '').replace(/\s*[\[(](?:\d{4}\s*)?(?:remaster(?:ed)?|explicit|clean|album version|bonus track|deluxe(?: edition)?|mono|stereo|lp version|single version)[^\])]*[\])]/gi, '').replace(/\s+-\s+(?:\d{4}\s+)?remaster(?:ed)?.*$/i, ''));
  if (!ti || GENERIC_BASE.has(ti)) return null;
  const art = normName(m.artist || '');
  return (art && art !== 'unknown artist' ? art : 'folder:' + d.dir) + '|' + ti;
}
/** videos: the same episode of a series, or the same title and year */
function videoKey(d) {
  const m = d.meta || {};
  if (m.series && m.episode) return 'tv|' + normName(m.series) + '|' + (m.season || 0) + '|' + m.episode;
  const ti = normName(m.title || '');
  if (!ti || GENERIC_BASE.has(ti) || ti.replace(/[^a-z]/g, '').length < 3) return null;
  return 'mv|' + ti + '|' + (m.year || '');
}
const picStem = d => parseVersion(d.name, true).base.replace(/\b(small|medium|large|thumb|thumbnail|web|edited|edit|scaled|resized|compressed|hires|lowres|min|optimized|preview|\d{2,5}x\d{2,5}|\d+px|[1-4]x)\b/g, ' ').replace(/\s+/g, ' ').trim();
function hamming64(a, b) {
  let n = 0;
  for (let k = 0; k < 16; k += 8) { let x = (parseInt(a.slice(k, k + 8), 16) ^ parseInt(b.slice(k, k + 8), 16)) >>> 0; while (x) { x &= x - 1; n++; } }
  return n;
}
const videoRank = d => (NATIVE_VIDEO.has(d.ext) && d.meta.playable !== false ? 3 : MKV_EXT.test(d.ext) && d.meta.playable !== false ? 2 : d.meta.playable === false ? 0 : 1);
/** the member whose key (a list of numbers, compared in order) is biggest */
function bestBy(list, key) {
  let best = null, bk = null;
  for (const d of list) {
    const k = key(d);
    let better = !bk;
    if (bk) for (let i = 0; i < k.length; i++) { if (k[i] > bk[i]) { better = true; break; } if (k[i] < bk[i]) break; }
    if (better) { best = d; bk = k; }
  }
  return best;
}
/** siblings in a series ("Week 4", "Week 5"): the number that tells them apart orders them, and labels them */
function seriesSeq(members) {
  for (const w of ['t', 'n']) {
    const fs = members.map(d => foldFeat(d)[w]);
    if (!fs[0].skel || fs.some(f => f.skel !== fs[0].skel)) continue;
    const toks = fs.map(f => f.base.split(' '));
    for (let i = toks[0].length - 1; i >= 0; i--) {
      if (!/^\d+$/.test(toks[0][i])) continue;
      const vals = toks.map(t => +t[i]);
      if (new Set(vals).size < 2) continue;
      const prev = i > 0 && /^[a-z]{2,}$/.test(toks[0][i - 1]) && !NAME_STOP.has(toks[0][i - 1]) ? nameToken(toks[0][i - 1], 1, false) + ' ' : '#';
      return new Map(members.map((d, k) => [d, { seq: vals[k], label: prev + vals[k] }]));
    }
  }
  return null;
}
/** the website folder (a folder with an index page) a page belongs to: the outermost one, like buildSites */
function siteDirOf(path, gdirs) {
  if (!gdirs.size) return null;
  const parts = path.split('/');
  let acc = parts[0] + '/';
  for (let i = 1; i < parts.length - 1; i++) { acc += parts[i] + '/'; if (gdirs.has(acc)) return acc; }
  return null;
}
/* ---------------- grouping ---------------- */
function foldUF(n) {
  const p = new Int32Array(n);
  for (let i = 0; i < n; i++) p[i] = i;
  const find = x => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; };
  return { find, union(a, b) { a = find(a); b = find(b); if (a === b) return false; p[b] = a; return true; } };
}
const pushTo = (m, k, v) => { const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); };
/**
 * Decide which files are the same thing. Sets d.fold (the group: members, primary, why), d.vno (version
 * number, oldest = 1) and d.vlabel ("Rev 3", "Copy", a date). Returns true when the groups changed.
 */
function foldDuplicates(docs) {
  const level = foldLevel();
  const before = S.foldSig || '';
  for (const d of docs) { d.fold = null; d.vno = 0; d.vlabel = ''; d.vsub = null; d.vtwin = null; }
  S.folds = new Map();
  S.foldDirs = new Map();
  S.foldStats = { groups: 0, folded: 0, copies: 0, wasted: 0, byClass: {} };
  if (!level) { S.foldSig = ''; return before !== ''; }
  const rules = S.foldRules || {};
  const split = new Set(rules.split || []);
  const pool = docs.filter(d => !d.demo && !d.asset && !split.has(d.path));
  // pages inside a website folder belong to that website: they never fold
  const gdirs = groupDirs(pool.filter(d => d.kind === 'html').map(d => d.path));
  const items = pool.filter(d => !(isSiteKind(d) && underGroup(d.path, gdirs)));
  const N = items.length;
  const uf = foldUF(N), edges = [];
  const link = (a, b, reason, sim) => { if (a === b) return; uf.union(a, b); edges.push([a, b, reason, sim]); };
  const cls = items.map(foldClass);
  // 1. exact copies: same text and size (pages, documents) or the same bytes (everything else)
  const byFp = new Map();
  for (let i = 0; i < N; i++) {
    const d = items[i];
    const fp = cls[i] === 'site' ? siteFp(d, foldFeat(d)) : (d.meta.qh && d.meta.qhFor === d.mtime ? cls[i] + ':' + d.meta.qh : null);
    if (!fp) continue;
    const l = byFp.get(fp);
    if (l) { link(l[0], i, 'copy', 1); l.push(i); } else byFp.set(fp, [i]);
  }
  if (level >= 2) {
    // 2. versions: the same name once "v2", "Rev 3", "_final", "(1)" and dates come off
    const site = [];
    for (let i = 0; i < N; i++) if (cls[i] === 'site') site.push(i);
    const byBase = new Map(), bySkel = new Map();
    for (const i of site) {
      const d = items[i], f = foldFeat(d);
      for (const [w, v] of [['n', f.n], ['t', f.t]]) {
        if (!v.base || v.base.replace(/[^a-z0-9]/g, '').length < 3) continue;
        pushTo(byBase, d.kind + '|' + w + '|' + v.base, i);
        if (v.skel !== v.base) pushTo(bySkel, d.kind + '|' + w + '|' + v.skel, i);
      }
    }
    const loose = level >= 3;
    const tMarked = loose ? 0.1 : 0.2, tPlain = loose ? 0.3 : 0.4, tGeneric = loose ? 0.5 : 0.6, tNumber = loose ? 0.7 : 0.85;
    const sim = (a, b) => { const A = items[a], B = items[b]; return jaccard(foldIds(A, foldFeat(A)), foldIds(B, foldFeat(B))); };
    const small = i => foldIds(items[i], foldFeat(items[i])).length < 15;
    for (const [key, list] of byBase) {
      if (list.length < 2 || list.length > 400) continue;
      const base = key.split('|').slice(2).join('|');
      const generic = GENERIC_BASE.has(base) || base.replace(/[^a-z]/g, '').length < 4;
      for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
        const a = list[x], b = list[y];
        if (uf.find(a) === uf.find(b)) continue;
        const A = items[a], B = items[b], fa = foldFeat(A), fb = foldFeat(B);
        const s = sim(a, b), tiny = small(a) || small(b), sameDir = A.dir === B.dir;
        let ok;
        if (generic) ok = s >= tGeneric;
        else if (fa.marked || fb.marked) ok = s >= tMarked || tiny || sameDir;
        else ok = s >= tPlain || (tiny && sameDir);
        if (ok) link(a, b, 'version', s);
      }
    }
    // "Week 4" and "Week 5", "Model 3" and "Model 5": only when they're nearly the same anyway
    for (const [key, list] of bySkel) {
      if (list.length < 2 || list.length > 200) continue;
      const base = key.split('|').slice(2).join('|');
      if (GENERIC_BASE.has(base.replace(/#/g, '').trim())) continue;
      for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
        const a = list[x], b = list[y];
        if (uf.find(a) === uf.find(b) || small(a) || small(b)) continue;
        const s = sim(a, b);
        if (s >= tNumber) link(a, b, 'version', s);
      }
    }
    // 3. look-alikes: nearly the same words, found with MinHash bands instead of comparing every pair
    const bands = new Map();
    for (const i of site) {
      const d = items[i], f = foldFeat(d);
      foldIds(d, f);
      if (f.ids.length < 25) continue;
      for (let b = 0; b < 16; b++) pushTo(bands, d.kind + ':' + b + ':' + f.sig[b * 4] + ',' + f.sig[b * 4 + 1] + ',' + f.sig[b * 4 + 2] + ',' + f.sig[b * 4 + 3], i);
    }
    const tSim = loose ? 0.78 : 0.9, tTitle = loose ? 0.34 : 0.5, tNear = loose ? 0.5 : 0.6;
    const tried = new Set();
    for (const list of bands.values()) {
      if (list.length < 2) continue;
      const heads = list.length > 60 ? [list[0]] : list;
      for (const a of heads) for (const b of list) {
        if (a === b || uf.find(a) === uf.find(b)) continue;
        const k = a < b ? a + ':' + b : b + ':' + a;
        if (tried.has(k)) continue;
        tried.add(k);
        const s = sim(a, b);
        if (s >= tSim && titleOverlap(items[a], items[b]) >= tTitle) link(a, b, 'similar', s);
        // a renamed revision: mostly the same words and nearly the same name ("Cayenne Tracker" and "Cayenne 958 Tracker v3"),
        // but never two numbered things ("Cabin B210" and "Cabin B212")
        else if (s >= tNear && renamedVersion(items[a], items[b])) link(a, b, 'version', s);
      }
    }
    // 4. songs, videos and pictures that are the same thing in another file
    const songs = new Map(), vids = new Map(), pics = new Map();
    for (let i = 0; i < N; i++) {
      if (cls[i] === 'audio') { const k = songKey(items[i]); if (k) pushTo(songs, k, i); }
      else if (cls[i] === 'video') { const k = videoKey(items[i]); if (k) pushTo(vids, k, i); }
      else if (cls[i] === 'image' && items[i].meta.dhash && items[i].meta.dhashFor === items[i].mtime) { const k = picStem(items[i]); if (k) pushTo(pics, k, i); }
    }
    const near = (x, y, tol) => !x || !y || Math.abs(x - y) <= tol;
    for (const list of songs.values()) for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
      const A = items[list[x]], B = items[list[y]];
      if (near(A.meta.duration, B.meta.duration, 3) && (A.meta.duration && B.meta.duration || A.dir === B.dir || normName(A.meta.album || '') === normName(B.meta.album || ''))) link(list[x], list[y], 'song', 1);
    }
    for (const list of vids.values()) for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
      const A = items[list[x]], B = items[list[y]];
      const dA = A.meta.duration || 0, dB = B.meta.duration || 0;
      if (!dA || !dB || Math.abs(dA - dB) <= Math.max(3, 0.05 * Math.max(dA, dB))) link(list[x], list[y], 'video', 1);
    }
    const tPic = loose ? 6 : 3;
    for (const list of pics.values()) for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
      if (hamming64(items[list[x]].meta.dhash, items[list[y]].meta.dhash) <= tPic) link(list[x], list[y], 'picture', 1);
    }
  }
  // 5. files you said are the same
  const at = new Map(items.map((d, i) => [d.path, i]));
  for (const [p, q] of rules.join || []) { const a = at.get(p), b = at.get(q); if (a != null && b != null && cls[a] === cls[b]) link(a, b, 'manual', 1); }
  // build the groups
  const comps = new Map();
  for (let i = 0; i < N; i++) pushTo(comps, uf.find(i), i);
  const byRoot = new Map();
  for (const e of edges) pushTo(byRoot, uf.find(e[0]), e);
  const keep = rules.keep || [];
  const sigParts = [];
  for (const [root, list] of comps) {
    if (list.length < 2) continue;
    const members = list.map(i => items[i]);
    const c = cls[list[0]];
    const g = { id: '', cls: c, members, primary: null, reason: 'copy', why: new Map(), copies: 0, wasted: 0, series: false };
    // versions are ordered by their numbers when every one has one ("Rev 3", "v2", "_4"), or by the number that
    // tells siblings in a series apart ("Week 5"); otherwise by date
    const allNum = c === 'site' && members.every(d => foldFeat(d).num != null);
    const ser = c === 'site' && !allNum ? seriesSeq(members) : null;
    const ord = d => (allNum ? foldFeat(d).num : ser ? ser.get(d).seq : null);
    g.series = !!ser;
    // the main entry: the one you picked, else the newest version (or the best copy of a song or video)
    let p = null;
    for (let k = keep.length - 1; k >= 0 && !p; k--) p = members.find(x => x.path === keep[k]) || null;
    if (!p) {
      if (c === 'audio') p = bestBy(members, d => [LOSSLESS.has(d.ext) ? 1 : 0, d.meta.bitrate || 0, d.meta.artKey ? 1 : 0, d.mtime || 0]);
      else if (c === 'video') p = bestBy(members, d => [videoRank(d), d.meta.height || 0, d.size || 0, d.mtime || 0]);
      else if (c === 'image') p = bestBy(members, d => [d.size || 0, -foldFeat(d).copy, -d.depth, -(d.mtime || 0)]);
      else if (c === 'file') p = bestBy(members, d => [-foldFeat(d).copy, foldFeat(d).marked ? 0 : 1, -d.depth, -(S.firstSeen[d.path] || d.mtime || 0)]);
      else {
        p = bestBy(members, d => (ord(d) != null ? [ord(d), d.mtime || 0] : [d.mtime || 0, foldFeat(d).num || 0, d.size || 0]));
        // of identical copies of that version, the one with the plainest name and shortest path
        const fp = siteFp(p, foldFeat(p));
        const same = members.filter(d => siteFp(d, foldFeat(d)) === fp);
        if (same.length > 1) p = bestBy(same, d => [-foldFeat(d).copy, foldFeat(d).n.state ? 0 : 1, -d.depth, -d.path.length]);
      }
    }
    g.primary = p;
    // version order: oldest first (numbers win when every file has one)
    if (c === 'site') members.sort((a, b) => (ord(a) != null ? ord(a) - ord(b) : 0) || (a.mtime || 0) - (b.mtime || 0) || a.path.localeCompare(b.path));
    else members.sort((a, b) => (a === p ? -1 : b === p ? 1 : a.path.localeCompare(b.path)));
    // why each one is here, and what's identical to what
    const es = byRoot.get(root) || [];
    let top = null;
    for (const [a, b, reason, s] of es) {
      if (!top || REASON_RANK[reason] > REASON_RANK[top]) top = reason;
      for (const [x, y] of [[a, b], [b, a]]) {
        const dx = items[x];
        const old = g.why.get(dx);
        if (!old || REASON_RANK[reason] > REASON_RANK[old.reason]) g.why.set(dx, { reason, sim: s, other: items[y] });
      }
    }
    // the group is described by its most common link, not its strongest one
    const count = {};
    for (const e of es) count[e[2]] = (count[e[2]] || 0) + 1;
    g.reason = Object.keys(count).sort((x, y) => count[y] - count[x] || REASON_RANK[y] - REASON_RANK[x])[0] || top || 'copy';
    const fpSeen = new Map();
    members.forEach((d, i) => {
      d.fold = g;
      d.vno = i + 1;
      const f = foldFeat(d);
      const fp = c === 'site' ? siteFp(d, f) : d.meta.qh && d.meta.qhFor === d.mtime ? d.meta.qh : null;
      const twin = fp ? fpSeen.get(fp) : null;
      if (twin) { g.copies++; g.wasted += d.size || 0; } else if (fp) fpSeen.set(fp, d);
      d.vtwin = twin || null;
      d.vlabel = c === 'site' ? (f.label || (ser ? ser.get(d).label : '') || (twin ? 'Copy' : '') || fmtDate(d.mtime)) :
        c === 'audio' ? (d.ext || '').toUpperCase() + (d.meta.bitrate ? ' · ' + d.meta.bitrate + ' kbps' : '') :
        c === 'video' ? (d.ext || '').toUpperCase() + (d.meta.height ? ' · ' + d.meta.height + 'p' : '') :
        (d.ext || '').toUpperCase() + ' · ' + fmtBytes(d.size || 0);
    });
    g.id = 'g' + hash32(members.map(d => d.path).sort().join('\u0001')).toString(36);
    S.folds.set(g.id, g);
    const st = S.foldStats;
    st.groups++; st.folded += members.length - 1; st.copies += g.copies; st.wasted += g.wasted;
    st.byClass[c] = (st.byClass[c] || 0) + 1;
    sigParts.push(p.path + '<' + members.map(d => d.path).join('|'));
  }
  if (gdirs.size > 1) foldWebsites(pool, gdirs, level, rules, sigParts);
  S.foldSig = sigParts.length ? String(sigParts.length) + ':' + hash32(sigParts.sort().join('\n')).toString(36) : '';
  return S.foldSig !== before;
}
/**
 * Website folders (a folder with an index page and the pages it links to): a copied or backed-up folder is the
 * same website, so the whole folder folds into the main one. Its pages stay reachable under
 * www.site.com/versions/2/...
 */
function foldWebsites(pool, gdirs, level, rules, sigParts) {
  const keep = rules.keep || [];
  const W = new Map();
  for (const d of pool) {
    if (!isSiteKind(d)) continue;
    const dir = siteDirOf(d.path, gdirs);
    if (!dir) continue;
    let w = W.get(dir);
    if (!w) W.set(dir, w = { dir, pages: [], byRel: new Map(), entry: null });
    w.pages.push(d);
    w.byRel.set(d.path.slice(dir.length).toLowerCase(), d);
  }
  const list = [];
  for (const w of W.values()) {
    w.entry = w.pages.find(d => d.dir === w.dir && isIndexName(d.name)) || null;
    if (!w.entry) continue;                                 // its index page was split off by you
    w.name = w.dir.split('/').filter(Boolean).pop() || '';
    w.pv = parseVersion(w.name, false);
    w.mtime = Math.max(0, ...w.pages.map(d => d.mtime || 0));
    w.size = w.pages.reduce((a, d) => a + (d.size || 0), 0);
    w.depth = w.dir.split('/').length;
    w.i = list.length;
    list.push(w);
  }
  if (list.length < 2) return;
  // candidates: the same front page, the same title, or the same folder name once "copy" and "v2" come off
  const buckets = new Map();
  for (const w of list) {
    const e = w.entry;
    pushTo(buckets, 'fp:' + siteFp(e, foldFeat(e)), w);
    const tb = foldFeat(e).t.base;
    if (tb && tb.replace(/[^a-z]/g, '').length >= 4 && !GENERIC_BASE.has(tb)) pushTo(buckets, 't:' + tb, w);
    if (w.pv.base && w.pv.base.replace(/[^a-z]/g, '').length >= 4 && !GENERIC_BASE.has(w.pv.base) && !FOLDER_SKIP.test(w.pv.base)) pushTo(buckets, 'n:' + w.pv.base, w);
  }
  const uf = foldUF(list.length), info = new Map();
  const ids = d => foldIds(d, foldFeat(d));
  const tPage = level >= 3 ? 0.5 : 0.6, tSite = level >= 3 ? 0.4 : 0.6;
  for (const ws of buckets.values()) {
    if (ws.length < 2 || ws.length > 50) continue;
    for (let x = 0; x < ws.length; x++) for (let y = x + 1; y < ws.length; y++) {
      const a = ws[x], b = ws[y];
      if (uf.find(a.i) === uf.find(b.i)) continue;
      let same = 0, exact = 0;
      for (const [rel, pa] of a.byRel) {
        const pb = b.byRel.get(rel);
        if (!pb) continue;
        if (siteFp(pa, foldFeat(pa)) === siteFp(pb, foldFeat(pb))) { same++; exact++; } else if (level >= 2 && jaccard(ids(pa), ids(pb)) >= tPage) same++;
      }
      const all = Math.max(a.pages.length, b.pages.length);
      const identical = exact === a.pages.length && exact === b.pages.length;
      const ea = a.entry, eb = b.entry;
      const front = siteFp(ea, foldFeat(ea)) === siteFp(eb, foldFeat(eb)) || jaccard(ids(ea), ids(eb)) >= 0.5;
      if (identical || (level >= 2 && front && same / all >= tSite)) {
        uf.union(a.i, b.i);
        info.set(a.i + ':' + b.i, { exact: identical, sim: same / all });
      }
    }
  }
  const comps = new Map();
  for (const w of list) pushTo(comps, uf.find(w.i), w);
  for (const ws of comps.values()) {
    if (ws.length < 2) continue;
    const pairs = [];
    for (let x = 0; x < ws.length; x++) for (let y = 0; y < ws.length; y++) { const o = info.get(ws[x].i + ':' + ws[y].i); if (o) pairs.push([ws[x], ws[y], o]); }
    const allExact = pairs.every(p => p[2].exact);
    const allNum = ws.every(w => w.pv.num != null);
    // the main one: the one you picked, else the plainest name among identical copies, else the newest
    let pw = null;
    for (let k = keep.length - 1; k >= 0 && !pw; k--) pw = ws.find(w => keep[k].startsWith(w.dir)) || null;
    if (!pw) pw = allExact ? bestBy(ws, w => [-w.pv.copy, w.pv.state ? 0 : 1, -w.depth, -w.dir.length]) : bestBy(ws, w => (allNum ? [w.pv.num, w.mtime] : [w.mtime, -w.pv.copy]));
    ws.sort((a, b) => (allNum ? a.pv.num - b.pv.num : 0) || (allExact ? (a === pw ? -1 : b === pw ? 1 : 0) : a.mtime - b.mtime) || a.dir.localeCompare(b.dir));
    const members = ws.map(w => w.entry);
    const g = { id: '', cls: 'site', whole: true, members, primary: pw.entry, reason: allExact ? 'copy' : 'version', why: new Map(), copies: 0, wasted: 0, dirs: new Map(), pages: 0 };
    for (const [a, b, o] of pairs) for (const [x, y] of [[a, b], [b, a]]) if (!g.why.has(x.entry) || y === pw) g.why.set(x.entry, { reason: o.exact ? 'copy' : 'version', sim: o.sim, other: y.entry });
    ws.forEach((w, i) => {
      g.dirs.set(w.entry, w);
      const label = w.pv.label || (allExact && w !== pw ? 'Copy' : '') || fmtDate(w.mtime);
      const exactTwin = w !== pw && pairs.some(p => p[0] === w && p[2].exact);
      if (exactTwin) { g.copies++; g.wasted += w.size; }
      if (w !== pw) S.foldDirs.set(w.dir, { g, vno: i + 1, w });
      for (const d of w.pages) {
        if (w === pw && d !== w.entry) continue;        // the main website's own pages stay as they are
        d.fold = g;
        d.vno = i + 1;
        d.vlabel = label;
        d.vsub = d === w.entry ? '' : d.path.slice(w.dir.length);
        d.vtwin = null;
        if (w !== pw) g.pages++;
      }
    });
    g.id = 'g' + hash32(members.map(d => d.path).sort().join('\u0001')).toString(36);
    S.folds.set(g.id, g);
    const st = S.foldStats;
    st.groups++; st.folded += ws.length - 1; st.copies += g.copies; st.wasted += g.wasted;
    st.byClass.site = (st.byClass.site || 0) + 1;
    sigParts.push('W' + pw.dir + '<' + ws.map(w => w.dir).join('|'));
  }
}
/** a short "why" for a member of a group */
function foldWhy(d) {
  const g = d && d.fold;
  if (!g) return '';
  if (d === g.primary) {
    const n = g.members.length - 1, copies = g.cls !== 'site' || g.reason === 'copy';
    return n + ' other ' + (copies ? (n > 1 ? 'copies' : 'copy') : (n > 1 ? 'versions' : 'version'));
  }
  const w = g.why.get(d);
  if (!w) return FOLD_REASON[g.reason] || '';
  if (d.vtwin || w.reason === 'copy') return 'Exact copy' + (d.vtwin ? ' of ' + (g.cls === 'site' && d.vtwin.vlabel && !/^Copy/.test(d.vtwin.vlabel) ? d.vtwin.vlabel : d.vtwin.name) : '');
  if (w.reason === 'version' || w.reason === 'similar') return (w.reason === 'version' ? 'Same name, ' : 'Look-alike, ') + Math.round((w.sim || 0) * 100) + '% the same words';
  return FOLD_REASON[w.reason] || '';
}
/* ---------------- your corrections ---------------- */
function foldRules() { S.foldRules = S.foldRules || {}; for (const k of ['split', 'join', 'keep']) if (!Array.isArray(S.foldRules[k])) S.foldRules[k] = []; return S.foldRules; }
function foldRefresh() { saveState(); rebuildAll(); afterFolderChange(); if (typeof FolderManager !== 'undefined') FolderManager.refresh(); }
/** make this file the main entry of its group */
function foldKeep(path) { const r = foldRules(); r.keep = r.keep.filter(p => p !== path).concat([path]).slice(-500); foldRefresh(); }
/** this file is its own thing: take it out of its group */
function foldSplit(path) { const r = foldRules(); if (!r.split.includes(path)) r.split.push(path); r.join = r.join.filter(([a, b]) => a !== path && b !== path); foldRefresh(); }
/** put a file back in with its look-alikes */
function foldUnsplit(path) { const r = foldRules(); r.split = r.split.filter(p => p !== path); foldRefresh(); }
/** these two are the same thing */
function foldJoin(a, b) { const r = foldRules(); r.split = r.split.filter(p => p !== a && p !== b); if (!r.join.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) r.join.push([a, b]); foldRefresh(); }
/** every member of a group stands alone again */
function foldUnfold(g) { const r = foldRules(); for (const d of g.members) if (!r.split.includes(d.path)) r.split.push(d.path); foldRefresh(); }

/* ---------------- fingerprints, read in the background ---------------- */
const Fingerprinter = (() => {
  let busy = false, again = false;
  const CHUNK = 65536;
  const readable = d => S.fh.has(d.path) || S.live.has(d.path) || d.root === VROOT;
  /** size plus a hash of the first and last 64K: enough to tell copies apart, quick even for big videos */
  async function quickHash(d) {
    const b = await getBlob(d);
    const parts = b.size <= CHUNK * 2 ? [b] : [b.slice(0, CHUNK), b.slice(b.size - CHUNK)];
    let h1 = 0x811c9dc5, h2 = 0x9e3779b9;
    for (const p of parts) {
      const u = new Uint8Array(await p.arrayBuffer());
      for (let i = 0; i < u.length; i++) { h1 = Math.imul(h1 ^ u[i], 0x01000193); h2 = Math.imul(h2 ^ u[i], 0x5bd1e995); h2 ^= h2 >>> 15; }
    }
    return b.size.toString(36) + '-' + (h1 >>> 0).toString(36) + '-' + (h2 >>> 0).toString(36);
  }
  /** a 64-bit "difference hash" of a picture: resized or re-saved copies come out (nearly) the same */
  async function dHash(d) {
    const blob = await getBlob(d);
    let bmp;
    try { bmp = await createImageBitmap(blob, { resizeWidth: 9, resizeHeight: 8, resizeQuality: 'medium' }); } catch (e) { return null; }
    const cv = document.createElement('canvas');
    cv.width = 9; cv.height = 8;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.drawImage(bmp, 0, 0, 9, 8);
    if (bmp.close) bmp.close();
    const px = c.getImageData(0, 0, 9, 8).data;
    let hi = 0, lo = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const i = (y * 9 + x) * 4, j = i + 4;
      const bit = px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114 > px[j] * 299 + px[j + 1] * 587 + px[j + 2] * 114 ? 1 : 0;
      if (y < 4) hi = (hi << 1) | bit; else lo = (lo << 1) | bit;
    }
    return (hi >>> 0).toString(16).padStart(8, '0') + (lo >>> 0).toString(16).padStart(8, '0');
  }
  /** files that might be copies (same size) or resized pictures (same name) and haven't been fingerprinted yet */
  function todo() {
    const docs = docsAll().filter(d => !d.demo && !d.asset && foldClass(d) !== 'site' && readable(d));
    const bySize = new Map(), byStem = new Map();
    for (const d of docs) {
      if (d.size > 0) pushTo(bySize, foldClass(d) + ':' + d.size, d);
      if (d.kind === 'image' && d.ext !== 'svg') { const k = picStem(d); if (k) pushTo(byStem, k, d); }
    }
    const qh = [], dh = [];
    for (const l of bySize.values()) if (l.length > 1) for (const d of l) if (!(d.meta.qh && d.meta.qhFor === d.mtime)) qh.push(d);
    for (const l of byStem.values()) if (l.length > 1) for (const d of l) if (!(d.meta.dhash && d.meta.dhashFor === d.mtime) && !d.meta.dhashBad) dh.push(d);
    return { qh, dh };
  }
  async function run(prog) {
    if (busy) { again = true; return 0; }
    if (!foldLevel()) return 0;
    busy = true;
    let found = 0;
    const recs = [];
    try {
      const { qh, dh } = todo();
      const total = qh.length + dh.length;
      let done = 0;
      for (const d of qh) {
        if (prog && prog.cancelled) break;
        try { d.meta.qh = await quickHash(d); d.meta.qhFor = d.mtime; found++; recs.push(d); } catch (e) { /* can't read it right now */ }
        if (prog && ++done % 5 === 0) prog.update(done / total, 'Comparing files...', d.name);
        if (done % 25 === 0) await sleep(0);
      }
      for (const d of dh) {
        if (prog && prog.cancelled) break;
        try { const h = await dHash(d); if (h) { d.meta.dhash = h; d.meta.dhashFor = d.mtime; found++; recs.push(d); } else d.meta.dhashBad = true; } catch (e) { d.meta.dhashBad = true; }
        if (prog && ++done % 3 === 0) prog.update(done / total, 'Looking at pictures...', d.name);
        if (done % 10 === 0) await sleep(0);
      }
      const known = recs.filter(isKnownDoc).map(metaRecord);
      if (known.length) await DB.putMany('meta', known);
    } finally { busy = false; }
    if (found) rebuildSoon();
    if (again) { again = false; kick(); }
    return found;
  }
  const kick = debounce(() => { run().catch(e => console.warn(e)); }, 2500);
  return { run, kick, quickHash, dHash, todo };
})();
