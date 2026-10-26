#!/usr/bin/env python3
"""Smoke test for a Create product: two devices pair over a local PeerJS server and sync, data survives a reload,
the backup exports, the page opens from disk without the network, and nothing lands in the console.

  python3 news/create/test/smoke.py practice            # tests news/create/apps/practice/index.html
  python3 news/create/test/smoke.py practice --shots    # also writes phone and desktop screenshots next to this file

Needs: the PeerJS server (npm i -g peer; `peerjs --port 9000 --path / --host 127.0.0.1`), Playwright with Chromium,
and news/create/test/peerjs.min.js (npm pack peerjs@1.5.4). The harness drives the app through window.__create,
the test hooks every product exposes (see apps/BUILDING.md): setup(name), code(), pair(code), net(), add(), count(),
state(), export().
"""
import json, os, socket, subprocess, sys, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))  # the repo
PEERJS = os.path.join(HERE, 'peerjs.min.js')
CDN = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve(port):
    os.chdir(ROOT)
    srv = ThreadingHTTPServer(('127.0.0.1', port), Quiet)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

def peer_server_up():
    try:
        import urllib.request
        return b'PeerJS' in urllib.request.urlopen('http://127.0.0.1:9000/', timeout=2).read()
    except Exception:
        return False

def main():
    if len(sys.argv) < 2: print(__doc__); sys.exit(2)
    app = sys.argv[1]; shots = '--shots' in sys.argv
    page_path = os.path.join(ROOT, 'news', 'create', 'apps', app, 'index.html')
    if not os.path.exists(page_path): sys.exit(f'no such app: {page_path}')
    if not os.path.exists(PEERJS): sys.exit(f'missing {PEERJS}: npm pack peerjs@1.5.4 and copy dist/peerjs.min.js here')
    if not peer_server_up(): sys.exit('PeerJS server not running: peerjs --port 9000 --path / --host 127.0.0.1')
    from playwright.sync_api import sync_playwright
    port = free_port(); serve(port)
    url = f'http://127.0.0.1:{port}/news/create/apps/{app}/?peer=127.0.0.1:9000'
    errors = {'A': [], 'B': [], 'F': []}
    fails = []
    def ok(cond, msg):
        print(('  ok   ' if cond else '  FAIL ') + msg)
        if not cond: fails.append(msg)
    with sync_playwright() as p:
        b = p.chromium.launch()
        def ctx(tag, route=True, **kw):
            c = b.new_context(**kw); pg = c.new_page()
            pg.on('pageerror', lambda e, t=tag: errors[t].append('pageerror: ' + str(e)))
            pg.on('console', lambda m, t=tag: errors[t].append('console.' + m.type + ': ' + m.text) if m.type in ('error',) else None)
            if route: pg.route(CDN, lambda r: r.fulfill(path=PEERJS, content_type='application/javascript'))
            return pg
        A = ctx('A', viewport={'width': 1280, 'height': 900})
        B = ctx('B', viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        print(f'[{app}] open')
        A.goto(url); A.wait_for_function('window.__create && typeof window.__create.setup === "function"', timeout=15000)
        B.goto(url); B.wait_for_function('window.__create && typeof window.__create.setup === "function"', timeout=15000)
        ok(True, 'both pages expose window.__create')
        A.evaluate('__create.setup("Ann")'); B.evaluate('__create.setup("Ben")')
        A.evaluate('__create.add()'); A.evaluate('__create.add()')
        time.sleep(0.4)
        ok(A.evaluate('__create.count()') >= 2, 'A has its two sample items')
        codeA = A.evaluate('__create.code()')
        ok(isinstance(codeA, str) and len(codeA.replace('-', '')) == 6, f'A has a six-letter code ({codeA})')
        B.evaluate(f'__create.pair({json.dumps(codeA)})')
        try:
            A.wait_for_function('__create.net() === "on"', timeout=20000); B.wait_for_function('__create.net() === "on"', timeout=20000)
            ok(True, 'both devices report net() === "on"')
        except Exception as e:
            ok(False, f'pairing did not complete: A={A.evaluate("__create.net()")} B={B.evaluate("__create.net()")}')
        try:
            B.wait_for_function('__create.count() >= 2', timeout=10000); ok(True, "A's items reached B")
        except Exception:
            ok(False, f"A's items did not reach B (B.count={B.evaluate('__create.count()')})")
        B.evaluate('__create.add()')
        try:
            A.wait_for_function('__create.count() >= 3', timeout=10000); ok(True, "B's new item reached A")
        except Exception:
            ok(False, f"B's item did not reach A (A.count={A.evaluate('__create.count()')})")
        nA = A.evaluate('__create.count()')
        A.reload(); A.wait_for_function('window.__create && window.__create.count() > 0', timeout=15000)
        ok(A.evaluate('__create.count()') == nA, f'A still has {nA} items after a reload (localStorage)')
        try:
            A.wait_for_function('__create.net() === "on"', timeout=20000); ok(True, 'A reconnected to B by itself after the reload')
        except Exception:
            ok(False, f'A did not reconnect after reload (net={A.evaluate("__create.net()")})')
        exp = A.evaluate('__create.export()')
        try:
            j = json.loads(exp); ok(isinstance(j, dict) and j.get('v') == 1, 'export() is JSON with v:1')
        except Exception:
            ok(False, 'export() is not JSON')
        st = A.evaluate('__create.state()')
        ok(isinstance(st, dict) and 'items' in st and 'dev' in st, 'state() has items and dev')
        key = A.evaluate(f'Object.keys(localStorage).filter(k => k.startsWith("create."))')
        ok(any(k == f'create.{app}.v1' for k in key), f'localStorage key create.{app}.v1 present ({key})')
        if shots:
            A.screenshot(path=os.path.join(HERE, f'{app}-desktop.png'), full_page=False)
            B.screenshot(path=os.path.join(HERE, f'{app}-phone.png'), full_page=False)
            print(f'  shots: {HERE}/{app}-desktop.png, {app}-phone.png')
        # from disk, with no network: the page must still work solo
        F = ctx('F', route=False, offline=True, viewport={'width': 1000, 'height': 800})
        F.goto('file://' + page_path);
        try:
            F.wait_for_function('window.__create && typeof window.__create.setup === "function"', timeout=15000)
            F.evaluate('__create.setup("Solo")'); F.evaluate('__create.add()')
            ok(F.evaluate('__create.count()') >= 1, 'file:// offline: setup and add work with no network')
            ok(F.evaluate('__create.net()') != 'on', f'file:// offline: net() says {F.evaluate("__create.net()")} (not pretending to be connected)')
        except Exception as e:
            ok(False, f'file:// offline: page did not come up ({e})')
        time.sleep(0.5)
        for tag in ('A', 'B', 'F'):
            errs = [e for e in errors[tag] if 'ERR_INTERNET_DISCONNECTED' not in e and 'net::ERR' not in e and 'fonts.g' not in e and 'cdn.jsdelivr' not in e]
            ok(not errs, f'{tag}: no page errors' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
        b.close()
    size = os.path.getsize(page_path)
    import gzip; gz = len(gzip.compress(open(page_path, 'rb').read(), 9))
    print(f'  size {size/1024:.0f} KB, {gz/1024:.0f} KB gzipped')
    print(('PASS' if not fails else f'FAIL ({len(fails)})') + f' {app}')
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
