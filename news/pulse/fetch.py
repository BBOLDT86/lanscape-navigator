#!/usr/bin/env python3
"""The Pulse: read The Watch's reader counts back from GoatCounter and turn them into
news/pulse/data/stats.json (the dashboard's data) and news/pulse/data/digest.md (the short readout Claude reads).

Runs on GitHub Actions (pulse.yml) with one repo secret (the site code is thewatch-pulse, https://thewatch-pulse.goatcounter.com;
GOATCOUNTER_CODE overrides it):
    GOATCOUNTER_TOKEN  an API token with "Read statistics" and "Export" ticked (goatcounter: Settings › API)

How: GoatCounter's export API hands back every hit since the last one read (an hourly limit; we run every 3 h). Each
run folds the new hits into data/state.json, one summary per day (page views, events, sources, devices, countries,
and a short hash of each session so visitors can be counted without keeping who they were), keeps 120 days, and
rebuilds stats.json from it. Raw hits are never committed.

    python3 news/pulse/fetch.py            # the real thing (needs the two secrets)
    python3 news/pulse/fetch.py --rebuild  # rebuild stats.json + digest.md from state.json only
    python3 news/pulse/fetch.py --sample   # write data/sample.json: made-up numbers to design the dashboard against
Standard library only.
"""
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
STATE = os.path.join(DATA, 'state.json')
STATS = os.path.join(DATA, 'stats.json')
DIGEST = os.path.join(DATA, 'digest.md')
AUDIT = os.path.join(DATA, 'audit.json')
SAMPLE = os.path.join(DATA, 'sample.json')
KEEP_DAYS = 120
SITE = 'https://bboldt86.github.io/lanscape-navigator'

EVENT_KINDS = ['read25', 'read50', 'read75', 'read100', 't30', 't60', 't180', 't600', 'viz', 'play', 'done', 'full',
               'share', 'dl', 'out', 'go', 'up', 'down', 'note', 'src', 'search', 'contact']


def log(*a):
    print('[pulse]', *a, flush=True)


# ---------------------------------------------------------------------------------------------------------------------
# GoatCounter
# ---------------------------------------------------------------------------------------------------------------------
class GC:
    def __init__(self, code, token):
        self.base = f'https://{code}.goatcounter.com/api/v0'
        self.token = token

    def req(self, method, path, body=None, raw=False):
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(self.base + path, data=data, method=method, headers={
            'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json', 'Accept': 'application/json',
            'User-Agent': 'the-watch-pulse/1 (github.com/BBOLDT86/lanscape-navigator)'})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(r, timeout=60) as resp:
                    b = resp.read()
                    if raw:
                        return b
                    return json.loads(b or b'{}')
            except urllib.error.HTTPError as e:
                msg = e.read()[:400].decode('utf-8', 'replace')
                if e.code == 429 and attempt < 3:
                    wait = int(e.headers.get('Retry-After') or 5)
                    log(f'429 on {path}, waiting {wait}s')
                    time.sleep(min(wait, 60))
                    continue
                raise RuntimeError(f'{method} {path}: HTTP {e.code}: {msg}')
        raise RuntimeError(f'{method} {path}: gave up')

    def export(self, start_from):
        """Start an export of every hit after start_from, wait for it, return (rows, last_hit_id)."""
        x = self.req('POST', '/export', {'start_from_hit_id': start_from})
        eid = x.get('id')
        log('export started', eid, 'from hit', start_from)
        for _ in range(60):
            if x.get('finished_at'):
                break
            time.sleep(5)
            x = self.req('GET', f'/export/{eid}')
        if x.get('error'):
            raise RuntimeError('export error: ' + str(x['error']))
        if not x.get('finished_at'):
            raise RuntimeError('export did not finish in 5 minutes')
        last = x.get('last_hit_id') or start_from
        if not x.get('num_rows'):
            log('export: no new hits')
            return [], last
        b = self.req('GET', f'/export/{eid}/download', raw=True)
        try:
            b = gzip.decompress(b)
        except OSError:
            pass
        text = b.decode('utf-8', 'replace')
        rows = list(csv.reader(io.StringIO(text)))
        log(f'export: {len(rows) - 1} rows, last hit {last}')
        return rows, last


