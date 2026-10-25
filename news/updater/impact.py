#!/usr/bin/env python3
"""The Watch's impact maps: for each economic release and each big earnings report on the week's calendar, what it
usually moves, through which channel, in which direction, and how big a move the options market is pricing.

  python3 news/updater/impact.py            rebuild news/data/impact.json (option prices at most every 5 hours)
  python3 news/updater/impact.py --force    fetch option prices now

Reads news/data/markets.json (the week's calendars and the market board) and news/data/peers.json (which companies
move together), and Cboe's delayed option quotes (cdn.cboe.com, 15 minutes late during trading, the last close
outside it). For each instrument it reads the at-the-money straddle, the price of a call plus a put at the strike
nearest the price, on the first expiry after the event: what traders pay for a move of that size either way. Cboe's
30-day implied volatility gives a normal stretch of the same length to compare it with.

The directions are the usual first reactions when a number comes in above or below forecast, as market
commentators and the Fed's own research describe them; they are not forecasts, and markets often do something else.
The options give the size of the move priced, never its direction. Standard library only.
"""
import concurrent.futures as cf
import datetime as dt
import gzip
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', 'data'))
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
NQ = {'Origin': 'https://www.nasdaq.com', 'Referer': 'https://www.nasdaq.com/', 'Accept': 'application/json'}
START = time.monotonic()
BUDGET = 170
errors = []

# ------------------------------------------------------------------ instruments
# id: (name, the optionable ticker for implied moves or None, the board symbol in markets.json or None)
INST = {
    'FEDCUT': ('Odds of a Fed rate cut', None, None),
    'US2Y': ('2-year Treasury yield', None, 'US2Y'),
    'US10Y': ('10-year Treasury yield', None, '^TNX'),
    'TLT': ('Long Treasury bonds (TLT)', 'TLT', None),
    'DXY': ('U.S. dollar index', 'UUP', 'DX-Y.NYB'),
    'USDJPY': ('Dollar against the yen', None, 'JPY=X'),
    'SPY': ('S&P 500 (SPY)', 'SPY', '^GSPC'),
    'QQQ': ('Nasdaq 100 (QQQ)', 'QQQ', '^IXIC'),
    'IWM': ('Small companies (IWM)', 'IWM', '^RUT'),
    'XLK': ('Tech stocks (XLK)', 'XLK', None), 'XLC': ('Communication stocks (XLC)', 'XLC', None),
    'XLF': ('Financial stocks (XLF)', 'XLF', None), 'XLI': ('Industrial stocks (XLI)', 'XLI', None),
    'XLY': ('Consumer discretionary (XLY)', 'XLY', None), 'XLP': ('Consumer staples (XLP)', 'XLP', None),
    'XLU': ('Utilities (XLU)', 'XLU', None), 'XLRE': ('Real estate (XLRE)', 'XLRE', None),
    'XLE': ('Energy stocks (XLE)', 'XLE', None), 'XLB': ('Materials (XLB)', 'XLB', None), 'XLV': ('Health care (XLV)', 'XLV', None),
    'XHB': ('Homebuilders (XHB)', 'XHB', None), 'XRT': ('Retailers (XRT)', 'XRT', None), 'KRE': ('Regional banks (KRE)', 'KRE', None),
    'JETS': ('Airlines (JETS)', 'JETS', None), 'EUFN': ('European banks (EUFN)', 'EUFN', None), 'EWZ': ('Brazilian stocks (EWZ)', 'EWZ', '^BVSP'),
    'GLD': ('Gold (GLD)', 'GLD', 'GC=F'), 'USO': ('Oil (USO)', 'USO', 'CL=F'), 'UNG': ('Natural gas (UNG)', 'UNG', 'NG=F'),
    'COPPER': ('Copper', None, 'HG=F'), 'BTC': ('Bitcoin', 'IBIT', 'BTC-USD'), 'HYG': ('Junk bonds (HYG)', 'HYG', None),
}

