/* The money: the animated flow on the stage (donors -> committees -> races), the HUD, full screen and share. Draws
   data/flow.json (build.py) as an SVG with the links as ribbons whose dashes run from left to right. */
const $ = s => document.querySelector(s);
const PAGE = window.MONEY_PAGE || {};
const usd = v => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`;
const COL = { D: '#7fb7ff', R: '#ff8f6b', M: '#d6b25e', I: '#d6b25e' };

/* share */
$('#shareBtn')?.addEventListener('click', async () => {
  const data = { title: document.title, text: PAGE.shareText || document.title, url: PAGE.url || location.href };
  try { if (navigator.share) { await navigator.share(data); return; } } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(data.url); $('#shareBtn').textContent = 'Link copied'; setTimeout(() => $('#shareBtn').textContent = 'Share', 1600); } catch (e) { location.href = data.url; }
});

const stage = $('#stage');
if (stage) {
  $('#fsBtn')?.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else stage.requestFullscreen?.(); });
  document.addEventListener('fullscreenchange', () => { stage.classList.toggle('fs', !!document.fullscreenElement); draw(); });
  let F = null;
  fetch('data/flow.json').then(r => r.json()).then(f => { F = f; hud(f.totals); draw(); addEventListener('resize', draw); document.fonts?.ready.then(draw); setTimeout(draw, 1200); });

  function hud(t) {
    const h = $('#hud'); if (!h) return;
    const items = [[t.senate, 'outside money in the Senate races'], [`${t.moneyWon} of ${t.moneyWon + t.moneyLost}`, 'decided Senate races went to the side with more money', true], [t.meta + t.google, 'paid straight to Meta and Google'], [t.gads, 'political ads on Google since Jan. 2025']];
    h.innerHTML = `<p class="kicker"><i class="globe"></i>The Watch · Who paid for it</p><h2>Follow the money</h2><div class="nums">${items.map(([v, l, raw]) => `<div><b data-v="${raw ? '' : v}">${raw ? v : '$0'}</b><span>${l}</span></div>`).join('')}</div>`;
    // count up
    const t0 = performance.now();
    const bs = [...h.querySelectorAll('b[data-v]')].filter(b => b.dataset.v !== '');
    const tick = now => { const p = Math.min(1, (now - t0) / 1800), e = 1 - Math.pow(1 - p, 3); bs.forEach(b => b.textContent = usd(+b.dataset.v * e)); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  function draw() {
    if (!F) return;
    const el = $('#flow'); const W = el.clientWidth, H = el.clientHeight; if (!W || !H) return;
    const narrow = W < 720;
    const cols = [[], [], []]; F.nodes.forEach(n => cols[n.col].push(n));
    const padX = narrow ? 8 : 24, colW = narrow ? 112 : Math.min(230, W * 0.22), gapY = narrow ? 4 : 6;
    const two = !cols[0].length; // no donor lists yet: two columns
    const xs = two ? [-9999, W * 0.3 - colW / 2, W - padX - colW - (narrow ? 0 : W * 0.08)] : [padX, W / 2 - colW / 2, W - padX - colW];
    const hudH = $('#hud') ? ($('#hud').getBoundingClientRect().bottom - el.getBoundingClientRect().top) : 0; const top = hudH + (narrow ? 12 : 30), usable = H - top - 16;
    const pos = {};
    cols.forEach((c, ci) => {
      c.sort((a, b) => (a.side === b.side ? b.usd - a.usd : (a.side === 'D' ? -1 : a.side === 'R' ? 1 : 0) - (b.side === 'D' ? -1 : b.side === 'R' ? 1 : 0)));
      const total = c.reduce((s, n) => s + n.usd, 0) || 1; const free = usable - gapY * (c.length - 1); let y = top;
      c.forEach(n => { const h = Math.max(narrow ? 10 : 14, n.usd / total * free); pos[n.id] = { x: xs[ci], y, h, n }; y += h + gapY; });
      // if the column overflowed (minimum heights), squeeze it
      const over = (y - gapY) - (top + usable); if (over > 0) { let yy = top; const k = usable / (y - gapY - top); c.forEach(n => { const p = pos[n.id]; p.h *= k; p.y = yy; yy += p.h + gapY * k; }); }
    });
    // link offsets along each node's edge
    const outY = {}, inY = {};
    F.links.forEach(l => { outY[l.s] = outY[l.s] || 0; inY[l.t] = inY[l.t] || 0; });
    const sumOut = {}, sumIn = {}; F.links.forEach(l => { sumOut[l.s] = (sumOut[l.s] || 0) + l.usd; sumIn[l.t] = (sumIn[l.t] || 0) + l.usd; });
    const links = F.links.filter(l => pos[l.s] && pos[l.t]).sort((a, b) => pos[a.s].y - pos[b.s].y || pos[a.t].y - pos[b.t].y);
    let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">`;
    svg += `<defs><filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    links.forEach((l, i) => {
      const s = pos[l.s], t = pos[l.t]; const ws = l.usd / sumOut[l.s] * s.h, wt = l.usd / sumIn[l.t] * t.h;
      const y0 = s.y + outY[l.s] + ws / 2, y1 = t.y + inY[l.t] + wt / 2; outY[l.s] += ws; inY[l.t] += wt;
      const x0 = s.x + colW, x1 = t.x, cx = (x0 + x1) / 2; const w = Math.max(1.2, (ws + wt) / 2);
      svg += `<path class="link" data-s="${l.s}" data-t="${l.t}" d="M${x0} ${y0} C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}" stroke="${COL[l.side] || COL.M}" stroke-width="${w.toFixed(1)}" style="animation-delay:${-(i * 137 % 2400)}ms;animation-duration:${(2200 + (i * 53) % 900)}ms"/>`;
    });
    Object.values(pos).forEach(p => {
      const n = p.n; const c = COL[n.side] || COL.M; const mark = n.col === 2 ? (n.moneyWon === true ? ' ✓' : n.moneyWon === false ? ' ✗' : '') : '';
      const label = narrow ? n.name.replace(/ (Senate|County)$/, '').slice(0, 18) : n.name.slice(0, 30);
      svg += `<g class="node" data-id="${n.id}" tabindex="0"><rect x="${p.x}" y="${p.y}" width="${colW}" height="${p.h.toFixed(1)}" rx="3" fill="${c}" fill-opacity=".16" stroke="${c}" stroke-opacity=".55"/>`;
      if (p.h >= (narrow ? 11 : 14)) svg += `<text class="nl" x="${p.x + 6}" y="${p.y + Math.min(p.h / 2 + 4, 14)}" fill="#eef3fa">${esc(label)}${mark}</text>`;
      if (p.h >= 30 && !narrow) svg += `<text class="ns" x="${p.x + 6}" y="${p.y + 28}">${esc(usd(n.usd))}${n.sub ? ' · ' + esc(n.sub.slice(0, 28)) : ''}</text>`;
      svg += `<title>${esc(n.name)}: ${usd(n.usd)}${n.sub ? '. ' + esc(n.sub) : ''}${n.col === 1 ? `. Record ${n.won} won, ${n.lost} lost` : ''}</title></g>`;
    });
    if (!narrow) svg += `${two ? '' : `<text class="ch" x="${xs[0]}" y="${top - 8}">DONORS</text>`}<text class="ch" x="${xs[1]}" y="${top - 8}">COMMITTEES</text><text class="ch" x="${xs[2]}" y="${top - 8}">SENATE RACES</text>`;
    svg += '</svg>';
    el.innerHTML = svg;
    // hover: follow one node's money
    const paths = [...el.querySelectorAll('path.link')];
    const focus = id => {
      if (!id) { el.classList.remove('focus'); paths.forEach(p => p.classList.remove('on')); el.querySelectorAll('.node').forEach(g => g.classList.remove('on')); return; }
      el.classList.add('focus'); const on = new Set([id]);
      // the links touching the node, then one more hop: a donor's committees' races, a race's committees' donors
      paths.forEach(p => { const hit = p.dataset.s === id || p.dataset.t === id; p.classList.toggle('on', hit); if (hit) { on.add(p.dataset.s); on.add(p.dataset.t); } });
      if (id.startsWith('d:')) { const cs = paths.filter(p => p.dataset.s === id).map(p => p.dataset.t); paths.forEach(p => { if (cs.includes(p.dataset.s)) { p.classList.add('on'); on.add(p.dataset.t); } }); }
      if (id.startsWith('r:')) { const cs = paths.filter(p => p.dataset.t === id).map(p => p.dataset.s); paths.forEach(p => { if (cs.includes(p.dataset.t)) { p.classList.add('on'); on.add(p.dataset.s); } }); }
      el.querySelectorAll('.node').forEach(g => g.classList.toggle('on', on.has(g.dataset.id)));
    };
    el.querySelectorAll('.node').forEach(g => { g.addEventListener('pointerenter', () => focus(g.dataset.id)); g.addEventListener('focus', () => focus(g.dataset.id)); g.addEventListener('click', ev => { ev.stopPropagation(); focus(g.dataset.id); }); });
    el.addEventListener('pointerleave', () => focus(null)); el.addEventListener('click', () => focus(null));
  }
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
/* The Pulse: reader counts (news/pulse/pulse.js) */ (function(){try{if(!window.__pulse&&!document.querySelector('script[src*="pulse/pulse.js"]')){var s=document.createElement('script');s.defer=true;s.src='/lanscape-navigator/news/pulse/pulse.js';document.head.appendChild(s);}}catch(e){}})();
