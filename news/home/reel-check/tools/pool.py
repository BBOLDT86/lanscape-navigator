# Builds the plastic-bottle pool (the first Reel Check) from its text and its numbers.
import json, math, os
G = 62.4; BD = 2.6
body = open(os.path.join(os.path.dirname(__file__), 'pool.md'), encoding='utf-8').read()
opts = [{"key": "diameter_ft", "label": "Diameter", "unit": "ft", "values": [8, 10, 12, 14, 16], "default": 12},
        {"key": "depth_ft", "label": "Water depth", "unit": "ft", "values": [2, 2.5, 3], "default": 2.5}]
configs, mats = [], []
for d in opts[0]['values']:
    for h in opts[1]['values']:
        r = d / 2; circ = math.pi * d; vol = math.pi * r * r * h
        wall_in = h * 12 + 6; wall_ft = wall_in / 12
        bottles = math.ceil(wall_in / BD) * math.ceil(circ * 12 / BD)
        configs.append({"diameter_ft": d, "depth_ft": h, "gallons": round(vol * 7.48), "water_tons": round(vol * G / 2000, 1),
                        "hoop_lb_per_ft": round(G * h * r), "floor_psf": round(G * h), "bottles": bottles, "wall_height_in": round(wall_in)})
        mortar_bags = math.ceil(circ * wall_ft * 2 / 12 / 0.6 * 1.15)
        conc_bags = math.ceil(math.pi * (d + 1) * (8 / 12) / 0.6 * 1.1)
        hoops = 2 + math.ceil((wall_in - 12) / 12) + 1
        sticks = math.ceil((hoops * math.pi * (d + .5) * 1.1 + math.ceil(circ) * (wall_ft + 1)) / 10)
        rolls = math.ceil(math.ceil(circ * 2 * 1.1) / 100)
        liner = math.ceil(math.pi * r * r + circ * (wall_ft + 1))
        sand = round(max(.5, math.pi * r * r * (2 / 12) / 27), 1)
        for item, q, u, lo, hi in [
            ("Half-liter bottles, packed with sand or plastic", bottles, "bottles", 0, 0),
            ("Concrete for the ring footing, 80 lb bags", conc_bags, "bags", 6.5, 8),
            ("Mortar mix for the wall skins, 80 lb bags", mortar_bags, "bags", 8, 10.5),
            ("#3 rebar, 10 ft sticks (hoops and verticals)", sticks, "sticks", 6, 9),
            ("Welded wire, 48 in x 100 ft, 14 gauge", rolls, "rolls", 90, 140),
            ("Tie wire, chairs and hardware", 1, "lot", 40, 80),
            ("Sand for the floor bed", sand, "cu yd", 60, 110),
            ("Vinyl or EPDM liner", liner, "sq ft", 1, 2.5),
            ("Cartridge filter pump", 1, "each", 150, 350),
            ("Self-closing gate hardware", 1, "set", 40, 90),
            ("Building permit", 1, "each", 50, 300),
            ("Structural engineer's review", 1, "each", 300, 800)]:
            mats.append({"diameter_ft": d, "depth_ft": h, "item": item, "qty": q, "unit": u, "low": round(q * lo), "high": round(q * hi)})
