#!/usr/bin/env python3
"""Build the Brazil 2026 runoff desk: data/*.json -> data/model.json (what the page refetches while open) -> index.html
(the page, with the model and the map inlined so it also works offline).

    python3 brazil2026/build.py            # build
    python3 brazil2026/build.py --check    # build and exit 1 on a broken data file

Inputs (brazil2026/data/):
  election.json  candidates, dates, first-round result (national + 28 units), 2022 runoff baseline, calendar   (editorial)
  polls.json     runoff polls                                                                                   (editorial, set_result.py poll)
  markets.json   prediction-market prices                                                                       (updater/fetch_markets.py, set_result.py market)
  results.json   the TSE count: national, units, alerts, history                                                (updater/fetch_tse.py, set_result.py result/declare)
  news.json      headlines                                                                                      (updater/fetch_news.py)
  status.json    mode (pre | night | post), updated, declared, the run log                                      (set_result.py)
  feeds.json     TSE URLs, market ids, news feeds                                                               (editorial)
  geo.json       the state map (work/make_geo.py)                                                               (static)
"""
import json, os, sys, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, 'data'); SRC = os.path.join(HERE, 'src')
CHECK = '--check' in sys.argv
problems, notes = [], []
def load(name, default):
    p = os.path.join(D, name)
    if not os.path.exists(p): notes.append(f'{name}: missing (using empty)'); return default
    try: return json.load(open(p, encoding='utf-8'))
    except Exception as e: problems.append(f'{name}: {e}'); return default
def now_iso(): return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

E = load('election.json', {}); P = load('polls.json', {}); MK = load('markets.json', {}); R = load('results.json', {})
N = load('news.json', {}); S = load('status.json', {}); F = load('feeds.json', {}); G = load('geo.json', {})
if not G.get('paths'): problems.append('geo.json missing: run work/make_geo.py')
if not E.get('candidates'): problems.append('election.json has no candidates')

# ---- mode: pre until the count starts (Oct 25, 17:00 BRT = 20:00 UTC), then night until status.json says post
mode = S.get('mode')
if mode not in ('pre', 'night', 'post'):
    mode = 'pre' if now_iso() < '2026-10-25T20:00:00Z' else 'night'
    notes.append(f'mode not set in status.json; derived {mode}')

# ---- polls: normalize to valid-vote shares; the desk's own 7-day mean, one poll per pollster, labeled as such
polls = []
for p in P.get('polls') or []:
    lv, fv = p.get('lulaValid'), p.get('bolsonaroValid')
    if lv is None and p.get('basis') == 'valid': lv, fv = p.get('lula'), p.get('bolsonaro')
    polls.append({**p, 'lulaValid': lv, 'flavioValid': fv, 'flavio': p.get('bolsonaro')})
polls.sort(key=lambda p: (p.get('end') or '', p.get('released') or ''), reverse=True)
avg = None
if polls:
    latest = max(p['end'] for p in polls if p.get('end'))
    cut = (dt.date.fromisoformat(latest) - dt.timedelta(days=7)).isoformat()
    seen, pick = set(), []
    for p in polls:
        if p.get('end') and p['end'] >= cut and p.get('lulaValid') is not None and p.get('flavioValid') is not None and p['pollster'] not in seen:
            seen.add(p['pollster']); pick.append(p)
    if pick:
        avg = {'lula': round(sum(p['lulaValid'] for p in pick) / len(pick), 1), 'flavio': round(sum(p['flavioValid'] for p in pick) / len(pick), 1), 'n': len(pick),
               'window': f'{cut} – {latest}', 'pollsters': [p['pollster'] for p in pick],
               'method': 'simple unweighted mean of valid-vote shares, latest poll per pollster, field work ended in the last 7 days; computed by this desk, not a published aggregator'}
for p in polls:
    if p.get('lulaValid') is not None and p.get('flavioValid') is not None and abs(p['lulaValid'] + p['flavioValid'] - 100) > 1.5:
        notes.append(f'poll {p["pollster"]} {p.get("end")}: valid shares sum to {p["lulaValid"] + p["flavioValid"]}')

# ---- results: validate candidate keys; declared only from status.json (the TSE's proclamation) or the TSE 'st' field
def check_unit(u, rec):
    for c in rec.get('candidates') or []:
        if c.get('key') not in ('lula', 'flavio', None): problems.append(f'results {u}: unknown candidate key {c.get("key")}')
