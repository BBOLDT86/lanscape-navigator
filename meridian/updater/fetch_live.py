#!/usr/bin/env python3
"""Meridian Flight Control: the live feed (everything besides weather).

  Fleet      every airborne Southwest jet (callsign SWA####) from ADS-B:
               OpenSky Network /states/all (one global request; 400 free credits a day anonymous, 4 per request,
               so at most every 15 min; OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET raise it to 4,000)
               fallback: adsb.fi v3 point tiles over the network (1 request a second)
             tails and types: airplanes.live /v2/hex/<up to 1000 hexes> for aircraft not seen before (cached)
             routes: adsb.lol routeset (community route data) for callsigns not seen before (cached 12 h)
  ATC        FAA NAS Status: ground stops, ground delay programs, airspace flow programs, delays, closures
  LUV        Southwest's share price (delayed), from Stooq, Yahoo as a fallback

writes <out>/live.json. A source that fails keeps its last good values and is noted in `errors`.
usage: python3 meridian/updater/fetch_live.py --out feed
"""
import argparse, datetime as dt, gzip, json, math, os, re, sys, time, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, '..', 'index.html')
UA = 'MeridianFlightControl/1.0 (+https://bboldt86.github.io/lanscape-navigator/meridian/)'
OPENSKY_EVERY_MIN = 14          # anonymous budget: 400 credits/day, 4 per global request
ROUTE_TTL_H = 12
PROBE = {}                      # per-source diagnostics: status, CORS header, timing


def now():
    return dt.datetime.now(dt.timezone.utc)


def iso(t):
    return t.strftime('%Y-%m-%dT%H:%M:%SZ')


def load(p, d):
    try:
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return d


def req(url, data=None, headers=None, timeout=30, tag=None, method=None):
    h = {'User-Agent': UA, 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'Origin': 'https://bboldt86.github.io'}
    h.update(headers or {})
    body = data
    if isinstance(data, dict):
        body = json.dumps(data).encode(); h['Content-Type'] = 'application/json'
    t0 = time.time()
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, data=body, headers=h, method=method), timeout=timeout)
        raw = r.read()
        if r.headers.get('Content-Encoding') == 'gzip' or raw[:2] == b'\x1f\x8b':
            raw = gzip.decompress(raw)
        if tag:
            PROBE[tag] = {'status': r.status, 'cors': r.headers.get('Access-Control-Allow-Origin'), 'ms': int((time.time() - t0) * 1000),
                          'bytes': len(raw), 'remaining': r.headers.get('X-Rate-Limit-Remaining')}
        return raw.decode('utf-8', 'replace')
    except urllib.error.HTTPError as ex:
        if tag:
            PROBE[tag] = {'status': ex.code, 'cors': ex.headers.get('Access-Control-Allow-Origin') if ex.headers else None,
                          'ms': int((time.time() - t0) * 1000), 'retry_after': ex.headers.get('X-Rate-Limit-Retry-After-Seconds') if ex.headers else None}
        raise
    except Exception as ex:
        if tag:
            PROBE[tag] = {'status': None, 'error': f'{type(ex).__name__}: {str(ex)[:80]}', 'ms': int((time.time() - t0) * 1000)}
        raise


def stations():
    s = open(PAGE, encoding='utf-8').read()
    m = re.search(r'const STATION_DATA=`(.*?)`', s, re.S)
    out = []
    for ln in m.group(1).strip().splitlines():
        f = ln.split('|')
        out.append({'iata': f[0], 'icao': f[1], 'lat': float(f[4]), 'lon': float(f[5]), 'region': f[8]})
    return out


def nm(lat1, lon1, lat2, lon2):
    k = math.pi / 180
    a = math.sin((lat2 - lat1) * k / 2) ** 2 + math.cos(lat1 * k) * math.cos(lat2 * k) * math.sin((lon2 - lon1) * k / 2) ** 2
    return 2 * 3440.065 * math.asin(min(1, math.sqrt(a)))


# ── fleet: OpenSky ────────────────────────────────────────────────────────
def opensky_token():
    cid, sec = os.environ.get('OPENSKY_CLIENT_ID', '').strip(), os.environ.get('OPENSKY_CLIENT_SECRET', '').strip()
    if not (cid and sec):
        return None
    body = urllib.parse.urlencode({'grant_type': 'client_credentials', 'client_id': cid, 'client_secret': sec}).encode()
    raw = req('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', data=body,
              headers={'Content-Type': 'application/x-www-form-urlencoded'}, tag='opensky_auth')
    return json.loads(raw).get('access_token')


