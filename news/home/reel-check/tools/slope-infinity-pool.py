# Builds the infinity-edge pool on a slope (Reel Check) from its text and its numbers.
import json, math, os
G = 62.4
DEPTH = 5.0           # ft average water depth
SHEET_GPM = 10        # gpm per ft of edge for a quarter-inch sheet, top of the 7-10 range
here = os.path.dirname(__file__)
body = open(os.path.join(here, 'slope-infinity-pool.md'), encoding='utf-8').read()

SIZES = {"12x24": (12, 24), "14x28": (14, 28), "16x32": (16, 32)}
opts = [{"key": "pool", "label": "Pool size", "unit": "ft", "values": list(SIZES), "default": "14x28"},
        {"key": "slope_pct", "label": "Yard slope", "unit": "%", "values": [10, 20, 30, 40], "default": 20}]
configs, mats = [], []
for name, (w, L) in SIZES.items():
    for s in opts[1]['values']:
        area = w * L; drop = w * s / 100              # the edge runs along the long downhill side
        cf = area * DEPTH; tons = cf * G / 2000
        edge_gpm = L * SHEET_GPM
        # basin: top 2 in of the pool, bather surge for 10 people, plus 1 ft of water kept over its drain
        basin_w = 3.0 + drop * 0.25                    # wider as the fall grows, to catch the sheet
        basin_gal = area * (2 / 12) * 7.48 + 185 + L * basin_w * 1.0 * 7.48
        low_wall = DEPTH + 1 + drop                    # downhill wall from footing to edge
        slide = tons * 2000 * s / math.hypot(100, s)   # lb, downslope pull of pool and water if it rests on the slope
        piers = (math.ceil(L / 8) + 1) * (math.ceil(w * 0.67 / 8) + 1)
        pier_ft = round(8 + drop * 2)                  # rough pier depth to competent ground, deeper on steeper sites
        configs.append({"pool": name, "slope_pct": s, "gallons": round(cf * 7.48, -2), "water_tons": round(tons),
                        "edge_gpm": edge_gpm, "basin_gallons": round(basin_gal, -1), "low_wall_ft": round(low_wall, 1),
                        "downslope_pull_lb": round(slide, -2)})
        retain_lf = L + 2 * w
        for item, q, u, lo, hi in [
            ("Geotechnical soils and slope report", 1, "each", 1500, 5000),
            ("Structural engineer: shell, piers, grade beams and basin", 1, "each", 3000, 9000),
            ("Drilled piers to competent ground, " + str(pier_ft) + " ft deep", piers, "piers", 1500, 4000),
            ("Grade beams tying the piers", 2 * (L + w), "linear ft", 60, 150),
            ("Pool shell, plaster and equipment by a pool contractor", area, "sq ft", 90, 200),
            ("Vanishing-edge premium: weir, laser screeding and tile", L, "linear ft", 400, 1000),
            ("Catch basin with its own pump, filter and electronic leveler", 1, "lot", 8000, 20000),
            ("Waterproofing of weir wall, basin and shell", area + L * 10, "sq ft", 6, 14),
            ("Uphill retaining wall and drainage behind it", retain_lf, "linear ft", 120, 300),
            ("Under-shell gravel, perforated drain and relief valves", area, "sq ft", 3, 7),
            ("Deck drains piped away from the slope", 1, "lot", 1500, 5000),
            ("Barrier fence and gates, including the basin side", math.ceil(2 * (L + w) + 30), "linear ft", 30, 80),
            ("Erosion control and slope planting below the basin", 1, "lot", 1500, 6000),
            ("Permits", 1, "each", 500, 2000)]:
            mats.append({"pool": name, "slope_pct": s, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})

