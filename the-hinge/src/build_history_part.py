import os
"""History / calibration structures from history.json (2024 errors, swing evidence, midterm record)."""
import json
SP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "")
H = json.load(open(SP + "data/history.json"))

COMP24 = next(x["mean_signed_error"] for x in H["results_2024_computed_summary"] if x["race"] == "Senate" and x["avg_source"] == "RCP")   # 2.51
GEN24 = next(x["computed_err_rcp_minus_actual"] for x in H["generic_history"] if x["year"] == 2024)                                      # 2.26
PREF = ["RCP", "538", "Silver Bulletin", "270toWin", "DDHQ/The Hill"]


def extra24():
    """One 2024 polling error per (office, state): avg − actual, preferring RCP."""
    best = {}
    for r in H["results_2024"]:
        if r["state"] == "National" or r.get("computed_error_avg_minus_actual") is None or r["avg_source"] not in PREF: continue
        k = (r["race"], r["state"])
        if k not in best or PREF.index(r["avg_source"]) < PREF.index(best[k]["avg_source"]): best[k] = r
    return [dict(state=k[1], office=k[0], err=v["computed_error_avg_minus_actual"]) for k, v in best.items()]


def res24():
    out = {}
    seen = set()
    for r in H["results_2024"]:
        if r["state"] == "National" or r.get("actual_d") is None: continue
        k = (r["race"], r["state"])
        if k in seen: continue
        seen.add(k)
        if r["race"] == "President": label = "2024 Pres · Harris v Trump"
        else:
            c = (r.get("candidates") or "").replace(" (I)", "")
            parts = [p.strip().split()[-1] for p in c.split(" vs ")] if " vs " in c else ["D", "R"]
            label = f"2024 Sen · {parts[0]} v {parts[1]}"
        out.setdefault(r["state"], []).append(dict(label=label, d=r["actual_d"], r=r["actual_r"]))
    return out


def national_refs():
    out = []
    for g in H["generic_history"]:
        if g["year"] < 2014: continue
        a = g["actual_detail"]
        out.append(dict(label=f"{g['year']} House vote", year=g["year"], d2=round(100 * a["d_pct"] / (a["d_pct"] + a["r_pct"]), 2)))
    return out


SWING = [
    dict(value="95%", stat="of Republicans and of Democrats voted for their own party’s presidential nominee in 2024 — the same as in 2020.", stance="for", source="Pew validated voters", url="https://www.pewresearch.org/politics/2025/06/26/voting-patterns-in-the-2024-election/"),
    dict(value="4 of 34", stat="states split their 2024 presidential and Senate results (0 of 34 in 2016); split Senate delegations are at their lowest since 1914.", stance="for", source="Pew", url="https://www.pewresearch.org/short-reads/2024/11/26/2024-elections-show-more-partisan-splits-between-states-presidential-and-senate-votes-than-in-recent-past/"),
    dict(value="83 → 16", stat="House districts that split their presidential and House votes, 2008 versus 2020 (23 in 2022).", stance="for", source="Wikipedia, citing NBC, 538, Sabato", url="https://en.wikipedia.org/wiki/Split-ticket_voting"),
    dict(value="8% / 4%", stat="of under-50 Biden 2020 voters switched to Trump in 2024, and of Trump 2020 voters to Harris — small slices that still decide close races.", stance="for", source="Pew", url="https://www.pewresearch.org/politics/2025/06/26/voting-patterns-in-the-2024-election/"),
    dict(value="6%", stat="of people who voted in both 2020 and the 2022 midterm crossed party lines (or went third-party) in their House vote.", stance="for", source="Pew", url="https://www.pewresearch.org/politics/2023/07/12/republican-gains-in-2022-midterms-driven-mostly-by-turnout-advantage/"),
    dict(value="+30", stat="Trump’s margin among 2016 late deciders in Wisconsin (about 13% decided in the final week nationally).", stance="for", source="AAPOR 2016 task force", url="https://aapor.org/wp-content/uploads/2023/01/AAPOR-2016-Election-Polling-Report.pdf"),
    dict(value="Turnout > switching", stat="Pew’s verdict on 2024: differential partisan turnout was a more important factor in Trump’s win than voters changing sides.", stance="against", source="Pew", url="https://www.pewresearch.org/politics/2025/06/26/voting-patterns-in-the-2024-election/"),
    dict(value="89% / 85%", stat="of Trump’s and of Biden’s 2020 voters turned out again in 2024 — a four-point gap in who showed up.", stance="against", source="Pew", url="https://www.pewresearch.org/politics/2025/06/26/behind-trumps-2024-victory-a-more-racially-and-ethnically-diverse-voter-coalition/"),
    dict(value="1–2 pts", stat="of the GOP’s 2022 House gain came from defections; turnout differences account for most of it (2018 voters who skipped 2022 favored Democrats 64–33).", stance="against", source="Pew", url="https://www.pewresearch.org/politics/2023/07/12/republican-gains-in-2022-midterms-driven-mostly-by-turnout-advantage/"),
    dict(value="≈ half", stat="of Democrats’ 2018 gain came from 2016 non-voters who showed up (68–29 Democratic, about 11% of 2018 voters).", stance="against", source="Pew", url="https://www.pewresearch.org/politics/2020/09/08/democrats-made-gains-from-multiple-sources-in-2018-midterm-victories/"),
    dict(value="Minimal", stat="persuasive effect of campaign contact in general elections across 49 field experiments — persuasion is hard to buy.", stance="against", source="Kalla & Broockman, APSR 2018", url="https://en.wikipedia.org/wiki/David_Broockman"),
    dict(value="36%", stat="of 2024 voters had skipped at least one of the two prior federal elections (64% voted in all three) — the intermittent electorate is large.", stance="against", source="Pew (complement of its 64% figure)", url="https://www.pewresearch.org/politics/2025/06/26/voter-turnout-2020-2024/"),
    dict(value="37%", stat="of eligible citizens voted in all three elections of 2018, 2020 and 2022 — and those steady voters split almost evenly by party (49% D, 50% R).", stance="context", source="Pew", url="https://www.pewresearch.org/politics/2023/07/12/voter-turnout-2018-2022/"),
    dict(value="11%", stat="of 2016 poll respondents gave a different answer after the election than before — the movable slice is real but small.", stance="context", source="AAPOR 2016 callback study", url="https://aapor.org/wp-content/uploads/2023/01/AAPOR-2016-Election-Polling-Report.pdf"),
]

