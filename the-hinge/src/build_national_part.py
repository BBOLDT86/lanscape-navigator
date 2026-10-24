import os
"""National environment & messaging content (from national.json), written neutrally."""
import json
SP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "")
N = json.load(open(SP + "data/national.json"))

PEW = "https://www.pewresearch.org/politics/2026/10/08/with-americans-in-a-sour-mood-democratic-voters-are-more-engaged-in-midterms/"
PEW_PDF = "https://www.pewresearch.org/wp-content/uploads/sites/20/2026/10/PP_2026.10.8_midterms_report.pdf"
NYTS = "https://www.newsweek.com/republicans-losing-to-democrats-7-major-midterm-issues-poll-12444769"
WIKI_Q3 = "https://en.wikipedia.org/wiki/Timeline_of_the_second_Trump_presidency_(2026_Q3)"

MESSAGES = {
    "dem": [
        dict(theme="Lower costs", detail="The DNC says the party will “focus on lowering costs,” arguing that rising gas and grocery prices and the Iran conflict are hurting Republicans.", url="https://newsweek.com/democrat-chances-of-winning-house-senate-hit-new-high-nate-silver-forecast-12545290"),
        dict(theme="Affordable health care", detail="A pledge to make health care affordable — one of the priorities the DNC names for the fall.", url="https://newsweek.com/democrat-chances-of-winning-house-senate-hit-new-high-nate-silver-forecast-12545290"),
        dict(theme="Rooting out corruption", detail="Corruption is a named DNC focus; critics have targeted the “Trump API” paid-access product, and Democratic senators pressed the attorney general over the dismissal of the Adani case.", url=WIKI_Q3),
        dict(theme="A check on the president", detail="Casting a Democratic Congress as a check on Trump; strategists describe the frame as “affordability, competence and checks on Trump.”", url="https://thehill.com/opinion/campaign/6112294-republican-vulnerabilities-midterm-outlook/amp/"),
        dict(theme="End the Iran war", detail="The House has three times passed resolutions requiring the president to end the war; the DNC cites the conflict, alongside rising gas prices, as a drag on Republicans.", url=WIKI_Q3),
        dict(theme="Protect voting access", detail="Twenty-four states and D.C. sued over the mail-voting executive order, and Democratic groups over alleged plans to send armed federal agents to polling places.", url="https://en.wikipedia.org/wiki/2026_United_States_elections"),
    ],
    "rep": [
        dict(theme="Make it about Trump’s agenda", detail="The White House is nationalizing the midterms around the president, headlined by a two-day Republican midterm convention in Dallas (Sept 9–10).", url="https://politicalwire.com/2026/09/02/the-white-house-moves-to-make-midterms-about-trump/"),
        dict(theme="A $5,000 payment", detail="Trump proposed a $5,000 payment to every adult if Republicans hold both chambers (estimated cost $1.3 trillion).", url=WIKI_Q3),
        dict(theme="Democrats as extreme", detail="Portraying Democratic nominees as extreme or socialist; the House passed a resolution denouncing socialism on Sept 1.", url=WIKI_Q3),
        dict(theme="Blame for the shutdown", detail="Speaker Johnson blames Democrats for the 120-day shutdown this Congress, which stemmed from disputes over limits on immigration enforcement.", url="https://www.foxnews.com/politics/trump-signs-government-funding-bill-avoiding-shutdown-ahead-midterms.print"),
        dict(theme="Resolve on Iran", detail="Trump has asked Americans to accept higher gas prices as the cost of stopping Iran’s nuclear program, and rejected an Iranian ceasefire offer on Sept 25.", url=WIKI_Q3),
        dict(theme="Election integrity and fraud", detail="The mail-voting executive order, citizenship checks of voter rolls (allowed by the Supreme Court on Sept 25), and removing 760,000 ACA enrollees the administration calls fraudulent.", url=WIKI_Q3),
    ],
}

ISSUES = [  # Pew "very important to my vote" (RV), Sep 28–Oct 4; party trust from NYT/Siena LV Sep 8–13 where asked
    dict(issue="Economy", pct=84, edge="D+6", src="Pew; trust: NYT/Siena 51–45"),
    dict(issue="Future of democracy", pct=73, edge=None, src="Pew"),
    dict(issue="Health care", pct=68, edge="D+24", src="Pew; trust: NYT/Siena 60–36"),
    dict(issue="Education", pct=62, edge=None, src="Pew"),
    dict(issue="Immigration", pct=59, edge="D+7", src="Pew; trust: NYT/Siena 52–45"),
    dict(issue="Foreign policy", pct=57, edge="D+6", src="Pew; trust: NPR/Marist 42–36"),
    dict(issue="Energy policy", pct=54, edge=None, src="Pew"),
    dict(issue="Violent crime", pct=52, edge=None, src="Pew"),
]
ISSUES_NOTE = "Share of registered voters calling each issue “very important” to their vote (Pew, Sept 28–Oct 4). The tag shows which party voters trust more on it, where a recent poll asked (NYT/Siena, NPR/Marist)."

