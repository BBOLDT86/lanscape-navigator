/* The Stack: feed, topics, saved, you, and the listener. Data: data/index.json (every piece), data/packs/<name>.json (the cards),
   data/audio.json (recorded audio per piece, when there is any; until then the device's own voice reads). State: localStorage watch.stack.v1. */
(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = 'watch.stack.v1';
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dayBefore = s => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

let S = { topics: {}, seen: {}, done: {}, saved: [], secs: {}, goal: 10, rate: 1, voice: '', welcomed: false };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage off: the session still works */ }
let saveT = 0;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* full or off */ } }, 300); };

let IDX = null, BY = {}, AUDIO = {}, packs = {};
let queue = [], qi = 0, mode = 'you', filter = null, loading = false, current = null;
const app = $('#app'), feed = $('#feed');

const ICON = {
  save: '<svg class="fillable" viewBox="0 0 24 24"><path d="M7 4h10v16l-5-4-5 4z"/></svg>',
  listen: '<svg viewBox="0 0 24 24"><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4" height="7" rx="1.5"/><rect x="17" y="13" width="4" height="7" rx="1.5"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M6 6l6 6-6 6M13 6l6 6-6 6"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M6 14l6-6 6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
};

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400); }
const topic = k => IDX.topics[k] || { name: k, color: '#333' };
const fmtH = h => h >= 10 ? Math.round(h) + ' h' : (Math.round(h * 10) / 10) + ' h';
const latestDay = () => IDX.days.length ? IDX.days[IDX.days.length - 1].day : '';
const isNew = p => p.day === latestDay() && IDX.days.length > 1 || p.day === today();

/* ---------- data ---------- */
async function getJSON(u) { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }
function pack(name) { return packs[name] || (packs[name] = getJSON('data/packs/' + name + '.json').catch(e => { delete packs[name]; throw e; })); }

/* ---------- the queue ---------- */
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function spread(list) { // no two pieces of one topic back to back while another topic is left
  const by = {}; list.forEach(p => (by[p.t] = by[p.t] || []).push(p));
  const out = []; let last = '';
  while (out.length < list.length) {
    const ks = Object.keys(by).filter(k => by[k].length).sort((a, b) => by[b].length - by[a].length);
    const k = ks.find(k => k !== last) || ks[0];
    out.push(by[k].shift()); last = k;
  }
  return out;
}
function buildQueue(startId) {
  let ps = IDX.pieces;
  if (filter) ps = ps.filter(p => p.t === filter);
  else ps = ps.filter(p => S.topics[p.t] !== false);
  let q;
  if (filter) q = ps.slice().sort((a, b) => (a.s || '').localeCompare(b.s || '') || 0);
  else if (mode === 'new') q = ps.slice().sort((a, b) => b.day.localeCompare(a.day)), q = [].concat(...[...new Set(q.map(p => p.day))].map(d => spread(shuffle(q.filter(p => p.day === d)))));
  else {
    const fresh = ps.filter(p => !S.done[p.id]), old = ps.filter(p => S.done[p.id]);
    const begun = fresh.filter(p => S.seen[p.id] > 1), rest = fresh.filter(p => !(S.seen[p.id] > 1));
    const newest = rest.filter(isNew), older = rest.filter(p => !isNew(p));
    // new pieces lead, mixed one-in-three with the back catalogue so the feed never feels like a syllabus
    const a = spread(shuffle(newest)), b = spread(shuffle(older)), mix = [];
    while (a.length || b.length) { if (a.length) mix.push(a.shift()); if (a.length) mix.push(a.shift()); if (b.length) mix.push(b.shift()); }
    q = begun.concat(mix, spread(shuffle(old)));
  }
  if (startId && BY[startId]) { q = q.filter(p => p.id !== startId); q.unshift(BY[startId]); }
  queue = q; qi = 0;
}

