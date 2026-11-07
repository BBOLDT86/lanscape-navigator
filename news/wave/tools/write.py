#!/usr/bin/env python3
"""The wave, written: Claude (the API) writes a reported, cited piece for every state with a race and a short note for
every county, from news/wave/data/shift.json. Standard library only; the key is the ANTHROPIC_API_KEY environment
variable (a repository secret in .github/workflows/wave-write.yml).

  python3 news/wave/tools/write.py context                 # Census ACS context per county -> data/context.json
  python3 news/wave/tools/write.py states [--budget 150] [--states TX,OH] [--effort high] [--redo] [--parallel 3]
                                                            # one call per state (Opus 5.5 + web search) -> data/reports/<ST>.json
  python3 news/wave/tools/write.py counties [--budget 40] [--states ...] [--wait 300] [--redo]
                                                            # a Message Batch for every county -> data/notes/<ST>.json
  python3 news/wave/tools/write.py collect [--wait 0]      # pick up a batch submitted earlier
  python3 news/wave/tools/write.py refresh [--budget 3.5]  # rewrite what the count has moved since it was written
  python3 news/wave/tools/write.py cost                    # the ledger (data/spend.json)
  python3 news/wave/tools/write.py check                   # validate the reports and notes

Every response's usage is priced and added to data/spend.json; a run stops starting new work once its --budget is
spent (a batch is sized to fit before it is submitted). --mock writes made-up output without calling the API, for
testing the pages. --dry prints one prompt and exits.
"""
import json, os, re, sys, time, math, random, argparse, statistics, threading, urllib.request, urllib.error, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import voters

HERE = os.path.dirname(os.path.abspath(__file__)); W = os.path.normpath(os.path.join(HERE, '..')); DATA = os.path.join(W, 'data')
API = 'https://api.anthropic.com'
MODEL = 'claude-opus-5-5'
# $ per million tokens (platform.claude.com, Nov. 2026): Opus 5.5 $4 in / $20 out, cache read $0.20, 5-min cache write $5;
# the Batch API bills half; web search $10 per 1,000 searches.
PRICE = {'in': 4.0, 'out': 20.0, 'cache_read': 0.20, 'cache_write': 5.0, 'search': 0.01}
CAP = float(os.environ.get('WAVE_CAP', '400'))  # dollars, all jobs, all time: nothing new starts once the ledger reaches it
F2S = {'01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY'}
S2F = {v: k for k, v in F2S.items()}
NAME = {'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'}
COUNTY_WORD = {'LA': 'parish', 'AK': 'borough'}
AREAS = {'south-texas': ['TX'], 'southeast': ['GA', 'NC', 'SC', 'FL', 'VA'], 'midwest': ['OH', 'IA', 'KS', 'MI', 'WI', 'MN', 'NE', 'IL'], 'deep-south': ['MS', 'AL', 'LA', 'KY', 'WV', 'TN', 'AR', 'OK'], 'moved-right': ['VT', 'ME', 'NH', 'NY', 'MA', 'MD']}
AREA_TITLE = {'south-texas': 'The border counties that swung hardest', 'southeast': 'The Southeast: every county in four states, and most of Florida', 'midwest': 'The Midwest: Ohio, Iowa and Kansas flip', 'deep-south': 'The Deep South and Appalachia: the reddest counties moved too', 'moved-right': 'Where the map moved right'}
LOCK = threading.Lock()
MOCK = False


def now(): return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
def load(p, default=None):
    try: return json.load(open(p, encoding='utf-8'))
    except FileNotFoundError: return default
def save(p, obj):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + '.tmp'; json.dump(obj, open(tmp, 'w', encoding='utf-8'), indent=1, ensure_ascii=False); os.replace(tmp, p)
def margin(v): return ('D+' if v > 0 else 'R+' if v < 0 else 'even ') + f'{abs(v):.1f}' if v is not None else 'n/a'
def pts(v): return ('+' if v > 0 else '') + f'{v:.1f}'
def n(v): return f'{v:,.0f}'


# ---------- the data ----------
S = load(os.path.join(DATA, 'shift.json'))
if not S: sys.exit('no data/shift.json; run news/wave/build.py first')
CTX = load(os.path.join(DATA, 'context.json'), {}).get('counties', {})
ROWS = {}
for f, v in S['counties'].items():
    ROWS[f] = {'f': f, 'n': S['names'].get(f, f), 'st': F2S.get(f[:2], ''), 'm24': v[0], 'm26': v[1], 'sh': v[2], 'e': v[3], 'race': v[4], 'd': v[5], 'r': v[6], 't': v[7], 'd24': v[8], 'r24': v[9], 't24': v[10]}
BYST = {}
for r in ROWS.values(): BYST.setdefault(r['st'], []).append(r)
for st in BYST:
    BYST[st].sort(key=lambda r: -r['t'])
    for i, r in enumerate(BYST[st]): r['rank_votes'] = i + 1
    for i, r in enumerate(sorted(BYST[st], key=lambda r: -r['sh'])): r['rank_move'] = i + 1
def stats(rs):
    if not rs: return {'n': 0, 'left': 0, 'right': 0, 'median': 0.0, 'weighted': 0.0, 'flipD': 0, 'flipR': 0, 'votes': 0, 'votes24': 0}
    tw = sum(r['t'] for r in rs)
    return {'n': len(rs), 'left': sum(1 for r in rs if r['sh'] > 0), 'right': sum(1 for r in rs if r['sh'] < 0), 'median': statistics.median(r['sh'] for r in rs),
            'weighted': sum(r['sh'] * r['t'] for r in rs) / tw if tw else 0.0, 'flipD': sum(1 for r in rs if r['m24'] < 0 and r['m26'] > 0), 'flipR': sum(1 for r in rs if r['m24'] > 0 and r['m26'] < 0),
            'votes': tw, 'votes24': sum(r['t24'] for r in rs)}
ALL = stats(list(ROWS.values()))
STATES = [st for st, v in S['states'].items() if v.get('use')]
def races_of(st): return S['states'][st]['races']
def main_race(st): v = S['states'][st]; return v['races'][v['use']]
def area_of(st): return next((k for k, v in AREAS.items() if st in v), None)
def county_word(st): return COUNTY_WORD.get(st, 'county')


# ---------- the ledger ----------
LEDGER = os.path.join(DATA, 'spend.json')  # this module's ledger; news/money/write.py points it at its own file
LEDGERS = [os.path.join(DATA, 'spend.json'), os.path.normpath(os.path.join(DATA, '..', '..', 'money', 'data', 'spend.json'))]  # every ledger, for the cap and the total
def ledger(): return load(LEDGER, {'v': 1, 'usd': 0.0, 'runs': []})
def ledger_total(): return round(sum((load(p, {}) or {}).get('usd', 0.0) for p in LEDGERS), 4)
def all_runs():
    out = []
    for p in LEDGERS: out += (load(p, {}) or {}).get('runs', [])
    return sorted(out, key=lambda r: r['when'])
def price(usage, batch=False, searches=0):
    u = usage or {}
    usd = (u.get('input_tokens', 0) * PRICE['in'] + u.get('output_tokens', 0) * PRICE['out'] + u.get('cache_read_input_tokens', 0) * PRICE['cache_read']
           + u.get('cache_creation_input_tokens', 0) * PRICE['cache_write']) / 1e6 * (0.5 if batch else 1.0) + searches * PRICE['search']
    return round(usd, 5)