SHORT = {'FEDCUT': 'Fed cut odds', 'US2Y': '2-year yield', 'US10Y': '10-year yield', 'TLT': 'Long bonds', 'DXY': 'Dollar', 'USDJPY': 'Dollar/yen',
         'SPY': 'S&P 500', 'QQQ': 'Nasdaq 100', 'IWM': 'Small caps', 'XLK': 'Tech', 'XLC': 'Communications', 'XLF': 'Financials', 'XLI': 'Industrials',
         'XLY': 'Discretionary', 'XLP': 'Staples', 'XLU': 'Utilities', 'XLRE': 'Real estate', 'XLE': 'Energy', 'XLB': 'Materials', 'XLV': 'Health care',
         'XHB': 'Homebuilders', 'XRT': 'Retailers', 'KRE': 'Regional banks', 'JETS': 'Airlines', 'EUFN': 'Euro banks', 'EWZ': 'Brazil stocks',
         'GLD': 'Gold', 'USO': 'Oil', 'UNG': 'Natural gas', 'COPPER': 'Copper', 'BTC': 'Bitcoin', 'HYG': 'Junk bonds'}

# ------------------------------------------------------------------ channels and what each kind of report does
CH = {
    'fed': 'Fed rate expectations', 'rates': 'Bond yields', 'dollar': 'The dollar', 'stocks': 'Stock valuations',
    'ratesens': 'Rate-sensitive stocks', 'gold': 'Gold and real yields', 'growth': 'Growth outlook', 'cyclicals': 'Cyclical stocks',
    'commod': 'Commodities', 'defensive': 'Defensive stocks', 'spend': 'Consumer spending', 'housing': 'Housing',
    'supply': 'Oil supply', 'travel': 'Fuel costs', 'demand': 'Treasury demand', 'risk': 'Risk appetite', 'gas': 'Gas supply',
    'self': 'The stock itself', 'peers': 'Peers, in sympathy', 'sector': 'Its sector fund', 'sup': 'Suppliers', 'cust': 'Customers', 'index': 'The indexes',
}
# category: (what "above forecast" means, what "below" means, flows [(channel, instrument, weight 1-3, direction when above)],
#            {channel: (why, when above; why, when below)})
CATS = {
    'inflation': ('Hotter inflation than forecast', 'Cooler inflation than forecast', [
        ('fed', 'FEDCUT', 3, -1), ('fed', 'US2Y', 3, 1), ('rates', 'US10Y', 2, 1), ('rates', 'TLT', 2, -1),
        ('dollar', 'DXY', 2, 1), ('stocks', 'SPY', 2, -1), ('stocks', 'QQQ', 2, -1), ('ratesens', 'IWM', 2, -1),
        ('ratesens', 'XLRE', 1, -1), ('ratesens', 'XHB', 1, -1), ('gold', 'GLD', 1, -1)], {
        'fed': ('Hotter prices make a Fed cut less likely soon; the two-year yield, which tracks the Fed, usually rises first.',
                'Cooler prices make a Fed cut more likely; the two-year yield usually falls first.'),
        'rates': ('Longer yields follow, and bond prices fall.', 'Longer yields ease, and bond prices rise.'),
        'dollar': ('Higher U.S. rates make the dollar more attractive.', 'Lower expected rates weigh on the dollar.'),
        'stocks': ('Higher rates make future profits worth less today, which hits fast-growing tech hardest.', 'Lower rates lift what future profits are worth, tech most of all.'),
        'ratesens': ('Small companies, landlords and homebuilders borrow more and feel higher rates first.', 'Borrowers get relief: small caps, real estate and homebuilders.'),
        'gold': ('Gold pays no interest, so higher real yields usually weigh on it.', 'Lower real yields usually help gold.')}),
    'jobs': ('A stronger job market than forecast', 'A weaker job market than forecast', [
        ('fed', 'FEDCUT', 3, -1), ('fed', 'US2Y', 3, 1), ('rates', 'US10Y', 2, 1), ('rates', 'TLT', 1, -1), ('dollar', 'DXY', 2, 1),
        ('stocks', 'SPY', 1, 0), ('cyclicals', 'XLF', 1, 1), ('cyclicals', 'XLY', 1, 1), ('ratesens', 'IWM', 1, 0), ('gold', 'GLD', 1, -1)], {
        'fed': ('A strong labor market gives the Fed room to wait; rate-cut odds fall.', 'A weakening labor market pushes the Fed toward cutting.'),
        'rates': ('Yields rise with the growth outlook.', 'Yields fall as traders price in cuts.'),
        'dollar': ('Firmer U.S. growth and rates lift the dollar.', 'The dollar usually slips.'),
        'stocks': ('Mixed: more jobs means more spending, but also fewer cuts. "Good news is bad news" when inflation is the worry.', 'Mixed: cuts help, but a slowing economy hurts profits.'),
        'cyclicals': ('Banks and retailers do better when people are working and spending.', 'Banks and retailers feel a weaker consumer first.'),
        'ratesens': ('Small companies gain from growth but lose from higher rates.', 'Small companies gain from cuts but lose from slower growth.'),
        'gold': ('Higher yields usually weigh on gold.', 'Expected cuts usually help gold.')}),
    'growth': ('Stronger growth than forecast', 'Weaker growth than forecast', [
        ('growth', 'SPY', 2, 1), ('growth', 'IWM', 2, 1), ('cyclicals', 'XLI', 1, 1), ('cyclicals', 'XLF', 1, 1),
        ('rates', 'US10Y', 2, 1), ('rates', 'TLT', 1, -1), ('dollar', 'DXY', 1, 1), ('commod', 'USO', 1, 1), ('commod', 'COPPER', 1, 1),
        ('defensive', 'XLU', 1, -1)], {
        'growth': ('A stronger economy means more profits ahead.', 'A slower economy means smaller profits ahead.'),
        'cyclicals': ('Factories, freight and lenders do best when growth picks up.', 'Industrial and financial stocks take the first hit from a slowdown.'),
        'rates': ('Yields rise with growth.', 'Yields fall as investors buy safe bonds.'),
        'dollar': ('Faster growth supports the dollar.', 'Slower growth weighs on the dollar.'),
        'commod': ('More activity means more demand for oil and copper.', 'Less activity means less demand for oil and copper.'),
        'defensive': ('Investors trade the safe, steady payers for growth.', 'Investors shelter in utilities and other steady payers.')}),
    'spend': ('Stronger consumer spending or mood than forecast', 'Weaker consumer spending or mood than forecast', [
        ('spend', 'XLY', 3, 1), ('spend', 'XRT', 2, 1), ('growth', 'SPY', 1, 1), ('rates', 'US2Y', 1, 1), ('rates', 'US10Y', 1, 1), ('dollar', 'DXY', 1, 1)], {
        'spend': ('Retailers, restaurants and carmakers sell more when consumers spend.', 'Retailers and restaurants feel a pullback first.'),
        'growth': ('Consumers are about two-thirds of the economy.', 'Consumers are about two-thirds of the economy.'),
        'rates': ('Solid spending keeps rates higher for longer.', 'Softer spending makes cuts more likely.'),
        'dollar': ('A firmer economy supports the dollar.', 'A softer economy weighs on the dollar.')}),
    'housing': ('A stronger housing market than forecast', 'A weaker housing market than forecast', [
        ('housing', 'XHB', 3, 1), ('housing', 'HD', 1, 1), ('commod', 'XLB', 1, 1), ('rates', 'US10Y', 1, 1)], {
        'housing': ('More building and buying helps homebuilders and home-improvement stores.', 'Fewer starts and sales hit homebuilders and suppliers.'),
        'commod': ('Building uses lumber, steel and cement.', 'Less building means less demand for materials.'),
        'rates': ('Housing strength nudges yields up a little.', 'Housing weakness nudges yields down a little.')}),
    'oil': ('Bigger oil stockpiles than forecast', 'Smaller oil stockpiles than forecast', [
        ('supply', 'USO', 3, -1), ('supply', 'XLE', 2, -1), ('travel', 'JETS', 1, 1), ('rates', 'US10Y', 1, -1)], {
        'supply': ('More oil in storage means more supply than demand: crude and energy stocks usually fall.', 'A bigger draw means tighter supply: crude and energy stocks usually rise.'),
        'travel': ('Cheaper fuel helps airlines.', 'Pricier fuel squeezes airlines.'),
        'rates': ('Cheaper oil eases inflation worries a little.', 'Pricier oil adds to inflation worries a little.')}),
    'natgas': ('A bigger gas storage build than forecast', 'A smaller gas storage build than forecast', [
        ('gas', 'UNG', 3, -1), ('gas', 'XLE', 1, -1), ('gas', 'XLU', 1, 1)], {
        'gas': ('More gas in storage means lower prices; utilities that burn it gain.', 'Less gas in storage means higher prices; utilities that burn it pay more.')}),
    'auction': ('Weak demand at the auction (a higher yield than expected)', 'Strong demand at the auction (a lower yield than expected)', [
        ('demand', 'US10Y', 3, 1), ('demand', 'US2Y', 2, 1), ('demand', 'TLT', 2, -1), ('stocks', 'SPY', 1, -1), ('stocks', 'QQQ', 1, -1)], {
        'demand': ('When buyers want a higher yield to take the government’s debt, yields across the curve rise.', 'Strong demand pulls yields down.'),
        'stocks': ('Higher yields weigh on stocks.', 'Lower yields help stocks.')}),
    'fed': ('A more hawkish Fed than expected', 'A more dovish Fed than expected', [
        ('fed', 'FEDCUT', 3, -1), ('fed', 'US2Y', 3, 1), ('rates', 'US10Y', 2, 1), ('rates', 'TLT', 2, -1), ('dollar', 'DXY', 2, 1),
        ('stocks', 'SPY', 2, -1), ('stocks', 'QQQ', 2, -1), ('ratesens', 'IWM', 2, -1), ('gold', 'GLD', 1, -1), ('risk', 'BTC', 1, -1)], {
        'fed': ('Fewer or later cuts: the two-year yield jumps.', 'More or sooner cuts: the two-year yield drops.'),
        'rates': ('Longer yields rise and bond prices fall.', 'Longer yields fall and bond prices rise.'),
        'dollar': ('Higher rates lift the dollar.', 'Lower rates weigh on the dollar.'),
        'stocks': ('Higher rates weigh on stocks, growth stocks most.', 'Lower rates lift stocks, growth stocks most.'),
        'ratesens': ('Small companies carry more floating-rate debt.', 'Small companies get the most relief.'),
        'gold': ('Higher real yields weigh on gold.', 'Lower real yields help gold.'),
        'risk': ('Tighter money cools speculative assets.', 'Easier money warms speculative assets.')}),
}
# Nasdaq calendar names -> (family key, plain title, category, polarity: -1 when a higher number means weaker)
FAMILIES = [
    (r'PCE', 'pce', 'PCE inflation (the Fed’s preferred gauge)', 'inflation', 1),
    (r'\bCPI\b|Consumer Price', 'cpi', 'Consumer prices (CPI)', 'inflation', 1),
    (r'\bPPI\b|Producer Price', 'ppi', 'Producer prices (PPI)', 'inflation', 1),
    (r'Employment Cost|Average Hourly Earnings', 'wages', 'Wages', 'inflation', 1),
    (r'Nonfarm|Payrolls|Unemployment Rate', 'jobs', 'The jobs report', 'jobs', 1),
    (r'Jobless Claims|Continuing', 'claims', 'Jobless claims', 'jobs', -1),
    (r'\bADP\b', 'adp', 'ADP private payrolls', 'jobs', 1),
    (r'JOLTS|Job Openings', 'jolts', 'Job openings (JOLTS)', 'jobs', 1),
    (r'GDPNow', 'gdpnow', 'Atlanta Fed GDPNow estimate', 'growth', 1),
    (r'\bGDP\b', 'gdp', 'GDP (economic growth)', 'growth', 1),
    (r'Durable|Goods Orders|Factory Orders', 'durables', 'Durable goods orders', 'growth', 1),
    (r'\bISM\b|\bPMI\b|Chicago Fed|Empire State|Philadelphia Fed|Philly Fed|Dallas Fed|Richmond Fed|Kansas City Fed', 'surveys', 'Business surveys', 'growth', 1),
    (r'Industrial Production|Capacity Utilization', 'indpro', 'Industrial production', 'growth', 1),
    (r'Retail Sales', 'retail', 'Retail sales', 'spend', 1),
    (r'Redbook', 'redbook', 'Redbook store sales (weekly)', 'spend', 1),
    (r'Personal Income|Personal Spending|Consumer Spending|Personal Consumption', 'income', 'Income and spending', 'spend', 1),
    (r'Consumer Confidence|Michigan|Consumer Sentiment', 'sentiment', 'Consumer confidence', 'spend', 1),
    (r'Housing Starts|Building Permits|New Home Sales|Existing Home|Pending Home|House Price|HPI|Case-Shiller|S&P/CS', 'housing', 'Housing', 'housing', 1),
    (r'Crude Oil|Cushing|Distillate|Gasoline|Refinery', 'oil', 'Oil inventories (EIA)', 'oil', 1),
    (r'Natural Gas Storage', 'natgas', 'Natural gas storage', 'natgas', 1),
    (r'(Note|Bond|TIPS) Auction', 'auction', 'Treasury auction', 'auction', 1),
    (r'Fed Interest Rate|FOMC|Fed Chair|Powell|Interest Rate Decision', 'fed', 'The Federal Reserve', 'fed', 1),
]
SECTOR_ETF = {'Technology': 'XLK', 'Telecommunications': 'XLC', 'Finance': 'XLF', 'Health Care': 'XLV', 'Consumer Discretionary': 'XLY',
              'Consumer Staples': 'XLP', 'Industrials': 'XLI', 'Basic Materials': 'XLB', 'Utilities': 'XLU', 'Real Estate': 'XLRE', 'Energy': 'XLE'}


