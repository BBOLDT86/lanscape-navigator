#!/usr/bin/env python3
"""Pull prediction-market prices (Polymarket Gamma API, Kalshi public API) for the races in data/feeds.json
-> data/markets.json  {asOf, senate, house, races: {id: {D, R, venue, url, asOf}}}
-> data/markets_history.json (one row per run, trimmed to 60 days)

Both APIs are public and need no key. Every URL gets a cache-busting parameter: without it, cached snapshots
came back stale. Fails soft: a market that cannot be read keeps its last value with a note.
"""
import json, os, sys, time, datetime as dt, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..', 'data')
UA = {'User-Agent': 'ElectionDesk2026/1.0 (+https://bboldt86.github.io/lanscape-navigator/election2026/)'}
def now(): return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def get(url, timeout=20):
    sep = '&' if '?' in url else '?'
    req = urllib.request.Request(url + f'{sep}cb={int(time.time())}', headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.loads(r.read().decode('utf-8'))
def load(p, d):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return d

feeds = load(os.path.join(D, 'feeds.json'), {}); cfg = feeds.get('markets') or {}
old = load(os.path.join(D, 'markets.json'), {}); out = {'asOf': now(), 'senate': old.get('senate'), 'house': old.get('house'), 'races': dict(old.get('races') or {}), 'errors': []}
FIXTURE = sys.argv[sys.argv.index('--fixture') + 1] if '--fixture' in sys.argv else None  # a dir of saved payloads: poly_<id>.json, kalshi_<id>.json (tests)
if FIXTURE:
    def get(url, timeout=20):  # noqa: F811
        import re as _re
        slug = _re.search(r'slug=([^&]+)', url); tick = _re.search(r'/events/([^?]+)', url)
        name = ('poly_' + urllib.parse.unquote(slug.group(1))) if slug else ('kalshi_' + tick.group(1))
        return json.load(open(os.path.join(FIXTURE, name + '.json'), encoding='utf-8'))

# candidate name -> party, from races.json, for markets that name candidates instead of parties (Alaska, Nebraska)
def _norm(n): return ' '.join(w for w in n.lower().replace('.', '').replace(',', '').split() if w not in ('sen', 'rep', 'gov', 'jr', 'sr', 'ii', 'iii'))
CAND = {}
for key, typ in (('senate', 'S'), ('governor', 'G')):
    for x in (load(os.path.join(D, 'races.json'), {}).get(key) or []):
        rid = x.get('id') or f"{(x.get('state') or '').upper()}-{typ}"
        for c in x.get('candidates') or []:
            nm = _norm(c.get('name') or ''); p = (c.get('party') or 'O')[:1].upper()
            if nm and p in 'DRI': CAND.setdefault(rid, {})[nm] = p
def side_from_name(rid, text):
    t = _norm(text or '')
    for nm, p in (CAND.get(rid) or {}).items():
        last = nm.split()[-1]
        if nm in t or (len(last) > 3 and last in t.split()): return p
    return None

# ---------------------------------------------------------------- Polymarket: one event per race, outcomes Democratic / Republican (or Yes/No on a party market)
def poly_event(slug, rid=None):
    ev = get((cfg.get('polymarket') or {}).get('gammaBase', 'https://gamma-api.polymarket.com/events?slug=') + urllib.parse.quote(slug))
    ev = ev[0] if isinstance(ev, list) else ev
    probs = {}
    for m in ev.get('markets') or []:
        if m.get('active') is False or m.get('closed'): continue
        q = (m.get('question') or '').lower(); g = m.get('groupItemTitle') or ''
        try: prices = json.loads(m.get('outcomePrices') or '[]')
        except Exception: continue
        if not prices: continue
        p = float(prices[0])  # price of the first outcome (Yes, or the named outcome)
        side = 'D' if 'democrat' in q else 'R' if 'republican' in q else 'I' if 'independent' in q else None
        if side is None: side = side_from_name(rid, g + ' ' + q)
        if side: probs[side] = probs.get(side, 0) + p  # a party's chance is the sum of its candidates' markets
    return {k: round(v, 3) for k, v in probs.items()}, ev.get('slug') and 'https://polymarket.com/event/' + ev['slug'], (ev.get('volume') or ev.get('volumeNum'))

for e in (cfg.get('polymarket') or {}).get('events') or []:
    rid, slug = e.get('id'), e.get('slug')
    if not slug: continue
    try:
        probs, url, vol = poly_event(slug, rid)
        if 'D' in probs or 'R' in probs:
            d = probs.get('D'); r = probs.get('R')
            if d is None and r is not None: d = round(1 - r, 3)
            if r is None and d is not None: r = round(1 - d, 3)
            row = {'D': round(d, 3), 'R': round(r, 3), 'venue': 'Polymarket', 'url': url or 'https://polymarket.com/event/' + slug, 'asOf': out['asOf'], 'volume': round(vol) if vol else None}
            if probs.get('I') is not None: row['I'] = probs['I']
            if rid == 'SENATE': out['senate'] = row
            elif rid == 'HOUSE': out['house'] = row
            else: out['races'][rid] = row
        else: out['errors'].append(f'polymarket {rid}: no D/R outcome found in {slug}')
    except Exception as ex: out['errors'].append(f'polymarket {rid}: {type(ex).__name__}: {str(ex)[:120]}')

# ---------------------------------------------------------------- Kalshi: event with nested markets; p = midpoint of yes bid/ask (dollar strings) per party market
def kalshi_event(ticker, rid=None):
    base = (cfg.get('kalshi') or {}).get('apiBase', 'https://api.elections.kalshi.com/trade-api/v2')
    ev = get(f'{base}/events/{ticker}?with_nested_markets=true')
    probs = {}
    for m in (ev.get('event') or ev).get('markets') or []:
        if m.get('status') and m['status'] not in ('active', 'open', 'initialized'): continue
        t = (m.get('ticker') or ''); title = (m.get('yes_sub_title') or m.get('title') or '').lower()
        side = 'D' if t.endswith('-D') or 'democrat' in title else 'R' if t.endswith('-R') or 'republican' in title else 'I' if 'independent' in title else None
        if not side: side = side_from_name(rid, title)
        if not side: continue
        try:
            bid = float(m.get('yes_bid_dollars') or 0); ask = float(m.get('yes_ask_dollars') or 0)
            p = (bid + ask) / 2 if bid and ask else float(m.get('last_price_dollars') or 0)
        except Exception: continue
        if p: probs[side] = round(probs.get(side, 0) + p, 3)
    return probs, f'https://kalshi.com/markets/{ticker.split("-")[0].lower()}'

for e in (cfg.get('kalshi') or {}).get('events') or []:
    rid, ticker = e.get('id'), e.get('ticker')
    if not ticker: continue
    try:
        probs, url = kalshi_event(ticker, rid)
        if probs:
            d = probs.get('D'); r = probs.get('R')
            if d is None and r is not None: d = round(1 - r, 3)
            if r is None and d is not None: r = round(1 - d, 3)
            row = {'D': d, 'R': r, 'venue': 'Kalshi', 'url': url, 'asOf': out['asOf']}
            if probs.get('I') is not None: row['I'] = probs['I']
            target = out['senate'] if rid == 'SENATE' else out['house'] if rid == 'HOUSE' else out['races'].get(rid)
            # keep Polymarket when both exist and were read now; otherwise take Kalshi
            if target and target.get('asOf') == out['asOf'] and target.get('venue') == 'Polymarket': target['kalshi'] = {k: v for k, v in (('D', d), ('R', r), ('I', probs.get('I')), ('url', url)) if v is not None}
            elif rid == 'SENATE': out['senate'] = row
            elif rid == 'HOUSE': out['house'] = row
            else: out['races'][rid] = row
        else: out['errors'].append(f'kalshi {rid}: no party markets in {ticker}')
    except Exception as ex: out['errors'].append(f'kalshi {rid}: {type(ex).__name__}: {str(ex)[:120]}')

fresh = sum(1 for v in [out['senate'], out['house']] + list(out['races'].values()) if v and v.get('asOf') == out['asOf'])
json.dump(out, open(os.path.join(D, 'markets.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
hist = load(os.path.join(D, 'markets_history.json'), [])
hist.append({'t': out['asOf'], 'senate': out['senate'] and out['senate'].get('D'), 'house': out['house'] and out['house'].get('D'), 'races': {k: v.get('D') for k, v in out['races'].items()}})
cut = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=60)).strftime('%Y-%m-%dT%H:%M:%SZ')
json.dump([h for h in hist if h['t'] >= cut], open(os.path.join(D, 'markets_history.json'), 'w'), indent=0)
print(f'markets: {fresh} fresh prices, {len(out["errors"])} errors'); [print('  ', e) for e in out['errors']]
sys.exit(0 if fresh else 2)
