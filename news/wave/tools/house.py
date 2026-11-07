#!/usr/bin/env python3
"""The House, seat by seat: news/wave/house.html (every seat as a hemicycle a reader can click, with a note on each
seat and a reported piece on the seats that mattered), built from data/night.json (AP's calls and counts via NYT),
data/shift.json (the counties' moves), news/money/data/money.json (outside money and incumbency, when fetched) and the
pieces Claude wrote (data/house/notes.json, data/house/reports/<ST-NN>.json; tools/house_write.py). Also writes
data/house/seats.json (what the page's script reads) and house pages for each written piece."""
import json, os, re, sys, html, math, datetime as dt, collections
HERE = os.path.dirname(os.path.abspath(__file__)); W = os.path.normpath(os.path.join(HERE, '..')); DATA = os.path.join(W, 'data'); HD = os.path.join(DATA, 'house')
PUBLIC = 'https://bboldt86.github.io/lanscape-navigator/news/wave/'
sys.path.insert(0, HERE)
def load(p, default=None):
    try: return json.load(open(p, encoding='utf-8'))
    except FileNotFoundError: return default
def esc(s): return html.escape(str(s if s is not None else ''), quote=True)
def n(v): return f'{float(v or 0):,.0f}'
def pts(v): return ('+' if v > 0 else '') + f'{v:.1f}'
def margin(v): return ('D+' if v > 0 else 'R+' if v < 0 else 'even ') + f'{abs(v):.1f}' if v is not None else '–'
def usd(v):
    v = float(v or 0); return f'${v / 1e6:.1f}M' if abs(v) >= 1e6 else f'${v / 1e3:.0f}K' if abs(v) >= 1e3 else f'${v:.0f}'
def when(iso):
    try: return dt.datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone(dt.timezone(dt.timedelta(hours=-5))).strftime('%b. %-d, %Y')
    except Exception: return ''
NAME = {'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'}
MODEL_NAME = {'claude-opus-5-5': 'Claude Opus 5.5'}

N = load(os.path.join(DATA, 'night.json')); S = load(os.path.join(DATA, 'shift.json'))
M = load(os.path.join(W, '..', 'money', 'data', 'money.json'), {}) or {}
NOTES = (load(os.path.join(HD, 'notes.json'), {}) or {}).get('notes', {})
REPORTS = {}
if os.path.isdir(os.path.join(HD, 'reports')):
    for f in os.listdir(os.path.join(HD, 'reports')):
        if f.endswith('.json'):
            r = load(os.path.join(HD, 'reports', f))
            if r and r.get('headline'): REPORTS[f[:-5]] = r
t0 = dt.datetime.fromisoformat(N['t0'].replace('Z', '+00:00')).astimezone(dt.timezone(dt.timedelta(hours=-5)))
def call_time(at): return (t0 + dt.timedelta(minutes=at)).strftime('%-I:%M %p') if at is not None else None
asof = dt.datetime.fromisoformat(S['asOf'].replace('Z', '+00:00')).astimezone(dt.timezone(dt.timedelta(hours=-5)))
ASOF = asof.strftime('%b. %-d, %Y, %-I:%M %p ET'); built = dt.datetime.now(dt.timezone(dt.timedelta(hours=-5)))

# ---------- the seats ----------
cand_by_race = collections.defaultdict(list)
for c in (M.get('candidates') or {}).values():
    if c.get('office') == 'H' and c.get('race'): cand_by_race[c['race']].append(c)
