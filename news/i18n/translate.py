#!/usr/bin/env python3
"""The Watch in Portuguese: every article page, translated once and kept in step.

The front page translates itself (news/index.html + news/i18n/pt.json). This script does the rest: the static article
pages (The wave, The money, The Mandate, Three waves, The Checkout, ...), the notes those pages load from JSON, and the
daily reports that have no i18n.pt yet.

How it works
  1. extract   every page in PAGES is parsed (html5lib, the browser's own algorithm) and cut into segments: an element
               that holds text directly is one segment; its inline children (links, bold, footnote marks) become
               numbered placeholders, <1>...</1> or <2/>. news/i18n/lang.js cuts the live page the same way.
  2. translate segments with no translation yet go to Claude in one Message Batch (half price), a page's segments
               together so the model sees the context. Answers are checked (every placeholder kept, nothing empty).
  3. build     one dictionary per page, news/i18n/pt/<page path>.json = {key: translation}; one per JSON file a page
               loads, news/i18n/pt/_data/<path>; news/i18n/pt/ui.json for text the pages' scripts draw; and
               news/i18n/pt/index.json, which lang.js reads first. The dictionaries ARE the translation memory: a
               segment already in any of them is never paid for twice.

  python3 news/i18n/translate.py extract            # what there is, what is missing, what it would cost; no API
  python3 news/i18n/translate.py run [--budget 22] [--wait 50] [--only news/eras/]
  python3 news/i18n/translate.py build              # rewrite the dictionaries from what is already translated
  python3 news/i18n/translate.py cost               # the ledger
  python3 news/i18n/translate.py run --mock         # fake translations, to test the pages without the API

Money: news/i18n/data/spend.json is this script's ledger. The cap (WAVE_CAP, $300 = the API credits) is shared with the
wave's and the money's ledgers; nothing is submitted once the three together reach it, or after UNTIL (the day the
credits expire; past it the API would bill a card). Needs the ANTHROPIC_API_KEY secret, html5lib and beautifulsoup4.

KEEP IN STEP with lang.js: SKIP, BLOCK, has_text(), norm(), the serializer and key(). tools/selftest.py checks them
against a real browser.
"""
import argparse, datetime as dt, glob, hashlib, json, os, random, re, struct, sys, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
LANG = 'pt'; OUT = os.path.join(HERE, LANG); DATA = os.path.join(HERE, 'data')
API = 'https://api.anthropic.com'
MODELS = {'opus': 'claude-opus-5-5', 'sonnet': 'claude-sonnet-5-5', 'haiku': 'claude-haiku-5-5'}
PRICE = {'claude-opus-5-5': {'in': 4.0, 'out': 20.0, 'cache_read': 0.20, 'cache_write': 5.0},
         'claude-sonnet-5-5': {'in': 2.0, 'out': 10.0, 'cache_read': 0.10, 'cache_write': 2.5},
         'claude-haiku-5-5': {'in': 0.10, 'out': 0.50, 'cache_read': 0.01, 'cache_write': 0.125}}   # $ per million tokens (prompts under 100k); a batch is half
CAP = float(os.environ.get('WAVE_CAP', '300'))
UNTIL = os.environ.get('I18N_UNTIL', '2026-12-08')   # the last $100 of credits expires Dec. 9, 2026 UTC
LEDGER = os.path.join(DATA, 'spend.json')
LEDGERS = [LEDGER, os.path.join(ROOT, 'news', 'wave', 'data', 'spend.json'), os.path.join(ROOT, 'news', 'money', 'data', 'spend.json')]
UPKEEP_PER_DAY = 1.5   # scheduled runs together, dollars a day

# ---------- what is translated ----------
PAGES = ['news/mandate/', 'news/eras/', 'news/prices/', 'news/prophecy/', 'news/wave/', 'news/money/',
         'news/sports/dressage-finals/', 'news/household/craftmas/']
NOT_PAGES = re.compile(r'(^|/)(render[\w-]*\.html|.*\.fragment\.html|tools/.*)$')
# JSON the pages load and draw as text. 'notes': {"notes": {id: {"t": text}}}; 'prose': every string of four words or more under the listed keys.
DATA_FILES = [('news/wave/data/notes/*.json', 'notes', None), ('news/wave/data/house/notes.json', 'notes', None),
              ('news/wave/data/night.json', 'prose', ['captions']), ('news/mandate/data/analysis.json', 'prose', ['tour'])]
UI_SRC = os.path.join(HERE, 'src', 'ui.json')   # text the pages' scripts draw (collected with tools/collect_ui.py), numbers masked as {1}

def tier(src):
    """0 first. The order things are sent in when the budget does not cover everything."""
    if src.startswith('data:'): return 3
    if src == 'ui' or re.match(r'news/(mandate|eras|prices|prophecy)/', src): return 0
    if re.match(r'news/wave/(index|house|border|south-texas|southeast|midwest|deep-south|moved-right)\.html$', src) or src == 'news/money/index.html': return 0
    if re.match(r'news/wave/(county|house)-', src): return 2
    return 1
