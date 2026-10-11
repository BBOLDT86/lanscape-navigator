/* ===================================================================
   Programs: every file opens in a LANscape program that runs inside
   the page frame. The program's code lives here in the shell and
   builds its window inside the frame's document.
   =================================================================== */
const APPS = {
  write:    { id: 'write', name: 'LANscape Write', short: 'Write', host: 'write.lanscape.net', blurb: 'Word processor for .docx, .rtf and .md', mount: c => mountWrite(c), css: () => WRITE_CSS, untitled: 'Untitled Document' },
  ledger:   { id: 'ledger', name: 'LANscape Ledger', short: 'Ledger', host: 'ledger.lanscape.net', blurb: 'Spreadsheet for .xlsx and .csv', mount: c => mountLedger(c), css: () => LEDGER_CSS, untitled: 'Untitled Sheet' },
  calc:     { id: 'calc', name: 'Calculator', short: 'Calculator', host: 'calc.lanscape.net', blurb: 'Standard, scientific, paper tape, units and power', mount: c => mountCalc(c), css: () => CALC_CSS },
  notepad:  { id: 'notepad', name: 'Notepad', short: 'Notepad', host: 'notepad.lanscape.net', blurb: 'Plain text and source code', mount: c => mountNotepad(c), css: () => NOTEPAD_CSS, untitled: 'Untitled', route: notepadRoute },
  reader:   { id: 'reader', name: 'LANscape Reader', short: 'Reader', host: 'reader.lanscape.net', blurb: 'PDF viewer with mark-ups and comments', mount: c => mountReader(c), css: () => READER_CSS },
  slides:   { id: 'slides', name: 'Slide Show', short: 'Slide Show', blurb: 'PowerPoint .pptx viewer', mount: c => mountSlides(c), css: () => VIEWERS_CSS },
  jukebox:  { id: 'jukebox', name: 'Jukebox', short: 'Jukebox', host: 'music.lanscape.net', blurb: 'Your music library', mount: c => mountJukebox(c), css: () => JUKEBOX_CSS, route: jukeboxRoute },
  rewind:   { id: 'rewind', name: 'Rewind Video', short: 'Rewind', host: 'www.rewindvideo.com', blurb: 'Your movies and home videos', mount: c => mountRewind(c), css: () => REWIND_CSS, route: rewindRoute },
  photos:   { id: 'photos', name: 'Photo Album', short: 'Photos', host: 'photos.lanscape.net', blurb: 'Your pictures, by folder', mount: c => mountPhotos(c), css: () => PHOTOS_CSS, route: photosRoute },
  pinball:  { id: 'pinball', name: 'RingHub Pinball', short: 'Pinball', host: 'pinball.lanscape.net', blurb: 'Space pinball, straight out of 1995', mount: c => mountPinball(c), css: () => PINBALL_CSS },
  zipview:  { id: 'zipview', name: 'ZIP Viewer', short: 'ZIP Viewer', blurb: 'Look inside .zip files', mount: c => mountZip(c), css: () => VIEWERS_CSS },
  fontview: { id: 'fontview', name: 'Font Viewer', short: 'Font Viewer', blurb: 'Preview .ttf, .otf and .woff fonts', mount: c => mountFont(c), css: () => VIEWERS_CSS },
  fileinfo: { id: 'fileinfo', name: 'File Properties', short: 'Properties', blurb: 'Details for any file', mount: c => mountFileInfo(c), css: () => VIEWERS_CSS },
  media:    { id: 'media', name: 'Media Viewer', short: 'Viewer', blurb: 'Shows a picture, song or video on its own', mount: c => mountMedia(c), css: () => VIEWERS_CSS },
  dupes:    { id: 'dupes', name: 'Duplicate Finder', short: 'Duplicates', host: 'dupes.lanscape.net', blurb: 'Copies and versions folded into one, and Compare', mount: c => mountDupes(c), css: () => DUPES_CSS, route: dupesRoute }
};
const APP_HOSTS = {};
for (const k in APPS) if (APPS[k].host) APP_HOSTS[APPS[k].host] = k;
APP_HOSTS['rewindvideo.com'] = 'rewind';
const appHome = id => APPS[id] && APPS[id].host ? 'http://' + APPS[id].host + '/' : null;

function resolveApp(app, path, q, hash, u) {
  const host = u.hostname.toLowerCase();
  if (host === 'rewindvideo.com') { u.hostname = 'www.rewindvideo.com'; return { type: 'redirect', to: u.href }; }
  const canon = 'http://' + host + u.pathname + u.search;
  const A = APPS[app];
  if (A.route) {
    const r = A.route(path, q, u);
    if (r && r.type) return Object.assign({ hash }, r, r.type === 'app' ? { app, url: r.url || canon + hash } : {});
  }
  if (path === '/' || path === '' || path === '/index.html') return { type: 'app', app, url: canon + hash, params: q, hash };
  return { type: 'gen', url: canon, title: '404 Not Found', html: notFoundPage(u.href, host), status: 404 };
}
function appTitle(id, doc, route) {
  const A = APPS[id] || APPS.fileinfo;
  if (doc) return (doc.meta.title || doc.name) + ' - ' + A.short;
  return route && route.title ? route.title : A.name;
}