ie_by_cand = collections.defaultdict(list)
for row in M.get('ie') or []: ie_by_cand[row['cand']].append(row)
def seat_id(r): return f"{r['st']}-{r['seat']}"
SEATS = []
for r in N['races']:
    if r['o'] != 'H': continue
    t = r['t'] or 0; mg = ((r['d'] or 0) - (r['r'] or 0)) / t * 100 if t else None
    cs = r.get('u') or []; rows = [(S['counties'][f], S['names'].get(f, f)) for f in cs if f in S['counties']]
    tw = sum(v[7] for v, _ in rows); cmove = sum(v[2] * v[7] for v, _ in rows) / tw if tw else None
    fec = cand_by_race.get(r['id'], []); inc = next((c for c in fec if c.get('incumbent') == 'I'), None)
    flip = None
    if inc is not None and inc.get('won') is not None: flip = not inc['won']
    elif fec and all(c.get('incumbent') == 'C' for c in fec) and r['p']: flip = None  # an open seat: the previous party isn't in the data
    ie_d = ie_r = 0.0; cmtes = collections.Counter()
    for c in fec:
        side = 'D' if (c.get('party') or '').startswith('D') else 'R' if (c.get('party') or '').startswith('R') else 'D'
        for row in ie_by_cand.get(c['id'], []):
            helps = side if row['so'] == 'S' else ('R' if side == 'D' else 'D')
            if helps == 'D': ie_d += row['total']
            else: ie_r += row['total']
            cmtes[row['cmte_name'] or row['cmte']] += row['total']
    SEATS.append({'id': seat_id(r), 'race': r['id'], 'st': r['st'], 'seat': r['seat'], 'label': f"{NAME.get(r['st'], r['st'])} {r['seat']}", 'short': f"{r['st']}-{r['seat']}", 'p': r['p'], 'won': (r['won'] or [None])[0], 'cands': r['cands'][:4], 'd': r['d'], 'r': r['r'], 't': t, 'e': r['e'], 'margin': round(mg, 2) if mg is not None else None, 'called': call_time(r['at']), 'at': r['at'],
                  'counties': [[f, S['names'].get(f, f), round(S['counties'][f][2], 1)] for f in cs if f in S['counties']][:40], 'cmove': round(cmove, 1) if cmove is not None else None, 'flip': flip, 'inc': (inc['name'] if inc else None), 'open': bool(fec) and inc is None,
                  'ie_d': round(ie_d), 'ie_r': round(ie_r), 'ie': round(ie_d + ie_r), 'cmtes': [[k, round(v)] for k, v in cmtes.most_common(6)], 'receipts': {c['id']: [c['name'], c.get('party'), c.get('receipts')] for c in fec}})
BY = {s['id']: s for s in SEATS}
D = sum(1 for s in SEATS if s['p'] == 'D'); R = sum(1 for s in SEATS if s['p'] == 'R'); U = sum(1 for s in SEATS if not s['p'])
def interest(s):
    """Which seats get a reported piece: the closest, the flips, the uncalled, the ones with the most outside money."""
    sc = 0.0
    if s['margin'] is not None: sc += max(0, 8 - abs(s['margin'])) * 10
    if s['flip']: sc += 60
    if not s['p']: sc += 50
    sc += min(40, s['ie'] / 1e6 * 2)
    return sc
for s in SEATS: s['interest'] = round(interest(s), 1)
PICK = sorted(SEATS, key=lambda s: -s['interest'])[:80]; PICK_IDS = {s['id'] for s in PICK}

# ---------- the hemicycle ----------
def hemicycle():
    """435 seats in nine arcs: Democrats from the left, Republicans from the right, the uncalled between."""
    W_, H_ = 900, 470; cx, cy = 450, 440; rows = 9; r0, dr = 170, 30
    slots = []
    for i in range(rows):
        rad = r0 + i * dr; k = int(round(math.pi * rad / 23.5))
        for j in range(k): a = math.pi - math.pi * (j + 0.5) / k; slots.append((a, rad, i))
    slots.sort(key=lambda s: -s[0])  # left (pi) to right (0)
    # trim to 435 by dropping evenly
    while len(slots) > 435: slots.pop(int(len(slots) * 0.5))
    dem = sorted([s for s in SEATS if s['p'] == 'D'], key=lambda s: -(s['margin'] or 0))
    rep = sorted([s for s in SEATS if s['p'] == 'R'], key=lambda s: -abs(s['margin'] or 0))
    unc = sorted([s for s in SEATS if not s['p']], key=lambda s: (s['margin'] or 0))
    order = dem + unc + rep[::-1]
    out = [f'<svg class="hemi" viewBox="0 0 {W_} {H_}" role="img" aria-label="The House, seat by seat: {D} Democrats, {R} Republicans, {U} uncalled">']
    for (a, rad, i), s in zip(slots, order):
        x = cx + rad * math.cos(a); y = cy - rad * math.sin(a); cls = 'd' if s['p'] == 'D' else 'r' if s['p'] == 'R' else 'u'
        if s['flip']: cls += ' flip'
        if s['id'] in REPORTS: cls += ' piece'
        out.append(f'<circle class="seat {cls}" data-id="{s["id"]}" cx="{x:.1f}" cy="{y:.1f}" r="9"><title>{esc(s["label"])}: {esc(s["won"] or "not called")}{(" (" + s["p"] + ") " + margin(s["margin"])) if s["p"] else ""}</title></circle>')
    out.append(f'<text class="big d" x="365" y="452" text-anchor="middle">{D}</text><text class="big r" x="535" y="452" text-anchor="middle">{R}</text><text class="mid" x="450" y="398" text-anchor="middle">218 to control{(" · " + str(U) + " not called") if U else ""}</text>')
    out.append('</svg>')
    return ''.join(out)

