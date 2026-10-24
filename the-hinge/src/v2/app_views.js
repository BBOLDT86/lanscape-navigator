/* =========================================================== shared bits */
const raceById = Object.fromEntries(D.races.map((r) => [r.id, r]));
const dl = (race) => (race && race.dSideInd ? 'I' : 'D');
const RATING_SHORT = { 'Toss-up': 'Toss-up', 'Tossup': 'Toss-up', 'Tilt D': 'Tilt D', 'Tilt R': 'Tilt R', 'Lean D': 'Lean D', 'Lean R': 'Lean R', 'Likely D': 'Likely D', 'Likely R': 'Likely R', 'Safe D': 'Safe D', 'Safe R': 'Safe R', 'Solid D': 'Safe D', 'Solid R': 'Safe R' };
function ratingLine(rt) {
  if (!rt) return '';
  const parts = [];
  if (rt.cook) parts.push('Cook ' + (RATING_SHORT[rt.cook] || rt.cook));
  if (rt.sabato) parts.push('Sabato ' + (RATING_SHORT[rt.sabato] || rt.sabato));
  if (rt.ie) parts.push('IE ' + (RATING_SHORT[rt.ie] || rt.ie));
  return parts.join(' · ');
}
function winnerChip(pD, race) {
  const d = pD >= 0.5, p = d ? pD : 1 - pD, side = d ? dl(race) : 'R';
  return el('span', { class: 'chip ' + (d ? 'pill-d' : 'pill-r') }, el('span', { class: 'party ' + (d && race && race.dSideInd ? 'I' : d ? 'D' : 'R'), text: side }), fp(p));
}
function meter(parts) { // parts: [{p, color}]
  return el('div', { class: 'meter' }, parts.map((x) => el('i', { style: `width:${(x.p * 100).toFixed(1)}%;background:${x.color}` })));
}
function sectionHead(kicker, title, sub, right) {
  // the kicker is a quiet margin note beside the heading, not an eyebrow above it
  return el('div', { class: 'sec-head' }, el('div', { class: 'sec-title' }, el('h2', { text: title }), sub ? el('p', null, rich(sub)) : null), right || (kicker ? el('div', { class: 'kicker', text: kicker }) : null));
}
function chartCard(title, sub, drawFn, extra) {
  const host = el('div', { class: 'chart' });
  const card = el('div', { class: 'card' }, title ? el('h3', { text: title }) : null, sub ? el('p', { class: 'sub' }, rich(sub)) : null, extra || null, host);
  CHARTS.push(() => drawFn(host));
  return card;
}
let CHARTS = [];
function drawCharts() { CHARTS.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }
function legend(items) { return el('div', { class: 'legend' }, items.map((it) => el('span', null, el('i', { class: it.cls || (it.line ? 'line' : ''), style: (it.cls === 'dash' ? 'color:' : 'background:') + it.color }), it.label))); }

