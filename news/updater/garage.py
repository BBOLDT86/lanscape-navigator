#!/usr/bin/env python3
"""The Cars desk's garage: rebuild and auction-rescue projects, the collector-car auctions, and Tesla's FSD.

  python3 news/updater/garage.py              rebuild news/data/garage.json from the public feeds
  python3 news/updater/garage.py check FILE   exit 1 with the problems in a project file (news/garage/<id>.json)
  python3 news/updater/garage.py index        rebuild news/garage/index.json from the project files
  python3 news/updater/garage.py fsdcheck     exit 1 with the problems in news/data/fsd.json

news/data/garage.json (every edition):
  videos    the last 60 days of uploads from YouTube builders who buy wrecked, flooded, abandoned or auction cars and
            fix them (Copart and IAA salvage, insurance write-offs, barn finds), each checked against the channel's own
            name; Shorts are left out
  auction   collector-car auctions: sales in the news (Google News: Bring a Trailer, Cars & Bids), what's on the block
            at Bring a Trailer (its own RSS feed: the listing's title and link only; no prices, no pictures copied),
            Hagerty's market stories, and the Cars & Bids, Doug DeMuro and Hagerty channels
  fsd       news about Tesla's Full Self-Driving (Supervised): Google News plus Teslarati, Not a Tesla App and Electrek,
            kept to stories that are about FSD, Autopilot or robotaxis
A source that fails keeps its last good copy. Nothing is scraped: these are the feeds the sites publish.

The project files (news/garage/<id>.json) and news/data/fsd.json are written by a weekly scheduled Claude task;
`check` and `fsdcheck` print the format and enforce it. Standard library only.
"""
import concurrent.futures as cf
import datetime as dt
import glob
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import run  # noqa: E402  the edition's feed reader

D = os.path.normpath(os.path.join(HERE, '..', 'data'))
G = os.path.normpath(os.path.join(HERE, '..', 'garage'))
OUT = os.path.join(D, 'garage.json')
FSD = os.path.join(D, 'fsd.json')
NOW = dt.datetime.now(dt.timezone.utc)
UA = run.UA['User-Agent']
NS = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015', 'm': 'http://search.yahoo.com/mrss/'}
errors = []

