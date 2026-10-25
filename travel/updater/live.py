#!/usr/bin/env python3
"""Weekender's live data, refreshed by .github/workflows/travel.yml every few hours and whenever a guide lands.

  python3 travel/updater/live.py            everything below
  python3 travel/updater/live.py --probe    also print a sample of each service's answer (for the Actions log)

Writes, in travel/data/:
  live.json    the weather for the eight cities (now and the next 16 days, Open-Meteo), exchange rates (Frankfurter,
               the European Central Bank's reference rates), U.S. airport delays (the FAA's National Airspace System
               status) and, when the repository secret TRAVELPAYOUTS_TOKEN is set, the lowest round-trip fares
               Aviasales travelers found in the last two days for the coming weekend, from 20 U.S. airports.
  photos.json  for every Wikipedia title a guide names (the opening picture, the stops, the hotels): the article's lead
               picture from Wikimedia Commons with its author and license, and the place's coordinates.
  places.json  coordinates for stops without a Wikipedia article, from OpenStreetMap's Nominatim (one request a
               second, cached for good, at most 60 new places a run).
Each block that fails keeps its last good version. The page reads the weather and rates live from the same services
too; these copies make it open fast and keep it working if they are down. Standard library only.
"""
import concurrent.futures as cf
import datetime as dt
import gzip
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
TRAVEL = os.path.normpath(os.path.join(HERE, '..'))
DATA = os.path.join(TRAVEL, 'data')
GUIDES = os.path.join(TRAVEL, 'guides')
UA = 'WeekenderBot/1.0 (https://bboldt86.github.io/lanscape-navigator/travel/; the-watch-news@users.noreply.github.com)'
EST = ZoneInfo('America/New_York')
PROBE = '--probe' in sys.argv
ORIGINS = ['ATL', 'BOS', 'CHI', 'CLT', 'CMH', 'DEN', 'DFW', 'DTW', 'IAH', 'LAS', 'LAX', 'MIA', 'MSP', 'NYC', 'PHL', 'PHX', 'SEA',
           'SFO', 'SLC', 'WAS']


def now_iso():
    return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def get(url, timeout=20, headers=None, tries=2):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Encoding': 'gzip', **(headers or {})})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                b = r.read()
                if r.headers.get('Content-Encoding') == 'gzip':
                    b = gzip.decompress(b)
                return b
        except Exception as ex:  # noqa: BLE001
            last = ex
            time.sleep(1.5 * (i + 1))
    raise last


def jget(url, **kw):
    return json.loads(get(url, **kw).decode('utf-8'))


def load(name, default):
    try:
        return json.load(open(os.path.join(DATA, name), encoding='utf-8'))
    except (OSError, ValueError):
        return default


def save(name, obj, compact=False):
    with open(os.path.join(DATA, name), 'w', encoding='utf-8') as fh:
        if compact:
            json.dump(obj, fh, ensure_ascii=False, separators=(',', ':'))
        else:
            json.dump(obj, fh, ensure_ascii=False, indent=1)


def probe(label, data):
    if PROBE:
        s = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
        print(f'--- {label}: {s[:1200]}')


CITIES = json.load(open(os.path.join(DATA, 'cities.json'), encoding='utf-8'))['cities']


# ------------------------------------------------------------------ weather
WX = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,wind_speed_10m_max,uv_index_max'


def weather():
    q = {'latitude': ','.join(str(c['lat']) for c in CITIES), 'longitude': ','.join(str(c['lon']) for c in CITIES),
         'current': 'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m',
         'daily': WX, 'timezone': 'auto', 'forecast_days': 16, 'temperature_unit': 'fahrenheit', 'wind_speed_unit': 'mph',
         'precipitation_unit': 'inch'}
    d = jget('https://api.open-meteo.com/v1/forecast?' + urllib.parse.urlencode(q), timeout=25)
    probe('open-meteo', d[0] if isinstance(d, list) else d)
    d = d if isinstance(d, list) else [d]
    out = {}
    for c, w in zip(CITIES, d):
        out[c['id']] = {'current': w.get('current'), 'daily': w.get('daily'), 'tz': w.get('timezone'), 'utc_offset': w.get('utc_offset_seconds')}
    return {'at': now_iso(), 'units': {'temp': 'F', 'wind': 'mph', 'precip': 'in'}, 'cities': out}