/* ---------------- mounting ---------------- */
function makeH(doc) {
  return function h(tag, attrs, ...kids) {
    const e = doc.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) e.style.setProperty(sk, v[sk]); else e.style[sk] = v[sk]; } }
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : doc.createTextNode(String(k)));
    return e;
  };
}
function appSkeleton(A, title) {
  const css = typeof A.css === 'function' ? A.css() : (A.css || '');
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + APP_CSS + css + '</style></head><body class="lapp app-' + A.id + '"></body></html>';
}
async function mountApp(id, o, cfg, token) {
  const A = APPS[id] || APPS.fileinfo;
  const f = freshFrame(SANDBOX_TRUSTED, fr => { fr.setAttribute('allowfullscreen', ''); fr.srcdoc = injectHelper(appSkeleton(A, o.title || A.name), cfg, false); });
  await new Promise(res => { let t = null; const done = () => { clearTimeout(t); res(); }; f.addEventListener('load', done, { once: true }); t = setTimeout(done, 4000); });
  if (token !== S.navToken || frame !== f || !f.contentDocument || !f.contentDocument.body) return null;
  const ctx = makeAppCtx(f, A, o);
  let api = null;
  try { api = (await A.mount(ctx)) || {}; }
  catch (err) {
    console.error(err);
    ctx.root.innerHTML = '';
    ctx.root.append(ctx.h('div', { class: 'app-error', html: '<h2>' + esc(A.name) + ' couldn\'t open this file</h2><p>' + esc(err && err.message || err) + '</p>' + (o.doc ? '<p><a href="' + esc(o.doc.ftp || o.doc.url) + '">See the file on its FTP server</a></p>' : '') }));
    api = {};
  }
  if (frame !== f) { ctx.dispose(); return null; }
  api.appName = A.name;
  const own = api.unmount;
  api.unmount = () => { try { if (own) own(); } finally { ctx.dispose(); } };
  return api;
}
function makeAppCtx(f, A, o) {
  const doc = f.contentDocument, win = f.contentWindow;
  const cleanups = [];
  const ctx = {
    app: A, doc, win, root: doc.body, h: makeH(doc), file: o.doc || null, route: o.route || {}, url: o.url,
    params: o.params instanceof URLSearchParams ? o.params : new URLSearchParams(o.params && o.params.toString ? o.params.toString() : ''),
    alive: () => frame === f,
    on(target, ev, fn, opt) { target.addEventListener(ev, fn, opt); cleanups.push(() => target.removeEventListener(ev, fn, opt)); },
    every(ms, fn) { const t = setInterval(fn, ms); cleanups.push(() => clearInterval(t)); return t; },
    after(ms, fn) { const t = setTimeout(fn, ms); cleanups.push(() => clearTimeout(t)); return t; },
    cleanup(fn) { cleanups.push(fn); },
    dispose() { for (const c of cleanups.splice(0).reverse()) { try { c(); } catch (e) { /* ignore */ } } },
    setTitle(t) { if (ctx.alive() && S.cur) { S.cur.title = t; if (S.cur.entry) S.cur.entry.title = t; setTitle(t); doc.title = t; } },
    status: m => setStatus(m),
    go: (u, opt) => go(u, opt),
    /** point the Location bar (and history) at a new address without reloading the program */
    replaceUrl(u, title) {
      if (!ctx.alive() || !S.cur) return;
      S.cur.url = u;
      if (S.cur.entry) { S.cur.entry.url = u; if (title) S.cur.entry.title = title; }
      setLocation(u);
      pushReal(u, true);
      if (title) ctx.setTitle(title);
      recordHistory(u, title || S.cur.title, null);
    },
    blob: d => getBlob(d), text: d => getText(d), objectURL: d => assetURL(d.path),
    save: (d, data) => writeDoc(d, data),
    saveAs: opts => saveAsDialog(opts),
    open: opts => openFileDialog(opts),
    kv: { get: async k => { const r = await DB.get('kv', k); return r ? r.v : undefined; }, set: (k, v) => DB.put('kv', { k, v }) },
    dialog: (title, body, buttons, width) => openWin({ title, body, buttons, width: width || 'min(460px, 94vw)' }),
    msg: (icon, title, html, buttons) => msgBox(icon, title, html, buttons),
    ask: (title, label, value) => promptBox(title, label, value),
    download: (name, blob) => download(name, blob)
  };
  return ctx;
}
/** a one-line input dialog (the shell's own, so it floats above the page like a real dialog) */
function promptBox(title, label, value) {
  const body = el('div', {}, el('div', { class: 'frow' }, el('label', { for: 'pbIn', text: label }), el('input', { class: 'field', id: 'pbIn', style: { flex: '1', minWidth: '220px' } })));
  const inp = $('#pbIn', body);
  inp.value = value == null ? '' : value;
  const w = openWin({ title, body, width: 'min(460px, 94vw)', buttons: [{ label: 'OK', primary: true, value: 'ok' }, { label: 'Cancel', value: null }] });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); w.close('ok'); } });
  setTimeout(() => { inp.focus(); inp.select(); }, 40);
  return w.result.then(v => (v === 'ok' ? inp.value : null));
}

