#!/usr/bin/env python3
"""The money behind the 2026 midterms: reads the FEC's API and Google's political-ads transparency bundle and writes
news/money/data/money.json. Runs on GitHub Actions (.github/workflows/money.yml); the sandbox can't reach either site.

  FEC_API_KEY   a free key from api.open.fec.gov/developers (1,000 requests an hour). Without it DEMO_KEY is used,
                which allows about 30 an hour: enough for the candidates and the outside spending, not the donors or
                the platform payments; those fill in on the next run with a key.

Every request is logged (status, rows, the error text) into money.json["log"], so a failed query can be fixed from the
committed file. Standard library only.
"""
import json, os, sys, time, re, io, csv, zipfile, urllib.request, urllib.error, urllib.parse, datetime as dt, tempfile, collections, traceback

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, 'data'); os.makedirs(DATA, exist_ok=True)
OUT = os.path.join(DATA, 'money.json')
FEC = 'https://api.open.fec.gov/v1'
KEY = os.environ.get('FEC_API_KEY') or 'DEMO_KEY'
DEMO = KEY == 'DEMO_KEY'
LIMIT = 38 if DEMO else 900  # DEMO_KEY: 40 calls an hour
GOOGLE_ZIP = 'https://storage.googleapis.com/political-csv/google-political-ads-transparency-bundle.zip'  # moved here in 2025; the old bundle holds only a README saying so
CYCLE = 2026
PLATFORMS = {'meta': ['META PLATFORMS', 'FACEBOOK'], 'google': ['GOOGLE']}
MOCK = '--mock' in sys.argv
LOG = []; CALLS = [0]
csv.field_size_limit(min(sys.maxsize, 2 ** 31 - 1))


def now(): return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
def num(v):
    try: return float(str(v).replace(',', '').replace('$', ''))
    except (TypeError, ValueError): return 0.0
def log(q, status, n=0, note=''):
    LOG.append({'q': q, 'status': status, 'n': n, 'note': note[:1600], 'at': now()}); print(f'  {status} {q} -> {n} {note[:160]}', flush=True)
def load(p, default=None):
    try: return json.load(open(p, encoding='utf-8'))
    except FileNotFoundError: return default


def fec(path, **params):
    """One FEC request; (results, pagination) or (None, None). Counts against LIMIT; retries the rate limit."""
    if CALLS[0] >= LIMIT: log(path, 'skipped', 0, f'request limit {LIMIT} reached ({"DEMO_KEY" if DEMO else "key"})'); return None, None
    params = {k: v for k, v in params.items() if v is not None}; params['api_key'] = KEY
    url = f'{FEC}{path}?' + urllib.parse.urlencode(params, doseq=True)
    q = path + '?' + '&'.join(f'{k}={v}' for k, v in params.items() if k != 'api_key')
    for attempt in range(4):
        CALLS[0] += 1
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'the-watch-money/1.0 (bboldt86.github.io/lanscape-navigator)'})
            with urllib.request.urlopen(req, timeout=120) as r: d = json.loads(r.read())
            res = d.get('results', []); log(q, r.status, len(res)); time.sleep(0.4 if not DEMO else 2.0)
            return res, d.get('pagination') or {}
        except urllib.error.HTTPError as e:
            txt = e.read().decode('utf-8', 'replace')
            if e.code == 429 and DEMO: log(q, 429, 0, 'DEMO_KEY rate limit (40 an hour) reached; stopping'); CALLS[0] = LIMIT; return None, None
            if e.code == 429 and attempt < 3: log(q, 429, 0, 'rate limited, waiting'); time.sleep(20); continue
            log(q, e.code, 0, txt); return None, None
        except Exception as e:
            log(q, 'error', 0, str(e)); time.sleep(5)
    return None, None


def pages(path, max_pages, **params):
    """Page-number pagination (the aggregate endpoints)."""
    out = []
    for p in range(1, max_pages + 1):
        res, pg = fec(path, page=p, **params)
        if res is None: return None if p == 1 else out
        out += res
        if not res or p >= (pg.get('pages') or 1): break
    return out

