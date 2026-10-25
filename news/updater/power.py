#!/usr/bin/env python3
"""The Watch's Power desk: what the U.S. grids are burning, what it emits, and what it costs.

  python3 news/updater/power.py           rebuild news/data/power.json (grid data each run, prices daily)

Writes news/data/power.json:
  grid     the Lower 48 and its 13 regions, hourly, from the EIA's Hourly Electric Grid Monitor (Form EIA-930):
           demand, the day-ahead forecast, net generation by fuel for the last 30 hours, and the carbon intensity of
           the electricity generated in each region, from the EIA's average emission rates per fuel.
  whole    wholesale prices where the grid operator publishes them openly: ERCOT (Texas) and NYISO (New York).
  retail   what households pay: the average residential price per kilowatt-hour by state for the last 25 months (EIA
           Form 861M, through the EIA's API), the BLS's average U.S. price per kilowatt-hour, and the electricity line of
           the Consumer Price Index (the BLS's API, or DBnomics when it doesn't answer; nothing older than nine months).
  fuel     natural gas (Henry Hub futures, from markets.json), the fuel that sets most power prices.
The EIA's API needs a key: the repository secret EIA_API_KEY when there is one (free at eia.gov/opendata), the
shared DEMO_KEY otherwise, which allows few requests an hour. Each block that fails keeps its last good copy.
Standard library only.
"""
import datetime as dt
import csv
import gzip
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', 'data'))
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 TheWatch/1.0'
KEY = os.environ.get('EIA_API_KEY', '').strip() or 'DEMO_KEY'
errors = []
# the EIA's 13 regions of the Lower 48, with the grid operator most of each is run by
REGIONS = [
    ('US48', 'Lower 48', '', 'All of the contiguous U.S.'),
    ('CAL', 'California', 'CAISO', 'Most of California'),
    ('CAR', 'Carolinas', 'Duke Energy', 'North and South Carolina'),
    ('CENT', 'Central', 'SPP', 'The Plains, Kansas to the Dakotas'),
    ('FLA', 'Florida', 'FPL and others', 'Most of Florida'),
    ('MIDA', 'Mid-Atlantic', 'PJM', 'Pennsylvania to Virginia, and Ohio, New Jersey, Maryland, D.C., Delaware, West Virginia, parts of Illinois, Indiana, Kentucky, Michigan, North Carolina'),
    ('MIDW', 'Midwest', 'MISO', 'Most of the upper Midwest, Arkansas, Louisiana, Mississippi'),
    ('NE', 'New England', 'ISO New England', 'The six New England states'),
    ('NY', 'New York', 'NYISO', 'New York State'),
    ('NW', 'Northwest', 'Bonneville and others', 'Washington, Oregon, Idaho, Montana, Utah, Wyoming, Nevada'),
    ('SE', 'Southeast', 'Southern Company and others', 'Georgia, Alabama and parts of the Southeast'),
    ('SW', 'Southwest', 'APS, SRP and others', 'Arizona, New Mexico, El Paso'),
    ('TEN', 'Tennessee', 'TVA', 'Tennessee and parts of neighboring states'),
    ('TEX', 'Texas', 'ERCOT', 'Most of Texas'),
]
FUELS = {'COL': 'Coal', 'NG': 'Natural gas', 'NUC': 'Nuclear', 'OIL': 'Oil', 'WAT': 'Hydro', 'SUN': 'Solar', 'WND': 'Wind',
         'OTH': 'Other', 'BAT': 'Batteries', 'PS': 'Pumped storage', 'SNB': 'Solar with storage', 'GEO': 'Geothermal', 'UNK': 'Unknown'}
# kilograms of CO2 per megawatt-hour generated, the EIA's U.S. averages (FAQ "How much carbon dioxide is produced per
# kilowatthour of U.S. electricity generation?"): coal 2.31 lb/kWh, natural gas 0.97, petroleum 2.38
CO2 = {'COL': 1048, 'NG': 440, 'OIL': 1080}


def get(url, headers=None, timeout=40):
    h = {'User-Agent': UA, 'Accept-Encoding': 'gzip', **(headers or {})}
    last = None
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout) as r:
                b = r.read()
                return gzip.decompress(b) if b[:2] == b'\x1f\x8b' else b
        except Exception as ex:  # noqa: BLE001
            last = ex
            if getattr(ex, 'code', 0) in (400, 401, 403, 404):
                break
            time.sleep(5 * (i + 1) if getattr(ex, 'code', 0) == 429 else 2)
    raise last