/* ---------------- shared look: a Win95 window inside the page ---------------- */
const APP_CSS = `:root{--face:#c0c0c0;--hi:#fff;--lt:#dfdfdf;--sh:#808080;--dk:#0a0a0a;--sel:#000080;--selt:#fff;--field:#fff;--tip:#ffffe1;
--ui:Tahoma,"MS Sans Serif",Geneva,Verdana,"DejaVu Sans",sans-serif;--mono:"Courier New",Courier,"Liberation Mono",ui-monospace,monospace;--serif:"Times New Roman",Times,"Liberation Serif",serif}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body.lapp{font:11px/1.35 var(--ui);color:#000;background:var(--face);overflow:hidden;display:flex;flex-direction:column;-webkit-font-smoothing:antialiased}
button,input,select,textarea{font:inherit;color:inherit}
[hidden]{display:none!important}
.rais{background:var(--face);box-shadow:inset -1px -1px var(--dk),inset 1px 1px var(--hi),inset -2px -2px var(--sh),inset 2px 2px var(--lt)}
.sunk{box-shadow:inset -1px -1px var(--hi),inset 1px 1px var(--sh),inset -2px -2px var(--lt),inset 2px 2px var(--dk)}
.thin{box-shadow:inset -1px -1px var(--hi),inset 1px 1px var(--sh)}
.mb{display:flex;padding:1px 2px;flex:none;position:relative;z-index:30;background:var(--face);overflow-x:auto;scrollbar-width:none}
.mb::-webkit-scrollbar{display:none}
.mb>button{background:none;border:0;padding:3px 8px;cursor:default;white-space:nowrap}
.mb>button.open{background:var(--sel);color:var(--selt)}
.dd{position:fixed;z-index:60;min-width:190px;padding:2px;background:var(--face);box-shadow:inset -1px -1px var(--dk),inset 1px 1px var(--lt),inset -2px -2px var(--sh),inset 2px 2px var(--hi),3px 3px 0 rgba(0,0,0,.25);max-height:calc(100vh - 30px);overflow:auto}
.dd button{display:flex;width:100%;gap:12px;align-items:center;border:0;background:none;padding:4px 18px 4px 24px;text-align:left;cursor:default;position:relative;white-space:nowrap}
.dd button:hover:not(:disabled),.dd button:focus-visible{background:var(--sel);color:var(--selt);outline:none}
.dd button:disabled{color:var(--sh);text-shadow:1px 1px var(--hi)}
.dd button .k{margin-left:auto;padding-left:22px;opacity:.85}
.dd button.chk::before{content:"✓";position:absolute;left:8px;font-weight:bold}
.dd button.rad::before{content:"●";position:absolute;left:9px;font-size:8px}
.dd hr{border:0;border-top:1px solid var(--sh);border-bottom:1px solid var(--hi);margin:3px 2px}
.tb{display:flex;align-items:center;gap:1px;padding:2px 4px;flex:none;flex-wrap:wrap;border-top:1px solid var(--hi);border-bottom:1px solid var(--sh);background:var(--face)}
.tbtn{min-width:24px;height:23px;border:1px solid transparent;background:none;display:inline-grid;place-items:center;padding:0 3px;cursor:default;font-size:12px;line-height:1}
.tbtn svg{width:16px;height:16px;display:block}
.tbtn:hover:not(:disabled){border-color:var(--hi) var(--sh) var(--sh) var(--hi)}
.tbtn:active:not(:disabled),.tbtn.on{border-color:var(--sh) var(--hi) var(--hi) var(--sh);background:repeating-conic-gradient(var(--face) 0 25%,var(--hi) 0 50%) 0 0/2px 2px}
.tbtn:disabled{opacity:.4}
.tbtn.txt{padding:0 6px;font-size:11px}
.tsep{width:2px;align-self:stretch;margin:2px 4px;box-shadow:inset 1px 0 var(--sh),inset -1px 0 var(--hi)}
.fld{background:var(--field);border:0;padding:2px 4px;min-height:21px;box-shadow:inset -1px -1px var(--hi),inset 1px 1px var(--sh),inset -2px -2px var(--lt),inset 2px 2px var(--dk)}
.fld:focus{outline:none}
select.fld{padding:1px 2px}
.btn{border:0;padding:4px 12px;min-width:72px;min-height:23px;cursor:default;background:var(--face);box-shadow:inset -1px -1px var(--dk),inset 1px 1px var(--hi),inset -2px -2px var(--sh),inset 2px 2px var(--lt)}
.btn:active{box-shadow:inset -1px -1px var(--hi),inset 1px 1px var(--dk),inset -2px -2px var(--lt),inset 2px 2px var(--sh)}
.status{display:flex;gap:3px;padding:2px 2px 1px;flex:none;background:var(--face);min-height:22px}
.status>span{box-shadow:inset -1px -1px var(--hi),inset 1px 1px var(--sh);padding:2px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.status>span.grow{flex:1}
.swatch{display:inline-block;width:14px;height:4px;margin-top:1px}
.colors{display:grid;grid-template-columns:repeat(8,16px);gap:2px;padding:4px}
.colors button{width:16px;height:16px;border:1px solid var(--sh);padding:0;cursor:default}
.app-error{margin:40px auto;max-width:560px;background:#fff;padding:16px 20px;border:2px solid var(--sh);font:13px/1.5 var(--ui)}
.app-error h2{margin:0 0 8px;font-size:16px;color:#a00000}
.spin{width:16px;height:16px;border:2px solid var(--sh);border-top-color:var(--sel);border-radius:50%;display:inline-block;animation:sp .8s linear infinite;vertical-align:middle}
@keyframes sp{to{transform:rotate(360deg)}}
.empty-note{margin:auto;text-align:center;color:#333;padding:30px;font:13px/1.5 var(--ui);max-width:520px}
@media print{.noprint,.mb,.tb,.status{display:none!important}body.lapp{overflow:visible;height:auto;display:block;background:#fff}}
@media (prefers-reduced-motion:reduce){*{animation-duration:.001s!important;transition:none!important}}
`;
/** a menubar with drop-down menus, inside the program window */
function appMenubar(ctx, menus) {
  const { h, doc } = ctx;
  const bar = h('div', { class: 'mb noprint', role: 'menubar' });
  let open = -1, dd = null;
  const close = () => { if (dd) dd.remove(); dd = null; open = -1; for (const b of bar.children) b.classList.remove('open'); };
  const show = (i, focus) => {
    close();
    open = i;
    const b = bar.children[i];
    b.classList.add('open');
    dd = h('div', { class: 'dd', role: 'menu' });
    for (const it of menus[i].items()) {
      if (!it) continue;
      if (it.sep) { dd.append(h('hr')); continue; }
      const btn = h('button', { type: 'button', role: 'menuitem' }, h('span', { text: it.label }), it.key ? h('span', { class: 'k', text: it.key }) : null);
      if (it.check && it.check()) btn.classList.add('chk');
      if (it.radio && it.radio()) btn.classList.add('rad');
      if (it.disabled && it.disabled()) btn.disabled = true;
      btn.addEventListener('click', () => { close(); if (it.act) it.act(); });
      dd.append(btn);
    }
    dd.addEventListener('keydown', e => {
      const list = Array.from(dd.querySelectorAll('button:not(:disabled)')), k = list.indexOf(doc.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (list[k + 1] || list[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (list[k - 1] || list[list.length - 1]).focus(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show((i + 1) % menus.length, true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show((i - 1 + menus.length) % menus.length, true); }
    });
    doc.body.append(dd);
    const r = b.getBoundingClientRect();
    dd.style.left = Math.max(0, Math.min(r.left, ctx.win.innerWidth - dd.offsetWidth - 4)) + 'px';
    dd.style.top = r.bottom + 'px';
    if (focus) { const f = dd.querySelector('button:not(:disabled)'); if (f) f.focus(); }
  };
  menus.forEach((m, i) => {
    const b = h('button', { type: 'button', text: m.label });
    b.addEventListener('mousedown', e => { e.preventDefault(); open === i ? close() : show(i); });
    b.addEventListener('mouseenter', () => { if (open >= 0 && open !== i) show(i); });
    b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); show(i, true); } });
    bar.append(b);
  });
  ctx.on(doc, 'mousedown', e => { if (dd && !e.target.closest('.dd') && !e.target.closest('.mb')) close(); });
  ctx.on(doc, 'keydown', e => { if (e.key === 'Escape' && dd) { e.stopPropagation(); close(); } }, true);
  ctx.on(ctx.win, 'blur', close);
  return { el: bar, close, show };
}
/** a pop-up menu at a point (right-click menus, toolbar drop-downs) */
function appPopup(ctx, x, y, items) {
  const { h, doc } = ctx;
  const old = doc.querySelector('.dd.pop');
  if (old) old.remove();
  const dd = h('div', { class: 'dd pop', role: 'menu' });
  const close = () => { dd.remove(); doc.removeEventListener('mousedown', outside, true); };
  const outside = e => { if (!dd.contains(e.target)) close(); };
  for (const it of items) {
    if (!it) continue;
    if (it.sep) { dd.append(h('hr')); continue; }
    if (it.node) { dd.append(it.node); continue; }
    const b = h('button', { type: 'button' }, h('span', { text: it.label }), it.key ? h('span', { class: 'k', text: it.key }) : null);
    if (it.check && it.check()) b.classList.add('chk');
    if (it.disabled && it.disabled()) b.disabled = true;
    b.addEventListener('click', () => { close(); if (it.act) it.act(); });
    dd.append(b);
  }
  doc.body.append(dd);
  dd.style.left = Math.max(0, Math.min(x, ctx.win.innerWidth - dd.offsetWidth - 4)) + 'px';
  dd.style.top = Math.max(0, Math.min(y, ctx.win.innerHeight - dd.offsetHeight - 4)) + 'px';
  setTimeout(() => doc.addEventListener('mousedown', outside, true), 0);
  return { el: dd, close };
}
function tbtn(ctx, icon, title, act, extra) {
  const b = ctx.h('button', Object.assign({ type: 'button', class: 'tbtn', title, 'aria-label': title, html: icon }, extra || {}));
  b.addEventListener('mousedown', e => e.preventDefault()); // keep the caret in the document
  b.addEventListener('click', e => act(e, b));
  return b;
}
const tsep = ctx => ctx.h('span', { class: 'tsep' });
const COLOR_PALETTE = ['#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#7f3f00', '#ff8000', '#004040', '#0080ff', '#004080', '#8000ff', '#ff0080', '#ffcc99'];
function colorPopup(ctx, anchor, pick, extra) {
  const grid = ctx.h('div', { class: 'colors' });
  for (const c of COLOR_PALETTE) { const b = ctx.h('button', { type: 'button', title: c, style: { background: c } }); b.addEventListener('mousedown', e => e.preventDefault()); b.addEventListener('click', () => { p.close(); pick(c); }); grid.append(b); }
  const r = anchor.getBoundingClientRect();
  const p = appPopup(ctx, r.left, r.bottom, [{ node: grid }].concat(extra || []));
  return p;
}

