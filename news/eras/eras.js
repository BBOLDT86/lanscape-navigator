/* The Watch · Three waves. Overlay charts drawn in the browser from the numbers below (each one sourced on the page). */
const ERAS = [
  { id: 'e1', name: '1924–32', long: '1924–1932', wave: 1930, start: 1924, shape: 'circle', rows: [
    { y: 1924, h: -15.8, d: 183, r: 247, p: -25.2 },
    { y: 1926, h: -17.0, d: 194, r: 238 },
    { y: 1928, h: -14.8, d: 164, r: 270, p: -17.4 },
    { y: 1930, h: -8.5, d: 216, r: 218 },
    { y: 1932, h: 12.4, d: 313, r: 117, p: 17.8 } ] },
  { id: 'e2', name: '2004–12', long: '2004–2012', wave: 2006, start: 2004, shape: 'square', rows: [
    { y: 2004, h: -2.6, d: 202, r: 232, p: -2.5 },
    { y: 2006, h: 6.4, d: 233, r: 202 },
    { y: 2008, h: 10.6, d: 257, r: 178, p: 7.3 },
    { y: 2010, h: -6.6, d: 193, r: 242 },
    { y: 2012, h: 1.4, d: 201, r: 234, p: 3.9 } ] },
  { id: 'e3', name: '2016–28', long: '2016–2028', wave: 2026, start: 2016, shape: 'diamond', rows: [
    { y: 2016, h: -0.9, d: 194, r: 241, p: 2.1 },
    { y: 2018, h: 8.7, d: 235, r: 199 },
    { y: 2020, h: 3.0, d: 222, r: 213, p: 4.5 },
    { y: 2022, h: -2.6, d: 213, r: 222 },
    { y: 2024, h: -2.5, d: 215, r: 220, p: -1.5 },
    { y: 2026, h: 13.2, d: 254, r: 162, prelim: true, open: 19 },
    { y: 2028, proj: true,
      h: { lo: 5.2, mid: 7.5, hi: 17.4, x32: 34.1 },
      d: { lo: 241, mid: 246, hi: 278, x32: 351 },
      p: { lo: 2.7, mid: 9.0, hi: 14.1, x32: 39.5 } } ] }
];
const STATE = { mode: 'wave' };
const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
const fm = v => v === 0 ? 'even' : (v > 0 ? 'D+' : 'R+') + Math.abs(v).toFixed(1);
const xOf = (era, year) => STATE.mode === 'wave' ? year - era.wave : year - era.start;

function marker(g, shape, cx, cy, cls, size = 5) {
  if (shape === 'square') return el('rect', { x: cx - size, y: cy - size, width: size * 2, height: size * 2, rx: 1.5, class: cls }, g);
  if (shape === 'diamond') return el('path', { d: `M${cx} ${cy - size - 1.5}L${cx + size + 1.5} ${cy}L${cx} ${cy + size + 1.5}L${cx - size - 1.5} ${cy}Z`, class: cls }, g);
  return el('circle', { cx, cy, r: size, class: cls }, g);
}

