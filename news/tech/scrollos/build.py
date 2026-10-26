#!/usr/bin/env python3
"""Assemble the ScrollOS tools: src/runtime.css + src/runtime.js + src/tools/<id>.html -> tools/<id>.html.

Each tool source is an HTML fragment with a JSON header in its first comment:
    <!-- @meta {"id": "goals", "name": "Goals", ...} -->
followed by optional <style>, the page body, and a <script> that calls mountChrome().
Run from anywhere:  python3 news/tech/scrollos/build.py
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC, OUT = ROOT / 'src', ROOT / 'tools'
SITE = 'https://bboldt86.github.io/lanscape-navigator/news/tech/scrollos/'
SCROLLS = {
    'dream':    ('Dream',    '✦', '#f59e0b', '#d97706'),
    'discover': ('Discover', '◉', '#e05a48', '#c44030'),
    'unwind':   ('Unwind',   '♫', '#d8608c', '#b84870'),
    'create':   ('Create',   '◆', '#9b59b6', '#7e3f9a'),
    'connect':  ('Connect',  '⬡', '#48c870', '#38a858'),
    'produce':  ('Produce',  '▣', '#5898e8', '#4078c8'),
    'grow':     ('Grow',     '△', '#38c8d8', '#28a8b8'),
    'core':     ('ScrollOS', '⟐', '#c8a8ff', '#5e5ce6'),
}
PROMPTS = {
    'dream': 'You are a life planning coach. Be aspirational but practical. Help the user break dreams into plans and plans into actions.',
    'discover': 'You are a research librarian. Be thorough, cite sources, make connections. Help the user learn deeply and retain knowledge.',
    'unwind': 'You are a companion for leisure. Be warm, fun, and creative. Help with recipes, games, and entertainment without being productivity-obsessed.',
    'create': 'You are a creative director. Be bold and tasteful. Help the user make things that are beautiful, clear, and distinctive.',
    'connect': 'You are a communication coach. Match the user\'s voice. Help draft messages that sound human, not generated.',
    'produce': 'You are an executive assistant. Be precise and efficient. Help with documents, data, and project management.',
    'grow': 'You are a business strategist. Be analytical and action-oriented. Help with sales, marketing, finance, and growth.',
    'core': 'You are ScrollOS, a personal operating system that runs on the user\'s own machine. Be brief, warm and useful.',
}

def build_one(path, css, js):
    src = path.read_text(encoding='utf-8')
    m = re.search(r'<!--\s*@meta\s*(\{.*?\})\s*-->', src, re.S)
    if not m:
        sys.exit(f'{path}: no @meta header')
    meta = json.loads(m.group(1))
    body = src[m.end():].strip()
    sname, glyph, acc, acc2 = SCROLLS[meta['scroll']]
    tool = dict(id=meta['id'], name=meta['name'], scroll=meta['scroll'], scrollName=sname, glyph=meta.get('glyph', glyph),
                system=PROMPTS[meta['scroll']], tagline=meta.get('tagline', ''))
    style = ''
    sm = re.match(r'\s*<style>(.*?)</style>', body, re.S)
    if sm:
        style, body = sm.group(1), body[sm.end():]
    script = ''
    scm = re.search(r'<script>(.*?)</script>\s*$', body, re.S)
    if scm:
        script, body = scm.group(1), body[:scm.start()]
    desc = meta.get('description', meta.get('tagline', ''))
    title = f"{meta['name']} · ScrollOS"
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#07070b">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{SITE}tools/{meta['id']}.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="The Watch">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{SITE}tools/{meta['id']}.html">
<meta property="og:image" content="{SITE}share.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='{acc.replace('#', '%23')}'/%3E%3Ctext x='32' y='43' font-size='34' text-anchor='middle' fill='%230a0a0e' font-family='system-ui'%3E{glyph}%3C/text%3E%3C/svg%3E">
<!-- ScrollOS · {sname} · {meta['name']}. One file; built by news/tech/scrollos/build.py from src/. Talks only to your own model at localhost:11434. -->
<style>
{css}
:root{{--acc:{acc};--acc2:{acc2}}}
{style}
</style>
</head>
<body>
{body.strip()}
<script>
const TOOL = {json.dumps(tool)};
{js}
</script>
<script>
{script.strip()}
</script>
</body>
</html>
"""
    out = OUT / f"{meta['id']}.html"
    out.write_text(html, encoding='utf-8')
    return out, len(html)

def main():
    css = (SRC / 'runtime.css').read_text(encoding='utf-8')
    js = (SRC / 'runtime.js').read_text(encoding='utf-8')
    OUT.mkdir(exist_ok=True)
    for p in sorted((SRC / 'tools').glob('*.html')):
        out, n = build_one(p, css, js)
        print(f'{out.relative_to(ROOT)}  {n/1024:.0f} KB')

if __name__ == '__main__':
    main()
