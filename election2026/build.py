#!/usr/bin/env python3
"""Build Election Desk 2026: data/*.json -> data/model.json (what the page fetches while open) -> index.html (the
page, with the model, the county baselines and the map topology inlined so it also works offline).

    python3 election2026/build.py            # build
    python3 election2026/build.py --check    # build and report what is missing, exit 1 on a broken file

Inputs (all in election2026/data/):
  races.json      the state of play: candidates, ratings, polls, averages, markets, poll closing times  (research + updater)
  earlyvote.json  early and mail voting by state                                                          (updater)
  feeds.json      the sources the updater reads, and the calendar                                         (research + updater)
  news.json       headlines from the RSS feeds                                                             (updater/fetch_rss.py)
  markets.json    prediction-market prices                                                                 (updater/fetch_markets.py)
  results.json    election-night results, calls and alerts                                                 (updater, from Nov. 3)
  status.json     mode (pre | night | post), last update time, the run log                                 (updater)
  hinge.json      The Hinge's win probabilities by race id, optional                                        (updater/hinge_numbers.py)
  geo.json, baseline.json   the map and the 2024/2020 county votes (static)
"""
import json, os, sys, datetime as dt, re

HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, 'data'); SRC = os.path.join(HERE, 'src')
CHECK = '--check' in sys.argv
problems, notes = [], []

def load(name, default):
    p = os.path.join(D, name)
    if not os.path.exists(p):
        notes.append(f'{name}: missing (using empty)'); return default
    try:
        return json.load(open(p, encoding='utf-8'))
    except Exception as e:
        problems.append(f'{name}: {e}'); return default

races = load('races.json', {}); early = load('earlyvote.json', {}); feeds = load('feeds.json', {}); news = load('news.json', {})
markets = load('markets.json', {}); results = load('results.json', {}); status = load('status.json', {}); hinge = load('hinge.json', {})
base = load('baseline.json', {}); geo = load('geo.json', {})
if not base or not geo: problems.append('geo.json / baseline.json missing: run work/make_geo.py')
FIPS_BY_ABBR = {v: k for k, v in base.get('fips', {}).items()}
STATE_NAME = {v: base.get('names', {}).get(k, v) for k, v in base.get('fips', {}).items()}

def now_iso(): return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def et_now(): return dt.datetime.now(dt.timezone(dt.timedelta(hours=-4)))  # EDT through Nov. 1, 2026; EST after (close enough for the mode switch; status.json can force it)

# ------------------------------------------------------------------ mode
ELECTION_DAY = '2026-11-03'
mode = status.get('mode')
if mode not in ('pre', 'night', 'post'):
    n = et_now(); d = n.strftime('%Y-%m-%d')
    mode = 'pre' if d < ELECTION_DAY else ('night' if d <= '2026-11-05' else 'post')

# ------------------------------------------------------------------ races
def norm_cands(cs):
    out = []
    for c in cs or []:
        p = (c.get('party') or c.get('p') or 'O').strip().upper()[:1]
        if p not in 'DRILG': p = 'O'
        out.append({'n': c.get('name') or c.get('n') or '', 'p': p, 'inc': bool(c.get('incumbent') or c.get('inc')), 'note': c.get('note') or ''})
    # D first, then R, I, others
    order = {'D': 0, 'R': 1, 'I': 2}
    return sorted(out, key=lambda c: order.get(c['p'], 3))

def norm_polls(ps):
    out = []
    for p in ps or []:
        d, r = p.get('d', p.get('dem')), p.get('r', p.get('rep'))
        if d is None or r is None: continue
        ok = lambda v: v if isinstance(v, str) and re.match(r'^\d{4}-\d{2}-\d{2}', v) else ''
        out.append({'pollster': p.get('pollster') or '', 'sponsor': p.get('sponsor') or '', 'partisan': bool(p.get('partisan')), 'start': ok(p.get('start')), 'end': ok(p.get('end')), 'n': p.get('n'), 'pop': p.get('pop') or '', 'd': d, 'r': r, 'o': p.get('other', p.get('oth')), 'url': p.get('url') or ''})
    return sorted(out, key=lambda p: p['end'], reverse=True)

