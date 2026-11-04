# Builds the floating cabin on barrels (Reel Check) from its text and its numbers.
import json, math, os
W = 62.4                  # fresh water, lb per cu ft
FLOAT_RATED = 806         # foam-filled 3 x 4 ft x 16 in polyethylene float drum, maker's rated buoyancy, lb
FLOAT_AREA, FLOAT_H = 12.0, 16 / 12
FLOAT_FULL = FLOAT_AREA * FLOAT_H * W   # lift if pushed fully under, about 998 lb
CROWD = 800               # four adults standing at one edge
LIVE_PSF = 20             # people and gear spread over the deck
PORCH = 4                 # ft of open deck at the front
here = os.path.dirname(__file__)
body = open(os.path.join(here, 'barrel-floating-cabin.md'), encoding='utf-8').read()

def dead_load(B, L):
    cab = B * (L - PORCH)
    deck = B * L * 10                                  # PT frame and decking, psf
    walls = 2 * (B + L - PORCH) * 8 * 5                # 8 ft framed walls, 5 psf of wall
    roof = (cab + 2 * (B + L)) * 8                     # roof with overhangs, 8 psf
    fit = cab * 6                                      # furniture, stove, water, bunks
    return deck + walls + roof + fit

def heel(B, L, n, dead):
    """Heel angle with four people at one long edge, floats spread evenly under the deck."""
    disp = dead + CROWD
    V = disp / W
    frac = min(1.0, n * FLOAT_AREA / (B * L))
    I = frac * L * B ** 3 / 12                         # waterplane of evenly spread floats
    draft = V / (n * FLOAT_AREA)
    BM = I / V
    KB = -draft / 2                                    # buoyancy centre, ft above waterline (negative = below)
    KG = 2.6                                           # centre of weight about 2.6 ft above the waterline
    GM = BM + KB - KG
    return math.degrees(math.atan(CROWD * (B / 2 - 1) / (disp * GM)))

opts = [{"key": "width_ft", "label": "Deck width", "unit": "ft", "values": [10, 12, 14, 16], "default": 12},
        {"key": "length_ft", "label": "Deck length", "unit": "ft", "values": [16, 20, 24], "default": 20}]
configs, mats = [], []
for B in opts[0]['values']:
    for L in opts[1]['values']:
        dead = dead_load(B, L)
        live = LIVE_PSF * B * L
        n = max(math.ceil(dead / (0.5 * FLOAT_FULL)), math.ceil((dead + live) / (0.8 * FLOAT_FULL)))
        n += n % 2                                     # even count, in pairs across the deck
        fits = n * FLOAT_AREA <= B * L
        free = FLOAT_H * 12 * (1 - dead / (n * FLOAT_FULL)) + 10   # float top + 10 in of frame
        reserve = 100 * (1 - (dead + live) / (n * FLOAT_FULL))
        configs.append({"width_ft": B, "length_ft": L, "cabin_sq_ft": B * (L - PORCH), "dead_lb": round(dead),
                        "floats": n, "freeboard_in": round(free, 1), "reserve_pct": round(reserve),
                        "heel_deg": round(heel(B, L, n, dead), 1), "fits": fits})
        cab = B * (L - PORCH)
        joists = math.ceil(L / 2 * 1.1) + 2
        decking = math.ceil(B * L * 1.1)
        anchors = 4 if L <= 20 else 6
        for item, q, u, lo, hi in [
            ("Foam-filled polyethylene float drums, 3 x 4 ft x 16 in, about 800 lb rated (no reused drums)", n, "each", 150, 240),
            ("Pressure-treated 2x8 frame for ground contact, 16 ft equivalent", joists * math.ceil(B / 16 + 1), "boards", 22, 34),
            ("Decking, treated or composite", decking, "sq ft", 3, 8),
            ("Galvanized or stainless through-bolts, float brackets, straps", 1, "lot", 300 + 15 * n, 600 + 30 * n),
            ("Cabin shell: framing, sheathing, metal roof, windows, door", cab, "sq ft", 45, 85),
            ("Anchors with chain, or pilings and slide brackets", anchors, "each", 150, 450),
            ("Marine electrician: GFCI and ELCI shore power or solar with batteries", 1, "each", 1500, 5000),
            ("Smoke and carbon monoxide alarms; vented heater, never unvented", 1, "set", 250, 1500),
            ("Composting toilet (no discharge to the water)", 1, "each", 900, 2200),
            ("Life ring on a line, ladder, life jackets for each sleeper", 1, "set", 250, 600),
            ("Approval from the lake owner or authority; permit fee", 1, "each", 0, 1500)]:
            mats.append({"width_ft": B, "length_ft": L, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})

