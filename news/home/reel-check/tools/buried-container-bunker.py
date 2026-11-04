# Builds the buried shipping-container bunker (Reel Check) from its text and its numbers.
import json, math, os
SOIL = 120.0      # moist backfill, lb per cu ft
K0 = 0.5          # at-rest earth pressure coefficient for a wall that cannot move
CO2_CFM = 0.0106  # CO2 one resting adult exhales, cu ft per min (about 0.3 L/min)
OUT_PPM = 420
here = os.path.dirname(__file__)
body = open(os.path.join(here, 'buried-container-bunker.md'), encoding='utf-8').read()

# container: outside length ft, interior L x W x H ft, people it sleeps
BOX = {10: (9.9, 9.25, 7.7, 7.85, 2), 20: (19.9, 19.3, 7.7, 7.85, 4), 40: (40.0, 39.5, 7.7, 7.85, 6)}
opts = [{"key": "length_ft", "label": "Container", "unit": "ft", "values": [10, 20, 40], "default": 20},
        {"key": "cover_ft", "label": "Soil over the lid", "unit": "ft", "values": [2, 3, 4], "default": 3}]

def bare(length, cover):
    """Loads on a bare container buried with its roof under `cover` ft of soil."""
    lo, il, iw, ih, _ = BOX[length]
    roof_psf = SOIL * cover
    roof_tons = roof_psf * lo * 8 / 2000
    top, base = K0 * SOIL * cover, K0 * SOIL * (cover + 8.5)
    return roof_psf, roof_tons, (top + base) / 2, base

configs, mats = [], []
for L in opts[0]['values']:
    for c in opts[1]['values']:
        lo, il, iw, ih, people = BOX[L]
        air = il * iw * ih
        hours = air * (5000 - OUT_PPM) / 1e6 / (people * CO2_CFM) / 60
        # vault: 1 ft clear around the box; 10 in walls and lid, 8 in floor
        vin_l, vin_w, vin_h = lo + 2, 10.0, 9.5
        t_wall, t_lid, t_floor = 10 / 12, 10 / 12, 8 / 12
        out_l, out_w = vin_l + 2 * t_wall, vin_w + 2 * t_wall
        conc = (out_l * out_w * (t_lid + t_floor) + 2 * (out_l + vin_w) * t_wall * vin_h) / 27
        lid_tons = SOIL * c * out_l * out_w / 2000
        depth = c + t_lid + vin_h + t_floor + 0.5          # plus 6 in of gravel under the slab
        base_psf = K0 * SOIL * depth
        # excavation: 2 ft working room each side at the bottom, sides laid back 1:1 (OSHA type B)
        bl, bw = out_l + 4, out_w + 4
        tl, tw = bl + 2 * depth, bw + 2 * depth
        dig = depth / 3 * (bl * bw + tl * tw + math.sqrt(bl * bw * tl * tw)) / 27
        vent = people * 15                                   # cfm: 15 per person keeps CO2 near 1,100 ppm
        configs.append({"length_ft": L, "cover_ft": c, "people": people, "sealed_hours": round(hours, 1),
                        "lid_tons": round(lid_tons, 1), "base_psf": round(base_psf), "dig_cu_yd": round(dig),
                        "vent_cfm": vent})
        membrane = math.ceil((2 * (out_l + out_w) * (vin_h + 1.5) + out_l * out_w) * 1.15)
        rebar_lb = math.ceil(conc * 1.1 * 160)
        gravel = round((bl * bw * 0.5 + 2 * (out_l + out_w) * 1.5 * vin_h) / 27 * 1.1, 1)
        for item, q, u, lo_p, hi_p in [
            ("Used one-trip or cargo-worthy container", 1, "each", {10: 2500, 20: 3000, 40: 4500}[L], {10: 4500, 20: 5500, 40: 8000}[L]),
            ("Excavation and backfill, machine and operator", round(dig), "cu yd", 12, 25),
            ("Ready-mix concrete for the vault (walls, floor, lid), with 10% waste", round(conc * 1.1, 1), "cu yd", 170, 240),
            ("Rebar, placed (about 160 lb per cu yd)", rebar_lb, "lb", 1.2, 2.0),
            ("Concrete forming and pump, by the contractor", 1, "lot", 4000 + 150 * L, 9000 + 300 * L),
            ("Sheet waterproofing membrane and protection board", membrane, "sq ft", 3, 6),
            ("Drain gravel and filter fabric", gravel, "cu yd", 45, 80),
            ("Perforated footing drain and sump with pump", 1, "set", 600, 1500),
            ("Powered intake and exhaust fans, filters, hand-crank backup", 1, "set", 1200, 4000),
            ("Carbon monoxide and CO2 alarms, battery backed", 1, "set", 150, 400),
            ("Second exit: steel hatch and ladder shaft", 1, "each", 2500, 6000),
            ("Structural engineer's design and stamped drawings", 1, "each", 3000, 8000),
            ("Building and excavation permits", 1, "each", 200, 1500)]:
            mats.append({"length_ft": L, "cover_ft": c, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo_p), "high": round(q * hi_p)})

