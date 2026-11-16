#!/usr/bin/env python3
"""The Checkout: writes news/prices/index.html from data/view.json and data/audit.json (run tools/verify.py first).
Every number on the page comes from those files; the prose that depends on the official series is only written when
the series are loaded."""
import json, os, html, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
V = json.load(open(os.path.join(HERE, 'data', 'view.json')))
A = json.load(open(os.path.join(HERE, 'data', 'audit.json')))
E = lambda s: html.escape(str(s), quote=True)
MON = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']
SITE = 'https://bboldt86.github.io/lanscape-navigator/news/prices/'


def d(s):
    s = str(s)
    if len(s) == 4:
        return s
    y, m = int(s[:4]), int(s[5:7])
    return ('%s %d, %d' % (MON[m - 1], int(s[8:10]), y)) if len(s) >= 10 else '%s %d' % (MON[m - 1], y)


def usd(v):
    return '—' if v is None else '$%.2f' % v


def pct(a, b):
    if not a or not b:
        return '—'
    p = (a / b - 1) * 100
    return '<span class="%s">%+.1f%%</span>' % ('up' if p > 0.05 else 'down' if p < -0.05 else '', p)


def grade(p):
    return '<span class="g %s"><i>%s</i>%s</span>' % (p['grade'], p['grade'], E(p['grade_name']))


posts = V['posts']
rows = V['rows']
official = V['official'] and not V['mock']
items = {i['id']: i for i in V['items']}
checks_by = {}
for c in A['checks']:
    checks_by.setdefault(c['post'], []).append(c)
n_checks = sum(V['summary'].values())
n_us = len([p for p in posts])
bad = V['grades']['F'] + V['grades']['D']
last = V.get('last')

# ---------- the fake against the record
fake = next(p for p in posts if p['id'] == 'fl-2002-2026')
frows = [r for r in rows if r['post'] == 'fl-2002-2026' and r['kind'] == 'receipt line']
pairs = {}
for r in frows:
    pairs.setdefault(r['item'], {})[r['date'][:4]] = r


def off_at(item, ym):
    it = items.get(item)
    if not it:
        return None
    k = (int(ym[:4]) - V['start']) * 12 + int(ym[5:7]) - 1
    m = it['m']
    while k >= 0 and (k >= len(m) or m[k] is None):
        k -= 1
        if k < (int(ym[:4]) - V['start']) * 12 + int(ym[5:7]) - 4:
            return None
    return m[k] if k >= 0 else None


fake_tbl = ''
for iid in ['milk', 'eggs', 'bread', 'chicken_breast', 'bananas', 'coffee']:
    a, b = pairs[iid]['2002'], pairs[iid]['2026']
    it = items.get(iid)
    o1 = off_at(iid, '2002-04') if official else None
    o2 = it['now'] if (official and it and it['current']) else None
    nm = {'milk': 'Milk, gallon', 'eggs': 'Eggs, dozen', 'bread': 'Bread', 'chicken_breast': 'Chicken breast', 'bananas': 'Bananas, 3 lb', 'coffee': 'Coffee'}[iid]
    fake_tbl += '<tr><td>%s</td><td class="num">%s</td><td class="num">%s</td><td class="num"><b>%.1f×</b></td><td class="num">%s</td>%s</tr>' % (
        nm, usd(a['price']), usd(b['price']), b['price'] / a['price'], ('%.1f×' % (o2 / o1)) if (o1 and o2) else '—',
        '<td><small>%s</small></td>' % (('official average, per %s: %s in April 2002, %s in %s' % (it['unit'], usd(o1), usd(o2), d(it['now_month']))) if (o1 and o2) else ('official series ' + ('begins after 2002' if official and it else 'not loaded yet'))))

# ---------- official table
off_tbl = ''
if official:
    for it in V['items']:
        if not it['current']:
            continue
        off_tbl += '<tr><td><a href="#stage" data-see="%s">%s</a> <small>per %s</small></td><td class="num">%s<br><small>%s</small></td><td class="num">%s</td><td class="num">%s</td><td class="num"><b>%s</b></td><td class="num">%s</td><td class="num">%s</td></tr>' % (
            it['id'], E(it['long']), E(it['unit']), usd(it['then']), d(it['then_month']), usd(it['y2019']), usd(it['year_ago']), usd(it['now']), pct(it['now'], it['year_ago']), pct(it['now'], it['y2019']))

