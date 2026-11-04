# Builds the shipping container pool (Reel Check) from its text and its numbers.
import json, math, os
G = 62.4
H_WALL = 7.8                  # ft, inside height of a standard container side wall
IN_W = 7.7                    # ft, inside width
BOX = {20: (19.3, 2.3), 40: (39.5, 3.75)}    # inside length ft, tare tons
here = os.path.dirname(__file__)
body = open(os.path.join(here, 'container-pool.md'), encoding='utf-8').read()

def wall(h, H=H_WALL):
    """Vertical corrugated wall spanning bottom rail to top rail under water h ft deep."""
    W = G * h * h / 2                         # lb per ft of wall
    top = W * (h / 3) / H                     # share carried by the top rail
    return W, top

opts = [{"key": "length_ft", "label": "Container", "unit": "ft", "values": [20, 40], "default": 20},
        {"key": "depth_ft", "label": "Water depth", "unit": "ft", "values": [3.5, 4.5, 5.5], "default": 4.5}]
configs, mats = [], []
for n in opts[0]['values']:
    for h in opts[1]['values']:
        L, tare = BOX[n]
        cf = L * IN_W * h
        W, top = wall(h)
        rail_m = top * L * L / 8              # lb-ft at mid-span if the top rail spans end to end
        tons = cf * G / 2000 + tare
        uplift = G * L * 8 * 4 / 2000         # tons of buoyancy if buried, empty, groundwater 4 ft up
        posts = 2 * (math.ceil(L / 4) + 1)
        configs.append({"length_ft": n, "depth_ft": h, "gallons": round(cf * 7.48, -1),
                        "loaded_tons": round(tons, 1), "side_push_lb": round(W * L, -2),
                        "top_rail_lb_per_ft": round(top), "rail_moment_lb_ft": round(rail_m, -2),
                        "buried_uplift_tons": round(uplift, 1)})
        slab_cy = math.ceil((L + 4) * (IN_W + 0.3 + 4 + 2 * 3) * 0.5 / 27 * 1.1)  # slab under box and buttresses
        plate_sf = math.ceil(L * IN_W * 1.1)
        liner_sf = math.ceil((L * IN_W + 2 * (L + IN_W) * (h + 1)) * 1.1)
        foam_sf = math.ceil((L * IN_W + 2 * (L + IN_W) * (h + 1)) * 1.1)
        for item, q, u, lo, hi in [
            ("Used one-trip or cargo-worthy container, delivered", 1, "each", 3500 if n == 20 else 4500, 6000 if n == 20 else 8000),
            ("Crane or tilt-bed set on the slab", 1, "each", 600, 2500),
            ("Reinforced concrete slab with buttress footings", slab_cy, "cu yd", 250, 400),
            ("Steel buttress posts and braces, welded and anchored", posts, "each", 180, 350),
            ("Floor plate, 3/16 in steel, welded over the cross members", plate_sf, "sq ft", 8, 14),
            ("Certified welder: plate, buttresses, cut-down and openings", 1, "lot", 4000, 9000),
            ("Sandblast and two-part epoxy coating inside and out", math.ceil(2 * 2 * (L + IN_W) * H_WALL + 2 * L * IN_W), "sq ft", 4, 8),
            ("Closed-cell foam board behind the liner", foam_sf, "sq ft", 1.5, 3),
            ("Custom-fit vinyl pool liner", liner_sf, "sq ft", 2, 4.5),
            ("Filter pump, skimmer and returns", 1, "lot", 900, 2500),
            ("Electrician: GFCI circuit and equipotential bonding of the steel", 1, "each", 1500, 4000),
            ("Deck, steps and barrier with self-latching gate", 1, "lot", 3000 if n == 20 else 5000, 9000 if n == 20 else 15000),
            ("Structural engineer's design for slab, buttresses and frame", 1, "each", 1500, 4000),
            ("Pool permit", 1, "each", 200, 1200)]:
            mats.append({"length_ft": n, "depth_ft": h, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})

