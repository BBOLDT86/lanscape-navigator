#!/usr/bin/env python3
"""The Watch's pictures and video: bigger pictures for the slideshows, and the news channels' latest videos -> news/data/media.json

  python3 news/updater/media.py          after run.py, for the edition it just wrote

Pictures: most stories arrive with a picture in their feed. For the stories that don't (a cluster with no picture, a
desk with few), it reads the article page's own share image (og:image / twitter:image), the image the outlet chooses
for link previews. A share image that the same outlet uses on two different stories is its logo, not a photo, and is
dropped. Pictures stay on the outlets' servers; the page links every slide back to its story.

Video: the public YouTube feeds of news channels (each checked against the channel's own name, so a wrong id can't
slip in), the last two days of uploads. Each video is filed under a desk the way a story is, and matched to the
edition's story cluster it shares the most distinctive words with. The page plays them with YouTube's own embedded
player (youtube-nocookie.com), so the channels' embedding settings and ads apply.

A source that fails is skipped and listed in `errors`; the page works without this file. Standard library only.
"""
import concurrent.futures as cf
import datetime as dt
import html
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import run  # noqa: E402  the edition's own classifier and stop words

D = os.path.normpath(os.path.join(HERE, '..', 'data'))
OUT = os.path.join(D, 'media.json')
NOW = dt.datetime.now(dt.timezone.utc)
START = time.monotonic()
BUDGET = 150
UA = run.UA['User-Agent']
errors = []

# (channel id, a word its name must contain, desk: 'auto' = by the words, like a general feed, lean)
CHANNELS = [
    ('UC52X5wxOL_s5yw0dQk7NtgA', 'Associated Press', 'auto', 'us'),
    ('UChqUTb7kYRX8-EiaN3XFrSQ', 'Reuters', 'auto', 'world'),
    ('UC16niRr50-MSBwiO3YDb3RA', 'BBC News', 'auto', 'world'),
    ('UCeY0bbntWzzVIaj2z3QigXg', 'NBC News', 'auto', 'us'),
    ('UC6ZFN9Tx6xh-skXCuRHCDpQ', 'PBS NewsHour', 'auto', 'us'),
    ('UC8p1vwvWtl6T73JiExfWs1g', 'CBS News', 'auto', 'us'),
    ('UCBi2mrWuNuyYy4gbM6fW5Ma', 'ABC News', 'auto', 'us'),
    ('UCupvZG-5ko_eiXAupbDfxWw', 'CNN', 'auto', 'us'),
    ('UCXIJgqnII2ZOINSWNOGFThA', 'Fox News', 'auto', 'us'),
    ('UCqnbDFdCpuN8CMEg0VuEBqA', 'New York Times', 'auto', 'us'),
    ('UCK7tptUDHh-RYDsdxO1-5QQ', 'Wall Street Journal', 'auto', 'us'),
    ('UCHpw8xwDNhU9gdohEcJu4aA', 'Guardian', 'auto', 'world'),
    ('UCoMdktPbSTixAyNGwb-UYkQ', 'Sky News', 'auto', 'world'),
    ('UCNye-wNBqNL5ZzHSJj3l8Bg', 'Al Jazeera', 'auto', 'world'),
    ('UCQfwfsi5VrQ8yKZ-UWmAEFg', 'FRANCE 24', 'auto', 'world'),
    ('UCknLrEdhRCp1aegoMqRaCZg', 'DW News', 'auto', 'world'),
    ('UCSrZ3UV4jOidv8ppoVuvW9Q', 'euronews', 'europe', 'world'),
    ('UCvdwhh_fDyWccR42-rReZLw', 'CNN Brasil', 'brazil', 'world'),
    ('UCrp_UI8XtuYfpiqluWLD7Lw', 'CNBC', 'business', 'us'),
    ('UCIALMKvObZNtJ6AmdCLP7Lg', 'Bloomberg', 'business', 'us'),
    ('UCEAZeUIeJs0IjQiqTCdVSIg', 'Yahoo Finance', 'business', 'us'),
    ('UCoUxsWakJucWg46KW5RsvPw', 'Financial Times', 'business', 'world'),
    ('UC0p5jTq6Xx_DosDFxVXnWaQ', 'Economist', 'auto', 'world'),
    ('UCddiUEpeqJcYeBxX1IVBKvQ', 'Verge', 'tech', 'us'),
    ('UCBJycsmduvYEL83R_U4JriQ', 'Marques Brownlee', 'tech', 'us'),
    ('UCLA_DiR1FfKNvjuUpBHmylQ', 'NASA', 'science', 'us'),
    ('UCiWLfSweyRNmLpgEHekhoAg', 'ESPN', 'sports', 'us'),
    ('UCB_qr75-ydFVKSF9Dmo6izg', 'FORMULA 1', 'sports', 'world'),
    ('UCjOl2AUblVmg2rA_cRgZkFg', 'Top Gear', 'cars', 'world'),
    ('UCbpMy0Fg74eXXkvxJrtEn3w', 'Bon App', 'food', 'us'),
    ('UC0k238zFx-Z8xFH0sxCrPJg', 'Architectural Digest', 'home', 'us'),
    ('UCLXo7UDZvByw2ixzpQCufnA', 'Vox', 'longreads', 'us'),
]
NS = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015', 'm': 'http://search.yahoo.com/mrss/'}
GENERIC_IMG = re.compile(r'logo|default|placeholder|fallback|social[-_]?share|share[-_]?image|brand|favicon|sprite|blank\.', re.I)
VIDEO_WORDS = set('live video videos watch news full episode update updates breaking latest report reports says new shorts today '
                  'show explained explainer clip interview exclusive analysis day week minute minutes hour hours'.split())