/* ---------- cards ---------- */
function chips(n, i) { let h = '<div class="chips" aria-hidden="true">'; for (let k = 0; k < n; k++) h += `<i class="${k < i ? 'on' : ''}${k === i - 1 ? ' now' : ''}"></i>`; return h + '</div>'; }
function rail(p, i) {
  const sv = S.saved.some(s => s.id === p.id && s.i === i);
  return `<div class="rail">
    <button data-act="save" aria-pressed="${sv}"><span class="ic">${ICON.save}</span>Save</button>
    <button data-act="listen" aria-pressed="false"><span class="ic">${ICON.listen}</span>Listen</button>
    <button data-act="share"><span class="ic">${ICON.share}</span>Share</button>
    <button data-act="next"><span class="ic">${ICON.next}</span>Skip</button></div>`;
}
function pieceHTML(p, cards) {
  const t = topic(p.t), n = cards.length;
  let h = `<article class="card cover" data-p="${p.id}" data-i="0" style="--c:${t.color}">
    <span class="topic">${esc(t.name)}${p.s ? ' · ' + esc(p.s) : ''}</span>
    <h2>${esc(p.h)}</h2><p class="dek">${esc(p.d)}</p>
    <p class="meta">${isNew(p) ? '<span class="new">New</span>' : ''}${Math.round(p.m)} min · ${n} ideas${S.done[p.id] ? ' · read' : ''}</p>
    <p class="hint">${ICON.up} Swipe up</p>${chips(n, 0)}${rail(p, 0)}</article>`;
  cards.forEach((c, k) => {
    h += `<article class="card" data-p="${p.id}" data-i="${k + 1}" style="--c:${t.color}">
      <p class="from"><b>${esc(p.h)}</b><span>${esc(t.name)} · ${k + 1} of ${n}</span></p>
      <h2>${esc(c[0])}</h2>${c[1].split('\n').map(x => `<p class="txt">${esc(x)}</p>`).join('')}${chips(n, k + 1)}${rail(p, k + 1)}</article>`;
  });
  return h;
}
async function more(count = 2) {
  if (loading) return; loading = true;
  try {
    for (let k = 0; k < count; k++) {
      if (qi >= queue.length) {
        if (!queue.length) { feed.insertAdjacentHTML('beforeend', `<article class="card end" data-end="1"><h2>Nothing here yet</h2><p class="txt">Turn on at least one topic and the feed fills up.</p><button class="btn" data-go="me">Choose topics</button></article>`); break; }
        const lastId = queue[queue.length - 1].id; buildQueue(); if (queue.length > 1 && queue[0].id === lastId) queue.push(queue.shift());
      }
      const p = queue[qi++];
      let pk; try { pk = await pack(p.pack); } catch (e) { continue; }
      if (!pk[p.id]) continue;
      p.cards = pk[p.id].c;
      feed.insertAdjacentHTML('beforeend', pieceHTML(p, p.cards));
      $$(`.card[data-p="${CSS.escape(p.id)}"]`, feed).forEach(c => { if (!c._w) { c._w = 1; io.observe(c); } });
    }
  } finally { loading = false; }
}
async function restart(startId, startCard) {
  stopListening(true);
  feed.innerHTML = ''; current = null; buildQueue(startId);
  await more(3);
  feed.scrollTop = 0;
  if (startCard) { const c = $(`.card[data-p="${CSS.escape(startId)}"][data-i="${startCard}"]`, feed); if (c) c.scrollIntoView(); }
  $('#filter').hidden = !filter; if (filter) $('#filterName').textContent = topic(filter).name;
  $$('.modes button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode && !filter)));
}

/* ---------- what is on screen ---------- */
const io = new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting && e.intersectionRatio >= .6) onCard(e.target); });
}, { root: feed, threshold: [.6] });
function onCard(el) {
  if (current === el) return; current = el;
  const id = el.dataset.p, i = +el.dataset.i;
  if (id) {
    const p = BY[id];
    if (!(S.seen[id] >= i + 1)) S.seen[id] = i + 1;
    if (i >= p.n && !S.done[id]) { S.done[id] = today(); }
    save();
    try { history.replaceState(null, '', '#p/' + id + (i ? '/' + i : '')); } catch (e) { /* file: */ }
  }
  // keep two pieces ahead of the reader
  const cards = $$('.card', feed); if (cards.indexOf(el) > cards.length - 6) more(2);
  if (L.on) speakCard(el);
}
// seconds count only while a card is on screen, the tab is visible and the reader has touched the screen in the last 90 s (or is listening)
let lastTouch = Date.now();
['pointerdown', 'keydown', 'wheel', 'touchmove'].forEach(ev => addEventListener(ev, () => { lastTouch = Date.now(); }, { passive: true }));
feed.addEventListener('scroll', () => { lastTouch = Date.now(); }, { passive: true });
setInterval(() => {
  if (document.hidden || app.dataset.view !== 'feed' || !current || !current.dataset.p) return;
  if (!L.on && Date.now() - lastTouch > 90000) return;
  const d = today(); S.secs[d] = (S.secs[d] || 0) + 1; save();
  if (S.secs[d] % 15 === 0) drawStreak();
  if (S.secs[d] === S.goal * 60) toast(`${S.goal} minutes today. Goal met.`);
}, 1000);
function streak() { let n = 0, d = today(); if (!(S.secs[d] >= 60)) d = dayBefore(d); while (S.secs[d] >= 60) { n++; d = dayBefore(d); } return n; }
function drawStreak() { $('#streakN').textContent = streak(); }

