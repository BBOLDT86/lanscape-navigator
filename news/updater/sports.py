#!/usr/bin/env python3
"""The Watch's Sports desk: scores, schedules, standings and each league's news.

  python3 news/updater/sports.py                  rebuild news/data/sports/ (after run.py, for its edition)
  python3 news/updater/sports.py --record DIR     also save every answer under DIR (for tests)
  python3 news/updater/sports.py --replay DIR     read the answers saved there instead of the network
  python3 news/updater/sports.py check            exit 1 if the files are missing or malformed

Writes, for each league (NFL, NBA, NHL, MLB, WNBA, MLS and soccer, which has eight competitions):
  news/data/sports/<league>.json  the games from a few days back to a week or more ahead (the NFL: last week, this week
                                  and next), the standings, the teams, the season and what round it is in, and the
                                  league's news from ESPN, CBS Sports, The Athletic, Yahoo Sports and a few others
  news/data/sports/index.json     every league's state in one line, the day's games across leagues and the big ones

Scores, schedules and standings come from ESPN's public scoreboard, standings and news service (site.api.espn.com),
which answers GitHub's runners and lets browsers read it, so the page also fetches it live while games are on and
uses these files to draw at once and when ESPN can't be reached. Headlines are the outlets' own, summaries their own
descriptions clipped to about 200 characters; nothing is rewritten. Ticket prices, TV and betting lines are ESPN's,
as listed with each game. A league that fails keeps its last good copy. Standard library only.
"""
import concurrent.futures as cf
import datetime as dt
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
_argv = sys.argv
sys.argv = sys.argv[:1]  # run.py reads its own flags at import
import run  # noqa: E402  the feed reader and text helpers
sys.argv = _argv

ARGS = sys.argv[1:]
D = os.path.normpath(os.path.join(HERE, '..', 'data', 'sports'))
ETZ = ZoneInfo('America/New_York')
NOW = dt.datetime.now(dt.timezone.utc)
if '--now' in ARGS:  # tests: pretend it is this moment (ISO)
    NOW = dt.datetime.fromisoformat(ARGS[ARGS.index('--now') + 1].replace('Z', '+00:00'))
RECORD = ARGS[ARGS.index('--record') + 1] if '--record' in ARGS else None
REPLAY = ARGS[ARGS.index('--replay') + 1] if '--replay' in ARGS else None
UA = {'User-Agent': run.UA['User-Agent'], 'Accept': 'application/json, */*', 'Accept-Encoding': 'gzip'}
SITE = 'https://site.api.espn.com/apis/site/v2/sports/'
STAND = 'https://site.api.espn.com/apis/v2/sports/'
STAND3 = 'https://site.web.api.espn.com/apis/v2/sports/'
errors = []

CBS, ATH, YH = 'https://www.cbssports.com/rss/headlines/', 'https://www.nytimes.com/athletic/rss/', 'https://sports.yahoo.com/'
# standings columns: (label, ESPN stat type); sort: how to order a group's rows
US_COLS = [('W', 'wins'), ('L', 'losses'), ('PCT', 'winpercent'), ('GB', 'gamesbehind'), ('HOME', 'home'), ('AWAY', 'road'),
           ('L10', 'lasttengames'), ('STRK', 'streak')]
NFL_COLS = [('W', 'wins'), ('L', 'losses'), ('T', 'ties'), ('PCT', 'winpercent'), ('HOME', 'home'), ('AWAY', 'road'), ('DIV', 'vsdiv'),
            ('CONF', 'vsconf'), ('PF', 'pointsfor'), ('PA', 'pointsagainst'), ('DIFF', 'pointdifferential'), ('STRK', 'streak')]
NHL_COLS = [('GP', 'gamesplayed'), ('W', 'wins'), ('L', 'losses'), ('OTL', 'otlosses'), ('PTS', 'points'), ('RW', 'regwins'), ('GF', 'pointsfor'),
            ('GA', 'pointsagainst'), ('DIFF', 'pointdifferential'), ('L10', 'lasttengames'), ('STRK', 'streak')]
FOOT_COLS = [('GP', 'gamesplayed'), ('W', 'wins'), ('D', 'ties'), ('L', 'losses'), ('GF', 'pointsfor'), ('GA', 'pointsagainst'),
             ('GD', 'pointdifferential'), ('PTS', 'points')]
