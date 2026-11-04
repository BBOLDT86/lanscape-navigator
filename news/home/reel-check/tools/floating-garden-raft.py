# Builds the floating pond garden raft Reel Check from its text and its numbers.
import json, math, os
WATER = 62.4         # lb per cu ft
EPS_LIFT = 60        # net lift of EPS foam, lb per cu ft submerged (Universal Foam Products)
SOIL_PCF = 115       # wet garden soil (Perlite Institute: 100-125)
MEDIA_PCF = 40       # wet peat-perlite or coir-perlite mix (Perlite Institute)
BOTTLE_LIFT = 4.4    # a sealed 2 L bottle fully under water, lb
PALLET_LB = 45       # a 48 x 40 in wood pallet, soaked
FOAM_IN = 2          # foam sheets come 2 in thick
SAFETY = 2.0         # buoyancy at least twice the wet load, so the raft rides high and shrugs off birds and rain
MEDIA_IN = 2         # media in net pots or a coir mat, inches
PLANT_SPACING_IN = 9
body = open(os.path.join(os.path.dirname(__file__), 'floating-garden-raft.md'), encoding='utf-8').read()

# The reel: a 4 x 4 ft pallet on 24 capped 2 L bottles, 4 in of wet garden soil, with a person kneeling on it.
reel_soil = 4 * 4 * (4 / 12) * SOIL_PCF
reel_load = reel_soil + PALLET_LB
reel_lift = 24 * BOTTLE_LIFT + PALLET_LB * 0.4      # soaked pallet wood gives back a little
opts = [{"key": "raft_ft", "label": "Raft side", "unit": "ft", "values": [2, 3, 4, 5], "default": 4},
        {"key": "pond_sqft", "label": "Pond surface", "unit": "sq ft", "values": [60, 100, 200, 400], "default": 100}]
configs, mats = [], []
for s in opts[0]['values']:
    for p in opts[1]['values']:
        area = s * s
        media_lb = area * 0.5 * MEDIA_IN / 12 * MEDIA_PCF      # pots cover about half the deck
        plants_lb = area * 1.5                                   # mature emergent plants, wet
        frame_lb = area * 0.8                                    # cedar edge, mesh, ties
        load = media_lb + plants_lb + frame_lb
        foam_cuft = load * SAFETY / EPS_LIFT
        foam_in = max(FOAM_IN, math.ceil(foam_cuft / area * 12 / FOAM_IN) * FOAM_IN)
        lift = area * foam_in / 12 * EPS_LIFT
        sink_in = load / (area * WATER) * 12
        sites = (math.floor(s * 12 / PLANT_SPACING_IN)) ** 2
        configs.append({"raft_ft": s, "pond_sqft": p, "cover_pct": round(100 * area / p), "plant_sites": sites,
                        "load_lb": round(load), "foam_in": foam_in, "reserve_lb": round(lift - load),
                        "draft_in": round(sink_in, 1)})
        sheets = math.ceil(area * foam_in / FOAM_IN / 32 * 1.1)   # 4 x 8 sheets, 2 in thick
        for item, q, u, lo, hi in [
            ("Closed-cell foam board, 2 in x 4 x 8 ft (XPS or marine EPS)", sheets, "sheets", 35, 60),
            ("Pond-safe HDPE or vinyl-coated mesh to wrap the foam", math.ceil(area * 2.2), "sq ft", 0.4, 0.9),
            ("Cedar 1x4 for the edge frame", math.ceil(4 * s / 8) + 1, "boards", 6, 11),
            ("Stainless screws and UV-rated cable ties", 1, "lot", 15, 30),
            ("Coir mat or net pots, 3 in", sites, "sites", 0.3, 0.8),
            ("Coir-perlite media (bagged)", max(1, math.ceil(media_lb / 25)), "bags", 9, 15),
            ("Native emergent plants: rushes, pickerelweed, iris", sites, "plants", 4, 9),
            ("Tether: braided poly line and a 10 lb mushroom anchor", 1, "set", 25, 45),
            ("Long-handled rake or boat hook to pull the raft in", 1, "each", 15, 35),
            ("Rigid pond grid, fixed above the water (if children under 6 visit)", p, "sq ft", 1.5, 4)]:
            mats.append({"raft_ft": s, "pond_sqft": p, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})

