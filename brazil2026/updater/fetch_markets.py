#!/usr/bin/env python3
"""Prediction-market prices for the runoff (Polymarket Gamma API, Kalshi public API) -> data/markets.json
Outcomes are matched to the two candidates by name (Lula / Bolsonaro). Fails soft: keeps the last values and
records the error. Cache-busting query parameter on every call (cached snapshots came back stale otherwise).
"""
import json, os, sys, time, datetime as dt, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..', 'data')
UA = {'User-Agent': 'BrazilDesk2026/1.0 (+https://bboldt86.github.io/lanscape-navigator/brazil2026/)'}
def now(): return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def get(url, timeout=20):
    sep = '&' if '?' in url else '?'
    req = urllib.request.Request(url + f'{sep}cb={int(time.time())}', headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.loads(r.read().decode('utf-8'))
def load(p, d):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return d
def side(text):
    t = (text or '').lower()
    if 'lula' in t or 'silva' in t: return 'lula'
    if 'bolsonaro' in t or 'flávio' in t or 'flavio' in t: return 'flavio'
    return None

feeds = load(os.path.join(D, 'feeds.json'), {}); cfg = feeds.get('markets') or {}
old = load(os.path.join(D, 'markets.json'), {})
out = {'asOf': now(), 'pres': old.get('pres'), 'history': old.get('history') or [], 'errors': []}
pres = None
for e in (cfg.get('polymarket') or {}).get('events') or []:
    try:
        ev = get((cfg['polymarket'].get('gammaBase') or 'https://gamma-api.polymarket.com/events?slug=') + urllib.parse.quote(e['slug']))
        ev = ev[0] if isinstance(ev, list) else ev
        probs = {}
        for m in ev.get('markets') or []:
            if m.get('closed'): continue
            s = side((m.get('groupItemTitle') or '') + ' ' + (m.get('question') or ''))
            if not s: continue
            prices = json.loads(m.get('outcomePrices') or '[]')
            if prices: probs[s] = probs.get(s, 0) + float(prices[0])
        if probs:
            pres = {'flavio': round(probs.get('flavio', 0), 3), 'lula': round(probs.get('lula', 0), 3), 'venue': 'Polymarket',
                    'url': 'https://polymarket.com/event/' + (ev.get('slug') or e['slug']), 'asOf': out['asOf'], 'volume': round(ev.get('volume') or ev.get('volumeNum') or 0) or None}
        else: out['errors'].append(f'polymarket: no candidate outcomes in {e["slug"]}')
    except Exception as ex: out['errors'].append(f'polymarket: {type(ex).__name__}: {str(ex)[:120]}')
for e in (cfg.get('kalshi') or {}).get('events') or []:
    try:
        base = cfg['kalshi'].get('apiBase') or 'https://api.elections.kalshi.com/trade-api/v2'
        ev = get(f'{base}/events/{e["ticker"]}?with_nested_markets=true')
        probs = {}
        for m in (ev.get('event') or ev).get('markets') or []:
            if m.get('status') and m['status'] not in ('active', 'open', 'initialized'): continue
            s = side((m.get('yes_sub_title') or '') + ' ' + (m.get('title') or '') + ' ' + (m.get('ticker') or ''))
            if not s: continue
            bid = float(m.get('yes_bid_dollars') or 0); ask = float(m.get('yes_ask_dollars') or 0)
            p = (bid + ask) / 2 if bid and ask else float(m.get('last_price_dollars') or 0)
            if p: probs[s] = round(probs.get(s, 0) + p, 3)
        if probs:
            k = {'flavio': probs.get('flavio'), 'lula': probs.get('lula'), 'url': 'https://kalshi.com/markets/' + e['ticker'].split('-')[0].lower(), 'asOf': out['asOf']}
            if pres: pres['kalshi'] = k
            else: pres = {'flavio': k['flavio'], 'lula': k['lula'], 'venue': 'Kalshi', 'url': k['url'], 'asOf': out['asOf']}
        else: out['errors'].append(f'kalshi: no candidate markets in {e["ticker"]}')
    except Exception as ex: out['errors'].append(f'kalshi: {type(ex).__name__}: {str(ex)[:120]}')
if pres:
    pres['source'] = 'direct API reads by brazil2026/updater/fetch_markets.py'
    out['pres'] = pres
    out['history'].append({'t': out['asOf'], 'flavio': pres.get('flavio'), 'lula': pres.get('lula'), 'venue': pres['venue'], 'kalshiFlavio': (pres.get('kalshi') or {}).get('flavio')})
    out['history'] = out['history'][-2000:]
json.dump(out, open(os.path.join(D, 'markets.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'markets: {"fresh" if pres else "kept last"}; {len(out["errors"])} errors'); [print('  ', x) for x in out['errors']]
sys.exit(0 if pres else 2)
