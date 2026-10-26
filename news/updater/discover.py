#!/usr/bin/env python3
"""Discover on The Watch: culture, books, magazines, podcasts, creators and shopping (#/discover).

  python3 news/updater/discover.py             rebuild news/data/discover.json from the guide and the live sources
  python3 news/updater/discover.py check       exit 1 with the problems in news/discover/guide.json
  python3 news/updater/discover.py format      print the guide's format

Where things live:
  the guide     news/discover/guide.json, curated by Claude: the podcast directory (name, Apple id, category, host, a
                line), the Newsstand (magazine titles with their feeds), the creators (YouTube channel, newsletter feed,
                social handles), the culture channels and lenses, the awards calendar, the book sources and shops, the
                shopping wire and the retail calendar
  the data      news/data/discover.json, rebuilt on every news run:
                  charts      Apple's top podcasts (U.S., Brazil, Germany), top books (paid and free) and most-played
                              albums and songs, from Apple's public marketing feeds
                  podcasts    each show resolved against Apple's lookup service (the id is checked against the show's
                              name; a show without one is looked up by name) and its newest episodes read from its
                              own RSS feed: title, date, audio URL, length, a short description
                  magazines   each title's newest pieces from its feed (or a Google News search of its site)
                  creators    the last five weeks of each channel's uploads (the feed's own name is checked against
                              the one expected; Shorts left out) and each newsletter's latest posts, plus the
                              creator-economy wire
                  culture     trailers and sessions from the studios' and venues' channels, the week's releases, and
                              the edition's culture stories sorted into lenses (the page does the sorting)
                  books       the review wire, prize and new-release news, Open Library's trending titles and
                              Project Gutenberg's most-downloaded classics
                  shopping    the guides, deals and trend wire
                A block that fails keeps its last good copy and is listed in `errors`.
Every source is public and keyless. Nothing is scraped from a web page: feeds, JSON services and Google News only.
Standard library only.
"""
import concurrent.futures as cf
import datetime as dt
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import run  # noqa: E402  the edition's feed reader and helpers
import garage  # noqa: E402  its YouTube reader and headline helper

N = os.path.normpath(os.path.join(HERE, '..'))
GUIDE = os.path.join(N, 'discover', 'guide.json')
OUT = os.path.join(N, 'data', 'discover.json')
NOW = dt.datetime.now(dt.timezone.utc)
STAMP = NOW.strftime('%Y-%m-%dT%H:%M:%SZ')
FULL = os.environ.get('DISCOVER_FULL') == '1'  # resolve every show by name if need be (the first run; slow)
SEARCH_CAP = 400 if FULL else 40  # name lookups a run (Apple allows about 20 a minute)
APPLE = 'https://itunes.apple.com/'
CHARTS = 'https://rss.marketingtools.apple.com/api/v2/'
errors = []

