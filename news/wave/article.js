/* The wave: the article pages' interactive parts (the visual's controls, the county explorer, sharing) */
import { mount } from './wave.js';

const $ = (s, el = document) => el.querySelector(s);
const NUM = new Intl.NumberFormat('en-US');
const PAGE = window.WAVE_PAGE || {};
const F2S = { '01': 'AL', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY' };

/* the visual and its bar */
const stage = $('#stage'), bar = $('#vizbar');
const opts = Object.assign({ mode: 'full', autoplay: true, loop: false, hud: true, interactive: true }, PAGE.viz || {});
let W = null;
const scrub = $('#scrub'), playBtn = $('#playBtn'), fsBtn = $('#fsBtn'), fsClose = $('#fsClose');
opts.onTime = p => { if (scrub && !scrub.matches(':active')) scrub.value = Math.round(p * 1000); };
opts.onReady = ctl => { W = ctl; window.WAVE = ctl; setPlayLabel(); };
opts.onPick = c => showCounty(c.id);
opts.fsTarget = stage;
mount($('#wave'), opts).catch(e => { stage.classList.add('nogl'); stage.insertAdjacentHTML('beforeend', `<div class="nogl-msg"><b>The 3-D map needs WebGL.</b><span>Your browser could not start it. The write-up below has every number the picture shows.</span></div>`); console.warn(e); });
function setPlayLabel() { if (!playBtn || !W) return; playBtn.querySelector('span').textContent = W.playing ? 'Pause' : 'Play'; playBtn.setAttribute('aria-pressed', W.playing ? 'true' : 'false'); }
if (playBtn) playBtn.addEventListener('click', () => { if (!W) return; if (W.playing) W.pause(); else W.play(); setPlayLabel(); });
setInterval(setPlayLabel, 500);
$('#replayBtn')?.addEventListener('click', () => W && W.replay());
scrub?.addEventListener('input', () => { if (!W) return; W.pause(); W.seek(+scrub.value / 1000); setPlayLabel(); });
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', async () => {
  if (!W) return; const v = b.dataset.view;
  document.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  await W.setView(v); setPlayLabel();
  $('#raceWrap') && ($('#raceWrap').hidden = v !== 'wave');
  document.querySelectorAll('[data-viewtext]').forEach(x => x.hidden = x.dataset.viewtext !== v);
}));
$('#raceSel')?.addEventListener('change', e => { if (!W) return; const t = W.setRace(e.target.value); const n = $('#raceNote'); if (n) n.textContent = `${NUM.format(t.left)} of ${NUM.format(t.counted)} counties moved left, ${NUM.format(t.right)} right`; });
fsBtn?.addEventListener('click', () => W && W.fullscreen(true));
fsClose?.addEventListener('click', () => W && W.fullscreen(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && W && W.isFs()) W.fullscreen(false); if (e.key === ' ' && document.activeElement === document.body && W) { e.preventDefault(); if (W.playing) W.pause(); else W.play(); setPlayLabel(); } });
$('#hideHud')?.addEventListener('click', () => { const r = $('#wave'); r.classList.toggle('wave-clean'); });

