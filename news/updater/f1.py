#!/usr/bin/env python3
"""The Sports desk's Formula 1 hub (#/f1): the season's calendar, results, standings, lap charts, tyre strategy, race
control, news and video. Standard library only.

  python3 news/updater/f1.py              refresh news/data/f1.json and fill in the per-race files news/data/f1/r<N>.json
  python3 news/updater/f1.py --force      also refetch the per-race files of the last two races
  python3 news/updater/f1.py check        exit 1 with the problems in the hub's written files (news/f1/*.json)
  python3 news/updater/f1.py format       print the format of those files

Sources (all public, all of them allow browsers too, so the page can top up a result the moment it lands):
  Jolpica F1 (api.jolpi.ca, the Ergast-compatible results database): the calendar with session times, every race,
      sprint and qualifying classification, the standings, lap-by-lap positions and times, pit stops, career totals.
      Its limits are 4 requests a second and 500 an hour, so each run spends at most BUDGET requests and fills the
      per-race files a few races at a time, newest first.
  OpenF1 (api.openf1.org, from the F1 live-timing feed): team colours and driver headshots, tyre stints, race control
      messages (safety cars, red flags, penalties), weather, overtakes, and cancelled sessions.
  MultiViewer's circuit service (api.multiviewer.app, linked from OpenF1's meetings): each track's outline and corner
      numbers, drawn once per circuit into news/data/f1/tracks.json.
  News: the F1 feeds of Formula1.com, BBC Sport, Autosport, Motorsport.com, The Guardian, Crash.net, Sky Sports, The Race
      and RaceFans (kept to F1), a Google News search, and in Portuguese and German Grande Prêmio and auto motor und
      sport. Headlines and summaries are the outlets' own.
  Video: the official Formula 1 YouTube channel; highlights are tied to their race and kept all season.

A source that fails keeps its last good copy; nothing here is ever emptied by a bad run. The file is rewritten only
when something in it changed, so a quiet run makes no commit.

The written half of the hub lives in news/f1/ (the cars, the drivers, the circuits, the season's race reports and
storylines, the rules, how to watch): a weekly scheduled Claude task keeps it current and runs `check` before it
commits. See news/UPDATER.md.
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

NEWS = os.path.normpath(os.path.join(HERE, '..'))
D = os.path.join(NEWS, 'data')
RD = os.path.join(D, 'f1')
OUT = os.path.join(D, 'f1.json')
TRACKS = os.path.join(RD, 'tracks.json')
W = os.path.join(NEWS, 'f1')
NOW = dt.datetime.now(dt.timezone.utc)
SEASON = NOW.year if NOW.month > 1 else NOW.year - 1
J = 'https://api.jolpi.ca/ergast/f1/'
O = 'https://api.openf1.org/v1/'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 TheWatch/1.0 (+https://bboldt86.github.io/lanscape-navigator/news/)'
BUDGET = 330          # Jolpica requests per run (its ceiling is 500 an hour; runs are at least an hour apart)
OBUDGET = 120         # OpenF1 requests per run
errors = []
spent = {'j': 0, 'o': 0}
_last = {'j': 0.0, 'o': 0.0}
GAP = {'j': 0.3, 'o': 2.1}  # seconds between requests: Jolpica allows 4 a second; OpenF1 3 a second but only 30 a minute


class OutOfBudget(Exception):
    pass


def get(url, timeout=25, accept='application/json'):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': accept, 'Accept-Language': 'en-US,en;q=0.9'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def api(kind, url):
    """One rate-limited JSON request to Jolpica ('j') or OpenF1 ('o'), with a retry on 429 and 5xx."""
    if spent[kind] >= (BUDGET if kind == 'j' else OBUDGET):
        raise OutOfBudget(kind)
    for attempt in range(3):
        wait = _last[kind] + GAP[kind] - time.time()
        if wait > 0:
            time.sleep(wait)
        _last[kind] = time.time()
        spent[kind] += 1
        try:
            return json.loads(get(url))
        except urllib.error.HTTPError as ex:
            if ex.code == 404 and kind == 'o':
                return []
            if ex.code in (429, 500, 502, 503, 504) and attempt < 2:
                ra = ex.headers.get('Retry-After') if ex.headers else None
                time.sleep(min(30, float(ra)) if ra and ra.replace('.', '').isdigit() else 4 + attempt * 6)
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as ex:
            if attempt < 2:
                time.sleep(3)
                continue
            raise ex


def jol(path):
    return api('j', J + path)['MRData']


def jall(path, key):
    """Every page of a Jolpica table (limit 100), merged race by race. -> list of races, each with its rows under key."""
    races, off, total = {}, 0, None
    while total is None or off < total:
        m = jol(f'{path}{"&" if "?" in path else "?"}limit=100&offset={off}')
        total = int(m['total'])
        for r in m['RaceTable']['Races']:
            have = races.setdefault(int(r['round']), dict(r, **{key: []}))
            have[key] += r.get(key, [])
        off += 100
        if not total:
            break
    return [races[k] for k in sorted(races)]


# ------------------------------------------------------------------ helpers
def num(x, f=int):
    try:
        return f(x)
    except (TypeError, ValueError):
        return None


def ms(t):
    """'1:23.456' or '83.456' -> milliseconds."""
    if not t:
        return None
    try:
        p = t.split(':')
        s = float(p[-1]) + (int(p[-2]) * 60 if len(p) > 1 else 0) + (int(p[-3]) * 3600 if len(p) > 2 else 0)
        return int(round(s * 1000))
    except ValueError:
        return None


def iso(d, t):
    if not d:
        return None
    return f'{d}T{(t or "12:00:00Z").replace("Z", "")[:8]}Z'


def load(path, default):
    try:
        with open(path, encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def save(path, obj, compare_without=('at',)):
    """Write only when the content changed (ignoring the keys in compare_without). -> True if written."""
    old = load(path, None)
    strip = lambda o: {k: v for k, v in o.items() if k not in compare_without} if isinstance(o, dict) else o
    if old is not None and strip(old) == strip(obj):
        return False
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(',', ':'))
    return True


T0 = time.time()


def block(name, fn, old):
    try:
        v = fn()
        print(f'{name}: ok ({time.time() - T0:.0f}s, {spent["j"]} Jolpica, {spent["o"]} OpenF1 requests so far)')
        return v
    except OutOfBudget:
        print(f'{name}: out of request budget; kept the last copy')
        return old
    except Exception as ex:  # noqa: BLE001 - a broken source must never empty the hub
        errors.append(f'{name}: {type(ex).__name__} {str(ex)[:140]}')
        print(f'{name}: failed ({type(ex).__name__}: {ex}); kept the last copy')
        return old


# ------------------------------------------------------------------ the season from Jolpica
SESS = [('FirstPractice', 'FP1'), ('SecondPractice', 'FP2'), ('ThirdPractice', 'FP3'), ('SprintQualifying', 'SQ'), ('SprintShootout', 'SQ'),
        ('Sprint', 'S'), ('Qualifying', 'Q')]


def calendar():
    out = []
    for r in jol(f'{SEASON}.json?limit=100')['RaceTable']['Races']:
        c, loc = r['Circuit'], r['Circuit']['Location']
        ss = [[code, iso(r[k]['date'], r[k].get('time'))] for k, code in SESS if k in r]
        ss.append(['R', iso(r['date'], r.get('time'))])
        ss.sort(key=lambda s: s[1] or '')
        out.append({'r': int(r['round']), 'name': r['raceName'], 'cid': c['circuitId'], 'circuit': c['circuitName'],
                    'city': loc.get('locality'), 'country': loc.get('country'), 'lat': num(loc.get('lat'), float), 'lon': num(loc.get('long'), float),
                    'date': r['date'], 'start': iso(r['date'], r.get('time')), 'sprint': any(s[0] == 'S' for s in ss), 'sessions': ss,
                    'wiki': r.get('url')})
    if not out:
        raise RuntimeError('no races')
    return out


def row(x, sprint=False):
    d, c = x['Driver'], x['Constructor']
    o = {'d': d['driverId'], 't': c['constructorId'], 'n': num(x.get('number')), 'pos': num(x.get('position')), 'pt': x.get('positionText'),
         'g': num(x.get('grid')), 'laps': num(x.get('laps')), 'st': x.get('status'), 'pts': num(x.get('points'), float)}
    if o['pts'] is not None and o['pts'] == int(o['pts']):
        o['pts'] = int(o['pts'])
    if x.get('Time'):
        o['time'] = x['Time'].get('time')
        o['ms'] = num(x['Time'].get('millis'))
    fl = x.get('FastestLap')
    if fl and not sprint:
        o['fl'] = {'rank': num(fl.get('rank')), 'lap': num(fl.get('lap')), 'time': (fl.get('Time') or {}).get('time')}
    elif fl:
        o['fl'] = {'lap': num(fl.get('lap')), 'time': (fl.get('Time') or {}).get('time')}
    return o


def people(races_rows):
    """Drivers and teams as they appear in the classifications (who raced, for whom)."""
    drv, team = {}, {}
    for key in ('Results', 'SprintResults', 'QualifyingResults'):
        for r in races_rows.get(key, []):
            for x in r.get(key, []):
                d, c = x['Driver'], x['Constructor']
                drv[d['driverId']] = {'g': d.get('givenName'), 'f': d.get('familyName'), 'code': d.get('code'), 'num': num(d.get('permanentNumber')),
                                      'dob': d.get('dateOfBirth'), 'nat': d.get('nationality'), 'wiki': d.get('url')}
                team[c['constructorId']] = {'n': c.get('name'), 'nat': c.get('nationality'), 'wiki': c.get('url')}
    return drv, team


def standings():
    ds = jol(f'{SEASON}/driverstandings.json')['StandingsTable']['StandingsLists']
    cs = jol(f'{SEASON}/constructorstandings.json')['StandingsTable']['StandingsLists']
    if not ds:
        return None
    d = [{'d': x['Driver']['driverId'], 'pos': num(x.get('position')), 'pt': x.get('positionText'), 'pts': num(x['points'], float), 'wins': num(x['wins']),
          't': [c['constructorId'] for c in x.get('Constructors', [])]} for x in ds[0]['DriverStandings']]
    c = [{'t': x['Constructor']['constructorId'], 'pos': num(x.get('position')), 'pts': num(x['points'], float), 'wins': num(x['wins'])}
         for x in (cs[0]['ConstructorStandings'] if cs else [])]
    for x in d + c:
        if x['pts'] == int(x['pts']):
            x['pts'] = int(x['pts'])
    return {'after': num(ds[0]['round']), 'drivers': d, 'teams': c}


CAREER_KEYS = ('starts', 'wins', 'podiums', 'poles', 'fl')


def season_counts(i, results, quali):
    """What this season's classifications already add to a driver's career totals."""
    rs = [x for rows in results.values() for x in rows if x['d'] == i]
    return {'starts': len(rs), 'wins': sum(x['pos'] == 1 for x in rs), 'podiums': sum((x['pos'] or 99) <= 3 for x in rs),
            'poles': sum(x['pos'] == 1 for rows in quali.values() for x in rows if x['d'] == i),
            'fl': sum(1 for x in rs if (x.get('fl') or {}).get('rank') == 1)}


def career(ids, old, results, quali):
    """Career totals to date: starts, wins, podiums, poles, fastest laps, seasons. Jolpica's totals are fetched once a
    month per driver and stored as what came before this season ('pre'); this season's part is added from the
    classifications on every run, so the totals move with each race without asking again."""
    out, asked = {}, 0
    fresh = (NOW - dt.timedelta(days=30)).strftime('%Y-%m-%d')
    for i in sorted(ids, key=lambda i: ((old or {}).get(i) or {}).get('at', '')):  # the stalest first, six a run
        o = (old or {}).get(i) or {}
        if not o.get('pre') or o.get('at', '') < fresh:
            if spent['j'] < BUDGET - 30 and asked < 6:
                asked += 1
                try:
                    t = lambda p: int(jol(f'drivers/{i}/{p}.json?limit=1')['total'])
                    tot = {'starts': t('results'), 'wins': t('results/1'), 'p2': t('results/2'), 'p3': t('results/3'), 'poles': t('qualifying/1'),
                           'fl': t('fastest/1/results'), 'seasons': int(jol(f'drivers/{i}/seasons.json?limit=1')['total'])}
                    tot['podiums'] = tot['wins'] + tot.pop('p2') + tot.pop('p3')
                    now = season_counts(i, results, quali)
                    o = {'pre': {k: tot[k] - now[k] for k in CAREER_KEYS}, 'seasons': tot['seasons'], 'at': NOW.strftime('%Y-%m-%d')}
                except OutOfBudget:
                    pass
                except Exception as ex:  # noqa: BLE001
                    errors.append(f'career {i}: {type(ex).__name__} {str(ex)[:80]}')
            elif o.get('wins') is not None and not o.get('pre'):  # an older copy without the split: keep showing it
                out[i] = o
                continue
        if o.get('pre'):
            now = season_counts(i, results, quali)
            out[i] = dict({k: o['pre'][k] + now[k] for k in CAREER_KEYS}, pre=o['pre'], seasons=o.get('seasons'), at=o.get('at'))
    return out


# ------------------------------------------------------------------ the per-race files
def race_file(rnd, codes, osess, force=False):
    """news/data/f1/r<N>.json: positions and times lap by lap, pit stops, stints, race control, weather, overtakes.
    Parts that failed are listed in 'need' and tried again on the next run."""
    path = os.path.join(RD, f'r{rnd}.json')
    old = load(path, {})
    need = set(old.get('need', ['laps', 'pits', 'stints', 'rc', 'wx', 'ot'])) if old and not force else {'laps', 'pits', 'stints', 'rc', 'wx', 'ot'}
    out = dict(old) if old and not force else {'r': rnd}
    if 'laps' in need:
        try:
            laps = jall(f'{SEASON}/{rnd}/laps.json', 'Laps')
            pos, tms = {}, {}
            for race in laps:
                for lp in race['Laps']:
                    n = int(lp['number'])
                    for tm in lp['Timings']:
                        pos.setdefault(tm['driverId'], {})[n] = num(tm['position'])
                        tms.setdefault(tm['driverId'], {})[n] = ms(tm.get('time'))
            if pos:
                top = max(max(v) for v in pos.values())
                out['laps'] = {d: [v.get(n) for n in range(1, top + 1)] for d, v in pos.items()}
                out['times'] = {d: [v.get(n) for n in range(1, top + 1)] for d, v in tms.items()}
                for d in list(out['laps']):  # trim the trailing gaps of a retirement
                    while out['laps'][d] and out['laps'][d][-1] is None:
                        out['laps'][d].pop(); out['times'][d].pop()
                need.discard('laps')
        except OutOfBudget:
            pass
        except Exception as ex:  # noqa: BLE001
            errors.append(f'laps r{rnd}: {type(ex).__name__} {str(ex)[:80]}')
    if 'pits' in need:
        try:
            ps = jall(f'{SEASON}/{rnd}/pitstops.json', 'PitStops')
            out['pits'] = [[p['driverId'], num(p['lap']), num(p['stop']), num(p.get('duration'), float)] for race in ps for p in race['PitStops']]
            need.discard('pits')
        except OutOfBudget:
            pass
        except Exception as ex:  # noqa: BLE001
            errors.append(f'pits r{rnd}: {type(ex).__name__} {str(ex)[:80]}')
    sk = osess.get(rnd)
    if sk:
        num2id = {}
        try:
            if 'stints' in need or 'ot' in need or 'rc' in need:
                drv = api('o', f'{O}drivers?session_key={sk}')
                num2id = {x['driver_number']: codes.get(x.get('name_acronym')) for x in drv if codes.get(x.get('name_acronym'))}
            if 'stints' in need:
                st = {}
                for s in sorted(api('o', f'{O}stints?session_key={sk}'), key=lambda s: (s['driver_number'], s['stint_number'])):
                    did = num2id.get(s['driver_number'])
                    if did and s.get('lap_start') is not None:
                        st.setdefault(did, []).append([s['lap_start'], s.get('lap_end'), (s.get('compound') or '?').upper()[:12], s.get('tyre_age_at_start')])
                if st:
                    out['stints'] = st; need.discard('stints')
            if 'rc' in need:
                rc = []
                for m in api('o', f'{O}race_control?session_key={sk}'):
                    msg, cat, flag = (m.get('message') or '').strip(), m.get('category'), m.get('flag')
                    k = None
                    if cat == 'SafetyCar':
                        k = 'VSC' if 'VIRTUAL' in msg or msg.startswith('VSC') else 'SC'
                    elif flag == 'RED':
                        k = 'RED'
                    elif flag == 'CHEQUERED':
                        k = 'END'
                    elif re.search(r'\bPENALTY\b|\bDRIVE THROUGH\b|\bSTOP AND GO\b|\bDISQUALIFIED\b|\bREPRIMAND\b', msg):
                        k = 'PEN'
                    elif re.search(r'UNDER INVESTIGATION|NOTED|NO FURTHER (ACTION|INVESTIGATION)', msg) and 'TRACK LIMITS' not in msg:
                        k = 'INV'
                    elif re.search(r'\bRAIN\b|\bWET\b|DRS (EN|DIS)ABLED|OVERTAKE (MODE )?(EN|DIS)ABLED|STRAIGHT MODE', msg):
                        k = 'INFO'
                    if k:
                        rc.append([m.get('lap_number'), k, msg[:180], (m.get('date') or '')[:19]])
                out['rc'] = rc[:80]; need.discard('rc')
            if 'wx' in need:
                wx = api('o', f'{O}weather?session_key={sk}')
                if wx:
                    f = lambda k: [x[k] for x in wx if x.get(k) is not None and (x[k] > 0 or k == 'wind_speed')]  # a zero is a dropped reading
                    a, t, h, w = f('air_temperature'), f('track_temperature'), f('humidity'), f('wind_speed')
                    out['wx'] = {'air': [min(a), max(a)] if a else None, 'track': [min(t), max(t)] if t else None,
                                 'hum': round(sum(h) / len(h)) if h else None, 'wind': max(w) if w else None,
                                 'rain': any(x.get('rainfall') for x in wx)}
                    need.discard('wx')
            if 'ot' in need:
                ot = api('o', f'{O}overtakes?session_key={sk}')
                cnt = {}
                for x in ot:
                    did = num2id.get(x.get('overtaking_driver_number'))
                    if did:
                        cnt[did] = cnt.get(did, 0) + 1
                out['ot'] = cnt; out['otn'] = len(ot); need.discard('ot')
        except OutOfBudget:
            pass
        except Exception as ex:  # noqa: BLE001
            errors.append(f'openf1 r{rnd}: {type(ex).__name__} {str(ex)[:80]}')
    else:
        need -= {'stints', 'rc', 'wx', 'ot'} if old.get('tries', 0) > 6 else set()
    out['need'] = sorted(need)
    out['tries'] = old.get('tries', 0) + (1 if need else 0)
    if not out['need']:
        out.pop('need'); out.pop('tries', None)
    out['r'] = rnd
    save(path, out, compare_without=('tries',))
    return not need


def openf1_sessions():
    """{round: race session_key}, and which meetings were cancelled. Rounds are matched on the race's date."""
    ss = api('o', f'{O}sessions?year={SEASON}')
    meets = api('o', f'{O}meetings?year={SEASON}')
    return ss, meets