/* =========================================================== race card + drawer */
function raceCard(race) {
  const x = RES.byId[race.id]; if (!x) return null;
  const { est, out } = x;
  const pD = out.pD, med = out.med;
  const card = el('button', { class: 'race', type: 'button', onclick: () => openRace(race.id) },
    el('div', { class: 'top' }, el('span', { class: 'st', text: race.name + (race.special ? ' (special)' : race.office === 'Governor' ? ' · Gov' : '') }), el('span', { class: 'rt', text: ratingLine(race.ratings) })),
    el('div', { class: 'cands' },
      el('span', null, el('span', { class: 'party ' + (race.dSideInd ? 'I' : 'D'), text: race.dSideInd ? 'I' : 'D' }), ' ', race.dem || 'TBD', race.incParty === 'D' && race.incumbent ? ' (inc.)' : ''),
      el('span', { class: 'p', text: fp(pD) }),
      el('span', null, el('span', { class: 'party R', text: 'R' }), ' ', race.rep || 'TBD', race.incParty === 'R' && race.incumbent ? ' (inc.)' : ''),
      el('span', { class: 'p', text: fp(1 - pD) })),
    el('div', { class: 'bar' }, el('i', { style: `width:${pD * 100}%;background:${race.dSideInd ? PAL.ind : PAL.dem}` }), el('i', { style: `width:${(1 - pD) * 100}%;background:${PAL.rep}` })),
    el('div', { class: 'foot' }, el('span', null, 'Model ', el('b', { class: 'lean ' + sideOf(med), text: fm(med, dl(race)) })), el('span', { text: est.pa.k ? est.pa.k + ' poll' + (est.pa.k > 1 ? 's' : '') + (est.A != null ? ' · avg ' + fm(est.pa.rawAvg, dl(race)) : '') : 'no public polls' })));
  return card;
}
function openDrawer(build) {
  const box = $('#drawerIn'); box.replaceChildren();
  box.append(el('button', { class: 'btn small close', onclick: closeDrawer, 'aria-label': 'Close' }, '✕ Close'));
  build(box);
  $('#drawer').classList.add('on'); $('#scrim').classList.add('on');
  $('#drawer').scrollTop = 0;
  requestAnimationFrame(drawCharts);
}
function closeDrawer() { $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); DRAWER = null; tipHide(); }
let DRAWER = null;
function openRace(id) { DRAWER = { kind: 'race', id }; renderRaceDrawer(id); }
function renderRaceDrawer(id) {
  const race = raceById[id]; const x = RES.byId[id]; if (!race || !x) return;
  const { est, out } = x; const L = dl(race);
  CHARTS = CHARTS.filter((f) => !f.drawer);
  openDrawer((box) => {
    box.append(el('div', { class: 'kicker', text: (race.office === 'Governor' ? 'Governor' : 'U.S. Senate') + (race.special ? ' · special election' : '') }));
    box.append(el('h2', { class: 'sec-title', style: 'font:600 30px/1.1 var(--f-display);margin:6px 0 4px', text: race.name }));
    box.append(el('p', { class: 'sub', text: ratingLine(race.ratings) || race.ratingNote || 'Not rated' }));
    const pW = out.pD >= 0.5 ? out.pD : 1 - out.pD, lead = out.pD >= 0.5 ? (race.dem || L) : (race.rep || 'R');
    box.append(el('div', { class: 'grid g2', style: 'margin:14px 0' },
      el('div', { class: 'tile' }, el('span', { class: 'lab', text: 'Win probability' }), el('span', { class: 'val' }, fp(pW), ' ', el('small', { text: lead })),
        meter([{ p: out.pD, color: race.dSideInd ? PAL.ind : PAL.dem }, { p: 1 - out.pD, color: PAL.rep }]),
        el('span', { class: 'foot', text: `${race.dem || L} ${fp(out.pD)} · ${race.rep || 'R'} ${fp(1 - out.pD)}` })),
      el('div', { class: 'tile' }, el('span', { class: 'lab', text: 'Projected margin' }), el('span', { class: 'val' }, el('span', { class: 'lean ' + sideOf(out.med), text: fm(out.med, L) })),
        el('span', { class: 'foot', text: `80% range ${fm(out.lo, L)} to ${fm(out.hi, L)} · 90% ${fm(out.lo05, L)} to ${fm(out.hi95, L)}` }))));
    // candidates + context
    box.append(el('div', { class: 'card flat', style: 'margin-bottom:14px' },
      el('div', { class: 'wf' },
        el('span', { class: 'k' }, el('span', { class: 'party ' + (race.dSideInd ? 'I' : 'D'), text: L }), ' ', race.dem || (race.fixedPrior != null ? 'Democratic nominee (not tracked)' : 'TBD')), el('span', { class: 'v', text: race.incParty === 'D' && race.incumbent ? (race.dem ? 'incumbent' : race.incumbent + ' holds the seat') : '' }),
        el('span', { class: 'k' }, el('span', { class: 'party R', text: 'R' }), ' ', race.rep || (race.fixedPrior != null ? 'Republican nominee (not tracked)' : 'TBD')), el('span', { class: 'v', text: race.incParty === 'R' && race.incumbent ? (race.rep ? (race.appointed ? 'appointed incumbent' : 'incumbent') : race.incumbent + ' holds the seat') : '' }),
        race.others ? el('span', { class: 'k', text: 'Also on ballot: ' + race.others }) : null, race.others ? el('span') : null,
        el('span', { class: 'k', text: '2024 presidential margin in state' }), el('span', { class: 'v', text: (race.pres24Approx ? '≈ ' : '') + fm(race.pres24) }),
        race.prior ? el('span', { class: 'k', text: 'Last result for this seat' }) : null, race.prior ? el('span', { class: 'v', text: race.prior }) : null)));
    // waterfall
    const wf = el('div', { class: 'wf' });
    est.steps.forEach((st) => { wf.append(el('span', { class: 'k', text: st.k }), el('span', { class: 'v', text: fm(st.v, L) })); });
    wf.append(el('span', { class: 'k', text: 'Fundamentals prior (state lean + national environment' + (race.cand ? ' + candidate record' : '') + ')' }), el('span', { class: 'v', text: fm(est.F, L) }));
    if (est.A != null) wf.append(el('span', { class: 'k', text: 'Weight on polls vs fundamentals' }), el('span', { class: 'v', text: Math.round(est.wPolls * 100) + '% / ' + Math.round((1 - est.wPolls) * 100) + '%' }));
    wf.append(el('span', { class: 'k', text: 'Race-specific uncertainty (1σ, before national error)' }), el('span', { class: 'v', text: '±' + est.sigPost.toFixed(1) }));
    box.append(el('div', { class: 'card', style: 'margin-bottom:14px' }, el('h3', { text: 'How the estimate is built' }), el('p', { class: 'sub', text: 'Each step of the calibrated algorithm, in margin points. The simulation then adds a shared national polling error, a regional error and this race’s own error.' }), wf,
      race.candNote ? el('p', { class: 'note', style: 'margin:10px 0 0' }, rich(race.candNote)) : null));
    // polls chart + table
    const polls = pollsFor(id);
    if (polls.length) {
      const host = el('div', { class: 'chart' });
      const f = () => drawPollTrend(host, polls, race);
      f.drawer = true; CHARTS.push(f);
      box.append(el('div', { class: 'card', style: 'margin-bottom:14px' }, el('h3', { text: 'Polls and the running average' }), el('p', { class: 'sub', text: 'Dots are individual polls (margin, by field end date); hollow dots are partisan-sponsored; the line is the algorithm’s average as it stood each day.' }), host));
      box.append(pollTable(polls, est.pa, race));
    } else box.append(el('div', { class: 'empty', text: 'No public general-election polls found yet — the estimate leans on fundamentals. Add one on the Tracker tab.' }));
    // external averages
    if (race.ext && race.ext.length) box.append(el('div', { class: 'card flat', style: 'margin:14px 0' }, el('h3', { text: 'Other averages' }), el('div', { class: 'wf' }, race.ext.flatMap((a) => [el('span', { class: 'k' }, a.src, ' · ', fd(a.date), ' ', link(a.url, '↗')), el('span', { class: 'v', text: a.val })]))));
    // messaging
    if (race.msgD || race.msgR) {
      box.append(el('div', { class: 'grid g2', style: 'margin:14px 0' },
        el('div', { class: 'msg ' + (race.dSideInd ? 'I' : 'D') }, el('b', { text: (race.dem || L) + ' is saying' }), el('p', null, rich(race.msgD || '—'))),
        el('div', { class: 'msg R' }, el('b', { text: (race.rep || 'R') + ' is saying' }), el('p', null, rich(race.msgR || '—')))));
    }
    if (race.notes) box.append(el('div', { class: 'callout', style: 'margin:14px 0' }, rich(race.notes)));
    if (race.debates && race.debates.length) box.append(el('div', { class: 'card flat', style: 'margin:14px 0' }, el('h3', { text: 'Debates' }), el('ul', { style: 'margin:0;padding-left:18px;font-size:13.5px' }, race.debates.map((d) => el('li', null, el('b', { text: d.date ? fdy(d.date) + ' — ' : '' }), d.desc || '', ' ', link(d.url, '↗'))))));
    // election-night call
    box.append(callControl(id, race));
    if (race.sources && race.sources.length) box.append(el('p', { class: 'note', style: 'margin-top:14px' }, 'Sources: ', race.sources.map((s, i) => [i ? ' · ' : '', link(s.url, s.label)])));
  });
}
function callControl(id, race) {
  const cur = calls[id] || '';
  const mk = (v, label) => el('button', { 'aria-pressed': cur === v ? 'true' : 'false', onclick: () => { if (v) calls[id] = v; else delete calls[id]; LS.set('calls', calls); rerender(); } }, label);
  return el('div', { class: 'card flat', style: 'margin-top:14px' }, el('h3', { text: 'Election night: mark this race called' }),
    el('p', { class: 'sub', text: 'Calling a race keeps only the simulations where that outcome happened, so every other race and the control odds update the way correlated results would. Clear it any time.' }),
    el('div', { class: 'seg' }, mk('', 'Not called'), mk('D', (race.dem || dl(race)) + ' wins'), mk('R', (race.rep || 'R') + ' wins')));
}
function pollTable(polls, pa, race) {
  const share = new Map((pa.rows || []).map((r) => [r.p.id, r]));
  const rows = polls.slice().sort((a, b) => (b.end || '').localeCompare(a.end || ''));
  const L = dl(race);
  return el('div', { class: 'tbl-wrap' }, el('table', { class: 't' },
    el('thead', null, el('tr', null, ['Use', 'Field dates', 'Pollster', 'Sample', L, 'R', 'Margin', 'Weight', ''].map((h, i) => el('th', { class: i >= 3 && i <= 7 ? 'n' : '', text: h })))),
    el('tbody', null, rows.map((p) => {
      const r = share.get(p.id);
      const cb = el('input', { type: 'checkbox', 'aria-label': 'Include poll' }); cb.checked = !excluded.has(p.id);
      cb.addEventListener('change', () => { if (cb.checked) excluded.delete(p.id); else excluded.add(p.id); LS.set('excluded', [...excluded]); rerender(); });
      return el('tr', { class: excluded.has(p.id) ? 'dim' : '' },
        el('td', null, cb),
        el('td', { class: 'mono', text: fd(p.start) + '–' + fd(p.end) }),
        el('td', null, p.pollster || '—', p.partisan ? el('span', { class: 'tag', style: 'margin-left:6px', text: p.partisan + ' sponsor' }) : null, p.user ? el('span', { class: 'tag', style: 'margin-left:6px', text: 'you added' }) : null, p.approxDate ? el('span', { class: 'tag', style: 'margin-left:6px', title: 'Field dates not published in the sources found; estimated from the listing or publication date', text: 'dates ≈' }) : null, p.sponsor && !/^(not found|none)/i.test(p.sponsor) ? el('div', { class: 'x', text: p.sponsor }) : null),
        el('td', { class: 'n', text: (p.n || '—') + ' ' + (p.pop || '') }),
        el('td', { class: 'n', text: p.dem }), el('td', { class: 'n', text: p.rep }),
        el('td', { class: 'n', text: fm(p.dem - p.rep, L) }),
        el('td', { class: 'n', text: r ? Math.round(r.share * 100) + '%' : '—' }),
        el('td', null, link(p.url, '↗')));
    }))));
}
function dailyAverage(polls, s, fromISO, toISO) {
  const pts = []; const start = E.t(fromISO), end = E.t(toISO);
  for (let tt = start; tt <= end; tt += 86400000) {
    const iso = new Date(tt).toISOString().slice(0, 10);
    const pa = E.pollAverage(polls, iso, s);
    if (pa.avg != null) pts.push({ x: tt, y: pa.avg });
  }
  return pts;
}
function drawPollTrend(host, polls, race) {
  const s = RES.s; const L = dl(race);
  const ends = polls.map((p) => p.end).sort();
  let from = ends[0]; const mf = E.t(RES.asOf) - 120 * 86400000; if (E.t(from) < mf) from = new Date(mf).toISOString().slice(0, 10);
  const pts = dailyAverage(polls.filter((p) => !excluded.has(p.id)), s, from, RES.asOf);
  const dots = polls.filter((p) => E.t(p.end) >= E.t(from)).map((p) => ({
    x: E.t(p.end), y: p.dem - p.rep, color: p.partisan ? PAL.surface : divColor(p.dem - p.rep, 8), r: 4.5, opacity: excluded.has(p.id) ? 0.3 : 0.95,
    tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: p.pollster })); t.append(tipRow(fm(p.dem - p.rep, L), fd(p.start) + '–' + fd(p.end) + (p.partisan ? ' · ' + p.partisan + ' sponsor' : ''))); t.append(el('div', { class: 'tk', text: `${L} ${p.dem} – R ${p.rep} · n=${p.n || '?'} ${p.pop || ''}` })); },
  }));
  const ys = dots.map((d) => d.y).concat(pts.map((p) => p.y), [0]);
  const lim = Math.max(6, Math.ceil(Math.max(...ys.map(Math.abs)) + 2));
  const xT = []; const t0 = E.t(from), t1 = E.t(RES.asOf); const span = (t1 - t0) / 86400000;
  const stepD = span > 90 ? 30 : span > 40 ? 14 : 7; for (let tt = t0; tt <= t1; tt += stepD * 86400000) xT.push(tt);
  drawLine(host, {
    height: 230, series: [{ name: 'Average', color: PAL.ink, pts, endLabel: fm(pts.length ? pts[pts.length - 1].y : null, L) }], dots, yMin: -lim, yMax: lim, xMin: t0, xMax: t1 + 86400000 * 2, r: 60,
    refs: [{ y: 0, label: 'Even', color: PAL.axis }], xTicks: xT, xFmt: (v) => fd(new Date(v).toISOString().slice(0, 10)), xFmtLong: (v) => fdy(new Date(v).toISOString().slice(0, 10)),
    yFmt: (v) => (v === 0 ? '0' : (v > 0 ? L + '+' : 'R+') + Math.abs(v)), yFmtTip: (v) => fm(v, L),
  });
  dots.forEach(() => { });
}