def model_for(src): return MODELS[('opus', 'opus', 'sonnet', 'haiku')[tier(src)]]   # Opus: the flagship pages and the state pieces; Sonnet: the county and House pieces; Haiku: the 3,200 short notes
THINK = {'claude-sonnet-5-5': {'type': 'between_tools'}, 'claude-haiku-5-5': {'type': 'disabled'}}   # no up-front thinking where it can be turned off; Opus 5.5 always thinks, low effort keeps it short

# ---------- the segments (the same walk as lang.js) ----------
SKIP = 'script,style,noscript,template,textarea,code,pre,svg title,svg desc,[translate="no"],.notranslate,.sources ol,.srcs,.cite,.wl-ui'
BLOCK = set('address article aside blockquote details dd div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p section table tbody thead tfoot tr td th ul summary select option button svg g text canvas video iframe'.split())
ATTRS = ['title', 'aria-label', 'placeholder', 'alt']
WS = re.compile(r'[ \t\n\r\f]+'); LETTERS = re.compile(r'[A-Za-zÀ-ɏ]{2}')
def has_text(s): return bool(LETTERS.search(s))
def norm(s): return WS.sub(' ', s)
def trim(s): return s.strip(' ')
def key(s):
    """cyrb53 over UTF-16 code units, base 36: the same number lang.js computes."""
    b = s.encode('utf-16-le'); h1, h2 = 0xdeadbeef, 0x41c6ce57; M = 0xFFFFFFFF
    for ch in struct.unpack('<%dH' % (len(b) // 2), b):
        h1 = ((h1 ^ ch) * 2654435761) & M; h2 = ((h2 ^ ch) * 1597334677) & M
    h1 = (((h1 ^ (h1 >> 16)) * 2246822507) & M) ^ (((h2 ^ (h2 >> 13)) * 3266489909) & M)
    h2 = (((h2 ^ (h2 >> 16)) * 2246822507) & M) ^ (((h1 ^ (h1 >> 13)) * 3266489909) & M)
    n = 4294967296 * (2097151 & h2) + h1; out = ''
    while True:
        n, r = divmod(n, 36); out = '0123456789abcdefghijklmnopqrstuvwxyz'[r] + out
        if not n: return out

def page_segments(html):
    """Every segment of a page, in order, as lang.js's segments() returns them."""
    from bs4 import BeautifulSoup, NavigableString, Tag
    soup = BeautifulSoup(html, 'html5lib'); skip = set(id(e) for e in soup.select(SKIP)); out = []
    def is_text(c): return type(c) is NavigableString
    def text_of(el): return ''.join(s for s in el.find_all(string=True) if type(s) is NavigableString or s.parent.name in ('script', 'style'))
    def attrs(el):
        for a in ATTRS:
            v = el.get(a)
            if isinstance(v, list): v = ' '.join(v)
            if v and has_text(v): out.append(trim(norm(v)))
    def serialize(el, ctx):
        s = ''
        for c in el.children:
            if is_text(c): s += str(c)
            elif isinstance(c, Tag):
                ctx['n'] += 1; i = ctx['n']
                if id(c) in skip: s += f'<{i}/>'
                elif c.name.lower() in BLOCK or not has_text(text_of(c)): s += f'<{i}/>'; ctx['later'].append(c)
                else: ctx['open'].append(c); s += f'<{i}>' + serialize(c, ctx) + f'</{i}>'
        return s
    def visit(el):
        if id(el) in skip: return
        attrs(el)
        if any(is_text(c) and has_text(str(c)) for c in el.children):
            ctx = {'n': 0, 'later': [], 'open': []}; out.append(trim(norm(serialize(el, ctx))))
            for c in ctx['open']: attrs(c)
            for c in ctx['later']: visit(c)
        else:
            for c in el.children:
                if isinstance(c, Tag): visit(c)
    head = soup.head
    if head:
        t = head.find('title', recursive=False)
        if t and has_text(t.get_text()): out.insert(0, trim(norm(t.get_text())))
        m = head.find('meta', attrs={'name': 'description'}, recursive=False)
        if m and has_text(m.get('content') or ''): out.insert(1 if t else 0, trim(norm(m.get('content'))))
    if soup.body: visit(soup.body)
    return [s for s in out if s]

def page_title(html):
    m = re.search(r'<title[^>]*>(.*?)</title>', html, re.S | re.I)
    return re.sub(r'\s+', ' ', re.sub(r'&amp;', '&', m.group(1))).strip() if m else ''

def data_segments(path, mode, keys):
    try: d = json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError): return []
    out = []
    def para(t):
        for p in re.split(r'\n\s*\n', t):
            p = trim(norm(p.replace(' ', ' ')))
            if p and has_text(p): out.append(p)
    if mode == 'notes':
        for v in (d.get('notes') or {}).values():
            if isinstance(v, dict) and isinstance(v.get('t'), str): para(v['t'])
    else:
        def walk(o):
            if isinstance(o, str):
                if len(o.split()) >= 4 and re.search(r'[a-z]{3}', o) and not re.match(r'https?://', o) and '<' not in o: para(o)
            elif isinstance(o, list): [walk(x) for x in o]
            elif isinstance(o, dict): [walk(x) for x in o.values()]
        for k in (keys or list(d.keys()) if isinstance(d, dict) else []): walk(d.get(k))
    return out

def list_pages():
    out = []
    for pre in PAGES:
        for p in sorted(glob.glob(os.path.join(ROOT, pre, '**', '*.html'), recursive=True)):
            r = os.path.relpath(p, ROOT).replace(os.sep, '/')
            if not NOT_PAGES.search(r): out.append(r)
    return out

def _one(r):
    try: html = open(os.path.join(ROOT, r), encoding='utf-8').read()
    except (OSError, UnicodeDecodeError): return r, '', []
    if 'data-wl-off' in html[:600]: return r, '', []
    return r, page_title(html), page_segments(html)

def extract(only=None):
    """{source: {'title', 'segs': [str]}} for every page ('news/...html'), data file ('data:news/...json') and 'ui'."""
    pages = [r for r in list_pages() if not only or r.startswith(only)]; S = {}
    try:
        from multiprocessing import Pool
        with Pool(min(8, os.cpu_count() or 2)) as pool: rows = pool.map(_one, pages, chunksize=8)
    except (ImportError, OSError): rows = [_one(r) for r in pages]
    for r, title, segs in rows:
        if segs: S[r] = {'title': title, 'segs': segs}
    for pat, mode, keys in DATA_FILES:
        for p in sorted(glob.glob(os.path.join(ROOT, pat))):
            r = os.path.relpath(p, ROOT).replace(os.sep, '/')
            if os.path.basename(p).startswith('_') or (only and not r.startswith(only)): continue
            segs = data_segments(p, mode, keys)
            if segs: S['data:' + r] = {'title': r, 'segs': segs}
    ui = load(UI_SRC, {}) or {}   # what the pages' scripts draw: {"manual": [...], "shared": [...], "pages": {page: [...]}}
    for r, segs in (ui.get('pages') or {}).items():
        if r in S: S[r]['segs'] = S[r]['segs'] + [s for s in segs if s not in set(S[r]['segs'])]
    shared = [s for s in (ui.get('manual') or []) + (ui.get('shared') or []) if isinstance(s, str) and s]
    if shared and not only: S['ui'] = {'title': 'Interface text drawn by the pages\' scripts (buttons, labels, map and chart captions). {1}, {2} are numbers filled in later.', 'segs': shared}
    return S

PH = re.compile(r'<(/?)(\d+)(/?)>'); SLOT = re.compile(r'\{\d+\}')
MASK = re.compile(r'</?\d+/?>|\d[\d,]*\.\d+|\d{1,3}(?:,\d{3})+|\d+')
def mask(s):
    """'254 of 254 counties' -> '{1} of {2} counties': how lang.js looks up text whose numbers the scripts fill in."""
    n = [0]
    def f(m):
        if m.group(0)[0] == '<': return m.group(0)
        n[0] += 1; return '{%d}' % n[0]
    return MASK.sub(f, s)
def plain(s): return PH.sub('', s)
def needs_translation(s): return bool(re.search(r'[a-zß-ɏ]{2}', plain(s)))   # all-caps codes, initials and numbers stay as they are
def valid(src, t):
    if not t or '[[' in t: return False
    if sorted(PH.findall(src)) != sorted(PH.findall(t)): return False
    if sorted(SLOT.findall(src)) != sorted(SLOT.findall(t)): return False
    if len(src) >= 24 and not 0.3 <= len(t) / len(src) <= 4: return False
    return True

# ---------- files ----------
def now(): return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
def load(p, default=None):
    try:
        with open(p, encoding='utf-8') as f: return json.load(f)
    except (OSError, ValueError): return default
def save(p, obj, compact=True):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    s = json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(',', ':') if compact else None, indent=None if compact else 1)
    if compact and isinstance(obj, dict) and len(s) > 400: s = '{\n' + ',\n'.join(json.dumps(k, ensure_ascii=False) + ':' + json.dumps(v, ensure_ascii=False, sort_keys=True, separators=(',', ':')) for k, v in sorted(obj.items())) + '\n}'
    try:
        if open(p, encoding='utf-8').read() == s + '\n': return False
    except OSError: pass
    with open(p, 'w', encoding='utf-8') as f: f.write(s + '\n')
    return True