# Outlets allowed through a Google News search besides the edition's own list (run.OUTLETS) and a feed's own domain.
ALLOW = {'variety.com', 'hollywoodreporter.com', 'deadline.com', 'indiewire.com', 'vulture.com', 'rollingstone.com', 'pitchfork.com',
         'billboard.com', 'stereogum.com', 'consequence.net', 'avclub.com', 'polygon.com', 'ign.com', 'kotaku.com', 'gamespot.com',
         'eurogamer.net', 'thewrap.com', 'ew.com', 'people.com', 'collider.com', 'slashfilm.com', 'theplaylist.net', 'playbill.com',
         'broadwayworld.com', 'artnews.com', 'artnet.com', 'hyperallergic.com', 'theartnewspaper.com', 'dezeen.com', 'lithub.com',
         'kirkusreviews.com', 'publishersweekly.com', 'bookriot.com', 'tubefilter.com', 'passionfru.it', 'digiday.com', 'businessinsider.com',
         'theverge.com', 'engadget.com', 'cnet.com', 'tomsguide.com', 'gearpatrol.com', 'uncrate.com', 'hodinkee.com', 'gq.com', 'esquire.com',
         'nymag.com', 'vogue.com', 'goodhousekeeping.com', 'consumerreports.org', 'modernretail.co', 'retaildive.com', 'wsj.com', 'nytimes.com',
         'washingtonpost.com', 'theguardian.com', 'bbc.com', 'bbc.co.uk', 'npr.org', 'latimes.com', 'time.com', 'theatlantic.com', 'newyorker.com',
         'economist.com', 'bloomberg.com', 'cnbc.com', 'cnn.com', 'reuters.com', 'apnews.com', 'usatoday.com', 'forbes.com', 'fastcompany.com',
         'wired.com', 'techcrunch.com', 'axios.com', 'semafor.com', 'puck.news', 'theringer.com', 'slate.com', 'vox.com', 'mashable.com',
         'eater.com', 'bonappetit.com', 'foodandwine.com', 'seriouseats.com', 'rogerebert.com', 'empireonline.com', 'nme.com', 'thefader.com',
         'theatlantic.com', 'newrepublic.com', 'thenation.com', 'nationalreview.com', 'texasmonthly.com', 'latimes.com', 'sfchronicle.com',
         'chicagotribune.com', 'bostonglobe.com', 'ft.com', 'telegraph.co.uk', 'independent.co.uk', 'thetimes.com', 'thetimes.co.uk',
         'standard.co.uk', 'timeout.com', 'today.com', 'cbsnews.com', 'nbcnews.com', 'abcnews.go.com', 'foxnews.com', 'hollywoodreporter.com',
         'tvline.com', 'tvinsider.com', 'decider.com', 'whattowatch.com', 'metacritic.com', 'rottentomatoes.com', 'nationalgeographic.com',
         'smithsonianmag.com', 'architecturaldigest.com', 'elle.com', 'harpersbazaar.com', 'thecut.com', 'wmagazine.com', 'wwd.com',
         'businessoffashion.com', 'highsnobiety.com', 'hypebeast.com', 'complex.com', 'gamesindustry.biz', 'gamesradar.com', 'pcgamer.com',
         'thestreet.com', 'marketwatch.com', 'barrons.com', 'kiplinger.com', 'money.com', 'nerdwallet.com', 'bankrate.com', 'cnbc.com',
         'yahoo.com', 'finance.yahoo.com', 'the-independent.com', 'dailymail.co.uk', 'nypost.com', 'pagesix.com', 'tmz.com', 'etonline.com',
         'eonline.com', 'usmagazine.com', 'glamour.com', 'allure.com', 'refinery29.com', 'bustle.com', 'teenvogue.com', 'nylon.com',
         'dazeddigital.com', 'i-d.co', 'theface.com', 'okayplayer.com', 'thesource.com', 'xxlmag.com', 'hotnewhiphop.com', 'rap-up.com',
         'brooklynvegan.com', 'spin.com', 'uproxx.com', 'paste.com', 'pastemagazine.com', 'theringer.com', 'defector.com', 'si.com',
         'espn.com', 'theathletic.com', 'kirkusreviews.com', 'bookpage.com', 'shelf-awareness.com', 'thebookseller.com', 'poetryfoundation.org',
         'newcriterion.com', 'monocle.com', 'dwell.com', 'kinfolk.com', 'afar.com', 'travelandleisure.com', 'cntraveler.com', 'motortrend.com',
         'golfdigest.com', 'americastestkitchen.com', 'cardplayer.com', 'pokernews.com', 'chronofhorse.com', 'horseandhound.co.uk'}
OK_DOMAINS = set(run.OUTLETS) | ALLOW

FORMAT = """news/discover/guide.json
{"v": 1, "updated": "...", "model": "...",
 "podcasts": {"categories": [{"key", "name", "dek"}],
              "shows": [{"key": "the-daily", "name": "The Daily", "apple": 1200361736 or null, "cat": "news", "host": "...", "about": "one line"}]},
 "magazines": {"categories": [{"key", "name"}],
               "titles": [{"key", "name", "site": "https://...", "feed": "https://... (an RSS feed or a Google News site search)", "cat",
                           "since": 1925, "cadence": "Weekly", "about": "one line", "mark": "the letters on its tile", "color": "#rrggbb"}]},
 "creators": {"categories": [{"key", "name", "dek"}],
              "people": [{"key", "name", "cat", "about",
                          "yt": {"id": "UC...", "expect": "a word the channel's feed name contains, lowercase", "handle": "..."} or null,
                          "feed": "https://... their newsletter or blog feed" or null,
                          "links": {"ig": "handle", "tt": "handle", "x": "handle", "site": "https://..."}}],
              "wire": [{"name", "url", "domain"?}]},
 "culture": {"channels": [{"id", "expect", "name", "handle", "about", "kind": "screen|sound|stage|art|style"}],
             "lenses": [{"key", "name", "test": "a regular expression on a story's title and summary"}],
             "releases": [{"key", "name", "q": "a Google News query", "days": 5}],
             "calendar": [{"name", "start": "YYYY-MM-DD", "end", "place", "url", "what", "source", "kind": "awards|festival"}]},
 "books": {"feeds": [{"name", "url", "kind": "reviews|industry|lists|essays", "domain"}],
           "news": [{"key", "name", "q"}], "shops": [{"key", "name", "url with {q}", "why"}]},
 "shopping": {"feeds": [{"name", "url", "kind": "guides|deals|gear|trends", "domain"?}],
              "calendar": [{"name", "date": "YYYY-MM-DD", "what"}]}}
Every key is unique within its list; every YouTube id is unique across the file; every URL is https."""