class Run:
    """One invocation's spending, written to the ledger as it goes."""
    def __init__(self, job, budget):
        self.job, self.budget, self.usd, self.items, self.t0 = job, budget, 0.0, 0, time.time()
        self.tok = {'in': 0, 'out': 0, 'cache_read': 0, 'cache_write': 0, 'searches': 0}
    def charge(self, usage, batch=False, searches=0, what=''):
        usd = price(usage, batch, searches)
        with LOCK:
            self.usd += usd; self.items += 1; u = usage or {}
            self.tok['in'] += u.get('input_tokens', 0); self.tok['out'] += u.get('output_tokens', 0); self.tok['cache_read'] += u.get('cache_read_input_tokens', 0)
            self.tok['cache_write'] += u.get('cache_creation_input_tokens', 0); self.tok['searches'] += searches
            L = ledger(); L['usd'] = round(L.get('usd', 0.0) + usd, 4)
            L['runs'].append({'when': now(), 'job': self.job, 'what': what, 'usd': usd, 'in': u.get('input_tokens', 0), 'out': u.get('output_tokens', 0), 'cache_read': u.get('cache_read_input_tokens', 0), 'cache_write': u.get('cache_creation_input_tokens', 0), 'searches': searches, 'batch': batch})
            L['runs'] = L['runs'][-4000:]
            save(LEDGER, L)
        print(f'  {what}: ${usd:.3f} (run ${self.usd:.2f}' + (f' of ${self.budget:.0f}' if self.budget is not None else '') + f'; this ledger ${L["usd"]:.2f}; all ${ledger_total():.2f} of the ${CAP:.0f} cap)', flush=True)
        return usd
    def over(self): return (self.budget is not None and self.usd >= self.budget) or ledger_total() >= CAP
    def summary(self): return f'{self.job}: {self.items} items, ${self.usd:.2f}, {self.tok["in"]:,} in / {self.tok["out"]:,} out / {self.tok["cache_read"]:,} cached, {self.tok["searches"]} searches, {time.time() - self.t0:.0f}s'


# ---------- the API ----------
def api(path, body=None, method=None, raw=False, url=None):
    key = os.environ.get('ANTHROPIC_API_KEY')
    if not key: sys.exit('ANTHROPIC_API_KEY is not set')
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url or API + path, data=data, method=method or ('POST' if data else 'GET'))
    req.add_header('x-api-key', key); req.add_header('anthropic-version', '2023-06-01'); req.add_header('content-type', 'application/json')
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=1200) as r:
                b = r.read()
                return b.decode('utf-8', 'replace') if raw else json.loads(b)
        except urllib.error.HTTPError as e:
            txt = e.read().decode('utf-8', 'replace')[:800]
            if e.code in (429, 500, 502, 503, 504, 529) and attempt < 7:
                wait = float(e.headers.get('retry-after') or 0) or min(120, 8 * 2 ** attempt) + random.random() * 3
                print(f'  API {e.code}, retry in {wait:.0f}s: {txt[:120]}', flush=True); time.sleep(wait); continue
            raise RuntimeError(f'API {e.code} {path}: {txt}')
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt < 7: wait = min(120, 8 * 2 ** attempt); print(f'  network: {e}; retry in {wait}s', flush=True); time.sleep(wait); continue
            raise
def message(params):
    """One Messages call, following pause_turn (long web-search turns) to the end. Returns (content, usage, searches)."""
    msgs = list(params['messages']); usage = {}; searches = 0; content = []
    for _ in range(6):
        resp = api('/v1/messages', dict(params, messages=msgs))
        content = resp.get('content', [])
        for k in ('input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'): usage[k] = usage.get(k, 0) + (resp.get('usage') or {}).get(k, 0)
        searches += ((resp.get('usage') or {}).get('server_tool_use') or {}).get('web_search_requests', 0)
        if resp.get('stop_reason') == 'pause_turn': msgs = msgs + [{'role': 'assistant', 'content': content}]; continue
        return content, usage, searches, resp.get('stop_reason')
    return content, usage, searches, 'pause_turn'


# ---------- Census context ----------
ACS = 'https://api.census.gov/data/2023/acs/acs5'
ACS_VARS = ['B01003_001E', 'B19013_001E', 'B03002_001E', 'B03002_012E', 'B02001_003E', 'B15003_001E', 'B15003_022E', 'B15003_023E', 'B15003_024E', 'B15003_025E']
def cmd_context(a):
    """Population, median household income, Hispanic and Black shares and the share of adults with a bachelor's degree,
    for every county, from the Census Bureau's ACS 2023 five-year estimates (api.census.gov; keyless, or CENSUS_API_KEY)."""
    url = f"{ACS}?get=NAME,{','.join(ACS_VARS)}&for=county:*" + (f"&key={os.environ['CENSUS_API_KEY']}" if os.environ.get('CENSUS_API_KEY') else '')
    req = urllib.request.Request(url, headers={'User-Agent': 'the-watch-wave/1.0 (bboldt86.github.io/lanscape-navigator)'})
    raw = b''
    try:
        with urllib.request.urlopen(req, timeout=120) as r: raw = r.read(); rows = json.loads(raw)
    except Exception as e:
        body = (e.read().decode('utf-8', 'replace')[:500] if hasattr(e, 'read') else raw.decode('utf-8', 'replace')[:500])
        save(os.path.join(DATA, 'context_error.json'), {'when': now(), 'error': repr(e), 'body': body, 'status': getattr(e, 'code', None), 'url': url.split('&key=')[0]}); print(f'context: {e!r} {body[:200]}'); return
    hdr = rows[0]; out = {}
    for row in rows[1:]:
        d = dict(zip(hdr, row)); f = d['state'] + d['county']
        try:
            pop = int(d['B01003_001E']); inc = int(d['B19013_001E']) if d['B19013_001E'] and int(d['B19013_001E']) > 0 else None
            tot = int(d['B03002_001E']) or 1; hisp = int(d['B03002_012E']) / tot * 100; black = int(d['B02001_003E']) / tot * 100
            adults = int(d['B15003_001E']) or 1; ba = sum(int(d[k]) for k in ACS_VARS[6:]) / adults * 100
        except (TypeError, ValueError): continue
        out[f] = {'pop': pop, 'inc': inc, 'hisp': round(hisp, 1), 'black': round(black, 1), 'ba': round(ba, 1), 'name': d['NAME']}
    save(os.path.join(DATA, 'context.json'), {'v': 1, 'fetched': now(), 'source': 'U.S. Census Bureau, American Community Survey 2023 five-year estimates (B01003, B19013, B03002, B02001, B15003)', 'counties': out})
    print(f'context: {len(out)} counties, {sum(1 for f in ROWS if f in out)} of the {len(ROWS)} on the map')


def ctx_line(f):
    c = CTX.get(f)
    if not c: return ''
    bits = [f"population {n(c['pop'])}"]
    if c.get('inc'): bits.append(f"median household income ${n(c['inc'])}")
    bits.append(f"{c['hisp']:.0f}% Hispanic"); bits.append(f"{c['black']:.0f}% Black"); bits.append(f"{c['ba']:.0f}% of adults with a bachelor's degree")
    return 'Census (ACS 2023 five-year): ' + ', '.join(bits) + '.'


