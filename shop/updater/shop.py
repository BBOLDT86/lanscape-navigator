#!/usr/bin/env python3
"""Finds (shop/): fills the boards with real products, live prices and pictures.

  python3 shop/updater/shop.py          rebuild shop/data/feed.json
  python3 shop/updater/shop.py check    check shop/picks/*.json against the format (exit 1 on problems)

Three sources, all read from GitHub's servers, never scraped from a page:
  1. The stores in shop/sources.json. Each runs on Shopify and publishes its catalog as JSON
     (/collections/<handle>/products.json); the updater reads the collection named there (its best sellers, usually),
     or with "auto" picks the store's best-seller collection itself. Name, picture, price, sale price, stock.
  2. The picks in shop/picks/<section>.json, Claude's researched choices with a reason and sources. When a pick's
     store is on Shopify its price, picture and stock are refreshed from <product url>.json.
  3. eBay, through eBay's Browse API, only when the repository secrets EBAY_CLIENT_ID and EBAY_CLIENT_SECRET are set
     (a free developer account at developer.ebay.com): new and used listings for each pick, and a Pre-owned row per
     section from the searches in sources.json. Without the keys, the page links to eBay searches instead.
Plus the week's trend reporting (Google News, from established outlets only) for the Trending board.
A store or source that fails keeps its last good products. Standard library only.
"""
import base64
import concurrent.futures as cf
import datetime as dt
import glob
import hashlib
import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SHOP = os.path.normpath(os.path.join(HERE, '..'))
ROOT = os.path.normpath(os.path.join(SHOP, '..'))
OUT = os.path.join(SHOP, 'data', 'feed.json')
UA = 'FindsBot/1.0 (+https://bboldt86.github.io/lanscape-navigator/shop/; the-watch-news@users.noreply.github.com)'
NOW = dt.datetime.now(dt.timezone.utc)
SECTIONS = ['trending', 'fashion', 'coffee', 'kitchen', 'home', 'remodel', 'gifts', 'tech', 'garage', 'outdoors', 'wellness', 'equestrian']
JUNK = re.compile(r'gift ?card|e-?gift|\bsample\b|warranty|shipping protection|package protection|\broute\b|insurance|donation|'
                  r'replacement (part|filter|pad|seal)|\bspare\b|\bdeposit\b|subscription|membership|\bbundle builder\b|\bmystery\b|\bfree gift\b', re.I)
BEST = [r'^(best-?sellers?|bestsellers?|best-?selling(-products)?|best-?sellers-?\d?)$', r'best-?sell|bestseller', r'most-(loved|popular)|popular|top-?rated|favou?rites',
        r'^new(-arrivals)?$|new-arrivals|whats-new|new-releases']
HIDDEN = re.compile(r'test|hidden|internal|\[|order-tracking|trigger|offer|cross-sell|configurator|feature|upsell|rebuy|quiz|klaviyo|algolia', re.I)
errors = []


def get(url, timeout=20, data=None, headers=None):
    h = {'User-Agent': UA, 'Accept': 'application/json, */*;q=0.5'}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def jget(url, **kw):
    return json.loads(get(url, **kw))


def band(p):
    if p is None:
        return None
    return 'under-25' if p < 25 else 'under-50' if p < 50 else 'under-100' if p < 100 else 'under-250' if p < 250 else 'splurge'


def sized(src, w=640):
    if not src:
        return None
    src = src if src.startswith('http') else 'https:' + src
    return src + ('&' if '?' in src else '?') + f'width={w}'


def plain(s, n=260):
    s = html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))
    s = re.sub(r'\s+', ' ', s).strip()
    if len(s) > n:
        s = s[:n].rsplit(' ', 1)[0].rstrip(',;:') + '…'
    return s


def pid(*parts):
    return hashlib.sha1('|'.join(parts).encode()).hexdigest()[:10]


