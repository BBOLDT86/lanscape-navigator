"""Temporary: YouTube rebuild channels, auction-site feeds. Writes probe.json."""
import gzip, json, re, urllib.request
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
def get(u, h=None):
    req = urllib.request.Request(u, headers={'User-Agent': UA, 'Accept-Encoding': 'gzip', 'Accept-Language': 'en-US,en;q=0.9', **(h or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        b = r.read(); return r.status, (gzip.decompress(b) if b[:2] == b'\x1f\x8b' else b)
out = {'channels': {}, 'feeds': {}}
HANDLES = ['Goonzquad', 'Tavarish', 'RichRebuilds', 'MatArmstrongbmx', 'MatArmstrong', 'HooviesGarage', 'BisforBuild', 'NikoBrothers', 'SavingSalvage',
           'SalvageNation', 'VehicleVirgins', 'WatchJRGo', 'TheStradman', 'DougDeMuro', 'CarsandBids', 'bringatrailer', 'Hagerty', 'CarWizard', 'samcrac',
           'SalvageRebuilds', 'RebuildingDepot', 'TheSalvageGuy', 'BoostedBoiz', 'JunkyardDigs', 'VinWiki', 'EdBolian', 'Cleetus', 'WhistlinDiesel', 'CopartUSA']
for h in HANDLES:
    try:
        st, b = get(f'https://www.youtube.com/@{h}')
        t = b.decode('utf-8', 'replace')
        m = re.search(r'"externalId":"(UC[\w-]{22})"', t) or re.search(r'<link rel="canonical" href="https://www.youtube.com/channel/(UC[\w-]{22})"', t)
        title = re.search(r'<meta property="og:title" content="([^"]+)"', t)
        subs = re.search(r'"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"', t) or re.search(r'([\d.]+[KM]) subscribers', t)
        row = {'id': m.group(1) if m else None, 'title': title.group(1) if title else None, 'subs': subs.group(1) if subs else None}
        if m:
            st2, f = get(f'https://www.youtube.com/feeds/videos.xml?channel_id={m.group(1)}')
            ft = f.decode('utf-8', 'replace')
            row['feed'] = st2; row['latest'] = re.findall(r'<entry>.*?<title>([^<]+)</title>.*?<published>([^<]+)</published>', ft, re.S)[:3]
        out['channels'][h] = row
    except Exception as ex:
        out['channels'][h] = {'error': repr(ex)[:200]}
FEEDS = {'bat_feed': 'https://bringatrailer.com/feed/', 'bat_auctions': 'https://bringatrailer.com/auctions/feed/', 'cnb_feed': 'https://carsandbids.com/feed',
         'cnb_rss': 'https://carsandbids.com/rss', 'cnb_blog': 'https://carsandbids.com/blog/feed', 'hagerty': 'https://www.hagerty.com/media/feed/',
         'gn_bat': 'https://news.google.com/rss/search?q=site:bringatrailer.com+when:7d&hl=en-US&gl=US&ceid=US:en',
         'gn_cnb': 'https://news.google.com/rss/search?q=%22Cars+%26+Bids%22+OR+%22Bring+a+Trailer%22+sold+when:7d&hl=en-US&gl=US&ceid=US:en',
         'gn_fsd': 'https://news.google.com/rss/search?q=Tesla+FSD+OR+%22Full+Self-Driving%22+when:3d&hl=en-US&gl=US&ceid=US:en',
         'teslarati': 'https://www.teslarati.com/feed/', 'electrek': 'https://electrek.co/feed/', 'notateslaapp': 'https://www.notateslaapp.com/rss',
         'themealdb': 'https://www.themealdb.com/api/json/v1/1/filter.php?i=chicken_breast',
         'yt_dailyshow': 'https://www.youtube.com/feeds/videos.xml?channel_id=UCwWhs_6x42TyRM4Wstoq8HA',
         'yt_lwt': 'https://www.youtube.com/feeds/videos.xml?channel_id=UC3XTzVzaHQEd30rQbuvCtTQ',
         'yt_seth': 'https://www.youtube.com/feeds/videos.xml?channel_id=UCVTyTA7-g9nopHeHbeuvpRA',
         'yt_kimmel': 'https://www.youtube.com/feeds/videos.xml?channel_id=UCa6vGFO9ty8v5KZJXQxdhaw'}
for k, u in FEEDS.items():
    try:
        st, b = get(u); t = b.decode('utf-8', 'replace')
        out['feeds'][k] = {'status': st, 'len': len(b), 'items': len(re.findall(r'<item|<entry', t)), 'titles': re.findall(r'<title>(?:<!\[CDATA\[)?([^<\]]+)', t)[:5], 'head': t[:300]}
    except Exception as ex:
        out['feeds'][k] = {'error': repr(ex)[:200]}
json.dump(out, open('probe.json', 'w'), indent=1)
print('done')
