# Builds the natural swimming pond (Reel Check) from its text and its numbers.
import json, math, os
GAL = 7.48; M3 = 35.31          # gallons and cubic feet per cubic meter
P_BATHER = 100                  # mg phosphorus per bather per day (IOB design basis)
here = os.path.dirname(__file__)
body = open(os.path.join(here, 'natural-swim-pond.md'), encoding='utf-8').read()

opts = [{"key": "swim_sqft", "label": "Swim zone", "unit": "sq ft", "values": [150, 250, 400, 600], "default": 250},
        {"key": "depth_ft", "label": "Swim depth", "unit": "ft", "values": [5, 6.5, 8], "default": 6.5}]
configs, mats = [], []
for a in opts[0]['values']:
    for d in opts[1]['values']:
        regen = a                                    # plant zone at least equal to swim zone: half the water surface
        total = a + regen
        swim_cf = a * d * 0.8                        # walls batter in; roughly 80% of a straight box
        regen_cf = regen * 1.0                       # plant shelf averages about a foot of water
        gravel_cf = regen * 1.5                      # gravel and substrate bed under the plants
        cf = swim_cf + regen_cf
        gal = cf * GAL; m3 = cf / M3
        bathers = max(1, math.floor(m3 / 10))        # IOB: 2 m3 gravel per 10 m3 water per bather
        gpm = gal / (12 * 60)                        # whole volume through the plants every 12 hours
        # phosphorus: one day's input from all design bathers, spread through the water, in micrograms per liter
        p_ugl = bathers * P_BATHER * 1000 / (m3 * 1000)
        side = math.sqrt(total)
        liner = math.ceil((total + 4 * side * d * 0.9 + 4 * side * 2) * 1.1)
        dig_cy = math.ceil((swim_cf / 0.8 * 0.9 + regen * 2.5) / 27 * 1.15)
        configs.append({"swim_sqft": a, "depth_ft": d, "total_sqft": total, "gallons": round(gal, -1),
                        "bathers_per_day": bathers, "pump_gpm": round(gpm), "party_p_ug_per_l": round(10 * P_BATHER * 1000 / (m3 * 1000), 1),
                        "dig_cy": dig_cy})
        gravel_t = math.ceil(gravel_cf / 27 * 1.4 * 1.1)
        plants = math.ceil(regen / 2)
        for item, q, u, lo, hi in [
            ("Excavator rental with operator, or haul-off", dig_cy, "cu yd", 15, 40),
            ("EPDM pond liner, 45 mil", liner, "sq ft", 0.9, 1.6),
            ("Non-woven underlayment, both sides of the liner", liner * 2, "sq ft", 0.25, 0.5),
            ("Washed gravel and low-phosphorus substrate for the plant bed", gravel_t, "tons", 45, 90),
            ("Separating wall: concrete block, sand-set, under the liner", math.ceil(4 * math.sqrt(a)), "linear ft", 25, 55),
            ("Native aquatic plants, about one per 2 sq ft", plants, "plants", 8, 20),
            ("Low-energy circulation pump", 1, "each", 300, 900),
            ("Surface skimmer and buried flexible PVC", 1, "lot", 250, 800),
            ("Aerator and diffuser", 1, "each", 400, 1200),
            ("Electrician: GFCI circuit and bonding", 1, "each", 600, 1800),
            ("Barrier fence and self-closing gate", math.ceil(4 * math.sqrt(total) + 20), "linear ft", 25, 60),
            ("Phosphorus and bacteria test kits, first year", 1, "lot", 80, 250),
            ("Permit (pool or pond, depending on the town)", 1, "each", 100, 1500)]:
            mats.append({"swim_sqft": a, "depth_ft": d, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})

