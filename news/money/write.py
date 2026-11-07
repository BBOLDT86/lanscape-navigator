#!/usr/bin/env python3
"""The money, written: Claude (the API, Opus 5.5) reports who paid for the 2026 races, from data/money.json and the
web. Shares the wave writer's API client, prices, ledger (news/wave/data/spend.json) and $ cap (news/wave/tools/write.py).

  python3 news/money/write.py national [--budget 15] [--effort max]      -> data/reports/_US.json
  python3 news/money/write.py states [--budget 120] [--states TX,OH] [--effort high] [--redo] [--parallel 3]
                                                                           -> data/reports/<ST>.json, one per state with a race
  python3 news/money/write.py donors [--budget 25] [--n 12]               -> data/donors/<key>.json, the biggest donors
  python3 news/money/write.py refresh [--budget 4]                        -> what the data has changed since it was written
  python3 news/money/write.py check | cost
"""
import json, os, re, sys, time, argparse, threading, datetime as dt, collections
HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, 'data'); WAVE = os.path.normpath(os.path.join(HERE, '..', 'wave'))
sys.path.insert(0, os.path.join(WAVE, 'tools'))
import write as wave  # the client, PRICE, Run, ledger, message(), now(), save(), load(), NAME, STATES, races_of, main_race, margin, pts, n
from write import NAME, now, save, load, margin, pts, n, message, Run, price, MODEL
sys.path.insert(0, HERE)
import build as B  # the sums: races, committees, donors, platforms (reads data/money.json)

MOCK = False
def usd(v): return B.usd(v)
def race_result_line(st):
    out = []
    for k, rc in wave.races_of(st).items():
        res = {'D': f"{rc['dem']} won", 'R': f"{rc['rep']} won", None: 'NOT CALLED by AP'}[rc.get('winner')]
        out.append(f"- {rc['office']}: {rc['dem']} ({'D' if rc['demParty'] == 'D' else 'independent'}) v {rc['rep']} (R): {margin(rc['m26'])} ({n(rc['demVotes'])} to {n(rc['repVotes'])}), {res}; the state's 2024 presidential margin was {margin(rc['m24'])}, a move of {pts(rc['m26'] - rc['m24'])} points.")
    return '\n'.join(out)

SYSTEM = """You are Claude, reporting for The Watch, a one-person news site (bboldt86.github.io/lanscape-navigator/news/). The Watch's "money" report follows the money behind the Nov. 3, 2026 midterms: who paid for the ads, through which committees, in which races, and what it bought. You are writing the piece for one state.

Your materials:
1. THE DATA BLOCK in the user message: the Federal Election Commission's figures for the state's federal races (candidate totals; outside spending — independent expenditures — for and against each candidate, by committee; the biggest donors to those committees; what committees in the state paid Meta and Google directly) plus the results. Every dollar figure for a federal race should come from this block; where you need a figure the block doesn't have (a state race for governor, a super PAC's total, a specific ad buy, a donor's business), take it from the web and attribute it in the text to the filing or the outlet ("according to the Ohio secretary of state's filings", "AdImpact's count, reported by ...").
2. THE WEB, through the web_search tool (6 to 12 searches): the committees and donors behind the ads (who they are, what business they are in, what they wanted), the ads themselves (what they said, who the ad was about, where it ran — TV, YouTube, Facebook, streaming, mail), the vendors, the state's own campaign-finance filings for governor's races, and what the local press (the state's newspapers and public radio) and the established national outlets (AP, Reuters, The New York Times, The Washington Post, NPR, Politico, OpenSecrets, AdImpact, the Daily Beast is not acceptable) reported. Prefer original reporting and the filings. No tabloids, anonymous blogs or partisan sites.

Standards:
- Cite as you go: every claim from the web must be supported by a search result (the tool's citations). Attribute in the text where it matters.
- Quote sparingly, never more than 25 words from one source; paraphrase.
- No invented quotes, no speculation presented as fact, no motives you can't source. "Bought a seat" is The Watch's framing for the section, not a finding: say what the money did and whether the side that spent more won, and let the reader judge. If reporting disagrees, say so. If the race isn't called, say so.
- Neutral, concrete, plain English, in the voice of a careful newspaper feature: names, dollars, dates, places. No cliché ("dark money" only when it is the legal term for undisclosed donors, explained; "bombshell", "stunning" never). Full names on first mention. Say what kind of committee each is (super PAC, party committee, 501(c)(4), hybrid PAC) when it matters.
- 650 to 950 words of body text. Three subheads: one on where the money came from, one on the ads (what they said, who ran them, where), one on whether it worked.

Output exactly this skeleton, in plain text (no markdown besides the "## " subheads), nothing before or after it:

HEADLINE: <a headline of at most 12 words, specific to this state>
DEK: <one or two sentences, 25 to 45 words>
SUMMARY: <one sentence of at most 22 words for a list of all the states>
BODY:
<the body: paragraphs separated by blank lines; a subhead is a line starting with "## ">
ADS:
<up to five lines, one per notable ad or ad campaign, each: sponsor (the committee or campaign that paid) | what the ad said or showed, in at most 25 words | who paid for the sponsor (its biggest donors, from the data block or the web) | where it ran (TV, YouTube, Meta, streaming, mail; and the markets or counties if known) | the URL of the source for this ad>
PLAYERS:
<up to six lines, one per key player, each: name | role (super PAC, donor, party committee, vendor, candidate) | side (Democratic or Republican) | dollars, with what they are the dollars of (e.g. "$12.4M in independent expenditures", "$5M to Senate Leadership Fund") | one clause of at most 18 words on what they did>"""

