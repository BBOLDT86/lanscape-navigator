#!/usr/bin/env python3
"""Checks that lang.js (in a real browser) and translate.py cut every page into the same segments, and collects the
text the pages' scripts draw. Local tool: needs playwright and Chrome. Not run on Actions.

  python3 news/i18n/tools/selftest.py static            # every page: browser segments == translate.py segments
  python3 news/i18n/tools/selftest.py ui [page ...]     # open pages with ?lang=xx, list what the dictionaries lack -> src/ui.json candidates
  python3 news/i18n/tools/selftest.py shot page out.png [lang]   # a screenshot of a page in a language
"""
import functools, http.server, json, os, re, sys, threading
HERE = os.path.dirname(os.path.abspath(__file__)); I18N = os.path.dirname(HERE); ROOT = os.path.normpath(os.path.join(I18N, '..', '..'))
sys.path.insert(0, I18N)
import translate as T

class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = path.split('?')[0].split('#')[0]
        if path.startswith('/lanscape-navigator/'): path = path[len('/lanscape-navigator'):]
        return os.path.join(ROOT, *[p for p in path.split('/') if p and p != '..'])
    def log_message(self, *a): pass
def serve():
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f'http://127.0.0.1:{srv.server_address[1]}/lanscape-navigator/'
def browser(p):
    try: return p.chromium.launch(channel='chrome', args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'])
    except Exception: return p.chromium.launch(args=['--no-sandbox'])

def static():
    from playwright.sync_api import sync_playwright
    base = serve(); bad = 0; n = 0
    with sync_playwright() as p:
        b = browser(p); pg = b.new_page(); pg.goto(base + 'news/i18n/tools/blank.html'); pg.add_script_tag(url=base + 'news/i18n/lang.js')
        for r in T.list_pages():
            html = open(os.path.join(ROOT, r), encoding='utf-8').read()
            js = pg.evaluate("h => window.__watchLang.segments(new DOMParser().parseFromString(h, 'text/html'))", html)
            py = T.page_segments(html); n += 1
            keys_ok = all(pg.evaluate('s => window.__watchLang.key(s)', s) == T.key(s) for s in py[:3] + py[-2:])
            if js != py or not keys_ok:
                bad += 1; a, c = set(js), set(py)
                print(f'DIFF {r}: browser {len(js)}, python {len(py)}, keys {"ok" if keys_ok else "DIFFER"}')
                for s in list(a - c)[:3]: print('   browser only:', repr(s[:160]))
                for s in list(c - a)[:3]: print('   python only: ', repr(s[:160]))
        b.close()
    print(f'{n} pages, {bad} differ'); sys.exit(1 if bad else 0)

MANUAL = ['Reader feedback', 'Was this worth your time?', '<1/>Yes', '<1/>Not really', 'Optional', 'Send note', 'Know someone who\u2019d read this?', '<1/>Send it to them',
          'Notes go to the editor and may be quoted on The Watch. Please leave out names and contact details.', 'What made it worth it? What should The Watch do next?',
          'What would have made it worth it?', 'Thank you. The editor reads every note.', 'Link copied. Paste it to a friend.']   # the reader card (pulse.js skips headless browsers)
NAME_ROW = re.compile(r"^[A-Z][\w .'\u2019-]{1,40}<1>, [A-Z]{2}</1>$")   # "Harris<1>, TX</1>": a county in a table, nothing to translate
def ui(pages=None, lang='xx', wait=3200, at_once=6):
    """Open every page with ?lang=xx and write src/ui.json: the text the pages' scripts draw that the dictionaries lack.
    Run it after `translate.py run --mock` (or with real dictionaries in place), so that only script-drawn text is missing."""
    from playwright.sync_api import sync_playwright
    pages = pages or T.list_pages(); base = serve(); per = {}
    with sync_playwright() as p:
        b = browser(p)
        for i in range(0, len(pages), at_once):
            part = pages[i:i + at_once]; tabs = []
            for r in part:
                pg = b.new_page(viewport={'width': 1280, 'height': 900})
                try: pg.goto(base + r + '?lang=' + lang, wait_until='commit', timeout=20000)
                except Exception as e: print(r, 'ERR', str(e)[:80])
                tabs.append(pg)
            tabs[0].wait_for_timeout(wait)
            for pg in tabs:
                try: pg.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                except Exception: pass
            tabs[0].wait_for_timeout(wait * 0.6)
            for r, pg in zip(part, tabs):
                try: miss = pg.evaluate('() => window.__watchLang ? window.__watchLang.missing() : []')
                except Exception as e: print(r, 'ERR', str(e)[:80]); miss = []
                per[r] = [T.mask(s) for s in miss if T.needs_translation(s) and not NAME_ROW.match(s) and len(s) < 1500 and not re.search(r'NaN|Infinity|undefined', s)]
                pg.close()
            print(f'{min(i + at_once, len(pages))}/{len(pages)}', flush=True)
        b.close()
    count = {}
    for r, L in per.items():
        for s in set(L): count[s] = count.get(s, 0) + 1
    shared = sorted(s for s, n in count.items() if n >= 3)
    old = T.load(T.UI_SRC, {}) or {}
    out = {'manual': MANUAL, 'shared': shared, 'pages': dict(old.get('pages') or {}) if len(pages) < len(T.list_pages()) else {}}
    if len(pages) < len(T.list_pages()): out['shared'] = sorted(set(shared) | set(old.get('shared') or []))
    sh = set(out['shared'])
    for r, L in per.items():
        own = sorted(set(s for s in L if s not in sh))
        if own: out['pages'][r] = own
        else: out['pages'].pop(r, None)
    os.makedirs(os.path.dirname(T.UI_SRC), exist_ok=True)
    with open(T.UI_SRC, 'w', encoding='utf-8') as f: json.dump(out, f, ensure_ascii=False, indent=0, sort_keys=True); f.write('\n')
    print(f"ui.json: {len(out['shared'])} shared, {sum(len(v) for v in out['pages'].values())} on {len(out['pages'])} pages")
    return out

def shot(r, png, lang='pt', wait=5000, full=False, w=390, h=844):
    from playwright.sync_api import sync_playwright
    base = serve()
    with sync_playwright() as p:
        b = browser(p); pg = b.new_page(viewport={'width': w, 'height': h}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        pg.goto(base + r + ('&' if '?' in r else '?') + 'lang=' + lang, wait_until='load'); pg.wait_for_timeout(wait)
        info = pg.evaluate("() => ({lang: document.documentElement.lang, title: document.title, n: document.body.innerText.split('‹pt›').length - 1, missing: window.__watchLang ? window.__watchLang.missing().length : -1, pick: !!document.querySelector('.wl-pick')})")
        pg.screenshot(path=png, full_page=full); b.close()
    print(r, info, errs[:3]); return info, errs

if __name__ == '__main__':
    m = sys.argv[1] if len(sys.argv) > 1 else 'static'
    if m == 'static': static()
    elif m == 'ui':
        ui(sys.argv[2:] or None)
    elif m == 'shot': shot(sys.argv[2], sys.argv[3], *(sys.argv[4:5]))
