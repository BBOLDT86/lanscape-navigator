import os
"""Senate structures from senate.json (+ 270toWin listing dates for undated polls)."""
import json, re, html, datetime as dt
SP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "")
S = json.load(open(SP + "data/senate.json"))
un = lambda s: html.unescape(s) if isinstance(s, str) else s

# 270toWin listing dates (release dates) for polls the research could not date. end ≈ listing − 2 days.
LISTED = {
    "TX": [("Siena", 51, 45, "2026-10-03"), ("Fox", 51, 49, "2026-10-01"), ("Texas Public Opinion", 49, 44, "2026-09-25"), ("Texas Southern", 47, 46, "2026-09-22"),
           ("Emerson", 47, 46, "2026-09-17"), ("ReconMR", 49, 43, "2026-09-17"), ("Mason-Dixon", 46, 43, "2026-09-15"), ("InsiderAdvantage", 47, 46, "2026-09-10"),
           ("AARP", 48, 44, "2026-09-10"), ("Univision", 48, 43, "2026-09-09"), ("Overton", 44, 43, "2026-09-02"), ("Texas Public Opinion", 48, 42, "2026-08-27"),
           ("University of Texas", 42, 39, "2026-08-25"), ("Emerson", 46, 47, "2026-08-13"), ("Texas Pulse", 47, 43, "2026-08-07"), ("Texas Southern", 47, 45, "2026-08-04")],
    "IA": [("Emerson", 45, 47, "2026-10-09"), ("Siena", 47, 48, "2026-10-03"), ("Quantus", 47, 49, "2026-09-30"), ("InsiderAdvantage", 47, 46, "2026-09-26"),
           ("Cygnal", 43, 43, "2026-09-15"), ("Emerson", 45, 50, "2026-09-03"), ("Wedgewood", 48, 50, "2026-08-30"), ("Suffolk", 41, 45, "2026-08-26"), ("Emerson", 45, 48, "2026-08-06")],
    "AK": [("Siena", 50, 43, "2026-10-03"), ("Alaska Survey", 48, 44, "2026-09-22"), ("AARP", 46, 41, "2026-09-17"), ("Change Research", 47, 41, "2026-08-17")],
    "GA": [("Wedgewood", 55, 45, "2026-10-04"), ("InsiderAdvantage", 50, 42, "2026-09-25"), ("Quantus", 49, 45, "2026-09-18")],
    "KS": [("Siena", 45, 45, "2026-10-03"), ("Wedgewood", 50, 48, "2026-09-24"), ("Emerson", 45, 43, "2026-09-18")],
    "ME": [("Maine People", 49, 47, "2026-10-05"), ("InsiderAdvantage", 46, 46, "2026-09-26")],
    "NH": [("New Hampshire", 50, 42, "2026-09-24"), ("Siena", 50, 45, "2026-09-24")],
    "MN": [("SurveyUSA", 42, 42, "2026-09-16"), ("Quantus", 48, 44, "2026-09-11")],
}
EXACT = {("OH", "Siena", 49, 46): ("2026-09-22", "2026-10-01"), ("OH", "Suffolk", 47, 44): ("2026-09-23", "2026-09-27")}  # same field periods as the Ohio governor questions
LISTED_URL = "https://www.270towin.com/2026-senate-polls/{}"
STATE_SLUG = {"TX": "texas", "IA": "iowa", "AK": "alaska", "GA": "georgia", "KS": "kansas", "ME": "maine", "OH": "ohio", "NH": "new-hampshire", "MN": "minnesota"}
ID = lambda st_: st_ + ("-SP" if st_ in ("OH", "FL") else "-S")


def shift(iso, d):
    return (dt.date.fromisoformat(iso) + dt.timedelta(days=d)).isoformat()


def side_of(p):
    t = (p.get("pollster") or "") + " " + (p.get("sponsor") or "")
    if not p.get("partisan"): return ""
    if re.search(r"\(R\)|conservative|Republican|NRSC|Senate Leadership", t): return "R"
    if re.search(r"\(D\)|progressive|Democrat|Senate Majority|DSCC|Data for Progress", t): return "D"
    return ""


