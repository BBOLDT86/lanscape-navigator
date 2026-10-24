"""Assemble DATA for The Hinge from research JSON + backtest. Works with partial inputs."""
import json, os, re, statistics as st, html, sys
SP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "")
sys.path.insert(0, SP)
from build_static import *          # noqa
import build_ohio_part as OP        # noqa
import build_national_part as NP    # noqa

def load(name):
    p = SP + "data/" + name
    return json.load(open(p)) if os.path.exists(p) else None

SEN = load("senate.json")      # {polls:[...], races:[...]}
HOU = load("house.json")
NAT = load("national.json")
HIS = load("history.json")
un = lambda s: html.unescape(s) if isinstance(s, str) else s
norm_district = OP.norm_district

# ======================================================================= history & lenses
comp24 = gen24 = None
if HIS:
    import build_history_part as HH
    comp24, gen24 = HH.COMP24, HH.GEN24
LENSES, COMP, GEN = lenses(comp24, gen24)
LENSES["offyear25"] = {"label": "2025 off-year", "state": -6.1, "gb": -6.1,
                       "note": "The opposite stress test: Silver Bulletin found polls underestimated Democrats by 6.1 points in 2025’s low-turnout races. Applied to the generic ballot too, as an assumption."}
DEFAULT_LENS = "recentMidterms"

import build_house_part as HP
# ======================================================================= state polling record (2014+), shrunk
SR = json.load(open(SP + "data/state_resid_2014_2022.json"))
def state_bias_map(extra24):
    rows = [dict(state=r["state"], resid=r["resid"]) for r in SR["rows"]]
    if extra24:
        m = st.mean(e["err"] for e in extra24)
        rows += [dict(state=e["state"], resid=e["err"] - m) for e in extra24]
    out = {}
    for s_ in sorted(set(r["state"] for r in rows)):
        res = [r["resid"] for r in rows if r["state"] == s_]; n = len(res)
        out[s_] = dict(raw=round(st.mean(res), 2), n=n, shrunk=round(st.mean(res) * n / (n + 6.3), 2))
    return out
EXTRA24 = []   # filled from research: [{state, err}] for 2024 statewide races (avg - actual)

# ======================================================================= Senate races
def pres24_for(st_):
    return PRES24_APPROX.get(st_)

def rating_norm(r):
    if not r or not isinstance(r, str): return None
    r = r.strip()
    m = {"tossup": "Toss-up", "toss-up": "Toss-up", "toss up": "Toss-up"}
    if r.lower() in m: return "Toss-up"
    r = r.replace("Leans", "Lean").replace("Solid", "Safe").replace("Tilts", "Tilt")
    r = re.sub(r"\s*\(.*\)", "", r)
    r = r.replace("Republican", "R").replace("Democratic", "D").replace("Democrat", "D")
    return r

def tier_of(rt):
    vals = [rating_norm(rt.get(k)) for k in ("cook", "sabato", "ie") if rt.get(k)]
    if not vals: return 3
    if any(v and (v.startswith("Toss") or v.startswith("Tilt") or v.startswith("Lean")) for v in vals): return 1
    if any(v and v.startswith("Likely") for v in vals): return 2
    return 3