# ---------- the state pieces ----------
STATE_SYSTEM = """You are Claude, writing for The Watch, a one-person news site (bboldt86.github.io/lanscape-navigator/news/). The Watch's "wave" report maps every county's move between the 2024 Harris–Trump vote and the Nov. 3, 2026 vote for U.S. senator (or governor where there was no Senate race). You are writing the piece for one state.

Your materials:
1. THE DATA BLOCK in the user message: AP's county vote counts (via The New York Times' public results files) and the 2024 baseline. Every number about the vote — margins, moves, vote totals, which counties flipped, how much is counted — must come from this block and only this block. Never take a vote number, a margin or a "percent reporting" from the web; outlets' figures differ from ours and the piece must agree with the map it sits under. Round sensibly (one decimal for state margins, whole points for county moves).
2. THE WEB, through the web_search tool: for what explains the result — the candidates and the campaign, the issues that reporting from that state says moved voters, turnout, what the local press and established national outlets (AP, Reuters, The New York Times, The Washington Post, NPR, the big regional papers, the state's public radio and TV stations, Politico, CNN, NBC, CBS, ABC) have said. Prefer original reporting and the state's own newsrooms. Do not use tabloids, anonymous blogs, social media posts or partisan sites as sources. Search for what you need (around 6 to 12 searches); do not search for the vote counts.

Standards:
- Cite as you go: every claim that comes from the web must be supported by a search result (the tool's citations). Attribute reporting to the outlet in the text where it matters ("the Columbus Dispatch reported...").
- Quote sparingly and never more than 25 words from one source; paraphrase in your own words.
- No invented quotes, no speculation presented as fact, no predictions. If reporting disagrees, say so. If something is not known yet (an uncalled race, ballots still being counted), say that.
- A move is not persuasion: the county-level count cannot tell voters changing their minds from who turned out. Say so once where it matters, using the turnout numbers in the data block.
- Neutral, concrete, plain English, in the voice of a careful newspaper feature: specific places, specific numbers, no cheerleading for either party and no cliché ("wake-up call", "bombshell", "stunning"). Use the candidates' full names on first mention. Spell out what the county word is where it is not "county" (parish in Louisiana).
- 650 to 950 words of body text. Three subheads, one of them about the voters: use the VOTER ANALYSIS block (the page draws it as charts next to that section) to say who moved — big counties or small, the reddest or the bluest, places where turnout fell or held, and, where the Census figures are given, Hispanic, educated, richer or poorer places — and whether turnout or persuasion better explains it. Give the numbers from the block; say plainly that counties are not voters.

Output exactly this skeleton, in plain text (no markdown besides the "## " subheads), nothing before or after it:

HEADLINE: <a headline of at most 12 words, specific to this state>
DEK: <one or two sentences, 25 to 45 words, that stand under the headline>
SUMMARY: <one sentence of at most 22 words for a list of all the states>
BODY:
<the body: paragraphs separated by blank lines; a subhead is a line starting with "## ">
CALLOUTS:
<four lines, one per county the map should point at while the reader looks at it, chosen for the story — the biggest move, the most votes, the most telling flip, an exception — each as: FIPS | County label as a reader would say it (e.g. "Starr County", "Cuyahoga County (Cleveland)") | one clause of at most 18 words saying what it did, with its numbers from the data block>"""

def county_table(rs, limit=None):
    hdr = 'fips | county | 2024 Harris–Trump margin | 2026 margin | move (pts) | 2026 votes | 2024 votes | % of expected vote counted'
    lines = [hdr]
    for r in (rs[:limit] if limit else rs):
        lines.append(f"{r['f']} | {r['n']} | {margin(r['m24'])} | {margin(r['m26'])} | {pts(r['sh'])} | {n(r['t'])} | {n(r['t24'])} | {r['e'] if r['e'] is not None else '–'}")
    return '\n'.join(lines)
def race_lines(st):
    out = []
    for k, rc in races_of(st).items():
        who = f"{rc['dem']} ({'D' if rc['demParty'] == 'D' else 'independent, counted on the Democratic side'}) v {rc['rep']} (R)"
        res = {'D': f"won by {rc['dem']}", 'R': f"won by {rc['rep']}", None: 'NOT CALLED by AP as of this data'}[rc.get('winner')]
        out.append(f"- {rc['office']}: {who}. 2026 margin {margin(rc['m26'])} ({n(rc['demVotes'])} to {n(rc['repVotes'])}, {n(rc['total'])} votes, {rc['eevp'] if rc['eevp'] is not None else '–'}% of the expected vote counted); 2024 presidential margin in the state {margin(rc['m24'])}; move {pts(rc['m26'] - rc['m24'])} points. {res}." + (f" Note: {rc['note']}" if rc.get('note') else ''))
    return '\n'.join(out)
def state_data_block(st):
    v = S['states'][st]; rs = BYST.get(st, []); stt = stats(rs); use = v['use']
    top = sorted(rs, key=lambda r: -r['sh']); big = sorted(rs, key=lambda r: -r['t'])
    flipsD = [r for r in rs if r['m24'] < 0 and r['m26'] > 0]; flipsR = [r for r in rs if r['m24'] > 0 and r['m26'] < 0]
    asof = S['asOf'].replace('T', ' ').replace('Z', ' UTC')
    L = [f"STATE: {NAME[st]} ({st}). The map uses the {'U.S. Senate' if use == 'S' else 'governor'}'s race for this state's counties.",
         f"Counts: AP via The New York Times, as of {asof}; 2024 baseline: county-level presidential results.",
         "", "THE RACES:", race_lines(st), "",
         f"THE COUNTIES ({len(rs)} with a 2026 count): {stt['left']} moved toward the Democrats, {stt['right']} toward the Republicans; the typical (median) move {pts(stt['median'])} points; weighted by votes cast {pts(stt['weighted'])}. "
         f"{stt['flipD']} counties went from a Trump win in 2024 to a Democratic win ({', '.join(r['n'] for r in sorted(flipsD, key=lambda r: -r['t'])[:12])}{'…' if len(flipsD) > 12 else ''}); {stt['flipR']} went the other way ({', '.join(r['n'] for r in flipsR[:8])}). "
         f"Votes cast in these counties: {n(stt['votes'])} in 2026 against {n(stt['votes24'])} in 2024 ({stt['votes'] / stt['votes24'] * 100 if stt['votes24'] else 0:.0f}%)." if rs else "THE COUNTIES: this state has no county-level count on the map (" + ('Alaska counts by legislative district' if st == 'AK' else 'Connecticut reports by town' if st == 'CT' else 'no county rows') + ").",
         "",
         f"NATIONALLY: {ALL['n']} counties counted across the states with a race; {ALL['left']} moved left, {ALL['right']} right; typical move {pts(ALL['median'])}, vote-weighted {pts(ALL['weighted'])}; {ALL['flipD']} counties went from Trump to a Democrat. The biggest moves in the country are in South Texas (Starr County +{ROWS['48427']['sh']:.0f}) and southwest Kansas.",
         ]
    if rs:
        L += ["", "BIGGEST MOVES LEFT (top 10):", county_table(top, 10), "", "BIGGEST MOVES RIGHT, OR SMALLEST LEFT (10):", county_table(sorted(rs, key=lambda r: r['sh']), 10), "", "MOST VOTES (12):", county_table(big, 12)]
        if CTX:
            L += ["", "CENSUS CONTEXT for the 12 biggest counties and the 10 biggest moves (ACS 2023 five-year):"]
            for r in big[:12] + top[:10]:
                if ctx_line(r['f']): L.append(f"- {r['n']}: {ctx_line(r['f'])[len('Census (ACS 2023 five-year): '):]}")
        if len(rs) <= 120: L += ["", "EVERY COUNTY:", county_table(sorted(rs, key=lambda r: r['n']))]
        else: L += ["", f"(All {len(rs)} counties are in the published data; the tables above are what the piece should draw on.)"]
    if rs: L += ["", voters.prose(voters.analysis(rs, CTX), {'parish': 'parishes', 'borough': 'boroughs'}.get(county_word(st), 'counties'))]
    ar = area_of(st)
    if ar: L += ["", f"The Watch already published a regional piece that includes this state: \"{AREA_TITLE[ar]}\" ({ar}.html). This state piece should stand on its own and go deeper into the state, not repeat it."]
    return '\n'.join(L)