def polls():
    out, undated = [], 0
    for i, p in enumerate(S["polls"]):
        st_ = p["race"]
        start, end, approx = p.get("start"), p.get("end"), False
        if not end or "not" in str(end):
            hit = None
            for (s2, name, d, r), (a, b) in EXACT.items():
                if s2 == st_ and name.lower() in p["pollster"].lower() and d == p["dem"] and r == p["rep"]: hit = (a, b)
            if not hit:
                for name, d, r, listed in LISTED.get(st_, []):
                    if name.lower() in p["pollster"].lower() and abs(d - p["dem"]) < 1.01 and abs(r - p["rep"]) < 1.01:
                        hit = (shift(listed, -5), shift(listed, -2)); approx = True; break
            if not hit:
                undated += 1; continue
            start, end = hit
        if not start or "not" in str(start): start = shift(end, -3)
        url = p.get("url")
        for (s2, name, e2), u2 in URL_FIX.items():
            if s2 == st_ and name.lower() in p["pollster"].lower() and e2 == end: url = u2
        out.append(dict(id=f"s{i}", race=ID(st_), pollster=un(p["pollster"]), sponsor=un(p.get("sponsor") or ""), partisan=side_of(p), start=start, end=end,
                        n=p.get("n"), pop=p.get("pop") or "", dem=p["dem"], rep=p["rep"], oth=p.get("oth"), url=url, approxDate=approx))
    return out, undated