/* =========================================================== BRIEFING */
function viewBrief() {
  const R = RES, sen = R.sim.senate, hou = R.sim.house, root = el('div');
  const gov = R.byId[D.ohio.govId], gR = raceById[D.ohio.govId];
  const ohs = R.byId[D.ohio.senId], oR = raceById[D.ohio.senId];
  const gLead = gov && gov.out.pD >= 0.5;
  root.append(callCard());
  root.append(el('h3', { class: 'h3', style: 'margin:26px 0 10px', text: 'The polls model in detail' }));
  root.append(el('div', { class: 'grid g4' },
    el('div', { class: 'tile' }, el('span', { class: 'lab', text: 'Senate control' }),
      el('span', { class: 'val' }, Math.max(sen.pR, sen.pD) < 0.6 ? 'Toss-up' : sen.pR > sen.pD ? 'R ' + fp(sen.pR) : 'D ' + fp(sen.pD), ' ', el('small', { text: Math.max(sen.pR, sen.pD) < 0.6 ? '' : sen.pR > sen.pD ? 'GOP holds' : 'Dems flip' })),
      meter([{ p: sen.pD, color: PAL.dem }, { p: sen.pHung, color: PAL.ind }, { p: sen.pR, color: PAL.rep }]),
      el('span', { class: 'foot', text: `D ${fp(sen.pD)} · R ${fp(sen.pR)}${sen.pHung > 0.005 ? ' · independent decides ' + fp(sen.pHung) : ''} · median ${sen.med} D+I seats` })),
    el('div', { class: 'tile' }, el('span', { class: 'lab', text: 'House control' }),
      el('span', { class: 'val' }, Math.abs(hou.pD - 0.5) < 0.1 ? 'Toss-up' : hou.pD >= 0.5 ? 'D ' + fp(hou.pD) : 'R ' + fp(1 - hou.pD), ' ', el('small', { text: Math.abs(hou.pD - 0.5) < 0.1 ? '' : hou.pD >= 0.5 ? 'Dems flip' : 'GOP holds' })),
      meter([{ p: hou.pD, color: PAL.dem }, { p: 1 - hou.pD, color: PAL.rep }]),
      el('span', { class: 'foot', text: `Median ${hou.med} D seats (80%: ${hou.lo}–${hou.hi}) · 218 for a majority` })),
    gov ? el('div', { class: 'tile' }, el('span', { class: 'lab', text: 'Ohio governor' }),
      el('span', { class: 'val' }, fp(gLead ? gov.out.pD : 1 - gov.out.pD), ' ', el('small', { text: gLead ? gR.dem : gR.rep })),
      meter([{ p: gov.out.pD, color: PAL.dem }, { p: 1 - gov.out.pD, color: PAL.rep }]),
      el('span', { class: 'foot', text: `Model ${fm(gov.out.med)} · ${gov.est.pa.k} public poll${gov.est.pa.k === 1 ? '' : 's'}` })) : null,
    el('div', { class: 'tile' }, el('span', { class: 'lab', text: 'National environment' }),
      el('span', { class: 'val' }, el('span', { class: 'lean ' + sideOf(R.envAdj), text: fm(R.envAdj) })),
      el('span', { class: 'foot', text: `Generic ballot after historical correction (raw ${fm(R.envRaw)}).` + (D.national.approvalHeadline ? ' ' + D.national.approvalHeadline : '') }))));
  // lede
  const lede = el('div', { class: 'card', style: 'margin-top:16px' });
  const senPhrase = Math.max(sen.pR, sen.pD) < 0.6 ? `the Senate is a **toss-up** (Democrats ${fp(sen.pD)}, Republicans ${fp(sen.pR)}${sen.pHung > 0.005 ? ', independent decides ' + fp(sen.pHung) : ''})` : sen.pR > sen.pD ? `Republicans are favored to keep the Senate (**${fp(sen.pR)}**)` : `Democrats are favored to win the Senate (**${fp(sen.pD)}**)`;
  const housePhrase = Math.abs(hou.pD - 0.5) < 0.1 ? `the House is a **toss-up** (Democrats ${fp(hou.pD)})` : hou.pD > 0.5 ? `Democrats are favored to take the House (**${fp(hou.pD)}**)` : `Republicans are favored to keep the House (**${fp(1 - hou.pD)}**)`;
  const BL = R.blend || {}; const bh = BL.HOUSE, bs = BL.SENATE;
  const blendPhrase = bh && bs ? `Blending the polls, the markets and history, Democrats are ${bh.p >= 0.5 ? '**' + fp(bh.p) + '** favorites for the House' : 'underdogs for the House (' + fp(bh.p) + ')'} and ${Math.abs(bs.p - 0.5) < 0.08 ? 'roughly even for the Senate (**' + fp(bs.p) + '**)' : bs.p > 0.5 ? '**' + fp(bs.p) + '** favorites for the Senate' : 'underdogs for the Senate (' + fp(bs.p) + ')'}. On the polls alone, ` : 'On the polls, ';
  const auto = `With ${R.daysLeft} day${R.daysLeft === 1 ? '' : 's'} to go: ${blendPhrase}${senPhrase} and ${housePhrase}. ` +
    (gov ? `In Ohio, ${gLead ? gR.dem : gR.rep} is the ${(gLead ? gov.out.pD : 1 - gov.out.pD) > 0.7 ? 'clear' : 'slight'} favorite for governor (${fp(gLead ? gov.out.pD : 1 - gov.out.pD)}), ` : '') +
    (ohs ? `and the Senate special is ${Math.abs(ohs.out.pD - 0.5) < 0.15 ? 'a near coin flip' : (ohs.out.pD > 0.5 ? 'leaning ' + oR.dem : 'leaning ' + oR.rep)} (${oR.dem} ${fp(ohs.out.pD)}).` : '');
  lede.append(el('div', { class: 'kicker', text: 'State of play, ' + fdy(R.asOf) }), el('p', { class: 'lede', style: 'margin-top:8px' }, rich(auto)));
  (D.narrative.lede || []).forEach((p) => lede.append(el('p', { style: 'margin:12px 0 0;color:var(--ink-2);max-width:900px' }, rich(p))));
  root.append(lede);
  // messaging
  root.append(sectionHead('', 'What each side is selling', 'The closing arguments, as the parties, their committees and their biggest outside groups are making them — summarized neutrally, in their own terms.'));
  const col = (side, list, title) => el('div', { class: 'card msg-col' }, el('h4', null, el('span', { class: 'party ' + side, text: side }), title),
    (list || []).map((m) => el('div', { class: 'msg ' + side }, el('b', { text: m.theme }), el('p', null, rich(m.detail), m.url ? [' ', link(m.url, '↗')] : null))));
  root.append(el('div', { class: 'grid g2' }, col('D', D.national.messages.dem, 'Democrats'), col('R', D.national.messages.rep, 'Republicans')));
  // issues + signals
  const issues = (D.national.issues || []).filter((x) => typeof x.pct === 'number');
  const issueCard = issues.length ? chartCard('What voters say matters', D.national.issuesNote || '', (host) => drawHBars(host, issues.map((x) => ({ label: x.issue, v: x.pct, color: PAL.amber, vl: x.pct + '%' + (x.edge ? ' · ' + x.edge : ''), tip: (t) => { t.append(tipRow(x.pct + '%', x.issue)); if (x.edge) t.append(el('div', { class: 'tk', text: 'Party trusted more: ' + x.edge })); if (x.src) t.append(el('div', { class: 'tk', text: x.src })); } })), { fmt: (v) => v + '%', r: 110 })) : null;
  const sig = el('div', { class: 'card' }, el('h3', { text: 'Signals' }), el('p', { class: 'sub', text: 'The national indicators the campaigns are reading.' }),
    (D.national.signals || []).map((s) => el('div', { class: 'evid' }, el('span', { class: 'ev', text: s.value }), el('span', { class: 'ec' }, rich(s.label)), el('span', { class: 'es' }, s.src || '', ' ', link(s.url, '↗')))));
  if (issueCard && issueCard.style) issueCard.style.alignSelf = 'start';
  root.append(el('div', { class: 'grid g2', style: 'margin-top:16px' }, issueCard, sig));
  // groups + scenarios
  const groups = el('div', { class: 'card' }, el('h3', { text: 'Who is moving' }), el('p', { class: 'sub', text: 'The voter groups most often cited as shifting since 2024 — the swing slice in practice — and where each party leads in the House vote.' }),
    (D.national.groups || []).map((g) => el('div', { class: 'evid' }, el('span', { class: 'ev', style: 'font-size:14px;width:min(140px,32vw)', text: g.group }), el('span', { class: 'ec' }, rich(g.shift)), el('span', { class: 'es' }, g.src || '', ' ', link(g.url, '↗')))));
  const scen = scenarioCard();
  root.append(el('div', { class: 'grid g2', style: 'margin-top:16px' }, groups, scen));
  // events
  if ((D.national.events || []).length) {
    root.append(sectionHead('', 'How we got here', 'Dated developments since July that shaped the closing weeks.'));
    root.append(el('div', { class: 'card' }, el('ul', { class: 'timeline' }, D.national.events.map((e) => el('li', null, el('span', { class: 'd', text: fdy(e.date) }), el('span', { class: 'e' }, rich(e.event), e.why ? el('small', null, rich(e.why)) : null, e.url ? [' ', link(e.url, '↗')] : null))))));
  }
  root.append(weekAhead());
  return root;
}
function scenarioCard() {
  const at = (curve, sh) => curve.find((c) => Math.abs(c.shift - sh) < 1e-6);
  const rows = (D.scenarios || []).map((sc) => {
    const s = at(RES.sCurve, sc.shift), h = at(RES.hCurve, sc.shift);
    return el('tr', null, el('td', null, el('b', { text: sc.label }), el('div', { class: 'x', text: sc.note })), el('td', { class: 'n', text: s ? s.mean.toFixed(1) : '—' }), el('td', { class: 'n', text: h ? Math.round(h.mean) : '—' }));
  });
  return el('div', { class: 'card' }, el('h3', { text: 'If the polls miss like they have before' }),
    el('p', { class: 'sub', text: 'Expected seats if every race moved by a past cycle’s polling error (positive shift = Democrats beat their polls). Current model in the first row.' }),
    el('div', { class: 'tbl-wrap' }, el('table', { class: 't', style: 'min-width:0' }, el('thead', null, el('tr', null, el('th', { text: 'Scenario' }), el('th', { class: 'n', text: 'Senate D+I' }), el('th', { class: 'n', text: 'House D' }))), el('tbody', null, rows))));
}
function weekAhead() {
  const from = RES.asOf; const to = new Date(E.t(from) + 7 * 86400000).toISOString().slice(0, 10);
  const items = (D.calendar || []).filter((c) => c.date >= from && c.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  return el('div', null, sectionHead('', 'What to watch', 'Debates, deadlines and data drops between now and ' + fdy(to) + '. The full calendar is on the Tracker tab.'),
    items.length ? el('div', { class: 'card' }, el('ul', { class: 'timeline' }, items.map((c) => el('li', null, el('span', { class: 'd', text: fd(c.date) + (c.date === todayISO() ? ' · today' : '') }), el('span', { class: 'e' }, rich(c.label), c.note ? el('small', null, rich(c.note)) : null, c.url ? [' ', link(c.url, '↗')] : null))))) : el('div', { class: 'empty', text: 'Nothing scheduled in the next seven days in the calendar.' }));
}

/* =========================================================== SENATE */
const TILE = { AK: [0, 0], ME: [10, 0], VT: [9, 1], NH: [10, 1], WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], WI: [6, 2], MI: [7, 2], NY: [8, 2], RI: [9, 2], MA: [10, 2], OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3], CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4], AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6], HI: [0, 7], TX: [3, 7], FL: [8, 7] };
function drawTileMap(host) {
  const w = Math.max(280, host.clientWidth || 600), cols = 11, rows = 8, gap = 4;
  const cell = Math.min(54, (w - gap * (cols - 1)) / cols), H = rows * (cell + gap);
  const F = frame(host, H + 4, { t: 0, r: 0, b: 0, l: 0 });
  const ox = (F.w - (cols * (cell + gap) - gap)) / 2;
  const g = sv('g'); F.svg.append(g);
  const senByState = {}; RES.ests.forEach((e) => { if (e.race.office === 'Senate') senByState[e.race.state] = e.race; });
  Object.entries(TILE).forEach(([st, [cx, cy]]) => {
    const x = ox + cx * (cell + gap), y = cy * (cell + gap), race = senByState[st];
    const o = race ? RES.byId[race.id].out : null;
    const fill = o ? divColor((o.pD - 0.5) * 40, 20) : 'transparent';
    const rect = sv('rect', { x, y, width: cell, height: cell, rx: 7, fill, stroke: o ? 'none' : PAL.rule, 'stroke-width': 1 });
    g.append(rect);
    const strong = o && Math.abs(o.pD - 0.5) > 0.3;
    const tc = strong ? '#ffffff' : (o ? PAL.ink : PAL.muted);
    g.append(sv('text', { x: x + cell / 2, y: y + cell / 2 - (o ? 3 : -4), 'text-anchor': 'middle', style: `font:700 ${Math.max(10, cell * 0.24)}px var(--f-sans);fill:${tc}` }, st));
    if (o) g.append(sv('text', { x: x + cell / 2, y: y + cell / 2 + Math.max(10, cell * 0.24), 'text-anchor': 'middle', style: `font:600 ${Math.max(8.5, cell * 0.18)}px var(--f-mono);fill:${tc}` }, (o.pD >= 0.5 ? dl(race) : 'R') + ' ' + fp(Math.max(o.pD, 1 - o.pD)).replace('%', '')));
    if (race && race.special) g.append(sv('circle', { cx: x + cell - (cell < 40 ? 4 : 7), cy: y + (cell < 40 ? 4 : 7), r: cell < 40 ? 2 : 3, fill: tc }));
    if (o) {
      const hit = sv('rect', { x, y, width: cell, height: cell, fill: 'transparent', style: 'cursor:pointer' }); g.append(hit);
      hoverable(hit, (t) => { t.append(el('div', { style: 'font-weight:700', text: race.name + (race.special ? ' (special)' : '') })); t.append(tipRow(fp(o.pD), (race.dem || dl(race)) + ' win chance', race.dSideInd ? PAL.ind : PAL.dem)); t.append(tipRow(fm(o.med, dl(race)), 'median margin')); t.append(el('div', { class: 'tk', text: ratingLine(race.ratings) })); });
      hit.addEventListener('click', () => { tipHide(); openRace(race.id); });
    }
  });
}
function viewSenate() {
  const R = RES, sen = R.sim.senate, root = el('div');
  root.append(sectionHead('35 seats on the ballot', 'Who controls the Senate', `Republicans hold 53 seats. With Vice President Vance breaking ties, the GOP keeps control at **50** seats; Democrats need **51** (a net gain of four). ${D.senateNote || ''}`));
  root.append(el('div', { class: 'grid g3' },
    el('div', { class: 'tile' }, el('span', { class: 'lab', text: 'Republicans keep control' }), el('span', { class: 'val', text: fp(sen.pR) }), el('span', { class: 'foot', text: '50+ Republican seats' })),
    el('div', { class: 'tile' }, el('span', { class: 'lab', text: 'Democrats win control' }), el('span', { class: 'val', text: fp(sen.pD) }), el('span', { class: 'foot', text: '51+ seats in the Democratic caucus' })),
    el('div', { class: 'tile' }, el('span', { class: 'lab', text: 'Independent holds the balance' }), el('span', { class: 'val', text: fp(sen.pHung) }), el('span', { class: 'foot', text: D.senateHungNote || 'Neither party reaches its threshold without an unaffiliated senator' }))));
  const xf = (D.national.forecasts || {}).senate || [];
  if (xf.length) root.append(el('div', { class: 'row', style: 'margin-top:12px;gap:8px' }, el('span', { class: 'note', text: 'Other reads:' }), xf.map((f) => el('span', { class: 'chip' }, f.src + ' ', el('b', { text: f.val }), ' · ' + fd(f.date) + ' ', link(f.url, '↗')))));
  root.append(el('div', { class: 'grid g2', style: 'margin-top:16px' },
    chartCard('The map', 'Each tile is a 2026 Senate race, shaded by win probability; a dot marks a special election. Tap a state for detail.', (host) => drawTileMap(host),
      legend([{ color: divColor(15, 15), label: 'Likely D' }, { color: divColor(0, 15), label: 'Toss-up' }, { color: divColor(-15, 15), label: 'Likely R' }])),
    chartCard('Distribution of outcomes', `Non-Republican seats (Democrats plus independents) across ${R.sim.N.toLocaleString()} correlated simulations. Median **${sen.med}** (80% range ${sen.lo}–${sen.hi}).`, (host) => drawHist(host, { hist: sen.hist, lo: 40, hi: 60, line: 51, lineLabel: '51 = GOP loses control', side: (k) => (k >= 51 ? 'D' : 'R'), label: (k) => `${k} non-GOP seats (${100 - k} R)`, xLabel: 'Democratic + independent seats' }),
      legend([{ color: PAL.dem, label: '51+ — GOP loses control' }, { color: PAL.rep, label: '50 or fewer — GOP keeps control' }]))));
  const comp = R.ests.filter((e) => e.race.office === 'Senate' && (e.race.tier || 3) <= 2).map((e) => R.byId[e.race.id]);
  comp.sort((a, b) => b.out.med - a.out.med);
  root.append(sectionHead('', 'Every competitive race, on one scale', 'Dot = median projected margin; bar = 80% range. Sorted from most Democratic to most Republican. Click a row for polls, the estimate’s build and each side’s message.'));
  root.append(chartCard(null, null, (host) => drawLadder(host, comp.map((x) => ({ race: x.est.race, label: x.est.race.name + (x.est.race.special ? ' (sp.)' : ''), sub: (x.est.race.dem || '?').split(' ').slice(-1)[0] + ' vs ' + (x.est.race.rep || '?').split(' ').slice(-1)[0], med: x.out.med, lo: x.out.lo, hi: x.out.hi, pD: x.out.pD, dl: dl(x.est.race), title: x.est.race.name + ': ' + (x.est.race.dem || '') + ' vs ' + (x.est.race.rep || '') })), { onClick: (r) => openRace(r.race.id) })));
  root.append(el('div', { class: 'grid g2', style: 'margin-top:16px' },
    tippingCard(),
    chartCard('If the polls are off', 'Expected non-GOP seats if every race shifts by the same amount — the shared, national part of polling error. Shaded: 80% range from race-level noise.', (host) => {
      const c = R.sCurve; drawLine(host, { height: 240, series: [{ name: 'Expected D+I seats', color: PAL.ink, pts: c.map((p) => ({ x: p.shift, y: p.mean })) }], band: c.map((p) => ({ x: p.shift, lo: p.lo, hi: p.hi })), refs: [{ y: 50.5, label: '51 = GOP loses control', color: PAL.ink2, left: true }], vrefs: [{ x: 0, label: 'Today', color: PAL.axis }], xFmt: (v) => (v === 0 ? '0' : (v > 0 ? 'D+' : 'R+') + Math.abs(v)), xFmtLong: (v) => 'Uniform shift ' + (v === 0 ? '0' : (v > 0 ? 'D+' : 'R+') + Math.abs(v)), yFmt: (v) => v.toFixed(0), yFmtTip: (v) => v.toFixed(1), xLabel: 'Polling error / late shift (points)', xTicks: [-8, -6, -4, -2, 0, 2, 4, 6, 8] });
    })));
  root.append(sectionHead('', 'The competitive contests', null));
  root.append(el('div', { class: 'races' }, comp.map((x) => raceCard(x.est.race))));
  root.append(el('div', { style: 'margin-top:16px' }, safeSeatsCard()));
  return root;
}
function tippingCard() {
  const tip = RES.sim.senate.tip.slice(0, 7);
  return el('div', { class: 'card' }, el('h3', { text: 'Tipping-point races' }),
    el('p', { class: 'sub', text: 'How often each race supplies the decisive 51st Democratic seat when races are lined up from most to least Democratic in each simulation.' }),
    tip.length ? el('div', { class: 'chart' }, (() => { const host = el('div', { class: 'chart' }); CHARTS.push(() => drawHBars(host, tip.map((t) => ({ label: raceById[t.id] ? raceById[t.id].name : t.id, v: t.p * 100, color: PAL.amber, vl: fp(t.p), tip: (tt) => tt.append(tipRow(fp(t.p), 'of simulations decided here')) })), { fmt: (v) => v + '%', r: 50 })); return host; })()) : el('div', { class: 'empty', text: 'No tipping-point data.' }),
    el('p', { class: 'note', style: 'margin:8px 0 0' }, 'Read it as: where the Senate majority is most likely to be won or lost.'));
}
function safeSeatsCard() {
  const safe = RES.ests.filter((e) => e.race.office === 'Senate' && (e.race.tier || 3) === 3);
  return el('div', { class: 'card' }, el('h3', { text: 'The rest of the map' }), el('p', { class: 'sub', text: `${safe.length} races rated safe or likely for one party by the forecasters. They still run through the simulation.` }),
    el('div', { class: 'row', style: 'gap:6px' }, safe.sort((a, b) => b.mu - a.mu).map((e) => { const o = RES.byId[e.race.id].out; const c = el('button', { class: 'chip ' + (o.pD >= 0.5 ? 'pill-d' : 'pill-r'), style: 'cursor:pointer', onclick: () => openRace(e.race.id) }, el('span', { class: 'party ' + (o.pD >= 0.5 ? 'D' : 'R'), text: o.pD >= 0.5 ? 'D' : 'R' }), e.race.state + ' ' + fp(Math.max(o.pD, 1 - o.pD))); return c; })));
}

