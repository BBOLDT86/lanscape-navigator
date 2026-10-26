#!/usr/bin/env python3
"""Runs on a GitHub Actions runner: which candidate feeds answer, and what the YouTube handles resolve to."""
import concurrent.futures as cf, datetime as dt, email.utils, gzip, json, re, sys, urllib.request, xml.etree.ElementTree as ET
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 TheWatch/1.0 (+https://bboldt86.github.io/lanscape-navigator/news/)'
NOW = dt.datetime.now(dt.timezone.utc)
def get(url, accept='*/*', timeout=20):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': accept, 'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip', 'Cookie': 'CONSENT=YES+1; SOCS=CAI'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        b = r.read()
        if r.headers.get('Content-Encoding') == 'gzip' or b[:2] == b'\x1f\x8b':
            b = gzip.decompress(b)
        return r.status, r.geturl(), b
def local(t): return t.rsplit('}', 1)[-1]
def when(s):
    s = (s or '').strip()
    if not s: return None
    try: d = email.utils.parsedate_to_datetime(s)
    except Exception:
        try: d = dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
        except Exception: return None
    return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)
def feed(f):
    out = {'name': f.get('name'), 'url': f['url'], 'hobby': f.get('hobby')}
    try:
        st, final, raw = get(f['url'], 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8')
        out['status'], out['final'] = st, final
        if f.get('save'):
            import os; os.makedirs('raw', exist_ok=True)
            open(os.path.join('raw', re.sub(r'[^A-Za-z0-9]+', '_', f['name']) + '.xml'), 'wb').write(raw)
        try: root = ET.fromstring(raw)
        except ET.ParseError: root = ET.fromstring(re.sub(rb'&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)', b'&amp;', raw))
        items = []
        for e in root.iter():
            if local(e.tag) not in ('item', 'entry'): continue
            t = d = ''
            for c in e:
                n = local(c.tag)
                if n == 'title' and not t: t = (c.text or '').strip()
                if n in ('pubDate', 'published', 'updated', 'date') and not d: d = c.text or ''
            w = when(d)
            items.append({'t': re.sub(r'\s+', ' ', t)[:120], 'd': w.strftime('%Y-%m-%d') if w else ''})
        ds = sorted([i['d'] for i in items if i['d']], reverse=True)
        out.update(n=len(items), newest=ds[0] if ds else '', last7=sum(1 for x in ds if (NOW.date() - dt.date.fromisoformat(x)).days <= 7),
                   last30=sum(1 for x in ds if (NOW.date() - dt.date.fromisoformat(x)).days <= 30), sample=[i['t'] for i in items[:12]])
    except Exception as ex:
        out['error'] = f'{type(ex).__name__}: {str(ex)[:160]}'
    return out
def handle(h):
    out = dict(h)
    cid = h.get('id') or ''
    try:
        if h.get('handle'):
            st, final, raw = get('https://www.youtube.com/@' + h['handle'].lstrip('@'), 'text/html')
            s = raw.decode('utf-8', 'replace')
            m = re.search(r'<link rel="alternate" type="application/rss\+xml" title="RSS" href="https://www\.youtube\.com/feeds/videos\.xml\?channel_id=(UC[\w-]{22})"', s) or re.search(r'"externalId":"(UC[\w-]{22})"', s) or re.search(r'<meta itemprop="identifier" content="(UC[\w-]{22})"', s)
            out['resolved'] = m.group(1) if m else ''
            t = re.search(r'<meta property="og:title" content="([^"]*)"', s)
            out['page_title'] = t.group(1) if t else ''
            if out['resolved']: cid = out['resolved']
    except Exception as ex:
        out['handle_error'] = f'{type(ex).__name__}: {str(ex)[:120]}'
    if cid:
        out['cid'] = cid
        try:
            st, final, raw = get(f'https://www.youtube.com/feeds/videos.xml?channel_id={cid}', 'application/atom+xml')
            root = ET.fromstring(raw)
            ns = {'a': 'http://www.w3.org/2005/Atom'}
            out['feed_name'] = (root.findtext('a:author/a:name', default='', namespaces=ns) or root.findtext('a:title', default='', namespaces=ns) or '').strip()
            es = root.findall('a:entry', ns)
            ds, shorts = [], 0
            for e in es:
                w = when(e.findtext('a:published', default='', namespaces=ns))
                l = e.find('a:link', ns)
                if l is not None and '/shorts/' in (l.get('href') or ''): shorts += 1; continue
                if w: ds.append(w)
            out.update(entries=len(es), shorts=shorts, newest=max(ds).strftime('%Y-%m-%d') if ds else '', last45=sum(1 for w in ds if (NOW - w).days <= 45),
                       titles=[(e.findtext('a:title', default='', namespaces=ns) or '')[:90] for e in es[:4]])
        except Exception as ex:
            out['feed_error'] = f'{type(ex).__name__}: {str(ex)[:120]}'
    return out
c = json.load(open('candidates.json'))
with cf.ThreadPoolExecutor(12) as p:
    feeds = list(p.map(feed, c.get('feeds', [])))
with cf.ThreadPoolExecutor(6) as p:
    chans = list(p.map(handle, c.get('channels', [])))
json.dump({'at': NOW.isoformat(), 'feeds': feeds, 'channels': chans}, open('results.json', 'w'), indent=1, ensure_ascii=False)
print(sum(1 for f in feeds if f.get('n')), 'of', len(feeds), 'feeds;', sum(1 for h in chans if h.get('newest')), 'of', len(chans), 'channels')
