#!/usr/bin/env python3
"""The blue wave, county by county -> news/wave/data/shift.json

For every state with a U.S. Senate or governor race on Nov. 3, 2026, compares each county's 2026 vote with its 2024
presidential vote (Harris–Trump). The margin is (Democratic − Republican) / all votes cast, in points; the shift is the
2026 margin minus the 2024 margin, so a positive shift is a county that moved toward the Democrats.

Which race: the Senate race where there is one (it is the federal office nearest a presidential vote), otherwise the
governor's race; both are kept per state so the page can switch. Alaska counts by state House district and has no
county map, so it carries statewide totals only. A county with no 2026 votes reported yet is left out of the counts.

Reads election2026/data/counties2026.json (fetch_counties.py) and election2026/data/baseline.json; `check` validates.
"""
import json, os, sys, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
C = json.load(open(os.path.join(ROOT, 'election2026', 'data', 'counties2026.json'), encoding='utf-8'))
B = json.load(open(os.path.join(ROOT, 'election2026', 'data', 'baseline.json'), encoding='utf-8'))
G = json.load(open(os.path.join(ROOT, 'election2026', 'data', 'geo.json'), encoding='utf-8'))
OUT = os.path.join(HERE, 'data', 'shift.json')
NAMES = {g['id']: g.get('n') for g in G['objects']['counties']['geometries']}
STATE_NAMES = {g['id']: g.get('n') for g in G['objects']['states']['geometries']}
FIPS2ST = B['fips']  # '48' -> 'TX'
ST2FIPS = {v: k for k, v in FIPS2ST.items()}
ORDER = ['S', 'G']  # which race a state is shown by, when it has both

def margin(d, r, t): return (d - r) / t * 100 if t else None

def race_rec(st, key, rc):
    d, r, t = rc['dem']['votes'], rc['rep']['votes'], rc['total'] or 0
    sb = B['s'].get(ST2FIPS.get(st), [0, 0, 0])
    return {'key': key, 'office': rc['office'], 'seat': rc.get('seat'), 'dem': rc['dem']['name'], 'rep': rc['rep']['name'],
            'demParty': rc['dem']['party'], 'repParty': rc['rep']['party'], 'demVotes': d, 'repVotes': r, 'total': t,
            'eevp': rc.get('eevp'), 'won': rc.get('won') or [], 'calledBy': rc.get('calledBy') or [],
            'winner': 'D' if rc['dem']['id'] in (rc.get('won') or []) else 'R' if rc['rep']['id'] in (rc.get('won') or []) else None,
            'm26': margin(d, r, t), 'm24': margin(sb[0], sb[1], sb[2]), 'note': rc.get('note'), 'uncontested': rc.get('uncontested'),
            'updated': rc.get('updated')}

