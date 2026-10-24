#!/usr/bin/env python3
"""The Watch's markets desk: a snapshot of the markets and the economy at each edition -> news/data/markets.json

  python3 news/updater/markets.py           build for the current watch, unless it is already built
  python3 news/updater/markets.py --force   build anyway (a manual run)

Quotes: Yahoo Finance's public chart data (no key), with Stooq's daily history when Yahoo does not answer.
Economy: FRED's public CSV downloads (St. Louis Fed, no key). Calendars: Nasdaq's public earnings and
economic-event calendars. Every number carries the time it is from; nothing is estimated or filled in.
A source that fails is left out and listed in 'errors', and the last good value of that block is kept.
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
# kind: how to show the number. idx = index points, pct = a yield in percent, usd = dollars, per = units of a currency
# per dollar, usdper = dollars per unit of a currency, brl = reais (the Bovespa is in points; stocks are in dollars)
BOARD = [
    ('us', 'U.S. stocks', [
        ('^GSPC', 'S&P 500', 'idx', '500 of the biggest U.S. companies; the benchmark most funds track.'),
        ('^DJI', 'Dow', 'idx', '30 blue-chip U.S. companies, weighted by share price.'),
        ('^IXIC', 'Nasdaq', 'idx', 'Every stock listed on the Nasdaq; heavy on technology.'),
        ('^RUT', 'Russell 2000', 'idx', '2,000 smaller U.S. companies; a read on the domestic economy.'),
        ('^VIX', 'VIX', 'idx', 'The fear gauge: how much the S&P 500 is expected to swing over the next month. Above 20 is jumpy; above 30 is fear.'),
    ]),
    ('futures', 'Futures', [
        ('ES=F', 'S&P 500 futures', 'idx', 'Contracts on where the S&P 500 will be. They trade nearly around the clock, so they show the mood before the open.'),
        ('NQ=F', 'Nasdaq 100 futures', 'idx', 'Contracts on the 100 biggest Nasdaq stocks; trade nearly around the clock.'),
        ('YM=F', 'Dow futures', 'idx', 'Contracts on the Dow; trade nearly around the clock.'),
    ]),
    ('world', 'World', [
        ('^STOXX50E', 'Euro Stoxx 50', 'idx', 'The 50 biggest companies in the euro zone.'),
        ('^FTSE', 'FTSE 100', 'idx', 'The 100 biggest companies listed in London.'),
        ('^GDAXI', 'DAX', 'idx', 'Germany’s 40 biggest listed companies.'),
        ('^FCHI', 'CAC 40', 'idx', 'France’s 40 biggest listed companies.'),
        ('^N225', 'Nikkei 225', 'idx', 'Japan’s benchmark, 225 Tokyo stocks.'),
        ('^HSI', 'Hang Seng', 'idx', 'Hong Kong’s benchmark, heavy on Chinese companies.'),
        ('000001.SS', 'Shanghai', 'idx', 'Every stock on the Shanghai exchange.'),
        ('^BVSP', 'Bovespa', 'idx', 'Brazil’s main stock index, in reais.'),
    ]),
    ('rates', 'Treasury yields', [
        ('^IRX', '3-month', 'pct', 'Tracks where traders expect the Fed’s rate to be over the next few months.'),
        ('^FVX', '5-year', 'pct', 'A guide for car loans and medium-term borrowing.'),
        ('^TNX', '10-year', 'pct', 'Sets the tone for mortgages and business borrowing. When yields rise, bond prices fall.'),
        ('^TYX', '30-year', 'pct', 'The long end: what investors demand to lend to the government for a generation.'),
    ]),
    ('fx', 'Currencies', [
        ('DX-Y.NYB', 'Dollar index', 'idx', 'The dollar against six major currencies, mostly the euro. Up means a stronger dollar.'),
        ('EURUSD=X', 'Euro', 'usdper', 'Dollars per euro.'),
        ('GBPUSD=X', 'Pound', 'usdper', 'Dollars per British pound.'),
        ('JPY=X', 'Yen', 'per', 'Yen per dollar. A higher number means a stronger dollar.'),
        ('CNY=X', 'Yuan', 'per', 'Chinese yuan per dollar.'),
        ('BRL=X', 'Real', 'per', 'Brazilian reais per dollar. A higher number means a weaker real.'),
        ('MXN=X', 'Peso', 'per', 'Mexican pesos per dollar.'),
    ]),
    ('cmdty', 'Commodities', [
        ('CL=F', 'Oil (WTI)', 'usd', 'U.S. crude, dollars a barrel. Gasoline prices follow it within a few weeks.'),
        ('BZ=F', 'Oil (Brent)', 'usd', 'The global oil benchmark, dollars a barrel.'),
        ('NG=F', 'Natural gas', 'usd', 'Dollars per million BTU; drives heating and power bills.'),
        ('GC=F', 'Gold', 'usd', 'Dollars an ounce. Investors buy it when they are nervous.'),
        ('SI=F', 'Silver', 'usd', 'Dollars an ounce; part haven, part industrial metal.'),
        ('HG=F', 'Copper', 'usd', 'Dollars a pound. “Dr. Copper” for what it says about factories and building.'),
        ('ZC=F', 'Corn', 'usd', 'Cents a bushel; feed, food and ethanol.'),
    ]),
    ('crypto', 'Crypto', [
        ('BTC-USD', 'Bitcoin', 'usd', 'The largest cryptocurrency. It trades around the clock.'),
        ('ETH-USD', 'Ether', 'usd', 'The currency of the Ethereum network; trades around the clock.'),
        ('SOL-USD', 'Solana', 'usd', 'A fast-growing blockchain’s coin; trades around the clock.'),
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
STOOQ = {'^GSPC': '^spx', '^DJI': '^dji', '^IXIC': '^ndq', '^FTSE': '^ukx', '^GDAXI': '^dax', '^FCHI': '^cac', '^N225': '^nkx',
         '^HSI': '^hsi', '^BVSP': '^bvp', 'EURUSD=X': 'eurusd', 'GBPUSD=X': 'gbpusd', 'JPY=X': 'usdjpy', 'CNY=X': 'usdcny',
         'BRL=X': 'usdbrl', 'MXN=X': 'usdmxn', 'CL=F': 'cl.f', 'BZ=F': 'cb.f', 'NG=F': 'ng.f', 'GC=F': 'gc.f', 'SI=F': 'si.f',
         'HG=F': 'hg.f', 'BTC-USD': 'btcusd', 'ETH-USD': 'ethusd', '^TNX': '10usy.b', '^FVX': '5usy.b', '^TYX': '30usy.b'}

FRED = [  # id, name, how to read it, unit, what it means
    ('CPIAUCSL', 'Inflation', 'yoy', '%', 'Consumer prices compared with a year earlier.'),
    ('CPILFESL', 'Core inflation', 'yoy', '%', 'Prices without food and energy, compared with a year earlier. The Fed watches this one.'),
    ('UNRATE', 'Unemployment', 'level', '%', 'Share of people looking for work who can’t find it.'),
    ('PAYEMS', 'Jobs added', 'diff', 'k', 'New payroll jobs in the month, in thousands.'),
    ('ICSA', 'Jobless claims', 'level', 'k', 'New claims for unemployment benefits in a week, in thousands. They rise early in a downturn.'),
    ('DFEDTARU', 'Fed rate', 'level', '%', 'The top of the Federal Reserve’s target range for its benchmark rate.'),
    ('MORTGAGE30US', '30-year mortgage', 'level', '%', 'The average 30-year fixed rate, from Freddie Mac’s weekly survey.'),
    ('T10Y2Y', 'Yield curve', 'level', 'pts', 'The 10-year yield minus the 2-year. Below zero has often come before a recession.'),
    ('A191RL1Q225SBEA', 'GDP growth', 'level', '%', 'How fast the economy grew in the quarter, at an annual rate, after inflation.'),
    ('UMCSENT', 'Consumer sentiment', 'level', '', 'The University of Michigan’s survey of how people feel about the economy.'),
    ('RSAFS', 'Retail sales', 'mom', '%', 'Change in sales at stores, restaurants and online from the month before.'),
    ('GASREGW', 'Gas price', 'level', '$', 'The average price of a gallon of regular gasoline in the U.S.'),
]

errors = []
START = time.monotonic()
BUDGET = 170  # seconds: the workflow gives this step four minutes, and the edition must still be committed
YAHOO = {'throttled': 0}


def late():
    return time.monotonic() - START > BUDGET


def get(url, accept='*/*', headers=None, timeout=12):
    h = {'User-Agent': UA, 'Accept': accept, 'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip'}
    h.update(headers or {})
    last = None
    if late():
        raise TimeoutError('out of time for this run')
    for attempt in range(2):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout) as r:
                raw = r.read()
                if (r.headers.get('Content-Encoding') or '').lower() == 'gzip' or raw[:2] == b'\x1f\x8b':
                    raw = gzip.decompress(raw)
                return raw
        except urllib.error.HTTPError as ex:
            last = ex
            if ex.code == 429 and 'yahoo.com' in url:
                YAHOO['throttled'] += 1
                raise
            if ex.code in (500, 502, 503, 504) and attempt < 1:
                time.sleep(2); continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as ex:
            last = ex
            if attempt < 1 and not late():
                time.sleep(1.5); continue
            raise
    raise last


def r4(x):
    """four significant figures for charts, full precision kept for the quote itself"""
    if x is None:
        return None
    a = abs(x)
    d = 2 if a >= 100 else 3 if a >= 10 else 4 if a >= 1 else 6
    return round(x, d)


def thin(xs, n):
    if len(xs) <= n:
        return xs
    step = (len(xs) - 1) / (n - 1)
    return [xs[round(i * step)] for i in range(n)]


def yahoo(sym, rng, interval):
    if YAHOO['throttled'] >= 6:  # Yahoo is turning this runner away: stop asking, use the fallback
        raise RuntimeError('Yahoo is rate-limiting this run')
    q = urllib.parse.quote(sym, safe='')
    last = None
    for host in ('query1', 'query2'):
        try:
            j = json.loads(get(f'https://{host}.finance.yahoo.com/v8/finance/chart/{q}?range={rng}&interval={interval}&includePrePost=false',
                               accept='application/json'))
            res = (j.get('chart') or {}).get('result') or []
            if not res:
                raise ValueError(((j.get('chart') or {}).get('error') or {}).get('description') or 'no result')
            r = res[0]
            ts = r.get('timestamp') or []
            closes = (((r.get('indicators') or {}).get('quote') or [{}])[0].get('close')) or []
            pts = [(t, c) for t, c in zip(ts, closes) if c is not None]
            return r.get('meta') or {}, pts
        except Exception as ex:  # noqa: BLE001
            last = ex
    raise last


def stooq_daily(sym):
    s = STOOQ.get(sym)
    if not s:
        raise ValueError('no Stooq symbol')
    d1 = (NOW - dt.timedelta(days=380)).strftime('%Y%m%d'); d2 = NOW.strftime('%Y%m%d')
    raw = get(f'https://stooq.com/q/d/l/?s={urllib.parse.quote(s)}&d1={d1}&d2={d2}&i=d', accept='text/csv').decode('utf-8', 'replace')
    rows = [r for r in csv.DictReader(io.StringIO(raw)) if r.get('Close') not in (None, '', 'null')]
    if len(rows) < 3:
        raise ValueError('Stooq returned no history')
    pts = []
    for r in rows:
        t = int(dt.datetime.strptime(r['Date'], '%Y-%m-%d').replace(hour=21, tzinfo=dt.timezone.utc).timestamp())
        pts.append((t, float(r['Close'])))
    return pts


def changes(daily, price):
    """1W / 1M / 3M / YTD / 1Y from daily closes; None where the history is too short"""
    if not daily or price is None:
        return {}
    closes = [c for _, c in daily]
    def back(n):
        return closes[-1 - n] if len(closes) > n else None
    out = {}
    for k, n in (('w', 5), ('m', 21), ('q', 63), ('y', 251)):
        b = back(n)
        if b:
            out[k] = round((price / b - 1) * 100, 2)
    year = dt.datetime.fromtimestamp(daily[-1][0], ETZ).year
    prior = [c for t, c in daily if dt.datetime.fromtimestamp(t, ETZ).year < year]
    if prior:
        out['ytd'] = round((price / prior[-1] - 1) * 100, 2)
    return out


def quote_board(sym, name, kind, explain):
    """an instrument on the board: price, change, intraday line and a year of daily closes"""
    rec = {'s': sym, 'n': name, 'kind': kind, 'x': explain}
    try:
        meta, intra = yahoo(sym, '1d', '5m')
        price = meta.get('regularMarketPrice')
        prev = meta.get('previousClose') or meta.get('chartPreviousClose')
        try:
            _m, daily = yahoo(sym, '1y', '1d')
        except Exception as ex:  # noqa: BLE001
            daily = []; errors.append(f'{sym} history: {type(ex).__name__}')
        rec.update({'p': price, 'pc': prev, 'hi': meta.get('regularMarketDayHigh'), 'lo': meta.get('regularMarketDayLow'),
                    'h52': meta.get('fiftyTwoWeekHigh'), 'l52': meta.get('fiftyTwoWeekLow'), 'v': meta.get('regularMarketVolume'),
                    't': meta.get('regularMarketTime'), 'cur': meta.get('currency'), 'src': 'Yahoo Finance',
                    'i': [r4(c) for _, c in thin(intra, 80)], 'it': [intra[0][0], intra[-1][0]] if intra else None})
        if daily:
            rec['d'] = [r4(c) for _, c in thin(daily, 130)]; rec['dt'] = [daily[0][0], daily[-1][0]]
            rec['ch'] = changes(daily, price)
    except Exception as ex:  # noqa: BLE001
        try:
            daily = stooq_daily(sym)
            price, prev = daily[-1][1], daily[-2][1]
            rec.update({'p': price, 'pc': prev, 't': daily[-1][0], 'src': 'Stooq (daily close)',
                        'd': [r4(c) for _, c in thin(daily, 130)], 'dt': [daily[0][0], daily[-1][0]], 'ch': changes(daily, price),
                        'h52': max(c for _, c in daily[-252:]), 'l52': min(c for _, c in daily[-252:])})
        except Exception as ex2:  # noqa: BLE001
            errors.append(f'{sym}: Yahoo {type(ex).__name__} {str(ex)[:60]}; Stooq {type(ex2).__name__} {str(ex2)[:40]}')
            return None
    if rec.get('p') is not None and rec.get('pc'):
        rec['c'] = rec['p'] - rec['pc']; rec['cp'] = round(rec['c'] / rec['pc'] * 100, 3)
    return rec


def quote_stock(sym, name):
    """a company: price, day change and how it has done over the week, month and year (one request)"""
    try:
        meta, daily = yahoo(sym, '1y', '1d')
    except Exception as ex:  # noqa: BLE001
        errors.append(f'{sym}: {type(ex).__name__} {str(ex)[:60]}')
        return None
    price = meta.get('regularMarketPrice')
    if price is None or len(daily) < 2:
        return None
    t = meta.get('regularMarketTime') or daily[-1][0]
    same_day = dt.datetime.fromtimestamp(daily[-1][0], ETZ).date() == dt.datetime.fromtimestamp(t, ETZ).date()
    prev = daily[-2][1] if same_day else daily[-1][1]
    rec = {'s': sym, 'n': name, 'p': price, 'pc': prev, 'c': price - prev, 'cp': round((price / prev - 1) * 100, 3),
           'v': meta.get('regularMarketVolume'), 'h52': meta.get('fiftyTwoWeekHigh'), 'l52': meta.get('fiftyTwoWeekLow'), 't': t,
           'hi': meta.get('regularMarketDayHigh'), 'lo': meta.get('regularMarketDayLow'), 'ch': changes(daily, price),
           'q': [r4(c) for _, c in thin(daily[-63:], 40)], 'd': [r4(c) for _, c in thin(daily, 130)], 'dt': [daily[0][0], daily[-1][0]],
           'src': 'Yahoo Finance'}
    return rec


def fred(series):
    sid, name, how, unit, explain = series
    start = (NOW - dt.timedelta(days=365 * 3 + 40)).strftime('%Y-%m-%d')
    raw = get(f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}&cosd={start}', accept='text/csv').decode('utf-8', 'replace')
    rows = list(csv.reader(io.StringIO(raw)))
    pts = []
    for r in rows[1:]:
        if len(r) >= 2 and r[1] not in ('.', ''):
            try:
                pts.append((r[0], float(r[1])))
            except ValueError:
                pass
    if len(pts) < 3:
        raise ValueError('no data')
    if how == 'yoy':  # monthly index -> change from a year earlier
        by = dict(pts)
        out = []
        for d, v in pts:
            y, m, day = d.split('-')
            a = by.get(f'{int(y) - 1}-{m}-{day}')
            if a:
                out.append((d, round((v / a - 1) * 100, 2)))
        pts = out
    elif how == 'diff':
        pts = [(pts[i][0], round(pts[i][1] - pts[i - 1][1], 1)) for i in range(1, len(pts))]
    elif how == 'mom':
        pts = [(pts[i][0], round((pts[i][1] / pts[i - 1][1] - 1) * 100, 2)) for i in range(1, len(pts))]
    if sid == 'ICSA':
        pts = [(d, round(v / 1000, 1)) for d, v in pts]
    if sid in ('DFEDTARU', 'T10Y2Y'):  # daily -> the last reading of each week, so the chart is readable
        wk = {}
        for d, v in pts:
            wk[dt.date.fromisoformat(d).isocalendar()[:2]] = (d, v)
        pts = sorted(wk.values())
    pts = pts[-60:]
    last, prev = pts[-1], pts[-2] if len(pts) > 1 else None
    return {'id': sid, 'n': name, 'unit': unit, 'x': explain, 'v': last[1], 'date': last[0], 'prev': prev[1] if prev else None,
            'pdate': prev[0] if prev else None, 'pts': [[d, v] for d, v in pts], 'src': f'https://fred.stlouisfed.org/series/{sid}'}


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
    return {'date': day.isoformat(), 'n': len(rows), 'rows': out[:12]}


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
    jobs = {}
    with cf.ThreadPoolExecutor(max_workers=6) as pool:
        for g, _label, items in BOARD:
            for sym, name, kind, x in items:
                jobs[('b', g, sym)] = pool.submit(quote_board, sym, name, kind, x)
        for sym, name in SECTORS:
            jobs[('sec', None, sym)] = pool.submit(quote_board, sym, name, 'usd', '')
        for sym, name in STOCKS:
            jobs[('st', None, sym)] = pool.submit(quote_stock, sym, name)
        fjobs = {s[0]: pool.submit(fred, s) for s in FRED}
        days = week_days()
        ejobs = {d: pool.submit(earnings, d) for d in days}
        vjobs = {d: pool.submit(econ_events, d) for d in days}
    board = []
    for g, label, items in BOARD:
        rows = [jobs[('b', g, s)].result() for s, *_ in items]
        rows = [r for r in rows if r]
        if rows:
            board.append({'g': g, 'label': label, 'rows': rows})
    sectors = [r for r in (jobs[('sec', None, s)].result() for s, _ in SECTORS) if r]
    stocks = [r for r in (jobs[('st', None, s)].result() for s, _ in STOCKS) if r]
    econ = []
    for s in FRED:
        try:
            econ.append(fjobs[s[0]].result())
        except Exception as ex:  # noqa: BLE001
            errors.append(f'FRED {s[0]}: {type(ex).__name__} {str(ex)[:60]}')
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
    # a block that failed entirely keeps its last good version, marked with its own time
    got = sum(len(b['rows']) for b in board)
    out = {'v': 1, 'id': wid, 'at': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'),
           'board': board if got else old.get('board', []), 'sectors': sectors or old.get('sectors', []),
           'stocks': stocks or old.get('stocks', []), 'econ': econ or old.get('econ', []),
           'earnings': earn if any(e['rows'] for e in earn) else old.get('earnings', []),
           'events': events if any(e['rows'] for e in events) else old.get('events', []),
           'stale': [k for k, v in (('board', got), ('sectors', sectors), ('stocks', stocks), ('econ', econ),
                                    ('earnings', any(e['rows'] for e in earn)), ('events', any(e['rows'] for e in events))) if not v],
           'errors': errors[:60],
           'sources': {'quotes': 'Yahoo Finance chart data (Stooq daily closes as a fallback)', 'economy': 'FRED, Federal Reserve Bank of St. Louis',
                       'calendars': 'Nasdaq earnings and economic calendars'}}
    if not got and not old:
        print('markets: nothing could be read', file=sys.stderr)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print(f"markets {wid}: board {got} quotes, {len(sectors)} sectors, {len(stocks)} stocks, {len(econ)} economic series, "
          f"{sum(len(e['rows']) for e in earn)} earnings, {sum(len(e['rows']) for e in events)} events, {len(errors)} errors, "
          f"{os.path.getsize(OUT) // 1024} KB")
    for e in errors[:15]:
        print('  ', e)
    return 0


if __name__ == '__main__':
    sys.exit(main())
