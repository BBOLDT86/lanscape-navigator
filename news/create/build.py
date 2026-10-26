#!/usr/bin/env python3
"""Builds the two Create documents from catalog.json:

  news/create/portfolio/index.html   Scrolls — Create Product Line Portfolio (SCR-CRT-2026-002)
  news/create/spec/index.html        Scrolls — Create · Engineering Build Specification (SCR-CRT-ENG-2026-002)

  python3 news/create/build.py

The catalog is the single source of truth; The Watch's Create hub (news/create/app.js) and Create · Home
(news/create/index.html) read the same file, so the documents, the hub and the launcher never disagree.
Standard library only."""
import html, json, os, datetime, collections

HERE = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(HERE, 'catalog.json'), encoding='utf-8'))
E = html.escape
DATE = datetime.date.fromisoformat(C['date']).strftime('%B %d, %Y').replace(' 0', ' ')
LINES = {l['k']: l for l in C['lines']}
P = C['products']
BY_LINE = collections.OrderedDict((l['k'], [p for p in P if p['line'] == l['k']]) for l in C['lines'])
ST = collections.Counter(p['status'] for p in P)
STATUS = {'live': 'Live', 'building': 'In build', 'planned': 'Specified'}
SYNC = C['syncPatterns']
PUB = C['public'] + 'create/'

CSS = """
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=JetBrains+Mono:wght@400;500&display=swap');
:root {
  --bg:#F8F7F4; --surface:#fff; --ink:#1a1a1a; --text2:#777; --text3:#aaa;
  --border:rgba(0,0,0,.07); --border2:rgba(0,0,0,.12);
  --a:#C2785C; --a-bg:#FBF3EE; --a-glow:rgba(194,120,92,.1);
  --b:#5B7FA1; --b-bg:#EEF3F8; --b-glow:rgba(91,127,161,.1);
  --t:#8B7355; --t-bg:#F5F0E8; --t-glow:rgba(139,115,85,.1);
  --green:#4a9; --green-bg:rgba(68,170,153,.08);
  --plum:#7B6A8E; --plum-bg:rgba(123,106,142,.1);
  --code-bg:#1a1815; --code-fg:#d4c8b0;
  --r1:8px; --r2:14px; --r3:20px; --r4:28px;
  --sh1:0 1px 3px rgba(0,0,0,.04); --sh2:0 4px 20px rgba(0,0,0,.07); --sh3:0 12px 40px rgba(0,0,0,.1);
  --ease:cubic-bezier(.16,1,.3,1);
}
*{margin:0;padding:0;box-sizing:border-box}
html{font-size:16px;-webkit-font-smoothing:antialiased}
body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--ink);line-height:1.65}
a{color:var(--t)}
.cover{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:3rem 1.5rem;background:linear-gradient(160deg,#1a1815 0%,#252118 50%,#1e1c17 100%);position:relative;overflow:hidden}
.cover::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 500px 350px at 25% 35%,var(--a-glow) 0%,transparent 70%),radial-gradient(ellipse 500px 350px at 75% 65%,var(--b-glow) 0%,transparent 70%),radial-gradient(ellipse 300px 300px at 50% 50%,var(--t-glow) 0%,transparent 70%);opacity:.6;pointer-events:none}
.cover-logo{width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg,var(--a),var(--t),var(--b));display:flex;align-items:center;justify-content:center;box-shadow:0 8px 30px rgba(139,115,85,.3);margin-bottom:2rem;position:relative}
.cover-logo svg{width:40px;height:40px}
.cover-company{font-size:.65rem;font-weight:700;letter-spacing:.35em;text-transform:uppercase;color:var(--t);margin-bottom:.5rem;position:relative}
.cover h1{font-family:'Instrument Serif',Georgia,serif;font-size:clamp(2.6rem,6vw,4.5rem);font-weight:400;color:#F8F7F4;letter-spacing:-.03em;line-height:1.05;margin-bottom:.4rem;position:relative}
.cover-sub{font-size:.88rem;color:#a39a8e;margin-bottom:2.5rem;position:relative;max-width:400px;line-height:1.5}
.cover-meta{display:flex;gap:2rem;flex-wrap:wrap;justify-content:center;position:relative}
.cover-meta dt{font-size:.58rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--text3);margin-bottom:.2rem}
.cover-meta dd{font-family:'Instrument Serif',Georgia,serif;font-size:.95rem;color:#F8F7F4}
.cover-nav{position:relative;margin-top:2.5rem;display:flex;gap:1.25rem;flex-wrap:wrap;justify-content:center;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase}
.cover-nav a{color:#c9bca8;text-decoration:none;border-bottom:1px solid rgba(201,188,168,.3);padding-bottom:2px}
.doc-header{background:var(--ink);padding:2.5rem 1.5rem;text-align:center}
.doc-header .co{font-size:.6rem;font-weight:700;letter-spacing:.35em;text-transform:uppercase;color:var(--t);margin-bottom:.4rem}
.doc-header h1{font-family:'Instrument Serif',Georgia,serif;font-size:2.2rem;font-weight:400;color:#F8F7F4;margin-bottom:.3rem;letter-spacing:-.02em}
.doc-header .sub{font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;color:var(--text3)}
.doc-header .meta{display:flex;gap:1.5rem;justify-content:center;flex-wrap:wrap;margin-top:1.25rem;font-size:.74rem;color:var(--text3)}
.doc-header .meta strong{color:var(--t)}
.page{max-width:880px;margin:0 auto;padding:3rem 1.5rem}
.divider{width:48px;height:2px;background:var(--t);margin:2.5rem 0}
.sec-label{font-size:.58rem;font-weight:700;letter-spacing:.3em;text-transform:uppercase;color:var(--t);margin-bottom:.5rem}
h2{font-family:'Instrument Serif',Georgia,serif;font-size:2rem;font-weight:400;letter-spacing:-.02em;margin-bottom:1rem}
h3{font-size:1rem;font-weight:700;color:var(--t);margin:1.5rem 0 .5rem}
h4{font-size:.82rem;font-weight:700;color:var(--ink);margin:.85rem 0 .35rem}
p,li{color:var(--text2);font-size:.9rem;margin-bottom:.6rem}
ul,ol{padding-left:1.4rem;margin-bottom:.85rem}
li{margin-bottom:.25rem}
strong{color:var(--ink);font-weight:600}
code{font-family:'JetBrains Mono',monospace;font-size:.82em;background:rgba(139,115,85,.08);padding:.1rem .35rem;border-radius:3px}
pre{background:var(--code-bg);color:var(--code-fg);font-family:'JetBrains Mono',monospace;font-size:.75rem;padding:1.1rem 1.3rem;border-radius:var(--r1);overflow-x:auto;margin:.85rem 0 1.25rem;line-height:1.6;border:1px solid rgba(139,115,85,.12)}
pre code{background:none;padding:0;font-size:inherit}
.exec-box{background:var(--t-bg);border-left:3px solid var(--t);padding:1.75rem 2rem;border-radius:0 var(--r2) var(--r2) 0;margin:1.5rem 0 2.5rem}
.exec-box p{font-family:'Instrument Serif',Georgia,serif;font-size:1.08rem;line-height:1.7;color:var(--ink);margin:0}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.75rem;margin:1.25rem 0 2rem}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:1rem 1.1rem}
.stat b{display:block;font-family:'Instrument Serif',Georgia,serif;font-size:2rem;font-weight:400;line-height:1;color:var(--ink)}
.stat span{font-size:.62rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--t)}
.arch-callout{background:var(--ink);border-radius:var(--r3);padding:2.5rem 2rem;margin:2rem 0;position:relative;overflow:hidden}
.arch-callout::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(139,115,85,.08),transparent 70%)}
.arch-callout h3{font-family:'Instrument Serif',Georgia,serif;font-size:1.3rem;font-weight:400;color:#F8F7F4;margin:0 0 1.5rem;text-align:center;position:relative}
.arch-flow{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:.6rem;position:relative}
.arch-chip{padding:.5rem 1rem;border-radius:var(--r1);font-size:.7rem;font-weight:600;letter-spacing:.04em;background:rgba(248,247,244,.06);border:1px solid rgba(139,115,85,.25);color:rgba(248,247,244,.7)}
.arch-chip.peer{background:rgba(139,115,85,.15);border-color:var(--t);color:#d6b25e;padding:.65rem 1.5rem;font-size:.8rem}
.arch-chip.server{background:rgba(91,127,161,.12);border-color:var(--b);color:#9fb7d0}
.arch-chip.live{border-color:var(--green);color:#8fd4c4}
.arch-chip.future{border-style:dashed;opacity:.45}
.arch-arrow{color:var(--t);font-size:1.1rem;opacity:.4}
.line-head{display:flex;align-items:center;gap:1rem;margin:2.75rem 0 .5rem}
.line-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.25rem;flex-shrink:0;color:#fff}
.line-head h3{margin:0;font-family:'Instrument Serif',Georgia,serif;font-size:1.6rem;font-weight:400;color:var(--ink)}
.line-head .n{font-size:.62rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--text3);margin-left:auto;white-space:nowrap}
.line-dek{font-style:italic;color:var(--text2);margin-bottom:.5rem}
.product-grid{display:grid;gap:1.25rem;margin:1.25rem 0 .5rem}
.product-card{background:var(--surface);border-radius:var(--r3);padding:1.75rem;border:1px solid var(--border);position:relative;overflow:hidden;transition:all .3s var(--ease)}
.product-card:hover{box-shadow:var(--sh2);transform:translateY(-2px)}
.product-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--pc)}
.p-head{display:flex;align-items:flex-start;gap:1rem;margin-bottom:1rem}
.p-icon{width:46px;height:46px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.2rem;background:var(--pbg);color:var(--pc)}
.p-line{font-size:.5rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--text3)}
.p-name{font-family:'Instrument Serif',Georgia,serif;font-size:1.45rem;font-weight:400;letter-spacing:-.01em;line-height:1.2}
.p-tag{font-size:.8rem;color:var(--text3);font-style:italic;margin-top:.1rem}
.p-badges{display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.4rem}
.p-free,.p-st{display:inline-block;font-size:.55rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:.15rem .5rem;border-radius:4px}
.p-free{background:var(--green-bg);color:var(--green)}
.p-st.live{background:var(--green-bg);color:var(--green)}.p-st.building{background:var(--a-bg);color:var(--a)}.p-st.planned{background:rgba(0,0,0,.04);color:var(--text2)}
.p-desc{font-size:.88rem;color:var(--text2);margin-bottom:1.1rem;line-height:1.65}
.spec-cols{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
@media (max-width:600px){.spec-cols{grid-template-columns:1fr}}
.spec-col h4{font-size:.55rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--t);margin:0 0 .35rem;padding-bottom:.25rem;border-bottom:1px solid rgba(139,115,85,.15)}
.spec-col ul{list-style:none;padding:0;margin:0}
.spec-col li{font-size:.78rem;color:var(--text2);padding:.15rem 0 .15rem .85rem;position:relative;margin:0}
.spec-col li::before{content:'›';position:absolute;left:0;color:var(--t);font-weight:700}
.tech-row{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:1rem;padding-top:.75rem;border-top:1px solid var(--border);align-items:center}
.tech-badge{font-family:'JetBrains Mono',monospace;font-size:.6rem;font-weight:500;padding:.2rem .55rem;border-radius:4px;background:rgba(0,0,0,.03);color:var(--text2);border:1px solid var(--border)}
.tech-row .open{margin-left:auto;font-size:.72rem;font-weight:600;color:var(--t);text-decoration:none}
.tech-row .open:hover{text-decoration:underline}
.dtable,table{width:100%;border-collapse:collapse;margin:1.25rem 0;font-size:.82rem}
thead th{font-size:.55rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--t);padding:.55rem .75rem;text-align:left;border-bottom:2px solid var(--t)}
tbody td{padding:.5rem .75rem;border-bottom:1px solid var(--border);color:var(--text2);vertical-align:top}
tbody tr:hover{background:rgba(139,115,85,.03)}
.mono{font-family:'JetBrains Mono',monospace;font-size:.74rem}
.tw{overflow-x:auto}
.callout{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--t);border-radius:0 var(--r1) var(--r1) 0;padding:1.25rem 1.5rem;margin:.85rem 0 1.25rem}
.callout.warn{border-left-color:#c25555;background:#fffaf8}
.callout.info{border-left-color:var(--b);background:#f8fafc}
.callout h4{margin-top:0;color:var(--ink)}
.callout ul{margin-bottom:0}
.toc{background:var(--t-bg);border-radius:var(--r2);padding:1.5rem;margin:1.25rem 0 2rem}
.toc h3{margin-top:0;color:var(--ink);font-size:.95rem}
.toc ol{padding-left:1.1rem;columns:2;column-gap:2rem}
@media (max-width:600px){.toc ol{columns:1}}
.toc li{font-size:.82rem;color:var(--text2);padding:.1rem 0}
.toc a{color:var(--t);text-decoration:none}.toc a:hover{text-decoration:underline}
.roadmap{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:1.25rem;margin:1.5rem 0}
.phase{background:var(--surface);border-radius:var(--r2);padding:1.5rem;border:1px solid var(--border)}
.phase-q{font-size:.55rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:.2rem}
.phase h4{font-family:'Instrument Serif',Georgia,serif;font-size:1.05rem;font-weight:400;margin:0 0 .6rem}
.phase ul{list-style:none;padding:0}
.phase li{font-size:.76rem;color:var(--text2);padding:.2rem 0 .2rem .75rem;position:relative}
.phase li::before{content:'○';position:absolute;left:0;font-size:.42rem;top:.35rem;color:var(--t)}
.principles{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:1rem;margin:1.25rem 0}
.principle{background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:1.25rem}
.principle b{display:block;font-family:'Instrument Serif',Georgia,serif;font-size:1.2rem;font-weight:400;margin-bottom:.3rem;color:var(--ink)}
.principle p{font-size:.8rem;margin:0}
.doc-foot{text-align:center;padding:2.5rem 1.5rem;border-top:1px solid var(--border);margin-top:2.5rem}
.doc-foot p{font-size:.7rem;color:var(--text3);margin:.2rem 0}
@media print{.cover{min-height:auto;padding:2rem}.product-card{break-inside:avoid}}
"""