races = []
polls = []
import build_senate_part as SPT
SEN_INFO = SPT.races_info() if SEN else {}
for st_, held, inc, special in SENATE_SEATS:
    info = SEN_INFO.get(st_)
    rid = st_ + ("-SP" if special else "-S")
    if info:
        rt = dict(cook=HP.rating(info["ratings"]["cook"]) if HOU else info["ratings"]["cook"], sabato=HP.rating(info["ratings"]["sabato"]) if HOU else None, ie=HP.rating(info["ratings"]["ie"]) if HOU else None)
        races.append(dict(id=rid, office="Senate", state=st_, name=STATE_NAMES[st_], special=special, dem=info["dem"], rep=info["rep"], others=info["others"],
                          held=held, incumbent=(None if info["open"] else inc), incParty=(None if info["open"] else held), appointed=st_ in ("OH", "FL"),
                          pres24=info["pres24"], pres24Approx=False, region=REGION[st_], elast=info["elast"], tier=tier_of(rt), ratings=rt,
                          msgD=info["msgD"], msgR=info["msgR"], notes=info["notes"], debates=info["debates"], prior=info["prior"], ext=info["ext"],
                          incAdv=info["incAdv"], cand=info["cand"], candNote=info["candNote"], dSideInd=info["dSideInd"]))
    else:
        lean = PRES24_APPROX[st_] + 1.5
        center = max(12.0, 0.8 * lean + 2) if held == "D" else min(-12.0, 0.8 * lean - 2)
        races.append(dict(id=rid, office="Senate", state=st_, name=STATE_NAMES[st_], special=special, dem=None, rep=None, held=held, incumbent=inc, incParty=held,
                          appointed=special, pres24=PRES24_APPROX[st_], pres24Approx=True, region=REGION[st_], elast=1.0, tier=3,
                          ratings=dict(cook=None, sabato=None, ie=None), ratingNote="Likely or Safe " + held + " at all three forecasters",
                          fixedPrior=round(center, 1), sigmaPrior=4.0, notes="Not among the races Cook, Sabato or Inside Elections rate Toss-up or Lean, so this tracker carries no polls for it; the forecast uses a prior anchored to that rating and the state’s 2024 presidential lean. Nominees are not tracked here.",
                          msgD=None, msgR=None, debates=[], prior=None, ext=[], incAdv=0, cand=0))
if SEN:
    sp_polls, SEN_UNDATED = SPT.polls()
    polls += sp_polls

# Ohio governor
races.append(OP.ohio_gov_race())
polls += OP.ohio_gov_polls()

if SEN:
    for i, p in enumerate(SEN.get("polls", [])):
        pass  # filled once the Senate file exists

# ======================================================================= House
house = dict(composition=dict(D=213, R=220, vac=2, note=""), solid=dict(D=170, R=180), battlefield=[], gbPolls=[], gbAverages=[], forecasts=[],
             ratingsCounts=[], redistricting=[], gbFallback=2.0, gbBaseline=1.0, gbFrom="2026-08-25")
if HOU:
    import build_house_part as HP
    bf = HP.battlefield()
    house.update(composition=HP.composition(), battlefield=bf, solid=HP.solid_counts(bf), gbPolls=HP.gb_polls(), gbAverages=HP.gb_averages(),
                 ratingsCounts=HP.ratings_counts(), redistricting=HP.redistricting(), redistNote=HP.REDIST_NOTE)
    assert house["solid"]["D"] + house["solid"]["R"] + len(bf) == 435, (house["solid"], len(bf))

# ======================================================================= national
national = dict(messages=NP.MESSAGES, issues=NP.ISSUES, issuesNote=NP.ISSUES_NOTE, signals=NP.SIGNALS, groups=NP.GROUPS, events=NP.EVENTS,
                approvalHeadline="Trump net approval −21.9 (Silver Bulletin, Oct 9).", forecasts=NP.EXT_FORECASTS)
house["forecasts"] = HP.forecasts() if HOU else NP.EXT_FORECASTS["house"]
if not house["gbPolls"]:
    house["gbPolls"] = NP.gb_polls_fallback()
polls += house["gbPolls"]

# ======================================================================= lab contexts
def d2(d, r): return 100.0 * d / (d + r)
lab_ctx = []
RES24 = HH.res24() if HIS else {}   # state -> list of dict(label, d, r) for 2024 statewide races

def refs_for(state):
    out = []
    for r in R538:
        if r["state"] != state or r["cycle"] < 2016: continue
        if r["type"] not in ("Sen-G", "Gov-G", "Pres-G"): continue
        if "-R_" in r["race"] or "Sen-R" in r["race"] or "Sen-SR" in r["race"]: continue  # skip runoffs
        if r["d_pct"] < 20 or r["r_pct"] < 20: continue                                  # skip races without a real two-party contest
        off = {"Sen-G": "Sen", "Gov-G": "Gov", "Pres-G": "Pres"}[r["type"]]
        out.append(dict(label=f"{r['cycle']} {off} · {r['d'].split()[-1]} v {r['r'].split()[-1]}", year=r["cycle"], d2=round(d2(r["d_pct"], r["r_pct"]), 2)))
    for x in RES24.get(state, []):
        out.append(dict(label=x["label"], year=2024, d2=round(d2(x["d"], x["r"]), 2)))
    return out

