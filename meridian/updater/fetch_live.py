#!/usr/bin/env python3
"""Meridian Flight Control: the live feed (everything besides weather).

  Fleet      every airborne Southwest jet (callsign SWA####) from ADS-B:
               OpenSky Network /states/all (one global request; 400 free credits a day anonymous, 4 per request,
               so at most every 15 min; OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET raise it to 4,000)
               fallback: adsb.fi v3 point tiles over the network (1 request a second)
             tails: from the Mode S hex code (US codes map one-to-one to N-numbers); types from adsb.fi (cached per
               tail; the FAA registry is tried weekly but refuses GitHub's servers)
             routes: the community route file for SWA (vradarserver/standing-data, refreshed daily), shown only when
               the aircraft's position and track fit the route; airport positions from OurAirports
  ATC        FAA NAS Status: ground stops, ground delay programs, airspace flow programs, delays, closures
               (closures that only restrict general aviation are dropped)

writes <out>/live.json. A source that fails keeps its last good values and is noted in `errors`.
usage: python3 meridian/updater/fetch_live.py --out feed
"""
import argparse, datetime as dt, gzip, json, math, os, re, sys, time, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, '..', 'index.html')
UA = 'MeridianFlightControl/1.0 (+https://bboldt86.github.io/lanscape-navigator/meridian/)'
OPENSKY_EVERY_MIN = 13          # anonymous budget: 400 credits/day, 4 per request; with a 5-min schedule this lands every 15 min
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


# ── enrichment: tails ─────────────────────────────────────────────────────
_CH, _DG = 'ABCDEFGHJKLMNPQRSTUVWXYZ', '0123456789'
_SUF = 1 + len(_CH) * (1 + len(_CH)); _B4 = 1 + len(_CH) + len(_DG); _B3 = len(_DG) * _B4 + _SUF
_B2 = len(_DG) * _B3 + _SUF; _B1 = len(_DG) * _B2 + _SUF


