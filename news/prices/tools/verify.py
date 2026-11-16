#!/usr/bin/env python3
"""The Checkout: the checker. Reads data/posts.json, data/items.json and (when it has been fetched) data/official.json,
runs every check, grades every post and every price, and writes
  data/db.json     the price database: one row per price, with its tier (solid / unverified / rejected), flags and source
  data/audit.json  every check that ran, with its result and the reason; the grade of each post and why
  data/view.json   what the page and the 3-D stage read
Exit code 1 (the build stops, nothing is published) on: a malformed record, a failed self-test, or a failed canary.

Grades
  A  verified      priced by a reporter or fact-checker, or a published receipt with a full item-by-item method
  B  corroborated  the document is public and was read by two or more outlets; no check failed
  C  unverified    one source, second hand, or totals only
  D  doesn't hold  real post, but the claim fails a check or was disputed by the retailer or a fact-checker
  F  fabricated    evidence the document is not real (store does not exist, labelled or detected as AI-made)

Checks (code: what it does)
  schema      required fields, dates, numbers, source indexes
  source      at least one source with a URL; counts independent outlets
  sum         item lines add up to the printed total (only when every line was read)
  store       the store number and address exist
  codes       product codes reused across receipts years apart
  ai          platform AI label or detector result
  dup         same total and item count, or same URL, as another post
  band        a price against the official average for that item, month and region  (fail above 2.5x, warn above 1.6x or below 0.4x)
  pair        the rise between an old and a new price against the official rise for the same item  (fail if more than 2x or less than 0.4x of it)
  basket      a claimed change in a whole cart against official grocery inflation over the same months  (fail when more than 25 points and 2x apart; carts under $30 only warn)
  feed        the official feed itself against figures published elsewhere (so a bad download is caught)
"""
import json, os, re, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
START = 1980
GRADE_NAME = {'A': 'Verified', 'B': 'Corroborated', 'C': 'Unverified', 'D': "Doesn't hold up", 'F': 'Fabricated'}
DATE_RE = re.compile(r'^\d{4}(-\d{2}(-\d{2})?)?$')


class Official:
    def __init__(self, off, items):
        self.s = (off or {}).get('series') or {}
        self.mock = bool((off or {}).get('mock'))
        self.items = {i['id']: i for i in items}
        self.loaded = any(k.startswith('APU') for k in self.s)

    def _at(self, sid, date):
        d = self.s.get(sid)
        if not d or not date:
            return None
        if len(date) == 4:  # a year: the annual average
            v = [d[k] for k in d if k.startswith(date)]
            return sum(v) / len(v) if v else None
        k = date[:7]
        if k in d:
            return d[k]
        # a month not yet published: the latest earlier month, at most three back
        y, m = int(k[:4]), int(k[5:])
        for _ in range(3):
            m -= 1
            if m == 0:
                y, m = y - 1, 12
            kk = '%04d-%02d' % (y, m)
            if kk in d:
                return d[kk]
        return None

    def price(self, item, date, area='0000'):
        it = self.items.get(item)
        if not it:
            return None
        return self._at('APU' + (area or '0000') + it['bls'], date) or (self._at('APU0000' + it['bls'], date) if area != '0000' else None)

    def index(self, sid, date):
        return self._at(sid, date)


def frac(date):
    y = int(date[:4]); m = int(date[5:7]) if len(date) >= 7 else 6.5; dd = int(date[8:10]) if len(date) >= 10 else 15
    return round(y + (m - 1) / 12 + (dd - 1) / 365, 3)