/* sharing */
async function share() {
  const d = { title: document.title, text: PAGE.shareText || document.title, url: PAGE.url || location.href };
  try { if (navigator.share) { await navigator.share(d); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(d.url); toast('Link copied'); } catch (e) { prompt('Copy this link', d.url); }
}
document.querySelectorAll('[data-share]').forEach(b => b.addEventListener('click', share));
function toast(m) { let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:var(--paper);padding:8px 14px;border-radius:999px;font-size:14px;z-index:99'; document.body.appendChild(t); } t.textContent = m; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, 1800); }

/* the county notes: data/notes/<ST>.json, one file per state, written by Claude from the count (tools/write.py) */
const shiftP = fetch('data/shift.json').then(r => r.json());
const noteFiles = new Map(), NOTES = new Set(PAGE.notes || []), STATE_PAGES = PAGE.statePages || {};
const STNAME = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };
const WORD = { LA: 'Parish', AK: 'Borough' };
function noteFile(st) {
  if (!noteFiles.has(st)) noteFiles.set(st, NOTES.has(st) ? fetch(`data/notes/${st}.json`).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null));
  return noteFiles.get(st);
}
async function noteFor(st, f) { const d = await noteFile(st); return d && d.notes ? d.notes[f] || null : null; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtM = v => v == null ? '–' : `<span class="${v > 0 ? 'b' : v < 0 ? 'r' : ''}">${v > 0 ? 'D+' : v < 0 ? 'R+' : 'Even '}${Math.abs(v).toFixed(1)}</span>`;
function noteHTML(note, st) {
  if (note) return `<div class="note">${note.t.split(/\n\s*\n/).map(p => `<p>${esc(p)}</p>`).join('')}</div><p class="meta">Written by Claude (Opus 5.5) from the count as of ${new Date(note.asOf).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} ET, the 2024 baseline and Census ACS 2023 figures; rewritten when the count moves.${STATE_PAGES[st] && PAGE.st !== st ? ` <a href="${STATE_PAGES[st]}.html">The ${STNAME[st] || st} piece ›</a>` : ''}</p>`;
  return `<div class="note"><p class="soon">${NOTES.has(st) ? 'No note for this county yet.' : `Notes for ${STNAME[st] || st}’s counties are being written.`}</p></div>${STATE_PAGES[st] && PAGE.st !== st ? `<p class="meta"><a href="${STATE_PAGES[st]}.html">The ${STNAME[st] || st} piece ›</a></p>` : ''}`;
}
function numsHTML(S, f) {
  const v = S.counties[f]; if (!v) return '<p class="nums">No 2026 count reported yet.</p>';
  const st = F2S[f.slice(0, 2)], stt = S.states[st], race = stt && stt.races && stt.races[v[4]];
  return `<p class="nums"><b class="${v[2] >= 0 ? 'b' : 'r'}">${v[2] >= 0 ? 'Moved left' : 'Moved right'} ${Math.abs(v[2]).toFixed(1)} points</b><br>2024 Harris–Trump: ${fmtM(v[0])} on ${NUM.format(v[10])} votes<br>2026 ${race ? (race.key === 'S' ? 'Senate' : 'Governor') + ` (${race.dem.split(' ').pop()} v ${race.rep.split(' ').pop()})` : ''}: ${fmtM(v[1])} on ${NUM.format(v[7])} votes<br>${v[3] != null ? Math.round(v[3]) : '–'}% of the expected vote counted</p>`;
}
let cardFor = null;
async function showCounty(f) {
  const card = $('#countyCard'); if (!card) return;
  const S = await shiftP; const st = F2S[f.slice(0, 2)] || ''; const name = S.names[f] || f; cardFor = f;
  card.hidden = false;
  card.innerHTML = `<button type="button" class="cx" aria-label="Close">×</button><div class="cc"><div><h3><small>${esc(STNAME[st] || st)}</small>${esc(name)} ${WORD[st] || 'County'}</h3>${numsHTML(S, f)}</div><div><div class="note"><p class="soon">Loading…</p></div></div></div>`;
  card.querySelector('.cx').addEventListener('click', () => { card.hidden = true; cardFor = null; });
  if (!document.fullscreenElement) { const r = card.getBoundingClientRect(); if (r.bottom > innerHeight || r.top < 0) card.scrollIntoView({ block: 'end', behavior: 'smooth' }); }
  const note = await noteFor(st, f); if (cardFor !== f) return;
  card.querySelector('.cc > div:last-child').innerHTML = noteHTML(note, st);
}

/* the county explorer */
const tbl = $('#countyTable');
if (tbl) {
  fetch('data/shift.json').then(r => r.json()).then(S => {
    const states = PAGE.states ? new Set(PAGE.states) : null;
    const rows = Object.entries(S.counties).map(([f, v]) => ({ f, n: S.names[f] || f, st: F2S[f.slice(0, 2)] || '', m24: v[0], m26: v[1], sh: v[2], e: v[3], race: v[4], t: v[7] })).filter(r => !states || states.has(r.st));
    const q = $('#q'), sel = $('#sortSel'), body = tbl.querySelector('tbody'), count = $('#tcount');
    const f = v => v == null ? '–' : `<span class="${v > 0 ? 'd' : v < 0 ? 'r' : ''}">${v > 0 ? 'D+' : v < 0 ? 'R+' : ''}${Math.abs(v).toFixed(1)}</span>`;
    let sort = PAGE.sort || 'sh-desc';
    function draw() {
      const s = (q && q.value.trim().toLowerCase()) || '';
      let list = rows.filter(r => !s || r.n.toLowerCase().includes(s) || r.st.toLowerCase() === s);
      const [k, dir] = sort.split('-'); const m = dir === 'desc' ? -1 : 1;
      list.sort((a, b) => (k === 'n' ? a.n.localeCompare(b.n) : (a[k] - b[k])) * m);
      count.textContent = `${NUM.format(list.length)} counties`;
      body.innerHTML = list.slice(0, 400).map(r => `<tr class="pick" data-f="${r.f}" title="Read this county’s note"><td>${r.n}<small>, ${r.st}</small></td><td>${f(r.m24)}</td><td>${f(r.m26)}<small> ${r.race === 'S' ? 'Sen.' : 'Gov.'}</small></td><td><b class="${r.sh > 0 ? 'd' : 'r'}">${r.sh > 0 ? '+' : ''}${r.sh.toFixed(1)}</b></td><td>${NUM.format(r.t)}</td><td>${r.e != null ? Math.round(r.e) + '%' : '–'}</td></tr>`).join('') + (list.length > 400 ? `<tr><td colspan="6"><small>Showing 400 of ${NUM.format(list.length)}; search to narrow.</small></td></tr>` : '');
    }
    q?.addEventListener('input', draw); sel?.addEventListener('change', () => { sort = sel.value; draw(); });
    body.addEventListener('click', async ev => { // a row opens its note beneath it
      const tr = ev.target.closest('tr.pick'); if (!tr || ev.target.closest('a')) return;
      const open = tr.nextElementSibling; if (open && open.classList.contains('noterow')) { open.remove(); return; }
      body.querySelectorAll('tr.noterow').forEach(x => x.remove());
      const f = tr.dataset.f, st = F2S[f.slice(0, 2)] || '';
      const nr = document.createElement('tr'); nr.className = 'noterow'; nr.innerHTML = `<td colspan="6"><p>Loading…</p></td>`; tr.after(nr);
      const note = await noteFor(st, f); if (nr.parentNode) nr.firstElementChild.innerHTML = noteHTML(note, st);
    });
    tbl.querySelectorAll('th[data-k]').forEach(th => th.addEventListener('click', () => { const k = th.dataset.k; sort = sort === k + '-desc' ? k + '-asc' : k + '-desc'; if (sel) sel.value = sort; draw(); }));
    draw();
    $('#csvBtn')?.addEventListener('click', () => {
      const csv = ['fips,county,state,margin_2024,margin_2026,shift,race,votes_2026,pct_expected'].concat(rows.map(r => [r.f, '"' + r.n.replace(/"/g, '""') + '"', r.st, r.m24, r.m26, r.sh, r.race, r.t, r.e].join(','))).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = (PAGE.slug || 'the-wave') + '-counties.csv'; a.click();
    });
  });
}
