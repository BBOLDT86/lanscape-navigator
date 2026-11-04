# Builds the secret-room-under-the-floor Reel Check from its text and its numbers.
import datetime as dt, json, math, os
from zoneinfo import ZoneInfo
here = os.path.dirname(__file__)
body = open(os.path.join(here, 'trapdoor-room.md'), encoding='utf-8').read()
SOIL = 100  # lb per cu ft, moist soil

# The reel's dig, for the text: a 12 x 14 ft room, 8 ft clear, dug under a living room from a hatch
L, W, CLEAR = 14, 12, 8
dig = (L + 2) * (W + 2) * (CLEAR + 1.5)  # a foot of overdig for walls each side, 18 in for slab, footing and gravel
co2_h = L * W * CLEAR * (5000 - 420) * 1e-6 / (4 * 0.0106) / 60  # four people resting, sealed room, to 5,000 ppm
reel = {"cu_yd": round(dig / 27), "tons": round(dig * SOIL / 2000), "buckets": round(dig / 0.67),
        "co2_hours": round(co2_h, 1)}
print('reel', reel)

# The kit: a room partitioned out of an existing basement, with a hidden hatch and ship's ladder from above
# and a normal (hidden) door into the rest of the basement, which keeps its stair and egress.
opts = [{"key": "room_len_ft", "label": "Room length", "unit": "ft", "values": [8, 10, 12, 14], "default": 10},
        {"key": "rise_in", "label": "Floor to floor", "unit": "in", "values": [96, 105, 114], "default": 105}]
HW, HL = 30, 44  # hatch clear opening, inches; long side runs along the ladder
configs, mats = [], []
for rl in opts[0]['values']:
    for rise in opts[1]['values']:
        area = rl * 10
        run = rise / math.tan(math.radians(68))
        lid_lb = HW * HL / 144 * 7.5  # 3/4 in plywood, 2x4 frame on edge, finished floor
        strut = 0.8 * lid_lb * (HL / 2) / (2 * 6)  # two struts, about 6 in of lever at closed
        configs.append({"room_len_ft": rl, "rise_in": rise, "room_sqft": area, "ladder_run_in": round(run),
                        "hatch_lb": round(lid_lb), "strut_lb_each": round(strut / 5) * 5, "air_changes": round(50 * 60 / (area * 8), 1)})
        wall_lf = rl + 10  # two new walls; the other two are foundation
        studs = math.ceil(wall_lf * 0.75 * 1.1) + 6
        drywall = math.ceil(((wall_lf * 2 + rl * 2 + 20) * 8 + area) / 32 * 1.12)
        for item, q, u, lo, hi in [
            ("Radon test kit, before and after (two tests)", 2, "kits", 15, 30),
            ("Engineer's letter for the floor opening and header", 1, "each", 400, 1000),
            ("Building and electrical permits", 1, "lot", 150, 600),
            ("LVL or doubled 2x headers, joist hangers and hardware", 1, "lot", 180, 450),
            ("Ship's ladder, steel or hardwood kit, with handrails", 1, "each", 900, 2200),
            ("Hatch lid framing, plywood and matching floor", 1, "lot", 120, 300),
            ("Gas struts, rated pair, and hold-open stop", 2, "struts", 40, 90),
            ("Piano hinge or heavy butt hinges, through-bolted", 1, "set", 40, 120),
            ("Guard rail that drops in around the open hatch", 1, "each", 150, 450),
            ("2x4 studs for the new walls", studs, "studs", 5, 8),
            ("Drywall, 1/2 in, 4 x 8 sheets, and finishing", drywall, "sheets", 18, 30),
            ("Hidden bookcase door, prehung", 1, "each", 900, 2500),
            ("Exhaust fan with inline duct to outside", 1, "each", 150, 350),
            ("Smoke and CO alarm, interconnected", 1, "each", 45, 90),
            ("Lighting and outlets, by an electrician", 1, "lot", 400, 1200)]:
            mats.append({"room_len_ft": rl, "rise_in": rise, "item": item, "qty": q, "unit": u, "low": round(q * lo), "high": round(q * hi)})

