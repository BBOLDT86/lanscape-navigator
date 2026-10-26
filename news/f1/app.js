/* The Watch · Formula 1 (#/f1), the Sports desk's racing hub.
   news/index.html loads this file the first time someone opens the hub or the Sports desk; it draws with the page's own
   helpers (T, esc, md, getJSON, go, view, LANG, LOC, ago, isoMin, ytThumb, lsGet, lsSet) and its look (Instrument
   Serif and Sans, navy and brass), so it reads as one paper.
   Data: data/f1.json (news/updater/f1.py: the calendar, every classification, the standings, news and video),
   data/f1/r<N>.json (each race lap by lap: positions, times, pit stops, tyre stints, race control, weather),
   data/f1/tracks.json (track outlines) and the written half in f1/ (the cars, drivers, circuits, the season's race
   reports, the rules, how to watch), kept by a weekly Claude task. When a session ends before the next update, the
   page asks Jolpica for the result itself (it allows browsers). See news/UPDATER.md. */
(() => {
'use strict';
const W = window.WATCH; // the page's own helpers, handed over by index.html
const { T, esc, md, getJSON, ago, isoMin, ytThumb, outlet, LOC, LANG } = W;
const $ = s => document.querySelector(s);
const F = { d: null, w: {}, tr: null, rf: {}, busy: null, trBusy: null, tick: null, topped: 0 };
const J = 'https://api.jolpi.ca/ergast/f1/';
const SN = { FP1: 'Practice 1', FP2: 'Practice 2', FP3: 'Practice 3', SQ: 'Sprint qualifying', S: 'Sprint', Q: 'Qualifying', R: 'Race' };
const LEN = { FP1: 60, FP2: 60, FP3: 60, SQ: 45, S: 40, Q: 60, R: 120 };
const TYRE = { SOFT: ['#DA291C', 'S'], MEDIUM: ['#F2C230', 'M'], HARD: ['#E9E7DF', 'H'], INTERMEDIATE: ['#3E9F43', 'I'], WET: ['#2F6FB6', 'W'] };
const TABS = [['', 'Overview'], ['calendar', 'Calendar'], ['standings', 'Standings'], ['drivers', 'Drivers'], ['cars', 'Cars'], ['rules', 'Rules'], ['news', 'News']];

/* ================= data ================= */
function ensure() {
  if (F.d) return Promise.resolve();
  if (!F.busy) {
    F.busy = Promise.all([
      getJSON('data/f1.json').then(d => { F.d = d; }),
      ...['teams', 'drivers', 'circuits', 'season', 'rules'].map(k => getJSON('f1/' + k + '.json').then(x => { F.w[k] = x; }).catch(() => { F.w[k] = null; })),
      LANG === 'en' || LANG === 'xx' ? null : getJSON('f1/i18n.json').then(x => { const t = x && x[LANG]; if (t) for (const k in t) if (W.DICT.t[k] == null) W.DICT.t[k] = t[k]; }).catch(() => {}),
    ]).then(() => { index(); F.busy = null; topUp(); }, e => { F.busy = null; throw e; });
  }
  return F.busy;
}
function ensureTracks() {
  if (F.tr) return Promise.resolve();
  if (!F.trBusy) F.trBusy = getJSON('data/f1/tracks.json').then(d => { F.tr = d || {}; }, () => { F.tr = {}; });
  return F.trBusy;
}
function raceFile(r) {
  if (F.rf[r] !== undefined) return Promise.resolve(F.rf[r]);
  if (!(F.d.files || []).includes(r)) return Promise.resolve(F.rf[r] = null);
  return getJSON('data/f1/r' + r + '.json').then(d => (F.rf[r] = d), () => (F.rf[r] = null));
}
const byId = (xs, k) => { const m = {}; for (const x of xs || []) m[x[k || 'id']] = x; return m; };
function index() {
  const d = F.d, w = F.w;
  F.T = byId(w.teams && w.teams.teams); F.Dw = byId(w.drivers && w.drivers.drivers); F.C = byId(w.circuits && w.circuits.circuits);
  F.RP = byId(w.season && w.season.rounds, 'r'); F.R = d.races || []; F.byR = byId(F.R, 'r');
  // the teams in championship order, then any without points
  const st = d.standings || {}, seen = new Set();
  F.teams = (st.teams || []).map(x => x.t).filter(t => !seen.has(t) && seen.add(t));
  for (const t of Object.keys(d.teams || {})) if (!seen.has(t)) { seen.add(t); F.teams.push(t); }
  F.racers = (st.drivers || []).map(x => x.d);
  for (const id of Object.keys(d.drivers || {})) if (!F.racers.includes(id) && !d.drivers[id].reserve && d.drivers[id].team) F.racers.push(id);
  // teammates: the second driver of a team draws dashed
  F.second = new Set(); F.now = {};
  const lastR = Math.max(0, ...Object.keys(d.results).map(Number), ...Object.keys(d.quali).map(Number));
  const rows = [...(d.results[lastR] || []), ...(d.quali[lastR] || [])];
  for (const t of F.teams) {
    const cur = [...new Set(rows.filter(x => x.t === t).map(x => x.d))];
    F.now[t] = (cur.length ? cur : F.racers.filter(id => (d.drivers[id] || {}).team === t)).sort((a, b) => F.racers.indexOf(a) - F.racers.indexOf(b));
    F.now[t].slice(1).forEach(id => F.second.add(id));
  }
}
const drove = t => F.racers.filter(id => !(F.now[t] || []).includes(id) && [...Object.values(F.d.results)].some(xs => xs.some(x => x.d === id && x.t === t)));
async function topUp() { // a session finished since the last update: ask Jolpica for it now
  const d = F.d; if (!d || Date.now() - F.topped < 10 * 60000) return;
  const r = F.R.find(x => { const s = sess(x, 'R'); return s && Date.parse(s) + 2.2 * 3600e3 < Date.now() && !d.results[x.r]; });
  const q = F.R.find(x => { const s = sess(x, 'Q'); return s && Date.parse(s) + 1.5 * 3600e3 < Date.now() && !d.quali[x.r]; });
  const s = F.R.find(x => { const t = sess(x, 'S'); return t && Date.parse(t) + 1.3 * 3600e3 < Date.now() && !d.sprints[x.r]; });
  if (!r && !q && !s) return;
  F.topped = Date.now();
  const grab = async (path, key) => { const res = await fetch(J + path, { cache: 'no-cache' }); if (!res.ok) throw new Error(res.status); const m = (await res.json()).MRData; return (m.RaceTable.Races[0] || {})[key] || []; };
  const row = x => ({ d: x.Driver.driverId, t: x.Constructor.constructorId, n: +x.number, pos: +x.position, pt: x.positionText, g: +x.grid, laps: +x.laps, st: x.status, pts: +x.points, time: x.Time && x.Time.time, ms: x.Time && +x.Time.millis, fl: x.FastestLap ? { rank: +x.FastestLap.rank || null, lap: +x.FastestLap.lap, time: (x.FastestLap.Time || {}).time } : undefined });
  let got = false;
  try {
    if (r) { const rows = await grab(`${d.season}/${r.r}/results.json`, 'Results'); if (rows.length) { d.results[r.r] = rows.map(row); got = true; } }
    if (q) { const rows = await grab(`${d.season}/${q.r}/qualifying.json`, 'QualifyingResults'); if (rows.length) { d.quali[q.r] = rows.map(x => ({ d: x.Driver.driverId, t: x.Constructor.constructorId, pos: +x.position, q1: x.Q1, q2: x.Q2, q3: x.Q3 })); got = true; } }
    if (s) { const rows = await grab(`${d.season}/${s.r}/sprint.json`, 'SprintResults'); if (rows.length) { d.sprints[s.r] = rows.map(row); got = true; } }
    if (got && r && d.results[r.r]) { // the standings move with a race
      const m = (await (await fetch(J + d.season + '/driverstandings.json', { cache: 'no-cache' })).json()).MRData.StandingsTable.StandingsLists[0];
      const c = (await (await fetch(J + d.season + '/constructorstandings.json', { cache: 'no-cache' })).json()).MRData.StandingsTable.StandingsLists[0];
      if (m && +m.round >= r.r) d.standings = { after: +m.round, drivers: m.DriverStandings.map(x => ({ d: x.Driver.driverId, pos: +x.position, pts: +x.points, wins: +x.wins, t: x.Constructors.map(c => c.constructorId) })), teams: c ? c.ConstructorStandings.map(x => ({ t: x.Constructor.constructorId, pos: +x.position, pts: +x.points, wins: +x.wins })) : d.standings.teams };
      d.progress = progress();
    }
  } catch (e) { /* the next update brings it */ }
  if (got) { d.live = true; index(); if (W.view.t === 'f1') render(W.view.p, true); }
}
function progress() { // points after each round, from the classifications (the same sum the updater does)
  const d = F.d, rounds = [...new Set([...Object.keys(d.results), ...Object.keys(d.sprints)].map(Number))].sort((a, b) => a - b);
  const cd = {}, ct = {}, sd = {}, st = {};
  rounds.forEach((r, i) => {
    for (const x of (d.results[r] || []).concat(d.sprints[r] || [])) if (x.pts) { cd[x.d] = (cd[x.d] || 0) + x.pts; ct[x.t] = (ct[x.t] || 0) + x.pts; }
    for (const [c, s] of [[cd, sd], [ct, st]]) for (const k in c) (s[k] || (s[k] = Array(i).fill(0))).push(c[k]);
  });
  return { rounds, d: sd, t: st };
}

/* ================= names, colors, times ================= */
const D = id => (F.d.drivers || {})[id] || {};
const dn = id => { const x = D(id); return x.g ? `${x.g} ${x.f}` : id; };
const df = id => D(id).f || id;
const dc = id => D(id).code || df(id).slice(0, 3).toUpperCase();
const tn = t => (F.T[t] && F.T[t].name) || (F.d.teams[t] || {}).short || (F.d.teams[t] || {}).n || t;
function tc(t) { const w = F.T[t]; return (w && w.colors && w.colors.primary) || (F.d.teams[t] || {}).col || '#8492A3'; }
const dteam = id => D(id).team;
const sess = (r, k) => { const s = (r.sessions || []).find(x => x[0] === k); return s && s[1]; };
const short = r => r.name.replace(/ Grand Prix.*$/, '');
const CODE = { albert_park: 'AUS', shanghai: 'CHN', suzuka: 'JPN', bahrain: 'BHR', jeddah: 'KSA', miami: 'MIA', villeneuve: 'CAN', monaco: 'MON', catalunya: 'BAR', red_bull_ring: 'AUT',
  silverstone: 'GBR', spa: 'BEL', hungaroring: 'HUN', zandvoort: 'NED', monza: 'ITA', madring: 'MAD', baku: 'AZE', sepang: 'MAL', marina_bay: 'SIN', americas: 'USA', rodriguez: 'MEX',
  interlagos: 'BRA', vegas: 'LVG', losail: 'QAT', yas_marina: 'ABU', imola: 'IMO' };
const rcode = r => CODE[r.cid] || short(r).slice(0, 3).toUpperCase();
const youZone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return 'America/New_York'; } })();
const fmt = (iso, o, tz) => new Intl.DateTimeFormat(LOC(), Object.assign({}, o, tz ? { timeZone: tz } : {})).format(new Date(iso));
const wday = (iso, tz) => fmt(iso, { weekday: 'short', hour: 'numeric', minute: '2-digit' }, tz);
const dayOnly = (iso, tz) => fmt(iso, { month: 'short', day: 'numeric' }, tz);
const dayLong = (iso, tz) => fmt(iso, { weekday: 'long', month: 'long', day: 'numeric' }, tz);
const zoneName = tz => { try { return new Intl.DateTimeFormat(LOC(), { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName').value; } catch (e) { return tz; } };
function weekend(r) { // "Oct 23–25"
  const a = new Date(r.sessions && r.sessions[0] ? r.sessions[0][1] : r.start), b = new Date(r.start);
  const sameM = a.getUTCMonth() === b.getUTCMonth();
  return sameM ? `${fmt(a, { month: 'short', day: 'numeric' }, 'UTC')}–${fmt(b, { day: 'numeric' }, 'UTC')}` : `${fmt(a, { month: 'short', day: 'numeric' }, 'UTC')} – ${fmt(b, { month: 'short', day: 'numeric' }, 'UTC')}`;
}
function status(r) {
  if (F.d.results[r.r]) return 'done';
  const now = Date.now(), first = Date.parse((r.sessions[0] || [])[1] || r.start), end = Date.parse(r.start) + 2.5 * 3600e3;
  if (now >= first - 2 * 3600e3 && now <= end) return 'live';
  if (now > end) return 'pending';
  return 'upcoming';
}
const nextRace = () => F.R.find(r => status(r) !== 'done') || null;
const lastDone = () => [...F.R].reverse().find(r => status(r) === 'done') || null;
function nextSession(r) { // the session on now, or the next one
  const now = Date.now();
  for (const [k, iso] of r.sessions || []) { const t = Date.parse(iso); if (now < t + LEN[k] * 60000) return { k, iso, on: now >= t }; }
  return null;
}
function countdown(iso) {
  let s = Math.max(0, Math.floor((Date.parse(iso) - Date.now()) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60;
  return [[d, T('days|f1')], [h, T('hrs|f1')], [m, T('min|f1')], [s, T('sec|f1')]];
}
const nf = (v, dgt) => v == null || isNaN(v) ? '–' : Number(v).toLocaleString(LOC(), { minimumFractionDigits: dgt || 0, maximumFractionDigits: dgt || 0 });
const ord = n => LANG === 'en' ? n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th') : n + (LANG === 'de' ? '.' : 'º');
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
function age(dob) { if (!dob) return null; const b = new Date(dob + 'T12:00:00Z'), n = new Date(); let a = n.getUTCFullYear() - b.getUTCFullYear(); if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--; return a; }
const hs = (id, big) => { const u = D(id).hs; return u ? (big ? u.replace('/1col/', '/2col/') : u) : ''; };
const face = (id, cls) => `<span class="f1face ${cls || ''}" style="--tc:${tc(dteam(id))}">${hs(id) ? `<img src="${esc(hs(id, cls === 'xl'))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<b>${esc(dc(id))}</b></span>`;
const sw = t => `<i class="f1sw" style="--tc:${tc(t)}"></i>`;
const dlink = id => `<a href="#/f1/driver/${esc(id)}">${esc(dn(id))}</a>`;
const tlink = t => `<a href="#/f1/car/${esc(t)}">${esc(tn(t))}</a>`;

/* ================= written text: Markdown with [n] pointing at that object's own sources ================= */
function mdx(text, sources) {
  const n = (sources || []).length;
  return md(text || '', 0).replace(/\[(\d{1,2})\](?!\()/g, (m, k) => +k >= 1 && +k <= n
    ? `<sup class="cite"><a href="${esc(sources[k - 1].u)}" target="_blank" rel="noopener" title="${esc(sources[k - 1].o + ': ' + sources[k - 1].t)}">${k}</a></sup>` : '');
}
const plain = t => esc(String(t || '').replace(/\s*\[\d{1,2}\]/g, ''));
function srcs(list, title) {
  if (!list || !list.length) return '';
  return `<details class="f1src"><summary>${title || T('Sources')} <span>${list.length}</span></summary><ol>${list.map(s => `<li><a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a> <span>${esc(s.o)}</span></li>`).join('')}</ol></details>`;
}
const enAttr = () => LANG !== 'en' && LANG !== 'xx' ? ' lang="en"' : '';
const written = () => { const w = F.w.season || F.w.teams; return w ? T('Written by Claude ({model}) from the sources cited, and checked each week. Updated {date}.', { model: esc(w.model || 'Claude'), date: esc(dayOnly(w.updated)) }) + (LANG !== 'en' && LANG !== 'xx' ? ' ' + T('In English.') : '') : ''; };

/* ================= the shell ================= */
function nav(cur) {
  return `<nav class="f1nav" aria-label="${T('Formula 1')}"><a class="f1brand" href="#/f1"><span>F1</span>${F.d.season}</a>${TABS.map(([k, l]) => `<a href="#/f1${k ? '/' + k : ''}"${k === cur ? ' aria-current="page"' : ''}>${T(l + '|f1')}</a>`).join('')}<a class="f1po-l" href="#/plusone/f1">${T('Off track')} <span>Plus One</span></a></nav>`;
}
function shell(cur, body, title) {
  $('#main').innerHTML = `<div class="wrap f1">${nav(cur)}${body}<p class="f1foot">${T('Results, standings and lap data: {j} and {o}. Pictures of drivers: Formula 1, through OpenF1. News: each outlet’s own headline, linked. Updated {t}.', { j: '<a href="https://jolpi.ca" target="_blank" rel="noopener">Jolpica F1</a>', o: '<a href="https://openf1.org" target="_blank" rel="noopener">OpenF1</a>', t: esc(ago(isoMin(F.d.at))) })}${F.d.live ? ' ' + T('The latest result came straight from Jolpica a moment ago.') : ''}</p></div>`;
  document.title = (title ? title + ' · ' : '') + 'F1 · The Watch';
  const on = $('#bar [data-go="#/s/sports"]');
  if (on) { $('#bar [aria-current]') && $('#bar [aria-current]').removeAttribute('aria-current'); on.setAttribute('aria-current', 'page'); }
  bind();
}
function css() {
  if (document.getElementById('f1css')) return;
  const s = document.createElement('style'); s.id = 'f1css'; s.textContent = CSS; document.head.appendChild(s);
}

/* ================= charts ================= */
const chartW = () => Math.max(330, Math.min(920, (window.innerWidth || 920) - ((window.innerWidth || 920) < 820 ? 32 : 64))); // drawn at the size it shows, so the type stays legible
// A line chart of points after each round. series: [{id, label, color, dash, v: [...], hi}]
function lineChart(series, labels, o) {
  o = o || {};
  const W = chartW(), narrow = W < 600, H = o.h ? Math.round(o.h * (narrow ? 0.9 : 1)) : narrow ? 300 : 330, L = 36, R = narrow ? 112 : 138, Tp = 16, B = 34, iw = W - L - R, ih = H - Tp - B;
  const n = labels.length, max = Math.max(1, ...series.map(s => Math.max(...s.v))) * 1.04;
  const x = i => L + (n <= 1 ? iw / 2 : i * iw / (n - 1)), y = v => Tp + ih - v / max * ih;
  const step = max > 400 ? 100 : max > 160 ? 50 : max > 60 ? 20 : 10;
  let g = '';
  for (let v = 0; v <= max; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="gl"/><text x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" class="ax" text-anchor="end">${nf(v)}</text>`;
  const every = Math.ceil(n / (narrow ? 4 : 9)), show = [];
  labels.forEach((l, i) => { if (i % every === 0) show.push(i); });
  if (show[show.length - 1] !== n - 1) { if (n - 1 - show[show.length - 1] < every * 0.75) show.pop(); show.push(n - 1); }
  for (const i of show) g += `<text x="${x(i).toFixed(1)}" y="${H - 12}" class="ax" text-anchor="${i === n - 1 && n > 1 ? 'end' : i === 0 && n > 1 ? 'start' : 'middle'}">${esc(labels[i])}</text>`;
  const order = [...series].sort((a, b) => (a.hi ? 1 : 0) - (b.hi ? 1 : 0));
  const lines = order.map(s => `<path d="${s.v.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1)).join('')}" class="ln${s.hi ? ' hi' : ''}" data-s="${esc(s.id)}" style="--c:${s.hi ? s.color : 'var(--f1mute)'}"${s.dash && s.hi ? ' stroke-dasharray="6 4"' : ''}/>`).join('');
  // direct labels for the highlighted series, nudged apart
  const lab = series.filter(s => s.hi).map(s => ({ s, y: y(s.v[s.v.length - 1]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 14) lab[i].y = lab[i - 1].y + 14;
  const over = lab.length ? lab[lab.length - 1].y - (Tp + ih + 4) : 0; if (over > 0) lab.forEach(l => { l.y -= over; });
  const lbl = lab.map(l => `<text x="${W - R + 8}" y="${(l.y + 4).toFixed(1)}" class="dl" data-s="${esc(l.s.id)}"><tspan class="sw" style="fill:${l.s.color}">■</tspan> ${esc(l.s.label)} <tspan class="v">${nf(l.s.v[l.s.v.length - 1])}</tspan></text>`).join('');
  const id = 'c' + Math.random().toString(36).slice(2, 8);
  F.charts = F.charts || {};
  F.charts[id] = { series, labels, x, y, L, R, W, n, Tp, ih, unit: o.unit || T('pts|f1') };
  return `<div class="f1chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || '')}">${g}${lines}<line class="xh" x1="0" x2="0" y1="${Tp}" y2="${Tp + ih}" visibility="hidden"/>${lbl}<rect class="hit" x="${L}" y="${Tp}" width="${iw}" height="${ih}" fill="transparent"/></svg><div class="f1tip" hidden></div></div>`;
}
function bindCharts() {
  for (const el of document.querySelectorAll('.f1chart[data-chart]')) {
    const c = F.charts && F.charts[el.dataset.chart]; if (!c || el.dataset.b) continue; el.dataset.b = 1;
    const svg = el.querySelector('svg'), tip = el.querySelector('.f1tip'), xh = el.querySelector('.xh');
    const move = ev => {
      const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * c.W;
      const i = Math.max(0, Math.min(c.n - 1, Math.round((px - c.L) / ((c.W - c.L - c.R) / Math.max(1, c.n - 1)))));
      xh.setAttribute('x1', c.x(i)); xh.setAttribute('x2', c.x(i)); xh.setAttribute('visibility', 'visible');
      const rows = c.series.filter(s => s.hi || c.series.length <= 6).map(s => ({ s, v: s.v[i] })).sort((a, b) => b.v - a.v).slice(0, 10);
      tip.innerHTML = `<b>${esc(c.labels[i])}</b>${rows.map(x => `<span><i style="background:${x.s.color}"></i>${esc(x.s.label)}<em>${nf(x.v)}</em></span>`).join('')}`;
      tip.hidden = false;
      const left = (c.x(i) / c.W) * r.width;
      tip.style.left = Math.min(r.width - tip.offsetWidth - 4, Math.max(4, left + 12)) + 'px';
      if (left + 12 + tip.offsetWidth > r.width) tip.style.left = Math.max(4, left - tip.offsetWidth - 12) + 'px';
    };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', () => { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); });
  }
}
// positions lap by lap (a bump chart), with the safety cars shaded and the pit stops marked
function lapChart(rf, res) {
  const laps = rf.laps || {}, ids = res.map(x => x.d).filter(id => laps[id]);
  for (const id of Object.keys(laps)) if (!ids.includes(id)) ids.push(id);
  const nL = Math.max(...ids.map(id => laps[id].length)), nP = Math.max(ids.length, ...ids.map(id => Math.max(...laps[id].filter(Boolean))));
  const W = 920, Hh = Math.max(360, nP * 19 + 40), L = 62, R = 50, Tp = 14, B = 26, iw = W - L - R, ih = Hh - Tp - B;
  const x = l => L + (l - 1) / Math.max(1, nL - 1) * iw, y = p => Tp + (p - 1) / Math.max(1, nP - 1) * ih;
  let g = '';
  for (const [a, b, k] of scBands(rf, nL)) g += `<rect x="${x(a).toFixed(1)}" y="${Tp - 4}" width="${Math.max(3, x(b) - x(a)).toFixed(1)}" height="${ih + 8}" class="scb ${k}"><title>${esc(k === 'VSC' ? T('Virtual safety car') : k === 'RED' ? T('Red flag') : T('Safety car'))}: ${T('laps {a}–{b}', { a, b })}</title></rect><text x="${(x(a) + 3).toFixed(1)}" y="${Tp + 8}" class="scl">${k}</text>`;
  for (let l = 1; l <= nL; l++) if (l === 1 || l % 10 === 0 || l === nL) g += `<line x1="${x(l).toFixed(1)}" x2="${x(l).toFixed(1)}" y1="${Tp}" y2="${Tp + ih}" class="gl"/><text x="${x(l).toFixed(1)}" y="${Hh - 8}" class="ax" text-anchor="middle">${l === 1 ? T('Lap {n}', { n: 1 }) : l}</text>`;
  const grid = {}; for (const x0 of res) grid[x0.d] = x0.g;
  const lines = ids.map(id => {
    const p = laps[id]; let d = '';
    const g0 = grid[id]; if (g0) d += `M${(L - 18).toFixed(1)},${y(g0).toFixed(1)}`;
    p.forEach((v, i) => { if (v) d += (d ? 'L' : 'M') + x(i + 1).toFixed(1) + ',' + y(v).toFixed(1); });
    return `<path d="${d}" class="ln" data-s="${esc(id)}" style="--c:${tc(dteam(id))}"${F.second.has(id) ? ' stroke-dasharray="5 3"' : ''}><title>${esc(dn(id))}</title></path>`;
  }).join('');
  const pits = (rf.pits || []).map(([id, lap]) => laps[id] && laps[id][lap - 1] ? `<circle cx="${x(lap).toFixed(1)}" cy="${y(laps[id][lap - 1]).toFixed(1)}" r="3.4" class="pit" data-s="${esc(id)}" style="--c:${tc(dteam(id))}"><title>${esc(dn(id))}: ${T('pit stop, lap {n}', { n: lap })}</title></circle>` : '').join('');
  const left = ids.filter(id => grid[id]).map(id => `<text x="${L - 22}" y="${(y(grid[id]) + 4).toFixed(1)}" class="dl r" text-anchor="end" data-s="${esc(id)}">${esc(dc(id))}</text>`).join('') + `<text x="${L - 22}" y="${Tp - 2}" class="ax" text-anchor="end">${T('Grid')}</text>`;
  const right = ids.map(id => { const p = laps[id], v = p[p.length - 1]; return v ? `<text x="${(x(p.length) + 6).toFixed(1)}" y="${(y(v) + 4).toFixed(1)}" class="dl" data-s="${esc(id)}">${esc(dc(id))}</text>` : ''; }).join('');
  return `<div class="f1lap" data-lap><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(T('Every driver’s position, lap by lap'))}">${g}${lines}${pits}${left}${right}</svg></div>
    <div class="f1keys" role="group" aria-label="${T('Pick a driver to follow')}">${ids.map(id => `<button type="button" class="chip" data-hl="${esc(id)}">${sw(dteam(id))}${esc(dc(id))}</button>`).join('')}</div>`;
}
const rcKind = (k, msg) => (k === 'SC' || k === 'VSC') && /^VSC|VIRTUAL/.test(msg) ? 'VSC' : k; // older files call the VSC an SC
function scBands(rf, nL) { // [startLap, endLap, 'SC' | 'VSC' | 'RED'] from race control
  const out = []; let open = null;
  for (const [lap, k0, msg] of rf.rc || []) {
    const k = rcKind(k0, msg);
    if (k === 'SC' || k === 'VSC') {
      if (/DEPLOYED/.test(msg) && !open) open = [lap || 1, k];
      else if (open && /(IN THIS LAP|ENDING|WITHDRAWN)/.test(msg)) { out.push([open[0], lap || open[0], open[1]]); open = null; }
    } else if (k === 'RED' && lap) out.push([lap, lap, 'RED']);
  }
  if (open) out.push([open[0], Math.min(nL, open[0] + 3), open[1]]);
  return out;
}
function stintChart(rf, res) {
  const st = rf.stints || {}, ids = res.map(x => x.d).filter(id => st[id]);
  if (!ids.length) return '';
  const nL = Math.max(...res.map(x => x.laps || 0), ...ids.map(id => Math.max(...st[id].map(s => s[1] || 0))));
  const W = 920, row = 22, L = 64, R = 12, H = ids.length * row + 30, iw = W - L - R;
  const x = l => L + (l - 1) / Math.max(1, nL) * iw;
  let g = '';
  for (let l = 1; l <= nL; l += 10) g += `<line x1="${x(l).toFixed(1)}" x2="${x(l).toFixed(1)}" y1="4" y2="${H - 22}" class="gl"/><text x="${x(l).toFixed(1)}" y="${H - 6}" class="ax" text-anchor="middle">${l}</text>`;
  ids.forEach((id, i) => {
    const yy = 6 + i * row;
    g += `<text x="${L - 8}" y="${yy + 13}" class="dl r" text-anchor="end">${esc(dc(id))}</text>`;
    for (const [a, b, c, agel] of st[id]) {
      const e = b || a, t = TYRE[c] || ['#8492A3', '?'], w = Math.max(2, x(e + 1) - x(a) - 2);
      g += `<rect x="${(x(a) + 1).toFixed(1)}" y="${yy}" width="${w.toFixed(1)}" height="16" rx="4" fill="${t[0]}" class="stint${c === 'HARD' ? ' hard' : ''}"><title>${esc(dn(id))}: ${esc(T(cap(c)))}, ${T('laps {a}–{b}', { a, b: e })}${agel ? ', ' + T('{n} laps old at the start', { n: agel }) : ''}</title></rect>${w > 26 ? `<text x="${(x(a) + 1 + w / 2).toFixed(1)}" y="${yy + 12}" class="stl${c === 'HARD' || c === 'MEDIUM' ? ' dk' : ''}" text-anchor="middle">${t[1]}${w > 60 ? ' ' + (e - a + 1) : ''}</text>` : ''}`;
    }
  });
  return `<div class="f1st"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T('Tyre strategy: every stint, in finishing order'))}">${g}</svg></div>
    <p class="f1lg">${Object.entries(TYRE).map(([k, v]) => `<span><i style="background:${v[0]}"${k === 'HARD' ? ' class="hard"' : ''}></i>${T(cap(k))}</span>`).join('')}</p>`;
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
// the track, from its outline and corner positions
function trackSVG(cid, o) {
  const t = F.tr && F.tr[cid]; o = o || {};
  if (!t || !t.pts || t.pts.length < 10) return '';
  const a = (t.rot || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
  const rot = ([X, Y]) => [X * cs - Y * sn, X * sn + Y * cs];
  const P = t.pts.map(rot), C = (t.corners || []).map(c => [c[0], c[1], ...rot([c[2], c[3]])]);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [X, Y] of P) { x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
  const pad = (Math.max(x1 - x0, y1 - y0)) * 0.07, w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
  const sx = X => (X - x0 + pad), sy = Y => (y1 - Y + pad); // north up: the data's y grows upward
  const d = 'M' + P.map(([X, Y]) => sx(X).toFixed(0) + ',' + sy(Y).toFixed(0)).join('L') + 'Z';
  const sw0 = Math.max(w, h) / (o.small ? 50 : 70);
  const start = P[0], nxt = P[2] || P[1];
  const ang = Math.atan2(sy(nxt[1]) - sy(start[1]), sx(nxt[0]) - sx(start[0])) * 180 / Math.PI;
  const corners = o.small ? '' : C.map(([n, l, X, Y]) => `<g class="cn"><circle cx="${sx(X).toFixed(0)}" cy="${sy(Y).toFixed(0)}" r="${(sw0 * 2.3).toFixed(0)}"/><text x="${sx(X).toFixed(0)}" y="${sy(Y).toFixed(0)}" dy=".35em" style="font-size:${(sw0 * 2.4).toFixed(0)}px">${n}${esc(l || '')}</text></g>`).join('');
  return `<svg class="f1trk${o.small ? ' sm' : ''}" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" role="img" aria-label="${esc(T('Map of the circuit'))}"><path d="${d}" class="tb" style="stroke-width:${(sw0 * 2.6).toFixed(0)}"/><path d="${d}" class="tl" style="stroke-width:${(sw0 * 1.2).toFixed(0)}"/>
    <g transform="translate(${sx(start[0]).toFixed(0)} ${sy(start[1]).toFixed(0)}) rotate(${(ang + 90).toFixed(0)})"><rect x="${(-sw0 * 2.4).toFixed(0)}" y="${(-sw0 * 0.6).toFixed(0)}" width="${(sw0 * 4.8).toFixed(0)}" height="${(sw0 * 1.2).toFixed(0)}" class="sf"/></g>${corners}</svg>`;
}
// a stylised 2026 car from above, in the team's colours (no logos, no real livery)
function carSVG(t, o) {
  const w = F.T[t] || {}, c = (w.colors || {}), p = c.primary || tc(t), k = c.secondary || '#15181E';
  const lt = `color-mix(in srgb,${p} 55%,#fff)`, dk = `color-mix(in srgb,${p} 62%,#000)`;
  return `<svg class="f1car${o ? ' ' + o : ''}" viewBox="0 0 320 120" role="img" aria-label="${esc(T('{team} colours on a 2026 car shape', { team: tn(t) }))}">
    <path d="M100 30 L272 34 Q280 60 272 86 L100 90 Q92 60 100 30Z" fill="#2A2F38"/>
    <g stroke="${k}" stroke-width="2.2" stroke-linecap="round"><path d="M62 22 L112 48 M62 98 L112 72 M62 22 L104 54 M62 98 L104 66 M248 21 L222 50 M248 99 L222 70"/></g>
    <rect x="40" y="9" width="44" height="26" rx="8" class="ty"/><rect x="40" y="85" width="44" height="26" rx="8" class="ty"/>
    <rect x="220" y="5" width="56" height="31" rx="9" class="ty"/><rect x="220" y="84" width="56" height="31" rx="9" class="ty"/>
    <path d="M6 18 Q8 14 14 14 L26 16 Q30 18 30 24 L30 96 Q30 102 26 104 L14 106 Q8 106 6 102Z" fill="${k}"/>
    <path d="M10 20 L24 21 L24 99 L10 100Z" fill="${p}"/><path d="M14 22 L20 22 L20 98 L14 98Z" fill="${lt}" opacity=".7"/>
    <path d="M26 55 Q60 52 104 50 L104 70 Q60 68 26 65Z" fill="${p}"/>
    <path d="M104 46 Q122 42 138 34 Q170 26 206 32 L236 44 Q256 50 286 54 L286 66 Q256 70 236 76 L206 88 Q170 94 138 86 Q122 78 104 74Z" fill="${p}"/>
    <path d="M138 34 Q170 27 204 33 L214 38 Q176 40 150 44Z" fill="${dk}" opacity=".85"/><path d="M138 86 Q170 93 204 87 L214 82 Q176 80 150 76Z" fill="${dk}" opacity=".85"/>
    <path d="M196 54 L286 57 L286 63 L196 66Z" fill="${k}" opacity=".9"/>
    <ellipse cx="150" cy="60" rx="17" ry="8" fill="#0B1220"/><path d="M134 60 Q140 48 160 50 Q166 54 168 60 Q166 66 160 70 Q140 72 134 60" fill="none" stroke="${k}" stroke-width="3.4"/>
    <path d="M174 58 L192 56 L192 64 L174 62Z" fill="${k}"/>
    <path d="M284 20 Q288 18 296 18 L312 20 Q316 22 316 26 L316 94 Q316 98 312 100 L296 102 Q288 102 284 100Z" fill="${k}"/>
    <path d="M290 24 L310 25 L310 95 L290 96Z" fill="${p}"/><path d="M296 26 L304 26 L304 94 L296 94Z" fill="${lt}" opacity=".6"/></svg>`;
}

/* ================= pieces ================= */
function podium(res) {
  const top = res.filter(x => x.pos <= 3).sort((a, b) => a.pos - b.pos);
  return `<ol class="f1pod">${top.map(x => `<li class="p${x.pos}"><span class="pp">${x.pos}</span>${face(x.d)}<span class="pn"><a href="#/f1/driver/${esc(x.d)}">${esc(dn(x.d))}</a><small>${sw(x.t)}${esc(tn(x.t))}</small></span><span class="pt">${x.pos === 1 ? esc(x.time || '') : esc(gapText(x, res))}</span></li>`).join('')}</ol>`;
}
function gapText(x, res) {
  if (x.pos === 1) return x.time || '';
  const lead = res.find(r => r.pos === 1);
  if (lead && x.laps && x.laps < lead.laps && !retired(x)) return T(lead.laps - x.laps === 1 ? '+1 lap' : '+{n} laps', { n: lead.laps - x.laps });
  if (x.time) return x.time.startsWith('+') ? x.time : '+' + x.time;
  return T(x.st || '–');
}
const retired = x => !(x.time || /Finished|Lapped|^\+\d+ Laps?$/.test(x.st || ''));
function resultTable(res, o) {
  o = o || {};
  const fl = res.find(x => x.fl && x.fl.rank === 1);
  return `<div class="stk-wrap"><table class="gtab f1t"><thead><tr><th class="r">${T('Pos')}</th><th>${T('Driver')}</th><th class="f1hm">${T('Team')}</th>${o.sprint ? '' : `<th class="r f1hm">${T('Grid')}</th><th class="r f1hm">+/−</th>`}<th class="r f1hm">${T('Laps')}</th><th class="r">${T('Time or gap')}</th><th class="r">${T('Pts')}</th></tr></thead>
    <tbody>${res.map(x => { const dlt = x.g && x.pos && !retired(x) ? x.g - x.pos : null; return `<tr${retired(x) ? ' class="dnf"' : ''}><td class="r"><b>${esc(x.pt && !/^\d+$/.test(x.pt) ? x.pt : x.pos)}</b></td><td>${sw(x.t)}${dlink(x.d)}${fl && fl.d === x.d ? ` <span class="f1fl" title="${esc(T('Fastest lap: {t} on lap {n}', { t: fl.fl.time, n: fl.fl.lap }))}">${T('Fastest lap')}</span>` : ''}</td><td class="f1hm">${esc(tn(x.t))}</td>${o.sprint ? '' : `<td class="r f1hm">${x.g || T('Pit lane')}</td><td class="r f1hm ${dlt > 0 ? 'up' : dlt < 0 ? 'dn' : ''}">${dlt == null ? '' : dlt > 0 ? '▲' + dlt : dlt < 0 ? '▼' + -dlt : '–'}</td>`}<td class="r f1hm">${x.laps ?? ''}</td><td class="r">${esc(gapText(x, res))}</td><td class="r">${x.pts ? nf(x.pts, x.pts % 1 ? 1 : 0) : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
}
function qualiTable(q) {
  const best = x => ms3(x.q3) || ms3(x.q2) || ms3(x.q1), pole = best(q[0] || {});
  return `<div class="stk-wrap"><table class="gtab f1t"><thead><tr><th class="r">${T('Pos')}</th><th>${T('Driver')}</th><th class="r">Q1</th><th class="r">Q2</th><th class="r">Q3</th><th class="r">${T('Gap')}</th></tr></thead>
    <tbody>${q.map(x => `<tr><td class="r"><b>${x.pos}</b></td><td>${sw(x.t)}${dlink(x.d)}</td><td class="r">${esc(x.q1 || '')}</td><td class="r">${esc(x.q2 || '')}</td><td class="r">${esc(x.q3 || '')}</td><td class="r">${x.pos > 1 && best(x) && pole ? '+' + nf((best(x) - pole) / 1000, 3) : ''}</td></tr>`).join('')}</tbody></table></div>`;
}
function ms3(t) { if (!t) return null; const p = t.split(':'); const s = +p[p.length - 1] + (p.length > 1 ? +p[0] * 60 : 0); return isNaN(s) ? null : Math.round(s * 1000); }
function standingsTable(kind, limit) {
  const st = F.d.standings || {};
  if (kind === 'teams') {
    const xs = (st.teams || []).slice(0, limit || 99), max = Math.max(1, ...xs.map(x => x.pts));
    return `<table class="gtab f1t f1s"><thead><tr><th class="r">${T('Pos')}</th><th>${T('Team')}</th><th class="f1hm"></th><th class="r">${T('Wins')}</th><th class="r">${T('Pts')}</th></tr></thead><tbody>${xs.map(x => `<tr><td class="r"><b>${x.pos || ''}</b></td><td>${sw(x.t)}${tlink(x.t)}</td><td class="f1hm bar"><span style="width:${(x.pts / max * 100).toFixed(1)}%;background:${tc(x.t)}"></span></td><td class="r">${x.wins || ''}</td><td class="r"><b>${nf(x.pts)}</b></td></tr>`).join('')}</tbody></table>`;
  }
  const xs = (st.drivers || []).slice(0, limit || 99), lead = xs[0] ? xs[0].pts : 0;
  return `<table class="gtab f1t f1s"><thead><tr><th class="r">${T('Pos')}</th><th>${T('Driver')}</th><th class="f1hm">${T('Team')}</th><th class="r">${T('Wins')}</th><th class="r">${T('Pts')}</th><th class="r f1hm">${T('Behind')}</th></tr></thead><tbody>${xs.map(x => `<tr><td class="r"><b>${x.pos || ''}</b></td><td>${sw((x.t || [])[x.t.length - 1])}${dlink(x.d)}</td><td class="f1hm">${(x.t || []).map(t => esc(tn(t))).join(', ')}</td><td class="r">${x.wins || ''}</td><td class="r"><b>${nf(x.pts)}</b></td><td class="r f1hm">${x.pts < lead ? '−' + nf(lead - x.pts) : ''}</td></tr>`).join('')}</tbody></table>`;
}
function raceCard(r) {
  const s = status(r), res = F.d.results[r.r], w = res && res.find(x => x.pos === 1), rp = F.RP[r.r];
  return `<a class="f1rc s-${s}" href="#/f1/race/${r.r}" style="${w ? `--tc:${tc(w.t)}` : ''}"><span class="rn">${T('Round {n}', { n: r.r })}${r.sprint ? ` <em>${T('Sprint')}</em>` : ''}</span><span class="nm">${esc(short(r))}</span><span class="dt">${esc(weekend(r))} · ${esc(r.city || '')}</span>
    ${w ? `<span class="wn">${face(w.d, 'sm')}<span><b>${esc(df(w.d))}</b><small>${esc(tn(w.t))}</small></span></span>` : s === 'live' ? `<span class="lv">${T('This weekend')}</span>` : s === 'pending' ? `<span class="lv">${T('Results coming in')}</span>` : `<span class="up">${esc(dayOnly(r.start, youZone))}</span>`}
    ${rp && rp.headline && w ? `<span class="hl"${enAttr()}>${esc(rp.headline)}</span>` : ''}</a>`;
}
function newsList(xs, n, noTag) {
  if (!xs || !xs.length) return `<p class="note">${T('Nothing came in with this update.')}</p>`;
  return `<ul class="glist f1news">${xs.slice(0, n || 12).map(x => `<li${x.l ? ` lang="${x.l === 'pt' ? 'pt-BR' : 'de'}"` : ''}>${x.m ? `<img src="${esc(x.m)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<div><a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.t)}</a> <span>${esc(x.o)} · ${ago(isoMin(x.p))}${x.r && F.byR[x.r] && !noTag ? ` · <a class="tagr" href="#/f1/race/${x.r}">${esc(short(F.byR[x.r]))}</a>` : ''}</span></div></li>`).join('')}</ul>`;
}
function newsFor(o) { // the hub's own feed, then the edition's F1-tagged stories, newest first, in the reader's language first
  const xs = (F.d.news || []).slice();
  if (W.E && W.E.items) {
    const have = new Set(xs.map(x => x.u));
    for (const it of W.E.items) if ((it.k || []).includes('#f1') || (it.k || []).includes('f1')) if (!have.has(it.u)) xs.push({ t: it.t, u: it.u, o: outlet(it.o), p: new Date(it.p * 60000).toISOString(), m: it.m, l: it.l });
  }
  let out = xs.filter(x => !x.l || x.l === LANG);
  if (o && o.r) out = out.filter(x => x.r === o.r);
  if (o && o.rx) out = out.filter(x => o.rx.test(x.t + ' ' + (x.d || '')));
  return out.sort((a, b) => (b.l === LANG) - (a.l === LANG) || (a.p < b.p ? 1 : -1));
}
function vidCard(v) {
  return `<article class="gv"><div class="vframe"><img src="${esc(ytThumb(v.v, 'mqdefault'))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><button type="button" class="vplay" data-dplay="${esc(v.v)}" aria-label="${esc(T('Play: {title}', { title: v.t }))}"><span>▶</span></button></div>
    <h3>${esc(v.t)}</h3><p class="mt"><span class="ou">Formula 1</span><span>${ago(isoMin(v.p))}</span></p></article>`;
}
const highlight = (r, k) => { const rp = F.RP[r]; const v = (F.d.videos || []).find(x => x.r === r && x.k === (k || 'race')); return v ? v : rp && rp.video && (k || 'race') === 'race' ? { v: rp.video, t: short(F.byR[r]) + ' · ' + T('Race highlights') } : null; };
function bigVideo(v) {
  return `<div class="vframe big"><img src="${esc(ytThumb(v.v, 'maxresdefault'))}" data-orig="${esc(ytThumb(v.v))}" alt="" referrerpolicy="no-referrer" onerror="if(this.src!==this.dataset.orig){this.src=this.dataset.orig}"><button type="button" class="vplay" data-dplay="${esc(v.v)}" aria-label="${esc(T('Play: {title}', { title: v.t }))}"><span>▶</span></button></div>`;
}
function watchBlock() {
  const s = F.w.season; if (!s || !s.watch) return '';
  const pref = LANG === 'pt' ? /Brazil|Brasil/ : LANG === 'de' ? /German|Deutsch|Austria/ : /^United States/;
  const ws = s.watch.slice().sort((a, b) => pref.test(b.region) - pref.test(a.region));
  const one = w => `<div class="f1w"><h3>${esc(w.region)}</h3><p${enAttr()}><b>${plain(w.who)}</b>${w.how ? ' · ' + plain(w.how) : ''}</p>${w.price ? `<p class="note"${enAttr()}>${plain(w.price)}</p>` : ''}</div>`;
  return `<section class="blk f1watch"><div class="blk-h"><h2 class="sec-h">${T('How to watch')}</h2></div>${one(ws[0])}${ws.length > 1 ? `<details><summary>${T('Elsewhere')}</summary><div class="f1wg">${ws.slice(1).map(one).join('')}</div></details>` : ''}
    ${s.tickets ? `<p class="f1tix"><a class="pri" href="${esc(s.tickets.official)}" target="_blank" rel="noopener">${T('Official tickets')} ↗</a> <span class="note"${enAttr()}>${plain(s.tickets.notes)}</span></p>` : ''}</section>`;
}

/* ================= the Sports desk's card ================= */
function deskCard() {
  const r = nextRace(), st = F.d.standings || {}, top = (st.drivers || []).slice(0, 3), ld = lastDone();
  const ns = r && nextSession(r), w = ld && (F.d.results[ld.r] || []).find(x => x.pos === 1);
  return `<a class="f1desk" href="#/f1"><span class="k">Formula 1 · ${F.d.season}</span>
    <span class="t">${r ? esc(r.name) : T('The season is over')}</span>
    <span class="d">${r ? T('Round {n} of {m}', { n: r.r, m: F.R.length }) + ' · ' + esc(r.circuit) + ' · ' + esc(weekend(r)) + (ns ? ' · ' + (ns.on ? T('{s} is on now', { s: T(SN[ns.k]) }) : T('{s} {when} your time', { s: T(SN[ns.k]), when: wday(ns.iso) })) : '') : ''}</span>
    <span class="fx">${top.map(x => `<span>${x.pos}. ${esc(df(x.d))} ${nf(x.pts)}</span>`).join('')}${w ? `<span>${T('Last race: {gp}, won by {who}', { gp: esc(short(ld)), who: esc(df(w.d)) })}</span>` : ''}</span>
    <span class="fgo">${T('Calendar, results, drivers and the cars')} →</span></a>`;
}

/* ================= views ================= */
async function render(p, keep) {
  css();
  if (F.tick) { clearInterval(F.tick); F.tick = null; }
  if (!F.d) {
    $('#main').innerHTML = `<div class="wrap state"><h2>${T('Opening the F1 hub…')}</h2></div>`;
    try { await ensure(); } catch (e) { $('#main').innerHTML = `<div class="wrap state"><h2>${T('The F1 data didn’t load')}</h2><p>${T('Check your connection and try again.')}</p><button type="button" onclick="location.reload()">${T('Try again')}</button></div>`; return; }
    if (W.view.t !== 'f1' || W.view.p !== p) return;
  }
  F.charts = {};
  const [a, b] = String(p || '').split('/');
  if (a === 'race' && F.byR[+b]) await renderRace(+b);
  else if (a === 'calendar') await renderCalendar();
  else if (a === 'standings') renderStandings();
  else if (a === 'drivers') renderDrivers();
  else if (a === 'driver' && b) await renderDriver(b);
  else if (a === 'cars') renderCars();
  else if (a === 'car' && b) await renderCar(b);
  else if (a === 'rules') renderRules();
  else if (a === 'news') renderNews(b);
  else await renderHub();
  if (!keep) window.scrollTo(0, 0);
  if (Date.now() - F.topped > 10 * 60000) topUp();
}

async function renderHub() {
  await ensureTracks();
  const d = F.d, s = F.w.season, r = nextRace(), ld = lastDone(), st = d.standings || {};
  const ldr = ld && d.results[ld.r], hv = ld && highlight(ld.r), rp = ld && F.RP[ld.r];
  const pr = d.progress || {}, labels = (pr.rounds || []).map(n => F.byR[n] ? short(F.byR[n]) : String(n));
  const top = (st.drivers || []).slice(0, 6).map(x => x.d);
  const series = Object.entries(pr.d || {}).map(([id, v]) => ({ id, label: df(id), color: tc(dteam(id)), dash: F.second.has(id), v, hi: top.includes(id) }));
  const tops = (st.teams || []).slice(0, 5).map(x => x.t);
  const tser = Object.entries(pr.t || {}).map(([id, v]) => ({ id, label: tn(id), color: tc(id), v, hi: tops.includes(id) }));
  const vids = (d.videos || []).filter(v => !/^LIVE\b/i.test(v.t)).slice(0, 12);
  shell('', `
    ${r ? heroNext(r) : heroOver()}
    ${s && s.lede ? `<div class="f1lede"${enAttr()}>${mdx(s.lede, [])}</div>` : ''}
    <section class="blk"><div class="blk-h"><h2 class="sec-h">${T('The championship')}</h2><a class="more" href="#/f1/standings">${T('Full standings')} →</a></div>
      ${s && s.title ? `<div class="f1title"${enAttr()}>${mdx(s.title.text, s.title.sources)}</div>` : ''}
      <div class="f1tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-tab="pd">${T('Drivers')}</button><button type="button" role="tab" aria-selected="false" data-tab="pt">${T('Teams')}</button></div>
      <div data-pane="pd">${series.length ? lineChart(series, labels, { aria: T('Points after each round, the top six drivers in their team colours') }) : ''}<p class="note">${T('The top six in colour; teammates dashed. Hover or tap for each round.')}</p></div>
      <div data-pane="pt" hidden>${tser.length ? lineChart(tser, labels, { aria: T('Points after each round, by team') }) : ''}</div>
      <div class="blk two f1two"><div>${standingsTable('drivers', 10)}<p><a class="f1more" href="#/f1/standings">${T('All {n} drivers', { n: (st.drivers || []).length })} →</a></p></div><div>${standingsTable('teams')}</div></div></section>
    ${ld ? `<section class="blk f1last"><div class="blk-h"><h2 class="sec-h">${T('Last time out: {gp}', { gp: esc(ld.name) })}</h2><a class="more" href="#/f1/race/${ld.r}">${T('Lap chart, strategy and the full result')} →</a></div>
      <div class="f1lastg"><div>${podium(ldr)}${rp ? `<h3 class="f1h3"${enAttr()}>${esc(rp.headline || '')}</h3><div class="f1rep"${enAttr()}>${mdx(rp.report, rp.sources)}</div>` : ''}</div><div>${hv ? bigVideo(hv) : ''}${lastFacts(ld)}</div></div></section>` : ''}
    <section class="blk"><div class="blk-h"><h2 class="sec-h">${T('The calendar')}</h2><a class="more" href="#/f1/calendar">${T('The season on a map')} →</a></div>
      <div class="f1cal row">${F.R.map(raceCard).join('')}</div></section>
    <section class="blk"><div class="blk-h"><h2 class="sec-h">${T('The cars')}</h2><a class="more" href="#/f1/cars">${T('Every car, side by side')} →</a></div>
      <p class="sub2">${T('Eleven teams and five engine makers under all-new rules: what each car is, what it does differently and what each team has bolted on since.')}</p>
      <div class="f1cars">${F.teams.map(carCard).join('')}</div></section>
    ${s && s.storylines && s.storylines.length ? `<section class="blk"><h2 class="sec-h">${T('The season’s storylines')}</h2><div class="f1story">${s.storylines.map(x => `<article${enAttr()}><h3>${esc(x.title)}</h3>${mdx(x.body, x.sources)}</article>`).join('')}</div></section>` : ''}
    <section class="blk two"><div><div class="blk-h"><h2 class="sec-h">${T('F1 news')}</h2><a class="more" href="#/f1/news">${T('All F1 news')} →</a></div>${newsList(newsFor(), 10)}</div>
      <div><h2 class="sec-h">${T('Drivers to know')}</h2>${driverMini()}</div></section>
    ${vids.length ? `<section class="blk"><h2 class="sec-h">${T('From Formula 1’s channel')}</h2><div class="gvr">${vids.map(vidCard).join('')}</div></section>` : ''}
    ${watchBlock()}
    <p class="note f1by">${written()}</p>`, T('Formula 1'));
  if (r) startTick(r);
}
function heroNext(r) {
  const ns = nextSession(r), c = F.C[r.cid] || {}, tz = c.tz;
  return `<section class="f1hero"><div class="hx"><p class="k">${T('Next up')} · ${T('Round {n} of {m}', { n: r.r, m: F.R.length })}${r.sprint ? ' · ' + T('Sprint weekend') : ''}</p>
      <h1><a href="#/f1/race/${r.r}">${esc(r.name)}</a></h1>
      <p class="d">${esc(r.circuit)} · ${esc(r.city || '')}, ${esc(r.country || '')} · ${esc(weekend(r))}</p>
      ${ns ? `<div class="cd" data-cd="${esc(ns.iso)}" data-k="${ns.k}">${cdHTML(ns)}</div>` : ''}
      <ul class="f1ss">${r.sessions.map(([k, iso]) => `<li class="${Date.parse(iso) + LEN[k] * 60000 < Date.now() ? 'past' : ns && ns.iso === iso ? 'nx' : ''}"><b>${T(SN[k])}</b><span>${esc(wday(iso))}</span>${tz ? `<small>${esc(wday(iso, tz))} ${T('at the track')}</small>` : ''}</li>`).join('')}</ul>
      <p class="tz">${T('Times are yours: {zone}.', { zone: esc(zoneName(youZone)) })} <a href="#/f1/race/${r.r}">${T('Race guide')} →</a></p></div>
    <div class="f1side">${trackSVG(r.cid) || ''}${c.length ? `<dl><div><dt>${T('Lap')}</dt><dd>${nf(c.length, 3)} km</dd></div><div><dt>${T('Laps')}</dt><dd>${c.laps}</dd></div><div><dt>${T('Corners')}</dt><dd>${c.corners}</dd></div>${c.record ? `<div><dt>${T('Lap record')}</dt><dd>${esc(c.record.time)}</dd></div>` : ''}</dl>` : ''}</div></section>`;
}
function cdHTML(ns) {
  if (ns.on) return `<span class="on">● ${T('{s} is on now', { s: T(SN[ns.k]) })}</span>`;
  return `<span class="lbl">${T('{s} starts in', { s: T(SN[ns.k]) })}</span>${countdown(ns.iso).map(([v, u]) => `<span class="u"><b>${String(v).padStart(2, '0')}</b><small>${u}</small></span>`).join('')}`;
}
function startTick(r) {
  F.tick = setInterval(() => {
    const el = document.querySelector('.f1hero .cd'); if (!el || W.view.t !== 'f1') { clearInterval(F.tick); F.tick = null; return; }
    const ns = nextSession(r); if (!ns) return;
    if (ns.iso !== el.dataset.cd) { el.dataset.cd = ns.iso; }
    el.innerHTML = cdHTML(ns);
  }, 1000);
}
function heroOver() {
  const st = F.d.standings || {}, ch = (st.drivers || [])[0], ct = (st.teams || [])[0];
  return `<section class="f1hero over"><div class="hx"><p class="k">${T('The {y} season is over', { y: F.d.season })}</p><h1>${ch ? T('{who} is the world champion', { who: esc(dn(ch.d)) }) : ''}</h1>
    <p class="d">${ct ? T('{team} won the constructors’ title with {n} points.', { team: esc(tn(ct.t)), n: nf(ct.pts) }) : ''}</p></div><div class="f1side">${ch ? face(ch.d, 'xl') : ''}</div></section>`;
}
function lastFacts(r) {
  const res = F.d.results[r.r] || [], q = F.d.quali[r.r] || [], fl = res.find(x => x.fl && x.fl.rank === 1), pole = q[0];
  const gain = res.filter(x => x.g && !retired(x)).map(x => ({ x, g: x.g - x.pos })).sort((a, b) => b.g - a.g)[0];
  const out = res.filter(retired);
  return `<dl class="gspec f1facts">${pole ? `<div><dt>${T('Pole')}</dt><dd>${dlink(pole.d)} <small>${esc(pole.q3 || pole.q2 || '')}</small></dd></div>` : ''}${fl ? `<div><dt>${T('Fastest lap')}</dt><dd>${dlink(fl.d)} <small>${esc(fl.fl.time)}</small></dd></div>` : ''}
    ${gain && gain.g > 0 ? `<div><dt>${T('Most places gained')}</dt><dd>${dlink(gain.x.d)} <small>${T('{n} places', { n: gain.g })}</small></dd></div>` : ''}<div><dt>${T('Didn’t finish')}</dt><dd>${out.length ? out.map(x => esc(df(x.d))).join(', ') : T('Everyone finished')}</dd></div></dl>`;
}
function carCard(t) {
  const w = F.T[t] || {}, c = w.car || {}, st = ((F.d.standings || {}).teams || []).find(x => x.t === t) || {};
  const ds = F.now[t] || [];
  return `<a class="f1cc" href="#/f1/car/${esc(t)}" style="--tc:${tc(t)}">${carSVG(t)}<span class="cn">${esc(c.name || '')}</span><span class="tm">${esc(tn(t))}</span>
    <span class="pu">${c.pu ? esc(c.pu.maker) + (c.pu.works ? ' · ' + T('works') : ' · ' + T('customer')) : ''}</span><span class="ds">${ds.map(id => esc(df(id))).join(' · ')}</span><span class="pts">${st.pos ? `${ord(st.pos)} · ${nf(st.pts)} ${T('pts|f1')}` : ''}</span></a>`;
}
function driverMini() {
  const st = (F.d.standings || {}).drivers || [];
  return `<div class="f1dm">${st.slice(0, 8).map(x => `<a href="#/f1/driver/${esc(x.d)}" style="--tc:${tc(dteam(x.d))}">${face(x.d)}<span><b>${esc(dn(x.d))}</b><small>${esc(tn(dteam(x.d)))} · ${nf(x.pts)} ${T('pts|f1')}</small></span></a>`).join('')}</div><p><a class="f1more" href="#/f1/drivers">${T('All the drivers')} →</a></p>`;
}

/* ---------- a race weekend ---------- */
async function renderRace(n) {
  const r = F.byR[n], c = F.C[r.cid] || {}, s = status(r), rp = F.RP[n] || null;
  await Promise.all([ensureTracks(), s === 'done' ? raceFile(n) : null]);
  if (W.view.t !== 'f1' || W.view.p !== 'race/' + n) return;
  const res = F.d.results[n], q = F.d.quali[n], sp = F.d.sprints[n], rf = F.rf[n];
  const prev = F.byR[n - 1], next = F.byR[n + 1], tz = c.tz, hv = highlight(n), qv = highlight(n, 'quali'), sv = highlight(n, 'sprint');
  const ns = s !== 'done' && nextSession(r);
  const rnews = newsFor({ r: n });
  shell('calendar', `<article class="f1race">
    <p class="crumb"><a href="#/f1/calendar">${T('Calendar')}</a> · ${T('Round {n} of {m}', { n, m: F.R.length })}</p>
    <div class="f1rh"><div><h1>${esc(r.name)}</h1><p class="d">${esc(r.circuit)} · ${esc(r.city || '')}, ${esc(r.country || '')} · ${esc(dayLong(r.start, tz || 'UTC'))}</p>
      ${s === 'done' && res ? '' : ns ? `<p class="f1chip">${ns.on ? '● ' + T('{s} is on now', { s: T(SN[ns.k]) }) : T('{s} {when} your time', { s: T(SN[ns.k]), when: esc(wday(ns.iso)) })}</p>` : s === 'pending' ? `<p class="f1chip">${T('The result is coming in')}</p>` : ''}</div>
      <nav class="f1pn">${prev ? `<a href="#/f1/race/${prev.r}">← ${esc(short(prev))}</a>` : ''}${next ? `<a href="#/f1/race/${next.r}">${esc(short(next))} →</a>` : ''}</nav></div>
    ${res ? `<div class="f1rr"><div>${podium(res)}${rp ? `<h2 class="f1h3"${enAttr()}>${esc(rp.headline || '')}</h2><div class="f1rep"${enAttr()}>${mdx(rp.report, rp.sources)}</div>${rp.moments && rp.moments.length ? `<ul class="f1mom"${enAttr()}>${rp.moments.map(m => `<li>${plain(m)}</li>`).join('')}</ul>` : ''}${srcs(rp.sources)}` : ''}</div>
      <div>${hv ? bigVideo(hv) : ''}${lastFacts(r)}${rf && rf.wx ? wxLine(rf.wx) : ''}${rf && rf.otn ? `<p class="note">${T('{n} overtakes on track, by the timing data’s count.', { n: rf.otn })}</p>` : ''}</div></div>` : ''}
    <section class="blk f1g2"><div><h2 class="sec-h">${T('The circuit')}</h2>${trackSVG(r.cid) || `<p class="note">${T('No map of this circuit yet.')}</p>`}</div>
      <div>${c.length ? `<dl class="gspec">${[[T('Circuit length'), nf(c.length, 3) + ' km'], [T('Laps'), c.laps], [T('Race distance'), c.distance ? nf(c.distance, 3) + ' km' : '–'], [T('Corners'), c.corners], [T('First grand prix here'), c.first || '–'], [T('Lap record'), c.record ? `${esc(c.record.time)} <small>${esc(c.record.driver)}, ${c.record.year}</small>` : '–'], [T('Type'), T(cap(c.type || '–'))], [T('Tyres'), c.tyres ? esc(c.tyres) : '–']].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        <div class="f1rep"${enAttr()}>${mdx(c.character, c.sources)}</div>${c.overtaking ? `<p${enAttr()}><b>${T('Where they pass')}:</b> ${plain(c.overtaking)}</p>` : ''}` : ''}
        <h3 class="glb">${T('The weekend')}</h3><ul class="f1ses">${r.sessions.map(([k, iso]) => `<li class="${Date.parse(iso) + LEN[k] * 60000 < Date.now() ? 'past' : ''}"><b>${T(SN[k])}</b><span>${esc(wday(iso))}</span>${tz ? `<small>${esc(wday(iso, tz))} ${T('local')}</small>` : ''}</li>`).join('')}</ul><p class="note">${T('Your times: {zone}.', { zone: esc(zoneName(youZone)) })}</p>
        ${c.tickets && s !== 'done' ? `<p><a class="f1btn" href="${esc(c.tickets)}" target="_blank" rel="noopener">${T('Tickets')} ↗</a></p>` : ''}</div></section>
    ${rf && rf.laps ? `<section class="blk"><h2 class="sec-h">${T('The race, lap by lap')}</h2><p class="sub2">${T('Every driver’s position at the end of each lap, from the grid on the left to the flag on the right. Safety-car periods are shaded and pit stops are dots. Pick a driver to follow them.')}</p>${lapChart(rf, res)}</section>` : res ? `<p class="note">${T('The lap chart and strategy arrive with the next update.')}</p>` : ''}
    ${rf && rf.stints ? `<section class="blk"><h2 class="sec-h">${T('Tyre strategy')}</h2>${stintChart(rf, res)}</section>` : ''}
    ${rf && rf.laps ? paceBlock(rf, res) : ''}
    ${res ? `<section class="blk"><h2 class="sec-h">${T('The result')}</h2>${resultTable(res)}</section>` : ''}
    ${rf && (rf.pits || []).length ? pitBlock(rf) : ''}
    ${rf && (rf.rc || []).length ? rcBlock(rf) : ''}
    ${q && q.length ? `<section class="blk"><div class="blk-h"><h2 class="sec-h">${T('Qualifying')}</h2></div>${qv ? `<div class="f1v1">${vidCard(qv)}</div>` : ''}${qualiTable(q)}</section>` : ''}
    ${sp && sp.length ? `<section class="blk"><h2 class="sec-h">${T('The sprint')}</h2>${sv ? `<div class="f1v1">${vidCard(sv)}</div>` : ''}${resultTable(sp, { sprint: true })}</section>` : ''}
    ${!res && c.length ? lastYear(c) : ''}
    ${rnews.length ? `<section class="blk"><h2 class="sec-h">${T('In the news')}</h2>${newsList(rnews, 12, true)}</section>` : ''}
    ${s !== 'done' ? watchBlock() : ''}
    ${c.sources ? srcs(c.sources, T('About the circuit: sources')) : ''}
  </article>`, r.name);
}
const lastYear = c => c.last ? `<p class="note"${enAttr()}>${T('Last year’s winner')}: ${plain(c.last)}</p>` : '';
function wxLine(w) {
  return `<p class="f1wx">${w.air ? `<span>${T('Air')} ${nf(w.air[0], 0)}–${nf(w.air[1], 0)}°C</span>` : ''}${w.track ? `<span>${T('Track')} ${w.track[0] > 0 ? nf(w.track[0], 0) + '–' : ''}${nf(w.track[1], 0)}°C</span>` : ''}${w.hum != null ? `<span>${T('Humidity')} ${w.hum}%</span>` : ''}<span>${w.rain ? T('Rain fell during the race') : T('Dry')}</span></p>`;
}
function paceBlock(rf, res) { // median clean-lap pace of the top ten, from the lap times
  const sc = scBands(rf, 999), inSC = l => sc.some(([a, b]) => l >= a && l <= b + 1);
  const pitL = new Set((rf.pits || []).map(([id, lap]) => id + ':' + lap));
  const rows = res.filter(x => !retired(x)).slice(0, 12).map(x => {
    const ts = (rf.times[x.d] || []).map((v, i) => v && i > 0 && !inSC(i + 1) && !pitL.has(x.d + ':' + (i + 1)) && !pitL.has(x.d + ':' + i) ? v : null).filter(Boolean).sort((a, b) => a - b);
    return { x, med: ts.length > 5 ? ts[Math.floor(ts.length / 2)] : null, best: ts[0] };
  }).filter(r => r.med);
  if (rows.length < 4) return '';
  const fast = Math.min(...rows.map(r => r.med)), max = Math.max(...rows.map(r => r.med - fast)) || 1;
  rows.sort((a, b) => a.med - b.med);
  return `<section class="blk"><h2 class="sec-h">${T('Race pace')}</h2><p class="sub2">${T('Each finisher’s typical lap (the median, leaving out the first lap, pit laps and safety cars), against the fastest.')}</p>
    <div class="f1bars">${rows.map(r => `<div><span class="l">${sw(r.x.t)}${esc(df(r.x.d))}</span><span class="b"><i style="width:${(Math.max(2, (r.med - fast) / max * 100)).toFixed(1)}%;background:${tc(r.x.t)}"></i></span><span class="v">${r.med === fast ? fmtLap(r.med) : '+' + nf((r.med - fast) / 1000, 3)}</span></div>`).join('')}</div></section>`;
}
const fmtLap = m => { const s = m / 1000, mm = Math.floor(s / 60); return mm + ':' + (s - mm * 60).toFixed(3).padStart(6, '0'); };
function pitBlock(rf) {
  const ps = rf.pits.filter(p => p[3]).slice().sort((a, b) => a[3] - b[3]);
  const per = {}; for (const [id] of rf.pits) per[id] = (per[id] || 0) + 1;
  const counts = Object.values(per), avg = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
  return `<section class="blk"><h2 class="sec-h">${T('Pit stops')}</h2><p class="sub2">${T('{n} stops, {a} a driver on average. The time is from pit entry to pit exit, so it includes the drive down the pit lane.', { n: rf.pits.length, a: nf(avg, 1) })}</p>
    <div class="stk-wrap"><table class="gtab f1t"><thead><tr><th>${T('Driver')}</th><th class="r">${T('Lap')}</th><th class="r">${T('Stop')}</th><th class="r">${T('Pit lane time')}</th></tr></thead><tbody>${ps.slice(0, 10).map(([id, lap, stop, dur]) => `<tr><td>${sw(dteam(id))}${dlink(id)}</td><td class="r">${lap}</td><td class="r">${stop}</td><td class="r">${nf(dur, 3)} s</td></tr>`).join('')}</tbody></table></div></section>`;
}
function rcCase(m) { // RACE CONTROL'S CAPITALS, in sentence case, with its acronyms and driver codes kept
  const s = m.toLowerCase().replace(/\b(fia|vsc|sc|drs|f1|ers|pu|ice|mgu-k|dsq)\b/g, w => w.toUpperCase()).replace(/\(([a-z]{3})\)/g, (a, c) => `(${c.toUpperCase()})`).replace(/\bcar (\d+)/g, 'car $1');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function rcBlock(rf) {
  const k = { SC: T('Safety car'), VSC: T('Virtual safety car'), RED: T('Red flag'), PEN: T('Penalty'), INV: T('Investigation'), INFO: T('Note'), END: T('Chequered flag') };
  const xs = rf.rc.filter(([lap, kk, msg]) => !(kk === 'INV' && /NO FURTHER|NOTED/.test(msg)) && !(kk === 'INFO' && (lap || 0) <= 1));
  return `<section class="blk"><h2 class="sec-h">${T('From race control')}</h2><p class="sub2">${T('The race director’s messages that changed the race: safety cars, red flags, penalties and investigations.')}</p>
    <ol class="f1rc2">${xs.slice(0, 40).map(([lap, k0, msg]) => [lap, rcKind(k0, msg), msg]).map(([lap, kk, msg]) => `<li class="k-${kk}"><span class="lp">${lap ? T('Lap {n}', { n: lap }) : ''}</span><span class="kd">${esc(k[kk] || kk)}</span><span class="m"${enAttr()}>${esc(rcCase(msg))}</span></li>`).join('')}</ol></section>`;
}

/* ---------- the calendar and the map ---------- */
async function renderCalendar() {
  let world = F.world;
  if (!world) { try { world = F.world = await getJSON('f1/world.json'); } catch (e) { world = null; } }
  if (W.view.t !== 'f1' || W.view.p !== 'calendar') return;
  const s = F.w.season, rs = F.R, km = travel(rs);
  shell('calendar', `<div class="page-h"><h1>${T('The {y} calendar', { y: F.d.season })}</h1><p>${T('{n} rounds on {c} continents; about {km} km from the first race to the last, flying straight between them.', { n: rs.length, c: continents(rs), km: nf(Math.round(km / 1e6) * 1000) })}</p></div>
    ${world ? mapSVG(world, rs) : ''}
    ${s && s.calendar ? `<div class="f1rep f1calnote"${enAttr()}>${mdx(s.calendar, s.calendar_sources)}</div>` : ''}
    ${(F.d.cancelled || []).length ? `<p class="note">${T('Called off')}: ${F.d.cancelled.map(c => `${esc(c.name)} (${esc(c.where)}, ${esc(dayOnly(c.date + 'T12:00:00Z', 'UTC'))})`).join(' · ')}</p>` : ''}
    <div class="stk-wrap"><table class="gtab f1t f1cl"><thead><tr><th class="r">${T('Round')}</th><th>${T('Grand prix')}</th><th class="f1hm">${T('Circuit')}</th><th>${T('Race (your time)')}</th><th>${T('Winner')}</th><th class="f1hm">${T('Pole')}</th></tr></thead><tbody>${rs.map(r => {
      const res = F.d.results[r.r], w = res && res.find(x => x.pos === 1), q = F.d.quali[r.r], st0 = status(r);
      return `<tr class="s-${st0}"><td class="r"><b>${r.r}</b></td><td><a href="#/f1/race/${r.r}"><b>${esc(short(r))}</b></a>${r.sprint ? ` <span class="f1spr">${T('Sprint')}</span>` : ''}<small>${esc(r.city || '')}, ${esc(r.country || '')}</small></td><td class="f1hm">${esc(r.circuit)}</td><td>${esc(fmt(r.start, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</td><td>${w ? `${sw(w.t)}${dlink(w.d)}` : st0 === 'live' ? `<span class="f1chip sm">${T('This weekend')}</span>` : ''}</td><td class="f1hm">${q && q[0] ? esc(df(q[0].d)) : ''}</td></tr>`;
    }).join('')}</tbody></table></div>`, T('Calendar'));
}
const rad = d => d * Math.PI / 180;
function hav(a, b) { const R = 6371e3, p1 = rad(a.lat), p2 = rad(b.lat), dp = rad(b.lat - a.lat), dl = rad(b.lon - a.lon); const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
function travel(rs) { let m = 0; for (let i = 1; i < rs.length; i++) if (rs[i].lat != null && rs[i - 1].lat != null) m += hav(rs[i - 1], rs[i]); return m; }
function continents(rs) { const c = new Set(rs.map(r => r.lon < -30 ? 'am' : r.lat < -10 && r.lon > 100 ? 'oc' : r.lon > 60 ? 'as' : r.lon > 40 || (r.lat < 32 && r.lon > 25) ? 'as' : 'eu')); return c.size; }
function eqe(lon, lat) { // the Equal Earth projection, the same one f1/world.json was drawn in
  const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
  const l = rad(lon), th = Math.asin(M * Math.sin(rad(lat))), t2 = th * th, t6 = t2 ** 3;
  const x = 2 * Math.sqrt(3) * l * Math.cos(th) / (3 * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), y = th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  const xm = 2.7066297319215575, ym = 1.3173627591574133, S = 1000 / (2 * xm);
  return [(x + xm) * S, (ym - y) * S];
}
function mapSVG(world, rs) {
  const pts = rs.filter(r => r.lat != null).map(r => ({ r, p: eqe(r.lon, r.lat), s: status(r) }));
  const top = eqe(0, 66)[1], bot = eqe(0, -48)[1], nx = nextRace();
  const placed = []; // a label that would sit on another goes below its dot
  for (const q of pts) { q.below = placed.some(o => Math.hypot(o[0] - q.p[0], o[1] - q.p[1]) < 16); placed.push(q.p); }
  let path = '';
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1].p, [x1, y1] = pts[i].p, mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dd = Math.hypot(x1 - x0, y1 - y0);
    path += `<path d="M${x0.toFixed(1)},${y0.toFixed(1)} Q${mx.toFixed(1)},${Math.max(top + 4, my - dd * 0.12).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}" class="leg${pts[i].s === 'done' ? ' done' : ''}"/>`;
  }
  const dots = pts.map(({ r, p, s, below }) => `<a href="#/f1/race/${r.r}"><g class="mst s-${s}${r === nx ? ' nx' : ''}" transform="translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})"><circle r="${r === nx ? 7 : 5}"/><text y="${below ? 17 : -10}" text-anchor="middle">${r.r}</text><title>${esc(T('Round {n}', { n: r.r }) + ': ' + r.name + ', ' + weekend(r))}</title></g></a>`).join('');
  return `<figure class="f1map"><svg viewBox="0 ${top.toFixed(0)} 1000 ${(bot - top).toFixed(0)}" role="img" aria-label="${esc(T('The season’s route on a world map'))}"><path d="${world.d}" class="land"/>${path}${dots}</svg>
    <figcaption><span><i class="d done"></i>${T('Raced')}</span><span><i class="d nx"></i>${T('Next')}</span><span><i class="d up"></i>${T('To come')}</span></figcaption></figure>`;
}

/* ---------- standings ---------- */
function renderStandings() {
  const pr = F.d.progress || {}, st = F.d.standings || {}, labels = (pr.rounds || []).map(n => F.byR[n] ? short(F.byR[n]) : String(n));
  const top = (st.drivers || []).slice(0, 8).map(x => x.d), tops = (st.teams || []).slice(0, 6).map(x => x.t);
  const ser = Object.entries(pr.d || {}).map(([id, v]) => ({ id, label: df(id), color: tc(dteam(id)), dash: F.second.has(id), v, hi: top.includes(id) }));
  const tser = Object.entries(pr.t || {}).map(([id, v]) => ({ id, label: tn(id), color: tc(id), v, hi: tops.includes(id) }));
  const after = st.after && F.byR[st.after];
  shell('standings', `<div class="page-h"><h1>${T('Standings')}</h1><p>${after ? T('After round {n}, {gp}.', { n: st.after, gp: esc(after.name) }) : ''} ${T('A win is worth 25 points, a sprint win 8.')}</p></div>
    <section class="blk"><h2 class="sec-h">${T('Drivers')}</h2>${lineChart(ser, labels, { aria: T('Points after each round, the top eight drivers in their team colours') })}<div class="f1tw">${standingsTable('drivers')}</div></section>
    <section class="blk"><h2 class="sec-h">${T('Constructors')}</h2>${lineChart(tser, labels, { aria: T('Points after each round, by team') })}<div class="f1tw">${standingsTable('teams')}</div></section>
    <section class="blk"><h2 class="sec-h">${T('Points, round by round')}</h2><p class="sub2">${T('What each driver scored at each race weekend, sprint included. Darker is more.')}</p>${heat()}</section>`, T('Standings'));
}
function heat() {
  const rounds = (F.d.progress || {}).rounds || [], st = (F.d.standings || {}).drivers || [];
  const got = (id, r) => [...(F.d.results[r] || []), ...(F.d.sprints[r] || [])].filter(x => x.d === id).reduce((a, x) => a + (x.pts || 0), 0);
  return `<div class="stk-wrap"><table class="f1heat"><thead><tr><th></th>${rounds.map(r => `<th title="${esc(F.byR[r] ? F.byR[r].name : '')}"><a href="#/f1/race/${r}">${esc(F.byR[r] ? rcode(F.byR[r]) : r)}</a></th>`).join('')}<th class="r">${T('Pts')}</th></tr></thead>
    <tbody>${st.map(x => `<tr><th><a href="#/f1/driver/${esc(x.d)}">${sw(dteam(x.d))}${esc(dc(x.d))}</a></th>${rounds.map(r => { const v = got(x.d, r), raced = (F.d.results[r] || []).some(y => y.d === x.d); return `<td style="--a:${(Math.min(1, v / 33)).toFixed(2)}"${v ? '' : ' class="z"'} title="${esc(dn(x.d))}, ${esc(F.byR[r] ? short(F.byR[r]) : '')}: ${nf(v)}">${raced ? (v ? nf(v) : '·') : ''}</td>`; }).join('')}<td class="r"><b>${nf(x.pts)}</b></td></tr>`).join('')}</tbody></table></div>`;
}

/* ---------- drivers ---------- */
function seasonStats(id) {
  const rs = Object.entries(F.d.results).map(([r, xs]) => [+r, xs.find(x => x.d === id)]).filter(x => x[1]);
  const qs = Object.entries(F.d.quali).map(([r, xs]) => [+r, xs.find(x => x.d === id)]).filter(x => x[1]);
  const fin = rs.filter(([, x]) => !retired(x)).map(([, x]) => x.pos);
  const sp = Object.values(F.d.sprints).map(xs => xs.find(x => x.d === id)).filter(Boolean);
  return { starts: rs.length, wins: rs.filter(([, x]) => x.pos === 1).length, pods: rs.filter(([, x]) => x.pos <= 3).length, poles: qs.filter(([, x]) => x.pos === 1).length,
    dnf: rs.filter(([, x]) => retired(x)).length, best: fin.length ? Math.min(...fin) : null, avg: fin.length ? fin.reduce((a, b) => a + b, 0) / fin.length : null,
    avgQ: qs.length ? qs.reduce((a, [, x]) => a + x.pos, 0) / qs.length : null, fl: rs.filter(([, x]) => x.fl && x.fl.rank === 1).length, spw: sp.filter(x => x.pos === 1).length,
    pts: ((F.d.standings || {}).drivers || []).find(x => x.d === id) || {}, rs, qs };
}
function renderDrivers() {
  const ids = F.racers;
  shell('drivers', `<div class="page-h"><h1>${T('The drivers')}</h1><p>${T('{n} drivers have started a race this season. In championship order.', { n: ids.length })}</p></div>
    <div class="f1dg">${ids.map(id => { const s = seasonStats(id), w = F.Dw[id] || {}; return `<a class="f1dcard" href="#/f1/driver/${esc(id)}" style="--tc:${tc(dteam(id))}"><span class="no">${D(id).num || ''}</span>${face(id, 'xl')}<span class="nm"><small>${esc(D(id).g || '')}</small>${esc(D(id).f || id)}</span><span class="tm">${sw(dteam(id))}${esc(tn(dteam(id)))}</span>
      <span class="stat"><span><b>${s.pts.pos ? ord(s.pts.pos) : '–'}</b>${T('in the title race')}</span><span><b>${nf(s.pts.pts || 0)}</b>${T('pts|f1')}</span><span><b>${s.wins}</b>${T('wins')}</span><span><b>${s.pods}</b>${T('podiums')}</span></span>${w.titles ? `<span class="ti">${T(w.titles === 1 ? '{n} world title' : '{n} world titles', { n: w.titles })}</span>` : ''}</a>`; }).join('')}</div>
    ${F.w.drivers && F.w.drivers.market ? `<section class="blk"><h2 class="sec-h">${T('The driver market')}</h2><div class="f1rep"${enAttr()}>${mdx(F.w.drivers.market.text, F.w.drivers.market.sources)}</div>${srcs(F.w.drivers.market.sources)}</section>` : ''}
    <section class="blk" id="f1po" hidden><div class="blk-h"><h2 class="sec-h">${T('Off track')}</h2><a class="more" href="#/plusone/f1">Plus One →</a></div><p class="sub2">${T('The drivers whose partners are public figures in their own right, from Plus One, where the Sports, Lifestyle and Culture desks meet.')}</p><div class="f1po"></div></section>
    ${reserves()}`, T('Drivers'));
  offTrack(null);
}
async function offTrack(id) { // Plus One's F1 couples, on the drivers page and on a driver's own page
  if (!W.loadPlus) return;
  let m; try { await W.loadPlus(); m = await window.PLUS.f1(); } catch (e) { return; }
  const box = document.getElementById('f1po'); if (!box || !m) return;
  const ids = id ? (m[id] ? [id] : []) : F.racers.filter(d => m[d]);
  if (!ids.length) return;
  box.querySelector('.f1po').innerHTML = ids.map(d => { const c = m[d]; return `<a class="po-card" href="#/plusone/${esc(c.id)}">${c.mark}<span class="po-k">${esc(tn(dteam(d)))}</span><span class="po-n"${enAttr()}>${esc(dn(d))} <i>&amp;</i> ${esc(c.partner)}</span><span class="po-kf"${enAttr()}>${esc(c.known_for)}</span>${id ? `<span class="po-kf"${enAttr()}>${esc(c.first)}</span>` : ''}</a>`; }).join('');
  box.hidden = false;
}
function reserves() {
  const w = F.w.drivers && F.w.drivers.reserves;
  if (w && w.length) {
    const tid = name => F.teams.find(t => tn(t) === name || (F.T[t] || {}).name === name || (F.d.teams[t] || {}).short === name);
    return `<section class="blk"><h2 class="sec-h">${T('Reserve and test drivers')}</h2><dl class="gspec f1res"${enAttr()}>${w.map(r => `<div><dt>${tid(r.team) ? sw(tid(r.team)) : ''}${esc(r.team)}</dt><dd>${r.names.map(esc).join('<br>')}</dd></div>`).join('')}</dl></section>`;
  }
  const rs = Object.entries(F.d.drivers).filter(([, x]) => x.reserve).map(([id]) => id);
  return rs.length ? `<p class="note">${T('Also on the season’s entry list, for practice outings')}: ${rs.map(id => esc(dn(id))).join(', ')}.</p>` : '';
}
async function renderDriver(id) {
  if (!F.d.drivers[id]) return shell('drivers', `<div class="state"><h2>${T('That driver isn’t here')}</h2><p><a href="#/f1/drivers">${T('All the drivers')}</a></p></div>`);
  const x = D(id), w = F.Dw[id] || {}, s = seasonStats(id), t = x.team, car = (F.d.career || {})[id], mate = (F.now[t] || []).find(o => o !== id) || F.racers.find(o => o !== id && dteam(o) === t);
  const pr = (F.d.progress || {}), labels = (pr.rounds || []).map(n => F.byR[n] ? short(F.byR[n]) : String(n));
  const ser = [id, mate].filter(o => o && pr.d && pr.d[o]).map(o => ({ id: o, label: df(o), color: tc(dteam(o)), dash: o !== id, v: pr.d[o], hi: true }));
  const n = w.sources || [];
  shell('drivers', `<article class="f1drv" style="--tc:${tc(t)}">
    <p class="crumb"><a href="#/f1/drivers">${T('Drivers')}</a> · ${tlink(t)}</p>
    <header class="f1dh"><span class="no">${x.num || ''}</span>${face(id, 'xl')}<div><h1><small>${esc(x.g || '')}</small> ${esc(x.f || id)}</h1>
      <p class="d">${sw(t)}${tlink(t)} · ${esc(x.nat || '')}${x.dob ? ' · ' + T('{n} years old', { n: age(x.dob) }) : ''}${w.born ? ' · ' + T('born in {p}', { p: esc(w.born) }) : ''}</p>
      ${w.contract ? `<p class="note"${enAttr()}>${T('Contract')}: ${plain(w.contract)}</p>` : ''}</div></header>
    <div class="f1tiles">${tile(s.pts.pos ? ord(s.pts.pos) : '–', T('in the championship'))}${tile(nf(s.pts.pts || 0), T('points'))}${tile(s.wins, T('wins'))}${tile(s.pods, T('podiums'))}${tile(s.poles, T('poles'))}${tile(s.best ? ord(s.best) : '–', T('best finish'))}${tile(s.avg ? nf(s.avg, 1) : '–', T('average finish'))}${tile(s.avgQ ? nf(s.avgQ, 1) : '–', T('average qualifying'))}${tile(s.dnf, T('retirements'))}${s.spw ? tile(s.spw, T('sprint wins')) : ''}</div>
    <section class="blk"><h2 class="sec-h">${T('Race by race')}</h2>${strip(id)}</section>
    ${mate ? h2h(id, mate) : ''}
    ${ser.length ? `<section class="blk"><h2 class="sec-h">${T('Points through the season')}</h2>${lineChart(ser, labels, { h: 280, aria: T('{a}’s points after each round, against his teammate', { a: df(id) }) })}</section>` : ''}
    <section class="blk f1g2"><div${enAttr()}>${w.season ? `<h2 class="sec-h">${T('The season so far')}</h2><div class="f1rep">${mdx(w.season, n)}</div>` : ''}${w.bio ? `<h2 class="sec-h">${T('The story')}</h2><div class="f1rep">${mdx(w.bio, n)}</div>` : ''}${w.next ? `<h3 class="glb">${T('Next year')}</h3><p>${mdx(w.next, n)}</p>` : ''}${srcs(n)}</div>
      <div>${car ? `<h2 class="sec-h">${T('Career')}</h2><dl class="gspec f1car2">${[[T('Starts'), car.starts], [T('Wins'), car.wins], [T('Podiums'), car.podiums], [T('Poles'), car.poles], [T('Fastest laps'), car.fl], [T('Seasons'), car.seasons], [T('World titles'), w.titles ?? '–'], [T('Debut'), w.debut ? esc(w.debut) : '–']].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl><p class="note">${T('Every grand prix since their first, this season included.')}</p>` : ''}
      ${newsFor({ rx: new RegExp('\\b' + (x.f || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i') }).length ? `<h3 class="glb">${T('In the news')}</h3>${newsList(newsFor({ rx: new RegExp('\\b' + (x.f || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i') }), 6)}` : ''}</div></section>
    <section class="blk" id="f1po" hidden><div class="blk-h"><h2 class="sec-h">${T('Off track')}</h2><a class="more" href="#/plusone/f1">Plus One →</a></div><div class="f1po"></div></section>
  </article>`, dn(id));
  offTrack(id);
}
const tile = (v, l) => `<div class="f1tile"><b>${v}</b><span>${l}</span></div>`;
function strip(id) {
  return `<div class="f1strip">${F.R.map(r => {
    const x = (F.d.results[r.r] || []).find(y => y.d === id), q = (F.d.quali[r.r] || []).find(y => y.d === id), sp = (F.d.sprints[r.r] || []).find(y => y.d === id);
    const done = !!F.d.results[r.r], cls = !done ? 'fut' : !x ? 'na' : retired(x) ? 'dnf' : x.pos === 1 ? 'w' : x.pos <= 3 ? 'pod' : x.pts ? 'pts' : 'no';
    return `<a class="${cls}" href="#/f1/race/${r.r}" title="${esc(r.name)}${x ? ': ' + esc(retired(x) ? T(x.st) : ord(x.pos)) : ''}${q ? ' · ' + T('qualified {p}', { p: ord(q.pos) }) : ''}${sp ? ' · ' + T('sprint {p}', { p: ord(sp.pos) }) : ''}"><span class="r">${esc(rcode(r))}</span><b>${!done ? '' : !x ? '–' : retired(x) ? T('DNF') : x.pos}</b><small>${q ? 'Q' + q.pos : ''}${sp ? ' · S' + sp.pos : ''}</small></a>`;
  }).join('')}</div><p class="f1lg"><span><i class="w"></i>${T('Win')}</span><span><i class="pod"></i>${T('Podium')}</span><span><i class="pts"></i>${T('Points')}</span><span><i class="dnf"></i>${T('Didn’t finish')}</span></p>`;
}
function h2h(a, b, both) {
  let q = [0, 0], r = [0, 0];
  for (const xs of Object.values(F.d.quali)) { const x = xs.find(y => y.d === a), y = xs.find(z => z.d === b); if (x && y) q[x.pos < y.pos ? 0 : 1]++; }
  for (const xs of Object.values(F.d.results)) { const x = xs.find(y => y.d === a), y = xs.find(z => z.d === b); if (x && y && !(retired(x) && retired(y))) r[(retired(y) || (!retired(x) && x.pos < y.pos)) ? 0 : 1]++; }
  const pa = (((F.d.standings || {}).drivers || []).find(x => x.d === a) || {}).pts || 0, pb = (((F.d.standings || {}).drivers || []).find(x => x.d === b) || {}).pts || 0;
  const bar = (l, x, y, fx) => `<div class="hh"><span class="l">${l}</span><span class="a">${fx ? fx(x) : x}</span><span class="b2"><i style="width:${pct(x, x + y)}%"></i><i style="width:${pct(y, x + y)}%"></i></span><span class="c">${fx ? fx(y) : y}</span></div>`;
  return `<section class="blk"><h2 class="sec-h">${both ? T('{a} against {b}', { a: esc(df(a)), b: esc(df(b)) }) : T('Against {who}', { who: esc(dn(b)) })}</h2><p class="sub2">${T('The only fair comparison in F1 is the driver in the same car.')}</p>
    <div class="f1h2h"><div class="hhh"><a href="#/f1/driver/${esc(a)}">${esc(df(a))}</a><a href="#/f1/driver/${esc(b)}">${esc(df(b))}</a></div>${bar(T('Ahead in qualifying'), q[0], q[1])}${bar(T('Ahead at the finish'), r[0], r[1])}${bar(T('Points'), pa, pb, v => nf(v))}</div></section>`;
}

/* ---------- the cars ---------- */
function renderCars() {
  const r = F.w.rules, sup = (r && r.suppliers) || [];
  shell('cars', `<div class="page-h"><h1>${T('The cars')}</h1><p>${T('The {y} grid: who builds what, who powers whom, and how each car is put together.', { y: F.d.season })}</p></div>
    <div class="f1cars wide">${F.teams.map(carCard).join('')}</div>
    ${sup.length ? `<section class="blk"><h2 class="sec-h">${T('Who powers whom')}</h2><div class="f1sup">${sup.map(s => `<div><h3>${esc(s.maker)}</h3><ul>${s.teams.map(t => `<li>${sw(t)}${tlink(t)}${F.T[t] && F.T[t].car && F.T[t].car.pu && F.T[t].car.pu.works ? ` <small>${T('works team')}</small>` : ''}</li>`).join('')}</ul></div>`).join('')}</div></section>` : ''}
    <section class="blk"><h2 class="sec-h">${T('Side by side')}</h2><div class="stk-wrap"><table class="gtab f1t f1cmp"><thead><tr><th>${T('Team')}</th><th>${T('Car')}</th><th>${T('Power unit')}</th><th class="f1hm">${T('Front')}</th><th class="f1hm">${T('Rear')}</th><th class="f1hm">${T('Launched')}</th><th class="r">${T('Upgrades')}</th><th class="r">${T('Best')}</th><th class="r">${T('Pts')}</th></tr></thead>
      <tbody>${F.teams.map(t => { const w = F.T[t] || {}, c = w.car || {}, st = ((F.d.standings || {}).teams || []).find(x => x.t === t) || {}, best = bestFinish(t); return `<tr><td>${sw(t)}${tlink(t)}</td><td><b>${esc(c.name || '')}</b></td><td>${c.pu ? esc(c.pu.maker) : ''}</td><td class="f1hm">${esc(c.front || '')}</td><td class="f1hm">${esc(c.rear || '')}</td><td class="f1hm">${c.launch ? esc(dayOnly(c.launch + 'T12:00:00Z', 'UTC')) : ''}</td><td class="r">${(w.upgrades || []).length || ''}</td><td class="r">${best ? ord(best) : '–'}</td><td class="r"><b>${nf(st.pts || 0)}</b></td></tr>`; }).join('')}</tbody></table></div></section>
    <p class="note f1by">${written()}</p>`, T('The cars'));
}
const puName = pu => !pu.name ? pu.maker : pu.name.toLowerCase().startsWith(pu.maker.toLowerCase()) || pu.name.includes(pu.maker) ? pu.name : pu.maker + ' ' + pu.name;
function bestFinish(t) { let b = null; for (const xs of Object.values(F.d.results)) for (const x of xs) if (x.t === t && !retired(x) && (b == null || x.pos < b)) b = x.pos; return b; }
async function renderCar(t) {
  if (!F.d.teams[t]) return shell('cars', `<div class="state"><h2>${T('That team isn’t here')}</h2><p><a href="#/f1/cars">${T('All the cars')}</a></p></div>`);
  const w = F.T[t] || {}, c = w.car || {}, n = w.sources || [], st = ((F.d.standings || {}).teams || []).find(x => x.t === t) || {};
  const ds = F.now[t] || [], also = drove(t), pr = F.d.progress || {}, rounds = pr.rounds || [];
  const perRound = rounds.map(r => [...(F.d.results[r] || []), ...(F.d.sprints[r] || [])].filter(x => x.t === t).reduce((a, x) => a + (x.pts || 0), 0));
  const maxR = Math.max(1, ...perRound);
  const ups = (w.upgrades || []).slice().sort((a, b) => a.r - b.r);
  shell('cars', `<article class="f1team" style="--tc:${tc(t)}">
    <p class="crumb"><a href="#/f1/cars">${T('The cars')}</a></p>
    <header class="f1th"><div><p class="k">${esc(w.full || tn(t))}</p><h1>${esc(c.name || tn(t))}</h1><p class="d">${esc(tn(t))}${w.base ? ' · ' + esc(w.base) : ''}${w.principal ? ' · ' + T('team principal {p}', { p: esc(w.principal) }) : ''}</p>
      <p class="f1fx">${st.pos ? `<span>${T('{p} in the constructors’ championship', { p: ord(st.pos) })}</span><span>${nf(st.pts)} ${T('pts|f1')}</span>` : ''}${st.wins ? `<span>${T(st.wins === 1 ? '{n} win' : '{n} wins', { n: st.wins })}</span>` : ''}${c.pu ? `<span>${esc(c.pu.maker)} ${T('power')}</span>` : ''}</p></div>${carSVG(t, 'hero')}</header>
    <dl class="gspec">${[[T('Chassis'), esc(c.name)], [T('Power unit'), c.pu ? `${esc(puName(c.pu))} <small>${c.pu.works ? T('works') : T('customer')}</small>` : ''], [T('Gearbox'), esc(c.gearbox)], [T('Front suspension'), esc(c.front)], [T('Rear suspension'), esc(c.rear)], [T('Fuel and oil'), esc(c.fuel)], [T('Launched'), c.launch ? esc(dayLong(c.launch + 'T12:00:00Z', 'UTC')) : ''], ...((c.specs || []).map(x => [esc(x.k), esc(x.v), x.v.length > 90])) ].filter(x => x[1]).map(([k, v, wide]) => `<div${wide ? ' class="w2"' : ''}><dt>${k}</dt><dd${enAttr()}>${v}</dd></div>`).join('')}</dl>
    <section class="blk f1g2"><div${enAttr()}><h2 class="sec-h">${T('The idea')}</h2><div class="f1rep">${mdx(c.concept, n)}</div></div>
      <div${enAttr()}><h2 class="sec-h">${T('What to look for')}</h2><ul class="f1feat">${(c.features || []).map(f => `<li>${typeof f === 'string' ? plain(f) : `<b>${esc(f.k)}</b> ${plain(f.v)}`}</li>`).join('')}</ul></div></section>
    <section class="blk"><h2 class="sec-h">${T('The upgrades')}</h2><p class="sub2">${T('What the team has brought to the car, race by race, from the FIA’s car-presentation papers and the reporting on them.')}</p>
      ${ups.length ? `<ol class="f1up"${enAttr()}>${ups.map(u => `<li><a class="ur" href="#/f1/race/${u.r}">${T('Round {n}', { n: u.r })}<b>${F.byR[u.r] ? esc(short(F.byR[u.r])) : ''}</b></a><div><p class="ui">${esc(u.items)}</p>${u.aim ? `<p><span class="lab">${T('Aim')}</span> ${esc(u.aim)}</p>` : ''}${u.verdict ? `<p><span class="lab">${T('Verdict')}</span> ${esc(u.verdict)}</p>` : ''}${(u.src || []).map(k => n[k - 1] ? `<sup class="cite"><a href="${esc(n[k - 1].u)}" target="_blank" rel="noopener" title="${esc(n[k - 1].o)}">${k}</a></sup>` : '').join('')}</div></li>`).join('')}</ol>` : `<p class="note">${T('No upgrades logged yet.')}</p>`}</section>
    <section class="blk f1g2"><div${enAttr()}><h2 class="sec-h">${T('The season')}</h2><div class="f1rep">${mdx(w.season, n)}</div>
      ${(w.strengths || []).length || (w.weaknesses || []).length ? `<div class="f1sw2"><div><h3 class="glb">${T('Strong at')}</h3><ul>${(w.strengths || []).map(x => `<li>${plain(x)}</li>`).join('')}</ul></div><div><h3 class="glb">${T('Weak at')}</h3><ul>${(w.weaknesses || []).map(x => `<li>${plain(x)}</li>`).join('')}</ul></div></div>` : ''}
      ${w.reliability ? `<p><b>${T('Reliability')}:</b> ${plain(w.reliability)}</p>` : ''}${w.next ? `<h3 class="glb">${T('Next year')}</h3><p>${mdx(w.next, n)}</p>` : ''}</div>
      <div><h2 class="sec-h">${T('Points by round')}</h2><div class="f1pr">${rounds.map((r, i) => `<a href="#/f1/race/${r}" title="${esc(F.byR[r] ? F.byR[r].name : r)}: ${nf(perRound[i])}"><i style="height:${(perRound[i] / maxR * 100).toFixed(1)}%"></i><span>${esc(F.byR[r] ? rcode(F.byR[r]) : r)}</span></a>`).join('')}</div>
        <h3 class="glb">${T('Drivers')}</h3><div class="f1dm">${ds.map(id => `<a href="#/f1/driver/${esc(id)}" style="--tc:${tc(t)}">${face(id)}<span><b>${esc(dn(id))}</b><small>${nf((((F.d.standings || {}).drivers || []).find(x => x.d === id) || {}).pts || 0)} ${T('pts|f1')}</small></span></a>`).join('')}</div>
        ${also.length ? `<p class="note">${T('Also raced for the team this season')}: ${also.map(id => `<a href="#/f1/driver/${esc(id)}">${esc(dn(id))}</a>`).join(', ')}</p>` : ''}
        ${ds.length === 2 ? h2h(ds[0], ds[1], true).replace('<section class="blk">', '<section>') : ''}
        ${(w.people || []).length ? `<h3 class="glb">${T('The people')}</h3><dl class="f1ppl">${w.people.map(p => `<div><dt>${esc(p.role)}</dt><dd>${esc(p.name)}</dd></div>`).join('')}</dl>` : ''}
        ${w.history ? `<h3 class="glb">${T('History')}</h3><p class="note">${[w.history.first ? T('First season {y}', { y: w.history.first }) : '', w.history.titles != null ? T('{n} constructors’ titles', { n: w.history.titles }) : '', w.history.driver_titles != null ? T('{n} drivers’ titles', { n: w.history.driver_titles }) : '', w.y2025 ? T('Last year: {p}, {n} points', { p: ord(w.y2025.pos), n: nf(w.y2025.pts) }) : ''].filter(Boolean).join(' · ')}</p>` : ''}
        ${(w.reserves || []).length ? `<p class="note">${T('Reserve and test drivers')}: ${w.reserves.map(esc).join(', ')}</p>` : ''}</div></section>
    ${srcs(n)}
    <p class="note f1by">${written()}</p></article>`, (c.name ? c.name + ' · ' : '') + tn(t));
}

/* ---------- the rules ---------- */
function renderRules() {
  const r = F.w.rules;
  if (!r) return shell('rules', `<div class="state"><h2>${T('The rules guide is being written')}</h2></div>`, T('Rules'));
  const ns = r.changes_sources || [];
  shell('rules', `<div class="page-h"><h1>${T('The {y} rules', { y: F.d.season })}</h1></div><div class="f1lede"${enAttr()}>${mdx(r.intro, [])}</div>
    ${aeroDiagram()}
    <div class="f1rules"${enAttr()}>${(r.areas || []).map(a => `<section class="blk" id="r-${esc(a.id)}"><h2 class="sec-h">${esc(a.title)}</h2><div class="f1g2"><div class="f1rep">${mdx(a.body, a.sources)}</div>${(a.numbers || []).length ? `<dl class="gspec f1num">${a.numbers.map(x => `<div><dt>${esc(x.k)}</dt><dd>${esc(x.v)}</dd></div>`).join('')}</dl>` : '<div></div>'}</div>${srcs(a.sources)}</section>`).join('')}</div>
    ${(r.changes || []).length ? `<section class="blk"><h2 class="sec-h">${T('Changed during the season')}</h2><ol class="f1up"${enAttr()}>${r.changes.map(c => `<li><span class="ur"><b>${esc(c.when)}</b></span><div><p>${esc(c.what)}${(c.src || []).map(k => ns[k - 1] ? `<sup class="cite"><a href="${esc(ns[k - 1].u)}" target="_blank" rel="noopener">${k}</a></sup>` : '').join('')}</p></div></li>`).join('')}</ol></section>` : ''}
    <p class="note f1by">${written()}</p>`, T('Rules'));
}
function aeroDiagram() { // the two wing settings, drawn from the side
  const wing = (x, open) => `<g transform="translate(${x} 0)"><path d="M10 120 C60 104 150 100 250 104 L258 120Z" class="body"/><circle cx="62" cy="124" r="16" class="tyre"/><circle cx="214" cy="124" r="16" class="tyre"/>
    <g transform="translate(232 70)"><rect x="0" y="0" width="5" height="36" class="pylon"/><path d="M-6 0 L34 0" class="el main"/><path d="${open ? 'M-2 -12 L34 -9' : 'M-4 -10 L30 -20'}" class="el flap"/></g>
    <g transform="translate(2 112)"><path d="M0 0 L36 0" class="el main"/><path d="${open ? 'M4 -6 L36 -4' : 'M2 -6 L30 -14'}" class="el flap"/></g>
    ${open ? '<path d="M300 92 h-40 M300 104 h-40 M300 116 h-40" class="flow"/>' : '<path d="M300 88 c-30 0 -40 -20 -60 -26 M300 104 h-40" class="flow"/>'}</g>`;
  return `<figure class="f1aero"><svg viewBox="0 0 660 160" role="img" aria-label="${esc(T('The movable wings: closed for corners, opened on the straights'))}">${wing(0, false)}${wing(340, true)}
    <text x="130" y="22" text-anchor="middle" class="cap">${T('Corners: wings closed, more downforce')}</text><text x="470" y="22" text-anchor="middle" class="cap">${T('Straights: wings opened, less drag')}</text></svg>
    <figcaption>${T('A sketch, not to scale. Since 2026 every driver flattens the front and rear wing flaps in the marked Straight Mode zones; being within a second of the car ahead now earns extra battery energy instead (Overtake Mode).')}</figcaption></figure>`;
}

/* ---------- news ---------- */
function renderNews(sel) {
  const r = sel && F.byR[+sel] ? +sel : null;
  const xs = newsFor(r ? { r } : null);
  const rounds = [...new Set((F.d.news || []).filter(x => x.r).map(x => x.r))].sort((a, b) => b - a).slice(0, 8);
  const vids = (F.d.videos || []).filter(v => !r || v.r === r);
  shell('news', `<div class="page-h"><h1>${T('F1 news')}</h1><p>${T('From the F1 press: each outlet’s own headline, linked. Updated through race weekends.')}</p></div>
    <div class="tags" role="group" aria-label="${T('Filter by race')}"><a class="chip" href="#/f1/news"${!r ? ' aria-pressed="true"' : ''}>${T('All')}</a>${rounds.map(n => `<a class="chip" href="#/f1/news/${n}"${r === n ? ' aria-pressed="true"' : ''}>${esc(short(F.byR[n]))}</a>`).join('')}</div>
    <section class="blk two"><div>${newsList(xs, 60)}</div><div>${vids.length ? `<h2 class="sec-h">${T('Video')}</h2><div class="f1vg">${vids.slice(0, 12).map(vidCard).join('')}</div>` : ''}</div></section>`, T('F1 news'));
}

/* ================= interaction ================= */
function bind() {
  bindCharts();
  for (const b of document.querySelectorAll('.f1tabs [data-tab]')) b.onclick = () => {
    const box = b.closest('section');
    for (const x of box.querySelectorAll('.f1tabs [data-tab]')) x.setAttribute('aria-selected', String(x === b));
    for (const p of box.querySelectorAll('[data-pane]')) p.hidden = p.dataset.pane !== b.dataset.tab;
    bindCharts();
  };
  const lap = document.querySelector('[data-lap]');
  if (lap) {
    let on = null;
    const set = id => {
      on = on === id ? null : id;
      lap.classList.toggle('focus', !!on);
      for (const el of lap.querySelectorAll('[data-s]')) el.classList.toggle('on', el.dataset.s === on);
      for (const c of document.querySelectorAll('.f1keys [data-hl]')) c.setAttribute('aria-pressed', String(c.dataset.hl === on));
    };
    for (const c of document.querySelectorAll('.f1keys [data-hl]')) c.onclick = () => set(c.dataset.hl);
    lap.addEventListener('click', ev => { const s = ev.target.closest('[data-s]'); if (s) set(s.dataset.s); });
  }
}

/* ================= the look ================= */
const CSS = `
.f1{--f1mute:color-mix(in srgb,var(--ink-3) 38%,transparent);padding-bottom:40px}
.f1nav{display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:none;margin:18px 0 22px;padding:4px;border:1px solid var(--rule);border-radius:999px;background:var(--raise)}
.f1nav::-webkit-scrollbar{display:none}
.f1nav a{flex:none;text-decoration:none;font:600 14px var(--sans);color:var(--ink-2);padding:7px 13px;border-radius:999px}
.f1nav a:hover{color:var(--ink)}.f1nav a[aria-current]{background:var(--ink);color:var(--paper)}
.f1nav .f1brand{color:var(--ink);font:700 14px var(--sans);letter-spacing:.02em;padding-right:10px;margin-right:2px;border-right:1px solid var(--rule);border-radius:999px 0 0 999px}
.f1nav .f1po-l{margin-left:auto;color:var(--brass-ink)}.f1nav .f1po-l span{font:700 10.5px var(--sans);letter-spacing:.06em;text-transform:uppercase;margin-left:4px;opacity:.75}
.f1nav .f1brand span{display:inline-block;background:var(--signal);color:#fff;border-radius:4px;padding:0 5px;margin-right:6px;font-style:italic}
.f1sw{display:inline-block;width:4px;height:15px;border-radius:2px;background:var(--tc);margin-right:8px;vertical-align:-2px}
.f1face{position:relative;display:inline-grid;place-items:center;width:44px;height:44px;border-radius:50%;background:color-mix(in srgb,var(--tc) 22%,var(--raise));overflow:hidden;flex:none;box-shadow:inset 0 0 0 2px var(--tc)}
.f1face img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top}.f1face b{font:700 12px var(--sans);color:var(--ink)}.f1face img+b{display:none}
.f1face.sm{width:34px;height:34px}.f1face.xl{width:96px;height:96px}.f1face.xl b{font-size:22px}
.f1hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:28px;background:#0E1A2B;color:#EEF1F4;border-radius:18px;padding:30px 32px;position:relative;overflow:hidden}
.f1hero::after{content:"";position:absolute;right:-90px;bottom:-120px;width:320px;height:320px;border-radius:50%;border:34px solid rgba(214,178,94,.10);pointer-events:none}
.f1hero .k{font:700 12.5px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:#D6B25E;margin:0 0 10px}
.f1hero h1{font:400 54px/1 var(--serif);margin:0 0 10px;letter-spacing:-.01em}.f1hero h1 a{color:inherit;text-decoration:none}.f1hero h1 a:hover{text-decoration:underline;text-underline-offset:5px;text-decoration-thickness:2px}
.f1hero .d{color:#B9C3CF;margin:0 0 18px;font-size:15.5px}
.f1hero .cd{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:18px;min-height:64px}
.f1hero .cd .lbl{flex:1 1 100%;font:600 13px var(--sans);color:#B9C3CF}
.f1hero .cd .u{display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:8px 12px 6px;min-width:66px}
.f1hero .cd .u b{font:500 34px/1 var(--sans);font-variant-numeric:tabular-nums;letter-spacing:-.02em}.f1hero .cd .u small{font:600 11px var(--sans);text-transform:uppercase;letter-spacing:.06em;color:#9FB0C2;margin-top:3px}
.f1hero .cd .on{font:700 18px var(--sans);color:#F08B78}
.f1hero .f1ss{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.f1hero .f1ss li{border-top:1px solid rgba(255,255,255,.14);padding:8px 0 0;display:flex;flex-direction:column;font-size:14px}
.f1hero .f1ss li b{font-weight:600}.f1hero .f1ss li span{color:#DDE4EC}.f1hero .f1ss li small{color:#8FA0B3;font-size:12px}
.f1hero .f1ss li.past{opacity:.45}.f1hero .f1ss li.nx b{color:#D6B25E}
.f1hero .tz{margin:16px 0 0;font-size:13.5px;color:#9FB0C2}.f1hero .tz a{color:#D6B25E;font-weight:600;text-decoration:none;margin-left:8px}
.f1hero .f1side{display:flex;flex-direction:column;justify-content:center;gap:14px;position:relative;z-index:1}
.f1hero .f1trk{max-height:290px}.f1hero .f1trk .tb{stroke:rgba(255,255,255,.10)}.f1hero .f1trk .tl{stroke:#D6B25E}.f1hero .f1trk .cn circle{fill:#0E1A2B;stroke:rgba(214,178,94,.6)}.f1hero .f1trk .cn text{fill:#EEF1F4}.f1hero .f1trk .sf{fill:#fff}
.f1hero dl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0}.f1hero dl div{border-left:2px solid rgba(214,178,94,.5);padding-left:10px}
.f1hero dt{font:600 11.5px var(--sans);text-transform:uppercase;letter-spacing:.06em;color:#9FB0C2}.f1hero dd{margin:2px 0 0;font:600 16px var(--sans);font-variant-numeric:tabular-nums}
.f1hero.over{grid-template-columns:1fr auto}
.f1lede{font:400 22px/1.42 var(--serif);max-width:68ch;margin:26px 0 0;color:var(--ink)}.f1lede p{margin:0 0 .6em}
.f1title{max-width:72ch;font-size:16px;line-height:1.6;margin:0 0 12px}.f1title p{margin:0 0 .7em}
.f1rep{font:400 17.5px/1.62 Georgia,'Iowan Old Style',serif}.f1rep p{margin:0 0 .85em}.f1rep ul{padding-left:1.2em}
.f1tabs{display:inline-flex;border:1px solid var(--rule);border-radius:999px;padding:3px;background:var(--raise);margin:4px 0 10px}
.f1tabs button{border:0;background:none;border-radius:999px;padding:5px 14px;font:600 14px var(--sans);color:var(--ink-2)}.f1tabs button[aria-selected="true"]{background:var(--ink);color:var(--paper)}
.f1chart{position:relative;margin:4px 0 6px}.f1chart svg{width:100%;height:auto;display:block;touch-action:pan-y}
.f1chart .gl,.f1lap .gl,.f1st .gl{stroke:var(--rule);stroke-width:1}.f1 .ax{font:500 11.5px var(--sans);fill:var(--ink-3)}
.f1chart .ln{fill:none;stroke:var(--c);stroke-width:1.4;stroke-linejoin:round;stroke-linecap:round}.f1chart .ln.hi{stroke-width:2.4}
.f1chart .dl{font:600 12.5px var(--sans);fill:var(--ink)}.f1chart .dl .v{fill:var(--ink-2);font-weight:500;font-variant-numeric:tabular-nums}
.f1chart .xh{stroke:var(--ink-3);stroke-width:1}
.f1tip{position:absolute;top:8px;z-index:3;min-width:170px;background:var(--raise);border:1px solid var(--rule);border-radius:10px;box-shadow:0 10px 30px rgba(14,26,43,.18);padding:9px 11px;font:500 13px var(--sans);pointer-events:none}
.f1tip b{display:block;margin-bottom:4px}.f1tip span{display:flex;align-items:center;gap:7px;padding:1px 0}.f1tip i{width:9px;height:9px;border-radius:2px;flex:none}.f1tip em{margin-left:auto;font-style:normal;font-variant-numeric:tabular-nums;color:var(--ink-2);padding-left:12px}
.f1two{margin-top:22px}
.f1t td,.f1t th{white-space:nowrap}.f1t td small{display:block;color:var(--ink-3);font-size:12.5px}.f1t a{color:var(--ink);text-decoration:none;font-weight:600}.f1t a:hover{text-decoration:underline;text-underline-offset:3px}
.f1t tr.dnf td{color:var(--ink-3)}.f1t .up{color:var(--up)}.f1t .dn{color:var(--dn)}
.f1t tbody tr:hover td{background:color-mix(in srgb,var(--shoal) 45%,transparent)}
.f1s .bar{width:30%}.f1s .bar span{display:block;height:8px;border-radius:0 4px 4px 0;min-width:2px}
.f1fl{font:700 10.5px var(--sans);text-transform:uppercase;letter-spacing:.05em;color:#7B3FB5;background:color-mix(in srgb,#7B3FB5 14%,transparent);border-radius:4px;padding:1px 5px;margin-left:4px}
@media (prefers-color-scheme:dark){:root:not([data-theme="day"]) .f1fl{color:#C9A2F0}}:root[data-theme="night"] .f1fl{color:#C9A2F0}
.f1more{font:600 14.5px var(--sans);color:var(--ink);text-decoration:none}.f1more:hover{text-decoration:underline;text-underline-offset:3px}
.f1lastg,.f1rr{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:30px;margin-top:14px}
.f1pod{list-style:none;margin:0 0 6px;padding:0}.f1pod li{display:grid;grid-template-columns:30px auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--rule)}
.f1pod .pp{font:400 34px/1 var(--serif);color:var(--ink-3)}.f1pod .p1 .pp{color:var(--brass-ink)}.f1pod .pn a{display:block;font:600 17px var(--sans);color:var(--ink);text-decoration:none}.f1pod .pn small{color:var(--ink-2);font-size:13.5px}
.f1pod .pt{font:500 14px var(--sans);font-variant-numeric:tabular-nums;color:var(--ink-2)}
.f1h3{font:400 29px/1.15 var(--serif);margin:22px 0 10px}
.f1facts{margin-top:14px}.f1facts dd a{color:var(--ink);font-weight:600;text-decoration:none}.f1facts dd small{color:var(--ink-3);font-variant-numeric:tabular-nums}
.f1cal.row{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x proximity;padding:4px 2px 12px;scrollbar-width:thin}
.f1rc{flex:0 0 218px;scroll-snap-align:start;display:flex;flex-direction:column;gap:3px;text-decoration:none;color:var(--ink);background:var(--raise);border:1px solid var(--rule);border-radius:14px;padding:14px 14px 13px;border-top:4px solid var(--tc,var(--rule))}
.f1rc:hover{border-color:var(--ink-3)}.f1rc .rn{font:700 11.5px var(--sans);letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)}.f1rc .rn em{font-style:normal;color:var(--brass-ink)}
.f1rc .nm{font:400 25px/1.05 var(--serif)}.f1rc .dt{font-size:13px;color:var(--ink-2)}.f1rc .wn{display:flex;align-items:center;gap:9px;margin-top:8px}.f1rc .wn b{display:block;font-size:14.5px}.f1rc .wn small{color:var(--ink-3);font-size:12.5px}
.f1rc .hl{font-size:13px;line-height:1.4;color:var(--ink-2);margin-top:6px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.f1rc .up{margin-top:8px;font:600 14px var(--sans);color:var(--ink-2)}.f1rc .lv{margin-top:8px;font:700 13px var(--sans);color:var(--signal)}
.f1rc.s-upcoming{background:transparent}.f1rc.s-live{border-color:var(--signal);border-top-color:var(--signal)}
.f1cars{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.f1cc{display:flex;flex-direction:column;text-decoration:none;color:var(--ink);background:var(--raise);border:1px solid var(--rule);border-radius:14px;padding:12px 16px 14px;border-bottom:4px solid var(--tc)}
.f1cc:hover{border-color:var(--ink-3);border-bottom-color:var(--tc)}.f1cc .f1car{width:100%;height:auto;margin:0 0 6px}
.f1cc .cn{font:400 30px/1 var(--serif)}.f1cc .tm{font:600 15px var(--sans);margin-top:2px}.f1cc .pu,.f1cc .ds{font-size:13.5px;color:var(--ink-2)}.f1cc .pts{font:600 13px var(--sans);color:var(--ink-3);margin-top:6px;font-variant-numeric:tabular-nums}
.f1car .ty{fill:#1a1f27}
.f1story{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px 26px}.f1story article{border-top:2px solid var(--ink);padding-top:12px}.f1story h3{font:400 25px/1.15 var(--serif);margin:0 0 8px}.f1story p{margin:0 0 .7em;font-size:15.5px;line-height:1.58}
.f1news li{display:flex;gap:12px;align-items:flex-start}.f1news img{width:84px;height:56px;object-fit:cover;border-radius:6px;flex:none;background:var(--shoal)}.f1news .tagr{color:var(--brass-ink);text-decoration:none;font-weight:600}
.f1dm{display:grid;gap:2px}.f1dm a{display:flex;align-items:center;gap:12px;padding:7px 0;border-bottom:1px solid var(--rule);text-decoration:none;color:var(--ink)}.f1dm b{display:block;font-size:15px}.f1dm small{color:var(--ink-2);font-size:13px}
.f1watch .f1w h3{font:600 12.5px var(--sans);letter-spacing:.07em;text-transform:uppercase;color:var(--ink-2);margin:14px 0 4px}.f1watch .f1w p{margin:0 0 4px}
.f1watch details summary{cursor:pointer;font:600 14.5px var(--sans);margin-top:12px}.f1wg{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:4px 26px}
.f1tix{margin-top:16px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}.f1tix .pri,.f1btn{display:inline-block;background:var(--ink);color:var(--paper);border-radius:999px;padding:9px 18px;font:600 14.5px var(--sans);text-decoration:none}
.f1foot{margin:46px 0 0;padding-top:14px;border-top:1px solid var(--rule);font-size:13px;color:var(--ink-3)}.f1foot a{color:inherit}.f1by{margin-top:26px}
.f1src{margin:14px 0 0;font-size:13.5px}.f1src summary{cursor:pointer;font:600 13px var(--sans);color:var(--ink-2);letter-spacing:.03em}.f1src summary span{color:var(--ink-3);font-weight:500}
.f1src ol{margin:8px 0 0;padding-left:1.4em;columns:2;column-gap:26px}.f1src li{margin:0 0 5px;break-inside:avoid}.f1src li span{color:var(--ink-3)}
.f1desk{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:#EEF1F4;background:#0E1A2B;border-radius:14px;padding:20px 22px 18px;margin:22px 0 6px;position:relative;overflow:hidden}
.f1desk::after{content:"";position:absolute;right:-50px;top:-70px;width:210px;height:210px;border-radius:50%;border:26px solid rgba(232,112,90,.16)}
.f1desk .k{font:700 12px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:#E8705A}.f1desk .t{font:400 34px/1.05 var(--serif)}.f1desk .d{font-size:15px;color:#B9C3CF}
.f1desk .fx{display:flex;flex-wrap:wrap;gap:6px;position:relative;z-index:1}.f1desk .fx span{font:600 13px var(--sans);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:4px 10px}
.f1desk .fgo{font:600 15px var(--sans);color:#D6B25E;margin-top:2px}.f1desk:hover .fgo{text-decoration:underline;text-underline-offset:3px}
.f1race .f1rh,.f1rh{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:8px}
.f1rh h1,.f1drv h1,.f1team h1{font:400 56px/1 var(--serif);margin:0 0 8px;letter-spacing:-.01em}.f1rh .d{color:var(--ink-2);margin:0}
.f1pn{display:flex;gap:8px}.f1pn a{font:600 14px var(--sans);text-decoration:none;color:var(--ink);border:1px solid var(--rule);background:var(--raise);border-radius:999px;padding:6px 12px}
.f1chip{display:inline-block;font:700 13px var(--sans);color:var(--signal);border:1px solid currentColor;border-radius:999px;padding:4px 11px;margin:10px 0 0}.f1chip.sm{margin:0;padding:2px 8px;font-size:12px}
.f1g2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:34px}
.f1trk{width:100%;height:auto;max-height:420px;display:block}.f1trk .tb{fill:none;stroke:var(--shoal-2);stroke-linejoin:round;stroke-linecap:round}.f1trk .tl{fill:none;stroke:var(--ink);stroke-linejoin:round;stroke-linecap:round}
.f1trk .sf{fill:var(--signal)}.f1trk .cn circle{fill:var(--raise);stroke:var(--ink-3);stroke-width:1.5px;vector-effect:non-scaling-stroke}.f1trk .cn text{text-anchor:middle;font-family:var(--sans);font-weight:700;fill:var(--ink)}
.f1ses{list-style:none;margin:0;padding:0}.f1ses li{display:grid;grid-template-columns:150px minmax(0,1fr) auto;gap:10px;padding:8px 0;border-bottom:1px solid var(--rule);font-size:15px}.f1ses li.past{color:var(--ink-3)}.f1ses small{color:var(--ink-3)}
.f1lap{position:relative;overflow-x:auto;scrollbar-width:thin}.f1lap svg{width:100%;min-width:680px;height:auto;display:block}
.f1lap .ln{fill:none;stroke:var(--c);stroke-width:1.8;stroke-linejoin:round;opacity:.9;cursor:pointer;transition:opacity .15s}
.f1lap .pit{fill:var(--raise);stroke:var(--c);stroke-width:1.8}.f1lap .dl{font:600 11px var(--sans);fill:var(--ink-2);cursor:pointer}
.f1lap .scb{fill:color-mix(in srgb,var(--brass) 18%,transparent)}.f1lap .scb.VSC{fill:color-mix(in srgb,var(--brass) 10%,transparent)}.f1lap .scb.RED{fill:color-mix(in srgb,var(--signal) 30%,transparent)}.f1lap .scl{font:700 10px var(--sans);fill:var(--brass-ink)}
.f1lap.focus .ln,.f1lap.focus .pit,.f1lap.focus .dl{opacity:.12}.f1lap.focus .on{opacity:1!important}.f1lap.focus .ln.on{stroke-width:3.2}.f1lap.focus .dl.on{fill:var(--ink);font-weight:700}
.f1keys{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.f1keys .chip{padding:4px 10px;font-size:13px}.f1keys .f1sw{height:12px;margin-right:4px}
.f1st{overflow-x:auto;scrollbar-width:thin}.f1st svg{width:100%;min-width:600px;height:auto;display:block}.f1st .stint.hard{stroke:var(--ink-3);stroke-width:1}.f1st .stl{font:700 10.5px var(--sans);fill:#fff}.f1st .stl.dk{fill:#1a1f27}.f1st .dl{font:600 11.5px var(--sans);fill:var(--ink-2)}
.f1lg{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px;color:var(--ink-2);margin:8px 0 0}.f1lg i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px;vertical-align:-1px}.f1lg i.hard{box-shadow:inset 0 0 0 1px var(--ink-3)}
.f1bars{display:grid;gap:6px;max-width:760px}.f1bars div{display:grid;grid-template-columns:170px minmax(0,1fr) 84px;gap:10px;align-items:center;font-size:14.5px}
.f1bars .b{height:10px;background:color-mix(in srgb,var(--shoal) 60%,transparent);border-radius:5px;overflow:hidden}.f1bars .b i{display:block;height:100%;border-radius:0 5px 5px 0}.f1bars .v{text-align:right;font-variant-numeric:tabular-nums;color:var(--ink-2)}
.f1wx{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 0}.f1wx span{font:600 13px var(--sans);border:1px solid var(--rule);border-radius:999px;padding:4px 10px;background:var(--raise)}
.f1mom{margin:6px 0 0;padding-left:1.2em;font-size:15.5px;line-height:1.5}.f1mom li{margin:0 0 4px}
.f1rc2{list-style:none;margin:0;padding:0;max-width:820px}.f1rc2 li{display:grid;grid-template-columns:62px 140px minmax(0,1fr);gap:10px;padding:8px 0;border-bottom:1px solid var(--rule);font-size:14.5px}
.f1rc2 .lp{color:var(--ink-3);font-variant-numeric:tabular-nums}.f1rc2 .kd{font:700 12px var(--sans);letter-spacing:.05em;text-transform:uppercase;color:var(--ink-2)}
.f1rc2 .k-SC .kd,.f1rc2 .k-VSC .kd{color:var(--brass-ink)}.f1rc2 .k-RED .kd,.f1rc2 .k-PEN .kd{color:var(--signal)}
.f1v1{max-width:420px;margin:4px 0 14px}.f1vg{display:grid;gap:18px}
.f1map{margin:6px 0 18px}.f1map svg{width:100%;height:auto;display:block}.f1map .land{fill:var(--shoal);stroke:none}
.f1map .leg{fill:none;stroke:var(--ink-3);stroke-width:1.1;stroke-dasharray:3 3;opacity:.75}.f1map .leg.done{stroke:var(--ink);stroke-dasharray:none;opacity:.6}
.f1map .mst circle{fill:var(--raise);stroke:var(--ink);stroke-width:1.6}.f1map .mst.s-done circle{fill:var(--ink)}.f1map .mst.nx circle{stroke:var(--brass);stroke-width:3}
.f1map .mst text{font:700 9.5px var(--sans);fill:var(--ink-2)}.f1map a:hover circle{stroke:var(--brass);stroke-width:2.6}
.f1map figcaption{display:flex;gap:16px;font-size:13px;color:var(--ink-2);margin-top:4px}.f1map .d{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:-1px;border:1.6px solid var(--ink)}.f1map .d.done{background:var(--ink)}.f1map .d.nx{border-color:var(--brass);border-width:3px}
.f1calnote{max-width:72ch;margin:0 0 12px;font-size:16.5px}
.f1cl tr.s-upcoming td{color:var(--ink-2)}.f1cl td small{display:inline;margin-left:8px}.f1spr{font:700 10.5px var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--brass-ink)}
.f1tw{margin-top:10px}
.f1heat{border-collapse:separate;border-spacing:2px;font:500 12.5px var(--sans);font-variant-numeric:tabular-nums}
.f1heat th{font:600 11px var(--sans);color:var(--ink-3);padding:2px 4px;text-align:center}.f1heat th a{color:inherit;text-decoration:none}.f1heat tbody th{text-align:left;white-space:nowrap}.f1heat tbody th a{color:var(--ink);font-size:12.5px}
.f1heat td{width:34px;height:26px;text-align:center;border-radius:4px;background:color-mix(in srgb,var(--brass) calc(var(--a) * 85%),var(--raise));color:var(--ink)}.f1heat td.z{background:var(--raise);color:var(--ink-3)}.f1heat td.r{background:none;text-align:right;padding-left:8px}
.f1dg{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.f1dcard{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-decoration:none;color:var(--ink);background:var(--raise);border:1px solid var(--rule);border-radius:16px;padding:16px 16px 14px;overflow:hidden}
.f1dcard::before{content:"";position:absolute;inset:0 0 auto 0;height:5px;background:var(--tc)}.f1dcard:hover{border-color:var(--ink-3)}
.f1dcard .no{position:absolute;right:14px;top:10px;font:400 58px/1 var(--serif);color:color-mix(in srgb,var(--tc) 55%,var(--ink-3));opacity:.55}
.f1dcard .nm{font:400 28px/1 var(--serif);margin-top:8px}.f1dcard .nm small{display:block;font:500 14px var(--sans);color:var(--ink-2)}.f1dcard .tm{font-size:13.5px;color:var(--ink-2)}
.f1dcard .stat{display:grid;grid-template-columns:repeat(4,auto);gap:4px 14px;margin-top:8px}.f1dcard .stat span{display:flex;flex-direction:column;font-size:11.5px;color:var(--ink-3)}.f1dcard .stat b{font:600 17px var(--sans);color:var(--ink);font-variant-numeric:tabular-nums}
.f1dcard .ti{font:700 11.5px var(--sans);letter-spacing:.05em;text-transform:uppercase;color:var(--brass-ink);margin-top:6px}
.f1dh{display:flex;align-items:center;gap:22px;position:relative;margin:4px 0 8px}.f1dh .no{font:400 120px/1 var(--serif);color:var(--tc);opacity:.85;min-width:1ch}.f1dh h1 small{font:500 20px var(--sans);color:var(--ink-2);display:block;margin-bottom:4px}.f1dh .d{margin:0;color:var(--ink-2)}.f1dh .d a{color:var(--ink);font-weight:600}
.f1tiles{display:flex;flex-wrap:wrap;gap:1px;background:var(--rule);border:1px solid var(--rule);border-radius:14px;overflow:hidden;margin-top:22px}
.f1tile{flex:1 1 128px;background:var(--raise);padding:12px 14px}.f1tile b{display:block;font:400 34px/1.05 var(--serif);font-variant-numeric:tabular-nums}.f1tile span{font:600 12px var(--sans);color:var(--ink-3);text-transform:uppercase;letter-spacing:.05em}
.f1strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:4px}
.f1strip a{display:flex;flex-direction:column;align-items:center;text-decoration:none;color:var(--ink);background:var(--raise);border:1px solid var(--rule);border-radius:8px;padding:6px 2px 5px}
.f1strip .r{font:700 10px var(--sans);color:var(--ink-3);letter-spacing:.04em}.f1strip b{font:600 18px/1.2 var(--sans);font-variant-numeric:tabular-nums}.f1strip small{font-size:10px;color:var(--ink-3);min-height:13px}
.f1strip .w{background:var(--brass);border-color:var(--brass);color:#1a1405}.f1strip .w .r,.f1strip .w small{color:#3d300c}.f1strip .pod{box-shadow:inset 0 -3px 0 var(--brass)}.f1strip .pts{box-shadow:inset 0 -3px 0 var(--ink-3)}.f1strip .dnf b{color:var(--signal);font-size:13px}.f1strip .fut{opacity:.45}
.f1lg i.w{background:var(--brass)}.f1lg i.pod{box-shadow:inset 0 -3px 0 var(--brass);background:var(--raise);border:1px solid var(--rule)}.f1lg i.pts{box-shadow:inset 0 -3px 0 var(--ink-3);background:var(--raise);border:1px solid var(--rule)}.f1lg i.dnf{background:var(--signal)}
.f1h2h{max-width:720px}.f1h2h .hhh{display:flex;justify-content:space-between;font:600 15px var(--sans);margin-bottom:6px}.f1h2h .hhh a{color:var(--ink);text-decoration:none}
.hh{display:grid;grid-template-columns:150px 40px minmax(0,1fr) 40px;gap:10px;align-items:center;padding:6px 0;font-size:14.5px}.hh .l{color:var(--ink-2)}.hh .a{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}.hh .c{font-weight:700;font-variant-numeric:tabular-nums}
.hh .b2{display:flex;gap:2px;height:12px}.hh .b2 i{display:block;height:100%}.hh .b2 i:first-child{background:var(--tc);border-radius:6px 0 0 6px}.hh .b2 i:last-child{background:color-mix(in srgb,var(--tc) 40%,var(--raise));border-radius:0 6px 6px 0}
.f1car2 dd{font:400 26px/1.1 var(--serif)}
.f1th{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,420px);gap:24px;align-items:center;margin-bottom:6px}.f1th .k{font:700 12.5px var(--sans);letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);margin:0 0 8px}
.f1th h1{font-size:84px}.f1th .d{color:var(--ink-2);margin:0}.f1th .f1car{width:100%;height:auto}
.f1fx{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0}.f1fx span{font:600 13px var(--sans);border:1px solid var(--rule);background:var(--raise);border-radius:999px;padding:4px 11px}
.f1team .gspec{border-top:4px solid var(--tc)}
.f1 .gspec{background:var(--raise);gap:0}.f1 .gspec>div{box-shadow:1px 0 0 var(--rule),0 1px 0 var(--rule)}.f1 .gspec>div.w2{grid-column:span 2}
@media (max-width:620px){.f1 .gspec>div.w2{grid-column:auto}}
.f1feat{margin:0;padding:0;list-style:none}.f1feat li{padding:10px 0 10px 18px;border-bottom:1px solid var(--rule);font-size:15.5px;line-height:1.5;position:relative}.f1feat li::before{content:"";position:absolute;left:0;top:18px;width:8px;height:3px;border-radius:2px;background:var(--tc)}
.f1up{list-style:none;margin:0;padding:0;max-width:880px}.f1up li{display:grid;grid-template-columns:130px minmax(0,1fr);gap:16px;padding:12px 0;border-bottom:1px solid var(--rule);position:relative}
.f1up .ur{font:600 12px var(--sans);letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);text-decoration:none}.f1up .ur b{display:block;font:400 22px/1.1 var(--serif);text-transform:none;letter-spacing:0;color:var(--ink)}
.f1up p{margin:0 0 4px;font-size:15px;line-height:1.5}.f1up .ui{font-weight:600}.f1up .lab{font:700 11px var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--brass-ink);margin-right:6px}
.f1sw2{display:grid;grid-template-columns:1fr 1fr;gap:20px}.f1sw2 ul{margin:0;padding-left:1.1em;font-size:15px;line-height:1.5}
.f1pr{display:flex;align-items:flex-end;gap:3px;height:120px;border-bottom:1px solid var(--rule);margin-bottom:4px}.f1pr a{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;text-decoration:none;position:relative}
.f1pr i{display:block;width:100%;background:var(--tc);border-radius:4px 4px 0 0;min-height:1px}.f1pr span{position:absolute;bottom:-18px;font:600 9px var(--sans);color:var(--ink-3)}
.f1ppl{margin:0;display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}.f1ppl dt{font:600 11.5px var(--sans);text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3)}.f1ppl dd{margin:2px 0 0;font-weight:600}
.f1sup{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}.f1sup>div{border:1px solid var(--rule);background:var(--raise);border-radius:12px;padding:12px 14px}.f1sup h3{font:400 24px var(--serif);margin:0 0 6px}.f1sup ul{list-style:none;margin:0;padding:0}.f1sup li{padding:4px 0;font-size:15px}.f1sup a{color:var(--ink);font-weight:600;text-decoration:none}.f1sup small{color:var(--ink-3)}
.f1cmp td{font-size:14px}
.f1aero{margin:22px 0 0;max-width:820px}.f1aero svg{width:100%;height:auto}.f1aero .body{fill:var(--ink)}.f1aero .tyre{fill:var(--ink-2)}.f1aero .pylon{fill:var(--ink-3)}
.f1aero .el{stroke:var(--brass);stroke-width:5;stroke-linecap:round;fill:none}.f1aero .flow{stroke:var(--ink-3);stroke-width:1.4;fill:none;stroke-dasharray:4 4}.f1aero .cap{font:600 13px var(--sans);fill:var(--ink-2)}
.f1aero figcaption{font-size:13.5px;color:var(--ink-2)}
.f1num dd{font-variant-numeric:tabular-nums}
@media (max-width:980px){.f1hero{grid-template-columns:1fr}.f1hero .f1side{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center}.f1hero dl{grid-template-columns:1fr 1fr}}
@media (max-width:820px){
  .f1nav{margin:12px -4px 16px}.f1hero{padding:20px 18px;border-radius:14px;gap:16px}.f1hero h1{font-size:38px}.f1hero .cd .u{min-width:0;flex:1;padding:6px 4px}.f1hero .cd .u b{font-size:26px}
  .f1hero .f1side{grid-template-columns:1fr}.f1hero .f1trk{max-height:200px}.f1hero .f1ss{grid-template-columns:1fr 1fr}
  .f1lede{font-size:19px}.f1lastg,.f1rr,.f1g2,.f1th{grid-template-columns:1fr;gap:18px}.f1rh h1,.f1drv h1,.f1team h1{font-size:40px}.f1th h1{font-size:56px}
  .f1hm{display:none}.f1src ol{columns:1}.f1rc{flex-basis:190px}.f1cars{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
  .f1dh .no{font-size:72px}.f1dh{gap:12px;flex-wrap:wrap}.f1bars div{grid-template-columns:110px minmax(0,1fr) 70px}.hh{grid-template-columns:96px 34px minmax(0,1fr) 34px;gap:6px}
  .f1ses li{grid-template-columns:120px minmax(0,1fr)}.f1ses small{grid-column:2}.f1rc2 li{grid-template-columns:52px minmax(0,1fr)}.f1rc2 .m{grid-column:1/-1}
  .f1up li{grid-template-columns:1fr;gap:4px}.f1sw2{grid-template-columns:1fr}.f1chart .dl{font-size:15px}
}`;

/* ================= hooks for the page ================= */
window.F1 = {
  render: (p, keep) => render(p, keep),
  desk: async () => { // the card at the top of the Sports desk
    css();
    try { await ensure(); } catch (e) { return; }
    if (W.view.t !== 'desk' || W.view.k !== 'sports') return;
    const host = document.querySelector('#main .wrap'); if (!host || host.querySelector('.f1desk')) return;
    const box = document.createElement('div'); box.innerHTML = deskCard();
    const card = box.firstElementChild, scores = host.querySelector('#spTop'), top = host.querySelector('.desk-top');
    if (scores) scores.after(card); // after the day's scores, before the desk's features
    else if (top) top.prepend(card);
    else host.prepend(card);
  },
};
})();
