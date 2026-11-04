# Builds the treehouse with a suspension bridge to a second tree (Reel Check) from its text and its numbers.
import json, math, os
here = os.path.dirname(__file__)
body = open(os.path.join(here, 'treehouse-suspension-bridge.md'), encoding='utf-8').read()

DECK_W = 3.0                 # walkway width, ft
DEAD = 15.0                  # planks, cables, side netting, lb per ft of bridge
LIVE = 200 / 3 * 1.5         # one 200 lb person every 3 ft, times 1.5 for bouncing, lb per ft
W = DEAD + LIVE              # design line load, lb per ft
HEIGHT = 9.0                 # deck height above ground, ft (under the 10 ft the pediatric study advises)
# galvanized wire rope: diameter in, minimum breaking strength lb (7x19 aircraft cable to 3/8, 6x19 IWRC above)
ROPE = [(0.25, 7000), (5 / 16, 9800), (0.375, 14400), (0.5, 26600), (0.625, 41200), (0.75, 58800)]
DF = 5                       # design factor: working load = breaking strength / 5

def cable(L, d, w):
    """Horizontal pull H and peak tension T for a parabolic cable of span L, sag d, load w per ft."""
    H = w * L * L / (8 * d)
    return H, H * math.sqrt(1 + 16 * (d / L) ** 2)

opts = [{"key": "span_ft", "label": "Span between trees", "unit": "ft", "values": [20, 25, 30, 35, 40], "default": 30},
        {"key": "sag_pct", "label": "Cable sag", "unit": "% of span", "values": [6, 8, 10], "default": 10}]
configs, mats = [], []
for L in opts[0]['values']:
    for p in opts[1]['values']:
        d = L * p / 100
        H, T = cable(L, d, W)               # the spring take-up at the floating end holds this sag as the trees sway
        per = T / 2                                   # two main cables share the deck
        size, brk = next(r for r in ROPE if r[1] / DF >= per)
        slack_in = 8 * d * d / (3 * L) * 12           # cable length beyond the span: how far the trees can part before it goes straight
        configs.append({"span_ft": L, "sag_pct": p, "sag_in": round(d * 12), "slack_in": round(slack_in, 1),
                        "tension_lb": round(per), "tree_pull_lb": round(H), "cable_in": size,
                        "tree_moment_kip_ft": round(H * (HEIGHT + 3) / 1000, 1)})
        cab_len = math.ceil((L * 1.05 + 12) * 2)       # two main cables, with wraps and terminations
        hand_len = math.ceil((L * 1.05 + 10) * 2)
        planks = math.ceil(L / (6.5 / 12))             # 2x6 treads on 1 in gaps
        net = math.ceil(L * 1.1 * 2 * 3.5)
        main_lo, main_hi = {0.25: (0.6, 1.0), 5 / 16: (0.8, 1.3), 0.375: (1.0, 1.7), 0.5: (1.8, 3.0),
                            0.625: (2.8, 4.5), 0.75: (3.8, 6.0)}[size]
        for item, q, u, lo, hi in [
            (f"Galvanized wire rope, {size:g} in, main cables", cab_len, "ft", main_lo, main_hi),
            ("Galvanized wire rope, 1/4 in, hand lines", hand_len, "ft", 0.6, 1.0),
            ("Rated thimbles, wire rope clips (3 per end) or swaged ends", 8, "ends", 25, 60),
            ("Spring take-up (die springs or a counterweight) and turnbuckles at the floating end", 2, "each", 120, 350),
            ("Pressure-treated 2x6 treads, 3 ft, with spacers", planks, "treads", 3.5, 6),
            ("Side netting or welded mesh, 3.5 ft high", net, "sq ft", 1.5, 4),
            ("Treehouse attachment bolts (TABs) with brackets, both trees", 8, "each", 120, 250),
            ("Floating or sliding brackets for the second tree's beams", 2, "each", 150, 400),
            ("Two platforms: beams, joists, decking, 8 x 8 ft each", 128, "sq ft", 12, 22),
            ("Guards 38 in high, solid or mesh infill, both platforms", 64, "ft", 18, 40),
            ("Wood mulch, 9 in deep, 6 ft beyond every edge", round((2 * (20 * 20) + (L + 2) * 15) * 0.75 / 27, 1), "cu yd", 30, 50),
            ("Certified arborist's tree assessment", 1, "each", 250, 600),
            ("Treehouse engineer's review of the bridge and bolts", 1, "each", 500, 2000)]:
            mats.append({"span_ft": L, "sag_pct": p, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})

# the clip: 30 ft rope bridge strung nearly flat, about 9 in of sag
clip_H, clip_T = cable(30, 0.75, W)
print('clip: H %.0f lb total, %.0f per rope; slack %.2f in' % (clip_H, clip_T / 2, 8 * 0.75 ** 2 / 90 * 12))
for c in configs:
    if c['span_ft'] == 30: print(c)