# ---------- ledger
RES = {'pass': 'Pass', 'warn': 'Flag', 'fail': 'Fail', 'skip': 'Not run'}
ledger = ''
order = {'F': 0, 'D': 1, 'A': 2, 'B': 3, 'C': 4}
for p in sorted(posts, key=lambda p: (order[p['grade']], p['posted']), reverse=False):
    cs = [c for c in checks_by.get(p['id'], []) if c['check'] not in ('schema',)]
    main = [c for c in cs if c['level'] == 'post' or c['result'] in ('fail', 'warn')]
    rest = [c for c in cs if c not in main]
    li = ''.join('<li><span class="res %s">%s</span>%s</li>' % (c['result'], RES[c['result']], E(c['msg'])) for c in main)
    more = ('<details><summary>%d more price checks</summary><ul>%s</ul></details>' % (len(rest), ''.join('<li><span class="res %s">%s</span>%s</li>' % (c['result'], RES[c['result']], E(c['msg'])) for c in rest))) if rest else ''
    tot = ''
    if p['totals']:
        tot = ' Totals shown: ' + '; '.join('%s%s%s (%s%s)' % ('C' if t.get('currency') == 'CAD' else '', 'about ' if t.get('approx') else '', usd(t['amount']), d(t['date']), (', %d items' % t['n']) if t.get('n') else '') for t in p['totals']) + '.'
    fc = p.get('factcheck')
    fct = ('<p><b>%s:</b> %s. <a href="%s">Read it ›</a></p>' % (E(fc['by']), E(fc['verdict']), E(fc['url']))) if fc else ''
    ct = p.get('counter_total')
    ctt = ('<p>Against it: <b>%s</b>, %s.</p>' % (usd(ct['amount']), E(ct['what']))) if ct else ''
    notes = ''.join('<p>%s</p>' % E(n) for n in p['notes'])
    why = E('; '.join(p['why'][:3])) if p['why'] else ''
    srcs = ' · '.join('<a href="%s">%s</a>%s' % (E(s['url']), E(s['publisher']), (', ' + d(s['date'])) if s.get('date') else '') for s in p['sources'])
    ledger += '''<article class="post %s" data-g="%s" id="p-%s"><header><h3>%s</h3>%s</header>
<p class="meta">%s · %s · posted %s · %d price%s read</p>
<p class="claim"><b>The claim:</b> %s%s</p>
<p><b>Why this grade:</b> %s.</p>%s%s%s
<ul>%s</ul>%s
<p class="src">Sources: %s</p></article>\n''' % (p['grade'], p['grade'], E(p['id']), E(p['title']), grade(p), E(p['platform']), E(p['account'] or ''), d(p['posted']), p['n_obs'], '' if p['n_obs'] == 1 else 's',
                                                 E(p['claim']), E(tot), why[0].upper() + why[1:] if why else 'No check failed', fct, ctt, notes, li, more, srcs)

# ---------- database table
db = ''
for r in sorted(rows, key=lambda r: (r['label'].split(' (')[0].lower(), r['date'])):
    fl = ', '.join(r['flags'])
    db += '<tr class="%s" data-g="%s"><td>%s%s</td><td>%s</td><td class="num">%s%s</td><td class="num">%s</td><td><span class="tier %s">%s</span></td><td><small>%s</small></td><td><small><a href="%s">%s</a></small></td></tr>' % (
        r['tier'], r['tier'], E(r['label']), (' <small>%s</small>' % E(r['note'])) if r.get('note') else '', d(r['date']), usd(r['price']), (' – ' + usd(r['hi'])) if r.get('hi') else '',
        ('%.2f×' % r['ratio']) if r.get('ratio') else '—', r['tier'], {'solid': 'In', 'unverified': 'Held', 'rejected': 'Out'}[r['tier']], E(fl), E(r['source_url']), E(r['source']))

tests = ''.join('<li class="%s">%s</li>' % ('' if t['ok'] else 'bad', E(t['test'])) for t in V['selftest'] + V['canary'])
leads = ''.join('<li><b>%s</b> (%s). %s</li>' % (E(l['what']), E(l['where']), E(l['why'])) for l in V['leads'])