def col_index(header):
    """Map the export's header (it starts with a format version, e.g. "2,Path,Title,Event,...") to our names."""
    want = {'path': ['path'], 'title': ['title'], 'event': ['event'], 'ua': ['useragent', 'user agent'],
            'browser': ['browser'], 'system': ['system'], 'session': ['session'], 'bot': ['bot'],
            'ref': ['referrer', 'ref'], 'size': ['screen size', 'size'], 'loc': ['location'],
            'first': ['firstvisit', 'first visit'], 'date': ['date', 'created at', 'createdat']}
    idx = {}
    h = [c.strip().lower().lstrip('0123456789').strip(',') if i == 0 else c.strip().lower() for i, c in enumerate(header)]
    for k, names in want.items():
        for i, c in enumerate(h):
            if c in names:
                idx[k] = i
                break
    return idx


# ---------------------------------------------------------------------------------------------------------------------
# folding hits into days
# ---------------------------------------------------------------------------------------------------------------------
def size_bucket(s):
    try:
        w = float(str(s).split(',')[0])
    except ValueError:
        return 'unknown'
    if w <= 0:
        return 'unknown'
    return 'phone' if w < 600 else 'tablet' if w < 1024 else 'desktop'


def ref_host(r):
    r = (r or '').strip()
    if not r:
        return ''
    if '://' not in r:
        r = 'https://' + r
    try:
        h = urllib.parse.urlparse(r).netloc.lower()
    except ValueError:
        return ''
    h = re.sub(r'^(www|m|l|lm|out)\.', '', h)
    if h.endswith('github.io') and 'bboldt86' in h:
        return ''
    # one name per platform
    for k, v in [('google.', 'Google'), ('bing.com', 'Bing'), ('duckduckgo', 'DuckDuckGo'), ('facebook.com', 'Facebook'),
                 ('fb.me', 'Facebook'), ('instagram', 'Instagram'), ('t.co', 'X / Twitter'), ('twitter.com', 'X / Twitter'),
                 ('x.com', 'X / Twitter'), ('reddit', 'Reddit'), ('linkedin', 'LinkedIn'), ('lnkd.in', 'LinkedIn'),
                 ('bsky', 'Bluesky'), ('threads', 'Threads'), ('news.ycombinator', 'Hacker News'), ('youtube', 'YouTube'),
                 ('whatsapp', 'WhatsApp'), ('slack', 'Slack'), ('teams.', 'Teams'), ('mail.', 'Email'), ('outlook', 'Email'),
                 ('chatgpt', 'ChatGPT'), ('perplexity', 'Perplexity'), ('claude.ai', 'Claude')]:
        if h == k or h.startswith(k) or ('.' + k) in ('.' + h):
            return v
    return h


def fold(state, rows):
    if not rows:
        return 0
    idx = col_index(rows[0])
    need = {'path', 'date'}
    if not need <= set(idx):
        raise RuntimeError(f'export header not understood: {rows[0][:16]}')
    days = state.setdefault('days', {})
    n = 0
    for r in rows[1:]:
        def g(k):
            i = idx.get(k)
            return r[i] if i is not None and i < len(r) else ''
        if g('bot') not in ('', '0', 'false', 'False'):
            continue
        day = g('date')[:10]
        if not re.match(r'\d{4}-\d\d-\d\d$', day):
            continue
        D = days.setdefault(day, {'v': {}, 'e': {}, 's': [], 'ref': {}, 'refp': {}, 'size': {}, 'loc': {}, 'br': {}, 'new': 0})
        path = g('path')[:600]
        is_event = g('event').lower() in ('true', '1', 't', 'yes')
        if is_event or '|' in path:
            D['e'][path] = D['e'].get(path, 0) + 1
        else:
            D['v'][path] = D['v'].get(path, 0) + 1
            sess = g('session')
            if sess:
                hsh = hashlib.sha1(sess.encode()).hexdigest()[:8]
                if hsh not in D['s']:
                    D['s'].append(hsh)
            host = ref_host(g('ref'))
            if host:
                D['ref'][host] = D['ref'].get(host, 0) + 1
                rp = D['refp'].setdefault(path, {})
                rp[host] = rp.get(host, 0) + 1
            b = size_bucket(g('size'))
            D['size'][b] = D['size'].get(b, 0) + 1
            loc = (g('loc') or '').split('-')[0].upper() or '??'
            D['loc'][loc] = D['loc'].get(loc, 0) + 1
            br = (g('browser') or 'unknown').split(' ')[0]
            D['br'][br] = D['br'].get(br, 0) + 1
            if g('first').lower() in ('true', '1', 't', 'yes'):
                D['new'] += 1
        n += 1
    cut = (dt.date.today() - dt.timedelta(days=KEEP_DAYS)).isoformat()
    for d in [d for d in days if d < cut]:
        del days[d]
    return n