def tracks(cal, meets, old):
    """Each circuit's outline and corners from MultiViewer (linked from OpenF1's meetings), fetched once."""
    have = dict(old or {})
    by_date = {}
    for m in meets or []:
        if m.get('is_cancelled') or 'Testing' in (m.get('meeting_name') or ''):
            continue
        by_date[m['date_start'][:10]] = m
    n = 0
    for r in cal:
        if r['cid'] in have:
            continue
        race = dt.date.fromisoformat(r['date'])
        m = next((by_date[k] for k in by_date if 0 <= (race - dt.date.fromisoformat(k)).days <= 3), None)
        if not m or not m.get('circuit_info_url') or n >= 8:
            continue
        n += 1
        try:
            c = None
            for yr in (SEASON, SEASON - 1, SEASON - 2, 2019, 2017):  # a circuit back on the calendar may have only an older file
                try:
                    c = json.loads(get(re.sub(r'/\d{4}$', f'/{yr}', m['circuit_info_url']), timeout=20)); break
                except urllib.error.HTTPError as ex:
                    if ex.code != 404:
                        raise
            if not c:
                continue
            xs, ys = c.get('x') or [], c.get('y') or []
            if len(xs) < 20:
                continue
            step = max(1, len(xs) // 420)
            pts = [[round(xs[i]), round(ys[i])] for i in range(0, len(xs), step)]
            corners = [[k.get('number'), (k.get('letter') or ''), round(k['trackPosition']['x']), round(k['trackPosition']['y'])]
                       for k in c.get('corners', []) if k.get('trackPosition')]
            have[r['cid']] = {'rot': c.get('rotation') or 0, 'pts': pts, 'corners': corners, 'key': m.get('circuit_key')}
            time.sleep(0.5)
        except Exception as ex:  # noqa: BLE001
            errors.append(f'track {r["cid"]}: {type(ex).__name__} {str(ex)[:80]}')
    return have


# ------------------------------------------------------------------ news and video
GN = 'https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q='
FEEDS = [  # (outlet, url, language, keep only F1?)
    ('Formula 1', 'https://www.formula1.com/en/latest/all.xml', 'en', False),
    ('BBC Sport', 'https://feeds.bbci.co.uk/sport/formula1/rss.xml', 'en', False),
    ('Autosport', 'https://www.autosport.com/rss/f1/news/', 'en', False),
    ('Motorsport.com', 'https://www.motorsport.com/rss/f1/news/', 'en', False),
    ('The Guardian', 'https://www.theguardian.com/sport/formulaone/rss', 'en', False),
    ('Crash.net', 'https://www.crash.net/rss/f1', 'en', False),
    ('Sky Sports', 'https://www.skysports.com/rss/12433', 'en', False),
    ('The Race', 'https://www.the-race.com/feed/', 'en', True),
    ('RaceFans', 'https://www.racefans.net/feed/', 'en', True),
    ('Google News', GN + urllib.request.quote('"Formula 1" OR F1 grand prix when:3d'), 'en', True),
    ('Motorsport.com Brasil', 'https://motorsport.uol.com.br/rss/f1/news/', 'pt', False),
    ('Google Notícias', 'https://news.google.com/rss/search?hl=pt-BR&gl=BR&ceid=BR:pt-419&q=' + urllib.request.quote('"Fórmula 1" OR F1 when:3d'), 'pt', True),
    ('Motorsport.com Deutschland', 'https://de.motorsport.com/rss/f1/news/', 'de', False),
    ('Google News Deutschland', 'https://news.google.com/rss/search?hl=de&gl=DE&ceid=DE:de&q=' + urllib.request.quote('"Formel 1" when:3d'), 'de', True),
]
F1_RX = re.compile(r'\b(F1|Formula (1|One)|Formel ?1|F[óo]rmula ?1|grand prix|grande pr[êe]mio|GP)\b', re.I)
OTHER_RX = re.compile(r'\b(MotoGP|Moto2|Moto3|IndyCar|Indy 500|NASCAR|Formula E|WEC|Le Mans|WRC|IMSA|Supercars|F2|F3|Formula [23]|F[óo]rmula [23]|Stock Car|'
                      r'Super Formula|WorldSBK|Superbike|DTM|Nürburgring 24|Daytona|F1 Academy|Fórmula Indy)\b', re.I)
GN_OK = {'formula1.com', 'bbc.com', 'bbc.co.uk', 'autosport.com', 'motorsport.com', 'the-race.com', 'racefans.net', 'theguardian.com', 'espn.com',
         'skysports.com', 'crash.net', 'planetf1.com', 'gpfans.com', 'reuters.com', 'apnews.com', 'nytimes.com', 'cnn.com', 'si.com', 'cbssports.com',
         'foxsports.com', 'nbcsports.com', 'yahoo.com', 'sports.yahoo.com', 'motor1.com', 'roadandtrack.com', 'caranddriver.com', 'racecar-engineering.com',
         'thedrive.com', 'forbes.com', 'wsj.com', 'ft.com', 'bloomberg.com', 'telegraph.co.uk', 'independent.co.uk', 'thetimes.com', 'theathletic.com',
         'usatoday.com', 'latimes.com', 'washingtonpost.com', 'bleacherreport.com', 'essentiallysports.com', 'formulapassion.it', 'racingnews365.com',
         # Portuguese and German outlets, for those Google News searches
         'ge.globo.com', 'globo.com', 'uol.com.br', 'grandepremio.com.br', 'motorsport.uol.com.br', 'f1mania.net', 'estadao.com.br', 'folha.uol.com.br',
         'cnnbrasil.com.br', 'terra.com.br', 'band.uol.com.br', 'lance.com.br', 'metropoles.com', 'gazetaesportiva.com', 'motorsport-total.com', 'formel1.de',
         'auto-motor-und-sport.de', 'kicker.de', 'sport1.de', 'spiegel.de', 'faz.net', 'sueddeutsche.de', 'zeit.de', 'n-tv.de', 'sportschau.de', 'rtl.de',
         'sky.de', 'focus.de', 'welt.de', 'bild.de', 't-online.de', 'autobild.de', 'speedweek.com', 'motorsport-magazin.com', 'sport.de', 'tagesschau.de',
         'derstandard.at', 'krone.at', 'laola1.at', 'nzz.ch', 'blick.ch', 'srf.ch'}


def race_keys(cal):
    """Words that tie a headline to a race: the grand prix's own name, its city, country and common names."""
    extra = {'americas': ['Austin', 'COTA', 'US GP', 'United States GP', 'U.S. Grand Prix'], 'interlagos': ['Interlagos', 'São Paulo', 'Sao Paulo', 'Brazil', 'Brasil'],
             'rodriguez': ['Mexico', 'Mexican', 'México'], 'vegas': ['Las Vegas', 'Vegas'], 'losail': ['Qatar', 'Lusail', 'Losail', 'Katar'],
             'yas_marina': ['Abu Dhabi', 'Yas Marina'], 'marina_bay': ['Singapore', 'Singapur', 'Cingapura'], 'sepang': ['Malaysia', 'Malaysian', 'Sepang', 'Malaysia'],
             'baku': ['Baku', 'Azerbaijan', 'Aserbaidschan', 'Azerbaijão'], 'madring': ['Madrid', 'Madring', 'Spanish GP', 'Spanish Grand Prix', 'Spanien', 'Espanha'],
             'monza': ['Monza', 'Italian', 'Italien', 'Itália'], 'zandvoort': ['Zandvoort', 'Dutch', 'Niederlande', 'Holanda'],
             'hungaroring': ['Hungary', 'Hungarian', 'Hungaroring', 'Ungarn', 'Hungria'], 'spa': ['Spa', 'Belgian', 'Belgien', 'Bélgica'],
             'silverstone': ['Silverstone', 'British GP', 'British Grand Prix', 'Großbritannien', 'Inglaterra'], 'red_bull_ring': ['Austria', 'Austrian', 'Spielberg', 'Österreich', 'Áustria'],
             'catalunya': ['Barcelona', 'Catalunya'], 'monaco': ['Monaco', 'Monte Carlo', 'Mônaco'], 'villeneuve': ['Canada', 'Canadian', 'Montreal', 'Montréal', 'Kanada', 'Canadá'],
             'miami': ['Miami'], 'suzuka': ['Suzuka', 'Japan', 'Japanese', 'Japão'], 'shanghai': ['China', 'Chinese', 'Shanghai', 'Xangai'],
             'albert_park': ['Australia', 'Australian', 'Melbourne', 'Albert Park', 'Austrália', 'Australien']}
    out = []
    for r in cal:
        words = set(extra.get(r['cid'], []))
        base = r['name'].replace(' Grand Prix', '').replace(' in Malaysia', '')
        words.add(r['name']); words.add(base + ' GP')
        rx = re.compile(r'\b(' + '|'.join(re.escape(w) for w in sorted(words, key=len, reverse=True)) + r')\b', re.I)
        out.append((r['r'], dt.date.fromisoformat(r['date']), rx, r['name'].lower()))
    return out


def tag_round(text, when, keys, window=9):
    best = None
    for rnd, day, rx, name in keys:
        if name in text.lower():
            gap = abs((when.date() - day).days)
            if gap <= 40 and (best is None or gap < best[0]):
                best = (gap - 100, rnd)  # the race's full name wins over a city or country
        elif rx.search(text):
            gap = abs((when.date() - day).days)
            if gap <= window and (best is None or gap < best[0]):
                best = (gap, rnd)
    return best[1] if best else None


def news(keys, old):
    import run  # noqa: E402  the edition's feed reader (imported here so `check` runs without the network setup)
    out, seen, bad = [], set(), 0
    with cf.ThreadPoolExecutor(6) as pool:
        got = list(pool.map(lambda f: (f, run.read_feed({'name': f[0], 'url': f[1]})), FEEDS))
    for (outlet, url, lang, only_f1), (_, items, err) in got:
        if err:
            bad += 1; errors.append(f'{outlet}: {err}')
            continue
        for it in items:
            t, link, when = it['title'], it['link'], it['when']
            if not t or not link or not when or (NOW - when).days > 10 or when > NOW + dt.timedelta(hours=2):
                continue
            o = outlet
            if it['google']:
                dom = run.norm_domain(it['src_url'])
                if not dom or dom.lower() not in GN_OK:
                    continue
                o = run.OUTLETS.get(dom) or it['src_name'] or dom
                if it['src_name'] and t.endswith(' - ' + it['src_name']):
                    t = t[: -len(it['src_name']) - 3].strip()
            desc = run.clean(re.sub(r'<[^>]+>', ' ', it['desc'] or ''))
            text = t + ' ' + desc[:300]
            if only_f1 and (not F1_RX.search(text) or (OTHER_RX.search(t) and not re.search(r'\b(F1|Formula (1|One)|Formel ?1|F[óo]rmula ?1)\b', t, re.I))):
                continue
            if re.search(r'\b(quiz|crossword|podcast|live blog|as it happened|live updates|live:)', t, re.I) and lang == 'en':
                continue
            key = re.sub(r'\W+', ' ', t.lower()).strip()[:72]
            if key in seen:
                continue
            seen.add(key)
            x = {'t': t, 'u': link, 'o': o, 'p': when.strftime('%Y-%m-%dT%H:%M:%SZ'), 'd': desc[:220]}
            if lang != 'en':
                x['l'] = lang
            if it.get('img'):
                x['m'] = it['img']
            r = tag_round(t + ' ' + desc[:160], when, keys)
            if r:
                x['r'] = r
            out.append(x)
    if not out and old:
        raise RuntimeError(f'{bad} feeds failed and nothing came in')
    # keep what a feed that failed this time had last run
    have = {x['u'] for x in out}
    for x in old or []:
        try:
            when = dt.datetime.fromisoformat(x['p'].replace('Z', '+00:00'))
        except (KeyError, ValueError):
            continue
        if x['u'] not in have and (NOW - when).days <= 10:
            out.append(x)
    out.sort(key=lambda x: x['p'], reverse=True)
    en = [x for x in out if not x.get('l')][:110]
    other = [x for x in out if x.get('l')][:40]
    return sorted(en + other, key=lambda x: x['p'], reverse=True)


YT = 'UCB_qr75-ydFVKSF9Dmo6izg'
NS = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015', 'm': 'http://search.yahoo.com/mrss/'}


def kind_of(t):
    tl = t.lower()
    if 'sprint qualifying' in tl or 'sprint shootout' in tl:
        return 'sq'
    if 'sprint' in tl and 'highlight' in tl:
        return 'sprint'
    if 'qualifying' in tl and 'highlight' in tl:
        return 'quali'
    if ('race highlights' in tl or 'highlights' in tl and 'grand prix' in tl and 'practice' not in tl and 'fp' not in tl):
        return 'race'
    if re.search(r'\bfp[123]\b|practice', tl) and 'highlight' in tl:
        return 'fp'
    if 'onboard' in tl:
        return 'onboard'
    if 'team radio' in tl or 'radio rewind' in tl:
        return 'radio'
    return 'other'


def videos(cal, keys, old):
    raw = None
    for url in (f'https://www.youtube.com/feeds/videos.xml?channel_id={YT}', f'https://www.youtube.com/feeds/videos.xml?playlist_id=UU{YT[2:]}'):
        try:
            raw = get(url, accept='application/atom+xml,application/xml'); break
        except urllib.error.HTTPError as ex:
            if ex.code not in (404, 429, 500, 502, 503):
                raise
            time.sleep(2)
    if raw is None:
        raise RuntimeError('the channel feed did not answer')
    root = ET.fromstring(raw)
    name = (root.findtext('a:author/a:name', default='', namespaces=NS) or root.findtext('a:title', default='', namespaces=NS) or '').strip()
    if 'formula 1' not in name.lower():
        raise ValueError(f'channel is "{name}"')
    got = {}
    for e in root.findall('a:entry', NS):
        vid = e.findtext('yt:videoId', default='', namespaces=NS)
        t = (e.findtext('a:title', default='', namespaces=NS) or '').strip()
        link = e.find('a:link', NS)
        href = link.get('href') if link is not None else ''
        try:
            when = dt.datetime.fromisoformat((e.findtext('a:published', default='', namespaces=NS) or '').replace('Z', '+00:00'))
        except ValueError:
            continue
        if not vid or not t or '/shorts/' in href or re.search(r'#shorts?\b', t, re.I):
            continue
        g = e.find('m:group', NS)
        views = None
        if g is not None:
            st = g.find('m:community/m:statistics', NS)
            if st is not None and (st.get('views') or '').isdigit():
                views = int(st.get('views'))
        x = {'v': vid, 't': t, 'p': when.strftime('%Y-%m-%dT%H:%M:%SZ'), 'k': kind_of(t), 'views': views}
        r = tag_round(t, when, keys, window=6)
        if r:
            x['r'] = r
        got[vid] = x
    for x in old or []:  # highlights stay all season; everything else three weeks
        if x['v'] in got:
            continue
        try:
            when = dt.datetime.fromisoformat(x['p'].replace('Z', '+00:00'))
        except (KeyError, ValueError):
            continue
        if (x.get('r') and x.get('k') in ('race', 'quali', 'sprint') and when.year == SEASON) or (NOW - when).days <= 21:
            got[x['v']] = x
    return sorted(got.values(), key=lambda x: x['p'], reverse=True)[:160]


# ------------------------------------------------------------------ build
def progress(cal, results, sprints):
    """Points after each round, for every driver and team that has scored, from the classifications."""
    rounds = sorted(set(map(int, results)) | set(map(int, sprints)))
    cd, ct, sd, st = {}, {}, {}, {}
    for i, rnd in enumerate(rounds):
        for x in results.get(str(rnd), []) + sprints.get(str(rnd), []):
            if x.get('pts'):
                cd[x['d']] = cd.get(x['d'], 0) + x['pts']
                ct[x['t']] = ct.get(x['t'], 0) + x['pts']
        for cum, ser in ((cd, sd), (ct, st)):
            for k, v in cum.items():
                ser.setdefault(k, [0] * i).append(int(v) if v == int(v) else round(v, 1))
    return {'rounds': rounds, 'd': sd, 't': st}


def build(force=False):
    old = load(OUT, {})
    cal = block('calendar', calendar, old.get('races'))
    if not cal:
        print('no calendar; nothing to do')
        return 1
    done = [r for r in cal if r['start'] and r['start'] < (NOW - dt.timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%SZ')]
    tables = {}

    def classifications():
        res = jall(f'{SEASON}/results.json', 'Results')
        q = jall(f'{SEASON}/qualifying.json', 'QualifyingResults')
        sp = jall(f'{SEASON}/sprint.json', 'SprintResults')
        tables.update({'Results': res, 'QualifyingResults': q, 'SprintResults': sp})
        return ({str(r['round']): [row(x) for x in r['Results']] for r in res},
                {str(r['round']): [{'d': x['Driver']['driverId'], 't': x['Constructor']['constructorId'], 'pos': num(x.get('position')),
                                    'q1': x.get('Q1'), 'q2': x.get('Q2'), 'q3': x.get('Q3')} for x in r['QualifyingResults']] for r in q},
                {str(r['round']): [row(x, True) for x in r['SprintResults']] for r in sp})
    got = block('classifications', classifications, None)
    results, quali, sprints = got if got else (old.get('results', {}), old.get('quali', {}), old.get('sprints', {}))
    st = block('standings', standings, old.get('standings'))
    drv, team = people(tables) if tables else ({}, {})
    if tables:  # everyone on the season's entry list, too, so reserves who drove a practice show up by name
        try:
            for x in jol(f'{SEASON}/drivers.json?limit=100')['DriverTable']['Drivers']:
                drv.setdefault(x['driverId'], {'g': x.get('givenName'), 'f': x.get('familyName'), 'code': x.get('code'), 'num': num(x.get('permanentNumber')),
                                               'dob': x.get('dateOfBirth'), 'nat': x.get('nationality'), 'wiki': x.get('url'), 'reserve': True})
        except Exception as ex:  # noqa: BLE001
            errors.append(f'drivers: {type(ex).__name__} {str(ex)[:80]}')
    drivers = old.get('drivers', {})
    for k, v in drv.items():
        drivers[k] = dict(drivers.get(k, {}), **{a: b for a, b in v.items() if b is not None})
        if not v.get('reserve'):
            drivers[k].pop('reserve', None)
    teams = old.get('teams', {})
    for k, v in team.items():
        teams[k] = dict(teams.get(k, {}), **{a: b for a, b in v.items() if b is not None})
    # who drives for whom now: the latest classification each driver appears in
    latest = {}
    for src in (quali, sprints, results):
        for rnd, rows in src.items():
            for x in rows:
                if int(rnd) >= latest.get(x['d'], (0, ''))[0]:
                    latest[x['d']] = (int(rnd), x['t'])
    for d, (rnd, t) in latest.items():
        if d in drivers:
            drivers[d]['team'] = t

    # OpenF1: colours, headshots, cancelled races, session keys
    osess = {}
    cancelled = old.get('cancelled', [])
    meets = None

    def of1():
        nonlocal meets
        ss, meets = openf1_sessions()
        rd = {dt.date.fromisoformat(r['date']): r['r'] for r in cal}
        for s in ss:
            if s.get('session_name') != 'Race' or s.get('is_cancelled'):
                continue
            day = dt.date.fromisoformat(s['date_start'][:10])
            for dd in (day, day + dt.timedelta(days=1), day - dt.timedelta(days=1)):
                if dd in rd:
                    osess[rd[dd]] = s['session_key']; break
        canc = sorted({(m['meeting_name'], m.get('location'), m['date_start'][:10]) for m in meets if m.get('is_cancelled')}, key=lambda x: x[2])
        latest_s = max((s for s in ss if s.get('session_name') == 'Race' and not s.get('is_cancelled') and s['date_start'] < NOW.isoformat()),
                       key=lambda s: s['date_start'], default=None)
        looks = {}
        if latest_s:
            for x in api('o', f'{O}drivers?session_key={latest_s["session_key"]}'):
                looks[x.get('name_acronym')] = {'hs': x.get('headshot_url'), 'col': ('#' + x['team_colour']) if x.get('team_colour') else None, 'tn': x.get('team_name')}
        return [{'name': a, 'where': b, 'date': c} for a, b, c in canc], looks
    got = block('openf1', of1, None)
    if got:
        cancelled, looks = got
        code2id = {v.get('code'): k for k, v in drivers.items() if v.get('code')}
        for code, lk in looks.items():
            did = code2id.get(code)
            if did:
                if lk.get('hs') and 'fallback' not in (lk['hs'] or '').split('/')[-1]:
                    drivers[did]['hs'] = lk['hs']
                t = drivers[did].get('team')
                if t and lk.get('col'):
                    teams.setdefault(t, {})['col'] = lk['col']
                if t and lk.get('tn'):
                    teams.setdefault(t, {})['short'] = lk['tn']

    # the per-race files, newest race first, a few each run
    codes = {v.get('code'): k for k, v in drivers.items() if v.get('code')}
    have, made = [], 0
    for r in sorted(done, key=lambda r: r['r'], reverse=True):
        path = os.path.join(RD, f'r{r["r"]}.json')
        f = load(path, None)
        complete = f is not None and not f.get('need')
        recent = r['r'] >= max(x['r'] for x in done) - 1 if done else False
        if complete and not (force and recent):
            have.append(r['r']); continue
        if str(r['r']) not in results:
            continue  # the classification isn't in yet
        try:
            if race_file(r['r'], codes, osess, force=force and recent):
                have.append(r['r'])
            elif os.path.exists(path):
                have.append(r['r'])
        except OutOfBudget:
            break
        made += 1
        if spent['j'] > BUDGET - 40 or made >= 6:  # a few a run, so the career totals get their turn too
            break
    have += [int(os.path.basename(p)[1:-5]) for p in glob.glob(os.path.join(RD, 'r*.json')) if int(os.path.basename(p)[1:-5]) not in have]

    car = block('career', lambda: career([d for d in drivers if not drivers[d].get('reserve')], old.get('career'), results, quali), old.get('career'))
    tr = block('tracks', lambda: tracks(cal, meets, load(TRACKS, {})), None) if meets is not None else None
    if tr:
        save(TRACKS, tr)
    keys = race_keys(cal)
    nw = block('news', lambda: news(keys, old.get('news')), old.get('news'))
    vids = block('video', lambda: videos(cal, keys, old.get('videos')), old.get('videos'))

    out = {
        'v': 1, 'at': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'season': SEASON,
        'races': cal, 'cancelled': cancelled,
        'drivers': drivers, 'teams': teams,
        'results': results, 'sprints': sprints, 'quali': quali,
        'standings': st, 'progress': progress(cal, results, sprints),
        'career': car or {},
        'files': sorted(set(have)),
        'news': nw or [], 'videos': vids or [],
        'errors': errors[:40],
    }
    wrote = save(OUT, out, compare_without=('at', 'errors'))
    print(f'f1: {len(results)} races classified, {len(set(have))} race files, {len(out["news"])} stories, {len(out["videos"])} videos; '
          f'requests {spent["j"]} Jolpica, {spent["o"]} OpenF1; {"written" if wrote else "unchanged"}')
    for e in errors[:20]:
        print('  !', e)
    return 0


# ------------------------------------------------------------------ the written half: news/f1/*.json
FORMAT = """The hub's written files (news/f1/), kept by a weekly scheduled Claude task. Ids are the Jolpica ids in
news/data/f1.json (constructorId, driverId, circuitId). Every text is your own words; no quotation over 25 words.
A source is {"t": "title", "o": "outlet", "u": "https://..."}; [n] in a text cites sources[n-1] of the same object.
Every file has "updated" (ISO time with offset) and "model" (the exact model name).

teams.json  {"updated", "model", "teams": [{
    "id": "mercedes", "name": "Mercedes", "full": "Mercedes-AMG Petronas F1 Team", "base": "Brackley and Brixworth, UK",
    "owner": "optional", "principal": "Toto Wolff", "people": [{"role": "Technical director", "name": "..."}],
    "colors": {"primary": "#00D7B6", "secondary": "#000000"},
    "car": {"name": "W17", "launch": "2026-01-22", "pu": {"maker": "Mercedes", "name": "...", "works": true},
            "gearbox": "...", "front": "push-rod", "rear": "pull-rod", "fuel": "...",
            "concept": "Markdown, 50 to 320 words: the car's ideas, cited",
            "features": ["one or two sentences on something distinctive about the car"],   at least 3
            "specs": [{"k": "Livery", "v": "..."}] optional},
    "upgrades": [{"r": 3, "items": "what came", "aim": "what it was for", "verdict": "did it work", "src": [1, 2]}],
    "season": "Markdown, 50 to 300 words, cited", "strengths": ["..."], "weaknesses": ["..."], "reliability": "...",
    "drivers": ["russell", "antonelli"], "reserves": ["Name"], "next": "2027 plans, cited or empty",
    "y2025": {"pos": 2, "pts": 469} or null, "history": {"first": 1954, "titles": 8, "driver_titles": 9},
    "sources": [...]}]}   all 11 teams

drivers.json  {"updated", "model", "drivers": [{
    "id": "russell", "titles": 0, "born": "King's Lynn, England", "debut": "2019 Australian Grand Prix",
    "contract": "...", "bio": "Markdown, 50 to 200 words, cited", "season": "Markdown, 50 to 260 words, cited",
    "best": "Best result of the season", "next": "2027, cited or empty", "sources": [...]}],
  "market": {"text": "Markdown, the driver market for next year, cited", "sources": [...]}}
  every driver who started a race this season

circuits.json  {"updated", "model", "circuits": [{
    "id": "albert_park", "length": 5.278, "laps": 58, "distance": 306.124, "corners": 14 or null, "first": 1996,
    "record": {"time": "1:19.813", "driver": "Charles Leclerc", "year": 2024} or null, "type": "street | permanent | hybrid",
    "character": "Markdown, 25 to 160 words", "overtaking": "where passes happen", "tyres": "C3 C4 C5 or empty",
    "tz": "Australia/Melbourne", "tickets": "https://... official page or empty", "sources": [...]}]}   every circuit on the calendar

season.json  {"updated", "model", "season": 2026, "lede": "Markdown, 60 to 200 words: where the season stands",
  "rounds": [{"r": 1, "headline": "...", "report": "Markdown, 60 to 260 words, cited", "moments": ["..."], "video": "YouTube id or empty",
              "sources": [...]}],   every finished round
  "storylines": [{"title": "...", "body": "Markdown, 60 to 260 words, cited", "sources": [...]}],   at least 4
  "title": {"text": "Markdown: the title fight and the arithmetic, cited", "sources": [...]},
  "calendar": "Markdown: changes to the calendar and why, cited", "calendar_sources": [...],
  "watch": [{"region": "United States", "who": "...", "how": "...", "price": "...", "sources": [...]}],
  "tickets": {"official": "https://tickets.formula1.com/", "notes": "...", "sources": [...]}}

rules.json  {"updated", "model", "intro": "Markdown, 60 to 200 words",
  "areas": [{"id": "power-unit", "title": "...", "body": "Markdown, 60 to 320 words, cited", "numbers": [{"k": "...", "v": "..."}], "sources": [...]}],   at least 5
  "changes": [{"when": "2026-05", "what": "...", "src": [1]}], "changes_sources": [...],
  "suppliers": [{"maker": "Mercedes", "teams": ["mercedes", "mclaren"]}]}"""

MDW = re.compile(r"[^\W_][\w’'.,%$-]*")


def words(s):
    return len(MDW.findall(s or ''))


def _src(errs, where, srcs):
    if not isinstance(srcs, list):
        errs.append(f'{where}: sources must be a list'); return 0
    for i, s in enumerate(srcs):
        if not isinstance(s, dict) or not str(s.get('u', '')).startswith('http') or not s.get('t') or not s.get('o'):
            errs.append(f'{where}: source {i + 1} needs t, o and an http u')
    return len(srcs)


def _cites(errs, where, text, n, need=True):
    cs = [int(c) for c in re.findall(r'\[(\d+)\]', text or '')]
    if need and not cs:
        errs.append(f'{where}: no citations')
    for c in cs:
        if c < 1 or c > n:
            errs.append(f'{where}: [{c}] points past its {n} sources')
    for q in re.findall(r'[“"]([^”"]{2,})[”"]', text or ''):
        if words(q) > 25:
            errs.append(f'{where}: a quotation of {words(q)} words (25 at most)')


def _len(errs, where, text, lo, hi):
    w = words(text)
    if w < lo or w > hi:
        errs.append(f'{where}: {w} words (wants {lo} to {hi})')


def check():
    errs = []
    live = load(OUT, {})
    known_t = set((live.get('teams') or {}).keys())
    known_d = {k for k, v in (live.get('drivers') or {}).items() if not v.get('reserve')}
    known_c = {r['cid'] for r in live.get('races') or []}
    done = {int(k) for k in (live.get('results') or {})}
    files = {k: load(os.path.join(W, k + '.json'), None) for k in ('teams', 'drivers', 'circuits', 'season', 'rules')}
    for k, f in files.items():
        if f is None:
            errs.append(f'{k}.json: missing or not valid JSON'); continue
        if not re.match(r'^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?[+-]\d\d:\d\d$', str(f.get('updated', ''))):
            errs.append(f'{k}.json: updated must be an ISO time with its UTC offset')
        if not str(f.get('model', '')).startswith('Claude'):
            errs.append(f'{k}.json: model must name the Claude model')
    t = files['teams']
    if t:
        ids = [x.get('id') for x in t.get('teams', [])]
        if known_t and set(ids) != known_t:
            errs.append(f'teams.json: teams {sorted(set(ids))} differ from the season\'s {sorted(known_t)}')
        for x in t.get('teams', []):
            w = f'teams.json {x.get("id")}'
            n = _src(errs, w, x.get('sources'))
            c = x.get('car') or {}
            for key in ('name', 'pu', 'concept', 'features'):
                if not c.get(key):
                    errs.append(f'{w}: car.{key} missing')
            _len(errs, w + ' car.concept', c.get('concept'), 50, 320); _cites(errs, w + ' car.concept', c.get('concept'), n)
            if len(c.get('features') or []) < 3:
                errs.append(f'{w}: at least 3 car.features')
            _len(errs, w + ' season', x.get('season'), 50, 300); _cites(errs, w + ' season', x.get('season'), n)
            for u in x.get('upgrades') or []:
                if not isinstance(u.get('r'), int) or not u.get('items'):
                    errs.append(f'{w}: an upgrade needs r (a round number) and items')
                for s in u.get('src') or []:
                    if not isinstance(s, int) or s < 1 or s > n:
                        errs.append(f'{w}: upgrade source {s} points past its {n} sources')
            for d in x.get('drivers') or []:
                if known_d and d not in known_d:
                    errs.append(f'{w}: driver {d} is not on the season\'s results')
            col = (x.get('colors') or {}).get('primary', '')
            if not re.match(r'^#[0-9A-Fa-f]{6}$', col or ''):
                errs.append(f'{w}: colors.primary must be a #RRGGBB hex')
    d = files['drivers']
    if d:
        ids = {x.get('id') for x in d.get('drivers', [])}
        for m in sorted(known_d - ids):
            errs.append(f'drivers.json: no profile for {m}')
        for x in d.get('drivers', []):
            w = f'drivers.json {x.get("id")}'
            if known_d and x.get('id') not in known_d:
                errs.append(f'{w}: not a driver on the season\'s results')
            n = _src(errs, w, x.get('sources'))
            _len(errs, w + ' bio', x.get('bio'), 50, 200); _cites(errs, w + ' bio', x.get('bio'), n)
            _len(errs, w + ' season', x.get('season'), 50, 260); _cites(errs, w + ' season', x.get('season'), n)
        m = d.get('market') or {}
        _cites(errs, 'drivers.json market', m.get('text'), _src(errs, 'drivers.json market', m.get('sources', [])))
    c = files['circuits']
    if c:
        ids = {x.get('id') for x in c.get('circuits', [])}
        for m in sorted(known_c - ids):
            errs.append(f'circuits.json: no guide for {m}')
        for x in c.get('circuits', []):
            w = f'circuits.json {x.get("id")}'
            _src(errs, w, x.get('sources'))
            for key, typ in (('length', (int, float)), ('laps', int), ('corners', (int, type(None)))):
                if not isinstance(x.get(key), typ):
                    errs.append(f'{w}: {key} must be a number')
            _len(errs, w + ' character', x.get('character'), 25, 160)
            _cites(errs, w + ' character', x.get('character'), len(x.get('sources') or []), need=False)
    s = files['season']
    if s:
        rs = {x.get('r') for x in s.get('rounds', [])}
        for m in sorted(done - rs):
            errs.append(f'season.json: no report for round {m}')
        for x in s.get('rounds', []):
            w = f'season.json round {x.get("r")}'
            n = _src(errs, w, x.get('sources'))
            _len(errs, w, x.get('report'), 60, 260); _cites(errs, w, x.get('report'), n)
            if x.get('video') and not re.match(r'^[\w-]{11}$', x['video']):
                errs.append(f'{w}: video must be an 11-character YouTube id')
        if len(s.get('storylines', [])) < 4:
            errs.append('season.json: at least 4 storylines')
        for i, x in enumerate(s.get('storylines', [])):
            w = f'season.json storyline {i + 1}'
            n = _src(errs, w, x.get('sources'))
            _len(errs, w, x.get('body'), 60, 260); _cites(errs, w, x.get('body'), n)
        _len(errs, 'season.json lede', s.get('lede'), 60, 200)
        ti = s.get('title') or {}
        _cites(errs, 'season.json title', ti.get('text'), _src(errs, 'season.json title', ti.get('sources', [])))
        for x in s.get('watch', []):
            _src(errs, f'season.json watch {x.get("region")}', x.get('sources'))
    r = files['rules']
    if r:
        if len(r.get('areas', [])) < 5:
            errs.append('rules.json: at least 5 areas')
        for x in r.get('areas', []):
            w = f'rules.json {x.get("id")}'
            n = _src(errs, w, x.get('sources'))
            _len(errs, w, x.get('body'), 60, 320); _cites(errs, w, x.get('body'), n)
        n = _src(errs, 'rules.json changes', r.get('changes_sources', []))
        for x in r.get('changes', []):
            for s2 in x.get('src') or []:
                if not isinstance(s2, int) or s2 < 1 or s2 > n:
                    errs.append(f'rules.json change "{x.get("what", "")[:30]}": source {s2} points past {n}')
    for e in errs:
        print(e)
    print(f'{len(errs)} problem(s)' if errs else 'ok')
    return 1 if errs else 0


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['check']:
        sys.exit(check())
    if a[:1] == ['format']:
        print(FORMAT); sys.exit(0)
    sys.exit(build(force='--force' in a))
