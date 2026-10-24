/* =========================================================== MONEY: who pays, where it lands, and the ads it buys */
const MON = D.money || null;
const MV = Object.assign({ race: 'all', side: 'all', sort: 'swing' }, LS.get('moneyView', {}));
const saveMV = () => LS.set('moneyView', MV);

const usd = (v) => {
  if (v == null || isNaN(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return '$' + (v / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
  if (a >= 1e6) return '$' + (v / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (a >= 1e3) return '$' + Math.round(v / 1e3) + 'K';
  return '$' + Math.round(v);
};
const SIDE_NAME = { R: 'Republican side', D: 'Democratic side', I: 'Osborn’s side', X: 'Both parties' };
const sideFill = (s) => (s === 'R' ? PAL.rep : s === 'D' ? PAL.dem : s === 'I' ? PAL.ind : PAL.muted);

function moneyRaces() {
  if (!MON) return [];
  const rank = (r) => (r.id === 'SENATE' ? -2 : r.id === 'HOUSE' ? -1 : r.kind === 'house' ? 1 : 0);
  return MON.races.slice().sort((a, b) => rank(a) - rank(b) || (b.adTotal || 0) - (a.adTotal || 0) || a.id.localeCompare(b.id));
}
function moneyLabel(r) {
  if (r.label) return r.label;
  if (r.id === 'SENATE') return 'Senate control';
  if (r.id === 'HOUSE') return 'House control';
  if (raceById[r.id]) return BOARD_LABEL({ id: r.id });
  return r.name || r.id;
}
// chance of the Democratic (or Osborn) side winning, from the page's blended forecast where it exists
function moneyP(id) {
  if (RES.blend && RES.blend[id]) return RES.blend[id].p;
  if (id === 'HOUSE') return RES.sim.house.pD;
  if (id === 'SENATE') return RES.sim.senate.pD + 0.5 * RES.sim.senate.pHung;
  const i = RES.dists.findIndex((e) => e.dist.district === id);
  if (i >= 0) return RES.sim.districts[i].pD;
  const o = RES.byId[id]; return o ? (o.out ? o.out.pD : o.pD) : null;
}

/* ---------- the three scores */
function swingScore(a) {
  const s = a.score && a.score.swing; if (!s) return null;
  const total = (+s.focus || 0) + (+s.concrete || 0) + (+s.issues || 0) + (+s.reach || 0);
  return { total, parts: s };
}
function accScore(a) {
  const c = a.score && a.score.acc; if (!c || c.score == null) return null;
  return c;
}
function moneyScore(a) {
  const m = a.score && a.score.money; const v = m && +m.amount;
  if (!v) return null;
  const sr = m.race || a.race, p = moneyP(sr);
  const stakes = p == null ? 0 : 3 * (1 - Math.abs(2 * p - 1));
  const reach = Math.max(0, Math.min(7, 7 * (Math.log10(v) - 5) / 3));
  return { total: reach + stakes, reach, stakes, amount: v, basis: m.basis, p, sr };
}
const SCORE_KEYS = {
  swing: { label: 'Swing pull', get: (a) => { const s = swingScore(a); return s ? s.total : null; } },
  acc: { label: 'Accuracy', get: (a) => { const s = accScore(a); return s ? s.score : null; } },
  money: { label: 'Money behind it', get: (a) => { const s = moneyScore(a); return s ? s.total : null; } },
};
function scoreRow(key, a) {
  const K = SCORE_KEYS[key], v = K.get(a);
  const bar = el('span', { class: 'sbar' }, el('i', { style: v == null ? 'width:0' : `width:${Math.max(2, v * 10).toFixed(1)}%` }));
  const row = el('div', { class: 'srow' + (v == null ? ' na' : '') }, el('span', { class: 'sl', text: K.label }), bar, el('span', { class: 'sv', text: v == null ? 'Not rated' : v.toFixed(1) }));
  hoverable(row, (t) => scoreTip(t, key, a));
  return row;
}
function scoreTip(t, key, a) {
  t.append(el('div', { style: 'font-weight:700;margin-bottom:4px', text: SCORE_KEYS[key].label + (SCORE_KEYS[key].get(a) == null ? '' : ': ' + SCORE_KEYS[key].get(a).toFixed(1) + ' of 10') }));
  if (key === 'swing') {
    const s = swingScore(a); if (!s) { t.append(el('div', { class: 'tk', text: (a.score && a.score.swingNote) || 'Not scored: no wording from this ad has been published.' })); return; }
    t.append(tipRow(s.parts.focus + ' / 3', 'one clear message'));
    t.append(tipRow(s.parts.concrete + ' / 3', 'specific, checkable claims'));
    t.append(tipRow(s.parts.issues + ' / 2', 'issues voters rank highest'));
    t.append(tipRow(s.parts.reach + ' / 2', 'reaches past the base'));
    if (a.complete === 'partial') t.append(el('div', { class: 'tk', style: 'margin-top:4px', text: 'Scored from a partial script.' }));
  } else if (key === 'acc') {
    const c = accScore(a);
    if (!c) { t.append(el('div', { class: 'tk', text: 'No fact-check, ad watch or records-based report on this ad’s main claim was found, and the page does not grade claims itself.' })); return; }
    t.append(el('div', { class: 'tk' }, el('b', { text: c.rating || '' }), c.by ? ', ' + c.by : ''));
    if (c.note) t.append(el('div', { class: 'tk', style: 'margin-top:3px', text: c.note }));
  } else {
    const m = moneyScore(a);
    if (!m) { t.append(el('div', { class: 'tk', text: 'No reported dollars behind this ad or its sponsor in this race.' })); return; }
    t.append(tipRow(m.reach.toFixed(1) + ' / 7', 'reach: ' + usd(m.amount) + ' (' + (m.basis || 'reported') + ')'));
    t.append(tipRow(m.stakes.toFixed(1) + ' / 3', 'stakes: ' + (m.sr !== a.race ? moneyLabel(MON.races.find((x) => x.id === m.sr) || { id: m.sr }) + ' at ' : 'race at ') + (m.p == null ? '—' : fp(Math.max(m.p, 1 - m.p))) + ' for the favorite'));
  }
}

/* ---------- Sankey: donors → groups → races */
function drawSankey(host, S, o = {}) {
  const avail = Math.floor(host.clientWidth || 940);
  const compact = avail < 700;   // phones: drop the donor column and use short labels so the chart fits the screen
  const keep = (n) => !compact || n.col >= 1;
  const nodes = S.nodes.filter(keep).map((n) => Object.assign({ inV: 0, outV: 0, ins: [], outs: [] }, n, compact ? { col: n.col - 1, label: n.short || n.label } : {}));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const links = S.links.filter((l) => byId[l.s] && byId[l.t] && l.v > 0).map((l) => Object.assign({}, l));
  links.forEach((l) => { byId[l.s].outV += l.v; byId[l.s].outs.push(l); byId[l.t].inV += l.v; byId[l.t].ins.push(l); });
  nodes.forEach((n) => { n.v = Math.max(n.inV, n.outV); });
  const NC = compact ? 2 : 3;
  const cols = [...Array(NC).keys()].map((c) => nodes.filter((n) => n.col === c && n.v > 0));
  const W = compact ? avail : Math.max(o.minWidth || 940, avail);
  const gap = compact ? 4 : 6, padT = 26, padB = 10, nodeW = compact ? 8 : 10, minSlot = compact ? 25 : 14;
  const maxN = Math.max(...cols.map((c) => c.length));
  const H0 = o.height || Math.max(compact ? 460 : 600, maxN * (compact ? 30 : 36) + padT + padB);
  const k = Math.min(...cols.map((c) => (H0 - padT - padB - gap * (c.length - 1) - minSlot * c.length * 0.5) / c.reduce((s2, n) => s2 + n.v, 0)));
  const xs = compact ? [Math.round(Math.max(106, W * 0.33)), W - Math.round(Math.max(88, W * 0.27)) - nodeW] : [o.padL || 300, Math.round(W * 0.53) - 30, W - (o.padR || 206) - nodeW];
  let H = H0;
  cols.forEach((c, ci) => {
    c.forEach((n) => { n.h = Math.max(1.5, n.v * k); n.slot = Math.max(n.h, minSlot); });
    const used = c.reduce((s2, n) => s2 + n.slot, 0) + gap * (c.length - 1);
    let y = padT + Math.max(0, (H0 - padT - padB - used) / 2);
    c.forEach((n) => { n.x = xs[ci]; n.y = y + (n.slot - n.h) / 2; y += n.slot + gap; });
    H = Math.max(H, y + padB);
  });
  // stack links inside each node, ordered by the far end's position to limit crossings
  nodes.forEach((n) => {
    let y = n.y; n.outs.sort((a, b) => byId[a.t].y - byId[b.t].y).forEach((l) => { l.y0 = y; l.h = l.v * k; y += l.h; });
    y = n.y; n.ins.sort((a, b) => byId[a.s].y - byId[b.s].y).forEach((l) => { l.y1 = y; y += l.v * k; });
  });
  const svg = sv('svg', { width: W, height: Math.ceil(H), viewBox: `0 0 ${W} ${Math.ceil(H)}`, role: 'img', 'aria-label': o.aria || 'Money flow diagram' });
  const scroll = el('div', { class: 'sankey-scroll' }, svg);
  host.replaceChildren(scroll);
  if (compact) host.append(el('p', { class: 'note', style: 'margin:6px 0 0', text: 'On a narrow screen the donor column is hidden. Turn the phone sideways or open the table below to see who gives to each group.' }));
  const gL = sv('g'), gN = sv('g'), gT = sv('g'); svg.append(gL, gN, gT);
  (compact ? ['Groups', 'Races'] : ['Who gives', 'The groups', 'Where it is aimed']).forEach((lab, ci) => txt(gT, compact ? (ci === 0 ? xs[0] - 6 : xs[1] + nodeW + 6) : ci === 0 ? xs[0] + nodeW : ci === 1 ? xs[1] + nodeW / 2 : xs[2], 14, lab, { class: 'lbl', 'text-anchor': compact ? (ci === 0 ? 'end' : 'start') : ci === 0 ? 'end' : ci === 1 ? 'middle' : 'start' }));
  const linkEls = [];
  links.forEach((l) => {
    const s = byId[l.s], t = byId[l.t];
    const x0 = s.x + nodeW, x1 = t.x, xm = (x0 + x1) / 2, h = l.h;
    const d = `M${x0},${l.y0}C${xm},${l.y0} ${xm},${l.y1} ${x1},${l.y1}L${x1},${l.y1 + h}C${xm},${l.y1 + h} ${xm},${l.y0 + h} ${x0},${l.y0 + h}Z`;
    const side = l.side || s.side || t.side;
    const p = sv('path', Object.assign({ d, fill: sideFill(side), opacity: 0.3, class: 'sk-link' + (l.unconfirmed ? ' unconf' : '') }, l.unconfirmed ? { stroke: sideFill(side), 'stroke-width': 1.2, 'stroke-dasharray': '4 3' } : {}));
    p.__l = l; linkEls.push(p); gL.append(p);
    hoverable(p, (tt) => {
      tt.append(el('div', { style: 'font-weight:700', text: s.label + ' → ' + t.label }));
      tt.append(tipRow(usd(l.v), l.basis || '', sideFill(side)));
      if (l.unconfirmed) tt.append(el('div', { class: 'tk', style: 'margin-top:3px;font-weight:600', text: 'Reported, not yet in FEC filings' }));
      if (l.asOf) tt.append(el('div', { class: 'tk', text: 'As of ' + fdAny(l.asOf) + (l.src ? ' · ' + l.src : '') }));
      if (l.note) tt.append(el('div', { class: 'tk', style: 'margin-top:3px;max-width:300px', text: l.note }));
    });
  });
  const focus = (n) => { linkEls.forEach((p) => { const on = !n || p.__l.s === n.id || p.__l.t === n.id; p.setAttribute('opacity', on ? (n ? 0.62 : 0.3) : 0.07); }); };
  nodes.filter((n) => n.v > 0).forEach((n) => {
    const r = sv('rect', { x: n.x, y: n.y, width: nodeW, height: n.h, rx: 2, fill: sideFill(n.side) });
    gN.append(r);
    const hit = sv('rect', { x: n.x - 4, y: n.y - 2, width: nodeW + 8, height: n.h + 4, fill: 'transparent' });
    gN.append(hit);
    hit.addEventListener('pointerenter', () => focus(n)); hit.addEventListener('pointerleave', () => focus(null));
    hoverable(hit, (tt) => {
      tt.append(el('div', { style: 'font-weight:700', text: n.label }));
      const isRace = n.col === NC - 1, isDonor = !compact && n.col === 0;
      if (n.inV) tt.append(tipRow(usd(n.inV), isRace ? 'aimed here by the groups shown' : 'in, from the donors shown'));
      if (n.outV) tt.append(tipRow(usd(n.outV), isDonor ? 'given to the groups shown' : 'out, to the races shown'));
      if (!compact && n.col === 1 && n.inV > n.outV * 1.02) tt.append(tipRow(usd(n.inV - n.outV), 'not placed in these races: cash on hand, or spent elsewhere'));
      if (n.note) tt.append(el('div', { class: 'tk', style: 'margin-top:4px;max-width:300px', text: n.note }));
    });
    // labels: donors to the left of their bar, groups and races to the right; tall nodes get the amount on a second line
    const two = compact || n.h > 22, mid = n.y + n.h / 2 + 4, val = usd(n.v);
    const left = n.col === 0, mid1 = !compact && n.col === 1;
    const lx = left ? n.x - (compact ? 6 : 8) : n.x + nodeW + (mid1 ? 6 : compact ? 6 : 8);
    const anchor = left ? 'end' : 'start', halo = mid1 ? ' halo' : '';
    txt(gT, lx, two ? mid - 6 : mid, two ? n.label : n.label + '  ' + val, { 'text-anchor': anchor, class: 'sk-lab' + halo });
    if (two) txt(gT, lx, mid + 8, val, { 'text-anchor': anchor, class: 'sk-val' + halo });
  });
}

/* ---------- small pieces */
const DONOR_SHORT = { 'Marc Andreessen & Ben Horowitz': 'Andreessen & Horowitz', 'George & Alex Soros': 'Soros family', 'Richard & Elizabeth Uihlein': 'Uihleins', 'Ripple Labs & Chris Larsen': 'Ripple & Larsen', 'Greg & Anna Brockman': 'Brockmans', 'Cameron & Tyler Winklevoss': 'Winklevoss twins', 'American Prosperity Alliance': 'Am. Prosperity Alliance', 'Crypto.com (Foris Dax Inc.)': 'Crypto.com' };
const shortDonor = (d) => DONOR_SHORT[d] || d.replace(/ \(.*\)$/, '');
function splitBar(dV, rV, race) {
  const tot = (dV || 0) + (rV || 0);
  if (!tot) return el('span', { class: 'x', text: '—' });
  // one side missing means not reported, not zero: say so instead of drawing a one-sided bar
  if (!dV || !rV) return el('span', { class: 'x' }, el('b', { text: (dV ? (race && race.dSideInd ? 'Osborn’s side ' : 'D ') + usd(dV) : 'R ' + usd(rV)) }), '; ' + (dV ? 'R' : race && race.dSideInd ? 'Osborn’s side' : 'D') + ' not reported');
  const dPct = (100 * (dV || 0)) / tot;
  const dCol = race && race.dSideInd ? PAL.ind : PAL.dem;
  const bar = el('span', { class: 'split' }, el('i', { style: `width:${dPct.toFixed(1)}%;background:${dCol}` }), el('i', { style: `width:${(100 - dPct).toFixed(1)}%;background:${PAL.rep}` }));
  return el('span', { class: 'splitwrap' }, el('span', { class: 'sv d', text: dV ? usd(dV) : '—' }), bar, el('span', { class: 'sv r', text: rV ? usd(rV) : '—' }));
}
const SENATE_IDS = () => MON.races.filter((x) => /-S$|^OH-SP$/.test(x.id)).map((x) => x.id);
function raceOutside(r) {
  const ids = r.id === 'SENATE' ? SENATE_IDS() : [r.id];
  const L = (MON.flows.links || []).filter((l) => ids.includes(l.t));
  const nodes = Object.fromEntries((MON.flows.nodes || []).map((n) => [n.id, n]));
  const sum = (side) => L.filter((l) => (l.side || (nodes[l.s] || {}).side) === side).reduce((s, l) => s + l.v, 0);
  const top = (side) => L.filter((l) => (l.side || (nodes[l.s] || {}).side) === side).sort((a, b) => b.v - a.v)[0];
  return { D: sum('D') + sum('I'), R: sum('R'), topD: top('D') || top('I'), topR: top('R'), nodes };
}
const cleanName = (n) => String(n || '').replace(/\s*\([^)]*\)/g, '').trim();
// a short label for where a fundraising figure comes from; the full research note stays in the hover title
function fundBasis(x) {
  const b = x.basis || '';
  if (/Secretary of State/i.test(b)) return 'state filing';
  if (/FEC/i.test(b)) return 'FEC filings';
  return 'reported';
}
function fundLine(r) {
  const f = r.fund || []; if (!f.length) return null;
  const order = (x) => (x.party === 'D' || x.party === 'I' ? 0 : 1);
  return el('div', { class: 'fundline' }, f.slice().sort((a, b) => order(a) - order(b)).map((x) => el('span', { class: 'fc' },
    el('span', { class: 'party ' + (x.party === 'I' ? 'I' : x.party === 'R' ? 'R' : 'D'), text: x.party === 'I' ? 'I' : x.party || '?' }),
    ' ', el('b', { text: cleanName(x.name) }), x.raised != null ? [' raised ', el('b', { text: usd(x.raised) }), x.period ? ' in ' + x.period : ''] : '',
    x.cash != null ? (x.raised != null ? ', ' : ' had ') + usd(x.cash) + ' on hand' + (x.cashAsOf && x.cashAsOf !== x.asOf ? ' on ' + fdAny(x.cashAsOf) : '') : '',
    el('span', { class: 'x', title: x.basis || '', text: ' (' + (x.announced ? 'announced by the campaign' : fundBasis(x)) + (x.asOf ? (x.period ? ', ' : ', through ') + fdAny(x.asOf) : '') + ')' }), ' ', link(x.url, '↗'),
    x.extra && x.extra.raised ? el('span', null, '; ', el('b', { text: usd(x.extra.raised) }), ' ' + (x.extra.announced ? 'announced' : 'reported') + ' for ' + (x.extra.period || 'a later period') + ' ', link(x.extra.url, '↗')) : null)));
}

/* ---------- ad card */
function adCard(a) {
  const r = MON.races.find((x) => x.id === a.race) || {};
  const race = raceById[a.race];
  const sideCls = a.side === 'R' ? 'R' : a.side === 'I' ? 'I' : 'D';
  const sc = a.score || {};
  const watch = a.yt ? el('a', { class: 'btn small', href: a.yt, target: '_blank', rel: 'noopener noreferrer' }, 'Watch on YouTube') : a.video ? el('a', { class: 'btn small', href: a.video, target: '_blank', rel: 'noopener noreferrer' }, 'Watch the ad') : el('span', { class: 'x', text: 'No public video link found' });
  const claims = (a.factChecks || []).filter((f) => f && (f.rating || f.url));
  return el('article', { class: 'adcard side-' + sideCls, id: 'ad-' + a.id },
    el('div', { class: 'adtop' }, el('span', { class: 'party ' + sideCls, text: sideCls }), el('span', { class: 'spons', text: a.sponsor || 'Unknown sponsor' }), el('span', { class: 'when', text: [a.date ? fdAny(a.date) : null, a.len ? Math.round(a.len) + ' sec' : null].filter(Boolean).join(', ') })),
    el('h4', { text: a.title ? '“' + a.title.replace(/^["“]|["”]$/g, '') + '”' : sc.head || (a.desc ? a.desc.charAt(0).toUpperCase() + a.desc.slice(1) : 'Untitled ad') }),
    !a.title ? el('div', { class: 'adrace', text: 'Title not published' }) : null,
    MV.race === 'all' ? el('div', { class: 'adrace', text: moneyLabel(r) }) : null,
    el('p', { class: 'adsum' }, rich(sc.summary || 'Summary not written yet.')),
    el('div', { class: 'scores' }, scoreRow('swing', a), scoreRow('acc', a), scoreRow('money', a)),
    el('div', { class: 'adlinks' }, watch, a.transcriptSrc ? link(a.transcriptSrc, 'Script source ↗') : null, a.coverage && a.coverage !== a.transcriptSrc ? link(a.coverage, 'Coverage ↗') : null),
    a.transcript ? el('details', { class: 'script' }, el('summary', null, a.complete === 'full' ? 'Read the full script' : 'Read the published excerpts'),
      el('blockquote', null, a.transcript.split(/\n+/).map((p) => el('p', { text: p }))),
      a.complete !== 'full' ? el('p', { class: 'note', text: 'Only part of this ad’s script has been published; quoted lines are exact, and the rest is not shown.' }) : null)
      : el('p', { class: 'note', text: 'No published script was found for this ad.' }),
    claims.length ? el('details', { class: 'script fchecks' }, el('summary', null, 'Fact-checks and claim notes (' + claims.length + ')'), claims.map((f) => el('div', { class: 'fc' }, f.claim ? el('b', { text: '“' + f.claim + '” ' }) : null, el('span', { text: f.rating || '' }), ' ', el('span', { class: 'x', text: f.by || '' }), ' ', link(f.url, '↗')))) : null);
}

/* ---------- the view */
function viewMoney() {
  const root = el('div');
  if (!MON || !MON.races.length) { root.append(el('div', { class: 'empty', text: 'Money research was not available for this build.' })); return root; }
  const races = moneyRaces();
  const allAds = races.flatMap((r) => r.ads.map((a) => a));
  const N = MON.national || {};
  root.append(sectionHead('', 'Follow the money',
    'Who is paying for the 2026 fight, where the money is aimed, and what it buys. Figures come from FEC filings and from AdImpact’s ad tracking as reported by news outlets through **Oct 12**. Third-quarter reports (through Sept 30) are due Oct 15, so most filed totals run through June or August; announced or reported figures are labeled as such.'));

  // the flow
  const F = MON.flows || {};
  root.append(chartCard('Where the big money flows',
    F.note || 'Documented gifts from the largest donors to the groups spending in these races (left), and what each group has spent or reserved in each race (right). Link width is dollars. A group’s money in and money out need not match: some is still in the bank or spent in other races. Hover a band or a group for the basis and date.',
    (host) => drawSankey(host, F, { aria: 'Money flow from donors to groups to races' }),
    el('div', null, legend([{ color: PAL.rep, label: 'Republican-aligned' }, { color: PAL.dem, label: 'Democratic-aligned' }, { color: PAL.ind, label: 'Backing Osborn (independent)' }, { color: PAL.muted, label: 'Nonpartisan or both parties' }]),
      (F.links || []).some((l) => l.unconfirmed) ? el('p', { class: 'note', style: 'margin:6px 0 0' }, 'Dashed bands are gifts reported on Oct 12 that are not yet in FEC filings. Their amounts come from summaries of a New York Times report and are not confirmed by the Times article itself or another major outlet.') : null)));
  root.append(el('details', { class: 'card flowtable', style: 'margin-top:12px' }, el('summary', null, 'Show the flows as a table'),
    el('div', { class: 'tbl-wrap', style: 'margin-top:10px' }, el('table', { class: 't' },
      el('thead', null, el('tr', null, ['From', 'To', 'Amount', 'Basis', 'As of', ''].map((h, i) => el('th', { class: i === 2 ? 'n' : '', text: h })))),
      el('tbody', null, (F.links || []).slice().sort((a, b) => b.v - a.v).map((l) => {
        const s = (F.nodes || []).find((n) => n.id === l.s) || {}, t = (F.nodes || []).find((n) => n.id === l.t) || {};
        return el('tr', null, el('td', { text: s.label || l.s }), el('td', { text: t.label || l.t }), el('td', { class: 'n', text: usd(l.v) }), el('td', { class: 'x', text: l.basis || '' }), el('td', { class: 'x', text: l.asOf ? fdAny(l.asOf) : '' }), el('td', null, link(l.url, '↗')));
      }))))));

  // donors and context
  // cycle totals only: Musk's entry is the Times's cycle tally, and nonprofits that pass money through are left out
  const named = (N.donors || []).filter((d) => d.amount && (d.donor !== 'Elon Musk' || /cycle total/.test(d.to || '')));
  const topDonors = named.filter((d) => d.kind !== 'nonprofit' && !/\(501\(c\)/.test(d.donor) && !/does not disclose/.test(d.donor)).sort((a, b) => b.amount - a.amount).slice(0, 14);
  const BOTH_SIDES = ['Marc Andreessen & Ben Horowitz'];   // most of their money went to industry PACs that back both parties
  const agg = N.aggregates || [];
  const ctx = (N.contextLines || F.context || []);
  root.append(el('div', { class: 'grid g-main', style: 'margin-top:18px' },
    chartCard('The biggest donors this cycle', F.donorNote || 'Largest reported individual and corporate donors to federal races in 2025–26, colored by the side their money mostly backs. Musk’s figure is his giving since July, per The New York Times.',
      (host) => drawHBars(host, topDonors.map((d) => ({ label: (host.clientWidth || 600) < 520 ? shortDonor(d.donor) : d.donor.replace(/ \(.*\)$/, ''), v: d.amount / 1e6, color: BOTH_SIDES.includes(d.donor) ? PAL.muted : /^R/.test(d.side || '') ? PAL.rep : /^D/.test(d.side || '') ? PAL.dem : PAL.muted, vl: usd(d.amount), tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: d.donor })); t.append(tipRow(usd(d.amount), d.to || '')); t.append(el('div', { class: 'tk', text: (d.source || '') + (d.as_of ? ', ' + fdAny(d.as_of) : '') })); } })), { fmt: (v) => '$' + v + 'M', nTicks: (host.clientWidth || 600) < 520 ? 2 : 4 }),
      legend([{ color: PAL.rep, label: 'Mostly Republican' }, { color: PAL.dem, label: 'Mostly Democratic' }, { color: PAL.muted, label: 'Industry money backing both parties' }])),
    el('div', { class: 'card', style: 'align-self:start' }, el('h3', { text: 'Context for the donor list' }),
      ctx.map((c) => el('div', { class: 'evid' }, el('span', { class: 'ev', style: 'font-size:17px', text: c.v || '' }), el('span', { class: 'ec' }, rich(c.text)), el('span', { class: 'es' }, c.src || '', ' ', link(c.url, '↗')))))));

  // race ledger
  root.append(sectionHead('', 'Race by race', 'Ad spending, outside money and candidate fundraising for every race on this page. Click a race to see its ads.'));
  const ledger = el('tbody', null, races.map((r) => {
    const o = raceOutside(r), race = raceById[r.id];
    const p = moneyP(r.id);
    const tr = el('tr', { class: 'clickable', tabindex: '0' },
      el('td', null, el('b', { text: moneyLabel(r) }), r.headline ? el('div', { class: 'x', text: r.headline }) : null),
      el('td', { class: 'n' }, p == null ? '—' : el('span', { class: 'chip ' + (p >= 0.5 ? 'pill-d' : 'pill-r') }, el('span', { class: 'party ' + (p >= 0.5 ? (race && race.dSideInd ? 'I' : 'D') : 'R'), text: p >= 0.5 ? (race && race.dSideInd ? 'I' : 'D') : 'R' }), fp(Math.max(p, 1 - p)))),
      el('td', { class: 'n' }, el('b', { text: r.adTotal ? usd(r.adTotal) : '—' }), r.adBasis ? el('div', { class: 'x', text: r.adBasis }) : null),
      el('td', null, r.adD || r.adR ? splitBar(r.adD, r.adR, race) : el('span', { class: 'x', text: 'split not reported' })),
      el('td', null, o.D || o.R ? splitBar(o.D, o.R, race) : r.outD || r.outR ? splitBar(r.outD, r.outR, race) : el('span', { class: 'x', text: r.outNote ? 'see race' : '—' })),
      el('td', { class: 'n', text: String(r.ads.length) }));
    const go = () => { MV.race = r.id; saveMV(); rerenderView(); requestAnimationFrame(() => { const t = document.getElementById('ads-anchor'); if (t) t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }); };
    tr.addEventListener('click', go); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    return tr;
  }));
  root.append(el('div', { class: 'tbl-wrap ledger' }, el('table', { class: 't' },
    el('thead', null, el('tr', null, ['Race', 'Forecast', 'Ad spending', 'Ads by side (D | R)', 'Outside groups (D | R)', 'Ads here'].map((h, i) => el('th', { class: i === 1 || i === 2 || i === 5 ? 'n' : '', text: h })))),
    ledger)));
  root.append(el('p', { class: 'note', style: 'margin:8px 2px 0' }, 'Ad spending is AdImpact’s tracking as reported in news coverage; bases differ by race (spent to date, or spent plus reserved through Election Day) and are noted under each total. Outside groups are the commitments in the flow chart above. “Forecast” is this page’s blended chance for the favorite.'));

  // ads
  root.append(el('div', { id: 'ads-anchor' }));
  root.append(sectionHead('', 'The ads', 'Each side’s most recent ads in every race, chosen by the same rule for both sides, with a link to the video, the published script, a summary and three scores. Hover a score for how it was reached; the method is at the bottom of this tab.'));
  const raceSel = el('select', { 'aria-label': 'Race', onchange: (e) => { MV.race = e.target.value; saveMV(); rerenderView(); } },
    el('option', { value: 'all', text: 'All races (' + allAds.length + ' ads)' }), races.filter((r) => r.ads.length).map((r) => el('option', { value: r.id, text: moneyLabel(r) + ' (' + r.ads.length + ')' })));
  raceSel.value = races.some((r) => r.id === MV.race) ? MV.race : 'all';
  const seg = (key, opts) => el('div', { class: 'seg' }, opts.map(([v, l]) => el('button', { 'aria-pressed': MV[key] === v ? 'true' : 'false', onclick: () => { MV[key] = v; saveMV(); rerenderView(); } }, l)));
  root.append(el('div', { class: 'row filters' }, raceSel, seg('side', [['all', 'Both sides'], ['D', 'Democratic side'], ['R', 'Republican side']]), el('span', { class: 'x', text: 'Sort by' }), seg('sort', [['swing', 'Swing pull'], ['acc', 'Accuracy'], ['money', 'Money behind it'], ['date', 'Newest']])));
  let ads = allAds.filter((a) => (MV.race === 'all' || a.race === MV.race) && (MV.side === 'all' || (MV.side === 'D' ? a.side === 'D' || a.side === 'I' : a.side === MV.side)));
  const sk = MV.sort === 'date' ? (a) => a.date || '' : SCORE_KEYS[MV.sort] ? SCORE_KEYS[MV.sort].get : SCORE_KEYS.swing.get;
  ads.sort((a, b) => { const x = sk(a), y = sk(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return x > y ? -1 : x < y ? 1 : 0; });
  if (MV.race !== 'all') {
    const r = races.find((x) => x.id === MV.race);
    if (r) {
      const o = raceOutside(r), race = raceById[r.id];
      root.append(el('div', { class: 'card racemoney' },
        el('h3', { text: moneyLabel(r) }),
        r.cands && Object.keys(r.cands).length ? el('p', { class: 'sub', text: Object.entries(r.cands).map(([k, v]) => { const inc = /incumbent/i.test(v); return cleanName(v) + ' (' + k + (inc ? ', incumbent' : '') + ')'; }).join(' vs ') }) : null,
        el('div', { class: 'kv' },
          el('span', { class: 'k', text: 'Ad spending' }), el('span', null, el('b', { text: r.adTotal ? usd(r.adTotal) : 'not reported' }), ' ', link(r.adUrl, '↗'), r.adBasis && r.adTotal ? el('div', { class: 'x', style: 'margin-top:2px', text: r.adBasis.charAt(0).toUpperCase() + r.adBasis.slice(1) + (r.adAsOf ? '. As of ' + fdAny(r.adAsOf) + '.' : '.') }) : null),
          el('span', { class: 'k', text: 'Ads by side' }), r.adD || r.adR ? splitBar(r.adD, r.adR, race) : el('span', { class: 'x', text: 'split not reported' }),
          el('span', { class: 'k', text: 'Outside groups' }), o.D || o.R ? el('span', null, splitBar(o.D, o.R, race), el('div', { class: 'x', style: 'margin-top:4px', text: [o.topR ? 'Largest on the Republican side: ' + ((o.nodes[o.topR.s] || {}).label || o.topR.s) + ' ' + usd(o.topR.v) : null, o.topD ? 'largest on the other side: ' + ((o.nodes[o.topD.s] || {}).label || o.topD.s) + ' ' + usd(o.topD.v) : null].filter(Boolean).join('; ') }))
            : r.outD || r.outR ? el('span', null, splitBar(r.outD, r.outR, race), r.outBasis ? el('div', { class: 'x', style: 'margin-top:4px', text: r.outBasis }) : null)
            : el('span', { class: 'x', text: r.outNote || 'not reported' }),
          el('span', { class: 'k', text: 'Candidates' }), fundLine(r) || el('span', { class: 'x', text: 'not reported' })),
        r.story ? el('p', { class: 'note', style: 'margin-top:8px', text: r.story }) : null,
        el('button', { class: 'btn small', style: 'margin-top:10px', onclick: () => { MV.race = 'all'; saveMV(); rerenderView(); } }, 'Show ads from every race')));
    }
  }
  root.append(ads.length ? el('div', { class: 'adgrid' }, ads.map(adCard)) : el('div', { class: 'empty', text: 'No ads match these filters.' }));

  // scoreboard
  const sbBody = el('tbody', null, allAds.slice().sort((a, b) => (SCORE_KEYS.swing.get(b) ?? -1) - (SCORE_KEYS.swing.get(a) ?? -1)).map((a) => {
    const r = MON.races.find((x) => x.id === a.race) || {};
    const v = (k) => { const x = SCORE_KEYS[k].get(a); return x == null ? '—' : x.toFixed(1); };
    const tr = el('tr', { class: 'clickable', tabindex: '0' }, el('td', null, el('span', { class: 'party ' + (a.side === 'R' ? 'R' : a.side === 'I' ? 'I' : 'D'), text: a.side || '?' }), ' ', el('b', { text: a.title ? '“' + a.title.replace(/^["“]|["”]$/g, '') + '”' : (a.score && a.score.head) || (a.desc ? a.desc.charAt(0).toUpperCase() + a.desc.slice(1) : 'Untitled ad') }), el('div', { class: 'x', text: (a.sponsor || '') + ', ' + moneyLabel(r) })), el('td', { class: 'n', text: v('swing') }), el('td', { class: 'n', text: v('acc') }), el('td', { class: 'n', text: v('money') }));
    const go = () => { MV.race = a.race; MV.side = 'all'; saveMV(); rerenderView(); requestAnimationFrame(() => { const t = document.getElementById('ad-' + a.id); if (t) { t.scrollIntoView({ block: 'center' }); t.classList.add('flash'); } }); };
    tr.addEventListener('click', go); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    return tr;
  }));
  root.append(el('details', { class: 'card', style: 'margin-top:18px' }, el('summary', null, 'Scoreboard: every ad’s three scores in one table'),
    el('div', { class: 'tbl-wrap', style: 'margin-top:10px' }, el('table', { class: 't' }, el('thead', null, el('tr', null, ['Ad', 'Swing pull', 'Accuracy', 'Money behind it'].map((h, i) => el('th', { class: i ? 'n' : '', text: h })))), sbBody))));

  // groups and totals
  const groups = (N.groups || []).filter((g) => g.raised || g.cash_on_hand || g.reserved);
  root.append(sectionHead('', 'The groups behind the ads', 'Party committees and the largest super PACs, from their latest FEC filings, with fall ad reservations where reported. Groups that file monthly are current through Aug 31; quarterly filers through June 30.'));
  root.append(el('div', { class: 'tbl-wrap' }, el('table', { class: 't' },
    el('thead', null, el('tr', null, ['Group', 'Type', 'Raised', 'Spent', 'Cash on hand', 'Fall reservations', 'Through', ''].map((h, i) => el('th', { class: i >= 2 && i <= 5 ? 'n' : '', text: h })))),
    el('tbody', null, groups.map((g) => el('tr', null,
      el('td', null, el('span', { class: 'party ' + (/^R/.test(g.side) ? 'R' : /^D/.test(g.side) ? 'D' : 'X'), text: /^R/.test(g.side) ? 'R' : /^D/.test(g.side) ? 'D' : '·' }), ' ', el('b', { text: g.group })),
      el('td', { class: 'x', text: g.type || '' }), el('td', { class: 'n', text: usd(g.raised) }), el('td', { class: 'n', text: usd(g.spent) }), el('td', { class: 'n', text: usd(g.cash_on_hand) }), el('td', { class: 'n', text: usd(g.reserved) }),
      el('td', { class: 'x', text: g.as_of ? fdAny(g.as_of) : '' }), el('td', null, link(g.url, '↗'))))))));
  const tot = (N.adTotals || []).filter((x) => x.amount);
  if (tot.length) root.append(el('div', { class: 'card', style: 'margin-top:18px' }, el('h3', { text: 'All the ad money' }), el('p', { class: 'sub', text: 'AdImpact’s tracking and projections for the 2025–26 cycle, plus other measures of the money, each with its own basis.' }),
    tot.slice(0, 12).map((x) => el('div', { class: 'evid' }, el('span', { class: 'ev', style: 'font-size:17px', text: (x.amount_qualifier ? '~' : '') + usd(x.amount) }), el('span', { class: 'ec' }, el('b', { text: x.measure }), x.basis ? '. ' + x.basis : ''), el('span', { class: 'es' }, (x.source || '') + (x.as_of ? ', ' + fdAny(x.as_of) : ''), ' ', link(x.url, '↗'))))));

  // method
  const M = MON.method || {};
  root.append(el('div', { class: 'card method-card', style: 'margin-top:18px' }, el('h3', { text: 'How the ads are chosen and scored' }),
    el('div', { class: 'grid g2', style: 'gap:18px' },
      el('div', null, el('h4', { text: 'Choosing the ads' }), el('p', { class: 'sub', text: M.choose || 'The same rule for both sides in every race: the ad with the most reported spending or airings when coverage names one; otherwise the campaign’s most recent general-election ad and the largest allied outside group’s most recent ad, counting Senate Leadership Fund and One Nation as one group; and when that ad’s wording was never published, the most recent one with published wording that states at least one of its claims. Party committees’ ads sit under the national Senate and House entries, except the NRSC’s joint ads for Sununu in New Hampshire, which stand in for his campaign. No AdImpact ranking of top ads was found in any race, so nearly every pick comes from the second and third steps; V-PAC’s June ad in Ohio is the exception. Where nothing newer turned up, older ads stand in and are dated on each card, such as Peltola’s first general-election ad, Minnesota videos posted only on X, and DSCC and NRCC ads from 2025. Scripts are quoted only from published sources (campaign releases, news ad watches, fact-checks), and partial scripts are marked.' }),
        el('h4', { text: 'Swing pull, 0–10' }), el('p', { class: 'sub', text: M.swing || 'An editorial judgment applied the same way to both sides, from the published wording: one clear message (0–3); specific, checkable claims such as votes, numbers or the opponent’s own words (0–3); the issue the ad leads with (0–2), where the three issues most voters call very important to their vote in Pew’s Sept 28–Oct 4 survey score 2 (the economy, 84%; the future of democracy, 73%; health care, 68%) and any other policy issue 1; and appeal beyond the sponsor’s base, such as a cross-party validator or a break with one’s own party (0–2). A party label or tie as the hook scores 0 on that last part in both directions, whether “liberal” or “socialist” on one side or “in lockstep with Trump” on the other; a label used only in passing does not. Ads whose published wording states none of their claims are not scored, and neither are turnout appeals to a party’s own supporters. It describes how an ad is built, not whether it will work; experiments find most ads move few votes (see Information age).' })),
      el('div', null, el('h4', { text: 'Accuracy, 0–10' }), el('p', { class: 'sub', text: M.acc || 'Taken from an independent fact-check, a newsroom ad watch or a records-based news report on the ad’s main claim, mapped to a 10-point scale: PolitiFact’s True 10, Mostly True 8, Half True 5, Mostly False 3, False 1 and Pants on Fire 0, with unrated findings placed on the same steps (supported 10, largely supported 8, mixed or misleading without context 5, largely contradicted 3, contradicted or false 1). It also counts a check of the same claim made elsewhere by the same side, the candidate or an allied group, when the check gives a verdict or a clear finding. Hover a score for the finding and its source. Ads without such a check, and ads whose wording was never published, show “Not rated”: the page does not grade claims itself.' }),
        el('h4', { text: 'Money behind it, 0–10' }), el('p', { class: 'sub', text: M.money || 'Reach (0–7): the dollars behind the ad, meaning its reported buy or, when that is not reported, its sponsor’s own total in that race, on a log scale from $100K (0) to $100M (7). A partial figure for one platform, such as YouTube alone, does not count as the buy, and a candidate’s figure combined with allies’ is not used for one sponsor. Stakes (0–3): 3 × how close the race is in this page’s current blended forecast (a 50–50 race scores 3; a 90–10 race 0.6). Stakes update with the forecast. Ads with no reported dollars show “Not rated”.' }))),
    el('div', { style: 'margin-top:14px' }, el('h4', { text: 'Reading the scores across ads' }), el('p', { class: 'sub', text: M.compare || 'These ads are not a random sample, so averages say little about either party. Senate Leadership Fund’s releases print no scripts, so in North Carolina, Georgia, Maine, New Hampshire and Ohio its picks are older ads whose wording reached print through news coverage or fact-checks, while Democratic groups print their scripts and their picks are their newest ads. Three of the nine graded Republican-side ads were picked that way (graded 1, 1 and 3); without them, the two sides’ average accuracy grades differ by about 0.3 points instead of 1.3. On swing pull, Democratic-side ads here average about a point higher, mostly because more Republican-side ads lead with issues outside the top three or use a party label as their hook.' })),
    (F.gaps || []).length ? el('div', { style: 'margin-top:14px' }, el('h4', { text: 'What this tab could not find' }), el('ul', { class: 'gaps' }, F.gaps.map((g) => el('li', { text: g })))) : null));
  return root;
}