def late():
    return time.monotonic() - START > BUDGET


def get(url, headers=None, timeout=25):
    if late():
        raise TimeoutError('out of time for this run')
    h = {'User-Agent': UA, 'Accept-Encoding': 'gzip', 'Accept-Language': 'en-US,en;q=0.9', **(headers or {})}
    last = None
    for i in range(2):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout) as r:
                b = r.read()
                return gzip.decompress(b) if b[:2] == b'\x1f\x8b' else b
        except Exception as ex:  # noqa: BLE001
            last = ex
            if getattr(ex, 'code', 0) == 403 or late():
                break
            time.sleep(1.2)
    raise last


def load(name, default):
    try:
        return json.load(open(os.path.join(DATA, name), encoding='utf-8'))
    except (OSError, ValueError):
        return default


def now_iso():
    return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


# ------------------------------------------------------------------ the week's reports
def families(mk):
    out = {}
    for day in mk.get('events') or []:
        for r in day.get('rows') or []:
            if r.get('country') != 'U.S.' or 'Bill Auction' in r.get('ev', ''):
                continue
            for rx, key, title, cat, pol in FAMILIES:
                if re.search(rx, r.get('ev', ''), re.I):
                    fid = f"{day['date']}-{key}"
                    f = out.setdefault(fid, {'id': fid, 'kind': 'econ', 'date': day['date'], 'time': r.get('time') or '', 'title': title,
                                             'cat': cat, 'pol': pol, 'rows': []})
                    f['time'] = min(f['time'], r.get('time') or '99:99') if f['time'] else r.get('time', '')
                    f['rows'].append({'ev': r['ev'], 'cons': r.get('cons') or '', 'prev': r.get('prev') or '', 'act': r.get('act') or '', 'time': r.get('time') or ''})
                    break
    return list(out.values())


