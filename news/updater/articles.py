#!/usr/bin/env python3
"""The Watch's reports: checks an article written by the daily writer, and rebuilds the index the page reads.

  python3 news/updater/articles.py check news/articles/2026-10-25-some-slug.json   exit 1 with the problems if it fails
  python3 news/updater/articles.py index                                            rebuild news/articles/index.json

An article is one JSON file in news/articles/, named for its id:
  {"id": "2026-10-25-some-slug", "title": "...", "dek": "one or two sentences", "desk": "world",
   "byline": "Claude", "model": "Claude Opus 5.5", "written": "2026-10-25T06:52:00-04:00",
   "body": "Markdown: paragraphs, ## and ### headings, > quotes, - lists, **bold**, *italic*, [links](https://...),
            and numbered citations like [3] that point at sources[2]",
   "sources": [{"title": "...", "outlet": "...", "url": "https://...", "date": "2026-10-24"}, ...],
   "edition": "2026-10-25-morning", "story": "the edition story id it grew out of, if any"}
Standard library only.
"""
import datetime as dt
import json
import os
import re
import sys
import urllib.parse
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.normpath(os.path.join(HERE, '..', 'articles'))
DESKS = {'us', 'world', 'europe', 'brazil', 'politics', 'business', 'household', 'home', 'tech', 'science', 'health', 'sports',
         'culture', 'cars', 'travel', 'food', 'longreads', 'files'}
WORDS = re.compile(r"[A-Za-z0-9’'][A-Za-z0-9’'.,%$-]*")


def words(s):
    return len(WORDS.findall(re.sub(r'\[\d+\]|\]\([^)]*\)', ' ', s)))


def check(path, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    problems = []
    try:
        a = json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError) as ex:
        return [f'not readable JSON: {ex}'], None
    for k in ('id', 'title', 'dek', 'desk', 'byline', 'model', 'written', 'body', 'sources'):
        if not a.get(k):
            problems.append(f'missing {k}')
    if problems:
        return problems, a
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+){1,9}', a['id']):
        problems.append('id must be the date then a short lowercase slug, like 2026-10-25-brazil-runoff')
    if os.path.basename(path) != a['id'] + '.json':
        problems.append('the file name must be the id plus .json')
    if a['byline'] != 'Claude':
        problems.append('byline must be "Claude"')
    if not re.fullmatch(r'Claude [A-Za-z]+ \d+(\.\d+)?', a['model']):
        problems.append('model must be the exact model name, like "Claude Opus 5.5"')
    try:
        w = dt.datetime.fromisoformat(a['written'])
        if w.tzinfo is None:
            problems.append('written needs a UTC offset, like 2026-10-25T06:52:00-04:00')
        elif abs((now - w).total_seconds()) > 36 * 3600 and '--any-date' not in sys.argv:
            problems.append('written must be the actual time of writing (within the last day and a half)')
        elif a['id'][:10] != w.astimezone(ZoneInfo('America/New_York')).date().isoformat():
            problems.append('the id’s date must be the date it was written, Eastern time')
    except ValueError:
        problems.append('written must be an ISO date and time')
    if a['desk'] not in DESKS:
        problems.append(f'desk must be one of {sorted(DESKS)}')
    if not 20 <= len(a['title']) <= 140:
        problems.append('title should be 20 to 140 characters')
    if len(a['dek']) > 320:
        problems.append('dek should be at most 320 characters')
    body = a['body']
    n = words(body)
    if not 1100 <= n <= 3200:
        problems.append(f'body is {n} words; it should be 1,100 to 3,200')
    if len(re.findall(r'^## ', body, re.M)) < 3:
        problems.append('use at least three ## section headings')
    if re.search(r'<\s*/?\s*[a-zA-Z][^>]*>', body):
        problems.append('no HTML in the body; use Markdown')
    for q in re.findall(r'[“"]([^”"]{20,})[”"]', body):
        if len(q.split()) > 25:
            problems.append(f'a quotation runs {len(q.split())} words; quote under 25 words and paraphrase the rest: “{q[:60]}…”')
    srcs = a['sources']
    if not isinstance(srcs, list) or len(srcs) < 6:
        problems.append('list at least six sources')
    else:
        doms = set()
        for i, s in enumerate(srcs, 1):
            u = (s or {}).get('url', '')
            if not re.match(r'^https?://', u) or not (s or {}).get('title') or not (s or {}).get('outlet'):
                problems.append(f'source {i} needs a title, an outlet and an http(s) url')
            else:
                doms.add(urllib.parse.urlsplit(u).hostname.replace('www.', ''))
        if len(doms) < 4:
            problems.append('sources must come from at least four different outlets')
        cited = {int(x) for x in re.findall(r'\[(\d{1,2})\](?!\()', body)}
        if len(cited) < 6:
            problems.append(f'cite at least six sources in the text with [n]; found {len(cited)}')
        bad = sorted(c for c in cited if c < 1 or c > len(srcs))
        if bad:
            problems.append(f'citations {bad} point past the end of the sources list')
    return problems, a


def index():
    os.makedirs(A, exist_ok=True)
    rows = []
    for fn in sorted(os.listdir(A)):
        if not fn.endswith('.json') or fn == 'index.json':
            continue
        try:
            a = json.load(open(os.path.join(A, fn), encoding='utf-8'))
        except (OSError, ValueError):
            continue
        n = words(a.get('body', ''))
        rows.append({'id': a['id'], 'title': a['title'], 'dek': a['dek'], 'desk': a['desk'], 'byline': a['byline'], 'model': a['model'],
                     'written': a['written'], 'words': n, 'min': max(1, round(n / 230)), 'sources': len(a.get('sources') or [])})
    rows.sort(key=lambda r: r['written'], reverse=True)
    with open(os.path.join(A, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump({'v': 1, 'updated': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'articles': rows}, fh, ensure_ascii=False, indent=1)
    print(f'index: {len(rows)} articles')


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == 'check':
        problems, a = check(sys.argv[2])
        if problems:
            print('NOT READY:'); [print('  -', p) for p in problems]
            return 1
        print(f"ok: “{a['title']}”, {words(a['body'])} words, {len(a['sources'])} sources, by {a['byline']} ({a['model']}), {a['written']}")
        return 0
    if len(sys.argv) >= 2 and sys.argv[1] == 'index':
        index()
        return 0
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main())