SIGNALS = [
    dict(value="−21.9", label="Trump net approval, near the all-time low of −23.5 set days earlier", src="Silver Bulletin, Oct 9", url="https://www.natesilver.net/p/trump-approval-ratings-nate-silver-bulletin"),
    dict(value="D+7.9", label="Generic congressional ballot average (49.8–41.9)", src="RealClearPolling, Sept 16–Oct 5", url="https://www.realclearpolling.com/polls/state-of-the-union/generic-congressional-vote"),
    dict(value="32 / 61", label="Right direction / wrong track", src="RealClearPolling average", url="https://www.realclearpolling.com/polls/state-of-the-union/direction-of-country"),
    dict(value="63 / 46", label="Share of Democratic and of Republican supporters “extremely motivated” to vote — in October 2022 it was 56 / 58", src="Pew, Sept 28–Oct 4", url=PEW),
    dict(value="≈ D+13", label="Average special-election swing versus the 2024 presidential margin since Jan 2025; the RNC calls special elections “a snapshot of local quirks,” not a preview of the fall", src="The Downballot via NPR (as of April); RNC via Fox News", url="https://npr.org/2026/04/08/nx-s1-5770114/democrats-wisconsin-georgia-election-shift-overperformance-trump"),
    dict(value="$4.36", label="National average gas price; September set a record for the month", src="AAA, Oct 11", url="https://gasprices.aaa.com/national-average-dips-following-record-setting-september/"),
    dict(value="3.4%", label="CPI inflation, year over year (August); September’s report is due Oct 14", src="BLS via secondary source", url="https://admiralmarkets.com/analytics/traders-blog/us-cpi-preview-september-2026-forecasts-and-the-core-cpi-outlook"),
    dict(value="2.2%", label="Q2 GDP growth, annualized — revised up on Sept 30 from an earlier 1.5% estimate", src="BEA", url="https://bea.gov/news/2026/gdp-third-estimate-industries-corporate-profits-state-gdp-and-state-personal-income-2nd"),
    dict(value="46.3", label="Consumer sentiment, preliminary October", src="University of Michigan", url="https://investinglive.com/news/us-october-umich-prelim-consumer-sentiment-vs-47-8-expected/"),
    dict(value="−37", label="Average House seats lost by the president’s party in midterms when his approval was under 50% (14 when above)", src="Gallup", url="https://news.gallup.com/poll/242093/midterm-seat-loss-averages-unpopular-presidents.aspx"),
]

GROUPS = [
    dict(group="Independents", shift="Favor Democrats for Congress **57–34**; 27% approve of Trump.", src="NYT/Siena, Sept 8–13", url="https://www.fox9.com/news/democrats-gaining-advantage-ahead-midterms-trumps-ratings-sink-poll"),
    dict(group="2024 Trump voters", shift="67% approve of Trump (83% in January); **77%** back the GOP House candidate, 5% the Democrat, **13% unsure**.", src="Pew", url=PEW),
    dict(group="Hispanic voters", shift="Democrats lead **51–24**; Trump approval among Hispanic adults fell from 37% to 27% between July and August.", src="Pew; Economist/YouGov", url=PEW_PDF),
    dict(group="Voters under 30", shift="Democrats lead **51–23**; about half of young 2024 Trump voters still approve of him, versus 76% of those 50 and older.", src="Pew", url=PEW_PDF),
    dict(group="Women and men", shift="Women favor Democrats **45–31**; men are tied 42–42.", src="Pew", url=PEW_PDF),
    dict(group="Where Republicans lead", shift="White voters **R 44–37**, voters 50–64 **R 45–39**, and voters without a college degree **R 39–35**; those 65 and older lean Democratic, 44–41.", src="Pew", url=PEW_PDF),
    dict(group="2024 non-voters", shift="Lean Democratic **39–26**, with 29% unsure.", src="Pew", url=PEW),
]