NATIONAL_SYSTEM = SYSTEM.replace("You are writing the piece for one state.", "You are writing the national piece: the whole picture of the outside money in the 2026 midterms — the biggest donors and companies, the committees they funded, the races they went after, the platforms and vendors the ads went through, and what it bought.").replace(
    "for the state's federal races", "for the Senate and House races nationally").replace("(6 to 12 searches)", "(10 to 16 searches)").replace(
    "- 650 to 950 words of body text. Three subheads: one on where the money came from, one on the ads (what they said, who ran them, where), one on whether it worked.",
    "- 1,100 to 1,500 words of body text. Four or five subheads: where the money came from (the donors and companies), where it went (the committees and the races), where the ads ran (Meta, Google and YouTube, TV, streaming — and the vendors between the committees and the platforms, which is why the direct platform payments in the data are a floor), what the ads said, and whether it worked.").replace(
    "<a headline of at most 12 words, specific to this state>", "<a headline of at most 12 words>").replace("<one sentence of at most 22 words for a list of all the states>", "<one sentence of at most 22 words>").replace("<up to five lines", "<up to eight lines").replace("<up to six lines", "<up to ten lines")

DONOR_SYSTEM = """You are Claude, reporting for The Watch. Write a short profile (120 to 180 words, one or two paragraphs, plain text, no headline, no markdown) of one donor to the outside-spending committees of the 2026 midterms: who they are (the person or company, their business, where they are), what they gave this cycle and to which committees (from the data block: those figures are the FEC's and must be used as given), what those committees spent it on, what the donor has said they want (only if reported), and how it came out. Use web search (3 to 6 searches); every claim from the web must carry a search citation; attribute in the text. Neutral, concrete, no speculation about motives, no cliché. Output the profile only."""


