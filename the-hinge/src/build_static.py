import os
"""Static / backtest-derived pieces of the dashboard data."""
import json, statistics as st

SP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "")
B = json.load(open(SP + "data/backtest.json"))
R538 = json.load(open(SP + "data/results_538.json"))

# ---------------------------------------------------------------- 2024 national (filled from research later)
NAT_PRES24 = -1.5   # Trump +1.5 national popular vote

# ---------------------------------------------------------------- approximate 2024 presidential margins (D-R) for states
# Sourced values from the research agents override these; these are used only for states the agents did not cover.
PRES24_APPROX = {
    "AL": -30.5, "AK": -13.1, "AR": -30.6, "CO": 11.0, "DE": 14.8, "GA": -2.2, "ID": -36.5, "IL": 10.9, "IA": -13.2,
    "KS": -16.2, "KY": -30.6, "LA": -22.0, "ME": 6.9, "MA": 25.2, "MI": -1.4, "MN": 4.2, "MS": -22.9, "MT": -19.9,
    "NE": -20.4, "NH": 2.8, "NJ": 5.9, "NM": 6.0, "NC": -3.2, "OH": -11.2, "OK": -34.3, "OR": 14.3, "RI": 13.7,
    "SC": -17.8, "SD": -29.2, "TN": -29.7, "TX": -13.7, "VA": 5.8, "WV": -41.9, "WY": -45.8, "FL": -13.1,
}
STATE_NAMES = {"AL": "Alabama", "AK": "Alaska", "AR": "Arkansas", "CO": "Colorado", "DE": "Delaware", "GA": "Georgia", "ID": "Idaho",
               "IL": "Illinois", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MA": "Massachusetts",
               "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MT": "Montana", "NE": "Nebraska", "NH": "New Hampshire",
               "NJ": "New Jersey", "NM": "New Mexico", "NC": "North Carolina", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon",
               "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "VA": "Virginia",
               "WV": "West Virginia", "WY": "Wyoming", "FL": "Florida", "PA": "Pennsylvania", "WI": "Wisconsin", "AZ": "Arizona",
               "NV": "Nevada", "NY": "New York", "CA": "California", "WA": "Washington", "IN": "Indiana", "MO": "Missouri",
               "MD": "Maryland", "CT": "Connecticut", "VT": "Vermont", "UT": "Utah", "ND": "North Dakota", "HI": "Hawaii", "TN": "Tennessee"}
REGION = {}
for s in "OH MI MN IA WI PA IL IN MO".split(): REGION[s] = "Midwest"
for s in "NC GA TX FL SC AL MS LA KY TN AR VA WV OK".split(): REGION[s] = "South"
for s in "ME NH MA RI NJ DE NY VT CT MD".split(): REGION[s] = "Northeast"
for s in "AK CO NM OR MT ID WY AZ NV CA WA UT HI".split(): REGION[s] = "West"
for s in "NE KS SD ND".split(): REGION[s] = "Plains"

# The 35 Senate contests of 2026 (33 class-2 seats + OH and FL specials) — incumbents as of the 2024 election cycle
SENATE_SEATS = [
    # state, held, incumbent (2025), special
    ("AL", "R", "Tommy Tuberville", False), ("AK", "R", "Dan Sullivan", False), ("AR", "R", "Tom Cotton", False),
    ("CO", "D", "John Hickenlooper", False), ("DE", "D", "Chris Coons", False), ("FL", "R", "Ashley Moody", True),
    ("GA", "D", "Jon Ossoff", False), ("ID", "R", "Jim Risch", False), ("IL", "D", "Dick Durbin", False),
    ("IA", "R", "Joni Ernst", False), ("KS", "R", "Roger Marshall", False), ("KY", "R", "Mitch McConnell", False),
    ("LA", "R", "Bill Cassidy", False), ("ME", "R", "Susan Collins", False), ("MA", "D", "Ed Markey", False),
    ("MI", "D", "Gary Peters", False), ("MN", "D", "Tina Smith", False), ("MS", "R", "Cindy Hyde-Smith", False),
    ("MT", "R", "Steve Daines", False), ("NE", "R", "Pete Ricketts", False), ("NH", "D", "Jeanne Shaheen", False),
    ("NJ", "D", "Cory Booker", False), ("NM", "D", "Ben Ray Luján", False), ("NC", "R", "Thom Tillis", False),
    ("OH", "R", "Jon Husted", True), ("OK", "R", "Markwayne Mullin", False), ("OR", "D", "Jeff Merkley", False),
    ("RI", "D", "Jack Reed", False), ("SC", "R", "Lindsey Graham", False), ("SD", "R", "Mike Rounds", False),
    ("TN", "R", "Bill Hagerty", False), ("TX", "R", "John Cornyn", False), ("VA", "D", "Mark Warner", False),
    ("WV", "R", "Shelley Moore Capito", False), ("WY", "R", "Cynthia Lummis", False),
]

