(() => {
'use strict';
const D = DATA, E = ENGINE;
const REGIONS = ['Midwest', 'South', 'Northeast', 'West', 'Plains'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* =========================================================== storage */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('hinge26b.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('hinge26b.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  del(k) { try { localStorage.removeItem('hinge26b.' + k); } catch (e) { } },
};

/* =========================================================== settings */
const DEFAULTS = {
  lens: D.defaultLens, customState: 0, customGB: 0, sigmaNat: 3.0, sigmaReg: 1.5, tau: 14, partAdj: 3, rvAdj: 0,
  fundWeight: 0.3, stateBiasOn: 1, envShift: 0, nSims: 10000, houseRatingsW: 0.5, houseInc: 3, sigmaDist: 5,
  leanCoef: 0.8, sigmaF: 11, driftRate: 0.58, houseNatScale: 1, useDistrictPolls: 1, seed: 20261103,
  // v2: the blend of three witnesses, the information-age stress setting, and history what-ifs (null = today's value)
  wPolls: 0.5, wMarkets: 0.3, wFund: 0.2, tailDf: 0, fApproval: null, fIncome: null, fWar: null, fInflation: null,
};
let S = Object.assign({}, DEFAULTS, LS.get('settings', {}));
if (!D.lenses[S.lens]) S.lens = D.defaultLens;
let userPolls = LS.get('userPolls', []);
let excluded = new Set(LS.get('excluded', []));
let calls = LS.get('calls', {});
let history = LS.get('history', {});
const saveAll = () => { LS.set('settings', S); LS.set('userPolls', userPolls); LS.set('excluded', [...excluded]); LS.set('calls', calls); LS.set('history', history); };

/* =========================================================== tiny DOM helpers */
const $ = (s, r = document) => r.querySelector(s);
function el(tag, props, ...kids) {
  const n = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(3)) { if (c == null || c === false) continue; n.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return n;
}
const NS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, ...kids) {
  const n = document.createElementNS(NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  for (const c of kids.flat(3)) if (c != null) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
}
// **bold** markers → <b>, everything else as text (safe for data strings)
function rich(text) {
  const out = [];
  String(text || '').split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
    if (part.startsWith('**') && part.endsWith('**')) out.push(el('b', null, part.slice(2, -2)));
    else if (part) out.push(document.createTextNode(part));
  });
  return out;
}
const link = (url, label) => url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, label || 'source') : null;
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2200); }

/* =========================================================== formatting */
const fm = (m, dl = 'D') => (m == null || isNaN(m)) ? '—' : Math.abs(m) < 0.05 ? 'Even' : (m > 0 ? dl : 'R') + '+' + Math.abs(m).toFixed(1);
const fp = (p) => p == null || isNaN(p) ? '—' : p >= 0.995 ? '>99%' : p <= 0.005 ? '<1%' : Math.round(p * 100) + '%';
const fd = (iso) => { if (!iso) return '—'; const [, m, d] = iso.split('-').map(Number); return MONTHS[m - 1] + ' ' + d; };
const fdy = (iso) => { if (!iso) return '—'; const [y, m, d] = iso.split('-').map(Number); return MONTHS[m - 1] + ' ' + d + ', ' + y; };
const sideOf = (m) => (m > 0.05 ? 'D' : m < -0.05 ? 'R' : 'E');
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const clampISO = (x, a, b) => (x < a ? a : x > b ? b : x);