# ------------------------------------------------------------------ exchange rates
def fx():
    syms = 'EUR,GBP,CZK,CAD,MXN,JPY,BRL,CHF,AUD,DKK,SEK,NOK,PLN,HUF,TRY,CNY,INR,KRW,THB,ZAR,NZD,SGD,HKD,ILS,ISK'
    for url in (f'https://api.frankfurter.dev/v1/latest?base=USD&symbols={syms}', f'https://api.frankfurter.app/latest?from=USD&to={syms}'):
        try:
            d = jget(url)
            probe('frankfurter', d)
            if d.get('rates'):
                return {'at': now_iso(), 'base': 'USD', 'date': d.get('date'), 'rates': d['rates'], 'source': 'European Central Bank via Frankfurter'}
        except Exception as ex:  # noqa: BLE001
            print('fx:', url, ex)
    raise RuntimeError('no rates')


# ------------------------------------------------------------------ FAA airport status
def txt(e):
    return re.sub(r'\s+', ' ', (e.text or '')).strip() if e is not None else ''


def faa():
    raw = get('https://nasstatus.faa.gov/api/airport-status-information', timeout=25, headers={'Accept': 'application/xml'})
    probe('faa', raw.decode('utf-8', 'replace'))
    root = ET.fromstring(raw)
    airports = {}
    for dtype in root.iter('Delay_type'):
        kind = txt(dtype.find('Name'))
        for el in dtype.iter():
            a = el.find('ARPT')
            if a is None or el.tag == 'Delay_type':
                continue
            row = {'type': kind}
            for ch in el:
                if ch.tag == 'ARPT':
                    continue
                if len(ch):
                    sub = {g.tag: txt(g) for g in ch}
                    label = ch.get('Type') or ch.tag
                    row[label.lower()] = sub
                else:
                    row[ch.tag.lower()] = txt(ch)
            airports.setdefault(txt(a), []).append(row)
    upd = txt(root.find('Update_Time'))
    return {'at': now_iso(), 'updated': upd, 'airports': airports, 'source': 'FAA National Airspace System Status'}


# ------------------------------------------------------------------ fares (optional)
def fares(token):
    fri = coming_friday()
    dep, ret = fri.isoformat(), (fri + dt.timedelta(days=3)).isoformat()
    thu = (fri - dt.timedelta(days=1)).isoformat()
    routes = {}
    jobs = [(o, c['air']) for c in CITIES for o in ORIGINS if o not in (c['air'],) and not (o == 'SFO' and c['id'] == 'sf')
            and not (o == 'LAX' and c['id'] == 'la') and not (o == 'MIA' and c['id'] == 'miami') and not (o == 'LAS' and c['id'] == 'vegas')]

    def one(od):
        o, d = od
        best = None
        for out_day in (dep, thu):
            q = {'origin': o, 'destination': d, 'departure_at': out_day, 'return_at': ret, 'one_way': 'false', 'sorting': 'price',
                 'currency': 'usd', 'market': 'us', 'limit': 3, 'token': token}
            try:
                r = jget('https://api.travelpayouts.com/aviasales/v3/prices_for_dates?' + urllib.parse.urlencode(q), timeout=20)
            except Exception as ex:  # noqa: BLE001
                return od, None, str(ex)
            for f in (r.get('data') or []):
                if f.get('price') and (best is None or f['price'] < best['price']):
                    best = {'price': f['price'], 'airline': f.get('airline'), 'transfers': f.get('transfers'), 'return_transfers': f.get('return_transfers'),
                            'depart': f.get('departure_at'), 'return': f.get('return_at'), 'minutes': f.get('duration'),
                            'link': ('https://www.aviasales.com' + f['link']) if f.get('link') else None}
            if best:
                break
        return od, best, None

    errs = []
    with cf.ThreadPoolExecutor(6) as ex:
        for (o, d), best, err in ex.map(one, jobs):
            if err:
                errs.append(f'{o}-{d}: {err}')
            elif best:
                routes[f'{o}-{d}'] = best
    probe('fares', {'routes': len(routes), 'errors': errs[:3]})
    return {'at': now_iso(), 'weekend': fri.isoformat(), 'depart': dep, 'return': ret, 'currency': 'USD', 'routes': routes,
            'source': 'Aviasales Data API (lowest fares travelers found in the last 48 hours; they change and sell out)', 'errors': len(errs)}


