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


def night():
    """news/wave/data/night.json: the night's calls, counts and poll-close times for the replay"""
    N = json.load(open(os.path.join(ROOT, 'election2026', 'data', 'night2026.json'), encoding='utf-8'))
    R = json.load(open(os.path.join(ROOT, 'election2026', 'data', 'results.json'), encoding='utf-8'))
    T0 = dt.datetime(2026, 11, 3, 23, 0, tzinfo=dt.timezone.utc)  # 6 p.m. ET
    def mins(iso):
        if not iso: return None
        d = dt.datetime.fromisoformat(iso.replace('Z', '+00:00'))
        return round((d - T0).total_seconds() / 60, 2)
    close = {st: mins(v['t']) for st, v in N['pollClose'].items() if v.get('t')}
    close = {st: (m + 1440 if m is not None and m < 0 else m) for st, m in close.items()}  # NYT dates Alaska's close a day early
    # how fast each state counted: pct(t) = ceil * (1 - exp(-(t - close) / tau)); tau fitted where the Election Desk
    # recorded a "% in" during the night, otherwise by region
    DEFAULT = {'E': 110, 'C': 150, 'M': 240, 'W': 900}
    REGION = {'CA': 'W', 'OR': 'W', 'WA': 'W', 'NV': 'W', 'AZ': 'W', 'HI': 'W', 'AK': 'W', 'UT': 'M', 'ID': 'M', 'MT': 'M', 'WY': 'M', 'CO': 'M', 'NM': 'M',
              'ND': 'C', 'SD': 'C', 'NE': 'C', 'KS': 'C', 'OK': 'C', 'TX': 'C', 'MN': 'C', 'IA': 'C', 'MO': 'C', 'AR': 'C', 'LA': 'C', 'WI': 'C', 'IL': 'C', 'MS': 'C', 'AL': 'C', 'TN': 'C', 'KY': 'C', 'IN': 'C', 'MI': 'C', 'OH': 'C'}
    import math
    tau = {}
    for rid, rc in (R.get('races') or {}).items():
        st = rid[:2]; pct = rc.get('pctIn'); at = mins(rc.get('asOf'))
        if not pct or pct < 5 or at is None or at > 600 or st not in close or at <= close[st] or pct >= 99.5: continue
        dtm = at - close[st]; frac = min(pct / 100, 0.985)
        tau[st] = min(900, max(20, round(-dtm / math.log(1 - frac))))
    for st in close:
        tau.setdefault(st, DEFAULT.get(REGION.get(st, 'E'), 110))
    races, counties, stateVotes = [], {}, {}
    for r in N['races']:
        if r['id'].startswith('US-') or r.get('st') == 'US': continue
        seat = None
        if r['office'] == 'H':
            try: seat = int(r['id'].split('-H-')[1].split('-')[0])
            except Exception: seat = r.get('seat')
        rec = {'id': r['id'], 'o': r['office'], 'st': r['st'], 'seat': seat, 'p': r.get('wp'), 'at': mins(r.get('calledAt')), 'd': r['d'], 'r': r['r'], 't': r['t'], 'e': r.get('eevp'),
               'won': r.get('won') or [], 'cands': [[c['n'], c['p'], c['v']] for c in (r.get('cands') or [])][:4], 'unc': r.get('uncontested'), 'g': bool(r.get('gained'))}
        if r['office'] == 'H':
            ck = {u[0] for u in (r.get('units') or []) if u[5] == 'county'}
            keep = [u for u in (r.get('units') or []) if u[5] == 'county' or (u[5] == 'city' and u[0] not in ck)]
            rec['u'] = sorted({u[0] for u in keep})
            for u in keep:
                c = counties.setdefault(u[0], [0, 0, 0]); c[0] += u[1]; c[1] += u[2]; c[2] += u[3]
            sv = stateVotes.setdefault(r['st'], [0, 0, 0]); sv[0] += r['d']; sv[1] += r['r']; sv[2] += r['t']
        races.append(rec)
    ceil = {}
    for r in N['races']:
        if r['office'] == 'H' and r.get('eevp') and not r['id'].startswith('US-'):
            ceil.setdefault(r['st'], []).append(r['eevp'])
    ceil = {st: round(sum(v) / len(v) / 100, 3) for st, v in ceil.items()}
    ctl = {}
    for k, v in (N.get('control') or {}).items():
        try:
            offs = v['results'][0]['offices']
            for oid, o in offs.items():
                ctl[oid] = {'called': o.get('num_races_called'), 'total': o.get('total'), 'toWin': (o.get('to_win') or {}).get('DEM'),
                            'D': (o.get('party_balance') or {}).get('DEM', {}).get('seats'), 'R': (o.get('party_balance') or {}).get('GOP', {}).get('seats'),
                            'flipsD': (o.get('party_balance') or {}).get('DEM', {}).get('flip_count'), 'flipsR': (o.get('party_balance') or {}).get('GOP', {}).get('flip_count'),
                            'controlledAt': mins((o.get('party_balance') or {}).get('DEM', {}).get('controlled_at')) if (o.get('party_balance') or {}).get('DEM', {}).get('winner') else mins((o.get('party_balance') or {}).get('GOP', {}).get('controlled_at'))}
        except Exception: pass
    # the captions: the night's milestones, in order, for the replay to narrate
    NAMES = {'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'}
    def loser(r):
        cs = sorted([c for c in (r.get('cands') or []) if c[0] not in (r.get('won') or [])], key=lambda c: -c[2]); return cs[0][0] if cs else ''
    caps = []
    closes = {}
    for st, m in close.items():
        if st in ('AK', 'HI', 'DC'): continue
        closes.setdefault(m, []).append(st)
    caps.append({'at': 0, 'k': 'The first polls close', 't': 'The night begins in Kentucky and Indiana', 's': 'Six o’clock on the East Coast: the first precincts close in the two states that straddle the time line.'})
    for m, sts in sorted(closes.items()):
        if m <= 0 or len(sts) < 3: continue
        caps.append({'at': m, 'k': f'Polls close in {len(sts)} states', 't': ', '.join(NAMES[s] for s in sorted(sts)[:5]) + (f' and {len(sts) - 5} more' if len(sts) > 5 else ''), 's': ''})
    called = sorted([r for r in N['races'] if r.get('calledAt') and r.get('wp')], key=lambda r: r['calledAt'])
    if called:
        f = called[0]; fm = mins(f['calledAt'])
        who = f['won'][0] if f['won'] else ''
        caps.append({'at': fm, 'k': 'The first call', 't': f"{who} {'holds' if not f.get('gained') else 'wins'} {NAMES.get(f['st'], f['st'])}{'’s Senate seat' if f['office'] == 'S' else ' governor' if f['office'] == 'G' else '-' + str(f['id'].split('-H-')[1].split('-')[0]) if '-H-' in f['id'] else ''}", 's': 'AP’s first call of the night, as the polls close.'})
    for r in called:
        m = mins(r['calledAt'])
        if m is None or m > 540 or not r.get('gained') or r['office'] not in ('S', 'G'): continue
        who = r['won'][0] if r['won'] else ''
        caps.append({'at': m, 'k': f"{NAMES.get(r['st'], r['st'])} flips", 't': f"{who} takes the {'Senate seat' if r['office'] == 'S' else 'governorship'} from {'the Republicans' if r['wp'] == 'D' else 'the Democrats'}", 's': f"AP’s call at {(dt.datetime(2026, 11, 3, 18, 0) + dt.timedelta(minutes=m)).strftime('%-I:%M %p')} ET, over {loser(r)}.", 'c': r['wp']})
    S_ctl, H_ctl = ctl.get('S') or {}, ctl.get('H') or {}
    if S_ctl.get('controlledAt') is not None:
        caps.append({'at': S_ctl['controlledAt'], 'k': 'The Senate', 't': 'Democrats win the Senate', 's': f"AP’s count reaches a majority at {(dt.datetime(2026, 11, 3, 18, 0) + dt.timedelta(minutes=S_ctl['controlledAt'])).strftime('%-I:%M %p')} ET.", 'c': 'D', 'big': True})
    if H_ctl.get('controlledAt') is not None and H_ctl['controlledAt'] <= 540:
        caps.append({'at': H_ctl['controlledAt'], 'k': 'The House', 't': 'Democrats take the House', 's': f"The 218th seat is called at {(dt.datetime(2026, 11, 3, 18, 0) + dt.timedelta(minutes=H_ctl['controlledAt'])).strftime('%-I:%M %p')} ET.", 'c': 'D', 'big': True})
    caps.sort(key=lambda c: c['at'])
    out = {'v': 1, 'asOf': N['asOf'], 'source': N['source'], 't0': '2026-11-03T23:00:00Z', 'end': 540, 'close': close, 'tau': tau, 'ceil': ceil,
           'races': races, 'counties': counties, 'stateVotes': stateVotes, 'control': ctl, 'closeText': {st: v.get('et') for st, v in N['pollClose'].items()}, 'captions': caps}
    p = os.path.join(HERE, 'data', 'night.json')
    json.dump(out, open(p, 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
    print('wrote', p, os.path.getsize(p), 'bytes:', len(races), 'races,', sum(1 for r in races if r['at'] is not None), 'called,', len(counties), 'counties,', len(caps), 'captions; tau fitted for', sorted(k for k in tau if DEFAULT.get(REGION.get(k, 'E'), 110) != tau[k]))

if __name__ == '__main__':
    main()
    try: night()
    except FileNotFoundError as e: print('night: skipped,', e)

