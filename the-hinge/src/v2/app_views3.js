/* =========================================================== v2: markets, history, information age, the blended call */
const MKD = D.markets || { rows: [], history: [], track: [], studies: [], landscape: [] };
const H2 = D.hist2 || null;
const INFO = D.info || null;
const VENUES = ['Kalshi', 'Polymarket', 'PredictIt'];
const MK_TIMEOUT = 7000, MK_EVERY = 5 * 60 * 1000;

/* ---------- market state: the snapshot baked in at build time, overwritten by live reads when the APIs answer */
const MK = {
  live: {},          // id -> venue -> { p, at }
  hist: {},          // id -> venue -> [[iso, p]]
  status: {},        // venue -> 'live' | 'snapshot' | 'blocked'
  lastTry: null, timer: null, busy: false,
};
// prices read live in an earlier visit are kept in this browser and shown as "cached" until the exchanges answer again
(function restoreMk() {
  const c = LS.get('mkCache', null);
  if (c && c.live) { MK.cache = c.live; MK.cachedAt = c.at; }
})();
const mkRow = (id) => MKD.rows.find((r) => r.id === id);
function mkVenue(id, venue) {
  const L = MK.live[id] && MK.live[id][venue];
  const C = MK.cache && MK.cache[id] && MK.cache[id][venue];
  const row = mkRow(id); const snap = row && row.venues && row.venues[venue];
  const snapAt = (snap && snap.at) || MKD.asOf || '';
  if (L && typeof L.p === 'number') return { p: L.p, at: L.at, live: true, url: snap && snap.url };
  if (C && typeof C.p === 'number' && String(C.at) > String(snapAt)) return { p: C.p, at: C.at, live: false, cached: true, url: snap && snap.url };
  if (snap && typeof snap.p === 'number') return { p: snap.p, at: snapAt, live: false, url: snap.url };
  return null;
}
// average across venues that have a price; returns { p, n, venues: [{venue,p,live}] }
function mkAvg(id) {
  const out = [];
  for (const v of VENUES) { const x = mkVenue(id, v); if (x) out.push(Object.assign({ venue: v }, x)); }
  if (!out.length) return null;
  return { p: out.reduce((a, b) => a + b.p, 0) / out.length, n: out.length, venues: out, anyLive: out.some((o) => o.live), anyCached: out.some((o) => o.cached), latestAt: out.map((o) => String(o.at || '')).sort().pop() };
}

