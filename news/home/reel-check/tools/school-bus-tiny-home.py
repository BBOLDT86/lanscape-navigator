# Builds the school bus tiny home ("skoolie", Reel Check) from its text and its numbers.
import json, math, os
here = os.path.dirname(__file__)
body = open(os.path.join(here, 'school-bus-tiny-home.md'), encoding='utf-8').read()

WATER = 8.34       # lb per gallon
# typical buses: length ft -> (type, curb lb with seats, GVWR lb, seats, interior length ft, roof area sq ft for solar)
BUS = {22: ("Type A, cutaway van chassis", 10000, 14500, 4, 13, 60),
       30: ("Type C, conventional", 14000, 25500, 8, 20, 110),
       35: ("Type C, conventional", 15500, 29000, 10, 25, 140),
       40: ("Type D, transit", 18500, 33000, 12, 30, 170)}
SEAT_LB = 110      # a bench seat with its frame
BUILD_FT = 260     # lb per ft of interior: subfloor, insulation, walls, cabinets, bed, appliances, wiring
FIXED = 900        # batteries, inverter, solar panels and racks, water heater, propane tank
PEOPLE = 1000      # two adults, a child, a dog, clothes, tools, food

opts = [{"key": "length_ft", "label": "Bus length", "unit": "ft", "values": [22, 30, 35, 40], "default": 35},
        {"key": "water_gal", "label": "Fresh water tank", "unit": "gal", "values": [30, 60, 100], "default": 60}]