def color(c):
    return {'a': ('var(--a)', 'var(--a-bg)'), 'b': ('var(--b)', 'var(--b-bg)'), 't': ('var(--t)', 'var(--t-bg)'),
            'green': ('var(--green)', 'var(--green-bg)'), 'plum': ('var(--plum)', 'var(--plum-bg)')}.get(c, ('var(--t)', 'var(--t-bg)'))

def href(p):
    """Where a product opens, relative to news/create/<doc>/ (one folder down from news/create/)."""
    if p['status'] == 'live' and p.get('href'):
        h = p['href']
        if h == 'create/': return '../'
        return '../../' + h if not h.startswith('../') else '../' + h
    if p['status'] == 'building': return '../apps/%s/' % p['id']
    return None

def card(p, doc):
    pc, pbg = color(p.get('c', 't'))
    line = LINES[p['line']]
    link = href(p)
    sync = SYNC[p['sync']]['name'] if p.get('sync') else '—'
    extra = []
    if p.get('reference'): extra.append('<span class="p-st live">Reference build</span>')
    tech = ''.join('<span class="tech-badge">%s</span>' % E(t) for t in p.get('tech', []))
    if link:
        label = 'Open' if p['status'] == 'live' else 'Open the build'
        tech += '<a class="open" href="%s">%s ›</a>' % (E(link), label)
    return f"""
    <div class="product-card" id="p-{p['id']}" style="--pc:{pc};--pbg:{pbg}">
      <div class="p-head">
        <div class="p-icon">{E(p['icon'])}</div>
        <div>
          <span class="p-line">Scrolls · Create · {E(line['name'])}</span>
          <div class="p-name">{E(p['name'])}</div>
          <div class="p-tag">“{E(p['tag'])}”</div>
          <div class="p-badges"><span class="p-free">Free</span><span class="p-st {p['status']}">{STATUS[p['status']]}</span>{''.join(extra)}</div>
        </div>
      </div>
      <p class="p-desc">{E(p['desc'])}</p>
      <div class="spec-cols">
        <div class="spec-col"><h4>Functions</h4><ul>{''.join('<li>%s</li>' % E(f) for f in p['functions'])}</ul></div>
        <div class="spec-col"><h4>Specs</h4><ul>{''.join('<li>%s</li>' % E(s) for s in p['specs'])}</ul></div>
      </div>
      <div class="tech-row">{tech}</div>
    </div>"""

def glance_rows():
    out = []
    for p in P:
        sync = SYNC[p['sync']]['name'] if p.get('sync') else '—'
        out.append('<tr><td><strong><a href="#p-%s" style="text-decoration:none;color:inherit">%s</a></strong></td><td class="mono">%s</td><td>%s</td><td>%s</td><td><span class="p-st %s">%s</span></td><td class="mono">&lt; %d KB</td></tr>'
                   % (p['id'], E(p['name']), E(p['file']), E(LINES[p['line']]['name']), E(sync), p['status'], STATUS[p['status']], p['budget']))
    return ''.join(out)

def desk_rows():
    names = {'hobbies': 'Hobbies', 'lifestyle': 'Lifestyle', 'home': 'Home (and Food, Household)', 'travel': 'Travel', 'household': 'Household', 'cars': 'Cars', 'sports': 'Sports', 'health': 'Health'}
    out = []
    for l in C['lines']:
        ps = BY_LINE[l['k']]
        live = [p['name'] for p in ps if p['status'] == 'live']
        out.append('<tr><td><strong>%s</strong></td><td>%s</td><td>%s</td><td>%s</td></tr>' % (
            E(l['name']), E(names.get(l['desk'], 'The Create section only') if l['desk'] else 'The Create section only'),
            E(', '.join(p['name'].replace('Create · ', '') for p in ps)), E(', '.join(live) or '—')))
    return ''.join(out)

