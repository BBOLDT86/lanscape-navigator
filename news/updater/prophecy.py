#!/usr/bin/env python3
"""The Prophecy Watch: Kalshi's prices on the second half of the Simpsons' 2000 joke (a woman follows Trump).

  python3 news/updater/prophecy.py            read Kalshi's public API, update news/prophecy/data/odds.json (one point a day)
  python3 news/updater/prophecy.py check      validate the file; exit 1 with the problems if it fails

Reads three Kalshi markets, no key needed: the 2028 presidential winner (KXPRESPERSON-28), the 2028 Democratic
nominee (KXPRESNOMD-28) and which party wins (KXPRESPARTY-2028). Prices are the last trade in cents; when a market has
not traded, the middle of the bid and the ask. The file keeps the latest board and one history point per day: the
contract The Watch follows (Alexandria Ocasio-Cortez to win), every woman on the board added together, her price to be
nominated, the favorite, and the Democrats' price. A failed run keeps the last file and lists the error. Standard
library only.
"""
import datetime as dt
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # news/
OUT = os.path.join(ROOT, 'prophecy', 'data', 'odds.json')
API = 'https://api.elections.kalshi.com/trade-api/v2/markets'
EVENTS = {'winner': 'KXPRESPERSON-28', 'nominee': 'KXPRESNOMD-28', 'party': 'KXPRESPARTY-2028'}
PAGES = {'winner': 'https://kalshi.com/markets/kxpresperson/pres-person/kxpresperson-28',
         'nominee': 'https://kalshi.com/markets/kxpresnomd/democratic-primary-winner/kxpresnomd-28',
         'party': 'https://kalshi.com/markets/kxpresparty/party-winning-presidency/kxpresparty-2028'}
WATCH = 'Ocasio-Cortez'
# Women who have appeared on the 2028 boards; a name on the board that is not here counts as a man, so add to this
# list (or to "women" in the data file) when a new one is listed.
WOMEN = {'Alexandria Ocasio-Cortez', 'Kamala Harris', 'Gretchen Whitmer', 'Elizabeth Warren', 'Amy Klobuchar',
         'Tulsi Gabbard', 'Nikki Haley', 'Kristi Noem', 'Marjorie Taylor Greene', 'Sarah Huckabee Sanders',
         'Katie Porter', 'Katie Hobbs', 'Maura Healey', 'Michelle Obama', 'Hillary Clinton', 'Kirsten Gillibrand',
         'Tammy Duckworth', 'Mikie Sherrill', 'Abigail Spanberger', 'Jasmine Crockett', 'Ilhan Omar',
         'Stacey Abrams', 'Lauren Boebert', 'Elise Stefanik', 'Ivanka Trump', 'Lara Trump', 'Kelly Ayotte',
         'Joni Ernst', 'Katie Britt', 'Tammy Baldwin', 'Gina Raimondo', 'Jennifer Granholm', 'Susan Rice'}
PARTY = {'Ossoff': 'D', 'Vance': 'R', 'Rubio': 'R', 'Ocasio-Cortez': 'D', 'Newsom': 'D', 'DeSantis': 'R', 'Harris': 'D',
         'Talarico': 'D', 'Beshear': 'D', 'Shapiro': 'D', 'Buttigieg': 'D', 'Kelly': 'D', 'Pritzker': 'D', 'Emanuel': 'D',
         'Trump': 'R', 'Whitmer': 'D', 'Cruz': 'R', 'Carlson': 'R', 'Youngkin': 'R', 'Moore': 'D', 'Walz': 'D',
         'Booker': 'D', 'Khanna': 'D', 'Mamdani': 'D', 'Warren': 'D', 'Klobuchar': 'D', 'Gabbard': 'R', 'Haley': 'R',
         'Noem': 'R', 'Greene': 'R', 'Sanders': 'R', 'Ramaswamy': 'R', 'Musk': 'R', 'Kennedy': 'R', 'Hegseth': 'R',
         'Polis': 'D', 'Murphy': 'D', 'Fetterman': 'D', 'Gallego': 'D', 'Slotkin': 'D', 'Stephen A. Smith': 'D',
         'Cuban': 'D', 'Stewart': 'D', 'Clinton': 'D', 'Obama': 'D', 'Gillibrand': 'D', 'Duckworth': 'D', 'Omar': 'D',
         'Crockett': 'D', 'Abrams': 'D', 'Boebert': 'R', 'Stefanik': 'R', 'Ernst': 'R', 'Britt': 'R', 'Scott': 'R',
         'Hawley': 'R', 'Cotton': 'R', 'Burgum': 'R', 'Donalds': 'R', 'Paul': 'R', 'Johnson': 'R', 'Rogan': 'R',
         'Kemp': 'R', 'Abbott': 'R', 'Patrick': 'R', 'Huckabee Sanders': 'R', 'Trump Jr.': 'R'}


