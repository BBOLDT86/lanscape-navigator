# One-off, round two: full CNBC quote fields for the planned symbols, and public routes to official economic data.
import json, urllib.request, urllib.error, gzip, time
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
def get(url, headers=None, full=False):
    h = {'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip'}; h.update(headers or {})
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=25) as r:
            raw = r.read()
            if raw[:2] == b'\x1f\x8b': raw = gzip.decompress(raw)
            txt = raw.decode('utf-8', 'replace')
            return {'status': r.status, 'len': len(raw), 'body' if full else 'head': txt if full else txt[:900]}
    except urllib.error.HTTPError as e:
        return {'status': e.code, 'err': str(e)}
    except Exception as e:
        return {'status': None, 'err': f'{type(e).__name__}: {e}'}
CN = 'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols={}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1'
syms = ['.SPX', '.DJI', '.IXIC', '.RUT', '.VIX', '@SP.1', '@ND.1', '@DJ.1', '.STOXX50E', '.FTSE', '.GDAXI', '.FCHI', '.N225', '.HSI', '.SSEC', '.BVSP',
        'US3M', 'US2Y', 'US5Y', 'US10Y', 'US30Y', '.DXY', 'EUR=', 'GBP=', 'JPY=', 'CNY=', 'BRL=', 'MXN=', '@CL.1', '@LCO.1', '@NG.1', '@GC.1', '@SI.1',
        '@HG.1', '@C.1', 'BTC.CM=', 'ETH.CM=', 'SOL.CM=', 'XLK', 'BRK.B', 'PBR', 'NVO']
out = {'cnbc_full': get(CN.format('|'.join(syms)), full=True)}
for s in ['@CL.1', 'US10Y', 'EUR=', 'BTC.CM=', 'XLK']:
    r = get(f'https://ts-api.cnbc.com/harmony/app/charts/1D.json?symbol={s}', full=True)
    try:
        bars = json.loads(r['body'])['barData']['priceBars']; r = {'status': r['status'], 'bars': len(bars), 'first': bars[0] if bars else None, 'last': bars[-1] if bars else None}
    except Exception as e:
        r = {'status': r.get('status'), 'err': str(e)[:100]}
    out['chart1d_' + s] = r
D = 'https://api.db.nomics.world/v22/series/{}?observations=1&format=json'
for k, path in {'dbn_cpi': 'BLS/cu/CUUR0000SA0', 'dbn_core': 'BLS/cu/CUUR0000SA0L1E', 'dbn_unrate': 'BLS/ln/LNS14000000', 'dbn_payrolls': 'BLS/ce/CES0000000001',
                'dbn_gdp': 'BEA/NIPA-T10101/A191RL-Q', 'dbn_gas': 'EIA/PET/EMM_EPMR_PTE_NUS_DPG.W', 'dbn_retail': 'CENSUS/MARTS/MARTS-44X72-SA-MPCSM', 'dbn_fred_unrate': 'FED/unrate'}.items():
    out[k] = get(D.format(path))
out['nyfed_effr'] = get('https://markets.newyorkfed.org/api/rates/unsecured/effr/last/3.json')
out['freddie_pmms'] = get('https://www.freddiemac.com/pmms/docs/PMMS_history.csv')
out['umich'] = get('https://www.sca.isr.umich.edu/files/tbmics.csv')
out['dol_claims'] = get('https://oui.doleta.gov/unemploy/csv/ar539.csv')
out['bls_page'] = get('https://www.bls.gov/news.release/empsit.nr0.htm')
json.dump(out, open('probe.json', 'w'), indent=1)
for k, v in out.items(): print(k, v.get('status'), v.get('len'), (v.get('err') or '')[:80])
