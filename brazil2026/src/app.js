/* Brazil 2026 runoff desk — renders window.M (built by build.py) and window.GEO. Bilingual (en/pt). On election night the
   page refetches data/model.json every 60 s and also reads the TSE's own result files from the browser (they are served
   with CORS), so the count on screen is never older than the TSE's latest file even if the Action lags. */
(function () {
  'use strict';
  var M = window.M, GEO = window.GEO;
  var $ = function (id) { return document.getElementById(id); };
  var LS = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  LS.set('watch.br', String(Date.now())); // The Watch (same site) pins the runoff post-mortem on the front for readers who came here
  var lang = LS.get('br26.lang') ||((navigator.language || '').toLowerCase().indexOf('pt') === 0 ? 'pt' : 'en');
  var T = {
    en: { sub: 'Runoff · Lula × Flávio Bolsonaro', pre: 'Before the vote', night: 'LIVE · TSE count', post: 'Final', updated: 'Updated', countStarts: 'Polls close and the TSE count starts Sunday Oct. 25 at 5 p.m. Brasília time (4 p.m. ET, 20:00 UTC). This page then updates itself every minute.',
      declared: '{by} declared {name} elected president', waiting: 'Polls are open until 5 p.m. Brasília time. The TSE count begins right after; the first totals usually appear within minutes.',
      validVotes: '% of valid votes', votes: 'votes', counted: 'of polling sections counted', leads: 'leads', tied: 'tied', pollAvg: 'poll average', market: 'market', round1: '1st round', r2022: '2022 runoff',
      blank: 'blank', nullv: 'null', abst: 'abstention', tseTime: 'TSE file time', noResults: 'No results yet', firstRound: 'First round, Oct. 4', pollsHead: 'Runoff polls', valid: 'valid', margin: 'margin', date: 'field dates', pollster: 'pollster', sample: 'n', link: 'source',
      avgNote: 'Average: simple mean of the valid-vote shares, latest poll per pollster, field work ended in the last 7 days — this desk’s arithmetic, not a published aggregator.', pending: 'Still to come', unverified: 'Reported, not verified',
      map: 'Map', mapResults: 'Results', mapR1: '1st round 2026', map2022: '2022 runoff', mapLegend: 'margin in points', tapState: 'Tap a state for its count, the first round and 2022.', states: 'States', state: 'state', swing: 'vs 1st round', swing22: 'vs 2022',
      chart: 'The count as it came in', chartX: '% of sections counted', markets: 'Prediction markets', marketNote: 'Price of the “wins” contract, read as a probability. Polymarket and Kalshi, as of the time shown; the Action refreshes them every 30 minutes (every 5 minutes during the count).',
      how: 'How the night works', howText: ['Brazil votes on electronic machines in a single Brasília-time window, 8 a.m. to 5 p.m. (7–4 in UTC−4 states, 6–3 in Acre). There is no exit poll.', 'The TSE totals the machines as they upload and publishes a running count from 5 p.m. BRT. The Northeast and the big cities report fast; the Amazon and abroad report last. In 2022 the count reached 99% in about 3 hours and the TSE proclaimed the winner the same evening.', 'Winner = more valid votes. Blank and null votes do not count. This page shows the TSE’s numbers with their file time; the only “declared” it will ever show is the TSE’s own.'],
      news: 'Headlines', newsNote: 'Titles are the outlets’ own.', about: 'About this desk', aboutText: ['Numbers come from the Tribunal Superior Eleitoral’s result files, read directly; polls from the pollsters and the outlets that commissioned them, with TSE registration numbers where known; market prices from Polymarket and Kalshi. Every figure carries its as-of time.', 'The desk never calls the race. A banner appears only when the TSE proclaims a result.'],
      sources: 'Sources', runlog: 'Run log', endorse: 'Endorsed by', mate: 'running mate', incumbent: 'incumbent', showAll: 'Show all {n} polls', showLess: 'Show fewer', region: { N: 'North', NE: 'Northeast', CO: 'Center-West', SE: 'Southeast', S: 'South' }, abroad: 'Abroad', total: 'Brazil', live: 'live', direct: 'read from the TSE by this browser', fromAction: 'from the last automated pull', elected: 'elected', calendar: 'Calendar', turnout: 'turnout', regVoters: 'registered voters' },
    pt: { sub: '2º turno · Lula × Flávio Bolsonaro', pre: 'Antes da votação', night: 'AO VIVO · apuração TSE', post: 'Final', updated: 'Atualizado', countStarts: 'A votação termina e a apuração do TSE começa domingo, 25/10, às 17h (horário de Brasília). A partir daí esta página se atualiza a cada minuto.',
      declared: '{by} proclamou {name} presidente eleito', waiting: 'Votação aberta até as 17h (Brasília). A apuração começa logo depois; os primeiros totais costumam sair em minutos.',
      validVotes: '% dos votos válidos', votes: 'votos', counted: 'das seções totalizadas', leads: 'lidera', tied: 'empate', pollAvg: 'média das pesquisas', market: 'mercado', round1: '1º turno', r2022: '2º turno 2022',
      blank: 'brancos', nullv: 'nulos', abst: 'abstenção', tseTime: 'hora do arquivo TSE', noResults: 'Ainda sem resultados', firstRound: '1º turno, 4 de outubro', pollsHead: 'Pesquisas do 2º turno', valid: 'válidos', margin: 'diferença', date: 'campo', pollster: 'instituto', sample: 'n', link: 'fonte',
      avgNote: 'Média: média simples dos votos válidos, última pesquisa de cada instituto, campo encerrado nos últimos 7 dias — conta deste painel, não um agregador publicado.', pending: 'Ainda por sair', unverified: 'Noticiadas, não verificadas',
      map: 'Mapa', mapResults: 'Apuração', mapR1: '1º turno 2026', map2022: '2º turno 2022', mapLegend: 'diferença em pontos', tapState: 'Toque num estado para ver a apuração, o 1º turno e 2022.', states: 'Estados', state: 'UF', swing: 'vs 1º turno', swing22: 'vs 2022',
      chart: 'A apuração ao longo da noite', chartX: '% das seções totalizadas', markets: 'Mercados de previsão', marketNote: 'Preço do contrato “vence”, lido como probabilidade. Polymarket e Kalshi, na hora indicada; a rotina atualiza a cada 30 minutos (a cada 5 durante a apuração).',
      how: 'Como funciona a noite', howText: ['O Brasil vota em urnas eletrônicas num único horário de Brasília, das 8h às 17h (7h–16h nos estados em UTC−4, 6h–15h no Acre). Não há boca de urna oficial.', 'O TSE totaliza as urnas conforme chegam e publica a apuração a partir das 17h. Nordeste e grandes cidades chegam rápido; a Amazônia e o exterior, por último. Em 2022 a apuração passou de 99% em cerca de 3 horas e o TSE proclamou o resultado na mesma noite.', 'Vence quem tem mais votos válidos; brancos e nulos não contam. Esta página mostra os números do TSE com a hora do arquivo; o único “eleito” que ela mostra é o do próprio TSE.'],
      news: 'Manchetes', newsNote: 'Títulos dos próprios veículos.', about: 'Sobre este painel', aboutText: ['Os números vêm dos arquivos de resultado do Tribunal Superior Eleitoral, lidos diretamente; as pesquisas, dos institutos e dos veículos que as encomendaram, com o registro no TSE quando conhecido; os preços, de Polymarket e Kalshi. Cada número traz sua hora.', 'O painel nunca declara vencedor. A faixa de “eleito” só aparece quando o TSE proclama o resultado.'],
      sources: 'Fontes', runlog: 'Registro das atualizações', endorse: 'Apoios', mate: 'vice', incumbent: 'no cargo', showAll: 'Mostrar todas as {n} pesquisas', showLess: 'Mostrar menos', region: { N: 'Norte', NE: 'Nordeste', CO: 'Centro-Oeste', SE: 'Sudeste', S: 'Sul' }, abroad: 'Exterior', total: 'Brasil', live: 'ao vivo', direct: 'lido do TSE por este navegador', fromAction: 'da última coleta automática', elected: 'eleito', calendar: 'Calendário', turnout: 'comparecimento', regVoters: 'eleitores aptos' }
  };
  function t(k) { var s = T[lang][k]; return s === undefined ? (T.en[k] === undefined ? k : T.en[k]) : s; }
  var C = {}; (M.election.candidates || []).forEach(function (c) { C[c.key] = c; });
  var NF = function () { return new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US'); };
  function n0(x) { return x == null ? '—' : NF().format(Math.round(x)); }
  function p1(x, d) { if (x == null) return '—'; var s = (+x).toFixed(d == null ? 1 : d); return (lang === 'pt' ? s.replace('.', ',') : s) + '%'; }
  function pts(x) { if (x == null) return '—'; var s = (x > 0 ? '+' : '') + (+x).toFixed(1); return lang === 'pt' ? s.replace('.', ',') : s; }
  function when(iso, opts) {
    if (!iso) return '—';
    var d = new Date(iso); if (isNaN(d)) return iso;
    var o = opts || { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' };
    try { return d.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', o); } catch (e) { return iso; }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tz(iso) { return iso ? when(iso) : '—'; }

  // ---------------------------------------------------------------- results helpers
  function cv(rec, key) { if (!rec) return null; var c = (rec.candidates || []).filter(function (x) { return x.key === key; })[0]; return c || null; }
  function share(rec, key) { var c = cv(rec, key); return c && c.pctValid != null ? +c.pctValid : null; }
  function hasCount(rec) { return !!(rec && rec.pctCounted != null && rec.pctCounted > 0 && (cv(rec, 'lula') || cv(rec, 'flavio'))); }
  function margin(rec) { var l = share(rec, 'lula'), f = share(rec, 'flavio'); return l == null || f == null ? null : l - f; }   // + = Lula ahead
  function marginR1(u) { var r = M.election.units[u] && M.election.units[u].round1; return r ? r.lula.pctValid - r.flavio.pctValid : null; }
  function margin22(u) { var r = M.election.units[u] && M.election.units[u].runoff2022; return r ? r.lula - r.bolsonaro : null; }
  function color(m, pct) {   // diverging: red (Lula) .. grey .. blue (Flávio); lighter while little is counted
    if (m == null) return 'var(--line)';
    var a = Math.min(1, Math.abs(m) / 30), base = m > 0 ? [200, 16, 46] : m < 0 ? [29, 78, 216] : [139, 143, 152];
    var mix = 0.25 + 0.75 * a; if (pct != null && pct < 100) mix *= 0.55 + 0.45 * Math.min(1, pct / 100);
    var bg = document.documentElement.matches('[data-theme="light"]') || !window.matchMedia('(prefers-color-scheme: dark)').matches ? [238, 240, 243] : [38, 46, 68];
    return 'rgb(' + base.map(function (c, i) { return Math.round(bg[i] + (c - bg[i]) * mix); }).join(',') + ')';
  }
  function unitName(u) { var x = M.election.units[u]; return x ? (lang === 'pt' ? x.name : x.nameEn) : u; }

  // ---------------------------------------------------------------- header + banner
  function renderHeader() {
    $('brandSub').textContent = t('sub');
    var mode = M.meta.mode, pill = $('modePill');
    pill.className = 'pill' + (mode === 'night' ? ' live' : mode === 'post' ? ' final' : ''); pill.textContent = t(mode);
    $('updated').textContent = t('updated') + ' ' + tz(M.meta.updated);
    $('lang-en').setAttribute('aria-pressed', lang === 'en'); $('lang-pt').setAttribute('aria-pressed', lang === 'pt');
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
    var b = $('banner'), d = M.meta.declared, nat = M.results.national;
    if (d && d.winner) { b.innerHTML = '<div class="banner">✓ ' + esc(t('declared').replace('{by}', d.by || 'TSE').replace('{name}', C[d.winner] ? C[d.winner].name : d.winner)) + ' <span class="small">· ' + tz(d.at) + (d.note ? ' · ' + esc(d.note) : '') + '</span></div>'; }
    else if (mode === 'pre') b.innerHTML = '<div class="banner wait">' + esc(t('countStarts')) + '</div>';
    else if (mode === 'night' && !hasCount(nat)) b.innerHTML = '<div class="banner wait">' + esc(t('waiting')) + '</div>';
    else b.innerHTML = '';
  }

  // ---------------------------------------------------------------- hero
  function renderHero() {
    var nat = M.results.national, live = hasCount(nat), avg = M.polls.average, mk = M.markets.pres, r1 = M.election.round1National;
    var l = live ? share(nat, 'lula') : null, f = live ? share(nat, 'flavio') : null;
    var lead = live && l != null && f != null ? (l > f ? 'lula' : f > l ? 'flavio' : null) : null;
    function card(key) {
      var c = C[key], s = key === 'lula' ? l : f, cnt = cv(nat, key), win = M.meta.declared && M.meta.declared.winner === key;
      var r1c = (r1.candidates || []).filter(function (x) { return x.key === key; })[0];
      var html = '<div class="cand' + (lead === key ? ' lead' : '') + '" style="--c:' + c.color + '">' +
        '<div class="nm">' + esc(c.name) + '</div><div class="pt">' + esc(c.party) + (c.runningMate ? ' · ' + t('mate') + ' ' + esc(c.runningMate) : '') + (c.incumbent ? ' · ' + t('incumbent') : '') + '</div>';
      if (live) html += '<div class="big">' + p1(s, 2) + '</div><div class="sub">' + (cnt ? n0(cnt.votes) + ' ' + t('votes') : '') + '</div>';
      else html += '<div class="big">' + (avg ? p1(key === 'lula' ? avg.lula : avg.flavio) : '—') + '</div><div class="sub">' + t('pollAvg') + (avg ? ' (' + avg.n + ')' : '') + '</div>';
      html += '<div class="sub" style="margin-top:6px">' + t('round1') + ': ' + (r1c ? p1(r1c.pctValid, 2) : '—') + (mk ? ' · ' + t('market') + ': ' + p1(100 * (key === 'lula' ? mk.lula : mk.flavio), 0) : '') + '</div>';
      if (win) html += '<span class="elected">✓ ' + t('elected') + '</span>';
      return html + '</div>';
    }
    var h = '<div class="hero">' + card('lula') + card('flavio') + '</div>';
    var bl = live ? l : avg ? avg.lula : null, bf = live ? f : avg ? avg.flavio : null;
    if (bl != null && bf != null) h += '<div class="bar" aria-hidden="true"><i class="l" style="width:' + bl + '%"></i><i class="f" style="width:' + bf + '%"></i></div>';
    if (live) {
      h += '<div class="kv"><div><b>' + p1(nat.pctCounted, 2) + '</b><span>' + t('counted') + '</span></div>' +
        '<div><b>' + n0(nat.valid) + '</b><span>' + t('valid') + ' ' + t('votes') + '</span></div>' +
        '<div><b>' + (nat.blankPct != null ? p1(nat.blankPct, 2) : n0(nat.blank)) + '</b><span>' + t('blank') + '</span></div>' +
        '<div><b>' + (nat.nullPct != null ? p1(nat.nullPct, 2) : n0(nat['null'])) + '</b><span>' + t('nullv') + '</span></div>' +
        (nat.abstentionPct != null ? '<div><b>' + p1(nat.abstentionPct, 2) + '</b><span>' + t('abst') + '</span></div>' : '') +
        '<div><b style="font-size:14px">' + esc(nat.tseTime ? when(nat.tseTime) : '—') + '</b><span>' + t('tseTime') + (nat.direct ? ' · ' + t('direct') : '') + '</span></div></div>';
      if (nat.status) h += '<div class="note">TSE: ' + esc(nat.status) + '</div>';
    } else {
      var e = M.election.election;
      h += '<div class="kv"><div><b>' + p1(r1.candidates[0].pctValid, 2) + ' / ' + p1(r1.candidates[1].pctValid, 2) + '</b><span>' + t('firstRound') + ' · Flávio / Lula</span></div>' +
        '<div><b>' + p1(r1.turnoutPct, 2) + '</b><span>' + t('turnout') + ' ' + t('round1') + '</span></div>' +
        '<div><b>' + n0(e.registeredVoters) + '</b><span>' + t('regVoters') + '</span></div>' +
        (avg ? '<div><b>' + pts(avg.flavio - avg.lula) + '</b><span>Flávio − Lula, ' + t('pollAvg') + '</span></div>' : '') + '</div>';
      if (avg) h += '<div class="note">' + esc(t('avgNote')) + ' (' + esc(avg.window) + ': ' + esc(avg.pollsters.join(', ')) + ')</div>';
    }
    $('hero').innerHTML = h;
  }

  // ---------------------------------------------------------------- map
  var mapMode = LS.get('br26.map') || 'auto', sel = null;
  function effMode() { return mapMode === 'auto' ? (hasAnyResults() ? 'results' : 'r1') : mapMode; }
  function hasAnyResults() { return Object.keys(M.results.units || {}).some(function (u) { return hasCount(M.results.units[u]); }); }
  function unitMargin(u, mode) { if (mode === 'results') { var r = M.results.units[u]; return hasCount(r) ? margin(r) : null; } return mode === 'r1' ? marginR1(u) : margin22(u); }
  function renderMap() {
    var mode = effMode(), legend = [30, 15, 5, 0, -5, -15, -30];
    var h = '<h2>' + t('map') + '</h2><div class="seg" role="group">' +
      ['results', 'r1', '2022'].map(function (m) { return '<button data-m="' + m + '" aria-pressed="' + (mode === m) + '">' + t(m === 'results' ? 'mapResults' : m === 'r1' ? 'mapR1' : 'map2022') + '</button>'; }).join('') + '</div>';
    h += '<svg class="map" viewBox="' + GEO.viewBox + '" role="img" aria-label="' + t('map') + '">';
    GEO.order.forEach(function (u) {
      var m = unitMargin(u, mode), pct = mode === 'results' ? (M.results.units[u] || {}).pctCounted : 100;
      h += '<path data-u="' + u + '" class="' + (sel === u ? 'sel' : '') + '" d="' + GEO.paths[u] + '" fill="' + color(m, pct) + '"><title>' + esc(unitName(u)) + (m != null ? ' ' + pts(m) : '') + '</title></path>';
    });
    var NUDGE = { RN: [14, -6], PB: [14, 0], PE: [12, 4], AL: [14, 4], SE: [12, 4], ES: [12, 0], RJ: [10, 6], DF: [0, -7], SC: [8, 0] };
    GEO.order.forEach(function (u) {
      var xy = GEO.labels[u], nd = NUDGE[u] || [0, 0], m = unitMargin(u, mode);
      h += '<text x="' + (xy[0] + nd[0]) + '" y="' + (xy[1] + nd[1]) + '" text-anchor="middle">' + u + '</text>';
      if (m != null && !NUDGE[u]) h += '<text class="pct" x="' + xy[0] + '" y="' + (xy[1] + 10) + '" text-anchor="middle">' + pts(m) + '</text>';
    });
    h += '</svg><div class="legend"><span style="color:var(--lula);font-weight:700">Lula</span>' + legend.map(function (v) { return '<i style="background:' + color(v, 100) + '" title="' + v + '"></i>'; }).join('') + '<span style="color:var(--flavio);font-weight:700">Flávio</span> <span>· ' + t('mapLegend') + '</span></div>';
    h += '<div class="note">' + esc(t('tapState')) + (mode === 'results' ? '' : ' ' + (mode === 'r1' ? '' : esc((M.meta.sources[5] || {}).note || ''))) + '</div>';
    $('mapCard').innerHTML = h;
    $('mapCard').querySelectorAll('.seg button').forEach(function (b) { b.onclick = function () { mapMode = b.getAttribute('data-m'); LS.set('br26.map', mapMode); renderMap(); renderStates(); }; });
    $('mapCard').querySelectorAll('path').forEach(function (p) { p.onclick = function () { sel = p.getAttribute('data-u'); renderMap(); renderDetail(); if (window.innerWidth < 900) $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }; });
  }
  function renderDetail() {
    var u = sel, h;
    if (!u) {
      var nat = M.results.national;
      h = '<div class="nm">' + t('total') + '</div>';
      if (hasCount(nat)) h += rowsFor(nat, M.election.round1National, M.election.runoff2022National, true);
      else h += '<div class="note">' + esc(t('noResults')) + '. ' + esc(t('tapState')) + '</div>' + rowsFor(null, M.election.round1National, M.election.runoff2022National, true);
    } else {
      var x = M.election.units[u], r = M.results.units[u];
      h = '<div class="nm">' + esc(unitName(u)) + ' <span class="small">' + (x.region ? t('region')[x.region] : '') + '</span></div>';
      h += rowsFor(hasCount(r) ? r : null, { candidates: [{ key: 'lula', pctValid: x.round1.lula.pctValid, votes: x.round1.lula.votes }, { key: 'flavio', pctValid: x.round1.flavio.pctValid, votes: x.round1.flavio.votes }] }, x.runoff2022 ? { lula: { pctValid: x.runoff2022.lula }, bolsonaro: { pctValid: x.runoff2022.bolsonaro } } : null, false);
    }
    $('detail').innerHTML = h;
  }
  function rowsFor(r, r1, r22, national) {
    function pc(k) { var c = (r1.candidates || []).filter(function (x) { return x.key === k; })[0]; return c ? c.pctValid : null; }
    var h = '<div class="tscroll"><table><thead><tr><th></th><th>' + (r ? t('mapResults') : '') + '</th><th>' + t('round1') + '</th><th>' + t('r2022') + '</th></tr></thead><tbody>';
    ['lula', 'flavio'].forEach(function (k) {
      var c = cv(r, k), v22 = r22 ? (k === 'lula' ? r22.lula.pctValid : r22.bolsonaro.pctValid) : null;
      h += '<tr><td><span class="swatch" style="background:' + C[k].color + '"></span>' + esc(C[k].short) + '</td><td class="m ' + (k === 'lula' ? 'l' : 'f') + '">' + (c ? p1(c.pctValid, 2) + '<br><span class="small">' + n0(c.votes) + '</span>' : '') + '</td><td>' + p1(pc(k), 2) + '</td><td>' + p1(v22, 2) + (k === 'flavio' && v22 != null ? '<br><span class="small">Jair</span>' : '') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    if (r) {
      h += '<div class="kv"><div><b>' + p1(r.pctCounted, 2) + '</b><span>' + t('counted') + '</span></div><div><b>' + n0(r.valid) + '</b><span>' + t('valid') + '</span></div>' +
        (r.blankPct != null ? '<div><b>' + p1(r.blankPct, 2) + '</b><span>' + t('blank') + '</span></div><div><b>' + p1(r.nullPct, 2) + '</b><span>' + t('nullv') + '</span></div>' : '') +
        (r.abstentionPct != null ? '<div><b>' + p1(r.abstentionPct, 2) + '</b><span>' + t('abst') + '</span></div>' : '') + '</div>' +
        '<div class="note">' + t('tseTime') + ': ' + esc(r.tseTime ? when(r.tseTime) : '—') + ' · ' + (r.direct ? t('direct') : t('fromAction')) + (r.url ? ' · <a href="' + esc(r.url) + '" target="_blank" rel="noopener">TSE</a>' : '') + '</div>';
    }
    return h;
  }

  // ---------------------------------------------------------------- state table
  var sortKey = 'name';
  function renderStates() {
    var mode = effMode(), units = Object.keys(M.election.units);
    var rows = units.map(function (u) {
      var r = M.results.units[u], live = hasCount(r);
      return { u: u, name: unitName(u), region: M.election.units[u].region, pct: live ? r.pctCounted : null, l: live ? share(r, 'lula') : null, f: live ? share(r, 'flavio') : null, m: live ? margin(r) : null, m1: marginR1(u), m22: margin22(u) };
    });
    rows.sort(function (a, b) { if (sortKey === 'name') return a.name.localeCompare(b.name); var ka = a[sortKey], kb = b[sortKey]; if (ka == null) return 1; if (kb == null) return -1; return kb - ka; });
    var h = '<h2>' + t('states') + '</h2><div class="tscroll"><table><thead><tr>' +
      [['name', t('state')], ['pct', t('counted').split(' ')[0] === '%' ? '%' : '% ' + (lang === 'pt' ? 'seções' : 'counted')], ['l', 'Lula'], ['f', 'Flávio'], ['m', t('margin')], ['m1', t('round1')], ['m22', t('r2022')]].map(function (c) { return '<th data-k="' + c[0] + '" style="cursor:pointer">' + esc(c[1]) + (sortKey === c[0] ? ' ▾' : '') + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      var sw = r.m != null && r.m1 != null ? r.m - r.m1 : null;
      h += '<tr><td><span class="swatch" style="background:' + color(mode === 'results' ? r.m : mode === 'r1' ? r.m1 : r.m22, mode === 'results' ? r.pct : 100) + '"></span>' + esc(r.name) + '</td><td>' + (r.pct != null ? p1(r.pct, 1) : '—') + '</td><td class="m l">' + p1(r.l, 2) + '</td><td class="m f">' + p1(r.f, 2) + '</td><td>' + (r.m != null ? pts(r.m) + (sw != null ? ' <span class="small">(' + pts(sw) + ' ' + t('swing') + ')</span>' : '') : '—') + '</td><td>' + pts(r.m1) + '</td><td>' + pts(r.m22) + '</td></tr>';
    });
    h += '</tbody></table></div><div class="note">' + t('margin') + ' = Lula − Flávio, ' + (lang === 'pt' ? 'em pontos dos votos válidos' : 'in points of valid votes') + '. 2022: Lula − Jair Bolsonaro.</div>';
    $('states').innerHTML = h;
    $('states').querySelectorAll('th').forEach(function (th) { th.onclick = function () { sortKey = th.getAttribute('data-k'); renderStates(); }; });
  }

  // ---------------------------------------------------------------- count chart (history of national shares vs % counted)
  function renderChart() {
    var H = (M.results.history || []).filter(function (p) { return p.pst != null && p.lula != null && p.flavio != null; });
    var el = $('chart'); if (H.length < 2) { el.hidden = true; return; }
    el.hidden = false;
    var W = 720, Hh = 220, px = 36, py = 14, x = function (v) { return px + (W - px - 8) * v / 100; }, y = function (v) { return py + (Hh - py - 22) * (1 - (v - 40) / 20); };
    function path(k) { return 'M' + H.map(function (p) { return x(p.pst).toFixed(1) + ',' + y(Math.max(40, Math.min(60, p[k]))).toFixed(1); }).join('L'); }
    var h = '<h2>' + t('chart') + '</h2><svg class="chart" viewBox="0 0 ' + W + ' ' + Hh + '">';
    [40, 45, 50, 55, 60].forEach(function (v) { h += '<line x1="' + px + '" x2="' + (W - 8) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--line)" stroke-dasharray="' + (v === 50 ? '0' : '3 3') + '"/><text x="' + (px - 4) + '" y="' + (y(v) + 3) + '" text-anchor="end" font-size="10" fill="var(--mute)">' + v + '%</text>'; });
    [0, 25, 50, 75, 100].forEach(function (v) { h += '<text x="' + x(v) + '" y="' + (Hh - 6) + '" text-anchor="middle" font-size="10" fill="var(--mute)">' + v + '%</text>'; });
    h += '<path d="' + path('lula') + '" fill="none" stroke="var(--lula)" stroke-width="2"/><path d="' + path('flavio') + '" fill="none" stroke="var(--flavio)" stroke-width="2"/>';
    h += '<text x="' + (W / 2) + '" y="' + (Hh - 16) + '" text-anchor="middle" font-size="10" fill="var(--mute)">' + esc(t('chartX')) + '</text></svg>';
    var last = H[H.length - 1]; h += '<div class="note">' + H.length + ' TSE files · ' + esc(when(last.t)) + ': ' + p1(last.pst, 2) + ' · Lula ' + p1(last.lula, 2) + ' · Flávio ' + p1(last.flavio, 2) + '</div>';
    el.innerHTML = h;
  }

  // ---------------------------------------------------------------- polls
  var showAllPolls = false;
  function renderPolls() {
    var L = M.polls.list || [], avg = M.polls.average, rows = showAllPolls ? L : L.slice(0, 12);
    var h = '<h2>' + t('pollsHead') + '<span class="asof">' + (M.polls.asOf ? tz(M.polls.asOf) : '') + '</span></h2>';
    if (avg) h += '<div class="kv" style="margin-top:0"><div><b class="m l">' + p1(avg.lula) + '</b><span>Lula · ' + t('pollAvg') + '</span></div><div><b class="m f">' + p1(avg.flavio) + '</b><span>Flávio · ' + t('pollAvg') + '</span></div><div><b>' + avg.n + '</b><span>' + (lang === 'pt' ? 'institutos, 7 dias' : 'pollsters, 7 days') + '</span></div></div><div class="note">' + esc(t('avgNote')) + '</div>';
    h += '<div class="tscroll" style="margin-top:8px"><table><thead><tr><th>' + t('date') + '</th><th>' + t('pollster') + '</th><th>' + t('sample') + '</th><th>Lula</th><th>Flávio</th><th>' + t('margin') + '</th><th></th></tr></thead><tbody>';
    rows.forEach(function (p) {
      var l = p.lulaValid, f = p.flavioValid, hasValid = l != null && f != null;
      h += '<tr><td>' + esc((p.start ? p.start.slice(5).replace('-', '/') + '–' : '') + (p.end || '').slice(5).replace('-', '/')) + '</td><td>' + esc(p.pollster) + (p.sponsor ? '<br><span class="small">' + esc(p.sponsor) + '</span>' : '') + '</td><td>' + (p.n ? n0(p.n) : '—') + '</td>' +
        '<td class="m l">' + (hasValid ? p1(l) : p1(p.lula) + '*') + '</td><td class="m f">' + (hasValid ? p1(f) : p1(p.flavio) + '*') + '</td><td>' + (hasValid ? pts(f - l) : '—') + '</td><td>' + (p.url ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">↗</a>' : '') + '</td></tr>';
    });
    h += '</tbody></table></div><div class="note">' + (lang === 'pt' ? 'Votos válidos; diferença = Flávio − Lula. * = só o total de entrevistados (com brancos/nulos/indecisos) foi publicado.' : 'Valid-vote shares; margin = Flávio − Lula. * = only the share of all respondents (with blank/null/undecided) was published.') + '</div>';
    if (L.length > 12) h += '<button class="more" id="morePolls">' + (showAllPolls ? t('showLess') : t('showAll').replace('{n}', L.length)) + '</button>';
    if ((M.polls.pending || []).length) h += '<div class="note"><b>' + t('pending') + ':</b> ' + M.polls.pending.map(function (p) { return esc(p.pollster) + (p.note ? ' (' + esc(p.note) + ')' : ''); }).join('; ') + '</div>';
    if ((M.polls.unverified || []).length) h += '<div class="note"><b>' + t('unverified') + ':</b> ' + M.polls.unverified.map(function (p) { return esc(p.pollster) + ': ' + esc(p.text); }).join('; ') + '</div>';
    $('polls').innerHTML = h;
    var b = $('morePolls'); if (b) b.onclick = function () { showAllPolls = !showAllPolls; renderPolls(); };
  }

  // ---------------------------------------------------------------- markets
  function renderMarkets() {
    var mk = M.markets.pres, h = '<h2>' + t('markets') + '<span class="asof">' + (mk ? tz(mk.asOf) : '') + '</span></h2>';
    if (!mk) { h += '<div class="note">—</div>'; $('markets').innerHTML = h; return; }
    function box(v, name, url, p) { return '<div><div class="small">' + esc(v) + (url ? ' <a href="' + esc(url) + '" target="_blank" rel="noopener">↗</a>' : '') + '</div><b class="m f">' + p1(100 * p.flavio, 0) + '</b> Flávio<br><b class="m l">' + p1(100 * p.lula, 0) + '</b> Lula</div>'; }
    h += '<div class="mkt">' + box(mk.venue, null, mk.url, mk) + (mk.kalshi ? box('Kalshi', null, mk.kalshi.url, mk.kalshi) : '') + '</div>';
    h += '<div class="note">' + esc(t('marketNote')) + (mk.sourceNote ? ' ' + esc(mk.sourceNote) : '') + (mk.volume ? ' · ' + (lang === 'pt' ? 'volume' : 'volume') + ' US$ ' + n0(mk.volume) : '') + '</div>';
    var H = (M.markets.history || []).filter(function (p) { return p.flavio != null; });
    if (H.length > 1) h += '<div class="small" style="margin-top:6px">' + H.slice(-6).map(function (p) { return esc(when(p.t, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })) + ' ' + p1(100 * p.flavio, 0) + ' (' + esc(p.venue) + ')'; }).join(' · ') + '</div>';
    $('markets').innerHTML = h;
  }

  // ---------------------------------------------------------------- how / news / about
  function renderHow() {
    var h = '<h2>' + t('how') + '</h2>' + t('howText').map(function (p) { return '<p style="margin:0 0 8px">' + esc(p) + '</p>'; }).join('');
    var cal = M.election.calendar || [];
    h += '<h2 style="margin-top:12px">' + t('calendar') + '</h2><ul class="plain">' + cal.map(function (c) { return '<li><span class="t">' + esc(c.date) + '</span>' + esc(c[lang] || c.en) + '</li>'; }).join('') + '</ul>';
    ['lula', 'flavio'].forEach(function (k) { var e = C[k].endorsedBy; if (e) h += '<div class="note"><b>' + esc(C[k].short) + '</b> · ' + t('endorse') + ': ' + esc((e.candidates || []).concat(e.parties || []).join(', ')) + '</div>'; });
    if (M.election.noEndorsement) h += '<div class="note">' + (lang === 'pt' ? 'Sem apoio declarado' : 'No endorsement') + ': ' + esc((M.election.noEndorsement.candidates || []).concat(M.election.noEndorsement.parties || []).join(', ')) + '</div>';
    $('how').innerHTML = h;
  }
  function renderNews() {
    var items = M.news.items || [], alerts = M.results.alerts || [];
    var h = '<h2>' + t('news') + '<span class="asof">' + (M.news.asOf ? tz(M.news.asOf) : '') + '</span></h2>';
    if (alerts.length) h += '<ul class="plain alerts">' + alerts.slice().reverse().slice(0, 8).map(function (a) { return '<li><span class="t">' + esc(when(a.t, { hour: '2-digit', minute: '2-digit' })) + '</span>' + esc(a[lang] || a.en || a.text) + '</li>'; }).join('') + '</ul>';
    if (!items.length) h += '<div class="note">' + (lang === 'pt' ? 'As manchetes chegam com a coleta automática.' : 'Headlines arrive with the automated pull.') + '</div>';
    else h += '<ul class="plain">' + items.slice(0, 25).map(function (n) { return '<li><span class="t">' + esc(when(n.t, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })) + '</span><a href="' + esc(n.link) + '" target="_blank" rel="noopener">' + esc(n.title) + '</a> <span class="small">' + esc(n.source) + '</span></li>'; }).join('') + '</ul><div class="note">' + esc(t('newsNote')) + '</div>';
    $('news').innerHTML = h;
  }
  function renderAbout() {
    var h = '<h2>' + t('about') + '</h2>' + t('aboutText').map(function (p) { return '<p style="margin:0 0 8px">' + esc(p) + '</p>'; }).join('');
    h += '<details><summary>' + t('sources') + '</summary><ul class="plain">' + (M.meta.sources || []).map(function (s) { return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a> <span class="small">' + esc(s.note || '') + '</span></li>'; }).join('') + '</ul></details>';
    h += '<details><summary>' + t('runlog') + '</summary><ul class="plain">' + (M.meta.runlog || []).slice().reverse().map(function (l) { return '<li class="small">' + esc(l) + '</li>'; }).join('') + '</ul></details>';
    if ((M.results.errors || []).length) h += '<div class="note">TSE pull: ' + esc(M.results.errors.join('; ')) + '</div>';
    $('about').innerHTML = h;
    $('foot').innerHTML = '<a href="../election2026/">Election Desk 2026 (U.S. midterms)</a> · <a href="https://github.com/BBOLDT86/lanscape-navigator/tree/main/brazil2026">GitHub</a>';
  }
  function renderAll() { renderHeader(); renderHero(); renderMap(); renderDetail(); renderStates(); renderChart(); renderPolls(); renderMarkets(); renderHow(); renderNews(); renderAbout(); }

  // ---------------------------------------------------------------- live refresh
  var directFails = 0, tseUnits = (M.meta.tse && M.meta.tse.units) || [];
  function tseUrl(uf) { var c = M.meta.tse; return c.unitUrl.replace('{base}', c.base).replace('{ambiente}', c.ambiente).replace('{cycle}', c.cycle).replace(/\{code\}/g, c.runoffCode).replace(/\{uf\}/g, uf); }
  function parseTse(j, uf) {   // same fields as updater/fetch_tse.py
    var cands = [], KEYS = {}; (M.election.candidates || []).forEach(function (c) { KEYS[c.n] = c.key; });
    (j.carg || []).forEach(function (cg) { (cg.agr || []).forEach(function (ag) { (ag.par || []).forEach(function (pr) { (pr.cand || []).forEach(function (c) {
      cands.push({ n: String(c.n || ''), name: c.nmu || c.nm || '', party: pr.sg || '', votes: +String(c.vap || '0').replace(/\./g, ''), pctValid: num(c.pvap), status: c.st || '', key: KEYS[String(c.n || '')] || null }); }); }); }); });
    var s = j.s || {}, v = j.v || {}, e = j.e || {}, ts = null;
    if (j.dg && j.hg) { var d = j.dg.split('/'); ts = d[2] + '-' + d[1] + '-' + d[0] + 'T' + j.hg + '-03:00'; }
    return { uf: uf.toUpperCase(), tseTime: ts, pctCounted: num(s.pst), sectionsCounted: num(s.st), sectionsTotal: num(s.ts), valid: num(v.vv), blank: num(v.vb), blankPct: num(v.pvb), 'null': num(v.tvn), nullPct: num(v.ptvn), abstention: num(e.a), abstentionPct: num(e.pa), candidates: cands, status: j.and || '', url: tseUrl(uf), direct: true };
    function num(x) { if (x == null || x === '') return null; var s = String(x); if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isNaN(n) ? null : n; }
  }
  function newer(a, b) { return a && a.tseTime && (!b || !b.tseTime || a.tseTime > b.tseTime); }
  function pullModel() {
    return fetch('data/model.json?cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (m) {
      if (!m || !m.meta) return;
      var keepNat = newer(M.results.national, m.results.national) ? M.results.national : null, keepUnits = {};
      Object.keys(M.results.units || {}).forEach(function (u) { if (newer(M.results.units[u], (m.results.units || {})[u])) keepUnits[u] = M.results.units[u]; });
      M = m; window.M = M; if (keepNat) M.results.national = keepNat; Object.keys(keepUnits).forEach(function (u) { M.results.units[u] = keepUnits[u]; });
    }).catch(function () {});
  }
  function pullTse(all) {
    if (directFails >= 4 || !M.meta.tse || !M.meta.tse.unitUrl) return Promise.resolve();
    var list = all ? tseUnits : ['br'];
    return Promise.all(list.map(function (uf) {
      return fetch(tseUrl(uf) + '?cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
        var rec = parseTse(j, uf); rec.readAt = new Date().toISOString();
        if (uf === 'br') { if (newer(rec, M.results.national)) { M.results.national = rec; if (rec.tseTime && (!M.results.history.length || M.results.history[M.results.history.length - 1].t !== rec.tseTime)) M.results.history.push({ t: rec.tseTime, pst: rec.pctCounted, lula: (cv(rec, 'lula') || {}).pctValid, flavio: (cv(rec, 'flavio') || {}).pctValid }); } }
        else if (newer(rec, M.results.units[rec.uf])) M.results.units[rec.uf] = rec;
        directFails = 0;
      }).catch(function () { if (uf === 'br') directFails++; });
    }));
  }
  var tick = 0;
  function cycle() {
    var night = M.meta.mode === 'night' || (M.meta.mode !== 'post' && Date.now() >= Date.parse('2026-10-25T20:00:00Z'));
    if (!night) { pullModel().then(renderAll); return; }
    if (M.meta.mode !== 'night') M.meta.mode = 'night';
    tick++;
    pullModel().then(function () { return pullTse(tick % 3 === 1); }).then(function () {
      var nat = M.results.national;   // the TSE marks the winner in its own file
      if (!M.meta.declared && nat) (nat.candidates || []).forEach(function (c) { if (/^eleito/i.test(c.status || '') && c.key) M.meta.declared = { winner: c.key, by: 'TSE', at: nat.tseTime, note: lang === 'pt' ? 'situação "Eleito" no arquivo do TSE' : 'status "Eleito" in the TSE file' }; });
      renderAll();
    });
  }
  $('lang-en').onclick = function () { lang = 'en'; LS.set('br26.lang', lang); renderAll(); };
  $('lang-pt').onclick = function () { lang = 'pt'; LS.set('br26.lang', lang); renderAll(); };
  renderAll();
  var ms = M.meta.mode === 'post' ? 10 * 60000 : 60000;
  setInterval(cycle, ms);
  if (M.meta.mode !== 'post' && Date.now() >= Date.parse('2026-10-25T20:00:00Z')) setTimeout(cycle, 1500);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) cycle(); });
})();