# ---------- data blocks ----------
def state_block(st):
    L = [f"STATE: {NAME[st]} ({st}). FEC data read {B.FETCHED}. Results: AP via The New York Times.", "", "THE RACES ON THE WAVE (the vote):", race_result_line(st), ""]
    rs = [r for r in B.SEN + B.HOUSE if r['st'] == st]
    if rs:
        L.append("FEDERAL RACES: OUTSIDE MONEY (independent expenditures reported to the FEC, 2025–26, for and against, by committee):")
        for r in rs:
            L.append(f"{r['label']}: {usd(r['D'])} helped the Democratic side, {usd(r['R'])} the Republican side; total {usd(r['total'])}" + (f"; ${r['per_vote']:.2f} per vote cast" if r['per_vote'] else '') + (f"; the side with more outside money {'won' if r['money_won'] else 'lost'}" if r['money_won'] is not None else '; not called') + '.')
            for cc in sorted(r['cands'].values(), key=lambda c: -(c['support'] + c['oppose']))[:6]:
                L.append(f"  - {cc['name']} ({cc['party']}): raised {usd(cc['receipts'])} (Form 3 total receipts); outside money supporting {usd(cc['support'])}, opposing {usd(cc['oppose'])}; {'won' if cc['won'] else 'lost' if cc['won'] is False else 'result not matched'}")
            rows = sorted(r['rows'], key=lambda x: -x['total'])[:12]
            L.append("  By committee: " + '; '.join(f"{B.title_case(x['cmte_name'] or x['cmte'])} {'for' if x['so'] == 'S' else 'against'} {B.cand_label(x['cand'])} {usd(x['total'])}" for x in rows))
        cids = collections.Counter()
        for r in rs:
            for c, v in r['cmtes'].items(): cids[c] += v
        L.append(""); L.append("THE COMMITTEES' BIGGEST DONORS THIS CYCLE (itemized receipts of $10,000+ to each committee, summed by donor; from the FEC):")
        any_d = False
        for c, v in cids.most_common(8):
            ds = (B.M.get('donors') or {}).get(c) or []
            if not ds: continue
            any_d = True; cm = B.cm.get(c, {})
            L.append(f"- {cm.get('name', c)} (spent {usd(v)} in {NAME[st]}, {usd(cm.get('total', 0))} nationally; record {cm.get('won', 0)} won, {cm.get('lost', 0)} lost): " + '; '.join(f"{d['name']}{(' (' + d['employer'] + ')') if d.get('employer') else ''} {usd(d['amount'])}" for d in ds[:10]))
        if not any_d: L.append("(no donor lists in the data yet; take the committees' donors from the web and attribute them)")
    else: L.append("No federal race in this state had reported outside spending in the data (the race on the wave is for governor, a state race: use the state's filings and the press, and attribute).")
    pl = B.PL or {}; paid = []
    for plat in ('meta', 'google'):
        for b in (pl.get(plat) or {}).get('by_committee', []):
            if (b.get('state') or '') == st: paid.append(f"{b['name']} paid {plat.title()} {usd(b['amount'])} ({b['n']} payments)")
    if paid: L += ["", f"DIRECT PLATFORM PAYMENTS by committees registered in {NAME[st]} (a floor; most digital buys go through vendors): " + '; '.join(paid[:12])]
    ga = B.GA or {}; advs = [a for a in (ga.get('advertisers') or []) if st in (a.get('states') or {})]
    advs.sort(key=lambda a: -a['states'][st])
    if advs: L += ["", f"GOOGLE'S TRANSPARENCY REPORT (political ads on Google's platforms — Search, YouTube, display), advertisers with the most spending in {NAME[st]} (by state, cumulative since 2018 for the advertiser; the cycle total is since Jan. 2025) — note that Google's 'political' category also sweeps in advertisers like prediction markets: " + '; '.join(f"{a['name']} {usd(a['states'][st])} in the state, {usd(a['cycle'])} this cycle" + (f"; its biggest ad: {a['ads'][0]['type'].title()}, {B.spend_range(a['ads'][0])}, ran {a['ads'][0]['start']} to {a['ads'][0]['end']}, targeted {a['ads'][0]['geo'][:60] or 'US'}, {a['ads'][0]['url']}" if a.get('ads') else '') for a in advs[:8])]
    return '\n'.join(L)

