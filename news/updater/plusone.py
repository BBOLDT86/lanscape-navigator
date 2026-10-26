#!/usr/bin/env python3
"""Plus One (#/plusone): the news about each couple, from established outlets. Standard library only.

  python3 news/updater/plusone.py          refresh news/data/plusone.json
  python3 news/updater/plusone.py check    exit 1 with the problems in news/plusone/couples.json
  python3 news/updater/plusone.py format   print that file's format

news/plusone/couples.json is written and re-checked every week by a scheduled Claude task. This script reads, for each
couple, a Google News search for both names (in English, and in Portuguese or German for couples with a Brazilian,
Portuguese or German side) and the current edition of The Watch, and keeps the stories from established outlets only:
no tabloids, nothing about pregnancies or bodies. Headlines that report a split are listed under "alerts" so the
weekly task looks at that couple first. A source that fails keeps its last copy; the file is rewritten only when
something changed.
"""
import concurrent.futures as cf
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
NEWS = os.path.normpath(os.path.join(HERE, '..'))
COUPLES = os.path.join(NEWS, 'plusone', 'couples.json')
OUT = os.path.join(NEWS, 'data', 'plusone.json')
EDITION = os.path.join(NEWS, 'data', 'edition.json')
NOW = dt.datetime.now(dt.timezone.utc)
errors = []

# Established outlets only: news, sport, and the lifestyle and culture press. Never tabloids or gossip sites.
OK = {
    'apnews.com', 'reuters.com', 'nytimes.com', 'washingtonpost.com', 'wsj.com', 'latimes.com', 'usatoday.com', 'cnn.com', 'nbcnews.com', 'cbsnews.com',
    'abcnews.go.com', 'npr.org', 'bbc.com', 'bbc.co.uk', 'theguardian.com', 'independent.co.uk', 'telegraph.co.uk', 'thetimes.com', 'ft.com', 'bloomberg.com',
    'espn.com', 'theathletic.com', 'nfl.com', 'nba.com', 'wnba.com', 'mlb.com', 'nhl.com', 'mlssoccer.com', 'si.com', 'cbssports.com', 'foxsports.com',
    'nbcsports.com', 'sports.yahoo.com', 'yahoo.com', 'bleacherreport.com', 'theringer.com', 'formula1.com', 'motorsport.com', 'the-race.com', 'racefans.net',
    'autosport.com', 'skysports.com', 'atptour.com', 'wtatennis.com', 'pgatour.com', 'lpga.com', 'olympics.com', 'teamusa.com', 'goal.com', 'fifa.com', 'uefa.com',
    'people.com', 'vogue.com', 'vogue.co.uk', 'harpersbazaar.com', 'elle.com', 'gq.com', 'gq-magazine.co.uk', 'esquire.com', 'vanityfair.com', 'wwd.com',
    'instyle.com', 'glamour.com', 'cosmopolitan.com', 'marieclaire.com', 'townandcountrymag.com', 'hellomagazine.com', 'tatler.com', 'whowhatwear.com',
    'variety.com', 'billboard.com', 'rollingstone.com', 'hollywoodreporter.com', 'deadline.com', 'etonline.com', 'eonline.com', 'today.com', 'goodmorningamerica.com',
    'nme.com', 'pitchfork.com', 'complex.com', 'essence.com', 'ew.com', 'time.com', 'forbes.com', 'fortune.com', 'businessinsider.com',
    'ge.globo.com', 'g1.globo.com', 'globo.com', 'vogue.globo.com', 'glamour.globo.com', 'gq.globo.com', 'quem.globo.com', 'folha.uol.com.br', 'uol.com.br',
    'estadao.com.br', 'cnnbrasil.com.br', 'terra.com.br', 'lance.com.br', 'record.pt', 'abola.pt', 'ojogo.pt', 'publico.pt', 'observador.pt',
    'kicker.de', 'spiegel.de', 'zeit.de', 'faz.net', 'sueddeutsche.de', 'stern.de', 'gala.de', 'vogue.de', 'elle.de', 'gq-magazin.de', 'sport1.de', 'sportschau.de',
    'tagesschau.de', 'n-tv.de', 'rtl.de', 'welt.de', 'derstandard.at', 'nzz.ch', 'marca.com', 'as.com', 'elpais.com', 'lequipe.fr', 'gazzetta.it', 'corriere.it',
}
NEVER = re.compile(r'dailymail|thesun\.|mirror\.co|dailystar|tmz\.|radaronline|okmagazine|intouchweekly|pagesix|nypost|starmagazine|thesun\b|bild\.de|bunte\.de', re.I)
SKIP = re.compile(r'pregnan|baby bump|bump |grávida|gravidez|schwanger|bikini|body[- ]?shaming|weight loss|nude|naked|topless|cheat(ed|ing)? rumou?r|affair rumou?r'
                  r'|\bbab(y|ies)\b|\bnewborn|\bkids?\b|\bchild(ren)?\b|\bsons?\b|\bdaughters?\b|\bfilh[oa]s?\b|\bbeb[êe]s?\b|\bKinder\b|\bTochter|\bSohn\b'
                  r'|\bmansion|\bnet worth|\bhouse (hunting|tour)|\bhome (tour|for sale)', re.I)  # nothing about children, homes or money