MSG = {
    "NC": ("Affordability — a “Make Stuff Cost Less” tour; says Whatley serves “billionaires and special interests.”",
           "Casts Cooper as “a card-carrying member of the radical extreme Democrats” and a “career politician.”"),
    "ME": ("Cost of living and abortion rights; calls Collins’s alleged steering of funds to a donor-linked contractor (reported by ProPublica) “corruption of the highest order.”",
           "Collins stresses the federal money she has delivered as Appropriations chair and her record of working across party lines; calls the ProPublica allegations “categorically false.”"),
    "OH": ("No campaign-stated closing line found. Brown’s coalition is anchored in labor (Ohio AFL-CIO, UAW, USW); the Ohio Patrolmen’s Benevolent Association endorsed him.",
           "No campaign-stated closing line found. Husted is endorsed by Trump; an AFP Action ad frames Brown’s “refusal to stand up to his party.”"),
    "GA": ("No campaign-stated closing line found. A coverage headline: Ossoff “vows defiance to Trump.”",
           "No campaign-stated closing line found. A coverage headline: Collins sought to “seize MAGA lane” after Trump’s endorsement."),
    "MI": ("No campaign-stated closing line found. El-Sayed runs on Medicare for All and opposes further aid to Israel (Newsweek).",
           "No campaign-stated closing line found. Republicans argue El-Sayed’s left-wing positions alienate moderates."),
    "AK": ("Peltola calls herself “an independent voice who will stand up to anyone — including her own party,” runs on cost of living, and says Sullivan voted “fourteen times for the war in Iran.”",
           "The NRSC says “Peltola puts Alaska last and her Lower 48 donors first”; pro-Sullivan super PAC ads attack Peltola over staffer allegations."),
    "KS": ("No campaign-stated closing line found. Hamilton, a pastor who founded the Church of the Resurrection, is endorsed by former governors Kathleen Sebelius (D) and Bill Graves (R).",
           "No campaign-stated closing line found. The NRSC’s national line: Democrats are “radical, socialist” rubber stamps for Chuck Schumer."),
}
NOTE = {
    "NC": "Open seat (Tillis retiring). Senate Leadership Fund spent about $30M of a planned $71M here, then redirected money to Iowa and Texas; Senate Majority PAC canceled its North Carolina buys the week of Oct 5. North Carolina early voting runs Oct 15–31.",
    "ME": "Graham Platner won the June 9 Democratic primary, then withdrew in July; a July 25 convention chose Jackson. Obama endorsed Jackson around Oct 9. Maine uses ranked-choice voting.",
    "OH": "Special election for the seat JD Vance vacated; Husted was appointed in 2025. As of June 30, Brown had raised $38.6M to Husted’s $14.4M. Also on the ballot: Bill Redpath (L) and Greg Levy (I).",
    "GA": "Collins won the June 16 Republican runoff over Derek Dooley, 55.5–44.5, after Trump endorsed him. Georgia holds a Dec 1 runoff if no one wins a majority.",
    "MI": "Open seat (Peters retiring). El-Sayed’s ties to streamer Hasan Piker have drawn controversy. Four minor-party candidates are also on the ballot.",
    "NH": "Open seat (Shaheen retiring). Sununu won the Sept 8 Republican primary. Cook moved the race from Toss-up to Lean D between Sept 23 and Oct 6.",
    "IA": "Open seat (Ernst retiring). Senate Leadership Fund is redirecting North Carolina money to Iowa.",
    "TX": "Ken Paxton ousted Sen. John Cornyn in the May 26 runoff, 63.8–36.2; Talarico beat Jasmine Crockett for the Democratic nomination. AdImpact projects $446M in ad spending — the most expensive race of the cycle.",
    "AK": "Ranked-choice general election with four candidates (including a second Dan Sullivan). Sabato moved the race to Lean D on Oct 6.",
    "NE": "No Democrat on the ballot: the Democratic nominee withdrew July 17 and the party endorsed independent Dan Osborn. Osborn’s caucus choice would matter if the chamber is close.",
    "MN": "Open seat (Smith retiring). Flanagan beat Rep. Angie Craig in the Aug 11 primary, 59.0–39.4; Tafoya won the Republican primary with 52.1%.",
    "KS": "Cook moved the race to Toss-up on Oct 6; Senate Majority PAC says it is “watching really closely.”",
}
DEBATES = {
    "ME": [dict(date="2026-10-06", desc="Debate (held)"), dict(date="2026-10-08", desc="Debate (held)"), dict(date="2026-10-13", desc="Debate"), dict(date="2026-10-15", desc="Debate")],
    "GA": [dict(date="2026-10-08", desc="Atlanta News First debate (held)")],
    "NE": [dict(date="2026-09-01", desc="News Channel Nebraska debate at the State Fair (held)")],
    "KS": [dict(date="2026-09-12", desc="WIBW/Kansas Radio Networks debate (held)")],
}
# candidate record: half of the last statewide over-performance vs the same-year presidential margin
CAND = {
    "NC": (2.9, "Cooper won the 2020 governor’s race by 4.5 while Trump carried the state by 1.3 — a 5.8-point over-performance, half-credited (**+2.9**)."),
    "ME": (-8.8, "Collins won in 2020 by 8.6 while Biden carried Maine by 9.1 — a 17.7-point over-performance, half-credited (**R +8.8**); no separate incumbency bonus is added."),
    "OH": (3.8, "Brown lost in 2024 by 3.6 while Trump carried Ohio by 11.2 — a 7.6-point over-performance, half-credited (**+3.8**)."),
    "AK": (5.4, "Peltola lost the 2024 House race by 2.4 in the final ranked-choice round (51.2–48.8) while Trump carried Alaska by 13.1 — a 10.7-point over-performance, half-credited (**+5.4**)."),
}
INC = {"GA": 2.5, "OH": -1.0, "AK": -2.5, "NE": -2.5, "KS": -2.5}   # ME: none — Collins’s own over-performance is credited instead (CAND)
PRIOR = {"OH": "2022: JD Vance (R) 53.0%, won by 6.1; Husted appointed 2025"}   # exact 2022 result from the Ohio history table
URL_FIX = {("NC", "Harper", "2026-08-10"): "https://en.wikipedia.org/wiki/2026_United_States_Senate_election_in_North_Carolina"}  # research reused the Sept toplines PDF for the Aug poll
ELAST = {"NE": 0.8, "AK": 0.9, "ME": 0.9}


