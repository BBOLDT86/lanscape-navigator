#!/usr/bin/env python3
"""The Watch's Epstein files desk: a compact index of Inbox Atlas, for the page -> news/data/files.json

  python3 news/updater/files.py

Reads the archive Inbox Atlas already publishes (inbox-atlas/data/atlas.json.gz: the emails released by the House
Oversight Committee and the DOJ, the recovered text logs, the documents, people, stories and posts) and keeps what a
news desk needs: the stories and posts, the people with the most correspondence, the timeline, and the emails Inbox
Atlas marks as notable, each with a short excerpt and its links to jmail.world and the source PDF. Items Inbox Atlas
files under sensitive categories, and duplicates, are left out; Inbox Atlas itself has the full archive.
Run it again whenever Inbox Atlas's archive changes. Standard library only.
"""
import gzip
import json
import os
import re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'inbox-atlas', 'data', 'atlas.json.gz')
OUT = os.path.join(ROOT, 'news', 'data', 'files.json')
WS = re.compile(r'\s+')


JUNK = [re.compile(p, re.I) for p in (r'<[^>]{0,400}>', r'(class|style|face|size|color)=("[^"]*"|3D"[^"]*")', r'</?=?\w{1,12}\s*/?>',
                                       r'=\w{0,12}\s*>', r'=\r?\n', r'=[0-9A-F]{2}', r'&nbsp;|&[a-z]{2,6};', r'>\s*<', r'[<>]')]


def clip(s, n):
    s = s or ''
    for rx in JUNK:  # quoted-printable and HTML left in the released text
        s = rx.sub(' ', s)
    s = re.sub(r'(?<=[A-Za-z])=(?=[A-Za-z])', '', s)  # a soft break left mid-word
    s = WS.sub(' ', s).strip()
    return s if len(s) <= n else s[:n].rsplit(' ', 1)[0].rstrip(',;:') + '…'


def main():
    db = json.loads(gzip.decompress(open(SRC, 'rb').read()))
    emails = [e for e in db['emails'] if not e.get('sn') and not e.get('d')]
    cats = {k: (v[0] if isinstance(v, list) and v else k) for k, v in (db.get('cats') or {}).items()}
    by_year = Counter((e.get('t') or '')[:4] for e in emails if e.get('t'))
    notable = [e for e in emails if e.get('x')]
    notable.sort(key=lambda e: e.get('t') or '', reverse=True)
    mail = []
    for e in notable[:900]:
        body = e.get('b') or e.get('T') or ''
        mail.append({'i': e['i'], 't': (e.get('t') or '')[:16], 'a': e.get('a') or '', 'j': clip(e.get('j') or '(no subject)', 140),
                     'x': clip(body, 260), 'c': cats.get(e.get('c') or '', e.get('c') or ''), 'n': clip(e.get('n') or '', 160),
                     'u': e.get('u') or '', 'su': e.get('su') or '', 's': e.get('s') or ''})
    people = sorted(db.get('people') or [], key=lambda p: -((p.get('by') or 0) + (p.get('to') or 0)))
    stories = [{'id': s['id'], 'title': s.get('title', ''), 'kicker': s.get('kicker', ''), 'dek': s.get('dek', ''), 'period': s.get('period', ''),
                'min': s.get('min'), 'people': (s.get('people') or [])[:6]} for s in db.get('stories') or []]
    posts = [{'id': p['id'], 'title': p.get('title', ''), 'date': p.get('date', '')} for p in db.get('posts') or []]
    out = {
        'v': 1, 'built': db.get('built'), 'source': 'Inbox Atlas (inbox-atlas/data/atlas.json.gz)',
        'counts': {'emails': len(db['emails']), 'texts': len(db.get('texts') or []), 'docs': len(db.get('docs') or []),
                   'people': len(db.get('people') or []), 'stories': len(stories), 'shown': len(emails), 'notable': len(notable)},
        'releases': ['The U.S. House Oversight Committee (November 2025)', 'The Department of Justice, under the Epstein Files Transparency Act'],
        'years': {y: n for y, n in sorted(by_year.items()) if y},
        'stories': stories, 'posts': posts,
        'people': [{'n': p['n'], 'bio': clip(p.get('bio') or '', 220), 'by': p.get('by') or 0, 'to': p.get('to') or 0,
                    'f': p.get('f') or '', 'l': p.get('l') or ''} for p in people[:80]],
        'events': db.get('events') or [],
        'mail': mail,
    }
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print(f"files: {len(stories)} stories, {len(mail)} notable emails, {len(out['people'])} people, "
          f"{os.path.getsize(OUT) // 1024} KB (from Inbox Atlas built {db.get('built')})")


if __name__ == '__main__':
    main()