def national_block():
    L = [f"THE COUNTRY: FEC data read {B.FETCHED}. {usd(B.TOTAL_IE)} in independent expenditures across {len(B.races)} Senate and House races; {usd(B.TOTAL_SEN)} in the {len(B.SEN)} Senate races. The side with more outside money won {sum(1 for r in B.SEN if r['money_won'])} of the {sum(1 for r in B.SEN if r['money_won'] is not None)} decided Senate races.", "",
         "SENATE RACES by outside money (D side / R side; result):"]
    for r in B.SEN: L.append(f"- {r['label']}: {usd(r['D'])} / {usd(r['R'])}; " + (('D+' if r['margin'] > 0 else 'R+') + f"{abs(r['margin']):.1f}, " if r['margin'] is not None else '') + (f"won by {r['won'][0]}" if r['won'] else 'not called') + (f"; the money's side {'won' if r['money_won'] else 'lost'}" if r['money_won'] is not None else ''))
    L += ["", "HOUSE RACES with the most outside money (top 15): " + '; '.join(f"{r['label']} {usd(r['total'])} ({'D' if r['D'] > r['R'] else 'R'} side had more; {('won by ' + r['won'][0]) if r['won'] else 'not called'})" for r in B.HOUSE[:15])]
    L += ["", "THE COMMITTEES (independent expenditures nationally; record = races where the side they spent for won):"]
    for c in B.CM[:20]: L.append(f"- {c['name']} ({c['id']}): {usd(c['total'])}, {usd(c['D'])} helping Democrats, {usd(c['R'])} helping Republicans; {c['won']} won, {c['lost']} lost, {c['open']} open; biggest: " + ', '.join(f"{rr['label']} {usd(rr['usd'])}" for rr in c['races'][:4]))
    L += ["", "THE DONORS (itemized receipts of $10,000+ to the top committees, summed by donor, with the seats those committees spent on):"]
    for d in B.DONORS[:30]: L.append(f"- {d['name']}{(' (' + (d['employer'] or d['occupation']) + ')') if (d['employer'] or d['occupation']) else ''}, {d['state']}: {usd(d['total'])} to " + ', '.join(f"{t['name']} {usd(t['usd'])}" for t in d['to'][:4]) + f"; seats reached {len(d['seats'])}: {d['won']} won, {d['lost']} lost")
    pl = B.PL or {}
    for plat in ('meta', 'google'):
        p = pl.get(plat) or {}
        if p: L += ["", f"DIRECT PAYMENTS TO {plat.upper()} (Schedule B, itemized $2,500+; a floor): {usd(p.get('total_itemized', 0))} in {p.get('n', 0)} payments; by month " + ', '.join(f"{k} {usd(v)}" for k, v in list(p.get('by_month', {}).items())[-10:]) + "; biggest payers: " + '; '.join(f"{b['name']} ({b['party'] or b['type']}) {usd(b['amount'])}" for b in p.get('by_committee', [])[:12])]
    ga = B.GA or {}
    if ga.get('advertisers'):
        L += ["", f"GOOGLE'S TRANSPARENCY REPORT (political ads on Google's platforms, verified advertisers, since Jan. 2025): total {usd(sum(v for _, v in ga.get('weekly_total', [])))}; the biggest weeks " + ', '.join(f"{k[:10]} {usd(v)}" for k, v in sorted(ga.get('weekly_total', []), key=lambda x: -x[1])[:4]) + "; biggest advertisers: " + '; '.join(f"{a['name']} {usd(a['cycle'])}" + (f" (most in {', '.join(sorted(a.get('states', {}), key=lambda s: -a['states'][s])[:2])})" if a.get('states') else '') for a in ga['advertisers'][:15])]
        L.append("Example ads (spend range, targeting, link): " + '; '.join(f"{a['name']}: {x['type'].title()} {usd(x['lo'])}–{usd(x['hi'])}, {x['geo'][:40] or 'US'}, {x['url']}" for a in ga['advertisers'][:6] for x in a.get('ads', [])[:1]))
    return '\n'.join(L)

def donor_block(d):
    L = [f"DONOR: {d['name']}" + (f" ({d['employer']}{', ' + d['occupation'] if d['occupation'] else ''})" if d['employer'] or d['occupation'] else '') + f", {d['state']}. FEC itemized receipts, 2025–26 cycle, read {B.FETCHED}: {usd(d['total'])} in total to the outside-spending committees in the data:"]
    for t in d['to']: L.append(f"- {t['name']}: {usd(t['usd'])} ({'helps Democrats' if t['side'] == 'D' else 'helps Republicans' if t['side'] == 'R' else 'spends on both sides'})")
    L.append("Those committees spent on these races (won = the committee's side won): " + '; '.join(f"{s['label']} ({'won' if s['won'] else 'lost' if s['won'] is False else 'open'})" for s in d['seats'][:14]))
    return '\n'.join(L)