# ---------------------------------------------------------------------------------------------------------------------
# what the numbers say
# ---------------------------------------------------------------------------------------------------------------------
LABELS = {'wave': 'The wave', 'money': 'The money', 'mandate': 'The Mandate', 'eras': 'Three waves', 'primer': 'Primer',
          'my': 'My Watch', 'prophecy': 'The Prophecy Watch', 'home': 'Home', 'household': 'Household', 'lifestyle': 'Lifestyle',
          'hobbies': 'Hobbies', 'food': 'Food', 'sports': 'Sports', 'tech': 'Tech', 'create': 'Create', 'f1': 'Formula 1',
          'latenight': 'Late Night', 'plusone': 'Plus One', 'garage': 'Garage', 'articles': 'Articles', 'columns': 'Columns',
          'r': 'Shared links', 'election2026': 'Election 2026', 'brazil2026': 'Brazil 2026', 'luke': "Luke's page",
          'travel': 'Travel', 'shop': 'Shopping', 'vision': 'Vision', 'the-hinge': 'The Hinge', 'meridian': 'Meridian',
          'summit': 'Summit', 'pinfall': 'Pinfall', 'final-table': 'Final Table', 'barnlife': 'Barn Life', 'roku': 'Roku',
          'inbox-atlas': 'Inbox Atlas', 'wx-center': 'Weather Center'}


def section(p):
    if p.startswith('/news/#') or p in ('/news/', '/news'):
        return 'Front page'
    parts = [x for x in p.split('/') if x]
    if not parts:
        return 'Other'
    if parts[0] == 'news' and len(parts) > 1:
        k = parts[1]
        if k == 'wave' and len(parts) > 2:
            f = parts[2]
            if f.startswith('county-'):
                return 'The wave · counties'
            if f.startswith('house'):
                return 'The wave · House'
            if f not in ('index.html',):
                return 'The wave · states'
        return LABELS.get(k, k.replace('-', ' ').title())
    return LABELS.get(parts[0], parts[0].replace('-', ' ').title())


def norm_page(p):
    p = re.sub(r'index\.html?$', '', p)
    if p.startswith('/lanscape-navigator'):
        p = p[len('/lanscape-navigator'):] or '/'
    return p


def windows(state, today):
    days = sorted(state.get('days', {}))
    out = {}
    for w in (7, 30, 90):
        cut = (today - dt.timedelta(days=w - 1)).isoformat()
        out[w] = [d for d in days if d >= cut]
    return out


