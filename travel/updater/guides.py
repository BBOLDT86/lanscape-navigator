#!/usr/bin/env python3
"""Weekender's 3 Perfect Days guides: checks a guide written by the weekly writer, and rebuilds the index the page reads.

  python3 travel/updater/guides.py check travel/guides/2026-10-30/paris.json   exit 1 with the problems if it fails
  python3 travel/updater/guides.py index                                       rebuild travel/guides/index.json
  python3 travel/updater/guides.py weekend                                     print the coming weekend's Friday

One guide per city per weekend, in travel/guides/<Friday>/<city>.json, where <Friday> is the weekend's Friday
(YYYY-MM-DD) and <city> one of the ids in travel/data/cities.json:
  {"id": "2026-10-30-paris", "city": "paris", "weekend": "2026-10-30",
   "title": "Three perfect days in Paris", "dek": "one or two sentences",
   "byline": "Claude", "model": "Claude Opus 5.5", "written": "2026-10-26T06:40:00-04:00",
   "hero": {"wiki": "Pont Alexandre III", "caption": "a line under the opening picture"},
   "intro": "Markdown: why this weekend, what's on, the season",
   "days": [{"date": "2026-10-30", "title": "Friday: the Left Bank", "intro": "a sentence or two",
             "stops": [{"time": "09:00", "kind": "eat", "name": "Café de Flore", "area": "Saint-Germain-des-Prés",
                        "text": "Markdown, what to do and why", "wiki": "Café de Flore", "url": "https://...",
                        "addr": "172 Bd Saint-Germain", "book": {"label": "Book a table", "url": "https://..."}}, ...]},
            {Saturday}, {Sunday}],
   "stay": [{"tier": "splurge", "name": "...", "area": "...", "text": "...", "url": "https://...", "wiki": "...", "price": "$$$$"},
            {"tier": "classic", ...}, {"tier": "value", ...}],
   "events": [{"name": "...", "date": "2026-10-31", "when": "Sat. 7 p.m.", "where": "...", "text": "...", "url": "https://..."}, ...],
   "know": ["practical things: getting in from the airport, transit, tipping, the clock change", ...],
   "sources": [{"title": "...", "outlet": "...", "url": "https://...", "date": "2026-10-25"}, ...]}
kind is one of eat, drink, see, do, walk, shop, night. wiki is an English Wikipedia article title; the updater
(travel/updater/live.py) turns it into a credited picture and a map pin. Markdown: paragraphs, **bold**, *italic*,
[links](https://...). Standard library only.
"""
import datetime as dt
import json
import os
import re
import sys
import urllib.parse
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
TRAVEL = os.path.normpath(os.path.join(HERE, '..'))
G = os.path.join(TRAVEL, 'guides')
ET = ZoneInfo('America/New_York')
KINDS = {'eat', 'drink', 'see', 'do', 'walk', 'shop', 'night'}
TIERS = ['splurge', 'classic', 'value']
WORDS = re.compile(r"[^\W_][\w’'.,%$&-]*")
URL = re.compile(r'^https?://[^\s/]+\.[^\s]+$')


def cities():
    return {c['id']: c for c in json.load(open(os.path.join(TRAVEL, 'data', 'cities.json'), encoding='utf-8'))['cities']}


def words(s):
    return len(WORDS.findall(re.sub(r'\]\([^)]*\)', ' ', s or '')))


def coming_friday(today=None):
    """the Friday of the next weekend after today (Eastern time): Monday -> this Friday, Friday or Saturday -> next week's"""
    today = today or dt.datetime.now(ET).date()
    return today + dt.timedelta(days=(4 - today.weekday()) % 7 or 7)


def all_text(g):
    out = [g.get('intro', '')]
    for d in g.get('days') or []:
        out.append(d.get('intro', ''))
        out += [s.get('text', '') for s in d.get('stops') or []]
    out += [s.get('text', '') for s in g.get('stay') or []]
    out += [e.get('text', '') for e in g.get('events') or []]
    out += list(g.get('know') or [])
    return out


