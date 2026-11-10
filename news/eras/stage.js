/* Three waves: mounts the era player on the stage, the era tabs, full screen, and the "Play this era" links. */
import { mountEras } from './eraswave.js';
const host = document.getElementById('eraswave');
const q = new URLSearchParams(location.search);
const tabs = [...document.querySelectorAll('.ew-eras button')];
const dl = document.querySelector('[data-dl]');
let ctl = null;
function select(k) {
  tabs.forEach(b => b.setAttribute('aria-selected', b.dataset.era === k));
  if (dl) dl.href = `wave-${k}.mp4`;
}
async function start() {
  const era = q.get('era') || 'era1';
  try { ctl = await mountEras(host, { era, rec: q.has('rec'), autoplay: !q.has('rec') && !matchMedia('(prefers-reduced-motion: reduce)').matches, dpr: q.has('rec') ? 1 : null }); window.EW = ctl; select(era); }
  catch (e) { host.innerHTML = '<p style="color:#c3cfdf;padding:24px">This 3-D map needs WebGL, which this browser has turned off.</p>'; console.error(e); }
}
tabs.forEach(b => b.addEventListener('click', () => { if (!ctl) return; select(b.dataset.era); ctl.era(b.dataset.era).then(() => ctl.play()); }));
document.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => {
  if (!ctl) return; select(b.dataset.play); ctl.era(b.dataset.play).then(() => ctl.play());
  host.closest('.ew-stage-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
document.querySelector('[data-full]')?.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else host.requestFullscreen?.(); });
// start when the stage is near the screen (it is at the top, so usually at once)
new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: '200px' }).observe(host);
