/* ===================================================================================================================
   Election Desk 2026: the app. M = the model (built by build.py from the data files; refreshed from data/model.json
   while the page is open), B = county/state vote baselines (2024, 2020), GEO = the map topology.
   =================================================================================================================== */
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = (n, d = 1) => n == null || isNaN(n) ? '—' : fmt(n, d) + '%';
const sign = (n, d = 1) => n == null || isNaN(n) ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n), d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const md = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso)) ? MON[+iso.slice(5, 7) - 1] + ' ' + (+iso.slice(8, 10)) : '';
const dates = (a, b) => { const x = md(a), y = md(b); if (x && y && x !== y) return (x.slice(0, 3) === y.slice(0, 3) ? x + '–' + y.slice(4) : x + ' – ' + y); return y || x || '—'; };
const ET = (iso, opt = {}) => { if (!iso) return '—'; const d = new Date(iso); if (isNaN(d)) return iso; return d.toLocaleString('en-US', Object.assign({ timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }, opt)) + ' ET'; };
const ABBR = B.fips; const FIPS_BY_ABBR = {}; for (const f in ABBR) FIPS_BY_ABBR[ABBR[f]] = f;
// party and map colors are CSS custom properties (template.html), so they follow the light and dark themes
const COL = { D: 'var(--d)', R: 'var(--r)', I: 'var(--i)', T: 'var(--t)', none: 'var(--map-none)', dim: 'var(--map-dim)', mid: 'var(--map-mid)' };
const brassAt = (a) => `color-mix(in srgb,var(--brass) ${Math.round(100 * a)}%,transparent)`;
const PARTY_NAME = { D: 'Democrat', R: 'Republican', I: 'Independent', L: 'Libertarian', G: 'Green', O: 'Other' };
const S = { tab: 'S', mode: null, st: null, co: null, pollsTab: 'S' }; // ui state
let M = window.M;

/* ---------------------------------------------------------------- derived */
function marginFill(m, max = 30) { // m = D minus R in points; blue for D, red for R
  if (m == null || isNaN(m)) return COL.none; const t = clamp(Math.abs(m) / max, 0, 1); const a = 0.25 + 0.75 * t;
  return m >= 0 ? `rgba(59,127,240,${a.toFixed(2)})` : `rgba(226,74,74,${a.toFixed(2)})`;
}
function ratingScore(s) { if (!s) return null; const t = s.toLowerCase(); const side = /\bd\b|dem/.test(t) ? -1 : /\br\b|rep|gop/.test(t) ? 1 : 0; if (/toss/.test(t)) return 0; if (/solid|safe/.test(t)) return 3 * side; if (/likely/.test(t)) return 2 * side; if (/lean|tilt/.test(t)) return side; return null; }
function consensus(r) { if (r.score != null) return r.score; const v = ['cook', 'sabato', 'inside'].map((k) => ratingScore(r.ratings && r.ratings[k])).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }
function ratingFill(sc) { if (sc == null) return COL.none; if (sc <= -2.5) return '#1d4db5'; if (sc <= -1.5) return '#2e6fdb'; if (sc <= -0.5) return '#6f9ff0'; if (sc < 0.5) return COL.T; if (sc < 1.5) return '#f08c7a'; if (sc < 2.5) return '#d63a3a'; return '#9c2020'; }
function ratingWord(sc) { if (sc == null) return 'No rating'; const a = Math.abs(sc); const p = sc < 0 ? 'D' : 'R'; if (a < 0.5) return 'Toss-up'; if (a < 1.5) return 'Lean ' + p; if (a < 2.5) return 'Likely ' + p; return 'Solid ' + p; }
function racesIn(fips, type) { return Object.values(M.races).filter((r) => r.fips === fips && (!type || r.type === type)); }
function raceList(type) { return Object.values(M.races).filter((r) => r.type === type); }
function result(id) { return M.results && M.results.races && M.results.races[id]; }
function candVotes(r, res) { // [{cand, votes, pct}] sorted
  if (!res || !res.c) return null; const tot = res.tot || Object.values(res.c).reduce((a, b) => a + (b || 0), 0);
  return r.cands.map((c) => ({ c, v: res.c[c.n] || 0, p: tot ? 100 * (res.c[c.n] || 0) / tot : 0 })).sort((a, b) => b.v - a.v);
}
function leader(r) { const res = result(r.id); const cv = candVotes(r, res); if (!cv || !cv[0].v) return null; return { party: cv[0].c.p, call: res.call, margin: cv.length > 1 ? cv[0].p - cv[1].p : cv[0].p, pctIn: res.pctIn, cand: cv[0].c }; }
function pollMargin(r) { const a = r.avg; if (a && a.d != null && a.r != null) return a.d - a.r; const p = (r.polls || []).filter((x) => x.d != null && x.r != null).slice(0, 3); if (!p.length) return null; return p.reduce((s, x) => s + (x.d - x.r), 0) / p.length; }
function marketRow(r) { return (M.markets && M.markets.races && M.markets.races[r.id]) || r.market || null; }
// the market's chance for the main non-Republican side: the Democrat, or the independent where the independent is the real opponent (Nebraska)
function marketSide(r) { const m = marketRow(r); if (!m) return null; const useI = m.I != null && (m.D == null || m.I > m.D) && r.cands.some((c) => c.p === 'I'); return useI ? 'I' : 'D'; }
function marketD(r) { const m = marketRow(r); if (!m) return null; const side = marketSide(r); const v = side === 'I' ? m.I : m.D; return v == null ? null : v; }
function marketLabel(r) { const md = marketD(r); if (md == null) return null; const side = marketSide(r); const lead = md >= 0.5 ? side : 'R'; return { side: lead, p: md >= 0.5 ? md : 1 - md }; }
function pres24Margin(fips) { const s = B.s[fips]; return s && s[2] ? 100 * (s[0] - s[1]) / s[2] : null; }
function countyMargin24(f) { const c = B.c[f]; if (!c) return null; const i = c[2] ? 0 : (c[5] ? 3 : null); if (i == null) return null; return 100 * (c[i] - c[i + 1]) / c[i + 2]; }
function countyRes(f) { return M.results && M.results.counties && M.results.counties[f]; }
function isNight() { return M.meta.mode === 'night' || M.meta.mode === 'post'; }
function sideOf(r) { // which side a race currently counts for in the balance of power: 'D' | 'R' | 'I' | 'T'
  const res = result(r.id); if (res && res.call) return res.call;
  const sc = consensus(r); if (sc == null) return 'T'; if (sc <= -0.5) return r.cands.some((c) => c.p === 'I' && !r.cands.some((d) => d.p === 'D')) ? 'I' : 'D'; if (sc >= 0.5) return 'R'; return 'T';
}
function leanOf(r) { const sc = consensus(r); const res = result(r.id); if (res && res.call) return 'called'; if (sc == null) return 'toss'; return Math.abs(sc) < 0.5 ? 'toss' : Math.abs(sc) < 1.5 ? 'lean' : 'solid'; }