async function fetchJSON(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), MK_TIMEOUT);
  try { const r = await fetch(url, { signal: ctl.signal, mode: 'cors', cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
const num = (v) => { const n = typeof v === 'string' ? parseFloat(v) : v; return typeof n === 'number' && isFinite(n) ? n : null; };
// Kalshi reports cents (0–100) in older fields and dollars (0–1) in *_dollars fields
function kalshiProb(m) {
  if (!m) return null;
  const bid = num(m.yes_bid_dollars) ?? (num(m.yes_bid) != null ? num(m.yes_bid) / 100 : null);
  const ask = num(m.yes_ask_dollars) ?? (num(m.yes_ask) != null ? num(m.yes_ask) / 100 : null);
  const last = num(m.last_price_dollars) ?? (num(m.last_price) != null ? num(m.last_price) / 100 : null);
  if (bid != null && ask != null && ask > 0 && ask - bid <= 0.1) return (bid + ask) / 2;
  return last;
}
// Polymarket: the Gamma market endpoint (what polymarket.com itself reads), then the order-book midpoint as a fallback
async function mkPolymarket(row) {
  const pm = row.ids && row.ids.polymarket; if (!pm) return null;
  let p = null;
  if (pm.slug) {
    try {
      const j = await fetchJSON('https://gamma-api.polymarket.com/markets?slug=' + encodeURIComponent(pm.slug));
      const m = Array.isArray(j) ? j[0] : j && j.markets ? j.markets[0] : j;
      if (m) {
        const bid = num(m.bestBid), ask = num(m.bestAsk);
        let prices = m.outcomePrices; if (typeof prices === 'string') { try { prices = JSON.parse(prices); } catch (e) { prices = null; } }
        p = bid != null && ask != null && ask > 0 && ask - bid <= 0.1 ? (bid + ask) / 2 : num(prices && prices[0]) ?? num(m.lastTradePrice);
      }
    } catch (e) { p = null; }
  }
  if (p == null && pm.token) {
    const j = await fetchJSON('https://clob.polymarket.com/midpoint?token_id=' + encodeURIComponent(pm.token));
    p = num(j && (j.mid ?? j.midpoint));
  }
  return p == null ? null : (pm.invert ? 1 - p : p);
}
async function mkKalshi(row) {
  const k = row.ids && row.ids.kalshi; if (!k || !k.ticker) return null;
  const j = await fetchJSON('https://api.elections.kalshi.com/trade-api/v2/markets/' + encodeURIComponent(k.ticker));
  const p = kalshiProb(j && j.market); return p == null ? null : (k.invert ? 1 - p : p);
}
async function mkPredictIt(row) {
  const k = row.ids && row.ids.predictit; if (!k || !k.market) return null;
  const j = await fetchJSON('https://www.predictit.org/api/marketdata/markets/' + encodeURIComponent(k.market));
  const c = (j && j.contracts || []).find((x) => String(x.id) === String(k.contract) || (k.name && x.name === k.name));
  const p = c ? num(c.lastTradePrice) : null; return p == null ? null : (k.invert ? 1 - p : p);
}
const MK_FETCH = { Polymarket: mkPolymarket, Kalshi: mkKalshi, PredictIt: mkPredictIt };

async function mkRefresh(manual) {
  if (MK.busy) return; MK.busy = true; MK.lastTry = new Date();
  const ok = { Kalshi: 0, Polymarket: 0, PredictIt: 0 }, tried = { Kalshi: 0, Polymarket: 0, PredictIt: 0 };
  const jobs = [];
  for (const row of MKD.rows) for (const v of VENUES) {
    const f = MK_FETCH[v]; if (!f) continue;
    const has = row.ids && row.ids[v.toLowerCase()]; if (!has) continue;
    tried[v]++;
    jobs.push(f(row).then((p) => { if (p != null && p >= 0 && p <= 1) { (MK.live[row.id] = MK.live[row.id] || {})[v] = { p, at: new Date().toISOString() }; ok[v]++; } }).catch(() => { }));
  }
  const before = JSON.stringify(RES && RES.blend ? Object.values(RES.blend).map((b) => Math.round(b.p * 1000)) : []);
  await Promise.all(jobs);
  for (const v of VENUES) MK.status[v] = ok[v] ? 'live' : (tried[v] || MKD.rows.some((r) => r.venues && r.venues[v])) ? 'snapshot' : 'none';
  if (Object.values(ok).some(Boolean)) LS.set('mkCache', { at: new Date().toISOString(), live: Object.assign({}, MK.cache || {}, MK.live) });
  MK.busy = false;
  computeBlend(); renderHero();
  const after = JSON.stringify(RES && RES.blend ? Object.values(RES.blend).map((b) => Math.round(b.p * 1000)) : []);
  // redraw the open tab only when something it shows has changed (and never under an open drawer)
  if ((ACTIVE === 'markets' || ((ACTIVE === 'brief') && before !== after)) && !(DRAWER && document.getElementById('drawer').classList.contains('on'))) rerenderView();
  if (manual) toast(Object.values(ok).some(Boolean) ? 'Market prices updated' : 'The exchanges did not answer. Showing the Oct 11 snapshot.');
}
async function mkHistory(id) {
  const row = mkRow(id); const pm = row && row.ids && row.ids.polymarket;
  if (!pm || !pm.token || (MK.hist[id] && MK.hist[id].Polymarket)) return;
  MK.histTried = MK.histTried || {}; if (MK.histTried[id]) return; MK.histTried[id] = true;
  try {
    const j = await fetchJSON('https://clob.polymarket.com/prices-history?market=' + encodeURIComponent(pm.token) + '&interval=max&fidelity=1440');
    const pts = (j && j.history || []).map((q) => [new Date(q.t * 1000).toISOString().slice(0, 10), pm.invert ? 1 - q.p : q.p]).filter((q) => q[1] != null);
    if (pts.length > 3) { (MK.hist[id] = MK.hist[id] || {}).Polymarket = pts; if (ACTIVE === 'markets') rerenderView(); }
  } catch (e) { /* stays on the snapshot series */ }
}
function mkStart() {
  if (!MKD.rows.length) return;
  mkRefresh(false);
  clearInterval(MK.timer);
  MK.timer = setInterval(() => { if (document.visibilityState === 'visible') mkRefresh(false); }, MK_EVERY);
}

/* ---------- the history-only forecast: bread (income), peace (war) and the president's standing */
function fundInputs() {
  const now = (H2 && H2.now) || {};
  return {
    approval: S.fApproval ?? now.approval ?? 40,
    income: S.fIncome ?? now.income ?? 1,
    war: S.fWar ?? now.war ?? 0,
    inflation: S.fInflation ?? now.inflation ?? 3,
  };
}
// regressors, in the same units the build script used to fit the model
const FX = {
  app: (i) => i.approval - 50,                       // presidential approval minus 50
  inc: (i) => i.income,                              // real disposable income per person, % change over the year
  infl: (i) => i.inflation,                          // CPI inflation, % over the year
  war: (i) => (i.war ? 1 : 0),                       // a war with heavy U.S. losses (hundreds or more combat deaths that year)
  prev: () => H2.now.vPrev - 50,                     // the president's party's share two years earlier, minus 50
};
// predicted change in the president's party's two-party House vote, with a prediction interval
function fundPredict(inp) {
  if (!H2 || !H2.model) return null;
  const M = H2.model; const x = { const: 1 };
  M.keys.forEach((k) => { x[k] = FX[k](inp); });
  return predictWith(M, x);
}
function predictWith(M, x) {
  let mu = M.coef.const; M.keys.forEach((k) => { mu += M.coef[k] * x[k]; });
  // prediction variance = x' Σ x + σ² (Σ = coefficient covariance)
  const keys = ['const'].concat(M.keys);
  let q = 0; keys.forEach((a, i) => keys.forEach((b, j) => { q += x[a] * x[b] * M.cov[i][j]; }));
  return { dV: mu, sd: Math.sqrt(Math.max(0, q) + M.sigma * M.sigma), x };
}
function fundMargin(pred) {
  // president's party = R in 2026; its 2024 two-party House share is vPrev
  const prevR = H2.now.vPrev; const rShare = prevR + pred.dV;
  return { rShare, dMargin: 100 - 2 * rShare, sdMargin: 2 * pred.sd };
}
function runFund() {
  if (!H2 || !H2.model) return null;
  const inp = fundInputs(); const pred = fundPredict(inp);
  if (!pred) return null;
  const mg = fundMargin(pred);
  // re-run the race-by-race engine with polls set aside and the national environment set by history
  // national error = the regression's prediction error (in margin points); no extra drift, it is already an Election Day error
  const s = Object.assign({}, RES.s, { nSims: 4000, sigmaNat: mg.sdMargin, sigmaNatDrift: 0, envShift: 0, tailDf: 0, seed: (RES.s.seed || 1) + 7 });
  const ctx = { s, asOf: RES.asOf, envAdj: mg.dMargin, daysLeft: RES.daysLeft, gbBaseline: D.house.gbBaseline, ignorePolls: true };
  const ests = D.races.map((r) => E.raceEstimate(r, [], ctx));
  const dists = D.house.battlefield.map((d) => E.districtEstimate(d, { s, envAdj: mg.dMargin, gbBaseline: D.house.gbBaseline }));
  // the regression's own error is national: shrink race-level noise so we don't count it twice
  ests.forEach((e) => { e.sigPost = Math.min(e.sigPost, 7); });
  const sim = E.simulate({ races: ests, districts: dists, senateBase: D.senateBase, houseBase: { D: D.house.solid.D }, regions: REGIONS }, s, {});
  const byId = {}; ests.forEach((e, i) => { byId[e.race.id] = sim.races[i]; });
  return { inp, pred, mg, sim, byId };
}

/* ---------- the blend */
const W = () => { const w = { polls: +S.wPolls, markets: +S.wMarkets, fund: +S.wFund }; return w; };
function modelP(id, R) {
  if (!R) return null;
  if (id === 'HOUSE') return R.sim.house.pD;
  if (id === 'SENATE') return R.sim.senate.pD + 0.5 * R.sim.senate.pHung;
  const o = R.byId[id]; return o ? (o.out ? o.out.pD : o.pD) : null;
}
function fundP(id) {
  const F = RES.fund; if (!F) return null;
  if (id === 'HOUSE') return F.sim.house.pD;
  if (id === 'SENATE') return F.sim.senate.pD + 0.5 * F.sim.senate.pHung;
  return F.byId[id] ? F.byId[id].pD : null;
}
function blendOf(id) {
  const w = W(); const parts = [];
  const pp = modelP(id, RES); if (pp != null) parts.push({ k: 'polls', label: 'Polls', p: pp, w: w.polls });
  const m = mkAvg(id); if (m) parts.push({ k: 'markets', label: 'Markets', p: m.p, w: w.markets, live: m.anyLive, cached: m.anyCached, at: m.latestAt, n: m.n });
  const f = fundP(id); if (f != null) parts.push({ k: 'fund', label: 'History', p: f, w: w.fund });
  const tw = parts.reduce((a, b) => a + b.w, 0);
  const p = tw > 0 ? parts.reduce((a, b) => a + b.w * b.p, 0) / tw : (pp ?? 0.5);
  return { id, p, parts, tw };
}
function computeBlend() {
  if (!RES) return;
  const ids = ['HOUSE', 'SENATE', D.ohio.govId, D.ohio.senId].concat(D.races.filter((r) => r.tier && r.tier < 3 && r.office === 'Senate').map((r) => r.id));
  const out = {}; ids.forEach((id) => { out[id] = blendOf(id); });
  RES.blend = out;
}
function runExtras() {
  try { RES.fund = runFund(); } catch (e) { console.error(e); RES.fund = null; }
  computeBlend();
}

/* ---------- hero: above the waterline the blended call, below it the markets' reflection */
function renderHero() {
  if (!RES || !RES.blend) return;
  const gov = raceById[D.ohio.govId];
  const items = [
    { id: 'HOUSE', who: 'House', dName: 'Democrats', rName: 'Republicans', why: () => `Polls model median ${Math.round(RES.sim.house.med)} Democratic seats; 218 wins the majority.` },
    { id: 'SENATE', who: 'Senate', dName: 'Democrats', rName: 'Republicans', why: () => RES.sim.senate.pHung > 0.02 ? `In ${fp(RES.sim.senate.pHung)} of simulations control rests with Dan Osborn; counted half each way.` : 'Republicans keep control at 50 seats; Democrats need 51.' },
    { id: D.ohio.govId, who: 'Ohio governor', dName: (gov && gov.dem || 'Democrat').split(' ').slice(-1)[0], rName: (gov && gov.rep || 'Republican').split(' ').slice(-1)[0], why: () => 'Open seat: ' + (gov ? gov.dem + ' (D) vs ' + gov.rep + ' (R)' : '') + '.' },
  ];
  const calls = $('#calls'), refl = $('#reflect'); if (!calls || !refl) return;
  calls.replaceChildren(...items.map((it) => {
    const b = RES.blend[it.id]; if (!b) return el('div');
    const dSide = b.p >= 0.5, p = dSide ? b.p : 1 - b.p;
    const close = Math.abs(b.p - 0.5) < 0.05;
    return el('div', { class: 'call' },
      el('div', { class: 'who', text: it.who }),
      el('div', { class: 'big' }, el('b', { text: Math.round(p * 100) + '%' }), el('span', null, el('i', { style: 'background:' + (dSide ? PAL.dem : PAL.rep) }), ' ', dSide ? it.dName : it.rName)),
      el('div', { class: 'why', text: (close ? 'A toss-up. ' : '') + it.why() }));
  }));
  refl.replaceChildren(...items.map((it) => {
    const b = RES.blend[it.id]; if (!b) return el('div');
    const m = b.parts.find((x) => x.k === 'markets'), pl = b.parts.find((x) => x.k === 'polls'), fu = b.parts.find((x) => x.k === 'fund');
    const ghostP = m ? m.p : b.p; const gSide = ghostP >= 0.5;
    const pct = (x) => Math.round((x >= 0.5 ? x : 1 - x) * 100) + '% ' + (x >= 0.5 ? it.dName : it.rName);
    return el('div', null,
      el('div', { class: 'ghost', 'aria-hidden': 'true', text: Math.round((gSide ? ghostP : 1 - ghostP) * 100) + '%' }),
      el('div', { class: 'read' },
        m ? [el('b', { text: 'Markets ' + pct(m.p) }), el('br')] : [el('b', { text: 'No market price' }), el('br')],
        el('span', { class: 'src', text: [pl ? 'Polls ' + pct(pl.p) : null, fu ? 'history ' + pct(fu.p) : null].filter(Boolean).join(', ') })),
      m ? el('div', { class: 'live' + (m.live ? '' : ' off') }, el('i'), mkStamp(m)) : null);
  }));
}

/* ---------- shared bits */
function mkStamp(m) {
  const t = (iso) => { try { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
  if (m.live) return 'Live prices, ' + t(m.at);
  if (m.cached) return 'Prices read ' + t(m.at);
  return 'Snapshot, ' + fdy((MKD.asOf || BASE_DATE).slice(0, 10));
}
const pctD = (p) => (p == null ? '—' : Math.round(p * 100) + '%');
function probTrack(parts, total, o = {}) {
  // a 0–100 track per witness; the middle line is the waterline (50%)
  const rows = parts.map((c) => el('div', { class: 'comp' },
    el('span', { class: 'lbl', text: c.label + (c.k === 'markets' && c.live ? ' (live)' : '') }),
    el('span', { class: 'trk' }, el('span', { class: 'mid' }), el('span', { class: 'pt', style: `left:${(c.p * 100).toFixed(1)}%;background:${c.p >= 0.5 ? (o.dColor || PAL.dem) : PAL.rep};opacity:.75` })),
    el('span', { class: 'val', text: pctD(c.p) })));
  rows.push(el('div', { class: 'comp total' },
    el('span', { class: 'lbl', text: 'Blend' }),
    el('span', { class: 'trk' }, el('span', { class: 'mid' }), el('span', { class: 'pt', style: `left:${(total * 100).toFixed(1)}%;background:${total >= 0.5 ? (o.dColor || PAL.dem) : PAL.rep}` })),
    el('span', { class: 'val', text: pctD(total) })));
  return rows;
}
function callCard() {
  const w = W(); const tw = w.polls + w.markets + w.fund || 1;
  const box = (id, title, dl) => {
    const b = RES.blend[id]; if (!b) return el('div');
    const race = raceById[id];
    return el('div', null, el('h4', { text: title }), el('div', { class: 'note', style: 'margin:-4px 0 6px', text: 'Chance ' + dl + ' win' }), probTrack(b.parts, b.p, { dColor: race && race.dSideInd ? PAL.ind : PAL.dem }));
  };
  const gov = raceById[D.ohio.govId];
  return el('div', { class: 'card' },
    el('h3', { text: 'The call: three witnesses, one verdict' }),
    el('p', { class: 'sub' }, `Each forecast is a weighted vote of the polls model (${Math.round(100 * w.polls / tw)}%), the prediction markets (${Math.round(100 * w.markets / tw)}%) and a history-only model built on approval, real income and war (${Math.round(100 * w.fund / tw)}%). The centre line on each track is 50%. Change the weights in `, el('a', { href: '#', onclick: (e) => { e.preventDefault(); openSettings(); } }, 'Model settings'), '.'),
    el('div', { class: 'blend' }, box('HOUSE', 'House', 'Democrats'), box('SENATE', 'Senate', 'Democrats'), box(D.ohio.govId, 'Ohio governor', gov ? gov.dem.split(' ').slice(-1)[0] + ' (D)' : 'the Democrat')));
}

/* ---------- scatter: one point per election, optional fit line and a projected point */
function drawScatter(host, o) {
  const F = frame(host, o.height || 300, { t: 18, r: 18, b: 40, l: 48 });
  const xs = o.pts.map((p) => p.x).concat(o.proj ? [o.proj.x] : []), ys = o.pts.map((p) => p.y).concat(o.proj ? [o.proj.lo ?? o.proj.y, o.proj.hi ?? o.proj.y] : []);
  const x0 = o.xMin ?? Math.min(...xs), x1 = o.xMax ?? Math.max(...xs), padX = (x1 - x0) * 0.06 || 1;
  const y0 = o.yMin ?? Math.min(...ys), y1 = o.yMax ?? Math.max(...ys), padY = (y1 - y0) * 0.08 || 1;
  const x = scale(x0 - padX, x1 + padX, F.m.l, F.m.l + F.iw), y = scale(y0 - padY, y1 + padY, F.m.t + F.ih, F.m.t);
  const g = sv('g'); F.svg.append(g);
  ticks(y0 - padY, y1 + padY, 5).forEach((t) => { hline(g, F.m.l, F.m.l + F.iw, y(t), t === 0 ? PAL.axis : PAL.grid, t === 0 ? 1.4 : 1); txt(g, F.m.l - 6, y(t) + 3, o.yFmt ? o.yFmt(t) : t, { 'text-anchor': 'end' }); });
  ticks(x0 - padX, x1 + padX, 6).forEach((t) => { vline(g, x(t), F.m.t, F.m.t + F.ih, PAL.grid); txt(g, x(t), F.h - 22, o.xFmt ? o.xFmt(t) : t, { 'text-anchor': 'middle' }); });
  if (o.xLabel) txt(g, F.m.l + F.iw / 2, F.h - 4, o.xLabel, { 'text-anchor': 'middle', class: 'lbl' });
  if (o.yLabel) txt(g, F.m.l + 4, F.m.t + 10, o.yLabel, { class: 'lbl' });
  if (o.fit) {
    const a = o.fit.a, b = o.fit.b, xa = x0 - padX * 0.5, xb = x1 + padX * 0.5;
    g.append(sv('line', { x1: x(xa), x2: x(xb), y1: y(a + b * xa), y2: y(a + b * xb), stroke: PAL.ink2, 'stroke-width': 1.5, 'stroke-dasharray': '5 4', opacity: 0.7, 'pointer-events': 'none' }));
  }
  // dots first; labels are placed afterwards so they can dodge each other
  const dots = o.pts.map((p) => ({ p, cx: x(p.x), cy: y(p.y) }));
  dots.forEach(({ p, cx, cy }) => {
    if (p.ring) g.append(sv('circle', { cx, cy, r: 9, fill: 'none', stroke: p.color, 'stroke-width': 1.5, opacity: 0.8 }));
    g.append(sv('circle', { cx, cy, r: 5, fill: p.color, stroke: PAL.surface, 'stroke-width': 1.5 }));
    const hit = sv('circle', { cx, cy, r: 12, fill: 'transparent' }); g.append(hit);
    if (p.tip) hoverable(hit, p.tip);
  });
  const placed = [];   // label boxes already on the chart: [x0, y0, x1, y1]
  const hitsAny = (b, list) => list.some((q) => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]);
  const inside = (b) => b[0] >= F.m.l - 2 && b[2] <= F.m.l + F.iw + 16 && b[1] >= F.m.t - 6 && b[3] <= F.m.t + F.ih + 4;
  if (o.proj) {
    const P = o.proj, cx = x(P.x), cy = y(P.y), lab = P.label || '2026', w = lab.length * 7;
    if (P.lo != null) g.append(sv('line', { x1: cx, x2: cx, y1: y(P.lo), y2: y(P.hi), stroke: PAL.amber, 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.35 }));
    g.append(sv('circle', { cx, cy, r: 7, fill: PAL.surface, stroke: PAL.amber, 'stroke-width': 3 }));
    txt(g, cx - 12, cy + 4, lab, { class: 'lbl-strong', 'text-anchor': 'end' });
    placed.push([cx - 12 - w, cy - 7, cx - 10, cy + 6], [cx - 9, cy - 9, cx + 9, cy + 9]);
    const hit = sv('circle', { cx, cy, r: 14, fill: 'transparent' }); g.append(hit);
    if (P.tip) hoverable(hit, P.tip);
  }
  const narrow = F.iw < 380;
  const dotBoxes = dots.map((d) => [d.cx - 5, d.cy - 5, d.cx + 5, d.cy + 5]);
  dots.filter((d) => d.p.label && d.p.showLabel !== false && (!narrow || d.p.pri === 1))
    .sort((a, b) => (a.p.pri || 2) - (b.p.pri || 2))
    .forEach(({ p, cx, cy }, i, arr) => {
      const w = String(p.label).length * 6.2, own = [cx - 5, cy - 5, cx + 5, cy + 5];
      const others = dotBoxes.filter((b) => b[0] !== own[0] || b[1] !== own[1]);
      const cands = [
        { tx: cx + 8, ty: cy + 4, a: 'start', b: [cx + 8, cy - 5, cx + 8 + w, cy + 5] },
        { tx: cx - 8, ty: cy + 4, a: 'end', b: [cx - 8 - w, cy - 5, cx - 8, cy + 5] },
        { tx: cx, ty: cy - 9, a: 'middle', b: [cx - w / 2, cy - 18, cx + w / 2, cy - 8] },
        { tx: cx, ty: cy + 17, a: 'middle', b: [cx - w / 2, cy + 8, cx + w / 2, cy + 18] },
      ].filter((c) => inside(c.b));
      const pick = cands.find((c) => !hitsAny(c.b, placed) && !hitsAny(c.b, others)) || cands.find((c) => !hitsAny(c.b, placed));
      if (!pick) return;
      placed.push(pick.b);
      txt(g, pick.tx, pick.ty, p.label, { 'font-size': '10.5px', 'text-anchor': pick.a });
    });
}

/* ---------- side-aware probability text */
function sideP(p, race, short) {
  if (p == null) return '—';
  const dl = race && race.dSideInd ? 'I' : 'D';
  return (p >= 0.5 ? dl : 'R') + ' ' + fp(p >= 0.5 ? p : 1 - p);
}
const BOARD_LABEL = (row) => row.label || (raceById[row.id] ? raceById[row.id].name + (raceById[row.id].office === 'Governor' ? ' governor' : raceById[row.id].special ? ' Senate (special)' : ' Senate') : row.id);

/* =========================================================== MARKETS */
function viewMarkets() {
  const root = el('div');
  const st = VENUES.map((v) => { const s = MK.status[v]; return el('span', { class: 'chip' }, el('span', { class: 'status-dot' + (s === 'live' ? '' : ' off') }), v + (s === 'live' ? ' live' : s === 'none' ? ' not listed' : ' snapshot')); });
  root.append(sectionHead('', 'Markets versus the model',
    'What traders on Kalshi, Polymarket and PredictIt are paying for each outcome, next to this page’s polls model and its history-only model. The page asks the exchanges for fresh prices when it opens and every five minutes after; any exchange that doesn’t answer is shown at its **' + fdy((MKD.asOf || BASE_DATE).slice(0, 10)) + '** snapshot.',
    el('div', { class: 'row' }, st, el('button', { class: 'btn small', onclick: () => mkRefresh(true) }, MK.busy ? 'Checking…' : 'Check prices now'))));
  if (!MKD.rows.length) { root.append(el('div', { class: 'empty', text: 'No market data was gathered for this build.' })); return root; }

  // board
  const rows = MKD.rows.map((row) => {
    const race = raceById[row.id];
    const pm = modelP(row.id, RES), pf = fundP(row.id), m = mkAvg(row.id), b = RES.blend[row.id] || blendOf(row.id);
    const gap = m && pm != null ? (m.p - pm) * 100 : null;
    const cell = (p, opts = {}) => el('td', { class: 'n' }, p == null ? el('span', { class: 'x', text: '—' }) : el('span', { class: 'pv', text: sideP(p, race) }), opts.live ? el('span', { class: 'status-dot', style: 'margin-left:6px', title: 'live price' }) : null);
    const vcell = (v) => { const x = mkVenue(row.id, v); return x ? el('td', { class: 'n' }, x.url ? el('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer', text: sideP(x.p, race) }) : sideP(x.p, race), x.live ? el('span', { class: 'status-dot', style: 'margin-left:6px', title: 'live price' }) : null) : el('td', { class: 'n' }, el('span', { class: 'x', text: '—' })); };
    return el('tr', null,
      el('td', null, el('b', { text: BOARD_LABEL(row) }), row.note ? el('div', { class: 'x', text: row.note }) : null),
      cell(pm), cell(pf), VENUES.map(vcell), cell(m && m.p),
      el('td', { class: 'n' }, gap == null ? el('span', { class: 'x', text: '—' }) : el('span', { class: Math.abs(gap) >= 10 ? 'gap-flag' : '', text: (gap >= 0 ? '+' : '−') + Math.abs(gap).toFixed(0) + (Math.abs(gap) >= 10 ? ' ●' : '') })),
      cell(b && b.p));
  });
  root.append(el('div', { class: 'tbl-wrap board' }, el('table', { class: 't' },
    el('thead', null, el('tr', null, ['Contest', 'Polls model', 'History model', 'Kalshi', 'Polymarket', 'PredictIt', 'Market average', 'Gap', 'Blend'].map((h, i) => el('th', { class: i ? 'n' : '', text: h })))),
    el('tbody', null, rows))));
  root.append(el('p', { class: 'note', style: 'margin:8px 2px 0' }, 'Probabilities are for the Democratic side (Osborn’s side in Nebraska) unless an R is shown. “Gap” is the market average minus the polls model, in points of Democratic win probability; ● marks gaps of 10 points or more. For Senate control, the model counts the simulations where Dan Osborn decides control as half a win for each party, because exchanges settle that case by their own rules. PredictIt prices are the snapshot reported by ElectionBettingOdds.com; this page can’t read PredictIt directly.'));

  // insights: biggest disagreements
  const gaps = MKD.rows.map((row) => { const pm = modelP(row.id, RES), m = mkAvg(row.id); return m && pm != null ? { row, pm, pmk: m.p, gap: m.p - pm } : null; }).filter(Boolean).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  const sentences = gaps.slice(0, 5).map((g) => {
    const race = raceById[g.row.id]; const lbl = BOARD_LABEL(g.row);
    const who = g.gap > 0 ? (race && race.dSideInd ? 'Osborn' : 'Democrats') : 'Republicans';
    return el('div', { class: 'ins' }, el('span', { class: 'mk', text: Math.abs(g.gap * 100).toFixed(0) }),
      el('div', null, el('b', { text: lbl + ': ' }), `markets ${sideP(g.pmk, race)}, polls model ${sideP(g.pm, race)}. Markets are higher for ${who} than the polls model by ${Math.abs(g.gap * 100).toFixed(0)} points.`));
  });
  const histCards = ['SENATE', 'HOUSE'].filter((id) => mkRow(id)).map((id) => chartCard(id === 'SENATE' ? 'Senate control, as traded' : 'House control, as traded', 'Price of the Democratic contract over time: Kalshi’s weekly series stored on Oct 11, plus Polymarket’s own history when its feed answers. The flat line is 50%; dots on the right are today’s polls model and blend.', (host) => drawMkHistory(host, id)));
  root.append(el('div', { class: 'grid g-main', style: 'margin-top:18px' },
    el('div', { class: 'grid', style: 'gap:18px' }, histCards),
    el('div', { class: 'card', style: 'align-self:start' }, el('h3', { text: 'Where the crowd and the polls disagree' }), el('p', { class: 'sub', text: 'Largest gaps between the market average and the polls model, in points. A gap is a question, not an answer: markets also price polling-error history, candidate news and money, and thin markets can be moved by a single trader.' }), sentences.length ? sentences : el('div', { class: 'empty', text: 'No overlapping prices yet.' }))));
  ['SENATE', 'HOUSE'].forEach((id) => mkHistory(id));
  root.append(sectionHead('', 'What the markets imply', 'Besides who wins, traders bet on seat counts and the national vote. Here are those bracket markets next to this page’s own estimates.'));
  const imp = impliedCard();
  root.append(el('div', { class: 'grid g2' }, imp.childNodes.length ? Array.from(imp.childNodes) : el('div', { class: 'empty', text: 'No bracket markets in this snapshot.' })));

  // track record
  if ((MKD.track || []).length) {
    root.append(sectionHead('', 'How markets have done', 'Pre-election prices for control of Congress and the presidency, and what happened. Some prices are snapshots from up to two weeks before Election Day (the 2020 Senate price is from Oct 20). Markets have missed in both directions.'));
    root.append(el('div', { class: 'tbl-wrap' }, el('table', { class: 't' },
      el('thead', null, el('tr', null, ['Year', 'Contest', 'Venue', 'Favorite', 'Price', 'As of', 'Winner', 'Called it?', ''].map((h, i) => el('th', { class: i === 4 ? 'n' : '', text: h })))),
      el('tbody', null, MKD.track.filter((t) => t.favorite_p != null).map((t) => el('tr', null, el('td', { class: 'mono', text: t.year }), el('td', { text: t.race }), el('td', { text: t.venue }), el('td', { text: t.favorite }), el('td', { class: 'n', text: Math.round(t.favorite_p * 100) + '%' }), el('td', { class: 'x', text: t.as_of ? fd(String(t.as_of).slice(0, 10)) : '—' }), el('td', { text: t.winner }), el('td', null, t.favorite_won === true ? 'Yes' : t.favorite_won === false ? el('b', { text: 'No' }) : 'Toss-up'), el('td', null, link(t.url, '↗'))))))));
  }
  const side = [];
  if ((MKD.studies || []).length) side.push(el('div', { class: 'card' }, el('h3', { text: 'What the research says' }), MKD.studies.map((s) => el('div', { class: 'evid' }, el('span', { class: 'ev', style: 'font-size:16px', text: s.year || '' }), el('span', { class: 'ec' }, rich(s.finding)), el('span', { class: 'es' }, s.source || '', ' ', link(s.url, '↗'))))));
  side.push(el('div', { class: 'card' }, el('h3', { text: 'Reading a price' }),
    el('ul', { style: 'margin:0;padding-left:18px;font-size:13.5px;color:var(--ink-2)' },
      el('li', null, 'A contract that pays $1 if an outcome happens and trades at 62¢ implies roughly a 62% chance, before fees and the gap between bid and ask.'),
      el('li', null, 'Exchanges settle by their own written rules — for example, how a Senate run by a coalition with an independent counts. Check the rules before comparing venues.'),
      el('li', null, 'Low-volume markets can be moved by one large trader; prices in heavily traded markets are harder to push around.'),
      el('li', null, 'This page averages the venues that quote a price and gives that average a fixed share of the blend (set in Model settings).'))));
  root.append(el('div', { class: 'grid g-main', style: 'margin-top:18px;align-items:start' }, side));
  if ((MKD.landscape || []).length) root.append(el('div', { class: 'card', style: 'margin-top:18px' }, el('h3', { text: 'How election betting got here' }), el('p', { class: 'sub', text: 'Court rulings, media deals, volumes and scandals that shape what these prices mean.' }), el('ul', { class: 'timeline cols' }, MKD.landscape.map((f) => el('li', null, el('span', { class: 'd', text: fdAny(f.date) }), el('span', { class: 'e' }, rich(f.fact), ' ', link(f.url, '↗')))))));
  return root;
}
function drawMkHistory(host, id) {
  const live = MK.hist[id] && MK.hist[id].Polymarket;
  const snaps = (MKD.history || []).filter((h) => h.id === id && h.pts && h.pts.length);
  const series = [];
  const colors = { Polymarket: PAL.amber, Kalshi: PAL.amber, PredictIt: PAL.muted };
  if (live) series.push({ name: 'Polymarket (live)', color: colors.Polymarket, pts: live.map(([d, p]) => ({ x: E.t(d), y: p * 100 })) });
  snaps.forEach((h) => { if (live && h.venue === 'Polymarket') return; series.push({ name: h.venue + ' (snapshot)', color: colors[h.venue] || PAL.ink2, dash: h.venue === 'Kalshi' ? '5 4' : null, pts: h.pts.map(([d, p]) => ({ x: E.t(d), y: p * 100 })) }); });
  if (!series.length) { host.replaceChildren(el('div', { class: 'empty', text: 'No price history available for this market.' })); return; }
  const allX = series.flatMap((s) => s.pts.map((p) => p.x)); const xMin = Math.min(...allX), xMax = Math.max(E.t(RES.asOf), ...allX);
  const xT = []; const span = (xMax - xMin) / 86400000;
  if (span > 200) { // first of every quarter
    const d0 = new Date(xMin); let y = d0.getUTCFullYear(), m = Math.ceil((d0.getUTCMonth() + (d0.getUTCDate() > 1 ? 1 : 0)) / 3) * 3;
    for (;;) { if (m > 11) { y++; m -= 12; } const tt = Date.UTC(y, m, 1, 12); if (tt > xMax) break; xT.push(tt); m += 3; }
  } else { const step = span > 120 ? 30 : 14; for (let tt = xMin; tt <= xMax; tt += step * 86400000) xT.push(tt); }
  const pm = modelP(id, RES), b = RES.blend[id];
  drawLine(host, { height: 230, series, yMin: 0, yMax: 100, xMin, xMax: xMax + 3 * 86400000, r: 70, refs: [{ y: 50, label: '50%', color: PAL.axis, left: true }], xTicks: xT,
    xFmt: (v) => { const iso = new Date(v).toISOString().slice(0, 10); return span > 200 ? MONTHS[+iso.slice(5, 7) - 1] + ' ’' + iso.slice(2, 4) : fd(iso); }, xFmtLong: (v) => fdy(new Date(v).toISOString().slice(0, 10)), yFmt: (v) => v + '%', yFmtTip: (v) => v.toFixed(0) + '% D',
    markers: [pm != null ? { x: E.t(RES.asOf), y: pm * 100, label: 'Polls ' + Math.round(pm * 100) + '%', color: PAL.ink, dy: 4 } : null, b ? { x: E.t(RES.asOf), y: b.p * 100, label: 'Blend ' + Math.round(b.p * 100) + '%', color: PAL.amber, dy: b.p > (pm || 0) ? -8 : 14 } : null].filter(Boolean) });
  host.prepend(legend(series.map((s) => ({ color: s.color, label: s.name, cls: s.dash ? 'dash' : 'line' }))));
}

/* =========================================================== HISTORY: war, the economy and the president */
const partyCol = (p) => (p === 'D' ? PAL.dem : PAL.rep);
const signed = (v, d = 1) => (v == null || isNaN(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
function rankLine(val, rows, key, higherIsWorse, since) {
  const xs = rows.filter((r) => r[key] != null && !isNaN(r[key]));
  if (val == null || !xs.length) return '';
  const worse = xs.filter((r) => (higherIsWorse ? r[key] >= val : r[key] <= val));
  const from = since || xs[0].year;
  if (!worse.length) return `Worse than every midterm since ${from}`;
  if (worse.length <= 3) return `As bad or worse only in ${worse.map((r) => r.year).join(', ').replace(/, (\d+)$/, ' and $1')}`;
  return `${worse.length} of ${xs.length} midterms since ${from} were as bad or worse`;
}
function viewHistory() {
  const root = el('div');
  if (!H2) { root.append(el('div', { class: 'empty', text: 'Historical data were not available for this build.' })); return root; }
  const rows = H2.rows, now = H2.now, F = RES.fund;
  const losses = rows.filter((r) => r.dV < 0).length;
  root.append(sectionHead('', 'Bread, peace and the president',
    `Midterms are referendums. In **${losses} of ${rows.length}** midterms since 1946 the president’s party lost ground in the national House vote. How much it lost has tracked, above all, how voters rate the president; real incomes and wars with heavy U.S. losses figure in the research, but in these 20 elections they add little once approval is known. This tab fits those relationships on every midterm since 1946 and asks what they say about 2026 without any 2026 race or generic-ballot polls (its one polling input is the president’s approval rating).`));

  // 2026 against the record
  const inp = fundInputs();
  const tiles = [
    { lab: 'Presidential approval', val: (+inp.approval).toFixed(1).replace(/\.0$/, '') + '%', foot: (now.approvalSrc || '') + '. ' + rankLine(inp.approval, rows, 'approval', false) + '.' },
    { lab: 'Real income per person', val: signed(inp.income) + '%', foot: (now.incomeSrc || 'Change over the past year') + '. ' + rankLine(inp.income, rows, 'inc', false) + '.' },
    { lab: 'Inflation', val: (now.inflation ?? inp.inflation).toFixed(1) + '%', foot: (now.inflationSrc || 'CPI, year over year') + '. ' + rankLine(now.inflation, rows, 'infl', true) + '.' },
    { lab: 'War', val: now.warLabel || (inp.war ? 'Heavy losses' : 'None'), foot: now.warNote || '' },
  ];
  if (now.sentiment != null) tiles.push({ lab: 'Consumer sentiment', val: now.sentiment.toFixed(1), foot: (now.sentimentSrc || 'University of Michigan') + '. ' + rankLine(now.sentiment, rows, 'sentiment', false, 1954) + '.' });
  if (now.gas != null) tiles.push({ lab: 'Gasoline', val: '$' + now.gas.toFixed(2), foot: (now.gasYoY != null ? signed(now.gasYoY, 0) + '% from a year earlier. ' : '') + (now.gasSrc || '') });
  root.append(el('div', { class: 'grid g3' }, tiles.map((t) => el('div', { class: 'tile' }, el('span', { class: 'lab', text: t.lab }), el('span', { class: 'val', text: t.val }), el('span', { class: 'foot', text: t.foot })))));

  // the two big relationships
  const M = H2.model;
  const ptTip = (r) => (t) => {
    t.append(el('div', { style: 'font-weight:700;margin-bottom:2px', text: r.year + ' · ' + r.pres + ' (' + r.party + ')' }));
    t.append(tipRow(signed(r.dV) + ' pts', 'change in the president’s party’s House vote share', partyCol(r.party)));
    t.append(tipRow(r.approval + '%', 'approval'));
    if (r.inc != null) t.append(tipRow(signed(r.inc) + '%', 'real income per person'));
    if (r.infl != null) t.append(tipRow(r.infl.toFixed(1) + '%', 'inflation'));
    if (r.deaths) t.append(tipRow(r.deathsLabel || r.deaths.toLocaleString(), 'U.S. war deaths that year' + (r.warName ? ' (' + r.warName + ')' : '')));
    t.append(tipRow((r.seats > 0 ? '+' : '') + r.seats, 'House seats'));
  };
  // label only the years worth reading: the extremes, wars, and the closest analogs; hover shows every year
  const named = new Set([1946, 1966, 1974, 1994, 1998, 2002, 2006, 2010, 2018, 2022].concat((H2.analogs || []).slice(0, 3).map((a) => a.year)));
  const core = new Set([1946, 1998, 2002, 2010, 2022]);
  const pts = (xk) => rows.filter((r) => r[xk] != null).map((r) => ({ x: r[xk], y: r.dV, color: partyCol(r.party), ring: r.heavy, label: String(r.year), showLabel: named.has(r.year) || r.heavy, pri: core.has(r.year) ? 1 : 2, tip: ptTip(r) }));
  const pred = F ? F.pred : null;
  const proj = (xv, label) => pred ? { x: xv, y: pred.dV, lo: pred.dV - 1.2816 * pred.sd, hi: pred.dV + 1.2816 * pred.sd, label, tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: '2026, history-only projection' })); t.append(tipRow(signed(pred.dV) + ' pts', 'Republican House vote share vs 2024')); t.append(tipRow(signed(pred.dV - 1.2816 * pred.sd) + ' to ' + signed(pred.dV + 1.2816 * pred.sd), '80% range')); } } : null;
  const fitA = H2.fits && H2.fits.approval, fitI = H2.fits && H2.fits.income;
  const leg = legend([{ color: PAL.dem, label: 'Democratic president', cls: 'dot' }, { color: PAL.rep, label: 'Republican president', cls: 'dot' }, { color: PAL.amber, label: '2026 projection (80% range)', cls: 'dot' }]);
  root.append(el('div', { class: 'grid g2', style: 'margin-top:18px' },
    chartCard('Approval and the midterm penalty', 'Each dot is a midterm: the president’s approval going in (across) and the change in his party’s share of the two-party House vote since the previous presidential year (up and down). Ringed dots are years of war with heavy U.S. losses.', (host) => drawScatter(host, { pts: pts('approval'), fit: fitA, xLabel: 'Presidential approval at the midterm (%)', yFmt: (v) => signed(v, 0), xFmt: (v) => v + '%', proj: proj(inp.approval, '2026') }), leg),
    chartCard('Real incomes and the midterm penalty', 'Same elections, against the change in real disposable income per person over the year before the vote. On its own, income lines up only loosely with the result; approval already absorbs much of the economy.', (host) => drawScatter(host, { pts: pts('inc'), fit: fitI, xLabel: 'Real disposable income per person, change over the year (%)', yFmt: (v) => signed(v, 0), xFmt: (v) => v + '%', proj: proj(inp.income, '2026') }), legend([{ color: PAL.dem, label: 'Democratic president', cls: 'dot' }, { color: PAL.rep, label: 'Republican president', cls: 'dot' }]))));

  // the model and what-ifs
  const coefRows = M.keys.map((k) => el('tr', null, el('td', { text: M.labels[k] }), el('td', { class: 'n', text: signed(M.coef[k], 2) }), el('td', { class: 'n', text: '± ' + M.se[k].toFixed(2) }), el('td', { class: 'x', text: M.read[k] || '' })));
  const mg = F ? F.mg : null;
  const fi = fundInputs();
  const what = el('div', null,
    wslider('fApproval', 'Presidential approval', 30, 60, 0.5, fi.approval, (v) => v.toFixed(1).replace(/\.0$/, '') + '%'),
    wslider('fIncome', 'Real income per person, change over the year', -4, 6, 0.1, fi.income, (v) => signed(v) + '%'),
    wtoggle('fWar', 'A war with heavy U.S. losses (as in 1950, 1966, 1970, 2006, 2010)', fi.war),
    el('button', { class: 'btn small', onclick: () => { S.fApproval = null; S.fIncome = null; S.fWar = null; S.fInflation = null; commit(false); } }, 'Reset to today’s values'));
  const out = F ? el('div', { class: 'kv', style: 'margin-top:4px' },
    el('span', { class: 'k', text: 'Republican House vote share' }), el('b', { text: `${mg.rShare.toFixed(1)}% (${signed(pred.dV)} from 2024)` }),
    el('span', { class: 'k', text: 'National margin' }), el('b', null, el('span', { class: 'lean ' + sideOf(mg.dMargin), text: fm(mg.dMargin) }), ' ', el('span', { class: 'note', text: '80%: ' + fm(mg.dMargin - 1.2816 * mg.sdMargin) + ' to ' + fm(mg.dMargin + 1.2816 * mg.sdMargin) })),
    el('span', { class: 'k', text: 'Compared with the polls' }), el('span', null, 'Generic-ballot average after correction: ', el('b', { class: 'lean ' + sideOf(RES.envAdj), text: fm(RES.envAdj) })),
    el('span', { class: 'k', text: 'House, history only' }), el('b', { text: `Democrats ${fp(F.sim.house.pD)}, median ${Math.round(F.sim.house.med)} seats` }),
    el('span', { class: 'k', text: 'Senate, history only' }), el('b', { text: `Democratic control ${fp(F.sim.senate.pD + 0.5 * F.sim.senate.pHung)}` }),
    el('span', { class: 'k', text: 'Ohio governor, history only' }), el('b', { text: sideP(F.byId[D.ohio.govId] && F.byId[D.ohio.govId].pD, raceById[D.ohio.govId]) })) : el('div', { class: 'empty', text: 'Model unavailable' });
  root.append(sectionHead('', 'What history alone predicts', `A regression on ${M.n} midterms (1946–2022). Coefficients are points of the president’s party’s two-party House vote. In leave-one-out tests it misses by **${M.loo_rmse.toFixed(1)} points** on average (root-mean-square), against ${M.naive_rmse.toFixed(1)} for “the president’s party always loses the average amount.” That error is large — which is why history is the lightest of the three witnesses.`));
  root.append(el('div', { class: 'grid g-main' },
    el('div', { class: 'card' }, el('h3', { text: 'The fitted model' }), el('p', { class: 'sub', text: H2.modelNote || '' }),
      el('div', { class: 'tbl-wrap', style: 'margin-bottom:12px' }, el('table', { class: 't', style: 'min-width:0' }, el('thead', null, el('tr', null, ['Term', 'Effect', 'Std. error', 'Reading'].map((h, i) => el('th', { class: i === 1 || i === 2 ? 'n' : '', text: h })))), el('tbody', null, el('tr', null, el('td', { text: 'Baseline midterm penalty' }), el('td', { class: 'n', text: signed(M.coef.const, 2) }), el('td', { class: 'n', text: '± ' + M.se.const.toFixed(2) }), el('td', { class: 'x', text: 'the average loss when every other term is zero' })), coefRows))),
      el('p', { class: 'note', text: `R² ${M.r2.toFixed(2)}, residual error ±${M.sigma.toFixed(1)} points, ${M.n} elections. ${specNote(M)}${H2.fitNote || ''}` })),
    el('div', { class: 'card', style: 'align-self:start' }, el('h3', { text: 'What if?' }), el('p', { class: 'sub', text: 'Move the inputs and the history-only forecast — and the blended call in the hero — updates.' }), what, el('hr', { class: 'soft' }), out)));

  // war
  const warRows = rows.filter((r) => r.deaths > 0).sort((a, b) => a.year - b.year);
  root.append(sectionHead('', 'War', H2.warNote || ''));
  root.append(el('div', { class: 'grid g2' },
    el('div', { class: 'card' }, el('h3', { text: 'Midterms fought during a shooting war' }), el('p', { class: 'sub', text: 'U.S. war deaths in the election year and what happened to the president’s party. 2026 for comparison: 21 U.S. deaths in the Iran war, 11 of them in combat.' }),
      el('div', { class: 'tbl-wrap' }, el('table', { class: 't', style: 'min-width:0' }, el('thead', null, el('tr', null, ['Year', 'War', 'Deaths', 'Approval', 'Vote share', 'Seats'].map((h, i) => el('th', { class: i >= 2 ? 'n' : '', text: h })))),
        el('tbody', null, warRows.map((r) => el('tr', null, el('td', { class: 'mono', text: r.year }), el('td', { text: r.warName || '' }), el('td', { class: 'n' }, el('span', { text: r.deathsLabel || r.deaths.toLocaleString(), title: r.warNote || '' }), r.heavy ? '' : el('span', { class: 'x', text: ' light' })), el('td', { class: 'n', text: r.approval + '%' }), el('td', { class: 'n', text: signed(r.dV) }), el('td', { class: 'n', text: (r.seats > 0 ? '+' : '') + r.seats }))))))),
    el('div', { class: 'card' }, el('h3', { text: 'What the research says about war and votes' }), (H2.literature || []).filter((l) => l.topic === 'war').map((l) => el('div', { class: 'evid' }, el('span', { class: 'ev', style: 'font-size:15px', text: l.year || '' }), el('span', { class: 'ec' }, rich(l.finding)), el('span', { class: 'es' }, l.source || '', ' ', link(l.url, '↗')))))));

  // analogs
  if ((H2.analogs || []).length) {
    root.append(sectionHead('', 'The years 2026 most resembles', H2.analogNote || ''));
    const maxD = Math.max(...H2.analogs.map((a) => a.dist));
    root.append(el('div', { class: 'grid g-main' },
      el('div', { class: 'card' }, H2.analogs.map((a) => el('div', { class: 'analog' },
        el('span', { class: 'yr', text: a.year }),
        el('span', { class: 'why' }, el('b', { text: a.pres + '. ' }), a.why),
        el('span', { class: 'out', text: signed(a.dV) + ' pts, ' + signed(a.seats, 0) + ' seats' }),
        el('span', { class: 'sim' }, el('i', { style: `width:${Math.round(100 * (1 - a.dist / (maxD * 1.15)))}%` }))))),
      el('div', { class: 'card', style: 'align-self:start' }, el('h3', { text: 'If 2026 repeats them' }), el('p', { class: 'sub', text: 'Apply each analog’s swing to the 2024 House vote (Republicans 51.3% of the two-party vote) and read the seats off this page’s House curve.' }),
        el('div', { class: 'tbl-wrap' }, el('table', { class: 't', style: 'min-width:0' }, el('thead', null, el('tr', null, ['Analog', 'Margin', 'D seats'].map((h, i) => el('th', { class: i ? 'n' : '', text: h })))),
          el('tbody', null, H2.analogs.map((a) => { const m = 100 - 2 * (now.vPrev + a.dV); const seats = seatsAt(m); return el('tr', null, el('td', { text: a.year }), el('td', { class: 'n' }, el('span', { class: 'lean ' + sideOf(m), text: fm(m) })), el('td', { class: 'n', text: seats == null ? '—' : Math.round(seats) })); })))),
        el('p', { class: 'note', style: 'margin-top:8px', text: 'Seat counts assume today’s district lines, ratings and incumbents; only the national swing changes.' }))));
  }

  // case studies + models
  if ((H2.cases || []).length) {
    root.append(sectionHead('', 'Seven midterms that turned on war or money', ''));
    const half = Math.ceil(H2.cases.length / 2);
    const col = (cs) => el('div', { class: 'card' }, cs.map((c) => el('div', { class: 'case' }, el('h4', { text: c.year + ': ' + c.title }), el('p', null, rich(c.summary)), el('div', { class: 'es' }, (c.sources || []).map((u, i) => [i ? ' ' : '', link(u, 'source ' + (i + 1))])))));
    root.append(el('div', { class: 'grid g2' }, col(H2.cases.slice(0, half)), col(H2.cases.slice(half))));
  }
  if ((H2.models || []).length || (H2.literature || []).length) {
    root.append(el('div', { class: 'card', style: 'margin-top:18px' }, el('h3', { text: 'The models this tab borrows from' }),
      (H2.models || []).map((m) => el('div', { class: 'evid nov' }, el('span', { class: 'ec' }, el('b', { style: 'color:var(--ink)', text: m.name + '. ' }), rich(m.finding)), el('span', { class: 'es' }, link(m.url, 'source ↗')))),
      (H2.literature || []).filter((l) => l.topic !== 'war').map((l) => el('div', { class: 'evid' }, el('span', { class: 'ev', style: 'font-size:15px', text: l.year || l.topic }), el('span', { class: 'ec' }, rich(l.finding)), el('span', { class: 'es' }, l.source || '', ' ', link(l.url, '↗'))))));
  }
  return root;
}
// say plainly when a simpler specification predicted better out of sample
function specNote(M) {
  const sp = M.specs || {}; const mine = sp[M.spec]; if (!mine) return '';
  const best = Object.entries(sp).sort((a, b) => a[1].loo - b[1].loo)[0];
  if (!best || best[0] === M.spec || best[1].loo >= mine.loo - 0.02) return '';
  const nm = (k) => k.map((x) => ({ app: 'approval', inc: 'income', infl: 'inflation', war: 'war', prev: 'the previous vote' }[x] || x));
  const list = (a) => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0];
  return `A simpler model using only ${list(nm(best[1].keys))} missed by ${best[1].loo.toFixed(2)} points in the same test, slightly less than this one’s ${mine.loo.toFixed(2)}: income and war are kept because they are what this tab asks about, but on top of approval they don’t improve out-of-sample accuracy. `;
}
// expected Democratic House seats at a national margin, read off the deterministic House curve
function seatsAt(margin) {
  const c = RES.hCurve; if (!c || !c.length) return null;
  const sh = margin - RES.envAdj;
  if (sh <= c[0].shift) return c[0].mean; if (sh >= c[c.length - 1].shift) return c[c.length - 1].mean;
  for (let i = 1; i < c.length; i++) if (c[i].shift >= sh) { const t = (sh - c[i - 1].shift) / (c[i].shift - c[i - 1].shift); return c[i - 1].mean + t * (c[i].mean - c[i - 1].mean); }
  return null;
}

