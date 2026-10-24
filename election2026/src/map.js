/* ===================================================================================================================
   The Wall: a state-to-county drilldown map. GEO is a TopoJSON topology pre-projected to a 975x610 Albers USA
   viewport (us-atlas); this file decodes it without a library and draws SVG paths.
   =================================================================================================================== */
const MAP = (() => {
  const T = GEO; const sc = T.transform.scale, tr = T.transform.translate;
  // decode arcs: delta-encoded, quantized -> absolute coordinates (rounded to .1 to keep path strings short)
  const arcs = T.arcs.map((a) => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [Math.round((x * sc[0] + tr[0]) * 10) / 10, Math.round((y * sc[1] + tr[1]) * 10) / 10]; }); });
  function ring(idx) { // one ring: a list of arc indexes (negative = reversed)
    const pts = []; for (const i of idx) { const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse(); for (let k = pts.length ? 1 : 0; k < a.length; k++) pts.push(a[k]); } return pts;
  }
  function polys(g) { return g.type === 'Polygon' ? [g.arcs] : g.arcs; } // list of polygons, each a list of rings
  function pathOf(g) { return polys(g).map((rings) => rings.map((r) => { const p = ring(r); return 'M' + p.map((q) => q[0] + ',' + q[1]).join('L') + 'Z'; }).join('')).join(''); }
  function bboxOf(g) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const rings of polys(g)) for (const q of ring(rings[0])) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; } return [x0, y0, x1, y1]; }
  function centroidOf(g) { // area-weighted centroid of the largest polygon's outer ring
    let best = null, bestA = 0;
    for (const rings of polys(g)) { const p = ring(rings[0]); let A = 0, cx = 0, cy = 0; for (let i = 0, n = p.length; i < n; i++) { const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % n]; const f = x0 * y1 - x1 * y0; A += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f; } A *= 0.5; if (Math.abs(A) > bestA) { bestA = Math.abs(A); best = [cx / (6 * A), cy / (6 * A)]; } }
    return best;
  }
  const states = {}, counties = {}, byState = {};
  for (const g of T.objects.states.geometries) states[g.id] = { id: g.id, name: g.n, d: pathOf(g), bb: bboxOf(g), c: centroidOf(g) };
  for (const g of T.objects.counties.geometries) { const o = { id: g.id, name: g.n, st: g.id.slice(0, 2), d: pathOf(g), c: centroidOf(g) }; counties[g.id] = o; (byState[o.st] = byState[o.st] || []).push(o); }
  // label offsets for small states (ME-style leader lines are overkill; just nudge)
  const NUDGE = { '09': [0, 0], '10': [14, 0], '11': [18, 6], '24': [20, 10], '25': [14, -6], '33': [4, -10], '34': [14, 4], '44': [14, 4], '50': [-2, -12], '15': [0, 0] };
  const svg = document.getElementById('map'); const NS = 'http://www.w3.org/2000/svg';
  const el = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
  let view = { level: 'us', st: null }, handlers = {};
  function setView(v) { view = v; draw(); }
  function draw() {
    svg.textContent = '';
    const gS = el('g', { class: 'g-states' }), gC = el('g', { class: 'g-counties' }), gL = el('g', { class: 'g-labels' });
    if (view.level === 'us') {
      svg.setAttribute('viewBox', '0 0 975 610');
      for (const id in states) { const s = states[id]; const p = el('path', { d: s.d, class: 'st', 'data-id': id, tabindex: 0, role: 'button', 'aria-label': s.name }); p.style.fill = handlers.fillState ? handlers.fillState(id) : '#223'; gS.append(p); }
      for (const id in states) { const s = states[id]; const lab = handlers.labelState ? handlers.labelState(id) : null; if (!lab) continue; const n = NUDGE[id] || [0, 0]; const t = el('text', { x: s.c[0] + n[0], y: s.c[1] + n[1] + 3, class: 'lab' }); t.textContent = lab; gL.append(t); }
      svg.append(gS, gL);
    } else {
      const s = states[view.st]; const [x0, y0, x1, y1] = s.bb; const w = x1 - x0, h = y1 - y0; const pad = Math.max(w, h) * 0.08;
      // keep the 975:610 aspect so the svg's height does not jump
      let vw = w + pad * 2, vh = h + pad * 2; if (vw / vh < 975 / 610) vw = vh * 975 / 610; else vh = vw * 610 / 975;
      svg.setAttribute('viewBox', `${x0 + w / 2 - vw / 2} ${y0 + h / 2 - vh / 2} ${vw} ${vh}`);
      // neighbours, dimmed
      for (const id in states) { if (id === view.st) continue; const p = el('path', { d: states[id].d, class: 'st dim', 'data-id': id }); p.style.fill = '#1b2440'; gS.append(p); }
      const list = byState[view.st] || [];
      for (const c of list) { const p = el('path', { d: c.d, class: 'co', 'data-id': c.id, 'data-st': c.st }); p.style.fill = handlers.fillCounty ? handlers.fillCounty(c.id) : '#334'; if (view.co === c.id) p.classList.add('sel'); gC.append(p); }
      // state outline on top
      gC.append(el('path', { d: s.d, class: 'st', style: 'fill:none;stroke:#fff;stroke-width:1.4;pointer-events:none' }));
      svg.append(gS, gC);
      if (handlers.labelCounty) { const big = list.slice().sort((a, b) => (handlers.sizeCounty(b.id) || 0) - (handlers.sizeCounty(a.id) || 0)).slice(0, Math.min(10, Math.max(3, Math.ceil(list.length / 8)))); for (const c of big) { const lab = handlers.labelCounty(c.id); if (!lab || !c.c) continue; const t = el('text', { x: c.c[0], y: c.c[1] + 2, class: 'lab', style: `font-size:${Math.max(2, Math.min(8, vw / 140))}px;stroke-width:${Math.max(.5, vw / 600)}px` }); t.textContent = lab; gL.append(t); } svg.append(gL); }
    }
  }
  // events: delegate
  const tip = document.getElementById('tip');
  function showTip(e, html) { tip.innerHTML = html; tip.style.display = 'block'; moveTip(e); }
  function moveTip(e) { const x = e.clientX + 14, y = e.clientY + 14; const r = tip.getBoundingClientRect(); tip.style.left = Math.min(x, innerWidth - r.width - 8) + 'px'; tip.style.top = Math.min(y, innerHeight - r.height - 8) + 'px'; }
  svg.addEventListener('mousemove', (e) => { const p = e.target.closest('path[data-id]'); if (!p || p.classList.contains('dim')) { tip.style.display = 'none'; return; } const id = p.dataset.id; const html = p.classList.contains('co') ? handlers.tipCounty && handlers.tipCounty(id) : handlers.tipState && handlers.tipState(id); if (html) showTip(e, html); else tip.style.display = 'none'; });
  svg.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  svg.addEventListener('click', (e) => { const p = e.target.closest('path[data-id]'); if (!p) return; tip.style.display = 'none'; if (p.classList.contains('co')) handlers.clickCounty && handlers.clickCounty(p.dataset.id); else handlers.clickState && handlers.clickState(p.dataset.id); });
  svg.addEventListener('keydown', (e) => { if (e.key !== 'Enter' && e.key !== ' ') return; const p = e.target.closest('path[data-id]'); if (!p) return; e.preventDefault(); handlers.clickState && handlers.clickState(p.dataset.id); });
  function recolor() { svg.querySelectorAll('path.st:not(.dim)').forEach((p) => { if (p.dataset.id && handlers.fillState && view.level === 'us') p.style.fill = handlers.fillState(p.dataset.id); }); svg.querySelectorAll('path.co').forEach((p) => { p.style.fill = handlers.fillCounty(p.dataset.id); }); }
  return { states, counties, byState, setView, get view() { return view; }, draw, recolor, on(h) { Object.assign(handlers, h); } };
})();