/* ---------- actions on a card ---------- */
feed.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const el = b.closest('.card'), p = BY[el.dataset.p], i = +el.dataset.i;
  if (b.dataset.act === 'save') {
    const k = S.saved.findIndex(s => s.id === p.id && s.i === i);
    if (k >= 0) { S.saved.splice(k, 1); b.setAttribute('aria-pressed', 'false'); toast('Removed'); }
    else { const c = i ? p.cards[i - 1] : [p.h, p.d]; S.saved.unshift({ id: p.id, i, h: c[0], x: c[1].slice(0, 150), at: Date.now() }); b.setAttribute('aria-pressed', 'true'); toast('Saved'); }
    save(); pulse('save');
  } else if (b.dataset.act === 'listen') { L.on ? stopListening() : startListening(el); }
  else if (b.dataset.act === 'share') {
    const url = location.origin + location.pathname + '?s=friend#p/' + p.id + (i ? '/' + i : '');
    const title = (i ? p.cards[i - 1][0] + ': ' : '') + p.h;
    if (navigator.share) navigator.share({ title, text: title, url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Link copied'));
    pulse('share');
  } else if (b.dataset.act === 'next') {
    let n = el.nextElementSibling; while (n && n.dataset.p === el.dataset.p) n = n.nextElementSibling;
    if (n) n.scrollIntoView({ behavior: 'smooth' });
  }
});
function pulse(kind) { try { window.pulse && window.pulse.event(kind); } catch (e) { /* no tracker */ } }
addEventListener('keydown', e => {
  if (app.dataset.view !== 'feed' || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const go = d => { const t = d > 0 ? current && current.nextElementSibling : current && current.previousElementSibling; if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); } };
  if (e.key === 'ArrowDown' || e.key === 'j' || e.key === ' ') go(1);
  else if (e.key === 'ArrowUp' || e.key === 'k') go(-1);
  else if (e.key === 'l') current && (L.on ? stopListening() : startListening(current));
});

