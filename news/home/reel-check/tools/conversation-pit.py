# Builds the sunken conversation pit with a moat (Reel Check) from its text and its numbers.
import json, math, os
SOIL_PCF = 110; KA = 0.33; WATER = 62.4; STORM_IN = 2; FIRE_FT = 3; BENCH_FT = 1.5; SEAT_FT = 2
body = open(os.path.join(os.path.dirname(__file__), 'conversation-pit.md'), encoding='utf-8').read()
opts = [{"key": "diameter_ft", "label": "Pit diameter", "unit": "ft", "values": [10, 12, 14, 16], "default": 12},
        {"key": "depth_in", "label": "Pit depth", "unit": "in", "values": [18, 24, 30], "default": 24}]
configs, mats = [], []
for d in opts[0]['values']:
    for dep in opts[1]['values']:
        h = dep / 12; r = d / 2
        dig_cf = math.pi * (r + 1) ** 2 * (h + 0.5)                   # 1 ft over-dig for the wall, 6 in for the base
        dig_cy = dig_cf / 27; soil_t = dig_cf * SOIL_PCF / 2000
        push = 0.5 * KA * SOIL_PCF * h * h                            # active soil push per foot of wall, dry
        push_wet = push + 0.5 * WATER * h * h * 0.6                  # with saturated backfill (rough)
        catch_sf = math.pi * (r + 3) ** 2                             # pit floor plus a 3 ft paved rim that drains in
        storm_gal = catch_sf * STORM_IN / 12 * 7.48
        seats = math.floor(math.pi * (d - BENCH_FT) / SEAT_FT)
        gap = (d - 2 * BENCH_FT - FIRE_FT) / 2
        configs.append({"diameter_ft": d, "depth_in": dep, "dig_cy": round(dig_cy, 1), "soil_tons": round(soil_t, 1),
                        "wall_push_lb_ft": round(push_wet), "storm_gal": round(storm_gal), "seats": seats,
                        "fire_gap_ft": round(gap, 1)})
        circ_in = math.pi * d * 12
        wall_blocks = math.ceil(circ_in / 16 * math.ceil((dep + 6) / 6) * 1.05)
        bench_blocks = math.ceil(math.pi * (d - BENCH_FT * 2) * 12 / 16 * 3 * 1.05)
        caps = math.ceil(circ_in / 16 * 1.05) + math.ceil(math.pi * (d - 3) * 12 / 16 * 1.05)
        stone_cy = round((math.pi * r * r * 0.5 + circ_in / 12 * 1 * (h + 0.5)) / 27 * 1.1, 1)
        pavers_sf = math.ceil(math.pi * (r - BENCH_FT) ** 2 * 1.1)
        loads = math.ceil(dig_cy * 1.25 / 10)                         # 25% swell once dug, 10 cu yd loads
        moat_len = math.pi * (d + 4)
        liner_sf = math.ceil(moat_len * 4 * 1.15)
        moat_gravel = round(moat_len * 2 * 1.25 / 27 * 1.1, 1)
        for item, q, u, lo, hi in [
            ("811 utility locate", 1, "call", 0, 0),
            ("Mini excavator rental, with delivery", 1 if d <= 12 else 2, "days", 350, 550),
            ("Haul away spoil, 10 cu yd loads", loads, "loads", 300, 550),
            ("Crushed stone for the base and wall drain", stone_cy, "cu yd", 50, 90),
            ("Segmental wall blocks, 16 in face", wall_blocks, "blocks", 3.5, 6),
            ("Bench blocks, 16 in face", bench_blocks, "blocks", 3.5, 6),
            ("Wall and bench caps", caps, "caps", 5, 9),
            ("Pavers for the pit floor", pavers_sf, "sq ft", 4, 8),
            ("Catch basin, 4 in pipe to daylight or a dry well", 1, "set", 250, 700),
            ("Fire pit ring with steel liner, 36 in", 1, "each", 250, 600),
            ("Pondless water ring: liner, underlay, basin", liner_sf, "sq ft", 1.2, 2.5),
            ("Washed river gravel to fill the ring", moat_gravel, "cu yd", 70, 120),
            ("Pump and vault for the water ring", 1, "set", 300, 700),
            ("GFCI outdoor outlet by an electrician", 1, "each", 300, 800),
            ("Building or zoning permit", 1, "each", 0, 300)]:
            mats.append({"diameter_ft": d, "depth_in": dep, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})
