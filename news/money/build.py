#!/usr/bin/env python3
"""Builds The Watch's "Who paid for it" pages (news/money/) from data/money.json (fetch.py), the wave's results data
and the pieces Claude wrote (data/reports/, data/donors/; write.py). Writes index.html, one page per state with a
written piece, data/flow.json (the animated money flow, drawn by money.js) and pages.json."""
import json, os, re, sys, html, math, datetime as dt, collections
HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, 'data'); WAVE = os.path.normpath(os.path.join(HERE, '..', 'wave'))
sys.path.insert(0, os.path.join(WAVE, 'tools'))
PUBLIC = 'https://bboldt86.github.io/lanscape-navigator/news/money/'

def load(p, default=None):
    try: return json.load(open(p, encoding='utf-8'))
    except FileNotFoundError: return default
def esc(s): return html.escape(str(s if s is not None else ''), quote=True)
def usd(v, short=True):
    v = float(v or 0)
    if not short: return f'${v:,.0f}'
    if abs(v) >= 1e9: return f'${v / 1e9:.1f}B'
    if abs(v) >= 1e6: return f'${v / 1e6:.1f}M'
    if abs(v) >= 1e3: return f'${v / 1e3:.0f}K'
    return f'${v:.0f}'
def n(v): return f'{float(v or 0):,.0f}'
def geo_short(g):
    g = (g or '').split(',')[0].strip(); g = re.sub(r'^\d{5}$', 'zip codes', g); return g[:22]
def spend_range(x): return (f'≥{usd(x["lo"])}' if not x.get('hi') or x['hi'] < x['lo'] else f'{usd(x["lo"])}–{usd(x["hi"])}')
def when(iso):
    try: return dt.datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone(dt.timezone(dt.timedelta(hours=-5))).strftime('%b. %-d, %Y')
    except Exception: return ''