if R.get('national'): check_unit('BR', R['national'])
for u, rec in (R.get('units') or {}).items():
    if u not in (E.get('units') or {}): problems.append(f'results: unknown unit {u}')
    check_unit(u, rec)
declared = S.get('declared')
if not declared and R.get('national'):
    for c in R['national'].get('candidates') or []:
        if (c.get('status') or '').lower().startswith('eleito') and c.get('key'):
            declared = {'winner': c['key'], 'by': 'TSE (status "Eleito" in the result file)', 'at': R['national'].get('tseTime'), 'note': 'from the TSE result file'}
            notes.append(f'TSE file marks {c["key"]} as Eleito')

sources = [
    {'name': 'TSE – Divulgação de Resultados', 'url': (F.get('tse') or {}).get('publicHub') or 'https://resultados.tse.jus.br/', 'note': 'official count; the only source of a declaration'},
    {'name': 'TSE result files (EA20)', 'url': ((F.get('tse') or {}).get('unitUrl') or '').format(base='https://resultados.tse.jus.br', ambiente='oficial', cycle='ele2026', code='6258', uf='br'), 'note': 'read every few minutes on election night'},
    {'name': 'Polls', 'url': 'https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Brazilian_presidential_election', 'note': 'each poll links its own source; TSE registration numbers where known'},
    {'name': 'Polymarket', 'url': (MK.get('pres') or {}).get('url') or 'https://polymarket.com/', 'note': 'market prices'},
    {'name': 'Kalshi', 'url': ((MK.get('pres') or {}).get('kalshi') or {}).get('url') or 'https://kalshi.com/', 'note': 'market prices'},
    {'name': '2022 runoff by state', 'url': (E.get('units2022Source') or {}).get('url') or '', 'note': (E.get('units2022Source') or {}).get('note') or ''},
    {'name': 'Map', 'url': 'https://github.com/codeforamerica/click_that_hood', 'note': 'state boundaries, simplified'},
]
updated = S.get('updated') or max([x for x in [E.get('asOf'), P.get('asOf'), MK.get('asOf'), R.get('asOf'), N.get('asOf')] if x] or [now_iso()])
if len(updated) == 10: updated += 'T12:00:00Z'
M = {'meta': {'built': now_iso(), 'updated': updated, 'mode': mode, 'declared': declared, 'runlog': (S.get('runlog') or [])[-40:], 'sources': sources, 'tse': {k: (F.get('tse') or {}).get(k) for k in ('base', 'ambiente', 'cycle', 'runoffCode', 'unitUrl', 'units')}},
     'election': {k: E.get(k) for k in ('election', 'candidates', 'noEndorsement', 'round1National', 'runoff2022National', 'units', 'calendar')},
     'polls': {'asOf': P.get('asOf'), 'list': polls, 'average': avg, 'pending': P.get('pending') or [], 'unverified': P.get('unverified') or [], 'averageMethod': P.get('averageMethod'), 'gaps': P.get('gaps') or []},
     'markets': {'asOf': MK.get('asOf'), 'pres': MK.get('pres'), 'history': (MK.get('history') or [])[-400:], 'errors': MK.get('errors') or []},
     'results': {'asOf': R.get('asOf'), 'source': R.get('source'), 'national': R.get('national'), 'units': R.get('units') or {}, 'alerts': R.get('alerts') or [], 'history': R.get('history') or [], 'errors': (R.get('errors') or [])[:10]},
     'news': {'asOf': N.get('asOf'), 'items': (N.get('items') or [])[:60]}}
json.dump(M, open(os.path.join(D, 'model.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
tpl = open(os.path.join(SRC, 'template.html'), encoding='utf-8').read()
app = open(os.path.join(SRC, 'app.js'), encoding='utf-8').read()
assert '</script' not in app.lower()
data = 'window.GEO=' + json.dumps(G, separators=(',', ':')) + ';\nwindow.M=' + json.dumps(M, ensure_ascii=False, separators=(',', ':')) + ';'
html = tpl.replace('/*__DATA__*/', data.replace('</', '<\\/')).replace('/*__APP__*/', app)
open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8').write(html)
print(f'brazil2026: mode={mode} updated={updated} polls={len(polls)} avg={avg and (avg["lula"], avg["flavio"], avg["n"])} units-with-results={len(M["results"]["units"])} national-pst={(R.get("national") or {}).get("pctCounted")} declared={bool(declared)} news={len(M["news"]["items"])} -> index.html {len(html) // 1024} KB')
for n in notes: print('  note:', n)
for p in problems: print('  PROBLEM:', p)
if CHECK and problems: sys.exit(1)
