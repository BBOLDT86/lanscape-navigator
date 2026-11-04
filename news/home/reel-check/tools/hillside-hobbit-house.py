# Builds the earth-sheltered hillside "hobbit house" (Reel Check) from its text and its numbers.
import json, math, os
SAT = 130.0     # saturated soil, lb per cu ft (what the roof must carry after a soaking rain)
MOIST = 120.0   # moist backfill against the walls, lb per cu ft
K0 = 0.5        # at-rest pressure coefficient; walls braced by the roof do not move
SNOW = 30.0     # ground snow load, psf, a middling US value
CONC = 150.0    # reinforced concrete, lb per cu ft
LENGTH = 28.0   # interior length front to back, ft
WALL_H = 8.5    # interior wall height, ft
here = os.path.dirname(__file__)
body = open(os.path.join(here, 'hillside-hobbit-house.md'), encoding='utf-8').read()

opts = [{"key": "span_ft", "label": "Inside width (roof span)", "unit": "ft", "values": [12, 14, 16, 18, 20], "default": 16},
        {"key": "cover_in", "label": "Soil on the roof", "unit": "in", "values": [12, 18, 24], "default": 18}]

configs, mats = [], []
for s in opts[0]['values']:
    for c in opts[1]['values']:
        cover = c / 12
        slab_in = max(8, math.ceil(s * 12 / 20))        # rough span/20 depth for a one-way slab; engineer sets the real one
        slab = slab_in / 12
        roof_psf = SAT * cover + SNOW + CONC * slab      # soil + snow + the slab itself
        out_w = s + 2 * (10 / 12)
        out_l = LENGTH + 10 / 12
        roof_tons = roof_psf * out_w * out_l / 2000
        backfill = WALL_H + slab + cover                 # earth height against the rear wall
        base_psf = K0 * MOIST * backfill
        rear_lb_ft = 0.5 * K0 * MOIST * backfill ** 2    # total push per foot of wall
        area = s * LENGTH
        # concrete: rear + two side walls, 10 in thick; footing 24 x 12 in under them; slab-on-grade 4 in; roof slab
        wall_len = out_w + 2 * out_l
        walls = wall_len * (WALL_H + 1) * (10 / 12)
        footing = (wall_len + out_w) * 2 * 1
        floor = s * LENGTH * (4 / 12)
        roof = out_w * (out_l + 1) * slab
        conc_cy = (walls + footing + floor + roof) / 27
        # excavation into a 1:2 slope, sides laid back 1:1 for the dig
        dig = (out_w + 6) * (out_l + 6) * (backfill + 1) * 0.6 / 27
        configs.append({"span_ft": s, "cover_in": c, "floor_sq_ft": round(area), "roof_psf": round(roof_psf),
                        "roof_tons": round(roof_tons), "rear_base_psf": round(base_psf),
                        "rear_lb_per_ft": round(rear_lb_ft), "concrete_cu_yd": round(conc_cy, 1)})
        membrane = math.ceil((out_w * out_l + wall_len * (WALL_H + 1.5)) * 1.15)
        rebar = math.ceil(conc_cy * 1.1 * 180)
        soil_cy = round(out_w * out_l * cover / 27 * 1.1, 1)
        for item, q, u, lo, hi in [
            ("Excavation, machine and operator", round(dig), "cu yd", 10, 22),
            ("Ready-mix concrete: footings, walls, floor, roof slab (10% waste)", round(conc_cy * 1.1, 1), "cu yd", 170, 240),
            ("Rebar, placed (about 180 lb per cu yd)", rebar, "lb", 1.2, 2.0),
            ("Forming, shoring and pump for the roof pour", 1, "lot", 6000 + 400 * s, 14000 + 800 * s),
            ("Sheet waterproofing membrane, root barrier and protection board", membrane, "sq ft", 4, 8),
            ("Rigid foam insulation outside the membrane, 4 in", membrane, "sq ft", 2.5, 4.5),
            ("Drain mat, footing drain pipe and gravel to daylight", 1, "lot", 2500, 6000),
            ("Topsoil and seed for the roof cover", soil_cy, "cu yd", 35, 70),
            ("Front wall: framing, glazing, round door, egress windows", 1, "lot", 9000 + 300 * s, 22000 + 700 * s),
            ("Passive radon pipe under the slab and a radon test", 1, "set", 300, 900),
            ("Ventilation with heat recovery and a dehumidifier", 1, "set", 2500, 6000),
            ("Structural engineer's design and stamped drawings", 1, "each", 4000, 10000),
            ("Building permit", 1, "each", 500, 3000)]:
            mats.append({"span_ft": s, "cover_in": c, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})

for x in configs:
    if x['span_ft'] == 16: print(x)