def title_case(s): return re.sub(r"\b([A-Z])([A-Z']+)\b", lambda m: m.group(1) + m.group(2).lower(), s or '') if (s or '').isupper() else (s or '')
NAME = {'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'Washington, D.C.'}
SLUG = {st: nm.lower().replace(' ', '-').replace(',', '').replace('.', '') for st, nm in NAME.items()}
MODEL_NAME = {'claude-opus-5-5': 'Claude Opus 5.5', 'claude-sonnet-5-5': 'Claude Sonnet 5.5'}

M = load(os.path.join(DATA, 'money.json'))
if not M: M = {'candidates': {}, 'ie': [], 'committees': {}, 'donors': {}, 'platforms': {}, 'google_ads': {}, 'fetched': None, 'nodata': True}; print('no data/money.json yet: building the pages without the FEC data')
NIGHT = load(os.path.join(WAVE, 'data', 'night.json'), {}); SHIFT = load(os.path.join(WAVE, 'data', 'shift.json'), {})
RACES = {r['id']: r for r in NIGHT.get('races', [])}
REPORTS = {}
for f in os.listdir(os.path.join(DATA, 'reports')) if os.path.isdir(os.path.join(DATA, 'reports')) else []:
    if f.endswith('.json') and not f.startswith('_failed'): r = load(os.path.join(DATA, 'reports', f)); REPORTS[f[:-5]] = r if r and r.get('headline') else None
REPORTS = {k: v for k, v in REPORTS.items() if v}
USREP = REPORTS.pop('_US', None)
DONOR_PIECES = {}
for f in os.listdir(os.path.join(DATA, 'donors')) if os.path.isdir(os.path.join(DATA, 'donors')) else []:
    if f.endswith('.json'): r = load(os.path.join(DATA, 'donors', f)); DONOR_PIECES[f[:-5]] = r if r and r.get('text') else None
built = dt.datetime.now(dt.timezone(dt.timedelta(hours=-5)))
FETCHED = when(M.get('fetched')) if M.get('fetched') else 'not yet'; MOCK = M.get('mock')
C = M['candidates']; IE = M['ie']

# ---------- the sums ----------
def side_of(party): return 'D' if (party or '').upper().startswith('D') else 'R' if (party or '').upper().startswith('R') else 'I'
def helps(row):
    """Which side a row of outside spending helps: support for a Democrat or opposition to a Republican helps D."""
    p = side_of(C.get(row['cand'], {}).get('party'));
    if p == 'I': p = 'D'  # the independents in the Senate races ran on the Democratic side
    return p if row['so'] == 'S' else ('R' if p == 'D' else 'D')
def cand_label(cid):
    c = C.get(cid) or {}; nm = c.get('name') or cid
    if ',' in nm: last, first = [x.strip() for x in nm.split(',', 1)]; nm = f"{title_case(first.split()[0]) if first else ''} {title_case(last)}".strip()
    return nm
def race_key(c):
    return c.get('race') or (f"{c['st']}-G-{c['office']}-{c.get('district')}-2026-11-03" if c['office'] == 'H' else f"{c['st']}-G-S-2026-11-03")

races = {}
for row in IE:
    c = C.get(row['cand'])
    if not c: continue
    k = race_key(c); r = races.setdefault(k, {'id': k, 'st': c['st'], 'office': c['office'], 'district': c.get('district'), 'D': 0.0, 'R': 0.0, 'total': 0.0, 'cands': {}, 'cmtes': collections.Counter(), 'rows': []})
    side = helps(row); r[side] += row['total']; r['total'] += row['total']; r['cmtes'][row['cmte']] += row['total']; r['rows'].append(row)
    cc = r['cands'].setdefault(row['cand'], {'id': row['cand'], 'name': cand_label(row['cand']), 'party': side_of(c.get('party')), 'support': 0.0, 'oppose': 0.0, 'won': c.get('won'), 'receipts': c.get('receipts', 0)})
    cc['support' if row['so'] == 'S' else 'oppose'] += row['total']
for k, r in races.items():
    res = RACES.get(k) or {}; r['winner'] = res.get('p'); r['won'] = res.get('won') or []; r['votes'] = res.get('t') or 0; r['called'] = res.get('at') is not None
    r['d_votes'] = res.get('d'); r['r_votes'] = res.get('r'); r['margin'] = ((res.get('d') or 0) - (res.get('r') or 0)) / r['votes'] * 100 if r['votes'] else None
    r['money_side'] = 'D' if r['D'] > r['R'] else 'R' if r['R'] > r['D'] else None
    r['money_won'] = (r['money_side'] == r['winner']) if (r['money_side'] and r['winner']) else None
    r['per_vote'] = r['total'] / r['votes'] if r['votes'] else None
    r['label'] = f"{NAME.get(r['st'], r['st'])} {'Senate' if r['office'] == 'S' else 'House ' + str(r['district'])}"
    for cc in r['cands'].values():
        if cc['won'] is None and r['won']: cc['won'] = any(w.split()[-1].upper() == cc['name'].split()[-1].upper() for w in r['won'])
SEN = sorted([r for r in races.values() if r['office'] == 'S'], key=lambda r: -r['total'])
HOUSE = sorted([r for r in races.values() if r['office'] == 'H'], key=lambda r: -r['total'])[:40]
TOTAL_IE = sum(r['total'] for r in races.values()); TOTAL_SEN = sum(r['total'] for r in SEN)

# committees: what they spent, which side, their record
cm = {}
for row in IE:
    c = cm.setdefault(row['cmte'], {'id': row['cmte'], 'name': title_case(row['cmte_name'] or row['cmte']), 'total': 0.0, 'D': 0.0, 'R': 0.0, 'races': {}, 'won': 0, 'lost': 0, 'open': 0})
    c['total'] += row['total']; c[helps(row)] += row['total']
    k = race_key(C.get(row['cand'], {'st': row['cand'][2:4], 'office': row['cand'][0]})); rr = c['races'].setdefault(k, {'id': k, 'usd': 0.0, 'side': helps(row)}); rr['usd'] += row['total']
for c in cm.values():
    c['side'] = 'D' if c['D'] > c['R'] * 3 else 'R' if c['R'] > c['D'] * 3 else 'M'
    for k, rr in c['races'].items():
        r = races.get(k); rr['label'] = r['label'] if r else k
        if not r or not r['winner']: rr['won'] = None; c['open'] += 1
        else: rr['won'] = (rr['side'] == r['winner']); c['won' if rr['won'] else 'lost'] += 1
    c['races'] = sorted(c['races'].values(), key=lambda x: -x['usd'])
CM = sorted(cm.values(), key=lambda c: -c['total'])

# donors: across committees, by name
dn = {}
for cid, rows in (M.get('donors') or {}).items():
    for d in rows:
        if d['entity'] in ('PAC', 'COM', 'PTY') and 'ACTBLUE' not in d['name'].upper() and 'WINRED' not in d['name'].upper(): pass
        key = re.sub(r'[^A-Z0-9]', '', d['name'].upper())[:28]
        x = dn.setdefault(key, {'key': key, 'name': d['name'], 'employer': d.get('employer') or '', 'occupation': d.get('occupation') or '', 'state': d.get('state') or '', 'entity': d.get('entity') or '', 'total': 0.0, 'to': {}})
        x['total'] += d['amount']; x['to'][cid] = x['to'].get(cid, 0) + d['amount']
for x in dn.values():
    x['to'] = sorted(({'id': c, 'name': cm[c]['name'] if c in cm else (M['committees'].get(c) or {}).get('name') or c, 'usd': v, 'side': cm[c]['side'] if c in cm else 'M'} for c, v in x['to'].items()), key=lambda t: -t['usd'])
    dside = sum(t['usd'] for t in x['to'] if t['side'] == 'D'); rside = sum(t['usd'] for t in x['to'] if t['side'] == 'R')
    x['side'] = 'D' if dside > rside * 3 else 'R' if rside > dside * 3 else 'M'
    seats = {}
    for t in x['to']:
        for rr in (cm.get(t['id']) or {}).get('races', []):
            s = seats.setdefault(rr['id'], {'id': rr['id'], 'label': rr['label'], 'side': rr['side'], 'won': rr['won'], 'via': set()}); s['via'].add(t['name'])
    x['seats'] = sorted(seats.values(), key=lambda s: (s['won'] is None, s['label']))
    for s in x['seats']: s['via'] = sorted(s['via'])
    x['won'] = sum(1 for s in x['seats'] if s['won']); x['lost'] = sum(1 for s in x['seats'] if s['won'] is False); x['open'] = sum(1 for s in x['seats'] if s['won'] is None)
    x['kind'] = 'company' if (x['entity'] in ('ORG',) or (not x['occupation'] and x['employer'] == '' and re.search(r'\b(INC|LLC|CORP|LP|LTD|CO|HOLDINGS|GROUP|PAC|TRUST)\b', x['name'].upper()))) else 'person' if x['entity'] == 'IND' else 'group'
DONORS = sorted(dn.values(), key=lambda x: -x['total'])
PL = M.get('platforms') or {}; GA = M.get('google_ads') or {}

# ---------- charts (inline SVG; the classes are in ../wave/article.css) ----------
def diverging(rs, title, note, limit=20):
    """Money for the Democratic side (left, blue) and the Republican side (right, red) of each race, with the result."""
    rs = rs[:limit]
    if not rs: return ''
    W, L, R, rowh = 760, 170, 120, 30; H = 26 + rowh * len(rs) + 10; mid = L + (W - L - R) / 2; half = (W - L - R) / 2 - 8
    mx = max(max(r['D'], r['R']) for r in rs) or 1
    out = [f'<figure class="chart wide"><figcaption><b>{esc(title)}</b><span>{esc(note)}</span></figcaption><div class="legend"><span><i class="sw a"></i>for the Democratic side</span><span><i class="sw r"></i>for the Republican side</span><span>✓ the money’s side won</span></div><svg viewBox="0 0 {W} {H}" role="img" aria-label="{esc(title)}">']
    out.append(f'<line class="grid zero" x1="{mid}" x2="{mid}" y1="8" y2="{H - 8}"/>')
    for i, r in enumerate(rs):
        y = 20 + i * rowh; wd = r['D'] / mx * half; wr = r['R'] / mx * half
        res = ('✓' if r['money_won'] else '✗' if r['money_won'] is False else '…')
        out.append(f'<text class="rowl" x="{L - 10}" y="{y + 12}" text-anchor="end">{esc(r["label"])}</text><text class="rowm" x="{L - 10}" y="{y + 25}" text-anchor="end">{esc(("D+" if r["margin"] > 0 else "R+") + f"{abs(r["margin"]):.1f}") if r["margin"] is not None else "not counted"}{", " + ("won by " + (r["won"][0].split()[-1] if r["won"] else r["winner"])) if r["winner"] else ", not called"}</text>')
        out.append(f'<rect class="bar l" x="{mid - wd:.1f}" y="{y + 4}" width="{max(2, wd):.1f}" height="14" rx="4"/><rect class="bar r" x="{mid + 2:.1f}" y="{y + 4}" width="{max(2, wr):.1f}" height="14" rx="4"/>')
        inside_d = wd > half * 0.72; inside_r = wr > half * 0.72
        out.append(f'<text class="val{" in" if inside_d else ""}" x="{(mid - wd + 6) if inside_d else (mid - wd - 6):.1f}" y="{y + 15}" text-anchor="{"start" if inside_d else "end"}">{usd(r["D"])}</text><text class="val{" in" if inside_r else ""}" x="{(mid + wr - 4) if inside_r else (mid + wr + 8):.1f}" y="{y + 15}" text-anchor="{"end" if inside_r else "start"}">{usd(r["R"])}</text><text class="val" x="{mid + half + 12:.1f}" y="{y + 15}"><tspan class="{"ok" if r["money_won"] else "no" if r["money_won"] is False else ""}">{res}</tspan></text>')
    out.append('</svg></figure>')
    return ''.join(out)

def hbars(items, title, note, value='total', label='name', sub=None, cls=lambda x: 'l' if x.get('side') == 'D' else 'r' if x.get('side') == 'R' else 'm', limit=20, wide=False, fmt=usd):
    items = items[:limit]
    if not items: return ''
    W, L, R, rowh = (760 if wide else 440), (200 if wide else 150), 80, 30; H = 16 + rowh * len(items) + 6
    mx = max(x[value] for x in items) or 1
    out = [f'<figure class="chart{" wide" if wide else ""}"><figcaption><b>{esc(title)}</b><span>{esc(note)}</span></figcaption><svg viewBox="0 0 {W} {H}" role="img" aria-label="{esc(title)}">']
    for i, x in enumerate(items):
        y = 10 + i * rowh; w = x[value] / mx * (W - L - R)
        out.append(f'<text class="rowl" x="{L - 10}" y="{y + 12}" text-anchor="end">{esc(x[label][:34])}</text>' + (f'<text class="rowm" x="{L - 10}" y="{y + 25}" text-anchor="end">{esc(sub(x)[:40])}</text>' if sub else ''))
        out.append(f'<rect class="bar {cls(x)}" x="{L}" y="{y + 4}" width="{max(2, w):.1f}" height="14" rx="4"/><text class="val" x="{L + w + 6:.1f}" y="{y + 15}">{fmt(x[value])}</text>')
    out.append('</svg></figure>')
    return ''.join(out)

def monthly(series, title, note, months=None):
    """Grouped bars by month, two series (Meta, Google) — one axis, direct values on the tallest."""
    keys = sorted({m for s in series.values() for m in s})
    keys = [k for k in keys if k >= '2025-01'][-14:]
    if not keys: return ''
    W, H, L, B, T = 760, 300, 54, 40, 24; gw = (W - L - 16) / len(keys); mx = max(max(s.get(k, 0) for k in keys) for s in series.values()) or 1
    sy = lambda v: H - B - v / mx * (H - B - T)
    out = [f'<figure class="chart wide"><figcaption><b>{esc(title)}</b><span>{esc(note)}</span></figcaption><div class="legend">' + ''.join(f'<span><i class="sw {c}"></i>{esc(nm)}</span>' for (nm, c) in zip(series.keys(), ('a', 'b', 'r'))) + f'</div><svg viewBox="0 0 {W} {H}" role="img" aria-label="{esc(title)}">']
    step = 10 ** math.floor(math.log10(mx)); step = step * (5 if mx / step > 5 else 2 if mx / step > 2 else 1)
    v = 0
    while v <= mx: out.append(f'<line class="grid{" zero" if v == 0 else ""}" x1="{L}" x2="{W - 16}" y1="{sy(v):.1f}" y2="{sy(v):.1f}"/><text class="tick" x="{L - 6}" y="{sy(v) + 4:.1f}" text-anchor="end">{usd(v)}</text>'); v += step
    for i, k in enumerate(keys):
        x0 = L + i * gw + 4; bw = (gw - 8) / len(series) - 2
        for j, (nm, s) in enumerate(series.items()):
            val = s.get(k, 0); x = x0 + j * (bw + 2); y = sy(val)
            out.append(f'<rect class="bar {("a", "b", "r")[j]}" x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{max(0, H - B - y):.1f}" rx="3"><title>{esc(nm)}, {k}: {usd(val, False)}</title></rect>')
        out.append(f'<text class="tick" x="{x0 + (gw - 8) / 2:.1f}" y="{H - B + 16}" text-anchor="middle">{dt.datetime.strptime(k, "%Y-%m").strftime("%b %y")}</text>')
    out.append('</svg></figure>')
    return ''.join(out)

def weekly_line(points, title, note):
    pts = [(k, v) for k, v in points if k >= '2025-06-01']
    if len(pts) < 4: return ''
    W, H, L, B, T = 760, 280, 54, 40, 20; mx = max(v for _, v in pts) or 1
    sx = lambda i: L + i / (len(pts) - 1) * (W - L - 16); sy = lambda v: H - B - v / mx * (H - B - T)
    out = [f'<figure class="chart wide"><figcaption><b>{esc(title)}</b><span>{esc(note)}</span></figcaption><svg viewBox="0 0 {W} {H}" role="img" aria-label="{esc(title)}">']
    step = 10 ** math.floor(math.log10(mx)); step = step * (5 if mx / step > 5 else 2 if mx / step > 2 else 1); v = 0
    while v <= mx: out.append(f'<line class="grid{" zero" if v == 0 else ""}" x1="{L}" x2="{W - 16}" y1="{sy(v):.1f}" y2="{sy(v):.1f}"/><text class="tick" x="{L - 6}" y="{sy(v) + 4:.1f}" text-anchor="end">{usd(v)}</text>'); v += step
    path = 'M' + ' L'.join(f'{sx(i):.1f} {sy(v):.1f}' for i, (_, v) in enumerate(pts))
    out.append(f'<path class="line a" d="{path}"/><path class="area a" d="{path} L{sx(len(pts) - 1):.1f} {H - B} L{L} {H - B} Z"/>')
    for i, (k, v) in enumerate(pts):
        if i % max(1, len(pts) // 8) == 0 or i == len(pts) - 1: out.append(f'<text class="tick" x="{sx(i):.1f}" y="{H - B + 16}" text-anchor="middle">{dt.datetime.strptime(k[:10], "%Y-%m-%d").strftime("%b %-d")}</text>')
        out.append(f'<circle class="pt" cx="{sx(i):.1f}" cy="{sy(v):.1f}" r="7"><title>week of {k[:10]}: {usd(v, False)}</title></circle>')
    peak = max(range(len(pts)), key=lambda i: pts[i][1]); out.append(f'<text class="lbl" x="{sx(peak):.1f}" y="{sy(pts[peak][1]) - 10:.1f}" text-anchor="middle">{usd(pts[peak][1])} the week of {dt.datetime.strptime(pts[peak][0][:10], "%Y-%m-%d").strftime("%b %-d")}</text>')
    out.append('</svg></figure>')
    return ''.join(out)

# ---------- the pieces ----------
def md(h):
    """The pieces are asked for plain text; when the model slips in markdown, render the common bits instead of showing the asterisks."""
    h = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', h); h = re.sub(r'(?<![\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])', r'<i>\1</i>', h)
    h = re.sub(r'^[-•]\s+', '• ', h); h = re.sub(r'\n[-•]\s+', '<br>• ', h)
    return h
def render_paras(rep, prefix='src'):
    out = []; first = True
    for p in rep.get('paras') or []:
        if p['t'] == 'h2': out.append(f"<h2>{esc(p['text'])}</h2>"); continue
        t = p['text']; cuts = sorted(p.get('cites') or [], key=lambda c: c[0]); h = ''; pos = 0; pend = []
        def flush():
            nonlocal h, pend
            if pend: h += '<sup>' + ', '.join(f'<a href="#{prefix}-{x}">{x}</a>' for x in sorted(set(pend))) + '</sup>'; pend = []
        for off, src in cuts:
            off = max(pos, min(off, len(t)))
            if off > pos: flush(); h += esc(t[pos:off]); pos = off
            pend.append(src)
        flush(); h += esc(t[pos:])
        h = md(h)
        out.append(f"<p{' class=\"lede\"' if first else ''}>{h}</p>"); first = False
    return ''.join(out)
def sources_list(rep, prefix='src', extra=()):
    srcs = rep.get('sources') or []; k = len(srcs)
    items = [f'<li id="{prefix}-{s["n"]}">{esc(s["title"])}. <a href="{esc(s["url"])}" rel="noopener">{esc(s["url"])}</a></li>' for s in srcs]
    items += [f'<li id="{prefix}-{k + i + 1}">{x}</li>' for i, x in enumerate(extra)]
    return '<ol>' + ''.join(items) + '</ol>'
DATA_SOURCES = [f'Federal Election Commission, OpenFEC API: candidate totals, independent expenditures by candidate (Schedule E), itemized receipts (Schedule A) and disbursements (Schedule B), 2025–2026 cycle, read {FETCHED}. <a href="https://api.open.fec.gov/developers/" rel="noopener">https://api.open.fec.gov/developers/</a>',
                f'Google Ads Transparency Center, political advertising bundle (advertiser weekly spend, geographic spend and creative statistics), read {FETCHED}. <a href="https://adstransparency.google.com/political" rel="noopener">https://adstransparency.google.com/political</a>',
                'AP via The New York Times, 2026 election results (The Watch’s wave data). <a href="../wave/" rel="noopener">https://bboldt86.github.io/lanscape-navigator/news/wave/</a>']
def cast_block(rep):
    """The ADS and PLAYERS lines a state piece carries, as cards."""
    out = []
    ads = rep.get('ads') or []; pl = rep.get('players') or []
    if ads: out.append('<h3 class="k">The ads</h3><div class="ads">' + ''.join(f'<div class="ad"><b>{esc(a.get("sponsor"))}</b><p>{esc(a.get("what"))}</p><small>Paid by {esc(a.get("paid"))}{" · " + esc(a["where"]) if a.get("where") else ""}{f" · <a href=\"{esc(a['url'])}\" rel=\"noopener\">source</a>" if a.get("url") else ""}</small></div>' for a in ads) + '</div>')
    if pl: out.append('<h3 class="k">The players</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>Who</th><th>Role</th><th>Side</th><th>Dollars</th><th></th></tr></thead><tbody>' + ''.join(f'<tr><td><b>{esc(p.get("name"))}</b></td><td>{esc(p.get("role"))}</td><td class="{ "d" if (p.get("side") or "").startswith("D") else "r" if (p.get("side") or "").startswith("R") else ""}">{esc(p.get("side"))}</td><td>{esc(p.get("usd"))}</td><td><small>{esc(p.get("note"))}</small></td></tr>' for p in pl) + '</tbody></table></div>')
    return ''.join(out)

# ---------- shared page chrome ----------
def head(title, dek, slug, published=None, image='share.png'):
    url = PUBLIC + ('' if slug == 'index' else slug + '.html')
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)} · The Watch</title>
<meta name="description" content="{esc(dek)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="The Watch"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(dek)}"><meta property="og:url" content="{esc(url)}">
<meta property="og:image" content="{PUBLIC}{image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%230b1526'/%3E%3Cpath d='M12 44c6-14 10-6 16-16s10 4 16-8 8 2 10 6' fill='none' stroke='%237fc4ff' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../wave/article.css"><link rel="stylesheet" href="money.css">
<script>(function(){{try{{var t=localStorage.getItem('watch.theme')||'auto';var h=new Date().getHours();if(t==='auto'){{t=(h>=20||h<4)?'night':(matchMedia('(prefers-color-scheme: dark)').matches?'night':'day')}}document.documentElement.dataset.theme=t}}catch(e){{}}}})();</script>
</head><body>
<header class="mast"><div class="wrap">
  <a class="back" href="../#/s/politics"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#15243B"/><circle cx="32" cy="32" r="21" fill="none" stroke="#D6B25E" stroke-width="6" stroke-dasharray="19 3"/><path d="M32 32 L46 14" stroke="#F5F7F6" stroke-width="5" stroke-linecap="round"/></svg>The Watch <span>· Politics</span></a>
  <div class="mast-r"><a class="tbtn" href="../wave/">The wave</a><button type="button" class="tbtn" id="shareBtn">Share</button></div>