def earnings(mk, peers, profiles):
    rows = []
    for day in mk.get('earnings') or []:
        for r in day.get('rows') or []:
            rows.append(dict(r, date=day['date']))
    rows.sort(key=lambda r: -(r.get('cap') or 0))
    pick = [r for r in rows if (r.get('cap') or 0) >= 60e9][:36]
    out = []
    for r in pick:
        s = r['s']
        p = peers.get(s) or {}
        prof = profiles.get(s) or {}
        etf = p.get('etf') or SECTOR_ETF.get(prof.get('sector', ''), None)
        name = p.get('n') or r.get('n')
        when = (r.get('when') or '').lower()
        flows = [('self', s, 3, 1)]
        for q in (p.get('peers') or [])[:3]:
            flows.append(('peers', q, 1, 1))
        if etf:
            flows.append(('sector', etf, 2 if (r.get('cap') or 0) > 3e11 else 1, 1))
        for q in (p.get('sup') or [])[:3]:
            flows.append(('sup', q, 1, 1))
        for q in (p.get('cust') or [])[:2]:
            flows.append(('cust', q, 1, 0))
        if (r.get('cap') or 0) > 4e11:
            flows.append(('index', 'QQQ' if etf in ('XLK', 'XLC') or s in ('AMZN', 'TSLA') else 'SPY', 1, 1))
        ind = p.get('ind') or (prof.get('industry') or '').lower()
        why = {
            'self': (f'Results and the outlook beat what analysts expected; {name} usually jumps.', f'Results or the outlook disappoint; {name} usually falls.'),
            'peers': (f'Other {ind} companies often move with it, read as a sign for the whole business.' if ind else 'Similar companies often move with it.',
                      f'Other {ind} companies often slip with it.' if ind else 'Similar companies often slip with it.'),
            'sector': ('Its sector fund follows, more when it is a big part of the fund.', 'Its sector fund follows, more when it is a big part of the fund.'),
            'sup': ('Suppliers rise on the hint of more orders.', 'Suppliers fall on the hint of fewer orders.'),
            'cust': ('Customers react both ways: a strong supplier can mean better products, or higher prices.', 'Customers react both ways.'),
            'index': ('Big enough to move the index on its own.', 'Big enough to move the index on its own.'),
        }
        out.append({'id': f"{r['date']}-{slug(s)}", 'kind': 'earn', 'date': r['date'], 'when': when, 's': s, 'title': f'{name} earnings',
                    'n': name, 'ind': ind, 'cap': r.get('cap'), 'eps': r.get('eps') or '', 'q': r.get('q') or '', 'flows': flows, 'why': why})
    return out