def build_lab(races, national_refs):
    ctx = []
    order = sorted([r for r in races if r["office"] == "Senate" and r.get("tier", 3) <= 2], key=lambda r: r["name"])
    gov = [r for r in races if r["id"] == "OH-GOV"]
    for r in gov + order:
        refs = refs_for(r["state"])
        if len(refs) < 2: continue
        lab = r["name"] + (" — Governor" if r["office"] == "Governor" else " — Senate" + (" (special)" if r.get("special") else ""))
        ctx.append(dict(id=r["id"], label=lab, raceId=r["id"], refs=refs))
    if national_refs:
        ctx.append(dict(id="US-HOUSE", label="National — U.S. House vote", national=True, refs=national_refs))
    return ctx

OHIO_SOURCES = [
    ("Ohio", "Wikipedia — 2026 Ohio gubernatorial election", "https://en.wikipedia.org/wiki/2026_Ohio_gubernatorial_election"),
    ("Ohio", "RealClearPolling — Ohio governor", "https://www.realclearpolling.com/polls/governor/general/2026/ohio/ramaswamy-vs-acton"),
    ("Ohio", "270toWin — Ohio governor polls", "https://www.270towin.com/2026-governor-polls/ohio"),
    ("Ohio", "Suffolk/USA Today Ohio poll (Oct 2)", "https://www.suffolk.edu/-/media/suffolk/documents/academics/research-at-suffolk/suprc/polls/other-states/2026/10_2_2026_ohio_press_release.pdf"),
    ("Ohio", "Marist Ohio poll tables", "https://maristpoll.marist.edu/wp-content/uploads/2026/09/Marist-Poll_OH-NOS-and-Tables_202609281347aC909p6465.pdf"),
    ("Ohio", "Wikipedia — 2026 House elections in Ohio", "https://en.wikipedia.org/wiki/2026_United_States_House_of_Representatives_elections_in_Ohio"),
    ("Ohio", "Signal Ohio — the new congressional map", "https://signalohio.org/ohio-officials-approve-new-congressional-map-that-could-help-republicans-win-two-more-u-s-house-seats/"),
    ("Ohio", "Ohio Secretary of State — voting schedule", "https://www.ohiosos.gov/elections/voting-schedule-text-only"),
    ("Ohio", "Ohio Capital Journal — State Issue 3", "https://ohiocapitaljournal.com/voter-guides/ballot-measures/2026-ohio-general-election-statewide-issue-3/"),
    ("Ohio", "WGCU/NPR — the governor’s race", "https://www.wgcu.org/2026-09-27/ohio-governors-race-ramaswamy-and-acton-clash-in-rare-democratic-pickup-opportunity"),
    ("Ohio", "Boston Globe/NYT — the governor’s race", "https://www.bostonglobe.com/2026/10/05/nation/ohio-governor-campaign-ugly-race/"),
    ("Ohio", "Wikipedia — 2024 Ohio Senate and presidential county results", "https://en.wikipedia.org/wiki/2024_United_States_Senate_election_in_Ohio"),
]
OHIO_INTRO = ("Two marquee statewide races share Ohio’s ballot: an open governor’s race between **Amy Acton (D)** and **Vivek Ramaswamy (R)** that all three major forecasters rate a Toss-up, "
              "and the special election for the Senate seat JD Vance vacated, between appointed Sen. **Jon Husted (R)** and former Sen. **Sherrod Brown (D)**. "
              "Early in-person voting began Oct 6; polls close at 7:30 p.m. ET on Nov 3.")
