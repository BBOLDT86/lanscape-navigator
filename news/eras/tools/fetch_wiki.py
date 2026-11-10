#!/usr/bin/env python3
"""Three waves: county presidential returns for 1920-1932, read from Wikipedia's state pages
("<year> United States presidential election in <State>", section "Results by county") through the MediaWiki API.
Runs on GitHub Actions (.github/workflows/eras.yml): the sandbox that builds The Watch cannot reach Wikipedia.
Writes news/eras/data/wiki/<year>-<ST>.json: {page, url, revid, header:[[...],[...]], rows:[[cell,...],...]} - the county
table as text, colspans expanded. Interpreting the columns (which is the Democrat, which the Republican) is left to
tools/build.py, which can be rerun anywhere. Stdlib only."""
import json, os, re, sys, time, urllib.parse, urllib.request
from html.parser import HTMLParser

OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'wiki')
YEARS = [int(y) for y in (sys.argv[1:] or ['1920', '1924', '1928', '1932']) if y.isdigit()]
STATES = {'AL': 'Alabama', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut',
          'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
          'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts',
          'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska',
          'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
          'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania',
          'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
          'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'}
ONLY = [a for a in sys.argv[1:] if a in STATES]
UA = 'TheWatchNewsBot/1.0 (https://bboldt86.github.io/lanscape-navigator/; election history piece)'