# ───────────────────────────── the portfolio ─────────────────────────────
def portfolio():
    n_lines, n = len(C['lines']), len(P)
    live, building, planned = ST['live'], ST['building'], ST['planned']
    sections = []
    sections.append(f"""
  <div class="sec-label" id="s1">Section 01</div>
  <h2>Executive Summary</h2>
  <div class="exec-box">
    <p><strong>Create</strong> is Scrolls' product line of free, single-file HTML applications that connect <strong>peer to peer</strong> over WebRTC. There are no servers, no accounts, no databases and no subscriptions. You open one file and work; to work with someone, you share a six-letter code and your two devices talk directly. This edition grows the line from seven work tools to <strong>{n} products in {n_lines} lines</strong> — Work, Hobby, Relationships, Home &amp; Food, Travel, Money, Garage, Sports &amp; Games and Body — and moves it inside <strong>The Watch</strong>, where each line sits on the desk its readers already use. <strong>{live} are live</strong> today (Vision, Together / 90, Date Night and Create · Home), <strong>{building} are in build</strong> this wave, and <strong>{planned} are specified</strong> to the data model. The reference architecture is no longer a design: it is the shipped Vision, Rev 2.</p>
  </div>
  <div class="stats">
    <div class="stat"><b>{n_lines}</b><span>Lines</span></div><div class="stat"><b>{n}</b><span>Products</span></div><div class="stat"><b>{live}</b><span>Live</span></div><div class="stat"><b>{building}</b><span>In build</span></div><div class="stat"><b>{planned}</b><span>Specified</span></div><div class="stat"><b>$0</b><span>Forever</span></div>
  </div>
  <div class="principles">{''.join('<div class="principle"><b>%s</b><p>%s</p></div>' % (E(a), E(b)) for a, b in C['principles'])}</div>
""")
    sections.append("""
  <div class="divider"></div>
  <div class="sec-label" id="s2">Section 02</div>
  <h2>What Changed Since 1.0</h2>
  <ul>
    <li><strong>The reference build shipped.</strong> Vision went live at <code>vision/</code> as Rev 2: a stable six-letter device code instead of a random peer id, per-field last-writer-wins stamps instead of whole-record replacement, a <code>hello</code> / <code>put</code> protocol instead of resending the whole state on every change, an accept step for a device the board hasn't seen, automatic reconnection, soft deletes, QR pairing, and a board that travels as a compressed link. Every product now inherits that, not the 1.0 sketch. The build spec (SCR-CRT-ENG-2026-002) documents it as <strong>protocol v2</strong>.</li>
    <li><strong>Create lives inside The Watch.</strong> The static home is <code>news/create/</code> on the same GitHub Pages site as the paper; the Create section (<code>#/create</code>) is drawn from the same <code>catalog.json</code> as this document; and each line has a band on the desk it belongs to (Hobby on Hobbies, Relationships on Lifestyle, and so on). Readers find the tool next to the reading.</li>
    <li><strong>Nine lines, not one.</strong> The Hobby and Relationships lines come first because The Watch already had the readers for them — the Hobbies desk's three pursuits and the Lifestyle desk's two-person tools. Home &amp; Food, Travel, Money, Garage, Sports &amp; Games and Body follow the other desks.</li>
    <li><strong>Three live products folded in.</strong> Vision, Together / 90 and Date Night were built before the line existed; they are its first members, listed as live, and their storage keys are left as they were.</li>
    <li><strong>Storage keys</strong> are now <code>create.&lt;id&gt;.v1</code> and <code>create.&lt;id&gt;.inbox</code>, matching the shipped <code>vision.v1</code> / <code>vision.inbox</code>. The 1.0 <code>crt_*_v1</code> names were never used by a shipped file.</li>
    <li><strong>The Work line moved to Wave 3.</strong> It is unchanged in scope; it waits for the two lines readers asked for first.</li>
  </ul>
""")
    sections.append(f"""
  <div class="divider"></div>
  <div class="sec-label" id="s3">Section 03</div>
  <h2>Architecture — How Create Works</h2>
  <p>Every product is a self-contained HTML file with PeerJS loaded from a CDN. On first run it gives itself a <strong>six-letter device code</strong> (the same alphabet as Vision: no 0/O, 1/I/L) and that code is its PeerJS id for life — <code>create-&lt;prefix&gt;-&lt;code&gt;</code>. One person shows or sends the code; the other types it or scans the QR. PeerJS's free cloud server introduces the two browsers, and from then on everything travels over a WebRTC data channel between them. The server never sees the data and is not needed again until a device changes networks.</p>
  <p><strong>The sync cycle.</strong> When two devices connect, the dialer says <code>hello</code> with its whole state; the other side, having let it in, answers with its own. After that every change is a <code>put</code> of the changed items. Each item carries a stamp per field, so when both people edited the same thing offline the newer write of each field wins — no conflict dialogs, no lost edits. Deletes are soft: an item is marked gone and the mark syncs like any other field.</p>
  <p><strong>The inbox handoff.</strong> Products talk to each other the way The Watch talks to Vision: through a small array in the browser's own storage, <code>create.&lt;id&gt;.inbox</code>. Cookbook leaves ingredients for Pantry, Circle leaves gift ideas for Gift, Trip leaves spending for Split, Date Night and Weekender leave evenings and weekends for Week. The next time the receiving product is open it drains the inbox, saves, and syncs the new items to its partner. No product ever needs another one to be open.</p>
  <p><strong>Pictures</strong> are base64 data URIs, resized on import and capped at 2 MB; products that carry them split large messages into 128 KB chunks. <strong>Multi-person products</strong> (Form, Pool, Gift, a Trip with three travelers) use the hub pattern: one device hosts, guests connect to its code, the host merges and re-sends. <strong>Vault and Net</strong> encrypt every entry with AES-256-GCM before it reaches storage or the wire.</p>
  <p><strong>The static home</strong> — <code>{E(PUB)}</code> — is a page, not a service: the catalog, the launcher, the downloads, this document and the build spec. The same <code>catalog.json</code> drives The Watch's Create section, so the paper and the launcher never disagree.</p>
  <div class="arch-callout">
    <h3>Create — topology</h3>
    <div class="arch-flow">
      <span class="arch-chip live">Vision</span><span class="arch-chip">Practice</span><span class="arch-chip">Scoresheet</span><span class="arch-chip">Cutlist</span><span class="arch-chip">Felt</span>
      <span class="arch-arrow">⇄</span><span class="arch-chip peer">PeerJS · WebRTC data channel</span><span class="arch-arrow">⇄</span>
      <span class="arch-chip">Circle</span><span class="arch-chip">Split</span><span class="arch-chip">Week</span><span class="arch-chip">Gift</span><span class="arch-chip">… {n - 9} more</span>
    </div>
    <div class="arch-flow" style="margin-top:1rem">
      <span class="arch-chip server">The Watch · #/create</span><span class="arch-chip server">Create · Home (static)</span><span class="arch-chip">create.&lt;id&gt;.inbox</span><span class="arch-chip future">API bridge (future)</span>
    </div>
  </div>
""")
    sections.append(f"""
  <div class="divider"></div>
  <div class="sec-label" id="s4">Section 04</div>
  <h2>Inside The Watch</h2>
  <p>The Watch is the front door. Its Create section (<code>#/create</code>) is the catalog by line, with a page per line and per product; each line also has a band on the desk its readers already visit, and the Hobbies desk's three pursuits show their own tool. The live products open in place; the ones in build open their working file; the rest open their page in the spec.</p>
  <div class="tw"><table class="dtable"><thead><tr><th>Line</th><th>Desk</th><th>Products</th><th>Live today</th></tr></thead><tbody>{desk_rows()}</tbody></table></div>
""")
    sections.append(f"""
  <div class="divider"></div>
  <div class="sec-label" id="s5">Section 05</div>
  <h2>Product Line at a Glance</h2>
  <div class="tw"><table class="dtable"><thead><tr><th>Product</th><th>File</th><th>Line</th><th>Sync</th><th>Status</th><th>Budget</th></tr></thead><tbody>{glance_rows()}</tbody></table></div>
  <p>Every product is <strong>100% free</strong>. No tiers, no paywalls, no feature gates. Each ships as one downloadable HTML file; the gzipped budget is the size it must fit in without PeerJS, the one permitted external script.</p>
""")
    cat = []
    for l in C['lines']:
        pc, pbg = color(l['c'])
        ps = BY_LINE[l['k']]
        cat.append(f"""
    <div class="line-head" id="l-{l['k']}"><div class="line-icon" style="background:{pc}">{E(l['icon'])}</div><h3>{E(l['name'])}</h3><span class="n">{len(ps)} products · {sum(1 for p in ps if p['status']=='live')} live</span></div>
    <p class="line-dek">{E(l['dek'])}</p>
    <p>{E(l['about'])}</p>
    <div class="product-grid">{''.join(card(p, 'portfolio') for p in ps)}</div>""")
    sections.append(f"""
  <div class="divider"></div>
  <div class="sec-label" id="s6">Section 06</div>
  <h2>Product Catalog</h2>
  <p>By line. Each card is the product's contract: what it does, how it is built, and where it stands.</p>
  {''.join(cat)}
""")
    sections.append("""
  <div class="divider"></div>
  <div class="sec-label" id="s7">Section 07</div>
  <h2>Shared Technology Stack</h2>
  <div class="tw"><table class="dtable"><thead><tr><th>Layer</th><th>Technology</th><th>Notes</th></tr></thead><tbody>
    <tr><td><strong>P2P</strong></td><td class="mono">PeerJS 1.5.4 via jsDelivr</td><td>WebRTC data channels. The free signaling server introduces peers; a self-hosted one is a query parameter away (<code>?peer=host:port</code>).</td></tr>
    <tr><td><strong>Identity</strong></td><td class="mono">six-letter device code</td><td>Generated once per browser; the PeerJS id; shared as text, link or QR.</td></tr>
    <tr><td><strong>Persistence</strong></td><td class="mono">localStorage create.&lt;id&gt;.v1</td><td>One JSON object per product. Debounced writes; a full-storage toast rather than a crash.</td></tr>
    <tr><td><strong>Merge</strong></td><td class="mono">per-field stamps (_t)</td><td>Last writer wins per field; soft deletes; stamps are time × 100 + a per-device salt, monotonic.</td></tr>
    <tr><td><strong>Handoff</strong></td><td class="mono">localStorage create.&lt;id&gt;.inbox</td><td>Products and The Watch leave items for each other; drained on open and on the storage event.</td></tr>
    <tr><td><strong>Pictures</strong></td><td class="mono">FileReader → canvas resize → data URI</td><td>2 MB cap, resized on import; chunked over the wire at 128 KB.</td></tr>
    <tr><td><strong>Encryption</strong></td><td class="mono">Web Crypto (SubtleCrypto)</td><td>Vault and Net only. AES-256-GCM, PBKDF2 600,000 / SHA-256.</td></tr>
    <tr><td><strong>Typography</strong></td><td class="mono">Instrument Serif + DM Sans</td><td>Google Fonts; falls back to Georgia and the system sans. Vision's tokens for light and dark.</td></tr>
    <tr><td><strong>Backup</strong></td><td class="mono">Blob + createObjectURL; deflate-raw link</td><td>JSON for all; CSV, .ics, PNG and printable pages where the product calls for them.</td></tr>
    <tr><td><strong>Hosting</strong></td><td class="mono">file:// or GitHub Pages</td><td>Double-click to open, or open from The Watch. The same file either way.</td></tr>
  </tbody></table></div>
""")
    rows = ''.join('<tr><td><strong>%s</strong></td><td>%s</td><td>%s</td><td>%s</td></tr>' % (
        E(v['name']), E(', '.join(p['name'].replace('Create · ', '') for p in P if p.get('sync') == k) or '—'), E(v['how']), E(v['conflicts'])) for k, v in SYNC.items())
    sections.append(f"""
  <div class="divider"></div>
  <div class="sec-label" id="s8">Section 08</div>
  <h2>P2P Sync Patterns</h2>
  <div class="tw"><table class="dtable"><thead><tr><th>Pattern</th><th>Products</th><th>How it works</th><th>Conflicts</th></tr></thead><tbody>{rows}</tbody></table></div>
""")
    phases = ''.join(f"""
    <div class="phase"><div class="phase-q" style="color:{color(['a','t','b','green'][i % 4])[0]}">{E(w['when'])}</div><h4>{E(w['name'])}</h4><ul>{''.join('<li>%s</li>' % E(x) for x in w['items'])}</ul></div>""" for i, w in enumerate(C['roadmap']))
    sections.append(f"""
  <div class="divider"></div>
  <div class="sec-label" id="s9">Section 09</div>
  <h2>Roadmap — Four Waves</h2>
  <p>The 1.0 plan put the Work line first and ran by quarter. The 2.0 plan runs by wave and starts where the readers are: the lines whose desks already have an audience ship first, and each wave is a set of files that can go live one at a time.</p>
  <div class="roadmap">{phases}</div>
""")
    body = ''.join(sections)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Scrolls — Create Product Line Portfolio 2.0</title>
<meta name="description" content="Create: {E(C['tagline'])} {len(P)} products in {n_lines} lines, inside The Watch.">
<link rel="canonical" href="{E(PUB)}portfolio/">
<meta property="og:title" content="Scrolls — Create Product Line Portfolio 2.0">
<meta property="og:description" content="{E(C['tagline'])}">
<meta property="og:image" content="{E(C['public'])}share.png">
<style>{CSS}</style>
</head>
<body>
<section class="cover">
  <div class="cover-logo"><svg viewBox='0 0 48 48' fill='none' stroke='#fff' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M10 13a4 4 0 0 1 8 0v22a4 4 0 0 1-8 0z'/><path d='M18 13h18a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H18'/><path d='M25 21h9M25 27h9M25 33h5'/></svg></div>
  <p class="cover-company">Scrolls</p>
  <h1>Create</h1>
  <p class="cover-sub">{E(C['tagline'])}</p>
  <dl class="cover-meta">
    <div><dt>Document</dt><dd>{E(C['docs']['portfolio'])}</dd></div>
    <div><dt>Classification</dt><dd>Internal — Leadership</dd></div>
    <div><dt>Date</dt><dd>{E(DATE)}</dd></div>
    <div><dt>Version</dt><dd>{E(C['version'])}</dd></div>
    <div><dt>Author</dt><dd>Product Management</dd></div>
  </dl>
  <nav class="cover-nav"><a href="../">Create · Home</a><a href="../spec/">Build spec</a><a href="../../#/create">On The Watch</a></nav>
</section>
<div class="page">
{body}
  <div class="doc-foot">
    <p>Scrolls — Create Product Line — {E(C['docs']['portfolio'])} — Portfolio {E(C['version'])} — Internal Document</p>
    <p>Supersedes SCR-CRT-2026-001 (March 14, 2026). Built from <code>news/create/catalog.json</code>.</p>
    <p>© 2026 Scrolls. All rights reserved. All products free forever.</p>
  </div>
</div>
</body>
</html>
"""

# ───────────────────────────── the build spec ─────────────────────────────
def keys_rows():
    out = []
    for p in P:
        out.append('<tr><td>%s</td><td class="mono">%s</td><td class="mono">%s</td><td class="mono">%s</td><td class="mono">%s</td><td>%s</td></tr>' % (
            E(p['name']), E(p['file']), E(p.get('key') or '—'), E(('create-%s-' % p['prefix']) if p.get('prefix') and p['id'] != 'vision' else (p['prefix'] + '-' if p.get('prefix') else '—')),
            E(SYNC[p['sync']]['name'] if p.get('sync') else '—'), E(STATUS[p['status']])))
    return ''.join(out)

def budget_rows():
    out = []
    for p in P:
        b = p['budget']
        out.append('<tr><td>%s</td><td class="mono">%d KB</td><td class="mono">&lt; %dms</td><td class="mono">&lt; %dms</td></tr>' % (E(p['name']), b, 250 + (b // 20) * 10, 450 + (b // 10) * 25))
    return ''.join(out)

def models():
    out = []
    for l in C['lines']:
        ps = [p for p in BY_LINE[l['k']] if p.get('model')]
        if not ps: continue
        out.append('<h3>%s</h3>' % E(l['name']))
        for p in ps:
            out.append('<h4 id="m-%s">%s <span class="mono" style="color:var(--text3);font-weight:400">· %s · %s</span></h4><pre><code>%s</code></pre>' % (
                p['id'], E(p['name']), E(p.get('key') or ''), E(SYNC[p['sync']]['name'] if p.get('sync') else ''), E('\n'.join(p['model']))))
    return ''.join(out)

def spec():
    toc = [('s1', 'Reference Architecture (Vision Rev 2)'), ('s2', 'Single File Contract'), ('s3', 'P2P Layer — Protocol v2'), ('s4', 'Persistence — State, Stamps, Storage'),
           ('s5', 'The Inbox Handoff'), ('s6', 'Pictures — Resize and Chunking'), ('s7', 'Sync Patterns & Merge'), ('s8', 'Hub Pattern (Form, Pool, Gift, Trip)'),
           ('s9', 'Encryption Standard (Vault, Net)'), ('s10', 'Hidden Claims (Gift)'), ('s11', 'Per-Product Data Models'), ('s12', 'Create · Home and The Watch Hub'),
           ('s13', 'Testing & QA'), ('s14', 'Performance Budgets & Browser Matrix'), ('s15', 'API Bridge — Future Layer'), ('s16', 'Changes from 1.0')]
    gate = ''.join('<li>☐ %s</li>' % E(g) for g in C['gate'])
    body = f"""