def run(posts_doc, cfg, off, quiet=False):
    items = cfg['items']
    O = Official(off, items)
    checks, rows, graded = [], [], []
    fatal = []

    def add(post, code, result, msg, level='post', obs=None):
        checks.append({'post': post, 'check': code, 'result': result, 'msg': msg, 'level': level, **({'obs': obs} if obs is not None else {})})

    seen = {}
    for p in posts_doc['posts']:
        pid = p.get('id', '?')
        rv = p.get('review') or {}
        # ---- schema
        bad = []
        for f in ('id', 'kind', 'title', 'platform', 'posted', 'url', 'claim', 'sources', 'obs', 'review'):
            if f not in p:
                bad.append('missing ' + f)
        if not DATE_RE.match(str(p.get('posted', ''))):
            bad.append('bad posted date')
        for i, o in enumerate(p.get('obs', [])):
            if not DATE_RE.match(str(o.get('date', ''))):
                bad.append('obs %d: bad date' % i)
            if not isinstance(o.get('price'), (int, float)) or not (0 < o['price'] < 500):
                bad.append('obs %d: bad price' % i)
            if o.get('item') and o['item'] not in O.items:
                bad.append('obs %d: unknown item %s' % (i, o['item']))
            if not isinstance(o.get('src'), int) or not (0 <= o['src'] < len(p.get('sources', []))):
                bad.append('obs %d: no source' % i)
            if o.get('hi') is not None and o['hi'] < o['price']:
                bad.append('obs %d: range upside down' % i)
        for t in p.get('totals', []):
            if not DATE_RE.match(str(t.get('date', ''))) or not isinstance(t.get('amount'), (int, float)):
                bad.append('bad total')
        if bad:
            add(pid, 'schema', 'fail', '; '.join(bad)); fatal.append(pid + ': ' + '; '.join(bad))
            continue
        add(pid, 'schema', 'pass', 'record is well formed')
        # ---- source
        srcs = [s for s in p['sources'] if str(s.get('url', '')).startswith('http')]
        if not srcs:
            add(pid, 'source', 'fail', 'no source with a link'); fatal.append(pid + ': no source')
            continue
        pubs = len({s['publisher'] for s in srcs})
        add(pid, 'source', 'pass' if pubs >= 2 else 'warn', '%d source%s' % (pubs, '' if pubs == 1 else 's') + ('' if pubs >= 2 else ': a single source'))
        fails, warns = [], []
        # ---- sum
        for t in p.get('totals', []):
            lines = [o for o in p['obs'] if o['date'] == t['date'] and not o.get('check')]
            if t.get('n') and len(lines) == t['n'] and not t.get('approx'):
                s = round(sum(o['price'] for o in lines), 2)
                if abs(s - t['amount']) <= 0.011:
                    add(pid, 'sum', 'pass', '%d lines dated %s add to the printed $%.2f' % (len(lines), t['date'], t['amount']))
                else:
                    add(pid, 'sum', 'fail', 'lines dated %s add to $%.2f, the receipt prints $%.2f' % (t['date'], s, t['amount'])); fails.append('the lines do not add to the total')
            elif t.get('n') and lines:
                add(pid, 'sum', 'skip', '%d of %s lines read for %s: the total cannot be re-added' % (len(lines), t['n'], t['date']))
        # ---- store, codes, ai
        sc = rv.get('store_check')
        fabricated = []
        if sc == 'not found':
            add(pid, 'store', 'fail', rv.get('store_note', 'store not found')); fabricated.append('the store does not exist')
        elif sc == 'found':
            add(pid, 'store', 'pass', rv.get('store_note', 'store exists'))
        elif sc == 'unknown':
            add(pid, 'store', 'skip', 'store not shown or not traced')
        if rv.get('codes_reused'):
            add(pid, 'codes', 'fail', rv.get('codes_note', 'product codes reused')); fabricated.append('product codes are reused or do not exist')
        if rv.get('ai_label'):
            add(pid, 'ai', 'fail', rv['ai_label']); fabricated.append('labelled or detected as AI-generated')
        # ---- dup
        for t in p.get('totals', []):
            k = (t['amount'], t.get('n'), t['date'])
            if k in seen and seen[k] != pid:
                add(pid, 'dup', 'warn', 'same total, item count and date as ' + seen[k]); warns.append('duplicate of ' + seen[k])
            seen.setdefault(k, pid)
        area = (p.get('store') or {}).get('region') or '0000'
        # ---- band
        obs_res = {}
        for i, o in enumerate(p['obs']):
            fl = []
            unit = None
            ref = None; ratio = None
            if o.get('item') and o.get('qty'):
                unit = o['price'] / o['qty']
                ref = O.price(o['item'], o['date'], area) if O.loaded else None
                if ref:
                    ratio = unit / ref
                    nm = O.items[o['item']]
                    if ratio > 2.5:
                        res = 'fail'; fl.append('implausible')
                    elif ratio > 1.6:
                        res = 'warn'; fl.append('well above average')
                    elif ratio < 0.4:  # cheap is not suspicious by itself (store brands, bulk bags): flagged, never failed
                        res = 'warn'; fl.append('well below average')
                    else:
                        res = 'pass'
                    add(pid, 'band', res, '%s, %s: $%.2f per %s is %.2fx the official average ($%.2f)' % (o['label'], o['date'], unit, nm['unit'], ratio, ref), 'price', i)
                    if res == 'fail' and not o.get('check'):
                        fails.append('%s at $%.2f is %.1fx the official average' % (o['label'], o['price'], ratio))
                elif O.loaded:
                    add(pid, 'band', 'skip', '%s, %s: no official figure for that date' % (o['label'], o['date']), 'price', i)
            if o.get('hi'):
                fl.append('range')
            if o.get('approx'):
                fl.append('approximate')
            if len(o['date']) == 4:
                fl.append('year only')
            if o.get('item') and not o.get('qty'):
                fl.append('size unknown')
            obs_res[i] = {'unit': unit, 'ref': ref, 'ratio': ratio, 'flags': fl}
        # ---- pair
        if p.get('pairs'):
            groups = {}
            for i, o in enumerate(p['obs']):
                k = o.get('item') or re.sub(r'\s*\(.*\)$', '', o['label']).lower()
                if o.get('item'):
                    k = o['item'] + '|' + re.sub(r'\s*\(.*\)$', '', o['label']).lower().split(',')[0]
                groups.setdefault(k, []).append((i, o))
            # also pair on item alone when labels differ
            byitem = {}
            for i, o in enumerate(p['obs']):
                if o.get('item'):
                    byitem.setdefault(o['item'], []).append((i, o))
            done = set()
            for k, g in list(byitem.items()) + list(groups.items()):
                g = sorted(g, key=lambda x: x[1]['date'])
                nc = [x for x in g if not x[1].get('check')]
                if len(nc) >= 2 and nc[0][1]['date'][:4] != nc[-1][1]['date'][:4]:
                    g = nc
                if len(g) < 2 or g[0][1]['date'][:4] == g[-1][1]['date'][:4]:
                    continue
                (i0, a), (i1, b) = g[0], g[-1]
                if (i0, i1) in done:
                    continue
                done.add((i0, i1))
                rise = b['price'] / a['price']
                orat = None; basis = None
                if a.get('item') and O.loaded:
                    x, y = O.price(a['item'], a['date'], area), O.price(a['item'], b['date'], area)
                    if x and y:
                        orat = y / x; basis = 'the official average for ' + O.items[a['item']]['name'].lower()
                if orat is None and O.loaded:
                    x, y = O.index('CUUR0000SAF11', a['date']), O.index('CUUR0000SAF11', b['date'])
                    if x and y:
                        orat = y / x; basis = 'grocery prices overall'
                if orat is None:
                    add(pid, 'pair', 'skip', '%s: %s to %s is %.2fx; no official series to compare' % (a['label'], a['date'], b['date'], rise), 'price', i1)
                    continue
                kk = rise / orat
                loose = basis == 'grocery prices overall'
                if kk > (3 if loose else 2) or kk < (0.3 if loose else 0.4):
                    res = 'fail'
                elif kk > (2 if loose else 1.5) or kk < (0.5 if loose else 0.6):
                    res = 'warn'
                else:
                    res = 'pass'
                add(pid, 'pair', res, '%s: up %.2fx from %s to %s; %s rose %.2fx' % (a['label'], rise, a['date'], b['date'], basis, orat), 'price', i1)
                if res != 'pass':
                    obs_res[i1]['flags'].append('rise %.1fx official' % kk)
                if res == 'fail' and not b.get('check'):
                    fails.append('%s rose %.1fx, against %.1fx for %s' % (a['label'], rise, orat, basis))
        # ---- basket
        bc = p.get('basket_claim')
        bres = None
        if bc:
            claimed = bc.get('pct') if bc.get('pct') is not None else (bc['new'] / bc['old'] - 1) * 100
            x, y = (O.index('CUUR0000SAF11', bc['from']), O.index('CUUR0000SAF11', bc['to'])) if O.loaded else (None, None)
            if x and y:
                offp = (y / x - 1) * 100
                diff = claimed - offp
                small = bc.get('old') is not None and bc['old'] < 30  # a handful of items can move far from the average honestly
                if abs(diff) > 25 and (claimed * offp < 0 or abs(claimed) > 2 * max(abs(offp), 1)) and not small:
                    res = 'fail'
                elif abs(diff) > 12:
                    res = 'warn'
                else:
                    res = 'pass'
                bres = {'claimed': round(claimed, 1), 'official': round(offp, 1), 'result': res, 'from': bc['from'], 'to': bc['to']}
                add(pid, 'basket', res, 'cart %+.1f%% from %s to %s; official grocery prices %+.1f%%' % (claimed, bc['from'], bc['to'], offp))
                if res == 'fail':
                    fails.append('the cart moved %+.0f%% while grocery prices moved %+.0f%%' % (claimed, offp))
                elif res == 'warn':
                    warns.append('the cart moved %+.0f%% against %+.0f%% for grocery prices' % (claimed, offp))
            else:
                bres = {'claimed': round(claimed, 1), 'official': None, 'result': 'skip', 'from': bc['from'], 'to': bc['to']}
                add(pid, 'basket', 'skip', 'cart %+.1f%%; official series not loaded for those months' % claimed)
        # ---- feed: the official feed against figures published elsewhere
        for c in rv.get('counter', []):
            if 'Bureau of Labor Statistics' in c.get('what', '') and O.loaded and not O.mock:
                v = O.price(c['item'], c['date'], '0000')
                if v is None:
                    add(pid, 'feed', 'skip', 'no official %s for %s yet' % (c['item'], c['date']))
                elif abs(v - c['price']) <= 0.03:
                    add(pid, 'feed', 'pass', 'official %s for %s is $%.2f, as published ($%.2f)' % (c['item'], c['date'], v, c['price']))
                else:
                    add(pid, 'feed', 'fail', 'official %s for %s reads $%.2f here; published as $%.2f' % (c['item'], c['date'], v, c['price']))
                    fatal.append('feed: %s %s reads %.2f, published %.2f' % (c['item'], c['date'], v, c['price']))
        # ---- grade
        why = []
        if fabricated:
            g = 'F'; why = fabricated + fails
        elif rv.get('disputed') or fails:
            g = 'D'; why = ([(rv.get('factcheck') or {}).get('verdict')] if rv.get('disputed') and rv.get('factcheck') else []) + fails
        elif rv.get('reporter_priced') or (rv.get('primary_document') and rv.get('full_method')):
            g = 'A'; why = ['priced by reporters' if rv.get('reporter_priced') else 'receipt published with an item-by-item method']
        elif rv.get('primary_document') and (rv.get('outlets') or 0) >= 2:
            g = 'B'; why = ['full document public, read by %d outlets' % rv['outlets']]
        else:
            g = 'C'; why = [rv.get('document_note') or 'single source']
        why = [w for w in why if w] + warns
        fc = rv.get('factcheck')
        graded.append({'id': pid, 'grade': g, 'grade_name': GRADE_NAME[g], 'why': why, 'title': p['title'], 'kind': p['kind'], 'platform': p['platform'], 'account': p.get('account'),
                       'posted': p['posted'], 'url': p['url'], 'claim': p['claim'], 'store': p.get('store'), 'totals': p.get('totals', []), 'basket': bres, 'basket_who': (bc or {}).get('who'), 'basket_note': (bc or {}).get('note'),
                       'factcheck': fc, 'notes': [rv.get(k) for k in ('store_note', 'codes_note', 'ai_label', 'document_note', 'disputed_replies', 'outside_scope', 'todo') if rv.get(k)],
                       'counter_total': rv.get('counter_total'), 'counter': rv.get('counter', []), 'sources': p['sources'], 'n_obs': len(p['obs']), 'outside': bool(rv.get('outside_scope'))})
        # ---- rows
        for i, o in enumerate(p['obs']):
            r = obs_res[i]
            og = 'A' if o.get('check') else g
            if 'implausible' in r['flags'] and o.get('check'):
                og = 'D'
            tier = 'solid' if og in 'AB' else 'unverified' if og == 'C' else 'rejected'
            s = p['sources'][o['src']]
            rows.append({'id': '%s:%d' % (pid, i), 'post': pid, 'item': o.get('item'), 'label': o['label'], 'date': o['date'], 't': frac(o['date']), 'price': o['price'], 'hi': o.get('hi'), 'qty': o.get('qty'),
                         'unit_price': round(r['unit'], 4) if r['unit'] else None, 'official': round(r['ref'], 3) if r['ref'] else None, 'ratio': round(r['ratio'], 3) if r['ratio'] else None,
                         'grade': og, 'tier': tier, 'kind': 'price check' if o.get('check') else 'receipt line', 'flags': r['flags'], 'note': o.get('note'), 'source': s['publisher'], 'source_url': s['url']})
    return {'checks': checks, 'rows': rows, 'posts': graded, 'fatal': fatal, 'official': O}


