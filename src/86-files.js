/* ===================================================================
   Saving and opening: write back into the folder on disk (File System
   Access), keep new files in "My Documents" inside the browser, and the
   Save As / Open dialogs the programs share.
   =================================================================== */
async function fsPermission(handle, mode) {
  if (!handle) return false;
  try {
    if (!handle.queryPermission) return true;
    let p = await handle.queryPermission({ mode });
    if (p !== 'granted') p = await handle.requestPermission({ mode });
    return p === 'granted';
  } catch (e) { return false; }
}
/** browsers forget folder permission between visits; ask again (needs a click, so via a dialog) */
async function reconnectFolder(root) {
  const h = S.rootHandles.get(root);
  if (!h || !h.requestPermission) return false;
  try { if (await h.queryPermission({ mode: 'read' }) === 'granted') return true; } catch (e) { return false; }
  const v = await msgBox('question', 'Reconnect Folder', '<p>LANscape needs your OK to read <b>' + esc(root) + '</b> again.</p><p class="hint">Your browser asks once per visit.</p>', ['Reconnect', 'Cancel']);
  if (v !== 'Reconnect') return false;
  try { return (await h.requestPermission({ mode: 'read' })) === 'granted'; } catch (e) { return false; }
}
function ensureRoot(name, mode) {
  const r = noteRoot(name, { mode });
  DB.put('kv', { k: 'roots', v: S.roots });
  FolderManager.refresh();
  return r;
}
const toBlob = (data, ext) => (typeof data === 'string' ? new Blob([data], { type: (MIME[ext] || 'text/plain') + ';charset=utf-8' }) : data);
const canWriteBack = d => !!d && !d.demo && (d.root === VROOT || !!(S.fh.get(d.path) && S.fh.get(d.path).createWritable));