<nav class="toc"><h3>Table of Contents</h3><ol>{''.join('<li><a href="#%s">%s</a></li>' % (a, E(b)) for a, b in toc)}</ol></nav>

<div class="divider"></div>
<div class="sec-label" id="s1">Section 01</div>
<h2>Reference Architecture (Vision Rev 2)</h2>
<p>Every Create product is built on the pattern that shipped in <code>vision/index.html</code>. The 1.0 spec described Vision as designed; this one describes Vision as built, which is stricter and better. Engineers replicate exactly this.</p>
<h3>1.1 — The pattern</h3>
<ol>
  <li><strong>One HTML file.</strong> Markup, CSS and JS in one file. External: PeerJS (jsDelivr), optionally qrcode-generator, Google Fonts. No build step, no bundler, no framework.</li>
  <li><strong>A stable device code.</strong> On first run the browser gives itself a six-letter code from the alphabet <code>ABCDEFGHJKMNPQRSTUVWXYZ23456789</code>; it is the PeerJS id (<code>create-&lt;prefix&gt;-&lt;code&gt;</code>) and never changes, so two devices that have met reconnect by themselves.</li>
  <li><strong>Two people, A and B.</strong> <code>S.me</code> is <code>'a'</code> or <code>'b'</code>; names live in <code>S.names</code>. If both devices think they are A, the one that joined moves to B. Multi-person products add a <code>people</code> map and the hub pattern.</li>
  <li><strong>Per-field last-writer-wins.</strong> Every synced record carries <code>_t</code>, a stamp per field. Merge takes the newer stamp field by field; a record never replaces another whole.</li>
  <li><strong>hello, then put.</strong> The first message on a connection carries the whole state; after that only changed items travel. Product-level fields (names, settings) travel as <code>meta</code>.</li>
  <li><strong>Let a new device in.</strong> A <code>hello</code> from a device the product has not paired with is held until the user accepts it. After that the device is remembered as the partner.</li>
  <li><strong>Soft deletes.</strong> <code>del: true</code> is a field like any other; nothing is ever removed from <code>items</code>.</li>
  <li><strong>localStorage, one key.</strong> <code>create.&lt;id&gt;.v1</code>, written debounced, with a full-storage toast rather than a crash. Other pages leave work in <code>create.&lt;id&gt;.inbox</code>.</li>
  <li><strong>Backup without a server.</strong> A JSON file; a deflate-raw link when the state is small; product exports (CSV, .ics, printable pages).</li>
  <li><strong>Offline first.</strong> With no PeerJS and no network the product does everything but sync, and says so in one line.</li>
</ol>
<h3>1.2 — What this means for engineering</h3>
<p>Do not over-architect. The code structure, naming and sync logic should be recognizable to anyone who has read Vision. The build brief that engineers (and the agents that build Wave 1) follow is <code>news/create/apps/BUILDING.md</code>; it is the normative short form of sections 2–5 below, with the test hooks the harness drives.</p>

<div class="divider"></div>
<div class="sec-label" id="s2">Section 02</div>
<h2>Single File Contract</h2>
<h3>2.1 — Canonical template</h3>
<pre><code>&lt;!doctype html&gt;
&lt;html lang="en"&gt;
&lt;head&gt;
&lt;meta charset="utf-8"&gt;
&lt;meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"&gt;
&lt;title&gt;Create · [Name]&lt;/title&gt;
&lt;meta name="description" content="…"&gt;
&lt;link rel="canonical" href="https://bboldt86.github.io/lanscape-navigator/news/create/apps/[id]/"&gt;
&lt;meta name="theme-color" content="#F8F7F4" media="(prefers-color-scheme: light)"&gt;
&lt;meta name="theme-color" content="#191613" media="(prefers-color-scheme: dark)"&gt;
&lt;link href="https://fonts.googleapis.com/css2?family=DM+Sans:…&amp;family=Instrument+Serif:ital@0;1&amp;display=swap" rel="stylesheet"&gt;
&lt;style&gt; /* Vision's tokens, light and dark; then the product */ &lt;/style&gt;
&lt;/head&gt;
&lt;body&gt;
  &lt;header&gt; name · Create wordmark · presence dot · Share · menu &lt;/header&gt;
  &lt;main id="app"&gt;&lt;/main&gt;
  &lt;aside class="sheet" role="dialog"&gt;&lt;/aside&gt;   &lt;!-- share / pair, settings, backup --&gt;
  &lt;div id="toast"&gt;&lt;/div&gt;
&lt;script src="https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js" defer&gt;&lt;/script&gt;
&lt;script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js" defer&gt;&lt;/script&gt;
&lt;script&gt;
(() =&gt; {{
'use strict';
const KEY = 'create.[id].v1', INBOX = 'create.[id].inbox', THEME = 'create.theme';
// ── helpers: LS, code6, uid, stamp, seeStamp, esc, fmt
// ── state: S, blankState(), load(), save(), setF(), create(), live(), mergeItem(), mergeMeta()
// ── sync: PID, peerOpts, startPeer, dial, wire, hello, broadcast, onMsg, acceptHello, askAccept, swapSlots
// ── inbox: drainInbox() on load and on 'storage'
// ── ui: render(), sheets (pair, settings, backup), toast, keyboard
// ── backup: exportJSON, importJSON, packLink, unpackLink, product exports
// ── boot
window.__create = {{ id, setup, code, pair, net, add, count, state, export }};  // test hooks
}})();
&lt;/script&gt;
&lt;/body&gt;
&lt;/html&gt;</code></pre>
<h3>2.2 — Product ids, files, keys and prefixes</h3>
<div class="tw"><table><thead><tr><th>Product</th><th>File</th><th>localStorage key</th><th>Peer id prefix</th><th>Sync</th><th>Status</th></tr></thead><tbody>{keys_rows()}</tbody></table></div>
<p>Hosted path: <code>news/create/apps/&lt;id&gt;/index.html</code>, served at <code>{E(PUB)}apps/&lt;id&gt;/</code>. The download link on Create · Home names the file <code>create-&lt;id&gt;.html</code>. Vision, Together / 90 and Date Night keep the paths and keys they shipped with.</p>
<div class="callout"><h4>Pre-ship gate — every Create product must pass</h4><ul>{gate}</ul></div>

<div class="divider"></div>
<div class="sec-label" id="s3">Section 03</div>
<h2>P2P Layer — Protocol v2</h2>
<p>This is Vision's wire protocol, generalized. Products change only the prefix, the shape of <code>hello</code>'s product fields, and (for hub products) how many connections they keep.</p>
<h3>3.1 — Identity and the signaling server</h3>
<pre><code>const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code6 = () =&gt; {{ const a = new Uint32Array(6); crypto.getRandomValues(a); return [...a].map(x =&gt; ALPH[x % ALPH.length]).join(''); }};
const PID = c =&gt; 'create-prc-' + String(c).toLowerCase();          // Practice; each product has its own prefix

function peerOpts() {{                                               // ?peer=127.0.0.1:9000 → a self-hosted PeerJS server (tests, intranets)
  const q = new URLSearchParams(location.search).get('peer');
  if (q) {{ const [h, p] = q.split(':'); return {{ host: h, port: +p || 9000, path: '/', secure: location.protocol === 'https:', debug: 0 }}; }}
  return {{ debug: 0 }};
}}</code></pre>
<h3>3.2 — Start, dial, wire</h3>
<pre><code>let peer = null, net = 'idle', netMsg = '';
const conns = new Set(), openConns = () =&gt; [...conns].filter(c =&gt; c.open);

function startPeer() {{
  if (!S || peer) return;
  if (!window.Peer) {{ setNet('nolib', 'The sync library didn’t load. Everything else works; you can still back up as a file.'); return; }}
  setNet('starting');
  try {{ peer = new Peer(PID(S.dev), peerOpts()); }} catch (e) {{ peer = null; setNet('error', 'Sync couldn’t start in this browser.'); return; }}
  peer.on('open', () =&gt; {{ setNet(S.partner || S.pending ? 'dialing' : 'ready'); if (S.partner) dial(S.partner.code, true); if (S.pending) dial(S.pending); }});
  peer.on('connection', c =&gt; wire(c, false));
  peer.on('disconnected', () =&gt; {{ if (!openConns().length) setNet('offline', 'Lost the matchmaking server. Trying again…');
    setTimeout(() =&gt; {{ if (peer &amp;&amp; !peer.destroyed &amp;&amp; peer.disconnected) try {{ peer.reconnect(); }} catch (e) {{}} }}, 4000); }});
  peer.on('close', () =&gt; {{ peer = null; }});
  peer.on('error', e =&gt; {{ if (e.type === 'peer-unavailable') {{ netMsg = 'Your partner’s device isn’t open right now.'; setNet(S.partner ? 'away' : 'ready'); }}
                           else if (e.type === 'unavailable-id') {{ /* this code is open in another tab */ }} else setNet('error', 'Sync hit a problem: ' + e.type); }});
}}
function dial(code, auto) {{
  if (!peer || peer.destroyed || peer.disconnected || code === S.dev) return;
  if (openConns().some(c =&gt; c.peer === PID(code))) return;
  if (!auto) setNet('dialing');
  wire(peer.connect(PID(code), {{ reliable: true, metadata: {{ v: 1 }} }}), true, code);
}}
function wire(c, outgoing, code) {{
  conns.add(c); c._hello = false; c._sent = false;
  c.on('open', () =&gt; {{ if (outgoing) {{ c._sent = true; send(c, hello()); }} paint(); }});   // the dialer speaks first
  c.on('data', d =&gt; {{ try {{ onMsg(c, d, outgoing, code); }} catch (e) {{ console.warn('bad message', e); }} }});
  c.on('close', () =&gt; {{ conns.delete(c); if (!openConns().length) setNet(S.partner ? 'away' : 'ready'); paint(); }});
  c.on('error', () =&gt; {{ conns.delete(c); paint(); }});
}}
const send = (c, m) =&gt; {{ try {{ if (c.open) c.send(m); }} catch (e) {{}} }};</code></pre>
<h3>3.3 — Messages</h3>
<pre><code>// hello: the whole state, once per connection, from the dialer first
{{ t:'hello', v:1, dev:S.dev, me:S.me, joined:!!S.joined, name: myName(), names:S.names, meta: productMeta(), items:S.items }}
// put: the items that changed (the whole item, with its _t)
{{ t:'put', items:[ {{ id, …, del, _t:{{…}} }} ] }}
// meta: product-level fields with their own stamps (names, settings, a board title)
{{ t:'meta', names:S.names, _t:S._t }}
// chunk: a large message in pieces (products on the chunked pattern)
{{ t:'chunk', id, i, n, data }}</code></pre>
<pre><code>function onMsg(c, d, outgoing, code) {{
  if (!d || typeof d !== 'object') return;
  if (d.t === 'hello') {{
    if (d.dev === S.dev) return;                                         // my own other tab
    const known = S.partner &amp;&amp; S.partner.code === d.dev;
    if (!known &amp;&amp; S.partner &amp;&amp; !outgoing &amp;&amp; !c._ok) {{ pendingAsk = {{ c, d }}; askAccept(d); return; }}   // a device we haven't seen
    acceptHello(c, d, outgoing); return;
  }}
  if (!c._hello) return;                                                 // nothing counts before hello
  if (d.t === 'put' &amp;&amp; Array.isArray(d.items)) {{ const ch = d.items.filter(mergeItem); if (ch.length) {{ save(); render(true); relay(c, ch); }} }}
  else if (d.t === 'meta') {{ if (mergeMeta(d)) {{ save(); render(true); }} }}
  else if (d.t === 'chunk') {{ const whole = chunkIn(d); if (whole) onMsg(c, whole, outgoing, code); }}
}}
function acceptHello(c, d, outgoing) {{
  c._ok = true;
  let wait = false, swapped = false;
  if (d.me === S.me) {{ const yieldMe = S.joined &amp;&amp; !d.joined ? true : !S.joined &amp;&amp; d.joined ? false : S.dev &gt; d.dev; if (yieldMe) {{ swapSlots(); swapped = true; }} else wait = true; }}
  S.partner = {{ code: d.dev, at: Date.now() }}; S.pending = null;
  if (!wait) {{ mergeMeta(d); for (const it of Object.values(d.items || {{}})) mergeItem(it); S.joined = false; }}
  save(true); c._hello = true;
  if (!c._sent || swapped) {{ c._sent = true; send(c, hello()); }}
  setNet('on'); render(true);
}}
function broadcast(items) {{ if (!items.length) return; const m = {{ t:'put', items: items.map(it =&gt; S.items[it.id] || it) }}; for (const c of openConns()) if (c._hello) send(c, m); }}</code></pre>
<h3>3.4 — Presence states</h3>
<table><thead><tr><th>State</th><th>Meaning</th><th>Dot</th></tr></thead><tbody>
<tr><td class="mono">idle</td><td>No PeerJS yet (first run)</td><td>grey</td></tr><tr><td class="mono">starting</td><td>Registering with the signaling server</td><td>grey, pulsing</td></tr>
<tr><td class="mono">ready</td><td>Listening; no partner yet</td><td>hollow</td></tr><tr><td class="mono">dialing</td><td>Connecting to a code</td><td>amber, pulsing</td></tr>
<tr><td class="mono">on</td><td>hello exchanged; syncing</td><td>green</td></tr><tr><td class="mono">away</td><td>Partner known, not open now</td><td>hollow amber</td></tr>
<tr><td class="mono">offline</td><td>Lost the signaling server; retrying</td><td>red hollow</td></tr><tr><td class="mono">nolib / error</td><td>PeerJS missing or failed; solo</td><td>red</td></tr>
</tbody></table>
<div class="callout info"><h4>PeerJS signaling</h4><p>PeerJS Cloud brokers the WebRTC handshake and nothing more. Once connected, data flows browser to browser; if the server goes away, open connections continue and the product retries registration every four seconds. <code>?peer=host:port</code> points a product at a self-hosted server (the test harness runs one on 127.0.0.1:9000).</p></div>

