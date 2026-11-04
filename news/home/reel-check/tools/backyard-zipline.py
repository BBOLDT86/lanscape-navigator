# Builds the backyard zipline (Reel Check) from its text and its numbers.
import json, math, os
G = 32.2; SAG = 0.02; SLOPE = 0.03; CLEAR = 7; BREAK_LB = 14400; CLIP_EFF = 0.80; DYN = 2.0
body = open(os.path.join(os.path.dirname(__file__), 'backyard-zipline.md'), encoding='utf-8').read()
opts = [{"key": "span_ft", "label": "Span between trees", "unit": "ft", "values": [75, 100, 150, 200], "default": 100},
        {"key": "rider_lb", "label": "Heaviest rider", "unit": "lb", "values": [100, 175, 250], "default": 175}]
configs, mats = [], []
for L in opts[0]['values']:
    for W in opts[1]['values']:
        s = SAG * L
        t_static = W * L / (4 * s)                      # point load at mid-span: T = W L / 4s
        t_peak = t_static * DYN                         # bounce, jumps and two riders at once
        sf = BREAK_LB * CLIP_EFF / t_peak
        end_h = CLEAR + s                               # Zip Line Gear rule: clearance plus sag
        start_h = end_h + SLOPE * L                     # plus 3% slope on flat ground
        v_end = math.sqrt(2 * G * SLOPE * L) * 0.6818   # frictionless upper bound into the end, mph
        configs.append({"span_ft": L, "rider_lb": W, "end_anchor_ft": round(end_h, 1), "start_anchor_ft": round(start_h, 1),
                        "tension_lb": round(t_static, -1), "peak_lb": round(t_peak, -1), "safety_factor": round(sf, 1),
                        "end_speed_mph": round(v_end, 1)})
        cable = math.ceil(L * 1.05 + 30)
        for item, q, u, lo, hi in [
            ("Certified arborist check of both trees", 1, "visit", 150, 400),
            ("3/8 in 7x19 galvanized cable", cable, "ft", 1.5, 4),
            ("Tree-saver blocks or wide slings, both ends", 1, "set", 80, 220),
            ("Thimbles and 6 forged wire rope clips", 1, "set", 30, 70),
            ("Turnbuckle or cable tensioning kit", 1, "each", 60, 160),
            ("Come-along winch", 1, "each", 40, 90),
            ("Dual-wheel trolley with lanyard", 1, "each", 90, 250),
            ("Seat or sit harness", 1, "each", 60, 200),
            ("Spring or bungee end brake and stop block", 1, "set", 150, 450),
            ("Helmets", 2, "each", 30, 60),
            ("Launch step or low platform", 1, "each", 80, 300),
            ("Wood chips under the run, 3 in deep", math.ceil(L * 6 * 0.25 / 27 * 1.1), "cu yd", 25, 50)]:
            mats.append({"span_ft": L, "rider_lb": W, "item": item, "qty": q, "unit": u,
                         "low": round(q * lo), "high": round(q * hi)})