# ------------------------------------------------------------------ small helpers
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
    return s.scheme in ('https', 'http') and '.' in (s.hostname or '')


def get(url, timeout=14, accept='*/*', limit=0):
    req = urllib.request.Request(url, headers={'User-Agent': garage.UA, 'Accept': accept, 'Accept-Language': 'en-US,en;q=0.9'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(limit) if limit else r.read()


def get_json(url, timeout=14):
    return json.loads(get(url, timeout=timeout, accept='application/json').decode('utf-8', 'replace'))


def strip_html(s, n=200):
    s = html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))
    s = run.clean(s)
    if len(s) > n:
        s = s[:n].rsplit(' ', 1)[0].rstrip(',;:—-') + '…'
    return s


def norm_name(s):
    s = (s or '').lower()
    s = re.sub(r'\(.*?\)|\[.*?\]|\b(podcast|the|a|an|with|w/|show|official)\b', ' ', s)
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return ' '.join(s.split())


def same_show(a, b):
    """Two names are the same show when the shorter's words are nearly all in the longer's."""
    x, y = norm_name(a).split(), norm_name(b).split()
    if not x or not y:
        return False
    short, long_ = (x, y) if len(x) <= len(y) else (y, x)
    hit = sum(1 for w in short if w in long_)
    return hit >= max(1, len(short) - (1 if len(short) > 3 else 0))


def iso(d):
    return d.strftime('%Y-%m-%dT%H:%M:%SZ') if d else None


def block(old, name, fn, *a, **k):
    """Run a block; on failure keep the last copy and note the error."""
    try:
        v = fn(*a, **k)
        print(f'{name}: ok')
        return v
    except Exception as ex:  # noqa: BLE001 - one block must never stop the others
        errors.append(f'{name}: {type(ex).__name__} {str(ex)[:120]}')
        print(f'{name}: failed ({type(ex).__name__}: {str(ex)[:120]}); kept the last copy')
        return old


def stories(feeds, days=10, n=40, per_feed=12):
    """Headlines from feeds, each {'name', 'url', 'domain'?, 'kind'?}: title, link, outlet, time, summary, image.
    Google News items pass when their outlet is the feed's own domain, the edition's outlets, or ALLOW."""
    out, seen = [], set()

    def one(f):
        name, items, err = run.read_feed({'name': f.get('name') or f['url'], 'url': f['url']})
        if err:
            raise RuntimeError(err)
        got = []
        for it in items:
            t, link, when = it['title'], it['link'], it['when']
            if not t or not link or not when or (NOW - when).days > days:
                continue
            o = it['src_name'] or f.get('name') or run.norm_domain(link)
            if it['google']:
                dom = run.norm_domain(it['src_url'] or link)
                own = f.get('domain')
                if not dom or not (dom in OK_DOMAINS or (own and (dom == own or dom.endswith('.' + own)))):
                    continue
                o = run.OUTLETS.get(dom) or it['src_name'] or dom
                if it['src_name'] and t.endswith(' - ' + it['src_name']):
                    t = t[: -len(it['src_name']) - 3].strip()
            got.append({'t': t, 'u': link, 'o': o, 'p': iso(when), 'd': strip_html(it['desc'], 180) if not it['google'] else '',
                        'm': it['img'] or '', 'k': f.get('kind') or '', 'f': f.get('name') or ''})
        return got[:per_feed]

    bad = []
    with cf.ThreadPoolExecutor(10) as pool:
        futs = {pool.submit(one, f): f for f in feeds}
        for fu in cf.as_completed(futs):
            f = futs[fu]
            try:
                got = fu.result()
            except Exception as ex:  # noqa: BLE001
                bad.append(f.get('name') or f['url']); errors.append(f"{f.get('name') or f['url'][:50]}: {type(ex).__name__} {str(ex)[:80]}")
                continue
            for x in got:
                key = re.sub(r'\W+', ' ', x['t'].lower()).strip()[:70]
                if key in seen:
                    continue
                seen.add(key)
                out.append(x)
    out.sort(key=lambda x: x['p'], reverse=True)
    if not out and bad:
        raise RuntimeError('every feed failed: ' + '; '.join(bad)[:160])
    return out[:n], bad


# ------------------------------------------------------------------ Apple's charts (public marketing feeds)
def chart(path, n):
    d = get_json(f'{CHARTS}{path}')
    out = []
    for r in (d.get('feed') or {}).get('results') or []:
        out.append({'id': str(r.get('id') or ''), 'n': r.get('name') or '', 'by': r.get('artistName') or '',
                    'a': (r.get('artworkUrl100') or '').replace('100x100', '300x300'), 'u': r.get('url') or '',
                    'g': [g.get('name') for g in (r.get('genres') or []) if g.get('name') and g.get('name') not in ('Podcasts', 'Music', 'Books')][:2]})
    return out[:n]