<div class="divider"></div>
<div class="sec-label" id="s4">Section 04</div>
<h2>Persistence — State, Stamps, Storage</h2>
<h3>4.1 — The state object</h3>
<pre><code>const KEY = 'create.practice.v1';
let S = null;
function blankState(me) {{
  return {{ v:1, dev: code6(), me, joined:false, partner:null, pending:null, names:{{ a:'', b:'' }}, _t:{{}},
           /* product fields, e.g. */ pursuits:{{}}, items:{{}}, created: Date.now() }};
}}
const LS = {{ get(k, d) {{ try {{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }} catch (e) {{ return d; }} }},
             set(k, v) {{ try {{ localStorage.setItem(k, JSON.stringify(v)); return true; }} catch (e) {{ return false; }} }} }};
let saveT = 0, saveWarned = false;
function save(now) {{
  clearTimeout(saveT);
  const go = () =&gt; {{ if (S &amp;&amp; !LS.set(KEY, S) &amp;&amp; !saveWarned) {{ saveWarned = true; toast('This browser’s storage is full. Remove a photo or two so it can save.'); }} }};
  if (now) go(); else saveT = setTimeout(go, 120);
}}
function load() {{ const s = LS.get(KEY, null); if (!s || s.v !== 1) return migrate(s); S = Object.assign(blankState('a'), s); return true; }}</code></pre>
<h3>4.2 — Stamps and merge</h3>
<pre><code>let lastStamp = 0; const SALT = Math.floor(Math.random() * 90) + 10;
function stamp() {{ const t = Math.max(Date.now(), Math.floor(lastStamp / 100) + 1); lastStamp = t * 100 + SALT; return lastStamp; }}
const seeStamp = n =&gt; {{ if (n &gt; lastStamp) lastStamp = n; }};             // never issue a stamp below one we've seen

function setF(it, f) {{ const t = stamp(); for (const k of Object.keys(f)) {{ it[k] = f[k]; it._t[k] = t; }} return it; }}
function create(id, f) {{ const it = {{ id, _t:{{}} }}; setF(it, f); S.items[id] = it; return it; }}
const live = () =&gt; Object.values(S.items).filter(it =&gt; !it.del);

function mergeItem(r) {{
  if (!r || !r.id) return false;
  for (const v of Object.values(r._t || {{}})) seeStamp(v);
  const L = S.items[r.id];
  if (!L) {{ S.items[r.id] = JSON.parse(JSON.stringify(r)); return true; }}
  let ch = false;
  for (const k of Object.keys(r._t || {{}})) if ((r._t[k] || 0) &gt; (L._t[k] || 0)) {{ L[k] = r[k]; L._t[k] = r._t[k]; ch = true; }}
  return ch;
}}</code></pre>
<h3>4.3 — localStorage limits</h3>
<table><thead><tr><th>Constraint</th><th>Value</th><th>Impact</th></tr></thead><tbody>
<tr><td>Total quota</td><td class="mono">5–10 MB per origin</td><td>Chrome ~5 MB, Firefox ~10 MB. On GitHub Pages every Create product shares one origin with The Watch, Weekender, Finds and Vision.</td></tr>
<tr><td>Per key</td><td class="mono">~5 MB</td><td>One key per product fits; photos are what fill it.</td></tr>
<tr><td>Synchronous</td><td>—</td><td>Writes are debounced 120 ms; large states should keep photos small (resize to 1024 px, 2 MB cap).</td></tr>
<tr><td>file://</td><td>per file or shared</td><td>Browser-dependent; a product opened from disk has its own storage from the hosted one — the backup file moves between them.</td></tr>
</tbody></table>
<div class="callout warn"><h4>Picture-heavy products</h4><p>Deck, Snap, Collection, Journal, Inventory, Trip, Garage, Rebuild, Cookbook and Fix carry data URIs. Resize on import (longest side 1024 px, JPEG 0.82 for photos), cap at 2 MB, and warn at 60% of a 5 MB budget. IndexedDB overflow for blobs is a Wave 3 option; localStorage stays primary.</p></div>
<h3>4.4 — Ids</h3>
<pre><code>const uid = () =&gt; Date.now().toString(36) + Math.random().toString(36).slice(2, 7);   // 'mh2k1x5q9ab'
// ids are opaque; the kind of a record is a field (kind:'session'), not a prefix</code></pre>
<h3>4.5 — Backup</h3>
<pre><code>function exportJSON() {{
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], {{ type: 'application/json' }}));
  a.download = 'create-practice-backup.json'; document.body.append(a); a.click();
  setTimeout(() =&gt; {{ URL.revokeObjectURL(a.href); a.remove(); }}, 500);
}}
function importJSON(text, replace) {{                       // merge by default; Replace only on request
  const r = JSON.parse(text); if (!r || r.v !== 1) throw new Error('not a backup');
  if (replace) {{ S = Object.assign(blankState(S.me), r, {{ dev: S.dev }}); }}
  else {{ mergeMeta(r); for (const it of Object.values(r.items || {{}})) mergeItem(it); }}
  save(true); render(); broadcast(live());
}}
async function packLink() {{                                 // #b=z… when deflated JSON is under ~6 KB
  const json = JSON.stringify(S);
  const s = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return location.href.split('#')[0] + '#b=z' + b64u(await new Response(s).arrayBuffer());
}}</code></pre>

<div class="divider"></div>
<div class="sec-label" id="s5">Section 05</div>
<h2>The Inbox Handoff</h2>
<p>Products never call each other. A page that has something for a product appends an entry to that product's inbox array in localStorage; the product drains it the next time it is open (and immediately, if it is open in another tab, through the <code>storage</code> event). This is how The Watch, Weekender and Finds pin to Vision today.</p>
<table><thead><tr><th>From</th><th>To</th><th>Key</th><th>Entry</th></tr></thead><tbody>
<tr><td>The Watch, Weekender, Finds</td><td>Vision</td><td class="mono">vision.inbox</td><td class="mono">{{ key, title, url, img, lane, at }} or {{ key, unpin:true }}</td></tr>
<tr><td>Circle</td><td>Gift</td><td class="mono">create.gift.inbox</td><td class="mono">{{ kind:'idea', person, text, from:'circle', at }}</td></tr>
<tr><td>Cookbook, the Food desk</td><td>Pantry</td><td class="mono">create.pantry.inbox</td><td class="mono">{{ name, qty, unit, aisle, from, at }}</td></tr>
<tr><td>Trip</td><td>Split</td><td class="mono">create.split.inbox</td><td class="mono">{{ kind:'expense', title, cents, paidBy, category, on, from:'trip', at }}</td></tr>
<tr><td>Date Night, Weekender, The Watch</td><td>Week</td><td class="mono">create.week.inbox</td><td class="mono">{{ title, start, end, allDay, who, place, note, src, url, at }}</td></tr>
<tr><td>Weekender, The Watch</td><td>Trip</td><td class="mono">create.trip.inbox</td><td class="mono">{{ kind:'leg', on, type, title, start, end, place, url, at }}</td></tr>
<tr><td>The Sports desk</td><td>Pool</td><td class="mono">create.pool.inbox</td><td class="mono">{{ kind:'game', week, away, home, kickoff, at }}</td></tr>
</tbody></table>
<pre><code>function drainInbox(quiet) {{
  const q = LS.get(INBOX, []); if (!Array.isArray(q) || !q.length) return [];
  LS.set(INBOX, []);
  const made = q.map(fromInbox).filter(Boolean);       // fromInbox turns an entry into an item (or null)
  if (made.length) {{ save(true); broadcast(made); if (!quiet) toast(made.length === 1 ? `Added: ${{made[0].title}}` : `${{made.length}} new from your browsing`); }}
  return made;
}}
window.addEventListener('storage', e =&gt; {{ if (e.key === INBOX &amp;&amp; drainInbox().length) render(true); }});</code></pre>

<div class="divider"></div>
<div class="sec-label" id="s6">Section 06</div>
<h2>Pictures — Resize and Chunking</h2>
<pre><code>function readPicture(file, maxSide = 1024) {{
  return new Promise((ok, no) =&gt; {{
    if (file.size &gt; 2 * 1024 * 1024 * 4) return no(new Error('That picture is very large; try a smaller one.'));
    const img = new Image(); img.onload = () =&gt; {{
      const s = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const out = c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.82);
      URL.revokeObjectURL(img.src);
      out.length &gt; 2 * 1024 * 1024 ? no(new Error('Still over 2 MB after resizing.')) : ok(out);
    }}; img.onerror = () =&gt; no(new Error('That file isn’t a picture.')); img.src = URL.createObjectURL(file);
  }});
}}

const CHUNK = 128 * 1024, chunkBuf = {{}};
function sendBig(c, m) {{                                   // any message whose JSON is over 200 KB
  const s = JSON.stringify(m); if (s.length &lt; 200 * 1024) return send(c, m);
  const id = uid(), n = Math.ceil(s.length / CHUNK);
  for (let i = 0; i &lt; n; i++) send(c, {{ t:'chunk', id, i, n, data: s.slice(i * CHUNK, (i + 1) * CHUNK) }});
}}
function chunkIn(d) {{
  const b = chunkBuf[d.id] = chunkBuf[d.id] || {{ n: d.n, parts: [], got: 0 }};
  if (!b.parts[d.i]) {{ b.parts[d.i] = d.data; b.got++; }}
  if (b.got &lt; b.n) return null;
  delete chunkBuf[d.id]; return JSON.parse(b.parts.join(''));
}}</code></pre>

