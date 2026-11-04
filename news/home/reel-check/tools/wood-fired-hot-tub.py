# Builds the wood-fired stock-tank hot tub (Reel Check) from its text and its numbers.
import json, math, os
G = 62.4; LB_GAL = 8.34; WOOD_BTU = 6900; HEATER_BTU_HR = 30000; EFF = 0.5
T_COLD = 50; T_SOAK = 102; SOAKERS = 4; PERSON_LB = 180
body = open(os.path.join(os.path.dirname(__file__), 'wood-fired-hot-tub.md'), encoding='utf-8').read()
opts = [{"key": "diameter_ft", "label": "Tank diameter", "unit": "ft", "values": [6, 8, 10], "default": 6},
        {"key": "fill_in", "label": "Water depth", "unit": "in", "values": [16, 18, 20], "default": 18}]
TANK = {6: (300, 450), 8: (450, 650), 10: (650, 950)}
configs, mats = [], []
for d in opts[0]['values']:
    for f in opts[1]['values']:
        area = math.pi * (d / 2) ** 2; vol = area * f / 12; gal = vol * 7.48
        heat = gal * LB_GAL * (T_SOAK - T_COLD)                    # BTU to lift the fill from 50 F to 102 F
        hours = heat / HEATER_BTU_HR                               # heater delivers ~30,000 BTU/hr into the water
        wood = heat / (WOOD_BTU * EFF)                             # dry wood at ~6,900 BTU/lb, half reaches the water
        pad_psf = (vol * G + SOAKERS * PERSON_LB + 150) / area     # water + 4 soakers + tank on a full pad
        configs.append({"diameter_ft": d, "fill_in": f, "gallons": round(gal), "heat_kbtu": round(heat / 1000),
                        "hours": round(hours, 1), "wood_lb": round(wood), "pad_psf": round(pad_psf)})
        pad_sqft = (d + 2) ** 2
        gravel_cy = round(pad_sqft * (4 / 12) / 27 * 1.15, 1)
        pavers = math.ceil(pad_sqft / (16 * 16 / 144) * 1.05)
        foam = math.ceil(area * 1.15 / 32)
        tank_lo, tank_hi = TANK[d]
        for item, q, u, lo, hi in [
            ("Galvanized round stock tank, 2 ft tall", 1, "each", tank_lo, tank_hi),
            ("Wood-fired tub heater with water jacket and flue", 1, "each", 900, 1800),
            ("Stainless bulkhead fittings and 2 in hoses", 1, "set", 80, 180),
            ("Firebrick for the stove hearth", 30, "bricks", 3, 5),
            ("Crushed stone for the pad, 4 in deep", gravel_cy, "cu yd", 50, 90),
            ("16 in concrete pavers for the pad", pavers, "each", 3, 5),
            ("Rigid foam for an insulated lid, 4 x 8 sheets", foam, "sheets", 35, 60),
            ("Floating thermometer and test strips", 1, "set", 25, 50),
            ("Bromine tablets and floater, one season", 1, "lot", 40, 90),
            ("Wooden seat and floor grate", 1, "each", 40, 120),
            ("Fire extinguisher, 2A:10B:C", 1, "each", 40, 70),
            ("Dry firewood, a season of weekly soaks", round(wood * 26 / 3000, 2), "cords", 250, 450),
            ("Local burn-rule check or permit", 1, "each", 0, 75)]:
            mats.append({"diameter_ft": d, "fill_in": f, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})