/* ---------- listening ---------- */
// Two ways to listen. If data/audio.json has a recording for the piece ({id: {src, marks: [seconds each card starts at]}}), that plays.
// Otherwise the device's own voice reads the card on screen, sentence by sentence, and turns the page when it finishes.
const synth = window.speechSynthesis;
const L = { on: false, paused: false, token: 0, el: null, audio: null, audioId: '' };
const RATES = [1, 1.2, 1.4, .85];
function voices() { return synth ? synth.getVoices().filter(v => /^en/i.test(v.lang)) : []; }
function pickVoice() {
  const vs = voices(); if (!vs.length) return null;
  return vs.find(v => v.voiceURI === S.voice) || vs.find(v => /Samantha|Ava|Evan|Google US English|Aria|Jenny/i.test(v.name)) || vs.find(v => /en-US/i.test(v.lang)) || vs[0];
}
function startListening(el) {
  const rec = AUDIO[el.dataset.p];
  if (!rec && !synth) { toast('This browser has no reading voice. Open The Stack in Safari or Chrome to listen.'); return; }
  L.on = true; L.paused = false; app.classList.add('listening'); $('#player').hidden = false; drawPlayer();
  $$('[data-act="listen"]', feed).forEach(b => b.setAttribute('aria-pressed', 'true'));
  speakCard(el, true); pulse('listen');
}
function stopListening(quiet) {
  L.on = false; L.token++; if (synth) synth.cancel(); if (L.audio) { L.audio.pause(); }
  app.classList.remove('listening'); $('#player').hidden = true;
  $$('.card.speaking', feed).forEach(c => c.classList.remove('speaking'));
  $$('[data-act="listen"]', feed).forEach(b => b.setAttribute('aria-pressed', 'false'));
}
function cardText(el) {
  const p = BY[el.dataset.p], i = +el.dataset.i;
  if (!p) return '';
  if (!i) return `${topic(p.t).name}. ${p.h}. ${p.d}`;
  const c = p.cards[i - 1]; return c[0].replace(/[.?!]*$/, '.') + ' ' + c[1].replace(/\n/g, ' ');
}
function nextCard(el) { const n = el.nextElementSibling; if (n) n.scrollIntoView({ behavior: 'smooth' }); else more(2).then(() => { const m = el.nextElementSibling; if (m) m.scrollIntoView({ behavior: 'smooth' }); }); }
function speakCard(el, fresh) {
  if (!el.dataset.p) return;
  if (L.el === el && !fresh) return;
  L.el = el; const my = ++L.token;
  $$('.card.speaking', feed).forEach(c => c.classList.remove('speaking')); el.classList.add('speaking');
  $$('[data-act="listen"]', el).forEach(b => b.setAttribute('aria-pressed', 'true'));
  drawPlayer();
  const id = el.dataset.p, i = +el.dataset.i, rec = AUDIO[id];
  if (rec) { if (synth) synth.cancel(); playRecording(id, i, rec, my); return; }
  if (L.audio) L.audio.pause();
  if (!synth) { stopListening(); return; }
  synth.cancel();
  const parts = cardText(el).match(/[^.!?]+[.!?]+["”’)]*|\S[^.!?]*$/g) || [];
  const v = pickVoice(); let k = 0;
  const say = () => {
    if (my !== L.token || !L.on) return;
    if (k >= parts.length) { setTimeout(() => { if (my === L.token && L.on) nextCard(el); }, 350); return; }
    const u = new SpeechSynthesisUtterance(parts[k++].trim());
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
    const t0 = Date.now(), long = u.text.length > 25;
    const dead = () => { if (my !== L.token) return; stopListening(); toast('This browser would not read aloud. Open The Stack in Safari or Chrome to listen.'); };
    u.rate = S.rate;
    u.onend = () => { if (long && Date.now() - t0 < 150) dead(); else say(); };   // a voice that "finishes" a sentence instantly is not speaking
    u.onerror = ev => { if (ev.error !== 'interrupted' && ev.error !== 'canceled') dead(); };
    synth.speak(u);
  };
  setTimeout(say, 60);
}
function playRecording(id, i, rec, my) {
  if (!L.audio) { L.audio = new Audio(); L.audio.preload = 'auto'; }
  const a = L.audio, marks = rec.marks || [];
  if (L.audioId !== id) { a.src = rec.src; L.audioId = id; }
  const at = marks[i] || 0;
  if (Math.abs(a.currentTime - at) > 1.5 || a.paused) { try { a.currentTime = at; } catch (e) { /* not loaded yet */ } }
  a.playbackRate = S.rate; a.play().catch(() => toast('Tap Listen again to start the audio'));
  a.ontimeupdate = () => {
    if (my !== L.token) return;
    const nxt = marks[i + 1]; if (nxt && a.currentTime >= nxt) nextCard(L.el);
  };
  a.onended = () => { if (L.on) { let n = L.el; while (n.nextElementSibling && n.nextElementSibling.dataset.p === id) n = n.nextElementSibling; nextCard(n); } };
  if ('mediaSession' in navigator) { const p = BY[id]; navigator.mediaSession.metadata = new MediaMetadata({ title: p.h, artist: 'The Stack · ' + topic(p.t).name, album: 'The Watch' }); }
}
function drawPlayer() {
  const p = L.el && BY[L.el.dataset.p]; if (!p) return;
  const i = +L.el.dataset.i;
  $('#plTitle').textContent = p.h; $('#plSub').textContent = (AUDIO[p.id] ? 'Recorded' : 'Phone voice') + ' · ' + (i ? `${i} of ${p.n}` : 'intro');
  $('#plRate').textContent = S.rate + '×';
  $('#plIcon').innerHTML = L.paused ? '<path d="M8 5v14l11-7z"/>' : '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>';
  $('#plToggle').setAttribute('aria-label', L.paused ? 'Play' : 'Pause');
}
$('#plToggle').onclick = () => {
  if (!L.on) return;
  L.paused = !L.paused;
  if (L.paused) { L.token++; if (synth) synth.cancel(); if (L.audio) L.audio.pause(); }
  else speakCard(L.el, true);
  drawPlayer();
};
$('#plRate').onclick = () => { S.rate = RATES[(RATES.indexOf(S.rate) + 1) % RATES.length]; save(); drawPlayer(); if (L.on && !L.paused) speakCard(L.el, true); };
$('#plStop').onclick = () => stopListening();
if (synth) { synth.onvoiceschanged = () => { if (app.dataset.view === 'me') drawMe(); }; addEventListener('pagehide', () => synth.cancel()); }

/* ---------- panes ---------- */
function drawTopics(k) {
  const el = $('#topics');
  if (k && IDX.topics[k]) {
    const t = topic(k), ps = IDX.pieces.filter(p => p.t === k), ser = {};
    ps.forEach(p => (ser[p.s || 'More'] = ser[p.s || 'More'] || []).push(p));
    el.innerHTML = `<button class="crumb" data-go="topics">${ICON.back} Topics</button><h1>${esc(t.name)}</h1>
      <p class="sub">${ps.length} stacks, ${fmtH(t.hours)}. ${ps.filter(p => S.done[p.id]).length} read.</p>
      <button class="btn" data-topicfeed="${k}">Scroll ${esc(t.name)} only</button>` +
      Object.keys(ser).map(s => `<h3>${esc(s)}</h3><div class="list">${ser[s].map(p => row(p)).join('')}</div>`).join('');
    el.scrollTop = 0; return;
  }
  el.innerHTML = `<h1>Topics</h1><p class="sub">${IDX.totals.pieces} stacks, ${fmtH(IDX.totals.hours)} of reading or listening.</p>
    <input class="search" id="q" type="search" placeholder="Search every stack" aria-label="Search every stack" autocomplete="off">
    <div id="qres"></div><div class="tgrid" id="tgrid">` +
    Object.keys(IDX.topics).map(k => { const t = IDX.topics[k], ps = IDX.pieces.filter(p => p.t === k), dn = ps.filter(p => S.done[p.id]).length;
      return `<button class="tile" style="--c:${t.color}" data-topic="${k}"><b>${esc(t.name)}</b><span>${t.pieces} stacks · ${fmtH(t.hours)}</span><span class="bar"><i style="width:${ps.length ? dn / ps.length * 100 : 0}%"></i></span></button>`; }).join('') + `</div>`;
  $('#q').oninput = e => {
    const q = e.target.value.trim().toLowerCase(), res = $('#qres');
    $('#tgrid').hidden = !!q;
    if (!q) { res.innerHTML = ''; return; }
    const hit = IDX.pieces.filter(p => (p.h + ' ' + p.d + ' ' + p.s).toLowerCase().includes(q)).slice(0, 40);
    res.innerHTML = hit.length ? `<div class="list">${hit.map(p => row(p)).join('')}</div>` : `<p class="empty">No stack matches “${esc(q)}”. New ones are added every day.</p>`;
  };
}
function row(p) { return `<button class="row" data-open="${p.id}" style="--c:${topic(p.t).color}"><i class="dot${S.done[p.id] ? ' done' : ''}"></i><span><b>${esc(p.h)}</b><span>${esc(p.d)}</span></span><span class="min">${Math.round(p.m)} min</span></button>`; }
function drawSaved() {
  const el = $('#saved');
  el.innerHTML = `<h1>Saved</h1>` + (S.saved.length ? `<p class="sub">${S.saved.length} idea${S.saved.length === 1 ? '' : 's'} kept on this device.</p><div class="list">` +
    S.saved.filter(s => BY[s.id]).map(s => `<button class="row" data-open="${s.id}" data-card="${s.i}" style="--c:${topic(BY[s.id].t).color}"><i class="dot"></i><span><b>${esc(s.h)}</b><span>${esc(s.x)}${s.x.length >= 150 ? '…' : ''}</span><span>${esc(BY[s.id].h)}</span></span></button>`).join('') + `</div>`
    : `<p class="empty">Nothing saved yet. Tap Save on any idea in the feed and it waits for you here.</p><button class="btn" data-go="feed">Open the feed</button>`);
}
function drawMe() {
  const el = $('#me'), secs = S.secs[today()] || 0, min = Math.floor(secs / 60), pct = Math.min(1, secs / (S.goal * 60)), C = 2 * Math.PI * 42;
  const total = Object.values(S.secs).reduce((a, b) => a + b, 0), done = Object.keys(S.done).filter(id => BY[id]).length;
  const last = IDX.days[IDX.days.length - 1], vs = voices();
  el.innerHTML = `<h1>You</h1>
    <div class="today"><div class="ring"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="42"/><circle class="fg" cx="50" cy="50" r="42" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg><b>${min}</b></div>
      <p><b>${min >= S.goal ? 'Goal met today' : `${Math.max(0, S.goal - min)} minutes to go today`}</b>Minutes count while you read or listen in the feed. A day with one full minute keeps the streak.</p></div>
    <div class="stats"><div><b>${streak()}</b><span>day streak</span></div><div><b>${done}</b><span>stacks read</span></div><div><b>${total >= 3600 ? (total / 3600).toFixed(1) + ' h' : Math.floor(total / 60) + ' m'}</b><span>all time</span></div></div>
    <h3>Daily goal</h3><div class="pick plain">${[5, 10, 20, 30].map(g => `<button data-goal="${g}" aria-pressed="${S.goal === g}">${g} min</button>`).join('')}</div>
    <h3>In your feed</h3><div class="pick">${Object.keys(IDX.topics).map(k => `<button data-toggle="${k}" style="--c:${IDX.topics[k].color}" aria-pressed="${S.topics[k] !== false}">${esc(IDX.topics[k].name)}</button>`).join('')}</div>
    <h3>Listening voice</h3>` + (AUDIO && Object.keys(AUDIO).length ? `<p class="note">${Object.keys(AUDIO).length} stacks have recorded audio. The rest are read by this device.</p>` : '') +
    (vs.length ? `<select class="field" id="voice" aria-label="Listening voice">${vs.map(v => `<option value="${esc(v.voiceURI)}"${pickVoice() === v ? ' selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select>
      <p class="note">Read aloud by this device's own voice, so it works without a connection once a stack is open. It stops when the screen locks. On an iPhone, better voices are in Settings › Accessibility › Spoken Content › Voices.</p>`
      : `<p class="note">${synth ? 'Voices are still loading. Open this tab again in a moment.' : 'This browser has no reading voice. Open The Stack in Safari or Chrome to listen.'}</p>`) +
    `<h3>The library</h3><p class="note">${IDX.totals.pieces} stacks, ${IDX.totals.hours} hours at a speaking pace of ${IDX.wpm} words a minute.${last ? ` Last added ${fmtDay(last.day)}: ${last.pieces} stacks, ${last.hours} hours.` : ''}</p>
    <h3>Keep it like an app</h3><p class="note">In Safari, tap Share, then Add to Home Screen. The Stack opens full screen from its own icon and remembers your streak, topics and saved ideas on this device.</p>
    <h3>About</h3><p class="note">Written by Claude for The Watch. These are original lessons on each subject, not summaries of anyone's book, and money, health and poker pieces are for learning, not advice. Found a mistake? <a href="https://github.com/BBOLDT86/lanscape-navigator/issues/new?title=The%20Stack%3A%20" rel="noopener">Tell us</a>.</p>`;
  const v = $('#voice'); if (v) v.onchange = () => { S.voice = v.value; save(); if (synth) { synth.cancel(); const u = new SpeechSynthesisUtterance('This is how The Stack will sound.'); const pv = pickVoice(); if (pv) u.voice = pv; u.rate = S.rate; synth.speak(u); } };
}
function fmtDay(d) { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

/* ---------- navigation ---------- */
function show(view, arg) {
  app.dataset.view = view;
  feed.style.visibility = view === 'feed' ? '' : 'hidden';
  ['topics', 'saved', 'me'].forEach(v => { $('#' + v).hidden = v !== view; });
  $$('.tabs button').forEach(b => { if (b.dataset.go === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (view !== 'feed' && L.on && !AUDIO[L.el && L.el.dataset.p]) { /* voice keeps reading the card it is on */ }
  if (view === 'topics') drawTopics(arg); else if (view === 'saved') drawSaved(); else if (view === 'me') drawMe();
  if (view !== 'feed') try { history.replaceState(null, '', '#' + view + (arg ? '/' + arg : '')); } catch (e) { /* file: */ }
  drawStreak();
}
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) { show(g.dataset.go); return; }
  const t = e.target.closest('[data-topic]'); if (t) { show('topics', t.dataset.topic); return; }
  const tf = e.target.closest('[data-topicfeed]'); if (tf) { filter = tf.dataset.topicfeed; show('feed'); restart(); return; }
  const o = e.target.closest('[data-open]'); if (o) { const p = BY[o.dataset.open]; filter = null; show('feed'); restart(p.id, +o.dataset.card || 0); return; }
  const m = e.target.closest('[data-mode]'); if (m) { mode = m.dataset.mode; filter = null; restart(); return; }
  const gl = e.target.closest('[data-goal]'); if (gl) { S.goal = +gl.dataset.goal; save(); drawMe(); return; }
  const tg = e.target.closest('[data-toggle]'); if (tg) { const k = tg.dataset.toggle; S.topics[k] = S.topics[k] === false; save(); drawMe(); restart.dirty = true; return; }
});
$('#filterX').onclick = () => { filter = null; restart(); };
document.addEventListener('click', e => { if (e.target.closest('.tabs [data-go="feed"]') && restart.dirty) { restart.dirty = false; restart(); } }, true);

/* ---------- welcome ---------- */
function welcome() {
  const w = $('#welcome'); w.hidden = false;
  $('#wTopics').innerHTML = Object.keys(IDX.topics).map(k => `<button data-w="${k}" style="--c:${IDX.topics[k].color}" aria-pressed="true">${esc(IDX.topics[k].name)}</button>`).join('');
  $('#wNote').textContent = `${IDX.totals.pieces} stacks to start, ${fmtH(IDX.totals.hours)} in all. More every day.`;
  $('#wTopics').onclick = e => { const b = e.target.closest('[data-w]'); if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); };
  $('#wGo').onclick = () => {
    const on = $$('#wTopics [aria-pressed="true"]').map(b => b.dataset.w);
    Object.keys(IDX.topics).forEach(k => { S.topics[k] = on.length ? on.includes(k) : true; });
    S.welcomed = true; save(); w.hidden = true; restart();
  };
}

/* ---------- start ---------- */
(async () => {
  try { IDX = await getJSON('data/index.json'); } catch (e) { feed.innerHTML = `<article class="card end"><h2>The Stack couldn't load</h2><p class="txt">Check the connection and reload the page.</p></article>`; return; }
  IDX.pieces.forEach(p => { BY[p.id] = p; });
  getJSON('data/audio.json').then(a => { AUDIO = a || {}; }).catch(() => {});
  drawStreak();
  const h = location.hash.slice(1).split('/');
  if (h[0] === 'p' && BY[h[1]]) { await restart(h[1], +h[2] || 0); if (!S.welcomed) { S.welcomed = true; save(); } }
  else {
    await restart();
    if (h[0] === 't' && IDX.topics[h[1]]) show('topics', h[1]);
    else if (['topics', 'saved', 'me'].includes(h[0])) show(h[0], h[1]);
    if (!S.welcomed) welcome();
  }
  window.STACK = { S, IDX, restart, show };
})();
})();
