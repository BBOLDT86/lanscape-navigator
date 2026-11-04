# Builds the shed green roof Reel Check from its text and its numbers.
import json, math, os
FB, E = 875, 1.4e6       # No. 2 spruce-pine-fir, bending stress psi and stiffness psi
CD = 1.15                # load duration factor for snow
CR = 1.15                # repetitive member factor
DEAD = 10                # existing roof deck, membrane, framing, psf
SNOW = 30                # design roof snow load, psf; check your town's figure
MEDIA_PSF_IN = 4.5       # extensive media with drainage layer, saturated, psf per inch (NPS: 17-18 psf at 3-4 in)
LAYERS = 2               # membrane, root barrier, drain mat, fabric, plants
SOIL_PCF = 115           # fully watered garden soil, lb per cu ft (Perlite Institute: 100-125)
LENGTH = 10              # shed length, ft, along the ridge or high wall
SIZES = [(4, 3.5, 1.5), (6, 5.5, 1.3), (8, 7.25, 1.2), (10, 9.25, 1.1), (12, 11.25, 1.0)]   # nominal, depth, size factor
body = open(os.path.join(os.path.dirname(__file__), 'shed-green-roof.md'), encoding='utf-8').read()


def capacity(depth, cf, span, spacing):
    """Uniform load in psf a rafter of this depth can carry over a simple span (bending, then L/180 deflection)."""
    b = 1.5
    S, I = b * depth ** 2 / 6, b * depth ** 3 / 12
    w_bend = 8 * FB * cf * CD * CR * S / 12 / span ** 2                              # lb per ft of rafter
    w_defl = 384 * E * I * (span * 12 / 180) / (5 * (span * 12) ** 4) * 12           # lb per ft of rafter
    return min(w_bend, w_defl) / (spacing / 12)


# The reel: a lean-to shed, 2x4 rafters at 24 in spanning 8 ft, 6 in of wet garden soil on top.
reel_load = DEAD + 6 / 12 * SOIL_PCF
reel_cap = capacity(3.5, 1.5, 8, 24)

opts = [{"key": "span_ft", "label": "Rafter span", "unit": "ft", "values": [6, 8, 10, 12], "default": 8},
        {"key": "depth_in", "label": "Growing media", "unit": "in", "values": [2, 3, 4, 6], "default": 3}]
