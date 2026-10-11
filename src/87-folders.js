/* ===================================================================
   Folders: add as many as you like, take folders and subfolders off the
   LANscape (keeping everything LANscape learned about them), fold a folder
   into a bigger one that holds it, re-sync one folder at a time, and the
   Folder Manager window.
   =================================================================== */

/* ---------------- one folder job at a time ---------------- */
let folderTail = Promise.resolve();
function folderLock(fn) {
  const run = folderTail.then(() => fn());
  folderTail = run.then(() => {}, () => {});
  return run;
}
/** folders from your disk (not My Documents, not single files) */
const diskRoots = () => S.roots.filter(r => r.name !== VROOT && r.name !== LOOSE);
const depthOf = prefix => prefix.split('/').filter(Boolean).length - 1;
const baseName = dir => dir.slice(0, -1).split('/').pop();
async function readPermission(h, ask) {
  if (!h) return false;
  try {
    if (!h.queryPermission) return true;
    let p = await h.queryPermission({ mode: 'read' });
    if (p !== 'granted' && ask) p = await h.requestPermission({ mode: 'read' });
    return p === 'granted';
  } catch (e) { return false; }
}
/** a name for a new folder that doesn't clash with one already on the LANscape */
function uniqueRootName(name, reusable = []) {
  const taken = new Set(S.roots.filter(r => !reusable.includes(r.name)).map(r => r.name.toLowerCase()));
  for (const x of ['demo', VROOT, LOOSE]) taken.add(x.toLowerCase());
  name = String(name || 'Folder').replace(/\//g, '-') || 'Folder';
  let n = name, k = 2;
  while (taken.has(n.toLowerCase())) n = name + ' (' + k++ + ')';
  return n;
}

/* ---------------- folders that are turned off ---------------- */
let exclSet = null, exclList = null;
/** the turned-off folder a path is in ('Root/sub/'), or null */
function exclusionOf(path) {
  const list = S.excluded;
  if (!list || !list.length || !path) return null;
  if (exclList !== list || !exclSet || exclSet.size !== list.length) { exclSet = new Set(list); exclList = list; }
  for (let i = path.indexOf('/'); i >= 0; i = path.indexOf('/', i + 1)) { const p = path.slice(0, i + 1); if (exclSet.has(p)) return p; }
  return null;
}
function setExcluded(list) {
  S.excluded = uniq(list.filter(p => typeof p === 'string' && p.endsWith('/') && p !== VROOT + '/')).sort();
  exclSet = null;
  saveState();
}
function parkDoc(d) { S.docs.delete(d.path); S.lower.delete(d.path.toLowerCase()); d.active = false; S.parked.set(d.path, d); }
function unparkDoc(d) { S.parked.delete(d.path); registerDoc(d); }
/** move records in and out of the parking lot so they match the folder switches */
function applyExclusions() {
  let moved = 0;
  if (S.excluded.length) for (const d of Array.from(S.docs.values())) if (!d.demo && exclusionOf(d.path)) { parkDoc(d); moved++; }
  for (const d of Array.from(S.parked.values())) if (!exclusionOf(d.path)) { unparkDoc(d); moved++; }
  return moved;
}
/** the folders directly inside dir that LANscape knows about */
function childDirs(dir) {
  const out = new Set();
  const take = p => { if (!p.startsWith(dir) || p.length <= dir.length) return; const i = p.indexOf('/', dir.length); if (i > 0) out.add(p.slice(0, i + 1)); };
  for (const m of [S.docs, S.parked]) for (const d of m.values()) if (!d.demo) take(d.path);
  for (const p of S.offFiles.keys()) take(p);
  for (const p of S.excluded) take(p);
  return out;
}
/** turn one folder on. Folders above it that were off come back only along the way down to it */
function includeOnly(dir) {
  const above = S.excluded.filter(p => p !== dir && dir.startsWith(p));
  const list = S.excluded.filter(p => p !== dir && !above.includes(p));
  for (const a of above) {
    let cur = a;
    while (cur !== dir) {
      const next = dir.slice(0, dir.indexOf('/', cur.length) + 1);
      for (const sib of childDirs(cur)) if (sib !== next) list.push(sib);
      cur = next;
    }
  }
  setExcluded(list);
}
let rebuildTimer = null, rebuildWaiters = [];
/** rebuild the web after a burst of folder switches (several clicks in a row rebuild once) */
function rebuildSoon() {
  return new Promise(res => {
    rebuildWaiters.push(res);
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      const waiting = rebuildWaiters; rebuildWaiters = [];
      rebuildAll();
      afterFolderChange();
      FolderManager.refresh();
      for (const f of waiting) f();
    }, 120);
  });
}
/**
 * Turn a folder off or back on. Off takes it off the LANscape but keeps everything LANscape
 * learned about its files (search text, previews, ratings, notes); on brings it back at once,
 * then quietly looks for changes made while it was off.
 */
async function setFolderOn(dir, on, opts = {}) {
  if (!dir.endsWith('/')) dir += '/';
  if (!on && dir === VROOT + '/') return false;
  const root = dir.split('/')[0];
  if (on) includeOnly(dir);
  else setExcluded(S.excluded.concat([dir]));
  applyExclusions();
  if (S.roots.some(r => r.name === root)) { noteRoot(root); DB.put('kv', { k: 'roots', v: S.roots }); }
  FolderManager.refresh();
  const done = rebuildSoon();
  if (on && !opts.noSync) catchUp(dir);
  await done;
  return true;
}
/** after a folder comes back on: read what changed while it was off */
async function catchUp(dir) {
  const root = dir.split('/')[0];
  const rh = S.rootHandles.get(root);
  if (rh && await readPermission(rh, false)) return resyncFolder(dir, { quiet: true });
  // files seen this session while the folder was off, never read
  const fresh = [];
  for (const [p, src] of S.offFiles) if (p.startsWith(dir) && !exclusionOf(p) && !S.docs.has(p)) fresh.push(src instanceof Blob ? { path: p, file: src } : { path: p, handle: src });
  if (fresh.length) return folderLock(() => ingest(root, fresh, { merge: true, quiet: true, stay: true, noSpiderPrompt: true }));
}