/* =========================================================== INFORMATION AGE: social media, AI and what they do to a forecast */
let STRESS = null;
function stressRuns() {
  const key = JSON.stringify([S, userPolls.length, excluded.size, RES.asOf]);
  if (STRESS && STRESS.key === key) return STRESS;
  const base = RES.s;
  const nat = base.sigmaNat, reg = base.sigmaReg;
  const variants = [
    { k: 'base', label: 'This page’s model', note: 'Normal-shaped national error of ±' + nat.toFixed(1), s: {} },
    { k: 'tails', label: 'Fat tails', note: 'Same standard deviation, but big shared misses or late shocks are far more likely (Student-t, 4 degrees of freedom)', s: { tailDf: 4 } },
    { k: 'wide', label: 'Noisier polls', note: 'National error one-third larger, for opt-in panels and bot contamination', s: { sigmaNat: nat * 1.33 } },
    { k: 'national', label: 'Fully nationalized', note: 'Regional differences fold into one national swing', s: { sigmaReg: 0.5, sigmaNat: Math.sqrt(nat * nat + reg * reg - 0.25) } },
  ];
  const out = variants.map((v) => {
    const s = Object.assign({}, base, { nSims: 6000, seed: base.seed + 11 }, v.s);
    const sim = E.simulate({ races: RES.ests, districts: RES.dists, senateBase: D.senateBase, houseBase: { D: D.house.solid.D }, regions: REGIONS }, s, {});
    const gi = RES.ests.findIndex((e) => e.race.id === D.ohio.govId);
    return Object.assign({}, v, { house: sim.house.pD, senR: sim.senate.pR, senD: sim.senate.pD + 0.5 * sim.senate.pHung, gov: gi >= 0 ? sim.races[gi].pD : null, hLo: sim.house.lo, hHi: sim.house.hi });
  });
  // chance of a shared miss bigger than 6 points, normal vs fat-tailed
  const rng = E.mulberry32(7), z = E.normalGen(rng);
  let tN = 0, tT = 0; const n = 40000, df = 4, sc = Math.sqrt((df - 2) / df), thr = Math.round(3 * nat);
  for (let i = 0; i < n; i++) { if (Math.abs(nat * z()) > thr) tN++; let c = 0; for (let q = 0; q < df; q++) { const g = z(); c += g * g; } if (Math.abs(nat * (z() / Math.sqrt(c / df)) * sc) > thr) tT++; }
  STRESS = { key, out, big: { thr, normal: tN / n, tails: tT / n } };
  return STRESS;
}
function viewInfo() {
  const root = el('div');
  root.append(sectionHead('', 'The information weather',
    'This page’s premise: the bases barely move, and a small slice decides. Americans now get less news from television and more from feeds, podcasts and creators; AI chatbots are still a small source (9% get news from them at least sometimes), and polls that try to measure the electorate face new kinds of noise. This tab gathers what is documented about that environment and lets you stress-test the forecast for it.'));
  if (!INFO) { root.append(el('div', { class: 'empty', text: 'Information-environment research was not available for this build.' })); return root; }

  const list = (items, map) => items.map(map);
  const evid = (v, text, src, url) => el('div', { class: v ? 'evid' : 'evid nov' }, v ? el('span', { class: 'ev', style: 'font-size:17px', text: v }) : null, el('span', { class: 'ec' }, rich(text)), el('span', { class: 'es' }, src || '', ' ', link(url, '↗')));

  // news diet chart + list
  const dumb = (rows, title, note) => chartCard(title, note, (host) => drawDumbbell(host, rows.map((d) => ({ label: d.label, a: d.a, b: d.b, bColor: PAL.amber, lineColor: PAL.axis, tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: d.label })); t.append(tipRow(d.a + '%', '2020')); t.append(tipRow(d.b + '%', '2025', PAL.amber)); if (d.src) t.append(el('div', { class: 'tk', text: d.src })); } })), { min: 0, max: 45, fmt: (v) => v + '%', rowH: 30 }), legend([{ color: PAL.ink2, label: '2020', cls: 'dot' }, { color: PAL.amber, label: '2025', cls: 'dot' }]));
  const diet = (INFO.news_chart || []).filter((d) => d.a != null && d.b != null).sort((x, y) => y.b - x.b);
  const often = (INFO.often_chart || []).filter((d) => d.a != null && d.b != null);
  root.append(el('div', { class: 'grid g-main' },
    el('div', { class: 'grid', style: 'gap:18px;align-content:start' },
      diet.length ? dumb(diet, 'Where Americans get news, 2020 and 2025', INFO.news_chart_note || 'Share of U.S. adults who regularly get news on each platform.') : null,
      often.length ? dumb(often, 'Where Americans often get news', INFO.often_chart_note || '') : null),
    el('div', { class: 'card', style: 'align-self:start' }, el('h3', { text: 'The news diet, in numbers' }), list(INFO.news_diet || [], (n) => evid(n.value_short || '', (n.stat_short || n.stat) + (n.year ? ' (' + n.year + ')' : ''), n.source, n.url)))));

  // AI in the campaign
  const ev = (INFO.ai_events || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  root.append(sectionHead('', 'AI in the 2026 campaign', INFO.ai_note || 'Documented uses of generative AI by campaigns, parties, officials and foreign operations, and the responses. Both parties’ uses are listed where they were reported.'));
  root.append(el('div', { class: 'grid g-main' },
    el('div', { class: 'card' }, ev.length ? el('ul', { class: 'timeline' }, ev.map((e) => el('li', null, el('span', { class: 'd', text: fdAny(e.date) }), el('span', { class: 'e' }, el('b', { text: e.actor ? e.actor + ': ' : '' }), rich(e.event), e.response ? el('small', null, rich(e.response), ' ', link(e.url, '↗')) : [' ', link(e.url, '↗')])))) : el('div', { class: 'empty', text: 'No sourced events found.' })),
    el('div', { class: 'card', style: 'align-self:start' }, el('h3', { text: 'The rules' }), el('p', { class: 'sub', text: 'Federal, state and platform rules on AI-made political content.' }), list(INFO.rules || [], (r) => evid(r.level ? r.level[0].toUpperCase() + r.level.slice(1) : '', r.item + (r.status ? ' ' + r.status : ''), r.source + (r.date ? ', ' + r.date : ''), r.url)))));

  // persuasion and polling
  const pt = INFO.persuasion_table || [];
  root.append(sectionHead('', 'Can a chatbot move the movable middle?', INFO.persuasion_note || ''));
  root.append(pt.length ? el('div', { class: 'tbl-wrap' }, el('table', { class: 't' },
      el('thead', null, el('tr', null, ['What was tested', 'Measured as', 'Right after', 'Weeks later', 'Study'].map((h) => el('th', { text: h })))),
      el('tbody', null, pt.map((r) => el('tr', null, el('td', null, el('b', { text: r.label }), r.ai ? el('span', { class: 'tag live', style: 'margin-left:6px', text: 'AI' }) : null), el('td', { class: 'x', text: r.measure }), el('td', { text: r.now }), el('td', { text: r.later || '—' }), el('td', null, r.src, ' ', link(r.url, '↗')))))))
    : el('div', { class: 'card' }, (INFO.persuasion || []).map((p) => evid(p.effect_pp || '', '**' + (p.study || '') + '** ' + (p.finding || ''), p.journal || '', p.url))));
  root.append(el('div', { class: 'grid g2', style: 'margin-top:18px' },
    el('div', { class: 'card' }, el('h3', { text: 'Can the polls still see the slice?' }), el('p', { class: 'sub', text: 'Opt-in online panels are cheap and fast — and newly exposed to AI respondents and professional survey-takers.' }), list(INFO.polling || [], (p) => evid('', '**' + (p.item || '') + '.** ' + (p.finding || '') + (p.date ? ' (' + p.date + ')' : ''), p.source, p.url))),
    el('div', { class: 'card' }, el('h3', { text: 'Is the middle still shrinking?' }), el('p', { class: 'sub', text: 'Measures of how locked-in the electorate is. Fewer swing voters means smaller swings — but more correlated ones.' }), list(INFO.polarization || [], (p) => evid(p.value || '', '**' + (p.measure || '') + '.** ' + (p.trend || ''), p.source, p.url)))));

  // stress test
  const ST = stressRuns();
  root.append(sectionHead('', 'Stress-test the forecast for the information age',
    'Three ways the 2026 environment could break a polls-based forecast, each run as 6,000 fresh simulations of this page’s polls model. **Fat tails** stands in for a viral October surprise (a scandal, a war event or a convincing deepfake) that shifts every race at once; **noisier polls** for contaminated online samples; **fully nationalized** for an electorate that moves as one bloc because everyone sees the same feeds.'));
  const gov = raceById[D.ohio.govId];
  root.append(el('div', { class: 'grid g-main' },
    el('div', { class: 'tbl-wrap stress' }, el('table', { class: 't' },
      el('thead', null, el('tr', null, ['Scenario', 'Democrats win the House', 'Republicans keep the Senate', (gov ? gov.dem.split(' ').slice(-1)[0] : 'Democrat') + ' wins Ohio', 'Democratic House seats, 80% range'].map((h, i) => el('th', { class: i ? 'n' : '', text: h })))),
      el('tbody', null, ST.out.map((r, i) => { const b = ST.out[0]; const d = (v, bv) => { if (!i || v == null || bv == null) return ''; const x = Math.round((v - bv) * 100); return ' (' + (x ? signed(x, 0) : '±0') + ')'; }; return el('tr', null, el('td', null, el('b', { text: r.label }), el('div', { class: 'x', text: r.note })), el('td', { class: 'n' }, el('b', { text: fp(r.house) }), d(r.house, b.house)), el('td', { class: 'n' }, el('b', { text: fp(r.senR) }), d(r.senR, b.senR)), el('td', { class: 'n' }, el('b', { text: fp(r.gov) }), d(r.gov, b.gov)), el('td', { class: 'n', text: Math.round(r.hLo) + '–' + Math.round(r.hHi) })); })))),
    el('div', { class: 'card', style: 'align-self:start' }, el('h3', { text: 'Reading the stress test' }),
      el('p', { class: 'sub' }, `Fat tails keep the same overall spread but redistribute it: more elections land close to the forecast and more land very far from it. So a modest favorite can look slightly safer while the chance of a big upset grows. With this page’s ±${RES.s.sigmaNat.toFixed(1)}-point national error, a shared miss larger than ${ST.big.thr} points happens in `, el('b', { text: (ST.big.normal * 100).toFixed(1) + '%' }), ' of normal draws and ', el('b', { text: (ST.big.tails * 100).toFixed(1) + '%' }), ` of fat-tailed ones, about ${Math.max(1, Math.round(ST.big.tails / Math.max(ST.big.normal, 1e-4)))} times as often. Noisier polls pull every favorite toward 50%; full nationalization makes the Senate and House move together, so split outcomes get rarer.`),
      el('p', { class: 'note', text: 'Turn fat tails on for the whole page in Model settings → Information age.' }))));

  // money and markets in media
  const money = INFO.money || [], mm = INFO.markets_media || [];
  if (money.length || mm.length) root.append(el('div', { class: 'grid g2', style: 'margin-top:18px' },
    el('div', { class: 'card' }, el('h3', { text: 'Where the money goes' }), list(money, (m) => evid(m.value || '', '**' + (m.item || '') + '**' + (m.date ? ' (' + m.date + ')' : ''), m.source, m.url))),
    el('div', { class: 'card' }, el('h3', { text: 'Prediction markets on screen' }), list(mm, (m) => evid(m.date ? fdAny(m.date.slice(0, 7)) : '', m.item, m.source, m.url)))));
  if ((INFO.gaps || []).length) root.append(el('p', { class: 'note', style: 'margin-top:12px', text: 'Not found in this research pass: ' + INFO.gaps.join('; ') + '.' }));
  return root;
}

