#!/usr/bin/env python3
"""The Mandate (news/mandate/): Project 2025, two years on — what was done, what the courts stopped, what was promised,
who did it, who has left, what it did to people and who made money. Builds every page from data/*.json:

  chapters.json   the Mandate for Leadership's 30 chapters, authors and proposals; the trackers; the hearing
  scorecard.json  the proposals we track, each with its status and sources
  courts.json     the cases
  promises.json   spoken commitments and their status
  people.json     the roster (with Project 2025 ties) and every departure
  impact.json     the six dossiers (ICE, Iran, foreign aid, health and safety net, households, civil liberties)
  markets.json    key closes and events for the S&P 500, GEO, CoreCivic, Tesla; contracts; who profited; Musk's money
  prices.json     daily closes fetched by fetch.py on GitHub Actions (CNBC); optional
  videos.json     official-channel videos to embed
  analysis.json   the written analysis: sections of prose with [n] citations

  python3 news/mandate/build.py          writes index.html and the section's pages
  python3 news/mandate/build.py check    validates the data files (ids, statuses, dates, every source has a URL)

Nothing here is invented: every figure and quote carries a source URL in the data, and the pages print them.
"""
import datetime as dt
import html
import json
import os
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
SITE = 'https://bboldt86.github.io/lanscape-navigator/news/mandate/'
ET = dt.timezone(dt.timedelta(hours=-5))
START = dt.date(2025, 1, 20)

STATUS = {  # scorecard statuses, in the order they are drawn, with the class the CSS colors
    'done': ('Done', 's-done'), 'in progress': ('In progress', 's-prog'), 'partial': ('Partial', 's-part'),
    'blocked by courts': ('Blocked by courts', 's-block'), 'reversed': ('Reversed', 's-rev'), 'not attempted': ('Not attempted', 's-none'),
}
COURT = {'administration won': ('Administration won', 's-done'), 'administration lost': ('Administration lost', 's-block'), 'mixed': ('Mixed', 's-part'),
         'pending': ('Pending', 's-prog'), 'blocked (injunction in force)': ('Blocked, injunction in force', 's-inj'), 'settled/dropped': ('Settled or dropped', 's-rev')}
PROMISE = {'kept': ('Kept', 's-done'), 'partly kept': ('Partly kept', 's-part'), 'broken': ('Broken', 's-block'), 'stalled': ('Stalled', 's-prog'),
           'reversed': ('Reversed', 's-rev'), 'too early': ('Too early to say', 's-none')}
DEPART = {'fired': 'Fired', 'resigned': 'Resigned', 'pushed out': 'Pushed out', 'reassigned': 'Reassigned', 'term ended': 'Term ended', 'died': 'Died', 'withdrawn': 'Nomination withdrawn'}
SECTIONS = ['Taking the reins of government', 'The common defense', 'The general welfare', 'The economy', 'Independent regulatory agencies']
STREAMS = {'action': 'Actions', 'court': 'Courts', 'promise': 'Promises', 'departure': 'Departures', 'impact': 'Impact', 'market': 'Markets', 'document': 'The document'}


def load(name, default=None):
    p = os.path.join(DATA, name)
    if not os.path.exists(p):
        return default if default is not None else {}
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def esc(s):
    return html.escape(str(s if s is not None else ''), quote=True)


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', (s or '').lower()).strip('-')


def fmt_date(s, long=False):
    """'2025-04-02' -> 'Apr. 2, 2025' (AP style; May, June, July unabbreviated)"""
    if not s:
        return ''
    s = str(s)
    if re.fullmatch(r'\d{4}', s):
        return s
    try:
        d = dt.date.fromisoformat(s[:10] if len(s) >= 10 else s + '-01')
    except ValueError:
        return esc(s)
    mon = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'][d.month - 1]
    if len(s) == 7:
        return f'{mon} {d.year}'
    return f'{mon} {d.day}, {d.year}'


def month_key(s):
    return (s or '')[:7]


def num(n):
    try:
        return f'{int(round(float(n))):,}'
    except (TypeError, ValueError):
        return esc(n)


def pct(a, b):
    return 0 if not b else round(100.0 * a / b)


def md(text):
    """plain text with light markdown (**bold**, *italic*, [n] citations, paragraphs) -> HTML"""
    if not text:
        return ''
    out = []
    for para in re.split(r'\n\s*\n', text.strip()):
        p = esc(para.strip())
        p = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', p)
        p = re.sub(r'(?<!\*)\*(?!\*)(.+?)\*', r'<i>\1</i>', p)
        p = re.sub(r'\[(\d+(?:,\s*\d+)*)\]', lambda m: ''.join(f'<a class="cite" href="#src-{n.strip()}">{n.strip()}</a>' for n in m.group(1).split(',')), p)
        if para.lstrip().startswith('- '):
            items = [re.sub(r'^-\s*', '', l) for l in p.split('\n') if l.strip()]
            out.append('<ul>' + ''.join(f'<li>{i}</li>' for i in items) + '</ul>')
        else:
            out.append(f'<p>{p.replace(chr(10), "<br>")}</p>')
    return '\n'.join(out)


# ---------------------------------------------------------------------------------------------------------------- chrome
THEME_JS = """<script>
(function(){try{var p=JSON.parse(localStorage.getItem('watch.v1')||'{}');var t=p.theme||'auto';var h=+new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',hourCycle:'h23'}).format(new Date());
if(t==='auto'){t=(h>=20||h<4)?'night':(matchMedia('(prefers-color-scheme: dark)').matches?'night':'day')}document.documentElement.dataset.theme=t;}catch(e){}})();
</script>"""
ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='2' y='2' width='60' height='60' rx='14' fill='%2315243B'/%3E%3Cpath d='M14 44 L26 30 L36 36 L50 18' fill='none' stroke='%23D6B25E' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"
NAV = [('index.html', 'The analysis'), ('scorecard.html', 'Scorecard'), ('courts.html', 'Courts'), ('promises.html', 'Promises'), ('people.html', 'Cabinet & departures'),
       ('impact.html', 'Human cost'), ('markets.html', 'Markets'), ('musk.html', 'Musk'), ('timeline.html', 'Timeline'), ('reel.html', 'Reel'), ('3d.html', '3-D')]