/* =========================================================== colour */
function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const delin = (c) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, v)) * 255); };
function toOklab(hex) {
  const [r, g, b] = hex2rgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromOklab([L, a, b]) {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return 'rgb(' + delin(r) + ',' + delin(g) + ',' + delin(bb) + ')';
}
let PAL = {};
function readPalette() {
  PAL = { dem: css('--dem'), rep: css('--rep'), ind: css('--ind'), dd: css('--div-d'), mid: css('--div-mid'), dr: css('--div-r'), ink: css('--ink'), ink2: css('--ink-2'), muted: css('--muted'), grid: css('--grid'), axis: css('--axis'), surface: css('--surface'), amber: css('--amber-2'), accent: css('--accent'), rule: css('--rule') };
  PAL._d = toOklab(PAL.dd); PAL._m = toOklab(PAL.mid); PAL._r = toOklab(PAL.dr);
}
function divColor(m, cap = 15) {
  const x = Math.max(-1, Math.min(1, m / cap));
  const a = PAL._m, b = x >= 0 ? PAL._d : PAL._r, t = Math.pow(Math.abs(x), 0.85);
  return fromOklab([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}
const sideColor = (side, race) => side === 'D' ? (race && race.dSideInd ? PAL.ind : PAL.dem) : side === 'R' ? PAL.rep : PAL.amber;

/* =========================================================== tooltip */
const tipEl = $('#tip');
function tipShow(ev, build) { tipEl.replaceChildren(); build(tipEl); tipEl.classList.add('on'); tipMove(ev); }
function tipMove(ev) {
  const pad = 14; const r = tipEl.getBoundingClientRect();
  let x = (ev.clientX || 0) + pad, y = (ev.clientY || 0) + pad;
  if (x + r.width > innerWidth - 8) x = (ev.clientX || 0) - r.width - pad;
  if (y + r.height > innerHeight - 8) y = (ev.clientY || 0) - r.height - pad;
  tipEl.style.left = Math.max(6, x) + 'px'; tipEl.style.top = Math.max(6, y) + 'px';
}
const tipHide = () => tipEl.classList.remove('on');
const tipRow = (value, label, color) => el('div', { class: 'tr' }, color ? el('i', { style: 'background:' + color }) : null, el('span', { class: 'tv', text: value }), el('span', { class: 'tk', text: label }));
function hoverable(node, build) {
  node.style.cursor = node.style.cursor || 'default';
  node.addEventListener('pointerenter', (e) => tipShow(e, build));
  node.addEventListener('pointermove', tipMove);
  node.addEventListener('pointerleave', tipHide);
  node.setAttribute('tabindex', '0');
  node.addEventListener('focus', () => { const b = node.getBoundingClientRect(); tipShow({ clientX: b.right, clientY: b.top }, build); });
  node.addEventListener('blur', tipHide);
}

/* =========================================================== chart primitives */
function scale(d0, d1, r0, r1) { const k = (r1 - r0) / ((d1 - d0) || 1); const f = (v) => r0 + (v - d0) * k; f.inv = (p) => d0 + (p - r0) / k; f.d = [d0, d1]; return f; }
function ticks(min, max, n = 5) {
  const span = Math.abs(max - min) || 1; const s0 = Math.pow(10, Math.floor(Math.log10(span / n))); const e = span / n / s0;
  const step = e >= 7.5 ? s0 * 10 : e >= 3.5 ? s0 * 5 : e >= 1.5 ? s0 * 2 : s0; const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
function frame(host, height, m) {
  const w = Math.max(280, Math.floor(host.clientWidth || host.parentElement?.clientWidth || 640));
  const svg = sv('svg', { width: w, height, viewBox: `0 0 ${w} ${height}` });
  host.replaceChildren(svg);
  return { svg, w, h: height, m, iw: w - m.l - m.r, ih: height - m.t - m.b };
}
const hline = (g, x1, x2, y, stroke, w = 1) => g.append(sv('line', { x1, x2, y1: y, y2: y, stroke, 'stroke-width': w }));
const vline = (g, x, y1, y2, stroke, w = 1) => g.append(sv('line', { x1: x, x2: x, y1, y2, stroke, 'stroke-width': w }));
const txt = (g, x, y, s, a = {}) => g.append(sv('text', Object.assign({ x, y }, a), s));
// column path with a 4px rounded data-end, square at the baseline
function colPath(x, y0, w, y1) {
  const up = y1 < y0, h = Math.abs(y1 - y0), r = Math.min(4, w / 2, h);
  if (h < 0.5) return '';
  if (up) return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}
function barPathH(x0, y, x1, h) { // horizontal bar from x0 to x1, rounded at the data end
  const right = x1 > x0, w = Math.abs(x1 - x0), r = Math.min(4, h / 2, w);
  if (w < 0.5) return '';
  if (right) return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`;
  return `M${x0},${y}H${x1 + r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 + r},${y + h}H${x0}Z`;
}

/* --- seat histogram */
function drawHist(host, o) {
  const F = frame(host, o.height || 230, { t: 24, r: 12, b: 34, l: 40 });
  const keys = Object.keys(o.hist).map(Number).filter((k) => k >= o.lo && k <= o.hi).sort((a, b) => a - b);
  const maxP = Math.max(0.02, ...keys.map((k) => o.hist[k]));
  const x = scale(o.lo - 0.5, o.hi + 0.5, F.m.l, F.m.l + F.iw), y = scale(0, maxP * 1.08, F.m.t + F.ih, F.m.t);
  const g = sv('g'); F.svg.append(g);
  ticks(0, maxP * 1.08, 4).forEach((t) => { hline(g, F.m.l, F.m.l + F.iw, y(t), PAL.grid); txt(g, F.m.l - 6, y(t) + 3, Math.round(t * 100) + '%', { 'text-anchor': 'end' }); });
  const bw = Math.max(2, Math.min(24, (F.iw / keys.length) - 2));
  keys.forEach((k) => {
    const p = o.hist[k]; if (p <= 0) return;
    const cx = x(k), side = o.side(k);
    const path = sv('path', { d: colPath(cx - bw / 2, y(0), bw, y(p)), fill: side === 'D' ? PAL.dem : side === 'R' ? PAL.rep : PAL.amber });
    g.append(path);
    const hit = sv('rect', { x: cx - (bw / 2) - 1, y: F.m.t, width: bw + 2, height: F.ih, fill: 'transparent' });
    g.append(hit);
    hoverable(hit, (t) => { t.append(tipRow(fp(p), o.label(k))); });
  });
  hline(g, F.m.l, F.m.l + F.iw, y(0), PAL.axis);
  const step = keys.length > 40 ? 10 : keys.length > 20 ? 5 : 2;
  keys.filter((k) => k % step === 0).forEach((k) => txt(g, x(k), F.h - 16, k, { 'text-anchor': 'middle' }));
  if (o.xLabel) txt(g, F.m.l + F.iw / 2, F.h - 2, o.xLabel, { 'text-anchor': 'middle', class: 'lbl' });
  if (o.line != null) {
    const lx = x(o.line - 0.5);
    vline(g, lx, F.m.t - 8, y(0), PAL.ink2, 1);
    txt(g, lx + 4, F.m.t - 10, o.lineLabel || '', { class: 'lbl' });
  }
}

/* --- margin ladder (median dot + 80% interval) */
function drawLadder(host, rows, o = {}) {
  const rh = 34, F = frame(host, rows.length * rh + 44, { t: 26, r: 64, b: 18, l: Math.min(150, Math.max(110, (host.clientWidth || 600) * 0.24)) });
  const cap = o.cap || 25;
  const x = scale(-cap, cap, F.m.l, F.m.l + F.iw);
  const g = sv('g'); F.svg.append(g);
  ticks(-cap, cap, 6).forEach((t) => { vline(g, x(t), F.m.t - 4, F.h - F.m.b, t === 0 ? PAL.axis : PAL.grid, t === 0 ? 1.4 : 1); txt(g, x(t), F.m.t - 10, t === 0 ? 'Even' : (t > 0 ? 'D+' : 'R+') + Math.abs(t), { 'text-anchor': 'middle' }); });
  txt(g, F.m.l + F.iw + 8, F.m.t - 10, o.pLabel || 'Win %', { class: 'lbl' });
  rows.forEach((r, i) => {
    const cy = F.m.t + i * rh + rh / 2;
    const rowG = sv('g', { class: 'ladder-row' }); g.append(rowG);
    if (i % 2 === 0) rowG.append(sv('rect', { x: 0, y: cy - rh / 2, width: F.w, height: rh, fill: PAL.grid, opacity: 0.35 }));
    const c = (v) => x(Math.max(-cap, Math.min(cap, v)));
    const col = sideColor(sideOf(r.med), r.race);
    rowG.append(sv('rect', { x: Math.min(c(r.lo), c(r.hi)), y: cy - 4, width: Math.max(2, Math.abs(c(r.hi) - c(r.lo))), height: 8, rx: 4, fill: col, opacity: 0.28 }));
    rowG.append(sv('circle', { cx: c(r.med), cy, r: 6, fill: col, stroke: PAL.surface, 'stroke-width': 2 }));
    txt(rowG, 8, cy - 1, r.label, { class: 'lbl-strong' });
    if (r.sub) txt(rowG, 8, cy + 12, r.sub, { 'font-size': '10px' });
    const pw = r.pD >= 0.5 ? r.pD : 1 - r.pD; const ps = r.pD >= 0.5 ? (r.race && r.race.dSideInd ? 'I' : 'D') : 'R';
    txt(rowG, F.m.l + F.iw + 8, cy + 4, ps + ' ' + fp(pw), { class: 'lbl-strong' });
    const hit = sv('rect', { x: 0, y: cy - rh / 2, width: F.w, height: rh, fill: 'transparent', style: o.onClick ? 'cursor:pointer' : '' });
    rowG.append(hit);
    hoverable(hit, (t) => {
      t.append(el('div', { style: 'font-weight:700;margin-bottom:2px', text: r.title || r.label }));
      t.append(tipRow(fm(r.med, r.dl), 'median margin', col));
      t.append(tipRow(fm(r.lo, r.dl) + ' to ' + fm(r.hi, r.dl), '80% range'));
      t.append(tipRow(fp(r.pD), (r.dl || 'D') + ' win chance', r.race && r.race.dSideInd ? PAL.ind : PAL.dem));
      if (o.onClick) t.append(el('div', { class: 'tk', style: 'margin-top:4px', text: 'Click for detail' }));
    });
    if (o.onClick) hit.addEventListener('click', () => { tipHide(); o.onClick(r); });
  });
}

/* --- line chart with optional band, markers, crosshair */
function drawLine(host, o) {
  const F = frame(host, o.height || 260, { t: 18, r: o.r || 16, b: 34, l: o.l || 44 });
  const xs = o.series.flatMap((s) => s.pts.map((p) => p.x)).concat((o.band || []).map((p) => p.x)).concat(o.dots ? o.dots.map((d) => d.x) : []);
  const ys = o.series.flatMap((s) => s.pts.map((p) => p.y)).concat((o.band || []).flatMap((p) => [p.lo, p.hi])).concat(o.dots ? o.dots.map((d) => d.y) : []).concat(o.refs ? o.refs.map((r) => r.y) : []);
  const x0 = o.xMin ?? Math.min(...xs), x1 = o.xMax ?? Math.max(...xs);
  let y0 = o.yMin ?? Math.min(...ys), y1 = o.yMax ?? Math.max(...ys);
  if (o.yPad !== 0 && o.yMin == null) { const p = (y1 - y0) * 0.08 || 1; y0 -= p; y1 += p; }
  const x = scale(x0, x1, F.m.l, F.m.l + F.iw), y = scale(y0, y1, F.m.t + F.ih, F.m.t);
  const g = sv('g'); F.svg.append(g);
  ticks(y0, y1, o.yTicks || 5).forEach((t) => { hline(g, F.m.l, F.m.l + F.iw, y(t), PAL.grid); txt(g, F.m.l - 6, y(t) + 3, o.yFmt ? o.yFmt(t) : t, { 'text-anchor': 'end' }); });
  (o.xTicks || ticks(x0, x1, 6)).forEach((t) => txt(g, x(t), F.h - 16, o.xFmt ? o.xFmt(t) : t, { 'text-anchor': 'middle' }));
  hline(g, F.m.l, F.m.l + F.iw, F.m.t + F.ih, PAL.axis);
  if (o.xLabel) txt(g, F.m.l + F.iw / 2, F.h - 1, o.xLabel, { 'text-anchor': 'middle', class: 'lbl' });
  (o.refs || []).forEach((r) => { if (r.y < y0 || r.y > y1) return; hline(g, F.m.l, F.m.l + F.iw, y(r.y), r.color || PAL.ink2, 1); if (r.label) txt(g, r.left ? F.m.l + 4 : F.m.l + F.iw - 4, y(r.y) - 5, r.label, { 'text-anchor': r.left ? 'start' : 'end', class: 'lbl' }); });
  (o.vrefs || []).forEach((r) => { if (r.x < x0 || r.x > x1) return; vline(g, x(r.x), F.m.t, F.m.t + F.ih, r.color || PAL.ink2, 1); if (r.label) txt(g, x(r.x) + 4, F.m.t + 10, r.label, { class: 'lbl' }); });
  if (o.band && o.band.length) {
    const top = o.band.map((p, i) => (i ? 'L' : 'M') + x(p.x) + ',' + y(p.hi)).join('');
    const bot = o.band.slice().reverse().map((p) => 'L' + x(p.x) + ',' + y(p.lo)).join('');
    g.append(sv('path', { d: top + bot + 'Z', fill: o.bandColor || PAL.amber, opacity: 0.14 }));
  }
  if (o.crosshair !== false && o.series.length) {
    const cross = sv('line', { y1: F.m.t, y2: F.m.t + F.ih, stroke: PAL.ink2, 'stroke-width': 1, opacity: 0 }); g.append(cross);
    const ov = sv('rect', { x: F.m.l, y: F.m.t, width: F.iw, height: F.ih, fill: 'transparent' }); g.append(ov);
    const allX = [...new Set(o.series.flatMap((s) => s.pts.map((p) => p.x)))].sort((a, b) => a - b);
    const near = (vx) => allX.reduce((b, v) => (Math.abs(v - vx) < Math.abs(b - vx) ? v : b), allX[0]);
    ov.addEventListener('pointermove', (ev) => {
      const r = F.svg.getBoundingClientRect(); const px = (ev.clientX - r.left) * (F.w / r.width); const vx = near(x.inv(px));
      cross.setAttribute('x1', x(vx)); cross.setAttribute('x2', x(vx)); cross.setAttribute('opacity', 0.5);
      tipShow(ev, (t) => {
        t.append(el('div', { style: 'font-weight:700;margin-bottom:2px', text: o.xFmtLong ? o.xFmtLong(vx) : (o.xFmt ? o.xFmt(vx) : vx) }));
        o.series.forEach((s) => { const p = s.pts.find((q) => q.x === vx); if (p) t.append(tipRow(o.yFmtTip ? o.yFmtTip(p.y, s) : (o.yFmt ? o.yFmt(p.y) : p.y.toFixed(1)), s.name, s.color)); });
        if (o.band) { const b = o.band.find((q) => q.x === vx); if (b) t.append(tipRow((o.yFmtTip ? o.yFmtTip(b.lo) : b.lo.toFixed(0)) + ' – ' + (o.yFmtTip ? o.yFmtTip(b.hi) : b.hi.toFixed(0)), o.bandName || '80% range')); }
      });
    });
    ov.addEventListener('pointerleave', () => { cross.setAttribute('opacity', 0); tipHide(); });
  }
  o.series.forEach((s) => {
    if (!s.pts.length) return;
    const d = s.pts.map((p, i) => (i ? 'L' : 'M') + x(p.x).toFixed(1) + ',' + y(p.y).toFixed(1)).join('');
    g.append(sv('path', { d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': s.dash || null, 'pointer-events': 'none' }));
    if (s.endLabel) { const last = s.pts[s.pts.length - 1]; g.append(sv('circle', { cx: x(last.x), cy: y(last.y), r: 4, fill: s.color, stroke: PAL.surface, 'stroke-width': 2, 'pointer-events': 'none' })); txt(g, x(last.x) + 7, y(last.y) + 4, s.endLabel, { class: 'lbl-strong' }); }
  });
  (o.dots || []).forEach((d) => {
    const c = sv('circle', { cx: x(d.x), cy: y(d.y), r: d.r || 4, fill: d.color || PAL.muted, stroke: PAL.surface, 'stroke-width': 1.5, opacity: d.opacity ?? 0.85 });
    g.append(c);
    if (d.tip) { const hit = sv('circle', { cx: x(d.x), cy: y(d.y), r: 11, fill: 'transparent' }); g.append(hit); hoverable(hit, d.tip); }
  });
  (o.markers || []).forEach((mk) => {
    g.append(sv('circle', { cx: x(mk.x), cy: y(mk.y), r: 5, fill: mk.color || PAL.ink, stroke: PAL.surface, 'stroke-width': 2, 'pointer-events': 'none' }));
    if (mk.label) txt(g, x(mk.x) + (mk.dx ?? 8), y(mk.y) + (mk.dy ?? -8), mk.label, { class: 'lbl-strong', 'text-anchor': mk.anchor || 'start' });
  });
  return { x, y, F, g };
}

/* --- horizontal bars */
function drawHBars(host, rows, o = {}) {
  const rh = o.rowH || 26, F = frame(host, rows.length * rh + 26, { t: 8, r: o.r ?? 56, b: 18, l: o.l || Math.min(210, Math.max(120, (host.clientWidth || 600) * 0.34)) });
  const vals = rows.map((r) => r.v);
  const lo = Math.min(0, o.min ?? Math.min(...vals)), hi = Math.max(0, o.max ?? Math.max(...vals));
  const x = scale(lo, hi, F.m.l, F.m.l + F.iw);
  const g = sv('g'); F.svg.append(g);
  ticks(lo, hi, o.nTicks || 4).forEach((t) => { vline(g, x(t), F.m.t, F.h - F.m.b, t === 0 ? PAL.axis : PAL.grid); txt(g, x(t), F.h - 4, o.fmt ? o.fmt(t) : t, { 'text-anchor': 'middle' }); });
  rows.forEach((r, i) => {
    const y0 = F.m.t + i * rh + (rh - Math.min(16, rh - 8)) / 2, bh = Math.min(16, rh - 8);
    g.append(sv('path', { d: barPathH(x(0), y0, x(r.v), bh), fill: r.color || PAL.dem }));
    txt(g, F.m.l - 8, y0 + bh / 2 + 4, r.label, { 'text-anchor': 'end', class: 'lbl' });
    const vx = r.v >= 0 ? x(r.v) + 6 : x(r.v) - 6;
    txt(g, vx, y0 + bh / 2 + 4, r.vl ?? (o.fmt ? o.fmt(r.v) : r.v), { 'text-anchor': r.v >= 0 ? 'start' : 'end', class: 'lbl-strong' });
    const hit = sv('rect', { x: 0, y: F.m.t + i * rh, width: F.w, height: rh, fill: 'transparent' }); g.append(hit);
    if (r.tip) hoverable(hit, r.tip);
  });
}

/* --- vertical diverging bars (e.g. polling bias by cycle) */
function drawVBars(host, rows, o = {}) {
  const F = frame(host, o.height || 220, { t: 16, r: 10, b: 30, l: 40 });
  const vals = rows.map((r) => r.v);
  const lo = Math.min(0, ...vals, o.min ?? 0), hi = Math.max(0, ...vals, o.max ?? 0);
  const x = scale(-0.5, rows.length - 0.5, F.m.l, F.m.l + F.iw), y = scale(lo * 1.1, hi * 1.1, F.m.t + F.ih, F.m.t);
  const g = sv('g'); F.svg.append(g);
  ticks(lo * 1.1, hi * 1.1, 5).forEach((t) => { hline(g, F.m.l, F.m.l + F.iw, y(t), t === 0 ? PAL.axis : PAL.grid); txt(g, F.m.l - 6, y(t) + 3, o.fmt ? o.fmt(t) : t, { 'text-anchor': 'end' }); });
  const bw = Math.max(4, Math.min(24, F.iw / rows.length - 4));
  rows.forEach((r, i) => {
    const cx = x(i);
    g.append(sv('path', { d: colPath(cx - bw / 2, y(0), bw, y(r.v)), fill: r.color || (r.v >= 0 ? PAL.dem : PAL.rep), opacity: r.dim ? 0.45 : 1 }));
    txt(g, cx, F.h - 14, r.label, { 'text-anchor': 'middle' });
    const hit = sv('rect', { x: cx - bw / 2 - 3, y: F.m.t, width: bw + 6, height: F.ih, fill: 'transparent' }); g.append(hit);
    if (r.tip) hoverable(hit, r.tip);
  });
}

/* --- dumbbell: two values per row */
function drawDumbbell(host, rows, o = {}) {
  const rh = o.rowH || 24, F = frame(host, rows.length * rh + 40, { t: 26, r: 18, b: 14, l: o.l || Math.min(180, Math.max(110, (host.clientWidth || 600) * 0.3)) });
  const all = rows.flatMap((r) => [r.a, r.b]);
  const lo = o.min ?? Math.floor(Math.min(...all) - 2), hi = o.max ?? Math.ceil(Math.max(...all) + 2);
  const x = scale(lo, hi, F.m.l, F.m.l + F.iw);
  const g = sv('g'); F.svg.append(g);
  ticks(lo, hi, 6).forEach((t) => { vline(g, x(t), F.m.t - 4, F.h - F.m.b, o.zero != null && t === o.zero ? PAL.axis : PAL.grid); txt(g, x(t), F.m.t - 10, o.fmt ? o.fmt(t) : t, { 'text-anchor': 'middle' }); });
  rows.forEach((r, i) => {
    const cy = F.m.t + i * rh + rh / 2;
    g.append(sv('line', { x1: x(r.a), x2: x(r.b), y1: cy, y2: cy, stroke: r.lineColor || PAL.axis, 'stroke-width': 2, 'stroke-linecap': 'round' }));
    g.append(sv('circle', { cx: x(r.a), cy, r: 4.5, fill: o.aColor || PAL.surface, stroke: o.aStroke || PAL.ink2, 'stroke-width': 2 }));
    g.append(sv('circle', { cx: x(r.b), cy, r: 5, fill: r.bColor || PAL.ink, stroke: PAL.surface, 'stroke-width': 2 }));
    txt(g, F.m.l - 8, cy + 4, r.label, { 'text-anchor': 'end', class: 'lbl' });
    const hit = sv('rect', { x: 0, y: cy - rh / 2, width: F.w, height: rh, fill: 'transparent' }); g.append(hit);
    if (r.tip) hoverable(hit, r.tip);
  });
}

/* =========================================================== model run */
const ELECTION = D.meta.election, BASE_DATE = D.meta.asOf;
function asOfDate() { return clampISO(todayISO(), BASE_DATE, ELECTION); }
function lensVals() {
  if (S.lens === 'custom') return { state: +S.customState, gb: +S.customGB };
  const L = D.lenses[S.lens]; return { state: L.state, gb: L.gb };
}
function resolved(daysLeft) {
  const L = lensVals();
  return Object.assign({}, S, { biasState: L.state, biasGB: L.gb, partW: 1, nmax: 3000, sigmaNatDrift: 0.25 * Math.sqrt(Math.max(0, daysLeft)) });
}
function allPolls() {
  return D.polls.concat(userPolls).map((p) => Object.assign({}, p, { excluded: excluded.has(p.id) }));
}
function pollsFor(id) { return allPolls().filter((p) => p.race === id); }
let RES = null;
function runModel() {
  const asOf = asOfDate(), daysLeft = E.daysBetween(asOf, ELECTION);
  const s = resolved(daysLeft);
  const gbPa = E.pollAverage(pollsFor('GB'), asOf, s);
  const envRaw = gbPa.avg ?? D.house.gbFallback;
  const envAdj = envRaw - s.biasGB;
  const ctx = { s, asOf, envAdj, daysLeft, gbBaseline: D.house.gbBaseline };
  const ests = D.races.map((r) => E.raceEstimate(r, pollsFor(r.id), ctx));
  const dctx = { s, envAdj, gbBaseline: D.house.gbBaseline };
  const dists = D.house.battlefield.map((d) => E.districtEstimate(d, dctx));
  const callMap = {}; for (const [k, v] of Object.entries(calls)) if (v === 'D' || v === 'R') callMap[k] = v;
  const sim = E.simulate({ races: ests, districts: dists, senateBase: D.senateBase, houseBase: { D: D.house.solid.D }, regions: REGIONS }, s, callMap);
  const byId = {}; ests.forEach((e, i) => { byId[e.race.id] = { est: e, out: sim.races[i] }; });
  const shifts = []; for (let v = -14; v <= 14.001; v += 0.5) shifts.push(+v.toFixed(1));
  // add each scenario's exact shift so the scenario table reads the curve at that point
  (D.scenarios || []).forEach((sc) => { const v = +(+sc.shift).toFixed(2); if (!shifts.some((x) => Math.abs(x - v) < 1e-6)) shifts.push(v); });
  shifts.sort((a, b) => a - b);
  const hCurve = E.houseCurve(dists, { D: D.house.solid.D }, s, shifts);
  const sCurve = E.senateCurve(ests, D.senateBase, s, shifts);
  RES = { asOf, daysLeft, s, gbPa, envRaw, envAdj, ests, dists, sim, byId, hCurve, sCurve, nCalls: Object.keys(callMap).length };
  runExtras();
  recordSnapshot();
  return RES;
}
function snapOf(R) {
  const g = R.byId[D.ohio.govId], os = R.byId[D.ohio.senId];
  return { d: R.asOf, sR: +R.sim.senate.pR.toFixed(3), hD: +R.sim.house.pD.toFixed(3), sMed: R.sim.senate.med, hMed: R.sim.house.med, gov: g ? +g.out.pD.toFixed(3) : null, ohs: os ? +os.out.pD.toFixed(3) : null, gb: +R.envAdj.toFixed(2) };
}
function isDefaultSettings() { return Object.keys(DEFAULTS).every((k) => S[k] === DEFAULTS[k]) && !RES.nCalls; }
function recordSnapshot() {
  if (!isDefaultSettings()) return; // the movement log tracks the calibrated model only
  const sn = snapOf(RES);
  if (sn.d === BASE_DATE && !userPolls.length && !excluded.size) return; // baseline is baked in
  history[sn.d] = sn; LS.set('history', history);
}