def log(*a):
    print(*a, file=sys.stderr)


def fetch(url, tries=2):
    last = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'TheWatch/1.0 (+https://bboldt86.github.io/lanscape-navigator/news/)',
                                                      'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read().decode('utf-8'))
        except (urllib.error.URLError, OSError, ValueError) as ex:
            last = ex
    raise RuntimeError(f'{url}: {last}')


def markets(event):
    """Every market of one event, following the cursor."""
    out, cursor = [], ''
    for _ in range(10):
        q = {'event_ticker': event, 'limit': 200}
        if cursor:
            q['cursor'] = cursor
        d = fetch(API + '?' + urllib.parse.urlencode(q))
        out += d.get('markets') or []
        cursor = d.get('cursor') or ''
        if not cursor:
            break
    return out


def cents(m, key):
    """A price in cents from either shape of Kalshi's API: `last_price` (int cents) or `last_price_dollars` (string)."""
    v = m.get(key)
    if isinstance(v, (int, float)):
        return float(v)
    v = m.get(key + '_dollars')
    if v not in (None, ''):
        try:
            return round(float(v) * 100, 2)
        except ValueError:
            return None
    return None


def price(m):
    p = cents(m, 'last_price')
    bid, ask = cents(m, 'yes_bid'), cents(m, 'yes_ask')
    if bid is not None and ask is not None and ask > 0:
        mid = (bid + ask) / 2
        if p is None or p <= 0 or abs(p - mid) > 10:          # no trade, or a stale print far from the book
            return round(mid, 1)
    return round(p, 1) if p is not None else None


def count(m, key):
    v = m.get(key)
    if isinstance(v, (int, float)):
        return int(v)
    v = m.get(key + '_fp')
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def name_of(m):
    return (m.get('yes_sub_title') or m.get('subtitle') or m.get('title') or '').strip()


def party_of(name):
    for key, p in PARTY.items():
        if key in name:
            return p
    return ''


def board(ms, women):
    rows = []
    for m in ms:
        if (m.get('status') or 'open') not in ('open', 'active', 'paused', 'initialized'):
            continue
        n = name_of(m)
        p = price(m)
        if not n or p is None:
            continue
        rows.append({'name': n, 'p': p, 'party': party_of(n), 'woman': n in women, 'vol': count(m, 'volume'),
                     'ticker': m.get('ticker')})
    rows.sort(key=lambda r: -r['p'])
    return rows


