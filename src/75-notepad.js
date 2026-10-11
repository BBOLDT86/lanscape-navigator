/* ===================================================================
   Notepad: plain text and source code, and "Edit Page Source"
   =================================================================== */
const NOTEPAD_CSS = `.np-wrap{flex:1;min-height:0;display:flex;margin:0 2px;background:#fff}
.np-gut{flex:none;overflow:hidden;background:#f0f0f0;color:#808080;text-align:right;font:var(--np-size,13px)/1.4 var(--np-font,var(--mono));padding:4px 6px 4px 4px;border-right:1px solid #c0c0c0;user-select:none;position:relative;min-width:44px}
.np-gut div{position:absolute;right:6px;white-space:nowrap}
textarea.np{flex:1;min-width:0;border:0;resize:none;outline:none;padding:4px 6px;font:var(--np-size,13px)/1.4 var(--np-font,var(--mono));color:#000;background:#fff;tab-size:4;white-space:pre;overflow:auto}
textarea.np.wrap{white-space:pre-wrap;word-wrap:break-word}
.np-bar{display:flex;gap:8px;align-items:center;padding:3px 8px;background:#ffffe1;border-bottom:1px solid #808080;font-size:11px;flex:none}
.np-bar button{font-size:11px}
@media print{textarea.np{white-space:pre-wrap;overflow:visible;height:auto}.np-gut{display:none}}`;
const editUrlFor = d => (d.kind === 'text' || d.kind === 'code') && !d.asset ? d.url : 'http://notepad.lanscape.net/edit?url=' + encodeURIComponent(d.url);
function routeToDoc(url) {
  if (!url) return null;
  let r = resolve(normalizeInput(url) || url), hops = 0;
  while (r && r.type === 'redirect' && hops++ < 6) r = resolve(r.to);
  return r && r.doc ? r.doc : null;
}
function notepadRoute(path, q) {
  if (path === '/edit') {
    const d = routeToDoc(q.get('url'));
    if (!d) return { type: 'gen', url: 'http://notepad.lanscape.net/edit', title: 'Notepad', html: page('Notepad', '<h2 class="sans">Notepad can\'t find that file</h2><p class="sans">' + esc(q.get('url') || '') + '</p>') };
    return { type: 'app', doc: d, url: 'http://notepad.lanscape.net/edit?url=' + encodeURIComponent(d.url), title: d.name + ' - Notepad' };
  }
  return null;
}
async function mountNotepad(ctx) {
  const { h, doc, win } = ctx;
  let d = ctx.file;
  const S2 = await ctx.kv.get('notepad:prefs') || {};
  const P = Object.assign({ wrap: true, status: true, lines: false, size: 13, font: '' }, S2);
  let text = '', crlf = false, readOnly = false, note = '';
  if (d) {
    const blob = await ctx.blob(d);
    const head = new Uint8Array(await blob.slice(0, 4096).arrayBuffer());
    if (head.includes(0) && !/^(text|code|html|md|rtf)$/.test(d.kind)) { readOnly = true; note = d.name + ' is not a text file, so Notepad opened it read-only.'; }
    if (blob.size > 12e6) { readOnly = true; note = d.name + ' is ' + fmtBytes(blob.size) + '. Notepad shows the first 12 MB, read-only.'; }
    text = decodeText(new Uint8Array(await blob.slice(0, 12e6).arrayBuffer()));
    crlf = /\r\n/.test(text.slice(0, 20000));
    text = text.replace(/\r\n?/g, '\n');
  }
  let saved = text;
  const ta = h('textarea', { class: 'np' + (P.wrap ? ' wrap' : ''), spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Text' });
  ta.value = text;
  ta.readOnly = readOnly;
  const gut = h('div', { class: 'np-gut', 'aria-hidden': 'true' });
  const lnc = h('span', { text: 'Ln 1, Col 1' });
  const info = h('span', { class: 'grow', text: '' });
  const eol = h('span', { text: crlf ? 'Windows (CRLF)' : 'Unix (LF)' });
  const status = h('div', { class: 'status noprint' }, info, lnc, h('span', { text: 'UTF-8' }), eol);
  const name = () => (d ? d.name : 'Untitled');
  const dirty = () => !readOnly && ta.value !== saved;
  const retitle = () => ctx.setTitle((dirty() ? '*' : '') + name() + ' - Notepad');
  const applyPrefs = () => {
    ta.classList.toggle('wrap', !!P.wrap);
    ctx.root.style.setProperty('--np-size', P.size + 'px');
    if (P.font) ctx.root.style.setProperty('--np-font', P.font); else ctx.root.style.removeProperty('--np-font');
    status.hidden = !P.status;
    gut.hidden = !(P.lines && !P.wrap);
    paintGutter();
    ctx.kv.set('notepad:prefs', P);
  };
  const lineH = () => (P.size || 13) * 1.4;
  function paintGutter() {
    if (gut.hidden) return;
    const lh = lineH(), top = ta.scrollTop, hgt = ta.clientHeight;
    const first = Math.max(0, Math.floor((top - 4) / lh)), last = Math.min(ta.value.split('\n').length, first + Math.ceil(hgt / lh) + 2);
    let html = '';
    for (let i = first; i < last; i++) html += '<div style="top:' + (4 + i * lh - top) + 'px">' + (i + 1) + '</div>';
    gut.innerHTML = html;
  }
  function caret() {
    const v = ta.value, p = ta.selectionStart;
    const before = v.slice(0, p);
    const ln = (before.match(/\n/g) || []).length + 1, col = p - before.lastIndexOf('\n');
    lnc.textContent = 'Ln ' + ln + ', Col ' + col;
  }
  function scrollToSel() {
    const before = ta.value.slice(0, ta.selectionStart);
    const ln = (before.match(/\n/g) || []).length;
    const y = ln * lineH();
    if (y < ta.scrollTop || y > ta.scrollTop + ta.clientHeight - lineH() * 2) ta.scrollTop = Math.max(0, y - ta.clientHeight / 2);
  }
  /* ---------- find & replace ---------- */
  const F = { q: '', r: '', cs: false, up: false };
  function findNext(silent) {
    if (!F.q) return false;
    const v = F.cs ? ta.value : ta.value.toLowerCase(), q = F.cs ? F.q : F.q.toLowerCase();
    let i = F.up ? v.lastIndexOf(q, Math.max(0, ta.selectionStart - 1)) : v.indexOf(q, ta.selectionEnd);
    if (i < 0) i = F.up ? v.lastIndexOf(q) : v.indexOf(q);
    if (i < 0) { if (!silent) ctx.msg('info', 'Notepad', '<p>Cannot find "' + esc(F.q) + '"</p>'); return false; }
    ta.focus();
    ta.setSelectionRange(i, i + q.length);
    scrollToSel();
    caret();
    return true;
  }
  function findDialog(replace) {
    const body = el('div', { html: '<div class="frow"><label for="npF" style="min-width:90px">Find what:</label><input class="field" id="npF" style="flex:1;min-width:180px"></div>' + (replace ? '<div class="frow"><label for="npR" style="min-width:90px">Replace with:</label><input class="field" id="npR" style="flex:1;min-width:180px"></div>' : '') + '<div class="frow"><label class="check"><input type="checkbox" id="npC"> Match case</label>' + (replace ? '' : '<label class="check"><input type="checkbox" id="npU"> Search up</label>') + '</div>' });
    const f = $('#npF', body);
    f.value = ta.value.slice(ta.selectionStart, ta.selectionEnd).split('\n')[0] || F.q;
    if (replace) $('#npR', body).value = F.r;
    $('#npC', body).checked = F.cs;
    const sync = () => { F.q = f.value; F.cs = $('#npC', body).checked; F.up = !replace && $('#npU', body).checked; if (replace) F.r = $('#npR', body).value; };
    const buttons = [{ label: 'Find Next', primary: true, onClick: () => { sync(); findNext(); return false; } }];
    if (replace) {
      buttons.push({ label: 'Replace', onClick: () => { sync(); const s = ta.value.slice(ta.selectionStart, ta.selectionEnd); if (s && (F.cs ? s === F.q : s.toLowerCase() === F.q.toLowerCase())) { ta.setRangeText(F.r, ta.selectionStart, ta.selectionEnd, 'end'); onInput(); } findNext(); return false; } });
      buttons.push({ label: 'Replace All', onClick: () => {
        sync(); if (!F.q) return false;
        const re = new RegExp(F.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), F.cs ? 'g' : 'gi');
        const n = (ta.value.match(re) || []).length;
        if (n) { ta.focus(); ta.select(); doc.execCommand('insertText', false, ta.value.replace(re, () => F.r)) || (ta.value = ta.value.replace(re, () => F.r)); onInput(); }
        ctx.status('Replaced ' + n + ' occurrence' + (n === 1 ? '' : 's') + '.');
        return false;
      } });
    }
    buttons.push({ label: 'Cancel' });
    const w = openWin({ title: replace ? 'Replace' : 'Find', body, modal: false, width: 'min(440px, 94vw)', buttons });
    f.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sync(); findNext(); } });
    return w;
  }
  async function gotoLine() {
    const n = parseInt(await ctx.ask('Go To Line', 'Line number:', ''), 10);
    if (!n) return;
    const lines = ta.value.split('\n');
    let p = 0;
    for (let i = 0; i < Math.min(n - 1, lines.length - 1); i++) p += lines[i].length + 1;
    ta.focus(); ta.setSelectionRange(p, p); scrollToSel(); caret();
  }
  async function fontDialog() {
    const body = el('div', { html: '<div class="frow"><label for="npFF" style="min-width:60px">Font:</label><select class="field" id="npFF"><option value="">Courier New</option><option value="Consolas,Menlo,monospace">Consolas</option><option value="\'Lucida Console\',Monaco,monospace">Lucida Console</option><option value="Tahoma,Verdana,sans-serif">Fixedsys-ish (sans)</option></select></div><div class="frow"><label for="npFS" style="min-width:60px">Size:</label><select class="field" id="npFS">' + [10, 11, 12, 13, 14, 16, 18, 20, 24].map(n => '<option' + (n === P.size ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' });
    $('#npFF', body).value = P.font || '';
    const v = await openWin({ title: 'Font', body, width: 'min(340px,94vw)', buttons: [{ label: 'OK', primary: true, value: 'ok' }, { label: 'Cancel', value: null }] }).result;
    if (v !== 'ok') return;
    P.font = $('#npFF', body).value; P.size = +$('#npFS', body).value || 13;
    applyPrefs();
  }
  /* ---------- files ---------- */
  const typesFor = () => {
    const ext = d ? d.ext : 'txt';
    const t = [{ ext: ext || 'txt', label: (d ? K(d).label : 'Text Document') + ' (*.' + (ext || 'txt') + ')' }];
    if (ext !== 'txt') t.push({ ext: 'txt', label: 'Text Document (*.txt)' });
    if (ext !== 'md') t.push({ ext: 'md', label: 'Markdown (*.md)' });
    if (ext !== 'html') t.push({ ext: 'html', label: 'Web Page (*.html)' });
    return t;
  };
  const out = () => (crlf ? ta.value.replace(/\n/g, '\r\n') : ta.value);
  async function save() {
    if (readOnly) return saveAs();
    if (d && canWriteBack(d)) {
      ctx.status('Saving ' + d.name + '...');
      const r = await ctx.save(d, out());
      if (r.ok) { saved = ta.value; retitle(); ctx.status('Saved ' + d.name + ' (' + fmtBytes(d.size) + ').'); afterSave(); return true; }
      if (r.why !== 'nohandle' && r.why !== 'demo') { ctx.msg('error', 'Notepad', '<p>Notepad couldn\'t save ' + esc(d.name) + '.</p><p class="hint">' + esc(r.why === 'denied' ? 'Saving into this folder wasn\'t allowed.' : (r.error && r.error.message) || r.why) + '</p>'); return false; }
    }
    return saveAs();
  }
  async function saveAs() {
    const nd = await ctx.saveAs({ title: 'Save As', name: d ? d.name : 'Untitled.txt', dir: d ? d.dir : VROOT + '/', types: typesFor(), data: () => out() });
    if (!nd) return false;
    saved = ta.value;
    if (nd !== 'download') ctx.go(editUrlFor(nd), { replace: true, noCheck: true });
    else retitle();
    return true;
  }
  function afterSave() {
    if (d && d.kind === 'html') bar.hidden = false;
  }
  const bar = h('div', { class: 'np-bar noprint', hidden: true }, h('span', { text: 'Saved. ' }), h('button', { type: 'button', class: 'btn', text: 'View in Browser', onclick: () => ctx.go(d.url) }));
  const menus = appMenubar(ctx, [
    { label: 'File', items: () => [
      { label: 'New', key: 'Ctrl+N', act: () => ctx.go('http://notepad.lanscape.net/') },
      { label: 'Open...', key: 'Ctrl+O', act: async () => { const nd = await ctx.open({ title: 'Open', kinds: ['text', 'code', 'md', 'html', 'sheet', 'rtf'], label: 'Text files, source code and web pages' }); if (nd) ctx.go(editUrlFor(nd)); } },
      { label: 'Save', key: 'Ctrl+S', act: save },
      { label: 'Save As...', act: saveAs },
      { sep: 1 },
      { label: 'Print...', key: 'Ctrl+P', act: () => win.print() },
      d ? { label: d.kind === 'html' ? 'View Page in Browser' : 'Show on FTP Server', act: () => ctx.go(d.kind === 'html' ? d.url : d.ftp.replace(/[^/]*$/, '')) } : null,
      { sep: 1 },
      { label: 'Exit', act: () => back() }
    ] },
    { label: 'Edit', items: () => [
      { label: 'Undo', key: 'Ctrl+Z', act: () => { ta.focus(); doc.execCommand('undo'); } },
      { sep: 1 },
      { label: 'Cut', key: 'Ctrl+X', act: () => { ta.focus(); doc.execCommand('cut'); } },
      { label: 'Copy', key: 'Ctrl+C', act: () => { ta.focus(); doc.execCommand('copy'); } },
      { label: 'Paste', key: 'Ctrl+V', act: async () => { ta.focus(); try { const t = await navigator.clipboard.readText(); doc.execCommand('insertText', false, t); } catch (e) { ctx.status('Press Ctrl+V to paste.'); } } },
      { label: 'Delete', key: 'Del', act: () => { ta.focus(); doc.execCommand('delete'); } },
      { sep: 1 },
      { label: 'Select All', key: 'Ctrl+A', act: () => { ta.focus(); ta.select(); } },
      { label: 'Time/Date', act: () => { ta.focus(); const n = new Date(); let hh = n.getHours(); const ap = hh >= 12 ? 'PM' : 'AM'; hh = hh % 12 || 12; doc.execCommand('insertText', false, hh + ':' + pad(n.getMinutes(), 2) + ' ' + ap + ' ' + (n.getMonth() + 1) + '/' + n.getDate() + '/' + n.getFullYear()); } }
    ] },
    { label: 'Search', items: () => [
      { label: 'Find...', key: 'Ctrl+F', act: () => findDialog(false) },
      { label: 'Find Next', key: 'F3', act: () => (F.q ? findNext() : findDialog(false)) },
      { label: 'Replace...', key: 'Ctrl+H', act: () => findDialog(true), disabled: () => readOnly },
      { label: 'Go To Line...', key: 'Ctrl+G', act: gotoLine }
    ] },
    { label: 'Format', items: () => [
      { label: 'Word Wrap', check: () => P.wrap, act: () => { P.wrap = !P.wrap; applyPrefs(); } },
      { label: 'Font...', act: fontDialog }
    ] },
    { label: 'View', items: () => [
      { label: 'Status Bar', check: () => P.status, act: () => { P.status = !P.status; applyPrefs(); } },
      { label: 'Line Numbers', check: () => P.lines, disabled: () => P.wrap, act: () => { P.lines = !P.lines; applyPrefs(); } },
      d && d.kind === 'md' ? { label: 'Open in Write', act: () => ctx.go(d.url) } : null,
      d && d.kind === 'sheet' ? { label: 'Open in Ledger', act: () => ctx.go(d.url) } : null
    ] },
    { label: 'Help', items: () => [{ label: 'About Notepad', act: () => ctx.msg('info', 'About Notepad', '<p><b>Notepad</b> for LANscape ' + VERSION + '</p><p class="hint">Edits text files right in your folder. In Chrome and Edge it saves back to the file on disk.</p>') }] }
  ]);
  const wrap = h('div', { class: 'np-wrap sunk' }, gut, ta);
  ctx.root.append(menus.el);
  if (note) ctx.root.append(h('div', { class: 'np-bar noprint', text: note }));
  ctx.root.append(bar, wrap, status);
  const onInput = () => { retitle(); paintGutter(); };
  ctx.on(ta, 'input', onInput);
  ctx.on(ta, 'scroll', paintGutter, { passive: true });
  for (const ev of ['keyup', 'click', 'select', 'focus']) ctx.on(ta, ev, caret);
  ctx.on(ta, 'keydown', e => {
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !readOnly) { e.preventDefault(); doc.execCommand('insertText', false, '\t'); }
  });
  ctx.on(doc, 'keydown', e => {
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 's') { e.preventDefault(); save(); }
    else if (mod && k === 'o') { e.preventDefault(); menus.show(0, true); }
    else if (mod && k === 'n') { e.preventDefault(); ctx.go('http://notepad.lanscape.net/'); }
    else if (mod && k === 'f') { e.preventDefault(); findDialog(false); }
    else if (mod && k === 'h') { e.preventDefault(); if (!readOnly) findDialog(true); }
    else if (mod && k === 'g') { e.preventDefault(); gotoLine(); }
    else if (mod && k === 'p') { e.preventDefault(); win.print(); }
    else if (e.key === 'F3') { e.preventDefault(); F.up = !!e.shiftKey; F.q ? findNext() : findDialog(false); }
  });
  ctx.on(win, 'resize', paintGutter);
  info.textContent = d ? (d.path + ' · ' + fmtBytes(d.size)) : 'New text file';
  applyPrefs();
  retitle();
  ta.focus();
  ta.setSelectionRange(0, 0);
  caret();
  return {
    title: name() + ' - Notepad',
    isDirty: dirty, save, docName: name,
    discard() { saved = ta.value; }
  };
}
