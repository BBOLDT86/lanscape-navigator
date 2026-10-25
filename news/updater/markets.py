"""The Watch's markets desk: a snapshot of the markets and the economy at each edition -> news/data/markets.json

  python3 news/updater/markets.py           build for the current watch, unless it is already built
  python3 news/updater/markets.py --force   build anyway (a manual run)

Quotes and charts: CNBC's public quote service and chart data (no key). Economy: the official BLS, BEA and EIA
series through DBnomics' public mirror, the New York Fed's rates API, Freddie Mac's mortgage survey and the
University of Michigan's sentiment index. Calendars: Nasdaq's public earnings and economic calendars. (Yahoo,
Stooq, FRED and the BLS's own API turn GitHub's runners away.) Every number carries the time it is from; nothing
is estimated. A source that fails is left out and listed in 'errors', and that block keeps its last good version.
Standard library only.
"""
import concurrent.futures as cf
import csv
import datetime as dt
import gzip
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.normpath(os.path.join(HERE, '..', 'data'))
OUT = os.path.join(D, 'markets.json')
ETZ = ZoneInfo('America/New_York')
FORCE = '--force' in sys.argv
NOW = dt.datetime.now(dt.timezone.utc)
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

# ------------------------------------------------------------------ what's on the board
# (page key, CNBC symbol, name, kind, what it is). kind: idx = points, pct = a yield in percent, usd = dollars,
# usdper = dollars per unit of a currency, per = units of a currency per dollar
BOARD = [
    ('us', 'U.S. stocks', [
        ('^GSPC', '.SPX', 'S&P 500', 'idx', '500 of the biggest U.S. companies; the benchmark most funds track.'),
        ('^DJI', '.DJI', 'Dow', 'idx', '30 blue-chip U.S. companies, weighted by share price.'),
        ('^IXIC', '.IXIC', 'Nasdaq', 'idx', 'Every stock listed on the Nasdaq; heavy on technology.'),
        ('^RUT', '.RUT', 'Russell 2000', 'idx', '2,000 smaller U.S. companies; a read on the domestic economy.'),
        ('^VIX', '.VIX', 'VIX', 'idx', 'The fear gauge: how much the S&P 500 is expected to swing over the next month. Above 20 is jumpy; above 30 is fear.'),
    ]),
    ('futures', 'Futures', [
        ('ES=F', '@SP.1', 'S&P 500 futures', 'idx', 'Contracts on where the S&P 500 will be. They trade nearly around the clock, so they show the mood before the open.'),
        ('NQ=F', '@ND.1', 'Nasdaq 100 futures', 'idx', 'Contracts on the 100 biggest Nasdaq stocks; they trade nearly around the clock.'),
        ('YM=F', '@DJ.1', 'Dow futures', 'idx', 'Contracts on the Dow; they trade nearly around the clock.'),
    ]),
    ('world', 'World', [
        ('^STOXX50E', '.STOXX50E', 'Euro Stoxx 50', 'idx', 'The 50 biggest companies in the euro zone.'),
        ('^FTSE', '.FTSE', 'FTSE 100', 'idx', 'The 100 biggest companies listed in London.'),
        ('^GDAXI', '.GDAXI', 'DAX', 'idx', 'Germany’s 40 biggest listed companies.'),
        ('^FCHI', '.FCHI', 'CAC 40', 'idx', 'France’s 40 biggest listed companies.'),
        ('^N225', '.N225', 'Nikkei 225', 'idx', 'Japan’s benchmark, 225 Tokyo stocks.'),
        ('^HSI', '.HSI', 'Hang Seng', 'idx', 'Hong Kong’s benchmark, heavy on Chinese companies.'),
        ('000001.SS', '.SSEC', 'Shanghai', 'idx', 'Every stock on the Shanghai exchange.'),
        ('^BVSP', '.BVSP', 'Bovespa', 'idx', 'Brazil’s main stock index, in reais.'),
    ]),
    ('rates', 'Treasury yields', [
        ('^IRX', 'US3M', '3-month', 'pct', 'Tracks where traders expect the Fed’s rate to be over the next few months.'),
        ('US2Y', 'US2Y', '2-year', 'pct', 'Moves with expectations for the Fed over the next two years.'),
        ('^FVX', 'US5Y', '5-year', 'pct', 'A guide for car loans and medium-term borrowing.'),
        ('^TNX', 'US10Y', '10-year', 'pct', 'Sets the tone for mortgages and business borrowing. When yields rise, bond prices fall.'),
        ('^TYX', 'US30Y', '30-year', 'pct', 'The long end: what investors demand to lend to the government for a generation.'),
    ]),
    ('fx', 'Currencies', [
        ('DX-Y.NYB', '.DXY', 'Dollar index', 'idx', 'The dollar against six major currencies, mostly the euro. Up means a stronger dollar.'),
        ('EURUSD=X', 'EUR=', 'Euro', 'usdper', 'Dollars per euro.'),
        ('GBPUSD=X', 'GBP=', 'Pound', 'usdper', 'Dollars per British pound.'),
        ('JPY=X', 'JPY=', 'Yen', 'per', 'Yen per dollar. A higher number means a stronger dollar.'),
        ('CNY=X', 'CNY=', 'Yuan', 'per', 'Chinese yuan per dollar.'),
        ('BRL=X', 'BRL=', 'Real', 'per', 'Brazilian reais per dollar. A higher number means a weaker real.'),
        ('MXN=X', 'MXN=', 'Peso', 'per', 'Mexican pesos per dollar.'),
    ]),
    ('cmdty', 'Commodities', [
        ('CL=F', '@CL.1', 'Oil (WTI)', 'usd', 'U.S. crude, dollars a barrel. Gasoline prices follow it within a few weeks.'),
        ('BZ=F', '@LCO.1', 'Oil (Brent)', 'usd', 'The global oil benchmark, dollars a barrel.'),
        ('NG=F', '@NG.1', 'Natural gas', 'usd', 'Dollars per million BTU; drives heating and power bills.'),
        ('GC=F', '@GC.1', 'Gold', 'usd', 'Dollars an ounce. Investors buy it when they are nervous.'),
        ('SI=F', '@SI.1', 'Silver', 'usd', 'Dollars an ounce; part haven, part industrial metal.'),
        ('HG=F', '@HG.1', 'Copper', 'usd', 'Dollars a pound. “Dr. Copper” for what it says about factories and building.'),
        ('ZC=F', '@C.1', 'Corn', 'usd', 'Cents a bushel; feed, food and ethanol.'),
    ]),
    ('crypto', 'Crypto', [
        ('BTC-USD', 'BTC.CM=', 'Bitcoin', 'usd', 'The largest cryptocurrency. It trades around the clock.'),
        ('ETH-USD', 'ETH.CM=', 'Ether', 'usd', 'The currency of the Ethereum network; trades around the clock.'),
        ('SOL-USD', 'SOL.CM=', 'Solana', 'usd', 'A fast-growing blockchain’s coin; trades around the clock.'),
    ]),
]
SECTORS = [('XLK', 'Technology'), ('XLC', 'Communication'), ('XLY', 'Consumer discretionary'), ('XLP', 'Consumer staples'),
           ('XLF', 'Financials'), ('XLV', 'Health care'), ('XLI', 'Industrials'), ('XLE', 'Energy'), ('XLB', 'Materials'),
           ('XLU', 'Utilities'), ('XLRE', 'Real estate')]