def fleet_opensky():
    tok = opensky_token()
    hdr = {'Authorization': 'Bearer ' + tok} if tok else {}
    # North America, Hawaii, Mexico and the Caribbean in one box (still one 4-credit request)
    url = 'https://opensky-network.org/api/states/all?lamin=10&lomin=-170&lamax=55&lomax=-60'
    js = json.loads(req(url, headers=hdr, timeout=45, tag='opensky'))
    t = js.get('time') or int(time.time())
    out = []
    for s in js.get('states') or []:
        cs = (s[1] or '').strip().upper()
        if not cs.startswith('SWA') or not cs[3:].isdigit():
            continue
        if s[5] is None or s[6] is None:
            continue
        alt_m = s[13] if s[13] is not None else s[7]
        out.append({'cs': cs, 'hex': s[0], 'lat': round(s[6], 4), 'lon': round(s[5], 4),
                    'alt': 0 if s[8] else (round(alt_m * 3.28084 / 100) * 100 if alt_m is not None else None),
                    'gs': round(s[9] * 1.94384) if s[9] is not None else None, 'trk': round(s[10]) if s[10] is not None else None,
                    'vs': round(s[11] * 196.85 / 100) * 100 if s[11] is not None else None, 'sq': s[14] or '', 'gnd': bool(s[8]),
                    'seen': int(t - (s[4] or t))})
    return out, 'OpenSky Network' + (' (account)' if tok else '')


# ── fleet: adsb.fi tiles (fallback) ──────────────────────────────────────────
def tiles():
    pts = [(lat, lon) for lat in (27, 32, 37, 42, 47) for lon in range(-123, -66, 6)]
    pts += [(21, -157.5), (20.5, -105.5), (21, -86.5), (18.5, -77.5), (24.5, -81.5)]
    return pts


def readsb_rows(js):
    return js.get('ac') or js.get('aircraft') or []


def fleet_adsbfi():
    seen = {}
    fails = 0
    for lat, lon in tiles():
        try:
            js = json.loads(req(f'https://opendata.adsb.fi/api/v3/lat/{lat}/lon/{lon}/dist/250', timeout=25, tag='adsbfi'))
        except Exception:
            fails += 1
            if fails >= 4 and not seen:
                raise
            time.sleep(2)
            continue
        for a in readsb_rows(js):
            cs = (a.get('flight') or '').strip().upper()
            if not cs.startswith('SWA') or not cs[3:].isdigit() or a.get('lat') is None:
                continue
            alt = a.get('alt_baro')
            gnd = alt == 'ground'
            seen[a.get('hex')] = {'cs': cs, 'hex': a.get('hex'), 'lat': round(a['lat'], 4), 'lon': round(a['lon'], 4),
                                  'alt': 0 if gnd else (round(alt / 100) * 100 if isinstance(alt, (int, float)) else None),
                                  'gs': round(a['gs']) if a.get('gs') is not None else None, 'trk': round(a['track']) if a.get('track') is not None else None,
                                  'vs': a.get('baro_rate'), 'sq': a.get('squawk') or '', 'gnd': gnd, 'seen': int(a.get('seen') or 0),
                                  'reg': a.get('r') or '', 'type': a.get('t') or ''}
        time.sleep(1.1)
    return list(seen.values()), 'adsb.fi'


# ── enrichment ───────────────────────────────────────────────────────────
def enrich_airframes(fleet, cache):
    need = [f['hex'] for f in fleet if f['hex'] and f['hex'] not in cache and not f.get('reg')]
    for f in fleet:
        if f.get('reg') and f['hex'] not in cache:
            cache[f['hex']] = {'reg': f['reg'], 'type': f.get('type', '')}
    if need:
        try:
            js = json.loads(req('https://api.airplanes.live/v2/hex/' + ','.join(need[:900]), timeout=30, tag='airplaneslive'))
            for a in readsb_rows(js):
                if a.get('hex'):
                    cache[a['hex']] = {'reg': a.get('r') or '', 'type': a.get('t') or ''}
        except Exception as ex:
            return f'airframes: {type(ex).__name__}: {str(ex)[:80]}'
    for f in fleet:
        c = cache.get(f['hex']) or {}
        f['reg'] = f.get('reg') or c.get('reg', '')
        f['type'] = f.get('type') or c.get('type', '')
    return None


def enrich_routes(fleet, cache, t0):
    cut = t0.timestamp() - ROUTE_TTL_H * 3600
    for k in [k for k, v in cache.items() if v.get('at', 0) < cut]:
        del cache[k]
    need = [f for f in fleet if f['cs'] not in cache]
    err = None
    for i in range(0, len(need), 100):
        batch = need[i:i + 100]
        try:
            js = json.loads(req('https://api.adsb.lol/api/0/routeset', data={'planes': [{'callsign': f['cs'], 'lat': f['lat'], 'lng': f['lon']} for f in batch]},
                                timeout=40, tag='adsblol_routes'))
            for r in js if isinstance(js, list) else []:
                cs = (r.get('callsign') or '').upper()
                codes = r.get('_airport_codes_iata') or r.get('airport_codes') or ''
                plausible = r.get('plausible')
                cache[cs] = {'route': codes if codes and codes != 'unknown' else '', 'ok': plausible not in (0, False, '0'), 'at': int(t0.timestamp())}
            for f in batch:
                cache.setdefault(f['cs'], {'route': '', 'ok': False, 'at': int(t0.timestamp())})
        except Exception as ex:
            err = f'routes: {type(ex).__name__}: {str(ex)[:80]}'
            break
        time.sleep(1)
    return err


