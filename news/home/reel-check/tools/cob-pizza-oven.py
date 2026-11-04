# Builds the cob pizza oven (Reel Check) from its text and its numbers.
import json, math, os
COB_PCF = 110; LIGHT_PCF = 50; PLASTER_PCF = 110; WET_WATER = 0.18   # densities in lb per cu ft; water share of wet cob
T_MASS, T_INS, T_PL = 4, 6, 1                                       # layer thicknesses, in
body = open(os.path.join(os.path.dirname(__file__), 'cob-pizza-oven.md'), encoding='utf-8').read()
opts = [{"key": "inside_in", "label": "Inside diameter", "unit": "in", "values": [22, 27, 32, 36], "default": 27},
        {"key": "base_in", "label": "Base height", "unit": "in", "values": [24, 32, 40], "default": 32}]

def half_ellipsoid(a, c):  # cu in, a = radius, c = height
    return 2 / 3 * math.pi * a * a * c

configs, mats = [], []
for d in opts[0]['values']:
    for bh in opts[1]['values']:
        r = d / 2; h = 0.75 * d                       # dome height is 3/4 of the width
        door_h = 2 / 3 * h                             # door is 2/3 of the dome height (no chimney)
        shells = []; a, c = r, h
        for t, pcf in ((T_MASS, COB_PCF), (T_INS, LIGHT_PCF), (T_PL, PLASTER_PCF)):
            v = (half_ellipsoid(a + t, c + t) - half_ellipsoid(a, c)) / 1728
            shells.append((v, pcf)); a += t; c += t
        outer = 2 * a
        dome_lb = sum(v * p for v, p in shells)
        water_gal = dome_lb * WET_WATER / 8.34
        bricks = math.ceil(math.pi * r * r / (4.5 * 9) * 1.15) + 4
        plinth = outer + 8                              # square plinth, in
        slab_lb = (plinth / 12) ** 2 * (4 / 12) * 145
        sand_lb = (plinth / 12) ** 2 * (4 / 12) * 100
        oven_lb = dome_lb + slab_lb + sand_lb + bricks * 8.5
        blocks = math.ceil(plinth * 4 / 16) * math.ceil(bh / 8)
        configs.append({"inside_in": d, "base_in": bh, "dome_h_in": round(h, 1), "door_h_in": round(door_h, 1),
                        "dome_lb": round(dome_lb, -1), "water_gal": round(water_gal), "total_lb": round(oven_lb, -1),
                        "outer_in": round(outer)})
        clay_cf = shells[0][0] * 0.33 + shells[1][0] * 0.5 + shells[2][0] * 0.3 + 3   # +3 cu ft for mortar and repairs
        sand_t = round((shells[0][0] * 0.67 + shells[2][0] * 0.6 + (plinth / 12) ** 2 * (4 / 12)) * 100 / 2000 * 1.15
                       + 0.4, 2)                                                    # 0.4 t for the sand form
        conc_bags = math.ceil((plinth / 12) ** 2 * (4 / 12) / 0.6 * 1.1)
        gravel = round(((plinth - 16) / 12) ** 2 * (bh / 12) / 27 * 1.1, 1)
        perlite = math.ceil((plinth / 12) ** 2 * (3 / 12) / 4 * 1.1)
        straw = 2 if d <= 27 else 3
        for item, q, u, lo, hi in [
            ("8 x 8 x 16 in concrete blocks for the plinth", blocks, "each", 2, 3),
            ("Gravel to fill the plinth", gravel, "cu yd", 50, 90),
            ("Concrete for the hearth slab, 80 lb bags", conc_bags, "bags", 6.5, 8),
            ("#3 rebar for the slab, 10 ft sticks", 4, "sticks", 6, 9),
            ("Perlite for under-floor insulation, 4 cu ft bags", perlite, "bags", 30, 45),
            ("Firebrick for the oven floor, 4.5 x 9 x 1.5 in", bricks, "bricks", 3, 5),
            ("Clay soil, dug or bagged fire clay", round(clay_cf, 1), "cu ft", 0, 18),
            ("Coarse sand, for cob and the dome form", sand_t, "tons", 40, 80),
            ("Straw, small bales", straw, "bales", 8, 15),
            ("Lime or clay plaster finish", 1, "lot", 25, 60),
            ("Simple timber roof over the oven", 1, "each", 250, 700),
            ("Infrared thermometer, to 1,000 F", 1, "each", 25, 60),
            ("Fire extinguisher, 2A:10B:C", 1, "each", 40, 70)]:
            mats.append({"inside_in": d, "base_in": bh, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})