b = {
 "id": "2026-11-17-trapdoor-room", "publish": "2026-11-17",
 "written": dt.datetime.now(ZoneInfo('America/New_York')).replace(microsecond=0).isoformat(),
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Indoor",
 "title": "The secret room under the floor: can you dig one through a trapdoor?",
 "dek": "A living-room floor lifts away to reveal a hidden room dug out underneath, but the dig is about 100 tons of soil under your own foundation, so the version that works borrows space from a basement you already have.",
 "reel": "A section of living-room floor swings up on hidden hinges, or a whole panel lifts on a motor, to reveal a ladder down into a finished secret room. A montage shows the owner digging it out by hand through the opening, then pouring walls and furnishing it. No shoring, permit, second exit or air supply ever appears.",
 "verdict": {"shown": 1, "fixed": 7, "line": "Digging a room under a lived-in house by hand is a cave-in waiting to happen; a hidden hatch into a room partitioned from an existing basement is a fun, legal build."},
 "scores": [
  {"test": "The dig is survivable", "shown": 0, "fixed": 9, "why": "Hand-digging beside footings risks collapse; the kit digs nothing"},
  {"test": "House stays standing", "shown": 1, "fixed": 8, "why": "Undermined footings as shown; a framed opening with engineered headers"},
  {"test": "Air you can breathe", "shown": 1, "fixed": 8, "why": "Sealed, CO2 climbs fast; a vented basement room with a fan and a radon test"},
  {"test": "A way out in a fire", "shown": 0, "fixed": 8, "why": "One hatch as shown; the kit keeps the basement's stair and egress window"},
  {"test": "The hatch is safe to use", "shown": 3, "fixed": 7, "why": "Struts, hold-open stop and a drop-in guard around the hole"},
  {"test": "Cost", "shown": 2, "fixed": 6, "why": "A pro dig-out runs $50,000 and up; the kit is a few thousand"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "Trenching and excavation safety fact sheet", "outlet": "OSHA (via Montana State University LTAP)", "url": "https://www.montana.edu/ltap/documents/2_osha_trench_factsheet.pdf"},
  {"n": 2, "title": "1910.146: Permit-required confined spaces", "outlet": "OSHA", "url": "https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.146"},
  {"n": 3, "title": "How much does it cost to dig out a basement?", "outlet": "This Old House", "url": "https://www.thisoldhouse.com/foundations/cost-to-dig-out-a-basement"},
  {"n": 4, "title": "How much does it cost to convert a crawl space into a basement?", "outlet": "HomeAdvisor", "url": "https://www.homeadvisor.com/cost/foundations/convert-crawl-space-to-basement/"},
  {"n": 5, "title": "Emergency escape and rescue openings", "outlet": "City of Dubuque", "url": "https://www.cityofdubuque.org/DocumentCenter/View/327/Emergency-Escape-and-Rescue-Openings"},
  {"n": 6, "title": "Test your home for radon: radon kills 21,000 Americans each year", "outlet": "U.S. EPA", "url": "https://www.epa.gov/archive/epa/newsreleases/test-your-home-radon-you-may-prevent-lung-cancer-radon-kills-21000-americans-each-year.html"},
  {"n": 7, "title": "Trap door hardware (forum thread)", "outlet": "Fine Homebuilding", "url": "https://finehomebuilding.com/forum/trap-door-hardware"},
  {"n": 8, "title": "Floor access doors specification (section 08 31 23)", "outlet": "ARCAT / The BILCO Company", "url": "https://www.arcat.com/specification/the-bilco-company-30940/08_31_23tbc"},
  {"n": 9, "title": "2018 residential stair guide", "outlet": "Town of Timnath", "url": "https://timnath.org/wp-content/uploads/2022/03/2018-RESIDENTIAL-STAIR-GUIDE.pdf"},
  {"n": 10, "title": "Section R502: wood floor framing", "outlet": "GoCodeBook (California Residential Code)", "url": "https://gocodebook.com/library/us/ca/ca-residential-code/chapter-5-floors/section-r502-wood-floor-framing"}],
 "kit": {"summary": "A room framed off one corner of an existing basement, reached from above by a hidden 30 by 44 inch floor hatch and a ship's ladder, and from the basement by a hidden bookcase door.",
  "options": opts,
  "metrics": [
   {"key": "room_sqft", "label": "Room size", "unit": "sq ft", "note": "10 ft wide, against two foundation walls"},
   {"key": "ladder_run_in", "label": "Ladder footprint", "unit": "in", "note": "at 68 degrees, measured along the floor"},
   {"key": "hatch_lb", "label": "Hatch lid weight", "unit": "lb", "note": "30 by 44 in, finished to match the floor"},
   {"key": "strut_lb_each", "label": "Gas struts", "unit": "lb each", "note": "a pair; lid should still need a push to close"},
   {"key": "air_changes", "label": "Air changes", "unit": "per hour", "note": "from a 50 cfm fan running all the time"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Radon test and plan", "start": 0, "days": 7, "gate": "Basement radon under 4 pCi/L, or a mitigation system is planned"},
   {"phase": "Engineer and permits", "start": 7, "days": 14, "gate": "Header sizes stamped; building and electrical permits issued"},
   {"phase": "Frame the floor opening", "start": 21, "days": 2, "gate": "Headers and trimmers in hangers; floor above shows no sag"},
   {"phase": "Frame the room and bookcase door", "start": 23, "days": 4, "gate": "Basement stair and egress window still reachable from the room"},
   {"phase": "Power, fan and alarms", "start": 27, "days": 3, "gate": "Rough-in inspection passed; fan exhausts outside"},
   {"phase": "Drywall and finish", "start": 30, "days": 10, "gate": "Smoke and CO alarm sound; door opens from inside without a key"},
   {"phase": "Hatch, struts, ladder and guard", "start": 40, "days": 3, "gate": "Lid stays open at its stop; guard in place; ladder bolted top and bottom"},
   {"phase": "Final inspection and retest", "start": 43, "days": 7, "gate": "Final passed; radon retested in the finished room"}],
  "assumptions": "Soil at 100 lb per cu ft, a hatch lid at 7.5 lb per sq ft, a ship's ladder at 68 degrees, and a 50 cfm exhaust fan. Prices are rough US ranges for late 2026, not quotes; not an engineered design."}}
out = os.path.join(here, '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for c in configs:
    if c['room_len_ft'] == 10 and c['rise_in'] == 105: print('default', c)