def dict_path(src):
    if src == 'ui': return os.path.join(OUT, 'ui.json')
    if src.startswith('data:'): return os.path.join(OUT, '_data', src[5:])
    return os.path.join(OUT, re.sub(r'\.html$', '.json', src))
SERVED = os.path.join(DATA, 'served.json'); SAME = os.path.join(DATA, 'same.json'); FAILED = os.path.join(DATA, 'failed.json'); BATCH = os.path.join(DATA, 'batch.json'); STATUS = os.path.join(DATA, 'status.json')

def memory():
    """Everything translated so far: {key: translation}, read back from the dictionaries (they are the memory)."""
    M = {}
    for p in glob.glob(os.path.join(OUT, '**', '*.json'), recursive=True):
        if os.path.basename(p) == 'index.json' and os.path.dirname(p) == OUT: continue
        d = load(p, {})
        if isinstance(d, dict): M.update({k: v for k, v in d.items() if isinstance(v, str)})
    return M

def build(S, M, same):
    """Write the dictionaries and the index from the memory. Returns the status."""
    index = {'v': 1, 'lang': 'pt-BR', 'pages': {}, 'data': {}}; keep = set(); st = {}
    for src, v in S.items():
        d = {}; n = miss = 0
        for s in v['segs']:
            if not needs_translation(s): continue
            n += 1; k = key(s)
            if k in M: d[k] = M[k]
            elif k not in same: miss += 1
        sec = 'ui' if src == 'ui' else '/'.join(src.replace('data:', '').split('/')[:2]) + ('/ (notes)' if src.startswith('data:') else '/')
        a = st.setdefault(sec, {'sources': 0, 'segments': 0, 'missing': 0, 'complete': 0}); a['sources'] += 1; a['segments'] += n; a['missing'] += miss; a['complete'] += (miss == 0)
        if not d: continue
        p = dict_path(src); save(p, d); keep.add(os.path.normpath(p))
        h = hashlib.sha1(json.dumps(d, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:8]
        if src == 'ui': index['ui'] = h
        elif src.startswith('data:'): index['data'][src[5:]] = h
        else: index['pages'][src] = h
    full = not ARGS_ONLY
    if full:
        for p in glob.glob(os.path.join(OUT, '**', '*.json'), recursive=True):   # dictionaries of pages that are gone
            if os.path.normpath(p) not in keep and os.path.normpath(p) != os.path.normpath(os.path.join(OUT, 'index.json')): os.remove(p)
        save(os.path.join(OUT, 'index.json'), index, compact=False)
        tot = {'segments': sum(a['segments'] for a in st.values()), 'missing': sum(a['missing'] for a in st.values())}
        old = load(STATUS, {})
        new = {'v': 1, 'lang': 'pt-BR', 'sections': st, 'total': tot, 'pages': len(index['pages']), 'data_files': len(index['data'])}
        if {k: v for k, v in old.items() if k != 'updated'} != new: save(STATUS, dict(new, updated=now()), compact=False)
    return st
ARGS_ONLY = None

# ---------- the ledger ----------
def ledger(): return load(LEDGER, {'v': 1, 'usd': 0.0, 'runs': []})
def ledger_total(): return round(sum((load(p, {}) or {}).get('usd', 0.0) for p in LEDGERS), 4)
def price(model, usage, batch=True):
    P = PRICE[model]; u = usage or {}
    usd = (u.get('input_tokens', 0) * P['in'] + u.get('output_tokens', 0) * P['out'] + u.get('cache_read_input_tokens', 0) * P['cache_read'] + u.get('cache_creation_input_tokens', 0) * P['cache_write']) / 1e6
    return usd * (0.5 if batch else 1.0)
def charge(job, what, usd, tok):
    L = ledger(); L['usd'] = round(L.get('usd', 0.0) + usd, 4)
    L['runs'].append(dict({'when': now(), 'job': job, 'what': what, 'usd': round(usd, 5), 'batch': True}, **tok)); L['runs'] = L['runs'][-2000:]
    save(LEDGER, L, compact=False)
    print(f'  charged ${usd:.2f} for {what} (this ledger ${L["usd"]:.2f}; all ${ledger_total():.2f} of the ${CAP:.0f} cap)', flush=True)

# ---------- the API ----------
def api(path, body=None, raw=False, url=None):
    k = os.environ.get('ANTHROPIC_API_KEY')
    if not k: raise RuntimeError('ANTHROPIC_API_KEY is not set')
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url or API + path, data=data, method='POST' if data else 'GET')
    req.add_header('x-api-key', k); req.add_header('anthropic-version', '2023-06-01'); req.add_header('content-type', 'application/json')
    for attempt in range(7):
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                b = r.read(); return b.decode('utf-8', 'replace') if raw else json.loads(b)
        except urllib.error.HTTPError as e:
            txt = e.read().decode('utf-8', 'replace')[:800]
            if e.code in (429, 500, 502, 503, 504, 529) and attempt < 6:
                wait = float(e.headers.get('retry-after') or 0) or min(120, 8 * 2 ** attempt) + random.random() * 3
                print(f'  API {e.code}, retry in {wait:.0f}s: {txt[:120]}', flush=True); time.sleep(wait); continue
            raise RuntimeError(f'API {e.code} {path}: {txt}')
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt < 6: time.sleep(min(120, 8 * 2 ** attempt)); continue
            raise RuntimeError(f'network: {e}')