# the clip: 12 x 16 deck, 10 x 12 cabin, a dozen reused 55 gallon drums
clip_dead = dead_load(12, 16)
drum_lift = math.pi * (22.5 / 24) ** 2 * (34.5 / 12) * W - 20
print('clip dead %d lb; 12 drums net %d lb; 16 drums %d lb' % (clip_dead, 12 * drum_lift, 16 * drum_lift))
for c in configs: print(c)
assert all(c['fits'] for c in configs)
for c in configs: c.pop('fits')

b = {
 "id": "2026-11-15-barrel-floating-cabin", "publish": "2026-11-15", "written": "2026-11-02T21:33:00-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Shelter",
 "title": "The floating cabin on barrels sits lower than the reel lets on",
 "dek": "A little cabin on a raft of blue drums drifting on a pond is a feed favorite, but a dozen barrels barely carry the cabin itself, and the real danger is a tip or a fall at night.",
 "reel": "A builder lashes a dozen blue plastic drums under a timber deck at the edge of a pond, frames a small cabin with a porch on top and pushes it out onto the water. Later shots show a woodstove glowing, a hammock on the porch and a sunset reflected on the water. No one ever weighs anything, steps onto one edge, or shows the anchors, wiring or life ring.",
 "verdict": {"shown": 3, "fixed": 6, "line": "On a dozen reused drums the cabin rides nearly awash and tips when friends step to the rail; on more than twice the flotation, wide and anchored, it is a sound pond cabin."},
 "scores": [
  {"test": "Floats with a margin", "shown": 1, "fixed": 8, "why": "A 12 by 16 cabin outweighs a dozen drums; the kit sizes floats to half-submerged at rest"},
  {"test": "Stable when people move", "shown": 3, "fixed": 7, "why": "A wide, evenly floated deck keeps four people at the rail to a few degrees of heel"},
  {"test": "Lasts through winters", "shown": 3, "fixed": 6, "why": "Foam-filled marine floats do not slowly fill; ice and UV still need watching"},
  {"test": "Legal on the water", "shown": 2, "fixed": 6, "why": "Reused drums are banned on TVA waters; most lakes need the owner's or authority's approval"},
  {"test": "Safe to sleep on", "shown": 2, "fixed": 7, "why": "CO alarm, vented heat, GFCI power, a ladder and a life ring address the ways people die"},
  {"test": "Doable by one handy person", "shown": 6, "fixed": 6, "why": "Deck-and-float work is ordinary carpentry; wiring goes to a marine electrician"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "Boat dock help needed", "outlet": "Boat Design Net", "url": "https://www.boatdesign.net/posts/45667"},
  {"n": 2, "title": "Dock Edge dock float, 400 lb, filled", "outlet": "The Home Depot", "url": "https://www.homedepot.com/p/Dock-Edge-Dock-Float-400-lbs-Filled-DE99241F/317202790"},
  {"n": 3, "title": "18 CFR 1304.400, flotation devices and material", "outlet": "Electronic Code of Federal Regulations", "url": "https://www.ecfr.gov/current/title-18/chapter-XIII/part-1304/subpart-E/section-1304.400"},
  {"n": 4, "title": "The influence of the cuboid float's parameters on the stability of a floating building", "outlet": "Polish Maritime Research", "url": "https://journal.mostwiedzy.pl/pmr/article/view/251"},
  {"n": 5, "title": "Floating cabins", "outlet": "US Army Corps of Engineers, Nashville District", "url": "https://webarchive.library.unt.edu/web/20161019180222/http://www.lrn.usace.army.mil/About/Organization/Real-Estate/Floating-Cabins"},
  {"n": 6, "title": "Electric shock drowning", "outlet": "Michigan Department of Natural Resources", "url": "https://www.michigan.gov/dnr/things-to-do/boating/esd"},
  {"n": 7, "title": "Electric shock drowning and carbon monoxide poisoning", "outlet": "Discover Boating", "url": "https://www.discoverboating.com/safety/electric-shock-drowning-and-carbon-monoxide-poisoning"},
  {"n": 8, "title": "Recreational boating facts", "outlet": "National Safe Boating Council", "url": "https://www.safeboatingcouncil.org/resources/recreational-boating-facts/"},
  {"n": 9, "title": "3x4x16 float drum, 806 lb buoyancy", "outlet": "Insul-Bead", "url": "https://reach.dog/shop/insul-bead/products/3x4x16-float-drum-806-buoyancy"}],
 "kit": {"summary": "A framed cabin with a 4 ft porch on a pressure-treated deck carried by foam-filled marine dock floats sized to ride half-submerged at rest, anchored at the corners, with marine-grade power and safety gear.",
  "options": opts,
  "metrics": [
   {"key": "floats", "label": "Floats", "unit": "floats", "note": "3 x 4 ft x 16 in, about 800 lb rated each"},
   {"key": "dead_lb", "label": "Weight of the build", "unit": "lb", "note": "deck, cabin and fittings, before people"},
   {"key": "freeboard_in", "label": "Deck above water", "unit": "in", "note": "at rest, nobody aboard"},
   {"key": "reserve_pct", "label": "Reserve buoyancy", "unit": "%", "note": "left with 20 psf of people and gear aboard"},
   {"key": "heel_deg", "label": "Tilt with four at the rail", "unit": "degrees", "note": "800 lb at one long edge"},
   {"key": "cabin_sq_ft", "label": "Cabin floor", "unit": "sq ft", "note": "with a 4 ft open porch in front"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Approval and site", "start": 0, "days": 30, "gate": "Written OK from the lake owner or authority; depth, ice and flood range known"},
   {"phase": "Frame and floats on shore", "start": 30, "days": 5, "gate": "Every float through-bolted to the frame; even spread under the deck"},
   {"phase": "Launch the bare deck", "start": 35, "days": 1, "gate": "Deck floats level within 2 in; freeboard matches the kit's figure"},
   {"phase": "Cabin shell", "start": 36, "days": 14, "gate": "Heavy items centered; deck still level; no float more than half under"},
   {"phase": "Anchoring", "start": 50, "days": 2, "gate": "Anchors set with slack for water-level change; cabin cannot swing into the shore"},
   {"phase": "Power, heat and alarms", "start": 52, "days": 5, "gate": "GFCI and ELCI tested; CO and smoke alarms working; heater vented outside"},
   {"phase": "Load test", "start": 57, "days": 1, "gate": "Four adults at one rail: tilt under 5 degrees, deck edge stays dry"},
   {"phase": "Safety gear and first night", "start": 58, "days": 1, "gate": "Ladder, lit edge, life ring on a line and a life jacket for each sleeper on board"}],
  "assumptions": "Weights use 10 psf for the deck, 5 psf for framed walls, 8 psf for the roof and 6 psf for fittings; floats are sized to ride half-submerged at rest and no more than 80% under with 20 psf of people; the tilt figure is a simple small-angle estimate. Prices are rough US ranges for late 2026, not quotes, and this is not an engineered or approved design."}}
out = os.path.join(here, '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
