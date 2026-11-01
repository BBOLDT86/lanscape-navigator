/* The Watch · Primer (#/primer): three-minute visual lessons, in the spirit of the micro-learning apps.
   news/index.html loads this file the first time someone opens Primer or a desk that carries a Primer band; the same
   file runs the standalone page (news/primer/index.html), which can be added to a phone's home screen. It draws with
   the paper's own helpers (T, esc, view, LANG) and its look (Instrument Serif and Sans, navy and brass).
   Data: primer/lessons.js (window.PRIMER_DATA), built by primer/build.py from primer/src/*.json: 50 lessons, each a
   deck of cards with a headline, a few sentences and a visual the player draws as SVG (a chart, a timeline, a flow,
   a gauge…), then a short quiz, the takeaways and the sources.
   Routes: #/primer (the hub), #/primer/c/<category>, #/primer/l/<lesson> (opens the player). The standalone page
   uses the same paths without "primer": #/, #/c/<category>, #/l/<lesson>.
   Hooks: PRIMER.render(p), PRIMER.desk(k) puts a band of the desk's lessons at the top of a desk.
   Progress (lessons finished, where you left off, quiz scores, the days you learned) stays in this browser as
   localStorage "primer.v1". */
(() => {
'use strict';
const W = window.WATCH;
const { T, esc } = W;
const $ = s => document.querySelector(s);
const STAND = !!W.standalone; // the standalone page, or inside the paper
const BASE = STAND ? '' : 'primer/';
const link = p => (STAND ? '#/' : '#/primer') + (p ? (STAND ? '' : '/') + p : '');
const KEY = 'primer.v1';
const P = { d: null, busy: null, cssOn: false, play: null, byId: {}, cats: {} };
const DESK_CATS = { household: ['household', 'money'], home: ['household'], food: ['kitchen'], health: ['health'], lifestyle: ['life'],
  culture: ['culture', 'history'], science: ['science'], hobbies: ['life', 'culture'], politics: ['society', 'history'], business: ['money', 'society'], tech: ['science'] };

/* ================= progress ================= */
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return { done: s.done || {}, pos: s.pos || {}, quiz: s.quiz || {}, days: s.days || {} }; }
  catch (e) { return { done: {}, pos: {}, quiz: {}, days: {} }; }
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } }
const isoDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function touchDay() { const k = isoDay(); S.days[k] = (S.days[k] || 0) + 1; }
function streak() { // days in a row with at least one card read, counting today or yesterday back
  let n = 0; const d = new Date();
  if (!S.days[isoDay(d)]) d.setDate(d.getDate() - 1);
  while (S.days[isoDay(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const cardsRead = () => Object.values(S.days).reduce((a, b) => a + b, 0);

/* ================= data ================= */
function ensure() {
  if (P.d) return Promise.resolve();
  if (!P.busy) P.busy = new Promise((ok, no) => {
    const take = () => { P.d = window.PRIMER_DATA; index(); P.busy = null; ok(); };
    if (window.PRIMER_DATA) return take();
    const v = Math.floor(Date.now() / 600000);
    const add = (u, next) => { const s = document.createElement('script'); s.src = u + '?v=' + v; s.onload = take; s.onerror = next; document.head.appendChild(s); };
    add(BASE + 'lessons.js', () => add((W.PUBLIC || '') + 'primer/lessons.js', () => { P.busy = null; no(new Error('primer/lessons.js did not load')); }));
  });
  return P.busy;
}
function index() {
  P.byId = {}; for (const t of P.d.topics) P.byId[t.id] = t;
  P.cats = {}; for (const c of P.d.cats) { P.cats[c.k] = c; c.topics = P.d.topics.filter(t => t.cat === c.k); }
}
const catOf = t => P.cats[t.cat];
const color = t => t.color || catOf(t).color;
const mins = t => Math.max(2, Math.round(t.slides.reduce((n, s) => n + words(s.p) + 10, 0) / 170 + t.quiz.length * 0.4));
const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const dayHash = s => { let h = Math.floor(Date.now() / 864e5); for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return h >>> 0; };
function todays() { // the lesson of the day: one you haven't finished, picked by the date
  const open = P.d.topics.filter(t => !S.done[t.id]), pool = open.length ? open : P.d.topics;
  return pool[dayHash('primer') % pool.length];
}
function nextAfter(t) { // after a lesson: an unfinished one in its category, then any unfinished, then the next in order
  const open = catOf(t).topics.filter(x => x.id !== t.id && !S.done[x.id]);
  if (open.length) return open[0];
  const any = P.d.topics.filter(x => x.id !== t.id && !S.done[x.id]);
  if (any.length) return any[dayHash(t.id) % any.length];
  const i = P.d.topics.indexOf(t); return P.d.topics[(i + 1) % P.d.topics.length];
}
const nDone = () => P.d.topics.filter(t => S.done[t.id]).length;
const total = t => t.slides.length + t.quiz.length + 2; // cover, cards, quiz, the last card

/* ================= the hub ================= */
function render(p, keep) {
  css();
  if (!P.d) {
    $('#main').innerHTML = `<div class="wrap state"><h2>${T('Opening Primer…')}</h2></div>`;
    ensure().then(() => { if (STAND || W.view.t === 'primer') render(STAND ? curHash() : W.view.p, keep); },
      () => { $('#main').innerHTML = `<div class="wrap state"><h2>${T('Primer didn’t load')}</h2><p><a href="${STAND ? '../' : '#/'}">${T('Front')}</a></p></div>`; });
    return;
  }
  const parts = (p || '').split('/').filter(Boolean);
  if (parts[0] === 'l' && P.byId[parts[1]]) { if (!$('#main .pr')) hub(); open(parts[1]); return; }
  close(false);
  hub(parts[0] === 'c' && P.cats[parts[1]] ? parts[1] : null);
}
function curHash() { return decodeURIComponent(location.hash.replace(/^#\/?/, '')); }
function hub(cat) {
  const td = todays(), done = nDone(), st = streak(), read = cardsRead();
  const cont = P.d.topics.filter(t => !S.done[t.id] && S.pos[t.id] > 0).sort((a, b) => (S.pos[b.id] || 0) - (S.pos[a.id] || 0)).slice(0, 4);
  const list = cat ? P.cats[cat].topics : P.d.topics;
  $('#main').innerHTML = `<div class="wrap pr">
    ${STAND ? '' : `<p class="crumb"><a href="#/">${T('Front')}</a> › <a href="#/s/household">${T('Life')}</a> › Primer</p>`}
    <section class="prhero" style="--c:${color(td)}">
      <div class="prht">
        <p class="k">Primer · ${T('The Watch')}</p>
        <h1>${T('Learn something in three minutes.')}</h1>
        <p class="d">${T('{n} short visual lessons on how the house, the money, the body, history and the wider world work: a deck of cards each, a picture on every card, a quick quiz at the end, and a sense of progress. Tap through, or press play and let it run like a short film.', { n: P.d.topics.length })}</p>
        <div class="prbtns"><a class="prb pri" href="${link('l/' + td.id)}">▶ ${T('Today’s lesson')}</a><button type="button" class="prb" data-pr-random>${T('Surprise me')}</button>${STAND ? `<a class="prb" href="../">${T('The Watch')}</a>` : ''}</div>
      </div>
      <a class="prtoday" href="${link('l/' + td.id)}">
        <span class="ic">${esc(td.icon)}</span>
        <span class="tx"><small>${T('Lesson of the day')} · ${esc(T(catOf(td).name))}</small><b>${esc(td.title)}</b><span>${esc(td.dek)}</span><i>${T('{n} cards · {m} min', { n: total(td), m: mins(td) })}</i></span>
      </a>
    </section>
    <ul class="prstats">
      <li><b>${done}<small>/${P.d.topics.length}</small></b><span>${T('lessons finished')}</span><i style="--p:${Math.round(done / P.d.topics.length * 100)}%"></i></li>
      <li><b>${st}</b><span>${T(st === 1 ? 'day streak' : 'day streak')}</span></li>
      <li><b>${read}</b><span>${T('cards read')}</span></li>
      <li><b>${Object.values(S.quiz).filter(q => q && q.n).reduce((a, q) => a + q.ok, 0)}</b><span>${T('quiz answers right')}</span></li>
    </ul>
    ${cont.length ? `<section class="prsec"><h2 class="sec-h">${T('Pick up where you left off')}</h2><div class="prcont">${cont.map(t => tile(t, true)).join('')}</div></section>` : ''}
    <section class="prsec">
      <div class="prsh"><h2 class="sec-h">${cat ? esc(T(P.cats[cat].name)) : T('All lessons')}</h2>${cat ? `<p class="note">${esc(T(P.cats[cat].dek))}</p>` : `<p class="note">${T('Nine shelves. New lessons are added as they’re written.')}</p>`}</div>
      <div class="prchips"><a class="chip${cat ? '' : ' on'}" href="${link('')}">${T('All')} <small>${P.d.topics.length}</small></a>${P.d.cats.map(c => `<a class="chip${cat === c.k ? ' on' : ''}" href="${link('c/' + c.k)}" style="--c:${c.color}"><i></i>${esc(T(c.name))} <small>${c.topics.length}</small></a>`).join('')}</div>
      <div class="prgrid">${list.map(t => tile(t)).join('')}</div>
    </section>
    <p class="prfoot">${T('Written by Claude, with the sources on each lesson’s last card; a lesson is a start, not the last word. Your progress stays in this browser. Want a topic?')} <a href="https://github.com/BBOLDT86/lanscape-navigator/issues/new?title=Primer+topic%3A+&body=A+lesson+I%27d+like%3A+" target="_blank" rel="noopener">${T('Suggest one')} ›</a></p>
  </div>`;
  const r = $('[data-pr-random]'); if (r) r.onclick = () => { const open = P.d.topics.filter(t => !S.done[t.id]), pool = open.length ? open : P.d.topics; location.hash = link('l/' + pool[Math.floor(Math.random() * pool.length)].id); };
}
function tile(t, cont) {
  const d = S.done[t.id], pos = S.pos[t.id] || 0, n = total(t), c = catOf(t);
  return `<a class="prtile${d ? ' done' : ''}" href="${link('l/' + t.id)}" style="--c:${color(t)}">
    <span class="ic">${esc(t.icon)}${d ? '<em>✓</em>' : ''}</span>
    <span class="tx"><small>${esc(T(c.name))}</small><b>${esc(t.title)}</b><span>${esc(t.dek)}</span>
    <i>${d ? T('Finished') + (S.quiz[t.id] ? ` · ${S.quiz[t.id].ok}/${S.quiz[t.id].n}` : '') : cont || pos ? T('{n} of {m} cards', { n: pos, m: n }) : T('{n} cards · {m} min', { n, m: mins(t) })}</i>
    ${!d && pos ? `<u style="--p:${Math.round(pos / n * 100)}%"></u>` : ''}</span></a>`;
}

/* ================= the player ================= */
function open(id, at) {
  const t = P.byId[id]; if (!t) return;
  if (P.play && P.play.t === t) return;
  close(false);
  const n = total(t), start = at != null ? at : Math.min(S.pos[id] || 0, n - 2);
  const el = document.createElement('div'); el.id = 'prplay'; el.className = 'prplay'; el.style.setProperty('--c', color(t));
  el.innerHTML = `<div class="prbar"><div class="prseg">${Array.from({ length: n }, (_, i) => `<i${i < start ? ' class="on"' : ''}></i>`).join('')}</div>
      <div class="prtop"><span class="prtt">${esc(T(catOf(t).name))} · ${esc(t.title)}</span>
      <button type="button" class="prpb" data-act="play" aria-label="${T('Play: move on by itself')}" aria-pressed="false">▶</button>
      <button type="button" class="prpb" data-act="close" aria-label="${T('Close')}">✕</button></div></div>
    <div class="prstage"><div class="prcardwrap"></div></div>
    <div class="prnav"><button type="button" class="prn" data-act="prev" aria-label="${T('Back')}">‹</button><span class="prhint">${T('Tap for the next card')}</span><button type="button" class="prn" data-act="next" aria-label="${T('Next')}">›</button></div>`;
  document.body.appendChild(el);
  document.documentElement.classList.add('prlock');
  P.play = { t, i: start, el, auto: false, timer: null, answered: {}, score: { ok: 0, n: 0 } };
  if (S.quiz[id] && !S.done[id]) P.play.score = { ok: 0, n: 0 };
  el.addEventListener('click', onClick);
  let tx = null, ty = null;
  el.addEventListener('touchstart', e => { const p = e.changedTouches[0]; tx = p.clientX; ty = p.clientY; }, { passive: true });
  el.addEventListener('touchend', e => { if (tx == null) return; const p = e.changedTouches[0], dx = p.clientX - tx, dy = p.clientY - ty; tx = null; if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) { if (dx < 0) step(1); else step(-1); } }, { passive: true });
  document.addEventListener('keydown', onKey);
  if (STAND) document.title = `${t.title} · Primer`;
  show();
}
function close(nav) {
  if (!P.play) return;
  clearTimeout(P.play.timer);
  P.play.el.remove(); P.play = null;
  document.documentElement.classList.remove('prlock');
  document.removeEventListener('keydown', onKey);
  if (STAND) document.title = 'Primer · The Watch';
  if (nav !== false) { const h = link(''); if (location.hash !== h && location.hash !== h + '/') location.hash = h; else render(''); }
}
function onKey(e) {
  if (!P.play) return;
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); step(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  else if (e.key === 'Escape') close();
  else if (e.key === 'p' || e.key === 'P') toggle();
}
function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (b) { const a = b.dataset.act; if (a === 'close') close(); else if (a === 'play') toggle(); else if (a === 'next') step(1); else if (a === 'prev') step(-1); else if (a === 'again') { P.play.i = 0; P.play.score = { ok: 0, n: 0 }; P.play.answered = {}; show(); } return; }
  const q = e.target.closest('.pqo'); if (q) { answer(q); return; }
  if (e.target.closest('a, button, .pqwhy, .prfin')) return;
  const st = e.target.closest('.prstage'); if (!st) return;
  const r = st.getBoundingClientRect(); step(e.clientX - r.left < r.width * 0.3 ? -1 : 1);
}
function toggle() {
  const p = P.play; p.auto = !p.auto;
  const b = p.el.querySelector('[data-act="play"]'); b.textContent = p.auto ? '❚❚' : '▶'; b.setAttribute('aria-pressed', String(p.auto));
  p.el.classList.toggle('auto', p.auto);
  arm();
}
function arm() { // in play mode, move on after the card has had its time; the active segment fills meanwhile
  const p = P.play; clearTimeout(p.timer);
  const seg = p.el.querySelectorAll('.prseg i')[p.i]; if (!seg) return;
  seg.style.removeProperty('--d'); seg.classList.remove('run'); void seg.offsetWidth;
  if (!p.auto) return;
  const kind = kindAt(p.i); if (kind === 'quiz' || kind === 'end') return;
  const s = kind === 'cover' ? 4 : Math.min(22, Math.max(7, 3 + words(p.t.slides[p.i - 1].p) / 2.6));
  seg.style.setProperty('--d', s + 's'); seg.classList.add('run');
  p.timer = setTimeout(() => step(1), s * 1000);
}
function kindAt(i) { const t = P.play.t; return i === 0 ? 'cover' : i <= t.slides.length ? 'card' : i <= t.slides.length + t.quiz.length ? 'quiz' : 'end'; }
function step(d) {
  const p = P.play; if (!p) return;
  const n = total(p.t), j = p.i + d;
  if (j < 0) return;
  if (j >= n) { close(); return; }
  if (d > 0 && kindAt(p.i) === 'quiz' && !p.answered[p.i]) { const o = p.el.querySelector('.pq'); if (o) { o.classList.remove('nudge'); void o.offsetWidth; o.classList.add('nudge'); } return; }
  p.i = j; show(d);
}
function show(dir) {
  const p = P.play, t = p.t, i = p.i, k = kindAt(i), n = total(t);
  p.el.querySelectorAll('.prseg i').forEach((s, j) => { s.classList.toggle('on', j < i); s.classList.toggle('cur', j === i); });
  const wrap = p.el.querySelector('.prcardwrap');
  let html = '';
  if (k === 'cover') html = cover(t);
  else if (k === 'card') html = card(t, t.slides[i - 1], i, t.slides.length);
  else if (k === 'quiz') html = quiz(t, t.quiz[i - 1 - t.slides.length], i - t.slides.length, t.quiz.length);
  else html = fin(t);
  wrap.innerHTML = `<article class="prcard ${k}${dir < 0 ? ' back' : ''}" style="--c:${color(t)}">${html}</article>`;
  const hint = p.el.querySelector('.prhint');
  hint.textContent = k === 'cover' ? T('Tap to begin') : k === 'quiz' ? (p.answered[i] ? T('Next ›') : T('Pick an answer')) : k === 'end' ? '' : T('Tap for the next card');
  p.el.querySelector('[data-act="prev"]').disabled = i === 0;
  if (k === 'card' || k === 'quiz') { if ((S.pos[t.id] || 0) < i) S.pos[t.id] = i; touchDay(); save(); }
  if (k === 'end' && !S.done[t.id]) { S.done[t.id] = isoDay(); S.pos[t.id] = n - 1; if (p.score.n) S.quiz[t.id] = { ok: p.score.ok, n: p.score.n }; save(); }
  else if (k === 'end' && p.score.n) { S.quiz[t.id] = { ok: p.score.ok, n: p.score.n }; save(); }
  arm();
  const st = p.el.querySelector('.prstage'); st.scrollTop = 0;
}
function cover(t) {
  return `<div class="prcover"><span class="ic">${esc(t.icon)}</span><p class="k">${esc(T(catOf(t).name))} · ${T('{n} cards · {m} min', { n: total(t), m: mins(t) })}</p>
    <h2>${esc(t.title)}</h2><p class="dek">${esc(t.dek)}</p><p class="prgo">${T('Tap, swipe or press → to begin. ▶ plays it through by itself.')}</p></div>`;
}
function card(t, s, i, n) {
  return `<p class="k"><span>${esc(T(catOf(t).name))}</span><span>${i}/${n}</span></p><h2>${esc(s.h)}</h2><div class="prv">${vis(s.v)}</div><p class="body">${esc(s.p)}</p>`;
}
function quiz(t, q, i, n) {
  const p = P.play, done = p.answered[p.i];
  return `<p class="k"><span>${T('Quiz')}</span><span>${i}/${n}</span></p><h2>${esc(q.q)}</h2>
    <div class="pq">${q.a.map((a, j) => `<button type="button" class="pqo${done ? (j === q.c ? ' ok' : j === done.pick ? ' no' : ' off') : ''}" data-j="${j}"${done ? ' disabled' : ''}><i>${'ABCD'[j]}</i><span>${esc(a)}</span></button>`).join('')}</div>
    <div class="pqwhy"${done ? '' : ' hidden'}><b>${done ? (done.pick === q.c ? T('Right.') : T('Not quite.')) : ''}</b> ${esc(q.why)}<br><button type="button" class="prb pri sm" data-act="next">${T('Next')} ›</button></div>`;
}
function answer(btn) {
  const p = P.play, q = p.t.quiz[p.i - 1 - p.t.slides.length], j = +btn.dataset.j;
  if (p.answered[p.i]) return;
  p.answered[p.i] = { pick: j }; p.score.n++; if (j === q.c) p.score.ok++;
  show();
}
function fin(t) {
  const p = P.play, nx = nextAfter(t), sc = p.score;
  const url = (STAND ? location.href.split('#')[0] : (W.PUBLIC || '') + 'primer/') + '#/l/' + t.id;
  return `<div class="prfin"><span class="badge">✓</span><p class="k">${T('Lesson finished')}</p><h2>${esc(t.title)}</h2>
    ${sc.n ? `<p class="score">${T('{ok} of {n} quiz answers right', { ok: sc.ok, n: sc.n })}${sc.ok === sc.n ? ' · ' + T('perfect') : ''}</p>` : ''}
    <h3>${T('Remember')}</h3><ul class="take">${t.take.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3>${T('Read more')}</h3><ul class="src">${t.src.map(([n, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join('')}</ul>
    <div class="prbtns"><a class="prb pri" href="${link('l/' + nx.id)}" data-next>${esc(nx.icon)} ${T('Next: {title}', { title: esc(nx.title) })}</a><a class="prb" href="${link('')}">${T('All lessons')}</a><button type="button" class="prb" data-act="again">${T('Again')}</button><button type="button" class="prb" data-share="${esc(url)}" data-title="${esc(t.title)}">${T('Share')}</button></div>
    <p class="fine">${T('Written by Claude from the sources above. Checked for a general reader; not advice for your own situation.')}</p></div>`;
}
document.addEventListener('click', async e => {
  const s = e.target.closest('[data-share]'); if (!s) return;
  const d = { title: s.dataset.title + ' · Primer', text: T('A three-minute lesson from The Watch: {t}', { t: s.dataset.title }), url: s.dataset.share };
  try { if (navigator.share) await navigator.share(d); else { await navigator.clipboard.writeText(d.url); s.textContent = T('Link copied'); } } catch (err) { /* cancelled */ }
});
document.addEventListener('click', e => { // a lesson link while the player is open: swap lessons without leaving
  const a = e.target.closest('#prplay a[data-next]'); if (!a) return;
  e.preventDefault(); const id = a.getAttribute('href').split('/l/')[1]; close(false); location.hash = link('l/' + id);
});

/* ================= the visuals: each card's picture, drawn as SVG from a few fields ================= */
const WIDE = 320, TALL = 200;
const svg = (inner, h = TALL) => `<svg viewBox="0 0 ${WIDE} ${h}" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const tx = (x, y, s, cls = '', extra = '') => `<text x="${x}" y="${y}" class="${cls}" ${extra}>${esc(String(s))}</text>`;
function wrap(s, max) { // words into lines of at most max characters
  const out = []; let line = '';
  for (const w of String(s).split(/\s+/)) { if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); }
  if (line) out.push(line); return out;
}
function lines(x, y, s, max, lh, cls = '', extra = '', most = 3) {
  const ls = wrap(s, max); if (ls.length > most) { ls.length = most; ls[most - 1] = ls[most - 1].replace(/\s+\S*$/, '') + '…'; }
  return `<text x="${x}" y="${y}" class="${cls}" ${extra}>${ls.map((l, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${esc(l)}</tspan>`).join('')}</text>`;
}
const SHADES = ['var(--vis)', 'color-mix(in srgb,var(--vis) 72%,var(--paper))', 'color-mix(in srgb,var(--vis) 48%,var(--paper))', 'color-mix(in srgb,var(--vis) 28%,var(--paper))', 'var(--ink-3)', 'var(--ink-2)', 'color-mix(in srgb,var(--ink-3) 50%,var(--paper))'];
const shade = i => SHADES[i % SHADES.length];
const fmt = v => typeof v === 'number' ? (Math.abs(v) >= 1000 ? v.toLocaleString('en-US') : String(v)) : v;
const V = {
  big(v) {
    const n = String(v.n), fs = n.length > 7 ? 38 : n.length > 4 ? 52 : 68;
    return svg(`${v.sub ? tx(160, 38, v.sub, 'k', 'text-anchor="middle"') : ''}${tx(160, 118, n, 'huge', `text-anchor="middle" style="font-size:${fs}px"`)}${lines(160, 150, v.c, 44, 17, 'cap', 'text-anchor="middle"', 2)}`);
  },
  bars(v) {
    const items = v.items, max = v.max || Math.max(...items.map(x => +x[1])), n = items.length, rh = Math.min(34, (TALL - 10) / n), bh = Math.min(20, rh * 0.62), x0 = 112, w = WIDE - x0 - 48;
    return svg(items.map((it, i) => { const y = 8 + i * rh, bw = Math.max(2, (+it[1] / max) * w);
      return `${tx(x0 - 8, y + bh / 2 + 4, it[0], 'lbl', 'text-anchor="end"')}<rect x="${x0}" y="${y}" width="${bw}" height="${bh}" rx="${Math.min(5, bh / 2)}" fill="${shade(it[3] != null ? it[3] : 0)}"/>${tx(x0 + bw + 6, y + bh / 2 + 4, (it[2] != null ? it[2] : fmt(it[1]) + (v.unit || '')), 'val')}`; }).join(''), Math.max(90, 16 + n * rh));
  },
  cols(v) {
    const items = v.items, max = v.max || Math.max(...items.map(x => +x[1])), n = items.length, gap = 10, cw = (WIDE - 30 - gap * (n - 1)) / n, base = TALL - 28, top = 30;
    return svg(items.map((it, i) => { const h = Math.max(2, (+it[1] / max) * (base - top)), x = 15 + i * (cw + gap), y = base - h;
      return `<rect x="${x}" y="${y}" width="${cw}" height="${h}" rx="4" fill="${shade(it[3] != null ? it[3] : 0)}"/>${tx(x + cw / 2, y - 6, it[2] != null ? it[2] : fmt(it[1]) + (v.unit || ''), 'val', 'text-anchor="middle"')}${tx(x + cw / 2, base + 16, it[0], 'lbl', 'text-anchor="middle"')}`; }).join('') + `<line x1="10" y1="${base}" x2="${WIDE - 10}" y2="${base}" class="axis"/>`);
  },
  line(v) {
    const all = [...v.pts, ...(v.pts2 || [])], xs = all.map(p => p[0]), ys = all.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(0, ...ys), y1 = Math.max(...ys) * 1.05 || 1;
    const X = x => 34 + (x - x0) / ((x1 - x0) || 1) * (WIDE - 60), Y = y => TALL - 28 - (y - y0) / ((y1 - y0) || 1) * (TALL - 56);
    const path = pts => pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ');
    const end = (pts, cls) => { const p = pts[pts.length - 1]; return `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4" class="${cls}"/>`; };
    const rising = v.pts[v.pts.length - 1][1] >= v.pts[0][1]; // a rising curve leaves the top-left clear; a falling one the top-right
    const lx = rising ? 40 : WIDE - 14, anchor = rising ? 'start' : 'end', ly = v.yl && rising ? 30 : 16;
    const key = (txt, cls, y) => txt ? `<line x1="${rising ? lx : lx - 22}" y1="${y - 4}" x2="${rising ? lx + 22 : lx}" y2="${y - 4}" class="${cls}"/>${tx(rising ? lx + 28 : lx - 28, y, txt, 'val ' + (cls === 'l1' ? 'c1' : 'c2'), `text-anchor="${anchor}"`)}` : '';
    return svg(`<line x1="30" y1="${TALL - 28}" x2="${WIDE - 14}" y2="${TALL - 28}" class="axis"/><line x1="30" y1="14" x2="30" y2="${TALL - 28}" class="axis"/>
      ${v.pts2 ? `<path d="${path(v.pts2)}" class="l2"/>${end(v.pts2, 'd2')}` : ''}<path d="${path(v.pts)}" class="l1"/>${end(v.pts, 'd1')}
      ${key(v.l1, 'l1', ly)}${key(v.l2, 'l2', ly + 16)}
      ${v.xl ? tx(WIDE - 14, TALL - 10, v.xl, 'lbl', 'text-anchor="end"') : ''}${v.yl ? tx(34, 11, v.yl, 'lbl') : ''}
      ${tx(34, TALL - 12, String(x0), 'lbl', 'text-anchor="middle"')}${v.xl ? '' : tx(WIDE - 26, TALL - 12, String(x1), 'lbl', 'text-anchor="middle"')}`);
  },
  steps(v) {
    const n = v.items.length, rh = Math.min(44, (TALL - 8) / n), h = 8 + n * rh;
    return svg(`<line x1="22" y1="${rh / 2 + 4}" x2="22" y2="${h - rh / 2 - 4}" class="rail"/>` + v.items.map((it, i) => { const y = 4 + i * rh + rh / 2;
      return `<circle cx="22" cy="${y}" r="12" fill="var(--vis)"/>${tx(22, y + 4, i + 1, 'num', 'text-anchor="middle"')}${lines(44, y + (wrap(it, 44).length > 1 ? -2 : 4), it, 44, 14, 'item', '', 2)}`; }).join(''), Math.max(100, h));
  },
  compare(v) {
    const col = (c, x, i) => { const [t, ...items] = c; return `<rect x="${x}" y="6" width="${WIDE / 2 - 14}" height="26" rx="7" fill="${i ? 'var(--ink-3)' : 'var(--vis)'}"/>${tx(x + (WIDE / 2 - 14) / 2, 24, t, 'num', 'text-anchor="middle"')}` +
      items.map((it, j) => `${tx(x + 4, 56 + j * 30, '›', 'bul')}${lines(x + 16, 56 + j * 30, it, 22, 13, 'item', '', 2)}`).join(''); };
    const n = Math.max(v.a.length, v.b.length) - 1;
    return svg(col(v.a, 8, 0) + col(v.b, WIDE / 2 + 6, 1), Math.max(120, 50 + n * 30));
  },
  timeline(v) {
    const n = v.items.length, rh = Math.min(38, (TALL - 8) / n), h = 8 + n * rh, x = 86;
    return svg(`<line x1="${x}" y1="${rh / 2 + 4}" x2="${x}" y2="${h - rh / 2 - 4}" class="rail"/>` + v.items.map((it, i) => { const y = 4 + i * rh + rh / 2;
      return `<circle cx="${x}" cy="${y}" r="6" fill="var(--vis)"/>${tx(x - 14, y + 4, it[0], 'when', 'text-anchor="end"')}${lines(x + 16, y + (wrap(it[1], 36).length > 1 ? -2 : 4), it[1], 36, 13, 'item', '', 2)}`; }).join(''), Math.max(100, h));
  },
  donut(v) {
    const r = 64, c = 2 * Math.PI * r; let acc = 0;
    const arcs = v.parts.map((p, i) => { const d = p[1] / 100 * c, s = `<circle cx="96" cy="100" r="${r}" fill="none" stroke="${shade(i)}" stroke-width="30" stroke-dasharray="${d} ${c - d}" stroke-dashoffset="${-acc}" transform="rotate(-90 96 100)"/>`; acc += d; return s; }).join('');
    const lg = v.parts.map((p, i) => `<rect x="188" y="${34 + i * 26 - 9}" width="12" height="12" rx="3" fill="${shade(i)}"/>${tx(206, 34 + i * 26, `${p[1]}% ${p[0]}`, 'item')}`).join('');
    return svg(arcs + (v.c ? lines(96, 97, v.c, 12, 14, 'cap', 'text-anchor="middle"', 2) : '') + lg);
  },
  stack(v) {
    let x = 14; const w = WIDE - 28;
    const segs = v.parts.map((p, i) => { const sw = p[1] / 100 * w, s = `<rect x="${x}" y="46" width="${sw}" height="52" fill="${shade(i)}"/>${sw > 28 ? tx(x + sw / 2, 78, p[1] + '%', 'num', 'text-anchor="middle"') : ''}`; x += sw; return s; }).join('');
    const per = Math.ceil(v.parts.length / 2);
    const lg = v.parts.map((p, i) => { const col = i < per ? 0 : 1, row = i % per; return `<rect x="${14 + col * 150}" y="${126 + row * 22 - 9}" width="12" height="12" rx="3" fill="${shade(i)}"/>${lines(32 + col * 150, 126 + row * 22, `${p[0]}`, 22, 12, 'item', '', 1)}`; }).join('');
    return svg(`<clipPath id="prs"><rect x="14" y="46" width="${w}" height="52" rx="10"/></clipPath><g clip-path="url(#prs)">${segs}</g>` + lg + (v.c ? tx(14, 30, v.c, 'cap') : ''));
  },
  icons(v) {
    const n = v.items.length, cols = n <= 3 ? n : n === 4 ? 2 : 3, rows = Math.ceil(n / cols), cw = WIDE / cols, rh = Math.min(100, TALL / rows), h = rh * rows;
    return svg(v.items.map((it, i) => { const x = (i % cols) * cw + cw / 2, y = Math.floor(i / cols) * rh;
      return `${tx(x, y + rh * 0.44, it[0], 'glyph', 'text-anchor="middle"')}${lines(x, y + rh * 0.44 + 22, it[1], Math.floor(cw / 7), 12, 'item mid', 'text-anchor="middle"', 1)}${it[2] ? lines(x, y + rh * 0.44 + 36, it[2], Math.floor(cw / 6), 12, 'lbl', 'text-anchor="middle"', 2) : ''}`; }).join(''), h);
  },
  quote(v) {
    const ls = wrap(v.q, 40), h = Math.max(120, 70 + ls.length * 22 + (v.by ? 24 : 0));
    return svg(`${tx(14, 58, '“', 'qq')}${lines(40, 50, v.q, 40, 22, 'quote', '', 6)}${v.by ? tx(40, 50 + ls.length * 22 + 10, '— ' + v.by, 'lbl') : ''}`, h);
  },
  scale(v) {
    const x0 = 16, w = WIDE - 32, X = n => x0 + (n - v.min) / (v.max - v.min) * w;
    const zones = v.zones.map((z, i) => `<rect x="${X(z[0])}" y="78" width="${X(z[1]) - X(z[0])}" height="30" fill="${z[3] || shade(i)}"/>`).join('');
    const zlabels = v.zones.map(z => X(z[1]) - X(z[0]) > 34 ? lines((X(z[0]) + X(z[1])) / 2, 128, z[2], Math.floor((X(z[1]) - X(z[0])) / 6), 11, 'lbl', 'text-anchor="middle"', 2) : '').join('');
    const ticks = [...new Set(v.zones.flatMap(z => [z[0], z[1]]))].map(n => `<line x1="${X(n)}" y1="108" x2="${X(n)}" y2="114" class="axis"/>${tx(X(n), 160, fmt(n) + (v.unit || ''), 'val', 'text-anchor="middle"')}`).join('');
    const marks = (v.marks || []).map(m => `<path d="M${X(m[0])} 72 l-6 -10 h12 z" fill="var(--ink)"/>${lines(X(m[0]), 54, m[1], 18, 11, 'item mid', 'text-anchor="middle"', 2)}`).join('');
    return svg(`<clipPath id="prsc"><rect x="${x0}" y="78" width="${w}" height="30" rx="8"/></clipPath><g clip-path="url(#prsc)">${zones}</g>` + zlabels + ticks + marks, 172);
  },
  grid(v) {
    const cols = v.cols, nc = cols.length, rows = v.rows, hw = nc >= 3 ? 78 : 92, cw = (WIDE - 16 - hw) / nc, maxc = Math.floor(cw / 6.2);
    const two = rows.map(r => r.slice(1).some(c => wrap(c, maxc).length > 1) || wrap(r[0], nc >= 3 ? 12 : 15).length > 1), rh = Math.min(36, (TALL - 30) / rows.length), ys = []; let y = 30;
    for (const t of two) { ys.push(y); y += t ? rh : Math.max(24, rh - 8); }
    const head = cols.map((c, i) => tx(8 + hw + i * cw + cw / 2, 18, c, 'k', 'text-anchor="middle"')).join('');
    const cell = (x, yy, h, t, mx, cls, anchor) => { const n = wrap(t, mx).length > 1 ? 2 : 1; return lines(x, yy + h / 2 + (n > 1 ? -1 : 4), t, mx, 11, cls, anchor, 2); };
    const body = rows.map((r, i) => { const yy = ys[i], h = (ys[i + 1] || y) - yy; return `<line x1="8" y1="${yy}" x2="${WIDE - 8}" y2="${yy}" class="axis"/>${cell(8, yy, h, r[0], nc >= 3 ? 12 : 15, 'item', '')}` + r.slice(1).map((c, j) => cell(8 + hw + j * cw + cw / 2, yy, h, c, maxc, 'lbl mid', 'text-anchor="middle"')).join(''); }).join('');
    return svg(head + body, y + 4);
  },
  list(v) {
    const n = v.items.length, rh = Math.min(36, (TALL - 8) / n), h = 8 + n * rh, m = v.mark || '✓';
    return svg(v.items.map((it, i) => { const y = 4 + i * rh + rh / 2; const mk = Array.isArray(it) ? it[0] : m, t = Array.isArray(it) ? it[1] : it;
      return `${tx(14, y + 5, mk, mk === '✗' ? 'no' : 'ok')}${lines(38, y + (wrap(t, 44).length > 1 ? -1 : 4), t, 44, 13, 'item', '', 2)}`; }).join(''), Math.max(90, h));
  },
  flow(v) {
    const n = v.items.length, gap = 16, bw = (WIDE - 16 - gap * (n - 1)) / n, bh = 64, y = 60;
    return svg(v.items.map((it, i) => { const x = 8 + i * (bw + gap), glyph = Array.isArray(it) ? it[0] : null, t = Array.isArray(it) ? it[1] : it;
      return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="10" fill="${shade(i === n - 1 ? 0 : 3)}" class="box${i === n - 1 ? ' last' : ''}"/>${glyph ? tx(x + bw / 2, y + 26, glyph, 'glyph sm', 'text-anchor="middle"') : ''}${lines(x + bw / 2, y + (glyph ? 46 : 30), t, Math.floor(bw / 6), 12, i === n - 1 ? 'num' : 'item mid', 'text-anchor="middle"', glyph ? 1 : 3)}${i < n - 1 ? `<path d="M${x + bw + 3} ${y + bh / 2} l10 0 m-4 -4 l4 4 -4 4" class="arrow"/>` : ''}`; }).join(''), 184);
  },
  cycle(v) {
    const n = v.items.length, cx = 160, cy = 100, rx = n <= 3 ? 72 : 100, ry = n <= 3 ? 68 : 68;
    const at = a => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
    const pts = v.items.map((_, i) => at(-Math.PI / 2 + i / n * 2 * Math.PI));
    const chips = v.items.map((t, i) => { const ls = wrap(t, 15), w = Math.min(104, 16 + Math.max(...ls.map(l => l.length)) * 6.3), h = ls.length > 1 ? 32 : 24, p = pts[i];
      return `<rect x="${p[0] - w / 2}" y="${p[1] - h / 2}" width="${w}" height="${h}" rx="12" fill="${shade(0)}"/>${lines(p[0], p[1] + (ls.length > 1 ? -1 : 4), t, 15, 11, 'num', 'text-anchor="middle"', 2)}`; }).join('');
    const arrows = pts.map((p, i) => { const a = -Math.PI / 2 + (i + 0.5) / n * 2 * Math.PI, [ax, ay] = at(a), rot = Math.atan2(ry * Math.cos(a), -rx * Math.sin(a)) * 180 / Math.PI;
      return `<path d="M${ax} ${ay} m-5 -5 l5 5 -5 5" class="arrow" transform="rotate(${rot} ${ax} ${ay})"/>`; }).join('');
    return svg(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="ring"/>` + arrows + chips + (v.c ? lines(cx, cy + 4, v.c, 13, 13, 'cap', 'text-anchor="middle"', 2) : ''));
  },
};
function vis(v) { try { return V[v.t] ? V[v.t](v) : ''; } catch (e) { console.warn('primer visual', v, e); return ''; } }

/* ================= a band on a desk ================= */
async function desk(k) {
  css();
  try { await ensure(); } catch (e) { return; }
  if (W.view.t !== 'desk' || W.view.k !== k) return;
  const cats = DESK_CATS[k]; if (!cats) return;
  const host = document.querySelector('#main .wrap'); if (!host || host.querySelector('.prband')) return;
  const pool = P.d.topics.filter(t => cats.includes(t.cat)), seed = dayHash(k), ts = pool.slice().sort((a, b) => (S.done[a.id] ? 1 : 0) - (S.done[b.id] ? 1 : 0) || (dayHash(a.id) ^ seed) % 97 - (dayHash(b.id) ^ seed) % 97).slice(0, 5);
  if (!ts.length) return;
  const box = document.createElement('div');
  box.innerHTML = `<section class="prband" style="--c:${P.cats[cats[0]].color}"><div class="prbh"><span class="k">Primer</span><b>${T('Three-minute lessons for this desk')}</b><a href="${link('')}">${T('All {n}', { n: P.d.topics.length })} ›</a></div>
    <div class="prbl">${ts.map(t => `<a class="prbp${S.done[t.id] ? ' done' : ''}" href="${link('l/' + t.id)}" style="--c:${color(t)}"><span class="ic">${esc(t.icon)}</span><span><b>${esc(t.title)}</b><small>${S.done[t.id] ? '✓ ' + T('Finished') : T('{n} cards · {m} min', { n: total(t), m: mins(t) })}</small></span></a>`).join('')}</div></section>`;
  const el = box.firstElementChild, top = host.querySelector('.desk-top'), ph = host.querySelector('.page-h');
  if (top) { const shop = top.querySelector('.pl-st'); if (shop) shop.before(el); else top.append(el); }
  else if (ph) ph.after(el); else host.prepend(el);
}

/* ================= the look ================= */
const CSS = `
.pr{padding-bottom:40px}
.pr .crumb a{color:var(--ink-2)}
.prhero{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:26px;align-items:center;background:#0E1A2B;color:#EEF1F4;border-radius:18px;padding:30px 32px;position:relative;overflow:hidden;margin-top:18px}
.prhero::after{content:"";position:absolute;right:-90px;top:-120px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--c) 55%,transparent),transparent 70%);opacity:.55;pointer-events:none}
.prhero .k{font:700 12.5px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:#D6B25E;margin:0 0 10px}
.prhero h1{font:400 46px/1.02 var(--serif);margin:0 0 12px;letter-spacing:-.01em}
.prhero .d{color:#B9C3CF;margin:0 0 18px;font-size:15.5px;max-width:58ch}
.prbtns{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.prb{display:inline-flex;align-items:center;gap:6px;text-decoration:none;font:600 14px var(--sans);padding:9px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.22);color:#EEF1F4;background:none}
.prb:hover{background:rgba(255,255,255,.08)}
.prb.pri{background:#D6B25E;border-color:#D6B25E;color:#0E1A2B}.prb.pri:hover{background:#E3C47E}
.prb.sm{padding:7px 12px;font-size:13px}
.prtoday{position:relative;z-index:1;display:flex;gap:14px;align-items:flex-start;text-decoration:none;color:inherit;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:16px}
.prtoday:hover{background:rgba(255,255,255,.11)}
.prtoday .ic{display:grid;place-items:center;flex:none;width:58px;height:58px;border-radius:14px;background:color-mix(in srgb,var(--c) 70%,#0E1A2B);font-size:28px}
.prtoday .tx{display:flex;flex-direction:column;gap:3px;min-width:0}.prtoday small{font:700 11px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:#D6B25E}
.prtoday b{font:400 24px/1.1 var(--serif)}.prtoday .tx>span{color:#B9C3CF;font-size:14px}.prtoday i{font:600 12px var(--sans);color:#9FB0C2;font-style:normal;margin-top:4px}
.prstats{list-style:none;margin:14px 0 6px;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.prstats li{position:relative;overflow:hidden;background:var(--raise);border:1px solid var(--rule);border-radius:12px;padding:12px 14px 14px}
.prstats b{display:block;font:500 30px/1 var(--sans);letter-spacing:-.02em}.prstats b small{font-size:15px;color:var(--ink-3)}
.prstats span{display:block;margin-top:4px;font:600 11px var(--sans);text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3)}
.prstats i{position:absolute;left:0;bottom:0;height:3px;width:var(--p,0%);background:var(--brass)}
.prsec{margin-top:22px}.prsh{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;margin-bottom:8px}.prsh .note{margin:0;color:var(--ink-2);font-size:14px}
.prchips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0 10px;margin:0 -4px 4px;padding-left:4px}.prchips::-webkit-scrollbar{display:none}
.prchips .chip{flex:none}.prchips .chip i{width:9px;height:9px;border-radius:50%;background:var(--c)}.prchips .chip small{color:var(--ink-3);font-weight:600}
.prchips .chip.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}.prchips .chip.on small{color:inherit;opacity:.7}
.prgrid,.prcont{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.prtile{display:grid;grid-template-columns:48px minmax(0,1fr);gap:12px;text-decoration:none;color:inherit;background:var(--raise);border:1px solid var(--rule);border-radius:14px;padding:14px;position:relative;overflow:hidden}
.prtile::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--c)}
.prtile:hover{border-color:color-mix(in srgb,var(--c) 50%,var(--rule))}
.prtile .ic{position:relative;display:grid;place-items:center;width:48px;height:48px;border-radius:12px;background:color-mix(in srgb,var(--c) 16%,var(--raise));font-size:22px}
.prtile .ic em{position:absolute;right:-5px;top:-5px;width:18px;height:18px;border-radius:50%;background:#2E7A6C;color:#fff;font:700 11px/18px var(--sans);text-align:center;font-style:normal}
.prtile.done{opacity:.82}
.prtile .tx{display:flex;flex-direction:column;min-width:0;gap:2px}.prtile small{font:700 10.5px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.prtile b{font:400 20px/1.12 var(--serif);color:var(--ink)}.prtile .tx>span{font-size:13.5px;color:var(--ink-2)}
.prtile i{font:600 12px var(--sans);color:var(--ink-3);font-style:normal;margin-top:4px}
.prtile u{display:block;height:3px;border-radius:2px;background:var(--rule);margin-top:6px;position:relative;text-decoration:none}.prtile u::after{content:"";position:absolute;left:0;top:0;bottom:0;width:var(--p);background:var(--c);border-radius:2px}
.prfoot{margin:26px 0 0;font-size:13.5px;color:var(--ink-3)}.prfoot a{color:var(--brass-ink);text-decoration:none}
/* the band on a desk */
.prband{margin:14px 0 6px;background:var(--raise);border:1px solid var(--rule);border-radius:16px;padding:12px 14px;position:relative;overflow:hidden}
.prband::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--c)}
.prbh{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;margin:0 0 8px 8px}.prbh .k{font:700 11px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--brass-ink)}.prbh b{font:400 17px var(--serif);color:var(--ink)}
.prbh a{margin-left:auto;font:600 13px var(--sans);color:var(--brass-ink);text-decoration:none}
.prbl{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 0 2px 8px}.prbl::-webkit-scrollbar{display:none}
.prbp{flex:none;display:flex;align-items:center;gap:9px;text-decoration:none;color:inherit;border:1px solid var(--rule);border-radius:12px;padding:7px 11px 7px 7px;background:var(--paper);max-width:230px}
.prbp .ic{display:grid;place-items:center;flex:none;width:32px;height:32px;border-radius:9px;background:color-mix(in srgb,var(--c) 18%,var(--raise));font-size:15px}
.prbp b{display:block;font:600 14px/1.2 var(--sans);color:var(--ink)}.prbp small{display:block;font:600 10.5px var(--sans);text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3)}
.prbp.done small{color:#2E7A6C}.prbp:hover{border-color:var(--brass)}
/* the player */
html.prlock,html.prlock body{overflow:hidden}
.prplay{position:fixed;inset:0;z-index:1000;background:#0E1A2B;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0;-webkit-tap-highlight-color:transparent;animation:prfade .18s ease}
@keyframes prfade{from{opacity:0}to{opacity:1}}
.prbar,.prstage,.prnav{position:relative;width:min(100%,560px)}
.prbar{padding:12px 14px 0}
.prseg{display:flex;gap:3px}.prseg i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.22);position:relative;overflow:hidden}
.prseg i.on{background:#fff}.prseg i.cur::after{content:"";position:absolute;inset:0;width:0;background:#fff}.prseg i.cur.run::after{animation:prfill var(--d,10s) linear forwards}
@keyframes prfill{from{width:0}to{width:100%}}
.prtop{display:flex;align-items:center;gap:6px;margin-top:8px;color:#fff}
.prtt{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:600 12.5px var(--sans);opacity:.8}
.prpb{width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.08);color:#fff;font-size:13px;display:grid;place-items:center}
.prpb:hover{background:rgba(255,255,255,.18)}.prplay.auto .prpb[data-act="play"]{background:#D6B25E;border-color:#D6B25E;color:#0E1A2B}
.prstage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:10px 14px;overflow:auto;cursor:pointer}
.prcardwrap{width:100%;max-height:100%}
.prcard{--vis:var(--c);background:color-mix(in srgb,var(--c) 8%,var(--raise));color:var(--ink);border-radius:22px;padding:22px 22px 24px;min-height:min(540px,calc(100dvh - 150px));display:flex;flex-direction:column;gap:12px;position:relative;overflow:hidden;animation:prin .22s ease;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.prcard.back{animation-name:prback}
@keyframes prin{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:none}}
@keyframes prback{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:none}}
.prcard::before{content:"";position:absolute;right:-70px;top:-70px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--c) 28%,transparent),transparent 70%);pointer-events:none}
@media (prefers-color-scheme:dark){:root:not([data-theme="day"]) .prcard{--vis:color-mix(in srgb,var(--c) 62%,#fff);background:color-mix(in srgb,var(--c) 20%,var(--raise))}}
:root[data-theme="night"] .prcard{--vis:color-mix(in srgb,var(--c) 62%,#fff);background:color-mix(in srgb,var(--c) 20%,var(--raise))}
.prcard .k{display:flex;justify-content:space-between;margin:0;font:700 11.5px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.prcard h2{margin:0;font:400 30px/1.08 var(--serif);letter-spacing:-.008em}
.prcard .body{margin:0;font-size:16.5px;line-height:1.5;color:var(--ink-2)}
.prv{position:relative;z-index:1;margin:2px 0;flex:1;min-height:0;display:flex;align-items:center;justify-content:center}.prv svg{display:block;width:100%;height:auto;max-height:min(46vh,340px);overflow:visible;font-family:var(--sans)}
.prv text{fill:var(--ink)}.prv .lbl{font-size:11.5px;fill:var(--ink-2)}.prv .val{font-size:11.5px;font-weight:600}.prv .k{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;fill:var(--ink-3)}
.prv .huge{font-family:var(--serif);fill:var(--vis)}.prv .cap{font-size:14px;fill:var(--ink-2)}.prv .num{font-size:12px;font-weight:700;fill:#fff}.prv .item{font-size:12.5px}.prv .mid{font-size:12px;font-weight:600}
.prv .when{font-size:12px;font-weight:700;fill:var(--vis)}.prv .axis{stroke:var(--rule);stroke-width:1}.prv .rail{stroke:color-mix(in srgb,var(--vis) 40%,transparent);stroke-width:2}
.prv .l1{fill:none;stroke:var(--vis);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.prv .l2{fill:none;stroke:var(--ink-3);stroke-width:2;stroke-dasharray:5 4;stroke-linecap:round}.prv .d1{fill:var(--vis)}.prv .d2{fill:var(--ink-3)}.prv .c1{fill:var(--vis)}.prv .c2{fill:var(--ink-3)}
.prv .glyph{font-size:30px}.prv .glyph.sm{font-size:20px}.prv .bul{fill:var(--vis);font-weight:700}.prv .ok{fill:#2E7A6C;font-weight:700;font-size:15px}.prv .no{fill:#C2412D;font-weight:700;font-size:15px}
.prv .qq{font:italic 64px var(--serif);fill:var(--vis)}.prv .quote{font:italic 17px var(--serif);fill:var(--ink)}
.prv .arrow{fill:none;stroke:var(--ink-3);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.prv .ring{fill:none;stroke:var(--rule);stroke-width:2}.prv .box.last+text{fill:#fff}
.prcover{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;flex:1;gap:10px;padding:10px 0}
.prcover .ic{display:grid;place-items:center;width:84px;height:84px;border-radius:22px;background:color-mix(in srgb,var(--c) 22%,var(--raise));font-size:42px;margin-bottom:8px}
.prcover .k{display:block}.prcover h2{font-size:42px}.prcover .dek{margin:0;font:italic 19px/1.3 var(--serif);color:var(--ink-2)}.prcover .prgo{margin:14px 0 0;font:600 13px var(--sans);color:var(--ink-3);background:none;padding:0;border:0}
.pq{display:flex;flex-direction:column;gap:8px;margin-top:4px;position:relative;z-index:1}
.pq.nudge{animation:prnudge .35s ease}@keyframes prnudge{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.pqo{display:flex;align-items:center;gap:12px;text-align:left;border:1px solid var(--rule);background:var(--raise);border-radius:12px;padding:11px 12px;font:500 15px var(--sans);color:var(--ink)}
.pqo i{flex:none;width:26px;height:26px;border-radius:50%;background:var(--shoal);color:var(--ink);font:700 12px/26px var(--sans);text-align:center;font-style:normal}
.pqo:not([disabled]):hover{border-color:var(--c)}
.pqo.ok{border-color:#2E7A6C;background:rgba(62,155,138,.14)}.pqo.ok i{background:#2E7A6C;color:#fff}
.pqo.no{border-color:#C2412D;background:rgba(194,65,45,.12)}.pqo.no i{background:#C2412D;color:#fff}
.pqo.off{opacity:.55}
.pqwhy{margin-top:4px;font-size:15px;color:var(--ink-2);background:var(--raise);border-left:3px solid var(--c);border-radius:0 10px 10px 0;padding:10px 12px;position:relative;z-index:1}.pqwhy b{color:var(--ink)}.pqwhy .prb{margin-top:8px;background:var(--brass);border-color:var(--brass);color:#fff}
.prfin{display:flex;flex-direction:column;gap:6px;position:relative;z-index:1}
.prfin .badge{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:#2E7A6C;color:#fff;font:700 24px var(--sans)}
.prfin .k{display:block;margin-top:6px}.prfin h2{font-size:34px}.prfin .score{margin:0;font:600 14px var(--sans);color:var(--brass-ink)}
.prfin h3{margin:14px 0 4px;font:700 11.5px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.prfin .take{margin:0;padding-left:20px;font-size:15.5px;color:var(--ink-2)}.prfin .take li{margin:3px 0}
.prfin .src{margin:0;padding:0;list-style:none;font-size:13.5px}.prfin .src li{margin:2px 0}.prfin .src a{color:var(--brass-ink);text-decoration:none}.prfin .src a:hover{text-decoration:underline}
.prfin .prbtns{margin-top:16px}.prfin .prb{color:var(--ink);border-color:var(--rule);background:var(--raise)}.prfin .prb.pri{background:var(--brass);border-color:var(--brass);color:#fff}
.prfin .fine{margin:12px 0 0;font-size:12px;color:var(--ink-3)}
.prnav{display:flex;align-items:center;justify-content:space-between;padding:6px 14px 14px;color:#fff}
.prn{width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.08);color:#fff;font-size:24px;line-height:1;display:grid;place-items:center}
.prn[disabled]{opacity:.3;cursor:default}.prn:not([disabled]):hover{background:rgba(255,255,255,.18)}
.prhint{font:600 12px var(--sans);opacity:.6}
@media (max-width:760px){
  .prhero{grid-template-columns:1fr;padding:22px 18px;gap:16px}.prhero h1{font-size:33px}.prhero .d{font-size:14.5px}
  .prstats{grid-template-columns:repeat(2,1fr)}.prstats b{font-size:24px}
  .prgrid,.prcont{grid-template-columns:1fr}
  .prplay{justify-content:stretch}.prbar,.prstage,.prnav{width:100%}.prstage{padding:8px 10px;align-items:flex-start}
  .prcard{min-height:calc(100dvh - 128px);padding:18px 18px 20px;border-radius:18px}.prcard h2{font-size:27px}.prcard .body{font-size:16.5px}.prv{margin:2px -12px}.prcover h2{font-size:36px}.prfin h2{font-size:30px}
  .prv svg{max-height:min(46vh,330px)}
}
@media (max-height:640px){.prcard{min-height:0}.prv svg{max-height:34vh}}
@media (prefers-reduced-motion:reduce){.prcard,.prplay{animation:none}}`;
function css() { if (P.cssOn) return; P.cssOn = true; const s = document.createElement('style'); s.id = 'primer-css'; s.textContent = CSS; document.head.appendChild(s); }

window.PRIMER = { render, desk, open, close, ensure, get data() { return P.d; } };
})();
