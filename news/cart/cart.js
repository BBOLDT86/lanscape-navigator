/* The Watch · The Cart. Reads ../prices/data/view.json (official average prices, monthly, per item) and prices the
   reader's own cart with it. No build step: everything is computed in the browser from that one file. */
const $ = (s, r = document) => r.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const MON = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const usd = v => v == null ? '—' : '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pc = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d) + '%';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

const PRESETS = {
  staples: ['Staples', { eggs: 1, milk: 1, bread: 1, beef: 1, chicken_breast: 2, bananas: 2, potatoes: 2, tomatoes: 1, cheese: 0.5, butter: 0.5, rice: 0.5, pasta: 1, coffee: 0.5 }],
  family: ['Family of four', { eggs: 2, milk: 2, bread: 2, beef: 2, chicken_breast: 3, bacon: 1, ham: 1, bananas: 3, lemons: 0.5, strawberries: 1, potatoes: 3, tomatoes: 1.5, lettuce: 1, cheese: 1, butter: 1, yogurt: 6, rice: 1, pasta: 2, beans: 0.5, chips: 1, coffee: 0.5, orange_juice: 1 }],
  single: ['One person', { eggs: 0.5, milk: 0.5, bread: 0.5, chicken_breast: 1, beef: 0.5, bananas: 1, tomatoes: 0.5, rice: 0.5, pasta: 0.5, coffee: 0.5, cheese: 0.5 }],
  breakfast: ['Breakfast', { eggs: 2, bacon: 1, bread: 1, butter: 0.5, milk: 1, coffee: 0.5, orange_juice: 1, bananas: 2 }],
  cookout: ['Cookout', { beef: 3, american_cheese: 0.5, tomatoes: 1, lettuce: 1, chips: 1, soda_12: 12, beer: 6, ice_cream: 1, ground_chuck: 0 }],
  bills: ['Staples + gas and power', { eggs: 1, milk: 1, bread: 1, beef: 1, chicken_breast: 2, bananas: 2, potatoes: 2, tomatoes: 1, cheese: 0.5, butter: 0.5, rice: 0.5, pasta: 1, coffee: 0.5, gas: 12, electricity: 200 }],
};
const WINDOWS = [['1y', 'Past year'], ['2019', 'Since 2019'], ['2000', 'Since 2000'], ['all', 'As far back as it goes']];
const STEP = { gas: 1, electricity: 25, natural_gas: 5, yogurt: 1, beer: 1, soda_12: 6, soda_2l: 1, ice_cream: 1, wine: 1, strawberries: 1 };
const CATS = ['Meat & fish', 'Dairy & eggs', 'Produce', 'Bakery & pantry', 'Drinks', 'Snacks & sweets', 'Fuel & power'];

const V = await fetch('../prices/data/view.json', { cache: 'no-cache' }).then(r => r.json());
const NM = V.n_months, START = V.start;
const items = V.items.filter(i => i.current).map(it => {
  const f = []; let last = null; for (let k = 0; k < NM; k++) { if (it.m[k] != null) last = it.m[k]; f.push(k >= it.first ? last : null); }
  return { ...it, f };
});
const byId = Object.fromEntries(items.map(i => [i.id, i]));
const carry = a => { const o = []; let l = null; for (const v of a) { if (v != null) l = v; o.push(l); } return o; };
const IX = { food: carry(V.indexes.food_home?.m || []), all: carry(V.indexes.all_items?.m || []), pay: carry(V.indexes.wage?.m || []) };
const mlab = (k, short) => (short ? MON[k % 12].replace('.', '').slice(0, 3) + ' ' : MON[k % 12] + ' ') + (START + Math.floor(k / 12));
const kOf = (y, m = 1) => (y - START) * 12 + m - 1;

