"""Temporary: a few more channels, the shopping sites' search links, CORS for the fridge camera. Writes probe.json."""
import gzip, json, re, urllib.request
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'


def get(u, h=None, method='GET'):
    req = urllib.request.Request(u, headers={'User-Agent': UA, 'Accept-Encoding': 'gzip', 'Accept-Language': 'en-US,en;q=0.9', **(h or {})}, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        b = r.read(); return r.status, (gzip.decompress(b) if b[:2] == b'\x1f\x8b' else b), dict(r.headers), r.geturl()


out = {'channels': {}, 'links': {}, 'cors': {}}
for h in ['ViceGripGarage', 'ChrisFix', 'CleetusMcFarland', 'WatchJRGo', 'colbertlateshow', 'TheDailyShow', 'LastWeekTonight', 'LateNightSeth', 'JimmyKimmelLive']:
    try:
        st, b, _, _ = get(f'https://www.youtube.com/@{h}')
        t = b.decode('utf-8', 'replace')
        m = re.search(r'"externalId":"(UC[\w-]{22})"', t) or re.search(r'<link rel="canonical" href="https://www.youtube.com/channel/(UC[\w-]{22})"', t)
        title = re.search(r'<meta property="og:title" content="([^"]+)"', t)
        row = {'id': m.group(1) if m else None, 'title': title.group(1) if title else None}
        if m:
            st2, f, _, _ = get(f'https://www.youtube.com/feeds/videos.xml?channel_id={m.group(1)}')
            ft = f.decode('utf-8', 'replace')
            row['latest'] = re.findall(r'<entry>.*?<title>([^<]+)</title>.*?<published>([^<]+)</published>', ft, re.S)[:3]
        out['channels'][h] = row
    except Exception as ex:
        out['channels'][h] = {'error': repr(ex)[:200]}
LINKS = {
    'tesla_used_fsd': 'https://www.tesla.com/inventory/used/m3?AUTOPILOT=AUTOPILOT_FULL_SELF_DRIVING&arrangeby=plh&zip=94103&range=200',
    'carscom': 'https://www.cars.com/shopping/results/?stock_type=used&makes[]=tesla&models[]=tesla-model_3&keyword=full+self+driving&zip=94103&maximum_distance=100&year_min=2019',
    'autotrader': 'https://www.autotrader.com/cars-for-sale/used-cars/tesla/model-3?zip=94103&searchRadius=100&keywordPhrases=full%20self%20driving&startYear=2019',
    'cargurus': 'https://www.cargurus.com/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action?zip=94103&distance=100&entitySelectingHelper.selectedEntity=d2475&keyword=full%20self%20driving',
    'carvana': 'https://www.carvana.com/cars/tesla-model-3',
    'edmunds': 'https://www.edmunds.com/inventory/srp.html?make=tesla&model=tesla|model-3&inventorytype=used&zip=94103&radius=100&keyword=full%20self%20driving',
}
for k, u in LINKS.items():
    try:
        st, b, hd, final = get(u, {'Accept': 'text/html'})
        t = b.decode('utf-8', 'replace')
        ti = re.search(r'<title[^>]*>([^<]{0,200})', t)
        h1 = re.search(r'<h1[^>]*>(.{0,300}?)</h1>', t, re.S)
        kw = [w for w in ('self driving', 'Self-Driving', 'self-driving', 'keyword') if w in t][:4]
        out['links'][k] = {'status': st, 'final': final, 'title': ti.group(1).strip() if ti else None, 'h1': re.sub(r'<[^>]+>', ' ', h1.group(1)).strip()[:200] if h1 else None, 'len': len(b), 'kw': kw,
                           'count': re.findall(r'([\d,]+)\s+(?:matches|results|cars|vehicles|listings)', t)[:3]}
    except Exception as ex:
        out['links'][k] = {'error': repr(ex)[:200], 'code': getattr(ex, 'code', None)}
for k, (u, m, h) in {'mealdb': ('https://www.themealdb.com/api/json/v1/1/filter.php?i=chicken_breast', 'GET', {'Origin': 'https://bboldt86.github.io'}),
                     'anthropic_preflight': ('https://api.anthropic.com/v1/messages', 'OPTIONS', {'Origin': 'https://bboldt86.github.io', 'Access-Control-Request-Method': 'POST',
                                                                                              'Access-Control-Request-Headers': 'content-type,x-api-key,anthropic-version,anthropic-dangerous-direct-browser-access'})}.items():
    try:
        st, b, hd, _ = get(u, h, m)
        out['cors'][k] = {'status': st, 'headers': {a: v for a, v in hd.items() if a.lower().startswith('access-control')}, 'body': b[:200].decode('utf-8', 'replace')}
    except Exception as ex:
        hd = dict(getattr(ex, 'headers', {}) or {})
        out['cors'][k] = {'error': repr(ex)[:200], 'headers': {a: v for a, v in hd.items() if a.lower().startswith('access-control')}}
json.dump(out, open('probe.json', 'w'), indent=1)
print('done')
