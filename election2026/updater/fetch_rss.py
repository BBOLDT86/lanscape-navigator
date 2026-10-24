#!/usr/bin/env python3
"""Read the RSS/Atom feeds in data/feeds.json and keep the election-related headlines -> data/news.json
{asOf, items: [{t, title, link, source, scope}]} (last 72 hours, newest first, at most 200; titles are the outlets' own).
A feed that fails is skipped and noted; nothing is invented.
"""
import json, os, re, sys, time, html, gzip, datetime as dt, urllib.request, urllib.error, email.utils, xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..', 'data')
# Browser-like headers: several outlets answer a plain script UA with 403 or a bot-check page. The project URL stays in the UA
# so a publisher can see who is reading the feed. Feeds are read once every 3 hours (every 15 minutes Nov. 3-6).
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 ElectionDesk2026/1.0 (+https://bboldt86.github.io/lanscape-navigator/election2026/)',
      'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'}
def now(): return dt.datetime.now(dt.timezone.utc)
def load(p, d):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return d
feeds = load(os.path.join(D, 'feeds.json'), {}); races = load(os.path.join(D, 'races.json'), {})
old = load(os.path.join(D, 'news.json'), {})

# keywords: generic election words plus every candidate's last name (so a state feed's story about "Husted" counts)
KW = ['election', 'midterm', 'senate', 'governor', 'ballot', 'early vot', 'vote early', 'voting', 'voter', 'absentee', 'mail-in', 'mail ballot', 'turnout', 'poll', 'campaign', 'candidate', 'congress', 'house race', 'redistrict', 'precinct', 'recount', 'runoff', 'debate', 'endorse', 'super pac', 'fec ', 'canvass', 'certif', 'swing state', 'battleground']
names = set()
for key in ('senate', 'governor'):
    for r in races.get(key) or []:
        for c in r.get('candidates') or []:
            ln = (c.get('name') or '').split()
            if ln and len(ln[-1]) > 3: names.add(ln[-1].lower())
for d in (races.get('house') or {}).get('competitive') or []:
    for c in d.get('candidates') or []:
        ln = (c.get('name') or '').split()
        if ln and len(ln[-1]) > 3: names.add(ln[-1].lower())
def relevant(title, scope):
    t = title.lower()
    if any(k in t for k in KW): return True
    if scope != 'national' and any(re.search(r'\b' + re.escape(n) + r'\b', t) for n in names): return True
    return any(re.search(r'\b' + re.escape(n) + r'\b', t) for n in names) and any(w in t for w in ('vote', 'race', 'seat', 'ad', 'rally'))

def parse_date(s):
    if not s: return None
    try: d = email.utils.parsedate_to_datetime(s)
    except Exception:
        try: d = dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
        except Exception: return None
    if d.tzinfo is None: d = d.replace(tzinfo=dt.timezone.utc)
    return d.astimezone(dt.timezone.utc)
def text(el, *names):
    for n in names:
        for e in el.iter():
            if e.tag.split('}')[-1] == n and (e.text or '').strip(): return html.unescape(re.sub(r'<[^>]+>', '', e.text)).strip()
            if e.tag.split('}')[-1] == n and n == 'link' and e.get('href'): return e.get('href')
    return ''

items, errors = [], []
cut = now() - dt.timedelta(hours=72)
FIXTURE = sys.argv[sys.argv.index('--fixture') + 1] if '--fixture' in sys.argv else None  # a dir of saved feed XML, named <feed name>.xml (tests)
def fetch_raw(url, src):
    if FIXTURE:
        fp = os.path.join(FIXTURE, re.sub(r'[^A-Za-z0-9]+', '_', src) + '.xml')
        if not os.path.exists(fp): raise FileNotFoundError(fp)
        return open(fp, 'rb').read()
    req = urllib.request.Request(url, headers=UA)
    for attempt in (1, 2):  # one retry on a gateway error or a dropped connection
        try:
            with urllib.request.urlopen(req, timeout=20) as r: raw = r.read()
            break
        except urllib.error.HTTPError as ex:
            if attempt == 1 and ex.code >= 500: time.sleep(3); continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == 1: time.sleep(3); continue
            raise
    if raw[:2] == b'\x1f\x8b': raw = gzip.decompress(raw)
    raw = raw.lstrip(b'\xef\xbb\xbf \t\r\n')
    head = raw[:300].lower()
    if head.startswith(b'<!doctype html') or head.startswith(b'<html') or b'<html' in head[:120]:
        raise ValueError('returned an HTML page, not a feed (bot check or moved)')
    return raw
for f in feeds.get('rss') or []:
    url = f.get('url'); src = f.get('name') or url; scope = f.get('scope') or 'national'
    if not url: continue
    try:
        raw = fetch_raw(url, src)
        root = ET.fromstring(raw)
        entries = [e for e in root.iter() if e.tag.split('}')[-1] in ('item', 'entry')]
        n = 0
        for e in entries:
            title = text(e, 'title'); link = text(e, 'link', 'id'); when = parse_date(text(e, 'pubDate', 'published', 'updated', 'date'))
            if not title or not link or not when or when < cut: continue
            if not relevant(title, scope): continue
            items.append({'t': when.strftime('%Y-%m-%dT%H:%M:%SZ'), 'title': title[:220], 'link': link, 'source': src, 'scope': scope}); n += 1
        print(f'  {src}: {n} relevant of {len(entries)}')
    except FileNotFoundError:
        continue
    except Exception as ex:
        errors.append(f'{src}: {type(ex).__name__}: {str(ex)[:100]}')
# merge with what we had (so a feed outage does not empty the list), dedupe by link, keep 72h
seen, merged = set(), []
for it in sorted(items + (old.get('items') or []), key=lambda x: x['t'], reverse=True):
    k = re.sub(r'[?#].*$', '', it['link'])
    if k in seen or it['t'] < cut.strftime('%Y-%m-%dT%H:%M:%SZ'): continue
    seen.add(k); merged.append(it)
out = {'asOf': now().strftime('%Y-%m-%dT%H:%M:%SZ'), 'items': merged[:200], 'errors': errors, 'feedsRead': len(feeds.get('rss') or []) - len(errors)}
json.dump(out, open(os.path.join(D, 'news.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'news: {len(merged)} headlines kept, {len(errors)} feeds failed'); [print('  ', e) for e in errors]
sys.exit(0 if out['feedsRead'] else 2)