def check(path, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    P = []
    try:
        g = json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError) as ex:
        return [f'not readable JSON: {ex}'], None
    for k in ('id', 'city', 'weekend', 'title', 'dek', 'byline', 'model', 'written', 'hero', 'intro', 'days', 'stay', 'events', 'know', 'sources'):
        if not g.get(k):
            P.append(f'missing {k}')
    if P:
        return P, g
    C = cities()
    if g['city'] not in C:
        P.append(f'city must be one of {sorted(C)}')
    try:
        fri = dt.date.fromisoformat(g['weekend'])
        if fri.weekday() != 4:
            P.append('weekend must be the date of the weekend’s Friday')
    except ValueError:
        P.append('weekend must be a date, YYYY-MM-DD'); fri = None
    if g['id'] != f"{g['weekend']}-{g['city']}":
        P.append(f'id must be "{g["weekend"]}-{g["city"]}"')
    if os.path.basename(path) != f"{g['city']}.json" or os.path.basename(os.path.dirname(os.path.abspath(path))) != g['weekend']:
        P.append(f'the file must be travel/guides/{g["weekend"]}/{g["city"]}.json')
    if g['byline'] != 'Claude':
        P.append('byline must be "Claude"')
    if not re.fullmatch(r'Claude [A-Za-z]+ \d+(\.\d+)?', g['model']):
        P.append('model must be the exact model name, like "Claude Opus 5.5"')
    try:
        w = dt.datetime.fromisoformat(g['written'])
        if w.tzinfo is None:
            P.append('written needs a UTC offset, like 2026-10-26T06:40:00-04:00')
        elif abs((now - w).total_seconds()) > 36 * 3600 and '--any-date' not in sys.argv:
            P.append('written must be the actual time of writing (within the last day and a half)')
        elif fri and not (0 <= (fri - w.astimezone(ET).date()).days <= 13):
            P.append('a guide is written in the two weeks before its weekend')
    except ValueError:
        P.append('written must be an ISO date and time')
    if not 15 <= len(g['title']) <= 90:
        P.append('title should be 15 to 90 characters')
    if len(g['dek']) > 300:
        P.append('dek should be at most 300 characters')
    h = g['hero']
    if not isinstance(h, dict) or not h.get('wiki'):
        P.append('hero needs a wiki title (an English Wikipedia article with a good picture of the city)')
    if not 80 <= words(g['intro']) <= 350:
        P.append(f'intro is {words(g["intro"])} words; 80 to 350')
    days = g['days']
    if not isinstance(days, list) or len(days) != 3:
        P.append('days must be exactly three: Friday, Saturday, Sunday')
        days = days if isinstance(days, list) else []
    for i, d in enumerate(days):
        n = ('Friday', 'Saturday', 'Sunday')[i] if i < 3 else f'day {i + 1}'
        if fri and d.get('date') != (fri + dt.timedelta(days=i)).isoformat():
            P.append(f'{n}: date must be {(fri + dt.timedelta(days=i)).isoformat()}')
        if not d.get('title'):
            P.append(f'{n}: missing title')
        stops = d.get('stops') or []
        if not 4 <= len(stops) <= 7:
            P.append(f'{n}: {len(stops)} stops; 4 to 7')
        last = ''
        for j, s in enumerate(stops, 1):
            tag = f'{n} stop {j} ({s.get("name", "?")})'
            for k in ('time', 'kind', 'name', 'area', 'text'):
                if not s.get(k):
                    P.append(f'{tag}: missing {k}')
            t = s.get('time', '')
            if t and not re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d', t):
                P.append(f'{tag}: time must be 24-hour HH:MM')
            elif t and t < last and t >= '05:00':
                P.append(f'{tag}: stops must run in time order')
            last = max(last, t) if t >= '05:00' else last
            if s.get('kind') and s['kind'] not in KINDS:
                P.append(f'{tag}: kind must be one of {sorted(KINDS)}')
            if s.get('text') and not 25 <= words(s['text']) <= 180:
                P.append(f'{tag}: text is {words(s["text"])} words; 25 to 180')
            for k in ('url',):
                if s.get(k) and not URL.match(s[k]):
                    P.append(f'{tag}: {k} must be an http(s) address')
            b = s.get('book')
            if b and (not isinstance(b, dict) or not b.get('label') or not URL.match(b.get('url', ''))):
                P.append(f'{tag}: book needs a label and an http(s) url')
    stay = g['stay']
    if not isinstance(stay, list) or [x.get('tier') for x in stay] != TIERS:
        P.append('stay must be three hotels in this order of tier: splurge, classic, value')
    else:
        for x in stay:
            for k in ('name', 'area', 'text', 'price'):
                if not x.get(k):
                    P.append(f'stay {x["tier"]}: missing {k}')
            if x.get('price') and not re.fullmatch(r'\${1,4}', x['price']):
                P.append(f'stay {x["tier"]}: price is a tier, $ to $$$$, never a figure')
            if x.get('url') and not URL.match(x['url']):
                P.append(f'stay {x["tier"]}: url must be an http(s) address')
    ev = g['events']
    if not isinstance(ev, list) or not 2 <= len(ev) <= 8:
        P.append('events: list 2 to 8 things happening this weekend only')
    else:
        for e in ev:
            for k in ('name', 'date', 'when', 'where', 'text', 'url'):
                if not e.get(k):
                    P.append(f'event "{e.get("name", "?")}": missing {k}')
            try:
                d = dt.date.fromisoformat(e.get('date', ''))
                if fri and not -1 <= (d - fri).days <= 3:
                    P.append(f'event "{e.get("name")}": its date must fall between Thursday and Monday of that weekend')
            except ValueError:
                P.append(f'event "{e.get("name")}": date must be YYYY-MM-DD')
            if e.get('url') and not URL.match(e['url']):
                P.append(f'event "{e.get("name")}": url must be an http(s) address')
    know = g['know']
    if not isinstance(know, list) or not 3 <= len(know) <= 8:
        P.append('know: 3 to 8 practical tips')
    total = sum(words(t) for t in all_text(g))
    if not 1300 <= total <= 3000:
        P.append(f'the guide is {total} words; 1,300 to 3,000')
    for t in all_text(g):
        if re.search(r'<\s*/?\s*[a-zA-Z][^>]*>', t or ''):
            P.append('no HTML; use Markdown'); break
    for t in all_text(g):
        for q in re.findall(r'[“"]([^”"]{20,})[”"]', t or ''):
            if len(q.split()) > 25:
                P.append(f'a quotation runs {len(q.split())} words; quote under 25 words: “{q[:60]}…”')
    srcs = g['sources']
    if not isinstance(srcs, list) or len(srcs) < 6:
        P.append('list at least six sources')
    else:
        doms = set()
        for i, s in enumerate(srcs, 1):
            u = (s or {}).get('url', '')
            if not URL.match(u) or not (s or {}).get('title') or not (s or {}).get('outlet'):
                P.append(f'source {i} needs a title, an outlet and an http(s) url')
            else:
                doms.add(urllib.parse.urlsplit(u).hostname.replace('www.', ''))
        if len(doms) < 4:
            P.append('sources must come from at least four different sites')
    return P, g


