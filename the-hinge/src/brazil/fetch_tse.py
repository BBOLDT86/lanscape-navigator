#!/usr/bin/env python3
"""The TSE's official result files for both rounds of Brazil's 2026 presidential election, per unit -> tse_rounds.json

  python3 the-hinge/src/brazil/fetch_tse.py      (run by .github/workflows/hinge-brazil.yml; the TSE answers GitHub's runners)

For Brazil, the 27 units and abroad (ZZ), round 1 (election 6257) and the runoff (6258): every candidate's votes, valid,
blank and null votes, abstention and the electorate, with the TSE's own file time. Standard library only.
"""
import datetime as dt, json, os, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'tse_rounds.json')
UNITS = ['br', 'ac', 'al', 'am', 'ap', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mg', 'ms', 'mt', 'pa', 'pb', 'pe', 'pi', 'pr', 'rj', 'rn', 'ro', 'rr', 'rs', 'sc', 'se', 'sp', 'to', 'zz']
URL = 'https://resultados.tse.jus.br/oficial/ele2026/{code}/dados/{uf}/{uf}-c0001-e00{code}-u.json'
UA = {'User-Agent': 'TheHinge/1.0 (+https://bboldt86.github.io/lanscape-navigator/the-hinge/)', 'Accept': 'application/json'}


def integer(s):
    try:
        return int(str(s).replace('.', ''))
    except (TypeError, ValueError):
        return None


def get(code, uf):
    for i in range(3):
        try:
            req = urllib.request.Request(URL.format(code=code, uf=uf) + f'?cb={int(time.time())}', headers=UA)
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read().decode('utf-8'))
        except Exception:  # noqa: BLE001
            if i == 2:
                raise
            time.sleep(3)


def parse(j, code, uf):
    cands = []
    for cargo in j.get('carg') or []:
        for agr in cargo.get('agr') or []:
            for par in agr.get('par') or []:
                for c in par.get('cand') or []:
                    cands.append({'n': str(c.get('n') or ''), 'name': c.get('nmu') or c.get('nm') or '', 'party': par.get('sg') or '', 'votes': integer(c.get('vap')), 'status': c.get('st') or ''})
    s, v, e = j.get('s') or {}, j.get('v') or {}, j.get('e') or {}
    return {'uf': uf.upper(), 'file': f"{j.get('dg', '')} {j.get('hg', '')}".strip(), 'pst': s.get('pst'), 'sections': [integer(s.get('st')), integer(s.get('ts'))],
            'valid': integer(v.get('vv')), 'blank': integer(v.get('vb')), 'null': integer(v.get('tvn')), 'abstention': integer(e.get('a')),
            'electorate': integer(e.get('te')), 'turnout': integer(e.get('c')), 'eRaw': e, 'vRaw': v, 'candidates': cands, 'url': URL.format(code=code, uf=uf)}


out = {'at': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'source': 'TSE, resultados.tse.jus.br (unified result files)', 'round1': {}, 'runoff': {}, 'errors': []}
for key, code in (('round1', '6257'), ('runoff', '6258')):
    for uf in UNITS:
        try:
            out[key][uf.upper()] = parse(get(code, uf), code, uf)
        except Exception as ex:  # noqa: BLE001
            out['errors'].append(f'{key} {uf}: {type(ex).__name__}: {str(ex)[:100]}')
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"round1 {len(out['round1'])}, runoff {len(out['runoff'])}, errors {len(out['errors'])}")