/* ---------------- putting a folder on the LANscape ---------------- */
/**
 * src: {handle} from Chrome or Edge, or {name, entries, mode, prog} from the file picker or drag & drop.
 * Adding never replaces anything. The same folder again is a re-sync. A folder inside one that's
 * already on the LANscape is refreshed in place. A folder that holds folders already on the
 * LANscape takes them in, keeping everything LANscape knew about their files.
 */
function mountFolder(src) {
  return folderLock(() => mountNow(src)).catch(e => {
    console.error(e);
    if (src.prog) src.prog.close();
    msgBox('error', 'Add Folder', '<p>LANscape couldn\'t add that folder.</p><p class="hint">' + esc(e && e.message || e) + '</p>');
    return null;
  });
}
async function mountNow(src) {
  const handle = src.handle || null;
  const name = handle ? handle.name : src.name;
  const mode = handle ? 'fs' : (src.mode || 'input');
  let prog = src.prog || null;
  let entries = handle ? [] : (src.entries || []);
  const disk = diskRoots();
  let target = null;                       // { root, prefix, how: 'same' | 'inside' | 'new' }
  const absorb = new Map();                // folders on the LANscape that sit inside this one -> where, relative to it
  const settled = new Set();               // folders the browser compared for us
  // 1. Chrome and Edge can say exactly how two folders on disk relate
  if (handle) {
    for (const r of disk) {
      const rh = S.rootHandles.get(r.name);
      if (!rh || !rh.isSameEntry) continue;
      try {
        if (await rh.isSameEntry(handle)) { target = { root: r.name, prefix: r.name + '/', how: 'same' }; break; }
        const a = rh.resolve ? await rh.resolve(handle) : null;
        if (a && a.length) { target = { root: r.name, prefix: r.name + '/' + a.join('/') + '/', how: 'inside' }; break; }
        settled.add(r.name);
      } catch (e) { /* can't tell from here: compare names and files below */ }
    }
    if (target) settled.add(target.root);
    if (!target || target.how === 'same') for (const r of disk) {
      if (target && r.name === target.root) continue;
      const rh = S.rootHandles.get(r.name);
      if (!rh || !handle.resolve) continue;
      try { const b = await handle.resolve(rh); if (b && b.length) absorb.set(r.name, b.join('/') + '/'); }
      catch (e) { settled.delete(r.name); }
    }
    if (target) includeOnly(target.prefix);
  }
  // 2. read the folder
  const base = target ? target.prefix : name + '/';
  let pruned = false;
  if (handle) {
    prog = prog || progressWin('Building your Internet', 'Scanning ' + name + '...');
    const skip = target ? p => { if (exclusionOf(p)) { pruned = true; return true; } return false; } : null;
    try { await walkHandle(handle, base, entries, depthOf(base), prog, skip); }
    catch (e) { prog.close(); msgBox('error', 'Add Folder', '<p>LANscape couldn\'t read that folder.</p><p class="hint">' + esc(e && e.message || e) + '</p>'); return null; }
    if (prog.cancelled) { prog.close(); return null; }
  }
  // 3. folders LANscape can't compare by handle: match by name and by the files inside
  const cache = new Map();
  const unsettled = disk.filter(r => !settled.has(r.name) && !absorb.has(r.name));
  if (!target) {
    const t = await guessTarget(name, entries, base, unsettled, cache);
    if (t === 'cancel') { if (prog) prog.close(); return null; }
    target = t;
  }
  if (!target || target.how === 'same') for (const [q, rel] of await guessContained(entries, base, unsettled.filter(r => !target || r.name !== target.root), cache)) absorb.set(q, rel);
  if (!target) { const root = uniqueRootName(name, Array.from(absorb.keys())); target = { root, prefix: root + '/', how: 'new' }; }
  // 4. the listing takes the folder's place on the LANscape
  if (target.prefix !== base) for (const e of entries) e.path = target.prefix + e.path.slice(base.length);
  // 5. a folder you add is on, even if you had turned it off
  includeOnly(target.prefix);
  // 6. folders it holds join it, bringing everything LANscape knew about them
  const folded = [];
  for (const [q, rel] of absorb) { await rehomeRoot(q, target.prefix + rel); folded.push(q); }
  // 7. read it in (unchanged files keep their index)
  const res = await ingest(target.root, entries, {
    scope: target.prefix, prog,
    mode: target.how === 'new' ? mode : target.how === 'same' && handle ? 'fs' : null,
    handle: target.how === 'inside' ? null : handle,
    src: target.how === 'new' ? name : null,
    complete: !pruned,
    allowEmpty: target.how !== 'new',
    verb: target.how === 'new' ? 'Loaded' : 'Re-synced',
    stay: target.how === 'inside' || undefined
  });
  if (target.how === 'inside') setStatus(name + ' is already part of ' + target.root + ' on your LANscape (' + target.prefix.slice(0, -1) + '), so LANscape refreshed it there.');
  if (folded.length) setStatus(folded.join(', ') + (folded.length === 1 ? ' is' : ' are') + ' now part of ' + target.root + '. Everything LANscape knew about ' + (folded.length === 1 ? 'it' : 'them') + ' came along.');
  return res;
}
/** how much a listing matches what LANscape has under a folder (sizes are compared where it's cheap) */
async function overlap(existingPrefix, entries, entryPrefix, cache) {
  let have = cache && cache.get(existingPrefix);
  if (!have) {
    have = new Map();
    for (const m of [S.docs, S.parked]) for (const d of m.values()) if (!d.demo && d.path.startsWith(existingPrefix)) have.set(d.path.slice(existingPrefix.length), d.size || 0);
    if (cache) cache.set(existingPrefix, have);
  }
  let n = 0, hit = 0, checks = 0;
  for (const e of entries) {
    if (!e.path.startsWith(entryPrefix)) continue;
    n++;
    const sz = have.get(e.path.slice(entryPrefix.length));
    if (sz == null) continue;
    if (e.file) { if (e.file.size === sz) hit++; }
    else if (e.handle && checks < 400) { checks++; try { if ((await e.handle.getFile()).size === sz) hit++; } catch (err) { /* unreadable */ } }
    else hit++;
  }
  return { hit, existing: have.size, incoming: n, covered: have.size ? hit / have.size : 0, ratio: Math.max(have.size ? hit / have.size : 0, n ? hit / n : 0) };
}
/** folders below prefix (on the LANscape or parked) called name */
function dirsNamed(prefix, name) {
  const out = new Set();
  const take = p => { for (let i = p.indexOf('/', prefix.length); i >= 0; i = p.indexOf('/', i + 1)) { const d = p.slice(0, i + 1); if (baseName(d) === name) out.add(d); } };
  for (const m of [S.docs, S.parked]) for (const d of m.values()) if (!d.demo && d.path.startsWith(prefix)) take(d.path);
  for (const p of S.excluded) if (p.startsWith(prefix)) take(p);
  return Array.from(out);
}
/** the same folder again, or a folder inside one that's already here? (for folders opened without disk access) */
async function guessTarget(name, entries, base, cands, cache) {
  const sameName = cands.filter(r => r.name === name || r.src === name);
  for (const r of sameName) {
    const ov = await overlap(r.name + '/', entries, base, cache);
    if (!ov.existing || ov.ratio >= 0.5) return { root: r.name, prefix: r.name + '/', how: 'same' };
  }
  let best = null;
  for (const r of cands) for (const dir of dirsNamed(r.name + '/', name)) {
    const ov = await overlap(dir, entries, base, cache);
    if (ov.hit && ov.ratio >= 0.6 && (!best || ov.ratio > best.ratio)) best = { root: r.name, prefix: dir, how: 'inside', ratio: ov.ratio };
  }
  if (best) return best;
  if (sameName.length) {
    const r = sameName[0];
    const v = await msgBox('question', 'Add Folder', '<p>There\'s already a folder called <b>' + esc(r.name) + '</b> on your LANscape, but this one holds different files.</p><p>Is it the same folder?</p><p class="hint"><b>Same Folder</b> updates it, dropping files that are gone. <b>Different Folder</b> adds this one next to it as <b>' + esc(uniqueRootName(name)) + '</b>.</p>', ['Same Folder', 'Different Folder', 'Cancel']);
    if (v === 'Same Folder') return { root: r.name, prefix: r.name + '/', how: 'same' };
    if (v !== 'Different Folder') return 'cancel';
  }
  return null;
}
/** folders already on the LANscape that this new folder holds: [[root, relative dir]] */
async function guessContained(entries, base, cands, cache) {
  const out = [];
  if (!cands.length || !entries.length) return out;
  const byName = new Map();
  for (const e of entries) for (let i = e.path.indexOf('/', base.length); i >= 0; i = e.path.indexOf('/', i + 1)) {
    const d = e.path.slice(0, i + 1), nm = baseName(d);
    if (!byName.has(nm)) byName.set(nm, new Set());
    byName.get(nm).add(d);
  }
  for (const r of cands) {
    const dirs = new Set([...(byName.get(r.name) || []), ...(byName.get(r.src) || [])]);
    let best = null;
    for (const d of dirs) { const ov = await overlap(r.name + '/', entries, d, cache); if (ov.hit && ov.covered >= 0.6 && (!best || ov.covered > best.covered)) best = { d, covered: ov.covered }; }
    if (best) out.push([r.name, best.d.slice(base.length)]);
  }
  return out;
}