def build(state, audit=None, today=None):
    today = today or dt.date.today()
    days = state.get('days', {})
    W = windows(state, today)
    span = [(today - dt.timedelta(days=i)).isoformat() for i in range(89, -1, -1)]

    # site per day
    series = []
    for d in span:
        D = days.get(d, {})
        series.append({'d': d, 'views': sum(D.get('v', {}).values()), 'visitors': len(D.get('s', [])),
                       'new': D.get('new', 0)})

    titles = state.get('titles', {})
    out = {'updated': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'site': SITE,
           'connected': bool(state.get('connected')), 'last_error': state.get('last_error'),
           'first_day': min(days) if days else None, 'series': series, 'windows': {}}

    for w, ds in W.items():
        views = Counter(); ev = defaultdict(Counter); det = defaultdict(lambda: defaultdict(Counter))
        refs = Counter(); refp = defaultdict(Counter); size = Counter(); loc = Counter(); br = Counter()
        sess = set(); new = 0; notes = []
        for d in ds:
            D = days[d]
            for p, n in D.get('v', {}).items():
                views[norm_page(p)] += n
            for p, rp in D.get('refp', {}).items():
                for h, n in rp.items():
                    refp[norm_page(p)][h] += n
            for k, n in D.get('ref', {}).items():
                refs[k] += n
            for k, n in D.get('size', {}).items():
                size[k] += n
            for k, n in D.get('loc', {}).items():
                loc[k] += n
            for k, n in D.get('br', {}).items():
                br[k] += n
            sess.update(D.get('s', []))
            new += D.get('new', 0)
            for path, n in D.get('e', {}).items():
                bits = path.split('|', 2)
                if len(bits) < 2:
                    continue
                kind, page = bits[0], norm_page(bits[1])
                detail = bits[2] if len(bits) > 2 else ''
                ev[page][kind] += n
                if kind == 'note':
                    vote, _, txt = detail.partition(' ')
                    notes.append({'d': d, 'p': page, 'vote': vote if vote in ('up', 'down') else '', 'text': txt[:280]})
                elif detail:
                    det[kind][page][detail[:120]] += n
        pages = []
        allp = set(views) | set(ev)
        for p in allp:
            v = views.get(p, 0)
            e = ev.get(p, Counter())
            if v == 0 and sum(e.values()) < 2:
                continue
            top_src = refp[p].most_common(3)
            src_ev = det['src'].get(p, Counter()).most_common(3)
            pages.append({'p': p, 'title': titles.get(p, ''), 'sec': section(p), 'views': v,
                          'e': {k: e.get(k, 0) for k in EVENT_KINDS if e.get(k)},
                          'src': [[h, n] for h, n in top_src] or [[h, n] for h, n in src_ev],
                          'out': det['out'].get(p, Counter()).most_common(5),
                          'go': det['go'].get(p, Counter()).most_common(8)})
        pages.sort(key=lambda x: (-x['views'], x['p']))
        secs = defaultdict(lambda: {'views': 0, 'pages': 0, 'read50': 0, 't60': 0, 'up': 0, 'down': 0, 'share': 0})
        for pg in pages:
            s = secs[pg['sec']]
            s['views'] += pg['views']; s['pages'] += 1
            for k in ('read50', 't60', 'up', 'down', 'share'):
                s[k] += pg['e'].get(k, 0)
        tot_e = Counter()
        for pg in pages:
            tot_e.update(pg['e'])
        searches = Counter()
        for p, c in det['search'].items():
            searches.update(c)
        shares = Counter()
        for p, c in det['share'].items():
            shares.update(c)
        srcs = Counter()
        for p, c in det['src'].items():
            srcs.update(c)
        front_clicks = Counter()
        for p, c in det['go'].items():
            if p.startswith('/news/#') or p == '/news/':
                front_clicks.update(c)
        outs = Counter()
        for p, c in det['out'].items():
            outs.update(c)
        dls = Counter()
        for p, c in det['dl'].items():
            dls.update(c)
        out['windows'][str(w)] = {
            'days': len(ds), 'views': sum(views.values()), 'visitors': len(sess), 'new': new,
            'events': dict(tot_e), 'pages': pages[:600], 'sections': sorted(
                [dict(name=k, **v) for k, v in secs.items()], key=lambda x: -x['views']),
            'refs': refs.most_common(30), 'arrivals': srcs.most_common(30), 'devices': size.most_common(),
            'countries': loc.most_common(25), 'browsers': br.most_common(10), 'searches': searches.most_common(40),
            'shares': shares.most_common(15), 'front_clicks': front_clicks.most_common(25), 'outbound': outs.most_common(25),
            'downloads': dls.most_common(25), 'notes': sorted(notes, key=lambda x: x['d'], reverse=True)[:200]}
    out['advice'] = advise(out, audit)
    return out


def rate(a, b):
    return a / b if b else 0.0