def coming_friday():
    today = dt.datetime.now(EST).date()
    return today + dt.timedelta(days=(4 - today.weekday()) % 7 or 7)


# ------------------------------------------------------------------ pictures and coordinates from Wikipedia
def plain(s):
    s = re.sub(r'<[^>]+>', ' ', s or '')
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()


def wiki_one(title):
    t = urllib.parse.quote(title.replace(' ', '_'), safe='')
    s = jget(f'https://en.wikipedia.org/api/rest_v1/page/summary/{t}?redirect=true', timeout=20)
    row = {'title': s.get('title') or title, 'page': (s.get('content_urls') or {}).get('desktop', {}).get('page'),
           'desc': s.get('description'), 'at': now_iso()}
    co = s.get('coordinates') or {}
    if co.get('lat') is not None:
        row['lat'], row['lon'] = round(co['lat'], 5), round(co['lon'], 5)
    img = (s.get('originalimage') or {}).get('source') or ''
    m = re.search(r'upload\.wikimedia\.org/wikipedia/commons/(?:thumb/)?[0-9a-f]/[0-9a-f]{2}/([^/]+)', img)
    if not m:
        return row  # no picture, or one that is not free (it lives on English Wikipedia, not Commons): left out
    fname = urllib.parse.unquote(m.group(1))
    q = {'action': 'query', 'titles': 'File:' + fname, 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': 1600,
         'format': 'json', 'formatversion': 2}
    d = jget('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(q), timeout=20)
    pg = (d.get('query') or {}).get('pages') or [{}]
    ii = (pg[0].get('imageinfo') or [{}])[0]
    md = ii.get('extmetadata') or {}
    lic = plain((md.get('LicenseShortName') or {}).get('value'))
    if not ii.get('thumburl') or not lic:
        return row
    row['img'] = {'src': ii['thumburl'], 'w': ii.get('thumbwidth'), 'h': ii.get('thumbheight'),
                  'credit': plain((md.get('Artist') or {}).get('value'))[:140] or 'Wikimedia Commons',
                  'license': lic, 'licenseUrl': plain((md.get('LicenseUrl') or {}).get('value')) or None,
                  'file': ii.get('descriptionurl')}
    return row


def wiki_titles():
    titles = {c['wiki'] for c in CITIES}
    for g in current_guides():
        if (g.get('hero') or {}).get('wiki'):
            titles.add(g['hero']['wiki'])
        for d in g.get('days') or []:
            titles.update(s['wiki'] for s in d.get('stops') or [] if s.get('wiki'))
        titles.update(s['wiki'] for s in g.get('stay') or [] if s.get('wiki'))
    return titles


def current_guides():
    """guides for every weekend that has not ended, plus the latest weekend whatever its date"""
    out = []
    if not os.path.isdir(GUIDES):
        return out
    weeks = sorted(w for w in os.listdir(GUIDES) if re.fullmatch(r'\d{4}-\d{2}-\d{2}', w))
    today = dt.datetime.now(EST).date()
    keep = [w for w in weeks if dt.date.fromisoformat(w) + dt.timedelta(days=3) >= today] or weeks[-1:]
    for w in keep:
        for fn in sorted(os.listdir(os.path.join(GUIDES, w))):
            if fn.endswith('.json'):
                try:
                    out.append(json.load(open(os.path.join(GUIDES, w, fn), encoding='utf-8')))
                except (OSError, ValueError):
                    pass
    return out


def photos():
    cache = load('photos.json', {'v': 1, 'titles': {}})
    T = cache.setdefault('titles', {})
    want = [t for t in sorted(wiki_titles()) if t not in T or (not T[t].get('img') and T[t].get('at', '') < (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=14)).strftime('%Y-%m-%d'))]
    got, errs = 0, []

    def one(t):
        try:
            return t, wiki_one(t), None
        except Exception as ex:  # noqa: BLE001
            return t, None, str(ex)
    with cf.ThreadPoolExecutor(4) as ex:
        for t, row, err in ex.map(one, want[:220]):
            if row:
                T[t] = row; got += 1
            else:
                errs.append(f'{t}: {err}')
    if want:
        probe('wikipedia', T.get(want[0]) or errs[:1])
    cache['updated'] = now_iso()
    cache['source'] = 'Wikipedia (article summaries) and Wikimedia Commons (pictures, with their authors and licenses)'
    save('photos.json', cache)
    print(f'photos: {got} new of {len(want)} wanted, {len(T)} cached; {len(errs)} failed', (errs[:3] if errs else ''))