def _suffix(o):
    if o == 0:
        return ''
    c0 = _CH[(o - 1) // (len(_CH) + 1)]; r = (o - 1) % (len(_CH) + 1)
    return c0 if r == 0 else c0 + _CH[r - 1]


def hex_to_n(h):
    """US Mode S codes A00001–ADF7C7 map one-to-one onto N-numbers N1–N99999."""
    try:
        i = int(h, 16) - 0xA00001
    except (TypeError, ValueError):
        return ''
    if i < 0 or i >= 915399:
        return ''
    out = 'N' + str(i // _B1 + 1); r = i % _B1
    for b in (_B2, _B3):
        if r < _SUF:
            return out + _suffix(r)
        r -= _SUF; out += str(r // b); r %= b
    if r < _SUF:
        return out + _suffix(r)
    r -= _SUF; out += str(r // _B4); r %= _B4
    return out if r == 0 else out + (_CH + _DG)[r - 1]


def faa_registry(state, t0):
    """Southwest's aircraft from the FAA registry (MASTER + ACFTREF), refreshed weekly: hex -> model."""
    reg = state.get('registry') or {}
    if reg.get('at') and t0.timestamp() - reg['at'] < 7 * 86400 and reg.get('models'):
        return None
    if reg.get('tried') and t0.timestamp() - reg['tried'] < 6 * 3600:
        return None
    reg['tried'] = int(t0.timestamp()); state['registry'] = reg
    import io, zipfile, csv
    try:
        raw = urllib.request.urlopen(urllib.request.Request('https://registry.faa.gov/database/ReleasableAircraft.zip', headers={
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 ' + UA}), timeout=120).read()
        PROBE['faa_registry'] = {'status': 200, 'bytes': len(raw)}
        z = zipfile.ZipFile(io.BytesIO(raw))
        names = {n.upper(): n for n in z.namelist()}
        ref = {}
        with z.open(names['ACFTREF.TXT']) as f:
            for row in csv.DictReader(io.TextIOWrapper(f, 'utf-8-sig', errors='replace')):
                row = {k.strip().upper(): (v or '').strip() for k, v in row.items() if k}
                ref[row.get('CODE', '')] = row.get('MODEL', '')
        models = {}
        with z.open(names['MASTER.TXT']) as f:
            for row in csv.DictReader(io.TextIOWrapper(f, 'utf-8-sig', errors='replace')):
                row = {k.strip().upper(): (v or '').strip() for k, v in row.items() if k}
                if 'SOUTHWEST AIRLINES' not in row.get('NAME', ''):
                    continue
                hx = row.get('MODE S CODE HEX', '').lower()
                if hx:
                    models[hx] = ref.get(row.get('MFR MDL CODE', ''), '')
        if models:
            reg.update(models=models, at=int(t0.timestamp()))
            print(f'FAA registry: {len(models)} Southwest aircraft')
        return None
    except Exception as ex:
        PROBE['faa_registry'] = {'status': getattr(ex, 'code', None), 'error': f'{type(ex).__name__}: {str(ex)[:80]}'}
        return f'FAA registry: {type(ex).__name__}: {str(ex)[:80]}'


def type_of(model):
    m = (model or '').upper().replace(' ', '')
    if not m:
        return ''
    if re.fullmatch(r'737-8|737-8200|737MAX8', m):
        return '7M8'
    if re.fullmatch(r'737-7|737MAX7', m):
        return '7M7'
    if m.startswith('737-8'):
        return '738'
    if m.startswith('737-7'):
        return '73G'
    return m[:8]


def adsbfi_types(fleet, state, limit=50):
    """Aircraft type per hex from adsb.fi (1 request a second), cached for good: a tail's type doesn't change."""
    cache = state.setdefault('types', {})
    if state.get('adsbfiBlockedAt') and time.time() - state['adsbfiBlockedAt'] < 3 * 3600:
        return None
    todo = [f['hex'] for f in fleet if f.get('hex') and not f.get('gnd') and f['hex'] not in cache][:limit]
    for i, hx in enumerate(todo):
        try:
            js = json.loads(req(f'https://opendata.adsb.fi/api/v2/hex/{hx}', timeout=15, tag='adsbfi_hex'))
            rows = readsb_rows(js)
            if rows:
                cache[hx] = (rows[0].get('t') or '').strip()[:8]
        except urllib.error.HTTPError as ex:
            if ex.code in (403, 429):
                state['adsbfiBlockedAt'] = int(time.time())
                return f'aircraft types: adsb.fi HTTP {ex.code} after {i} lookups'
        except Exception as ex:
            return f'aircraft types: {type(ex).__name__}: {str(ex)[:60]}'
        time.sleep(1.05)
    return None


ICAO_TYPE = {'B737': '73G', 'B738': '738', 'B38M': '7M8', 'B37M': '7M7'}


def enrich_airframes(fleet, state):
    models = (state.get('registry') or {}).get('models') or {}
    types = state.get('types') or {}
    for f in fleet:
        hx = (f.get('hex') or '').lower()
        f['reg'] = f.get('reg') or hex_to_n(hx)
        t = types.get(hx, '').upper()
        f['type'] = ICAO_TYPE.get(t) or type_of(models.get(hx)) or (t if t else f.get('type', ''))


# ── enrichment: routes ───────────────────────────────────────────────────
def route_db(state, t0):
    """SWA callsign -> airports, from vradarserver/standing-data (daily), and positions for every airport in it."""
    rd = state.get('routedb') or {}
    if rd.get('at') and t0.timestamp() - rd['at'] < 86400 and rd.get('routes'):
        return rd, None
    try:
        csvtxt = req('https://raw.githubusercontent.com/vradarserver/standing-data/main/routes/schema-01/S/SWA-all.csv',
                     headers={'Accept': 'text/csv'}, timeout=40, tag='routes_db')
        routes = {}
        for ln in csvtxt.lstrip('﻿').splitlines()[1:]:
            p = ln.strip().split(',')
            if len(p) >= 5 and p[0].startswith('SWA'):
                routes[p[0].upper()] = p[4].strip().upper()
        need = sorted({c for r in routes.values() for c in r.split('-') if c})
        apts = dict(rd.get('airports') or {})
        missing = [c for c in need if c not in apts]
        if missing:
            ap = req('https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv', headers={'Accept': 'text/csv'},
                     timeout=60, tag='ourairports')
            import csv, io
            want = set(missing)
            for row in csv.DictReader(io.StringIO(ap)):
                code = (row.get('icao_code') or row.get('gps_code') or row.get('ident') or '').upper()
                if code in want:
                    try:
                        apts[code] = [round(float(row['latitude_deg']), 3), round(float(row['longitude_deg']), 3), (row.get('iata_code') or '').upper()]
                    except (TypeError, ValueError):
                        pass
        rd = {'routes': routes, 'airports': apts, 'at': int(t0.timestamp())}
        state['routedb'] = rd
        print(f'route file: {len(routes)} SWA flight numbers, {len(apts)} airports placed')
        return rd, None
    except Exception as ex:
        return rd, f'route file: {type(ex).__name__}: {str(ex)[:80]}'


def bearing(lat1, lon1, lat2, lon2):
    k = math.pi / 180
    y = math.sin((lon2 - lon1) * k) * math.cos(lat2 * k)
    x = math.cos(lat1 * k) * math.sin(lat2 * k) - math.sin(lat1 * k) * math.cos(lat2 * k) * math.cos((lon2 - lon1) * k)
    return (math.atan2(y, x) / k + 360) % 360


def apply_routes(fleet, rd, sts):
    """Show a route only when the aircraft fits it: near the leg's great circle and, once cruising, heading for its end."""
    routes, apts = rd.get('routes') or {}, rd.get('airports') or {}
    # Southwest's network for terminal-area inference: the page's stations plus every airport in the route file
    net = {s['icao']: (s['lat'], s['lon'], s['iata']) for s in sts}
    for code, v in apts.items():
        if v[2] and code not in net:
            net[code] = (v[0], v[1], v[2])
    for f in fleet:
        r = routes.get(f['cs'], '')
        for k in ('org', 'dst', 'orgIcao', 'dstIcao', 'dist', 'ete', 'likely'):
            f.pop(k, None)
        f['route'] = r
        codes = [c for c in r.split('-') if c]
        best = None
        for a, b in zip(codes, codes[1:]):
            A, B = apts.get(a), apts.get(b)
            if not A or not B:
                continue
            leg = nm(A[0], A[1], B[0], B[1])
            dA, dB = nm(f['lat'], f['lon'], A[0], A[1]), nm(f['lat'], f['lon'], B[0], B[1])
            excess = dA + dB - leg
            if excess > max(60, 0.12 * leg):
                continue
            if not f['gnd'] and f.get('trk') is not None and dB > 40 and dA > 25:
                off = abs((bearing(f['lat'], f['lon'], B[0], B[1]) - f['trk'] + 540) % 360 - 180)
                if off > 60:
                    continue
            if best is None or excess < best[0]:
                best = (excess, a, b, A, B, dB)
        if best:
            _, a, b, A, B, dB = best
            f['org'], f['dst'] = (A[2] or a[-3:]), (B[2] or b[-3:])
            f['orgIcao'], f['dstIcao'] = a, b
            if not f['gnd'] and f.get('gs'):
                f['dist'] = round(dB)
                f['ete'] = round(dB / max(f['gs'], 120) * 60 + 8)   # minutes, with a few for the approach
        else:
            f['org'] = f['dst'] = ''
            infer_terminal(f, net)


def infer_terminal(f, net):
    """Low and descending toward a Southwest station: likely destination. Low and climbing away from one: likely origin."""
    if f['gnd'] or f.get('alt') is None or f['alt'] > 12000 or f.get('trk') is None or f.get('vs') is None:
        return
    best = None
    for code, (lat, lon, iata) in net.items():
        d = nm(f['lat'], f['lon'], lat, lon)
        if f['vs'] <= -300 and d <= 90:
            off = abs((bearing(f['lat'], f['lon'], lat, lon) - f['trk'] + 540) % 360 - 180)
            if (off <= 40 or d < 12) and (best is None or d < best[0]):
                best = (d, 'dst', code, iata)
        elif f['vs'] >= 300 and d <= 45:
            off = abs((bearing(lat, lon, f['lat'], f['lon']) - f['trk'] + 540) % 360 - 180)
            if (off <= 50 or d < 8) and (best is None or d < best[0]):
                best = (d, 'org', code, iata)
    if best:
        d, side, code, iata = best
        f[side] = iata or code[-3:]
        f[side + 'Icao'] = code
        f['likely'] = 1
        if side == 'dst' and f.get('gs'):
            f['dist'] = round(d)
            f['ete'] = round(d / max(f['gs'], 120) * 60 + 6)


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
    # closures that only keep out general aviation ("TO NON SKED TRANSIENT GA", "TO GA ACFT EXC PPR") don't touch an airline
    out = [r for r in out if not (r['type'] == 'CLSD' and re.search(r'\b(NON SKED|TRANSIENT|GA ACFT|TO GA|PPR)\b', r.get('reason', '')))]
    seen, uniq = set(), []
    for r in out:
        k = json.dumps(r, sort_keys=True)
        if k not in seen:
            seen.add(k); uniq.append(r)
    return {'updated': upd, 'programs': uniq}


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
    # the updater's own cache (route file, airport positions, registry) lives beside the feed, never sent to the page
    state = load(os.path.join(a.out, 'live_state.json'), None) or old.get('_state') or {}
    state.pop('airframes', None); state.pop('routes', None)
    first = state.get('first') or {}

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
    # adsb.fi (55 tile requests) only when OpenSky failed or the fleet is over 30 minutes old
    if got is None and (errors or not fleet_at or (t0 - dt.datetime.fromisoformat(fleet_at.replace('Z', '+00:00'))).total_seconds() > 30 * 60):
        try:
            got, src = fleet_adsbfi()
        except Exception as ex:
            errors.append(f'adsb.fi: {type(ex).__name__}: {str(ex)[:100]}')
    e = faa_registry(state, t0)
    if e and not (state.get('types')): errors.append(e)
    rd, e = route_db(state, t0)
    if e: errors.append(e)
    if got is not None:
        fleet, fleet_at = got, iso(t0)
    e = adsbfi_types(fleet, state)
    if e: errors.append(e)
    enrich_airframes(fleet, state)
    apply_routes(fleet, rd, sts)
    if got is not None:
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

    state['first'] = first
    keys = ('cs', 'hex', 'reg', 'type', 'lat', 'lon', 'alt', 'gs', 'trk', 'vs', 'sq', 'gnd', 'seen', 'org', 'dst', 'orgIcao', 'dstIcao', 'dist', 'ete', 'likely', 'first')
    doc = {'v': 1, 'generated': iso(now()), 'every': '5 min (GitHub Actions); fleet every 15 min (OpenSky free tier)', 'budgetNote': 'OpenSky anonymous: one request every 15 min (96 a day, 384 of 400 credits)', 'fleetAt': fleet_at, 'fleetSource': src,
           'fleet': [{k: f.get(k) for k in keys if f.get(k) not in (None, '')} for f in sorted(fleet, key=lambda f: f['cs'])],
           'atc': atc, 'errors': errors[:20], 'probe': PROBE,
           'credits': {'fleet': src, 'routes': 'vradarserver/standing-data (community), checked against position and track',
                       'airframes': 'Mode S → N-number; types from the FAA aircraft registry', 'atc': 'FAA NAS Status'},
           }
    with open(os.path.join(a.out, 'live.json'), 'w', encoding='utf-8') as f:
        json.dump(doc, f, separators=(',', ':'))
    with open(os.path.join(a.out, 'live_state.json'), 'w', encoding='utf-8') as f:
        json.dump(state, f, separators=(',', ':'))
    for e in errors:
        print('  error:', e)
    print(f'wrote {a.out}/live.json in {(now() - t0).total_seconds():.1f}s')


if __name__ == '__main__':
    main()
