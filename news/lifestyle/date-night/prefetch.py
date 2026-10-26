#!/usr/bin/env python3
"""Date Night: OpenStreetMap's places around Weekender's eight cities, read ahead of time.

For each city in travel/data/cities.json this reads, through the Overpass API, the same kinds of places the page asks
for live (restaurants, bars, cafés, dessert, bookshops, theaters, cinemas, games, museums, parks, viewpoints) within a
walk of the city center and of each neighborhood in that weekend's Weekender guide, and writes
news/lifestyle/date-night/data/<city>.json. The page uses these files for walking plans in those cities, so they open
without waiting on the public map servers; anything else (a ZIP code, a drive) is still read live.

Run by .github/workflows/date-night.yml. No arguments; nothing but the standard library. A city whose query fails keeps
its last file.
"""
import datetime
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
TRAVEL = os.path.join(ROOT, 'travel')
OUT = os.path.join(HERE, 'data')
ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter',
             'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
R_FOOD, R_DO = 1000, 1700  # a little more than the page's walking radii (950 and 1600 m in these cities)
KEEP = {'name', 'amenity', 'leisure', 'tourism', 'shop', 'craft', 'man_made', 'cuisine', 'opening_hours', 'website',
        'contact:website', 'url', 'phone', 'contact:phone', 'website:menu', 'reservation', 'outdoor_seating',
        'diet:vegetarian', 'diet:vegan', 'diet:gluten_free', 'wheelchair', 'brand', 'brand:wikidata', 'wikidata',
        'wikipedia', 'addr:housenumber', 'addr:street', 'addr:city', 'addr:full', 'takeaway', 'bar', 'drink',
        'theatre:genre', 'access', 'disused', 'abandoned', 'lit'}
DEADLINE = time.time() + float(os.environ.get('DN_BUDGET', '1500'))  # stop asking after 25 minutes; whatever is written gets committed
UA = 'TheWatch-DateNight/1.0 (+https://bboldt86.github.io/lanscape-navigator/news/lifestyle/date-night/)'


def load(p, default=None):
    try:
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def dist(a, b):
    r = math.radians
    dl, dn = r(b['lat'] - a['lat']), r(b['lon'] - a['lon'])
    h = math.sin(dl / 2) ** 2 + math.cos(r(a['lat'])) * math.cos(r(b['lat'])) * math.sin(dn / 2) ** 2
    return 2 * 6371e3 * math.asin(math.sqrt(h))


def weekend(idx):
    """The guide weekend the page shows: the first one that hasn't ended yet, else the latest."""
    ws = sorted((idx or {}).get('weekends', []), key=lambda w: w['weekend'])
    today = datetime.date.today().isoformat()
    for w in ws:
        end = (datetime.date.fromisoformat(w['weekend']) + datetime.timedelta(days=2)).isoformat()
        if end >= today:
            return w
    return ws[-1] if ws else None


def areas(city, guide, places, photos):
    """The neighborhoods the page offers, worked out the same way it does (cityGuide in index.html)."""
    acc = {}
    order = []
    for day in guide.get('days', []):
        for s in day.get('stops', []):
            p = places.get(f"{city}|{s['name']}|{s['area']}") or (s.get('wiki') and photos.get(s['wiki']))
            if not p or p.get('lat') is None:
                continue
            a = str(s.get('area') or '').strip()
            if not a:
                continue
            if a not in acc:
                acc[a] = {'name': a, 'lat': 0.0, 'lon': 0.0, 'n': 0}
                order.append(a)
            acc[a]['lat'] += p['lat']
            acc[a]['lon'] += p['lon']
            acc[a]['n'] += 1
    lst = [{'name': x['name'], 'lat': x['lat'] / x['n'], 'lon': x['lon'] / x['n'], 'n': x['n']} for x in (acc[k] for k in order)]
    lst.sort(key=lambda x: -x['n'])  # stable, like the page's sort
    kept = []
    for a in lst:
        if not any(dist(k, a) < 650 for k in kept):
            kept.append(a)
    return kept[:9]