def index():
    C = cities()
    weeks = {}
    if os.path.isdir(G):
        for wk in sorted(os.listdir(G)):
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', wk):
                continue
            for fn in sorted(os.listdir(os.path.join(G, wk))):
                if not fn.endswith('.json'):
                    continue
                try:
                    g = json.load(open(os.path.join(G, wk, fn), encoding='utf-8'))
                except (OSError, ValueError):
                    continue
                if g.get('city') not in C:
                    continue
                weeks.setdefault(wk, []).append({
                    'id': g['id'], 'city': g['city'], 'title': g['title'], 'dek': g['dek'], 'hero': g.get('hero', {}).get('wiki'),
                    'written': g['written'], 'model': g['model'], 'words': sum(words(t) for t in all_text(g)),
                    'stops': sum(len(d.get('stops') or []) for d in g.get('days') or []), 'events': len(g.get('events') or [])})
    order = list(C)
    out = [{'weekend': wk, 'guides': sorted(v, key=lambda r: order.index(r['city']))} for wk, v in sorted(weeks.items(), reverse=True)]
    os.makedirs(G, exist_ok=True)
    with open(os.path.join(G, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump({'v': 1, 'updated': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'weekends': out}, fh, ensure_ascii=False, indent=1)
    print(f"index: {sum(len(w['guides']) for w in out)} guides over {len(out)} weekend{'s' if len(out) != 1 else ''}")


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == 'check':
        bad = 0
        for p in sys.argv[2:]:
            if p.startswith('--'):
                continue
            problems, g = check(p)
            if problems:
                bad += 1
                print(f'NOT READY: {p}'); [print('  -', x) for x in problems]
            else:
                print(f"ok: {p}: “{g['title']}”, {sum(words(t) for t in all_text(g))} words, "
                      f"{sum(len(d['stops']) for d in g['days'])} stops, {len(g['events'])} events, {len(g['sources'])} sources, {g['model']}")
        return 1 if bad else 0
    if len(sys.argv) >= 2 and sys.argv[1] == 'index':
        index()
        return 0
    if len(sys.argv) >= 2 and sys.argv[1] == 'weekend':
        f = coming_friday()
        print(f.isoformat(), f'(Friday {f:%b %-d} to Sunday {f + dt.timedelta(days=2):%b %-d})')
        return 0
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main())