def apply_routes(fleet, cache, by_iata, by_icao):
    for f in fleet:
        r = (cache.get(f['cs']) or {}).get('route', '')
        legs = [x for x in r.split('-') if x]
        org = dst = ''
        if len(legs) >= 2:
            pts = [by_iata.get(x) or by_icao.get(x) for x in legs]
            # multi-stop routes (through flights): pick the leg whose great circle the aircraft is closest to
            best = None
            for a, b in zip(pts, pts[1:]):
                if not a or not b:
                    continue
                d = nm(f['lat'], f['lon'], a['lat'], a['lon']) + nm(f['lat'], f['lon'], b['lat'], b['lon']) - nm(a['lat'], a['lon'], b['lat'], b['lon'])
                if best is None or d < best[0]:
                    best = (d, a['iata'], b['iata'])
            if best:
                org, dst = best[1], best[2]
            else:
                org, dst = legs[-2][-3:], legs[-1][-3:]
        f['route'] = r
        f['org'], f['dst'] = org, dst
        if dst and dst in by_iata and f.get('gs') and not f['gnd']:
            d = by_iata[dst]
            f['dist'] = round(nm(f['lat'], f['lon'], d['lat'], d['lon']))
            f['ete'] = round(f['dist'] / max(f['gs'], 120) * 60 + 8)   # minutes, plus a few for the approach


# ── FAA NAS status ───────────────────────────────────────────────────────
def nas_status():
    xml = req('https://nasstatus.faa.gov/api/airport-status-information', headers={'Accept': 'application/xml,text/xml'}, tag='nasstatus')
    root = ET.fromstring(xml)
    out = []
    def txt(el, *names):
        for n in names:
            x = el.find(n)
            if x is not None and (x.text or '').strip():
                return x.text.strip()
        return ''
    upd = txt(root, 'Update_Time')
    for dtype in root.iter('Delay_type'):
        name = txt(dtype, 'Name')
        for el in dtype.iter():
            arpt = el.find('ARPT')
            if arpt is None or not (arpt.text or '').strip():
                continue
            a = arpt.text.strip().upper()
            rec = {'arpt': a, 'kind': name, 'reason': txt(el, 'Reason')}
            if 'Ground Delay' in name:
                rec.update(type='GDP', avg=txt(el, 'Avg'), max=txt(el, 'Max'))
            elif 'Ground Stop' in name:
                rec.update(type='GS', end=txt(el, 'End_Time'))
            elif 'Closure' in name:
                rec.update(type='CLSD', start=txt(el, 'Start'), reopen=txt(el, 'Reopen'))
            elif 'Airspace Flow' in name:
                rec.update(type='AFP', avg=txt(el, 'Avg'), end=txt(el, 'End_Time'))
            else:
                ad = el.find('Arrival_Departure')
                kind = ad.get('Type') if ad is not None else ''
                rec.update(type='DLY', dir=kind, min=txt(ad, 'Min') if ad is not None else '', max=txt(ad, 'Max') if ad is not None else '',
                           trend=txt(ad, 'Trend') if ad is not None else '')
            out.append(rec)
    seen, uniq = set(), []
    for r in out:
        k = json.dumps(r, sort_keys=True)
        if k not in seen:
            seen.add(k); uniq.append(r)
    return {'updated': upd, 'programs': uniq}


