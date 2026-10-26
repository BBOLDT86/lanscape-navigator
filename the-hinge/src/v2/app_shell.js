/* =========================================================== shell */
const TABS = [['brief', 'Briefing'], ['brazil', 'Brazil'], ['senate', 'Senate'], ['house', 'House'], ['ohio', 'Ohio'], ['markets', 'Markets'], ['money', 'Money'], ['history', 'History'], ['info', 'Information age'], ['lab', 'Swing Lab'], ['tracker', 'Tracker'], ['method', 'Method'], ['sources', 'Sources']];
const VIEWS = { brief: viewBrief, brazil: viewBrazil, senate: viewSenate, house: viewHouse, ohio: viewOhio, markets: viewMarkets, money: viewMoney, history: viewHistory, info: viewInfo, lab: viewLab, tracker: viewTracker, method: viewMethod, sources: viewSources };
let ACTIVE = (location.hash || '').replace('#', '');
if (!VIEWS[ACTIVE]) ACTIVE = LS.get('tab', 'brief'); if (!VIEWS[ACTIVE]) ACTIVE = 'brief';
function buildTabs() {
  const t = $('#tabs'); t.replaceChildren();
  TABS.forEach(([k, label], i) => {
    const b = el('button', { class: 'tab', role: 'tab', 'aria-selected': k === ACTIVE ? 'true' : 'false', id: 'tab-' + k }, label);
    b.addEventListener('click', () => { ACTIVE = k; LS.set('tab', k); history_replace(k); buildTabs(); rerenderView(); window.scrollTo({ top: Math.min(window.scrollY, $('.nav').offsetTop), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
    t.append(b);
  });
}
function history_replace(k) { try { window.history.replaceState(null, '', '#' + k); } catch (e) { } }
function rerenderView() {
  CHARTS = [];
  const sec = el('section', { class: 'view on', role: 'tabpanel', 'aria-labelledby': 'tab-' + ACTIVE });
  try { sec.append(VIEWS[ACTIVE]()); } catch (e) { console.error(e); sec.append(el('div', { class: 'empty', text: 'This view hit an error: ' + e.message })); }
  sec.append(el('p', { class: 'foot-note' }, `The Hinge. Data gathered ${fdy(BASE_DATE)}; model run for ${fdy(RES.asOf)} with ${RES.sim.N.toLocaleString()} simulations${RES.sim.conditioned ? ' (conditioned on ' + RES.nCalls + ' called race' + (RES.nCalls === 1 ? '' : 's') + ')' : ''}. Not affiliated with any campaign, party or exchange. Nothing here is betting or investment advice.`));
  $('#main').replaceChildren(sec);
  requestAnimationFrame(drawCharts);
}
function header() {
  const today = todayISO(); const left = E.daysBetween(today, ELECTION);
  $('#countdown').replaceChildren(el('b', { text: left > 0 ? String(left) : left === 0 ? 'Today' : 'Done' }), el('span', { text: left > 0 ? 'day' + (left === 1 ? '' : 's') + ' to Election Day' : left === 0 ? 'is Election Day' : 'Election Day has passed' }));
  const nU = userPolls.length;
  $('#stamp').textContent = `Data gathered ${fdy(BASE_DATE)}: ${D.polls.length} polls${nU ? ' plus ' + nU + ' of yours' : ''}, bias lens “${S.lens === 'custom' ? 'custom' : D.lenses[S.lens].label}”${isDefaultSettings() ? '' : ', your own settings'}${RES.nCalls ? ', ' + RES.nCalls + ' race(s) called' : ''}.`;
  renderHero();
}
function rerender() {
  const m = $('#main'); m.classList.add('busy');
  setTimeout(() => {
    runModel(); header(); rerenderView(); m.classList.remove('busy');
    if (DRAWER && DRAWER.kind === 'race') renderRaceDrawer(DRAWER.id);
  }, 10);
}
function initTheme() {
  const saved = LS.get('theme', null); if (saved) document.documentElement.setAttribute('data-theme', saved);
  $('#btnTheme').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); LS.set('theme', next); readPalette(); renderHero(); rerenderView();
    if (DRAWER && DRAWER.kind === 'race') renderRaceDrawer(DRAWER.id);
  });
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readPalette(); rerenderView(); }); } catch (e) { }
}
function init() {
  readPalette(); initTheme(); buildTabs();
  $('#btnSettings').addEventListener('click', openSettings);
  $('#scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  let rt = null; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawCharts, 150); });
  runModel(); header(); rerenderView();
  mkStart();
  window.__HINGE = { get RES() { return RES; }, S, rerender, MK, mkRefresh };
}
init();
})();