def econ_report(f):
    hi, lo, flows, why = CATS[f['cat']]
    pol = f['pol']
    fl = [(c, i, w, d * pol) for c, i, w, d in flows]
    if f['cat'] == 'auction':  # the tenor decides which yield leads
        ev = ' '.join(r['ev'] for r in f['rows'])
        m = re.search(r'(\d+)-Year', ev)
        if m and int(m.group(1)) >= 10:
            fl = [('demand', 'US10Y', 3, 1), ('demand', 'TLT', 3, -1), ('demand', 'US2Y', 1, 1), ('stocks', 'SPY', 1, -1), ('stocks', 'QQQ', 1, -1)]
    above = hi if pol > 0 else {'jobs': 'More jobless claims than forecast (a weaker job market)'}.get(f['cat'], hi)
    below = lo if pol > 0 else {'jobs': 'Fewer jobless claims than forecast (a stronger job market)'}.get(f['cat'], lo)
    w = {k: (v if pol > 0 else (v[1], v[0])) for k, v in why.items()}
    return dict(f, above=above, below=below, flows=fl, why=w)


# ------------------------------------------------------------------ options
OPT = re.compile(r'^([A-Z.]+)(\d{6})([CP])(\d{8})$')


def chain(sym):
    j = json.loads(get(f'https://cdn.cboe.com/api/global/delayed_quotes/options/{urllib.parse.quote(sym)}.json', timeout=40))
    d = j.get('data') or {}
    S = d.get('current_price') or d.get('close')
    exps = {}
    for o in d.get('options') or []:
        m = OPT.match(o.get('option', ''))
        if not m or m.group(1) != sym.replace('.', ''):
            continue
        e = '20' + m.group(2)[:2] + '-' + m.group(2)[2:4] + '-' + m.group(2)[4:]
        k = int(m.group(4)) / 1000
        bid, ask, theo = o.get('bid') or 0, o.get('ask') or 0, o.get('theo') or 0
        mid = (bid + ask) / 2 if bid > 0 and ask > 0 and (ask - bid) <= max(0.25, 0.35 * (bid + ask) / 2) else theo
        exps.setdefault(e, {}).setdefault(k, {})[m.group(3)] = {'mid': mid, 'iv': o.get('iv'), 'oi': o.get('open_interest') or 0}
    return {'S': S, 'iv30': d.get('iv30'), 'cp': d.get('price_change_percent'), 'at': d.get('last_trade_time') or j.get('timestamp'), 'exps': exps}