/* ---------------- folding one folder into another ---------------- */
function moveKeys(map, rp) {
  const mv = [];
  for (const [k, v] of map) { const nk = rp(k); if (nk !== k) mv.push([k, nk, v]); }
  for (const [k] of mv) map.delete(k);
  for (const [, nk, v] of mv) map.set(nk, v);
}
function rekey(obj, rpk, rpv) {
  const out = {}, later = [];
  for (const k in obj || {}) { const nk = rpk(k), v = rpv ? rpv(obj[k]) : obj[k]; if (nk === k) out[k] = v; else later.push([nk, v]); }
  for (const [nk, v] of later) out[nk] = v;
  return out;
}
async function rekeyKV(k, fn) { const r = await DB.get('kv', k); if (r && r.v != null) await DB.put('kv', { k, v: fn(r.v) }); }
/**
 * A folder becomes part of a bigger folder: 'Music/...' moves to 'Home/Media/Music/...'. Every record keyed by
 * path moves with it (index, search text, previews, posters, ratings, play counts, playlists, resume points,
 * visits, PDF mark-ups, domain names, guestbooks), so nothing has to be read again.
 */
async function rehomeRoot(from, toPrefix) {
  const fromPrefix = from + '/';
  if (fromPrefix === toPrefix) return;
  const rp = p => (typeof p === 'string' && p.startsWith(fromPrefix) ? toPrefix + p.slice(fromPrefix.length) : p);
  const rk = k => (typeof k === 'string' && k.startsWith('auto:') ? 'auto:' + rp(k.slice(5)) : rp(k));
  const moving = [];
  for (const m of [S.docs, S.parked]) for (const d of m.values()) if (!d.demo && d.path.startsWith(fromPrefix)) moving.push([m, d]);
  for (const [m, d] of moving) { m.delete(d.path); if (m === S.docs) S.lower.delete(d.path.toLowerCase()); }
  for (const [m, d] of moving) {
    const np = rp(d.path);
    // an older copy of the same file (indexed twice by an earlier LANscape) gives way
    S.docs.delete(np); S.parked.delete(np); S.lower.delete(np.toLowerCase());
    d.path = np; d.dir = np.slice(0, np.length - d.name.length); d.root = np.split('/')[0]; d.depth = depthOf(d.dir);
    if (m === S.docs) registerDoc(d); else S.parked.set(np, d);
  }
  for (const m of [S.fh, S.live, S.thumbs, S.thumbAt, S.blobs, S.offFiles]) moveKeys(m, rp);
  for (const k of ['music', 'videoPos', 'visits', 'firstSeen', 'guestbook', 'dns']) S[k] = rekey(S[k], rp);
  S.ringNames = rekey(S.ringNames, rk);
  S.ringMoves = rekey(S.ringMoves, rp, rk);
  S.recentDocs = (S.recentDocs || []).map(x => Object.assign({}, x, { path: rp(x.path) }));
  for (const pl of S.playlists || []) pl.paths = (pl.paths || []).map(rp);
  for (const e of S.tab.stack) if (e.path) e.path = rp(e.path);
  // which copy is the main one, and which files you said are their own thing
  const fr = foldRules();
  fr.keep = fr.keep.map(rp); fr.split = fr.split.map(rp); fr.join = fr.join.map(([x, y]) => [rp(x), rp(y)]);
  setExcluded(S.excluded.map(rp));
  await DB.movePrefix('meta', fromPrefix, toPrefix, v => { v.root = String(v.path).split('/')[0]; });
  await DB.movePrefix('content', fromPrefix, toPrefix);
  await DB.movePrefix('thumbs', fromPrefix, toPrefix);
  for (const t of MTHUMB_KINDS) await DB.movePrefix('mthumbs', t + fromPrefix, t + toPrefix);
  await DB.movePrefix('kv', 'annots:' + fromPrefix, 'annots:' + toPrefix);
  await rekeyKV('photos:rot', o => rekey(o, rp));
  await rekeyKV('rewind:mylist', a => (Array.isArray(a) ? a.map(rp) : a));
  MThumbs.clear();
  if (typeof Player !== 'undefined' && Player.remap) Player.remap(rp);
  S.roots = S.roots.filter(r => r.name !== from);
  S.rootHandles.delete(from);
  await saveHandles();
  await DB.put('kv', { k: 'roots', v: S.roots });
  saveState();
}

