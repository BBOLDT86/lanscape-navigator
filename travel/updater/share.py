#!/usr/bin/env python3
"""Weekender's link previews: what iMessage, X, Facebook, WhatsApp and Slack show when someone shares a link.

  python3 travel/updater/share.py           a card and a share page for every guide that doesn't have one yet
  python3 travel/updater/share.py --site    also redraw the site's card (travel/share.png) and icon (travel/icon-180.png)
  python3 travel/updater/share.py --all     redraw every guide's card and page

Each guide gets travel/s/<id>.png (its opening picture, the city's color, the title and the weekend's dates) and
travel/s/<id>.html, whose tags carry that card and the guide's summary; a person who opens it goes straight on to the
guide. Link previews can't see past the # in a URL, so this is how a shared guide shows its own picture and headline.
Needs Pillow. Fonts: Bodoni Moda and Schibsted Grotesk (SIL Open Font License, in fonts/).
"""
import datetime as dt
import hashlib
import html
import io
import json
import os
import random
import sys
import urllib.request

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
TRAVEL = os.path.normpath(os.path.join(HERE, '..'))
FONTS = os.path.join(HERE, 'fonts')
PUBLIC = 'https://bboldt86.github.io/lanscape-navigator/travel/'
UA = 'WeekenderBot/1.0 (https://bboldt86.github.io/lanscape-navigator/travel/; the-watch-news@users.noreply.github.com)'
W, H, S = 1200, 630, 2
BOARD, BOARD2, FLAP, FLAP2, AMBER, RED, BLUE, PAPER, INK = '#1E2329', '#2A3038', '#F1EBD8', '#BDB59E', '#F5BE41', '#D7263D', '#1F4E9C', '#F3F5F6', '#142130'


def font(name, size, wght=None, opsz=None):
    f = ImageFont.truetype(os.path.join(FONTS, name), int(size * S))
    try:
        axes = f.get_variation_axes()
        vals = []
        for a in axes:
            n = a['name'] if isinstance(a['name'], str) else a['name'].decode()
            vals.append(wght if n == 'Weight' and wght else opsz if n.startswith('Optical') and opsz else a['default'])
        f.set_variation_by_axes(vals)
    except Exception:  # noqa: BLE001
        pass
    return f


def bodoni(size, wght=500, italic=False, opsz=28):
    return font('BodoniModa-Italic.ttf' if italic else 'BodoniModa.ttf', size, wght, opsz)  # a low optical size keeps the hairlines


def sans(size, wght=600):
    return font('SchibstedGrotesk.ttf', size, wght)


def t(d, xy, s, f, fill, anchor='la'):
    d.text((xy[0] * S, xy[1] * S), s, font=f, fill=fill, anchor=anchor)


def airmail(d, y, h=8, width=W):
    x = -40
    k = 0
    while x < width + 40:
        col = RED if k % 2 == 0 else BLUE
        d.polygon([((x) * S, (y + h) * S), ((x + 12) * S, (y + h) * S), ((x + 12 + h) * S, y * S), ((x + h) * S, y * S)], fill=col)
        x += 20
        k += 1


def flap_row(d, x, y, text, n, size=30, fg=FLAP):
    cw, ch = size * 0.92, size * 1.42
    f = sans(size, 750)
    for i in range(n):
        c = text[i] if i < len(text) else ' '
        x0 = x + i * (cw + 3)
        d.rounded_rectangle([x0 * S, y * S, (x0 + cw) * S, (y + ch) * S], radius=3 * S, fill='#2B3139')
        d.rectangle([x0 * S, (y + ch / 2) * S, (x0 + cw) * S, (y + ch) * S], fill='#252A31')
        if c != ' ':
            d.text(((x0 + cw / 2) * S, (y + ch / 2 + 1) * S), c, font=f, fill=fg, anchor='mm')
        d.line([x0 * S, (y + ch / 2) * S, (x0 + cw) * S, (y + ch / 2) * S], fill='#14171B', width=S)
    return x + n * (cw + 3)