b = {
 "id": "2026-11-16-conversation-pit", "publish": "2026-11-16", "written": os.environ.get("WRITTEN", "2026-11-02T22:20:00-05:00"),
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Outdoor living",
 "title": "The sunken fire pit with a moat: a backyard dream or a drowning hazard?",
 "dek": "A circular conversation pit dug into the lawn, a fire in the middle and a ring of water around it is a reel favorite; as filmed it floods, and the moat is a hazard to children, but a drained pit with a pondless water ring works.",
 "reel": "A crew digs a round pit into a lawn, lines it with block walls and a curved bench, sets a fire bowl in the middle and surrounds the whole thing with a ring of still water crossed by stepping stones. At night the fire glows and the water reflects it. No drain, pump, fence or railing ever appears.",
 "verdict": {"shown": 3, "fixed": 7, "line": "The pit is buildable; the open moat and the missing drain are the problems, and both have fixes."},
 "scores": [
  {"test": "Walls hold the soil", "shown": 5, "fixed": 8, "why": "Under 3 ft, segmental block on a stone base with a drain behind it is routine"},
  {"test": "Stays dry after rain", "shown": 1, "fixed": 7, "why": "A bowl in the ground fills like a cistern; a catch basin and outlet fix it"},
  {"test": "Fire is safe to sit around", "shown": 4, "fixed": 7, "why": "Sized right, there is room between bench and flame; gas needs care in a hollow"},
  {"test": "Water is safe for children", "shown": 1, "fixed": 8, "why": "An open moat drowns toddlers; a pondless ring has no standing water"},
  {"test": "Low upkeep", "shown": 2, "fixed": 6, "why": "Still water breeds mosquitoes in a week; moving water over gravel does not"},
  {"test": "Doable by a homeowner", "shown": 4, "fixed": 6, "why": "Hire the dig and the electrical; the walls and paving are weekend work"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "Recreational fire pits (IFC 2018 summary)", "outlet": "Knox County Code Administration", "url": "https://www.KnoxCounty.org/codes/pdfs/construction_info/RECREATIONALFIREPITS.pdf"},
  {"n": 2, "title": "How to Build an In-Ground Fire Pit", "outlet": "The Home Depot", "url": "https://www.homedepot.com/c/ah/how-to-build-an-in-ground-fire-pit/9ba683603be9fa5395fab901323cab2d"},
  {"n": 3, "title": "Retaining wall design: when is engineered design required (CRC R404.4)", "outlet": "GoCodebook", "url": "https://gocodebook.com/us/california/california-residential-code/foundations/foundation-walls-and-retaining/when-is-engineered-design-required"},
  {"n": 4, "title": "Latest data shows drowning remains leading cause of unintentional death for children ages 1-4", "outlet": "U.S. Consumer Product Safety Commission", "url": "https://www.cpsc.gov/ko/node/21725"},
  {"n": 5, "title": "Doctors: Children Can Drown In As Little As One Inch Of Water", "outlet": "CBS News Philadelphia", "url": "https://www.cbsnews.com/amp/philadelphia/news/doctors-children-drown-one-inch-two-inches-water"},
  {"n": 6, "title": "Pool, spa and hot tub barrier requirements", "outlet": "Larimer County, Colorado", "url": "https://www.larimer.gov/sites/default/files/uploads/2022/pool_spa_hot_tub_barrier_requirements.pdf"},
  {"n": 7, "title": "Mosquito control around the home (W1293)", "outlet": "University of Tennessee Extension", "url": "https://utia.tennessee.edu/publications/wp-content/uploads/sites/269/2025/01/W1293.pdf"},
  {"n": 8, "title": "What is a Pondless Waterfall?", "outlet": "Aquascape", "url": "https://support.aquascapeinc.com/hc/en-us/articles/201258034-What-is-a-Pondless-Waterfall"},
  {"n": 9, "title": "Propane safety talk", "outlet": "WorkSafeNB", "url": "https://www.worksafenb.ca/safety-talk/en/10-propane.html"}],
 "kit": {"summary": "A round pit up to 30 in deep with segmental block walls and bench on a stone base, a catch basin draining to daylight or a dry well, a 36 in wood fire ring, and a pondless water ring in place of the moat.",
  "options": opts,
  "metrics": [
   {"key": "dig_cy", "label": "Soil to dig", "unit": "cu yd", "note": "banked, before it fluffs up"},
   {"key": "soil_tons", "label": "Weight to haul", "unit": "tons", "note": "at about 110 lb per cu ft"},
   {"key": "wall_push_lb_ft", "label": "Push on the wall", "unit": "lb per ft", "note": "wet soil behind each foot of wall"},
   {"key": "storm_gal", "label": "Water from a 2 in storm", "unit": "gallons", "note": "landing in the pit and its paved rim"},
   {"key": "seats", "label": "Seats on the bench", "unit": "people", "note": "at 2 ft each"},
   {"key": "fire_gap_ft", "label": "Bench to fire", "unit": "ft", "note": "from the bench front to a 36 in fire ring"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Rules, 811 and the drain plan", "start": 0, "days": 7, "gate": "Utilities marked; a place for the water to go: daylight, a dry well or a sump"},
   {"phase": "Dig and haul", "start": 7, "days": 2, "gate": "Floor level and pitched to the drain; no water standing the morning after"},
   {"phase": "Base, drain and first course", "start": 9, "days": 2, "gate": "First course level and buried; drain pipe tested with a hose"},
   {"phase": "Walls and bench", "start": 11, "days": 4, "gate": "Gravel behind every course; walls plumb; caps glued"},
   {"phase": "Floor and fire ring", "start": 15, "days": 2, "gate": "Fire ring centered with room to the bench; floor drains"},
   {"phase": "Water ring and power", "start": 17, "days": 4, "gate": "Electrician's GFCI in; no water visible above the gravel"},
   {"phase": "First fire", "start": 21, "days": 1, "gate": "Hose or extinguisher at hand; nothing burnable within 25 ft if the code applies"}],
  "assumptions": "Soil at 110 lb per cu ft with an active pressure coefficient of 0.33 plus some water pressure for wet backfill; the storm is 2 in falling on the pit and a 3 ft rim. Quantities include 5-15% waste; prices are rough US ranges for late 2026, not quotes."}}
out = os.path.join(os.path.dirname(__file__), '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for c in configs:
    if c["diameter_ft"] == 12: print(c)