def keyset(path, max_pages, amount_key, **params):
    """Keyset pagination (the itemized schedules): follow pagination.last_indexes."""
    out = []; last = {}
    for _ in range(max_pages):
        res, pg = fec(path, **params, **last)
        if res is None: break  # what came before stands
        out += res
        li = (pg or {}).get('last_indexes') or {}
        if not res or not li.get('last_index'): break
        last = {'last_index': li['last_index']}
        if li.get(amount_key) is not None: last[amount_key] = li[amount_key]
    return out


# ---------- the election's results (for who won what) ----------
W = os.path.normpath(os.path.join(HERE, '..', 'wave', 'data'))
NIGHT = load(os.path.join(W, 'night.json'), {}); SHIFT = load(os.path.join(W, 'shift.json'), {})
RESULTS = {}  # (st, office, district) -> {winner party, winner names, cands, margin}
for r in NIGHT.get('races', []):
    key = (r['st'], r['o'], r.get('seat'))
    RESULTS[key] = {'p': r.get('p'), 'won': r.get('won') or [], 'cands': r.get('cands') or [], 'd': r.get('d'), 'r': r.get('r'), 't': r.get('t'), 'e': r.get('e'), 'at': r.get('at'), 'id': r['id']}
def lastname(n):
    n = re.sub(r',.*', '', n or '').strip(); n = re.sub(r'\s+(JR|SR|II|III|IV)\.?$', '', n, flags=re.I); return n.split()[-1].upper() if n else ''
def fec_name_last(n):
    """FEC names are 'LAST, FIRST M'."""
    parts = (n or '').split(',')[0].strip().split(); return parts[-1].upper() if parts else ''
def match_result(cid, name, state, office, district=None):
    """The result record and whether this candidate won, by state, office, district and last name."""
    try: d = int(district) if district not in (None, '', '00') else None
    except (TypeError, ValueError): d = None
    key = (state, office, d)
    if office == 'S' and key not in RESULTS:  # special elections (the FL and OH seats) carry a seat tag; try any Senate race in the state
        cands = [k for k in RESULTS if k[0] == state and k[1] == 'S']; key = cands[0] if len(cands) == 1 else key
    res = RESULTS.get(key)
    if not res: return None, None
    ln = fec_name_last(name)
    mine = next((c for c in res['cands'] if lastname(c[0]) == ln), None)
    won = any(lastname(w) == ln for w in res['won']) if res['won'] else (None if res['p'] is None else False if mine else None)
    return res, won


# ---------- FEC ----------
def candidates():
    """Senate candidates of 2026 with their totals (Form 3), and the House candidates who raised the most."""
    out = {}
    for office, max_pages, min_receipts in (('S', 3, 100000), ('H', 6 if not DEMO else 0, 1500000)):
        rows = pages('/candidates/totals/', max_pages, cycle=CYCLE, election_year=CYCLE, office=office, is_active_candidate='true', sort='-receipts', per_page=100) or []
        bad = 0
        for c in rows:
            try:
                if num(c.get('receipts')) < min_receipts: continue
                res, won = match_result(c['candidate_id'], c.get('name'), c.get('state'), office, c.get('district'))
                out[c['candidate_id']] = {'id': c['candidate_id'], 'name': c.get('name'), 'party': str(c.get('party') or '')[:3], 'st': c.get('state'), 'office': office, 'district': c.get('district'),
                                          'receipts': round(num(c.get('receipts'))), 'disbursements': round(num(c.get('disbursements'))), 'cash': round(num(c.get('cash_on_hand_end_period'))),
                                          'individual': round(num(c.get('individual_itemized_contributions'))), 'pacs': round(num(c.get('other_political_committee_contributions'))),
                                          'incumbent': str(c.get('incumbent_challenge') or ''), 'won': won, 'race': res['id'] if res else None}
            except Exception:
                bad += 1
                if bad == 1: log('candidate row', 'crash', 0, traceback.format_exc()[-700:] + ' ROW: ' + json.dumps(c)[:500])
        if bad: log('candidate rows skipped', 'warn', bad)
        if not rows and office == 'S': break
    return out