def eia(path, params, pages=5):
    """Every row the query matches, a page of 5,000 at a time (EIA caps each response at 5,000 rows)."""
    out, off = [], 0
    for _ in range(pages):
        q = [('api_key', KEY)] + params + [('offset', off), ('length', 5000)]
        j = json.loads(get(f'https://api.eia.gov/v2/{path}/data/?' + urllib.parse.urlencode(q, safe='[]')))
        if 'error' in j:
            raise RuntimeError(str(j['error'])[:200])
        r = j.get('response') or {}
        data = r.get('data') or []
        out += data
        off += len(data)
        try:
            total = int(r.get('total') or 0)
        except (TypeError, ValueError):
            total = 0
        if not data or off >= total:
            break
    else:
        errors.append(f'{path}: stopped after {off} rows')
    return out


def now_iso():
    return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# ------------------------------------------------------------------ the grid, hour by hour
def grid():
    start = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=34)).strftime('%Y-%m-%dT%H')
    resp = [('facets[respondent][]', r[0]) for r in REGIONS]
    base = [('frequency', 'hourly'), ('data[0]', 'value'), ('start', start), ('sort[0][column]', 'period'), ('sort[0][direction]', 'desc')]
    rd = eia('electricity/rto/region-data', base + resp + [('facets[type][]', t) for t in ('D', 'DF', 'NG', 'TI')])
    fd = eia('electricity/rto/fuel-type-data', base + resp)
    hours = sorted({r['period'] for r in fd})
    out = {}
    for code, name, op, area in REGIONS:
        rows = [r for r in rd if r.get('respondent') == code]
        series = {t: {r['period']: num(r['value']) for r in rows if r.get('type') == t} for t in ('D', 'DF', 'NG', 'TI')}
        mix = {}
        for r in fd:
            if r.get('respondent') != code:
                continue
            v = num(r.get('value'))
            if v is None:
                continue
            mix.setdefault(r['period'], {})[r.get('fueltype') or 'UNK'] = v
        # the latest hour that has a complete mix (EIA posts the last hour or two partially)
        full = [h for h in hours if h in mix and len(mix[h]) >= max(3, max(len(m) for m in mix.values()) - 1) and sum(x for x in mix[h].values() if x > 0) > 0]
        hrs = full[-30:]
        if not hrs:
            continue
        last = hrs[-1]
        gen = {f: v for f, v in mix[last].items()}
        pos = sum(v for v in gen.values() if v > 0) or 1
        co2 = sum(CO2.get(f, 0) * max(v, 0) for f, v in gen.items()) / pos

        def intensity(h):
            m = mix.get(h) or {}
            p = sum(v for v in m.values() if v > 0)
            return round(sum(CO2.get(f, 0) * max(v, 0) for f, v in m.items()) / p) if p else None
        day_ago = (dt.datetime.strptime(last, '%Y-%m-%dT%H') - dt.timedelta(hours=24)).strftime('%Y-%m-%dT%H')
        out[code] = {
            'n': name, 'op': op, 'area': area, 'at': last,
            'demand': series['D'].get(last), 'forecast': series['DF'].get(last), 'gen': series['NG'].get(last), 'interchange': series['TI'].get(last),
            'mix': {f: round(v) for f, v in sorted(gen.items(), key=lambda x: -x[1])},
            'co2': round(co2), 'co2DayAgo': intensity(day_ago),
            'hours': hrs,
            'd': [series['D'].get(h) for h in hrs], 'df': [series['DF'].get(h) for h in hrs],
            'ci': [intensity(h) for h in hrs],
            'clean': round(100 * sum(max(gen.get(f, 0), 0) for f in ('NUC', 'WAT', 'SUN', 'WND', 'GEO', 'SNB')) / pos, 1),
            'renew': round(100 * sum(max(gen.get(f, 0), 0) for f in ('WAT', 'SUN', 'WND', 'GEO', 'SNB')) / pos, 1),
        }
        dd = [x for x in out[code]['d'] if x is not None]
        if dd:
            out[code]['peak'] = max(dd)
    if not out:
        raise RuntimeError('no regions came back')
    return {'at': now_iso(), 'source': 'EIA Hourly Electric Grid Monitor (Form EIA-930)', 'units': 'MWh per hour; CO2 in kg per MWh generated',
            'regions': out, 'order': [r[0] for r in REGIONS if r[0] in out], 'co2Factors': CO2}


