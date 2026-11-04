# Builds the underground pool room (Reel Check) from its text and its numbers.
import json, math, os
G = 62.4            # lb per cubic foot of water
SIG = 435           # psi, allowable acrylic tension (3 MPa, the water-side limit one maker publishes)
ROOM = (12, 14, 8)  # interior width, length, height in ft
SILL = 2            # ft from room floor up to the bottom of the window
here = os.path.dirname(__file__)
body = open(os.path.join(here, 'underground-pool-room.md'), encoding='utf-8').read()

# Roark, simply supported rectangular plate, uniform load: beta by aspect ratio a/b
BETA = [(1.0, .2874), (1.2, .3762), (1.4, .4530), (1.6, .5172), (1.8, .5688), (2.0, .6102), (3.0, .7134), (5.0, .7410)]
def beta(r):
    for (r0, b0), (r1, b1) in zip(BETA, BETA[1:]):
        if r0 <= r <= r1:
            return b0 + (b1 - b0) * (r - r0) / (r1 - r0)
    return .75

def flood_seconds(area, bottom, top):
    """Step the flow through a fully failed window until the room has filled to pool level or to its ceiling."""
    W, L, H = ROOM; pool_area = 16 * 32; floor_below = bottom + SILL
    room_lvl, pool_drop, t = 0.0, 0.0, 0.0
    while True:
        head_out = floor_below - pool_drop          # pool surface above room floor
        if room_lvl >= min(H, head_out) - .05:
            return round(t)
        # head across the opening, averaged over its height, with room water on the far side
        mid = floor_below - (bottom + top) / 2       # height of window centre above room floor
        h = (head_out - mid) - max(0, room_lvl - mid)
        q = .6 * area * math.sqrt(2 * 32.2 * max(h, .01))
        dt = .1; v = q * dt
        room_lvl += v / (W * L); pool_drop += v / pool_area; t += dt

# Hydrosight framed prices, USD: 10 sq ft $6.6-8.6k, 50 sq ft $16.5-22k; interpolate in log space
def window_price(a):
    k_lo = math.log(16500 / 6600) / math.log(5); k_hi = math.log(22000 / 8600) / math.log(5)
    return round(6600 * (a / 10) ** k_lo, -2), round(8600 * (a / 10) ** k_hi, -2)

opts = [{"key": "window_sqft", "label": "Window size", "unit": "sq ft", "values": [4, 8, 12, 18, 24], "default": 12},
        {"key": "sill_depth_ft", "label": "Window bottom below waterline", "unit": "ft", "values": [5, 6, 7], "default": 6}]