<div class="divider"></div>
<div class="sec-label" id="s7">Section 07</div>
<h2>Sync Patterns &amp; Merge</h2>
<table><thead><tr><th>Pattern</th><th>Products</th><th>Trigger</th><th>Payload</th><th>Merge</th></tr></thead><tbody>
<tr><td><strong>Items (LWW)</strong></td><td>{E(', '.join(p['name'].replace('Create · ','') for p in P if p.get('sync')=='items'))}</td><td>hello, then every change</td><td class="mono">{{ t:'put', items:[…] }}</td><td>Per field by stamp</td></tr>
<tr><td><strong>Chunked</strong></td><td>{E(', '.join(p['name'].replace('Create · ','') for p in P if p.get('sync')=='chunked'))}</td><td>Every change</td><td class="mono">{{ t:'chunk', id, i, n, data }}</td><td>Reassemble, then per field</td></tr>
<tr><td><strong>Cell delta</strong></td><td>Calc</td><td>Cell change</td><td class="mono">{{ t:'put', items:[{{ id:sheet, cells:{{A1:{{v,f,t}}}} }}] }}</td><td>Per cell by stamp</td></tr>
<tr><td><strong>Encrypted</strong></td><td>Vault, Net</td><td>Every change</td><td class="mono">{{ t:'put', items:[{{ id, iv, blob, del, _t }}] }}</td><td>Per entry by stamp</td></tr>
<tr><td><strong>Hub</strong></td><td>Form, Pool, Gift, Trip (3+)</td><td>Every change</td><td class="mono">put from guest → host re-puts to all</td><td>Per field by stamp</td></tr>
<tr><td><strong>Hidden claims</strong></td><td>Gift</td><td>Every change</td><td class="mono">{{ t:'put', items:[…] }}</td><td>Per field; masked on render</td></tr>
</tbody></table>

<div class="divider"></div>
<div class="sec-label" id="s8">Section 08</div>
<h2>Hub Pattern (Form, Pool, Gift, Trip)</h2>
<p>The two-person code path already keeps <code>conns</code> as a set. A hub product sets <code>S.role</code> to <code>'host'</code> on the device that created the group and <code>'guest'</code> on devices that joined by its code. Guests dial only the host; the host accepts each guest once (the same accept step as a partner) and keeps every connection.</p>
<pre><code>function relay(from, items) {{                              // host only: what one guest put goes to every other guest
  if (S.role !== 'host') return;
  const m = {{ t:'put', items }};
  for (const c of openConns()) if (c !== from &amp;&amp; c._hello) send(c, m);
}}
// a guest that comes back later gets the whole state in the host's hello, including what other guests added meanwhile
// if the host is away, guests keep working on their own copies and reconcile when it returns (per-field stamps make this safe)</code></pre>
<p><strong>Trust.</strong> The host is a relay, not an authority: it merges by stamps like everyone else. Products that need an authority (Pool's lock times) enforce the rule on the host and mark late picks as late rather than dropping them.</p>

<div class="divider"></div>
<div class="sec-label" id="s9">Section 09</div>
<h2>Encryption Standard (Vault, Net)</h2>
<table><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>
<tr><td>Algorithm</td><td class="mono">AES-256-GCM</td></tr><tr><td>Key derivation</td><td class="mono">PBKDF2, 600,000 iterations, SHA-256</td></tr>
<tr><td>Salt</td><td class="mono">16 bytes, random per vault, stored in the clear</td></tr><tr><td>IV</td><td class="mono">12 bytes, random per encryption</td></tr>
<tr><td>Verifier</td><td class="mono">AES-GCM of a known string under the key; decrypt to check the passphrase</td></tr>
<tr><td>Key storage</td><td>CryptoKey, non-extractable, memory only; dropped on lock, blur and timeout</td></tr>
</tbody></table>
<pre><code>async function deriveKey(passphrase, salt) {{
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({{ name:'PBKDF2', salt, iterations:600000, hash:'SHA-256' }}, material, {{ name:'AES-GCM', length:256 }}, false, ['encrypt', 'decrypt']);
}}
async function seal(key, obj) {{ const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({{ name:'AES-GCM', iv }}, key, new TextEncoder().encode(JSON.stringify(obj))); return {{ iv: b64(iv), blob: b64(ct) }}; }}
async function open(key, e) {{ return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({{ name:'AES-GCM', iv: unb64(e.iv) }}, key, unb64(e.blob)))); }}</code></pre>
<p><strong>Sync.</strong> Only <code>{{ id, iv, blob, del, _t }}</code> travels; both devices must know the passphrase. A blob that arrives before the local vault is unlocked is stored as-is and decrypted on demand; if the passphrase differs the entry shows as “from your other device (locked)”.</p>

<div class="divider"></div>
<div class="sec-label" id="s10">Section 10</div>
<h2>Hidden Claims (Gift)</h2>
<p>Every device holds every field — that is what makes sync simple — but the device of the person a list is for never <em>renders</em> <code>claimedBy</code>, <code>claimedAt</code>, <code>chipIns</code>, ideas about them, or Secret Santa pairs other than their own. The mask is a render rule, not a storage rule:</p>
<pre><code>const mine = it =&gt; it.owner === S.meId;
function claimView(it) {{ return mine(it) ? null : {{ by: it.claimedBy, at: it.claimedAt, chipIns: it.chipIns || [] }}; }}   // null → draw nothing</code></pre>
<div class="callout warn"><h4>Trust boundary</h4><p>v1 is trust-based: a determined list owner could read the storage of their own browser. The product says so under Settings → About. A v2 could encrypt claim fields to the non-owners' keys; it is not planned until someone asks.</p></div>

<div class="divider"></div>
<div class="sec-label" id="s11">Section 11</div>
<h2>Per-Product Data Models</h2>
<p>Common fields are left out of each model: <code>v, dev, me, joined, partner, pending, names, _t</code> at the top; <code>del, _t</code> on every item. Where a product has several kinds of record they share <code>items</code> and are told apart by <code>kind</code>.</p>
{models()}

<div class="divider"></div>
<div class="sec-label" id="s12">Section 12</div>
<h2>Create · Home and The Watch Hub</h2>
<table><thead><tr><th>Surface</th><th>Path</th><th>What it is</th></tr></thead><tbody>
<tr><td><strong>Create · Home</strong></td><td class="mono">news/create/index.html</td><td>The static launcher: catalog by line, open and download, quickstart, the two documents. Reads <code>catalog.json</code>; works from disk as a launcher.</td></tr>
<tr><td><strong>The Watch hub</strong></td><td class="mono">news/create/app.js · #/create</td><td>Loaded by The Watch the first time a reader opens Create or a desk with a line, like the F1 hub. Routes: <code>#/create</code>, <code>#/create/&lt;line&gt;</code>, <code>#/create/p/&lt;id&gt;</code>. Draws with the paper's own helpers and look.</td></tr>
<tr><td><strong>Desk bands</strong></td><td class="mono">createBand(desk)</td><td>A row of the line's tools at the top of Hobbies, Lifestyle, Home, Household, Food, Travel, Cars, Sports and Health; a hobby page shows its own tool.</td></tr>
<tr><td><strong>The catalog</strong></td><td class="mono">news/create/catalog.json</td><td>Lines, products (id, line, name, icon, tag, desc, functions, specs, tech, sync, key, prefix, budget, status, href, model), sync patterns, the gate, the roadmap. The portfolio and this spec are built from it by <code>news/create/build.py</code>.</td></tr>
<tr><td><strong>Products</strong></td><td class="mono">news/create/apps/&lt;id&gt;/index.html</td><td>One file each. Status flips to <code>live</code> in the catalog when a product passes the gate.</td></tr>
</tbody></table>
<p><strong>Status vocabulary.</strong> <code>live</code> — passes the gate and is linked; <code>building</code> — the file exists and is being brought through the gate; <code>planned</code> — specified here, no file yet.</p>

<div class="divider"></div>
<div class="sec-label" id="s13">Section 13</div>
<h2>Testing &amp; QA</h2>
<p>The harness is <code>news/create/test/smoke.py</code>. It serves the repo, runs a local PeerJS server on 127.0.0.1:9000, routes the CDN script to a local copy, and drives two browser contexts (a desktop and a phone) through the product's <code>window.__create</code> hooks — a real WebRTC pairing, not a mock. It also opens the file from disk, offline.</p>
<table><thead><tr><th>Test</th><th>Method</th><th>Pass criteria</th></tr></thead><tbody>
<tr><td>Pair</td><td>B dials A's code</td><td>Both report <code>net() === 'on'</code> within 20 s</td></tr>
<tr><td>Hello</td><td>A has two items before B connects</td><td>B has them after hello</td></tr>
<tr><td>Put</td><td>B adds an item while connected</td><td>A has it within 10 s</td></tr>
<tr><td>Persistence</td><td>Reload A</td><td>Same count; A reconnects to B by itself</td></tr>
<tr><td>Backup</td><td><code>export()</code></td><td>JSON with <code>v:1</code>, <code>dev</code> and <code>items</code></td></tr>
<tr><td>Offline from disk</td><td>file:// with the network off</td><td>Setup and add work; <code>net()</code> is not <code>'on'</code>; no errors</td></tr>
<tr><td>Console</td><td>All contexts</td><td>No page errors or <code>console.error</code> (CDN and font failures excepted)</td></tr>
<tr><td>Look</td><td>Screenshots at 1280 and 390 px</td><td>Reviewed: no overflow, header on one line, empty states explain themselves</td></tr>
<tr><td>Size</td><td><code>gzip -9</code></td><td>Under the budget</td></tr>
<tr><td>Cross-browser</td><td>Chrome, Firefox, Safari, Edge by hand</td><td>No console errors, same layout</td></tr>
</tbody></table>

<div class="divider"></div>
<div class="sec-label" id="s14">Section 14</div>
<h2>Performance Budgets &amp; Browser Matrix</h2>
<h3>14.1 — Size budgets</h3>
<div class="tw"><table><thead><tr><th>Product</th><th>Max gzipped</th><th>First paint</th><th>Interactive</th></tr></thead><tbody>{budget_rows()}</tbody></table></div>
<div class="callout warn"><h4>Size is a feature</h4><p>A product over its gzipped budget does not ship. PeerJS (~45 KB) and qrcode-generator (~5 KB) are excluded; they are the permitted external scripts. Everything else fits. Vision, Together / 90 and Date Night report the sizes they shipped at.</p></div>
<h3>14.2 — Browser compatibility</h3>
<table><thead><tr><th>API</th><th>Chrome 90+</th><th>Firefox 90+</th><th>Safari 15+</th><th>Edge 90+</th><th>Fallback</th></tr></thead><tbody>
<tr><td>WebRTC (PeerJS)</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>Solo mode, backup by file</td></tr>
<tr><td>localStorage</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>None (required); a toast when it is off</td></tr>
<tr><td>Web Crypto</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>None (Vault, Net require it)</td></tr>
<tr><td>CompressionStream</td><td>✓</td><td>113+</td><td>16.4+</td><td>✓</td><td>Plain base64 link, or a file</td></tr>
<tr><td>Clipboard API</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>Select-to-copy field</td></tr>
<tr><td>FileReader / canvas</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>None (required for pictures)</td></tr>
<tr><td>Fullscreen API</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>CSS-only (Deck)</td></tr>
<tr><td>Wake Lock</td><td>✓</td><td>—</td><td>16.4+</td><td>✓</td><td>A note to keep the screen on (Cookbook)</td></tr>
</tbody></table>

