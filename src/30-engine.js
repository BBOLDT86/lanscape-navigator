/* ===================================================================
   Engine: inverted index + BM25F search, TF-IDF similarity,
   Louvain web rings, and the fake DNS
   =================================================================== */
const FIELD_W = { title: 5, file: 3, kw: 3, desc: 2, head: 2, body: 1, deep: 1, script: 0.6 };
const FIELD_CAP = { title: 400, file: 400, kw: 3000, desc: 1500, head: 8000, body: 60000, deep: 60000, script: 50000 };

function fileText(doc) {
  const rel = doc.path.split('/').slice(1).join(' ');
  return rel.replace(/\.[a-z0-9]+$/i, '').replace(/[_\-.\/]+/g, ' ');
}
function docFields(d) {
  const m = d.meta;
  return [['title', m.title], ['file', fileText(d)], ['kw', m.keywords], ['desc', m.desc], ['head', m.headings],
    ['body', m.body], ['deep', m.deep], ['script', S.prefs.scriptIndex ? m.script : '']];
}
function lowerText(d) {
  if (d._lc == null) {
    const m = d.meta;
    d._lc = normText([m.title, m.desc, m.headings, m.body, m.deep, m.script].filter(Boolean).join(' ').slice(0, 300000)).replace(/\s+/g, ' ');
  }
  return d._lc;
}

function buildIndex(docs) {
  const N = docs.length, df = new Map(), surf = new Map();
  let total = 0;
  for (let i = 0; i < N; i++) {
    const d = docs[i];
    d.ix = i; d._lc = null;
    const tf = new Map();
    let len = 0;
    for (const [f, txt] of docFields(d)) {
      if (!txt) continue;
      const w = FIELD_W[f];
      const toks = tokenize(txt.length > FIELD_CAP[f] ? txt.slice(0, FIELD_CAP[f]) : txt);
      const sw = f === 'script' || f === 'file' ? 0.2 : 1;
      for (const t of toks) {
        const s = stem(t);
        tf.set(s, (tf.get(s) || 0) + w);
        len += w;
        let sm = surf.get(s);
        if (!sm) surf.set(s, sm = new Map());
        sm.set(t, (sm.get(t) || 0) + sw);
      }
    }
    d.tf = tf; d.len = len || 1; total += d.len;
    for (const s of tf.keys()) df.set(s, (df.get(s) || 0) + 1);
  }
  const best = new Map();
  for (const [s, sm] of surf) {
    let bs = s, bc = -1;
    for (const [w, c] of sm) if (c > bc || (c === bc && w.length < bs.length)) { bc = c; bs = w; }
    best.set(s, bs);
  }
  const post = new Map();
  for (const d of docs) for (const [s, w] of d.tf) { let p = post.get(s); if (!p) post.set(s, p = []); p.push(d.ix, w); }
  // duplicates and old versions fold into one entry first, so twelve revisions of one tool
  // don't count as twelve pages when words are weighed (or when rings are drawn)
  const foldChanged = foldDuplicates(docs);
  // pages and documents are weighed against each other only, so a big music or photo
  // library doesn't change which pages look alike (and which rings they end up on)
  const dfS = new Map();
  let NS = 0;
  for (const d of docs) if (isSiteKind(d) && !isFolded(d)) { NS++; for (const s of d.tf.keys()) dfS.set(s, (dfS.get(s) || 0) + 1); }
  for (const d of docs) {
    const own = isSiteKind(d), DF = own ? dfS : df, NN = own ? NS : N;
    const maxDf = NN >= 6 ? Math.max(2, Math.floor(NN * 0.5)) : NN;
    const arr = [], kws = [];
    let normAll = 0;
    for (const [s, w] of d.tf) {
      const n = DF.get(s) || 1;
      const v = (1 + Math.log(w)) * Math.log((NN + 1) / n);
      if (v <= 0) continue;
      normAll += v * v;
      if (s.length > 2 || /\d/.test(s)) kws.push([s, v]);
      if (NN >= 4 && (n < 2 || n > maxDf)) continue;
      arr.push([s, v]);
    }
    arr.sort((a, b) => b[1] - a[1]);
    if (arr.length > 90) arr.length = 90;
    // normalise by the whole vocabulary (unique words included) so a page that shares
    // only one generic word with another page doesn't look similar to it
    const norm = Math.sqrt(normAll) || 1;
    d.vec = new Map();
    for (const [s, v] of arr) d.vec.set(s, v / norm);
    kws.sort((a, b) => b[1] - a[1]);
    d.kw = kws.slice(0, 18).map(x => x[0]);
    d.kwScore = kws.slice(0, 18).map(x => x[1]);
  }
  const vocab = Array.from(df.keys()).sort();
  const words = [];
  for (const [s, n] of df) { const w = best.get(s) || s; if (/^[a-z]{3,}$/.test(w)) words.push([w, n]); }
  return { docs, N, df, post, vocab, surf: best, words, avgLen: total / Math.max(1, N), foldChanged };
}
const surface = s => (S.ix && S.ix.surf.get(s)) || s;

function cos(a, b) {
  if (!a || !b) return 0;
  if (a.size > b.size) { const t = a; a = b; b = t; }
  let s = 0;
  for (const [k, v] of a) { const w = b.get(k); if (w) s += v * w; }
  return s;
}