# the biggest U.S.-listed companies, plus the most traded Brazilian and European names
STOCKS = [('AAPL', 'Apple'), ('MSFT', 'Microsoft'), ('NVDA', 'Nvidia'), ('AMZN', 'Amazon'), ('GOOGL', 'Alphabet'), ('META', 'Meta'),
          ('TSLA', 'Tesla'), ('AVGO', 'Broadcom'), ('BRK-B', 'Berkshire Hathaway'), ('JPM', 'JPMorgan Chase'), ('LLY', 'Eli Lilly'),
          ('V', 'Visa'), ('MA', 'Mastercard'), ('XOM', 'Exxon Mobil'), ('UNH', 'UnitedHealth'), ('WMT', 'Walmart'), ('JNJ', 'Johnson & Johnson'),
          ('PG', 'Procter & Gamble'), ('HD', 'Home Depot'), ('COST', 'Costco'), ('ORCL', 'Oracle'), ('NFLX', 'Netflix'), ('CRM', 'Salesforce'),
          ('AMD', 'AMD'), ('BAC', 'Bank of America'), ('KO', 'Coca-Cola'), ('PEP', 'PepsiCo'), ('ADBE', 'Adobe'), ('CSCO', 'Cisco'),
          ('MRK', 'Merck'), ('ABBV', 'AbbVie'), ('CVX', 'Chevron'), ('WFC', 'Wells Fargo'), ('DIS', 'Disney'), ('MCD', 'McDonald’s'),
          ('INTC', 'Intel'), ('IBM', 'IBM'), ('QCOM', 'Qualcomm'), ('GS', 'Goldman Sachs'), ('MS', 'Morgan Stanley'), ('CAT', 'Caterpillar'),
          ('BA', 'Boeing'), ('GE', 'GE Aerospace'), ('UBER', 'Uber'), ('PLTR', 'Palantir'), ('NKE', 'Nike'), ('SBUX', 'Starbucks'),
          ('T', 'AT&T'), ('VZ', 'Verizon'), ('PFE', 'Pfizer'), ('TMO', 'Thermo Fisher'), ('HON', 'Honeywell'), ('LMT', 'Lockheed Martin'),
          ('RTX', 'RTX'), ('F', 'Ford'), ('GM', 'General Motors'), ('DAL', 'Delta Air Lines'), ('UAL', 'United Airlines'), ('LUV', 'Southwest'),
          ('MU', 'Micron'), ('TSM', 'TSMC'), ('ASML', 'ASML'), ('SAP', 'SAP'), ('NVO', 'Novo Nordisk'), ('AZN', 'AstraZeneca'),
          ('SHEL', 'Shell'), ('PBR', 'Petrobras'), ('VALE', 'Vale'), ('ITUB', 'Itaú Unibanco'), ('NU', 'Nu Holdings'), ('COIN', 'Coinbase'),
          ('SMCI', 'Super Micro'), ('ARM', 'Arm'), ('SNOW', 'Snowflake'), ('SHOP', 'Shopify')]