def charts(old):
    old = old or {}
    out = {'at': STAMP}
    for key, path, n in [('podcasts', 'us/podcasts/top/50/podcasts.json', 50), ('podcasts_br', 'br/podcasts/top/25/podcasts.json', 25),
                         ('podcasts_de', 'de/podcasts/top/25/podcasts.json', 25),
                         ('books_paid', 'us/books/top-paid/25/books.json', 25), ('books_free', 'us/books/top-free/25/books.json', 25),
                         ('albums', 'us/music/most-played/25/albums.json', 25), ('songs', 'us/music/most-played/25/songs.json', 25)]:
        try:
            out[key] = chart(path, n)
        except Exception as ex:  # noqa: BLE001
            errors.append(f'chart {key}: {type(ex).__name__} {str(ex)[:80]}')
            out[key] = old.get(key) or []
    return out


# ------------------------------------------------------------------ podcasts
def lookup_many(ids):
    """Apple's lookup, up to 100 ids a request -> {id: result}."""
    out = {}
    ids = [str(i) for i in ids if i]
    for i in range(0, len(ids), 100):
        chunk = ids[i:i + 100]
        try:
            d = get_json(f'{APPLE}lookup?id={",".join(chunk)}&entity=podcast&country=us')
        except Exception as ex:  # noqa: BLE001
            errors.append(f'apple lookup: {type(ex).__name__} {str(ex)[:80]}')
            continue
        for r in d.get('results') or []:
            if r.get('kind') == 'podcast' or r.get('wrapperType') == 'track':
                out[str(r.get('collectionId') or r.get('trackId'))] = r
        if i + 100 < len(ids):
            time.sleep(3.2)
    return out


def search_show(name):
    d = get_json(f'{APPLE}search?term={urllib.parse.quote(name)}&media=podcast&entity=podcast&limit=6&country=us')
    best = None
    for r in d.get('results') or []:
        if same_show(name, r.get('collectionName') or ''):
            if best is None or norm_name(r.get('collectionName')) == norm_name(name):
                best = r
    return best


def show_meta(r):
    return {'id': str(r.get('collectionId') or ''), 'feed': r.get('feedUrl') or '', 'art': (r.get('artworkUrl600') or r.get('artworkUrl100') or '').replace('600x600', '300x300'),
            'u': (r.get('collectionViewUrl') or '').split('?')[0], 'by': r.get('artistName') or '', 'g': r.get('primaryGenreName') or '',
            'n': r.get('trackCount') or 0, 'apple_name': r.get('collectionName') or ''}


def resolve(shows, old):
    """Each show's feed, artwork and Apple link: from the last run, else Apple's lookup (ids in batches), else a name search."""
    meta = {k: v for k, v in ((s['key'], (old.get(s['key']) or {}).get('meta')) for s in shows) if v and v.get('feed')}
    need = [s for s in shows if s['key'] not in meta]
    by_id = lookup_many([s.get('apple') for s in need if s.get('apple')])
    unresolved = []
    for s in need:
        r = by_id.get(str(s.get('apple') or ''))
        if r and same_show(s['name'], r.get('collectionName') or ''):
            meta[s['key']] = show_meta(r)
        else:
            if r:
                errors.append(f"podcast {s['key']}: id {s.get('apple')} is \"{r.get('collectionName')}\", not \"{s['name']}\"; looking up by name")
            unresolved.append(s)
    n = 0
    for s in unresolved:
        if n >= SEARCH_CAP:
            errors.append(f"podcast {s['key']}: not resolved this run (name lookups capped at {SEARCH_CAP})")
            continue
        n += 1
        try:
            r = search_show(s['name'])
        except Exception as ex:  # noqa: BLE001
            errors.append(f"podcast {s['key']}: search {type(ex).__name__} {str(ex)[:60]}")
            r = None
        if r:
            meta[s['key']] = show_meta(r)
        else:
            errors.append(f"podcast {s['key']}: no show called \"{s['name']}\" on Apple Podcasts")
        time.sleep(3.2)
    return meta


ITEM = re.compile(rb'<item[\s>].*?</item>', re.S)
ITUNES = '{http://www.itunes.com/dtds/podcast-1.0.dtd}'


def duration(s):
    s = (s or '').strip()
    if not s:
        return 0
    if s.isdigit():
        return int(s)
    parts = s.split(':')
    try:
        parts = [float(p) for p in parts]
    except ValueError:
        return 0
    sec = 0
    for p in parts:
        sec = sec * 60 + p
    return int(sec)


