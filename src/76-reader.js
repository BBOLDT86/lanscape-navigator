/* ===================================================================
   LANscape Reader: PDF viewer + mark-up (highlights, pen, shapes,
   text boxes, sticky notes, review stamps), comments list, and a
   marked-up copy written with pdf-lib
   =================================================================== */
const READER_CSS = `.rp-tb .fld{height:21px}
.rp-main{flex:1;min-height:0;display:flex;gap:0;background:#808080}
.rp-side{width:170px;flex:none;display:flex;flex-direction:column;background:var(--face);border-right:1px solid var(--dk)}
.rp-side .tabs{display:flex}
.rp-side .tabs button{flex:1;border:0;background:var(--face);padding:4px 2px;box-shadow:inset -1px -1px var(--sh),inset 1px 1px var(--hi);font-size:11px}
.rp-side .tabs button.on{font-weight:bold;box-shadow:inset 1px 1px var(--sh)}
.rp-thumbs,.rp-outline{flex:1;overflow:auto;padding:8px 6px;background:#9a9a9a}
.rp-thumb{display:block;margin:0 auto 10px;text-align:center;font-size:11px;color:#fff;cursor:pointer}
.rp-thumb canvas,.rp-thumb .ph{display:block;margin:0 auto 3px;background:#fff;box-shadow:1px 1px 0 #000}
.rp-thumb.on canvas,.rp-thumb.on .ph{outline:3px solid #000080}
.rp-outline{background:#fff;font-size:12px}
.rp-outline div{padding:2px 4px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rp-outline div:hover{background:var(--sel);color:var(--selt)}
.rp-view{flex:1;min-width:0;overflow:auto;position:relative;outline:none}
.rp-pages{display:flex;flex-direction:column;align-items:center;gap:14px;padding:16px 12px 40px;min-width:max-content}
.rp-page{position:relative;background:#fff;box-shadow:2px 2px 0 rgba(0,0,0,.45);flex:none}
.rp-page canvas.pg{position:absolute;left:0;top:0;display:block}
.rp-page .num{position:absolute;left:-2px;bottom:-15px;font-size:10px;color:#ddd}
.rp-ann{position:absolute;left:0;top:0;z-index:3;pointer-events:none;overflow:visible}
.rp-ann g[data-id]{pointer-events:visiblePainted;cursor:move}
.rp-ann .hitline{pointer-events:stroke}
.rp-view.draw .rp-ann g[data-id],.rp-view.mark .rp-ann g[data-id],.rp-view.hand .rp-ann g[data-id]{pointer-events:none}
.rp-view.draw .textLayer,.rp-view.hand .textLayer{pointer-events:none}
.rp-view.draw .rp-page{cursor:crosshair}
.rp-view.hand,.rp-view.hand .rp-page{cursor:grab}
.rp-view.mark .textLayer span{cursor:text}
.rp-links a{position:absolute;z-index:4;display:block}
.rp-links a:hover{background:rgba(255,255,0,.25)}
.rp-view.draw .rp-links,.rp-view.mark .rp-links{pointer-events:none}
.rp-hits{position:absolute;inset:0;z-index:2;pointer-events:none}
.rp-hits i{position:absolute;background:rgba(255,160,0,.35);outline:1px solid rgba(200,100,0,.6)}
.rp-hits i.cur{background:rgba(0,170,0,.45);outline:2px solid #006400}
.rp-ed{position:absolute;z-index:6;font:14px Arial,sans-serif;border:1px dashed #000080;background:rgba(255,255,255,.9);padding:2px;resize:both;min-width:120px;min-height:24px;outline:none}
.rp-com{width:270px;flex:none;display:flex;flex-direction:column;background:var(--face);border-left:1px solid var(--dk)}
.rp-com-h{padding:4px 6px;display:flex;gap:4px;align-items:center;border-bottom:1px solid var(--sh)}
.rp-com-h b{flex:1}
.rp-list{flex:1;overflow:auto;background:#fff}
.rc{border-bottom:1px solid #ddd;padding:5px 6px 6px;font-size:11px}
.rc.on{background:#e8eef9}
.rc-h{display:flex;gap:6px;align-items:center;cursor:pointer}
.rc-h i{width:12px;height:12px;flex:none;border:1px solid #000}
.rc-h b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc-h span{color:#555}
.rc textarea{width:100%;margin-top:4px;font:12px Arial,sans-serif;resize:vertical;min-height:34px;border:1px solid #bbb}
.rc .row{display:flex;gap:6px;align-items:center;margin-top:4px;color:#555}
.rc .row select{font-size:11px}
.rc .row button{margin-left:auto;font-size:11px;min-width:0;padding:1px 6px}
.rp-swatch{width:16px;height:16px;border:1px solid #000;display:inline-block}
.rp-home{flex:1;overflow:auto;background:#fff;padding:16px 22px;font:13px/1.45 Arial,sans-serif}
.rp-home h1{font:bold 22px Georgia,serif;margin:0 0 10px;color:#7a0000}
.rp-home table{border-collapse:collapse;min-width:min(720px,100%)}
.rp-home td,.rp-home th{padding:4px 8px;border-bottom:1px solid #ddd;text-align:left}
.rp-home th{background:#eee}
.rp-print{display:none}
.textLayer{position:absolute;text-align:initial;inset:0;overflow:hidden;opacity:.25;line-height:1;-webkit-text-size-adjust:none;text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0;z-index:2}
.textLayer :is(span,br){color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0% 0%}
.textLayer span.markedContent{top:0;height:0}
.textLayer ::selection{background:#0000ff}
.textLayer br::selection{background:transparent}
.textLayer .endOfContent{display:block;position:absolute;inset:100% 0 0;z-index:-1;cursor:default;user-select:none}
.textLayer .endOfContent.active{top:0}
[data-main-rotation="90"]{transform:rotate(90deg) translateY(-100%)}
[data-main-rotation="180"]{transform:rotate(180deg) translate(-100%,-100%)}
[data-main-rotation="270"]{transform:rotate(270deg) translateX(-100%)}
@media print{.rp-main,.rp-tb,.rp-tb2{display:none!important}.rp-print{display:block}.rp-print img{display:block;width:100%;page-break-after:always;break-after:page}}`;
const STAMPS = [['APPROVED', '#008000'], ['MEETS SPEC', '#008000'], ['CLARIFY', '#c05800'], ['+ OPTION', '#0050c0'], ['EXCEPTION', '#c00000'], ['REVISE', '#c00000'], ['REJECTED', '#c00000'], ['NOT APPLICABLE', '#606060'], ['FOR REVIEW', '#7030a0'], ['DRAFT', '#606060'], ['CONFIDENTIAL', '#c00000']];
const RTOOLS = [
  ['select', 'Select (V)', 'v', '<svg viewBox="0 0 16 16"><path d="M3 1v13l3.2-3.2L8.6 15l2-1-2.3-4.2H13z" fill="#fff" stroke="#000"/></svg>'],
  ['hand', 'Hand (H)', 'h', '<svg viewBox="0 0 16 16"><path d="M5 14 2.5 9.5c-.4-.8.6-1.6 1.3-.9L5 10V3c0-.8 1.3-.8 1.3 0v5V2c0-.8 1.3-.8 1.3 0v6V3c0-.8 1.3-.8 1.3 0v5-3c0-.8 1.3-.8 1.3 0v6c0 2-1 3-2 3z" fill="#fff" stroke="#000" stroke-width=".8"/></svg>'],
  ['highlight', 'Highlight text (M)', 'm', '<svg viewBox="0 0 16 16"><rect x="1" y="9" width="14" height="5" fill="#ffe600"/><path d="M4 9 9 2l3 2-4 6z" fill="#fff" stroke="#000"/></svg>'],
  ['underline', 'Underline text (U)', 'u', '<svg viewBox="0 0 16 16"><text x="3" y="11" font-size="11" font-family="Times New Roman" font-weight="bold">T</text><path d="M1 14h14" stroke="#0050c0" stroke-width="2"/></svg>'],
  ['strike', 'Strike out text (K)', 'k', '<svg viewBox="0 0 16 16"><text x="2" y="12" font-size="11" font-family="Times New Roman">ab</text><path d="M1 8.5h14" stroke="#c00000" stroke-width="1.6"/></svg>'],
  ['pen', 'Pen (P)', 'p', '<svg viewBox="0 0 16 16"><path d="M2 12c2-3 3 1 5-2s3-5 6-6" fill="none" stroke="#c00000" stroke-width="1.6"/><path d="M11 1l3 3-2 1-2-2z" fill="#000"/></svg>'],
  ['line', 'Line (L)', 'l', '<svg viewBox="0 0 16 16"><path d="M2 14 14 2" stroke="#000" stroke-width="1.8"/></svg>'],
  ['arrow', 'Arrow (A)', 'a', '<svg viewBox="0 0 16 16"><path d="M2 14 12 4" stroke="#000" stroke-width="1.8"/><path d="M14 2 7 4l5 5z" fill="#000"/></svg>'],
  ['rect', 'Rectangle (R)', 'r', '<svg viewBox="0 0 16 16"><rect x="2" y="4" width="12" height="9" fill="none" stroke="#c00000" stroke-width="1.6"/></svg>'],
  ['ellipse', 'Cloud / ellipse (E)', 'e', '<svg viewBox="0 0 16 16"><ellipse cx="8" cy="8.5" rx="6.3" ry="4.8" fill="none" stroke="#c00000" stroke-width="1.6"/></svg>'],
  ['text', 'Text box (T)', 't', '<svg viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="11" fill="#fff" stroke="#000" stroke-dasharray="2 1"/><text x="4.5" y="12" font-size="10" font-family="Arial" font-weight="bold">T</text></svg>'],
  ['note', 'Sticky note (N)', 'n', '<svg viewBox="0 0 16 16"><path d="M2 2h12v8l-4 4H2z" fill="#ffe680" stroke="#806000"/><path d="M10 14v-4h4" fill="#f0c040" stroke="#806000"/><path d="M4 5h7M4 7.5h7" stroke="#806000"/></svg>'],
  ['stamp', 'Stamp (S)', 's', '<svg viewBox="0 0 16 16"><rect x="1" y="4" width="14" height="8" rx="2" fill="none" stroke="#008000" stroke-width="1.6"/><text x="8" y="10.3" font-size="5" text-anchor="middle" font-family="Arial" font-weight="bold" fill="#008000">OK</text></svg>']
];
const DRAW_TOOLS = new Set(['pen', 'line', 'arrow', 'rect', 'ellipse', 'text', 'note', 'stamp']);
const MARK_TOOLS = new Set(['highlight', 'underline', 'strike']);
const ANN_LABEL = { highlight: 'Highlight', underline: 'Underline', strike: 'Strikeout', pen: 'Pen', line: 'Line', arrow: 'Arrow', rect: 'Rectangle', ellipse: 'Ellipse', text: 'Text Box', note: 'Note', stamp: 'Stamp' };
const DEFAULT_COLOR = { highlight: '#ffe600', underline: '#0050c0', strike: '#c00000', pen: '#c00000', line: '#c00000', arrow: '#c00000', rect: '#c00000', ellipse: '#c00000', text: '#c00000', note: '#f0c040', stamp: '#008000' };
const annKey = d => 'annots:' + d.path;
async function readerHome(ctx) {
  const { h } = ctx;
  const pdfs = docsShown().filter(d => d.kind === 'pdf').sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
  const recent = (S.recentDocs || []).map(r => S.docs.get(r.path)).filter(d => d && d.active && d.kind === 'pdf');
  const counts = {};
  for (const d of pdfs) { const a = await ctx.kv.get(annKey(d)); if (a && a.list && a.list.length) counts[d.path] = a.list.length; }
  const row = d => '<tr><td>' + iconFor(d) + ' <a href="' + esc(d.url) + '">' + esc(d.meta.title) + '</a><div style="color:#666;font-size:11px">' + esc(d.path) + '</div></td><td>' + (d.meta.pages || '?') + '</td><td>' + fmtBytes(d.size) + '</td><td>' + (counts[d.path] ? '<b>' + counts[d.path] + '</b>' : '') + '</td><td>' + esc(fmtShort(d.mtime)) + '</td></tr>';
  const box = h('div', { class: 'rp-home' });
  box.innerHTML = '<h1>LANscape Reader</h1><p>Open a PDF to read it, search it and mark it up with highlights, shapes, notes and review stamps. Mark-ups are kept for each file in this browser, and you can save a marked-up copy.</p>' +
    (recent.length ? '<h3>Recently opened</h3><ul>' + recent.slice(0, 6).map(d => '<li><a href="' + esc(d.url) + '">' + esc(d.meta.title) + '</a></li>').join('') + '</ul>' : '') +
    '<h3>Every PDF on your LANscape (' + pdfs.length + ')</h3>' + (pdfs.length ? '<table><tr><th>Document</th><th>Pages</th><th>Size</th><th>Mark-ups</th><th>Modified</th></tr>' + pdfs.map(row).join('') + '</table>' : '<p><i>No PDFs yet. Open a folder that has some.</i></p>');
  const btn = h('button', { class: 'btn', type: 'button', text: 'Open a PDF...', style: { margin: '12px 0' } });
  btn.addEventListener('click', async () => { const d = await ctx.open({ title: 'Open', kinds: ['pdf'], label: 'PDF documents' }); if (d) ctx.go(d.url); });
  box.insertBefore(btn, box.children[2] || null);
  ctx.root.append(box);
  return { title: 'LANscape Reader' };
}
async function mountReader(ctx) {
  const { h, doc, win } = ctx;
  const d = ctx.file;
  if (!d) return readerHome(ctx);
  const pdfjs = await Libs.pdfjs();
  const blob = await ctx.blob(d);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const task = pdfjs.getDocument({ data: bytes.slice(), ownerDocument: doc, isEvalSupported: false });
  task.onPassword = async (update, reason) => {
    const pw = await ctx.ask(reason === 2 ? 'Wrong password' : 'Password Required', d.name + ' is protected. Password:', '');
    if (pw == null) { task.destroy(); return; }
    update(pw);
  };
  const pdf = await task.promise;
  ctx.cleanup(() => { try { pdf.destroy(); } catch (e) { /* gone */ } });
  const N = pdf.numPages;
  const stored = (await ctx.kv.get(annKey(d))) || {};
  let annots = Array.isArray(stored.list) ? stored.list : [];
  const view = (await ctx.kv.get('reader:view')) || {};
  let tool = 'select', color = null, lineW = view.lineW || 2, stampIdx = 0, zoomMode = 'width', scale = 1, rot = 0, sel = null;
  const undoS = [], redoS = [];
  const author = () => S.prefs.author || 'LANscape User';
  const persist = debounce(() => ctx.kv.set(annKey(d), { list: annots, updated: Date.now(), name: d.name }), 300);
  const snapshot = () => { undoS.push(JSON.stringify(annots)); if (undoS.length > 100) undoS.shift(); redoS.length = 0; };
  const changedAnn = (pages) => { persist(); for (const i of pages) drawAnnots(i); renderComments(); status(); };
  /* ---------- DOM ---------- */
  const view$ = h('div', { class: 'rp-view', tabindex: '0', 'aria-label': 'PDF pages' });
  const pagesBox = h('div', { class: 'rp-pages' });
  view$.append(pagesBox);
  const thumbs = h('div', { class: 'rp-thumbs' }), outline = h('div', { class: 'rp-outline', hidden: true });
  const side = h('div', { class: 'rp-side noprint' }, h('div', { class: 'tabs' }, h('button', { type: 'button', class: 'on', text: 'Pages', onclick: e => { thumbs.hidden = false; outline.hidden = true; e.target.classList.add('on'); e.target.nextSibling.classList.remove('on'); } }), h('button', { type: 'button', text: 'Bookmarks', onclick: e => { thumbs.hidden = true; outline.hidden = false; e.target.classList.add('on'); e.target.previousSibling.classList.remove('on'); } })), thumbs, outline);
  side.hidden = view.side === false;
  const list = h('div', { class: 'rp-list' });
  const filterSel = h('select', { class: 'fld', title: 'Show', 'aria-label': 'Filter comments' }, h('option', { value: '', text: 'All' }), ...Object.keys(ANN_LABEL).map(k => h('option', { value: k, text: ANN_LABEL[k] })), h('option', { value: 'open', text: 'Open items' }));
  const com = h('div', { class: 'rp-com noprint' }, h('div', { class: 'rp-com-h' }, h('b', { text: 'Comments' }), filterSel), list);
  com.hidden = view.comments === false;
  const main = h('div', { class: 'rp-main' }, side, view$, com);
  const printBox = h('div', { class: 'rp-print' });
  const pageInput = h('input', { class: 'fld', style: { width: '42px', textAlign: 'center' }, 'aria-label': 'Page number', value: '1' });
  const zoomSel = h('select', { class: 'fld', 'aria-label': 'Zoom', style: { width: '92px' } }, h('option', { value: 'width', text: 'Fit Width' }), h('option', { value: 'page', text: 'Fit Page' }), ...[50, 75, 100, 125, 150, 200, 300, 400].map(z => h('option', { value: String(z), text: z + '%' })));
  const findIn = h('input', { class: 'fld', placeholder: 'Find in document', style: { width: '150px' }, 'aria-label': 'Find' });
  const findInfo = h('span', { style: { minWidth: '60px', fontSize: '11px' } });
  const colorBtn = h('button', { class: 'tbtn', type: 'button', title: 'Color', html: '<span class="rp-swatch"></span>' });
  const widthSel = h('select', { class: 'fld', title: 'Line width', 'aria-label': 'Line width', style: { width: '52px' } }, ...[1, 2, 3, 4, 6, 8].map(w => h('option', { value: String(w), text: w + ' pt' })));
  widthSel.value = String(lineW);
  const stampSel = h('select', { class: 'fld', title: 'Stamp', 'aria-label': 'Stamp', style: { width: '120px' } }, ...STAMPS.map(([l], i) => h('option', { value: String(i), text: l })), h('option', { value: 'custom', text: 'Custom...' }));
  const toolBtns = {};
  for (const [id, title, key, svg] of RTOOLS) toolBtns[id] = tbtn(ctx, svg, title, () => setTool(id));
  const tb1 = h('div', { class: 'tb rp-tb noprint' },
    tbtn(ctx, I16.open, 'Open', openOther), tbtn(ctx, I16.save, 'Save Marked-up Copy (Ctrl+S)', saveCopy), tbtn(ctx, I16.print, 'Print (Ctrl+P)', printDoc), tsep(ctx),
    tbtn(ctx, '<svg viewBox="0 0 16 16"><rect x="1" y="2" width="5" height="12" fill="#c0c0c0" stroke="#000"/><rect x="7" y="2" width="8" height="12" fill="#fff" stroke="#000"/></svg>', 'Pages & bookmarks', () => { side.hidden = !side.hidden; saveView(); refit(); }),
    tbtn(ctx, I16.prev, 'Previous page', () => goPage(curPage() - 1)), pageInput, h('span', { text: ' of ' + N + ' ' }), tbtn(ctx, I16.next, 'Next page', () => goPage(curPage() + 1)), tsep(ctx),
    tbtn(ctx, I16.zoomOut, 'Zoom out (-)', () => zoomBy(1 / 1.2)), zoomSel, tbtn(ctx, I16.zoomIn, 'Zoom in (+)', () => zoomBy(1.2)), tbtn(ctx, I16.rotate, 'Rotate view', () => { rot = (rot + 90) % 360; refit(true); }), tsep(ctx),
    findIn, tbtn(ctx, I16.prev, 'Previous match', () => findStep(-1)), tbtn(ctx, I16.next, 'Next match', () => findStep(1)), findInfo, tsep(ctx),
    tbtn(ctx, '<svg viewBox="0 0 16 16"><path d="M1 2h14v9H6l-3 3v-3H1z" fill="#ffe680" stroke="#806000"/><path d="M4 5h8M4 8h6" stroke="#806000"/></svg>', 'Comments list', () => { com.hidden = !com.hidden; saveView(); refit(); }));
  const tb2 = h('div', { class: 'tb rp-tb rp-tb2 noprint' }, ...RTOOLS.map(([id]) => toolBtns[id]), tsep(ctx), colorBtn, widthSel, stampSel, tsep(ctx),
    tbtn(ctx, I16.undo, 'Undo (Ctrl+Z)', undo), tbtn(ctx, I16.redo, 'Redo (Ctrl+Y)', redo),
    tbtn(ctx, '<svg viewBox="0 0 16 16"><path d="M3 4h10l-1 11H4z" fill="#ddd" stroke="#000"/><path d="M2 4h12M6 2h4" stroke="#000" stroke-width="1.5"/></svg>', 'Delete selected mark-up (Del)', delSel));
  const stStatus = { page: h('span', { text: '' }), info: h('span', { class: 'grow', text: '' }), count: h('span', { text: '' }) };
  /* ---------- menus ---------- */
  const menus = appMenubar(ctx, [
    { label: 'File', items: () => [
      { label: 'Open...', act: openOther }, { label: 'Save Marked-up Copy...', key: 'Ctrl+S', act: saveCopy }, { label: 'Download Original', act: () => ctx.download(d.name, blob) }, { sep: 1 },
      { label: 'Export Comments (CSV)...', act: () => exportComments('csv') }, { label: 'Export Comments Report (HTML)...', act: () => exportComments('html') }, { sep: 1 },
      { label: 'Print...', key: 'Ctrl+P', act: printDoc }, { label: 'Document Properties...', act: properties }, { sep: 1 }, { label: 'Close', act: () => back() }
    ] },
    { label: 'Edit', items: () => [
      { label: 'Undo', key: 'Ctrl+Z', act: undo, disabled: () => !undoS.length }, { label: 'Redo', key: 'Ctrl+Y', act: redo, disabled: () => !redoS.length }, { sep: 1 },
      { label: 'Delete Mark-up', key: 'Del', act: delSel, disabled: () => !sel }, { label: 'Delete All Mark-ups...', act: deleteAll, disabled: () => !annots.length }, { sep: 1 },
      { label: 'Find...', key: 'Ctrl+F', act: () => { findIn.focus(); findIn.select(); } }, { label: 'Your Name on Comments...', act: askAuthor }
    ] },
    { label: 'View', items: () => [
      { label: 'Fit Width', radio: () => zoomMode === 'width', act: () => setZoom('width') }, { label: 'Fit Page', radio: () => zoomMode === 'page', act: () => setZoom('page') }, { label: 'Actual Size', radio: () => zoomMode === '100', act: () => setZoom('100') },
      { label: 'Zoom In', key: '+', act: () => zoomBy(1.2) }, { label: 'Zoom Out', key: '-', act: () => zoomBy(1 / 1.2) }, { sep: 1 },
      { label: 'Rotate Clockwise', act: () => { rot = (rot + 90) % 360; refit(true); } }, { label: 'Rotate Counterclockwise', act: () => { rot = (rot + 270) % 360; refit(true); } }, { sep: 1 },
      { label: 'Pages Sidebar', check: () => !side.hidden, act: () => { side.hidden = !side.hidden; saveView(); refit(); } }, { label: 'Comments List', check: () => !com.hidden, act: () => { com.hidden = !com.hidden; saveView(); refit(); } }
    ] },
    { label: 'Tools', items: () => RTOOLS.map(([id, title]) => ({ label: title, radio: () => tool === id, act: () => setTool(id) })) },
    { label: 'Help', items: () => [{ label: 'About Reader', act: () => ctx.msg('info', 'About LANscape Reader', '<p><b>LANscape Reader</b> ' + VERSION + ', powered by PDF.js ' + esc(pdfjs.version) + ' and pdf-lib.</p><p>Mark-ups stay with the file in this browser. File &gt; Save Marked-up Copy writes them into a new PDF that any reader can show, plus a comments summary page.</p>') }] }
  ]);
  ctx.root.append(menus.el, tb1, tb2, main, h('div', { class: 'status noprint' }, stStatus.page, stStatus.info, stStatus.count), printBox);
  /* ---------- pages ---------- */
  const first = await pdf.getPage(1);
  const P = Array.from({ length: N }, (_, i) => ({ i, page: i === 0 ? first : null, div: null, vp: null, key: '', busy: false, w0: 0, h0: 0 }));
  const baseVp = (p, s) => p.getViewport({ scale: s, rotation: (p.rotate + rot) % 360 });
  function makePage(Pg) {
    const div = h('div', { class: 'rp-page', 'data-p': String(Pg.i) });
    Pg.cvHost = h('div');
    Pg.tl = h('div', { class: 'textLayer' });
    Pg.hits = h('div', { class: 'rp-hits' });
    Pg.svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Pg.svg.setAttribute('class', 'rp-ann');
    Pg.links = h('div', { class: 'rp-links' });
    div.append(Pg.cvHost, Pg.hits, Pg.tl, Pg.svg, Pg.links, h('span', { class: 'num', text: String(Pg.i + 1) }));
    Pg.div = div;
    return div;
  }
  function sizePage(Pg, w, hh) {
    Pg.div.style.width = w + 'px'; Pg.div.style.height = hh + 'px';
    Pg.svg.setAttribute('width', w); Pg.svg.setAttribute('height', hh); Pg.svg.setAttribute('viewBox', '0 0 ' + w + ' ' + hh);
  }
  for (const Pg of P) pagesBox.append(makePage(Pg));
  function layoutAll() {
    const v = baseVp(first, scale);
    for (const Pg of P) {
      const vp = Pg.page ? baseVp(Pg.page, scale) : null;
      sizePage(Pg, vp ? vp.width : v.width, vp ? vp.height : v.height);
      if (vp) Pg.vp = vp;
    }
  }
  function fitScale() {
    const v1 = baseVp(first, 1);
    const W = view$.clientWidth - 40, H = view$.clientHeight - 34;
    if (zoomMode === 'width') return clamp(W / v1.width, 0.1, 6);
    if (zoomMode === 'page') return clamp(Math.min(W / v1.width, H / v1.height), 0.1, 6);
    return clamp((+zoomMode || 100) / 100, 0.1, 8);
  }
  function refit(force) {
    const keepPage = curPage(), keepFrac = pageFrac();
    const ns = fitScale();
    if (!force && Math.abs(ns - scale) < 0.001) { visibleRender(); return; }
    scale = ns;
    layoutAll();
    for (const Pg of P) Pg.key = '';
    const top = P[keepPage].div.offsetTop + keepFrac * P[keepPage].div.offsetHeight - 16;
    view$.scrollTop = Math.max(0, top);
    zoomSel.value = zoomMode === 'width' || zoomMode === 'page' ? zoomMode : (zoomSel.querySelector('option[value="' + zoomMode + '"]') ? zoomMode : '');
    if (!zoomSel.value) { const o = h('option', { value: zoomMode, text: Math.round(scale * 100) + '%' }); zoomSel.append(o); zoomSel.value = zoomMode; }
    visibleRender();
    status();
  }
  function setZoom(z) { zoomMode = z; refit(true); }
  function zoomBy(f) { zoomMode = String(Math.round(clamp(scale * f, 0.1, 8) * 100)); refit(true); }
  const textCache = new Map();
  const getTextContent = async i => { if (!textCache.has(i)) textCache.set(i, (await getPg(i)).getTextContent()); return textCache.get(i); };
  async function getPg(i) { const Pg = P[i]; if (!Pg.page) { Pg.page = await pdf.getPage(i + 1); const vp = baseVp(Pg.page, scale); sizePage(Pg, vp.width, vp.height); Pg.vp = vp; } return Pg.page; }
  async function renderPage(i) {
    const Pg = P[i];
    const key = scale.toFixed(4) + '@' + rot;
    if (Pg.key === key || Pg.busy) return;
    Pg.busy = true;
    try {
      const page = await getPg(i);
      const vp = baseVp(page, scale);
      Pg.vp = vp;
      sizePage(Pg, vp.width, vp.height);
      const dpr = Math.min(win.devicePixelRatio || 1, 2);
      const cv = doc.createElement('canvas');
      cv.className = 'pg';
      cv.width = Math.max(1, Math.floor(vp.width * dpr)); cv.height = Math.max(1, Math.floor(vp.height * dpr));
      cv.style.width = vp.width + 'px'; cv.style.height = vp.height + 'px';
      if (Pg.task) { try { Pg.task.cancel(); } catch (e) { /* done */ } }
      Pg.task = page.render({ canvasContext: cv.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
      await Pg.task.promise;
      if (!ctx.alive()) return;
      Pg.cvHost.replaceChildren(cv);
      Pg.div.style.setProperty('--scale-factor', vp.scale);
      Pg.tl.replaceChildren();
      try { await pdfjs.renderTextLayer({ textContentSource: await getTextContent(i), container: Pg.tl, viewport: vp, textDivs: [] }).promise; } catch (e) { /* no text layer */ }
      await renderLinks(i);
      drawAnnots(i);
      drawHits(i);
      Pg.key = key;
    } catch (e) {
      if (!(e && e.name === 'RenderingCancelledException')) console.warn('page ' + (i + 1), e);
    } finally { Pg.busy = false; }
  }
  async function renderLinks(i) {
    const Pg = P[i];
    Pg.links.replaceChildren();
    let anns = [];
    try { anns = await Pg.page.getAnnotations(); } catch (e) { return; }
    for (const a of anns) {
      if (a.subtype !== 'Link' || !a.rect) continue;
      const [x1, y1, x2, y2] = Pg.vp.convertToViewportRectangle(a.rect);
      const el2 = h('a', { href: a.url || '#', title: a.url || 'Go to another page', style: { left: Math.min(x1, x2) + 'px', top: Math.min(y1, y2) + 'px', width: Math.abs(x2 - x1) + 'px', height: Math.abs(y2 - y1) + 'px' } });
      el2.addEventListener('click', async e => {
        e.preventDefault(); e.stopPropagation();
        if (a.url) { ctx.go(a.url); return; }
        let dest = a.dest;
        try { if (typeof dest === 'string') dest = await pdf.getDestination(dest); if (Array.isArray(dest)) goPage(await pdf.getPageIndex(dest[0])); } catch (er) { /* bad link */ }
      });
      Pg.links.append(el2);
    }
  }
  let io = null;
  const visible = new Set();
  function visibleRender() {
    for (const i of visible) renderPage(i);
    // forget pages far away to keep memory in check
    const keep = new Set(); for (const i of visible) for (let k = i - 3; k <= i + 3; k++) keep.add(k);
    let rendered = P.filter(Pg => Pg.key);
    if (rendered.length > 16) for (const Pg of rendered) if (!keep.has(Pg.i)) { Pg.cvHost.replaceChildren(); Pg.tl.replaceChildren(); Pg.key = ''; }
  }
  /* ---------- annotation drawing ---------- */
  const V = (Pg, x, y) => Pg.vp.convertToViewportPoint(x, y);
  const toPdf = (Pg, vx, vy) => Pg.vp.convertToPdfPoint(vx, vy);
  function vbox(Pg, x1, y1, x2, y2) { const a = V(Pg, x1, y1), b = V(Pg, x2, y2); return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) }; }
  function bboxPdf(a) {
    let xs = [], ys = [];
    if (a.rects) for (const r of a.rects) { xs.push(r[0], r[2]); ys.push(r[1], r[3]); }
    if (a.points) for (const p of a.points) { xs.push(p[0]); ys.push(p[1]); }
    if (a.x1 != null) { xs.push(a.x1, a.x2); ys.push(a.y1, a.y2); }
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  }
  const NOTE = 20, sw = (a, Pg) => Math.max(0.6, (a.width || 2) * Pg.vp.scale);
  function annSVG(a, Pg) {
    const c = esc(a.color || DEFAULT_COLOR[a.type]), op = a.opacity != null ? a.opacity : 1;
    let s = '';
    const line = (x1, y1, x2, y2, w, extra) => { const p = V(Pg, x1, y1), q = V(Pg, x2, y2); return '<line x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '" stroke="' + c + '" stroke-width="' + w.toFixed(2) + '" stroke-linecap="round"' + (extra || '') + '/>'; };
    switch (a.type) {
      case 'highlight': for (const r of a.rects) { const b = vbox(Pg, r[0], r[1], r[2], r[3]); s += '<rect x="' + b.x.toFixed(1) + '" y="' + b.y.toFixed(1) + '" width="' + b.w.toFixed(1) + '" height="' + b.h.toFixed(1) + '" fill="' + c + '" fill-opacity=".38" style="mix-blend-mode:multiply"/>'; } break;
      case 'underline': for (const r of a.rects) s += line(r[0], r[1] + (r[3] - r[1]) * 0.06, r[2], r[1] + (r[3] - r[1]) * 0.06, Math.max(1, 1.3 * Pg.vp.scale)) + line(r[0], r[1], r[2], r[3], 1, ' stroke-opacity="0" class="hitline"'); break;
      case 'strike': for (const r of a.rects) s += line(r[0], (r[1] + r[3]) / 2, r[2], (r[1] + r[3]) / 2, Math.max(1, 1.3 * Pg.vp.scale)) + line(r[0], r[1], r[2], r[3], 1, ' stroke-opacity="0" class="hitline"'); break;
      case 'pen': { const d2 = a.points.map((p, k) => { const v = V(Pg, p[0], p[1]); return (k ? 'L' : 'M') + v[0].toFixed(1) + ' ' + v[1].toFixed(1); }).join(''); s += '<path d="' + d2 + '" fill="none" stroke="' + c + '" stroke-width="' + sw(a, Pg).toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="' + op + '"/><path d="' + d2 + '" fill="none" stroke="transparent" stroke-width="12" class="hitline"/>'; break; }
      case 'line': case 'arrow': {
        s += line(a.x1, a.y1, a.x2, a.y2, sw(a, Pg)) + line(a.x1, a.y1, a.x2, a.y2, 12, ' stroke-opacity="0" class="hitline"');
        if (a.type === 'arrow') { const p = V(Pg, a.x1, a.y1), q = V(Pg, a.x2, a.y2); const ang = Math.atan2(q[1] - p[1], q[0] - p[0]), L = Math.max(8, sw(a, Pg) * 4.5); const pts = [[q[0], q[1]], [q[0] - L * Math.cos(ang - 0.42), q[1] - L * Math.sin(ang - 0.42)], [q[0] - L * Math.cos(ang + 0.42), q[1] - L * Math.sin(ang + 0.42)]]; s += '<polygon points="' + pts.map(x => x[0].toFixed(1) + ',' + x[1].toFixed(1)).join(' ') + '" fill="' + c + '"/>'; }
        break;
      }
      case 'rect': { const b = vbox(Pg, a.x1, a.y1, a.x2, a.y2); s += '<rect x="' + b.x.toFixed(1) + '" y="' + b.y.toFixed(1) + '" width="' + b.w.toFixed(1) + '" height="' + b.h.toFixed(1) + '" fill="' + (a.fill || 'none') + '" stroke="' + c + '" stroke-width="' + sw(a, Pg).toFixed(2) + '"/><rect x="' + b.x.toFixed(1) + '" y="' + b.y.toFixed(1) + '" width="' + b.w.toFixed(1) + '" height="' + b.h.toFixed(1) + '" fill="none" stroke="transparent" stroke-width="10" class="hitline"/>'; break; }
      case 'ellipse': { const b = vbox(Pg, a.x1, a.y1, a.x2, a.y2); s += '<ellipse cx="' + (b.x + b.w / 2).toFixed(1) + '" cy="' + (b.y + b.h / 2).toFixed(1) + '" rx="' + (b.w / 2).toFixed(1) + '" ry="' + (b.h / 2).toFixed(1) + '" fill="none" stroke="' + c + '" stroke-width="' + sw(a, Pg).toFixed(2) + '"/><ellipse cx="' + (b.x + b.w / 2).toFixed(1) + '" cy="' + (b.y + b.h / 2).toFixed(1) + '" rx="' + (b.w / 2).toFixed(1) + '" ry="' + (b.h / 2).toFixed(1) + '" fill="none" stroke="transparent" stroke-width="10" class="hitline"/>'; break; }
      case 'text': {
        const b = vbox(Pg, a.x1, a.y1, a.x2, a.y2), fs = (a.fontSize || 12) * Pg.vp.scale;
        s += '<rect x="' + b.x.toFixed(1) + '" y="' + b.y.toFixed(1) + '" width="' + b.w.toFixed(1) + '" height="' + b.h.toFixed(1) + '" fill="#fff" fill-opacity=".001" stroke="' + c + '" stroke-opacity=".35" stroke-dasharray="3 2"/>';
        s += '<text x="' + (b.x + 3).toFixed(1) + '" y="' + (b.y + fs * 1.02).toFixed(1) + '" font-family="Arial,Helvetica,sans-serif" font-size="' + fs.toFixed(1) + '" fill="' + c + '">' + String(a.text || '').split('\n').map((l, k) => '<tspan x="' + (b.x + 3).toFixed(1) + '" dy="' + (k ? (fs * 1.2).toFixed(1) : 0) + '">' + esc(l || ' ') + '</tspan>').join('') + '</text>';
        break;
      }
      case 'note': {
        const v = V(Pg, a.x1, a.y2), z = NOTE * Pg.vp.scale;
        s += '<g transform="translate(' + v[0].toFixed(1) + ' ' + v[1].toFixed(1) + ') scale(' + (z / 20).toFixed(3) + ')"><path d="M0 0h20v13l-7 7H0z" fill="#ffe680" stroke="#806000"/><path d="M13 20v-7h7" fill="#f0c040" stroke="#806000"/><path d="M3 5h13M3 9h13M3 13h8" stroke="#806000"/></g>';
        break;
      }
      case 'stamp': {
        const b = vbox(Pg, a.x1, a.y1, a.x2, a.y2), k = Pg.vp.scale;
        s += '<rect x="' + b.x.toFixed(1) + '" y="' + b.y.toFixed(1) + '" width="' + b.w.toFixed(1) + '" height="' + b.h.toFixed(1) + '" rx="' + (5 * k).toFixed(1) + '" fill="#fff" fill-opacity=".55" stroke="' + c + '" stroke-width="' + (2.5 * k).toFixed(2) + '"/>';
        s += '<text x="' + (b.x + b.w / 2).toFixed(1) + '" y="' + (b.y + b.h * 0.56).toFixed(1) + '" text-anchor="middle" font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="' + (b.h * 0.42).toFixed(1) + '" fill="' + c + '" textLength="' + Math.min(b.w * 0.9, (a.text || '').length * b.h * 0.33).toFixed(1) + '" lengthAdjust="spacingAndGlyphs">' + esc(a.text || '') + '</text>';
        s += '<text x="' + (b.x + b.w / 2).toFixed(1) + '" y="' + (b.y + b.h * 0.86).toFixed(1) + '" text-anchor="middle" font-family="Arial,sans-serif" font-size="' + (b.h * 0.17).toFixed(1) + '" fill="' + c + '">' + esc((a.author || '') + ' · ' + fmtShort(a.created || Date.now())) + '</text>';
        break;
      }
    }
    return s;
  }
  function drawAnnots(i) {
    const Pg = P[i];
    if (!Pg.vp) return;
    let html = '';
    for (const a of annots) {
      if (a.page !== i) continue;
      html += '<g data-id="' + a.id + '">' + annSVG(a, Pg) + '</g>';
      if (sel === a.id) {
        const b = bboxPdf(a), bx = a.type === 'note' ? (() => { const v = V(Pg, a.x1, a.y2); return { x: v[0], y: v[1], w: NOTE * Pg.vp.scale, h: NOTE * Pg.vp.scale }; })() : vbox(Pg, b.x1, b.y1, b.x2, b.y2);
        html += '<rect x="' + (bx.x - 4).toFixed(1) + '" y="' + (bx.y - 4).toFixed(1) + '" width="' + (bx.w + 8).toFixed(1) + '" height="' + (bx.h + 8).toFixed(1) + '" fill="none" stroke="#000080" stroke-dasharray="4 3"/>';
        if (/^(rect|ellipse|stamp|text)$/.test(a.type)) html += '<rect data-handle="1" x="' + (bx.x + bx.w - 1).toFixed(1) + '" y="' + (bx.y + bx.h - 1).toFixed(1) + '" width="9" height="9" fill="#000080" style="pointer-events:all;cursor:nwse-resize"/>';
      }
    }
    Pg.svg.innerHTML = html;
  }
  /* ---------- search ---------- */
  let hits = [], hitIdx = -1, lastQ = '';
  async function runFind(q) {
    hits = []; hitIdx = -1; lastQ = q;
    for (const Pg of P) Pg.hits.replaceChildren();
    if (!q) { findInfo.textContent = ''; return; }
    findInfo.textContent = 'Searching...';
    const lq = q.toLowerCase();
    for (let i = 0; i < N; i++) {
      if (lastQ !== q) return;
      const tc = await getTextContent(i);
      tc.items.forEach((it, k) => {
        const s2 = (it.str || '').toLowerCase();
        let at = s2.indexOf(lq);
        while (at >= 0) { hits.push({ page: i, item: it, off: at, len: q.length }); at = s2.indexOf(lq, at + lq.length); }
      });
    }
    findInfo.textContent = hits.length ? hits.length + ' found' : 'Not found';
    for (let i = 0; i < N; i++) drawHits(i);
    if (hits.length) findStep(1);
  }
  function hitRect(Pg, x) {
    const it = x.item, t = it.transform, len = (it.str || '').length || 1;
    const fh = Math.hypot(t[2], t[3]) || it.height || 10;
    const x1 = t[4] + it.width * (x.off / len), x2 = t[4] + it.width * ((x.off + x.len) / len);
    return vbox(Pg, x1, t[5] - fh * 0.22, x2, t[5] + fh * 0.88);
  }
  function drawHits(i) {
    const Pg = P[i];
    if (!Pg.vp) return;
    Pg.hits.replaceChildren(...hits.map((x, k) => (x.page === i ? (() => { const b = hitRect(Pg, x); return h('i', { class: k === hitIdx ? 'cur' : '', style: { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' } }); })() : null)).filter(Boolean));
  }
  async function findStep(dir) {
    if (findIn.value !== lastQ) { await runFind(findIn.value.trim()); return; }
    if (!hits.length) return;
    const old = hits[hitIdx];
    hitIdx = (hitIdx + dir + hits.length) % hits.length;
    const x = hits[hitIdx];
    await getPg(x.page);
    if (old && old.page !== x.page) drawHits(old.page);
    drawHits(x.page);
    const Pg = P[x.page], b = hitRect(Pg, x);
    view$.scrollTop = Pg.div.offsetTop + b.y - view$.clientHeight / 3;
    findInfo.textContent = (hitIdx + 1) + ' of ' + hits.length;
  }
  /* ---------- navigation ---------- */
  function curPage() {
    const mid = view$.scrollTop + view$.clientHeight * 0.35;
    let best = 0;
    for (const Pg of P) { if (Pg.div.offsetTop <= mid) best = Pg.i; else break; }
    return best;
  }
  function pageFrac() { const Pg = P[curPage()]; return clamp((view$.scrollTop + 16 - Pg.div.offsetTop) / Math.max(1, Pg.div.offsetHeight), 0, 1); }
  function goPage(i) { i = clamp(i, 0, N - 1); view$.scrollTop = P[i].div.offsetTop - 10; status(); }
  function status() {
    const c = curPage();
    pageInput.value = String(c + 1);
    stStatus.page.textContent = 'Page ' + (c + 1) + ' of ' + N + ' · ' + Math.round(scale * 100) + '%';
    stStatus.count.textContent = annots.length + ' mark-up' + (annots.length === 1 ? '' : 's');
    for (const t of thumbs.children) t.classList.toggle('on', +t.dataset.p === c);
  }
  /* thumbnails + outline */
  const thumbIO = new win.IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting || e.target.dataset.done) continue;
      e.target.dataset.done = '1';
      const i = +e.target.dataset.p;
      (async () => {
        const page = await getPg(i);
        const vp1 = baseVp(page, 1), k = 110 / vp1.width, vp = baseVp(page, k);
        const cv = doc.createElement('canvas'); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
        try { await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; e.target.querySelector('.ph').replaceWith(cv); } catch (er) { /* skip */ }
      })();
    }
  }, { root: thumbs, rootMargin: '300px 0px' });
  ctx.cleanup(() => thumbIO.disconnect());
  const v0 = baseVp(first, 110 / baseVp(first, 1).width);
  for (let i = 0; i < N; i++) {
    const t = h('div', { class: 'rp-thumb', 'data-p': String(i) }, h('div', { class: 'ph', style: { width: Math.floor(v0.width) + 'px', height: Math.floor(v0.height) + 'px' } }), String(i + 1));
    t.addEventListener('click', () => goPage(i));
    thumbs.append(t);
    thumbIO.observe(t);
  }
  pdf.getOutline().then(items => {
    if (!items || !items.length) { outline.innerHTML = '<p style="color:#666;padding:6px">This document has no bookmarks.</p>'; return; }
    const add = (arr, depth) => { for (const it of arr) { const row = h('div', { text: it.title, style: { paddingLeft: (4 + depth * 12) + 'px' }, title: it.title }); row.addEventListener('click', async () => { try { let dest = it.dest; if (typeof dest === 'string') dest = await pdf.getDestination(dest); if (Array.isArray(dest)) goPage(await pdf.getPageIndex(dest[0])); else if (it.url) ctx.go(it.url); } catch (e) { /* bad */ } }); outline.append(row); if (it.items && it.items.length) add(it.items, depth + 1); } };
    add(items, 0);
  }).catch(() => { /* none */ });
  /* ---------- tools & editing ---------- */
  function setTool(t) {
    tool = t;
    for (const id in toolBtns) toolBtns[id].classList.toggle('on', id === t);
    view$.classList.toggle('draw', DRAW_TOOLS.has(t));
    view$.classList.toggle('mark', MARK_TOOLS.has(t));
    view$.classList.toggle('hand', t === 'hand');
    color = (view.colors && view.colors[t]) || DEFAULT_COLOR[t] || '#c00000';
    colorBtn.querySelector('.rp-swatch').style.background = color;
    stStatus.info.textContent = { select: 'Click a mark-up to select it; drag to move it.', hand: 'Drag to scroll the pages.', highlight: 'Drag across text to highlight it.', underline: 'Drag across text to underline it.', strike: 'Drag across text to strike it out.', pen: 'Draw with the mouse.', line: 'Drag to draw a line.', arrow: 'Drag to draw an arrow.', rect: 'Drag to draw a box.', ellipse: 'Drag to draw an ellipse.', text: 'Click where the text should go.', note: 'Click to stick a note on the page.', stamp: 'Click to stamp: ' + stampLabel() }[t] || '';
    if (t !== 'select') select(null);
  }
  const stampLabel = () => (stampSel.value === 'custom' ? (view.customStamp || 'CUSTOM') : STAMPS[+stampSel.value][0]);
  const stampColor = () => (stampSel.value === 'custom' ? (view.customStampColor || '#7030a0') : STAMPS[+stampSel.value][1]);
  function saveView() { view.side = !side.hidden; view.comments = !com.hidden; view.lineW = lineW; ctx.kv.set('reader:view', view); }
  colorBtn.addEventListener('click', () => colorPopup(ctx, colorBtn, c => {
    color = c; colorBtn.querySelector('.rp-swatch').style.background = c;
    view.colors = view.colors || {}; view.colors[tool] = c; saveView();
    const a = annots.find(x => x.id === sel);
    if (a) { snapshot(); a.color = c; a.modified = Date.now(); changedAnn([a.page]); }
  }));
  widthSel.addEventListener('change', () => { lineW = +widthSel.value; saveView(); const a = annots.find(x => x.id === sel); if (a && a.width != null) { snapshot(); a.width = lineW; changedAnn([a.page]); } });
  stampSel.addEventListener('change', async () => {
    if (stampSel.value === 'custom') { const t = await ctx.ask('Custom Stamp', 'Stamp text:', view.customStamp || 'RECEIVED'); if (t) { view.customStamp = t.toUpperCase().slice(0, 30); saveView(); } }
    setTool('stamp');
  });
  async function askAuthor() {
    const v = await ctx.ask('Your Name', 'Name shown on your comments and stamps:', S.prefs.author || '');
    if (v != null && v.trim()) { S.prefs.author = v.trim().slice(0, 60); saveState(); }
  }
  let askedAuthor = !!S.prefs.author;
  function newAnn(page, type, props) {
    if (!askedAuthor) { askedAuthor = true; setTimeout(askAuthor, 300); }
    const a = Object.assign({ id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), page, type, color: color || DEFAULT_COLOR[type], author: author(), created: Date.now(), modified: Date.now(), comment: '', status: '' }, props);
    snapshot();
    annots.push(a);
    changedAnn([page]);
    return a;
  }
  function select(id) {
    const old = annots.find(x => x.id === sel);
    sel = id;
    if (old) drawAnnots(old.page);
    const a = annots.find(x => x.id === id);
    if (a) drawAnnots(a.page);
    for (const it of list.children) it.classList.toggle('on', it.dataset.id === id);
    const item = list.querySelector('[data-id="' + id + '"]');
    if (item) item.scrollIntoView({ block: 'nearest' });
  }
  function delSel() {
    const a = annots.find(x => x.id === sel);
    if (!a) return;
    snapshot();
    annots = annots.filter(x => x !== a);
    sel = null;
    changedAnn([a.page]);
  }
  async function deleteAll() {
    const v = await ctx.msg('warn', 'Delete All Mark-ups', '<p>Delete all ' + annots.length + ' mark-ups on this document?</p>', ['Delete All', 'Cancel']);
    if (v !== 'Delete All') return;
    snapshot();
    const pages = uniq(annots.map(a => a.page));
    annots = []; sel = null;
    changedAnn(pages);
  }
  function undo() { if (!undoS.length) return; redoS.push(JSON.stringify(annots)); annots = JSON.parse(undoS.pop()); sel = null; changedAnn(P.map(x => x.i).filter(i => P[i].vp)); }
  function redo() { if (!redoS.length) return; undoS.push(JSON.stringify(annots)); annots = JSON.parse(redoS.pop()); sel = null; changedAnn(P.map(x => x.i).filter(i => P[i].vp)); }
  function moveAnn(a, dx, dy) {
    if (a.rects) a.rects = a.rects.map(r => [r[0] + dx, r[1] + dy, r[2] + dx, r[3] + dy]);
    if (a.points) a.points = a.points.map(p => [p[0] + dx, p[1] + dy]);
    if (a.x1 != null) { a.x1 += dx; a.x2 += dx; a.y1 += dy; a.y2 += dy; }
  }
  function textBoxEditor(Pg, a, isNew) {
    const b = vbox(Pg, a.x1, a.y1, a.x2, a.y2);
    const ta = h('textarea', { class: 'rp-ed', style: { left: b.x + 'px', top: b.y + 'px', width: Math.max(140, b.w + 10) + 'px', height: Math.max(28, b.h + 10) + 'px', color: a.color, fontSize: ((a.fontSize || 12) * Pg.vp.scale) + 'px' } });
    ta.value = a.text || '';
    Pg.div.append(ta);
    setTimeout(() => ta.focus(), 0);
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      const t = ta.value.replace(/\s+$/, '');
      ta.remove();
      if (!t) { if (isNew) { annots = annots.filter(x => x !== a); undoS.pop(); } changedAnn([a.page]); return; }
      if (!isNew) snapshot();
      a.text = t;
      const lines = t.split('\n'), fs = a.fontSize || 12;
      const w = Math.max(...lines.map(l => l.length)) * fs * 0.56 + 8, hh = lines.length * fs * 1.2 + 6;
      const left = Math.min(a.x1, a.x2), top = Math.max(a.y1, a.y2);
      a.x1 = left; a.x2 = left + w; a.y2 = top; a.y1 = top - hh;
      a.modified = Date.now();
      changedAnn([a.page]);
    };
    ta.addEventListener('blur', finish);
    ta.addEventListener('keydown', e => { if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); ta.blur(); } e.stopPropagation(); });
  }
  let drag = null;
  const pageOf = e => { const div = e.target.closest && e.target.closest('.rp-page'); return div ? P[+div.dataset.p] : null; };
  const local = (Pg, e) => { const r = Pg.div.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  ctx.on(view$, 'pointerdown', e => {
    if (e.button !== 0 || e.target.closest('.rp-ed')) return;
    const Pg = pageOf(e);
    if (tool === 'hand') { drag = { kind: 'pan', x: e.clientX, y: e.clientY, sl: view$.scrollLeft, st: view$.scrollTop }; view$.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    if (!Pg || !Pg.vp) return;
    const [vx, vy] = local(Pg, e);
    const [px, py] = toPdf(Pg, vx, vy);
    if (tool === 'select') {
      if (e.target.dataset && e.target.dataset.handle) { const a = annots.find(x => x.id === sel); if (a) { snapshot(); drag = { kind: 'resize', a, Pg }; view$.setPointerCapture(e.pointerId); e.preventDefault(); } return; }
      const g = e.target.closest && e.target.closest('g[data-id]');
      if (g) { const a = annots.find(x => x.id === g.dataset.id); select(a.id); snapshot(); drag = { kind: 'move', a, Pg, last: [px, py], moved: false }; view$.setPointerCapture(e.pointerId); e.preventDefault(); return; }
      select(null);
      return;
    }
    if (MARK_TOOLS.has(tool)) { drag = { kind: 'mark', Pg, start: [px, py], v0: [vx, vy] }; return; }
    e.preventDefault();
    if (tool === 'note') { const a = newAnn(Pg.i, 'note', { x1: px, y1: py - NOTE, x2: px + NOTE, y2: py }); select(a.id); com.hidden = false; refitSoon(); setTimeout(() => { const ta = list.querySelector('[data-id="' + a.id + '"] textarea'); if (ta) ta.focus(); }, 60); return; }
    if (tool === 'stamp') { const label = stampLabel(), hh = 34, w = Math.max(110, label.length * 13 + 30); const a = newAnn(Pg.i, 'stamp', { text: label, color: stampColor(), x1: px - w / 2, y1: py - hh / 2, x2: px + w / 2, y2: py + hh / 2 }); select(a.id); return; }
    if (tool === 'text') { const fs = 12; const a = Object.assign({ id: 'a' + Date.now().toString(36), page: Pg.i, type: 'text', color, author: author(), created: Date.now(), modified: Date.now(), fontSize: fs, text: '', comment: '', status: '', x1: px, y1: py - fs * 1.5, x2: px + 120, y2: py }); snapshot(); annots.push(a); textBoxEditor(Pg, a, true); return; }
    drag = { kind: tool, Pg, start: [px, py], pts: [[px, py]], el: null };
    view$.setPointerCapture(e.pointerId);
  });
  ctx.on(view$, 'pointermove', e => {
    if (!drag) return;
    if (drag.kind === 'pan') { view$.scrollLeft = drag.sl - (e.clientX - drag.x); view$.scrollTop = drag.st - (e.clientY - drag.y); return; }
    if (drag.kind === 'mark') return;
    const Pg = drag.Pg;
    const [vx, vy] = local(Pg, e);
    const [px, py] = toPdf(Pg, vx, vy);
    if (drag.kind === 'move') { const dx = px - drag.last[0], dy = py - drag.last[1]; if (dx || dy) { moveAnn(drag.a, dx, dy); drag.last = [px, py]; drag.moved = true; drawAnnots(Pg.i); } return; }
    if (drag.kind === 'resize') { const a = drag.a; const [x0, y0] = [Math.min(a.x1, a.x2), Math.max(a.y1, a.y2)]; a.x1 = x0; a.y2 = y0; a.x2 = Math.max(x0 + 10, px); a.y1 = Math.min(y0 - 8, py); if (a.type === 'text') a.fontSize = clamp((a.y2 - a.y1) / Math.max(1, String(a.text || '').split('\n').length) / 1.2, 6, 72); drawAnnots(Pg.i); return; }
    if (drag.kind === 'pen') drag.pts.push([px, py]);
    drag.end = [px, py];
    const tmp = drag.kind === 'pen' ? { type: 'pen', points: drag.pts, color, width: lineW } : { type: drag.kind, color, width: lineW, x1: drag.start[0], y1: drag.start[1], x2: px, y2: py };
    if (!drag.el) { drag.el = doc.createElementNS('http://www.w3.org/2000/svg', 'g'); Pg.svg.append(drag.el); }
    drag.el.innerHTML = annSVG(tmp, Pg);
  });
  ctx.on(view$, 'pointerup', e => {
    const dg = drag;
    drag = null;
    if (!dg) return;
    try { view$.releasePointerCapture(e.pointerId); } catch (er) { /* fine */ }
    if (dg.kind === 'pan') return;
    if (dg.kind === 'move') { if (!dg.moved) undoS.pop(); else { dg.a.modified = Date.now(); changedAnn([dg.Pg.i]); } return; }
    if (dg.kind === 'resize') { dg.a.modified = Date.now(); changedAnn([dg.Pg.i]); return; }
    if (dg.kind === 'mark') { markFromSelection(dg, e); return; }
    if (dg.el) dg.el.remove();
    const Pg = dg.Pg;
    if (dg.kind === 'pen') {
      if (dg.pts.length < 2) return;
      const pts = [dg.pts[0]];
      for (const p of dg.pts) { const q = pts[pts.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.8 / Pg.vp.scale) pts.push(p); }
      newAnn(Pg.i, 'pen', { points: pts.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]), width: lineW });
      return;
    }
    if (!dg.end) return;
    const [x1, y1] = dg.start, [x2, y2] = dg.end;
    if (Math.hypot(x2 - x1, y2 - y1) < 3) return;
    if (dg.kind === 'line' || dg.kind === 'arrow') newAnn(Pg.i, dg.kind, { x1, y1, x2, y2, width: lineW });
    else newAnn(Pg.i, dg.kind, { x1: Math.min(x1, x2), y1: Math.min(y1, y2), x2: Math.max(x1, x2), y2: Math.max(y1, y2), width: lineW });
  });
  function markFromSelection(dg, e) {
    const Pg = dg.Pg;
    const s = win.getSelection();
    const rects = [];
    const text = s && !s.isCollapsed ? String(s) : '';
    if (s && !s.isCollapsed && s.rangeCount) {
      const pr = Pg.div.getBoundingClientRect();
      for (let k = 0; k < s.rangeCount; k++) for (const r of s.getRangeAt(k).getClientRects()) {
        if (r.width < 1 || r.height < 1 || r.top > pr.bottom || r.bottom < pr.top) continue;
        const a = toPdf(Pg, r.left - pr.left, r.top - pr.top), b = toPdf(Pg, r.right - pr.left, r.bottom - pr.top);
        rects.push([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
      }
      s.removeAllRanges();
    }
    // merge pieces on the same line
    rects.sort((p, q) => q[1] - p[1] || p[0] - q[0]);
    const merged = [];
    for (const r of rects) { const m = merged.find(x => Math.abs(x[1] - r[1]) < 2 && Math.abs(x[3] - r[3]) < 2 && r[0] <= x[2] + 4); if (m) { m[0] = Math.min(m[0], r[0]); m[2] = Math.max(m[2], r[2]); } else merged.push(r.slice()); }
    if (!merged.length) {
      // no text there (a scan, a drawing): mark the dragged box instead
      const pr = Pg.div.getBoundingClientRect();
      const end = toPdf(Pg, e.clientX - pr.left, e.clientY - pr.top);
      const [x1, y1] = dg.start;
      if (Math.abs(end[0] - x1) < 4 || Math.abs(end[1] - y1) < 2) return;
      merged.push([Math.min(x1, end[0]), Math.min(y1, end[1]), Math.max(x1, end[0]), Math.max(y1, end[1])]);
    }
    const a = newAnn(Pg.i, tool, { rects: merged.map(r => r.map(v => +v.toFixed(2))), quote: clip(text.replace(/\s+/g, ' ').trim(), 300) });
    select(a.id);
  }
  ctx.on(view$, 'dblclick', e => {
    const g = e.target.closest && e.target.closest('g[data-id]');
    if (!g) return;
    const a = annots.find(x => x.id === g.dataset.id), Pg = P[a.page];
    if (a.type === 'text') textBoxEditor(Pg, a, false);
    else if (a.type === 'stamp') ctx.ask('Stamp', 'Stamp text:', a.text).then(t => { if (t) { snapshot(); a.text = t.toUpperCase(); a.modified = Date.now(); changedAnn([a.page]); } });
    else { com.hidden = false; refitSoon(); const ta = list.querySelector('[data-id="' + a.id + '"] textarea'); if (ta) ta.focus(); }
  });
  /* ---------- comments list ---------- */
  function sortedAnnots() { return annots.slice().sort((p, q) => p.page - q.page || bboxPdf(q).y2 - bboxPdf(p).y2 || p.created - q.created); }
  function renderComments() {
    const f = filterSel.value;
    const items = sortedAnnots().filter(a => !f || (f === 'open' ? !a.status : a.type === f));
    const focusId = doc.activeElement && doc.activeElement.closest && doc.activeElement.closest('.rc') ? doc.activeElement.closest('.rc').dataset.id : null;
    if (focusId) return;
    list.replaceChildren(...items.map(a => {
      const ta = h('textarea', { placeholder: a.type === 'text' ? 'Text' : 'Add a comment...', 'aria-label': 'Comment' });
      ta.value = a.type === 'text' ? (a.text || '') : (a.comment || '');
      ta.addEventListener('input', debounce(() => { if (a.type === 'text') a.text = ta.value; else a.comment = ta.value; a.modified = Date.now(); persist(); drawAnnots(a.page); }, 250));
      const stSel = h('select', { class: 'fld' }, ...[['', 'No status'], ['accepted', 'Accepted'], ['rejected', 'Rejected'], ['completed', 'Completed'], ['question', 'Question']].map(([v, l]) => h('option', { value: v, text: l })));
      stSel.value = a.status || '';
      stSel.addEventListener('change', () => { a.status = stSel.value; a.modified = Date.now(); persist(); });
      const label = a.type === 'stamp' ? a.text : ANN_LABEL[a.type];
      const item = h('div', { class: 'rc' + (sel === a.id ? ' on' : ''), 'data-id': a.id },
        h('div', { class: 'rc-h', onclick: () => { goToAnn(a); } }, h('i', { style: { background: a.color } }), h('b', { text: label + (a.quote ? ': “' + clip(a.quote, 40) + '”' : '') }), h('span', { text: 'p.' + (a.page + 1) })),
        h('div', { class: 'row' }, h('span', { text: a.author + ' · ' + fmtShort(a.created) }), stSel, h('button', { class: 'btn', type: 'button', text: '✕', title: 'Delete', onclick: () => { select(a.id); delSel(); } })),
        ta);
      return item;
    }));
    if (!items.length) list.innerHTML = '<p style="color:#666;padding:10px;font-size:11px">' + (annots.length ? 'Nothing matches this filter.' : 'No mark-ups yet. Pick a tool on the second toolbar: highlight text, draw, add notes, or stamp the page.') + '</p>';
  }
  filterSel.addEventListener('change', renderComments);
  async function goToAnn(a) {
    await getPg(a.page);
    const Pg = P[a.page];
    const b = bboxPdf(a), bx = vbox(Pg, b.x1, b.y1, b.x2, b.y2);
    view$.scrollTop = Pg.div.offsetTop + bx.y - view$.clientHeight / 3;
    select(a.id);
  }
  /* ---------- output ---------- */
  function winAnsi(font, text) { let out = ''; for (const ch of String(text)) { try { font.encodeText(ch); out += ch; } catch (e) { out += ch === '\t' ? '  ' : '?'; } } return out; }
  async function buildMarkedPdf() {
    const PL = await Libs.pdflib();
    const out = await PL.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    let info = {};
    try { info = (await pdf.getMetadata()).info || {}; } catch (e) { /* none */ }
    out.setTitle((info.Title || d.meta.title || d.name.replace(/\.pdf$/i, '')) + ' (marked up)');
    out.setModificationDate(new Date());
    out.setProducer('LANscape Reader ' + VERSION + ' with pdf-lib');
    const font = await out.embedFont(PL.StandardFonts.Helvetica), bold = await out.embedFont(PL.StandardFonts.HelveticaBold);
    const pages = out.getPages();
    const rgb = hex => { const [r, g, b] = hexToRgb(hex || '#000000'); return PL.rgb(r / 255, g / 255, b / 255); };
    for (const a of sortedAnnots()) {
      const pg = pages[a.page];
      if (!pg) continue;
      const c = rgb(a.color), w = a.width || 2;
      const seg = (x1, y1, x2, y2, th) => pg.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: th, color: c, lineCap: PL.LineCapStyle.Round });
      if (a.type === 'highlight') for (const r of a.rects) pg.drawRectangle({ x: r[0], y: r[1], width: r[2] - r[0], height: r[3] - r[1], color: c, opacity: 0.38, blendMode: PL.BlendMode.Multiply });
      else if (a.type === 'underline') for (const r of a.rects) seg(r[0], r[1] + (r[3] - r[1]) * 0.06, r[2], r[1] + (r[3] - r[1]) * 0.06, 1.3);
      else if (a.type === 'strike') for (const r of a.rects) seg(r[0], (r[1] + r[3]) / 2, r[2], (r[1] + r[3]) / 2, 1.3);
      else if (a.type === 'pen') pg.drawSvgPath(a.points.map((p, k) => (k ? 'L' : 'M') + p[0] + ' ' + (-p[1])).join(' '), { x: 0, y: 0, borderColor: c, borderWidth: w, borderOpacity: a.opacity != null ? a.opacity : 1, borderLineCap: PL.LineCapStyle.Round });
      else if (a.type === 'line' || a.type === 'arrow') {
        seg(a.x1, a.y1, a.x2, a.y2, w);
        if (a.type === 'arrow') { const ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1), L = Math.max(8, w * 4.5); const p1 = [a.x2 - L * Math.cos(ang - 0.42), a.y2 - L * Math.sin(ang - 0.42)], p2 = [a.x2 - L * Math.cos(ang + 0.42), a.y2 - L * Math.sin(ang + 0.42)]; pg.drawSvgPath('M' + a.x2 + ' ' + (-a.y2) + ' L' + p1[0] + ' ' + (-p1[1]) + ' L' + p2[0] + ' ' + (-p2[1]) + ' Z', { x: 0, y: 0, color: c }); }
      }
      else if (a.type === 'rect') pg.drawRectangle({ x: a.x1, y: a.y1, width: a.x2 - a.x1, height: a.y2 - a.y1, borderColor: c, borderWidth: w });
      else if (a.type === 'ellipse') pg.drawEllipse({ x: (a.x1 + a.x2) / 2, y: (a.y1 + a.y2) / 2, xScale: (a.x2 - a.x1) / 2, yScale: (a.y2 - a.y1) / 2, borderColor: c, borderWidth: w });
      else if (a.type === 'text') { const fs = a.fontSize || 12; String(a.text || '').split('\n').forEach((l, k) => pg.drawText(winAnsi(font, l), { x: a.x1 + 3, y: a.y2 - fs * (1.02 + k * 1.2), size: fs, font, color: c })); }
      else if (a.type === 'note') { pg.drawRectangle({ x: a.x1, y: a.y1, width: NOTE, height: NOTE, color: PL.rgb(1, 0.9, 0.5), borderColor: PL.rgb(0.5, 0.38, 0), borderWidth: 0.8 }); for (let k = 0; k < 3; k++) pg.drawLine({ start: { x: a.x1 + 3, y: a.y2 - 5 - k * 4 }, end: { x: a.x1 + 16, y: a.y2 - 5 - k * 4 }, thickness: 0.8, color: PL.rgb(0.5, 0.38, 0) }); }
      else if (a.type === 'stamp') {
        const hh = a.y2 - a.y1, ww = a.x2 - a.x1;
        pg.drawRectangle({ x: a.x1, y: a.y1, width: ww, height: hh, borderColor: c, borderWidth: 2.5, color: PL.rgb(1, 1, 1), opacity: 0.55 });
        const label = winAnsi(bold, a.text || ''), size = Math.min(hh * 0.42, ww * 0.9 / Math.max(1, bold.widthOfTextAtSize(label, 1)));
        pg.drawText(label, { x: a.x1 + (ww - bold.widthOfTextAtSize(label, size)) / 2, y: a.y1 + hh * 0.38, size, font: bold, color: c });
        const sub = winAnsi(font, (a.author || '') + ' · ' + fmtShort(a.created || Date.now())), ss = hh * 0.17;
        pg.drawText(sub, { x: a.x1 + (ww - font.widthOfTextAtSize(sub, ss)) / 2, y: a.y1 + hh * 0.1, size: ss, font, color: c });
      }
    }
    // a summary of every comment, so nothing hides inside a mark-up
    const withText = sortedAnnots().filter(a => a.comment || a.type === 'note' || a.type === 'stamp' || a.status);
    if (withText.length) {
      const W = 612, H = 792;
      let pg = out.addPage([W, H]), y = H - 60;
      pg.drawText(winAnsi(bold, 'Comments: ' + d.name), { x: 50, y, size: 15, font: bold });
      y -= 18;
      pg.drawText(winAnsi(font, withText.length + ' comments · saved ' + fmtDate(Date.now(), true) + ' by LANscape Reader'), { x: 50, y, size: 9, font, color: PL.rgb(0.35, 0.35, 0.35) });
      y -= 22;
      const wrapLines = (t, size, max) => { const words = String(t).split(/\s+/), lines = []; let cur = ''; for (const w2 of words) { const next = cur ? cur + ' ' + w2 : w2; if (font.widthOfTextAtSize(winAnsi(font, next), size) > max && cur) { lines.push(cur); cur = w2; } else cur = next; } if (cur) lines.push(cur); return lines; };
      for (const a of withText) {
        const head = 'Page ' + (a.page + 1) + ' · ' + (a.type === 'stamp' ? 'Stamp "' + a.text + '"' : ANN_LABEL[a.type]) + ' · ' + a.author + ' · ' + fmtShort(a.created) + (a.status ? ' · ' + a.status.toUpperCase() : '');
        const body = wrapLines([a.quote ? '"' + a.quote + '"' : '', a.comment || (a.type === 'note' ? '(empty note)' : '')].filter(Boolean).join(' - '), 10, W - 120);
        const need = 16 + body.length * 13 + 8;
        if (y - need < 50) { pg = out.addPage([W, H]); y = H - 60; }
        pg.drawRectangle({ x: 50, y: y - 9, width: 8, height: 8, color: rgb(a.color) });
        pg.drawText(winAnsi(bold, head), { x: 64, y: y - 8, size: 9.5, font: bold });
        y -= 22;
        for (const l of body) { pg.drawText(winAnsi(font, l), { x: 64, y, size: 10, font }); y -= 13; }
        y -= 8;
      }
    }
    return new Blob([await out.save()], { type: 'application/pdf' });
  }
  async function saveCopy() {
    if (!annots.length) { const v = await ctx.msg('info', 'Save Marked-up Copy', '<p>This document has no mark-ups yet, so the copy would match the original.</p>', ['Save Anyway', 'Cancel']); if (v !== 'Save Anyway') return false; }
    ctx.status('Writing mark-ups into a PDF copy...');
    const nd = await ctx.saveAs({ title: 'Save Marked-up Copy', name: d.name.replace(/\.pdf$/i, '') + ' (marked up).pdf', dir: canWriteBack(d) ? d.dir : VROOT + '/', types: [{ ext: 'pdf', label: 'PDF Document (*.pdf)' }], data: buildMarkedPdf });
    if (nd && nd !== 'download') ctx.status('Saved ' + nd.name + '. Its address is ' + displayUrl(nd.url));
    return !!nd;
  }
  function exportComments(kind) {
    const rows = sortedAnnots();
    const base = d.name.replace(/\.pdf$/i, '');
    if (kind === 'csv') {
      const csv = toCSV([['Page', 'Type', 'Author', 'Date', 'Status', 'Text', 'Comment', 'Color']].concat(rows.map(a => [a.page + 1, a.type === 'stamp' ? 'Stamp: ' + a.text : ANN_LABEL[a.type], a.author, fmtDate(a.created, true), a.status || '', a.quote || (a.type === 'text' ? a.text : ''), a.comment || '', a.color])));
      ctx.download(base + ' comments.csv', new Blob([csv], { type: 'text/csv' }));
    } else {
      const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comments: ' + esc(d.name) + '</title><style>body{font:13px Arial,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:5px 8px;vertical-align:top;text-align:left}th{background:#eee}i{display:inline-block;width:10px;height:10px;border:1px solid #000;margin-right:5px}</style></head><body><h1>Comments: ' + esc(d.name) + '</h1><p>' + rows.length + ' mark-ups · exported ' + esc(fmtDate(Date.now(), true)) + '</p><table><tr><th>Page</th><th>Type</th><th>Text</th><th>Comment</th><th>Status</th><th>Author</th><th>Date</th></tr>' + rows.map(a => '<tr><td>' + (a.page + 1) + '</td><td><i style="background:' + esc(a.color) + '"></i>' + esc(a.type === 'stamp' ? a.text : ANN_LABEL[a.type]) + '</td><td>' + esc(a.quote || (a.type === 'text' ? a.text : '')) + '</td><td>' + esc(a.comment || '') + '</td><td>' + esc(a.status || '') + '</td><td>' + esc(a.author) + '</td><td>' + esc(fmtDate(a.created, true)) + '</td></tr>').join('') + '</table></body></html>';
      ctx.download(base + ' comments.html', new Blob([html], { type: 'text/html' }));
    }
  }
  async function pageImage(i, s) {
    const page = await getPg(i);
    const vp = baseVp(page, s);
    const cv = doc.createElement('canvas'); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
    const c2 = cv.getContext('2d');
    await page.render({ canvasContext: c2, viewport: vp }).promise;
    const mine = annots.filter(a => a.page === i);
    if (mine.length) {
      const fake = { vp };
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + vp.width + '" height="' + vp.height + '">' + mine.map(a => annSVG(a, fake)).join('').replace(/style="mix-blend-mode:multiply"/g, '') + '</svg>';
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      try { const img = await loadImg(url); c2.drawImage(img, 0, 0); } catch (e) { /* skip */ } finally { URL.revokeObjectURL(url); }
    }
    return cv.toDataURL('image/jpeg', 0.9);
  }
  async function printDoc() {
    ctx.status('Preparing ' + N + ' pages for printing...');
    const imgs = [];
    for (let i = 0; i < Math.min(N, 300); i++) imgs.push('<img src="' + await pageImage(i, 1.6) + '" alt="">');
    printBox.innerHTML = imgs.join('');
    setTimeout(() => win.print(), 50);
  }
  async function properties() {
    let info = {};
    try { info = (await pdf.getMetadata()).info || {}; } catch (e) { /* none */ }
    const v1 = baseVp(first, 1);
    const row = (a, b) => '<tr><td style="padding-right:14px;color:#555">' + a + '</td><td>' + esc(b || '—') + '</td></tr>';
    ctx.msg('info', 'Document Properties', '<table>' + row('File', d.name) + row('Title', info.Title) + row('Author', info.Author) + row('Subject', info.Subject) + row('Created with', info.Creator) + row('Produced by', info.Producer) + row('PDF version', info.PDFFormatVersion) + row('Pages', String(N)) + row('Page size', (v1.width / 72).toFixed(2) + ' × ' + (v1.height / 72).toFixed(2) + ' in') + row('File size', fmtBytes(d.size)) + row('Mark-ups', String(annots.length)) + '</table>');
  }
  async function openOther() { const nd = await ctx.open({ title: 'Open', kinds: ['pdf'], label: 'PDF documents' }); if (nd) ctx.go(nd.url); }
  /* ---------- events ---------- */
  pageInput.addEventListener('keydown', e => { if (e.key === 'Enter') { goPage((parseInt(pageInput.value, 10) || 1) - 1); view$.focus(); } });
  zoomSel.addEventListener('change', () => setZoom(zoomSel.value));
  findIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { findIn.value = ''; runFind(''); view$.focus(); } });
  const refitSoon = debounce(() => refit(), 60);
  ctx.on(win, 'resize', refitSoon);
  ctx.on(view$, 'scroll', debounce(() => { status(); }, 80), { passive: true });
  io = new win.IntersectionObserver(entries => {
    for (const e of entries) { const i = +e.target.dataset.p; if (e.isIntersecting) visible.add(i); else visible.delete(i); }
    visibleRender();
  }, { root: view$, rootMargin: '700px 0px' });
  for (const Pg of P) io.observe(Pg.div);
  ctx.cleanup(() => io.disconnect());
  ctx.on(doc, 'keydown', e => {
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'f') { e.preventDefault(); findIn.focus(); findIn.select(); return; }
    if (mod && k === 's') { e.preventDefault(); saveCopy(); return; }
    if (mod && k === 'p') { e.preventDefault(); printDoc(); return; }
    if (typing) return;
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoomBy(1.2); return; }
    if (mod && k === '-') { e.preventDefault(); zoomBy(1 / 1.2); return; }
    if (mod && k === '0') { e.preventDefault(); setZoom('width'); return; }
    if (mod || e.altKey) return;
    if (k === 'delete' || k === 'backspace') { if (sel) { e.preventDefault(); delSel(); } return; }
    if (k === 'escape') { if (sel) select(null); else setTool('select'); return; }
    if (k === '+' || k === '=') { zoomBy(1.2); return; }
    if (k === '-') { zoomBy(1 / 1.2); return; }
    const toolKey = RTOOLS.find(x => x[2] === k);
    if (toolKey) { e.preventDefault(); setTool(toolKey[0]); return; }
    if (k === 'arrowright' && view$.scrollWidth <= view$.clientWidth) { goPage(curPage() + 1); }
    else if (k === 'arrowleft' && view$.scrollWidth <= view$.clientWidth) { goPage(curPage() - 1); }
  });
  setTool('select');
  await new Promise(r => win.requestAnimationFrame(r));
  scale = fitScale();
  layoutAll();
  refit(true);
  renderComments();
  status();
  view$.focus({ preventScroll: true });
  // teach HyperHound the words in this PDF, and paint its preview
  if (!d.demo || !S.thumbs.has(d.path)) ctx.after(1200, async () => {
    try {
      if (d.meta.deepFor !== d.mtime) {
        const parts = [];
        for (let i = 0; i < Math.min(N, 400) && ctx.alive(); i++) { const tc = await getTextContent(i); parts.push(tc.items.map(x => x.str).join(' ')); }
        if (ctx.alive() && !d.demo) applyDeep(d, parts.join('\n'));
      }
      if (!S.thumbs.has(d.path) || S.thumbAt.get(d.path) !== d.mtime) {
        const page = await getPg(0), v1 = baseVp(page, 1), vp = baseVp(page, 240 / v1.width);
        const cv = doc.createElement('canvas'); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        applyThumb(d, cv.toDataURL('image/jpeg', 0.75));
      }
    } catch (e) { /* not important */ }
  });
  return { title: d.meta.title + ' - Reader', save: saveCopy, docName: () => d.name };
}
