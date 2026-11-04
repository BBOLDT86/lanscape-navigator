# Builds the salvaged-window greenhouse Reel Check from its text and its numbers.
import json, math, os
SUN = 250        # midday sun on a clear day, BTU per hour per sq ft of floor (about 800 W per sq m)
KEEP = 0.75      # share of that sun the glazing lets in and the floor turns to heat
U_GLASS = 1.13   # single glass, BTU/hr/sq ft/F (Alabama Extension ANR-2925)
U_PC = 0.65      # 8 mm twin-wall polycarbonate
U_PLY = 0.6      # plywood knee wall, rough
VENT = 0.20      # vent area, each of ridge and side, as a share of floor (UMass; ASABE 15-20%)
SASH_W, SASH_H = 30, 36      # typical salvaged sash, inches
KNEE_IN, WALL_IN = 18, 72    # knee wall and wall height, inches
body = open(os.path.join(os.path.dirname(__file__), 'window-greenhouse.md'), encoding='utf-8').read()


def heat(L, W, roof_u, glass):
    """Steady sealed temperature rise: sun in, conduction out (no venting, infiltration ignored)."""
    floor = L * W
    walls = 2 * (L + W) * WALL_IN / 12
    rise = W / 4                         # 6:12 roof pitch
    roof = 2 * math.hypot(W / 2, rise) * L
    gable = W / 2 * rise * 2
    ua = U_GLASS * glass + roof_u * (roof + gable) + U_PLY * (walls - glass)
    return floor * SUN * KEEP / ua, roof


# The reel: a 10 x 8 box of single glass on every face, roof included, no vents.
reel_rise, _ = heat(10, 8, U_GLASS, 0.9 * 2 * 18 * WALL_IN / 12)

opts = [{"key": "length_ft", "label": "Length", "unit": "ft", "values": [8, 10, 12, 14, 16], "default": 10},
        {"key": "width_ft", "label": "Width", "unit": "ft", "values": [6, 8, 10], "default": 8}]
configs, mats = [], []
for L in opts[0]['values']:
    for W in opts[1]['values']:
        floor = L * W
        per_side = math.floor(L * 12 / (SASH_W + 2))
        per_end = max(0, math.floor((W * 12 - 36) / (SASH_W + 2)))   # one end loses a 36 in door
        sashes = 2 * per_side + per_end + math.floor(W * 12 / (SASH_W + 2))
        vent = round(VENT * floor)
        rise, roof = heat(L, W, U_PC, sashes * SASH_W * SASH_H / 144)
        configs.append({"length_ft": L, "width_ft": W, "floor_sqft": floor, "sashes": sashes,
                        "vent_sqft": vent, "sealed_rise_f": round(rise), "roof_sqft": math.ceil(roof)})
        bays = math.ceil(L / 2) + 1                       # wall-rafter frames at 2 ft
        studs = bays * 4 + 8                              # 2x4 x 8: two studs and two rafters per frame, plus ends
        timbers = math.ceil(2 * (L + W) / 8) * 2          # two courses of 8 ft landscape timber
        pc_sheets = math.ceil(roof / 48 * 1.1)            # 4 x 12 ft twin-wall sheets
        knee_sheets = math.ceil(2 * (L + W) * 1.5 / 32 * 1.1)
        openers = max(2, math.ceil(vent / 2 / 6))         # each roof vent about 6 sq ft
        for item, q, u, lo, hi in [
            ("Salvaged window sashes, about 30 x 36 in", sashes, "sashes", 0, 15),
            ("Lead test kits (one per paint color or source)", 2, "kits", 10, 25),
            ("Treated landscape timbers, 8 ft (two courses)", timbers, "timbers", 7, 11),
            ("Rebar stakes, 24 in, to pin the timbers", math.ceil(2 * (L + W) / 3), "stakes", 2, 4),
            ("2x4 x 8 ft, studs, rafters and plates", studs, "boards", 4, 6.5),
            ("3/4 in plywood for gussets and knee wall", knee_sheets + 1, "sheets", 45, 70),
            ("Twin-wall polycarbonate roof, 4 x 12 ft, 8 mm", pc_sheets, "sheets", 110, 190),
            ("Polycarbonate closures, H-channel and screws", 1, "lot", 60, 120),
            ("Automatic wax-cylinder vent openers", openers, "each", 35, 70),
            ("Glazing points, exterior caulk, 1x4 battens", 1, "lot", 80, 160),
            ("Exterior paint or stain for the frame", 1, "gallon", 35, 55),
            ("Hurricane ties and structural screws", 1, "lot", 40, 80),
            ("Building permit, if your town requires one", 1, "each", 0, 150)]:
            mats.append({"length_ft": L, "width_ft": W, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})

