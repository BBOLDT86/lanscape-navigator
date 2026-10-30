#!/usr/bin/env python3
"""Build a personal My Watch page for each preset in news/my/people/*.json.

Each <slug>.json becomes /<slug>/index.html at the repo root (bboldt86.github.io/lanscape-navigator/<slug>/):
the same page as news/my/, with the person's cards as its first-visit layout, its own saved layout
(separate from news/my/), and The Watch's links pointed back at ../news/. Re-run after changing news/my/index.html:

    python3 news/my/build-people.py
"""
import json, pathlib, html, re

ROOT = pathlib.Path(__file__).resolve().parents[2]
HUB = ROOT / 'news' / 'my' / 'index.html'
src = HUB.read_text()

for p in sorted((ROOT / 'news' / 'my' / 'people').glob('*.json')):
    cfg = json.loads(p.read_text())
    slug = cfg['slug']
    conf = {'base': '../news/', 'key': 'watch.my.' + slug, 'home': f'/lanscape-navigator/{slug}/', 'title': cfg['title'], 'preset': cfg['preset']}
    out = src.replace('href="../', 'href="../news/')
    out = out.replace('<title>My Watch</title>', f'<title>{html.escape(cfg["title"])}</title>')
    out = out.replace('<link rel="canonical" href="https://bboldt86.github.io/lanscape-navigator/news/my/">',
                      f'<link rel="canonical" href="https://bboldt86.github.io/lanscape-navigator/{slug}/">')
    out = out.replace('<span id="edline">My Watch</span>', f'<span id="edline">{html.escape(cfg["title"])}</span>')
    d = html.escape(cfg.get('description', ''), quote=True)
    out = re.sub(r'<meta name="description" content="[^"]*">', lambda m: f'<meta name="description" content="{d}">', out, count=1)
    boot = '<script>window.MYWATCH = ' + json.dumps(conf, ensure_ascii=False).replace('</', '<\\/') + ';</script>\n'
    out = out.replace("<script>\n'use strict';", boot + "<script>\n'use strict';", 1)
    dest = ROOT / slug / 'index.html'
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(out)
    print('wrote', dest.relative_to(ROOT))