def state_params(st, effort):
    loc = {'type': 'approximate', 'country': 'US', 'region': NAME[st]}
    return {'model': MODEL, 'max_tokens': 24000, 'output_config': {'effort': effort},
            'system': [{'type': 'text', 'text': STATE_SYSTEM, 'cache_control': {'type': 'ephemeral'}}],
            'tools': [{'type': 'web_search_20250305', 'name': 'web_search', 'max_uses': 12, 'user_location': loc}],
            'messages': [{'role': 'user', 'content': [{'type': 'text', 'text': f"Write The Watch's wave piece for {NAME[st]}. Here is the data block.\n\n{state_data_block(st)}"}]}]}

def parse_skeleton(content, callouts=4):
    callouts_n = callouts
    """The text blocks, concatenated, with each web citation placed at the end of the block it supports."""
    doc = ''; marks = []; sources = []; seen = {}
    for b in content:
        if b.get('type') != 'text': continue
        t = b.get('text', ''); start = len(doc); doc += t
        for c in b.get('citations') or []:
            u = c.get('url');
            if not u: continue
            if u not in seen: seen[u] = len(sources) + 1; sources.append({'n': seen[u], 'title': (c.get('title') or u)[:160], 'url': u})
            marks.append((start + len(t), seen[u]))
    def field(name, nxt):
        m = re.search(rf'^{name}:\s*(.*?)\s*(?=^{nxt}:)', doc, re.S | re.M); return (m.group(1).strip() if m else '')
    head = field('HEADLINE', 'DEK'); dek = field('DEK', 'SUMMARY'); summ = field('SUMMARY', 'BODY')
    mb = re.search(r'^BODY:[ \t]*\n', doc, re.M); mc = re.search(r'^CALLOUTS:[ \t]*(\n|$)', doc, re.M)
    if not (mb and mc and mc.start() > mb.end()): return None, doc
    body_start, body_end = mb.end(), mc.start(); body = doc[body_start:body_end]
    # paragraphs with their marks (char offsets within the paragraph)
    paras = []; pos = 0
    for chunk in re.split(r'\n\s*\n', body):
        at = body.find(chunk, pos); pos = at + len(chunk); text = chunk.strip()
        if not text: continue
        a0 = body_start + at + (len(chunk) - len(chunk.lstrip())); a1 = a0 + len(text)
        cites = sorted({(min(max(off - a0, 0), len(text)), src) for off, src in marks if a0 < off <= a1 + 1})
        kind = 'h2' if text.startswith('## ') else 'p'
        paras.append({'t': kind, 'text': text[3:].strip() if kind == 'h2' else text, 'cites': [[o, s] for o, s in cites]})
    callouts = []  # the parsed lines; callouts_n is the cap
    for line in doc[mc.end():].strip().splitlines():
        parts = [p.strip() for p in line.split('|')]
        if len(parts) >= 3 and re.fullmatch(r'\d{5}', parts[0]) and parts[0] in ROWS: callouts.append({'f': parts[0], 'label': parts[1][:60], 'note': parts[2][:160]})
    words = sum(len(p['text'].split()) for p in paras if p['t'] == 'p')
    return {'headline': head, 'dek': dek, 'summary': summ, 'paras': paras, 'callouts': callouts[:callouts_n], 'sources': sources, 'words': words}, doc

def race_snapshot(st): return {k: {'winner': rc.get('winner'), 'm26': round(rc['m26'], 2), 'eevp': rc.get('eevp')} for k, rc in races_of(st).items()}
def report_path(st): return os.path.join(DATA, 'reports', st + '.json')
NATIONAL_SYSTEM = STATE_SYSTEM.replace("You are writing the piece for one state.", "You are writing the piece for the whole country: what the voters did, county by county, across every state with a race.").replace(
    "- 650 to 950 words of body text. Three subheads,", "- 1,100 to 1,500 words of body text. Four or five subheads,").replace(
    "<a headline of at most 12 words, specific to this state>", "<a headline of at most 12 words>").replace(
    "<one sentence of at most 22 words for a list of all the states>", "<one sentence of at most 22 words>").replace(
    "<four lines, one per county", "<six lines, one per county").replace("around 6 to 12 searches", "around 10 to 16 searches")
def national_data_block():
    rs = list(ROWS.values()); top = sorted(rs, key=lambda r: -r['sh']); big = sorted(rs, key=lambda r: -r['t'])
    sts = sorted(STATES, key=lambda st: -(main_race(st)['m26'] - main_race(st)['m24']))
    L = [f"THE COUNTRY: {ALL['n']} counties with a 2026 count across the {len(STATES)} states with a Senate or governor's race; {ALL['left']} moved toward the Democrats, {ALL['right']} toward the Republicans; typical move {pts(ALL['median'])}, weighted by votes {pts(ALL['weighted'])}; {ALL['flipD']} counties went from a Trump win in 2024 to a Democratic win, {ALL['flipR']} the other way. Votes cast {n(ALL['votes'])} against {n(ALL['votes24'])} in 2024 ({ALL['votes'] / ALL['votes24'] * 100:.0f}%).",
         f"Counts: AP via The New York Times, as of {S['asOf'].replace('T', ' ').replace('Z', ' UTC')}; 2024 baseline: county-level presidential results. States without a race (IN, MO, ND, UT, WA) are not on the map; Alaska has no county count; Connecticut reports by town.",
         "", "THE STATES, by how far the state moved (the race on the map; 2024 presidential margin -> 2026 margin; move; result):"]
    for st in sts:
        rc = main_race(st); res = {'D': f"{rc['dem']} (D) won", 'R': f"{rc['rep']} (R) won", None: 'not called'}[rc.get('winner')]
        L.append(f"- {NAME[st]} ({rc['office']}): {margin(rc['m24'])} -> {margin(rc['m26'])}, {pts(rc['m26'] - rc['m24'])}; {res}; {rc['eevp'] if rc['eevp'] is not None else '–'}% counted")
    L += ["", "BIGGEST MOVES LEFT (15):", county_table(top, 15), "", "MOVES RIGHT (all counties that moved right, up to 15):", county_table(sorted([r for r in rs if r['sh'] < 0], key=lambda r: r['sh']), 15), "", "MOST VOTES (15):", county_table(big, 15), "", voters.prose(voters.analysis(rs, CTX))]
    return '\n'.join(L)