b = {
 "id": "2026-11-09-window-greenhouse", "publish": "2026-11-09", "written": "2026-11-02T21:46:33-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Garden",
 "title": "The old-window greenhouse: charming, cheap and a little dangerous?",
 "dek": "A greenhouse pieced together from salvaged windows is one of the feed's prettiest builds; the walls can work, but the glass roof, the old paint and the missing vents need fixing first.",
 "reel": "Stacks of mismatched old wooden windows, chipped paint and all, are screwed edge to edge into a small cottage-style greenhouse on bare ground, with more windows laid across the roof. The finished house glows at sunset, full of seedlings and hanging plants, with no vents or foundation in sight.",
 "verdict": {"shown": 3, "fixed": 7, "line": "As filmed it is a glass roof over your head and an oven by noon; with a plastic roof, vents and a real frame, the walls of old windows make a fine greenhouse."},
 "scores": [
  {"test": "Stays in growing range on a sunny day", "shown": 1, "fixed": 7, "why": "Sealed, it settles about 40 F above the air; vents at 20% of the floor keep it near outdoors"},
  {"test": "Safe glass", "shown": 2, "fixed": 7, "why": "Old annealed glass overhead breaks into blades; polycarbonate roof and an 18 in knee wall fix it"},
  {"test": "Stands up to wind and snow", "shown": 2, "fixed": 7, "why": "Window frames are not a structure; a 2x4 frame on a pinned timber base carries the loads"},
  {"test": "Lead-safe", "shown": 2, "fixed": 8, "why": "Pre-1978 sashes often carry lead paint; test, wet-scrape and seal before building"},
  {"test": "Cost against a kit", "shown": 9, "fixed": 7, "why": "Windows are free; the roof, frame and vent openers are not"},
  {"test": "Doable by one handy person", "shown": 5, "fixed": 6, "why": "Mismatched sashes make every bay custom; plan for a helper on the roof"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "Build a Greenhouse With Upcycled Windows", "outlet": "Mother Earth News", "url": "https://www.motherearthnews.com/diy/build-a-greenhouse-with-upcycled-windows-zmrz19fmzgsch/"},
  {"n": 2, "title": "Ventilation for Greenhouses", "outlet": "UMass Amherst Extension", "url": "https://www.umass.edu/agriculture-food-environment/greenhouse-floriculture/fact-sheets/ventilation-for-greenhouses"},
  {"n": 3, "title": "Controlling the Greenhouse Environment for Vegetable Crops (ANR-2925)", "outlet": "Alabama Cooperative Extension System", "url": "https://www.aces.edu/blog/topics/crop-production/controlling-the-greenhouse-environment-for-vegetable-crops/"},
  {"n": 4, "title": "Safety Glazing", "outlet": "Shasta County Building Division", "url": "https://www.shastacounty.gov/sites/default/files/fileattachments/building/page/2658/safety_glazing.pdf"},
  {"n": 5, "title": "WAC 51-50-2405: Sloped glazing and skylights", "outlet": "Washington State Legislature", "url": "https://lawfilesext.leg.wa.gov/law/WAC/WAC%20%2051%20%20TITLE/WAC%20%2051%20-%2050%20%20CHAPTER/WAC%20%2051%20-%2050%20-2405.htm"},
  {"n": 6, "title": "Lead In Paint & Dust fact sheet", "outlet": "Erie County Department of Health", "url": "https://www3.erie.gov/envhealth/sites/www3.erie.gov.envhealth/files/2022-10/leadpaintdustfactsheet.pdf"},
  {"n": 7, "title": "Home Repairs and Renovations: What You Should Know About Lead-Based Paint", "outlet": "Connecticut Department of Public Health", "url": "https://portal.ct.gov/-/media/departments-and-agencies/dph/dph/environmental_health/lead/rrp/repairsrenovationspdf.pdf"},
  {"n": 8, "title": "Residential permit exemptions (IRC R105.2)", "outlet": "City of Federal Way", "url": "https://www.federalwaywa.gov/page/residential-permit-exemptions"}],
 "kit": {"summary": "A gable greenhouse on a pinned timber base, framed in 2x4s at 2 ft, with salvaged sashes in the walls above an 18 in plywood knee wall, a twin-wall polycarbonate roof and automatic vents.",
  "options": opts,
  "metrics": [
   {"key": "floor_sqft", "label": "Floor", "unit": "sq ft", "note": "many towns skip the permit under 200 sq ft; check yours"},
   {"key": "sashes", "label": "Sashes to collect", "unit": "sashes", "note": "about 30 x 36 in; collect a few spares"},
   {"key": "vent_sqft", "label": "Vent area", "unit": "sq ft", "note": "at the ridge, and the same again low on the walls"},
   {"key": "sealed_rise_f", "label": "Heat-up if sealed", "unit": "F above outdoors", "note": "clear midday sun, vents shut"},
   {"key": "roof_sqft", "label": "Polycarbonate roof", "unit": "sq ft", "note": "6:12 pitch, both slopes"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Collect and test windows", "start": 0, "days": 30, "gate": "Enough sashes of matching height; every painted sash lead-tested; cracked panes set aside"},
   {"phase": "Check rules and design to the sashes", "start": 21, "days": 9, "gate": "Permit need confirmed; drawing has frame spacing set by actual sash widths"},
   {"phase": "Strip and seal sashes", "start": 30, "days": 7, "gate": "Loose paint wet-scraped, debris bagged, sashes primed and reglazed"},
   {"phase": "Base", "start": 30, "days": 3, "gate": "Timbers level within 1/2 in and pinned with rebar every 3 ft; diagonals equal"},
   {"phase": "Frame and knee wall", "start": 37, "days": 4, "gate": "Frames plumb with gussets and hurricane ties; knee wall sheathed; no racking when pushed"},
   {"phase": "Roof and vents", "start": 41, "days": 2, "gate": "Polycarbonate fixed with closures; ridge vents open freely and the openers lift at about 70 F"},
   {"phase": "Set windows", "start": 43, "days": 3, "gate": "Sashes held by stops and battens, flashed between rows, caulked; at least two low wall sashes open"},
   {"phase": "First sunny-day test", "start": 46, "days": 7, "gate": "With vents open, inside stays within 15 F of outdoors at noon; add shade cloth if not"}],
  "assumptions": "Heat figures use clear midday sun at about 250 BTU per hour per sq ft, 75% captured, and textbook U-values; sash count assumes 30 in sashes with 2 in framing between. Prices are rough US retail ranges for late 2026, not quotes."}}
out = os.path.join(os.path.dirname(__file__), '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('reel sealed rise %.0f F' % reel_rise)
print(configs[4])
