#!/usr/bin/env python3
"""Stamp data/status.json after an automated feed pull (keeps the editorial fields: mode, declared). On election
night the mode flips to 'night' on its own once the TSE file carries a count; 'post' is set by the editorial pass."""
import json, os, datetime as dt
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
p = os.path.join(D, 'status.json')
try: s = json.load(open(p, encoding='utf-8'))
except Exception: s = {}
t = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'); recent = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=5)).strftime('%Y-%m-%dT%H:%M:%SZ')
parts = []
for name, key in (('results.json', 'TSE'), ('markets.json', 'markets'), ('news.json', 'news')):
    try:
        d = json.load(open(os.path.join(D, name), encoding='utf-8'))
        if (d.get('asOf') or '') >= recent:
            extra = ''
            if key == 'TSE' and d.get('national'): extra = f" pst={d['national'].get('pctCounted')} at {d['national'].get('tseTime')}"
            parts.append(key + extra + (' (' + str(len(d.get('errors') or [])) + ' errors)' if d.get('errors') else ''))
            if key == 'TSE' and d.get('national') and (d['national'].get('pctCounted') or 0) > 0 and s.get('mode') == 'pre': s['mode'] = 'night'; parts.append('mode -> night')
    except Exception: pass
s['updated'] = t
s.setdefault('runlog', []).append(f'{t} automated feed pull: ' + (', '.join(parts) if parts else 'nothing new'))
s['runlog'] = s['runlog'][-300:]
json.dump(s, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('status:', s['runlog'][-1])