def national_params(effort):
    return {'model': MODEL, 'max_tokens': 32000, 'output_config': {'effort': 'high' if effort in ('max', 'xhigh') else effort},  # at max effort the thinking alone can use the whole budget
            'system': [{'type': 'text', 'text': NATIONAL_SYSTEM, 'cache_control': {'type': 'ephemeral'}}],
            'tools': [{'type': 'web_search_20250305', 'name': 'web_search', 'max_uses': 16, 'user_location': {'type': 'approximate', 'country': 'US'}}],
            'messages': [{'role': 'user', 'content': [{'type': 'text', 'text': f"Write The Watch's piece on what the voters did across the country. Here is the data block.\n\n{national_data_block()}"}]}]}
def cmd_national(a):
    run = Run('national', a.budget); p = os.path.join(DATA, 'reports', '_US.json'); old = load(p)
    if old and not a.redo and old.get('asOf') and not any(state_stale(st, {'races': old.get('races', {}).get(st, {})}) for st in STATES): print('national: written and current'); return
    if a.dry: print(national_data_block()); return
    t0 = time.time()
    if MOCK: rep = mock_state('TX'); rep['headline'] = 'What the voters did (mock)'; usage = {'input_tokens': 20000, 'output_tokens': 6000}; searches = 12
    else:
        content, usage, searches, stop = message(national_params(a.effort)); rep, raw = parse_skeleton(content, callouts=6)
        run.charge(usage, searches=searches, what='national')
        if not rep or not rep['headline'] or rep['words'] < 500: save(os.path.join(DATA, 'reports', '_failed_US.txt'), {'stop': stop, 'doc': raw}); print(f'national: could not parse ({stop})'); return
    rep.update({'st': 'US', 'name': 'The country', 'written': now(), 'asOf': S['asOf'], 'model': MODEL, 'effort': a.effort, 'searches': searches, 'usage': usage, 'usd': price(usage, searches=searches), 'races': {st: race_snapshot(st) for st in STATES}, 'seconds': round(time.time() - t0)})
    save(p, rep); print(f'national: "{rep["headline"]}" — {rep["words"]} words, {len(rep["sources"])} sources, {searches} searches, {rep["seconds"]}s; {run.summary()}')

COUNTY_SYSTEM = STATE_SYSTEM.replace("You are writing the piece for one state.", "You are writing the piece for one county: one of the biggest in the country by votes cast, up close — what happened there, who moved, and what the local press found.").replace(
    "- 650 to 950 words of body text. Three subheads, one of them about the voters: use the VOTER ANALYSIS block (the page draws it as charts next to that section) to say who moved — big counties or small, the reddest or the bluest, places where turnout fell or held, and, where the Census figures are given, Hispanic, educated, richer or poorer places — and whether turnout or persuasion better explains it. Give the numbers from the block; say plainly that counties are not voters.",
    "- 550 to 800 words of body text. Two or three subheads: what the county did (its numbers, against its state and the comparable counties in the block), why — what the local press, the county's election officials and the exit or voter polls said about turnout, the issues and who moved (attribute every such claim), and what it means for the county's politics. Use the Census profile in the block to say what kind of place it is. Say plainly that a county's move mixes who turned out with who changed sides.").replace(
    "<four lines, one per county the map should point at while the reader looks at it, chosen for the story — the biggest move, the most votes, the most telling flip, an exception — each as: FIPS | County label as a reader would say it (e.g. \"Starr County\", \"Cuyahoga County (Cleveland)\") | one clause of at most 18 words saying what it did, with its numbers from the data block>",
    "<up to three lines: this county first, then up to two of the comparable counties in the block, each as: FIPS | County label (e.g. \"Harris County (Houston)\") | one clause of at most 18 words on what it did, with its numbers from the data block>")
def county_block(r):
    st = r['st']; rs = BYST[st]; stt = stats(rs); rc = main_race(st)
    near = sorted([x for x in rs if x['f'] != r['f']], key=lambda x: -x['t'])[:6]
    big = sorted(ROWS.values(), key=lambda x: -x['t']); rank_us = next(i for i, x in enumerate(big) if x['f'] == r['f']) + 1
    peers = sorted([x for x in big[:60] if x['f'] != r['f']], key=lambda x: abs(x['m24'] - r['m24']))[:5]
    def ordn(i): return f"{i}{'th' if 10 <= i % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(i % 10, 'th')}"
    L = [f"COUNTY: {r['n']} {county_word(st).capitalize()}, {NAME[st]} (FIPS {r['f']}); the {ordn(rank_us)}-biggest county in the country by 2026 votes among the states with a race, {ordn(r['rank_votes'])} in {NAME[st]}.",
         f"THE VOTE: 2024 Harris–Trump {margin(r['m24'])} on {n(r['t24'])} votes. 2026 {rc['office']} ({rc['dem']} v {rc['rep']}): {margin(r['m26'])} ({n(r['d'])} to {n(r['r'])}) on {n(r['t'])} votes, {r['e'] if r['e'] is not None else '–'}% of the expected vote counted. Move {pts(r['sh'])} points. Turnout {r['t'] / r['t24'] * 100 if r['t24'] else 0:.0f}% of 2024.",
         f"THE STATE: {race_lines(st)}",
         f"IN {NAME[st].upper()}: the county ranks {r['rank_move']} of {stt['n']} by move; {stt['left']} of {stt['n']} counties moved left; typical move {pts(stt['median'])}, weighted {pts(stt['weighted'])}; the state's other big counties: " + '; '.join(f"{x['n']} {margin(x['m24'])} → {margin(x['m26'])}, {pts(x['sh'])}, {n(x['t'])} votes" for x in near) + '.',
         f"COMPARABLE BIG COUNTIES ELSEWHERE (by 2024 margin): " + '; '.join(f"{x['n']}, {x['st']} {margin(x['m24'])} → {margin(x['m26'])}, {pts(x['sh'])}, {n(x['t'])} votes" for x in peers) + '.',
         f"NATIONALLY: {ALL['n']} counties counted, {ALL['left']} moved left, typical move {pts(ALL['median'])}; the biggest counties moved less in points: " + '; '.join(f"{x['n']}, {x['st']} {pts(x['sh'])}" for x in big[:8]) + '.']
    if ctx_line(r['f']): L.append(ctx_line(r['f']))
    return '\n'.join(L)
def county_params(r, effort):
    return {'model': MODEL, 'max_tokens': 24000, 'output_config': {'effort': effort},
            'system': [{'type': 'text', 'text': COUNTY_SYSTEM, 'cache_control': {'type': 'ephemeral'}}],
            'tools': [{'type': 'web_search_20250305', 'name': 'web_search', 'max_uses': 10, 'user_location': {'type': 'approximate', 'country': 'US', 'region': NAME[r['st']], 'city': r['n']}}],
            'messages': [{'role': 'user', 'content': [{'type': 'text', 'text': f"Write The Watch's piece on {r['n']} {county_word(r['st']).capitalize()}, {NAME[r['st']]}. Here is the data block.\n\n{county_block(r)}"}]}]}