def quote(sym):
    j = json.loads(get(f'https://cdn.cboe.com/api/global/delayed_quotes/quotes/{urllib.parse.quote(sym)}.json', timeout=20))
    d = j.get('data') or {}
    return {'S': d.get('current_price') or d.get('close'), 'iv30': d.get('iv30'), 'cp': d.get('price_change_percent'), 'at': d.get('last_trade_time')}


def weekdays_between(a, b):
    """trading days after a, up to and including b (weekends skipped; holidays ignored)"""
    n, d = 0, a
    while d < b:
        d += dt.timedelta(days=1)
        if d.weekday() < 5:
            n += 1
    return max(n, 1)


def implied(c, date, after_close):
    """the straddle on the first expiry that includes the event"""
    if not c or not c.get('S') or not c.get('exps'):
        return None
    D = dt.date.fromisoformat(date)
    exps = sorted(e for e in c['exps'] if (dt.date.fromisoformat(e) > D if after_close else dt.date.fromisoformat(e) >= D))
    if not exps:
        return None
    e = exps[0]
    E = dt.date.fromisoformat(e)
    if (E - D).days > 10:
        return None
    S = c['S']
    strikes = [k for k, v in c['exps'][e].items() if 'C' in v and 'P' in v and v['C']['mid'] > 0 and v['P']['mid'] > 0]
    if not strikes:
        return None
    k = min(strikes, key=lambda x: abs(x - S))
    if abs(k - S) / S > 0.05:
        return None
    st = c['exps'][e][k]['C']['mid'] + c['exps'][e][k]['P']['mid']
    asof = dt.date.fromisoformat(str(c.get('at') or '')[:10]) if c.get('at') else dt.date.today()
    n = weekdays_between(asof, E)
    normal = 0.8 * (c['iv30'] or 0) / math.sqrt(252) * math.sqrt(n) if c.get('iv30') else None
    return {'e': e, 'k': k, 'st': round(st, 2), 'pct': round(st / S * 100, 2), 'n': n, 'normal': round(normal, 2) if normal else None}