</div></header>
"""
def foot():
    return f"""<footer class="foot"><div class="narrow"><p>The Watch · Politics. Money: the Federal Election Commission (OpenFEC API), read {FETCHED}; Google Ads Transparency Center; results: AP via The New York Times. The sums are of what is reported and itemized; direct platform payments are a floor, because most digital buys go through vendors. Written pieces by Claude (Opus 5.5) through Anthropic’s API, numbers from the data, web claims cited. Built {built.strftime('%b. %-d, %Y, %-I:%M %p')} ET.</p></div></footer>
<script type="module" src="money.js"></script>
</body></html>"""

# ---------- the flow (for money.js) ----------
def flow():
    top_races = SEN[:14]; race_ids = {r['id'] for r in top_races}
    pacs = [c for c in CM if any(rr['id'] in race_ids for rr in c['races'])][:12]; pac_ids = {c['id'] for c in pacs}
    dons = [d for d in DONORS if any(t['id'] in pac_ids for t in d['to'])][:16]
    nodes = [{'id': 'd:' + d['key'], 'col': 0, 'name': d['name'], 'sub': (d['employer'] or d['occupation'] or d['state'])[:40], 'side': d['side'], 'usd': sum(t['usd'] for t in d['to'] if t['id'] in pac_ids)} for d in dons] + \
            [{'id': 'c:' + c['id'], 'col': 1, 'name': c['name'], 'sub': f"{usd(c['total'])} on {len(c['races'])} races", 'side': c['side'], 'usd': c['total'], 'won': c['won'], 'lost': c['lost']} for c in pacs] + \
            [{'id': 'r:' + r['id'], 'col': 2, 'name': r['label'], 'sub': (('D+' if r['margin'] > 0 else 'R+') + f"{abs(r['margin']):.1f}" if r['margin'] is not None else '') + (', ' + (r['won'][0].split()[-1] if r['won'] else '') if r['won'] else ', not called'), 'side': r['winner'] or 'M', 'usd': r['total'], 'moneyWon': r['money_won'], 'moneySide': r['money_side']} for r in top_races]
    links = [{'s': 'd:' + d['key'], 't': 'c:' + t['id'], 'usd': t['usd'], 'side': t['side']} for d in dons for t in d['to'] if t['id'] in pac_ids] + \
            [{'s': 'c:' + c['id'], 't': 'r:' + rr['id'], 'usd': rr['usd'], 'side': rr['side']} for c in pacs for rr in c['races'] if rr['id'] in race_ids]
    return {'v': 1, 'asOf': M.get('fetched'), 'nodes': nodes, 'links': links, 'totals': {'ie': TOTAL_IE, 'senate': TOTAL_SEN, 'races': len(races), 'meta': (PL.get('meta') or {}).get('total_itemized', 0), 'google': (PL.get('google') or {}).get('total_itemized', 0), 'gads': sum(v for _, v in (GA.get('weekly_total') or [])), 'topDonor': DONORS[0]['name'] if DONORS else '', 'topDonorUsd': DONORS[0]['total'] if DONORS else 0, 'moneyWon': sum(1 for r in SEN if r['money_won']), 'moneyLost': sum(1 for r in SEN if r['money_won'] is False)}}

# ---------- the main page ----------
def main_page():
    money_won = sum(1 for r in SEN if r['money_won']); money_lost = sum(1 for r in SEN if r['money_won'] is False); decided = money_won + money_lost
    title = USREP['headline'] if USREP else 'Who paid for it'
    dek = USREP['dek'] if USREP else f"{usd(TOTAL_IE)} of outside money went into the Senate and House races, from a few hundred donors through a few dozen committees. The side with more of it won {money_won} of the {decided} decided Senate races. Here is where it came from, where it went, and what it bought."
    per_state = sorted(((st, rep) for st, rep in REPORTS.items() if st in NAME), key=lambda x: NAME[x[0]])
    state_cards = ''.join(f'<a class="sc" href="{SLUG[st]}.html"><span class="st">{esc(NAME[st])}</span><b>{esc(rep["headline"])}</b><span>{esc(rep.get("summary") or rep["dek"])}</span></a>' for st, rep in per_state)
    top_meta = (PL.get('meta') or {}).get('by_committee') or []; top_goog = (PL.get('google') or {}).get('by_committee') or []
    adv = GA.get('advertisers') or []
    gads_total = sum(v for _, v in (GA.get('weekly_total') or []))
    donors_html = ''
    for d in DONORS[:25]:
        piece = DONOR_PIECES.get(d['key'])
        seats = ', '.join(f"<span class='{ 'ok' if s['won'] else 'no' if s['won'] is False else ''}'>{esc(s['label'])}</span>" for s in d['seats'][:8]) + ('…' if len(d['seats']) > 8 else '')
        donors_html += f"""<div class="donor"><div class="dh"><b>{esc(d['name'])}</b><span class="dsub">{esc((d['employer'] + (', ' if d['employer'] and d['occupation'] else '') + d['occupation']) or d['state'])}</span><span class="dusd {('d' if d['side'] == 'D' else 'r' if d['side'] == 'R' else '')}">{usd(d['total'])}</span></div>