EVENTS = [
    dict(date="2026-07-08", event="The U.S.–Iran ceasefire collapses after attacks on shipping in the Strait of Hormuz; the war that began Feb 28 resumes.", why="Energy prices and the war move to the center of the campaign.", url="https://en.wikipedia.org/wiki/2026_Iran_war"),
    dict(date="2026-07-20", event="Trump announces 50% tariffs on specified Canadian goods (effective late August); Canada retaliates.", why="Trade approval later hits an all-time low in the Silver Bulletin average.", url=WIKI_Q3),
    dict(date="2026-07-24", event="Temporary global tariffs expire and are rebuilt under Section 301 (10–12.5% on 60 economies), after the Supreme Court’s earlier IEEPA ruling.", why="Keeps broad tariffs — and the price debate — in place.", url="https://uhy-us.com/insights/news/2026/july/tariff-reset-section-122-expires-as-section-301-duties-expand"),
    dict(date="2026-08-14", event="Trump asks Americans to accept higher gas prices as the cost of stopping Iran’s nuclear program.", why="Puts national security directly against cost-of-living concerns.", url=WIKI_Q3),
    dict(date="2026-08-26", event="Twenty-four states and D.C. sue to block the executive order restricting mail voting.", why="A federal judge blocks Postal Service implementation on Sept 13.", url=WIKI_Q3),
    dict(date="2026-09-02", event="A stopgap funding bill is signed through Dec 11.", why="No shutdown before the election; this Congress has already had three partial shutdowns.", url="https://www.khaleejtimes.com/world/americas/trump-signs-bill-avert-government-shutdown-us-midterm-elections"),
    dict(date="2026-09-09", event="At the GOP midterm convention in Dallas, Trump proposes a $5,000 payment to every adult if Republicans hold both chambers.", why="The centerpiece of the Republican closing pitch.", url=WIKI_Q3),
    dict(date="2026-09-16", event="The Fed raises rates to 3.75–4.00%, its first hike since 2023; the House again votes to require an end to the Iran war.", why="Borrowing costs rise into the election.", url=WIKI_Q3),
    dict(date="2026-09-22", event="The administration announces plans to remove 760,000 ACA enrollees over alleged fraud.", why="Health care is the issue where Democrats hold their widest trust advantage; the administration frames the move as anti-fraud.", url=WIKI_Q3),
    dict(date="2026-09-25", event="Trump rejects an Iranian ceasefire proposal; the Supreme Court allows an expanded citizenship database for voter-roll checks.", why="The war stays live through Election Day.", url=WIKI_Q3),
    dict(date="2026-10-02", event="September jobs report: +29,000 payrolls, unemployment 4.2%.", why="A softening labor market alongside 3%+ inflation.", url="https://www.bls.gov/news.release/archives/empsit_10022026.htm"),
    dict(date="2026-10-08", event="Pew finds Trump approval at 30%; 63% of Democratic supporters and 46% of Republican supporters say they are “extremely motivated” to vote.", why="The enthusiasm gap has reversed since 2022, when Republicans led 58–56.", url=PEW),
]

LEDE = [
    "**The national environment has moved toward Democrats since summer.** Trump’s net approval is near its second-term low (−21.9 in the Silver Bulletin average on Oct 9), the generic ballot averages about **D+8** (RealClearPolling), and 63% of Democratic supporters versus 46% of Republican supporters say they are “extremely motivated” to vote (Pew) — the reverse of October 2022.",
    "**The campaign is being fought over prices.** Inflation is the top issue in Economist/YouGov polling, gas averages $4.36 amid the Iran war, and the Fed raised rates in September. Democrats are running on costs, health care and a check on the president; Republicans on the president’s agenda — including a proposed $5,000 payment — on resolve against Iran and on election integrity.",
    "**Outside forecasters agree on the direction, not the size.** Silver Bulletin puts Democrats at 75% for the Senate and 93% for the House (Oct 8); Decision Desk HQ at 56% and 76% (Oct 10); prediction markets at about 61% and 90% (Oct 11). This model’s own read is in the tiles above — and depends heavily on how much you trust this year’s polls.",
]

EXT_FORECASTS = dict(
    senate=[
        dict(src="Silver Bulletin", val="D 75%", date="2026-10-08", url="https://newsweek.com/democrat-chances-of-winning-house-senate-hit-new-high-nate-silver-forecast-12545290"),
        dict(src="Decision Desk HQ", val="D 56%", date="2026-10-10", url="https://votes.decisiondeskhq.com/forecast/2026"),
        dict(src="Kalshi/Polymarket avg.", val="D 61%", date="2026-10-11", url="https://defirate.com/odds/2026-midterms/snapshot/2026-10-11T0443"),
    ],
    house=[
        dict(src="Silver Bulletin", val="D 93%", date="2026-10-08", url="https://newsweek.com/democrat-chances-of-winning-house-senate-hit-new-high-nate-silver-forecast-12545290"),
        dict(src="Decision Desk HQ", val="D 76%", date="2026-10-10", url="https://votes.decisiondeskhq.com/forecast/2026"),
        dict(src="Kalshi/Polymarket avg.", val="D 90%", date="2026-10-11", url="https://defirate.com/odds/2026-midterms/snapshot/2026-10-11T0443"),
    ],
)