def norm_race(x, typ):
    st = (x.get('state') or '').upper(); fips = FIPS_BY_ABBR.get(st)
    if not fips: problems.append(f'race {x.get("id")}: unknown state {st}'); return None
    rid = x.get('id') or f'{st}-{typ}'
    name = f"{STATE_NAME[st]} {'Senate' if typ == 'S' else 'Governor'}"
    if x.get('special'): name += ' (special)'
    s = base['s'].get(fips)
    pres = x.get('pres2024') or {}
    r = {'id': rid, 'type': typ, 'st': st, 'fips': fips, 'name': name, 'special': bool(x.get('special')),
         'inc': x.get('incumbent') or None, 'cands': norm_cands(x.get('candidates')),
         'ratings': {k: (x.get('ratings') or {}).get(k) or '' for k in ('cook', 'sabato', 'inside')},
         'ratingsAsOf': {k: (x.get('ratings') or {}).get(k + 'AsOf') or '' for k in ('cook', 'sabato', 'inside')},
         'polls': norm_polls(x.get('polls')), 'avg': x.get('average') or {}, 'pres24': {'d': pres.get('d'), 'r': pres.get('r')} if pres.get('d') is not None else ({'d': round(100 * s[0] / s[2], 1), 'r': round(100 * s[1] / s[2], 1)} if s and s[2] else {}),
         'last': {'year': (x.get('lastRace') or {}).get('year'), 'winner': (x.get('lastRace') or {}).get('winner'), 'party': (x.get('lastRace') or {}).get('party'), 'd': (x.get('lastRace') or {}).get('d'), 'r': (x.get('lastRace') or {}).get('r')} if x.get('lastRace') else None,
         'market': x.get('market') or None, 'close': x.get('pollsCloseET') or '', 'notes': x.get('notes') or '', 'src': x.get('sources') or []}
    if not r['cands']: problems.append(f'{rid}: no candidates')
    return r

M_races = {}
for typ, key in (('S', 'senate'), ('G', 'governor')):
    for x in races.get(key) or []:
        r = norm_race(x, typ)
        if r: M_races[r['id']] = r
if len([r for r in M_races.values() if r['type'] == 'S']) < 30: notes.append(f'only {len([r for r in M_races.values() if r["type"] == "S"])} Senate races on file')

# markets: fetched file wins over the research snapshot
M_markets = {'asOf': markets.get('asOf') or (races.get('markets') or {}).get('asOf') or '', 'senate': None, 'house': None, 'races': {}}
def mk(entry):
    if not entry: return None
    d = entry.get('D'); r = entry.get('R')
    if d is None and r is not None: d = round(1 - r, 3)
    if r is None and d is not None: r = round(1 - d, 3)
    return {'D': d, 'R': r, 'venue': entry.get('venue') or '', 'url': entry.get('url') or '', 'asOf': entry.get('asOf') or ''} if d is not None else None
rm = races.get('markets') or {}
M_markets['senate'] = mk(markets.get('senate')) or mk(rm.get('senateControl')); M_markets['house'] = mk(markets.get('house')) or mk(rm.get('houseControl'))
for e in (rm.get('races') or []):
    m = mk(e)
    if m and e.get('id') in M_races: M_markets['races'][e['id']] = m
for rid, e in (markets.get('races') or {}).items():
    m = mk(e)
    if m and rid in M_races: M_markets['races'][rid] = m

# balance of power
bal = races.get('balance') or {}
def notup(ch, default):
    v = ((bal.get(ch) or {}).get('notUp') or {})
    return {k: (v.get(k) if v.get(k) is not None else default[k]) for k in default}
M_balance = {'senate': {'current': (bal.get('senate') or {}).get('current') or {'R': 53, 'D': 45, 'I': 2}, 'notUp': notup('senate', {'R': 31, 'D': 32, 'I': 2})},
             'house': {'current': (bal.get('house') or {}).get('current') or {}},
             'gov': {'current': (bal.get('governors') or {}).get('current') or {}, 'notUp': notup('governors', {'R': 8, 'D': 6})}}