<p class="dto">To {', '.join(f"{esc(t['name'])} ({usd(t['usd'])})" for t in d['to'][:4])}{'…' if len(d['to']) > 4 else ''}.</p>
<p class="dseats"><span class="k">Seats, through those committees</span> {seats or '—'} <span class="rec">{d['won']} won · {d['lost']} lost{(' · ' + str(d['open']) + ' open') if d['open'] else ''}</span></p>
{('<div class="dpiece">' + ''.join(f'<p>{esc(p)}</p>' for p in piece['text'].split(chr(10) + chr(10))) + (f'<small>Sources: ' + ', '.join(f'<a href="{esc(s["url"])}" rel="noopener">{esc(s["title"][:60])}</a>' for s in piece.get('sources', [])[:6]) + '</small>' if piece.get('sources') else '') + '</div>') if piece else ''}</div>"""
    body = f"""{head(title, dek, 'index', image='share.png')}
<section class="stage" id="stage"><div class="flow" id="flow"></div><div class="hud" id="hud"></div><div class="bar"><button class="tbtn" id="fsBtn" type="button">Full screen</button><span class="hint">Donors, left; the committees they fund, middle; the Senate races those committees spent on, right. A line’s width is the dollars; blue helps the Democratic side, red the Republican; a race is marked ✓ when the side with more outside money won. Hover or tap a name to follow its money.</span></div></section>
<main>
<div class="narrow head"><p class="k">The Watch report · Politics · The money</p><h1>{esc(title)}</h1><p class="dek">{esc(dek)}</p>
<p class="byline">{('By <b>Claude</b> (' + esc(MODEL_NAME.get(USREP.get('model', ''), 'Claude')) + ', with web search) for The Watch, ' + when(USREP.get('written')) + '. ') if USREP else 'By <b>The Watch</b>, with pieces by Claude (Opus 5.5) through Anthropic’s API being written. '}FEC data read {FETCHED}; the sums refresh daily. {(str(len(USREP.get('sources') or [])) + ' sources, numbered in the text.') if USREP else ''}{' <b>This page is built on made-up data for testing.</b>' if MOCK else ''}</p></div>
<div class="narrow body">
<div class="stat-row"><div class="stat"><b>{usd(TOTAL_IE)}</b><span>outside money reported in the Senate and House races (independent expenditures, for and against)</span></div><div class="stat"><b>{money_won} of {decided}</b><span>decided Senate races went to the side with more outside money</span></div><div class="stat"><b>{usd((PL.get('meta') or {}).get('total_itemized', 0) + (PL.get('google') or {}).get('total_itemized', 0))}</b><span>paid straight to Meta and Google by committees this cycle, itemized; a floor</span></div><div class="stat"><b>{usd(gads_total)}</b><span>political ads on Google’s platforms since Jan. 2025, by Google’s own count</span></div></div>
{render_paras(USREP) if USREP else ''}

