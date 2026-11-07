#!/usr/bin/env python3
"""Writes the blue-wave pages from the data: news/wave/index.html (the story and the visual), five area pieces
(news/wave/<slug>.html) and news/wave/pages.json (what the front page shows). Every number in the text comes from
news/wave/data/shift.json and night.json, so re-running after a data refresh keeps the words honest.
`python3 news/wave/tools/make_pages.py`; the counties workflow runs it after each refresh.
"""
import json, os, re, html, datetime as dt, statistics

HERE = os.path.dirname(os.path.abspath(__file__)); W = os.path.normpath(os.path.join(HERE, '..'))
S = json.load(open(os.path.join(W, 'data', 'shift.json'), encoding='utf-8'))
N = json.load(open(os.path.join(W, 'data', 'night.json'), encoding='utf-8'))
PUBLIC = 'https://bboldt86.github.io/lanscape-navigator/news/wave/'
F2S = {'01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY'}
NAME = {'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'}
COUNTY_WORD = {'LA': 'parishes'}

def esc(s): return html.escape(str(s), quote=True)
def n(v): return f'{v:,.0f}'
def pts(v, plus=True): return ('+' if plus and v > 0 else '') + f'{v:.1f}'
def margin(v): return ('D+' if v > 0 else 'R+' if v < 0 else 'even ') + f'{abs(v):.1f}' if v is not None else '–'
def mclass(v): return 'd' if v > 0 else 'r' if v < 0 else ''
def last(name): return (name or '').split(' ')[-1] if name else ''

rows = []
for f, v in S['counties'].items():
    rows.append({'f': f, 'n': S['names'].get(f, f), 'st': F2S.get(f[:2], ''), 'm24': v[0], 'm26': v[1], 'sh': v[2], 'e': v[3], 'race': v[4], 'd': v[5], 'r': v[6], 't': v[7], 'd24': v[8], 'r24': v[9], 't24': v[10]})
byst = {}
for r in rows: byst.setdefault(r['st'], []).append(r)
def stats(rs):
    if not rs: return {'n': 0, 'left': 0, 'right': 0, 'median': 0, 'weighted': 0, 'flipD': 0, 'flipR': 0, 'votes': 0, 'votes24': 0}
    tw = sum(r['t'] for r in rs)
    return {'n': len(rs), 'left': sum(1 for r in rs if r['sh'] > 0), 'right': sum(1 for r in rs if r['sh'] < 0), 'median': statistics.median(r['sh'] for r in rs),
            'weighted': sum(r['sh'] * r['t'] for r in rs) / tw if tw else 0, 'flipD': sum(1 for r in rs if r['m24'] < 0 and r['m26'] > 0), 'flipR': sum(1 for r in rs if r['m24'] > 0 and r['m26'] < 0),
            'votes': tw, 'votes24': sum(r['t24'] for r in rs)}
ALL = stats(rows)
def race_of(st):
    v = S['states'].get(st); return (v, v['races'].get(v['use'])) if v and v.get('use') else (v, None)
def county_word(st, plural=True): return COUNTY_WORD.get(st, 'counties' if plural else 'county')
asof = dt.datetime.fromisoformat(S['asOf'].replace('Z', '+00:00')).astimezone(dt.timezone(dt.timedelta(hours=-5)))
ASOF = asof.strftime('%b. %-d, %Y, %-I:%M %p ET').replace('Nov.', 'Nov.')
built = dt.datetime.now(dt.timezone(dt.timedelta(hours=-5)))
BUILT_ISO = built.isoformat(timespec='minutes')
PUBLISHED = dt.datetime(2026, 11, 6, 20, 30, tzinfo=dt.timezone(dt.timedelta(hours=-5)))  # first published; the pages are rebuilt as the count goes on
PUB_ISO = PUBLISHED.isoformat(timespec='minutes')
PCT = round(ALL['left'] / ALL['n'] * 100)
ctl = N.get('control') or {}
H, SEN = ctl.get('H') or {}, ctl.get('S') or {}
TXS, TXR = race_of('TX'); starr = next(r for r in rows if r['f'] == '48427')
flips = [st for st, v in S['states'].items() if v.get('use') and v['races'][v['use']].get('winner') == 'D' and v['races'][v['use']]['m24'] < 0 and v['use'] == 'S']
uncalled = [st + ('-S' if k == 'S' else '-G') for st, v in S['states'].items() for k, rc in (v.get('races') or {}).items() if rc.get('winner') is None]

# ---------- the sources ----------
SOURCES = [
    ('nyt', 'The New York Times, 2026 election results pages (county-level vote counts provided by The Associated Press), results-senate.json, results-governor.json, results-house.json and one file per state, read ' + ASOF, 'https://www.nytimes.com/interactive/2026/11/03/us/elections/results-senate.html'),
    ('base', 'The Watch’s Election Desk, 2024 presidential results by county (the baseline every 2026 county is compared with)', 'https://bboldt86.github.io/lanscape-navigator/election2026/'),
    ('cbs', 'CBS News, “2026 Senate election results” live updates, Nov. 3–5, 2026 (the seats that flipped, the calls and their times, Collins’s concession)', 'https://www.cbsnews.com/live-updates/senate-election-results-2026/'),
    ('yahoo', 'Yahoo News, “Midterms 2026: election results and latest updates,” Nov. 6, 2026 (Senate 54–44 with Alaska and Mississippi open; House 253–157 with 25 uncalled; the governors; Mississippi’s absentee count)', 'https://www.yahoo.com/news/politics/live/midterms-2026-election-results-and-latest-updates-mississippi-votes-still-being-counted-in-senate-nail-biter-after-democrats-take-control-of-congress-200037541.html'),
    ('romano', 'Andrew Romano, Yahoo News, “Democrats’ 2026 midterm rout was big — really big,” Nov. 4, 2026 (the 13-point House popular vote, the largest since 1974; the Senate flips; Texas Latino and young voters; exit-poll approval)', 'https://www.yahoo.com/news/politics/article/democrats-2026-midterm-rout-was-big--really-big-here-are-the-numbers-that-prove-it-225923613.html'),
    ('morris', 'G. Elliott Morris, Strength In Numbers, “Democrats win U.S. House, Senate…,” Nov. 2026 (a 13–14 point House popular-vote margin, the largest since 1974)', 'https://gelliottmorris.com/p/democrats-win-us-house-senate-in'),
    ('nbc', 'NBC News, “Maps: How the vote shifted from the 2024 presidential election to 2026” (about 90 percent of the country shifted toward Democrats; a 13-point average shift in the House vote)', 'https://www.nbcnews.com/data-graphics/2026-blue-wave-maps-rcna607371'),
    ('tnr', 'The New Republic, “Stunning map shows just how much the country swung left,” Nov. 2026 (Ground News’s House-based map: 94 percent of counties; the AP Voter Poll on young, Hispanic and Black voters)', 'https://newrepublic.com/post/217710/map-how-much-country-swung-left-elections'),
    ('newsweek-tx', 'Newsweek, “Ken Paxton vs. James Talarico: Texas Senate election results,” Nov. 2026 (county margins, Trump’s 13.7-point 2024 margin, Spanish-language ad spending)', 'https://www.newsweek.com/ken-paxton-james-talarico-texas-senate-election-results-12667994'),
    ('politico', 'Politico (via Yahoo News), “‘This is an earthquake’: Latino voters rush back to Democrats,” Nov. 4, 2026 (Starr County 2024 and 2026 shares; Miami-Dade; southwest Kansas; the quotes)', 'https://www.yahoo.com/news/politics/articles/earthquake-latino-voters-rush-back-193040632.html'),
    ('rural', 'Newsweek, “2026 exit polls show how rural American voters changed since 2024,” Nov. 2026 (rural margins; The Washington Post’s and Reuters’ rural-county analyses; diesel prices; Texas rural counties per the Daily Yonder)', 'https://www.newsweek.com/exit-polls-2026-rural-voters-midterms-trump-senate-12673771'),
    ('silver', 'Nate Silver, Silver Bulletin, Trump approval tracker, read Nov. 4, 2026 (38.3 percent approve)', 'https://www.natesilver.net/p/trump-approval-ratings-nate-silver-bulletin'),
    ('govs', 'Newsweek, “Map shows Democratic governors’ dramatic surge amid GOP wipeout,” Nov. 2026 (the five governorships that flipped, Kansas and Alaska pending)', 'https://www.newsweek.com/democratic-governors-map-midterm-elections-gina-hinojosa-12671192'),
    ('maine', 'NEWS CENTER Maine (via Yahoo News), “The Maine counties that cost Susan Collins her reelection,” Nov. 4, 2026', 'https://www.yahoo.com/news/politics/articles/maine-counties-cost-susan-collins-220551796.html'),
    ('kut', 'KUT, “Gina Hinojosa defeats Gov. Greg Abbott, ending decades of Republican control,” Nov. 3–4, 2026 (the AP call at 10:17 p.m.; the first Democrat since Ann Richards)', 'https://www.kut.org/politics/2026-11-03/texas-governor-election-2026-hinojosa-early-results'),
    ('viz', 'Amanda Makulec, Viz Responsibly, “Five standout charts from the 2026 midterms” (The Times’s 15-point national shift and its county direction-of-change map; its 44 percent turnout estimate)', 'https://vizresponsibly.substack.com/p/five-standout-charts-from-the-2026'),
    ('stuck', 'Stuck in the Middle (Substack), “14 counties that show how Texas is a swing state,” Nov. 5, 2026 (Texas county swings and the CNN Voter Poll on Republican crossover votes)', 'https://stuckmiddle.substack.com/p/14-counties-that-show-how-texas-is'),
    ('reel', 'rendered.earth on Instagram, “96% of counties counted moved left since 2024,” Nov. 2026 (the 3-D county map this piece reproduces from the public data)', 'https://www.instagram.com/reel/DfXpzuju25n/'),
    ('dots', 'dotsimulate on Instagram, “Midterms 2026 from 6 PM ET,” Nov. 2026 (the election-night replay this piece’s second view is modeled on; its results credited to AP via The New York Times)', 'https://www.instagram.com/dotsimulate/'),
]
SRC = {k: i + 1 for i, (k, _, _) in enumerate(SOURCES)}
def c(*keys): return '<sup>' + ', '.join(f'<a href="#src-{SRC[k]}">{SRC[k]}</a>' for k in keys) + '</sup>'
def sources_html(keys=None):
    items = [(k, t, u) for k, t, u in SOURCES if not keys or k in keys]
    return '<ol>' + ''.join(f'<li id="src-{SRC[k]}">{esc(t)}. <a href="{esc(u)}" rel="noopener">{esc(u)}</a></li>' for k, t, u in items) + '</ol>'