# ---------- parsing the skeleton ----------
def parse(content, sections=('HEADLINE', 'DEK', 'SUMMARY', 'BODY', 'ADS', 'PLAYERS')):
    doc = ''; marks = []; sources = []; seen = {}
    for b in content:
        if b.get('type') != 'text': continue
        t = b.get('text', ''); start = len(doc); doc += t
        for c in b.get('citations') or []:
            u = c.get('url')
            if not u: continue
            if u not in seen: seen[u] = len(sources) + 1; sources.append({'n': seen[u], 'title': (c.get('title') or u)[:160], 'url': u})
            marks.append((start + len(t), seen[u]))
    spans = {}
    heads = [(m.start(), m.end(), m.group(1)) for m in re.finditer(r'^(' + '|'.join(sections) + r'):[ \t]*', doc, re.M)]
    for i, (s0, s1, name) in enumerate(heads):
        e = heads[i + 1][0] if i + 1 < len(heads) else len(doc); spans[name] = (s1, e)
    if 'BODY' not in spans or 'HEADLINE' not in spans: return None, doc
    def text(name): a, b = spans.get(name, (0, 0)); return doc[a:b].strip()
    a0, a1 = spans['BODY']; body = doc[a0:a1]; paras = []; pos = 0
    for chunk in re.split(r'\n\s*\n', body):
        at = body.find(chunk, pos); pos = at + len(chunk); t = chunk.strip()
        if not t: continue
        p0 = a0 + at + (len(chunk) - len(chunk.lstrip())); p1 = p0 + len(t)
        cites = sorted({(min(max(off - p0, 0), len(t)), src) for off, src in marks if p0 < off <= p1 + 1})
        kind = 'h2' if t.startswith('## ') else 'p'
        paras.append({'t': kind, 'text': t[3:].strip() if kind == 'h2' else t, 'cites': [[o, s] for o, s in cites]})
    def lines(name, keys):
        out = []
        for line in text(name).splitlines():
            parts = [p.strip() for p in line.split('|')]
            if len(parts) >= 2 and parts[0]: out.append({k: (parts[i] if i < len(parts) else '') for i, k in enumerate(keys)})
        return out
    ads = lines('ADS', ['sponsor', 'what', 'paid', 'where', 'url'])
    for a in ads:
        if not re.match(r'https?://', a.get('url') or ''): a['url'] = ''
    players = lines('PLAYERS', ['name', 'role', 'side', 'usd', 'note'])
    words = sum(len(p['text'].split()) for p in paras if p['t'] == 'p')
    return {'headline': text('HEADLINE'), 'dek': text('DEK'), 'summary': text('SUMMARY'), 'paras': paras, 'ads': ads[:8], 'players': players[:10], 'sources': sources, 'words': words}, doc

def params(system, user, effort, max_uses, region=None, max_tokens=24000):
    loc = {'type': 'approximate', 'country': 'US'}
    if region: loc['region'] = region
    return {'model': MODEL, 'max_tokens': max_tokens, 'output_config': {'effort': effort},
            'system': [{'type': 'text', 'text': system, 'cache_control': {'type': 'ephemeral'}}],
            'tools': [{'type': 'web_search_20250305', 'name': 'web_search', 'max_uses': max_uses, 'user_location': loc}],
            'messages': [{'role': 'user', 'content': [{'type': 'text', 'text': user}]}]}
def snapshot(st=None):
    """What the piece was written from, to tell when it is stale."""
    rs = [r for r in B.SEN + B.HOUSE if st is None or r['st'] == st]
    return {'ie': round(sum(r['total'] for r in rs)), 'winners': {r['id']: r['winner'] for r in rs}, 'races': {k: {'winner': rc.get('winner')} for s in ([st] if st else wave.STATES) for k, rc in wave.races_of(s).items()} if st or True else {}}
def stale(old, new):
    if not old: return True
    if abs(old.get('ie', 0) - new.get('ie', 0)) > max(2e6, 0.1 * new.get('ie', 1)): return True
    return any(old.get('winners', {}).get(k) != v for k, v in new.get('winners', {}).items()) or any((old.get('races') or {}).get(k, {}).get('winner') != v.get('winner') for k, v in new.get('races', {}).items())

