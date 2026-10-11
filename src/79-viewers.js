/* ===================================================================
   Small viewers: Slide Show for PowerPoint files, a ZIP viewer that
   can extract into My Documents, and a Font Viewer. Plus the shared
   look for the Media Viewer and File Properties.
   =================================================================== */
const VIEWERS_CSS = `/* media viewer */
.mv-stage{flex:1;min-height:0;display:grid;place-items:center;overflow:auto;background:#808080 repeating-conic-gradient(#8c8c8c 0 25%,#7a7a7a 0 50%) 0 0/20px 20px}
.mv-stage img{display:block;image-rendering:auto;box-shadow:2px 2px 0 rgba(0,0,0,.4);cursor:zoom-out}
.mv-stage img.fit{max-width:100%;max-height:100%;cursor:zoom-in}
.mv-stage video{max-width:100%;max-height:100%;background:#000}
.media-video .mv-stage{background:#000}
.mv-audio{margin:auto;padding:28px 34px;text-align:center;background:var(--face);box-shadow:inset -1px -1px var(--dk),inset 1px 1px var(--hi),inset -2px -2px var(--sh),inset 2px 2px var(--lt);min-width:min(420px,90vw)}
.mv-title{font:bold 16px var(--ui);margin-bottom:4px}
.mv-sub{color:#333;margin-bottom:14px}
.mv-audio audio{width:100%}
body.media-audio{background:#008080}
/* file properties */
.props-wrap{flex:1;min-height:0;overflow:auto;padding:18px;background:#008080}
.props{max-width:640px;margin:0 auto;padding:14px 16px;background:var(--face)}
.props-head{display:flex;gap:12px;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--sh);box-shadow:0 1px 0 var(--hi)}
.props-head b{font-size:13px;word-break:break-all}
.props table{border-collapse:collapse;width:100%}
.props td{padding:4px 6px;vertical-align:top;word-break:break-all}
.props td:first-child{width:110px;color:#222;white-space:nowrap}
.props-btns{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}
.hexhead{margin:8px 0 4px;font-weight:bold}
.hex{margin:0;padding:8px;background:#fff;font:12px/1.35 var(--mono);overflow:auto;max-height:240px;white-space:pre}
/* slide show */
.sv-main{flex:1;min-height:0;display:flex;background:#808080}
.sv-out{width:220px;flex:none;overflow:auto;background:#fff;border-right:1px solid var(--dk);font:12px Arial,sans-serif}
.sv-out div{padding:6px 8px;cursor:pointer;border-bottom:1px solid #eee;display:flex;gap:8px}
.sv-out div b{color:#666;min-width:18px}
.sv-out div.on{background:var(--sel);color:#fff}
.sv-out div.on b{color:#ccd}
.sv-center{flex:1;min-width:0;display:flex;flex-direction:column}
.sv-stage{flex:1;min-height:0;display:grid;place-items:center;padding:18px;overflow:hidden}
.sv-notes{height:90px;flex:none;background:#fff;border-top:1px solid var(--dk);padding:6px 10px;overflow:auto;font:13px Arial,sans-serif;color:#222;white-space:pre-wrap}
.sv-notes:empty::before{content:"Click to add notes";color:#999}
.sv-sorter{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:22px;padding:22px;align-content:start;background:#c0c0c0}
.sv-sorter .th{cursor:pointer;text-align:center;font:12px Arial,sans-serif}
.sv-sorter .th.on .slide{outline:4px solid #000080}
.slide{position:relative;overflow:hidden;box-shadow:3px 3px 0 rgba(0,0,0,.45);font-family:Arial,Helvetica,sans-serif;container-type:size}
.slide .s-in{position:absolute;inset:0;padding:7% 7% 5%;display:flex;flex-direction:column}
.slide h1{margin:0 0 4%;font-size:7cqh;line-height:1.15;font-weight:bold}
.slide.title-only h1{margin:auto 0 2%;font-size:10cqh;text-align:center}
.slide.title-only .sub{text-align:center;font-size:5cqh;opacity:.85}
.slide ul{margin:0;padding-left:5%;font-size:4.6cqh;line-height:1.35}
.slide ul li{margin:0 0 1.4%}
.slide .s-row{flex:1;min-height:0;display:flex;gap:4%}
.slide .s-row ul{flex:1}
.slide .s-img{flex:0 0 42%;display:grid;place-items:center;min-height:0}
.slide .s-img img{max-width:100%;max-height:100%;box-shadow:0 2px 8px rgba(0,0,0,.35)}
.slide .s-num{position:absolute;right:3%;bottom:2.5%;font-size:2.6cqh;opacity:.7}
.tpl-plain{background:#fff;color:#000}
.tpl-plain h1{color:#000}
.tpl-navy{background:linear-gradient(135deg,#000060 0,#0000a0 55%,#000040 100%);color:#fff}
.tpl-navy::before{content:"";position:absolute;left:-10%;right:-10%;bottom:9%;height:2.4%;background:linear-gradient(90deg,#ffcc00,#ff6600);transform:rotate(-3deg)}
.tpl-navy h1{color:#ffcc00;text-shadow:2px 2px 0 #000}
.tpl-sand{background:radial-gradient(circle at 20% 20%,#f3e6c8,#d9c091 70%,#c4a46c);color:#3b2a10}
.tpl-sand h1{color:#7a3b00;font-family:Georgia,serif;font-style:italic}
.tpl-ribbon{background:linear-gradient(160deg,#1a0033,#3d0066 50%,#003c4d);color:#e6fffb}
.tpl-ribbon::before{content:"";position:absolute;left:0;right:0;bottom:0;height:22%;background:repeating-linear-gradient(170deg,rgba(0,229,255,.35) 0 6px,transparent 6px 16px,rgba(255,43,214,.35) 16px 22px,transparent 22px 32px)}
.tpl-ribbon h1{color:#00e5ff;text-shadow:0 0 12px rgba(0,229,255,.6)}
.tpl-tie{background:repeating-linear-gradient(45deg,#5a0f1a 0 26px,#6e1422 26px 52px);color:#fff4d6}
.tpl-tie::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent 0 22px,rgba(255,204,0,.25) 22px 26px,transparent 26px 52px)}
.tpl-tie h1{color:#ffd24d;font-family:Georgia,serif}
.slide ul li::marker{color:var(--bul,currentColor)}
.tpl-navy ul{--bul:#ffcc00}.tpl-ribbon ul{--bul:#ff2bd6}.tpl-tie ul{--bul:#ffd24d}.tpl-sand ul{--bul:#7a3b00}
.sv-show{position:fixed;inset:0;z-index:50;background:#000;display:grid;place-items:center;cursor:none}
.sv-show .slide{box-shadow:none}
.sv-show .end{color:#fff;font:16px Arial,sans-serif;position:absolute;top:30px;left:0;right:0;text-align:center}
.sv-fx{position:absolute;inset:0;background:#000;pointer-events:none}
/* zip viewer */
.zv-main{flex:1;min-height:0;display:flex;background:#fff}
.zv-list{flex:1;min-width:0;overflow:auto}
.zv-list table{border-collapse:collapse;width:100%;font-size:11px}
.zv-list th{position:sticky;top:0;background:var(--face);text-align:left;padding:3px 6px;font-weight:normal;box-shadow:inset -1px -1px var(--sh),inset 1px 1px var(--hi);white-space:nowrap;cursor:default}
.zv-list td{padding:2px 6px;white-space:nowrap;border-bottom:1px solid #f0f0f0;cursor:default}
.zv-list td.r,.zv-list th.r{text-align:right}
.zv-list tr.on td{background:var(--sel);color:#fff}
.zv-list td svg{vertical-align:-3px;margin-right:4px}
.zv-prev{width:42%;flex:none;border-left:1px solid var(--dk);overflow:auto;background:#fff;display:flex;flex-direction:column}
.zv-prev pre{margin:0;padding:8px;font:12px/1.4 var(--mono);white-space:pre-wrap;word-break:break-word}
.zv-prev img{max-width:100%;margin:10px auto;display:block}
.zv-prev .ph{padding:20px;color:#666;text-align:center}
/* font viewer */
.fv{flex:1;min-height:0;overflow:auto;background:#fff;padding:14px 20px;color:#000}
.fv-head{border-bottom:1px solid #000;padding-bottom:10px;margin-bottom:12px;font:12px var(--ui)}
.fv-head h1{margin:0 0 6px;font-size:28px;font-weight:normal}
.fv-head table td{padding:1px 10px 1px 0;vertical-align:top}
.fv-head table td:first-child{color:#555;white-space:nowrap}
.fv-chars{font-size:24px;line-height:1.3;word-break:break-all;margin:12px 0;padding-bottom:12px;border-bottom:1px solid #000}
.fv-size{display:flex;gap:14px;align-items:baseline;white-space:nowrap;overflow:hidden;margin:4px 0}
.fv-size small{font:11px var(--ui);color:#555;min-width:26px;text-align:right;flex:none}
.fv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(48px,1fr));gap:4px;margin-top:16px}
.fv-grid div{border:1px solid #ccc;aspect-ratio:1;display:grid;place-items:center;font-size:26px;position:relative}
.fv-grid div small{position:absolute;left:2px;top:1px;font:9px var(--mono);color:#888}
.fv-tb input[type=text]{width:min(420px,50vw)}`;
/* ---------------- Slide Show ---------------- */
const SV_TEMPLATES = [['plain', 'Plain'], ['navy', 'Navy Diagonal'], ['sand', 'Sandstone'], ['ribbon', 'Neon Ribbons'], ['tie', 'Necktie']];
async function mountSlides(ctx) {
  const { h, doc, win } = ctx;
  const d = ctx.file;
  if (!d) { ctx.root.append(h('div', { class: 'empty-note', text: 'Open a PowerPoint (.pptx) file to show it here.' })); return { title: 'Slide Show' }; }
  const blob = await ctx.blob(d);
  const zip = await zipOpen(blob);
  const slides = await pptxSlides(zip, true);
  let aspect = 16 / 9;
  try { const pres = await zip.xml('ppt/presentation.xml'); const sz = pres && pres.getElementsByTagName('p:sldSz')[0]; if (sz) aspect = (+sz.getAttribute('cx') || 16) / (+sz.getAttribute('cy') || 9); } catch (e) { /* default */ }
  const prefs = Object.assign({ tpl: 'navy' }, (await ctx.kv.get('slides:prefs')) || {});
  ctx.root.setAttribute('data-own-keys', 'F5');
  let cur = 0, mode = 'normal';
  const outline = h('div', { class: 'sv-out', role: 'listbox', 'aria-label': 'Slides' });
  const stage = h('div', { class: 'sv-stage', tabindex: '-1' });
  const notes = h('div', { class: 'sv-notes' });
  const center = h('div', { class: 'sv-center' }, stage, notes);
  const sorter = h('div', { class: 'sv-sorter', hidden: true });
  const main = h('div', { class: 'sv-main' }, outline, center, sorter);
  const tplSel = h('select', { class: 'fld', 'aria-label': 'Design' }, ...SV_TEMPLATES.map(([v, l]) => h('option', { value: v, text: l })));
  tplSel.value = prefs.tpl;
  const counter = h('span', { style: { minWidth: '80px', textAlign: 'center' } });
  const status = h('span', { class: 'grow' });
  const tb = h('div', { class: 'tb' },
    tbtn(ctx, I16.prev, 'Previous slide (Page Up)', () => go2(cur - 1)), counter, tbtn(ctx, I16.next, 'Next slide (Page Down)', () => go2(cur + 1)), tsep(ctx),
    h('button', { class: 'tbtn txt', type: 'button', text: 'Normal', onclick: () => setMode('normal') }), h('button', { class: 'tbtn txt', type: 'button', text: 'Slide Sorter', onclick: () => setMode('sorter') }),
    h('button', { class: 'tbtn txt', type: 'button', html: '&#9654; Slide Show (F5)', onclick: () => present(cur) }), tsep(ctx), h('span', { text: 'Design: ' }), tplSel, tsep(ctx),
    tbtn(ctx, I16.download, 'Download .pptx', () => ctx.download(d.name, blob)));
  const menus = appMenubar(ctx, [
    { label: 'File', items: () => [{ label: 'Download Original', act: () => ctx.download(d.name, blob) }, { label: 'Export Outline as Text...', act: exportOutline }, { sep: 1 }, { label: 'Close', act: () => back() }] },
    { label: 'View', items: () => [{ label: 'Normal', radio: () => mode === 'normal', act: () => setMode('normal') }, { label: 'Slide Sorter', radio: () => mode === 'sorter', act: () => setMode('sorter') }, { label: 'Slide Show', key: 'F5', act: () => present(0) }] },
    { label: 'Format', items: () => SV_TEMPLATES.map(([v, l]) => ({ label: l, radio: () => prefs.tpl === v, act: () => setTpl(v) })) },
    { label: 'Help', items: () => [{ label: 'About Slide Show', act: () => ctx.msg('info', 'Slide Show', '<p>Shows the words and pictures from PowerPoint files, dressed in a design of your choice. Press F5 to present; click or press Space to advance.</p>') }] }
  ]);
  ctx.root.append(menus.el, tb, main, h('div', { class: 'status' }, status, h('span', { text: slides.length + ' slides' })));
  function slideEl(i, w) {
    const s = slides[i] || { title: '', bullets: [] };
    const hgt = w / aspect;
    const only = !s.bullets.length && !s.image;
    const el2 = h('div', { class: 'slide tpl-' + prefs.tpl + (only ? ' title-only' : ''), style: { width: w + 'px', height: hgt + 'px' } });
    const inner = h('div', { class: 's-in' });
    inner.append(h('h1', { text: s.title || (i === 0 ? d.meta.title : '') }));
    if (only && i === 0) inner.append(h('div', { class: 'sub', text: (d.meta.author ? 'by ' + d.meta.author : '') }));
    const row = h('div', { class: 's-row' });
    if (s.bullets.length) row.append(h('ul', {}, ...s.bullets.slice(0, 12).map(b => h('li', { text: b }))));
    if (s.image) row.append(h('div', { class: 's-img' }, h('img', { src: s.image, alt: '' })));
    if (row.children.length) inner.append(row);
    el2.append(inner, h('span', { class: 's-num', text: String(i + 1) }));
    return el2;
  }
  function fit() { const r = stage.getBoundingClientRect(); return Math.max(160, Math.min(r.width - 36, (r.height - 36) * aspect)); }
  function renderNormal() {
    stage.replaceChildren(slideEl(cur, fit()));
    notes.textContent = (slides[cur] && slides[cur].notes) || '';
    for (const o of outline.children) o.classList.toggle('on', +o.dataset.i === cur);
    counter.textContent = 'Slide ' + (cur + 1) + ' of ' + slides.length;
    status.textContent = slides[cur] ? slides[cur].title : '';
  }
  function renderSorter() {
    sorter.replaceChildren(...slides.map((s, i) => { const t = h('div', { class: 'th' + (i === cur ? ' on' : '') }, slideEl(i, 210), h('div', { text: String(i + 1) })); t.addEventListener('click', () => { cur = i; renderSorter(); }); t.addEventListener('dblclick', () => { cur = i; setMode('normal'); }); return t; }));
  }
  outline.replaceChildren(...slides.map((s, i) => { const o = h('div', { 'data-i': String(i), role: 'option' }, h('b', { text: String(i + 1) }), h('span', { text: s.title || '(untitled)' })); o.addEventListener('click', () => go2(i)); return o; }));
  function go2(i) { cur = clamp(i, 0, slides.length - 1); if (mode === 'sorter') renderSorter(); else renderNormal(); }
  function setMode(m) { mode = m; outline.hidden = center.hidden = m === 'sorter'; sorter.hidden = m !== 'sorter'; if (m === 'sorter') renderSorter(); else renderNormal(); }
  function setTpl(v) { prefs.tpl = v; tplSel.value = v; ctx.kv.set('slides:prefs', prefs); go2(cur); }
  tplSel.addEventListener('change', () => setTpl(tplSel.value));
  function exportOutline() { ctx.download(d.name.replace(/\.[^.]+$/, '') + ' outline.txt', new Blob([slides.map((s, i) => (i + 1) + '. ' + s.title + '\n' + s.bullets.map(b => '   - ' + b).join('\n') + (s.notes ? '\n   Notes: ' + s.notes : '')).join('\n\n')], { type: 'text/plain' })); }
  /* presenting, with a few 90s transitions */
  let show = null;
  function present(start) {
    let i = start || 0;
    show = h('div', { class: 'sv-show', tabindex: '0', role: 'dialog', 'aria-label': 'Slide show' });
    ctx.root.append(show);
    try { show.requestFullscreen().catch(() => {}); } catch (e) { /* fine */ }
    const W = () => Math.min(win.innerWidth, win.innerHeight * aspect);
    const FX = ['wipe', 'dissolve', 'box', 'blinds'];
    const paint = (k, fx) => {
      show.replaceChildren();
      if (k >= slides.length) { show.append(h('div', { class: 'end', text: 'End of slide show, click to exit.' })); return; }
      show.append(slideEl(k, W()));
      if (fx) {
        const cover = h('div', { class: 'sv-fx' });
        show.append(cover);
        const t0 = performance.now(), dur = 520;
        const anim = now => {
          const p = Math.min(1, (now - t0) / dur);
          if (fx === 'wipe') cover.style.clipPath = 'inset(0 0 0 ' + p * 100 + '%)';
          else if (fx === 'dissolve') cover.style.opacity = String(1 - p);
          else if (fx === 'box') cover.style.clipPath = 'polygon(0 0,100% 0,100% 100%,0 100%,0 0,' + (50 - p * 50) + '% ' + (50 - p * 50) + '%,' + (50 - p * 50) + '% ' + (50 + p * 50) + '%,' + (50 + p * 50) + '% ' + (50 + p * 50) + '%,' + (50 + p * 50) + '% ' + (50 - p * 50) + '%,' + (50 - p * 50) + '% ' + (50 - p * 50) + '%)';
          else { cover.style.background = 'repeating-linear-gradient(0deg,#000 0 ' + ((1 - p) * 40) + 'px,transparent ' + ((1 - p) * 40) + 'px 40px)'; }
          if (p < 1) win.requestAnimationFrame(anim); else cover.remove();
        };
        win.requestAnimationFrame(anim);
      }
    };
    const step = dir => { i = clamp(i + dir, 0, slides.length); if (i >= slides.length && dir > 0 && show.querySelector('.end') && dir) { /* stay */ } paint(i, dir > 0 ? FX[i % FX.length] : null); };
    const end = () => { if (doc.fullscreenElement) doc.exitFullscreen().catch(() => {}); show.remove(); show = null; cur = Math.min(i, slides.length - 1); go2(cur); };
    show.addEventListener('click', () => { if (i >= slides.length) end(); else step(1); });
    show.addEventListener('contextmenu', e => { e.preventDefault(); step(-1); });
    show._key = e => {
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); end(); }
      else if (k === ' ' || k === 'ArrowRight' || k === 'PageDown' || k === 'Enter' || k === 'n') { e.preventDefault(); if (i >= slides.length) end(); else step(1); }
      else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace' || k === 'p') { e.preventDefault(); step(-1); }
      else if (k === 'Home') { i = 0; paint(0); } else if (k === 'End') { i = slides.length - 1; paint(i); }
    };
    paint(i);
    show.focus();
  }
  ctx.on(doc, 'keydown', e => {
    if (show) return show._key(e);
    if (e.key === 'F5') { e.preventDefault(); present(e.shiftKey ? cur : 0); }
    else if (e.key === 'PageDown' || e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); go2(cur + 1); }
    else if (e.key === 'PageUp' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); go2(cur - 1); }
    else if (e.key === 'Home') go2(0); else if (e.key === 'End') go2(slides.length - 1);
  });
  ctx.on(win, 'resize', debounce(() => { if (mode === 'normal') renderNormal(); }, 80));
  await new Promise(r => win.requestAnimationFrame(r));
  if (!slides.length) { stage.replaceChildren(h('div', { class: 'empty-note', text: 'This presentation has no slides LANscape can read.' })); return { title: d.meta.title + ' - Slide Show' }; }
  renderNormal();
  stage.focus({ preventScroll: true });
  return { title: d.meta.title + ' - Slide Show' };
}
/* ---------------- ZIP viewer ---------------- */
async function mountZip(ctx) {
  const { h, doc } = ctx;
  const d = ctx.file;
  if (!d) { ctx.root.append(h('div', { class: 'empty-note', text: 'Open a .zip file to look inside.' })); return { title: 'ZIP Viewer' }; }
  const blob = await ctx.blob(d);
  const zip = await zipOpen(blob);
  const files = Array.from(zip.entries.values()).filter(e => !e.dir);
  let sortK = 'name', sortD = 1, sel = new Set();
  const tbody = h('tbody');
  const prev = h('div', { class: 'zv-prev' }, h('div', { class: 'ph', text: 'Select a file to peek inside.' }));
  const table = h('table', {}, h('thead', {}, h('tr', {}, ...[['name', 'Name'], ['type', 'Type'], ['mtime', 'Modified'], ['usize', 'Size', 1], ['ratio', 'Ratio', 1], ['csize', 'Packed', 1], ['path', 'Path']].map(([k, l, r]) => h('th', { class: r ? 'r' : '', 'data-k': k, text: l })))), tbody);
  const status = h('span', { class: 'grow' });
  const total = files.reduce((a, e) => a + e.usize, 0), packed = files.reduce((a, e) => a + e.csize, 0);
  const tb = h('div', { class: 'tb' },
    h('button', { class: 'tbtn txt', type: 'button', html: '&#128194; Extract to My Documents', onclick: () => extract(sel.size ? files.filter(e => sel.has(e.name)) : files) }),
    h('button', { class: 'tbtn txt', type: 'button', html: '&#11015; Download Selected', onclick: () => downloadSel() }),
    h('button', { class: 'tbtn txt', type: 'button', html: '&#10003; Test', onclick: () => test() }), tsep(ctx),
    h('button', { class: 'tbtn txt', type: 'button', text: 'Download .zip', onclick: () => ctx.download(d.name, blob) }));
  const menus = appMenubar(ctx, [
    { label: 'File', items: () => [{ label: 'Extract to My Documents...', act: () => extract(files) }, { label: 'Download .zip', act: () => ctx.download(d.name, blob) }, { sep: 1 }, { label: 'Close', act: () => back() }] },
    { label: 'Actions', items: () => [{ label: 'Select All', key: 'Ctrl+A', act: () => { sel = new Set(files.map(e => e.name)); paint(); } }, { label: 'Test Archive', act: test }, { label: 'Download Selected', act: downloadSel }] }
  ]);
  ctx.root.append(menus.el, tb, h('div', { class: 'zv-main' }, h('div', { class: 'zv-list' }, table), prev), h('div', { class: 'status' }, status, h('span', { text: files.length + ' files, ' + fmtBytes(total) + ' (' + fmtBytes(packed) + ' packed)' })));
  const typeOf = n => { const k = kindOf(n); return (KINDS[k] || KINDS.other).label + (extOf(n) ? ' (.' + extOf(n) + ')' : ''); };
  const val = (e, k) => (k === 'name' ? e.name.split('/').pop().toLowerCase() : k === 'type' ? typeOf(e.name) : k === 'ratio' ? (e.usize ? 1 - e.csize / e.usize : 0) : k === 'path' ? e.name : e[k]);
  function paint() {
    const list = files.slice().sort((a, b) => cmpVal(val(a, sortK), val(b, sortK)) * sortD);
    tbody.replaceChildren(...list.map(e => {
      const nm = e.name.split('/').pop(), dir = e.name.slice(0, e.name.length - nm.length);
      const tr = h('tr', { class: sel.has(e.name) ? 'on' : '', 'data-n': e.name },
        h('td', { html: (FILE_ICON[kindOf(nm)] || FILE_ICON.other) + esc(nm) }), h('td', { text: typeOf(nm) }), h('td', { text: e.mtime ? fmtShort(e.mtime) : '' }), h('td', { class: 'r', text: fmtBytes(e.usize) }), h('td', { class: 'r', text: e.usize ? Math.round((1 - e.csize / e.usize) * 100) + '%' : '' }), h('td', { class: 'r', text: fmtBytes(e.csize) }), h('td', { text: dir }));
      return tr;
    }));
    status.textContent = sel.size ? sel.size + ' selected' : 'Ready';
  }
  table.querySelector('thead').addEventListener('click', e => { const th = e.target.closest('th'); if (!th) return; const k = th.dataset.k; sortD = sortK === k ? -sortD : 1; sortK = k; paint(); });
  tbody.addEventListener('click', e => { const tr = e.target.closest('tr'); if (!tr) return; const n = tr.dataset.n; if (e.ctrlKey || e.metaKey) { if (sel.has(n)) sel.delete(n); else sel.add(n); } else sel = new Set([n]); paint(); peek(n); });
  tbody.addEventListener('dblclick', e => { const tr = e.target.closest('tr'); if (tr) extract([files.find(x => x.name === tr.dataset.n)]); });
  async function peek(n) {
    const e = zip.entries.get(n);
    prev.replaceChildren(h('div', { class: 'ph', text: 'Reading ' + n + '...' }));
    try {
      const bytes = await zip.bytes(n);
      const k = kindOf(n);
      if (k === 'image') { const u = URL.createObjectURL(new Blob([bytes], { type: MIME[extOf(n)] || 'image/png' })); ctx.cleanup(() => URL.revokeObjectURL(u)); prev.replaceChildren(h('img', { src: u, alt: n })); }
      else if (TEXTUAL.has(k) || k === 'sheet' || /^(json|xml|csv|ini|cfg|log|md|txt)$/.test(extOf(n)) || bytes.length < 200000 && !bytes.slice(0, 1000).some(b => b === 0)) prev.replaceChildren(h('pre', { text: decodeText(bytes.slice(0, 200000)) + (bytes.length > 200000 ? '\n…' : '') }));
      else prev.replaceChildren(h('div', { class: 'ph', html: '<b>' + esc(n.split('/').pop()) + '</b><br>' + fmtBytes(e.usize) + ' · ' + esc(typeOf(n)) + '<br><br>Extract it to open it in LANscape.' }));
    } catch (er) { prev.replaceChildren(h('div', { class: 'ph', text: er.message })); }
  }
  async function extract(list) {
    if (!list.length) return;
    const base = VROOT + '/' + cleanName(d.name.replace(/\.zip$/i, '')) + '/';
    const ok = await ctx.msg('info', 'Extract to My Documents', '<p>Extract ' + list.length + ' file' + (list.length === 1 ? '' : 's') + ' (' + fmtBytes(list.reduce((a, e) => a + e.usize, 0)) + ') into <b>' + esc(base) + '</b>?</p><p>They will join your LANscape: web pages become sites, documents open in their programs.</p>', ['Extract', 'Cancel']);
    if (ok !== 'Extract') return;
    const items = [];
    for (const e of list.slice(0, 400)) {
      const parts = e.name.split('/').map(cleanName).filter(Boolean);
      const name = parts.pop();
      if (!name) continue;
      items.push({ dir: base + (parts.length ? parts.join('/') + '/' : ''), name, data: await zip.bytes(e.name) });
    }
    try {
      const docs = await createFilesInMyDocs(items, (k, n) => { status.textContent = 'Extracting ' + k + ' of ' + n + '...'; });
      status.textContent = 'Extracted ' + docs.length + ' files into ' + base;
      const v = await ctx.msg('info', 'Done', '<p>Extracted ' + docs.length + ' files into ' + esc(base) + '.</p>', ['Show Folder', 'OK']);
      if (v === 'Show Folder') ctx.go(docs[0].ftp.replace(/[^/]*$/, ''));
    } catch (er) { ctx.msg('error', 'Extract', '<p>' + esc(er.message) + '</p>'); }
  }
  async function downloadSel() {
    const list = files.filter(e => sel.has(e.name));
    if (!list.length) { status.textContent = 'Select a file first.'; return; }
    for (const e of list.slice(0, 20)) ctx.download(e.name.split('/').pop(), new Blob([await zip.bytes(e.name)], { type: MIME[extOf(e.name)] || 'application/octet-stream' }));
  }
  async function test() {
    let bad = 0;
    for (const e of files) { try { const b = await zip.bytes(e.name); if (crc32(b) !== (e.crc != null ? e.crc : crc32(b))) bad++; } catch (er) { bad++; } }
    ctx.msg(bad ? 'warn' : 'info', 'Test Archive', bad ? '<p>' + bad + ' file' + (bad === 1 ? '' : 's') + ' could not be read.</p>' : '<p>No errors detected in ' + files.length + ' files.</p>');
  }
  ctx.on(doc, 'keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); sel = new Set(files.map(x => x.name)); paint(); } });
  paint();
  return { title: d.name + ' - ZIP Viewer' };
}
/* ---------------- Font viewer ---------------- */
async function fontNames(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const tag = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  let tables = {}, kind = 'TrueType';
  if (tag === 'wOFF') {
    kind = 'WOFF';
    const n = dv.getUint16(12);
    for (let i = 0; i < n; i++) { const o = 44 + i * 20; tables[String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3])] = { off: dv.getUint32(o + 4), clen: dv.getUint32(o + 8), len: dv.getUint32(o + 12) }; }
  } else if (tag === 'wOF2') return { kind: 'WOFF2' };
  else {
    if (tag === 'OTTO') kind = 'OpenType (CFF)'; else if (tag === 'true' || dv.getUint32(0) === 0x10000) kind = 'TrueType'; else return { kind: 'Font' };
    const n = dv.getUint16(4);
    for (let i = 0; i < n; i++) { const o = 12 + i * 16; tables[String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3])] = { off: dv.getUint32(o + 8), len: dv.getUint32(o + 12), clen: dv.getUint32(o + 12) }; }
  }
  const out = { kind, glyphs: 0 };
  const tbl = async t => { const e = tables[t]; if (!e) return null; let b = u8.subarray(e.off, e.off + e.clen); if (e.clen < e.len) b = await streamBytes(b, new DecompressionStream('deflate')); return new DataView(b.buffer, b.byteOffset, b.byteLength); };
  try {
    const nm = await tbl('name');
    if (nm) {
      const count = nm.getUint16(2), strOff = nm.getUint16(4);
      const want = { 0: 'copyright', 1: 'family', 2: 'style', 4: 'full', 5: 'version', 8: 'maker', 9: 'designer', 11: 'url', 13: 'license' };
      for (let i = 0; i < count; i++) {
        const r = 6 + i * 12, pid = nm.getUint16(r), id = nm.getUint16(r + 6), len = nm.getUint16(r + 8), off = nm.getUint16(r + 10);
        const key = want[id];
        if (!key || (out[key] && pid !== 3)) continue;
        let s = '';
        if (pid === 3 || pid === 0) for (let k = 0; k < len; k += 2) s += String.fromCharCode(nm.getUint16(strOff + off + k));
        else for (let k = 0; k < len; k++) s += String.fromCharCode(nm.getUint8(strOff + off + k));
        if (s.trim()) out[key] = s.trim();
      }
    }
    const mp = await tbl('maxp');
    if (mp) out.glyphs = mp.getUint16(4);
  } catch (e) { /* names are a nicety */ }
  return out;
}
async function mountFont(ctx) {
  const { h, doc } = ctx;
  const d = ctx.file;
  if (!d) { ctx.root.append(h('div', { class: 'empty-note', text: 'Open a .ttf, .otf or .woff font to preview it.' })); return { title: 'Font Viewer' }; }
  const blob = await ctx.blob(d);
  const u8 = new Uint8Array(await blob.arrayBuffer());
  const info = await fontNames(u8).catch(() => ({}));
  const fam = 'LANscapePreview' + Math.random().toString(36).slice(2, 7);
  let ok = true;
  try { const ff = new FontFace(fam, u8.buffer.slice(0)); await ff.load(); doc.fonts.add(ff); } catch (e) { ok = false; }
  const name = info.full || info.family || prettyName(d.name);
  let sample = 'The quick brown fox jumps over the lazy dog. 1234567890';
  const view = h('div', { class: 'fv', style: { fontFamily: '"' + fam + '", serif' } });
  const sampleIn = h('input', { type: 'text', class: 'fld', value: sample, 'aria-label': 'Sample text' });
  const tb = h('div', { class: 'tb fv-tb' }, h('button', { class: 'tbtn txt', type: 'button', text: 'Done', onclick: () => back() }), h('button', { class: 'tbtn txt', type: 'button', text: 'Print', onclick: () => ctx.win.print() }), tsep(ctx), h('span', { text: 'Sample: ' }), sampleIn, tsep(ctx), h('button', { class: 'tbtn txt', type: 'button', text: 'Download', onclick: () => ctx.download(d.name, blob) }));
  ctx.root.append(tb, view);
  function paint() {
    const row = (a, b) => (b ? '<tr><td>' + a + '</td><td>' + esc(b) + '</td></tr>' : '');
    view.innerHTML = '<div class="fv-head" style="font-family:var(--ui)"><h1 style="font-family:\'' + fam + '\',serif">' + esc(name) + '</h1><table>' + row('Type', info.kind + ' font') + row('File', d.name + ' (' + fmtBytes(d.size || 0) + ')') + row('Family', info.family) + row('Style', info.style) + row('Version', info.version) + row('Made by', info.maker || info.designer) + row('Glyphs', info.glyphs ? String(info.glyphs) : '') + row('Copyright', info.copyright) + '</table>' + (ok ? '' : '<p style="color:#c00">This browser couldn\'t load the font, so the samples below use a stand-in.</p>') + '</div>' +
      '<div class="fv-chars">abcdefghijklmnopqrstuvwxyz<br>ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>1234567890.:,;\'"(!?)+-*/=</div>' +
      [12, 18, 24, 36, 48, 60, 72].map(s => '<div class="fv-size"><small>' + s + '</small><span style="font-size:' + s + 'px">' + esc(sample) + '</span></div>').join('') +
      '<div class="fv-grid">' + Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&@#$%?!ÀÉÎÕÜßçñæøåœ€£¥©®™«»¿¡').map(c => '<div><small>' + c.charCodeAt(0).toString(16).toUpperCase() + '</small>' + esc(c) + '</div>').join('') + '</div>';
  }
  sampleIn.addEventListener('input', debounce(() => { sample = sampleIn.value || ' '; paint(); }, 120));
  paint();
  return { title: name + ' - Font Viewer' };
}
