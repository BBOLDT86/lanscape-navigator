/* The Watch · Sports: scores, schedules, standings, teams and each league's news.

   Loaded by news/index.html when the Sports desk or a league page opens; the page hands over its helpers as
   window.WatchKit. The data is news/data/sports/<league>.json and index.json, written by news/updater/sports.py with
   every edition. While a page is open the scores come live from ESPN's public scoreboard service (it lets browsers
   read it), every 30 seconds while a game is on; when ESPN can't be reached the edition's copy is shown and dated.
   Followed teams live in this browser only (localStorage watch.teams). Routes:
     #/s/sports                      the desk: today's games across the leagues above the stories
     #/sports/<lg>[/<tab>[/<day>]]   a league: scores (a day, or w<n> for an NFL week), schedule, standings, news, teams
     #/sports/soccer/<comp>/...      one soccer competition (epl, ucl, laliga, bund, seriea, ligue1, uel, bra)
     #/sports/<lg>/g/<id>            a game: the score, the box score, the plays that scored, where to watch, tickets
     #/sports/<lg>/t/<id>            a team: its schedule and results, its standing and its news */
(() => {
'use strict';
const K = window.WatchKit;
const { T, esc, $, $$ } = K;
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/';
const LEAGUES = {
  nfl: { n: 'NFL', full: 'National Football League', path: 'football/nfl', sport: 'football', week: true },
  nba: { n: 'NBA', full: 'National Basketball Association', path: 'basketball/nba', sport: 'basketball' },
  mlb: { n: 'MLB', full: 'Major League Baseball', path: 'baseball/mlb', sport: 'baseball' },
  nhl: { n: 'NHL', full: 'National Hockey League', path: 'hockey/nhl', sport: 'hockey' },
  wnba: { n: 'WNBA', full: 'Women’s National Basketball Association', path: 'basketball/wnba', sport: 'basketball' },
  mls: { n: 'MLS', full: 'Major League Soccer', path: 'soccer/usa.1', sport: 'soccer' },
  soccer: { n: 'Soccer', full: 'Europe’s leagues, the Champions League and the Brasileirão', path: null, sport: 'soccer' },
};
const ORDER = ['nfl', 'nba', 'mlb', 'nhl', 'wnba', 'mls', 'soccer'];
const COMPS = { // soccer competitions: ESPN slug, name
  epl: ['eng.1', 'Premier League'], ucl: ['uefa.champions', 'Champions League'], laliga: ['esp.1', 'LaLiga'], bund: ['ger.1', 'Bundesliga'],
  seriea: ['ita.1', 'Serie A'], ligue1: ['fra.1', 'Ligue 1'], uel: ['uefa.europa', 'Europa League'], bra: ['bra.1', 'Brasileirão'],
};
const COMP_ORDER = ['epl', 'ucl', 'laliga', 'bund', 'seriea', 'ligue1', 'uel', 'bra'];
// other sports sections on The Watch get a chip next to the leagues: [key, name, link, a few words, shown until (ET day)]
const EXTRA = [
  ['f1', 'F1', '#/f1', '', ''], // the Formula 1 hub (f1/app.js); its line comes from index.json's f1
  ['film', 'Film Room', 'sports/fantasy/', 'Fantasy football', ''], // the fantasy football section
  ['dressage', 'Dressage', 'sports/dressage-finals/', 'Finals Sat Oct 31', '2026-11-01'],
].concat(window.WatchSportsExtra || []);
function f1Line() { // the next grand prix, or its session on now
  const f = S.idx && S.idx.f1; if (!f || !f.start) return T('Races, drivers and cars');
  const gp = String(f.name || '').replace(/ Grand Prix$/, ' GP');
  const ses = f.session; if (ses && until(ses[1]) < 0) return `<i class="spdot"></i>${esc(gp)}`;
  return esc(gp) + ' · ' + esc(dayName(dayKey(f.start)));
}
const TABS = [['scores', 'Scores'], ['schedule', 'Schedule'], ['standings', 'Standings'], ['news', 'News'], ['teams', 'Teams']];
const FAVK = 'watch.teams';
const S = { idx: null, lg: {}, live: {}, sum: {}, team: {}, busy: {}, timer: 0, at: {} };

/* ---------------------------------------------------------------- small helpers */
const LOC = () => K.LOC();
const ET = 'America/New_York';
const fmtDayKey = new Intl.DateTimeFormat('en-CA', { timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = d => fmtDayKey.format(d instanceof Date ? d : new Date(d));
const todayKey = () => dayKey(new Date());
const addDays = (k, n) => { const d = new Date(k + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmtTime = iso => new Intl.DateTimeFormat(LOC(), { hour: 'numeric', minute: '2-digit' }).format(new Date(iso)).replace(':00', LOC() === 'en-US' ? '' : ':00');
const fmtTimeFull = iso => new Intl.DateTimeFormat(LOC(), { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso));
const fmtDow = k => new Intl.DateTimeFormat(LOC(), { weekday: 'short', timeZone: 'UTC' }).format(new Date(k + 'T12:00:00Z'));
const fmtMD = k => new Intl.DateTimeFormat(LOC(), { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(k + 'T12:00:00Z'));
const fmtLongDay = k => new Intl.DateTimeFormat(LOC(), { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(k + 'T12:00:00Z'));
const fmtDate = iso => new Intl.DateTimeFormat(LOC(), { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso));
function dayName(k) {
  const t = todayKey();
  if (k === t) return T('Today');
  if (k === addDays(t, 1)) return T('Tomorrow');
  if (k === addDays(t, -1)) return T('Yesterday');
  return fmtDow(k) + ' ' + fmtMD(k).replace(/^\D+\s/, '');
}
function phaseT(p) { // ESPN's words for where a season is, in the reader's language where we can
  if (!p) return '';
  let m = p.match(/^Week (\d+)$/); if (m) return T('Week {n}', { n: m[1] });
  m = p.match(/^(\d+) rounds played$/); if (m) return T('{n} rounds played', { n: m[1] });
  return T(p);
}
function agoIso(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (!isFinite(m)) return '';
  if (m < 2) return T('Just now');
  if (m < 60) return T('{n}m ago', { n: m });
  if (m < 60 * 24) return T('{n}h ago', { n: Math.round(m / 60) });
  return fmtDate(iso);
}
const until = iso => new Date(iso) - Date.now();
function logo(u, size = 64) {
  if (!u) return '';
  const m = u.match(/^https:\/\/a\.espncdn\.com(\/i\/teamlogos\/[^?]+\.png)$/);
  return m ? `https://a.espncdn.com/combiner/i?img=${m[1]}&w=${size}&h=${size}` : u;
}
const img = (u, cls, size) => u ? `<img class="${cls}" src="${esc(logo(u, size))}" data-fb="${esc(u)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : `<span class="${cls} nologo"></span>`;
const lgOf = g => (g.cp && COMPS[g.cp]) ? 'soccer' : g.lg;
const lgName = (lg, cp) => cp && COMPS[cp] ? COMPS[cp][1] : LEAGUES[lg] ? LEAGUES[lg].n : (lg || '').toUpperCase();
function favs() { try { return new Set(JSON.parse(K.lsGet(FAVK) || '[]')); } catch (e) { return new Set(); } }
function setFav(key, on) { const f = favs(); if (on) f.add(key); else f.delete(key); K.lsSet(FAVK, JSON.stringify([...f])); }
const favKey = (lg, id) => lg + ':' + id;
const isFav = (lg, id) => favs().has(favKey(lg, id));
const gameFav = g => isFav(lgOf(g), g.h.id) || isFav(lgOf(g), g.a.id);
const STATUS = { Final: 'Final', FT: 'FT', HT: 'HT', Halftime: 'Halftime', Postponed: 'Postponed', Canceled: 'Canceled', Delayed: 'Delayed', 'Final/OT': 'Final/OT', 'Final/SO': 'Final/SO', AET: 'AET' };
const statusT = s => s === 'Scheduled' ? '' : STATUS[s] ? T(STATUS[s]) : s;

/* ---------------------------------------------------------------- data: the edition's copy */
async function loadIdx(force) {
  if (S.idx && !force && Date.now() - S.at.idx < 120000) return S.idx;
  if (S.busy.idx) return S.busy.idx;
  S.busy.idx = K.getJSON('data/sports/index.json').then(d => { S.idx = d; S.at.idx = Date.now(); return d; }).catch(() => S.idx).finally(() => { S.busy.idx = null; });
  return S.busy.idx;
}
async function loadLg(lg, force) {
  if (S.lg[lg] && !force && Date.now() - S.at[lg] < 300000) return S.lg[lg];
  if (S.busy[lg]) return S.busy[lg];
  S.busy[lg] = K.getJSON('data/sports/' + lg + '.json').then(d => { S.lg[lg] = d; S.at[lg] = Date.now(); return d; }).catch(() => S.lg[lg] || null).finally(() => { S.busy[lg] = null; });
  return S.busy[lg];
}

/* ---------------------------------------------------------------- data: live from ESPN (a port of compact() in sports.py) */
async function espn(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
function side(c) {
  c = c || {}; const t = c.team || {};
  const lo = t.logo || ((t.logos || [])[0] || {}).href || '';
  const o = { id: t.id || c.id, ab: t.abbreviation || '', nm: t.displayName || t.name || '', sh: t.shortDisplayName || t.name || '', lo, c: t.color || '', sc: c.score, w: !!c.winner };
  if (c.score && typeof c.score === 'object') o.sc = c.score.displayValue;
  const rec = c.records || c.record || [];
  if (rec.length) o.r = rec[0].summary || rec[0].displayValue || '';
  const ls = (c.linescores || []).map(l => l.displayValue != null ? String(l.displayValue) : l.value != null ? String(Math.round(l.value * 10) / 10) : '');
  if (ls.length) o.ls = ls;
  if (c.form) o.f = c.form;
  const rk = (c.curatedRank || {}).current; if (rk && rk < 26) o.rk = rk;
  if (c.shootoutScore != null) o.so = c.shootoutScore;
  if (c.hits != null) o.hi = c.hits;
  if (c.errors != null) o.er = c.errors;
  const pr = ((c.probables || [])[0] || {}).athlete; if (pr) o.pr = pr.shortName || pr.displayName;
  return o;
}
function tvList(comp) {
  const nat = [], loc = [], seen = new Set();
  for (const g of comp.geoBroadcasts || []) {
    const n = ((g.media || {}).shortName || '').trim(), m = (g.market || {}).type || 'National', kind = ((g.type || {}).shortName || '').toLowerCase();
    if (!n || kind === 'radio' || (g.region || 'us') !== 'us' || seen.has(n)) continue;
    seen.add(n); if (m === 'National') nat.push(n); else loc.push([m.toLowerCase(), n]);
  }
  for (const b of comp.broadcasts || []) for (const n of b.names || []) if (n && !seen.has(n)) { seen.add(n); if ((b.market || 'national') === 'national') nat.push(n); else loc.push([b.market, n]); }
  return [nat.slice(0, 6), loc.slice(0, 4)];
}
function compact(e, lg, sport, cp) {
  const comp = (e.competitions || [{}])[0], st = comp.status || e.status || {}, ty = st.type || {};
  const cs = comp.competitors || [];
  const home = cs.find(c => c.homeAway === 'home') || cs[0], away = cs.find(c => c.homeAway === 'away') || cs[1];
  const v = comp.venue || {}, ad = v.address || {};
  const o = { id: e.id, lg, d: e.date || comp.date, st: ty.state || 'pre', sd: ty.shortDetail || ty.detail || '', h: side(home), a: side(away) };
  if (cp) o.cp = cp;
  if (['STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_SUSPENDED', 'STATUS_DELAYED'].includes(ty.name)) o.x = ty.description || ty.detail;
  if (ty.state === 'in') { o.clk = st.displayClock; o.per = st.period; }
  if (comp.timeValid === false || e.timeValid === false) o.tbd = 1;
  const place = [ad.city, ad.state || ad.country].filter(Boolean).join(', ');
  if (v.fullName) o.v = v.fullName + (place ? ', ' + place : '');
  if (comp.neutralSite) o.ns = 1;
  const note = (comp.notes || []).find(n => n.headline); if (note) o.n = note.headline;
  const ser = Array.isArray(comp.series) ? (comp.series.find(x => x.type === 'current' || x.type === 'playoff') || {}) : (comp.series || {});
  if (ser.summary && ['playoff', 'current', undefined].includes(ser.type)) o.ser = ser.summary;
  const [tv, ltv] = tvList(comp); if (tv.length) o.tv = tv; if (ltv.length) o.ltv = ltv;
  const tk = (comp.tickets || []).find(t => t.summary || (t.links || []).length);
  if (tk) o.tk = { s: tk.summary || '', n: tk.numberAvailable, u: ((tk.links || [])[0] || {}).href || '' };
  const od = (comp.odds || []).find(x => x && (x.details || x.overUnder != null));
  if (od && ty.state === 'pre') o.od = { t: [od.details, od.overUnder != null ? 'O/U ' + od.overUnder : ''].filter(Boolean).join(' · '), by: (od.provider || {}).name || '' };
  const hl = (comp.headlines || []).find(h => h.shortLinkText || h.description); if (hl) o.rc = hl.shortLinkText || hl.description;
  if (ty.state === 'in' && comp.situation) {
    const s = comp.situation, x = {};
    if (sport === 'baseball') { if (s.balls != null) x.b = s.balls; if (s.strikes != null) x.s = s.strikes; if (s.outs != null) x.o = s.outs; x.on = [s.onFirst ? 1 : 0, s.onSecond ? 1 : 0, s.onThird ? 1 : 0]; const bt = ((s.batter || {}).athlete || {}), pt = ((s.pitcher || {}).athlete || {}); if (bt.shortName) x.bat = bt.shortName; if (pt.shortName) x.pit = pt.shortName; }
    if (sport === 'football') { if (s.downDistanceText) x.dd = s.downDistanceText; if (s.possession) x.pos = s.possession; if (s.isRedZone) x.rz = 1; }
    if ((s.lastPlay || {}).text) x.lp = s.lastPlay.text;
    o.sit = x;
  }
  const w = e.weather || comp.weather || {};
  if (w.temperature != null && sport === 'football' && !v.indoor) o.wx = `${w.temperature}° ${w.displayValue || ''}`.trim();
  if ((e.week || {}).number) o.wk = e.week.number;
  return o;
}
const sbUrl = (path, q) => ESPN + path + '/scoreboard' + (q ? '?' + q : '');
async function liveDay(lg, day, cp) { // one ET day of one league (or soccer competition), from ESPN
  const key = lg + '|' + (cp || '') + '|' + day;
  const c = S.live[key];
  if (c && Date.now() - c.at < (c.games.some(g => g.st === 'in') ? 25000 : 90000)) return c.games;
  if (S.busy[key]) return S.busy[key];
  const path = cp ? 'soccer/' + COMPS[cp][0] : LEAGUES[lg].path;
  S.busy[key] = espn(sbUrl(path, 'dates=' + day.replace(/-/g, '') + '&limit=300'))
    .then(d => { const games = (d.events || []).map(e => compact(e, cp || lg, LEAGUES[lg].sport, cp)).sort(byTime); S.live[key] = { at: Date.now(), games }; return games; })
    .finally(() => { S.busy[key] = null; });
  return S.busy[key];
}
async function liveWeek(w, t) {
  const key = 'nfl|w' + t + '-' + w, c = S.live[key];
  if (c && Date.now() - c.at < (c.games.some(g => g.st === 'in') ? 25000 : 90000)) return c.games;
  if (S.busy[key]) return S.busy[key];
  S.busy[key] = espn(sbUrl('football/nfl', `week=${w}&seasontype=${t}`))
    .then(d => { const games = (d.events || []).map(e => compact(e, 'nfl', 'football')).sort(byTime); S.live[key] = { at: Date.now(), games }; return games; })
    .finally(() => { S.busy[key] = null; });
  return S.busy[key];
}
const byTime = (a, b) => (a.d || '').localeCompare(b.d || '') || String(a.id).localeCompare(String(b.id));
const stOrder = { in: 0, pre: 1, post: 2 };

/* ---------------------------------------------------------------- pieces: a game */
function statusLine(g) {
  if (g.x) return `<span class="sp-st spx">${esc(statusT(g.x))}</span>`;
  if (g.st === 'in') return `<span class="sp-st live"><i></i>${esc(statusT(g.sd) || T('Live'))}</span>`;
  if (g.st === 'post') return `<span class="sp-st fin">${esc(statusT(g.sd) || T('Final'))}</span>`;
  const k = dayKey(g.d), t = todayKey();
  const when = g.tbd ? T('Time TBD') : fmtTime(g.d);
  return `<span class="sp-st pre">${k === t ? '' : esc(dayName(k)) + ' · '}${esc(when)}</span>`;
}
function tvShort(g) {
  if (g.tv && g.tv.length) return g.tv.slice(0, 2).join(' · ');
  if (g.ltv && g.ltv.length) return T('Local TV');
  return '';
}
function teamRow(t, g, big) {
  const post = g.st === 'post', lead = post ? t.w : (g.st === 'in' && +t.sc > +(t === g.h ? g.a : g.h).sc);
  const sc = g.st === 'pre' ? '' : esc(t.sc != null ? t.sc : '');
  return `<div class="sp-tm${post && t.w ? ' win' : ''}${post && !t.w && (g.h.w || g.a.w) ? ' lose' : ''}${lead ? ' spup' : ''}">
    ${img(t.lo, 'splo', big ? 96 : 48)}<span class="spnm">${t.rk ? `<b class="sprk">${t.rk}</b>` : ''}${esc(big ? t.nm : (t.sh || t.nm))}${isFav(lgOf(g), t.id) ? '<span class="fv" title="' + esc(T('You follow them')) + '">★</span>' : ''}</span>
    <span class="rc">${esc(t.r || '')}</span><span class="spsc">${sc}${t.so != null && g.st === 'post' ? `<small>(${esc(t.so)})</small>` : ''}</span></div>`;
}
function diamond(s) {
  const on = s.on || [0, 0, 0];
  return `<svg class="sp-dia" viewBox="0 0 30 22" aria-label="${esc(T('Runners on base'))}"><rect x="11" y="1" width="8" height="8" transform="rotate(45 15 5)" class="${on[1] ? 'on' : ''}"/><rect x="20" y="9" width="8" height="8" transform="rotate(45 24 13)" class="${on[0] ? 'on' : ''}"/><rect x="2" y="9" width="8" height="8" transform="rotate(45 6 13)" class="${on[2] ? 'on' : ''}"/></svg>`;
}
function sitLine(g) {
  const s = g.sit; if (!s || g.st !== 'in') return '';
  if (s.on) return `<div class="sp-sit">${diamond(s)}<span>${s.b != null ? `${s.b}-${s.s}` : ''}${s.o != null ? ` · ${T(s.o === 1 ? '{n} out' : '{n} outs', { n: s.o })}` : ''}${s.bat ? ` · ${esc(s.bat)}` : ''}</span></div>`;
  if (s.dd) return `<div class="sp-sit"><span>${s.pos ? '<b>' + esc((g.h.id === s.pos ? g.h.ab : g.a.id === s.pos ? g.a.ab : '')) + '</b> ' : ''}${esc(s.dd)}${s.rz ? ' · <em>' + esc(T('Red zone')) + '</em>' : ''}</span></div>`;
  return '';
}
function card(g, o = {}) {
  const lg = lgOf(g), cp = g.cp;
  const foot = [];
  if (g.n || g.ser) foot.push(`<span class="nt">${esc([g.n, g.ser].filter(Boolean).join(' · '))}</span>`);
  if (g.st === 'pre') {
    if (g.od && !o.noOdds) foot.push(`<span class="od">${esc(g.od.t)}</span>`);
    if (g.tk && g.tk.s) foot.push(`<span class="sptk">${esc(tkShort(g.tk.s))}</span>`);
  }
  if (g.st === 'post' && g.rc && o.recap !== false) foot.push(`<span class="rcp">${esc(g.rc)}</span>`);
  const tv = tvShort(g);
  return `<a class="sp-gc${g.st === 'in' ? ' is-live' : ''}${gameFav(g) ? ' is-fav' : ''}${o.big ? ' spbig' : ''}" href="#/sports/${esc(lg)}/g/${esc(g.id)}${cp && lg === 'soccer' ? '?c=' + esc(cp) : ''}">
    <div class="sp-gt">${statusLine(g)}${o.league ? `<span class="lgn">${esc(lgName(g.lg, cp))}</span>` : ''}${tv ? `<span class="sptv">${esc(tv)}</span>` : ''}</div>
    ${teamRow(g.a, g, o.big)}${teamRow(g.h, g, o.big)}${sitLine(g)}
    ${foot.length ? `<div class="sp-gf">${foot.join('')}</div>` : ''}</a>`;
}
function tkShort(s) {
  const m = String(s || '').match(/\$\s?([\d,]+)/);
  return m ? T('Tickets from ${n}', { n: m[1] }) : s;
}
function chipGame(g) { // the small one, for strips
  return `<a class="sp-chipg${g.st === 'in' ? ' is-live' : ''}${gameFav(g) ? ' is-fav' : ''}" href="#/sports/${esc(lgOf(g))}/g/${esc(g.id)}${g.cp ? '?c=' + esc(g.cp) : ''}">
    <span class="spt">${statusLine(g)}</span>
    <span class="spr">${img(g.a.lo, 'splo', 40)}<b>${esc(g.a.ab)}</b><em>${g.st === 'pre' ? '' : esc(g.a.sc)}</em></span>
    <span class="spr">${img(g.h.lo, 'splo', 40)}<b>${esc(g.h.ab)}</b><em>${g.st === 'pre' ? '' : esc(g.h.sc)}</em></span></a>`;
}

/* ---------------------------------------------------------------- the desk's top: today across the leagues */
function lgChip(lg, info, cur) {
  const l = LEAGUES[lg]; if (!l) return '';
  let sub = '';
  if (info) {
    if (info.live) sub = `<i class="spdot"></i>${T('{n} live', { n: info.live })}`;
    else if (info.champion) sub = T('Champions: {t}', { t: info.champion.ab || info.champion.nm });
    else if (info.next) sub = until(info.next) < 864e5 && dayKey(info.next) === todayKey() ? T('Today {t}', { t: fmtTime(info.next) }) : dayName(dayKey(info.next));
    else if (info.stype === 4) sub = T('Offseason');
  }
  return `<a class="sp-lgc${cur === lg ? ' on' : ''}" href="#/sports/${lg}"><b>${esc(l.n)}</b>${sub ? `<span>${sub}</span>` : ''}</a>`;
}
function extraChips(cur) {
  return EXTRA.filter(x => !x[4] || todayKey() <= x[4]).map(([k, n, href, sub]) => `<a class="sp-lgc ext${cur === k ? ' on' : ''}" href="${esc(href)}"><b>${esc(T(n))}</b><span>${k === 'f1' ? f1Line() : esc(T(sub))}</span></a>`).join('');
}
function leagueBar(cur) {
  const L = (S.idx && S.idx.leagues) || {};
  return `<nav class="sp-lgbar" aria-label="${esc(T('Leagues'))}">${ORDER.map(lg => lgChip(lg, L[lg], cur)).join('')}${extraChips(cur)}</nav>`;
}
async function top(el) {
  el.innerHTML = `<section class="sp-hub"><div class="sp-hubh"><h2 class="sec-h">${T('Scores and schedules')}</h2></div>${leagueBar()}<p class="note">${T('Loading the scores…')}</p></section>`;
  await loadIdx();
  if (!el.isConnected) return;
  drawTop(el);
  refreshToday(el);
}
function todayGames() {
  const ix = S.idx; if (!ix) return [];
  const map = new Map((ix.today || []).map(g => [g.lg + g.id, g]));
  for (const [k, c] of Object.entries(S.live)) { // live answers replace the edition's copy
    if (!k.endsWith('|' + todayKey())) continue;
    for (const g of c.games) map.set(g.lg + g.id, g);
  }
  return [...map.values()];
}
function drawTop(el) {
  const ix = S.idx;
  if (!ix) { el.innerHTML = `<section class="sp-hub"><div class="sp-hubh"><h2 class="sec-h">${T('Scores and schedules')}</h2></div>${leagueBar()}<p class="note">${T('The scores didn’t load. The leagues’ pages below still open.')}</p></section>`; return; }
  const games = todayGames();
  const big = (ix.big || []).map(g => games.find(x => x.lg === g.lg && x.id === g.id) || g);
  const bigIds = new Set(big.map(g => g.lg + g.id));
  const fav = games.filter(gameFav).filter(g => !bigIds.has(g.lg + g.id));
  const rest = games.filter(g => !bigIds.has(g.lg + g.id) && !gameFav(g)).sort((a, b) => stOrder[a.st] - stOrder[b.st] || byTime(a, b));
  const groups = new Map();
  const rank = lg => (rest.some(g => lgOf(g) === lg && g.st === 'in') ? 0 : 10) + ORDER.indexOf(lg);
  for (const g of rest.slice().sort((a, b) => rank(lgOf(a)) - rank(lgOf(b)))) { const k = lgOf(g); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(g); }
  const live = games.filter(g => g.st === 'in').length;
  el.innerHTML = `<section class="sp-hub">
    <div class="sp-hubh"><h2 class="sec-h">${T('Scores and schedules')}</h2><p class="sp-asof">${live ? `<i class="spdot"></i>${T('{n} games on now', { n: live })} · ` : ''}${asOf()}</p>
      <button type="button" class="chip" data-sp="pick">${favs().size ? T('Your teams ({n})', { n: favs().size }) : T('Follow your teams')}</button></div>
    ${leagueBar()}
    ${big.length ? `<h3 class="sp-h3">${T('The big ones')}</h3><div class="sp-grid spbig">${big.slice(0, 4).map(g => card(g, { league: true, big: false })).join('')}</div>` : ''}
    ${fav.length ? `<h3 class="sp-h3">${T('Your teams today')}</h3><div class="sp-grid">${fav.map(g => card(g, { league: true })).join('')}</div>` : ''}
    ${groups.size ? `<h3 class="sp-h3">${T('Today')}</h3>${[...groups].map(([lg, gs]) => `<div class="sp-strip"><a class="sp-striph" href="#/sports/${lg}">${esc(LEAGUES[lg] ? LEAGUES[lg].n : lg)} <span>${T('All scores')} →</span></a><div class="sp-chips">${gs.map(chipGame).join('')}</div></div>`).join('')}` : !big.length ? `<p class="note">${T('No games today in these leagues.')}</p>` : ''}
    ${champLine(ix)}
  </section>`;
}
function champLine(ix) {
  const ch = ORDER.filter(lg => ix.leagues[lg] && ix.leagues[lg].champion).map(lg => { const c = ix.leagues[lg].champion; return `<a href="#/sports/${lg}">${img(c.lo, 'splo', 40)}<span>${esc(T('{t} won the {what}', { t: c.nm, what: c.what || LEAGUES[lg].n }))}</span></a>`; });
  return ch.length ? `<div class="sp-champs">${ch.join('')}</div>` : '';
}
function asOf() {
  const anyLive = Object.values(S.live).some(c => Date.now() - c.at < 120000);
  if (anyLive) return T('Live from ESPN');
  return S.idx ? T('As of {t}', { t: fmtTime(S.idx.at) }) : '';
}
async function refreshToday(el) { // fetch today's leagues live, so the hub is current even between editions
  const ix = S.idx; if (!ix) return;
  const t = todayKey(), jobs = [];
  for (const lg of ORDER) {
    const info = ix.leagues[lg]; if (!info) continue;
    if (lg === 'soccer') { for (const cp of COMP_ORDER) if ((ix.today || []).some(g => g.cp === cp)) jobs.push(liveDay('soccer', t, cp).catch(() => null)); continue; }
    if (info.today || info.live) jobs.push(liveDay(lg, t).catch(() => null));
  }
  if (!jobs.length) return;
  await Promise.all(jobs);
  if (el.isConnected) drawTop(el);
  schedule(() => refreshToday(el), todayGames(), el);
}
function schedule(fn, games, el) { // poll while something is on (or about to start); stop when the page is left
  clearTimeout(S.timer);
  if (el && !el.isConnected) return;
  const live = games.some(g => g.st === 'in' || (g.st === 'pre' && until(g.d) < 10 * 60000 && until(g.d) > -3 * 3600000));
  if (!live) return;
  S.timer = setTimeout(() => { if (el && !el.isConnected) return; if (document.visibilityState === 'visible') fn(); else schedule(fn, games, el); }, 30000);
}

/* ---------------------------------------------------------------- a league page */
function parse(p) {
  const [path, q] = (p || '').split('?');
  const parts = path.split('/').filter(Boolean);
  const r = { lg: parts.shift() || '', cp: null, tab: 'scores', arg: null, q: new URLSearchParams(q || '') };
  if (r.lg === 'soccer' && COMPS[parts[0]]) r.cp = parts.shift();
  if (r.lg === 'soccer' && r.q.get('c') && COMPS[r.q.get('c')]) r.cp = r.cp || r.q.get('c');
  const t = parts.shift();
  if (t === 'g' || t === 't') { r.tab = t; r.arg = parts.shift(); } else if (t) { r.tab = t; r.arg = parts.shift() || null; }
  return r;
}
async function page(p) {
  clearTimeout(S.timer);
  const r = parse(p);
  if (!LEAGUES[r.lg]) { K.go('#/s/sports'); return; }
  const main = $('#main');
  const same = S.lastP === p && main.querySelector('.sp-page');
  if (!same) { main.innerHTML = `<div class="wrap sp-page"><p class="note sp-loading">${T('Loading the scores…')}</p></div>`; window.scrollTo(0, 0); }
  S.lastP = p;
  await Promise.all([loadIdx(), loadLg(r.lg)]);
  if (K.view().t !== 'sports' || K.view().p !== p) return;
  if (r.tab === 'g') return gamePage(r);
  if (r.tab === 't') return teamPage(r);
  drawLeague(r);
}
function leagueHead(r, d) {
  const L = LEAGUES[r.lg];
  const comp = r.cp && d && d.comps ? d.comps.find(c => c.k === r.cp) : null;
  const phase = comp ? comp.phase : d ? d.phase : '';
  const champ = d && d.champion ? `<p class="sp-champ">${img(d.champion.lo, 'splo', 48)}<span>${esc(T('{t} won the {what}', { t: d.champion.nm, what: d.champion.what || L.n }))}${d.champion.ser ? ' · ' + esc(d.champion.ser) : ''}</span></p>` : '';
  const base = '#/sports/' + r.lg + (r.cp ? '/' + r.cp : '');
  return `<p class="sp-crumb"><a href="#/s/sports">${T('Sports')}</a> ›</p>
    <div class="sp-head"><h1>${esc(comp ? comp.name : L.n)}</h1><p class="sp-phase">${esc(phaseT(phase) || (r.lg === 'soccer' && !r.cp ? T('Eight competitions: the Premier League, LaLiga, the Bundesliga, Serie A, Ligue 1, the Champions and Europa Leagues, and the Brasileirão') : ''))}${d && d.season && d.season.label && !comp ? ` · ${esc(T('{y} season', { y: d.season.label }))}` : ''}${comp ? ` · ${esc(T(comp.country))}` : ''}</p></div>
    ${champ}
    ${leagueBar(r.lg)}
    ${r.lg === 'soccer' ? `<nav class="sp-comps" aria-label="${esc(T('Competitions'))}"><a href="#/sports/soccer${r.tab !== 'scores' && r.tab !== 'standings' ? '/' + r.tab : ''}"${!r.cp ? ' class="on"' : ''}>${T('All')}</a>${COMP_ORDER.map(c => `<a href="#/sports/soccer/${c}${r.tab !== 'scores' ? '/' + r.tab : ''}"${r.cp === c ? ' class="on"' : ''}>${esc(COMPS[c][1])}</a>`).join('')}</nav>` : ''}
    <div class="seg sp-tabs" role="tablist">${TABS.map(([k, n]) => `<a role="tab" href="${base}/${k}" aria-selected="${r.tab === k}">${T(n)}</a>`).join('')}</div>`;
}
function drawLeague(r) {
  const d = S.lg[r.lg];
  const main = $('#main');
  if (!d) { main.innerHTML = `<div class="wrap sp-page">${leagueHead(r, null)}<p class="note">${T('This league’s page didn’t load. Try again in a minute.')}</p></div>`; return; }
  if (r.lg === 'soccer' && r.tab === 'standings' && !r.cp) r.cp = 'epl';
  main.innerHTML = `<div class="wrap sp-page">${leagueHead(r, d)}<div id="spBody"></div></div>`;
  const body = $('#spBody');
  if (r.tab === 'scores') return drawScores(r, d, body);
  if (r.tab === 'schedule') return drawSchedule(r, d, body);
  if (r.tab === 'standings') return drawStandings(r, d, body);
  if (r.tab === 'news') return drawNews(r, d, body);
  if (r.tab === 'teams') return drawTeams(r, d, body);
  K.go('#/sports/' + r.lg);
}
const lgGames = (d, cp) => (d.games || []).filter(g => !cp || g.cp === cp);

/* scores: a day (or an NFL week) */
async function drawScores(r, d, body) {
  if (r.lg === 'nfl') return drawWeek(r, d, body);
  const games = lgGames(d, r.cp), t = todayKey();
  const days = [...new Set(games.map(g => dayKey(g.d)))].sort();
  let day = r.arg && /^\d{4}-\d{2}-\d{2}$/.test(r.arg) ? r.arg : null;
  if (!day) { // today if anything is on, else the nearest day with games (the next one first)
    day = days.includes(t) ? t : days.find(k => k > t) || days.filter(k => k < t).pop() || t;
  }
  const strip = [];
  for (let i = -3; i <= 6; i++) strip.push(addDays(day, i));
  const base = '#/sports/' + r.lg + (r.cp ? '/' + r.cp : '') + '/scores/';
  const has = new Set(days);
  const draw = (list, live) => {
    if (!body.isConnected) return;
    list = list.slice().sort((a, b) => stOrder[a.st] === 0 && stOrder[b.st] !== 0 ? -1 : stOrder[b.st] === 0 && stOrder[a.st] !== 0 ? 1 : byTime(a, b));
    const byComp = r.lg === 'soccer' && !r.cp;
    let grid = '';
    if (!list.length) grid = `<p class="note sp-empty">${T('No games on {d}.', { d: fmtLongDay(day) })}${nextHint(games, day, base)}</p>`;
    else if (byComp) {
      for (const cp of COMP_ORDER) { const gs = list.filter(g => g.cp === cp); if (gs.length) grid += `<h3 class="sp-h3"><a href="#/sports/soccer/${cp}">${esc(COMPS[cp][1])}</a></h3><div class="sp-grid">${gs.map(g => card(g)).join('')}</div>`; }
    } else grid = `<div class="sp-grid">${list.map(g => card(g)).join('')}</div>`;
    body.innerHTML = `${seriesHTML(games, d, r)}<div class="sp-days">
      <a class="sp-arr" href="${base}${addDays(day, -7)}" aria-label="${esc(T('A week earlier'))}">‹</a>
      ${strip.map(k => `<a href="${base}${k}"${k === day ? ' aria-current="date"' : ''}${has.has(k) ? ' class="has"' : ''}><b>${esc(k === t ? T('Today') : fmtDow(k))}</b><span>${esc(fmtMD(k))}</span></a>`).join('')}
      <a class="sp-arr" href="${base}${addDays(day, 7)}" aria-label="${esc(T('A week later'))}">›</a></div>
      <p class="sp-asof">${live ? T('Live from ESPN · {t}', { t: fmtTime(new Date().toISOString()) }) : T('As of {t}', { t: fmtTime(d.at) })} · ${T('Times are yours; days follow U.S. Eastern time.')}</p>
      ${grid}`;
  };
  const snap = games.filter(g => dayKey(g.d) === day);
  draw(snap, false);
  const pull = async () => {
    if (!body.isConnected) return;
    try {
      let list;
      if (r.lg === 'soccer' && !r.cp) list = (await Promise.all(COMP_ORDER.map(cp => liveDay('soccer', day, cp).catch(() => null)))).filter(Boolean).flat();
      else list = await liveDay(r.cp ? 'soccer' : r.lg, day, r.cp);
      draw(list, true);
      schedule(pull, list, body);
    } catch (e) { /* ESPN unreachable: the edition's copy stays */ }
  };
  const needLive = day >= addDays(t, -1) || !has.has(day) || snap.some(g => g.st !== 'post');
  if (needLive) pull();
}
function seriesHTML(games, d, r) { // a playoff series in the edition's copy, game by game (the World Series, the WNBA Finals…)
  if (!d.season || d.season.type !== 3) return '';
  const by = new Map();
  for (const g of games) {
    const m = (g.n || '').match(/^(.*?)\s*[-–]\s*Game\s*(\d+)/i);
    if (!m) continue;
    const k = [g.h.id, g.a.id].sort().join('-');
    if (!by.has(k)) by.set(k, { name: m[1], games: [] });
    by.get(k).games.push(Object.assign({ gn: +m[2] }, g));
  }
  if (!by.size || by.size > 2) return '';
  return [...by.values()].map(sr => {
    const gs = sr.games.sort((a, b) => a.gn - b.gn), last = gs.filter(g => g.ser).pop() || gs[0];
    const done = /wins|won/i.test(last.ser || '');
    return `<div class="sp-series"><div class="sp-serh"><h2 class="sp-h2">${esc(sr.name)}</h2><p>${esc(last.ser || '')}</p></div><div class="sp-sers">${gs.map((g, i) => {
      const w = g.st === 'post' ? (g.h.w ? g.h : g.a.w ? g.a : null) : null, l = w ? (w === g.h ? g.a : g.h) : null;
      const maybe = g.st === 'pre' && (done || (g.gn > Math.ceil(gs.length / 2) + 0 && gs.slice(0, i).some(x => x.st !== 'post')));
      if (done && g.st === 'pre') return '';
      const body = g.st === 'post' ? (w ? `<em>${esc(w.ab)} ${esc(w.sc)}–${esc(l.sc)}</em>` : `<em>${esc(g.a.sc)}–${esc(g.h.sc)}</em>`)
        : g.st === 'in' ? `<em class="lv">${esc(g.a.ab)} ${esc(g.a.sc)}–${esc(g.h.sc)} ${esc(g.h.ab)}</em>`
        : `<em>${esc(g.tbd ? T('TBD') : fmtTime(g.d))}</em><small>@ ${esc(g.h.ab)}${maybe ? ' · ' + esc(T('if needed')) : ''}</small>`;
      return `<a class="sp-sg${g.st === 'in' ? ' is-live' : ''}${g.st === 'post' ? ' done' : ''}${maybe ? ' maybe' : ''}" href="#/sports/${esc(lgOf(g))}/g/${esc(g.id)}"><b>${esc(T('Game {n}', { n: g.gn }))}</b><span>${esc(dayName(dayKey(g.d)))}</span>${body}</a>`;
    }).join('')}</div></div>`;
  }).join('');
}
function nextHint(games, day, base) {
  const nx = games.find(g => dayKey(g.d) > day), pv = games.filter(g => dayKey(g.d) < day).pop();
  const bits = [];
  if (nx) bits.push(`<a href="${base}${dayKey(nx.d)}">${T('Next games: {d}', { d: fmtLongDay(dayKey(nx.d)) })} →</a>`);
  else if (pv) bits.push(`<a href="${base}${dayKey(pv.d)}">← ${T('Last games: {d}', { d: fmtLongDay(dayKey(pv.d)) })}</a>`);
  return bits.length ? ' ' + bits.join(' ') : '';
}
async function drawWeek(r, d, body) {
  const wk = d.week || {};
  const cal = wk.cal || [];
  let t = wk.type || 2, w = wk.n || 1;
  const m = (r.arg || '').match(/^w(\d+)(?:-(\d))?$/);
  if (m) { w = +m[1]; t = m[2] ? +m[2] : (cal.find(c => c.w === w && c.t === 2) ? 2 : t); }
  const idx = cal.findIndex(c => c.t === t && c.w === w);
  const cur = cal[idx] || { l: T('Week {n}', { n: w }) };
  const prev = cal[idx - 1], next = cal[idx + 1];
  const href = c => `#/sports/nfl/scores/w${c.w}${c.t !== 2 ? '-' + c.t : ''}`;
  const draw = (list, live) => {
    if (!body.isConnected) return;
    const byDay = new Map();
    for (const g of list.slice().sort(byTime)) { const k = dayKey(g.d); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(g); }
    body.innerHTML = `<div class="sp-week">${prev ? `<a class="sp-arr" href="${href(prev)}" aria-label="${esc(T('The week before'))}">‹</a>` : '<span></span>'}
      <div><b>${esc(phaseT(cur.l || ''))}</b>${cur.s ? `<span>${esc(fmtMD(dayKey(cur.s)))} – ${esc(fmtMD(dayKey(new Date(new Date(cur.e) - 12 * 3600000))))}</span>` : ''}</div>
      ${next ? `<a class="sp-arr" href="${href(next)}" aria-label="${esc(T('The week after'))}">›</a>` : '<span></span>'}</div>
      <p class="sp-asof">${live ? T('Live from ESPN · {t}', { t: fmtTime(new Date().toISOString()) }) : T('As of {t}', { t: fmtTime(d.at) })}${wk.bye && wk.bye.length && w === wk.n ? ' · ' + esc(T('On a bye: {t}', { t: wk.bye.join(', ') })) : ''}</p>
      ${byDay.size ? [...byDay].map(([k, gs]) => `<h3 class="sp-h3">${esc(fmtLongDay(k))}</h3><div class="sp-grid">${gs.map(g => card(g)).join('')}</div>`).join('') : `<p class="note">${T('No games this week.')}</p>`}`;
  };
  draw(lgGames(d).filter(g => g.wk === w && (t === (wk.type || 2) || !g.wk)), false);
  const pull = async () => { if (!body.isConnected) return; try { const list = await liveWeek(w, t); draw(list, true); schedule(pull, list, body); } catch (e) { /* keep the copy */ } };
  pull();
}

/* schedule: what's coming, where to watch it, and tickets */
function drawSchedule(r, d, body) {
  const now = Date.now();
  const games = lgGames(d, r.cp).filter(g => g.st !== 'post' && new Date(g.d) > now - 4 * 3600000).sort(byTime);
  const nets = new Map();
  for (const g of lgGames(d, r.cp)) for (const n of g.tv || []) nets.set(n, (nets.get(n) || 0) + 1);
  const topNets = [...nets].sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
  const byDay = new Map();
  for (const g of games) { const k = dayKey(g.d); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(g); }
  const fv = favs();
  body.innerHTML = `<div class="sp-watch"><h2 class="sp-h2">${T('How to watch')}</h2>
      <p>${topNets.length ? T('This stretch of games is on {list}.', { list: topNets.map(n => `<b>${esc(n)}</b>`).join(', ') }) : T('The networks are listed with each game once they are announced.')}
      ${lgGames(d, r.cp).some(g => g.ltv) ? ' ' + T('Games marked Local TV are on the teams’ regional channels and their streaming apps.') : ''}</p>
      <label class="sp-only"><input type="checkbox" data-sp="onlyfav"${S.onlyFav ? ' checked' : ''}${fv.size ? '' : ' disabled'}> ${T('Only my teams')}</label></div>
    ${byDay.size ? [...byDay].map(([k, gs]) => {
      const list = S.onlyFav ? gs.filter(gameFav) : gs;
      if (!list.length) return '';
      return `<h3 class="sp-h3">${esc(fmtLongDay(k))}</h3><div class="sp-sched">${list.map(schedRow).join('')}</div>`;
    }).join('') || `<p class="note">${T('None of your teams play in this stretch.')}</p>` : `<p class="note">${T('Nothing scheduled in the next few days.')} ${d.season && d.season.type === 4 ? T('The season is over.') : ''}</p>`}
    <p class="sp-asof">${T('Schedules, TV and ticket prices are ESPN’s, as of {t}. Prices change; the ticket sites have the seats.', { t: fmtTime(d.at) })}</p>`;
}
function schedRow(g, o = {}) {
  const lg = lgOf(g);
  const tv = (g.tv || []).map(n => `<span class="tvp">${esc(n)}</span>`).join('') + (g.ltv && !(g.tv || []).length ? `<span class="tvp loc" title="${esc(g.ltv.map(x => x[1]).join(', '))}">${T('Local TV')}</span>` : '');
  return `<div class="sp-row${gameFav(g) ? ' is-fav' : ''}">
    <span class="when">${g.st === 'in' ? `<span class="sp-st live"><i></i>${esc(g.sd)}</span>` : (o.date ? `<small>${esc(fmtDate(g.d))}</small>` : '') + esc(g.tbd ? T('TBD') : fmtTime(g.d))}</span>
    <a class="mu" href="#/sports/${esc(lg)}/g/${esc(g.id)}${g.cp ? '?c=' + esc(g.cp) : ''}">${img(g.a.lo, 'splo', 40)}<span>${esc(g.a.sh || g.a.nm)}</span><i>${g.ns ? 'vs' : '@'}</i>${img(g.h.lo, 'splo', 40)}<span>${esc(g.h.sh || g.h.nm)}</span>${g.cp && !location.hash.includes('/' + g.cp) ? `<em>${esc(COMPS[g.cp][1])}</em>` : ''}</a>
    <span class="nt">${esc([g.n, g.ser].filter(Boolean).join(' · '))}${g.v ? `<small>${esc(g.v)}</small>` : ''}</span>
    <span class="tvs">${tv}</span>
    <span class="tks">${ticketBtn(g)}</span></div>`;
}
function ticketBtn(g) {
  if (g.st === 'post') return '';
  const label = g.tk && g.tk.s ? tkShort(g.tk.s) : T('Tickets');
  return `<button type="button" class="sp-tkb" data-sp="tix" data-lg="${esc(lgOf(g))}" data-id="${esc(g.id)}">${esc(label)}${g.tk && g.tk.n ? `<small>${esc(T('{n} for sale', { n: Number(g.tk.n).toLocaleString(LOC()) }))}</small>` : ''}</button>`;
}
function ticketLinks(g) {
  const q = `${g.a.nm} at ${g.h.nm}`, qe = encodeURIComponent(q), he = encodeURIComponent(g.h.nm);
  const out = [];
  if (g.tk && g.tk.u) out.push(['Vivid Seats', g.tk.u, g.tk.s]);
  out.push(['SeatGeek', 'https://seatgeek.com/search?search=' + qe], ['StubHub', 'https://www.stubhub.com/find/s/?q=' + qe],
    ['Ticketmaster', 'https://www.ticketmaster.com/search?q=' + he], ['Gametime', 'https://gametime.co/search?q=' + he]);
  if (!g.tk || !g.tk.u) out.unshift(['Vivid Seats', 'https://www.vividseats.com/search?searchTerm=' + qe]);
  return out;
}
function findGame(lg, id) {
  const d = S.lg[lg];
  for (const c of Object.values(S.live)) { const g = c.games.find(x => String(x.id) === String(id)); if (g) return g; }
  return (d && (d.games || []).find(x => String(x.id) === String(id))) || ((S.idx && S.idx.today) || []).find(x => String(x.id) === String(id));
}
function openTickets(btn) {
  const g = findGame(btn.dataset.lg, btn.dataset.id); if (!g) return;
  closePop();
  const m = document.createElement('div');
  m.className = 'sp-pop'; m.id = 'spPop'; m.setAttribute('role', 'dialog');
  m.innerHTML = `<p class="h">${esc(g.a.sh || g.a.nm)} ${g.ns ? 'vs' : '@'} ${esc(g.h.sh || g.h.nm)}</p><p class="s">${esc(fmtDate(g.d))} · ${esc(g.tbd ? T('Time TBD') : fmtTimeFull(g.d))}${g.v ? '<br>' + esc(g.v) : ''}</p>
    ${g.tk && g.tk.s ? `<p class="spp">${esc(tkShort(g.tk.s))}${g.tk.n ? ' · ' + esc(T('{n} listed', { n: Number(g.tk.n).toLocaleString(LOC()) })) : ''}</p>` : ''}
    <ul>${ticketLinks(g).map(([n, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}<span>↗</span></a></li>`).join('')}</ul>
    <p class="spf">${T('Prices and seats are the sellers’ own. The lowest price is from ESPN’s ticket partner.')}</p>`;
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect();
  m.style.top = (r.bottom + scrollY + 6) + 'px';
  m.style.left = Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + 'px';
  const a = m.querySelector('a'); if (a) a.focus();
}
function closePop() { const p = $('#spPop'); if (p) p.remove(); }

/* standings */
const US_COLS = [['W', 'wins'], ['L', 'losses'], ['PCT', 'winpercent'], ['GB', 'gamesbehind'], ['HOME', 'home'], ['AWAY', 'road'], ['L10', 'lasttengames'], ['STRK', 'streak']];
const COLS = {
  nfl: [['W', 'wins'], ['L', 'losses'], ['T', 'ties'], ['PCT', 'winpercent'], ['HOME', 'home'], ['AWAY', 'road'], ['DIV', 'vsdiv'], ['CONF', 'vsconf'], ['PF', 'pointsfor'], ['PA', 'pointsagainst'], ['DIFF', 'pointdifferential'], ['STRK', 'streak']],
  nba: US_COLS, mlb: US_COLS, wnba: US_COLS,
  nhl: [['GP', 'gamesplayed'], ['W', 'wins'], ['L', 'losses'], ['OTL', 'otlosses'], ['PTS', 'points'], ['RW', 'regwins'], ['GF', 'pointsfor'], ['GA', 'pointsagainst'], ['DIFF', 'pointdifferential'], ['L10', 'lasttengames'], ['STRK', 'streak']],
  soccer: [['GP', 'gamesplayed'], ['W', 'wins'], ['D', 'ties'], ['L', 'losses'], ['GF', 'pointsfor'], ['GA', 'pointsagainst'], ['GD', 'pointdifferential'], ['PTS', 'points']],
};
COLS.mls = COLS.soccer;
async function liveStandings(lg, cp) { // a port of standings() in sports.py, for an edition that came without them
  const key = 'st|' + lg + '|' + (cp || '');
  if (S.live[key] && Date.now() - S.live[key].at < 600000) return S.live[key].st;
  const path = cp ? 'soccer/' + COMPS[cp][0] : LEAGUES[lg].path, cols = COLS[lg];
  const level3 = ['nfl', 'nba', 'nhl', 'mlb'].includes(lg);
  const d = await espn((level3 ? 'https://site.web.api.espn.com/apis/v2/sports/' : 'https://site.api.espn.com/apis/v2/sports/') + path + '/standings' + (level3 ? '?level=3' : ''));
  const stat = (e, k) => { const x = (e.stats || []).find(y => (y.type || '').toLowerCase() === k || (y.name || '').toLowerCase() === k); return x ? (x.displayValue != null ? x.displayValue : x.value) : ''; };
  const rows = es => es.map(e => { const t = e.team || {}, o = { id: t.id, ab: t.abbreviation || '', nm: t.displayName || '', sh: t.shortDisplayName || '', lo: ((t.logos || [])[0] || {}).href || '', v: cols.map(c => stat(e, c[1])) };
    const seed = stat(e, 'playoffseed'), rk = stat(e, 'rank'), cl = stat(e, 'clincher'), n = e.note || {};
    if (+seed) o.seed = +seed; if (+rk) o.rk = +rk; if (cl && cl !== '-') o.cl = cl; if (n.description) o.nt = { c: '#' + String(n.color || '').replace(/^#+/, ''), d: n.description };
    return o; }).sort((a, b) => (a.rk || 0) - (b.rk || 0) || num(b.v[cols.findIndex(c => c[0] === 'PCT')]) - num(a.v[cols.findIndex(c => c[0] === 'PCT')]) || num(b.v[cols.findIndex(c => c[0] === 'PTS')]) - num(a.v[cols.findIndex(c => c[0] === 'PTS')]));
  const tree = n => n.standings ? { n: n.name || '', ab: n.abbreviation || '', rows: rows(n.standings.entries || []) } : { n: n.name || '', ab: n.abbreviation || '', kids: (n.children || []).map(tree) };
  const t = tree(d), st = { cols: cols.map(c => c[0]), tree: t.kids || [t] };
  S.live[key] = { at: Date.now(), games: [], st };
  return st;
}
function drawStandings(r, d, body) {
  const src = r.cp ? ((d.comps || []).find(c => c.k === r.cp) || {}).st : d.st;
  if (!src || !src.tree) {
    body.innerHTML = `<p class="note">${T('Loading the standings…')}</p>`;
    liveStandings(r.lg, r.cp).then(st => { if (!body.isConnected) return; if (r.cp) { const c = (d.comps || []).find(x => x.k === r.cp); if (c) c.st = st; } else d.st = st; drawStandings(r, d, body); })
      .catch(() => { if (body.isConnected) body.innerHTML = `<p class="note">${T('The standings didn’t load. Try again in a minute.')}</p>`; });
    return;
  }
  const view = r.arg || (src.tree.some(n => n.kids) ? 'division' : 'table');
  const hasDiv = src.tree.some(n => n.kids);
  const groups = [];
  if (hasDiv && view === 'division') for (const c of src.tree) for (const k of c.kids || []) groups.push({ n: k.n, sup: c.ab || c.n, rows: k.rows, seedless: true });
  else if (hasDiv && view === 'league') groups.push({ n: d.full || LEAGUES[r.lg].full, rows: src.tree.flatMap(c => (c.kids || []).flatMap(k => k.rows)).sort(rankSort(r.lg)) });
  else for (const c of src.tree) groups.push({ n: c.n, rows: c.kids ? c.kids.flatMap(k => k.rows).sort(seedSort(r.lg)) : c.rows.slice().sort(seedSort(r.lg)) });
  const base = '#/sports/' + r.lg + (r.cp ? '/' + r.cp : '') + '/standings/';
  const legend = new Map();
  for (const g of groups) for (const row of g.rows) if (row.nt && row.nt.d) legend.set(row.nt.d, safeColor(row.nt.c));
  const cols = src.cols;
  body.innerHTML = `${hasDiv ? `<div class="seg sp-sub" role="group">${[['division', 'Division'], ['conference', LEAGUES[r.lg].sport === 'baseball' ? 'League' : 'Conference'], ['league', 'Overall']].map(([k, n]) => `<a href="${base}${k}" aria-pressed="${view === k}">${T(n)}</a>`).join('')}</div>` : ''}
    ${groups.map(g => `<div class="sp-tbl" style="max-width:${300 + cols.length * 78}px"><h3 class="sp-h3">${g.sup ? `<small>${esc(g.sup)}</small> ` : ''}${esc(g.n)}</h3>
      <div class="sp-tw"><table><thead><tr><th class="tm" scope="col">${T('Team')}</th>${cols.map(c => `<th scope="col">${esc(T(c + '|standings'))}</th>`).join('')}</tr></thead>
      <tbody>${g.rows.map((row, i) => `<tr class="${isFav(r.lg, row.id) ? 'fav' : ''}"><th scope="row" class="tm"><span class="tmw">${row.nt ? `<i class="q" style="background:${safeColor(row.nt.c)}" title="${esc(row.nt.d)}"></i>` : ''}<span class="spn">${g.seedless ? i + 1 : (row.seed || row.rk || i + 1)}</span>${img(row.lo, 'splo', 40)}<a href="#/sports/${r.lg}/t/${esc(row.id)}${r.cp ? '?c=' + r.cp : ''}"><span class="full">${esc(row.sh || row.nm)}</span><span class="abbr">${esc(row.ab)}</span></a>${row.cl ? `<sup title="${esc(clinchName(row.cl))}">${esc(row.cl)}</sup>` : ''}</span></th>${row.v.map((v, j) => `<td${cols[j] === 'PTS' || cols[j] === 'PCT' ? ' class="key"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`).join('')}
    ${legend.size ? `<p class="sp-legend">${[...legend].map(([dd, c]) => `<span><i style="background:${c}"></i>${esc(dd)}</span>`).join('')}</p>` : ''}
    ${groups.some(g => g.rows.some(x => x.cl)) ? `<p class="sp-legend">${['x', 'y', 'z', 'w', 'e', '*'].filter(c => groups.some(g => g.rows.some(x => x.cl === c))).map(c => `<span><b>${c}</b> ${esc(clinchName(c))}</span>`).join('')}</p>` : ''}
    <p class="sp-asof">${T('Standings from ESPN, as of {t}.', { t: fmtTime(d.at) })}</p>`;
}
const safeColor = c => /^#[0-9a-fA-F]{3,8}$/.test(String(c || '').replace(/^#+/, '#')) ? String(c).replace(/^#+/, '#') : 'var(--ink-3)';
const clinchName = c => ({ x: T('Clinched a playoff spot'), y: T('Clinched the division'), z: T('Clinched the best record in the conference'), w: T('Clinched a wild card'), e: T('Eliminated'), '*': T('Clinched home field') }[c] || c);
const num = v => { const n = parseFloat(String(v).replace('+', '')); return isNaN(n) ? -1e9 : n; };
function seedSort(lg) { return (a, b) => (a.seed || a.rk || 99) - (b.seed || b.rk || 99) || rankSort(lg)(a, b); }
function rankSort(lg) {
  const cols = (S.lg[lg] && S.lg[lg].st && S.lg[lg].st.cols) || [];
  const pts = cols.indexOf('PTS'), pct = cols.indexOf('PCT'), w = cols.indexOf('W'), gp = cols.indexOf('GP');
  if (pts >= 0 && lg !== 'nfl') return (a, b) => num(b.v[pts]) - num(a.v[pts]) || num(a.v[gp]) - num(b.v[gp]);
  return (a, b) => num(b.v[pct]) - num(a.v[pct]) || num(b.v[w]) - num(a.v[w]);
}

/* news: the league's own stories, plus the edition's that are about it */
const KW = {
  nfl: /\b(nfl|super bowl|quarterbacks?|qb|touchdowns?|wide receivers?|running backs?|linebackers?|pro bowl|fantasy football)\b/i,
  nba: /\b(nba|lebron|wembanyama|three-pointers?|nba cup|in-season tournament)\b/i,
  mlb: /\b(mlb|world series|home runs?|innings?|pitchers?|bullpen|alcs|nlcs|al east|nl west|cy young|baseball)\b/i,
  nhl: /\b(nhl|stanley cup|hockey|power play|goaltenders?|goalies?|hat trick)\b/i,
  wnba: /\b(wnba|caitlin clark|a'ja wilson|valkyries|commissioner's cup)\b/i,
  mls: /\b(mls|major league soccer|mls cup|leagues cup|messi|inter miami)\b/i,
  soccer: /\b(premier league|champions league|europa league|la ?liga|bundesliga|serie a|ligue 1|brasileir[aã]o|uefa|fifa|ballon d'or|striker|midfielder|goalkeeper|football club|fc)\b/i,
};
function teamRx(d) {
  if (d._rx) return d._rx;
  const nick = new Map();
  for (const t of d.teams || []) { const n = (t.nick || '').toLowerCase(); nick.set(n, (nick.get(n) || 0) + 1); }
  const names = new Set();
  for (const t of d.teams || []) {
    if (t.nm) names.add(t.nm);
    if (t.nick && t.nick.length > 4 && nick.get(t.nick.toLowerCase()) === 1 && !/^(united|city|real|giants|rangers|kings|cardinals|panthers|jets|athletics|fire|union|galaxy|heat|storm|sky|sun|fever|wings|mercury|liberty|lynx|dream|sparks|aces|mystics)$/i.test(t.nick)) names.add(t.nick);
  }
  const list = [...names].filter(n => n.length > 3).sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  d._rx = list.length ? new RegExp('\\b(' + list.join('|') + ')\\b', 'i') : /$^/;
  return d._rx;
}
function editionFor(lg, d) {
  const E = K.edition(); if (!E) return [];
  const rx = teamRx(d), own = KW[lg];
  const others = Object.entries(KW).filter(([k]) => k !== lg && !(lg === 'mls' && k === 'soccer') && !(lg === 'soccer' && k === 'mls'));
  return E.items.filter(it => it.c === 'sports' && !it.l || it.c === 'sports' && it.l === K.lang()).filter(it => {
    const s = it.t + ' ' + (it.d || '');
    const mine = (own.test(s) ? 2 : 0) + (rx.test(it.t) ? 2 : rx.test(s) ? 1 : 0);
    if (mine < 2) return false;
    const theirs = Math.max(0, ...others.map(([, re]) => re.test(s) ? 2 : 0));
    return mine >= theirs;
  });
}
function drawNews(r, d, body) {
  let items = (d.news || []).slice();
  if (r.cp) { const nm = COMPS[r.cp][1]; const ids = new Set((d.teams || []).filter(t => t.cp === r.cp).map(t => String(t.id))); items = items.filter(x => x.cp === nm || (x.tm || []).some(id => ids.has(String(id)))); }
  const ed = editionFor(r.lg, d);
  const seen = new Set(items.map(x => x.u.split('?')[0]));
  const extra = ed.filter(it => !seen.has(it.u.split('?')[0]));
  const fv = favs(), mine = S.newsMine && fv.size;
  if (mine) items = items.filter(x => (x.tm || []).some(id => fv.has(favKey(r.lg, id))));
  const tmap = new Map((d.teams || []).map(t => [String(t.id), t]));
  body.innerHTML = `<div class="sp-newsh"><h2 class="sp-h2">${T('The latest')}</h2>${fv.size ? `<div class="seg" role="group"><button type="button" data-sp="newsall" aria-pressed="${!mine}">${T('All')}</button><button type="button" data-sp="newsmine" aria-pressed="${!!mine}">${T('My teams')}</button></div>` : ''}</div>
    <div class="sp-news">${items.length ? items.map(x => newsRow(x, tmap, r.lg)).join('') : `<p class="note">${mine ? T('Nothing about your teams in the last few days.') : T('No stories yet.')}</p>`}</div>
    ${extra.length && !mine ? `<h2 class="sp-h2 sp-ed">${T('In this edition of The Watch')}</h2><div class="page sp-edl">${extra.slice(0, 30).map(it => K.storyRow(it, { snip: true })).join('')}</div>` : ''}
    <p class="sp-asof">${T('Headlines and summaries are the outlets’ own: ESPN, CBS Sports, The Athletic, Yahoo Sports and others. Each opens on its site.')}</p>`;
}
function newsRow(x, tmap, lg) {
  const tms = (x.tm || []).map(id => tmap.get(String(id))).filter(Boolean).slice(0, 4);
  return `<article class="sp-nw">${x.m ? `<img class="spth" src="${esc(x.m)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
    <div class="sptx"><h3><a href="${esc(x.u)}" target="_blank" rel="noopener">${x.vid ? '▶ ' : ''}${esc(x.t)}</a></h3>${x.d ? `<p class="spsn">${esc(x.d)}</p>` : ''}
    <p class="spmt"><span class="spou">${esc(x.o)}</span><span>${esc(agoIso(x.p))}</span>${x.cp ? `<span>${esc(x.cp)}</span>` : ''}${tms.map(t => `<a class="tg" href="#/sports/${lg}/t/${esc(t.id)}">${img(t.lo, 'splo', 40)}${esc(t.ab)}</a>`).join('')}</p></div></article>`;
}

/* teams */
function drawTeams(r, d, body) {
  let tms = (d.teams || []).slice();
  if (r.cp) tms = tms.filter(t => t.cp === r.cp);
  const st = r.cp ? ((d.comps || []).find(c => c.k === r.cp) || {}).st : d.st;
  const rec = new Map(), groups = [];
  if (st && st.tree) {
    const wi = st.cols.indexOf('W'), li = st.cols.indexOf('L'), di = st.cols.indexOf('D'), ti = st.cols.indexOf('T'), oi = st.cols.indexOf('OTL'), pi = st.cols.indexOf('PTS');
    for (const c of st.tree) for (const k of (c.kids || [c])) {
      const g = { n: (c.kids ? (c.ab || '') + ' · ' : '') + k.n, ids: [] };
      for (const row of k.rows || []) {
        g.ids.push(String(row.id));
        rec.set(String(row.id), [row.v[wi], di >= 0 ? row.v[di] : null, row.v[li], ti >= 0 && row.v[ti] !== '0' ? row.v[ti] : null, oi >= 0 ? row.v[oi] : null].filter(x => x != null && x !== '').join('-') + (pi >= 0 && LEAGUES[r.lg].sport !== 'football' ? ` · ${row.v[pi]} ${T('pts')}` : ''));
      }
      groups.push(g);
    }
  }
  const byId = new Map(tms.map(t => [String(t.id), t]));
  const tile = t => `<div class="sp-tt${isFav(r.lg, t.id) ? ' on' : ''}" style="--tc:#${esc((t.c || '889').replace('#', ''))}"><a href="#/sports/${r.lg}/t/${esc(t.id)}${t.cp ? '?c=' + esc(t.cp) : ''}">${img(t.lo, 'splo', 96)}<b>${esc(t.nm)}</b><span>${esc(rec.get(String(t.id)) || '')}</span></a>
    <button type="button" data-sp="fav" data-lg="${r.lg}" data-id="${esc(t.id)}" aria-pressed="${isFav(r.lg, t.id)}" aria-label="${esc(isFav(r.lg, t.id) ? T('Unfollow {t}', { t: t.nm }) : T('Follow {t}', { t: t.nm }))}">${isFav(r.lg, t.id) ? '★' : '☆'}</button></div>`;
  const used = new Set();
  let html = '';
  if (groups.length && !(r.lg === 'soccer' && !r.cp)) {
    for (const g of groups) { const ts = g.ids.map(id => byId.get(id)).filter(Boolean); ts.forEach(t => used.add(String(t.id))); if (ts.length) html += `<h3 class="sp-h3">${esc(g.n)}</h3><div class="sp-teams">${ts.map(tile).join('')}</div>`; }
  }
  const left = tms.filter(t => !used.has(String(t.id))).sort((a, b) => a.nm.localeCompare(b.nm));
  if (left.length) {
    if (r.lg === 'soccer' && !r.cp) for (const cp of COMP_ORDER) { const ts = left.filter(t => t.cp === cp); if (ts.length && cp !== 'ucl' && cp !== 'uel') html += `<h3 class="sp-h3">${esc(COMPS[cp][1])}</h3><div class="sp-teams">${ts.map(tile).join('')}</div>`; }
    else html += `<div class="sp-teams">${left.map(tile).join('')}</div>`;
  }
  body.innerHTML = `<p class="sub2">${T('Star the teams you follow: their games come first on the Sports desk, and you can narrow the schedule and the news to them. Kept in this browser only.')}</p>${html || `<p class="note">${T('The teams didn’t load this edition.')}</p>`}`;
}

/* ---------------------------------------------------------------- a team */
async function teamPage(r) {
  const d = S.lg[r.lg] || {};
  const t = (d.teams || []).find(x => String(x.id) === String(r.arg));
  const sport = LEAGUES[r.lg].sport;
  const path = r.lg === 'soccer' ? 'soccer/' + COMPS[r.cp || (t && t.cp) || 'epl'][0] : LEAGUES[r.lg].path;
  const main = $('#main');
  const head = tm => `<p class="sp-crumb"><a href="#/s/sports">${T('Sports')}</a> › <a href="#/sports/${r.lg}">${esc(LEAGUES[r.lg].n)}</a> ›</p>
    <div class="sp-thead" style="--tc:#${esc(((tm && tm.c) || '15243B').replace('#', ''))}">${img(tm && tm.lo, 'splo', 128)}<div><h1>${esc((tm && tm.nm) || T('Team'))}</h1><p id="spTrec"></p></div>
    ${tm ? `<button type="button" class="chip" data-sp="fav" data-lg="${r.lg}" data-id="${esc(tm.id)}" aria-pressed="${isFav(r.lg, tm.id)}">${isFav(r.lg, tm.id) ? '★ ' + T('Following') : '☆ ' + T('Follow')}</button>` : ''}</div>`;
  main.innerHTML = `<div class="wrap sp-page">${head(t)}<div class="sp-tcols"><div id="spTmain"><p class="note">${T('Loading the schedule…')}</p></div><aside id="spTside"></aside></div></div>`;
  // standing and news from the edition's copy
  const row = findRow(d, r.arg, r.cp || (t && t.cp));
  if (row) $('#spTrec').innerHTML = esc(row.txt);
  const tmap = new Map((d.teams || []).map(x => [String(x.id), x]));
  const news = (d.news || []).filter(x => (x.tm || []).map(String).includes(String(r.arg)));
  $('#spTside').innerHTML = `<h2 class="sp-h2">${T('News')}</h2><div class="sp-news small">${news.length ? news.slice(0, 12).map(x => newsRow(x, tmap, r.lg)).join('') : `<p class="note">${T('No stories about them in the last few days.')}</p>`}</div>`;
  let sched = S.team[r.lg + r.arg];
  try {
    if (!sched || Date.now() - sched.at > 120000) {
      const j = await espn(ESPN + path + '/teams/' + encodeURIComponent(r.arg) + '/schedule');
      sched = { at: Date.now(), games: (j.events || []).map(e => compact(e, r.cp || r.lg, sport, r.lg === 'soccer' ? (r.cp || (t && t.cp)) : null)).sort(byTime), team: j.team, rec: (j.team || {}).recordSummary, standing: (j.team || {}).standingSummary };
      S.team[r.lg + r.arg] = sched;
    }
  } catch (e) { sched = null; }
  if (K.view().t !== 'sports') return;
  const box = $('#spTmain'); if (!box) return;
  if (!t && sched && sched.team) { main.querySelector('.sp-thead h1').textContent = sched.team.displayName || ''; }
  if (sched && (sched.rec || sched.standing)) $('#spTrec').innerHTML = esc([sched.rec, sched.standing].filter(Boolean).join(' · '));
  const games = (sched ? sched.games : lgGames(d).filter(g => String(g.h.id) === String(r.arg) || String(g.a.id) === String(r.arg))).map(g => {
    const c = (d.games || []).find(x => String(x.id) === String(g.id));
    return c ? Object.assign({}, c, g.st === 'post' || g.st === 'in' ? { st: g.st, sd: g.sd, h: Object.assign({}, c.h, { sc: g.h.sc, w: g.h.w }), a: Object.assign({}, c.a, { sc: g.a.sc, w: g.a.w }) } : {}) : g;
  });
  const past = games.filter(g => g.st === 'post'), next = games.filter(g => g.st !== 'post');
  const nx = next[0];
  box.innerHTML = `${nx ? `<h2 class="sp-h2">${nx.st === 'in' ? T('On now') : T('Next')}</h2><div class="sp-grid one">${card(nx)}</div>
      <div class="sp-nextx">${nx.tv ? `<span>${T('Watch on {list}', { list: esc(nx.tv.join(', ')) })}</span>` : ''}${ticketBtn(nx)}</div>` : ''}
    ${past.length ? `<h2 class="sp-h2">${T('Results')}</h2><div class="sp-res">${past.slice().reverse().slice(0, 20).map(g => resRow(g, r.arg)).join('')}</div>` : ''}
    ${next.length > 1 ? `<h2 class="sp-h2">${T('Coming up')}</h2><div class="sp-sched">${next.slice(1, 25).map(g => schedRow(g, { date: true })).join('')}</div>` : ''}
    ${!sched ? `<p class="sp-asof">${T('The full schedule comes from ESPN, which didn’t answer; these are the games in this edition.')}</p>` : ''}`;
  if (nx && nx.st === 'in') schedule(() => { delete S.team[r.lg + r.arg]; teamPage(r); }, [nx], box);
}
function findRow(d, id, cp) {
  const st = cp && d.comps ? ((d.comps.find(c => c.k === cp) || {}).st) : d.st;
  if (!st || !st.tree) return null;
  for (const c of st.tree) for (const k of (c.kids || [c])) {
    const i = (k.rows || []).findIndex(x => String(x.id) === String(id));
    if (i >= 0) {
      const row = k.rows[i], cols = st.cols, v = n => row.v[cols.indexOf(n)];
      const rec = cols.includes('D') ? `${v('W')}-${v('D')}-${v('L')}, ${v('PTS')} ${T('pts')}` : cols.includes('OTL') ? `${v('W')}-${v('L')}-${v('OTL')}, ${v('PTS')} ${T('pts')}` : `${v('W')}-${v('L')}${cols.includes('T') && v('T') !== '0' ? '-' + v('T') : ''}`;
      return { row, txt: `${rec} · ${T('{n} in the {g}', { n: ordinal(i + 1), g: k.n })}` };
    }
  }
  return null;
}
function ordinal(n) {
  if (K.lang() === 'pt') return n + 'º';
  if (K.lang() === 'de') return n + '.';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function resRow(g, id) {
  const home = String(g.h.id) === String(id), me = home ? g.h : g.a, op = home ? g.a : g.h;
  const res = me.w ? 'W' : op.w ? 'L' : 'D';
  return `<a class="sp-rr" href="#/sports/${esc(lgOf(g))}/g/${esc(g.id)}${g.cp ? '?c=' + esc(g.cp) : ''}"><span class="dt">${esc(fmtDate(g.d))}</span><span class="spvs">${home ? 'vs' : '@'}</span>${img(op.lo, 'splo', 40)}<span class="op">${esc(op.sh || op.nm)}</span><b class="spr ${res}">${esc(T(res + '|result'))}</b><span class="spsc">${esc(me.sc)}–${esc(op.sc)}</span>${g.n ? `<small>${esc(g.n)}</small>` : ''}</a>`;
}

/* ---------------------------------------------------------------- a game */
async function gamePage(r) {
  const lg = r.lg, id = r.arg;
  const cp = r.cp || (findGame(lg, id) || {}).cp;
  const path = lg === 'soccer' ? 'soccer/' + COMPS[cp || 'epl'][0] : LEAGUES[lg].path;
  const main = $('#main');
  const g0 = findGame(lg, id);
  main.innerHTML = `<div class="wrap sp-page">${crumbG(lg, cp)}${g0 ? gameHead(g0, null) : ''}<div id="spG"><p class="note">${T('Loading the game…')}</p></div></div>`;
  let s;
  try {
    s = await espn(ESPN + path + '/summary?event=' + encodeURIComponent(id));
    S.sum[id] = s;
  } catch (e) { s = S.sum[id] || null; }
  if (K.view().t !== 'sports' || K.view().p.indexOf('/g/' + id) < 0) return;
  const box = $('#spG');
  if (!s) { box.innerHTML = `<p class="note">${T('ESPN didn’t answer, so only the score from this edition is shown.')}</p>`; return; }
  const hc = ((s.header || {}).competitions || [{}])[0];
  const g = compact({ id, date: hc.date, competitions: [Object.assign({}, hc, { venue: ((s.gameInfo || {}).venue) || hc.venue, tickets: g0 && g0.tk ? [{ summary: g0.tk.s, numberAvailable: g0.tk.n, links: [{ href: g0.tk.u }] }] : hc.tickets, odds: s.pickcenter || hc.odds })], status: hc.status }, cp || lg, LEAGUES[lg].sport, cp);
  if (g0) for (const k of ['tv', 'ltv', 'n', 'ser', 'od']) if (!g[k] && g0[k]) g[k] = g0[k];
  main.querySelector('.sp-page').innerHTML = `${crumbG(lg, cp)}${gameHead(g, s)}<div id="spG"></div>`;
  $('#spG').innerHTML = gameBody(g, s, lg);
  schedule(() => gamePage(r), [g], $('#spG'));
}
function crumbG(lg, cp) { return `<p class="sp-crumb"><a href="#/s/sports">${T('Sports')}</a> › <a href="#/sports/${lg}${cp && lg === 'soccer' ? '/' + cp : ''}">${esc(lgName(lg, cp))}</a> ›</p>`; }
function gameHead(g, s) {
  const lsH = g.h.ls || [], lsA = g.a.ls || [], n = Math.max(lsH.length, lsA.length);
  const sport = LEAGUES[lgOf(g)].sport;
  const perName = i => sport === 'baseball' ? String(i + 1) : sport === 'soccer' ? (i === 0 ? T('1st half') : i === 1 ? T('2nd half') : T('ET')) : (i < (sport === 'hockey' ? 3 : 4) ? String(i + 1) : i === (sport === 'hockey' ? 3 : 4) ? T('OT') : T('OT') + (i - (sport === 'hockey' ? 2 : 3)));
  const line = n && sport !== 'soccer' ? `<div class="sp-tw"><table class="sp-line"><thead><tr><th></th>${Array.from({ length: n }, (_, i) => `<th>${esc(perName(i))}</th>`).join('')}<th>${sport === 'baseball' ? 'R' : T('T|total')}</th>${sport === 'baseball' ? '<th>H</th><th>E</th>' : ''}</tr></thead><tbody>
      ${[g.a, g.h].map((t, k) => `<tr><th>${esc(t.ab)}</th>${Array.from({ length: n }, (_, i) => `<td>${esc((k ? lsH : lsA)[i] != null ? (k ? lsH : lsA)[i] : '')}</td>`).join('')}<td class="key">${esc(t.sc)}</td>${sport === 'baseball' ? mlbHE(s, t) : ''}</tr>`).join('')}</tbody></table></div>` : '';
  const big = t => `<div class="side${g.st === 'post' && t.w ? ' win' : ''}">${img(t.lo, 'splo', 160)}<b>${esc(t.nm)}</b><span>${esc(t.r || '')}</span>
    <button type="button" class="fvb" data-sp="fav" data-lg="${lgOf(g)}" data-id="${esc(t.id)}" aria-pressed="${isFav(lgOf(g), t.id)}" title="${esc(isFav(lgOf(g), t.id) ? T('Unfollow {t}', { t: t.nm }) : T('Follow {t}', { t: t.nm }))}">${isFav(lgOf(g), t.id) ? '★' : '☆'}</button></div>`;
  return `<section class="sp-ghead${g.st === 'in' ? ' is-live' : ''}">
    <p class="sp-gnote">${esc([g.n, g.ser].filter(Boolean).join(' · ') || lgName(g.lg, g.cp))}</p>
    <div class="sp-score">${big(g.a)}<div class="mid"><div class="nums">${g.st === 'pre' ? `<span class="spvs">${g.ns ? 'vs' : '@'}</span>` : `<span>${esc(g.a.sc)}</span><i>–</i><span>${esc(g.h.sc)}</span>`}</div>${statusLine(g)}${sitLine(g)}</div>${big(g.h)}</div>
    ${line}
    ${g.st === 'pre' && (g.a.pr || g.h.pr) ? `<p class="sp-gmeta">${T('Probable starters: {a} for {x}, {h} for {y}', { a: esc(g.a.pr || T('TBD')), x: esc(g.a.ab), h: esc(g.h.pr || T('TBD')), y: esc(g.h.ab) })}</p>` : ''}
    <p class="sp-gmeta">${[fmtDate(g.d) + ' · ' + (g.tbd ? T('Time TBD') : fmtTimeFull(g.d)), g.v, g.wx].filter(Boolean).map(esc).join(' · ')}</p>
    ${g.st !== 'post' ? `<div class="sp-gact">${g.tv ? `<span class="tvl">${T('Watch on')} ${g.tv.map(n => `<b>${esc(n)}</b>`).join(' ')}</span>` : g.ltv ? `<span class="tvl">${T('Local TV')}: ${g.ltv.map(x => esc(x[1])).join(', ')}</span>` : ''}${ticketBtn(g)}${g.od ? `<span class="odl">${esc(g.od.t)}${g.od.by ? ` <small>(${esc(g.od.by)})</small>` : ''}</span>` : ''}</div>` : ''}
  </section>`;
}
function mlbHE(s, t) { return `<td>${esc(t.hi != null ? t.hi : '')}</td><td>${esc(t.er != null ? t.er : '')}</td>`; }
function gameBody(g, s, lg) {
  const parts = [];
  const sport = LEAGUES[lgOf(g)].sport;
  const art = s.article;
  if (art && art.headline) {
    const link = ((art.links || {}).web || {}).href || (art.links && art.links.web && art.links.web.href) || '';
    parts.push(`<section class="sp-sec sp-art"><p class="spk">${esc(T(art.type === 'Recap' ? 'Recap' : art.type === 'Preview' ? 'Preview' : 'Story'))} · ESPN</p><h2>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(art.headline)}</a>` : esc(art.headline)}</h2>${art.description ? `<p>${esc(String(art.description).replace(/^\s*[—–-]+\s*/, ''))}</p>` : ''}</section>`);
  }
  const wp = winProb(s, g); if (wp) parts.push(wp);
  const sc = scoring(s, g, sport); if (sc) parts.push(sc);
  const ld = leaders(s, g); if (ld) parts.push(ld);
  const ts = teamStats(s, g); if (ts) parts.push(ts);
  const bx = boxScore(s, g, sport); if (bx) parts.push(bx);
  const inj = injuries(s); if (inj) parts.push(inj);
  const l5 = lastFive(s, g); if (l5) parts.push(l5);
  if (!parts.length) parts.push(`<p class="note">${g.st === 'pre' ? T('The box score fills in once the game starts.') : T('No more detail for this game.')}</p>`);
  return `<div class="sp-gbody">${parts.join('')}</div><p class="sp-asof">${T('Live from ESPN · {t}', { t: fmtTime(new Date().toISOString()) })}</p>`;
}
function winProb(s, g) {
  const w = s.winprobability || [];
  if (w.length < 8) return '';
  const pts = w.map((p, i) => [i / (w.length - 1), p.homeWinPercentage]);
  const W = 640, H = 120;
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * W).toFixed(1)},${((1 - y) * H).toFixed(1)}`).join('');
  const last = w[w.length - 1].homeWinPercentage;
  const fav = last >= 0.5 ? g.h : g.a, pct = Math.round((last >= 0.5 ? last : 1 - last) * 100);
  return `<section class="sp-sec"><h2 class="sp-h2">${T('Win probability')}</h2><p class="sub2">${g.st === 'post' ? T('How the odds swung, play by play.') : T('{t}: {n}% to win, by ESPN’s model.', { t: esc(fav.sh || fav.nm), n: pct })}</p>
    <svg class="sp-wp" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(T('Win probability'))}"><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" class="mid"/><path d="${d}" class="spln"/></svg>
    <div class="sp-wpl"><span>${esc(g.h.ab)} ↑</span><span>${esc(g.a.ab)} ↓</span></div></section>`;
}
function scoring(s, g, sport) {
  let rows = [];
  if (sport === 'soccer') {
    rows = (s.keyEvents || []).filter(e => e.scoringPlay || /card|goal|penalty/i.test((e.type || {}).text || '')).map(e => ({ t: (e.clock || {}).displayValue || '', tx: e.text || ((e.type || {}).text), sc: e.scoringPlay, tm: (e.team || {}).id, card: /yellow|red/i.test((e.type || {}).text || '') ? (/red/i.test(e.type.text) ? 'red' : 'yellow') : '' }));
  } else if (s.scoringPlays && s.scoringPlays.length) {
    rows = s.scoringPlays.map(p => ({ t: `${(p.period || {}).number ? 'Q' + p.period.number : ''} ${(p.clock || {}).displayValue || ''}`, tx: p.text, sc: 1, tm: (p.team || {}).id, score: `${p.awayScore}-${p.homeScore}` }));
  } else if (s.plays && sport === 'baseball') {
    rows = s.plays.filter(p => p.scoringPlay).map(p => ({ t: (p.period || {}).displayValue || '', tx: p.text, sc: 1, tm: (p.team || {}).id, score: `${p.awayScore}-${p.homeScore}` }));
  } else if (s.plays && sport === 'hockey') {
    rows = s.plays.filter(p => p.scoringPlay).map(p => ({ t: `${(p.period || {}).displayValue || ''} ${(p.clock || {}).displayValue || ''}`, tx: p.text, sc: 1, tm: (p.team || {}).id, score: `${p.awayScore}-${p.homeScore}` }));
  } else if (s.plays && sport === 'basketball' && g.st === 'in') {
    rows = s.plays.slice(-12).reverse().map(p => ({ t: `${(p.period || {}).displayValue || ''} ${(p.clock || {}).displayValue || ''}`, tx: p.text, sc: p.scoringPlay, tm: (p.team || {}).id, score: `${p.awayScore}-${p.homeScore}` }));
  }
  if (!rows.length) return '';
  const lo = id => String(id) === String(g.h.id) ? g.h.lo : String(id) === String(g.a.id) ? g.a.lo : '';
  const title = sport === 'basketball' ? T('Latest plays') : sport === 'soccer' ? T('Goals and cards') : T('Scoring');
  return `<section class="sp-sec"><h2 class="sp-h2">${title}</h2><ol class="sp-plays">${rows.slice(0, 40).map(x => `<li class="${x.sc ? 'spsc' : ''}${x.card ? ' ' + x.card : ''}"><span class="spt">${esc(x.t)}</span>${x.tm ? img(lo(x.tm), 'splo', 40) : '<span class="splo nologo"></span>'}<span class="sptx">${esc(x.tx || '')}</span>${x.score ? `<b>${esc(x.score)}</b>` : ''}</li>`).join('')}</ol></section>`;
}
function leaders(s, g) {
  const L = (s.leaders || []).slice().sort((a, b) => (String((a.team || {}).id) === String(g.h.id)) - (String((b.team || {}).id) === String(g.h.id)));
  if (!L.length) return '';
  const cols = L.map(t => {
    const cats = (t.leaders || []).filter(c => (c.leaders || []).length).slice(0, 4);
    if (!cats.length) return '';
    return `<div class="sp-ldc"><h3>${img(((t.team || {}).logo) || (((t.team || {}).logos || [])[0] || {}).href, 'splo', 40)}${esc((t.team || {}).displayName || '')}</h3>${cats.map(c => { const a = c.leaders[0], at = a.athlete || {}; return `<p><span class="spk">${esc(c.displayName || c.name)}</span><b>${esc(at.displayName || at.shortName || '')}</b><span>${esc(a.displayValue || '')}</span></p>`; }).join('')}</div>`;
  }).join('');
  return cols.trim() ? `<section class="sp-sec"><h2 class="sp-h2">${T('Leaders')}</h2><div class="sp-ld">${cols}</div></section>` : '';
}
function teamStats(s, g) {
  const ts = ((s.boxscore || {}).teams || []);
  if (ts.length !== 2) return '';
  const a = ts.find(x => String((x.team || {}).id) === String(g.a.id)) || ts[0], h = ts.find(x => String((x.team || {}).id) === String(g.h.id)) || ts[1];
  const flat = t => (t.statistics || []).filter(x => x.displayValue != null && (x.label || x.name));
  const A = flat(a), H = flat(h);
  if (!A.length) return '';
  const rows = A.slice(0, 16).map(x => {
    const y = H.find(z => z.name === x.name) || {};
    const av = parseFloat(String(x.displayValue).replace(/[^\d.-]/g, '')), hv = parseFloat(String(y.displayValue).replace(/[^\d.-]/g, ''));
    const tot = (isFinite(av) ? av : 0) + (isFinite(hv) ? hv : 0);
    const pa = tot > 0 && isFinite(av) && !/-\d/.test(String(x.displayValue)) ? av / tot : 0.5;
    return `<div class="sp-tsr"><span class="av">${esc(x.displayValue)}</span><span class="lb">${esc(x.label || x.displayName || x.name)}<i style="--p:${(pa * 100).toFixed(0)}%"></i></span><span class="hv">${esc(y.displayValue != null ? y.displayValue : '')}</span></div>`;
  }).join('');
  return `<section class="sp-sec"><h2 class="sp-h2">${g.st === 'pre' ? T('This season') : T('Team stats')}</h2><div class="sp-tsh"><span>${img(g.a.lo, 'splo', 40)}${esc(g.a.ab)}</span><span>${esc(g.h.ab)}${img(g.h.lo, 'splo', 40)}</span></div>${rows}</section>`;
}
function boxScore(s, g, sport) {
  const P = (s.boxscore || {}).players || [];
  if (!P.length) return '';
  const tabs = P.map(p => {
    const tm = p.team || {};
    const groups = (p.statistics || []).filter(x => (x.athletes || []).length).map(st => {
      const labels = st.labels || st.keys || [];
      const nm = st.name || st.text || st.type || '';
      const rows = st.athletes.filter(a => (a.stats || []).length && !(a.didNotPlay)).slice(0, 18);
      return `<div class="sp-tw"><table class="sp-box"><thead><tr><th class="tm">${esc(T(cap(nm || 'Players')))}</th>${labels.map(l => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${rows.map(a => `<tr${a.starter ? ' class="spst"' : ''}><th class="tm">${esc(((a.athlete || {}).shortName) || ((a.athlete || {}).displayName) || '')}${((a.athlete || {}).position || {}).abbreviation ? ` <small>${esc(a.athlete.position.abbreviation)}</small>` : ''}</th>${a.stats.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }).join('');
    return `<div class="sp-boxt"><h3>${img(tm.logo || ((tm.logos || [])[0] || {}).href, 'splo', 40)}${esc(tm.displayName || '')}</h3>${groups}</div>`;
  }).join('');
  return `<section class="sp-sec"><h2 class="sp-h2">${T('Box score')}</h2>${tabs}</section>`;
}
const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
function injuries(s) {
  const I = (s.injuries || []).filter(t => (t.injuries || []).length);
  if (!I.length) return '';
  return `<section class="sp-sec"><h2 class="sp-h2">${T('Injuries')}</h2><div class="sp-ld">${I.map(t => `<div class="sp-ldc"><h3>${img(((t.team || {}).logo) || '', 'splo', 40)}${esc((t.team || {}).displayName || '')}</h3>${t.injuries.slice(0, 10).map(j => `<p><b>${esc(((j.athlete || {}).displayName) || '')}</b><span>${esc([((j.athlete || {}).position || {}).abbreviation, j.status, (j.details || {}).type].filter(Boolean).join(' · '))}</span></p>`).join('')}</div>`).join('')}</div></section>`;
}
function lastFive(s, g) {
  const L = s.lastFiveGames || [];
  if (!L.length) return '';
  return `<section class="sp-sec"><h2 class="sp-h2">${T('Last five games')}</h2><div class="sp-ld">${L.map(t => `<div class="sp-ldc"><h3>${img((t.team || {}).logo || '', 'splo', 40)}${esc((t.team || {}).displayName || '')}</h3>${(t.events || []).slice(0, 5).map(e => `<p><span class="spk">${esc(e.gameDate ? fmtDate(e.gameDate) : '')}</span><b>${esc((e.atVs || '') + ' ' + ((e.opponent || {}).abbreviation || ''))}</b><span>${esc((e.gameResult || '') + ' ' + (e.score || ''))}</span></p>`).join('')}</div>`).join('')}</div></section>`;
}

/* ---------------------------------------------------------------- following teams: the picker */
async function openPicker() {
  closePop();
  await Promise.all(ORDER.map(lg => loadLg(lg)));
  const f = favs();
  const m = document.createElement('div');
  m.className = 'sp-pick'; m.id = 'spPick'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  const sec = lg => { const d = S.lg[lg]; if (!d) return ''; const tms = (d.teams || []).filter(t => lg !== 'soccer' || ['epl', 'laliga', 'bund', 'seriea', 'ligue1', 'bra'].includes(t.cp)).sort((a, b) => a.nm.localeCompare(b.nm));
    return `<details${tms.some(t => f.has(favKey(lg, t.id))) ? ' open' : ''}><summary>${esc(LEAGUES[lg].n)} <span>${tms.filter(t => f.has(favKey(lg, t.id))).length || ''}</span></summary><div class="sp-pickg">${tms.map(t => `<label><input type="checkbox" data-sp="pickfav" data-lg="${lg}" data-id="${esc(t.id)}"${f.has(favKey(lg, t.id)) ? ' checked' : ''}>${img(t.lo, 'splo', 40)}<span>${esc(t.nm)}</span></label>`).join('')}</div></details>`; };
  m.innerHTML = `<div class="in"><div class="sphd"><h2>${T('Your teams')}</h2><button type="button" class="spx" data-sp="pickclose" aria-label="${esc(T('Close'))}">×</button></div>
    <p class="sub2">${T('Their games come first on the Sports desk, with a star. Kept in this browser only.')}</p>${ORDER.map(sec).join('')}
    <div class="ft"><button type="button" class="chip" data-sp="pickclose">${T('Done')}</button></div></div>`;
  document.body.appendChild(m);
  document.body.classList.add('sp-noscroll');
}
function closePicker() { const p = $('#spPick'); if (p) { p.remove(); document.body.classList.remove('sp-noscroll'); rerender(); } }
function rerender() {
  const v = K.view();
  if (v.t === 'sports') page(v.p);
  else { const el = $('#spTop'); if (el) drawTop(el); }
}

/* ---------------------------------------------------------------- events */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-sp]');
  if (!a) { if (!e.target.closest('#spPop')) closePop(); if (e.target.id === 'spPick') closePicker(); return; }
  const k = a.dataset.sp;
  if (k === 'tix') { e.preventDefault(); openTickets(a); return; }
  if (k === 'fav') { e.preventDefault(); const on = !isFav(a.dataset.lg, a.dataset.id); setFav(favKey(a.dataset.lg, a.dataset.id), on); K.toast(on ? T('Following. Their games come first on the Sports desk.') : T('Not following any more.')); rerender(); return; }
  if (k === 'pick') { e.preventDefault(); openPicker(); return; }
  if (k === 'pickclose') { e.preventDefault(); closePicker(); return; }
  if (k === 'newsall' || k === 'newsmine') { S.newsMine = k === 'newsmine'; rerender(); return; }
});
document.addEventListener('change', e => {
  const a = e.target.closest('[data-sp]'); if (!a) return;
  if (a.dataset.sp === 'pickfav') { setFav(favKey(a.dataset.lg, a.dataset.id), a.checked); const sm = a.closest('details').querySelector('summary span'); if (sm) sm.textContent = a.closest('.sp-pickg').querySelectorAll('input:checked').length || ''; }
  if (a.dataset.sp === 'onlyfav') { S.onlyFav = a.checked; rerender(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('#spPick')) closePicker(); closePop(); } });
document.addEventListener('error', e => { // a logo the resizer can't serve: the original
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.dataset && t.dataset.fb && t.src !== t.dataset.fb) { t.src = t.dataset.fb; t.removeAttribute('data-fb'); }
}, true);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && (K.view().t === 'sports' || (K.view().t === 'desk' && K.view().k === 'sports'))) { const v = K.view(); if (v.t === 'sports' && /\/g\/|\/scores|^[a-z]+$/.test(v.p || '')) page(v.p); } });

window.WatchSports = { top, page, leagues: LEAGUES, comps: COMPS, _S: S, _compact: compact };
})();
