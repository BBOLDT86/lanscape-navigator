#!/usr/bin/env python3
"""Build a personal My Watch page for each preset in news/my/people/*.json.

Each <slug>.json becomes /<slug>/index.html at the repo root (bboldt86.github.io/lanscape-navigator/<slug>/):
the same page as news/my/, with the person's cards as its first-visit layout, its own saved layout
(separate from news/my/), The Watch's links pointed back at ../news/, and a share image (share.png) so the link
unfurls in iMessage, WhatsApp and the rest. Re-run after changing news/my/index.html or a preset:

    python3 news/my/build-people.py            # pages + share images (needs playwright for the images)
    python3 news/my/build-people.py --no-image # pages only

"pv" in a preset is its version: bump it when the cards change and a reader who already has the page gets a nudge
to load the new layout (their own layout is never replaced without asking).
"""
import json, pathlib, html, re, sys, hashlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
HUB = ROOT / 'news' / 'my' / 'index.html'
SITE = 'https://bboldt86.github.io/lanscape-navigator/'
src = HUB.read_text()

SHARE_HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;width:1200px;height:630px;overflow:hidden;background:#0E1A2B;color:#E7EDF4;font-family:Inter,'Instrument Sans',system-ui,sans-serif;position:relative}
.bg{position:absolute;inset:0;background:radial-gradient(900px 500px at 85% 10%,#1A3A55 0%,rgba(26,58,85,0) 60%),linear-gradient(160deg,#0E1A2B,#0B1424 70%)}
.wrap{position:absolute;inset:0;padding:60px 72px 56px;display:flex;gap:36px}
.l{flex:1;min-width:0;display:flex;flex-direction:column}
.k{font:600 20px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#D6B25E}
h1{font:400 112px/1 'GFS Baskerville','Bitstream Charter',Georgia,serif;margin:30px 0 20px;letter-spacing:-.01em;color:#F5F7F6}
.s{font:italic 31px/1.25 'GFS Baskerville','Bitstream Charter',Georgia,serif;color:#E7EDF4;max-width:620px;margin:0 0 30px}
ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;font:500 20px/1.25 Inter,sans-serif;color:#E7EDF4}
li{padding-left:23px;text-indent:-23px}
li::before{content:"";display:inline-block;width:11px;height:11px;border-radius:50%;background:#D6B25E;margin-right:12px;vertical-align:1px}
.f{margin-top:auto;font:400 19px Inter,sans-serif;color:#7F8EA3}
.r{width:360px;flex:none;position:relative}
.g{position:absolute;top:36px;right:22px;width:320px;display:grid;grid-template-columns:1fr 1fr;gap:12px;transform:rotate(-5deg);transform-origin:center}
.c{background:#142539;border:1px solid rgba(231,237,244,.12);border-radius:14px;padding:12px 13px;min-height:88px}
.c.w{grid-column:span 2}
.c b{display:block;font:600 13px Inter,sans-serif;color:#E7EDF4;margin-bottom:6px}
.c i{display:block;height:7px;border-radius:4px;background:rgba(231,237,244,.18);margin:5px 0}
.c i.s{width:60%}.c i.g{background:#D6B25E;width:45%}
.c .n{font:400 30px/1 'GFS Baskerville',Georgia,serif;color:#F5F7F6}
.c .u{color:#5BC48C;font:600 12px Inter}.c .d{color:#E8705A;font:600 12px Inter}
</style></head><body><div class="bg"></div><div class="wrap">
<div class="l"><div class="k">__KICKER__</div><h1>__HEAD__</h1><p class="s">__SUB__</p><ul>__BULLETS__</ul><div class="f">__FOOT__</div></div>
<div class="r"><div class="g">
<div class="c w"><b>__CARD1__</b><i></i><i class="s"></i><i></i><i class="s"></i></div>
<div class="c"><b>Weather</b><span class="n">54°</span><i class="s"></i></div>
<div class="c"><b>Scores</b><i class="g"></i><i class="s"></i><i></i></div>
<div class="c"><b>Markets</b><span class="u">+1.2%</span><i></i><span class="d">−0.8%</span></div>
<div class="c"><b>Prompt ideas</b><i></i><i class="s"></i><i></i></div>
<div class="c w"><b>Bills · Rewards · Inbox</b><i class="s"></i><i class="g"></i></div>
</div></div></div></body></html>"""

def share_image(cfg, dest):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('  (playwright not installed; share image skipped)'); return
    sh = cfg.get('share') or {}
    first = next((w for w in cfg['preset']['w'] if w['t'] == 'source'), None)
    page = (SHARE_HTML.replace('__KICKER__', html.escape(sh.get('kicker', 'One page · no login')))
            .replace('__HEAD__', html.escape(sh.get('headline', cfg['title'])))
            .replace('__SUB__', html.escape(sh.get('sub', cfg.get('description', ''))))
            .replace('__BULLETS__', ''.join(f'<li>{html.escape(b)}</li>' for b in sh.get('bullets', [])))
            .replace('__FOOT__', html.escape(sh.get('foot', 'Updated six times a day')))
            .replace('__CARD1__', html.escape((first or {}).get('c', {}).get('name', 'Top stories'))))
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1200, 'height': 630})
        pg.set_content(page); pg.wait_for_timeout(300); pg.screenshot(path=str(dest)); b.close()
    print('  wrote', dest.relative_to(ROOT))

for p in sorted((ROOT / 'news' / 'my' / 'people').glob('*.json')):
    cfg = json.loads(p.read_text())
    slug = cfg['slug']
    pv = cfg.get('pv') or int(hashlib.sha1(json.dumps(cfg['preset'], sort_keys=True).encode()).hexdigest()[:6], 16)
    conf = {'base': '../news/', 'key': 'watch.my.' + slug, 'home': f'/lanscape-navigator/{slug}/', 'title': cfg['title'], 'pv': pv, 'preset': cfg['preset']}
    out = src.replace('href="../', 'href="../news/')
    out = out.replace('<title>My Watch</title>', f'<title>{html.escape(cfg["title"])}</title>')
    out = out.replace(f'<link rel="canonical" href="{SITE}news/my/">', f'<link rel="canonical" href="{SITE}{slug}/">')
    out = out.replace('<span id="edline">My Watch</span>', f'<span id="edline">{html.escape(cfg["title"])}</span>')
    d = html.escape(cfg.get('description', ''), quote=True)
    out = re.sub(r'<meta name="description" content="[^"]*">', lambda m: f'<meta name="description" content="{d}">', out, count=1)
    sh = cfg.get('share') or {}
    og = (f'<meta property="og:type" content="website">\n<meta property="og:site_name" content="The Watch">\n'
          f'<meta property="og:title" content="{html.escape(sh.get("headline", cfg["title"]), quote=True)}">\n'
          f'<meta property="og:description" content="{html.escape(sh.get("sub", cfg.get("description", "")), quote=True)}">\n'
          f'<meta property="og:url" content="{SITE}{slug}/">\n'
          f'<meta property="og:image" content="{SITE}{slug}/share.png">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'
          f'<meta property="og:image:alt" content="{html.escape(sh.get("headline", cfg["title"]), quote=True)}">\n'
          f'<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="{html.escape(sh.get("headline", cfg["title"]), quote=True)}">\n'
          f'<meta name="twitter:description" content="{html.escape(sh.get("sub", cfg.get("description", "")), quote=True)}">\n<meta name="twitter:image" content="{SITE}{slug}/share.png">')
    out = re.sub(r'<meta property="og:title"[^>]*>\n<meta property="og:description"[^>]*>\n<meta property="og:image"[^>]*>', og, out, count=1)
    boot = '<script>window.MYWATCH = ' + json.dumps(conf, ensure_ascii=False).replace('</', '<\\/') + ';</script>\n'
    out = out.replace("<script>\n'use strict';", boot + "<script>\n'use strict';", 1)
    dest = ROOT / slug / 'index.html'
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(out)
    print('wrote', dest.relative_to(ROOT), 'pv', pv)
    if '--no-image' not in sys.argv:
        share_image(cfg, dest.parent / 'share.png')
