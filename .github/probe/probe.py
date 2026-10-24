# One-off: which market and economic data sources answer a GitHub runner? Results go to the probe branch.
import json, urllib.request, urllib.error, gzip, time
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
def get(url, data=None, headers=None):
    h = {'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip'}; h.update(headers or {})
    t = time.time()
    try:
        req = urllib.request.Request(url, data=data, headers=h)
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read()
            if raw[:2] == b'\x1f\x8b': raw = gzip.decompress(raw)
            return {'status': r.status, 'ms': int((time.time() - t) * 1000), 'len': len(raw), 'head': raw[:700].decode('utf-8', 'replace')}
    except urllib.error.HTTPError as e:
        return {'status': e.code, 'err': str(e), 'head': (e.read() or b'')[:300].decode('utf-8', 'replace')}
    except Exception as e:
        return {'status': None, 'err': f'{type(e).__name__}: {e}'}
CN = 'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols={}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1'
NQ = {'Origin': 'https://www.nasdaq.com', 'Referer': 'https://www.nasdaq.com/', 'Accept': 'application/json'}
tests = {
 'cnbc_quote': CN.format('.SPX|.DJI|.IXIC|.RUT|.VIX|@SP.1|US10Y|US3M|.DXY|EUR=|JPY=|BRL=|@CL.1|@LCO.1|@GC.1|@HG.1|@C.1|BTC.CM=|.BVSP|.STOXX50E|.FTSE|.N225|.HSI|.SSEC|AAPL|XLK'),
 'cnbc_chart_1d': 'https://ts-api.cnbc.com/harmony/app/charts/1D.json?symbol=.SPX',
 'cnbc_chart_1y': 'https://ts-api.cnbc.com/harmony/app/charts/1Y.json?symbol=.SPX',
 'cnbc_chart_5d': 'https://ts-api.cnbc.com/harmony/app/charts/5D.json?symbol=AAPL',
 'nasdaq_aapl': 'https://api.nasdaq.com/api/quote/AAPL/info?assetclass=stocks',
 'nasdaq_spx': 'https://api.nasdaq.com/api/quote/SPX/info?assetclass=index',
 'nasdaq_hist': 'https://api.nasdaq.com/api/quote/AAPL/historical?assetclass=stocks&fromdate=2026-09-01&limit=50&todate=2026-10-24',
 'fred_csv': 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=UNRATE&cosd=2025-01-01',
 'fred_csv_plain': 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=UNRATE',
 'treasury_xml': 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=202610',
 'stooq': 'https://stooq.com/q/d/l/?s=^spx&i=d',
 'yahoo_chart': 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1d&interval=5m',
 'coingecko': 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true',
 'frankfurter': 'https://api.frankfurter.app/latest?from=USD&to=EUR,JPY,BRL',
 'eia_gas': 'https://www.eia.gov/dnav/pet/hist_xls/EMM_EPMR_PTE_NUS_DPGw.xls',
}
out = {k: get(v, headers=NQ if 'nasdaq' in k else None) for k, v in tests.items()}
out['bls_v1'] = get('https://api.bls.gov/publicAPI/v1/timeseries/data/', data=json.dumps({'seriesid': ['LNS14000000', 'CUUR0000SA0', 'CES0000000001'], 'startyear': '2025', 'endyear': '2026'}).encode(), headers={'Content-Type': 'application/json'})
out['bls_v1']['head'] = out['bls_v1'].get('head', '')[:400]
json.dump(out, open('probe.json', 'w'), indent=1)
for k, v in out.items(): print(k, v.get('status'), v.get('len'), (v.get('err') or '')[:80])