<h2 id="seats">What a seat cost</h2>
<p>Outside money, for and against, in each Senate race: what committees other than the campaigns reported spending to help one side — support for its candidate plus attacks on the other. A ✓ means the side with more of it won. Dollars per vote cast are in the table.</p>
{diverging(SEN, 'Outside money in the Senate races', 'Independent expenditures reported to the FEC, 2025–26, by the side they helped; the result from AP’s count.', 24)}
<div class="tblwrap"><table class="tbl"><thead><tr><th>Race</th><th>For the D side</th><th>For the R side</th><th>Total</th><th>Per vote</th><th>Result</th></tr></thead><tbody>{''.join(f'<tr><td>{esc(r["label"])}</td><td class="d">{usd(r["D"])}</td><td class="r">{usd(r["R"])}</td><td>{usd(r["total"])}</td><td>{("$" + f"{r['per_vote']:.2f}") if r["per_vote"] else "–"}</td><td>{esc((r["won"][0] if r["won"] else "not called"))}{(" <span class=ok>✓ money won</span>" if r["money_won"] else " <span class=no>✗ money lost</span>" if r["money_won"] is False else "")}</td></tr>' for r in SEN)}</tbody></table></div>
{(diverging(HOUSE, 'The House races that drew the most outside money', 'The 20 House races with the most independent expenditures.', 20)) if HOUSE else ''}

