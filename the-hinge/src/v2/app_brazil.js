/* =========================================================== BRAZIL: the 2026 runoff, the polls, the markets and the count (BR, from brazil_data.js) */
const BRZ = { pick: 'avg', w: { polls: 1, history: 1, markets: 1 }, err: 3, shift: 0, t: null, playing: false, timer: 0, vids: null };
const LC = () => PAL.rep, FC = () => PAL.dem;           // Brazil's party colors: PT red, PL blue
const brM = (v, d = 1) => (v / 1e6).toFixed(d) + 'M';
const brN = (v) => Math.round(v).toLocaleString('en-US');
const brP = (v, d = 1) => (v == null ? '—' : v.toFixed(d) + '%');
const brSgn = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
const brUTC = (iso) => Date.parse(iso);
const brMin = (iso) => { const d = new Date(brUTC(iso) - 3 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes() + (d.getUTCDate() - 25) * 1440; };   // minutes after midnight, Brasília, Oct. 25
const brHM = (m) => { const h = Math.floor(((m % 1440) + 1440) % 1440 / 60), mm = Math.round(((m % 60) + 60) % 60); return (h % 12 || 12) + ':' + String(mm).padStart(2, '0') + (h < 12 ? ' a.m.' : ' p.m.'); };
const brPhi = (z) => 0.5 * (1 + E_erf(z / Math.SQRT2));
function E_erf(x) { const s = Math.sign(x); x = Math.abs(x); const k = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x)); }
const srcLink = (u, label) => u ? el('a', { href: u, target: '_blank', rel: 'noopener noreferrer', class: 'src', text: label || (() => { try { const h = new URL(u).hostname.replace(/^www\./, ''); return /youtube/.test(h) ? 'video (CNN Brasil)' : h; } catch (e) { return 'source'; } })() }) : null;

/* ---------- a two-column flow diagram, values in votes */
function drawFlow(host, S, o = {}) {
  const W = Math.max(300, Math.floor(host.clientWidth || 700)), narrow = W < 560;
  const padL = o.padL ?? (narrow ? 104 : 190), padR = o.padR ?? (narrow ? 96 : 190), nodeW = 10, gap = o.gap ?? 10, padT = 26, padB = 8;
  const nodes = S.nodes.map((n) => Object.assign({ v: 0, outs: [], ins: [] }, n));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const links = S.links.filter((l) => l.v > 0 && byId[l.s] && byId[l.t]).map((l) => Object.assign({}, l));
  links.forEach((l) => { byId[l.s].outs.push(l); byId[l.t].ins.push(l); });
  nodes.forEach((n) => { n.v = Math.max(n.outs.reduce((s, l) => s + l.v, 0), n.ins.reduce((s, l) => s + l.v, 0)); });
  const cols = [0, 1].map((c) => nodes.filter((n) => n.col === c && n.v > 0));
  const H0 = o.height || (narrow ? 360 : 420), minH = o.minH ?? 3;
  const k = Math.min(...cols.map((c) => (H0 - padT - padB - gap * (c.length - 1)) / c.reduce((s, n) => s + n.v, 0)));
  const xs = [padL, W - padR - nodeW];
  let H = H0;
  cols.forEach((c, ci) => {
    const used = c.reduce((s, n) => s + Math.max(minH, n.v * k), 0) + gap * (c.length - 1);
    let y = padT + Math.max(0, (H0 - padT - padB - used) / 2);
    c.forEach((n) => { n.h = Math.max(minH, n.v * k); n.x = xs[ci]; n.y = y; y += n.h + gap; });
    H = Math.max(H, y + padB);
  });
  nodes.forEach((n) => {
    let y = n.y; n.outs.sort((a, b) => byId[a.t].y - byId[b.t].y).forEach((l) => { l.y0 = y; l.h = l.v * k; y += l.h; });
    y = n.y; n.ins.sort((a, b) => byId[a.s].y - byId[b.s].y).forEach((l) => { l.y1 = y; y += l.v * k; });
  });
  const svg = sv('svg', { width: W, height: Math.ceil(H), viewBox: `0 0 ${W} ${Math.ceil(H)}`, role: 'img', 'aria-label': o.aria || 'Flow diagram' });
  host.replaceChildren(svg);
  const gL = sv('g'), gN = sv('g'), gT = sv('g'); svg.append(gL, gN, gT);
  (o.heads || []).forEach((lab, ci) => txt(gT, ci === 0 ? xs[0] + nodeW : xs[1], 14, lab, { class: 'lbl', 'text-anchor': ci === 0 ? 'end' : 'start' }));
  const linkEls = [];
  links.forEach((l) => {
    const s = byId[l.s], t = byId[l.t], x0 = s.x + nodeW, x1 = t.x, xm = (x0 + x1) / 2, h = Math.max(0.6, l.h);
    const d = `M${x0},${l.y0}C${xm},${l.y0} ${xm},${l.y1} ${x1},${l.y1}L${x1},${l.y1 + h}C${xm},${l.y1 + h} ${xm},${l.y0 + h} ${x0},${l.y0 + h}Z`;
    const p = sv('path', { d, fill: l.color || t.color || PAL.muted, opacity: l.hl ? 0.62 : 0.3, class: 'sk-link' });
    p.__l = l; linkEls.push(p); gL.append(p);
    hoverable(p, (tt) => { tt.append(el('div', { style: 'font-weight:700', text: s.label + ' → ' + t.label })); tt.append(tipRow(o.fmt ? o.fmt(l.v) : brN(l.v), l.note || '', l.color || t.color)); if (l.range) tt.append(el('div', { class: 'tk', text: l.range })); });
  });
  nodes.filter((n) => n.v > 0).forEach((n) => {
    const r = sv('rect', { x: n.x, y: n.y, width: nodeW, height: Math.max(1.5, n.h), rx: 2, fill: n.color || PAL.ink2 }); gN.append(r);
    const left = n.col === 0, tx = left ? n.x - 8 : n.x + nodeW + 8, cy = n.y + n.h / 2;
    txt(gT, tx, cy - 1, n.label, { class: 'lbl-strong', 'text-anchor': left ? 'end' : 'start' });
    txt(gT, tx, cy + 13, n.sub || (o.fmt ? o.fmt(n.v) : brN(n.v)), { 'text-anchor': left ? 'end' : 'start' });
    const hit = sv('rect', { x: n.x - 4, y: n.y, width: nodeW + 8, height: Math.max(8, n.h), fill: 'transparent' }); gN.append(hit);
    hit.addEventListener('pointerenter', () => linkEls.forEach((p) => p.setAttribute('opacity', p.__l.s === n.id || p.__l.t === n.id ? 0.66 : 0.08)));
    hit.addEventListener('pointerleave', () => linkEls.forEach((p) => p.setAttribute('opacity', p.__l.hl ? 0.62 : 0.3)));
  });
}