def county_report_path(f): return os.path.join(DATA, 'reports', 'counties', f + '.json')
def county_stale(r, rep):
    old = rep.get('snapshot') or {}
    return abs(old.get('sh', 0) - r['sh']) > 1.0 or old.get('winner') != main_race(r['st']).get('winner')
def cmd_bigcounties(a, stale_only=False):
    run = Run('counties-big', a.budget); big = sorted(ROWS.values(), key=lambda r: -r['t'])[:a.n]
    todo = []
    for r in big:
        rep = load(county_report_path(r['f']))
        if rep and not a.redo and not county_stale(r, rep): continue
        if stale_only and not rep: continue
        todo.append(r)
    print(f'big counties: {len(todo)} to write of the top {a.n}, effort {a.effort}, budget ${a.budget}')
    if a.dry: print(county_block(todo[0] if todo else big[0])); return
    sem = threading.Semaphore(max(1, a.parallel)); threads = []; done = []
    def work(r):
        with sem:
            if run.over(): print(f'  {r["n"]}: budget spent, skipped'); return
            t0 = time.time()
            try:
                if MOCK: rep = mock_state(r['st']); rep['headline'] = f"{r['n']} County (mock)"; usage = {'input_tokens': 6000, 'output_tokens': 3000}; searches = 6
                else:
                    content, usage, searches, stop = message(county_params(r, a.effort)); rep, raw = parse_skeleton(content, callouts=3)
                    run.charge(usage, searches=searches, what=f'county {r["n"]}, {r["st"]}')
                    if not rep or not rep['headline'] or rep['words'] < 250: save(county_report_path('_failed_' + r['f']).replace('.json', '.txt'), {'stop': stop, 'doc': raw}); print(f'  {r["n"]}: could not parse ({stop})'); return
                rep.update({'f': r['f'], 'county': r['n'], 'st': r['st'], 'written': now(), 'asOf': S['asOf'], 'model': MODEL, 'effort': a.effort, 'searches': searches, 'usage': usage, 'usd': price(usage, searches=searches), 'seconds': round(time.time() - t0), 'snapshot': {'sh': round(r['sh'], 2), 'winner': main_race(r['st']).get('winner'), 'e': r['e']}})
                save(county_report_path(r['f']), rep); done.append(r['f']); print(f'  {r["n"]}, {r["st"]}: "{rep["headline"]}" — {rep["words"]} words, {len(rep["sources"])} sources, {searches} searches', flush=True)
            except Exception as e: print(f'  {r["n"]}: FAILED {e}', flush=True)
    for r in todo: t = threading.Thread(target=work, args=(r,), daemon=True); t.start(); threads.append(t); time.sleep(2)
    for t in threads: t.join()
    print(run.summary(), f'— {len(done)} written')

def mock_state(st):
    rs = BYST.get(st, []); top = sorted(rs, key=lambda r: -r['sh'])[:4] or []
    paras = [{'t': 'p', 'text': f"(Mock) {NAME[st]} moved {pts(main_race(st)['m26'] - main_race(st)['m24'])} points. This paragraph is made up to test the page.", 'cites': [[60, 1]]}, {'t': 'h2', 'text': 'What moved it', 'cites': []}, {'t': 'p', 'text': 'A second mock paragraph with a citation at its end.', 'cites': [[51, 2]]}]
    return {'headline': f'How {NAME[st]} moved (mock)', 'dek': 'A made-up dek for testing the page build.', 'summary': f'{NAME[st]} moved; this is a mock.', 'paras': paras, 'callouts': [{'f': r['f'], 'label': r['n'] + ' County', 'note': f"moved {r['sh']:.0f} points"} for r in top], 'sources': [{'n': 1, 'title': 'Mock source one', 'url': 'https://example.com/one'}, {'n': 2, 'title': 'Mock source two', 'url': 'https://example.com/two'}], 'words': 30}

def write_state(st, run, effort):
    t0 = time.time()
    if MOCK: rep = mock_state(st); usage = {'input_tokens': 9000, 'output_tokens': 3000}; searches = 8; raw = ''
    else:
        content, usage, searches, stop = message(state_params(st, effort))
        rep, raw = parse_skeleton(content)
        run.charge(usage, searches=searches, what=f'state {st}')
        if not rep or not rep['headline'] or rep['words'] < 300:
            save(os.path.join(DATA, 'reports', '_failed_' + st + '.txt'), {'stop': stop, 'doc': raw}); print(f'  {st}: could not parse the piece ({stop}); kept the raw text'); return False
    rep.update({'st': st, 'name': NAME[st], 'written': now(), 'asOf': S['asOf'], 'model': MODEL, 'effort': effort, 'searches': searches, 'usage': usage, 'usd': price(usage, searches=searches), 'races': race_snapshot(st), 'seconds': round(time.time() - t0)})
    save(report_path(st), rep); print(f'  {st}: "{rep["headline"]}" — {rep["words"]} words, {len(rep["sources"])} sources, {searches} searches, {rep["seconds"]}s', flush=True)
    return True

def state_stale(st, rep):
    """A piece is stale when a race it covers has since been called, or its margin moved more than a point."""
    for k, rc in races_of(st).items():
        old = (rep.get('races') or {}).get(k)
        if not old: return True
        if old.get('winner') != rc.get('winner') or abs(old.get('m26', 0) - rc['m26']) > 1.0: return True
    return False

def cmd_states(a, stale_only=False):
    run = Run('states', a.budget); want = [s.strip().upper() for s in a.states.split(',')] if a.states else STATES
    todo = []
    for st in want:
        if st not in S['states'] or not S['states'][st].get('use'): print(f'{st}: no race'); continue
        rep = load(report_path(st))
        if rep and not a.redo and not state_stale(st, rep): continue
        if stale_only and not rep: continue
        todo.append(st)
    todo.sort(key=lambda st: -main_race(st)['total'])  # the biggest states first
    print(f'states: {len(todo)} to write ({", ".join(todo)}), effort {a.effort}, budget ${a.budget}, {a.parallel} at a time')
    if a.dry: print(state_data_block(todo[0] if todo else 'TX')); return
    sem = threading.Semaphore(max(1, a.parallel)); done = []; threads = []
    def work(st):
        with sem:
            if run.over(): print(f'  {st}: budget spent, skipped'); return
            try:
                if write_state(st, run, a.effort): done.append(st)
            except Exception as e: print(f'  {st}: FAILED {e}', flush=True)
    for st in todo:
        t = threading.Thread(target=work, args=(st,), daemon=True); t.start(); threads.append(t); time.sleep(2)
    for t in threads: t.join()
    print(run.summary(), f'— {len(done)} written')