NAT_CAL = [
    dict(date="2026-10-14", label="September CPI inflation report (consensus ≈3.7% y/y)", url="https://admiralmarkets.com/analytics/traders-blog/us-cpi-preview-september-2026-forecasts-and-the-core-cpi-outlook"),
    dict(date="2026-10-28", label="Federal Reserve rate decision", url="https://admiralmarkets.com/analytics/traders-blog/us-cpi-preview-september-2026-forecasts-and-the-core-cpi-outlook"),
]

SOURCES = [
    ("National environment", "Silver Bulletin — Trump approval", "https://www.natesilver.net/p/trump-approval-ratings-nate-silver-bulletin"),
    ("National environment", "RealClearPolling — approval", "https://www.realclearpolling.com/polls/approval/donald-trump/approval-rating"),
    ("National environment", "RealClearPolling — generic ballot", "https://www.realclearpolling.com/polls/state-of-the-union/generic-congressional-vote"),
    ("National environment", "RealClearPolling — direction of country", "https://www.realclearpolling.com/polls/state-of-the-union/direction-of-country"),
    ("National environment", "Pew Research Center — midterm survey, Oct 8", PEW),
    ("National environment", "Pew — report PDF", PEW_PDF),
    ("National environment", "Economist/YouGov, Oct 2–5", "https://yougov.com/en-us/articles/55702-inflation-hits-new-high-americans-top-issue-october-25-2026-economist-yougov-poll"),
    ("National environment", "Gallup — Most Important Problem", "https://news.gallup.com/poll/1675/most-important-problem.aspx"),
    ("National environment", "NYT/Siena via Newsweek", NYTS),
    ("National environment", "NPR/PBS News/Marist", "https://www.kaxe.org/news/2026-09-23/poll-most-voters-agree-the-2026-midterms-are-all-about-trump-and-they-disapprove"),
    ("National environment", "Wikipedia — Timeline of the second Trump presidency (2026 Q3)", WIKI_Q3),
    ("National environment", "AdImpact — 2026 projections", "https://adimpact.com/hubfs/Reports/updated%20projections%202026/AdImpact%20Updated%20Political%20Projection%20Report_2025-2026.pdf"),
    ("National environment", "BLS — September jobs report", "https://www.bls.gov/news.release/archives/empsit_10022026.htm"),
    ("National environment", "AAA — gas prices", "https://gasprices.aaa.com/national-average-dips-following-record-setting-september/"),
    ("Forecasts & markets", "Silver Bulletin forecast via Newsweek", "https://newsweek.com/democrat-chances-of-winning-house-senate-hit-new-high-nate-silver-forecast-12545290"),
    ("Forecasts & markets", "Decision Desk HQ forecast", "https://votes.decisiondeskhq.com/forecast/2026"),
    ("Forecasts & markets", "DeFi Rate — Kalshi/Polymarket snapshot", "https://defirate.com/odds/2026-midterms/snapshot/2026-10-11T0443"),
    ("Special elections", "NPR on The Downballot’s special-election average", "https://npr.org/2026/04/08/nx-s1-5770114/democrats-wisconsin-georgia-election-shift-overperformance-trump"),
    ("Special elections", "Fox News — the RNC on special elections", "https://www.foxnews.com/politics/republicans-win-democrats-also-claim-victory-ballot-box-surge-trump-territory"),
    ("National environment", "BEA — Q2 GDP, third estimate", "https://bea.gov/news/2026/gdp-third-estimate-industries-corporate-profits-state-gdp-and-state-personal-income-2nd"),
    ("Special elections", "Wikipedia — 2025 gubernatorial elections", "https://en.wikipedia.org/wiki/2025_United_States_gubernatorial_elections"),
]


def gb_polls_fallback():
    out = []
    for i, p in enumerate(N["generic_ballot"]["recent_polls"]):
        a, b = p["dates"].split("-")
        mk = lambda s: "2026-%02d-%02d" % tuple(int(x) for x in s.split("/"))
        out.append(dict(id=f"gbn{i}", race="GB", pollster=p["pollster"], sponsor="", partisan="", start=mk(a), end=mk(b), n=None, pop="", dem=p["dem"], rep=p["rep"], url=p.get("url") or N["generic_ballot"]["url"]))
    return out