def read_episodes(feed, n=6):
    """The channel's title, art and author, and its newest n items, from the first 700 KB of the feed."""
    raw = get(feed, accept='application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8', limit=700_000)
    raw = raw.lstrip(b'\xef\xbb\xbf \t\r\n')
    if raw[:200].lower().lstrip().startswith(b'<!doctype html') or b'<html' in raw[:150].lower():
        raise ValueError('returned a web page, not a feed')
    head = raw.split(b'<item', 1)[0]
    chan = {}
    try:
        h = ET.fromstring(head + b'</channel></rss>' if b'<channel' in head else b'<rss><channel></channel></rss>')
        c = h.find('channel')
        if c is not None:
            chan = {'title': run.clean(c.findtext('title', default='')), 'author': run.clean(c.findtext(ITUNES + 'author', default='')),
                    'art': (c.find(ITUNES + 'image').get('href') if c.find(ITUNES + 'image') is not None else '') or c.findtext('image/url', default=''),
                    'desc': strip_html(c.findtext(ITUNES + 'summary') or c.findtext('description') or '', 240)}
    except ET.ParseError:
        pass
    out = []
    for m in ITEM.finditer(raw):
        if len(out) >= n:
            break
        blob = b'<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:googleplay="http://www.google.com/schemas/play-podcasts/1.0" xmlns:spotify="http://www.spotify.com/ns/rss" xmlns:psc="http://podlove.org/simple-chapters" xmlns:cc="http://web.resource.org/cc/" xmlns:rawvoice="http://www.rawvoice.com/rawvoiceRssModule/" xmlns:wfw="http://wellformedweb.org/CommentAPI/" xmlns:sy="http://purl.org/rss/1.0/modules/syndication/" xmlns:slash="http://purl.org/rss/1.0/modules/slash/" xmlns:feedburner="http://rssnamespace.org/feedburner/ext/1.0" xmlns:acast="https://schema.acast.com/1.0/" xmlns:omny="https://omny.fm/rss-extensions" xmlns:megaphone="https://megaphone.fm/ns/1.0" xmlns:anchor="https://anchor.fm/xmlns">' + m.group(0) + b'</rss>'
        try:
            it = ET.fromstring(blob).find('item')
        except ET.ParseError:
            try:
                it = ET.fromstring(re.sub(rb'&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)', b'&amp;', blob)).find('item')
            except ET.ParseError:
                continue
        if it is None:
            continue
        enc = it.find('enclosure')
        audio = (enc.get('url') if enc is not None else '') or ''
        if not audio:
            for el in it.iter():
                if run.local(el.tag) == 'content' and (el.get('type') or '').startswith('audio'):
                    audio = el.get('url') or ''
                    break
        when = run.parse_date(it.findtext('pubDate') or it.findtext('{http://purl.org/dc/elements/1.1/}date') or '')
        title = run.clean(it.findtext('title') or '')
        if not title or not when:
            continue
        ep_type = (it.findtext(ITUNES + 'episodeType') or '').strip().lower()
        if ep_type == 'trailer':
            continue
        out.append({'t': title, 'p': iso(when), 'a': audio, 'l': duration(it.findtext(ITUNES + 'duration')),
                    'd': strip_html(it.findtext(ITUNES + 'summary') or it.findtext('description') or it.findtext('{http://purl.org/rss/1.0/modules/content/}encoded') or '', 220),
                    'u': (it.findtext('link') or '').strip(), 'g': (it.findtext('guid') or '').strip()[:120],
                    'i': (it.find(ITUNES + 'image').get('href') if it.find(ITUNES + 'image') is not None else '') or ''})
    out.sort(key=lambda e: e['p'], reverse=True)
    return chan, out


def podcasts(guide, old):
    old = old or {}
    shows = guide['podcasts']['shows']
    meta = resolve(shows, old)
    out = {}

    def one(s):
        m = meta[s['key']]
        chan, eps = read_episodes(m['feed'])
        return s['key'], chan, eps

    with cf.ThreadPoolExecutor(10) as pool:
        futs = {pool.submit(one, s): s for s in shows if s['key'] in meta}
        for fu in cf.as_completed(futs):
            s = futs[fu]
            prev = old.get(s['key']) or {}
            try:
                key, chan, eps = fu.result()
            except Exception as ex:  # noqa: BLE001
                errors.append(f"podcast {s['key']}: feed {type(ex).__name__} {str(ex)[:80]}")
                if prev.get('eps'):
                    out[s['key']] = dict(prev, meta=meta[s['key']], stale=True)
                else:
                    out[s['key']] = {'meta': meta[s['key']], 'eps': [], 'stale': True}
                continue
            m = dict(meta[key])
            if not m.get('art') and chan.get('art'):
                m['art'] = chan['art']
            if chan.get('author') and not m.get('by'):
                m['by'] = chan['author']
            out[key] = {'meta': m, 'chan': {'desc': chan.get('desc', '')}, 'eps': eps[:6], 'at': STAMP}
    for s in shows:
        if s['key'] not in out and old.get(s['key']):
            out[s['key']] = dict(old[s['key']], stale=True)
    got = sum(1 for v in out.values() if v.get('eps') and not v.get('stale'))
    print(f'  podcasts: {got} shows read fresh, {len(out) - got} kept or empty, of {len(shows)}')
    return out