def build(prev):
    women = set(WOMEN) | set(prev.get('women') or [])
    errors = []
    data = {}
    for k, ev in EVENTS.items():
        try:
            data[k] = markets(ev)
        except RuntimeError as ex:
            errors.append(str(ex))
    if 'winner' not in data:
        return None, errors
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    win = board(data['winner'], women)
    nom = board(data.get('nominee') or [], women)
    party = {}
    for m in data.get('party') or []:
        n = name_of(m).lower()
        p = price(m)
        if p is None:
            continue
        if 'democrat' in n:
            party['D'] = p
        elif 'republican' in n:
            party['R'] = p
    aoc = next((r for r in win if WATCH in r['name']), None)
    aoc_n = next((r for r in nom if WATCH in r['name']), None)
    vol = sum(r['vol'] or 0 for r in win)
    point = {'d': now.astimezone(ZoneInfo('America/New_York')).date().isoformat(), 'at': now.isoformat().replace('+00:00', 'Z'),
             'aoc': aoc['p'] if aoc else None,
             'women': round(sum(r['p'] for r in win if r['woman']), 1) if win else None,
             'aocNom': aoc_n['p'] if aoc_n else None,
             'lead': {'name': win[0]['name'], 'p': win[0]['p']} if win else None,
             'dem': party.get('D'), 'src': 'Kalshi API'}
    out = {'v': 1, 'updated': point['at'], 'source': dict(PAGES, name='Kalshi', api=API),
           'watch': {'name': aoc['name'] if aoc else 'Alexandria Ocasio-Cortez', 'ticker': aoc.get('ticker') if aoc else None},
           'women': sorted(women),
           'board': {'at': point['at'], 'winner': win[:30], 'nominee': nom[:20], 'party': party, 'volume': vol},
           'history': [h for h in (prev.get('history') or []) if h.get('d') != point['d']] + [point],
           'seed': prev.get('seed'), 'errors': errors}
    out['history'].sort(key=lambda h: h['d'])
    return out, errors


def check(path=OUT):
    problems = []
    try:
        d = json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError) as ex:
        return [f'not readable JSON: {ex}']
    for k in ('v', 'updated', 'board', 'history'):
        if k not in d:
            problems.append(f'missing {k}')
    if problems:
        return problems
    b = d['board']
    if not isinstance(b.get('winner'), list) or len(b['winner']) < 3:
        problems.append('board.winner needs at least three rows')
    for r in b.get('winner', []) + b.get('nominee', []):
        if not r.get('name') or not isinstance(r.get('p'), (int, float)) or not 0 <= r['p'] <= 100:
            problems.append(f'bad board row {r}')
    if not isinstance(d['history'], list) or not d['history']:
        problems.append('history is empty')
    last = ''
    for h in d['history']:
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', h.get('d', '')):
            problems.append(f'history point without a date: {h}')
        elif h['d'] <= last:
            problems.append(f'history is not in date order at {h["d"]}')
        last = h.get('d', last)
        for k in ('aoc', 'women', 'aocNom', 'dem'):
            v = h.get(k)
            if v is not None and not (isinstance(v, (int, float)) and 0 <= v <= 100):
                problems.append(f'{h["d"]}: {k} should be a percentage or null')
    if not any(h.get('aoc') is not None for h in d['history']):
        problems.append('no history point has the watched contract')
    return problems


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'check':
        p = check(sys.argv[2] if len(sys.argv) > 2 else OUT)
        if p:
            print('NOT READY:'); [print('  -', x) for x in p]
            return 1
        print('ok:', OUT)
        return 0
    prev = {}
    if os.path.exists(OUT):
        try:
            prev = json.load(open(OUT, encoding='utf-8'))
        except (OSError, ValueError):
            prev = {}
    out, errors = build(prev)
    if out is None:
        log('Kalshi could not be read; kept the last file:', *errors)
        if prev:
            prev['errors'] = errors
            prev['checked'] = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
            json.dump(prev, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        return 0
    problems = []
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp = OUT + '.tmp'
    json.dump(out, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    problems = check(tmp)
    if problems:
        os.remove(tmp)
        log('new file failed its check; kept the last one:', *problems)
        return 0
    os.replace(tmp, OUT)
    pt = out['history'][-1]
    log(f"prophecy: {pt['d']} AOC to win {pt['aoc']}¢, women {pt['women']}¢, nominee {pt['aocNom']}¢, lead {pt['lead']}, D {pt['dem']}¢; {len(out['board']['winner'])} names; errors: {errors or 'none'}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