# ------------------------------------------------------------------ wholesale prices where they're open
def wholesale():
    out = {}
    try:
        j = json.loads(get('https://www.ercot.com/api/1/services/read/dashboards/systemWidePrices.json'))
        rows = j.get('rtSppData') or []
        if rows:
            last = rows[-1]
            day = [r.get('hbHubAvg') for r in rows if r.get('hbHubAvg') is not None]
            out['TEX'] = {'n': 'ERCOT hub average', 'price': last.get('hbHubAvg'), 'at': last.get('timestamp'), 'dayAvg': round(sum(day) / len(day), 2) if day else None,
                          'dayHigh': max(day) if day else None, 'src': 'https://www.ercot.com/gridmktinfo/dashboards', 'series': day[-96:]}
    except Exception as ex:  # noqa: BLE001
        errors.append(f'ercot: {ex}')
    try:
        d = dt.datetime.now(dt.timezone(dt.timedelta(hours=-5)))
        txt = None
        for k in (0, 1):
            day = d - dt.timedelta(days=k)
            try:
                txt = get(f'https://mis.nyiso.com/public/csv/realtime/{day:%Y%m%d}realtime_zone.csv').decode('utf-8', 'replace')
                break
            except Exception:  # noqa: BLE001
                continue
        if txt:
            rows = [r for r in csv.DictReader(io.StringIO(txt)) if r.get('Name') == 'N.Y.C.']
            if rows:
                vals = [num(r.get('LBMP ($/MWHr)')) for r in rows]
                vals = [v for v in vals if v is not None]
                out['NY'] = {'n': 'NYISO, New York City zone', 'price': vals[-1], 'at': rows[-1].get('Time Stamp'), 'dayAvg': round(sum(vals) / len(vals), 2),
                             'dayHigh': max(vals), 'src': 'https://www.nyiso.com/real-time-dashboard', 'series': vals[-288::3]}
    except Exception as ex:  # noqa: BLE001
        errors.append(f'nyiso: {ex}')
    if not out:
        raise RuntimeError('no wholesale prices')
    return {'at': now_iso(), 'units': 'dollars per megawatt-hour', 'regions': out}


# ------------------------------------------------------------------ what households pay
STATES = {'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
          'DC': 'District of Columbia', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
          'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
          'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
          'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon',
          'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
          'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming', 'US': 'United States'}


def retail():
    start = (dt.date.today() - dt.timedelta(days=800)).strftime('%Y-%m')
    rows = eia('electricity/retail-sales', [('frequency', 'monthly'), ('data[0]', 'price'), ('data[1]', 'sales'), ('data[2]', 'customers'),
                                            ('facets[sectorid][]', 'RES'), ('start', start), ('sort[0][column]', 'period'),
                                            ('sort[0][direction]', 'asc')])
    by = {}
    for r in rows:
        s = r.get('stateid')
        if s not in STATES:
            continue
        by.setdefault(s, []).append((r['period'], num(r.get('price')), num(r.get('sales')), num(r.get('customers'))))
    out = {}
    for s, xs in by.items():
        xs = [x for x in xs if x[1] is not None]
        if not xs:
            continue
        per, price = xs[-1][0], xs[-1][1]
        prev = next((x[1] for x in xs if x[0] == f'{int(per[:4]) - 1}{per[4:]}'), None)
        use = None
        if xs[-1][2] and xs[-1][3]:  # million kWh / customers -> kWh per home that month
            use = round(xs[-1][2] * 1e6 / xs[-1][3])
        out[s] = {'n': STATES[s], 'month': per, 'price': price, 'yearAgo': prev, 'use': use, 'series': [x[1] for x in xs][-25:]}
    if 'US' not in out:
        raise RuntimeError('no U.S. total')
    return {'at': now_iso(), 'source': 'EIA, Electric Power Monthly (Form EIA-861M)', 'units': 'cents per kWh', 'states': out}


def dbn(series):
    j = json.loads(get(f'https://api.db.nomics.world/v22/series/{series}?observations=1'))
    doc = ((j.get('series') or {}).get('docs') or [{}])[0]
    per, val = doc.get('period') or [], doc.get('value') or []
    pts = [(p, v) for p, v in zip(per, val) if isinstance(v, (int, float))]
    return pts