# ------------------------------------------------------------------ magazines
def magazines(guide, old):
    old = old or {}
    out = {}
    titles = guide['magazines']['titles']

    def one(t):
        items, bad = stories([{'name': t['name'], 'url': t['feed'], 'domain': run.norm_domain(t['site'])}], days=45 if 'news.google.com' not in t['feed'] else 30, n=10, per_feed=10)
        if bad:
            raise RuntimeError('feed failed')
        return items

    with cf.ThreadPoolExecutor(10) as pool:
        futs = {pool.submit(one, t): t for t in titles}
        for fu in cf.as_completed(futs):
            t = futs[fu]
            try:
                items = fu.result()
                out[t['key']] = {'items': [{k: v for k, v in x.items() if k not in ('k', 'f')} for x in items], 'at': STAMP}
            except Exception as ex:  # noqa: BLE001
                errors.append(f"magazine {t['key']}: {type(ex).__name__} {str(ex)[:80]}")
                if old.get(t['key']):
                    out[t['key']] = dict(old[t['key']], stale=True)
    print(f'  magazines: {sum(1 for v in out.values() if not v.get("stale"))} of {len(titles)} fresh')
    return out


# ------------------------------------------------------------------ creators
def creators(guide, old):
    old = old or {}
    people = guide['creators']['people']
    lst = [(p['yt']['id'], p['yt']['expect'], p['name'], p['yt']['handle'], p.get('about', ''), p['key']) for p in people if p.get('yt')]
    # garage.channel takes (id, expect, name, handle, about); carry the key alongside
    vids, failed = garage.channels([c[:5] for c in lst], per=3, days=35)
    by_cid = {c[0]: c[5] for c in lst}
    videos = {}
    for v in vids:
        key = by_cid.get(v.get('cid'))
        if key:
            videos.setdefault(key, []).append({'v': v['v'], 't': v['t'], 'p': v['p'], 'd': (v.get('d') or '')[:140], 'views': v.get('views')})
    if len(failed) > len(lst) // 2 and old.get('videos'):
        videos = old['videos']
        errors.append('creators: most channels failed; kept the last videos')
    posts = {}
    feeds = [p for p in people if p.get('feed')]

    def one(p):
        items, bad = stories([{'name': p['name'], 'url': p['feed'], 'domain': run.norm_domain(p['feed'])}], days=60, n=4, per_feed=4)
        if bad:
            raise RuntimeError('feed failed')
        return items

    with cf.ThreadPoolExecutor(10) as pool:
        futs = {pool.submit(one, p): p for p in feeds}
        for fu in cf.as_completed(futs):
            p = futs[fu]
            try:
                posts[p['key']] = [{k: v for k, v in x.items() if k in ('t', 'u', 'p', 'd', 'm')} for x in fu.result()]
            except Exception as ex:  # noqa: BLE001
                errors.append(f"creator {p['key']}: {type(ex).__name__} {str(ex)[:80]}")
                if (old.get('posts') or {}).get(p['key']):
                    posts[p['key']] = old['posts'][p['key']]
    try:
        wire, _ = stories(guide['creators']['wire'], days=6, n=30)
    except Exception as ex:  # noqa: BLE001
        errors.append(f'creator wire: {ex}')
        wire = old.get('wire') or []
    print(f'  creators: {len(videos)} channels with videos ({len(failed)} failed), {len(posts)} newsletters, {len(wire)} wire stories')
    return {'videos': videos, 'posts': posts, 'wire': wire, 'failed': failed, 'at': STAMP}