def main():
    out = {'v': 1, 'asOf': C['asOf'], 'built': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
           'source': C['source'], 'baseline': 'election2026/data/baseline.json (2024 presidential, county level)',
           'states': {}, 'counties': {}, 'noRace': [], 'fields': ['m24', 'm26', 'shift', 'eevp', 'race', 'd26', 'r26', 't26', 'd24', 'r24', 't24']}
    left = right = same = counted = 0
    for st, S in C['states'].items():
        races = S.get('races') or {}
        use = next((k for k in ORDER if k in races and not races[k].get('uncontested') and races[k]['dem']['id'] and races[k]['rep']['id']), None)
        if not use: use = next((k for k in ORDER if k in races), None)
        if not use:
            out['noRace'].append(st); continue
        rec = {'name': S['name'], 'use': use, 'races': {k: race_rec(st, k, rc) for k, rc in races.items()}, 'counties': 0, 'left': 0, 'right': 0, 'same': 0}
        rc = races[use]
        if rc['dem']['id'] is None or rc['rep']['id'] is None or rc.get('uncontested'):
            rec['skipped'] = 'one side only'; out['states'][st] = rec; continue
        sf = ST2FIPS.get(st)
        for fips, u in (rc.get('units') or {}).items():
            if not fips.startswith(sf or '--') or len(fips) != 5: continue
            if u['l'] not in ('county', 'parish', 'borough', 'census_area', 'city', 'independent_city', 'county_sum'): continue
            b = B['c'].get(fips)
            if not b: continue
            t26 = u['t'] or 0
            if t26 <= 0: continue
            m24 = margin(b[0], b[1], b[2]); m26 = margin(u['d'], u['r'], t26)
            if m24 is None or m26 is None: continue
            sh = m26 - m24
            out['counties'][fips] = [round(m24, 2), round(m26, 2), round(sh, 2), u.get('e'), use, u['d'], u['r'], t26, b[0], b[1], b[2]]
            rec['counties'] += 1; counted += 1
            if sh > 0: rec['left'] += 1; left += 1
            elif sh < 0: rec['right'] += 1; right += 1
            else: rec['same'] += 1; same += 1
        out['states'][st] = rec
    # the other race's counties, for the switch (kept apart so the main file stays small)
    alt = {}
    for st, S in C['states'].items():
        rec = out['states'].get(st)
        if not rec: continue
        for k, rc in (S.get('races') or {}).items():
            if k == rec['use'] or rc['dem']['id'] is None or rc['rep']['id'] is None: continue
            sf = ST2FIPS.get(st)
            for fips, u in (rc.get('units') or {}).items():
                b = B['c'].get(fips)
                if not b or not fips.startswith(sf or '--') or len(fips) != 5 or not u['t']: continue
                m24 = margin(b[0], b[1], b[2]); m26 = margin(u['d'], u['r'], u['t'])
                if m24 is None or m26 is None: continue
                alt[fips] = [round(m24, 2), round(m26, 2), round(m26 - m24, 2), u.get('e'), k, u['d'], u['r'], u['t']]
    out['alt'] = alt
    out['totals'] = {'counted': counted, 'left': left, 'right': right, 'same': same,
                     'mapped': sum(1 for f in NAMES if f[:2] in [ST2FIPS.get(s) for s in out['states'] if 'skipped' not in out['states'][s]])}
    sh = sorted(((v[2], f) for f, v in out['counties'].items()), reverse=True)
    out['top'] = {'left': [[f, NAMES.get(f), FIPS2ST.get(f[:2]), v] for v, f in sh[:25]],
                  'right': [[f, NAMES.get(f), FIPS2ST.get(f[:2]), v] for v, f in sh[-25:][::-1]]}
    # the typical shift (median) and the vote-weighted shift
    vals = sorted(v[2] for v in out['counties'].values())
    out['median'] = vals[len(vals) // 2] if vals else None
    tw = sum(v[7] for v in out['counties'].values()); out['weighted'] = round(sum(v[2] * v[7] for v in out['counties'].values()) / tw, 2) if tw else None
    tx = out['states'].get('TX')
    if tx: out['texas'] = {'counties': tx['counties'], 'left': tx['left'], 'right': tx['right'], 'starr': out['counties'].get('48427')}
    out['names'] = {f: NAMES.get(f) for f in out['counties']}
    out['errors'] = C.get('errors') or []
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
    print('wrote', OUT, os.path.getsize(OUT), 'bytes:', out['totals'], 'median', out['median'], 'weighted', out['weighted'])
    for st, r in sorted(out['states'].items()):
        u = r['races'].get(r['use']) or {}
        print(f"  {st} {r['use']} {r['counties']:4d} counties  left {r['left']:4d} right {r['right']:4d}  m24 {u.get('m24') and round(u['m24'], 1)} -> m26 {u.get('m26') and round(u['m26'], 1)}  {u.get('dem')} v {u.get('rep')} eevp {u.get('eevp')} {r.get('skipped') or ''} {u.get('note') or ''}")
    if out['noRace']: print('  no race:', out['noRace'])
    if out['errors']: print('  errors:', out['errors'])

if __name__ == '__main__': main()
