#!/usr/bin/env python3
"""The Hinge's Brazil tab: the 2026 runoff's polls, markets and count against the TSE's result -> ../v2/brazil_data.js

  python3 the-hinge/src/brazil/build_brazil.py      then  python3 the-hinge/src/v2/build_html2.py

Reads (all in this repository):
  the-hinge/src/brazil/tse_rounds.json   the TSE's files for both rounds, per unit (fetch_tse.py, run by the
                                         "The Hinge, Brazil data" workflow)
  brazil2026/data/polls.json             every runoff poll the Brazil desk recorded, with its source
  brazil2026/data/markets.json           Polymarket and Kalshi prices the Brazil desk read
  brazil2026/data/results.json           the TSE count as the Brazil desk read it on election night
  brazil2026/data/election.json          state names and regions, the 2022 runoff by state
  the-hinge/src/brazil/notes.json        what isn't in those files: published intraday prices and counts, the
                                         historical polls, the voting extension, the videos, the sources
Everything computed here is arithmetic on those numbers, except the vote-flow estimate, which is an ecological
regression across the 27 states and abroad (a least-squares fit of the runoff on the first round, every first-round
group's split between 0 and 1 and summing to 1), with its range from leaving out one unit at a time. Needs numpy and
scipy for that fit only.
"""
import datetime as dt
import json
import os

import numpy as np
from scipy.optimize import minimize

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
BD = os.path.join(ROOT, 'brazil2026', 'data')
OUT = os.path.join(HERE, '..', 'v2', 'brazil_data.js')
load = lambda p: json.load(open(p, encoding='utf-8'))
TSE = load(os.path.join(HERE, 'tse_rounds.json'))
NOTES = load(os.path.join(HERE, 'notes.json'))
POLLS = load(os.path.join(BD, 'polls.json'))
MK = load(os.path.join(BD, 'markets.json'))
RES = load(os.path.join(BD, 'results.json'))
EL = load(os.path.join(BD, 'election.json'))
REGION = {'N': 'North', 'NE': 'Northeast', 'CO': 'Center-West', 'SE': 'Southeast', 'S': 'South', 'ZZ': 'Abroad'}


def row(r):
    c = {x['name']: x['votes'] for x in r['candidates']}
    f, l = c.get('FLAVIO BOLSONARO', 0), c.get('LULA', 0)
    other = {k: v for k, v in c.items() if k not in ('FLAVIO BOLSONARO', 'LULA')}
    return {'F': f, 'L': l, 'O': sum(other.values()), 'BN': r['blank'] + r['null'], 'blank': r['blank'], 'null': r['null'], 'A': r['abstention'],
            'E': r['electorate'], 'valid': r['valid'], 'turnout': r['turnout'], 'others': other, 'file': r['file'], 'pst': r['pst'],
            'status': {x['name']: x['status'] for x in r['candidates']}}


R1 = {u: row(v) for u, v in TSE['round1'].items()}
R2 = {u: row(v) for u, v in TSE['runoff'].items()}
UNITS = [u for u in R1 if u != 'BR']
units = EL['units']
n1, n2 = R1['BR'], R2['BR']
pct = lambda a, b: round(100 * a / b, 2) if b else None


def brt(file):  # '25/10/2026 22:13:51' -> ISO with the Brasília offset
    try:
        return dt.datetime.strptime(file, '%d/%m/%Y %H:%M:%S').strftime('%Y-%m-%dT%H:%M:%S-03:00')
    except ValueError:
        return file


# ------------------------------------------------------------------ the result, both rounds
result = {'lula': n2['L'], 'flavio': n2['F'], 'lulaPct': pct(n2['L'], n2['L'] + n2['F']), 'flavioPct': pct(n2['F'], n2['L'] + n2['F']),
          'valid': n2['valid'], 'blank': n2['blank'], 'null': n2['null'], 'abstention': n2['A'], 'electorate': n2['E'], 'turnout': n2['turnout'],
          'abstentionPct': pct(n2['A'], n2['E']), 'margin': n2['L'] - n2['F'], 'tseFile': brt(n2['file']), 'pst': n2['pst'],
          'proclaimed': any(s.lower().startswith('eleit') for s in n2['status'].values()), 'url': TSE['runoff']['BR']['url']}