/* ---------- state ---------- */
const S = { cart: {}, win: '2019', preset: 'staples' };
function clean(c) { const o = {}; for (const k in c) if (byId[k] && c[k] > 0) o[k] = +c[k]; return o; }
(function load() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('c')) { S.cart = clean(Object.fromEntries(h.get('c').split(',').map(p => p.split(':')).map(([a, b]) => [a, +b]))); S.preset = null; if (h.get('w')) S.win = h.get('w'); return; }
  try { const p = JSON.parse(localStorage.getItem('watch.cart.v1') || 'null'); if (p && p.cart && Object.keys(clean(p.cart)).length) { S.cart = clean(p.cart); S.win = p.win || '2019'; S.preset = p.preset || null; return; } } catch (e) { }
  S.cart = clean(PRESETS.staples[1]);
})();
const save = () => { try { localStorage.setItem('watch.cart.v1', JSON.stringify(S)); } catch (e) { } };

/* ---------- the arithmetic ---------- */
function compute() {
  const ids = Object.keys(S.cart).filter(id => byId[id]);
  if (!ids.length) return null;
  const kEnd = NM - 1;
  let want = S.win === '1y' ? kEnd - 12 : S.win === 'all' ? 0 : kOf(+S.win);
  const firsts = ids.map(id => byId[id].first), kMin = Math.max(...firsts);
  const ks = Math.max(want, kMin), late = ks > want ? byId[ids[firsts.indexOf(kMin)]] : null;
  const cost = []; for (let k = ks; k <= kEnd; k++) cost.push(ids.reduce((s, id) => s + S.cart[id] * byId[id].f[k], 0));
  const ser = key => { const a = IX[key]; const b = a[ks]; return b ? cost.map((_, i) => a[ks + i] == null ? null : a[ks + i] / b * 100) : null; };
  const rows = ids.map(id => { const it = byId[id], q = S.cart[id], p0 = it.f[ks], p1 = it.f[kEnd]; return { it, q, p0, p1, d: q * (p1 - p0), pct: (p1 / p0 - 1) * 100, spend: q * p1 }; }).sort((a, b) => b.d - a.d);
  const total = cost[cost.length - 1];
  return { ids, ks, kEnd, cost, late, want, idx: cost.map(c => c / cost[0] * 100), food: ser('food'), all: ser('all'), pay: ser('pay'), rows, total, months: kEnd - ks };
}

/* ---------- tooltip ---------- */
const tip = $('#tip');
function showTip(html, x, y) { tip.innerHTML = html; tip.hidden = false; const r = tip.getBoundingClientRect(); tip.style.left = Math.max(6, Math.min(innerWidth - r.width - 6, x + 14)) + 'px'; tip.style.top = Math.max(6, y - r.height - 12 < 6 ? y + 18 : y - r.height - 12) + 'px'; }
const hideTip = () => { tip.hidden = true; };
addEventListener('scroll', hideTip, { passive: true });
const el = (n, a = {}, t) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (t != null) e.textContent = t; return e; };

/* ---------- tiles ---------- */
function tiles(C) {
  const r = C.idx[C.idx.length - 1] - 100, yrs = C.months / 12, ann = (Math.pow(1 + r / 100, 1 / yrs) - 1) * 100;
  const g = C.food ? C.food[C.food.length - 1] - 100 : null, diff = g == null ? null : r - g;
  const w0 = IX.pay[C.ks], w1 = IX.pay[C.kEnd], hm = h => { const m = Math.round(h * 60); return (m >= 60 ? Math.floor(m / 60) + ' h ' : '') + (m % 60) + ' min'; };
  $('#tiles').innerHTML = `
  <div class="tile hero"><span>Your cart, a week, ${mlab(C.kEnd)}</span><b>${usd(C.total)}</b><small>${usd(C.total * 52 / 12)} a month · ${usd(C.total * 52)} a year</small></div>
  <div class="tile"><span>The same cart in ${mlab(C.ks)}</span><b>${usd(C.cost[0])}</b><small>${usd(C.total - C.cost[0])} more a week now, ${usd((C.total - C.cost[0]) * 52)} more a year</small></div>
  <div class="tile"><span>Your cart’s inflation</span><b>${pc(r)}</b><small>${yrs > 1.05 ? pc(ann) + ' a year, compounded' : 'over 12 months'}</small></div>
  <div class="tile"><span>Official groceries, same months</span><b>${g == null ? '—' : pc(g)}</b><small>${diff == null ? '' : Math.abs(diff) < 0.5 ? 'About the same as your cart' : `Your cart ran ${Math.abs(diff).toFixed(1)} points ${diff > 0 ? 'hotter' : 'cooler'}`}${w0 && w1 ? `. At average hourly pay the cart takes ${hm(C.total / w1)} of work; it took ${hm(C.cost[0] / w0)}` : ''}</small></div>`;
}

