import json, os, urllib.request, urllib.error, gzip, time
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
J = 'https://api.jolpi.ca/ergast/f1/'
O = 'https://api.openf1.org/v1/'
URLS = {
 'j.cal': J + '2026.json', 'j.drivers': J + '2026/drivers.json', 'j.cons': J + '2026/constructors.json',
 'j.res0': J + '2026/results.json?limit=100&offset=0', 'j.res1': J + '2026/results.json?limit=100&offset=100',
 'j.dst': J + '2026/driverstandings.json', 'j.cst': J + '2026/constructorstandings.json',
 'j.q': J + '2026/qualifying.json?limit=100', 'j.sprint': J + '2026/sprint.json?limit=100',
 'j.last': J + 'current/last/results.json', 'j.laps': J + 'current/last/laps.json?limit=100', 'j.pits': J + 'current/last/pitstops.json?limit=100',
 'j.circuits': J + '2026/circuits.json', 'j.career': J + 'drivers/alonso/results/1.json?limit=1', 'j.titles': J + 'drivers/hamilton/driverstandings/1.json?limit=30',
 'o.sessions': O + 'sessions?year=2026', 'o.drivers': O + 'drivers?session_key=latest', 'o.meet': O + 'meetings?year=2026',
 'o.stints': O + 'stints?session_key=latest', 'o.rc': O + 'race_control?session_key=latest', 'o.weather': O + 'weather?session_key=latest',
 'o.result': O + 'session_result?session_key=latest', 'o.grid': O + 'starting_grid?session_key=latest', 'o.overtakes': O + 'overtakes?session_key=latest',
 'f.f1': 'https://www.formula1.com/en/latest/all.xml', 'f.bbc': 'https://feeds.bbci.co.uk/sport/formula1/rss.xml',
 'f.autosport': 'https://www.autosport.com/rss/f1/news/', 'f.msport': 'https://www.motorsport.com/rss/f1/news/',
 'f.race': 'https://www.the-race.com/feed/', 'f.racefans': 'https://www.racefans.net/feed/', 'f.planet': 'https://www.planetf1.com/feed',
 'f.guardian': 'https://www.theguardian.com/sport/formulaone/rss', 'f.gn': 'https://news.google.com/rss/search?q=%22Formula+1%22+when:2d&hl=en-US&gl=US&ceid=US:en',
 'f.ge': 'https://ge.globo.com/dynamo/motor/formula-1/rss2.xml', 'f.mst': 'https://www.motorsport-total.com/rss/formel1.xml',
 'f.amus': 'https://www.auto-motor-und-sport.de/formel-1/rss.xml', 'f.gp': 'https://www.grandepremio.com.br/feed/',
 'f.espn': 'https://www.espn.com/espn/rss/f1/news', 'f.crash': 'https://www.crash.net/rss/f1', 'f.skyf1': 'https://www.skysports.com/rss/12433',
 'y.f1': 'https://www.youtube.com/feeds/videos.xml?channel_id=UCB_qr75-ydFVKSF9Dmo6izg',
 'w.espnf1': 'https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard',
 'l.f1timing': 'https://livetiming.formula1.com/static/2026/Index.json',
}
out = {}
os.makedirs('out/body', exist_ok=True)
for name, url in URLS.items():
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Origin': 'https://bboldt86.github.io', 'Accept': '*/*', 'Accept-Encoding': 'gzip'})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            b = r.read()
            if r.headers.get('Content-Encoding') == 'gzip':
                b = gzip.decompress(b)
            out[name] = {'status': r.status, 'acao': r.headers.get('Access-Control-Allow-Origin'), 'ct': r.headers.get('Content-Type'),
                         'len': len(b), 'ms': int((time.time() - t) * 1000), 'final': r.geturl()}
            open('out/body/' + name + '.txt', 'wb').write(b[:3_000_000])
    except urllib.error.HTTPError as e:
        out[name] = {'status': e.code, 'acao': e.headers.get('Access-Control-Allow-Origin'), 'err': str(e)}
    except Exception as e:
        out[name] = {'status': None, 'err': repr(e)[:300]}
    time.sleep(0.4 if name.startswith(('j.', 'o.')) else 0.05)
json.dump(out, open('out/result.json', 'w'), indent=1)
for k, v in out.items():
    print(k, v.get('status'), v.get('acao'), v.get('len'), v.get('err', ''))
