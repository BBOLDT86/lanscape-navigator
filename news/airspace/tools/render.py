#!/usr/bin/env python3
"""Records The quiet sky from render.html, frame by frame (window.AQ.seek), with Playwright and ffmpeg.
Serve the repository root first (python3 -m http.server 8765), then:
  render.py share            -> share.png (1200x630, the map at 4:30 p.m.)
  render.py wide | tall      -> quiet-sky.mp4 (1920x1080) | quiet-sky-vertical.mp4 (1080x1920), 60 s at 30 fps
Not run automatically; re-record if the data or the look changes. CHROME may point at a browser binary."""
import asyncio, os, subprocess, sys
from playwright.async_api import async_playwright
HERE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
URL = os.environ.get('AQ_URL', 'http://localhost:8765/news/airspace/render.html')
JOBS = {'share': (1200, 630, 1, None), 'wide': (1280, 720, 1.5, 'quiet-sky.mp4'), 'tall': (540, 960, 2, 'quiet-sky-vertical.mp4')}
async def main(job, secs=60, fps=30):
    w, h, dsf, out = JOBS[job]
    async with async_playwright() as p:
        kw = {'executable_path': os.environ['CHROME']} if os.environ.get('CHROME') else {}
        b = await p.chromium.launch(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], **kw)
        pg = await (await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dsf)).new_page()
        await pg.goto(URL + f'?dpr={dsf}'); await pg.wait_for_function('window.AQ_READY===true', timeout=120000)
        total = await pg.evaluate('window.AQ.total')
        if out is None:
            await pg.evaluate('window.AQ.seek(150)'); await pg.wait_for_timeout(400); await pg.screenshot(path=os.path.join(HERE, 'share.png'))
        else:
            n = secs * fps
            ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                                   '-crf', '21', '-preset', 'slow', '-movflags', '+faststart', os.path.join(HERE, out)], stdin=subprocess.PIPE)
            for i in range(n + fps * 2):  # hold the last frame two seconds
                await pg.evaluate(f'window.AQ.seek({min(i, n - 1) / (n - 1) * total})')
                ff.stdin.write(await pg.screenshot(type='jpeg', quality=95))
                if i % 300 == 0: print(job, i, flush=True)
            ff.stdin.close(); ff.wait()
        await b.close()
asyncio.run(main(sys.argv[1]))