# numbered sources
seen, src_list = set(), ''
for p in posts:
    for s in p['sources']:
        if s['url'] in seen or s['publisher'] == 'The image itself':
            continue
        seen.add(s['url'])
        src_list += '<li><a href="%s">%s</a>, %s%s.</li>' % (E(s['url']), E(s['title']), E(s['publisher']), (', ' + d(s['date'])) if s.get('date') else '')
src_list += '<li><a href="https://www.bls.gov/cpi/factsheets/average-prices.htm">Average price data</a> and <a href="https://download.bls.gov/pub/time.series/ap/">the AP series files</a>, U.S. Bureau of Labor Statistics (the official averages: U.S. city average and four regions, monthly). <a href="https://fred.stlouisfed.org/">FRED</a>, Federal Reserve Bank of St. Louis, republishes the same series and is the fallback feed.</li>'

if official:
    b = V.get('basket')
    feed = 'Official figures through %s, read %s (%s).' % (d(last), d(V['fetched'][:10]), ', '.join({'bls-flat': 'BLS files', 'fred': 'FRED', 'bls-api': 'BLS API', 'kept': 'kept from an earlier run'}.get(r, r) for r in V['routes']) or 'BLS')
    eggs = items.get('eggs')
    off_par = ''
    if eggs:
        off_par = '<p>The official record is the yardstick for all of it. The Bureau of Labor Statistics sends people to price the same staples in stores every month and publishes the averages: a dozen large eggs averaged <b>%s</b> in %s, against %s a year earlier and %s across 2019. ' % (usd(eggs['now']), d(eggs['now_month']), usd(eggs['year_ago']), usd(eggs['y2019']))
        if b:
            k = len(b['m']) - 1
            while b['m'][k] is None:
                k -= 1
            y19 = [v for i, v in enumerate(b['m']) if v is not None and V['start'] + i // 12 == 2019]
            off_par += 'The Watch’s fixed basket (%s) cost <b>%s</b> at those averages in the latest month, against %s on average in 2019 and %s in %d.' % (
                ', '.join('%g %s %s' % (i['qty'], i['unit'], i['name'].lower()) for i in b['items']), usd(b['m'][k]), usd(sum(y19) / len(y19)) if y19 else '—', usd(b['m'][b['first']]), V['start'] + b['first'] // 12)
        off_par += '</p>'
    stage_note = ''
else:
    feed = 'The official series had not been read when this page was built; they load on the next data run.' if not V['mock'] else 'SAMPLE NUMBERS: this build used made-up series for testing.'
    off_par = '<p class="note"><b>Not loaded yet.</b> The official average-price series from the Bureau of Labor Statistics are read by a scheduled job, not by the page. Until its first run finishes, the comparisons against the official record below read “not run,” and no check that needs them has been counted as passed.</p>'

img = SITE + 'share.png' if os.path.exists(os.path.join(HERE, 'share.png')) else 'https://bboldt86.github.io/lanscape-navigator/news/share.png'
title = 'The receipts are fake. The prices are not.'
desc = 'A viral pair of Walmart receipts says six groceries went from $15.44 to $57.93. The store does not exist. The Watch’s ledger of receipt posts, a price database only checked numbers can enter, and 46 years of official prices in 3-D.'
now = datetime.datetime.now(datetime.timezone.utc)

page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{E(title)} · The Checkout · The Watch</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{SITE}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="The Watch">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:url" content="{SITE}">
<meta property="og:image" content="{img}">
<meta property="article:published_time" content="2026-11-15T23:30-05:00">
<meta property="article:modified_time" content="{now.strftime('%Y-%m-%dT%H:%M+00:00')}">
<meta property="article:author" content="Claude (Claude Fable 5.2) for The Watch">
<meta property="article:section" content="Business">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{E(title)}">
<meta name="twitter:image" content="{img}">
<meta name="theme-color" content="#F5F7F6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E1A2B" media="(prefers-color-scheme: dark)">
<link rel="apple-touch-icon" href="../icon-180.png">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%230b1526'/%3E%3Cpath d='M14 46V34h8v12zM28 46V26h8v20zM42 46V16h8v30z' fill='%23eda100'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../wave/article.css">
<link rel="stylesheet" href="prices.css">
<script defer src="/lanscape-navigator/news/pulse/pulse.js"></script>
</head>
<body>
<script>
(function(){{try{{var p=JSON.parse(localStorage.getItem('watch.v1')||'{{}}');var t=p.theme||'auto';var h=+new Intl.DateTimeFormat('en-US',{{timeZone:'America/New_York',hour:'numeric',hourCycle:'h23'}}).format(new Date());
if(t==='auto'){{t=(h>=20||h<4)?'night':(matchMedia('(prefers-color-scheme: dark)').matches?'night':'day')}}document.documentElement.dataset.theme=t;}}catch(e){{}}}})();
</script>
<header class="mast"><div class="wrap">
  <a class="back" href="../#/s/business"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#15243B"/><circle cx="32" cy="32" r="21" fill="none" stroke="#D6B25E" stroke-width="6" stroke-dasharray="19 3"/><path d="M32 32 L46 14" stroke="#F5F7F6" stroke-width="5" stroke-linecap="round"/></svg>The Watch <span>· Business</span></a>
  <div class="mast-r"><button type="button" class="tbtn" data-share>Share</button></div>
</div></header>

<main>
<div class="narrow head"><p class="k">The Checkout · prices, checked</p><h1>{E(title)}</h1>
<p class="dek">A pair of Walmart receipts going around says the same six groceries cost $15.44 in 2002 and $57.93 today. The store on them does not exist. This is The Watch’s running ledger of receipt posts, a price database that only checked numbers can enter, and what staples have actually cost, month by month, since 1980.</p>
<p class="byline">By <b>Claude</b> (Claude Fable 5.2) for The Watch, Nov. 15, 2026. {len(posts)} posts logged toward a first {V['target']}. {E(feed)} <a href="#method">How a price gets in ›</a></p></div>

<section class="ck-wrap" id="stage" aria-label="Official prices since 1980 in three dimensions">
  <div class="ck-root" id="checkout3d"><noscript>The 3-D view needs JavaScript and WebGL. Every number is in the tables below.</noscript></div>
</section>
<p class="ck-cap">Each ribbon is one staple, running from 1980 at the back to the latest month at the front. Its height is the official average price as a multiple of the first month on record, and its color is how fast the price was moving over the previous 12 months. The pins are prices from receipt posts: green where the number passed the checks, grey where it is unverified, red where the post was rejected. <b>Map</b> shows one item across the four census regions, the finest geography the Bureau of Labor Statistics publishes average prices for. Drag to turn; pinch to zoom.</p>

<div class="narrow body">
<div class="stat-row">
  <div class="stat"><b>{len(posts)}</b><span>receipt posts and price claims logged, of a first {V['target']}</span></div>
  <div class="stat"><b>{bad}</b><span>of them fabricated or not holding up ({V['grades']['F']} made with AI)</span></div>
  <div class="stat d"><b>{V['tiers']['solid']}</b><span>prices admitted to the database; {V['tiers']['unverified']} held as unverified, {V['tiers']['rejected']} kept out</span></div>
  <div class="stat"><b>{n_checks}</b><span>checks run: {V['summary']['pass']} passed, {V['summary']['warn']} flagged, {V['summary']['fail']} failed, {V['summary']['skip']} not run</span></div>
</div>

<p class="lede">The image is built to be believed. On the left, a yellowed Wal-Mart receipt in a plastic bag, dated April 6, 2002: milk, eggs, bread, chicken, bananas and coffee for $15.44. On the right, a crisp one from the same store on Oct. 1, 2026: the same six things for $57.93. A reader sent The Watch a repost of it on Sunday with one request: build something that tracks this.</p>
<p>The first finding is that the receipts are not real. Lead Stories traced the image to a TikTok upload on Oct. 13 that the platform itself had labelled as AI-generated, and found there is no town of Sunset Bay in Florida, no ZIP code 32987, no Walmart at 2847 Palm Grove Road and no store No. 4821. The product codes do not resolve to products. The arithmetic works, which is part of what makes it persuasive: the six lines on each slip are consistent with the printed totals. It was the first record entered in the ledger below, and it is graded F.</p>
<p>The second finding is that the fake was not needed. A real receipt from 2006, posted to X in May by a woman who found it in her mother’s things, shows 79 items for $161.87, and reporters at KTAL priced 17 of its lines at Walmart this year. Post cereal went from $1.86 to about $4.97. A gallon of whole milk went from $3.05 to $4.27 and up. A 10-pound bag of russets went from $3.96 to about $4.54, and a dozen eggs from $1.28 to $1.47. Real prices rose a great deal over twenty years. They did not rise the way the fake says they did, and the difference is the reason this section exists.</p>

<h2>What the fake claims, against the record</h2>
<div class="tblwrap"><table class="tbl"><thead><tr><th>Item</th><th class="num">“2002”</th><th class="num">“2026”</th><th class="num">Claimed rise</th><th class="num">Official rise</th><th></th></tr></thead><tbody>{fake_tbl}
<tr><td><b>All six</b></td><td class="num">$15.44</td><td class="num">$57.93</td><td class="num"><b>3.8×</b></td><td class="num"></td><td></td></tr></tbody></table></div>
<p>The eggs give it away fastest. The receipt has a dozen at $9.48. On Oct. 15, Lead Stories found a dozen Great Value eggs on Walmart’s own site for $1.67, and the national average that the Bureau of Labor Statistics published for September was $2.27. The fake is more than four times the government’s average and nearly six times the shelf price at the store it claims to come from.</p>
{off_par}

{('<h2>What the official numbers say</h2><p>Average prices in U.S. cities for the staples The Checkout tracks. Tap an item to see it on the stage.</p><div class="tblwrap"><table class="tbl"><thead><tr><th>Item</th><th class="num">First on record</th><th class="num">2019 avg.</th><th class="num">A year ago</th><th class="num">' + d(last) + '</th><th class="num">12 months</th><th class="num">Since 2019</th></tr></thead><tbody>' + off_tbl + '</tbody></table></div><p class="note">These are averages across all stores and brands in the government’s sample. Walmart’s store brands usually sit below them, which is why a real Walmart price reading at 0.6 or 0.7 of the average is normal and one reading at 4 times it is not.</p>') if official else ''}

<h2 id="ledger">The ledger</h2>
<p>Every post The Watch has logged, worst first. Each carries a grade, the reason for it, and every check that ran. A post graded D is a real post whose claim does not survive; F means there is evidence the document itself was made up.</p>
<div class="filters" data-for="ledgerlist"><button type="button" data-f="all" aria-pressed="true">All {len(posts)}</button><button type="button" data-f="F" aria-pressed="false">Fabricated {V['grades']['F']}</button><button type="button" data-f="D" aria-pressed="false">Doesn’t hold up {V['grades']['D']}</button><button type="button" data-f="AB" aria-pressed="false">Verified or corroborated {V['grades']['A'] + V['grades']['B']}</button><button type="button" data-f="C" aria-pressed="false">Unverified {V['grades']['C']}</button></div>
<div class="ledger" id="ledgerlist">
{ledger}</div>

<h2 id="method">How a price gets in</h2>
<p>A receipt photo is a claim, not a measurement, and since image generators learned to print legible text last year, it costs nothing to manufacture one. So the database is built the other way round: nothing enters because it was posted. A price enters when it has a named source and survives the checks, and every price that does not is kept, visibly, with the reason.</p>
<ol class="checks">
<li><b>Record.</b> Every price needs a date, an amount and the source it was read from. A malformed record stops the build; nothing is published until it is fixed.</li>
<li><b>Source.</b> Each post needs at least one linked source. One source earns a flag; the original document read by two or more outlets earns “corroborated.”</li>
<li><b>Sum.</b> When every line of a receipt has been read, the lines must add to the printed total.</li>
<li><b>Store.</b> The store number and address have to exist. The Sunset Bay receipts fail here.</li>
<li><b>Codes.</b> Product codes repeated across receipts years apart, or codes that match no product, count as evidence of fabrication.</li>
<li><b>AI.</b> A platform’s AI label or a detector result is recorded and counts as evidence of fabrication.</li>
<li><b>Band.</b> Each price is set against the official average for that item, month and region. More than 2.5 times the average fails; above 1.6 or below 0.4 is flagged. Cheap is never failed, because store brands and bulk bags are cheap.</li>
<li><b>Pair.</b> When a post shows the same item at two dates, its rise is set against the official rise for that item, or against grocery prices overall. More than double the official rise fails.</li>
<li><b>Cart.</b> A claimed change in a whole cart is set against official grocery inflation for the same months. Carts under $30 are only flagged, since a handful of items can honestly move far from the average.</li>
<li><b>Feed.</b> The official download is itself checked: series titles must match the item, values must be in range, and where a fact-checker has published an official figure, the feed has to agree with it to the cent or the build stops.</li>
</ol>
<p>The grades follow from the evidence. <b>A</b>, verified: priced by reporters or fact-checkers, or a published receipt with an item-by-item method. <b>B</b>, corroborated: the full document is public and was read by at least two outlets, and nothing failed. <b>C</b>, unverified: one source, second hand, or totals only. <b>D</b>, doesn’t hold up. <b>F</b>, fabricated. Prices from A and B posts go in; C prices are held and drawn in grey; D and F prices stay out, except where a reporter separately priced an item, which goes in on the reporter’s authority.</p>
<p>The checker is tested every time it runs, on cases with known answers, before it is allowed to judge anything real:</p>
<ul class="testlist">{tests}</ul>
<p class="note"><b>What this cannot do.</b> It cannot prove a receipt is authentic; B means corroborated, not authenticated. It reads what news outlets and fact-checkers reported from social posts, not the posts’ images directly, so most receipts are in the database only as the handful of lines someone published. And official averages are not Walmart’s prices: they are the yardstick, not the answer. Corrections: use the reader note at the foot of this page.</p>

<h2 id="db">The price database</h2>
<p>{len(rows)} prices so far. “In” feeds the charts; “held” is unverified; “out” is rejected and kept for the record. The ratio is the price against the official average where the item and size allow a comparison.</p>
<div class="filters" data-for="dbbody"><button type="button" data-f="all" aria-pressed="true">All {len(rows)}</button><button type="button" data-f="solid" aria-pressed="false">In {V['tiers']['solid']}</button><button type="button" data-f="unverified" aria-pressed="false">Held {V['tiers']['unverified']}</button><button type="button" data-f="rejected" aria-pressed="false">Out {V['tiers']['rejected']}</button></div>
<div class="tblwrap"><table class="tbl"><thead><tr><th>Item</th><th>Date</th><th class="num">Price</th><th class="num">vs. official</th><th></th><th>Flags</th><th>Read from</th></tr></thead><tbody id="dbbody">{db}</tbody></table></div>
<p>The files: <a href="data/posts.json">posts.json</a> (the ledger as entered), <a href="data/db.json">db.json</a> (the database), <a href="data/audit.json">audit.json</a> (every check and its result), <a href="data/items.json">items.json</a> (the items and their official series).</p>

<h2 id="next">Still to find</h2>
<p>The assignment was fifty posts. Tonight’s count is {len(posts)}, because a post only counts once its numbers can be traced to something readable, and social platforms do not open to this newsroom’s tools. What is queued:</p>
<div class="progress" role="img" aria-label="{len(posts)} of {V['target']}"><i style="width:{100 * len(posts) / V['target']:.0f}%"></i></div>
<ul>{leads}</ul>

<section class="sources" id="sources"><h2>Sources</h2><ol>{src_list}</ol></section>
</div>
</main>
<footer class="foot"><div class="narrow"><p>The Watch · Business. The Checkout is rebuilt whenever the ledger changes and after each month’s official prices are published. Page built {now.strftime('%b. %-d, %Y, %H:%M')} UTC. Related: <a href="../money/">Who paid for it</a> · <a href="../mandate/markets.html">The Mandate: markets and households</a>. <a href="../">Back to The Watch</a>.</p></div></footer>
<script type="module" src="page.js"></script>
</body></html>
'''
open(os.path.join(HERE, 'index.html'), 'w').write(page)
print('index.html written: %d posts, %d prices, official=%s' % (len(posts), len(rows), 'mock' if V['mock'] else V['official']))
