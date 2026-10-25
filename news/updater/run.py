#!/usr/bin/env python3
"""The Watch's updater: reads the feeds in news/data/feeds.json and writes one edition of the paper.

  python3 news/updater/run.py            build the current watch's edition, unless it already exists
  python3 news/updater/run.py --force    build it anyway (a manual run)
  python3 news/updater/run.py --offline  rebuild from the last edition's stories, no network (for tuning)
  python3 news/updater/run.py --fixture DIR   read saved feed XML from DIR/<feed name>.xml (tests)

An edition is named for the ship's watch it opens, Eastern time: Middle (12 a.m.), Morning (4 a.m.),
Forenoon (8 a.m.), Afternoon (12 p.m.), Dog (4 p.m.) and First (8 p.m.). The workflow runs at both the
EDT and the EST hour of each watch; whichever run finds the watch without an edition builds it.

Writes news/data/edition.json (the paper), news/data/latest.json (a tiny file the open page polls) and a copy of
the edition in news/data/editions/ (the last seven are kept). Titles are the outlets' own; summaries are the feeds'
own short descriptions, clipped. Nothing is invented: a feed that fails is skipped and listed in the edition.
Standard library only (it runs on a bare GitHub Actions runner).
"""
import concurrent.futures as cf
import datetime as dt
import email.utils
import gzip
import hashlib
import html
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.normpath(os.path.join(HERE, '..', 'data'))
ARCH = os.path.join(D, 'editions')
ETZ = ZoneInfo('America/New_York')
ARGS = sys.argv[1:]
FORCE = '--force' in ARGS
OFFLINE = '--offline' in ARGS
FIXTURE = ARGS[ARGS.index('--fixture') + 1] if '--fixture' in ARGS else None
NOW = dt.datetime.now(dt.timezone.utc)
if '--now' in ARGS:  # tests: pretend it is this moment (ISO)
    NOW = dt.datetime.fromisoformat(ARGS[ARGS.index('--now') + 1].replace('Z', '+00:00'))