# (channel id, a word its feed name must contain, the name to show, the @handle, what they do)
BUILDERS = [
    ('UCwO_xoYm2vjhu4kZSxFO5mA', 'goonzquad', 'Goonzquad', 'Goonzquad', 'Salvage-auction supercars and trucks, rebuilt in Ohio'),
    ('UCvAhDxNNUDhi78tMXVGBUaQ', 'tavarish', 'Tavarish', 'Tavarish', 'Wrecked and "unfixable" exotics, rebuilt'),
    ('UCfV0_wbjG8KJADuZT2ct4SA', 'rich rebuilds', 'Rich Rebuilds', 'RichRebuilds', 'Salvage EVs and the cars makers would rather you not fix'),
    ('UCcLYOTz3ct6_lk9iLToxxAw', 'mat armstrong', 'Mat Armstrong', 'MatArmstrongbmx', 'Insurance write-offs rebuilt in England'),
    ('UCdEczn3MVkx_4PnMZ10MVFA', 'hoovies', 'Hoovies Garage', 'HooviesGarage', 'Cheap used luxury cars, bought and fixed (or not)'),
    ('UCkISS_tBN0qUaeDsq3Vnuwg', 'niko', 'Niko Brothers', 'NikoBrothers', 'Copart RVs and trucks, bought sight unseen'),
    ('UCv9MXMRQtoNZdRqPZWX7Pdw', 'saving salvage', 'Saving Salvage', 'SavingSalvage', 'Crashed new cars, rebuilt'),
    ('UCVXw4kKWJN3qu98MkhhsvNw', 'salvage nation', 'Salvage Nation', 'SalvageNation', 'Neglected and crashed cars brought back'),
    ('UChbK30ajg54LKQ2IINIfzfg', 'salvage rebuilds', 'Salvage Rebuilds', 'SalvageRebuilds', 'Abandoned and barn-find cars restored'),
    ('UCvv2vYEtk7VSR5iE30WsNbQ', 'watchjrgo', 'WatchJRGo', 'WatchJRGo', 'Abandoned cars bought cheap and made to run'),
    ('UC21Kozr_K0yDM-VjoihG9Aw', 'stradman', 'TheStradman', 'TheStradman', 'Supercars, including written-off ones, rebuilt and modified'),
    ('UCtn2hU9HKYQAgDtwrhux7Sw', 'samcrac', 'Samcrac', 'samcrac', 'Cheap high-end cars and what they really cost to fix'),
    ('UCsfu-jdkX2_v2t3_igVQebg', 'vice grip', 'Vice Grip Garage', 'ViceGripGarage', 'Abandoned cars, woken up and driven home'),
    ('UCS87-wYrvmexsLkBj0jhrnQ', 'junkyard digs', 'Junkyard Digs', 'JunkyardDigs', 'Junkyard and field cars: will it run?'),
    ('UCl4-WBRqWA2MlxmZorKOV7w', 'b is for build', 'B is for Build', 'BisforBuild', 'Builds from wrecks and oddities'),
    ('UCdqp0KK_Io7TwK5cJMBvB0Q', 'whistlindiesel', 'WhistlinDiesel', 'WhistlinDiesel', 'Auction trucks and cheap-machine challenges'),
    ('UCZ-82C3qScUperUfu2mXU-g', 'ed bolian', 'Ed Bolian', 'EdBolian', 'A supercar dealer on what cars really sell for'),
]
AUCTION_CH = [
    ('UCG72WbiCvdB6JKU-3YRP8Kg', 'cars & bids', 'Cars & Bids', 'CarsandBids', 'The Cars & Bids auction house'),
    ('UCsqjHFMB_JYTaEnf_vmTNqg', 'doug demuro', 'Doug DeMuro', 'DougDeMuro', 'The founder of Cars & Bids, on cars'),
    ('UCLgEVx4mzk3T3mzgbKG54Eg', 'hagerty', 'Hagerty', 'Hagerty', 'The collector-car insurer and price guide'),
]
GN = 'https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q='
SALES = [GN + urllib.request.quote('"Bring a Trailer" OR "Cars & Bids" OR "Cars and Bids" sold OR auction when:14d'),
         GN + urllib.request.quote('collector car auction "sold for" OR record when:7d')]
BAT = 'https://bringatrailer.com/feed/'
HAGERTY = 'https://www.hagerty.com/media/feed/'
FSD_FEEDS = [GN + urllib.request.quote('Tesla FSD OR "Full Self-Driving" OR robotaxi when:4d'), 'https://www.teslarati.com/feed/',
             'https://www.notateslaapp.com/rss', 'https://electrek.co/feed/']
FSD_RX = re.compile(r'\bFSD\b|full self[- ]driving|autopilot|robotaxi|cybercab|\bHW ?[34]\b|\bAI[456]\b|unsupervised|self-driving', re.I)
MARKET_RX = re.compile(r'\bsold\b|auction|\bbid|market|valuation|price guide|record|values?\b|appreciat|depreciat|bring a trailer|cars ?(&|and) ?bids|mecum|barrett|rm sotheby|bonhams|gooding', re.I)