SYSTEM = """You translate The Watch, an English-language news site, into Brazilian Portuguese (pt-BR) for readers in Brazil. You are given numbered segments of one page: headlines, paragraphs, table headers, captions, button labels, short notes. Translate every one.

FORMAT
- Answer with the same markers in the same order: each segment starts with its marker, [[1]], [[2]], ..., then the translation. Nothing else: no preface, no notes, no explanations, no code fences.
- Tags such as <1>...</1> and <2/> stand for links, bold or italic text, footnote marks, line breaks and icons. Keep every tag of a segment exactly once, with the same number, around the words that correspond to the ones it wrapped in English. You may move a tag to follow Portuguese word order. Never add, drop, renumber or translate a tag.
- {1}, {2} are numbers the page fills in later. Keep each one exactly once.
- A segment that is only a name, a code or something that needs no translation is returned unchanged.

HOW TO TRANSLATE
- Translate everything, completely and faithfully. Never summarize, soften, add, explain or correct. No translator's notes.
- Write the natural Portuguese of a good Brazilian newspaper (Folha, Estadão, g1): direct, clear, not word for word. Headlines and labels stay short; headlines take no final period and capitalize only the first word and proper nouns.
- Quotations are translated, in “aspas duplas”.
- Keep in the original: names of people, companies, organizations, agencies, publications, programs, laws, court cases, committees and PACs; "The Watch" and the names of its sections (The wave, The money, The Mandate, The Checkout, Three waves, The Pulse, The Call Desk); abbreviations such as AP, ICE, DHS, FEC, GOP, PAC, BLS, CPI, S&P 500. A first mention may take a short gloss only if the English already has one.
- Places: use the Portuguese name where the Brazilian press does (Estados Unidos, Nova York, Califórnia, Flórida, Pensilvânia, Geórgia, Virgínia, Virgínia Ocidental, Carolina do Norte, Carolina do Sul, Dakota do Norte, Dakota do Sul, Novo México, Nova Jersey, Havaí, Golfo do México); otherwise keep the name (Texas, Ohio, Iowa, Michigan, Wisconsin, Arizona). "Harris County" is "condado de Harris"; "Travis County, Texas" is "condado de Travis, no Texas"; Louisiana's parishes are "paróquias".
- Terms: county = condado; the House = a Câmara; House seat/district = cadeira/distrito da Câmara; Senate = Senado; governor = governador(a); Democrat(ic) = democrata; Republican = republicano(a); midterms = eleições de meio de mandato; incumbent = atual ocupante do cargo or candidato(a) à reeleição; runoff = segundo turno; turnout = comparecimento; margin = margem; points = pontos percentuais on first mention in a paragraph, then pontos; moved/shifted left (right) = foi para a esquerda (direita); the move/shift/swing = o deslocamento; to flip a seat = virar a cadeira; a flip = virada; AP called the race = a AP declarou o vencedor; uncalled = sem vencedor declarado; outside money = dinheiro de grupos externos; donor = doador; executive order = ordem executiva; Supreme Court = Suprema Corte; injunction = liminar; ruling = decisão; lawsuit = ação judicial; tariff = tarifa; Project 2025 = Projeto 2025; fact-check = checagem; receipt (till receipt) = nota fiscal or cupom; grocery prices = preços de supermercado.
- Party-margin labels stay in their form with a decimal comma: D+5.2 = D+5,2; R+12 = R+12.
- Numbers follow Brazilian usage and never change value: 1,234.5 = 1.234,5; 12.5% = 12,5%; $1.4 billion = US$ 1,4 bilhão; $250,000 = US$ 250 mil or US$ 250.000; million = milhão/milhões; billion = bilhão/bilhões; trillion = trilhão/trilhões. Never convert currencies or units (miles = milhas, pounds = libras).
- Dates and times: Nov. 3, 2026 = 3 de novembro de 2026 (3 de nov. de 2026 where space is tight); 7:54 PM ET = 19h54 (horário de Nova York). Months and weekdays in lower case.
- Interface text is translated as an interface: Share = Compartilhar; Download = Baixar; Full screen = Tela cheia; Play = Reproduzir; Sources = Fontes; Back = Voltar; Search = Buscar; Read more = Leia mais.
"""
REPORT_SYSTEM = """You translate one report of The Watch, an English-language news site, into Brazilian Portuguese (pt-BR) for readers in Brazil. Translate all of it, completely and faithfully: no summary, no additions, no notes. Write the natural Portuguese of a good Brazilian newspaper, not word for word.

Keep exactly as they are: every citation mark such as [3] or [3][5], in the same sentence as in English; every line that begins with "## " as a "## " heading (translate its text); any line that begins with ":::" and anything between such lines; Markdown such as **bold** and "- " lists; names of people, organizations, publications, laws and court cases. Places take the Portuguese name where the Brazilian press uses one. Numbers follow Brazilian usage without changing value (1,234.5 = 1.234,5; $1.4 billion = US$ 1,4 bilhão); never convert currencies or units. Dates: Nov. 3, 2026 = 3 de novembro de 2026. No HTML.

Answer in exactly this shape and nothing else:
TITLE: the headline (no final period)
DEK: the summary line (at most 340 characters)
BODY:
the whole body
"""