TEXT_SKIP = re.compile(r'pregnan|baby bump|grávida|gravidez|schwanger|bikini|nude|naked|topless|body[- ]?shaming', re.I)  # for the written text
SPLIT = re.compile(r'\b(split|splits|split up|break ?up|broke up|breakup|divorc\w*|separat\w*|call(s|ed)? off (their|the) engagement|termin\w+|separa\w*|trennung|getrennt|scheidung)\b', re.I)
PT = re.compile(r'brazil|brasil|portug', re.I)
DE = re.compile(r'german|deutsch|austria|österreich|swiss|schweiz', re.I)


def get(url, timeout=15):
    import run  # noqa: E402  the edition's feed reader
    req = urllib.request.Request(url, headers={**run.UA, 'Accept': 'application/rss+xml,application/xml'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def searches(c):
    a, p = c['athlete']['name'], re.sub(r'\s*\(.*\)$', '', c['partner']['name'])
    q = urllib.request.quote(f'"{a}" "{p}" when:30d')
    out = [f'https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q={q}']
    nat = ' '.join([c['athlete'].get('nationality') or '', c['partner'].get('nationality') or ''])
    if PT.search(nat):
        out.append(f'https://news.google.com/rss/search?hl=pt-BR&gl=BR&ceid=BR:pt-419&q={q}')
    if DE.search(nat):
        out.append(f'https://news.google.com/rss/search?hl=de&gl=DE&ceid=DE:de&q={q}')
    return out


def couple_news(c):
    import run  # noqa: E402
    got, seen = [], set()
    for url in searches(c):
        name, items, err = run.read_feed({'name': c['id'], 'url': url})
        if err:
            raise RuntimeError(err)
        for it in items:
            t, link, when = it['title'], it['link'], it['when']
            if not t or not link or not when or (NOW - when).days > 30 or when > NOW + dt.timedelta(hours=2):
                continue
            dom = run.norm_domain(it['src_url']) or ''
            if NEVER.search(dom) or NEVER.search(it['src_url'] or ''):
                continue
            if dom.lower() not in OK and not any(dom.lower().endswith('.' + d) for d in OK):
                continue
            if it['src_name'] and t.endswith(' - ' + it['src_name']):
                t = t[: -len(it['src_name']) - 3].strip()
            if SKIP.search(t):
                continue
            key = re.sub(r'\W+', ' ', t.lower()).strip()[:72]
            if key in seen:
                continue
            seen.add(key)
            got.append({'t': t, 'u': link, 'o': run.OUTLETS.get(dom) or it['src_name'] or dom, 'p': when.strftime('%Y-%m-%dT%H:%M:%SZ'),
                        'l': 'pt' if 'hl=pt' in url else 'de' if 'hl=de' in url else None})
        time.sleep(0.6)
    return got


def from_edition(cs):
    """Stories in the current edition that name both people (or the partner and the athlete's surname)."""
    try:
        e = json.load(open(EDITION, encoding='utf-8'))
    except (OSError, ValueError):
        return {}
    out = {}
    for c in cs:
        a, p = c['athlete']['name'], re.sub(r'\s*\(.*\)$', '', c['partner']['name'])
        same = a.split()[-1].lower() == p.split()[-1].lower()  # the Currys: then only the athlete's full name counts
        rx_a = re.compile(r'\b' + re.escape(a) + r'\b' + ('' if same or len(a.split()) < 2 else r'|\b' + re.escape(a.split()[-1]) + r'\b'), re.I)
        rx_p = re.compile(r'\b' + re.escape(p) + r'\b', re.I)  # the partner by full name: a shared surname alone is not enough
        for it in e.get('items', []):
            text = it.get('t', '') + ' ' + (it.get('d') or '')
            if rx_p.search(text) and rx_a.search(rx_p.sub(' ', text)) and not SKIP.search(it.get('t', '')):
                out.setdefault(c['id'], []).append({'t': it['t'], 'u': it['u'], 'o': (e.get('outlets') or {}).get(it['o'], it['o']),
                                                    'p': dt.datetime.fromtimestamp(it['p'] * 60, dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'm': it.get('m'), 'l': it.get('l')})
    return out


def build():
    try:
        cs = json.load(open(COUPLES, encoding='utf-8'))['couples']
    except (OSError, ValueError, KeyError) as ex:
        print('no couples file:', ex)
        return 0
    try:
        old = json.load(open(OUT, encoding='utf-8'))
    except (OSError, ValueError):
        old = {}
    news, failed = {}, 0
    with cf.ThreadPoolExecutor(3) as pool:  # gently: Google News answers 503 to a burst
        futs = {pool.submit(couple_news, c): c for c in cs}
        for f in cf.as_completed(futs):
            c = futs[f]
            try:
                news[c['id']] = f.result()
            except Exception as ex:  # noqa: BLE001 - one search failing keeps that couple's last copy
                failed += 1
                errors.append(f'{c["id"]}: {type(ex).__name__} {str(ex)[:80]}')
                news[c['id']] = (old.get('news') or {}).get(c['id'], [])
    for cid, xs in from_edition(cs).items():
        have = {x['u'] for x in news.get(cid, [])}
        news.setdefault(cid, []).extend(x for x in xs if x['u'] not in have)
    week = (NOW - dt.timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ')
    fortnight = (NOW - dt.timedelta(days=14)).strftime('%Y-%m-%dT%H:%M:%SZ')
    out_news, n7, alerts = {}, {}, []
    for cid, xs in news.items():
        xs = sorted(xs, key=lambda x: x['p'], reverse=True)[:14]
        for x in xs:
            if not x.get('l'):
                x.pop('l', None)
            if not x.get('m'):
                x.pop('m', None)
        out_news[cid] = xs
        n7[cid] = sum(1 for x in xs if x['p'] >= week)
        hits = [x for x in xs if x['p'] >= fortnight and SPLIT.search(x['t'])]
        if hits:
            alerts.append({'id': cid, 'headlines': [{'t': x['t'], 'u': x['u'], 'o': x['o'], 'p': x['p']} for x in hits[:4]]})
    out = {'v': 1, 'at': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'news': out_news, 'n7': {k: v for k, v in n7.items() if v}, 'alerts': alerts, 'errors': errors[:30]}
    strip = lambda o: {k: v for k, v in o.items() if k not in ('at', 'errors')}
    if old and strip(old) == strip(out):
        print('plusone: unchanged')
        return 0
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'plusone: {sum(len(v) for v in out_news.values())} stories for {len(cs)} couples, {len(alerts)} alerts, {failed} searches failed')
    return 0


# ------------------------------------------------------------------ the written file
FORMAT = """news/plusone/couples.json, written and re-checked weekly by a scheduled Claude task:
{"updated": "ISO time with offset", "model": "Claude ...",
 "couples": [{
   "id": "athlete-slug-partner-slug", "league": "f1|nfl|nba|wnba|mlb|nhl|soccer|tennis|golf|olympics", "sport": "display name, e.g. Soccer · Premier League",
   "athlete": {"name": "", "team": "current team as the Sports desk names it (or '' for individual sports)", "role": "position or discipline",
               "nationality": "", "lg": "optional: the Sports desk file to look the team up in (nfl, nba, wnba, mlb, nhl, mls, soccer)",
               "f1": "Jolpica driverId, for F1 drivers"},
   "partner": {"name": "", "known_for": "short phrase", "fields": ["Music" | "Film & TV" | "Fashion" | "Sport" | "Media" | "Business" | "Social"],
               "nationality": "", "projects": [{"what": "", "when": "YYYY-MM-DD | YYYY-MM | YYYY | ''", "src": [1]}]},
   "status": "married|engaged|dating", "since": "YYYY or YYYY-MM: public since",
   "milestones": [{"date": "YYYY-MM-DD or YYYY-MM", "what": "", "src": [1]}],
   "story": "Markdown, 100 to 260 words, cited [n]", "style": "40 to 160 words, cited", "culture": "40 to 160 words, cited",
   "checked": "YYYY-MM-DD: the day this couple was last confirmed together",
   "sources": [{"t": "title", "o": "outlet", "u": "https://...", "d": "YYYY-MM-DD"}]}]}
Rules: only couples who are public about their relationship (they went public themselves, and at least two
established outlets reported it); only partners who are public figures in their own right; both adults; no children,
homes, health, pregnancy, money, bodies or looks; no rumours; established outlets only, never tabloids; no quotation
over 25 words; [n] cites sources[n-1] of the same couple; a couple that splits up is removed, not written about."""
STATUS = {'married', 'engaged', 'dating'}
LEAGUES = {'f1', 'nfl', 'nba', 'wnba', 'mlb', 'nhl', 'soccer', 'tennis', 'golf', 'olympics'}
FIELDS = {'Music', 'Film & TV', 'Fashion', 'Sport', 'Media', 'Business', 'Social'}
WORD = re.compile(r"[^\W_][\w’'.,%$-]*")


def check():
    errs = []
    try:
        d = json.load(open(COUPLES, encoding='utf-8'))
    except (OSError, ValueError) as ex:
        print(f'couples.json: {ex}'); return 1
    if not re.match(r'^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?[+-]\d\d:\d\d$', str(d.get('updated', ''))):
        errs.append('updated must be an ISO time with its UTC offset')
    if not str(d.get('model', '')).startswith('Claude'):
        errs.append('model must name the Claude model')
    ids = set()
    for c in d.get('couples', []):
        w = c.get('id', '?')
        if w in ids:
            errs.append(f'{w}: duplicate id')
        ids.add(w)
        if not re.match(r'^[a-z0-9]+(-[a-z0-9]+)+$', w):
            errs.append(f'{w}: id must be lowercase words joined by hyphens')
        if c.get('league') not in LEAGUES:
            errs.append(f'{w}: league must be one of {sorted(LEAGUES)}')
        if c.get('status') not in STATUS:
            errs.append(f'{w}: status must be married, engaged or dating')
        a, p = c.get('athlete') or {}, c.get('partner') or {}
        for k in ('name', 'role'):
            if not a.get(k):
                errs.append(f'{w}: athlete.{k} missing')
        if c.get('league') == 'f1' and not a.get('f1'):
            errs.append(f'{w}: F1 drivers need athlete.f1 (the Jolpica driverId)')
        for k in ('name', 'known_for'):
            if not p.get(k):
                errs.append(f'{w}: partner.{k} missing')
        if not p.get('fields') or any(f not in FIELDS for f in p['fields']):
            errs.append(f'{w}: partner.fields must be from {sorted(FIELDS)}')
        src = c.get('sources') or []
        if len(src) < 2:
            errs.append(f'{w}: at least 2 sources')
        for i, s in enumerate(src):
            if not isinstance(s, dict) or not str(s.get('u', '')).startswith('http') or not s.get('t') or not s.get('o'):
                errs.append(f'{w}: source {i + 1} needs t, o and an http u')
            elif NEVER.search(s['u']):
                errs.append(f'{w}: source {i + 1} is a tabloid ({s["u"][:50]})')
        for k, lo, hi in (('story', 100, 260), ('style', 40, 160), ('culture', 40, 160)):
            t = c.get(k) or ''
            n = len(WORD.findall(t))
            if n < lo or n > hi:
                errs.append(f'{w}: {k} is {n} words (wants {lo} to {hi})')
            cs = [int(x) for x in re.findall(r'\[(\d+)\]', t)]
            if not cs:
                errs.append(f'{w}: {k} has no citations')
            for x in cs:
                if x < 1 or x > len(src):
                    errs.append(f'{w}: {k} cites [{x}] past its {len(src)} sources')
            for q in re.findall(r'[“"]([^”"]{2,})[”"]', t):
                if len(WORD.findall(q)) > 25:
                    errs.append(f'{w}: {k} quotes {len(WORD.findall(q))} words (25 at most)')
            if TEXT_SKIP.search(t):
                errs.append(f'{w}: {k} mentions something Plus One leaves out (pregnancy, bodies)')
        for m in (c.get('milestones') or []) + (p.get('projects') or []):
            for x in m.get('src') or []:
                if not isinstance(x, int) or x < 1 or x > len(src):
                    errs.append(f'{w}: a milestone or project cites {x}, past its {len(src)} sources')
        if not re.match(r'^\d{4}-\d\d-\d\d$', str(c.get('checked', ''))):
            errs.append(f'{w}: checked must be a date')
        elif (NOW.date() - dt.date.fromisoformat(c['checked'])).days > 21:
            errs.append(f'{w}: last checked {c["checked"]}, more than three weeks ago')
    if len(ids) < 1:
        errs.append('no couples')
    for e in errs:
        print(e)
    print(f'{len(errs)} problem(s)' if errs else f'ok: {len(ids)} couples')
    return 1 if errs else 0


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['check']:
        sys.exit(check())
    if a[:1] == ['format']:
        print(FORMAT); sys.exit(0)
    sys.exit(build())
