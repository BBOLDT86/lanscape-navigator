# Builds the floor-to-ceiling aquarium wall Reel Check from its text and its numbers.
import datetime as dt, json, math, os
from zoneinfo import ZoneInfo
G = 62.4; ACR = 74.3; SIG = 725  # water lb/cu ft, acrylic lb/cu ft, allowable acrylic bending stress psi (5 MPa)
here = os.path.dirname(__file__)
body = open(os.path.join(here, 'aquarium-wall.md'), encoding='utf-8').read()


def beta(r):  # plate coefficient for a panel held on four edges under water pressure, by length/height
    t = [(0.5, .085), (.666, .1156), (1, .16), (1.5, .26), (2, .34), (2.5, .38), (3, .43)]
    if r <= t[0][0]: return t[0][1]
    for (a, b), (c, d) in zip(t, t[1:]):
        if r <= c: return b + (d - b) * (r - a) / (c - a)
    return t[-1][1]


def panel_in(length_ft, h_ft):  # front panel thickness, inches
    return math.sqrt(beta(length_ft / h_ft) * 0.0361 * (h_ft * 12) ** 3 / SIG)


def psat(c): return 0.61094 * math.exp(17.625 * c / (c + 243.04))
def xr(c, rh): p = psat(c) * rh; return 0.622 * p / (101.325 - p)


def evap_gal_day(area_sqft, cover=1.0):  # Engineering Toolbox pool formula, still air, 78 F water, 72 F 45% room
    th = 25 + 19 * 0.1
    return th * area_sqft * 0.0929 * (xr(25.56, 1) - xr(22.2, .45)) * 24 / 3.785 * cover


# The reel's tank, for the text: 12 ft wide, 2 ft front to back, water 7.5 ft deep, panel 8 ft tall
W, D, H = 12, 2, 7.5
vol = W * D * H; water = vol * G; t = panel_in(W, H)
front = W * 8 * t / 12 * ACR; sides = 2 * D * 8 * t / 12 * ACR + W * 8 * t / 12 * ACR + W * D * t / 12 * ACR
rock = W * D * 0.25 * 100
reel = {"gallons": round(vol * 7.48), "water_lb": round(water), "panel_in": round(t, 2), "acrylic_lb": round(front + sides),
        "total_lb": round(water + front + sides + rock), "psf": round((water + front + sides + rock) / (W * D)),
        "front_force_lb": round(0.5 * G * H * H * W), "bottom_psi": round(G * H / 144, 2), "evap": round(evap_gal_day(W * D), 1)}
print('reel tank', reel)

opts = [{"key": "length_ft", "label": "Tank length", "unit": "ft", "values": [4, 6, 8, 10], "default": 8},
        {"key": "water_in", "label": "Water height", "unit": "in", "values": [24, 30, 36], "default": 30}]
configs, mats = [], []
for L in opts[0]['values']:
    for win in opts[1]['values']:
        h = win / 12; v = L * D * h; gal = v * 7.48
        tp = panel_in(L, h); tank_lb = (L * (h + .25) * 2 + D * (h + .25) * 2 + L * D) * tp / 12 * ACR
        total = v * G + tank_lb + L * D * 0.17 * 100 + 60 * L  # water, acrylic, 2 in sand/rock bed, steel stand
        psf = total / (L * D)
        configs.append({"length_ft": L, "water_in": win, "gallons": round(gal), "total_lb": round(total),
                        "floor_psf": round(psf), "panel_in": round(tp, 2), "evap_gal_day": round(evap_gal_day(L * D, 0.4), 1)})
        sqft = L * D
        for item, q, u, lo, hi in [
            ("Custom acrylic tank, in-wall, with overflow", round(gal), "gallons", 10, 20),
            ("Welded steel stand, painted", 1, "each", 500 + 120 * L, 900 + 250 * L),
            ("Floor support: LVL beam, posts and footings, or slab check", 1, "lot", 900, 3500),
            ("Header and framing for the wall opening", 1, "lot", 300, 900),
            ("Sump, return pump and plumbing", 1, "set", 400 + gal * 0.5, 900 + gal * 1.2),
            ("Heaters, about 4 W per gallon", math.ceil(gal * 4 / 300), "heaters", 40, 90),
            ("LED lighting", L, "ft", 40, 120),
            ("Dedicated GFCI circuits, by an electrician", 2, "circuits", 350, 800),
            ("Dehumidifier for the service room, 35 pint", 1, "each", 220, 380),
            ("Drip tray, waterproof floor and leak alarms", sqft + 16, "sq ft", 6, 14),
            ("Building permit", 1, "each", 75, 400),
            ("Structural engineer's letter", 1, "each", 400, 1200)]:
            mats.append({"length_ft": L, "water_in": win, "item": item, "qty": q, "unit": u, "low": round(q * lo), "high": round(q * hi)})

