# Builds the bottle garden tower Reel Check from its text and its numbers.
import json, math, os
L_PER_GAL = 3.785; L_PER_CUFT = 28.317
WET_PCF = 40          # peat-perlite mix, fully watered, lb per cubic foot (Perlite Institute)
FILL_L = 1.8          # mix in one cut 2 L bottle, liters
AVAIL = 0.20          # share of mix volume a plant can draw on between waterings (rough, for a peat-perlite mix)
USE_L = 0.3           # summer water use of one small plant per day, liters (strawberry 0.2-0.4 L, Univ. of Arizona)
POT_GAL = 3           # ground-level pots, as in the UF/IFAS design
DRAIN = 0.30          # extra water run through so salts wash down and out
body = open(os.path.join(os.path.dirname(__file__), 'bottle-garden-tower.md'), encoding='utf-8').read()

# The reel's column: 8 bottles, nested neck into base, filled by hand from the top.
reel_avail = FILL_L * AVAIL
reel_days = reel_avail / USE_L

opts = [{"key": "towers", "label": "Towers", "unit": "posts", "values": [1, 2, 3, 4], "default": 2},
        {"key": "levels", "label": "Levels per tower", "unit": "levels", "values": [3, 4, 5], "default": 4}]
configs, mats = [], []
for t in opts[0]['values']:
    for lv in opts[1]['values']:
        bottles = 4 * lv * t
        sites = bottles + 4 * t
        mix_gal = (bottles * FILL_L) / L_PER_GAL + 4 * t * POT_GAL
        hang_lb = lv * 4 * FILL_L / L_PER_CUFT * WET_PCF + lv * 4 * 0.12   # mix plus bottles on one post
        water_gal = (bottles * USE_L + 4 * t * 1.0) * (1 + DRAIN) / L_PER_GAL
        post_ft = 8 if lv <= 4 else 10
        configs.append({"towers": t, "levels": lv, "plant_sites": sites, "mix_gal": round(mix_gal),
                        "water_gal_day": round(water_gal, 1), "hanging_lb": round(hang_lb), "post_ft": post_ft})
        bags = math.ceil(mix_gal * 1.1 / 11.2)          # a 1.5 cu ft bag holds about 11.2 gal
        for item, q, u, lo, hi in [
            ("2-liter bottles, rinsed, bottoms cut off", bottles, "bottles", 0, 0),
            (f"Pressure-treated 4x4 post, {post_ft} ft", t, "posts", 2.2 * post_ft, 3.4 * post_ft),
            ("Fast-setting concrete, 50 lb bags (two per post)", 2 * t, "bags", 6, 8),
            ("Potting mix, 1.5 cu ft bags", bags, "bags", 10, 16),
            ("3-gallon nursery pots for the base ring", 4 * t, "pots", 3, 7),
            ("Opaque spray paint, light color (one can per 8 bottles)", math.ceil(bottles / 8), "cans", 6, 9),
            ("1-inch PVC pipe, 10 ft (cut into 6-inch drain sleeves)", math.ceil(bottles * 0.5 / 10), "sticks", 5, 8),
            ("Drip kit per tower: tubing, 4 emitters, fittings", t, "kits", 25, 45),
            ("Battery hose timer", 1, "each", 30, 60),
            ("Exterior screws and washers", 1, "box", 8, 14),
            ("Slow-release fertilizer", 1, "bag", 10, 18)]:
            mats.append({"towers": t, "levels": lv, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})

