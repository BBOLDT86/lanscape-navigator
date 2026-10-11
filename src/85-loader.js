/* ===================================================================
   Loading folders (File System Access, webkitdirectory, drag & drop),
   the IndexedDB cache, re-sync, and the Spider
   =================================================================== */
const SKIP_NAME = n => !n || n.startsWith('.') || /^(node_modules|__pycache__|bower_components|venv|\$recycle\.bin|__macosx|system volume information)$/i.test(n) || /^(thumbs\.db|desktop\.ini|icon\r)$/i.test(n);
const MAX_FILES = 60000;
const VROOT = 'My Documents';           // a folder that lives inside the browser (IndexedDB)
const LOOSE = 'Files';                  // single files opened or dropped one at a time
const CACHE_BUDGET = 300e6;             // bytes of binary files copied into the cache per folder

function makeDoc({ path, size, mtime, meta, demo, kind }) {
  const name = path.split('/').pop(), dir = path.slice(0, path.length - name.length);
  kind = kind || kindOf(name);
  if (meta && !meta.kind) meta.kind = kind;
  return { path, name, dir, root: path.split('/')[0], ext: extOf(name), kind, size: size || 0, mtime: mtime || 0, meta, demo: !!demo, depth: dir.split('/').filter(Boolean).length - 1, indexedAt: Date.now(), active: false, asset: false };
}
function registerDoc(doc) { S.docs.set(doc.path, doc); S.lower.set(doc.path.toLowerCase(), doc.path); }
function forgetBlob(p) { const u = S.blobs.get(p); if (u) { URL.revokeObjectURL(u); S.blobs.delete(p); } }
function unregister(p) {
  S.docs.delete(p); S.parked.delete(p); S.lower.delete(p.toLowerCase()); S.live.delete(p); S.fh.delete(p); S.offFiles.delete(p);
  S.thumbs.delete(p); S.thumbAt.delete(p);
  forgetBlob(p);
}
/** still on the LANscape (or parked in a folder that's turned off)? Records for removed files must not be written back */
const isKnownDoc = d => !!d && !d.demo && (S.docs.get(d.path) === d || S.parked.get(d.path) === d);
function activeDocs() {
  const user = [], demo = [];
  for (const d of S.docs.values()) (d.demo ? demo : user).push(d);
  const showDemo = S.prefs.demo || !user.length;
  return (showDemo ? demo : []).concat(user).sort((a, b) => a.path.localeCompare(b.path));
}
const isIndexName = n => /^(index|default)\.(s?html?|xhtml)$/i.test(n);
const parentDir = dir => dir.slice(0, dir.slice(0, -1).lastIndexOf('/') + 1);
/** folders (below a root) that hold an index.html: each one is a multi-page website */
function groupDirs(paths) {
  const dirs = new Set();
  for (const p of paths) { const name = p.split('/').pop(); if (isIndexName(name)) { const dir = p.slice(0, p.length - name.length); if (dir.split('/').filter(Boolean).length >= 2) dirs.add(dir); } }
  return dirs;
}
const SITE_KIND = k => k === 'html' || (KINDS[k] && KINDS[k].cls === 'document');
function underGroup(path, dirs) {
  if (!dirs.size) return false;
  let dir = path.slice(0, path.lastIndexOf('/') + 1);
  while (dir.split('/').filter(Boolean).length >= 2) { if (dirs.has(dir)) return true; dir = parentDir(dir); }
  return false;
}
/** pictures, scripts and styles inside a website folder belong to that website */
function markAssets(docs) {
  const dirs = groupDirs(docs.filter(d => d.kind === 'html').map(d => d.path));
  for (const d of docs) d.asset = !SITE_KIND(d.kind) && underGroup(d.path, dirs);
}
function needsDeep(d) { return !d.demo && (d.kind === 'html' || d.kind === 'pdf') && !d.asset && d.meta.deepFor !== d.mtime; }
function needsThumb(d) { return (d.kind === 'html' || d.kind === 'pdf') && (d.demo ? !S.thumbs.has(d.path) : (S.thumbAt.get(d.path) || 0) !== d.mtime); }
function rebuildAll() {
  const docs = activeDocs();
  for (const d of S.docs.values()) d.active = false;
  for (const d of docs) d.active = true;
  markAssets(docs);
  S.ix = buildIndex(docs);
  // older versions and copies don't get sites (or rings) of their own: they live under their main version
  for (const d of docs) if (isFolded(d)) d.site = null;
  S.sites = buildSites(docs.filter(d => isSiteKind(d) && !isFolded(d)));
  S.siteByKey = new Map(S.sites.map(s => [s.key, s]));
  S.rings = buildRings(S.sites);
  S.ringById = new Map(S.rings.map(r => [r.id, r]));
  buildDNS(S.sites, S.rings, docs);
  S.tree = buildTree(docs);
  S.gen++;
  Fingerprinter.kick();
}
const relayDNS = () => buildDNS(S.sites, S.rings, docsAll());