/** replace a file's contents; returns {ok, why} */
async function writeDoc(doc, data) {
  const blob = toBlob(data, doc.ext);
  if (doc.demo) return { ok: false, why: 'demo' };
  if (doc.root === VROOT) {
    const file = new File([blob], doc.name, { type: blob.type, lastModified: Date.now() });
    await DB.put('content', textualKind(doc.kind, doc.ext) ? { path: doc.path, text: typeof data === 'string' ? data : await blobText(blob) } : { path: doc.path, blob: file });
    await refreshDocFromFile(doc, file);
    ensureRoot(VROOT, 'virtual');
    return { ok: true };
  }
  const fh = S.fh.get(doc.path);
  if (fh && fh.createWritable) {
    if (!(await fsPermission(S.rootHandles.get(doc.root) || fh, 'readwrite'))) return { ok: false, why: 'denied' };
    try {
      const w = await fh.createWritable();
      await w.write(blob);
      await w.close();
      await refreshDocFromFile(doc, await fh.getFile());
      return { ok: true };
    } catch (e) { return { ok: false, why: 'error', error: e }; }
  }
  return { ok: false, why: 'nohandle' };
}
async function registerNewFile(path, file, handle) {
  const name = path.split('/').pop(), kind = kindOf(name);
  let r;
  try { r = await extractFor(file, path, kind, false); } catch (e) { r = { meta: extractOther(name, path, file.size, kind) }; }
  const doc = makeDoc({ path, size: file.size, mtime: file.lastModified, meta: r.meta, kind });
  // saving into a folder that's turned off turns it back on: you'd expect to see what you just saved
  if (exclusionOf(path)) { includeOnly(dirOf(path)); applyExclusions(); }
  S.parked.delete(path);
  registerDoc(doc);
  if (handle) S.fh.set(path, handle);
  S.firstSeen[path] = S.firstSeen[path] || Date.now();
  await DB.put('meta', metaRecord(doc));
  if (r.art) await saveArt(doc.meta, r.art, doc.mtime);
  return { doc, text: r.text };
}
/** a brand-new file: in My Documents (IndexedDB) or a folder on disk */
async function createFile(dirPath, name, data) {
  const root = dirPath.split('/')[0];
  const path = dirPath + name;
  const blob = toBlob(data, extOf(name));
  let doc;
  if (root === VROOT) {
    const file = new File([blob], name, { type: blob.type, lastModified: Date.now() });
    const res = await registerNewFile(path, file, null);
    doc = res.doc;
    await DB.put('content', textualKind(doc.kind, doc.ext) ? { path, text: res.text != null ? res.text : await blobText(blob) } : { path, blob: file });
    ensureRoot(VROOT, 'virtual');
  } else {
    const rootH = S.rootHandles.get(root);
    if (!rootH || !rootH.getDirectoryHandle) throw new Error(root + ' was opened without disk access, so LANscape can\'t save into it. Save into ' + VROOT + ' or download a copy.');
    if (!(await fsPermission(rootH, 'readwrite'))) throw new Error('LANscape wasn\'t allowed to save into ' + root + '.');
    let dh = rootH;
    for (const seg of dirPath.split('/').slice(1).filter(Boolean)) dh = await dh.getDirectoryHandle(seg, { create: true });
    const fh = await dh.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    const file = await fh.getFile();
    const old = S.docs.get(path);
    if (old) unregister(path);
    const res = await registerNewFile(path, file, fh);
    doc = res.doc;
    if (S.prefs.cache && cacheable(doc, file.size)) await DB.put('content', textualKind(doc.kind, doc.ext) ? { path, text: res.text != null ? res.text : await blobText(file) } : { path, blob: file });
    ensureRoot(root, 'fs');
  }
  saveState();
  rebuildAll();
  afterDNSChange();
  return doc;
}
/** many new files in My Documents at once, with one rebuild at the end */
async function createFilesInMyDocs(list, onProgress) {
  const out = [];
  let k = 0;
  for (const { dir, name, data } of list) {
    const path = dir + name;
    const blob = toBlob(data, extOf(name));
    const file = new File([blob], name, { type: blob.type, lastModified: Date.now() });
    if (S.docs.get(path)) unregister(path);
    const res = await registerNewFile(path, file, null);
    await DB.put('content', textualKind(res.doc.kind, res.doc.ext) ? { path, text: res.text != null ? res.text : await blobText(blob) } : { path, blob: file });
    out.push(res.doc);
    if (onProgress) onProgress(++k, list.length);
  }
  ensureRoot(VROOT, 'virtual');
  saveState();
  rebuildAll();
  afterDNSChange();
  return out;
}
const cleanName = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '').replace(/^\.+/, '').trim().slice(0, 120);
function saveDestinations() {
  const out = [{ dir: VROOT + '/', label: VROOT + ' (kept in this browser)', depth: 0 }];
  for (const p of S.tree.keys()) if (p.startsWith(VROOT + '/') && p !== VROOT + '/') out.push({ dir: p, label: p.slice(VROOT.length + 1, -1).split('/').pop(), depth: p.split('/').length - 2 });
  for (const r of S.roots) {
    if (r.name === VROOT) continue;
    const h = S.rootHandles.get(r.name);
    if (!h || !h.getDirectoryHandle) continue;
    out.push({ dir: r.name + '/', label: r.name + ' (folder on your disk)', depth: 0 });
    const subs = Array.from(S.tree.keys()).filter(p => p.startsWith(r.name + '/') && p !== r.name + '/').sort().slice(0, 400);
    for (const p of subs) out.push({ dir: p, label: p.slice(0, -1).split('/').pop(), depth: p.split('/').length - 2 });
  }
  return out;
}
/**
 * Save As. opts: {title, name, dir, types:[{ext,label}], data: async ext => Blob|string}
 * resolves to the new doc, 'download', or null
 */