b = {
 "id": "2026-11-13-container-pool", "publish": "2026-11-13", "written": "2026-11-02T21:31:49-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Water",
 "title": "The shipping container pool: is a steel box really a pool waiting to happen?",
 "dek": "Reels show a used container with its roof sliced off, dropped in a hole and filled; the box was never built to hold water against its walls, but set above ground on an engineered frame it can make a sound lap pool.",
 "reel": "A used shipping container is craned into a backyard pit, its roof cut away with a grinder, a liner draped in and the box filled to near the brim. The finished clip shows a sleek steel lap pool flush with a deck. Reinforcement, a slab, drainage, rust protection and a permit never appear.",
 "verdict": {"shown": 2, "fixed": 5, "line": "Buried and roofless as filmed, the box bows, rusts and can float out of the ground; set above ground on an engineered frame and lined, it is a real but pricey lap pool."},
 "scores": [
  {"test": "Holds the water load", "shown": 2, "fixed": 7, "why": "The roofless top rail is overstressed; welded buttresses on a slab carry the walls"},
  {"test": "Survives being drained", "shown": 1, "fixed": 8, "why": "Buried, soil crushes it inward or groundwater floats it; above ground neither happens"},
  {"test": "Lasts ten years or more", "shown": 2, "fixed": 6, "why": "Bare steel in chlorinated water rusts through; blasting, epoxy and a liner slow it down"},
  {"test": "Electrically safe", "shown": 1, "fixed": 8, "why": "A steel shell must be bonded to code; an electrician does it"},
  {"test": "Cost against a kit or fiberglass pool", "shown": 6, "fixed": 4, "why": "The box is cheap; slab, steel, welding and liner are not"},
  {"test": "Doable by one handy person", "shown": 3, "fixed": 4, "why": "Crane, welding and electrical are hired; coating, liner and deck are DIY"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "How deep can you bury a shipping container?", "outlet": "Conex West", "url": "https://www.conexwest.com/blog/deep-bury-shipping-container"},
  {"n": 2, "title": "Steel shipping box", "outlet": "HZ Containers", "url": "https://hz-containers.com/en/glossary/steel-shipping-box/"},
  {"n": 3, "title": "Shipping container pools are all over the internet, but how do you actually install one?", "outlet": "Hunker", "url": "https://www.hunker.com/13777092/shipping-container-pools-what-to-know/"},
  {"n": 4, "title": "Shipping container pools: the essential pros and cons", "outlet": "River Pools", "url": "https://riverpoolsandspas.com/blog/shipping-container-pools-the-essential-pros-and-cons"},
  {"n": 5, "title": "Pool trend: is a shipping container pool right for you?", "outlet": "Endless Pools", "url": "https://www.endlesspools.com/blog/amp/endless-pools-v-shipping-container-pool"},
  {"n": 6, "title": "Are shipping container floors toxic? Here's what the science says", "outlet": "USA Containers", "url": "https://usacontainers.co/blogs/shipping-container-facts/are-shipping-container-floors-toxic-here-s-what-the-science-says"},
  {"n": 7, "title": "Taking the mystery out of equipotential bonding requirements for swimming pools", "outlet": "IAEI Magazine", "url": "https://iaeimagazine.org/magazine/features/systems/taking-the-mystery-out-of-equipotential-bonding-requirements-for-swimming-pools/"},
  {"n": 8, "title": "Pool barrier height and clearances, ISPSC chapter 3", "outlet": "Town of Thompson's Station, Tennessee", "url": "https://www.thompsons-station.gov/sites/default/files/uploads/documents/Community%20Development/Building-Codes/Building%20Permit/pool-barrier-height-and-clearances-ispsc-chapter_3.pdf"}],
 "kit": {"summary": "An above-ground container lap pool on a concrete slab, its walls held by welded steel buttresses, the floor plated, the steel blasted, coated and bonded, with a foam-backed vinyl liner and a deck with a code barrier.",
  "options": opts,
  "metrics": [
   {"key": "gallons", "label": "Water", "unit": "gallons", "note": "at the chosen depth"},
   {"key": "loaded_tons", "label": "Weight on the slab", "unit": "tons", "note": "water plus the empty box"},
   {"key": "side_push_lb", "label": "Push on each long wall", "unit": "lb", "note": "outward, all the time"},
   {"key": "top_rail_lb_per_ft", "label": "Load on the top rail", "unit": "lb per ft", "note": "if the roof is cut away and nothing else holds the wall"},
   {"key": "rail_moment_lb_ft", "label": "Bending at mid-rail", "unit": "lb-ft", "note": "why the kit adds buttresses"},
   {"key": "buried_uplift_tons", "label": "Float-out force if buried and drained", "unit": "tons", "note": "with groundwater 4 ft up; why the kit stays above ground"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Permit, engineer and container", "start": 0, "days": 21, "gate": "Stamped slab and buttress design; permit issued; container inspected for holes and floor rot before purchase"},
   {"phase": "Slab", "start": 21, "days": 10, "gate": "Level within 1/4 in; cured 7 days; anchor plates where the engineer placed them"},
   {"phase": "Set and strip", "start": 31, "days": 3, "gate": "Box set by crane; treated floor plywood removed with masks and gloves and bagged"},
   {"phase": "Weld steel", "start": 34, "days": 7, "gate": "Floor plate, buttresses and cut-down top done; welds checked by the engineer before any coating"},
   {"phase": "Blast and coat", "start": 41, "days": 5, "gate": "Bare metal, two coats inside and out, full cure per the maker before foam goes in"},
   {"phase": "Plumbing, bonding and liner", "start": 46, "days": 4, "gate": "Bonding inspected; no sharp edge or weld spatter touches the liner"},
   {"phase": "Staged fill", "start": 50, "days": 3, "gate": "Fill in stages; measure wall bulge at mid-length each foot; stop if it moves"},
   {"phase": "Deck and barrier", "start": 53, "days": 10, "gate": "48 in barrier and self-latching gate pass inspection before the first swim"}],
  "assumptions": "Walls are treated as vertical spans from bottom rail to top rail with water at 62.4 lb per cubic foot; buried uplift assumes an 8 ft wide box with groundwater 4 ft up its side. Quantities include about 10% waste; prices are rough US ranges for late 2026, not quotes, and not an engineered design."}}
out = os.path.join(here, '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for c in configs: print(c)
for n in (20, 40):
    sel = [m for m in mats if m['length_ft'] == n and m['depth_ft'] == 4.5]
    print(n, sum(m['low'] for m in sel), sum(m['high'] for m in sel))