OHIO_HOUSE_NOTE = ("The Ohio Redistricting Commission unanimously approved a compromise map on Oct 31, 2025. It made OH-9 more Republican (Trump +11 under the new lines) and OH-1 competitive (Trump +3), "
                   "while OH-13 became slightly more Democratic (Harris +3). Cook rates OH-7 a Toss-up; Rep. Max Miller faces abuse allegations from his ex-wife, which he denies.")
SCENARIOS = [
    dict(shift=0, label="Current forecast", note="Default lens, no extra miss"),
    dict(shift=3.4, label="2012-style miss", note="Democrats beat their polls by about 3.4"),
    dict(shift=1.6, label="Typical midterm late break", note="Late movement favored the out-party in 4 of 5 midterms (1998–2014), 1.6 points on average"),
    dict(shift=1.3, label="2022-style miss", note="Democrats beat their polls by about 1.3 in competitive races"),
    dict(shift=-1.4, label="2018-style miss", note="Republicans beat their polls by about 1.4"),
    dict(shift=-3.1, label="2014/2016-style miss", note="Republicans beat their polls by about 3"),
    dict(shift=-6.0, label="2020-style miss", note="Republicans beat their polls by about 6"),
]
def poll_avg(plist, as_of="2026-10-11", tau=14.0, part_adj=3.0, nmax=3000):
    import math, datetime as dt_
    t = lambda s: dt_.datetime.fromisoformat(s + "T12:00:00")
    now = t(as_of); S_ = W_ = 0.0
    for p in plist:
        if p.get("excluded") or not p.get("end") or t(p["end"]) > now: continue
        mid = t(p.get("start") or p["end"]) + (t(p["end"]) - t(p.get("start") or p["end"])) / 2
        age = max(0.0, (now - mid).total_seconds() / 86400)
        m = p["dem"] - p["rep"] + (-part_adj if p.get("partisan") == "D" else part_adj if p.get("partisan") == "R" else 0)
        n = min(max(p.get("n") or 600, 100), nmax)
        w = math.exp(-age / tau) * math.sqrt(n / 600)
        S_ += w * m; W_ += w
    return S_ / W_ if W_ else None
if HIS:
    EXTRA24 = [dict(state=e["state"], err=e["err"]) for e in HH.extra24()]
SB = state_bias_map(EXTRA24)
for r_ in races:
    sb = SB.get(r_["state"])
    if sb and r_.get("fixedPrior") is None:
        r_["stateBias"] = sb["shrunk"]; r_["stateBiasN"] = sb["n"]; r_["stateBiasRaw"] = sb["raw"]
    if r_["id"] == "NE-S":
        r_["cand"] = 6.9
        r_["candNote"] = "Osborn lost the 2024 Senate race by 6.7 while Trump carried Nebraska by 20.5 — a 13.8-point over-performance, half-credited (**+6.9**)."
GB_RAW = poll_avg([p for p in polls if p["race"] == "GB"])
house["gbFallback"] = round(GB_RAW, 2)
house["gbBaseline"] = round(GB_RAW - LENSES[DEFAULT_LENS]["gb"], 2)

NATIONAL_REFS = HH.national_refs() if HIS else [dict(label=f"{r['cycle']} House vote", year=r["cycle"], d2=round(d2(r["d_pct"], r["r_pct"]), 2)) for r in R538 if r["type"] == "House-G-US"]
LAB_INTRO = ("The idea behind this tab: most voters are locked in, and elections are decided by a small slice that moves. "
             "Here each party’s **base** is the lowest share of the two-party vote it has posted in a competitive statewide race since 2016; everything in between is the **swing slice**. "
             "Persuasion moves the slice; turnout moves the bases. The research mostly backs stable bases — about 95% of partisans stay loyal — but finds the deciding minority is as often "
             "people changing **whether** they vote as **how** they vote, so the lab gives you both levers.")

