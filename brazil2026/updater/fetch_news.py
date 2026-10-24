#!/usr/bin/env python3
"""Headlines about the runoff from the feeds in data/feeds.json -> news -> data/news.json
{asOf, items: [{t, title, link, source}]} (last 72 hours, newest first, at most 120; titles are the outlets' own).
A feed that fails is skipped and noted; nothing is invented.
"""
import json, os, re, sys, time, html, gzip, datetime as dt, urllib.request, urllib.error, email.utils, xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..', 'data')
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 BrazilDesk2026/1.0 (+https://bboldt86.github.io/lanscape-navigator/brazil2026/)',
      'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8'}
def now(): return dt.datetime.now(dt.timezone.utc)
def load(p, d):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return d
feeds = load(os.path.join(D, 'feeds.json'), {}); old = load(os.path.join(D, 'news.json'), {})
KW = ['lula', 'bolsonaro', 'flávio', 'flavio', 'runoff', 'segundo turno', '2º turno', '2o turno', 'eleição', 'eleições', 'election', 'tse', 'apuração', 'urna', 'pesquisa', 'datafolha', 'quaest', 'atlas', 'presidencial', 'presidential', 'voto', 'vote']
def relevant(title): t = title.lower(); return any(k in t for k in KW)
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
def fetch_raw(url):
    req = urllib.request.Request(url, headers=UA)
    for attempt in (1, 2):
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
    if raw[:300].lower().lstrip().startswith((b'<!doctype html', b'<html')): raise ValueError('returned an HTML page, not a feed')
    return raw
items, errors = [], []; cut = now() - dt.timedelta(hours=72)
for f in feeds.get('news') or []:
    url = f.get('url'); src = f.get('name') or url
    try:
        root = ET.fromstring(fetch_raw(url)); n = 0
        for e in [e for e in root.iter() if e.tag.split('}')[-1] in ('item', 'entry')]:
            title = text(e, 'title'); link = text(e, 'link', 'id'); when = parse_date(text(e, 'pubDate', 'published', 'updated', 'date'))
            if not title or not link or not when or when < cut or not relevant(title): continue
            items.append({'t': when.strftime('%Y-%m-%dT%H:%M:%SZ'), 'title': title[:220], 'link': link, 'source': src}); n += 1
        print(f'  {src}: {n}')
    except Exception as ex: errors.append(f'{src}: {type(ex).__name__}: {str(ex)[:100]}')
seen, merged = set(), []
for it in sorted(items + (old.get('items') or []), key=lambda x: x['t'], reverse=True):
    k = re.sub(r'[?#].*$', '', it['link'])
    if k in seen or it['t'] < cut.strftime('%Y-%m-%dT%H:%M:%SZ'): continue
    seen.add(k); merged.append(it)
out = {'asOf': now().strftime('%Y-%m-%dT%H:%M:%SZ'), 'items': merged[:120], 'errors': errors, 'feedsRead': len(feeds.get('news') or []) - len(errors)}
json.dump(out, open(os.path.join(D, 'news.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'news: {len(merged)} kept, {len(errors)} feeds failed'); [print('  ', e) for e in errors]
sys.exit(0 if out['feedsRead'] else 2)
