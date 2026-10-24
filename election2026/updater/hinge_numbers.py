#!/usr/bin/env python3
"""Read The Hinge's blended win probabilities out of the built page (the-hinge/index.html) -> data/hinge.json
{ "OH-S": 0.59, "OH-G": 0.67, "SENATE": 0.54, "HOUSE": 0.77, ... } as the Democratic-side probability.
Needs Playwright with Chromium (python3 -m playwright install chromium). Skips quietly if it cannot run."""
import asyncio, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, '..', 'data')
HINGE = os.path.join(HERE, '..', '..', 'the-hinge', 'index.html')
MAP = {'OH-SP': 'OH-S', 'OH-GOV': 'OH-G'}
async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.goto('file://' + os.path.abspath(HINGE)); await pg.wait_for_timeout(2500)
        out = await pg.evaluate("""() => { const H = window.__HINGE; if (!H || !H.RES || !H.RES.blend) return null; const o = {};
          for (const k in H.RES.blend) { const v = H.RES.blend[k]; if (v && typeof v.p === 'number') o[k] = +v.p.toFixed(3); } o.__asOf = H.RES.asOf || null; return o; }""")
        await b.close()
    if not out: print('hinge: no window.__HINGE.RES.blend on the page'); return 2
    res = {MAP.get(k, k): v for k, v in out.items() if not k.startswith('__')}
    res['_asOf'] = out.get('__asOf')
    json.dump(res, open(os.path.join(D, 'hinge.json'), 'w'), indent=1)
    print('hinge:', len(res) - 1, 'probabilities as of', res['_asOf']); return 0
try: sys.exit(asyncio.run(main()))
except Exception as ex: print('hinge: skipped,', type(ex).__name__, str(ex)[:120]); sys.exit(2)