def get(url, timeout=12, accept='*/*'):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': accept, 'Accept-Language': 'en-US,en;q=0.9'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def channel(cid, expect, name, handle, about, days=60):
    urls = [f'https://www.youtube.com/feeds/videos.xml?channel_id={cid}', f'https://www.youtube.com/feeds/videos.xml?playlist_id=UU{cid[2:]}']
    raw = None
    for k, url in enumerate(urls):
        try:
            raw = get(url, accept='application/atom+xml,application/xml')
            break
        except urllib.error.HTTPError as ex:
            if ex.code not in (404, 429, 500, 502, 503) or k == len(urls) - 1:
                raise
            time.sleep(2)
    root = ET.fromstring(raw)
    feed_name = (root.findtext('a:author/a:name', default='', namespaces=NS) or root.findtext('a:title', default='', namespaces=NS) or '').strip()
    if expect not in feed_name.lower():
        raise ValueError(f'channel is "{feed_name}", expected {expect}')
    out = []
    for e in root.findall('a:entry', NS):
        vid = e.findtext('yt:videoId', default='', namespaces=NS)
        title = run.clean(e.findtext('a:title', default='', namespaces=NS) or '')
        try:
            when = dt.datetime.fromisoformat((e.findtext('a:published', default='', namespaces=NS) or '').replace('Z', '+00:00'))
        except ValueError:
            continue
        link = e.find('a:link', NS)
        href = link.get('href') if link is not None else ''
        if not vid or not title or (NOW - when).days > days or '/shorts/' in href or re.search(r'#shorts?\b', title, re.I):
            continue
        g = e.find('m:group', NS)
        desc = (g.findtext('m:description', default='', namespaces=NS) if g is not None else '') or ''
        views = None
        if g is not None:
            st = g.find('m:community/m:statistics', NS)
            if st is not None and (st.get('views') or '').isdigit():
                views = int(st.get('views'))
        d1 = re.split(r'\n\s*\n|#\w+|Subscribe|SUBSCRIBE|Follow us|Check out|Use code|Sponsored', re.sub(r'https?://\S+', '', desc))[0]
        out.append({'v': vid, 't': title, 'ch': name, 'cid': cid, 'p': when.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'd': run.WS.sub(' ', d1).strip()[:240], 'views': views})
    return out


def channels(lst, per, days=60):
    got, failed = [], []
    with cf.ThreadPoolExecutor(6) as pool:
        futs = {pool.submit(channel, *c, days=days): c for c in lst}
        for f in cf.as_completed(futs):
            c = futs[f]
            try:
                got += sorted(f.result(), key=lambda v: v['p'], reverse=True)[:per]
            except Exception as ex:  # noqa: BLE001
                failed.append(c[2]); errors.append(f'{c[2]}: {type(ex).__name__} {str(ex)[:80]}')
    return sorted(got, key=lambda v: v['p'], reverse=True), failed


def stories(urls, keep=None, days=14, n=30, outlet=None):
    """Headlines from feeds: title, link, outlet, time. Google News titles lose their ' - Outlet' tail."""
    out, seen, bad = [], set(), []
    for u in urls:
        name, items, err = run.read_feed({'name': u, 'url': u})
        if err:
            bad.append(err); errors.append(f'{u[:60]}: {err}')
            continue
        for it in items:
            t, link, when = it['title'], it['link'], it['when']
            if not t or not link or not when or (NOW - when).days > days:
                continue
            o = it['src_name'] or outlet or run.norm_domain(link)
            if it['google'] and it['src_name'] and t.endswith(' - ' + it['src_name']):
                t = t[: -len(it['src_name']) - 3].strip()
            text = t + ' ' + run.clean(re.sub(r'<[^>]+>', ' ', it['desc'] or ''))[:400]
            if keep and not keep.search(text):
                continue
            key = re.sub(r'\W+', ' ', t.lower()).strip()[:70]
            if key in seen:
                continue
            seen.add(key)
            out.append({'t': t, 'u': link, 'o': o if not it['google'] or it['src_name'] else 'Google News', 'p': when.strftime('%Y-%m-%dT%H:%M:%SZ')})
    out.sort(key=lambda x: x['p'], reverse=True)
    if not out and bad:
        raise RuntimeError('; '.join(bad)[:200])
    return out[:n]


def block(old, name, fn):
    try:
        v = fn()
        print(f'{name}: {len(v) if isinstance(v, list) else "ok"}')
        return v
    except Exception as ex:  # noqa: BLE001
        errors.append(f'{name}: {type(ex).__name__} {str(ex)[:100]}')
        print(f'{name}: failed ({ex}); kept the last good copy')
        return old


