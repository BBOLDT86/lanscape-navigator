/* Reel mode: the cards in data-cards, one at a time. Keys: space play/pause, arrows, F full screen, W 16:9, R record mode (no UI).
   URL: ?auto=1 starts at once, ?rec=1 hides the UI and stops at the end (for a recording), ?wide=1 16:9, ?i=3 starts at a card. */
const reel = document.getElementById('reel');
const cards = JSON.parse(reel.dataset.cards || '[]');
const q = new URLSearchParams(location.search);
const stage = document.getElementById('rstage'), prog = document.getElementById('prog');
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const CLS = { done: 's-done', 'in progress': 's-prog', partial: 's-part', 'blocked by courts': 's-block', reversed: 's-rev', 'not attempted': 's-none', kept: 's-done', 'partly kept': 's-part', broken: 's-block', stalled: 's-prog' };
const LAB = { done: 'Done', 'in progress': 'In progress', partial: 'Partial', 'blocked by courts': 'Blocked by courts', reversed: 'Reversed', 'not attempted': 'Not attempted', kept: 'Kept', 'partly kept': 'Partly kept', broken: 'Broken', stalled: 'Stalled' };
const COLS = { done: '#EBD08E', 'in progress': '#A7843A', partial: '#6B5A2C', 'blocked by courts': '#E8705A', reversed: '#6F7D90', 'not attempted': 'transparent' };
const mast = `<span class="mast"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#15243B"/><circle cx="32" cy="32" r="21" fill="none" stroke="#D6B25E" stroke-width="6" stroke-dasharray="19 3"/><path d="M32 32 L46 14" stroke="#F5F7F6" stroke-width="5" stroke-linecap="round"/></svg>The Watch · The Mandate</span>`;
const src = c => c.src && (c.src.url || c.src.publisher) ? `<p class="src">Source: ${c.src.url ? `<a href="${esc(c.src.url)}" rel="noopener">${esc(c.src.publisher || c.src.title || new URL(c.src.url).hostname)}</a>` : esc(c.src.publisher)}${c.src.date ? ', ' + esc(c.src.date) : ''}</p>` : (c.srcs ? `<p class="src">${esc(c.srcs)}</p>` : '');
function render(c) {
  const k = c.kind || 'fact';
  if (k === 'title') return `<div class="card title">${mast}<span class="k">${esc(c.kicker || '')}</span><h2>${esc(c.title || '')}</h2><p>${esc(c.text || '')}</p></div>`;
  if (k === 'stat') return `<div class="card">${mast}<span class="k">${esc(c.kicker || '')}</span><div class="big${c.grim ? ' r' : ''}">${esc(c.big)}</div><p>${esc(c.text || '')}</p>${src(c)}</div>`;
  if (k === 'quote') return `<div class="card">${mast}<span class="k">${esc(c.kicker || '')}</span>${c.status ? `<span class="pill ${CLS[c.status] || ''}">${esc(LAB[c.status] || c.status)}</span>` : ''}<blockquote>“${esc(c.quote)}”<cite>${esc(c.cite || '')}</cite></blockquote><p>${esc(c.text || '')}</p>${src(c)}</div>`;
  if (k === 'bars') { const tot = Object.values(c.counts || {}).reduce((a, b) => a + b, 0) || 1; return `<div class="card">${mast}<span class="k">${esc(c.kicker || '')}</span><h2>${esc(c.title || '')}</h2><div class="bars">${Object.entries(c.counts || {}).map(([s, n]) => `<i style="width:${100 * n / tot}%;background:${COLS[s] || '#8494a9'};${s === 'not attempted' ? 'box-shadow:inset 0 0 0 1.5px #8494a9' : ''}"></i>`).join('')}</div><ul class="leg">${Object.entries(c.counts || {}).map(([s, n]) => `<li><i style="background:${COLS[s] || '#8494a9'};${s === 'not attempted' ? 'box-shadow:inset 0 0 0 1.5px #8494a9' : ''}"></i>${esc(LAB[s] || s)} <b>${n}</b></li>`).join('')}</ul><p>${esc(c.text || '')}</p>${src(c)}</div>`; }
  if (k === 'end') return `<div class="card end">${mast}<span class="k">${esc(c.kicker || 'The Watch')}</span><h2>${esc(c.title || '')}</h2><p>${esc(c.text || '')}</p></div>`;
  return `<div class="card">${mast}<span class="k">${esc(c.kicker || '')}</span>${c.status ? `<span class="pill ${CLS[c.status] || ''}">${esc(LAB[c.status] || c.status)}</span>` : ''}<h2>${esc(c.title || '')}</h2><p>${esc(c.text || '')}</p>${src(c)}</div>`;
}
stage.innerHTML = cards.map(render).join('');
prog.innerHTML = cards.map(() => '<i></i>').join('');
const els = [...stage.children], bars = [...prog.children];
let i = Math.max(0, Math.min(cards.length - 1, +(q.get('i') || 0))), playing = q.get('auto') === '1' || !q.has('auto'), t0 = performance.now(), raf;
const dur = c => (c.dur || (c.kind === 'title' ? 5 : c.kind === 'quote' ? 8 : c.kind === 'bars' ? 8 : 6.5)) * 1000;
const rec = q.get('rec') === '1'; if (rec) reel.classList.add('rec');
if (q.get('wide') === '1') { reel.classList.add('wide'); document.getElementById('rwide').setAttribute('aria-pressed', 'true'); }
function show(n, dir = 1) {
  els.forEach((el, j) => { el.classList.toggle('on', j === n); el.classList.toggle('off', j < n); });
  bars.forEach((b, j) => { b.classList.toggle('done', j < n); b.style.setProperty('--p', j === n ? 0 : j < n ? 1 : 0); });
  i = n; t0 = performance.now();
}
function tick(now) {
  if (playing) {
    const p = (now - t0) / dur(cards[i]);
    bars[i] && bars[i].style.setProperty('--p', Math.min(1, p));
    if (p >= 1) { if (i + 1 < cards.length) show(i + 1); else if (rec) { playing = false; reel.dataset.done = '1'; } else show(0); }
  }
  raf = requestAnimationFrame(tick);
}
const playBtn = document.getElementById('rplay');
const setPlay = v => { playing = v; t0 = performance.now() - (playing ? 0 : 0); playBtn.textContent = playing ? 'Pause' : 'Play'; playBtn.setAttribute('aria-pressed', String(playing)); };
playBtn.addEventListener('click', () => setPlay(!playing));
document.getElementById('rnext').addEventListener('click', () => show(Math.min(cards.length - 1, i + 1)));
document.getElementById('rprev').addEventListener('click', () => show(Math.max(0, i - 1)));
document.getElementById('rwide').addEventListener('click', e => { const on = reel.classList.toggle('wide'); e.currentTarget.setAttribute('aria-pressed', String(on)); });
document.getElementById('rfs').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else reel.requestFullscreen?.(); });
stage.addEventListener('click', ev => { const r = stage.getBoundingClientRect(); if (ev.target.closest('a')) return; (ev.clientX - r.left) < r.width * 0.3 ? show(Math.max(0, i - 1)) : show(Math.min(cards.length - 1, i + 1)); });
let ty = null; stage.addEventListener('touchstart', e => ty = e.touches[0].clientY, { passive: true }); stage.addEventListener('touchend', e => { if (ty === null) return; const d = e.changedTouches[0].clientY - ty; if (d < -40) show(Math.min(cards.length - 1, i + 1)); else if (d > 40) show(Math.max(0, i - 1)); ty = null; }, { passive: true });
document.addEventListener('keydown', e => {
  if (e.key === ' ') { e.preventDefault(); setPlay(!playing); }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') show(Math.min(cards.length - 1, i + 1));
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') show(Math.max(0, i - 1));
  if (e.key === 'f' || e.key === 'F') document.getElementById('rfs').click();
  if (e.key === 'w' || e.key === 'W') document.getElementById('rwide').click();
  if (e.key === 'r' || e.key === 'R') reel.classList.toggle('rec');
});
show(i); setPlay(playing); raf = requestAnimationFrame(tick);