/* ---------------------------------------------------------------- header + balance of power */
function renderHeader() {
  const m = M.meta; const night = isNight(); const pill = $('#st-pill'); pill.classList.toggle('live', night && m.mode === 'night');
  $('#st-mode').textContent = m.mode === 'night' ? 'LIVE · Election night' : m.mode === 'post' ? 'Counting continues' : 'Pre-election';
  $('#st-updated').textContent = 'Updated ' + ET(m.updated);
  const ed = new Date(m.electionDay + 'T00:00:00-05:00'); const now = new Date(); const days = Math.ceil((ed - now) / 864e5);
  $('#st-count').textContent = days > 1 ? days + ' days to Election Day' : days === 1 ? 'Election Day is tomorrow' : days === 0 ? 'Election Day' : '';
  document.title = (m.mode === 'night' ? 'LIVE · ' : '') + 'Election Desk 2026';
}
function bopBar(title, sub, parts, total, midLabel, nums, legend) {
  const w = (n) => (100 * n / total).toFixed(2) + '%';
  return `<div class="b"><div class="h"><span>${esc(title)}</span><b>${esc(sub)}</b></div>
  <div class="bar">${parts.map((p) => `<i style="width:${w(p.n)};background:${p.c}" title="${esc(p.l)}: ${p.n}"></i>`).join('')}<span class="mid" data-l="${esc(midLabel)}"></span></div>
  <div class="nums"><span class="dn">${nums.d}</span><span class="tn">${esc(nums.t)}</span><span class="rn">${nums.r}</span></div>
  <div class="legend">${legend.map((l) => `<span><span class="sw" style="background:${l.c}"></span>${esc(l.t)}</span>`).join('')}</div></div>`;
}
function renderBOP() {
  const bal = M.balance; const night = isNight();
  function chamber(type, notUp, total, midLabel, title) {
    const rs = raceList(type); const k = { D: 0, R: 0, I: 0, T: 0, leanD: 0, leanR: 0, callD: 0, callR: 0, callI: 0 };
    for (const r of rs) { const s = sideOf(r), l = leanOf(r); if (l === 'called') k['call' + s]++; else if (s === 'T') k.T++; else if (l === 'lean') k['lean' + (s === 'I' ? 'D' : s)]++; else k[s === 'I' ? 'D' : s]++; }
    const dBase = (notUp.D || 0) + (notUp.I || 0), rBase = notUp.R || 0;
    const parts = [
      { n: dBase, c: '#163a85', l: 'Democrats not up' }, { n: k.callD + k.callI, c: '#2e6fdb', l: 'Called for Democrats' }, { n: k.D, c: '#2e6fdb', l: 'Solid or likely D' }, { n: k.leanD, c: '#6f9ff0', l: 'Lean D' },
      { n: k.T, c: COL.T, l: 'Toss-up' },
      { n: k.leanR, c: '#f08c7a', l: 'Lean R' }, { n: k.R, c: '#d63a3a', l: 'Solid or likely R' }, { n: k.callR, c: '#d63a3a', l: 'Called for Republicans' }, { n: rBase, c: '#7a1d1d', l: 'Republicans not up' }];
    if (night) { // election night: only calls count; uncalled races show their leader, or nothing
      const n = { leadD: 0, leadR: 0, open: 0 };
      for (const r of rs) { if (leanOf(r) === 'called') continue; const l = leader(r); if (!l) n.open++; else if (l.party === 'R') n.leadR++; else n.leadD++; }
      const np = [{ n: dBase, c: '#163a85', l: 'Democrats not up' }, { n: k.callD + k.callI, c: '#2e6fdb', l: 'Called for Democrats' }, { n: n.leadD, c: 'rgba(59,127,240,.45)', l: 'Leading, uncalled' },
        { n: n.open, c: COL.mid, l: 'No results yet' }, { n: n.leadR, c: 'rgba(226,74,74,.45)', l: 'Leading, uncalled' }, { n: k.callR, c: '#d63a3a', l: 'Called for Republicans' }, { n: rBase, c: '#7a1d1d', l: 'Republicans not up' }];
      const unc = rs.length - k.callD - k.callR - k.callI;
      return bopBar(title, `${k.callD + k.callR + k.callI} of ${rs.length} called`, np, total, midLabel, { d: dBase + k.callD + k.callI, r: rBase + k.callR, t: unc ? unc + ' uncalled' : 'all called' },
        [{ c: '#163a85', t: 'not up' }, { c: '#2e6fdb', t: 'called' }, { c: 'rgba(59,127,240,.45)', t: 'leading' }, { c: COL.mid, t: 'no results' }]);
    }
    const dTot = dBase + k.callD + k.callI + k.D + k.leanD, rTot = rBase + k.callR + k.R + k.leanR;
    const sub = `${rs.length} races · ${k.T} toss-ups`;
    const legend = [{ c: '#163a85', t: 'not up' }, { c: '#2e6fdb', t: 'solid / likely' }, { c: '#6f9ff0', t: 'lean' }, { c: COL.T, t: 'toss-up' }];
    return bopBar(title, sub, parts, total, midLabel, { d: dTot, r: rTot, t: k.T ? k.T + ' toss-up' : '' }, legend);
  }
  const hs = M.results && M.results.house; const hr = (M.house.ratings || [])[0] || {};
  let houseHtml;
  if (night && hs && (hs.calledD || hs.calledR)) {
    const parts = [{ n: hs.calledD || 0, c: '#2e6fdb', l: 'Called D' }, { n: hs.leadD || 0, c: '#6f9ff0', l: 'Leading D' }, { n: 435 - (hs.calledD || 0) - (hs.calledR || 0) - (hs.leadD || 0) - (hs.leadR || 0), c: COL.mid, l: 'Uncalled' }, { n: hs.leadR || 0, c: '#f08c7a', l: 'Leading R' }, { n: hs.calledR || 0, c: '#d63a3a', l: 'Called R' }];
    houseHtml = bopBar('House', `${(hs.calledD || 0) + (hs.calledR || 0)} of 435 called · ${ET(hs.asOf)}`, parts, 435, '218', { d: hs.calledD || 0, r: hs.calledR || 0, t: 'called' }, [{ c: '#2e6fdb', t: 'called D' }, { c: '#6f9ff0', t: 'leading D' }, { c: COL.mid, t: 'uncalled' }, { c: '#f08c7a', t: 'leading R' }, { c: '#d63a3a', t: 'called R' }]);
  } else {
    const parts = [{ n: hr.solidD || 0, c: '#1d4db5', l: 'Solid D' }, { n: hr.likelyD || 0, c: '#2e6fdb', l: 'Likely D' }, { n: hr.leanD || 0, c: '#6f9ff0', l: 'Lean D' }, { n: hr.tossup || 0, c: COL.T, l: 'Toss-up' }, { n: hr.leanR || 0, c: '#f08c7a', l: 'Lean R' }, { n: hr.likelyR || 0, c: '#d63a3a', l: 'Likely R' }, { n: hr.solidR || 0, c: '#9c2020', l: 'Solid R' }];
    const dT = (hr.solidD || 0) + (hr.likelyD || 0) + (hr.leanD || 0), rT = (hr.solidR || 0) + (hr.likelyR || 0) + (hr.leanR || 0);
    houseHtml = bopBar('House', `${esc(hr.source || 'Ratings')} · ${hr.asOf || ''}`, parts, 435, '218', { d: dT, r: rT, t: (hr.tossup || 0) + ' toss-up' }, [{ c: '#2e6fdb', t: 'solid / likely D' }, { c: '#6f9ff0', t: 'lean D' }, { c: COL.T, t: 'toss-up' }, { c: '#f08c7a', t: 'lean R' }, { c: '#d63a3a', t: 'solid / likely R' }]);
  }
  $('#bop').innerHTML = chamber('S', bal.senate.notUp, 100, '50', 'Senate') + houseHtml + chamber('G', bal.gov.notUp, 50, '25', 'Governors');
}
function renderAlert() {
  const a = ((M.results && M.results.alerts) || []).slice().sort((x, y) => (y.t || '').localeCompare(x.t || ''))[0]; const el = $('#alert');
  if (!a || !isNight()) { el.classList.remove('on'); return; }
  el.classList.add('on'); $('#alert-x').textContent = a.text; $('#alert-t').textContent = ET(a.t);
}