/* ---------------- reading any kind of file ---------------- */
const textualKind = (kind, ext) => TEXTUAL.has(kind) || (kind === 'sheet' && (ext === 'csv' || ext === 'tsv'));
async function extractFor(file, path, kind, asset) {
  const name = path.split('/').pop(), ext = extOf(name), size = file.size;
  const big = n => size > n;
  if (asset && kind !== 'image' && kind !== 'audio' && kind !== 'video') return { meta: extractOther(name, path, size, kind) };
  switch (kind) {
    case 'html': { const text = await blobText(file); return { meta: extractHTML(text, name), text }; }
    case 'text': { if (big(16e6)) break; const text = await blobText(file); return { meta: extractText(text, name), text }; }
    case 'md': { if (big(16e6)) break; const text = await blobText(file); return { meta: extractMarkdown(text, name), text }; }
    case 'rtf': { if (big(40e6)) break; const text = await blobText(file); return { meta: extractRtf(text, name), text }; }
    case 'code': { if (big(4e6)) break; const text = await blobText(file); return { meta: extractCode(text, name), text }; }
    case 'sheet': {
      if (ext === 'csv' || ext === 'tsv') { if (big(60e6)) break; const text = await blobText(file); return { meta: extractCsv(text, name), text }; }
      return { meta: await extractXlsx(file, name) };
    }
    case 'docx': return { meta: await extractDocx(file, name) };
    case 'slides': return { meta: await extractPptx(file, name) };
    case 'pdf': return { meta: await extractPdfQuick(file, name) };
    case 'legacy': return { meta: extractLegacy(new Uint8Array(await file.slice(0, 8e6).arrayBuffer()), name) };
    case 'audio': { const r = await extractAudio(file, name, path); return { meta: r.meta, art: r.art }; }
    case 'video': return { meta: extractVideo(name, path, size) };
    case 'image': return { meta: extractImage(name, path, size) };
    case 'archive': return { meta: await extractArchive(file, name) };
    default: break;
  }
  return { meta: extractOther(name, path, size, kind) };
}
const KIND_RANK = { html: 0, md: 1, text: 1, rtf: 1, docx: 1, sheet: 1, pdf: 1, slides: 1, legacy: 1, audio: 2, video: 2, image: 3, code: 4, archive: 4, font: 5, other: 6 };
const KIND_WORD = { html: ['page', 'pages'], document: ['document', 'documents'], audio: ['song', 'songs'], video: ['video', 'videos'], image: ['picture', 'pictures'], file: ['file', 'files'] };
function countWords(counts) {
  const g = { html: 0, document: 0, audio: 0, video: 0, image: 0, file: 0 };
  for (const k in counts) { const c = KINDS[k] ? KINDS[k].cls : 'file'; const key = k === 'html' ? 'html' : c === 'document' ? 'document' : (k === 'audio' || k === 'video' || k === 'image') ? k : 'file'; g[key] += counts[k]; }
  return Object.keys(g).filter(k => g[k]).map(k => g[k].toLocaleString() + ' ' + KIND_WORD[k][g[k] === 1 ? 0 : 1]);
}
async function artThumb(art) {
  try { return await imageThumb(new Blob([art.bytes], { type: art.mime || 'image/jpeg' }), 300, 0.85); } catch (e) { return null; }
}
async function saveArt(meta, art, mtime) {
  if (!art || !meta.artKey || S.thumbs.has('art:' + meta.artKey)) return;
  const data = await artThumb(art);
  if (!data) return;
  S.thumbs.set('art:' + meta.artKey, data);
  DB.put('thumbs', { path: 'art:' + meta.artKey, data, mtime });
}

