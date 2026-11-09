#!/usr/bin/env python3
"""Renders the Mandate's videos and link preview with Playwright, serving the repo locally:
  reel-vertical.mp4  the reel, 1080x1920, auto-advancing once through the cards (for a phone)
  reel-wide.mp4      the reel, 1920x1080
  tour.mp4           the 3-D fly-through, 1920x1080, one pass of the tour
  share.png          1200x630, the 3-D stage, for link previews
Run after build.py: python3 news/mandate/render.py [reel|wide|tour|share ...]  (default: all)
Playwright records a WebM in real time; ffmpeg turns it into H.264 MP4. WebGL runs on SwiftShader here, so the tour is
rendered at whatever rate the software renderer manages; the reel is CSS and plays at full rate."""
import asyncio
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
PORT = 8773
BASE = f'http://127.0.0.1:{PORT}/news/mandate/'
TMP = os.path.join(HERE, '.render')


async def record(p, url, out, w, h, seconds, done_selector=None, setup=None):
    os.makedirs(TMP, exist_ok=True)
    b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, record_video_dir=TMP, record_video_size={'width': w, 'height': h})
    pg = await ctx.new_page()
    await pg.goto(url, wait_until='networkidle')
    if setup:
        await setup(pg)
    t0 = time.time()
    while time.time() - t0 < seconds:
        if done_selector and await pg.locator(done_selector).count():
            break
        await pg.wait_for_timeout(500)
    await pg.wait_for_timeout(800)
    path = await pg.video.path()
    await ctx.close()
    await b.close()
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-vf', f'scale={w}:{h}', out], check=True)
    os.remove(path)
    print('wrote', os.path.relpath(out, ROOT), f'{os.path.getsize(out) / 1e6:.1f} MB')


async def main(jobs):
    from playwright.async_api import async_playwright
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            if 'reel' in jobs:
                await record(p, BASE + 'reel.html?auto=1&rec=1', os.path.join(HERE, 'reel-vertical.mp4'), 1080, 1920, 240, done_selector='#reel[data-done="1"]')
            if 'wide' in jobs:
                await record(p, BASE + 'reel.html?auto=1&rec=1&wide=1', os.path.join(HERE, 'reel-wide.mp4'), 1920, 1080, 240, done_selector='#reel[data-done="1"]')
            if 'tour' in jobs:
                async def setup(pg):
                    await pg.wait_for_timeout(2500)
                    await pg.evaluate("document.querySelector('.mast').style.display='none'; document.querySelector('.subnav').style.display='none'; document.querySelector('#stage').classList.add('is-fs'); window.dispatchEvent(new Event('resize'))")
                    await pg.wait_for_timeout(800)
                    await pg.evaluate("window.M3D && window.M3D.setView('tour')")
                await record(p, BASE + '3d.html', os.path.join(HERE, 'tour.mp4'), 1920, 1080, 66, setup=setup)
            if 'share' in jobs:
                b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
                pg = await b.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
                await pg.goto(BASE + '3d.html', wait_until='networkidle')
                await pg.wait_for_timeout(3000)
                await pg.evaluate("document.querySelector('.mast').style.display='none'; document.querySelector('.subnav').style.display='none'; document.querySelector('#stage').classList.add('is-fs'); window.dispatchEvent(new Event('resize')); window.M3D && window.M3D.pause()")
                await pg.wait_for_timeout(1500)
                await pg.locator('#stage').screenshot(path=os.path.join(HERE, 'share.png'))
                await b.close()
                print('wrote share.png')
    finally:
        srv.terminate()
        shutil.rmtree(TMP, ignore_errors=True)


if __name__ == '__main__':
    asyncio.run(main(sys.argv[1:] or ['reel', 'wide', 'tour', 'share']))