def mock_piece(label):
    return {'headline': f'Who paid for {label} (mock)', 'dek': 'A made-up dek for testing the money pages.', 'summary': f'{label}: mock summary.', 'paras': [{'t': 'p', 'text': 'A mock lede with a citation.', 'cites': [[28, 1]]}, {'t': 'h2', 'text': 'Where the money came from', 'cites': []}, {'t': 'p', 'text': 'A second mock paragraph.', 'cites': []}],
            'ads': [{'sponsor': 'Mock PAC', 'what': 'An ad that said something.', 'paid': 'Donor One, Donor Two', 'where': 'YouTube, TV in Columbus', 'url': 'https://example.com/ad'}], 'players': [{'name': 'Donor One', 'role': 'donor', 'side': 'Republican', 'usd': '$5M to Mock PAC', 'note': 'gave a lot'}], 'sources': [{'n': 1, 'title': 'Mock source', 'url': 'https://example.com/'}], 'words': 20}

def write_one(kind, key, system, user, effort, max_uses, run, path, region=None, min_words=300, label=None):
    t0 = time.time()
    if MOCK: rep = mock_piece(label or key); usage = {'input_tokens': 8000, 'output_tokens': 3000}; searches = 6
    else:
        content, usage, searches, stop = message(params(system, user, effort, max_uses, region))
        rep, raw = parse(content); run.charge(usage, searches=searches, what=f'money {kind} {key}')
        if not rep or not rep['headline'] or rep['words'] < min_words:
            save(path.replace('.json', '') + '_failed.txt', {'stop': stop, 'doc': raw}); print(f'  {kind} {key}: could not parse ({stop})'); return False
    rep.update({'kind': kind, 'key': key, 'written': now(), 'fetched': B.M.get('fetched'), 'model': MODEL, 'effort': effort, 'searches': searches, 'usage': usage, 'usd': price(usage, searches=searches), 'seconds': round(time.time() - t0), 'snapshot': snapshot(key if kind == 'state' else None)})
    save(path, rep); print(f'  {kind} {key}: "{rep["headline"]}" — {rep["words"]} words, {len(rep["sources"])} sources, {searches} searches, {rep["seconds"]}s', flush=True)
    return True

def cmd_states(a, stale_only=False):
    run = Run('money-states', a.budget); want = [s.strip().upper() for s in a.states.split(',')] if a.states else wave.STATES
    todo = []
    for st in want:
        p = os.path.join(DATA, 'reports', st + '.json'); old = load(p)
        if old and not a.redo and not stale(old.get('snapshot'), snapshot(st)): continue
        if stale_only and not old: continue
        todo.append(st)
    todo.sort(key=lambda st: -sum(r['total'] for r in B.SEN + B.HOUSE if r['st'] == st))  # the most money first
    print(f'money states: {len(todo)} to write ({", ".join(todo)}), effort {a.effort}, budget ${a.budget}')
    if a.dry: print(state_block(todo[0] if todo else 'OH')); return
    sem = threading.Semaphore(max(1, a.parallel)); threads = []; done = []
    def work(st):
        with sem:
            if run.over(): print(f'  {st}: budget spent, skipped'); return
            try:
                if write_one('state', st, SYSTEM, f"Write The Watch's money piece for {NAME[st]}. Here is the data block.\n\n{state_block(st)}", a.effort, 12, run, os.path.join(DATA, 'reports', st + '.json'), region=NAME[st], label=NAME[st]): done.append(st)
            except Exception as e: print(f'  {st}: FAILED {e}', flush=True)
    for st in todo: t = threading.Thread(target=work, args=(st,), daemon=True); t.start(); threads.append(t); time.sleep(2)
    for t in threads: t.join()
    print(run.summary(), f'— {len(done)} written')

def cmd_national(a):
    run = Run('money-national', a.budget); p = os.path.join(DATA, 'reports', '_US.json'); old = load(p)
    if old and not a.redo and not stale(old.get('snapshot'), snapshot()): print('money national: written and current'); return
    if a.dry: print(national_block()); return
    write_one('national', 'US', NATIONAL_SYSTEM, f"Write The Watch's national money piece. Here is the data block.\n\n{national_block()}", a.effort, 16, run, p, min_words=500, label='the midterms')
    print(run.summary())