/* 16px toolbar pictures shared by the programs */
const I16 = (() => {
  const s = (inner) => '<svg viewBox="0 0 16 16" aria-hidden="true">' + inner + '</svg>';
  return {
    new: s('<path d="M3 1h7l3 3v11H3z" fill="#fff" stroke="#000"/><path d="M10 1v3h3" fill="none" stroke="#000"/>'),
    open: s('<path d="M1 3h5l1 2h7v9H1z" fill="#e0b000" stroke="#000"/><path d="M1 14 3 7h12l-2 7z" fill="#ffe680" stroke="#000"/>'),
    save: s('<path d="M1.5 1.5h11l2 2v11h-13z" fill="#1f4f9f" stroke="#000"/><rect x="4" y="2" width="7" height="4" fill="#fff"/><rect x="8.5" y="2.6" width="1.6" height="2.8" fill="#1f4f9f"/><rect x="3.5" y="9" width="9" height="5.5" fill="#d0d0d0" stroke="#000" stroke-width=".6"/>'),
    print: s('<rect x="4" y="1" width="8" height="5" fill="#fff" stroke="#000"/><rect x="1.5" y="6" width="13" height="6" fill="#c8c8c8" stroke="#000"/><rect x="4" y="10" width="8" height="5" fill="#fff" stroke="#000"/><circle cx="12.5" cy="8" r=".8" fill="#0a0"/>'),
    cut: s('<circle cx="4.5" cy="12" r="2.4" fill="none" stroke="#000" stroke-width="1.3"/><circle cx="11.5" cy="12" r="2.4" fill="none" stroke="#000" stroke-width="1.3"/><path d="M6 10.3 11 1.5M10 10.3 5 1.5" stroke="#555" stroke-width="1.3"/>'),
    copy: s('<path d="M2 1h6l2 2v8H2z" fill="#fff" stroke="#000"/><path d="M6 5h6l2 2v8H6z" fill="#fff" stroke="#000"/><path d="M8 9h4M8 11h4M8 13h3" stroke="#00f" stroke-width=".8"/>'),
    paste: s('<rect x="1.5" y="2.5" width="9" height="12" fill="#b08040" stroke="#000"/><rect x="4" y="1" width="4" height="3" fill="#ccc" stroke="#000"/><path d="M7 6h6l1.5 1.5V15H7z" fill="#fff" stroke="#000"/>'),
    undo: s('<path d="M5 4 1.5 7.5 5 11" fill="none" stroke="#0040c0" stroke-width="1.8"/><path d="M2 7.5h7.5a4 4 0 0 1 0 8H7" fill="none" stroke="#0040c0" stroke-width="1.8"/>'),
    redo: s('<path d="M11 4l3.5 3.5L11 11" fill="none" stroke="#0040c0" stroke-width="1.8"/><path d="M14 7.5H6.5a4 4 0 0 0 0 8H9" fill="none" stroke="#0040c0" stroke-width="1.8"/>'),
    find: s('<circle cx="6.5" cy="6.5" r="4.5" fill="#cfe8ff" stroke="#000" stroke-width="1.4"/><path d="M10 10l4.5 4.5" stroke="#000" stroke-width="2.2"/>'),
    left: s('<path d="M2 3h12M2 6h8M2 9h12M2 12h8" stroke="#000" stroke-width="1.4"/>'),
    center: s('<path d="M2 3h12M4 6h8M2 9h12M4 12h8" stroke="#000" stroke-width="1.4"/>'),
    right: s('<path d="M2 3h12M6 6h8M2 9h12M6 12h8" stroke="#000" stroke-width="1.4"/>'),
    justify: s('<path d="M2 3h12M2 6h12M2 9h12M2 12h12" stroke="#000" stroke-width="1.4"/>'),
    bullets: s('<circle cx="3" cy="4" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="3" cy="12" r="1.3"/><path d="M6 4h8M6 8h8M6 12h8" stroke="#000" stroke-width="1.3"/>'),
    numbers: s('<text x="0.5" y="6" font-size="5.5" font-family="Arial" font-weight="bold">1</text><text x="0.5" y="13" font-size="5.5" font-family="Arial" font-weight="bold">2</text><path d="M6 4h8M6 11h8" stroke="#000" stroke-width="1.3"/>'),
    indent: s('<path d="M7 3h7M7 6h7M7 9h7M7 12h7" stroke="#000" stroke-width="1.2"/><path d="M1.5 5.5 4.5 7.5 1.5 9.5z" fill="#0040c0"/>'),
    outdent: s('<path d="M7 3h7M7 6h7M7 9h7M7 12h7" stroke="#000" stroke-width="1.2"/><path d="M4.5 5.5 1.5 7.5 4.5 9.5z" fill="#0040c0"/>'),
    image: s('<rect x="1" y="2" width="14" height="12" fill="#bfe3ff" stroke="#000"/><circle cx="11" cy="6" r="1.6" fill="#ffd34d"/><path d="M1 13 6 7l4 4 2-2 3 4" fill="#3c9a50"/>'),
    table: s('<rect x="1" y="2" width="14" height="12" fill="#fff" stroke="#000"/><path d="M1 6h14M1 10h14M6 2v12M11 2v12" stroke="#000" stroke-width=".8"/><rect x="1" y="2" width="14" height="4" fill="#000080" opacity=".35"/>'),
    link: s('<path d="M6.5 9.5 9.5 6.5" stroke="#000" stroke-width="1.4"/><path d="M7 4.5 9 2.5a2.5 2.5 0 0 1 3.5 3.5l-2 2M9 11.5 7 13.5A2.5 2.5 0 0 1 3.5 10l2-2" fill="none" stroke="#0040c0" stroke-width="1.6"/>'),
    hr: s('<path d="M1 8h14" stroke="#000" stroke-width="2"/><path d="M3 4h10M3 12h10" stroke="#888" stroke-width="1"/>'),
    erase: s('<path d="M2 11 8 3l6 5-5 6H5z" fill="#f4a0b0" stroke="#000"/><path d="M5 14h10" stroke="#000"/>'),
    sum: s('<path d="M12 2.5H3.5l5 5.5-5 5.5H12" fill="none" stroke="#000" stroke-width="1.6"/>'),
    sortAZ: s('<text x="0" y="7" font-size="7" font-family="Arial" font-weight="bold">A</text><text x="0" y="15" font-size="7" font-family="Arial" font-weight="bold">Z</text><path d="M12 2v11M9.5 10.5 12 13.5l2.5-3" fill="none" stroke="#0040c0" stroke-width="1.5"/>'),
    sortZA: s('<text x="0" y="7" font-size="7" font-family="Arial" font-weight="bold">Z</text><text x="0" y="15" font-size="7" font-family="Arial" font-weight="bold">A</text><path d="M12 2v11M9.5 10.5 12 13.5l2.5-3" fill="none" stroke="#0040c0" stroke-width="1.5"/>'),
    fill: s('<path d="M3 8 8 3l5 5-5 5z" fill="#fff" stroke="#000"/><path d="M13 9.5c1 1.5 1.5 2.4 1.5 3a1.5 1.5 0 0 1-3 0c0-.6.5-1.5 1.5-3z" fill="#000"/>'),
    font: s('<text x="2" y="12" font-size="12" font-family="Times New Roman,serif" font-weight="bold">A</text>'),
    mark: s('<path d="M4 11 10 3l3 2-5 8z" fill="#ffd400" stroke="#000"/><path d="M4 11l-1 3 3-1z" fill="#000"/>'),
    zoomIn: s('<circle cx="6.5" cy="6.5" r="4.5" fill="#fff" stroke="#000" stroke-width="1.4"/><path d="M10 10l4.5 4.5" stroke="#000" stroke-width="2.2"/><path d="M4.5 6.5h4M6.5 4.5v4" stroke="#000" stroke-width="1.3"/>'),
    zoomOut: s('<circle cx="6.5" cy="6.5" r="4.5" fill="#fff" stroke="#000" stroke-width="1.4"/><path d="M10 10l4.5 4.5" stroke="#000" stroke-width="2.2"/><path d="M4.5 6.5h4" stroke="#000" stroke-width="1.3"/>'),
    download: s('<path d="M8 1v9M4.5 6.5 8 10l3.5-3.5" fill="none" stroke="#0040c0" stroke-width="1.8"/><path d="M2 11v3h12v-3" fill="none" stroke="#000" stroke-width="1.4"/>'),
    info: s('<circle cx="8" cy="8" r="6.5" fill="#fff" stroke="#1f4ea8" stroke-width="1.4"/><circle cx="8" cy="4.8" r="1.1" fill="#1f4ea8"/><rect x="7" y="6.8" width="2" height="5.5" fill="#1f4ea8"/>'),
    play: s('<path d="M4 2.5v11l9-5.5z" fill="#000"/>'),
    pause: s('<path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="#000"/>'),
    prev: s('<path d="M3 3h2v10H3zM13 3v10L6 8z" fill="#000"/>'),
    next: s('<path d="M11 3h2v10h-2zM3 3v10l7-5z" fill="#000"/>'),
    rotate: s('<path d="M12.5 6A5 5 0 1 0 13 10" fill="none" stroke="#0040c0" stroke-width="1.7"/><path d="M14.5 2 14 7l-4.8-1.2z" fill="#0040c0"/>'),
    fullscreen: s('<path d="M1.5 5.5v-4h4M10.5 1.5h4v4M14.5 10.5v4h-4M5.5 14.5h-4v-4" fill="none" stroke="#000" stroke-width="1.6"/>'),
    calc: s('<rect x="2.5" y="1" width="11" height="14" fill="#d8d8d8" stroke="#000"/><rect x="4" y="2.5" width="8" height="3" fill="#9ec09e" stroke="#000" stroke-width=".6"/><path d="M4.5 8h1.5M7.3 8h1.5M10 8h1.5M4.5 10.5h1.5M7.3 10.5h1.5M10 10.5h1.5M4.5 13h1.5M7.3 13h1.5M10 13h1.5" stroke="#000" stroke-width="1.4"/>')
  };
})();