def late():
    return time.monotonic() - START > BUDGET


def get(url, timeout=8, limit=None, accept='*/*'):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': accept, 'Accept-Language': 'en-US,en;q=0.9'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(limit) if limit else r.read(), r.geturl()


# ------------------------------------------------------------------ pictures
META = re.compile(r'<meta\b[^>]*>', re.I)
ATTR = re.compile(r'([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|\'([^\']*)\')')


def share_image(url):
    raw, final = get(url, timeout=7, limit=300_000, accept='text/html,application/xhtml+xml')
    text = raw.decode('utf-8', 'replace')
    best = {}
    for tag in META.findall(text):
        a = {m.group(1).lower(): (m.group(3) if m.group(3) is not None else m.group(4)) for m in ATTR.finditer(tag)}
        key = (a.get('property') or a.get('name') or '').lower()
        if key in ('og:image', 'og:image:secure_url', 'og:image:url', 'twitter:image', 'twitter:image:src') and a.get('content'):
            best.setdefault(key, html.unescape(a['content'].strip()))
    for key in ('og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'):
        u = best.get(key)
        if u:
            u = urllib.parse.urljoin(final, u)
            if re.match(r'^https?://', u) and not GENERIC_IMG.search(u) and not re.search(r'\.(svg|gif)(\?|$)', u, re.I):
                return u.replace('http://', 'https://', 1) if u.startswith('http://') else u
    return None


def pictures(E):
    items = E['items']
    by_desk = {}
    for it in items:
        by_desk.setdefault(it['c'], []).append(it)
    want, seen = [], set()

    def add(it):
        if it['i'] in seen or it.get('m') or 'news.google.com' in it['u'] or len(want) >= 160:
            return
        seen.add(it['i']); want.append(it)
    byid = {it['i']: it for it in items}
    for cid in E.get('top') or []:  # the leading stories first
        c = E['clusters'][cid]
        members = [byid[i] for i in c['ids'] if i in byid]
        if not any(m.get('m') for m in members):
            for m in sorted(members, key=lambda x: -x['p'])[:2]:
                add(m)
    for c in E['clusters']:
        members = [byid[i] for i in c['ids'] if i in byid]
        if not any(m.get('m') for m in members):
            for m in sorted(members, key=lambda x: -x['p'])[:2]:
                add(m)
    for desk, its in by_desk.items():  # desks with few pictures
        have = sum(1 for it in its if it.get('m'))
        if have < 14:
            for it in sorted(its, key=lambda x: -x['p'])[:16 - have]:
                add(it)
    found = {}
    with cf.ThreadPoolExecutor(max_workers=16) as pool:
        futs = {pool.submit(share_image, it['u']): it for it in want}
        try:
            for f in cf.as_completed(futs, timeout=max(10, 75 - (time.monotonic() - START))):
                it = futs[f]
                try:
                    u = f.result()
                    if u:
                        found[it['i']] = (it['o'], u)
                except Exception as ex:  # noqa: BLE001
                    errors.append(f"picture {it['o']}: {type(ex).__name__}")
        except cf.TimeoutError:
            errors.append('pictures: out of time; kept what arrived')
    # the same picture on two different stories from one outlet is a logo or a stock banner
    count = {}
    for o, u in found.values():
        count[(o, u)] = count.get((o, u), 0) + 1
    used = {(it.get('o'), it.get('m')) for it in items if it.get('m')}
    img = {i: u for i, (o, u) in found.items() if count[(o, u)] == 1 and (o, u) not in used}
    print(f'media: {len(img)} pictures from {len(want)} story pages')
    return img, len(want)


