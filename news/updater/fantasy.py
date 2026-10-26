#!/usr/bin/env python3
"""Film Room, The Watch's fantasy football section (news/sports/fantasy/): the data behind it.

  python3 news/updater/fantasy.py           rebuild news/sports/fantasy/data/film.json from the public sources
  python3 news/updater/fantasy.py check     exit 1 with the problems in film.json

What it reads (all public; nothing is scraped from a page):
  nflverse (github.com/nflverse, CC-BY 4.0)
    stats_player_week   every player's box score, week by week, with target and air-yards shares
    stats_team_week     team totals, for the defenses (sacks, takeaways, touchdowns, blocks)
    play_by_play        red-zone, inside-10, end-zone and deep targets and carries; team pace, neutral pass rate,
                        pass rate over expected and red-zone trips
    snap_counts         offensive snaps and snap share (Pro Football Reference)
    injuries            the official injury report: game status and practice participation
    rosters             current team, roster status (active, injured reserve, ...), age, ids, headshot
    depth_charts        the latest depth chart (only the newest snapshot is read)
    nfldata games.csv   the schedule, scores, Vegas spread and total, roof, surface, weather at kickoff
  ffverse ffopportunity  expected fantasy points: what each player's targets and carries are usually worth
  DynastyProcess         FantasyPros expert consensus rankings (weekly and rest of season) with rostered share,
                         dynasty trade values and the player-id crosswalk
  Sleeper (api.sleeper.app)  trending adds and drops and Sleeper's own projections, when the runner can reach it
  Google News + The Watch's own edition: fantasy headlines, tied to the players they name

Everything the page computes under a scoring setting (fantasy points, expected points, matchups, projections) is
left to the page, so the reader's own scoring applies. A source that fails keeps its last good copy; if a core
source (stats, schedule, rosters, play-by-play, snaps) fails, the last film.json is kept as it is.
Standard library only.
"""
import csv
import datetime as dt
import gzip
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
OUTD = os.path.join(ROOT, 'sports', 'fantasy', 'data')
OUT = os.path.join(OUTD, 'film.json')
LATEST = os.path.join(OUTD, 'latest.json')
EDITION = os.path.join(ROOT, 'data', 'edition.json')
ET_ = ZoneInfo('America/New_York')
NOW = dt.datetime.now(dt.timezone.utc)
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 '
                    'TheWatch-FilmRoom/1.0 (+https://bboldt86.github.io/lanscape-navigator/news/sports/fantasy/)'}
FIXTURE = os.environ.get('FILM_FIXTURE')  # a folder of saved downloads, for testing offline
errors, notes = [], []


def season_now():
    s = os.environ.get('FILM_SEASON')
    if s:
        return int(s)
    e = NOW.astimezone(ET_)
    return e.year if e.month >= 6 else e.year - 1


S = season_now()
NV = 'https://github.com/nflverse/nflverse-data/releases/download/'
SRC = {
    'stats': NV + f'stats_player/stats_player_week_{S}.csv',
    'team': NV + f'stats_team/stats_team_week_{S}.csv',
    'pbp': NV + f'pbp/play_by_play_{S}.csv.gz',
    'snaps': NV + f'snap_counts/snap_counts_{S}.csv',
    'injuries': NV + f'injuries/injuries_{S}.csv',
    'roster': NV + f'rosters/roster_{S}.csv',
    'depth': NV + f'depth_charts/depth_charts_{S}.csv',
    'games': 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv',
    'ep': f'https://github.com/ffverse/ffopportunity/releases/download/latest-data/ep_weekly_{S}.csv',
    'ecr': 'https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_fpecr_latest.csv',
    'values': 'https://raw.githubusercontent.com/dynastyprocess/data/master/files/values.csv',
    'ids': 'https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv',
}
SLEEPER = 'https://api.sleeper.app/v1/'
SLEEPER_PROJ = 'https://api.sleeper.com/projections/nfl/{s}/{w}?season_type=regular' + ''.join(
    '&position[]=' + p for p in ('QB', 'RB', 'WR', 'TE', 'K', 'DEF'))
GN = 'https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q='
NEWS_FEEDS = [
    ('Fantasy football', GN + urllib.parse.quote('"fantasy football" when:3d')),
    ('Waivers', GN + urllib.parse.quote('"waiver wire" fantasy football when:4d')),
    ('Start or sit', GN + urllib.parse.quote('fantasy football "start" "sit" when:4d')),
    ('Injuries', GN + urllib.parse.quote('NFL injury report questionable OR doubtful OR ruled out when:3d')),
    ('Rotoballer', 'https://www.rotoballer.com/category/nfl/feed'),
    ('FantasyPros', GN + urllib.parse.quote('site:fantasypros.com nfl when:3d')),
]
SKILL = ('QB', 'RB', 'WR', 'TE')
# FantasyPros' team codes -> nflverse's
FP_TEAM = {'LAR': 'LA', 'JAC': 'JAX', 'WSH': 'WAS', 'KCC': 'KC', 'GBP': 'GB', 'NOS': 'NO', 'NEP': 'NE', 'TBB': 'TB',
           'SFO': 'SF', 'LVR': 'LV', 'OAK': 'LV', 'SD': 'LAC', 'STL': 'LA'}