def advise(stats, audit):
    """Plain rules that turn the counts into things to do. Each: {kind, page, title, text, n}."""
    tips = []
    w30 = stats['windows'].get('30') or {}
    pages = [p for p in w30.get('pages', []) if not p['p'].startswith('/news/r/')]
    total = w30.get('views', 0)
    if total < 30:
        tips.append({'kind': 'reach', 'text': f'Only {total} page views in 30 days: the first job is getting found. Submit '
                     f'{SITE}/sitemap.xml to Google Search Console and Bing Webmaster Tools, and post one piece a day '
                     'where its readers already are (the subreddit, the group chat, the team channel) with its ?s= tag.'})
    reads = [p for p in pages if p['views'] >= 10]
    if reads:
        vs = sorted(p['views'] for p in reads)
        median = vs[len(vs) // 2]
        for p in reads:
            e = p['e']
            r25, r50, r75 = rate(e.get('read25', 0), p['views']), rate(e.get('read50', 0), p['views']), rate(e.get('read75', 0), p['views'])
            t60 = rate(e.get('t60', 0), p['views'])
            if p['views'] <= median and r75 >= .45 and t60 >= .35:
                tips.append({'kind': 'gem', 'page': p['p'], 'title': p['title'], 'n': p['views'],
                             'text': f'{int(r75*100)}% of its readers get three-quarters through and {int(t60*100)}% stay a minute, '
                             f'but only {p["views"]} came. Put it on the front, give it a share card, send it out.'})
            elif p['views'] >= max(median * 2, 25) and r25 < .35:
                tips.append({'kind': 'leak', 'page': p['p'], 'title': p['title'], 'n': p['views'],
                             'text': f'{p["views"]} views, but {int((1-r25)*100)}% leave before a quarter of the page. The top '
                             'is losing them: lead with the finding in one sentence, and the visual before the method.'})
            if rate(e.get('viz', 0), p['views']) >= .4 and r50 < .25:
                tips.append({'kind': 'visual', 'page': p['p'], 'title': p['title'], 'n': p['views'],
                             'text': 'Readers play with the visual and stop there. Put the story into it: captions, '
                             'stops on the camera path, a "what you are looking at" line.'})
            votes = e.get('up', 0) + e.get('down', 0)
            if votes >= 5 and rate(e.get('down', 0), votes) >= .35:
                tips.append({'kind': 'verdict', 'page': p['p'], 'title': p['title'], 'n': votes,
                             'text': f'{e.get("down",0)} of {votes} readers said it was not worth their time. Read their notes.'})
    front = sum(p['views'] for p in pages if p['sec'] == 'Front page')
    clicks = sum(n for _, n in w30.get('front_clicks', []))
    if front >= 20 and rate(clicks, front) < .25:
        tips.append({'kind': 'front', 'n': front, 'text': f'Only {int(rate(clicks, front)*100)} of every 100 front-page visits '
                     'click through to a story. The front is a wall: fewer, bigger leads, and the hero should say what is new today.'})
    outside = max(sum(n for _, n in w30.get('arrivals', [])), sum(n for _, n in w30.get('refs', [])))
    if total >= 30 and rate(outside, total) < .2:
        tips.append({'kind': 'reach', 'text': f'{int((1-rate(outside, total))*100)}% of views come with no outside source: '
                     'mostly regulars and direct links. New readers are not arriving; see the discoverability list below.'})
    titles = ' '.join((p.get('title') or '').lower() for p in pages)
    missed = [t for t, n in w30.get('searches', []) if n >= 2 and t.split()[0] not in titles][:5]
    if missed:
        tips.append({'kind': 'search', 'text': 'Readers searched for things The Watch has not covered: ' +
                     ', '.join(f'"{t}"' for t in missed) + '.'})
    if audit:
        bad = [a for a in audit.get('pages', []) if a.get('issues')]
        if bad:
            tips.append({'kind': 'audit', 'n': len(bad), 'text': f'{len(bad)} pages are missing what search engines and '
                         'link previews need (a description or a share image): ' + ', '.join(a['p'] for a in bad[:6]) +
                         (' and more' if len(bad) > 6 else '') + '.'})
    order = {'reach': 0, 'gem': 1, 'leak': 2, 'front': 3, 'visual': 4, 'verdict': 5, 'search': 6, 'audit': 7}
    tips.sort(key=lambda t: (order.get(t['kind'], 9), -(t.get('n') or 0)))
    return tips[:24]


def digest(stats):
    """A short Markdown readout: what Claude reads first when asked how The Watch is doing."""
    L = [f'# The Pulse — {stats["updated"]}', '']
    if not stats['connected']:
        L += ['Not connected yet: the GOATCOUNTER_TOKEN repo secret is missing.', '']
    for w in ('7', '30'):
        W = stats['windows'].get(w)
        if not W:
            continue
        e = W['events']
        L += [f'## Last {w} days', f'- {W["views"]} page views, {W["visitors"]} visitors ({W["new"]} first visits)',
              f'- read past half: {e.get("read50",0)}; stayed 1 min+: {e.get("t60",0)}; shares: {e.get("share",0)}; '
              f'thumbs {e.get("up",0)} up / {e.get("down",0)} down; notes: {e.get("note",0)}', '']
        L.append('| page | views | read 50% | 1 min+ | 👍/👎 | top source |')
        L.append('|---|---:|---:|---:|---:|---|')
        for p in W['pages'][:20]:
            pe = p['e']
            src = p['src'][0][0] if p['src'] else ''
            L.append(f'| {p["p"]} | {p["views"]} | {int(rate(pe.get("read50",0),p["views"])*100)}% | '
                     f'{int(rate(pe.get("t60",0),p["views"])*100)}% | {pe.get("up",0)}/{pe.get("down",0)} | {src} |')
        L.append('')
        if W['refs']:
            L.append('Sources: ' + ', '.join(f'{h} {n}' for h, n in W['refs'][:10]))
        if W['searches']:
            L.append('Searches: ' + ', '.join(f'{t} ({n})' for t, n in W['searches'][:12]))
        L.append('')
    W = stats['windows'].get('30', {})
    if W.get('notes'):
        L += ['## Reader notes (latest)'] + [f'- {n["d"]} {n["p"]} {n["vote"]}: {n["text"]}' for n in W['notes'][:15]] + ['']
    if stats.get('advice'):
        L += ['## What to do'] + [f'- [{t["kind"]}] {t.get("page","")} {t["text"]}' for t in stats['advice']] + ['']
    return '\n'.join(L)


# ---------------------------------------------------------------------------------------------------------------------
# sample data, for designing the dashboard before real readers arrive
# ---------------------------------------------------------------------------------------------------------------------
def sample():
    random.seed(7)
    pages = [('/news/#/', 'The Watch'), ('/news/wave/', 'The wave'), ('/news/mandate/', 'The Mandate'),
             ('/news/eras/', 'Three waves, one shape'), ('/news/money/', 'Who paid for it'), ('/news/wave/house.html', 'The House, seat by seat'),
             ('/news/wave/ohio.html', 'Ohio'), ('/news/wave/south-texas.html', 'South Texas'), ('/news/primer/', 'Primer'),
             ('/news/prophecy/', 'The Prophecy Watch'), ('/news/mandate/courts.html', 'The courts'), ('/news/wave/border.html', 'The border'),
             ('/news/money/ohio.html', 'Ohio: who paid'), ('/news/wave/county-39049.html', 'Franklin County'), ('/news/#/s/politics', 'Politics'),
             ('/news/home/reel-check/', 'Reel Check'), ('/news/mandate/markets.html', 'Who made money'), ('/news/wave/georgia.html', 'Georgia'),
             ('/news/my/', 'My Watch'), ('/luke/', "Luke's Watch")]
    weights = [30, 22, 14, 9, 8, 7, 7, 5, 4, 4, 3, 3, 3, 2, 6, 3, 2, 2, 2, 2]
    today = dt.date.today()
    state = {'days': {}, 'connected': True, 'titles': {norm_page(p): t for p, t in pages}}
    hosts = ['Google', 'Facebook', 'Reddit', 'X / Twitter', 'Bing', 'LinkedIn', 'news.ycombinator.com', 'Email', 'Bluesky']
    for i in range(60):
        d = (today - dt.timedelta(days=59 - i)).isoformat()
        base = 6 + i * 0.9 + (25 if i in (52, 53) else 0)
        D = {'v': {}, 'e': {}, 's': [], 'ref': {}, 'refp': {}, 'size': {}, 'loc': {}, 'br': {}, 'new': 0}
        for (p, t), wgt in zip(pages, weights):
            n = max(0, int(random.gauss(base * wgt / 30, 1.2)))
            if not n:
                continue
            D['v'][p] = n
            q = {'/news/eras/': .8, '/news/wave/south-texas.html': .75, '/news/money/': .3, '/news/wave/': .45}.get(p, .55)
            for k, f in [('read25', q + .2), ('read50', q), ('read75', q * .7), ('read100', q * .45), ('t30', q + .1),
                         ('t60', q * .8), ('t180', q * .35), ('t600', q * .08), ('viz', .5 if 'wave' in p or 'mandate/' == p[-8:] else .1),
                         ('share', .04), ('up', .06 if q > .5 else .03), ('down', .008 if q > .5 else .02), ('src', .3)]:
                m = sum(1 for _ in range(n) if random.random() < min(f, 1))
                if m:
                    D['e'][f'{k}|{p}' + ('|' + random.choice(['google.com', 'reddit.com', 'friend', 'facebook.com', 'shared-link']) if k == 'src' else '')] = m
            if random.random() < .5:
                h = random.choice(hosts)
                D['ref'][h] = D['ref'].get(h, 0) + 1
                D['refp'].setdefault(p, {})[h] = 1
            if p.startswith('/news/#'):
                for to in ['/news/wave/', '/news/mandate/', '/news/eras/', '/news/money/']:
                    m = sum(1 for _ in range(n) if random.random() < .12)
                    if m:
                        D['e'][f'go|{p}|{to}'] = m
        for t in ['ohio senate', 'franklin county', 'aoc 2028', 'geo group', 'turnout']:
            if random.random() < .15:
                D['e'][f'search|/news/#/q|{t}'] = 1
        if random.random() < .2:
            D['e']['note|/news/eras/|up The 1930 overlay is the best chart I have seen on this. Do 1894 next.'] = 1
        if random.random() < .1:
            D['e']['note|/news/money/|down Too many numbers at the top, I lost the thread.'] = 1
        tot = sum(D['v'].values())
        D['s'] = [f'{random.getrandbits(32):08x}' for _ in range(int(tot * .62))]
        D['new'] = int(tot * .35)
        D['size'] = {'phone': int(tot * .58), 'desktop': int(tot * .34), 'tablet': int(tot * .08)}
        D['loc'] = {'US': int(tot * .86), 'CA': int(tot * .04), 'GB': int(tot * .03), 'BR': int(tot * .03)}
        D['br'] = {'Safari': int(tot * .5), 'Chrome': int(tot * .4), 'Firefox': int(tot * .05)}
        state['days'][d] = D
    audit = load(AUDIT, None)
    s = build(state, audit)
    s['sample'] = True
    return s


# ---------------------------------------------------------------------------------------------------------------------
def load(p, default):
    try:
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def save(p, obj):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, p)