<div class="divider"></div>
<div class="sec-label" id="s15">Section 15</div>
<h2>API Bridge — Future Layer</h2>
<div class="callout info"><h4>Pre-design (Wave 4 or later)</h4><p>A separate, optional component — never embedded in a product. A REST-like JSON endpoint a product can be pointed at as a secondary sync target beside P2P, for the case where two devices are never open at once. Planned as a Cloudflare Worker or Deno Deploy function that stores only what a product chooses to send (for Vault and Net, ciphertext). P2P stays primary and default; no product will ever require the bridge.</p></div>

<div class="divider"></div>
<div class="sec-label" id="s16">Section 16</div>
<h2>Changes from 1.0</h2>
<table><thead><tr><th>Area</th><th>1.0 (SCR-CRT-ENG-2026-001)</th><th>2.0</th></tr></thead><tbody>
<tr><td>Peer id</td><td>Random per session (<code>"pad-" + rnd(10)</code>)</td><td>Stable six-letter device code; devices reconnect by themselves</td></tr>
<tr><td>Sync</td><td>Whole state on every change; merge by id, skip duplicates</td><td>hello once, then put of changed items; per-field last-writer-wins stamps</td></tr>
<tr><td>New devices</td><td>Any connection accepted</td><td>Accept step; the partner is remembered</td></tr>
<tr><td>Deletes</td><td>Removed from the array</td><td>Soft, as a synced field</td></tr>
<tr><td>Storage keys</td><td class="mono">crt_&lt;id&gt;_v1</td><td class="mono">create.&lt;id&gt;.v1 + create.&lt;id&gt;.inbox</td></tr>
<tr><td>Handoff</td><td>—</td><td>The inbox pattern between products and from The Watch</td></tr>
<tr><td>Multi-person</td><td>Roadmap (Q4)</td><td>Hub pattern specified; Form, Pool, Gift, Trip use it</td></tr>
<tr><td>Products</td><td>7 + Home</td><td>{len(P)} in {len(C['lines'])} lines; 3 shipped before the line folded in</td></tr>
<tr><td>Hosting</td><td>create.scrolls.studio (planned)</td><td>Inside The Watch on GitHub Pages, now</td></tr>
<tr><td>Testing</td><td>Checklist</td><td>A harness that pairs two real browsers over WebRTC</td></tr>
</tbody></table>
"""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Scrolls — Create · Engineering Build Specification 2.0</title>
<meta name="description" content="How every Create product is built: the single-file contract, protocol v2 from the shipped Vision, storage, the inbox handoff, the data models and the gate.">
<link rel="canonical" href="{E(PUB)}spec/">
<style>{CSS}</style>
</head>
<body>
<header class="doc-header">
  <p class="co">Scrolls</p>
  <h1>Create — Engineering Build Spec</h1>
  <p class="sub">Full Technical Reference · Protocol v2 · Based on Vision Rev 2 (shipped)</p>
  <div class="meta">
    <span><strong>Doc ID:</strong> {E(C['docs']['spec'])}</span>
    <span><strong>Version:</strong> {E(C['version'])}</span>
    <span><strong>Date:</strong> {E(DATE)}</span>
    <span><strong>Ref build:</strong> vision/index.html</span>
    <span><strong>Status:</strong> Approved for build · Wave 1 in build</span>
  </div>
  <div class="meta" style="margin-top:.75rem"><a href="../portfolio/" style="color:#d6b25e">Portfolio</a><a href="../" style="color:#d6b25e">Create · Home</a><a href="../../#/create" style="color:#d6b25e">On The Watch</a></div>
</header>
<div class="page">
{body}
  <div class="doc-foot">
    <p>Scrolls — Create Product Line — {E(C['docs']['spec'])} — Engineering Build Spec {E(C['version'])}</p>
    <p>Reference build: vision/index.html (Rev 2, live) · Supersedes SCR-CRT-ENG-2026-001 · Built from <code>news/create/catalog.json</code></p>
    <p>© 2026 Scrolls. All rights reserved.</p>
  </div>
</div>
</body>
</html>
"""


# ───────────────────────────── Create · Home (the launcher) ─────────────────────────────
HOME_CSS = """
:root{--bg:#F8F7F4;--raise:#fff;--sunk:#EFEBE4;--ink:#2A251F;--ink2:#62594F;--ink3:#968B7E;--rule:rgba(42,37,31,.12);--rule2:rgba(42,37,31,.22);
--a:#C2785C;--a-soft:rgba(194,120,92,.15);--b:#5B7FA1;--b-soft:rgba(91,127,161,.15);--gold:#8B7355;--gold-soft:rgba(139,115,85,.16);--green:#3D7A55;--green-soft:rgba(61,122,85,.14);--plum:#7B6A8E;--plum-soft:rgba(123,106,142,.15);
--ok:#3D7A55;--warn:#B4532F;--shadow:0 1px 2px rgba(42,37,31,.05),0 8px 24px rgba(42,37,31,.07);--serif:'Instrument Serif','Iowan Old Style',Georgia,serif;--sans:'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#191613;--raise:#24201B;--sunk:#131110;--ink:#F2EDE6;--ink2:#C6BCAF;--ink3:#918679;--rule:rgba(242,237,230,.12);--rule2:rgba(242,237,230,.24);
--a:#E39B7F;--a-soft:rgba(227,155,127,.17);--b:#8FB1D2;--b-soft:rgba(143,177,210,.17);--gold:#CDB089;--gold-soft:rgba(205,176,137,.17);--green:#7EC39B;--green-soft:rgba(126,195,155,.16);--plum:#B3A3C6;--plum-soft:rgba(179,163,198,.16);--ok:#7EC39B;--warn:#F08C66;--shadow:0 1px 2px rgba(0,0,0,.3),0 10px 28px rgba(0,0,0,.34);color-scheme:dark}}
*{box-sizing:border-box}[hidden]{display:none!important}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:400 16px/1.5 var(--sans);-webkit-font-smoothing:antialiased}
a{color:inherit}
.top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:14px;padding:10px max(16px,env(safe-area-inset-left)) 10px max(16px,env(safe-area-inset-right));background:color-mix(in srgb,var(--bg) 86%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--rule)}
.top .wm{display:flex;align-items:center;gap:9px;text-decoration:none;font:400 21px var(--serif)}.top .wm i{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,var(--a),var(--gold),var(--b));color:#fff;font-style:normal;font-size:15px}
.top .wm small{font:700 11px var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);margin-right:-4px}
.top nav{margin-left:auto;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}.top nav::-webkit-scrollbar{display:none}
.top nav a{flex:none;text-decoration:none;font:600 13.5px var(--sans);color:var(--ink2);padding:7px 11px;border-radius:999px}.top nav a:hover{background:var(--sunk);color:var(--ink)}
.wrap{max-width:1040px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left)) 0 max(16px,env(safe-area-inset-right))}
.hero{padding:44px 0 26px;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:28px;align-items:center}
.hero .k{font:700 12px var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin:0 0 10px}
.hero h1{font:400 clamp(38px,6vw,60px)/1 var(--serif);letter-spacing:-.015em;margin:0 0 14px}
.hero p{font-size:17px;color:var(--ink2);margin:0 0 18px;max-width:58ch}
.btns{display:flex;flex-wrap:wrap;gap:8px}
.btn{display:inline-flex;align-items:center;gap:6px;text-decoration:none;font:600 14px var(--sans);padding:10px 15px;border-radius:999px;border:1px solid var(--rule2);color:var(--ink);background:var(--raise);min-height:44px}
.btn:hover{border-color:var(--ink3)}.btn.pri{background:var(--ink);color:var(--bg);border-color:var(--ink)}.btn.pri:hover{opacity:.9}.btn.sm{min-height:36px;padding:7px 12px;font-size:13px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.stats div{background:var(--raise);border:1px solid var(--rule);border-radius:14px;padding:12px 10px;text-align:center;box-shadow:var(--shadow)}
.stats b{display:block;font:400 32px/1 var(--serif)}.stats small{display:block;margin-top:4px;font:700 10.5px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--ink3)}
section{padding:26px 0}.sh{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:0 0 6px}.sh h2{font:400 30px/1.1 var(--serif);margin:0}.sh p{margin:0;color:var(--ink2)}
.sub{color:var(--ink2);margin:0 0 14px;max-width:70ch}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
.tile{display:grid;grid-template-columns:44px minmax(0,1fr);gap:8px 12px;text-decoration:none;color:inherit;background:var(--raise);border:1px solid var(--rule);border-radius:16px;padding:14px;position:relative;overflow:hidden;box-shadow:var(--shadow)}
.tile::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ac)}
.tile:hover{border-color:color-mix(in srgb,var(--ac) 55%,var(--rule))}
.ic{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:color-mix(in srgb,var(--ac) 16%,var(--raise));color:var(--ac);font-size:20px;flex:none}
.tile small{display:block;font:700 10.5px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--ink3)}.tile b{display:block;font:400 21px/1.1 var(--serif)}.tile .tg{display:block;font-size:13.5px;color:var(--ink2);font-style:italic;margin-top:2px}
.tile .go{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;font:600 13px var(--sans);color:var(--gold)}
.st{display:inline-block;font:700 10.5px var(--sans);letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:5px;background:var(--sunk);color:var(--ink2)}
.st.live{background:var(--green-soft);color:var(--green)}.st.building{background:var(--a-soft);color:var(--a)}
.find{display:flex;gap:8px;align-items:center;margin:10px 0 18px}
.find input{flex:1;min-width:0;font:400 16px var(--sans);padding:11px 14px;border-radius:12px;border:1px solid var(--rule2);background:var(--raise);color:var(--ink);min-height:44px}
.line{margin:0 0 26px;scroll-margin-top:70px}
.lh{display:flex;gap:14px;align-items:flex-start;margin:0 0 10px}.lh .ic{width:48px;height:48px;border-radius:14px;font-size:22px}
.lh h3{font:400 30px/1.05 var(--serif);margin:0}.lh i{display:block;color:var(--ink2);font-size:15px;margin-top:2px}.lh small{display:block;color:var(--ink3);font-size:12.5px;margin-top:4px}
.lh p{margin:8px 0 0;color:var(--ink2);max-width:76ch;font-size:14.5px}
.rows{display:grid;gap:8px}
.row{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:12px;align-items:center;background:var(--raise);border:1px solid var(--rule);border-radius:14px;padding:10px 12px}
.row .ic{width:40px;height:40px;font-size:18px;border-radius:11px}
.row b{font:400 19px/1.15 var(--serif)}.row .tg{font-size:13.5px;color:var(--ink2);font-style:italic}.row .ds{font-size:13.5px;color:var(--ink2);margin-top:4px;display:none}
.row.open .ds{display:block}.row .ac{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;align-items:center}
.row .more{background:none;border:0;color:var(--ink3);font:600 13px var(--sans);padding:6px;cursor:pointer;min-height:36px}
.row[hidden]{display:none}
.steps{list-style:none;counter-reset:s;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.steps li{counter-increment:s;position:relative;padding:14px 16px 14px 50px;background:var(--raise);border:1px solid var(--rule);border-radius:14px;font-size:14px;color:var(--ink2)}
.steps li::before{content:counter(s);position:absolute;left:14px;top:14px;width:26px;height:26px;border-radius:50%;background:var(--ink);color:var(--bg);font:700 13px/26px var(--sans);text-align:center}
.steps b{display:block;color:var(--ink);font:400 20px var(--serif);margin-bottom:2px}
.prin{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:14px}
.prin div{background:var(--sunk);border-radius:14px;padding:14px 16px}.prin b{display:block;font:400 21px var(--serif);margin-bottom:3px}.prin p{margin:0;font-size:14px;color:var(--ink2)}
.docs{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}
.doc{text-decoration:none;color:inherit;background:var(--raise);border:1px solid var(--rule);border-radius:14px;padding:14px 16px}.doc b{display:block;font:400 21px var(--serif)}.doc span{font-size:13.5px;color:var(--ink2)}
footer{padding:28px 0 calc(34px + env(safe-area-inset-bottom));border-top:1px solid var(--rule);margin-top:20px;color:var(--ink2);font-size:13.5px}
footer p{margin:4px 0}#ver{color:var(--ink3)}
@media (max-width:760px){.hero{grid-template-columns:1fr;padding-top:26px}.stats{grid-template-columns:repeat(3,1fr)}.stats b{font-size:26px}.row{grid-template-columns:36px minmax(0,1fr)}.row .ac{grid-column:1/-1;justify-content:flex-start}.lh h3{font-size:26px}}
"""