SHAPES = {4: (2, 2), 8: (4, 2), 12: (4, 3), 18: (6, 3), 24: (6, 4)}  # width x height, ft
configs, mats = [], []
for a in opts[0]['values']:
    for d in opts[1]['values']:
        w, hgt = SHAPES[a]  # every shape leaves at least 1 ft of water over the top
        a_eff = w * hgt; top = d - hgt
        p_bot = G * d / 144                          # psi at the bottom edge
        force = G * (d + top) / 2 * a_eff            # lb on the panel
        b, long = min(w, hgt) * 12, max(w, hgt) * 12
        t_in = b * math.sqrt(beta(long / b) * p_bot / SIG)
        t_in = max(1.25, math.ceil(t_in * 4) / 4)    # round up to the next quarter inch
        pool_d = d + 1
        wall_lb = .5 * G * pool_d ** 2               # lb per ft of shared wall
        floor_below = d + SILL
        configs.append({"window_sqft": a, "sill_depth_ft": d, "panel_force_lb": round(force, -1),
                        "acrylic_in": t_in, "shared_wall_lb_per_ft": round(wall_lb, -1),
                        "flood_seconds": flood_seconds(a_eff, d, top), "room_floor_ft": floor_below + .5,
                        "dig_cy": math.ceil((ROOM[0] + 4) * (ROOM[1] + 4) * (floor_below + 1.5) / 27 * 1.25)})
        W, L, H = ROOM
        dig_cy = math.ceil((W + 4) * (L + 4) * (floor_below + 1.5) / 27 * 1.25)
        wall_cy = (2 * (W + L) * (H + 1) * (10 / 12) + (W + 1.6) * (L + 1.6) * (10 / 12) * 2) / 27
        conc_cy = math.ceil(wall_cy * 1.1)
        rebar_lb = math.ceil(conc_cy * 200)
        memb_sf = math.ceil((2 * (W + L + 3) * (H + 2) + (W + 2) * (L + 2) * 2) * 1.15)
        wlo, whi = window_price(a_eff)
        for item, q, u, lo, hi in [
            ("Excavation and haul-off", dig_cy, "cu yd", 40, 85),
            ("Structural concrete, walls, floor and roof slab", conc_cy, "cu yd", 180, 260),
            ("Placing and finishing labor for the concrete", conc_cy, "cu yd", 250, 450),
            ("Rebar, placed (engineer's schedule)", rebar_lb, "lb", 1.4, 2.4),
            ("Waterproofing membrane and drainage board", memb_sf, "sq ft", 6, 12),
            ("Perimeter drain, sump pit, two pumps and battery backup", 1, "lot", 2500, 5000),
            ("Framed acrylic window from the maker", 1, "each", wlo, whi),
            ("Window install by the maker or a certified installer", 1, "each", 3300, 16500),
            ("Egress stair or well to code, with a door at the top", 1, "lot", 6000, 15000),
            ("Ventilation, dehumidifier, CO, radon and flood alarms", 1, "lot", 2500, 6000),
            ("Electrical, lighting and pool bonding by an electrician", 1, "lot", 4000, 9000),
            ("Interior finish (your sweat equity)", W * L, "sq ft", 25, 60),
            ("Structural engineer: room, shared wall and window", 1, "each", 4000, 12000),
            ("Geotechnical boring and groundwater check", 1, "each", 1500, 4000),
            ("Building and pool permits", 1, "each", 500, 3000)]:
            mats.append({"window_sqft": a, "sill_depth_ft": d, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})

