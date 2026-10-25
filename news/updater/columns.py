#!/usr/bin/env python3
"""The Watch's weekly market columns: three characters, written by Claude, on the same week.

  python3 news/updater/columns.py check news/columns/2026-10-25.json   exit 1 with the problems if it fails
  python3 news/updater/columns.py index                                 rebuild news/columns/index.json
  python3 news/updater/columns.py who                                   print the three characters

One file per week, named for the Sunday it is published (the week it looks back on ends the Friday before):
  {"week": "2026-10-25", "written": "2026-10-25T08:40:00-04:00", "model": "Claude Opus 5.5",
   "facts": "the week's numbers all three columns rely on, in a few lines (from news/data/markets.json and the sources)",
   "columns": {
     "bull": {"title": "...", "dek": "...", "body": "Markdown, 550 to 950 words, numbers cited [n]"},
     "bear": {...}, "outsider": {...}},
   "sources": [{"title", "outlet", "url", "date"}, ...],
   "i18n": {"pt": {"bull": {"title", "dek", "body"}, "bear": {...}, "outsider": {...}}, "de": {...}}}
The characters are fictional and the columns say so on the page. They argue; they never tell a reader to buy or sell
a particular security. Standard library only.
"""
import datetime as dt
import json
import os
import re
import sys
import urllib.parse
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.normpath(os.path.join(HERE, '..', 'columns'))
ET = ZoneInfo('America/New_York')
WORDS = re.compile(r"[^\W_][\w’'.,%$-]*")
WHO = {
    'bull': {'name': 'Cal Mercer', 'role': 'The Bull',
             'bio': 'Spent twenty years as a Wall Street equity strategist and still believes the long-run bet on American companies pays. Reads earnings calls for fun.',
             'voice': 'Upbeat, quick, numbers-first. Looks for what is improving: earnings, productivity, investment, the consumer. Admits the risks, then explains why they are priced or passing. Short sentences, an occasional sports line.'},
    'bear': {'name': 'Ruth Voss', 'role': 'The Bear',
             'bio': 'Ran money through three crashes and kept her clients through all of them. Watches credit, valuations and the plumbing of the financial system.',
             'voice': 'Dry, exact, unhurried. Looks for what is cracking: valuations, credit spreads, debt, liquidity, narrow leadership, leading indicators. Uses history as evidence, not decoration. Concedes good news, then asks what it costs.'},
    'outsider': {'name': 'June Kowalski', 'role': 'The Outsider',
                 'bio': 'Runs a forty-person machine shop in Ohio and reads the economy from her order book, her suppliers’ invoices and her electric bill. Doesn’t own a Bloomberg terminal.',
                 'voice': 'Plain-spoken and wry, skeptical of both bulls and bears. Checks Wall Street’s story against Main Street: orders, prices, hiring, customers, energy. Explains jargon in a phrase. Ends with what she is actually going to do at the shop.'},
}
LANGS = {'pt', 'de'}


def words(s):
    return len(WORDS.findall(re.sub(r'\[\d+\]|\]\([^)]*\)', ' ', s or '')))