# ---------------------------------------------------------------- lenses (filled with 2024 later)
comp = {c["cycle"]: c["bias"] for c in B["cycles_competitive"]}
gen = {g["cycle"]: g["err"] for g in B["generic"]}


def lenses(comp24=None, gen24=None):
    c = dict(comp); g = dict(gen)
    if comp24 is not None: c[2024] = comp24
    if gen24 is not None: g[2024] = gen24
    mean = lambda d, ys: round(st.mean([d[y] for y in ys if y in d]), 2)
    mids_recent = [2010, 2014, 2018, 2022]
    mids_all = [1998, 2002, 2006, 2010, 2014, 2018, 2022]
    trump = [2016, 2018, 2020, 2022, 2024]
    allc = sorted(set(c) | set(g))
    L = {
        "recentMidterms": {"label": "Recent midterms", "state": mean(c, mids_recent), "gb": mean(g, mids_recent),
                            "note": "Average miss in the 2010, 2014, 2018 and 2022 midterms. Default: 2026 is a midterm, and these are the four most recent ones."},
        "none": {"label": "Trust the polls", "state": 0.0, "gb": 0.0, "note": "No historical correction — the bias in any one cycle has not been predictable from the last."},
        "midterms": {"label": "All midterms since 1998", "state": mean(c, mids_all), "gb": mean(g, mids_all),
                     "note": "Seven midterms. Statewide polls have been nearly unbiased on average in midterms; the generic ballot has tended to overstate Democrats."},
        "trumpEra": {"label": "Trump era", "state": mean(c, trump), "gb": mean(g, trump),
                     "note": "2016–2024, which includes the two largest misses toward Democrats in the record (2020 and 2016) — a stress test."},
        "allCycles": {"label": "Every cycle", "state": mean(c, [y for y in allc if y in c]), "gb": mean(g, [y for y in allc if y in g]),
                      "note": "All cycles in the record, midterm and presidential."},
    }
    return L, c, g


def state_bias(extra_2024):
    """Recent-era (2014+) residual polling error by state, after removing each cycle's national mean; shrunk."""
    races = [r for r in B["races"]]
    # use the full race table from the backtest for all states (B['races'] is limited to key states) — fine for our purposes
    rows = [dict(state=r["state"], cycle=r["cycle"], err=r["err"]) for r in races if r["cycle"] >= 2014]
    rows += [dict(state=r["state"], cycle=2024, err=r["err"]) for r in extra_2024]
    by_cycle = {}
    for r in rows: by_cycle.setdefault(r["cycle"], []).append(r["err"])
    cyc_mean = {k: st.mean(v) for k, v in by_cycle.items()}
    out = {}
    k = 6.3
    for s in sorted(set(r["state"] for r in rows)):
        res = [r["err"] - cyc_mean[r["cycle"]] for r in rows if r["state"] == s]
        n = len(res); raw = st.mean(res)
        out[s] = dict(raw=round(raw, 2), n=n, shrunk=round(raw * n / (n + k), 2))
    return out, {c: round(v, 2) for c, v in cyc_mean.items()}


