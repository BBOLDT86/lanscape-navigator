#!/usr/bin/env python3
"""The Watch's link previews: the picture and words that iMessage, X, Facebook, LinkedIn, Slack and the rest show
when someone shares a link.

  python3 news/updater/share.py            a card and a share page for every report that doesn't have one yet
  python3 news/updater/share.py --site     also redraw the site's own cards (news/share.png, share-pt.png, share-de.png)
                                           and the Portuguese and German landing pages (news/pt.html, news/de.html)
  python3 news/updater/share.py --all      redraw every report's card and page

The site's card (news/share.png, 1200 x 630) is named in news/index.html's Open Graph and Twitter tags; pt.html and
de.html carry the same in Portuguese and German and send a person on to the page in that language. Each report
gets its own card (news/r/<id>.png) and a small share page (news/r/<id>.html) whose tags carry the report's headline,
summary and byline; a person who opens it goes straight on to the report in The Watch. A report with a translation
also gets news/r/<id>.pt.png / .pt.html (and .de). Link previews can't see past the # in a URL, so this is how a
shared report shows its own headline.

Needs Pillow (pip install pillow). Fonts: Instrument Serif and Instrument Sans (SIL Open Font License, in fonts/).
"""
import datetime as dt
import hashlib
import html
import json
import math
import os
import sys
from zoneinfo import ZoneInfo

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
NEWS = os.path.normpath(os.path.join(HERE, '..'))
FONTS = os.path.join(HERE, 'fonts')
PUBLIC = 'https://bboldt86.github.io/lanscape-navigator/news/'
ET = ZoneInfo('America/New_York')
S = 2  # draw at twice the size, then scale down: smooth curves and type
W, H = 1200, 630
NAVY, NAVY2, INK, INK2, INK3, BRASS, BRASS2, SHOAL = '#0E1A2B', '#0A1322', '#E7EDF4', '#AEBBCB', '#7F8EA3', '#D6B25E', '#E3C47E', '#1A3A55'
LOC = {
    'en': {'locale': 'en_US', 'desc': None, 'kicker': 'LIVE NEWS  ·  EVERY OUTLET  ·  SIX TIMES A DAY', 'tag': ('Every story, every outlet,', 'side by side.'),
           'feats': ['160+ live sources', 'Pictures and video', 'Markets and elections', 'Learns what you read'],
           'foot': 'Free  ·  No sign-up  ·  Private by design', 'dial': 'EDITIONS A DAY', 'title': 'The Watch · The news, six times a day',
           'alt': 'The Watch: every story, every outlet, side by side. Live news from 160+ sources, six editions a day.',
           'report': 'THE WATCH REPORT', 'by': 'By Claude', 'open': 'Open The Watch', 'read': 'Read the report in The Watch',
           'rdesc': '{dek} An in-depth report by Claude ({model}), {day}, with every claim cited.', 'at': 'By Claude ({model}), {day} at {t} ET.',
           'ralt': '{title}: a report in The Watch'},
    'pt': {'locale': 'pt_BR', 'kicker': 'NOTÍCIAS AO VIVO  ·  TODOS OS VEÍCULOS  ·  SEIS VEZES POR DIA', 'tag': ('Cada notícia, cada veículo,', 'lado a lado.'),
           'feats': ['160+ fontes ao vivo', 'Fotos e vídeos', 'Mercados e eleições', 'Aprende o que você lê'],
           'foot': 'Grátis  ·  Sem cadastro  ·  Privado por princípio', 'dial': 'EDIÇÕES POR DIA', 'title': 'The Watch · As notícias, seis vezes por dia',
           'desc': ('Notícias ao vivo de mais de 160 fontes, atualizadas seis vezes por dia, em português, inglês e alemão. Veja como cada veículo '
                    'cobre uma notícia, passe pelo dia em fotos e vídeos, acompanhe mercados e eleições e tenha uma capa que aprende o que você lê. '
                    'Grátis, sem cadastro, privado.'),
           'alt': 'The Watch: cada notícia, cada veículo, lado a lado. Notícias ao vivo de mais de 160 fontes, seis edições por dia.',
           'report': 'REPORTAGEM DO THE WATCH', 'by': 'Por Claude', 'open': 'Abrir o The Watch', 'read': 'Leia a reportagem no The Watch',
           'rdesc': '{dek} Uma reportagem aprofundada de Claude ({model}), {day}, com todas as informações citadas.',
           'at': 'Por Claude ({model}), {day}, às {t} (horário de Nova York).', 'ralt': '{title}: uma reportagem do The Watch'},
    'de': {'locale': 'de_DE', 'kicker': 'LIVE-NACHRICHTEN  ·  ALLE MEDIEN  ·  SECHSMAL AM TAG', 'tag': ('Jede Meldung, jedes Medium,', 'Seite an Seite.'),
           'feats': ['160+ Live-Quellen', 'Bilder und Videos', 'Märkte und Wahlen', 'Lernt, was Sie lesen'],
           'foot': 'Kostenlos  ·  Ohne Anmeldung  ·  Ganz privat', 'dial': 'AUSGABEN AM TAG', 'title': 'The Watch · Die Nachrichten, sechsmal am Tag',
           'desc': ('Live-Nachrichten aus mehr als 160 Quellen, sechsmal am Tag neu, auf Deutsch, Englisch und Portugiesisch. Sehen Sie, wie jedes '
                    'Medium über eine Geschichte berichtet, blättern Sie durch den Tag in Bildern und Videos, verfolgen Sie Märkte und Wahlen, und '
                    'lesen Sie eine Titelseite, die lernt, was Sie interessiert. Kostenlos, ohne Anmeldung, privat.'),
           'alt': 'The Watch: jede Meldung, jedes Medium, Seite an Seite. Live-Nachrichten aus mehr als 160 Quellen, sechs Ausgaben am Tag.',
           'report': 'BERICHT VON THE WATCH', 'by': 'Von Claude', 'open': 'The Watch öffnen', 'read': 'Den Bericht in The Watch lesen',
           'rdesc': '{dek} Ein ausführlicher Bericht von Claude ({model}), {day}, jede Angabe mit Quelle.',
           'at': 'Von Claude ({model}), {day}, {t} Uhr New Yorker Zeit.', 'ralt': '{title}: ein Bericht in The Watch'},
}
MONTHS = {'pt': 'janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro'.split(),
          'de': 'Januar Februar März April Mai Juni Juli August September Oktober November Dezember'.split()}
