#!/usr/bin/env python3
"""County-level 2026 Senate and governor results -> data/counties2026.json

Reads the New York Times' public results files (one per state, AP-provided counts), keeps only the general-election
Senate and governor races, and writes a compact file: every race's statewide count and every reporting unit (county,
parish, borough, planning region or district) with the Democratic, Republican, other and total votes and AP's
"expected vote" percentage. Nothing is computed here beyond sums; shifts against 2024 are worked out by
news/wave/build.py from data/baseline.json.

Runs on GitHub Actions (.github/workflows/counties.yml); the sandbox cannot reach nytimes.com.
"""
import json, os, re, sys, time, gzip, io, urllib.request, urllib.error, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..', 'data')
OUT = os.path.join(D, 'counties2026.json')
BASE = 'https://static01.nyt.com/elections-assets/pages/data/2026-11-03/results-{slug}.json'
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      'Accept': 'application/json', 'Accept-Encoding': 'gzip'}
STATES = {'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut',
          'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
          'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan',
          'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire',
          'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
          'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas',
          'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'}
DEBUG = '--debug' in sys.argv

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        raw = r.read()
        if r.headers.get('Content-Encoding') == 'gzip': raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
        return json.loads(raw.decode('utf-8'))

def party(meta, cid):
    m = (meta or {}).get(cid) or {}
    p = (m.get('party_id') or m.get('party') or '').lower()
    return {'democrat': 'D', 'republican': 'R', 'dem': 'D', 'gop': 'R', 'rep': 'R'}.get(p, 'I' if p else '?')

def cname(meta, cid):
    m = (meta or {}).get(cid) or {}
    n = ' '.join(x for x in [m.get('first_name'), m.get('last_name')] if x) or m.get('name') or cid
    return n

def unit_votes(u, meta, dkey, rkey):
    d = r = o = 0
    for c in u.get('candidates') or []:
        v = c.get('votes'); v = v.get('total', 0) if isinstance(v, dict) else (v or 0)
        cid = c.get('nyt_id') or c.get('candidate_id')
        if cid == dkey: d += v
        elif cid == rkey: r += v
        else: o += v
    tot = u.get('total_votes')
    if tot is None: tot = d + r + o
    return d, r, o, tot

def pick_sides(race):
    """the two sides: the Democrat and the Republican with the most votes statewide; if a side has no nominee
    (Nebraska's independent), the leading non-major candidate takes that side and the race says so."""
    meta = race.get('candidate_metadata') or {}
    top = race.get('top_reporting_unit') or {}
    totals = {}
    for c in top.get('candidates') or []:
        v = c.get('votes'); v = v.get('total', 0) if isinstance(v, dict) else (v or 0)
        totals[c.get('nyt_id')] = v
    byp = {'D': [], 'R': [], 'I': [], '?': []}
    for cid in totals: byp[party(meta, cid)].append(cid)
    for k in byp: byp[k].sort(key=lambda c: -totals[c])
    dkey = byp['D'][0] if byp['D'] else None
    rkey = byp['R'][0] if byp['R'] else None
    note = None
    if not dkey and byp['I']:
        dkey = byp['I'][0]; note = f"no Democrat: the independent {cname(meta, dkey)} counted as the Democratic side"
    if not rkey and byp['I']:
        cand = [c for c in byp['I'] if c != dkey]
        if cand: rkey = cand[0]; note = f"no Republican: the independent {cname(meta, rkey)} counted as the Republican side"
    return dkey, rkey, note, totals, meta

def extract(race):
    dkey, rkey, note, totals, meta = pick_sides(race)
    top = race.get('top_reporting_unit') or {}
    out = {'id': race.get('nyt_id'), 'office': race.get('office'), 'officeId': race.get('office_id'), 'seat': race.get('seat_description') or race.get('seat'),
           'uncontested': bool(race.get('uncontested')), 'callStatus': race.get('race_call_status'),
           'won': (race.get('outcome') or {}).get('won') or [], 'calledBy': (race.get('outcome') or {}).get('called_by') or [],
           'dem': {'id': dkey, 'name': cname(meta, dkey) if dkey else None, 'party': party(meta, dkey) if dkey else None, 'votes': totals.get(dkey, 0)},
           'rep': {'id': rkey, 'name': cname(meta, rkey) if rkey else None, 'party': party(meta, rkey) if rkey else None, 'votes': totals.get(rkey, 0)},
           'others': [{'name': cname(meta, c), 'party': party(meta, c), 'votes': totals[c]} for c in totals if c not in (dkey, rkey)],
           'total': top.get('total_votes'), 'expected': top.get('total_expected_vote'), 'eevp': top.get('eevp'),
           'precincts': [top.get('precincts_reporting'), top.get('precincts_total')], 'updated': top.get('provider_updated_at') or race.get('updated_at'),
           'note': note, 'units': {}}
    for u in race.get('reporting_units') or []:
        lvl = u.get('level')
        if lvl == 'state': continue
        fs, fc = u.get('fips_state'), u.get('fips_county')
        key = (fs or '') + (fc or '') if fc else (u.get('nyt_id') or u.get('name'))
        d, r, o, tot = unit_votes(u, meta, dkey, rkey)
        out['units'][key] = {'n': u.get('name'), 'l': lvl, 'd': d, 'r': r, 'o': o, 't': tot, 'e': u.get('eevp'), 'p': [u.get('precincts_reporting'), u.get('precincts_total')]}
    return out

def main():
    res = {'asOf': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
           'source': 'The New York Times (results-<state>.json, vote counts from The Associated Press)', 'states': {}, 'errors': []}
    for st, name in STATES.items():
        slug = name.lower().replace(' ', '-')
        url = BASE.format(slug=slug)
        try:
            j = get(url)
        except urllib.error.HTTPError as e:
            res['errors'].append(f'{st}: HTTP {e.code}'); print(st, 'HTTP', e.code); continue
        except Exception as e:
            res['errors'].append(f'{st}: {type(e).__name__} {str(e)[:120]}'); print(st, 'ERR', e); continue
        races = j.get('races') or []
        if DEBUG and st == 'TX':
            for rc in races:
                if rc.get('office_id') == 'S':
                    print('TX senate race keys:', list(rc.keys()))
                    ru = rc.get('reporting_units') or []
                    print('reporting_units:', len(ru), json.dumps(ru[1] if len(ru) > 1 else ru[:1])[:1500])
                    print('candidate_metadata:', json.dumps(rc.get('candidate_metadata'))[:800])
                    print('top:', json.dumps(rc.get('top_reporting_unit'))[:1200])
                    break
        keep = {}
        for rc in races:
            oid = rc.get('office_id')
            if oid not in ('S', 'G'): continue
            rt = (rc.get('race_type_id') or rc.get('type') or 'general')
            if str(rt).lower() not in ('general', 'g', 'general election'): continue
            if not rc.get('reporting_units'): continue
            ex = extract(rc)
            # a state can have two Senate races (Ohio, Florida: a special beside none this year, but keep both keyed by seat)
            k = oid if oid not in keep else oid + '2'
            keep[k] = ex
        res['states'][st] = {'name': name, 'races': keep, 'nRaces': len(races)}
        print(st, {k: (v['dem']['name'], v['dem']['votes'], v['rep']['name'], v['rep']['votes'], len(v['units']), v['eevp']) for k, v in keep.items()})
        time.sleep(0.4)
    os.makedirs(D, exist_ok=True)
    json.dump(res, open(OUT, 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
    print('wrote', OUT, os.path.getsize(OUT), 'bytes;', len(res['states']), 'states;', len(res['errors']), 'errors')

if __name__ == '__main__': main()