def bls_api(ids):
    """Monthly points per series from the BLS's own API (version 1 needs no key; 25 queries a day per address)."""
    y = dt.date.today().year
    body = json.dumps({'seriesid': ids, 'startyear': str(y - 3), 'endyear': str(y)}).encode()
    req = urllib.request.Request('https://api.bls.gov/publicAPI/v1/timeseries/data/', data=body,
                                 headers={'Content-Type': 'application/json', 'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        j = json.loads(r.read())
    if j.get('status') != 'REQUEST_SUCCEEDED':
        raise RuntimeError(' '.join(j.get('message') or [])[:200] or 'BLS said no')
    out = {}
    for sr in (j.get('Results') or {}).get('series') or []:
        pts = []
        for d in sr.get('data') or []:
            if not re.fullmatch(r'M(0[1-9]|1[0-2])', d.get('period') or ''):
                continue
            try:
                pts.append((f"{d['year']}-{d['period'][1:]}", float(d['value'])))
            except (KeyError, ValueError):
                pass
        out[sr.get('seriesID')] = sorted(pts)
    return out


def fresh(pts, months=9):
    """Only numbers from the last nine months or so; an old figure is worse than none."""
    if not pts:
        return []
    y, m = map(int, pts[-1][0][:7].split('-'))
    t = dt.date.today()
    return pts if (t.year - y) * 12 + t.month - m <= months else []


def bls():
    out, src = {}, 'BLS'
    ids = ['APU000072610', 'CUUR0000SEHF01']
    try:
        got = bls_api(ids)
    except Exception as ex:  # noqa: BLE001
        errors.append(f'bls api: {ex}')
        got = {}
    for i in ids:
        if not fresh(got.get(i)):
            try:
                pts = dbn(('BLS/ap/' if i.startswith('AP') else 'BLS/cu/') + i)
                if fresh(pts):
                    got[i] = pts
                    src = 'BLS, through DBnomics'
            except Exception as ex:  # noqa: BLE001
                errors.append(f'dbnomics {i}: {ex}')
    pts = fresh(got.get('APU000072610'))
    if pts:
        out['avgPrice'] = {'n': 'Average price, U.S. city average', 'month': pts[-1][0], 'v': pts[-1][1], 'yearAgo': pts[-13][1] if len(pts) > 12 else None,
                           'series': [p[1] for p in pts[-37:]], 'units': 'dollars per kWh'}
    pts = fresh(got.get('CUUR0000SEHF01'))
    if len(pts) > 12:
        out['cpi'] = {'n': 'Consumer Price Index, electricity', 'month': pts[-1][0], 'yoy': round((pts[-1][1] / pts[-13][1] - 1) * 100, 1),
                      'series': [round((pts[i][1] / pts[i - 12][1] - 1) * 100, 1) for i in range(max(12, len(pts) - 36), len(pts))]}
    if not out:
        raise RuntimeError('no recent BLS numbers')
    return dict(out, at=now_iso(), source=src)


def fuel():
    m = json.load(open(os.path.join(DATA, 'markets.json'), encoding='utf-8'))
    for g in m.get('board') or []:
        for r in g.get('rows') or []:
            if r.get('s') == 'NG=F':
                return {'at': now_iso(), 'gas': {'p': r.get('p'), 'cp': r.get('cp'), 'd': (r.get('d') or [])[-260:]}}
    raise RuntimeError('no gas price in markets.json')


def main():
    path = os.path.join(DATA, 'power.json')
    try:
        old = json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError):
        old = {'v': 1}
    out = dict(old)
    stale = []
    jobs = [('grid', grid), ('whole', wholesale), ('fuel', fuel)]

    def due(name, hours=20):  # the monthly numbers are fetched about once a day
        b = old.get(name) or {}
        if not b.get('at') or '--force' in sys.argv:
            return True
        age = dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(b['at'].replace('Z', '+00:00'))
        return age.total_seconds() > hours * 3600 or (name == 'bls' and not fresh([((b.get('cpi') or b.get('avgPrice') or {}).get('month') or '1900-01', 0)]))
    jobs += [(n, f) for n, f in (('retail', retail), ('bls', bls)) if due(n)]
    for name, fn in jobs:
        try:
            out[name] = fn()
            print(f'{name}: ok')
        except Exception as ex:  # noqa: BLE001
            stale.append(name)
            errors.append(f'{name}: {ex}')
            if name == 'bls':  # an old copy that's out of date is dropped, not shown
                out.pop('bls', None)
            print(f'{name}: failed ({ex}); kept the last good copy')
    out['at'] = now_iso()
    out['stale'] = stale
    out['errors'] = errors[:20]
    out['key'] = 'own' if KEY != 'DEMO_KEY' else 'demo'
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