/* ---------------- picking ---------------- */
/** File > Add Folder: a new folder joins the ones already on your LANscape (it never replaces them) */
async function openFolder() {
  closeMenus();
  const canPick = typeof window.showDirectoryPicker === 'function' && window.self === window.top;
  if (canPick) {
    try {
      const h = await window.showDirectoryPicker({ id: 'lanscape', mode: 'read' });
      return mountFolder({ handle: h });
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  const inp = $('#dirInput');
  inp.value = '';
  inp.click();
}
$('#dirInput').addEventListener('change', e => {
  const files = Array.from(e.target.files || []);
  e.target.value = ''; // the File objects stay readable; the page's history state no longer carries their paths
  if (!files.length) return;
  const entries = [];
  let root = null;
  for (const f of files) {
    const rp = f.webkitRelativePath || f.name;
    const parts = rp.split('/');
    if (parts.some(SKIP_NAME)) continue;
    if (!root) root = parts.length > 1 ? parts[0] : LOOSE;
    entries.push({ path: parts.length > 1 ? rp : root + '/' + rp, file: f });
    if (entries.length >= MAX_FILES) break;
  }
  if (entries.length) mountFolder({ name: root || LOOSE, entries, mode: 'input' });
});
/** single files join the "Files" folder */
function addLooseFiles(files, mode, opts = {}) {
  return folderLock(() => ingest(LOOSE, files.map(f => ({ path: LOOSE + '/' + f.name, file: f })), Object.assign({ merge: true, mode }, opts)));
}
$('#fileInput').addEventListener('change', e => {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  if (files.length) addLooseFiles(files, 'input');
});
/** list a folder on disk. skip(dirPath) can leave out folders that are turned off */
async function walkHandle(dir, prefix, out, depth, prog, skip) {
  for await (const [name, h] of dir.entries()) {
    if (prog && prog.cancelled) return;
    if (SKIP_NAME(name)) continue;
    if (h.kind === 'directory') { const sub = prefix + name + '/'; if (skip && skip(sub)) continue; if (depth < 12) await walkHandle(h, sub, out, depth + 1, prog, skip); }
    else if (out.length < MAX_FILES) out.push({ path: prefix + name, handle: h });
    if (prog && out.length && out.length % 250 === 0) prog.update(0.02, 'Scanning ' + prefix, out.length + ' files so far');
  }
}
/** kept for older callers: put a folder from a directory handle on the LANscape */
function loadFromHandle(h) { return mountFolder({ handle: h }); }
function readAllEntries(dirEntry) {
  return new Promise((res, rej) => {
    const reader = dirEntry.createReader(), all = [];
    const next = () => reader.readEntries(batch => { if (!batch.length) res(all); else { all.push(...batch); next(); } }, rej);
    next();
  });
}
async function walkEntry(entry, prefix, out, depth) {
  if (SKIP_NAME(entry.name) || out.length >= MAX_FILES) return;
  if (entry.isDirectory) {
    if (depth > 12) return;
    for (const k of await readAllEntries(entry)) await walkEntry(k, prefix + entry.name + '/', out, depth + 1);
  } else {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    out.push({ path: prefix + entry.name, file });
  }
}
function setupDnD() {
  let depth = 0;
  const dz = $('#dropzone');
  const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  addEventListener('dragenter', e => { if (!hasFiles(e)) return; depth++; dz.hidden = false; e.preventDefault(); });
  addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; dz.hidden = true; } });
  addEventListener('drop', async e => {
    depth = 0; dz.hidden = true;
    if (!hasFiles(e)) return;
    e.preventDefault();
    const items = Array.from(e.dataTransfer.items || []).filter(it => it.kind === 'file');
    const grabbed = items.map(it => ({ hp: it.getAsFileSystemHandle ? it.getAsFileSystemHandle() : null, en: it.webkitGetAsEntry ? it.webkitGetAsEntry() : null, f: it.getAsFile() }));
    const loose = [];
    // every folder dropped at once joins the LANscape, one after another
    for (const g of grabbed) {
      let h = null;
      if (g.hp) { try { h = await g.hp; } catch (err) { h = null; } }
      if (h && h.kind === 'directory') { await mountFolder({ handle: h }); continue; }
      if (g.en && g.en.isDirectory) {
        const prog = progressWin('Building your Internet', 'Reading ' + g.en.name + '...');
        const out = [];
        try { await walkEntry(g.en, '', out, 0); } catch (err) { /* read what we could */ }
        if (prog.cancelled) { prog.close(); continue; }
        await mountFolder({ name: g.en.name, entries: out, mode: 'drop', prog });
        continue;
      }
      if (g.f) loose.push(g.f);
    }
    if (loose.length) addLooseFiles(loose, 'drop');
  });
}