# ── LUV ──────────────────────────────────────────────────────────────────
def luv_quote():
    try:
        csv = req('https://stooq.com/q/l/?s=luv.us&f=sd2t2ohlcvp&h&e=csv', headers={'Accept': 'text/csv'}, tag='stooq')
        rows = [r.split(',') for r in csv.strip().splitlines()]
        hdr, val = rows[0], rows[1]
        d = dict(zip([h.lower() for h in hdr], val))
        close = float(d['close'])
        prev = float(d['prev']) if d.get('prev') not in (None, '', 'N/D') else None
        return {'sym': 'LUV', 'price': close, 'chg': round(close - prev, 2) if prev else None,
                'pct': round((close / prev - 1) * 100, 2) if prev else None, 'asof': f"{d.get('date')} {d.get('time')}", 'src': 'Stooq (delayed)'}
    except Exception:
        js = json.loads(req('https://query1.finance.yahoo.com/v8/finance/chart/LUV?interval=1d&range=5d', tag='yahoo'))
        m = js['chart']['result'][0]['meta']
        p, prev = m.get('regularMarketPrice'), m.get('chartPreviousClose') or m.get('previousClose')
        return {'sym': 'LUV', 'price': p, 'chg': round(p - prev, 2) if p and prev else None, 'pct': round((p / prev - 1) * 100, 2) if p and prev else None,
                'asof': iso(dt.datetime.fromtimestamp(m.get('regularMarketTime') or time.time(), dt.timezone.utc)), 'src': 'Yahoo Finance (delayed)'}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='feed')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    t0 = now()
    sts = stations()
    by_iata = {s['iata']: s for s in sts}
    by_icao = {s['icao']: s for s in sts}
    old = load(os.path.join(a.out, 'live.json'), {})
    errors = []
    state = old.get('_state') or {}
    air_cache, route_cache, first = state.get('airframes') or {}, state.get('routes') or {}, state.get('first') or {}

    fleet, src = old.get('fleet') or [], old.get('fleetSource') or ''
    fleet_at = old.get('fleetAt')
    last_os = state.get('openskyAt', 0)
    has_os_account = bool(os.environ.get('OPENSKY_CLIENT_ID'))
    got = None
    if has_os_account or t0.timestamp() - last_os >= OPENSKY_EVERY_MIN * 60:
        try:
            got, src = fleet_opensky()
            state['openskyAt'] = int(t0.timestamp())
        except Exception as ex:
            errors.append(f'OpenSky: {type(ex).__name__}: {str(ex)[:100]}')
    if got is None and (not fleet_at or (t0 - dt.datetime.fromisoformat(fleet_at.replace('Z', '+00:00'))).total_seconds() > 9 * 60):
        try:
            got, src = fleet_adsbfi()
        except Exception as ex:
            errors.append(f'adsb.fi: {type(ex).__name__}: {str(ex)[:100]}')
    if got is not None:
        fleet, fleet_at = got, iso(t0)
        e = enrich_airframes(fleet, air_cache)
        if e: errors.append(e)
        e = enrich_routes([f for f in fleet if not f['gnd']], route_cache, t0)
        if e: errors.append(e)
        apply_routes(fleet, route_cache, by_iata, by_icao)
        # first time each flight was seen airborne (to the updater's resolution), kept for 3 hours after it vanishes
        ts = int(t0.timestamp())
        for f in fleet:
            k = f['cs'] + '|' + f.get('route', '')
            if not f['gnd']:
                first.setdefault(k, {'t': ts})
                first[k]['last'] = ts
                f['first'] = first[k]['t']
        first = {k: v for k, v in first.items() if ts - v.get('last', v['t']) < 3 * 3600}
        print(f'fleet: {len(fleet)} SWA aircraft from {src} · {sum(1 for f in fleet if not f["gnd"])} airborne · '
              f'{sum(1 for f in fleet if f.get("dst"))} with a route')

    atc = old.get('atc')
    try:
        atc = nas_status(); atc['fetched'] = iso(t0)
        print(f'NAS status: {len(atc["programs"])} programs/delays')
    except Exception as ex:
        errors.append(f'NAS status: {type(ex).__name__}: {str(ex)[:100]}')

    quote = old.get('quote')
    try:
        quote = luv_quote(); quote['fetched'] = iso(t0)
        print(f'LUV: {quote["price"]} ({quote["src"]})')
    except Exception as ex:
        errors.append(f'LUV quote: {type(ex).__name__}: {str(ex)[:100]}')

    state.update(airframes=air_cache, routes=route_cache, first=first)
    keys = ('cs', 'hex', 'reg', 'type', 'lat', 'lon', 'alt', 'gs', 'trk', 'vs', 'sq', 'gnd', 'seen', 'route', 'org', 'dst', 'dist', 'ete', 'first')
    doc = {'v': 1, 'generated': iso(now()), 'every': '10 min (GitHub Actions)', 'fleetAt': fleet_at, 'fleetSource': src,
           'fleet': [{k: f.get(k) for k in keys if f.get(k) not in (None, '')} for f in sorted(fleet, key=lambda f: f['cs'])],
           'atc': atc, 'quote': quote, 'errors': errors[:20], 'probe': PROBE,
           'credits': {'fleet': src, 'routes': 'adsb.lol route data (community)', 'airframes': 'airplanes.live', 'atc': 'FAA NAS Status'},
           '_state': state}
    with open(os.path.join(a.out, 'live.json'), 'w', encoding='utf-8') as f:
        json.dump(doc, f, separators=(',', ':'))
    for e in errors:
        print('  error:', e)
    print(f'wrote {a.out}/live.json in {(now() - t0).total_seconds():.1f}s')


if __name__ == '__main__':
    main()