# sanity: not-up seats + seats up should equal the chamber
su = len([r for r in M_races.values() if r['type'] == 'S']); nu = M_balance['senate']['notUp']
if su and sum(v for v in nu.values() if v) + su != 100: notes.append(f'Senate: {su} races + not-up {nu} != 100')
gu = len([r for r in M_races.values() if r['type'] == 'G']); ng = M_balance['gov']['notUp']
if gu and sum(v for v in ng.values() if v) + gu != 50: notes.append(f'Governors: {gu} races + not-up {ng} != 50')

# house
H = races.get('house') or {}
M_house = {'gb': {'polls': norm_polls((H.get('genericBallot') or {}).get('polls')), 'avg': (H.get('genericBallot') or {}).get('average') or {}},
           'ratings': H.get('ratings') or [], 'competitive': H.get('competitive') or [],
           'notes': status.get('houseNotes') or ('All 435 seats are up; 218 is a majority. The competitive list is every district the Cook Political Report rates Toss Up or Lean' + ((' as of ' + (H.get('ratings') or [{}])[0].get('asOf', '')) if (H.get('ratings') or [{}])[0].get('asOf') else '') + ', with the candidates, the other two ratings and the 2024 presidential margin in the district.')}

# poll closing times
close = dict(races.get('pollsCloseET') or {})
for st, v in ((feeds.get('resultsNight') or {}).get('states') or {}).items():
    if v.get('pollsCloseET') and st not in close: close[st] = v['pollsCloseET']
close = {k: v for k, v in close.items() if isinstance(v, str) and re.match(r'^\d{1,2}:\d{2}', v)}
for r in M_races.values():
    if not r['close']: r['close'] = close.get(r['st'], '')

# early vote: the editorial file, overlaid with the automated CSV pull wherever the pull's per-state date is the same or newer
auto = load('earlyvote_auto.json', {})
E_states = {k: dict(v) for k, v in (early.get('states') or {}).items() if v}
AUTO_FIELDS = ('totalBallots', 'mailReturned', 'inPerson', 'mailRequested', 'byParty', 'byPartyBasis', 'asOf', 'source', 'officialSource', 'updatesToday', 'turnout2022Total', 'pctOf2022Turnout', 'final2024', 'pctOf2024Final')
n_auto = 0
for ab, a in (auto.get('states') or {}).items():
    cur = E_states.get(ab) or {'name': STATE_NAME.get(ab, ab)}
    if (a.get('asOf') or '') >= (cur.get('asOf') or '')[:10]:
        for k in AUTO_FIELDS:
            if a.get(k) is not None: cur[k] = a[k]
        cur['auto'] = True; n_auto += 1
    E_states[ab] = cur
E_nat = dict(early.get('national') or {})
if (auto.get('asOf') or '') > (E_nat.get('asOf') or '') and (auto.get('national') or {}).get('totalBallots'):
    keep = E_nat.get('comparison'); E_nat.update(auto['national']); E_nat['comparison'] = keep
E = {'asOf': max([x for x in [early.get('asOf'), (auto.get('asOf') or '')[:10]] if x] or ['']), 'autoAsOf': auto.get('asOf') or '', 'primarySource': early.get('primarySource'), 'national': E_nat, 'states': E_states, 'headlines': early.get('headlines') or [], 'lede': early.get('lede')}
if n_auto: notes.append(f'early vote: {n_auto} states overlaid from the automated pull ({auto.get("asOf")})')

# results (night)
R = {'asOf': results.get('asOf') or '', 'races': results.get('races') or {}, 'counties': results.get('counties') or {}, 'house': results.get('house') or {}, 'alerts': results.get('alerts') or []}
for rid, res in R['races'].items():
    if rid not in M_races: notes.append(f'results for unknown race {rid}')
    elif res.get('c'):
        names = {c['n'] for c in M_races[rid]['cands']}
        for n in res['c']:
            if n not in names: problems.append(f'results {rid}: candidate "{n}" is not in races.json ({sorted(names)})')
    if res.get('call') and res['call'] not in ('D', 'R', 'I'): problems.append(f'results {rid}: call must be D, R or I')

# news
N = {'asOf': news.get('asOf') or '', 'items': sorted(news.get('items') or [], key=lambda n: n.get('t') or '', reverse=True)[:80]}

