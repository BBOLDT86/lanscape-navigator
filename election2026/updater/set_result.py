#!/usr/bin/env python3
"""Record election-night results, calls, alerts and the desk's status, with validation.

  race    OH-S --cand "Sherrod Brown=1234567" --cand "Jon Husted=1200000" --as-of 2026-11-03T21:15-05:00 --src "AP"
          [--pct-in 62] [--exp 4100000] [--call D --call-by AP --call-at 2026-11-04T01:10-05:00] [--note "..."]
  county  39049 --d 300000 --r 200000 [--o 5000] [--pct-in 70] --as-of ... --src ...
  house   --called-d 180 --called-r 190 [--lead-d 20 --lead-r 25] --as-of ... --src AP
  alert   "AP calls the Ohio Senate race for Sherrod Brown" [--id OH-S] [--at ...]
  import  file.json          merge {"races": {...}, "counties": {...}, "house": {...}, "alerts": [...]} in the model's shape
  mode    pre|night|post
  log     "what this run did"  (appends to the run log and stamps the update time)

Candidate names must match data/races.json exactly. Percent-in is computed from --exp or, failing that, from the
2024 vote times the turnout factor in status.json (default 0.75) when --pct-in is not given. Every write stamps
status.updated, which the page shows as "Updated".
"""
import json, os, sys, argparse, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..', 'data')
def load(p, d):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return d
def save(name, obj): json.dump(obj, open(os.path.join(D, name), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
def now(): return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def iso(s):
    if not s: return now()
    try: d = dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
    except ValueError: sys.exit(f'bad time {s!r}: use ISO 8601 like 2026-11-03T21:15-05:00')
    if d.tzinfo is None: sys.exit(f'time {s!r} needs a zone, e.g. -05:00 for Eastern on Nov. 3')
    return d.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

races = load(os.path.join(D, 'races.json'), {}); base = load(os.path.join(D, 'baseline.json'), {}); status = load(os.path.join(D, 'status.json'), {})
res = load(os.path.join(D, 'results.json'), {'asOf': '', 'races': {}, 'counties': {}, 'house': {}, 'alerts': []})
for k, v in (('races', {}), ('counties', {}), ('house', {}), ('alerts', [])): res.setdefault(k, v)
RACE = {}
for key in ('senate', 'governor'):
    for r in races.get(key) or []:
        rid = r.get('id') or f"{r.get('state')}-{'S' if key == 'senate' else 'G'}"; RACE[rid] = r
FIPS_BY_ABBR = {v: k for k, v in base.get('fips', {}).items()}
factor = float(status.get('turnoutFactor') or 0.75)

def stamp(msg):
    status['updated'] = now(); log = status.setdefault('runlog', []); log.append(f'{status["updated"]} {msg}'); status['runlog'] = log[-200:]
    save('status.json', status)

ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
p = sub.add_parser('race'); p.add_argument('id'); p.add_argument('--cand', action='append', default=[]); p.add_argument('--as-of'); p.add_argument('--src', default=''); p.add_argument('--pct-in', type=float); p.add_argument('--exp', type=int); p.add_argument('--call', choices=['D', 'R', 'I', 'none']); p.add_argument('--call-by'); p.add_argument('--call-at'); p.add_argument('--note')
p = sub.add_parser('county'); p.add_argument('fips'); p.add_argument('--d', type=int, required=True); p.add_argument('--r', type=int, required=True); p.add_argument('--o', type=int, default=0); p.add_argument('--pct-in', type=float); p.add_argument('--exp', type=int); p.add_argument('--as-of'); p.add_argument('--src', default='')
p = sub.add_parser('house'); p.add_argument('--called-d', type=int, required=True); p.add_argument('--called-r', type=int, required=True); p.add_argument('--lead-d', type=int, default=0); p.add_argument('--lead-r', type=int, default=0); p.add_argument('--as-of'); p.add_argument('--src', default='')
p = sub.add_parser('alert'); p.add_argument('text'); p.add_argument('--id'); p.add_argument('--at')
p = sub.add_parser('import'); p.add_argument('file')
p = sub.add_parser('mode'); p.add_argument('mode', choices=['pre', 'night', 'post'])
p = sub.add_parser('log'); p.add_argument('text')
a = ap.parse_args()

if a.cmd == 'race':
    r = RACE.get(a.id) or sys.exit(f'unknown race {a.id}; known: {", ".join(sorted(RACE))}')
    names = [c.get('name') for c in r.get('candidates') or []]
    row = res['races'].get(a.id, {}); c = dict(row.get('c') or {})
    for spec in a.cand:
        if '=' not in spec: sys.exit(f'--cand needs Name=votes, got {spec!r}')
        n, v = spec.rsplit('=', 1); n = n.strip()
        if n not in names: sys.exit(f'candidate {n!r} is not in races.json for {a.id}; candidates: {names}')
        c[n] = int(v.replace(',', ''))
    tot = sum(c.values())
    exp = a.exp or row.get('exp') or (int(base['s'][FIPS_BY_ABBR[r['state']]][2] * factor) if base.get('s', {}).get(FIPS_BY_ABBR.get(r['state'])) else None)
    pct = a.pct_in if a.pct_in is not None else (min(100.0, round(100 * tot / exp, 1)) if exp and tot else row.get('pctIn'))
    row.update({'c': c, 'tot': tot, 'exp': exp, 'pctIn': pct, 'asOf': iso(a.as_of), 'src': a.src or row.get('src', '')})
    if a.note is not None: row['note'] = a.note
    if a.call:
        if a.call == 'none': row.update({'call': None, 'callBy': None, 'callAt': None})
        else: row.update({'call': a.call, 'callBy': a.call_by or a.src or 'call', 'callAt': iso(a.call_at or a.as_of)})
    res['races'][a.id] = row; res['asOf'] = now(); save('results.json', res)
    lead = sorted(c.items(), key=lambda kv: -kv[1])[:2]
    stamp(f'result {a.id}: ' + ', '.join(f'{n} {v:,}' for n, v in lead) + f' ({pct}% in){" CALL " + a.call if a.call and a.call != "none" else ""} [{a.src}]')
elif a.cmd == 'county':
    f = a.fips if a.fips.isdigit() and len(a.fips) == 5 else sys.exit('county needs a 5-digit FIPS code')
    b = base.get('c', {}).get(f); tot = a.d + a.r + a.o
    exp = a.exp or (int((b[2] or b[5]) * factor) if b and (b[2] or b[5]) else None)
    pct = a.pct_in if a.pct_in is not None else (min(100.0, round(100 * tot / exp, 1)) if exp and tot else None)
    res['counties'][f] = {'d': a.d, 'r': a.r, 'o': a.o, 'tot': tot, 'pctIn': pct, 'asOf': iso(a.as_of), 'src': a.src}; res['asOf'] = now(); save('results.json', res)
    stamp(f'county {f}: D {a.d:,} R {a.r:,} ({pct}% in) [{a.src}]')
elif a.cmd == 'house':
    res['house'] = {'calledD': a.called_d, 'calledR': a.called_r, 'leadD': a.lead_d, 'leadR': a.lead_r, 'asOf': iso(a.as_of), 'src': a.src}; res['asOf'] = now(); save('results.json', res)
    stamp(f'house: called D {a.called_d} R {a.called_r}, leading D {a.lead_d} R {a.lead_r} [{a.src}]')
elif a.cmd == 'alert':
    res['alerts'].append({'t': iso(a.at), 'text': a.text, 'id': a.id}); res['alerts'] = res['alerts'][-50:]; res['asOf'] = now(); save('results.json', res); stamp('alert: ' + a.text)
elif a.cmd == 'import':
    inc = json.load(open(a.file, encoding='utf-8'))
    for rid, row in (inc.get('races') or {}).items():
        if rid not in RACE: sys.exit(f'unknown race {rid}')
        names = [c.get('name') for c in RACE[rid].get('candidates') or []]
        for n in (row.get('c') or {}):
            if n not in names: sys.exit(f'{rid}: candidate {n!r} not in races.json ({names})')
        res['races'][rid] = {**res['races'].get(rid, {}), **row}
    for f, row in (inc.get('counties') or {}).items(): res['counties'][f] = {**res['counties'].get(f, {}), **row}
    if inc.get('house'): res['house'] = inc['house']
    for al in inc.get('alerts') or []: res['alerts'].append(al)
    res['asOf'] = now(); save('results.json', res); stamp(f'import {os.path.basename(a.file)}: {len(inc.get("races") or {})} races, {len(inc.get("counties") or {})} counties')
elif a.cmd == 'mode':
    status['mode'] = a.mode; stamp('mode -> ' + a.mode)
elif a.cmd == 'log':
    stamp(a.text)
print('ok', status.get('updated'))
