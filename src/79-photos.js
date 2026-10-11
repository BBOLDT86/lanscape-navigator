/* ===================================================================
   Photo Album: every picture on your LANscape, one album per folder,
   laid out like prints on a desk. Lightbox with EXIF details, a Ken
   Burns slideshow, and "Publish Web Album", which writes a 1998-style
   gallery page into My Documents so it joins your web.
   =================================================================== */
const PH_HOST = 'http://photos.lanscape.net';
const PHOTOS_CSS = `body.app-photos{font:13px/1.4 Verdana,Tahoma,"DejaVu Sans",sans-serif;color:#eee;background:#2b2622}
.ph{flex:1;min-height:0;overflow:auto;background:radial-gradient(ellipse at 50% 0,#4a3f36,#2b2622 60%,#1e1a17);position:relative}
.ph-top{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:14px;padding:10px 18px;background:linear-gradient(#3b332d,#2a241f);border-bottom:1px solid #120f0d;box-shadow:0 2px 8px rgba(0,0,0,.4)}
.ph-top h1{margin:0;font:italic bold 22px Georgia,"Times New Roman",serif;color:#ffe9b8;text-shadow:0 2px 0 #000;white-space:nowrap}
.ph-top h1 span{color:#ffb347}
.ph-crumbs{color:#c9b9a0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ph-crumbs a{color:#ffd27a;text-decoration:none;cursor:pointer}
.ph-crumbs a:hover{text-decoration:underline}
.ph-top .sp{flex:1}
.ph-top input[type=search]{background:#1e1a17;border:1px solid #5a4d42;color:#eee;padding:4px 8px;border-radius:12px;width:min(200px,28vw);font:12px Verdana,sans-serif;outline:none}
.ph-top input[type=range]{width:90px;accent-color:#ffb347}
.ph-bt{background:linear-gradient(#5a4d42,#3b332d);border:1px solid #120f0d;color:#ffe9b8;border-radius:4px;padding:4px 10px;font:12px Verdana,sans-serif;cursor:pointer;white-space:nowrap}
.ph-bt:hover{background:linear-gradient(#6d5e51,#4a3f36)}
.ph-body{padding:18px 22px 60px}
.ph-sec{margin:0 0 26px}
.ph-sec h2{font:italic bold 18px Georgia,serif;color:#ffe9b8;margin:0 0 12px;display:flex;gap:10px;align-items:baseline}
.ph-sec h2 small{font:12px Verdana,sans-serif;color:#b7a68e;font-style:normal}
.ph-albums{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:34px 26px}
.ph-album{cursor:pointer;text-align:center;outline:none}
.ph-stack{position:relative;aspect-ratio:4/3;margin:8px 10px 12px}
.ph-stack i{position:absolute;inset:0;background:#f4efe6 center/cover no-repeat;border:6px solid #f4efe6;border-bottom-width:16px;box-shadow:0 3px 8px rgba(0,0,0,.6);transition:transform .25s}
.ph-stack i:nth-child(1){transform:rotate(-6deg)}
.ph-stack i:nth-child(2){transform:rotate(4deg)}
.ph-stack i:nth-child(3){transform:rotate(-1deg)}
.ph-album:hover .ph-stack i:nth-child(1),.ph-album:focus .ph-stack i:nth-child(1){transform:rotate(-12deg) translate(-12px,-4px)}
.ph-album:hover .ph-stack i:nth-child(2),.ph-album:focus .ph-stack i:nth-child(2){transform:rotate(9deg) translate(12px,-2px)}
.ph-album b{display:block;font:bold 14px Georgia,serif;color:#ffe9b8}
.ph-album span{font-size:11px;color:#b7a68e}
.ph-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--ts,170px),1fr));gap:26px 22px}
.ph-print{background:#f4efe6;padding:7px 7px 0;box-shadow:0 3px 9px rgba(0,0,0,.55);cursor:zoom-in;transform:rotate(var(--rot,0deg));transition:transform .2s,box-shadow .2s;outline:none;position:relative}
.ph-print:hover,.ph-print:focus{transform:rotate(0) scale(1.05);box-shadow:0 10px 22px rgba(0,0,0,.7);z-index:2}
.ph-print .im{aspect-ratio:1;background:#d9d2c5 center/cover no-repeat;display:grid;place-items:center;color:#7a6e5e;font-size:11px}
.ph-print .cap{font:14px/1.2 "Segoe Print","Bradley Hand","Comic Sans MS","Chalkboard SE",cursive;color:#3a3226;padding:6px 2px 8px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ph-print.sel{outline:3px solid #ffb347;outline-offset:3px}
.ph-tape{position:absolute;top:-9px;left:50%;width:46px;height:16px;margin-left:-23px;background:rgba(255,248,210,.55);transform:rotate(-3deg);box-shadow:0 1px 2px rgba(0,0,0,.2)}
.ph-empty{text-align:center;color:#b7a68e;padding:70px 20px;font-size:15px}
.ph-lb{position:fixed;inset:0;z-index:30;background:rgba(10,8,7,.96);display:flex;flex-direction:column}
.ph-lb .bar{display:flex;align-items:center;gap:8px;padding:8px 14px;color:#ddd;flex:none}
.ph-lb .bar .t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px}
.ph-lb .stage{flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}
.ph-lb .stage img{max-width:100%;max-height:100%;transition:transform .25s;user-select:none;-webkit-user-drag:none;box-shadow:0 6px 30px rgba(0,0,0,.8)}
.ph-lb .stage.zoom{cursor:grab;overflow:auto;display:block}
.ph-lb .stage.zoom img{max-width:none;max-height:none}
.ph-lb .nav{position:absolute;top:50%;margin-top:-30px;width:48px;height:60px;border:0;background:rgba(0,0,0,.4);color:#fff;font-size:30px;cursor:pointer;border-radius:4px;z-index:2}
.ph-lb .nav:hover{background:rgba(0,0,0,.7)}
.ph-lb .nav.l{left:10px}.ph-lb .nav.r{right:10px}
.ph-lb .film{flex:none;display:flex;gap:6px;padding:8px 14px 12px;overflow-x:auto;scrollbar-width:thin}
.ph-lb .film i{flex:none;width:64px;height:48px;background:#333 center/cover no-repeat;cursor:pointer;opacity:.55;border:2px solid transparent}
.ph-lb .film i.on{opacity:1;border-color:#ffb347}
.ph-lb .info{position:absolute;right:0;top:0;bottom:0;width:min(300px,80vw);background:rgba(30,26,23,.97);border-left:1px solid #5a4d42;padding:14px;overflow:auto;font-size:12px;z-index:3}
.ph-lb .info h3{margin:0 0 10px;font:italic bold 16px Georgia,serif;color:#ffe9b8}
.ph-lb .info table{border-collapse:collapse;width:100%}
.ph-lb .info td{padding:3px 4px;vertical-align:top;border-bottom:1px solid #3b332d;word-break:break-word}
.ph-lb .info td:first-child{color:#b7a68e;white-space:nowrap}
.ph-show{position:fixed;inset:0;z-index:40;background:#000;overflow:hidden;cursor:none}
.ph-show .sl{position:absolute;inset:0;background:#000 center/contain no-repeat;opacity:0;transition:opacity 1.2s}
.ph-show .sl.on{opacity:1}
.ph-show .sl.kb1{animation:phkb1 var(--dur,6s) linear forwards}
.ph-show .sl.kb2{animation:phkb2 var(--dur,6s) linear forwards}
@keyframes phkb1{from{transform:scale(1)}to{transform:scale(1.12) translate(-1.5%,-1%)}}
@keyframes phkb2{from{transform:scale(1.12) translate(1.5%,1%)}to{transform:scale(1)}}
.ph-show .cap{position:absolute;left:0;right:0;bottom:22px;text-align:center;font:italic 20px Georgia,serif;color:#fff;text-shadow:0 2px 6px #000;transition:opacity .4s}
.ph-show .ctl{position:absolute;left:50%;bottom:60px;transform:translateX(-50%);display:flex;gap:8px;background:rgba(0,0,0,.6);padding:8px 12px;border-radius:24px;transition:opacity .4s;cursor:default}
.ph-show.idle .ctl,.ph-show.idle .cap{opacity:0}
.ph-show .ctl button{background:none;border:0;color:#fff;font-size:18px;cursor:pointer;padding:2px 8px}
@media (max-width:600px){.ph-top{flex-wrap:wrap}.ph-top h1{font-size:18px}.ph-body{padding:12px}}`;
function phAlbums() {
  const pics = docsShown().filter(d => d.kind === 'image' && d.active !== false && !d.asset);
  const by = new Map();
  for (const d of pics) {
    if (!by.has(d.dir)) by.set(d.dir, []);
    by.get(d.dir).push(d);
  }
  const albums = [];
  const used = new Set();
  for (const [dir, list] of by) {
    const parts = dir.split('/').filter(Boolean);
    const name = parts.length > 1 ? parts[parts.length - 1] : parts[0] || 'Pictures';
    let key = slug(name), k = 2;
    while (used.has(key)) key = slug(name) + '-' + k++;
    used.add(key);
    list.sort((a, b) => cmpVal(a.name, b.name));
    albums.push({ key, name, dir, list, root: parts[0] || '', mtime: Math.max(...list.map(d => d.mtime || 0)) });
  }
  albums.sort((a, b) => cmpVal(a.dir, b.dir));
  return albums;
}
const phCaption = d => prettyName(d.name);
function photosRoute(path, q) {
  let m;
  if ((m = /^\/photo\/([^/]+)\/?$/.exec(path))) {
    const d = S.slugs.get('photo:' + decodeURIComponent(m[1]).toLowerCase());
    if (!d) return { type: 'gen', url: PH_HOST + path, title: '404 Not Found', html: notFoundPage(PH_HOST + path, 'photos.lanscape.net'), status: 404 };
    return { type: 'app', doc: d, url: d.url, view: { photo: d.path } };
  }
  if ((m = /^\/album\/([^/]+)\/?$/.exec(path))) return { type: 'app', url: PH_HOST + '/album/' + m[1], view: { album: decodeURIComponent(m[1]) }, title: 'Photo Album' };
  if ((m = /^\/slideshow\/([^/]+)\/?$/.exec(path))) return { type: 'app', url: PH_HOST + '/slideshow/' + m[1], view: { album: decodeURIComponent(m[1]), show: true }, title: 'Slide Show - Photo Album' };
  if (path === '/search') return { type: 'app', url: PH_HOST + '/search?q=' + encodeURIComponent(q.get('q') || ''), view: { q: q.get('q') || '' }, title: 'Search - Photo Album' };
  return null;
}
/** a little EXIF reader: camera, date taken, exposure, GPS */
async function readExif(blob) {
  try {
    const u = new Uint8Array(await blob.slice(0, 196608).arrayBuffer());
    if (u[0] !== 0xff || u[1] !== 0xd8) return null;
    let p = 2;
    while (p + 4 < u.length && u[p] === 0xff) {
      const mk = u[p + 1], len = (u[p + 2] << 8) | u[p + 3];
      if (mk === 0xe1 && ascii(u, p + 4, 4) === 'Exif') return parseTiffExif(u, p + 10);
      if (mk === 0xda) break;
      p += 2 + len;
    }
  } catch (e) { /* not readable */ }
  return null;
}
function parseTiffExif(u, s) {
  const le = u[s] === 0x49;
  const u16 = o => (le ? u[s + o] | (u[s + o + 1] << 8) : (u[s + o] << 8) | u[s + o + 1]);
  const u32 = o => (le ? (u[s + o] | (u[s + o + 1] << 8) | (u[s + o + 2] << 16) | (u[s + o + 3] << 24)) >>> 0 : ((u[s + o] << 24) | (u[s + o + 1] << 16) | (u[s + o + 2] << 8) | u[s + o + 3]) >>> 0);
  const SZ = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
  const ifd = off => {
    const tags = {};
    if (off <= 0 || s + off + 2 > u.length) return tags;
    const n = u16(off);
    for (let i = 0; i < n && i < 200; i++) {
      const e = off + 2 + i * 12;
      if (s + e + 12 > u.length) break;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      const size = (SZ[type] || 1) * count, vo = size > 4 ? u32(e + 8) : e + 8;
      if (s + vo + Math.min(size, 64) > u.length) continue;
      if (type === 2) tags[tag] = ascii(u, s + vo, Math.min(count, 64)).replace(/\0.*$/, '').trim();
      else if (type === 3) tags[tag] = count > 1 ? [u16(vo), u16(vo + 2)] : u16(vo);
      else if (type === 4) tags[tag] = u32(vo);
      else if (type === 5 || type === 10) { const rat = k => { const a = u32(vo + k * 8), b = u32(vo + k * 8 + 4); return b ? (type === 10 ? (a | 0) / (b | 0) : a / b) : 0; }; tags[tag] = count > 1 ? Array.from({ length: Math.min(count, 4) }, (_, k) => rat(k)) : rat(0); }
    }
    return tags;
  };
  const t0 = ifd(u32(4));
  const ex = t0[0x8769] ? ifd(t0[0x8769]) : {};
  const gp = t0[0x8825] ? ifd(t0[0x8825]) : {};
  const dms = v => (Array.isArray(v) ? v[0] + v[1] / 60 + (v[2] || 0) / 3600 : null);
  let lat = dms(gp[2]), lon = dms(gp[4]);
  if (lat != null && gp[1] === 'S') lat = -lat;
  if (lon != null && gp[3] === 'W') lon = -lon;
  return { make: t0[0x010f] || '', model: t0[0x0110] || '', orientation: t0[0x0112] || 1, date: ex[0x9003] || t0[0x0132] || '', exposure: ex[0x829a] || 0, fnumber: ex[0x829d] || 0, iso: Array.isArray(ex[0x8827]) ? ex[0x8827][0] : ex[0x8827] || 0, focal: ex[0x920a] || 0, software: t0[0x0131] || '', lat, lon };
}
async function mountPhotos(ctx) {
  const { h, doc, win } = ctx;
  const route = Object.assign({}, ctx.route.view || {});
  if (ctx.file && ctx.file.kind === 'image' && !route.photo) route.photo = ctx.file.path;
  const albums = phAlbums();
  const all = albums.flatMap(a => a.list);
  const prefs = Object.assign({ size: 170 }, (await ctx.kv.get('photos:prefs')) || {});
  const rots = (await ctx.kv.get('photos:rot')) || {};
  const savePrefs = () => ctx.kv.set('photos:prefs', prefs);
  const box = h('div', { class: 'ph' });
  const crumbs = h('div', { class: 'ph-crumbs' });
  const searchIn = h('input', { type: 'search', placeholder: 'Find pictures', 'aria-label': 'Find pictures' });
  const sizeIn = h('input', { type: 'range', min: '110', max: '320', step: '10', 'aria-label': 'Picture size', title: 'Picture size' });
  sizeIn.value = String(prefs.size);
  const actions = h('div', { style: { display: 'flex', gap: '8px' } });
  const top = h('div', { class: 'ph-top' }, h('h1', { html: 'LANscape <span>Photo Album</span>' }), crumbs, h('div', { class: 'sp' }), actions, sizeIn, searchIn);
  const body = h('div', { class: 'ph-body' });
  box.append(top, body);
  ctx.root.append(box);
  box.style.setProperty('--ts', prefs.size + 'px');
  sizeIn.addEventListener('input', () => { prefs.size = +sizeIn.value; box.style.setProperty('--ts', prefs.size + 'px'); savePrefs(); });
  // thumbnails load as they scroll into view
  const io = new win.IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); const d = S.docs.get(e.target.dataset.p); if (d) mediaThumbURL(d).then(u => { if (u) e.target.style.backgroundImage = 'url("' + u + '")'; else e.target.textContent = d.ext.toUpperCase(); }).catch(() => { e.target.textContent = (d.ext || '').toUpperCase(); }); } }, { root: box, rootMargin: '400px 0px' });
  ctx.cleanup(() => io.disconnect());
  const thumb = (d, cls) => { const i = h(cls || 'div', { class: 'im', 'data-p': d.path }); io.observe(i); return i; };
  let cur = null; // current album
  const tilt = d => { let x = 0; for (const c of d.path) x = (x * 33 + c.charCodeAt(0)) % 1000; return ((x % 70) - 35) / 10; };
  function print(d, list) {
    const p = h('div', { class: 'ph-print', tabindex: '0', role: 'button', 'aria-label': phCaption(d), style: { '--rot': tilt(d) + 'deg' } }, Math.abs(tilt(d)) > 2.6 ? h('span', { class: 'ph-tape' }) : null, thumb(d), h('div', { class: 'cap', text: phCaption(d), title: d.name }));
    p.addEventListener('click', () => lightbox(list, list.indexOf(d)));
    p.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); lightbox(list, list.indexOf(d)); } });
    return p;
  }
  function setCrumbs(parts) { crumbs.replaceChildren(...parts.flatMap((p, i) => [i ? ' › ' : '', p.go ? h('a', { text: p.label, onclick: p.go }) : h('span', { text: p.label })])); }
  function home() {
    cur = null;
    setCrumbs([{ label: 'All Albums' }]);
    actions.replaceChildren(all.length ? h('button', { class: 'ph-bt', type: 'button', text: '▶ Slide Show', onclick: () => slideshow(all, 0, 'All Pictures') }) : '');
    body.replaceChildren();
    if (!all.length) { body.append(h('div', { class: 'ph-empty', html: '<p style="font:italic 22px Georgia,serif;color:#ffe9b8">No pictures yet</p><p>Open a folder with JPEG, PNG, GIF, WebP or SVG pictures and every folder becomes an album here.</p>' })); return; }
    const recent = all.slice().sort((a, b) => (S.firstSeen[b.path] || b.mtime) - (S.firstSeen[a.path] || a.mtime)).slice(0, 12);
    const sec = h('div', { class: 'ph-sec' }, h('h2', {}, 'Albums', h('small', { text: albums.length + ' albums · ' + all.length + ' pictures' })));
    const grid = h('div', { class: 'ph-albums' });
    for (const a of albums) {
      const st = h('div', { class: 'ph-stack' });
      for (const d of a.list.slice(0, 3).reverse()) { const i = h('i', { 'data-p': d.path }); io.observe(i); st.append(i); }
      const el2 = h('div', { class: 'ph-album', tabindex: '0', role: 'link', 'aria-label': a.name }, st, h('b', { text: a.name }), h('span', { text: a.list.length + ' picture' + (a.list.length === 1 ? '' : 's') + ' · ' + a.root }));
      el2.addEventListener('click', () => openAlbum(a));
      el2.addEventListener('keydown', e => { if (e.key === 'Enter') openAlbum(a); });
      grid.append(el2);
    }
    sec.append(grid);
    const rs = h('div', { class: 'ph-sec' }, h('h2', {}, 'Recently Added'), h('div', { class: 'ph-grid' }, ...recent.map(d => print(d, recent))));
    body.append(sec, rs);
  }
  function openAlbum(a, noUrl) {
    cur = a;
    setCrumbs([{ label: 'All Albums', go: () => { home(); ctx.replaceUrl(PH_HOST + '/', 'Photo Album'); } }, { label: a.name }]);
    actions.replaceChildren(h('button', { class: 'ph-bt', type: 'button', text: '▶ Slide Show', onclick: () => slideshow(a.list, 0, a.name) }), h('button', { class: 'ph-bt', type: 'button', text: '★ Publish Web Album', title: 'Make a web page of this album in My Documents', onclick: () => publish(a) }));
    body.replaceChildren(h('div', { class: 'ph-sec' }, h('h2', {}, a.name, h('small', { text: a.list.length + ' pictures · ' + a.dir })), h('div', { class: 'ph-grid' }, ...a.list.map(d => print(d, a.list)))));
    box.scrollTop = 0;
    if (!noUrl) ctx.replaceUrl(PH_HOST + '/album/' + a.key, a.name + ' - Photo Album');
  }
  function search(q) {
    const t = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!t.length) { if (cur) openAlbum(cur, true); else home(); return; }
    const hits = all.filter(d => t.every(w => (d.path + ' ' + phCaption(d)).toLowerCase().includes(w)));
    setCrumbs([{ label: 'All Albums', go: () => { searchIn.value = ''; home(); } }, { label: 'Search: ' + q }]);
    body.replaceChildren(h('div', { class: 'ph-sec' }, h('h2', {}, 'Pictures matching “' + q + '”', h('small', { text: hits.length + ' found' })), hits.length ? h('div', { class: 'ph-grid' }, ...hits.map(d => print(d, hits))) : h('div', { class: 'ph-empty', text: 'Nothing matches. Try a folder name.' })));
  }
  searchIn.addEventListener('input', debounce(() => { search(searchIn.value.trim()); if (searchIn.value.trim()) ctx.replaceUrl(PH_HOST + '/search?q=' + encodeURIComponent(searchIn.value.trim()), 'Search - Photo Album'); }, 200));
  searchIn.addEventListener('keydown', e => e.stopPropagation());
  /* ---------- lightbox ---------- */
  let lb = null;
  function lightbox(list, i) {
    if (lb) lb.remove();
    let idx = i, zoom = false, infoOn = false;
    const img = h('img', { alt: '' });
    const stage = h('div', { class: 'stage' }, img);
    const title = h('div', { class: 't' });
    const film = h('div', { class: 'film' });
    const info = h('div', { class: 'info', hidden: true });
    const bt = (t, label, fn) => h('button', { class: 'ph-bt', type: 'button', text: t, title: label, 'aria-label': label, onclick: fn });
    lb = h('div', { class: 'ph-lb', role: 'dialog', 'aria-label': 'Picture viewer' },
      h('div', { class: 'bar' }, title, bt('⟲', 'Rotate left (Shift+R)', () => rotate(-90)), bt('⟳', 'Rotate right (R)', () => rotate(90)), bt('🔍', 'Actual size (Z)', () => setZoom(!zoom)), bt('ⓘ Info', 'Details (I)', () => toggleInfo()), bt('▶ Show', 'Slide show (Space)', () => { const l = list; close(); slideshow(l, idx, cur ? cur.name : 'Pictures'); }), bt('⬇', 'Download', async () => { const d = list[idx]; ctx.download(d.name, await ctx.blob(d)); }), bt('✕', 'Close (Esc)', () => close())),
      stage, film, info);
    stage.append(h('button', { class: 'nav l', type: 'button', 'aria-label': 'Previous picture', text: '‹', onclick: () => show(idx - 1) }), h('button', { class: 'nav r', type: 'button', 'aria-label': 'Next picture', text: '›', onclick: () => show(idx + 1) }));
    list.forEach((d, k) => { const t = h('i', { 'data-p': d.path, title: phCaption(d) }); t.addEventListener('click', () => show(k)); io.observe(t); film.append(t); });
    const fio = new win.IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { fio.unobserve(e.target); const d = S.docs.get(e.target.dataset.p); if (d) mediaThumbURL(d).then(u => { if (u) e.target.style.backgroundImage = 'url("' + u + '")'; }); } }, { root: film });
    for (const t of film.children) fio.observe(t);
    ctx.root.append(lb);
    const rotOf = d => rots[d.path] || 0;
    async function show(k) {
      idx = (k + list.length) % list.length;
      const d = list[idx];
      setZoom(false);
      title.textContent = phCaption(d) + '  ·  ' + (idx + 1) + ' of ' + list.length;
      img.style.transform = 'rotate(' + rotOf(d) + 'deg)';
      img.src = (await ctx.objectURL(d)) || '';
      img.alt = phCaption(d);
      [...film.children].forEach((t, j) => t.classList.toggle('on', j === idx));
      const on = film.children[idx]; if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
      ctx.replaceUrl(d.url, phCaption(d) + ' - Photo Album');
      if (infoOn) fillInfo();
    }
    function setZoom(z) { zoom = z; stage.classList.toggle('zoom', z); }
    function rotate(deg) { const d = list[idx]; rots[d.path] = ((rotOf(d) + deg) % 360 + 360) % 360; if (!rots[d.path]) delete rots[d.path]; ctx.kv.set('photos:rot', rots); img.style.transform = 'rotate(' + rotOf(d) + 'deg)'; }
    async function fillInfo() {
      const d = list[idx];
      info.replaceChildren(h('h3', { text: phCaption(d) }));
      const rows = [['File', d.name], ['Folder', d.dir], ['Size', fmtBytes(d.size || 0)], ['Picture', img.naturalWidth ? img.naturalWidth + ' × ' + img.naturalHeight + ' pixels' : ''], ['Modified', fmtDate(d.mtime, true)], ['Web address', d.url], ['FTP', d.ftp]];
      const tb = h('table', {}, ...rows.filter(r => r[1]).map(([a, b]) => h('tr', {}, h('td', { text: a }), h('td', { text: b }))));
      info.append(tb);
      if (d.ext === 'jpg' || d.ext === 'jpeg') {
        const ex = await readExif(await ctx.blob(d));
        if (ex && list[idx] === d) {
          const er = [['Taken', ex.date ? ex.date.replace(/^(\d{4}):(\d\d):(\d\d)/, '$1-$2-$3') : ''], ['Camera', [ex.make, ex.model].filter(Boolean).join(' ')], ['Exposure', ex.exposure ? (ex.exposure < 1 ? '1/' + Math.round(1 / ex.exposure) : ex.exposure) + ' s' : ''], ['Aperture', ex.fnumber ? 'f/' + (+ex.fnumber).toFixed(1) : ''], ['ISO', ex.iso || ''], ['Focal length', ex.focal ? Math.round(ex.focal) + ' mm' : ''], ['Software', ex.software], ['GPS', ex.lat != null && ex.lon != null ? ex.lat.toFixed(5) + ', ' + ex.lon.toFixed(5) : '']].filter(r => r[1]);
          if (er.length) { info.append(h('h3', { text: 'Camera', style: { marginTop: '14px' } }), h('table', {}, ...er.map(([a, b]) => h('tr', {}, h('td', { text: a }), h('td', { text: String(b) }))))); }
        }
      }
      info.append(h('p', {}, h('a', { href: '#', text: 'Show in folder', style: { color: '#ffd27a' }, onclick: e => { e.preventDefault(); ctx.go(d.ftp.replace(/[^/]*$/, '')); } }), ' · ', h('a', { href: '#', text: 'Open on its own', style: { color: '#ffd27a' }, onclick: e => { e.preventDefault(); ctx.go(d.ftp); } })));
    }
    function toggleInfo() { infoOn = !infoOn; info.hidden = !infoOn; if (infoOn) fillInfo(); }
    function close() { if (!lb) return; lb.remove(); lb = null; fio.disconnect(); ctx.replaceUrl(cur ? PH_HOST + '/album/' + cur.key : PH_HOST + '/', (cur ? cur.name + ' - ' : '') + 'Photo Album'); }
    lb._key = e => {
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); if (zoom) setZoom(false); else close(); }
      else if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); show(idx + 1); }
      else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); show(idx - 1); }
      else if (k === 'Home') show(0); else if (k === 'End') show(list.length - 1);
      else if (k === 'r') rotate(90); else if (k === 'R') rotate(-90);
      else if (k === 'z' || k === 'Z') setZoom(!zoom);
      else if (k === 'i' || k === 'I') toggleInfo();
      else if (k === ' ') { e.preventDefault(); const l = list, j = idx; close(); slideshow(l, j, cur ? cur.name : 'Pictures'); }
    };
    img.addEventListener('dblclick', () => setZoom(!zoom));
    let sx = null;
    stage.addEventListener('pointerdown', e => { if (!zoom) sx = e.clientX; });
    stage.addEventListener('pointerup', e => { if (sx != null && Math.abs(e.clientX - sx) > 60) show(idx + (e.clientX < sx ? 1 : -1)); sx = null; });
    show(idx);
  }
  /* ---------- slideshow ---------- */
  let showEl = null;
  function slideshow(list, start, name) {
    if (!list.length) return;
    if (showEl) showEl.remove();
    let idx = start || 0, playing = true, t = null, idleT = null, flip = false;
    const a = h('div', { class: 'sl' }), b = h('div', { class: 'sl' });
    const cap = h('div', { class: 'cap' });
    const pp = h('button', { type: 'button', 'aria-label': 'Pause', text: '❚❚' });
    const ctl = h('div', { class: 'ctl' }, h('button', { type: 'button', 'aria-label': 'Previous', text: '⏮', onclick: () => go2(idx - 1) }), pp, h('button', { type: 'button', 'aria-label': 'Next', text: '⏭', onclick: () => go2(idx + 1) }), h('button', { type: 'button', 'aria-label': 'Music', title: 'Play music from the Jukebox', text: '♫', onclick: () => { if (typeof Player !== 'undefined') Player.toggle(); } }), h('button', { type: 'button', 'aria-label': 'Exit slide show', text: '✕', onclick: () => stop() }));
    showEl = h('div', { class: 'ph-show', role: 'dialog', 'aria-label': 'Slide show: ' + name }, a, b, cap, ctl);
    ctx.root.append(showEl);
    try { showEl.requestFullscreen().catch(() => {}); } catch (e) { /* not allowed */ }
    const DUR = 5000;
    async function go2(k) {
      clearTimeout(t);
      idx = (k + list.length) % list.length;
      const d = list[idx];
      const url = await ctx.objectURL(d);
      if (!showEl) return;
      const [inn, out] = flip ? [a, b] : [b, a];
      flip = !flip;
      inn.className = 'sl';
      inn.style.backgroundImage = 'url("' + url + '")';
      inn.style.setProperty('--dur', (DUR + 1500) + 'ms');
      void inn.offsetWidth;
      inn.className = 'sl on ' + (idx % 2 ? 'kb2' : 'kb1');
      out.classList.remove('on');
      cap.textContent = phCaption(d) + '  —  ' + (idx + 1) + ' / ' + list.length;
      if (playing) t = setTimeout(() => go2(idx + 1), DUR);
    }
    function stop() { clearTimeout(t); clearTimeout(idleT); if (doc.fullscreenElement) doc.exitFullscreen().catch(() => {}); if (showEl) showEl.remove(); showEl = null; }
    pp.addEventListener('click', () => { playing = !playing; pp.textContent = playing ? '❚❚' : '▶'; if (playing) go2(idx + 1); else clearTimeout(t); });
    const wake = () => { showEl && showEl.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => showEl && showEl.classList.add('idle'), 2200); };
    showEl.addEventListener('pointermove', wake);
    showEl._key = e => {
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); stop(); }
      else if (k === 'ArrowRight') go2(idx + 1);
      else if (k === 'ArrowLeft') go2(idx - 1);
      else if (k === ' ') { e.preventDefault(); pp.click(); }
      wake();
    };
    ctx.cleanup(() => { clearTimeout(t); clearTimeout(idleT); });
    wake();
    go2(idx);
  }
  ctx.on(doc, 'keydown', e => {
    if (showEl && showEl._key) return showEl._key(e);
    if (lb && lb._key) return lb._key(e);
    if (e.target.tagName === 'INPUT') return;
    if (e.key === '/' ) { e.preventDefault(); searchIn.focus(); }
  });
  /* ---------- publish a web album (a page of its own, 1998 style) ---------- */
  async function publish(a) {
    const list = a.list.slice(0, 120);
    ctx.status('Making thumbnails for ' + a.name + '...');
    const cells = [];
    for (const d of list) {
      let th = null;
      try { th = await imageThumb(await ctx.blob(d), 160, 0.72); } catch (e) { th = null; }
      cells.push('<td align="center" valign="top" width="25%"><a href="' + esc(d.url) + '">' + (th ? '<img src="' + th + '" border="2" alt="' + esc(phCaption(d)) + '" style="max-width:160px">' : '[' + esc(d.name) + ']') + '</a><br><font size="2" face="Comic Sans MS, cursive">' + esc(phCaption(d)) + '</font></td>');
    }
    const rows = [];
    for (let i = 0; i < cells.length; i += 4) rows.push('<tr>' + cells.slice(i, i + 4).join('') + '</tr>');
    const html = '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>' + esc(a.name) + ' - My Web Album</title><meta name="description" content="Pictures from ' + esc(a.name) + '"></head>\n<body bgcolor="#000033" text="#ffffcc" link="#66ffff" vlink="#ff99ff" style="background:#000033 url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFklEQVQI12NgYPj/n4EBCzAJMAEAJQ4CAbTRd1EAAAAASUVORK5CYII=)">\n<center>\n<marquee behavior="alternate" scrollamount="4"><font face="Arial Black" size="6" color="#ffcc00">~*~ ' + esc(a.name) + ' ~*~</font></marquee>\n<p><font face="Comic Sans MS">Welcome to my web album! ' + list.length + ' pictures from my ' + esc(a.name) + ' folder. Click a picture to see it big.</font></p>\n<hr width="60%" size="3" color="#ff66ff">\n<table cellpadding="8" cellspacing="4" border="0">\n' + rows.join('\n') + '\n</table>\n<hr width="60%" size="3" color="#ff66ff">\n<p><font size="2">Made with LANscape Photo Album &middot; ' + esc(fmtDate(Date.now())) + '</font><br><font size="2">Best viewed in LANscape Navigator at 800x600</font></p>\n</center>\n</body></html>\n';
    let nd = null;
    try { nd = await createFile(VROOT + '/Web Albums/' + cleanName(a.name) + '/', 'index.html', html); } catch (e) { ctx.msg('error', 'Publish Web Album', '<p>' + esc(e.message) + '</p>'); return; }
    ctx.status('Published ' + a.name + '.');
    if (nd) {
      const v = await ctx.msg('info', 'Web Album Published', '<p>Your album <b>' + esc(a.name) + '</b> is now a web page in My Documents, with its own address:</p><p><tt>' + esc(displayUrl(nd.url)) + '</tt></p><p>It will turn up in HyperHound and may join a web ring.</p>', ['Visit It', 'OK']);
      if (v === 'Visit It') ctx.go(nd.url);
    }
  }
  /* ---------- go ---------- */
  if (route.album) { const a = albums.find(x => x.key === route.album); if (a) { openAlbum(a, true); if (route.show) slideshow(a.list, 0, a.name); } else home(); }
  else if (route.photo) {
    const d = S.docs.get(route.photo);
    const a = d && albums.find(x => x.dir === d.dir);
    if (a) { openAlbum(a, true); lightbox(a.list, a.list.indexOf(d)); } else home();
  } else if (route.q) { searchIn.value = route.q; search(route.q); }
  else home();
  return { title: route.photo ? phCaption(S.docs.get(route.photo)) + ' - Photo Album' : 'Photo Album' };
}