/* ---------- the overlay: one metric, three eras laid on one axis ---------- */
function overlay(host) {
  const key = host.dataset.metric;
  const cfg = {
    h: { dom: [-20, 20], step: 10, base: 0, fmt: fm, unit: 'House popular-vote margin' },
    d: { dom: [100, 350], step: 50, base: 218, fmt: v => Math.round(v) + ' D seats', unit: 'Democratic House seats of 435' },
    p: { dom: [-30, 30], step: 10, base: 0, fmt: fm, unit: 'Presidential popular-vote margin' }
  }[key];
  const W = Math.max(320, host.clientWidth), narrow = W < 560;
  const H = narrow ? 330 : 400, m = { l: narrow ? 40 : 52, r: narrow ? 60 : 84, t: 30, b: 46 };
  const xd = STATE.mode === 'wave' ? [-10, 6] : [0, 12];
  const X = v => m.l + (v - xd[0]) / (xd[1] - xd[0]) * (W - m.l - m.r);
  const Y = v => m.t + (cfg.dom[1] - Math.max(cfg.dom[0], Math.min(cfg.dom[1], v))) / (cfg.dom[1] - cfg.dom[0]) * (H - m.t - m.b);
  host.innerHTML = '';
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.unit + ', three eras overlaid' }, host);

  // party tint + labels for margin charts
  if (key !== 'd') {
    el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: Y(0) - m.t, class: 'tint d' }, svg);
    el('rect', { x: m.l, y: Y(0), width: W - m.l - m.r, height: H - m.b - Y(0), class: 'tint r' }, svg);
    el('text', { x: m.l + 8, y: m.t + 16, class: 'side d' }, svg).textContent = 'Democrats ahead ↑';
    el('text', { x: m.l + 8, y: H - m.b - 8, class: 'side r' }, svg).textContent = 'Republicans ahead ↓';
  } else {
    el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: Y(218) - m.t, class: 'tint d' }, svg);
    el('text', { x: m.l + 8, y: m.t + 16, class: 'side d' }, svg).textContent = 'Democratic majority (218+)';
  }
  // grid
  for (let v = cfg.dom[0]; v <= cfg.dom[1]; v += cfg.step) {
    el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'grid' + (v === cfg.base ? ' zero' : '') }, svg);
    el('text', { x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'tick' }, svg).textContent = key === 'd' ? v : (v === 0 ? '0' : (v > 0 ? 'D+' : 'R+') + Math.abs(v));
  }
  if (key === 'd') { el('line', { x1: m.l, x2: W - m.r, y1: Y(218), y2: Y(218), class: 'grid zero' }, svg); el('text', { x: m.l - 6, y: Y(218) + 4, 'text-anchor': 'end', class: 'tick b' }, svg).textContent = '218'; }
  // x ticks
  for (let v = xd[0]; v <= xd[1]; v += 2) {
    const t = el('text', { x: X(v), y: H - m.b + 18, 'text-anchor': 'middle', class: 'tick' }, svg);
    if (STATE.mode === 'wave') t.textContent = v === 0 ? 'wave' : (v > 0 ? '+' : '−') + Math.abs(v);
    else t.textContent = v === 0 ? 'start' : '+' + v;
  }
  el('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis' }, svg).textContent =
    STATE.mode === 'wave' ? 'years from the wave midterm (1930 · 2006 · 2026)' : 'years from the first election of each era';
  if (STATE.mode === 'wave') {
    el('rect', { x: X(-0.55), y: m.t, width: X(0.55) - X(-0.55), height: H - m.t - m.b, class: 'waveband' }, svg);
    el('text', { x: X(0), y: m.t - 10, 'text-anchor': 'middle', class: 'axis b' }, svg).textContent = 'the wave';
    if (!narrow) {
      el('text', { x: X(-2), y: m.t - 10, 'text-anchor': 'middle', class: 'axis' }, svg).textContent = 'the last win';
      el('text', { x: X(2), y: m.t - 10, 'text-anchor': 'middle', class: 'axis' }, svg).textContent = 'two years on';
    }
  }

  const lines = [];
  ERAS.forEach(era => {
    const g = el('g', { class: 'era ' + era.id }, svg);
    const pts = era.rows.filter(r => !r.proj && r[key] != null).map(r => ({ x: X(xOf(era, r.y)), y: Y(r[key]), r }));
    const path = el('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(''), class: 'ln' }, g);
    lines.push(path);
    const proj = era.rows.find(r => r.proj);
    if (proj && pts.length) {
      const pv = proj[key], last = pts[pts.length - 1], px = X(xOf(era, proj.y));
      el('rect', { x: px - 7, y: Y(pv.hi), width: 14, height: Math.max(4, Y(pv.lo) - Y(pv.hi)), rx: 4, class: 'band' }, g);
      el('path', { d: `M${last.x} ${last.y}L${px} ${Y(pv.mid)}`, class: 'ln proj' }, g);
      marker(g, era.shape, px, Y(pv.mid), 'pt hollow', 5);
      if (pv.x32 > cfg.dom[1]) { // the 1932 path, off the scale
        el('path', { d: `M${px + 16} ${m.t + 26}L${px + 16} ${m.t + 6}M${px + 11} ${m.t + 11}L${px + 16} ${m.t + 5}L${px + 21} ${m.t + 11}`, class: 'arrow' }, g);
        el('text', narrow ? { x: W - 2, y: m.t + 14, 'text-anchor': 'end', class: 'note' } : { x: px + 24, y: m.t + 14, 'text-anchor': 'start', class: 'note' }, g).textContent = (narrow ? '1932: ' : '1932 path: ') + (key === 'd' ? pv.x32 : fm(pv.x32));
      }
      el('text', { x: px + 12, y: Y(pv.mid) + 4, class: 'lbl' }, g).textContent = (narrow ? '' : '2028? ') + (key === 'd' ? pv.mid : fm(pv.mid));
    }
    pts.forEach(p => {
      if (p.r.open && key === 'd') el('line', { x1: p.x, x2: p.x, y1: Y(p.r.d), y2: Y(p.r.d + p.r.open), class: 'whisk' }, g);
      marker(g, era.shape, p.x, p.y, 'pt' + (p.r.prelim ? ' pre' : ''), 5);
    });
    // direct label at the end of the solid line
    const last = pts[pts.length - 1];
    const lx = proj ? last.x - 8 : last.x + 9, anchor = proj ? 'end' : 'start';
    const lab = el('text', { x: lx, y: last.y + (proj ? -11 : 4), 'text-anchor': anchor, class: 'lbl era-l' }, g);
    lab.textContent = era.name;
  });

  // animate on first view
  if (!host.dataset.drawn) {
    lines.forEach((p, i) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.style.transition = 'none';
      requestAnimationFrame(() => requestAnimationFrame(() => { p.style.transition = `stroke-dashoffset 1.3s cubic-bezier(.3,.6,.2,1) ${i * 0.55}s`; p.style.strokeDashoffset = 0; })); });
    host.dataset.drawn = '1';
  }

  // hover: a rule at the nearest cycle, a tooltip with each era's value there
  const rule = el('line', { y1: m.t, y2: H - m.b, class: 'rule', visibility: 'hidden' }, svg);
  const hit = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, svg);
  const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; host.appendChild(tip);
  const move = e => {
    const b = svg.getBoundingClientRect(), sx = (e.clientX - b.left) * W / b.width;
    let xv = xd[0] + (sx - m.l) / (W - m.l - m.r) * (xd[1] - xd[0]); xv = Math.max(xd[0], Math.min(xd[1], Math.round(xv / 2) * 2));
    rule.setAttribute('x1', X(xv)); rule.setAttribute('x2', X(xv)); rule.setAttribute('visibility', 'visible');
    const rows = ERAS.map(era => {
      const r = era.rows.find(r => xOf(era, r.y) === xv); if (!r) return '';
      const v = r[key]; if (v == null) return '';
      let val = r.proj ? (key === 'd' ? `${v.lo}–${v.hi}` : `${fm(v.lo)} to ${fm(v.hi)}`) + ' <i>projected</i>' : cfg.fmt(v);
      if (r.prelim) val += ' <i>unofficial' + (key === 'd' ? `, ${r.open} uncalled` : '') + '</i>';
      return `<div><span class="sw ${era.id} ${era.shape}"></span><b>${r.y}</b> ${val}</div>`;
    }).join('');
    if (!rows) { tip.hidden = true; return; }
    tip.innerHTML = `<div class="th">${STATE.mode === 'wave' ? (xv === 0 ? 'The wave midterm' : xv === -2 ? 'The last win' : (xv > 0 ? '+' : '−') + Math.abs(xv) + ' years from the wave') : 'Year ' + xv + ' of the era'}</div>${rows}`;
    tip.hidden = false;
    const px = X(xv) / W * b.width, hostB = host.getBoundingClientRect();
    tip.style.left = Math.min(hostB.width - tip.offsetWidth - 4, Math.max(4, px + 14 - (px > b.width * .6 ? tip.offsetWidth + 28 : 0))) + 'px';
    tip.style.top = '8px';
  };
  hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', () => { tip.hidden = true; rule.setAttribute('visibility', 'hidden'); });
}