/* ---------------- re-sync one folder ---------------- */
/** look for changes in one folder and the folders inside it (Chrome and Edge) */
function resyncFolder(dir, opts = {}) { return folderLock(() => resyncNow(dir, opts)); }
async function resyncNow(dir, opts = {}) {
  if (!dir.endsWith('/')) dir += '/';
  const root = dir.split('/')[0];
  const rh = S.rootHandles.get(root);
  if (!rh || !(await readPermission(rh, !!opts.ask))) return { needPick: true, root };
  const rel = dir.slice(root.length + 1).split('/').filter(Boolean);
  let h = rh;
  try { for (const seg of rel) h = await h.getDirectoryHandle(seg); }
  catch (e) { if (!e || e.name !== 'NotFoundError') return { failed: true }; h = null; }   // gone from disk
  const label = dir.slice(0, -1);
  const prog = opts.quiet ? statusProg('Re-syncing ' + label + '...') : progressWin('Re-syncing ' + label, 'Scanning for changes...');
  const out = [];
  let pruned = false;
  if (h) {
    try { await walkHandle(h, dir, out, rel.length, prog, p => { if (exclusionOf(p)) { pruned = true; return true; } return false; }); }
    catch (e) { prog.close(); return { failed: true }; }
  }
  if (prog.cancelled) { prog.close(); return { cancelled: true }; }
  const res = await ingest(root, out, { scope: dir, mode: 'fs', prog, quiet: !!opts.quiet, stay: true, allowEmpty: true, complete: !pruned, report: !!opts.report, verb: 'Re-synced', noSpiderPrompt: !!opts.quiet });
  return res || {};
}

/* ---------------- removing a folder ---------------- */
async function removeFolder(name) {
  if (!name || name === VROOT) return null;
  const body = el('div', { class: 'msg', html: ICON.question + '<div><p>Take <b>' + esc(name) + '</b> off your LANscape?</p>' +
    '<label class="check"><input type="radio" name="rmHow" value="keep" checked><span><b>Keep its index</b><br><span class="hint">It stays in Manage Folders, unchecked. Check it again and it comes back instantly: search text, previews, ratings and all.</span></span></label>' +
    '<label class="check"><input type="radio" name="rmHow" value="forget"><span><b>Forget it</b><br><span class="hint">Deletes its index, previews and cached copies. Ratings, play counts, PDF notes and bookmarks are kept in case you add it again.</span></span></label></div>' });
  const w = openWin({ title: 'Remove Folder', body, width: 'min(500px, 94vw)', buttons: [{ label: 'Remove', primary: true, value: 'ok' }, { label: 'Cancel', value: null }] });
  if (await w.result !== 'ok') return null;
  const how = (body.querySelector('input[name=rmHow]:checked') || {}).value || 'keep';
  if (how === 'keep') {
    await setFolderOn(name + '/', false);
    setStatus(name + ' is off your LANscape. Its index is kept: check it in Manage Folders to bring it back.');
    return 'off';
  }
  await folderLock(() => removeRoot(name));
  if (!S.roots.some(r => r.name !== VROOT)) S.prefs.demo = true;
  saveState();
  rebuildAll();
  afterFolderChange();
  FolderManager.refresh();
  setStatus('LANscape forgot ' + name + '.');
  return 'forgot';
}