class Tables(HTMLParser):
    """Collect every table: rows of cells (text, colspan, rowspan, is_header), plus the headings seen before it."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables, self.stack, self.heading, self.in_h, self.skip = [], [], '', False, 0
    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag in ('h2', 'h3', 'h4'): self.in_h, self.heading = True, ''
        elif tag == 'table':
            self.stack.append({'cls': a.get('class', ''), 'heading': self.heading, 'rows': [], 'cell': None})
        elif self.stack:
            t = self.stack[-1]
            if tag == 'tr': t['rows'].append([])
            elif tag in ('td', 'th') and t['rows'] is not None:
                if not t['rows']: t['rows'].append([])
                t['cell'] = {'t': '', 'cs': int(re.sub(r'\D', '', a.get('colspan', '1')) or 1), 'rs': int(re.sub(r'\D', '', a.get('rowspan', '1')) or 1), 'h': tag == 'th'}
            elif tag in ('sup', 'style'): self.skip += 1
            elif tag == 'br' and t['cell'] is not None: t['cell']['t'] += ' '
    def handle_endtag(self, tag):
        if tag in ('h2', 'h3', 'h4'): self.in_h = False
        elif tag == 'table' and self.stack:
            t = self.stack.pop(); t.pop('cell', None); self.tables.append(t)
        elif self.stack:
            t = self.stack[-1]
            if tag in ('td', 'th') and t['cell'] is not None:
                c = t['cell']; c['t'] = re.sub(r'\s+', ' ', c['t']).strip(); t['rows'][-1].append(c); t['cell'] = None
            elif tag in ('sup', 'style') and self.skip: self.skip -= 1
    def handle_data(self, d):
        if self.in_h: self.heading += d
        if self.skip or not self.stack: return
        t = self.stack[-1]
        if t['cell'] is not None: t['cell']['t'] += d


def grid(rows):
    """Expand colspan/rowspan into a rectangular grid of (text, is_header)."""
    out, pending = [], {}
    for r in rows:
        line, ci, it = [], 0, iter(r)
        cells = list(r)
        k = 0
        while k < len(cells) or ci in pending:
            if ci in pending:
                txt, h, left = pending[ci]; line.append((txt, h))
                if left > 1: pending[ci] = (txt, h, left - 1)
                else: del pending[ci]
                ci += 1; continue
            c = cells[k]; k += 1
            for j in range(c['cs']):
                line.append((c['t'], c['h']))
                if c['rs'] > 1: pending[ci] = (c['t'], c['h'], c['rs'] - 1)
                ci += 1
        out.append(line)
    return out


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Encoding': 'identity'})
    with urllib.request.urlopen(req, timeout=40) as r: return json.loads(r.read().decode('utf-8'))


def fetch(year, st):
    page = f'{year} United States presidential election in {STATES[st]}'
    q = urllib.parse.urlencode({'action': 'parse', 'page': page, 'prop': 'text|revid', 'format': 'json', 'redirects': 1, 'formatversion': 2})
    d = get('https://en.wikipedia.org/w/api.php?' + q)
    if 'error' in d: return {'page': page, 'error': d['error'].get('info')}
    p = Tables(); p.feed(d['parse']['text'])
    best = None
    for t in p.tables:
        if 'wikitable' not in t['cls'] or len(t['rows']) < 4: continue
        g = grid([r for r in t['rows'] if r])
        head = [r for r in g if r and all(h for _, h in r[:1]) and sum(1 for _, h in r if h) >= len(r) / 2]
        first = ' '.join(x for r in g[:3] for x, _ in r).lower()
        score = len(g) + (500 if re.search(r'\b(county|parish|city|town)\b', first) else 0) + (300 if 'county' in t['heading'].lower() else 0)
        if best is None or score > best[0]: best = (score, t, g)
    if not best or best[0] < 300:
        return {'page': page, 'error': 'no county table', 'tables': len(p.tables),
                'dump': [{'cls': t['cls'], 'heading': t['heading'][:80], 'n': len(t['rows']), 'head': [[c['t'][:30] for c in r] for r in t['rows'][:3]]} for t in p.tables]}
    _, t, g = best
    nh = 0
    while nh < len(g) and sum(1 for _, h in g[nh] if h) > len(g[nh]) / 2 and nh < 3: nh += 1
    return {'page': page, 'url': 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(d['parse']['title'].replace(' ', '_')),
            'revid': d['parse'].get('revid'), 'heading': t['heading'].strip(),
            'header': [[x for x, _ in r] for r in g[:nh]], 'rows': [[x for x, _ in r] for r in g[nh:]]}


INFO_PAGES = [f'{y} United States presidential election' for y in (1920, 1924, 1928, 1932, 2004, 2008, 2012, 2016, 2020, 2024)] + \
    [f'{y} United States gubernatorial elections' for y in list(range(1922, 1934, 2)) + list(range(2002, 2028, 2))]


def infoboxes():
    """The infobox wikitext of each national page (electoral votes, governorships before/after) -> data/wiki/infobox.json"""
    out = {}
    for page in INFO_PAGES:
        q = urllib.parse.urlencode({'action': 'parse', 'page': page, 'prop': 'wikitext|revid', 'format': 'json', 'redirects': 1, 'formatversion': 2, 'section': 0})
        try:
            d = get('https://en.wikipedia.org/w/api.php?' + q)
            w = d['parse']['wikitext']; i = w.find('{{Infobox')
            depth, j = 0, i
            while j < len(w):
                if w.startswith('{{', j): depth += 1; j += 2; continue
                if w.startswith('}}', j):
                    depth -= 1; j += 2
                    if depth == 0: break
                    continue
                j += 1
            out[page] = {'revid': d['parse'].get('revid'), 'url': 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(d['parse']['title'].replace(' ', '_')), 'infobox': w[i:j] if i >= 0 else ''}
        except Exception as e:
            out[page] = {'error': repr(e)}
        print(page, 'error' in out[page] and out[page]['error'] or len(out[page]['infobox']), flush=True)
        time.sleep(0.4)
    with open(os.path.join(OUT, 'infobox.json'), 'w') as f: json.dump(out, f, ensure_ascii=False, indent=0)


def main():
    os.makedirs(OUT, exist_ok=True)
    if 'infobox' in sys.argv: infoboxes(); return
    log = []
    if 'with-infobox' in sys.argv: infoboxes()
    for y in YEARS:
        for st in (ONLY or STATES):
            try: d = fetch(y, st)
            except Exception as e: d = {'page': f'{y} {st}', 'error': repr(e)}
            with open(os.path.join(OUT, f'{y}-{st}.json'), 'w') as f: json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
            log.append(f"{y} {st}: {d.get('error') or str(len(d['rows'])) + ' rows'}")
            print(log[-1], flush=True)
            time.sleep(0.4)
    with open(os.path.join(OUT, '_log.txt'), 'w') as f: f.write('\n'.join(log) + '\n')


if __name__ == '__main__':
    main()