SOCCER = [  # key, ESPN slug, name, short name, country
    ('epl', 'eng.1', 'Premier League', 'Premier League', 'England'),
    ('ucl', 'uefa.champions', 'Champions League', 'Champions League', 'Europe'),
    ('laliga', 'esp.1', 'LaLiga', 'LaLiga', 'Spain'),
    ('bund', 'ger.1', 'Bundesliga', 'Bundesliga', 'Germany'),
    ('seriea', 'ita.1', 'Serie A', 'Serie A', 'Italy'),
    ('ligue1', 'fra.1', 'Ligue 1', 'Ligue 1', 'France'),
    ('uel', 'uefa.europa', 'Europa League', 'Europa League', 'Europe'),
    ('bra', 'bra.1', 'Brasileirão', 'Brasileirão', 'Brazil'),
]
LEAGUES = {
    'nfl': {'path': 'football/nfl', 'name': 'NFL', 'full': 'National Football League', 'mode': 'week', 'cols': NFL_COLS, 'level3': True,
            'feeds': [CBS + 'nfl/', ATH + 'nfl/', YH + 'nfl/rss/', 'https://www.nbcsports.com/profootballtalk.rss']},
    'nba': {'path': 'basketball/nba', 'name': 'NBA', 'full': 'National Basketball Association', 'mode': 'day', 'back': 3, 'ahead': 7,
            'cols': US_COLS, 'level3': True, 'feeds': [CBS + 'nba/', ATH + 'nba/', YH + 'nba/rss/']},
    'nhl': {'path': 'hockey/nhl', 'name': 'NHL', 'full': 'National Hockey League', 'mode': 'day', 'back': 3, 'ahead': 7,
            'cols': NHL_COLS, 'level3': True, 'feeds': [CBS + 'nhl/', ATH + 'nhl/', YH + 'nhl/rss/']},
    'mlb': {'path': 'baseball/mlb', 'name': 'MLB', 'full': 'Major League Baseball', 'mode': 'day', 'back': 4, 'ahead': 7,
            'cols': US_COLS, 'level3': True, 'feeds': [CBS + 'mlb/', ATH + 'mlb/', YH + 'mlb/rss/', 'https://www.mlb.com/feeds/news/rss.xml']},
    'wnba': {'path': 'basketball/wnba', 'name': 'WNBA', 'full': "Women's National Basketball Association", 'mode': 'day', 'back': 7, 'ahead': 7,
             'cols': US_COLS, 'level3': False, 'feeds': [CBS + 'wnba/', ATH + 'wnba/', YH + 'wnba/rss/']},
    'mls': {'path': 'soccer/usa.1', 'name': 'MLS', 'full': 'Major League Soccer', 'mode': 'day', 'back': 4, 'ahead': 10,
            'cols': FOOT_COLS, 'level3': False, 'feeds': ['https://news.google.com/rss/search?q=MLS+soccer+when:3d&hl=en-US&gl=US&ceid=US:en'],
            'keep': r'\b(mls|major league soccer|mls cup|leagues cup|inter miami|messi)\b'},
    'soccer': {'path': None, 'name': 'Soccer', 'full': 'Soccer: Europe and beyond', 'mode': 'day', 'back': 3, 'ahead': 10, 'cols': FOOT_COLS,
               'level3': False, 'comps': SOCCER,
               'feeds': [CBS + 'soccer/', ATH + 'football/', 'https://www.theguardian.com/football/rss', 'https://feeds.bbci.co.uk/sport/football/rss.xml',
                         YH + 'soccer/rss/']},
}
NEWS_KEEP = {'nfl': 60, 'nba': 55, 'nhl': 50, 'mlb': 50, 'wnba': 40, 'mls': 40, 'soccer': 70}
NEWS_DAYS = {'wnba': 6, 'mls': 5}


# ------------------------------------------------------------------ fetching
def _slug(url):
    return hashlib.sha1(url.encode()).hexdigest()[:20]


def get(url, timeout=15):
    """the JSON (or feed bytes, for raw=True callers) at url; two tries"""
    if REPLAY:
        p = os.path.join(REPLAY, _slug(url))
        if not os.path.exists(p):
            raise FileNotFoundError(url)
        return open(p, 'rb').read()
    req = urllib.request.Request(url, headers=UA)
    last = None
    for attempt in (1, 2):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                b = r.read(12_000_000)
                if (r.headers.get('Content-Encoding') or '').lower() == 'gzip' or b[:2] == b'\x1f\x8b':
                    import gzip
                    b = gzip.decompress(b)
            if RECORD:
                os.makedirs(RECORD, exist_ok=True)
                open(os.path.join(RECORD, _slug(url)), 'wb').write(b)
            return b
        except urllib.error.HTTPError as ex:
            last = ex
            if ex.code < 500 or attempt == 2:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as ex:
            last = ex
            if attempt == 2:
                raise
        time.sleep(1.5)
    raise last


def jget(url):
    return json.loads(get(url))


def _feed_bytes(url, name=None):
    """run.py's feed reader, through get() so a test can record and replay it"""
    raw = get(url, timeout=18).lstrip(b'\xef\xbb\xbf \t\r\n')
    head = raw[:400].lower()
    if head.startswith(b'<!doctype html') or head.startswith(b'<html') or b'<html' in head[:150]:
        raise ValueError('returned a web page, not a feed')
    return raw


run.fetch_raw = _feed_bytes


# ------------------------------------------------------------------ games
def _logo(t):
    if t.get('logo'):
        return t['logo']
    for lg in t.get('logos') or []:
        if lg.get('href'):
            return lg['href']
    return ''


def _txt(s, n=140):
    s = re.sub(r'\s+', ' ', str(s or '')).strip()
    return s if len(s) <= n else s[:n - 1].rsplit(' ', 1)[0] + '…'


def side(c):
    t = c.get('team') or {}
    out = {'id': t.get('id') or c.get('id'), 'ab': t.get('abbreviation') or '', 'nm': t.get('displayName') or t.get('name') or '',
           'sh': t.get('shortDisplayName') or t.get('name') or '', 'lo': _logo(t), 'c': t.get('color') or '', 'sc': c.get('score'),
           'w': bool(c.get('winner'))}
    rec = c.get('records') or []
    if rec:
        out['r'] = rec[0].get('summary') or ''
    ls = [l.get('displayValue') if l.get('displayValue') is not None else l.get('value') for l in c.get('linescores') or []]
    if ls:
        out['ls'] = [x if isinstance(x, str) else ('' if x is None else (str(int(x)) if float(x).is_integer() else str(x))) for x in ls]
    if c.get('form'):
        out['f'] = c['form']
    rank = (c.get('curatedRank') or {}).get('current')
    if rank and rank < 26:
        out['rk'] = rank
    if c.get('shootoutScore') is not None:
        out['so'] = c['shootoutScore']
    return out


