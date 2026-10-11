/* ===================================================================
   LANscape Write: a Word 97 / WordPad-style word processor.
   Opens .docx, .rtf, .md, .txt and old .doc files; saves .docx/.rtf/.md/.html/.txt
   =================================================================== */
const WRITE_CSS = `.wr-tb select.fld{height:21px;font-size:11px}
.wr-tb .tbtn b,.wr-tb .tbtn i,.wr-tb .tbtn u,.wr-tb .tbtn s{font:bold 13px "Times New Roman",serif;line-height:1}
.wr-tb .tbtn i{font-weight:normal;font-style:italic}.wr-tb .tbtn u{font-weight:normal}.wr-tb .tbtn s{font-weight:normal}
.wr-color{display:grid;place-items:center;gap:0}
.wr-ruler{flex:none;height:24px;background:var(--face);border-bottom:1px solid var(--sh);display:flex;justify-content:center;overflow:hidden}
.wr-ruler .r{position:relative;height:22px;width:816px;flex:none;background:linear-gradient(90deg,#a0a0a0 0 96px,#fff 96px 720px,#a0a0a0 720px);border:1px solid #808080;border-top:0}
.wr-ruler .t{position:absolute;bottom:0;width:1px;background:#000}
.wr-ruler .n{position:absolute;top:1px;font:9px Arial,sans-serif;transform:translateX(-50%)}
.wr-ruler .m{position:absolute;top:0;width:0;height:0;border:5px solid transparent;border-top:6px solid #333}
.wr-scroll{flex:1;min-height:0;overflow:auto;background:#808080;padding:18px 12px 48px;position:relative}
.wr-zoom{width:816px;margin:0 auto}
.wr-page{width:816px;min-height:1056px;margin:0 auto;background:#fff;padding:96px;box-shadow:1px 1px 0 #000,3px 3px 0 rgba(0,0,0,.35);
 font:12pt/1.25 "Times New Roman",Times,"Liberation Serif",serif;color:#000;outline:none;overflow-wrap:break-word;
 background-image:repeating-linear-gradient(to bottom,transparent 0 1055px,#c8c8c8 1055px 1056px)}
.wr-page h1{font:bold 20pt/1.2 Arial,Helvetica,"Liberation Sans",sans-serif;margin:12pt 0 6pt}
.wr-page h2{font:bold 15pt/1.2 Arial,Helvetica,"Liberation Sans",sans-serif;margin:10pt 0 5pt}
.wr-page h3{font:bold 13pt/1.2 Arial,Helvetica,"Liberation Sans",sans-serif;margin:8pt 0 4pt}
.wr-page h4,.wr-page h5,.wr-page h6{font:bold italic 12pt/1.2 "Times New Roman",serif;margin:6pt 0 3pt}
.wr-page p{margin:0 0 6pt}
.wr-page ul,.wr-page ol{margin:0 0 6pt;padding-left:.5in}
.wr-page blockquote{margin:0 0 6pt .5in}
.wr-page blockquote:not([style]){font-style:italic;color:#404040;border-left:3px solid #c0c0c0;padding-left:10px}
.wr-page pre{font:10pt/1.35 "Courier New",Courier,monospace;background:#f4f4f4;padding:6px 8px;white-space:pre-wrap;margin:0 0 6pt}
.wr-page table{border-collapse:collapse;width:100%;margin:0 0 8pt}
.wr-page td,.wr-page th{border:1px solid #000;padding:3px 6px;vertical-align:top;min-width:30px}
.wr-page th{background:#e8e8e8}
.wr-page td p,.wr-page th p{margin:0}
.wr-page img{max-width:100%;height:auto}
.wr-page img.sel{outline:2px solid #000080;outline-offset:1px}
.wr-page a{color:#0000ee}
.wr-page hr{border:0;border-top:1px solid #000;margin:8pt 0}
.wr-page hr.pagebreak{border-top:1px dashed #808080;margin:18pt -96px;overflow:visible;position:relative;height:0}
.wr-page hr.pagebreak::after{content:"Page Break";position:absolute;left:50%;top:-8px;transform:translateX(-50%);background:#fff;color:#808080;font:9px Arial,sans-serif;padding:0 6px}
.wr-imgbar{position:absolute;z-index:20;display:flex;gap:2px;padding:2px;background:var(--face);box-shadow:inset -1px -1px var(--dk),inset 1px 1px var(--hi),2px 2px 0 rgba(0,0,0,.3)}
.wr-imgbar button{font-size:11px;padding:2px 6px}
.wr-note{flex:none;background:var(--tip);border-bottom:1px solid var(--sh);padding:4px 10px;font-size:11px}
.symbols{display:grid;grid-template-columns:repeat(10,24px);gap:2px;padding:4px}
.symbols button{width:24px;height:24px;font:14px "Times New Roman",serif;border:1px solid var(--sh);background:#fff;padding:0}
@media (max-width:880px){.wr-page,.wr-zoom,.wr-ruler .r{width:100%}.wr-page{padding:28px 24px}}
@media print{.wr-scroll{overflow:visible;background:#fff;padding:0}.wr-page{box-shadow:none;padding:0;width:auto;min-height:0;background-image:none}.wr-ruler,.wr-imgbar,.wr-note{display:none!important}.wr-page hr.pagebreak{break-after:page;border:0;margin:0}.wr-page hr.pagebreak::after{display:none}}`;
const WRITE_FONTS = [['Times New Roman', '"Times New Roman",Times,"Liberation Serif",serif'], ['Arial', 'Arial,Helvetica,"Liberation Sans",sans-serif'], ['Courier New', '"Courier New",Courier,"Liberation Mono",monospace'], ['Georgia', 'Georgia,serif'], ['Verdana', 'Verdana,Geneva,sans-serif'], ['Tahoma', 'Tahoma,Verdana,sans-serif'], ['Trebuchet MS', '"Trebuchet MS",sans-serif'], ['Comic Sans MS', '"Comic Sans MS","Comic Neue",cursive'], ['Impact', 'Impact,"Arial Black",sans-serif']];
const WRITE_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];
const writeUrlFor = d => (K(d).app === 'write' && !d.asset ? d.url : 'http://write.lanscape.net/edit?url=' + encodeURIComponent(d.url));
const WRITE_KINDS = ['docx', 'rtf', 'md', 'legacy', 'text'];
function writeRoute(path, q) {
  if (path === '/edit') {
    const d = routeToDoc(q.get('url'));
    if (!d) return null;
    return { type: 'app', doc: d, url: 'http://write.lanscape.net/edit?url=' + encodeURIComponent(d.url), title: d.name + ' - Write' };
  }
  return null;
}
APPS.write.route = writeRoute;
/** keep pasted HTML to what a document can hold */
function cleanPaste(html, doc) {
  const src = new DOMParser().parseFromString(html, 'text/html');
  const KEEP = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'SUP', 'SUB', 'A', 'IMG', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'CODE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'HR', 'SPAN', 'FONT', 'DIV']);
  const STY = ['color', 'background-color', 'font-size', 'font-weight', 'font-style', 'text-decoration', 'text-align', 'font-family'];
  const out = doc.createDocumentFragment();
  const walk = (n, into) => {
    for (const c of Array.from(n.childNodes)) {
      if (c.nodeType === 3) { into.appendChild(doc.createTextNode(c.nodeValue)); continue; }
      if (c.nodeType !== 1) continue;
      if (/^(SCRIPT|STYLE|META|LINK|TITLE|NOSCRIPT|IFRAME|OBJECT|SVG|BUTTON|INPUT|SELECT|TEXTAREA|FORM)$/.test(c.nodeName)) continue;
      if (!KEEP.has(c.nodeName)) { walk(c, into); continue; }
      const e = doc.createElement(c.nodeName === 'DIV' ? 'p' : c.nodeName.toLowerCase());
      if (c.nodeName === 'A' && c.getAttribute('href') && !/^\s*javascript:/i.test(c.getAttribute('href'))) e.setAttribute('href', c.getAttribute('href'));
      if (c.nodeName === 'IMG') { const s = c.getAttribute('src') || ''; if (!/^(data:image\/|https?:|blob:)/i.test(s)) continue; e.setAttribute('src', s); if (c.getAttribute('alt')) e.setAttribute('alt', c.getAttribute('alt')); }
      if ((c.nodeName === 'TD' || c.nodeName === 'TH') && c.getAttribute('colspan')) e.setAttribute('colspan', c.getAttribute('colspan'));
      if (c.nodeName === 'FONT') { if (c.getAttribute('color')) e.setAttribute('color', c.getAttribute('color')); if (c.getAttribute('face')) e.setAttribute('face', c.getAttribute('face')); if (c.getAttribute('size')) e.setAttribute('size', c.getAttribute('size')); }
      const st = c.style;
      if (st) for (const k of STY) { const v = st.getPropertyValue(k); if (v) e.style.setProperty(k, v); }
      walk(c, e);
      into.appendChild(e);
    }
  };
  walk(src.body, out);
  return out;
}
async function mountWrite(ctx) {
  const { h, doc, win } = ctx;
  let d = ctx.file;
  let html = '<p><br></p>', note = '', docTitle = '', readOnlyFormat = false;
  if (d) {
    const ext = d.ext;
    if (d.kind === 'docx') { const r = await docxToHtml(await ctx.blob(d)); html = r.html || html; docTitle = r.title || ''; }
    else if (d.kind === 'rtf') html = rtfToHtml(await ctx.text(d)) || html;
    else if (d.kind === 'md') html = mdToHtml(await ctx.text(d)) || html;
    else if (d.kind === 'legacy') {
      const u8 = new Uint8Array(await (await ctx.blob(d)).slice(0, 8e6).arrayBuffer());
      const lines = legacyStrings(u8).split('\n').filter(l => l.length > 8 && / /.test(l) && !/[\\{}]|Times New Roman|Microsoft|Normal\.dot/.test(l));
      html = lines.map(l => '<p>' + esc(l) + '</p>').join('') || html;
      note = d.name + ' is an older Word file. Write recovered its text; use Save As to keep it as a .docx.';
      readOnlyFormat = true;
    } else {
      const t = await ctx.text(d);
      html = t.split(/\r?\n/).map(l => '<p>' + (esc(l) || '<br>') + '</p>').join('');
      if (ext !== 'txt') readOnlyFormat = true;
    }
  }
  const pageEl = h('div', { class: 'wr-page', contenteditable: 'true', spellcheck: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Document' });
  pageEl.innerHTML = html;
  for (const s of pageEl.querySelectorAll('script,style,iframe,object')) s.remove();
  let dirty = false, savedRange = null, zoom = 100;
  const name = () => (d ? d.name : 'Untitled Document');
  const status = { page: h('span', { text: 'Page 1 of 1' }), words: h('span', { class: 'grow', text: '' }), fmt: h('span', { text: d ? badgeFor(d) : 'DOCX' }), mod: h('span', { text: '' }) };
  const retitle = () => { ctx.setTitle(name() + ' - Write'); status.mod.textContent = dirty ? 'Modified' : 'Saved'; };
  const markDirty = () => { if (!dirty) { dirty = true; retitle(); } countSoon(); };
  doc.execCommand('defaultParagraphSeparator', false, 'p');
  doc.execCommand('styleWithCSS', false, false);
  /* ---------- selection & commands ---------- */
  const inPage = n => n && (n === pageEl || pageEl.contains(n));
  ctx.on(doc, 'selectionchange', () => {
    const sel = doc.getSelection();
    if (sel && sel.rangeCount && inPage(sel.anchorNode)) { savedRange = sel.getRangeAt(0).cloneRange(); updateBars(); updatePage(); }
  });
  function restore() {
    pageEl.focus({ preventScroll: true });
    if (savedRange) { const sel = doc.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
  }
  function cmd(name, val) { restore(); doc.execCommand(name, false, val); markDirty(); updateBars(); }
  function blockOf(n) { while (n && n !== pageEl) { if (n.nodeType === 1 && /^(P|H[1-6]|LI|BLOCKQUOTE|PRE|DIV|TD|TH)$/.test(n.nodeName)) return n; n = n.parentNode; } return null; }
  function selectedBlocks() {
    const sel = doc.getSelection();
    if (!sel.rangeCount) return [];
    const r = sel.getRangeAt(0), out = [];
    const all = pageEl.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,pre,blockquote');
    for (const b of all) if (r.intersectsNode(b) && !b.querySelector('p,h1,h2,h3,li')) out.push(b);
    if (!out.length) { const b = blockOf(r.startContainer); if (b) out.push(b); }
    return out;
  }
  function setSize(pt) {
    restore();
    doc.execCommand('fontSize', false, '7');
    const made = [];
    for (const f of pageEl.querySelectorAll('font[size="7"]')) { const sp = doc.createElement('span'); sp.style.fontSize = pt + 'pt'; while (f.firstChild) sp.appendChild(f.firstChild); f.replaceWith(sp); made.push(sp); }
    if (made.length) { const r = doc.createRange(); r.setStartBefore(made[0]); r.setEndAfter(made[made.length - 1]); const sel = doc.getSelection(); sel.removeAllRanges(); sel.addRange(r); savedRange = r.cloneRange(); }
    markDirty();
  }
  function setFont(family) { cmd('fontName', family); }
  function setStyle(tag) {
    restore();
    doc.execCommand('formatBlock', false, '<' + tag + '>');
    markDirty(); updateBars();
  }
  function lineSpacing(v) { restore(); for (const b of selectedBlocks()) b.style.lineHeight = v === 1 ? '' : String(v); markDirty(); }
  function insertHTML(htm) { restore(); doc.execCommand('insertHTML', false, htm); markDirty(); }
  /* ---------- toolbars ---------- */
  const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true, autocomplete: 'off' });
  const styleSel = h('select', { class: 'fld', title: 'Style', 'aria-label': 'Style' }, ...[['p', 'Normal'], ['h1', 'Heading 1'], ['h2', 'Heading 2'], ['h3', 'Heading 3'], ['blockquote', 'Quote'], ['pre', 'Code']].map(([v, l]) => h('option', { value: v, text: l })));
  const fontSel = h('select', { class: 'fld', title: 'Font', 'aria-label': 'Font', style: { width: '128px' } }, ...WRITE_FONTS.map(([l, v]) => h('option', { value: v, text: l })));
  const sizeSel = h('select', { class: 'fld', title: 'Font size', 'aria-label': 'Font size', style: { width: '48px' } }, ...WRITE_SIZES.map(n => h('option', { value: String(n), text: String(n) })));
  styleSel.addEventListener('change', () => setStyle(styleSel.value));
  fontSel.addEventListener('change', () => setFont(fontSel.value));
  sizeSel.addEventListener('change', () => setSize(+sizeSel.value));
  let lastColor = '#c00000', lastMark = '#ffff00';
  const colorBtn = tbtn(ctx, '<span class="wr-color"><b style="font:bold 13px Times New Roman,serif">A</b><i class="swatch" style="background:' + lastColor + '"></i></span>', 'Font color', (e, b) => colorPopup(ctx, b, c => { lastColor = c; b.querySelector('.swatch').style.background = c; cmd('foreColor', c); }, [{ label: 'Automatic (black)', act: () => cmd('foreColor', '#000000') }]));
  const markBtn = tbtn(ctx, '<span class="wr-color">' + I16.mark + '<i class="swatch" style="background:' + lastMark + '"></i></span>', 'Highlight', (e, b) => colorPopup(ctx, b, c => { lastMark = c; b.querySelector('.swatch').style.background = c; cmd('hiliteColor', c); }, [{ label: 'No highlight', act: () => cmd('hiliteColor', 'transparent') }]));
  const B = {
    bold: tbtn(ctx, '<b>B</b>', 'Bold (Ctrl+B)', () => cmd('bold')),
    italic: tbtn(ctx, '<i>I</i>', 'Italic (Ctrl+I)', () => cmd('italic')),
    underline: tbtn(ctx, '<u>U</u>', 'Underline (Ctrl+U)', () => cmd('underline')),
    strike: tbtn(ctx, '<s>abc</s>', 'Strikethrough', () => cmd('strikeThrough')),
    left: tbtn(ctx, I16.left, 'Align Left (Ctrl+L)', () => cmd('justifyLeft')),
    center: tbtn(ctx, I16.center, 'Center (Ctrl+E)', () => cmd('justifyCenter')),
    right: tbtn(ctx, I16.right, 'Align Right (Ctrl+R)', () => cmd('justifyRight')),
    justify: tbtn(ctx, I16.justify, 'Justify (Ctrl+J)', () => cmd('justifyFull')),
    ol: tbtn(ctx, I16.numbers, 'Numbering', () => cmd('insertOrderedList')),
    ul: tbtn(ctx, I16.bullets, 'Bullets', () => cmd('insertUnorderedList'))
  };
  const tb1 = h('div', { class: 'tb wr-tb noprint' },
    tbtn(ctx, I16.new, 'New (Ctrl+N)', () => ctx.go('http://write.lanscape.net/')),
    tbtn(ctx, I16.open, 'Open (Ctrl+O)', openDoc),
    tbtn(ctx, I16.save, 'Save (Ctrl+S)', () => save()),
    tsep(ctx),
    tbtn(ctx, I16.print, 'Print (Ctrl+P)', () => win.print()),
    tbtn(ctx, I16.find, 'Find (Ctrl+F)', () => findDialog(false)),
    tsep(ctx),
    tbtn(ctx, I16.cut, 'Cut', () => cmd('cut')),
    tbtn(ctx, I16.copy, 'Copy', () => { restore(); doc.execCommand('copy'); }),
    tbtn(ctx, I16.paste, 'Paste', () => pasteFromClipboard()),
    tsep(ctx),
    tbtn(ctx, I16.undo, 'Undo (Ctrl+Z)', () => cmd('undo')),
    tbtn(ctx, I16.redo, 'Redo (Ctrl+Y)', () => cmd('redo')),
    tsep(ctx),
    tbtn(ctx, I16.image, 'Insert Picture', () => { fileInput.value = ''; fileInput.click(); }),
    tbtn(ctx, I16.table, 'Insert Table', () => tableDialog()),
    tbtn(ctx, I16.link, 'Insert Link (Ctrl+K)', () => linkDialog()),
    tbtn(ctx, I16.hr, 'Horizontal Line', () => cmd('insertHorizontalRule')),
    tsep(ctx),
    zoomSel(), fileInput);
  function zoomSel() {
    const z = h('select', { class: 'fld', title: 'Zoom', 'aria-label': 'Zoom', style: { width: '64px' } }, ...[50, 75, 100, 125, 150, 200].map(n => h('option', { value: String(n), text: n + '%' })));
    z.value = '100';
    z.addEventListener('change', () => { zoom = +z.value; zoomWrap.style.zoom = String(zoom / 100); });
    return z;
  }
  const tb2 = h('div', { class: 'tb wr-tb noprint' }, styleSel, fontSel, sizeSel, tsep(ctx), B.bold, B.italic, B.underline, B.strike, colorBtn, markBtn, tsep(ctx), B.left, B.center, B.right, B.justify, tsep(ctx), B.ol, B.ul,
    tbtn(ctx, I16.outdent, 'Decrease Indent', () => cmd('outdent')), tbtn(ctx, I16.indent, 'Increase Indent', () => cmd('indent')), tsep(ctx),
    tbtn(ctx, I16.erase, 'Clear Formatting', () => { cmd('removeFormat'); cmd('formatBlock', '<p>'); }));
  function updateBars() {
    const q = n => { try { return doc.queryCommandState(n); } catch (e) { return false; } };
    B.bold.classList.toggle('on', q('bold')); B.italic.classList.toggle('on', q('italic')); B.underline.classList.toggle('on', q('underline')); B.strike.classList.toggle('on', q('strikeThrough'));
    const c = q('justifyCenter'), r = q('justifyRight'), j = q('justifyFull');
    B.center.classList.toggle('on', c); B.right.classList.toggle('on', r); B.justify.classList.toggle('on', j); B.left.classList.toggle('on', !c && !r && !j);
    B.ol.classList.toggle('on', q('insertOrderedList')); B.ul.classList.toggle('on', q('insertUnorderedList'));
    const sel = doc.getSelection();
    const node = sel && sel.anchorNode ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentNode) : null;
    if (!node || !inPage(node)) return;
    const b = blockOf(node);
    const tag = b ? b.nodeName.toLowerCase() : 'p';
    styleSel.value = /^h[1-3]$|^blockquote$|^pre$/.test(tag) ? tag : 'p';
    const cs = win.getComputedStyle(node);
    const pt = Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2;
    sizeSel.value = WRITE_SIZES.includes(pt) ? String(pt) : '';
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
    const f = WRITE_FONTS.find(([l, v]) => v.toLowerCase().includes(fam) || l.toLowerCase() === fam);
    fontSel.value = f ? f[1] : '';
  }
  /* ---------- ruler ---------- */
  const ruler = h('div', { class: 'wr-ruler noprint', 'aria-hidden': 'true' });
  const rr = h('div', { class: 'r' });
  for (let i = 0; i <= 64; i++) { const x = 96 + i * 9.6; if (x > 816) break; const big = i % 10 === 0, mid = i % 5 === 0; rr.append(h('i', { class: 't', style: { left: x + 'px', height: (big ? 7 : mid ? 5 : 3) + 'px' } })); if (big && i) rr.append(h('span', { class: 'n', style: { left: x + 'px' }, text: String(i / 10) })); }
  rr.append(h('i', { class: 'm', style: { left: '91px' } }), h('i', { class: 'm', style: { left: '715px' } }));
  ruler.append(rr);
  const zoomWrap = h('div', { class: 'wr-zoom' }, pageEl);
  const scroller = h('div', { class: 'wr-scroll' }, zoomWrap);
  /* ---------- dialogs ---------- */
  async function linkDialog() {
    const sel = doc.getSelection();
    const a = sel && sel.anchorNode ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentNode).closest('a') : null;
    const u = await ctx.ask('Insert Link', 'Address:', a ? a.getAttribute('href') : 'http://');
    if (u == null) return;
    if (!u.trim() || u.trim() === 'http://') { cmd('unlink'); return; }
    restore();
    if (doc.getSelection().isCollapsed) doc.execCommand('insertHTML', false, '<a href="' + esc(u.trim()) + '">' + esc(u.trim()) + '</a>');
    else doc.execCommand('createLink', false, u.trim());
    markDirty();
  }
  async function tableDialog() {
    const body = el('div', { html: '<div class="frow"><label for="wtR" style="min-width:110px">Number of rows:</label><input class="field" id="wtR" type="number" min="1" max="200" value="3" style="width:70px"></div><div class="frow"><label for="wtC" style="min-width:110px">Number of columns:</label><input class="field" id="wtC" type="number" min="1" max="20" value="3" style="width:70px"></div><label class="check"><input type="checkbox" id="wtH" checked> First row is a heading</label>' });
    const v = await openWin({ title: 'Insert Table', body, width: 'min(320px,94vw)', buttons: [{ label: 'OK', primary: true, value: 'ok' }, { label: 'Cancel', value: null }] }).result;
    if (v !== 'ok') return;
    const R = clamp(+$('#wtR', body).value || 3, 1, 200), C = clamp(+$('#wtC', body).value || 3, 1, 20), hd = $('#wtH', body).checked;
    let t = '<table><tbody>';
    for (let r = 0; r < R; r++) { t += '<tr>'; for (let c = 0; c < C; c++) t += (hd && r === 0 ? '<th>' : '<td>') + '<br>' + (hd && r === 0 ? '</th>' : '</td>'); t += '</tr>'; }
    insertHTML(t + '</tbody></table><p><br></p>');
  }
  function cellAtCaret() { const sel = doc.getSelection(); const n = sel && sel.anchorNode; const e = n ? (n.nodeType === 1 ? n : n.parentNode) : null; return e && inPage(e) ? e.closest('td,th') : null; }
  function tableOp(op) {
    const cell = cellAtCaret();
    if (!cell) { ctx.status('Put the cursor in a table first.'); return; }
    const tr = cell.parentNode, table = cell.closest('table'), idx = Array.from(tr.children).indexOf(cell);
    const blank = tag => { const c = doc.createElement(tag); c.innerHTML = '<br>'; return c; };
    if (op === 'rowAbove' || op === 'rowBelow') { const n = doc.createElement('tr'); for (const c of tr.children) n.append(blank(c.nodeName === 'TH' && op === 'rowAbove' ? 'th' : 'td')); op === 'rowAbove' ? tr.before(n) : tr.after(n); }
    else if (op === 'colLeft' || op === 'colRight') { for (const row of table.querySelectorAll('tr')) { const ref = row.children[Math.min(idx, row.children.length - 1)]; const c = blank(ref && ref.nodeName === 'TH' ? 'th' : 'td'); if (!ref) row.append(c); else op === 'colLeft' ? ref.before(c) : ref.after(c); } }
    else if (op === 'delRow') { tr.remove(); if (!table.querySelector('tr')) table.remove(); }
    else if (op === 'delCol') { for (const row of table.querySelectorAll('tr')) { const c = row.children[idx]; if (c) c.remove(); } if (!table.querySelector('td,th')) table.remove(); }
    else if (op === 'delTable') table.remove();
    markDirty();
  }
  function symbolPopup(anchorX, anchorY) {
    const grid = ctx.h('div', { class: 'symbols' });
    for (const ch of '©®™°±×÷µΩ≈≠≤≥€£¥¢§¶•…—–½¼¾→←↑↓✓✗★☆♠♣♥♦♪☎✉☺∞√∑πΔ'.split('')) { const b = ctx.h('button', { type: 'button', text: ch }); b.addEventListener('mousedown', e => e.preventDefault()); b.addEventListener('click', () => { p.close(); cmd('insertText', ch); }); grid.append(b); }
    const p = appPopup(ctx, anchorX, anchorY, [{ node: grid }]);
  }
  const F = { q: '', r: '', cs: false };
  function textNodes() { const out = []; const w = doc.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) out.push(n); return out; }
  function findNext(silent) {
    if (!F.q) return false;
    const nodes = textNodes(), sel = doc.getSelection();
    const norm = s => (F.cs ? s : s.toLowerCase()), q = norm(F.q);
    let startNode = sel.rangeCount ? sel.getRangeAt(0).endContainer : null, startOff = sel.rangeCount ? sel.getRangeAt(0).endOffset : 0;
    let i0 = nodes.indexOf(startNode);
    if (i0 < 0) { i0 = 0; startOff = 0; }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = pass ? 0 : i0; i < nodes.length; i++) {
        const k = norm(nodes[i].nodeValue).indexOf(q, pass === 0 && i === i0 ? startOff : 0);
        if (k >= 0) {
          const r = doc.createRange(); r.setStart(nodes[i], k); r.setEnd(nodes[i], k + F.q.length);
          sel.removeAllRanges(); sel.addRange(r); savedRange = r.cloneRange();
          const p = nodes[i].parentNode; if (p && p.scrollIntoView) p.scrollIntoView({ block: 'center' });
          return true;
        }
      }
    }
    if (!silent) ctx.msg('info', 'Write', '<p>Write finished searching the document. "' + esc(F.q) + '" was not found.</p>');
    return false;
  }
  function findDialog(replace) {
    const body = el('div', { html: '<div class="frow"><label for="wfF" style="min-width:90px">Find what:</label><input class="field" id="wfF" style="flex:1;min-width:180px"></div>' + (replace ? '<div class="frow"><label for="wfR" style="min-width:90px">Replace with:</label><input class="field" id="wfR" style="flex:1;min-width:180px"></div>' : '') + '<label class="check"><input type="checkbox" id="wfC"> Match case</label>' });
    const f = $('#wfF', body);
    const sel = doc.getSelection();
    f.value = (sel && !sel.isCollapsed && inPage(sel.anchorNode) ? String(sel).split('\n')[0] : '') || F.q;
    if (replace) $('#wfR', body).value = F.r;
    $('#wfC', body).checked = F.cs;
    const sync = () => { F.q = f.value; F.cs = $('#wfC', body).checked; if (replace) F.r = $('#wfR', body).value; };
    const buttons = [{ label: 'Find Next', primary: true, onClick: () => { sync(); findNext(); return false; } }];
    if (replace) {
      buttons.push({ label: 'Replace', onClick: () => { sync(); const s = String(doc.getSelection()); if (s && (F.cs ? s === F.q : s.toLowerCase() === F.q.toLowerCase())) { restore(); doc.execCommand('insertText', false, F.r); markDirty(); } findNext(); return false; } });
      buttons.push({ label: 'Replace All', onClick: () => {
        sync(); if (!F.q) return false;
        const re = new RegExp(F.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), F.cs ? 'g' : 'gi');
        let n = 0;
        for (const t of textNodes()) { const v = t.nodeValue; const nv = v.replace(re, () => { n++; return F.r; }); if (nv !== v) t.nodeValue = nv; }
        if (n) markDirty();
        ctx.msg('info', 'Write', '<p>Write has completed its search and has made ' + n + ' replacement' + (n === 1 ? '' : 's') + '.</p>');
        return false;
      } });
    }
    buttons.push({ label: 'Cancel' });
    openWin({ title: replace ? 'Replace' : 'Find', body, modal: false, width: 'min(440px, 94vw)', buttons });
    f.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sync(); findNext(); } });
  }
  function counts() {
    const t = pageEl.innerText || '';
    return { words: (t.match(/\S+/g) || []).length, chars: t.replace(/\n/g, '').length, charsNoSp: t.replace(/\s/g, '').length, paras: pageEl.querySelectorAll('p,h1,h2,h3,h4,li,pre').length, pages: Math.max(1, Math.ceil(pageEl.scrollHeight / 1056)) };
  }
  const countSoon = debounce(() => { const c = counts(); status.words.textContent = c.words.toLocaleString() + ' words · ' + c.chars.toLocaleString() + ' characters'; updatePage(); }, 250);
  function updatePage() {
    const c = Math.max(1, Math.ceil(pageEl.scrollHeight / 1056));
    let y = 0;
    const sel = doc.getSelection();
    if (sel && sel.rangeCount && inPage(sel.anchorNode)) { const r = sel.getRangeAt(0).getBoundingClientRect(); y = r.top - pageEl.getBoundingClientRect().top; }
    status.page.textContent = 'Page ' + clamp(Math.floor(y / (1056 * zoom / 100)) + 1, 1, c) + ' of ' + c;
  }
  function wordCount() {
    const c = counts();
    ctx.msg('info', 'Word Count', '<table style="min-width:220px"><tr><td>Pages</td><td align="right"><b>' + c.pages + '</b></td></tr><tr><td>Words</td><td align="right"><b>' + c.words.toLocaleString() + '</b></td></tr><tr><td>Characters (no spaces)</td><td align="right"><b>' + c.charsNoSp.toLocaleString() + '</b></td></tr><tr><td>Characters (with spaces)</td><td align="right"><b>' + c.chars.toLocaleString() + '</b></td></tr><tr><td>Paragraphs</td><td align="right"><b>' + c.paras.toLocaleString() + '</b></td></tr></table>');
  }
  async function propsDialog() {
    const v = await ctx.ask('Document Properties', 'Title:', docTitle || (d ? d.meta.title : ''));
    if (v != null) { docTitle = v.trim(); markDirty(); }
  }
  async function pasteFromClipboard() {
    restore();
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        if (it.types.includes('text/html')) { const htm = await (await it.getType('text/html')).text(); insertFragment(cleanPaste(htm, doc)); return; }
        if (it.types.includes('text/plain')) { doc.execCommand('insertText', false, await (await it.getType('text/plain')).text()); markDirty(); return; }
      }
    } catch (e) { ctx.status('Press Ctrl+V to paste (your browser keeps the clipboard private from the toolbar).'); }
  }
  function insertFragment(frag) {
    const sel = doc.getSelection();
    if (!sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    r.deleteContents();
    const last = frag.lastChild;
    r.insertNode(frag);
    if (last) { const nr = doc.createRange(); nr.setStartAfter(last); nr.collapse(true); sel.removeAllRanges(); sel.addRange(nr); }
    markDirty();
  }
  async function insertImageFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    let src;
    if (file.size > 1.2e6 && !/svg|gif/.test(file.type)) src = await imageThumb(file, 1600, 0.86);
    else src = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file); });
    restore();
    doc.execCommand('insertImage', false, src);
    markDirty();
  }
  ctx.on(fileInput, 'change', () => insertImageFile(fileInput.files && fileInput.files[0]));
  /* image selection: size presets */
  let imgBar = null;
  function hideImgBar() { if (imgBar) { imgBar.remove(); imgBar = null; } for (const i of pageEl.querySelectorAll('img.sel')) i.classList.remove('sel'); }
  function showImgBar(img) {
    hideImgBar();
    img.classList.add('sel');
    const btn = (label, fn) => { const b = h('button', { type: 'button', class: 'btn', text: label, style: { minWidth: '0' } }); b.addEventListener('mousedown', e => e.preventDefault()); b.addEventListener('click', () => { fn(); markDirty(); }); return b; };
    imgBar = h('div', { class: 'wr-imgbar noprint' },
      ...[25, 50, 75, 100].map(p => btn(p + '%', () => { img.style.width = p + '%'; img.removeAttribute('width'); img.removeAttribute('height'); })),
      btn('Original', () => { img.style.width = ''; img.removeAttribute('width'); }),
      btn('Left', () => { img.style.cssFloat = 'left'; img.style.margin = '0 12px 6px 0'; }),
      btn('Inline', () => { img.style.cssFloat = ''; img.style.margin = ''; }),
      btn('Right', () => { img.style.cssFloat = 'right'; img.style.margin = '0 0 6px 12px'; }),
      btn('Remove', () => { img.remove(); hideImgBar(); }));
    scroller.append(imgBar);
    const r = img.getBoundingClientRect(), s = scroller.getBoundingClientRect();
    imgBar.style.left = Math.max(4, r.left - s.left + scroller.scrollLeft) + 'px';
    imgBar.style.top = Math.max(4, r.top - s.top + scroller.scrollTop - 34) + 'px';
  }
  /* ---------- open & save ---------- */
  async function openDoc() {
    const nd = await ctx.open({ title: 'Open', kinds: WRITE_KINDS, label: 'Documents Write can open: .docx, .rtf, .md, .txt, .doc' });
    if (nd) ctx.go(writeUrlFor(nd));
  }
  const TYPES = [{ ext: 'docx', label: 'Word Document (*.docx)' }, { ext: 'rtf', label: 'Rich Text Format (*.rtf)' }, { ext: 'md', label: 'Markdown (*.md)' }, { ext: 'html', label: 'Web Page (*.html)' }, { ext: 'txt', label: 'Text Only (*.txt)' }];
  const author = () => S.prefs.author || '';
  async function build(ext) {
    hideImgBar();
    if (ext === 'docx') return htmlToDocx(pageEl, { title: docTitle || (d ? d.meta.title : '') || name().replace(/\.[a-z0-9]+$/i, ''), author: author() });
    if (ext === 'rtf') return htmlToRtf(pageEl);
    if (ext === 'md') return htmlToMd(pageEl);
    if (ext === 'txt') return pageEl.innerText.replace(/\n{3,}/g, '\n\n');
    if (ext === 'html') return '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>' + esc(docTitle || name().replace(/\.[a-z0-9]+$/i, '')) + '</title><style>body{font:12pt/1.4 "Times New Roman",serif;max-width:7in;margin:1in auto}table{border-collapse:collapse}td,th{border:1px solid #000;padding:3px 6px}img{max-width:100%}</style></head><body>\n' + pageEl.innerHTML + '\n</body></html>\n';
    throw new Error('Write can\'t save .' + ext + ' files.');
  }
  async function save() {
    if (d && !readOnlyFormat && canWriteBack(d) && /^(docx|rtf|md|txt)$/.test(d.ext)) {
      ctx.status('Saving ' + d.name + '...');
      const r = await ctx.save(d, await build(d.ext));
      if (r.ok) { dirty = false; retitle(); ctx.status('Saved ' + d.name + ' (' + fmtBytes(d.size) + ').'); return true; }
      if (r.why === 'denied' || r.why === 'error') { ctx.msg('error', 'Write', '<p>Write couldn\'t save ' + esc(d.name) + '.</p><p class="hint">' + esc(r.why === 'denied' ? 'Saving into this folder wasn\'t allowed.' : (r.error && r.error.message) || '') + '</p>'); return false; }
    }
    return saveAs();
  }
  async function saveAs() {
    const base = d ? d.name.replace(/\.[a-z0-9]+$/i, '') : (pageEl.innerText.trim().split('\n')[0] || 'Untitled').slice(0, 40);
    const ext = d && /^(docx|rtf|md)$/.test(d.ext) ? d.ext : 'docx';
    const nd = await ctx.saveAs({ title: 'Save As', name: base + '.' + ext, dir: d && canWriteBack(d) ? d.dir : VROOT + '/', types: TYPES.slice().sort((a, b) => (a.ext === ext ? -1 : b.ext === ext ? 1 : 0)), data: build });
    if (!nd) return false;
    dirty = false;
    if (nd === 'download') { retitle(); return true; }
    ctx.go(nd.kind === 'html' ? nd.url : writeUrlFor(nd), { replace: true, noCheck: true });
    return true;
  }
  /* ---------- menus ---------- */
  const menus = appMenubar(ctx, [
    { label: 'File', items: () => [
      { label: 'New', key: 'Ctrl+N', act: () => ctx.go('http://write.lanscape.net/') },
      { label: 'Open...', key: 'Ctrl+O', act: openDoc },
      { label: 'Save', key: 'Ctrl+S', act: save },
      { label: 'Save As...', act: saveAs },
      { sep: 1 },
      { label: 'Properties...', act: propsDialog },
      { label: 'Print...', key: 'Ctrl+P', act: () => win.print() },
      { sep: 1 },
      { label: 'Send to Notepad (plain text)', act: () => { if (d) ctx.go('http://notepad.lanscape.net/edit?url=' + encodeURIComponent(d.url)); }, disabled: () => !d || !isTextKind(d.kind) },
      { label: 'Exit', act: () => back() }
    ] },
    { label: 'Edit', items: () => [
      { label: 'Undo', key: 'Ctrl+Z', act: () => cmd('undo') },
      { label: 'Redo', key: 'Ctrl+Y', act: () => cmd('redo') },
      { sep: 1 },
      { label: 'Cut', key: 'Ctrl+X', act: () => cmd('cut') },
      { label: 'Copy', key: 'Ctrl+C', act: () => { restore(); doc.execCommand('copy'); } },
      { label: 'Paste', key: 'Ctrl+V', act: pasteFromClipboard },
      { label: 'Select All', key: 'Ctrl+A', act: () => { pageEl.focus(); doc.execCommand('selectAll'); } },
      { sep: 1 },
      { label: 'Find...', key: 'Ctrl+F', act: () => findDialog(false) },
      { label: 'Replace...', key: 'Ctrl+H', act: () => findDialog(true) }
    ] },
    { label: 'View', items: () => [
      ...[50, 75, 100, 125, 150, 200].map(z => ({ label: 'Zoom ' + z + '%', radio: () => zoom === z, act: () => { zoom = z; zoomWrap.style.zoom = String(z / 100); tb1.querySelector('select').value = String(z); } })),
      { sep: 1 },
      { label: 'Ruler', check: () => !ruler.hidden, act: () => { ruler.hidden = !ruler.hidden; } },
      { label: 'Spelling Underlines', check: () => pageEl.spellcheck, act: () => { pageEl.spellcheck = !pageEl.spellcheck; } },
      { label: 'Word Count...', act: wordCount }
    ] },
    { label: 'Insert', items: () => [
      { label: 'Picture...', act: () => { fileInput.value = ''; fileInput.click(); } },
      { label: 'Table...', act: tableDialog },
      { label: 'Link...', key: 'Ctrl+K', act: linkDialog },
      { label: 'Horizontal Line', act: () => cmd('insertHorizontalRule') },
      { label: 'Page Break', key: 'Ctrl+Enter', act: () => insertHTML('<hr class="pagebreak"><p><br></p>') },
      { label: 'Date and Time', act: () => cmd('insertText', new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })) },
      { label: 'Symbol...', act: () => { const r = tb1.getBoundingClientRect(); symbolPopup(r.left + 200, r.bottom); } }
    ] },
    { label: 'Format', items: () => [
      { label: 'Bold', key: 'Ctrl+B', act: () => cmd('bold') },
      { label: 'Italic', key: 'Ctrl+I', act: () => cmd('italic') },
      { label: 'Underline', key: 'Ctrl+U', act: () => cmd('underline') },
      { label: 'Superscript', act: () => cmd('superscript') },
      { label: 'Subscript', act: () => cmd('subscript') },
      { sep: 1 },
      { label: 'Heading 1', key: 'Ctrl+Alt+1', act: () => setStyle('h1') },
      { label: 'Heading 2', key: 'Ctrl+Alt+2', act: () => setStyle('h2') },
      { label: 'Heading 3', key: 'Ctrl+Alt+3', act: () => setStyle('h3') },
      { label: 'Normal', key: 'Ctrl+Alt+0', act: () => setStyle('p') },
      { sep: 1 },
      { label: 'Single Spacing', act: () => lineSpacing(1) },
      { label: '1.5 Line Spacing', act: () => lineSpacing(1.5) },
      { label: 'Double Spacing', act: () => lineSpacing(2) },
      { sep: 1 },
      { label: 'Clear Formatting', act: () => { cmd('removeFormat'); } }
    ] },
    { label: 'Table', items: () => [
      { label: 'Insert Table...', act: tableDialog },
      { sep: 1 },
      { label: 'Insert Row Above', act: () => tableOp('rowAbove') },
      { label: 'Insert Row Below', act: () => tableOp('rowBelow') },
      { label: 'Insert Column Left', act: () => tableOp('colLeft') },
      { label: 'Insert Column Right', act: () => tableOp('colRight') },
      { sep: 1 },
      { label: 'Delete Row', act: () => tableOp('delRow') },
      { label: 'Delete Column', act: () => tableOp('delCol') },
      { label: 'Delete Table', act: () => tableOp('delTable') }
    ] },
    { label: 'Help', items: () => [{ label: 'About Write', act: () => ctx.msg('info', 'About LANscape Write', '<p><b>LANscape Write</b> ' + VERSION + '</p><p>Opens and saves Word (.docx), Rich Text (.rtf), Markdown (.md), web pages and plain text.</p><p class="hint">Fonts, colors, lists, tables, links and pictures travel to Word and back.</p>') }] }
  ]);
  ctx.root.append(menus.el, tb1, tb2);
  if (note) ctx.root.append(h('div', { class: 'wr-note noprint', text: note }));
  else if (d && d.demo) ctx.root.append(h('div', { class: 'wr-note noprint', text: 'This is a demo document. Use File > Save As to keep your own copy.' }));
  else if (d && !canWriteBack(d)) ctx.root.append(h('div', { class: 'wr-note noprint', text: 'This folder was opened read-only, so Save makes a copy (in ' + VROOT + ' or your Downloads). Open the folder with File > Open Folder in Chrome or Edge to save in place.' }));
  ctx.root.append(ruler, scroller, h('div', { class: 'status noprint' }, status.page, status.words, status.fmt, status.mod));
  /* ---------- events ---------- */
  ctx.on(pageEl, 'input', markDirty);
  ctx.on(pageEl, 'paste', e => {
    const dt = e.clipboardData;
    if (!dt) return;
    const file = Array.from(dt.files || []).find(f => /^image\//.test(f.type));
    if (file) { e.preventDefault(); insertImageFile(file); return; }
    const htm = dt.getData('text/html');
    if (htm) { e.preventDefault(); insertFragment(cleanPaste(htm, doc)); }
  });
  ctx.on(pageEl, 'drop', e => {
    const file = e.dataTransfer && Array.from(e.dataTransfer.files || []).find(f => /^image\//.test(f.type));
    if (!file) return;
    e.preventDefault();
    const pos = doc.caretRangeFromPoint ? doc.caretRangeFromPoint(e.clientX, e.clientY) : null;
    if (pos) { const sel = doc.getSelection(); sel.removeAllRanges(); sel.addRange(pos); savedRange = pos.cloneRange(); }
    insertImageFile(file);
  });
  ctx.on(pageEl, 'click', e => {
    const a = e.target.closest('a[href]');
    if (a) { e.preventDefault(); if (e.ctrlKey || e.metaKey) ctx.go(a.getAttribute('href')); else ctx.status(a.getAttribute('href') + '  (Ctrl+click to follow)'); }
    if (e.target.nodeName === 'IMG') showImgBar(e.target); else hideImgBar();
  });
  ctx.on(scroller, 'scroll', () => { if (imgBar) hideImgBar(); }, { passive: true });
  ctx.on(doc, 'keydown', e => {
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (!mod) return;
    const map = { s: () => save(), o: openDoc, n: () => ctx.go('http://write.lanscape.net/'), p: () => win.print(), f: () => findDialog(false), h: () => findDialog(true), k: linkDialog, l: () => cmd('justifyLeft'), e: () => cmd('justifyCenter'), r: () => cmd('justifyRight'), j: () => cmd('justifyFull'), y: () => cmd('redo') };
    if (e.altKey && /^[0-3]$/.test(e.key)) { e.preventDefault(); setStyle(e.key === '0' ? 'p' : 'h' + e.key); return; }
    if (k === 'enter') { e.preventDefault(); insertHTML('<hr class="pagebreak"><p><br></p>'); return; }
    if (map[k] && !e.altKey && !(k === 'y' && e.shiftKey)) { e.preventDefault(); map[k](); }
  });
  retitle();
  countSoon();
  pageEl.focus();
  const r0 = doc.createRange(); r0.selectNodeContents(pageEl.firstElementChild || pageEl); r0.collapse(true);
  doc.getSelection().removeAllRanges(); doc.getSelection().addRange(r0); savedRange = r0.cloneRange();
  updateBars();
  return {
    title: name() + ' - Write',
    isDirty: () => dirty, save, docName: name,
    discard() { dirty = false; }
  };
}