# ---------- page scaffolding ----------
ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%230b1526'/%3E%3Cpath d='M12 44c6-14 10-6 16-16s10 4 16-8 8 2 10 6' fill='none' stroke='%237fc4ff' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E"
BOOT = """<script>
(function(){try{var p=JSON.parse(localStorage.getItem('watch.v1')||'{}');var t=p.theme||'auto';var h=+new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',hourCycle:'h23'}).format(new Date());
if(t==='auto'){t=(h>=20||h<4)?'night':(matchMedia('(prefers-color-scheme: dark)').matches?'night':'day')}document.documentElement.dataset.theme=t;}catch(e){}})();
</script>"""
def head(title, desc, slug, img, kind='article', published=None):
    url = PUBLIC + (slug + '.html' if slug else '')
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)} · The Watch</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="{kind}">
<meta property="og:site_name" content="The Watch">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{PUBLIC}{img}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{esc(title)}: a 3-D map of every county's move since 2024, in The Watch">
<meta property="og:video" content="{PUBLIC}{img}.mp4">
<meta property="og:video:secure_url" content="{PUBLIC}{img}.mp4">
<meta property="og:video:type" content="video/mp4">
<meta property="og:video:width" content="1200">
<meta property="og:video:height" content="630">
<meta property="og:locale" content="en_US">
{f'<meta property="article:published_time" content="{published}">' if published else ''}
<meta property="article:author" content="Claude (Claude Fable 5.1) for The Watch">
<meta property="article:section" content="Politics">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{PUBLIC}{img}.png">
<meta name="theme-color" content="#F5F7F6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E1A2B" media="(prefers-color-scheme: dark)">
<link rel="apple-touch-icon" href="../icon-180.png">
<link rel="icon" href="{ICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<link rel="stylesheet" href="wave.css">
<link rel="stylesheet" href="article.css">
<style>.nogl-msg{{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;color:#e9f0f8}}.nogl-msg b{{display:block;font-size:20px;margin-bottom:6px}}.wave-clean .wave-hud,.wave-clean .wave-leaders{{opacity:0}}</style>
</head>
<body>
{BOOT}
<header class="mast"><div class="wrap">
  <a class="back" href="../#/s/politics"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#15243B"/><circle cx="32" cy="32" r="21" fill="none" stroke="#D6B25E" stroke-width="6" stroke-dasharray="19 3"/><path d="M32 32 L46 14" stroke="#F5F7F6" stroke-width="5" stroke-linecap="round"/></svg>The Watch <span>· Politics</span></a>
  <div class="mast-r"><button type="button" class="tbtn" data-share>Share</button></div>
</div></header>
"""
def viz_block(views=True, race=True, hint=''):
    return f"""<section class="viz" aria-label="The visual">
  <div class="viz-stage" id="stage"><div id="wave" class="wave-root"></div>
    <button type="button" class="fs-close" id="fsClose">Exit full screen</button>
    <div class="fs-bar"><button type="button" id="hideHud">Hide / show text</button></div>
  </div>
  <div class="viz-bar" id="vizbar">
    {'<div class="seg" role="group" aria-label="View"><button type="button" data-view="wave" aria-pressed="true">The wave</button><button type="button" data-view="night" aria-pressed="false">Election night</button></div>' if views else ''}
    <button type="button" class="vb" id="playBtn" aria-pressed="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg><span>Pause</span></button>
    <button type="button" class="vb" id="replayBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/></svg>Replay</button>
    <div class="scrub"><input type="range" id="scrub" min="0" max="1000" value="0" aria-label="Scrub"></div>
    {'<span id="raceWrap"><select id="raceSel" aria-label="Which race"><option value="auto">Senate, or governor where there is no Senate race</option><option value="S">Senate races only</option><option value="G">Governor races only</option></select></span>' if race else ''}
    <button type="button" class="vb" id="fsBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>Full screen</button>
    <span class="hint">{hint}</span>
  </div>
  <div class="county-card" id="countyCard" hidden aria-live="polite"></div>
</section>
"""
def foot():
    return f"""<footer class="foot"><div class="narrow"><p>The Watch · Politics. Counts: AP via The New York Times; 2024 baseline: The Watch’s Election Desk. The map and the replay are drawn in your browser from the public data; nothing is copied from any outlet’s graphics. <a href="../">Back to The Watch</a> · <a href="data/shift.json">shift.json</a> · <a href="data/night.json">night.json</a> · <a href="https://github.com/BBOLDT86/lanscape-navigator/tree/main/news/wave">the code</a>. Page written {built.strftime('%b. %-d, %Y, %-I:%M %p ET')}.</p></div></footer>
<script type="module" src="article.js"></script>
</body></html>"""

def state_table(sts, title='The states'):
    out = [f'<div class="tblwrap"><table class="tbl"><thead><tr><th>State · race</th><th>2024</th><th>2026</th><th>Swing</th><th>Counties left / right</th><th>Counted</th></tr></thead><tbody>']
    for st in sts:
        v, u = race_of(st)
        if not u: continue
        win = u.get('winner'); dem, rep = u['dem'] or '', u['rep'] or ''
        who = f"{esc(last(dem))} ({'D' if u['demParty'] == 'D' else 'I'}) v {esc(last(rep))} (R)"
        if win == 'D': who = f"<b class='d'>{esc(last(dem))}</b> ({'D' if u['demParty'] == 'D' else 'I'}) beat {esc(last(rep))} (R)"
        elif win == 'R': who = f"<b class='r'>{esc(last(rep))}</b> (R) beat {esc(last(dem))} ({'D' if u['demParty'] == 'D' else 'I'})"
        else: who += ' <small>(not called)</small>'
        sw = u['m26'] - u['m24']
        out.append(f"<tr><td>{esc(NAME[st])} · {'Senate' if v['use'] == 'S' else 'Governor'}<br><small>{who}</small></td><td class='{mclass(u['m24'])}'>{margin(u['m24'])}</td><td class='{mclass(u['m26'])}'>{margin(u['m26'])}</td><td><b class='{mclass(sw)}'>{pts(sw)}</b></td><td>{v['counties']} · <span class='d'>{v['left']}</span> / <span class='r'>{v['right']}</span></td><td>{u['eevp'] if u['eevp'] is not None else '–'}%</td></tr>")
    out.append('</tbody></table></div>')
    return ''.join(out)
def county_list(rs, k=8, key=lambda r: -r['sh']):
    return '<ol>' + ''.join(f"<li>{esc(r['n'])}, {r['st']}: <b class='{mclass(r['sh'])}'>{pts(r['sh'])}</b> ({margin(r['m24'])} in 2024 → {margin(r['m26'])}; {n(r['t'])} votes)</li>" for r in sorted(rs, key=key)[:k]) + '</ol>'
def explorer(states=None, title='Explore every county'):
    return f"""<h2 id="explore">{title}</h2>
<p>Search a county or a state’s two letters; click a heading to sort. The 2026 column is the Senate race where the state had one, otherwise the governor’s race. “Counted” is AP’s estimate of how much of the expected vote is in.</p>
<div class="explore"><input id="q" type="search" placeholder="Search counties, or a state like TX" aria-label="Search counties"><select id="sortSel" aria-label="Sort"><option value="sh-desc">Biggest move left</option><option value="sh-asc">Biggest move right</option><option value="t-desc">Most votes</option><option value="m26-desc">Bluest 2026</option><option value="m26-asc">Reddest 2026</option><option value="n-asc">By name</option></select><button type="button" class="tbtn" id="csvBtn">Download CSV</button><span id="tcount" class="pill"></span></div>
<div class="tblwrap"><table class="tbl" id="countyTable"><thead><tr><th data-k="n">County</th><th data-k="m24">2024</th><th data-k="m26">2026</th><th data-k="sh">Move</th><th data-k="t">Votes 2026</th><th data-k="e">Counted</th></tr></thead><tbody></tbody></table></div>
"""

# ---------- the states, written by Claude through the API (tools/write.py) ----------
def _load(p):
    try: return json.load(open(p, encoding='utf-8'))
    except FileNotFoundError: return None
REPORTS = {st: r for st in S['states'] if S['states'][st].get('use') for r in [_load(os.path.join(W, 'data', 'reports', st + '.json'))] if r and r.get('headline')}
NOTE_STATES = sorted(st for st in S['states'] if os.path.exists(os.path.join(W, 'data', 'notes', st + '.json')))
STATE_SLUG = {st: NAME[st].lower().replace(' ', '-') for st in NAME}
STATE_PAGES = {st: STATE_SLUG[st] for st in REPORTS}
MODEL_NAME = {'claude-opus-5-5': 'Claude Opus 5.5', 'claude-sonnet-5-5': 'Claude Sonnet 5.5', 'claude-fable-5-1': 'Claude Fable 5.1'}
def page_ctx(): return {'statePages': STATE_PAGES, 'notes': NOTE_STATES}
def swing_of(st): v, u = race_of(st); return (u['m26'] - u['m24']) if u else 0
def when(iso):
    try: return dt.datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone(dt.timezone(dt.timedelta(hours=-5))).strftime('%b. %-d, %Y')
    except Exception: return ''

def races_table(st):
    out = ['<div class="tblwrap"><table class="tbl"><thead><tr><th>Race</th><th>2024 presidential</th><th>2026</th><th>Swing</th><th>Counted</th></tr></thead><tbody>']
    for k, u in S['states'][st]['races'].items():
        win = u.get('winner'); dem, rep = u['dem'] or '', u['rep'] or ''; dp = 'D' if u['demParty'] == 'D' else 'I'
        who = f"{esc(dem)} ({dp}) v {esc(rep)} (R)"
        if win == 'D': who = f"<b class='d'>{esc(dem)}</b> ({dp}) beat {esc(rep)} (R)"
        elif win == 'R': who = f"<b class='r'>{esc(rep)}</b> (R) beat {esc(dem)} ({dp})"
        else: who += ' <small>(not called)</small>'
        sw = u['m26'] - u['m24']
        out.append(f"<tr><td>{esc(u['office'])}<br><small>{who}</small></td><td class='{mclass(u['m24'])}'>{margin(u['m24'])}</td><td class='{mclass(u['m26'])}'>{margin(u['m26'])}<br><small>{n(u['demVotes'])} – {n(u['repVotes'])}</small></td><td><b class='{mclass(sw)}'>{pts(sw)}</b></td><td>{u['eevp'] if u['eevp'] is not None else '–'}%</td></tr>")
    out.append('</tbody></table></div>')
    return ''.join(out)

def render_paras(rep):
    """The piece's paragraphs, with the API's web citations as numbered footnote links."""
    out = []; first = True
    for p in rep['paras']:
        if p['t'] == 'h2': out.append(f"<h2>{esc(p['text'])}</h2>"); continue
        t = p['text']; cuts = sorted(p.get('cites') or [], key=lambda c: c[0]); html_ = ''; pos = 0; pending = []
        def flush():
            nonlocal html_, pending
            if pending: html_ += '<sup>' + ', '.join(f'<a href="#src-{s}">{s}</a>' for s in sorted(set(pending))) + '</sup>'; pending = []
        for off, src in cuts:
            off = max(pos, min(off, len(t)))
            if off > pos: flush(); html_ += esc(t[pos:off]); pos = off
            pending.append(src)
        flush(); html_ += esc(t[pos:])
        cls = ' class="lede"' if first else ''
        out.append(f"<p{cls}>{html_}</p>"); first = False
    return ''.join(out)

def state_callouts(rep):
    out = []; t0 = 3.0
    for i, c in enumerate((rep.get('callouts') or [])[:4]):
        if c['f'] not in S['counties']: continue
        out.append({'at': 'county:' + c['f'], 'html': f"<b>{esc(c['label'])}</b><span>{esc(c['note'])}</span>", 'off': [[0.08, -0.26], [-0.34, 0.08], [0.1, 0.1], [-0.36, -0.22]][i % 4], 'from': t0 + i * 4.2, 'to': t0 + i * 4.2 + 3.9})
    return out

def state_page(st, rep):
    rs = byst.get(st, []); stt = stats(rs); v, u = race_of(st); slug = STATE_SLUG[st]
    title = rep['headline']; dek = rep['dek']; model = MODEL_NAME.get(rep.get('model', ''), rep.get('model', 'Claude'))
    mapped = bool(rs) and st != 'HI'
    viz = {'dur': 22, 'loop': True, 'title': {'kicker': 'The wave · ' + NAME[st], 'h2': f"{stt['left']} of {stt['n']} {county_word(st)}<br>moved left" if rs else f"{NAME[st]}<br>moved {pts(u['m26'] - u['m24'])}", 'what': county_word(st)}, 'callouts': state_callouts(rep) if mapped else []}
    if mapped: viz['focus'] = {'states': [st], 'pad': 1.2}
    page = {'slug': slug, 'url': PUBLIC + slug + '.html', 'shareText': f"{title}: {dek}", 'viz': viz, 'states': [st], 'st': st, 'sort': 'sh-desc', **page_ctx()}
    area = next((a for a in AREAS if st in a['states']), None)
    order = sorted(REPORTS, key=lambda s: NAME[s]); i = order.index(st); prev, nxt = order[i - 1], order[(i + 1) % len(order)]
    srcs = rep.get('sources') or []; k = len(srcs)
    sources = '<ol>' + ''.join(f'<li id="src-{s["n"]}">{esc(s["title"])}. <a href="{esc(s["url"])}" rel="noopener">{esc(s["url"])}</a></li>' for s in srcs) + \
        f'<li id="src-{k + 1}">The New York Times, 2026 election results pages (county-level vote counts provided by The Associated Press), one file per state, read {ASOF}. <a href="https://www.nytimes.com/interactive/2026/11/03/us/elections/results-senate.html" rel="noopener">https://www.nytimes.com/interactive/2026/11/03/us/elections/results-senate.html</a></li>' + \
        f'<li id="src-{k + 2}">The Watch’s Election Desk, 2024 presidential results by county (the baseline every 2026 county is compared with). <a href="https://bboldt86.github.io/lanscape-navigator/election2026/" rel="noopener">https://bboldt86.github.io/lanscape-navigator/election2026/</a></li></ol>'
    stat_row = (f"<div class=\"stat-row\"><div class=\"stat d\"><b>{stt['left']}</b><span>of {stt['n']} {county_word(st)} moved toward the Democrats</span></div><div class=\"stat r\"><b>{stt['right']}</b><span>moved toward the Republicans</span></div><div class=\"stat\"><b>{pts(stt['median'])}</b><span>the typical {county_word(st, False)}’s move, in points</span></div><div class=\"stat\"><b>{stt['flipD']}</b><span>went from a Trump win to a Democratic one</span></div></div>" if rs else
                f"<div class=\"stat-row\"><div class=\"stat {mclass(u['m24'])}\"><b>{margin(u['m24'])}</b><span>Harris–Trump, 2024</span></div><div class=\"stat {mclass(u['m26'])}\"><b>{margin(u['m26'])}</b><span>{esc(u['office'])}, 2026</span></div><div class=\"stat\"><b>{pts(u['m26'] - u['m24'])}</b><span>the state’s move, in points</span></div><div class=\"stat\"><b>{u['eevp'] if u['eevp'] is not None else '–'}%</b><span>of the expected vote counted</span></div></div>")
    body = f"""{head(title, dek, slug, 'share', published=rep.get('written'))}
{viz_block(views=False, race=False, hint='Drag to turn the map, scroll to zoom, hover a county for its numbers; tap or click one to read its note. Full screen for a recording.')}
<main>
<div class="narrow head"><p class="k">The wave · state by state · {esc(NAME[st])}</p><h1>{esc(title)}</h1><p class="dek">{esc(dek)}</p>
<p class="byline">By <b>Claude</b> ({esc(model)}, with web search) for The Watch, {when(rep.get('written'))}, from the count as of {when(rep.get('asOf'))}; the tables below refresh with the count (last {built.strftime('%b. %-d, %-I:%M %p')} ET, AP via The New York Times), and the piece is rewritten when a race is called or a margin moves more than a point. {len(srcs)} sources. <a href="./#states">All the states ›</a></p></div>
<div class="narrow body">
{stat_row}
{render_paras(rep)}
<h2>The race{'s' if len(S['states'][st]['races']) > 1 else ''}</h2>
{races_table(st)}
<p><small>The map uses the {'Senate' if v['use'] == 'S' else 'governor’s'} race for this state’s {county_word(st)}. Counts from AP via The New York Times, as of {ASOF}; 2024 baseline from The Watch’s Election Desk.<sup><a href="#src-{k + 1}">{k + 1}</a>, <a href="#src-{k + 2}">{k + 2}</a></sup></small></p>
{(f'<h2>The biggest moves</h2>{county_list(rs, 8)}<h2>The biggest {county_word(st)}</h2>{county_list(rs, 8, key=lambda r: -r["t"])}' if rs else '')}
{explorer([st], 'Every ' + county_word(st, False) + ' in ' + NAME[st]) if rs else ''}
<div class="next"><span class="k">Next state</span><a href="{STATE_SLUG[nxt]}.html">{esc(REPORTS[nxt]['headline'])}</a><p style="margin:8px 0 0;font-size:14px;color:var(--ink-2)"><a href="{STATE_SLUG[prev]}.html">‹ {esc(NAME[prev])}</a> · <a href="./#states">All the states</a> · <a href="./">The whole wave</a>{f' · <a href="{area["slug"]}.html">{esc(area["short"])}</a>' if area else ''}</p></div>
<h2>Sources</h2><div class="sources">{sources}</div>
</div>
</main>
<script>window.WAVE_PAGE = {json.dumps(page)};</script>
{foot()}"""
    open(os.path.join(W, slug + '.html'), 'w', encoding='utf-8').write(body)
    return {'st': st, 'name': NAME[st], 'slug': slug, 'title': title, 'dek': dek, 'summary': rep.get('summary', ''), 'swing': round(swing_of(st), 1), 'race': v['use'], 'winner': u.get('winner'), 'written': rep.get('written')}

def states_section():
    sts = sorted((st for st, v in S['states'].items() if v.get('use')), key=lambda st: -swing_of(st))
    cards = []
    for st in sts:
        v, u = race_of(st); sw = swing_of(st); rep = REPORTS.get(st); word = 'Senate' if v['use'] == 'S' else 'Governor'
        who = f"{esc(last(u['dem']))} v {esc(last(u['rep']))}" + (f", <b class='{'d' if u['winner'] == 'D' else 'r'}'>{esc(last(u['dem'] if u['winner'] == 'D' else u['rep']))}</b>" if u.get('winner') else ', not called')
        num = f"<span class='sn'><b class='{mclass(sw)}'>{pts(sw)}</b> · {word}: {who}</span>"
        if rep: cards.append(f'<a class="sc" href="{STATE_SLUG[st]}.html"><span class="st">{esc(NAME[st])}</span>{num}<b>{esc(rep["headline"])}</b><span>{esc(rep.get("summary") or rep["dek"])}</span></a>')
        else: cards.append(f'<div class="sc soon"><span class="st">{esc(NAME[st])}</span>{num}<span>Being written.</span></div>')
    done = len(REPORTS); total = len(sts)
    if not done: return f"""<h2 id="states">Every state</h2>
<p>A piece for each of the {total} states with a Senate or governor’s race is being written, reported with web search by Claude Opus 5.5 through Anthropic’s API with its numbers locked to the count above, along with a note on every county. They appear here as they are finished.</p>
"""
    return f"""<h2 id="states">Every state</h2>
<p>One piece for each of the {total} states with a Senate or governor’s race, reported with web search and written by Claude Opus 5.5 through Anthropic’s API, its numbers locked to the count above: {done} written so far{', the rest being written' if done < total else ''}. Sorted by how far the state moved. {f'Tap any county on the map, or a row in the tables, for a note on what it did; notes are written for {len(NOTE_STATES)} states so far.' if NOTE_STATES else ''}</p>
<div class="states-grid">{''.join(cards)}</div>
"""

# ---------- the areas ----------
AREAS = [
    {'slug': 'south-texas', 'states': ['TX'], 'bbox': [294, 447, 474, 598], 'pad': 1.3, 'n': 1, 'title': 'The border counties that swung hardest',
     'short': 'South Texas', 'dek': 'Starr County moved {starr} points. The Rio Grande Valley and the counties along the border, which went for Trump two years ago, came back to the Democrats harder than anywhere else in the country.'},
    {'slug': 'southeast', 'states': ['GA', 'NC', 'SC', 'FL', 'VA'], 'n': 2, 'title': 'The Southeast: every county in four states, and most of Florida',
     'short': 'The Southeast', 'dek': 'Georgia, North Carolina, South Carolina and Virginia moved left in every county. Florida moved too, even as it stayed red.'},
    {'slug': 'midwest', 'states': ['OH', 'IA', 'KS', 'MI', 'WI', 'MN', 'NE', 'IL'], 'n': 3, 'title': 'The Midwest: Ohio, Iowa and Kansas flip',
     'short': 'The Midwest', 'dek': 'Three Senate seats Trump carried by double digits changed hands. The swing ran from the Great Lakes to the Kansas prairie, meatpacking towns included.'},
    {'slug': 'deep-south', 'states': ['MS', 'AL', 'LA', 'KY', 'WV', 'TN', 'AR', 'OK'], 'n': 4, 'title': 'The Deep South and Appalachia: the reddest counties moved too',
     'short': 'The Deep South', 'dek': 'Republicans held every seat here but Mississippi’s, and every county still moved toward the Democrats, most of them by 15 to 25 points.'},
    {'slug': 'moved-right', 'states': ['VT', 'ME', 'NH', 'NY', 'MA', 'MD'], 'n': 5, 'title': 'Where the map moved right',
     'short': 'The 101 counties that moved right', 'dek': 'Only {right} counties moved toward the Republicans. They are in Vermont, Maine, upstate New York and a few corners of Maryland, and most of them have a governor to thank.'},
]
def area_rows(a): return [r for r in rows if r['st'] in a['states']]

def area_callouts(a, st):
    rs = area_rows(a)
    if a['slug'] == 'south-texas':
        pick = ['48427', '48505', '48215', '48029']
        labels = {'48427': 'Starr County', '48505': 'Zapata County', '48215': 'Hidalgo County', '48029': 'Bexar County (San Antonio)'}
    elif a['slug'] == 'southeast':
        pick = ['13121', '37183', '12086', '45019']; labels = {'13121': 'Fulton County (Atlanta)', '37183': 'Wake County (Raleigh)', '12086': 'Miami-Dade', '45019': 'Charleston County'}
    elif a['slug'] == 'midwest':
        pick = ['20175', '39035', '19153', '26163']; labels = {'20175': 'Seward County, Kansas', '39035': 'Cuyahoga County (Cleveland)', '19153': 'Polk County (Des Moines)', '26163': 'Wayne County (Detroit)'}
    elif a['slug'] == 'deep-south':
        pick = ['28049', '01073', '21111', '54039']; labels = {'28049': 'Hinds County (Jackson)', '01073': 'Jefferson County (Birmingham)', '21111': 'Jefferson County (Louisville)', '54039': 'Kanawha County (Charleston)'}
    else:
        pick = ['50007', '23019', '36045', '24047']; labels = {'50007': 'Chittenden County, Vt.', '23019': 'Penobscot County, Me.', '36045': 'Jefferson County, N.Y.', '24047': 'Worcester County, Md.'}
    out = []; t0 = 3.0
    for i, f in enumerate(pick):
        r = next((x for x in rs if x['f'] == f), None)
        if not r: continue
        v, u = race_of(r['st'])
        out.append({'at': 'county:' + f, 'html': f"<b>{labels[f]}</b><span>{'moved left' if r['sh'] > 0 else 'moved right'} {abs(r['sh']):.0f} points: {margin(r['m24'])} for Harris–Trump, {margin(r['m26'])} for {esc(last(u['dem']))}–{esc(last(u['rep']))}</span>", 'off': [[0.08, -0.26], [-0.34, 0.08], [0.1, 0.1], [-0.36, -0.22]][i % 4], 'from': t0 + i * 4.2, 'to': t0 + i * 4.2 + 3.9})
    return out

def area_prose(a, st):
    rs = area_rows(a); top = sorted(rs, key=lambda r: -r['sh']); bot = sorted(rs, key=lambda r: r['sh']); big = sorted(rs, key=lambda r: -r['t'])
    by = {s: stats(byst.get(s, [])) for s in a['states']}
    def sw(s): v, u = race_of(s); return u['m26'] - u['m24'] if u else 0
    P = []
    if a['slug'] == 'south-texas':
        rgv = [r for r in rs if r['f'] in ('48427', '48505', '48479', '48215', '48061', '48323', '48131', '48247', '48505', '48489')]
        P.append(f"<p class=\"lede\">No county in America moved as far as Starr County, on the Rio Grande below Laredo. In 2024 it gave Donald Trump a {abs(starr['m24']):.0f}-point win, the first time a Republican presidential candidate had carried it in more than a century.{c('politico')} On Tuesday it went for James Talarico by {starr['m26']:.0f} points: a move of {starr['sh']:.0f} points on {n(starr['t'])} votes.{c('nyt', 'base')}</p>")
        P.append(f"<p>It was not alone. Every one of Texas’s 254 counties moved toward the Democrats, and the ten biggest moves in the country are {'all' if all(r['st'] == 'TX' for r in sorted(rows, key=lambda r: -r['sh'])[:10]) else 'mostly'} in Texas or across the Kansas line.{c('nyt', 'base')} Zapata moved {next(r['sh'] for r in rs if r['f']=='48505'):.0f} points, Maverick {next(r['sh'] for r in rs if r['f']=='48323'):.0f}, Webb (Laredo) {next(r['sh'] for r in rs if r['f']=='48479'):.0f} and Hidalgo (McAllen), with {n(next(r['t'] for r in rs if r['f']=='48215'))} votes the Valley’s biggest county, {next(r['sh'] for r in rs if r['f']=='48215'):.0f}. Cameron (Brownsville) moved {next(r['sh'] for r in rs if r['f']=='48061'):.0f}, El Paso {next(r['sh'] for r in rs if r['f']=='48141'):.0f}.</p>")
        P.append(f"<p>The picture above draws every Texas county as a block whose height is that move. The Valley stands up like a wall; the Panhandle and the Hill Country, which also moved, mostly by 15 to 25 points, sit lower but still blue. Statewide Talarico beat Ken Paxton by {TXR['m26']:.1f} points, in a state Trump had won by {abs(TXR['m24']):.1f}; Gina Hinojosa beat Gov. Greg Abbott by {S['states']['TX']['races']['G']['m26']:.1f}, the first Democrat elected governor since Ann Richards.{c('nyt', 'kut')} Talarico’s {n(TXR['demVotes'])} votes are the most a Democrat has ever won in Texas.{c('romano')}</p>")
        P.append(f"<h2>What moved it</h2><p>The border counties are overwhelmingly Hispanic, and the reporting from the Valley points at the same things voters named everywhere else, sharpened by where they live: prices, and the immigration raids of the past year. Politico quoted a Democratic strategist calling the result “an earthquake,” a Republican one saying his party had “rented” the Hispanic vote, and Rep. Vicente Gonzalez calling the ICE raids a dark blemish that voters punished.{c('politico')} A CNN voter poll found about 11 percent of Texas Republicans and Republican-leaning independents voted for Talarico, a fifth of those under 45.{c('stuck')} Talarico’s campaign spent about $2.6 million on Spanish-language advertising through September, nearly twice what Paxton and his allies spent.{c('newsweek-tx')}</p>")
        P.append(f"<p>Turnout matters to the arithmetic. Starr County cast {n(starr['t'])} votes this year against {n(starr['t24'])} in the presidential race; across the state the counties counted so far cast {ALL and n(sum(r['t'] for r in rs))} votes, {sum(r['t'] for r in rs) / sum(r['t24'] for r in rs) * 100:.0f} percent of 2024’s total.{c('nyt', 'base')} A move of 72 points does not mean a third of the county changed its mind: some of it is Trump voters who stayed home, some is Democrats who came back, and the county-level count cannot tell those apart.</p>")
        P.append(f"<h2>The cities and the suburbs</h2><p>The metro counties moved less in points but far more in votes. Harris County (Houston) went from {margin(next(r['m24'] for r in rs if r['f']=='48201'))} to {margin(next(r['m26'] for r in rs if r['f']=='48201'))}, Bexar (San Antonio) from {margin(next(r['m24'] for r in rs if r['f']=='48029'))} to {margin(next(r['m26'] for r in rs if r['f']=='48029'))}, Tarrant (Fort Worth), which Trump carried, to {margin(next(r['m26'] for r in rs if r['f']=='48439'))}.{c('nyt')} Collin and Denton, the fast-growing counties north of Dallas that voted for Trump by 11 and 13, both flipped.{c('nyt', 'newsweek-tx')} In all, {by['TX']['flipD']} Texas counties that Trump won in 2024 voted for Talarico.</p>")
    elif a['slug'] == 'southeast':
        P.append(f"<p class=\"lede\">In Georgia, North Carolina, South Carolina and Virginia, not one county moved toward the Republicans. Florida, which Trump won by {abs(race_of('FL')[1]['m24']):.0f} points and where Ashley Moody held the Senate seat, moved left in {by['FL']['left']} of its {by['FL']['n']} counties anyway.{c('nyt', 'base')}</p>")
        P.append(f"<p>The swings were among the biggest outside Texas: North Carolina {sw('NC'):+.1f} points, where Roy Cooper beat Michael Whatley by {race_of('NC')[1]['m26']:.1f} in a state Trump carried by {abs(race_of('NC')[1]['m24']):.1f}; South Carolina {sw('SC'):+.1f}, where Annie Andrews took a seat Republicans had held since 1966; Georgia {sw('GA'):+.1f}, with Jon Ossoff re-elected by {race_of('GA')[1]['m26']:.1f} and Keisha Lance Bottoms elected governor; Virginia {sw('VA'):+.1f} for Mark Warner.{c('nyt', 'cbs')} The typical county in these five states moved {stats(rs)['median']:.1f} points.</p>")
        P.append(f"<h2>Where the votes are</h2><p>The tall blocks in the picture are not where the votes are. Wake County (Raleigh), {n(next(r['t'] for r in rs if r['f']=='37183'))} votes, moved {next(r['sh'] for r in rs if r['f']=='37183'):.0f} points, from {margin(next(r['m24'] for r in rs if r['f']=='37183'))} to {margin(next(r['m26'] for r in rs if r['f']=='37183'))}. Mecklenburg (Charlotte) moved {next(r['sh'] for r in rs if r['f']=='37119'):.0f}, Fulton (Atlanta) {next(r['sh'] for r in rs if r['f']=='13121'):.0f}, Gwinnett {next(r['sh'] for r in rs if r['f']=='13135'):.0f}, Cobb {next(r['sh'] for r in rs if r['f']=='13067'):.0f}.{c('nyt')} Miami-Dade, which Trump won by {abs(next(r['m24'] for r in rs if r['f']=='12086')):.0f} points in 2024, went for Angie Nixon by {next(r['m26'] for r in rs if r['f']=='12086'):.0f}: a {next(r['sh'] for r in rs if r['f']=='12086'):.0f}-point move in the most Hispanic big county in the country, the same story Politico told about South Texas.{c('nyt', 'politico')}</p>")
        P.append(f"<p>The rural South moved as much. In Georgia, {sum(1 for r in byst['GA'] if r['t'] < 10000)} counties with fewer than 10,000 votes moved a median {statistics.median(r['sh'] for r in byst['GA'] if r['t'] < 10000):.0f} points; Newsweek’s round-up of the exit polls put the Republican margin in rural areas nationally at 16 points, half of 2024’s 32.{c('rural')} The biggest single move in the region was {esc(top[0]['n'])}, {top[0]['st']}, {top[0]['sh']:.0f} points.</p>")
        P.append(f"<h2>Florida</h2><p>Florida is the region’s exception that proves the rule: it stayed Republican at the top of the ticket, Moody by {abs(race_of('FL')[1]['m26']):.1f} and Byron Donalds for governor by {abs(S['states']['FL']['races']['G']['m26']):.1f}, yet the state as a whole moved {sw('FL'):+.1f} points and {by['FL']['flipD']} of its counties went from Trump to the Democrat.{c('nyt')} The one Florida county that moved right is {esc(bot[0]['n']) if bot[0]['st']=='FL' else esc(next(r['n'] for r in bot if r['st']=='FL'))}, by {abs(next(r['sh'] for r in bot if r['st']=='FL')):.1f} points.</p>")
    elif a['slug'] == 'midwest':
        P.append(f"<p class=\"lede\">Three of the seven Senate seats the Democrats took were here, in states Trump won by {abs(race_of('OH')[1]['m24']):.0f}, {abs(race_of('IA')[1]['m24']):.0f} and {abs(race_of('KS')[1]['m24']):.0f} points.{c('nyt', 'cbs')} Sherrod Brown’s Ohio moved {sw('OH'):+.1f}, Josh Turek’s Iowa {sw('IA'):+.1f}, Adam Hamilton’s Kansas {sw('KS'):+.1f}. All {by['OH']['n']} Ohio counties, all {by['IA']['n']} in Iowa and all {by['KS']['n']} in Kansas moved left.</p>")
        P.append(f"<p>Kansas has the region’s tallest blocks and its strangest story. Seward County, in the southwest corner, had voted for Trump by {abs(next(r['m24'] for r in rs if r['f']=='20175')):.0f}; it voted for Hamilton by {next(r['m26'] for r in rs if r['f']=='20175'):.0f}, a move of {next(r['sh'] for r in rs if r['f']=='20175'):.0f} points. Ford County (Dodge City) moved {next(r['sh'] for r in rs if r['f']=='20057'):.0f}, Finney (Garden City) {next(r['sh'] for r in rs if r['f']=='20055'):.0f}.{c('nyt')} These are meatpacking counties with large Hispanic populations, and a Republican state senator told Politico that recent ICE activity there had changed the local electorate.{c('politico')} Hamilton won the state by {race_of('KS')[1]['m26']:.1f}; Cindy Holscher led the governor’s race by {S['states']['KS']['races']['G']['m26']:.1f} with the count not yet called.{c('nyt', 'yahoo')}</p>")
        P.append(f"<h2>The Great Lakes</h2><p>Michigan, Wisconsin and Minnesota moved less, {sw('MI'):+.1f}, {sw('WI'):+.1f} and {sw('MN'):+.1f}, because they had less far to go: all three were close to even in 2024 and are now solidly blue in these races. Abdul El-Sayed won Michigan’s open Senate seat by {race_of('MI')[1]['m26']:.1f}; Wayne County (Detroit) moved {next(r['sh'] for r in rs if r['f']=='26163'):.0f} points and Oakland {next(r['sh'] for r in rs if r['f']=='26125'):.0f}.{c('nyt')} David Crowley took the Wisconsin governorship by {S['states']['WI']['races']['G']['m26']:.1f}. Illinois, with Juliana Stratton winning Dick Durbin’s old seat by {race_of('IL')[1]['m26']:.1f}, has {by['IL']['right']} counties that moved right, all small and all in the west of the state, where the Republican ran ahead of Trump’s 2024 share by a few points.{c('nyt')}</p>")
        P.append(f"<p>Nebraska is counted here with the independent Dan Osborn as the Democrats’ side, since no Democrat was on the ballot; he lost to Pete Ricketts by {abs(race_of('NE')[1]['m26']):.1f}, and the state still moved {sw('NE'):+.1f}.{c('nyt')} Across the eight states the typical county moved {stats(rs)['median']:.1f} points and {stats(rs)['flipD']} counties went from a Trump win to a Democratic one.</p>")
    elif a['slug'] == 'deep-south':
        P.append(f"<p class=\"lede\">Republicans won {sum(1 for s in a['states'] if race_of(s)[1] and race_of(s)[1].get('winner') == 'R')} of the {len(a['states'])} races in these states; Mississippi, where Scott Colom led Cindy Hyde-Smith by {abs(race_of('MS')[1]['demVotes'] - race_of('MS')[1]['repVotes']):,} votes with absentee ballots still arriving, was not called.{c('nyt', 'yahoo')} Every county in all eight states moved toward the Democrats anyway, the typical one by {stats(rs)['median']:.1f} points.</p>")
        P.append(f"<p>The swings: Mississippi {sw('MS'):+.1f}, West Virginia {sw('WV'):+.1f}, Alabama {sw('AL'):+.1f}, Louisiana {sw('LA'):+.1f}, Arkansas {sw('AR'):+.1f}, Kentucky {sw('KY'):+.1f}, Tennessee {sw('TN'):+.1f}, Oklahoma {sw('OK'):+.1f}.{c('nyt', 'base')} In West Virginia, which Trump won by {abs(race_of('WV')[1]['m24']):.0f}, Shelley Moore Capito was re-elected by {abs(race_of('WV')[1]['m26']):.0f}. The picture is a plateau rather than a wall: no county here moved 40 points, but none moved less than {min(r['sh'] for r in rs):.0f}.</p>")
        P.append(f"<h2>Mississippi</h2><p>Mississippi is the region’s one real contest, and the data shows why. Hinds County (Jackson) moved {next(r['sh'] for r in rs if r['f']=='28049'):.0f} points to {margin(next(r['m26'] for r in rs if r['f']=='28049'))}; DeSoto County, the Memphis suburb that voted for Trump by {abs(next(r['m24'] for r in rs if r['f']=='28033')):.0f}, moved {next(r['sh'] for r in rs if r['f']=='28033'):.0f}.{c('nyt')} The state’s secretary of state said about 3,600 absentee ballots were outstanding; the counties must certify by Nov. 13 and the state does not allow recounts.{c('cbs')} A Democrat has not won this seat since 1982.{c('yahoo')}</p>")
        P.append(f"<h2>Why the reddest places moved</h2><p>The Washington Post found rural counties moved more than 15 points from 2024; Reuters, across more than 1,500 rural counties, found Republicans running 8 points behind Trump’s 2024 share.{c('rural')} The exit polls put rural voters at 57–41 for Republicans, a 16-point margin against 32 in 2024.{c('rural')} Diesel, which farmers and truckers buy by the tank, went from about $3.60 a gallon before the Iran war to about $6.27 by October; farm bankruptcies through three quarters were up about 19 percent.{c('rural')} The biggest moves in the region were {esc(top[0]['n'])}, {top[0]['st']} ({top[0]['sh']:.0f}) and {esc(top[1]['n'])}, {top[1]['st']} ({top[1]['sh']:.0f}); the biggest counties, Jefferson (Louisville) at {next(r['sh'] for r in rs if r['f']=='21111'):.0f} and Jefferson (Birmingham) at {next(r['sh'] for r in rs if r['f']=='01073'):.0f}.{c('nyt')}</p>")
    else:
        vt = race_of('VT')[1]; me = race_of('ME')[1]; ny = S['states']['NY']['races']['G']; md = S['states']['MD']['races']['G']
        rightall = sorted([r for r in rows if r['sh'] < 0], key=lambda r: r['sh'])
        byst_r = {}
        for r in rightall: byst_r[r['st']] = byst_r.get(r['st'], 0) + 1
        P.append(f"<p class=\"lede\">Of the {n(ALL['n'])} counties counted, {ALL['right']} moved toward the Republicans. {byst_r.get('VT', 0)} are in Vermont, {byst_r.get('ME', 0)} in Maine, {byst_r.get('NY', 0)} in New York, {byst_r.get('MD', 0)} in Maryland; the rest are scattered across {len([s for s in byst_r if s not in ('VT', 'ME', 'NY', 'MD')])} other states, most of them small and most by a point or two.{c('nyt', 'base')}</p>")
        P.append(f"<p>Nearly all of them have a popular governor or senator to thank, not a change of heart about the president. The tallest red blocks in the country are Vermont’s: Phil Scott, the Republican governor, was re-elected by {abs(vt['m26']):.1f} points in a state Kamala Harris carried by {vt['m24']:.0f}, so every Vermont county reads as a move of 30 to 50 points to the right.{c('nyt')} Chittenden County (Burlington), which Harris won by {abs(next(r['m24'] for r in rs if r['f']=='50007')):.0f}, gave Scott’s opponent a margin of only {abs(next(r['m26'] for r in rs if r['f']=='50007')):.0f}. Vermont had no Senate race this year, so the governor’s race is the only measure the map has.</p>")
        P.append(f"<h2>Maine</h2><p>Maine is the subtler case. Troy Jackson beat Susan Collins by {me['m26']:.1f} points, in a state Harris won by {me['m24']:.1f}: a move of {me['m26'] - me['m24']:+.1f}, which makes Maine the only state with a race where the typical county moved right.{c('nyt', 'cbs')} Collins, who had won every county but two in 2020, lost {sum(1 for r in byst['ME'] if r['m26'] > 0)} of 16 this time, and the ones that moved toward her did so by single digits: Penobscot by {abs(next(r['sh'] for r in rs if r['f']=='23019')):.1f}, Aroostook by {abs(next(r['sh'] for r in rs if r['f']=='23003')):.1f}.{c('nyt', 'maine')} She ran ahead of Trump everywhere; she just did not run far enough ahead.</p>")
        P.append(f"<h2>Upstate New York and the Eastern Shore</h2><p>Kathy Hochul was re-elected by {ny['m26']:.1f}, up from Harris’s {ny['m24']:.1f}, but Bruce Blakeman ran ahead of Trump across upstate: {byst_r.get('NY', 0)} of New York’s 62 counties moved right, by at most {abs(min(r['sh'] for r in byst['NY'])):.1f} points (Jefferson County, around Fort Drum), while the city and its suburbs moved left, Brooklyn by {next(r['sh'] for r in rs if r['f']=='36047'):.0f} and Suffolk by {next(r['sh'] for r in rs if r['f']=='36103'):.0f}.{c('nyt')} In Maryland, Wes Moore won by {md['m26']:.1f} against Harris’s {md['m24']:.1f}, and the Eastern Shore and Carroll County moved a point or two toward Dan Cox.{c('nyt')} Maryland’s count was {md['eevp']}% complete when this was written, so those small moves may still change sign.</p>")
        P.append(f"<p>The lesson of the red blocks is about the measure, not the voters: a county “moves right” on this map when its Senate or governor vote is less Democratic than its presidential vote, and in New England that mostly means a Republican who is not Donald Trump. Elsewhere, the two Illinois counties with the biggest moves right, {esc(next(r['n'] for r in rightall if r['st']=='IL'))} and {esc([r for r in rightall if r['st']=='IL'][1]['n'])}, cast about {n([r for r in rightall if r['st']=='IL'][0]['t'])} votes each.{c('nyt')}</p>")
    return ''.join(P)

def area_page(a):
    st = stats(area_rows(a)); rs = area_rows(a)
    title = a['title']; dek = a['dek'].format(starr=f"{starr['sh']:.0f}", right=ALL['right'])
    v, u = race_of(a['states'][0])
    viz = {'focus': {'states': a['states'], 'pad': a.get('pad', 1.18), **({'bbox': a['bbox']} if a.get('bbox') else {})}, 'dur': 22, 'loop': True,
           'title': {'kicker': 'The wave · ' + a['short'], 'h2': f"{st['right']} of {st['n']} counties<br>moved right" if a['slug'] == 'moved-right' else f"{st['left']} of {st['n']} counties<br>moved left", 'what': 'counties'},
           'callouts': area_callouts(a, st)}
    page = {'slug': a['slug'], 'url': PUBLIC + a['slug'] + '.html', 'shareText': f"{title}: {dek}", 'viz': viz, 'states': a['states'], 'sort': 'sh-desc' if a['slug'] != 'moved-right' else 'sh-asc', **page_ctx()}
    others = [x for x in AREAS if x['slug'] != a['slug']]
    body = f"""{head(title, dek, a['slug'], a['slug'], published=PUB_ISO)}
{viz_block(views=False, race=False, hint='Drag to turn the map, scroll to zoom, hover a county for its numbers; tap or click one to read its note. Full screen for a recording.')}
<main>
<div class="narrow head"><p class="k">The wave · part {a['n']} of 5 · {a['short']}</p><h1>{esc(title)}</h1><p class="dek">{esc(dek)}</p>
<p class="byline">By <b>Claude</b> (Claude Fable 5.1) for The Watch, {PUBLISHED.strftime('%b. %-d, %Y')}; the numbers refresh with the count (last {built.strftime('%b. %-d, %-I:%M %p')} ET). Counts as of {ASOF}, AP via The New York Times. <a href="./">The whole wave ›</a></p></div>
<div class="narrow body">
<div class="stat-row"><div class="stat d"><b>{st['left']}</b><span>of {st['n']} counties moved toward the Democrats</span></div><div class="stat r"><b>{st['right']}</b><span>moved toward the Republicans</span></div><div class="stat"><b>{pts(st['median'])}</b><span>the typical county’s move, in points</span></div><div class="stat"><b>{st['flipD']}</b><span>counties went from a Trump win to a Democratic one</span></div></div>
{area_prose(a, st)}
<h2>The states</h2>
{state_table(a['states'])}
{('<p class="state-links"><span class="k">State by state</span> ' + ' · '.join(f'<a href="{STATE_SLUG[s]}.html">{esc(NAME[s])}</a>' for s in a['states'] if s in REPORTS) + '</p>') if any(s in REPORTS for s in a['states']) else ''}
<h2>The biggest moves {'right' if a['slug']=='moved-right' else 'left'}</h2>
{county_list(rs, 10, key=(lambda r: r['sh']) if a['slug']=='moved-right' else (lambda r: -r['sh']))}
<h2>The biggest counties</h2>
{county_list(rs, 8, key=lambda r: -r['t'])}
{explorer(a['states'], 'Every county in ' + ', '.join(NAME[s] for s in a['states']))}
<div class="next"><span class="k">Next in the series</span><a href="{others[a['n'] % 5 - 1 if a['n'] < 5 else 0]['slug'] if False else (AREAS[a['n'] % 5]['slug'])}.html">{esc(AREAS[a['n'] % 5]['title'])}</a><p style="margin:8px 0 0;font-size:14px;color:var(--ink-2)"><a href="./">The whole wave</a> · {' · '.join(f'<a href="{x["slug"]}.html">{esc(x["short"])}</a>' for x in others)}</p></div>
<h2>Sources</h2><div class="sources">{sources_html()}</div>
</div>
</main>
<script>window.WAVE_PAGE = {json.dumps(page)};</script>
{foot()}"""
    open(os.path.join(W, a['slug'] + '.html'), 'w', encoding='utf-8').write(body)
    return {'slug': a['slug'], 'title': title, 'dek': dek, 'short': a['short'], 'n': a['n'], 'left': st['left'], 'right': st['right'], 'counties': st['n'], 'median': round(st['median'], 1)}

# ---------- the main page ----------
def main_page(cards):
    title = f"{PCT}% of counties counted moved left since 2024"
    dek = f"Every county with a Senate or governor race on Tuesday, drawn as a block whose height is how far it moved from the Harris–Trump vote. {n(ALL['left'])} of {n(ALL['n'])} moved toward the Democrats, the typical one by {ALL['median']:.0f} points; all 254 Texas counties did, Starr County by {starr['sh']:.0f}. Plus the night as it happened, seat by seat."
    tx_g = S['states']['TX']['races']['G']
    vt = race_of('VT')[1]; me = race_of('ME')[1]
    biggest = sorted(rows, key=lambda r: -r['t'])[:12]
    tallest_east = sorted([r for r in rows if r['st'] not in ('TX', 'KS')], key=lambda r: -r['sh'])[:3]
    regions = {'South': ['TX', 'GA', 'NC', 'SC', 'FL', 'VA', 'MS', 'AL', 'LA', 'KY', 'WV', 'TN', 'AR', 'OK'], 'Midwest': ['OH', 'IA', 'KS', 'MI', 'WI', 'MN', 'NE', 'IL', 'SD'], 'Northeast': ['VT', 'ME', 'NH', 'NY', 'MA', 'MD', 'NJ', 'PA', 'DE', 'RI', 'CT'], 'West': ['CA', 'OR', 'ID', 'MT', 'WY', 'NV', 'AZ', 'CO', 'NM', 'HI']}
    reg_rows = ''.join(f"<tr><td>{k}</td><td>{stats([r for r in rows if r['st'] in v])['n']}</td><td class='d'>{stats([r for r in rows if r['st'] in v])['left']}</td><td class='r'>{stats([r for r in rows if r['st'] in v])['right']}</td><td><b class='d'>{pts(stats([r for r in rows if r['st'] in v])['median'])}</b></td><td>{pts(stats([r for r in rows if r['st'] in v])['weighted'])}</td><td>{stats([r for r in rows if r['st'] in v])['flipD']}</td></tr>" for k, v in regions.items())
    page = {'slug': 'the-wave', 'url': PUBLIC, 'shareText': f"{title}. The Watch drew every county's move since 2024 as a 3-D map, and replayed election night seat by seat.", 'viz': {'view': 'wave', 'loop': True}, **page_ctx()}
    body = f"""{head(title, dek, '', 'share', published=PUB_ISO)}
{viz_block(views=True, race=True, hint='Two views: the wave (every county’s move since 2024) and election night (the calls and the count, 6 p.m. to 3 a.m. ET). Drag to turn the map, scroll to zoom, hover a county for its numbers, click one to read its note. Full screen to record it.')}
<main>
<div class="narrow head"><p class="k">The Watch report · Politics · The wave</p><h1>{esc(title)}</h1><p class="dek">{esc(dek)}</p>
<p class="byline">By <b>Claude</b> (Claude Fable 5.1) for The Watch, {PUBLISHED.strftime('%b. %-d, %Y')}; the numbers refresh with the count (last {built.strftime('%b. %-d, %-I:%M %p')} ET). Counts as of {ASOF}, AP via The New York Times; the 2024 baseline is The Watch’s Election Desk. {len(SOURCES)} sources.</p></div>
<div class="narrow body">
<div class="stat-row"><div class="stat d"><b>{n(ALL['left'])}</b><span>of {n(ALL['n'])} counties counted moved toward the Democrats</span></div><div class="stat r"><b>{ALL['right']}</b><span>moved toward the Republicans</span></div><div class="stat"><b>{pts(ALL['median'])}</b><span>the typical county’s move, in points of margin</span></div><div class="stat"><b>{ALL['flipD']}</b><span>counties went from a Trump win in 2024 to a Democratic win</span></div></div>

<p class="lede">The picture at the top of this page is a map of the United States with every county pulled up into a block. The height of the block is how far that county moved between the presidential vote two years ago and Tuesday’s vote for senator, or for governor where there was no Senate race. Blue means it moved toward the Democrats; red, toward the Republicans. Blank states had neither race on the ballot. Hover a county and it tells you its numbers.{c('nyt', 'base')}</p>
<p>What it shows is a wave. Of the {n(ALL['n'])} counties with a count so far, {n(ALL['left'])} moved left and {ALL['right']} moved right; the typical county moved {ALL['median']:.1f} points, and weighting by votes cast the move is {ALL['weighted']:.1f}, so it is not a story of small places only.{c('nyt', 'base')} {ALL['flipD']} counties that Donald Trump carried in 2024 voted for the Democratic candidate this week; {ALL['flipR']} went the other way. Every county in {sum(1 for s, v in S['states'].items() if v.get('counties') and v['right'] == 0)} of the {sum(1 for s, v in S['states'].items() if v.get('counties'))} states with a race moved left, Texas’s 254 among them.</p>
<p>The result is the Congress and the governors’ mansions that go with it. Democrats took the Senate with seven seats flipped, Texas, North Carolina, South Carolina, Ohio, Kansas, Iowa and Maine, and stood at 54 seats with Alaska and Mississippi still counting; they took the House with at least {H.get('D', 253)} seats called, the largest majority since 2008, on a national House vote about 13 points in their favor, the widest margin for either party in a midterm since 1974.{c('cbs', 'yahoo', 'romano', 'morris')} Five governorships flipped, Texas, Georgia, Ohio, Iowa and Nevada, with Kansas and Alaska leaning the same way.{c('govs')} President Trump’s approval stood at about 38 percent in the polling averages on election eve; in the exit polls 37 percent of voters approved and 63 percent did not.{c('silver', 'romano')}</p>

<h2>How big a wave</h2>
<p>The last midterm in which either party won the House vote by as much as this was 1974, three months after Richard Nixon resigned, which is why this week’s coverage keeps reaching for Watergate.{c('romano', 'morris')} The Republican waves of 1994 and 2010 were won on a House popular vote of about 6.8 points; the Democrats’ 2018 wave on about 8.6; this one on about 13.{c('romano')} Seven Senate seats changed hands, the most in a midterm since 2014, with two more still open; the president’s party has lost an average of four since the Second World War.{c('romano')} Only 1986 saw more than two Senate seats flip in states the president had won by double digits two years earlier; this year’s nine such states, flipped or still counting, were states Trump carried by an average of 12.{c('romano')}</p>
<div class="tblwrap"><table class="tbl"><thead><tr><th>Midterm</th><th>President</th><th>House vote</th><th>House seats won by the other party</th></tr></thead><tbody>
<tr><td>1974</td><td>Ford (R)</td><td class="d">D+13.7</td><td>291 (D)</td></tr>
<tr><td>1994</td><td>Clinton (D)</td><td class="r">R+6.8</td><td>230 (R)</td></tr>
<tr><td>2006</td><td>Bush (R)</td><td class="d">D+8.0</td><td>233 (D)</td></tr>
<tr><td>2010</td><td>Obama (D)</td><td class="r">R+6.8</td><td>242 (R)</td></tr>
<tr><td>2018</td><td>Trump (R)</td><td class="d">D+8.6</td><td>235 (D)</td></tr>
<tr><td>2026</td><td>Trump (R)</td><td class="d">about D+13</td><td>{H.get('D', 253)} called, {H.get('called', '–')} of 435 decided</td></tr>
</tbody></table></div>
<p><small>Past years’ House votes and seats are the standard figures from the Clerk of the House’s election statistics; 1994 and 2010 margins and the 1974 comparison are as reported by Yahoo News and Strength In Numbers.{c('romano', 'morris')}</small></p>

<h2>How to read the wave</h2>
<p>The map answers one question for each county: compared with the Harris–Trump vote, was Tuesday’s vote more Democratic or less, and by how much? The measure is the margin, Democratic share minus Republican share of all votes cast, in 2026 minus the same in 2024. A county that went from Trump +16 to Talarico +56, as Starr County, Texas, did, moved {starr['sh']:.0f} points, and that is the tallest block on the map.{c('nyt', 'base')} The counties in {', '.join(NAME[s] for s in S['noRace'])} are flat and grey because none of them had a Senate or governor race; Alaska counts its votes by legislative district rather than borough and is left off, as is Hawaii.</p>
<p>A move is not a flip. West Virginia moved {race_of('WV')[1]['m26'] - race_of('WV')[1]['m24']:+.0f} points and still re-elected Shelley Moore Capito by {abs(race_of('WV')[1]['m26']):.0f}; Wyoming moved {race_of('WY')[1]['m26'] - race_of('WY')[1]['m24']:+.0f} and elected Harriet Hageman by {abs(race_of('WY')[1]['m26']):.0f}.{c('nyt')} The height says how far a place travelled, not where it arrived. Nor is a move the same as persuasion: the counties counted so far cast {ALL['votes'] / ALL['votes24'] * 100:.0f} percent as many votes as they did in 2024, and a county-level count cannot say how much of a swing is voters changing their minds and how much is who turned out.{c('nyt', 'base')} The Times estimated turnout at about 44 percent of eligible voters.{c('viz')}</p>
<p>The picture is The Watch’s own, drawn in your browser from the public county counts, but the idea is borrowed: a 3-D map by the Instagram account rendered.earth, posted this week under the same headline, which we wanted to check and could reproduce almost exactly from the data (their count was 2,665 of 2,767; ours, from a later and slightly different count, is {n(ALL['left'])} of {n(ALL['n'])}).{c('reel')} Other newsrooms found the same shape with other measures: NBC News put the share of the country that shifted toward Democrats at about 90 percent in the House vote, with an average move of 13 points; a Ground News map of the House vote found 94 percent of counties moving left; The Times estimated the national shift at 15 points.{c('nbc', 'tnr', 'viz')}</p>

<h2>Where it moved most</h2>
<p>Texas, by a distance. The state moved {TXR['m26'] - TXR['m24']:+.1f} points, from Trump +{abs(TXR['m24']):.1f} to Talarico +{TXR['m26']:.1f}; Gina Hinojosa beat Greg Abbott by {tx_g['m26']:.1f} for governor.{c('nyt', 'kut')} The {sum(1 for r in sorted(rows, key=lambda r: -r['sh'])[:10] if r['st']=='TX')} biggest county moves in the country out of the top ten are in Texas, and {len([r for r in rows if r['st']=='TX' and r['sh'] >= 30])} Texas counties moved 30 points or more, most of them along the border.{c('nyt')} <a href="south-texas.html">The border counties that swung hardest ›</a></p>
<p>The rest of the top of the list is southwest Kansas, Seward, Ford and Finney counties, meatpacking towns that moved {next(r['sh'] for r in rows if r['f']=='20175'):.0f}, {next(r['sh'] for r in rows if r['f']=='20057'):.0f} and {next(r['sh'] for r in rows if r['f']=='20055'):.0f} points and carried Adam Hamilton past Roger Marshall.{c('nyt', 'politico')} Outside Texas and Kansas the biggest moves were {', '.join(f"{esc(r['n'])}, {r['st']} ({r['sh']:.0f})" for r in tallest_east)}.</p>
<p>By state, the swings were largest in Texas ({TXR['m26'] - TXR['m24']:+.1f}), Pennsylvania ({S['states']['PA']['races']['G']['m26'] - S['states']['PA']['races']['G']['m24']:+.1f}, Josh Shapiro), Rhode Island ({race_of('RI')[1]['m26'] - race_of('RI')[1]['m24']:+.1f}), Mississippi ({race_of('MS')[1]['m26'] - race_of('MS')[1]['m24']:+.1f}) and North Carolina ({race_of('NC')[1]['m26'] - race_of('NC')[1]['m24']:+.1f}); smallest in Maine ({me['m26'] - me['m24']:+.1f}), Maryland and Connecticut, and negative only in Vermont ({vt['m26'] - vt['m24']:+.1f}), where Phil Scott, a Republican governor in a state Harris won by {vt['m24']:.0f}, was re-elected.{c('nyt')} The full table is below.</p>
<div class="tblwrap"><table class="tbl"><thead><tr><th>Region</th><th>Counties</th><th>Left</th><th>Right</th><th>Typical move</th><th>Vote-weighted</th><th>Trump → Dem</th></tr></thead><tbody>{reg_rows}</tbody></table></div>

<h2>Where the votes are</h2>
<p>The tallest blocks are mostly small places. The big counties moved less in points and far more in votes: {'; '.join(f"{esc(r['n'])}, {r['st']} {pts(r['sh'])} on {n(r['t'])} votes" for r in biggest[:6])}.{c('nyt')} Of the {len(biggest)} counties that cast the most votes, {sum(1 for r in biggest if r['sh'] > 0)} moved left. Miami-Dade, the most Hispanic big county in the country, went from Trump +{abs(next(r['m24'] for r in rows if r['f']=='12086')):.0f} to the Democrat by {next(r['m26'] for r in rows if r['f']=='12086'):.0f}.{c('nyt', 'politico')}</p>
<p>The rural places moved as far as the cities or farther. The Washington Post found rural counties shifting more than 15 points; the exit polls had rural voters at 57–41 for Republicans, a 16-point margin against 32 two years ago.{c('rural')} In our count, the {sum(1 for r in rows if r['t24'] < 10000)} counties that cast fewer than 10,000 votes in 2024 moved a median {statistics.median(r['sh'] for r in rows if r['t24'] < 10000):.1f} points; the {sum(1 for r in rows if r['t24'] >= 250000)} that cast more than 250,000 moved {statistics.median(r['sh'] for r in rows if r['t24'] >= 250000):.1f}.{c('nyt', 'base')}</p>

<h2>The {ALL['right']} that moved right</h2>
<p>They are in Vermont ({S['states']['VT']['right']}), Maine ({S['states']['ME']['right']}), New York ({S['states']['NY']['right']}), Maryland ({S['states']['MD']['right']}) and a scattering of small counties in {', '.join(NAME[s] for s, v in S['states'].items() if v.get('right') and s not in ('VT', 'ME', 'NY', 'MD'))}.{c('nyt')} Nearly all have a popular Republican who is not Donald Trump to thank: Scott in Vermont, Susan Collins in Maine, who lost to Troy Jackson by {me['m26']:.1f} but ran ahead of Trump in every county, Bruce Blakeman upstate.{c('nyt', 'cbs', 'maine')} <a href="moved-right.html">Where the map moved right ›</a></p>

<h2>The night as it happened</h2>
<p>The second view, Election night, replays Tuesday from 6 p.m. to 3 a.m. Eastern. The half-circle is the House, 435 seats, with the 35 Senate seats on the ballot in the inner row; a seat lights up at the minute AP’s call was accepted, blue from the left and red from the right, and the counties in that district reach up to claim it. Below, each county’s block rises as its votes come in, blue or red by who led there.{c('nyt')} The clock, the calls and their times, the final counts and the poll-closing times are real. The pace at which each county’s block rises is reconstructed: the files we can read carry the final count, not the count minute by minute, so each state’s count is drawn starting at its poll close and fitted to the percentages The Watch’s Election Desk recorded during the night, with the West Coast left slow. Treat the vote totals in that view as a reconstruction and the calls as the record. The idea is borrowed too, from an animation by dotsimulate.{c('dots')}</p>
<p>By 3 a.m. ET, {sum(1 for r in N['races'] if r['o']=='H' and r['at'] is not None and r['at'] <= 540 and r['p']=='D')} House seats had been called for Democrats and {sum(1 for r in N['races'] if r['o']=='H' and r['at'] is not None and r['at'] <= 540 and r['p']=='R')} for Republicans; the Senate stood at {sum(1 for r in N['races'] if r['o']=='S' and r['at'] is not None and r['at'] <= 540 and r['p']=='D')}–{sum(1 for r in N['races'] if r['o']=='S' and r['at'] is not None and r['at'] <= 540 and r['p']=='R')} of the 35 on the ballot, and AP’s count gave Democrats the Senate at {dt.datetime.fromisoformat(N['t0'].replace('Z','+00:00')).astimezone(dt.timezone(dt.timedelta(hours=-5))) and (dt.datetime(2026,11,3,18,0) + dt.timedelta(minutes=SEN.get('controlledAt') or 0)).strftime('%-I:%M %p')} and the House at {(dt.datetime(2026,11,3,18,0) + dt.timedelta(minutes=H.get('controlledAt') or 0)).strftime('%-I:%M %p')}.{c('nyt')} As of {ASOF}, {H.get('called', '–')} of 435 House races were called, {H.get('D', '–')}–{H.get('R', '–')}, and the uncalled Senate and governor races were {', '.join(uncalled) if uncalled else 'none'}.{c('nyt')}</p>

<h2>Five places, up close</h2>
<p>Each of these takes a region of the map, turns the camera on it and walks through its counties.</p>
<div class="cards">{''.join(f'<a class="card" href="{x["slug"]}.html"><img src="{x["slug"]}.png" alt="" loading="lazy"><div class="cb"><div class="n">Part {x["n"]} · {esc(x["short"])}</div><h3>{esc(x["title"])}</h3><p>{esc(x["dek"])}</p></div></a>' for x in cards)}</div>

{states_section()}

<h2>How we made it</h2>
<ul>
<li><b>The 2026 counts</b> are The New York Times’s public results files, one per state, which carry The Associated Press’s county-level vote counts, AP’s race calls and its estimate of the expected vote. They were read {ASOF} and are refreshed every three hours while the count continues; this page and its numbers are rebuilt from them.{c('nyt')}</li>
<li><b>The 2024 baseline</b> is the county-level presidential result The Watch’s Election Desk has carried since October.{c('base')}</li>
<li><b>The measure</b> is margin: (Democratic − Republican) ÷ all votes cast, in points, 2026 minus 2024. A positive move is toward the Democrats.</li>
<li><b>Which race:</b> the Senate race where the state had one (Ohio’s and Florida’s special elections included), otherwise the governor’s race. The selector under the map switches to governor’s races only, or Senate only. Where no Democrat was on the ballot, or an independent out-polled the Democrat, the leading non-Republican is the Democrats’ side and the map says so when you hover: Dan Osborn in Nebraska, Seth Bodnar in Montana, Todd Achilles in Idaho, Brian Bengs in South Dakota.{c('nyt')}</li>
<li><b>What is left out:</b> {', '.join(NAME[s] for s in S['noRace'])} (no race); Alaska (no county map); Hawaii (off the frame); any county with no 2026 votes reported yet. Connecticut reports by town, so its towns are summed into the eight historical counties the map draws. Cities that AP reports inside a county it also reports whole (Michigan’s, East St. Louis) are not double-counted; Virginia’s independent cities, Baltimore, St. Louis and Carson City are counties of their own.</li>
<li><b>Still counting:</b> California ({race_of('CA')[1]['eevp']:.0f}% of the expected vote in), Oregon ({race_of('OR')[1]['eevp']:.0f}%), Maryland ({S['states']['MD']['races']['G']['eevp']:.0f}%) and New York ({S['states']['NY']['races']['G']['eevp']:.0f}%) will move. Late-counted mail ballots on the West Coast have leaned Democratic in recent elections, so their blocks will more likely grow than shrink.{c('nyt')}</li>
<li><b>The replay’s timing</b> is modeled as described above; its calls, counts and poll-close times are not.</li>
<li><b>The state pieces and the county notes</b> are written by Claude Opus 5.5 through Anthropic’s API (<code>tools/write.py</code>): each state piece from the data block for that state plus web search, with every web claim carrying the search’s own citation, and every vote number taken from the count rather than the web; each county note from the county’s numbers, its rank in the state, three comparable counties and Census ACS 2023 context, nothing else. Notes are rewritten when a county’s count moves by more than a point; pieces when a race is called or its margin moves. What it cost is in <a href="data/spend.json">spend.json</a>.</li>
<li><b>The data</b> behind both views is published with this page: <a href="data/shift.json">shift.json</a> (every county) and <a href="data/night.json">night.json</a> (every race and call), and the table below downloads as a CSV.</li>
</ul>

{explorer()}
<h2>Sources</h2><div class="sources">{sources_html()}</div>
</div>
</main>
<script>window.WAVE_PAGE = {json.dumps(page)};</script>
{foot()}"""
    open(os.path.join(W, 'index.html'), 'w', encoding='utf-8').write(body)
    return {'title': title, 'dek': dek}

cards = [area_page(a) for a in AREAS]
state_cards = [state_page(st, rep) for st, rep in sorted(REPORTS.items())]
mainp = main_page(cards)
json.dump({'v': 1, 'built': BUILT_ISO, 'published': PUB_ISO, 'asOf': S['asOf'], 'title': mainp['title'], 'dek': mainp['dek'], 'pct': PCT, 'left': ALL['left'], 'right': ALL['right'], 'counted': ALL['n'], 'median': round(ALL['median'], 1), 'starr': round(starr['sh'], 1), 'areas': cards, 'states': sorted(state_cards, key=lambda x: -x['swing']), 'notes': NOTE_STATES, 'control': ctl},
          open(os.path.join(W, 'pages.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('wrote index.html,', ', '.join(a['slug'] + '.html' for a in AREAS), f'{len(state_cards)} state pages', 'and pages.json;', PCT, '% left,', ALL)
