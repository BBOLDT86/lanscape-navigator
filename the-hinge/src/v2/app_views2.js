/* =========================================================== OHIO */
function ohioHero(id) {
  const race = raceById[id], x = RES.byId[id]; if (!race || !x) return el('div', { class: 'empty', text: 'Race data unavailable.' });
  const { est, out } = x; const host = el('div', { class: 'chart' });
  const polls = pollsFor(id);
  if (polls.length) CHARTS.push(() => drawPollTrend(host, polls, race));
  const lead = out.pD >= 0.5;
  return el('div', { class: 'card' },
    el('div', { class: 'kicker', text: race.office === 'Governor' ? 'Governor · open seat' : 'U.S. Senate · special election' }),
    el('h3', { style: 'font-size:24px;margin-top:6px', text: (race.dem || 'D') + ' vs. ' + (race.rep || 'R') }),
    el('p', { class: 'sub', text: ratingLine(race.ratings) }),
    el('div', { class: 'grid g2', style: 'gap:10px;margin-bottom:10px' },
      el('div', null, el('div', { class: 'eyebrow', text: 'Win probability' }), el('div', { style: 'font:500 36px/1.05 var(--f-display)' }, fp(lead ? out.pD : 1 - out.pD), ' ', el('span', { style: 'font-size:14px;font-weight:600;color:var(--ink-2)', text: lead ? race.dem : race.rep }))),
      el('div', null, el('div', { class: 'eyebrow', text: 'Projected margin' }), el('div', { style: 'font:500 36px/1.05 var(--f-display)' }, el('span', { class: 'lean ' + sideOf(out.med), text: fm(out.med, dl(race)) })), el('div', { class: 'note', text: `80%: ${fm(out.lo)} to ${fm(out.hi)}` }))),
    meter([{ p: out.pD, color: PAL.dem }, { p: 1 - out.pD, color: PAL.rep }]),
    polls.length ? host : el('div', { class: 'empty', style: 'margin-top:10px', text: 'No public polls yet.' }),
    el('div', { class: 'row', style: 'margin-top:10px;justify-content:space-between' }, el('span', { class: 'note', text: `${est.pa.k} poll${est.pa.k === 1 ? '' : 's'} · raw avg ${fm(est.pa.rawAvg)} · bias-corrected ${fm(est.Aadj)}` }), el('button', { class: 'btn small', onclick: () => openRace(id) }, 'Polls, build & messaging →')));
}
function viewOhio() {
  const root = el('div'), O = D.ohio;
  root.append(sectionHead('', 'The Buckeye ballot', O.intro || ''));
  root.append(el('div', { class: 'grid g2' }, ohioHero(O.govId), ohioHero(O.senId)));
  const g = raceById[O.govId];
  if (g && (g.msgD || g.msgR)) {
    root.append(sectionHead('', 'The two closing arguments', null));
    root.append(el('div', { class: 'grid g2' },
      el('div', { class: 'card' }, el('div', { class: 'msg D' }, el('b', { text: g.dem + ' (D)' }), el('p', null, rich(g.msgD)))),
      el('div', { class: 'card' }, el('div', { class: 'msg R' }, el('b', { text: g.rep + ' (R)' }), el('p', null, rich(g.msgR))))));
    if (O.govFacts && O.govFacts.length) root.append(el('div', { class: 'card flat', style: 'margin-top:14px' }, el('div', { class: 'wf' }, O.govFacts.flatMap((f) => [el('span', { class: 'k' }, rich(f.k)), el('span', { class: 'v', style: 'font-family:var(--f-sans);font-weight:600' }, f.v, ' ', link(f.url, '↗'))]))));
  }
  // polling history
  const hist = (O.history || []).filter((h) => typeof h.avg === 'number' && typeof h.actual === 'number');
  if (hist.length) {
    const recent = hist.filter((h) => h.year >= 2014), over = recent.filter((h) => h.avg - h.actual > 0);
    const meanErr = recent.reduce((a, h) => a + (h.avg - h.actual), 0) / Math.max(1, recent.length);
    root.append(sectionHead('', 'Ohio polls vs. Ohio results', `Since 2014, the final polling average overstated the Democrat in **${over.length} of ${recent.length}** statewide races, by **${meanErr.toFixed(1)} points** on average. Before 2014 the misses ran both ways. The model’s state-history correction (on by default, shrunk toward zero) leans on this record.`));
    root.append(chartCard(null, 'Hollow dot = final polling average · filled dot = actual result (margin, D minus R).', (host) => drawDumbbell(host, hist.slice().reverse().map((h) => ({ label: h.label, a: h.avg, b: h.actual, bColor: h.actual > 0 ? PAL.dem : PAL.rep, lineColor: h.avg - h.actual > 3 ? PAL.amber : PAL.axis, tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: h.label })); t.append(tipRow(fm(h.avg), 'final polling average' + (h.src ? ' (' + h.src + ')' : ''))); t.append(tipRow(fm(h.actual), 'actual result')); t.append(tipRow((h.avg - h.actual > 0 ? 'D' : 'R') + ' +' + Math.abs(h.avg - h.actual).toFixed(1), 'polls overstated')); } })), { fmt: (v) => (v === 0 ? '0' : (v > 0 ? 'D+' : 'R+') + Math.abs(v)), zero: 0, l: 190 }),
      legend([{ color: PAL.amber, label: 'Polls overstated the Democrat by 3+ points', line: true }])));
  }
  // counties
  const cs = (O.counties || []).filter((c) => typeof c.pres24_d === 'number' && typeof c.sen24_d === 'number' && c.county !== 'Statewide');
  if (cs.length) {
    const st = (O.counties || []).find((c) => c.county === 'Statewide');
    root.append(sectionHead('', 'Where Trump–Brown voters live', `In 2024 Sherrod Brown ran ahead of Kamala Harris in every one of these counties. The gap — voters who backed Trump or skipped the top line but chose Brown — is the persuadable slice this year’s Ohio races are fighting over.${st ? ` Statewide: Harris ${st.pres24_d}%, Brown ${st.sen24_d}%.` : ''}`));
    const rows = cs.map((c) => ({ ...c, gap: c.sen24_d - c.pres24_d })).sort((a, b) => b.gap - a.gap);
    root.append(chartCard(null, 'Hollow dot = Harris share · filled dot = Brown share (percent of all votes cast, 2024). Sorted by the size of the gap.', (host) => drawDumbbell(host, rows.map((c) => ({ label: c.county, a: c.pres24_d, b: c.sen24_d, bColor: PAL.dem, lineColor: PAL.amber, tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: c.county + ' County' })); t.append(tipRow(c.pres24_d + '%', 'Harris (D) for president', PAL.muted)); t.append(tipRow(c.sen24_d + '%', 'Brown (D) for Senate', PAL.dem)); t.append(tipRow('+' + c.gap.toFixed(1), 'Brown over Harris')); if (c.pres24_r != null) t.append(tipRow(c.pres24_r + '% / ' + (c.sen24_r ?? '—') + '%', 'Trump / Moreno')); if (c.gov22_d != null) t.append(tipRow(c.gov22_d + '%', 'Whaley (D) for governor, 2022')); } })), { fmt: (v) => v + '%', l: 110 }),
      legend([{ color: PAL.muted, label: 'Harris 2024' }, { color: PAL.dem, label: 'Brown 2024' }])));
  }
  // Ohio House
  const oh = (O.house || []);
  if (oh.length) {
    root.append(sectionHead('', 'Ohio’s districts under the 2025 map', O.houseNote || ''));
    const byD = Object.fromEntries(RES.dists.map((e, i) => [e.dist.district, { e, o: RES.sim.districts[i] }]));
    root.append(el('div', { class: 'races' }, oh.map((d) => {
      const m = byD[d.district];
      return el('div', { class: 'race', style: 'cursor:default' },
        el('div', { class: 'top' }, el('span', { class: 'st', text: d.district }), el('span', { class: 'rt', text: [d.cook && 'Cook ' + d.cook, d.sabato && 'Sabato ' + d.sabato, d.ie && 'IE ' + d.ie].filter(Boolean).join(' · ') })),
        el('div', { class: 'cands' }, el('span', null, el('span', { class: 'party D', text: 'D' }), ' ', d.dem || 'TBD'), el('span', { class: 'p', text: m ? fp(m.o.pD) : '' }), el('span', null, el('span', { class: 'party R', text: 'R' }), ' ', d.rep || 'TBD'), el('span', { class: 'p', text: m ? fp(1 - m.o.pD) : '' })),
        m ? el('div', { class: 'bar' }, el('i', { style: `width:${m.o.pD * 100}%;background:${PAL.dem}` }), el('i', { style: `width:${(1 - m.o.pD) * 100}%;background:${PAL.rep}` })) : null,
        el('div', { class: 'foot' }, el('span', { text: d.lean || '' }), el('span', { text: d.incumbent ? 'Inc. ' + d.incumbent : '' })),
        d.note ? el('div', { class: 'note' }, rich(d.note)) : null);
    })));
  }
  // logistics + other
  const lg = O.logistics || [], ot = O.other || [], iss = O.issues || [];
  root.append(el('div', { class: 'grid g2', style: 'margin-top:16px' },
    lg.length ? el('div', { class: 'card' }, el('h3', { text: 'Voting in Ohio' }), el('div', { class: 'wf' }, lg.flatMap((f) => [el('span', { class: 'k' }, rich(f.k)), el('span', { class: 'v', style: 'font-family:var(--f-sans);font-weight:600' }, f.v, ' ', link(f.url, '↗'))]))) : null,
    (ot.length || iss.length) ? el('div', { class: 'card' }, el('h3', { text: 'Down the ballot' }),
      ot.length ? el('div', { class: 'wf' }, ot.flatMap((f) => [el('span', { class: 'k' }, el('b', { text: f.office }), f.note ? el('div', { class: 'x', text: f.note }) : null), el('span', { class: 'v', style: 'font-family:var(--f-sans);text-align:right' }, f.dem ? ['D ', f.dem] : null, f.dem && f.rep ? el('br') : null, f.rep ? ['R ', f.rep] : null)])) : null,
      iss.length ? [el('hr', { class: 'soft' }), el('div', { class: 'h3', style: 'font-size:15px', text: 'Statewide issues' }), el('ul', { style: 'margin:6px 0 0;padding-left:18px;font-size:13.5px' }, iss.map((i) => el('li', null, rich(i.label), ' ', link(i.url, '↗'))))] : null) : null));
  return root;
}