def page_titles():
    """Titles of every page, so the dashboard can name them (from audit.json when it exists)."""
    a = load(AUDIT, {})
    return {x['p']: x.get('title', '') for x in a.get('pages', [])}


def main():
    args = set(sys.argv[1:])
    if '--sample' in args:
        save(SAMPLE, sample())
        log('wrote', SAMPLE)
        return
    state = load(STATE, {'days': {}, 'last_hit_id': 0})
    if '--rebuild' not in args:
        code = os.environ.get('GOATCOUNTER_CODE', '').strip() or 'thewatch-pulse'
        token = os.environ.get('GOATCOUNTER_TOKEN', '').strip()
        if not token:
            log('GOATCOUNTER_TOKEN not set: rebuilding from what we have')
            state['connected'] = False
        else:
            gc = GC(code, token)
            try:
                rows, last = gc.export(int(state.get('last_hit_id') or 0))
                n = fold(state, rows)
                state['last_hit_id'] = last
                state['connected'] = True
                state['last_error'] = None
                state['last_run'] = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%MZ')
                log(f'folded {n} hits; state now {len(state["days"])} days')
            except Exception as e:  # keep what we have; say what went wrong on the dashboard
                msg = str(e)
                if 'once per hour' in msg.lower() or 'HTTP 429' in msg:
                    log('export rate-limited; keeping state:', msg[:200])
                else:
                    state['last_error'] = msg[:500]
                    log('ERROR', msg)
    state['titles'] = page_titles()
    save(STATE, state)
    audit = load(AUDIT, None)
    stats = build(state, audit)
    save(STATS, stats)
    with open(DIGEST, 'w', encoding='utf-8') as f:
        f.write(digest(stats))
    w = stats['windows'].get('30', {})
    log(f'stats: 30 days {w.get("views",0)} views, {w.get("visitors",0)} visitors, {len(stats["advice"])} tips')


if __name__ == '__main__':
    main()
