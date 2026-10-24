import os
"""Turn the Ohio research JSON into dashboard structures."""
import json, html
SP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "")
O = json.load(open(SP + "data/ohio.json"))
un = lambda s: html.unescape(s) if isinstance(s, str) else s


def norm_district(code):
    import re
    m = re.match(r"([A-Z]{2})[- ]?0*(\d+|AL)", str(code).strip().upper())
    if not m: return str(code)
    st, n = m.group(1), m.group(2)
    return f"{st}-AL" if n == "AL" else f"{st}-{int(n):02d}"


def ohio_gov_polls():
    out = []
    for i, p in enumerate(O["gov_polls"]):
        lab = p.get("partisan_label")
        part = ""
        if p.get("partisan_sponsor") is True and lab in ("D", "R"): part = lab
        elif lab in ("D", "R"): part = lab   # Wikipedia-style (D)/(R) pollster or sponsor label
        out.append(dict(id=f"ohg{i}", race="OH-GOV", pollster=un(p["pollster"]), sponsor=un(p.get("sponsor") or ""), partisan=part,
                        start=p["start"], end=p["end"], n=p.get("n"), pop=p.get("population") or "", dem=p["dem_acton"], rep=p["rep_ramaswamy"],
                        oth=p.get("other_pct"), url=p.get("url"), note=un(p.get("notes") or "")))
    return out


def ohio_gov_race():
    g = O["gov_race"]
    rat = {r["source"]: r["rating"] for r in g["ratings"]}
    ext = [dict(src=a["source"], val=("Acton +%.1f" % a["margin_d_minus_r"]) if a["margin_d_minus_r"] and a["margin_d_minus_r"] > 0 else ("Ramaswamy +%.1f" % -a["margin_d_minus_r"] if a["margin_d_minus_r"] else "—"),
                date="2026-10-06", url=a["url"]) for a in g["avg"] if a.get("margin_d_minus_r") is not None]
    md, mr = g["msg_dem"], g["msg_rep"]
    return dict(
        id="OH-GOV", office="Governor", state="OH", name="Ohio", special=False,
        dem="Amy Acton", rep="Vivek Ramaswamy", dSideInd=False, held="R", incParty=None, incumbent=None, open=True, incAdv=0,
        pres24=-11.2, region="Midwest", elast=1.0, tier=1,
        ratings=dict(cook="Toss-up", sabato="Toss-up", ie="Toss-up"),
        others="Don Kissick (Libertarian); four write-in tickets",
        prior="DeWine (R) won 2022 by 25.0 (open seat — DeWine term-limited)",
        ext=ext,
        msgD=md["core"] + " " + md["attacks"], msgR=mr["core"] + " " + mr["attacks"],
        notes="No governor debate: Acton declined invitations in early September; Ramaswamy accepted several. Pro-Ramaswamy groups were outspending the Acton side on ads by more than 3-to-1 in early October (NYT). Reports filed Oct 5: Acton raised $6.07M for the period with $24.1M on hand; Ramaswamy raised $3.06M with $45.8M on hand (single secondary source).",
        debates=[],
        sources=[dict(label="Wikipedia: 2026 Ohio gubernatorial election", url="https://en.wikipedia.org/wiki/2026_Ohio_gubernatorial_election"),
                 dict(label="RealClearPolling", url="https://www.realclearpolling.com/polls/governor/general/2026/ohio/ramaswamy-vs-acton"),
                 dict(label="WGCU/NPR on the campaign", url="https://www.wgcu.org/2026-09-27/ohio-governors-race-ramaswamy-and-acton-clash-in-rare-democratic-pickup-opportunity"),
                 dict(label="Boston Globe/NYT on the campaign", url="https://www.bostonglobe.com/2026/10/05/nation/ohio-governor-campaign-ugly-race/")],
    )