def tv_list(comp):
    """(national TV and streaming, local channels as [market, name])"""
    nat, loc, seen = [], [], set()
    for g in comp.get('geoBroadcasts') or []:
        n = ((g.get('media') or {}).get('shortName') or '').strip()
        m = (g.get('market') or {}).get('type') or 'National'
        kind = ((g.get('type') or {}).get('shortName') or '').lower()
        if not n or kind == 'radio' or (g.get('region') or 'us') != 'us' or n in seen:
            continue
        seen.add(n)
        if m == 'National':
            nat.append(n)
        else:
            loc.append([m.lower(), n])
    for b in comp.get('broadcasts') or []:
        for n in b.get('names') or []:
            if n and n not in seen:
                seen.add(n)
                if (b.get('market') or 'national') == 'national':
                    nat.append(n)
                else:
                    loc.append([b.get('market'), n])
    return nat[:6], loc[:4]


def odds_line(comp):
    for o in comp.get('odds') or []:
        if not isinstance(o, dict):
            continue
        bits = []
        if o.get('details'):
            bits.append(o['details'])
        if o.get('overUnder') is not None:
            bits.append(f"O/U {o['overUnder']:g}" if isinstance(o['overUnder'], (int, float)) else f"O/U {o['overUnder']}")
        if bits:
            return {'t': ' · '.join(bits), 'by': ((o.get('provider') or {}).get('name') or '')}
    return None


def situation(comp, sport):
    s = comp.get('situation') or {}
    if not s:
        return None
    out = {}
    if sport == 'baseball':
        for k, a in (('balls', 'b'), ('strikes', 's'), ('outs', 'o')):
            if s.get(k) is not None:
                out[a] = s[k]
        out['on'] = [1 if s.get('onFirst') else 0, 1 if s.get('onSecond') else 0, 1 if s.get('onThird') else 0]
        for k, a in (('batter', 'bat'), ('pitcher', 'pit')):
            p = (s.get(k) or {}).get('athlete') or {}
            if p.get('shortName') or p.get('displayName'):
                out[a] = p.get('shortName') or p.get('displayName')
    elif sport == 'football':
        if s.get('downDistanceText'):
            out['dd'] = s['downDistanceText']
        if s.get('possession'):
            out['pos'] = s['possession']
        if s.get('isRedZone'):
            out['rz'] = 1
    lp = (s.get('lastPlay') or {}).get('text')
    if lp:
        out['lp'] = _txt(lp, 160)
    return out or None


def compact(e, lg, sport):
    comp = (e.get('competitions') or [{}])[0]
    st = (comp.get('status') or e.get('status') or {})
    ty = st.get('type') or {}
    cs = comp.get('competitors') or []
    home = next((c for c in cs if c.get('homeAway') == 'home'), cs[0] if cs else {})
    away = next((c for c in cs if c.get('homeAway') == 'away'), cs[1] if len(cs) > 1 else {})
    v = comp.get('venue') or {}
    addr = v.get('address') or {}
    place = ', '.join(x for x in (addr.get('city'), addr.get('state') or addr.get('country')) if x)
    out = {'id': e.get('id'), 'lg': lg, 'd': e.get('date') or comp.get('date'), 'st': ty.get('state') or 'pre',
           'sd': ty.get('shortDetail') or ty.get('detail') or '', 'h': side(home), 'a': side(away)}
    if ty.get('name') in ('STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_SUSPENDED', 'STATUS_DELAYED'):
        out['x'] = ty.get('description') or ty.get('detail')
    if ty.get('state') == 'in':
        out['clk'] = st.get('displayClock')
        out['per'] = st.get('period')
    if not comp.get('timeValid', True) or e.get('timeValid') is False:
        out['tbd'] = 1
    if v.get('fullName'):
        out['v'] = v['fullName'] + (', ' + place if place else '')
    if comp.get('neutralSite'):
        out['ns'] = 1
    notes = [n.get('headline') for n in comp.get('notes') or [] if n.get('headline')]
    if notes:
        out['n'] = notes[0]
    ser = comp.get('series') or {}
    if ser.get('summary') and ser.get('type') in ('playoff', None):
        out['ser'] = ser['summary']
    tv, ltv = tv_list(comp)
    if tv:
        out['tv'] = tv
    if ltv:
        out['ltv'] = ltv
    for t in comp.get('tickets') or []:
        if t.get('summary') or t.get('links'):
            out['tk'] = {'s': t.get('summary') or '', 'n': t.get('numberAvailable'), 'u': ((t.get('links') or [{}])[0]).get('href') or ''}
            break
    od = odds_line(comp)
    if od and ty.get('state') == 'pre':
        out['od'] = od
    for h in comp.get('headlines') or []:
        if h.get('shortLinkText') or h.get('description'):
            out['rc'] = _txt(h.get('shortLinkText') or h.get('description'), 160)
            break
    sit = situation(comp, sport) if ty.get('state') == 'in' else None
    if sit:
        out['sit'] = sit
    w = e.get('weather') or comp.get('weather') or {}
    if w.get('temperature') is not None and sport == 'football' and not (v.get('indoor')):
        out['wx'] = f"{w['temperature']}° {w.get('displayValue') or ''}".strip()
    wk = (e.get('week') or {}).get('number')
    if wk:
        out['wk'] = wk
    if comp.get('type', {}).get('abbreviation') and comp['type']['abbreviation'] not in ('STD', 'RD16', 'TRNMNT'):
        out['ty'] = comp['type']['abbreviation']
    return out


