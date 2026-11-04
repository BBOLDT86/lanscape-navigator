# Builds the backyard concrete skate bowl (Reel Check) from its text and its numbers.
import json, math, os
SHELL_FT = 0.5; BASE_FT = 0.5; CONC_PCF = 145; SOIL_PCF = 110; WATER = 62.4; BAG_CF = 0.6; STORM_IN = 2
RADIUS = {4: 6, 5: 7, 6: 8}           # transition radius by depth, ft (radius over depth, as park guides suggest)
body = open(os.path.join(os.path.dirname(__file__), 'skate-bowl.md'), encoding='utf-8').read()
opts = [{"key": "diameter_ft", "label": "Bowl diameter", "unit": "ft", "values": [20, 24, 28], "default": 24},
        {"key": "depth_ft", "label": "Depth", "unit": "ft", "values": [4, 5, 6], "default": 5}]

def bowl(D, H, R):
    """Round bowl: flat floor, then a circular transition of radius R rising H to the lip.
    Returns skate surface (sq ft), inside volume (cu ft), flat floor diameter (ft), lip angle (deg)."""
    th = math.acos((R - H) / R); x = R * math.sin(th)
    rf = D / 2 - x
    assert rf > 1.5, (D, H)
    n = 400; area = math.pi * rf * rf; vol = 0.0
    for i in range(n):  # integrate the revolved arc
        a0 = th * i / n; a1 = th * (i + 1) / n; am = (a0 + a1) / 2
        r = rf + R * math.sin(am); area += 2 * math.pi * r * R * (a1 - a0)
    # inside volume: cylinder D/2 x H minus the solid under the transition ring
    for i in range(n):
        y0 = H * i / n; y1 = H * (i + 1) / n; ym = (y0 + y1) / 2
        r = rf + math.sqrt(R * R - (R - ym) ** 2); vol += math.pi * r * r * (y1 - y0)
    return area, vol, 2 * rf, math.degrees(th)

configs, mats = [], []
for D in opts[0]['values']:
    for H in opts[1]['values']:
        R = RADIUS[H]; area, vol, flat, lip = bowl(D, H, R)
        conc_cy = area * SHELL_FT / 27
        dig_cf = vol + area * (SHELL_FT + BASE_FT) + math.pi * D * 2 * 1.5     # bowl, shell, base, coping beam trench
        dig_t = dig_cf * SOIL_PCF / 2000
        shell_lb = area * SHELL_FT * CONC_PCF + math.pi * D * 1.5 * 1 * CONC_PCF  # shell plus a 1.5 x 1 ft coping beam
        uplift = (vol + area * SHELL_FT) * WATER                                  # groundwater up to the lip
        storm = math.pi * (D / 2 + 3) ** 2 * STORM_IN / 12 * 7.48
        configs.append({"diameter_ft": D, "depth_ft": H, "concrete_cy": round(conc_cy, 1), "bags_80lb": math.ceil(conc_cy * 27 / BAG_CF),
                        "dig_tons": round(dig_t), "float_ratio": round(shell_lb / uplift, 2), "flat_ft": round(flat, 1),
                        "storm_gal": round(storm)})
        rebar_ft = area * 2 / 1.0 * 1.15                   # #4 bars both ways at 12 in
        sticks = math.ceil(rebar_ft / 20)
        coping_ft = math.ceil(math.pi * D * 1.05)
        deck_sf = math.ceil(math.pi * ((D / 2 + 4) ** 2 - (D / 2) ** 2))
        loads = math.ceil(dig_cf / 27 * 1.25 / 10)
        gravel = round(area * BASE_FT / 27 * 1.15, 1)
        sc_cy = round(conc_cy * 1.15 + deck_sf * 0.33 / 27 * 1.1 + math.pi * D * 1.5 / 27, 1)
        for item, q, u, lo, hi in [
            ("811 locate and a soil/groundwater check", 1, "each", 0, 600),
            ("Structural engineer's drawing", 1, "each", 1200, 3000),
            ("Building permit", 1, "each", 150, 800),
            ("Excavator with operator", 2 if D <= 24 else 3, "days", 900, 1600),
            ("Haul away spoil, 10 cu yd loads", loads, "loads", 300, 550),
            ("Crushed stone base, 6 in", gravel, "cu yd", 50, 90),
            ("#4 rebar, 20 ft sticks, at 12 in both ways", sticks, "sticks", 14, 22),
            ("Shotcrete or pumped concrete, 4,000 psi, incl. deck and beam", sc_cy, "cu yd", 190, 260),
            ("Concrete pump and nozzle crew", 1, "days", 1500, 3000),
            ("Bowl shaping and steel-trowel finish crew", round(area), "sq ft", 18, 35),
            ("2 3/8 in steel pool coping, bent to radius", coping_ft, "ft", 18, 35),
            ("Floor drain, 4 in pipe to daylight, dry well or sump", 1, "set", 600, 2500),
            ("Curing blankets and cure-and-seal", 1, "lot", 200, 500),
            ("Deck rail or fence on the low side", 1, "lot", 300, 1500)]:
            mats.append({"diameter_ft": D, "depth_ft": H, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})