/* ---------------- ingesting ---------------- */
const quietProg = () => ({ cancelled: false, update() { }, close() { } });
/** progress in the status bar, for work that happens in the background */
function statusProg(label) {
  return { cancelled: false, update(p, m) { progress((p || 0) * 100); setStatus(m || label); }, close() { progress(0); } };
}
/**
 * Read a listing of files into the LANscape.
 * opts.scope: the folder this listing covers ('Root/' by default, or 'Root/sub/' for one subfolder);
 *   files under it that aren't listed any more are gone. opts.merge: never remove anything (single files).
 * opts.complete: the listing includes the folders that are turned off too (so their gone files can be dropped).
 * opts.quiet: no window, status only when something changed. opts.stay: don't leave the current page.
 * Files whose size and date didn't change keep everything LANscape learned about them.
 */
async function ingest(rootName, entries, opts = {}) {
  const scope = opts.scope || rootName + '/';
  const whole = scope === rootName + '/';
  const prog = opts.prog || (opts.quiet ? quietProg() : progressWin('Building your Internet', 'Reading ' + rootName + '...'));
  const hadUser = S.roots.some(r => r.name !== VROOT);
  applyExclusions();
  // files in folders that are turned off aren't read now; LANscape remembers where they are for this session
  const onEntries = [];
  for (const e of entries) {
    if (!exclusionOf(e.path)) { onEntries.push(e); continue; }
    const src = e.handle || e.file;
    if (!src) continue;
    S.offFiles.set(e.path, src);
    if (S.parked.has(e.path)) { if (e.handle) { S.fh.set(e.path, e.handle); S.live.delete(e.path); } else { S.live.set(e.path, e.file); S.fh.delete(e.path); } }
  }
  const prevMeta = new Map();
  for (const d of S.docs.values()) if (!d.demo && d.root === rootName && d.path.startsWith(scope)) prevMeta.set(d.path, d);
  if (!entries.length && !opts.merge && whole && !opts.allowEmpty) {
    prog.close();
    if (!opts.quiet) msgBox('warn', 'Empty folder', '<p>LANscape didn\'t find any files in <b>' + esc(rootName) + '</b>.</p><p class="hint">Pick a folder with web pages, documents, music, videos or pictures. Subfolders are included automatically.</p>');
    return null;
  }
  // which files belong to a website depends on index pages anywhere in the folder, not just in this listing
  const others = [];
  if (!whole) for (const d of S.docs.values()) if (!d.demo && d.root === rootName && d.kind === 'html' && !d.path.startsWith(scope)) others.push(d.path);
  const gdirs = groupDirs(onEntries.map(e => e.path).concat(others));
  const items = onEntries.map(e => { const name = e.path.split('/').pop(), kind = kindOf(name); return { e, name, kind, asset: !SITE_KIND(kind) && underGroup(e.path, gdirs) }; });
  items.sort((a, b) => (KIND_RANK[a.kind] - KIND_RANK[b.kind]) || (a.e.path < b.e.path ? -1 : 1));
  const seen = new Set(), metaBatch = [], contentBatch = [], counts = {};
  const flush = async () => {
    if (metaBatch.length) await DB.putMany('meta', metaBatch.splice(0));
    if (contentBatch.length) await DB.putMany('content', contentBatch.splice(0));
  };
  let done = 0, added = 0, changed = 0, bytes = 0, cacheBytes = 0, lastUpd = 0;
  const total = items.length || 1;
  const one = async it => {
    const e = it.e;
    let file;
    try { file = e.file || await e.handle.getFile(); } catch (err) { return; }
    const prev = prevMeta.get(e.path);
    const same = !!(prev && prev.meta && !prev.meta.stale && prev.size === file.size && prev.mtime === file.lastModified && prev.kind === it.kind && prev.meta.kind === it.kind && !!prev.meta.light === it.asset);
    let meta, text = null, art = null;
    if (same) meta = prev.meta;
    else {
      try { const r = await extractFor(file, e.path, it.kind, it.asset); meta = r.meta; if (r.text != null) text = r.text; art = r.art || null; }
      catch (err) { meta = extractOther(it.name, e.path, file.size, it.kind); }
      if (it.asset) meta.light = true;
      if (prev) changed++; else added++;
    }
    // the same record object stays in place, so open pages and programs keep pointing at it
    let doc = prev;
    if (!same) {
      const fresh = makeDoc({ path: e.path, size: file.size, mtime: file.lastModified, meta, kind: it.kind });
      doc = prev ? Object.assign(prev, fresh) : fresh;
      if (prev) forgetBlob(e.path);
    }
    registerDoc(doc);
    S.offFiles.delete(doc.path);
    if (e.handle) { S.fh.set(doc.path, e.handle); S.live.delete(doc.path); } else S.live.set(doc.path, file);
    if (!S.firstSeen[doc.path]) S.firstSeen[doc.path] = hadUser ? Date.now() : (file.lastModified || Date.now());
    seen.add(doc.path);
    bytes += file.size;
    counts[it.kind] = (counts[it.kind] || 0) + 1;
    if (!same) metaBatch.push(metaRecord(doc));
    if (S.prefs.cache && !same && cacheable({ kind: it.kind, asset: it.asset }, file.size)) {
      if (textualKind(it.kind, doc.ext)) { if (text == null) { try { text = await blobText(file); } catch (err) { text = null; } } if (text != null) contentBatch.push({ path: doc.path, text }); }
      else if (cacheBytes + file.size <= CACHE_BUDGET) { contentBatch.push({ path: doc.path, blob: file }); cacheBytes += file.size; }
    }
    if (art) await saveArt(meta, art, doc.mtime);
  };
  let next = 0;
  const where = whole ? rootName : scope.slice(0, -1);
  const label = () => 'Indexing ' + where + ': ' + done.toLocaleString() + ' of ' + items.length.toLocaleString() + ' files';
  const worker = async () => {
    while (next < items.length && !prog.cancelled) {
      const it = items[next++];
      await one(it);
      done++;
      if (metaBatch.length >= 60 || contentBatch.length >= 20) await flush();
      const now = performance.now();
      if (now - lastUpd > 120) { lastUpd = now; prog.update(done / total, label(), countWords(counts).join(' · ') + '\n' + it.e.path.slice(rootName.length + 1)); await sleep(0); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, items.length || 1) }, worker));
  await flush();
  let removed = 0;
  if (!prog.cancelled && !opts.merge) {
    const gone = Array.from(prevMeta.keys()).filter(p => !seen.has(p));
    // a full listing also tells us which files in turned-off folders were deleted
    if (opts.complete) { const listed = new Set(entries.map(e => e.path)); for (const p of S.parked.keys()) if (p.startsWith(scope) && !listed.has(p)) gone.push(p); }
    removed = gone.length;
    for (const p of gone) unregister(p);
    if (gone.length) { await DB.delMany('meta', gone); await DB.delMany('content', gone); await DB.delMany('thumbs', gone); await DB.delMany('mthumbs', gone.flatMap(p => MTHUMB_KINDS.map(t => t + p))); }
  }
  const root = noteRoot(rootName, { mode: opts.mode, src: opts.src, synced: whole && !prog.cancelled });
  await DB.put('kv', { k: 'roots', v: S.roots });
  if (opts.handle) { S.rootHandles.set(rootName, opts.handle); await saveHandles(); }
  if (!hadUser && S.prefs.demo) S.prefs.demo = false;
  saveState();
  if (added || changed || removed) {
    // pages hold on to the old copies of pictures and styles; the song that's playing keeps its own
    const playing = typeof Player !== 'undefined' ? Player.currentPath() : null;
    for (const [p, u] of Array.from(S.blobs)) if (p !== playing) { URL.revokeObjectURL(u); S.blobs.delete(p); }
  }
  rebuildAll();
  prog.close();
  const allCounts = root.counts;
  const what = whole ? countWords(allCounts).join(', ') || 'no files' : countWords(counts).join(', ') || 'no files';
  const delta = added || changed || removed ? ' (' + [added && added + ' new', changed && changed + ' updated', removed && removed + ' removed'].filter(Boolean).join(', ') + ')' : '';
  const summary = where + ': ' + what + delta + ' · ' + S.rings.length + ' web rings.';
  const stay = opts.stay || FolderManager.isOpen();
  if (opts.quiet) {
    if (added || changed || removed) { setStatus('Re-synced ' + summary); afterFolderChange(); }
    else if (opts.report) setStatus(where + ' is up to date.');
  } else {
    if (!stay) await go(landingFor(allCounts, rootName)); else afterFolderChange();
    setStatus((opts.verb || 'Loaded') + ' ' + summary + (hadUser || !whole ? '' : ' The Demo Web is hidden (Options menu).'));
    if (S.prefs.deep && !opts.noSpiderPrompt && (added || changed)) setTimeout(offerSpider, 600);
  }
  FolderManager.refresh();
  return { added, changed, removed };
}
/** keep a folder's entry (file counts, how it was opened) up to date */
function noteRoot(name, o = {}) {
  let r = S.roots.find(x => x.name === name);
  if (!r) { r = { name, src: o.src || name, mode: o.mode || 'input', loadedAt: Date.now() }; S.roots.push(r); }
  if (o.mode) r.mode = o.mode;
  if (o.src) r.src = o.src;
  if (o.synced) r.loadedAt = Date.now();
  const counts = {};
  let files = 0, bytes = 0, off = 0, offBytes = 0;
  for (const d of S.docs.values()) if (!d.demo && d.root === name) { files++; bytes += d.size || 0; counts[d.kind] = (counts[d.kind] || 0) + 1; }
  for (const d of S.parked.values()) if (d.root === name) { off++; offBytes += d.size || 0; }
  return Object.assign(r, { files, bytes, counts, off, offBytes });
}
/** after folders change: leave a page whose file just went away, refresh addresses and open dialogs */
function afterFolderChange() {
  if (S.cur && S.cur.doc && !S.cur.doc.demo && !isKnownDoc(S.cur.doc)) { goHome(); return; }
  if (S.cur && S.cur.doc && !S.cur.doc.active && !S.cur.doc.demo) { goHome(); return; }
  afterDNSChange();
}
/** where to land after opening a folder: a music folder opens the Jukebox, and so on */
function landingFor(c, root) {
  const n = k => c[k] || 0;
  const web = Object.keys(c).filter(k => SITE_KIND(k)).reduce((a, k) => a + c[k], 0);
  if (web) return 'http://home.lanscape.net/';
  const best = [['audio', 'http://music.lanscape.net/'], ['video', 'http://www.rewindvideo.com/'], ['image', 'http://photos.lanscape.net/']].sort((a, b) => n(b[0]) - n(a[0]))[0];
  if (n(best[0])) return best[1];
  return S.rootFtp.get(root) ? 'ftp://' + S.rootFtp.get(root) + '/' : 'http://home.lanscape.net/';
}
async function saveHandles() {
  await DB.put('kv', { k: 'handles', v: Array.from(S.rootHandles, ([name, handle]) => ({ name, handle })) });
}
const MTHUMB_KINDS = ['img:', 'poster:', 'frame:'];
/** forget a folder completely: its index, previews and cached copies (ratings, notes and bookmarks stay) */
async function removeRoot(name) {
  const pre = name + '/';
  for (const m of [S.docs, S.parked]) for (const [p, d] of Array.from(m)) if (p.startsWith(pre) && !d.demo) unregister(p);
  for (const p of Array.from(S.offFiles.keys())) if (p.startsWith(pre)) S.offFiles.delete(p);
  await DB.delPrefix('meta', pre);
  await DB.delPrefix('content', pre);
  await DB.delPrefix('thumbs', pre);
  for (const t of MTHUMB_KINDS) await DB.delPrefix('mthumbs', t + pre);
  MThumbs.clear();
  setExcluded(S.excluded.filter(p => !p.startsWith(pre)));
  S.roots = S.roots.filter(r => r.name !== name);
  S.rootHandles.delete(name);
  await DB.put('kv', { k: 'roots', v: S.roots });
  await saveHandles();
  saveState();
}
async function closeFolders() {
  const list = S.roots.filter(r => r.name !== VROOT);
  const v = await msgBox('question', 'Close All Folders', '<p>Disconnect ' + list.map(r => '<b>' + esc(r.name) + '</b>').join(', ') + ' and forget the cached copies?</p><p class="hint">Bookmarks, domain names, guestbooks, ring changes and the files in ' + esc(VROOT) + ' are kept for next time. To put a folder away but keep its index, uncheck it in Manage Folders instead.</p>', ['Close Folders', 'Cancel']);
  if (v !== 'Close Folders') return;
  await folderLock(async () => { for (const r of list) await removeRoot(r.name); });
  S.prefs.demo = true;
  saveState();
  rebuildAll();
  FolderManager.refresh();
  go('http://home.lanscape.net/');
}
async function clearCache() {
  const v = await msgBox('warn', 'Empty the Cache', '<p>Throw away the cached copies of your pages and their previews?</p><p class="hint">Folders you opened this session keep working. Next time you\'ll need to open them again.</p>', ['Empty Cache', 'Cancel']);
  if (v !== 'Empty Cache') return;
  await folderLock(async () => {
    // files in My Documents live only in the cache, so they stay
    const keep = new Map();
    for (const d of S.docs.values()) if (d.root === VROOT) { const rec = await DB.get('content', d.path); if (rec) keep.set(d.path, rec); }
    for (const d of S.parked.values()) if (d.root === VROOT) { const rec = await DB.get('content', d.path); if (rec) keep.set(d.path, rec); }
    await DB.clear('content');
    await DB.clear('thumbs');
    await DB.clear('mthumbs');
    if (keep.size) await DB.putMany('content', Array.from(keep.values()));
    S.thumbs.clear(); S.thumbAt.clear(); MThumbs.clear();
    const live = p => S.live.has(p) || S.fh.has(p);
    const dead = Array.from(S.docs.values()).concat(Array.from(S.parked.values())).filter(d => !d.demo && d.root !== VROOT && !live(d.path)).map(d => d.path);
    for (const p of dead) unregister(p);
    await DB.delMany('meta', dead);
    for (const r of S.roots) noteRoot(r.name);
    S.roots = S.roots.filter(r => r.files + r.off > 0);
    await DB.put('kv', { k: 'roots', v: S.roots });
  });
  rebuildAll();
  FolderManager.refresh();
  setStatus('Cache emptied.');
  if (S.cur && !S.cur.doc) reload();
}
/** File > Re-sync Folders: look for changes in every folder LANscape can re-read by itself */
async function resyncAll(quiet) {
  const roots = diskRoots();
  if (!roots.length) { if (!quiet) openFolder(); return; }
  const needPick = [];
  await folderLock(async () => {
    for (const r of roots) {
      if (exclusionOf(r.name + '/')) continue;   // turned off: nothing to look at
      const res = await resyncNow(r.name + '/', { quiet: true, ask: !quiet });
      if (res && res.needPick) needPick.push(r.name);
    }
  });
  if (quiet) return;
  if (needPick.length) {
    const v = await msgBox('info', 'Re-sync', '<p>Pick <b>' + needPick.map(esc).join(', ') + '</b> again so LANscape can look for changes.</p><p class="hint">Chrome and Edge let LANscape re-read a folder by itself after you allow it once. Other browsers ask you to pick it each time. Nothing LANscape already knows is lost.</p>', ['Pick Folder', 'Cancel']);
    if (v === 'Pick Folder') openFolder();
  } else { setStatus('Re-sync complete. ' + S.sites.length + ' sites on ' + S.rings.length + ' rings.'); if (S.cur && !S.cur.doc) reload(); }
}

