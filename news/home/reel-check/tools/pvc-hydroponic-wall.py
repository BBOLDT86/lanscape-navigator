# Builds the PVC hydroponic wall Reel Check from its text and its numbers.
import json, math, os
L_PER_GAL = 3.785
LETTUCE_L = 0.15     # lettuce, mid-size, liters a day per plant in summer (rough assumption)
STRAW_L = 0.30       # strawberry, liters a day (Univ. of Arizona: 200-400 mL)
FLOW_LPM = 1.0       # per channel (general NFT guide; lettuce can run lower)
SPACING_IN = 8       # plant spacing along a channel
SLOPE = 0.02         # 2% minimum (Oregon State)
RISE_IN = 10         # vertical spacing between channels
PIPE_LB_FT = 2.0     # 4 in schedule 40 PVC, empty, about 2 lb per ft
STRAW_POTS = 6       # strawberries kept out of the channels, in 2-gallon perlite pots on the drip line
body = open(os.path.join(os.path.dirname(__file__), 'pvc-hydroponic-wall.md'), encoding='utf-8').read()

# The reel: 6 capped 4 in pipes, 8 ft long, 8 in spacing, half lettuce and half strawberries, fed from a 5 gal bucket.
reel_plants = 6 * (8 * 12 // SPACING_IN)
reel_use = reel_plants / 2 * LETTUCE_L + reel_plants / 2 * STRAW_L
reel_full_lb = 6 * 8 * (math.pi * (4.026 / 2) ** 2 / 144 * 62.4 / 2 + PIPE_LB_FT)   # pipes half full, as shown

opts = [{"key": "channels", "label": "Channels", "unit": "pipes", "values": [4, 6, 8, 10], "default": 6},
        {"key": "length_ft", "label": "Channel length", "unit": "ft", "values": [6, 8, 10], "default": 8}]
configs, mats = [], []
for c in opts[0]['values']:
    for L in opts[1]['values']:
        sites = c * math.floor((L * 12 - 6) / SPACING_IN)
        use_l = sites * LETTUCE_L + STRAW_POTS * STRAW_L
        # reservoir: daily use no more than about a tenth of the tank, never under 20 gal
        tank_gal = max(20, math.ceil(use_l * 10 / L_PER_GAL / 5) * 5)
        head_ft = (c * RISE_IN + 18) / 12 + 3          # wall height plus fittings and friction
        gph = c * FLOW_LPM * 60 / L_PER_GAL + STRAW_POTS * 2
        drop_in = L * 12 * SLOPE
        configs.append({"channels": c, "length_ft": L, "plant_sites": sites, "tank_gal": tank_gal,
                        "water_gal_day": round(use_l / L_PER_GAL, 1), "pump_gph": math.ceil(gph * 1.5 / 50) * 50,
                        "drop_in": round(drop_in, 1)})
        sticks = math.ceil(c * L / 10 * 1.05)
        for item, q, u, lo, hi in [
            ("4 in schedule 40 PVC, potable (NSF-61), 10 ft", sticks, "sticks", 28, 45),
            ("4 in end caps", 2 * c, "caps", 4, 7),
            ("2 in net cups", sites, "cups", 0.12, 0.25),
            ("Hole saw, 2 in, and step bit", 1, "set", 20, 40),
            ("Galvanized pipe straps and lag screws", 2 * c + 2, "pairs", 3, 6),
            ("Pressure-treated 2x4 x 8 ft for the wall frame", math.ceil(c * 0.6) + 3, "boards", 4, 6.5),
            (f"Opaque reservoir with lid, {tank_gal} gal", 1, "tank", 25 + tank_gal * 0.6, 50 + tank_gal * 1.5),
            ("Submersible pump, rated for the head", 1, "pump", 25, 70),
            ("Air pump, stone and line", 1, "set", 20, 40),
            ("1/2 in poly tubing, manifold, valves and drain fittings", 1, "lot", 40, 80),
            ("Strawberry pots, 2 gal, with perlite or coir", STRAW_POTS, "pots", 6, 10),
            ("Two-part hydroponic nutrient and pH down", 1, "set", 35, 60),
            ("pH and EC meters", 1, "set", 40, 90),
            ("GFCI outlet or in-line GFCI cord, exterior rated", 1, "each", 25, 45),
            ("30% shade cloth for afternoon sun", 1, "piece", 20, 45)]:
            mats.append({"channels": c, "length_ft": L, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})

b = {
 "id": "2026-11-14-pvc-hydroponic-wall", "publish": "2026-11-14", "written": "2026-11-02T21:46:33-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Garden",
 "title": "The PVC hydroponic wall: lettuce, yes; strawberries, not like that",
 "dek": "A garage wall of white pipes overflowing with lettuce and berries is a feed staple; the plumbing is real, but the tiny bucket, the berries in the pipes and the cord in the water need changing.",
 "reel": "Lengths of white PVC pipe are drilled with rows of holes, capped, and strapped across a sunny wall in a zig-zag, with a small pump in a bucket at the bottom. Net cups of lettuce and strawberries go into the holes, and a time-lapse fills the wall with heads of lettuce and hanging red berries.",
 "verdict": {"shown": 3, "fixed": 7, "line": "As filmed the bucket runs dry in a day and the berries suffer; with a big tank, sloped channels for greens and a GFCI, it is a productive wall."},
 "scores": [
  {"test": "Enough water and nutrients", "shown": 2, "fixed": 8, "why": "A 5 gal bucket for 72 plants drains in about a day; a 20+ gal tank holds a week or more"},
  {"test": "Roots get air and stay cool", "shown": 3, "fixed": 7, "why": "Capped pipes pool warm water; a 2% slope, white pipe, shade and an air stone keep roots healthy"},
  {"test": "Right crops in the right system", "shown": 3, "fixed": 8, "why": "Lettuce suits film channels; strawberries do better in drip-fed media pots"},
  {"test": "Survives a pump failure", "shown": 1, "fixed": 6, "why": "A film system wilts within hours; drains to the tank and a daily check limit losses"},
  {"test": "Electrically safe", "shown": 2, "fixed": 9, "why": "A pump in water outdoors must be on a GFCI; exterior cord and a drip loop"},
  {"test": "Doable by one handy person", "shown": 7, "fixed": 7, "why": "A weekend of drilling and plumbing, then ten minutes a day"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "Hydro hints: Nutrient film technique (EM 9457)", "outlet": "Oregon State University Extension Service", "url": "https://extension.oregonstate.edu/catalog/pub/em-9457-hydro-hints-nutrient-film-technique"},
  {"n": 2, "title": "Nutrient Film Technique Production of Lettuce", "outlet": "CropKing", "url": "https://cropking.com/blogs/knowledge-center/nft-production-lettuce"},
  {"n": 3, "title": "Greenhouse production systems: nutrient film technique", "outlet": "Greenhouse-Management.com", "url": "https://greenhouse-management.com/greenhouse_management/greenhouse_production_systems/nutrient_film_technique.htm"},
  {"n": 4, "title": "Hydroponic Strawberry Irrigation", "outlet": "University of Arizona CALES", "url": "https://cales.arizona.edu/strawberry/Hydroponic_Strawberry_Information_Website/Irrigation.html"},
  {"n": 5, "title": "Hydroponic day-neutral strawberry trial", "outlet": "University of Illinois Extension", "url": "https://extension.illinois.edu/blogs/commercial-fruit-and-vegetable-growers/2023-10-27-hydroponic-day-neutral-strawberry"},
  {"n": 6, "title": "Hydroponic problems (class 3)", "outlet": "University of Missouri Extension / North Central SARE", "url": "https://projects.sare.org/media/pdf/H/y/d/Hydroponic-problems-Class-3.pdf"},
  {"n": 7, "title": "2023 NEC 210.8, GFCI protection", "outlet": "Mike Holt Enterprises", "url": "https://www.mikeholt.com/files/PDF/23UNEC1_210.8.pdf"}],
 "kit": {"summary": "Open-ended 4 in PVC channels on a 2% slope, fed from a large opaque tank by a submersible pump on a GFCI, growing lettuce and greens, with strawberries in drip-fed perlite pots on the same loop.",
  "options": opts,
  "metrics": [
   {"key": "plant_sites", "label": "Lettuce sites", "unit": "plants", "note": "8 in apart; plus 6 strawberry pots"},
   {"key": "tank_gal", "label": "Reservoir", "unit": "gallons", "note": "about ten days of use; never under 20"},
   {"key": "water_gal_day", "label": "Water use in summer", "unit": "gallons a day", "note": "top up daily, change monthly"},
   {"key": "pump_gph", "label": "Pump size", "unit": "gal per hour", "note": "at the wall's height, with margin"},
   {"key": "drop_in", "label": "Fall per channel", "unit": "in", "note": "2% slope, inlet end high"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Plan the wall and power", "start": 0, "days": 3, "gate": "Wall or frame gets morning sun and afternoon shade; a GFCI outlet within reach, no extension cord"},
   {"phase": "Build the frame", "start": 3, "days": 2, "gate": "Freestanding 2x4 frame or ledger into studs; channels can be set at a 2% fall"},
   {"phase": "Cut and drill channels", "start": 5, "days": 2, "gate": "Holes 8 in apart; burrs removed; pipes rinsed of shavings"},
   {"phase": "Plumb the loop", "start": 7, "days": 2, "gate": "Feed to each high end, open drop back to the tank at each low end; no channel holds standing water"},
   {"phase": "Leak and flow test", "start": 9, "days": 2, "gate": "Runs 48 hours with water only; every channel carries a thin even film; no drips on the wall"},
   {"phase": "Mix nutrients and plant", "start": 11, "days": 1, "gate": "pH and EC in range for lettuce; rooted seedlings 2-3 weeks old go in"},
   {"phase": "First month of care", "start": 12, "days": 30, "gate": "Daily: pump running, tank topped up; weekly: pH and EC; roots white, not brown"}],
  "assumptions": "Water use assumes about 0.15 L a day per lettuce and 0.3 L per strawberry in summer, with flow of about 1 L a minute per channel. Prices are rough US retail ranges for late 2026, not quotes."}}
out = os.path.join(os.path.dirname(__file__), '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('reel: %d plants, %.1f L/day (%.1f gal), bucket 18.9 L lasts %.1f days, wall load %.0f lb' %
      (reel_plants, reel_use, reel_use / L_PER_GAL, 18.9 / reel_use, reel_full_lb))
print(configs[4])
