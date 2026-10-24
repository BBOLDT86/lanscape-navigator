#!/usr/bin/env python3
"""Record what the editorial pass finds, with validation, for the Brazil runoff desk.

  poll     --pollster Datafolha --start 2026-10-23 --end 2026-10-24 --lula 46 --flavio 47 [--basis total|valid]
           [--lula-valid 49 --flavio-valid 51] [--blank-null 5 --undecided 2] [--n 2520] [--method in-person]
           [--sponsor "Folha/Globo"] [--tse BR-09158/2026] [--released 2026-10-24] --url ... [--note ...]
  market   --flavio 0.83 --lula 0.17 --venue Polymarket --as-of 2026-10-24T17:00Z --url ... [--source ...]
  result   br|SP|... --lula 1234567 --flavio 1300000 --pct-counted 62.35 --as-of 2026-10-25T19:02-03:00 --src "TSE"
           (manual fallback when fetch_tse.py cannot run; the Action's pull overwrites it)
  declare  lula|flavio --by TSE --at 2026-10-25T20:10-03:00 [--note "TSE proclaimed the result at 100% of sections"]
  alert    "TSE: 50% of sections counted; Flávio 51.2, Lula 48.8" [--at ...]
  mode     pre|night|post
  log      "what this run did"

Only the TSE (or a court certification) decides the race: `declare` records the TSE's proclamation; the desk never
calls the race itself. Candidate keys are 'lula' and 'flavio'. Every write stamps status.updated.
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
    except ValueError: sys.exit(f'bad time {s!r}: use ISO 8601 like 2026-10-25T19:02-03:00')
    if d.tzinfo is None: sys.exit(f'time {s!r} needs a zone, e.g. -03:00 for Brasília')
    return d.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

status = load(os.path.join(D, 'status.json'), {})
election = load(os.path.join(D, 'election.json'), {})
UNITS = set((election.get('units') or {}).keys()) | {'BR'}
def stamp(msg):
    status['updated'] = now(); log = status.setdefault('runlog', []); log.append(f'{status["updated"]} {msg}'); status['runlog'] = log[-200:]
    save('status.json', status)

ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
p = sub.add_parser('poll')
for a in ('--pollster', '--sponsor', '--start', '--end', '--released', '--method', '--tse', '--url', '--note'): p.add_argument(a)
for a in ('--lula', '--flavio', '--lula-valid', '--flavio-valid', '--blank-null', '--undecided'): p.add_argument(a, type=float)
p.add_argument('--n', type=int); p.add_argument('--basis', choices=['total', 'valid'], default='total')
p = sub.add_parser('market'); p.add_argument('--flavio', type=float, required=True); p.add_argument('--lula', type=float, required=True); p.add_argument('--venue', required=True); p.add_argument('--as-of'); p.add_argument('--url', required=True); p.add_argument('--source')
p = sub.add_parser('result'); p.add_argument('unit'); p.add_argument('--lula', type=int, required=True); p.add_argument('--flavio', type=int, required=True); p.add_argument('--pct-counted', type=float); p.add_argument('--as-of'); p.add_argument('--src', default='TSE'); p.add_argument('--blank', type=int); p.add_argument('--null', type=int)
p = sub.add_parser('declare'); p.add_argument('winner', choices=['lula', 'flavio']); p.add_argument('--by', default='TSE'); p.add_argument('--at'); p.add_argument('--note', default='')
p = sub.add_parser('alert'); p.add_argument('text'); p.add_argument('--at')
p = sub.add_parser('mode'); p.add_argument('mode', choices=['pre', 'night', 'post'])
p = sub.add_parser('log'); p.add_argument('text')
a = ap.parse_args()

if a.cmd == 'poll':
    if not (a.pollster and a.end and a.lula is not None and a.flavio is not None and a.url): sys.exit('poll needs --pollster --end --lula --flavio --url')
    P = load(os.path.join(D, 'polls.json'), {'polls': []})
    for q in P['polls']:
        if q.get('pollster') == a.pollster and q.get('end') == a.end and q.get('start') == a.start: sys.exit(f'already recorded: {a.pollster} {a.start}-{a.end}')
    row = {'pollster': a.pollster, 'sponsor': a.sponsor, 'start': a.start, 'end': a.end, 'released': a.released, 'n': a.n, 'method': a.method,
           'lula': a.lula, 'bolsonaro': a.flavio, 'blankNull': a.blank_null, 'undecided': a.undecided, 'basis': a.basis,
           'lulaValid': a.lula_valid if a.lula_valid is not None else (a.lula if a.basis == 'valid' else None),
           'bolsonaroValid': a.flavio_valid if a.flavio_valid is not None else (a.flavio if a.basis == 'valid' else None),
           'tseRegistration': a.tse, 'url': a.url, 'note': a.note}
    P['polls'].insert(0, row); P['asOf'] = now()
    P['pending'] = [x for x in P.get('pending') or [] if x.get('pollster') != a.pollster]
    save('polls.json', P); stamp(f'poll: {a.pollster} {a.start}-{a.end} Lula {a.lula} / Flávio {a.flavio} ({a.basis})'); print('ok')
elif a.cmd == 'market':
    M = load(os.path.join(D, 'markets.json'), {'history': []})
    M['pres'] = {'flavio': a.flavio, 'lula': a.lula, 'venue': a.venue, 'url': a.url, 'asOf': iso(a.as_of), 'source': a.source or 'editorial pass (manual read)'}
    M.setdefault('history', []).append({'t': M['pres']['asOf'], 'flavio': a.flavio, 'lula': a.lula, 'venue': a.venue}); M['asOf'] = now()
    save('markets.json', M); stamp(f'market: {a.venue} Flávio {a.flavio} / Lula {a.lula}'); print('ok')
elif a.cmd == 'result':
    u = a.unit.upper()
    if u not in UNITS: sys.exit(f'unknown unit {u}; use BR or one of {sorted(UNITS)}')
    R = load(os.path.join(D, 'results.json'), {'units': {}, 'alerts': [], 'history': []})
    tot = a.lula + a.flavio
    rec = {'uf': u, 'tseTime': a.as_of, 'pctCounted': a.pct_counted, 'valid': tot, 'blank': a.blank, 'null': a.null,
           'candidates': [{'n': '13', 'name': 'LULA', 'party': 'PT', 'votes': a.lula, 'pctValid': round(100 * a.lula / tot, 2) if tot else None, 'key': 'lula', 'status': ''},
                          {'n': '22', 'name': 'FLAVIO BOLSONARO', 'party': 'PL', 'votes': a.flavio, 'pctValid': round(100 * a.flavio / tot, 2) if tot else None, 'key': 'flavio', 'status': ''}],
           'readAt': now(), 'url': a.src, 'manual': True}
    if u == 'BR': R['national'] = rec
    else: R.setdefault('units', {})[u] = rec
    R['asOf'] = now(); save('results.json', R); stamp(f'result {u}: Lula {a.lula:,} / Flávio {a.flavio:,} at {a.pct_counted}% ({a.src})'); print('ok')
elif a.cmd == 'declare':
    status['declared'] = {'winner': a.winner, 'by': a.by, 'at': iso(a.at), 'note': a.note}
    R = load(os.path.join(D, 'results.json'), {'alerts': []}); name = 'Lula' if a.winner == 'lula' else 'Flávio Bolsonaro'
    R.setdefault('alerts', []).append({'t': iso(a.at), 'en': f'{a.by} declares {name} elected president', 'pt': f'{a.by} proclama {name} eleito presidente'})
    save('results.json', R); stamp(f'declared: {name} by {a.by} at {a.at}'); print('ok')
elif a.cmd == 'alert':
    R = load(os.path.join(D, 'results.json'), {'alerts': []}); R.setdefault('alerts', []).append({'t': iso(a.at), 'en': a.text, 'pt': a.text}); save('results.json', R); stamp('alert: ' + a.text); print('ok')
elif a.cmd == 'mode':
    status['mode'] = a.mode; stamp(f'mode -> {a.mode}'); print('ok')
elif a.cmd == 'log':
    stamp(a.text); print('ok', status['updated'])