NOW_MIN = int(NOW.timestamp() // 60)

UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 TheWatch/1.0 (+https://bboldt86.github.io/lanscape-navigator/news/)',
      'Accept': 'application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip'}

WATCHES = [(0, 'middle', 'Middle Watch'), (4, 'morning', 'Morning Watch'), (8, 'forenoon', 'Forenoon Watch'),
           (12, 'afternoon', 'Afternoon Watch'), (16, 'dog', 'Dog Watch'), (20, 'first', 'First Watch')]
SECTIONS = [('us', 'U.S.'), ('world', 'World'), ('europe', 'Europe'), ('brazil', 'Brazil'), ('politics', 'Politics'), ('business', 'Business'), ('household', 'Household'), ('home', 'Home'), ('tech', 'Tech'),
            ('science', 'Science'), ('health', 'Health'), ('sports', 'Sports'), ('culture', 'Culture'), ('cars', 'Cars'),
            ('travel', 'Travel'), ('food', 'Food'), ('longreads', 'Long reads')]
SLOW = {'cars', 'travel', 'food', 'longreads', 'home'}
WINDOW_H = {'default': 36, 'slow': 96}
WINDOW_BY_SEC = {'brazil': 72, 'household': 72}  # fewer English-language stories a day, so they stay up longer
CAP = {'us': 100, 'world': 100, 'europe': 90, 'brazil': 70, 'household': 60, 'home': 60, 'politics': 80, 'business': 90, 'tech': 90, 'science': 55, 'health': 45, 'sports': 100,
       'culture': 70, 'cars': 45, 'travel': 40, 'food': 35, 'longreads': 35}
SNIP = 210

# ------------------------------------------------------------------ outlets
OUTLETS = {
    'apnews.com': 'AP', 'reuters.com': 'Reuters', 'nytimes.com': 'The New York Times', 'washingtonpost.com': 'The Washington Post',
    'wsj.com': 'The Wall Street Journal', 'bbc.com': 'BBC', 'npr.org': 'NPR', 'bloomberg.com': 'Bloomberg', 'theguardian.com': 'The Guardian',
    'cnn.com': 'CNN', 'cbsnews.com': 'CBS News', 'abcnews.go.com': 'ABC News', 'nbcnews.com': 'NBC News', 'foxnews.com': 'Fox News',
    'pbs.org': 'PBS News', 'csmonitor.com': 'The Christian Science Monitor', 'axios.com': 'Axios', 'thehill.com': 'The Hill',
    'politico.com': 'Politico', 'washingtonexaminer.com': 'Washington Examiner', 'aljazeera.com': 'Al Jazeera', 'dw.com': 'DW',
    'france24.com': 'France 24', 'cnbc.com': 'CNBC', 'marketwatch.com': 'MarketWatch', 'finance.yahoo.com': 'Yahoo Finance',
    'fortune.com': 'Fortune', 'ft.com': 'Financial Times', 'theverge.com': 'The Verge', 'arstechnica.com': 'Ars Technica',
    'techcrunch.com': 'TechCrunch', 'wired.com': 'Wired', 'engadget.com': 'Engadget', 'technologyreview.com': 'MIT Technology Review',
    '9to5mac.com': '9to5Mac', '404media.co': '404 Media', 'news.ycombinator.com': 'Hacker News', 'sciencedaily.com': 'ScienceDaily',
    'space.com': 'Space.com', 'nasa.gov': 'NASA', 'quantamagazine.org': 'Quanta', 'newscientist.com': 'New Scientist',
    'livescience.com': 'Live Science', 'statnews.com': 'STAT', 'kffhealthnews.org': 'KFF Health News', 'espn.com': 'ESPN',
    'cbssports.com': 'CBS Sports', 'sports.yahoo.com': 'Yahoo Sports', 'variety.com': 'Variety', 'hollywoodreporter.com': 'The Hollywood Reporter',
    'deadline.com': 'Deadline', 'rollingstone.com': 'Rolling Stone', 'pitchfork.com': 'Pitchfork', 'indiewire.com': 'IndieWire',
    'caranddriver.com': 'Car and Driver', 'roadandtrack.com': 'Road & Track', 'motor1.com': 'Motor1', 'jalopnik.com': 'Jalopnik',
    'thedrive.com': 'The Drive', 'electrek.co': 'Electrek', 'insideevs.com': 'InsideEVs', 'autoblog.com': 'Autoblog',
    'thepointsguy.com': 'The Points Guy', 'onemileatatime.com': 'One Mile at a Time', 'viewfromthewing.com': 'View from the Wing',
    'simpleflying.com': 'Simple Flying', 'cntraveler.com': 'Condé Nast Traveler', 'skift.com': 'Skift', 'eater.com': 'Eater',
    'bonappetit.com': 'Bon Appétit', 'smittenkitchen.com': 'Smitten Kitchen', 'food52.com': 'Food52', 'theatlantic.com': 'The Atlantic',
    'newyorker.com': 'The New Yorker', 'propublica.org': 'ProPublica', 'aeon.co': 'Aeon', 'longreads.com': 'Longreads',
    'usatoday.com': 'USA Today', 'latimes.com': 'Los Angeles Times', 'nypost.com': 'New York Post', 'newsweek.com': 'Newsweek',
    'time.com': 'Time', 'economist.com': 'The Economist', 'forbes.com': 'Forbes', 'businessinsider.com': 'Business Insider',
    'theathletic.com': 'The Athletic', 'kiplinger.com': 'Kiplinger', 'nerdwallet.com': 'NerdWallet', 'money.com': 'Money', 'clark.com': 'Clark Howard',
    'thepennyhoarder.com': 'The Penny Hoarder', 'realtor.com': 'Realtor.com', 'redfin.com': 'Redfin', 'housingwire.com': 'HousingWire',
    'inman.com': 'Inman', 'curbed.com': 'Curbed', 'apartmenttherapy.com': 'Apartment Therapy', 'architecturaldigest.com': 'Architectural Digest',
    'thisoldhouse.com': 'This Old House', 'politico.eu': 'Politico Europe', 'euronews.com': 'Euronews',
    'kyivindependent.com': 'The Kyiv Independent', 'euractiv.com': 'Euractiv', 'brazilian.report': 'The Brazilian Report',
    'agenciabrasil.ebc.com.br': 'Agência Brasil', 'riotimesonline.com': 'The Rio Times', 'en.mercopress.com': 'MercoPress', 'si.com': 'Sports Illustrated', 'nfl.com': 'NFL.com', 'mlb.com': 'MLB.com', 'nba.com': 'NBA.com',
}
TIER1 = {'apnews.com', 'reuters.com', 'nytimes.com', 'washingtonpost.com', 'wsj.com', 'bbc.com', 'npr.org', 'bloomberg.com',
         'theguardian.com', 'axios.com', 'cbsnews.com', 'nbcnews.com', 'abcnews.go.com', 'pbs.org', 'ft.com', 'politico.com', 'cnn.com'}
DOMAIN_ALIAS = {'bbc.co.uk': 'bbc.com', 'edition.cnn.com': 'cnn.com', 'nyti.ms': 'nytimes.com', 'news.yahoo.com': 'yahoo.com',
                'amp.theguardian.com': 'theguardian.com', 'uk.reuters.com': 'reuters.com', 'apnews.com': 'apnews.com'}


def norm_domain(u):
    try:
        h = urllib.parse.urlsplit(u if '://' in u else 'https://' + u).hostname or ''
    except ValueError:
        return ''
    h = h.lower()
    for p in ('www.', 'm.', 'rss.', 'feeds.', 'amp.', 'edition.'):
        if h.startswith(p) and h.count('.') > 1:
            h = h[len(p):]
    return DOMAIN_ALIAS.get(h, h)


# ------------------------------------------------------------------ text helpers
TAG = re.compile(r'<[^>]+>')
WS = re.compile(r'\s+')
BOILER = [re.compile(p, re.I) for p in (
    r'the post .{0,200}? appeared first on .{0,120}?\.?$', r'continue reading\W*$', r'read more\W*$', r'\[\s*(…|\.\.\.|&#8230;)\s*\]',
    r'\(?\s*(full story|read the full story|click here).*$', r'\b(get our|sign up (for|to)|subscribe to|download the|follow us on|listen to the)\b.*$', r'^\s*(by|from)\s+[A-Z][^.]{0,60}\s{2,}', r'[\[\(]?\s*(?:Photo|Image|Video)\s*:.*?(?:\]|\)|$)')]
JUNK_TITLE = re.compile(r"\b(wordle|connections hints?|strands hints?|crossword|horoscope|spelling bee|promo code|bonus code|coupon|deals? of the day|"
                        r"best .{0,40} deals|deals on|shop the|on sale now|sale is back|% off|prime day|black friday deals?|cyber monday deals?|giveaway|sponsored|"
                        r"lottery numbers|powerball numbers|mega millions numbers|betting offer|odds boost|this week on)\b", re.I)
JUNK_URL = re.compile(r'/(opinion|opinions|commentisfree|video|videos|podcasts?|live-news|newsletters?|cartoons?|crosswords?|games|puzzles|coupons|deals|shopping|select|sponsored|betting|weather/forecast)(/|$)', re.I)


def clean(s):
    if not s:
        return ''
    s = html.unescape(s)
    # list items and paragraphs keep a sentence break, so "Spain and Albania" and "Jesse, 40" don't run together
    s = re.sub(r'(?i)\s*(?:</(?:li|p|h[1-6]|div|blockquote)>|<br\s*/?>)\s*', '\x00', s)
    s = html.unescape(TAG.sub(' ', s))
    s = re.sub(r'\s*\x00[\s\x00]*', '\x00', s).strip('\x00 ')
    s = re.sub(r'([.!?:;…"”’)\]])\x00', r'\1 ', s).replace('\x00', '. ')
    s = s.replace(' ', ' ').replace('​', '')
    return WS.sub(' ', s).strip()


def clip(s, n=SNIP):
    if len(s) <= n:
        return s
    cut = s[:n]
    m = re.search(r'^(.{%d,}[.!?])\s' % int(n * 0.55), cut)  # end at a sentence if one ends late enough
    if m:
        return m.group(1)
    return cut.rsplit(' ', 1)[0].rstrip(',;:—-') + '…'


def snippet(raw, title):
    s = clean(raw)
    for rx in BOILER:
        s = rx.sub('', s).strip()
    if not s or len(s) < 25:
        return ''
    tl = title.lower()[:60]
    if s.lower().startswith(tl):
        s = s[len(title):].lstrip(' .:-—|')
        if len(s) < 25:
            return ''
    return clip(s)


def canon_url(u):
    try:
        p = urllib.parse.urlsplit(u.strip())
    except ValueError:
        return u.strip()
    if 'news.google.com' in (p.hostname or ''):
        return urllib.parse.urlunsplit((p.scheme, p.netloc, p.path, '', ''))
    q = [(k, v) for k, v in urllib.parse.parse_qsl(p.query) if not re.match(r'(utm_|cmp|ref|src|ito|smid|mc_|ns_|ocid|fbclid|gclid|cid|partner|traffic_source|in_source|feed|rss)', k, re.I)]
    return urllib.parse.urlunsplit(('https' if p.scheme in ('http', 'https') else p.scheme, (p.netloc or '').lower(), p.path, urllib.parse.urlencode(q), ''))


def ident(u):
    return hashlib.sha1(canon_url(u).encode('utf-8')).hexdigest()[:10]


def parse_date(s):
    if not s:
        return None
    s = s.strip()
    try:
        d = email.utils.parsedate_to_datetime(s)
    except (TypeError, ValueError, IndexError):
        d = None
    if d is None:
        try:
            d = dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
        except ValueError:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d.astimezone(dt.timezone.utc)


# ------------------------------------------------------------------ feeds
MRSS = '{http://search.yahoo.com/mrss/}'


def local(tag):
    return tag.split('}')[-1] if isinstance(tag, str) else ''


def upgrade_img(u):
    if not u:
        return ''
    u = html.unescape(u.strip())
    if u.startswith('//'):
        u = 'https:' + u
    if not u.startswith('http'):
        return ''
    if re.search(r'(pixel|spacer|1x1|blank\.gif|feedburner|gravatar|emoji|/ads?/|doubleclick|share-button|logo)', u, re.I):
        return ''
    u = re.sub(r'(ichef\.bbci\.co\.uk/(?:ace/)?(?:standard|news))/\d{2,4}/', r'\1/800/', u)
    if u.startswith('http://'):
        u = 'https://' + u[7:]
    return u


def entry_image(e):
    best, bw = '', -1
    for el in e.iter():
        n = local(el.tag)
        url = el.get('url') or ''
        if el.tag.startswith(MRSS) and n in ('content', 'thumbnail') and url:
            med = (el.get('medium') or '').lower(); typ = (el.get('type') or '').lower()
            if n == 'content' and med and med != 'image':
                continue
            if n == 'content' and typ and not typ.startswith('image'):
                continue
            try:
                w = int(el.get('width') or 0)
            except ValueError:
                w = 0
            w = w or (300 if n == 'thumbnail' else 600)
            if w > bw:
                best, bw = url, w
        elif n == 'enclosure' and url and (el.get('type') or '').lower().startswith('image') and bw < 500:
            best, bw = url, 500
    if not best:
        for el in e.iter():
            if local(el.tag) in ('description', 'encoded', 'content', 'summary') and el.text and '<img' in el.text:
                m = re.search(r'<img[^>]+src=["\']([^"\']+)', el.text)
                if m:
                    best = m.group(1); break
    return upgrade_img(best)


def child_text(e, *names):
    for n in names:
        for el in e:
            if local(el.tag) == n:
                if n == 'link' and el.get('href') and (el.get('rel') in (None, 'alternate')):
                    return el.get('href')
                t = (el.text or '').strip()
                if t:
                    return t
    return ''


def fetch_raw(url, name):
    if FIXTURE:
        fp = os.path.join(FIXTURE, re.sub(r'[^A-Za-z0-9]+', '_', name) + '.xml')
        if not os.path.exists(fp):
            raise FileNotFoundError(fp)
        return open(fp, 'rb').read()
    req = urllib.request.Request(url, headers=UA)
    last = None
    for attempt in (1, 2):
        try:
            with urllib.request.urlopen(req, timeout=18) as r:
                raw = r.read(6_000_000)
                if (r.headers.get('Content-Encoding') or '').lower() == 'gzip' or raw[:2] == b'\x1f\x8b':
                    raw = gzip.decompress(raw)
            break
        except urllib.error.HTTPError as ex:
            last = ex
            if attempt == 1 and ex.code >= 500:
                time.sleep(2); continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as ex:
            last = ex
            if attempt == 1:
                time.sleep(2); continue
            raise
    else:
        raise last
    raw = raw.lstrip(b'\xef\xbb\xbf \t\r\n')
    head = raw[:400].lower()
    if head.startswith(b'<!doctype html') or head.startswith(b'<html') or b'<html' in head[:150]:
        raise ValueError('returned a web page, not a feed (moved, or a bot check)')
    return raw


def read_feed(f):
    """-> (feed name, [raw items], error or None)"""
    name, url = f.get('name') or f['url'], f['url']
    try:
        raw = fetch_raw(url, name)
        try:
            root = ET.fromstring(raw)
        except ET.ParseError:
            root = ET.fromstring(re.sub(rb'&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)', b'&amp;', raw))  # stray ampersands
    except FileNotFoundError:
        return name, [], None
    except Exception as ex:  # noqa: BLE001 - a broken feed must never stop the paper
        return name, [], f'{type(ex).__name__}: {str(ex)[:120]}'
    out = []
    google = 'news.google.com' in url
    for e in root.iter():
        if local(e.tag) not in ('item', 'entry'):
            continue
        title = clean(child_text(e, 'title'))
        link = child_text(e, 'link') or ''
        if not link:
            g = child_text(e, 'guid', 'id')
            link = g if g.startswith('http') else ''
        when = parse_date(child_text(e, 'pubDate', 'published', 'updated', 'date', 'issued'))
        desc = child_text(e, 'description', 'summary') or child_text(e, 'encoded', 'content')
        src_name, src_url = '', ''
        for el in e:
            if local(el.tag) == 'source':
                src_name, src_url = clean(el.text or ''), el.get('url') or ''
        out.append({'title': title, 'link': link.strip(), 'when': when, 'desc': desc or '', 'img': entry_image(e),
                    'src_name': src_name, 'src_url': src_url, 'google': google,
                    'comments': child_text(e, 'comments')})
    return name, out, None


# ------------------------------------------------------------------ sections
PATH_SECTION = [  # desks before world before U.S.: NYT files politics under /us/politics/
    (r'/(real-?estate|realestate|homes?|housing|home-improvement|home-design|interiors|renovation|mortgages?)(/|$)', 'home'),
    (r'/(your-money|personal-finance|personalfinance|moneywatch/personal|consumer|money/(?!markets))(/|$)', 'household'),
    (r'/(politics|elections?|news/politics|newshour/politics|campaign|congress|white-house|supreme-court)(/|$)', 'politics'),
    (r'/(business|economy|markets|money|dealbook|your-money|finance|moneywatch|newshour/economy|personal-finance|real-estate|investing)(/|$)', 'business'),
    (r'/(technology|tech|science/technology|personaltech|gadgets|ai|innovation|cybersecurity)(/|$)', 'tech'),
    (r'/(science|space|climate|environment|newshour/science|weather)(/|$)', 'science'),
    (r'/(health|well|wellness|medicine|newshour/health|health-news)(/|$)', 'health'),
    (r'/(sports?|football|soccer|nfl|nba|mlb|nhl|ncaa|golf|tennis|college-football|basketball|baseball|hockey|olympics|motorsport|formula1|cricket|rugby-union)(/|$)', 'sports'),
    (r'/(arts|culture|entertainment|movies|film|music|television|tv|books|theater|pop-culture|celebrity|style|newshour/arts|the-culture|tv-and-radio|stage|games)(/|$)', 'culture'),
    (r'/(travel)(/|$)', 'travel'),
    (r'/(food|food-drink|dining|cooking|recipes|restaurants|wine)(/|$)', 'food'),
    (r'/(automobiles|cars|autos|wheels|car-reviews)(/|$)', 'cars'),
    (r'/(world|international|europe|asia|africa|middleeast|middle-east|americas|asia-pacific|uk-news|australia-news|global|news/world|newshour/world|canada|mexico|china|ukraine|israel)(/|$)', 'world'),
    (r'/(us-news|us|u-s|nation|national|news/us-news|newshour/nation|usa)(/|$)', 'us'),
]
PATH_SECTION = [(re.compile(p, re.I), s) for p, s in PATH_SECTION]


def _rx(words, plurals=False):
    if plurals:  # "Cuban" and "Cubans"
        words = [w + 's?' if w.isalpha() and not w.endswith('s') else w for w in words]
    return re.compile(r'\b(' + '|'.join(words) + r')\b', re.I)


# team names that are not also everyday words ("bills", "giants", "jets", "heat" and "nationals" are left out)
NFL = 'ravens bengals browns cowboys broncos packers colts steelers 49ers seahawks buccaneers bucs'.split()
NBA = 'celtics knicks 76ers sixers raptors cavaliers cavs pistons pacers timberwolves clippers lakers mavericks mavs grizzlies pelicans nuggets'.split()
MLB = ['yankees', 'red sox', 'orioles', 'blue jays', 'white sox', 'astros', 'mariners', 'braves', 'marlins', 'mets', 'phillies', 'cubs', 'brewers', 'dodgers', 'padres', 'diamondbacks', 'rockies']
SECTION_WORDS = {
    'sports': _rx(['nfl', 'nba', 'mlb', 'nhl', 'wnba', 'mls', 'ncaa', 'quarterback', 'touchdown', 'playoffs?', 'world series', 'super bowl',
                   'head coach', 'innings?', 'rookie', 'draft pick', 'premier league', 'champions league', 'la liga', 'serie a', 'bundesliga',
                   'pga', 'lpga', 'wimbledon', 'us open', 'ufc', 'formula 1', 'f1', 'grand prix', 'nascar', 'olympics?', 'heisman',
                   'buckeyes', 'stanley cup', 'hat trick', 'striker', 'goalkeeper', 'home runs?', 'pitcher', 'linebacker', 'wide receiver',
                   'running back', 'point guard', 'free agent', 'trade deadline', 'college football', 'march madness', 'ryder cup', 'touchdowns?', 'game \\d',
                   'roster', 'top-\\d+', 'cfb', 'week \\d+', 'wnba finals', 'wwe', 'boxing', 'title fight', 'knockout', 'tennis', 'season-ending', 'injury report']
                  + NFL + NBA + [t.replace(' ', r'\s') for t in MLB]),
    'politics': _rx(['senate', 'senators?', 'house speaker', 'congress', 'congressional', 'lawmakers?', 'gop', 'democrats?', 'republicans?',
                     'white house', 'campaign', 'elections?', 'ballots?', 'midterms?', 'governor', 'impeach\\w*', 'filibuster', 'cabinet',
                     'administration', 'executive order', 'legislation', 'bill passes', 'vote on', 'voters', 'polls? show', 'primary',
                     'shutdown', 'pentagon', 'state department', 'attorney general', 'doj', 'justice department', 'supreme court', 'mamdani',
                     'trump', 'vance', 'pelosi', 'schumer', 'thune', 'jeffries', 'johnson']),
    'business': _rx(['stocks?', 'dow', 's&p 500', 'nasdaq', 'earnings', 'shares', 'investors?', 'wall street', 'the fed', 'federal reserve',
                     'interest rates?', 'inflation', 'economy', 'economic', 'jobs report', 'unemployment', 'tariffs?', 'merger', 'acquisition',
                     'acquire', 'ipo', 'ceo', 'revenue', 'profit', 'layoffs?', 'banks?', 'oil prices?', 'retail', 'gdp',
                     'billion', 'deal', 'startup', 'bitcoin', 'crypto', 'treasury yields?', 'bond market', 'bond yields?', 'sales', 'consumers?']),
    'household': _rx(['groceries', 'grocery', 'grocery prices', 'egg prices', 'gas prices', 'utility bills?', 'electric bills?', 'energy bills?',
                      'heating bills?', 'tax refunds?', 'tax brackets?', 'irs', 'credit cards?', 'credit scores?', 'savings accounts?', 'budget(ing)?',
                      'insurance premiums?', 'car insurance', 'health insurance premiums', 'social security', 'open enrollment', '401\\(k\\)', 'ira',
                      'retirement savings', 'student loans?', 'child ?care', 'cost of living', 'paycheck', 'household', 'shoppers', 'holiday shopping',
                      'black friday', 'coupons?', 'price hikes?', 'subscriptions?', 'snap benefits', 'food stamps', 'medicare premiums', 'personal finance']),
    'home': _rx(['mortgages?', 'mortgage rates?', 'home sales', 'housing market', 'home prices', 'home values?', 'real estate', 'homebuyers?',
                 'home ?buyers?', 'homeowners?', 'listings?', 'realtors?', 'renovations?', 'remodel\\w*', 'kitchens?', 'bathrooms?', 'contractors?',
                 'hoa', 'property taxes', 'rent(ers|al)?', 'landlords?', 'condos?', 'starter homes?', 'zillow', 'redfin', 'home improvement',
                 'interior design', 'gardens?', 'backyard', 'curb appeal', 'square feet', 'bedrooms?']),
    'tech': _rx(['ai', 'a\\.i', 'artificial intelligence', 'openai', 'chatgpt', 'anthropic', 'google', 'apple', 'microsoft', 'meta', 'nvidia',
                 'chips?', 'semiconductors?', 'software', 'apps?', 'iphone', 'android', 'cyber\\w*', 'hack(s|ed|ers?|ing)?', 'data breach', 'tiktok',
                 'amazon', 'robots?', 'robotics', 'algorithm', 'smartphone', 'gaming', 'xbox', 'playstation', 'nintendo', 'elon musk',
                 'spacex', 'starlink', 'quantum', 'silicon valley', 'tech companies', 'big tech', 'tech giants?']),
    'science': _rx(['nasa', 'space', 'scientists?', 'study finds', 'researchers?', 'fossils?', 'species', 'climate', 'asteroid', 'telescope',
                    'physics', 'dinosaurs?', 'planets?', 'astronomers?', 'archaeolog\\w*', 'evolution', 'galaxy', 'comet', 'moon', 'mars',
                    'eclipse', 'genome', 'experiment', 'ocean', 'glacier', 'volcano', 'earthquake', 'hurricane', 'wildfire', 'tornado']),
    'health': _rx(['health', 'covid', 'flu', 'vaccines?', 'cdc', 'fda', 'cancer', 'disease', 'medicaid', 'medicare', 'hospitals?', 'drugs?',
                   'outbreak', 'measles', 'obesity', 'alzheimer\\w*', 'mental health', 'overdose', 'doctors?', 'patients?', 'diet', 'sleep',
                   'diabetes', 'ozempic', 'wegovy', 'glp-1', 'rfk', 'kennedy jr', 'nurses?', 'surgery', 'virus']),
    'culture': _rx(['movies?', 'films?', 'box office', 'album', 'singer', 'actor', 'actress', 'series', 'netflix', 'hbo', 'streaming', 'oscars?',
                    'grammys?', 'emmys?', 'broadway', 'concert', 'tour', 'celebrity', 'rapper', 'marvel', 'novel', 'books?', 'director',
                    'trailer', 'sitcom', 'disney', 'premiere', 'taylor swift', 'beyonc\\w*', 'musician', 'band', 'comedian', 'snl', 'tv']),
    'cars': _rx(['cars?', 'suvs?', 'sedan', 'pickup trucks?', 'evs?', 'electric vehicles?', 'ford', 'gm', 'chevrolet', 'toyota', 'honda', 'porsche',
                 'ferrari', 'bmw', 'mercedes', 'audi', 'tesla', 'hyundai', 'kia', 'rivian', 'horsepower', 'dealership', 'automakers?']),
    'travel': _rx(['airlines?', 'flights?', 'airports?', 'tsa', 'faa', 'hotels?', 'cruise', 'passengers', 'travelers?', 'vacation', 'resort',
                   'tourists?', 'tourism', 'lounge', 'frequent flyer', 'boeing', 'airbus', 'delta air lines', 'united airlines', 'american airlines', 'southwest airlines']),
    'food': _rx(['recipes?', 'restaurants?', 'chefs?', 'cooking', 'baking', 'wine', 'cocktails?', 'thanksgiving dinner']),
    'world': _rx(plurals=True, words=['afghanistan', 'afghan', 'albania', 'albanian', 'algeria', 'algerian', 'angola', 'argentina', 'argentine', 'armenia', 'armenian', 'australia', 'australian', 'austria', 'austrian', 'azerbaijan', 'bahrain', 'bangladesh', 'bangladeshi', 'belarus', 'belarusian', 'belgium', 'belgian', 'bolivia', 'bolivian', 'bosnia', 'bosnian', 'brazil', 'brazilian', 'bulgaria', 'bulgarian', 'burkina', 'cambodia', 'cambodian', 'cameroon', 'canada', 'canadian', 'chile', 'chilean', 'china', 'chinese', 'colombia', 'colombian', 'congo', 'congolese', 'croatia', 'croatian', 'cuba', 'cuban', 'cyprus', 'czech', 'denmark', 'danish', 'ecuador', 'egypt', 'egyptian', 'eritrea', 'estonia', 'estonian', 'ethiopia', 'ethiopian', 'finland', 'finnish', 'france', 'french', 'germany', 'german', 'ghana', 'ghanaian', 'greece', 'greek', 'guatemala', 'guatemalan', 'haiti', 'haitian', 'honduras', 'hungary', 'hungarian', 'iceland', 'icelandic', 'india', 'indian', 'indonesia', 'indonesian', 'iran', 'iranian', 'iraq', 'iraqi', 'ireland', 'irish', 'israel', 'israeli', 'italy', 'italian', 'jamaica', 'jamaican', 'japan', 'japanese', 'jordanian', 'kazakhstan', 'kenya', 'kenyan', 'kosovo', 'kuwait', 'kuwaiti', 'kyrgyzstan', 'laos', 'latvia', 'lebanon', 'lebanese', 'liberia', 'libya', 'libyan', 'lithuania', 'lithuanian', 'madagascar', 'malawi', 'malaysia', 'malaysian', 'mali', 'malian', 'malta', 'moldova', 'mongolia', 'montenegro', 'morocco', 'moroccan', 'mozambique', 'myanmar', 'namibia', 'nepal', 'nepalese', 'netherlands', 'dutch', 'nicaragua', 'nigeria', 'nigerian', 'norway', 'norwegian', 'oman', 'pakistan', 'pakistani', 'palestinian', 'palestinians', 'panama', 'paraguay', 'peru', 'peruvian', 'philippines', 'philippine', 'filipino', 'portugal', 'portuguese', 'qatar', 'qatari', 'romania', 'romanian', 'russia', 'russian', 'rwanda', 'saudi', 'senegal', 'serbia', 'serbian', 'singapore', 'slovakia', 'slovenia', 'somalia', 'somali', 'spain', 'spanish', 'sudan', 'sudanese', 'sweden', 'swedish', 'switzerland', 'swiss', 'syria', 'syrian', 'taiwan', 'taiwanese', 'tajikistan', 'tanzania', 'thailand', 'thai', 'tunisia', 'uganda', 'ukraine', 'ukrainian', 'uae', 'uruguay', 'uzbekistan', 'vanuatu', 'venezuela', 'venezuelan', 'vietnam', 'vietnamese', 'yemen', 'yemeni', 'zambia', 'zimbabwe', 'kyiv', 'moscow', 'beijing', 'tehran', 'gaza', 'jerusalem', 'london', 'paris', 'berlin', 'madrid', 'tokyo', 'seoul', 'delhi', 'mumbai', 'islamabad', 'kabul', 'baghdad', 'damascus', 'beirut', 'cairo', 'istanbul', 'ankara', 'brussels', 'geneva', 'taipei', 'manila', 'bangkok', 'jakarta', 'sydney', 'toronto', 'ottawa', 'havana', 'caracas', 'bogota', 'lima', 'buenos', 'kremlin', 'hebron', 'europe', 'european', 'nato', 'erdogan', 'türkiye', 'new zealand', 'south africa', 'south sudan', 'sri lanka', 'north korea', 'north korean', 'south korea', 'south korean', 'hong kong', 'el salvador', 'costa rica', 'ivory coast', 'sierra leone', 'papua new guinea', 'united arab emirates', 'saudi arabia', 'tel aviv', 'mexico city', 'rio de janeiro', 'sao paulo', 'in jordan', 'amman', "turkey's", 'turkish', 'united nations', 'u\\.n', 'u\\.k', 'uk', 'britain', 'british', 'england', 'scotland', 'wales', 'west bank', 'prime minister', 'parliament', 'european union', 'eu', 'netanyahu', 'zelensky', 'zelenskyy', 'putin', 'xi jinping', 'modi', 'macron', 'starmer', 'merz', 'carney', 'sheinbaum', 'lula', 'bolsonaro', 'milei', 'maduro', 'kim jong un', 'pope', 'vatican', 'hamas', 'hezbollah', 'houthis?', 'taliban', 'caribbean', 'mexican', 'mexico']),
}
SERVICE = re.compile(r'\b(where to watch|how to watch|live ?stream|start time|tv channel|odds,? (picks|predictions)|predictions?,? odds|live (results|updates|blog|scores?)|play-by-play)\b', re.I)
BRAZIL = re.compile(r"\b(brazil\w*|brasil\w*|lula|bolsonaro|s[ãa]o paulo|rio de janeiro|bras[íi]lia|petrobras|embraer|haddad|alckmin|tarc[íi]sio|"
                    r"alexandre de moraes|amazon rainforest|the amazon|recife|salvador da bahia|belo horizonte|porto alegre|manaus|bel[ée]m|pt party|tse)\b", re.I)
EUROPE = re.compile(r"\b(europe|european\w*|(?-i:EU)|brussels|nato|u\.k|uk|britain|british|england|english channel|scotland|scottish|wales|welsh|"
                    r"northern ireland|ireland|irish|dublin|london|starmer|westminster|france|french|paris|macron|germany|german\w*|berlin|merz|"
                    r"italy|italian\w*|rome|milan|meloni|spain|spanish|madrid|barcelona|s[áa]nchez|portugal|portuguese|lisbon|netherlands|dutch|"
                    r"amsterdam|belgium|belgian|poland|warsaw|tusk|ukrain\w*|kyiv|kharkiv|odesa|zelensk\w*|russia\w*|moscow|kremlin|putin|"
                    r"greece|greek|athens|sweden|swedish|norway|norwegian|denmark|danish|finland|finnish|austria\w*|vienna|switzerland|swiss|"
                    r"hungary|hungarian|orb[áa]n|czech|prague|romania\w*|bulgaria\w*|serbia\w*|croatia\w*|slovakia\w*|slovenia\w*|baltic|"
                    r"estonia\w*|latvia\w*|lithuania\w*|moldova\w*|belarus\w*|albania\w*|kosovo|bosnia\w*|iceland\w*|von der leyen|vatican)\b", re.I)
REGIONS = (('brazil', BRAZIL), ('europe', EUROPE))


def region(title, desc):
    """the region desk a story belongs to, if any: (desk, strength)"""
    best, bn = None, 0
    for k, rx in REGIONS:
        n = 2 * len(rx.findall(title)) + len(rx.findall(desc))
        if n > bn:
            best, bn = k, n
    return (best, bn) if bn >= 2 else (None, 0)


# on a tie the more specific desk wins
DESKS = ('sports', 'household', 'home', 'politics', 'business', 'tech', 'science', 'health', 'culture', 'cars', 'travel', 'food')


def section_scores(title, desc):
    text = title + ' ' + title + ' ' + desc  # a word in the headline counts twice
    return {s: len(rx.findall(text)) for s, rx in SECTION_WORDS.items()}


def best_desk(sc):
    best = max(DESKS, key=lambda s: sc[s])
    return best, sc[best]


# Portuguese and German outlets file their stories under paths like these; a general feed's story moves to that desk
FOREIGN_PATH = [(re.compile(p, re.I), s) for p, s in (
    (r'/(mundo|internacional|ausland|international|welt)(/|$)', 'world'),
    (r'/(economia|mercado|mercados|financas|finan[cç]as|negocios|wirtschaft|finanzen|unternehmen|boerse|b[öo]rse)(/|$)', 'business'),
    (r'/(esporte|esportes|futebol|sport|fussball|fu[ßs]ball)(/|$)', 'sports'),
    (r'/(tecnologia|tec|digital|netzwelt|technik)(/|$)', 'tech'),
    (r'/(ciencia|ci[êe]ncia|wissen|wissenschaft)(/|$)', 'science'),
    (r'/(saude|sa[úu]de|gesundheit)(/|$)', 'health'),
    (r'/(cultura|kultur|pop-arte|entretenimento|panorama)(/|$)', 'culture'),
    (r'/(turismo-e-viagem|viagem|reise|reisen)(/|$)', 'travel'),
)]


def classify(feed_section, lean, link, title, desc, lang=None):
    """a story's section: its feed's desk; for a general feed, the outlet's URL path, its region, then the words in it"""
    if lang in ('pt', 'de'):  # an outlet writing in Portuguese or German: its feed's desk, unless its URL files it elsewhere
        path = urllib.parse.urlsplit(link).path if link else ''
        if feed_section in ('brazil', 'europe', 'world', 'auto'):
            for rx, sec in FOREIGN_PATH:
                if rx.search(path) and not (sec == 'world' and feed_section == 'world'):
                    return sec
        return feed_section if feed_section != 'auto' else ('brazil' if lang == 'pt' else 'europe')
    if feed_section == 'brazil' and not BRAZIL.search(title + ' ' + desc):
        feed_section = 'world'  # Brazil outlets also cover the rest of Latin America
    if feed_section in ('household', 'home') and 'news.google.com' in (link or ''):  # a search route also catches world news
        sc0 = section_scores(title, desc)
        if sc0['world'] >= 2 and sc0['world'] > sc0[feed_section]:
            return 'world'
    if feed_section not in ('auto', 'us', 'world'):
        return feed_section
    sc = section_scores(title, desc)
    best, n = best_desk(sc)
    path = urllib.parse.urlsplit(link).path if link else ''
    psec = next((s for rx, s in PATH_SECTION if rx.search(path)), None)
    if psec and psec not in ('politics', 'us', 'world'):  # the outlet filed it under sports, business, ...
        return psec
    reg, rn = region(title, desc)
    if reg:  # Brazil and Europe have desks of their own; a stronger topic (a match, a market) still wins
        nb = max((d for d in DESKS if d != 'politics'), key=lambda d: sc[d])
        return nb if sc[nb] > rn else reg
    if psec == 'politics':
        return 'politics'
    if feed_section in ('us', 'world'):  # a national or world feed: a strong signal moves a story to its desk
        need = 2 if feed_section == 'us' else 3
        return best if n >= need and n > sc['world'] else feed_section
    if psec:
        return psec
    if sc['world'] >= 2 and sc['world'] >= n:
        return 'world'
    if n >= 2:
        return best
    return lean or 'us'


# ------------------------------------------------------------------ topics and names
STOP = set('''a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those
he she they we you i his her their our your my me him them us who whom whose which what when where why how than then so not no nor
do does did done has have had having will would can could should may might must shall over under after before into onto out up down off
about above below again further once here there all any both each few more most other some such only own same too very just also now new
says said say saying tells told report reports reported amid among against between during while until upon via vs per like near
after-hours year years week weeks day days today tonight yesterday tomorrow time times first last next one two three four five six seven eight nine ten
monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december
jan feb mar apr jun jul aug sep sept oct nov dec get gets got make makes made take takes took could set sets back still even ever way ways
man woman men women people person thing things lot lots big small top best worst more less much many most least live update updates watch video
photos photo what's here's it's that's there's who's don't can't won't isn't aren't doesn't didn't wasn't
takeaways takeaway know explained explainer things key everything need inside latest breaking analysis review'''.split())
CAP_COMMON = set('''The A An And But Or How Why What When Where Who Which Is Are Was Were This That These Those It Its Here There Live Watch
Breaking Opinion Analysis Exclusive Inside Meet Review Photos Video Update Updates Report Explainer Live: First Last Top Best Why: How: What: As After Before
In On At For With From Of To By Up Down Out Over Under Into Can Could Should Would Will May Might Must Do Does Did Has Have Had Not No Yes More Most
Some Many All Every Each Our Your My We You They He She I Former Ex Is Are Says Said Here's What's It's Why's Today Tonight This Week Weekend
Morning Evening Daily Weekly Year Years Day Days Night After Amid Despite Inside Behind Beyond About Could Just Only Even Also Still Now Then'''.split())
GENERIC_ENT = {'u.s.', 'us', 'u.s', 'usa', 'america', 'american', 'americans', 'news', 'breaking', 'live', 'update', 'video', 'watch', 'report',
               'opinion', 'analysis', 'exclusive', 'photos', 'today', 'cbs', 'abc', 'nbc', 'npr', 'pbs', 'bbc', 'cnn', 'ap', 'fox', 'the',
               'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april', 'june',
               'july', 'august', 'september', 'october', 'november', 'december', 'state', 'city', 'county', 'national', 'federal', 'mr', 'mrs', 'ms',
               'dr', 'tv', 'ceo', 'gop', 'faq', 'q&a', 'pm', 'am', 'et', 'ok', 'week', 'weekend', 'part', 'season', 'game', 'episode', 'chapter',
               'category', 'show hn', 'ask hn', 'tell hn', 'launch hn', 'hn', 'review', 'interview', 'recap', 'preview', 'podcast', 'quiz',
               'st', 'jr', 'sr', 'inc', 'co', 'llc', 'stat', 'stat+', 'no', 'vs', 'v', 'i', 'ii', 'iii', 'iv', 'ai'}  # AI is a topic
# demonyms and short forms -> one key, so "Chinese" and "China" are the same interest
ENT_ALIAS = {'chinese': 'china', 'russian': 'russia', 'russians': 'russia', 'ukrainian': 'ukraine', 'ukrainians': 'ukraine',
             'israeli': 'israel', 'israelis': 'israel', 'iranian': 'iran', 'european': 'europe', 'europeans': 'europe', 'eu': 'european union',
             'british': 'uk', 'britain': 'uk', 'united kingdom': 'uk', 'japanese': 'japan', 'mexican': 'mexico', 'canadian': 'canada',
             'canadians': 'canada', 'french': 'france', 'german': 'germany', 'indian': 'india', 'palestinian': 'palestinians',
             'syrian': 'syria', 'venezuelan': 'venezuela', 'brazilian': 'brazil', 'korean': 'south korea', 'north korean': 'north korea',
             'saudi': 'saudi arabia', 'taiwanese': 'taiwan', 'turkish': 'turkey', 'egyptian': 'egypt', 'jamaican': 'jamaica',
             'the fed': 'federal reserve', 'fed': 'federal reserve', 'un': 'united nations', 'nyc': 'new york city', 'la': 'los angeles',
             'openai': 'openai', 'gop': 'republicans', 'dems': 'democrats', 'democrat': 'democrats', 'republican': 'republicans'}
ALIAS_LABEL = {'china': 'China', 'russia': 'Russia', 'ukraine': 'Ukraine', 'israel': 'Israel', 'iran': 'Iran', 'europe': 'Europe',
               'european union': 'European Union', 'uk': 'U.K.', 'japan': 'Japan', 'mexico': 'Mexico', 'canada': 'Canada', 'france': 'France',
               'germany': 'Germany', 'india': 'India', 'palestinians': 'Palestinians', 'syria': 'Syria', 'venezuela': 'Venezuela', 'brazil': 'Brazil',
               'south korea': 'South Korea', 'north korea': 'North Korea', 'saudi arabia': 'Saudi Arabia', 'taiwan': 'Taiwan', 'turkey': 'Turkey',
               'egypt': 'Egypt', 'jamaica': 'Jamaica', 'federal reserve': 'Federal Reserve', 'united nations': 'United Nations',
               'new york city': 'New York City', 'los angeles': 'Los Angeles', 'republicans': 'Republicans', 'democrats': 'Democrats'}
CONNECT = {'of', 'the', 'and', '&', 'de', 'la', 'del', 'for', 'van', 'von', 'da', 'du', 'le', 'al', 'bin', 'el'}
TOPICS = [
    ('ai', 'AI', r'\b((?-i:AI|A\.I)|artificial intelligence|chatbots?|chatgpt|openai|anthropic|llms?|generative ai)\b'),
    ('interest-rates', 'Interest rates', r'\b(interest rates?|rate cuts?|rate hikes?|Federal Reserve|the Fed|Powell)\b'),
    ('inflation', 'Inflation', r'\b(inflation|consumer prices|CPI)\b'),
    ('tariffs', 'Tariffs', r'\b(tariffs?|trade war)\b'),
    ('housing', 'Housing', r'\b(mortgages?|home prices|housing market|homebuyers?|rents?)\b'),
    ('stocks', 'Stocks', r'\b(stock market|stocks?|S&P 500|Dow|Nasdaq|Wall Street)\b'),
    ('jobs', 'Jobs', r'\b(jobs report|unemployment|layoffs?|hiring|labor market)\b'),
    ('crypto', 'Crypto', r'\b(bitcoin|crypto\w*|ethereum|stablecoins?)\b'),
    ('climate', 'Climate', r'\b(climate|global warming|emissions|carbon)\b'),
    ('storms', 'Storms', r'\b(hurricanes?|tropical storms?|tornado(es)?|blizzard|typhoon|flooding|floods)\b'),
    ('wildfires', 'Wildfires', r'\b(wildfires?|brush fire|evacuation orders?)\b'),
    ('earthquakes', 'Earthquakes', r'\b(earthquakes?|quake|tsunami)\b'),
    ('immigration', 'Immigration', r'\b(immigration|immigrants?|deport\w*|border patrol|southern border|migrants?|asylum|(?-i:ICE))\b'),
    ('elections', 'Elections', r'\b(elections?|ballots?|midterms?|early voting|voters|polls? show|runoff)\b'),
    ('supreme-court', 'Supreme Court', r'\b(Supreme Court|justices)\b'),
    ('ukraine-war', 'Ukraine', r'\b(Ukraine|Ukrainian|Kyiv|Zelensky)\b'),
    ('middle-east', 'Middle East', r'\b(Gaza|Israel|Israeli|Hamas|Hezbollah|West Bank|Iran|Lebanon)\b'),
    ('china', 'China', r'\b(China|Chinese|Beijing|Xi Jinping)\b'),
    ('space', 'Space', r'\b(NASA|SpaceX|rockets?|astronauts?|the moon|Mars|asteroid|telescope|orbit)\b'),
    ('evs', 'Electric vehicles', r'\b(electric vehicles?|EVs?|charging stations?|battery-electric)\b'),
    ('nfl', 'NFL', r'\b(NFL|quarterback|Super Bowl|touchdown)\b'),
    ('nba', 'NBA', r'\b(NBA)\b'),
    ('mlb', 'Baseball', r'\b(MLB|World Series|baseball)\b'),
    ('college-football', 'College football', r'\b(college football|(?-i:CFP)|heisman|big ten|(?-i:SEC) football)\b'),
    ('soccer', 'Soccer', r'\b(soccer|Premier League|Champions League|World Cup|MLS)\b'),
    ('golf', 'Golf', r'\b(golf|PGA|LPGA|Ryder Cup)\b'),
    ('f1', 'Formula 1', r'\b(Formula 1|F1|Grand Prix)\b'),
    ('movies', 'Movies', r'\b(box office|movies?|films?|filmmaker)\b'),
    ('music', 'Music', r'\b(albums?|songs?|tour|concerts?|singer|rapper)\b'),
    ('tv', 'TV', r'\b(TV series|streaming|Netflix|HBO|Hulu|season \d+|showrunner)\b'),
    ('airlines', 'Airlines', r'\b(airlines?|flights?|airports?|FAA|TSA|pilots?)\b'),
    ('cruises', 'Cruises', r'\b(cruises?|cruise ships?|cruise lines?)\b'),
    ('hotels', 'Hotels', r'\b(hotels?|resorts?)\b'),
    ('points-miles', 'Points & miles', r'\b(points|miles|lounges?|elite status|award flights?|credit cards?)\b'),
    ('recipes', 'Recipes', r'\b(recipes?)\b'),
    ('restaurants', 'Restaurants', r'\b(restaurants?|chefs?)\b'),
    ('vaccines', 'Vaccines', r'\b(vaccines?|vaccination|immunization)\b'),
    ('cancer', 'Cancer', r'\b(cancer|tumou?rs?|chemotherapy)\b'),
    ('weight-loss-drugs', 'Weight-loss drugs', r'\b(Ozempic|Wegovy|Zepbound|Mounjaro|GLP-1)\b'),
    ('cybersecurity', 'Cybersecurity', r'\b(hack(s|ed|ing|ers?)?\b(?!\s+news)|data breach|ransomware|cyber\w*)'),
    ('smartphones', 'Phones', r'\b(iPhone|Android|Pixel|Galaxy|smartphones?)\b'),
    ('chips', 'Chips', r'\b(Nvidia|chips?|semiconductors?|TSMC)\b'),
    ('shutdown', 'Government shutdown', r'\b(government shutdown|shutdown)\b'),
    ('weather', 'Weather', r'\b(snow|heat wave|forecast|winter storm|cold front|rainfall)\b'),
    ('crime', 'Crime & courts', r'\b(trial|verdict|sentenced|indicted|indictment|charged|jury|lawsuit|arrested|shooting)\b'),
    ('epstein', 'Epstein files', r'\b(Epstein|Maxwell|Epstein files|Ghislaine)\b'),
    ('obituaries', 'Obituaries', r'\b(dies at \d+|dead at \d+|has died|obituary)\b'),
]
TOPICS = [(k, l, re.compile(p, re.I)) for k, l, p in TOPICS]
TOPIC_AS_NAME = {'ukraine-war': 'ukraine', 'china': 'china'}
WORD = re.compile(r"[^\W_][\w'’.&\-]*[^\W_]|[^\W_]")  # letters in any alphabet: "São Paulo", "Flávio", "Süddeutsche"


def tokens_raw(title):
    return [w.rstrip('.') if not re.match(r'^([A-Z]\.){2,}$', w) else w for w in WORD.findall(title.replace('’', "'"))]


def is_title_case(words):
    long = [w for w in words if len(w) > 3 and w.isalpha()]
    return len(long) >= 3 and sum(1 for w in long if w[0].isupper()) / len(long) > 0.75


def is_cap(w):
    # "Trump", "NASA", "iPhone", "eBay", "49ers"
    return bool(w) and (w[0].isupper() or any(c.isupper() for c in w[1:]))


def strip_poss(w):
    return re.sub(r"'s$|'$", '', w)


def ent_key(phrase):
    k = WS.sub(' ', phrase.lower().replace("'", '').replace('.', '')).strip(' -&')
    return ENT_ALIAS.get(k, k)


CLAUSE = re.compile(r'\s*(?:[:;|?!()\[\]"“”]|,\s|\s[-–—]\s|\.\s)\s*')


def clauses(title):
    """a headline split where a name cannot run on: "Hurricane Melissa: Jamaica braces" -> two clauses"""
    return [tokens_raw(c) for c in CLAUSE.split(title.replace('’', "'")) if c.strip()]


def cap_phrases(words):
    """capitalized runs in one clause of a sentence-case headline -> [(phrase, start index)]"""
    out, i = [], 0
    while i < len(words):
        if is_cap(words[i]):
            j = i + 1
            while j < len(words):
                if re.search(r"'s?$", words[j - 1]):  # "Germany's Merz": a possessive ends the name
                    break
                if is_cap(words[j]):
                    j += 1
                elif words[j].lower() in CONNECT and j + 1 < len(words) and is_cap(words[j + 1]) and words[j] == words[j].lower():
                    j += 2
                else:
                    break
            seg = words[i:j]
            while seg and seg[0] in CAP_COMMON:  # "The", "How" ... at the head of a run
                seg = seg[1:]; i += 1
            if seg:
                out.append((' '.join(strip_poss(w) for w in seg), i))
            i = j
        else:
            i += 1
    return out


def learn_entities(items):
    """names seen capitalized mid-sentence in sentence-case headlines -> {key: label}"""
    seen = Counter(); label = {}; lower = Counter()
    for it in items:
        if it.get('l') == 'de' or is_title_case(tokens_raw(it['t'])):
            continue
        for words in clauses(it['t']):
            for w in words[1:]:
                if w.islower():
                    lower[ent_key(w)] += 1
            for ph, pos in cap_phrases(words):
                k = ent_key(ph)
                if not k or k in GENERIC_ENT or k in STOP or len(k) < 2:
                    continue
                if pos == 0 and ' ' not in ph and not ph.isupper():
                    continue  # one capitalized word that opens a clause proves nothing
                seen[k] += 1
                label.setdefault(k, ALIAS_LABEL.get(k, ph))
    # acronyms count even at the head of a headline
    for it in items:
        if it.get('l'):
            continue
        for w in tokens_raw(it['t']):
            if re.match(r'^([A-Z]{2,6}|([A-Z]\.){2,4})$', w) and ent_key(w) not in GENERIC_ENT and ent_key(w) not in STOP:
                seen[ent_key(w)] += 1; label.setdefault(ent_key(w), ALIAS_LABEL.get(ent_key(w), w))
    # a single word that headlines mostly write in lower case ("duo", "fight") is not a name
    return {k: label[k] for k in seen if ' ' in k or lower[k] < seen[k]}


def item_keywords(it, ents):
    found = []
    title_case = is_title_case(tokens_raw(it['t']))
    for words in clauses(it['t']) if it.get('l') != 'de' else []:
        if title_case:
            n = len(words)
            used = [False] * n
            for size in (4, 3, 2, 1):
                for i in range(n - size + 1):
                    if any(used[i:i + size]):
                        continue
                    ph = ' '.join(strip_poss(w) for w in words[i:i + size])
                    k = ent_key(ph)
                    if k in ents and k not in GENERIC_ENT and k not in STOP:
                        lab = ents[k]
                        if size == 1 and lab.replace('.', '').isupper() and not ph.replace('.', '').isupper():
                            continue
                        found.append(k); used[i:i + size] = [True] * size
        else:
            for ph, pos in cap_phrases(words):
                k = ent_key(ph)
                if k in ents and k not in GENERIC_ENT:
                    found.append(k)
                elif ' ' in ph and k not in GENERIC_ENT and k not in STOP and not (it.get('l') and set(k.split()) & FOREIGN_STOP):
                    found.append(k); ents.setdefault(k, ALIAS_LABEL.get(k, ph))
    topics = [] if it.get('l') else [k for k, _l, rx in TOPICS if rx.search(it['t']) or (rx.search(it.get('d', '')) and k not in ('crime', 'hotels', 'points-miles', 'music', 'movies'))]
    out = []
    for k in found + [TOPIC_AS_NAME.get(t, '#' + t) for t in topics]:  # "Ukraine" the topic is "Ukraine" the name
        if k not in out:
            out.append(k)
    return out[:8]


# ------------------------------------------------------------------ clustering
def stem(w):
    w = w.lower().replace("'", '')
    if len(w) > 4 and w.endswith('ies'):
        return w[:-3] + 'y'
    if len(w) > 4 and w.endswith('s') and not w.endswith('ss') and not w.endswith('us'):
        return w[:-1]
    return w


FOREIGN_STOP = set('''a o os as um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para com sem sob sobre e ou mas que se
nao não é ao aos à às como mais menos após apos até ate entre seu sua seus suas ele ela eles elas isso este esta esse essa diz diz-se
der die das den dem des ein eine einer eines einem einen und oder aber nicht ist sind war wird werden hat haben im in am an auf aus bei mit
nach von vor zu zum zur für fur über uber unter gegen um wie was wer sich auch noch nur so es er sie wir ihr ihre sein seine dass als bis
'''.split())


def cluster_tokens(it):
    toks = set()
    fs = FOREIGN_STOP if it.get('l') else ()
    for w in tokens_raw(it['t']):
        lw = w.lower()
        if lw in STOP or lw in fs or len(lw) < 3 and not lw.isdigit():
            continue
        toks.add(stem(lw))
    for k in it.get('k', []):
        if not k.startswith('#'):
            toks.add('E:' + k)
    return toks


def build_clusters(items):
    toks = [cluster_tokens(it) for it in items]
    df = Counter(t for ts in toks for t in ts)
    N = max(1, len(items))
    idf = {t: math.log(1 + N / c) for t, c in df.items()}
    inv = defaultdict(list)
    for i, ts in enumerate(toks):
        for t in ts:
            if df[t] <= max(6, N * 0.06):
                inv[t].append(i)
    def weight(t):
        return idf[t] * (2.0 if t.startswith('E:') else 0.5 if t.isdigit() else 1.0)
    pair_shared = defaultdict(float)
    pair_n = Counter()
    for t, lst in inv.items():
        if len(lst) < 2:
            continue
        w = weight(t)
        for a in range(len(lst)):
            for b in range(a + 1, len(lst)):
                key = (lst[a], lst[b])
                pair_shared[key] += w; pair_n[key] += 1
    mass = [sum(weight(t) for t in ts if df[t] <= max(6, N * 0.06)) or 1.0 for ts in toks]
    parent = list(range(len(items)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    edges = []
    for (a, b), s in pair_shared.items():
        if pair_n[(a, b)] < 3:
            continue
        if abs(items[a]['p'] - items[b]['p']) > 30 * 60:
            continue
        sim = s / min(mass[a], mass[b])
        sim2 = s / max(mass[a], mass[b])
        if sim >= 0.5 and sim2 >= 0.3:
            edges.append((sim, a, b))
    edges.sort(reverse=True)
    size = [1] * len(items)
    for sim, a, b in edges:
        ra, rb = find(a), find(b)
        if ra == rb:
            continue
        if size[ra] + size[rb] > 40 and sim < 0.75:  # keep one loose link from welding two big stories together
            continue
        parent[rb] = ra; size[ra] += size[rb]
    groups = defaultdict(list)
    for i in range(len(items)):
        groups[find(i)].append(i)
    return [g for g in groups.values() if len({items[i]['o'] for i in g}) >= 2]


def lead_score(it):
    return (2 if it.get('m') else 0) + (1 if it.get('d') else 0) + (1.5 if it['o'] in TIER1 else 0) - (0.8 if it.get('gn') else 0) + min(len(it['t']), 110) / 220


# ------------------------------------------------------------------ the watch
def current_watch(now_utc):
    et = now_utc.astimezone(ETZ)
    h0, key, label = WATCHES[et.hour // 4]
    start = et.replace(hour=h0, minute=0, second=0, microsecond=0)
    nxt = start + dt.timedelta(hours=4)
    return {'id': f'{start.date().isoformat()}-{key}', 'key': key, 'label': label, 'date': start.date().isoformat(),
            'start': start.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'next': nxt.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}


def load(p, d):
    try:
        with open(p, encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return d


def main():
    watch = current_watch(NOW)
    prev = load(os.path.join(D, 'edition.json'), {})
    if not FORCE and not OFFLINE and not FIXTURE and prev.get('id') == watch['id']:
        print(f"{watch['label']} ({watch['id']}) is already out; nothing to do. Use --force to rebuild it.")
        return 0
    cfg = load(os.path.join(D, 'feeds.json'), {})
    feeds = [f for f in cfg.get('feeds', []) if f.get('url')]
    fresh, errors, counts = [], [], {}
    if not OFFLINE:
        with cf.ThreadPoolExecutor(max_workers=20) as pool:
            results = list(pool.map(read_feed, feeds))
        byname = {f.get('name') or f['url']: f for f in feeds}
        for name, raw_items, err in results:
            f = byname[name]
            if err:
                errors.append({'feed': name, 'error': err}); print(f'  ✗ {name}: {err}'); continue
            n = 0
            slow = f.get('section') in SLOW
            cutoff = NOW_MIN - max(WINDOW_H['slow'] if slow else WINDOW_H['default'], WINDOW_BY_SEC.get(f.get('section'), 0), 72 if f.get('region') else 0) * 60
            for r in raw_items[:60]:
                title, link = r['title'], r['link']
                if not title or not link or len(title) < 12 or len(title.split()) < 4:
                    continue
                if r['google']:
                    dom = norm_domain(r['src_url']) if r['src_url'] else ''
                    sname = r['src_name']
                    if sname and title.endswith(' - ' + sname):
                        title = title[: -len(sname) - 3].strip()
                    else:
                        title = re.sub(r'\s+-\s+[^-]{2,60}$', '', title).strip()
                    if not dom:
                        continue
                    outlet_name = OUTLETS.get(dom) or sname or dom
                else:
                    dom = f.get('domain') or norm_domain(link)
                    outlet_name = OUTLETS.get(dom) or re.sub(r'\s+(U\.S\.|World|Politics|Business|Technology|Tech|Science|Health|Well|Sports?|Arts|Culture|Travel|Food|Automobiles|Markets|Investing|MoneyWatch|Long Read|Examiner Politics)$', '', f.get('name') or dom)
                title = re.sub(r'^(STAT\+|Exclusive|EXCLUSIVE|Breaking|BREAKING|WATCH|LIVE|VIDEO)\s*[:|]\s*', '', title).strip()
                if JUNK_TITLE.search(title) or JUNK_URL.search(urllib.parse.urlsplit(link).path or ''):
                    continue
                when = r['when']
                p = int(when.timestamp() // 60) if when else NOW_MIN
                p = min(p, NOW_MIN)
                if p < cutoff:
                    continue
                desc = r['desc']
                if f.get('external') and 'Points:' in clean(desc):  # Hacker News: say how much it is being discussed
                    m1 = re.search(r'Points:\s*(\d+)', clean(desc)); m2 = re.search(r'# Comments:\s*(\d+)', clean(desc))
                    d = f"{m1.group(1) if m1 else '?'} points and {m2.group(1) if m2 else '?'} comments on Hacker News"
                    dom = 'news.ycombinator.com'; outlet_name = 'Hacker News'
                else:
                    d = '' if r['google'] else snippet(desc, title)
                sec = classify(f.get('section', 'auto'), f.get('lean'), link, title, d, f.get('lang'))
                it = {'i': ident(link), 't': title[:240], 'u': link, 'o': dom, 'c': sec, 'p': p, 'f': NOW_MIN}
                if f.get('lang') in ('pt', 'de'):
                    it['l'] = f['lang']
                if d:
                    it['d'] = d
                if r['img']:
                    it['m'] = r['img']
                if r['google']:
                    it['gn'] = 1
                if f.get('external') and r.get('comments'):
                    it['x'] = r['comments']
                OUTLETS.setdefault(dom, outlet_name)
                fresh.append(it); n += 1
            counts[name] = n
            print(f'  ✓ {name}: {n}')
        ok = len(feeds) - len(errors)
        print(f'feeds: {ok} of {len(feeds)} read, {len(fresh)} stories')
        if ok == 0:
            print('no feed could be read; the last edition stays up', file=sys.stderr)
            return 2
    # merge with the last edition's stories, so an outage does not empty a section
    prev_items = {it['i']: it for it in prev.get('items', [])}
    prev_out = prev.get('outlets', {})
    for dom, name in prev_out.items():
        OUTLETS.setdefault(dom, name)
    merged = {}
    for it in fresh:
        old = prev_items.get(it['i'])
        if old:
            it['f'] = old.get('f', it['f'])
            if not it.get('m') and old.get('m'):
                it['m'] = old['m']
        cur = merged.get(it['i'])
        if cur:
            keep, other = (cur, it) if lead_score(cur) >= lead_score(it) else (it, cur)
            if keep['c'] in ('us', 'world') and other['c'] not in ('us', 'world'):
                keep['c'] = other['c']
            for fld in ('m', 'd'):
                if not keep.get(fld) and other.get(fld):
                    keep[fld] = other[fld]
            merged[it['i']] = keep
            continue
        merged[it['i']] = it
    for i, old in prev_items.items():
        if i in merged:
            continue
        slow = old.get('c') in SLOW
        if old.get('p', 0) < NOW_MIN - max(WINDOW_H['slow'] if slow else WINDOW_H['default'], WINDOW_BY_SEC.get(old.get('c'), 0)) * 60:
            continue
        o = {k: v for k, v in old.items() if k not in ('k', 'g')}
        merged[i] = o
    # one copy per outlet and headline (a story in two of an outlet's feeds, or in its feed and Google's)
    byhead = {}
    for it in merged.values():
        key = (it['o'], re.sub(r'[^a-z0-9]+', '', it['t'].lower())[:90])
        cur = byhead.get(key)
        if not cur:
            byhead[key] = it; continue
        keep, other = (it, cur) if lead_score(it) > lead_score(cur) else (cur, it)
        if keep['c'] in ('us', 'world') and other['c'] not in ('us', 'world'):
            keep['c'] = other['c']
        for fld in ('m', 'd'):
            if not keep.get(fld) and other.get(fld):
                keep[fld] = other[fld]
        keep['p'] = min(keep['p'], other['p'])
        byhead[key] = keep
    items = list(byhead.values())
    # cap each section, newest first
    bysec = defaultdict(list)
    for it in items:
        bysec[it['c']].append(it)
    items = []
    for s, lst in bysec.items():
        lst.sort(key=lambda x: -x['p'])
        items.extend(lst[:CAP.get(s, 60)])
    items.sort(key=lambda x: -x['p'])
    # names and topics
    ents = learn_entities(items)
    for it in items:
        it['k'] = item_keywords(it, ents)
    # same-story groups
    groups = build_clusters(items)
    prev_cluster_n = {}
    for c in prev.get('clusters', []):
        for i in c.get('ids', []):
            prev_cluster_n[i] = c.get('n', 0)
    drop = set()
    for g in groups:
        by_out = defaultdict(list)
        for i in g:
            by_out[items[i]['o']].append(i)
        for o, lst in by_out.items():
            if len(lst) > 1:
                lst.sort(key=lambda i: -lead_score(items[i]))
                drop.update(lst[1:])
    groups = [[i for i in g if i not in drop] for g in groups]
    clusters = []
    for g in groups:
        members = [items[i] for i in g]
        outlets = {m['o'] for m in members}
        lead = max(members, key=lead_score)
        latest = max(m['p'] for m in members); earliest = min(m['p'] for m in members)
        secs = Counter(m['c'] for m in members)
        prev_n = max((prev_cluster_n.get(m['i'], 0) for m in members), default=0)
        was_seen = any(m['i'] in prev_items for m in members)
        kws = Counter(k for m in members for k in m['k'])
        c = {'n': len(outlets), 'lead': lead['i'], 'ids': [m['i'] for m in sorted(members, key=lambda m: (-lead_score(m), m['p']))],
             'sec': secs.most_common(1)[0][0], 'p0': earliest, 'p1': latest,
             'k': [k for k, v in kws.most_common(6) if v >= 2][:5]}
        if prev_n and len(outlets) > prev_n:
            c['rise'] = len(outlets) - prev_n
        if prev and not was_seen:
            c['new'] = 1
        clusters.append(c)

    def cscore(c):
        age_h = max(0, (NOW_MIN - c['p1']) / 60)
        s = (c['n'] ** 0.9) * math.exp(-age_h / 14)
        if c['sec'] in SLOW:
            s *= 0.35
        if c['sec'] in ('sports', 'culture') and c['n'] < 6:  # a game or a premiere leads only when it is everywhere
            s *= 0.6
        if SERVICE.search(by_i[c['lead']]['t']):  # "where to watch", "live updates": useful, not a top story
            s *= 0.3
        if c.get('rise'):
            s *= 1 + min(c['rise'], 8) * 0.05
        return s
    by_i = {it['i']: it for it in items}
    clusters.sort(key=cscore, reverse=True)
    for ci, c in enumerate(clusters):
        c['id'] = ci
        c['s'] = round(cscore(c), 3)
    items = [it for n, it in enumerate(items) if n not in drop]
    idx = {it['i']: n for n, it in enumerate(items)}
    for c in clusters:
        for i in c['ids']:
            items[idx[i]]['g'] = c['id']
    top = [c['id'] for c in clusters if c['sec'] not in SLOW and not by_i[c['lead']].get('l')][:30]
    top_lang = {lg: [c['id'] for c in clusters if c['sec'] not in SLOW and by_i[c['lead']].get('l') == lg][:12] for lg in ('pt', 'de')}
    for it in items:
        if not it['k']:
            del it['k']
    used_out = {it['o'] for it in items}
    edition = {
        'v': 1, 'id': watch['id'], 'watch': watch['key'], 'label': watch['label'], 'date': watch['date'],
        'at': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'atMin': NOW_MIN, 'start': watch['start'], 'next': watch['next'],
        'sections': [{'k': k, 'name': n} for k, n in SECTIONS],
        'outlets': {d: OUTLETS.get(d, d) for d in sorted(used_out)},
        'kw': {k: ents.get(k) or ALIAS_LABEL.get(k, k) for k in sorted({k for it in items for k in it.get('k', []) if not k.startswith('#')})},
        'topics': {k: l for k, l, _rx in TOPICS},
        'items': items, 'clusters': clusters, 'top': top, 'topLang': top_lang,
        'feeds': {'total': len(feeds), 'read': len(feeds) - len(errors), 'failed': errors, 'stories': len(fresh)} if not OFFLINE else prev.get('feeds', {}),
    }
    # the archive: the last seven editions, by id
    os.makedirs(ARCH, exist_ok=True)
    kept = sorted([fn[:-5] for fn in os.listdir(ARCH) if fn.endswith('.json') and fn != 'index.json'])
    if watch['id'] not in kept:
        kept.append(watch['id'])
    kept = sorted(kept)[-7:]
    for fn in os.listdir(ARCH):
        if fn.endswith('.json') and fn != 'index.json' and fn[:-5] not in kept:
            os.remove(os.path.join(ARCH, fn))
    arch = []
    for eid in kept:
        if eid == watch['id']:
            arch.append({'id': eid, 'label': watch['label'], 'at': edition['at']})
        else:
            e = load(os.path.join(ARCH, eid + '.json'), {})
            if e:
                arch.append({'id': eid, 'label': e.get('label', ''), 'at': e.get('at', '')})
    edition['archive'] = arch
    body = json.dumps(edition, ensure_ascii=False, separators=(',', ':'))
    for path in (os.path.join(D, 'edition.json'), os.path.join(ARCH, watch['id'] + '.json')):
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(body)
    with open(os.path.join(D, 'latest.json'), 'w', encoding='utf-8') as fh:
        json.dump({'id': watch['id'], 'label': watch['label'], 'at': edition['at'], 'next': watch['next'], 'stories': len(items)}, fh)
    multi = sum(1 for c in clusters if c['n'] >= 3)
    print(f"{watch['label']} {watch['id']}: {len(items)} stories, {len(clusters)} shared stories ({multi} with 3+ outlets), "
          f"{len(body) // 1024} KB, {len(errors)} feeds failed")
    for c in clusters[:8]:
        lead = items[idx[c['lead']]]
        print(f"   {c['n']:>2} outlets  {lead['t'][:90]}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
