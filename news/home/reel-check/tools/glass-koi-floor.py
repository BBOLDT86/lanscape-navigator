# Builds the koi-pond-under-a-glass-floor Reel Check from its text and its numbers.
import datetime as dt, json, math, os
from zoneinfo import ZoneInfo
G = 62.4; GLASS = 162  # lb per cu ft
here = os.path.dirname(__file__)
body = open(os.path.join(here, 'glass-koi-floor.md'), encoding='utf-8').read()


def psat(c): return 0.61094 * math.exp(17.625 * c / (c + 243.04))
def xr(c, rh): p = psat(c) * rh; return 0.622 * p / (101.325 - p)


def evap_gal_day(area_sqft, water_f=72, room_f=70, rh=.45, air_ms=0.1):  # Engineering ToolBox pool formula
    w = (water_f - 32) / 1.8; r = (room_f - 32) / 1.8
    return (25 + 19 * air_ms) * area_sqft * 0.0929 * (xr(w, 1) - xr(r, rh)) * 24 / 3.785


# The reel's pond, for the text: a 10 x 16 ft living-room floor of glass over water 3 ft deep, on a wood-framed floor
RL, RW, RD = 16, 10, 3
rv = RL * RW * RD
glass_psf = 1.5 / 12 * GLASS  # three 1/2 in plies
reel = {"gallons": round(rv * 7.48), "water_lb": round(rv * G), "water_psf": round(G * RD),
        "shell_psf": round(G * RD + 150 * 0.5 + 150 * 0.5 * 0), "glass_lb": round(RL * RW * glass_psf),
        "over_code": round((G * RD + 75) / 40, 1), "koi": round(rv * 7.48 / 200), "evap_open": round(evap_gal_day(RL * RW), 1)}
print('reel', reel)

opts = [{"key": "glass_sqft", "label": "Glass window", "unit": "sq ft", "values": [18, 36, 54, 81], "default": 36},
        {"key": "depth_ft", "label": "Water depth", "unit": "ft", "values": [3, 3.5, 4], "default": 3.5}]