def selftest(cfg):
    """The checker against cases with known answers, on a tiny made-up official feed."""
    off = {'series': {'APU0000708111': {'2002-04': 1.03, '2026-09': 2.27, '2026-10': 2.30}, 'APU0000709112': {'2002-04': 2.75, '2026-10': 4.10},
                      'CUUR0000SAF11': {'2002-04': 175.0, '2022-06': 290.0, '2024-06': 305.0, '2026-10': 330.0}}}
    src = [{'publisher': 'test', 'url': 'http://x'}]
    base = {'kind': 't', 'title': 't', 'platform': 't', 'posted': '2026-01-01', 'url': 'http://x', 'claim': 't', 'sources': src}
    cases = {'posts': [
        dict(base, id='fake', pairs=True, review={'store_check': 'not found'}, totals=[{'date': '2026-10-01', 'amount': 15.47, 'n': 2}],
             obs=[{'item': 'eggs', 'label': 'Eggs', 'date': '2002-04-06', 'price': 1.29, 'qty': 1, 'src': 0}, {'item': 'eggs', 'label': 'Eggs', 'date': '2026-10-01', 'price': 9.48, 'qty': 1, 'src': 0}, {'item': 'milk', 'label': 'Milk', 'date': '2026-10-01', 'price': 5.99, 'qty': 1, 'src': 0}]),
        dict(base, id='badsum', review={}, totals=[{'date': '2026-10-01', 'amount': 9.99, 'n': 1}], obs=[{'item': 'milk', 'label': 'Milk', 'date': '2026-10-01', 'price': 4.00, 'qty': 1, 'src': 0}]),
        dict(base, id='real', review={'reporter_priced': True}, totals=[], obs=[{'item': 'eggs', 'label': 'Eggs', 'date': '2026-10-01', 'price': 1.67, 'qty': 1, 'src': 0}]),
        dict(base, id='reorder', review={}, totals=[], obs=[], basket_claim={'from': '2022-06', 'to': '2024-06', 'old': 126.67, 'new': 414.39}),
    ]}
    r = run(cases, cfg, off, quiet=True)
    g = {p['id']: p['grade'] for p in r['posts']}
    res = lambda post, code: [c['result'] for c in r['checks'] if c['post'] == post and c['check'] == code]
    tests = [
        ('a made-up receipt is graded F', g.get('fake') == 'F'),
        ('eggs at 4x the official price fail the band check', 'fail' in res('fake', 'band')),
        ('a 7x rise against a 2x official rise fails the pair check', 'fail' in res('fake', 'pair')),
        ('lines that add to the printed total pass', res('fake', 'sum') == ['pass']),
        ('lines that do not add to the total fail', res('badsum', 'sum') == ['fail'] and g.get('badsum') == 'D'),
        ('a real reporter-priced item passes and is graded A', g.get('real') == 'A' and res('real', 'band') == ['pass']),
        ('a cart that triples while groceries rise 5% fails', res('reorder', 'basket') == ['fail'] and g.get('reorder') == 'D'),
    ]
    bad = dict(base, id='broken', review={}, totals=[], obs=[{'item': 'unicorn', 'label': 'x', 'date': 'last week', 'price': -1, 'src': 4}])
    r2 = run({'posts': [bad]}, cfg, off, quiet=True)
    tests.append(('a malformed record stops the build', bool(r2['fatal'])))
    return [{'test': t, 'ok': bool(ok)} for t, ok in tests]


