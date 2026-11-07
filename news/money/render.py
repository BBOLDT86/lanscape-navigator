#!/usr/bin/env python3
"""Renders news/money/share.png (1200x630, the link preview) from the page's stage with Playwright, serving the repo
locally. Run after the data and pieces are in: python3 news/money/render.py"""
import asyncio, os, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
async def main():
    from playwright.async_api import async_playwright
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8771', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
            await pg.goto('http://127.0.0.1:8771/news/money/', wait_until='networkidle'); await pg.wait_for_timeout(2500)
            await pg.add_style_tag(content='.mast{display:none!important}.stage{height:630px!important}.stage .bar{display:none!important}.stage .flow{inset:0!important}')
            await pg.evaluate('window.dispatchEvent(new Event("resize"))'); await pg.wait_for_timeout(800)
            await pg.locator('#stage').screenshot(path=os.path.join(HERE, 'share.png'))
            await b.close()
    finally: srv.terminate()
    print('wrote share.png')
asyncio.run(main())