def est_tokens(text): return int(len(text) / 2.7) + 4   # on the high side, so the budget holds
def chunks(S, M, same, failed, only_tier=None):
    """Requests for what is missing: [{'src', 'model', 'segs': [(key, text)], 'est': usd}], best first. A segment goes out once, with the first page that has it."""
    seen = set(); reqs = []
    for src in sorted(S, key=lambda s: (tier(s), s)):
        if only_tier is not None and tier(src) > only_tier: continue
        todo = []
        for s in S[src]['segs']:
            if not needs_translation(s): continue
            k = key(s)
            if k in M or k in same or k in seen or failed.get(k, 0) >= 2: continue
            seen.add(k); todo.append((k, s))
        i = 0
        while i < len(todo):
            part = []; words = 0
            while i < len(todo) and len(part) < 70 and (words < 1500 or not part):
                part.append(todo[i]); words += len(todo[i][1].split()); i += 1
            m = model_for(src); tin = sum(est_tokens(s) + 6 for _, s in part) + 60; P = PRICE[m]
            est = (tin * P['in'] + 1700 * P['cache_read'] + tin * 1.6 * P['out']) / 1e6 * 0.5
            reqs.append({'src': src, 'title': S[src]['title'], 'model': m, 'segs': part, 'est': est, 'tin': tin})
    return reqs