/* ---------- the night: the market and the count on one clock */
const BR_EVENTS = [
  { m: 16 * 60 + 32, en: 'Lula’s coalition asks the Supreme Court to extend voting over a lack of buses in three Bahia cities.' },
  { m: 17 * 60, en: 'Polls close where voting has ended. The count begins.' },
  { m: 17 * 60 + 6, en: 'First TSE file: 0.25% of sections, Lula 57.7%. Early files are tiny and unrepresentative.' },
  { m: 17 * 60 + 12, en: 'Polymarket drops Flávio from 76% to 65% in six minutes. No single large order; no confirmed cause.' },
  { m: 17 * 60 + 23, en: 'The TSE pauses the count: Justice Zanin has extended voting to 7 p.m. where sections are still open.' },
  { m: 19 * 60, en: 'The count resumes.' },
  { m: 19 * 60 + 41, en: '11.9% counted: Lula 50.3, Flávio 49.7. Traders now give Flávio about 30%.' },
  { m: 20 * 60 + 3, en: '25% counted and Flávio leads 50.5 to 49.5, yet Polymarket has Lula at 79%: the Northeast and the big cities count late.' },
  { m: 20 * 60 + 28, en: '50% counted: Lula takes the lead for good, 50.1 to 49.9.' },
  { m: 20 * 60 + 41, en: '67% counted: Lula 50.9. Polymarket has Flávio under 5%.' },
  { m: 21 * 60 + 32, en: '99.9% counted: Lula 51.8, Flávio 48.2, a margin of 4.4 million votes.' },
];
const BR_T0 = 14 * 60, BR_T1 = 22 * 60 + 20;
function drawNight(host, now) {
  const F = frame(host, 340, { t: 22, r: 46, b: 30, l: 44 });
  const x = scale(BR_T0, BR_T1, F.m.l, F.m.l + F.iw), g = sv('g'); F.svg.append(g);
  const midGap = 22, h1 = (F.ih - midGap) * 0.5, top1 = F.m.t, top2 = F.m.t + h1 + midGap;
  const y1 = scale(0, 100, top1 + h1, top1), y2 = scale(46, 58, top2 + h1, top2);
  [0, 50, 100].forEach((v) => { hline(g, F.m.l, F.m.l + F.iw, y1(v), v === 50 ? PAL.axis : PAL.grid); txt(g, F.m.l - 6, y1(v) + 3, v + '%', { 'text-anchor': 'end' }); });
  [48, 50, 52, 54, 56].forEach((v) => { hline(g, F.m.l, F.m.l + F.iw, y2(v), v === 50 ? PAL.axis : PAL.grid); txt(g, F.m.l - 6, y2(v) + 3, v + '%', { 'text-anchor': 'end' }); });
  txt(g, F.m.l + 2, top1 - 8, 'Polymarket: chance Flávio wins', { class: 'lbl' });
  txt(g, F.m.l + 2, top2 - 8, 'TSE count: Lula’s share of valid votes counted so far', { class: 'lbl' });
  for (let m = BR_T0; m <= BR_T1; m += 60) { vline(g, x(m), top1, top2 + h1, PAL.grid); txt(g, x(m), F.h - 10, brHM(m).replace(':00', ''), { 'text-anchor': 'middle' }); }
  g.append(sv('rect', { x: x(17 * 60 + 23), y: top2, width: x(19 * 60) - x(17 * 60 + 23), height: h1, fill: PAL.grid, opacity: 0.6 }));
  txt(g, (x(17 * 60 + 23) + x(19 * 60)) / 2, top2 + h1 / 2 + 4, 'count paused', { 'text-anchor': 'middle', class: 'lbl' });
  const mk = BR.markets.series.filter((p) => p.venue === 'Polymarket').map((p) => ({ m: brMin(p.t), y: p.flavio * 100 })).filter((p) => p.m >= BR_T0 - 200 && p.m <= BR_T1 + 30);
  const ct = BR.count.filter((c) => c.pst > 0).map((c) => ({ m: brMin(c.t), y: c.lula, pst: c.pst }));
  const upto = (arr) => { const a = arr.filter((p) => p.m <= now); return a; };
  const path = (arr, y) => arr.map((p, i) => (i ? 'L' : 'M') + x(Math.max(BR_T0, p.m)).toFixed(1) + ',' + y(p.y).toFixed(1)).join('');
  const m1 = upto(mk), c1 = upto(ct);
  if (m1.length) g.append(sv('path', { d: path(m1, y1), fill: 'none', stroke: FC(), 'stroke-width': 2.4, 'stroke-linejoin': 'round' }));
  if (c1.length) {
    const segs = [[]]; c1.forEach((p, i) => { if (i && p.m - c1[i - 1].m > 60) segs.push([]); segs[segs.length - 1].push(p); });   // the pause is a gap, not a line
    segs.forEach((sg) => g.append(sv('path', { d: path(sg, y2), fill: 'none', stroke: LC(), 'stroke-width': 2.4, 'stroke-linejoin': 'round' })));
    c1.forEach((p) => g.append(sv('circle', { cx: x(p.m), cy: y2(p.y), r: 3.2, fill: p.y >= 50 ? LC() : FC(), stroke: PAL.surface, 'stroke-width': 1.2 })));
  }
  BR_EVENTS.forEach((e, i) => { if (e.m > now) return; vline(g, x(e.m), top1, top2 + h1, PAL.ink2, 0.6); g.lastChild.setAttribute('stroke-dasharray', '2 3'); g.lastChild.setAttribute('opacity', 0.45); txt(g, x(e.m) + 2, top1 + 10 + (i % 3) * 10, String(i + 1), { class: 'lbl', 'font-size': '9.5px' }); });
  const nx = x(Math.min(now, BR_T1));
  g.append(sv('line', { x1: nx, x2: nx, y1: top1 - 4, y2: top2 + h1, stroke: PAL.accent, 'stroke-width': 1.6 }));
  const lm = m1[m1.length - 1], lc = c1[c1.length - 1];
  if (lm) txt(g, F.m.l + F.iw + 4, y1(lm.y) + 4, Math.round(lm.y) + '%', { class: 'lbl-strong' });
  if (lc) txt(g, F.m.l + F.iw + 4, y2(lc.y) + 4, lc.y.toFixed(1), { class: 'lbl-strong' });
}
function nightCard() {
  const host = el('div', { class: 'chart' }), cap = el('p', { class: 'night-cap', 'aria-live': 'polite' }), clock = el('span', { class: 'night-clock' });
  const range = el('input', { type: 'range', min: BR_T0, max: BR_T1, step: 1, value: BRZ.t ?? BR_T1, 'aria-label': 'Time on election night' });
  const btn = el('button', { class: 'btn small primary', type: 'button' }, '▶ Play the night');
  const set = (m) => {
    BRZ.t = m; range.value = m; clock.textContent = brHM(m) + ' Brasília';
    const ev = BR_EVENTS.filter((e) => e.m <= m).pop();
    cap.replaceChildren(...(ev ? [el('b', { text: brHM(ev.m) + ' · ' }), ev.en] : ['Before the polls close: Polymarket prices Flávio at about 80%, and the final polls have him ahead 51 to 49.']));
    drawNight(host, m);
  };
  const stop = () => { clearInterval(BRZ.timer); BRZ.playing = false; btn.textContent = '▶ Play the night'; };
  btn.addEventListener('click', () => {
    if (BRZ.playing) return stop();
    if ((BRZ.t ?? BR_T1) >= BR_T1) BRZ.t = BR_T0;
    BRZ.playing = true; btn.textContent = '❚❚ Pause';
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { set(BR_T1); return stop(); }
    BRZ.timer = setInterval(() => { if (!host.isConnected) return stop(); const n = Math.min(BR_T1, (BRZ.t ?? BR_T0) + 2); set(n); if (n >= BR_T1) stop(); }, 90);
  });
  range.addEventListener('input', () => { stop(); set(+range.value); });
  CHARTS.push(() => set(BRZ.t ?? BR_T1));
  return el('div', { class: 'card night' }, el('h3', { text: 'Replay the night' }),
    el('p', { class: 'sub', text: 'The market and the count on one clock, from Sunday afternoon to the last TSE file. Press play, or drag the slider. Numbered lines mark the moments below the chart.' }),
    el('div', { class: 'row night-ctl' }, btn, clock, range), host, cap,
    el('ol', { class: 'night-list' }, BR_EVENTS.map((e) => el('li', null, el('b', { text: brHM(e.m) + ' ' }), e.en))));
}

