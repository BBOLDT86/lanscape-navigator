# Builds the indoor waterfall wall Reel Check from its text and its numbers.
import datetime as dt, json, math, os
from zoneinfo import ZoneInfo
G = 62.4
here = os.path.dirname(__file__)
body = open(os.path.join(here, 'waterfall-wall.md'), encoding='utf-8').read()


def psat(c): return 0.61094 * math.exp(17.625 * c / (c + 243.04))
def xr(c, rh): p = psat(c) * rh; return 0.622 * p / (101.325 - p)


def evap_gal_day(area_sqft, air_ms, water_c):  # Engineering Toolbox formula; room 72 F at 45% humidity
    return (25 + 19 * air_ms) * area_sqft * 0.0929 * (xr(water_c, 1) - xr(22.2, .45)) * 24 / 3.785


def pump_w(gph, head_ft, eff=0.25):  # small fountain pumps run near 25% wire-to-water
    return gph / 60 * head_ft / 3960 / eff * 746


# The reel's wall, for the text: 8 ft wide, 9 ft tall stone face, a sheet of water at 1,500 gph per ft [Pond Trade]
RW, RH = 8, 9
reel_gph = 1500 * RW
reel = {"gph": reel_gph, "gpm": reel_gph / 60, "fall_ft_s": round(math.sqrt(2 * 32.2 * RH), 1),
        "evap_wall": round(evap_gal_day(RW * RH, 1.0, 21.1), 1), "evap_basin": round(evap_gal_day(RW * 1.5, 0.3, 21.1), 1),
        "pump_w": round(pump_w(reel_gph, RH + 3, 0.4)), "cool_btu_h": None}
reel["cool_btu_h"] = round((reel["evap_wall"] + reel["evap_basin"]) * 8.34 * 1050 / 24)
print('reel', reel)

FLOW = 600  # gph per ft of width, near the top of a commercial glass water wall's range; turned down with a valve
opts = [{"key": "width_ft", "label": "Width", "unit": "ft", "values": [3, 4, 5, 6], "default": 4},
        {"key": "height_ft", "label": "Height", "unit": "ft", "values": [6, 7, 8], "default": 7}]
configs, mats = [], []
for w in opts[0]['values']:
    for h in opts[1]['values']:
        gph = FLOW * w
        basin_gal = w * 1.25 * (8 / 12) * 7.48 + 0.5 * w * 7.48 * 0.2  # 15 in wide, 8 in of water, plus top trough
        glass_lb = w * h * 6.5  # 1/2 in tempered
        frame_lb = 30 + 12 * (w + h)
        weight = basin_gal * 8.34 + glass_lb + frame_lb + 25 * w
        evap = evap_gal_day(w * h, 0.5, 20) * 0.6 + evap_gal_day(w * 1.25, 0.2, 20) * 0.3  # film on the glass; basin mostly lidded
        configs.append({"width_ft": w, "height_ft": h, "flow_gph": gph, "basin_gal": round(basin_gal),
                        "weight_lb": round(weight), "evap_gal_day": round(evap, 1), "pump_w": round(pump_w(gph, h + 2))})
        for item, q, u, lo, hi in [
            ("Tempered glass panel, 1/2 in, low-iron, cut to size", w * h, "sq ft", 30, 55),
            ("Stainless basin and top trough, welded, by a fabricator", w, "ft", 350, 700),
            ("Stainless frame, brackets and wall anchors", 1, "lot", 250 + 40 * w, 500 + 90 * w),
            ("Mag-drive pump with flow valve", 1, "each", 120 + 0.03 * gph, 260 + 0.06 * gph),
            ("UV sterilizer and cartridge filter", 1, "set", 180, 420),
            ("Auto top-off valve, float switch and overflow", 1, "set", 90, 220),
            ("Free-chlorine test kit and a year of sanitizer", 1, "lot", 60, 140),
            ("Waterproof membrane and tile tray under the basin", w * 2 + 6, "sq ft", 8, 18),
            ("GFCI circuit and switched outlet, by an electrician", 1, "circuit", 350, 800),
            ("LED strip, 12 V, rated for wet locations", w, "ft", 15, 45),
            ("Electrical permit", 1, "each", 50, 250)]:
            mats.append({"width_ft": w, "height_ft": h, "item": item, "qty": q, "unit": u, "low": round(q * lo), "high": round(q * hi)})

