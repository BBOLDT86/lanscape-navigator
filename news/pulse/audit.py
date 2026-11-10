#!/usr/bin/env python3
"""The Pulse: can readers find The Watch?

Checks every page for what search engines and link previews need (a title, a description, a share image, a canonical
link, one headline), writes news/pulse/data/audit.json for the dashboard, and writes /sitemap.xml at the top of the
site (https://bboldt86.github.io/lanscape-navigator/sitemap.xml) for Google Search Console and Bing Webmaster Tools.

    python3 news/pulse/audit.py
"""
import datetime as dt
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from inject import ROOT, pages  # noqa: E402

SITE = 'https://bboldt86.github.io/lanscape-navigator'
OUT = os.path.join(ROOT, 'news', 'pulse', 'data', 'audit.json')
SITEMAP = os.path.join(ROOT, 'sitemap.xml')


def meta(s, name):
    for pat in (rf'<meta[^>]+(?:name|property)=["\']{re.escape(name)}["\'][^>]*content=["\']([^"\']*)["\']',
                rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:name|property)=["\']{re.escape(name)}["\']'):
        m = re.search(pat, s, re.I)
        if m:
            return html.unescape(m.group(1)).strip()
    return ''


def url_path(rel):
    p = '/' + rel
    return re.sub(r'index\.html$', '', p)


def main():
    out = []
    urls = []
    for path, rel in pages():
        if rel.startswith('news/r/') or rel.startswith('news/pulse/'):
            continue
        try:
            s = open(path, encoding='utf-8').read()
        except (UnicodeDecodeError, OSError):
            continue
        head = s[:20000]
        if re.search(r'http-equiv=["\']refresh', head, re.I) or re.search(r'^\s*<script>[^<]*location\.replace', s[:3000], re.M):
            continue
        robots = meta(head, 'robots').lower()
        m = re.search(r'<title[^>]*>(.*?)</title>', head, re.I | re.S)
        title = html.unescape(re.sub(r'\s+', ' ', m.group(1))).strip() if m else ''
        desc = meta(head, 'description') or meta(head, 'og:description')
        img = meta(head, 'og:image')
        can = re.search(r'<link[^>]+rel=["\']canonical["\'][^>]*href=["\']([^"\']+)', head, re.I)
        h1 = len(re.findall(r'<h1[\s>]', s, re.I))
        js_page = len(re.sub(r'<script.*?</script>|<style.*?</style>|<[^>]+>', ' ', s, flags=re.S | re.I).split()) < 120
        issues, minor = [], []
        if not title:
            issues.append('no title')
        elif len(title) > 90:
            minor.append('long title')
        if not desc:
            issues.append('no description')
        elif len(desc) < 50:
            minor.append('short description')
        if not img:
            issues.append('no share image')
        if not can:
            minor.append('no canonical link')
        if h1 == 0 and not js_page:
            minor.append('no headline (h1)')
        if 'noindex' in robots:
            issues, minor = [], ['noindex']
        p = url_path(rel)
        mod = meta(head, 'article:modified_time') or meta(head, 'article:published_time')
        out.append({'p': p, 'title': title[:140], 'desc': bool(desc), 'img': bool(img), 'canonical': bool(can), 'h1': h1,
                    'issues': issues, 'minor': minor})
        if 'noindex' not in robots:
            urls.append((p, mod[:10] if re.match(r'\d{4}-\d\d-\d\d', mod or '') else ''))
    out.sort(key=lambda x: x['p'])
    counts = {'pages': len(out), 'with_issues': sum(1 for x in out if x['issues']),
              'no_description': sum(1 for x in out if 'no description' in x['issues']),
              'no_image': sum(1 for x in out if 'no share image' in x['issues']),
              'no_title': sum(1 for x in out if 'no title' in x['issues']),
              'minor': sum(1 for x in out if x['minor'])}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump({'updated': dt.date.today().isoformat(), 'counts': counts, 'pages': out}, f, ensure_ascii=False,
                  separators=(',', ':'))

    def prio(p):
        if p == '/news/':
            return '1.0'
        if re.match(r'^/news/[\w-]+/$', p):
            return '0.8'
        return '0.5'
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for p, mod in sorted(set(urls)):
        lines.append(f'  <url><loc>{html.escape(SITE + p)}</loc>' + (f'<lastmod>{mod}</lastmod>' if mod else '') +
                     f'<priority>{prio(p)}</priority></url>')
    lines.append('</urlset>')
    with open(SITEMAP, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'audit: {counts["pages"]} pages, {counts["with_issues"]} with issues; sitemap {len(urls)} urls')


if __name__ == '__main__':
    main()