async function saveAsDialog(opts) {
  const dests = saveDestinations();
  const types = opts.types && opts.types.length ? opts.types : [{ ext: extOf(opts.name) || 'txt', label: 'All files' }];
  const body = el('div', { style: { width: 'min(520px, 86vw)' } });
  body.innerHTML = '<div class="frow"><label for="saDest" style="min-width:90px">Save in:</label><select class="field" id="saDest" style="flex:1;min-width:200px"></select></div>' +
    '<div class="salist list" id="saList" style="height:150px;margin:4px 0 8px"></div>' +
    '<div class="frow"><label for="saName" style="min-width:90px">File name:</label><input class="field" id="saName" style="flex:1;min-width:200px"></div>' +
    '<div class="frow"><label for="saType" style="min-width:90px">Save as type:</label><select class="field" id="saType" style="flex:1;min-width:200px"></select></div>' +
    '<p class="hint" id="saHint" style="margin:6px 0 0">' + (S.rootHandles.size ? 'Folders opened in Chrome or Edge can be saved into directly.' : 'Folders opened by dragging or with the file picker are read-only, so new files go to ' + esc(VROOT) + '. Use Download to keep a copy on disk.') + '</p>';
  const dsel = $('#saDest', body), tsel = $('#saType', body), nm = $('#saName', body), list = $('#saList', body);
  dests.forEach((d, i) => { const o = el('option', { value: String(i) }); o.textContent = ' '.repeat(d.depth * 3) + (d.depth ? '└ ' : '') + d.label; dsel.append(o); });
  types.forEach((t, i) => tsel.append(el('option', { value: String(i), text: t.label })));
  let di = Math.max(0, dests.findIndex(d => d.dir === opts.dir));
  dsel.value = String(di);
  const base = cleanName((opts.name || 'Untitled').replace(/\.[a-z0-9]+$/i, '')) || 'Untitled';
  const startType = Math.max(0, types.findIndex(t => t.ext === extOf(opts.name || '')));
  tsel.value = String(startType);
  nm.value = base + '.' + types[startType].ext;
  const fill = () => {
    const d = dests[+dsel.value];
    const node = S.tree.get(d.dir);
    const files = node ? node.files.slice().sort((a, b) => a.name.localeCompare(b.name)) : [];
    list.innerHTML = files.length ? files.map(f => '<div class="li" data-name="' + esc(f.name) + '"><span style="flex:none">' + iconFor(f) + '</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(f.name) + '</span><span class="hint">' + fmtBytes(f.size) + '</span></div>').join('') : '<div class="empty">This folder is empty.</div>';
  };
  dsel.addEventListener('change', fill);
  tsel.addEventListener('change', () => { nm.value = nm.value.replace(/\.[a-z0-9]+$/i, '') + '.' + types[+tsel.value].ext; });
  list.addEventListener('click', e => { const r = e.target.closest('[data-name]'); if (r) nm.value = r.dataset.name; });
  fill();
  const w = openWin({ title: opts.title || 'Save As', body, width: 'auto', buttons: [{ label: 'Save', primary: true, value: 'save' }, { label: 'Download Instead', value: 'download' }, { label: 'Cancel', value: null }] });
  setTimeout(() => { nm.focus(); nm.setSelectionRange(0, nm.value.replace(/\.[a-z0-9]+$/i, '').length); }, 50);
  nm.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); w.close('save'); } });
  const v = await w.result;
  if (!v) return null;
  const t = types[+tsel.value];
  let name = cleanName(nm.value) || base;
  if (extOf(name) !== t.ext) name = name.replace(/\.[a-z0-9]+$/i, '') + '.' + t.ext;
  let data;
  try { data = await opts.data(t.ext); } catch (e) { msgBox('error', 'Save As', '<p>LANscape couldn\'t build the file.</p><p class="hint">' + esc(e && e.message || e) + '</p>'); return null; }
  if (v === 'download') { download(name, toBlob(data, t.ext)); setStatus('Saved ' + name + ' to your Downloads.'); return 'download'; }
  const dest = dests[+dsel.value];
  if (S.docs.has(dest.dir + name)) {
    const ok = await msgBox('warn', 'Save As', '<p><b>' + esc(name) + '</b> already exists.</p><p>Do you want to replace it?</p>', ['Yes', 'No']);
    if (ok !== 'Yes') return null;
  }
  try {
    const doc = await createFile(dest.dir, name, data);
    setStatus('Saved ' + name + ' in ' + dest.dir.replace(/\/$/, '') + '. Its address is ' + displayUrl(doc.url));
    return doc;
  } catch (e) {
    const again = await msgBox('error', 'Save As', '<p>' + esc(e && e.message || e) + '</p>', ['Download Instead', 'Cancel']);
    if (again === 'Download Instead') { download(name, toBlob(data, t.ext)); return 'download'; }
    return null;
  }
}
/**
 * Open. opts: {title, kinds:[...], label}
 * resolves to a doc (possibly a file just picked from the computer) or null
 */