def finish(im, path):
    im = im.convert('RGB').resize((W, H), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'PNG', optimize=True)
    print('wrote', os.path.relpath(path, TRAVEL), os.path.getsize(path) // 1024, 'KB')


def cities():
    return json.load(open(os.path.join(TRAVEL, 'data', 'cities.json'), encoding='utf-8'))['cities']


# ------------------------------------------------------------------ the site's card and icon
def site_card():
    im = Image.new('RGB', (W * S, H * S), PAPER)
    d = ImageDraw.Draw(im)
    airmail(d, 0, 10)
    t(d, (64, 58), 'Weekender', bodoni(84, 700, True), INK)
    t(d, (68, 166), 'Three perfect days,', bodoni(44, 600, opsz=12), INK)
    t(d, (68, 216), 'every weekend.', bodoni(44, 600, opsz=12), INK)
    lines = ['Eight cities planned day by day', 'for the coming weekend.', '', 'Live weather. What’s on.', 'Flights and hotels, filled in.']
    y = 300
    for ln in lines:
        if ln:
            t(d, (70, y), ln, sans(23, 500), '#465567')
        y += 32 if ln else 16
    t(d, (70, 560), 'Fresh every Monday  ·  Free, no sign-up', sans(18, 600), '#7A8795')
    bx, by, bw, bh = 560, 54, 590, 520
    d.rounded_rectangle([bx * S, by * S, (bx + bw) * S, (by + bh) * S], radius=22 * S, fill=BOARD)
    t(d, (bx + 26, by + 22), 'Weekend departures', sans(19, 650), FLAP)
    rnd = random.Random(7)
    y = by + 64
    for c in cities():
        x = flap_row(d, bx + 26, y, c['name'].upper(), 13, 22)
        hh = rnd.choice(['09', '11', '14', '16', '19', '21'])
        flap_row(d, x + 14, y, f'{hh}:{rnd.choice(["05", "20", "35", "50"])}', 5, 22, AMBER)
        y += 54
    finish(im, os.path.join(TRAVEL, 'share.png'))


def icon():
    n = 180
    im = Image.new('RGB', (n * S, n * S), BOARD)
    d = ImageDraw.Draw(im)
    for i, (ch, col) in enumerate((('W', FLAP), ('3', AMBER))):
        x0 = 22 + i * 72
        d.rounded_rectangle([x0 * S, 36 * S, (x0 + 64) * S, 144 * S], radius=8 * S, fill='#2B3139')
        d.rectangle([x0 * S, 90 * S, (x0 + 64) * S, 144 * S], fill='#252A31')
        d.text(((x0 + 32) * S, 92 * S), ch, font=bodoni(64, 700), fill=col, anchor='mm')
        d.line([x0 * S, 90 * S, (x0 + 64) * S, 90 * S], fill='#14171B', width=3 * S)
    im = im.resize((n, n), Image.LANCZOS)
    im.save(os.path.join(TRAVEL, 'icon-180.png'), 'PNG', optimize=True)
    print('wrote icon-180.png')


# ------------------------------------------------------------------ a guide's card and page
def fetch_image(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        return Image.open(io.BytesIO(r.read())).convert('RGB')


def cover(im, w, h):
    r = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * r + 1), int(im.height * r + 1)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def wrap(s, f, width):
    words, lines, cur = s.split(), [], ''
    for w in words:
        tt = (cur + ' ' + w).strip()
        if f.getlength(tt) / S <= width or not cur:
            cur = tt
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def dates(wk):
    a = dt.date.fromisoformat(wk)
    b = a + dt.timedelta(days=2)
    return f"{a:%B} {a.day}–{b.day}" if a.month == b.month else f"{a:%b} {a.day} – {b:%b} {b.day}"


def guide_card(g, c, photo, path):
    im = Image.new('RGB', (W * S, H * S), c['color'])
    if photo:
        try:
            ph = cover(fetch_image(photo), W * S, H * S)
            im.paste(ph, (0, 0))
        except Exception as ex:  # noqa: BLE001
            print('photo failed:', ex)
    shade = Image.new('L', (1, 256))
    for y in range(256):
        shade.putpixel((0, y), int(min(255, max(0, (y - 70) * 1.35))))
    shade = shade.resize((W * S, H * S))
    im = Image.composite(Image.new('RGB', im.size, (8, 10, 14)), im, shade.point(lambda v: int(v * 0.86)))
    d = ImageDraw.Draw(im)
    d.rectangle([0, (H - 12) * S, W * S, H * S], fill=c['color'])
    t(d, (56, 46), 'Weekender', bodoni(40, 700, True), '#FFFFFF')
    t(d, (W - 56, 54), f"{dates(g['weekend'])}", sans(22, 650), '#FFFFFF', anchor='ra')
    for size in (88, 80, 72, 64, 56):
        lines = wrap(g['title'], bodoni(size, 500), 1060)
        if len(lines) <= 2:
            break
    y = 468 - (len(lines) - 1) * size * 0.98
    for ln in lines[:3]:
        t(d, (54, y - size * 0.8), ln, bodoni(size, 500), '#FFFFFF')
        y += size * 0.98
    dek = wrap(g.get('dek', ''), sans(23, 500), 1040)[:1]
    if dek:
        full = wrap(g['dek'], sans(23, 500), 1040)
        line = dek[0] + ('…' if len(full) > 1 else '')
        t(d, (56, 520), line, sans(23, 500), '#E8ECEF')
    t(d, (56, 568), 'Three days, the things on only this weekend, three hotels, and flights a tap away', sans(17, 550), '#C5CDD5')
    finish(im, path)


def share_page(g, c, path):
    e = lambda s: html.escape(s, quote=True)  # noqa: E731
    url = f"{PUBLIC}s/{g['id']}.html"
    app = f"../#/g/{g['city']}/{g['weekend']}"
    desc = f"{g['dek']} A plan for {dates(g['weekend'])}, with the weather, what’s on, three hotels and flights a tap away."
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(g['title'])} · Weekender</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{e(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Weekender">
<meta property="og:title" content="{e(g['title'])}, {e(dates(g['weekend']))}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(url)}">
<meta property="og:image" content="{e(PUBLIC)}s/{e(g['id'])}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{e(g['title'])}: a Weekender guide">
<meta property="article:published_time" content="{e(g['written'])}">
<meta property="article:author" content="Claude ({e(g['model'])})">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(g['title'])}, {e(dates(g['weekend']))}">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{e(PUBLIC)}s/{e(g['id'])}.png">
<meta name="theme-color" content="{e(c['color'])}">
<link rel="apple-touch-icon" href="../icon-180.png">
<style>body{{margin:0;background:#F3F5F6;color:#142130;font:17px/1.5 Georgia,serif;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}}
main{{max-width:640px}}h1{{font-weight:400;font-size:38px;line-height:1.1;margin:8px 0 12px}}a{{color:{e(c['color'])}}}</style>
<script>if (!/bot|crawl|spider|facebookexternalhit|facebot|twitterbot|slack|discord|whatsapp|telegram|linkedin|embedly|pinterest|skype|vkshare|iframely|preview/i.test(navigator.userAgent)) location.replace({json.dumps(app)});</script>
</head>
<body><main><p>Weekender, {e(dates(g['weekend']))}</p><h1>{e(g['title'])}</h1><p>{e(g['dek'])}</p>
<p>By Claude ({e(g['model'])}).</p><p><a href="{e(app)}">Open the guide</a></p></main></body>
</html>
"""
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(page)


def guides(redo):
    try:
        idx = json.load(open(os.path.join(TRAVEL, 'guides', 'index.json'), encoding='utf-8'))
    except (OSError, ValueError):
        return 0
    ph = {}
    try:
        ph = json.load(open(os.path.join(TRAVEL, 'data', 'photos.json'), encoding='utf-8')).get('titles', {})
    except (OSError, ValueError):
        pass
    C = {c['id']: c for c in cities()}
    out = os.path.join(TRAVEL, 's')
    os.makedirs(out, exist_ok=True)
    n = 0
    for w in idx.get('weekends') or []:
        for row in w['guides']:
            try:
                g = json.load(open(os.path.join(TRAVEL, 'guides', w['weekend'], row['city'] + '.json'), encoding='utf-8'))
            except (OSError, ValueError):
                continue
            c = C[g['city']]
            hero = (g.get('hero') or {}).get('wiki') or c['wiki']
            src = ((ph.get(hero) or ph.get(c['wiki']) or {}).get('img') or {}).get('src')
            sig = hashlib.sha1(json.dumps([g['title'], g['dek'], g['weekend'], src, 1], ensure_ascii=False).encode()).hexdigest()[:10]
            page, stamp = os.path.join(out, g['id'] + '.html'), os.path.join(out, '.' + g['id'] + '.sig')
            if not redo and os.path.exists(page) and os.path.exists(stamp) and open(stamp).read().strip() == sig:
                continue
            guide_card(g, c, src, os.path.join(out, g['id'] + '.png'))
            share_page(g, c, page)
            open(stamp, 'w').write(sig + '\n')
            n += 1
    print(f'share: {n} guide card{"s" if n != 1 else ""} drawn')
    return n


def main():
    if '--site' in sys.argv:
        site_card()
        icon()
    guides('--all' in sys.argv)
    return 0


if __name__ == '__main__':
    sys.exit(main())