/* ---------------------------------------------------------------- map */
const MODES = { pre: ['ratings', 'polls', 'markets', 'early', 'pres24'], night: ['results', 'ratings', 'pres24', 'early'] };
const MODE_LABEL = { results: 'Results', ratings: 'Ratings', polls: 'Poll margin', markets: 'Markets', early: 'Early vote', pres24: '2024 vote' };
function currentModes() { return MODES[isNight() ? 'night' : 'pre']; }
function renderModes() { const ms = currentModes(); if (!ms.includes(S.mode)) S.mode = ms[0]; $('#modes').innerHTML = ms.map((m) => `<button data-mode="${m}" aria-pressed="${m === S.mode}">${MODE_LABEL[m]}</button>`).join(''); }
function stateFill(fips) {
  if (S.tab === 'H') { const n = (M.house.competitive || []).filter((d) => d.state === ABBR[fips]).length; return n ? brassAt(0.25 + 0.18 * Math.min(n, 4)) : COL.none; }
  const rs = racesIn(fips, S.tab); const r = rs[0];
  if (S.mode === 'pres24') return marginFill(pres24Margin(fips), 35);
  if (S.mode === 'early') { const e = M.early && M.early.states && M.early.states[ABBR[fips]]; const v = e && (e.pctOf2022Final != null ? e.pctOf2022Final : (e.totalBallots ? 1 : null)); return v == null ? COL.none : brassAt(0.2 + 0.8 * clamp(v / 100, 0, 1)); }
  if (!r) return COL.none;
  if (S.mode === 'results') { const l = leader(r); if (!l) return COL.dim; const c = l.party === 'D' ? '59,127,240' : l.party === 'R' ? '226,74,74' : '47,179,156'; return l.call ? `rgb(${c})` : `rgba(${c},.45)`; }
  if (S.mode === 'polls') { const m = pollMargin(r); return m == null ? COL.dim : marginFill(m, 15); }
  if (S.mode === 'markets') { const d = marketD(r); return d == null ? COL.dim : marginFill((d - 0.5) * 100, 45); }
  return ratingFill(consensus(r));
}
function countyFill(f) {
  const res = countyRes(f);
  if (S.mode === 'results' && res && res.tot) { const m = 100 * ((res.d || 0) - (res.r || 0)) / res.tot; return marginFill(m, 55); }
  if (S.mode === 'results') return COL.dim;
  return marginFill(countyMargin24(f), 55);
}
function tipState(fips) {
  const name = B.names[fips] || fips; const rs = racesIn(fips, S.tab === 'H' ? null : S.tab);
  let body = '';
  if (S.tab === 'H') { const ds = (M.house.competitive || []).filter((d) => d.state === ABBR[fips]); body = ds.length ? `<div class="m">${ds.length} competitive district${ds.length > 1 ? 's' : ''}: ${esc(ds.map((d) => d.district + ' (' + (d.cook || d.sabato || '') + ')').join(', '))}</div>` : '<div class="m">No competitive House race (Cook)</div>'; }
  else if (!rs.length) body = `<div class="m">No ${S.tab === 'S' ? 'Senate' : 'governor'} race in 2026</div>`;
  else body = rs.map((r) => { const l = leader(r); const sc = consensus(r); const pm = pollMargin(r); const md = marketD(r);
    const line = l ? `${esc(l.cand.n)} (${l.party}) ${l.call ? 'wins' : 'leads'} by ${fmt(Math.abs(l.margin), 1)} pts · ${pct(l.pctIn, 0)} in` : `${ratingWord(sc)}${pm != null ? ' · polls ' + (pm >= 0 ? 'D' : 'R') + sign(Math.abs(pm), 1) : ''}${md != null ? ' · market ' + marketLabel(r).side + ' ' + pct(100 * marketLabel(r).p, 0) : ''}`;
    return `<div><b>${esc(r.name)}</b><div class="m">${line}</div></div>`; }).join('');
  const p24 = pres24Margin(fips); const e = M.early && M.early.states && M.early.states[ABBR[fips]];
  return `<b>${esc(name)}</b>${body}<div class="m">2024: ${p24 == null ? '—' : (p24 >= 0 ? 'Harris' : 'Trump') + ' ' + sign(Math.abs(p24), 1)}${e && e.totalBallots ? ' · early votes ' + fmt(e.totalBallots) : ''}</div>`;
}
function tipCounty(f) {
  const c = MAP.counties[f]; const b = B.c[f]; const m24 = countyMargin24(f); const res = countyRes(f);
  let r26 = '';
  if (res && res.tot) { const m = 100 * ((res.d || 0) - (res.r || 0)) / res.tot; r26 = `<div class="m">2026: ${m >= 0 ? 'D' : 'R'} ${sign(Math.abs(m), 1)} · ${fmt(res.tot)} votes · ${pct(res.pctIn, 0)} in${m24 != null ? ' · swing ' + (m - m24 >= 0 ? 'D' : 'R') + sign(Math.abs(m - m24), 1) : ''}</div>`; }
  const yr = b && b[2] ? '2024' : '2020';
  return `<b>${esc(c.name)}</b><div class="m">${yr}: ${m24 == null ? 'no data' : (m24 >= 0 ? 'D' : 'R') + ' ' + sign(Math.abs(m24), 1) + ' · ' + fmt(b[2] || b[5]) + ' votes'}</div>${r26}`;
}
function legend() {
  const L = $('#maplegend');
  const ramp = (a, b) => `<span class="ramp" style="background:linear-gradient(90deg,${a},${COL.mid},${b})"></span>`;
  if (S.tab === 'H') { L.innerHTML = `<span><span class="sw" style="background:${brassAt(0.9)}"></span>more competitive House districts (Cook toss-up and lean)</span>`; return; }
  if (S.mode === 'ratings') L.innerHTML = [['#1d4db5', 'Solid D'], ['#2e6fdb', 'Likely D'], ['#6f9ff0', 'Lean D'], [COL.T, 'Toss-up'], ['#f08c7a', 'Lean R'], ['#d63a3a', 'Likely R'], ['#9c2020', 'Solid R'], [COL.none, 'no race']].map(([c, t]) => `<span><span class="sw" style="background:${c}"></span>${t}</span>`).join('') + '<span>consensus of Cook, Sabato and Inside Elections</span>';
  else if (S.mode === 'results') L.innerHTML = `<span><span class="sw" style="background:rgb(59,127,240)"></span>called D</span><span><span class="sw" style="background:rgba(59,127,240,.45)"></span>leading D</span><span><span class="sw" style="background:rgba(226,74,74,.45)"></span>leading R</span><span><span class="sw" style="background:rgb(226,74,74)"></span>called R</span><span><span class="sw" style="background:${COL.dim}"></span>no results yet</span><span>counties: margin, 2026</span>`;
  else if (S.mode === 'polls') L.innerHTML = `<span>D +15</span>${ramp('rgba(59,127,240,1)', 'rgba(226,74,74,1)')}<span>R +15 · average of recent polls</span>`;
  else if (S.mode === 'markets') L.innerHTML = `<span>D 95%</span>${ramp('rgba(59,127,240,1)', 'rgba(226,74,74,1)')}<span>R 95% · prediction-market price</span>`;
  else if (S.mode === 'early') L.innerHTML = `<span>few</span><span class="ramp" style="background:linear-gradient(90deg,${brassAt(0.2)},${brassAt(1)})"></span><span>many · ballots cast as a share of the 2022 early vote</span>`;
  else L.innerHTML = `<span>Harris +35</span>${ramp('rgba(59,127,240,1)', 'rgba(226,74,74,1)')}<span>Trump +35 · 2024 presidential margin</span>`;
}
function renderCrumb() {
  const c = $('#crumb'); const parts = [`<button data-level="us">United States</button>`];
  if (S.st) parts.push('<span class="sep">›</span>', S.co ? `<button data-level="st">${esc(B.names[S.st])}</button>` : `<span class="cur">${esc(B.names[S.st])}</span>`);
  if (S.co) parts.push('<span class="sep">›</span>', `<span class="cur">${esc(MAP.counties[S.co].name)}</span>`);
  c.innerHTML = parts.join('');
}
function goUS() { S.st = null; S.co = null; MAP.setView({ level: 'us' }); renderCrumb(); renderRail(); }
function goState(fips) { S.st = fips; S.co = null; MAP.setView({ level: 'st', st: fips }); renderCrumb(); renderRail(); $('#rail').scrollTop = 0; }
function goCounty(f) { S.co = f; MAP.setView({ level: 'st', st: S.st, co: f }); renderCrumb(); renderRail(); }
MAP.on({
  fillState: stateFill, fillCounty: countyFill, tipState, tipCounty,
  labelState: (f) => { if (S.tab === 'H') return null; const rs = racesIn(f, S.tab); return rs.length ? ABBR[f] : null; },
  labelCounty: (f) => MAP.counties[f].name.replace(/ County| Parish| Borough| Census Area| city/g, ''), sizeCounty: (f) => { const b = B.c[f]; return b ? (b[2] || b[5]) : 0; },
  clickState: (f) => { if (S.st === f) return; goState(f); }, clickCounty: (f) => goCounty(f)
});