round1 = {'flavio': n1['F'], 'lula': n1['L'], 'others': n1['others'], 'othersTotal': n1['O'], 'valid': n1['valid'], 'blank': n1['blank'], 'null': n1['null'],
          'abstention': n1['A'], 'electorate': n1['E'], 'turnout': n1['turnout'], 'abstentionPct': pct(n1['A'], n1['E']),
          'flavioPct': pct(n1['F'], n1['valid']), 'lulaPct': pct(n1['L'], n1['valid']), 'twoWayLula': pct(n1['L'], n1['L'] + n1['F']),
          'tseFile': brt(n1['file']), 'url': TSE['round1']['BR']['url']}

# ------------------------------------------------------------------ the polls
asof = dt.date(2026, 10, 24)
runoff_polls = []
for p in POLLS['polls']:
    if p.get('lulaValid') is None or not p.get('end'):
        continue
    runoff_polls.append({'pollster': p['pollster'], 'sponsor': p.get('sponsor'), 'start': p.get('start'), 'end': p['end'], 'n': p.get('n'), 'method': p.get('method'),
                         'lula': p['lulaValid'], 'url': p.get('url'), 'released': p.get('released')})
runoff_polls.sort(key=lambda p: p['end'])
latest = {}
for p in runoff_polls:  # the Brazil desk's average: each pollster's latest poll ending in the 7 days before Oct. 24
    if (asof - dt.date.fromisoformat(p['end'])).days <= 7:
        latest[p['pollster']] = p
finals = sorted(latest.values(), key=lambda p: (p['end'], p['pollster']), reverse=True)
avg = round(sum(p['lula'] for p in finals) / len(finals), 2)
polls = {'all': runoff_polls, 'finals': finals, 'avgLula': avg, 'avgFlavio': round(100 - avg, 2), 'n': len(finals),
         'method': 'The simple mean of each pollster’s latest poll that ended in the 7 days before Oct. 24 (the Brazil desk’s method), in shares of valid votes.'}

# ------------------------------------------------------------------ markets: the desk's reads plus published intraday prices
mk = []
for h in MK.get('history') or []:
    if h.get('flavio') is None:
        continue
    t = h['t'] if 'T' in h['t'] else h['t'] + 'T12:00:00Z'
    mk.append({'t': t, 'flavio': h['flavio'], 'venue': h.get('venue') or 'Polymarket', 'kalshi': h.get('kalshiFlavio'), 'src': h.get('source') or 'Brazil desk read of the Polymarket API'})
mk += NOTES['marketPoints']
mk.sort(key=lambda m: dt.datetime.fromisoformat(m['t'].replace('Z', '+00:00')))
markets = {'series': mk, 'volume': (MK.get('pres') or {}).get('volume'), 'volumeAsOf': (MK.get('pres') or {}).get('asOf'), 'notes': NOTES['marketNotes']}

# ------------------------------------------------------------------ the count as it came in
count = [{'t': h['t'], 'pst': h['pst'], 'lula': h['lula'], 'src': 'TSE file, read by the Brazil desk'} for h in RES.get('history') or [] if h.get('pst')]
count += NOTES['countPoints']
count.append({'t': brt(n2['file']), 'pst': float(str(n2['pst']).replace(',', '.')), 'lula': result['lulaPct'], 'src': 'TSE file'})
seen, cc = set(), []
for c in sorted(count, key=lambda c: (c['pst'], c['t'])):
    k = round(c['pst'], 2)
    if k in seen:
        continue
    seen.add(k); cc.append(c)
count = cc

# ------------------------------------------------------------------ states and regions
states, regions = [], {}
for u in UNITS:
    a, b = R1[u], R2[u]
    reg = units.get(u, {}).get('region') or 'ZZ'
    s = {'uf': u, 'name': units.get(u, {}).get('name') or 'Abroad', 'region': reg,
         'r1Lula': pct(a['L'], a['L'] + a['F']), 'r2Lula': pct(b['L'], b['L'] + b['F']),
         'y22Lula': (units.get(u, {}).get('runoff2022') or {}).get('lula'),
         'abst1': pct(a['A'], a['E']), 'abst2': pct(b['A'], b['E']), 'E': b['E'],
         'lula': b['L'], 'flavio': b['F'], 'lulaGain': b['L'] - a['L'], 'flavioGain': b['F'] - a['F'],
         'others1': a['O'], 'bn1': a['BN'], 'bn2': b['BN'], 'a1': a['A'], 'a2': b['A']}
    states.append(s)
    g = regions.setdefault(reg, {'id': reg, 'name': REGION[reg], 'E': 0, 'lula': 0, 'flavio': 0, 'lula1': 0, 'flavio1': 0, 'others1': 0, 'bn1': 0, 'bn2': 0, 'a1': 0, 'a2': 0})
    for k, v in (('E', b['E']), ('lula', b['L']), ('flavio', b['F']), ('lula1', a['L']), ('flavio1', a['F']), ('others1', a['O']), ('bn1', a['BN']), ('bn2', b['BN']), ('a1', a['A']), ('a2', b['A'])):
        g[k] += v