configs, mats = [], []
for L in opts[0]['values']:
    kind, curb, gvwr, seats, inside, roof = BUS[L]
    for g in opts[1]['values']:
        stripped = curb - seats * SEAT_LB - 300                      # seats out, plus heater cores, rubber floor
        build = BUILD_FT * inside + FIXED
        water = g * WATER + g * 0.8 * WATER                          # fresh tank full plus a grey tank 80% full
        loaded = stripped + build + water + PEOPLE
        margin = gvwr - loaded
        solar_w = (roof // 18) * 400                                 # one 400 W panel per 18 sq ft of usable roof
        configs.append({"length_ft": L, "water_gal": g, "living_ft": inside, "build_lb": round(build),
                        "loaded_lb": round(loaded), "gvwr_lb": gvwr, "margin_lb": round(margin),
                        "solar_w": solar_w})
        floor = inside * 7.5
        wall = inside * 2 * 4.5 + 2 * 7.5 * 6
        for item, q, u, lo, hi in [
            ("Retired school bus, inspected, with records", 1, "each", {22: 6000, 30: 7000, 35: 8000, 40: 9000}[L], {22: 14000, 30: 16000, 35: 18000, 40: 22000}[L]),
            ("Rust repair, floor patching, rust converter", floor, "sq ft", 2, 8),
            ("Subfloor and rigid foam under it", floor, "sq ft", 4, 7),
            ("Wall and ceiling insulation, closed-cell or rigid foam", wall + floor, "sq ft", 2, 5),
            ("Walls, ceiling, cabinets, bed and furniture", inside, "ft of bus", 350, 900),
            ("Battery bank, inverter-charger, shore inlet, wiring by an electrician", 1, "set", 4000, 12000),
            (f"Solar panels and charge controller, {solar_w} W", solar_w, "W", 1.2, 2.5),
            (f"Fresh tank {g} gal, grey tank, pump, water heater, plumbing", 1, "set", 900 + 6 * g, 2500 + 12 * g),
            ("Composting toilet", 1, "each", 900, 2200),
            ("Vented propane furnace or diesel heater; no unvented heaters", 1, "each", 900, 2500),
            ("Propane tank in a vented outside locker, regulator, leak test", 1, "set", 500, 1500),
            ("Smoke, CO and propane alarms; two fire extinguishers", 1, "set", 150, 400),
            ("Tires, brakes and safety inspection; scale ticket", 1, "lot", 1500, 6000),
            ("Paint over school bus yellow, retitle as motorhome, RV insurance", 1, "lot", 1000, 5000)]:
            mats.append({"length_ft": L, "water_gal": g, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})

for c in configs: print(c)
tot = {}
for m in mats:
    k = (m['length_ft'], m['water_gal']); tot.setdefault(k, [0, 0]); tot[k][0] += m['low']; tot[k][1] += m['high']
print(tot)

b = {
 "id": "2026-11-25-school-bus-tiny-home", "publish": "2026-11-25", "written": "2026-11-02T21:40:00-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Shelter",
 "title": "The school bus tiny home is real, but it is a truck before it is a house",
 "dek": "Bus-to-home reels make it look like a few weekends and a can of paint; the conversion is doable, but weight, propane, wiring and the road decide whether it is safe to live in.",
 "reel": "A yellow school bus is stripped of its seats in fast cuts, insulated, paneled in pale wood and fitted with a kitchen, a wood stove and a loft bed, then painted and driven off toward mountains. The time-lapse suggests a few weeks of work. No scale, rust repair, wiring diagram, propane locker or safety inspection appears.",
 "verdict": {"shown": 5, "fixed": 7, "line": "The reel's bus is mostly buildable; it skips the scale, the rust, the propane and the wiring, and those are where people get hurt."},
 "scores": [
  {"test": "Stays under its weight rating", "shown": 4, "fixed": 8, "why": "A full-size bus has margin; a short one can be overloaded with a full tank and a family"},
  {"test": "Safe heat and air", "shown": 2, "fixed": 8, "why": "An unvented stove or heater in a sealed bus kills; vented heat and alarms fix it"},
  {"test": "Electrical and fire safety", "shown": 3, "fixed": 7, "why": "Big batteries and wood interiors need fused, inspected wiring and two ways out"},
  {"test": "Road safe and legal", "shown": 4, "fixed": 7, "why": "Brakes, tires, a scale ticket and a motorhome title; some states want a special license"},
  {"test": "Livable in four seasons", "shown": 5, "fixed": 7, "why": "Insulation and rust repair make the steel box tolerable in cold and heat"},
  {"test": "Doable by one handy person", "shown": 7, "fixed": 6, "why": "Most is carpentry; months, not weeks, with an electrician for the power"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "What does your bus weigh? (approx)", "outlet": "Skoolie.net", "url": "https://www.skoolie.net/threads/what-does-your-bus-weigh-approx.659468/"},
  {"n": 2, "title": "49 CFR 571.220, school bus rollover protection", "outlet": "Cornell Law School, Legal Information Institute", "url": "https://www.law.cornell.edu/cfr/text/49/571.220"},
  {"n": 3, "title": "Motorhome conversion affidavit (form 833)", "outlet": "Alaska Division of Motor Vehicles", "url": "https://dmv.alaska.gov/media/q3fbjqpl/833.pdf"},
  {"n": 4, "title": "Do I need a CDL to drive a Class A motorhome?", "outlet": "Dirt Legal", "url": "https://dirtlegal.squarespace.com/blog/2024/11/29/do-i-need-a-cdl-to-drive-a-class-a-motorhome"},
  {"n": 5, "title": "CPSC warns of carbon monoxide poisoning with camping equipment", "outlet": "US Consumer Product Safety Commission", "url": "https://webarchive.library.unt.edu/web/20090116043101/http://www.cpsc.gov/cpscpub/pubs/5008.html"},
  {"n": 6, "title": "NFIRS data snapshot: recreational vehicle fires (2018-2020)", "outlet": "US Fire Administration", "url": "https://www.usfa.fema.gov/statistics/reports/where-fires-occur/snapshot-rv-fires.html"},
  {"n": 7, "title": "NFPA 1192, standard on recreational vehicles, 2026 edition", "outlet": "Fire-Police-EMS", "url": "https://www.fire-police-ems.com/NFPA1192-2026.shtml"}],
 "kit": {"summary": "A stripped school bus with rust repaired, insulated floor, walls and ceiling, a solar and battery system wired by an electrician, vented heat, propane kept outside, alarms, and a scale ticket and motorhome title before it moves in.",
  "options": opts,
  "metrics": [
   {"key": "margin_lb", "label": "Weight margin", "unit": "lb", "note": "under the GVWR, full water and a family aboard; negative means overloaded"},
   {"key": "loaded_lb", "label": "Loaded weight", "unit": "lb", "note": "stripped bus, build, water and people"},
   {"key": "gvwr_lb", "label": "Typical weight rating", "unit": "lb", "note": "check the sticker on your bus; axle ratings also apply"},
   {"key": "build_lb", "label": "What the build adds", "unit": "lb", "note": "floor, walls, cabinets, appliances, batteries, solar"},
   {"key": "living_ft", "label": "Living length", "unit": "ft", "note": "behind the driver's area"},
   {"key": "solar_w", "label": "Roof solar", "unit": "W", "note": "about what the roof fits, around vents and hatches"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Buy and inspect", "start": 0, "days": 21, "gate": "Mechanic's report on engine, brakes, frame and rust; GVWR and axle ratings read off the sticker"},
   {"phase": "Strip and weigh", "start": 21, "days": 10, "gate": "Seats out; bare bus weighed at a truck scale, front and rear axle"},
   {"phase": "Rust and floor", "start": 31, "days": 14, "gate": "No soft spots or holes in floor or frame; seams sealed"},
   {"phase": "Plan the weight and layout", "start": 31, "days": 14, "gate": "Weight budget leaves at least 10% margin with full water and passengers; emergency exits kept clear"},
   {"phase": "Insulate and frame", "start": 45, "days": 30, "gate": "Insulation continuous; wiring chases in place before walls close"},
   {"phase": "Power, water, heat, propane", "start": 75, "days": 30, "gate": "Every circuit fused; propane locker vented outside and leak tested; heater vented"},
   {"phase": "Interior fit-out", "start": 105, "days": 45, "gate": "Heavy items low and between the axles; cabinets bolted, not just screwed"},
   {"phase": "Safety, scale, title", "start": 150, "days": 14, "gate": "Smoke, CO and propane alarms work; loaded scale ticket under ratings; retitled as a motorhome"}],
  "assumptions": "Weights use typical curb weights and ratings for each bus size, about 110 lb per bench seat removed, 260 lb per foot of interior for the build plus 900 lb of systems, and 1,000 lb of people and gear; your bus's own sticker and scale ticket govern. Prices are rough US ranges for late 2026, not quotes."}}
out = os.path.join(here, '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
