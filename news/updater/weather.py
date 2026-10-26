#!/usr/bin/env python3
"""The Watch's Weather page: the parts a browser can't fetch for itself.

  python3 news/updater/weather.py        rebuild news/data/weather.json

news/data/weather.json
  stations  Meridian's airports, from the STATION_DATA block in meridian/index.html: [ICAO, IATA, name, state, lat, lon].
            The page reads their METARs, TAFs and FAA programs live from Meridian's feed branch (raw.githubusercontent.com,
            refreshed every 5 minutes by .github/workflows/meridian.yml), so adding a station to Meridian adds it here.
  storms    the National Hurricane Center's active tropical cyclones (CurrentStorms.json, which browsers can't read:
            it is served without CORS), each with its five-day cone picture when the hurricane center has posted one.

Everything else on the page (the forecast, warnings, radar, the storm outlook) comes straight from services that allow
browsers to read them. A source that fails here keeps its last good values. Standard library only.
"""
import datetime as dt
import json
import os
import re
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'news', 'data', 'weather.json')
UA = 'TheWatchWeather/1.0 (https://bboldt86.github.io/lanscape-navigator/news/#/weather; the-watch-news@users.noreply.github.com)'


def get(url, method='GET', timeout=20):
    req = urllib.request.Request(url, method=method, headers={'User-Agent': UA, 'Accept': 'application/json, */*'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read() if method == 'GET' else r.status


def stations():
    s = open(os.path.join(ROOT, 'meridian', 'index.html'), encoding='utf-8').read()
    m = re.search(r'const STATION_DATA=`(.*?)`', s, re.S)
    out = []
    for ln in (m.group(1).strip().splitlines() if m else []):
        f = ln.split('|')
        if len(f) >= 9:
            out.append([f[1], f[0], f[2], f[8], round(float(f[4]), 3), round(float(f[5]), 3)])
    return out


def storms():
    d = json.loads(get('https://www.nhc.noaa.gov/CurrentStorms.json'))
    out = []
    for s in d.get('activeStorms') or []:
        sid = (s.get('id') or '').lower()
        if not re.match(r'^(al|ep|cp)\d{6}$', sid):
            continue
        basin = sid[:2].upper()
        folder = {'AL': 'AT', 'EP': 'EP', 'CP': 'CP'}[basin] + sid[2:4]
        cone = f'https://www.nhc.noaa.gov/storm_graphics/{folder}/{sid.upper()}_5day_cone_with_line_and_wind_sm2.png'
        try:
            if get(cone, method='HEAD', timeout=10) != 200:
                cone = None
        except (urllib.error.URLError, OSError):
            cone = None
        adv = s.get('publicAdvisory') or {}
        gfx = s.get('forecastGraphics') or {}
        def num(v):
            try:
                return float(v)
            except (TypeError, ValueError):
                return None
        out.append({'id': sid, 'basin': basin, 'name': s.get('name'), 'cls': s.get('classification'),
                    'kt': num(s.get('intensity')), 'mb': num(s.get('pressure')), 'lat': s.get('latitudeNumeric'), 'lon': s.get('longitudeNumeric'),
                    'dir': s.get('movementDir'), 'mph': s.get('movementSpeed'), 'at': s.get('lastUpdate'), 'adv': (adv.get('advNum') or '').lstrip('0'),
                    'url': gfx.get('url') or adv.get('url') or 'https://www.nhc.noaa.gov/', 'cone': cone})
    order = {'MH': 0, 'HU': 1, 'TS': 2, 'STS': 3, 'TD': 4, 'STD': 5, 'PTC': 6, 'PC': 7}
    out.sort(key=lambda x: (order.get(x['cls'], 9), -(x['kt'] or 0)))
    return out


def main():
    try:
        old = json.load(open(OUT))
    except (OSError, ValueError):
        old = {}
    out = {'v': 1, 'at': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'errors': []}
    try:
        out['stations'] = stations()
    except Exception as e:  # noqa: BLE001  keep the last list
        out['stations'] = old.get('stations', []); out['errors'].append(f'stations: {e!r}')
    try:
        out['storms'] = storms(); out['stormsAt'] = out['at']
    except Exception as e:  # noqa: BLE001
        out['storms'] = old.get('storms', []); out['stormsAt'] = old.get('stormsAt'); out['errors'].append(f'storms: {e!r}')
    out['sources'] = {'stations': 'Meridian (meridian/index.html)', 'storms': 'National Hurricane Center, CurrentStorms.json'}
    with open(OUT, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f"weather.json: {len(out['stations'])} stations, {len(out['storms'])} active storms" + (f"; errors: {out['errors']}" if out['errors'] else ''))


if __name__ == '__main__':
    main()