b = {
 "id": "2026-11-12-waterfall-wall", "publish": "2026-11-12",
 "written": dt.datetime.now(ZoneInfo('America/New_York')).replace(microsecond=0).isoformat(),
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Indoor",
 "title": "The indoor waterfall wall: a calm feature or a humidifier you can't turn off?",
 "dek": "A stone wall pouring a curtain of water into the living room looks serene, but at that flow it puts gallons of water into the air every day and can breed Legionella, so the version that works is a thin film down glass.",
 "reel": "A living-room feature wall is clad in stacked stone, a trough is hidden along the ceiling, and a thick curtain of water pours down the full height into a pebble trench in the floor. The finished room is shown with the family relaxing beside it, with no pump, drain, splash guard or vent in view.",
 "verdict": {"shown": 3, "fixed": 7, "line": "As filmed it is a 12,000 gallon-an-hour indoor rainstorm; a slow film down glass, sanitized and on a GFCI, is a reasonable weekend-plus project."},
 "scores": [
  {"test": "Pump and plumbing add up", "shown": 3, "fixed": 8, "why": "200 gpm needs a pool pump and big pipe; a film needs a small fountain pump"},
  {"test": "Water stays in the feature", "shown": 2, "fixed": 7, "why": "A 9 ft drop splashes; water clinging to glass barely does"},
  {"test": "Humidity in the house", "shown": 2, "fixed": 6, "why": "About 17 gal a day as shown; about 2.6 for a 4 by 7 ft film"},
  {"test": "Germs in the spray", "shown": 2, "fixed": 7, "why": "Aerosols spread Legionella; cool water, chlorine or UV and cleaning control it"},
  {"test": "Electrical safety", "shown": 3, "fixed": 8, "why": "Fountain equipment needs GFCI protection and bonding"},
  {"test": "Cost and upkeep", "shown": 4, "fixed": 6, "why": "Low parts cost; weekly testing and monthly cleaning are the price"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "Tech tip: how to calculate waterfall flow", "outlet": "POND Trade Magazine", "url": "https://www.pondtrademag.com/tech-tip-how-to-calculate-waterfall-flow/"},
  {"n": 2, "title": "Controlling Legionella in decorative fountains", "outlet": "CDC", "url": "https://www.cdc.gov/control-legionella/php/toolkit/decorative-fountain-module.html"},
  {"n": 3, "title": "Outbreak of Legionnaires' disease and Pontiac fever at a Chicago hotel linked to a decorative fountain", "outlet": "PubMed Central (NIH)", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC4692259/"},
  {"n": 4, "title": "NEC rules for pools, tubs, fountains, and spas, part 5", "outlet": "EC&M", "url": "https://www.ecmweb.com/national-electrical-code/nec-rules-pools-tubs-fountains-and-spas-part-5"},
  {"n": 5, "title": "Indoor water feature specification (section 13 12 00)", "outlet": "ARCAT / Harmonic Environments", "url": "https://www.arcat.com/spec-doc/harmonic-environments-45070/13_12_00har/doc"},
  {"n": 6, "title": "Evaporation from a water surface", "outlet": "The Engineering ToolBox", "url": "https://www.engineeringtoolbox.com/evaporation-water-surface-d_690.html"},
  {"n": 7, "title": "Waterslide inner glass: product data", "outlet": "Watershow", "url": "https://watershow.de/fileadmin/user_upload/documents/pages/Wasser_Ablauf/2HGI_waterslide_inner_glass.pdf"},
  {"n": 8, "title": "Indoor koi pond (forum thread)", "outlet": "Fine Homebuilding", "url": "https://finehomebuilding.com/forum/indoor-koi-pond"},
  {"n": 9, "title": "10ft water wall (forum thread)", "outlet": "Trouble Free Pool", "url": "https://www.troublefreepool.com/threads/10ft-water-wall.58284"}],
 "kit": {"summary": "A wall-hung panel of tempered glass with a thin film of water running down it from a stainless trough into a lidded stainless basin, with UV, chlorine, auto top-off and a GFCI circuit.",
  "options": opts,
  "metrics": [
   {"key": "flow_gph", "label": "Pump size", "unit": "gal per hour", "note": "maximum; turn it down until the film is even"},
   {"key": "basin_gal", "label": "Water in the system", "unit": "gallons", "note": "basin and top trough"},
   {"key": "weight_lb", "label": "Filled weight", "unit": "lb", "note": "most of it bears on the floor at the basin"},
   {"key": "evap_gal_day", "label": "Evaporation", "unit": "gal per day", "note": "into the room; plan your humidity around it"},
   {"key": "pump_w", "label": "Pump power", "unit": "watts", "note": "running all day, every day"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Plan and permit", "start": 0, "days": 10, "gate": "Wall can take the anchors; electrical permit issued; humidity plan made"},
   {"phase": "Fabricate basin, trough and glass", "start": 3, "days": 28, "gate": "Basin seams welded and water-tested by the shop"},
   {"phase": "Waterproof tray and power", "start": 10, "days": 4, "gate": "Membrane flood-tested 24 hours; GFCI trips when tested"},
   {"phase": "Mount frame, basin and glass", "start": 31, "days": 2, "gate": "Trough level within 1/32 in over its width"},
   {"phase": "Wet test and tune", "start": 33, "days": 5, "gate": "Even film edge to edge; no drips past the basin lip; overflow works"},
   {"phase": "Sanitize and run in", "start": 38, "days": 14, "gate": "Free chlorine holds in range; water stays under 77 F; room humidity under 50%"}],
  "assumptions": "Flow is sized at 600 gph per foot of width, evaporation for 68 F water in a 72 F room at 45% humidity, and pumps at 25% efficiency. Prices are rough US ranges for late 2026, not quotes; not an engineered design."}}
out = os.path.join(here, '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for c in configs:
    if c['width_ft'] == 4 and c['height_ft'] == 7: print('default', c)