DATA = dict(
    meta=dict(asOf="2026-10-11", election="2026-11-03", disclaimer=""),
    defaultLens=DEFAULT_LENS, lenses=LENSES, races=races, polls=polls, senateBase=dict(D=34, R=31), house=house, national=national,
    senateNote="Twelve races are competitive: Republicans defend open seats in North Carolina, Iowa and Texas (where Ken Paxton ousted Sen. John Cornyn in a May runoff) and incumbents in Maine, Ohio, Alaska, Nebraska and Kansas; Democrats defend Georgia and open seats in Michigan, New Hampshire and Minnesota.",
    senateHungNote="Control would turn on Nebraska independent Dan Osborn’s choice of caucus",
    ohio=dict(govId="OH-GOV", senId="OH-SP", intro=OHIO_INTRO, govFacts=OP.ohio_gov_facts(), history=OP.ohio_history(B["races"]), counties=OP.ohio_counties(),
              house=OP.ohio_house(), logistics=OP.ohio_logistics(), other=OP.ohio_other(), issues=OP.ohio_issues(), houseNote=OHIO_HOUSE_NOTE),
    lab=dict(contexts=build_lab(races, NATIONAL_REFS), defaultCtx="OH-GOV", intro=LAB_INTRO),
    history=dict(backtest=dict(n_races=B["n_races"], n_polls=B["n_polls"], resid_by_polls=B["resid_by_polls"], call_accuracy=B["call_accuracy"]),
                 cycleBiasCompetitive=[dict(cycle=c["cycle"], bias=c["bias"], n=c["n"], src="538 poll file, this model’s average") for c in B["cycles_competitive"]] + ([dict(cycle=2024, bias=comp24, n=9, src="RCP final averages, 2024 Senate races")] if HIS else []),
                 genericErrors=[dict(cycle=g["cycle"], avg=g["avg"], actual=g["actual"], err=g["err"], src="538 poll file, this model’s average") for g in B["generic"]] + ([dict(cycle=2024, avg=-0.3, actual=-2.56, err=gen24, src="RCP final average vs. House popular vote")] if HIS else []),
                 swingEvidence=HH.SWING if HIS else [], midterms=HH.MIDTERMS if HIS else [], midtermNote=HH.MIDTERM_NOTE if HIS else "",
                 octMoves=HH.OCT_MOVES if HIS else [], octNote=HH.OCT_NOTE if HIS else "", biasCaveats=HH.BIAS_CAVEATS if HIS else []),
    method=dict(steps=[dict(t=t, d=d) for t, d in METHOD_STEPS], limits=LIMITS, facts=[
        dict(v="70.6%", k="of 1998–2022 Senate and governor results landed within **±1σ** of the error model (target 68%)."),
        dict(v="95.1%", k="landed within **±2σ** (target 95%)."),
        dict(v="±3.1", k="points: the cycle-to-cycle spread of the shared miss in Senate and governor polls (±2.3 in midterms alone)."),
        dict(v="0.15", k="points: the **average** midterm miss in competitive races since 1998 (polls overstated Democrats slightly) — tiny on average, large in any single year."),
        dict(v="2.9 / 3.6", k="points: how far Democratic- and Republican-sponsored polls ran toward their sponsor versus independent polls of the same race."),
        dict(v="6.2 → 4.8", k="points of error in well-polled races, three-to-eight weeks out versus the final three weeks — why the forecast widens early."),
    ]),
    scenarios=SCENARIOS, calendar=sorted(FIXED_CALENDAR + OP.OHIO_CAL + NP.NAT_CAL, key=lambda c: c["date"]), sources=[dict(group=g, label=l, url=u) for g, l, u in (SPT.SOURCES if SEN else []) + (HP.SOURCES if HOU else []) + NP.SOURCES + OHIO_SOURCES + (HH.SOURCES if HIS else [])], narrative=dict(lede=NP.LEDE),
    baseline=(json.load(open(SP + "probe.json"))["snap"] if os.path.exists(SP + "probe.json") else dict(d="2026-10-11", sR=0.5, hD=0.5, gov=0.5, gb=0)),
)

if __name__ == "__main__":
    out = "const DATA = " + json.dumps(DATA, ensure_ascii=False, separators=(",", ":")) + ";"
    open(SP + "data.js", "w").write(out)
    print("wrote data.js", len(out))
