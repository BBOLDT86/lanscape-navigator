#!/usr/bin/env python3
"""The Checkout: read the official price series (runs on GitHub Actions; the sandbox can't reach bls.gov or FRED).

Average prices: the Bureau of Labor Statistics' "AP" series, U.S. city average and the four census regions, monthly
since 1980, for every item in data/items.json. Indexes: CPI food at home, CPI all items, average hourly pay.

Three routes, tried in order, each logged in official.json["log"]:
  1. BLS flat files  download.bls.gov/pub/time.series/ap/  (one file holds every food series; also the item names,
     which are checked against items.json["expect"] so a wrong code can't feed the charts)
  2. FRED            fred.stlouisfed.org/graph/fredgraph.csv?id=<series>   (BLS data, republished; no key)
  3. BLS API v2      api.bls.gov/publicAPI/v2/timeseries/data/             (BLS_API_KEY secret optional)

A run that brings back fewer series than the file already holds keeps the old series (never shrinks the record).
  python3 news/prices/tools/fetch.py            # real
  python3 news/prices/tools/fetch.py --mock     # made-up series, flagged "mock", for testing the pages locally
"""
import csv, io, json, math, os, random, sys, time, traceback, urllib.request, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
UA = 'TheWatch-Checkout/1.0 (+https://bboldt86.github.io/lanscape-navigator/news/prices/; the-watch-news@users.noreply.github.com)'
START = 1980
LOG = []