b = {
 "id": "2026-11-20-treehouse-suspension-bridge", "publish": "2026-11-20", "written": "2026-11-02T21:37:00-05:00",
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Shelter",
 "title": "The treehouse with a rope bridge to a second tree can work, but not strung tight",
 "dek": "A wobbly suspension bridge from one tree fort to another is the dream backyard reel, but a nearly flat rope pulls tons on the trees, and the real hazard is a fall.",
 "reel": "A builder frames a small treehouse high in one tree and a lookout platform in another, then strings a bridge of planks on ropes between them, pulled almost flat. Children run across it while it bounces. The bolts, the ropes' ratings and anything soft on the ground below never appear.",
 "verdict": {"shown": 3, "fixed": 7, "line": "A tight rope bridge between two swaying trees is a tension trap over a hard fall; on rated cable with real sag, a floating end, low decks and netting, it is a great backyard build."},
 "scores": [
  {"test": "Cables carry the crowd", "shown": 2, "fixed": 8, "why": "A flat 30 ft bridge puts about 8,600 lb on each rope; 10% sag cuts that to about a quarter"},
  {"test": "Lets the trees move", "shown": 1, "fixed": 7, "why": "Under an inch of slack goes straight in a breeze; real sag and a floating end take the sway"},
  {"test": "Kind to the trees", "shown": 3, "fixed": 7, "why": "Few large bolts and an arborist's check instead of ropes and nails around the trunk"},
  {"test": "Fall protection", "shown": 1, "fixed": 7, "why": "Decks under 10 ft, 38 in guards, netting on the bridge and 9 in of mulch below"},
  {"test": "Lasts ten years", "shown": 3, "fixed": 7, "why": "Galvanized cable and treated treads, with a yearly check of clips and bolts"},
  {"test": "Doable by one handy person", "shown": 6, "fixed": 6, "why": "Carpentry and rigging a careful amateur can do, with help lifting beams"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "New national study emphasizes need for tree house safety standards", "outlet": "Nationwide Children's Hospital", "url": "https://www.nationwidechildrens.org/newsroom/news-releases/2009/03/new-national-study-emphasizes-need-for-tree-house-safety-standards"},
  {"n": 2, "title": "Hardware highlight: the TAB (treehouse attachment bolt)", "outlet": "Nelson Treehouse", "url": "https://nelsontreehouse.com/blog/hardware-highlight-tab"},
  {"n": 3, "title": "Testing the strength of treehouse attachment bolts", "outlet": "Nelson Treehouse", "url": "https://nelsontreehouse.com/blog/tab-testing/"},
  {"n": 4, "title": "Treehouse design and engineering: 10 things you need to know", "outlet": "Treehouse Supplies", "url": "https://www.treehousesupplies.com/blogs/treehouse-supplies/treehouse-design-engineering-10-things-you-need-to-know"},
  {"n": 5, "title": "Building a treehouse between two trees", "outlet": "The Treehouse Guide", "url": "https://thetreehouseguide.com/constructiontutorials/twotrees.htm"},
  {"n": 6, "title": "3/8 in aircraft cable, 7x19, galvanized", "outlet": "Hanes Supply", "url": "https://www.hanessupply.com/wire-rope-wir40140"},
  {"n": 7, "title": "Guardrails vs. handrails: where do you need them?", "outlet": "Fine Homebuilding", "url": "https://finehomebuilding.com/2020/01/02/guardrails-vs-handrails-where-do-you-need-them"},
  {"n": 8, "title": "Proposed guide specification for FRP pedestrian bridges", "outlet": "USDA Forest Service", "url": "https://www.fs.usda.gov/t-d/pubs/htmlpubs/htm06232824/page12.htm"}],
 "kit": {"summary": "Two 8 by 8 ft platforms about 9 ft up, one fixed on treehouse attachment bolts and one on floating brackets, joined by a netted plank bridge hung from two galvanized wire ropes with real sag and a take-up at one end.",
  "options": opts,
  "metrics": [
   {"key": "tension_lb", "label": "Peak pull per main cable", "unit": "lb", "note": "a full line of people, bouncing"},
   {"key": "cable_in", "label": "Main cable size", "unit": "in", "note": "galvanized wire rope at a 5:1 safety factor"},
   {"key": "tree_pull_lb", "label": "Sideways pull on each tree", "unit": "lb", "note": "both cables together, toward the other tree"},
   {"key": "tree_moment_kip_ft", "label": "Bending at the tree base", "unit": "kip-ft", "note": "for the arborist to judge against the trunk"},
   {"key": "sag_in", "label": "Sag at mid-span", "unit": "in", "note": "lowest point below the anchors, unloaded shape"},
   {"key": "slack_in", "label": "Sway allowance", "unit": "in", "note": "extra cable length; the take-up spring must cover more sway than this"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Arborist and layout", "start": 0, "days": 14, "gate": "Both trees healthy and sound at bolt height; span and deck height set, decks no higher than 10 ft"},
   {"phase": "Bolts and brackets", "start": 14, "days": 2, "gate": "TABs in sound wood; second tree's brackets slide freely"},
   {"phase": "Platforms and guards", "start": 16, "days": 8, "gate": "Guards at 38 in with no gap a 4 in ball passes; each top rail takes a 200 lb push"},
   {"phase": "Cable anchors", "start": 24, "days": 2, "gate": "Cables wrap beams or rated anchors, never bare trunks; thimbles and three clips per end"},
   {"phase": "Hang the deck", "start": 26, "days": 3, "gate": "Sag set to the kit's figure; take-up adjusted, not cranked tight"},
   {"phase": "Netting and mulch", "start": 29, "days": 2, "gate": "Netting closes both sides of the bridge; 9 in of mulch 6 ft past every edge"},
   {"phase": "Load test", "start": 31, "days": 1, "gate": "Sandbags or adults at one per 3 ft hold an hour; nothing slips, sag returns"},
   {"phase": "Yearly check", "start": 365, "days": 1, "gate": "Clips re-torqued, cables free of rust and kinks, brackets clear of trunk growth"}],
  "assumptions": "Loads assume one 200 lb person every 3 ft with a 1.5 factor for bouncing plus 15 lb per ft of bridge, a parabolic cable that does not stretch, and a spring take-up that holds the design sag as the trees sway; cable breaking strengths are typical catalog values. Prices are rough US ranges for late 2026, not quotes, and this is not an engineered design."}}
out = os.path.join(here, '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