r20 = bare(20, 3)
print('bare 20ft at 3ft: roof %.0f psf, %.1f tons; wall avg %.0f psf, base %.0f psf' % r20)
print([ (x['length_ft'], x['cover_ft'], x['sealed_hours'], x['lid_tons'], x['dig_cu_yd']) for x in configs])

b = {
 "id": "2026-11-05-buried-container-bunker", "publish": "2026-11-05", "written": "2026-11-02T21:25:00-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Shelter",
 "title": "A shipping container buried in the backyard is a bunker waiting to cave in",
 "dek": "Reels show a steel box dropped in a hole and covered over as a secret room, but a container's roof and walls were never meant to hold back soil, and the air inside runs out fast.",
 "reel": "An excavator digs a pit in a backyard, a 20 or 40 foot shipping container is lowered in, and the hole is filled until only a hatch shows. The next shot is a cozy lit room with bunks and shelves of supplies, presented as a hidden bunker. No engineer, concrete, drainage or ventilation ever appears.",
 "verdict": {"shown": 1, "fixed": 4, "line": "A bare buried container is a crushing and suffocation hazard; the only safe version puts it inside an engineered concrete vault, and that is a contractor job."},
 "scores": [
  {"test": "Roof carries the soil", "shown": 0, "fixed": 8, "why": "About 29 tons on a roof tested for one 660 lb patch; a concrete lid takes the load instead"},
  {"test": "Walls hold back the earth", "shown": 1, "fixed": 8, "why": "Soil pressure runs two to three times the side-wall rating; concrete walls carry it in the fix"},
  {"test": "Breathable air", "shown": 1, "fixed": 7, "why": "Four people sealed in a 20 ft box reach the CO2 work limit in about two hours; powered vents fix it"},
  {"test": "Stays dry and rust-free", "shown": 1, "fixed": 6, "why": "Bare steel in wet soil rusts; membrane, drains and a sump keep water off"},
  {"test": "Legal and permitted", "shown": 1, "fixed": 7, "why": "Codes treat containers as structures needing analysis; an engineer's stamp gets the permit"},
  {"test": "Cost against a precast shelter", "shown": 7, "fixed": 3, "why": "The box is cheap; the vault around it costs more than the box many times over"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "Permissible loading capacity of containers", "outlet": "TIS, German Insurance Association (GDV)", "url": "https://www.tis-gdv.de/tis_e/containe/belast/belast-htm/"},
  {"n": 2, "title": "ISO shipping containers and building code requirements", "outlet": "Residential Shipping Container Primer", "url": "https://residentialshippingcontainerprimer.com/?p=230"},
  {"n": 3, "title": "How deep can you bury a shipping container?", "outlet": "Conexwest", "url": "https://www.conexwest.com/blog/deep-bury-shipping-container"},
  {"n": 4, "title": "How do I bury a container in a hill with needed drainage around it?", "outlet": "Green Building Advisor", "url": "https://www.greenbuildingadvisor.com/question/how-do-i-bury-a-container-in-a-hill-with-needed-drainage-around-it"},
  {"n": 5, "title": "Trenching and excavation", "outlet": "CDC NIOSH", "url": "https://www.cdc.gov/niosh/topics/trenching"},
  {"n": 6, "title": "Protecting ventilation openings for storm shelters and tornado safe rooms", "outlet": "Greenheck", "url": "https://www.greenheck.com/resources/blog/protecting-ventilation-openings-for-storm-shelters-and-tornado-safe-rooms--fema-louver-requirements"},
  {"n": 7, "title": "Carbon dioxide measures up as a real hazard", "outlet": "Occupational Health & Safety", "url": "https://ohsonline.com/articles/2006/07/carbon-dioxide-measures-up-as-a-real-hazard"},
  {"n": 8, "title": "Intermodal shipping containers", "outlet": "Matanuska-Susitna Borough", "url": "https://matsu.gov/intermodal-shipping-containers"},
  {"n": 9, "title": "Which safe room is right for your family?", "outlet": "Oklahoma State University Extension", "url": "https://extension.okstate.edu/programs/emergency-and-disaster-preparedness/tornado-preparedness/which-safe-room-is-right-for-your-family-archived"}],
 "kit": {"summary": "A contractor-built reinforced concrete vault, designed by an engineer, that carries all the soil, with the container set inside it as the room, powered ventilation, a sump and a second exit.",
  "options": opts,
  "metrics": [
   {"key": "lid_tons", "label": "Soil on the lid", "unit": "tons", "note": "carried by the concrete lid, never the container"},
   {"key": "base_psf", "label": "Earth pressure at the base", "unit": "lb per sq ft", "note": "on the vault wall, at rest, before any groundwater"},
   {"key": "sealed_hours", "label": "Sealed air time", "unit": "hours", "note": "until CO2 reaches 5,000 ppm with fans off"},
   {"key": "vent_cfm", "label": "Fresh air to supply", "unit": "cfm", "note": "15 per person, from two separate vents"},
   {"key": "people", "label": "Sleeps", "unit": "people", "note": "the occupancy the air numbers assume"},
   {"key": "dig_cu_yd", "label": "Excavation", "unit": "cu yd", "note": "with sides laid back for a safe trench"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Soil test, engineer and permits", "start": 0, "days": 45, "gate": "Groundwater below the slab in the wet season; stamped drawings; permits issued"},
   {"phase": "Excavation", "start": 45, "days": 4, "gate": "Sides sloped or shored before anyone enters a hole over 5 ft; 811 locate done"},
   {"phase": "Drain bed and floor slab", "start": 49, "days": 7, "gate": "Footing drain to daylight or sump; slab inspected and poured"},
   {"phase": "Set the container", "start": 56, "days": 1, "gate": "Box sits on the slab without touching the vault walls"},
   {"phase": "Vault walls and lid", "start": 57, "days": 28, "gate": "Steel inspected before each pour; lid cured to design strength before any backfill"},
   {"phase": "Waterproofing and backfill", "start": 85, "days": 5, "gate": "Membrane lapped and sealed; backfill placed in lifts, no heavy machine on the lid"},
   {"phase": "Vents, power, alarms, second exit", "start": 90, "days": 10, "gate": "Fans move the design flow; CO and CO2 alarms tested; both exits open from inside"},
   {"phase": "Overnight trial", "start": 100, "days": 1, "gate": "CO2 stays under 1,500 ppm overnight with the planned number of people"}],
  "assumptions": "Loads use moist soil at 120 lb per cu ft and an at-rest pressure coefficient of 0.5; air numbers use 0.3 liters of CO2 per resting adult per minute. Quantities include about 10% waste; prices are rough US ranges for late 2026, not quotes, and this is not an engineered design."}}
out = os.path.join(here, '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
