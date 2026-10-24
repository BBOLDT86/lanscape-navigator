# One-off, round three: a current public source for CPI, unemployment and payrolls that answers a GitHub runner.
import json, urllib.request, urllib.error, gzip
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
def get(url):
    h = {'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip'}
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=20) as r:
            raw = r.read(400000)
            if raw[:2] == b'\x1f\x8b':
                try: raw = gzip.decompress(raw)
                except Exception: pass
            return {'status': r.status, 'len': len(raw), 'head': raw[:600].decode('utf-8', 'replace'), 'tail': raw[-400:].decode('utf-8', 'replace')}
    except urllib.error.HTTPError as e:
        return {'status': e.code, 'err': str(e)}
    except Exception as e:
        return {'status': None, 'err': f'{type(e).__name__}: {e}'}
T = {
 'econdb_cpi': 'https://www.econdb.com/api/series/CPIUS/?format=json',
 'econdb_urate': 'https://www.econdb.com/api/series/URATEUS/?format=json',
 'dbn_imf_cpi': 'https://api.db.nomics.world/v22/series/IMF/CPI/M.US.PCPI_IX?observations=1&format=json',
 'dbn_oecd_urate': 'https://api.db.nomics.world/v22/series/OECD/DSD_LFS@DF_IALFS_UNE_M/USA..._Z.Y._T.Y_GE15..M?observations=1&format=json',
 'bls_download': 'https://download.bls.gov/pub/time.series/ln/ln.series',
 'bls_data': 'https://data.bls.gov/timeseries/LNS14000000',
 'alfred': 'https://alfred.stlouisfed.org/graph/alfredgraph.csv?id=UNRATE',
 'fred_http': 'http://fred.stlouisfed.org/graph/fredgraph.csv?id=UNRATE',
 'cleveland_nowcast': 'https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/nowcast_month.json',
 'cnbc_econ': 'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=USCPI|USUNEMP|USNFP|.USCPIYY&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json',
 'nasdaq_econ_past': 'https://api.nasdaq.com/api/calendar/economicevents?date=2026-10-15',
}
out = {k: get(v) for k, v in T.items()}
json.dump(out, open('probe.json', 'w'), indent=1)
for k, v in out.items(): print(k, v.get('status'), v.get('len'), (v.get('err') or '')[:80])