# ---------- pieces ----------
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
        out.append(f"<p{' class=\"lede\"' if first else ''}>{h}</p>"); first = False
    return ''.join(out)
ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%230b1526'/%3E%3Cpath d='M12 44c6-14 10-6 16-16s10 4 16-8 8 2 10 6' fill='none' stroke='%237fc4ff' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E"
def head(title, desc, slug, published=None):
    url = PUBLIC + slug + '.html'
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)} · The Watch</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{url}">
<meta property="og:type" content="article"><meta property="og:site_name" content="The Watch"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{PUBLIC}house.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
{f'<meta property="article:published_time" content="{published}">' if published else ''}<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{ICON}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<link rel="stylesheet" href="article.css"><link rel="stylesheet" href="house.css">
<script>(function(){{try{{var t=localStorage.getItem('watch.theme')||'auto';var h=new Date().getHours();if(t==='auto'){{t=(h>=20||h<4)?'night':(matchMedia('(prefers-color-scheme: dark)').matches?'night':'day')}}document.documentElement.dataset.theme=t}}catch(e){{}}}})();</script>
</head><body>
<header class="mast"><div class="wrap">
  <a class="back" href="../#/s/politics"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#15243B"/><circle cx="32" cy="32" r="21" fill="none" stroke="#D6B25E" stroke-width="6" stroke-dasharray="19 3"/><path d="M32 32 L46 14" stroke="#F5F7F6" stroke-width="5" stroke-linecap="round"/></svg>The Watch <span>· Politics</span></a>
  <div class="mast-r"><a class="tbtn" href="./">The wave</a><a class="tbtn" href="../money/">The money</a><button type="button" class="tbtn" data-share>Share</button></div>
</div></header>
"""
def foot(): return f"""<footer class="foot"><div class="narrow"><p>The Watch · Politics. Calls and counts: AP via The New York Times, as of {ASOF}; county moves: The Watch’s wave data; outside money and incumbency: the FEC (OpenFEC API). Notes and pieces by Claude (Opus 5.5) through Anthropic’s API, numbers from the data, web claims cited. Built {built.strftime('%b. %-d, %Y, %-I:%M %p')} ET.</p></div></footer>
<script type="module" src="house.js"></script></body></html>"""

def seat_table(seats, cols=('margin', 'called', 'ie')):
    out = ['<div class="tblwrap"><table class="tbl seats"><thead><tr><th>Seat</th><th>Winner</th><th>Margin</th><th>Votes</th><th>Counted</th><th>Called</th>' + ('<th>Outside money</th>' if M.get('ie') else '') + '</tr></thead><tbody>']
    for s in seats:
        out.append(f"<tr class=\"pick\" data-id=\"{s['id']}\"><td><b>{esc(s['label'])}</b>{' <span class=flip>flip</span>' if s['flip'] else ''}{(' <a href=\"house-' + s['id'].lower() + '.html\">piece ›</a>') if s['id'] in REPORTS else ''}</td><td>{esc(s['won'] or 'not called')}{(' (' + s['p'] + ')') if s['p'] else ''}</td><td class=\"{'d' if (s['margin'] or 0) > 0 else 'r'}\">{margin(s['margin'])}</td><td>{n(s['t'])}</td><td>{s['e'] if s['e'] is not None else '–'}%</td><td>{esc(s['called'] or '–')}</td>" + (f"<td>{usd(s['ie']) if s['ie'] else '–'}</td>" if M.get('ie') else '') + "</tr>")
    out.append('</tbody></table></div>')
    return ''.join(out)

def main_page():
    closest = sorted([s for s in SEATS if s['margin'] is not None], key=lambda s: abs(s['margin']))[:25]
    flips = sorted([s for s in SEATS if s['flip']], key=lambda s: abs(s['margin'] or 0))
    rich = sorted([s for s in SEATS if s['ie']], key=lambda s: -s['ie'])[:20]
    pieces = sorted(REPORTS.items(), key=lambda kv: -BY[kv[0]]['interest'] if kv[0] in BY else 0)
    title = 'The House, seat by seat'; dek = f"All 435 seats: {D} Democrats, {R} Republicans{(', ' + str(U) + ' not called') if U else ''}, as AP called them. Tap a seat for its note; the seats that flipped, came closest or drew the most money have a reported piece."
    body = f"""{head(title, dek, 'house')}
