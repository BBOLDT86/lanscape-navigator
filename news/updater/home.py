#!/usr/bin/env python3
"""The Watch's Home desk: housing-market numbers by ZIP, saved home searches, and listings for them.

  python3 news/updater/home.py                  daily: refresh the market tables when Zillow updates them, and listings
  python3 news/updater/home.py --force          refresh everything now
  python3 news/updater/home.py --add-from-issue save the search in the GitHub issue that triggered the run (ISSUE_* env)

Market numbers: Zillow's public research data (Zillow Home Value Index by ZIP, overall and by bedroom count, and the
Zillow Observed Rent Index), which Zillow publishes for reuse with attribution. Listings: RentCast's listings API,
only when a RENTCAST_API_KEY secret is set; the free tier allows 50 requests a month, so searches are refreshed in
turn to stay under that. Listing sites' own search pages are not collected: their terms forbid it, and this site is
public. Writes news/data/home/{zips,market,listings,searches}.json. Standard library only.
"""
import csv
import hashlib
import datetime as dt
import io
import json
import math
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.normpath(os.path.join(HERE, '..', 'data', 'home'))
NOW = dt.datetime.now(dt.timezone.utc)
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 TheWatch/1.0'
Z = 'https://files.zillowstatic.com/research/public_csvs/'
FILES = {
    'all': Z + 'zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    **{f'b{n}': Z + f'zhvi/Zip_zhvi_bdrmcnt_{n}_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv' for n in range(1, 6)},
    'rent': Z + 'zori/Zip_zori_uc_sfrcondomfr_sm_month.csv',
    'us_value': Z + 'zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    'us_rent': Z + 'zori/Metro_zori_uc_sfrcondomfr_sm_month.csv',
}
STATES = {'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA',
          'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX',
          'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'PR'}
TYPES = {'house', 'condo', 'townhouse', 'multi', 'land', 'manufactured', 'any'}
errors = []


def load(name, d):
    try:
        with open(os.path.join(D, name), encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return d


def save(name, obj, pretty=False):
    os.makedirs(D, exist_ok=True)
    with open(os.path.join(D, name), 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=1 if pretty else None, separators=None if pretty else (',', ':'))


def req(url, method='GET', headers=None, timeout=120):
    h = {'User-Agent': UA, 'Accept': '*/*'}
    h.update(headers or {})
    return urllib.request.urlopen(urllib.request.Request(url, method=method, headers=h), timeout=timeout)


# ------------------------------------------------------------------ market tables
def stamp(url):
    try:
        with req(url, 'HEAD', timeout=30) as r:
            return r.headers.get('ETag') or r.headers.get('Last-Modified') or ''
    except Exception as ex:  # noqa: BLE001
        errors.append(f'{url.rsplit("/", 1)[1]} HEAD: {type(ex).__name__}')
        return ''


def rows(url):
    """stream one of Zillow's wide CSVs: (meta dict, [(month, value)...] for the last 37 months)"""
    with req(url) as r:
        reader = csv.reader(io.TextIOWrapper(r, encoding='utf-8', newline=''))
        head = next(reader)
        months = [i for i, h in enumerate(head) if re.match(r'^\d{4}-\d{2}-\d{2}$', h)]
        keep = months[-37:]
        for row in reader:
            if len(row) < len(head):
                continue
            meta = dict(zip(head[:months[0]], row[:months[0]]))
            vals = []
            for i in keep:
                try:
                    vals.append((head[i][:7], float(row[i])))
                except ValueError:
                    pass
            yield meta, vals


def last_and_change(vals):
    if not vals:
        return None, None, None
    v = vals[-1]
    year = [x for m, x in vals if m == f'{int(v[0][:4]) - 1}{v[0][4:]}']
    ch = round((v[1] / year[0] - 1) * 100, 1) if year else None
    return v[0], v[1], ch


def refresh_market(force, searches):
    old_market = load('market.json', {})
    stamps = {k: stamp(u) for k, u in FILES.items()}
    if not force and old_market.get('stamps') == stamps and all(stamps.values()):
        print('home: Zillow tables unchanged since', old_market.get('asOf'))
        return old_market
    wanted = {s['f'].get('zip') for s in searches if s.get('f', {}).get('zip')}
    zips, series, as_of = {}, {}, ''
    for key in ('all', 'b1', 'b2', 'b3', 'b4', 'b5', 'rent'):
        try:
            n = 0
            for meta, vals in rows(FILES[key]):
                z = meta.get('RegionName', '').zfill(5)
                if not z.isdigit():
                    continue
                m, v, ch = last_and_change(vals)
                if v is None:
                    continue
                rec = zips.setdefault(z, {'city': meta.get('City', ''), 'st': meta.get('State', '')})
                rec[key] = round(v, -2) if key != 'rent' else round(v)
                if key in ('all', 'rent') and ch is not None:
                    rec[key + 'Ch'] = ch
                if key == 'all':
                    as_of = max(as_of, m)
                if z in wanted:
                    series.setdefault(z, {})[key] = [[mm, round(x)] for mm, x in vals]
                n += 1
            print(f'home: {key} {n} ZIPs')
        except Exception as ex:  # noqa: BLE001
            errors.append(f'Zillow {key}: {type(ex).__name__} {str(ex)[:80]}')
    nat = {}
    for key, label in (('us_value', 'value'), ('us_rent', 'rent')):
        try:
            for meta, vals in rows(FILES[key]):
                if meta.get('RegionType') == 'country' or meta.get('RegionName') == 'United States':
                    m, v, ch = last_and_change(vals)
                    nat[label] = {'v': round(v), 'ch': ch, 'month': m, 'pts': [[mm, round(x)] for mm, x in vals]}
                    break
        except Exception as ex:  # noqa: BLE001
            errors.append(f'Zillow {key}: {type(ex).__name__} {str(ex)[:80]}')
    if not zips:
        return old_market
    # compact: one array per ZIP [city, state, value, 1y%, 1bd..5bd, rent, rent 1y%]
    cols = ['city', 'st', 'all', 'allCh', 'b1', 'b2', 'b3', 'b4', 'b5', 'rent', 'rentCh']
    save('zips.json', {'asOf': as_of, 'cols': cols, 'src': 'Zillow Home Value Index and Zillow Observed Rent Index',
                       'z': {z: [r.get(c) for c in cols] for z, r in sorted(zips.items())}})
    market = {'asOf': as_of, 'at': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'stamps': stamps, 'us': nat, 'series': series,
              'src': 'https://www.zillow.com/research/data/'}
    save('market.json', market)
    print(f'home: {len(zips)} ZIPs, market as of {as_of}')
    return market


# ------------------------------------------------------------------ searches
def clean_filters(f):
    out = {}
    def intval(k, lo, hi):
        try:
            v = int(float(f.get(k)))
            if lo <= v <= hi:
                out[k] = v
        except (TypeError, ValueError):
            pass
    intval('beds', 0, 12); intval('min', 0, 100_000_000); intval('max', 1_000, 100_000_000); intval('sqft', 0, 50_000)
    try:
        b = float(f.get('baths'))
        if 0 < b <= 12:
            out['baths'] = b
    except (TypeError, ValueError):
        pass
    z = str(f.get('zip') or '')
    if re.fullmatch(r'\d{5}', z):
        out['zip'] = z
    city = re.sub(r'[^A-Za-z .\'-]', '', str(f.get('city') or ''))[:40].strip()
    st = str(f.get('state') or '').upper()[:2]
    if city and st in STATES:
        out['city'], out['state'] = city, st
    t = str(f.get('type') or '')
    if t in TYPES:
        out['type'] = t
    feats = [re.sub(r'[^a-z -]', '', str(x).lower())[:24] for x in (f.get('features') or [])][:6]
    if feats:
        out['features'] = [x for x in feats if x]
    return out


def add_from_issue():
    body, title, num = os.environ.get('ISSUE_BODY', ''), os.environ.get('ISSUE_TITLE', ''), os.environ.get('ISSUE_NUMBER', '')
    searches = load('searches.json', [])
    if title.lower().startswith('home search remove:'):
        sid = title.split(':', 1)[1].strip()
        before = len(searches)
        searches = [s for s in searches if s['id'] != sid]
        save('searches.json', searches, pretty=True)
        msg = f'Removed saved search {sid}.' if len(searches) < before else f'No saved search {sid} was found.'
        print(msg); open(os.environ.get('GITHUB_OUTPUT', '/dev/null'), 'a').write(f'message={msg}\n')
        return
    m = re.search(r'\{.*\}', body, re.S)
    try:
        spec = json.loads(m.group(0)) if m else {}
    except ValueError:
        spec = {}
    f = clean_filters(spec.get('f') or {})
    q = re.sub(r'\s+', ' ', str(spec.get('q') or title.split(':', 1)[-1]))[:200].strip()
    if not (f.get('zip') or f.get('city')):
        msg = 'This search needs a ZIP code or a city and state, so it was not saved.'
        print(msg); open(os.environ.get('GITHUB_OUTPUT', '/dev/null'), 'a').write(f'message={msg}\n')
        return
    sid = 'h' + hashlib.sha1(json.dumps(f, sort_keys=True).encode()).hexdigest()[:8]  # the same filters, the same search
    if not any(s['id'] == sid for s in searches):
        searches.append({'id': sid, 'q': q, 'f': f, 'saved': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'issue': num})
    save('searches.json', searches, pretty=True)
    listings(searches, only=sid)
    msg = f'Saved search {sid}: {q}. The Watch shows it on the Home desk now; listings follow on the next update.'
    print(msg); open(os.environ.get('GITHUB_OUTPUT', '/dev/null'), 'a').write(f'message={msg}\n')


# ------------------------------------------------------------------ listings
RC_TYPES = {'house': 'Single Family', 'condo': 'Condo', 'townhouse': 'Townhouse', 'multi': 'Multi-Family', 'land': 'Land', 'manufactured': 'Manufactured'}


def matches(x, f):
    if f.get('beds') and (x.get('bedrooms') or 0) < f['beds']:
        return False
    if f.get('baths') and (x.get('bathrooms') or 0) < f['baths']:
        return False
    p = x.get('price') or 0
    if f.get('max') and p > f['max']:
        return False
    if f.get('min') and p < f['min']:
        return False
    if f.get('sqft') and (x.get('squareFootage') or 0) < f['sqft']:
        return False
    if f.get('type') and f['type'] != 'any' and RC_TYPES.get(f['type']) and x.get('propertyType') != RC_TYPES[f['type']]:
        return False
    return True


def listings(searches, only=None):
    key = os.environ.get('RENTCAST_API_KEY', '').strip()
    out = load('listings.json', {'searches': {}})
    out.setdefault('searches', {})
    if not key:
        out['source'] = None
        out['note'] = 'No listings source is connected. Add a RentCast API key as the RENTCAST_API_KEY secret to fill these in.'
        save('listings.json', out)
        return
    out['source'] = 'RentCast'
    out.pop('note', None)
    # stay under the free tier's 50 requests a month: refresh each search every few days, oldest first
    every = max(1, math.ceil(30 * max(1, len(searches)) / 45))
    todo = []
    for s in searches:
        if only and s['id'] != only:
            continue
        last = (out['searches'].get(s['id']) or {}).get('at')
        if only or not last or (NOW - dt.datetime.fromisoformat(last.replace('Z', '+00:00'))).days >= every:
            todo.append(s)
    for s in todo[:1]:  # one request a run at most
        f = s['f']
        params = {'status': 'Active', 'limit': 500}
        if f.get('zip'):
            params['zipCode'] = f['zip']
        else:
            params['city'], params['state'] = f['city'], f['state']
        try:
            with req('https://api.rentcast.io/v1/listings/sale?' + urllib.parse.urlencode(params), headers={'X-Api-Key': key, 'Accept': 'application/json'}, timeout=40) as r:
                data = json.loads(r.read())
            hits = [x for x in data if matches(x, f)]
            hits.sort(key=lambda x: x.get('listedDate') or '', reverse=True)
            out['searches'][s['id']] = {'at': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'n': len(hits), 'scanned': len(data), 'rows': [{
                'addr': x.get('formattedAddress') or x.get('addressLine1'), 'city': x.get('city'), 'st': x.get('state'), 'zip': x.get('zipCode'),
                'price': x.get('price'), 'beds': x.get('bedrooms'), 'baths': x.get('bathrooms'), 'sqft': x.get('squareFootage'),
                'lot': x.get('lotSize'), 'year': x.get('yearBuilt'), 'type': x.get('propertyType'), 'listed': (x.get('listedDate') or '')[:10],
                'dom': x.get('daysOnMarket'), 'lat': x.get('latitude'), 'lon': x.get('longitude')} for x in hits[:40]]}
            print(f"home: {s['id']} {len(hits)} of {len(data)} active listings match")
        except urllib.error.HTTPError as ex:
            errors.append(f"RentCast {s['id']}: HTTP {ex.code}")
        except Exception as ex:  # noqa: BLE001
            errors.append(f"RentCast {s['id']}: {type(ex).__name__} {str(ex)[:60]}")
    out['every'] = every
    for sid in list(out['searches']):
        if not any(s['id'] == sid for s in searches):
            del out['searches'][sid]
    save('listings.json', out)


def main():
    if '--add-from-issue' in sys.argv:
        add_from_issue()
        return 0
    force = '--force' in sys.argv
    searches = load('searches.json', [])
    if not os.path.exists(os.path.join(D, 'searches.json')):
        save('searches.json', [], pretty=True)
    refresh_market(force, searches)
    listings(searches)
    if errors:
        print('home errors:'); [print('  ', e) for e in errors[:12]]
        mk = load('market.json', {})
        if mk:
            mk['errors'] = errors[:20]; save('market.json', mk)
    return 0


if __name__ == '__main__':
    sys.exit(main())