# ---------- the county notes ----------
NOTE_SYSTEM = """You write one short note per county for The Watch's "wave" map, which shows every county's move between the 2024 Harris–Trump vote and the Nov. 3, 2026 vote for U.S. senator (or governor where there was no Senate race). A reader has just tapped this county on the map and wants to know, in plain English, what it did.

Rules:
- Use only the numbers in the message. Do not add facts from memory about the county, its politics, its economy or its history; do not guess why it moved. You may use the Census figures given (population, income, Hispanic and Black shares, education) to say what kind of place it is, and the comparison counties given to say how it compares.
- A move is not persuasion: when turnout fell or rose a lot against 2024, say that the count cannot tell who changed their mind from who stayed home.
- If less than 95% of the expected vote is counted, say the numbers may still move.
- 70 to 130 words, one or two paragraphs, no headline, no bullet points, no markdown. Name the race and the candidates' surnames once. Round moves and margins to whole points; give vote totals with commas. Neutral and concrete; no cliché.
- Output the note only."""

def comparisons(r):
    rs = [x for x in BYST.get(r['st'], []) if x['f'] != r['f']]
    near = sorted(rs, key=lambda x: abs(x['m24'] - r['m24']) + abs(math.log((x['t'] + 1) / (r['t'] + 1))) * 4)[:3]
    return '; '.join(f"{x['n']} ({margin(x['m24'])} in 2024 → {margin(x['m26'])}, move {pts(x['sh'])}, {n(x['t'])} votes)" for x in near)
def note_prompt(r):
    st = r['st']; v = S['states'][st]; rc = v['races'][r['race']] if r['race'] in v['races'] else main_race(st); stt = stats(BYST[st])
    word = county_word(st)
    L = [f"{r['n']} {word.capitalize()}, {NAME[st]} (FIPS {r['f']}).",
         f"Race on the map: {rc['office']}, {rc['dem']} ({'D' if rc['demParty'] == 'D' else 'independent'}) v {rc['rep']} (R); statewide {margin(rc['m26'])}, " + ({'D': f"won by {rc['dem'].split(' ')[-1]}", 'R': f"won by {rc['rep'].split(' ')[-1]}", None: 'not yet called by AP'}[rc.get('winner')]) + f"; the state's 2024 presidential margin was {margin(rc['m24'])}, so the state moved {pts(rc['m26'] - rc['m24'])}.",
         f"This {word}: 2024 Harris–Trump {margin(r['m24'])} on {n(r['t24'])} votes; 2026 {margin(r['m26'])} ({n(r['d'])} to {n(r['r'])}) on {n(r['t'])} votes, {r['e'] if r['e'] is not None else '–'}% of the expected vote counted. Move: {pts(r['sh'])} points ({'toward the Democrats' if r['sh'] > 0 else 'toward the Republicans' if r['sh'] < 0 else 'no change'}). Turnout: {r['t'] / r['t24'] * 100 if r['t24'] else 0:.0f}% of the 2024 vote.",
         f"In {NAME[st]}: ranks {r['rank_move']} of {stt['n']} {word if word != 'county' else 'counties'} by move and {r['rank_votes']} by votes cast; {stt['left']} of {stt['n']} moved left, the typical one {pts(stt['median'])}; {stt['flipD']} went from a Trump win to a Democratic win." + (" This one flipped from Trump to the Democrat." if r['m24'] < 0 and r['m26'] > 0 else " This one flipped the other way." if r['m24'] > 0 and r['m26'] < 0 else ''),
         f"Nationally: {ALL['n']} counties counted, {ALL['left']} moved left, typical move {pts(ALL['median'])}.",
         f"Similar {word if word != 'county' else 'counties'} in the state by 2024 vote and size: {comparisons(r)}."]
    if ctx_line(r['f']): L.append(ctx_line(r['f']))
    return '\n'.join(L)
def note_params(r):
    return {'model': MODEL, 'max_tokens': 2500, 'output_config': {'effort': 'low'},
            'system': [{'type': 'text', 'text': NOTE_SYSTEM, 'cache_control': {'type': 'ephemeral'}}],
            'messages': [{'role': 'user', 'content': [{'type': 'text', 'text': note_prompt(r)}]}]}
NOTE_EST = {'in': 950, 'out': 520}  # tokens per request, for sizing a batch (the system prompt mostly comes from cache)
def notes_path(st): return os.path.join(DATA, 'notes', st + '.json')
def batch_path(): return os.path.join(DATA, 'notes', '_batch.json')
def note_stale(r, note):
    return abs(note.get('sh', 0) - r['sh']) > 1.0 or ((note.get('e') or 0) < 95 <= (r['e'] or 0))

def cmd_counties(a, stale_only=False):
    pending = load(batch_path())
    if pending and not MOCK: print(f'a batch is still out ({pending["id"]}, {pending["n"]} counties, submitted {pending["submitted"]}); run `collect` first'); return cmd_collect(a)
    run = Run('counties', a.budget); want = set(s.strip().upper() for s in a.states.split(',')) if a.states else None
    todo = []
    for r in ROWS.values():
        if want and r['st'] not in want: continue
        note = (load(notes_path(r['st']), {}).get('notes') or {}).get(r['f'])
        if note and not a.redo and not note_stale(r, note): continue
        if stale_only and not note: continue
        todo.append(r)
    todo.sort(key=lambda r: -r['t'])
    per = (NOTE_EST['in'] * PRICE['in'] + NOTE_EST['out'] * PRICE['out']) / 1e6 * 0.5
    room = max(0.0, CAP - ledger_total()); fit = int(min(a.budget if a.budget else room, room) / per)
    if fit < len(todo): print(f'counties: {len(todo)} to write, but ${a.budget} fits about {fit} at ~${per:.4f} each; the biggest {fit} go in this batch'); todo = todo[:fit]
    print(f'counties: {len(todo)} notes, ~${len(todo) * per:.2f} at batch rates')
    if a.dry: print(note_prompt(todo[0] if todo else ROWS['48427'])); return
    if not todo: return
    if MOCK:
        for r in todo: put_note(r, f"(Mock) {r['n']} moved {r['sh']:.0f} points, from {margin(r['m24'])} to {margin(r['m26'])}, on {n(r['t'])} votes. This note is made up to test the page.", {'input_tokens': 900, 'output_tokens': 400})
        run.charge({'input_tokens': 900 * len(todo), 'output_tokens': 400 * len(todo)}, batch=True, what=f'mock batch of {len(todo)}'); print(run.summary()); return
    reqs = [{'custom_id': r['f'], 'params': note_params(r)} for r in todo]
    resp = api('/v1/messages/batches', {'requests': reqs})
    save(batch_path(), {'id': resp['id'], 'n': len(reqs), 'submitted': now(), 'estimate_usd': round(len(todo) * per, 2), 'fips': [r['f'] for r in todo]})
    print(f'batch {resp["id"]} submitted: {len(reqs)} requests, status {resp.get("processing_status")}')
    cmd_collect(a)

def put_note(r, text, usage):
    p = notes_path(r['st']); d = load(p, {'v': 1, 'st': r['st'], 'source': 'Written by Claude (claude-opus-5-5) from the county counts (AP via The New York Times), the 2024 baseline and Census ACS 2023 context.', 'notes': {}})
    d['notes'][r['f']] = {'t': text.strip(), 'w': now(), 'sh': round(r['sh'], 2), 'e': r['e'], 'm26': round(r['m26'], 2), 'asOf': S['asOf']}
    d['updated'] = now(); save(p, d)

