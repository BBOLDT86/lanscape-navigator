import os
"""House structures from house.json."""
import json, re, html
SP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "")
H = json.load(open(SP + "data/house.json"))
un = lambda s: html.unescape(s) if isinstance(s, str) else s

REGION = {}
for s in "OH MI MN IA WI PA IL IN MO".split(): REGION[s] = "Midwest"
for s in "NC GA TX FL SC AL MS LA KY TN AR VA WV OK".split(): REGION[s] = "South"
for s in "ME NH MA RI NJ DE NY VT CT MD".split(): REGION[s] = "Northeast"
for s in "AK CO NM OR MT ID WY AZ NV CA WA UT HI".split(): REGION[s] = "West"
for s in "NE KS SD ND".split(): REGION[s] = "Plains"


def norm_district(code):
    m = re.match(r"([A-Z]{2})[- ]?0*(\d+|AL)", str(code).strip().upper())
    if not m: return str(code)
    st, n = m.group(1), m.group(2)
    return f"{st}-AL" if n == "AL" else f"{st}-{int(n):02d}"


def rating(r):
    if not r or not isinstance(r, str): return None
    r = re.sub(r"\s*\(.*$", "", r.strip())
    r = r.replace("Leans", "Lean").replace("Solid", "Safe").replace("Tilts", "Tilt")
    if r.lower().replace(" ", "").replace("-", "") in ("tossup",): return "Toss-up"
    m = re.match(r"(Safe|Likely|Lean|Tilt)\s+(D|R|Democratic|Republican)", r)
    if m: return m.group(1) + " " + m.group(2)[0]
    if r.lower().startswith("toss"): return "Toss-up"
    return None


def signed(s):
    if s is None: return None
    if isinstance(s, (int, float)): return float(s)
    s = str(s).strip().upper()
    if s.startswith("EVEN"): return 0.0
    m = re.match(r"([DR])\s*\+\s*([\d.]+)", s)
    if not m: return None
    v = float(m.group(2)); return v if m.group(1) == "D" else -v


def battlefield():
    out = []
    for b in H["battlefield"]:
        d = norm_district(b["district"]); st = d[:2]
        polls = b.get("poll") or []
        poll = None
        if polls:
            p = polls[0]   # lists are newest-first
            if isinstance(p.get("dem"), (int, float)) and isinstance(p.get("rep"), (int, float)):
                lab = (p.get("partisan") or p.get("partisan_label") or "")
                part = "D" if str(lab).startswith("D") else "R" if str(lab).startswith("R") else ""
                poll = dict(pollster=un(p.get("pollster")), dem=p["dem"], rep=p["rep"], partisan=part, url=p.get("url"), date=p.get("dates") or p.get("date"))
        dem_name = un(b.get("dem_cand"))
        if d == "AK-AL": dem_name = "Bill Hill (I) / Eric Hafner (D)"
        out.append(dict(district=d, state=st, region=REGION.get(st, "South"), incumbent=un(b.get("incumbent")) if not b.get("open") else None,
                        party=b.get("party"), open=bool(b.get("open")), cook=rating(b.get("cook")), sabato=rating(b.get("sabato")), ie=rating(b.get("ie")),
                        pvi=signed(b.get("pvi")), pres24=signed(b.get("pres24")), dem=dem_name, rep=un(b.get("rep_cand")), poll=poll))
    return out


def solid_counts(bf):
    cook = next(r for r in H["ratings_counts"] if r["source"].startswith("Cook"))
    sd, sr = cook["solid_d"], cook["solid_r"]
    sd -= sum(1 for b in bf if b["cook"] == "Safe D")
    sr -= sum(1 for b in bf if b["cook"] == "Safe R")
    return dict(D=sd, R=sr)


def ratings_counts():
    out = []
    for r in H["ratings_counts"]:
        keys = [("solid_d", "Safe D"), ("safe_d", "Safe D"), ("likely_d", "Likely D"), ("lean_d", "Lean D"), ("tilt_d", "Tilt D"), ("tossup", "Toss-up"),
                ("tilt_r", "Tilt R"), ("lean_r", "Lean R"), ("likely_r", "Likely R"), ("solid_r", "Safe R"), ("safe_r", "Safe R")]
        parts = [f"{lab} {r[k]}" for k, lab in keys if r.get(k) is not None and k in r]
        val = f"D {r.get('total_d')} · R {r.get('total_r')} · Toss-up {r.get('tossup')}"
        out.append(dict(src=r["source"], date=(r.get("as_of") or "")[:10], val=val, url=r.get("url"), detail=" / ".join(parts)))
    return out


