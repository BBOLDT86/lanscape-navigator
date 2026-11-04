# Builds the backyard lazy river (Reel Check) from its text and its numbers.
import json, math, os
G = 62.4; RHO = 1.94; N = 0.014     # water weight, density (slug/cu ft), Manning n for a vinyl or plaster channel
D = 3.5                             # ft water depth, the usual starting point for a river
V = 1.5 * 1.467                     # ft/s, a relaxed 1.5 mph current
VJ = 9.0                            # ft/s at the return nozzles: about 4x the current, well under the 20 ft/s ceiling
BENDS = 4; K = 0.15                 # four broad 90-degree bends around a yard, loss factor each
here = os.path.dirname(__file__)
body = open(os.path.join(here, 'lazy-river.md'), encoding='utf-8').read()

def drag(v, w, L):
    """Force (lb) the current loses to wall friction and bends on one lap."""
    A = w * D; R = A / (w + 2 * D)
    S = (N * v / (1.49 * R ** (2 / 3))) ** 2
    return G * A * (S * L + BENDS * K * v * v / 64.4)

def speed(gpm, w, L, vj=15.0):
    """Steady current a given return flow sustains: jet momentum in = drag out."""
    q = gpm / 448.8; lo, hi = 0.0, vj
    for _ in range(60):
        v = (lo + hi) / 2
        lo, hi = (v, hi) if RHO * q * (vj - v) > drag(v, w, L) else (lo, v)
    return v

opts = [{"key": "loop_ft", "label": "Loop length", "unit": "ft", "values": [100, 150, 200, 250], "default": 150},
        {"key": "width_ft", "label": "Channel width", "unit": "ft", "values": [5, 6, 7], "default": 6}]
configs, mats = [], []
for L in opts[0]['values']:
    for w in opts[1]['values']:
        F = drag(V, w, L)
        q = F / (RHO * (VJ - V)); gpm = q * 448.8
        head = VJ ** 2 / 64.4 + 2.0                    # nozzle velocity head plus short, fat plumbing
        hp = G * q * head / 550 / 0.6                  # wire-to-water efficiency of a low-head pump about 60%
        kwh_month = hp * .746 * 4 * 30                 # 4 hours a day of river time
        gal = w * D * L * 7.48
        configs.append({"loop_ft": L, "width_ft": w, "gallons": round(gal, -2), "motive_gpm": round(gpm, -1),
                        "pump_hp": round(hp, 1), "pool_pump_mph": round(speed(80, w, L) / 1.467, 1),
                        "kwh_month": round(kwh_month), "wall_lb_per_ft": round(G * (D + .5) ** 2 / 2)})
        dig = math.ceil((w + 3) * (D + 1.5) * L / 27 * 1.2)
        block = math.ceil(2 * L * (D + .5) / (8 / 12 * 16 / 12) * 1.05)   # 8x8x16 blocks, both walls
        footing_cy = math.ceil(2 * L * 2 * 1 / 27 * 1.1)
        floor_cy = math.ceil(w * L * (4 / 12) / 27 * 1.1)
        liner = math.ceil(L * (w + 2 * (D + .5) + 1) * 1.1)
        for item, qty, u, lo, hi in [
            ("Excavation and haul-off", dig, "cu yd", 25, 60),
            ("Concrete footings, both walls", footing_cy, "cu yd", 200, 320),
            ("Concrete block, 8 x 8 x 16, grouted and reinforced", block, "blocks", 4, 7),
            ("Rebar and grout for the block cores", math.ceil(block / 10), "lots of 10 blocks", 25, 45),
            ("Sand-cement floor screed", floor_cy, "cu yd", 180, 280),
            ("Custom vinyl liner, 30 mil, and underlayment", liner, "sq ft", 3, 6),
            ("Coping and edge cap", 2 * L, "linear ft", 15, 40),
            ("Low-head motive pump with variable drive", 1, "each", 4000 if hp < 4 else 6500, 9000 if hp < 4 else 14000),
            ("Gravity collector tank, grates and large-bore returns", 1, "lot", 4000, 10000),
            ("Separate filter pump, cartridge filter and chlorinator", 1, "lot", 1500, 3500),
            ("Electrician: service upgrade, GFCI, bonding", 1, "each", 4000, 10000),
            ("Barrier fence with self-latching gates", math.ceil(L / 3.14 * 3.5 + 40), "linear ft", 25, 60),
            ("Pool designer or engineer: hydraulics and walls", 1, "each", 3000, 8000),
            ("Soil borings", 1, "each", 1000, 3000),
            ("Pool permit", 1, "each", 300, 2000)]:
            mats.append({"loop_ft": L, "width_ft": w, "item": item, "qty": qty, "unit": u,
                         "low": round(qty * lo), "high": round(qty * hi)})

