#!/usr/bin/env python3
"""The Stack: build the app's data from the written pieces.

  python3 news/stack/tools/build.py          build data/index.json and data/packs/*.json, run every check
  python3 news/stack/tools/build.py titles   list what is already written, by topic (read before writing more)
  python3 news/stack/tools/build.py day 2026-11-20   report one day's folder only (count, minutes, problems)

Source: news/stack/src/<YYYY-MM-DD>/*.txt, one folder per release day, any number of files, format in WRITING.md.
A piece is about five minutes aloud. Time is words / WPM, nothing else: the hours on the page are counted, not claimed.
Exit 1 on any problem, so a bad day is never pushed.
"""
import json, os, re, sys, glob, hashlib

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, DATA = os.path.join(HERE, 'src'), os.path.join(HERE, 'data')
WPM = 150                       # speaking pace used for every minute on the page
PACK = 24                       # pieces per pack file
TOPICS = {                      # key: (name, colour of the card)
    'electronics': ('Electronics', '#0E5E4A'),
    'poker': ('Poker', '#8A1C2E'),
    'money': ('Money & business', '#1B3F7A'),
    'mind': ('Mind & habits', '#5A3285'),
    'world': ('History & science', '#8A5A12'),
    'life': ('Health & home', '#1C6A78'),
}
PIECE_WORDS = (620, 900)        # about five minutes aloud (4 min 10 s to 6 min)
CARD_WORDS = (55, 135)          # one card has to fit one phone screen
CARDS = (5, 8)

def words(s): return len(re.findall(r"[A-Za-z0-9$%'’\-\.,/]+", s))
def slug(s):
    s = re.sub(r"[’']", '', s.lower()); s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s[:70].strip('-')

def parse(path, day, problems):
    out, cur, card = [], None, None
    for n, raw in enumerate(open(path, encoding='utf-8'), 1):
        line = raw.rstrip('\n')
        if line.startswith('=== '):
            parts = [p.strip() for p in line[4:].split('|')]
            if len(parts) < 2: problems.append(f'{path}:{n}: "=== topic | title [| series]" expected'); continue
            cur = {'topic': parts[0], 'title': parts[1], 'series': parts[2] if len(parts) > 2 else '', 'dek': '', 'more': '', 'cards': [], 'day': day, 'file': os.path.relpath(path, HERE), 'line': n}
            out.append(cur); card = None
        elif cur is None:
            if line.strip(): problems.append(f'{path}:{n}: text before the first "===" line')
        elif line.startswith('> '): cur['dek'] = line[2:].strip()
        elif line.startswith('+ '): cur['more'] = line[2:].strip()
        elif line.startswith('# '):
            card = {'h': line[2:].strip(), 't': ''}; cur['cards'].append(card)
        elif line.strip():
            if card is None: problems.append(f'{path}:{n}: text before the first "# " card in "{cur["title"]}"'); continue
            card['t'] = (card['t'] + '\n' + line.strip()).strip()
    return out

def check(p, problems):
    at = f'{p["file"]}:{p["line"]} "{p["title"]}"'
    if p['topic'] not in TOPICS: problems.append(f'{at}: unknown topic "{p["topic"]}" (use {", ".join(TOPICS)})')
    if not p['dek']: problems.append(f'{at}: no "> " line')
    if not (CARDS[0] <= len(p['cards']) <= CARDS[1]): problems.append(f'{at}: {len(p["cards"])} cards (want {CARDS[0]}-{CARDS[1]})')
    for c in p['cards']:
        w = words(c['t'])
        if not (CARD_WORDS[0] <= w <= CARD_WORDS[1]): problems.append(f'{at}: card "{c["h"]}" is {w} words (want {CARD_WORDS[0]}-{CARD_WORDS[1]})')
        if len(c['h']) > 60: problems.append(f'{at}: card heading over 60 characters: "{c["h"]}"')
        if re.search(r'\*\*|__|^\s*[-*] |https?://', c['t'], re.M): problems.append(f'{at}: card "{c["h"]}" has markdown or a link; plain sentences only')
    if len(p['title']) > 70: problems.append(f'{at}: title over 70 characters')
    if not (PIECE_WORDS[0] <= p['words'] <= PIECE_WORDS[1]): problems.append(f'{at}: {p["words"]} words (want {PIECE_WORDS[0]}-{PIECE_WORDS[1]})')

