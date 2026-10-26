import json, os, urllib.request, urllib.error, gzip, time, concurrent.futures as cf
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
ORIGIN = 'https://bboldt86.github.io'
E = 'https://site.api.espn.com/apis/site/v2/sports/'
S = 'https://site.api.espn.com/apis/v2/sports/'
LG = {'nfl': 'football/nfl', 'nba': 'basketball/nba', 'nhl': 'hockey/nhl', 'mlb': 'baseball/mlb', 'wnba': 'basketball/wnba',
      'mls': 'soccer/usa.1', 'epl': 'soccer/eng.1', 'liga': 'soccer/esp.1', 'ucl': 'soccer/uefa.champions', 'seriea': 'soccer/ita.1',
      'bund': 'soccer/ger.1', 'ligue1': 'soccer/fra.1', 'f1': 'racing/f1'}
URLS = {
 'nfl.wk8': E+'football/nfl/scoreboard?week=8&seasontype=2',
 'nfl.wk8y': E+'football/nfl/scoreboard?week=8&seasontype=2&dates=2026',
 'nfl.year': E+'football/nfl/scoreboard?dates=2026&seasontype=2&week=9',
 'nba.d1': E+'basketball/nba/scoreboard?dates=20261027',
 'nba.d1l': E+'basketball/nba/scoreboard?dates=20261027&limit=100',
 'nba.r2': E+'basketball/nba/scoreboard?dates=20261026-20261027',
 'nba.r2l': E+'basketball/nba/scoreboard?limit=1000&dates=20261026-20261028',
 'mlb.d1': E+'baseball/mlb/scoreboard?dates=20261027',
 'epl.d1': E+'soccer/eng.1/scoreboard?dates=20261101',
 'epl.r': E+'soccer/eng.1/scoreboard?dates=20261031-20261102',
 'mls.d1': E+'soccer/usa.1/scoreboard?dates=20261101',
 'nfl.sum': E+'football/nfl/summary?event=401873009',
 'nba.sum': E+'basketball/nba/summary?event=401909861',
 'mlb.sum': E+'baseball/mlb/summary?event=401908043',
 'epl.sum': E+'soccer/eng.1/summary?event=401879254',
 'nfl.tsched': E+'football/nfl/teams/21/schedule',
 'nba.tsched': E+'basketball/nba/teams/26/schedule',
 'nfl.tnews': E+'football/nfl/news?team=21&limit=10',
 'nfl.l3': 'https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?level=3',
 'nhl.l3': 'https://site.web.api.espn.com/apis/v2/sports/hockey/nhl/standings?level=3',
 'mlb.l3': 'https://site.web.api.espn.com/apis/v2/sports/baseball/mlb/standings?level=3',
 'mlb.l3s': 'https://site.web.api.espn.com/apis/v2/sports/baseball/mlb/standings?level=3&season=2026&seasontype=2',
 'nfl.v2l3': S+'football/nfl/standings?level=3',
 'wnba.post': E+'basketball/wnba/scoreboard?dates=20261021',
 'wnba.sum': E+'basketball/wnba/summary?event=W401909861',
 'mlb.d24': E+'baseball/mlb/scoreboard?dates=20261024',
 'nfl.rank': E+'football/nfl/scoreboard?dates=20261101',
 'cfb': E+'football/college-football/scoreboard',
 'f1.cal': 'https://sports.core.api.espn.com/v2/sports/racing/leagues/f1/calendar/ondays',
}
FEEDS0 = {
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
FEEDS = {'gn.nfl2': 'https://news.google.com/rss/search?q=NFL&hl=en-US&gl=US&ceid=US:en', 'gn.top.sports': 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-US&gl=US&ceid=US:en', 'athletic.nba': 'https://www.nytimes.com/athletic/rss/nba/', 'athletic.nhl': 'https://www.nytimes.com/athletic/rss/nhl/', 'athletic.mlb': 'https://www.nytimes.com/athletic/rss/mlb/', 'athletic.soccer': 'https://www.nytimes.com/athletic/rss/football/', 'athletic.wnba': 'https://www.nytimes.com/athletic/rss/wnba/', 'athletic.mls': 'https://www.nytimes.com/athletic/rss/football/mls/'}
jobs = [(k, u, True) for k, u in URLS.items()] + [(k, u, True) for k, u in FEEDS.items()]
with cf.ThreadPoolExecutor(12) as ex:
    for name, o in ex.map(lambda j: hit(*j), jobs): out[name] = o
json.dump(out, open('probe-out/result.json', 'w'), indent=1)
for k, v in out.items(): print(k, v.get('status'), v.get('acao'), v.get('len'), v.get('ms'), v.get('err', ''))