<main>
<div class="narrow head"><p class="k">The Watch report · Politics · The wave · the House</p><h1>{esc(title)}</h1><p class="dek">{esc(dek)}</p>
<p class="byline">By <b>The Watch</b>, with notes and pieces by Claude (Opus 5.5) through Anthropic’s API. Calls and counts as of {ASOF}, AP via The New York Times; {len(NOTES)} seat notes, {len(REPORTS)} pieces so far.</p></div>
<section class="hemi-wrap"><div class="narrow-wide">{hemicycle()}<p class="legend"><span><i class="sw d"></i>Democrat</span><span><i class="sw r"></i>Republican</span><span><i class="sw u"></i>not called</span><span><i class="sw flip"></i>flipped (incumbent lost)</span><span><i class="sw piece"></i>has a piece</span> · the safest seats at the ends, the closest in the middle</p>
<div class="seat-card" id="seatCard" hidden></div></div></section>
<div class="narrow body">
<div class="stat-row"><div class="stat d"><b>{D}</b><span>seats called for Democrats</span></div><div class="stat r"><b>{R}</b><span>for Republicans</span></div><div class="stat"><b>{len(flips) if flips else (sum(1 for s in SEATS if abs(s['margin'] or 99) < 2))}</b><span>{'incumbents lost' if flips else 'seats decided by under 2 points'}</span></div><div class="stat"><b>{U}</b><span>not yet called</span></div></div>
<h2 id="closest">The closest seats</h2>
<p>Sorted by margin. Click a row for the seat’s note.</p>
{seat_table(closest)}
{('<h2 id="flips">Seats that changed hands</h2><p>Incumbents who lost, by the FEC’s incumbency flag matched to AP’s result. Open seats that changed party aren’t marked, because the previous holder isn’t in the data.</p>' + seat_table(flips)) if flips else ''}
{('<h2 id="money">Where the outside money went</h2><p>Independent expenditures reported to the FEC, for and against, in the House races that drew the most — <a href="../money/">the money, in full ›</a></p>' + seat_table(rich)) if rich else '<h2 id="money">Where the outside money went</h2><p>The FEC’s House outside-spending data arrives with the next data run (<a href="../money/">the money ›</a>).</p>'}
<h2 id="pieces">The seats that mattered</h2>
<p>A reported piece for each of the seats that flipped, came closest, went uncalled or drew the most outside money, written by Claude (Opus 5.5) with web search, its numbers from AP’s count, every web claim cited.{' ' + str(len(pieces)) + ' so far.' if pieces else ' Being written.'}</p>
<div class="states-grid">{''.join(f'<a class="sc" href="house-{k.lower()}.html"><span class="st">{esc(BY[k]["label"])}</span><span class="sn"><b class="{"d" if BY[k]["p"] == "D" else "r"}">{esc(BY[k]["won"] or "not called")}</b> · {margin(BY[k]["margin"])}</span><b>{esc(rep["headline"])}</b><span>{esc(rep.get("summary") or rep["dek"])}</span></a>' for k, rep in pieces if k in BY)}</div>
<h2>Every seat</h2>
<p>All 435, by state. Click a row for the note.</p>
{seat_table(sorted(SEATS, key=lambda s: (s['st'], s['seat'])))}
<h2>Sources</h2><div class="sources"><ol><li>The New York Times, 2026 election results pages (AP calls and county-level counts), results-house.json and one file per state, read {ASOF}. <a href="https://www.nytimes.com/interactive/2026/11/03/us/elections/results-house.html" rel="noopener">https://www.nytimes.com/interactive/2026/11/03/us/elections/results-house.html</a></li><li>The Watch’s wave data: every county’s move since 2024 (<a href="./">the wave</a>).</li><li>Federal Election Commission, OpenFEC API: candidate totals and incumbency, independent expenditures by candidate (<a href="../money/">the money</a>).</li></ol></div>
</div>
</main>
<script>window.HOUSE_PAGE = {json.dumps({'slug': 'house', 'url': PUBLIC + 'house.html', 'shareText': title + ': ' + dek})};</script>
{foot()}"""
    open(os.path.join(W, 'house.html'), 'w', encoding='utf-8').write(body)
    return {'title': title, 'dek': dek}

def seat_page(k, rep):
    s = BY[k]; srcs = rep.get('sources') or []; model = MODEL_NAME.get(rep.get('model', ''), 'Claude')
    cands = ''.join(f"<tr><td>{esc(c[0])} ({esc(c[1])})</td><td>{n(c[2])}</td><td>{c[2] / s['t'] * 100:.1f}%</td></tr>" for c in s['cands']) if s['t'] else ''
    counties = ', '.join(f"{esc(nm)} ({pts(mv)})" for f, nm, mv in s['counties'][:12])
    body = f"""{head(rep['headline'], rep['dek'], 'house-' + k.lower(), rep.get('written'))}