/* 32px program pictures (Program Manager, menus, home page) */
const PROG_ICON = {
  pinball: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 30V9A11 11 0 0 1 27 9v21z" fill="#120a3a" stroke="#000" stroke-width="1.2"/><circle cx="16" cy="13" r="4.2" fill="#e8862a"/><ellipse cx="16" cy="13" rx="8" ry="2.2" fill="none" stroke="#3cff7a" stroke-width="1.3" transform="rotate(-18 16 13)"/><circle cx="9" cy="8" r="2" fill="#ff2bd6"/><circle cx="23" cy="8" r="2" fill="#00e5ff"/><path d="M8 25l5 2.4M24 25l-5 2.4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="18.5" cy="20" r="1.8" fill="#dfe3ea"/></svg>',
  write: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 2h15l6 6v22H6z" fill="#fff" stroke="#000" stroke-width="1.2"/><path d="M21 2v6h6" fill="#ddd" stroke="#000"/><path d="M9 12h14M9 15h14M9 18h14M9 21h10M9 24h12" stroke="#2b579a" stroke-width="1.6"/><path d="M22 21 29 10l2.5 1.6-7 11-3 1.2z" fill="#ffd34d" stroke="#000"/></svg>',
  ledger: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="3" width="26" height="26" fill="#fff" stroke="#000" stroke-width="1.2"/><rect x="3" y="3" width="26" height="6" fill="#217346"/><path d="M3 15h26M3 21h26M12 9v20M21 9v20" stroke="#217346" stroke-width="1.2"/><text x="5" y="8.2" font-size="5" font-family="Arial" fill="#fff" font-weight="bold">A  B  C</text><path d="M14 26l3-6 3 3 4-8" fill="none" stroke="#d00" stroke-width="1.6"/></svg>',
  calc: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="2" width="22" height="28" rx="2" fill="#cfcfcf" stroke="#000" stroke-width="1.2"/><rect x="8" y="5" width="16" height="6" fill="#a9c9a4" stroke="#000"/><text x="22.5" y="10" font-size="5" font-family="Courier New" text-anchor="end">3.14</text><g fill="#555"><rect x="8" y="14" width="4" height="3"/><rect x="14" y="14" width="4" height="3"/><rect x="20" y="14" width="4" height="3" fill="#c33"/><rect x="8" y="19" width="4" height="3"/><rect x="14" y="19" width="4" height="3"/><rect x="20" y="19" width="4" height="3"/><rect x="8" y="24" width="4" height="3"/><rect x="14" y="24" width="4" height="3"/><rect x="20" y="24" width="4" height="3" fill="#33c"/></g></svg>',
  notepad: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="6" y="4" width="20" height="26" fill="#fffbd0" stroke="#000" stroke-width="1.2"/><path d="M6 4h20v4H6z" fill="#3a6fc4" stroke="#000"/><g stroke="#000" stroke-width="1.4"><path d="M10 2v5M15 2v5M20 2v5"/></g><path d="M9 13h14M9 17h14M9 21h14M9 25h9" stroke="#7a7a7a" stroke-width="1.2"/></svg>',
  reader: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 2h15l6 6v22H6z" fill="#fff" stroke="#000" stroke-width="1.2"/><path d="M21 2v6h6" fill="#ddd" stroke="#000"/><rect x="3" y="16" width="20" height="9" fill="#c62828"/><text x="13" y="23" font-size="7" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">PDF</text><path d="M9 10h9M9 13h12" stroke="#888" stroke-width="1.4"/><path d="M19 27 28 18l2 2-9 9h-2z" fill="#ffd400" stroke="#000"/></svg>',
  slides: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="5" width="28" height="19" fill="#fff" stroke="#000" stroke-width="1.2"/><rect x="2" y="5" width="28" height="5" fill="#d24726"/><path d="M6 14h12M6 18h9" stroke="#333" stroke-width="1.4"/><path d="M20 21a5 5 0 1 1 5-5h-5z" fill="#2b579a"/><path d="M16 24v5M11 29h10" stroke="#000" stroke-width="1.4"/></svg>',
  jukebox: '<svg viewBox="0 0 32 32" aria-hidden="true"><defs><radialGradient id="pjk" cx=".4" cy=".35"><stop offset="0" stop-color="#e9f3ff"/><stop offset="1" stop-color="#6aa3e0"/></radialGradient></defs><circle cx="16" cy="16" r="14" fill="url(#pjk)" stroke="#2a5c9a" stroke-width="1.2"/><circle cx="16" cy="16" r="5" fill="#fff" stroke="#2a5c9a"/><path d="M13 21V10.5l8-2V18" fill="none" stroke="#1d3f6e" stroke-width="1.6"/><ellipse cx="11.5" cy="21.5" rx="2.4" ry="1.8" fill="#1d3f6e"/><ellipse cx="19.5" cy="18.5" rx="2.4" ry="1.8" fill="#1d3f6e"/></svg>',
  lanamp: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="6" width="28" height="20" rx="2" fill="#2b2f3a" stroke="#000" stroke-width="1.2"/><rect x="4" y="9" width="12" height="7" fill="#000"/><text x="5" y="15" font-size="6" font-family="Courier New" fill="#3cff6e">3:14</text><g fill="#3cff6e"><rect x="18" y="13" width="2" height="3"/><rect x="21" y="10" width="2" height="6"/><rect x="24" y="12" width="2" height="4"/><rect x="27" y="9" width="1.5" height="7"/></g><path d="M5 20h22" stroke="#8a93a8" stroke-width="2"/><circle cx="14" cy="20" r="2" fill="#f2b705"/></svg>',
  rewind: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="7" width="28" height="18" rx="2" fill="#141414" stroke="#000" stroke-width="1.2"/><rect x="5" y="10" width="22" height="12" fill="#e50914"/><circle cx="11" cy="16" r="3.2" fill="#141414"/><circle cx="21" cy="16" r="3.2" fill="#141414"/><path d="M11 13.5v5M8.5 16h5M21 13.5v5M18.5 16h5" stroke="#555" stroke-width=".8"/><text x="16" y="29.5" font-size="4" font-family="Arial Black,Arial" fill="#f2b705" text-anchor="middle" font-weight="900">REWIND</text></svg>',
  photos: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="3" width="22" height="26" fill="#7a4a1f" stroke="#000" stroke-width="1.2"/><rect x="8" y="6" width="16" height="12" fill="#bfe3ff" stroke="#fff" stroke-width="1.5"/><circle cx="20" cy="9.5" r="1.8" fill="#ffd34d"/><path d="M8 17 13 11l4 4 2-2 5 5" fill="#3c9a50"/><rect x="8" y="20" width="7" height="6" fill="#fff"/><rect x="17" y="20" width="7" height="6" fill="#fff"/></svg>',
  ftp: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M2 7h10l2 3h16v18H2z" fill="#f2c94c" stroke="#8a6d00" stroke-width="1.2"/><circle cx="23" cy="20" r="6.5" fill="#4aa3ff" stroke="#08306b"/><path d="M16.5 20h13M23 13.5c-3 3-3 10 0 13M23 13.5c3 3 3 10 0 13" stroke="#08306b" stroke-width=".8" fill="none"/></svg>',
  docs: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M2 7h10l2 3h16v18H2z" fill="#f2c94c" stroke="#8a6d00" stroke-width="1.2"/><path d="M9 13h10l3 3v10H9z" fill="#fff" stroke="#000"/><path d="M11.5 18h8M11.5 21h8M11.5 24h6" stroke="#2b579a" stroke-width="1.2"/></svg>',
  dupes: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 5h13l4 4v17H3z" fill="#fff" stroke="#000" stroke-width="1.2"/><path d="M16 5v4h4" fill="#ddd" stroke="#000"/><path d="M6 13h10M6 16h10M6 19h7" stroke="#2b579a" stroke-width="1.3"/><path d="M11 9h13l4 4v16H11z" fill="#fff8d0" stroke="#000" stroke-width="1.2"/><path d="M24 9v4h4" fill="#e8dca0" stroke="#000"/><path d="M14 17h10M14 20h10M14 23h7" stroke="#2b579a" stroke-width="1.3"/><circle cx="23" cy="24" r="5" fill="none" stroke="#c62828" stroke-width="2"/><path d="M26.5 27.5 30.5 31.5" stroke="#c62828" stroke-width="2.6" stroke-linecap="round"/></svg>'
};
/** the programs, in Program Manager order */
const PROGRAMS = [
  { id: 'write', url: 'http://write.lanscape.net/' }, { id: 'ledger', url: 'http://ledger.lanscape.net/' }, { id: 'calc', url: 'http://calc.lanscape.net/' },
  { id: 'notepad', url: 'http://notepad.lanscape.net/' }, { id: 'reader', url: 'http://reader.lanscape.net/' }, { id: 'jukebox', url: 'http://music.lanscape.net/' },
  { id: 'lanamp', url: 'lanscape:lanamp', name: 'LANamp', blurb: 'Mini player with an equalizer and playlist' }, { id: 'rewind', url: 'http://www.rewindvideo.com/' }, { id: 'photos', url: 'http://photos.lanscape.net/' }, { id: 'pinball', url: 'http://pinball.lanscape.net/' },
  { id: 'dupes', url: 'http://dupes.lanscape.net/' }
];
const progName = p => p.name || APPS[p.id].short;
const progBlurb = p => p.blurb || APPS[p.id].blurb;