def races_info():
    out = {}
    for r in S["races"]:
        st_ = r["race"]
        avg = r.get("avg") or {}
        m = re.search(r"\(([DR])\+([\d.]+)\)", avg.get("value", ""))
        ext = []
        if m:
            v = float(m.group(2)); lead = r["dem_cand"].split(" (")[0].split()[-1] if m.group(1) == "D" else r["rep_cand"].split()[-1]
            if st_ == "NE" and m.group(1) == "D": lead = "Osborn"
            ext.append(dict(src="FiftyPlusOne", val=f"{lead} +{v:.1f}", date="2026-10-11", url="https://www.fiftyplusone.news/averages"))
        d, rr = MSG.get(st_, ("No campaign closing message found in the sources gathered.", "No campaign closing message found in the sources gathered."))
        out[st_] = dict(dem=un(r["dem_cand"]).replace(" (I) - in dem slot; no Democrat on ballot", ""), rep=un(r["rep_cand"]).replace("Dan S. Sullivan", "Dan Sullivan"),
                        others=un(r.get("ind_cand")) if r.get("ind_cand") and "none" not in r.get("ind_cand") else None,
                        ratings=dict(cook=r.get("cook"), sabato=r.get("sabato"), ie=r.get("ie")), pres24=r.get("pres2024_margin"), prior=PRIOR.get(st_) or un(r.get("prior_result")),
                        msgD=d, msgR=rr, notes=NOTE.get(st_), debates=DEBATES.get(st_, []), ext=ext, incAdv=INC.get(st_, 0.0),
                        cand=CAND.get(st_, (0, None))[0], candNote=CAND.get(st_, (0, None))[1], elast=ELAST.get(st_, 1.0), dSideInd=(st_ == "NE"),
                        open=bool(r.get("open")))
    return out


SOURCES = [
    ("U.S. Senate", "270toWin — Senate polls by state", "https://www.270towin.com/2026-senate-polls/"),
    ("U.S. Senate", "uspollingdata / VoteHub — Senate races", "https://uspollingdata.com/races/"),
    ("U.S. Senate", "FiftyPlusOne — polling averages", "https://www.fiftyplusone.news/averages"),
    ("U.S. Senate", "Cook Political Report — Senate ratings", "https://www.cookpolitical.com/ratings/senate-race-ratings"),
    ("U.S. Senate", "Inside Elections — ratings feed", "https://insideelections.com/wp-content/themes/inside-elections/cache/ratings_latest_senate_year=2026_district=all_clean.json?v=1790878981"),
    ("U.S. Senate", "Wikipedia — 2026 Senate elections (ratings index)", "https://en.wikipedia.org/wiki/2026_United_States_Senate_elections"),
    ("U.S. Senate", "FEC — 2024 presidential results", "https://www.fec.gov/resources/cms-content/documents/2024presgeresults.pdf"),
    ("U.S. Senate", "WRAL — North Carolina ad spending (Oct 8)", "https://www.wral.com/news/nccapitol/whatley-campaign-retreat-airwaves-senate-poll-october-8/"),
    ("U.S. Senate", "Newsweek — Maine Senate polls", "https://www.newsweek.com/what-maine-senate-race-polls-show-as-obama-gives-jackson-late-boost-12547315"),
    ("U.S. Senate", "Newsweek — Alaska Senate polls", "https://www.newsweek.com/alaska-polls-democrats-senate-dan-sullivan-mary-peltola-12529985"),
    ("U.S. Senate", "HPPR — Kansas Senate race", "https://www.hppr.org/hppr-news/2026-10-08/top-democratic-u-s-senate-pac-is-watching-kansas-race-really-closely-as-it-disburses-funding"),
    ("U.S. Senate", "Wikipedia — 2024 House election in Alaska (Peltola’s 2024 result)", "https://en.wikipedia.org/wiki/2024_United_States_House_of_Representatives_election_in_Alaska"),
    ("U.S. Senate", "Wikipedia — 2026 Senate election in North Carolina (polling table)", "https://en.wikipedia.org/wiki/2026_United_States_Senate_election_in_North_Carolina"),
]