MIDTERMS = [dict(year=m["year"], president=m["president"], party=m["party"], approval=m["approval"], house=m["house_change"], senate=m["senate_change"]) for m in H["midterm_history"]]
MIDTERM_NOTE = "Since 1946 the president’s party has lost House seats in all but two midterms (1998, 2002). Gallup: presidents under 50% approval averaged a 37-seat loss; above 50%, 14."
OCT_MOVES = [dict(year=m["year"], oct11=m["fte_retro_oct11_margin"], final=m["fte_retro_final_margin"], move=m["computed_move_final_minus_oct11"]) for m in H["gb_october_moves"]["fte_retro_oct11_vs_final_1996_2016"]]
OCT_NOTE = ("From Oct 11 to Election Day, 538’s historical generic-ballot average moved **1.6 points** on average (1996–2016; largest 3.9 in 2010). "
            "In four of five midterms the late movement favored the party out of the White House.")
BIAS_CAVEATS = [
    "Silver Bulletin: polling bias has been “historically unpredictable cycle-to-cycle,” averaging about D+1.1 since 1998.",
    "G. Elliott Morris (2026): last cycle’s bias called the direction right in 10 of 14 cycles but missed the size by 2.5 points on average — correcting for it would have made 10 of 14 Election Day forecasts worse.",
    "Silver Bulletin found polls underestimated Democrats by 6.1 points on average in 2025’s off-year races.",
]
SOURCES = [
    ("History & calibration", "538 pollster-ratings raw polls (GitHub)", "https://github.com/fivethirtyeight/data/tree/master/pollster-ratings"),
    ("History & calibration", "538 historical generic-ballot average (GitHub)", "https://raw.githubusercontent.com/fivethirtyeight/data/master/congress-generic-ballot/generic_topline_historical.csv"),
    ("History & calibration", "RealClearPolling — 2024 generic ballot", "https://www.realclearpolling.com/polls/state-of-the-union/2024/generic-congressional-vote"),
    ("History & calibration", "Pew — Voting patterns in the 2024 election", "https://www.pewresearch.org/politics/2025/06/26/voting-patterns-in-the-2024-election/"),
    ("History & calibration", "Pew — Republican gains in 2022 driven mostly by turnout", "https://www.pewresearch.org/politics/2023/07/12/republican-gains-in-2022-midterms-driven-mostly-by-turnout-advantage/"),
    ("History & calibration", "Pew — Voter turnout, 2018–2022", "https://www.pewresearch.org/politics/2023/07/12/voter-turnout-2018-2022/"),
    ("History & calibration", "Pew — 2024 elections show more partisan splits", "https://www.pewresearch.org/short-reads/2024/11/26/2024-elections-show-more-partisan-splits-between-states-presidential-and-senate-votes-than-in-recent-past/"),
    ("History & calibration", "AAPOR — 2016 election polling report", "https://aapor.org/wp-content/uploads/2023/01/AAPOR-2016-Election-Polling-Report.pdf"),
    ("History & calibration", "Gallup — midterm seat losses and approval", "https://news.gallup.com/poll/242093/midterm-seat-loss-averages-unpopular-presidents.aspx"),
    ("History & calibration", "Silver Bulletin — when polls underestimate Democrats", "https://www.natesilver.net/p/actually-sometimes-polls-underestimate"),
    ("History & calibration", "G. Elliott Morris — predicting poll bias", "https://www.gelliottmorris.com/p/2026-08-21-predicting-poll-bias-fools-errand"),
]