def head(title, desc, path, image='share.png', extra=''):
    url = SITE + ('' if path == 'index.html' else path)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)} · The Watch</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="The Watch">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}{image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F5F7F6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E1A2B" media="(prefers-color-scheme: dark)">
<link rel="apple-touch-icon" href="../icon-180.png">
<link rel="icon" href="{ICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
{THEME_JS}
<link rel="stylesheet" href="mandate.css">
{extra}
</head>
<body>
{THEME_JS}"""


def mast(current, meta):
    items = ''.join(f'<a href="{p}"{" aria-current=\"page\"" if p == current else ""}>{esc(t)}</a>' for p, t in NAV)
    return f"""<header class="mast"><div class="wrap">
  <a class="back" href="../#/s/politics"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#15243B"/><circle cx="32" cy="32" r="21" fill="none" stroke="#D6B25E" stroke-width="6" stroke-dasharray="19 3"/><path d="M32 32 L46 14" stroke="#F5F7F6" stroke-width="5" stroke-linecap="round"/></svg>The Watch <span>· Politics · The Mandate</span></a>
  <div class="mast-r"><button type="button" class="tbtn" data-share>Share</button></div>
</div></header>
<nav class="subnav" aria-label="The Mandate"><div class="wrap">{items}</div></nav>"""


def foot(meta, sources=None, method=None):
    built = meta.get('built', '')
    src_html = ''
    if sources:
        rows = ''.join(f'<li id="src-{i + 1}"><span class="n">{i + 1}</span><a href="{esc(s["url"])}" rel="noopener">{esc(s.get("title") or s["url"])}</a>'
                       f'{(" <span class=pub>" + esc(s["publisher"]) + "</span>") if s.get("publisher") else ""}{(" <span class=dt>" + fmt_date(s["date"]) + "</span>") if s.get("date") else ""}</li>' for i, s in enumerate(sources))
        src_html = f'<section class="sources narrow" id="sources"><h2>The receipts</h2><p class="muted">{len(sources)} sources, each linked where it was read. Numbers in brackets in the text point here.</p><ol class="srclist">{rows}</ol></section>'
    meth = f'<section class="method narrow"><h2>How this was made</h2>{md(method)}</section>' if method else ''
    return f"""{src_html}{meth}
<footer class="foot"><div class="narrow"><p>The Mandate is a section of <a href="../">The Watch</a>, built on <a href="https://github.com/BBOLDT86/lanscape-navigator">LANscape Navigator</a>. Researched and written by Claude for The Watch; the record is kept in <code>news/mandate/data/</code> and refreshed in weekly sprints. Built {esc(built)}.</p>
<p>Nothing on this page is invented: every figure, quote, ruling and date carries a link to where it was read. Where sources disagree, the text says so. Corrections: open an issue on the repository.</p></div></footer>
<script type="module" src="mandate.js"></script>
</body></html>"""


def pill(kind, status):
    table = {'score': STATUS, 'court': COURT, 'promise': PROMISE}[kind]
    label, cls = table.get(status, (status.title() if status else '—', 's-none'))
    return f'<span class="pill {cls}">{esc(label)}</span>'


def people_index(people):
    """name -> id, for linking officials in text; last names too when unique"""
    idx = {}
    lasts = Counter()
    for p in people.get('roster', []):
        idx[p['name'].lower()] = p['id']
        lasts[p['name'].split()[-1].lower()] += 1
    for p in people.get('roster', []):
        ln = p['name'].split()[-1].lower()
        if lasts[ln] == 1:
            idx[ln] = p['id']
    return idx


def chips(names, pidx):
    out = []
    for n in names or []:
        key = n.lower()
        pid = pidx.get(key) or pidx.get(key.split()[-1]) if key else None
        if pid:
            out.append(f'<a class="chip" href="people.html#{pid}">{esc(n)}</a>')
        else:
            out.append(f'<span class="chip">{esc(n)}</span>')
    return f'<span class="chips">{"".join(out)}</span>' if out else ''


def srcs(items, limit=3):
    out = []
    for s in (items or [])[:limit]:
        if isinstance(s, str):
            out.append(f'<a href="{esc(s)}" rel="noopener">{esc(host(s))}</a>')
        elif s.get('url'):
            label = s.get('publisher') or host(s['url'])
            out.append(f'<a href="{esc(s["url"])}" rel="noopener" title="{esc(s.get("title", ""))}">{esc(label)}{(", " + fmt_date(s["date"])) if s.get("date") else ""}</a>')
    return f'<span class="srcs">{" · ".join(out)}</span>' if out else ''


def host(url):
    m = re.match(r'https?://(?:www\.)?([^/]+)', url or '')
    return m.group(1) if m else url


# ---------------------------------------------------------------------------------------------------------------- charts
def segbar(counts, order, table, title, total_label='tracked'):
    """the tall segmented bar: shares of statuses, with the legend, labels on the segments"""
    total = sum(counts.get(k, 0) for k in order) or 1
    segs, leg = [], []
    x = 0.0
    for k in order:
        n = counts.get(k, 0)
        if not n:
            continue
        w = 100.0 * n / total
        label, cls = table[k]
        segs.append(f'<div class="seg {cls}" style="width:{w:.2f}%" title="{esc(label)}: {n}">{f"<b>{n}</b>" if w > 6 else ""}</div>')
        leg.append(f'<li><i class="sw {cls}"></i>{esc(label)} <b>{n}</b> <span class="muted">{pct(n, total)}%</span></li>')
        x += w
    return f'<figure class="segfig"><figcaption><b>{esc(title)}</b> <span class="muted">{total} {esc(total_label)}</span></figcaption><div class="segbar">{"".join(segs)}</div><ul class="legend">{"".join(leg)}</ul></figure>'


def hbars(rows, title, unit='', cls='s-done', maxv=None, link=None):
    """ranked horizontal bars: rows = [(label, value, sublabel?, href?)]"""
    if not rows:
        return ''
    mx = maxv or max(r[1] for r in rows) or 1
    out = []
    for r in rows:
        label, v = r[0], r[1]
        sub = r[2] if len(r) > 2 and r[2] else ''
        href = r[3] if len(r) > 3 and r[3] else None
        lab = f'<a href="{esc(href)}">{esc(label)}</a>' if href else esc(label)
        out.append(f'<div class="hb"><span class="hb-l">{lab}{f"<small>{esc(sub)}</small>" if sub else ""}</span><span class="hb-t"><i class="{cls}" style="width:{100.0 * v / mx:.1f}%"></i></span><span class="hb-v">{num(v)}{esc(unit)}</span></div>')
    return f'<figure class="hbars"><figcaption><b>{esc(title)}</b></figcaption>{"".join(out)}</figure>'


def stacked_rows(groups, order, table, title, href=None):
    """one stacked bar per group (e.g. per section of the Mandate): groups = [(label, Counter, href)]"""
    out = []
    for label, cnt, h in groups:
        total = sum(cnt.get(k, 0) for k in order) or 1
        segs = ''.join(f'<i class="{table[k][1]}" style="width:{100.0 * cnt.get(k, 0) / total:.1f}%" title="{esc(table[k][0])}: {cnt.get(k, 0)}"></i>' for k in order if cnt.get(k, 0))
        done = cnt.get('done', 0) + cnt.get('kept', 0) + cnt.get('administration won', 0)
        lab = f'<a href="{esc(h)}">{esc(label)}</a>' if h else esc(label)
        out.append(f'<div class="srow"><span class="srow-l">{lab}</span><span class="srow-t">{segs}</span><span class="srow-v">{done}/{total}</span></div>')
    return f'<figure class="stacked"><figcaption><b>{esc(title)}</b></figcaption>{"".join(out)}</figure>'


def month_bars(items, title, key='date', start=START, end=None, cls='s-block', note=''):
    """counts per month from start to end, as thin bars with the month labels; items carry a date"""
    end = end or dt.date.today()
    months = []
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        months.append(f'{y:04d}-{m:02d}')
        m += 1
        if m == 13:
            y, m = y + 1, 1
    cnt = Counter(month_key(i.get(key)) for i in items if i.get(key))
    mx = max([cnt.get(k, 0) for k in months] + [1])
    bars = ''.join(f'<div class="mb" title="{fmt_date(k)}: {cnt.get(k, 0)}"><i class="{cls}" style="height:{100.0 * cnt.get(k, 0) / mx:.0f}%"></i><span>{"JFMAMJJASOND"[int(k[5:]) - 1]}</span>{f"<em>{k[:4]}</em>" if k.endswith("-01") or k == months[0] else ""}</div>' for k in months)
    return f'<figure class="monthfig"><figcaption><b>{esc(title)}</b> <span class="muted">{esc(note)}</span></figcaption><div class="months">{bars}</div></figure>'


def cum_line(items, title, key='date', start=START, end=None, cls='s-block'):
    """a cumulative count by day as an SVG line (departures since Jan. 20, 2025)"""
    end = end or dt.date.today()
    days = (end - start).days or 1
    dates = sorted(i[key][:10] for i in items if i.get(key))
    pts, n = [(0, 0)], 0
    for d in dates:
        try:
            x = (dt.date.fromisoformat(d) - start).days
        except ValueError:
            continue
        if x < 0:
            continue
        pts.append((x, n))
        n += 1
        pts.append((x, n))
    pts.append((days, n))
    W, H, pad = 640, 220, 28
    sx = lambda x: pad + (W - 2 * pad) * x / days
    sy = lambda y: H - pad - (H - 2 * pad) * y / (n or 1)
    path = ' '.join(f'{"M" if i == 0 else "L"}{sx(x):.1f},{sy(y):.1f}' for i, (x, y) in enumerate(pts))
    grid = ''.join(f'<line x1="{pad}" x2="{W - pad}" y1="{sy(v):.1f}" y2="{sy(v):.1f}" class="grid"/><text x="{pad - 6}" y="{sy(v) + 4:.1f}" class="ax" text-anchor="end">{v}</text>' for v in sorted({0, n // 2, n}))
    ticks = ''
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        d = dt.date(y, m, 1)
        if d >= start and m in (1, 4, 7, 10):
            x = sx((d - start).days)
            ticks += f'<text x="{x:.1f}" y="{H - 8}" class="ax" text-anchor="middle">{["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} {str(y)[2:]}</text>'
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return f'<figure class="linefig"><figcaption><b>{esc(title)}</b> <span class="muted">{n} since Jan. 20, 2025</span></figcaption><svg viewBox="0 0 {W} {H}" class="line {cls}" role="img" aria-label="{esc(title)}">{grid}{ticks}<path d="{path}" class="ln"/><circle cx="{sx(days):.1f}" cy="{sy(n):.1f}" r="4" class="dot"/><text x="{sx(days) - 8:.1f}" y="{sy(n) - 10:.1f}" class="lab" text-anchor="end">{n}</text></svg></figure>'


def index_chart(series, title, note='', base_date='2025-01-20'):
    """several price series indexed to 100 on base_date, one axis (never two). series = {label: [[date, close], ...]};
    draws an SVG and carries the data for the hover layer in data-series"""
    series = {k: v for k, v in series.items() if v and len(v) > 2}
    if not series:
        return ''
    idx = {}
    for k, pts in series.items():
        pts = sorted(pts)
        base = next((c for d, c in pts if d >= base_date), pts[0][1])
        idx[k] = [(d, 100.0 * c / base) for d, c in pts if d >= base_date and c]
    alld = sorted({d for v in idx.values() for d, _ in v})
    if len(alld) < 2:
        return ''
    d0, d1 = dt.date.fromisoformat(alld[0]), dt.date.fromisoformat(alld[-1])
    span = max((d1 - d0).days, 1)
    vals = [v for s in idx.values() for _, v in s]
    lo, hi = min(vals), max(vals)
    lo, hi = min(lo, 100) * 0.95, max(hi, 100) * 1.05
    W, H, pad, padl = 720, 300, 24, 44
    sx = lambda d: padl + (W - padl - pad) * (dt.date.fromisoformat(d) - d0).days / span
    sy = lambda v: H - pad - (H - 2 * pad) * (v - lo) / (hi - lo or 1)
    order = ['S&P 500', 'Nasdaq', 'GEO Group', 'CoreCivic', 'Tesla', 'Palantir']
    keys = [k for k in order if k in idx] + [k for k in idx if k not in order]
    paths, labels, legend = [], [], []
    for i, k in enumerate(keys):
        pts = idx[k]
        d = ' '.join(f'{"M" if j == 0 else "L"}{sx(x):.1f},{sy(y):.1f}' for j, (x, y) in enumerate(pts))
        paths.append(f'<path d="{d}" class="c{i}" data-k="{esc(k)}"/>')
        labels.append(f'<text x="{sx(pts[-1][0]) + 6:.1f}" y="{sy(pts[-1][1]) + 4:.1f}" class="lab c{i}">{esc(k)} {pts[-1][1]:.0f}</text>')
        legend.append(f'<li><i class="sw c{i}"></i>{esc(k)} <b>{pts[-1][1] - 100:+.0f}%</b></li>')
    grid = ''
    step = 25 if hi - lo > 120 else 10
    v = int(lo // step + 1) * step
    while v < hi:
        grid += f'<line x1="{padl}" x2="{W - pad}" y1="{sy(v):.1f}" y2="{sy(v):.1f}" class="grid{" base" if v == 100 else ""}"/><text x="{padl - 6}" y="{sy(v) + 4:.1f}" class="ax" text-anchor="end">{v}</text>'
        v += step
    ticks = ''
    y, m = d0.year, d0.month
    while (y, m) <= (d1.year, d1.month):
        d = dt.date(y, m, 1)
        if d >= d0 and m in (1, 4, 7, 10):
            ticks += f'<text x="{sx(d.isoformat()):.1f}" y="{H - 6}" class="ax" text-anchor="middle">{["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} {str(y)[2:]}</text>'
        m += 1
        if m == 13:
            y, m = y + 1, 1
    data = json.dumps({k: [[d, round(v, 1)] for d, v in idx[k]] for k in keys}, separators=(',', ':'))
    return (f'<figure class="idxfig" data-series=\'{esc(data)}\' data-x0="{alld[0]}" data-x1="{alld[-1]}" data-lo="{lo:.2f}" data-hi="{hi:.2f}" data-w="{W}" data-h="{H}" data-pad="{pad}" data-padl="{padl}">'
            f'<figcaption><b>{esc(title)}</b> <span class="muted">{esc(note)}</span></figcaption>'
            f'<div class="idxwrap"><svg viewBox="0 0 {W} {H}" class="idx" role="img" aria-label="{esc(title)}">{grid}{ticks}{"".join(paths)}{"".join(labels)}<g class="hover" hidden><line class="x" y1="{pad}" y2="{H - pad}"/></g></svg><div class="tip" hidden></div></div>'
            f'<ul class="legend">{"".join(legend)}</ul></figure>')


def stat(value, label, cls=''):
    return f'<div class="stat {cls}"><b>{value}</b><span>{label}</span></div>'


def renders_html():
    """The Watch's own MP4s, when render.py has made them"""
    out = []
    for f, title, note, vert in (('tour.mp4', 'The fly-through: the 30 chapters in 3-D', 'One pass of the tour, 1920×1080.', False), ('reel-vertical.mp4', 'The reel, for a phone', 'The headline figures, one card each, 1080×1920.', True), ('reel-wide.mp4', 'The reel, 16:9', 'The same cards for a screen.', False)):
        if os.path.exists(os.path.join(HERE, f)):
            out.append(f'<div class="vcard{" vert" if vert else ""}"><video controls preload="metadata" playsinline src="{f}"></video><div class="vmeta"><span class="k">The Watch · render</span><b>{esc(title)}</b><span class="muted">{esc(note)} <a href="{f}" download>Download</a></span></div></div>')
    return ''.join(out)


def video_embed(v):
    """an official channel's YouTube video, privacy-enhanced player, loaded only on tap"""
    vid = v.get('youtube')
    if not vid:
        return f'<a class="vcard ext" href="{esc(v.get("url", "#"))}" rel="noopener"><span class="k">{esc(v.get("channel", ""))}</span><b>{esc(v.get("title", ""))}</b><span class="muted">{esc(v.get("note", ""))}</span></a>'
    return (f'<div class="vcard" data-yt="{esc(vid)}"><button type="button" class="vposter" aria-label="Play {esc(v.get("title", ""))}"><img src="https://i.ytimg.com/vi/{esc(vid)}/hqdefault.jpg" alt="" loading="lazy"><span class="play"></span></button>'
            f'<div class="vmeta"><span class="k">{esc(v.get("channel", ""))}{(" · " + fmt_date(v["date"])) if v.get("date") else ""}</span><b>{esc(v.get("title", ""))}</b>{f"<span class=muted>{esc(v['note'])}</span>" if v.get("note") else ""}</div></div>')


# ---------------------------------------------------------------------------------------------------------------- data
def all_sources(*lists):
    """de-duplicated source list in first-seen order, by URL"""
    seen, out = set(), []
    for lst in lists:
        for s in lst or []:
            if isinstance(s, str):
                s = {'url': s}
            u = (s or {}).get('url')
            if not u or u in seen:
                continue
            seen.add(u)
            out.append(s)
    return out


def item_sources(items, key='sources'):
    out = []
    for it in items or []:
        out.extend(it.get(key) or [])
    return out


def timeline_events(sc, courts, promises, people, impact, markets, chapters):
    """every dated thing, as one stream"""
    ev = []
    for it in sc.get('items', []):
        for d in it.get('dates') or []:
            ev.append({'date': d, 'stream': 'action', 'title': it.get('action', '')[:160], 'sub': it.get('proposal', ''), 'status': it.get('status'), 'href': f'scorecard.html#{it["id"]}', 'officials': it.get('people', []), 'url': ((it.get('sources') or [{}])[0]).get('url')})
    for c in courts.get('cases', []):
        for d in c.get('dates') or []:
            ev.append({'date': d['date'], 'stream': 'court', 'title': f'{c["name"]}: {d["event"]}', 'sub': c.get('court', ''), 'status': c.get('status'), 'href': f'courts.html#{c["id"]}', 'officials': c.get('officials', []), 'url': ((c.get('sources') or [{}])[0]).get('url')})
    for p in promises.get('promises', []):
        if p.get('said_on'):
            ev.append({'date': p['said_on'], 'stream': 'promise', 'title': f'“{p["quote"][:140]}”', 'sub': f'{p.get("said_by", "")}, {p.get("venue", "")}'.strip(', '), 'status': p.get('status'), 'href': f'promises.html#{p["id"]}', 'officials': p.get('officials', []), 'url': p.get('quote_source')})
    for d in people.get('departures', []):
        ev.append({'date': d['date'], 'stream': 'departure', 'title': f'{d["name"]} {DEPART.get(d.get("type"), d.get("type", "")).lower()}: {d.get("post", "")}', 'sub': d.get('reason', ''), 'status': d.get('type'), 'href': f'people.html#dep-{d["id"]}', 'officials': [], 'url': (d.get('sources') or [None])[0]})
    for dz in impact.get('dossiers', []):
        for e in dz.get('events', []):
            ev.append({'date': e['date'], 'stream': 'impact', 'title': e['what'][:180], 'sub': dz.get('title', ''), 'status': None, 'href': f'impact.html#{dz["id"]}', 'officials': e.get('officials', []), 'url': e.get('source')})
    for r in markets.get('spx', []):
        if r.get('event'):
            ev.append({'date': r['date'], 'stream': 'market', 'title': f'S&P 500 {r["close"]:,.0f}: {r["event"]}', 'sub': '', 'status': None, 'href': 'markets.html', 'officials': [], 'url': r.get('source')})
    for key, label in (('geo', 'GEO Group'), ('cxw', 'CoreCivic')):
        for r in (markets.get(key) or {}).get('prices', []):
            if r.get('event'):
                ev.append({'date': r['date'], 'stream': 'market', 'title': f'{label} ${r["close"]:.2f}: {r["event"]}', 'sub': '', 'status': None, 'href': 'markets.html#' + key, 'officials': [], 'url': r.get('source')})
        for c in (markets.get(key) or {}).get('contracts', []):
            if c.get('date'):
                ev.append({'date': c['date'], 'stream': 'market', 'title': f'{label}: {c["what"]}', 'sub': c.get('value', ''), 'status': None, 'href': 'markets.html#' + key, 'officials': [], 'url': c.get('source')})
    for e in (markets.get('tesla') or {}).get('events', []):
        ev.append({'date': e['date'], 'stream': 'market', 'title': e['what'][:180], 'sub': 'Tesla / Musk', 'status': None, 'href': 'musk.html', 'officials': [], 'url': e.get('source')})
    for h in chapters.get('history', []):
        ev.append({'date': h['date'], 'stream': 'document', 'title': h['what'], 'sub': '', 'status': None, 'href': 'index.html#document', 'officials': [], 'url': h.get('source')})
    ev = [e for e in ev if e.get('date') and re.match(r'\d{4}-\d{2}', e['date'])]
    ev.sort(key=lambda e: (e['date'], e['stream']))
    return ev


# ---------------------------------------------------------------------------------------------------------------- pages
def page_index(D, meta, pidx):
    sc, courts, promises, people, impact, markets, chapters, analysis, videos = (D[k] for k in ('scorecard', 'courts', 'promises', 'people', 'impact', 'markets', 'chapters', 'analysis', 'videos'))
    items = sc.get('items', [])
    tally = Counter(i['status'] for i in items)
    ctally = Counter(c['status'] for c in courts.get('cases', []))
    ptally = Counter(p['status'] for p in promises.get('promises', []))
    deps = people.get('departures', [])
    roster = people.get('roster', [])
    done_ish = tally['done'] + tally['in progress'] + tally['partial']
    hero = analysis.get('hero', {})
    title = hero.get('title') or 'Project 2025, two years on'
    dek = hero.get('dek') or ''
    srcs_all = all_sources(analysis.get('sources'))
    ice = next((d for d in impact.get('dossiers', []) if d['id'] == 'ice'), {})
    ice_deaths = next((f for f in ice.get('headline_figures', []) if 'death' in f['label'].lower()), None)

    # the chapters, grouped by section, with each chapter's tracked items
    by_ch = defaultdict(list)
    for it in items:
        by_ch[it.get('chapter')].append(it)
    sec_groups = []
    for s in SECTIONS:
        chs = [c for c in chapters.get('chapters', []) if c.get('section') == s]
        cnt = Counter(i['status'] for c in chs for i in by_ch.get(c['num'], []))
        sec_groups.append((s, cnt, f'scorecard.html#sec-{slug(s)}'))

    out = [head(title, dek, 'index.html', extra='<script type="module" src="mandate3d.js" defer></script>'), mast('index.html', meta)]
    # the visual
    out.append(f"""<section class="viz" aria-label="The visual">
  <div class="viz-stage" id="stage"><div id="m3d" class="m3d-root" data-src="data/3d.json"></div>
    <button type="button" class="fs-close" id="fsClose">Exit full screen</button>
    <div class="fs-bar"><button type="button" id="hideHud">Hide / show text</button></div>
  </div>
  <div class="viz-bar" id="vizbar">
    <div class="seg" role="group" aria-label="View"><button type="button" data-view="city" aria-pressed="true">The 30 chapters</button><button type="button" data-view="tour" aria-pressed="false">Fly-through</button></div>
    <button type="button" class="vb" id="playBtn" aria-pressed="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg><span>Pause</span></button>
    <button type="button" class="vb" id="fsBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>Full screen</button>
    <a class="vb" href="reel.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 17h2"/></svg>Reel mode</a>
    <a class="vb" href="3d.html">Open the 3-D view</a>
    {'<a class="vb" href="tour.mp4" download>Download the video</a>' if os.path.exists(os.path.join(HERE, 'tour.mp4')) else ''}
    <span class="hint">Every chapter of the Mandate for Leadership as a tower: one block per proposal The Watch tracks, lit by what became of it. Drag to turn, scroll to zoom, tap a tower for its chapter. Full screen to record it; reel mode for a phone.</span>
  </div>
  <div class="county-card" id="chapterCard" hidden aria-live="polite"></div>
</section>
<main>
<div class="narrow head"><p class="k">The Watch report · Politics · The Mandate</p><h1>{esc(title)}</h1><p class="dek">{esc(dek)}</p>
<p class="byline">By <b>Claude</b> (Claude Fable 5.1) for The Watch, {esc(hero.get('dateline', fmt_date(meta.get('asof', ''))))}. {len(srcs_all)} sources on this page; {esc(meta.get('counts', ''))} across the section. Updated in weekly sprints; last {esc(meta.get('built_h', ''))}.</p></div>
<div class="narrow body">
<div class="stat-row">{stat(f'{pct(done_ish, len(items))}%', f'of the {len(items)} Project 2025 proposals we track are done, under way or partly done')}{stat(ctally['administration lost'] + ctally['blocked (injunction in force)'], f'of {sum(ctally.values())} major cases lost or blocked in court so far', 'r')}{stat(ptally['broken'] + ptally['reversed'], f'of {sum(ptally.values())} spoken commitments broken or reversed', 'r')}{stat(len(deps), 'senior departures since Jan. 20, 2025')}{stat(ice_deaths.get('short') or ice_deaths['value'], ice_deaths['label'], 'r') if ice_deaths else ''}</div>
""")
    # the written analysis, section by section, with the figures placed where the text asks (a section's "figure" key)
    figs = {
        'scorecard': segbar(tally, list(STATUS), STATUS, 'What became of the proposals we track', 'proposals') + stacked_rows(sec_groups, list(STATUS), STATUS, 'By section of the Mandate'),
        'courts': segbar(ctally, list(COURT), COURT, 'The cases', 'cases'),
        'promises': segbar(ptally, list(PROMISE), PROMISE, 'The commitments', 'commitments'),
        'departures': cum_line(deps, 'Departures from the administration, cumulative') + month_bars(deps, 'By month', note='fired, resigned, pushed out or reassigned'),
        'markets': index_chart(price_series(markets, D.get('prices')), 'Indexed to 100 on Jan. 20, 2025', 'closing prices; one axis, so the lines compare'),
    }
    for sec in analysis.get('sections', []):
        out.append(f'<section class="asec" id="{esc(sec.get("id", slug(sec["title"])))}"><h2>{esc(sec["title"])}</h2>{md(sec.get("text", ""))}')
        if sec.get('figure') in figs:
            out.append(figs[sec['figure']])
        if sec.get('list') == 'top-actions':
            out.append(rows_scorecard([i for i in items if i.get('featured')] or items[:10], pidx, compact=True))
            out.append('<p class="more"><a href="scorecard.html">The full scorecard, with filters ›</a></p>')
        if sec.get('list') == 'top-cases':
            out.append(rows_courts([c for c in courts.get('cases', []) if c.get('featured')] or courts.get('cases', [])[:8], pidx, compact=True))
            out.append('<p class="more"><a href="courts.html">Every case ›</a></p>')
        if sec.get('list') == 'top-promises':
            out.append(rows_promises([p for p in promises.get('promises', []) if p.get('featured')] or promises.get('promises', [])[:8], pidx, compact=True))
            out.append('<p class="more"><a href="promises.html">Every commitment ›</a></p>')
        if sec.get('list') == 'cabinet':
            out.append(cabinet_grid([p for p in roster if p.get('p2025') and p['p2025'].lower() not in ('none', 'none known', '')], pidx, compact=True))
            out.append('<p class="more"><a href="people.html">The whole roster, and every departure ›</a></p>')
        if sec.get('list') == 'departures':
            out.append(rows_departures(sorted(deps, key=lambda d: d['date'], reverse=True)[:10], compact=True))
            out.append('<p class="more"><a href="people.html#departures">All departures ›</a></p>')
        if sec.get('list') == 'dossiers':
            out.append(dossier_cards(impact.get('dossiers', [])))
        if sec.get('list') == 'videos':
            out.append('<div class="vgrid">' + renders_html() + ''.join(video_embed(v) for v in videos.get('videos', []) if v.get('where') in (None, 'index')) + '</div>')
        if sec.get('list') == 'timeline':
            ev = D['timeline']
            out.append(timeline_html([e for e in ev if e.get('stream') in ('action', 'court', 'departure') and e['date'] >= '2025-01-20'][-14:], pidx, compact=True))
            out.append('<p class="more"><a href="timeline.html">The whole record, by month ›</a></p>')
        out.append('</section>')
    out.append('</div></main>')
    out.append(foot(meta, srcs_all, analysis.get('method')))
    return ''.join(out)


def price_series(markets, prices):
    """the series the index chart draws: fetched daily closes when the Action has run, else the key closes from the research"""
    names = {'.SPX': 'S&P 500', '.IXIC': 'Nasdaq', 'GEO': 'GEO Group', 'CXW': 'CoreCivic', 'TSLA': 'Tesla', 'PLTR': 'Palantir'}
    out = {}
    if prices and prices.get('series'):
        for sym, pts in prices['series'].items():
            if sym in names and pts:
                out[names[sym]] = [[p[0], p[1]] for p in pts]
    if not out:
        out['S&P 500'] = [[r['date'], r['close']] for r in markets.get('spx', []) if r.get('close')]
        for key, label in (('geo', 'GEO Group'), ('cxw', 'CoreCivic'), ('tesla', 'Tesla')):
            out[label] = [[r['date'], r['close']] for r in (markets.get(key) or {}).get('prices', []) if r.get('close')]
    return out


def rows_scorecard(items, pidx, compact=False):
    rows = []
    for it in items:
        dates = ', '.join(fmt_date(d) for d in (it.get('dates') or [])[:3])
        rows.append(f'<article class="row" id="{esc(it["id"])}" data-status="{esc(it["status"])}" data-section="{esc(it.get("section", ""))}" data-area="{esc(it.get("area", ""))}" data-officials="{esc("|".join(it.get("people") or []))}">'
                    f'<div class="row-h">{pill("score", it["status"])}<span class="k">Ch. {esc(it.get("chapter", "?"))} · {esc(it.get("area", ""))}</span>{f"<span class=k2>{esc(dates)}</span>" if dates else ""}</div>'
                    f'<h3>{esc(it.get("proposal", ""))}</h3><p>{esc(it.get("action", ""))}{(" <i class=note>" + esc(it["note"]) + "</i>") if it.get("note") and not compact else ""}</p>'
                    f'<div class="row-f">{chips(it.get("people"), pidx)}{srcs(it.get("sources"))}</div></article>')
    return f'<div class="rows">{"".join(rows)}</div>'


def rows_courts(cases, pidx, compact=False):
    rows = []
    for c in cases:
        ds = c.get('dates') or []
        dl = '' if compact else '<ol class="dates">' + ''.join(f'<li><span>{fmt_date(d["date"])}</span><span class="tx">{esc(d["event"])}</span></li>' for d in ds) + '</ol>'
        last = ds[-1] if ds else None
        rows.append(f'<article class="row" id="{esc(c["id"])}" data-status="{esc(c["status"])}" data-topic="{esc(c.get("topic", ""))}" data-officials="{esc("|".join(c.get("officials") or []))}">'
                    f'<div class="row-h">{pill("court", c["status"])}<span class="k">{esc(c.get("topic", ""))} · {esc(c.get("court", ""))}</span></div>'
                    f'<h3>{esc(c["name"])}</h3><p>{esc(c.get("stake", ""))}</p>{f"<p class=latest><b>Latest</b> {fmt_date(last['date'])}: {esc(last['event'])}</p>" if last and compact else ""}{dl}'
                    f'{("<p class=p25><b>Project 2025</b> " + esc(c["p2025_link"]) + "</p>") if c.get("p2025_link") and not compact else ""}'
                    f'<div class="row-f">{chips(c.get("officials"), pidx)}{srcs(c.get("sources"))}</div></article>')
    return f'<div class="rows">{"".join(rows)}</div>'


def rows_promises(ps, pidx, compact=False):
    rows = []
    for p in ps:
        q = p.get('quote', '')
        rows.append(f'<article class="row" id="{esc(p["id"])}" data-status="{esc(p["status"])}" data-topic="{esc(p.get("topic", ""))}" data-officials="{esc("|".join(p.get("officials") or []))}">'
                    f'<div class="row-h">{pill("promise", p["status"])}<span class="k">{esc(p.get("topic", ""))}</span><span class="k2">{esc(p.get("said_by", ""))}, {fmt_date(p.get("said_on"))}{(", " + esc(p["venue"])) if p.get("venue") else ""}</span></div>'
                    f'<blockquote>“{esc(q)}”{f" <a class=qsrc href={esc(p['quote_source'])!r} rel=noopener>source</a>" if p.get("quote_source") else ""}</blockquote>'
                    f'<p>{esc(p.get("evidence", ""))}</p><div class="row-f">{chips(p.get("officials"), pidx)}{srcs(p.get("sources"))}</div></article>')
    return f'<div class="rows">{"".join(rows)}</div>'


def cabinet_grid(roster, pidx, compact=False):
    cards = []
    for p in roster:
        acts = p.get('actions') or []
        al = '' if compact else '<ul class="acts">' + ''.join(f'<li><span>{fmt_date(a.get("date"))}</span><span class="tx">{esc(a["what"])}{f" <a href={esc(a['source'])!r} rel=noopener>↗</a>" if a.get("source") else ""}</span></li>' for a in acts) + '</ul>'
        ctr = '' if compact or not p.get('controversies') else '<p class="ctr"><b>Flagged:</b> ' + esc('; '.join(p['controversies'])) + '</p>'
        gone = '' if p.get('serving', True) else '<span class="pill s-block">Departed</span>'
        p25 = p.get('p2025') or ''
        tie = '' if p25.lower() in ('', 'none', 'none known') else f'<p class="tie"><b>Project 2025:</b> {esc(p25)}</p>'
        cards.append(f'<article class="pcard" id="{esc(p["id"])}" data-serving="{str(bool(p.get("serving", True))).lower()}" data-p25="{"yes" if tie else "no"}">'
                     f'<div class="row-h"><span class="k">{esc(p.get("post", ""))}</span>{gone}{f"<span class=k2>Ch. {p['chapter']}</span>" if p.get("chapter") else ""}</div><h3>{esc(p["name"])}</h3>{tie}'
                     f'{(f"<p class=muted>Since {fmt_date(p['start'])}.</p>" if p.get("start") and not compact else "")}{al}{ctr}'
                     f'<div class="row-f">{srcs([{"url": u} for u in (p.get("sources") or [])] if p.get("sources") and isinstance(p["sources"][0], str) else p.get("sources"))}</div></article>')
    return f'<div class="pgrid">{"".join(cards)}</div>'


def rows_departures(deps, compact=False):
    rows = []
    for d in deps:
        rows.append(f'<li class="dep" id="dep-{esc(d["id"])}" data-type="{esc(d.get("type", ""))}"><span class="dd">{fmt_date(d["date"])}</span><span class="dn"><b>{esc(d["name"])}</b> <span class="muted">{esc(d.get("post", ""))}</span></span>'
                    f'<span class="dt pill s-rev">{esc(DEPART.get(d.get("type"), d.get("type", "")))}</span><span class="dr">{esc(d.get("reason", ""))}{(" <span class=muted>→ " + esc(d["successor"]) + "</span>") if d.get("successor") and not compact else ""} {srcs([{"url": u} for u in d.get("sources") or []] if d.get("sources") and isinstance(d["sources"][0], str) else d.get("sources"), 2)}</span></li>')
    return f'<ol class="deps">{"".join(rows)}</ol>'


def dossier_cards(dossiers):
    cards = []
    for d in dossiers:
        figs = ''.join(f'<li><b>{esc(f.get("short") or f["value"])}</b><span>{esc(f["label"])}</span></li>' for f in [x for x in (d.get('headline_figures') or []) if x.get('short')][:3])
        cards.append(f'<a class="dcard" href="impact.html#{esc(d["id"])}"><span class="k">{esc(d.get("kicker", "Human cost"))}</span><h3>{esc(d["title"])}</h3><ul class="figs">{figs}</ul><span class="go">Read the dossier ›</span></a>')
    return f'<div class="dgrid">{"".join(cards)}</div>'


def timeline_html(events, pidx, compact=False):
    out, cur = [], None
    for e in events:
        mk = month_key(e['date'])
        if mk != cur:
            if cur is not None:
                out.append('</ol></section>')
            out.append(f'<section class="tmonth" id="m-{mk}"><h3>{fmt_date(mk)}</h3><ol>')
            cur = mk
        st = ''
        if e.get('status') in STATUS:
            st = pill('score', e['status'])
        elif e.get('status') in COURT:
            st = pill('court', e['status'])
        elif e.get('status') in PROMISE:
            st = pill('promise', e['status'])
        link = f'<a href="{esc(e["href"])}">' if e.get('href') else '<span>'
        out.append(f'<li class="tev" data-stream="{esc(e["stream"])}"><span class="td">{fmt_date(e["date"])[:-6] if e["date"][:4] in ("2025", "2026") and False else fmt_date(e["date"])}</span><i class="ts ts-{esc(e["stream"])}" title="{esc(STREAMS.get(e["stream"], e["stream"]))}"></i>'
                   f'<span class="tt">{link}{esc(e["title"])}{"</a>" if e.get("href") else "</span>"}{f" <small>{esc(e['sub'])}</small>" if e.get("sub") and not compact else ""} {st}{chips(e.get("officials"), pidx) if not compact else ""}{f" <a class=tsrc href={esc(e['url'])!r} rel=noopener>↗</a>" if e.get("url") else ""}</span></li>')
    if cur is not None:
        out.append('</ol></section>')
    return f'<div class="timeline">{"".join(out)}</div>'


def filters(groups):
    """filter bars: groups = [(data attribute, label, [(value, label)])]"""
    out = []
    for attr, label, opts in groups:
        btns = ''.join(f'<button type="button" data-f="{attr}" data-v="{esc(v)}">{esc(l)}</button>' for v, l in opts)
        out.append(f'<div class="fgroup"><span class="k">{esc(label)}</span><button type="button" data-f="{attr}" data-v="" aria-pressed="true">All</button>{btns}</div>')
    return f'<div class="filters">{"".join(out)}<span class="fcount" id="fcount"></span></div>'


def page_scorecard(D, meta, pidx):
    sc, chapters = D['scorecard'], D['chapters']
    items = sc.get('items', [])
    tally = Counter(i['status'] for i in items)
    areas = sorted({i.get('area', '') for i in items if i.get('area')})
    officials = Counter(n for i in items for n in (i.get('people') or []))
    out = [head('The scorecard: what became of Project 2025’s proposals', f'{len(items)} proposals from the Mandate for Leadership, each with what the administration did about it, its status and the sources.', 'scorecard.html'), mast('scorecard.html', meta)]
    out.append(f'<main><div class="narrow head"><p class="k">The Mandate · Scorecard</p><h1>What became of the proposals</h1><p class="dek">{esc(sc.get("dek", f"{len(items)} proposals from the Mandate for Leadership’s 30 chapters, each with what the administration did about it, when, who did it and where we read it."))}</p>'
               f'<p class="byline">Statuses as of {esc(meta.get("asof_h", ""))}. “Done” means the proposal was carried out and stands; “blocked by courts” means an injunction or ruling is in force against it; “partial” means some of it was done or it was done in a weaker form.</p></div>')
    out.append('<div class="wide">' + segbar(tally, list(STATUS), STATUS, 'All tracked proposals', 'proposals'))
    out.append(filters([('status', 'Status', [(k, v[0]) for k, v in STATUS.items()]), ('area', 'Area', [(a, a) for a in areas]), ('officials', 'Official', [(n, n) for n, _ in officials.most_common(12)])]))
    # by section and chapter
    by_ch = defaultdict(list)
    for it in items:
        by_ch[it.get('chapter')].append(it)
    for s in SECTIONS:
        chs = [c for c in chapters.get('chapters', []) if c.get('section') == s]
        if not chs:
            continue
        out.append(f'<section class="csec" id="sec-{slug(s)}"><h2>{esc(s)}</h2>')
        for c in chs:
            its = by_ch.get(c['num'], [])
            cnt = Counter(i['status'] for i in its)
            authors = ', '.join(c.get('authors') or [])
            props = c.get('proposals') or []
            out.append(f'<details class="chap" id="ch-{c["num"]}" {"open" if its else ""}><summary><span class="cn">{c["num"]}</span><span class="ct"><b>{esc(c["title"])}</b><small>{esc(authors)}{(" · " + esc(c["agency"])) if c.get("agency") else ""}</small></span>'
                       f'<span class="cs">{"".join(f"<i class={STATUS[k][1]} title={esc(STATUS[k][0])!r}></i>" for k in STATUS for _ in range(cnt.get(k, 0)))}{f"<em>{len(its)} tracked</em>" if its else "<em>none tracked yet</em>"}</span></summary>'
                       f'<div class="chap-b"><p class="muted"><b>What the chapter asks for:</b> {esc("; ".join(props))}</p>{rows_scorecard(its, pidx) if its else ""}</div></details>')
        out.append('</section>')
    out.append('</div></main>')
    out.append(foot(meta, all_sources(item_sources(items)), sc.get('method')))
    return ''.join(out)


def page_courts(D, meta, pidx):
    courts = D['courts']
    cases = courts.get('cases', [])
    tally = Counter(c['status'] for c in cases)
    topics = sorted({c.get('topic', '') for c in cases if c.get('topic')})
    officials = Counter(n for c in cases for n in (c.get('officials') or []))
    out = [head('In the courts: the cases against the administration', f'{len(cases)} cases, their rulings and where they stand.', 'courts.html'), mast('courts.html', meta)]
    out.append(f'<main><div class="narrow head"><p class="k">The Mandate · Courts</p><h1>Where the courts stepped in</h1><p class="dek">{esc(courts.get("dek", f"{len(cases)} of the cases that tested the program: what was at stake, what the judges said, and who in the administration was on the other side."))}</p><p class="byline">Status as of {esc(meta.get("asof_h", ""))}. Trackers: Just Security, Lawfare and SCOTUSblog, linked in the receipts.</p></div>')
    out.append('<div class="wide">' + segbar(tally, list(COURT), COURT, 'The cases', 'cases'))
    out.append(filters([('status', 'Status', [(k, v[0]) for k, v in COURT.items()]), ('topic', 'Topic', [(t, t) for t in topics]), ('officials', 'Official', [(n, n) for n, _ in officials.most_common(10)])]))
    out.append(rows_courts(sorted(cases, key=lambda c: (c.get('dates') or [{'date': ''}])[-1]['date'], reverse=True), pidx))
    out.append('</div></main>')
    out.append(foot(meta, all_sources(item_sources(cases)), courts.get('method')))
    return ''.join(out)


def page_promises(D, meta, pidx):
    pr = D['promises']
    ps = pr.get('promises', [])
    tally = Counter(p['status'] for p in ps)
    topics = sorted({p.get('topic', '') for p in ps if p.get('topic')})
    out = [head('The promises: what was said, and what happened', f'{len(ps)} spoken commitments, each with the quote, where it was said, and its status.', 'promises.html'), mast('promises.html', meta)]
    out.append(f'<main><div class="narrow head"><p class="k">The Mandate · Promises</p><h1>What was promised, and what happened</h1><p class="dek">{esc(pr.get("dek", f"{len(ps)} things the president and his officials said they would do, in their words, against the record."))}</p><p class="byline">Statuses as of {esc(meta.get("asof_h", ""))}. Each quote links to a transcript or recording; each status to the reporting behind it.</p></div>')
    out.append('<div class="wide">' + segbar(tally, list(PROMISE), PROMISE, 'The commitments', 'commitments'))
    if pr.get('trackers'):
        out.append('<p class="trk narrow"><b>Other trackers:</b> ' + ' · '.join(f'<a href="{esc(t["url"])}" rel="noopener">{esc(t["name"])}</a>{(" (" + esc(t["figure"]) + ")") if t.get("figure") else ""}' for t in pr['trackers']) + '</p>')
    out.append(filters([('status', 'Status', [(k, v[0]) for k, v in PROMISE.items()]), ('topic', 'Topic', [(t, t) for t in topics])]))
    out.append(rows_promises(ps, pidx))
    out.append('</div></main>')
    out.append(foot(meta, all_sources(item_sources(ps), [{'url': p['quote_source']} for p in ps if p.get('quote_source')]), pr.get('method')))
    return ''.join(out)


def page_people(D, meta, pidx):
    people = D['people']
    roster, deps = people.get('roster', []), sorted(people.get('departures', []), key=lambda d: d['date'], reverse=True)
    types = Counter(d.get('type') for d in deps)
    ties = [p for p in roster if (p.get('p2025') or '').lower() not in ('', 'none', 'none known')]
    cmp_ = people.get('turnover_comparison') or {}
    out = [head('The cabinet, Project 2025’s people in it, and the departures', f'{len(roster)} officials, {len(ties)} with Project 2025 ties; {len(deps)} departures since Jan. 20, 2025.', 'people.html'), mast('people.html', meta)]
    out.append(f'<main><div class="narrow head"><p class="k">The Mandate · Cabinet &amp; departures</p><h1>Who did it, and who is gone</h1><p class="dek">{esc(people.get("dek", f"{len(roster)} of the officials who ran the program, {len(ties)} of them with Project 2025 ties, and the {len(deps)} senior departures since the inauguration."))}</p><p class="byline">As of {esc(meta.get("asof_h", ""))}. Each official’s card lists the actions that map to the Mandate and links the reporting.</p></div>')
    out.append('<div class="wide"><div class="stat-row">' + stat(len(roster), 'officials on the roster') + stat(len(ties), 'with Project 2025 ties (contributors, Heritage alumni, trainees)') + stat(len(deps), 'departures since Jan. 20, 2025', 'r') + stat(types.get('fired', 0), 'fired', 'r') + '</div>')
    out.append(filters([('serving', 'Status', [('true', 'Serving'), ('false', 'Departed')]), ('p25', 'Project 2025 tie', [('yes', 'Yes'), ('no', 'None known')])]))
    out.append('<h2 id="roster">The roster</h2>' + cabinet_grid(roster, pidx))
    out.append('<h2 id="departures">The departures</h2>')
    out.append(cum_line(deps, 'Departures, cumulative') + month_bars(deps, 'By month', note='every senior departure in the record'))
    if cmp_.get('figures'):
        out.append('<figure class="cmp"><figcaption><b>Turnover, compared</b> <span class="muted">' + esc(cmp_.get('note', '')) + '</span></figcaption><ul>' + ''.join(f'<li><b>{esc(f.get("administration", ""))}</b> {esc(f.get("period", ""))}: {esc(f.get("pct_or_count", ""))}</li>' for f in cmp_['figures']) + f'</ul><p class="src"><a href="{esc(cmp_.get("source", "#"))}" rel="noopener">{esc(host(cmp_.get("source", "")))}</a></p></figure>')
    out.append(filters([('type', 'How', [(k, v) for k, v in DEPART.items() if types.get(k)])]).replace('id="fcount"', 'id="fcount2"'))
    out.append(rows_departures(deps))
    out.append('</div></main>')
    out.append(foot(meta, all_sources(item_sources(roster), item_sources(deps), [{'url': cmp_.get('source')}] if cmp_.get('source') else []), people.get('method')))
    return ''.join(out)


def page_impact(D, meta, pidx):
    impact = D['impact']
    ds = impact.get('dossiers', [])
    out = [head('The human cost: six dossiers', 'ICE detention, Iran, foreign aid, the safety net, households and civil liberties — the people behind the policies, counted and sourced.', 'impact.html'), mast('impact.html', meta)]
    out.append(f'<main><div class="narrow head"><p class="k">The Mandate · Human cost</p><h1>What it did to people</h1><p class="dek">{esc(impact.get("dek", "Six dossiers on the policies’ reach: who was detained and who died in custody, who was hit abroad, who lost aid, coverage or a job, and who was silenced. Every figure says who counted it."))}</p><p class="byline">As of {esc(meta.get("asof_h", ""))}.</p></div><div class="wide">')
    out.append(dossier_cards(ds))
    for d in ds:
        out.append(f'<section class="dossier" id="{esc(d["id"])}"><h2>{esc(d["title"])}</h2>')
        if d.get('headline_figures'):
            out.append('<div class="stat-row stat-row-d">' + ''.join(stat(esc(f.get('short') or f['value']), f'{esc(f["label"])}{(" <small class=full>" + esc(f["value"]) + "</small>") if f.get("short") and f.get("short") != f["value"] else ""} <a class="fsrc" href="{esc(f.get("source", "#"))}" rel="noopener">{esc(f.get("counted_by", host(f.get("source", ""))))}{(", " + fmt_date(f["asof"])) if f.get("asof") else ""}</a>', 'r' if f.get('grim') else '') for f in d['headline_figures']) + '</div>')
        if d.get('text'):
            out.append(md(d['text']))
        if d.get('p2025_link'):
            out.append(f'<p class="p25"><b>Project 2025</b> {esc(d["p2025_link"])}</p>')
        if d.get('people'):
            out.append('<h3>The names</h3><ul class="names">' + ''.join(f'<li><b>{esc(p["name"])}</b>{(", " + str(p["age"])) if p.get("age") else ""}{(", " + esc(p["nationality"])) if p.get("nationality") else ""} — {esc(p.get("facility", ""))}{(", " + fmt_date(p["date"])) if p.get("date") else ""}. {esc(p.get("note", ""))} {f"<a href={esc(p['source'])!r} rel=noopener>↗</a>" if p.get("source") else ""}</li>' for p in d['people']) + '</ul>')
        if d.get('events'):
            out.append('<h3>What happened, when</h3><ol class="dates">' + ''.join(f'<li><span>{fmt_date(e["date"])}</span><span class="tx">{esc(e["what"])} {chips(e.get("officials"), pidx)} {f"<a href={esc(e['source'])!r} rel=noopener>↗</a>" if e.get("source") else ""}</span></li>' for e in sorted(d['events'], key=lambda e: e['date'])) + '</ol>')
        if d.get('notes'):
            out.append(f'<p class="muted note">{esc(d["notes"])}</p>')
        out.append('</section>')
    claim = impact.get('iran_school_claim')
    if claim:
        out.append(f'<section class="dossier" id="iran-school"><h2>A claim we checked</h2><p><b>{"Verified" if claim.get("verified") else "Not verified"}:</b> {esc(claim.get("finding", ""))}</p><p class="src">' + ' · '.join(f'<a href="{esc(u)}" rel="noopener">{esc(host(u))}</a>' for u in claim.get('sources', [])) + '</p></section>')
    out.append('</div></main>')
    srcl = []
    for d in ds:
        srcl += [{'url': f.get('source')} for f in d.get('headline_figures', []) if f.get('source')]
        srcl += [{'url': e.get('source')} for e in d.get('events', []) if e.get('source')]
        srcl += [{'url': p.get('source')} for p in d.get('people', []) if p.get('source')]
        srcl += d.get('sources') or []
    out.append(foot(meta, all_sources(srcl, [{'url': u} for u in (claim or {}).get('sources', [])]), impact.get('method')))
    return ''.join(out)


def page_markets(D, meta, pidx):
    mk, prices = D['markets'], D.get('prices')
    out = [head('Who made money: the market, GEO Group, CoreCivic and Tesla', 'The S&P 500 under the program, the private-prison companies that built the detention camps, and Tesla.', 'markets.html'), mast('markets.html', meta)]
    out.append(f'<main><div class="narrow head"><p class="k">The Mandate · Markets</p><h1>Who made money</h1><p class="dek">{esc(mk.get("dek", "The stock market’s path through the tariffs and the AI boom; the two companies that run most of ICE’s detention beds and what the $45 billion did for them; Tesla and its chief executive’s year in government."))}</p><p class="byline">Prices: {esc((prices or {}).get("note", "key closes from the reporting linked below; daily closes arrive with the first data run"))}. As of {esc(meta.get("asof_h", ""))}.</p></div><div class="wide">')
    out.append(index_chart(price_series(mk, prices), 'Indexed to 100 on Jan. 20, 2025', 'closing prices, one axis; hover for the date'))
    if prices and prices.get('series'):
        out.append('<div class="smallmult">')
        for sym, label in (('.SPX', 'S&P 500'), ('GEO', 'GEO Group'), ('CXW', 'CoreCivic'), ('TSLA', 'Tesla'), ('PLTR', 'Palantir')):
            pts = prices['series'].get(sym)
            if pts:
                out.append(spark(pts, label, sym))
        out.append('</div>')
    if mk.get('text'):
        out.append(md(mk['text']))
    # the S&P key dates
    if mk.get('spx'):
        out.append('<section id="spx"><h2>The S&amp;P 500, on the days that mattered</h2><ol class="dates">' + ''.join(f'<li><span>{fmt_date(r["date"])}</span><span class="tx"><b>{r["close"]:,.0f}</b> {esc(r.get("event", ""))} {f"<a href={esc(r['source'])!r} rel=noopener>↗</a>" if r.get("source") else ""}</span></li>' for r in mk['spx']) + '</ol></section>')
    for key, label in (('geo', 'GEO Group'), ('cxw', 'CoreCivic')):
        c = mk.get(key) or {}
        if not c:
            continue
        out.append(f'<section id="{key}"><h2>{label}</h2>{md(c.get("text", ""))}')
        if c.get('prices'):
            out.append('<h3>The share price</h3><ol class="dates">' + ''.join(f'<li><span>{fmt_date(r["date"])}</span><span class="tx"><b>${r["close"]:.2f}</b> {esc(r.get("event", ""))} {f"<a href={esc(r['source'])!r} rel=noopener>↗</a>" if r.get("source") else ""}</span></li>' for r in c['prices']) + '</ol>')
        if c.get('contracts'):
            out.append('<h3>The contracts</h3><ol class="dates">' + ''.join(f'<li><span>{fmt_date(k.get("date"))}</span><span class="tx">{esc(k["what"])}{(" <b>" + esc(k["value"]) + "</b>") if k.get("value") and k["value"] != "n/a" else ""} {f"<a href={esc(k['source'])!r} rel=noopener>↗</a>" if k.get("source") else ""}</span></li>' for k in c['contracts']) + '</ol>')
        if c.get('quotes'):
            out.append('<h3>In their words</h3>' + ''.join(f'<blockquote>“{esc(q["quote"])}” <cite>{esc(q["who"])}, {fmt_date(q.get("date"))} {f"<a href={esc(q['source'])!r} rel=noopener>↗</a>" if q.get("source") else ""}</cite></blockquote>' for q in c['quotes']))
        if c.get('donations'):
            out.append('<h3>The money to politics</h3><ul>' + ''.join(f'<li>{esc(d["what"]) if isinstance(d, dict) else esc(d)}{(" <b>" + esc(d["amount"]) + "</b>") if isinstance(d, dict) and d.get("amount") else ""} {f"<a href={esc(d['source'])!r} rel=noopener>↗</a>" if isinstance(d, dict) and d.get("source") else ""}</li>' for d in c['donations']) + '</ul>')
        out.append('</section>')
    if mk.get('profiteers'):
        out.append('<section id="profiteers"><h2>Who else profited</h2><ul class="prof">' + ''.join(f'<li><b>{esc(p["who"])}</b> {esc(p["what"])}{(" <b class=fig>" + esc(p["figure"]) + "</b>") if p.get("figure") else ""} {f"<a href={esc(p['source'])!r} rel=noopener>↗</a>" if p.get("source") else ""}</li>' for p in mk['profiteers']) + '</ul></section>')
    out.append('<p class="more"><a href="musk.html">Tesla and Elon Musk: the election data, the money and the year in government ›</a></p>')
    out.append('</div></main>')
    srcl = [{'url': r.get('source')} for r in mk.get('spx', [])]
    for key in ('geo', 'cxw'):
        c = mk.get(key) or {}
        for lst in ('prices', 'contracts', 'quotes', 'donations'):
            srcl += [{'url': x.get('source')} for x in c.get(lst, []) if isinstance(x, dict) and x.get('source')]
        srcl += c.get('sources') or []
    srcl += [{'url': p.get('source')} for p in mk.get('profiteers', [])]
    out.append(foot(meta, all_sources(srcl, mk.get('sources')), mk.get('method')))
    return ''.join(out)


def spark(pts, label, sym):
    pts = [p for p in pts if p[0] >= '2024-11-01']
    if len(pts) < 2:
        return ''
    vals = [p[1] for p in pts]
    lo, hi = min(vals), max(vals)
    W, H = 300, 90
    d0 = dt.date.fromisoformat(pts[0][0])
    span = max((dt.date.fromisoformat(pts[-1][0]) - d0).days, 1)
    sx = lambda d: 4 + (W - 8) * (dt.date.fromisoformat(d) - d0).days / span
    sy = lambda v: H - 6 - (H - 12) * (v - lo) / (hi - lo or 1)
    path = ' '.join(f'{"M" if i == 0 else "L"}{sx(d):.1f},{sy(v):.1f}' for i, (d, v) in enumerate(pts))
    inaug = next((p for p in pts if p[0] >= '2025-01-20'), None)
    last = pts[-1]
    chg = 100.0 * (last[1] / inaug[1] - 1) if inaug else 0
    return (f'<figure class="sparkfig"><figcaption><b>{esc(label)}</b> <span class="muted">${last[1]:,.2f} · {chg:+.0f}% since Jan. 20, 2025</span></figcaption>'
            f'<svg viewBox="0 0 {W} {H}" class="spark"><path d="{path}"/>{f"<line x1={sx(inaug[0]):.1f} x2={sx(inaug[0]):.1f} y1=4 y2={H - 4} class=mark />" if inaug else ""}</svg><p class="src">Nov. 2024 to {fmt_date(last[0])}, daily closes, CNBC.</p></figure>')


def page_musk(D, meta, pidx):
    mk, videos = D['markets'], D['videos']
    t = mk.get('tesla') or {}
    out = [head('Tesla, Elon Musk and the election: the data', 'Musk’s money in the 2024 election and Wisconsin, the DOGE year, Tesla’s stock, and the vote-count claims, checked.', 'musk.html'), mast('musk.html', meta)]
    out.append(f'<main><div class="narrow head"><p class="k">The Mandate · Musk</p><h1>{esc(t.get("title", "The richest man, the election and the car company"))}</h1><p class="dek">{esc(t.get("dek", "What the filings say Elon Musk spent, what Tesla’s shareholders paid for his year in government, and what the vote-count theories claimed against what the election officials found."))}</p><p class="byline">As of {esc(meta.get("asof_h", ""))}. Every figure links to a filing or a report.</p></div><div class="wide">')
    if t.get('musk_spending'):
        rows = [(s['race'], parse_money(s['amount']), s['amount'], s.get('source')) for s in t['musk_spending'] if parse_money(s['amount'])]
        out.append(hbars(rows, 'Musk’s political money, by race', unit='', cls='s-done'))
        out.append('<ul class="prof">' + ''.join(f'<li><b>{esc(s["race"])}</b> {esc(s["amount"])}{(": " + esc(s["note"])) if s.get("note") else ""} {f"<a href={esc(s['source'])!r} rel=noopener>↗</a>" if s.get("source") else ""}</li>' for s in t['musk_spending']) + '</ul>')
    if t.get('text'):
        out.append(md(t['text']))
    if t.get('prices'):
        out.append('<h2>Tesla’s share price</h2><ol class="dates">' + ''.join(f'<li><span>{fmt_date(r["date"])}</span><span class="tx"><b>${r["close"]:.2f}</b> {esc(r.get("event", ""))} {f"<a href={esc(r['source'])!r} rel=noopener>↗</a>" if r.get("source") else ""}</span></li>' for r in t['prices']) + '</ol>')
    if t.get('events'):
        out.append('<h2>The year, dated</h2><ol class="dates">' + ''.join(f'<li><span>{fmt_date(e["date"])}</span><span class="tx">{esc(e["what"])} {f"<a href={esc(e['source'])!r} rel=noopener>↗</a>" if e.get("source") else ""}</span></li>' for e in sorted(t['events'], key=lambda e: e['date'])) + '</ol>')
    if t.get('claims'):
        out.append('<h2>The vote-count claims, checked</h2>' + md(t['claims']))
    vids = [v for v in videos.get('videos', []) if v.get('where') == 'musk']
    docs = t.get('documentaries') or []
    if vids or docs:
        out.append('<h2>Watch</h2><div class="vgrid">' + ''.join(video_embed(v) for v in vids) + ''.join(f'<a class="vcard ext" href="{esc(d["url"])}" rel="noopener"><span class="k">{esc(d.get("maker", ""))}{(" · " + fmt_date(d["date"])) if d.get("date") else ""}</span><b>{esc(d["title"])}</b><span class="muted">{esc(d.get("note", "Documentary"))}</span></a>' for d in docs) + '</div>')
    out.append('</div></main>')
    srcl = [{'url': x.get('source')} for lst in ('prices', 'events', 'musk_spending') for x in t.get(lst, []) if x.get('source')] + [{'url': d.get('url')} for d in docs] + (t.get('sources') or [])
    out.append(foot(meta, all_sources(srcl), t.get('method')))
    return ''.join(out)


def parse_money(s):
    m = re.search(r'\$?\s*([\d,.]+)\s*(billion|million|B|M|k)?', s or '', re.I)
    if not m:
        return 0
    v = float(m.group(1).replace(',', ''))
    u = (m.group(2) or '').lower()
    return v * {'billion': 1e9, 'b': 1e9, 'million': 1e6, 'm': 1e6, 'k': 1e3}.get(u, 1) / 1e6  # in millions


def page_timeline(D, meta, pidx):
    ev = D['timeline']
    cnt = Counter(e['stream'] for e in ev)
    out = [head('The record, by month', f'{len(ev)} dated events across the actions, the courts, the promises, the departures, the human cost and the markets.', 'timeline.html'), mast('timeline.html', meta)]
    out.append(f'<main><div class="narrow head"><p class="k">The Mandate · Timeline</p><h1>The whole record, by month</h1><p class="dek">{len(ev)} dated events in one stream — the actions, the rulings, the promises as they were made, the departures, the human cost and the markets — from the Mandate’s publication to this week.</p><p class="byline">Filter by stream; tap any event for its page, or the arrow for its source.</p></div><div class="wide">')
    out.append(f'<div class="filters"><div class="fgroup"><span class="k">Stream</span><button type="button" data-f="stream" data-v="" aria-pressed="true">All</button>' + ''.join(f'<button type="button" data-f="stream" data-v="{k}"><i class="ts ts-{k}"></i>{esc(v)} <small>{cnt.get(k, 0)}</small></button>' for k, v in STREAMS.items() if cnt.get(k)) + '</div><span class="fcount" id="fcount"></span></div>')
    out.append(timeline_html(ev, pidx))
    out.append('</div></main>')
    out.append(foot(meta, []))
    return ''.join(out)


def page_reel(D, meta):
    cards = D['reel']
    data = json.dumps(cards, ensure_ascii=False, separators=(',', ':'))
    return head('Reel: Project 2025, two years on', f'{len(cards)} cards, one fact each, for a phone or a screen recording.', 'reel.html', extra='<link rel="stylesheet" href="reel.css"><script type="module" src="reel.js" defer></script>') + f"""
<div class="reel" id="reel" data-cards='{esc(data)}'>
  <a class="reel-back" href="index.html" aria-label="Back to the analysis">‹ The Mandate</a>
  <div class="reel-prog" id="prog"></div>
  <div class="reel-stage" id="rstage"></div>
  <div class="reel-ui"><button type="button" id="rprev" aria-label="Previous">‹</button><button type="button" id="rplay" aria-pressed="true">Pause</button><button type="button" id="rnext" aria-label="Next">›</button><button type="button" id="rfs">Full screen</button><button type="button" id="rwide" aria-pressed="false">16:9</button><a href="index.html">Read the analysis</a></div>
</div>
<script type="module" src="mandate.js"></script></body></html>"""


def page_3d(D, meta):
    return head('The Mandate in 3-D', 'Every chapter of the Mandate for Leadership as a tower of its proposals, lit by what became of them.', '3d.html', extra='<script type="module" src="mandate3d.js" defer></script>') + mast('3d.html', meta) + """
<section class="viz viz-full" aria-label="The visual">
  <div class="viz-stage" id="stage"><div id="m3d" class="m3d-root" data-src="data/3d.json" data-full="1"></div>
    <button type="button" class="fs-close" id="fsClose">Exit full screen</button>
    <div class="fs-bar"><button type="button" id="hideHud">Hide / show text</button></div>
  </div>
  <div class="viz-bar" id="vizbar">
    <div class="seg" role="group" aria-label="View"><button type="button" data-view="city" aria-pressed="true">The 30 chapters</button><button type="button" data-view="tour" aria-pressed="false">Fly-through</button><button type="button" data-view="status" aria-pressed="false">Sorted by status</button></div>
    <button type="button" class="vb" id="playBtn" aria-pressed="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg><span>Pause</span></button>
    <button type="button" class="vb" id="fsBtn">Full screen</button>
    <span class="hint">One tower per chapter, one block per tracked proposal: solid brass for done, lighter for under way or partial, red for blocked by the courts, grey for reversed, hollow for not attempted. Drag to turn, scroll to zoom, tap a tower. Press H to hide the text for a recording.</span>
  </div>
  <div class="county-card" id="chapterCard" hidden aria-live="polite"></div>
</section>
<main><div class="narrow body"><h2>How to read it</h2><p>The Mandate for Leadership has 30 chapters in five sections, each written by people who went on to run the agencies they wrote about. The Watch tracks the most consequential proposals in each; a tower’s height is how many we track, and each block’s light is that proposal’s fate. The fly-through walks the five sections in order and pauses on the chapters that changed the most lives. <a href="scorecard.html">The scorecard</a> has every block as a row with its sources.</p></div></main>
""" + foot(meta, [])


def build_3d(D):
    """the data the 3-D module draws: chapters with their tracked items' statuses, in sections"""
    sc, chapters = D['scorecard'], D['chapters']
    by_ch = defaultdict(list)
    for it in sc.get('items', []):
        by_ch[it.get('chapter')].append(it)
    out = {'sections': SECTIONS, 'chapters': [], 'statuses': {k: v[0] for k, v in STATUS.items()}}
    for c in chapters.get('chapters', []):
        its = by_ch.get(c['num'], [])
        out['chapters'].append({'num': c['num'], 'title': c['title'], 'section': SECTIONS.index(c['section']) if c.get('section') in SECTIONS else 0, 'authors': c.get('authors', []), 'agency': c.get('agency', ''),
                                'blocks': [{'id': i['id'], 'status': i['status'], 'proposal': i.get('proposal', '')[:140], 'action': i.get('action', '')[:200]} for i in its], 'proposals': len(c.get('proposals') or [])})
    tour = D['analysis'].get('tour') or []
    out['tour'] = tour
    return out


def build_reel(D, meta):
    """the reel's cards: the headline numbers, then one card per stream, each with its source"""
    sc, courts, promises, people, impact, markets, analysis = (D[k] for k in ('scorecard', 'courts', 'promises', 'people', 'impact', 'markets', 'analysis'))
    cards = list(analysis.get('reel') or [])
    if cards:
        items = sc.get('items', [])
        tally = Counter(i['status'] for i in items)
        for c in cards:
            if c.get('auto') == 'scorecard':
                c['counts'] = {k: tally.get(k, 0) for k in STATUS if tally.get(k)}
                c['text'] = f'{len(items)} proposals tracked: {tally["done"]} done, {tally["in progress"]} in progress, {tally["partial"]} partial, {tally["blocked by courts"]} blocked by the courts, {tally["reversed"]} reversed, {tally["not attempted"]} not attempted. ' + c.get('text', '')
        return cards
    items = sc.get('items', [])
    tally = Counter(i['status'] for i in items)
    cards.append({'kind': 'title', 'kicker': 'The Watch · The Mandate', 'title': analysis.get('hero', {}).get('title', 'Project 2025, two years on'), 'text': analysis.get('hero', {}).get('dek', '')})
    cards.append({'kind': 'stat', 'kicker': 'The scorecard', 'big': f'{pct(tally["done"] + tally["in progress"] + tally["partial"], len(items))}%', 'text': f'of the {len(items)} Project 2025 proposals we track are done, under way or partly done. {tally["blocked by courts"]} are blocked by the courts.', 'href': 'scorecard.html'})
    for it in [i for i in items if i.get('featured')][:6]:
        cards.append({'kind': 'fact', 'kicker': f'Chapter {it.get("chapter")} · {STATUS.get(it["status"], (it["status"],))[0]}', 'title': it.get('proposal', ''), 'text': it.get('action', ''), 'src': (it.get('sources') or [{}])[0], 'status': it['status']})
    return cards


def build_meta(D):
    now = dt.datetime.now(ET)
    counts = f'{len(D["scorecard"].get("items", []))} proposals, {len(D["courts"].get("cases", []))} cases, {len(D["promises"].get("promises", []))} commitments, {len(D["people"].get("roster", []))} officials, {len(D["people"].get("departures", []))} departures'
    asof = D['analysis'].get('asof') or now.date().isoformat()
    return {'built': now.strftime('%Y-%m-%dT%H:%M%z'), 'built_h': now.strftime('%b. %-d, %Y, %-I:%M %p ET').replace('May.', 'May').replace('June.', 'June').replace('July.', 'July'), 'asof': asof, 'asof_h': fmt_date(asof), 'counts': counts}


def check(D):
    bad = []
    ids = Counter()
    for it in D['scorecard'].get('items', []):
        ids[('sc', it.get('id'))] += 1
        if it.get('status') not in STATUS:
            bad.append(f'scorecard {it.get("id")}: status {it.get("status")!r}')
        if not it.get('sources') or not all(s.get('url') for s in it['sources']):
            bad.append(f'scorecard {it.get("id")}: a source without a URL')
        for d in it.get('dates') or []:
            if not re.match(r'^\d{4}-\d{2}(-\d{2})?$', d):
                bad.append(f'scorecard {it.get("id")}: date {d!r}')
    for c in D['courts'].get('cases', []):
        ids[('ct', c.get('id'))] += 1
        if c.get('status') not in COURT:
            bad.append(f'court {c.get("id")}: status {c.get("status")!r}')
        if not c.get('sources'):
            bad.append(f'court {c.get("id")}: no sources')
    for p in D['promises'].get('promises', []):
        ids[('pr', p.get('id'))] += 1
        if p.get('status') not in PROMISE:
            bad.append(f'promise {p.get("id")}: status {p.get("status")!r}')
        if not p.get('quote_source'):
            bad.append(f'promise {p.get("id")}: the quote has no source')
    for d in D['people'].get('departures', []):
        ids[('dp', d.get('id'))] += 1
        if d.get('type') not in DEPART:
            bad.append(f'departure {d.get("id")}: type {d.get("type")!r}')
        if not d.get('sources'):
            bad.append(f'departure {d.get("id")}: no sources')
    for k, n in ids.items():
        if n > 1:
            bad.append(f'duplicate id {k}')
    for c in D['chapters'].get('chapters', []):
        if c.get('section') not in SECTIONS:
            bad.append(f'chapter {c.get("num")}: section {c.get("section")!r}')
    return bad


def main():
    D = {k: load(k + '.json') for k in ('chapters', 'scorecard', 'courts', 'promises', 'people', 'impact', 'markets', 'analysis', 'videos')}
    D['prices'] = load('prices.json', {})
    if len(sys.argv) > 1 and sys.argv[1] == 'check':
        bad = check(D)
        print('\n'.join(bad) or 'ok')
        sys.exit(1 if bad else 0)
    D['timeline'] = timeline_events(D['scorecard'], D['courts'], D['promises'], D['people'], D['impact'], D['markets'], D['chapters'])
    meta = build_meta(D)
    pidx = people_index(D['people'])
    D['reel'] = build_reel(D, meta)
    pages = {'index.html': page_index(D, meta, pidx), 'scorecard.html': page_scorecard(D, meta, pidx), 'courts.html': page_courts(D, meta, pidx), 'promises.html': page_promises(D, meta, pidx),
             'people.html': page_people(D, meta, pidx), 'impact.html': page_impact(D, meta, pidx), 'markets.html': page_markets(D, meta, pidx), 'musk.html': page_musk(D, meta, pidx),
             'timeline.html': page_timeline(D, meta, pidx), 'reel.html': page_reel(D, meta), '3d.html': page_3d(D, meta)}
    for name, html_ in pages.items():
        with open(os.path.join(HERE, name), 'w', encoding='utf-8') as f:
            f.write(html_)
    with open(os.path.join(DATA, '3d.json'), 'w', encoding='utf-8') as f:
        json.dump(build_3d(D), f, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(DATA, 'timeline.json'), 'w', encoding='utf-8') as f:
        json.dump(D['timeline'], f, ensure_ascii=False, separators=(',', ':'))
    # the front page's card reads this
    sc = D['scorecard'].get('items', [])
    tally = Counter(i['status'] for i in sc)
    with open(os.path.join(HERE, 'pages.json'), 'w', encoding='utf-8') as f:
        json.dump({'v': 1, 'built': meta['built'], 'title': D['analysis'].get('hero', {}).get('title', ''), 'dek': D['analysis'].get('hero', {}).get('dek', ''), 'tracked': len(sc), 'done': tally['done'], 'progress': tally['in progress'] + tally['partial'],
                   'blocked': tally['blocked by courts'], 'cases': len(D['courts'].get('cases', [])), 'promises': len(D['promises'].get('promises', [])), 'departures': len(D['people'].get('departures', [])), 'events': len(D['timeline'])}, f, ensure_ascii=False, indent=1)
    print(f'wrote {len(pages)} pages; {meta["counts"]}; {len(D["timeline"])} timeline events')


if __name__ == '__main__':
    main()