/* ---------- the three reads, Hinge-style */
function readsCard() {
  const R = BR.reads, avgL = BR.polls.avgLula;
  const out = el('div'), bars = el('div', { class: 'chart' });
  const ctl = (key, label, min, max, step, fmtV, help, obj) => {
    const tgt = obj || BRZ; const o = el('output', { text: fmtV(tgt[key]) });
    const inp = el('input', { type: 'range', min, max, step, value: tgt[key] });
    inp.addEventListener('input', () => { tgt[key] = +inp.value; o.textContent = fmtV(tgt[key]); refresh(); });
    return el('div', { class: 'ctrl' }, el('label', null, label, o), inp, help ? el('span', { class: 'help', text: help }) : null);
  };
  function refresh() {
    const margin = 2 * (50 - (avgL + BRZ.shift));                       // Flávio minus Lula, valid votes
    const pPolls = brPhi(margin / BRZ.err), pHist = R.history.p, pMk = R.markets.p;
    const W = BRZ.w, ws = W.polls + W.history + W.markets || 1;
    const p = (W.polls * pPolls + W.history * pHist + W.markets * pMk) / ws;
    const actual = BR.result.lulaPct - BR.result.flavioPct;           // Lula minus Flávio
    const pBig = 1 - brPhi((actual + 2 * (50 - avgL)) / BRZ.err);      // a Lula win this big, with no shift, under the error you set
    const need = (50 - avgL);
    out.replaceChildren(
      el('div', { class: 'reads-p' }, el('span', { class: 'big', style: 'color:' + (p >= 0.5 ? FC() : LC()), text: Math.round(p * 100) + '%' }), el('span', null, 'chance of a Flávio win, blending the three reads with your weights')),
      el('div', { class: 'meter', style: 'height:10px;margin:8px 0 12px' }, el('i', { style: `width:${(p * 100).toFixed(1)}%;background:${FC()}` }), el('i', { style: `width:${(100 - p * 100).toFixed(1)}%;background:${LC()}` })),
      el('p', { class: 'sub', style: 'margin:0' }, rich(`The polls read alone gives Flávio **${Math.round(pPolls * 100)}%**. Under that error, a Lula win as big as the real one (**${brSgn(actual)}** on the margin) had about a **${pBig < 0.01 ? 'less than 1' : Math.round(pBig * 100)}%** chance. Lula only becomes the polls’ favorite if you assume they underrated him by more than **${need.toFixed(1)} points**; they underrated him by **${(BR.result.lulaPct - avgL).toFixed(1)}**.`)));
    const nar = (bars.clientWidth || 600) < 520;
    drawHBars(bars, [
      { label: nar ? 'Polls' : 'Polls (' + BR.polls.n + ' pollsters)', v: pPolls * 100, color: FC(), vl: Math.round(pPolls * 100) + '%' },
      { label: nar ? 'History' : 'History (first-round leaders)', v: pHist * 100, color: FC(), vl: Math.round(pHist * 100) + '%' },
      { label: nar ? 'Markets' : 'Markets (Sunday morning)', v: pMk * 100, color: FC(), vl: Math.round(pMk * 100) + '%' },
      { label: 'Your blend', v: p * 100, color: PAL.amber, vl: Math.round(p * 100) + '%' },
    ], { min: 0, max: 100, fmt: (v) => v + '%', r: 46 });
  }
  const pctF = (v) => Math.round(v * 100) + '%';
  const card = el('div', { class: 'grid g-main' },
    el('div', { class: 'card' }, el('h3', { text: 'The Hinge’s three reads, run on Brazil' }),
      el('p', { class: 'sub', text: 'The Hinge blends three witnesses for every race: the polls, history and the markets. Here they are for the runoff, as they stood the morning of the vote. Move the weights and the assumptions; all three leaned the same way.' }),
      out, bars),
    el('div', { class: 'card' }, el('h3', { text: 'Your assumptions' }),
      ctl('polls', 'Weight on the polls', 0, 1, 0.05, pctF, null, BRZ.w),
      ctl('history', 'Weight on history', 0, 1, 0.05, pctF, R.history.note, BRZ.w),
      ctl('markets', 'Weight on the markets', 0, 1, 0.05, pctF, R.markets.note, BRZ.w),
      ctl('err', 'Poll error (on the margin)', 1, 7, 0.1, (v) => '±' + v.toFixed(1) + ' pts', R.polls.note),
      ctl('shift', 'Assume the polls underrate Lula by', -3, 4, 0.1, (v) => brSgn(v) + ' pts', 'Positive moves the poll average toward Lula. The real miss was ' + brSgn(BR.result.lulaPct - avgL) + '.'),
      el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, el('button', { class: 'btn small', type: 'button', onclick: () => { Object.assign(BRZ, { err: 3, shift: 0, w: { polls: 1, history: 1, markets: 1 } }); rerenderView(); } }, 'Reset'),
        el('button', { class: 'btn small', type: 'button', onclick: () => { Object.assign(BRZ, { shift: +(BR.result.lulaPct - avgL).toFixed(1) }); rerenderView(); } }, 'Use the real miss'))));
  CHARTS.push(refresh);
  return card;
}