/* ---------------- Media Viewer: a picture, song or video all by itself ---------------- */
async function mountMedia(ctx) {
  const { h, file: d } = ctx;
  ctx.root.classList.add('media-' + d.kind);
  const url = await ctx.objectURL(d);
  if (!url) throw new Error('LANscape couldn\'t read ' + d.name + '.');
  const name = d.name;
  if (d.kind === 'image') {
    const img = h('img', { src: url, alt: name, class: 'fit' });
    img.addEventListener('click', () => img.classList.toggle('fit'));
    img.addEventListener('load', () => ctx.setTitle(name + ' (' + (d.ext || 'image').toUpperCase() + ' Image, ' + img.naturalWidth + ' × ' + img.naturalHeight + ' pixels)'));
    ctx.root.append(h('div', { class: 'mv-stage' }, img));
  } else {
    const m = h(d.kind === 'audio' ? 'audio' : 'video', { src: url, controls: true, autoplay: true, preload: 'metadata' });
    // an MKV the browser won't take plays through LANscape's converter
    let mkvTried = false;
    const viaMkv = async () => {
      if (mkvTried || d.kind !== 'video' || !MKV_EXT.test(d.ext) || !mkvCan()) return false;
      mkvTried = true;
      try {
        const p = await MkvPlayer.open(await ctx.blob(d));
        ctx.cleanup(() => p.detach());
        if (p.problem) { ctx.status(p.problem); return true; }
        await p.attach(m, 0);
        if (p.note) ctx.status(p.note);
        m.play().catch(() => {});
        return true;
      } catch (e) { return false; }
    };
    m.addEventListener('loadedmetadata', () => { if (d.kind === 'video' && !m.videoWidth && MKV_EXT.test(d.ext)) viaMkv(); }, { once: true });
    if (d.kind === 'audio') ctx.root.append(h('div', { class: 'mv-audio' }, h('div', { class: 'mv-title', text: d.meta.title || name }), h('div', { class: 'mv-sub', text: [d.meta.artist, d.meta.album].filter(x => x && !/^Unknown/.test(x)).join(' — ') }), m));
    else ctx.root.append(h('div', { class: 'mv-stage' }, m));
    m.addEventListener('error', async () => { if (await viaMkv()) return; ctx.status('This browser can\'t play ' + name + '.'); });
    if (d.kind === 'audio' && typeof Player !== 'undefined') Player.pause();
    ctx.cleanup(() => { try { m.pause(); m.removeAttribute('src'); m.load(); } catch (e) { /* ignore */ } });
  }
  return { title: name };
}
/* ---------------- File Properties ---------------- */
async function mountFileInfo(ctx) {
  const { h, file: d } = ctx;
  const k = K(d);
  let head = new Uint8Array(0);
  try { const b = await ctx.blob(d); head = new Uint8Array(await b.slice(0, 512).arrayBuffer()); } catch (e) { /* not readable right now */ }
  const hex = [];
  for (let i = 0; i < head.length; i += 16) {
    const row = head.subarray(i, i + 16);
    hex.push(i.toString(16).padStart(8, '0') + '  ' + Array.from(row, b => b.toString(16).padStart(2, '0')).join(' ').padEnd(48) + '  ' + Array.from(row, b => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join(''));
  }
  const rows = [['Type', k.label + (d.ext ? ' (.' + d.ext + ')' : '')], ['Location', d.path.slice(0, d.path.length - d.name.length)], ['Size', fmtBytes(d.size) + ' (' + (d.size || 0).toLocaleString() + ' bytes)'], ['Modified', fmtDate(d.mtime, true)], ['Web address', d.url], ['FTP address', d.ftp]];
  const props = h('div', { class: 'props rais' },
    h('div', { class: 'props-head' }, h('span', { class: 'big-icon', html: iconFor(d).replace('width="16" height="16"', 'width="32" height="32"') }), h('b', { text: d.name })),
    h('table', {}, ...rows.map(([a, b]) => h('tr', {}, h('td', { text: a + ':' }), h('td', { text: b || '—' })))),
    h('div', { class: 'props-btns' },
      h('button', { class: 'btn', type: 'button', text: 'Download', onclick: async () => { try { ctx.download(d.name, await ctx.blob(d)); } catch (e) { ctx.status(e.message); } } }),
      h('button', { class: 'btn', type: 'button', text: 'Open as Text', onclick: () => ctx.go('http://notepad.lanscape.net/edit?url=' + encodeURIComponent(d.url)) }),
      h('button', { class: 'btn', type: 'button', text: 'Show Folder', onclick: () => ctx.go(d.ftp.replace(/[^/]*$/, '')) })),
    h('div', { class: 'hexhead', text: 'First ' + head.length + ' bytes' }),
    h('pre', { class: 'hex sunk', text: hex.join('\n') || '(empty file)' }));
  ctx.root.append(h('div', { class: 'props-wrap' }, props));
  return { title: d.name + ' Properties' };
}
