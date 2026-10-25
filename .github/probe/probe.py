# One-off, round four: which home-listing and housing-market sources answer a GitHub runner?
import json, urllib.request, urllib.error, gzip, re
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
def get(url, data=None, headers=None, rng=None):
    h = {'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip'}; h.update(headers or {})
    if rng: h['Range'] = rng
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h), timeout=25) as r:
            raw = r.read(600000)
            if raw[:2] == b'\x1f\x8b':
                try: raw = gzip.decompress(raw)
                except Exception: pass
            return {'status': r.status, 'len': len(raw), 'clen': r.headers.get('Content-Length') or r.headers.get('Content-Range'), 'head': raw[:1500].decode('utf-8', 'replace')}
    except urllib.error.HTTPError as e:
        return {'status': e.code, 'err': str(e), 'head': (e.read() or b'')[:400].decode('utf-8', 'replace')}
    except Exception as e:
        return {'status': None, 'err': f'{type(e).__name__}: {e}'}
out = {}
Q = '''query Search { home_search(query: {postal_code: "43215", status: [for_sale], beds: {min: 4}, list_price: {max: 750000}}, limit: 5, sort: [{field: list_date, direction: desc}]) {
  total results { property_id listing_id list_price list_date status href
    description { beds baths_consolidated sqft lot_sqft type year_built }
    location { address { line city state_code postal_code coordinate { lat lon } } }
    primary_photo { href } } } }'''
RH = {'Content-Type': 'application/json', 'Origin': 'https://www.realtor.com', 'Referer': 'https://www.realtor.com/', 'Accept': 'application/json'}
for k, u in {'realtor_srp': 'https://www.realtor.com/api/v1/rdc_search_srp?client_id=rdc-search-new-communities&schema=vesta',
             'realtor_hulk': 'https://www.realtor.com/api/v1/hulk?client_id=rdc-x&schema=vesta',
             'realtor_frontdoor': 'https://www.realtor.com/frontdoor/graphql'}.items():
    out[k] = get(u, data=json.dumps({'query': Q, 'variables': {}}).encode(), headers=RH)
ac = get('https://www.redfin.com/stingray/do/location-autocomplete?location=43215&v=2', headers={'Accept': 'application/json'})
out['redfin_ac'] = ac
m = re.search(r'"id":"(\d+)_(\d+)"', ac.get('head') or '')
if m:
    rt, rid = m.group(1), m.group(2)
    out['redfin_csv'] = get(f'https://www.redfin.com/stingray/api/gis-csv?al=1&num_beds=4&max_price=750000&num_homes=20&ord=redfin-recommended-asc&page_number=1&region_id={rid}&region_type={rt}&sf=1,2,3,5,6,7&status=9&uipt=1,2,3,4,5,6,7,8&v=8')
out['zillow_page'] = get('https://www.zillow.com/homes/43215_rb/', headers={'Accept': 'text/html'})
for k, u in {'zhvi_zip': 'https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
             'zhvi_metro': 'https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
             'zori_zip': 'https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv',
             'zhvi_zip_bed4': 'https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_bdrmcnt_4_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv'}.items():
    out[k] = get(u, rng='bytes=0-1500')
out['redfin_news'] = get('https://www.redfin.com/news/feed/')
out['realtor_news'] = get('https://www.realtor.com/news/feed/')
json.dump(out, open('probe.json', 'w'), indent=1)
for k, v in out.items(): print(k, v.get('status'), v.get('len'), v.get('clen'), (v.get('err') or '')[:80])