def load():
    problems, pieces = [], []
    for d in sorted(os.listdir(SRC)) if os.path.isdir(SRC) else []:
        if not re.fullmatch(r'\d{4}-\d\d-\d\d', d): continue
        for f in sorted(glob.glob(os.path.join(SRC, d, '*.txt'))): pieces += parse(f, d, problems)
    seen, heads = {}, {}
    for p in pieces:
        p['words'] = sum(words(c['h']) + words(c['t']) for c in p['cards']) + words(p['title']) + words(p['dek'])
        p['id'] = p['topic'][:2] + '-' + slug(p['title'])
        check(p, problems)
        if p['id'] in seen: problems.append(f'{p["file"]}:{p["line"]}: "{p["title"]}" is already written in {seen[p["id"]]}')
        seen[p['id']] = f'{p["file"]}:{p["line"]}'
        for c in p['cards']:
            k = hashlib.md5(re.sub(r'\W+', '', c['t'].lower())[:160].encode()).hexdigest()
            if k in heads: problems.append(f'{p["file"]}:{p["line"]}: card "{c["h"]}" repeats text from {heads[k]}')
            heads[k] = f'{p["file"]}:{p["line"]}'
    return pieces, problems

def mins(w): return round(w / WPM, 1)

def build():
    pieces, problems = load()
    if problems:
        print('\n'.join(problems)); print(f'\n{len(problems)} problem(s); nothing written'); sys.exit(1)
    os.makedirs(os.path.join(DATA, 'packs'), exist_ok=True)
    for f in glob.glob(os.path.join(DATA, 'packs', '*.json')): os.remove(f)
    index, days, by_day = [], [], {}
    for p in pieces: by_day.setdefault(p['day'], []).append(p)
    for day, ps in by_day.items():
        # deal the day's pieces round-robin by topic so a pack is a mix
        buckets = {}
        for p in ps: buckets.setdefault(p['topic'], []).append(p)
        mixed = []
        while any(buckets.values()):
            for t in list(buckets):
                if buckets[t]: mixed.append(buckets[t].pop(0))
        for i in range(0, len(mixed), PACK):
            name = f'{day}-{i // PACK + 1}'
            chunk = mixed[i:i + PACK]
            json.dump({p['id']: {'c': [[c['h'], c['t']] for c in p['cards']], 'more': p['more']} for p in chunk},
                      open(os.path.join(DATA, 'packs', name + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
            for p in chunk:
                index.append({'id': p['id'], 't': p['topic'], 'h': p['title'], 'd': p['dek'], 's': p['series'], 'n': len(p['cards']), 'w': p['words'], 'm': mins(p['words']), 'day': day, 'pack': name})
        w = sum(p['words'] for p in ps)
        days.append({'day': day, 'pieces': len(ps), 'words': w, 'hours': round(w / WPM / 60, 2)})
    tw = sum(p['words'] for p in pieces)
    topics = {}
    for k, (name, col) in TOPICS.items():
        ps = [p for p in pieces if p['topic'] == k]
        topics[k] = {'name': name, 'color': col, 'pieces': len(ps), 'hours': round(sum(p['words'] for p in ps) / WPM / 60, 2)}
    out = {'wpm': WPM, 'totals': {'pieces': len(pieces), 'cards': sum(len(p['cards']) for p in pieces), 'words': tw, 'hours': round(tw / WPM / 60, 2)},
           'topics': topics, 'days': days, 'pieces': index}
    json.dump(out, open(os.path.join(DATA, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    if not os.path.exists(os.path.join(DATA, 'audio.json')): json.dump({}, open(os.path.join(DATA, 'audio.json'), 'w'))
    print(f'{len(pieces)} pieces, {out["totals"]["cards"]} cards, {tw:,} words = {out["totals"]["hours"]} hours at {WPM} wpm')
    for d in days: print(f'  {d["day"]}: {d["pieces"]} pieces, {d["hours"]} h')
    for k, t in topics.items(): print(f'  {k:12} {t["pieces"]:4} pieces  {t["hours"]:5} h')

def titles():
    pieces, _ = load()
    for k in TOPICS:
        ps = [p for p in pieces if p['topic'] == k]
        print(f'\n## {k} ({len(ps)})')
        ser = {}
        for p in ps: ser.setdefault(p['series'] or '(no series)', []).append(p['title'])
        for s, ts in ser.items(): print(f'  [{s}] ' + ' / '.join(ts))

def day(d):
    pieces, problems = load()
    ps = [p for p in pieces if p['day'] == d]
    w = sum(p['words'] for p in ps)
    print(f'{d}: {len(ps)} pieces, {w:,} words = {round(w / WPM / 60, 2)} hours')
    for k in TOPICS: print(f'  {k:12} {sum(1 for p in ps if p["topic"] == k)}')
    mine = [x for x in problems if f'src/{d}/' in x]
    print('\n'.join(mine) if mine else 'no problems in this day')
    sys.exit(1 if mine else 0)

if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == 'titles': titles()
    elif a and a[0] == 'day': day(a[1])
    else: build()