CNBC_SYM = {'BRK-B': 'BRK.B'}
US_CASH = {'^GSPC', '^DJI', '^IXIC', '^RUT', '^VIX'}

errors = []
START = time.monotonic()
BUDGET = 170  # seconds: the workflow gives this step four minutes, and the edition must still be committed


def late():
    return time.monotonic() - START > BUDGET


def get(url, accept='*/*', headers=None, timeout=15, data=None):
    if late():
        raise TimeoutError('out of time for this run')
    h = {'User-Agent': UA, 'Accept': accept, 'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip'}
    h.update(headers or {})
    for attempt in range(2):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h, data=data), timeout=timeout) as r:
                raw = r.read()
                if (r.headers.get('Content-Encoding') or '').lower() == 'gzip' or raw[:2] == b'\x1f\x8b':
                    raw = gzip.decompress(raw)
                return raw
        except urllib.error.HTTPError as ex:
            if ex.code in (500, 502, 503, 504) and attempt == 0 and not late():
                time.sleep(1.5); continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
            if attempt == 0 and not late():
                time.sleep(1.5); continue
            raise


def num(s):
    """'7,623.68' / '4.999%' / '+0.42' / 'UNCH' -> float"""
    if s is None:
        return None
    s = str(s).strip()
    if s.upper() in ('UNCH', ''):
        return 0.0 if s else None
    try:
        return float(re.sub(r'[,%$+]', '', s))
    except ValueError:
        return None


def r4(x):
    if x is None:
        return None
    a = abs(x)
    return round(x, 2 if a >= 100 else 3 if a >= 10 else 4 if a >= 1 else 6)


def thin(xs, n):
    if len(xs) <= n:
        return xs
    step = (len(xs) - 1) / (n - 1)
    return [xs[round(i * step)] for i in range(n)]


CN_QUOTE = 'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols={}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1'


def cnbc_quotes(symbols):
    """one request per 40 symbols -> {cnbc symbol: quote dict}"""
    out = {}
    for i in range(0, len(symbols), 40):
        batch = symbols[i:i + 40]
        try:
            j = json.loads(get(CN_QUOTE.format(urllib.parse.quote('|'.join(batch), safe='|')), accept='application/json'))
            for q in ((j.get('FormattedQuoteResult') or {}).get('FormattedQuote')) or []:
                if q.get('code') == 0 and q.get('last') not in (None, ''):
                    out[q.get('symbol')] = q
        except Exception as ex:  # noqa: BLE001
            errors.append(f'CNBC quotes {batch[0]}..: {type(ex).__name__} {str(ex)[:60]}')
    return out