// a checkbox whose setting can be null, meaning "use today's value"
function wtoggle(key, label, current) {
  const cb = el('input', { type: 'checkbox' }); cb.checked = S[key] == null ? !!current : !!S[key];
  cb.addEventListener('change', () => { S[key] = cb.checked ? 1 : 0; commit(false); });
  return el('label', { class: 'row', style: 'margin:2px 0 14px;font-size:13px;font-weight:600;gap:8px;flex-wrap:nowrap;align-items:flex-start' }, cb, el('span', { text: label }));
}
// a slider whose setting can be null, meaning "use today's measured value"
function wslider(key, label, min, max, step, current, fmtV) {
  const v0 = S[key] == null ? current : +S[key];
  const o = el('output', { text: fmtV(v0) + (S[key] == null ? ' (today)' : '') });
  const inp = el('input', { type: 'range', min, max, step, value: v0, 'aria-label': label });
  inp.addEventListener('input', () => { S[key] = +inp.value; o.textContent = fmtV(+inp.value); commit(false); });
  return el('div', { class: 'ctrl' }, el('label', null, label, o), inp);
}
function fdAny(s) {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return fdy(s.slice(0, 10));
  if (/^\d{4}-\d{2}$/.test(s)) { const [y, m] = s.split('-').map(Number); return MONTHS[m - 1] + ' ' + y; }
  return s;
}

