#!/usr/bin/env python3
"""The Watch's Late Night: the late shows' news segments, and Receipts, Claude's weekly fact-checked comedy pieces.

  python3 news/updater/latenight.py              rebuild news/data/latenight.json (after run.py, for its edition)
  python3 news/updater/latenight.py check FILE   exit 1 with the problems in a piece (news/latenight/<id>.json)
  python3 news/updater/latenight.py index        rebuild news/latenight/index.json
  python3 news/updater/latenight.py format       print the piece format

news/data/latenight.json: the last ten days of the shows' official YouTube uploads (The Daily Show, Last Week Tonight
with John Oliver, Late Night with Seth Meyers, Jimmy Kimmel Live), each id checked against the channel's own name.
Kept: Last Week Tonight's main stories and segments, and from the others the segments about the news (matched to a
story cluster in the edition, or a named news segment such as A Closer Look or a correspondent's piece). Celebrity
interviews and Shorts are left out. Each kept video carries the edition story it covers, when there is one. The page
plays them in YouTube's privacy-enhanced player. Standard library only.
"""
import datetime as dt
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import garage  # noqa: E402  the YouTube feed reader
import media  # noqa: E402  the story matcher

D = os.path.normpath(os.path.join(HERE, '..', 'data'))
LN = os.path.normpath(os.path.join(HERE, '..', 'latenight'))
OUT = os.path.join(D, 'latenight.json')
NOW = dt.datetime.now(dt.timezone.utc)
SHOWS = [
    ('UCwWhs_6x42TyRM4Wstoq8HA', 'daily show', 'The Daily Show', 'TheDailyShow', 'Comedy Central, weeknights'),
    ('UC3XTzVzaHQEd30rQbuvCtTQ', 'lastweektonight', 'Last Week Tonight', 'LastWeekTonight', 'HBO, Sunday nights'),
    ('UCVTyTA7-g9nopHeHbeuvpRA', 'seth meyers', 'Late Night with Seth Meyers', 'LateNightSeth', 'NBC, weeknights'),
    ('UCa6vGFO9ty8v5KZJXQxdhaw', 'kimmel', 'Jimmy Kimmel Live', 'JimmyKimmelLive', 'ABC, weeknights'),
]
SEG = re.compile(r'closer look|monologue|jon stewart|desi lydic|ronny chieng|jordan klepper|michael kosta|josh johnson|troy iwata|'
                 r'grace kuhlenschmidt|dulc[ée] sloan|lewis black|weekly news|headlines|news of the week|correspondent|fact[- ]check', re.I)


def build():
    try:
        E = json.load(open(os.path.join(D, 'edition.json'), encoding='utf-8'))
    except (OSError, ValueError):
        E = None
    try:
        old = json.load(open(OUT, encoding='utf-8'))
    except (OSError, ValueError):
        old = {}
    vids, failed = garage.channels(SHOWS, per=15, days=10)
    if not vids and old.get('videos'):
        print('latenight: no feed answered; kept the last copy'); return 0
    for v in vids:  # match on the title and the first line of the description
        v['_t'] = v['t']; v['t'] = v['t'] + ' ' + (v.get('d') or '')[:160]
    hit = media.match(vids, E) if E else 0
    byid = {it['i']: it for it in (E or {}).get('items', [])}
    keep = []
    for v in vids:
        v['t'] = v.pop('_t')
        lwt = v['cid'] == SHOWS[1][0]
        g = v.pop('g', None)
        if g is not None:
            c = E['clusters'][g]; lead = byid.get(c['lead'])
            if lead:
                v['story'] = {'t': lead['t'], 'u': lead['u'], 'o': lead['o'], 'n': c['n']}
        if lwt or 'story' in v or SEG.search(v['t'] + ' ' + (v.get('d') or '')[:120]):
            keep.append(v)
    keep.sort(key=lambda v: v['p'], reverse=True)
    out = {'v': 1, 'at': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'shows': {s[0]: {'n': s[2], 'h': s[3], 'about': s[4]} for s in SHOWS},
           'videos': keep[:60], 'failed': failed, 'errors': garage.errors[:10]}
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'latenight: kept {len(keep)} of {len(vids)} videos, {hit} tied to stories; {len(SHOWS) - len(failed)} of {len(SHOWS)} shows read')
    return 0


FORMAT = """news/latenight/<id>.json, one Receipts piece:
  {"id": "2026-10-26-the-main-story-slug", "kind": "main | desk", "written": "2026-10-26T07:40:00-04:00", "model": "Claude Opus 5.5",
   "title": "...", "dek": "one or two sentences",
   "body": "Markdown: main 1,300 to 2,400 words, desk 600 to 1,200; ## sections; cited [n] for sources[n-1]",
   "targets": ["who or what it takes aim at: institutions, officials, companies (1 to 6)"],
   "related": [{"v": "11-character YouTube id from news/data/latenight.json", "ch": "the show", "t": "the segment's title"}],
   "sources": [{"title", "outlet", "url", "date"}],
   "i18n": {"pt": {"title", "dek"}, "de": {"title", "dek"}}}
kind "main" is a long look at one subject, in the spirit of Last Week Tonight's main story; "desk" runs through the
week's headlines, in the spirit of The Daily Show's desk pieces. The jokes are the writer's; every fact is cited.
Main pieces need 8 sources from 4 outlets, desk pieces 5 from 3; every ## section is cited, about one citation per
110 words, every source is cited, and no quotation runs over 25 words."""
KINDS = {'main': (1300, 2400, 8, 4), 'desk': (600, 1200, 5, 3)}


