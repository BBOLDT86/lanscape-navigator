/* The Watch · Plus One (#/plusone): the players and the people beside them, where the Sports, Lifestyle and Culture
   desks meet. news/index.html loads this file the first time someone opens Plus One, or the Sports, Lifestyle or
   Culture desk (each gets a card), and draws with the page's own helpers (window.WATCH) and look.
   Data: plusone/couples.json, written and re-checked every week by a scheduled Claude task (only couples who are
   public about their relationship, and partners who are public figures in their own right); data/plusone.json, the
   news about each couple from established outlets (news/updater/plusone.py); the Sports desk's schedules
   (data/sports/<league>.json) and the F1 hub's calendar (data/f1.json) for each athlete's next game.
   See news/UPDATER.md, "Plus One". */
(() => {
'use strict';
const W = window.WATCH;
const { T, esc, md, getJSON, ago, isoMin, LOC, LANG } = W;
const $ = s => document.querySelector(s);
const P = { c: null, live: null, busy: null, sp: {}, spBusy: null, f1: null, filt: { lg: 'all', f: 'all', st: 'all', q: '' } };

/* ================= data ================= */
function ensure() {
  if (P.c) return Promise.resolve();
  if (!P.busy) P.busy = Promise.all([
    getJSON('plusone/couples.json').then(d => { P.c = d; P.by = {}; for (const x of d.couples || []) P.by[x.id] = x; }),
    getJSON('data/plusone.json').then(d => { P.live = d || {}; }, () => { P.live = {}; }),
    LANG === 'en' || LANG === 'xx' ? null : getJSON('plusone/i18n.json').then(x => { const t = x && x[LANG]; if (t) for (const k in t) if (W.DICT.t[k] == null) W.DICT.t[k] = t[k]; }).catch(() => {}),
  ]).then(() => { P.busy = null; }, e => { P.busy = null; throw e; });
  return P.busy;
}
const SPF = { nfl: 'nfl', nba: 'nba', wnba: 'wnba', mlb: 'mlb', nhl: 'nhl', mls: 'mls', soccer: 'soccer' };
function ensureSchedules() { // the Sports desk's files for the leagues in Plus One, and the F1 calendar
  if (P.spBusy) return P.spBusy;
  const lgs = [...new Set((P.c.couples || []).map(x => x.athlete.lg || x.league))];
  const want = lgs.filter(l => SPF[l]).concat(lgs.includes('soccer') ? ['mls'] : []);
  P.spBusy = Promise.all([
    ...[...new Set(want)].map(l => getJSON('data/sports/' + SPF[l] + '.json').then(d => { P.sp[l] = d; }, () => {})),
    lgs.includes('f1') ? getJSON('data/f1.json').then(d => { P.f1 = d; }, () => {}) : null,
  ]);
  return P.spBusy;
}

/* ================= names, colors, matching ================= */
const FIELD = { // the partner's field: the colour is a second cue; the label always shows
  'Music': '#6250d6', 'Film & TV': '#2a78d6', 'Fashion': '#d55181', 'Sport': '#1baf7a', 'Media': '#eb6834', 'Business': '#c98500', 'Social': '#e34948' };
const LG = { f1: 'Formula 1', nfl: 'NFL', nba: 'NBA', wnba: 'WNBA', mlb: 'MLB', nhl: 'NHL', soccer: 'Soccer', tennis: 'Tennis', golf: 'Golf', olympics: 'Olympic sports' };
const STATUS = { married: 'Married', engaged: 'Engaged', dating: 'Together' };
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const initials = n => String(n || '').split(/\s+/).filter(w => /^[A-ZÀ-ÖØ-Þ]/.test(w)).map(w => w[0]).slice(0, 2).join('') || String(n || '?')[0];
const first = n => String(n || '').split(/\s+/)[0];
const last = n => { const p = String(n || '').split(/\s+/); return p.length > 1 ? p.slice(1).join(' ') : p[0]; };
const fcol = c => FIELD[(c.partner.fields || [])[0]] || '#8492A3';
function team(c) { // the athlete's team in the Sports desk's (or the F1 hub's) data: {nm, c, id, lg}
  const a = c.athlete, lg = a.lg || c.league;
  if (lg === 'f1' && P.f1) { const d = P.f1.drivers && P.f1.drivers[a.f1]; const t = d && d.team; return t ? { nm: (P.f1.teams[t] || {}).short || a.team, c: (P.f1.teams[t] || {}).col, f1: t } : null; }
  const tries = lg === 'soccer' ? ['soccer', 'mls'] : [lg];
  for (const l of tries) {
    const d = P.sp[l]; if (!d) continue;
    const n = norm(a.team), all = (d.teams || []).concat(...((d.games || []).map(g => [g.h, g.a])));
    const t = all.find(x => x && (norm(x.nm) === n || norm(x.sh) === n)) || all.find(x => x && n && (norm(x.nm).includes(n) || n.includes(norm(x.nm))));
    if (t) return { nm: t.nm, c: t.c ? '#' + t.c : null, id: t.id, lg: l };
  }
  return null;
}
const tcol = c => { const t = team(c); return (t && t.c) || c.athlete.color || '#15243B'; };
function nextUp(c) { // the athlete's next game or race: {when, what, href}
  const t = team(c); if (!t) return null;
  const now = Date.now() - 3 * 3600e3;
  if (t.f1 && P.f1) {
    const r = (P.f1.races || []).find(x => Date.parse(x.start) > now);
    return r ? { when: r.start, what: r.name, href: '#/f1/race/' + r.r, live: false } : null;
  }
  const d = P.sp[t.lg]; if (!d) return null;
  const g = (d.games || []).filter(g => g.st !== 'post' && Date.parse(g.d) > now && (g.h.id === t.id || g.a.id === t.id)).sort((a, b) => a.d < b.d ? -1 : 1)[0];
  if (!g) return null;
  const home = g.h.id === t.id, opp = home ? g.a : g.h;
  return { when: g.d, what: home ? T('vs {team}', { team: opp.nm }) : T('at {team}', { team: opp.nm }), tv: g.tv, live: g.st === 'in', href: `#/sports/${t.lg}/g/${g.id}${g.cp ? '?c=' + g.cp : ''}` };
}
const fmt = (iso, o) => new Intl.DateTimeFormat(LOC(), o).format(new Date(iso));
const when = iso => fmt(iso, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
function dayOf(s) { // "2026-11", "2026-11-07" or "2027" -> a sortable date and a label
  if (!s) return null;
  if (/^\d{4}-\d\d-\d\d/.test(s)) return { t: Date.parse(s.slice(0, 10) + 'T12:00:00Z'), l: fmt(s.slice(0, 10) + 'T12:00:00Z', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }), exact: true };
  if (/^\d{4}-\d\d$/.test(s)) return { t: Date.parse(s + '-15T12:00:00Z'), l: fmt(s + '-15T12:00:00Z', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
  if (/^\d{4}$/.test(s)) return { t: Date.parse(s + '-07-01T12:00:00Z'), l: s };
  return null;
}
const news = id => ((P.live && P.live.news) || {})[id] || [];
const n7 = id => ((P.live && P.live.n7) || {})[id] || 0;
const enAttr = () => LANG !== 'en' && LANG !== 'xx' ? ' lang="en"' : '';
function mdx(text, sources) {
  const n = (sources || []).length;
  return md(text || '', 0).replace(/\[(\d{1,2})\](?!\()/g, (m, k) => +k >= 1 && +k <= n
    ? `<sup class="cite"><a href="${esc(sources[k - 1].u)}" target="_blank" rel="noopener" title="${esc(sources[k - 1].o + ': ' + sources[k - 1].t)}">${k}</a></sup>` : '');
}
const plain = t => esc(String(t || '').replace(/\s*\[\d{1,2}\]/g, ''));
const firstSentence = t => { const s = String(t || '').replace(/\s*\[\d{1,2}\]/g, ''); const m = s.match(/^.{40,260}?[.!?](\s|$)/); return m ? m[0].trim() : s.slice(0, 220); };

/* ================= the mark: two circles, the athlete's team colour and the partner's field ================= */
function mark(c, size) {
  const a = tcol(c), b = fcol(c), s = size || 'md';
  return `<svg class="po-mk ${s}" viewBox="0 0 132 88" aria-hidden="true"><circle cx="48" cy="44" r="36" fill="${a}" fill-opacity=".16" stroke="${a}" stroke-width="2.4"/><circle cx="84" cy="44" r="36" fill="${b}" fill-opacity=".16" stroke="${b}" stroke-width="2.4"/>
    <text x="34" y="52" text-anchor="middle">${esc(initials(c.athlete.name))}</text><text x="98" y="52" text-anchor="middle">${esc(initials(c.partner.name))}</text></svg>`;
}
const fieldChips = c => (c.partner.fields || []).map(f => `<span class="po-fc" style="--fc:${FIELD[f] || '#8492A3'}">${esc(T(f))}</span>`).join('');
const statusLine = c => [T(STATUS[c.status] || c.status), c.since ? T('public since {y}', { y: dayOf(c.since) ? dayOf(c.since).l : c.since }) : ''].filter(Boolean).join(' · ');

function card(c) {
  const nx = nextUp(c), h = news(c.id)[0];
  return `<a class="po-card" href="#/plusone/${esc(c.id)}" data-lg="${esc(c.league)}">
    ${mark(c)}<span class="po-k">${esc(T(LG[c.league] || c.sport))}${c.athlete.team ? ' · ' + esc(c.athlete.team) : ''}</span>
    <span class="po-n"${enAttr()}>${esc(c.athlete.name)} <i>&amp;</i> ${esc(c.partner.name)}</span>
    <span class="po-kf"${enAttr()}>${esc(c.partner.known_for)}</span>
    <span class="po-st">${esc(statusLine(c))}</span>
    ${nx ? `<span class="po-nx">${nx.live ? '● ' + T('Playing now') : esc(when(nx.when))} · ${esc(nx.what)}</span>` : ''}
    ${h ? `<span class="po-hl"><b>${esc(h.o)}</b> ${esc(h.t)}</span>` : ''}</a>`;
}

/* ================= the section ================= */
function shell(body, title) {
  $('#main').innerHTML = `<div class="wrap po">${body}<p class="po-foot">${T('Plus One covers couples who are public about their relationship, and partners who are public figures in their own right. No rumours, nothing about children or homes, and every couple is checked again each week.')} ${P.c && P.c.updated ? T('Written by Claude ({model}) from the sources cited. Updated {date}.', { model: esc(P.c.model || 'Claude'), date: esc(fmt(P.c.updated, { month: 'long', day: 'numeric' })) }) : ''}${LANG !== 'en' && LANG !== 'xx' ? ' ' + T('In English.') : ''}</p></div>`;
  document.title = (title ? title + ' · ' : '') + 'Plus One · The Watch';
  bind();
}
function filtered() {
  const f = P.filt, q = norm(f.q);
  return (P.c.couples || []).filter(c => (f.lg === 'all' || c.league === f.lg) && (f.f === 'all' || (c.partner.fields || []).includes(f.f)) && (f.st === 'all' || c.status === f.st)
    && (!q || norm([c.athlete.name, c.partner.name, c.athlete.team, c.partner.known_for, c.sport].join(' ')).includes(q)));
}
function order(cs) { // in the news first, then the ones with a game soon, then by name
  return cs.slice().sort((a, b) => n7(b.id) - n7(a.id) || ((nextUp(a) || {}).when || 'z').localeCompare((nextUp(b) || {}).when || 'z') || a.athlete.name.localeCompare(b.athlete.name));
}
function calendar(days) { // the athletes' next games and the partners' dated projects, the next N days
  const out = [], now = Date.now(), end = now + days * 864e5;
  for (const c of P.c.couples || []) {
    const nx = nextUp(c);
    if (nx && Date.parse(nx.when) < end) out.push({ t: Date.parse(nx.when), c, side: 'a', what: nx.what, sub: nx.tv || '', href: nx.href, label: when(nx.when), live: nx.live });
    for (const p of c.partner.projects || []) { const d = dayOf(p.when); if (d && d.exact && d.t >= now - 864e5 && d.t < end) out.push({ t: d.t, c, side: 'p', what: p.what, label: d.l, href: '#/plusone/' + c.id }); }
  }
  return out.sort((a, b) => a.t - b.t);
}
function projects() { // every partner project with a date, upcoming first, then the latest
  const out = [];
  for (const c of P.c.couples || []) for (const p of c.partner.projects || []) { const d = dayOf(p.when); if (d) out.push({ c, p, d }); }
  const now = Date.now();
  const up = out.filter(x => x.d.t >= now - 15 * 864e5).sort((a, b) => a.d.t - b.d.t), past = out.filter(x => x.d.t < now - 15 * 864e5).sort((a, b) => b.d.t - a.d.t);
  return { up, past };
}

async function renderHome(sel) {
  await ensureSchedules();
  if (W.view.t !== 'plus') return;
  if (sel && LG[sel]) P.filt.lg = sel;
  const cs = P.c.couples || [], top = order(cs).slice(0, 4), cal = calendar(14), pj = projects();
  const lgs = Object.keys(LG).filter(k => cs.some(c => c.league === k)), fields = Object.keys(FIELD).filter(f => cs.some(c => (c.partner.fields || []).includes(f)));
  const counts = { married: cs.filter(c => c.status === 'married').length, engaged: cs.filter(c => c.status === 'engaged').length, dating: cs.filter(c => c.status === 'dating').length };
  const allNews = cs.flatMap(c => news(c.id).map(n => ({ n, c }))).sort((a, b) => a.n.p < b.n.p ? 1 : -1).filter((x, i, arr) => arr.findIndex(y => y.n.u === x.n.u) === i);
  shell(`
    <header class="po-head"><p class="po-x"><a href="#/s/sports">${esc(W.secName('sports'))}</a><span>×</span><a href="#/s/lifestyle">${esc(W.secName('lifestyle'))}</a><span>×</span><a href="#/s/culture">${esc(W.secName('culture'))}</a></p>
      <h1>Plus One</h1><p class="po-dek">${T('The players and the people beside them: athletes and their partners who are stars in their own right, from the paddock and the sidelines to the red carpet and the recording studio.')}</p>
      <p class="po-ct"><span><b>${cs.length}</b> ${T('couples')}</span><span><b>${counts.married}</b> ${T('married')}</span><span><b>${counts.engaged}</b> ${T('engaged')}</span><span><b>${counts.dating}</b> ${T('together')}</span><span><b>${lgs.length}</b> ${T('sports')}</span></p></header>
    ${top.length ? `<section class="po-top">${top.map((c, i) => i === 0 ? lead(c) : card(c)).join('')}</section>` : ''}
    <section class="blk po-calb"><div class="blk-h"><h2 class="sec-h">${T('On the calendar')}</h2><span class="note">${T('The next two weeks: their games and races, and the partners’ releases, premieres and events. Times are yours.')}</span></div>
      ${cal.length ? `<ol class="po-cal">${cal.slice(0, 18).map(x => `<li class="${x.side}${x.live ? ' live' : ''}"><span class="d">${x.live ? '● ' + T('Now') : esc(x.label)}</span><a class="w" href="${esc(x.href)}">${mark(x.c, 'xs')}<span><b${enAttr()}>${esc(x.side === 'a' ? x.c.athlete.name : x.c.partner.name)}</b> <span${enAttr()}>${esc(x.what)}</span>${x.sub ? ` <small>${esc(x.sub)}</small>` : ''}</span></a><span class="tg">${x.side === 'a' ? esc(T(LG[x.c.league] || x.c.sport)) : esc(T((x.c.partner.fields || [])[0] || ''))}</span></li>`).join('')}</ol>` : `<p class="note">${T('Nothing dated in the next two weeks.')}</p>`}</section>
    <section class="blk" id="po-all"><div class="blk-h"><h2 class="sec-h">${T('Every couple')}</h2></div>
      <div class="po-fl">
        <div class="tags" role="group" aria-label="${T('Sport')}"><button type="button" class="chip" data-lg="all" aria-pressed="${P.filt.lg === 'all'}">${T('All')} <span class="x">${cs.length}</span></button>${lgs.map(k => `<button type="button" class="chip" data-lg="${k}" aria-pressed="${P.filt.lg === k}">${esc(T(LG[k]))} <span class="x">${cs.filter(c => c.league === k).length}</span></button>`).join('')}</div>
        <div class="tags" role="group" aria-label="${T('Their partner works in')}"><span class="po-fll">${T('Partner in')}</span><button type="button" class="chip" data-f="all" aria-pressed="${P.filt.f === 'all'}">${T('Anything')}</button>${fields.map(f => `<button type="button" class="chip po-fchip" data-f="${esc(f)}" aria-pressed="${P.filt.f === f}" style="--fc:${FIELD[f]}"><i></i>${esc(T(f))}</button>`).join('')}</div>
        <div class="po-fr"><div class="seg" role="group" aria-label="${T('Status')}">${[['all', 'All'], ['married', 'Married'], ['engaged', 'Engaged'], ['dating', 'Together']].map(([k, l]) => `<button type="button" data-st="${k}" aria-pressed="${P.filt.st === k}">${T(l)}</button>`).join('')}</div>
          <label class="po-q"><span class="sr">${T('Find a player or partner')}</span><input id="poq" type="search" placeholder="${esc(T('Find a player or partner'))}" value="${esc(P.filt.q)}" autocomplete="off"></label></div></div>
      <div class="po-grid" id="pogrid">${gridHTML()}</div></section>
    <section class="blk"><div class="blk-h"><h2 class="sec-h">${T('The style file')}</h2><a class="more" href="#/s/lifestyle">${esc(W.secName('lifestyle'))} →</a></div><p class="sub2">${T('Paddocks, sidelines, tunnels and red carpets: the looks and the nights out the fashion press wrote about.')}</p>
      <div class="po-style">${order(cs).filter(c => c.style).slice(0, 8).map(c => `<a href="#/plusone/${esc(c.id)}#po-style" style="--fc:${fcol(c)}"><span class="po-k">${esc(c.athlete.name)} &amp; ${esc(c.partner.name)}</span><span class="q"${enAttr()}>${esc(firstSentence(c.style))}</span></a>`).join('')}</div></section>
    <section class="blk"><div class="blk-h"><h2 class="sec-h">${T('The culture desk')}</h2><a class="more" href="#/s/culture">${esc(W.secName('culture'))} →</a></div><p class="sub2">${T('The partners’ own work: albums and tours, films and series, collections and companies, coming up and just out.')}</p>
      <div class="po-pj"><div><h3 class="glb">${T('Coming up')}</h3>${pjList(pj.up.slice(0, 12))}</div><div><h3 class="glb">${T('Just out')}</h3>${pjList(pj.past.slice(0, 12))}</div></div></section>
    <section class="blk"><div class="blk-h"><h2 class="sec-h">${T('In the news')}</h2></div>
      ${allNews.length ? `<ul class="glist po-news">${allNews.slice(0, 24).map(({ n, c }) => newsLi(n, c)).join('')}</ul>` : `<p class="note">${T('The news about them arrives with the next update.')}</p>`}</section>`, '');
  window.scrollTo(0, 0);
}
function lead(c) {
  const h = news(c.id).slice(0, 3), nx = nextUp(c);
  return `<a class="po-lead" href="#/plusone/${esc(c.id)}" style="--tc:${tcol(c)};--fc:${fcol(c)}">${mark(c, 'lg')}
    <span class="po-k">${n7(c.id) ? T('In the news this week') : T('This week')} · ${esc(T(LG[c.league] || c.sport))}</span>
    <span class="po-n"${enAttr()}>${esc(c.athlete.name)} <i>&amp;</i> ${esc(c.partner.name)}</span>
    <span class="po-kf"${enAttr()}>${esc(c.athlete.role)}${c.athlete.team ? ', ' + esc(c.athlete.team) : ''} · ${esc(c.partner.known_for)}</span>
    <span class="po-d"${enAttr()}>${esc(firstSentence(c.story))}</span>
    ${nx ? `<span class="po-nx">${T('Next')}: ${nx.live ? '● ' + T('Playing now') : esc(when(nx.when))} · ${esc(nx.what)}</span>` : ''}
    ${h.length ? `<span class="po-hls">${h.map(x => `<span><b>${esc(x.o)}</b> ${esc(x.t)}</span>`).join('')}</span>` : ''}</a>`;
}
function gridHTML() {
  const cs = order(filtered());
  return cs.length ? cs.map(card).join('') : `<p class="note">${T('No couple matches that.')}</p>`;
}
function pjList(xs) {
  return xs.length ? `<ul class="po-pjl">${xs.map(({ c, p, d }) => `<li style="--fc:${fcol(c)}"><span class="d">${esc(d.l)}</span><span class="w"><a href="#/plusone/${esc(c.id)}"><b>${esc(c.partner.name)}</b></a> <span${enAttr()}>${esc(p.what)}</span><small>${T('with {who}', { who: esc(c.athlete.name) })}</small></span></li>`).join('')}</ul>` : `<p class="note">${T('Nothing dated yet.')}</p>`;
}
function newsLi(n, c) {
  return `<li>${n.m ? `<img src="${esc(n.m)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<div><a href="${esc(n.u)}" target="_blank" rel="noopener">${esc(n.t)}</a> <span>${esc(n.o)} · ${ago(isoMin(n.p))}${c ? ` · <a class="tagr" href="#/plusone/${esc(c.id)}">${esc(last(c.athlete.name))} &amp; ${esc(first(c.partner.name))}</a>` : ''}</span></div></li>`;
}

/* ================= one couple ================= */
async function renderCouple(id) {
  const c = P.by[id];
  if (!c) return shell(`<div class="state"><h2>${T('That couple isn’t here')}</h2><p><a href="#/plusone">Plus One</a></p></div>`, '');
  await ensureSchedules();
  if (W.view.t !== 'plus' || W.view.p !== id) return;
  const t = team(c), nx = nextUp(c), s = c.sources || [], pj = (c.partner.projects || []).map(p => ({ p, d: dayOf(p.when) })).sort((a, b) => ((b.d || {}).t || 0) - ((a.d || {}).t || 0));
  const more = order((P.c.couples || []).filter(x => x.id !== id && x.league === c.league)).slice(0, 4);
  const ns = news(id);
  const aHref = c.league === 'f1' && c.athlete.f1 ? '#/f1/driver/' + c.athlete.f1 : t && t.id && t.lg ? `#/sports/${t.lg}/t/${t.id}` : '';
  shell(`<article class="po-cp" style="--tc:${tcol(c)};--fc:${fcol(c)}">
    <p class="crumb"><a href="#/plusone">Plus One</a> · <a href="#/plusone/${esc(c.league)}">${esc(T(LG[c.league] || c.sport))}</a></p>
    <header class="po-ch">${mark(c, 'xl')}<div><h1${enAttr()}>${esc(c.athlete.name)} <i>&amp;</i> ${esc(c.partner.name)}</h1>
      <p class="po-st">${esc(statusLine(c))}</p>
      <p class="note">${T('Checked {date}.', { date: esc(fmt((c.checked || P.c.updated) + (String(c.checked || '').length === 10 ? 'T12:00:00Z' : ''), { month: 'long', day: 'numeric', year: 'numeric' })) })} ${T('Written by Claude from {n} sources.', { n: s.length })}</p></div></header>
    <section class="po-two">
      <div class="po-side a"><span class="po-k">${esc(T(LG[c.league] || c.sport))}</span><h2${enAttr()}>${aHref ? `<a href="${esc(aHref)}">${esc(c.athlete.name)}</a>` : esc(c.athlete.name)}</h2>
        <p${enAttr()}>${esc(c.athlete.role)}${c.athlete.team ? ' · ' + esc(c.athlete.team) : ''}${c.athlete.nationality ? ' · ' + esc(c.athlete.nationality) : ''}</p>
        ${nx ? `<a class="po-next" href="${esc(nx.href)}"><span>${T('Next up')}</span><b>${nx.live ? '● ' + T('Playing now') : esc(when(nx.when))}</b><span>${esc(nx.what)}${nx.tv ? ' · ' + esc(nx.tv) : ''}</span></a>` : ''}</div>
      <div class="po-side p"><span class="po-k">${fieldChips(c)}</span><h2${enAttr()}>${esc(c.partner.name)}</h2>
        <p${enAttr()}>${esc(c.partner.known_for)}${c.partner.nationality ? ' · ' + esc(c.partner.nationality) : ''}</p>
        ${pj.length ? `<ul class="po-pjl sm">${pj.slice(0, 4).map(({ p, d }) => `<li><span class="d">${d ? esc(d.l) : ''}</span><span class="w"${enAttr()}>${esc(p.what)}</span></li>`).join('')}</ul>` : ''}</div></section>
    <section class="po-body"><div${enAttr()}><h2 class="sec-h">${T('Their story')}</h2><div class="po-rep">${mdx(c.story, s)}</div></div>
      ${(c.milestones || []).length ? `<aside><h2 class="sec-h">${T('Milestones')}</h2><ol class="po-tl">${c.milestones.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map(m => `<li><span class="d">${esc((dayOf(m.date) || { l: m.date }).l)}</span><span${enAttr()}>${plain(m.what)}${(m.src || []).map(k => s[k - 1] ? `<sup class="cite"><a href="${esc(s[k - 1].u)}" target="_blank" rel="noopener" title="${esc(s[k - 1].o)}">${k}</a></sup>` : '').join('')}</span></li>`).join('')}</ol></aside>` : ''}</section>
    <section class="po-sc">${c.style ? `<div id="po-style"><span class="po-desk">${esc(W.secName('lifestyle'))}</span><h2 class="sec-h">${T('Style')}</h2><div class="po-rep"${enAttr()}>${mdx(c.style, s)}</div></div>` : ''}
      ${c.culture ? `<div><span class="po-desk">${esc(W.secName('culture'))}</span><h2 class="sec-h">${T('Culture')}</h2><div class="po-rep"${enAttr()}>${mdx(c.culture, s)}</div></div>` : ''}</section>
    <section class="blk"><h2 class="sec-h">${T('In the news')}</h2>${ns.length ? `<ul class="glist po-news">${ns.slice(0, 12).map(n => newsLi(n)).join('')}</ul>` : `<p class="note">${T('Nothing about them in the last month from the outlets Plus One reads.')}</p>`}</section>
    <details class="po-src"><summary>${T('Sources')} <span>${s.length}</span></summary><ol>${s.map(x => `<li><a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.t)}</a> <span>${esc(x.o)}${x.d ? ', ' + esc(x.d) : ''}</span></li>`).join('')}</ol></details>
    ${more.length ? `<section class="blk"><h2 class="sec-h">${T('More from {sport}', { sport: esc(T(LG[c.league] || c.sport)) })}</h2><div class="po-grid">${more.map(card).join('')}</div></section>` : ''}
  </article>`, c.athlete.name + ' & ' + c.partner.name);
}

/* ================= the desk cards ================= */
function deskCard(k) {
  const cs = order(P.c.couples || []), top = cs.slice(0, 3), pj = projects().up.slice(0, 2);
  const icon = `<span class="t90v" aria-hidden="true"><svg viewBox="0 0 132 88"><circle cx="48" cy="44" r="36" fill="#15243B" fill-opacity=".1" stroke="#A9852F" stroke-width="2"/><circle cx="84" cy="44" r="36" fill="#d55181" fill-opacity=".12" stroke="#d55181" stroke-width="2"/><text x="66" y="54" text-anchor="middle">+1</text></svg></span>`;
  const sub = k === 'culture' && pj.length ? T('Coming up: {list}.', { list: pj.map(x => `${x.c.partner.name}, ${x.p.what} (${x.d.l})`).join('; ') })
    : top.length ? T('This week: {list}.', { list: top.map(c => `${c.athlete.name} & ${c.partner.name}`).join(' · ') }) : '';
  const head = k === 'sports' ? T('Off the field, on the red carpet') : k === 'culture' ? T('Stars in their own right, beside the stars of sport') : T('The players and the people beside them');
  return `<a class="t90f po-dc" href="#/plusone"${''}>${icon}<span class="t90t"><span class="k">Plus One · ${esc(W.secName('sports'))} × ${esc(W.secName('lifestyle'))} × ${esc(W.secName('culture'))}</span><b>${head}</b>
    <span class="d">${T('{n} couples, from the F1 paddock to the NFL sideline: their stories, their style, the partners’ own work, and when to see them next.', { n: (P.c.couples || []).length })}${sub ? ` <span${enAttr()}>${esc(sub)}</span>` : ''}</span>
    <span class="go">${T('Open Plus One')} ›</span></span></a>`;
}

/* ================= interaction ================= */
function bind() {
  const grid = $('#pogrid'); if (!grid) return;
  const redraw = () => { grid.innerHTML = gridHTML(); };
  for (const b of document.querySelectorAll('[data-lg]')) if (b.tagName === 'BUTTON') b.onclick = () => { P.filt.lg = b.dataset.lg; for (const x of document.querySelectorAll('button[data-lg]')) x.setAttribute('aria-pressed', String(x === b)); redraw(); };
  for (const b of document.querySelectorAll('button[data-f]')) b.onclick = () => { P.filt.f = b.dataset.f; for (const x of document.querySelectorAll('button[data-f]')) x.setAttribute('aria-pressed', String(x === b)); redraw(); };
  for (const b of document.querySelectorAll('button[data-st]')) b.onclick = () => { P.filt.st = b.dataset.st; for (const x of document.querySelectorAll('button[data-st]')) x.setAttribute('aria-pressed', String(x === b)); redraw(); };
  const q = $('#poq'); if (q) q.oninput = () => { P.filt.q = q.value; redraw(); };
}

/* ================= the look ================= */
const CSS = `
.po{padding-bottom:40px}
.po-head{padding:26px 0 6px;border-bottom:1px solid var(--rule);margin-bottom:22px}
.po-x{display:flex;align-items:center;gap:8px;margin:0 0 6px;font:600 12.5px var(--sans);letter-spacing:.08em;text-transform:uppercase}.po-x a{color:var(--brass-ink);text-decoration:none}.po-x span{color:var(--ink-3)}
.po-head h1{font:400 76px/.95 var(--serif);margin:0 0 10px;letter-spacing:-.015em}
.po-dek{font:400 22px/1.4 var(--serif);color:var(--ink-2);margin:0 0 14px;max-width:62ch}
.po-ct{display:flex;flex-wrap:wrap;gap:6px 22px;margin:0 0 16px;font-size:14px;color:var(--ink-2)}.po-ct b{font:400 26px/1 var(--serif);color:var(--ink);margin-right:5px}
.po-mk{display:block;flex:none}.po-mk text{font:600 22px var(--sans);fill:var(--ink);letter-spacing:.02em}
.po-mk.xs{width:42px;height:28px}.po-mk.md{width:96px;height:64px}.po-mk.lg{width:150px;height:100px}.po-mk.xl{width:180px;height:120px}
.po-k{display:block;font:700 11.5px/1.3 var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.po-n{display:block;font:400 25px/1.1 var(--serif);color:var(--ink)}.po-n i{font-style:italic;color:var(--brass-ink)}
.po-kf{display:block;font-size:14px;line-height:1.4;color:var(--ink-2)}
.po-st{display:block;font:600 13px var(--sans);color:var(--ink-2);margin:0}
.po-nx{display:block;font:600 13px var(--sans);color:var(--brass-ink)}
.po-hl{display:block;font-size:13px;line-height:1.4;color:var(--ink-2);border-top:1px solid var(--rule);padding-top:8px;margin-top:4px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.po-hl b{color:var(--ink)}
.po-top{display:grid;grid-template-columns:minmax(0,1.6fr) repeat(3,minmax(0,1fr));gap:14px}
.po-card,.po-lead{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:inherit;background:var(--raise);border:1px solid var(--rule);border-radius:16px;padding:16px 16px 14px}
.po-card:hover,.po-lead:hover{border-color:var(--brass)}
.po-lead{background:#0E1A2B;color:#EEF1F4;border-color:#0E1A2B;position:relative;overflow:hidden}
.po-lead .po-mk text{fill:#EEF1F4}.po-lead .po-k{color:#D6B25E}.po-lead .po-n{color:#fff;font-size:34px}.po-lead .po-n i{color:#D6B25E}.po-lead .po-kf{color:#B9C3CF}
.po-lead .po-d{font:400 17px/1.5 var(--serif);color:#DDE4EC}.po-lead .po-nx{color:#D6B25E}
.po-lead .po-hls{display:flex;flex-direction:column;gap:6px;border-top:1px solid rgba(255,255,255,.14);padding-top:10px;margin-top:4px;font-size:13.5px;color:#B9C3CF}.po-lead .po-hls b{color:#fff}
.po-calb .blk-h .note{margin:0}
.po-cal{list-style:none;margin:10px 0 0;padding:0;columns:2;column-gap:34px}
.po-cal li{display:grid;grid-template-columns:150px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--rule);break-inside:avoid}
.po-cal .d{font:600 13px var(--sans);color:var(--ink-2);font-variant-numeric:tabular-nums}.po-cal li.live .d{color:var(--signal)}
.po-cal .w{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);font-size:14.5px;line-height:1.35;min-width:0}.po-cal .w small{color:var(--ink-3)}
.po-cal .tg{font:700 10.5px var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}.po-cal li.p .tg{color:var(--brass-ink)}
.po-fl{display:flex;flex-direction:column;gap:10px;margin:8px 0 16px}.po-fl .tags{margin:0;align-items:center}
.po-fll{font:600 12.5px var(--sans);color:var(--ink-3);margin-right:2px}
.po-fchip i{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--fc)}
.po-fr{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.po-fr .seg{margin-left:0}
.po-q input{width:260px;font:500 15px var(--sans);color:var(--ink);background:var(--raise);border:1px solid var(--rule);border-radius:999px;padding:8px 14px}
.po-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.po-style{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.po-style a{display:flex;flex-direction:column;gap:8px;text-decoration:none;color:inherit;border-left:3px solid var(--fc);padding:4px 0 4px 14px}
.po-style .q{font:400 18px/1.4 var(--serif);color:var(--ink)}.po-style a:hover .q{text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}
.po-pj{display:grid;grid-template-columns:1fr 1fr;gap:34px}
.po-pjl{list-style:none;margin:0;padding:0}.po-pjl li{display:grid;grid-template-columns:120px minmax(0,1fr);gap:10px;padding:9px 0 9px 12px;border-bottom:1px solid var(--rule);border-left:3px solid var(--fc,var(--rule));font-size:14.5px;line-height:1.4}
.po-pjl .d{font:600 12.5px var(--sans);color:var(--ink-2)}.po-pjl a{color:var(--ink);text-decoration:none}.po-pjl small{display:block;color:var(--ink-3);font-size:12.5px}
.po-pjl.sm li{grid-template-columns:96px minmax(0,1fr);border-left:0;padding-left:0}
.po-news li{display:flex;gap:12px;align-items:flex-start}.po-news img{width:84px;height:56px;object-fit:cover;border-radius:6px;flex:none;background:var(--shoal)}.po-news .tagr{color:var(--brass-ink);text-decoration:none;font-weight:600}
.po-foot{margin:46px 0 0;padding-top:14px;border-top:1px solid var(--rule);font-size:13px;color:var(--ink-3);max-width:90ch}
.po-cp{padding-top:22px}
.po-ch{display:flex;align-items:center;gap:26px;margin:4px 0 18px}.po-ch h1{font:400 58px/1.02 var(--serif);margin:0 0 8px;letter-spacing:-.01em}.po-ch h1 i{color:var(--brass-ink)}.po-ch .note{margin:6px 0 0}
.po-two{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--rule);border:1px solid var(--rule);border-radius:16px;overflow:hidden}
.po-side{background:var(--raise);padding:18px 20px}.po-side.a{border-top:4px solid var(--tc)}.po-side.p{border-top:4px solid var(--fc)}
.po-side h2{font:400 32px/1.05 var(--serif);margin:6px 0 4px}.po-side h2 a{color:inherit;text-decoration:none}.po-side h2 a:hover{text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1px}.po-side p{margin:0 0 10px;color:var(--ink-2)}
.po-fc{display:inline-flex;align-items:center;gap:5px;margin-right:10px}.po-fc::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--fc)}
.po-next{display:flex;flex-direction:column;gap:2px;text-decoration:none;color:var(--ink);border:1px solid var(--rule);border-radius:12px;padding:10px 14px;margin-top:6px;background:var(--paper)}.po-next span{font-size:13px;color:var(--ink-2)}.po-next span:first-child{font:700 11px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--brass-ink)}.po-next b{font:600 17px var(--sans)}
.po-body{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:40px;margin-top:34px}
.po-rep{font:400 18px/1.64 Georgia,'Iowan Old Style',serif}.po-rep p{margin:0 0 .9em}
.po-tl{list-style:none;margin:0;padding:0 0 0 16px;border-left:2px solid var(--rule)}.po-tl li{position:relative;padding:0 0 16px 8px;font-size:15px;line-height:1.45}
.po-tl li::before{content:"";position:absolute;left:-23px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--raise);border:2px solid var(--fc)}.po-tl .d{display:block;font:700 11.5px var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin-bottom:2px}
.po-sc{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:34px}.po-sc>div{border-top:2px solid var(--ink);padding-top:12px}
.po-desk{display:inline-block;font:700 11px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--brass-ink);margin-bottom:4px}
.po-src{margin:26px 0 0;font-size:13.5px}.po-src summary{cursor:pointer;font:600 13px var(--sans);color:var(--ink-2)}.po-src summary span{color:var(--ink-3);font-weight:500}.po-src ol{margin:8px 0 0;padding-left:1.4em;columns:2;column-gap:26px}.po-src li{margin:0 0 5px;break-inside:avoid}.po-src li span{color:var(--ink-3)}
.po-dc .t90v text{font:italic 30px var(--serif);fill:var(--ink)}
.f1po{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
@media (max-width:980px){.po-top{grid-template-columns:1fr 1fr}.po-top .po-lead{grid-column:1/-1}}
@media (max-width:820px){
  .po-head h1{font-size:54px}.po-dek{font-size:19px}.po-top{grid-template-columns:1fr}.po-cal{columns:1}.po-cal li{grid-template-columns:96px minmax(0,1fr)}.po-cal .tg{display:none}
  .po-pj,.po-two,.po-body,.po-sc{grid-template-columns:1fr;gap:20px}.po-ch{flex-direction:column;align-items:flex-start;gap:12px}.po-ch h1{font-size:38px}.po-mk.xl{width:132px;height:88px}
  .po-q input{width:100%}.po-q{flex:1 1 100%}.po-src ol{columns:1}.po-lead .po-n{font-size:28px}
}`;
function css() { if (document.getElementById('pocss')) return; const s = document.createElement('style'); s.id = 'pocss'; s.textContent = CSS; document.head.appendChild(s); }

/* ================= hooks for the page and the F1 hub ================= */
async function render(p) {
  css();
  if (!P.c) {
    $('#main').innerHTML = `<div class="wrap state"><h2>${T('Opening Plus One…')}</h2></div>`;
    try { await ensure(); } catch (e) { $('#main').innerHTML = `<div class="wrap state"><h2>${T('Plus One didn’t load')}</h2><p>${T('Check your connection and try again.')}</p></div>`; return; }
    if (W.view.t !== 'plus' || W.view.p !== p) return;
  }
  if (p && P.by[p]) return renderCouple(p);
  return renderHome(p);
}
window.PLUS = {
  render,
  desk: async k => {
    css();
    try { await ensure(); } catch (e) { return; }
    if (W.view.t !== 'desk' || W.view.k !== k) return;
    const host = document.querySelector('#main .wrap'); if (!host || host.querySelector('.po-dc')) return;
    const box = document.createElement('div'); box.innerHTML = deskCard(k);
    const cardEl = box.firstElementChild;
    let top = host.querySelector('.desk-top');
    if (!top) { top = document.createElement('div'); top.className = 'desk-top'; host.prepend(top); }
    const feats = top.querySelectorAll(':scope > .t90f, :scope > .f1desk');
    if (k === 'lifestyle' && feats.length) feats[0].after(cardEl); // Lifestyle: right after Together / 90
    else if (feats.length) feats[feats.length - 1].after(cardEl);
    else { const sp = top.querySelector('#spTop'); if (sp) sp.after(cardEl); else top.prepend(cardEl); }
  },
  f1: async () => { // the F1 hub's drivers: who has a Plus One page. -> {driverId: couple}
    await ensure(); const out = {};
    for (const c of P.c.couples || []) if (c.league === 'f1' && c.athlete.f1) out[c.athlete.f1] = { id: c.id, partner: c.partner.name, known_for: c.partner.known_for, status: STATUS[c.status] || c.status, mark: mark(c, 'md'), first: firstSentence(c.story) };
    css(); return out;
  },
};
})();
