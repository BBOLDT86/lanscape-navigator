#!/usr/bin/env python3
"""Pull the UF Election Lab's 2026 early-vote CSV (one row per state) -> data/earlyvote_auto.json

    https://election.lab.ufl.edu/data-downloads/earlyvote/2026/US.csv   (CC BY-NC-ND 4.0; attribution required)

Columns used: state_abbv, turn_2022 (total 2022 turnout), last_update (M/D/YYYY), data_source, request_all (mail
ballots requested; for all-mail states, ballots issued or active registrants), accept_all (mail returned),
inperson_all (in-person early), voted_all (total early votes), voted_dem / voted_rep / voted_none (registration,
where a state has party registration), updates_today. A 0 means "not published" as often as zero.

build.py overlays these state rows on the editorial earlyvote.json wherever the CSV's per-state date is the same
or newer. Fails soft: on a network error it leaves the last file alone and exits 2.
    --fixture FILE   read a saved copy of the CSV (pipe- or comma-delimited) instead of the network (tests)
"""
import csv, io, json, os, sys, time, datetime as dt, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..', 'data')
URL = 'https://election.lab.ufl.edu/data-downloads/earlyvote/2026/US.csv'
PAGE = 'https://election.lab.ufl.edu/early-vote/2026-early-voting/'
UA = {'User-Agent': 'ElectionDesk2026/1.0 (+https://bboldt86.github.io/lanscape-navigator/election2026/)'}
def now(): return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def load(p, d):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return d
def num(v):
    try: return int(float(str(v).replace(',', '').strip()))
    except Exception: return None
def iso(mdy):
    for f in ('%m/%d/%Y', '%Y-%m-%d', '%m/%d/%y'):
        try: return dt.datetime.strptime(str(mdy).strip(), f).strftime('%Y-%m-%d')
        except Exception: pass
    return ''

FIXTURE = sys.argv[sys.argv.index('--fixture') + 1] if '--fixture' in sys.argv else None
try:
    if FIXTURE: raw = open(FIXTURE, encoding='utf-8').read()
    else:
        req = urllib.request.Request(URL + f'?cb={int(time.time())}', headers=UA)
        with urllib.request.urlopen(req, timeout=30) as r: raw = r.read().decode('utf-8-sig')
except Exception as ex:
    print(f'early vote: could not read {FIXTURE or URL}: {type(ex).__name__}: {str(ex)[:120]} (kept last file)'); sys.exit(2)

delim = '|' if raw.count('|') > raw.count(',') else ','
rows = list(csv.DictReader(io.StringIO(raw), delimiter=delim))
if not rows or 'state_abbv' not in rows[0]:
    print('early vote: unexpected CSV layout (no state_abbv column); kept last file'); sys.exit(2)

final24 = load(os.path.join(D, 'earlyvote_final2024.json'), {})  # {abbr: {voted, inperson, mail, requested}} from UF's archived 2024 file
states, nat = {}, {'req': 0, 'acc': 0, 'inp': 0, 'vot': 0, 'd': 0, 'r': 0, 'n': 0, 'reporting': 0, 'party': 0}
for r in rows:
    ab = (r.get('state_abbv') or '').strip().upper()
    if len(ab) != 2: continue
    vot, acc, inp, req = num(r.get('voted_all')), num(r.get('accept_all')), num(r.get('inperson_all')), num(r.get('request_all'))
    if not ((vot or 0) > 0 or (req or 0) > 0): continue  # no 2026 data for this state yet
    dem, rep, non = num(r.get('voted_dem')), num(r.get('voted_rep')), num(r.get('voted_none'))
    t22 = num(r.get('turn_2022')); f24 = (final24.get(ab) or {}).get('voted')
    e = {'totalBallots': vot, 'mailReturned': acc, 'inPerson': inp, 'mailRequested': req, 'asOf': iso(r.get('last_update')), 'source': URL,
         'officialSource': (r.get('data_source') or '').strip() or None, 'updatesToday': num(r.get('updates_today')),
         'turnout2022Total': t22, 'pctOf2022Turnout': round(100.0 * vot / t22, 1) if t22 and vot else None,
         'final2024': f24, 'pctOf2024Final': round(100.0 * vot / f24, 1) if f24 and vot else None}
    if (dem or 0) + (rep or 0) > 0:
        e['byParty'] = {'D': dem, 'R': rep, 'other': non}; e['byPartyBasis'] = 'registration'
        nat['party'] += 1; nat['d'] += dem or 0; nat['r'] += rep or 0; nat['n'] += non or 0
    nat['req'] += req or 0; nat['acc'] += acc or 0; nat['inp'] += inp or 0; nat['vot'] += vot or 0
    if (vot or 0) > 0: nat['reporting'] += 1
    states[ab] = e

out = {'asOf': now(), 'source': PAGE, 'dataUrl': URL,
       'national': {'totalBallots': nat['vot'], 'mailReturned': nat['acc'], 'inPerson': nat['inp'], 'mailRequested': nat['req'], 'statesReporting': nat['reporting'],
                    'byParty': {'D': nat['d'], 'R': nat['r'], 'other': nat['n'], 'statesWithPartyData': nat['party']}, 'asOf': now(), 'source': PAGE},
       'states': states, 'rows': len(rows)}
json.dump(out, open(os.path.join(D, 'earlyvote_auto.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'early vote: {nat["reporting"]} states reporting, {nat["vot"]:,} ballots cast ({len(rows)} rows)')
