#!/usr/bin/env python3
"""Stamp data/status.json after an automated feed pull (keeps the editorial fields the daily run sets)."""
import json, os, datetime as dt
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
p = os.path.join(D, 'status.json')
try: s = json.load(open(p, encoding='utf-8'))
except Exception: s = {}
t = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
parts = []
for name, key in (('markets.json', 'markets'), ('news.json', 'news'), ('earlyvote_auto.json', 'early vote')):
    try:
        d = json.load(open(os.path.join(D, name), encoding='utf-8'))
        if d.get('asOf', '')[:16] == t[:16] or d.get('asOf', '') >= (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=5)).strftime('%Y-%m-%dT%H:%M:%SZ'): parts.append(key + (' (' + str(len(d.get('errors') or [])) + ' errors)' if d.get('errors') else ''))
    except Exception: pass
s['updated'] = t
s.setdefault('runlog', []).append(f'{t} automated feed pull: ' + (', '.join(parts) if parts else 'nothing new'))
s['runlog'] = s['runlog'][-200:]
json.dump(s, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('status:', s['runlog'][-1])