b = {
 "id": "2026-11-26-backyard-zipline", "publish": "2026-11-26", "written": os.environ.get("WRITTEN", "2026-11-02T23:00:00-05:00"),
 "byline": "Claude", "model": "Claude Opus 5.5", "category": "Outdoor living",
 "title": "The backyard zipline: a cable, two trees and an afternoon, or an emergency room trip?",
 "dek": "Reels make a zipline look like a cable cranked tight between two trees and a kid flying across the yard; the tight cable is the danger, and a safer line is slack, slow, braked and checked by an arborist.",
 "reel": "A steel cable is wrapped around two backyard trees, cranked drum-tight with a truck or a winch, and a child or an adult rides a pulley handle steeply down the line, sometimes over a pool. The rider lets go at the end or swings into the far tree. No brake, helmet, tree protection or sag ever appears.",
 "verdict": {"shown": 2, "fixed": 5, "line": "Ziplines are real backyard toys, but the tight, steep, brakeless line in the reel is the one that breaks bones; a slack, slow, braked kit is a cautious yes."},
 "scores": [
  {"test": "Cable and hardware hold", "shown": 2, "fixed": 7, "why": "A drum-tight cable multiplies a rider's weight 50 times; 2% sag cuts that to about 12"},
  {"test": "Trees survive it", "shown": 2, "fixed": 7, "why": "Bare cable girdles the trunk; blocks or slings on 12 in trees, checked by an arborist, do not"},
  {"test": "Rider stops safely", "shown": 1, "fixed": 6, "why": "No brake means hitting the tree; a spring brake and 3% slope keep the end speed low"},
  {"test": "Falls and clearance", "shown": 2, "fixed": 5, "why": "Falls cause most zipline injuries; 7 ft clearance, a seat and soft ground limit them"},
  {"test": "Doable by a homeowner", "shown": 6, "fixed": 6, "why": "A kit goes up in a day, but it needs a ladder, a winch and regular inspection"},
  {"test": "Cost", "shown": 8, "fixed": 7, "why": "Under $1,500 for a braked kit and an arborist's visit"}],
 "body": body,
 "sources": [
  {"n": 1, "title": "New Study Finds Zipline-Related Injuries Are Rapidly Increasing", "outlet": "Nationwide Children's Hospital", "url": "https://www.nationwidechildrens.org/newsroom/news-releases/2015/10/new-study-finds-zipline-related-injuries-are-rapidly-increasing"},
  {"n": 2, "title": "Understanding Zip Line Slope and Sag", "outlet": "Zip Line Gear", "url": "https://www.ziplinegear.com/blogs/engineering-and-design/zipline-slope-sag-guide"},
  {"n": 3, "title": "Zip Line Tension", "outlet": "Zip Line Gear", "url": "https://www.ziplinegear.com/pages/zip-line-tension"},
  {"n": 4, "title": "3/8 in 7x19 galvanized aircraft cable", "outlet": "US Cargo Control", "url": "https://www.uscargocontrol.com/products/3-8-7x19-galvanized-aircraft-cable-strand-core-250-coil"},
  {"n": 5, "title": "Wire rope (cable) clips safety talk", "outlet": "WorkSafeNB", "url": "https://www.worksafenb.ca/safety-talk/en/15-wire-rope-cable-clips.html"},
  {"n": 6, "title": "Accidental assault: girdled trees", "outlet": "Arborist Now", "url": "https://www.arboristnow.com/news/accidental-assault-girdled-trees-draft"},
  {"n": 7, "title": "How to Make a Zipline: A Step-by-Step DIY Guide", "outlet": "EngineerFix", "url": "https://engineerfix.com/how-to-make-a-zipline-a-step-by-step-diy-guide/"}],
 "kit": {"summary": "A 3/8 in galvanized cable between two arborist-checked trees at least 12 in thick, on tree-saver blocks, set at 3% slope with 2% sag, a seat and trolley, a spring brake and stop block, and soft ground under the run.",
  "options": opts,
  "metrics": [
   {"key": "start_anchor_ft", "label": "Start anchor height", "unit": "ft", "note": "on flat ground, at 3% slope"},
   {"key": "end_anchor_ft", "label": "End anchor height", "unit": "ft", "note": "7 ft clearance plus 2% sag"},
   {"key": "tension_lb", "label": "Cable tension", "unit": "lb", "note": "rider hanging still at mid-span"},
   {"key": "peak_lb", "label": "Peak pull on each tree", "unit": "lb", "note": "allowing double for bounce and jumps"},
   {"key": "safety_factor", "label": "Safety factor", "unit": "x", "note": "cable and clips against the peak pull"},
   {"key": "end_speed_mph", "label": "Speed into the brake", "unit": "mph", "note": "upper bound with no friction"}],
  "configs": configs, "materials": mats,
  "phases": [
   {"phase": "Pick the run and the trees", "start": 0, "days": 3, "gate": "Clear path 10 ft wide; no pool, fence, rock or road under or past the end"},
   {"phase": "Arborist check", "start": 3, "days": 10, "gate": "Both trees healthy, at least 12 in thick at anchor height, no decay or dead limbs over the run"},
   {"phase": "Hang the cable", "start": 13, "days": 1, "gate": "Blocks or slings on both trunks; three clips each end, saddles on the live side"},
   {"phase": "Tension and set sag", "start": 14, "days": 1, "gate": "Loaded sag at least 2% of span; 7 ft clearance under the heaviest rider"},
   {"phase": "Brake and test", "start": 15, "days": 1, "gate": "Sandbag runs at full weight stop at the brake, well short of the tree"},
   {"phase": "Rules and first rides", "start": 16, "days": 1, "gate": "Helmets on, one rider at a time, adult at the launch"},
   {"phase": "Inspection routine", "start": 17, "days": 90, "gate": "Weekly look at anchors; monthly cable check; reset blocks for tree growth each season"}],
  "assumptions": "Tension uses a rider hanging at mid-span on a weightless cable (T = WL/4s), doubled for bounce; 3/8 in 7x19 cable breaks at 14,400 lb and clipped ends hold about 80% of that. Speeds ignore friction and drag. Prices are rough US ranges for late 2026, not quotes."}}
out = os.path.join(os.path.dirname(__file__), '..', 'queue', b['id'] + '.json')
json.dump(b, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for c in configs: print(c)