def params(r):
    body = f"Page: {r['title']}\nPath: {r['src']}\n\nSegments:\n" + '\n'.join(f'[[{i + 1}]] {s}' for i, (_, s) in enumerate(r['segs']))
    p = {'model': r['model'], 'max_tokens': min(60000, max(3000, r['tin'] * 4)), 'output_config': {'effort': 'low'},
         'system': [{'type': 'text', 'text': SYSTEM, 'cache_control': {'type': 'ephemeral'}}], 'messages': [{'role': 'user', 'content': body}]}
    if r['model'] in THINK: p['thinking'] = THINK[r['model']]
    return p
def parse(text):
    parts = re.split(r'\[\[(\d+)\]\]', text); out = {}
    for i in range(1, len(parts) - 1, 2): out[int(parts[i])] = trim(norm(parts[i + 1]))
    return out

# the daily reports (news/articles/*.json) that have no Portuguese yet
ART = os.path.join(ROOT, 'news', 'articles')
def words(t): return len(re.findall(r'\S+', t))
def reports_todo():
    out = []
    for p in sorted(glob.glob(os.path.join(ART, '*.json'))):
        if os.path.basename(p) == 'index.json': continue
        a = load(p)
        if isinstance(a, dict) and a.get('body') and a.get('title') and not (a.get('i18n') or {}).get(LANG): out.append((p, a))
    return out
def report_params(a):
    tin = est_tokens(a['body']) + 200
    return {'model': MODELS['opus'], 'max_tokens': min(60000, tin * 4), 'output_config': {'effort': 'low'}, 'system': [{'type': 'text', 'text': REPORT_SYSTEM}],
            'messages': [{'role': 'user', 'content': f"TITLE: {a['title']}\nDEK: {a.get('dek', '')}\nBODY:\n{a['body']}"}]}, (tin * 4.0 + tin * 1.6 * 20.0) / 1e6 * 0.5
def report_ok(a, t):
    body = a['body']; cited = set(re.findall(r'\[(\d{1,2})\](?!\()', body))
    if not (t.get('title') and t.get('dek') and t.get('body')): return 'missing a part'
    if not 0.75 <= words(t['body']) / max(1, words(body)) <= 1.45: return 'length'
    if len(re.findall(r'^## ', t['body'], re.M)) != len(re.findall(r'^## ', body, re.M)): return 'sections'
    if set(re.findall(r'\[(\d{1,2})\](?!\()', t['body'])) != cited: return 'citations'
    if re.search(r'<\s*/?\s*[a-zA-Z][^>]*>', t['body']): return 'html'
    if len(t['dek']) > 360: return 'dek too long'
    return None
def parse_report(text):
    m = re.search(r'TITLE:\s*(.+?)\s*\nDEK:\s*(.+?)\s*\nBODY:\s*\n(.+)', text, re.S)
    return {'title': m.group(1).strip(), 'dek': m.group(2).strip(), 'body': m.group(3).strip(), 'model': 'Claude Opus 5.5'} if m else {}