def independent_expenditures(cands):
    """Outside spending for and against candidates, by committee: Schedule E aggregated by candidate and committee.
    The endpoint wants a state with office=senate, so the Senate is asked state by state (every state with a race);
    the House is asked in batches of candidate ids (with a key only: it takes ~40 calls)."""
    rows = []
    senate_states = sorted({k[0] for k in RESULTS if k[1] == 'S'})
    for st in senate_states:
        got = pages('/schedules/schedule_e/by_candidate/', 2, cycle=CYCLE, election_full='true', office='senate', state=st, sort='-total', per_page=100)
        if got is None: break
        rows += got
    if not DEMO:
        house = [c for c, v in cands.items() if v['office'] == 'H']
        for i in range(0, len(house), 20):
            got = pages('/schedules/schedule_e/by_candidate/', 3, cycle=CYCLE, election_full='true', candidate_id=house[i:i + 20], sort='-total', per_page=100)
            if got is None: break
            rows += got
    ie = []
    for r in rows:
        cid = r.get('candidate_id') or ''
        if not cid or num(r.get('total')) < 25000: continue
        if cid[0] not in 'SH': continue
        ie.append({'cand': cid, 'cand_name': r.get('candidate_name'), 'cmte': r.get('committee_id'), 'cmte_name': r.get('committee_name'), 'so': r.get('support_oppose_indicator'), 'total': round(num(r.get('total'))), 'n': r.get('count')})
        if cid not in cands:  # a candidate the totals didn't list (e.g. one who raised little but drew outside money)
            st = cid[2:4]; office = cid[0]
            res, won = match_result(cid, r.get('candidate_name'), st, office, None)
            cands[cid] = {'id': cid, 'name': r.get('candidate_name'), 'party': '', 'st': st, 'office': office, 'district': None, 'receipts': 0, 'disbursements': 0, 'cash': 0, 'individual': 0, 'pacs': 0, 'incumbent': '', 'won': won, 'race': res['id'] if res else None, 'thin': True}
    log('ie rows', 'ok', len(ie))
    return ie

def donors(committees, top_n):
    """The biggest contributors to the committees that spent the most on races (Schedule A, itemized, one page each)."""
    out = {}
    for cid in list(committees)[:top_n]:
        rows = keyset('/schedules/schedule_a/', 2, 'last_contribution_receipt_amount', committee_id=cid, two_year_transaction_period=CYCLE, sort='-contribution_receipt_amount', per_page=100, min_amount=10000, is_individual=None)
        agg = {}
        for r in rows:
            if (r.get('memo_code') or '') == 'X': continue
            name = (r.get('contributor_name') or '').strip(); amt = r.get('contribution_receipt_amount') or 0
            if not name or amt <= 0: continue
            k = re.sub(r'[^A-Z0-9]', '', name.upper())[:40]
            a = agg.setdefault(k, {'name': name.title() if name.isupper() else name, 'employer': (r.get('contributor_employer') or '').title(), 'occupation': (r.get('contributor_occupation') or '').title(), 'state': r.get('contributor_state'), 'entity': r.get('entity_type'), 'amount': 0, 'n': 0, 'last': ''})
            a['amount'] += amt; a['n'] += 1; a['last'] = max(a['last'], r.get('contribution_receipt_date') or '')
        out[cid] = sorted(agg.values(), key=lambda a: -a['amount'])[:40]
        for a in out[cid]: a['amount'] = round(a['amount'])
    return out