/* ---------- what the bracket markets imply: seats and the national vote */
function bracketRange(label) {
  // returns [lo, hi) on the scale the label uses (seats, or Democratic margin in points)
  const L = String(label);
  let m;
  if ((m = L.match(/Below (\d+)/))) return [-Infinity, +m[1]];
  if ((m = L.match(/Above (\d+)/))) return [+m[1] + 1, Infinity];
  if ((m = L.match(/(\d+)\s*-\s*(\d+)$/)) && /seats/.test(L)) return [+m[1], +m[2] + 1];
  if ((m = L.match(/D seats (\d+)$/))) return [+m[1], +m[1] + 1];
  if (/Republicans win/.test(L)) return [-Infinity, 0];
  if ((m = L.match(/Democrats, (\d+) to (\d+)%/))) return [+m[1], +m[2]];
  if ((m = L.match(/Democrats, (\d+)% and above/))) return [+m[1], Infinity];
  if ((m = L.match(/^Democrats (\d+)\+?%?\+?$/)) || (m = L.match(/^Democrats (\d+)%\+$/))) return [+m[1], Infinity];
  if ((m = L.match(/^Democrats (\d+)-(\d+)%/))) return [+m[1], +m[2]];
  if ((m = L.match(/^Republicans (\d+)-(\d+)%/))) return [-(+m[2]), -(+m[1])];
  if ((m = L.match(/^Republicans (\d+)%\+/))) return [-Infinity, -(+m[1])];
  return null;
}
function bracketDist(list) {
  const rows = (list || []).map((b) => ({ r: bracketRange(b.label), p: b.p, label: b.label })).filter((b) => b.r && b.p != null);
  const tot = rows.reduce((a, b) => a + b.p, 0) || 1;
  rows.forEach((b) => { b.q = b.p / tot; });
  rows.sort((a, b) => a.r[0] - b.r[0]);
  return rows;
}
function distQuantile(rows, q, tailW) {
  let c = 0;
  for (const b of rows) {
    const lo = isFinite(b.r[0]) ? b.r[0] : b.r[1] - tailW, hi = isFinite(b.r[1]) ? b.r[1] : b.r[0] + tailW;
    if (c + b.q >= q) return lo + (hi - lo) * ((q - c) / (b.q || 1));
    c += b.q;
  }
  return null;
}
function impliedCard() {
  const B = MKD.brackets || {};
  const wrap = el('div');
  const pk = bracketDist(B.popKalshi), pp = bracketDist(B.popPoly);
  const sigGB = Math.sqrt(RES.s.sigmaNat * RES.s.sigmaNat + RES.s.sigmaNatDrift * RES.s.sigmaNatDrift);
  const rows = [
    { label: 'Polls (generic ballot)', med: RES.envAdj, lo: RES.envAdj - 1.2816 * sigGB, hi: RES.envAdj + 1.2816 * sigGB, color: PAL.ink },
    RES.fund ? { label: 'History model', med: RES.fund.mg.dMargin, lo: RES.fund.mg.dMargin - 1.2816 * RES.fund.mg.sdMargin, hi: RES.fund.mg.dMargin + 1.2816 * RES.fund.mg.sdMargin, color: PAL.ink2 } : null,
    pk.length ? { label: 'Kalshi', med: distQuantile(pk, 0.5, 4), lo: distQuantile(pk, 0.1, 4), hi: distQuantile(pk, 0.9, 4), color: PAL.amber } : null,
    pp.length ? { label: 'Polymarket', med: distQuantile(pp, 0.5, 4), lo: distQuantile(pp, 0.1, 4), hi: distQuantile(pp, 0.9, 4), color: PAL.amber } : null,
  ].filter(Boolean);
  if (rows.length > 1) wrap.append(chartCard('The national House vote: three readings', 'Democratic margin in the national House vote. Dot = median; bar = 80% range. Market ranges come from their bracket contracts, rescaled so each venue’s brackets add to 100%.', (host) => drawRanges(host, rows, { min: -4, max: 18, fmt: (v) => (v > 0 ? 'D+' : v < 0 ? 'R+' : '') + Math.abs(v) })));
  const hs = bracketDist(B.houseSeats);
  if (hs.length) {
    const mh = RES.sim.house.hist; const cats = hs.map((b) => !isFinite(b.r[0]) ? '<' + b.r[1] : !isFinite(b.r[1]) ? b.r[0] + '+' : String(b.r[0]));
    const model = hs.map((b) => Object.entries(mh).filter(([k]) => +k >= b.r[0] && +k < b.r[1]).reduce((a, [, v]) => a + v, 0));
    wrap.append(chartCard('Democratic House seats: model vs. Kalshi', `Share of outcomes in each four-seat range (labelled by its first seat). The polls model’s median is ${Math.round(RES.sim.house.med)}; the market’s is about ${Math.round(distQuantile(hs, 0.5, 4))}.`, (host) => drawGrouped(host, cats, [{ name: 'Polls model', color: PAL.ink2, vals: model }, { name: 'Kalshi', color: PAL.amber, vals: hs.map((b) => b.q) }], { fmt: (v) => Math.round(v * 100) + '%' }), legend([{ color: PAL.ink2, label: 'Polls model' }, { color: PAL.amber, label: 'Kalshi seat brackets' }])));
  }
  const ss = bracketDist(B.senateSeats);
  if (ss.length) {
    const msh = RES.sim.senate.hist; const cats = ss.map((b) => !isFinite(b.r[0]) ? '<' + b.r[1] : !isFinite(b.r[1]) ? b.r[0] + '+' : String(b.r[0]));
    const model = ss.map((b) => Object.entries(msh).filter(([k]) => +k >= b.r[0] && +k < b.r[1]).reduce((a, [, v]) => a + v, 0));
    const k51 = ss.filter((b) => b.r[0] >= 51).reduce((a, b) => a + b.q, 0), kc = mkVenue('SENATE', 'Kalshi');
    const selfGap = kc && Math.abs(k51 - kc.p) >= 0.03 ? ` Kalshi’s own seat brackets imply a ${fp(k51)} chance that Democrats hold 51 or more seats, while its Senate-control contract trades at ${fp(kc.p)}: the two settle under different rules.` : '';
    wrap.append(chartCard('Democratic Senate seats: model vs. Kalshi', 'Seats held by Democrats and independents who caucus with them. Kalshi counts an independent with the party he caucuses with; this model adds Osborn to the Democratic count whenever he wins, an assumption, since he is running as an independent.' + selfGap, (host) => drawGrouped(host, cats, [{ name: 'Polls model', color: PAL.ink2, vals: model }, { name: 'Kalshi', color: PAL.amber, vals: ss.map((b) => b.q) }], { fmt: (v) => Math.round(v * 100) + '%' }), legend([{ color: PAL.ink2, label: 'Polls model' }, { color: PAL.amber, label: 'Kalshi seat brackets' }])));
  }
  const bop = B.bop || [];
  if (bop.length && RES.sim.combo) {
    const C = RES.sim.combo;
    const keyOf = (lab) => /sweep/i.test(lab) && /Democrat/i.test(lab) ? 'DD' : /sweep/i.test(lab) && /Republican/i.test(lab) ? 'RR' : /D House \+ R Senate|R Senate, D House/.test(lab) ? 'DR' : /R House \+ D Senate|D Senate, R House/.test(lab) ? 'RD' : null;
    const names = { DD: 'Democrats win both', DR: 'Democratic House, Republican Senate', RD: 'Republican House, Democratic Senate', RR: 'Republicans keep both' };
    const vp = (venue, k) => { const x = bop.find((b) => b.venue === venue && keyOf(b.label) === k); return x ? x.p : null; };
    wrap.append(el('div', { class: 'card' }, el('h3', { text: 'Balance of power' }), el('p', { class: 'sub', text: 'Joint outcomes for the two chambers. In the model, simulations where Osborn decides the Senate count half each way.' }),
      el('div', { class: 'tbl-wrap' }, el('table', { class: 't', style: 'min-width:0' }, el('thead', null, el('tr', null, ['Outcome', 'Polls model', 'Kalshi', 'Polymarket'].map((h, i) => el('th', { class: i ? 'n' : '', text: h })))),
        el('tbody', null, ['DD', 'DR', 'RD', 'RR'].map((k) => el('tr', null, el('td', { text: names[k] }), el('td', { class: 'n', text: fp(C[k]) }), el('td', { class: 'n', text: fp(vp('Kalshi', k)) }), el('td', { class: 'n', text: fp(vp('Polymarket', k)) }))))))));
  }
  return wrap;
}
function drawRanges(host, rows, o) {
  const rh = 40, F = frame(host, rows.length * rh + 40, { t: 24, r: 20, b: 14, l: Math.min(170, Math.max(120, (host.clientWidth || 600) * 0.3)) });
  const x = scale(o.min, o.max, F.m.l, F.m.l + F.iw); const g = sv('g'); F.svg.append(g);
  ticks(o.min, o.max, 6).forEach((t) => { vline(g, x(t), F.m.t - 4, F.h - F.m.b, t === 0 ? PAL.axis : PAL.grid, t === 0 ? 1.4 : 1); txt(g, x(t), F.m.t - 10, o.fmt(t), { 'text-anchor': 'middle' }); });
  rows.forEach((r, i) => {
    const cy = F.m.t + i * rh + rh / 2;
    g.append(sv('rect', { x: Math.min(x(r.lo), x(r.hi)), y: cy - 4, width: Math.max(2, Math.abs(x(r.hi) - x(r.lo))), height: 8, rx: 4, fill: r.color, opacity: 0.28 }));
    g.append(sv('circle', { cx: x(r.med), cy, r: 6, fill: r.color, stroke: PAL.surface, 'stroke-width': 2 }));
    txt(g, F.m.l - 10, cy + 4, r.label, { 'text-anchor': 'end', class: 'lbl' });
    txt(g, x(r.med), cy - 10, o.fmt(Math.round(r.med * 10) / 10), { 'text-anchor': 'middle', class: 'lbl-strong' });
    const hit = sv('rect', { x: 0, y: cy - rh / 2, width: F.w, height: rh, fill: 'transparent' }); g.append(hit);
    hoverable(hit, (t) => { t.append(el('div', { style: 'font-weight:700', text: r.label })); t.append(tipRow(o.fmt(+r.med.toFixed(1)), 'median', r.color)); t.append(tipRow(o.fmt(+r.lo.toFixed(1)) + ' to ' + o.fmt(+r.hi.toFixed(1)), '80% range')); });
  });
}
function drawGrouped(host, cats, series, o = {}) {
  const F = frame(host, o.height || 220, { t: 14, r: 10, b: 34, l: 40 });
  const maxV = Math.max(0.05, ...series.flatMap((s) => s.vals));
  const y = scale(0, maxV * 1.1, F.m.t + F.ih, F.m.t); const g = sv('g'); F.svg.append(g);
  ticks(0, maxV * 1.1, 4).forEach((t) => { hline(g, F.m.l, F.m.l + F.iw, y(t), PAL.grid); txt(g, F.m.l - 6, y(t) + 3, o.fmt ? o.fmt(t) : t, { 'text-anchor': 'end' }); });
  const cw = F.iw / cats.length, bw = Math.max(3, Math.min(16, (cw - 6) / series.length - 2));
  cats.forEach((c, i) => {
    const cx = F.m.l + cw * i + cw / 2;
    series.forEach((s, j) => {
      const bx = cx - (series.length * (bw + 2)) / 2 + j * (bw + 2);
      g.append(sv('path', { d: colPath(bx, y(0), bw, y(s.vals[i] || 0)), fill: s.color }));
    });
    txt(g, cx, F.h - 16, c, { 'text-anchor': 'middle', 'font-size': '10px' });
    const hit = sv('rect', { x: cx - cw / 2, y: F.m.t, width: cw, height: F.ih, fill: 'transparent' }); g.append(hit);
    hoverable(hit, (t) => { t.append(el('div', { style: 'font-weight:700', text: c })); series.forEach((s) => t.append(tipRow(o.fmt ? o.fmt(s.vals[i] || 0) : s.vals[i], s.name, s.color))); });
  });
  hline(g, F.m.l, F.m.l + F.iw, y(0), PAL.axis);
}