def ohio_gov_facts():
    return [
        dict(k="Running mates", v="David Pepper (D) · Rob McColley (R)", url="https://news.ballotpedia.org/?p=51296"),
        dict(k="Also on the ballot", v="Don Kissick (L) + four write-in tickets", url="https://www.vote.franklincountyohio.gov/getmedia/92039866-8eae-4fdc-a638-66ac8631bc70/2026-General-Candidate-List-4"),
        dict(k="Ratings", v="Toss-up at Cook (since July), Sabato (Sept 22), Inside Elections (Oct 1)", url="https://www.270towin.com/2026-governor-election/inside-elections-governor-2026"),
        dict(k="Money (Oct 5 reports)", v="Acton $6.1M raised / $24.1M cash · Ramaswamy $3.1M / $45.8M", url="https://ohiocpa.com/for-the-public/news/2026/10/09/week-in-review--oct.-11--2026"),
        dict(k="Air war", v="Pro-Ramaswamy side out-advertising pro-Acton side by 3-to-1+", url="https://www.bostonglobe.com/2026/10/05/nation/ohio-governor-campaign-ugly-race/"),
        dict(k="Debates", v="None — Acton declined (Sept 2–3)", url="https://www.news5cleveland.com/news/politics/ohio-politics/acton-refuses-to-engage-with-ramaswamy-as-ohio-debates-decline"),
        dict(k="Key endorsements", v="Ramaswamy: Trump, Vance, DeWine, Ohio Chamber of Commerce, several building-trades and Teamsters unions · Acton: Brown, Ohio AFL-CIO, Ohio Education Association, a law-enforcement union, Jim Petro (R)", url="https://en.wikipedia.org/wiki/2026_Ohio_gubernatorial_election"),
    ]


def ohio_history(backtest_races):
    rows = []
    for r in backtest_races:
        if r["state"] != "OH": continue
        rows.append(dict(year=r["cycle"], label=f"{r['cycle']} {r['office'][:3] if r['office'] != 'President' else 'Pres'} · {r['d'].split()[-1]} v {r['r'].split()[-1]}",
                         avg=round(r["avg"], 1), actual=round(r["actual"], 2), src="538 poll file, model average"))
    for h in O["ohio_history"]:
        if h["year"] != 2024: continue
        vals = [v for v in (h.get("rcp_final_margin"), h.get("fte_final_margin")) if v is not None]
        if not vals: continue
        short = "Pres · Harris v Trump" if "President" in h["race"] else "Sen · Brown v Moreno"
        rows.append(dict(year=2024, label=f"2024 {short}", avg=round(sum(vals) / len(vals), 1), actual=h["actual_margin"], src="RCP/538 final averages"))
    rows.sort(key=lambda x: (x["year"], x["label"]))
    for r in rows:
        r["label"] = r["label"].replace("Gov ·", "Gov ·").replace("Sen ·", "Sen ·")
    return rows


def ohio_counties():
    out = []
    for c in O["counties"]:
        d = dict(c)
        if d["county"].upper() == "STATEWIDE": d["county"] = "Statewide"
        out.append(d)
    return out


def ohio_house():
    out = []
    for h in O["house_oh"]:
        r = h["ratings"]
        import build_house_part as _HP
        clean = lambda s: _HP.rating(s) or ""
        pm = h["pres24_new_lines"]["margin_d_minus_r"]
        lean = (f"2024 pres {'Harris' if pm > 0 else 'Trump'} +{abs(pm)} · Cook PVI {h.get('cook_pvi_2026')}")
        note = h.get("developments") or ""
        if h.get("polls"):
            p = h["polls"][-1]
            lab = str(p.get("partisan_label") or "")[:1]
            note = (note + " " if note else "") + f"Latest public poll: {un(p['pollster'])}{' (' + lab + '-aligned)' if lab in ('D', 'R') else ''}, {p['dem']}–{p['rep']}."
        out.append(dict(district=norm_district(h["district"]),
                        dem=h["dem"], rep=h["rep"], incumbent=h["incumbent"], cook=clean(r.get("cook")), sabato=clean(r.get("sabato")), ie=clean(r.get("ie")),
                        lean=lean, note=note.strip(), pres24=pm, pvi=h.get("cook_pvi_2026"), polls=h.get("polls", []), area=h.get("area")))
    return out


