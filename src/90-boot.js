/* ===================================================================
   Boot
   =================================================================== */
const DEFAULT_BOOKMARKS = [
  { title: 'LANscape Home', url: 'http://home.lanscape.net/' },
  { title: 'HyperHound Search', url: 'http://www.hyperhound.com/' },
  { title: 'RingHub: All Web Rings', url: 'http://www.ringhub.org/' },
  { title: 'The Ultimate Hotlist', url: 'http://home.lanscape.net/hotlist' },
  { title: "What's New?", url: 'http://home.lanscape.net/new' }
];
async function boot() {
  buildMenubar();
  buildToolbar();
  buildSidebar();
  setupDnD();
  bindFrame(frame);
  frame.setAttribute('sandbox', SANDBOX_TRUSTED);
  setSecurity('none');
  setStatus('Starting LANscape...');
  busy(true);
  await DB.open();
  await loadState();
  if (!S.bookmarks) S.bookmarks = DEFAULT_BOOKMARKS.slice();
  applyChrome();
  // the Demo Web (dates are stable for a day so previews stay fresh)
  const day0 = new Date(); day0.setHours(9, 0, 0, 0);
  for (const p of DEMO_PAGES) {
    S.demoSrc.set(p.path, p.d);
    const doc = makeDoc({ path: p.path, size: p.d.length, mtime: day0.getTime() - p.days * 864e5 - (hash32(p.path) % 7200) * 1000, meta: extractHTML(p.d, p.path.split('/').pop()), demo: true });
    registerDoc(doc);
  }
  for (const f of DEMO_FILES) {
    S.demoSrc.set(f.path, f.gen || f.src);
    const name = f.path.split('/').pop(), kind = kindOf(name);
    const doc = makeDoc({ path: f.path, size: f.size || (typeof f.src === 'string' ? f.src.length : 0), mtime: day0.getTime() - (f.days || 1) * 864e5 - (hash32(f.path) % 7200) * 1000, meta: demoFileMeta(f, kind, name), demo: true, kind });
    registerDoc(doc);
    if (f.art && doc.meta.artKey && !S.thumbs.has('art:' + doc.meta.artKey)) S.thumbs.set('art:' + doc.meta.artKey, f.art());
    demoFileAfter(f, doc);
  }
  for (const t of (await DB.getAll('thumbs')) || []) { if (t && t.data) { S.thumbs.set(t.path, t.data); S.thumbAt.set(t.path, t.mtime); } }
  for (const m of (await DB.getAll('meta')) || []) {
    if (!m || !m.path) continue;
    const name = m.path.split('/').pop(), kind = kindOf(name);
    let meta = m.meta;
    // records from LANscape 3 kept bare entries for pictures and stylesheets: re-read them on the next sync
    if (!meta) { meta = kind === 'image' ? extractImage(name, m.path, m.size || 0) : kind === 'video' ? extractVideo(name, m.path, m.size || 0) : extractOther(name, m.path, m.size || 0, kind); meta.stale = true; }
    const doc = makeDoc({ path: m.path, size: m.size, mtime: m.mtime, meta, kind });
    doc.indexedAt = m.indexedAt || 0;
    // files in folders you turned off wait in the parking lot, index and all
    if (exclusionOf(doc.path)) S.parked.set(doc.path, doc); else registerDoc(doc);
  }
  const rr = await DB.get('kv', 'roots');
  S.roots = (rr && rr.v) || [];
  const known = new Set(S.roots.map(r => r.name));
  for (const d of Array.from(S.docs.values()).concat(Array.from(S.parked.values()))) if (!d.demo && !known.has(d.root)) { S.roots.push({ name: d.root, src: d.root, mode: d.root === VROOT ? 'virtual' : 'input', loadedAt: d.indexedAt || Date.now() }); known.add(d.root); }
  for (const r of S.roots) noteRoot(r.name);
  S.roots = S.roots.filter(r => r.files + r.off > 0);
  const hr = await DB.get('kv', 'handles');
  if (hr && hr.v) for (const x of hr.v) if (x && x.handle) S.rootHandles.set(x.name, x.handle);
  rebuildAll();
  busy(false);
  if (typeof Player !== 'undefined') Player.restore();
  if (typeof LANamp !== 'undefined' && S.prefs.ampOpen) LANamp.open(false);
  const m = /#go=(.+)$/.exec(location.hash);
  let start = S.prefs.homepage || 'http://home.lanscape.net/';
  if (m) { try { start = decodeURIComponent(m[1]); } catch (e) { /* keep the home page */ } }
  else if (S.prefs.startup === 'last' && S.history[0]) start = S.history[0].url;
  await go(start);
  if (!DB.ok) setStatus('This browser won\'t let LANscape keep a cache for local files, so open your folder each time.');
  setTimeout(() => { if (S.roots.length && S.rootHandles.size) resyncAll(true); }, 1500);
}
window.LAN = { S, go, search, buildIndex, buildSites, buildRings, rebuildAll, ingest, resolve, Spider, louvain, tokenize, stem, extractHTML, cos, sharedTerms, surface, snippet, relatedDocs, loadFromHandle, resyncAll, reload,
  mountFolder, resyncFolder, setFolderOn, removeRoot, removeFolder, rehomeRoot, exclusionOf, FolderManager, openFolder, folderLock, applyDeep, applyThumb, MkvPlayer, mkvOpen, probeVideo, learnVideo, videoProbed,
  DB, APPS, Libs, docsAll, getBlob, getText, writeDoc, createFile, kindOf, zipOpen, zipWrite, docxToHtml, htmlToDocx, mdToHtml, htmlToMd, rtfToHtml, htmlToRtf, parseCSV, toCSV, MThumbs, probeVideo, back, forward, canLeave,
  docsShown, isFolded, foldDuplicates, foldKeep, foldSplit, foldUnsplit, foldJoin, foldUnfold, foldWhy, foldTitle, Fingerprinter, Diff, parseVersion, prettyName, cleanTitle, titleGrams, badgeLabel, categoryFor, isNameWord, siteTitle, nameWords,
  get Player() { return typeof Player !== 'undefined' ? Player : null; }, get LANamp() { return typeof LANamp !== 'undefined' ? LANamp : null; } };
boot().catch(err => {
  console.error(err);
  setStatus('LANscape failed to start: ' + (err && err.message || err));
  busy(false);
});