/* ---------------------------------------------------------------- rail */
function chipsFor(r) { const R = r.ratings || {}; return `<div class="chips">${['cook', 'sabato', 'inside'].map((k) => R[k] ? `<span class="chip ${ratingScore(R[k]) == null ? '' : ratingScore(R[k]) < -0.4 ? 'D' : ratingScore(R[k]) > 0.4 ? 'R' : 'T'}">${esc({ cook: 'Cook', sabato: 'Sabato', inside: 'Inside' }[k])}: ${esc(R[k])}</span>` : '').join('')}</div>`; }
function candBlock(r) {
  const res = result(r.id); const cv = candVotes(r, res); const md = marketD(r); const avg = r.avg || {};
  const seenP = {};
  const rows = (cv || r.cands.map((c) => ({ c, v: null, p: null }))).map(({ c, v, p }) => {
    const party = c.p; let right = ''; const first = !seenP[party]; seenP[party] = true;
    if (cv) right = `<div class="v">${pct(p, 1)}<small>${fmt(v)} votes</small></div>`;
    else { const a = !first ? null : party === 'D' || (party === 'I' && avg.d != null && !r.cands.some((x) => x.p === 'D')) ? avg.d : party === 'R' ? avg.r : null; const ms = marketSide(r); const mk = party === ms ? md : party === 'R' && md != null ? 1 - md : null; right = `<div class="v">${a != null ? pct(a, 1) : '—'}<small>${a != null ? 'poll avg' : ''}${mk != null ? (a != null ? ' · ' : '') + 'market ' + pct(100 * mk, 0) : ''}</small></div>`; }
    const barw = cv ? p : (!first ? null : party === 'D' ? avg.d : party === 'R' ? avg.r : null);
    return `<div class="cand"><div class="p ${party}">${esc(party)}</div><div class="n">${esc(c.n)}${res && res.call === party ? '<span class="check">✓ ' + (res.callBy ? esc(res.callBy) : 'CALL') + '</span>' : ''}<small>${esc(PARTY_NAME[party] || party)}${c.inc ? ' · incumbent' : ''}${c.note ? ' · ' + esc(c.note) : ''}</small></div>${right}${barw != null ? `<div class="bar2"><i style="width:${clamp(barw, 0, 100)}%;background:${COL[party] || '#5b6680'}"></i></div>` : ''}</div>`;
  }).join('');
  const rep = res && res.pctIn != null ? `<div class="note" style="margin-top:6px">${pct(res.pctIn, 0)} of the expected vote counted${res.exp ? ' (expected ' + fmt(res.exp) + ')' : ''} · ${ET(res.asOf)}${res.src ? ' · ' + esc(res.src) : ''}${res.note ? '<br>' + esc(res.note) : ''}</div>` : '';
  return rows + rep;
}
function raceCard(r, full = true) {
  const p24 = pres24Margin(r.fips); const polls = (r.polls || []).slice(0, 5); const md = marketD(r); const mk = (M.markets && M.markets.races && M.markets.races[r.id]) || r.market || {};
  const kv = `<div class="kv">
    <span>2024 presidential</span><b class="${p24 >= 0 ? 'D' : 'R'}">${p24 == null ? '—' : (p24 >= 0 ? 'Harris' : 'Trump') + ' ' + sign(Math.abs(p24), 1)}</b>
    ${r.last && r.last.year ? `<span>Last race (${r.last.year})</span><b class="${r.last.party}">${esc(r.last.winner || '')}${r.last.d != null && r.last.r != null ? ' ' + sign(Math.abs(r.last.d - r.last.r), 1) : ''}</b>` : ''}
    ${md != null ? `<span>Market (${esc(mk.venue || '')})</span><b class="${marketLabel(r).side}">${marketLabel(r).side} ${pct(100 * marketLabel(r).p, 0)}</b>` : ''}
    ${M.hinge && M.hinge[r.id] != null ? `<span>The Hinge forecast</span><b class="${M.hinge[r.id] >= 0.5 ? 'D' : 'R'}">${M.hinge[r.id] >= 0.5 ? 'D' : 'R'} ${pct(100 * (M.hinge[r.id] >= 0.5 ? M.hinge[r.id] : 1 - M.hinge[r.id]), 0)}</b>` : ''}
    <span>Polls close</span><b>${esc(r.close || M.close[r.st] || '—')} ET</b></div>`;
  const pollTbl = polls.length ? `<table class="tbl"><thead><tr><th>Poll</th><th>Dates</th><th class="n">D</th><th class="n">R</th><th class="n">Margin</th></tr></thead><tbody>${polls.map((p) => { const m = p.d - p.r; return `<tr><td>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.pollster)}</a>` : esc(p.pollster)}${p.partisan ? ' <span class="k">(partisan)</span>' : ''}<br><span class="k">${p.n ? fmt(p.n) + ' ' + esc(p.pop || '') : ''}</span></td><td class="k">${dates(p.start, p.end)}</td><td class="n D">${pct(p.d, 0)}</td><td class="n R">${pct(p.r, 0)}</td><td class="n ${m >= 0 ? 'D' : 'R'}">${m >= 0 ? 'D' : 'R'}${sign(Math.abs(m), 0)}</td></tr>`; }).join('')}</tbody></table>${r.avg && r.avg.src ? `<div class="note">Average: ${esc(r.avg.src)}${r.avg.asOf ? ', ' + esc(r.avg.asOf) : ''}</div>` : ''}` : '<div class="note">No public polls on file since Oct. 10.</div>';
  return `<div><h3>${esc(r.name)}</h3>${chipsFor(r)}${candBlock(r)}${full ? '<h3>The numbers</h3>' + kv + '<h3>Recent polls</h3>' + pollTbl + (r.notes ? `<div class="note" style="margin-top:6px">${esc(r.notes)}</div>` : '') : ''}</div>`;
}
function earlyBlock(abbr) {
  const e = M.early && M.early.states && M.early.states[abbr]; if (!e || (!e.totalBallots && !e.earlyInPersonStart)) return '';
  const bp = e.byParty; const tot = e.totalBallots;
  const partyBar = bp && bp.D != null && bp.R != null ? `<div class="bar" style="height:10px;margin:6px 0"><i style="width:${100 * bp.D / (bp.D + bp.R + (bp.other || 0))}%;background:var(--d)"></i><i style="width:${100 * (bp.other || 0) / (bp.D + bp.R + (bp.other || 0))}%;background:#5b6680"></i><i style="width:${100 * bp.R / (bp.D + bp.R + (bp.other || 0))}%;background:var(--r)"></i></div><div class="note">By ${esc(e.byPartyBasis || 'registration')}: D ${pct(100 * bp.D / (bp.D + bp.R + (bp.other || 0)), 0)} · R ${pct(100 * bp.R / (bp.D + bp.R + (bp.other || 0)), 0)}${bp.other ? ' · other ' + pct(100 * bp.other / (bp.D + bp.R + bp.other), 0) : ''}</div>` : '';
  return `<h3>Early and mail voting</h3><div class="kv">${tot != null ? `<span>Ballots cast</span><b>${fmt(tot)}</b>` : ''}${e.mailReturned != null ? `<span>Mail returned</span><b>${fmt(e.mailReturned)}</b>` : ''}${e.inPerson != null ? `<span>In person</span><b>${fmt(e.inPerson)}</b>` : ''}${e.pctOf2022Turnout != null ? `<span>Share of 2022 total turnout</span><b>${pct(e.pctOf2022Turnout, 0)}</b>` : ''}${e.pctOf2024Final != null ? `<span>Share of 2024 early vote</span><b>${pct(e.pctOf2024Final, 0)}</b>` : ''}${e.earlyInPersonStart ? `<span>Early in-person</span><b>${dates(e.earlyInPersonStart, e.earlyInPersonEnd)}</b>` : ''}</div>${partyBar}<div class="note">${e.asOf ? 'As of ' + esc(e.asOf) : ''}${e.source ? ' · <a href="' + esc(e.source) + '" target="_blank" rel="noopener">source</a>' : ''}${e.notes ? '<br>' + esc(e.notes) : ''}</div>`;
}
function countyTable(fips) {
  const list = (MAP.byState[fips] || []).slice(); if (!list.length) return `<div class="note">${esc(B.note[fips] || 'No county map for this state.')}</div>`;
  const night = S.mode === 'results' || isNight(); const size = (f) => { const b = B.c[f]; return b ? (b[2] || b[5]) : 0; };
  list.sort((a, b) => { if (night) { const ra = countyRes(a.id), rb = countyRes(b.id); const oa = ra && ra.pctIn != null ? size(a.id) * (1 - ra.pctIn / 100) : size(a.id), ob = rb && rb.pctIn != null ? size(b.id) * (1 - rb.pctIn / 100) : size(b.id); return ob - oa; } return size(b.id) - size(a.id); });
  const rows = list.slice(0, 15).map((c) => { const m24 = countyMargin24(c.id); const res = countyRes(c.id); const m26 = res && res.tot ? 100 * ((res.d || 0) - (res.r || 0)) / res.tot : null;
    return `<tr class="${S.co === c.id ? 'sel' : ''}"><td><button class="lnk" data-co="${c.id}">${esc(c.name)}</button></td><td class="n">${fmt(size(c.id))}</td><td class="n ${m24 >= 0 ? 'D' : 'R'}">${m24 == null ? '—' : (m24 >= 0 ? 'D' : 'R') + sign(Math.abs(m24), 0)}</td>${night ? `<td class="n ${m26 == null ? '' : m26 >= 0 ? 'D' : 'R'}">${m26 == null ? '—' : (m26 >= 0 ? 'D' : 'R') + sign(Math.abs(m26), 0)}${m26 != null && m24 != null ? `<span class="k"> ${m26 - m24 >= 0 ? '▲D' : '▲R'}${fmt(Math.abs(m26 - m24), 0)}</span>` : ''}</td><td class="n">${res && res.pctIn != null ? pct(res.pctIn, 0) + `<span class="rep"><i style="width:${clamp(res.pctIn, 0, 100)}%"></i></span>` : '—'}</td>` : ''}</tr>`; }).join('');
  return `<table class="tbl"><thead><tr><th>County</th><th class="n">${night ? 'Exp. votes' : '2024 votes'}</th><th class="n">2024</th>${night ? '<th class="n">2026</th><th class="n">In</th>' : ''}</tr></thead><tbody>${rows}</tbody></table><div class="note">${night ? 'Sorted by expected votes still out; expected = the 2024 total.' : 'Largest counties by 2024 presidential vote.'}${B.note[fips] ? ' ' + esc(B.note[fips]) : ''}</div>`;
}
function renderRail() {
  const R = $('#rail'); const night = isNight();
  if (!S.st) { // national watchlist
    const type = S.tab === 'H' ? null : S.tab;
    if (S.tab === 'H') { const ds = (M.house.competitive || []); R.innerHTML = `<h2>The House battlefield</h2><div class="k">${ds.length} districts Cook rates toss-up or lean · click a state</div>` + houseTable(ds.slice(0, 30)); return; }
    const rs = raceList(type).map((r) => ({ r, sc: consensus(r), l: leader(r) })).filter((x) => x.sc == null || Math.abs(x.sc) <= 1.5 || x.l).sort((a, b) => (Math.abs(a.sc == null ? 0 : a.sc) - Math.abs(b.sc == null ? 0 : b.sc)) || a.r.name.localeCompare(b.r.name));
    const rows = rs.map(({ r, sc, l }) => { const pm = pollMargin(r); const md = marketD(r);
      const status = l ? `<b class="${l.party}">${esc(l.cand.n.split(' ').pop())} ${l.call ? '✓' : ''} ${sign(Math.abs(l.margin), 1)}</b><span class="k"> ${pct(l.pctIn, 0)} in</span>` : `<span class="${pm == null ? 'k' : pm >= 0 ? 'D' : 'R'}">${pm == null ? 'no polls' : (pm >= 0 ? 'D' : 'R') + sign(Math.abs(pm), 1)}</span>`;
      const close = r.close || M.close[r.st] || '';
      return `<tr><td><button class="lnk" data-st="${r.fips}">${esc(r.name)}</button><br><span class="k">${esc(r.cands.filter((c) => 'DRI'.includes(c.p)).map((c) => c.n.split(' ').pop() + ' (' + c.p + ')').join(' v '))}${close ? ' · polls close ' + esc(close) + ' ET' : ''}</span></td><td><span class="chip ${sc == null ? '' : sc < -0.4 ? 'D' : sc > 0.4 ? 'R' : 'T'}">${esc(ratingWord(sc))}</span></td><td class="n">${status}</td><td class="n">${md == null ? '—' : `<span class="${marketLabel(r).side}">${marketLabel(r).side} ${pct(100 * marketLabel(r).p, 0)}</span>`}</td></tr>`; }).join('');
    R.innerHTML = `<h2>${type === 'S' ? 'Senate' : 'Governor'} watchlist</h2><div class="k">${rs.length} races rated lean or closer · click a state on the map or a race below</div><table class="tbl watch"><thead><tr><th>Race</th><th>Rating</th><th class="n">${night ? 'Result / polls' : 'Polls'}</th><th class="n">Market</th></tr></thead><tbody>${rows}</tbody></table>`;
    return;
  }
  const fips = S.st, abbr = ABBR[fips]; const rs = racesIn(fips, S.tab === 'H' ? null : S.tab).concat(S.tab === 'H' ? [] : racesIn(fips).filter((r) => r.type !== S.tab));
  let html = `<h2>${esc(B.names[fips])}</h2><div class="k">${esc(rs.map((r) => r.name).join(' · ') || 'No Senate or governor race in 2026')}</div>`;
  if (S.co) { const c = MAP.counties[S.co]; const b = B.c[S.co]; const m24 = countyMargin24(S.co); const res = countyRes(S.co);
    html += `<h3>${esc(c.name)}</h3><div class="kv"><span>2024 presidential</span><b class="${m24 >= 0 ? 'D' : 'R'}">${m24 == null ? '—' : (m24 >= 0 ? 'Harris' : 'Trump') + ' ' + sign(Math.abs(m24), 1)}</b>${b ? `<span>Votes, 2024</span><b>${fmt(b[2] || b[5])}</b>` : ''}${b && b[5] && b[2] ? `<span>2020 presidential</span><b class="${b[3] >= b[4] ? 'D' : 'R'}">${b[3] >= b[4] ? 'Biden' : 'Trump'} ${sign(Math.abs(100 * (b[3] - b[4]) / b[5]), 1)}</b>` : ''}${res && res.tot ? `<span>2026, counted</span><b class="${(res.d || 0) >= (res.r || 0) ? 'D' : 'R'}">${(res.d || 0) >= (res.r || 0) ? 'D' : 'R'} ${sign(Math.abs(100 * ((res.d || 0) - (res.r || 0)) / res.tot), 1)}</b><span>Expected vote in</span><b>${pct(res.pctIn, 0)}</b>` : ''}</div>${res && res.asOf ? `<div class="note">${ET(res.asOf)}${res.src ? ' · ' + esc(res.src) : ''}</div>` : ''}`; }
  if (S.tab === 'H') { const ds = (M.house.competitive || []).filter((d) => d.state === abbr); html += `<h3>Competitive House districts</h3>` + (ds.length ? houseTable(ds) : '<div class="note">None rated toss-up or lean by Cook.</div>'); }
  for (const r of rs) html += raceCard(r, true);
  html += earlyBlock(abbr);
  html += `<h3>Counties</h3>` + countyTable(fips);
  R.innerHTML = html;
}
function houseTable(ds) {
  return `<table class="tbl"><thead><tr><th>District</th><th>Candidates</th><th>Cook</th><th class="n">2024</th></tr></thead><tbody>${ds.map((d) => `<tr><td><button class="lnk" data-st="${FIPS_BY_ABBR[d.state] || ''}">${esc(d.district)}</button><br><span class="k">${d.open ? 'open' : esc(d.incumbent || '') + ' (' + esc(d.incumbentParty || '') + ')'}</span></td><td class="k">${esc((d.candidates || []).map((c) => c.name + ' (' + c.party + ')').join(' v '))}</td><td><span class="chip ${ratingScore(d.cook) == null ? '' : ratingScore(d.cook) < -0.4 ? 'D' : ratingScore(d.cook) > 0.4 ? 'R' : 'T'}">${esc(d.cook || d.sabato || '—')}</span></td><td class="n ${d.pres2024MarginDminusR >= 0 ? 'D' : 'R'}">${d.pres2024MarginDminusR == null ? '—' : (d.pres2024MarginDminusR >= 0 ? 'D' : 'R') + sign(Math.abs(d.pres2024MarginDminusR), 0)}</td></tr>`).join('')}</tbody></table>`;
}

/* ---------------------------------------------------------------- sections */
function renderEarly() {
  const E = M.early || {}; const n = E.national || {}; const states = E.states || {};
  $('#early-lede').innerHTML = E.lede ? esc(E.lede) : `Ballots already cast, from ${E.primarySource && E.primarySource.name ? esc(E.primarySource.name) : 'state election offices'} and the states that report daily. Party splits are by voter registration where a state has it, not by vote choice.`;
  const cards = [['Ballots cast', n.totalBallots, n.statesReporting ? n.statesReporting + ' states reporting' : ''], ['Mail ballots returned', n.mailReturned, n.mailRequested ? 'of ' + fmt(n.mailRequested) + ' requested' : ''], ['In person', n.inPerson, ''], ['Party, where known', n.byParty && n.byParty.D != null ? `<span class="D">${pct(100 * n.byParty.D / (n.byParty.D + n.byParty.R + (n.byParty.other || 0)), 0)}</span> / <span class="R">${pct(100 * n.byParty.R / (n.byParty.D + n.byParty.R + (n.byParty.other || 0)), 0)}</span>` : null, n.byParty && n.byParty.statesWithPartyData ? n.byParty.statesWithPartyData + ' states with registration data' : '']];
  $('#ev-cards').innerHTML = cards.map(([t, v, s]) => `<div class="card"><h3>${t}</h3><div class="big">${typeof v === 'string' ? v : fmt(v)}<small>${esc(s)}</small></div></div>`).join('');
  $('#ev-asof').textContent = (E.autoAsOf ? 'UF Election Lab file read ' + ET(E.autoAsOf) : n.asOf ? 'as of ' + ET(n.asOf) : E.asOf ? 'as of ' + E.asOf : '') + ' · each state\u2019s own date is in the last column · the two shares are UF\u2019s own ratios: ballots so far against the state\u2019s total 2022 turnout, and against its final 2024 early and mail vote';
  const order = Object.keys(states).filter((k) => states[k] && (states[k].totalBallots != null || states[k].earlyInPersonStart)).sort((a, b) => ((states[b].totalBallots || 0) - (states[a].totalBallots || 0)) || a.localeCompare(b));
  if (!order.length) { $('#ev-table').innerHTML = '<div class="empty">No state early-vote reports on file yet.</div>'; return; }
  $('#ev-table').innerHTML = `<table class="tbl"><thead><tr><th>State</th><th class="n">Ballots cast</th><th class="n">Mail</th><th class="n">In person</th><th>Party (registration)</th><th class="n" title="Ballots cast so far as a share of the state's total 2022 midterm turnout">% of 2022 turnout</th><th class="n" title="Ballots cast so far as a share of the state's final 2024 early and mail vote">% of 2024 early vote</th><th>As of</th></tr></thead><tbody>${order.map((k) => { const e = states[k]; const bp = e.byParty; const tot = bp && bp.D != null ? bp.D + bp.R + (bp.other || 0) : 0;
    return `<tr><td><button class="lnk" data-st="${FIPS_BY_ABBR[k] || ''}">${esc(B.names[FIPS_BY_ABBR[k]] || k)}</button></td><td class="n">${fmt(e.totalBallots)}</td><td class="n">${fmt(e.mailReturned)}</td><td class="n">${fmt(e.inPerson)}</td><td>${tot ? `<span class="bar" style="height:8px;width:120px;display:inline-flex;vertical-align:middle"><i style="width:${100 * bp.D / tot}%;background:var(--d)"></i><i style="width:${100 * (bp.other || 0) / tot}%;background:#5b6680"></i><i style="width:${100 * bp.R / tot}%;background:var(--r)"></i></span> <span class="k">D ${pct(100 * bp.D / tot, 0)} · R ${pct(100 * bp.R / tot, 0)}</span>` : '<span class="k">not reported</span>'}</td><td class="n">${e.pctOf2022Turnout != null ? pct(e.pctOf2022Turnout, 0) : '—'}</td><td class="n">${e.pctOf2024Final != null ? pct(e.pctOf2024Final, 0) : '—'}</td><td class="k">${esc(e.asOf || '')}${e.ufStatePage || e.source ? ` <a href="${esc(e.ufStatePage || e.source)}" target="_blank" rel="noopener" title="UF Election Lab">UF</a>` : ''}${e.officialSource && /^https?:/.test(e.officialSource) ? ` <a href="${esc(e.officialSource)}" target="_blank" rel="noopener" title="state source">state</a>` : ''}</td></tr>`; }).join('')}</tbody></table>${(E.headlines || []).length ? '<ul class="news" style="margin-top:10px">' + E.headlines.map((h) => `<li><span class="t">${esc(h.date || '')}</span><span>${esc(h.text)}${h.source ? ` <a href="${esc(h.source)}" target="_blank" rel="noopener">↗</a>` : ''}</span></li>`).join('') + '</ul>' : ''}`;
}
function renderPolls() {
  $('#polls-tabs').innerHTML = [['S', 'Senate'], ['G', 'Governors']].map(([k, t]) => `<button data-ptab="${k}" aria-pressed="${S.pollsTab === k}">${t}</button>`).join('');
  const rs = raceList(S.pollsTab).map((r) => ({ r, sc: consensus(r) })).sort((a, b) => (Math.abs(a.sc == null ? 0 : a.sc) - Math.abs(b.sc == null ? 0 : b.sc)) || a.r.name.localeCompare(b.r.name));
  $('#polls-lede').textContent = `Every ${S.pollsTab === 'S' ? 'Senate' : 'governor'} race, closest first: the three major ratings, the polling average where one exists, the latest poll, the prediction market and The Hinge's forecast for the races it models.`;
  $('#polls-table').innerHTML = `<table class="tbl"><thead><tr><th>Race</th><th>Candidates</th><th>Cook</th><th>Sabato</th><th>Inside</th><th class="n">Poll avg</th><th>Latest poll</th><th class="n">Market</th><th class="n">Hinge</th></tr></thead><tbody>${rs.map(({ r }) => { const R = r.ratings || {}; const pm = pollMargin(r); const p = (r.polls || [])[0]; const md = marketD(r); const h = M.hinge && M.hinge[r.id];
    const chip = (s) => s ? `<span class="chip ${ratingScore(s) == null ? '' : ratingScore(s) < -0.4 ? 'D' : ratingScore(s) > 0.4 ? 'R' : 'T'}">${esc(s)}</span>` : '<span class="k">—</span>';
    return `<tr><td><button class="lnk" data-st="${r.fips}">${esc(r.name)}</button></td><td class="k">${esc(r.cands.filter((c) => 'DRI'.includes(c.p)).map((c) => c.n + ' (' + c.p + ')' + (c.inc ? '*' : '')).join(' v '))}</td><td>${chip(R.cook)}</td><td>${chip(R.sabato)}</td><td>${chip(R.inside)}</td><td class="n ${pm == null ? 'k' : pm >= 0 ? 'D' : 'R'}">${pm == null ? '—' : (pm >= 0 ? 'D' : 'R') + sign(Math.abs(pm), 1)}${r.avg && r.avg.d != null ? `<br><span class="k">${pct(r.avg.d, 0)}–${pct(r.avg.r, 0)}</span>` : ''}</td><td class="k">${p ? `${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.pollster)}</a>` : esc(p.pollster)} ${esc((p.end || '').slice(5))}: <span class="${p.d - p.r >= 0 ? 'D' : 'R'}">${p.d - p.r >= 0 ? 'D' : 'R'}${sign(Math.abs(p.d - p.r), 0)}</span>` : '—'}</td><td class="n">${md == null ? '—' : `<span class="${marketLabel(r).side}">${marketLabel(r).side} ${pct(100 * marketLabel(r).p, 0)}</span>`}</td><td class="n">${h == null ? '—' : `<span class="${h >= 0.5 ? 'D' : 'R'}">${h >= 0.5 ? 'D' : 'R'} ${pct(100 * (h >= 0.5 ? h : 1 - h), 0)}</span>`}</td></tr>`; }).join('')}</tbody></table><div class="note">* incumbent. Ratings as of the dates in each source; poll average from ${esc((rs.find(({ r }) => r.avg && r.avg.src) || { r: { avg: { src: 'the aggregator named in each race' } } }).r.avg.src)}. Markets: Kalshi or Polymarket, the venue with more volume.</div>`;
}
function renderHouse() {
  const H = M.house || {}; const rt = H.ratings || []; const gb = H.gb || {};
  $('#house-lede').textContent = H.notes || 'All 435 seats are up. Republicans hold a narrow majority; the ratings below count how many seats each forecaster puts in each column.';
  $('#house-ratings-asof').textContent = rt.length ? 'as of ' + rt.map((x) => x.source + ' ' + (x.asOf || '')).join(' · ') : '';
  $('#house-ratings').innerHTML = rt.length ? `<table class="tbl"><thead><tr><th>Source</th><th class="n D">Solid D</th><th class="n D">Likely D</th><th class="n D">Lean D</th><th class="n T">Toss-up</th><th class="n R">Lean R</th><th class="n R">Likely R</th><th class="n R">Solid R</th><th class="n">D / R</th></tr></thead><tbody>${rt.map((x) => `<tr><td>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.source)}</a>` : esc(x.source)}</td><td class="n">${fmt(x.solidD)}</td><td class="n">${fmt(x.likelyD)}</td><td class="n">${fmt(x.leanD)}</td><td class="n T">${fmt(x.tossup)}</td><td class="n">${fmt(x.leanR)}</td><td class="n">${fmt(x.likelyR)}</td><td class="n">${fmt(x.solidR)}</td><td class="n"><span class="D">${(x.solidD || 0) + (x.likelyD || 0) + (x.leanD || 0)}</span> / <span class="R">${(x.solidR || 0) + (x.likelyR || 0) + (x.leanR || 0)}</span></td></tr>`).join('')}</tbody></table>` : '<div class="empty">No ratings on file.</div>';
  const bal = M.balance.house && M.balance.house.current; if (bal) $('#house-ratings').insertAdjacentHTML('beforeend', `<div class="note" style="margin-top:8px">Current House: <span class="R">${bal.R} R</span>, <span class="D">${bal.D} D</span>${bal.I ? ', ' + bal.I + ' independent' : ''}${bal.vacant ? ', ' + bal.vacant + ' vacant' : ''}${bal.asOf ? ' (' + esc(bal.asOf) + ')' : ''}. 218 is a majority.</div>`);
  const polls = (gb.polls || []).slice(0, 10);
  $('#gb-asof').textContent = gb.avg && gb.avg.src ? gb.avg.src + (gb.avg.asOf ? ' · ' + gb.avg.asOf : '') : '';
  $('#gb').innerHTML = (gb.avg && gb.avg.d != null ? `<div class="big"><span class="${gb.avg.d - gb.avg.r >= 0 ? 'D' : 'R'}" style="color:${gb.avg.d - gb.avg.r >= 0 ? 'var(--d2)' : 'var(--r2)'}">${gb.avg.d - gb.avg.r >= 0 ? 'D' : 'R'} ${sign(Math.abs(gb.avg.d - gb.avg.r), 1)}</span><small>average: D ${pct(gb.avg.d, 1)}, R ${pct(gb.avg.r, 1)}</small></div>` : '') + (polls.length ? `<table class="tbl" style="margin-top:8px"><thead><tr><th>Poll</th><th>Dates</th><th class="n">D</th><th class="n">R</th><th class="n">Margin</th></tr></thead><tbody>${polls.map((p) => `<tr><td>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.pollster)}</a>` : esc(p.pollster)}<br><span class="k">${p.n ? fmt(p.n) + ' ' + esc(p.pop || '') : ''}</span></td><td class="k">${dates(p.start, p.end)}</td><td class="n D">${pct(p.d, 0)}</td><td class="n R">${pct(p.r, 0)}</td><td class="n ${p.d - p.r >= 0 ? 'D' : 'R'}">${p.d - p.r >= 0 ? 'D' : 'R'}${sign(Math.abs(p.d - p.r), 0)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No generic-ballot polls on file.</div>');
  const comp = H.competitive || []; $('#house-comp-asof').textContent = comp.length ? comp.length + ' districts' : '';
  $('#house-comp').innerHTML = comp.length ? houseTable(comp) : '<div class="empty">No district list on file.</div>';
}
function renderMarkets() {
  const K = M.markets || {}; const rows = [];
  if (K.senate) rows.push({ name: 'Senate control', D: K.senate.D, R: K.senate.R, venue: K.senate.venue, url: K.senate.url, kalshi: K.senate.kalshi, asOf: K.senate.asOf });
  if (K.house) rows.push({ name: 'House control', D: K.house.D, R: K.house.R, venue: K.house.venue, url: K.house.url, kalshi: K.house.kalshi, asOf: K.house.asOf });
  for (const id in (K.races || {})) { const r = M.races[id]; if (!r) continue; const k = K.races[id]; rows.push({ name: r.name, D: k.D, R: k.R, I: k.I, venue: k.venue, url: k.url, fips: r.fips, asOf: k.asOf, kalshi: k.kalshi }); }
  $('#markets-lede').textContent = `Prices from Kalshi and Polymarket, read from their public APIs${K.asOf ? ' at ' + ET(K.asOf) : ''}. A price is the market's implied chance, not a forecast; thin markets move on small trades.`;
  $('#markets-table').innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>Market</th><th class="n D">Democrat</th><th class="n R">Republican</th><th>Venue</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${x.fips ? `<button class="lnk" data-st="${x.fips}">${esc(x.name)}</button>` : esc(x.name)}</td><td class="n D">${x.D == null ? '—' : pct(100 * x.D, 0)}${x.I != null ? ` <span class="I">· I ${pct(100 * x.I, 0)}</span>` : ''}</td><td class="n R">${x.R == null ? '—' : pct(100 * x.R, 0)}</td><td class="k">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.venue || 'market')}</a>` : esc(x.venue || '')}${x.kalshi && x.kalshi.D != null ? ` · <a href="${esc(x.kalshi.url || '#')}" target="_blank" rel="noopener">Kalshi</a> D ${pct(100 * x.kalshi.D, 0)}` : ''}${x.asOf ? ' · ' + ET(x.asOf, { month: 'short', day: 'numeric', hour: 'numeric' }) : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No market prices on file.</div>';
}
function renderFeed() {
  const N = M.news || {}; const items = (N.items || []).slice(0, 40);
  $('#feed-lede').textContent = `Headlines from the news feeds the desk reads${N.asOf ? ', last pulled ' + ET(N.asOf) : ''}; the calendar lists what is left before and after Election Day. Nothing here is edited: titles are the outlets' own.`;
  $('#news-asof').textContent = N.asOf ? ET(N.asOf) : '';
  $('#news').innerHTML = items.length ? items.map((n) => `<li><span class="t">${ET(n.t, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span><span><a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a><small>${esc(n.source)}${n.scope && n.scope !== 'national' ? ' · ' + esc(n.scope) : ''}</small></span></li>`).join('') : '<li class="empty">No headlines pulled yet.</li>';
  const cal = (M.calendar || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const closes = Object.entries(M.close || {}).sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
  const byTime = {}; for (const [st, t] of closes) (byTime[t] = byTime[t] || []).push(st);
  $('#calendar').innerHTML = (cal.length ? `<ul class="news">${cal.map((c) => `<li><span class="t">${esc(c.date)}</span><span>${esc(c.text)}${c.source ? ` <a href="${esc(c.source)}" target="_blank" rel="noopener">↗</a>` : ''}</span></li>`).join('')}</ul>` : '') + (closes.length ? `<h3 style="margin-top:12px">Polls close, Nov. 3 (Eastern)</h3><div class="kv">${Object.keys(byTime).sort().map((t) => `<span>${esc(t)}</span><b>${esc(byTime[t].join(' '))}</b>`).join('')}</div><div class="note">Where a state spans time zones, the last close is shown.</div>` : '');
}
function renderFoot() {
  const m = M.meta; const srcs = m.sources || [];
  $('#foot').innerHTML = `<h3>About this desk</h3>${(m.about || []).map((p) => `<p>${esc(p)}</p>`).join('')}
  <p>Last update ${ET(m.updated)} · built ${ET(m.built)} · <a href="data/model.json">data</a> · <a href="../the-hinge/">The Hinge</a></p>
  ${srcs.length ? `<details class="srcs"><summary>Sources (${srcs.length})</summary><ul>${srcs.map((s) => `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name)}${s.note ? ': ' + esc(s.note) : ''}</li>`).join('')}</ul></details>` : ''}
  ${(m.runlog || []).length ? `<details class="srcs"><summary>Update log</summary><div class="runlog">${esc(m.runlog.slice(-30).join('\n'))}</div></details>` : ''}`;
}