METHOD_STEPS = [
    ("Collect", "Every public general-election poll found for each race (sources linked row by row). Polls paid for by a party, campaign or allied group are flagged as partisan."),
    ("Average", "Each poll is weighted by recency (a 14-day time constant, so weight halves about every 10 days) and by the square root of its sample size. Partisan-sponsored polls are shifted **3 points** toward the other side — about the lean we measured for sponsored polls. On 669 Senate and governor races these choices beat a plain mean only slightly (RMSE 6.12 vs 6.14 points): **how you average matters far less than the miss every poll shares**."),
    ("Correct for history", "The selected bias lens subtracts an average past miss from statewide polls and from the generic ballot (default: the 2010–2022 midterms). Each state’s own record since 2014 is added on top, shrunk toward zero so a few races can’t dominate."),
    ("Blend with fundamentals", "A prior built from 0.8 × the state’s 2024 presidential lean, the corrected national environment, incumbency (±2.5 for elected incumbents, ±1 appointed) and half of a candidate’s past over-performance (an incumbent whose own over-performance is credited — Susan Collins — gets no separate incumbency bonus). It is precision-weighted against the polls; once a race has a few polls, polls carry roughly 85–95% of the weight (the backtest’s optimum was 93–99%)."),
    ("Size the uncertainty", "Race error shrinks with the number of polls (about ±7.4 points with one poll, ±4.3 with ten) and grows with the days left before the election and the age of the polls. On top sit a **shared national error (±3.0)**, which moves every race together, and a regional error (±1.5)."),
    ("Simulate", "10,000 elections. Each draw applies one national error to every race, one error per region, and an independent error per race, then counts seats. Republicans keep the Senate at 50 seats (the vice president breaks ties); Democrats need 51. The House majority is 218."),
    ("House", "All 435 seats: safe seats are counted directly; every battlefield district’s expected margin blends the forecasters’ ratings (Lean ≈ ±5, Likely ≈ ±10) with a partisan-lean model (2 × Cook PVI + the national environment + 3 points of incumbency), moving with the same national error as the Senate."),
    ("Election night", "Mark races as called on the Tracker or in a race’s detail panel; the model keeps only the simulations consistent with those calls, so the remaining races update the way correlated results would."),
]
LIMITS = [
    "A shared polling miss larger than any in the record is possible — 2020’s competitive-race miss was about **6 points**.",
    "The House model leans on forecaster ratings and partisan lean; there are few public district polls.",
    "Independent and ranked-choice contests (Nebraska, Maine, Alaska) are modelled as two-way races between the leading two candidates.",
    "Turnout and enthusiasm enter only through the Swing Lab, not the forecast itself.",
    "Fundamentals were calibrated without candidate-quality data, so the prior is deliberately weak.",
    "Data were gathered on **October 11, 2026**. New polls must be added on the Tracker tab; nothing updates on its own.",
]

FIXED_CALENDAR = [
    {"date": "2026-10-13", "label": "Maine Senate debate (Jackson–Collins)"},
    {"date": "2026-10-15", "label": "Maine Senate debate; North Carolina early voting opens (through Oct 31)"},
    {"date": "2026-11-01", "label": "Clocks fall back; Ohio’s early in-person voting ends (1–5 p.m.)"},
    {"date": "2026-11-03", "label": "**Election Day** — polls begin closing at 6 p.m. local time in Indiana and Kentucky; Georgia, the first competitive Senate race, closes at 7 p.m. ET", "note": "Ohio and North Carolina 7:30 p.m. ET; Maine, New Hampshire, most of Michigan, most of Texas and most of Kansas 8 p.m. ET; Iowa, Minnesota and most of Nebraska 9 p.m. ET; most of Alaska midnight ET. Ranked-choice tabulation in Maine and Alaska can take days; Georgia holds a Dec 1 runoff if no Senate candidate wins a majority. Check official sources for local rules."},
]