<main>
<div class="narrow head"><p class="k">The House · {esc(s['label'])}</p><h1>{esc(rep['headline'])}</h1><p class="dek">{esc(rep['dek'])}</p>
<p class="byline">By <b>Claude</b> ({esc(model)}, with web search) for The Watch, {when(rep.get('written'))}; counts as of {ASOF}, AP via The New York Times. {len(srcs)} sources. <a href="house.html">All 435 seats ›</a></p></div>
<div class="narrow body">
<div class="stat-row"><div class="stat {'d' if s['p'] == 'D' else 'r' if s['p'] == 'R' else ''}"><b>{esc((s['won'] or 'Not called').split(' ')[-1])}</b><span>{'won' if s['p'] else 'leads'} {esc(s['label'])}{(' (' + s['p'] + ')') if s['p'] else ''}</span></div><div class="stat"><b>{margin(s['margin'])}</b><span>the margin, on {n(s['t'])} votes ({s['e'] if s['e'] is not None else '–'}% counted)</span></div><div class="stat"><b>{esc(s['called'] or '–')}</b><span>{'called by AP, election night ET' if s['called'] else 'not called'}</span></div><div class="stat"><b>{(pts(s['cmove']) if s['cmove'] is not None else '–')}</b><span>the district’s counties’ move since 2024 (Senate/governor vote, weighted)</span></div></div>
{render_paras(rep)}
<h2>The vote</h2>
<div class="tblwrap"><table class="tbl"><thead><tr><th>Candidate</th><th>Votes</th><th>Share</th></tr></thead><tbody>{cands}</tbody></table></div>
{('<p><small>Counties in the district and how each moved since 2024 on the wave: ' + counties + '.</small></p>') if counties else ''}
{(f'<p><small>Outside money reported to the FEC: {usd(s["ie_d"])} for the Democratic side, {usd(s["ie_r"])} for the Republican side; biggest spenders ' + ', '.join(f"{esc(nm)} ({usd(v)})" for nm, v in s["cmtes"][:4]) + '.</small></p>') if s['ie'] else ''}
<div class="next"><span class="k">The House</span><a href="house.html">All 435 seats, and the notes on each ›</a></div>
<h2>Sources</h2><div class="sources"><ol>{''.join(f'<li id="src-{x["n"]}">{esc(x["title"])}. <a href="{esc(x["url"])}" rel="noopener">{esc(x["url"])}</a></li>' for x in srcs)}<li>The New York Times, 2026 election results (AP calls and counts), read {ASOF}.</li><li>The Watch’s wave data (county moves) and the FEC’s OpenFEC API (outside money).</li></ol></div>
</div>
</main>
<script>window.HOUSE_PAGE = {json.dumps({'slug': 'house-' + k.lower(), 'url': PUBLIC + 'house-' + k.lower() + '.html', 'shareText': rep['headline'] + ': ' + rep['dek']})};</script>
{foot()}"""
    open(os.path.join(W, 'house-' + k.lower() + '.html'), 'w', encoding='utf-8').write(body)

if __name__ == '__main__':
    os.makedirs(HD, exist_ok=True)
    json.dump({'v': 1, 'asOf': S['asOf'], 'built': built.isoformat(timespec='minutes'), 'D': D, 'R': R, 'U': U, 'seats': {s['id']: {k: s[k] for k in ('label', 'p', 'won', 'cands', 'd', 'r', 't', 'e', 'margin', 'called', 'counties', 'cmove', 'flip', 'inc', 'ie_d', 'ie_r', 'cmtes')} for s in SEATS}, 'pieces': sorted(REPORTS), 'pick': sorted(PICK_IDS)}, open(os.path.join(HD, 'seats.json'), 'w'), separators=(',', ':'))
    mp = main_page()
    for k, rep in REPORTS.items():
        if k in BY: seat_page(k, rep)
    print(f'wrote house.html, {len(REPORTS)} seat pages, data/house/seats.json; {D} D, {R} R, {U} uncalled; {sum(1 for s in SEATS if s["flip"])} flips known; {len(NOTES)} notes')