/* ---------- after the wave: the wave party's House margin at the wave and two years on ---------- */
function after(host) {
  const rows = [
    { lab: '1930 → 1932', who: 'Democrats', era: 'e1', a: -8.5, b: 12.4, shape: 'circle' },
    { lab: '2006 → 2008', who: 'Democrats', era: 'e2', a: 6.4, b: 10.6, shape: 'square' },
    { lab: '2010 → 2012', who: 'Republicans', era: 'e2', a: 6.6, b: -1.4, shape: 'square' },
    { lab: '2018 → 2020', who: 'Democrats', era: 'e3', a: 8.7, b: 3.0, shape: 'diamond' },
    { lab: '2026 → 2028', who: 'Democrats', era: 'e3', a: 13.2, b: 7.5, lo: 5.2, hi: 17.4, proj: true, shape: 'diamond' }
  ];
  const W = Math.max(320, host.clientWidth), narrow = W < 560, rh = 54;
  const m = { l: narrow ? 104 : 150, r: 30, t: 30, b: 40 }, H = m.t + m.b + rows.length * rh;
  const d = [-10, 20], X = v => m.l + (v - d[0]) / (d[1] - d[0]) * (W - m.l - m.r);
  host.innerHTML = '';
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'The wave party’s House margin at the wave midterm and two years later' }, host);
  for (let v = d[0]; v <= d[1]; v += 5) {
    el('line', { x1: X(v), x2: X(v), y1: m.t - 6, y2: H - m.b, class: 'grid' + (v === 0 ? ' zero' : '') }, svg);
    el('text', { x: X(v), y: H - m.b + 16, 'text-anchor': 'middle', class: 'tick' }, svg).textContent = v === 0 ? 'tied' : (v > 0 ? '+' : '−') + Math.abs(v);
  }
  el('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis' }, svg).textContent = 'the wave party’s lead in the House vote, points';
  el('text', { x: X(d[0]) + 2, y: m.t - 12, class: 'axis' }, svg).textContent = '○ at the wave   ● two years later';
  rows.forEach((r, i) => {
    const y = m.t + rh * i + rh / 2, g = el('g', { class: 'era ' + r.era }, svg);
    el('text', { x: m.l - 12, y: y - 2, 'text-anchor': 'end', class: 'rowl' }, svg).textContent = r.lab;
    el('text', { x: m.l - 12, y: y + 13, 'text-anchor': 'end', class: 'rowm' }, svg).textContent = r.who + (r.proj ? ', projected' : '');
    if (r.proj) el('rect', { x: X(r.lo), y: y - 8, width: X(r.hi) - X(r.lo), height: 16, rx: 8, class: 'band' }, g);
    const dir = r.b > r.a ? -1 : 1;
    el('path', { d: `M${X(r.a)} ${y}L${X(r.b) + dir * 9} ${y}`, class: 'ln' + (r.proj ? ' proj' : '') }, g);
    el('path', { d: `M${X(r.b) + dir * 13} ${y - 5}L${X(r.b) + dir * 8} ${y}L${X(r.b) + dir * 13} ${y + 5}`, class: 'ln' + (r.proj ? ' proj' : '') }, g);
    marker(g, r.shape, X(r.a), y, 'pt hollow', 5);
    marker(g, r.shape, X(r.b), y, 'pt' + (r.proj ? ' hollow' : ''), 5);
    const fa = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
    el('text', { x: X(r.a), y: y - 12, 'text-anchor': 'middle', class: 'lbl' }, g).textContent = fa(r.a);
    el('text', { x: X(r.b), y: y + 22, 'text-anchor': 'middle', class: 'lbl' }, g).textContent = r.proj ? fa(r.lo) + ' to ' + fa(r.hi) : fa(r.b);
    if (r.a < d[0] || r.b > d[1]) {}
    const t = el('title', {}, g); t.textContent = `${r.lab}: ${r.who} ${fa(r.a)} at the wave, ${r.proj ? fa(r.lo) + ' to ' + fa(r.hi) + ' projected' : fa(r.b)} two years later`;
  });
}