# ------------------------------------------------------------------ culture
def culture(guide, old):
    old = old or {}
    chans = guide['culture']['channels']
    lst = [(c['id'], c['expect'], c['name'], c['handle'], c.get('about', '')) for c in chans]
    vids, failed = garage.channels(lst, per=4, days=21)
    kind_of = {c['name']: c['kind'] for c in chans}
    videos = {}
    for v in vids:
        k = kind_of.get(v.get('ch') or '')
        if k:
            videos.setdefault(k, []).append(v)
    if len(failed) > len(lst) // 2 and old.get('videos'):
        videos = old['videos']
        errors.append('culture: most channels failed; kept the last videos')
    releases = {}
    for r in guide['culture']['releases']:
        try:
            items, _ = stories([{'name': r['name'], 'url': garage.GN + urllib.parse.quote(r['q'] + f" when:{r['days']}d")}], days=r['days'] + 1, n=14, per_feed=14)
            releases[r['key']] = items
        except Exception as ex:  # noqa: BLE001
            errors.append(f"releases {r['key']}: {ex}")
            releases[r['key']] = (old.get('releases') or {}).get(r['key']) or []
    print(f'  culture: {sum(len(v) for v in videos.values())} videos ({len(failed)} channels failed), {sum(len(v) for v in releases.values())} release stories')
    return {'videos': videos, 'releases': releases, 'failed': failed, 'at': STAMP}


# ------------------------------------------------------------------ books
def open_library():
    d = get_json('https://openlibrary.org/trending/daily.json?limit=30')
    out = []
    for w in d.get('works') or []:
        if not w.get('cover_i'):
            continue
        out.append({'t': w.get('title') or '', 'by': ', '.join((w.get('author_name') or [])[:2]), 'y': w.get('first_publish_year'),
                    'c': f"https://covers.openlibrary.org/b/id/{w['cover_i']}-M.jpg", 'u': 'https://openlibrary.org' + (w.get('key') or ''), 'k': w.get('key') or ''})
    return out[:24]


def gutenberg():
    d = get_json('https://gutendex.com/books/?sort=popular&languages=en')
    out = []
    for b in d.get('results') or []:
        f = b.get('formats') or {}
        out.append({'t': b.get('title') or '', 'by': ', '.join(a.get('name', '') for a in (b.get('authors') or [])[:2]),
                    'c': f.get('image/jpeg') or '', 'u': f"https://www.gutenberg.org/ebooks/{b.get('id')}", 'dl': b.get('download_count') or 0,
                    'epub': f.get('application/epub+zip') or '', 'html': f.get('text/html') or f.get('text/html; charset=utf-8') or ''})
    return out[:24]


def books(guide, old):
    old = old or {}
    out = {'at': STAMP}
    try:
        out['wire'], bad = stories(guide['books']['feeds'], days=14, n=80, per_feed=10)
    except Exception as ex:  # noqa: BLE001
        errors.append(f'books wire: {ex}'); out['wire'] = old.get('wire') or []
    out['news'] = {}
    for q in guide['books']['news']:
        try:
            out['news'][q['key']], _ = stories([{'name': q['name'], 'url': garage.GN + urllib.parse.quote(q['q'])}], days=15, n=14, per_feed=14)
        except Exception as ex:  # noqa: BLE001
            errors.append(f"books {q['key']}: {ex}"); out['news'][q['key']] = (old.get('news') or {}).get(q['key']) or []
    for key, fn in (('trending', open_library), ('classics', gutenberg)):
        try:
            out[key] = fn()
        except Exception as ex:  # noqa: BLE001
            errors.append(f'books {key}: {type(ex).__name__} {str(ex)[:80]}'); out[key] = old.get(key) or []
    print(f"  books: {len(out['wire'])} wire, {len(out.get('trending') or [])} trending, {len(out.get('classics') or [])} classics")
    return out


# ------------------------------------------------------------------ shopping
def shopping(guide, old):
    old = old or {}
    items, bad = stories(guide['shopping']['feeds'], days=8, n=120, per_feed=10)
    print(f'  shopping: {len(items)} stories ({len(bad)} feeds failed)')
    return {'wire': items, 'failed': bad, 'at': STAMP}


# ------------------------------------------------------------------ build
def build():
    g = load(GUIDE)
    if not g:
        print('no guide at', GUIDE); return 1
    old = load(OUT, {}) or {}
    out = {'v': 1, 'at': STAMP, 'guide': g.get('updated')}
    out['charts'] = block(old.get('charts'), 'charts', charts, old.get('charts'))
    out['podcasts'] = block(old.get('podcasts'), 'podcasts', podcasts, g, old.get('podcasts'))
    out['magazines'] = block(old.get('magazines'), 'magazines', magazines, g, old.get('magazines'))
    out['creators'] = block(old.get('creators'), 'creators', creators, g, old.get('creators'))
    out['culture'] = block(old.get('culture'), 'culture', culture, g, old.get('culture'))
    out['books'] = block(old.get('books'), 'books', books, g, old.get('books'))
    out['shopping'] = block(old.get('shopping'), 'shopping', shopping, g, old.get('shopping'))
    out['errors'] = (errors + garage.errors)[:120]
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'wrote {OUT} ({os.path.getsize(OUT) // 1024} KB), {len(out["errors"])} notes')
    return 0