def build():
    try:
        old = json.load(open(OUT, encoding='utf-8'))
    except (OSError, ValueError):
        old = {}
    oa, of = old.get('auction') or {}, old.get('fsd') or {}
    vids, failed = channels(BUILDERS, per=5)
    if len(failed) > len(BUILDERS) // 2 and old.get('videos'):
        vids = old['videos']
    avids, afailed = channels(AUCTION_CH, per=4, days=30)
    out = {
        'v': 1, 'at': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'builders': {c[0]: {'n': c[2], 'h': c[3], 'about': c[4]} for c in BUILDERS + AUCTION_CH},
        'videos': vids,
        'auction': {
            'sales': block(oa.get('sales'), 'sales in the news', lambda: stories(SALES, days=14, n=24)),
            'block': block(oa.get('block'), 'on the block at BaT', lambda: [{'t': x['t'], 'u': x['u'], 'p': x['p']} for x in stories([BAT], days=10, n=24, outlet='Bring a Trailer')
                                                                         if 'bringatrailer.com/listing/' in x['u']]),
            'hagerty': block(oa.get('hagerty'), 'Hagerty market', lambda: stories([HAGERTY], keep=MARKET_RX, days=21, n=12, outlet='Hagerty')),
            'videos': avids or oa.get('videos') or [],
        },
        'fsd': {'news': block(of.get('news'), 'FSD news', lambda: stories(FSD_FEEDS, keep=FSD_RX, days=10, n=40))},
        'failed': failed + afailed,
        'errors': errors[:30],
    }
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'garage: {len(vids)} build videos from {len(BUILDERS) - len(failed)} of {len(BUILDERS)} channels')
    return 0


# ------------------------------------------------------------------ the project files
PROJECT = """news/garage/<id>.json, one rebuild project:
  {"id": "goonzquad-zr1", "updated": "2026-10-29T08:00:00-04:00", "model": "Claude Opus 5.5",
   "title": "...", "dek": "one sentence",
   "car": {"year": 2025, "make": "Chevrolet", "model": "Corvette ZR1", "trim": "optional", "wiki": "optional English Wikipedia title"},
   "builder": {"name": "Goonzquad", "channel": "UC... (the channel id)", "url": "https://www.youtube.com/@Goonzquad"},
   "status": "in progress | finished | for sale | sold | abandoned",
   "source": {"kind": "salvage auction | insurance auction | abandoned | barn find | dealer | private sale | auction | other",
              "where": "Copart, Dallas (as said in the video)", "bought": 41000 or null, "boughtNote": "how we know",
              "title": "salvage | rebuilt | clean | unknown", "damage": "what was wrong with it"},
   "episodes": [{"v": "11-character YouTube id", "t": "the video's title", "date": "2026-10-09", "what": "one sentence: what happened"}],
   "parts": [{"part": "...", "why": "...", "cost": 2400 or null, "basis": "stated | estimate | listed"}],
   "time": "how long it has taken: weeks, episodes, shop hours where said",
   "costs": {"bought": 41000, "parts": 23000, "labor": 0, "other": 0, "total": 64000, "note": "what's counted; which numbers are estimates"},
   "value": {"low": 70000, "high": 90000, "basis": "how the range was reached",
             "comps": [{"what": "2025 Corvette ZR1, 900 miles, clean title", "price": 135000, "where": "Bring a Trailer | Cars & Bids | dealer | Hagerty", "date": "2026-09", "url": "https://..."}]},
   "verdict": "Markdown, 40 to 160 words: did it pay, and what it shows",
   "body": "Markdown, 450 to 1,300 words, ## headings, cited with [n] for sources[n-1]",
   "sources": [{"title", "outlet", "url", "date"}],
   "i18n": {"pt": {"title", "dek"}, "de": {"title", "dek"}}}
Prices are U.S. dollars as numbers (convert pounds or euros and say so in basis or note). A price someone says in a
video is "stated"; your own reckoning is an "estimate". At least 4 parts, 2 comparable sales with links, 3 sources.
No quotation longer than 25 words. Builders are named; private people who sold or crashed the car are not."""
STATUS = {'in progress', 'finished', 'for sale', 'sold', 'abandoned'}
KINDS = {'salvage auction', 'insurance auction', 'abandoned', 'barn find', 'dealer', 'private sale', 'auction', 'other'}
TITLES = {'salvage', 'rebuilt', 'clean', 'unknown'}
WORD = re.compile(r"[^\W_][\w’'.,%$-]*")


def words(s):
    return len(WORD.findall(s or ''))