def cmd_collect(a):
    pending = load(batch_path())
    if not pending: print('no batch pending'); return
    run = Run('collect', None); waited = 0
    while True:
        b = api(f"/v1/messages/batches/{pending['id']}")
        rc = b.get('request_counts') or {}
        print(f"batch {pending['id']}: {b.get('processing_status')} ({rc.get('processing', '?')} processing, {rc.get('succeeded', 0)} done, {rc.get('errored', 0)} errored)", flush=True)
        if b.get('processing_status') == 'ended': break
        if waited >= (a.wait or 0): print(f'still running; collect again later (`write.py collect`)'); return
        time.sleep(300); waited += 5
    try: os.remove(batch_path())  # first, so a crash below can't collect (and charge) the same batch twice
    except OSError: pass
    if any(pending['id'] in (r.get('what') or '') for r in ledger()['runs']): print(f'batch {pending["id"]} was already collected and charged; not charging again'); charged = True
    else: charged = False
    if not b.get('results_url'): print('no results url'); return
    lines = api('', raw=True, url=b['results_url']).splitlines()
    ok = err = 0; usage_sum = {}
    for line in lines:
        if not line.strip(): continue
        o = json.loads(line); f = o.get('custom_id'); res = o.get('result') or {}
        if res.get('type') != 'succeeded' or f not in ROWS: err += 1; continue
        msg = res['message']; text = ''.join(c.get('text', '') for c in msg.get('content', []) if c.get('type') == 'text')
        if len(text.split()) < 30: err += 1; continue
        put_note(ROWS[f], text, msg.get('usage')); ok += 1
        for k, v in (msg.get('usage') or {}).items():
            if isinstance(v, int): usage_sum[k] = usage_sum.get(k, 0) + v
    if not charged: run.charge(usage_sum, batch=True, what=f'batch {pending["id"]}: {ok} notes')
    print(f'collected {ok} notes ({err} errored or empty)')
    cmd_check(a)

def cmd_refresh(a):
    """The scheduled pass: what the count has moved since it was written. Counties first (cheap), then states, within the budget."""
    if load(batch_path()): cmd_collect(a)
    cmd_counties(argparse.Namespace(**dict(vars(a), budget=min(a.budget, 1.5), redo=False, states=None)), stale_only=True)
    spent = Run('x', None); L = ledger(); today = now()[:10]
    used = sum(r['usd'] for r in L['runs'] if r['when'][:10] == today)
    left = max(0.0, a.budget - used)
    if left < 0.5: print(f'refresh: ${used:.2f} spent today, nothing left for states'); return
    cmd_states(argparse.Namespace(**dict(vars(a), budget=left, redo=False, states=None, effort=a.effort or 'high')), stale_only=True)
    L = ledger(); used = sum(r['usd'] for r in L['runs'] if r['when'][:10] == today); left = max(0.0, a.budget - used)
    if left >= 8 and load(os.path.join(DATA, 'reports', '_US.json')): cmd_national(argparse.Namespace(**dict(vars(a), budget=left, redo=False, effort='high')))
    L = ledger(); used = sum(r['usd'] for r in L['runs'] if r['when'][:10] == today); left = max(0.0, a.budget - used)
    if left >= 1 and os.path.isdir(os.path.join(DATA, 'reports', 'counties')): cmd_bigcounties(argparse.Namespace(**dict(vars(a), budget=left, redo=False, effort='high', n=getattr(a, 'n', 50))), stale_only=True)

def cmd_cost(a):
    runs = all_runs(); byjob = {}
    for r in runs: byjob[r['job']] = byjob.get(r['job'], 0) + r['usd']
    print(f"total ${sum(r['usd'] for r in runs):.2f} over {len(runs)} calls, all ledgers (cap ${CAP:.0f})"); [print(f'  {k}: ${v:.2f}') for k, v in sorted(byjob.items(), key=lambda kv: -kv[1])]
    for d in sorted({r['when'][:10] for r in runs}): print(f"  {d}: ${sum(r['usd'] for r in runs if r['when'][:10] == d):.2f}")

def cmd_check(a):
    bad = 0; reps = 0; notes = 0; shown = [0]
    def say(m):
        shown[0] += 1
        if shown[0] <= 25: print(m)
        elif shown[0] == 26: print('  …')
    for st in STATES:
        rep = load(report_path(st))
        if not rep: continue
        reps += 1
        for p in rep['paras']:
            if p['t'] == 'p':
                for q in re.findall(r'[“"]([^”"]{20,})[”"]', p['text']):
                    if len(q.split()) > 25: say(f'{st}: a quotation over 25 words: {q[:60]}…'); bad += 1
                for o, s_ in p['cites']:
                    if s_ > len(rep['sources']): say(f'{st}: citation {s_} has no source'); bad += 1
        if rep['words'] < 300: say(f'{st}: only {rep["words"]} words'); bad += 1
        if not rep['sources'] and not MOCK: say(f'{st}: no sources'); bad += 1
        for c in rep['callouts']:
            if c['f'] not in ROWS: say(f'{st}: callout {c["f"]} is not a county on the map'); bad += 1
    for st in BYST:
        d = load(notes_path(st))
        if not d: continue
        for f, nt in d['notes'].items():
            notes += 1
            if f not in ROWS: say(f'{st}: note for {f}, not on the map'); bad += 1
            w = len(nt['t'].split())
            if not 40 <= w <= 190: say(f'{st}/{f}: note is {w} words'); bad += 1
            if re.search(r'^\s*[-*#]', nt['t'], re.M): say(f'{st}/{f}: markdown in a note'); bad += 1
    print(f'check: {reps} state pieces, {notes} county notes, {bad} problems')
    if bad and a.strict: sys.exit(1)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('job', choices=['context', 'states', 'national', 'counties', 'bigcounties', 'collect', 'refresh', 'cost', 'check'])
    ap.add_argument('--n', type=int, default=50, help='bigcounties: how many of the biggest counties')
    ap.add_argument('--budget', type=float, default=None, help='dollars this run may spend (states: stop starting new ones; counties: size the batch)')
    ap.add_argument('--states', default=None, help='only these, e.g. TX,OH')
    ap.add_argument('--effort', default='high', choices=['low', 'medium', 'high', 'xhigh', 'max'])
    ap.add_argument('--parallel', type=int, default=3)
    ap.add_argument('--wait', type=int, default=0, help='minutes to wait for a batch before giving up (collect again later)')
    ap.add_argument('--redo', action='store_true', help='rewrite even what is already written')
    ap.add_argument('--dry', action='store_true'); ap.add_argument('--mock', action='store_true'); ap.add_argument('--strict', action='store_true')
    a = ap.parse_args(); MOCK = a.mock
    if a.budget is None: a.budget = {'states': 140.0, 'national': 15.0, 'counties': 40.0, 'bigcounties': 50.0, 'refresh': 3.5}.get(a.job, 0.0)
    {'context': cmd_context, 'states': cmd_states, 'national': cmd_national, 'counties': cmd_counties, 'bigcounties': cmd_bigcounties, 'collect': cmd_collect, 'refresh': cmd_refresh, 'cost': cmd_cost, 'check': cmd_check}[a.job](a)
