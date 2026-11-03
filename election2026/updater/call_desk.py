#!/usr/bin/env python3
"""The Call Desk: record Claude's own election-night projections, separately from the AP calls in results.json.

  call    GA-S --winner "Jon Ossoff" --at 2026-11-03T20:12-05:00 --conf 0.997 --basis "..." [--src URL]...
  uncall  GA-S --at ... --why "..."                  (withdraw a call; the log keeps the record)
  note    GA-S "what the desk is watching"           (one-line status shown on the race card)
  status  GA-S open|watching|called                  (set explicitly; call/uncall set it for you)
  log     "7:40 PM: ..." [--at ...]                  (appends to the desk log and stamps asOf)
  apcall  OH-02 --party R --at ... [--by AP]          (record AP's call for a race the Election Desk's results.json
                                                      does not track, e.g. House and down-ballot; used for the scorecard)
  check                                              (validate the file; exit 1 if broken)

Rules the desk follows (also shown on the page): a call needs 99.5% confidence or more; nothing is called before
the state's polls close; winner names must match data/races.json exactly; every call carries its timestamp.
"""
import json, os, sys, argparse, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..', 'data'); P = os.path.join(D, 'calls.json')
ET = dt.timezone(dt.timedelta(hours=-5))

def load(p, d):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return d
def save(obj): json.dump(obj, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
def now(): return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def iso(s):
    if not s: return now()
    try: d = dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
    except ValueError: sys.exit(f'bad time {s!r}: use ISO 8601 like 2026-11-03T21:15-05:00')
    if d.tzinfo is None: sys.exit(f'time {s!r} needs a zone, e.g. -05:00 for Eastern on Nov. 3')
    return d.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def et(s):
    d = dt.datetime.fromisoformat(s.replace('Z', '+00:00')).astimezone(ET)
    return d.strftime('%-I:%M %p ET').replace('AM', 'a.m.').replace('PM', 'p.m.')

board = load(P, None) or sys.exit(f'{P} missing')
races = load(os.path.join(D, 'races.json'), {}); RACE = {}
for key in ('senate', 'governor'):
    for r in races.get(key) or []: RACE[r['id']] = r
BY_ID = {r['id']: r for r in board['races']}

def stamp(line, at=None):
    board['asOf'] = iso(at) if at else now()
    board.setdefault('log', []).append({'at': board['asOf'], 'text': line})

ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
p = sub.add_parser('call'); p.add_argument('id'); p.add_argument('--winner', required=True); p.add_argument('--at'); p.add_argument('--conf', type=float, required=True); p.add_argument('--basis', required=True); p.add_argument('--src', action='append', default=[])
p = sub.add_parser('uncall'); p.add_argument('id'); p.add_argument('--at'); p.add_argument('--why', required=True)
p = sub.add_parser('note'); p.add_argument('id'); p.add_argument('text')
p = sub.add_parser('status'); p.add_argument('id'); p.add_argument('status', choices=['open', 'watching', 'called'])
p = sub.add_parser('log'); p.add_argument('text'); p.add_argument('--at')
p = sub.add_parser('apcall'); p.add_argument('id'); p.add_argument('--party', required=True, choices=['D', 'R', 'I']); p.add_argument('--at'); p.add_argument('--by', default='AP')
p = sub.add_parser('check')
a = ap.parse_args()

def race(i): return BY_ID.get(i) or sys.exit(f'{i} is not on the board; tracked: {", ".join(BY_ID)}')

if a.cmd == 'call':
    r = race(a.id); names = {c['name']: c['party'] for c in (RACE.get(a.id) or r)['candidates']}
    if a.winner not in names: sys.exit(f'{a.winner!r} is not a candidate in {a.id}; candidates: {list(names)}')
    if a.conf < 0.995: sys.exit(f'confidence {a.conf} is below the desk rule (0.995); not called')
    when = iso(a.at)
    close = dt.datetime.fromisoformat(f"2026-11-03T{r['closesET'].split('/')[-1]}:00-05:00")
    if dt.datetime.fromisoformat(when.replace('Z', '+00:00')) < close: sys.exit(f'polls in {a.id} close at {r["closesET"]} ET; nothing is called before then')
    r['call'] = {'winner': a.winner, 'party': names[a.winner], 'at': when, 'confidence': a.conf, 'basis': a.basis, 'sources': a.src}
    r['status'] = 'called'
    stamp(f'{et(when)}: CALL {r["name"]} for {a.winner} ({names[a.winner]}), {a.conf:.1%}. {a.basis}', when)
elif a.cmd == 'uncall':
    r = race(a.id); when = iso(a.at); old = r.get('call') or {}
    r['call'] = None; r['status'] = 'watching'; r.setdefault('withdrawn', []).append({**old, 'withdrawnAt': when, 'why': a.why})
    stamp(f'{et(when)}: WITHDRAWN the {r["name"]} call for {old.get("winner")}. {a.why}', when)
elif a.cmd == 'note':
    r = race(a.id); r['note'] = a.text; r['noteAt'] = now(); board['asOf'] = r['noteAt']
elif a.cmd == 'status':
    r = race(a.id); r['status'] = a.status; board['asOf'] = now()
elif a.cmd == 'log':
    stamp(a.text, a.at)
elif a.cmd == 'apcall':
    r = race(a.id); r['ap'] = {'party': a.party, 'at': iso(a.at), 'by': a.by}; board['asOf'] = now()
elif a.cmd == 'check':
    bad = [r['id'] for r in board['races'] if r.get('call') and r['call'].get('confidence', 0) < 0.995]
    if bad: sys.exit(f'calls below the rule: {bad}')
    print(f"ok: {sum(1 for r in board['races'] if r.get('call'))} of {len(board['races'])} called; asOf {board.get('asOf')}")
    sys.exit(0)
save(board); print(f"{a.cmd} {getattr(a, 'id', '')}: ok (asOf {board['asOf']})")