def query(anchors):
    st = []
    for a in anchors:
        A = lambda r: f"(around:{r},{a['lat']:.5f},{a['lon']:.5f})"
        st += [f'nwr["amenity"~"^(restaurant|food_court|bar|pub|biergarten|cafe|ice_cream|nightclub)$"]["name"]{A(R_FOOD)};',
               f'nwr["shop"~"^(chocolate|confectionery|pastry|books)$"]["name"]{A(R_FOOD)};',
               f'nwr["craft"~"^(brewery|winery|distillery)$"]["name"]{A(R_FOOD)};',
               f'nwr["amenity"~"^(cinema|theatre|arts_centre|music_venue|planetarium|karaoke_box|casino)$"]["name"]{A(R_DO)};',
               f'nwr["leisure"~"^(bowling_alley|escape_game|miniature_golf|amusement_arcade|ice_rink|park|garden|marina)$"]["name"]{A(R_DO)};',
               f'nwr["tourism"~"^(museum|gallery|viewpoint|aquarium)$"]["name"]{A(R_DO)};',
               f'nwr["man_made"="pier"]["name"]{A(R_DO)};']
    return '[out:json][timeout:120];(\n' + '\n'.join(st) + '\n);out center;'


def overpass(q):
    body = urllib.parse.urlencode({'data': q}).encode()
    last = None
    for attempt in range(2):
        for ep in ENDPOINTS:
            left = DEADLINE - time.time()
            if left < 30:
                raise RuntimeError('out of time')
            try:
                req = urllib.request.Request(ep, data=body, headers={'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded'})
                with urllib.request.urlopen(req, timeout=min(150, left)) as r:
                    j = json.load(r)
                if not j.get('elements') and 'remark' in j:
                    raise RuntimeError(j['remark'][:200])
                return j, ep
            except Exception as e:  # a busy or failing server: try the next one
                last = e
                print(f'  {ep}: {str(e)[:160]}', file=sys.stderr)
                time.sleep(8)
        time.sleep(30)
    raise RuntimeError(f'no server answered: {last}')


def compact(j):
    rows, seen = [], set()
    for el in j.get('elements', []):
        k = (el['type'], el['id'])
        if k in seen:
            continue
        seen.add(k)
        lat = el.get('lat', (el.get('center') or {}).get('lat'))
        lon = el.get('lon', (el.get('center') or {}).get('lon'))
        tags = {t: v for t, v in (el.get('tags') or {}).items() if t in KEEP}
        if lat is None or lon is None or not tags.get('name'):
            continue
        rows.append([el['type'][0], el['id'], round(lat, 6), round(lon, 6), tags])
    rows.sort(key=lambda r: (r[0], r[1]))
    return rows


def main():
    cities = (load(os.path.join(TRAVEL, 'data', 'cities.json'), {}) or {}).get('cities', [])
    w = weekend(load(os.path.join(TRAVEL, 'guides', 'index.json'), {}))
    places = (load(os.path.join(TRAVEL, 'data', 'places.json'), {}) or {}).get('places', {})
    photos = (load(os.path.join(TRAVEL, 'data', 'photos.json'), {}) or {}).get('titles', {})
    os.makedirs(OUT, exist_ok=True)
    only = set(sys.argv[1:])
    ok = 0
    for c in cities:
        if only and c['id'] not in only:
            continue
        guide = load(os.path.join(TRAVEL, 'guides', w['weekend'], c['id'] + '.json'), {}) if w else {}
        anchors = [{'name': 'center', 'lat': c['lat'], 'lon': c['lon'], 'n': 0}] + areas(c['id'], guide or {}, places, photos)
        print(f"{c['id']}: {len(anchors)} anchors", file=sys.stderr)
        try:
            j, ep = overpass(query(anchors))
        except Exception as e:
            print(f"{c['id']}: kept the last file ({e})", file=sys.stderr)
            continue
        rows = compact(j)
        head = {'v': 1, 'at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'city': c['id'],
                'weekend': w['weekend'] if w else '', 'r': [R_FOOD, R_DO], 'source': 'OpenStreetMap contributors (ODbL), via ' + urllib.parse.urlparse(ep).netloc,
                'anchors': [{'name': a['name'], 'lat': round(a['lat'], 5), 'lon': round(a['lon'], 5)} for a in anchors]}
        text = json.dumps(head, ensure_ascii=False)[:-1] + ',"els":[\n' + ',\n'.join(json.dumps(r, ensure_ascii=False, separators=(',', ':')) for r in rows) + '\n]}\n'
        with open(os.path.join(OUT, c['id'] + '.json'), 'w', encoding='utf-8') as f:
            f.write(text)
        ok += 1
        print(f"{c['id']}: {len(rows)} places, {len(text) // 1024} KB", file=sys.stderr)
        time.sleep(10)  # one city at a time: the public servers are shared
    print(f'{ok} of {len(only) or len(cities)} cities written', file=sys.stderr)


if __name__ == '__main__':
    main()