def check(path, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    P = []
    try:
        w = json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError) as ex:
        return [f'not readable JSON: {ex}'], None
    for k in ('week', 'written', 'model', 'facts', 'columns', 'sources'):
        if not w.get(k):
            P.append(f'missing {k}')
    if P:
        return P, w
    try:
        sun = dt.date.fromisoformat(w['week'])
        if sun.weekday() != 6:
            P.append('week must be the Sunday the columns are published')
    except ValueError:
        P.append('week must be a date, YYYY-MM-DD'); sun = None
    if os.path.basename(path) != w['week'] + '.json':
        P.append('the file name must be the week plus .json')
    if not re.fullmatch(r'Claude [A-Za-z]+ \d+(\.\d+)?', w['model']):
        P.append('model must be the exact model name, like "Claude Opus 5.5"')
    try:
        t = dt.datetime.fromisoformat(w['written'])
        if t.tzinfo is None:
            P.append('written needs a UTC offset')
        elif abs((now - t).total_seconds()) > 36 * 3600 and '--any-date' not in sys.argv:
            P.append('written must be the actual time of writing (within the last day and a half)')
        elif sun and not 0 <= (sun - t.astimezone(ET).date()).days <= 2:
            P.append('columns are written on the weekend they are published (Friday night to Sunday)')
    except ValueError:
        P.append('written must be an ISO date and time')
    srcs = w['sources']
    n = len(srcs) if isinstance(srcs, list) else 0
    if n < 5:
        P.append('list at least five sources')
    else:
        doms = set()
        for i, s in enumerate(srcs, 1):
            u = (s or {}).get('url', '')
            if not re.match(r'^https?://', u) or not (s or {}).get('title') or not (s or {}).get('outlet'):
                P.append(f'source {i} needs a title, an outlet and an http(s) url')
            else:
                doms.add(urllib.parse.urlsplit(u).hostname.replace('www.', ''))
        if len(doms) < 3:
            P.append('sources must come from at least three different sites')
    cols = w['columns']
    if set(cols) != set(WHO):
        P.append(f'columns must be exactly {sorted(WHO)}')
    for k, c in cols.items():
        if k not in WHO:
            continue
        for f in ('title', 'dek', 'body'):
            if not c.get(f):
                P.append(f'{k}: missing {f}')
        if not c.get('body'):
            continue
        n_w = words(c['body'])
        if not 550 <= n_w <= 950:
            P.append(f'{k}: body is {n_w} words; 550 to 950')
        if not 15 <= len(c.get('title', '')) <= 110:
            P.append(f'{k}: title should be 15 to 110 characters')
        if len(c.get('dek', '')) > 260:
            P.append(f'{k}: dek should be at most 260 characters')
        if re.search(r'<\s*/?\s*[a-zA-Z][^>]*>', c['body']):
            P.append(f'{k}: no HTML; use Markdown')
        cited = {int(x) for x in re.findall(r'\[(\d{1,2})\](?!\()', c['body'])}
        if len(cited) < 2:
            P.append(f'{k}: cite at least two sources with [n]')
        if any(x < 1 or x > n for x in cited):
            P.append(f'{k}: a citation points past the end of the sources list')
        if re.search(r'\b(you should|I recommend|we recommend)\s+(buy|sell|short)\b|\b(buy|sell|short)\s+(shares of|the stock of)\b', c['body'], re.I):
            P.append(f'{k}: the characters argue; they never tell a reader to buy or sell a particular security')
        for q in re.findall(r'[“"]([^”"]{20,})[”"]', c['body']):
            if len(q.split()) > 25:
                P.append(f'{k}: a quotation runs {len(q.split())} words; quote under 25 words')
    for lang, t in (w.get('i18n') or {}).items():
        if lang not in LANGS:
            P.append(f'i18n.{lang}: only {sorted(LANGS)} are used'); continue
        for k, c in (t or {}).items():
            src = cols.get(k) or {}
            if k not in WHO or not c.get('body'):
                P.append(f'i18n.{lang}.{k}: needs title, dek and body'); continue
            r = words(c['body']) / max(1, words(src.get('body', '')))
            if not 0.75 <= r <= 1.45:
                P.append(f'i18n.{lang}.{k}: translate all of it, no summary')
            if {int(x) for x in re.findall(r'\[(\d{1,2})\](?!\()', c['body'])} != {int(x) for x in re.findall(r'\[(\d{1,2})\](?!\()', src.get('body', ''))}:
                P.append(f'i18n.{lang}.{k}: keep the same [n] citations')
    return P, w


def index():
    os.makedirs(D, exist_ok=True)
    rows = []
    for fn in sorted(os.listdir(D)):
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}\.json', fn):
            continue
        try:
            w = json.load(open(os.path.join(D, fn), encoding='utf-8'))
        except (OSError, ValueError):
            continue
        cols = {k: {'title': c['title'], 'dek': c['dek'], 'words': words(c['body']),
                    'i18n': {l: {'title': (w.get('i18n') or {}).get(l, {}).get(k, {}).get('title'), 'dek': (w.get('i18n') or {}).get(l, {}).get(k, {}).get('dek')}
                             for l in LANGS if (w.get('i18n') or {}).get(l, {}).get(k)}}
                for k, c in (w.get('columns') or {}).items() if k in WHO}
        rows.append({'week': w['week'], 'written': w['written'], 'model': w['model'], 'columns': cols})
    rows.sort(key=lambda r: r['week'], reverse=True)
    with open(os.path.join(D, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump({'v': 1, 'updated': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'who': WHO, 'weeks': rows}, fh, ensure_ascii=False, indent=1)
    print(f'index: {len(rows)} weeks')


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == 'check':
        problems, w = check(sys.argv[2])
        if problems:
            print('NOT READY:'); [print('  -', p) for p in problems]
            return 1
        print(f"ok: week of {w['week']}: " + '; '.join(f"{WHO[k]['role']}: “{c['title']}” ({words(c['body'])} words)" for k, c in w['columns'].items())
              + f"; translations: {', '.join(sorted((w.get('i18n') or {}).keys())) or 'none'}")
        return 0
    if len(sys.argv) >= 2 and sys.argv[1] == 'index':
        index()
        return 0
    if len(sys.argv) >= 2 and sys.argv[1] == 'who':
        print(json.dumps(WHO, indent=1, ensure_ascii=False))
        return 0
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main())