def long_quote(s):
    for q in re.findall(r'[“"]([^”"]{1,2000})[”"]', s or ''):
        if words(q) > 25:
            return q[:60]
    return None


def check_project(path):
    P = []
    try:
        d = json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError) as ex:
        return [f'not readable JSON: {ex}'], None
    need = ('id', 'updated', 'model', 'title', 'dek', 'car', 'builder', 'status', 'source', 'episodes', 'parts', 'time', 'costs', 'value', 'verdict', 'body', 'sources')
    for k in need:
        if d.get(k) in (None, '', [], {}):
            P.append(f'missing {k}')
    if P:
        return P, d
    if os.path.basename(path) != d['id'] + '.json':
        P.append('the file name must be <id>.json')
    if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', d['id']):
        P.append('id is lowercase words joined by hyphens')
    if not re.fullmatch(r'Claude [A-Za-z]+ \d+(\.\d+)?', d['model']):
        P.append('model must be the exact model name, like "Claude Opus 5.5"')
    try:
        if dt.datetime.fromisoformat(d['updated']).tzinfo is None:
            P.append('updated needs a UTC offset')
    except ValueError:
        P.append('updated must be an ISO date and time')
    c = d['car']
    if not isinstance(c.get('year'), int) or not 1900 <= c['year'] <= NOW.year + 2 or not c.get('make') or not c.get('model'):
        P.append('car needs year (a number), make and model')
    b = d['builder']
    if not b.get('name') or not re.fullmatch(r'UC[\w-]{22}', b.get('channel') or '') or not re.match(r'^https://(www\.)?youtube\.com/', b.get('url') or ''):
        P.append('builder needs name, channel (UC... id) and a youtube.com url')
    if d['status'] not in STATUS:
        P.append(f'status is one of {sorted(STATUS)}')
    s = d['source']
    if s.get('kind') not in KINDS:
        P.append(f'source.kind is one of {sorted(KINDS)}')
    if s.get('title') not in TITLES:
        P.append(f'source.title is one of {sorted(TITLES)}')
    if not s.get('damage') or not s.get('where'):
        P.append('source needs where and damage')
    if s.get('bought') is not None and not isinstance(s['bought'], (int, float)):
        P.append('source.bought is a number of dollars or null')
    if s.get('bought') is not None and not s.get('boughtNote'):
        P.append('source.boughtNote: say how the price is known')
    for e in d['episodes']:
        if not re.fullmatch(r'[\w-]{11}', e.get('v') or '') or not e.get('t') or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', e.get('date') or '') or not e.get('what'):
            P.append(f'episode {e.get("v")}: needs v (11-character id), t, date (YYYY-MM-DD) and what')
    if len(d['parts']) < 4:
        P.append('list at least 4 parts')
    for p in d['parts']:
        if not p.get('part') or not p.get('why') or p.get('basis') not in ('stated', 'estimate', 'listed') or not (p.get('cost') is None or isinstance(p['cost'], (int, float))):
            P.append(f'part {p.get("part")}: needs part, why, cost (number or null) and basis (stated, estimate or listed)')
    co = d['costs']
    for k in ('bought', 'parts', 'labor', 'other', 'total'):
        if co.get(k) is not None and not isinstance(co[k], (int, float)):
            P.append(f'costs.{k} is a number or null')
    if not co.get('note'):
        P.append('costs.note: say what is counted and what is estimated')
    v = d['value']
    if not all(isinstance(v.get(k), (int, float)) for k in ('low', 'high')) or v['low'] > v['high'] or v['low'] <= 0:
        P.append('value needs low <= high, in dollars')
    if not v.get('basis'):
        P.append('value.basis: how the range was reached')
    comps = v.get('comps') or []
    if len(comps) < 2:
        P.append('value needs at least 2 comparable sales')
    for x in comps:
        if not x.get('what') or not isinstance(x.get('price'), (int, float)) or not x.get('where') or not re.match(r'^https?://', x.get('url') or ''):
            P.append(f'comp {x.get("what")}: needs what, price (number), where and url')
    if not 40 <= words(d['verdict']) <= 160:
        P.append(f'verdict is {words(d["verdict"])} words; 40 to 160')
    n = words(d['body'])
    if not 450 <= n <= 1300:
        P.append(f'body is {n} words; 450 to 1,300')
    if re.search(r'<[a-z][^>]*>', d['body'] + d['verdict'], re.I):
        P.append('no HTML; Markdown only')
    if len(d['sources']) < 3:
        P.append('at least 3 sources')
    for x in d['sources']:
        if not re.match(r'^https?://', x.get('url') or '') or not x.get('title') or not x.get('outlet'):
            P.append('each source needs a title, an outlet and an http(s) url')
    for m in re.findall(r'\[(\d+)\]', d['body'] + d['verdict']):
        if not 1 <= int(m) <= len(d['sources']):
            P.append(f'[{m}] points past the sources'); break
    q = long_quote(d['body'] + ' ' + d['verdict'])
    if q:
        P.append(f'quotation over 25 words: "{q}…"')
    for lang in ('pt', 'de'):
        t = (d.get('i18n') or {}).get(lang) or {}
        if not t.get('title') or not t.get('dek'):
            P.append(f'i18n.{lang} needs title and dek')
    return P, d