b = {
 "id": "2026-11-10-hillside-hobbit-house", "publish": "2026-11-10", "written": "2026-11-02T21:28:00-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Shelter",
 "title": "The hillside hobbit house: can you dig a home into a hill yourself?",
 "dek": "A round green door in a grassy bank is the most charming build on the feed, but a roof of wet earth weighs as much as a fleet of trucks, and the real versions are built of concrete.",
 "reel": "A builder cuts into a grassy slope, frames a small room of logs or stacked stone, sets a round wooden door in the face and shovels the turf back over the roof. The finished clip pans across a candlelit room with a fireplace and a window in the bank. The structure under the sod, the waterproofing and the drains never appear.",
 "verdict": {"shown": 2, "fixed": 6, "line": "The timber-and-turf hut in the clip is a slow collapse; a concrete shell built into the hill, sealed and drained, is a real and comfortable house."},
 "scores": [
  {"test": "Roof carries the earth", "shown": 1, "fixed": 8, "why": "About 350 psf of wet soil, snow and slab, near nine times a normal roof; a concrete slab takes it"},
  {"test": "Rear wall holds the hill", "shown": 2, "fixed": 8, "why": "Over 10 ft of earth on the back wall is past the code's simple tables; engineered concrete is needed"},
  {"test": "Stays dry inside", "shown": 1, "fixed": 6, "why": "Membrane, outside insulation, drains and a dehumidifier; leaks are costly to find later"},
  {"test": "Healthy air", "shown": 3, "fixed": 7, "why": "Radon pipe, heat-recovery fan and humidity control; a wood fire with one door is not a plan"},
  {"test": "Lasts thirty years", "shown": 1, "fixed": 8, "why": "Untreated wood in soil can rot in about five years; concrete does not"},
  {"test": "Doable by one handy person", "shown": 4, "fixed": 4, "why": "Finish work is DIY; the dig and the concrete roof pour need a crew"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "Earth shelter", "outlet": "Wikipedia", "url": "https://en.wikipedia.org/wiki/Earth_shelter"},
  {"n": 2, "title": "Earth-sheltered home construction", "outlet": "The Internet Encyclopedia of Science (David Darling)", "url": "https://www.daviddarling.info/encyclopedia/E/AE_earth-sheltered_home_construction.html"},
  {"n": 3, "title": "Structural requirements for earth shelter houses", "outlet": "Permies", "url": "https://permies.com/t/4404/structural-requirements-earth-shelter-houses"},
  {"n": 4, "title": "Section R404, foundation and retaining walls (Minnesota Rules 1309.0404)", "outlet": "Cornell Law School, Legal Information Institute", "url": "https://www.law.cornell.edu/regulations/minnesota/Minn-R-1309-0404"},
  {"n": 5, "title": "Emergency escape and rescue openings", "outlet": "City of Dubuque", "url": "https://www.cityofdubuque.org/DocumentCenter/View/327/Emergency-Escape-and-Rescue-Openings"},
  {"n": 6, "title": "What is EPA's action level for radon and what does it mean?", "outlet": "US Environmental Protection Agency", "url": "https://epa.gov/radon/what-epas-action-level-radon-and-what-does-it-mean"},
  {"n": 7, "title": "Structural considerations for green roofs", "outlet": "Penn State Architectural Engineering", "url": "https://www.engr.psu.edu/ae/Thesis/portfolios/2008/wdc130/Final Report/CPEP Final Report/Analysis III - Structural Considerations for Green Roofs.pdf"},
  {"n": 8, "title": "Trenching and excavation", "outlet": "CDC NIOSH", "url": "https://www.cdc.gov/niosh/topics/trenching"}],
 "kit": {"summary": "A one-room in-hill house 28 ft deep: engineered reinforced concrete rear and side walls and roof slab, sealed, insulated and drained, with turf on top and a glazed front wall facing out of the hill.",
  "options": opts,
  "metrics": [
   {"key": "floor_sq_ft", "label": "Floor area", "unit": "sq ft", "note": "inside, 28 ft deep"},
   {"key": "roof_psf", "label": "Roof load", "unit": "lb per sq ft", "note": "wet soil, snow and the slab; a normal roof is about 40"},
   {"key": "roof_tons", "label": "Total on the roof", "unit": "tons", "note": "carried by the side and rear walls"},
   {"key": "rear_base_psf", "label": "Earth pressure at the back wall base", "unit": "lb per sq ft", "note": "at rest, before any groundwater"},
   {"key": "rear_lb_per_ft", "label": "Push on the back wall", "unit": "lb per ft", "note": "per foot of wall length, held by roof and floor"},
   {"key": "concrete_cu_yd", "label": "Concrete", "unit": "cu yd", "note": "footings, walls, floor and roof"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Site, soil test and engineer", "start": 0, "days": 45, "gate": "Slope stable, groundwater below the floor year-round, radon zone known; stamped drawings"},
   {"phase": "Permit", "start": 30, "days": 30, "gate": "Permit issued, including egress windows in the front wall"},
   {"phase": "Excavation", "start": 60, "days": 5, "gate": "Cut laid back or shored; no one in an unshored cut over 5 ft"},
   {"phase": "Footings, radon pipe, floor slab", "start": 65, "days": 10, "gate": "Footings inspected; radon pipe and vapor barrier under the slab"},
   {"phase": "Walls and roof slab", "start": 75, "days": 35, "gate": "Steel inspected before each pour; roof shoring stays until the slab reaches design strength"},
   {"phase": "Waterproof, insulate, drain", "start": 110, "days": 10, "gate": "Membrane lapped and flood-tested on the roof; drains run to daylight"},
   {"phase": "Backfill and turf", "start": 120, "days": 7, "gate": "Backfill in lifts with light equipment; never more soil on the roof than the drawings allow"},
   {"phase": "Front wall, fit-out, air", "start": 127, "days": 60, "gate": "Egress windows open; ventilation runs; radon test under 4 pCi/L; humidity under 60%"}],
  "assumptions": "Roof loads use saturated soil at 130 lb per cu ft, 30 psf of snow and a slab about span/20 deep; wall pressure uses moist soil at 120 lb per cu ft at rest. Quantities include about 10% waste; prices are rough US ranges for late 2026, not quotes, and this is not an engineered design."}}
out = os.path.join(here, '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