# ------------------------------------------------------------------ build
def main():
    force = '--force' in sys.argv
    mk = load('markets.json', {})
    peers = load('peers.json', {}).get('companies', {})
    profiles = load('profiles.json', {})
    old = load('impact.json', {})
    reps = [econ_report(f) for f in families(mk)]
    earn = earnings(mk, peers, profiles)
    # company profiles for reporters we don't know yet (sector, industry), cached for good
    unknown = [r['s'] for r in earn if r['s'] not in peers and r['s'] not in profiles][:20]
    for s in unknown:
        try:
            j = json.loads(get(f'https://api.nasdaq.com/api/company/{s}/company-profile', headers=NQ, timeout=15))
            d = j.get('data') or {}
            profiles[s] = {'sector': (d.get('Sector') or {}).get('value'), 'industry': (d.get('Industry') or {}).get('value'), 'name': (d.get('CompanyName') or {}).get('value')}
        except Exception as ex:  # noqa: BLE001
            errors.append(f'profile {s}: {ex}')
    if unknown:
        json.dump(profiles, open(os.path.join(DATA, 'profiles.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        earn = earnings(mk, peers, profiles)
    reps += earn
    # which instruments need what: a chain for the subjects of each event, a quote for everything else
    need_chain, need_quote = set(), set()
    for r in reps:
        for c, i, w, d in r['flows']:
            sym = INST[i][1] if i in INST else i
            if not sym:
                continue
            if r['kind'] == 'earn' and c == 'self' or r['kind'] == 'econ' and w >= 2 or i in ('SPY', 'QQQ', 'TLT', 'GLD', 'IWM'):
                need_chain.add(sym)
            else:
                need_quote.add(sym)
    need_quote -= need_chain
    fresh = old.get('optionsAt') and (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(old['optionsAt'].replace('Z', '+00:00'))).total_seconds() < 5 * 3600
    chains, quotes = {}, dict(old.get('quotes') or {})
    moves = dict(old.get('moves') or {})
    if force or not fresh or any(s not in quotes for s in need_chain | need_quote):
        def cjob(s):
            try:
                return s, chain(s), None
            except Exception as ex:  # noqa: BLE001
                return s, None, str(ex)[:120]

        def qjob(s):
            try:
                return s, quote(s), None
            except Exception as ex:  # noqa: BLE001
                return s, None, str(ex)[:120]
        with cf.ThreadPoolExecutor(8) as ex:
            for s, c, err in ex.map(cjob, sorted(need_chain)):
                if c:
                    chains[s] = c
                    quotes[s] = {k: c[k] for k in ('S', 'iv30', 'cp', 'at')}
                else:
                    errors.append(f'options {s}: {err}')
            for s, q, err in ex.map(qjob, sorted(need_quote)):
                if q:
                    quotes[s] = q
                else:
                    errors.append(f'quote {s}: {err}')
        moves = {}
        for r in reps:
            after = r['kind'] == 'earn' and 'after' in r.get('when', '')
            key = f"{r['date']}|{'post' if after else 'pre'}"
            for c, i, w, d in r['flows']:
                sym = INST[i][1] if i in INST else i
                if sym in chains:
                    m = implied(chains[sym], r['date'], after)
                    if m:
                        moves.setdefault(sym, {})[key] = m
        options_at = now_iso()
    else:
        options_at = old.get('optionsAt')
    # board prices for the instruments that have them
    board = {}
    for g in mk.get('board') or []:
        for row in g.get('rows') or []:
            board[row['s']] = {'p': row.get('p'), 'cp': row.get('cp'), 'c': row.get('c'), 'kind': row.get('kind')}
    for row in (mk.get('stocks') or []) + (mk.get('sectors') or []):
        board[row['s']] = {'p': row.get('p'), 'cp': row.get('cp'), 'kind': 'usd'}
    names = {s: v.get('n') for s, v in peers.items()}
    for s, v in profiles.items():
        names.setdefault(s, v.get('name'))
    inst = {}
    for r in reps:
        for c, i, w, d in r['flows']:
            if i in inst:
                continue
            if i in INST:
                n, sym, bsym = INST[i]
            else:
                n, sym, bsym = names.get(i) or i, i, i
            b = board.get(bsym) or {}
            q = quotes.get(sym) or {}
            inst[i] = {'n': n, 'sn': SHORT.get(i) or (i if i not in INST else n), 'sym': sym, 'p': b.get('p') if b.get('p') is not None else q.get('S'), 'cp': b.get('cp') if b.get('cp') is not None else q.get('cp'),
                       'c': b.get('c'), 'kind': b.get('kind') or 'usd', 'yield': bsym in ('US2Y', '^TNX'), 'iv30': q.get('iv30'), 'day': round(0.8 * q['iv30'] / math.sqrt(252), 2) if q.get('iv30') else None,
                       'moves': moves.get(sym, {}) if sym else {}}
    for r in reps:
        r['flows'] = [{'c': c, 'i': i, 'w': w, 'd': d} for c, i, w, d in r['flows']]
    reps.sort(key=lambda r: (r['date'], r.get('time') or ('16:00' if 'after' in r.get('when', '') else '08:00'), -(r.get('cap') or 0)))
    out = {'v': 1, 'at': now_iso(), 'optionsAt': options_at, 'channels': CH, 'reports': reps, 'instruments': inst,
           'quotes': {k: v for k, v in quotes.items() if k in {x['sym'] for x in inst.values() if x['sym']}}, 'moves': moves,
           'errors': errors[:30], 'source': 'Cboe delayed option quotes; Nasdaq calendars and company profiles; directions are the usual first reactions, not forecasts'}
    with open(os.path.join(DATA, 'impact.json'), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print(f"impact: {len(reps)} reports ({sum(1 for r in reps if r['kind'] == 'econ')} releases, {sum(1 for r in reps if r['kind'] == 'earn')} earnings), "
          f"{len(inst)} instruments, implied moves for {len(moves)}; {len(errors)} errors")
    return 0


if __name__ == '__main__':
    sys.exit(main())