def platform_payments():
    """What committees paid Meta and Google directly (Schedule B, itemized), by committee and by month. Most digital buys
    go through vendors, so this is a floor, not the total."""
    out = {}
    for plat, names in PLATFORMS.items():
        seen = set(); by_cmte = {}; by_month = collections.Counter(); by_party_month = collections.defaultdict(collections.Counter); total = 0.0; n = 0
        for nm in names:
            rows = keyset('/schedules/schedule_b/', 12 if not DEMO else 0, 'last_disbursement_amount', two_year_transaction_period=CYCLE, recipient_name=nm, sort='-disbursement_amount', per_page=100, min_amount=2500)
            for r in rows:
                sid = r.get('sub_id') or (r.get('committee_id'), r.get('disbursement_date'), r.get('disbursement_amount'))
                if sid in seen: continue
                seen.add(sid)
                rn = (r.get('recipient_name') or '').upper()
                if plat == 'google' and not re.search(r'\bGOOGLE\b', rn): continue
                if plat == 'meta' and not re.search(r'\bMETA\b|FACEBOOK', rn): continue
                amt = r.get('disbursement_amount') or 0; c = r.get('committee') or {}; cid = r.get('committee_id') or c.get('committee_id') or '?'
                b = by_cmte.setdefault(cid, {'id': cid, 'name': c.get('name') or r.get('committee_name') or cid, 'party': c.get('party') or '', 'type': c.get('committee_type') or '', 'designation': c.get('designation') or '', 'state': c.get('state') or '', 'amount': 0.0, 'n': 0, 'purpose': collections.Counter()})
                b['amount'] += amt; b['n'] += 1; b['purpose'][(r.get('disbursement_description') or '').upper()[:40]] += amt
                m = (r.get('disbursement_date') or '')[:7]
                if m: by_month[m] += amt; by_party_month[(c.get('party') or 'other')[:3]][m] += amt
                total += amt; n += 1
        for b in by_cmte.values(): b['amount'] = round(b['amount']); b['purpose'] = [k for k, _ in b['purpose'].most_common(2)]
        out[plat] = {'total_itemized': round(total), 'n': n, 'floor': True, 'by_committee': sorted(by_cmte.values(), key=lambda b: -b['amount'])[:150], 'by_month': {k: round(v) for k, v in sorted(by_month.items())},
                     'by_party_month': {p: {k: round(v) for k, v in sorted(c.items())} for p, c in by_party_month.items()}}
    return out


# ---------- Google's transparency bundle ----------
_COLS = {}
def col(row, *names):
    """A column by name, case- and space-insensitively; the lookup is memoized per header."""
    hdr = tuple(row); m = _COLS.get(hdr)
    if m is None: m = _COLS[hdr] = {k.lower().replace(' ', '_'): k for k in hdr}
    for nme in names:
        k = m.get(nme.lower())
        if k is not None: return row[k]
    return None