def et_day(iso):
    try:
        return dt.datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone(ETZ).strftime('%Y-%m-%d')
    except (ValueError, AttributeError):
        return ''


def scoreboard(path, params=''):
    return jget(SITE + path + '/scoreboard' + (('?' + params) if params else ''))


def season_of(sb):
    lg = (sb.get('leagues') or [{}])[0]
    s = lg.get('season') or {}
    ty = s.get('type') or {}
    return {'year': s.get('year'), 'label': s.get('displayName') or str(s.get('year') or ''), 'type': ty.get('type'), 'phase': ty.get('name') or '',
            'start': lg.get('calendarStartDate') or s.get('startDate'), 'end': lg.get('calendarEndDate') or s.get('endDate')}


def games_by_day(path, lg, sport, back, ahead):
    """the default scoreboard plus one per day from back days ago to ahead days on (ESPN takes one date at a time)"""
    today = NOW.astimezone(ETZ).date()
    days = [today + dt.timedelta(days=i) for i in range(-back, ahead + 1)]
    out, first, bad = {}, None, 0

    def one(d):
        return d, scoreboard(path, 'dates=' + d.strftime('%Y%m%d') + '&limit=300')
    try:
        first = scoreboard(path)
    except Exception as ex:  # noqa: BLE001
        errors.append(f'{lg} scoreboard: {type(ex).__name__} {str(ex)[:80]}')
    with cf.ThreadPoolExecutor(6) as ex:
        futs = [ex.submit(one, d) for d in days]
        for f in futs:
            try:
                d, sb = f.result()
            except Exception as e2:  # noqa: BLE001
                bad += 1
                errors.append(f'{lg} day: {type(e2).__name__} {str(e2)[:80]}')
                continue
            if first is None:
                first = sb
            for e in sb.get('events') or []:
                out[e['id']] = compact(e, lg, sport)
    if first:
        for e in first.get('events') or []:
            out.setdefault(e['id'], compact(e, lg, sport))
    if first is None and not out:
        raise RuntimeError('no scoreboard answered')
    return first or {}, sorted(out.values(), key=lambda x: (x['d'] or '', x['id'])), bad


def nfl_games(path, lg):
    first = scoreboard(path)
    season, week = first.get('season') or {}, (first.get('week') or {}).get('number')
    ty = season.get('type') or 2
    out = {e['id']: compact(e, lg, 'football') for e in first.get('events') or []}
    cal = []
    for c in ((first.get('leagues') or [{}])[0].get('calendar') or []):
        for en in c.get('entries') or []:
            cal.append({'t': int(c.get('value') or 0), 'w': int(en.get('value') or 0), 'l': en.get('label'), 'al': en.get('alternateLabel'),
                        's': en.get('startDate'), 'e': en.get('endDate')})
    # the week now (ESPN's default can lag a day behind on Tuesday morning)
    now_iso = NOW.strftime('%Y-%m-%dT%H:%MZ')
    cur = next((c for c in cal if c['s'] <= now_iso < c['e']), None)
    if cur:
        ty, week = cur['t'], cur['w']
    wanted = set()
    if week:
        idx = next((i for i, c in enumerate(cal) if c['t'] == ty and c['w'] == week), None)
        if idx is not None:
            for j in (idx - 1, idx, idx + 1, idx + 2):
                if 0 <= j < len(cal) and cal[j]['t'] in (2, 3):
                    wanted.add((cal[j]['t'], cal[j]['w']))
    bad = 0
    for t, w in sorted(wanted):
        try:
            sb = scoreboard(path, f'week={w}&seasontype={t}')
        except Exception as ex:  # noqa: BLE001
            bad += 1; errors.append(f'nfl week {w}: {type(ex).__name__} {str(ex)[:80]}'); continue
        for e in sb.get('events') or []:
            out[e['id']] = compact(e, lg, 'football')
    bye = [t.get('abbreviation') for t in ((first.get('week') or {}).get('teamsOnBye') or [])]
    return first, sorted(out.values(), key=lambda x: (x['d'] or '', x['id'])), {'type': ty, 'week': week, 'cal': [c for c in cal if c['t'] in (2, 3)], 'bye': bye}, bad


# ------------------------------------------------------------------ standings
def _stat(e, key):
    for s in e.get('stats') or []:
        if (s.get('type') or '').lower() == key or (s.get('name') or '').lower() == key:
            return s.get('displayValue') if s.get('displayValue') is not None else s.get('value')
    return None


def _num(v, default=0.0):
    try:
        return float(str(v).replace('+', '').replace('%', ''))
    except (TypeError, ValueError):
        return default


def std_rows(entries, cols, lg):
    rows = []
    for e in entries:
        t = e.get('team') or {}
        r = {'id': t.get('id'), 'ab': t.get('abbreviation') or '', 'nm': t.get('displayName') or '', 'sh': t.get('shortDisplayName') or '',
             'lo': _logo(t), 'v': [_stat(e, k) if _stat(e, k) is not None else '' for _, k in cols]}
        seed = _stat(e, 'playoffseed')
        if seed not in (None, '', '0', 0):
            r['seed'] = int(_num(seed))
        rank = _stat(e, 'rank')
        if rank not in (None, '', '0', 0):
            r['rk'] = int(_num(rank))
        cl = _stat(e, 'clincher')
        if cl and cl not in ('-', ''):
            r['cl'] = cl
        n = e.get('note') or {}
        if n.get('description'):
            r['nt'] = {'c': '#' + (n.get('color') or '').lstrip('#'), 'd': n['description']}
        rows.append(r)
    ci = {k: i for i, (_, k) in enumerate(cols)}
    if lg in ('soccer', 'mls'):
        rows.sort(key=lambda r: r.get('rk') or 99)
    elif lg == 'nhl':
        rows.sort(key=lambda r: (-_num(r['v'][ci['points']]), _num(r['v'][ci['gamesplayed']]), -_num(r['v'][ci['regwins']])))
    else:
        rows.sort(key=lambda r: (-_num(r['v'][ci['winpercent']]), -_num(r['v'][ci['wins']])))
    return rows