b = {
 "id": "2026-11-07-aquarium-wall", "publish": "2026-11-07",
 "written": dt.datetime.now(ZoneInfo('America/New_York')).replace(microsecond=0).isoformat(),
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Indoor",
 "title": "The floor-to-ceiling aquarium wall: can a living room hold one?",
 "dek": "A wall of water from floor to ceiling looks effortless in the reel, but it weighs eight tons and needs a window three inches thick, so the version that works is waist-high with a room behind it.",
 "reel": "A living-room wall is opened up and a glass tank running from floor to ceiling is slid into the gap, filled, planted and stocked in a few cuts. The finished room shows fish swimming past the sofa with no lid, pipes, cords or service door in sight.",
 "verdict": {"shown": 2, "fixed": 7, "line": "Floor to ceiling, it overloads the floor and hides its own plumbing; waist-high in a framed wall with a service room behind, it is a proven build."},
 "scores": [
  {"test": "Floor can carry it", "shown": 1, "fixed": 7, "why": "About 700 lb per sq ft as shown; a smaller tank on an engineered beam or a slab is fine"},
  {"test": "Front panel holds", "shown": 2, "fixed": 8, "why": "Needs cast acrylic over 3 in thick; a 30 in tank needs about 3/4 in"},
  {"test": "Can be serviced", "shown": 1, "fixed": 8, "why": "No way in at the top as filmed; a room behind the wall gives full access"},
  {"test": "Electrical and leak safety", "shown": 2, "fixed": 8, "why": "GFCI circuits, drip loops and a drip tray with alarms"},
  {"test": "Humidity in the house", "shown": 2, "fixed": 6, "why": "Gallons a day evaporate into the wall unless the service room is vented and dried"},
  {"test": "Cost and upkeep", "shown": 3, "fixed": 5, "why": "A large custom tank and weekly care are a real commitment"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "What size aquarium can I have in my house?", "outlet": "Reef Builders", "url": "https://reefbuilders.com/2023/12/19/what-size-aquarium-can-i-have-in-my-house"},
  {"n": 2, "title": "Calculating live loads", "outlet": "JLC (Journal of Light Construction)", "url": "https://www.jlconline.com/how-to/framing/calculating-live-loads_o"},
  {"n": 3, "title": "Aquarium glazing with PLEXIGLAS", "outlet": "Hydrosight (PLEXIGLAS technical data)", "url": "https://www.hydrosight.com/content/exp/other/old-technical-data/2-depth-rating/Aquarium_Glazing-Plexiglas.pdf"},
  {"n": 4, "title": "Aquarium glass thickness calculator", "outlet": "Omni Calculator", "url": "https://www.omnicalculator.com/other/aquarium-glass-thickness"},
  {"n": 5, "title": "What you need to know about aquariums and electrical safety", "outlet": "Reef Builders", "url": "https://reefbuilders.com/2024/05/13/what-you-need-to-know-about-aquariums-and-electrical-safety"},
  {"n": 6, "title": "The in-wall evolution", "outlet": "Rate My Fish Tank", "url": "https://www.ratemyfishtank.com/blog/the-in-wall-evolution"},
  {"n": 7, "title": "Evaporation from a water surface", "outlet": "The Engineering ToolBox", "url": "https://www.engineeringtoolbox.com/evaporation-water-surface-d_690.html"}],
 "kit": {"summary": "A waist-high custom acrylic tank set into a framed wall opening, on a steel stand over an engineered beam or slab, serviced from a vented room behind.",
  "options": opts,
  "metrics": [
   {"key": "gallons", "label": "Water", "unit": "gallons", "note": "24 in front to back"},
   {"key": "total_lb", "label": "Filled weight", "unit": "lb", "note": "water, acrylic, rock bed and stand"},
   {"key": "floor_psf", "label": "Load on its footprint", "unit": "lb per sq ft", "note": "a living-room floor is designed for 40"},
   {"key": "panel_in", "label": "Front panel", "unit": "in acrylic", "note": "four edges supported; the builder sets the final figure"},
   {"key": "evap_gal_day", "label": "Evaporation", "unit": "gal per day", "note": "with a lid over most of the top"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Engineer and permit", "start": 0, "days": 21, "gate": "Engineer has sized the beam or confirmed the slab; permit issued"},
   {"phase": "Order the tank", "start": 7, "days": 56, "gate": "Builder confirms panel thickness and overflow layout in writing"},
   {"phase": "Floor support and wall opening", "start": 21, "days": 7, "gate": "Beam, posts and header inspected; opening plumb and square"},
   {"phase": "Service room: power, drain, vent", "start": 28, "days": 7, "gate": "GFCI circuits tested; dehumidifier drains; leak alarms wired"},
   {"phase": "Set stand and tank", "start": 63, "days": 2, "gate": "Stand level within 1/16 in over its length; tank seated on its pad"},
   {"phase": "Leak test with fresh water", "start": 65, "days": 7, "gate": "No drips at seams or fittings for a full week"},
   {"phase": "Cycle the tank", "start": 72, "days": 35, "gate": "Ammonia and nitrite read zero before the first fish"},
   {"phase": "Trim and stock", "start": 107, "days": 3, "gate": "Trim leaves a removable panel at every fitting; stock slowly"}],
  "assumptions": "Water at 62.4 lb per cu ft, acrylic at 74 lb per cu ft and 725 psi allowable bending stress, evaporation for 78 F water in a 72 F room at 45% humidity. Prices are rough US ranges for late 2026, not quotes; not an engineered design."}}
out = os.path.join(here, '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for c in configs:
    if c['length_ft'] == 8 and c['water_in'] == 30: print('default', c)