/* =========================================================== SWING LAB */
let LAB = null;
function labInit(ctxId) {
  const ctx = D.lab.contexts.find((c) => c.id === ctxId) || D.lab.contexts[0];
  const f = E.floorsFrom(ctx.refs, LAB && LAB.maxMargin != null ? LAB.maxMargin : 15);
  LAB = Object.assign({ maxMargin: LAB ? LAB.maxMargin : 15 }, { ctx: ctx.id, bD: +f.bD.toFixed(1), bR: +f.bR.toFixed(1), S: +f.S.toFixed(1), tD: 1, tR: 1, tS: 1, p: 0.5 });
  const mm = labModelMargin(ctx);
  if (mm != null) LAB.p = Math.max(0, Math.min(1, E.labSolveP(labBase(), mm)));
}
const labBase = () => ({ bD: LAB.bD, bR: LAB.bR, S: LAB.S, tD: LAB.tD, tR: LAB.tR, tS: LAB.tS });
function labCtx() { return D.lab.contexts.find((c) => c.id === LAB.ctx); }
function labModelMargin(ctx) {
  if (ctx.national) return RES.envAdj;
  const x = RES.byId[ctx.raceId]; return x ? x.out.med : null;
}
function labHinge(ctx) {
  if (!ctx.national) return 0;
  const c = RES.hCurve; for (let i = 1; i < c.length; i++) { if ((c[i - 1].mean - 217.5) * (c[i].mean - 217.5) <= 0) { const t = (217.5 - c[i - 1].mean) / ((c[i].mean - c[i - 1].mean) || 1); return RES.envAdj + c[i - 1].shift + t * (c[i].shift - c[i - 1].shift); } }
  return 0;
}
function viewLab() {
  if (!LAB) labInit(D.lab.defaultCtx);
  const root = el('div'); const ctx = labCtx();
  root.append(sectionHead('', 'Stable bases, a movable middle', D.lab.intro));
  const sel = el('select', { 'aria-label': 'Race' }, D.lab.contexts.map((c) => { const o = el('option', { value: c.id, text: c.label }); if (c.id === LAB.ctx) o.selected = true; return o; }));
  sel.addEventListener('change', () => { labInit(sel.value); rerenderView(); });
  const out = el('div'), heat = el('div', { class: 'chart' });
  const ctl = (key, label, min, max, step, fmtV, help) => {
    const o = el('output', { text: fmtV(LAB[key]) });
    const inp = el('input', { type: 'range', min, max, step, value: LAB[key] });
    inp.addEventListener('input', () => { LAB[key] = +inp.value; if (key === 'bD' || key === 'bR') LAB.S = +(100 - LAB.bD - LAB.bR).toFixed(1); o.textContent = fmtV(LAB[key]); refresh(); });
    return el('div', { class: 'ctrl' }, el('label', null, label, o), inp, help ? el('span', { class: 'help', text: help }) : null);
  };
  const pctF = (v) => Math.round(v * 100) + '%', ptsF = (v) => v.toFixed(1) + '%', tF = (v) => (v >= 1 ? '+' : '') + Math.round((v - 1) * 100) + '%';
  const controls = el('div', { class: 'card' }, el('h3', { text: 'Levers' }), el('p', { class: 'sub', text: 'Bases come from this state’s recent statewide results (two-party vote). Move them, or move turnout and persuasion.' }),
    el('div', { class: 'ctrl' }, el('label', { text: 'Race' }), sel),
    ctl('p', 'Swing slice going D', 0, 1, 0.01, pctF, 'Persuasion: how the movable middle breaks.'),
    ctl('tD', 'D base turnout vs. normal', 0.85, 1.15, 0.01, tF, 'Mobilization: a 5% drop means 1 in 20 base voters stays home.'),
    ctl('tR', 'R base turnout vs. normal', 0.85, 1.15, 0.01, tF),
    ctl('tS', 'Swing-voter turnout vs. normal', 0.7, 1.15, 0.01, tF, 'Midterm electorates are older and more partisan; swing voters drop off more.'),
    ctl('bD', 'D base (share of two-party vote)', 30, 60, 0.1, ptsF),
    ctl('bR', 'R base (share of two-party vote)', 30, 60, 0.1, ptsF),
    el('button', { class: 'btn small', onclick: () => { labInit(LAB.ctx); rerenderView(); } }, 'Reset to data + today’s model'));
  root.append(el('div', { class: 'grid g-main' }, el('div', null, out, el('div', { class: 'card', style: 'margin-top:16px' }, el('h3', { text: 'Persuasion × mobilization' }), el('p', { class: 'sub', text: 'Projected margin for every mix of swing-voter break (across) and base-turnout gap (up = Democratic base turns out more). The turquoise line is the hinge: every point on it is a tie. Dots mark past races at typical turnout.' }), heat)), controls));
  function refresh() {
    const base = labBase(); const margin = E.labMargin({ ...base, p: LAB.p });
    const hingeM = labHinge(ctx); const needP = E.labSolveP(base, hingeM);
    const mm = labModelMargin(ctx); const modelP = mm != null ? E.labSolveP(base, mm) : null;
    const S2 = LAB.S;
    out.replaceChildren(el('div', { class: 'card' },
      el('div', { class: 'kicker', text: ctx.label }),
      el('div', { style: 'display:flex;height:42px;border-radius:10px;overflow:hidden;margin:12px 0 6px;font:700 12px var(--f-sans);color:#fff' },
        el('div', { style: `width:${LAB.bD}%;background:${PAL.dem};display:flex;align-items:center;padding-left:10px`, text: 'D base ' + LAB.bD.toFixed(1) + '%' }),
        el('div', { style: `width:${S2}%;background:${PAL.amber};display:flex;align-items:center;justify-content:center;color:#1d1913`, text: S2 >= 6 ? 'Swing ' + S2.toFixed(1) + '%' : '' }),
        el('div', { style: `width:${LAB.bR}%;background:${PAL.rep};display:flex;align-items:center;justify-content:flex-end;padding-right:10px`, text: 'R base ' + LAB.bR.toFixed(1) + '%' })),
      el('p', { class: 'note', style: 'margin:0 0 12px' }, `Bases = the lowest two-party share each party posted across ${ctx.refs.length} recent ${ctx.national ? 'national House votes' : 'statewide races'} decided by 15 points or less; the swing slice is everything in between.`),
      el('div', { class: 'grid g3', style: 'gap:10px' },
        el('div', null, el('div', { class: 'eyebrow', text: 'With these levers' }), el('div', { style: 'font:500 32px/1.1 var(--f-display)' }, el('span', { class: 'lean ' + sideOf(margin), text: fm(margin) })), el('div', { class: 'note', text: 'two-party margin' })),
        el('div', null, el('div', { class: 'eyebrow', text: ctx.national ? 'D share for a House majority' : 'D share of slice to win' }), el('div', { style: 'font:500 32px/1.1 var(--f-display)', text: needP > 1 ? '>100%' : needP < 0 ? '<0%' : Math.round(needP * 100) + '%' }), el('div', { class: 'note', text: ctx.national ? 'hinge at ' + fm(hingeM) + ' nationally' : 'at these turnout levels' })),
        el('div', null, el('div', { class: 'eyebrow', text: 'Today’s model implies' }), el('div', { style: 'font:500 32px/1.1 var(--f-display)', text: modelP == null ? '—' : modelP > 1 ? '>100%' : modelP < 0 ? '<0%' : Math.round(modelP * 100) + '%' }), el('div', { class: 'note', text: mm == null ? '' : 'of the slice going D (' + fm(mm) + ')' })))));
    // heatmap
    drawLabHeat(heat, base, hingeM, modelP);
  }
  CHARTS.push(refresh);
  // reference races table
  const refs = ctx.refs.slice().sort((a, b) => a.year - b.year || a.label.localeCompare(b.label));
  root.append(el('div', { class: 'grid g2', style: 'margin-top:16px' },
    el('div', { class: 'card', style: 'align-self:start' }, el('h3', { text: 'How past races split the slice' }), el('p', { class: 'sub', text: 'Each race’s two-party Democratic share, and where it puts the swing slice (at typical turnout).' }),
      el('div', { class: 'tbl-wrap' }, el('table', { class: 't', style: 'min-width:0' }, el('thead', null, el('tr', null, ['Race', 'D two-party', 'Slice to D'].map((h, i) => el('th', { class: i ? 'n' : '', text: h })))),
        el('tbody', null, refs.map((r) => { const p = (r.d2 - LAB.bD) / Math.max(0.1, LAB.S); return el('tr', null, el('td', { text: r.label }), el('td', { class: 'n', text: r.d2.toFixed(1) + '%' }), el('td', { class: 'n', text: p < -0.01 ? 'below base' : p > 1.01 ? 'above range' : Math.round(Math.max(0, Math.min(1, p)) * 100) + '%' })); }))))),
    evidenceCard()));
  return root;
}
function drawLabHeat(host, base, hingeM, modelP) {
  const F = frame(host, 300, { t: 14, r: 14, b: 40, l: 52 });
  const nx = 40, ny = 24, dMax = 0.12;
  const x = scale(0, 1, F.m.l, F.m.l + F.iw), y = scale(-dMax, dMax, F.m.t + F.ih, F.m.t);
  const g = sv('g'); F.svg.append(g);
  const cw = F.iw / nx, ch = F.ih / ny;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const p = (i + 0.5) / nx, dlt = -dMax + (j + 0.5) * (2 * dMax / ny);
    const m = E.labMargin({ ...base, tD: 1 + dlt / 2, tR: 1 - dlt / 2, p });
    const r = sv('rect', { x: F.m.l + i * cw, y: F.m.t + F.ih - (j + 1) * ch, width: cw + 0.5, height: ch + 0.5, fill: divColor(m, 12) });
    g.append(r);
  }
  // hinge line
  const pts = []; for (let j = 0; j <= 48; j++) { const dlt = -dMax + j * (2 * dMax / 48); const p = E.labSolveP({ ...base, tD: 1 + dlt / 2, tR: 1 - dlt / 2 }, hingeM); if (p >= 0 && p <= 1) pts.push([x(p), y(dlt)]); }
  if (pts.length > 1) g.append(sv('path', { d: pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(''), fill: 'none', stroke: PAL.amber, 'stroke-width': 2.5 }));
  hline(g, F.m.l, F.m.l + F.iw, y(0), PAL.surface, 1);
  [0, 0.25, 0.5, 0.75, 1].forEach((t) => txt(g, x(t), F.h - 22, Math.round(t * 100) + '%', { 'text-anchor': 'middle' }));
  txt(g, F.m.l + F.iw / 2, F.h - 4, 'Share of the swing slice going D', { 'text-anchor': 'middle', class: 'lbl' });
  [-0.1, -0.05, 0, 0.05, 0.1].forEach((t) => txt(g, F.m.l - 6, y(t) + 3, (t > 0 ? 'D+' : t < 0 ? 'R+' : '') + Math.round(Math.abs(t) * 100) + '%', { 'text-anchor': 'end' }));
  const ov = sv('rect', { x: F.m.l, y: F.m.t, width: F.iw, height: F.ih, fill: 'transparent', style: 'cursor:crosshair' }); g.append(ov);
  ov.addEventListener('pointermove', (ev) => { const r = F.svg.getBoundingClientRect(); const px = (ev.clientX - r.left) * (F.w / r.width), py = (ev.clientY - r.top) * (F.h / r.height); const p = Math.max(0, Math.min(1, x.inv(px))), dlt = Math.max(-dMax, Math.min(dMax, y.inv(py))); const m = E.labMargin({ ...base, tD: 1 + dlt / 2, tR: 1 - dlt / 2, p }); tipShow(ev, (t) => { t.append(tipRow(fm(m), 'projected margin')); t.append(el('div', { class: 'tk', text: `${Math.round(p * 100)}% of slice to D · turnout gap ${(dlt > 0 ? 'D+' : dlt < 0 ? 'R+' : '') + Math.abs(dlt * 100).toFixed(0)}%` })); }); });
  ov.addEventListener('pointerleave', tipHide);
  ov.addEventListener('click', (ev) => { const r = F.svg.getBoundingClientRect(); const px = (ev.clientX - r.left) * (F.w / r.width), py = (ev.clientY - r.top) * (F.h / r.height); LAB.p = +Math.max(0, Math.min(1, x.inv(px))).toFixed(2); const dlt = Math.max(-dMax, Math.min(dMax, y.inv(py))); LAB.tD = +(1 + dlt / 2).toFixed(3); LAB.tR = +(1 - dlt / 2).toFixed(3); rerenderView(); });
  // past races
  const ctx = labCtx();
  ctx.refs.forEach((r) => { let p = (r.d2 - LAB.bD) / Math.max(0.1, LAB.S); if (p < -0.01 || p > 1.01) return; p = Math.max(0, Math.min(1, p)); const c = sv('circle', { cx: x(p), cy: y(0), r: 4.5, fill: PAL.surface, stroke: PAL.ink, 'stroke-width': 1.5 }); g.append(c); const hit = sv('circle', { cx: x(p), cy: y(0), r: 11, fill: 'transparent' }); g.append(hit); hoverable(hit, (t) => { t.append(el('div', { style: 'font-weight:700', text: r.label })); t.append(tipRow(r.d2.toFixed(1) + '%', 'D two-party share')); t.append(tipRow(Math.round(p * 100) + '%', 'of the slice to D')); }); });
  if (modelP != null && modelP >= 0 && modelP <= 1) { g.append(sv('circle', { cx: x(modelP), cy: y(0), r: 7, fill: PAL.amber, stroke: PAL.surface, 'stroke-width': 2 })); txt(g, x(modelP) + 9, y(0) - 8, 'Model today', { class: 'lbl-strong' }); }
  const cur = sv('circle', { cx: x(LAB.p), cy: y(LAB.tD - LAB.tR), r: 6, fill: PAL.ink, stroke: PAL.surface, 'stroke-width': 2 }); g.append(cur);
}
function evidenceCard() {
  const ev = D.history.swingEvidence || [];
  return el('div', { class: 'card' }, el('h3', { text: 'Does the evidence back the idea?' }), el('p', { class: 'sub', text: 'What validated-voter studies and election data say about switching versus turnout. Tagged by whether each finding supports the “small movable middle” view, complicates it, or is context.' }),
    ev.map((e) => el('div', { class: 'evid' }, el('span', { class: 'ev', style: 'font-size:16px' }, e.value), el('span', { class: 'ec' }, el('span', { class: 'tag ' + (e.stance === 'for' ? 'for' : e.stance === 'against' ? 'against' : ''), style: 'margin-right:6px', text: e.stance === 'for' ? 'supports' : e.stance === 'against' ? 'complicates' : 'context' }), rich(e.stat)), el('span', { class: 'es' }, e.source || '', ' ', link(e.url, '↗')))));
}