PITCH = ('Live news from 160+ sources, rebuilt six times a day. See how every outlet covers a story, swipe through the day '
         'in pictures and video, follow markets and elections, and get a front page that learns what you read. Free, no sign-up, private.')


def font(name, size, wght=None):
    f = ImageFont.truetype(os.path.join(FONTS, name), size * S)
    if wght:
        try:
            f.set_variation_by_axes([100, wght])  # width, weight
        except Exception:  # noqa: BLE001
            pass
    return f


def serif(size):
    return font('InstrumentSerif-Regular.ttf', size)


def serif_i(size):
    return font('InstrumentSerif-Italic.ttf', size)


def sans(size, wght=500):
    return font('InstrumentSans.ttf', size, wght)


def canvas():
    im = Image.new('RGB', (W * S, H * S), NAVY)
    g = Image.new('L', (1, 256))
    for y in range(256):
        g.putpixel((0, y), y)
    grad = g.resize((W * S, H * S))
    im = Image.composite(Image.new('RGB', im.size, NAVY2), im, grad)
    return im


def glow(im, cx, cy, r, color, alpha):
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(r * S * 0.45))
    im.paste(layer, (0, 0), layer)


def polar(cx, cy, r, h):
    a = (h / 24) * math.tau - math.pi / 2
    return cx + r * math.cos(a), cy + r * math.sin(a)


def dial(im, cx, cy, r, now_h=20.5, labels=True, center=None):
    """the watch dial from the masthead: 24 hours, six watches, the current one in brass, a hand at the time"""
    d = ImageDraw.Draw(im)
    r0, r1 = r * 0.74, r * 0.93
    for k in range(6):
        h0, h1 = k * 4, k * 4 + 4
        cur = h0 <= now_h < h1
        col = BRASS if cur else (SHOAL if h1 <= now_h else '#24324A')
        a0, a1 = h0 / 24 * 360 - 90 + 1.6, h1 / 24 * 360 - 90 - 1.6
        bbox = [(cx - (r0 + r1) / 2) * S, (cy - (r0 + r1) / 2) * S, (cx + (r0 + r1) / 2) * S, (cy + (r0 + r1) / 2) * S]
        d.arc(bbox, a0, a1, fill=col, width=int((r1 - r0) * S))
    for h in range(24):
        major = h % 4 == 0
        x0, y0 = polar(cx, cy, r * (0.965 if major else 0.985), h)
        x1, y1 = polar(cx, cy, r * 1.06, h)
        d.line([x0 * S, y0 * S, x1 * S, y1 * S], fill=INK if major else INK3, width=int((2.4 if major else 1.4) * S * r / 200))
    if labels:
        f = sans(max(12, int(r * 0.085)), 600)
        for i, t in enumerate(['12a', '4a', '8a', '12p', '4p', '8p']):
            x, y = polar(cx, cy, r * 1.2, i * 4)
            d.text((x * S, y * S), t, font=f, fill=INK3, anchor='mm')
    x1, y1 = polar(cx, cy, r * 1.06, now_h)
    x0, y0 = polar(cx, cy, r * 0.66, now_h)
    d.line([x0 * S, y0 * S, x1 * S, y1 * S], fill=BRASS, width=int(4 * S * r / 200))
    hr = 7 * r / 200
    d.ellipse([(x1 - hr) * S, (y1 - hr) * S, (x1 + hr) * S, (y1 + hr) * S], fill=BRASS)
    if center:
        big, small = center
        d.text((cx * S, (cy - r * 0.06) * S), big, font=serif(int(r * 0.42)), fill=INK, anchor='ms')
        d.text((cx * S, (cy + r * 0.16) * S), small, font=sans(int(r * 0.085), 600), fill=INK2, anchor='ms')