b = {
 "id": "2026-11-06-wood-fired-hot-tub", "publish": "2026-11-06", "written": os.environ.get("WRITTEN", "2026-11-02T21:40:00-05:00"),
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Outdoor living",
 "title": "The cinder block hot tub: can a fire under a stock tank make a spa?",
 "dek": "A steel stock tank perched on a ring of cinder blocks with a fire roaring underneath makes a cozy reel; built that way it scorches, sags and overheats, but a tank with a side-mounted heater works.",
 "reel": "A galvanized stock tank is set on a ring of stacked cinder blocks with an open fire box under its floor, or beside it with a coil of copper pipe in the flames. The fire is lit at dusk and the builder is soon soaking in steaming water. No thermometer, no hearth and no support under the tank floor ever appears.",
 "verdict": {"shown": 2, "fixed": 7, "line": "As filmed it is a cooking pot with people in it; on a full pad with a side heater and a thermometer, it is a fine soak."},
 "scores": [
  {"test": "Holds the water and the bathers", "shown": 2, "fixed": 9, "why": "A thin tank floor bridging a fire box sags under 3 tons; a full gravel pad carries it"},
  {"test": "Heats in a sensible time", "shown": 6, "fixed": 7, "why": "Wood can supply the heat; a water jacket delivers it far better than a bare coil"},
  {"test": "No burns or scalding", "shown": 1, "fixed": 7, "why": "A fire under the floor makes the seat a griddle; a side heater keeps flame away from skin"},
  {"test": "Safe water temperature", "shown": 2, "fixed": 7, "why": "No thermostat on a wood fire; a thermometer, stirring and a 104 F ceiling fix that"},
  {"test": "Fire and materials hold up", "shown": 2, "fixed": 7, "why": "Wet blocks spall and zinc peels above 390 F; firebrick and a jacketed stove do not"},
  {"test": "Cost against a store hot tub", "shown": 8, "fixed": 7, "why": "Still well under the price of a plug-in spa, with no electric bill"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "CPSC Warns Of Hot Tub Temperatures", "outlet": "U.S. Consumer Product Safety Commission", "url": "https://www.cpsc.gov/Newsroom/News-Releases/1980/CPSC-Warns-Of-Hot-Tub-Temperatures"},
  {"n": 2, "title": "Galvanized Steel's Performance in Extreme Temperatures", "outlet": "American Galvanizers Association", "url": "https://galvanizeit.org/knowledgebase/article/galvanized-steel-s-performance-in-extreme-temperatures"},
  {"n": 3, "title": "Chofu Wood-Fired Hot Tub", "outlet": "Make:", "url": "https://makezine.com/article/home/chofu-wood-fired-hot-tub/"},
  {"n": 4, "title": "Country Lore: Wood-Fired Hot Tub", "outlet": "Mother Earth News", "url": "https://www.motherearthnews.com/diy/country-lore-wood-fired-hot-tub-zmaz05djzsel/"},
  {"n": 5, "title": "Wood Heating", "outlet": "Utah State University Extension", "url": "https://extension.usu.edu/forestry/resources/forest-products/wood-heating.php"},
  {"n": 6, "title": "Preventing Hot Tub Rash", "outlet": "Centers for Disease Control and Prevention", "url": "https://www.cdc.gov/healthy-swimming/prevention/preventing-hot-tub-rash.html"},
  {"n": 7, "title": "Can Cinder Blocks Withstand Fire?", "outlet": "EngineerFix", "url": "https://engineerfix.com/can-cinder-blocks-withstand-fire/"},
  {"n": 8, "title": "Behlen 8-Foot Galvanized Round Tank", "outlet": "D&B Supply", "url": "https://www.dbsupply.com/behlen-8-foot-galvanized-round-tank.html"},
  {"n": 9, "title": "How to Create a Wood Fired Stock Tank Pool", "outlet": "StockTankPool.net", "url": "https://www.stocktankpool.net/wood-fired-hot-tub"}],
 "kit": {"summary": "A galvanized round stock tank on a full gravel-and-paver pad, heated by a side-mounted wood stove with a water jacket on a firebrick hearth, with a thermometer, an insulated lid and bromine.",
  "options": opts,
  "metrics": [
   {"key": "gallons", "label": "Water", "unit": "gallons", "note": "at the chosen depth"},
   {"key": "heat_kbtu", "label": "Heat to warm it", "unit": "thousand BTU", "note": "from 50 F tap water to 102 F"},
   {"key": "hours", "label": "Time to heat", "unit": "hours", "note": "at about 30,000 BTU an hour into the water, lid on"},
   {"key": "wood_lb", "label": "Dry wood per soak", "unit": "lb", "note": "if half the fire's heat reaches the water"},
   {"key": "pad_psf", "label": "Load on the pad", "unit": "lb per sq ft", "note": "water, tank and four adults"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Check rules and pick the spot", "start": 0, "days": 3, "gate": "Burn rules allow it; site is level, 10 ft from structures and overhangs"},
   {"phase": "Gravel and paver pad", "start": 3, "days": 2, "gate": "Pad level within 1/4 in across the tank; compacted, no soft spots"},
   {"phase": "Set tank and fit plumbing", "start": 5, "days": 1, "gate": "Bulkheads sealed; leak test full of cold water for 24 hours"},
   {"phase": "Hearth and heater", "start": 6, "days": 2, "gate": "Stove on firebrick, flue above head height, jacket full of water before any fire"},
   {"phase": "First firing, no bathers", "start": 8, "days": 1, "gate": "Water circulates; temperature logged hourly; stays under 104 F with stirring"},
   {"phase": "Lid, seat and water care", "start": 9, "days": 2, "gate": "Seat grate in, lid fits, bromine reading 4-8 ppm before the first soak"}],
  "assumptions": "Heat assumes 50 F fill water, a covered tank, dry wood at about 6,900 BTU per pound and half of it reaching the water; real times swing with wind and lid. Quantities include 5-15% waste; prices are rough US ranges for late 2026, not quotes."}}
out = os.path.join(os.path.dirname(__file__), '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print({c["diameter_ft"]: c for c in configs if c["fill_in"] == 18})
