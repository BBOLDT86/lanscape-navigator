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
      body.innerHTML = list.slice(0, 400).map(r => `<tr><td>${r.n}<small>, ${r.st}</small></td><td>${f(r.m24)}</td><td>${f(r.m26)}<small> ${r.race === 'S' ? 'Sen.' : 'Gov.'}</small></td><td><b class="${r.sh > 0 ? 'd' : 'r'}">${r.sh > 0 ? '+' : ''}${r.sh.toFixed(1)}</b></td><td>${NUM.format(r.t)}</td><td>${r.e != null ? Math.round(r.e) + '%' : '–'}</td></tr>`).join('') + (list.length > 400 ? `<tr><td colspan="6"><small>Showing 400 of ${NUM.format(list.length)}; search to narrow.</small></td></tr>` : '');
    }
    q?.addEventListener('input', draw); sel?.addEventListener('change', () => { sort = sel.value; draw(); });
    tbl.querySelectorAll('th[data-k]').forEach(th => th.addEventListener('click', () => { const k = th.dataset.k; sort = sort === k + '-desc' ? k + '-asc' : k + '-desc'; if (sel) sel.value = sort; draw(); }));
    draw();
    $('#csvBtn')?.addEventListener('click', () => {
      const csv = ['fips,county,state,margin_2024,margin_2026,shift,race,votes_2026,pct_expected'].concat(rows.map(r => [r.f, '"' + r.n.replace(/"/g, '""') + '"', r.st, r.m24, r.m26, r.sh, r.race, r.t, r.e].join(','))).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = (PAGE.slug || 'the-wave') + '-counties.csv'; a.click();
    });
  });
}