b = {
 "id": "2026-11-23-slope-infinity-pool", "publish": "2026-11-23", "written": "2026-11-02T21:37:32-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Water",
 "title": "The hillside infinity pool: can you pour one on a sloped yard yourself?",
 "dek": "Reels show a backyard pool on a slope with water spilling over an invisible edge into the view; the edge is the easy part, and holding 60 tons of water on a hillside is a job for piers, a soils report and a pool contractor.",
 "reel": "A crew forms and pours a concrete box on a sloping lawn, the downhill wall standing several feet out of the ground. The pool is filled until water sheets over the low edge toward a valley view. Soil borings, piers, a catch basin, a pump and a fence never appear.",
 "verdict": {"shown": 1, "fixed": 5, "line": "Poured on the slope as filmed, the pool can slide, crack and send a flood downhill; on engineered piers with a sized catch basin, it is a sound but professional, high-cost build."},
 "scores": [
  {"test": "Stays put on the slope", "shown": 1, "fixed": 8, "why": "A box on fill creeps and cracks; piers to bedrock and grade beams hold it"},
  {"test": "The edge works", "shown": 2, "fixed": 8, "why": "Water vanishing into nothing; a level weir, a sized basin and its own pump make it real"},
  {"test": "Watertight", "shown": 2, "fixed": 7, "why": "No membrane on a freestanding wall; waterproofing both faces and the top fixes it"},
  {"test": "Safe for swimmers and neighbors", "shown": 1, "fixed": 7, "why": "No fence, a hidden drop and a flood path downhill; barrier, basin cover and drains address it"},
  {"test": "Cost against a flat-yard pool", "shown": 5, "fixed": 2, "why": "Piers, retaining walls and the edge add tens of thousands"},
  {"test": "Doable by one handy person", "shown": 2, "fixed": 2, "why": "Shell, piers and weir are contractor work; planting and fencing are the DIY part"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "Powerful grounds", "outlet": "WaterShapes", "url": "https://watershapes.com/powerful-grounds/"},
  {"n": 2, "title": "A pocket guide to building vanishing-edge pools", "outlet": "AQUA Magazine", "url": "https://www.aquamagazine.com/builder/article/15120187/a-pocket-guide-to-building-vanishing-edgepools"},
  {"n": 3, "title": "Creating a vanishing edge swimming pool with unvanishing quality", "outlet": "Pool & Spa News", "url": "https://www.poolspanews.com/?p=30426"},
  {"n": 4, "title": "Water feature hydraulics", "outlet": "Pool & Spa Marketing", "url": "https://www.poolspamarketing.com/trade/water-feature-hydraulics/2/"},
  {"n": 5, "title": "How much does an infinity pool cost?", "outlet": "HomeGuide", "url": "https://homeguide.com/costs/infinity-pool-cost"},
  {"n": 6, "title": "Need urgent help with cracking, leaking pool on a hillside in Austin, TX", "outlet": "Trouble Free Pool", "url": "https://www.troublefreepool.com/threads/need-urgent-help-with-cracking-leaking-pool-on-a-hillside-in-austin-tx.175162/post-1545550"},
  {"n": 7, "title": "Pool barrier height and clearances, ISPSC chapter 3", "outlet": "Town of Thompson's Station, Tennessee", "url": "https://www.thompsons-station.gov/sites/default/files/uploads/documents/Community%20Development/Building-Codes/Building%20Permit/pool-barrier-height-and-clearances-ispsc-chapter_3.pdf"}],
 "kit": {"summary": "A professionally built concrete pool on drilled piers and grade beams, with an uphill retaining wall, a laser-level weir along the downhill side, a sized catch basin with its own pump, full waterproofing and a code barrier.",
  "options": opts,
  "metrics": [
   {"key": "gallons", "label": "Water", "unit": "gallons", "note": "at 5 ft average depth"},
   {"key": "water_tons", "label": "Weight of water", "unit": "tons", "note": "all of it on the slope"},
   {"key": "downslope_pull_lb", "label": "Downhill pull if it rests on the slope", "unit": "lb", "note": "what piers and grade beams must stop"},
   {"key": "low_wall_ft", "label": "Downhill wall", "unit": "ft", "note": "footing to edge"},
   {"key": "edge_gpm", "label": "Flow over the edge", "unit": "gpm", "note": "a quarter-inch sheet at 10 gpm per ft"},
   {"key": "basin_gallons", "label": "Catch basin", "unit": "gallons", "note": "top 2 in of the pool, 10 swimmers' surge and 1 ft kept over the drain"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Soils and slope report", "start": 0, "days": 30, "gate": "Borings show where competent ground is; the geologist accepts the site, or the pool moves or shrinks"},
   {"phase": "Engineering and permit", "start": 30, "days": 45, "gate": "Stamped shell, pier and basin drawings; permit issued; pool contractor with vanishing-edge work you have seen"},
   {"phase": "Piers and grade beams", "start": 75, "days": 14, "gate": "Each pier reaches the depth the engineer set; inspected before concrete"},
   {"phase": "Excavation, drains and retaining wall", "start": 89, "days": 14, "gate": "Under-shell drain and relief valves in; uphill wall drained and backfilled"},
   {"phase": "Steel and shell", "start": 103, "days": 14, "gate": "Rebar inspected; shell shot full thickness from one side in one pour"},
   {"phase": "Weir, basin and waterproofing", "start": 117, "days": 21, "gate": "Weir level within 1/16 in end to end; weir wall waterproofed on both faces and the top"},
   {"phase": "Equipment, plaster and fill", "start": 138, "days": 14, "gate": "Edge pump and leveler tested; basin never runs dry; no water reaches the slope"},
   {"phase": "Barrier, deck drains and slope", "start": 152, "days": 14, "gate": "Fence around pool and basin inspected; deck drains piped off-site; slope planted"}],
  "assumptions": "Water at 62.4 lb per cubic foot and 5 ft average depth, the edge on the long downhill side, edge flow at 10 gpm per ft and pier counts on a rough 8 ft grid under the downhill two-thirds. Quantities are estimates with some waste; prices are rough US ranges for late 2026, not quotes, and not an engineered design."}}
out = os.path.join(here, '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for c in configs: print(c)
sel = [m for m in mats if m['pool'] == '14x28' and m['slope_pct'] == 20]
print(sum(m['low'] for m in sel), sum(m['high'] for m in sel))
for m in sel: print(m['item'], m['qty'], m['low'], m['high'])
