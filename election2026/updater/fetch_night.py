#!/usr/bin/env python3
"""Election night as it happened -> data/night2026.json

From the New York Times' public results files for the Senate, the governors and the House (AP counts): every race's
call (the winner's party and the time the call was accepted), its statewide or district count, the counties inside
each House district (so the page can draw a district's counties reaching its seat), the national vote tallies by
party over the night (NYT's party-control time series) and each state's poll-closing time. Nothing is modeled here.

Runs on GitHub Actions (.github/workflows/counties.yml) beside fetch_counties.py.
"""
import json, os, sys, time, gzip, io, urllib.request, urllib.error, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..', 'data')
OUT = os.path.join(D, 'night2026.json')
BASE = 'https://static01.nyt.com/elections-assets/pages/data/2026-11-03/results-{slug}.json'
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      'Accept': 'application/json', 'Accept-Encoding': 'gzip'}
DEBUG = '--debug' in sys.argv

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
        if r.headers.get('Content-Encoding') == 'gzip': raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
        return json.loads(raw.decode('utf-8'))

def pid(meta, cid):
    m = (meta or {}).get(cid) or {}
    p = m.get('party_id') or m.get('party') or ''
    if isinstance(p, dict): p = p.get('nyt_id') or p.get('party_id') or p.get('name') or ''
    p = str(p).lower()
    if p in ('democrat', 'dem', 'democratic', 'd'): return 'D'
    if p in ('republican', 'gop', 'rep', 'r'): return 'R'
    return 'I' if p else '?'

def cname(meta, cid):
    m = (meta or {}).get(cid) or {}
    return ' '.join(x for x in [m.get('first_name'), m.get('last_name')] if x) or cid

def votes(c):
    v = c.get('votes'); return v.get('total', 0) if isinstance(v, dict) else (v or 0)

def sides(unit, meta):
    d = r = o = 0
    for c in unit.get('candidates') or []:
        p = pid(meta, c.get('nyt_id')); v = votes(c)
        if p == 'D': d += v
        elif p == 'R': r += v
        else: o += v
    return d, r, o, unit.get('total_votes') if unit.get('total_votes') is not None else d + r + o

def race_rec(rc, with_units):
    meta = rc.get('candidate_metadata') or {}
    top = rc.get('top_reporting_unit') or {}
    oc = rc.get('outcome') or {}
    won = oc.get('won') or []
    wp = pid(meta, won[0]) if won else None
    acc = oc.get('winner_accepted_at') or []
    d, r, o, t = sides(top, meta)
    rec = {'id': rc.get('nyt_id'), 'st': top.get('state_postal') or (rc.get('nyt_id') or '')[:2], 'office': rc.get('office_id'),
           'seat': rc.get('seat') if rc.get('seat') not in ('None', None) else None, 'desc': rc.get('seat_description'),
           'won': [cname(meta, w) for w in won], 'wp': wp, 'calledAt': acc[0] if acc else None, 'calledBy': oc.get('called_by') or [],
           'status': rc.get('race_call_status'), 'uncontested': bool(rc.get('uncontested')), 'd': d, 'r': r, 'o': o, 't': t,
           'eevp': top.get('eevp'), 'exp': top.get('total_expected_vote'), 'inc': rc.get('has_incumbent'),
           'incParty': None, 'rating': rc.get('general_rating') or rc.get('rating'),
           'cands': [{'n': cname(meta, cid), 'p': pid(meta, cid), 'v': votes(c), 'inc': bool((meta.get(cid) or {}).get('incumbent'))} for cid in [c.get('nyt_id') for c in top.get('candidates') or []] for c in [next((x for x in top.get('candidates') or [] if x.get('nyt_id') == cid), {})]]}
    if with_units:
        rec['units'] = []
        for u in rc.get('reporting_units') or []:
            if u.get('level') == 'state' or not u.get('fips_county'): continue
            ud, ur, uo, ut = sides(u, meta)
            rec['units'].append([(u.get('fips_state') or '') + u.get('fips_county'), ud, ur, ut, u.get('eevp'), u.get('level')])
    return rec

def main():
    res = {'asOf': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
           'source': 'The New York Times (results-senate/governor/house.json, vote counts from The Associated Press)', 'races': [], 'series': {}, 'control': {}, 'pollClose': {}, 'errors': []}
    for slug, with_units in (('senate', False), ('governor', False), ('house', True)):
        try:
            j = get(BASE.format(slug=slug))
        except Exception as e:
            res['errors'].append(f'{slug}: {type(e).__name__} {str(e)[:120]}'); print(slug, 'ERR', e); continue
        races = j.get('races') or []
        if DEBUG and races:
            rc = races[0]
            print(slug, 'race keys', list(rc.keys())[:40])
            print(slug, 'outcome', json.dumps(rc.get('outcome'))[:400])
            ru = rc.get('reporting_units') or []
            print(slug, 'units', len(ru), json.dumps(ru[1] if len(ru) > 1 else ru[:1])[:600])
            print(slug, 'timeseries keys', list((j.get('partyControlTimeseriesData') or {}).keys()), json.dumps(((j.get('partyControlTimeseriesData') or {}).get('results') or [{}])[0])[:900])
            print(slug, 'control', json.dumps(j.get('partyControlData'))[:900])
            print(slug, 'pollClosingTimes', json.dumps((j.get('pollClosingTimes') or [])[:2])[:500])
        n = 0
        for rc in races:
            rt = str(rc.get('race_type_id') or rc.get('type') or '').lower()
            if 'primary' in rt or 'runoff' in rt: continue
            if rc.get('election_date') and rc.get('election_date') != '2026-11-03': continue
            try:
                res['races'].append(race_rec(rc, with_units)); n += 1
            except Exception as e:
                import traceback; traceback.print_exc(); res['errors'].append(f'{rc.get("nyt_id")}: {e}')
        # the night's tallies: every point in the party-control time series (seats and popular vote by party)
        ts = (j.get('partyControlTimeseriesData') or {}).get('results') or []
        ser = []
        for pt in ts:
            est = pt.get('nyt_model_estimates') or {}
            row = {'t': pt.get('nyt_updated_at'), 'p': {}}
            for off, lst in est.items():
                for e in lst or []:
                    row['p'][str(e.get('nyt_party_id') or e.get('party_id') or e.get('id'))] = {'seats': e.get('seats'), 'pv': e.get('popular_vote'), 'vm': e.get('voteshare_margin')}
            ser.append(row)
        res['series'][slug] = ser
        res['control'][slug] = j.get('partyControlData')
        for pc in j.get('pollClosingTimes') or []:
            st = (pc.get('reporting_unit') or {}).get('state_postal')
            if st: res['pollClose'][st] = {'t': pc.get('poll_closing_time'), 'et': pc.get('poll_closing_time_display_et'), 'text': pc.get('poll_closing_text')}
        print(slug, n, 'races;', len(ser), 'time points;', len(res['pollClose']), 'poll-close entries')
        time.sleep(0.5)
    os.makedirs(D, exist_ok=True)
    json.dump(res, open(OUT, 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
    print('wrote', OUT, os.path.getsize(OUT), 'bytes;', len(res['races']), 'races;', len(res['errors']), 'errors')

if __name__ == '__main__': main()