def cmd_donors(a):
    run = Run('money-donors', a.budget); done = 0
    for d in B.DONORS[:a.n]:
        p = os.path.join(DATA, 'donors', d['key'] + '.json'); old = load(p)
        if old and not a.redo: continue
        if run.over(): print('  donors: budget spent'); break
        if a.dry: print(donor_block(d)); return
        t0 = time.time()
        if MOCK: text = f"(Mock) {d['name']} gave {usd(d['total'])}. This profile is made up."; usage = {'input_tokens': 3000, 'output_tokens': 400}; searches = 3; sources = [{'n': 1, 'title': 'Mock', 'url': 'https://example.com/'}]
        else:
            content, usage, searches, stop = message(params(DONOR_SYSTEM, f"Write the profile. Data block:\n\n{donor_block(d)}", a.effort, 6, max_tokens=6000))
            run.charge(usage, searches=searches, what=f'money donor {d["key"]}')
            text = ''.join(b.get('text', '') for b in content if b.get('type') == 'text').strip(); sources = []; seen = {}
            for b in content:
                for c in (b.get('citations') or []):
                    if c.get('url') and c['url'] not in seen: seen[c['url']] = 1; sources.append({'n': len(sources) + 1, 'title': (c.get('title') or c['url'])[:120], 'url': c['url']})
            if len(text.split()) < 60: print(f'  donor {d["key"]}: too short'); continue
        save(p, {'key': d['key'], 'name': d['name'], 'text': text, 'sources': sources, 'written': now(), 'fetched': B.M.get('fetched'), 'model': MODEL, 'usage': usage, 'searches': searches, 'usd': price(usage, searches=searches), 'total': d['total'], 'seconds': round(time.time() - t0)}); done += 1
        print(f'  donor {d["name"]}: {len(text.split())} words, {len(sources)} sources', flush=True)
    print(run.summary(), f'— {done} written')

def cmd_refresh(a):
    L = wave.ledger(); today = now()[:10]; used = sum(r['usd'] for r in L['runs'] if r['when'][:10] == today and r['job'].startswith('money')); left = max(0.0, a.budget - used)
    if left < 1: print(f'money refresh: ${used:.2f} spent today'); return
    cmd_states(argparse.Namespace(**dict(vars(a), budget=left, redo=False, states=None, effort='high')), stale_only=True)
    L = wave.ledger(); used = sum(r['usd'] for r in L['runs'] if r['when'][:10] == today and r['job'].startswith('money')); left = max(0.0, a.budget - used)
    if left >= 8 and load(os.path.join(DATA, 'reports', '_US.json')): cmd_national(argparse.Namespace(**dict(vars(a), budget=left, redo=False, effort='high')))

def cmd_check(a):
    bad = 0; reps = 0
    for f in sorted(os.listdir(os.path.join(DATA, 'reports'))) if os.path.isdir(os.path.join(DATA, 'reports')) else []:
        if not f.endswith('.json'): continue
        rep = load(os.path.join(DATA, 'reports', f)); reps += 1
        if not rep.get('sources') and not MOCK: print(f'{f}: no sources'); bad += 1
        if rep.get('words', 0) < 300: print(f'{f}: {rep.get("words")} words'); bad += 1
        for p in rep.get('paras', []):
            for q in re.findall(r'[“"]([^”"]{20,})[”"]', p['text']):
                if len(q.split()) > 25: print(f'{f}: a quotation over 25 words'); bad += 1
    print(f'check: {reps} money pieces, {bad} problems')

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('job', choices=['national', 'states', 'donors', 'refresh', 'check', 'cost'])
    ap.add_argument('--budget', type=float, default=None); ap.add_argument('--states', default=None); ap.add_argument('--effort', default='high', choices=['low', 'medium', 'high', 'xhigh', 'max'])
    ap.add_argument('--parallel', type=int, default=3); ap.add_argument('--n', type=int, default=12); ap.add_argument('--redo', action='store_true'); ap.add_argument('--dry', action='store_true'); ap.add_argument('--mock', action='store_true')
    a = ap.parse_args(); MOCK = a.mock; wave.MOCK = a.mock
    if a.budget is None: a.budget = {'national': 15.0, 'states': 120.0, 'donors': 25.0, 'refresh': 4.0}.get(a.job, 0.0)
    {'national': cmd_national, 'states': cmd_states, 'donors': cmd_donors, 'refresh': cmd_refresh, 'check': cmd_check, 'cost': lambda a: wave.cmd_cost(a)}[a.job](a)