# ---------- run ----------
def collect(S, M, same, failed, wait):
    """Read a finished batch into the memory. Returns True when no batch is out any more."""
    pend = load(BATCH)
    if not pend: return True
    waited = 0
    while True:
        b = api(f"/v1/messages/batches/{pend['id']}"); rc = b.get('request_counts') or {}
        print(f"batch {pend['id']}: {b.get('processing_status')} ({rc.get('processing', '?')} processing, {rc.get('succeeded', 0)} done, {rc.get('errored', 0)} errored, {rc.get('expired', 0)} expired)", flush=True)
        if b.get('processing_status') == 'ended': break
        if waited >= wait: print('still running; the next run collects it'); return False
        time.sleep(120); waited += 2
    os.remove(BATCH)   # first, so a crash below cannot collect (and charge) the same batch twice
    if any(pend['id'] in (r.get('what') or '') for r in ledger()['runs']): print('already collected and charged'); return True
    if not b.get('results_url'): print('no results'); return True
    src_of = {}
    for v in S.values():
        for s in v['segs']: src_of.setdefault(key(s), s)
    ok = bad = gone = rep_ok = rep_bad = 0; usd = 0.0; tok = {'in': 0, 'out': 0, 'cache_read': 0, 'cache_write': 0}
    for line in api('', raw=True, url=b['results_url']).splitlines():
        if not line.strip(): continue
        o = json.loads(line); cid = o.get('custom_id'); res = o.get('result') or {}; meta = pend['map'].get(cid)
        if not meta: continue
        if res.get('type') != 'succeeded':
            for k in meta.get('keys', []): failed[k] = failed.get(k, 0) + 1
            bad += len(meta.get('keys', [])) or 1; continue
        msg = res['message']; u = msg.get('usage') or {}; usd += price(meta['model'], u)
        tok['in'] += u.get('input_tokens', 0); tok['out'] += u.get('output_tokens', 0); tok['cache_read'] += u.get('cache_read_input_tokens', 0); tok['cache_write'] += u.get('cache_creation_input_tokens', 0)
        text = ''.join(c.get('text', '') for c in msg.get('content', []) if c.get('type') == 'text')
        if meta.get('report'):
            p = os.path.join(ART, meta['report'] + '.json'); a = load(p); t = parse_report(text); why = report_ok(a, t) if a else 'gone'
            if why: print(f"  report {meta['report']}: not used ({why})"); rep_bad += 1; continue
            a.setdefault('i18n', {})[LANG] = t
            with open(p, 'w', encoding='utf-8') as f: json.dump(a, f, ensure_ascii=False, indent=1); f.write('\n')
            rep_ok += 1; continue
        got = parse(text); cut = msg.get('stop_reason') == 'max_tokens'
        for i, k in enumerate(meta['keys']):
            src = src_of.get(k); t = got.get(i + 1)
            if src is None: gone += 1; continue
            if cut and i + 1 == max(got or [0]): t = None   # the last one may be cut off
            if t is not None and valid(src, t):
                if t == src: same.add(k)
                else: M[k] = t
                ok += 1; failed.pop(k, None)
            else: failed[k] = failed.get(k, 0) + 1; bad += 1
    charge(pend.get('job', 'run'), f"batch {pend['id']}: {ok} segments, {rep_ok} reports", usd, tok)
    print(f'collected: {ok} segments ({bad} rejected or errored, {gone} no longer on a page), {rep_ok} reports ({rep_bad} not used)')
    save(SAME, sorted(same)); save(FAILED, failed)
    return True