b = {
 "id": "2026-11-08-natural-swim-pond", "publish": "2026-11-08", "written": "2026-11-02T21:25:28-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Water",
 "title": "The chlorine-free swimming pond: do plants really keep it clean?",
 "dek": "Reels show a backyard hole turned into a crystal-clear plant-filtered pond in a weekend; the idea is sound, but only with a plant zone as big as the swim zone, a sealed liner and a season or two of patience.",
 "reel": "A backyard is dug out, lined, edged with stone and ringed with potted reeds and lilies. Days later the water is gin-clear and a family swims with no chlorine and no filter. Sizing, a pump, testing and the months of green water in between never appear.",
 "verdict": {"shown": 3, "fixed": 7, "line": "As filmed it is a garden pond that will turn green; sized and built right, a plant-filtered pond is a proven way to swim without chlorine."},
 "scores": [
  {"test": "Water stays clear", "shown": 2, "fixed": 7, "why": "A token ring of pots cannot strip phosphorus; a plant zone equal to the swim zone, with a low-P bed and a pump, can"},
  {"test": "Safe to swim, bacteria", "shown": 3, "fixed": 6, "why": "No disinfectant either way; limits on bathers, bird control and testing keep risk low but not zero"},
  {"test": "Holds water", "shown": 4, "fixed": 8, "why": "A liner appears, unprotected; a padded EPDM liner on a smooth bed lasts decades"},
  {"test": "Drowning and edge safety", "shown": 2, "fixed": 7, "why": "Dark deep water with no barrier; a fence, a shallow shelf and an exit ladder fix it"},
  {"test": "Cost against a chlorine pool", "shown": 7, "fixed": 7, "why": "A self-built pond costs far less than a pro build and runs on one small pump"},
  {"test": "Doable by one handy person", "shown": 4, "fixed": 6, "why": "Hire the excavator; lining and planting are a weekend crew job"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "How to build a natural swimming pool", "outlet": "Mother Earth News", "url": "https://www.motherearthnews.com/diy/natural-swimming-pool-zmaz02aszgoe/?page=2"},
  {"n": 2, "title": "Natural swimming ponds: FLL water quality values", "outlet": "Lovibond", "url": "https://lovibond.com/water-testing/support-service/knowledge-base/pool/natural-swimming-ponds"},
  {"n": 3, "title": "Comparing vegetation and substrate performances on nutrient removal and biomass establishment using a natural swimming pool experiment", "outlet": "HortTechnology (via DOAJ)", "url": "https://doaj.org/article/703ea2bfa624477b88ab24974d51e43f"},
  {"n": 4, "title": "Developing the formulas (biofilter design for swimming ponds)", "outlet": "International Organization for Natural Bathing Waters (IOB)", "url": "https://data.iob-ev.com/wp-content/uploads/participants-database/Wesner_Jaksch_developing the formulas.pdf"},
  {"n": 5, "title": "Faecal contamination in natural pools due to droppings from birds", "outlet": "ScienceDaily", "url": "https://www.sciencedaily.com/releases/2013/08/130808092053.htm"},
  {"n": 6, "title": "Pathogen performance testing of a natural swimming pool using a cocktail of microbiological surrogates and QMRA-derived management goals", "outlet": "Journal of Water and Health (via Karl Landsteiner University)", "url": "https://kris.kl.ac.at/de/publications/pathogen-performance-testing-of-a-natural-swimming-pool-using-a-c/"},
  {"n": 7, "title": "North America's first natural swimming pool battles summer closures", "outlet": "Earth.com", "url": "https://earth.com/news/first-natural-swimming-pool-closures"},
  {"n": 8, "title": "How much does a natural pool cost to build?", "outlet": "Angi", "url": "https://www.angi.com/articles/natural-pool-cost.htm"}],
 "kit": {"summary": "A lined swimming pond with a planted regeneration zone as large as the swim zone, a low-phosphorus gravel bed, a small pump turning the water over every 12 hours, and a barrier fence.",
  "options": opts,
  "metrics": [
   {"key": "total_sqft", "label": "Water surface", "unit": "sq ft", "note": "swim zone plus an equal plant zone"},
   {"key": "gallons", "label": "Water", "unit": "gallons", "note": "filled once, topped up after"},
   {"key": "bathers_per_day", "label": "Design bathers", "unit": "per day", "note": "one per 10 cubic meters of water"},
   {"key": "pump_gpm", "label": "Pump flow", "unit": "gpm", "note": "all the water through the plants every 12 hours"},
   {"key": "party_p_ug_per_l", "label": "Phosphorus from a 10-swimmer party", "unit": "µg per liter", "note": "in one day; the clear-water target is under 10 in total"},
   {"key": "dig_cy", "label": "Soil to dig", "unit": "cu yd", "note": "with swell"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Rules, site and design", "start": 0, "days": 21, "gate": "Town says what it counts as and what barrier it needs; site is sunny, level and away from lawn runoff and trees"},
   {"phase": "Excavation", "start": 21, "days": 4, "gate": "811 called; swim zone and plant shelf cut to plan; separating wall top level within an inch"},
   {"phase": "Separating wall and plumbing", "start": 25, "days": 5, "gate": "Wall sits an inch below the waterline all round; pipes pressure-tested before burial"},
   {"phase": "Underlayment and liner", "start": 30, "days": 3, "gate": "No rock or root under the liner; seams taped and checked"},
   {"phase": "Substrate and planting", "start": 33, "days": 5, "gate": "Low-phosphorus gravel only, no topsoil or compost; plants rinsed of potting soil"},
   {"phase": "Fill and first test", "start": 38, "days": 7, "gate": "Fill water tested for phosphorus; pump and aerator running on a GFCI circuit"},
   {"phase": "Barrier fence", "start": 45, "days": 5, "gate": "Fence and self-closing gate up and inspected before anyone swims"},
   {"phase": "First season: settle and test", "start": 50, "days": 120, "gate": "Expect green water; swim only after E. coli and enterococci tests come back under the guide values"}],
  "assumptions": "Volumes assume battered swim-zone walls and a plant shelf averaging 1 ft deep; bather loads use 100 mg phosphorus per bather-day and one bather per 10 cubic meters. Quantities include about 10-15% waste; prices are rough US ranges for late 2026, not quotes."}}
out = os.path.join(here, '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for c in configs: print(c)
sel = [m for m in mats if m['swim_sqft'] == 250 and m['depth_ft'] == 6.5]
print(sum(m['low'] for m in sel), sum(m['high'] for m in sel))