function drawAll() { document.querySelectorAll('[data-metric]').forEach(overlay); const a = $('#after'); if (a) after(a); }
document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
  STATE.mode = b.dataset.mode;
  document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', x.dataset.mode === STATE.mode));
  document.querySelectorAll('[data-metric]').forEach(h => delete h.dataset.drawn);
  drawAll();
}));
// draw each chart when it scrolls into view, so the lines draw in front of the reader
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const h = e.target; h.dataset.metric ? overlay(h) : after(h); io.unobserve(h); h.dataset.seen = '1'; } }), { threshold: .25 });
document.querySelectorAll('[data-metric], #after').forEach(h => io.observe(h));
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => document.querySelectorAll('[data-seen]').forEach(h => { h.dataset.drawn = '1'; h.dataset.metric ? overlay(h) : after(h); }), 150); });
if (new URLSearchParams(location.search).has('all')) drawAll();

// share
$('[data-share]')?.addEventListener('click', async () => {
  const d = { title: document.title, text: document.querySelector('meta[name=description]').content, url: location.href.split('?')[0] };
  try { if (navigator.share) await navigator.share(d); else { await navigator.clipboard.writeText(d.url); const b = $('[data-share]'); b.textContent = 'Link copied'; setTimeout(() => b.textContent = 'Share', 1800); } } catch (e) {}
});
/* The Pulse: reader counts (news/pulse/pulse.js) */ (function(){try{if(!window.__pulse&&!document.querySelector('script[src*="pulse/pulse.js"]')){var s=document.createElement('script');s.defer=true;s.src='/lanscape-navigator/news/pulse/pulse.js';document.head.appendChild(s);}}catch(e){}})();