def ohio_logistics():
    return [
        dict(k="Registration deadline", v="Oct 5 (closed)", url="https://www.ohiosos.gov/office/media-center/categories/press-releases/2026-10-05"),
        dict(k="Early in-person voting", v="Oct 6 – Nov 1 at county boards", url="https://www.ohiosos.gov/elections/voting-schedule-text-only"),
        dict(k="Extended early hours", v="Oct 26–30 (7:30 a.m.–7:30 p.m.; Oct 27 to 8:30 p.m.)", url="https://www.ohiosos.gov/elections/voting-schedule-text-only"),
        dict(k="Final weekend", v="Sat Oct 31 8 a.m.–4 p.m. · Sun Nov 1 1–5 p.m.", url="https://www.ohiosos.gov/elections/voting-schedule-text-only"),
        dict(k="Absentee application deadline", v="Tue Oct 27, 8:30 p.m. (received)", url="https://www.ohiosos.gov/elections/voting-schedule-text-only"),
        dict(k="Absentee ballot return", v="Must be received by 7:30 p.m. Nov 3 — no postmark grace", url="https://www.ohiosos.gov/elections/voting-schedule-text-only"),
        dict(k="Election Day", v="Polls 6:30 a.m.–7:30 p.m. ET", url="https://www.ohiosos.gov/elections/voting-schedule-text-only"),
        dict(k="2022 benchmark", v="1.0M absentee requests · 843K returned · 550K early in person", url="https://www.ohiosos.gov/office/media-center/categories/press-releases/2022-11-07"),
        dict(k="2024 benchmark", v="≈2.6M early or absentee votes (45% of all)", url="https://spectrumnews1.com/oh/columbus/news/2026/10/06/early-voting-kicks-off-in-ohio"),
    ]


def ohio_other():
    return [
        dict(office="Attorney General", dem="John Kulewicz", rep="Keith Faber", note="Kulewicz campaign polls: 34–34 (June), 36–32 (Aug). Debate Oct 19 in Youngstown."),
        dict(office="Secretary of State", dem="Allison Russo", rep="Robert Sprague", note="Also Tom Pruss (L). Sabato: Lean R. No public polls."),
        dict(office="Auditor", dem="Annette Blackwell", rep="Frank LaRose", note="No public polls."),
        dict(office="Treasurer", dem="Seth Walsh", rep="Jay Edwards", note="No public polls."),
        dict(office="Supreme Court (Jan 1 term)", dem="Marilyn Zayas", rep="Daniel Hawkins (inc.)", note="Court is 6 R – 1 D."),
        dict(office="Supreme Court (Jan 2 term)", dem="Jennifer Brunner (inc.)", rep="Colleen O’Donnell", note=""),
    ]


def ohio_issues():
    return [dict(label="**State Issue 3** — voter photo-ID requirement written into the Ohio Constitution (legislatively referred). Suffolk/USA Today, Sept 23–27: **61% yes, 31% no**. Backed by Republicans including Trump, Ramaswamy and Sprague; Newsweek reports Acton broke with Democrats to support it. Opposed by Democrats including Russo, by Libertarian secretary-of-state candidate Tom Pruss, and by some conservative activists who say it does not go far enough on absentee ballots.",
                 url="https://ohiocapitaljournal.com/voter-guides/ballot-measures/2026-ohio-general-election-statewide-issue-3/")]


OHIO_CAL = [
    dict(date="2026-10-19", label="Ohio attorney general debate (Faber–Kulewicz), Youngstown State, 2:30 p.m.", url="https://ohiocpa.com/for-the-public/news/2026/10/09/week-in-review--oct.-11--2026"),
    dict(date="2026-10-24", label="Ohio early voting: Saturday hours 8 a.m.–4 p.m."),
    dict(date="2026-10-26", label="Ohio early voting moves to extended hours (7:30 a.m.–7:30 p.m.) through Oct 30"),
    dict(date="2026-10-27", label="**Ohio absentee application deadline** — 8:30 p.m., must be received", url="https://www.ohiosos.gov/elections/voting-schedule-text-only"),
    dict(date="2026-10-31", label="Ohio early voting: Saturday 8 a.m.–4 p.m."),
]
