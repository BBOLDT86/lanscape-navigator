/* The Mandate: the pages' interactive parts — filters, the share button, the hover layer on the indexed price chart,
   the video cards (YouTube's privacy-enhanced player, loaded on tap) and the 3-D stage's controls. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* sharing */
$$('[data-share]').forEach(b => b.addEventListener('click', async () => {
  const data = { title: document.title, text: ($('meta[name=description]') || {}).content || '', url: location.href };
  try { if (navigator.share) { await navigator.share(data); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(location.href); b.textContent = 'Link copied'; setTimeout(() => b.textContent = 'Share', 1600); } catch (e) { prompt('Copy the link', location.href); }
}));

/* filters: every .filters button narrows the rows that follow by a data attribute; several groups AND together */
$$('.filters').forEach(bar => {
  const state = {};
  const scope = bar.closest('main') || document;
  const targets = () => $$('.row, .pcard, .dep, .tev', scope);
  const count = $('.fcount', bar);
  const apply = () => {
    let shown = 0;
    targets().forEach(el => {
      const ok = Object.entries(state).every(([k, v]) => {
        if (!v) return true;
        const have = el.dataset[k];
        if (have === undefined) return true; // another kind of row on the page
        return k === 'officials' ? have.split('|').includes(v) : have === v;
      });
      el.hidden = !ok; if (ok) shown++;
    });
    $$('.tmonth', scope).forEach(m => { m.hidden = !$$('.tev:not([hidden])', m).length; });
    $$('.chap', scope).forEach(c => { const rows = $$('.row', c); if (rows.length) c.hidden = !rows.some(r => !r.hidden); });
    if (count) count.textContent = Object.values(state).some(Boolean) ? `${shown} shown` : '';
  };
  $$('button[data-f]', bar).forEach(btn => btn.addEventListener('click', () => {
    const k = btn.dataset.f; state[k] = btn.dataset.v;
    $$(`button[data-f="${k}"]`, bar).forEach(x => x.setAttribute('aria-pressed', x === btn ? 'true' : 'false'));
    apply();
  }));
  // a #hash that names a row opens its chapter and scrolls
  if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) { const d = t.closest('details'); if (d) d.open = true; setTimeout(() => t.scrollIntoView({ block: 'start' }), 50); } }
});