# ------------------------------------------------------------------ video
def channel(cid, expect, section, lean):
    raw, _ = get(f'https://www.youtube.com/feeds/videos.xml?channel_id={cid}', timeout=10, accept='application/atom+xml,application/xml')
    root = ET.fromstring(raw)
    name = (root.findtext('a:title', default='', namespaces=NS) or '').strip()
    if expect.lower() not in name.lower():
        raise ValueError(f'channel is "{name}", expected {expect}')
    out = []
    for e in root.findall('a:entry', NS):
        vid = e.findtext('yt:videoId', default='', namespaces=NS)
        title = (e.findtext('a:title', default='', namespaces=NS) or '').strip()
        pub = e.findtext('a:published', default='', namespaces=NS)
        try:
            when = dt.datetime.fromisoformat(pub.replace('Z', '+00:00'))
        except ValueError:
            continue
        if not vid or not title or (NOW - when).total_seconds() > 48 * 3600:
            continue
        link = e.find('a:link', NS)
        href = link.get('href') if link is not None else ''
        g = e.find('m:group', NS)
        desc = (g.findtext('m:description', default='', namespaces=NS) if g is not None else '') or ''
        views = None
        if g is not None:
            st = g.find('m:community/m:statistics', NS)
            if st is not None and st.get('views', '').isdigit():
                views = int(st.get('views'))
        desc1 = re.sub(r'https?://\S+', '', desc).strip()
        desc1 = re.split(r'\n\s*\n|#\w+|Subscribe|SUBSCRIBE|Follow us|Read more', desc1)[0].strip()
        desc1 = run.WS.sub(' ', desc1)[:260]
        desk = run.classify(section, lean, '', title, desc1[:200])
        out.append({'v': vid, 't': html.unescape(title), 'ch': name, 'p': when.strftime('%Y-%m-%dT%H:%M:%SZ'), 'd': html.unescape(desc1),
                    's': 1 if '/shorts/' in href else 0, 'c': desk, 'views': views})
    return name, out[:10]


def words(s):
    return {w for w in re.findall(r"[a-z0-9][a-z0-9'’-]*[a-z0-9]", s.lower().replace('’', "'")) if len(w) >= 3 and w not in run.STOP and w not in VIDEO_WORDS}


def match(videos, E):
    byid = {it['i']: it for it in E['items']}
    cl = []
    for c in E['clusters']:
        ws = set()
        for i in c['ids']:
            if i in byid:
                ws |= words(byid[i]['t'])
        cl.append(ws)
    df = {}
    for ws in cl:
        for w in ws:
            df[w] = df.get(w, 0) + 1
    n = max(1, len(cl))
    hit = 0
    for v in videos:
        vw = words(v['t'])
        best, bs = None, 0.0
        for cid, ws in enumerate(cl):
            sh = vw & ws
            if len(sh) < 2:
                continue
            s = sum(math.log(1 + n / df[w]) for w in sh)
            if len(sh) >= 3 and s > bs:
                best, bs = cid, s
        if best is not None and bs >= 6.5:
            v['g'] = best; hit += 1
    return hit


def videos(E):
    got, failed = [], []
    with cf.ThreadPoolExecutor(max_workers=12) as pool:
        futs = {pool.submit(channel, *c): c for c in CHANNELS}
        try:
            for f in cf.as_completed(futs, timeout=max(10, BUDGET - 20 - (time.monotonic() - START))):
                c = futs[f]
                try:
                    _name, vs = f.result()
                    got.extend(vs)
                except Exception as ex:  # noqa: BLE001
                    failed.append(c[1]); errors.append(f'video {c[1]}: {type(ex).__name__} {str(ex)[:80]}')
        except cf.TimeoutError:
            errors.append('video: out of time; kept what arrived')
    seen, out = set(), []
    for v in sorted(got, key=lambda v: v['p'], reverse=True):
        if v['v'] not in seen:
            seen.add(v['v']); out.append(v)
    hit = match(out, E)
    print(f'media: {len(out)} videos from {len(CHANNELS) - len(failed)} of {len(CHANNELS)} channels, {hit} matched to stories')
    return out, {'read': len(CHANNELS) - len(failed), 'total': len(CHANNELS), 'failed': failed}


def main():
    E = json.load(open(os.path.join(D, 'edition.json'), encoding='utf-8'))
    try:
        old = json.load(open(OUT, encoding='utf-8'))
    except (OSError, ValueError):
        old = {}
    with cf.ThreadPoolExecutor(max_workers=2) as pool:
        pj, vj = pool.submit(pictures, E), pool.submit(videos, E)
        try:
            img, asked = pj.result()
        except Exception as ex:  # noqa: BLE001
            img, asked = {}, 0; errors.append(f'pictures: {type(ex).__name__} {str(ex)[:80]}')
        try:
            vids, chans = vj.result()
        except Exception as ex:  # noqa: BLE001
            vids, chans = [], {'read': 0, 'total': len(CHANNELS), 'failed': []}; errors.append(f'video: {type(ex).__name__} {str(ex)[:80]}')
    if not vids and old.get('videos'):  # keep the last good list rather than showing none
        vids = [v for v in old['videos'] if (NOW - dt.datetime.fromisoformat(v['p'].replace('Z', '+00:00'))).total_seconds() < 72 * 3600]
        for v in vids:
            v.pop('g', None)
        match(vids, E)
    out = {'v': 1, 'edition': E['id'], 'at': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'img': img, 'asked': asked,
           'videos': vids, 'channels': chans, 'errors': errors[:40]}
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'media {E["id"]}: {len(img)} pictures, {len(vids)} videos, {len(errors)} errors, {os.path.getsize(OUT) // 1024} KB, {time.monotonic() - START:.0f} s')
    for e in errors[:12]:
        print('  ', e)
    return 0


if __name__ == '__main__':
    sys.exit(main())