# ------------------------------------------------------------------ check
def check_guide(g=None):
    g = g or load(GUIDE)
    p = []
    if not g:
        return ['guide missing or not JSON']
    for grp, lst, needs in (('podcasts', g.get('podcasts', {}).get('shows', []), ('key', 'name', 'cat', 'host', 'about')),
                            ('magazines', g.get('magazines', {}).get('titles', []), ('key', 'name', 'site', 'feed', 'cat', 'since', 'cadence', 'about', 'mark', 'color')),
                            ('creators', g.get('creators', {}).get('people', []), ('key', 'name', 'cat', 'about', 'links'))):
        cats = {c['key'] for c in g.get(grp, {}).get('categories', [])}
        keys = set()
        for x in lst:
            for k in needs:
                if x.get(k) in (None, ''):
                    p.append(f"{grp} {x.get('key')}: missing {k}")
            if x.get('key') in keys:
                p.append(f"{grp}: duplicate key {x.get('key')}")
            keys.add(x.get('key'))
            if x.get('cat') not in cats:
                p.append(f"{grp} {x.get('key')}: unknown category {x.get('cat')}")
            if len(x.get('about') or '') > 240:
                p.append(f"{grp} {x.get('key')}: about is over 240 characters")
            for u in ('site', 'feed'):
                if x.get(u) and not https(x[u]):
                    p.append(f"{grp} {x.get('key')}: bad {u} {x[u][:60]}")
            if grp == 'creators':
                y = x.get('yt')
                if y and not (re.fullmatch(r'UC[\w-]{22}', y.get('id') or '') and y.get('expect') and y.get('handle')):
                    p.append(f"creators {x.get('key')}: bad yt block")
                if not y and not x.get('feed') and not x.get('links'):
                    p.append(f"creators {x.get('key')}: nothing to read (no channel, feed or links)")
            if grp == 'magazines' and not re.fullmatch(r'#[0-9a-fA-F]{6}', x.get('color') or ''):
                p.append(f"magazines {x.get('key')}: color must be #rrggbb")
            if grp == 'podcasts' and x.get('apple') is not None and not isinstance(x.get('apple'), int):
                p.append(f"podcasts {x.get('key')}: apple id must be a number or null")
    ids = [x['yt']['id'] for x in g.get('creators', {}).get('people', []) if x.get('yt')] + [c.get('id') for c in g.get('culture', {}).get('channels', [])]
    for i in {i for i in ids if ids.count(i) > 1}:
        p.append(f'YouTube id used twice: {i}')
    for c in g.get('culture', {}).get('channels', []):
        if not (re.fullmatch(r'UC[\w-]{22}', c.get('id') or '') and c.get('expect') and c.get('name') and c.get('kind') in ('screen', 'sound', 'stage', 'art', 'style')):
            p.append(f"culture channel {c.get('name')}: bad entry")
    for l in g.get('culture', {}).get('lenses', []):
        try:
            re.compile(l.get('test') or '', re.I)
        except re.error as ex:
            p.append(f"lens {l.get('key')}: bad regex ({ex})")
    for e in g.get('culture', {}).get('calendar', []):
        for k in ('name', 'start', 'end', 'place', 'url', 'what', 'source', 'kind'):
            if not e.get(k):
                p.append(f"calendar {e.get('name')}: missing {k}")
        try:
            a, b = dt.date.fromisoformat(e.get('start', '')), dt.date.fromisoformat(e.get('end', ''))
            if b < a:
                p.append(f"calendar {e.get('name')}: ends before it starts")
        except ValueError:
            p.append(f"calendar {e.get('name')}: bad dates")
    for f in g.get('books', {}).get('feeds', []) + g.get('shopping', {}).get('feeds', []) + g.get('creators', {}).get('wire', []):
        if not https(f.get('url')):
            p.append(f"feed {f.get('name')}: bad url")
    for s in g.get('books', {}).get('shops', []):
        if '{q}' not in (s.get('url') or ''):
            p.append(f"shop {s.get('key')}: url needs {{q}}")
    for e in g.get('shopping', {}).get('calendar', []):
        try:
            dt.date.fromisoformat(e.get('date', ''))
        except ValueError:
            p.append(f"retail calendar {e.get('name')}: bad date")
    return p


def main():
    a = sys.argv[1:]
    if a and a[0] in ('format', '-h', '--help'):
        print(__doc__); print(FORMAT); return 0
    if a and a[0] == 'check':
        p = check_guide()
        for x in p:
            print(x)
        print('ok' if not p else f'{len(p)} problem(s)')
        return 1 if p else 0
    return build()


if __name__ == '__main__':
    sys.exit(main())