/* ---------- line chart ---------- */
function line(C) {
  const host = $('#line'); host.innerHTML = '';
  const W = host.clientWidth || 600, narrow = W < 520, H = narrow ? 270 : 330, m = { l: 44, r: narrow ? 92 : 124, t: 12, b: 26 };
  const series = [['Your cart', C.idx, '--s1', 2.8], ['Groceries (official)', C.food, '--s2', 2], ['All prices (official)', C.all, '--s3', 2], ['Hourly pay', C.pay, '--s4', 2]].filter(s => s[1]);
  const short = { 'Your cart': 'Your cart', 'Groceries (official)': 'Groceries', 'All prices (official)': 'All prices', 'Hourly pay': 'Pay' };
  let lo = 100, hi = 100; for (const s of series) for (const v of s[1]) if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const pad = (hi - lo) * 0.08 || 2; lo -= pad; hi += pad;
  const n = C.cost.length, x = i => m.l + (W - m.l - m.r) * i / (n - 1), y = v => m.t + (H - m.t - m.b) * (1 - (v - lo) / (hi - lo));
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Line chart: your cart against official grocery prices, all prices and hourly pay, as percent change since ' + mlab(C.ks) });
  const span = hi - lo, stepv = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(s => span / s <= 6) || 2000;
  for (let v = Math.ceil(lo / stepv) * stepv; v <= hi; v += stepv) { svg.append(el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: v === 100 ? css('--axis') : css('--grid'), 'stroke-width': 1 })); svg.append(el('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, v === 100 ? '0%' : pc(v - 100, 0))); }
  const yrs = Math.ceil(n / 12), every = [1, 2, 5, 10].find(e => yrs / e <= (narrow ? 5 : 9)) || 10;
  if (n <= 14) { for (let i = 0; i < n; i += narrow ? 3 : 2) svg.append(el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, mlab(C.ks + i, true))); }
  else for (let k = C.ks; k <= C.kEnd; k++) if (k % 12 === 0 && (START + k / 12) % every === 0) svg.append(el('text', { x: x(k - C.ks), y: H - 6, 'text-anchor': 'middle' }, START + k / 12));
  const ends = [];
  for (const [name, a, c, w] of series) {
    let d = '', pen = false; a.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true; });
    svg.append(el('path', { d, fill: 'none', stroke: css(c), 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    let j = a.length - 1; while (j > 0 && a[j] == null) j--; ends.push({ name, c, v: a[j], yy: y(a[j]) });
  }
  ends.sort((a, b) => a.yy - b.yy); for (let i = 1; i < ends.length; i++) if (ends[i].yy - ends[i - 1].yy < 15) ends[i].yy = ends[i - 1].yy + 15;
  for (const e of ends) { svg.append(el('circle', { cx: x(n - 1), cy: y(e.v), r: 4, fill: css(e.c), stroke: css('--raise'), 'stroke-width': 2 })); svg.append(el('text', { x: x(n - 1) + 9, y: e.yy + 4, class: 'lab' }, `${short[e.name]} ${pc(e.v - 100, 0)}`)); }
  const cross = el('line', { y1: m.t, y2: H - m.b, stroke: css('--axis'), 'stroke-width': 1, visibility: 'hidden' }); svg.append(cross);
  const dots = series.map(s => { const c = el('circle', { r: 4, fill: css(s[2]), stroke: css('--raise'), 'stroke-width': 2, visibility: 'hidden' }); svg.append(c); return c; });
  const hit = el('rect', { x: m.l, y: 0, width: W - m.l - m.r + 8, height: H, fill: 'transparent' }); svg.append(hit);
  const move = ev => {
    const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * W, i = Math.max(0, Math.min(n - 1, Math.round((px - m.l) / (W - m.l - m.r) * (n - 1))));
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    series.forEach((s, j) => { const v = s[1][i]; dots[j].setAttribute('visibility', v == null ? 'hidden' : 'visible'); if (v != null) { dots[j].setAttribute('cx', x(i)); dots[j].setAttribute('cy', y(v)); } });
    showTip(`<b>${mlab(C.ks + i)}</b>Your cart ${usd(C.cost[i])} a week<br>` + series.map(s => s[1][i] == null ? '' : `<i style="background:${css(s[2])}"></i>${short[s[0]]} ${pc(s[1][i] - 100)}`).filter(Boolean).join('<br>'), ev.clientX, ev.clientY);
  };
  hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', () => { hideTip(); cross.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('visibility', 'hidden')); });
  host.append(svg);
  $('#lineLegend').innerHTML = series.map(s => `<span><i style="background:${css(s[2])}"></i>${s[0]}</span>`).join('');
  $('#lineSub').textContent = `Percent change since ${mlab(C.ks)}. Your cart is the dollars you would have paid; the official lines are the government’s indexes over the same months.`;
}

/* ---------- what moved it ---------- */
function bars(C) {
  const host = $('#bars'); host.innerHTML = '';
  const W = host.clientWidth || 600, narrow = W < 520, rh = 28, lab = narrow ? 108 : 150, valw = narrow ? 104 : 130, H = C.rows.length * rh + 8;
  const mx = Math.max(...C.rows.map(r => Math.abs(r.d)), 0.01), neg = C.rows.some(r => r.d < 0);
  const x0 = lab + (neg ? (W - lab - valw) * 0.18 : 0), sc = (W - valw - x0) / mx, scn = neg ? (x0 - lab) / mx : 0;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Bar chart: dollars per week each item added to your cart' });
  svg.append(el('line', { x1: x0, x2: x0, y1: 0, y2: H, stroke: css('--axis'), 'stroke-width': 1 }));
  C.rows.forEach((r, i) => {
    const yy = i * rh + 4, w = Math.max(1.5, Math.abs(r.d) * (r.d >= 0 ? sc : scn)), up = r.d >= 0, bx = up ? x0 : x0 - w, rr = Math.min(4, w / 2), h = rh - 8;
    const d = up ? `M${bx} ${yy}h${w - rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}v${h - 2 * rr}a${rr} ${rr} 0 0 1 ${-rr} ${rr}h${-(w - rr)}z` : `M${x0} ${yy}h${-(w - rr)}a${rr} ${rr} 0 0 0 ${-rr} ${rr}v${h - 2 * rr}a${rr} ${rr} 0 0 0 ${rr} ${rr}h${w - rr}z`;
    svg.append(el('text', { x: 0, y: yy + h / 2 + 4, class: 'lab' }, r.it.name));
    const b = el('path', { d, fill: css(up ? '--up' : '--dn') }); svg.append(b);
    svg.append(el('text', { x: W, y: yy + h / 2 + 4, 'text-anchor': 'end', class: 'val' }, `${r.d >= 0 ? '+' : '−'}${usd(Math.abs(r.d))} · ${pc(r.pct, 0)}`));
    const hit = el('rect', { x: 0, y: i * rh, width: W, height: rh, fill: 'transparent' }); svg.append(hit);
    const tt = ev => showTip(`<b>${esc(r.it.name)}</b>${usd(r.p0)} → ${usd(r.p1)} per ${esc(r.it.unit)} (${pc(r.pct)})<br>${r.q} a week: ${usd(r.q * r.p0)} → ${usd(r.q * r.p1)}<br>${(r.spend / C.total * 100).toFixed(0)}% of your cart today`, ev.clientX, ev.clientY);
    hit.addEventListener('pointermove', tt); hit.addEventListener('pointerdown', tt); hit.addEventListener('pointerleave', hideTip);
  });
  host.append(svg);
  const top = C.rows[0], tot = C.total - C.cost[0];
  $('#barSub').textContent = `Dollars a week each item added to your cart since ${mlab(C.ks)}, and its price change.` + (tot > 0 && top.d > 0 ? ` ${top.it.name} alone is ${(top.d / tot * 100).toFixed(0)}% of the rise.` : '');
}

/* ---------- year-by-year grid ---------- */
function mix(a, b, t) { const h = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const A = h(a), B = h(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function yoy(arr, y) { // same months present in both years
  let a = 0, b = 0, n = 0; for (let mth = 0; mth < 12; mth++) { const k1 = kOf(y, mth + 1), k0 = k1 - 12; if (k0 < 0 || k1 >= arr.length) continue; if (arr[k1] != null && arr[k0] != null) { a += arr[k1]; b += arr[k0]; n++; } }
  return n ? a / b - 1 : null;
}
function heat(C) {
  const host = $('#heat'); host.innerHTML = '';
  const yEnd = START + Math.floor(C.kEnd / 12), y0 = Math.max(START + Math.ceil(C.ks / 12) + (C.ks % 12 ? 0 : 1), yEnd - 29, START + 1), years = []; for (let y = Math.min(y0, yEnd); y <= yEnd; y++) years.push(y);
  const cs = 24, gap = 2, lab = 128, W = lab + years.length * (cs + gap), rowsD = [{ name: 'Your cart', arr: null }, ...C.rows.map(r => ({ name: r.it.name, arr: r.it.m, it: r.it }))], H = 20 + rowsD.length * (cs + gap);
  const cartArr = []; for (let k = 0; k < NM; k++) cartArr.push(C.ids.every(id => byId[id].f[k] != null) ? C.ids.reduce((s, id) => s + S.cart[id] * byId[id].f[k], 0) : null);
  rowsD[0].arr = cartArr;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'Grid of yearly price changes for each item in your cart' }); svg.style.width = W + 'px'; svg.style.maxWidth = 'none';
  years.forEach((y, j) => { if (y % 5 === 0 || j === years.length - 1 || years.length < 12) svg.append(el('text', { x: lab + j * (cs + gap) + cs / 2, y: 12, 'text-anchor': 'middle' }, "’" + String(y).slice(2))); });
  const up = css('--up'), dn = css('--dn'), mid = css('--mid');
  rowsD.forEach((r, i) => {
    const yy = 20 + i * (cs + gap); svg.append(el('text', { x: 0, y: yy + cs / 2 + 4, class: i ? '' : 'lab' }, r.name));
    years.forEach((y, j) => {
      const v = yoy(r.arr, y); const c = v == null ? 'transparent' : mix(mid, v >= 0 ? up : dn, Math.min(1, Math.abs(v) / 0.2));
      const q = el('rect', { x: lab + j * (cs + gap), y: yy, width: cs, height: cs, rx: 4, fill: c, stroke: v == null ? css('--grid') : 'none' }); svg.append(q);
      const tt = ev => showTip(`<b>${esc(r.name)}, ${y}</b>${v == null ? 'No price that year' : pc(v * 100) + ' from ' + (y - 1) + (y === yEnd && C.kEnd % 12 !== 11 ? ' (same months)' : '')}`, ev.clientX, ev.clientY);
      q.addEventListener('pointermove', tt); q.addEventListener('pointerdown', tt); q.addEventListener('pointerleave', hideTip);
    });
  });
  host.append(svg); host.scrollLeft = W;
  $('#heatLegend').innerHTML = `<span><i class="sq" style="background:${dn}"></i>fell 20% or more</span><span><i class="sq" style="background:${mid}"></i>no change</span><span><i class="sq" style="background:${up}"></i>rose 20% or more</span>`;
}

/* ---------- editor ---------- */
function editor(C) {
  const ks = C ? C.ks : NM - 13; let h = '';
  for (const cat of CATS) {
    const its = items.filter(i => i.cat === cat); if (!its.length) continue;
    h += `<p class="cat">${cat}</p><div class="rows">` + its.map(it => { const q = S.cart[it.id] || 0, p0 = it.f[Math.max(ks, it.first)], ch = (it.now / p0 - 1) * 100; return `<div class="row${q ? ' on' : ''}" data-id="${it.id}"><div class="n">${esc(it.name)}<small>${usd(it.now)} per ${esc(it.unit)} · ${pc(ch, 0)} since ${START + Math.floor(Math.max(ks, it.first) / 12)}</small></div><div class="step"><button type="button" data-d="-1" aria-label="Less ${esc(it.name)}">−</button><output>${q || 0}</output><button type="button" data-d="1" aria-label="More ${esc(it.name)}">+</button></div></div>`; }).join('') + '</div>';
  }
  $('#editor').innerHTML = h;
}
$('#editor').addEventListener('click', e => {
  const b = e.target.closest('button[data-d]'); if (!b) return; const id = b.closest('.row').dataset.id, st = STEP[id] || 0.5;
  const q = Math.max(0, +(((S.cart[id] || 0) + st * +b.dataset.d).toFixed(2))); if (q) S.cart[id] = q; else delete S.cart[id]; S.preset = null; render(true);
});
$('#clear').addEventListener('click', () => { S.cart = {}; S.preset = null; render(true); });

/* ---------- tables ---------- */
function paid() {
  const rs = V.rows.filter(r => r.unit_price && r.official && r.tier !== 'rejected' && byId[r.item]).sort((a, b) => a.t - b.t);
  $('#paid').innerHTML = '<thead><tr><th>Item</th><th>When</th><th class="num">Paid</th><th class="num">Average then</th><th class="num">Paid ÷ average</th><th>Read from</th></tr></thead><tbody>' + rs.map(r => `<tr><td>${esc(r.label.replace(/\s*\(.*\)$/, ''))} <small>per ${esc(byId[r.item].unit)}</small></td><td>${r.date.length === 4 ? r.date : MON[+r.date.slice(5, 7) - 1] + ' ' + r.date.slice(0, 4)}</td><td class="num">${usd(r.unit_price)}</td><td class="num">${usd(r.official)}</td><td class="num">${r.ratio.toFixed(2)}×</td><td><small><a href="${esc(r.source_url)}">${esc(r.source)}</a>${r.tier === 'unverified' ? ' (unverified)' : ''}</small></td></tr>`).join('') + '</tbody>';
}
function table(C) {
  const pick = []; for (let i = 0; i < C.cost.length; i++) if (C.cost.length <= 25 || (C.ks + i) % 12 === 0 || i === 0 || i === C.cost.length - 1) pick.push(i);
  const c = (a, i) => a && a[i] != null ? pc(a[i] - 100) : '—';
  $('#datatbl').innerHTML = '<thead><tr><th>Month</th><th class="num">Your cart, a week</th><th class="num">Your cart</th><th class="num">Groceries</th><th class="num">All prices</th><th class="num">Hourly pay</th></tr></thead><tbody>' + pick.map(i => `<tr><td>${mlab(C.ks + i)}</td><td class="num">${usd(C.cost[i])}</td><td class="num">${pc(C.idx[i] - 100)}</td><td class="num">${c(C.food, i)}</td><td class="num">${c(C.all, i)}</td><td class="num">${c(C.pay, i)}</td></tr>`).join('') + '</tbody>';
  $('#tblSub').textContent = `Change since ${mlab(C.ks)}. ${C.cost.length > 25 ? 'Each January and the latest month.' : 'Every month.'}`;
}

/* ---------- 3-D ---------- */
let stage = null, stageTimer = 0, stageSeen = false;
async function stage3d() {
  if (!stageSeen) return; const C = compute(); const host = $('#stage3d');
  if (stage && stage.destroy) stage.destroy(); stage = null; if (!C) { host.innerHTML = ''; return; }
  try { const { mount } = await import('../prices/prices3d.js'); const w = {}; for (const r of C.rows) w[r.it.id] = r.spend / C.total; stage = await mount(host, { data: V, items: C.rows.map(r => r.it.id), weights: w, cart: S.cart, view: 'aisle' }); }
  catch (e) { host.innerHTML = '<p style="padding:20px;color:#c3cfdf">The 3-D view needs WebGL. The charts above carry the same numbers.</p>'; }
}
new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { stageSeen = true; io.disconnect(); stage3d(); } }, { rootMargin: '300px' }).observe($('#stage3d'));