b = {
 "id": "2026-11-11-cob-pizza-oven", "publish": "2026-11-11", "written": os.environ.get("WRITTEN", "2026-11-02T22:00:00-05:00"),
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Outdoor living",
 "title": "The mud pizza oven: can you build it Saturday and bake on Sunday?",
 "dek": "Reels make a cob oven look like an afternoon of stomping mud and a same-night pizza; the oven is real, but the timeline is weeks, and it needs a base, insulation and a roof.",
 "reel": "A builder stomps clay, sand and water on a tarp, packs it over a mound of wet sand on a low stand and carves a door. The sand is scooped out, a fire is lit at once and blistered pizzas slide out the same evening. No drying time, insulation layer or roof ever appears.",
 "verdict": {"shown": 4, "fixed": 8, "line": "The oven is real and cheap; the same-day firing is not, and rain will melt it without a roof."},
 "scores": [
  {"test": "Bakes pizza at all", "shown": 6, "fixed": 9, "why": "Earth ovens have baked bread for centuries; a 4 in mass layer reaches pizza heat"},
  {"test": "Survives its first fire", "shown": 2, "fixed": 8, "why": "Wet cob fired at once steams and cracks; weeks of drying and small fires fix it"},
  {"test": "Holds heat", "shown": 3, "fixed": 8, "why": "No insulation as shown; a straw-clay layer and perlite under the floor keep heat in"},
  {"test": "Lasts outdoors", "shown": 2, "fixed": 7, "why": "Unfired clay is water soluble; a roof and plaster let it last for years"},
  {"test": "Safe to run", "shown": 4, "fixed": 8, "why": "Door ratio, clearances and an extinguisher control smoke and fire"},
  {"test": "Cost and skill", "shown": 8, "fixed": 8, "why": "Mostly dirt and labor; a few hundred dollars for the base, bricks and roof"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "How to build a cob oven in your garden with Sigi Koko, Part 1", "outlet": "Low Impact", "url": "https://www.lowimpact.org/posts/how-to-build-a-cob-oven-sigi-koko/"},
  {"n": 2, "title": "How to build a cob oven in your garden with Sigi Koko, Part 2", "outlet": "Low Impact", "url": "https://www.lowimpact.org/posts/how-to-build-a-cob-oven-sigi-koko-part-2/"},
  {"n": 3, "title": "How to Build an Earthen Oven", "outlet": "Savoring the Past", "url": "https://savoringthepast.net/2016/04/15/how-to-build-an-earthen-oven/"},
  {"n": 4, "title": "ABCs of Making Adobe Bricks (Guide G-521)", "outlet": "New Mexico State University Cooperative Extension", "url": "https://pubs.nmsu.edu/_g/G521.pdf"},
  {"n": 5, "title": "CBO-500, 750 and 1000 owner's manual", "outlet": "Chicago Brick Oven", "url": "https://cdn.shopify.com/s/files/1/2643/6080/files/CBO_UserManual_092319.pdf?939"},
  {"n": 6, "title": "Venting for residential wood-fired pizza ovens", "outlet": "Forno Bravo", "url": "https://www.fornobravo.com/blog/venting-for-residential-wood-fired-pizza-ovens/"}],
 "kit": {"summary": "A cob oven on a block plinth with a concrete hearth slab, perlite under a firebrick floor, a 4 in sand-clay mass layer, 6 in of straw-clay insulation, a plaster coat and a small roof.",
  "options": opts,
  "metrics": [
   {"key": "dome_h_in", "label": "Inside dome height", "unit": "in", "note": "three quarters of the width"},
   {"key": "door_h_in", "label": "Door height", "unit": "in", "note": "two thirds of the dome, so smoke leaves over the door"},
   {"key": "water_gal", "label": "Water to dry out", "unit": "gallons", "note": "before the first real fire"},
   {"key": "dome_lb", "label": "Weight of the dome", "unit": "lb", "note": "mass, insulation and plaster"},
   {"key": "total_lb", "label": "Load on the plinth", "unit": "lb", "note": "dome, floor, sand bed and slab"},
   {"key": "outer_in", "label": "Outside diameter", "unit": "in", "note": "plinth top must be wider than this"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Site, rules and soil test", "start": 0, "days": 3, "gate": "Spot 10 ft from buildings; jar test shows a sandy soil or you have bagged clay"},
   {"phase": "Plinth and hearth slab", "start": 3, "days": 9, "gate": "Slab level; cured 7 days before loading"},
   {"phase": "Insulated floor and firebrick", "start": 12, "days": 1, "gate": "Bricks flat with no lip a peel can catch"},
   {"phase": "Sand form and mass layer", "start": 13, "days": 1, "gate": "Form at 3/4 height; mass layer 4 in all round"},
   {"phase": "Door cut and sand out", "start": 14, "days": 4, "gate": "Door at 2/3 of dome height; dome stands on its own"},
   {"phase": "Insulation and roof", "start": 18, "days": 3, "gate": "6 in straw-clay on; roof up before any rain"},
   {"phase": "Air dry", "start": 21, "days": 21, "gate": "No dark damp patches; a pin pushed into the mass comes out dry"},
   {"phase": "Small curing fires", "start": 42, "days": 5, "gate": "Fires grow a little each day; no steam from the outside"},
   {"phase": "Plaster and first pizza", "start": 47, "days": 2, "gate": "Floor reads 650-800 F on the thermometer; cracks patched"}],
  "assumptions": "Weights use about 110 lb per cu ft for cob and plaster, 50 for straw-clay, and 18% water in fresh cob; the dome is modeled as half an ellipsoid. Quantities include 10-15% waste; prices are rough US ranges for late 2026, not quotes."}}
out = os.path.join(os.path.dirname(__file__), '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for c in configs:
    if c["base_in"] == 32: print(c)