def cmd_run(a):
    global ARGS_ONLY
    ARGS_ONLY = a.only
    S = extract(a.only); M = memory(); same = set(load(SAME, [])); failed = load(FAILED, {})
    if a.mock:
        n = 0
        for v in S.values():
            for s in v['segs']:
                if needs_translation(s) and key(s) not in M: M[key(s)] = PH.split(s)[0] and ('‹pt› ' + s) or s; n += 1
        print(f'mock: {n} made-up translations (never commit these)'); build(S, M, same); return
    have_key = bool(os.environ.get('ANTHROPIC_API_KEY'))
    clear = collect(S, M, same, failed, a.wait) if have_key else not load(BATCH)
    if clear and have_key:
        today = now()[:10]; spent_today = sum(r['usd'] for r in ledger()['runs'] if r['when'][:10] == today and r.get('job') == 'upkeep')
        room = CAP - ledger_total(); budget = min(a.budget, room) if a.job != 'upkeep' else min(a.budget, room, UPKEEP_PER_DAY - spent_today)
        reqs = chunks(S, M, same, failed); reps = [] if (a.only or a.no_reports) else reports_todo()
        if today > UNTIL: print(f'past {UNTIL}: the credits have expired, nothing is sent (set I18N_UNTIL to change that)'); reqs = reps = []
        batch = []; meta = {}; est = 0.0
        for p, art in reps:
            prm, e = report_params(art)
            if est + e > budget: break
            cid = f'r{len(batch)}'; batch.append({'custom_id': cid, 'params': prm}); meta[cid] = {'report': os.path.basename(p)[:-5], 'model': MODELS['opus']}; est += e
        left = 0
        for r in reqs:
            if est + r['est'] > budget: left += len(r['segs']); continue
            cid = f'c{len(batch)}'; batch.append({'custom_id': cid, 'params': params(r)}); meta[cid] = {'keys': [k for k, _ in r['segs']], 'model': r['model'], 'src': r['src']}; est += r['est']
        print(f"to translate: {sum(len(r['segs']) for r in reqs)} segments in {len(reqs)} requests, {len(reps)} reports; budget ${budget:.2f}; sending {len(batch)} requests (~${est:.2f}); {left} segments wait for a later run")
        if batch and not a.dry:
            resp = api('/v1/messages/batches', {'requests': batch})
            save(BATCH, {'id': resp['id'], 'submitted': now(), 'n': len(batch), 'estimate_usd': round(est, 2), 'job': a.job, 'map': meta})
            if getattr(a, 'request', None): save(SERVED, {'requested': a.request, 'batch': resp['id'], 'when': now()})
            print(f"batch {resp['id']} submitted"); collect(S, M, same, failed, a.wait)
    elif not have_key: print('no ANTHROPIC_API_KEY: building from what is already translated')
    st = build(S, M, same)
    for sec, v in sorted(st.items()): print(f"  {sec:32s} {v['complete']:4d}/{v['sources']:<4d} complete, {v['segments'] - v['missing']:6d}/{v['segments']:<6d} segments")

def cmd_extract(a):
    global ARGS_ONLY
    ARGS_ONLY = a.only
    S = extract(a.only); M = memory(); same = set(load(SAME, [])); failed = load(FAILED, {})
    reqs = chunks(S, M, same, failed); by = {}
    for r in reqs:
        b = by.setdefault((tier(r['src']), r['model']), [0, 0, 0.0]); b[0] += len(r['segs']); b[1] += sum(len(s.split()) for _, s in r['segs']); b[2] += r['est']
    tot = sum(len(v['segs']) for v in S.values())
    print(f'{len(S)} sources, {tot} segments ({sum(len(set(v["segs"])) for v in S.values())} distinct within their page), {len(M)} translations in memory')
    for (t, m), (n, w, e) in sorted(by.items()): print(f'  tier {t} {m}: {n} segments, {w:,} words, ~${e:.2f}')
    reps = reports_todo(); re_est = sum(report_params(x)[1] for _, x in reps)
    print(f'  reports without Portuguese: {len(reps)}, ~${re_est:.2f}')
    print(f'  total ~${sum(r["est"] for r in reqs) + re_est:.2f} at batch rates; ledgers ${ledger_total():.2f} of the ${CAP:.0f} cap')
    if a.show:
        for r in reqs[:a.show]: print('\n' + params(r)['messages'][0]['content'][:3000])

def cmd_cost(a):
    L = ledger(); print(f"translation ledger ${L.get('usd', 0):.2f} over {len(L['runs'])} batches; all ledgers ${ledger_total():.2f} of the ${CAP:.0f} cap")
    for r in L['runs'][-12:]: print(f"  {r['when']} {r['job']}: ${r['usd']:.2f} {r['what']}")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd', choices=['run', 'extract', 'build', 'cost'])
    ap.add_argument('--budget', type=float, default=None); ap.add_argument('--wait', type=int, default=0, help='minutes to wait for the batch')
    ap.add_argument('--only', default=None, help='a path prefix, e.g. news/eras/'); ap.add_argument('--job', default=None)
    ap.add_argument('--mock', action='store_true'); ap.add_argument('--dry', action='store_true'); ap.add_argument('--no-reports', action='store_true'); ap.add_argument('--show', type=int, default=0)
    a = ap.parse_args()
    rq = load(os.path.join(HERE, 'run.json'), {}) or {}   # a request for a bigger run: {"requested": "<time>", "budget": dollars}; served once
    open_request = bool(rq.get('requested')) and (load(SERVED, {}) or {}).get('requested') != rq.get('requested')
    if a.job is None: a.job = 'run' if (open_request or a.budget is not None) else 'upkeep'
    if a.budget is None: a.budget = float(rq.get('budget', 0)) if a.job == 'run' else UPKEEP_PER_DAY
    a.request = rq.get('requested') if open_request else None
    if a.cmd == 'extract': return cmd_extract(a)
    if a.cmd == 'cost': return cmd_cost(a)
    if a.cmd == 'build':
        global ARGS_ONLY
        ARGS_ONLY = a.only; S = extract(a.only); build(S, memory(), set(load(SAME, []))); return
    cmd_run(a)

if __name__ == '__main__':
    main()