/* ---------------- the Folder Manager ---------------- */
const FM_CSS = `.fm-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 6px}
.fm-bar .btnsm svg{width:16px;height:16px;flex:none}
.fm-bar .sep{width:1px;align-self:stretch;margin:2px 2px;box-shadow:1px 0 var(--hilite);background:var(--shadow)}
.fm-tree{height:min(50vh,400px);overflow:auto;background:var(--field);color:var(--field-text);padding:0 0 2px;outline:none}
.fm-tree:focus-visible{outline:1px dotted var(--text);outline-offset:-3px}
.fm-head,.fm-row{display:grid;grid-template-columns:minmax(0,1fr) 128px 76px 112px;align-items:center;gap:0 8px;padding:0 8px 0 0;white-space:nowrap}
.fm-head{position:sticky;top:0;z-index:1;background:var(--face);color:var(--text);min-height:20px;box-shadow:inset -1px -1px var(--dk),inset 1px 1px var(--hilite)}
.fm-head span{padding:2px 4px}.fm-head span:first-child{padding-left:8px}
.fm-row{min-height:22px;cursor:default;user-select:none}
.fm-name{display:flex;align-items:center;gap:3px;min-width:0;padding-left:calc(var(--d,0) * 18px + 4px)}
.fm-tw{width:14px;height:16px;border:0;background:none;padding:0;font:10px/16px var(--ui-font);color:inherit;flex:none;cursor:pointer}
.fm-tw:disabled{visibility:hidden}
.fm-cb{appearance:none;-webkit-appearance:none;width:13px;height:13px;margin:0 3px 0 1px;flex:none;cursor:pointer;background:var(--field) center/7px 7px no-repeat;box-shadow:inset -1px -1px var(--hilite),inset 1px 1px var(--shadow),inset -2px -2px var(--face-hi),inset 2px 2px var(--dk)}
.fm-cb:checked{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 7 7' shape-rendering='crispEdges'%3E%3Cpath d='M6 0h1v2H6zM5 1h1v3H5zM4 2h1v3H4zM3 3h1v3H3zM2 4h1v3H2zM1 3h1v3H1zM0 2h1v3H0z' fill='%23000'/%3E%3C/svg%3E")}
.fm-cb:indeterminate{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 7 7' shape-rendering='crispEdges'%3E%3Cpath d='M6 0h1v2H6zM5 1h1v3H5zM4 2h1v3H4zM3 3h1v3H3zM2 4h1v3H2zM1 3h1v3H1zM0 2h1v3H0z' fill='%23808080'/%3E%3C/svg%3E"),repeating-conic-gradient(#c0c0c0 0 25%,#fff 0 50%);background-size:7px 7px,2px 2px;background-repeat:no-repeat,repeat}
:root[data-theme="night"] .fm-cb:checked{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 7 7' shape-rendering='crispEdges'%3E%3Cpath d='M6 0h1v2H6zM5 1h1v3H5zM4 2h1v3H4zM3 3h1v3H3zM2 4h1v3H2zM1 3h1v3H1zM0 2h1v3H0z' fill='%23e7e9f0'/%3E%3C/svg%3E")}
.fm-cb:disabled{background-color:var(--face);cursor:default}
.fm-cb:focus-visible{outline:1px dotted var(--text);outline-offset:1px}
.fm-name svg{flex:none}
.fm-nm{overflow:hidden;text-overflow:ellipsis}
.fm-row.top .fm-nm{font-weight:bold}
.fm-n,.fm-sz{text-align:right;font-variant-numeric:tabular-nums}
.fm-st{font-size:11px;overflow:hidden;text-overflow:ellipsis}
.fm-st i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;vertical-align:0;background:#808080;box-shadow:inset -1px -1px rgba(0,0,0,.35)}
.fm-st i.live{background:#1fbf2f}.fm-st i.ask{background:#f0b400}.fm-st i.snap{background:#3d86f0}.fm-st i.off{background:#c62828}
.fm-row.off .fm-nm,.fm-row.off .fm-n,.fm-row.off .fm-sz{color:var(--muted)}
.fm-row.dim{opacity:.55}
.fm-row.sel{background:var(--sel);color:var(--sel-text)}
.fm-row.sel .fm-nm,.fm-row.sel .fm-n,.fm-row.sel .fm-sz{color:var(--sel-text)}
.fm-row.demo{border-top:1px dotted var(--shadow);margin-top:3px}
.fm-foot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:6px}
.fm-empty{padding:28px 12px;text-align:center;color:var(--muted)}
@media (max-width:640px){.fm-head,.fm-row{grid-template-columns:minmax(0,1fr) 72px 82px;gap:0 6px}.fm-sz,.fm-head .h-sz,.fm-st .more,.fm-n .of{display:none}}`;
const FM_ICON = {
  add: '<svg viewBox="0 0 24 24"><path d="M2 6.5h7l2 2h10.5v12H2z" fill="#e0a800" stroke="#5c4300"/><path d="M2 20.5 5 11h18l-3 9.5z" fill="#ffd966" stroke="#5c4300" stroke-linejoin="round"/><circle cx="18" cy="6" r="5" fill="#2fbf4a" stroke="#0b3d15"/><path d="M18 3.4v5.2M15.4 6h5.2" stroke="#fff" stroke-width="1.8"/></svg>',
  remove: '<svg viewBox="0 0 24 24"><path d="M2 6.5h7l2 2h10.5v12H2z" fill="#e0a800" stroke="#5c4300"/><circle cx="17.5" cy="15" r="5.5" fill="#d81e1e" stroke="#4a0606"/><path d="M15 12.5l5 5M20 12.5l-5 5" stroke="#fff" stroke-width="1.8"/></svg>',
  open: '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="18" fill="#fff" stroke="#222"/><rect x="2" y="3" width="20" height="4" fill="#000080"/><path d="M5 10h6M5 13h9M5 16h7" stroke="#555"/></svg>',
  drive: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1 4h5l1 1.5h8V12H1z" fill="#f2c94c" stroke="#8a6d00"/><path d="M8 12v2.5M4.5 14.5h7" stroke="#333" stroke-width="1.2"/></svg>',
  web: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="#4aa3ff" stroke="#08306b"/><path d="M3 6c2 0 3 1 3 3s2 2 2 4M9 2c0 2 2 2 3 3s2 1 2.4 2.6" stroke="#2c7a3a" stroke-width="2" fill="none"/></svg>'
};
const FolderManager = (() => {
  let w = null, sel = null, styled = false, model = null;
  const expanded = new Set();
  const perms = new Map();
  const isOpen = () => !!(w && w.el.isConnected);
  const DEMO_ROW = 'demo:';
  const userDocsOn = () => { for (const d of S.docs.values()) if (!d.demo) return true; return false; };
  /** every folder LANscape knows: files on and off, bytes, subfolders */
  function buildModel() {
    const nodes = new Map();
    const node = p => {
      let n = nodes.get(p);
      if (!n) {
        const parts = p.split('/').filter(Boolean);
        n = { path: p, name: parts[parts.length - 1] || p, depth: parts.length - 1, kids: new Set(), on: 0, off: 0, bytes: 0 };
        nodes.set(p, n);
        if (parts.length > 1) node(parts.slice(0, -1).join('/') + '/').kids.add(p);
      }
      return n;
    };
    const add = (d, off) => { for (let dir = d.dir; dir; dir = parentDir(dir)) { const n = node(dir); if (off) n.off++; else n.on++; n.bytes += d.size || 0; } };
    for (const d of S.docs.values()) if (!d.demo) add(d, false);
    for (const d of S.parked.values()) add(d, true);
    for (const p of S.excluded) node(p);
    for (const r of S.roots) node(r.name + '/');
    return nodes;
  }
  function tops() {
    const order = S.roots.map(r => r.name).filter(n => n !== VROOT && n !== LOOSE);
    for (const n of model.values()) if (n.depth === 0 && !order.includes(n.name) && n.name !== VROOT && n.name !== LOOSE) order.push(n.name);
    if (model.has(LOOSE + '/')) order.push(LOOSE);
    if (model.has(VROOT + '/')) order.push(VROOT);
    return order.map(n => model.get(n + '/')).filter(Boolean);
  }
  const kidsOf = n => Array.from(n.kids).map(p => model.get(p)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  function rootStatus(n) {
    const name = n.name;
    if (exclusionOf(n.path)) return ['off', 'Off · index kept', 'Taken off your LANscape. Check it to bring it back with everything LANscape knew about it.'];
    if (name === VROOT) return ['', 'In this browser', 'Files you save from LANscape programs. They live in this browser\'s storage, not on your disk.'];
    if (name === LOOSE) return ['snap', 'Single files', 'Files you opened or dropped one at a time.'];
    const h = S.rootHandles.get(name);
    if (h) return perms.get(name) === 'granted' ? ['live', 'Live', 'LANscape can re-read this folder by itself, so Re-sync is one click.'] : ['ask', 'Needs your OK', 'Your browser asks once per visit before LANscape can re-read this folder. Re-sync or check it to allow.'];
    return ['snap', 'Snapshot', 'Opened with the file picker or by dragging, so LANscape can\'t look for changes by itself. Re-sync asks you to pick it again. What it already knows is kept.'];
  }
  function rowHTML(n, depth) {
    const off = exclusionOf(n.path), self = off === n.path, inherited = !!off && !self;
    const partly = !off && (n.off > 0 || S.excluded.some(p => p !== n.path && p.startsWith(n.path)));
    const hasKids = n.kids.size > 0, top = depth === 0, isV = n.path === VROOT + '/';
    const total = n.on + n.off;
    const count = (partly ? n.on.toLocaleString() + '<span class="of"> of ' + total.toLocaleString() + '</span>' : total.toLocaleString()) + ' file' + (total === 1 ? '' : 's');
    let st = ['', '', ''];
    if (top) st = rootStatus(n);
    else if (self) st = ['off', 'Off · index kept', 'Taken off your LANscape. LANscape kept its index.'];
    else if (partly) st = ['', 'Partly off', 'Some folders inside are turned off.'];
    const label = (off ? 'Turn on ' : 'Turn off ') + n.name;
    return '<div class="fm-row' + (sel === n.path ? ' sel' : '') + (off ? ' off' : '') + (inherited ? ' dim' : '') + (top ? ' top' : '') + '" role="treeitem" id="fmr' + hash32(n.path) + '" aria-level="' + (depth + 1) + '" aria-selected="' + (sel === n.path) + '"' + (hasKids ? ' aria-expanded="' + expanded.has(n.path) + '"' : '') + ' data-p="' + esc(n.path) + '" style="--d:' + depth + '">' +
      '<span class="fm-name"><button type="button" class="fm-tw" tabindex="-1" aria-hidden="true"' + (hasKids ? '' : ' disabled') + '>' + (hasKids ? (expanded.has(n.path) ? '&#9662;' : '&#9656;') : '') + '</button>' +
      '<input type="checkbox" class="fm-cb" tabindex="-1"' + (off ? '' : ' checked') + (inherited || isV ? ' disabled' : '') + (partly ? ' data-partly="1"' : '') + ' aria-label="' + esc(label) + '" title="' + esc(isV ? VROOT + ' is always on' : inherited ? 'A folder above this one is off' : label) + '">' +
      (top ? FM_ICON.drive : FILE_ICON.folder) + '<span class="fm-nm" title="' + esc(n.path.slice(0, -1)) + '">' + esc(n.name) + '</span></span>' +
      '<span class="fm-n">' + count + '</span><span class="fm-sz">' + fmtBytes(n.bytes) + '</span><span class="fm-st" title="' + esc(st[2]) + '">' + (st[1] ? '<i class="' + st[0] + '"></i>' : '') + esc(st[1]).replace(' · ', '<span class="more"> · ') + (st[1].includes(' · ') ? '</span>' : '') + '</span></div>';
  }
  function demoRowHTML() {
    const n = Array.from(S.docs.values()).filter(d => d.demo).length;
    const forced = !userDocsOn();
    const on = S.prefs.demo || forced;
    return '<div class="fm-row top demo' + (sel === DEMO_ROW ? ' sel' : '') + (on ? '' : ' off') + '" role="treeitem" id="fmrdemo" aria-level="1" aria-selected="' + (sel === DEMO_ROW) + '" data-p="' + DEMO_ROW + '" style="--d:0">' +
      '<span class="fm-name"><button type="button" class="fm-tw" tabindex="-1" aria-hidden="true" disabled></button><input type="checkbox" class="fm-cb" tabindex="-1"' + (on ? ' checked' : '') + (forced ? ' disabled' : '') + ' aria-label="Show the Demo Web" title="' + (forced ? 'The Demo Web shows until one of your folders is on' : 'Show the Demo Web') + '">' + FM_ICON.web + '<span class="fm-nm">Demo Web</span></span>' +
      '<span class="fm-n">' + n.toLocaleString() + ' files</span><span class="fm-sz"></span><span class="fm-st" title="Sample sites, songs, videos and documents built into LANscape">' + (forced ? 'Showing for now' : on ? 'Showing' : 'Hidden') + '</span></div>';
  }
  const visibleRows = () => Array.from(w.el.querySelectorAll('.fm-row'));
  function selInfo() {
    if (!sel || sel === DEMO_ROW) return { demo: sel === DEMO_ROW };
    const root = sel.split('/')[0];
    return { path: sel, root, top: depthOf(sel) === 0, vroot: root === VROOT, loose: root === LOOSE, off: !!exclusionOf(sel), known: model && model.has(sel) };
  }
  function syncButtons() {
    if (!isOpen()) return;
    const s = selInfo(), b = id => w.el.querySelector('#' + id);
    b('fmResync').disabled = !s.path || s.vroot || s.loose || s.off;
    b('fmRemove').disabled = !s.path || !s.top || s.vroot;
    b('fmOpen').disabled = !(s.demo || (s.path && !s.off));
  }
  function render() {
    if (!isOpen()) return;
    model = buildModel();
    const tree = w.el.querySelector('.fm-tree');
    const top = tops();
    if (sel && sel !== DEMO_ROW && !model.has(sel)) sel = null;
    let html = '<div class="fm-head" aria-hidden="true"><span>Folder</span><span style="text-align:right">Files</span><span class="h-sz" style="text-align:right">Size</span><span>Status</span></div>';
    const visit = (n, depth) => { html += rowHTML(n, depth); if (expanded.has(n.path)) for (const k of kidsOf(n)) visit(k, depth + 1); };
    for (const n of top) visit(n, 0);
    if (!top.length) html += '<div class="fm-empty">No folders yet. Click <b>Add Folder</b> to put one on your LANscape.</div>';
    html += demoRowHTML();
    const y = tree.scrollTop;
    tree.innerHTML = html;
    tree.scrollTop = y;
    for (const cb of tree.querySelectorAll('.fm-cb[data-partly]')) cb.indeterminate = true;
    tree.setAttribute('aria-activedescendant', sel ? (sel === DEMO_ROW ? 'fmrdemo' : 'fmr' + hash32(sel)) : '');
    // the line under the tree
    let on = 0, off = 0;
    for (const d of S.docs.values()) if (!d.demo) on++;
    off = S.parked.size;
    const folders = top.filter(n => n.name !== VROOT && n.name !== LOOSE).length;
    w.el.querySelector('.fm-sum').textContent = folders + ' folder' + (folders === 1 ? '' : 's') + ' · ' + on.toLocaleString() + ' file' + (on === 1 ? '' : 's') + ' on your LANscape' + (off ? ' · ' + off.toLocaleString() + ' in folders that are off (index kept)' : '');
    syncButtons();
  }
  async function checkPerms() {
    for (const r of diskRoots()) {
      const h = S.rootHandles.get(r.name);
      let p = 'none';
      if (h) { try { p = h.queryPermission ? await h.queryPermission({ mode: 'read' }) : 'granted'; } catch (e) { p = 'prompt'; } }
      perms.set(r.name, p);
    }
  }
  function select(p, scroll) {
    sel = p;
    const tree = w.el.querySelector('.fm-tree');
    for (const r of tree.querySelectorAll('.fm-row')) { const on = r.dataset.p === p; r.classList.toggle('sel', on); r.setAttribute('aria-selected', String(on)); if (on && scroll) r.scrollIntoView({ block: 'nearest' }); }
    tree.setAttribute('aria-activedescendant', p ? (p === DEMO_ROW ? 'fmrdemo' : 'fmr' + hash32(p)) : '');
    syncButtons();
  }
  function toggleOpen(p, want) {
    const n = model.get(p);
    if (!n || !n.kids.size) return false;
    const now = expanded.has(p), next = want == null ? !now : want;
    if (now === next) return false;
    if (next) expanded.add(p); else expanded.delete(p);
    render();
    return true;
  }
  async function toggleOn(p) {
    if (p === DEMO_ROW) {
      if (!userDocsOn()) return;
      S.prefs.demo = !S.prefs.demo;
      saveState(); rebuildAll(); afterFolderChange(); render();
      setStatus(S.prefs.demo ? 'The Demo Web is back on your LANscape.' : 'The Demo Web is hidden.');
      return;
    }
    const off = exclusionOf(p);
    if (off && off !== p) { setStatus('A folder above ' + baseName(p) + ' is off. Turn that one on first.'); return; }
    if (p === VROOT + '/') return;
    const name = p.slice(0, -1);
    if (off) {
      // turning a folder back on is a good moment for the browser to ask about re-reading it
      const rh = S.rootHandles.get(p.split('/')[0]);
      if (rh) await readPermission(rh, true);
      await checkPerms();
      await setFolderOn(p, true);
      setStatus(name + ' is back on your LANscape.');
    } else {
      await setFolderOn(p, false);
      setStatus(name + ' is off your LANscape. LANscape kept its index, so turning it back on is instant.');
    }
  }
  async function resyncSel() {
    const s = selInfo();
    if (!s.path || s.off) return;
    const res = S.rootHandles.has(s.root) ? await resyncFolder(s.path, { ask: true, report: true }) : { needPick: true };
    if (res && res.needPick) {
      const v = await msgBox('info', 'Re-sync', '<p>Pick <b>' + esc(baseName(s.path)) + '</b> again so LANscape can look for changes.</p><p class="hint">' + (S.rootHandles.has(s.root) ? 'Your browser didn\'t allow LANscape to re-read it.' : 'It was opened with the file picker or by dragging, so the browser won\'t let LANscape re-read it by itself.') + ' Nothing LANscape already knows is lost.</p>', ['Pick Folder', 'Cancel']);
      if (v === 'Pick Folder') openFolder();
    }
    await checkPerms();
    render();
  }
  function openSel() {
    const s = selInfo();
    if (s.demo) { close(); go('ftp://ftp.lanscape.net/'); return; }
    if (!s.path || s.off) return;
    const host = S.rootFtp.get(s.root);
    if (!host) return;
    close();
    go('ftp://' + host + '/' + encPath(s.path.slice(s.root.length + 1)));
  }
  async function removeSel() {
    const s = selInfo();
    if (!s.path || !s.top || s.vroot) return;
    await removeFolder(s.root);
    render();
  }
  function close() { if (isOpen()) w.close(null); }
  function bind() {
    const tree = w.el.querySelector('.fm-tree');
    tree.addEventListener('click', e => {
      const row = e.target.closest('.fm-row');
      if (!row) return;
      const p = row.dataset.p;
      if (e.target.closest('.fm-tw')) { select(p); toggleOpen(p); return; }
      if (e.target.closest('.fm-cb')) { e.preventDefault(); select(p); toggleOn(p); return; }
      select(p);
    });
    tree.addEventListener('dblclick', e => { const row = e.target.closest('.fm-row'); if (row && !e.target.closest('.fm-cb,.fm-tw')) { if (!toggleOpen(row.dataset.p)) openSel(); } });
    tree.addEventListener('keydown', e => {
      const rows = visibleRows(), i = rows.findIndex(r => r.dataset.p === sel);
      const at = k => { const r = rows[clamp(k, 0, rows.length - 1)]; if (r) select(r.dataset.p, true); };
      if (e.key === 'ArrowDown') { e.preventDefault(); at(i + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); at(i < 0 ? 0 : i - 1); }
      else if (e.key === 'Home') { e.preventDefault(); at(0); }
      else if (e.key === 'End') { e.preventDefault(); at(rows.length - 1); }
      else if (e.key === 'ArrowRight' && sel && sel !== DEMO_ROW) { e.preventDefault(); if (!toggleOpen(sel, true) && expanded.has(sel)) at(i + 1); }
      else if (e.key === 'ArrowLeft' && sel && sel !== DEMO_ROW) { e.preventDefault(); if (!toggleOpen(sel, false) && depthOf(sel) > 0) select(parentDir(sel), true); }
      else if (e.key === ' ' && sel) { e.preventDefault(); toggleOn(sel); }
      else if (e.key === 'Enter' && sel) { e.preventDefault(); openSel(); }
      else if (e.key === 'Delete' && sel) { e.preventDefault(); removeSel(); }
    });
    w.el.querySelector('#fmAdd').addEventListener('click', () => openFolder());
    w.el.querySelector('#fmResync').addEventListener('click', resyncSel);
    w.el.querySelector('#fmRemove').addEventListener('click', removeSel);
    w.el.querySelector('#fmOpen').addEventListener('click', openSel);
  }
  async function openFM(select0) {
    if (!styled) { document.head.append(el('style', { text: FM_CSS })); styled = true; }
    if (isOpen()) { if (select0) select(select0, true); return w; }
    if (!expanded.size) for (const r of S.roots) expanded.add(r.name + '/');
    const body = el('div', { style: { width: 'min(760px, 92vw)' } });
    body.innerHTML = '<div class="fm-bar"><button class="btnsm raised" id="fmAdd" type="button">' + FM_ICON.add + 'Add Folder...</button><span class="sep"></span>' +
      '<button class="btnsm raised" id="fmResync" type="button" title="Look for new, changed and deleted files in the selected folder">' + ICON.reload.replace('<svg ', '<svg width="16" height="16" ') + 'Re-sync</button>' +
      '<button class="btnsm raised" id="fmRemove" type="button" title="Take the selected folder off your LANscape">' + FM_ICON.remove + 'Remove...</button>' +
      '<button class="btnsm raised" id="fmOpen" type="button" title="Browse the selected folder on its FTP server">' + FM_ICON.open + 'Open</button></div>' +
      '<div class="fm-tree sunken" role="tree" tabindex="0" aria-label="Folders on your LANscape"></div>' +
      '<div class="fm-foot"><span class="hint fm-sum"></span></div>' +
      '<p class="hint" style="margin:6px 0 0">Uncheck a folder or subfolder to take it off your LANscape. LANscape keeps everything it learned about those files (search text, previews, ratings, notes), so checking it again brings them back instantly. A folder you add that holds one already here takes it in, index and all.</p>';
    w = openWin({ title: 'Folders on Your LANscape', body, width: 'auto', buttons: [{ label: 'Close', primary: true }], onClose: () => { w = null; } });
    sel = select0 || sel || (S.roots[0] ? S.roots[0].name + '/' : null);
    bind();
    render();
    setTimeout(() => { const t = w && w.el.querySelector('.fm-tree'); if (t) t.focus(); }, 40);
    await checkPerms();
    render();
    return w;
  }
  const refresh = debounce(() => { if (isOpen()) render(); }, 60);
  return { open: openFM, refresh, isOpen, close, get selected() { return sel; } };
})();
/** the toolbar's Folders button: straight to the picker when there's nothing to manage yet */
function foldersButton() {
  if (diskRoots().length || S.roots.some(r => r.name === VROOT)) FolderManager.open();
  else openFolder();
}