def log(route, what, ok, n=0, err=''):
    LOG.append({'at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'route': route, 'what': what, 'ok': bool(ok), 'n': n, 'err': str(err)[:300]})
    print(('ok  ' if ok else 'FAIL'), route, what, n, str(err)[:160], flush=True)


def get(url, data=None, headers=None, timeout=90):
    h = {'User-Agent': UA, 'Accept': '*/*'}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def ym(y, m):
    return '%04d-%02d' % (int(y), int(m))


def flat_ap(want):
    """{series_id: {ym: value}}, {item_code: name}"""
    out, names = {}, {}
    base = 'https://download.bls.gov/pub/time.series/ap/'
    try:
        txt = get(base + 'ap.item').decode('utf-8', 'replace')
        for row in csv.reader(io.StringIO(txt), delimiter='\t'):
            if len(row) >= 2 and row[0].strip() != 'item_code':
                names[row[0].strip()] = row[1].strip()
        log('bls-flat', 'ap.item', True, len(names))
    except Exception as e:
        log('bls-flat', 'ap.item', False, err=e)
    try:
        txt = get(base + 'ap.data.3.Food', timeout=180).decode('utf-8', 'replace')
        ws = set(want)
        for line in txt.splitlines():
            p = line.split('\t')
            if len(p) < 4:
                continue
            sid = p[0].strip()
            if sid not in ws:
                continue
            per = p[2].strip()
            if not (per.startswith('M') and per != 'M13'):
                continue
            try:
                y = int(p[1]); v = float(p[3])
            except ValueError:
                continue
            if y >= START:
                out.setdefault(sid, {})[ym(y, per[1:])] = v
        log('bls-flat', 'ap.data.3.Food', bool(out), len(out))
    except Exception as e:
        log('bls-flat', 'ap.data.3.Food', False, err=e)
    return out, names


def fred(ids):
    out = {}
    for sid, fid in ids:
        try:
            txt = get('https://fred.stlouisfed.org/graph/fredgraph.csv?id=%s&cosd=%d-01-01' % (fid, START), timeout=60).decode('utf-8', 'replace')
            d = {}
            for i, row in enumerate(csv.reader(io.StringIO(txt))):
                if i == 0 or len(row) < 2:
                    continue
                try:
                    d[row[0][:7]] = float(row[1])
                except ValueError:
                    pass
            if d:
                out[sid] = d
            else:
                log('fred', fid, False, err='no rows')
        except Exception as e:
            log('fred', fid, False, err=e)
        time.sleep(0.35)
    log('fred', '%d series asked' % len(ids), bool(out), len(out))
    return out


def bls_api(ids):
    out = {}
    key = os.environ.get('BLS_API_KEY', '').strip()
    span, per = (20, 50) if key else (10, 25)
    now = datetime.date.today().year
    calls = 0
    for y0 in range(START, now + 1, span):
        for i in range(0, len(ids), per):
            if not key and calls >= 24:
                log('bls-api', 'daily limit without a key reached', False, len(out)); return out
            body = {'seriesid': ids[i:i + per], 'startyear': str(y0), 'endyear': str(min(y0 + span - 1, now))}
            if key:
                body['registrationkey'] = key
            try:
                calls += 1
                r = json.loads(get('https://api.bls.gov/publicAPI/v2/timeseries/data/', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}))
                if r.get('status') != 'REQUEST_SUCCEEDED':
                    log('bls-api', '%d-%d' % (y0, y0 + span - 1), False, err='; '.join(r.get('message', []))); continue
                for s in r['Results']['series']:
                    for o in s['data']:
                        if o['period'].startswith('M') and o['period'] != 'M13':
                            try:
                                out.setdefault(s['seriesID'], {})[ym(o['year'], o['period'][1:])] = float(o['value'])
                            except ValueError:
                                pass
            except Exception as e:
                log('bls-api', '%d-%d' % (y0, y0 + span - 1), False, err=e)
            time.sleep(0.5)
    log('bls-api', '%d series asked, %d calls' % (len(ids), calls), bool(out), len(out))
    return out


def mock(items, areas, indexes):
    random.seed(7)
    months = [ym(y, m) for y in range(START, 2027) for m in range(1, 13) if (y, m) <= (2026, 10)]
    series = {}
    base = {'eggs': .85, 'milk': 2.0, 'bread': .5, 'beef': 1.3, 'chicken_breast': 2.0, 'coffee': 3.0, 'bananas': .33}
    for it in items:
        for a in areas:
            v = base.get(it['id'], 1.0) * (1 + (int(a) / 100) * .03)
            d = {}
            for i, k in enumerate(months):
                v *= 1 + random.gauss(.0022, .012) + (.02 if 495 < i < 520 else 0) * random.random()
                d[k] = round(v, 3)
            series['APU' + a + it['bls']] = d
    for ix in indexes:
        v = {'food_home': 88.0, 'all_items': 78.0, 'wage': 6.6}[ix['id']]
        d = {}
        for k in months:
            v *= 1.0026
            d[k] = round(v, 3)
        series[ix['bls']] = d
    return series, months


def main():
    cfg = json.load(open(os.path.join(DATA, 'items.json')))
    items, areas, indexes = cfg['items'], list(cfg['areas']), cfg['indexes']
    path = os.path.join(DATA, 'official.json')
    old = json.load(open(path)) if os.path.exists(path) else {}
    out = {'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'series': {}, 'titles': {}, 'routes': {}, 'rejected': []}
    if '--mock' in sys.argv:
        out['series'], _ = mock(items, areas, indexes)
        out['mock'] = True
        json.dump(out, open(path, 'w'), separators=(',', ':'))
        print('mock official.json written'); return
    want = ['APU' + a + it['bls'] for it in items for a in areas]
    got, names = {}, {}
    try:
        got, names = flat_ap(want)
    except Exception:
        log('bls-flat', 'crash', False, err=traceback.format_exc())
    for sid in got:
        out['routes'][sid] = 'bls-flat'
    miss = [s for s in want if s not in got]
    if miss:
        f = fred([(s, s) for s in miss])
        for s, d in f.items():
            got[s] = d; out['routes'][s] = 'fred'
        miss = [s for s in want if s not in got]
    if miss:
        a = bls_api(miss)
        for s, d in a.items():
            got[s] = d; out['routes'][s] = 'bls-api'
    # the item names from BLS must contain the word items.json expects
    for it in items:
        nm = names.get(it['bls'])
        if nm:
            out['titles'][it['id']] = nm
            if it['expect'].lower() not in nm.lower():
                out['rejected'].append({'item': it['id'], 'code': it['bls'], 'title': nm, 'why': 'title does not contain "%s"' % it['expect']})
                for a in areas:
                    got.pop('APU' + a + it['bls'], None)
    # values must be sane
    for sid in list(got):
        vals = [v for v in got[sid].values() if isinstance(v, (int, float))]
        if not vals or min(vals) <= 0 or max(vals) > 60:
            out['rejected'].append({'series': sid, 'why': 'values out of range', 'min': min(vals) if vals else None, 'max': max(vals) if vals else None})
            got.pop(sid)
    # indexes: FRED first (flat CPI files are very large), then the API
    ix = fred([(i['bls'], i['fred']) for i in indexes])
    missi = [i['bls'] for i in indexes if i['bls'] not in ix]
    if missi:
        ix.update(bls_api(missi))
    for s, d in ix.items():
        got[s] = d; out['routes'][s] = out['routes'].get(s) or ('fred' if s not in missi else 'bls-api')
    # never shrink the record
    for s, d in (old.get('series') or {}).items():
        if old.get('mock'):
            break
        if s not in got or len(got[s]) < len(d) - 2:
            got[s] = d; out['routes'][s] = (old.get('routes') or {}).get(s, 'kept') + ' (kept from %s)' % old.get('fetched', 'an earlier run')
    out['series'] = {s: {k: got[s][k] for k in sorted(got[s])} for s in sorted(got)}
    out['log'] = LOG
    out['asked'] = len(want) + len(indexes)
    json.dump(out, open(path, 'w'), separators=(',', ':'))
    print('official.json: %d of %d series; rejected %d' % (len(out['series']), out['asked'], len(out['rejected'])))


if __name__ == '__main__':
    main()