configs, mats = [], []
for sp in opts[0]['values']:
    for d in opts[1]['values']:
        green = d * MEDIA_PSF_IN + LAYERS
        design = DEAD + green + SNOW
        size = next((n for n, dep, cf in SIZES if capacity(dep, cf, sp, 16) >= design), 0)
        area = (sp + 1) * (LENGTH + 1)                    # 6 in overhang each side
        wet_lb = green * area
        cuyd = area * d / 12 / 27 * 1.1
        configs.append({"span_ft": sp, "depth_in": d, "green_psf": round(green), "design_psf": round(design),
                        "rafter_nominal": size, "wet_lb": round(wet_lb / 50) * 50, "media_cuyd": round(cuyd, 1)})
        rafters = math.ceil(LENGTH * 12 / 16) + 1
        stick = math.ceil((sp + 1.5) / 2) * 2
        price = {4: (5, 8), 6: (8, 13), 8: (11, 18), 10: (15, 25), 12: (22, 36)}[size or 12]
        for item, q, u, lo, hi in [
            ("Structural engineer's review of the framing", 1, "each", 300, 800),
            (f"New 2x{size or 12} x {stick} ft rafters at 16 in, sistered or replacing", rafters, "boards", price[0], price[1]),
            ("Joist hangers, hurricane ties and structural screws", 1, "lot", 60, 140),
            ("3/4 in exterior plywood decking", math.ceil(area / 32 * 1.1), "sheets", 45, 70),
            ("45 mil EPDM membrane, one piece", math.ceil(area + 2 * (sp + LENGTH) * 1.5), "sq ft", 1, 1.75),
            ("Root barrier sheet", math.ceil(area * 1.1), "sq ft", 0.3, 0.7),
            ("Drainage mat", math.ceil(area * 1.05), "sq ft", 0.8, 1.5),
            ("Filter fabric", math.ceil(area * 1.1), "sq ft", 0.15, 0.3),
            ("Edge kerb, perforated aluminum or cedar 2x6", math.ceil(2 * (sp + LENGTH + 2)), "lin ft", 3, 6),
            ("Gravel for the drain strip and outlet", 1, "bag lot", 15, 30),
            ("Extensive green roof media, delivered", cuyd, "cu yd", 90, 180),
            ("Sedum plugs or cuttings (mats cost more)", math.ceil(area), "sq ft", 1, 2.5),
            ("Gutter and downspout to a rain barrel", 1, "set", 40, 90),
            ("Building permit, if required", 1, "each", 0, 150)]:
            mats.append({"span_ft": sp, "depth_in": d, "item": item, "qty": round(q, 1), "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})

b = {
 "id": "2026-11-19-shed-green-roof", "publish": "2026-11-19", "written": "2026-11-02T21:46:33-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Garden",
 "title": "The living shed roof: could a garden shed carry a meadow?",
 "dek": "A garden shed topped with a deep, flowering meadow is a feed favorite; as filmed the roof carries about three times what it was framed for, but a shallow sedum roof on beefed-up rafters works.",
 "reel": "A homeowner shovels garden soil onto the flat roof of an ordinary backyard shed, lays a tarp under it and plants wildflowers and grasses. A time-lapse turns the roof into a lush meadow, with a person kneeling on top to weed it.",
 "verdict": {"shown": 2, "fixed": 7, "line": "As filmed the soil weighs three times what the rafters can carry; a shallow, light sedum roof on stronger framing is a fine project."},
 "scores": [
  {"test": "Roof carries the load", "shown": 1, "fixed": 7, "why": "Wet soil at 6 in is about 65 psf on rafters good for about 22; light media and larger rafters fix it"},
  {"test": "Stays watertight", "shown": 1, "fixed": 8, "why": "A tarp fails within a season; EPDM plus a root barrier is the standard"},
  {"test": "Drains and stays put", "shown": 2, "fixed": 7, "why": "Soil on a flat tarp ponds and slides; a slight pitch, drain mat, kerb and outlet"},
  {"test": "Plants survive the roof", "shown": 3, "fixed": 7, "why": "Meadow plants need deep soil and water; sedums thrive in 3 in"},
  {"test": "Safe to build and maintain", "shown": 2, "fixed": 6, "why": "Kneeling on a soft roof invites a fall or a collapse; work from a ladder or the edge"},
  {"test": "Cost", "shown": 8, "fixed": 6, "why": "Soil is cheap; membrane, media, plants and new rafters add up"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "Green Roofs on Historic Buildings: Physical Impact", "outlet": "National Park Service", "url": "https://www.nps.gov/articles/000/green-roofs-on-historic-buildings-physical-impact.htm"},
  {"n": 2, "title": "Stormwater Guidebook, Section 3.2: Green Roofs", "outlet": "District of Columbia Department of Energy and Environment", "url": "https://doee.dc.gov/sites/default/files/dc/sites/ddoe/publication/attachments/Section 3.2  Green Roofs.pdf"},
  {"n": 3, "title": "A Comprehensive Guide to Planning and Building a Small-Scale Green Roof", "outlet": "Turfonline", "url": "https://www.turfonline.co.uk/blog/plan-and-build-a-small-scale-green-roof/"},
  {"n": 4, "title": "Green Roof Construction: Structural Considerations", "outlet": "Greenroofs.com", "url": "https://www.greenroofs.com/2010/10/07/green-roof-construction-structural-considerations/"},
  {"n": 5, "title": "Rafter Span Chart", "outlet": "City of El Cajon Building and Fire Safety", "url": "https://elcajon.gov/home/showpublisheddocument/652/636335556371970000"},
  {"n": 6, "title": "Roof Gardens that are Gentle on the Roof", "outlet": "Perlite Institute", "url": "https://www.perlite.org/roof-gardens-that-are-gentle-on-the-roof/"}],
 "kit": {"summary": "A single-slope shed roof, 10 ft long, reframed to carry saturated media plus snow, with EPDM, root barrier, drain mat, filter fabric, a perforated kerb and 2 to 6 in of extensive media planted with sedums.",
  "options": opts,
  "metrics": [
   {"key": "green_psf", "label": "Green roof, saturated", "unit": "lb per sq ft", "note": "media, layers and plants, soaked"},
   {"key": "design_psf", "label": "Design load", "unit": "lb per sq ft", "note": "plus the roof itself and 30 psf of snow"},
   {"key": "rafter_nominal", "label": "Rafter size (2x_ at 16 in)", "unit": "in nominal depth", "note": "No. 2 spruce-pine-fir; an engineer confirms"},
   {"key": "wet_lb", "label": "Added weight, soaked", "unit": "lb", "note": "on the walls and floor below"},
   {"key": "media_cuyd", "label": "Growing media", "unit": "cu yd", "note": "lightweight mix, with 10% extra"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Assess the shed", "start": 0, "days": 7, "gate": "Rafter size, spacing and span measured; walls and floor sound; no rot"},
   {"phase": "Engineer and permit", "start": 7, "days": 14, "gate": "Engineer signed off on rafters, walls and base for the soaked load plus snow"},
   {"phase": "Reframe the roof", "start": 21, "days": 3, "gate": "New rafters at 16 in with hangers and ties; pitch at least 1/4 in per ft toward the outlet"},
   {"phase": "Deck and waterproof", "start": 24, "days": 2, "gate": "Plywood deck; one-piece EPDM turned up the kerb; hose test for 30 minutes with no drips inside"},
   {"phase": "Layers and kerb", "start": 26, "days": 1, "gate": "Root barrier, drain mat and fabric down; perforated kerb fixed; gravel strip clear at the outlet"},
   {"phase": "Media and planting", "start": 27, "days": 1, "gate": "Media spread to depth from the edge, never standing on the roof; plugs in and watered"},
   {"phase": "First season", "start": 28, "days": 90, "gate": "Water weekly until rooted; weed from a ladder; check the ceiling after every heavy rain"}],
  "assumptions": "Loads assume 10 psf for the existing roof, 30 psf of snow, saturated media at 4.5 psf per inch plus 2 psf for layers, and No. 2 spruce-pine-fir rafters. Prices are rough US retail ranges for late 2026, not quotes. Not an engineered design."}}
out = os.path.join(os.path.dirname(__file__), '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('reel: load %.0f psf against 2x4@24 capacity %.0f psf (%.1fx)' % (reel_load, reel_cap, reel_load / reel_cap))
print('check vs El Cajon DF #2 2x6@24 at 10 ft (table: 40 psf total): %.0f psf' % capacity(5.5, 1.3, 10.17, 24))
for c in configs:
    print(c)