b = {
 "id": "2026-11-02-plastic-bottle-pool", "publish": "2026-11-02", "written": "2026-11-02T21:20:00-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Water",
 "title": "The plastic bottle pool: could you build the viral reel?",
 "dek": "A backyard pool walled with thousands of water bottles and a skin of cement racks up likes. Filled, it would let go all at once, but a round, footed version can work.",
 "reel": "Thousands of empty water bottles are stacked into a 12 by 24 foot rectangle on a lawn, caged between welded-wire fence panels, and troweled over with cement. The finished box is presented as a swimming pool. No digging, footing, floor or liner ever appears.",
 "verdict": {"shown": 2, "fixed": 6, "line": "As filmed it is a wall, not a pool; round, footed and lined, it becomes a real project."},
 "scores": [
  {"test": "Holds the water load", "shown": 1, "fixed": 7, "why": "No anchorage as shown; a round ferrocement wall carries the load in hoop tension"},
  {"test": "Watertight", "shown": 1, "fixed": 8, "why": "A vinyl liner over a smooth plaster face does the sealing"},
  {"test": "Lasts five years or more", "shown": 2, "fixed": 6, "why": "Bottles buried in mortar and kept out of the sun"},
  {"test": "Cost against a kit pool", "shown": 7, "fixed": 5, "why": "Bottles are free; cement, steel, liner and labor are not"},
  {"test": "Legal and safe to fill", "shown": 1, "fixed": 7, "why": "Permit, barrier fence and an engineer's look make it defensible"},
  {"test": "Doable by one handy person", "shown": 3, "fixed": 6, "why": "Thousands of bottles to collect; plastering needs help"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "Ferrocement water tanks (poster P064)", "outlet": "WEDC, Loughborough University", "url": "https://wedc-knowledge.lboro.ac.uk/resources/posters/P064_Ferrocement_water_tanks.pdf"},
  {"n": 2, "title": "Bottle Bricks", "outlet": "Engineering for Change", "url": "https://www.engineeringforchange.org/solutions/product/bottle-bricks/"},
  {"n": 3, "title": "Application of concrete encased ecobrick blocks in the UK's construction industry", "outlet": "Liverpool John Moores University", "url": "https://researchonline.ljmu.ac.uk/18681/8/Application%20of%20concrete%20encased%20ecobrick%20blocks%20in%20the%20UK%E2%80%99s%20construction%20industry.pdf"},
  {"n": 4, "title": "Ferrocement water tank case study", "outlet": "Navrachana University", "url": "https://nuv.ac.in/wp-content/uploads/2_ENGG_1_Case-Study.pdf"},
  {"n": 5, "title": "How thick is pool plaster?", "outlet": "Pool Research", "url": "https://poolresearch.com/plaster-thickness/"},
  {"n": 6, "title": "My Self-Build Ferrocement Pool", "outlet": "Trouble Free Pool", "url": "https://www.troublefreepool.com/threads/my-self-build-ferrocement-pool.27343"},
  {"n": 7, "title": "Plastic bottle walls", "outlet": "Natural Building Blog", "url": "https://naturalbuildingblog.com/?p=4164"}],
 "kit": {"summary": "A round pool with a concrete ring footing, a steel-hooped ferrocement wall around a core of packed bottles, and a vinyl liner.",
  "options": opts,
  "metrics": [
   {"key": "gallons", "label": "Water", "unit": "gallons", "note": "at the chosen depth"},
   {"key": "water_tons", "label": "Weight of water", "unit": "tons", "note": "sitting on the floor bed"},
   {"key": "hoop_lb_per_ft", "label": "Ring tension at the base", "unit": "lb per ft", "note": "per foot of wall height; the steel hoops carry it"},
   {"key": "floor_psf", "label": "Pressure on the floor", "unit": "lb per sq ft", "note": "at the deepest point"},
   {"key": "bottles", "label": "Bottles to collect", "unit": "bottles", "note": "half-liter, packed solid"},
   {"key": "wall_height_in", "label": "Wall height", "unit": "in", "note": "with 6 in of freeboard"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Permit and engineer", "start": 0, "days": 14, "gate": "Permit issued; engineer signed off on the footing and steel"},
   {"phase": "Collect and pack bottles", "start": 0, "days": 40, "gate": "Every bottle packed solid; none crush underfoot"},
   {"phase": "Footing", "start": 14, "days": 10, "gate": "Ring level within half an inch; cured 7 days before loading"},
   {"phase": "Steel cage and bottle core", "start": 40, "days": 4, "gate": "Hoops at spacing; core tied through every 8 in"},
   {"phase": "Plaster and damp cure", "start": 44, "days": 9, "gate": "Skins at least 1 in each face; kept damp 7 days"},
   {"phase": "Floor and liner", "start": 53, "days": 2, "gate": "Inner face smooth; no wire or bottle edge touches the liner"},
   {"phase": "Staged fill test", "start": 55, "days": 6, "gate": "About 6 in a day; no new cracks or bulge; drain if anything moves"},
   {"phase": "Barrier and equipment", "start": 61, "days": 2, "gate": "Fence and self-closing gate pass inspection before the first swim"}],
  "assumptions": "Loads use water at 62.4 lb per cubic foot and 6 in of freeboard. Quantities include 10-15% waste; prices are rough US ranges for late 2026, not quotes. Not an engineered design."}}
out = os.path.join(os.path.dirname(__file__), '..', 'builds', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