def cnbc_chart(sym, rng):
    """'1D' (minute bars) or '1Y' (daily bars) -> [(epoch seconds, close)]"""
    j = json.loads(get(f'https://ts-api.cnbc.com/harmony/app/charts/{rng}.json?symbol={urllib.parse.quote(sym, safe="")}', accept='application/json'))
    bars = ((j.get('barData') or {}).get('priceBars')) or []
    pts = sorted((int(b['tradeTimeinMills']) // 1000, float(b['close'])) for b in bars if b.get('close') not in (None, '') and b.get('tradeTimeinMills'))
    if rng == '1D':  # CNBC sometimes tacks a stray bar on hours after the session; drop it
        while len(pts) > 2 and pts[-1][0] - pts[-2][0] > 3 * 3600:
            pts.pop()
    return pts


def quote_time(q):
    """CNBC gives a full timestamp for 24-hour markets and a date for exchange closes"""
    t = q.get('last_time') or ''
    try:
        if 'T' in t:
            return int(dt.datetime.fromisoformat(t.replace('.000', '')).timestamp())
        d = dt.date.fromisoformat(t[:10])
        return int(dt.datetime(d.year, d.month, d.day, 16, 0, tzinfo=ETZ).timestamp())
    except ValueError:
        return int(NOW.timestamp())


def changes(daily, price, points=False):
    """1W / 1M / 3M / YTD / 1Y from daily closes (in percent; in points for yields); left out where history is short"""
    if not daily or price is None:
        return {}
    closes = [c for _, c in daily]
    move = (lambda a: round(price - a, 3)) if points else (lambda a: round((price / a - 1) * 100, 2))
    out = {}
    for k, n in (('w', 5), ('m', 21), ('q', 63), ('y', 250)):
        if len(closes) > n and closes[-1 - n]:
            out[k] = move(closes[-1 - n])
    year = dt.datetime.fromtimestamp(daily[-1][0], ETZ).year
    prior = [c for t, c in daily if dt.datetime.fromtimestamp(t, ETZ).year < year]
    if prior:
        out['ytd'] = move(prior[-1])
    return out


def record(key, q, name, kind, explain, intra, daily, ds=None):
    price, chg = num(q.get('last')), num(q.get('change'))
    if price is None:
        return None
    prev = price - chg if chg is not None else num(q.get('previous_day_closing'))
    rec = {'s': key, 'n': name, 'kind': kind, 'x': explain, 'p': price, 'pc': prev, 'c': chg,
           'cp': round(chg / prev * 100, 3) if chg is not None and prev else None,
           'hi': num(q.get('high')), 'lo': num(q.get('low')), 'h52': num(q.get('yrhiprice')), 'l52': num(q.get('yrloprice')),
           'v': num(q.get('volume')), 't': quote_time(q), 'mkt': q.get('curmktstatus'), 'src': 'CNBC'}
    if ds:
        rec['ds'] = ds
    if intra:
        rec['i'] = [r4(c) for _, c in thin(intra, 96)]; rec['it'] = [intra[0][0], intra[-1][0]]
    if daily:
        rec['d'] = [r4(c) for _, c in thin(daily, 130)]; rec['dt'] = [daily[0][0], daily[-1][0]]
        rec['ch'] = changes(daily, price, points=kind == 'pct')
        rec['q'] = [r4(c) for _, c in thin(daily[-63:], 40)]
    return {k: v for k, v in rec.items() if v is not None}


def safe_chart(sym, rng):
    try:
        return cnbc_chart(sym, rng)
    except Exception as ex:  # noqa: BLE001
        errors.append(f'CNBC chart {sym} {rng}: {type(ex).__name__} {str(ex)[:50]}')
        return []


# ------------------------------------------------------------------ the economy
DBN = 'https://api.db.nomics.world/v22/series/{}?observations=1&format=json'


def dbnomics(path):
    j = json.loads(get(DBN.format(path), accept='application/json', timeout=25))
    doc = (((j.get('series') or {}).get('docs')) or [{}])[0]
    per, val = doc.get('period') or [], doc.get('value') or []
    days = doc.get('period_start_day') or per
    return [(str(d)[:10], float(v)) for d, v in zip(days, val) if isinstance(v, (int, float))]


def eia_gas(series='EMM_EPMR_PTE_NUS_DPG'):
    """an EIA weekly U.S. fuel price (regular gasoline by default), from its own spreadsheet; DBnomics' copy as a fallback"""
    try:
        import xlrd  # noqa: PLC0415 - installed by the workflow; optional
        raw = get(f'https://www.eia.gov/dnav/pet/hist_xls/{series}w.xls', timeout=25)
        book = xlrd.open_workbook(file_contents=raw)
        sh = book.sheet_by_name('Data 1')
        pts = []
        for r in range(3, sh.nrows):
            d, v = sh.cell_value(r, 0), sh.cell_value(r, 1)
            if isinstance(d, float) and isinstance(v, float):
                y, m, dd, *_ = xlrd.xldate_as_tuple(d, book.datemode)
                pts.append((f'{y:04d}-{m:02d}-{dd:02d}', v))
        if pts:
            return pts
    except Exception as ex:  # noqa: BLE001
        errors.append(f'{series} (EIA): {type(ex).__name__} {str(ex)[:60]}')
    return dbnomics(f'EIA/PET/{series}.W')


# how long each kind of number stays current; past that it is left off the page rather than shown as the latest
FRESH_DAYS = {'DIESEL': 21, 'MORT15': 21, 'CPI': 100, 'CORE': 100, 'UNRATE': 100, 'PAYEMS': 70, 'CLAIMS': 14, 'GDP': 250, 'GAS': 21, 'FED': 14, 'MORT': 21, 'SENT': 60, 'CURVE': 10}


def newest(*series):
    """of several copies of the same official series, the one whose latest reading is newest"""
    ok = []
    for x in series:
        if x:
            ok.append(x)
    if not ok:
        raise ValueError('no data')
    return max(ok, key=lambda x: x[-1][0])


def safe(fn):
    try:
        return fn()
    except Exception:  # noqa: BLE001
        return []


def yoy(pts):
    by = dict(pts)
    out = []
    for d, v in pts:
        y, rest = d[:4], d[4:]
        a = by.get(f'{int(y) - 1}{rest}')
        if a:
            out.append((d, round((v / a - 1) * 100, 2)))
    return out


def econ_series():
    out = []
    def add(sid, name, unit, explain, pts, src, keep=40):
        pts = pts[-keep:]
        if len(pts) < 2:
            raise ValueError('no data')
        age = (NOW.date() - dt.date.fromisoformat(pts[-1][0])).days
        if age > FRESH_DAYS.get(sid, 90):
            raise ValueError(f'latest reading is from {pts[-1][0]}, too old to show as current')
        out.append({'id': sid, 'n': name, 'unit': unit, 'x': explain, 'v': pts[-1][1], 'date': pts[-1][0], 'prev': pts[-2][1],
                    'pdate': pts[-2][0], 'pts': [[d, v] for d, v in pts], 'src': src})
    jobs = [
        ('CPI', 'Inflation', '%', 'Consumer prices compared with a year earlier (BLS figures; IMF copy when newer).',
         lambda: newest(safe(lambda: yoy(dbnomics('BLS/cu/CUUR0000SA0'))), safe(lambda: yoy(dbnomics('IMF/CPI/M.US.PCPI_IX')))), 'https://www.bls.gov/cpi/'),
        ('CORE', 'Core inflation', '%', 'Prices without food and energy, compared with a year earlier. The Fed watches this one (BLS).', lambda: yoy(dbnomics('BLS/cu/CUUR0000SA0L1E')), 'https://www.bls.gov/cpi/'),
        ('UNRATE', 'Unemployment', '%', 'Share of people looking for work who can’t find it (BLS figures; OECD copy when newer).',
         lambda: newest(safe(lambda: dbnomics('BLS/ln/LNS14000000')), safe(lambda: dbnomics('OECD/DSD_LFS@DF_IALFS_UNE_M/USA..._Z.Y._T.Y_GE15..M'))), 'https://www.bls.gov/cps/'),
        ('PAYEMS', 'Jobs added', 'k', 'New payroll jobs in the month, in thousands (BLS).',
         lambda: (lambda p: [(p[i][0], round(p[i][1] - p[i - 1][1], 0)) for i in range(1, len(p))])(dbnomics('BLS/ce/CES0000000001')), 'https://www.bls.gov/ces/'),
        ('GDP', 'GDP growth', '%', 'How fast the economy grew in the quarter, at an annual rate, after inflation (BEA).', lambda: dbnomics('BEA/NIPA-T10101/A191RL-Q'), 'https://www.bea.gov/data/gdp/gross-domestic-product'),
        ('GAS', 'Gas price', '$', 'The average price of a gallon of regular gasoline in the U.S. (EIA, weekly).', eia_gas, 'https://www.eia.gov/petroleum/gasdiesel/'),
        ('DIESEL', 'Diesel', '$', 'The average price of a gallon of diesel in the U.S. (EIA, weekly). It feeds into what trucking adds to store prices.',
         lambda: eia_gas('EMD_EPD2D_PTE_NUS_DPG'), 'https://www.eia.gov/petroleum/gasdiesel/'),
    ]
    for sid, name, unit, x, fn, src in jobs:
        try:
            add(sid, name, unit, x, fn(), src, keep=36 if sid != 'GAS' else 52)
        except Exception as ex:  # noqa: BLE001
            errors.append(f'{sid} (DBnomics): {type(ex).__name__} {str(ex)[:60]}')
    try:  # the Fed's target range, from the New York Fed
        j = json.loads(get('https://markets.newyorkfed.org/api/rates/unsecured/effr/last/260.json', accept='application/json'))
        rows = sorted(j.get('refRates') or [], key=lambda r: r['effectiveDate'])
        wk = {}
        for r in rows:
            wk[dt.date.fromisoformat(r['effectiveDate']).isocalendar()[:2]] = (r['effectiveDate'], r.get('targetRateTo'))
        pts = [x for x in sorted(wk.values()) if x[1] is not None]
        add('FED', 'Fed rate', '%', f"The Federal Reserve’s target range for its benchmark rate is {rows[-1]['targetRateFrom']:.2f}% to {rows[-1]['targetRateTo']:.2f}%; banks lent overnight at {rows[-1]['percentRate']:.2f}% (New York Fed).",
            pts, 'https://www.newyorkfed.org/markets/reference-rates/effr', keep=52)
        out[-1]['range'] = [rows[-1]['targetRateFrom'], rows[-1]['targetRateTo']]
    except Exception as ex:  # noqa: BLE001
        errors.append(f'Fed rate (New York Fed): {type(ex).__name__} {str(ex)[:60]}')
    try:  # Freddie Mac's weekly survey
        raw = get('https://www.freddiemac.com/pmms/docs/PMMS_history.csv', accept='text/csv').decode('utf-8', 'replace')
        pts = []
        recs = list(csv.DictReader(io.StringIO(raw)))[-160:]
        for col, sid, name, x in (('pmms30', 'MORT', '30-year mortgage', 'The average 30-year fixed mortgage rate, from Freddie Mac’s weekly survey.'),
                                  ('pmms15', 'MORT15', '15-year mortgage', 'The average 15-year fixed mortgage rate, from Freddie Mac’s weekly survey.')):
            pts = []
            for r in recs:
                try:
                    m, d, y = r['date'].split('/'); pts.append((f'{y}-{int(m):02d}-{int(d):02d}', float(r[col])))
                except (ValueError, KeyError):
                    pass
            add(sid, name, '%', x, pts, 'https://www.freddiemac.com/pmms', keep=52)
    except Exception as ex:  # noqa: BLE001
        errors.append(f'Mortgage (Freddie Mac): {type(ex).__name__} {str(ex)[:60]}')
    try:  # University of Michigan
        raw = get('https://www.sca.isr.umich.edu/files/tbmics.csv', accept='text/csv').decode('utf-8', 'replace')
        months = {m: i for i, m in enumerate(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], 1)}
        pts = []
        for r in csv.reader(io.StringIO(raw)):
            if len(r) >= 3 and r[0].strip() in months:
                try:
                    pts.append((f'{int(r[1]):04d}-{months[r[0].strip()]:02d}-01', float(r[2])))
                except ValueError:
                    pass
        add('SENT', 'Consumer sentiment', '', 'The University of Michigan’s monthly survey of how people feel about the economy. 100 was the level in 1966.', sorted(pts), 'https://www.sca.isr.umich.edu/', keep=36)
    except Exception as ex:  # noqa: BLE001
        errors.append(f'Sentiment (Michigan): {type(ex).__name__} {str(ex)[:60]}')
    return out


NASDAQ_H = {'Origin': 'https://www.nasdaq.com', 'Referer': 'https://www.nasdaq.com/'}


def money(s):
    s = re.sub(r'[^0-9.\-]', '', s or '')
    try:
        return float(s)
    except ValueError:
        return None


def week_days():
    d = NOW.astimezone(ETZ).date()
    days = []
    while len(days) < 5:
        if d.weekday() < 5:
            days.append(d)
        d += dt.timedelta(days=1)
    return days


def earnings(day):
    j = json.loads(get(f'https://api.nasdaq.com/api/calendar/earnings?date={day.isoformat()}', accept='application/json', headers=NASDAQ_H))
    rows = ((j.get('data') or {}).get('rows')) or []
    out = []
    for r in rows:
        cap = money(r.get('marketCap'))
        if not cap:
            continue
        out.append({'s': r.get('symbol'), 'n': (r.get('name') or '').strip(), 'cap': cap,
                    'when': {'time-pre-market': 'before the open', 'time-after-hours': 'after the close'}.get(r.get('time'), ''),
                    'eps': r.get('epsForecast') or '', 'q': r.get('fiscalQuarterEnding') or ''})
    out.sort(key=lambda x: -x['cap'])
    seen, uniq = set(), []
    for x in out:
        k = re.sub(r'[^a-z]', '', x['n'].lower())[:18]
        if k not in seen:
            seen.add(k); uniq.append(x)
    return {'date': day.isoformat(), 'n': len(rows), 'rows': uniq[:12]}


ECON_COUNTRIES = {'United States': 'U.S.', 'Euro Zone': 'Euro zone', 'United Kingdom': 'U.K.', 'Brazil': 'Brazil', 'China': 'China', 'Japan': 'Japan', 'Germany': 'Germany'}


def econ_events(day):
    j = json.loads(get(f'https://api.nasdaq.com/api/calendar/economicevents?date={day.isoformat()}', accept='application/json', headers=NASDAQ_H))
    rows = ((j.get('data') or {}).get('rows')) or []
    out = []
    for r in rows:
        c = ECON_COUNTRIES.get((r.get('country') or '').strip())
        if not c:
            continue
        clean = lambda v: re.sub(r'&nbsp;|\s+', ' ', v or '').strip()
        out.append({'time': clean(r.get('gmt')), 'country': c, 'ev': clean(r.get('eventName')), 'act': clean(r.get('actual')),
                    'cons': clean(r.get('consensus')), 'prev': clean(r.get('previous'))})
    us = [x for x in out if x['country'] == 'U.S.']
    rest = [x for x in out if x['country'] != 'U.S.']
    return {'date': day.isoformat(), 'rows': us[:16] + rest[:8]}


RELEASES = {  # Nasdaq calendar event -> (id, name, unit, what it is)
    'PAYEMS': (r'^non ?-?farm payrolls$', 'Jobs added', 'k', 'New payroll jobs in the month, in thousands, as first reported (BLS, via Nasdaq’s calendar).'),
    'CLAIMS': (r'^initial jobless claims$', 'Jobless claims', 'k', 'New claims for unemployment benefits in a week, in thousands. They rise early in a downturn (Labor Department, via Nasdaq’s calendar).'),
}


def release_actuals(cache):
    """scan recent days of Nasdaq's calendar for the actual payrolls and claims numbers; remember what was found"""
    cache = dict(cache or {})
    back = 7 if cache else 32
    d = NOW.astimezone(ETZ).date()
    days = []
    while len(days) < back:
        if d.weekday() < 5:
            days.append(d)
        d -= dt.timedelta(days=1)
    for day in days:
        if late():
            break
        try:
            j = json.loads(get(f'https://api.nasdaq.com/api/calendar/economicevents?date={day.isoformat()}', accept='application/json', headers=NASDAQ_H))
        except Exception:  # noqa: BLE001
            continue
        for r in ((j.get('data') or {}).get('rows')) or []:
            if (r.get('country') or '').strip() != 'United States':
                continue
            ev = re.sub(r'\s+', ' ', (r.get('eventName') or '').strip()).lower()
            act = num(re.sub(r'[KkMm]$', '', (r.get('actual') or '').replace('&nbsp;', '').strip()))
            prev = num(re.sub(r'[KkMm]$', '', (r.get('previous') or '').replace('&nbsp;', '').strip()))
            for sid, (rx, *_rest) in RELEASES.items():
                if re.match(rx, ev) and act is not None:
                    if sid == 'CLAIMS' and act > 5000:
                        act, prev = act / 1000, (prev / 1000 if prev else prev)
                    if not cache.get(sid) or cache[sid]['date'] <= day.isoformat():
                        cache[sid] = {'date': day.isoformat(), 'v': act, 'prev': prev}
    return cache


def current_watch():
    et = NOW.astimezone(ETZ)
    names = ['middle', 'morning', 'forenoon', 'afternoon', 'dog', 'first']
    start = et.replace(hour=(et.hour // 4) * 4, minute=0, second=0, microsecond=0)
    return f'{start.date().isoformat()}-{names[et.hour // 4]}'


def main():
    wid = current_watch()
    try:
        old = json.load(open(OUT, encoding='utf-8'))
    except (OSError, ValueError):
        old = {}
    if not FORCE and old.get('id') == wid:
        print(f'markets for {wid} are already out; nothing to do')
        return 0
    board_items = [(g, key, cn, name, kind, x) for g, _l, items in BOARD for key, cn, name, kind, x in items]
    sector_items = [('sec', key, key, name, 'usd', '') for key, name in SECTORS]
    stock_items = [('st', key, CNBC_SYM.get(key, key), name, 'usd', '') for key, name in STOCKS]
    allsyms = [it[2] for it in board_items + sector_items + stock_items]
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        qjob = pool.submit(cnbc_quotes, allsyms)
        intra = {it[2]: pool.submit(safe_chart, it[2], '1D') for it in board_items + sector_items}
        daily = {it[2]: pool.submit(safe_chart, it[2], '1Y') for it in board_items + sector_items + stock_items}
        ejob = pool.submit(econ_series)
        days = week_days()
        ejobs = {d: pool.submit(earnings, d) for d in days}
        vjobs = {d: pool.submit(econ_events, d) for d in days}
        quotes = qjob.result()
        recs = {}
        for g, key, cn, name, kind, x in board_items + sector_items + stock_items:
            q = quotes.get(cn)
            if not q:
                errors.append(f'{name}: no quote'); continue
            bars = intra[cn].result() if cn in intra else None
            if bars and (g == 'sec' or key in US_CASH):  # U.S. cash markets: the regular session only
                day0 = dt.datetime.fromtimestamp(bars[0][0], ETZ).date()
                cut = dt.datetime(day0.year, day0.month, day0.day, 16, 5, tzinfo=ETZ).timestamp()
                bars = [b for b in bars if b[0] <= cut] or bars
            r = record(key, q, name, kind, x, bars, daily[cn].result(), ds=key if g == 'st' else None)
            if r:
                recs[key] = r
        econ = ejob.result()
    try:
        rel = release_actuals(old.get('releases'))
    except Exception as ex:  # noqa: BLE001
        rel = old.get('releases') or {}; errors.append(f'release actuals: {type(ex).__name__} {str(ex)[:50]}')
    have = {e['id'] for e in econ}
    for sid, (_rx, name, unit, x) in RELEASES.items():
        r = rel.get(sid)
        if not r or sid in have:
            continue
        if (NOW.date() - dt.date.fromisoformat(r['date'])).days > FRESH_DAYS.get(sid, 40):
            continue
        econ.append({'id': sid, 'n': name, 'unit': unit, 'x': x, 'v': r['v'], 'date': r['date'], 'prev': r.get('prev'), 'pts': [],
                     'released': True, 'src': 'https://www.nasdaq.com/market-activity/economic-calendar'})
    order = ['CPI', 'CORE', 'UNRATE', 'PAYEMS', 'CLAIMS', 'GDP', 'FED', 'MORT', 'MORT15', 'GAS', 'DIESEL', 'SENT', 'CURVE']
    board = []
    for g, label, items in BOARD:
        rows = [recs[k] for k, *_ in items if k in recs]
        if rows:
            board.append({'g': g, 'label': label, 'rows': rows})
    sectors = [recs[k] for k, _ in SECTORS if k in recs]
    stocks = [recs[k] for k, _ in STOCKS if k in recs]
    # the yield curve: the 10-year minus the 2-year, from the same quotes and charts
    t10, t2 = recs.get('^TNX'), recs.get('US2Y')
    if t10 and t2:
        try:
            d10 = {dt.datetime.fromtimestamp(t, ETZ).date().isoformat(): c for t, c in daily['US10Y'].result()}
            d2 = {dt.datetime.fromtimestamp(t, ETZ).date().isoformat(): c for t, c in daily['US2Y'].result()}
            pts = [(d, round(d10[d] - d2[d], 3)) for d in sorted(d10) if d in d2]
            wk = {}
            for d, v in pts:
                wk[dt.date.fromisoformat(d).isocalendar()[:2]] = (d, v)
            pts = sorted(wk.values())[-52:]
            cur = round(t10['p'] - t2['p'], 3)
            econ.append({'id': 'CURVE', 'n': 'Yield curve', 'unit': 'pts', 'v': cur, 'date': dt.datetime.fromtimestamp(t10['t'], ETZ).date().isoformat(),
                         'prev': pts[-2][1] if len(pts) > 1 else None, 'pdate': pts[-2][0] if len(pts) > 1 else None, 'pts': [[d, v] for d, v in pts] + [[None, cur]],
                         'x': 'The 10-year Treasury yield minus the 2-year. Below zero has often come before a recession.', 'src': 'https://www.cnbc.com/quotes/US10Y'})
        except Exception as ex:  # noqa: BLE001
            errors.append(f'yield curve: {type(ex).__name__} {str(ex)[:50]}')
    econ.sort(key=lambda e: order.index(e['id']) if e['id'] in order else 99)
    names = {'CPI': 'inflation', 'CORE': 'core inflation', 'UNRATE': 'unemployment', 'PAYEMS': 'jobs added', 'CLAIMS': 'jobless claims',
             'GDP': 'GDP growth', 'FED': 'the Fed rate', 'MORT': 'mortgage rates', 'GAS': 'gas prices', 'SENT': 'consumer sentiment'}
    shown = {e['id'] for e in econ}
    missing = [names[k] for k in order if k in names and k not in shown]
    earn, events = [], []
    for d in days:
        try:
            earn.append(ejobs[d].result())
        except Exception as ex:  # noqa: BLE001
            errors.append(f'Nasdaq earnings {d}: {type(ex).__name__} {str(ex)[:60]}')
        try:
            events.append(vjobs[d].result())
        except Exception as ex:  # noqa: BLE001
            errors.append(f'Nasdaq economic calendar {d}: {type(ex).__name__} {str(ex)[:60]}')
    got = sum(len(b['rows']) for b in board)
    out = {'v': 2, 'id': wid, 'at': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'),
           'board': board if got else old.get('board', []), 'sectors': sectors or old.get('sectors', []),
           'stocks': stocks or old.get('stocks', []), 'econ': econ or old.get('econ', []),
           'earnings': earn if any(e['rows'] for e in earn) else old.get('earnings', []),
           'events': events if any(e['rows'] for e in events) else old.get('events', []), 'releases': rel, 'econMissing': missing,
           'stale': [k for k, v in (('board', got), ('sectors', sectors), ('stocks', stocks), ('econ', econ),
                                    ('earnings', any(e['rows'] for e in earn)), ('events', any(e['rows'] for e in events))) if not v],
           'errors': errors[:40],
           'sources': {'quotes': 'CNBC', 'economy': 'BLS, BEA and EIA via DBnomics; New York Fed; Freddie Mac; University of Michigan',
                       'calendars': 'Nasdaq'}}
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print(f"markets {wid}: board {got} quotes, {len(sectors)} sectors, {len(stocks)} stocks, {len(out['econ'])} economic series, "
          f"{sum(len(e['rows']) for e in earn)} earnings, {sum(len(e['rows']) for e in events)} events, {len(errors)} errors, "
          f"{os.path.getsize(OUT) // 1024} KB, {time.monotonic() - START:.0f} s")
    for e in errors[:15]:
        print('  ', e)
    return 0


if __name__ == '__main__':
    sys.exit(main())