def from_shopify(p, dom, store):
    """One Shopify product -> one card, or None if it isn't something to show."""
    title = (p.get('title') or '').strip()
    imgs = [i for i in (p.get('images') or []) if i.get('src')]
    vs = p.get('variants') or []
    if not title or not imgs or not vs or JUNK.search(title) or JUNK.search(p.get('product_type') or ''):
        return None
    live = [v for v in vs if v.get('available', True)]
    pick = min(live or vs, key=lambda v: float(v.get('price') or 0))
    try:
        price = float(pick.get('price') or 0)
    except ValueError:
        return None
    if price < 3:
        return None
    was = None
    try:
        c = float(pick.get('compare_at_price') or 0)
        if c > price * 1.03:
            was = c
    except ValueError:
        pass
    created = p.get('published_at') or p.get('created_at') or ''
    try:
        new = (NOW - dt.datetime.fromisoformat(created.replace('Z', '+00:00'))).days <= 45
    except ValueError:
        new = False
    i0 = imgs[0]
    tags = [t for t in re.split(r'[\s/&,]+', (p.get('product_type') or '').lower()) if 2 < len(t) < 20][:3]
    vendor = (p.get('vendor') or '').strip()
    if not vendor or re.search(r'unknown|^default|^shopify$', vendor, re.I) or vendor.lower().replace(' ', '') in dom.replace('.com', ''):
        vendor = store
    return {'i': pid(dom, p.get('handle', '')), 'n': title, 'br': vendor, 'st': store, 'dom': dom,
            'u': f"https://{dom}/products/{p.get('handle')}", 'im': sized(i0['src']), 'w': i0.get('width'), 'h': i0.get('height'),
            'ims': [sized(i['src'], 1000) for i in imgs[:4]], 'p': round(price, 2), 'was': was, 'av': bool(live), 'new': new,
            'tg': tags, 'd': plain(p.get('body_html')), 'k': 'store'}


def pick_collection(dom):
    cols = jget(f'https://{dom}/collections.json?limit=250').get('collections') or []
    cols = [c for c in cols if (c.get('products_count') or 0) >= 4 and not HIDDEN.search((c.get('handle') or '') + ' ' + (c.get('title') or ''))]
    for rx in BEST:
        hits = [c for c in cols if re.search(rx, c.get('handle') or '', re.I) or re.search(rx, (c.get('title') or '').lower().replace(' ', '-'), re.I)]
        if hits:
            hits.sort(key=lambda c: (len(c['handle']), -(c.get('products_count') or 0)))
            return hits[0]['handle']
    return None


def store_items(s):
    dom, n = s['d'], s.get('n', 6)
    handle = s.get('c') or 'auto'
    if handle == 'auto':
        handle = pick_collection(dom)
    url = f'https://{dom}/collections/{handle}/products.json?limit=50' if handle else f'https://{dom}/products.json?limit=50'
    try:
        prods = jget(url).get('products') or []
    except urllib.error.HTTPError as e:
        if e.code != 404 or not handle:
            raise
        prods = jget(f'https://{dom}/products.json?limit=50').get('products') or []; handle = None
    skip = re.compile(s['skip'], re.I) if s.get('skip') else None
    out, names = [], set()
    for p in prods:
        it = from_shopify(p, dom, s.get('name') or dom)
        if not it or (skip and skip.search(it['n'])):
            continue
        key = re.sub(r'\W+', ' ', it['n'].lower()).strip()[:40]  # one card per product family, not one per colorway
        if key in names:
            continue
        names.add(key)
        it['coll'] = handle
        out.append(it)
        if len(out) >= n:
            break
    return {'dom': dom, 'handle': handle, 'items': out}


def refresh_pick(it):
    """A pick on a Shopify store: live price, picture and stock from <url>.json. Anything else keeps what research saw."""
    u = it.get('url') or ''
    m = re.match(r'^https://([^/]+)/(?:[a-z]{2}(?:-[a-z]{2})?/)?(?:collections/[^/]+/)?products/([^/?#]+)', u)
    if not m:
        return None
    try:
        p = jget(f'https://{m.group(1)}/products/{m.group(2)}.json', timeout=15).get('product')
    except Exception:  # noqa: BLE001  not Shopify, or blocked: keep the researched values
        return None
    return from_shopify(p, m.group(1), it.get('store') or m.group(1)) if p else None