# ---------------------------------------------------------------- fetching
def fetch(url, name, timeout=60, limit=None):
    if FIXTURE:
        fp = os.path.join(FIXTURE, name)
        if not os.path.exists(fp):
            raise FileNotFoundError(fp)
        with open(fp, 'rb') as f:
            return f.read()
    req = urllib.request.Request(url, headers=UA)
    last = None
    for attempt in (1, 2, 3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read(limit) if limit else r.read()
        except urllib.error.HTTPError as ex:
            last = ex
            if ex.code < 500 and ex.code != 429:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as ex:
            last = ex
        time.sleep(2 * attempt)
    raise last


def rows(name, gz=False):
    raw = fetch(SRC[name], name + ('.csv.gz' if gz else '.csv'))
    if gz or raw[:2] == b'\x1f\x8b':
        raw = gzip.decompress(raw)
    return list(csv.DictReader(io.StringIO(raw.decode('utf-8', 'replace'))))


def depth_latest():
    """The depth-chart file holds every daily snapshot of the season (newest first, ~70 MB). Read only until the
    newest snapshot ends."""
    if FIXTURE:
        raw = fetch(SRC['depth'], 'depth.csv')
        lines = io.StringIO(raw.decode('utf-8', 'replace'))
    else:
        req = urllib.request.Request(SRC['depth'], headers=UA)
        resp = urllib.request.urlopen(req, timeout=60)
        lines = io.TextIOWrapper(resp, encoding='utf-8', errors='replace')
    rd = csv.DictReader(lines)
    out, stamp = [], None
    for r in rd:
        d = (r.get('dt') or '')[:10]
        if stamp is None:
            stamp = d
        if d != stamp:
            break
        out.append(r)
    return out, stamp


def num(v, default=0.0):
    try:
        if v in (None, '', 'NA', 'NaN'):
            return default
        return float(v)
    except ValueError:
        return default


def inum(v):
    return int(round(num(v)))


def r1(v):
    return round(v, 1)


def r2(v):
    return round(v, 2)


# ---------------------------------------------------------------- the schedule and the weeks
def kickoff(gameday, gametime):
    try:
        d = dt.datetime.strptime(f'{gameday} {gametime or "13:00"}', '%Y-%m-%d %H:%M').replace(tzinfo=ET_)
        return d.astimezone(dt.timezone.utc)
    except ValueError:
        return None


def build_games():
    g = [r for r in rows('games') if r['season'] == str(S)]
    if not g:
        raise RuntimeError(f'no {S} games in the schedule')
    out = []
    for r in g:
        k = kickoff(r['gameday'], r['gametime'])
        out.append({
            'id': r['game_id'], 'w': int(r['week']), 'gt': r['game_type'], 'k': k.isoformat().replace('+00:00', 'Z') if k else None,
            'day': r['weekday'], 'a': r['away_team'], 'h': r['home_team'],
            'as': inum(r['away_score']) if r['away_score'] not in ('', 'NA') else None,
            'hs': inum(r['home_score']) if r['home_score'] not in ('', 'NA') else None,
            'sp': num(r['spread_line'], None), 'tot': num(r['total_line'], None),
            'aml': inum(r['away_moneyline']) if r['away_moneyline'] not in ('', 'NA') else None,
            'hml': inum(r['home_moneyline']) if r['home_moneyline'] not in ('', 'NA') else None,
            'roof': r['roof'] or None, 'surf': r['surface'] or None, 'std': r['stadium'] or None,
            'loc': r['location'] or None, 'div': r['div_game'] == '1',
            'temp': inum(r['temp']) if r['temp'] not in ('', 'NA') else None,
            'wind': inum(r['wind']) if r['wind'] not in ('', 'NA') else None,
            'aqb': r['away_qb_name'] or None, 'hqb': r['home_qb_name'] or None,
        })
    out.sort(key=lambda x: (x['k'] or '', x['id']))
    return out


def weeks_of(games, now=NOW):
    """study: the week to prepare for. A week stays the study week until its last Sunday kickoff (so Monday morning
    is already next week's homework), live: the earliest week with a game still to finish, done: the last week whose
    games are all final."""
    by = defaultdict(list)
    for x in games:
        if x['gt'] == 'REG':
            by[x['w']].append(x)
    wk = sorted(by)
    study = live = done = None
    for w in wk:
        ks = [dt.datetime.fromisoformat(x['k'].replace('Z', '+00:00')) for x in by[w] if x['k']]
        sun = [k for k, x in zip(ks, by[w]) if x['day'] in ('Sunday', 'Saturday', 'Friday', 'Thursday', 'Wednesday')]
        lock = max(sun or ks)
        if study is None and lock > now:
            study = w
        if live is None and any(x['hs'] is None for x in by[w]):
            live = w
        if all(x['hs'] is not None for x in by[w]):
            done = w
    last = wk[-1]
    return {'study': study or last, 'live': live or last, 'done': done or 0, 'last': last,
            'first': {w: min(x['k'] for x in by[w] if x['k']) for w in wk}}


# ---------------------------------------------------------------- play-by-play: the red zone and the teams
def pbp_aggregate():
    rd = rows('pbp', gz=True)
    pl = defaultdict(lambda: [0] * 8)   # (gsis, week) -> rz_tgt, i10_tgt, ez_tgt, deep_tgt, rz_car, i10_car, i5_car, rz_att
    tm = defaultdict(lambda: defaultdict(float))  # (team, week) -> team aggregates
    rz_drives = defaultdict(set)
    td_drives = defaultdict(set)
    prev = {}
    for r in rd:
        if r.get('season_type') != 'REG':
            continue
        pt = r['play_type']
        if pt not in ('pass', 'run') or r['two_point_attempt'] == '1' or r.get('aborted_play') == '1':
            continue
        w = int(r['week'])
        team = r['posteam']
        yl = num(r['yardline_100'], 99)
        key = (team, w)
        t = tm[key]
        kneel = r['qb_kneel'] == '1' or r['qb_spike'] == '1'
        if not kneel:
            t['plays'] += 1
            t['db'] += 1 if r['qb_dropback'] == '1' else 0
        wp = num(r['wp'], 0.5)
        hs = num(r['half_seconds_remaining'], 0)
        neutral = 0.2 <= wp <= 0.8 and hs > 120 and not kneel
        if neutral:
            t['np'] += 1
            t['ndb'] += 1 if r['qb_dropback'] == '1' else 0
        if r['pass_oe'] not in ('', 'NA') and not kneel:
            t['oe'] += num(r['pass_oe'])
            t['oen'] += 1
        drv = (r['game_id'], r['fixed_drive'])
        if yl <= 20:
            rz_drives[key].add(drv)
            if r['fixed_drive_result'] == 'Touchdown':
                td_drives[key].add(drv)
        # pace: seconds between snaps on the same drive, in neutral situations
        gs = num(r['game_seconds_remaining'], -1)
        p = prev.get(r['game_id'])
        if p and p[0] == team and p[1] == r['fixed_drive'] and neutral:
            d = p[2] - gs
            if 0 < d < 60:
                t['sec'] += d
                t['secn'] += 1
        prev[r['game_id']] = (team, r['fixed_drive'], gs)
        if r['pass_attempt'] == '1' and r['receiver_player_id']:
            a = pl[(r['receiver_player_id'], w)]
            ay = num(r['air_yards'], 0)
            if yl <= 20:
                a[0] += 1
            if yl <= 10:
                a[1] += 1
            if r['air_yards'] not in ('', 'NA') and ay >= yl:
                a[2] += 1
            if ay >= 20:
                a[3] += 1
        if r['pass_attempt'] == '1' and r['passer_player_id'] and yl <= 20:
            pl[(r['passer_player_id'], w)][7] += 1
        if r['rush_attempt'] == '1' and r['rusher_player_id'] and not kneel:
            a = pl[(r['rusher_player_id'], w)]
            if yl <= 20:
                a[4] += 1
            if yl <= 10:
                a[5] += 1
            if yl <= 5:
                a[6] += 1
    for key in tm:
        tm[key]['rz'] = len(rz_drives[key])
        tm[key]['rztd'] = len(td_drives[key])
    return pl, tm


# ---------------------------------------------------------------- build
PW_FIELDS = ['w', 'opp', 'home', 'snp', 'sp',
             'pa', 'pc', 'py', 'ptd', 'pint', 'psk', 'p2',
             'ra', 'ry', 'rtd', 'r2',
             'tg', 'rc', 'cy', 'ctd', 'c2', 'ay', 'yac',
             'fl', 'ts', 'as',
             'rzt', 'i10t', 'ezt', 'dpt', 'rzc', 'i10c', 'i5c', 'rza',
             'xrc', 'xcy', 'xctd', 'xry', 'xrtd', 'xpy', 'xptd', 'xpint',
             'fg0', 'fg4', 'fg5', 'fga', 'xpm', 'xpa', 'ret']
DW_FIELDS = ['w', 'opp', 'home', 'pa', 'ya', 'sk', 'int', 'fr', 'dtd', 'sf', 'blk', 'sttd']
TW_FIELDS = ['w', 'opp', 'pts', 'plays', 'db', 'np', 'ndb', 'oe', 'oen', 'sec', 'secn', 'rz', 'rztd',
             'tg', 'ay', 'ra', 'pa', 'py', 'ry']


def load_prev():
    try:
        with open(OUT, encoding='utf-8') as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return None


def build():
    prev = load_prev()
    prevp = {p['id']: p for p in (prev or {}).get('players', [])}
    t0 = time.time()

    # core
    games = build_games()
    W = weeks_of(games)
    stats = [r for r in rows('stats') if r['season_type'] == 'REG']
    teamwk = [r for r in rows('team') if r['season_type'] == 'REG']
    roster = rows('roster')
    snaps = [r for r in rows('snaps') if r['game_type'] == 'REG']
    pbp_pl, pbp_tm = pbp_aggregate()
    notes.append(f'core read in {time.time() - t0:.0f}s')

    # optional
    def opt(name, fn, default):
        try:
            return fn()
        except Exception as ex:  # noqa: BLE001
            errors.append(f'{name}: {type(ex).__name__}: {str(ex)[:140]}')
            return default
    ep = opt('ep', lambda: rows('ep'), None)
    inj = opt('injuries', lambda: rows('injuries'), None)
    ecr = opt('ecr', lambda: rows('ecr'), None)
    vals = opt('values', lambda: rows('values'), None)
    ids = opt('ids', lambda: rows('ids'), None)
    depth = opt('depth', depth_latest, (None, None))

    # the players: current roster first
    ros = {}
    for r in roster:
        if r['gsis_id']:
            ros[r['gsis_id']] = r
    pfr2g = {r['pfr_id']: r['gsis_id'] for r in roster if r['pfr_id'] and r['gsis_id']}
    if ids:
        for r in ids:
            if r.get('pfr_id') and r.get('gsis_id') and r['pfr_id'] not in pfr2g and r['pfr_id'] != 'NA':
                pfr2g[r['pfr_id']] = r['gsis_id']
    snapby = {}
    for r in snaps:
        g = pfr2g.get(r['pfr_player_id'])
        if g:
            snapby[(g, int(r['week']))] = (inum(r['offense_snaps']), r1(num(r['offense_pct']) * (100 if num(r['offense_pct']) <= 1 else 1)))
    epby = {}
    for r in ep or []:
        epby[(r['player_id'], int(r['week']))] = r

    home_of = {}
    for g in games:
        home_of[(g['h'], g['w'])] = True
        home_of[(g['a'], g['w'])] = False

    pw = defaultdict(dict)
    meta = {}
    for r in stats:
        pos = r['position']
        if pos not in SKILL and pos != 'K':
            if pos == 'FB':
                pos = 'RB'
            else:
                continue
        pid, w = r['player_id'], int(r['week'])
        meta[pid] = {'n': r['player_display_name'] or r['player_name'], 'p': pos, 't': r['team'], 'img': r['headshot_url']}
        sn = snapby.get((pid, w), (0, 0))
        x = pbp_pl.get((pid, w), [0] * 8)
        e = epby.get((pid, w), {})
        rec = {
            'w': w, 'opp': r['opponent_team'], 'home': 1 if home_of.get((r['team'], w)) else 0, 'snp': sn[0], 'sp': sn[1],
            'pa': inum(r['attempts']), 'pc': inum(r['completions']), 'py': inum(r['passing_yards']), 'ptd': inum(r['passing_tds']),
            'pint': inum(r['passing_interceptions']), 'psk': inum(r['sacks_suffered']), 'p2': inum(r['passing_2pt_conversions']),
            'ra': inum(r['carries']), 'ry': inum(r['rushing_yards']), 'rtd': inum(r['rushing_tds']), 'r2': inum(r['rushing_2pt_conversions']),
            'tg': inum(r['targets']), 'rc': inum(r['receptions']), 'cy': inum(r['receiving_yards']), 'ctd': inum(r['receiving_tds']),
            'c2': inum(r['receiving_2pt_conversions']), 'ay': inum(r['receiving_air_yards']), 'yac': inum(r['receiving_yards_after_catch']),
            'fl': inum(r['rushing_fumbles_lost']) + inum(r['receiving_fumbles_lost']) + inum(r['sack_fumbles_lost']),
            'ts': r2(num(r['target_share'])), 'as': r2(num(r['air_yards_share'])),
            'rzt': x[0], 'i10t': x[1], 'ezt': x[2], 'dpt': x[3], 'rzc': x[4], 'i10c': x[5], 'i5c': x[6], 'rza': x[7],
            'xrc': r1(num(e.get('receptions_exp'))), 'xcy': r1(num(e.get('rec_yards_gained_exp'))),
            'xctd': r2(num(e.get('rec_touchdown_exp'))), 'xry': r1(num(e.get('rush_yards_gained_exp'))),
            'xrtd': r2(num(e.get('rush_touchdown_exp'))), 'xpy': r1(num(e.get('pass_yards_gained_exp'))),
            'xptd': r2(num(e.get('pass_touchdown_exp'))), 'xpint': r2(num(e.get('pass_interception_exp'))),
            'fg0': inum(r['fg_made_0_19']) + inum(r['fg_made_20_29']) + inum(r['fg_made_30_39']),
            'fg4': inum(r['fg_made_40_49']), 'fg5': inum(r['fg_made_50_59']) + inum(r['fg_made_60_']),
            'fga': inum(r['fg_att']), 'xpm': inum(r.get('pat_made')), 'xpa': inum(r.get('pat_att')),
            'ret': inum(r['special_teams_tds']),
        }
        if not e:  # no expected-points row (a kicker, or a week the model hasn't reached): leave the x-fields empty
            for k in ('xrc', 'xcy', 'xctd', 'xry', 'xrtd', 'xpy', 'xptd', 'xpint'):
                rec[k] = None
        pw[pid][w] = [rec[f] for f in PW_FIELDS]

    # depth chart: offense positions, the newest snapshot
    dc = {}
    drows, dstamp = depth
    if drows:
        # WRs fill several slots (X, Z, slot), each with its own string: order a team's players at a position by
        # their string, then by slot, so the depth chart reads WR1, WR2, WR3, WR4 ...
        slots = defaultdict(list)
        for r in drows:
            ab = (r.get('pos_abb') or '').upper()
            pos = {'QB': 'QB', 'RB': 'RB', 'HB': 'RB', 'FB': 'RB', 'WR': 'WR', 'LWR': 'WR', 'RWR': 'WR', 'SWR': 'WR',
                   'SLWR': 'WR', 'TE': 'TE', 'PK': 'K', 'K': 'K'}.get(ab)
            if not pos or not r.get('gsis_id'):
                continue
            if ab == 'FB' and r.get('pos_grp') and 'Special' in r['pos_grp']:
                continue
            slots[(r.get('team'), pos)].append((inum(r.get('pos_rank')) or 9, ab == 'FB', inum(r.get('pos_slot')) or 9, r['gsis_id']))
        for (team, pos), lst in slots.items():
            seen = []
            for _, _, _, g in sorted(lst):
                if g not in seen:
                    seen.append(g)
            for i, g in enumerate(seen, 1):
                if g not in dc:
                    dc[g] = (pos, i, team)

    # who goes in: anyone with a week of stats, plus anyone on a depth chart near the top
    keep = set(pw)
    for g, (pos, rk, team) in dc.items():
        lim = {'QB': 2, 'RB': 3, 'WR': 4, 'TE': 2, 'K': 1}[pos]
        if rk <= lim:
            keep.add(g)

    # the injury report: each player's latest week
    # a player counts as listed only on his team's newest report: being off it means he was cleared
    injby = {}
    if inj:
        inj = [r for r in inj if r.get('game_type', 'REG') == 'REG']
        newest = defaultdict(int)
        for r in inj:
            newest[r['team']] = max(newest[r['team']], int(r['week'] or 0))
        for r in inj:
            g = r['gsis_id']
            w = int(r['week'] or 0)
            if not g or w != newest[r['team']]:
                continue
            what = r['report_primary_injury'] or r['practice_primary_injury'] or ''
            if not r['report_status'] and (not what or what.lower().startswith('not injury')):
                continue  # a veteran's rest day, or a full practice with nothing listed
            injby[g] = {'w': w, 's': r['report_status'] or None, 'i': what or None, 'pr': r['practice_status'] or None}

    # FantasyPros consensus (via DynastyProcess) and dynasty values
    fp2g = {}
    if ids:
        for r in ids:
            if r.get('fantasypros_id') and r.get('gsis_id') and r['gsis_id'] != 'NA':
                fp2g[r['fantasypros_id']] = r['gsis_id']
    ecrby, dstecr, ecr_meta = defaultdict(dict), defaultdict(dict), {}
    if ecr:
        for r in ecr:
            et = r['ecr_type']
            if et not in ('wp', 'rp', 'ro'):
                continue
            ecr_meta.setdefault(et, r['scrape_date'])
            tgt = None
            if r['pos'] == 'DST':
                team = FP_TEAM.get(r['tm'] or r['team'], r['tm'] or r['team'])
                tgt = dstecr[team]
            else:
                g = fp2g.get(r['id'])
                if not g:
                    continue
                tgt = ecrby[g]
            val = num(r['ecr'], None)
            if val is None:
                continue
            k = {'wp': 'wk', 'rp': 'ros', 'ro': 'ovr'}[et]
            tgt[k] = r2(val)
            if et == 'wp':
                tgt['wsd'] = r2(num(r['sd']))
                tgt['wb'], tgt['ww'] = inum(r['best']), inum(r['worst'])
            own = num(r['player_owned_avg'], None)
            if own is not None:
                tgt['own'] = r1(own)
    valby = {}
    if vals:
        name2g = {}
        for g, m in meta.items():
            name2g[(norm(m['n']), m['p'])] = g
        for r in vals:
            g = fp2g.get(r.get('fp_id', '')) or name2g.get((norm(r['player']), r['pos']))
            if g:
                valby[g] = inum(r['value_1qb'])

    # Sleeper: trending adds and drops, its projections for the study week
    sl = sleeper(W['study'])
    s2g = {r['sleeper_id']: r['gsis_id'] for r in roster if r.get('sleeper_id') and r['gsis_id']}
    if ids:
        for r in ids:
            if r.get('sleeper_id') and r['sleeper_id'] != 'NA' and r.get('gsis_id') and r['gsis_id'] != 'NA':
                s2g.setdefault(r['sleeper_id'], r['gsis_id'])

    players = []
    for g in keep:
        ro = ros.get(g, {})
        m = meta.get(g, {})
        pos = m.get('p') or (dc.get(g) or (None,))[0] or ro.get('position')
        if pos == 'FB':
            pos = 'RB'
        if pos not in SKILL and pos != 'K':
            continue
        st = ro.get('status') or None
        if st in ('CUT', 'RET'):
            team = None
        else:
            team = ro.get('team') or m.get('t') or (dc.get(g) or (None, None, None))[2]
        name = (ro.get('full_name') or m.get('n') or '').strip()
        if not name:
            continue
        age = None
        if ro.get('birth_date'):
            try:
                b = dt.date.fromisoformat(ro['birth_date'][:10])
                age = r1((NOW.date() - b).days / 365.25)
            except ValueError:
                pass
        p = {'id': g, 'n': name, 'p': pos, 't': team, 'st': st,
             'img': ro.get('headshot_url') or m.get('img') or None,
             'age': age, 'ex': inum(ro.get('years_exp')) if ro.get('years_exp') not in (None, '') else None,
             'ids': {k: v for k, v in (('sl', ro.get('sleeper_id')), ('yh', ro.get('yahoo_id')), ('es', ro.get('espn_id')),
                                        ('pfr', ro.get('pfr_id'))) if v and v != 'NA'},
             'g': [pw[g][w] for w in sorted(pw.get(g, {}))]}
        if g in dc and dc[g][2] == team:
            p['dc'] = f'{dc[g][0]}{dc[g][1]}'
        if inj is not None:
            if g in injby:
                p['inj'] = injby[g]
        elif g in prevp and prevp[g].get('inj'):
            p['inj'] = prevp[g]['inj']
        if ecr is not None:
            if g in ecrby:
                p['ecr'] = ecrby[g]
        elif g in prevp and prevp[g].get('ecr'):
            p['ecr'] = prevp[g]['ecr']
        if g in valby:
            p['dv'] = valby[g]
        players.append(p)
    players.sort(key=lambda p: (p['p'], p['n']))

    # Sleeper extras, keyed back to gsis ids
    if sl:
        byg = {p['id']: p for p in players}
        for sid, cnt in sl.get('add', {}).items():
            g = s2g.get(sid)
            if g in byg:
                byg[g]['tra'] = cnt
        for sid, cnt in sl.get('drop', {}).items():
            g = s2g.get(sid)
            if g in byg:
                byg[g]['trd'] = cnt
        for sid, pr in sl.get('proj', {}).items():
            g = s2g.get(sid)
            if g in byg:
                byg[g]['slp'] = pr
    elif prev and prev.get('week', {}).get('study') == W['study']:
        for p in players:
            q = prevp.get(p['id'])
            if q:
                for k in ('tra', 'trd', 'slp'):
                    if k in q:
                        p[k] = q[k]

    # the teams: offense context and the defense's box score, week by week
    tws = defaultdict(dict)
    by_game_team = {(r['game_id'], r['team']): r for r in teamwk}
    score = {}
    for g in games:
        if g['hs'] is not None:
            score[(g['h'], g['w'])] = (g['hs'], g['as'])
            score[(g['a'], g['w'])] = (g['as'], g['hs'])
    teams = {}
    for r in teamwk:
        team, w = r['team'], int(r['week'])
        opp = r['opponent_team']
        o = by_game_team.get((r['game_id'], opp), {})
        pts_for, pts_against = score.get((team, w), (None, None))
        ya = inum(o.get('passing_yards')) - inum(o.get('sack_yards_lost')) + inum(o.get('rushing_yards')) if o else None
        d = {'w': w, 'opp': opp, 'home': 1 if home_of.get((team, w)) else 0, 'pa': pts_against, 'ya': ya,
             'sk': r1(num(r['def_sacks'])), 'int': inum(r['def_interceptions']), 'fr': inum(r['fumble_recovery_opp']),
             'dtd': inum(r['def_tds']), 'sf': inum(r['def_safeties']),
             'blk': inum(r['def_fg_blocks']) + inum(r['def_punt_blocks']) + inum(r['def_pat_blocks']),
             'sttd': inum(r['special_teams_tds'])}
        a = pbp_tm.get((team, w), {})
        t = {'w': w, 'opp': opp, 'pts': pts_for, 'plays': int(a.get('plays', 0)), 'db': int(a.get('db', 0)),
             'np': int(a.get('np', 0)), 'ndb': int(a.get('ndb', 0)), 'oe': r1(a.get('oe', 0)), 'oen': int(a.get('oen', 0)),
             'sec': r1(a.get('sec', 0)), 'secn': int(a.get('secn', 0)), 'rz': int(a.get('rz', 0)), 'rztd': int(a.get('rztd', 0)),
             'tg': inum(r['targets']), 'ay': inum(r['receiving_air_yards']), 'ra': inum(r['carries']), 'pa': inum(r['attempts']),
             'py': inum(r['passing_yards']), 'ry': inum(r['rushing_yards'])}
        tws[team][w] = ([d[f] for f in DW_FIELDS], [t[f] for f in TW_FIELDS])
    for team, wk in tws.items():
        teams[team] = {'d': [wk[w][0] for w in sorted(wk)], 'o': [wk[w][1] for w in sorted(wk)]}
        e = dstecr.get(team)
        if e:
            teams[team]['ecr'] = e
        elif ecr is None and prev and prev.get('teams', {}).get(team, {}).get('ecr'):
            teams[team]['ecr'] = prev['teams'][team]['ecr']

    # fantasy headlines
    news = opt('news', lambda: build_news(players), None)
    if news is None:
        news = (prev or {}).get('news', [])

    ecr_week = None
    if ecr_meta.get('wp'):
        sd = dt.datetime.fromisoformat(ecr_meta['wp'] + 'T12:00:00+00:00')
        ecr_week = weeks_of(games, sd)['study']
    out = {
        'v': 1, 'at': NOW.isoformat(timespec='seconds').replace('+00:00', 'Z'), 'season': S,
        'week': {k: W[k] for k in ('study', 'live', 'done', 'last')},
        'fields': {'pw': PW_FIELDS, 'dw': DW_FIELDS, 'tw': TW_FIELDS},
        'games': games, 'players': players, 'teams': teams, 'news': news,
        'ecr': {'week': ecr_week, 'weekly': ecr_meta.get('wp'), 'ros': ecr_meta.get('rp'), 'scoring': 'PPR'},
        'depth': dstamp, 'sleeper': bool(sl), 'errors': errors, 'notes': notes,
        'sources': {k: v for k, v in SRC.items()},
    }
    return out


def norm(s):
    s = (s or '').lower()
    s = re.sub(r'\b(jr|sr|ii|iii|iv|v)\b\.?', '', s)
    return re.sub(r'[^a-z]', '', s)


def sleeper(week):
    if FIXTURE:
        return None
    out = {}
    try:
        for kind in ('add', 'drop'):
            raw = fetch(SLEEPER + f'players/nfl/trending/{kind}?lookback_hours=24&limit=60', 'sleeper', timeout=15)
            out[kind] = {str(x['player_id']): int(x['count']) for x in json.loads(raw)}
    except Exception as ex:  # noqa: BLE001
        errors.append(f'sleeper trending: {type(ex).__name__}: {str(ex)[:100]}')
        return None
    try:
        raw = fetch(SLEEPER_PROJ.format(s=S, w=week), 'sleeper', timeout=25)
        proj = {}
        for x in json.loads(raw):
            stt = x.get('stats') or {}
            pid = str(x.get('player_id') or '')
            if pid and ('pts_ppr' in stt or 'pts_half_ppr' in stt):
                proj[pid] = [r1(num(stt.get('pts_ppr'))), r1(num(stt.get('pts_half_ppr'))), r1(num(stt.get('pts_std')))]
        out['proj'] = proj
    except Exception as ex:  # noqa: BLE001
        errors.append(f'sleeper projections: {type(ex).__name__}: {str(ex)[:100]}')
    return out


# ---------------------------------------------------------------- headlines
def build_news(players):
    sys.path.insert(0, HERE)
    import run  # noqa: E402  the edition's feed reader
    names = {}
    for p in players:
        if not p.get('g') and not p.get('dc'):
            continue
        n = p['n']
        names[n.lower()] = p['id']
        short = re.sub(r'\s+(Jr\.?|Sr\.?|II|III|IV|V)$', '', n)
        names.setdefault(short.lower(), p['id'])
    rx = re.compile(r'\b(' + '|'.join(re.escape(n) for n in sorted(names, key=len, reverse=True)) + r')\b', re.I)
    fant = re.compile(r'fantasy|waiver|start(?:\s|-)sit|sleeper|streamer|ppr|rankings?|projections?|injur|questionable|'
                      r'doubtful|ruled out|inactive|week \d+', re.I)
    seen, out = set(), []

    def add(title, link, outlet, when, tag):
        key = re.sub(r'[^a-z0-9]', '', title.lower())[:80]
        if not title or not link or key in seen:
            return
        if when and (NOW - when).total_seconds() > 4 * 86400:
            return
        pls = []
        for m in rx.finditer(title):
            g = names.get(m.group(1).lower())
            if g and g not in pls:
                pls.append(g)
        if not pls and not fant.search(title):
            return
        seen.add(key)
        out.append({'t': title, 'u': link, 'o': outlet, 'p': int(when.timestamp()) if when else None, 'pl': pls[:6], 'f': tag})

    for tag, url in NEWS_FEEDS:
        name, items, err = run.read_feed({'name': 'Film Room ' + tag, 'url': url})
        if err:
            errors.append(f'news {tag}: {err}')
            continue
        for it in items[:40]:
            title = it['title']
            outlet = ''
            if it.get('google'):
                outlet = re.sub(r'^www\.', '', urllib.parse.urlparse(it.get('src_url') or '').netloc) or it.get('src_name') or ''
                title = re.sub(r'\s+[-–—]\s+[^-–—]{2,60}$', '', title)
            else:
                outlet = re.sub(r'^www\.', '', urllib.parse.urlparse(it['link']).netloc)
            add(title, it['link'], outlet, it.get('when'), tag)
    # The Watch's own edition: its NFL stories
    try:
        with open(EDITION, encoding='utf-8') as f:
            E = json.load(f)
        for it in E.get('items', []):
            if it.get('c') != 'sports' and 'nfl' not in (it.get('k') or []):
                continue
            if it.get('l') and it['l'] != 'en':
                continue
            when = dt.datetime.fromtimestamp(it['p'] * 60, dt.timezone.utc) if it.get('p') else None
            ttl = it['t']
            if not rx.search(ttl) and 'nfl' not in (it.get('k') or []):
                continue
            add(ttl, it['u'], it.get('o', ''), when, 'The Watch')
    except Exception as ex:  # noqa: BLE001
        errors.append(f'edition: {type(ex).__name__}: {str(ex)[:80]}')
    out.sort(key=lambda x: -(x['p'] or 0))
    return out[:220]


# ---------------------------------------------------------------- check
def check(path=OUT):
    probs = []
    try:
        with open(path, encoding='utf-8') as f:
            d = json.load(f)
    except Exception as ex:  # noqa: BLE001
        print(f'cannot read {path}: {ex}')
        return 1
    for k in ('season', 'week', 'fields', 'games', 'players', 'teams'):
        if k not in d:
            probs.append(f'missing {k}')
    n = len(d.get('fields', {}).get('pw', []))
    pos = defaultdict(int)
    for p in d.get('players', []):
        pos[p.get('p')] += 1
        for g in p.get('g', []):
            if len(g) != n:
                probs.append(f'{p["id"]} {p["n"]}: a week with {len(g)} fields, not {n}')
                break
    for k, lo in (('QB', 40), ('RB', 70), ('WR', 110), ('TE', 50), ('K', 25)):
        if pos[k] < lo:
            probs.append(f'only {pos[k]} {k}s')
    if len(d.get('teams', {})) < 30:
        probs.append(f'only {len(d.get("teams", {}))} teams')
    if len(d.get('games', [])) < 250:
        probs.append(f'only {len(d.get("games", []))} games')
    for p in probs:
        print(p)
    if not probs:
        print(f'ok: {len(d["players"])} players ({dict(pos)}), {len(d["teams"])} teams, {len(d["games"])} games, '
              f'study week {d["week"]["study"]}, {len(d.get("news", []))} headlines')
    return 1 if probs else 0


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'check':
        sys.exit(check(sys.argv[2] if len(sys.argv) > 2 else OUT))
    os.makedirs(OUTD, exist_ok=True)
    try:
        out = build()
    except Exception as ex:  # noqa: BLE001 - a core source failed: keep the last file as it is
        print(f'Film Room: a core source failed ({type(ex).__name__}: {ex}); kept the last film.json', file=sys.stderr)
        return 0
    body = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    tmp = OUT + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(body)
    os.replace(tmp, OUT)
    with open(LATEST, 'w', encoding='utf-8') as f:
        json.dump({'at': out['at'], 'study': out['week']['study'], 'live': out['week']['live']}, f)
    print(f'Film Room: {len(out["players"])} players, study week {out["week"]["study"]}, live week {out["week"]["live"]}, '
          f'{len(out["news"])} headlines, {len(body) // 1024} KB' + (f'; {len(errors)} source problems' if errors else ''))
    for e in errors:
        print('  ' + e)
    return 0


if __name__ == '__main__':
    sys.exit(main())