<h2 id="committees">Who spent it</h2>
<p>The committees — Super PACs, party committees and hybrids — behind the outside money, by what they spent across the races, and their record: a race counts as won when the side they spent for won it.</p>
{hbars(CM, 'The biggest outside spenders', 'Independent expenditures across all the races, 2025–26.', sub=lambda c: f"{c['won']} won · {c['lost']} lost" + (f" · {c['open']} open" if c['open'] else ''), limit=20, wide=True)}

<h2 id="buyers">The buyers</h2>
<p>The biggest contributors to those committees, by what they gave them this cycle, with the seats their money reached and how those races came out. Giving to a Super PAC is not buying a seat — the committee decides where it goes — but it is the closest the public record comes to a list of who paid for the ads.{' Donor lists fill in once the FEC key is set.' if not DONORS else ''}</p>
{hbars([dict(d, name=d['name'][:30]) for d in DONORS], 'The biggest donors to the outside spenders', 'Itemized contributions of $10,000 and more to the top committees, summed by donor.', sub=lambda d: (d['employer'] or d['occupation'] or d['state'])[:36], limit=25, wide=True) if DONORS else ''}
<div class="donors">{donors_html}</div>

<h2 id="platforms">Where the ads went</h2>
<p>Two measures. First, what committees reported paying Meta and Google directly, by month: a floor, because most digital buys go through media vendors whose names, not the platforms’, appear in the filings. Second, Google’s own transparency count of political advertising on its platforms (Search, YouTube and the display network), which covers every advertiser Google verified, whatever route the money took — and sweeps in some advertisers that are political only in Google’s sense of the word, such as the prediction markets that bought election-odds ads. Meta publishes its figures only in its Ad Library, which has no public file.</p>
{monthly({'Meta (direct payments)': (PL.get('meta') or {}).get('by_month', {}), 'Google (direct payments)': (PL.get('google') or {}).get('by_month', {})}, 'What committees paid the platforms directly', 'Itemized disbursements naming Meta Platforms, Facebook or Google as the payee, by month (Schedule B).')}
<div class="charts">{hbars([dict(b, side=('D' if b['party'].startswith('D') else 'R' if b['party'].startswith('R') else 'M'), total=b['amount']) for b in top_meta], 'Paid Meta directly', 'The committees with the biggest itemized payments to Meta.', value='total', sub=lambda b: b['party'] or b['type'], limit=12)}{hbars([dict(b, side=('D' if b['party'].startswith('D') else 'R' if b['party'].startswith('R') else 'M'), total=b['amount']) for b in top_goog], 'Paid Google directly', 'The committees with the biggest itemized payments to Google.', value='total', sub=lambda b: b['party'] or b['type'], limit=12)}</div>
{weekly_line(GA.get('weekly_total') or [], 'Political ads on Google, week by week', 'All verified political advertisers in the U.S., by Google’s transparency report.')}
{hbars([dict(a, name=title_case(a['name']), total=a['cycle'], side='M') for a in adv], 'The biggest political advertisers on Google since Jan. 2025', 'Spend by advertiser, by Google’s count; the states a verified advertiser targeted most are in the list below.', sub=lambda a: ', '.join(NAME.get(s, s) for s in sorted(a.get('states', {}), key=lambda s: -a['states'][s])[:3]), limit=20, wide=True) if adv else ''}
{('<h3 class="k">What they ran</h3><div class="ads">' + ''.join(f'<div class="ad"><b>{esc(title_case(a["name"]))}</b><p>{usd(a["cycle"])} since Jan. 2025{(", most in " + ", ".join(NAME.get(s, s) for s in sorted(a.get("states", {}), key=lambda s: -a["states"][s])[:3])) if a.get("states") else ""}.</p><small>' + ' · '.join(f'<a href="{esc(x["url"])}" rel="noopener">{esc(x["type"].title() if x.get("type") else "ad")} {spend_range(x)}{(", " + esc(geo_short(x["geo"]))) if x.get("geo") else ""}</a>' for x in a.get("ads", [])[:5]) + '</small></div>' for a in adv[:12]) + '</div>') if adv else ''}