def places():
    cache = load('places.json', {'v': 1, 'places': {}})
    Pl = cache.setdefault('places', {})
    ph = load('photos.json', {}).get('titles', {})
    C = {c['id']: c for c in CITIES}
    want = []
    for g in current_guides():
        c = C.get(g.get('city'))
        if not c:
            continue
        items = [s for d in g.get('days') or [] for s in d.get('stops') or []] + list(g.get('stay') or [])
        for s in items:
            w = ph.get(s.get('wiki') or '', {})
            if w.get('lat') is not None:
                continue
            key = f"{c['id']}|{s.get('name')}|{s.get('area', '')}"
            if key not in Pl:
                want.append((key, s, c))
    n = 0
    for key, s, c in want[:60]:
        tries = [f"{s.get('addr')}, {c['name']}" if s.get('addr') else None, f"{s.get('name')}, {s.get('area', '')}, {c['name']}", f"{s.get('name')}, {c['name']}"]
        hit = None
        for q in [t for t in tries if t]:
            u = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'q': q, 'format': 'jsonv2', 'limit': 1, 'countrycodes': c['cc'].lower()})
            try:
                r = jget(u, timeout=20)
            except Exception as ex:  # noqa: BLE001
                print('nominatim:', ex); r = []
            time.sleep(1.1)
            if r:
                la, lo = float(r[0]['lat']), float(r[0]['lon'])
                if abs(la - c['lat']) < 0.6 and abs(lo - c['lon']) < 0.8:  # inside the metro area, or it is the wrong place
                    hit = {'lat': round(la, 5), 'lon': round(lo, 5), 'q': q}
                    break
        Pl[key] = hit or {'miss': True}
        n += 1
    cache['updated'] = now_iso()
    cache['source'] = 'OpenStreetMap contributors, via Nominatim'
    save('places.json', cache)
    print(f'places: {n} looked up, {len(want) - n} left for the next run, {len(Pl)} cached')


# ------------------------------------------------------------------ run
def main():
    os.makedirs(DATA, exist_ok=True)
    live = load('live.json', {'v': 1})
    stale = []
    for name, fn in (('weather', weather), ('fx', fx), ('faa', faa)):
        try:
            live[name] = fn()
            print(f'{name}: ok')
        except Exception as ex:  # noqa: BLE001
            stale.append(name)
            print(f'{name}: failed ({ex}); kept the last good copy')
    tok = os.environ.get('TRAVELPAYOUTS_TOKEN', '').strip()
    if tok:
        try:
            live['fares'] = fares(tok)
            print(f"fares: {len(live['fares']['routes'])} routes")
        except Exception as ex:  # noqa: BLE001
            stale.append('fares')
            print(f'fares: failed ({ex})')
    else:
        live.pop('fares', None)
    live['at'] = now_iso()
    live['stale'] = stale
    save('live.json', live, compact=True)
    for fn in (photos, places):
        try:
            fn()
        except Exception as ex:  # noqa: BLE001
            print(f'{fn.__name__}: failed ({ex})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