b = {
 "id": "2026-11-18-lazy-river", "publish": "2026-11-18", "written": "2026-11-02T21:34:31-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Water",
 "title": "The backyard lazy river: can a pool pump make a current?",
 "dek": "Reels show a trench dug around a yard, a liner laid in and a pool pump sending tubes drifting on a current; a pool pump barely stirs that much water, and the real thing needs a pump forty times bigger and drains that cannot trap a child.",
 "reel": "A homeowner digs a looping trench around the lawn, lines it, fills it and drops a pool pump in one corner. Kids float past in tubes on a steady current. Walls, the pump size, filtration, safe suction outlets and a fence never appear.",
 "verdict": {"shown": 2, "fixed": 5, "line": "As filmed the water would barely move and the suction could trap a swimmer; built with block walls, a big low-head pump and a gravity collector tank, it is a real but costly project."},
 "scores": [
  {"test": "Current actually flows", "shown": 1, "fixed": 8, "why": "A pool pump gives a few tenths of a mph; a sized low-head pump gives a relaxed 1.5"},
  {"test": "Walls hold", "shown": 2, "fixed": 7, "why": "Bare trench sides slump; grouted block on footings holds the soil and water"},
  {"test": "Entrapment and drowning", "shown": 1, "fixed": 7, "why": "A pump sucking straight from the river can pin a child; a gravity tank and a fence fix it"},
  {"test": "Clean water", "shown": 2, "fixed": 7, "why": "No filter shown; a separate filter loop and chlorinator handle it"},
  {"test": "Cost and running cost", "shown": 6, "fixed": 3, "why": "Trench and liner are cheap; walls, pumps and power are not"},
  {"test": "Doable by one handy person", "shown": 3, "fixed": 4, "why": "Block work and liner are DIY-able; hydraulics and electrical are not"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "More than a rivulet: backyard lazy rivers", "outlet": "Pool & Spa News", "url": "https://www.poolspanews.com/?p=27284"},
  {"n": 2, "title": "How a lazy river works", "outlet": "Aquatics International", "url": "https://www.aquaticsintl.com/?p=11947"},
  {"n": 3, "title": "What happens when your pool project goes viral?", "outlet": "AQUA Magazine", "url": "https://aquamagazine.com/builder/what-happens-when-your-pool-project-goes-viral.html"},
  {"n": 4, "title": "Circulation entrapments associated with pools, spas and whirlpool bathtubs, 1999-2011", "outlet": "U.S. Consumer Product Safety Commission", "url": "https://www.Cpsc.Gov/s3fs-public/pdfs/entrap12.pdf"},
  {"n": 5, "title": "Virginia Graeme Baker Pool and Spa Safety Act FAQ", "outlet": "Pool Safely (CPSC)", "url": "https://www.poolsafely.gov/wp-content/uploads/2016/08/Pool-Safely-FAQ.pdf"},
  {"n": 6, "title": "How much does a backyard lazy river cost?", "outlet": "HomeGuide", "url": "https://homeguide.com/costs/backyard-lazy-river-cost"},
  {"n": 7, "title": "Pool barrier height and clearances, ISPSC chapter 3", "outlet": "Town of Thompson's Station, Tennessee", "url": "https://www.thompsons-station.gov/sites/default/files/uploads/documents/Community%20Development/Building-Codes/Building%20Permit/pool-barrier-height-and-clearances-ispsc-chapter_3.pdf"}],
 "kit": {"summary": "A 3.5 ft deep vinyl-lined river with grouted block walls on footings, broad bends, a low-head motive pump fed from a gravity collector tank, a separate filter loop and a barrier fence.",
  "options": opts,
  "metrics": [
   {"key": "gallons", "label": "Water", "unit": "gallons", "note": "at 3.5 ft deep"},
   {"key": "motive_gpm", "label": "Flow to hold 1.5 mph", "unit": "gpm", "note": "through returns at 9 ft per second"},
   {"key": "pump_hp", "label": "Motive pump", "unit": "hp", "note": "low-head pump, about 60% efficient"},
   {"key": "pool_pump_mph", "label": "Current from one pool pump", "unit": "mph", "note": "80 gpm, what the reel uses"},
   {"key": "kwh_month", "label": "River power", "unit": "kWh per month", "note": "four hours of current a day"},
   {"key": "wall_lb_per_ft", "label": "Water push on each wall", "unit": "lb per ft", "note": "the soil pushes back the same when drained"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Design, borings and permit", "start": 0, "days": 45, "gate": "Hydraulic design sized by someone who has built rivers; soils checked along the whole loop; permit issued"},
   {"phase": "Layout and excavation", "start": 45, "days": 7, "gate": "811 called; no bend tighter than an 8 ft inside radius; trench shored where deeper than 5 ft"},
   {"phase": "Footings and block walls", "start": 52, "days": 21, "gate": "Rebar inspected before grout; walls plumb and the top level all round"},
   {"phase": "Plumbing and collector tank", "start": 73, "days": 10, "gate": "No pump draws straight from the river; returns pressure-tested before backfill"},
   {"phase": "Floor, liner and coping", "start": 83, "days": 7, "gate": "Smooth floor; no block edge touches the liner; coping fixed"},
   {"phase": "Electrical and equipment", "start": 90, "days": 7, "gate": "Service upgraded, GFCI and bonding inspected"},
   {"phase": "Fill, balance and flow test", "start": 97, "days": 5, "gate": "Current measured with a flow meter, not a floating stick; no eddies trap a tube at the bends"},
   {"phase": "Barrier fence", "start": 102, "days": 7, "gate": "48 in barrier and self-latching gates inspected before anyone floats"}],
  "assumptions": "Current from a momentum balance of the returns against wall friction (Manning n 0.014) and four bends, at 3.5 ft deep; power at four hours a day. Quantities include about 5-20% waste; prices are rough US ranges for late 2026, not quotes, and not an engineered design."}}
out = os.path.join(here, '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for c in configs: print(c)
sel = [m for m in mats if m['loop_ft'] == 150 and m['width_ft'] == 6]
print(sum(m['low'] for m in sel), sum(m['high'] for m in sel))
