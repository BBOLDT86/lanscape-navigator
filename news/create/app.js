/* The Watch · Create (#/create), the Scrolls product line inside the paper.
   news/index.html loads this file the first time someone opens Create, a desk that has a Create line, or a hobby page;
   it draws with the page's own helpers (T, esc, getJSON, go, view, LANG, LOC) and its look (Instrument Serif and Sans,
   navy and brass), so it reads as one paper. Data: create/catalog.json — the same file that builds Create · Home
   (create/index.html), the portfolio (create/portfolio/) and the build spec (create/spec/) through create/build.py.
   Routes: #/create (the line), #/create/<line>, #/create/p/<id>. Hooks: CREATE.desk(k) puts a band of the desk's
   tools at the top of its desk; CREATE.hobby(k) puts a hobby's own tool on its page. */
(() => {
'use strict';
const W = window.WATCH;
const { T, esc, getJSON, LANG } = W;
const $ = s => document.querySelector(s);
const C = { d: null, busy: null, cssOn: false };
const STATUS = { live: 'Live', building: 'In build', planned: 'Specified' };
const DESK_LINE = {}; // desk key → line, filled from the catalog
const DESK_NAMES = { hobbies: 'Hobbies', lifestyle: 'Lifestyle', home: 'Home', household: 'Household', food: 'Food', travel: 'Travel', cars: 'Cars', sports: 'Sports', health: 'Health' };
const EXTRA_DESKS = { food: 'home' }; // desks that share a line

/* ================= data ================= */
function ensure() {
  if (C.d) return Promise.resolve();
  if (!C.busy) C.busy = Promise.all([
    getJSON('create/catalog.json').then(d => { C.d = d; index(); }),
    LANG === 'en' || LANG === 'xx' ? null : getJSON('create/i18n.json').then(x => { const t = x && x[LANG]; if (t) for (const k in t) if (W.DICT.t[k] == null) W.DICT.t[k] = t[k]; }).catch(() => {}),
  ]).then(() => { C.busy = null; }, e => { C.busy = null; throw e; });
  return C.busy;
}
function index() {
  const d = C.d;
  C.lines = {}; for (const l of d.lines) { C.lines[l.k] = l; if (l.desk) DESK_LINE[l.desk] = l.k; }
  for (const k in EXTRA_DESKS) DESK_LINE[k] = EXTRA_DESKS[k];
  C.byId = {}; for (const p of d.products) C.byId[p.id] = p;
  C.byLine = {}; for (const l of d.lines) C.byLine[l.k] = d.products.filter(p => p.line === l.k);
  C.counts = { live: 0, building: 0, planned: 0 }; for (const p of d.products) C.counts[p.status]++;
}
const lineOf = p => C.lines[p.line];
const short = p => p.name.replace(/^Create · /, '');
function href(p) { // where a product opens, relative to news/
  if (p.status === 'live' && p.href) return p.href;
  if (p.status === 'building') return 'create/apps/' + p.id + '/';
  return null;
}
const dl = p => p.status === 'building' ? 'create/apps/' + p.id + '/index.html' : null;
const accent = c => ({ a: '#C2785C', b: '#5B7FA1', t: '#A9852F', green: '#3E9B8A', plum: '#7B6A8E' }[c] || '#A9852F');
const stBadge = p => `<span class="crst ${p.status}">${esc(T(STATUS[p.status]))}</span>`;
function openLink(p, cls) {
  const h = href(p); if (!h) return `<a class="${cls}" href="#/create/p/${esc(p.id)}">${esc(T('Read the spec'))} ›</a>`;
  const ext = h.startsWith('../') || h.startsWith('create/') || h.startsWith('lifestyle/');
  return `<a class="${cls}" href="${esc(h)}"${ext ? '' : ''}>${esc(T(p.status === 'live' ? 'Open' : 'Open the build'))} ›</a>`;
}
const PRINC_ICON = ['◫', '⇄', '◉', '✓'];

/* ================= pages ================= */
function render(p, keep) {
  css();
  if (!C.d) { $('#main').innerHTML = `<div class="wrap state"><h2>${T('Opening Create…')}</h2></div>`; ensure().then(() => { if (W.view.t === 'create') render(W.view.p, keep); }, () => { $('#main').innerHTML = `<div class="wrap state"><h2>${T('Create didn’t load')}</h2><p><a href="#/">${T('Front')}</a></p></div>`; }); return; }
  const parts = (p || '').split('/').filter(Boolean);
  if (!parts.length) overview();
  else if (parts[0] === 'p' && parts[1] && C.byId[parts[1]]) product(C.byId[parts[1]]);
  else if (C.lines[parts[0]]) line(C.lines[parts[0]]);
  else overview();
  if (!keep) window.scrollTo(0, 0);
}

function overview() {
  const d = C.d, n = d.products.length;
  const live = d.products.filter(p => p.status === 'live'), bld = d.products.filter(p => p.status === 'building');
  $('#main').innerHTML = `<div class="wrap mk cr">
    <section class="crhero">
      <div><p class="k">Scrolls · Create</p>
        <h1>${T('Free apps that sync phone to phone.')}</h1>
        <p class="d">${T('One HTML file each. No account, no server, no subscription: you open it and it works, offline too. To work with someone, you share a six-letter code and your two devices talk directly. Thirty-five of them, in nine lines, built around the desks of this paper.')}</p>
        <div class="crbtns"><a class="crb pri" href="../vision/">${T('Open Vision')}</a><a class="crb" href="create/">Create · Home</a><a class="crb" href="create/portfolio/">${T('Portfolio')}</a><a class="crb" href="create/spec/">${T('Build spec')}</a></div></div>
      <ul class="crstats"><li><b>${d.lines.length}</b><small>${T('lines')}</small></li><li><b>${n}</b><small>${T('products')}</small></li><li><b>${C.counts.live}</b><small>${T('live')}</small></li><li><b>${C.counts.building}</b><small>${T('in build')}</small></li><li><b>${C.counts.planned}</b><small>${T('specified')}</small></li><li><b>$0</b><small>${T('forever')}</small></li></ul>
    </section>

    <section class="blk"><div class="blk-h"><h2 class="sec-h">${T('Live now')}</h2></div>
      <div class="crlive">${live.map(p => tile(p)).join('')}</div></section>

    ${bld.length ? `<section class="blk"><div class="blk-h"><h2 class="sec-h">${T('In build this wave')}</h2></div><p class="sub2">${T('The Hobby and Relationships lines come first because their desks already had the readers. Each opens as a working file while it is brought through the gate.')}</p>
      <div class="crlive">${bld.map(p => tile(p)).join('')}</div></section>` : ''}

    <section class="blk"><div class="blk-h"><h2 class="sec-h">${T('The nine lines')}</h2></div>
      <div class="crlines">${d.lines.map(l => lineCard(l)).join('')}</div></section>

    <section class="blk crhow"><div class="blk-h"><h2 class="sec-h">${T('How it works')}</h2></div>
      <div class="crprin">${d.principles.map(([a, b], i) => `<div><span class="pi" aria-hidden="true">${PRINC_ICON[i] || '•'}</span><b>${esc(T(a))}</b><p>${esc(T(b))}</p></div>`).join('')}</div>
      <ol class="crcycle">
        <li><b>${T('A code')}</b>${T('On first run the product gives this browser a six-letter code. Show it, send it, or let the other person scan it.')}</li>
        <li><b>${T('Hello')}</b>${T('When the two devices connect, each sends the other everything it has. A device the product has never seen has to be let in.')}</li>
        <li><b>${T('Put')}</b>${T('After that, only what changed travels, field by field; the newer write of each field wins, so both of you can work offline.')}</li>
        <li><b>${T('The inbox')}</b>${T('Products hand things to each other through this browser, the way The Watch pins to Vision: a recipe’s ingredients to Pantry, a gift idea to Gift, an evening to Week.')}</li>
      </ol></section>

    <section class="blk"><div class="blk-h"><h2 class="sec-h">${T('Four waves')}</h2></div>
      <div class="crwaves">${d.roadmap.map(w => `<div><small>${esc(T(w.when))}</small><b>${esc(T(w.name))}</b><ul>${w.items.map(x => `<li>${esc(T(x))}</li>`).join('')}</ul></div>`).join('')}</div></section>

    <p class="adis">${T('Create is a Scrolls product line. Its catalog, this section, Create · Home and the two documents are built from one file, create/catalog.json, so they never disagree. The reference build is Vision, Rev 2; the engineering contract is the build spec.')} <a href="create/portfolio/">${T('Portfolio')}</a> · <a href="create/spec/">${T('Build spec')}</a> · <a href="https://github.com/BBOLDT86/lanscape-navigator/tree/main/news/create" target="_blank" rel="noopener">GitHub</a></p>
  </div>`;
  document.title = 'Create · The Watch';
}

function tile(p) {
  const l = lineOf(p), h = href(p);
  return `<a class="crtile" href="${esc(h || '#/create/p/' + p.id)}" style="--ac:${accent(p.c)}"><span class="ic">${esc(p.icon)}</span><span class="tx"><small>${esc(T(l.name))}</small><b>${esc(p.name)}</b><span>${esc(p.tag)}</span></span><span class="crgo2">${stBadge(p)}<em>${esc(T(h ? (p.status === 'live' ? 'Open' : 'Open the build') : 'Spec'))} ›</em></span></a>`;
}
function lineCard(l) {
  const ps = C.byLine[l.k], live = ps.filter(p => p.status === 'live').length;
  return `<a class="crline" href="#/create/${esc(l.k)}" style="--ac:${accent(l.c)}"><span class="ic">${esc(l.icon)}</span><span class="tx"><b>${esc(T(l.name))}</b><i>${esc(T(l.dek))}</i>
    <span class="chips">${ps.map(p => `<span class="chip ${p.status}">${esc(short(p))}</span>`).join('')}</span>
    <small>${T('{n} products', { n: ps.length })}${live ? ' · ' + T(live === 1 ? '{n} live' : '{n} live', { n: live }) : ''}${l.desk ? ' · ' + T('on the {desk} desk', { desk: T(DESK_NAMES[l.desk] || l.desk) }) : ''}</small></span></a>`;
}

function line(l) {
  const ps = C.byLine[l.k];
  $('#main').innerHTML = `<div class="wrap mk cr">
    <p class="crumb"><a href="#/create">Create</a></p>
    <div class="crlhero" style="--ac:${accent(l.c)}"><span class="ic">${esc(l.icon)}</span><div><h1>${esc(T(l.name))}</h1><p class="dk">${esc(T(l.dek))}</p><p>${esc(T(l.about))}</p>
      <div class="crsw">${l.desk ? `<a class="chip" href="#/s/${esc(l.desk)}">${T('The {desk} desk', { desk: T(DESK_NAMES[l.desk] || l.desk) })} ›</a>` : ''}${C.d.lines.filter(x => x.k !== l.k).map(x => `<a class="chip" href="#/create/${esc(x.k)}">${esc(T(x.name))}</a>`).join('')}</div></div></div>
    <div class="crcards">${ps.map(p => card(p)).join('')}</div>
    <p class="adis"><a href="#/create">${T('All of Create')}</a> · <a href="create/portfolio/#l-${esc(l.k)}">${T('This line in the portfolio')}</a></p>
  </div>`;
  document.title = T(l.name) + ' · Create · The Watch';
}
function card(p) {
  const sp = p.sync && C.d.syncPatterns[p.sync];
  return `<article class="crcard" id="p-${esc(p.id)}" style="--ac:${accent(p.c)}">
    <div class="hd"><span class="ic">${esc(p.icon)}</span><div><h3><a href="#/create/p/${esc(p.id)}">${esc(p.name)}</a></h3><p class="tag">“${esc(p.tag)}”</p></div>${stBadge(p)}</div>
    <p class="dsc">${esc(p.desc)}</p>
    <ul class="fn">${p.functions.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
    <div class="ft"><span class="meta">${sp ? esc(T(sp.name)) : ''}${p.key ? ` · <code>${esc(p.key)}</code>` : ''} · &lt; ${p.budget} KB</span>${openLink(p, 'crgo')}</div>
  </article>`;
}

function product(p) {
  const l = lineOf(p), sp = p.sync && C.d.syncPatterns[p.sync], h = href(p), d = dl(p);
  const others = C.byLine[l.k].filter(x => x.id !== p.id);
  $('#main').innerHTML = `<div class="wrap mk cr">
    <p class="crumb"><a href="#/create">Create</a> › <a href="#/create/${esc(l.k)}">${esc(T(l.name))}</a></p>
    <div class="crphero" style="--ac:${accent(p.c)}"><span class="ic">${esc(p.icon)}</span><div><p class="k">Scrolls · Create · ${esc(T(l.name))}</p><h1>${esc(p.name)}</h1><p class="tag">“${esc(p.tag)}”</p>
      <div class="crbtns">${h ? `<a class="crb pri" href="${esc(h)}">${esc(T(p.status === 'live' ? 'Open' : 'Open the build'))}</a>` : ''}${d ? `<a class="crb" href="${esc(d)}" download="create-${esc(p.id)}.html">${T('Download the file')}</a>` : ''}${p.model ? `<a class="crb" href="create/spec/#m-${esc(p.id)}">${T('Data model in the spec')}</a>` : ''}<a class="crb" href="create/portfolio/#p-${esc(p.id)}">${T('In the portfolio')}</a> ${stBadge(p)}</div></div></div>
    <p class="crdesc">${esc(p.desc)}</p>
    <div class="crtwo"><div><h2 class="sec-h">${T('Functions')}</h2><ul class="fn">${p.functions.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>
      <div><h2 class="sec-h">${T('Specs')}</h2><ul class="fn">${p.specs.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div></div>
    <section class="blk crbuilt"><h2 class="sec-h">${T('How it is built')}</h2>
      <dl>${sp ? `<div><dt>${T('Sync')}</dt><dd><b>${esc(T(sp.name))}</b> — ${esc(T(sp.how))} <i>${esc(T(sp.conflicts))}.</i></dd></div>` : ''}
        ${p.key ? `<div><dt>${T('Storage')}</dt><dd><code>${esc(p.key)}</code>${p.prefix ? ` · ${T('peer id')} <code>${esc(p.id === 'vision' ? p.prefix + '-' : 'create-' + p.prefix + '-')}&lt;code&gt;</code>` : ''}</dd></div>` : ''}
        <div><dt>${T('File')}</dt><dd><code>${esc(p.file)}</code> · ${T('under {n} KB gzipped', { n: p.budget })}${p.tech ? ' · ' + p.tech.map(esc).join(' · ') : ''}</dd></div>
        ${l.desk ? `<div><dt>${T('On The Watch')}</dt><dd><a href="#/s/${esc(l.desk)}">${T('The {desk} desk', { desk: T(DESK_NAMES[l.desk] || l.desk) })}</a>${p.hobbies ? ' · ' + p.hobbies.map(k => `<a href="#/hobby/${esc(k)}">${esc(T(k[0].toUpperCase() + k.slice(1)))}</a>`).join(', ') : ''}</dd></div>` : ''}
      </dl>
      ${p.model ? `<pre class="crmodel"><code>${esc(p.model.join('\n'))}</code></pre>` : ''}</section>
    ${others.length ? `<p class="crmore"><b>${T('Also in {line}', { line: T(l.name) })}:</b> ${others.map(x => `<a class="chip ${x.status}" href="#/create/p/${esc(x.id)}">${esc(short(x))}</a>`).join('')}</p>` : ''}
  </div>`;
  document.title = p.name + ' · Create · The Watch';
}

/* ================= bands on the desks and hobby pages ================= */
function band(lineK, opts = {}) {
  const l = C.lines[lineK], ps = opts.products || C.byLine[lineK];
  return `<section class="crband" style="--ac:${accent(l.c)}"><div class="crbh"><span class="k">Create · ${esc(T(l.name))}</span><b>${esc(T(opts.title || l.dek))}</b></div>
    <div class="crbl">${ps.map(p => { const h = href(p); return `<a class="crbp ${p.status}" href="${esc(h || '#/create/p/' + p.id)}" title="${esc(p.tag)}"><span class="ic">${esc(p.icon)}</span><span><b>${esc(short(p))}</b><small>${esc(T(STATUS[p.status]))}</small></span></a>`; }).join('')}
      <a class="crbp all" href="#/create/${esc(lineK)}"><span><b>${T('All of Create')}</b><small>${T('{n} free apps', { n: C.d.products.length })}</small></span></a></div></section>`;
}
async function desk(k) {
  css();
  try { await ensure(); } catch (e) { return; }
  if (W.view.t !== 'desk' || W.view.k !== k) return;
  const lineK = DESK_LINE[k]; if (!lineK) return;
  const host = document.querySelector('#main .wrap'); if (!host || host.querySelector('.crband')) return;
  const box = document.createElement('div'); box.innerHTML = band(lineK); const el = box.firstElementChild;
  const top = host.querySelector('.desk-top'), ph = host.querySelector('.page-h');
  if (top) { const shop = top.querySelector('.pl-st'); if (shop) shop.before(el); else top.append(el); } // above the desk's Finds row
  else if (ph) ph.after(el); else host.prepend(el);
}
async function hobby(k) {
  css();
  try { await ensure(); } catch (e) { return; }
  if (W.view.t !== 'hobby' || W.view.k !== k) return;
  const ps = C.d.products.filter(p => (p.hobbies || []).includes(k)); if (!ps.length) return;
  const host = document.querySelector('#main .wrap'); if (!host || host.querySelector('.crband')) return;
  const own = ps.find(p => p.id !== 'practice') || ps[0];
  const box = document.createElement('div'); box.innerHTML = band('hobby', { products: ps, title: T('Your tool for this: {name} — {tag}', { name: short(own), tag: own.tag }) });
  const hero = host.querySelector('.hobhero'); if (hero) hero.after(box.firstElementChild); else host.prepend(box.firstElementChild);
}

/* ================= the look ================= */
const CSS = `
.cr{padding-bottom:40px}
.cr .crumb a{color:var(--ink-2)}
.crhero{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:28px;background:#0E1A2B;color:#EEF1F4;border-radius:18px;padding:30px 32px;position:relative;overflow:hidden;margin-top:18px}
.crhero::after{content:"";position:absolute;right:-80px;bottom:-110px;width:300px;height:300px;border-radius:50%;border:30px solid rgba(214,178,94,.10);pointer-events:none}
.crhero .k{font:700 12.5px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:#D6B25E;margin:0 0 10px}
.crhero h1{font:400 46px/1.02 var(--serif);margin:0 0 12px;letter-spacing:-.01em}
.crhero .d{color:#B9C3CF;margin:0 0 18px;font-size:15.5px;max-width:60ch}
.crbtns{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.crb{display:inline-block;text-decoration:none;font:600 14px var(--sans);padding:9px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.22);color:#EEF1F4}
.crb:hover{background:rgba(255,255,255,.08)}
.crb.pri{background:#D6B25E;border-color:#D6B25E;color:#0E1A2B}.crb.pri:hover{background:#E3C47E}
.cr .crphero .crb,.cr .crphero .crb.pri{color:var(--ink);border-color:var(--rule)}.cr .crphero .crb.pri{background:var(--brass);border-color:var(--brass);color:#fff}
.crstats{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;align-self:center}
.crstats li{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 10px;text-align:center}
.crstats b{display:block;font:500 30px/1 var(--sans);letter-spacing:-.02em}.crstats small{display:block;margin-top:4px;font:600 11px var(--sans);text-transform:uppercase;letter-spacing:.06em;color:#9FB0C2}
.crlive{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.crtile{display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px 12px;text-decoration:none;color:inherit;background:var(--raise);border:1px solid var(--rule);border-radius:14px;padding:14px;position:relative;overflow:hidden}
.crtile::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ac)}
.crtile:hover{border-color:color-mix(in srgb,var(--ac) 50%,var(--rule))}
.crtile .ic,.crline .ic,.crcard .ic,.crlhero .ic,.crphero .ic,.crbp .ic{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:color-mix(in srgb,var(--ac) 16%,var(--raise));color:var(--ac);font-size:20px;flex:none}
.crtile .tx{display:flex;flex-direction:column;min-width:0}.crtile small{font:700 10.5px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.crtile b{font:400 20px/1.15 var(--serif);color:var(--ink)}.crtile .tx>span{font-size:13.5px;color:var(--ink-2);font-style:italic}
.crtile .crgo2{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;font:600 13px var(--sans);color:var(--brass-ink)}
.crst{display:inline-block;font:700 10.5px var(--sans);letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:5px;background:var(--shoal);color:var(--ink-2)}
.crst.live{background:rgba(62,155,138,.14);color:#2E7A6C}.crst.building{background:rgba(194,120,92,.14);color:#A4533B}
@media (prefers-color-scheme:dark){:root:not([data-theme="day"]) .crst.live{color:#7ED6C4}:root:not([data-theme="day"]) .crst.building{color:#F0A68E}}
:root[data-theme="night"] .crst.live{color:#7ED6C4}:root[data-theme="night"] .crst.building{color:#F0A68E}
.crlines{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.crline{display:flex;gap:14px;text-decoration:none;color:inherit;background:var(--raise);border:1px solid var(--rule);border-radius:16px;padding:16px}
.crline:hover{border-color:color-mix(in srgb,var(--ac) 50%,var(--rule))}
.crline .tx{display:flex;flex-direction:column;gap:6px;min-width:0}.crline b{font:400 24px/1.1 var(--serif)}.crline i{color:var(--ink-2);font-size:14px}
.crline small{color:var(--ink-3);font-size:12.5px}
.chips{display:flex;flex-wrap:wrap;gap:5px}
.cr .chip,.crline .chip{display:inline-block;font:600 12px var(--sans);padding:3px 9px;border-radius:999px;border:1px solid var(--rule);color:var(--ink-2);text-decoration:none;background:var(--raise)}
.cr .chip.live,.crline .chip.live{border-color:rgba(62,155,138,.5)}.cr .chip.building,.crline .chip.building{border-color:rgba(194,120,92,.55)}
.crprin{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:18px}
.crprin>div{background:var(--raise);border:1px solid var(--rule);border-radius:14px;padding:14px 16px}
.crprin .pi{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--shoal);color:var(--brass-ink);margin-bottom:8px;font-size:15px}
.crprin b{display:block;font:400 21px var(--serif);margin-bottom:4px}.crprin p{margin:0;color:var(--ink-2);font-size:14px}
.crcycle{list-style:none;counter-reset:c;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.crcycle li{counter-increment:c;position:relative;padding:14px 16px 14px 48px;background:var(--shoal);border-radius:14px;font-size:14px;color:var(--ink-2)}
.crcycle li::before{content:counter(c);position:absolute;left:14px;top:14px;width:24px;height:24px;border-radius:50%;background:var(--ink);color:var(--paper);font:700 12px/24px var(--sans);text-align:center}
.crcycle b{display:block;color:var(--ink);font:400 19px var(--serif);margin-bottom:2px}
.crwaves{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.crwaves>div{background:var(--raise);border:1px solid var(--rule);border-radius:14px;padding:14px 16px}
.crwaves small{font:700 11px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--brass-ink)}.crwaves b{display:block;font:400 20px var(--serif);margin:2px 0 6px}
.crwaves ul{margin:0;padding-left:16px;color:var(--ink-2);font-size:13.5px}.crwaves li{margin:2px 0}
.crlhero,.crphero{display:flex;gap:18px;align-items:flex-start;margin:6px 0 20px}
.crlhero .ic,.crphero .ic{width:64px;height:64px;font-size:30px;border-radius:16px}
.crlhero h1,.crphero h1{font:400 40px/1.05 var(--serif);margin:0 0 4px}.crlhero .dk{font-style:italic;color:var(--ink-2);margin:0 0 8px;font-size:16px}
.crlhero p,.crphero .tag{color:var(--ink-2);margin:0 0 10px;max-width:70ch}.crphero .k{font:700 12px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--brass-ink);margin:0 0 6px}
.crphero .tag{font-style:italic;font-size:17px}
.crsw{display:flex;flex-wrap:wrap;gap:6px}
.crcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
.crcard{background:var(--raise);border:1px solid var(--rule);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px;position:relative;overflow:hidden}
.crcard::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--ac)}
.crcard .hd{display:flex;gap:12px;align-items:flex-start}.crcard .hd>div{flex:1;min-width:0}.crcard h3{margin:0;font:400 23px/1.1 var(--serif)}.crcard h3 a{text-decoration:none;color:inherit}.crcard h3 a:hover{text-decoration:underline;text-underline-offset:4px}
.crcard .tag{margin:2px 0 0;font-style:italic;color:var(--ink-3);font-size:13.5px}.crcard .dsc{margin:0;color:var(--ink-2);font-size:14.5px}
.fn{margin:0;padding:0;list-style:none;columns:1}.fn li{position:relative;padding-left:14px;font-size:13.5px;color:var(--ink-2);margin:2px 0}.fn li::before{content:"›";position:absolute;left:0;color:var(--brass);font-weight:700}
.crcard .ft{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:8px;padding-top:10px;border-top:1px solid var(--rule);font-size:12px;color:var(--ink-3)}
.crcard code,.crbuilt code{font-size:12px;background:var(--shoal);padding:1px 5px;border-radius:4px}
.crgo{font:600 13px var(--sans);color:var(--brass-ink);text-decoration:none;white-space:nowrap}.crgo:hover{text-decoration:underline}
.crdesc{font-size:17px;color:var(--ink-2);max-width:72ch}
.crtwo{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:10px 0 20px}
.crbuilt dl{margin:0 0 12px;display:grid;gap:8px}.crbuilt dl>div{display:grid;grid-template-columns:110px minmax(0,1fr);gap:10px;font-size:14px;color:var(--ink-2)}
.crbuilt dt{font:700 11.5px var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);padding-top:3px}.crbuilt dd{margin:0}.crbuilt dd i{color:var(--ink-3)}
.crmodel{background:#1a1815;color:#d4c8b0;border-radius:10px;padding:14px 16px;overflow-x:auto;font:400 12.5px/1.55 ui-monospace,Menlo,Consolas,monospace;margin:0}
.crmore{margin:18px 0 0;font-size:14px;color:var(--ink-2);display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.crband{margin:14px 0 6px;background:var(--raise);border:1px solid var(--rule);border-radius:16px;padding:12px 14px;position:relative;overflow:hidden}
.crband::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ac)}
.crbh{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;margin:0 0 8px 8px}.crbh .k{font:700 11px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--brass-ink)}.crbh b{font:400 17px var(--serif);color:var(--ink)}
.crbl{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 0 2px 8px}.crbl::-webkit-scrollbar{display:none}
.crbp{flex:none;display:flex;align-items:center;gap:9px;text-decoration:none;color:inherit;border:1px solid var(--rule);border-radius:12px;padding:7px 11px 7px 7px;background:var(--paper);min-width:140px}
.crbp .ic{width:32px;height:32px;font-size:15px;border-radius:9px}.crbp b{display:block;font:600 14px var(--sans);color:var(--ink)}.crbp small{display:block;font:600 10.5px var(--sans);text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3)}
.crbp.live small{color:#2E7A6C}.crbp.building small{color:#A4533B}.crbp.all{border-style:dashed}.crbp:hover{border-color:var(--brass)}
@media (prefers-color-scheme:dark){:root:not([data-theme="day"]) .crbp.live small{color:#7ED6C4}:root:not([data-theme="day"]) .crbp.building small{color:#F0A68E}}
@media (max-width:760px){.crhero{grid-template-columns:1fr;padding:22px 18px}.crhero h1{font-size:34px}.crstats{grid-template-columns:repeat(3,1fr)}.crstats b{font-size:24px}
  .crtwo{grid-template-columns:1fr}.crlhero h1,.crphero h1{font-size:32px}.crlhero,.crphero{gap:12px}.crlhero .ic,.crphero .ic{width:48px;height:48px;font-size:24px}
  .crbuilt dl>div{grid-template-columns:1fr;gap:2px}.crcards{grid-template-columns:1fr}}`;
function css() { if (C.cssOn) return; C.cssOn = true; const s = document.createElement('style'); s.id = 'create-css'; s.textContent = CSS; document.head.appendChild(s); }

/* ================= hooks for the page ================= */
window.CREATE = { render: (p, keep) => render(p, keep), desk, hobby, ensure };
})();