/* the indexed chart's hover layer: a crosshair with every series' value on the nearest date */
$$('.idxfig').forEach(fig => {
  let series; try { series = JSON.parse(fig.dataset.series); } catch (e) { return; }
  const svg = $('svg', fig), hover = $('.hover', svg), tip = $('.tip', fig);
  if (!svg || !hover || !tip) return;
  const W = +fig.dataset.w, H = +fig.dataset.h, pad = +fig.dataset.pad, padl = +fig.dataset.padl, lo = +fig.dataset.lo, hi = +fig.dataset.hi;
  const x0 = new Date(fig.dataset.x0 + 'T00:00:00Z'), x1 = new Date(fig.dataset.x1 + 'T00:00:00Z'), span = Math.max(1, (x1 - x0) / 864e5);
  const keys = Object.keys(series);
  const sx = d => padl + (W - padl - pad) * ((new Date(d + 'T00:00:00Z') - x0) / 864e5) / span;
  const sy = v => H - pad - (H - 2 * pad) * (v - lo) / (hi - lo || 1);
  const dots = keys.map((k, i) => { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', '4'); c.setAttribute('class', 'c' + i); c.style.fill = getComputedStyle(document.documentElement).getPropertyValue('--c' + i); hover.appendChild(c); return c; });
  const line = $('.x', hover);
  const nearest = (pts, day) => { let best = pts[0], bd = Infinity; for (const p of pts) { const d = Math.abs(new Date(p[0] + 'T00:00:00Z') - day); if (d < bd) { bd = d; best = p; } } return best; };
  const fmt = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const move = ev => {
    const r = svg.getBoundingClientRect(); const px = (ev.clientX - r.left) / r.width * W;
    const day = new Date(x0.getTime() + Math.max(0, Math.min(1, (px - padl) / (W - padl - pad))) * span * 864e5);
    let rows = '', xx = null, date = null;
    keys.forEach((k, i) => { const p = nearest(series[k], day); if (!p) return; const x = sx(p[0]), y = sy(p[1]); if (xx === null) { xx = x; date = p[0]; } dots[i].setAttribute('cx', x); dots[i].setAttribute('cy', y); rows += `<div><i style="background:var(--c${i})"></i>${k} <b style="display:inline">${p[1].toFixed(0)}</b> <span class="muted">${(p[1] - 100) >= 0 ? '+' : ''}${(p[1] - 100).toFixed(0)}%</span></div>`; });
    if (xx === null) return;
    line.setAttribute('x1', xx); line.setAttribute('x2', xx); hover.hidden = false;
    tip.innerHTML = `<b>${fmt(date)}</b>${rows}`; tip.hidden = false;
    const wrap = fig.querySelector('.idxwrap').getBoundingClientRect();
    const left = (xx / W) * wrap.width; tip.style.left = Math.min(wrap.width - tip.offsetWidth - 4, Math.max(4, left + 12)) + 'px'; tip.style.top = '8px';
  };
  svg.addEventListener('pointermove', move); svg.addEventListener('pointerleave', () => { hover.hidden = true; tip.hidden = true; });
});

/* videos: the poster until the reader taps, then YouTube's privacy-enhanced player */
$$('.vcard[data-yt]').forEach(card => $('.vposter', card)?.addEventListener('click', () => {
  const f = document.createElement('iframe');
  f.src = `https://www.youtube-nocookie.com/embed/${card.dataset.yt}?autoplay=1&rel=0`;
  f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'; f.allowFullscreen = true; f.title = $('.vmeta b', card)?.textContent || 'Video';
  $('.vposter', card).replaceWith(f);
}));

/* the 3-D stage's bar (mandate3d.js sets window.M3D when it has mounted) */
const stage = $('#stage');
if (stage) {
  const play = $('#playBtn'), fs = $('#fsBtn'), fsClose = $('#fsClose'), hide = $('#hideHud');
  const ctl = () => window.M3D;
  const label = () => { const c = ctl(); if (!c || !play) return; play.querySelector('span').textContent = c.playing ? 'Pause' : 'Play'; play.setAttribute('aria-pressed', c.playing ? 'true' : 'false'); };
  play?.addEventListener('click', () => { const c = ctl(); if (!c) return; c.playing ? c.pause() : c.play(); label(); });
  setInterval(label, 600);
  $$('[data-view]').forEach(b => b.addEventListener('click', () => { const c = ctl(); if (!c) return; $$('[data-view]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); c.setView(b.dataset.view); label(); }));
  const setFs = on => { stage.classList.toggle('is-fs', on); document.body.style.overflow = on ? 'hidden' : ''; window.dispatchEvent(new Event('resize')); };
  fs?.addEventListener('click', async () => { try { if (stage.requestFullscreen) { await stage.requestFullscreen(); return; } } catch (e) { } setFs(true); });
  fsClose?.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else setFs(false); });
  document.addEventListener('fullscreenchange', () => setFs(!!document.fullscreenElement));
  hide?.addEventListener('click', () => $('#m3d')?.classList.toggle('m3d-clean'));
  document.addEventListener('keydown', e => {
    if (e.target !== document.body) return;
    if (e.key === 'Escape' && stage.classList.contains('is-fs') && !document.fullscreenElement) setFs(false);
    if (e.key === ' ') { e.preventDefault(); const c = ctl(); if (c) { c.playing ? c.pause() : c.play(); label(); } }
    if (e.key === 'h' || e.key === 'H') $('#m3d')?.classList.toggle('m3d-clean');
    if (e.key === 'f' || e.key === 'F') fs?.click();
  });
}
/* The Pulse: reader counts (news/pulse/pulse.js) */ (function(){try{if(!window.__pulse&&!document.querySelector('script[src*="pulse/pulse.js"]')){var s=document.createElement('script');s.defer=true;s.src='/lanscape-navigator/news/pulse/pulse.js';document.head.appendChild(s);}}catch(e){}})();
