/* The quiet sky: mounts the replay with the night's timeline. Used by the page (index.html) and by render.html. */
import { mount, fmtClock } from './airspace3d.js';
const NUM = new Intl.NumberFormat('en-US');
export const STOP = Date.UTC(2026, 10, 13, 20, 54) / 1000, LIFT = Date.UTC(2026, 10, 14, 1, 15) / 1000; // 3:54 p.m. and 8:15 p.m. Eastern (FAA; DOT)
const AT = (h, m) => Date.UTC(2026, 10, 13, h + 5, m) / 1000; // an Eastern (UTC-5) clock time on Nov. 13 as unix seconds

export async function startStage(stage, o = {}) {
  let meta;
  try { meta = await fetch(new URL('data/meta.json', import.meta.url)).then(r => r.json()); }
  catch (e) { stage.innerHTML = '<p class="aq-msg">The flight data did not load. Try again in a moment.</p>'; return null; }
  const us = meta.counts.us, t0 = Date.parse(meta.from_utc) / 1000, f = u => Math.round((u - t0) / meta.step), at = u => us[Math.max(0, Math.min(us.length - 1, f(u)))];
  let lo = 0; us.forEach((v, i) => { if (v < us[lo]) lo = i; });
  const lowU = t0 + lo * meta.step, base = meta.baseline && meta.baseline.us;
  const half = us.findIndex((v, i) => i >= f(STOP) && v <= at(STOP) / 2), quarter = us.findIndex((v, i) => i >= f(STOP) && v <= at(STOP) / 4);
  const clock = i => fmtClock(t0 + i * meta.step);
  // the diversion figures are from The Watch's report on the ground stop (its source 1); the clock times are the Transportation Department's; the counts are this data
  const events = [
    { at: t0, text: 'A Friday afternoon. Each point is one real aircraft, drawn where it was recorded.' },
    { at: AT(15, 36), text: '3:36 p.m. The FAA sees unstable radar and communications links between its control centers.' },
    { at: STOP, text: `3:54 p.m. Nationwide ground stop. Nothing takes off. The ${NUM.format(at(STOP))} aircraft already in the air keep flying.` },
    { at: AT(16, 20), text: 'They land one at a time. Nothing rises to replace them.' },
    half > 0 && { at: t0 + half * meta.step, text: `${clock(half)} Half are down: ${NUM.format(us[half])} left.` },
    quarter > 0 && { at: t0 + quarter * meta.step, text: `${clock(quarter)} Three-quarters are down.${base ? ` A week earlier at this minute: ${NUM.format(base[quarter])} in the air.` : ''}` },
    { at: AT(19, 5), text: '7:05 p.m. At least 827 flights have been diverted; 670 of them turned back to where they started.' },
    { at: LIFT, text: `8:15 p.m. The ground stop is lifted. ${NUM.format(at(LIFT))} aircraft are in the air.` },
    { at: lowU, text: `${fmtClock(lowU)} The low: ${NUM.format(us[lo])} aircraft over the lower 48.` },
    { at: AT(21, 30), text: 'Departures resume, slowly: crews and aircraft are out of place.' },
    { at: AT(22, 45), text: `By 11 p.m., ${NUM.format(us[us.length - 1])} are flying${base ? `, against ${NUM.format(base[base.length - 1])} a week earlier` : ''}.` },
  ].filter(Boolean);
  const full = () => { if (document.fullscreenElement) { document.exitFullscreen(); return; } if (stage.requestFullscreen) stage.requestFullscreen().catch(() => stage.classList.toggle('is-fs')); else stage.classList.toggle('is-fs'); };
  let api = null;
  try {
    api = await mount(stage, { embed: !!o.embed, rec: !!o.rec, autoplay: !o.rec && !matchMedia('(prefers-reduced-motion: reduce)').matches, events, stop: STOP, lift: LIFT, onFull: full, dpr: o.rec ? (o.dpr || 1) : null, vertical: !!o.vertical, dur: o.dur || 64 });
    if (o.rec) stage.classList.add('aq-rec');
    window.AQ = api; window.AQ_READY = true;
  } catch (e) { stage.innerHTML = '<p class="aq-msg">This 3-D replay needs WebGL, which this browser has turned off. The chart on the page shows the same count.</p>'; console.error(e); }
  return { api, meta, t0, us, lo, lowU, base, f, at };
}