async function openFileDialog(opts = {}) {
  const kinds = opts.kinds || null;
  const pool = docsAll().filter(d => !kinds || kinds.includes(d.kind)).sort((a, b) => a.path.localeCompare(b.path));
  const roots = uniq(pool.map(d => d.root));
  const body = el('div', { style: { width: 'min(620px, 88vw)' } });
  body.innerHTML = '<div class="frow"><label for="ofRoot" style="min-width:70px">Look in:</label><select class="field" id="ofRoot" style="flex:1;min-width:160px"><option value="">All folders</option>' + roots.map(r => '<option>' + esc(r) + '</option>').join('') + '</select><input class="field" id="ofFind" placeholder="Filter by name" style="width:150px"></div>' +
    '<div class="tscroll" style="height:260px;max-height:none;background:var(--field)"><table class="grid-table"><thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th></tr></thead><tbody id="ofRows"></tbody></table></div>' +
    '<p class="hint" style="margin:6px 0 0">' + esc(opts.label || 'Files on your LANscape') + ' · double-click to open</p>';
  const rows = $('#ofRows', body), rootSel = $('#ofRoot', body), find = $('#ofFind', body);
  let sel = null;
  const fill = () => {
    const r = rootSel.value, f = find.value.toLowerCase();
    const list = pool.filter(d => (!r || d.root === r) && (!f || d.path.toLowerCase().includes(f))).slice(0, 800);
    rows.innerHTML = list.map(d => '<tr data-p="' + esc(d.path) + '"><td style="white-space:nowrap">' + iconFor(d) + ' ' + esc(d.name) + '<div class="hint mono">' + esc(d.dir) + '</div></td><td>' + esc(K(d).label) + '</td><td style="white-space:nowrap">' + fmtBytes(d.size) + '</td><td style="white-space:nowrap">' + esc(fmtShort(d.mtime)) + '</td></tr>').join('') || '<tr><td colspan="4"><i>No matching files. Use From My Computer to open one from your disk.</i></td></tr>';
  };
  rootSel.addEventListener('change', fill);
  find.addEventListener('input', debounce(fill, 80));
  fill();
  let w;
  rows.addEventListener('click', e => { const tr = e.target.closest('tr[data-p]'); if (!tr) return; $$('tr.sel', rows).forEach(x => x.classList.remove('sel')); tr.classList.add('sel'); sel = tr.dataset.p; });
  rows.addEventListener('dblclick', e => { const tr = e.target.closest('tr[data-p]'); if (tr) { sel = tr.dataset.p; w.close('open'); } });
  w = openWin({ title: opts.title || 'Open', body, width: 'auto', buttons: [{ label: 'Open', primary: true, value: 'open' }, { label: 'From My Computer...', value: 'pick' }, { label: 'Cancel', value: null }] });
  const v = await w.result;
  if (v === 'open' && sel) return S.docs.get(sel) || null;
  if (v === 'pick') return pickLocalFile(kinds);
  return null;
}
/** open a file from the computer: it joins the "Files" folder on your LANscape */
function pickLocalFile(kinds) {
  return new Promise(res => {
    const exts = kinds ? Object.keys(EXT_KIND).filter(e => kinds.includes(EXT_KIND[e])).map(e => '.' + e).join(',') : '';
    const inp = el('input', { type: 'file', accept: exts || null, autocomplete: 'off', style: { display: 'none' } });
    document.body.append(inp);
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) { res(null); return; }
      if (exclusionOf(LOOSE + '/' + f.name)) includeOnly(LOOSE + '/');
      await addLooseFiles([f], 'input', { quiet: true, noSpiderPrompt: true });
      res(S.docs.get(LOOSE + '/' + f.name) || null);
    });
    inp.click();
  });
}