def check_piece(path):
    P = []
    try:
        d = json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError) as ex:
        return [f'not readable JSON: {ex}'], None
    for k in ('id', 'kind', 'written', 'model', 'title', 'dek', 'body', 'targets', 'sources'):
        if d.get(k) in (None, '', []):
            P.append(f'missing {k}')
    if P:
        return P, d
    if os.path.basename(path) != d['id'] + '.json':
        P.append('the file name must be <id>.json')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+){1,9}', d['id']):
        P.append('id is the date then 2 to 10 lowercase words joined by hyphens')
    if d['kind'] not in KINDS:
        P.append('kind is main or desk'); return P, d
    lo, hi, ns, no = KINDS[d['kind']]
    if not re.fullmatch(r'Claude [A-Za-z]+ \d+(\.\d+)?', d['model']):
        P.append('model must be the exact model name, like "Claude Opus 5.5"')
    try:
        if dt.datetime.fromisoformat(d['written']).tzinfo is None:
            P.append('written needs a UTC offset')
    except ValueError:
        P.append('written must be an ISO date and time')
    if not 15 <= len(d['title']) <= 120:
        P.append('title is 15 to 120 characters')
    if len(d['dek']) > 320:
        P.append('dek is at most 320 characters')
    body = d['body']
    n = garage.words(body)
    if not lo <= n <= hi:
        P.append(f'body is {n} words; {lo} to {hi} for a {d["kind"]} piece')
    if re.search(r'<[a-z][^>]*>', body, re.I):
        P.append('no HTML; Markdown only')
    secs = re.split(r'(?m)^##\s', body)
    if len(secs) < 3:
        P.append('at least two ## sections')
    for i, sct in enumerate(secs[1:], 1):
        if not re.search(r'\[\d+\]', sct):
            P.append(f'section {i} ("{sct.splitlines()[0][:40]}") has no citation: every section needs its receipts')
    cites = [int(m) for m in re.findall(r'\[(\d+)\](?!\()', body)]
    if len(cites) < n / 110:
        P.append(f'{len(cites)} citations for {n} words; at least one per 110 words')
    S = d['sources']
    if len(S) < ns:
        P.append(f'at least {ns} sources')
    outlets = {(s.get('outlet') or '').strip().lower() for s in S}
    if len(outlets) < no:
        P.append(f'sources from at least {no} different outlets')
    for s in S:
        if not re.match(r'^https?://', s.get('url') or '') or not s.get('title') or not s.get('outlet'):
            P.append('each source needs a title, an outlet and an http(s) url'); break
    if any(not 1 <= c <= len(S) for c in cites):
        P.append('a citation points past the sources')
    unused = [i + 1 for i in range(len(S)) if i + 1 not in set(cites)]
    if unused:
        P.append(f'sources never cited: {unused}')
    q = garage.long_quote(body + ' ' + d['dek'])
    if q:
        P.append(f'quotation over 25 words: "{q}…"')
    if not 1 <= len(d['targets']) <= 6:
        P.append('targets: 1 to 6')
    for r in d.get('related') or []:
        if not re.fullmatch(r'[\w-]{11}', r.get('v') or '') or not r.get('ch') or not r.get('t'):
            P.append('related: each needs v (an 11-character YouTube id), ch and t'); break
    for lang in ('pt', 'de'):
        t = (d.get('i18n') or {}).get(lang) or {}
        if not t.get('title') or not t.get('dek'):
            P.append(f'i18n.{lang} needs title and dek')
    return P, d


def index():
    rows = []
    for p in sorted(glob.glob(os.path.join(LN, '*.json'))):
        if os.path.basename(p) == 'index.json':
            continue
        probs, d = check_piece(p)
        if probs:
            print(f'skipped {os.path.basename(p)}: {probs[0]}'); continue
        rows.append({'id': d['id'], 'kind': d['kind'], 'title': d['title'], 'dek': d['dek'], 'written': d['written'], 'model': d['model'],
                     'words': garage.words(d['body']), 'targets': d['targets'], 'thumb': (d.get('related') or [{}])[0].get('v'),
                     'i18n': {k: {'title': v['title'], 'dek': v['dek']} for k, v in (d.get('i18n') or {}).items()}})
    rows.sort(key=lambda r: r['written'], reverse=True)
    os.makedirs(LN, exist_ok=True)
    with open(os.path.join(LN, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump({'v': 1, 'pieces': rows}, fh, ensure_ascii=False, indent=1)
    print(f'index: {len(rows)} pieces')
    return 0


def main():
    a = sys.argv[1:]
    if a and a[0] == 'check':
        if len(a) < 2:
            print(FORMAT); return 2
        bad = 0
        for p in a[1:]:
            probs, _ = check_piece(p)
            if probs:
                bad = 1; print(f'{p}: NOT READY'); [print('  -', x) for x in probs[:40]]
            else:
                print(f'{p}: ok')
        return bad
    if a and a[0] == 'index':
        return index()
    if a and a[0] in ('format', '-h', '--help'):
        print(__doc__); print(FORMAT); return 0
    return build()


if __name__ == '__main__':
    sys.exit(main())
