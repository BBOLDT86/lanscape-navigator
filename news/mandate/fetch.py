#!/usr/bin/env python3
"""Daily closes for the Mandate's market charts: the S&P 500, the Nasdaq, GEO Group, CoreCivic, Tesla and Palantir, from CNBC's
public chart service (the same one the Business desk's markets.py reads; Yahoo and Stooq refuse GitHub's runners). Runs on
Actions (.github/workflows/mandate.yml); the sandbox can't reach CNBC. Writes data/prices.json:
  {"asof": "...", "note": "...", "series": {".SPX": [["2024-11-01", 5728.8], ...], ...}, "errors": [...]}
A symbol that fails keeps its last good series. Then build.py redraws the pages.  python3 news/mandate/fetch.py [--check]"""
import datetime as dt
import gzip
import json
import os
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'data', 'prices.json')
SYMS = {'.SPX': 'S&P 500', '.IXIC': 'Nasdaq Composite', 'GEO': 'GEO Group', 'CXW': 'CoreCivic', 'TSLA': 'Tesla', 'PLTR': 'Palantir'}
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
SINCE = '2024-10-01'


def get(url, timeout=20):
    h = {'User-Agent': UA, 'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip'}
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout) as r:
                raw = r.read()
                if (r.headers.get('Content-Encoding') or '').lower() == 'gzip' or raw[:2] == b'\x1f\x8b':
                    raw = gzip.decompress(raw)
                return raw
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 + attempt * 2)


def chart(sym, rng):
    j = json.loads(get(f'https://ts-api.cnbc.com/harmony/app/charts/{rng}.json?symbol={urllib.parse.quote(sym, safe="")}'))
    bars = ((j.get('barData') or {}).get('priceBars')) or []
    out = {}
    for b in bars:
        if b.get('close') in (None, '') or not b.get('tradeTimeinMills'):
            continue
        d = dt.datetime.fromtimestamp(int(b['tradeTimeinMills']) // 1000, dt.timezone(dt.timedelta(hours=-5))).date().isoformat()
        out[d] = round(float(b['close']), 2)  # the last bar of a day wins
    return sorted((d, c) for d, c in out.items() if d >= SINCE)


def main():
    old = {}
    if os.path.exists(OUT):
        with open(OUT, encoding='utf-8') as f:
            old = json.load(f)
    series, errors = dict(old.get('series') or {}), []
    for sym in SYMS:
        pts = None
        for rng in ('5Y', '2Y', '1Y'):
            try:
                pts = chart(sym, rng)
                if pts and pts[0][0] <= '2024-11-15':
                    break
            except Exception as ex:
                errors.append(f'{sym} {rng}: {type(ex).__name__} {str(ex)[:80]}')
        if pts:
            had = {d: c for d, c in series.get(sym, [])}
            had.update(dict(pts))  # merge: a shorter range still updates the recent days
            series[sym] = sorted(had.items())
        elif sym not in series:
            errors.append(f'{sym}: no data')
    out = {'asof': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'note': 'daily closes, CNBC, Nov. 2024 to ' + max((s[-1][0] for s in series.values() if s), default=''),
           'names': SYMS, 'series': series, 'errors': errors}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f'{len(series)} series; ' + '; '.join(f'{k} {len(v)} to {v[-1][0]}' for k, v in series.items() if v) + (f'; errors: {errors}' if errors else ''))


if __name__ == '__main__':
    if '--check' in sys.argv:
        with open(OUT, encoding='utf-8') as f:
            d = json.load(f)
        assert all(isinstance(v, list) and all(len(p) == 2 for p in v) for v in d['series'].values())
        print('ok')
    else:
        main()