for g in regions.values():
    g['r2Lula'] = pct(g['lula'], g['lula'] + g['flavio']); g['r1Lula'] = pct(g['lula1'], g['lula1'] + g['flavio1'])
    g['abst1'] = pct(g['a1'], g['E']); g['abst2'] = pct(g['a2'], g['E'])
states.sort(key=lambda s: -s['E'])

# ------------------------------------------------------------------ where the first round's voters went (an estimate)
SRC, DST = ('F', 'L', 'O', 'BN', 'A'), ('F', 'L', 'BN', 'A')


def fit(us):
    X = np.array([[R1[u][k] / R1[u]['E'] for k in SRC] for u in us])
    Y = np.array([[R2[u][k] / R2[u]['E'] for k in DST] for u in us])
    w = np.array([R1[u]['E'] for u in us], float); w /= w.sum()
    f = lambda t: float((w[:, None] * ((X @ t.reshape(5, 4)) - Y) ** 2).sum()) * 1e4
    cons = [{'type': 'eq', 'fun': (lambda t, i=i: t.reshape(5, 4)[i].sum() - 1)} for i in range(5)]
    t0 = np.array([[1, 0, 0, 0], [0, 1, 0, 0], [.4, .4, .1, .1], [.2, .2, .4, .2], [.05, .05, .02, .88]], float).ravel()
    r = minimize(f, t0, bounds=[(0, 1)] * 20, constraints=cons, method='SLSQP', options={'maxiter': 4000, 'ftol': 1e-13})
    return r.x.reshape(5, 4)


T = fit(UNITS)
loo = np.array([fit([v for v in UNITS if v != u]) for u in UNITS])
flows = np.zeros((5, 4))
for u in UNITS:
    flows += np.array([R1[u][k] for k in SRC], float)[:, None] * T
# rake the national flows to the actual totals of both rounds (rows: round 1 groups; columns: runoff groups)
rows_t = np.array([n1[k] for k in SRC], float); cols_t = np.array([n2[k] for k in DST], float)
cols_t *= rows_t.sum() / cols_t.sum()
F = flows.copy()
for _ in range(200):
    F *= (rows_t / F.sum(1).clip(1))[:, None]
    F *= (cols_t / F.sum(0).clip(1))[None, :]
flow = {'src': ['Flávio', 'Lula', 'Other candidates', 'Blank or null', 'Didn’t vote'], 'dst': ['Flávio', 'Lula', 'Blank or null', 'Didn’t vote'],
        'votes': [[int(round(x)) for x in r] for r in F], 'share': [[round(float(x), 3) for x in r] for r in T],
        'lo': [[round(float(x), 3) for x in r] for r in loo.min(0)], 'hi': [[round(float(x), 3) for x in r] for r in loo.max(0)],
        'units': len(UNITS)}

data = {'asOf': TSE['at'], 'result': result, 'round1': round1, 'polls': polls, 'markets': markets, 'count': count, 'states': states,
        'regions': sorted(regions.values(), key=lambda g: -g['E']), 'flow': flow}
data.update({k: NOTES[k] for k in ('history', 'reads', 'extension', 'videos', 'why', 'sources', 'pollsR1')})
with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write('/* The Hinge, Brazil tab: built by the-hinge/src/brazil/build_brazil.py */\nconst BR = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f"brazil_data.js: Lula {result['lulaPct']} / Flávio {result['flavioPct']} (TSE file {result['tseFile']}, pst {result['pst']}); "
      f"poll average Lula {avg} from {len(finals)} pollsters; {len(mk)} market points; {len(count)} count points; {len(states)} units")