/* =========================================================== TRACKER */
function viewTracker() {
  const root = el('div');
  root.append(sectionHead('', 'Tracker', 'Log new polls as they drop; the averages, forecasts and movement chart update on the spot. Everything you add stays in this browser — export it to keep a copy or move it to another device.'));
  // movement chart
  const snaps = [D.baseline].concat(Object.values(history).filter((h) => h.d !== D.baseline.d || userPolls.length || excluded.size)).reduce((m, s) => (m[s.d] = s, m), {});
  const arr = Object.values(snaps).sort((a, b) => a.d.localeCompare(b.d));
  const t0 = E.t(BASE_DATE), t1 = E.t(ELECTION);
  const xT = []; for (let tt = t0; tt <= t1; tt += 7 * 86400000) xT.push(tt); if (t1 - xT[xT.length - 1] > 4 * 86400000) xT.push(t1);
  root.append(el('div', { class: 'grid g-main' },
    chartCard('Movement since October 11', `One point per day the calibrated model ran (custom settings and called races are not logged). ${arr.length} day${arr.length === 1 ? '' : 's'} recorded.`, (host) => drawLine(host, {
      height: 260, xMin: t0, xMax: t1, yMin: 0, yMax: 100, xTicks: xT, xFmt: (v) => fd(new Date(v).toISOString().slice(0, 10)), xFmtLong: (v) => fdy(new Date(v).toISOString().slice(0, 10)), yFmt: (v) => v + '%', yFmtTip: (v) => Math.round(v) + '%', r: 20,
      refs: [{ y: 50, label: '50%', color: PAL.axis }], vrefs: [{ x: E.t(RES.asOf), label: 'Today', color: PAL.axis }],
      series: [
        { name: 'GOP keeps Senate', color: PAL.rep, pts: arr.map((s) => ({ x: E.t(s.d), y: s.sR * 100 })) },
        { name: 'Dems win House', color: PAL.dem, pts: arr.map((s) => ({ x: E.t(s.d), y: s.hD * 100 })) },
        { name: 'Ohio gov: ' + (raceById[D.ohio.govId] ? raceById[D.ohio.govId].dem : 'D') + ' wins', color: PAL.ind, dash: '1 0', pts: arr.filter((s) => s.gov != null).map((s) => ({ x: E.t(s.d), y: s.gov * 100 })) },
      ],
    }), legend([{ color: PAL.rep, label: 'GOP keeps Senate', line: true }, { color: PAL.dem, label: 'Dems win House', line: true }, { color: PAL.ind, label: 'Ohio governor (D win)', line: true }])),
    pollForm()));
  // poll log
  root.append(sectionHead('', 'Every poll in the model', 'Uncheck a poll to drop it from the averages. Polls you added are tagged.'));
  root.append(pollLog());
  // calendar
  root.append(sectionHead('', 'The last stretch, week by week', null));
  root.append(calendarCard());
  // data tools
  root.append(sectionHead('', 'Save, move or reset', null));
  root.append(dataTools());
  return root;
}
function raceOptions() {
  return [['GB', 'Generic congressional ballot']].concat(D.races.map((r) => [r.id, r.name + ' — ' + (r.office === 'Governor' ? 'Governor' : 'Senate' + (r.special ? ' (special)' : ''))]));
}
function pollForm() {
  const f = {};
  const field = (key, label, input) => { f[key] = input; return el('label', null, label, input); };
  const raceSel = el('select', null, raceOptions().map(([v, l]) => el('option', { value: v, text: l })));
  const part = el('select', null, [['', 'Nonpartisan'], ['D', 'D-sponsored'], ['R', 'R-sponsored']].map(([v, l]) => el('option', { value: v, text: l })));
  const pop = el('select', null, ['LV', 'RV', 'A'].map((v) => el('option', { value: v, text: v })));
  const today = todayISO();
  const form = el('form', { class: 'card', onsubmit: (ev) => {
    ev.preventDefault();
    const dem = parseFloat(f.dem.value), rep = parseFloat(f.rep.value);
    if (!f.pollster.value.trim() || isNaN(dem) || isNaN(rep) || !f.end.value) { toast('Add a pollster, an end date and both shares'); return; }
    const p = { id: 'u' + Date.now(), race: raceSel.value, pollster: f.pollster.value.trim(), sponsor: '', partisan: part.value, start: f.start.value || f.end.value, end: f.end.value, n: parseInt(f.n.value, 10) || 600, pop: pop.value, dem, rep, oth: parseFloat(f.oth.value) || null, url: f.url.value.trim() || null, user: true };
    userPolls.push(p); LS.set('userPolls', userPolls); toast('Poll added — model re-run'); rerender();
  } },
  el('h3', { text: 'Add a poll' }), el('p', { class: 'sub', text: 'Enter the headline likely-voter numbers when a poll offers several versions. For Nebraska, put the independent in the D column.' }),
  el('div', { class: 'form' },
    el('label', { style: 'grid-column:1/-1' }, 'Race', raceSel),
    field('pollster', 'Pollster', el('input', { type: 'text', placeholder: 'e.g. Emerson' })),
    el('label', null, 'Sponsor', part),
    field('start', 'Field start', el('input', { type: 'date', value: today })),
    field('end', 'Field end', el('input', { type: 'date', value: today })),
    field('n', 'Sample size', el('input', { type: 'number', min: '50', placeholder: '800' })),
    el('label', null, 'Population', pop),
    field('dem', 'D / I %', el('input', { type: 'number', step: '0.1', placeholder: '47' })),
    field('rep', 'R %', el('input', { type: 'number', step: '0.1', placeholder: '46' })),
    field('oth', 'Other %', el('input', { type: 'number', step: '0.1', placeholder: '' })),
    el('label', { style: 'grid-column:1/-1' }, 'Link', f.url = el('input', { type: 'text', placeholder: 'https://…' }))),
  el('div', { class: 'row', style: 'margin-top:12px' }, el('button', { class: 'btn primary', type: 'submit' }, 'Add poll & re-run'), el('span', { class: 'note', text: userPolls.length ? `${userPolls.length} poll${userPolls.length === 1 ? '' : 's'} added by you` : '' })));
  return form;
}
let LOG_FILTER = 'all';
function pollLog() {
  const sel = el('select', null, [['all', 'All races']].concat(raceOptions()).map(([v, l]) => { const o = el('option', { value: v, text: l }); if (v === LOG_FILTER) o.selected = true; return o; }));
  sel.addEventListener('change', () => { LOG_FILTER = sel.value; rerenderView(); });
  const polls = allPolls().filter((p) => LOG_FILTER === 'all' || p.race === LOG_FILTER).sort((a, b) => (b.end || '').localeCompare(a.end || ''));
  const nameOf = (id) => (id === 'GB' ? 'Generic ballot' : raceById[id] ? raceById[id].name + (raceById[id].office === 'Governor' ? ' Gov' : raceById[id].special ? ' Sen (sp.)' : ' Sen') : id);
  const rows = polls.map((p) => {
    const cb = el('input', { type: 'checkbox', 'aria-label': 'Include poll' }); cb.checked = !excluded.has(p.id);
    cb.addEventListener('change', () => { if (cb.checked) excluded.delete(p.id); else excluded.add(p.id); LS.set('excluded', [...excluded]); rerender(); });
    const L = p.race !== 'GB' && raceById[p.race] ? dl(raceById[p.race]) : 'D';
    return el('tr', { class: excluded.has(p.id) ? 'dim' : '' }, el('td', null, cb), el('td', { class: 'mono', text: fd(p.end) }), el('td', { text: nameOf(p.race) }),
      el('td', null, p.pollster, p.partisan ? el('span', { class: 'tag', style: 'margin-left:6px', text: p.partisan + ' sponsor' }) : null, p.user ? el('span', { class: 'tag', style: 'margin-left:6px', text: 'you added' }) : null, p.approxDate ? el('span', { class: 'tag', style: 'margin-left:6px', title: 'Field dates not published in the sources found; estimated from the listing or publication date', text: 'dates ≈' }) : null),
      el('td', { class: 'n', text: (p.n || '—') + ' ' + (p.pop || '') }), el('td', { class: 'n', text: p.dem + ' – ' + p.rep }), el('td', { class: 'n', text: fm(p.dem - p.rep, L) }),
      el('td', null, p.user ? el('button', { class: 'btn small', onclick: () => { userPolls = userPolls.filter((q) => q.id !== p.id); LS.set('userPolls', userPolls); rerender(); } }, 'Delete') : link(p.url, '↗')));
  });
  return el('div', null, el('div', { class: 'row', style: 'margin-bottom:10px' }, sel, el('span', { class: 'note', text: `${polls.length} polls shown · ${excluded.size} excluded` })),
    el('div', { class: 'tbl-wrap', style: 'max-height:520px;overflow:auto' }, el('table', { class: 't' }, el('thead', null, el('tr', null, ['Use', 'End', 'Race', 'Pollster', 'Sample', 'D/I – R', 'Margin', ''].map((h, i) => el('th', { class: i >= 4 && i <= 6 ? 'n' : '', text: h })))), el('tbody', null, rows))));
}
function calendarCard() {
  const cal = (D.calendar || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const weeks = [['Week 1', '2026-10-11', '2026-10-17'], ['Week 2', '2026-10-18', '2026-10-24'], ['Week 3', '2026-10-25', '2026-10-31'], ['Final days', '2026-11-01', '2026-11-04']];
  const today = todayISO();
  return el('div', { class: 'card' }, weeks.map(([w, a, b]) => {
    const items = cal.filter((c) => c.date >= a && c.date <= b);
    return el('div', { class: 'week' }, el('h4', null, w + ' · ' + fd(a) + '–' + fd(b), today >= a && today <= b ? el('span', { class: 'today-mark', text: '  ← this week' }) : null),
      items.length ? el('ul', null, items.map((c) => el('li', null, el('b', { class: c.date === today ? 'today-mark' : '', text: fd(c.date) + ': ' }), rich(c.label), c.note ? [' — ', el('span', { class: 'x' }, rich(c.note))] : null, c.url ? [' ', link(c.url, '↗')] : null))) : el('div', { class: 'note', text: 'Nothing logged.' }));
  }));
}
function dataTools() {
  const file = el('input', { type: 'file', accept: 'application/json,.json', style: 'display:none' });
  file.addEventListener('change', async () => {
    const fl = file.files && file.files[0]; if (!fl) return;
    try {
      const j = JSON.parse(await fl.text());
      if (!j || j.app !== 'the-hinge-2026') throw new Error('not a Hinge export');
      if (Array.isArray(j.userPolls)) { const ids = new Set(userPolls.map((p) => p.id)); j.userPolls.forEach((p) => { if (p && p.id && !ids.has(p.id) && typeof p.dem === 'number' && typeof p.rep === 'number') userPolls.push(Object.assign({}, p, { user: true })); }); }
      if (Array.isArray(j.excluded)) j.excluded.forEach((x) => excluded.add(String(x)));
      if (j.history && typeof j.history === 'object') Object.assign(history, j.history);
      if (j.settings && typeof j.settings === 'object') Object.keys(DEFAULTS).forEach((k) => { if (k in j.settings && typeof j.settings[k] === typeof DEFAULTS[k]) S[k] = j.settings[k]; });
      saveAll(); toast('Imported'); rerender();
    } catch (e) { toast('Could not import: ' + e.message); }
    file.value = '';
  });
  const exp = () => {
    const blob = new Blob([JSON.stringify({ app: 'the-hinge-2026', exported: new Date().toISOString(), settings: S, userPolls, excluded: [...excluded], calls, history }, null, 1)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'hinge-2026-tracker-' + todayISO() + '.json' }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  const csv = () => {
    const rows = [['race', 'pollster', 'partisan', 'start', 'end', 'n', 'pop', 'dem', 'rep', 'other', 'excluded', 'url']].concat(allPolls().map((p) => [p.race, p.pollster, p.partisan || '', p.start, p.end, p.n || '', p.pop || '', p.dem, p.rep, p.oth ?? '', excluded.has(p.id) ? 1 : 0, p.url || '']));
    const text = rows.map((r) => r.map((v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/csv' })), download: 'hinge-2026-polls-' + todayISO() + '.csv' }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  const reset = () => { if (!confirmReset.armed) { confirmReset.armed = true; resetBtn.textContent = 'Click again to erase your polls, calls and history'; setTimeout(() => { confirmReset.armed = false; resetBtn.textContent = 'Reset everything'; }, 4000); return; } userPolls = []; excluded = new Set(); calls = {}; history = {}; S = Object.assign({}, DEFAULTS); saveAll(); toast('Reset to the Oct 11 baseline'); rerender(); };
  const confirmReset = {}; const resetBtn = el('button', { class: 'btn', onclick: reset }, 'Reset everything');
  return el('div', { class: 'card' }, el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: exp }, 'Export tracker (.json)'), el('button', { class: 'btn', onclick: () => file.click() }, 'Import .json'), el('button', { class: 'btn', onclick: csv }, 'Download polls (.csv)'), resetBtn, file),
    el('p', { class: 'note', style: 'margin:10px 0 0' }, 'Storage is this browser only (localStorage). Exports include your added polls, exclusions, election-night calls, settings and the daily movement log.'));
}

/* =========================================================== METHOD */
function viewMethod() {
  const B = D.history.backtest, root = el('div');
  root.append(sectionHead('', 'How the forecast works', `A polling average tuned on **${B.n_races.toLocaleString()}** general-election races and **${B.n_polls.toLocaleString()}** polls (1998–2022, from 538’s public pollster-ratings data), plus 2024 results, run through a correlated simulation.`));
  root.append(el('div', { class: 'card' }, el('ol', { style: 'margin:0;padding-left:20px;display:grid;gap:10px' }, (D.method.steps || []).map((s) => el('li', null, el('b', { text: s.t + '. ' }), rich(s.d))))));
  if ((D.method.steps2 || []).length) {
    root.append(sectionHead('', 'How the three witnesses are combined', 'The headline numbers are a weighted average of three separate forecasts, each produced independently.'));
    root.append(el('div', { class: 'card' }, el('ol', { style: 'margin:0;padding-left:20px;display:grid;gap:10px' }, D.method.steps2.map((s) => el('li', null, el('b', { text: s.t + '. ' }), rich(s.d))))));
  }
  const cb = D.history.cycleBiasCompetitive || [];
  root.append(el('div', { class: 'grid g2', style: 'margin-top:16px' },
    chartCard('Polling misses by cycle', 'Average signed error of final polling averages in competitive Senate and governor races (|margin| ≤ 10). Up = polls overstated Democrats.', (host) => drawVBars(host, cb.map((c) => ({ label: "'" + String(c.cycle).slice(2), v: c.bias, color: c.bias >= 0 ? PAL.dem : PAL.rep, dim: c.cycle % 4 === 0, tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: c.cycle + (c.cycle % 4 === 2 ? ' (midterm)' : ' (presidential year)') })); t.append(tipRow((c.bias >= 0 ? 'D' : 'R') + ' +' + Math.abs(c.bias).toFixed(1), 'average overstatement')); if (c.n) t.append(el('div', { class: 'tk', text: c.n + ' races' + (c.src ? ' · ' + c.src : '') })); } })), { fmt: (v) => (v > 0 ? '+' : '') + v }), legend([{ color: PAL.dem, label: 'Polls overstated D' }, { color: PAL.rep, label: 'Polls overstated R' }, { color: PAL.muted, label: 'Faded = presidential year' }])),
    chartCard('Generic ballot: final average vs. result', 'Signed error of the final generic-ballot polling average against the national House vote. Up = overstated Democrats.', (host) => drawVBars(host, (D.history.genericErrors || []).map((c) => ({ label: "'" + String(c.cycle).slice(2), v: c.err, color: c.err >= 0 ? PAL.dem : PAL.rep, dim: c.cycle % 4 === 0, tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: String(c.cycle) })); t.append(tipRow(fm(c.avg), 'final average')); t.append(tipRow(fm(c.actual), 'House popular vote')); if (c.src) t.append(el('div', { class: 'tk', text: c.src })); } })), { fmt: (v) => (v > 0 ? '+' : '') + v }))));
  root.append(el('div', { class: 'grid g3', style: 'margin-top:16px' },
    chartCard('More polls, smaller misses', 'Race-specific error (1σ) of the final average by number of polls, after removing each cycle’s shared miss.', (host) => drawHBars(host, B.resid_by_polls.map((r) => ({ label: r.polls + ' poll' + (r.polls === '1' ? '' : 's'), v: r.sd, color: PAL.amber, vl: '±' + r.sd.toFixed(1), tip: (t) => t.append(tipRow('±' + r.sd.toFixed(1) + ' pts', r.n + ' races')) })), { fmt: (v) => v, r: 50, l: 80 })),
    chartCard('How often the poll leader wins', 'Share of races won by the candidate leading the final average, by size of the lead.', (host) => drawHBars(host, B.call_accuracy.map((r) => ({ label: 'Lead ' + r.band + ' pts', v: r.mean * 100, color: PAL.ink2, vl: Math.round(r.mean * 100) + '%', tip: (t) => t.append(tipRow(Math.round(r.mean * 100) + '%', r.size + ' races')) })), { fmt: (v) => v + '%', min: 0, max: 100, r: 50, l: 96 })),
    el('div', { class: 'card' }, el('h3', { text: 'Calibration' }), el('p', { class: 'sub', text: 'Checks on the error model, run against the same history.' }),
      (D.method.facts || []).map((f) => el('div', { class: 'evid' }, el('span', { class: 'ev', style: 'font-size:17px', text: f.v }), el('span', { class: 'ec' }, rich(f.k)))))));
  const mt = D.history.midterms || [], om = D.history.octMoves || [];
  if (mt.length || om.length) root.append(el('div', { class: 'grid g2', style: 'margin-top:16px' },
    mt.length ? chartCard('The midterm penalty', D.history.midtermNote || '', (host) => drawVBars(host, mt.map((m) => ({ label: "'" + String(m.year).slice(2), v: m.house, color: m.approval < 50 ? PAL.ink2 : PAL.axis, tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: m.year + ' · ' + m.president + ' (' + m.party + ')' })); t.append(tipRow((m.house > 0 ? '+' : '') + m.house, 'House seats for the president’s party')); t.append(tipRow((m.senate > 0 ? '+' : '') + m.senate, 'Senate seats')); t.append(tipRow(m.approval + '%', 'Gallup approval before the vote')); } })), { height: 230, fmt: (v) => (v > 0 ? '+' : '') + v }), legend([{ color: PAL.ink2, label: 'Approval under 50%' }, { color: PAL.axis, label: '50% or higher' }])) : null,
    om.length ? chartCard('Late movement, Oct 11 → Election Day', D.history.octNote || '', (host) => drawVBars(host, om.map((m) => ({ label: "'" + String(m.year).slice(2), v: m.move, color: m.move >= 0 ? PAL.dem : PAL.rep, dim: m.year % 4 === 0, tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: String(m.year) })); t.append(tipRow(fm(m.oct11), 'generic ballot on Oct 11')); t.append(tipRow(fm(m.final), 'final average')); t.append(tipRow((m.move > 0 ? 'D +' : 'R +') + Math.abs(m.move).toFixed(1), 'movement')); } })), { height: 230, fmt: (v) => (v > 0 ? '+' : '') + v }), legend([{ color: PAL.dem, label: 'Moved toward D' }, { color: PAL.rep, label: 'Moved toward R' }, { color: PAL.muted, label: 'Faded = presidential year' }])) : null));
  // lens table
  root.append(sectionHead('', 'Which history do you trust?', 'The one judgment call that moves the forecast most is how much to correct for past polling misses. Pick a lens in Model settings; each applies an average historical miss to statewide polls and to the generic ballot.'));
  if ((D.history.biasCaveats || []).length) root.append(el('div', { class: 'callout', style: 'margin-bottom:12px' }, el('b', { text: 'Why the default correction is small. ' }), (D.history.biasCaveats || []).map((c, i) => [i ? ' ' : '', c])));
  root.append(el('div', { class: 'tbl-wrap' }, el('table', { class: 't' }, el('thead', null, el('tr', null, ['Lens', 'Statewide polls shifted', 'Generic ballot shifted', 'Basis'].map((h, i) => el('th', { class: i === 1 || i === 2 ? 'n' : '', text: h })))),
    el('tbody', null, Object.entries(D.lenses).map(([k, L]) => el('tr', { class: S.lens === k ? '' : '' }, el('td', null, el('b', { text: L.label }), S.lens === k ? el('span', { class: 'tag', style: 'margin-left:6px', text: 'active' }) : null, k === D.defaultLens ? el('span', { class: 'tag', style: 'margin-left:6px', text: 'default' }) : null), el('td', { class: 'n', text: L.state ? (L.state > 0 ? 'R +' : 'D +') + Math.abs(L.state).toFixed(1) : '0' }), el('td', { class: 'n', text: L.gb ? (L.gb > 0 ? 'R +' : 'D +') + Math.abs(L.gb).toFixed(1) : '0' }), el('td', { class: 'x', text: L.note || '' })))))));
  root.append(sectionHead('', 'What this model does not know', null));
  root.append(el('div', { class: 'card' }, el('ul', { style: 'margin:0;padding-left:18px;display:grid;gap:6px;font-size:13.5px' }, (D.method.limits || []).map((l) => el('li', null, rich(l))))));
  return root;
}