b = {
 "id": "2026-11-21-skate-bowl", "publish": "2026-11-21", "written": os.environ.get("WRITTEN", "2026-11-02T22:40:00-05:00"),
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Outdoor living",
 "title": "The backyard skate bowl: can you dig it and pour it in a weekend?",
 "dek": "Reels show one person shoveling a bowl into the lawn and troweling it smooth from bags of mix by Sunday; real bowls exist, but they take a crew, an engineer's drawing, a drain and a truck of shotcrete.",
 "reel": "A builder marks a circle on the lawn, digs a smooth round bowl five or six feet deep by hand or with a small excavator, and trowels wet concrete from bags up the curved walls. By the end of the clip a skater is carving the finished bowl. No rebar, drain, pump truck or crew ever appears.",
 "verdict": {"shown": 2, "fixed": 6, "line": "Backyard bowls are real; a weekend bag-mix bowl is not, and the version that works is a hired-crew project."},
 "scores": [
  {"test": "Concrete and steel up to the job", "shown": 1, "fixed": 9, "why": "Hand-mixed bags with no steel crack and pop; reinforced 4,000 psi shotcrete lasts decades"},
  {"test": "Shape you can actually skate", "shown": 3, "fixed": 8, "why": "Hand-troweled curves go lumpy; a crew with templates holds the radius"},
  {"test": "Drains and stays put", "shown": 1, "fixed": 8, "why": "A hole in the ground fills with rain and can lift when empty; a floor drain fixes both"},
  {"test": "Safe to ride and to be near", "shown": 3, "fixed": 6, "why": "Falls are the sport; helmets, a smooth lip and a rail on the drop help"},
  {"test": "Doable by a homeowner", "shown": 2, "fixed": 3, "why": "Digging and steel can be DIY; shooting and finishing need pros"},
  {"test": "Cost", "shown": 5, "fixed": 3, "why": "Expect tens of thousands of dollars for a properly built bowl"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "Shotcrete for skateparks (Shotcrete magazine, Fall 2009)", "outlet": "American Shotcrete Association", "url": "https://shotcrete.org/wp-content/uploads/2020/05/2009Fal_Payne.pdf"},
  {"n": 2, "title": "Skatepark design and construction (thesis, 2015)", "outlet": "Theseus, Finnish universities of applied sciences", "url": "https://www.theseus.fi/bitstream/handle/10024/98780/Teodor_Thesis_2015_final.pdf"},
  {"n": 3, "title": "Waxhaw home with backyard skate bowl hits the market for $1.75M", "outlet": "Axios Charlotte", "url": "https://www.axios.com/local/charlotte/2026/10/05/waxhaw-home-with-backyard-skate-bowl-hits-the-market-for-175m"},
  {"n": 4, "title": "Pool popping out of the ground? Here's what to do", "outlet": "Pool Research", "url": "https://poolresearch.com/popped-pool/"},
  {"n": 5, "title": "Skateboarding injuries send nearly 200 kids to emergency departments per day: study", "outlet": "Safety+Health, National Safety Council", "url": "https://safetyandhealthmagazine.com/articles/13927-skateboarding-injuries-send-nearly-200-kids-to-emergency-departments-per-day-study"},
  {"n": 6, "title": "Concreate Skateparks construction method statements", "outlet": "Isle of Man Planning Portal", "url": "https://planningportal.im/md/docs/1318939.md"},
  {"n": 7, "title": "Retaining wall design: when is engineered design required (CRC R404.4)", "outlet": "GoCodebook", "url": "https://gocodebook.com/us/california/california-residential-code/foundations/foundation-walls-and-retaining/when-is-engineered-design-required"}],
 "kit": {"summary": "A round bowl with a flat floor and a pool-style transition, a 6 in shell of 4,000 psi shotcrete on #4 rebar at 12 in over a stone base, steel pipe coping on a concrete beam, and a floor drain, shot and finished by a hired crew from an engineer's drawing.",
  "options": opts,
  "metrics": [
   {"key": "concrete_cy", "label": "Concrete in the shell", "unit": "cu yd", "note": "6 in thick, before deck, beam and waste"},
   {"key": "bags_80lb", "label": "Same shell in 80 lb bags", "unit": "bags", "note": "why nobody pours a bowl from bags"},
   {"key": "dig_tons", "label": "Soil to dig and haul", "unit": "tons", "note": "bowl, shell, base and coping beam"},
   {"key": "float_ratio", "label": "Weight against float-up", "unit": "x", "note": "empty bowl vs groundwater at the lip; under 1 means it can lift"},
   {"key": "flat_ft", "label": "Flat floor", "unit": "ft across", "note": "between the transitions"},
   {"key": "storm_gal", "label": "Water from a 2 in storm", "unit": "gallons", "note": "the floor drain must take it"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Site, soil and groundwater check", "start": 0, "days": 10, "gate": "Utilities marked; test hole at full depth stays dry for 48 hours; a drain outlet exists"},
   {"phase": "Engineer's drawing and permit", "start": 10, "days": 21, "gate": "Stamped drawing for shell, steel, drain and float-up; permit issued"},
   {"phase": "Dig and shape", "start": 31, "days": 3, "gate": "Templates check the radius every few feet; floor pitched to the drain"},
   {"phase": "Base, drain and steel", "start": 34, "days": 3, "gate": "Drain tested with a hose; rebar on chairs at 12 in; inspection passed"},
   {"phase": "Shoot and finish", "start": 37, "days": 2, "gate": "Shell at full thickness; coping set to the radius; steel-trowel finish"},
   {"phase": "Wet cure", "start": 39, "days": 7, "gate": "Kept damp under blankets 7 days; no skating"},
   {"phase": "Deck, rail and full cure", "start": 46, "days": 21, "gate": "Joints cut and sealed; rail on any drop; 28 days before hard riding"}],
  "assumptions": "A round bowl modeled as a flat floor plus a circular transition of 6, 7 or 8 ft radius, a 6 in shell and base, soil at 110 lb and concrete at 145 lb per cu ft. Quantities include 10-15% waste; prices are rough US ranges for late 2026 and vary widely by region and crew, not quotes."}}
out = os.path.join(os.path.dirname(__file__), '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for c in configs: print(c)