<h2 id="states">Race by race</h2>
<p>A reported piece for each state with a race on the wave: the committees and donors behind the ads, what the ads said, who ran them and where, with the sums from the FEC where the race was federal and from the state’s own filings and the local press where it was for governor. Written by Claude (Opus 5.5) through Anthropic’s API with web search; every claim from the web carries its citation.{' <b>' + str(len(per_state)) + ' written so far.</b>' if per_state else ' Being written.'}</p>
<div class="states-grid">{state_cards}</div>

<h2>How we made it</h2>
<ul class="how">
<li><b>Outside money</b> is independent expenditures (Schedule E) aggregated by the FEC by candidate and committee for the 2025–26 cycle, including 24- and 48-hour reports; a committee’s spending “for a side” is its support of that side’s candidate plus its opposition to the other. Candidate totals are from Form 3 summaries. Winners and margins are AP’s count via The New York Times, matched by state, office, district and surname.</li>
<li><b>Donors</b> are itemized receipts (Schedule A) of $10,000 and more to the committees that spent the most, summed by contributor name; a donor’s “seats” are every race the committees it funded spent on, won when that committee’s side won. Pass-through entities (ActBlue, WinRed) appear as contributors where the committee reported them that way.</li>
<li><b>Platform payments</b> are itemized disbursements (Schedule B) naming Meta Platforms, Facebook or Google as the payee, $2,500 and up. They are a floor: digital buys through vendors are reported under the vendor’s name.</li>
<li><b>Google’s figures</b> come from its political-ads transparency bundle: weekly spend by verified advertiser since Jan. 2025, geographic spend by state (cumulative), and per-ad spend and impression ranges with targeting. Meta has no equivalent file.</li>
<li><b>The written pieces</b> are by Claude Opus 5.5 through Anthropic’s API: the data above goes in the prompt, every dollar figure must come from it or be attributed to a named filing or outlet, and every web claim carries the search’s own citation. Spending on the API is logged in <a href="data/spend.json">spend.json</a> (and the wave’s in <a href="../wave/data/spend.json">its own</a>).</li>
</ul>
<h2>Sources</h2><div class="sources">{sources_list(USREP or {'sources': []}, 'src', DATA_SOURCES)}</div>
</div>
</main>
<script>window.MONEY_PAGE = {json.dumps({'slug': 'index', 'url': PUBLIC, 'shareText': f'{title}: {dek[:160]}'})};</script>
{foot()}"""
    open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8').write(body)
    return {'title': title, 'dek': dek}

def state_page(st, rep):
    rs = [r for r in SEN + HOUSE if r['st'] == st]; sen = next((r for r in SEN if r['st'] == st), None)
    model = MODEL_NAME.get(rep.get('model', ''), 'Claude'); srcs = rep.get('sources') or []; k = len(srcs)
    stat = ''
    if sen: stat = f"<div class=\"stat-row\"><div class=\"stat d\"><b>{usd(sen['D'])}</b><span>outside money for the Democratic side of the Senate race</span></div><div class=\"stat r\"><b>{usd(sen['R'])}</b><span>for the Republican side</span></div><div class=\"stat\"><b>{('$' + f'{sen['per_vote']:.2f}') if sen['per_vote'] else '–'}</b><span>per vote cast</span></div><div class=\"stat\"><b>{esc(sen['won'][0].split()[-1] if sen['won'] else 'not called')}</b><span>{'won; the side with more outside money ' + ('won' if sen['money_won'] else 'lost') if sen['money_won'] is not None else 'the race is not called'}</span></div></div>"
    cands_tbl = ''
    if rs:
        rows = []
        for r in rs:
            for cc in sorted(r['cands'].values(), key=lambda c: -(c['support'] + c['oppose'])):
                rows.append(f"<tr><td>{esc(cc['name'])} <small>({cc['party']}, {esc(r['label'])})</small></td><td>{usd(cc['receipts'])}</td><td class='d'>{usd(cc['support'])}</td><td class='r'>{usd(cc['oppose'])}</td><td>{'won' if cc['won'] else 'lost' if cc['won'] is False else '–'}</td></tr>")
        cands_tbl = f"<h2>The federal money</h2><div class=\"tblwrap\"><table class=\"tbl\"><thead><tr><th>Candidate</th><th>Raised</th><th>Outside money for</th><th>Against</th><th></th></tr></thead><tbody>{''.join(rows)}</tbody></table></div>"
        top = collections.Counter()
        for r in rs:
            for cid, v in r['cmtes'].items(): top[cid] += v
        cands_tbl += hbars([{'name': cm[c]['name'] if c in cm else c, 'total': v, 'side': cm[c]['side'] if c in cm else 'M'} for c, v in top.most_common(12)], 'The outside spenders in ' + NAME[st], 'Independent expenditures in the state’s federal races, by committee.', limit=12, wide=True)
    order = sorted(REPORTS, key=lambda s: NAME.get(s, s)); i = order.index(st); nxt = order[(i + 1) % len(order)]
    body = f"""{head(rep['headline'], rep['dek'], SLUG[st])}
