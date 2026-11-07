/* The House, seat by seat: the seat card under the hemicycle, note rows in the tables, share. Reads data/house/seats.json
   and data/house/notes.json (tools/house.py, tools/house_write.py). */
const $ = s => document.querySelector(s);
const PAGE = window.HOUSE_PAGE || {};
const NUM = new Intl.NumberFormat('en-US');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtM = v => v == null ? '–' : `<span class="${v > 0 ? 'b' : v < 0 ? 'r' : ''}">${v > 0 ? 'D+' : v < 0 ? 'R+' : 'Even '}${Math.abs(v).toFixed(1)}</span>`;
const usd = v => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`;

document.querySelector('[data-share]')?.addEventListener('click', async ev => {
  const b = ev.currentTarget; const data = { title: document.title, text: PAGE.shareText || document.title, url: PAGE.url || location.href };
  try { if (navigator.share) { await navigator.share(data); return; } } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(data.url); b.textContent = 'Link copied'; setTimeout(() => b.textContent = 'Share', 1600); } catch (e) { location.href = data.url; }
});

const seatsP = fetch('data/house/seats.json').then(r => r.json());
const notesP = fetch('data/house/notes.json').then(r => r.ok ? r.json() : { notes: {} }).catch(() => ({ notes: {} }));

function numsHTML(s) {
  const cands = (s.cands || []).map(c => `${esc(c[0])} (${esc(c[1])}) ${NUM.format(c[2])}`).join(' · ');
  return `<p class="nums"><b>${esc(s.won || 'Not called')}</b>${s.p ? ` (${s.p}) ${fmtM(s.margin)}` : ''} on ${NUM.format(s.t)} votes, ${s.e != null ? Math.round(s.e) : '–'}% counted${s.called ? `; called ${esc(s.called)} ET` : ''}<br>${cands}${s.cmove != null ? `<br>The district’s counties moved ${s.cmove > 0 ? '+' : ''}${s.cmove} since 2024` : ''}${s.ie_d || s.ie_r ? `<br>Outside money: ${usd(s.ie_d)} for the D side, ${usd(s.ie_r)} for the R side` : ''}${s.flip ? `<br><b>Flipped:</b> the incumbent, ${esc(s.inc)}, lost` : ''}</p>`;
}
function noteHTML(note, id, hasPiece) {
  const link = hasPiece ? ` <a href="house-${id.toLowerCase()}.html">The piece on this seat ›</a>` : '';
  if (note) return `<div class="note">${note.t.split(/\n\s*\n/).map(p => `<p>${esc(p)}</p>`).join('')}</div><p class="meta">Written by Claude (Opus 5.5) from AP’s count as of ${new Date(note.asOf).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} ET; rewritten when the count moves.${link}</p>`;
  return `<div class="note"><p class="soon">The note on this seat is being written.</p></div>${link ? `<p class="meta">${link}</p>` : ''}`;
}
let current = null;
async function show(id) {
  const card = $('#seatCard'); const S = await seatsP; const s = S.seats[id]; if (!card || !s) return;
  current = id; card.hidden = false;
  document.querySelectorAll('.hemi .seat.on').forEach(c => c.classList.remove('on')); document.querySelector(`.hemi .seat[data-id="${id}"]`)?.classList.add('on');
  card.innerHTML = `<button type="button" class="cx" aria-label="Close">×</button><div><h3><small>The House</small>${esc(s.label)}</h3>${numsHTML(s)}</div><div><div class="note"><p class="soon">Loading…</p></div></div>`;
  card.querySelector('.cx').addEventListener('click', () => { card.hidden = true; current = null; document.querySelectorAll('.hemi .seat.on').forEach(c => c.classList.remove('on')); });
  const N = await notesP; if (current !== id) return;
  card.querySelector('div:last-child').innerHTML = noteHTML(N.notes[id], id, (S.pieces || []).includes(id));
  const r = card.getBoundingClientRect(); if (r.bottom > innerHeight) card.scrollIntoView({ block: 'end', behavior: 'smooth' });
}
document.querySelectorAll('.hemi .seat').forEach(c => { c.addEventListener('click', () => show(c.dataset.id)); c.addEventListener('keydown', ev => { if (ev.key === 'Enter') show(c.dataset.id); }); c.setAttribute('tabindex', '0'); });
document.querySelectorAll('table.seats tbody').forEach(body => body.addEventListener('click', async ev => {
  const tr = ev.target.closest('tr.pick'); if (!tr || ev.target.closest('a')) return;
  const open = tr.nextElementSibling; if (open && open.classList.contains('noterow')) { open.remove(); return; }
  body.querySelectorAll('tr.noterow').forEach(x => x.remove());
  const nr = document.createElement('tr'); nr.className = 'noterow'; nr.innerHTML = `<td colspan="7"><p>Loading…</p></td>`; tr.after(nr);
  const [S, N] = await Promise.all([seatsP, notesP]); const id = tr.dataset.id;
  if (nr.parentNode) nr.firstElementChild.innerHTML = noteHTML(N.notes[id], id, (S.pieces || []).includes(id));
}));
if (location.hash.startsWith('#seat=')) show(decodeURIComponent(location.hash.slice(6)));