def main():
    cfg = json.load(open(os.path.join(DATA, 'items.json')))
    doc = json.load(open(os.path.join(DATA, 'posts.json')))
    op = os.path.join(DATA, 'official.json')
    off = json.load(open(op)) if os.path.exists(op) else None
    st = selftest(cfg)
    r = run(doc, cfg, off)
    O = r['official']
    fatal = list(r['fatal']) + ['self-test: ' + t['test'] for t in st if not t['ok']]
    # canaries: with the real feed loaded, the known fake must fail on the numbers alone and the known real price must pass
    canary = []
    if O.loaded and not O.mock:
        fk = [c for c in r['checks'] if c['post'] == 'fl-2002-2026' and c['check'] in ('band', 'pair') and c['result'] == 'fail']
        canary.append({'test': 'the Sunset Bay receipts fail on prices alone (%d failed checks)' % len(fk), 'ok': len(fk) >= 2})
        ok = [x for x in r['rows'] if x['post'] == 'fl-2002-2026' and x['kind'] == 'price check' and x['ratio'] and 0.4 <= x['ratio'] <= 1.6]
        canary.append({'test': "Lead Stories' Walmart.com egg price sits inside the official band", 'ok': bool(ok)})
        fatal += ['canary: ' + c['test'] for c in canary if not c['ok']]
    built = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ')
    summ = {k: sum(1 for c in r['checks'] if c['result'] == k) for k in ('pass', 'warn', 'fail', 'skip')}
    tiers = {k: sum(1 for x in r['rows'] if x['tier'] == k) for k in ('solid', 'unverified', 'rejected')}
    grades = {g: sum(1 for p in r['posts'] if p['grade'] == g) for g in 'ABCDF'}
    audit = {'built': built, 'official_loaded': O.loaded, 'official_mock': O.mock, 'official_fetched': (off or {}).get('fetched'), 'summary': summ, 'tiers': tiers, 'grades': grades,
             'selftest': st, 'canary': canary, 'fatal': fatal, 'feed_log': (off or {}).get('log', []), 'feed_rejected': (off or {}).get('rejected', []), 'feed_routes': sorted(set(str(v).split(' ')[0] for v in ((off or {}).get('routes') or {}).values())),
             'posts': [{'id': p['id'], 'grade': p['grade'], 'why': p['why']} for p in r['posts']], 'checks': r['checks']}
    json.dump(audit, open(os.path.join(DATA, 'audit.json'), 'w'), indent=1)
    json.dump({'built': built, 'tiers': tiers, 'rows': r['rows']}, open(os.path.join(DATA, 'db.json'), 'w'), indent=1)

    # ---- view.json for the page and the 3-D stage
    items = cfg['items']; areas = list(cfg['areas'])
    view = {'built': built, 'mock': O.mock, 'official': O.loaded, 'start': START, 'areas': cfg['areas'], 'items': [], 'indexes': {}, 'posts': r['posts'], 'rows': r['rows'],
            'leads': doc.get('leads', []), 'target': doc.get('target', 50), 'summary': summ, 'tiers': tiers, 'grades': grades, 'selftest': st, 'canary': canary,
            'fetched': (off or {}).get('fetched'), 'routes': audit['feed_routes'], 'titles': (off or {}).get('titles', {})}
    if O.loaded:
        allm = sorted({k for s, d in O.s.items() if s.startswith('APU0000') for k in d})
        last = allm[-1]
        view['last'] = last
        y1 = int(last[:4]); m1 = int(last[5:])
        months = ['%04d-%02d' % (y, m) for y in range(START, y1 + 1) for m in range(1, 13) if (y, m) <= (y1, m1)]
        view['n_months'] = len(months)
        for it in items:
            nat = O.s.get('APU0000' + it['bls'])
            if not nat:
                continue
            arr = [nat.get(k) for k in months]
            first = next((i for i, v in enumerate(arr) if v is not None), None)
            lasti = max(i for i, v in enumerate(arr) if v is not None)
            reg = {}
            for a in areas[1:]:
                d = O.s.get('APU' + a + it['bls'])
                if d:
                    ann = []
                    for y in range(START, y1 + 1):
                        v = [d[k] for k in d if k.startswith(str(y))]
                        ann.append(round(sum(v) / len(v), 3) if v else None)
                    reg[a] = ann
            ya = [k for k in nat if k[:4] == str(y1 - 1) and k[5:] == last[5:]]
            view['items'].append({'id': it['id'], 'name': it['name'], 'long': it['long'], 'unit': it['unit'], 'basket': it['basket'], 'm': [None if v is None else round(v, 3) for v in arr],
                                  'first': first, 'last': lasti, 'regions': reg, 'now': arr[lasti], 'now_month': months[lasti], 'year_ago': nat.get('%04d-%s' % (int(months[lasti][:4]) - 1, months[lasti][5:])),
                                  'then': arr[first], 'then_month': months[first], 'y2019': O.price(it['id'], '2019'), 'current': lasti >= len(months) - 4})
        for ix in cfg['indexes']:
            d = O.s.get(ix['bls'])
            if d:
                view['indexes'][ix['id']] = {'name': ix['name'], 'm': [d.get(k) for k in months]}
        # the fixed basket: items priced every month from the first month all of them exist
        bk = [i for i in view['items'] if i['basket'] and i['first'] is not None and i['first'] <= 12 and i['current']]
        if bk:
            f0 = max(i['first'] for i in bk)
            cost = []
            for k in range(len(months)):
                if k < f0 or any(i['m'][k] is None for i in bk):
                    # carry the last known price across a missing month (BLS skipped October 2025 collection, for one)
                    if k >= f0:
                        vals = []
                        for i in bk:
                            j = k
                            while j >= 0 and i['m'][j] is None:
                                j -= 1
                            vals.append(i['m'][j] * i['basket'] if j >= 0 else None)
                        cost.append(round(sum(vals), 2) if all(v is not None for v in vals) else None)
                    else:
                        cost.append(None)
                else:
                    cost.append(round(sum(i['m'][k] * i['basket'] for i in bk), 2))
            view['basket'] = {'items': [{'id': i['id'], 'name': i['name'], 'qty': i['basket'], 'unit': i['unit']} for i in bk], 'm': cost, 'first': f0}
    json.dump(view, open(os.path.join(DATA, 'view.json'), 'w'), separators=(',', ':'))
    print('checks: %(pass)d pass, %(warn)d warn, %(fail)d fail, %(skip)d skipped' % summ, '| prices:', tiers, '| posts:', grades, '| official:', 'mock' if O.mock else O.loaded)
    for t in st + canary:
        print(('  ok   ' if t['ok'] else '  FAIL ') + t['test'])
    if fatal:
        print('STOP:\n  ' + '\n  '.join(fatal)); sys.exit(1)


if __name__ == '__main__':
    main()