def index():
    rows = []
    for p in sorted(glob.glob(os.path.join(G, '*.json'))):
        if os.path.basename(p) == 'index.json':
            continue
        probs, d = check_project(p)
        if probs:
            print(f'skipped {os.path.basename(p)}: {probs[0]}')
            continue
        last = max((e['date'] for e in d['episodes']), default='')
        thumb = sorted(d['episodes'], key=lambda e: e['date'])[-1]['v']
        rows.append({'id': d['id'], 'title': d['title'], 'dek': d['dek'], 'car': d['car'], 'builder': d['builder']['name'], 'status': d['status'],
                     'kind': d['source']['kind'], 'bought': d['source'].get('bought'), 'total': d['costs'].get('total'),
                     'value': [d['value']['low'], d['value']['high']], 'updated': d['updated'], 'last': last, 'thumb': thumb,
                     'n': len(d['episodes']), 'i18n': {k: {'title': v['title'], 'dek': v['dek']} for k, v in (d.get('i18n') or {}).items()}})
    rows.sort(key=lambda r: (r['last'], r['updated']), reverse=True)
    with open(os.path.join(G, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump({'v': 1, 'at': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'projects': rows}, fh, ensure_ascii=False, indent=1)
    print(f'index: {len(rows)} projects')
    return 0


# ------------------------------------------------------------------ the FSD file
FSD_FMT = """news/data/fsd.json, Tesla's Full Self-Driving (Supervised) this week:
  {"updated": "2026-10-29T08:00:00-04:00", "model": "Claude Opus 5.5",
   "summary": "Markdown, 100 to 320 words: where FSD stands this week, cited [n]",
   "price": {"subscription": "$99 a month in the U.S.", "purchase": "how buying it outright works now, or that it can't be",
             "note": "what changes for a used car: does FSD bought by an earlier owner stay with the car?"},
   "versions": [{"hw": "AI4", "version": "v14.2", "build": "2026.38.5", "date": "2026-10", "note": "..."}],
   "hardware": [{"model": "Model 3 | Model Y | Model S | Model X | Cybertruck", "from": 2019, "to": 2023, "hw": "HW3 | AI4 | HW2.5 | HW2 | AI5",
                 "fsd": "what FSD it can run now", "note": "how to tell, the exceptions"}],
   "check": ["how to tell which computer a car has"],
   "transfer": "Markdown, 30 to 160 words: transferring FSD to a new car, or with a car you sell",
   "where": ["countries where FSD (Supervised) is offered"],
   "robotaxi": [{"place": "Austin", "status": "what's running, with or without a safety monitor", "since": "2025-06"}],
   "buying": ["short tips for buying a used Tesla for FSD"],
   "changes": ["short lines: what changed this week"],
   "sources": [{"title", "outlet", "url", "date"}],
   "i18n": {"pt": {"summary"}, "de": {"summary"}}}
"to" is null for cars still being built. Rows cover every model and year from 2016 to now. Every claim is cited."""
HWS = {'HW2', 'HW2.5', 'HW3', 'AI4', 'AI5'}
MODELS = {'Model S', 'Model 3', 'Model X', 'Model Y', 'Cybertruck'}


def check_fsd():
    P = []
    try:
        d = json.load(open(FSD, encoding='utf-8'))
    except (OSError, ValueError) as ex:
        return [f'not readable JSON: {ex}'], None
    for k in ('updated', 'model', 'summary', 'price', 'versions', 'hardware', 'check', 'transfer', 'where', 'buying', 'sources'):
        if d.get(k) in (None, '', [], {}):
            P.append(f'missing {k}')
    if P:
        return P, d
    if not re.fullmatch(r'Claude [A-Za-z]+ \d+(\.\d+)?', d['model']):
        P.append('model must be the exact model name')
    try:
        if dt.datetime.fromisoformat(d['updated']).tzinfo is None:
            P.append('updated needs a UTC offset')
    except ValueError:
        P.append('updated must be an ISO date and time')
    if not 100 <= words(d['summary']) <= 320:
        P.append(f'summary is {words(d["summary"])} words; 100 to 320')
    if not 30 <= words(d['transfer']) <= 160:
        P.append(f'transfer is {words(d["transfer"])} words; 30 to 160')
    for k in ('subscription', 'purchase', 'note'):
        if not d['price'].get(k):
            P.append(f'price.{k} missing')
    for v in d['versions']:
        if v.get('hw') not in HWS or not v.get('version'):
            P.append(f'versions: each needs hw (one of {sorted(HWS)}) and version')
    seen = {m: set() for m in MODELS}
    for h in d['hardware']:
        if h.get('model') not in MODELS or h.get('hw') not in HWS or not isinstance(h.get('from'), int) or not (h.get('to') is None or isinstance(h['to'], int)) or not h.get('fsd'):
            P.append(f'hardware row {h}: needs model, hw, from (year), to (year or null) and fsd'[:200])
            continue
        seen[h['model']].update(range(h['from'], (h['to'] or NOW.year) + 1))
    for m, ys in seen.items():
        if not ys:
            P.append(f'hardware: no rows for {m}')
    if 'Model 3' in seen and not set(range(2019, NOW.year + 1)) <= seen['Model 3']:
        P.append('hardware: Model 3 years have gaps')
    if 'Model Y' in seen and not set(range(2020, NOW.year + 1)) <= seen['Model Y']:
        P.append('hardware: Model Y years have gaps')
    if len(d['sources']) < 4:
        P.append('at least 4 sources')
    for x in d['sources']:
        if not re.match(r'^https?://', x.get('url') or '') or not x.get('title') or not x.get('outlet'):
            P.append('each source needs a title, an outlet and an http(s) url')
    for m in re.findall(r'\[(\d+)\]', d['summary'] + d['transfer']):
        if not 1 <= int(m) <= len(d['sources']):
            P.append(f'[{m}] points past the sources'); break
    q = long_quote(d['summary'] + ' ' + d['transfer'])
    if q:
        P.append(f'quotation over 25 words: "{q}…"')
    for lang in ('pt', 'de'):
        if not ((d.get('i18n') or {}).get(lang) or {}).get('summary'):
            P.append(f'i18n.{lang}.summary missing')
    return P, d


def main():
    a = sys.argv[1:]
    if a and a[0] == 'check':
        if len(a) < 2:
            print(PROJECT); return 2
        bad = 0
        for p in a[1:]:
            probs, _ = check_project(p)
            if probs:
                bad = 1; print(f'{p}: NOT READY'); [print('  -', x) for x in probs[:40]]
            else:
                print(f'{p}: ok')
        return bad
    if a and a[0] == 'index':
        return index()
    if a and a[0] == 'fsdcheck':
        probs, d = check_fsd()
        if probs:
            print('NOT READY:'); [print('  -', x) for x in probs[:40]]; return 1
        print(f"ok: fsd.json, {len(d['hardware'])} hardware rows, updated {d['updated']} by {d['model']}")
        return 0
    if a and a[0] in ('-h', '--help', 'format'):
        print(__doc__); print(PROJECT); print(FSD_FMT); return 0
    return build()


if __name__ == '__main__':
    sys.exit(main())