/* ---------------- the Spider ---------------- */
const SPIDER_LEGS = 3; // pages crawled at once
const Spider = {
  running: false, workers: [],
  accepts(e, m) { return this.running && this.workers.some(w => w.frame && e.source === w.frame.contentWindow && m.__lan === w.nonce); },
  onMsg(m) {
    const w = this.workers.find(x => x.nonce === m.__lan);
    if (!w || !w.got) return;
    if (m.t === 'deep') w.got.deep = m.text;
    else if (m.t === 'thumb') w.got.thumb = m.data || '';
    if (w.got.deep !== undefined && (w.got.thumb !== undefined || !w.got.wantThumb) && w.done) w.done();
  },
  estimate(n) { return Math.max(1, Math.round(n * 1.7 / SPIDER_LEGS)); },
  async start() {
    if (this.running) { setStatus('The Spider is already crawling.'); return; }
    const docs = docsAll().filter(d => d.kind === 'html' && !isFolded(d));
    let list = docs.filter(d => needsDeep(d) || (S.prefs.previews && needsThumb(d)));
    let media = spiderMediaList();
    if (!list.length && !media.length) {
      if (!docs.length) return;
      const v = await msgBox('info', 'The Spider', '<p>Every page has already been read and has a preview. Crawl them all again?</p>', ['Crawl Again', 'Cancel']);
      if (v !== 'Crawl Again') return;
      list = docs;
    }
    return this.run(list, media);
  },
  async run(list, media) {
    media = media || [];
    this.running = true;
    busy(true);
    const prog = progressWin('The Spider', 'Crawling your LANscape...');
    const legs = Math.min(SPIDER_LEGS, Math.max(list.length, 1));
    this.workers = Array.from({ length: legs }, (_, i) => {
      const f = el('iframe', { sandbox: 'allow-scripts allow-same-origin allow-forms', title: 'Spider ' + (i + 1), referrerpolicy: 'no-referrer' });
      f.style.cssText = 'width:1024px;height:768px;border:0;background:#fff;display:block';
      $('#spiderBox').append(f);
      return { frame: f, nonce: null, got: null, done: null };
    });
    let next = 0, finished = 0, gotText = 0, gotThumb = 0;
    const t0 = performance.now();
    const crawl = async w => {
      while (next < list.length && !prog.cancelled) {
        const d = list[next++];
        w.nonce = 's' + Math.random().toString(36).slice(2);
        const wantThumb = !!S.prefs.previews;
        w.got = { wantThumb };
        let html = null;
        try { html = await rewriteHTML(String(await getContent(d)), d); } catch (e) { html = null; }
        if (html != null) {
          const cfg = { n: w.nonce, url: d.url, spider: true, deep: true, thumb: wantThumb, retro: !!d.demo, counter: S.visits[d.path] || 0, ring: d.site ? ringNavHTML(d.site) : '', lastmod: fmtDate(d.mtime) };
          const done = new Promise(res => { w.done = res; setTimeout(res, 6500); });
          w.frame.srcdoc = injectHelper(html, cfg, !!d.demo);
          await done;
          w.done = null;
          if (w.got.deep !== undefined) { if (!d.demo) applyDeep(d, w.got.deep); gotText++; }
          if (w.got.thumb) { applyThumb(d, w.got.thumb); gotThumb++; }
        }
        finished++;
        const left = list.length - finished;
        const eta = finished > 2 ? Math.round((performance.now() - t0) / finished * left / 1000) : null;
        prog.update(finished / (list.length + media.length), 'Crawling ' + displayUrl(d.url), finished + ' of ' + (list.length + media.length) + (eta != null && left ? ' · about ' + eta + ' seconds left' : ''));
      }
    };
    if (list.length) await Promise.all(this.workers.map(crawl));
    for (const w of this.workers) w.frame.remove();
    this.workers = [];
    // then the PDFs, videos and big pictures: text, previews, posters and thumbnails
    let gotMedia = 0;
    for (const d of media) {
      if (prog.cancelled) break;
      prog.update((finished + gotMedia) / (list.length + media.length), 'Reading ' + d.name, (finished + gotMedia + 1) + ' of ' + (list.length + media.length));
      try {
        if (d.kind === 'pdf') { if (await spiderPdf(d)) { gotText++; gotThumb++; } }
        else if (d.kind === 'video') await learnVideo(d);
        else if (d.kind === 'image') await mediaThumbURL(d);
      } catch (e) { /* skip files that won't open */ }
      gotMedia++;
    }
    this.running = false;
    prog.close();
    busy(false);
    // what the pages really say can change which pages belong together, so re-weave the rings too
    rebuildAll();
    afterDNSChange();
    setStatus('The Spider read ' + gotText + ' pages and painted ' + gotThumb + ' previews' + (media.length ? ', and looked at ' + media.length + ' PDFs, videos and pictures' : '') + '. Rings re-woven: ' + S.rings.length + '.');
    if (S.cur && !S.cur.doc) reload();
  }
};
/** PDFs to read, videos without posters, big pictures without thumbnails */
function spiderMediaList() {
  return docsAll().filter(d => d.active !== false && !d.asset && !isFolded(d) && (
    (d.kind === 'pdf' && (needsDeep(d) || (S.prefs.previews && needsThumb(d)))) ||
    (d.kind === 'video' && !d.demo && !videoProbed(d) && rwCanPlay(d)) ||
    (d.kind === 'image' && !d.demo && (d.size || 0) >= 350e3 && d.ext !== 'svg' && d.ext !== 'gif' && !MThumbs.peek('img:' + d.path))));
}
async function spiderPdf(d) {
  const lib = await Libs.pdfjs();
  const bytes = new Uint8Array(await (await getBlob(d)).arrayBuffer());
  const pdf = await lib.getDocument({ data: bytes, isEvalSupported: false }).promise;
  try {
    if (needsDeep(d)) {
      const parts = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 80); i++) parts.push((await (await pdf.getPage(i)).getTextContent()).items.map(x => x.str).join(' '));
      applyDeep(d, parts.join('\n'));
    }
    if (S.prefs.previews && needsThumb(d)) {
      const page = await pdf.getPage(1), v1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: 240 / v1.width });
      const cv = document.createElement('canvas'); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      applyThumb(d, cv.toDataURL('image/jpeg', 0.75));
    }
    return true;
  } finally { try { pdf.destroy(); } catch (e) { /* gone */ } }
}
async function offerSpider() {
  const n = docsAll().filter(d => (d.kind === 'html' && !isFolded(d) && (needsDeep(d) || (S.prefs.previews && needsThumb(d))))).length + spiderMediaList().length;
  if (n < 3 || Spider.running) return;
  const secs = Spider.estimate(n);
  const v = await msgBox('question', 'Send out the Spider?', '<p>Many single-file tools build their text with JavaScript, so LANscape can\'t see it yet.</p><p>The Spider opens each page in a hidden window for about a second, reads what it shows, paints a preview, and re-weaves the web rings. ' + n + ' pages and files, about ' + (secs < 90 ? secs + ' seconds' : Math.round(secs / 60) + ' minutes') + '.</p>', ['Send out the Spider', 'Not Now']);
  if (v === 'Send out the Spider') Spider.start();
}
