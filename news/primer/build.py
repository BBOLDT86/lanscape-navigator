#!/usr/bin/env python3
"""Primer: builds news/primer/lessons.js (and lessons.json) from the lesson files in news/primer/src/.

    python3 news/primer/build.py            # validate every lesson and write lessons.js
    python3 news/primer/build.py --check    # validate only

One JSON file per category in src/ ({"cat": "...", "topics": [...]}). Every topic is checked for the things the
player needs (an id, a title, 6–12 cards, each with a known visual, a quiz whose answers point at real options,
takeaways and sources) so a typo in a lesson fails here instead of in a reader's browser.
"""
import json, re, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / 'src'

CATS = [  # key, name, colour, one line for the hub
    ('household', 'Household', '#C2785C', 'How the house works, and what to do when it doesn’t.'),
    ('kitchen', 'Kitchen', '#5E8C61', 'Knives, labels, coffee and the temperatures that matter.'),
    ('money', 'Money', '#A9852F', 'Interest, credit, insurance, taxes and the paycheck.'),
    ('life', 'Life skills', '#7B6A8E', 'Negotiating, remembering, deciding and difficult talks.'),
    ('health', 'Health', '#3E9B8A', 'Sleep, caffeine, the immune system and first aid.'),
    ('history', 'History', '#8C3B3B', 'Ten turning points, ten cards each.'),
    ('society', 'Society', '#5B7FA1', 'How the government and the economy are wired.'),
    ('culture', 'Culture', '#A2566F', 'Music, painting, buildings and ideas.'),
    ('science', 'Science', '#3F6FB5', 'The internet, the climate, GPS and probability.'),
]
CAT_KEYS = [c[0] for c in CATS]

# visual types and the fields each one needs
VIS = {
    'big': ['n', 'c'],            # one big number and a caption
    'bars': ['items'],            # horizontal bars: [[label, value, note?]]
    'cols': ['items'],            # columns over time: [[label, value]]
    'line': ['pts'],              # a curve: pts [[x,y]], optional pts2, xl, yl, l1, l2
    'steps': ['items'],           # a numbered sequence
    'compare': ['a', 'b'],        # two columns: [title, item, item...]
    'timeline': ['items'],        # [[when, what]]
    'donut': ['parts'],           # [[label, pct]]
    'stack': ['parts'],           # one bar split into parts: [[label, pct]]
    'icons': ['items'],           # [[glyph, label, note?]]
    'quote': ['q'],               # q, by
    'scale': ['min', 'max', 'zones'],  # a gauge: zones [[from, to, label]], marks [[value, label]]
    'grid': ['cols', 'rows'],     # a small table: cols [..], rows [[head, cell, cell...]]
    'list': ['items'],            # a checklist; mark: ✓ ✗ •
    'flow': ['items'],            # boxes with arrows, left to right
    'cycle': ['items'],           # items around a circle
}
ID_RE = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')


def fail(msgs):
    for m in msgs:
        print('  ✗', m)
    sys.exit(1)