def std_tree(node, cols, lg, depth=0):
    if node.get('standings'):
        return {'n': node.get('name') or '', 'ab': node.get('abbreviation') or '', 'rows': std_rows(node['standings'].get('entries') or [], cols, lg)}
    kids = [std_tree(c, cols, lg, depth + 1) for c in node.get('children') or []]
    return {'n': node.get('name') or '', 'ab': node.get('abbreviation') or '', 'kids': kids}


def standings(path, cols, lg, level3):
    url = (STAND3 + path + '/standings?level=3') if level3 else (STAND + path + '/standings')
    d = jget(url)
    tree = std_tree(d, cols, lg)
    st = None
    n = d
    while n and not n.get('standings') and n.get('children'):
        n = n['children'][0]
    if n and n.get('standings'):
        st = n['standings'].get('seasonDisplayName')
    return {'cols': [c for c, _ in cols], 'season': st, 'tree': tree.get('kids') or [tree]}


# ------------------------------------------------------------------ teams
def teams(path):
    d = jget(SITE + path + '/teams?limit=200')
    out = []
    for x in (((d.get('sports') or [{}])[0].get('leagues') or [{}])[0].get('teams') or []):
        t = x.get('team') or {}
        if not t.get('id') or t.get('isAllStar'):
            continue
        dark = next((l.get('href') for l in t.get('logos') or [] if 'dark' in (l.get('rel') or [])), '')
        out.append({'id': t['id'], 'ab': t.get('abbreviation') or '', 'nm': t.get('displayName') or '', 'sh': t.get('shortDisplayName') or '',
                    'loc': t.get('location') or '', 'nick': t.get('name') or t.get('nickname') or '', 'c': t.get('color') or '',
                    'c2': t.get('alternateColor') or '', 'lo': _logo(t), 'lod': dark or ''})
    return out


