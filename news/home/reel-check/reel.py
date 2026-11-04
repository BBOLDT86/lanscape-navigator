#!/usr/bin/env python3
"""Reel Check: viral DIY build videos, tested against the physics.

Each build is one JSON file. Published builds live in builds/, scheduled ones in queue/ until their publish date.

  python3 news/home/reel-check/reel.py check <file> [...]   check a build's format
  python3 news/home/reel-check/reel.py index                rebuild builds/index.json from builds/
  python3 news/home/reel-check/reel.py release              move queued builds whose publish date has come (Eastern
                                                            time) into builds/ and rebuild the index
  python3 news/home/reel-check/reel.py format               print the format

The release runs once a day from .github/workflows/reel-check.yml, so one queued build goes live each morning.
"""
import datetime as dt
import itertools
import json
import os
import re
import sys
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
LIVE = os.path.join(HERE, 'builds')
QUEUE = os.path.join(HERE, 'queue')
ET = ZoneInfo('America/New_York')

FORMAT = """{
  "id": "YYYY-MM-DD-slug",              publish date + slug; the file is named <id>.json
  "publish": "YYYY-MM-DD",              the day it goes live (Eastern)
  "written": "2026-11-02T21:30:00-05:00", when it was actually written, with its UTC offset
  "byline": "Claude", "model": "<exact model name>",
  "category": "Water" | "Garden" | "Shelter" | "Outdoor living" | "Indoor",
  "title": "...", "dek": "one sentence",
  "reel": "what the viral clip shows, in two or three sentences (the type of video, not a named account)",
  "verdict": {"shown": 0-10, "fixed": 0-10, "line": "the verdict in one sentence"},
  "scores": [{"test": "...", "shown": 0-10, "fixed": 0-10, "why": "..."}],      4 to 8 rows
  "body": "Markdown, 900-2,600 words, at least 3 '## ' sections, citations as [n]",
  "sources": [{"n": 1, "title": "...", "outlet": "...", "url": "https://..."}], 5+ sources, 4+ outlets, each cited
  "kit": {
    "summary": "one sentence: the version the kit builds",
    "options": [{"key": "diameter_ft", "label": "Diameter", "unit": "ft", "values": [8, 10, 12], "default": 12}],  1 or 2
    "metrics": [{"key": "gallons", "label": "Water", "unit": "gallons", "note": "short line under the number"}],  3 to 6
    "configs": [{"diameter_ft": 12, "gallons": 2115}],   one row per combination of option values, every metric in it
    "materials": [{"diameter_ft": 12, "item": "...", "qty": 12, "unit": "bags", "low": 78, "high": 96}],
                 rows for every combination; low/high are total USD for that row (0 for free)
    "phases": [{"phase": "...", "start": 0, "days": 14, "gate": "what must be true before the next phase"}],  4 to 10
    "assumptions": "one or two sentences: what the numbers assume and that prices are rough US ranges"
  }
}"""

QUOTE = re.compile(r'"([^"\n]{2,})"|“([^”\n]{2,})”')


def words(s):
    return len(re.findall(r"[A-Za-z0-9’'\-]+", s))