HOME_JS = r"""
(() => {
'use strict';
let C = JSON.parse(document.getElementById('catalog').textContent);
const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ST = { live: 'Live', building: 'In build', planned: 'Specified' };
const AC = { a: 'var(--a)', b: 'var(--b)', t: 'var(--gold)', green: 'var(--green)', plum: 'var(--plum)' };
const open = p => p.status === 'live' && p.href ? (p.href === 'create/' ? './' : '../' + p.href) : p.status === 'building' ? 'apps/' + p.id + '/' : null;
const file = p => p.status === 'building' ? 'apps/' + p.id + '/index.html' : p.status === 'live' && p.file && p.id !== 'home' ? (p.file.startsWith('news/') ? '../' + p.file.slice(5) : '../../' + p.file) : null;
const short = p => p.name.replace(/^Create · /, '');
const line = k => C.lines.find(l => l.k === k);
function tile(p) { const l = line(p.line), o = open(p); return `<a class="tile" href="${esc(o || 'spec/#m-' + p.id)}" style="--ac:${AC[p.c] || AC.t}"><span class="ic">${esc(p.icon)}</span><span><small>${esc(l.name)}</small><b>${esc(p.name)}</b><span class="tg">${esc(p.tag)}</span></span><span class="go"><span class="st ${p.status}">${ST[p.status]}</span><em>${o ? (p.status === 'live' ? 'Open' : 'Open the build') : 'Spec'} ›</em></span></a>`; }
function row(p) { const o = open(p), f = file(p); return `<div class="row" data-q="${esc((p.name + ' ' + p.tag + ' ' + p.desc + ' ' + line(p.line).name).toLowerCase())}" style="--ac:${AC[p.c] || AC.t}"><span class="ic">${esc(p.icon)}</span><div><b>${esc(p.name)}</b> <span class="st ${p.status}">${ST[p.status]}</span><div class="tg">${esc(p.tag)}</div><div class="ds">${esc(p.desc)}<br><small>${p.functions.map(esc).join(' · ')}</small></div></div>
  <div class="ac">${o ? `<a class="btn sm pri" href="${esc(o)}">${p.status === 'live' ? 'Open' : 'Open the build'}</a>` : ''}${f ? `<a class="btn sm" href="${esc(f)}" download="${esc(p.id === 'vision' ? 'vision.html' : p.status === 'live' ? p.file.split('/').pop() : 'create-' + p.id + '.html')}">Download</a>` : ''}${p.model ? `<a class="btn sm" href="spec/#m-${esc(p.id)}">Spec</a>` : `<a class="btn sm" href="portfolio/#p-${esc(p.id)}">Portfolio</a>`}<button type="button" class="more" aria-expanded="false">More</button></div></div>`; }
function render() {
  const P = C.products, n = { live: 0, building: 0, planned: 0 }; for (const p of P) n[p.status]++;
  $('#stats').innerHTML = `<div><b>${C.lines.length}</b><small>lines</small></div><div><b>${P.length}</b><small>products</small></div><div><b>${n.live}</b><small>live</small></div><div><b>${n.building}</b><small>in build</small></div><div><b>${n.planned}</b><small>specified</small></div><div><b>$0</b><small>forever</small></div>`;
  $('#live').innerHTML = P.filter(p => p.status === 'live').map(tile).join('');
  const b = P.filter(p => p.status === 'building'); $('#buildWrap').hidden = !b.length; $('#build').innerHTML = b.map(tile).join('');
  $('#lines').innerHTML = C.lines.map(l => { const ps = P.filter(p => p.line === l.k); return `<div class="line" id="l-${esc(l.k)}"><div class="lh"><span class="ic" style="--ac:${AC[l.c] || AC.t}">${esc(l.icon)}</span><div><h3>${esc(l.name)}</h3><i>${esc(l.dek)}</i><small>${ps.length} products · ${ps.filter(p => p.status === 'live').length} live${l.desk ? ' · on The Watch’s ' + esc(l.desk[0].toUpperCase() + l.desk.slice(1)) + ' desk' : ''}</small><p>${esc(l.about)}</p></div></div><div class="rows">${ps.map(row).join('')}</div></div>`; }).join('');
  $('#prin').innerHTML = C.principles.map(([a, b]) => `<div><b>${esc(a)}</b><p>${esc(b)}</p></div>`).join('');
  $('#ver').textContent = `Catalog ${C.version} · ${new Date(C.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · ${P.length} products`;
}
document.addEventListener('click', e => {
  const m = e.target.closest('.more'); if (m) { const r = m.closest('.row'); const on = r.classList.toggle('open'); m.textContent = on ? 'Less' : 'More'; m.setAttribute('aria-expanded', on); }
});
document.addEventListener('input', e => {
  if (e.target.id !== 'q') return; const q = e.target.value.trim().toLowerCase();
  for (const r of document.querySelectorAll('.row')) r.hidden = q && !r.dataset.q.includes(q);
  for (const l of document.querySelectorAll('.line')) l.hidden = q && ![...l.querySelectorAll('.row')].some(r => !r.hidden);
});
render();
if (/^https?:$/.test(location.protocol)) fetch('catalog.json?v=' + Math.floor(Date.now() / 600000)).then(r => r.ok ? r.json() : null).then(d => {
  if (d && (d.version !== C.version || d.date !== C.date || d.products.length !== C.products.length || JSON.stringify(d.products.map(p => p.status)) !== JSON.stringify(C.products.map(p => p.status)))) { C = d; render(); $('#ver').textContent += ' · refreshed from the live catalog'; }
}).catch(() => {});
})();
"""

def home():
    n = len(P)
    cat = json.dumps(C, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Create · Home</title>
<meta name="description" content="{E(C['tagline'])} {n} products in {len(C['lines'])} lines; open them here or save the file.">
<link rel="canonical" href="{E(PUB)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Create"><meta property="og:title" content="Create · Home">
<meta property="og:description" content="{E(C['tagline'])}"><meta property="og:url" content="{E(PUB)}"><meta property="og:image" content="{E(C['public'])}share.png">
<meta name="theme-color" content="#F8F7F4" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#191613" media="(prefers-color-scheme: dark)">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='6' y='6' width='52' height='52' rx='14' fill='%238B7355'/%3E%3Cg transform='translate(8 8) scale(1)' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 13a4 4 0 0 1 8 0v22a4 4 0 0 1-8 0z'/%3E%3Cpath d='M18 13h18a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H18'/%3E%3Cpath d='M25 21h9M25 27h9M25 33h5'/%3E%3C/g%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>{HOME_CSS}</style>
</head>
<body>
<header class="top"><a class="wm" href="./"><i><svg viewBox='0 0 48 48' width='18' height='18' fill='none' stroke='#fff' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M10 13a4 4 0 0 1 8 0v22a4 4 0 0 1-8 0z'/><path d='M18 13h18a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H18'/><path d='M25 21h9M25 27h9M25 33h5'/></svg></i><small>Scrolls</small> Create</a><nav><a href="#live">Live</a><a href="#lines-h">Lines</a><a href="#how">How it works</a><a href="#docs">Docs</a><a href="../#/create">On The Watch ›</a></nav></header>
<main class="wrap">
  <section class="hero"><div><p class="k">Scrolls · Create · The static home</p><h1>Free apps that sync phone to phone.</h1>
    <p>{E(C['tagline'])} One HTML file each: open it here, or save it and double-click it. To work with someone, share a six-letter code and your two devices talk directly.</p>
    <div class="btns"><a class="btn pri" href="../../vision/">Open Vision</a><a class="btn" href="#lines-h">Browse the lines</a><a class="btn" href="portfolio/">Portfolio</a><a class="btn" href="spec/">Build spec</a></div></div>
    <div class="stats" id="stats"></div></section>
  <section id="live"><div class="sh"><h2>Live now</h2><p>Open and use today.</p></div><div class="tiles" id="liveTiles"></div></section>
  <section id="buildWrap"><div class="sh"><h2>In build this wave</h2><p>Working files, being brought through the gate.</p></div><div class="tiles" id="build"></div></section>
  <section><div class="sh" id="lines-h"><h2>Every line, every product</h2><p>{len(C['lines'])} lines, {n} products. Open, download, or read the spec.</p></div>
    <div class="find"><input id="q" type="search" placeholder="Find a product — “budget”, “poker”, “two people”…" aria-label="Find a product"></div>
    <div id="lines"></div></section>
  <section id="how"><div class="sh"><h2>How it works</h2><p>Pair two devices in a minute.</p></div>
    <ol class="steps"><li><b>Open it</b>Open any product here, or download the file and double-click it. It works on its own, offline too.</li>
      <li><b>Show your code</b>Tap Share. Your six-letter code is this browser's name; send it, or show the QR.</li>
      <li><b>Connect</b>The other person types your code (or scans). The first time, you let their device in.</li>
      <li><b>Forget about it</b>From then on the two devices find each other whenever both are open. Everything stays in your browsers; back up as a file or a link.</li></ol>
    <div class="prin" id="prin"></div></section>
  <section id="docs"><div class="sh"><h2>Documents</h2><p>Built from the same catalog as this page.</p></div>
    <div class="docs"><a class="doc" href="portfolio/"><b>Portfolio 2.0</b><span>{E(C['docs']['portfolio'])} · the line for leadership: every product, line by line, with the roadmap.</span></a>
      <a class="doc" href="spec/"><b>Engineering build spec 2.0</b><span>{E(C['docs']['spec'])} · protocol v2 from the shipped Vision, storage, the inbox handoff, every data model, the gate.</span></a>
      <a class="doc" href="https://github.com/BBOLDT86/lanscape-navigator/blob/main/news/create/apps/BUILDING.md" target="_blank" rel="noopener"><b>BUILDING.md</b><span>The short contract a product is built to.</span></a>
      <a class="doc" href="https://github.com/BBOLDT86/lanscape-navigator/tree/main/news/create" target="_blank" rel="noopener"><b>The source</b><span>catalog.json, the test harness that pairs two real browsers, and every product's file.</span></a></div></section>
</main>
<footer><div class="wrap"><p id="ver"></p><p>Create is part of <a href="../">The Watch</a>, on <a href="../../">LANscape Navigator</a>. Nothing here is uploaded anywhere; there is nowhere to upload it. © 2026 Scrolls. All products free forever.</p></div></footer>
<script type="application/json" id="catalog">{cat}</script>
<script>{HOME_JS.replace("$('#live').innerHTML", "$('#liveTiles').innerHTML")}</script>
</body>
</html>
"""

if __name__ == '__main__':
    open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8').write(home()); print('wrote', os.path.join(HERE, 'index.html'))
    for d, fn in (('portfolio', portfolio), ('spec', spec)):
        os.makedirs(os.path.join(HERE, d), exist_ok=True)
        out = os.path.join(HERE, d, 'index.html')
        open(out, 'w', encoding='utf-8').write(fn())
        print('wrote', out, os.path.getsize(out), 'bytes')