# ------------------------------------------------------------------ news
def _p(iso):
    try:
        return dt.datetime.fromisoformat(iso.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return None


def espn_news(path, lg, label):
    d = jget(SITE + path + '/news?limit=40')
    out = []
    for a in d.get('articles') or []:
        link = ((a.get('links') or {}).get('web') or {}).get('href') or ''
        if not link or not a.get('headline'):
            continue
        img = ''
        for im in a.get('images') or []:
            if im.get('url') and (im.get('width') or 0) >= 400:
                img = im['url']; break
        tm = [str(c.get('teamId') or (c.get('team') or {}).get('id')) for c in a.get('categories') or [] if c.get('type') == 'team' and (c.get('teamId') or (c.get('team') or {}).get('id'))]
        it = {'t': a['headline'].strip(), 'u': link, 'o': 'ESPN', 'p': a.get('published') or a.get('lastModified'),
              'd': run.clip(run.clean(a.get('description') or ''), 200)}
        if img:
            it['m'] = img
        if tm:
            it['tm'] = sorted(set(tm))[:6]
        if a.get('type') == 'Media':
            it['vid'] = 1
        if label:
            it['cp'] = label
        out.append(it)
    return out


SPORTS_JUNK = re.compile(r'stats & head-to-head|head-to-head record|\blive (score|stream|updates)\b|\bhow to watch .* (free|online|stream)\b|promo code|betting offer|bonus bets', re.I)
SPORTS_PRESS = {'espn.com', 'mlssoccer.com', 'nytimes.com', 'si.com', 'cbssports.com', 'foxsports.com', 'sports.yahoo.com', 'yahoo.com', 'usatoday.com',
                'nbcsports.com', 'goal.com', 'apnews.com', 'reuters.com', 'theguardian.com', 'bbc.com', 'bbc.co.uk', 'washingtonpost.com', 'latimes.com',
                'theathletic.com', 'sbnation.com', 'sportingnews.com', 'fourfourtwo.com', 'espnfc.com', 'miamiherald.com', 'seattletimes.com',
                'chicagotribune.com', 'nbcnews.com', 'cbsnews.com', 'foxnews.com', 'insidesocal.com', 'theringer.com', 'bleacherreport.com', 'americansocceranalysis.com'}
OUTLET_NAMES = {'cbssports.com': 'CBS Sports', 'nytimes.com': 'The Athletic', 'sports.yahoo.com': 'Yahoo Sports', 'yahoo.com': 'Yahoo Sports',
                'nbcsports.com': 'NBC Sports', 'mlb.com': 'MLB.com', 'theguardian.com': 'The Guardian', 'bbc.com': 'BBC Sport', 'bbc.co.uk': 'BBC Sport'}


def feed_news(url, days, keep=None):
    name, items, err = run.read_feed({'name': url, 'url': url})
    if err:
        raise RuntimeError(err)
    out = []
    for it in items:
        t, link, when = it['title'], it['link'], it['when']
        if not t or not link or not when or (NOW - when).total_seconds() > days * 86400:
            continue
        if run.JUNK_TITLE.search(t):
            continue
        if it['google']:
            dom = run.norm_domain(it['src_url'])
            if dom not in SPORTS_PRESS and dom not in run.OUTLETS:
                continue
            o = run.OUTLETS.get(dom) or it['src_name'] or dom
            if it['src_name'] and t.endswith(' - ' + it['src_name']):
                t = t[: -len(it['src_name']) - 3].strip()
        else:
            dom = run.norm_domain(link)
            o = OUTLET_NAMES.get(dom) or run.OUTLETS.get(dom) or dom
            if '/athletic/' in link:
                o = 'The Athletic'
        desc = run.snippet(it['desc'], t) if not it['google'] else ''
        if keep and not re.search(keep, t + ' ' + desc, re.I):
            continue
        x = {'t': t, 'u': link, 'o': o, 'p': when.strftime('%Y-%m-%dT%H:%M:%SZ'), 'd': desc}
        if it.get('img'):
            x['m'] = it['img']
        out.append(x)
    return out


def _key(t):
    w = re.sub(r"[^a-z0-9 ]+", ' ', t.lower()).split()
    return ' '.join(w[:9])


def tag_teams(items, tms):
    """attach team ids by name: a team's full name, its nickname (if no other team in the league shares it) or its city"""
    nick = {}
    for t in tms:
        nick.setdefault((t.get('nick') or '').lower(), []).append(t['id'])
    pats = []
    for t in tms:
        names = {t['nm']}
        n = (t.get('nick') or '').strip()
        if n and len(nick.get(n.lower(), [])) == 1 and len(n) > 3:
            names.add(n)
        if t.get('sh') and len(t['sh']) > 4 and t['sh'] not in ('United', 'City', 'Real', 'Inter'):
            names.add(t['sh'])
        pats.append((t['id'], re.compile(r'\b(' + '|'.join(re.escape(x) for x in sorted(names, key=len, reverse=True)) + r')\b')))
    for it in items:
        if it.get('tm'):
            continue
        hit = [tid for tid, rx in pats if rx.search(it['t'])]
        if hit:
            it['tm'] = hit[:6]


def league_news(lg, cfg, tms):
    got, bad = [], []
    days = NEWS_DAYS.get(lg, 3)
    jobs = []
    if cfg.get('comps'):
        for key, slug, name, short, _ in cfg['comps'][:6]:
            jobs.append(('espn ' + key, lambda slug=slug, short=short: espn_news('soccer/' + slug, lg, short)))
    else:
        jobs.append(('espn', lambda: espn_news(cfg['path'], lg, None)))
    for u in cfg.get('feeds') or []:
        jobs.append((u, lambda u=u: feed_news(u, days, cfg.get('keep'))))
    with cf.ThreadPoolExecutor(6) as ex:
        futs = {ex.submit(fn): nm for nm, fn in jobs}
        for f in cf.as_completed(futs):
            try:
                got.extend(f.result())
            except Exception as e:  # noqa: BLE001
                bad.append(futs[f]); errors.append(f'{lg} news {futs[f][:50]}: {type(e).__name__} {str(e)[:70]}')
    seen, out = set(), []
    got = [x for x in got if x.get('p') and _p(x['p']) and (NOW - _p(x['p'])).total_seconds() < days * 86400]
    got.sort(key=lambda x: x['p'], reverse=True)
    for x in got:
        k = _key(x['t'])
        u = x['u'].split('?')[0]
        if k in seen or u in seen:
            continue
        seen.add(k); seen.add(u)
        out.append(x)
    tag_teams(out, tms)
    ids = {str(t['id']) for t in tms}
    for x in out:
        if x.get('tm'):
            x['tm'] = [i for i in x['tm'] if str(i) in ids] or None
            if not x['tm']:
                del x['tm']
    if cfg.get('keep'):  # a league whose sources stray (ESPN's MLS news carries other soccer): its own teams or its name
        out = [x for x in out if x.get('tm') or re.search(cfg['keep'], x['t'] + ' ' + (x.get('d') or ''), re.I)]
    out = [x for x in out if not SPORTS_JUNK.search(x['t'])]
    # no one outlet takes more than half the list
    by, cap, keep = {}, max(12, NEWS_KEEP.get(lg, 50) // 2), []
    for x in out:
        by[x['o']] = by.get(x['o'], 0) + 1
        if by[x['o']] <= cap:
            keep.append(x)
    return keep[:NEWS_KEEP.get(lg, 50)], bad


# ------------------------------------------------------------------ a league
def phase_line(lg, season, games, extra):
    """what part of the season it is, in a few words"""
    ty = season.get('type')
    if lg == 'nfl' and extra.get('week'):
        cur = next((c for c in extra['cal'] if c['t'] == extra['type'] and c['w'] == extra['week']), None)
        return (cur or {}).get('l') or f"Week {extra['week']}"
    if ty == 3:
        live = [g for g in games if g.get('n')]
        nxt = next((g for g in live if g['st'] != 'post'), None) or (live[-1] if live else None)
        if nxt:
            return nxt['n'] + (' · ' + nxt['ser'] if nxt.get('ser') else '')
        return 'Postseason'
    if ty == 1:
        return 'Preseason'
    if ty == 4:
        return 'Offseason'
    return season.get('phase') or 'Regular season'


FINAL = re.compile(r'\b(finals?|world series|stanley cup final|mls cup|super bowl)\b', re.I)


def champion(games):
    """the winner of a final series or final that is over"""
    for g in sorted(games, key=lambda x: x['d'] or '', reverse=True):
        n = g.get('n') or ''
        if g['st'] != 'post' or not FINAL.search(n) or re.search(r'semi|conference|quarter|division', n, re.I):
            continue
        ser = (g.get('ser') or '').lower()
        single = re.search(r'super bowl|mls cup(?! playoffs)|\bfinal\b(?!s)', n, re.I) and not ser
        if 'wins series' in ser or 'won series' in ser or single:
            w = g['h'] if g['h'].get('w') else g['a'] if g['a'].get('w') else None
            if w:
                return {'nm': w['nm'], 'ab': w['ab'], 'lo': w['lo'], 'id': w['id'], 'what': n, 'ser': g.get('ser'), 'd': g['d']}
        return None
    return None


def build_league(lg, cfg):
    sport = (cfg['path'] or 'soccer/x').split('/')[0]
    out = {'v': 1, 'lg': lg, 'name': cfg['name'], 'full': cfg['full'], 'at': NOW.strftime('%Y-%m-%dT%H:%M:%SZ')}
    stale = []
    if cfg.get('comps'):
        comps, games, allteams = [], [], []
        def one(c):
            key, slug, name, short, country = c
            path = 'soccer/' + slug
            first, gs, bad = games_by_day(path, key, 'soccer', cfg['back'], cfg['ahead'])
            for g in gs:
                g['cp'] = key
            s = season_of(first)
            try:
                std = standings(path, cfg['cols'], 'soccer', False)
            except Exception as ex:  # noqa: BLE001
                std = None; errors.append(f'{key} standings: {type(ex).__name__} {str(ex)[:80]}')
            try:
                tm = teams(path)
            except Exception as ex:  # noqa: BLE001
                tm = []; errors.append(f'{key} teams: {type(ex).__name__} {str(ex)[:80]}')
            ph = phase_line(key, s, gs, {})
            if std and not key.startswith('u') and s.get('type') != 3:
                gp = [int(_num(r['v'][0])) for t in std['tree'] for r in t.get('rows') or []]
                if gp:
                    ph = f'{max(gp)} rounds played'
            return {'k': key, 'slug': slug, 'name': name, 'short': short, 'country': country, 'season': s, 'phase': ph,
                    'st': std, 'teams': tm}, gs
        with cf.ThreadPoolExecutor(3) as ex:
            for c, res in zip(cfg['comps'], ex.map(lambda c: _safe(one, c), cfg['comps'])):
                if res is None:
                    stale.append(c[0]); continue
                info, gs = res
                comps.append(info); games.extend(gs)
                for t in info['teams']:
                    t['cp'] = info['k']
                allteams.extend(info['teams'])
        out['comps'] = comps
        out['games'] = sorted(games, key=lambda x: (x['d'] or '', x['id']))
        seen, tms = set(), []
        for t in allteams:
            if t['id'] not in seen:
                seen.add(t['id']); tms.append(t)
        out['teams'] = tms
        if not comps:
            raise RuntimeError('no competition answered')
    else:
        if cfg['mode'] == 'week':
            first, gs, extra, bad = nfl_games(cfg['path'], lg)
        else:
            first, gs, bad = games_by_day(cfg['path'], lg, sport, cfg['back'], cfg['ahead'])
            extra = {}
        s = season_of(first)
        if extra.get('type'):
            s['type'] = extra['type']
        out['season'] = s
        out['games'] = gs
        if extra:
            out['week'] = {'type': extra['type'], 'n': extra['week'], 'cal': extra['cal'], 'bye': extra['bye']}
        out['phase'] = phase_line(lg, s, gs, extra)
        ch = champion(gs)
        if ch:
            out['champion'] = ch
        try:
            out['st'] = standings(cfg['path'], cfg['cols'], lg, cfg['level3'])
        except Exception as ex:  # noqa: BLE001
            stale.append('standings'); errors.append(f'{lg} standings: {type(ex).__name__} {str(ex)[:80]}')
        try:
            out['teams'] = teams(cfg['path'])
        except Exception as ex:  # noqa: BLE001
            stale.append('teams'); errors.append(f'{lg} teams: {type(ex).__name__} {str(ex)[:80]}')
    out['news'], badn = league_news(lg, cfg, out.get('teams') or [])
    if badn:
        out['newsFailed'] = badn
    if stale:
        out['stale'] = stale
    return out


def _safe(fn, *a):
    try:
        return fn(*a)
    except Exception as ex:  # noqa: BLE001
        errors.append(f'{getattr(fn, "__name__", "job")} {a[0] if a else ""}: {type(ex).__name__} {str(ex)[:80]}')
        return None


# ------------------------------------------------------------------ the index
def marquee(g, lg):
    """a game worth a place at the top of the desk"""
    n = (g.get('n') or '').lower()
    if re.search(r'world series|finals?|stanley cup|super bowl|mls cup|conference|semifinal|quarterfinal|playoff|wild card|division series|championship series|round', n):
        return 3
    if lg == 'nfl':
        t = _p(g['d'])
        if t:
            et = t.astimezone(ETZ)
            if et.hour >= 19 or et.weekday() in (0, 3) or (et.weekday() == 5):  # Thursday, Sunday and Monday nights, and Saturdays late in the year
                return 2
    if g.get('cp') == 'ucl' or (g.get('cp') in ('epl', 'laliga') and g['h'].get('rk')):
        return 1
    return 0


def f1_next():
    """the next grand prix from the F1 hub's data (news/data/f1.json, news/updater/f1.py), for the desk's F1 chip"""
    try:
        d = json.load(open(os.path.join(D, '..', 'f1.json'), encoding='utf-8'))
    except (OSError, ValueError):
        return None
    gone = {str(x.get('r') if isinstance(x, dict) else x) for x in d.get('cancelled') or []}
    for r in d.get('races') or []:
        t = _p(r.get('start') or '')
        if not t or str(r.get('r')) in gone or t + dt.timedelta(hours=3) < NOW:
            continue
        nxt = next(((k, iso) for k, iso in r.get('sessions') or [] if _p(iso) and _p(iso) + dt.timedelta(hours=2) > NOW), None)
        return {'name': r.get('name'), 'r': r.get('r'), 'start': r.get('start'), 'session': list(nxt) if nxt else None}
    return None


def build_index(files):
    today = NOW.astimezone(ETZ).strftime('%Y-%m-%d')
    lim = NOW + dt.timedelta(hours=40)
    leagues, todays, big = {}, [], []
    for lg, d in files.items():
        if not d:
            continue
        gs = d.get('games') or []
        live = [g for g in gs if g['st'] == 'in']
        tday = [g for g in gs if et_day(g['d']) == today]
        nxt = next((g for g in gs if g['st'] == 'pre' and _p(g['d']) and _p(g['d']) > NOW), None)
        last = next((g for g in reversed(gs) if g['st'] == 'post'), None)
        top = (d.get('news') or [{}])[0]
        leagues[lg] = {'name': d['name'], 'phase': d.get('phase') or ', '.join(c['phase'] for c in d.get('comps', [])[:1]), 'live': len(live), 'today': len(tday),
                       'next': nxt['d'] if nxt else None, 'last': last['d'] if last else None, 'at': d.get('at'), 'season': (d.get('season') or {}).get('label'),
                       'stype': (d.get('season') or {}).get('type'), 'top': {'t': top.get('t'), 'u': top.get('u'), 'o': top.get('o')} if top.get('t') else None}
        if d.get('champion'):
            leagues[lg]['champion'] = d['champion']
        for g in tday + live:
            if g not in todays:
                todays.append(g)
        for g in gs:
            t = _p(g['d'])
            if not t:
                continue
            if (g['st'] == 'in' or (NOW - dt.timedelta(hours=14)) <= t <= lim) and marquee(g, g.get('cp') or lg):
                big.append((marquee(g, g.get('cp') or lg), g))
    seen, mq = set(), []
    for s, g in sorted(big, key=lambda x: (-x[0], x[1]['d'])):
        if g['id'] in seen:
            continue
        seen.add(g['id']); mq.append(g)
    mq = sorted(mq[:8], key=lambda g: ({'in': 0, 'pre': 1, 'post': 2}[g['st']], g['d']))
    f1 = f1_next()
    return {'v': 1, 'at': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'day': today, 'leagues': leagues, 'f1': f1,
            'today': sorted(todays, key=lambda g: ({'in': 0, 'pre': 1, 'post': 2}[g['st']], g['d'])), 'big': mq, 'errors': errors[:30]}


def main():
    if ARGS[:1] == ['check']:
        return check()
    os.makedirs(D, exist_ok=True)
    files = {}
    t0 = time.time()
    with cf.ThreadPoolExecutor(4) as ex:
        futs = {ex.submit(build_league, lg, cfg): lg for lg, cfg in LEAGUES.items()}
        for f in cf.as_completed(futs):
            lg = futs[f]
            p = os.path.join(D, lg + '.json')
            try:
                d = f.result()
            except Exception as e:  # noqa: BLE001
                errors.append(f'{lg}: {type(e).__name__} {str(e)[:100]}')
                print(f'sports: {lg} failed ({e}); kept the last copy')
                try:
                    files[lg] = json.load(open(p, encoding='utf-8'))
                except (OSError, ValueError):
                    files[lg] = None
                continue
            with open(p, 'w', encoding='utf-8') as fh:
                json.dump(d, fh, ensure_ascii=False, separators=(',', ':'))
            files[lg] = d
            print(f"sports: {lg} {len(d.get('games') or [])} games, {len(d.get('news') or [])} stories, phase {d.get('phase') or '-'} ({os.path.getsize(p) // 1024} KB)")
    idx = build_index(files)
    with open(os.path.join(D, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump(idx, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'sports: index with {len(idx["today"])} games today and {len(idx["big"])} big ones; {len(errors)} errors; {time.time() - t0:.1f}s')
    for e in errors[:12]:
        print('  ', e)
    return 0


def check():
    P = []
    for lg in list(LEAGUES) + ['index']:
        p = os.path.join(D, lg + '.json')
        try:
            d = json.load(open(p, encoding='utf-8'))
        except (OSError, ValueError) as ex:
            P.append(f'{lg}: {ex}'); continue
        if lg == 'index':
            if not isinstance(d.get('leagues'), dict):
                P.append('index: no leagues')
            continue
        for k in ('games', 'news', 'teams'):
            if not isinstance(d.get(k), list):
                P.append(f'{lg}: {k} missing')
        for g in d.get('games') or []:
            if not g.get('id') or not g.get('d') or g.get('st') not in ('pre', 'in', 'post') or not g.get('h') or not g.get('a'):
                P.append(f'{lg}: a malformed game {g.get("id")}'); break
    for x in P:
        print(x)
    print('sports check:', 'ok' if not P else f'{len(P)} problems')
    return 1 if P else 0


if __name__ == '__main__':
    sys.exit(main())