b = {
 "id": "2026-11-03-underground-pool-room", "publish": "2026-11-03", "written": "2026-11-02T21:18:10-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Water",
 "title": "The bedroom with a window into the pool: could you dig one yourself?",
 "dek": "Reels show a shovel, some concrete and a sheet of glass turning a backyard into an underwater lounge; done that way it is a room that can flood in seconds, and only an engineered, professional-led version is safe.",
 "reel": "A builder digs a pit beside a backyard pool, pours concrete walls, cuts into the pool wall and sets a sheet of glass. The clip ends on a cozy bedroom or lounge lit blue by the pool through the window. Groundwater, drains, a second way out and anyone qualified never appear.",
 "verdict": {"shown": 1, "fixed": 4, "line": "As filmed it is a flood trap; engineered and professionally built it is real, but it is a six-figure project, not a weekend dig."},
 "scores": [
  {"test": "Window holds the water", "shown": 1, "fixed": 8, "why": "Cut-to-fit glass as shown; a maker-engineered framed acrylic panel carries the load with a large margin"},
  {"test": "Room stays dry", "shown": 1, "fixed": 6, "why": "No membrane or drains; full waterproofing, a perimeter drain and two sumps make it defensible"},
  {"test": "Pool and room structure", "shown": 1, "fixed": 7, "why": "The shared wall must hold the pool with air behind it; an engineered wall can"},
  {"test": "Safe to be inside", "shown": 0, "fixed": 6, "why": "No second exit, air or alarms; a code egress, ventilation and flood alarms fix most of it"},
  {"test": "Cost against a sunroom", "shown": 6, "fixed": 2, "why": "Concrete is cheap in the clip; the real version costs more than many pools"},
  {"test": "Doable by one handy person", "shown": 2, "fixed": 2, "why": "Excavation, shoring and the window are contractor work; finishes are the DIY part"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "How thick is the glazing?", "outlet": "Hydrosight", "url": "https://hydrosight.com/acrylic-panel-thickness"},
  {"n": 2, "title": "The cost of acrylic glass walls for pools and underwater windows", "outlet": "Hydrosight", "url": "https://www.hydrosight.com/other/cost"},
  {"n": 3, "title": "A matter of transparency: acrylic panels and windows on swimming pools", "outlet": "Pool & Spa News", "url": "https://www.poolspanews.com/?p=28570"},
  {"n": 4, "title": "Quality standards for R-Cast acrylic", "outlet": "Reynolds Polymer Technology", "url": "https://www.reynoldspolymer.com/quality-standards-for-r-cast-acrylic/"},
  {"n": 5, "title": "Rescue opening guide", "outlet": "City of Princeton, Illinois", "url": "https://www.princeton-il.com/forms/Rescue_Opening_Guide.pdf"},
  {"n": 6, "title": "Swimming pool underwater viewing windows?", "outlet": "Trouble Free Pool", "url": "https://www.troublefreepool.com/threads/swimming-pool-underwater-viewing-windows.69309"},
  {"n": 7, "title": "Puzzling swimming pool man cave has the internet buzzing", "outlet": "Pool Magazine", "url": "https://www.poolmagazine.com/pool-news/puzzling-swimming-pool-man-cave-has-the-internet-buzzing/amp/"},
  {"n": 8, "title": "What is hydrostatic pressure?", "outlet": "Polyguard", "url": "https://polyguard.com/blog/hydrostatic-pressure"},
  {"n": 9, "title": "Natare underwater windows", "outlet": "Natare", "url": "https://natare.com/equipment-systems/underwater-windows/"}],
 "kit": {"summary": "A professional-led 12 by 14 foot lounge, not a bedroom, built with a new pool: engineered concrete box, full waterproofing and drains, a maker-supplied framed acrylic window and a code exit.",
  "options": opts,
  "metrics": [
   {"key": "panel_force_lb", "label": "Water force on the window", "unit": "lb", "note": "pushing into the room, all the time"},
   {"key": "acrylic_in", "label": "Acrylic, rough minimum", "unit": "in", "note": "a screening figure; the maker sets the real one"},
   {"key": "flood_seconds", "label": "Time to flood if the window fails", "unit": "seconds", "note": "room fills to pool level or ceiling"},
   {"key": "shared_wall_lb_per_ft", "label": "Push on the shared wall", "unit": "lb per ft", "note": "with only air behind it"},
   {"key": "room_floor_ft", "label": "Room floor below the waterline", "unit": "ft", "note": "plus slab; dig deeper still"},
   {"key": "dig_cy", "label": "Soil to dig and haul", "unit": "cu yd", "note": "with working room and swell"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Soil, groundwater and feasibility", "start": 0, "days": 21, "gate": "Boring shows the seasonal water table well below the room floor, or the project stops"},
   {"phase": "Engineer and window maker design", "start": 21, "days": 45, "gate": "Stamped drawings for room, shared wall and window rebate; window ordered"},
   {"phase": "Permits", "start": 66, "days": 30, "gate": "Building and pool permits issued, with the room classed as it will be used"},
   {"phase": "Excavation and shoring", "start": 96, "days": 10, "gate": "Pit shored or benched; nobody works in an unprotected trench over 5 ft"},
   {"phase": "Drains, slab and walls", "start": 106, "days": 30, "gate": "Rebar inspected before each pour; window blockout set to the maker's template"},
   {"phase": "Waterproofing and backfill", "start": 136, "days": 14, "gate": "Membrane inspected and flood-tested; sumps and alarms running before backfill"},
   {"phase": "Window install", "start": 150, "days": 7, "gate": "Installer signs off the seal and cure time before any water"},
   {"phase": "Pool shell and staged fill", "start": 157, "days": 30, "gate": "Fill in stages with someone watching the window and room; drain at the first weep"},
   {"phase": "Egress, air and electrical", "start": 187, "days": 21, "gate": "Final inspection passed; CO, radon and flood alarms tested"},
   {"phase": "Interior finish", "start": 208, "days": 30, "gate": "No furniture or bed until a month of dry readings"}],
  "assumptions": "Water at 62.4 lb per cubic foot; acrylic screened with a simply supported plate formula at 435 psi, and flood time from orifice flow into a 12 x 14 x 8 ft room beside a 16 x 32 ft pool. Quantities include 10-25% waste; prices are rough US ranges for late 2026, not quotes, and not an engineered design."}}
out = os.path.join(here, '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for c in configs:
    if c['window_sqft'] == 12 and c['sill_depth_ft'] == 6:
        print(c)
tot = [m for m in mats if m['window_sqft'] == 12 and m['sill_depth_ft'] == 6]
print(sum(m['low'] for m in tot), sum(m['high'] for m in tot))
for m in tot: print(m['item'], m['qty'], m['low'], m['high'])