def gb_polls():
    out = []
    for i, p in enumerate(H["gb_polls"]):
        if not isinstance(p.get("dem"), (int, float)) or not isinstance(p.get("rep"), (int, float)): continue
        approx = False
        if not p.get("end"):
            m_ = re.search(r"Published (\d{4}-\d{2}-\d{2})", p.get("note") or "")
            if not m_: continue
            import datetime as _dt
            e_ = _dt.date.fromisoformat(m_.group(1)) - _dt.timedelta(days=2)
            p = dict(p, end=e_.isoformat(), start=(e_ - _dt.timedelta(days=7)).isoformat())
            approx = True   # field dates estimated from the publication date
        sp = (p.get("sponsor") or "")
        part = ""
        if p.get("partisan_sponsor"):
            if re.search(r"\(D\)|Democrat|DCCC|DNC|Navigator|Priorities|House Majority", sp + " " + p["pollster"], re.I): part = "D"
            elif re.search(r"\(R\)|Republican|NRCC|RNC|Congressional Leadership", sp + " " + p["pollster"], re.I): part = "R"
        out.append(dict(id=f"gb{i}", race="GB", pollster=un(p["pollster"]), sponsor=un(sp), partisan=part, start=p.get("start") or p["end"], end=p["end"],
                        n=p.get("n"), pop=p.get("population") or "", dem=p["dem"], rep=p["rep"], url=p.get("url") or p.get("source"), approxDate=approx))
    return out


def gb_averages():
    out = []
    for a in H["gb_averages"]["current"]:
        if a.get("margin") is None: continue
        if "low confidence" in (a.get("note") or ""): continue
        out.append(dict(src=a["aggregator"], val=("D+%.1f" % a["margin"]) if a["margin"] > 0 else ("R+%.1f" % -a["margin"]), date=a.get("as_of") or "2026-10-11", url=a.get("url")))
    return out


def forecasts():
    out = []
    for f in H["forecasts"]:
        if f.get("dem_prob") is None: continue
        t = f.get("type", "")
        val = f"D {round(f['dem_prob'])}%" + (f" · {round(f['dem_seats'])} seats" if f.get("dem_seats") else "")
        out.append(dict(src=f["source"].split(" (")[0], val=val, date=(f.get("as_of") or "").replace("week of ", "")[:10], url=f.get("url"), kind=t))
    return out


SRC_CODES = {"W": "https://en.wikipedia.org/wiki/2025%E2%80%932026_United_States_redistricting",
             "PM": "https://www.policymap.com/blog/redistricting-tracker"}


def redistricting():
    out = []
    for s in H["redistricting"]["states"]:
        if not (s.get("new_map_in_effect_2026") or "BLOCKED" in (s.get("status_2026") or "").upper()): continue
        srcs = s.get("sources") or []
        direct = [u for u in srcs if str(u).startswith("http")]          # a state-specific article beats the general trackers
        url = direct[0] if direct else next((SRC_CODES[c] for c in srcs if c in SRC_CODES), None)
        out.append(dict(state=s["state"], status=s.get("status_2026", ""), effect=s.get("expected_effect", ""), note=s.get("note", ""), url=url))
    return out


def composition():
    c = H["composition"]
    note = (f"Republicans hold **{c['republicans']}** seats and Democrats **{c['democrats']}**, with {c.get('independents', 0)} independent "
            f"(Kevin Kiley of CA-03, who left the GOP but sits with its conference) and {c.get('vacancies', 0)} vacancies (FL-20, TX-23). "
            f"Measured from the 2024 result, Democrats need a net gain of **{c.get('dem_net_gain_needed', 3)}** seats.")
    return dict(D=c["democrats"], R=c["republicans"], vac=c.get("vacancies"), note=note)


SOURCES = [
    ("U.S. House", "Cook Political Report — House ratings (Oct 9)", "https://www.cookpolitical.com/ratings/house-race-ratings"),
    ("U.S. House", "Sabato’s Crystal Ball ratings via 270toWin (Oct 8)", "https://www.270towin.com/2026-house-election/table/crystal-ball-2026-house-forecast/"),
    ("U.S. House", "Inside Elections ratings via 270toWin (Oct 1)", "https://www.270towin.com/2026-house-election/table/inside-elections-2026-house-ratings/"),
    ("U.S. House", "Wikipedia — 2026 House election ratings (Cook PVI)", "https://en.wikipedia.org/wiki/2026_United_States_House_of_Representatives_election_ratings"),
    ("U.S. House", "270toWin — crossover districts and district results", "https://www.270towin.com/2026-house-election-find/crossover-districts-2024-election"),
    ("U.S. House", "Wikipedia — 2025–2026 redistricting", "https://en.wikipedia.org/wiki/2025%E2%80%932026_United_States_redistricting"),
    ("U.S. House", "PolicyMap — redistricting tracker", "https://www.policymap.com/blog/redistricting-tracker"),
    ("U.S. House", "Silver Bulletin — generic ballot average", "https://www.natesilver.net/p/generic-ballot-average-2026-nate-silver-bulletin-congress-polls"),
    ("U.S. House", "FiftyPlusOne — generic ballot", "https://fiftyplusone.news/polls/generic-ballot/generic-ballot"),
    ("U.S. House", "Decision Desk HQ — House forecast", "https://votes.decisiondeskhq.com/forecast/2026/house"),
]
REDIST_NOTE = ("Maps in effect for 2026 shift roughly **15 seats toward Republicans** (Texas 5, Florida 4, Ohio 2, North Carolina, Tennessee, Louisiana and Alabama 1 each) "
               "and **6 toward Democrats** (California 5, Utah 1) — a net of about **R+9**, before any votes are cast. The Supreme Court’s Louisiana v. Callais ruling (April 29) "
               "opened the door to the Tennessee, Louisiana and Alabama changes.")