/* ---------------- query parsing & BM25F ranking ---------------- */
function parseQuery(q) {
  const P = { terms: [], phrases: [], neg: [], site: '', ring: '', intitle: [], or: false, raw: String(q || '') };
  const re = /(-)?\b(site|ring|intitle|title):("([^"]*)"|\S+)|(-)?"([^"]*)"?|(\S+)/gi;
  let m;
  while ((m = re.exec(P.raw))) {
    if (m[2]) {
      const key = m[2].toLowerCase(), val = (m[4] != null ? m[4] : m[3]).trim();
      if (key === 'site') P.site = val.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
      else if (key === 'ring') P.ring = val.toLowerCase();
      else P.intitle.push(...tokenize(val).map(stem));
    } else if (m[6] != null) {
      const words = tokenize(m[6]);
      if (!words.length) continue;
      if (m[5]) P.neg.push(...words.map(stem));
      else { if (words.length > 1) P.phrases.push(normText(m[6]).replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()); P.terms.push(...words); }
    } else if (m[7]) {
      const w = m[7];
      if (w === 'OR' || w === '|') { P.or = true; continue; }
      if (w === 'AND' || w === '+') continue;
      const neg = w.length > 1 && w[0] === '-';
      const words = tokenize(neg ? w.slice(1) : w);
      if (neg) P.neg.push(...words.map(stem)); else P.terms.push(...words);
    }
  }
  return P;
}
function prefixStems(prefix, limit = 14) {
  const v = S.ix.vocab;
  let lo = 0, hi = v.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (v[mid] < prefix) lo = mid + 1; else hi = mid; }
  const out = [];
  for (let i = lo; i < v.length && v[i].startsWith(prefix) && out.length < 400; i++) out.push(v[i]);
  out.sort((a, b) => S.ix.df.get(b) - S.ix.df.get(a));
  return out.slice(0, limit);
}
function ringOfDoc(d) { return d.site && d.site.ring ? d.site.ring : null; }
function search(q, opt = {}) {
  const t0 = performance.now();
  const ix = S.ix;
  const P = parseQuery(q);
  const res = { P, results: [], total: 0, fallback: false, ms: 0, suggestion: null, stems: [] };
  if (!ix || !ix.N) return res;
  const stems = uniq(P.terms.map(stem));
  res.stems = stems.slice();
  const k1 = 1.2, b = 0.55;
  const scoreStem = (s, boost) => {
    const p = ix.post.get(s);
    if (!p) return null;
    const n = ix.df.get(s), idf = Math.log(1 + (ix.N - n + 0.5) / (n + 0.5));
    const mp = new Map();
    for (let i = 0; i < p.length; i += 2) {
      const d = ix.docs[p[i]], tf = p[i + 1];
      mp.set(p[i], boost * idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * d.len / ix.avgLen)));
    }
    return mp;
  };
  const groups = stems.map((s, i) => {
    let g = scoreStem(s, 1);
    if (opt.prefix && i === stems.length - 1 && !/\s$/.test(P.raw)) {
      const raw = P.terms[P.terms.length - 1];
      for (const e of prefixStems(raw)) {
        if (e === s) continue;
        const ge = scoreStem(e, 0.75);
        if (!ge) continue;
        if (!g) g = new Map();
        for (const [k, v] of ge) if (!(g.get(k) >= v)) g.set(k, v);
        res.stems.push(e);
      }
    }
    return g;
  });
  let cand = new Map(), matched = new Map();
  const valid = groups.filter(Boolean);
  if (stems.length) {
    if (!P.or && valid.length === stems.length) {
      cand = new Map(valid[0]);
      for (const g of valid.slice(1)) for (const k of Array.from(cand.keys())) { if (!g.has(k)) cand.delete(k); else cand.set(k, cand.get(k) + g.get(k)); }
      for (const k of cand.keys()) matched.set(k, stems.length);
    }
    if (!cand.size) {
      res.fallback = !P.or && stems.length > 1 && valid.length > 0;
      for (const g of valid) for (const [k, v] of g) { cand.set(k, (cand.get(k) || 0) + v); matched.set(k, (matched.get(k) || 0) + 1); }
      for (const [k, v] of cand) cand.set(k, v * Math.pow((matched.get(k) || 1) / stems.length, 1.5));
    }
  } else if (P.site || P.ring || P.intitle.length || opt.ring) {
    ix.docs.forEach(d => cand.set(d.ix, 1 + Math.log1p(S.visits[d.path] || 0) * 0.1 + (d.mtime || 0) / 1e15));
  }
  const ringFilter = opt.ring || P.ring;
  let out = [];
  for (const [i, sc0] of cand) {
    const d = ix.docs[i];
    let sc = sc0;
    if (P.site && !(d.url || '').toLowerCase().replace(/^https?:\/\//, '').includes(P.site)) continue;
    if (ringFilter) { const r = ringOfDoc(d); if (!r || !(r.id === ringFilter || r.name.toLowerCase().includes(ringFilter))) continue; }
    if (P.neg.length && P.neg.some(s => d.tf.has(s))) continue;
    if (P.intitle.length) { const tt = new Set(tokenize(d.meta.title).map(stem)); if (!P.intitle.every(s => tt.has(s))) continue; }
    if (P.phrases.length) { const lc = lowerText(d); if (!P.phrases.every(p => lc.includes(p))) continue; sc *= 1.2; }
    if (stems.length) {
      const tt = new Set(tokenize(d.meta.title).map(stem));
      if (stems.every(s => tt.has(s))) sc *= 1.35;
    }
    sc *= 1 + 0.04 * Math.log1p(S.visits[d.path] || 0);
    out.push({ doc: d, score: sc });
  }
  out.sort((a, b) => b.score - a.score || a.doc.meta.title.localeCompare(b.doc.meta.title));
  res.omitted = 0;
  if (!opt.all && S.folds && S.folds.size) {
    // one result per set of copies and versions: the main one if it matched at all, else the best older one
    const byGroup = new Map(), col = [];
    for (const r of out) {
      const g = r.doc.fold;
      if (!g) { col.push(r); continue; }
      if (g.whole && r.doc.vsub) continue;              // a page inside a copied website folder: its original is in the results already
      const e = byGroup.get(g);
      if (e) { e.more++; if (r.doc === g.primary) e.doc = r.doc; continue; }
      const x = { doc: r.doc, score: r.score, more: 0, group: g };
      byGroup.set(g, x);
      col.push(x);
    }
    res.omitted = out.length - col.length;
    out = col;
  }
  res.results = out;
  res.total = out.length;
  if (P.terms.length && !(opt.prefix && out.length) && (out.length < 3 || stems.some(s => !ix.df.has(s)))) res.suggestion = spellSuggest(P);
  res.ms = performance.now() - t0;
  return res;
}

/* Damerau-Levenshtein with early exit */
function dlDist(a, b, max) {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev2 = null, prev = new Array(lb + 1), cur = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= lb; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur; cur = new Array(lb + 1);
  }
  return prev[lb];
}
function spellSuggest(P) {
  const ix = S.ix;
  let changed = false;
  const words = P.terms.map(t => {
    if (ix.df.has(stem(t)) || t.length < 3 || /\d/.test(t)) return t;
    const L = t.length, maxD = L <= 4 ? 1 : 2;
    let best = null, bd = 99, bdf = 0;
    for (const [w, n] of ix.words) {
      if (Math.abs(w.length - L) > maxD) continue;
      if (w[0] !== t[0] && w[1] !== t[1]) continue;
      const d = dlDist(t, w, maxD);
      if (d < bd || (d === bd && n > bdf)) { bd = d; best = w; bdf = n; }
    }
    if (best && bd <= maxD && best !== t) { changed = true; return best; }
    return t;
  });
  return changed ? words.join(' ') : null;
}