/* ---------- render ---------- */
function chips() {
  $('#presets').innerHTML = Object.entries(PRESETS).map(([k, v]) => `<button type="button" data-p="${k}" aria-pressed="${S.preset === k}">${v[0]}</button>`).join('') + `<button type="button" data-p="" aria-pressed="${!S.preset}" onclick="document.getElementById('edit').scrollIntoView({behavior:'smooth'})">My own ✎</button>`;
  $('#windows').innerHTML = WINDOWS.map(([k, n]) => `<button type="button" data-w="${k}" aria-pressed="${S.win === k}">${n}</button>`).join('');
}
$('#presets').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (!b || !b.dataset.p) return; S.preset = b.dataset.p; S.cart = clean(PRESETS[S.preset][1]); render(true); });
$('#windows').addEventListener('click', e => { const b = e.target.closest('button[data-w]'); if (!b) return; S.win = b.dataset.w; render(false); });
function render(cartChanged) {
  save(); chips(); const C = compute(); const warn = $('#warn');
  history.replaceState(null, '', '#c=' + Object.entries(S.cart).map(([k, v]) => k + ':' + v).join(',') + '&w=' + S.win);
  if (!C) { $('#tiles').innerHTML = '<div class="tile hero" style="grid-column:1/-1"><span>Your cart is empty</span><b>$0.00</b><small>Pick a starting cart above or add items below.</small></div>'; ['#line', '#bars', '#heat', '#datatbl', '#lineLegend', '#heatLegend'].forEach(s => $(s).innerHTML = ''); warn.hidden = true; editor(null); stage3d(); return; }
  warn.hidden = !C.late; if (C.late) warn.textContent = `${C.late.name} has no published price before ${mlab(C.late.first)}, so this cart is compared from ${mlab(C.ks)}. Remove it to go further back.`;
  tiles(C); line(C); bars(C); heat(C); editor(C); table(C);
  if (cartChanged !== false) { clearTimeout(stageTimer); stageTimer = setTimeout(stage3d, 700); }
}
paid();
$('#feed').textContent = `Prices through ${mlab(NM - 1)}, read ${V.fetched ? V.fetched.slice(0, 10) : ''}; ${items.length} items priced.`;
let rw = 0; addEventListener('resize', () => { clearTimeout(rw); rw = setTimeout(() => { const C = compute(); if (C) { line(C); bars(C); } }, 150); });
$('#share').addEventListener('click', async () => { const d = { title: document.title, url: location.href }; try { if (navigator.share) await navigator.share(d); else { await navigator.clipboard.writeText(d.url); $('#share').textContent = 'Link copied'; setTimeout(() => $('#share').textContent = 'Share my cart', 1800); } } catch (e) { } });
render(true);