def text(d, xy, s, f, fill, spacing=0, anchor='la'):
    if spacing:
        x, y = xy
        for ch in s:
            d.text((x * S, y * S), ch, font=f, fill=fill, anchor=anchor)
            x += f.getlength(ch) / S + spacing
        return
    d.text((xy[0] * S, xy[1] * S), s, font=f, fill=fill, anchor=anchor)


def wrap(s, f, width):
    words, lines, cur = s.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if f.getlength(t) / S <= width or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    return lines


def balance(s, f, width):
    """wrap to the fewest lines, then make them as even as that allows (no one-word last line)"""
    n = len(wrap(s, f, width))
    lo, hi = width * 0.5, width
    while hi - lo > 4:
        mid = (lo + hi) / 2
        if len(wrap(s, f, mid)) <= n:
            hi = mid
        else:
            lo = mid
    return wrap(s, f, hi)


def finish(im, path):
    im = im.resize((W, H), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'PNG', optimize=True)
    print('wrote', os.path.relpath(path, NEWS), os.path.getsize(path) // 1024, 'KB')


# ------------------------------------------------------------------ the site's card
def site_card(lang='en'):
    L = LOC[lang]
    im = canvas()
    glow(im, 930, 330, 300, (214, 178, 94), 34)
    glow(im, 160, 640, 380, (26, 58, 85), 120)
    dial(im, 930, 318, 205, now_h=21.2, center=('6', L['dial']))
    d = ImageDraw.Draw(im)
    k = sans(19, 650)
    sp = 1.6 if k.getlength(L['kicker']) / S + 1.6 * len(L['kicker']) < 700 else 0.6
    text(d, (72, 78), L['kicker'], k, BRASS2, spacing=sp)
    text(d, (66, 112), 'The Watch', serif(132), INK)
    y = 268
    for line in L['tag']:
        text(d, (72, y), line, serif_i(46), INK); y += 52
    y += 22
    f = sans(23, 560)
    for i, t in enumerate(L['feats']):
        col, row = i % 2, i // 2
        x, yy = 72 + col * 282, y + row * 44
        d.ellipse([(x) * S, (yy + 9) * S, (x + 10) * S, (yy + 19) * S], fill=BRASS)
        text(d, (x + 22, yy), t, f, INK2)
    text(d, (72, 566), L['foot'], sans(19, 520), INK3)
    finish(im, os.path.join(NEWS, 'share.png' if lang == 'en' else f'share-{lang}.png'))


def landing_page(lang):
    """news/pt.html, news/de.html: the site's link preview in that language; people go straight on to the page in it"""
    L = LOC[lang]
    e = lambda s: html.escape(s, quote=True)  # noqa: E731
    url, img = f'{PUBLIC}{lang}.html', f'{PUBLIC}share-{lang}.png'
    page = f"""<!doctype html>
<html lang="{e(L['locale'].replace('_', '-'))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(L['title'])}</title>
<meta name="description" content="{e(L['desc'])}">
<link rel="canonical" href="{e(url)}">
<link rel="alternate" hreflang="en" href="{e(PUBLIC)}">
<link rel="alternate" hreflang="pt-BR" href="{e(PUBLIC)}pt.html">
<link rel="alternate" hreflang="de" href="{e(PUBLIC)}de.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="The Watch">
<meta property="og:title" content="{e(L['title'])}">
<meta property="og:description" content="{e(L['desc'])}">
<meta property="og:url" content="{e(url)}">
<meta property="og:image" content="{e(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{e(L['alt'])}">
<meta property="og:locale" content="{e(L['locale'])}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(L['title'])}">
<meta name="twitter:description" content="{e(L['desc'])}">
<meta name="twitter:image" content="{e(img)}">
<meta name="twitter:image:alt" content="{e(L['alt'])}">
<meta name="theme-color" content="#0E1A2B">
<link rel="apple-touch-icon" href="icon-180.png">
<style>body{{margin:0;background:#0E1A2B;color:#E7EDF4;font:17px/1.5 Georgia,serif;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}}
main{{max-width:640px}}h1{{font-weight:400;font-size:44px;margin:0 0 10px}}a{{color:#E3C47E}}</style>
<script>if (!/bot|crawl|spider|facebookexternalhit|facebot|twitterbot|slack|discord|whatsapp|telegram|linkedin|embedly|pinterest|skype|vkshare|iframely|preview/i.test(navigator.userAgent)) location.replace('./?lang={lang}' + location.hash);</script>
</head>
<body><main><h1>The Watch</h1><p>{e(L['desc'])}</p><p><a href="./?lang={lang}">{e(L['open'])}</a></p></main></body>
</html>
"""
    with open(os.path.join(NEWS, f'{lang}.html'), 'w', encoding='utf-8') as fh:
        fh.write(page)
    print('wrote', f'{lang}.html')


# ------------------------------------------------------------------ a report's card and page
def desk_name(k, lang='en'):
    n = {'us': 'U.S.', 'world': 'World', 'europe': 'Europe', 'brazil': 'Brazil', 'politics': 'Politics', 'business': 'Business',
            'household': 'Household', 'home': 'Home', 'tech': 'Tech', 'science': 'Science', 'health': 'Health', 'sports': 'Sports',
            'culture': 'Culture', 'cars': 'Cars', 'travel': 'Travel', 'food': 'Food', 'lifestyle': 'Lifestyle', 'longreads': 'Long reads', 'files': 'The Epstein files'}.get(k, k.title())
    return DICT[lang].get(n, n) if lang != 'en' else n


def _dict(lang):
    try:
        return json.load(open(os.path.join(NEWS, 'i18n', lang + '.json'), encoding='utf-8')).get('t') or {}
    except (OSError, ValueError):
        return {}


DICT = {k: _dict(k) for k in ('pt', 'de')}


def when(a, lang='en'):
    w = dt.datetime.fromisoformat(a['written']).astimezone(ET)
    if lang == 'pt':
        return f"{w.day} de {MONTHS['pt'][w.month - 1]} de {w.year}", w.strftime('%-Hh%M')
    if lang == 'de':
        return f"{w.day}. {MONTHS['de'][w.month - 1]} {w.year}", w.strftime('%-H:%M')
    return w.strftime('%B %-d, %Y'), w.strftime('%-I:%M %p').replace('AM', 'a.m.').replace('PM', 'p.m.')


def localized(a, lang):
    """the report as it reads in one language: title and dek from its translation"""
    if lang == 'en':
        return a
    t = (a.get('i18n') or {}).get(lang) or {}
    return dict(a, title=t.get('title') or a['title'], dek=t.get('dek') or a['dek'])


def report_card(a, path, lang='en'):
    L = LOC[lang]
    im = canvas()
    glow(im, 1130, 60, 260, (214, 178, 94), 26)
    d = ImageDraw.Draw(im)
    text(d, (72, 70), f"{L['report']}  ·  {desk_name(a['desk'], lang).upper()}", sans(19, 650), BRASS2, spacing=1.6)
    for size in (82, 74, 66, 60, 54, 48):
        lines = balance(a['title'], serif(size), 1050)
        if len(lines) <= 4:
            break
    lines = lines[:4]
    y = 108
    for line in lines:
        text(d, (70, y), line, serif(size), INK); y += size * 1.04
    dek = balance(a.get('dek', ''), sans(25, 450), 1040)
    room = int((500 - y - 26) // 36)
    if room > 0 and dek:
        y += 26
        show = dek[:room]
        if len(dek) > room:
            show[-1] = show[-1].rstrip('.,;:') + '…'
        for line in show:
            text(d, (72, y), line, sans(25, 450), INK2); y += 36
    d.line([72 * S, 528 * S, 1128 * S, 528 * S], fill='#24324A', width=2 * S)
    dial(im, 104, 578, 26, now_h=dt.datetime.fromisoformat(a['written']).astimezone(ET).hour + 0.5, labels=False)
    text(d, (146, 552), 'The Watch', serif(40), INK)
    day, _t = when(a, lang)
    by = f"{L['by']}  ·  {a['model']}  ·  {day}"
    text(d, (1128, 566), by, sans(21, 560), INK2, anchor='ra')
    finish(im, path)


def share_page(a, path, lang='en'):
    L = LOC[lang]
    day, t = when(a, lang)
    sfx = '' if lang == 'en' else '.' + lang
    url = f"{PUBLIC}r/{a['id']}{sfx}.html"
    app = f"../#/a/{a['id']}" if lang == 'en' else f"../?lang={lang}#/a/{a['id']}"
    title = a['title']
    desc = L['rdesc'].format(dek=a['dek'], model=a['model'], day=day)
    e = lambda s: html.escape(s, quote=True)  # noqa: E731
    page = f"""<!doctype html>
<html lang="{L['locale'].replace('_', '-')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} · The Watch</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{e(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="The Watch">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(url)}">
<meta property="og:image" content="{e(PUBLIC)}r/{e(a['id'])}{sfx}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{e(L['ralt'].format(title=title))}">
<meta property="og:locale" content="{L['locale']}">
<meta property="article:published_time" content="{e(a['written'])}">
<meta property="article:author" content="Claude ({e(a['model'])})">
<meta property="article:section" content="{e(desk_name(a['desk'], lang))}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(title)}">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{e(PUBLIC)}r/{e(a['id'])}{sfx}.png">
<meta name="theme-color" content="#0E1A2B">
<link rel="apple-touch-icon" href="../icon-180.png">
<style>body{{margin:0;background:#0E1A2B;color:#E7EDF4;font:17px/1.5 Georgia,serif;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}}
main{{max-width:640px}}p.k{{font:600 12px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#E3C47E}}h1{{font-weight:400;font-size:34px;line-height:1.1;margin:8px 0 12px}}a{{color:#E3C47E}}</style>
<script>if (!/bot|crawl|spider|facebookexternalhit|facebot|twitterbot|slack|discord|whatsapp|telegram|linkedin|embedly|pinterest|skype|vkshare|iframely|preview/i.test(navigator.userAgent)) location.replace({json.dumps(app)});</script>
</head>
<body><main><p class="k">{e(L['report'].title() if lang == 'en' else L['report'].capitalize())} · {e(desk_name(a['desk'], lang))}</p><h1>{e(title)}</h1><p>{e(a['dek'])}</p>
<p>{e(L['at'].format(model=a['model'], day=day, t=t))}</p><p><a href="{e(app)}">{e(L['read'])}</a></p></main></body>
</html>
"""
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(page)


def reports(redo):
    try:
        idx = json.load(open(os.path.join(NEWS, 'articles', 'index.json'), encoding='utf-8'))
    except (OSError, ValueError):
        return 0
    out = os.path.join(NEWS, 'r')
    os.makedirs(out, exist_ok=True)
    n = 0
    for row in idx.get('articles') or []:
        try:
            a = json.load(open(os.path.join(NEWS, 'articles', row['id'] + '.json'), encoding='utf-8'))
        except (OSError, ValueError):
            continue
        langs = ['en'] + [k for k in ('pt', 'de') if ((a.get('i18n') or {}).get(k) or {}).get('title')]
        sig = hashlib.sha1(json.dumps([[localized(a, k)['title'] for k in langs], [localized(a, k)['dek'] for k in langs], a['desk'], a['model'],
                                       a['written'], 3], ensure_ascii=False).encode()).hexdigest()[:10]
        page = os.path.join(out, a['id'] + '.html')
        stamp = os.path.join(out, '.' + a['id'] + '.sig')
        if not redo and os.path.exists(page) and os.path.exists(stamp) and open(stamp).read().strip() == sig:
            continue
        for k in langs:
            sfx = '' if k == 'en' else '.' + k
            report_card(localized(a, k), os.path.join(out, a['id'] + sfx + '.png'), k)
            share_page(localized(a, k), os.path.join(out, a['id'] + sfx + '.html'), k)
        open(stamp, 'w').write(sig + '\n')
        n += 1
    print(f'share: {n} report card{"s" if n != 1 else ""} drawn')
    return n


def main():
    if '--site' in sys.argv:
        for lang in LOC:
            site_card(lang)
            if lang != 'en':
                landing_page(lang)
    reports('--all' in sys.argv)
    return 0


if __name__ == '__main__':
    sys.exit(main())