configs, mats = [], []
DIMS = {18: (6, 3), 36: (6, 6), 54: (9, 6), 81: (9, 9)}
for g in opts[0]['values']:
    gl, gw = DIMS[g]
    pl, pw = gl + 2, gw + 2  # pond runs a foot past the glass on every side, under solid floor
    panels = (gl // 3) * (gw // 3)
    for d in opts[1]['values']:
        v = pl * pw * d; gal = v * 7.48
        dig = (pl + 2) * (pw + 2) * (d + 1.5) / 27  # walls, slab and gravel, plus 1.5 ft headspace and framing
        conc = ((pl + 1) * (pw + 1) * 0.67 + 2 * (pl + pw + 2) * d * 0.67) / 27 * 1.1
        configs.append({"glass_sqft": g, "depth_ft": d, "gallons": round(gal), "water_tons": round(v * G / 2000, 1),
                        "koi": max(1, math.floor(gal / 200)), "pump_gph": round(gal * 1.5 / 100) * 100,
                        "glass_lb": round(gl * gw * glass_psf)})
        for item, q, u, lo, hi in [
            ("Structural engineer: pond shell, slab cut, glass frame", 1, "each", 1500, 4000),
            ("Building permit", 1, "each", 300, 1200),
            ("Saw-cut slab, excavate and haul, by a contractor", round(dig, 1), "cu yd", 250, 450),
            ("Reinforced concrete shell, placed by a contractor", round(conc, 1), "cu yd", 600, 1100),
            ("Pond membrane or coating, fish-safe", round(pl * pw + 2 * (pl + pw) * d), "sq ft", 4, 9),
            ("Laminated glass panels, three plies, low-iron, anti-slip top", gl * gw, "sq ft", 150, 200),
            ("Steel grid frame and setting blocks for the glass", gl * gw, "sq ft", 100, 250),
            ("Bottom drain, skimmer and gravity lines", 1, "set", 500, 1200),
            ("Filter, pump and UV, sized to turnover", 1, "set", 900 + gal * 0.3, 2000 + gal * 0.6),
            ("Air pump and diffuser", 1, "each", 120, 300),
            ("Headspace exhaust fan, ducted outside", 1, "each", 150, 350),
            ("GFCI circuits and bonding, by an electrician", 2, "circuits", 400, 900),
            ("Flush-mount access hatch to the pond, 24 x 30 in", 1, "each", 600, 1500)]:
            mats.append({"glass_sqft": g, "depth_ft": d, "item": item, "qty": q, "unit": u, "low": round(q * lo), "high": round(q * hi)})

b = {
 "id": "2026-11-22-glass-koi-floor", "publish": "2026-11-22",
 "written": dt.datetime.now(ZoneInfo('America/New_York')).replace(microsecond=0).isoformat(),
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Indoor",
 "title": "The koi pond under a glass floor: could you walk on water in your living room?",
 "dek": "A living room floored in glass over a pond full of koi is a stunning reel, but it puts 15 tons of water on a floor designed for about three, so the version that works is a small glass window into a concrete pond dug into a slab.",
 "reel": "A living-room floor is pulled up and replaced with walk-on glass panels over a shallow pond, and koi glide under people's feet as they cross the room. The clip shows no concrete, filter room, drain, fan or access hatch, and the glass never fogs.",
 "verdict": {"shown": 1, "fixed": 5, "line": "A whole floor of glass over water on wood joists cannot stand; a small glass window over an engineered concrete pond in a slab can, with professionals doing the heavy parts."},
 "scores": [
  {"test": "Floor carries the water", "shown": 0, "fixed": 8, "why": "About 190 lb per sq ft of water alone on joists rated for 40; a pond shell bears on soil instead"},
  {"test": "Glass is safe to walk on", "shown": 2, "fixed": 8, "why": "Code wants laminated glass that still holds with a ply broken"},
  {"test": "Koi stay healthy", "shown": 2, "fixed": 6, "why": "Too shallow and sealed as shown; 3 ft deep with a drain, filter and air"},
  {"test": "Glass stays clear", "shown": 2, "fixed": 5, "why": "Saturated air under the glass fogs it; a vented headspace and cool water help"},
  {"test": "Can be serviced", "shown": 1, "fixed": 7, "why": "No way in as shown; an access hatch and a filter room"},
  {"test": "Doable by a homeowner", "shown": 1, "fixed": 3, "why": "Slab cutting, concrete and structural glass are trades' work"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "Glass floors and stairs (FB14-07)", "outlet": "National Glass Association", "url": "https://www.glass.org/sites/default/files/2021-07/FB14-07_2020_Glass_Floors_and_Stairs_0521.pdf"},
  {"n": 2, "title": "Section 2409: glass in walkways", "outlet": "GoCodeBook (California Building Code)", "url": "https://gocodebook.com/library/us/ca/ca-building-code/chapter-24-glass-and-glazing/section-2409-glass-in-walkways-elevator-hoistways-and-elevator-cars"},
  {"n": 3, "title": "How much does a structural glass floor cost?", "outlet": "EngineerFix", "url": "https://engineerfix.com/how-much-does-a-structural-glass-floor-cost/"},
  {"n": 4, "title": "Walk-on glass floor specification: the architect's guide", "outlet": "Structural Glass", "url": "https://structural-glass.com/walk-on-glass-floor-specification-the-architects-guide-to-engineering-and-design/"},
  {"n": 5, "title": "Ponds by the numbers: rules for a lawless industry", "outlet": "POND Trade Magazine", "url": "https://www.pondtrademag.com/ponds-by-the-numbers-rules-for-a-lawless-industry/"},
  {"n": 6, "title": "Indoor koi pond (forum thread)", "outlet": "Fine Homebuilding", "url": "https://finehomebuilding.com/forum/indoor-koi-pond"},
  {"n": 7, "title": "Calculating live loads", "outlet": "JLC (Journal of Light Construction)", "url": "https://www.jlconline.com/how-to/framing/calculating-live-loads_o"},
  {"n": 8, "title": "Evaporation from a water surface", "outlet": "The Engineering ToolBox", "url": "https://www.engineeringtoolbox.com/evaporation-water-surface-d_690.html"}],
 "kit": {"summary": "A reinforced concrete koi pond set into a ground-floor slab, with a walk-on laminated glass window over part of it, a vented headspace, a bottom drain, and a filter room beside it.",
  "options": opts,
  "metrics": [
   {"key": "gallons", "label": "Pond volume", "unit": "gallons", "note": "pond runs a foot past the glass on every side; glass 3x6, 6x6, 6x9 or 9x9 ft"},
   {"key": "water_tons", "label": "Weight of water", "unit": "tons", "note": "carried by the concrete shell and soil"},
   {"key": "koi", "label": "Adult koi", "unit": "fish", "note": "at 200 gallons each"},
   {"key": "pump_gph", "label": "Pump flow", "unit": "gal per hour", "note": "turning the pond over 1.5 times an hour"},
   {"key": "glass_lb", "label": "Glass weight", "unit": "lb", "note": "three 1/2 in plies, in 3 by 3 ft panels"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Engineer, glazier and permit", "start": 0, "days": 28, "gate": "Stamped drawings for shell, slab opening and glass; permit issued"},
   {"phase": "Order the glass", "start": 14, "days": 42, "gate": "Glazier confirms the layup carries the design load with one ply broken"},
   {"phase": "Cut slab and excavate", "start": 28, "days": 5, "gate": "Hole shored or sloped as the engineer says; no undermined footings"},
   {"phase": "Drain lines and concrete shell", "start": 33, "days": 14, "gate": "Shell inspected and cured; drain and returns pressure-tested"},
   {"phase": "Seal and leak test", "start": 47, "days": 10, "gate": "Water level holds for 7 days with no loss beyond evaporation"},
   {"phase": "Filter room, power and fan", "start": 47, "days": 7, "gate": "GFCI circuits tested; headspace fan runs; bonding inspected"},
   {"phase": "Set frame and glass", "start": 57, "days": 3, "gate": "Glass sits on setting blocks; no glass touches steel; slip finish on top"},
   {"phase": "Cycle and stock", "start": 60, "days": 42, "gate": "Ammonia and nitrite read zero; add koi a few at a time"}],
  "assumptions": "Water at 62.4 lb per cu ft, glass at 162 lb per cu ft, 200 gallons per adult koi and 1.5 turnovers an hour. Prices are rough US ranges for late 2026, not quotes; not an engineered design."}}
out = os.path.join(here, '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for c in configs:
    if c['glass_sqft'] == 36 and c['depth_ft'] == 3.5: print('default', c)