def google_ads():
    """Advertisers, their weekly spend this cycle, their state split and their biggest ads, from the public bundle."""
    tmp = tempfile.mkdtemp(prefix='gads-'); zp = os.path.join(tmp, 'bundle.zip')
    try:
        req = urllib.request.Request(GOOGLE_ZIP, headers={'User-Agent': 'the-watch-money/1.0'})
        with urllib.request.urlopen(req, timeout=600) as r, open(zp, 'wb') as f:
            while True:
                b = r.read(1 << 20)
                if not b: break
                f.write(b)
        log('google bundle', 200, os.path.getsize(zp) // (1 << 20), 'MB')
    except Exception as e: log('google bundle', 'error', 0, str(e)); return None
    z = zipfile.ZipFile(zp); names = {os.path.basename(n): n for n in z.namelist() if not n.startswith('__MACOSX')}; log('google bundle files', 'ok', len(names), ', '.join(f'{i.filename} ({i.file_size // 1024}K)' for i in z.infolist())[:1500])
    for nm, full in names.items():
        if nm.lower().startswith('readme'):
            try: log('google bundle README', 'ok', 0, z.read(full).decode('utf-8', 'replace')[:1500])
            except Exception as e: log('google bundle README', 'error', 0, str(e))
    def rows(fname):
        n = next((v for k, v in names.items() if k.endswith(fname)), None)
        if not n: log(fname, 'missing'); return
        with z.open(n) as f:
            for row in csv.DictReader(io.TextIOWrapper(f, encoding='utf-8', errors='replace')): yield row
    since = '2025-01-01'
    weekly = collections.defaultdict(dict); total_week = collections.Counter()
    for row in rows('advertiser-weekly-spend.csv'):
        wk = col(row, 'Week_Start_Date') or ''; usd = num(col(row, 'Spend_USD'))
        if wk < since or usd <= 0: continue
        aid = col(row, 'Advertiser_ID'); weekly[aid][wk] = weekly[aid].get(wk, 0) + usd; total_week[wk] += usd
    adv = {}
    for row in rows('advertiser-stats.csv'):
        aid = col(row, 'Advertiser_ID')
        if aid not in weekly: continue
        adv[aid] = {'id': aid, 'name': col(row, 'Advertiser_Name'), 'ids': (col(row, 'Public_IDs_List') or '')[:200], 'regions': col(row, 'Regions'), 'elections': (col(row, 'Elections') or '')[:120], 'creatives_all': int(num(col(row, 'Total_Creatives'))), 'spend_all': round(num(col(row, 'Spend_USD'))), 'cycle': round(sum(weekly[aid].values())), 'weekly': sorted(weekly[aid].items()), 'states': {}, 'ads': []}
    for aid, w in weekly.items():
        if aid not in adv: adv[aid] = {'id': aid, 'name': aid, 'cycle': round(sum(w.values())), 'weekly': sorted(w.items()), 'states': {}, 'ads': []}
    top = sorted(adv.values(), key=lambda a: -a['cycle'])[:120]; topids = {a['id'] for a in top}
    log('google advertisers this cycle', 'ok', len(adv), f'top {top[0]["name"] if top else "-"} ${top[0]["cycle"]:,}' if top else '')
    for row in rows('advertiser-geo-spend.csv'):
        aid = col(row, 'Advertiser_ID')
        if aid in topids and (col(row, 'Country') or 'US') == 'US':
            st = col(row, 'Country_Subdivision_Primary') or ''; usd = num(col(row, 'Spend_USD'))
            if st and usd > 0: adv[aid]['states'][st] = round(usd)
    state_all = collections.Counter()
    for row in rows('geo-spend.csv'):
        if (col(row, 'Country') or 'US') == 'US': state_all[col(row, 'Country_Subdivision_Primary') or ''] += num(col(row, 'Spend_USD'))
    nads = 0; allads = []
    try:
      for row in rows('creative-stats.csv'):
          aid = col(row, 'Advertiser_ID')
          if aid not in topids: continue
          start = col(row, 'Date_Range_Start') or col(row, 'First_Served_Timestamp') or ''
          if start[:10] < since: continue
          reg = col(row, 'Regions') or ''
          if reg and 'US' not in reg: continue
          a = {'id': col(row, 'Ad_ID'), 'url': col(row, 'Ad_URL'), 'type': col(row, 'Ad_Type'), 'adv': aid, 'start': start[:10], 'end': (col(row, 'Date_Range_End') or col(row, 'Last_Served_Timestamp') or '')[:10],
               'impr': col(row, 'Impressions') or '', 'lo': round(num(col(row, 'Spend_Range_Min_USD'))), 'hi': round(num(col(row, 'Spend_Range_Max_USD'))), 'geo': (col(row, 'Geo_Targeting_Included') or '')[:120], 'age': (col(row, 'Age_Targeting') or '')[:60], 'gender': (col(row, 'Gender_Targeting') or '')[:40]}
          nads += 1; adv[aid]['ads'].append(a)
          if len(adv[aid]['ads']) > 400: adv[aid]['ads'] = sorted(adv[aid]['ads'], key=lambda x: -x['lo'])[:200]
    except Exception: log('google creatives', 'crash', nads, traceback.format_exc()[-900:])
    for a in top: a['ads'] = sorted(a['ads'], key=lambda x: (-x['lo'], x['start']))[:10]; a['n_ads_cycle'] = sum(1 for _ in a['ads'])
    log('google ads this cycle (top advertisers)', 'ok', nads)
    z.close()
    try: os.remove(zp)
    except OSError: pass
    return {'fetched': now(), 'source': 'Google Ads Transparency Center political-ads bundle (storage.googleapis.com/transparencyreport/google-political-ads-transparency-bundle.zip)', 'since': since,
            'weekly_total': sorted((k, round(v)) for k, v in total_week.items()), 'advertisers': top, 'state_all_time': {k: round(v) for k, v in state_all.most_common(60)}}


# ---------- put it together ----------
def stage(name, fn, default):
    """One stage of the fetch; a crash is logged (with its traceback) instead of ending the run."""
    try: return fn()
    except Exception as e:
        log(name, 'crash', 0, traceback.format_exc()[-900:]); print(traceback.format_exc(), file=sys.stderr); return default

def build():
    prev = load(OUT, {}) or {}
    if MOCK: return mock(prev)
    t0 = time.time()
    cands = stage('candidates', candidates, {})
    ie = stage('ie', lambda: independent_expenditures(cands), [])
    by_cmte = collections.Counter()
    for r in ie: by_cmte[r['cmte']] += r['total']
    cmte_names = {r['cmte']: r['cmte_name'] for r in ie}
    top_cmtes = [c for c, _ in by_cmte.most_common(60)]
    dons = stage('donors', lambda: donors(top_cmtes, 30 if not DEMO else 0), {})
    plats = stage('platforms', platform_payments, {})
    gads = stage('google', google_ads, None)
    # keep what the last run had when a source came back empty this time
    if len(cands) < len(prev.get('candidates') or {}): cands = prev['candidates']; log('candidates', 'kept', len(cands), 'from the last run (this run got fewer)')
    if len(ie) < len(prev.get('ie') or []): ie = prev['ie']; log('ie', 'kept', len(ie), 'from the last run (this run got fewer)')
    if not dons and prev.get('donors'): dons = prev['donors']; log('donors', 'kept', len(dons), 'from the last run')
    if (not plats or not any(v.get('n') for v in plats.values())) and prev.get('platforms'): plats = prev['platforms']; log('platforms', 'kept', 0, 'from the last run')
    if not gads and prev.get('google_ads'): gads = prev['google_ads']; log('google', 'kept', 0, 'from the last run')
    out = {'v': 1, 'fetched': now(), 'cycle': CYCLE, 'key': 'DEMO_KEY' if DEMO else 'FEC_API_KEY', 'calls': CALLS[0], 'seconds': round(time.time() - t0),
           'sources': {'fec': 'Federal Election Commission, OpenFEC API (api.open.fec.gov): candidate totals (Form 3), independent expenditures by candidate (Schedule E, 24/48-hour reports included), itemized receipts (Schedule A) and disbursements (Schedule B) for the 2025–2026 cycle', 'results': 'AP via The New York Times (The Watch’s wave data)', 'google': (gads or {}).get('source')},
           'candidates': cands, 'ie': ie, 'committees': {c: {'id': c, 'name': cmte_names.get(c), 'ie_total': round(by_cmte[c])} for c in top_cmtes}, 'donors': dons, 'platforms': plats, 'google_ads': gads, 'log': LOG[-400:]}
    return out

def mock(prev):
    """Made-up data in the real shape, for building the page without the network."""
    import random; random.seed(7)
    cands = {}; ie = []; cm = [('C00571703', 'Senate Leadership Fund'), ('C00484642', 'Senate Majority PAC'), ('C00697441', 'Club for Growth Action'), ('C00495861', 'Americans for Prosperity Action'), ('C00401224', 'ActBlue'), ('C00580100', 'Duty and Country'), ('C00887588', 'Preserve America'), ('C00779744', 'Fairshake'), ('C00799031', 'One Nation'), ('C00630012', 'Future Forward USA')]
    for (st, o, seat), res in RESULTS.items():
        if o == 'G' or (o == 'H' and random.random() > 0.08): continue
        for i, (nm, p, v) in enumerate(res['cands'][:2]):
            cid = f"{o}6{st}{random.randint(10000, 99999)}"; ln = nm.split()[-1].upper()
            cands[cid] = {'id': cid, 'name': f"{ln}, {nm.split()[0].upper()}", 'party': p if p in ('D', 'R') else 'IND', 'st': st, 'office': o, 'district': seat, 'receipts': random.randint(2, 90) * 1e6, 'disbursements': 0, 'cash': 0, 'individual': 0, 'pacs': 0, 'incumbent': 'I' if i == 0 else 'C', 'won': nm in res['won'], 'race': res['id']}
            for c, cn in random.sample(cm, 3):
                ie.append({'cand': cid, 'cand_name': cands[cid]['name'], 'cmte': c, 'cmte_name': cn, 'so': random.choice('SOO'), 'total': random.randint(1, 60) * 1e6 * random.random(), 'n': 12})
    by = collections.Counter();
    for r in ie: by[r['cmte']] += r['total']
    dons = {c: [{'name': f'Donor {i} {cn.split()[0]}', 'employer': 'Example Corp', 'occupation': 'Investor', 'state': 'TX', 'entity': 'IND', 'amount': random.randint(1, 60) * 1e6 * random.random(), 'n': 3, 'last': '2026-10-01'} for i in range(12)] for c, cn in cm}
    plats = {p: {'total_itemized': 12e6, 'n': 300, 'floor': True, 'by_committee': [{'id': c, 'name': cn, 'party': random.choice(['DEM', 'REP']), 'type': 'O', 'designation': 'U', 'state': 'DC', 'amount': random.randint(1, 30) * 1e5, 'n': 9, 'purpose': ['DIGITAL ADVERTISING']} for c, cn in cm], 'by_month': {f'2026-{m:02d}': random.randint(5, 40) * 1e5 for m in range(1, 11)}, 'by_party_month': {'DEM': {f'2026-{m:02d}': random.randint(1, 20) * 1e5 for m in range(1, 11)}, 'REP': {f'2026-{m:02d}': random.randint(1, 20) * 1e5 for m in range(1, 11)}}} for p in PLATFORMS}
    weeks = [f'2026-{m:02d}-{d:02d}' for m in range(1, 11) for d in (4, 18)]
    gads = {'fetched': now(), 'source': 'mock', 'since': '2025-01-01', 'weekly_total': [(w, random.randint(5, 60) * 1e5) for w in weeks], 'state_all_time': {'Texas': 9e7, 'Ohio': 5e7},
            'advertisers': [{'id': f'AR{i}', 'name': cn, 'cycle': random.randint(1, 40) * 1e6, 'weekly': [(w, random.randint(1, 9) * 1e5) for w in weeks], 'states': {'Texas': 2e6, 'Ohio': 1e6}, 'ads': [{'id': f'CR{i}{j}', 'url': 'https://adstransparency.google.com/', 'type': random.choice(['VIDEO', 'TEXT', 'IMAGE']), 'adv': f'AR{i}', 'start': '2026-09-01', 'end': '2026-11-03', 'impr': '1M-10M', 'lo': 100000, 'hi': 500000, 'geo': 'Ohio', 'age': '', 'gender': ''} for j in range(4)]} for i, (c, cn) in enumerate(cm)]}
    return {'v': 1, 'fetched': now(), 'cycle': CYCLE, 'key': 'mock', 'calls': 0, 'seconds': 0, 'mock': True, 'sources': {'fec': 'mock', 'results': 'mock', 'google': 'mock'}, 'candidates': cands, 'ie': ie, 'committees': {c: {'id': c, 'name': cn, 'ie_total': round(by[c])} for c, cn in cm}, 'donors': dons, 'platforms': plats, 'google_ads': gads, 'log': [{'q': 'mock', 'status': 'ok', 'n': 0, 'note': '', 'at': now()}]}


if __name__ == '__main__':
    try: out = build()
    except Exception:
        log('build', 'crash', 0, traceback.format_exc()[-900:]); print(traceback.format_exc(), file=sys.stderr)
        out = {'v': 1, 'fetched': now(), 'cycle': CYCLE, 'key': 'DEMO_KEY' if DEMO else 'FEC_API_KEY', 'calls': CALLS[0], 'candidates': {}, 'ie': [], 'committees': {}, 'donors': {}, 'platforms': {}, 'google_ads': None, 'log': LOG[-400:], 'crashed': True}
    json.dump(out, open(OUT, 'w', encoding='utf-8'), indent=0, ensure_ascii=False)
    print('LOG:'); [print(' ', l['status'], l['q'], l['n'], l['note'][:200]) for l in out.get('log', [])[-60:]]
    print(f"money.json: {len(out['candidates'])} candidates, {len(out['ie'])} outside-spending rows, {len(out['donors'])} committees with donors, platforms {[ (k, v.get('n')) for k, v in (out.get('platforms') or {}).items() ]}, google {len((out.get('google_ads') or {}).get('advertisers') or [])} advertisers; {out['calls']} FEC calls ({out['key']})")