# sources for the footer
sources = []
for s in (feeds.get('earlyVote') or []): sources.append({'name': s.get('name'), 'url': s.get('url'), 'note': 'early vote'})
for s in (feeds.get('rss') or []): sources.append({'name': s.get('name'), 'url': s.get('url'), 'note': 'news feed'})
for k, v in ((feeds.get('resultsNight') or {}).items()):
    if k != 'states' and isinstance(v, dict) and v.get('hubUrl'): sources.append({'name': k.upper() + ' results', 'url': v['hubUrl'], 'note': v.get('notes', '')[:120]})
sources.append({'name': 'Cook Political Report, Sabato’s Crystal Ball, Inside Elections', 'url': 'https://www.270towin.com/2026-senate-election/', 'note': 'ratings, as republished by 270toWin'})
sources.append({'name': 'tonmcg / US county-level presidential results', 'url': 'https://github.com/tonmcg/US_County_Level_Election_Results_08-24', 'note': '2020 and 2024 county votes'})
sources.append({'name': 'us-atlas (U.S. Census cartographic boundaries, Albers-projected)', 'url': 'https://github.com/topojson/us-atlas', 'note': 'map'})

updated = status.get('updated') or max([x for x in [races.get('asOf'), early.get('asOf'), N['asOf'], M_markets['asOf'], R['asOf']] if x] or [now_iso()])
if len(updated) == 10: updated += 'T12:00:00Z'
M = {'meta': {'built': now_iso(), 'updated': updated, 'mode': mode, 'electionDay': ELECTION_DAY, 'runlog': (status.get('runlog') or [])[-40:], 'sources': sources,
              'about': status.get('about') or [
                  'Election Desk 2026 is a live desk for the midterms. The map drills from the country to the states to every county, colored by the race ratings, the polls, the prediction markets, the early vote or the 2024 presidential vote before Election Day, and by the results after the polls close. Click a state for its races, candidates, polls, early-vote totals and largest counties.',
                  'Ratings are from the Cook Political Report, Sabato’s Crystal Ball and Inside Elections, as of the dates each shows; the map uses their consensus. Poll averages name their aggregator. Early-vote figures come from the UF Election Lab and state election offices and are party registration, not vote choice. Market prices are from Kalshi and Polymarket. County baselines are the certified 2024 and 2020 presidential votes. On election night, results carry the time they were read and the source; a check mark is a call by the Associated Press or the source named, never this page’s own.',
                  'The page is rebuilt by an automated updater: a scheduled run reads the feeds and the results pages, writes the data files and republishes, every morning until Election Day and then continuously; the page refetches its data while open. The forecast probabilities are from The Hinge, hosted next door.']},
     'balance': M_balance, 'races': M_races, 'house': M_house, 'early': E, 'news': N, 'markets': M_markets, 'results': R,
     'calendar': feeds.get('calendar') or [], 'close': close, 'hinge': hinge if isinstance(hinge, dict) else {}}

os.makedirs(D, exist_ok=True)
json.dump(M, open(os.path.join(D, 'model.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
tpl = open(os.path.join(SRC, 'template.html'), encoding='utf-8').read()
app = '\n'.join(open(os.path.join(SRC, f), encoding='utf-8').read() for f in ('map.js', 'app.js'))
data = 'const GEO=' + json.dumps(geo, separators=(',', ':')) + ';\nconst B=' + json.dumps(base, separators=(',', ':')) + ';\nwindow.M=' + json.dumps(M, ensure_ascii=False, separators=(',', ':')) + ';'
assert '</script' not in app.lower()
html = tpl.replace('/*__DATA__*/', data.replace('</', '<\\/')).replace('/*__APP__*/', app)
open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8').write(html)
print(f'election2026: mode={mode} updated={updated} races={len(M_races)} polls={sum(len(r["polls"]) for r in M_races.values())} markets={len(M_markets["races"])} early-states={len([s for s in E["states"].values() if s and s.get("totalBallots")])} auto={n_auto} news={len(N["items"])} results={len(R["races"])} -> index.html {len(html) // 1024} KB')
for n in notes: print('  note:', n)
for p in problems: print('  PROBLEM:', p)
if CHECK and problems: sys.exit(1)