/* =========================================================== SOURCES */
function viewSources() {
  const root = el('div');
  root.append(sectionHead('', 'Where every number comes from', `Polls and ratings were gathered on ${fdy(BASE_DATE)} from the outlets below; each poll row links to its own source. Historical calibration uses 538’s public pollster-ratings dataset.`));
  const groups = {}; (D.sources || []).forEach((s) => { (groups[s.group || 'Other'] = groups[s.group || 'Other'] || []).push(s); });
  Object.entries(groups).forEach(([g, list]) => {
    root.append(el('div', { class: 'card', style: 'margin-bottom:14px' }, el('h3', { text: g }), el('ul', { class: 'srcs' }, list.map((s) => el('li', null, link(s.url, s.label), s.note ? ': ' + s.note : '')))));
  });
  root.append(el('p', { class: 'foot-note' }, D.meta.disclaimer || ''));
  return root;
}

/* =========================================================== SETTINGS */
function openSettings() {
  DRAWER = { kind: 'settings' };
  openDrawer((box) => {
    box.append(el('div', { class: 'kicker', text: 'Model settings' }), el('h2', { style: 'font:600 28px/1.1 var(--f-display);margin:6px 0 4px', text: 'Tune the assumptions' }),
      el('p', { class: 'sub', text: 'Defaults are the calibrated values. Changes re-run all 10,000 simulations and are saved in this browser.' }));
    const lensSeg = el('div', { class: 'seg', style: 'margin-bottom:6px' }, Object.entries(D.lenses).concat([['custom', { label: 'Custom' }]]).map(([k, L]) => el('button', { 'aria-pressed': S.lens === k ? 'true' : 'false', onclick: () => { S.lens = k; commit(true); } }, L.label)));
    const L = S.lens === 'custom' ? null : D.lenses[S.lens];
    box.append(el('div', { class: 'card', style: 'margin-bottom:14px' }, el('h3', { text: 'Historical bias lens' }), el('p', { class: 'sub', text: 'How much to shade polls for the way they have missed before.' }), lensSeg,
      L ? el('p', { class: 'note', style: 'margin:6px 0 0' }, `Statewide polls shifted ${L.state ? (L.state > 0 ? 'R +' : 'D +') + Math.abs(L.state).toFixed(1) : '0'}; generic ballot shifted ${L.gb ? (L.gb > 0 ? 'R +' : 'D +') + Math.abs(L.gb).toFixed(1) : '0'}. ${L.note || ''}`) : el('div', { class: 'grid g2', style: 'margin-top:8px' }, slider('customState', 'Statewide shift toward R', -5, 5, 0.1, (v) => (v >= 0 ? 'R +' : 'D +') + Math.abs(v).toFixed(1)), slider('customGB', 'Generic-ballot shift toward R', -5, 5, 0.1, (v) => (v >= 0 ? 'R +' : 'D +') + Math.abs(v).toFixed(1))),
      toggle('stateBiasOn', 'Apply each state’s own polling record (shrunk toward zero)')));
    box.append(el('div', { class: 'card', style: 'margin-bottom:14px' }, el('h3', { text: 'The blend' }),
      el('p', { class: 'sub', text: 'How much each witness counts in the headline call. Weights are relative; they are rescaled to add up to 100%.' }),
      slider('wPolls', 'Polls model', 0, 1, 0.05, (v) => Math.round(100 * v / (((+S.wPolls) + (+S.wMarkets) + (+S.wFund)) || 1)) + '%'),
      slider('wMarkets', 'Prediction markets', 0, 1, 0.05, (v) => Math.round(100 * v / (((+S.wPolls) + (+S.wMarkets) + (+S.wFund)) || 1)) + '%'),
      slider('wFund', 'History (approval, income, war)', 0, 1, 0.05, (v) => Math.round(100 * v / (((+S.wPolls) + (+S.wMarkets) + (+S.wFund)) || 1)) + '%'),
      el('p', { class: 'note', text: 'Defaults: 50% polls, 30% markets, 20% history. Polls carry the most weight because they measure this electorate directly; markets have a decent record but have missed in both directions; history’s error is the largest.' })));
    box.append(el('div', { class: 'card', style: 'margin-bottom:14px' }, el('h3', { text: 'Information age' }),
      el('p', { class: 'sub', text: 'Fat tails make a large shared miss (a viral October surprise, a deepfake, a polling failure) more likely without changing the standard deviation of the error.' }),
      el('div', { class: 'seg' }, [[0, 'Normal error'], [6, 'Moderate tails'], [4, 'Fat tails']].map(([v, l]) => el('button', { 'aria-pressed': (+S.tailDf || 0) === v ? 'true' : 'false', onclick: () => { S.tailDf = v; commit(true); } }, l)))));
    box.append(el('div', { class: 'card', style: 'margin-bottom:14px' }, el('h3', { text: 'Scenario' }),
      slider('envShift', 'Move every race (late swing / systematic miss)', -8, 8, 0.5, (v) => (v === 0 ? 'none' : (v > 0 ? 'D +' : 'R +') + Math.abs(v))),
      el('p', { class: 'note', text: 'Shifts the expected margin in every Senate, governor and House race at once.' })));
    box.append(el('div', { class: 'card', style: 'margin-bottom:14px' }, el('h3', { text: 'Uncertainty' }),
      slider('sigmaNat', 'National (shared) polling error, 1σ', 1, 5, 0.1, (v) => '±' + v.toFixed(1), 'Backtest: ±3.1 across 1998–2022; ±2.3 in midterms only.'),
      slider('sigmaReg', 'Regional error, 1σ', 0, 3, 0.1, (v) => '±' + v.toFixed(1)),
      slider('sigmaDist', 'House district error, 1σ', 3, 8, 0.5, (v) => '±' + v.toFixed(1))));
    box.append(el('div', { class: 'card', style: 'margin-bottom:14px' }, el('h3', { text: 'Polling average' }),
      slider('tau', 'Recency time constant (days)', 5, 30, 1, (v) => v + ' d', 'Backtest optimum: 14 days (weight halves every ~10 days).'),
      slider('partAdj', 'Partisan-sponsor adjustment', 0, 6, 0.5, (v) => v + ' pts', 'Backtest: D-sponsored polls ran 2.9 pts more D, R-sponsored 3.6 pts more R.'),
      slider('rvAdj', 'Registered-voter / adult poll shift', -3, 3, 0.5, (v) => (v === 0 ? '0' : (v > 0 ? 'D +' : 'R +') + Math.abs(v))),
      slider('fundWeight', 'Weight on fundamentals', 0, 1, 0.05, (v) => v.toFixed(2), 'Backtest: once a race has polls, fundamentals deserve little weight.')));
    box.append(el('div', { class: 'card', style: 'margin-bottom:14px' }, el('h3', { text: 'House' }),
      slider('houseRatingsW', 'Weight on forecaster ratings vs. PVI', 0, 1, 0.05, (v) => Math.round(v * 100) + '% ratings'),
      slider('houseInc', 'House incumbency advantage', 0, 6, 0.5, (v) => v + ' pts')));
    box.append(el('div', { class: 'card', style: 'margin-bottom:14px' }, el('h3', { text: 'Simulation' }),
      el('div', { class: 'seg' }, [2000, 10000, 25000].map((n) => el('button', { 'aria-pressed': S.nSims === n ? 'true' : 'false', onclick: () => { S.nSims = n; commit(true); } }, n.toLocaleString() + ' runs')))));
    box.append(el('button', { class: 'btn primary', onclick: () => { S = Object.assign({}, DEFAULTS); commit(true); toast('Calibrated defaults restored'); } }, 'Restore calibrated defaults'));
  });
}
function slider(key, label, min, max, step, fmtV, help) {
  const o = el('output', { text: fmtV(+S[key]) });
  const inp = el('input', { type: 'range', min, max, step, value: S[key] });
  inp.addEventListener('input', () => { S[key] = +inp.value; o.textContent = fmtV(+S[key]); commit(false); });
  return el('div', { class: 'ctrl' }, el('label', null, label, o), inp, help ? el('span', { class: 'help', text: help }) : null);
}
function toggle(key, label) {
  const cb = el('input', { type: 'checkbox' }); cb.checked = !!S[key];
  cb.addEventListener('change', () => { S[key] = cb.checked ? 1 : 0; commit(false); });
  return el('label', { class: 'row', style: 'margin-top:10px;font-size:13px;font-weight:600;gap:8px' }, cb, label);
}
let commitT = null;
function commit(redrawDrawer) {
  LS.set('settings', S);
  clearTimeout(commitT);
  commitT = setTimeout(() => { rerender(); if (redrawDrawer && DRAWER && DRAWER.kind === 'settings') openSettings(); }, redrawDrawer ? 0 : 220);
}

