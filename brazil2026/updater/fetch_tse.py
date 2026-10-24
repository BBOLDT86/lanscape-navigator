#!/usr/bin/env python3
"""Pull the TSE's official count for the presidential runoff -> data/results.json

Reads the unified result file (EA20, '-u.json') for Brazil and each of the 27 units + abroad (ZZ), as listed in
data/feeds.json -> tse. Fails soft: a unit that cannot be read keeps its last values; nothing is invented. Every
figure is stored with the TSE's own timestamp (dg + hg, Brasília time) and the URL it came from.

    python3 brazil2026/updater/fetch_tse.py                 # the runoff (code from feeds.json)
    python3 brazil2026/updater/fetch_tse.py --code 6257     # the first round (a dry run of the parser)
    python3 brazil2026/updater/fetch_tse.py --fixture DIR   # parse saved payloads DIR/<uf>.json instead of the network
"""
import json, os, sys, time, datetime as dt, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..', 'data')
UA = {'User-Agent': 'BrazilDesk2026/1.0 (+https://bboldt86.github.io/lanscape-navigator/brazil2026/)', 'Accept': 'application/json'}
def now(): return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def load(p, d):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return d
def num(s):
    if s is None or s == '': return None
    try: return float(str(s).replace('.', '').replace(',', '.')) if ',' in str(s) else float(s)
    except Exception: return None
def integer(s):
    try: return int(str(s).replace('.', ''))
    except Exception: return None

feeds = load(os.path.join(D, 'feeds.json'), {}); T = feeds.get('tse') or {}
election = load(os.path.join(D, 'election.json'), {})
CODE = sys.argv[sys.argv.index('--code') + 1] if '--code' in sys.argv else T.get('runoffCode', '6258')
FIXTURE = sys.argv[sys.argv.index('--fixture') + 1] if '--fixture' in sys.argv else None
KEYS = {c['n']: c['key'] for c in election.get('candidates') or []}  # ballot number -> lula / flavio

def url_for(uf):
    return T['unitUrl'].format(base=T['base'], ambiente=T['ambiente'], cycle=T['cycle'], code=CODE, uf=uf)

def get(uf):
    if FIXTURE: return json.load(open(os.path.join(FIXTURE, uf + '.json'), encoding='utf-8'))
    req = urllib.request.Request(url_for(uf) + f'?cb={int(time.time())}', headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r: return json.loads(r.read().decode('utf-8'))

def parse(j, uf):
    """The TSE unified file -> one compact record. Field names follow the TSE: see feeds.json -> tse.fields."""
    cands = []
    for cargo in j.get('carg') or []:
        for agr in cargo.get('agr') or []:
            for par in agr.get('par') or []:
                for c in par.get('cand') or []:
                    cands.append({'n': str(c.get('n') or ''), 'name': c.get('nmu') or c.get('nm') or '', 'party': par.get('sg') or '',
                                  'votes': integer(c.get('vap')), 'pctValid': num(c.get('pvap')), 'status': c.get('st') or '',
                                  'key': KEYS.get(str(c.get('n') or ''))})
    s, v, e = j.get('s') or {}, j.get('v') or {}, j.get('e') or {}
    dg, hg = j.get('dg') or '', j.get('hg') or ''
    ts = None
    if dg and hg:
        try: ts = dt.datetime.strptime(dg + ' ' + hg, '%d/%m/%Y %H:%M:%S').strftime('%Y-%m-%dT%H:%M:%S-03:00')
        except Exception: ts = f'{dg} {hg}'
    return {'uf': uf.upper(), 'tseTime': ts, 'pctCounted': num(s.get('pst')), 'sectionsCounted': integer(s.get('st')), 'sectionsTotal': integer(s.get('ts')),
            'valid': integer(v.get('vv')), 'blank': integer(v.get('vb')), 'blankPct': num(v.get('pvb')), 'null': integer(v.get('tvn')), 'nullPct': num(v.get('ptvn')),
            'abstention': integer(e.get('a')), 'abstentionPct': num(e.get('pa')), 'candidates': cands, 'status': j.get('and') or '',
            'readAt': now(), 'url': url_for(uf), 'code': str(j.get('ele') or CODE)}

old = load(os.path.join(D, 'results.json'), {})
out = {'asOf': now(), 'source': 'TSE (resultados.tse.jus.br, unified result files)', 'code': CODE, 'national': old.get('national'), 'units': dict(old.get('units') or {}),
       'alerts': old.get('alerts') or [], 'history': old.get('history') or [], 'errors': []}
units = T.get('units') or ['br']
fresh = 0
for uf in units:
    try:
        rec = parse(get(uf), uf)
        if rec['candidates'] or rec['pctCounted'] is not None:
            if uf == 'br': out['national'] = rec
            else: out['units'][uf.upper()] = rec
            fresh += 1
        else: out['errors'].append(f'{uf}: empty file (no candidates, no pst)')
    except Exception as ex:
        out['errors'].append(f'{uf}: {type(ex).__name__}: {str(ex)[:100]}')

# national history: one point per TSE timestamp (for the count chart); declared status from the TSE's own 'st' field
nat = out['national']
if nat and nat.get('tseTime') and (not out['history'] or out['history'][-1].get('t') != nat['tseTime']):
    out['history'].append({'t': nat['tseTime'], 'pst': nat.get('pctCounted'), **{c['key']: c.get('pctValid') for c in nat['candidates'] if c.get('key')}})
    out['history'] = out['history'][-600:]
json.dump(out, open(os.path.join(D, 'results.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'tse: {fresh}/{len(units)} units read, code {CODE}, national pst={nat and nat.get("pctCounted")} at {nat and nat.get("tseTime")}, {len(out["errors"])} errors')
for e in out['errors'][:10]: print('  ', e)
sys.exit(0 if fresh else 2)
