#!/usr/bin/env python3
"""The Power desk's data center tracker: the biggest U.S. data center projects and how they get their power.

  python3 news/updater/dctrack.py check     exit 1 with the problems in news/data/datacenters.json
  python3 news/updater/dctrack.py           print the format

news/data/datacenters.json is kept by a weekly scheduled task:
  {"v": 1, "updated": "2026-10-26T07:20:00-04:00", "model": "Claude Opus 5.5",
   "summary": "Markdown, 120 to 300 words: what changed this week in the buildout and what it means for the grid and for bills",
   "projects": [{"id": "stargate-abilene", "name": "...", "company": "...", "place": "Abilene", "state": "TX", "lat": 32.45, "lon": -99.73,
                 "mw": 1200, "status": "under construction", "power": "how it is powered: the utility, on-site gas, a nuclear deal...",
                 "grid": "ERCOT", "cost": "$40 billion (as reported)", "note": "one or two sentences: what is new and why it matters",
                 "updated": "2026-10-26", "sources": [{"title", "outlet", "url", "date"}]}],
   "changes": ["short lines: what was added or changed this week"]}
status is one of announced, planned, permitted, under construction, operating, paused, canceled. mw is the power the
project is reported to need at full build, in megawatts (not IT load unless that's all that's reported; say so in
note). Every project carries at least one source. Standard library only.
"""
import datetime as dt
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.normpath(os.path.join(HERE, '..', 'data', 'datacenters.json'))
STATUS = {'announced', 'planned', 'permitted', 'under construction', 'operating', 'paused', 'canceled'}
STATES = set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split())


def check():
    P = []
    try:
        d = json.load(open(PATH, encoding='utf-8'))
    except (OSError, ValueError) as ex:
        return [f'not readable JSON: {ex}'], None
    for k in ('updated', 'model', 'summary', 'projects'):
        if not d.get(k):
            P.append(f'missing {k}')
    if P:
        return P, d
    if not re.fullmatch(r'Claude [A-Za-z]+ \d+(\.\d+)?', d['model']):
        P.append('model must be the exact model name')
    try:
        t = dt.datetime.fromisoformat(d['updated'])
        if t.tzinfo is None:
            P.append('updated needs a UTC offset')
    except ValueError:
        P.append('updated must be an ISO date and time')
    n = len(re.findall(r"[^\W_][\w’'.,%$-]*", d['summary']))
    if not 80 <= n <= 350:
        P.append(f'summary is {n} words; 80 to 350')
    ids = set()
    if len(d['projects']) < 12:
        P.append('track at least 12 projects')
    for p in d['projects']:
        tag = p.get('id') or p.get('name') or '?'
        for k in ('id', 'name', 'company', 'place', 'state', 'lat', 'lon', 'mw', 'status', 'power', 'note', 'updated', 'sources'):
            if p.get(k) in (None, '', []):
                P.append(f'{tag}: missing {k}')
        if p.get('id') in ids:
            P.append(f'{tag}: duplicate id')
        ids.add(p.get('id'))
        if p.get('id') and not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', p['id']):
            P.append(f'{tag}: id is lowercase words joined by hyphens')
        if p.get('state') and p['state'] not in STATES:
            P.append(f'{tag}: state is a two-letter U.S. postal code')
        if p.get('status') and p['status'] not in STATUS:
            P.append(f'{tag}: status must be one of {sorted(STATUS)}')
        try:
            if not (18 < float(p['lat']) < 72 and -170 < float(p['lon']) < -60):
                P.append(f'{tag}: lat and lon must be in the U.S.')
        except (TypeError, ValueError, KeyError):
            P.append(f'{tag}: lat and lon must be numbers')
        if not isinstance(p.get('mw'), (int, float)) or not 1 <= p['mw'] <= 20000:
            P.append(f'{tag}: mw must be a number of megawatts')
        for s in p.get('sources') or []:
            if not re.match(r'^https?://', (s or {}).get('url', '')) or not s.get('title') or not s.get('outlet'):
                P.append(f'{tag}: each source needs a title, an outlet and an http(s) url')
    return P, d


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == 'check':
        problems, d = check()
        if problems:
            print('NOT READY:'); [print('  -', p) for p in problems[:60]]
            return 1
        gw = sum(p['mw'] for p in d['projects']) / 1000
        print(f"ok: {len(d['projects'])} projects, {gw:.1f} GW in all, updated {d['updated']} by {d['model']}")
        return 0
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main())