b = {
 "id": "2026-11-04-bottle-garden-tower", "publish": "2026-11-04", "written": "2026-11-02T21:46:33-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Garden",
 "title": "The soda-bottle garden tower: can a column of bottles feed you?",
 "dek": "A stack of cut plastic bottles on a fence, bursting with lettuce and strawberries, is a feed favorite; as shown it would dry out by afternoon, but a post-mounted, drip-fed version is a proven extension design.",
 "reel": "Dozens of clear 2-liter bottles are cut, filled with soil and nested neck-down into one another in columns on a sunny fence. A single pour of water at the top trickles through every bottle, and a time-lapse shows lettuce, strawberries and even tomatoes spilling out of the openings.",
 "verdict": {"shown": 3, "fixed": 7, "line": "As filmed the bottles hold about a day of water and cook in the sun; painted, post-mounted and drip-fed, the tower is a real, cheap garden."},
 "scores": [
  {"test": "Enough root room and water", "shown": 2, "fixed": 6, "why": "About 1.8 L of mix per bottle; a timer and drip emitters make up for the small volume"},
  {"test": "Roots survive summer sun", "shown": 2, "fixed": 7, "why": "Clear plastic heats and grows algae; light paint and afternoon shade fix most of it"},
  {"test": "Even watering top to bottom", "shown": 3, "fixed": 7, "why": "One pour soaks the top and starves the bottom; four emitters per tower spread it"},
  {"test": "Right crops for the space", "shown": 2, "fixed": 8, "why": "Tomatoes cannot live in a bottle; lettuce, herbs and strawberries can"},
  {"test": "Cost", "shown": 9, "fixed": 8, "why": "Bottles are free; a post, mix, paint and a drip kit run well under $100 a tower"},
  {"test": "Doable by one handy person", "shown": 8, "fixed": 8, "why": "An afternoon per tower, plus setting the post"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "Building a Low-Cost Vertical Soilless System for Production of Small Vegetable and Fruit Crops (HS1186)", "outlet": "UF/IFAS Extension", "url": "https://journals.flvc.org/edis/article/download/118829/116753/174453"},
  {"n": 2, "title": "How to Grow Fruits, Vegetables, Herbs in Container Gardens", "outlet": "University of Illinois Extension", "url": "https://extension.illinois.edu/sites/default/files/how_to_grow_fruits_vegetables_herbs_in_containers.pdf"},
  {"n": 3, "title": "Hot Pots - What?!?", "outlet": "N.C. Cooperative Extension, Swain County Center", "url": "https://swain.ces.ncsu.edu/news/hot-pots-what"},
  {"n": 4, "title": "Container Soils and Soilless Media", "outlet": "North Carolina Agricultural Extension Service", "url": "https://nurserycrops.ces.ncsu.edu/wp-content/uploads/2017/11/container-soils-and-soiless-media-Bilderback-1982-great-article.pdf?fwd=no"},
  {"n": 5, "title": "Hydroponic Strawberry Irrigation", "outlet": "University of Arizona CALES", "url": "https://cales.arizona.edu/strawberry/Hydroponic_Strawberry_Information_Website/Irrigation.html"},
  {"n": 6, "title": "Effects of storage time and temperature on the antimony and some trace element release from PET into bottled drinking water", "outlet": "Journal of Environmental Health Science and Engineering", "url": "https://link.springer.com/article/10.1186/s40201-014-0133-3"},
  {"n": 7, "title": "Roof Gardens that are Gentle on the Roof", "outlet": "Perlite Institute", "url": "https://www.perlite.org/roof-gardens-that-are-gentle-on-the-roof/"}],
 "kit": {"summary": "One to four 4x4 posts, each hung with painted, cut 2-liter bottles on three to five levels over a ring of 3-gallon pots, watered by drip emitters on a timer.",
  "options": opts,
  "metrics": [
   {"key": "plant_sites", "label": "Plant sites", "unit": "plants", "note": "bottles plus the base ring of pots"},
   {"key": "mix_gal", "label": "Potting mix", "unit": "gallons", "note": "bottles and base pots together"},
   {"key": "water_gal_day", "label": "Water on a hot day", "unit": "gallons", "note": "with 30% run through to flush salts"},
   {"key": "hanging_lb", "label": "Wet load on each post", "unit": "lb", "note": "bottles only; base pots sit on the ground"},
   {"key": "post_ft", "label": "Post length", "unit": "ft", "note": "2 ft goes in the ground"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Collect bottles and pick the spot", "start": 0, "days": 14, "gate": "Every bottle rinsed; spot gets 6+ hours of sun and has a hose bib within reach; 811 called"},
   {"phase": "Set the posts", "start": 7, "days": 2, "gate": "Posts plumb, 2 ft deep in concrete, cured 24 hours before loading"},
   {"phase": "Cut and paint bottles", "start": 9, "days": 2, "gate": "Bottoms cut with a hanging tab; two coats of light opaque paint, no light shows through"},
   {"phase": "Hang bottles and fit drain sleeves", "start": 11, "days": 1, "gate": "Each bottle neck sits over the one below with a 6-inch PVC sleeve; screws through tabs into the post"},
   {"phase": "Plumb the drip line and timer", "start": 12, "days": 1, "gate": "All four emitters run; water reaches the base pots within 10 minutes of a cycle"},
   {"phase": "Fill, soak and plant", "start": 13, "days": 1, "gate": "Mix saturated before planting; greens and strawberries up top, salt-tolerant crops in the base pots"},
   {"phase": "Two-week tune-up", "start": 14, "days": 14, "gate": "Finger test each level daily; adjust timer until no bottle is dry by evening and the base is not soggy"}],
  "assumptions": "Water use assumes small plants at about 0.3 L a day in summer and 1 L a day per base pot, plus 30% drainage; wet mix at 40 lb per cubic foot. Prices are rough US retail ranges for late 2026, not quotes."}}
out = os.path.join(os.path.dirname(__file__), '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('reel bottle: available water %.2f L = %.1f days at %.1f L/day' % (reel_avail, reel_days, USE_L))
print({k: v for k, v in configs[4].items()})