def check(path):
    errs = []
    try:
        b = json.load(open(path, encoding='utf-8'))
    except Exception as e:  # noqa: BLE001
        return [f'not JSON: {e}']
    need = ['id', 'publish', 'written', 'byline', 'model', 'category', 'title', 'dek', 'reel', 'verdict', 'scores',
            'body', 'sources', 'kit']
    for k in need:
        if k not in b:
            errs.append(f'missing {k}')
    if errs:
        return errs
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', b['publish']):
        errs.append('publish is not YYYY-MM-DD')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}-[a-z0-9-]+', b['id']) or not b['id'].startswith(b['publish']):
        errs.append('id must be <publish>-<slug>')
    if os.path.basename(path) != b['id'] + '.json':
        errs.append('file name must be <id>.json')
    try:
        w = dt.datetime.fromisoformat(b['written'])
        if w.tzinfo is None:
            errs.append('written needs a UTC offset')
        elif w.date().isoformat() > b['publish']:
            errs.append('written after publish')
    except ValueError:
        errs.append('written is not an ISO time')
    if b['category'] not in ('Water', 'Garden', 'Shelter', 'Outdoor living', 'Indoor'):
        errs.append('unknown category')
    v = b['verdict']
    for k in ('shown', 'fixed'):
        if not isinstance(v.get(k), int) or not 0 <= v[k] <= 10:
            errs.append(f'verdict.{k} must be 0-10')
    if not v.get('line'):
        errs.append('verdict.line missing')
    if not 4 <= len(b['scores']) <= 8:
        errs.append('scores: 4 to 8 rows')
    for s in b['scores']:
        if not all(k in s for k in ('test', 'shown', 'fixed', 'why')):
            errs.append('a score row is missing a field')
    body = b['body']
    n = words(body)
    if not 900 <= n <= 2600:
        errs.append(f'body is {n} words (900-2,600)')
    if len(re.findall(r'^## ', body, re.M)) < 3:
        errs.append('body needs at least 3 ## sections')
    for m in QUOTE.finditer(body):
        q = m.group(1) or m.group(2)
        if words(q) > 25:
            errs.append(f'quotation over 25 words: {q[:40]}…')
    src = b['sources']
    nums = {s.get('n') for s in src}
    cited = {int(x) for x in re.findall(r'\[(\d+)\]', body)}
    if len(src) < 5:
        errs.append('fewer than 5 sources')
    outlets = {(s.get('outlet') or urlparse(s.get('url', '')).netloc).lower() for s in src}
    if len(outlets) < 4:
        errs.append('sources from fewer than 4 outlets')
    for s in src:
        if not str(s.get('url', '')).startswith('http'):
            errs.append(f'source {s.get("n")} has no URL')
    if nums - cited:
        errs.append(f'sources never cited: {sorted(nums - cited)}')
    if cited - nums:
        errs.append(f'citations with no source: {sorted(cited - nums)}')
    k = b['kit']
    for f in ('summary', 'options', 'metrics', 'configs', 'materials', 'phases', 'assumptions'):
        if f not in k:
            errs.append(f'kit.{f} missing')
    if errs:
        return errs
    if not 1 <= len(k['options']) <= 2:
        errs.append('kit.options: 1 or 2')
    if not 3 <= len(k['metrics']) <= 6:
        errs.append('kit.metrics: 3 to 6')
    if not 4 <= len(k['phases']) <= 10:
        errs.append('kit.phases: 4 to 10')
    keys = [o['key'] for o in k['options']]
    for o in k['options']:
        if o.get('default') not in o.get('values', []):
            errs.append(f'option {o["key"]}: default not among values')
    combos = list(itertools.product(*[o['values'] for o in k['options']]))
    for c in combos:
        sel = dict(zip(keys, c))
        rows = [r for r in k['configs'] if all(r.get(a) == x for a, x in sel.items())]
        if len(rows) != 1:
            errs.append(f'configs: {len(rows)} rows for {sel}')
        else:
            for m in k['metrics']:
                if not isinstance(rows[0].get(m['key']), (int, float)):
                    errs.append(f'configs {sel}: metric {m["key"]} missing')
        if not [r for r in k['materials'] if all(r.get(a) == x for a, x in sel.items())]:
            errs.append(f'materials: none for {sel}')
    for r in k['materials']:
        if not all(f in r for f in ('item', 'qty', 'unit', 'low', 'high')) or r['low'] > r['high']:
            errs.append(f'bad material row: {r.get("item")}')
    for p in k['phases']:
        if not all(f in p for f in ('phase', 'start', 'days', 'gate')):
            errs.append(f'bad phase: {p.get("phase")}')
    return errs[:25]


def index():
    out = []
    for f in sorted(os.listdir(LIVE)):
        if not f.endswith('.json') or f == 'index.json':
            continue
        b = json.load(open(os.path.join(LIVE, f), encoding='utf-8'))
        out.append({k: b[k] for k in ('id', 'publish', 'category', 'title', 'dek')} |
                   {'shown': b['verdict']['shown'], 'fixed': b['verdict']['fixed'], 'line': b['verdict']['line']})
    out.sort(key=lambda x: x['publish'], reverse=True)
    queued = sorted(f[:10] for f in os.listdir(QUEUE) if f.endswith('.json')) if os.path.isdir(QUEUE) else []
    json.dump({'builds': out, 'next': queued[0] if queued else None, 'queued': len(queued)},
              open(os.path.join(LIVE, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'index: {len(out)} live, {len(queued)} queued')


def release():
    today = dt.datetime.now(ET).date().isoformat()
    moved = 0
    for f in sorted(os.listdir(QUEUE)) if os.path.isdir(QUEUE) else []:
        if f.endswith('.json') and f[:10] <= today:
            p = os.path.join(QUEUE, f)
            e = check(p)
            if e:
                print(f'held back {f}: {e}', file=sys.stderr)
                continue
            os.replace(p, os.path.join(LIVE, f))
            moved += 1
            print(f'released {f}')
    index()
    return moved


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] == 'format':
        print(FORMAT)
    elif a[0] == 'check':
        bad = 0
        for p in a[1:]:
            e = check(p)
            print(f'{os.path.basename(p)}: ' + ('ok' if not e else '\n  ' + '\n  '.join(e)))
            bad += bool(e)
        sys.exit(1 if bad else 0)
    elif a[0] == 'index':
        index()
    elif a[0] == 'release':
        release()