def check_topic(t, cat, errs):
    tid = t.get('id', '?')
    w = lambda m: errs.append(f'{cat}/{tid}: {m}')
    if not ID_RE.match(tid):
        w('id must be a lower-case slug')
    for k in ('title', 'dek', 'icon'):
        if not isinstance(t.get(k), str) or not t[k].strip():
            w(f'needs a {k}')
    if len(t.get('title', '')) > 44:
        w('title longer than 44 characters')
    if len(t.get('dek', '')) > 90:
        w('dek longer than 90 characters')
    slides = t.get('slides')
    if not isinstance(slides, list) or not 6 <= len(slides) <= 12:
        w('needs 6 to 12 cards')
        slides = slides or []
    for i, s in enumerate(slides, 1):
        if not isinstance(s.get('h'), str) or not s['h'].strip():
            w(f'card {i} needs a headline (h)')
        elif len(s['h']) > 64:
            w(f'card {i} headline longer than 64 characters: {s["h"][:40]}…')
        if not isinstance(s.get('p'), str) or not s['p'].strip():
            w(f'card {i} needs a body (p)')
        elif len(s['p']) > 330:
            w(f'card {i} body longer than 330 characters ({len(s["p"])})')
        v = s.get('v')
        if not isinstance(v, dict) or v.get('t') not in VIS:
            w(f'card {i} needs a visual of a known type (got {v.get("t") if isinstance(v, dict) else v!r})')
            continue
        for f in VIS[v['t']]:
            if f not in v:
                w(f'card {i} visual "{v["t"]}" needs "{f}"')
        n = {'steps': 6, 'timeline': 7, 'icons': 6, 'flow': 5, 'cycle': 6, 'list': 6, 'bars': 7, 'cols': 8}.get(v['t'])
        if n and isinstance(v.get('items'), list) and len(v['items']) > n:
            w(f'card {i} visual "{v["t"]}" has {len(v["items"])} items; {n} is the most that fits')
        if v['t'] in ('donut', 'stack'):
            tot = sum(p[1] for p in v['parts'])
            if not 95 <= tot <= 105:
                w(f'card {i} {v["t"]} parts add up to {tot}, not 100')
        if v['t'] == 'grid' and any(len(r) != len(v['cols']) + 1 for r in v['rows']):
            w(f'card {i} grid rows must have one cell per column plus a row head')
    quiz = t.get('quiz')
    if not isinstance(quiz, list) or not 2 <= len(quiz) <= 4:
        w('needs 2 to 4 quiz questions')
        quiz = quiz or []
    for i, q in enumerate(quiz, 1):
        if not isinstance(q.get('q'), str) or not q['q'].strip():
            w(f'question {i} needs text')
        a = q.get('a')
        if not isinstance(a, list) or not 2 <= len(a) <= 4:
            w(f'question {i} needs 2 to 4 options')
        elif not isinstance(q.get('c'), int) or not 0 <= q['c'] < len(a):
            w(f'question {i} answer index out of range')
        if not isinstance(q.get('why'), str) or not q['why'].strip():
            w(f'question {i} needs a "why" (shown after answering)')
    take = t.get('take')
    if not isinstance(take, list) or not 2 <= len(take) <= 4:
        w('needs 2 to 4 takeaways')
    src = t.get('src')
    if not isinstance(src, list) or not src or any(not (isinstance(s, list) and len(s) == 2 and s[1].startswith('http')) for s in src):
        w('needs sources as [title, url] pairs')


def load():
    topics, errs, seen = [], [], set()
    files = sorted(SRC.glob('*.json'))
    if not files:
        fail(['no lesson files in ' + str(SRC)])
    for f in files:
        try:
            d = json.loads(f.read_text(encoding='utf-8'))
        except json.JSONDecodeError as e:
            errs.append(f'{f.name}: not valid JSON ({e})')
            continue
        cat = d.get('cat')
        if cat not in CAT_KEYS:
            errs.append(f'{f.name}: unknown category {cat!r}')
            continue
        for t in d.get('topics', []):
            t = dict(t)
            t['cat'] = cat
            if t.get('id') in seen:
                errs.append(f'{cat}/{t.get("id")}: duplicate id')
            seen.add(t.get('id'))
            check_topic(t, cat, errs)
            topics.append(t)
    # keep the hub's order: the categories in CATS order, topics in file order
    order = {k: i for i, k in enumerate(CAT_KEYS)}
    topics.sort(key=lambda t: order[t['cat']])
    return topics, errs


def main():
    topics, errs = load()
    if errs:
        print(f'{len(errs)} problem(s):')
        fail(errs)
    cards = sum(len(t['slides']) for t in topics)
    qs = sum(len(t['quiz']) for t in topics)
    print(f'{len(topics)} lessons, {cards} cards, {qs} quiz questions, {len({t["cat"] for t in topics})} categories')
    if '--check' in sys.argv:
        return
    data = {
        'built': time.strftime('%Y-%m-%d'),
        'cats': [{'k': k, 'name': n, 'color': c, 'dek': d} for k, n, c, d in CATS],
        'topics': topics,
    }
    (HERE / 'lessons.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    js = '/* Primer lessons. Built by news/primer/build.py from news/primer/src/*.json; edit those, not this. */\n'
    js += 'window.PRIMER_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + ';\n'
    (HERE / 'lessons.js').write_text(js, encoding='utf-8')
    print('wrote lessons.js and lessons.json')


if __name__ == '__main__':
    main()
