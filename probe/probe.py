import json, urllib.request, urllib.error, time, os, gzip
UA = 'TheWatchProbe/1.0 (https://bboldt86.github.io/lanscape-navigator/news/; the-watch-news@users.noreply.github.com)'
URLS = {
 # weather
 'om_fc': 'https://api.open-meteo.com/v1/forecast?latitude=39.96&longitude=-82.99&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,is_day&hourly=temperature_2m,precipitation_probability,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max&timezone=auto&forecast_days=10&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch',
 'om_geo': 'https://geocoding-api.open-meteo.com/v1/search?name=Columbus&count=6&language=en&format=json',
 'om_geo_zip': 'https://geocoding-api.open-meteo.com/v1/search?name=43017&count=6&language=en&format=json&countryCode=US',
 'om_geo_pt': 'https://geocoding-api.open-meteo.com/v1/search?name=S%C3%A3o%20Paulo&count=4&language=pt&format=json',
 'om_aq': 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=39.96&longitude=-82.99&current=us_aqi,european_aqi,pm2_5,uv_index&timezone=auto',
 'nws_points': 'https://api.weather.gov/points/39.96,-82.99',
 'nws_alerts_pt': 'https://api.weather.gov/alerts/active?point=39.96,-82.99',
 'nws_alerts_sev': 'https://api.weather.gov/alerts/active?status=actual&message_type=alert&severity=Extreme,Severe',
 'nws_alerts_count': 'https://api.weather.gov/alerts/active/count',
 'bdc_rev': 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=48.85&longitude=2.35&localityLanguage=en',
 'nhc_storms': 'https://www.nhc.noaa.gov/CurrentStorms.json',
 'spc_d1': 'https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson',
 'rainviewer': 'https://api.rainviewer.com/public/weather-maps.json',
 'meridian_wx': 'https://raw.githubusercontent.com/BBOLDT86/lanscape-navigator/meridian-feed/wx.json',
}
HEADS = {
 'ridge_iln': 'https://radar.weather.gov/ridge/standard/KILN_loop.gif',
 'ridge_conus': 'https://radar.weather.gov/ridge/standard/CONUS_loop.gif',
 'ridge_conus_large': 'https://radar.weather.gov/ridge/standard/CONUS-LARGE_loop.gif',
 'ridge_iln_still': 'https://radar.weather.gov/ridge/standard/KILN_0.gif',
 'spc_d1_img': 'https://www.spc.noaa.gov/products/outlook/day1otlk.gif',
 'spc_d1_png': 'https://www.spc.noaa.gov/products/outlook/day1otlk.png',
 'wpc_d1': 'https://www.wpc.ncep.noaa.gov/noaa/noaad1.gif',
 'nhc_two_atl': 'https://www.nhc.noaa.gov/xgtwo/two_atl_7d0.png',
 'nhc_two_pac': 'https://www.nhc.noaa.gov/xgtwo/two_pac_7d0.png',
 'goes_conus': 'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/CONUS/GEOCOLOR/625x375.jpg',
 'goes_conus_gif': 'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/CONUS/GEOCOLOR/GOES19-CONUS-GEOCOLOR-625x375.gif',
}
SHOP = {
 'fellow_p': 'https://fellowproducts.com/products/opus-conical-burr-grinder.json',
 'fellow_c': 'https://fellowproducts.com/collections/all/products.json?limit=2',
 'ourplace': 'https://fromourplace.com/products.json?limit=2',
 'madein': 'https://madeincookware.com/products.json?limit=2',
 'brooklinen': 'https://www.brooklinen.com/products.json?limit=2',
 'normcore': 'https://www.normcorewares.com/products.json?limit=2',
 'adams': 'https://adamspolishes.com/products.json?limit=2',
 'skims': 'https://skims.com/products.json?limit=2',
 'alo': 'https://www.aloyoga.com/products.json?limit=2',
 'stanley': 'https://www.stanley1913.com/products.json?limit=2',
 'lulu_page': 'https://shop.lululemon.com/c/women-bestsellers/n16o10zq0cf',
 'lulu_api': 'https://shop.lululemon.com/api/c/women-bestsellers',
 'williams': 'https://www.williams-sonoma.com/products/breville-the-bambino-espresso-maker/',
 'homedepot': 'https://www.homedepot.com/',
 'target': 'https://www.target.com/',
 'ebay_search': 'https://www.ebay.com/sch/i.html?_nkw=breville+bambino',
 'bestbuy': 'https://www.bestbuy.com/',
}
FEEDS = {
 'tpg': 'https://thepointsguy.com/feed/', 'omaat': 'https://onemileatatime.com/feed/', 'fm': 'https://frequentmiler.com/feed/',
 'doc': 'https://www.doctorofcredit.com/feed/', 'vftw': 'https://viewfromthewing.com/feed/', 'up': 'https://upgradedpoints.com/feed/',
 'thrifty': 'https://thriftytraveler.com/feed/', 'awardwallet': 'https://awardwallet.com/blog/feed/', 'nerdwallet': 'https://www.nerdwallet.com/blog/feed/',
}
out = {}
def hit(name, url, method='GET', keep=4000):
    t = time.time()
    req = urllib.request.Request(url, method=method, headers={'User-Agent': UA, 'Origin': 'https://bboldt86.github.io', 'Accept': '*/*', 'Accept-Encoding': 'gzip'})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            body = r.read() if method == 'GET' else b''
            if r.headers.get('Content-Encoding') == 'gzip' and body: body = gzip.decompress(body)
            out[name] = {'status': r.status, 'acao': r.headers.get('Access-Control-Allow-Origin'), 'type': r.headers.get('Content-Type'), 'len': len(body) or r.headers.get('Content-Length'), 'ms': int((time.time()-t)*1000), 'body': body[:keep].decode('utf-8', 'replace')}
    except urllib.error.HTTPError as e:
        out[name] = {'status': e.code, 'acao': e.headers.get('Access-Control-Allow-Origin'), 'err': str(e)}
    except Exception as e:
        out[name] = {'status': None, 'err': repr(e)}
for k, u in URLS.items(): hit(k, u, keep=6000)
for k, u in HEADS.items(): hit(k, u, method='HEAD')
for k, u in SHOP.items(): hit(k, u, keep=1500)
for k, u in FEEDS.items(): hit(k, u, keep=1200)
os.makedirs('probe-out', exist_ok=True)
json.dump(out, open('probe-out/result.json', 'w'), indent=1)
for k, v in out.items(): print(k, v.get('status'), v.get('acao'), v.get('len'), v.get('err', ''))