# ---------- eBay Browse API (needs EBAY_CLIENT_ID / EBAY_CLIENT_SECRET)
def ebay_token():
    cid, sec = os.environ.get('EBAY_CLIENT_ID'), os.environ.get('EBAY_CLIENT_SECRET')
    if not cid or not sec:
        return None
    auth = base64.b64encode(f'{cid}:{sec}'.encode()).decode()
    d = jget('https://api.ebay.com/identity/v1/oauth2/token', data=urllib.parse.urlencode({'grant_type': 'client_credentials', 'scope': 'https://api.ebay.com/oauth/api_scope'}).encode(),
             headers={'Authorization': 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded'})
    return d.get('access_token')


def ebay(tok, q, cond, n=3):
    flt = 'conditions:{NEW}' if cond == 'new' else 'conditions:{USED}'
    d = jget('https://api.ebay.com/buy/browse/v1/item_summary/search?' + urllib.parse.urlencode({'q': q, 'limit': n, 'filter': flt + ',deliveryCountry:US'}),
             headers={'Authorization': 'Bearer ' + tok, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'})
    out = []
    for x in d.get('itemSummaries') or []:
        pr = (x.get('price') or x.get('currentBidPrice') or {})
        img = (x.get('image') or {}).get('imageUrl') or ((x.get('thumbnailImages') or [{}])[0]).get('imageUrl')
        if not img or not pr.get('value'):
            continue
        out.append({'t': x.get('title'), 'p': float(pr['value']), 'c': pr.get('currency', 'USD'), 'im': img, 'u': x.get('itemWebUrl'),
                    'cond': x.get('condition'), 'auc': 'AUCTION' in (x.get('buyingOptions') or []), 'end': x.get('itemEndDate'),
                    'sel': (x.get('seller') or {}).get('feedbackPercentage')})
    return out


# ---------- trend reporting
TREND_Q = ['"TikTok" viral product', '"TikTok Shop" best sellers', '"trending on TikTok"', '"viral on Instagram" product', 'TikTok trend home decor', 'TikTok viral kitchen gadget', 'TikTok beauty trend']
SHOP_PRESS = {'nbcnews.com', 'today.com', 'people.com', 'buzzfeed.com', 'refinery29.com', 'allure.com', 'vogue.com', 'glamour.com', 'elle.com', 'harpersbazaar.com',
              'goodhousekeeping.com', 'bonappetit.com', 'foodandwine.com', 'seriouseats.com', 'apartmenttherapy.com', 'architecturaldigest.com', 'housebeautiful.com',
              'thekitchn.com', 'businessinsider.com', 'theverge.com', 'wired.com', 'cnet.com', 'mashable.com', 'usatoday.com', 'forbes.com', 'fastcompany.com',
              'modernretail.co', 'glossy.co', 'retaildive.com', 'adweek.com', 'cosmopolitan.com', 'instyle.com', 'whowhatwear.com', 'byrdie.com', 'thecut.com',
              'nymag.com', 'cnn.com', 'nytimes.com', 'washingtonpost.com', 'wsj.com', 'bloomberg.com', 'theguardian.com', 'bbc.com', 'axios.com', 'cnbc.com',
              'nypost.com', 'tomsguide.com', 'engadget.com', 'gq.com', 'esquire.com', 'menshealth.com', 'womenshealthmag.com', 'realsimple.com', 'marthastewart.com',
              'self.com', 'shape.com', 'parade.com', 'yahoo.com', 'independent.co.uk', 'businessoffashion.com', 'wwd.com', 'fashionista.com', 'hypebeast.com'}


def trends():
    sys.path.insert(0, os.path.join(ROOT, 'news', 'updater'))
    import run  # noqa: E402  The Watch's feed reader
    out, seen = [], set()
    for q in TREND_Q:
        url = 'https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=' + urllib.parse.quote(q + ' when:14d')
        name, items, err = run.read_feed({'name': q, 'url': url})
        if err:
            errors.append(f'trends {q}: {err}'); continue
        for it in items:
            dom = run.norm_domain(it.get('src_url') or '') if it.get('google') else run.norm_domain(it['link'])
            if not dom or (dom not in SHOP_PRESS and dom not in run.OUTLETS):
                continue
            t = it['title']
            if it.get('src_name') and t.endswith(' - ' + it['src_name']):
                t = t[: -len(it['src_name']) - 3].strip()
            if not re.search(r'tiktok|instagram|viral|trend', t, re.I):
                continue
            key = re.sub(r'\W+', ' ', t.lower())[:60]
            if key in seen or not it.get('when') or (NOW - it['when']).days > 14:
                continue
            seen.add(key)
            out.append({'t': t, 'u': it['link'], 'o': run.OUTLETS.get(dom) or it.get('src_name') or dom, 'p': it['when'].strftime('%Y-%m-%dT%H:%M:%SZ')})
    out.sort(key=lambda x: x['p'], reverse=True)
    return out[:24]


# ---------- picks
REQ = ('id', 'name', 'brand', 'why', 'url', 'store')


def load_picks():
    picks, meta = [], {}
    for f in sorted(glob.glob(os.path.join(SHOP, 'picks', '*.json'))):
        d = json.load(open(f))
        sec = d.get('section')
        if sec not in SECTIONS:
            errors.append(f'{os.path.basename(f)}: unknown section {sec}'); continue
        meta[sec] = {'boards': d.get('boards') or [], 'updated': d.get('updated')}
        for it in d.get('items') or []:
            if any(not it.get(k) for k in REQ):
                errors.append(f'{os.path.basename(f)} {it.get("id")}: missing fields'); continue
            it['_sec'] = sec
            picks.append(it)
    return picks, meta


def check():
    bad = 0
    for f in sorted(glob.glob(os.path.join(SHOP, 'picks', '*.json'))):
        try:
            d = json.load(open(f))
        except ValueError as e:
            print(f'{f}: not JSON ({e})'); bad += 1; continue
        boards = {b['id'] for b in d.get('boards') or []}
        ids = set()
        for it in d.get('items') or []:
            miss = [k for k in REQ if not it.get(k)]
            prob = []
            if miss: prob.append('missing ' + ','.join(miss))
            if it.get('board') and it['board'] not in boards: prob.append('unknown board ' + it['board'])
            if it.get('id') in ids: prob.append('duplicate id')
            ids.add(it.get('id'))
            if not str(it.get('url', '')).startswith('https://'): prob.append('url must be https')
            if re.search(r'[?&](utm_|tag=|ref=|aff|irclickid|clickid)', it.get('url', '')): prob.append('tracking parameters in url')
            if d.get('section') == 'trending' and not (it.get('trend') or {}).get('src'): prob.append('trending item without a dated trend source')
            if prob:
                bad += 1; print(f"{os.path.basename(f)} {it.get('id')}: {'; '.join(prob)}")
        print(f"{os.path.basename(f)}: {len(d.get('items') or [])} items")
    sys.exit(1 if bad else 0)


def main():
    try:
        old = json.load(open(OUT))
    except (OSError, ValueError):
        old = {}
    src = json.load(open(os.path.join(SHOP, 'sources.json')))
    old_by_store = {}
    for it in old.get('items') or []:
        if it.get('k') == 'store':
            old_by_store.setdefault(f"{it.get('s')}|{it.get('dom')}|{it.get('coll')}", []).append(it)
    items, stores = [], {}
    jobs = [(sec['id'], s) for sec in src['sections'] for s in sec.get('stores') or []]
    with cf.ThreadPoolExecutor(8) as ex:
        futs = {ex.submit(store_items, s): (sid, s) for sid, s in jobs}
        for f in cf.as_completed(futs):
            sid, s = futs[f]
            key = f"{sid}|{s['d']}"
            try:
                r = f.result()
                for it in r['items']:
                    it['s'] = sid
                items += r['items']
                stores[key] = {'name': s.get('name'), 'n': len(r['items']), 'handle': r['handle'], 'ok': True}
            except Exception as e:  # noqa: BLE001  keep the store's last good products
                kept = [it for k, v in old_by_store.items() if k.startswith(f"{sid}|{s['d']}|") for it in v]
                items += kept
                stores[key] = {'name': s.get('name'), 'n': len(kept), 'ok': False, 'err': f'{type(e).__name__} {str(e)[:80]}'}
                errors.append(f"{s['d']} ({sid}): {type(e).__name__} {str(e)[:80]}")
    # the picks, refreshed where their store publishes JSON
    picks, meta = load_picks()
    with cf.ThreadPoolExecutor(8) as ex:
        live = list(ex.map(refresh_pick, picks))
    seen_urls = {}
    for it, lv in zip(picks, live):
        card = {'i': 'p-' + pid(it['_sec'], it['id']), 's': it['_sec'], 'b': it.get('board'), 'n': it['name'], 'br': it['brand'], 'st': it['store'], 'u': it['url'],
                'im': it.get('image'), 'p': it.get('price'), 'was': None, 'c': it.get('currency') or 'USD', 'av': True, 'tg': it.get('tags') or [],
                'y': it['why'], 'src': it.get('sources') or [], 'tr': it.get('trend'), 'q': it.get('ebay'), 'k': 'pick', 'seen': it.get('priceSeen'), 'live': False}
        if lv:
            card.update({k: lv[k] for k in ('im', 'w', 'h', 'ims', 'p', 'was', 'av', 'd')}); card['live'] = True; card['dom'] = lv['dom']
            if not card['n'] or len(card['n']) < 4:
                card['n'] = lv['n']
        if card['p'] is not None and not any(t.startswith('under-') or t == 'splurge' for t in card['tg']):
            card['tg'].append(band(card['p']))
        items.append(card)
        seen_urls[it['url'].split('?')[0]] = card['i']
    # a store product that is also a pick shows once, as the pick
    items = [it for it in items if not (it.get('k') == 'store' and it['u'] in seen_urls)]
    for it in items:
        if it.get('k') == 'store' and it.get('p') is not None:
            b = band(it['p'])
            if b and b not in it['tg']:
                it['tg'].append(b)
    # eBay
    has_ebay = False
    try:
        tok = ebay_token()
    except Exception as e:  # noqa: BLE001
        tok = None; errors.append(f'eBay token: {type(e).__name__} {str(e)[:80]}')
    if tok:
        has_ebay = True
        qs = [(c, c['q']) for c in items if c.get('k') == 'pick' and c.get('q')]
        def both(q):
            try:
                return {'new': ebay(tok, q, 'new'), 'used': ebay(tok, q, 'used')}
            except Exception as e:  # noqa: BLE001
                errors.append(f'eBay {q}: {type(e).__name__}'); return None
        with cf.ThreadPoolExecutor(4) as ex:
            for (c, q), r in zip(qs, ex.map(both, [q for _, q in qs])):
                if r:
                    c['eb'] = r
        for sec in src['sections']:
            for q in sec.get('ebay') or []:
                try:
                    for x in ebay(tok, q, 'used', 4):
                        items.append({'i': 'e-' + pid(x['u'] or x['t']), 's': sec['id'], 'n': x['t'], 'br': 'eBay', 'st': 'eBay', 'u': x['u'], 'im': x['im'], 'p': x['p'], 'c': x['c'],
                                      'av': True, 'tg': [band(x['p']), 'pre-owned'], 'k': 'ebay', 'cond': x['cond'], 'auc': x['auc'], 'end': x['end'], 'sel': x['sel'], 'q': q})
                except Exception as e:  # noqa: BLE001
                    errors.append(f'eBay {q}: {type(e).__name__}')
    else:
        items += [it for it in old.get('items') or [] if it.get('k') == 'ebay' and (NOW - dt.datetime.fromisoformat(old.get('at', NOW.isoformat()).replace('Z', '+00:00'))).days < 2]
    try:
        tr = trends()
    except Exception as e:  # noqa: BLE001
        tr = old.get('trends') or []; errors.append(f'trends: {type(e).__name__} {str(e)[:80]}')
    secs = []
    for sec in src['sections']:
        n = sum(1 for it in items if it['s'] == sec['id'])
        secs.append({'id': sec['id'], 'title': sec['title'], 'dek': sec['dek'], 'n': n, 'boards': (meta.get(sec['id']) or {}).get('boards') or [],
                     'stores': sorted({s.get('name') for s in sec.get('stores') or []}), 'ebay': sec.get('ebay') or []})
    out = {'v': 1, 'at': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'ebay': has_ebay, 'sections': secs, 'items': items, 'trends': tr,
           'stores': stores, 'errors': errors[:40]}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(out, f, separators=(',', ':'), ensure_ascii=False)
    print(f"feed.json: {len(items)} items ({sum(1 for i in items if i.get('k') == 'pick')} picks, {sum(1 for i in items if i.get('k') == 'ebay')} eBay), "
          f"{sum(1 for s in stores.values() if s['ok'])}/{len(stores)} stores, {len(tr)} trend stories, eBay {'on' if has_ebay else 'off'}")
    for e in errors[:20]:
        print('  ', e)


if __name__ == '__main__':
    if sys.argv[1:] == ['check']:
        check()
    main()