/* ---------------------------------------------------------------- render all + events */
function renderAll() { renderHeader(); renderBOP(); renderAlert(); renderModes(); legend(); renderCrumb(); MAP.draw(); renderRail(); renderEarly(); renderPolls(); renderHouse(); renderMarkets(); renderFeed(); renderFoot(); }
function setTab(t) { S.tab = t; $$('.nav [data-tab]').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === t)); S.pollsTab = t === 'G' ? 'G' : 'S'; renderModes(); legend(); MAP.draw(); renderRail(); renderPolls(); }
document.addEventListener('click', (e) => {
  const b = e.target.closest('button,a'); if (!b) return;
  if (b.dataset.tab) { setTab(b.dataset.tab); $('.wall').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  else if (b.dataset.go) { const el = document.getElementById(b.dataset.go === 'polls' ? 'polls' : b.dataset.go); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  else if (b.dataset.mode) { S.mode = b.dataset.mode; renderModes(); legend(); MAP.recolor(); renderRail(); }
  else if (b.dataset.level === 'us') goUS();
  else if (b.dataset.level === 'st') { S.co = null; MAP.setView({ level: 'st', st: S.st }); renderCrumb(); renderRail(); }
  else if (b.dataset.st !== undefined) { if (b.dataset.st) { goState(b.dataset.st); $('.wall').scrollIntoView({ block: 'start', behavior: 'smooth' }); } }
  else if (b.dataset.co) { goCounty(b.dataset.co); }
  else if (b.dataset.ptab) { S.pollsTab = b.dataset.ptab; renderPolls(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (S.co) { S.co = null; MAP.setView({ level: 'st', st: S.st }); renderCrumb(); renderRail(); } else if (S.st) goUS(); } });

/* ---------------------------------------------------------------- live refresh (same-origin data file, cache-busted) */
let lastUpdated = M.meta.updated;
async function refresh() {
  if (!/^https?:$/.test(location.protocol)) return;
  try { const r = await fetch('data/model.json?cb=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; const next = await r.json(); if (!next || !next.meta || next.meta.updated === lastUpdated) return; M = next; lastUpdated = M.meta.updated; renderAll(); }
  catch (e) { /* offline or not served: keep the snapshot */ }
}
setInterval(refresh, isNight() ? 60000 : 600000); setTimeout(refresh, 1500);
setInterval(renderHeader, 60000);
renderAll();
