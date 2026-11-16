/* The Checkout: mounts the 3-D stage, the ledger filters and the share button. */
const $ = (s, r = document) => r.querySelector(s);
const q = new URLSearchParams(location.search);
const host = $('#checkout3d');
if (host) new IntersectionObserver(async (es, io) => {
  if (!es[0].isIntersecting) return; io.disconnect();
  try {
    const { mount } = await import('./prices3d.js');
    const api = await mount(host, { view: q.get('view') === 'map' ? 'map' : 'aisle', rec: q.has('rec'), autoplay: !q.has('rec') });
    if (api.ready && q.get('item')) api.focus(q.get('item'));
    document.querySelectorAll('[data-see]').forEach(a => a.addEventListener('click', e => { if (!api.ready) return; e.preventDefault(); api.setView('aisle'); api.focus(a.dataset.see); api.seek(1); host.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
  } catch (e) { host.innerHTML = '<p style="color:#c3cfdf;padding:24px">The 3-D view needs WebGL, which this browser has turned off. Every number is in the tables below.</p>'; console.error(e); }
}, { rootMargin: '200px' }).observe(host);

document.querySelectorAll('.filters').forEach(f => f.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  f.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
  const k = b.dataset.f, list = document.getElementById(f.dataset.for);
  list.querySelectorAll('[data-g]').forEach(n => { n.hidden = !(k === 'all' || k.includes(n.dataset.g)); });
}));

$('[data-share]')?.addEventListener('click', async () => {
  const d = { title: document.title, text: $('meta[name=description]')?.content || '', url: location.href.split('#')[0] };
  try { if (navigator.share) await navigator.share(d); else { await navigator.clipboard.writeText(d.url); const b = $('[data-share]'); b.textContent = 'Link copied'; setTimeout(() => b.textContent = 'Share', 1800); } } catch (e) { }
});
if (!document.querySelector('script[src*="pulse/pulse.js"]')) { const s = document.createElement('script'); s.defer = true; s.src = '/lanscape-navigator/news/pulse/pulse.js'; document.head.appendChild(s); }