/* ---------- videos: the news channels' latest (from The Watch) plus the night's explainers */
function videoTile(v) {
  const box = el('div', { class: 'vbox' + (v.s ? ' short' : '') },
    el('img', { src: `https://i.ytimg.com/vi/${encodeURIComponent(v.v)}/hqdefault.jpg`, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }),
    el('button', { class: 'vplay', type: 'button', 'aria-label': 'Play: ' + v.t, onclick: () => { box.replaceChildren(el('iframe', { src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.v)}?autoplay=1&playsinline=1&rel=0`, title: v.t, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin' })); } }, '▶'));
  return el('div', { class: 'vtile' }, box, el('div', { class: 'vt', text: v.t }), el('div', { class: 'note', text: v.ch + (v.p ? ' · ' + new Date(v.p).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) + ' Brasília' : '') }));
}
function videosCard() {
  const grid = el('div', { class: 'vgrid' });
  const paint = () => {
    const rx = /lula|bolsonaro|fl[aá]vio|brasil|brazil|\btse\b|zanin|elei[cç]|apura|segundo turno|runoff/i;
    const live = ((BRZ.vids || {}).videos || []).filter((v) => rx.test(v.t) && Date.parse(v.p) >= Date.parse('2026-10-24T00:00:00Z'));
    const seen = new Set(), all = [];
    [...live, ...BR.videos].sort((a, b) => Date.parse(b.p) - Date.parse(a.p)).forEach((v) => { if (!seen.has(v.v)) { seen.add(v.v); all.push(v); } });
    grid.replaceChildren(...all.slice(0, 12).map(videoTile));
  };
  paint();
  if (!BRZ.vids) fetch('../news/data/media.json', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((d) => { BRZ.vids = d || { videos: [] }; paint(); }).catch(() => { BRZ.vids = { videos: [] }; });
  return el('div', { class: 'card' }, el('h3', { text: 'Explainers and coverage' }),
    el('p', { class: 'sub', text: 'From the news channels’ own YouTube uploads: the night’s coverage, the fight over the voting extension, and what comes next. New videos arrive with each edition of The Watch. They play in YouTube’s privacy-enhanced player.' }), grid);
}

/* ---------- the view */
function viewBrazil() {
  const root = el('div', { class: 'brz' });
  const r = BR.result, r1 = BR.round1, P = BR.polls, avgL = P.avgLula;
  const miss = r.lulaPct - avgL, missVotes = miss / 100 * r.valid;
  const mkMorning = BR.reads.markets.p;
  root.append(sectionHead('Runoff · Oct. 25, 2026', 'Brazil: the polls said Flávio, the markets said 80%, and Lula won',
    `Lula won a fourth term with **${brP(r.lulaPct, 2)}** of valid votes to Flávio Bolsonaro’s **${brP(r.flavioPct, 2)}**, a margin of **${brM(r.margin, 2)}** votes. Sixteen pollsters’ final polls averaged Flávio ${brP(100 - avgL)} to Lula ${brP(avgL)}, and the prediction markets gave Flávio about ${Math.round(mkMorning * 100)}% on the morning of the vote. This tab maps the gap between what was expected and what happened, with The Hinge’s tools.`));
  root.append(el('p', { class: 'note', style: 'margin:-6px 0 14px' }, `TSE file of ${new Date(r.tseFile).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} Brasília, ${String(r.pst).replace(',', '.')}% of sections counted. ${r.proclaimed ? 'The TSE has proclaimed the result.' : 'The TSE had not yet proclaimed the winner when this was built.'} `, srcLink(r.url, 'TSE file')));
  const tile = (lab, val, small, foot, color) => el('div', { class: 'tile' }, el('span', { class: 'lab', text: lab }), el('span', { class: 'val', style: color ? 'color:' + color : null }, val, small ? el('small', { text: ' ' + small }) : null), foot ? el('span', { class: 'foot', text: foot }) : null);
  root.append(el('div', { class: 'grid g4' },
    tile('The result', brP(r.lulaPct), 'Lula', `Flávio ${brP(r.flavioPct)} · ${brM(r.lula)} to ${brM(r.flavio)} votes`, LC()),
    tile('The final polls', brP(100 - avgL), 'Flávio', `Average of ${P.n} pollsters’ last polls; Lula ${brP(avgL)}`, FC()),
    tile('The miss', brSgn(miss), 'pts', `On Lula’s share; ${brSgn(2 * miss)} on the margin, about ${brM(missVotes)} votes`),
    tile('The markets', Math.round(mkMorning * 100) + '%', 'Flávio', 'Polymarket and Kalshi, the morning of the vote', FC())));

  // 1. the miss in votes
  const pollIds = [['avg', 'Average of ' + P.n], ...P.finals.slice(0, 8).map((p) => [p.pollster, p.pollster])];
  const flowHost = el('div', { class: 'chart' });
  const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Poll' }, pollIds.map(([id, lab]) => el('button', { type: 'button', 'aria-pressed': String(BRZ.pick === id), onclick: () => { BRZ.pick = id; rerenderView(); } }, lab)));
  const pick = BRZ.pick === 'avg' ? { pollster: 'The poll average', lula: avgL } : P.finals.find((p) => p.pollster === BRZ.pick) || { pollster: 'The poll average', lula: avgL };
  const pL = pick.lula / 100 * r.valid, pF = r.valid - pL, moved = r.lula - pL;
  root.append(sectionHead('', 'The miss, in votes', 'What a poll’s valid-vote shares would have meant in the runoff’s 124 million valid votes, against what the TSE counted. The band from Flávio to Lula is the miss: votes the poll put in one column that ended up in the other.'));
  root.append(el('div', { class: 'grid g-main' },
    el('div', { class: 'card' }, el('div', { class: 'row', style: 'margin-bottom:10px;flex-wrap:wrap;gap:6px' }, seg), flowHost,
      el('p', { class: 'note', text: `${pick.pollster}${pick.end ? ' (field work ended ' + fd(pick.end) + (pick.n ? ', ' + brN(pick.n) + ' interviews' : '') + ')' : ''}: Lula ${brP(pick.lula)}, Flávio ${brP(100 - pick.lula)} of valid votes. ${moved >= 0 ? brM(moved, 2) + ' votes it gave Flávio went to Lula.' : brM(-moved, 2) + ' votes it gave Lula went to Flávio.'}` })),
    el('div', { class: 'card' }, el('h3', { text: 'Each pollster’s miss' }), el('p', { class: 'sub', text: 'Lula’s actual share minus each pollster’s last poll, in points of valid votes. Only Vox Brasil had Lula ahead.' }),
      (() => { const host = el('div', { class: 'chart' }); CHARTS.push(() => drawHBars(host, P.finals.map((p) => ({ label: p.pollster, v: +(r.lulaPct - p.lula).toFixed(2), color: LC(), vl: brSgn(r.lulaPct - p.lula), tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: p.pollster + (p.sponsor ? ' / ' + p.sponsor : '') })); t.append(tipRow(brP(p.lula), 'Lula, valid votes')); t.append(tipRow(fd(p.end), 'field work ended')); } })), { min: 0, fmt: (v) => '+' + v, r: 44, rowH: 22 })); return host; })())));
  CHARTS.push(() => drawFlow(flowHost, {
    nodes: [{ id: 'pF', label: pick.pollster === 'The poll average' ? 'Polls: Flávio' : pick.pollster + ': Flávio', col: 0, color: FC(), sub: brM(pF, 2) + ' (' + brP(100 - pick.lula) + ')' },
      { id: 'pL', label: pick.pollster === 'The poll average' ? 'Polls: Lula' : pick.pollster + ': Lula', col: 0, color: LC(), sub: brM(pL, 2) + ' (' + brP(pick.lula) + ')' },
      { id: 'F', label: 'Flávio, counted', col: 1, color: FC(), sub: brM(r.flavio, 2) + ' (' + brP(r.flavioPct) + ')' },
      { id: 'L', label: 'Lula, counted', col: 1, color: LC(), sub: brM(r.lula, 2) + ' (' + brP(r.lulaPct) + ')' }],
    links: moved >= 0 ? [{ s: 'pF', t: 'F', v: r.flavio, color: FC() }, { s: 'pF', t: 'L', v: moved, color: LC(), hl: true, note: 'the miss' }, { s: 'pL', t: 'L', v: pL, color: LC() }]
      : [{ s: 'pL', t: 'L', v: r.lula, color: LC() }, { s: 'pL', t: 'F', v: -moved, color: FC(), hl: true, note: 'the miss' }, { s: 'pF', t: 'F', v: pF, color: FC() }],
  }, { heads: ['What the poll said', 'What the TSE counted'], fmt: (v) => brM(v, 2) + ' votes', aria: 'The poll versus the count, in votes' }));

  // 2. every poll, and the pendulum
  root.append(sectionHead('', 'Every runoff poll, and a pendulum', 'All ' + P.all.length + ' runoff polls the Brazil desk recorded, by the day their field work ended. Every one but Vox Brasil’s had Flávio ahead or tied; the race ended 3.6 points the other way. Alongside: the final Datafolha poll against the result in the last four runoffs and this year’s first round.'));
  root.append(el('div', { class: 'grid g-main' },
    chartCard('Lula’s share of valid votes, poll by poll', 'Each dot is a poll. The line is the average of each pollster’s latest poll over the previous week. The red line is the result.', (host) => {
      const pts = P.all.map((p) => ({ x: brUTC(p.end + 'T12:00:00Z'), y: p.lula, p }));
      const days = [...new Set(pts.map((p) => p.x))].sort((a, b) => a - b);
      const avg = days.map((d) => { const win = {}; P.all.filter((p) => { const t = brUTC(p.end + 'T12:00:00Z'); return t <= d && t > d - 7 * 864e5; }).forEach((p) => { win[p.pollster] = p; }); const v = Object.values(win); return { x: d, y: v.reduce((s, p) => s + p.lula, 0) / v.length }; });
      drawLine(host, { height: 270, series: [{ name: '7-day average of pollsters', color: PAL.ink2, pts: avg }], yMin: 44, yMax: 54, l: 40, r: 70,
        refs: [{ y: r.lulaPct, label: 'Result ' + brP(r.lulaPct), color: LC() }, { y: 50, color: PAL.axis, label: '50%', left: true }],
        dots: pts.map((d) => ({ x: d.x, y: d.y, color: d.y >= 50 ? LC() : FC(), r: 4, tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: d.p.pollster })); t.append(tipRow(brP(d.p.lula), 'Lula, valid votes')); t.append(tipRow(fd(d.p.end), 'field work ended')); } })),
        xFmt: (v) => fd(new Date(v).toISOString().slice(0, 10)), xFmtLong: (v) => fdy(new Date(v).toISOString().slice(0, 10)), yFmt: (v) => v + '%', yFmtTip: (v) => brP(v), xTicks: [10, 15, 20, 24].map((dd) => brUTC(`2026-10-${String(dd).padStart(2, '0')}T12:00:00Z`)) });
    }),
    chartCard('The pendulum', 'The result minus Datafolha’s final poll, on the margin between the PT candidate and the right’s. Below zero, the poll overrated the PT; above, it underrated it.', (host) => {
      drawVBars(host, BR.history.map((h) => { const res = h.result ?? (r.lulaPct - r.flavioPct); const v = +(res - h.poll).toFixed(2); return { label: h.race.replace(' runoff', '').replace('2026 first round', '’26 R1').replace('2026', '’26 R2'), v, color: v >= 0 ? LC() : FC(), tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: h.race + ': ' + h.left + ' v. ' + h.right })); t.append(tipRow(brSgn(h.poll), 'Datafolha’s final poll, margin')); t.append(tipRow(brSgn(res, 2), 'result, margin')); } }; }), { height: 250, fmt: (v) => brSgn(v, 0) });
    })));

  // 3. the markets
  root.append(sectionHead('', 'How the markets got it so wrong', 'The crowd was more sure than the pollsters. A two-point poll lead, a rule that the first-round leader always wins, and fresh memories of polls underrating the Bolsonaros all pointed at Flávio, and traders priced them together. Then the price fell before a single meaningful vote was counted, and turned for good while Flávio still led the count.'));
  root.append(el('div', { class: 'grid g-main' },
    chartCard('The price of a Flávio win', 'Polymarket (line) and Kalshi (dots), from the Brazil desk’s reads and prices published during the night.', (host) => {
      const s = BR.markets.series.filter((p) => brUTC(p.t) >= brUTC('2026-10-24T00:00:00Z'));
      const poly = s.filter((p) => p.venue === 'Polymarket').map((p) => ({ x: brUTC(p.t), y: p.flavio * 100 }));
      const kal = s.filter((p) => p.kalshi != null || p.venue === 'Kalshi').map((p) => ({ x: brUTC(p.t), y: (p.venue === 'Kalshi' ? p.flavio : p.kalshi) * 100 }));
      const close = brUTC('2026-10-25T20:00:00Z');
      drawLine(host, { height: 270, series: [{ name: 'Polymarket', color: FC(), pts: poly }], yMin: 0, yMax: 100, l: 40, r: 16,
        dots: kal.map((k) => ({ x: k.x, y: k.y, color: PAL.amber, r: 3.5 })), refs: [{ y: 50, color: PAL.axis, label: '50%', left: true }],
        vrefs: [{ x: close, label: 'Polls close', color: PAL.ink2 }],
        xFmt: (v) => new Date(v).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric' }), xFmtLong: (v) => new Date(v).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', minute: '2-digit' }) + ' Brasília',
        yFmt: (v) => v + '%', yFmtTip: (v) => v.toFixed(1) + '%', xTicks: ['2026-10-24T15:00:00Z', '2026-10-25T03:00:00Z', '2026-10-25T15:00:00Z', '2026-10-26T00:00:00Z'].map(brUTC) });
      host.prepend(legend([{ color: FC(), label: 'Polymarket', line: true }, { color: PAL.amber, label: 'Kalshi', cls: 'dot' }]));
    }),
    el('div', { class: 'card' }, el('h3', { text: 'What moved the price' }), BR.markets.notes.map((n) => el('div', { class: 'evid nov' }, el('span', { class: 'ec', text: n.en }), el('span', { class: 'es' }, srcLink(n.src)))),
      BR.markets.volume ? el('p', { class: 'note', style: 'margin-top:8px', text: `Polymarket’s Brazil election market traded about $${Math.round(BR.markets.volume / 1e6)} million in all (as read by the Brazil desk). Cumulative volume is turnover, not money at stake at any one price.` }) : null)));
  root.append(readsCard());

  // 4. where it was won
  const regs = BR.regions.filter((g) => g.id !== 'ZZ').concat(BR.regions.filter((g) => g.id === 'ZZ'));
  const gainL = regs.reduce((s, g) => s + g.lula - g.lula1, 0), gainF = regs.reduce((s, g) => s + g.flavio - g.flavio1, 0);
  root.append(sectionHead('', 'Where the comeback came from', `Flávio led the first round by ${brM(r1.flavio - r1.lula, 2)} votes. Between the rounds Lula added ${brM(gainL, 2)} votes and Flávio ${brM(gainF, 2)}. The Southeast, not just the Northeast, did most of it: São Paulo, Minas Gerais and Rio gave Lula his biggest gain.`));
  const regFlow = el('div', { class: 'chart' });
  CHARTS.push(() => drawFlow(regFlow, {
    nodes: [...regs.map((g) => ({ id: g.id, label: g.name, col: 0, color: PAL.ink2, sub: '+' + brM(g.lula - g.lula1 + g.flavio - g.flavio1, 2) })),
      { id: 'L', label: 'Lula gained', col: 1, color: LC(), sub: '+' + brM(gainL, 2) }, { id: 'F', label: 'Flávio gained', col: 1, color: FC(), sub: '+' + brM(gainF, 2) }],
    links: regs.flatMap((g) => [{ s: g.id, t: 'L', v: g.lula - g.lula1, color: LC(), note: 'more votes for Lula than in round 1' }, { s: g.id, t: 'F', v: g.flavio - g.flavio1, color: FC(), note: 'more votes for Flávio than in round 1' }]),
  }, { heads: ['Region', 'Gained since round 1'], fmt: (v) => '+' + brM(v, 2), aria: 'Votes gained between the rounds, by region' }));
  root.append(el('div', { class: 'grid g-main' },
    el('div', { class: 'card' }, el('h3', { text: 'New votes between the rounds, by region' }), el('p', { class: 'sub', text: 'Each candidate’s runoff votes minus his first-round votes. They came from the other candidates’ 9.3 million voters, from people who voted blank or null in the first round, and from about 3 million more people voting.' }), regFlow),
    el('div', { class: 'card' }, el('h3', { text: 'The final margin, by region' }), el('p', { class: 'sub', text: 'Lula’s votes minus Flávio’s in the runoff. The Northeast’s 13.7 million outweighed everywhere else combined.' }),
      (() => { const host = el('div', { class: 'chart' }); CHARTS.push(() => drawHBars(host, regs.map((g) => { const d = g.lula - g.flavio; return { label: g.name, v: Math.abs(d) / 1e6, color: d >= 0 ? LC() : FC(), vl: (d >= 0 ? 'Lula +' : 'Flávio +') + (Math.abs(d) >= 1e5 ? brM(Math.abs(d), 2) : brN(Math.abs(d))) }; }), { min: 0, fmt: (v) => v + 'M', r: 104, rowH: 30, nTicks: 3 })); return host; })())));
  root.append(el('div', { class: 'grid g2', style: 'margin-top:18px' },
    chartCard('Every state moved toward Lula', 'Lula’s share of the two-candidate vote in the first round (open circle) and the runoff (filled), by state.', (host) => {
      const st = BR.states.filter((s) => s.uf !== 'ZZ').slice().sort((a, b) => b.r2Lula - a.r2Lula);
      drawDumbbell(host, st.map((s) => ({ label: s.name, a: s.r1Lula, b: s.r2Lula, bColor: s.r2Lula >= 50 ? LC() : FC(), tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: s.name })); t.append(tipRow(brP(s.r1Lula), 'Lula, round 1 (two-way)')); t.append(tipRow(brP(s.r2Lula), 'Lula, runoff', LC())); if (s.y22Lula != null) t.append(tipRow(brP(s.y22Lula), 'Lula, 2022 runoff')); } })), { min: 20, max: 80, zero: 50, fmt: (v) => v + '%', rowH: 19 });
    }),
    chartCard('More people voted almost everywhere', 'How much abstention fell between the rounds, in points of the electorate. Amber: more people voted in the runoff; gray: fewer did.', (host) => {
      const st = BR.states.filter((s) => s.uf !== 'ZZ').map((s) => ({ s, v: +(s.abst1 - s.abst2).toFixed(2) })).sort((a, b) => b.v - a.v);
      drawHBars(host, st.map(({ s, v }) => ({ label: s.name, v: Math.abs(v), color: v >= 0 ? PAL.amber : PAL.muted, vl: Math.abs(v) < 0.05 ? '0.0' : v >= 0 ? '+' + v.toFixed(1) + ' turnout' : '−' + Math.abs(v).toFixed(1) + ' turnout', tip: (t) => { t.append(el('div', { style: 'font-weight:700', text: s.name })); t.append(tipRow(brP(s.abst1), 'abstention, round 1')); t.append(tipRow(brP(s.abst2), 'abstention, runoff')); t.append(tipRow(brN(s.a1 - s.a2), s.a1 >= s.a2 ? 'more voters' : 'fewer voters')); } })), { min: 0, fmt: (v) => v.toFixed(0), r: 92, rowH: 19 });
    })));

  // 5. where the first round's voters went
  const FL = BR.flow, fcol = [FC(), LC(), PAL.amber, PAL.muted, PAL.axis], dcol = [FC(), LC(), PAL.muted, PAL.axis];
  root.append(sectionHead('', 'Where the first round’s voters went', `An estimate from how the ${FL.units} units moved: a fit of each state’s runoff on its first round, scaled to the national totals. It can’t see individual voters, so read it as rough; the ranges come from refitting with one state left out at a time.`));
  const eiHost = el('div', { class: 'chart' });
  CHARTS.push(() => drawFlow(eiHost, {
    nodes: [...FL.src.map((lab, i) => ({ id: 's' + i, label: lab, col: 0, color: fcol[i], sub: brM(FL.votes[i].reduce((a, b) => a + b, 0), 1) })), ...FL.dst.map((lab, j) => ({ id: 'd' + j, label: lab, col: 1, color: dcol[j], sub: brM(FL.votes.reduce((a, row) => a + row[j], 0), 1) }))],
    links: FL.votes.flatMap((row, i) => row.map((v, j) => ({ s: 's' + i, t: 'd' + j, v, color: dcol[j], hl: (i === 2 || i === 3 || i === 4) && j < 2, note: Math.round(FL.share[i][j] * 100) + '% of this group', range: `Range with one state left out: ${Math.round(FL.lo[i][j] * 100)}% to ${Math.round(FL.hi[i][j] * 100)}%` })).filter((l) => l.v >= 50000)),
  }, { heads: ['First round', 'Runoff'], fmt: (v) => brM(v, 2), height: 470, aria: 'Estimated flows from the first round to the runoff' }));
  const sh = (i, j) => Math.round(FL.share[i][j] * 100) + '% (' + Math.round(FL.lo[i][j] * 100) + '–' + Math.round(FL.hi[i][j] * 100) + ')';
  root.append(el('div', { class: 'grid g-main' }, el('div', { class: 'card' }, eiHost),
    el('div', { class: 'card' }, el('h3', { text: 'The splits' }), el('p', { class: 'sub', text: 'Share of each first-round group that went each way in the runoff, with the leave-one-out range.' }),
      el('div', { class: 'tbl-wrap' }, el('table', { class: 't', style: 'min-width:0' }, el('thead', null, el('tr', null, ['First round', 'to Flávio', 'to Lula'].map((h, i) => el('th', { class: i ? 'n' : '', text: h })))),
        el('tbody', null, [2, 3, 4].map((i) => el('tr', null, el('td', { text: FL.src[i] }), el('td', { class: 'n', text: sh(i, 0) }), el('td', { class: 'n', text: sh(i, 1) })))))),
      el('p', { class: 'note', style: 'margin-top:8px', text: 'A 0% means the state-level pattern shows no measurable flow that way, not that nobody moved that way.' }),
      el('p', { class: 'note', style: 'margin-top:4px', text: 'A survey for comparison: Quaest found that among first-round absentees and blank or null voters, 40% planned to vote for Lula and 36% for Flávio (Oct. 17–20).' }))));

  // 6. the night
  root.append(sectionHead('', 'The night, minute by minute', 'The count started at 5 p.m. Brasília time, stopped for an hour and a half for the voting extension, and changed leaders twice. The markets moved first.'));
  root.append(nightCard());

  // 7. why, the extension, the videos
  root.append(sectionHead('', 'Why it happened', 'What the pollsters, the press and the numbers say so far. The institutes have not yet published reviews of their own.'));
  root.append(el('div', { class: 'grid g2' }, BR.why.map((w) => el('div', { class: 'card' }, el('h3', { text: w.title }), el('p', { class: 'sub', style: 'margin-bottom:6px' }, w.en), el('div', { class: 'note' }, w.src.map((u) => srcLink(u)).reduce((a, n, i) => (i ? a.concat([' · ', n]) : [n]), []))))));
  root.append(sectionHead('', 'The voting extension', 'What happened, on the record. Whether it changed any votes is not known: no count of ballots cast after 5 p.m. has been published.'));
  root.append(el('div', { class: 'card' }, BR.extension.facts.map((f) => el('div', { class: 'evid nov' }, el('span', { class: 'ec', text: f.en }), el('span', { class: 'es' }, srcLink(f.src))))));
  root.append(sectionHead('', 'Watch', ''));
  root.append(videosCard());

  // 8. sources and method
  root.append(sectionHead('', 'Sources and method', 'Every number on this tab comes from the TSE’s result files, the Brazil desk’s records of the polls and the markets, or the reporting listed here.'));
  root.append(el('div', { class: 'grid g2' },
    el('div', { class: 'card' }, el('h3', { text: 'Method' }), el('ul', { class: 'brz-ul' },
      el('li', null, 'Results: the TSE’s unified result files for both rounds, per state and abroad, pulled from GitHub’s servers (the TSE does not answer every network).'),
      el('li', null, P.method),
      el('li', null, 'Votes in “the miss”: a poll’s valid-vote shares times the runoff’s valid votes. Polls measure intentions, not votes; this shows the size of the gap, not where it came from.'),
      el('li', null, 'Where the voters went: a weighted least-squares fit of each unit’s runoff (Flávio, Lula, blank or null, didn’t vote, as shares of the electorate) on its first round (Flávio, Lula, the others, blank or null, didn’t vote), each group’s split between 0 and 1 and summing to 1, then scaled to the national totals. Ecological estimates can be wrong about individuals; treat the numbers as rough.'),
      el('li', null, 'The three reads: the polls as a normal distribution around the average margin; history as the first-round leader’s record in runoffs; the markets as their price. The blend is a weighted average of the three chances.'))),
    el('div', { class: 'card' }, el('h3', { text: 'Sources' }), el('ol', { class: 'brz-ol' }, BR.sources.map((s) => el('li', null, el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.title }), el('span', { class: 'note', text: ' ' + s.outlet })))))));
  return root;
}
