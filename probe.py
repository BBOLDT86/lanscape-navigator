import json, os, urllib.request, urllib.error, gzip, time, concurrent.futures as cf
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
ORIGIN = 'https://bboldt86.github.io'
E = 'https://site.api.espn.com/apis/site/v2/sports/'
S = 'https://site.api.espn.com/apis/v2/sports/'
LG = {'nfl': 'football/nfl', 'nba': 'basketball/nba', 'nhl': 'hockey/nhl', 'mlb': 'baseball/mlb', 'wnba': 'basketball/wnba',
      'mls': 'soccer/usa.1', 'epl': 'soccer/eng.1', 'liga': 'soccer/esp.1', 'ucl': 'soccer/uefa.champions', 'seriea': 'soccer/ita.1',
      'bund': 'soccer/ger.1', 'ligue1': 'soccer/fra.1', 'f1': 'racing/f1'}
URLS = {}
for k, p in LG.items():
    URLS[k + '.score'] = E + p + '/scoreboard'
    URLS[k + '.news'] = E + p + '/news?limit=30'
    URLS[k + '.stand'] = S + p + '/standings'
    URLS[k + '.teams'] = E + p + '/teams'
URLS['nfl.week'] = E + 'football/nfl/scoreboard?dates=20261029-20261102'
URLS['nba.range'] = E + 'basketball/nba/scoreboard?dates=20261026-20261101&limit=200'
URLS['mlb.post'] = E + 'baseball/mlb/scoreboard?dates=20261020-20261105&limit=200'
URLS['mls.range'] = E + 'soccer/usa.1/scoreboard?dates=20261020-20261210&limit=200'
URLS['epl.range'] = E + 'soccer/eng.1/scoreboard?dates=20261020-20261110&limit=200'
URLS['wnba.range'] = E + 'basketball/wnba/scoreboard?dates=20260901-20261031&limit=200'
URLS['nfl.summary'] = E + 'football/nfl/summary?event=401773030'
URLS['nfl.stand.group'] = S + 'football/nfl/standings?group=conference'
URLS['web.stand'] = 'https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings?region=us&lang=en&contentorigin=espn&type=0&level=3'
URLS['core.nfl'] = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/weeks/8/events'
URLS['nhle.score'] = 'https://api-web.nhle.com/v1/score/now'
URLS['nhle.stand'] = 'https://api-web.nhle.com/v1/standings/now'
URLS['nhle.sched'] = 'https://api-web.nhle.com/v1/schedule/now'
URLS['mlbapi.sched'] = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=2026-10-20&endDate=2026-11-05&hydrate=team,linescore,broadcasts(all),seriesStatus'
URLS['mlbapi.stand'] = 'https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2026'
URLS['nbacdn.today'] = 'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json'
URLS['nbacdn.sched'] = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json'
URLS['tsdb'] = 'https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4328'
FEEDS = {
    'cbs.nfl': 'https://www.cbssports.com/rss/headlines/nfl/', 'cbs.nba': 'https://www.cbssports.com/rss/headlines/nba/',
    'cbs.nhl': 'https://www.cbssports.com/rss/headlines/nhl/', 'cbs.mlb': 'https://www.cbssports.com/rss/headlines/mlb/',
    'cbs.wnba': 'https://www.cbssports.com/rss/headlines/wnba/', 'cbs.soccer': 'https://www.cbssports.com/rss/headlines/soccer/',
    'yahoo.nfl': 'https://sports.yahoo.com/nfl/rss/', 'yahoo.nba': 'https://sports.yahoo.com/nba/rss/', 'yahoo.nhl': 'https://sports.yahoo.com/nhl/rss/',
    'yahoo.mlb': 'https://sports.yahoo.com/mlb/rss/', 'yahoo.wnba': 'https://sports.yahoo.com/wnba/rss/', 'yahoo.soccer': 'https://sports.yahoo.com/soccer/rss/',
    'espn.rss.nfl': 'https://www.espn.com/espn/rss/nfl/news', 'nhl.com': 'https://www.nhl.com/rss/news', 'mlb.com': 'https://www.mlb.com/feeds/news/rss.xml',
    'pft': 'https://www.nbcsports.com/profootballtalk.rss', 'mlssoccer': 'https://www.mlssoccer.com/rss/news',
    'bbc.football': 'https://feeds.bbci.co.uk/sport/football/rss.xml', 'guardian.football': 'https://www.theguardian.com/football/rss',
    'gn.nfl': 'https://news.google.com/rss/search?q=NFL+when:1d&hl=en-US&gl=US&ceid=US:en',
    'gn.wnba': 'https://news.google.com/rss/search?q=WNBA+when:7d&hl=en-US&gl=US&ceid=US:en',
    'gn.espn.nba': 'https://news.google.com/rss/search?q=site:espn.com/nba+when:2d&hl=en-US&gl=US&ceid=US:en',
    'athletic': 'https://www.nytimes.com/athletic/rss/news/', 'athletic.nfl': 'https://www.nytimes.com/athletic/rss/nfl/',
    'ringer': 'https://www.theringer.com/rss/index.xml', 'si': 'https://www.si.com/rss/si_topstories.rss',
}
out = {}
os.makedirs('probe-out/body', exist_ok=True)
def hit(name, url, keep_full):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Origin': ORIGIN, 'Accept': '*/*', 'Accept-Encoding': 'gzip'})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            b = r.read()
            if r.headers.get('Content-Encoding') == 'gzip': b = gzip.decompress(b)
            o = {'status': r.status, 'acao': r.headers.get('Access-Control-Allow-Origin'), 'ct': r.headers.get('Content-Type'),
                 'cache': r.headers.get('Cache-Control'), 'len': len(b), 'ms': int((time.time() - t) * 1000), 'final': r.geturl(),
                 'head': b[:400].decode('utf-8', 'replace')}
            if keep_full: open('probe-out/body/' + name + '.txt', 'wb').write(b[:2_500_000])
            return name, o
    except urllib.error.HTTPError as e:
        return name, {'status': e.code, 'acao': e.headers.get('Access-Control-Allow-Origin'), 'err': str(e), 'ms': int((time.time() - t) * 1000)}
    except Exception as e:
        return name, {'status': None, 'err': repr(e)[:300]}
jobs = [(k, u, True) for k, u in URLS.items()] + [(k, u, True) for k, u in FEEDS.items()]
with cf.ThreadPoolExecutor(12) as ex:
    for name, o in ex.map(lambda j: hit(*j), jobs): out[name] = o
json.dump(out, open('probe-out/result.json', 'w'), indent=1)
for k, v in out.items(): print(k, v.get('status'), v.get('acao'), v.get('len'), v.get('ms'), v.get('err', ''))