/* snippet with query terms in bold */
function snippet(doc, stems, maxLen = 230) {
  const m = doc.meta;
  const set = new Set(stems);
  const srcs = [m.deep, m.body, m.desc, m.headings, m.script].filter(Boolean);
  const wordRe = /[A-Za-z0-9][A-Za-z0-9']*/g;
  const hl = txt => esc(txt).replace(/[A-Za-z0-9][A-Za-z0-9']*/g, w => set.has(stem(normText(w).replace(/'s$/, '').replace(/'/g, ''))) ? '<b>' + w + '</b>' : w);
  if (set.size) {
    for (const src of srcs) {
      const text = src.length > 200000 ? src.slice(0, 200000) : src;
      const hits = [];
      let mm;
      wordRe.lastIndex = 0;
      while ((mm = wordRe.exec(text)) && hits.length < 400) {
        const s = stem(normText(mm[0]).replace(/'s$/, '').replace(/'/g, ''));
        if (set.has(s)) hits.push([mm.index, s]);
      }
      if (!hits.length) continue;
      let bestI = 0, bestN = -1;
      for (let i = 0; i < hits.length; i++) {
        const start = hits[i][0];
        const seen = new Set();
        for (let j = i; j < hits.length && hits[j][0] < start + maxLen - 40; j++) seen.add(hits[j][1]);
        if (seen.size > bestN) { bestN = seen.size; bestI = i; }
      }
      let a = Math.max(0, hits[bestI][0] - 50);
      if (a > 0) { const sp = text.indexOf(' ', a); a = sp > 0 && sp < a + 20 ? sp + 1 : a; }
      let z = Math.min(text.length, a + maxLen);
      if (z < text.length) { const sp = text.lastIndexOf(' ', z); if (sp > a + 40) z = sp; }
      return (a > 0 ? '... ' : '') + hl(text.slice(a, z)) + (z < text.length ? ' ...' : '');
    }
  }
  const base = m.desc || m.body || m.deep || '';
  return hl(clip(base, maxLen));
}
function relatedDocs(doc, k = 8) {
  if (!S.ix || !doc || !doc.vec) return [];
  const out = [];
  // pages and documents are related to each other; songs to songs, pictures to pictures
  const same = isSiteKind(doc) ? isSiteKind : d => d.kind === doc.kind;
  for (const d of S.ix.docs) { if (d === doc || !same(d) || isFolded(d) || (doc.fold && d.fold === doc.fold)) continue; const s = cos(doc.vec, d.vec); if (s > 0.02) out.push([d, s]); }
  out.sort((a, b) => b[1] - a[1]);
  return out.slice(0, k);
}
function sharedTerms(a, b, n = 4) {
  const arr = [];
  for (const [k, v] of a) { const w = b.get(k); if (w) arr.push([k, v * w]); }
  arr.sort((x, y) => y[1] - x[1]);
  return arr.slice(0, n).map(x => surface(x[0]));
}

/* ---------------- sites: a folder with index.html is one website ---------------- */
// titles that say what kind of page it is but not what it's about: "Notes" in Tools/Cayenne is "Cayenne Notes"
const EMPTY_TITLE = /^(index|default|home|homepage|home page|main|welcome|untitled|untitled document|untitled page|document|doc|page|new|new page|new document|new tab|test|temp|tmp|file|my page|blank)$/;
/** what a site is called in lists */
function siteTitle(s) {
  const d = s.index, raw = String(d.meta.title || prettyName(d.name)).trim();
  // a page that has older versions is listed by its plain name; the version shows next to it
  let t = d.fold && d.fold.cls === 'site' && d.fold.members.length > 1 ? cleanTitle(raw) : raw;
  // the newest of a series ("... Week 5") stands for the whole series
  if (d.fold && d.fold.series && d.vlabel && t.endsWith(d.vlabel) && t.length > d.vlabel.length + 3) t = t.slice(0, -d.vlabel.length).replace(/[\s\-–—:|·,#]+$/, '');
  const n = normName(t);
  if (n && !EMPTY_TITLE.test(n) && !GENERIC_BASE.has(n) && n.replace(/[^a-z]/g, '').length >= 3) return t;
  // borrow the nearest folder that says something: a website's own folder first, then the ones above it
  // (never the folder you opened, and never "site", "docs", "copy" and the like)
  const segs = (s.group ? s.dir : d.dir).split('/').filter(Boolean).slice(1);
  let folder = '';
  for (let i = segs.length - 1; i >= 0 && !folder; i--) {
    const f = parseVersion(segs[i], false).clean;
    if (f && /[a-z]{3}/i.test(f) && !FOLDER_SKIP.test(f.trim()) && !GENERIC_BASE.has(normName(f))) folder = prettyName(f);
  }
  if (!folder) return t || prettyName(d.name);
  if (!n || EMPTY_TITLE.test(n)) return folder;
  return normName(folder).split(' ').includes(n) ? folder : folder + ' ' + t;
}
function buildSites(docs) {
  const indexDirs = new Set();
  for (const d of docs) if (d.depth >= 1 && /^(index|default)\.(s?html?|xhtml)$/i.test(d.name)) indexDirs.add(d.dir);
  const sites = [], byKey = new Map();
  for (const d of docs) {
    const parts = d.dir.split('/').filter(Boolean);
    let key = null, acc = parts[0] + '/';
    for (let i = 1; i < parts.length; i++) { acc += parts[i] + '/'; if (indexDirs.has(acc)) { key = acc; break; } }
    const group = !!key;
    if (!key) key = d.path;
    let site = byKey.get(key);
    if (!site) { site = { key, dir: group ? key : d.dir, group, docs: [], root: parts[0] }; byKey.set(key, site); sites.push(site); }
    site.docs.push(d);
    d.site = site;
  }
  for (const s of sites) {
    s.index = s.group ? (s.docs.find(d => d.dir === s.dir && /^(index|default)\./i.test(d.name)) || s.docs[0]) : s.docs[0];
    s.docs.sort((a, b) => (a === s.index ? -1 : b === s.index ? 1 : a.path.localeCompare(b.path)));
    s.title = siteTitle(s);
    s.demo = s.docs.every(d => d.demo);
    // weighted average of the page vectors (keeps the whole-vocabulary scaling)
    const v = new Map();
    let wsum = 0;
    for (const d of s.docs) { const w = d === s.index ? 1.5 : 1; wsum += w; for (const [k, x] of d.vec) v.set(k, (v.get(k) || 0) + x * w); }
    for (const [k, x] of v) v.set(k, x / (wsum || 1));
    s.vec = v;
    s.mtime = Math.max(0, ...s.docs.map(d => d.mtime || 0));
    s.size = s.docs.reduce((a, d) => a + (d.size || 0), 0);
  }
  sites.sort((a, b) => a.key.localeCompare(b.key));
  return sites;
}

/* ---------------- Louvain community detection (weighted, undirected) ---------------- */
function louvain(n, adj, gamma) {
  let curAdj = adj.map(m => new Map(m)), curN = n;
  let members = Array.from({ length: n }, (_, i) => [i]);
  for (let level = 0; level < 12; level++) {
    const k = new Float64Array(curN);
    let m2 = 0;
    for (let i = 0; i < curN; i++) { let s = 0; for (const w of curAdj[i].values()) s += w; k[i] = s; m2 += s; }
    if (m2 <= 0) break;
    const comm = new Int32Array(curN);
    for (let i = 0; i < curN; i++) comm[i] = i;
    const tot = Float64Array.from(k);
    let improved = false;
    for (let pass = 0; pass < 40; pass++) {
      let moved = false;
      for (let i = 0; i < curN; i++) {
        const ci = comm[i];
        const wTo = new Map();
        for (const [j, w] of curAdj[i]) { if (j === i) continue; const cj = comm[j]; wTo.set(cj, (wTo.get(cj) || 0) + w); }
        tot[ci] -= k[i];
        let best = ci, bestGain = (wTo.get(ci) || 0) - gamma * tot[ci] * k[i] / m2;
        for (const [c, w] of wTo) {
          const g = w - gamma * tot[c] * k[i] / m2;
          if (g > bestGain + 1e-12) { bestGain = g; best = c; }
        }
        tot[best] += k[i];
        if (best !== ci) { comm[i] = best; moved = true; improved = true; }
      }
      if (!moved) break;
    }
    if (!improved) break;
    const remap = new Map();
    for (let i = 0; i < curN; i++) if (!remap.has(comm[i])) remap.set(comm[i], remap.size);
    const c = remap.size;
    const nAdj = Array.from({ length: c }, () => new Map());
    const nMem = Array.from({ length: c }, () => []);
    for (let i = 0; i < curN; i++) {
      const ci = remap.get(comm[i]);
      for (const o of members[i]) nMem[ci].push(o);
      for (const [j, w] of curAdj[i]) { const cj = remap.get(comm[j]); nAdj[ci].set(cj, (nAdj[ci].get(cj) || 0) + w); }
    }
    if (c === curN) break;
    curAdj = nAdj; members = nMem; curN = c;
  }
  const out = new Int32Array(n);
  members.forEach((list, ci) => { for (const o of list) out[o] = ci; });
  return out;
}

/* ---------------- web rings ---------------- */
const RING_COLORS = ['#cc0000', '#0033cc', '#008000', '#8b00cc', '#e65c00', '#008b8b', '#c2006b', '#6b6b00', '#00336b', '#8b5a2b', '#2f6b00', '#6b0033', '#0066aa', '#aa3300'];
const ACRONYMS = new Set('ups ac dc pc ui ux nfl nba mlb nhl ncaa bbq diy usa uk eu ev rv suv atv gps pdf html css api ai ul nec ieee kva kw kwh vdc vac mph mpg rpm abs ecu obd led lcd tv dvd cd rom ram usb lan wan isp icm wsop epc lng ccgt pjm hvac faq tbd rsvp vip aka diy ups bms ess ats mcc rfq spec po'.split(' '));
function capWord(w) {
  w = String(w || '');
  if (/^\d+$/.test(w)) return w;
  if (ACRONYMS.has(w) || (/^[a-z]{2,4}$/.test(w) && !/[aeiouy]/.test(w))) return w.toUpperCase();
  if (/^[a-z]+\d+$|^\d+[a-z]+$/.test(w) && w.length <= 6) return w.toUpperCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
}
/**
 * How alike every two sites are (the cosine of their word vectors), added up through an inverted index of
 * their words: the same numbers as comparing every pair, many times faster. Libraries of more than 2,500
 * sites keep each site's 80 closest neighbours instead of the whole table.
 */
function siteSimilarity(sites) {
  const n = sites.length;
  const ids = new Map(), post = [];
  const vecs = sites.map((s, i) => {
    const arr = [];
    for (const [k, v] of s.vec) {
      let id = ids.get(k);
      if (id == null) { id = post.length; ids.set(k, id); post.push([]); }
      post[id].push(i, v);
      arr.push(id, v);
    }
    return arr;
  });
  const DENSE = n <= 2500;
  const dense = DENSE ? new Float32Array(n * n) : null, rows = DENSE ? null : new Array(n);
  const acc = new Float64Array(n), touched = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let nt = 0;
    const vi = vecs[i];
    for (let a = 0; a < vi.length; a += 2) {
      const p = post[vi[a]], w = vi[a + 1];
      for (let b = 0; b < p.length; b += 2) {
        const j = p[b];
        if (j === i) continue;
        if (acc[j] === 0) touched[nt++] = j;
        acc[j] += w * p[b + 1];
      }
    }
    if (DENSE) { for (let t = 0; t < nt; t++) { const j = touched[t]; dense[i * n + j] = acc[j]; acc[j] = 0; } continue; }
    const list = [];
    for (let t = 0; t < nt; t++) { const j = touched[t]; list.push([j, acc[j]]); acc[j] = 0; }
    list.sort((x, y) => y[1] - x[1]);
    rows[i] = new Map(list.slice(0, 80));
  }
  if (DENSE) return { n, get: (i, j) => dense[i * n + j], row(i, fn) { for (let j = 0, o = i * n; j < n; j++) { const v = dense[o + j]; if (v && j !== i) fn(j, v); } } };
  for (let i = 0; i < n; i++) for (const [j, v] of rows[i]) if (!rows[j].has(i)) rows[j].set(i, v);
  return { n, get: (i, j) => rows[i].get(j) || 0, row(i, fn) { for (const [j, v] of rows[i]) fn(j, v); } };
}
function buildRings(sites) {
  const n = sites.length;
  if (!n) return [];
  // the similarities only depend on the site vectors, so reuse them while the site list is unchanged
  let sim = buildRings.cache && buildRings.cache.sites === sites ? buildRings.cache.sim : null;
  if (!sim) { sim = siteSimilarity(sites); buildRings.cache = { sites, sim }; }
  const K = clamp(Math.round(Math.log2(n)) + 2, 3, 10), FLOOR = 0.05;
  const adj = Array.from({ length: n }, () => new Map());
  for (let i = 0; i < n; i++) {
    let rowMax = 0;
    sim.row(i, (j, v) => { if (v > rowMax) rowMax = v; });
    const cut = Math.max(FLOOR, rowMax * 0.3);
    const row = [];
    sim.row(i, (j, v) => { if (v >= cut) row.push(j); });
    row.sort((a, b) => sim.get(i, b) - sim.get(i, a));
    for (const j of row.slice(0, K)) {
      const w = Math.pow(sim.get(i, j), 1.5);
      if (!(adj[i].get(j) >= w)) adj[i].set(j, w);
      if (!(adj[j].get(i) >= w)) adj[j].set(i, w);
    }
  }
  const comm = n > 2 ? louvain(n, adj, S.prefs.granularity || 1) : new Int32Array(n);
  const groups = new Map();
  comm.forEach((c, i) => { if (!groups.has(c)) groups.set(c, []); groups.get(c).push(i); });
  const lists = Array.from(groups.values());
  const big = lists.filter(l => l.length >= 2), singles = lists.filter(l => l.length < 2).flat();
  const wander = [];
  const avgTo = (i, l) => l.reduce((a, j) => a + sim.get(i, j), 0) / l.length;
  for (const i of singles) {
    let best = -1, bs = 0;
    big.forEach((l, li) => { const s = avgTo(i, l); if (s > bs) { bs = s; best = li; } });
    if (best >= 0 && bs >= 0.07) big[best].push(i); else wander.push(i);
  }
  if (wander.length === 1 && big.length) {
    // a lone wanderer joins the ring of its single closest neighbour (if it has any at all)
    const i = wander[0];
    let best = -1, bs = 0.02;
    big.forEach((l, li) => { for (const j of l) { const v = sim.get(i, j); if (v > bs) { bs = v; best = li; } } });
    if (best >= 0) { big[best].push(i); wander.pop(); }
  }
  const auto = big.map(l => ({ idx: l, wander: false }));
  if (wander.length) auto.push({ idx: wander, wander: true });
  if (!auto.length) auto.push({ idx: sites.map((_, i) => i), wander: false });

  // ring objects
  let rings = auto.map(g => {
    let med = g.idx[0], bestS = -1;
    for (const i of g.idx) { let s = 0; for (const j of g.idx) if (j !== i) s += sim.get(i, j); if (s > bestS) { bestS = s; med = i; } }
    return { key: g.wander ? 'wander' : 'auto:' + sites[med].key, wander: g.wander, sites: g.idx.map(i => sites[i]), medoid: sites[med] };
  });
  // overrides: page pins, manual moves and custom rings
  const byKey = new Map(rings.map(r => [r.key, r]));
  const ensure = (key, name) => {
    let r = byKey.get(key);
    if (!r) { r = { key, sites: [], custom: true, customName: name }; byKey.set(key, r); rings.push(r); }
    return r;
  };
  for (const c of S.customRings || []) ensure(c.key, c.name);
  const moveTo = (site, key) => {
    for (const r of rings) { const i = r.sites.indexOf(site); if (i >= 0) r.sites.splice(i, 1); }
    byKey.get(key).sites.push(site);
  };
  for (const site of sites) {
    const pin = site.index.meta.pinRing;
    if (pin && !S.ringMoves[site.key]) { const key = 'pin:' + slug(pin); ensure(key, pin); moveTo(site, key); }
  }
  for (const k in S.ringMoves) {
    const site = S.siteByKey.get(k), key = S.ringMoves[k];
    if (site && byKey.has(key)) moveTo(site, key);
  }
  rings = rings.filter(r => r.sites.length || r.custom);
  // naming: the phrase the members' own titles share, else their folder, else their strongest words
  ringNaming(rings, sites);
  // two rings that came out about the same thing are one ring
  const byLead = new Map();
  for (const r of rings) if (!r.wander && !r.custom && /^auto:/.test(r.key) && !S.ringNames[r.key] && r.leadKey) pushTo(byLead, r.leadKey, r);
  let merged = false;
  for (const list of byLead.values()) {
    if (list.length < 2) continue;
    list.sort((x, y) => y.sites.length - x.sites.length);
    for (const o of list.slice(1)) { list[0].sites.push(...o.sites); o.sites = []; o.dead = true; merged = true; }
  }
  if (merged) { rings = rings.filter(r => !r.dead); ringNaming(rings.filter(r => byLead.has(r.leadKey) && byLead.get(r.leadKey).length > 1), sites); }
  // two sites both called "Notes" (and no folder to tell them apart): each borrows its ring's name ("Poker Notes")
  const byTitle = new Map();
  for (const s of sites) pushTo(byTitle, normName(s.title), s);
  for (const [t, list] of byTitle) {
    if (list.length < 2 || !(EMPTY_TITLE.test(t) || GENERIC_BASE.has(t))) continue;
    for (const s of list) {
      const r = rings.find(x => x.sites.includes(s));
      const lead = r && !r.wander && r.lead && !normName(s.title).includes(normName(r.lead)) ? r.lead : '';
      if (lead) s.title = EMPTY_TITLE.test(t) ? lead : lead + ' ' + s.title;
    }
  }
  // unique names, ids, colors
  const seen = new Set(), ids = new Set();
  rings.sort((x, y) => (x.wander - y.wander) || (y.sites.length - x.sites.length) || x.name.localeCompare(y.name));
  rings.forEach((r, i) => {
    let nm = r.name, k = 2;
    const ROMAN = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    while (seen.has(nm.toLowerCase())) { nm = r.name + ' ' + (k - 2 < ROMAN.length ? ROMAN[k - 2] : String(k)); k++; }
    r.name = nm; seen.add(nm.toLowerCase());
    let id = slug(nm.replace(/^the\s+/i, '').replace(/\bring\b/i, '')) || 'ring';
    let id2 = id, m = 2;
    while (ids.has(id2)) id2 = id + '-' + m++;
    r.id = id2; ids.add(id2);
    r.color = RING_COLORS[i % RING_COLORS.length];
    // order members: greedy similarity chain from the medoid
    const pool = r.sites.slice();
    if (pool.length > 2) {
      let start = pool[0], bs = -1;
      for (const s of pool) { let t = 0; for (const o of pool) if (o !== s) t += cos(s.vec, o.vec); if (t > bs) { bs = t; start = s; } }
      const order = [start];
      const left = new Set(pool.filter(s => s !== start));
      while (left.size) {
        const last = order[order.length - 1];
        let nx = null, ns = -1;
        for (const s of left) { const v = cos(last.vec, s.vec); if (v > ns) { ns = v; nx = s; } }
        order.push(nx); left.delete(nx);
      }
      r.sites = order;
    }
    r.sites.forEach((s, j) => { s.ring = r; s.ringPos = j; });
    const c = new Map();
    for (const s of r.sites) for (const [k2, v] of s.vec) c.set(k2, (c.get(k2) || 0) + v);
    let nm2 = 0;
    for (const v of c.values()) nm2 += v * v;
    nm2 = Math.sqrt(nm2) || 1;
    for (const [k2, v] of c) c.set(k2, v / nm2);
    r.vec = c;
    r.size = r.sites.reduce((a, s) => a + s.size, 0);
    r.mtime = Math.max(0, ...r.sites.map(s => s.mtime));
  });
  return rings;
}

/* ---------------- naming rings ---------------- */
const RING_STYLES = [p => 'The ' + p + ' Ring', p => p + ' Web Ring', p => 'The ' + p + ' Circle', p => p + ' Central', p => 'The ' + p + ' Webring', p => 'The ' + p + ' Connection'];
const FOLDER_SKIP = /^(site|sites|www|html|web|public|dist|build|docs?|documents?|pages?|src|files?|misc|other|new|old|archive|archives|temp|tmp|demo|test|downloads?|desktop|backups?|copies|versions?|revs?|drafts?|stuff|my ?documents|untitled folder|exports?|output)$/i;
function ringNaming(rings, sites) {
  const gramSites = new Map(), termSites = new Map();
  for (const s of sites) {
    if (!s._grams || s._grams.title !== s.title) s._grams = { title: s.title, map: titleGrams(s.title) };
    for (const k of s._grams.map.keys()) gramSites.set(k, (gramSites.get(k) || 0) + 1);
    for (const k of s.vec.keys()) termSites.set(k, (termSites.get(k) || 0) + 1);
  }
  for (const r of rings) nameRing(r, gramSites, termSites);
}
function nameRing(r, gramSites, termSites) {
  const M = Math.max(1, r.sites.length), cands = [];
  // 1. phrases the members' own titles share ("Coral Duchess", "Cayenne 958")
  const cover = new Map();
  for (const s of r.sites) for (const [k, surf] of (s._grams ? s._grams.map : titleGrams(s.title))) {
    let c = cover.get(k);
    if (!c) cover.set(k, c = { surf: new Map(), sites: new Set() });
    c.sites.add(s);
    c.surf.set(surf, (c.surf.get(surf) || 0) + 1);
  }
  for (const [k, c] of cover) {
    const n = c.sites.size;
    if (M > 1 && n < 2) continue;
    const words = k.split(' ');
    const prec = n / Math.max(n, gramSites.get(k) || n);
    const lenB = words.length === 1 ? 1 : words.length === 2 ? 1.5 : 1.65;
    const weak = words.every(w => GENERIC_NAME.has(w) || NAME_STOP.has(w) || /\d/.test(w)) ? 0.3 : 1;
    // "Cayenne Diesel" reads better as a name than "958 Cayenne Diesel"
    const num = /\d/.test(words[0]) ? 0.7 : 1;
    cands.push({ key: k, words, sites: c.sites, label: displayPhrase(c.surf), score: Math.pow(n / M, 0.9) * Math.pow(prec, 0.6) * lenB * weak * num, src: 'title' });
  }
  // 2. a subfolder most of them share is what you call the topic yourself
  const folders = new Map(), plainFolders = new Map();
  for (const s of r.sites) {
    // the folder a page sits in (a website's own folder counts as the site): never the folder you opened
    const segs = s.dir.split('/').filter(Boolean);
    const i = s.group ? segs.length - 2 : segs.length - 1;
    const f = i >= 1 ? parseVersion(segs[i], false).clean : '';
    if (!f || f.length > 28 || !/[a-z]{3}/i.test(f)) continue;
    // "Docs" or "Downloads" only names a ring that has nothing better to go by
    if (FOLDER_SKIP.test(f.trim()) || GENERIC_BASE.has(normName(f))) pushTo(plainFolders, f, s); else pushTo(folders, f, s);
  }
  for (const [f, list] of folders) {
    if (list.length < Math.max(2, Math.ceil(M * 0.6))) continue;
    const label = prettyName(f).split(' ').filter(w => !NAME_STOP.has(w.toLowerCase())).slice(0, 3).join(' ');
    if (label) cands.push({ key: normName(label), words: normName(label).split(' '), sites: new Set(list), label, score: Math.pow(list.length / M, 0.9) * 1.3, src: 'folder' });
  }
  // 3. the words their pages use most (fine as a topic; never a code word, "00PM" or "5TH")
  const cent = new Map();
  for (const s of r.sites) for (const [k, v] of s.vec) cent.set(k, (cent.get(k) || 0) + v);
  const top = Array.from(cent.entries()).sort((a, b) => b[1] - a[1]).slice(0, 40);
  const topW = top.length ? top[0][1] : 1;
  // folder names are indexed too ("docs", "downloads", the folder you opened): never a topic on their own
  const roots = new Set(['demo'].concat((S.roots || []).map(x => normName(x.name))));
  for (const [k, wt] of top) {
    const w = surface(k);
    if (!isNameWord(w, false) || GENERIC_NAME.has(w) || w.length < 4 || FOLDER_SKIP.test(w) || roots.has(normName(w))) continue;
    const set = new Set(r.sites.filter(s => s.vec.has(k)));
    if (M > 1 && set.size < 2) continue;
    const prec = set.size / Math.max(set.size, termSites.get(k) || set.size);
    // a word the pages use a lot AND put in their titles is what they're about
    const inTitles = cover.get(normName(w));
    const tb = inTitles ? 1 + 0.6 * inTitles.sites.size / M : 1;
    cands.push({ key: w, words: [w], sites: set, label: inTitles ? displayPhrase(inTitles.surf) : nameToken(w, 0, false), score: Math.pow(set.size / M, 0.9) * Math.pow(prec, 0.6) * Math.pow(wt / topW, 0.5) * 0.8 * tb, src: 'text' });
  }
  // words that say which part of the directory the ring belongs in ("tournament", "cayenne", "itinerary") make better names
  const pre = categoryFor(top.slice(0, 25).map(([k]) => surface(k)).join(' '));
  if (pre.re) for (const c of cands) if (c.words.some(w => pre.re.test(w))) c.score *= 1.15;
  const byKey = new Map();
  for (const c of cands) { const o = byKey.get(c.key); if (!o || c.score > o.score) byKey.set(c.key, c); }
  const ranked = Array.from(byKey.values()).sort((a, b) => b.score - a.score || b.words.length - a.words.length || a.key.localeCompare(b.key));
  let best = ranked[0] || null;
  // a grab bag with no strong topic: the folder its files share says it best ("The Docs Ring")
  if ((!best || best.score < 0.45) && !r.wander) {
    for (const [f, list] of plainFolders) {
      if (list.length < Math.max(2, Math.ceil(M * 0.6))) continue;
      const label = prettyName(f);
      best = { key: normName(label), words: normName(label).split(' '), sites: new Set(list), label, score: 0.45, src: 'folder' };
      ranked.unshift(best);
      break;
    }
  }
  // "Coral Duchess" over "Duchess": a title phrase that holds the winning word and does nearly as well
  if (best && best.words.length === 1) {
    const bw = normName(best.words[0]);
    const ph = ranked.find(c => c.src === 'title' && c.words.length > 1 && c.words.includes(bw) && c.score >= best.score * 0.8);
    if (ph) best = ph;
  }
  // a ring that's really two topics gets both ("Cruise & Caribbean")
  let second = null;
  if (best && best.sites.size / M < 0.5) {
    second = ranked.find(c => c !== best && !c.words.some(w => best.words.includes(w)) && c.sites.size / M >= 0.25 && Array.from(c.sites).filter(x => !best.sites.has(x)).length >= c.sites.size * 0.6) || null;
  }
  r.lead = best ? best.label : '';
  r.leadKey = best ? best.key : '';
  // keywords: the lead first, then other phrases and words that don't repeat it
  const used = new Set(best ? best.words : []), terms = best ? [best.label] : [];
  if (second) { terms.push(second.label); for (const w of second.words) used.add(w); }
  for (const c of ranked) {
    if (terms.length >= 8) break;
    if (c === best || c === second || c.words.every(w => used.has(w))) continue;
    if (terms.some(t => normName(t) === c.key)) continue;
    terms.push(c.label);
    for (const w of c.words) used.add(w);
  }
  r.terms = terms;
  r.words = ranked.slice(0, 12).flatMap(c => c.words);
  // other good names, for the Ring Manager
  r.suggest = ranked.slice(0, 8).map(c => ({ label: c.label, src: c.src, score: Math.round(c.score * 1000) / 1000, cover: c.sites.size }));
  const phrase = best ? (second ? best.label + ' & ' + second.label : best.label) : '';
  let auto;
  if (r.wander) auto = 'The Wanderers Ring';
  else if (r.custom) auto = r.customName;
  else if (!phrase) auto = 'The Mystery Ring';
  else auto = RING_STYLES[hash32(r.key) % RING_STYLES.length](phrase);
  r.autoName = auto;
  r.name = S.ringNames[r.key] || auto;
  r.cat = r.wander ? { id: 'misc', name: 'Miscellaneous', glyph: '☼' } : categoryFor([r.name, phrase, terms.join(' '), r.words.join(' ')].join(' '));
  r.glyph = r.wander ? '☼' : r.cat.glyph;
  const badgeText = r.custom || S.ringNames[r.key] ? r.name.replace(/^the\s+/i, '').replace(/\s+(web\s*)?ring$/i, '') : r.lead || r.name;
  r.badge = r.wander ? 'WANDERERS' : badgeLabel(badgeText);
  r.badgeLines = r.wander ? null : badgeLines(badgeText, 'WEB RING');
}

/* ---------------- the fake DNS ---------------- */
const PORTAL_HOSTS = new Set(['home.lanscape.net', 'www.lanscape.net', 'lanscape.net', 'www.hyperhound.com', 'hyperhound.com', 'www.ringhub.org', 'ringhub.org', 'www.netropolis.com', 'netropolis.com', 'members.lanscape.net']);
const DNS_FILLER = new Set('the a an of and for to in on at by with my your our file page index untitled document serverless single interactive html htm'.split(' '));
const DNS_TRAILING = new Set('final draft copy new updated latest rev revision version ver v old backup'.split(' '));
const HOODS = ['Heights', 'Alley', 'Row', 'Plaza', 'Commons', 'Gardens', 'Junction', 'Harbor', 'Ridge', 'Square', 'Village', 'Boulevard', 'Terrace', 'Springs'];
function nameWords(site) {
  const title = site.title || site.index.meta.title || '';
  const fromFolder = site.group ? parseVersion(site.dir.split('/').filter(Boolean).pop() || '', false).clean : '';
  const clean = s => normText(s).replace(/&/g, ' and ').replace(/([a-z0-9])'s\b/g, (m, c) => (c === 's' ? c : c + 's')).replace(/'/g, '')
    .split(/[^a-z0-9]+/).filter(w => w && (w.length > 1 || /\d/.test(w)) && !DNS_FILLER.has(w) && !/^(r|v|rev|ver)\d+[a-z]?$/.test(w) && !/^\d{5,}$/.test(w));
  const trim = ws => { while (ws.length > 1 && DNS_TRAILING.has(ws[ws.length - 1])) ws.pop(); return ws; };
  let words = [];
  if (fromFolder && !FOLDER_SKIP.test(fromFolder.trim()) && !GENERIC_BASE.has(normName(fromFolder))) words = trim(clean(fromFolder.replace(/([a-z])([A-Z])/g, '$1 $2')));
  if (!words.length) {
    // the main title, before a subtitle separator, if it says enough on its own (versions and dates left out)
    const t2 = cleanTitle(title);
    const main = t2.split(/\s+[-–—|]\s+|:\s+|\s+\(|\s*\|\s*/)[0];
    words = trim(clean(main));
    if (words.join('').length < 6) words = trim(clean(t2));
  }
  if (!words.length) words = trim(clean(parseVersion(site.index.name, true).clean || site.index.name.replace(/\.[a-z0-9]+$/i, '')));
  if (!words.length) words = ['homepage'];
  return words;
}
function pickTld(site) {
  const m = site.index.meta;
  const t = normText([m.title, m.keywords].join(' '));
  if (/\b(italy|italia|italian|rome|venice|florence|tuscany|milan|amalfi)\b/.test(t)) return 'it';
  if (/\b(france|paris|french)\b/.test(t)) return 'fr';
  if (/\b(japan|tokyo|kyoto|osaka)\b/.test(t)) return 'jp';
  if (/\b(germany|german|berlin|munich)\b/.test(t)) return 'de';
  if (/\b(canada|toronto|vancouver|montreal)\b/.test(t)) return 'ca';
  if (/\b(mexico|cancun|cozumel)\b/.test(t)) return 'mx';
  if (/\b(uk|england|london|britain|scotland)\b/.test(t)) return 'co.uk';
  if (/\b(club|society|association|foundation|league|fans?|community|church|union|ring|guild)\b/.test(t)) return 'org';
  if (/\b(guide|manual|tutorial|course|lessons?|study|research|handbook|reference|learn|learning|beginners?|101|class|primer)\b/.test(t)) return 'edu';
  if (/\b(network|server|monitor|status|remote|control|tracker|live|dashboard|net)\b/.test(t)) return 'net';
  return 'com';
}
function parseAddr(v) {
  let s = String(v || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '');
  if (!s) return null;
  let i = s.indexOf('/');
  let host = i < 0 ? s : s.slice(0, i), base = i < 0 ? '/' : s.slice(i);
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return null;
  if (!base.endsWith('/')) base += '/';
  base = base.replace(/\/{2,}/g, '/');
  return { host, base };
}
function buildDNS(sites, rings, all) {
  const used = new Set(), usedHost = new Set(PORTAL_HOSTS);
  const scheme = S.prefs.scheme;
  const claim = (site, host, base) => { site.host = host; site.base = base; used.add(host + base); if (base === '/') usedHost.add(host); };
  const free = (host, base) => !used.has(host + base) && (base !== '/' || !usedHost.has(host)) && !(base === '/' && PORTAL_HOSTS.has(host));
  const pending = [];
  for (const site of sites) {
    const o = S.dns[site.key] ? parseAddr(S.dns[site.key]) : null;
    if (o && free(o.host, o.base)) { claim(site, o.host, o.base); site.custom = true; continue; }
    const p = scheme === 'vanity' && site.index.meta.pinHost ? parseAddr(site.index.meta.pinHost) : null;
    if (p && free(p.host, p.base)) { claim(site, p.host, p.base); site.custom = false; continue; }
    site.custom = false;
    pending.push(site);
  }
  // shared-host schemes (neighborhoods / tilde) still never collide with vanity hosts
  S.hoods = new Map();
  if (scheme === 'hoods') {
    const hoodUsed = new Set();
    for (const r of rings) {
      const w = (r.lead || r.terms[0] || 'Mystery').split(' ')[0].replace(/[^A-Za-z0-9]/g, '') || 'Mystery';
      let nm = w.charAt(0).toUpperCase() + w.slice(1) + HOODS[hash32(r.key) % HOODS.length], k = 2;
      if (r.wander) nm = 'Hinterlands';
      while (hoodUsed.has(nm)) nm = nm + k++;
      hoodUsed.add(nm);
      S.hoods.set(r.id, nm);
      r.hood = nm;
    }
  }
  for (const site of pending) {
    const words = nameWords(site);
    site.words = words;
    if (scheme === 'hoods') {
      const hood = (site.ring && site.ring.hood) || 'Hinterlands';
      let num = 1000 + hash32(site.key) % 9000;
      while (!free('www.netropolis.com', '/' + hood + '/' + num + '/')) num = num >= 9999 ? 1000 : num + 1;
      claim(site, 'www.netropolis.com', '/' + hood + '/' + num + '/');
    } else if (scheme === 'tilde') {
      let base = words.join('').slice(0, 12) || 'user', b2 = base, k = 2;
      while (!free('members.lanscape.net', '/~' + b2 + '/')) b2 = base + k++;
      claim(site, 'members.lanscape.net', '/~' + b2 + '/');
    } else {
      const tld = pickTld(site);
      let base = '', i = 0;
      while (i < words.length && i < 4 && (base + words[i]).length <= 24) base += words[i++];
      if (!base) base = words[0].slice(0, 24);
      const cands = [base];
      let b2 = base;
      for (let j = i; j < words.length && (b2 + words[j]).length <= 30; j++) { b2 += words[j]; cands.push(b2); }
      const tlds = uniq([tld, 'com', 'net', 'org']);
      let host = null;
      outer: for (const t of tlds) for (const c of cands) { const h = 'www.' + c + '.' + t; if (free(h, '/')) { host = h; break outer; } }
      for (let k = 2; !host && k < 9999; k++) { const h = 'www.' + base + k + '.' + tld; if (free(h, '/')) host = h; }
      claim(site, host, '/');
    }
  }
  // URLs & host map
  S.hostMap = new Map();
  for (const site of sites) {
    site.words = site.words || nameWords(site);
    site.url = 'http://' + site.host + site.base;
    for (const d of site.docs) {
      const rel = d === site.index ? '' : d.path.slice(site.dir.length);
      d.rel = rel;
      d.url = site.url + encPath(rel);
    }
    if (!S.hostMap.has(site.host)) S.hostMap.set(site.host, []);
    S.hostMap.get(site.host).push(site);
  }
  for (const arr of S.hostMap.values()) arr.sort((a, b) => b.base.length - a.base.length);
  if (all) addressFiles(all);
}
const encPath = rel => String(rel).split('/').map(encodeURIComponent).join('/');
/* every folder you open is also an FTP server; songs, videos and pictures get app addresses */
function ftpHostFor(root, taken) {
  if (root === 'demo') return 'ftp.lanscape.net';
  const base = slug(root).replace(/-/g, '').slice(0, 30) || 'files';
  let host = 'ftp.' + base + '.com', k = 2;
  while (taken.has(host)) host = 'ftp.' + base + (k++) + '.com';
  return host;
}
const ftpUrl = d => 'ftp://' + (S.rootFtp.get(d.root) || 'ftp.lanscape.net') + '/' + encPath(d.path.slice(d.root.length + 1));
function addressFiles(all) {
  S.ftpHosts = new Map(); S.rootFtp = new Map();
  for (const r of uniq(all.map(d => d.root)).sort()) { const h = ftpHostFor(r, S.ftpHosts); S.ftpHosts.set(h, r); S.rootFtp.set(r, h); }
  S.slugs = new Map();
  const claim = (space, text, d) => {
    const b = slug(text) || space;
    let x = b, k = 2;
    while (S.slugs.has(space + ':' + x)) x = b + '-' + k++;
    S.slugs.set(space + ':' + x, d);
    return x;
  };
  // stable order, so an address doesn't move when nothing changed (main copies first, so they get the plain names)
  const list = all.slice().sort((a, b) => (isFolded(a) - isFolded(b)) || a.path.localeCompare(b.path));
  for (const d of list) {
    d.ftp = ftpUrl(d);
    d.home = null;
    if (isSiteKind(d)) {
      // an older version of a page lives at its newest version's address: www.tracker.com/versions/2
      // (a copied website folder: www.club.org/versions/2/about.html)
      if (isFolded(d)) {
        const ps = d.fold.primary.site;
        d.rel = null;
        d.home = ps || null;
        d.url = ps ? ps.url + 'versions/' + d.vno + (d.fold.whole ? '/' + encPath(d.vsub || '') : '') : d.ftp;
      }
      continue;
    }
    if (d.asset) {
      // a picture or stylesheet inside a website folder is served by that website
      let dir = d.dir, inCopy = false;
      while (dir && !d.home) {
        const s = S.siteByKey.get(dir);
        if (s && s.group) d.home = s;
        else if (S.foldDirs && S.foldDirs.has(dir)) {
          // inside a copied website folder: served from the main website's versions/N/
          const fd = S.foldDirs.get(dir), ps = fd.g.primary.site;
          if (ps) { d.home = ps; d.rel = null; d.url = ps.url + 'versions/' + fd.vno + '/' + encPath(d.path.slice(dir.length)); inCopy = true; }
          break;
        }
        dir = dir.slice(0, dir.slice(0, -1).lastIndexOf('/') + 1);
      }
      if (inCopy) continue;
      if (d.home) { d.rel = d.path.slice(d.home.dir.length); d.url = d.home.url + encPath(d.rel); continue; }
    }
    const m = d.meta || {};
    if (d.kind === 'audio') d.url = 'http://music.lanscape.net/song/' + claim('song', (m.artist && m.artist !== 'Unknown Artist' ? m.artist + ' ' : '') + (m.title || d.name), d);
    else if (d.kind === 'video') d.url = 'http://www.rewindvideo.com/watch/' + claim('video', m.title || d.name, d);
    else if (d.kind === 'image') d.url = 'http://photos.lanscape.net/photo/' + claim('photo', d.name.replace(/\.[a-z0-9]+$/i, ''), d);
    else d.url = d.ftp;
  }
}
/** folders -> sub-folders and files, for FTP listings, "Index of" pages and photo albums */
function buildTree(all) {
  const tree = new Map();
  const node = p => { let n = tree.get(p); if (!n) tree.set(p, n = { path: p, dirs: new Set(), files: [] }); return n; };
  for (const d of all) {
    node(d.dir).files.push(d);
    let dir = d.dir;
    while (true) {
      const cut = dir.slice(0, -1).lastIndexOf('/');
      if (cut < 0) break;
      const parent = dir.slice(0, cut + 1);
      node(parent).dirs.add(dir);
      dir = parent;
    }
  }
  return tree;
}
function displayUrl(u) { try { return decodeURI(String(u).replace(/^http:\/\//, '')); } catch (e) { return String(u).replace(/^http:\/\//, ''); } }
