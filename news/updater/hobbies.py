#!/usr/bin/env python3
"""The Hobbies desk: dressage, woodworking and poker to start, and room for more.

  python3 news/updater/hobbies.py              rebuild news/data/hobbies.json (the hobbies' YouTube channels)
  python3 news/updater/hobbies.py check        exit 1 with the problems in news/hobbies/guide.json and every feature
  python3 news/updater/hobbies.py check FILE   check one feature (news/hobbies/features/<id>.json)
  python3 news/updater/hobbies.py index        rebuild news/hobbies/features/index.json
  python3 news/updater/hobbies.py format       print the formats

Where things live:
  the wire      each hobby's stories are in the edition: feeds in news/data/feeds.json with "section": "hobbies" and
                "hobby": "<key>", plus any story from another desk the edition tags #<key> (run.py's TOPICS)
  the guide     news/hobbies/guide.json, curated by Claude: for each hobby the channels to watch, the calendar, where to
                start and the words to know, with Portuguese and German
  features      news/hobbies/features/<id>.json, in-depth pieces in the Reports format (articles.py) with a "hobby"
  videos        news/data/hobbies.json, rebuilt on every news run from the guide's channels: the last 45 days of
                uploads, each feed checked against the channel's own name, Shorts left out
Standard library only.
"""
import concurrent.futures as cf
import datetime as dt
import json
import os
import re
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import articles  # noqa: E402  the Reports checker, which features share
import garage  # noqa: E402  its YouTube reader

N = os.path.normpath(os.path.join(HERE, '..'))
H = os.path.join(N, 'hobbies')
F = os.path.join(H, 'features')
GUIDE = os.path.join(H, 'guide.json')
OUT = os.path.join(N, 'data', 'hobbies.json')
LANGS = ('pt', 'de')
KINDS = {'official', 'learn', 'book', 'watch', 'tools', 'community', 'data'}
TIERS = {'major', 'regional'}

FORMAT = """news/hobbies/guide.json
{"v": 1, "updated": "2026-10-26T10:00:00-04:00", "model": "Claude Opus 5.5",
 "hobbies": [
  {"key": "dressage", "name": "Dressage", "dek": "one sentence, at most 240 characters",
   "channels": [{"id": "UC + 22 characters", "expect": "a word the channel's feed name contains, lowercase",
                 "name": "the name to show", "handle": "the @handle without the @", "about": "one line",
                 "match": "optional: a regex a video's title or description must hit, for a channel that covers
                           more than this hobby (the FEI's channel also shows jumping)"}],
   "calendar": [{"name": "...", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "place": "City, State or Country", "venue": "...",
                 "url": "the official page", "what": "one line", "source": "where the dates were confirmed", "tier": "major|regional"}],
   "start": [{"title": "...", "url": "https://...", "kind": "official|learn|book|watch|tools|community|data", "why": "one line"}],
   "glossary": [{"term": "...", "def": "at most 220 characters"}],
   "i18n": {"pt": {"name": "...", "dek": "...",
                   "channels": {"<channel id>": "about, translated"},
                   "calendar": {"<name>|<start>": "what, translated"},
                   "start": {"<url>": "why, translated"},
                   "glossary": {"<term>": ["the term in Portuguese (or the same word)", "the definition"]}},
            "de": {... the same in German ...}}}]}
Every channel, calendar entry, resource and word needs its translation in both languages. Calendar entries that ended
more than 30 days ago should be dropped; each date needs a source that confirms it.

news/hobbies/features/<id>.json: a report (python3 news/updater/articles.py, the docstring) with "desk": "hobbies"
and "hobby": "<key>". The same rules: 1,100 to 3,200 words, at least three ## sections, six or more sources from four
or more outlets, every source cited, no quotation over 25 words, the time written, and optional pt/de translations.
"""