b = {
 "id": "2026-11-24-floating-garden-raft", "publish": "2026-11-24", "written": "2026-11-02T21:46:33-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Garden",
 "title": "The floating pond garden: would the raft in the reel even float?",
 "dek": "A pallet on plastic bottles, heaped with soil and vegetables and drifting on a backyard pond, is pure feed magic; it would sink under its own soil, but a light foam raft of wetland plants is a proven way to clean a pond.",
 "reel": "A wooden pallet is lashed to rows of capped plastic bottles, covered in soil and planted with lettuce, herbs and tomatoes, then pushed out onto a backyard pond. A time-lapse shows a lush floating vegetable patch, and in the last shot someone kneels on the raft to pick a tomato.",
 "verdict": {"shown": 1, "fixed": 7, "line": "As filmed the soil outweighs what the bottles can lift about five to one and the raft sinks; a light, tethered foam raft of wetland plants works and helps the pond."},
 "scores": [
  {"test": "Floats with its load", "shown": 0, "fixed": 8, "why": "About 660 lb of soaked soil and pallet on about 125 lb of lift; foam and light media float with lift to spare"},
  {"test": "Safe around the water", "shown": 1, "fixed": 7, "why": "A raft is never a platform; tether it, reach it with a rake, and grid the pond if toddlers visit"},
  {"test": "Good for the pond", "shown": 2, "fixed": 8, "why": "Soil clouds the water; a raft covering 10-25% with wetland plants takes up nutrients"},
  {"test": "Right plants", "shown": 2, "fixed": 7, "why": "Tomatoes need deep, dry soil; rushes, iris and pickerelweed love wet feet"},
  {"test": "Lasts more than one season", "shown": 2, "fixed": 7, "why": "Bottles and pallet rot and sag; wrapped closed-cell foam lasts a decade"},
  {"test": "Cost", "shown": 9, "fixed": 7, "why": "Bottles and a pallet are free; foam, mesh and plants run $100-300"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "An Introduction to Floating Wetlands for Stormwater Ponds", "outlet": "Clemson Cooperative Extension, Land-Grant Press", "url": "https://lgpress.clemson.edu/publication/an-introduction-to-floating-wetlands-for-stormwater-ponds/"},
  {"n": 2, "title": "Floating Treatment Wetlands (U-12) fact sheet", "outlet": "Chesapeake Bay Program", "url": "https://www.chesapeakebay.net/files/documents/attach_c._u-12_floating_treatment_wetland_fact_sheet_final.pdf"},
  {"n": 3, "title": "Pond & Garden Water Safety", "outlet": "Royal Society for the Prevention of Accidents (RoSPA)", "url": "https://www.rospa.com/leisure-safety/water/advice/pond-garden-water"},
  {"n": 4, "title": "EPS Used to Build a Floating Dock and Swim Platform on a Pond", "outlet": "Universal Foam Products", "url": "https://universalconstructionfoam.com/projects/eps-floating-dock-and-swim-platform/"},
  {"n": 5, "title": "Floating Garden Agricultural Practices, Bangladesh", "outlet": "FAO GIAHS", "url": "https://www.fao.org/giahs/giahs-around-the-world/bangladesh-floating-garden-agricultural-practices/en"},
  {"n": 6, "title": "Roof Gardens that are Gentle on the Roof", "outlet": "Perlite Institute", "url": "https://www.perlite.org/roof-gardens-that-are-gentle-on-the-roof/"},
  {"n": 7, "title": "Water gardening with lilies", "outlet": "NC State Extension", "url": "https://extensiongardener.ces.ncsu.edu/wp-content/uploads/2013/08/2001-052.pdf?fwd=no"},
  {"n": 8, "title": "CPSC Warns Backyard Pools Can Be a Fatal Attraction to Toddlers", "outlet": "U.S. Consumer Product Safety Commission", "url": "https://www.cpsc.gov/Newsroom/News-Releases/2001/CPSC-Warns-Backyard-Pools-Can-Be-a-Fatal-Attraction-to-Toddlers-Drowning-Is-a-Leading-Cause-of-Death-to-Children-Under-5"}],
 "kit": {"summary": "A square raft of mesh-wrapped closed-cell foam in a cedar edge, planted through coir or net pots with native wetland plants, tethered so it can be pulled in, sized to cover 10 to 25 percent of the pond.",
  "options": opts,
  "metrics": [
   {"key": "cover_pct", "label": "Pond covered", "unit": "%", "note": "aim for 10-25%; never over 50%"},
   {"key": "plant_sites", "label": "Plant sites", "unit": "plants", "note": "9 in apart"},
   {"key": "load_lb", "label": "Wet load", "unit": "lb", "note": "media, mature plants and frame"},
   {"key": "foam_in", "label": "Foam thickness", "unit": "in", "note": "for twice the lift it needs"},
   {"key": "reserve_lb", "label": "Spare lift", "unit": "lb", "note": "not for people; for birds, rain and growth"},
   {"key": "draft_in", "label": "Sits down by", "unit": "in", "note": "how far the loaded raft sinks"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Make the pond safe first", "start": 0, "days": 3, "gate": "If children under 6 live or visit, a rigid grid or barrier is fixed before any work"},
   {"phase": "Measure and size", "start": 3, "days": 1, "gate": "Pond area and depth known; raft covers 10-25% and floats in at least 12 in of water"},
   {"phase": "Build the raft", "start": 4, "days": 2, "gate": "Foam cut and wrapped; cedar edge fixed; float test unplanted rides level with the top dry"},
   {"phase": "Plant", "start": 6, "days": 1, "gate": "Plants set through the mesh in coir or net pots; no garden soil on the raft"},
   {"phase": "Launch and tether", "start": 7, "days": 1, "gate": "Anchor set with slack for rising water; raft can be pulled in with the rake from the bank"},
   {"phase": "First season", "start": 8, "days": 90, "gate": "Raft rides level; roots reach the water; no one steps on it; cut back crowns in late fall"}],
  "assumptions": "Lift uses closed-cell foam at about 60 lb per cubic foot and wet coir-perlite media at 40 lb per cubic foot, with twice the lift needed. Prices are rough US retail ranges for late 2026, not quotes."}}
out = os.path.join(os.path.dirname(__file__), '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('reel: soil %.0f lb, load %.0f lb, lift %.0f lb, ratio %.1f' % (reel_soil, reel_load, reel_lift, reel_load / reel_lift))
for c in configs:
    if c['pond_sqft'] == 100:
        print(c)