/* =========================================================== HOUSE */
function viewHouse() {
  const R = RES, hou = R.sim.house, H = D.house, root = el('div');
  const need = 218 - (H.composition.D || 0);
  root.append(sectionHead('All 435 seats', 'Who controls the House', `${H.composition.note || ''} A majority is **218**. The model starts from the forecasters’ ratings and each district’s partisan lean, then moves every seat together with the national generic-ballot environment.`));
  root.append(el('div', { class: 'grid g4' },
    el('div', { class: 'tile' }, el('span', { class: 'lab', text: 'Democrats win the House' }), el('span', { class: 'val', text: fp(hou.pD) }), meter([{ p: hou.pD, color: PAL.dem }, { p: 1 - hou.pD, color: PAL.rep }]), el('span', { class: 'foot', text: `Republicans ${fp(1 - hou.pD)}` })),
    el('div', { class: 'tile' }, el('span', { class: 'lab', text: 'Median D seats' }), el('span', { class: 'val', text: hou.med }), el('span', { class: 'foot', text: `80% range ${hou.lo}–${hou.hi}` })),
    el('div', { class: 'tile' }, el('span', { class: 'lab', text: 'Generic ballot' }), el('span', { class: 'val' }, el('span', { class: 'lean ' + sideOf(R.envAdj), text: fm(R.envAdj) })), el('span', { class: 'foot', text: `Algorithm average ${fm(R.envRaw)} from ${R.gbPa.k} polls; corrected for history` })),
    el('div', { class: 'tile' }, el('span', { class: 'lab', text: 'Hinge point' }), el('span', { class: 'val', text: houseHinge() }), el('span', { class: 'foot', text: 'Generic-ballot margin where the expected seat count crosses 218' }))));
  root.append(el('div', { class: 'grid g2', style: 'margin-top:16px' },
    chartCard('Distribution of outcomes', `Democratic seats across ${R.sim.N.toLocaleString()} simulations; 218 needed.`, (host) => drawHist(host, { hist: hou.hist, lo: Math.max(150, hou.lo - 25), hi: Math.min(300, hou.hi + 25), line: 218, lineLabel: '218', side: (k) => (k >= 218 ? 'D' : 'R'), label: (k) => `${k} D seats`, xLabel: 'Democratic seats' }), legend([{ color: PAL.dem, label: 'D majority' }, { color: PAL.rep, label: 'R majority' }])),
    chartCard('Seats vs. the national vote', 'Expected Democratic seats at each generic-ballot margin, holding district ratings and lean fixed. Shaded: 80% range.', (host) => {
      const c = R.hCurve.map((p) => ({ ...p, gb: R.envAdj + p.shift }));
      drawLine(host, { height: 250, series: [{ name: 'Expected D seats', color: PAL.ink, pts: c.map((p) => ({ x: +p.gb.toFixed(1), y: p.mean })) }], band: c.map((p) => ({ x: +p.gb.toFixed(1), lo: p.lo, hi: p.hi })), refs: [{ y: 217.5, label: '218 majority', left: true }], markers: [{ x: +R.envAdj.toFixed(1), y: c.find((p) => p.shift === 0).mean, label: 'Today ' + fm(R.envAdj), color: PAL.amber }], xFmt: (v) => (Math.abs(v) < 0.05 ? '0' : (v > 0 ? 'D+' : 'R+') + Math.abs(v).toFixed(0)), xFmtLong: (v) => 'Generic ballot ' + fm(v), yFmt: (v) => v.toFixed(0), yFmtTip: (v) => v.toFixed(0), xLabel: 'Generic ballot margin (after correction)' });
    })));
  const gbCard = chartCard('The generic ballot', `Public generic-ballot polls since ${fd(D.house.gbFrom || '2026-08-01')} and the algorithm’s daily average (before the historical correction).`, (host) => drawGB(host));
  gbCard.style.alignSelf = 'start';
  root.append(el('div', { class: 'grid g-main', style: 'margin-top:16px' }, gbCard, externalHouseCard()));
  root.append(sectionHead('', 'Competitive districts', 'Every seat Cook rates short of safe, closest races first. P(D) is the share of simulations Democrats win. Click a column to sort.'));
  root.append(battlefieldTable());
  if ((H.redistricting || []).length) {
    root.append(sectionHead('', 'Mid-decade redistricting', H.redistNote || 'States that redrew congressional lines after 2024 — the reason the House map is not the one from two years ago.'));
    root.append(el('div', { class: 'tbl-wrap' }, el('table', { class: 't' }, el('thead', null, el('tr', null, ['State', 'Status', 'Expected effect', 'Notes', ''].map((h) => el('th', { text: h })))), el('tbody', null, H.redistricting.map((r) => el('tr', null, el('td', null, el('b', { text: r.state })), el('td', { text: r.status }), el('td', { text: r.effect }), el('td', { class: 'x', text: r.note || '' }), el('td', null, link(r.url, '↗'))))))));
  }
  return root;
}
function houseHinge() {
  const c = RES.hCurve; for (let i = 1; i < c.length; i++) { if ((c[i - 1].mean - 217.5) * (c[i].mean - 217.5) <= 0) { const t = (217.5 - c[i - 1].mean) / ((c[i].mean - c[i - 1].mean) || 1); const sh = c[i - 1].shift + t * (c[i].shift - c[i - 1].shift); return fm(RES.envAdj + sh); } }
  return c[0].mean > 217.5 ? 'Below R+8' : 'Above D+8';
}
function drawGB(host) {
  const polls = pollsFor('GB'); const from = D.house.gbFrom || '2026-08-01';
  const pts = dailyAverage(polls.filter((p) => !excluded.has(p.id)), RES.s, from, RES.asOf);
  const dots = polls.filter((p) => p.end >= from).map((p) => ({ x: E.t(p.end), y: p.dem - p.rep, color: p.partisan ? PAL.surface : divColor(p.dem - p.rep, 8), r: 4, opacity: excluded.has(p.id) ? 0.3 : 0.9, tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: p.pollster })); t.append(tipRow(fm(p.dem - p.rep), fd(p.start) + '–' + fd(p.end) + ' · ' + (p.pop || ''))); } }));
  const t0 = E.t(from), t1 = E.t(RES.asOf); const xT = []; for (let tt = t0; tt <= t1; tt += 14 * 86400000) xT.push(tt);
  const ys = dots.map((d) => d.y).concat(pts.map((p) => p.y)); const lim = Math.max(6, Math.ceil(Math.max(...ys.map(Math.abs), 1) + 1));
  drawLine(host, { height: 250, series: [{ name: 'Average', color: PAL.ink, pts, endLabel: pts.length ? fm(pts[pts.length - 1].y) : '' }], dots, yMin: -lim, yMax: lim, xMin: t0, xMax: t1 + 2 * 86400000, r: 64, refs: [{ y: 0, label: 'Even', color: PAL.axis }], xTicks: xT, xFmt: (v) => fd(new Date(v).toISOString().slice(0, 10)), xFmtLong: (v) => fdy(new Date(v).toISOString().slice(0, 10)), yFmt: (v) => (v === 0 ? '0' : (v > 0 ? 'D+' : 'R+') + Math.abs(v)), yFmtTip: (v) => fm(v) });
}
function nowrapParts(v) {
  // keep each " · " segment on one line so values like "Toss-up 21" never split at the hyphen
  return String(v).split(' · ').map((p, i) => [i ? ' · ' : '', el('span', { style: 'white-space:nowrap', text: p })]);
}
function externalHouseCard() {
  const A = D.house.gbAverages || [], F = D.house.forecasts || [], RC = D.house.ratingsCounts || [];
  return el('div', { class: 'card' }, el('h3', { text: 'Other reads' }), el('p', { class: 'sub', text: 'Published averages, forecasts and rating tallies for comparison.' }),
    A.length ? el('div', { class: 'wf', style: 'margin-bottom:12px' }, A.flatMap((a) => [el('span', { class: 'k' }, a.src + ' · ' + fd(a.date) + ' ', link(a.url, '↗')), el('span', { class: 'v' }, nowrapParts(a.val))])) : null,
    F.length ? el('div', { class: 'wf', style: 'margin-bottom:12px' }, F.flatMap((a) => [el('span', { class: 'k' }, a.src + ' · ' + fd(a.date) + ' ', link(a.url, '↗')), el('span', { class: 'v' }, nowrapParts(a.val))])) : null,
    RC.length ? el('div', { class: 'wf' }, RC.flatMap((a) => [el('span', { class: 'k' }, a.src + (a.date ? ' · ' + fd(a.date) : '') + ' ', link(a.url, '↗')), el('span', { class: 'v' }, nowrapParts(a.val))])) : null);
}
let BF_SORT = { k: 'close', dir: 1 }, BF_FILTER = '';
function battlefieldTable() {
  const wrap = el('div');
  const search = el('input', { type: 'text', placeholder: 'Filter by state, district or name…', value: BF_FILTER, style: 'width:min(360px,100%)' });
  const body = el('tbody');
  const draw = () => {
    const q = BF_FILTER.trim().toLowerCase();
    const rows = RES.dists.map((e, i) => ({ e, o: RES.sim.districts[i] })).filter(({ e }) => !q || [e.dist.district, e.dist.incumbent, e.dist.dem, e.dist.rep, e.dist.state].join(' ').toLowerCase().includes(q));
    const key = { close: (r) => Math.abs(r.o.pD - 0.5), pD: (r) => r.o.pD, d: (r) => r.e.dist.district, pvi: (r) => r.e.dist.pvi ?? 0, mu: (r) => r.e.mu, score: (r) => r.e.score };
    rows.sort((a, b) => { const ka = key[BF_SORT.k](a), kb = key[BF_SORT.k](b); return (ka > kb ? 1 : ka < kb ? -1 : 0) * BF_SORT.dir; });
    body.replaceChildren(...rows.map(({ e, o }) => {
      const d = e.dist; const c = calls['H:' + d.district];
      return el('tr', null,
        el('td', null, el('b', { text: d.district }), d.state === 'OH' ? el('span', { class: 'tag', style: 'margin-left:6px', text: 'Ohio' }) : null),
        el('td', null, d.open ? el('span', { class: 'x', text: 'Open (' + (d.party || '?') + ')' }) : [el('span', { class: 'party ' + (d.party || 'R'), text: d.party || '?' }), ' ', d.incumbent || '']),
        el('td', { class: 'x', text: [d.cook, d.sabato, d.ie].map((r) => RATING_SHORT[r] || r || '–').join(' / ') }),
        el('td', { class: 'n', text: d.pvi == null ? '—' : (d.pvi === 0 ? 'EVEN' : (d.pvi > 0 ? 'D+' : 'R+') + Math.abs(d.pvi)) }),
        el('td', { class: 'x', text: [d.dem, d.rep].filter(Boolean).join(' vs ') || '' }),
        el('td', { class: 'n' }, el('span', { class: 'lean ' + sideOf(e.mu), text: fm(e.mu) })),
        el('td', { class: 'n' }, c ? el('b', { text: c + ' called' }) : el('span', { style: `display:inline-block;min-width:44px;padding:2px 6px;border-radius:6px;background:${divColor((o.pD - 0.5) * 40, 20)};color:${Math.abs(o.pD - 0.5) > 0.3 ? '#fff' : 'inherit'}`, text: fp(o.pD) })),
        el('td', { class: 'n x', text: Math.abs(o.pD - 0.5) < 0.15 ? 'toss-up' : Math.abs(o.pD - 0.5) < 0.3 ? 'lean' : Math.abs(o.pD - 0.5) < 0.45 ? 'likely' : 'safe' }));
    }));
  };
  search.addEventListener('input', () => { BF_FILTER = search.value; draw(); });
  const th = (label, k, n) => { const h = el('th', { class: (n ? 'n ' : '') + (k ? 'sort' : ''), text: label + (k && BF_SORT.k === k ? (BF_SORT.dir > 0 ? ' ↑' : ' ↓') : '') }); if (k) h.addEventListener('click', () => { BF_SORT = { k, dir: BF_SORT.k === k ? -BF_SORT.dir : -1 }; rerenderView(); }); return h; };
  draw();
  wrap.append(el('div', { class: 'row', style: 'margin-bottom:10px' }, search, el('span', { class: 'note', text: `${RES.dists.length} districts · ${D.house.solid.D} safe D and ${D.house.solid.R} safe R seats counted outside this list` })));
  wrap.append(el('div', { class: 'tbl-wrap', style: 'max-height:560px;overflow:auto' }, el('table', { class: 't' }, el('thead', null, el('tr', null, th('District', 'd'), th('Incumbent'), th('Cook / Sabato / IE', 'score'), th('PVI', 'pvi', 1), th('Nominees'), th('Model', 'mu', 1), th('P(D)', 'pD', 1), th('Closeness', 'close', 1))), body)));
  return wrap;
}