def load(p, d=None):
    try:
        with open(p, encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return d


def https(u):
    try:
        s = urllib.parse.urlsplit(u or '')
    except ValueError:
        return False
    return s.scheme == 'https' and '.' in (s.hostname or '')


def day(s):
    try:
        return dt.date.fromisoformat(s) if re.fullmatch(r'\d{4}-\d{2}-\d{2}', s or '') else None
    except ValueError:
        return None


def check_guide(g=None, today=None):
    g = g if g is not None else load(GUIDE)
    today = today or dt.datetime.now(dt.timezone.utc).date()
    p = []
    if not isinstance(g, dict) or not isinstance(g.get('hobbies'), list) or not g['hobbies']:
        return ['guide.json needs {"hobbies": [...]}'], g
    for k in ('updated', 'model'):
        if not g.get(k):
            p.append(f'guide: missing {k}')
    if g.get('model') and not re.fullmatch(r'Claude [A-Za-z]+ \d+(\.\d+)?', g['model']):
        p.append('guide: model must be the exact model name, like "Claude Opus 5.5"')
    keys = set()
    for h in g['hobbies']:
        key = h.get('key', '')
        w = f'{key or "?"}:'
        if not re.fullmatch(r'[a-z]{3,20}', key):
            p.append(f'{w} key must be a short lowercase word')
        if key in keys:
            p.append(f'{w} key used twice')
        keys.add(key)
        for k in ('name', 'dek'):
            if not h.get(k):
                p.append(f'{w} missing {k}')
        if len(h.get('dek', '')) > 240:
            p.append(f'{w} dek is over 240 characters')
        ch, cal, st, gl = h.get('channels') or [], h.get('calendar') or [], h.get('start') or [], h.get('glossary') or []
        if len(ch) < 4:
            p.append(f'{w} list at least four channels')
        for c in ch:
            if not re.fullmatch(r'UC[\w-]{22}', c.get('id', '')):
                p.append(f'{w} channel {c.get("name")!r}: id must be UC plus 22 characters')
            if not c.get('expect') or c['expect'] != c['expect'].lower():
                p.append(f'{w} channel {c.get("name")!r}: expect must be a lowercase word from its name')
            for k in ('name', 'handle', 'about'):
                if not c.get(k):
                    p.append(f'{w} channel {c.get("name")!r}: missing {k}')
            if c.get('match'):
                try:
                    re.compile(c['match'])
                except re.error as ex:
                    p.append(f'{w} channel {c.get("name")!r}: match is not a valid regex ({ex})')
        if len({c.get('id') for c in ch}) != len(ch):
            p.append(f'{w} a channel is listed twice')
        for e in cal:
            n = e.get('name') or '?'
            a, b = day(e.get('start')), day(e.get('end'))
            if not a or not b:
                p.append(f'{w} calendar {n!r}: start and end must be YYYY-MM-DD')
            elif b < a:
                p.append(f'{w} calendar {n!r}: ends before it starts')
            elif (today - b).days > 30:
                p.append(f'{w} calendar {n!r}: ended {b}; drop it')
            for k in ('place', 'what'):
                if not e.get(k):
                    p.append(f'{w} calendar {n!r}: missing {k}')
            if not https(e.get('url')) or not https(e.get('source')):
                p.append(f'{w} calendar {n!r}: url and source must be https links')
            if e.get('tier') not in TIERS:
                p.append(f'{w} calendar {n!r}: tier must be major or regional')
        for r in st:
            if not https(r.get('url')) or not r.get('title') or not r.get('why'):
                p.append(f'{w} start {r.get("title")!r}: needs a title, an https url and why')
            if r.get('kind') not in KINDS:
                p.append(f'{w} start {r.get("title")!r}: kind must be one of {sorted(KINDS)}')
        for x in gl:
            if not x.get('term') or not x.get('def'):
                p.append(f'{w} glossary: every word needs a term and a def')
            elif len(x['def']) > 220:
                p.append(f'{w} glossary {x["term"]!r}: def is over 220 characters')
        tr = h.get('i18n') or {}
        for lg in LANGS:
            t = tr.get(lg)
            if not isinstance(t, dict):
                p.append(f'{w} i18n.{lg} is missing'); continue
            for k in ('name', 'dek'):
                if not t.get(k):
                    p.append(f'{w} i18n.{lg}.{k} is missing')
            need = {'channels': [c.get('id') for c in ch], 'calendar': [f"{e.get('name')}|{e.get('start')}" for e in cal],
                    'start': [r.get('url') for r in st], 'glossary': [x.get('term') for x in gl]}
            for k, ids in need.items():
                have = t.get(k) or {}
                miss = [i for i in ids if not have.get(i)]
                if miss:
                    p.append(f'{w} i18n.{lg}.{k}: {len(miss)} missing, first {miss[0]!r}')
            for term, v in (t.get('glossary') or {}).items():
                if not (isinstance(v, list) and len(v) == 2 and all(v)):
                    p.append(f'{w} i18n.{lg}.glossary {term!r}: give ["term", "definition"]')
    return p, g


def check_feature(path, keys, strict=True):
    """strict: the time written must be now (a feature just written); otherwise it is checked against its own time"""
    now = None
    if not strict:
        try:
            now = dt.datetime.fromisoformat((load(path) or {}).get('written', ''))
        except ValueError:
            now = None
    probs, a = articles.check(path, now)
    if a and a.get('hobby') not in keys:
        probs.append(f'hobby must be one of {sorted(keys)}')
    if a and a.get('desk') != 'hobbies':
        probs.append('desk must be "hobbies"')
    return probs, a


def features():
    return sorted(os.path.join(F, fn) for fn in os.listdir(F) if fn.endswith('.json') and fn != 'index.json') if os.path.isdir(F) else []


def index():
    rows = []
    for path in features():
        a = load(path)
        if not a or not a.get('id'):
            continue
        n = articles.words(a.get('body', ''))
        row = {'id': a['id'], 'hobby': a.get('hobby'), 'title': a['title'], 'dek': a['dek'], 'byline': a.get('byline'), 'model': a.get('model'),
               'written': a['written'], 'words': n, 'min': max(1, round(n / 230)), 'sources': len(a.get('sources') or [])}
        tr = {k: {'title': v['title'], 'dek': v['dek']} for k, v in (a.get('i18n') or {}).items()
              if k in LANGS and isinstance(v, dict) and v.get('title') and v.get('dek') and v.get('body')}
        if tr:
            row['i18n'] = tr
        rows.append(row)
    rows.sort(key=lambda r: r['written'], reverse=True)
    os.makedirs(F, exist_ok=True)
    with open(os.path.join(F, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump({'v': 1, 'updated': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'features': rows}, fh, ensure_ascii=False, indent=1)
    print(f'index: {len(rows)} features')
    return 0


def channels(lst, per, days):
    """the channels' recent uploads, newest first, at most `per` from each; a channel with "match" keeps only the videos about the hobby"""
    got, failed = [], []
    with cf.ThreadPoolExecutor(6) as pool:
        futs = {pool.submit(garage.channel, c['id'], c['expect'], c['name'], c['handle'], c.get('about', ''), days=days): c for c in lst}
        for f in cf.as_completed(futs):
            c = futs[f]
            try:
                vs = f.result()
            except Exception as ex:  # noqa: BLE001 - one channel must never stop the rest
                failed.append(c['name']); garage.errors.append(f"{c['name']}: {type(ex).__name__} {str(ex)[:80]}")
                continue
            if c.get('match'):
                vs = [v for v in vs if re.search(c['match'], v['t'] + ' ' + v.get('d', ''), re.I)]
            got += sorted(vs, key=lambda v: v['p'], reverse=True)[:per]
    return sorted(got, key=lambda v: v['p'], reverse=True), failed


def build():
    g = load(GUIDE) or {}
    old = load(OUT, {}) or {}
    out = {'v': 1, 'at': garage.NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'videos': {}, 'failed': []}
    for h in g.get('hobbies', []):
        lst = [c for c in h.get('channels', []) if c.get('id')]
        vids, failed = channels(lst, per=4, days=45)
        if lst and len(failed) > len(lst) // 2 and (old.get('videos') or {}).get(h['key']):
            vids = old['videos'][h['key']]  # YouTube's feeds were down for most of them: keep the last good list
        out['videos'][h['key']] = vids[:36]
        out['failed'] += [f"{h['key']}: {n}" for n in failed]
        print(f"{h['key']}: {len(vids)} videos from {len(lst) - len(failed)} of {len(lst)} channels")
    out['errors'] = garage.errors[:40]
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    return 0


def main():
    a = sys.argv[1:]
    if a and a[0] in ('format', '-h', '--help'):
        print(__doc__); print(FORMAT); return 0
    if a and a[0] == 'index':
        return index()
    if a and a[0] == 'check':
        probs, g = check_guide()
        keys = {h.get('key') for h in (g or {}).get('hobbies', [])}
        bad = 0
        if len(a) == 1:
            if probs:
                bad = 1; print('guide.json: NOT READY'); [print('  -', x) for x in probs[:60]]
            else:
                hs = g['hobbies']
                print(f"guide.json: ok, {len(hs)} hobbies, {sum(len(h['channels']) for h in hs)} channels, "
                      f"{sum(len(h['calendar']) for h in hs)} dates, {sum(len(h['start']) for h in hs)} resources, {sum(len(h['glossary']) for h in hs)} words")
        for path in a[1:] or features():
            fp, f = check_feature(path, keys, strict=len(a) > 1)
            if fp:
                bad = 1; print(f'{os.path.basename(path)}: NOT READY'); [print('  -', x) for x in fp[:40]]
            else:
                print(f"{os.path.basename(path)}: ok, {f['hobby']}, {articles.words(f['body'])} words, {len(f['sources'])} sources, "
                      f"translations: {', '.join(sorted((f.get('i18n') or {}).keys())) or 'none'}")
        return bad
    return build()


if __name__ == '__main__':
    sys.exit(main())