<main>
<div class="narrow head"><p class="k">The money · race by race · {esc(NAME[st])}</p><h1>{esc(rep['headline'])}</h1><p class="dek">{esc(rep['dek'])}</p>
<p class="byline">By <b>Claude</b> ({esc(model)}, with web search) for The Watch, {when(rep.get('written'))}; FEC data read {FETCHED}. {k} sources. <a href="./#states">All the states ›</a> · <a href="../wave/{SLUG[st]}.html">How {esc(NAME[st])} voted ›</a></p></div>
<div class="narrow body">
{stat}
{render_paras(rep)}
{cast_block(rep)}
{cands_tbl}
<div class="next"><span class="k">Next state</span><a href="{SLUG[nxt]}.html">{esc(REPORTS[nxt]['headline'])}</a><p style="margin:8px 0 0;font-size:14px;color:var(--ink-2)"><a href="./">The money, nationally</a> · <a href="../wave/">The wave</a></p></div>
<h2>Sources</h2><div class="sources">{sources_list(rep, 'src', DATA_SOURCES)}</div>
</div>
</main>
<script>window.MONEY_PAGE = {json.dumps({'slug': SLUG[st], 'url': PUBLIC + SLUG[st] + '.html', 'shareText': rep['headline'] + ': ' + rep['dek'], 'st': st})};</script>
{foot()}"""
    open(os.path.join(HERE, SLUG[st] + '.html'), 'w', encoding='utf-8').write(body)
    return {'st': st, 'name': NAME[st], 'slug': SLUG[st], 'title': rep['headline'], 'dek': rep['dek'], 'summary': rep.get('summary', ''), 'written': rep.get('written')}

if __name__ == '__main__':
    json.dump(flow(), open(os.path.join(DATA, 'flow.json'), 'w'), separators=(',', ':'))
    mp = main_page()
    sp = [state_page(st, rep) for st, rep in sorted(REPORTS.items()) if st in NAME]
    json.dump({'v': 1, 'built': built.isoformat(timespec='minutes'), 'fetched': M.get('fetched'), 'title': mp['title'], 'dek': mp['dek'], 'url': PUBLIC, 'totals': flow()['totals'], 'states': sp, 'national': bool(USREP), 'mock': bool(MOCK)}, open(os.path.join(HERE, 'pages.json'), 'w'), indent=1)
    print(f'wrote index.html, {len(sp)} state pages, flow.json, pages.json; {len(SEN)} Senate races, {len(CM)} committees, {len(DONORS)} donors')
