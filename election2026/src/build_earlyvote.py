#!/usr/bin/env python3
"""Build data/earlyvote.json from the UF Election Lab CSV snapshots captured on 2026-10-23.

Inputs (captured in-browser from election.lab.ufl.edu on 2026-10-23, saved as pipe-delimited):
  work/uf2026_us.psv  <- https://election.lab.ufl.edu/data-downloads/earlyvote/2026/US.csv  (live 2026 tracker data)
  work/uf2024_us.psv  <- https://election.lab.ufl.edu/data-downloads/earlyvote/2024/US.csv  (final 2024 tracker data)
"""
import json, sys, os
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "work")
OUT = os.path.join(ROOT, "data", "earlyvote.json")

US_CSV_2026 = "https://election.lab.ufl.edu/data-downloads/earlyvote/2026/US.csv"
US_CSV_2024 = "https://election.lab.ufl.edu/data-downloads/earlyvote/2024/US.csv"
UF_NATIONAL = "https://election.lab.ufl.edu/early-vote/2026-early-voting/"
UF_STATE_PAGE = "https://election.lab.ufl.edu/early-vote/2026-early-voting/2026-general-election-early-vote-{slug}/"

STATES = {
 "AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut",
 "DE":"Delaware","DC":"District of Columbia","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois",
 "IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland",
 "MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana",
 "NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York",
 "NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania",
 "RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah",
 "VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming",
}

# States that had their own UF per-state page linked from the national page on 2026-10-23 (32 states).
UF_STATE_PAGES = ["AZ","AR","CA","CO","CT","DE","FL","ID","IA","KS","KY","LA","ME","MD","NE","NV","NJ","NM","NC",
                  "OK","OR","PA","RI","SD","UT","WV","WY","GA","MI","VT","WA","SC"]

# Per-state methodology notes copied verbatim from the UF US.csv "notes" column (2026-10-23).
UF_NOTES = {
 "AZ": "Arizona's request_* figures are mail ballots issued (sent out), not applications received - this state's early voting is run through a permanent early-voting list rather than a one-off per-election request.",
 "CA": "Some statistics provided by PDI (https://politicaldata.com/). The higher value provided by the California Secretary of State or PDI is used where reporting differences exist.",
 "DE": "Delaware does not publish mail ballot request data. The \"ballots requested\" figures shown for Delaware are the number of mail ballots received and counted, treated as equal to requests for lack of any other source.",
 "DC": "The DC Board of Elections reports mail ballots returned in two separate files (drop box and USPS). There is no separate outstanding-request count, so request_all is set equal to the total returned. No party, age, or geographic breakdown is available. In-person early voting is not yet included; a third file covering it is expected later in the cycle.",
 "FL": "Some Florida statistics are obtained from county websites that may report more recent and higher numbers than the Florida Division of Elections reports.",
 "GA": "Georgia's county-level \"Ballots Issued and Accepted\" and \"Ballots to Date\" downloads (from the state's election-data-hub dashboard, https://sos.ga.gov/page/election-data-hub-unofficial-turnout) are compared against the statewide absentee file, county by county, using whichever is higher - this is how same-day in-person early-voting activity (which the statewide absentee file doesn't carry until the next overnight refresh) gets folded in. No district or demographic breakdown is available from these county-level downloads.",
 "ID": "Idaho's daily absentee file covers mail ballots only - in-person early voting counts are scraped separately from the state's own dashboard (https://voteidaho.gov/data-and-dashboards/absentee-tracker/) and added in as a single statewide/county total, with no party, age, or gender breakdown available for it.",
 "IA": "Iowa's BALLOT_STATUS field is not fully documented - this site infers whether a mail ballot was accepted from whether it has a RECEIVED_DATE rather than from BALLOT_STATUS directly. Figures may be revised once the Iowa Secretary of State's office provides official field documentation.",
 "KY": "Kentucky reports are typically time-stamped one day behind when they are updated to this site.",
 "LA": "Louisiana does not publish mail ballot request data - the ballots requested figures shown for Louisiana equal ballots returned. Louisiana reports statistics for Whites, Blacks, and other only.",
 "MD": "Maryland reports are typically time-stamped one day behind when they are updated to this site.",
 "NV": "Statewide and county totals, method of voting (mail vs. in-person), and party registration all come from two public JSON files the state's own Vivid dashboard uses. District, age, and district-level party breakdowns come from a separate individual-level file and may not sum to exactly the same statewide total.",
 "NC": "North Carolina provides summary ballot request statistics available for counties only. No mail ballot request statistics by district are available.",
 "OH": "In-person early votes may be different than reported by the Ohio Secretary of State. They are approximated by counting a ballot sent and received on the same day as an in-person early vote.",
 "OK": "These data are obtained from the Oklahoma State Board of Elections Election Data Warehouse.",
 "PA": "These statistics are compiled from an individual level file which may have slightly different statistics than the state's summary report (timing of when the state generates these data).",
 "SC": "South Carolina's in-person early-voting total (by county) comes from a separate report with no race or Hispanic ethnicity breakdown; the race/ethnicity figures shown reflect mail ballots only.",
 "TN": "Tennessee's daily turnout report provides a cumulative county-level total for in-person early voters only. No mail-ballot figures or demographic data are available for Tennessee at this time.",
 "TX": "Texas does not report mail ballot requests. Requests are equal to mail ballots sent.",
 "UT": "Utah is a universal vote-by-mail state - every \"Active\" registered voter is automatically mailed a ballot each election. Statewide and county \"ballots requested\" figures are therefore the number of Active registered voters by party.",
 "WA": "Washington is a universal vote-by-mail state - every active registered voter is automatically mailed a ballot, so the \"ballots requested\" figures shown are active registered voters rather than a separate request count. Gender is the only demographic breakdown available; no party, race, or age data is published with ballot returns.",
 "WV": "West Virginia publishes in-person early vote returns by county and party only - there is no mail-ballot figure and no separate ballots-requested figure, so the \"ballots requested\" figures shown equal early vote returns.",
}

# Official daily-report sources for the key states. "format" is marked verified only where this session
# actually inspected the resource; otherwise it is what the UF notes / URL type indicate.
STATE_SOURCES = {
 "GA": {"name":"Georgia SOS election data hub (unofficial turnout) + statewide absentee voter file",
        "urls":["https://sos.ga.gov/page/election-data-hub-unofficial-turnout","https://mvp.sos.ga.gov/s/voter-absentee-files"],
        "format":"dashboard with county-level CSV downloads ('Ballots Issued and Accepted', 'Ballots to Date') + statewide absentee file (CSV in zip); per UF notes; not fetched this session",
        "cadence":"daily (absentee file refreshes overnight; dashboard intraday)"},
 "NC": {"name":"NC State Board of Elections absentee data (ENRS 2026_11_03)",
        "urls":["https://dl.ncsbe.gov/?prefix=ENRS/2026_11_03/","https://www.ncsbe.gov/results-data/absentee-data"],
        "format":"public file listing of CSV/zip files (daily absentee_counts_state / county files); cited by UF; not fetched this session",
        "cadence":"daily"},
 "TX": {"name":"Texas SOS early voting roster / turnout (Civix EVR UI)",
        "urls":["https://goelect.txelections.civixapps.com/ivis-evr-ui/evr"],
        "format":"web app (likely JSON API behind it); cited by UF; not fetched this session","cadence":"daily during early voting"},
 "FL": {"name":"Florida Division of Elections vote-by-mail / early voting public stats",
        "urls":["https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicStats"],
        "format":"HTML page with downloadable report files; cited by UF; not fetched this session","cadence":"daily"},
 "MI": {"name":"Michigan SOS (data provided to UF directly; public press releases)",
        "urls":["https://www.michigan.gov/sos/resources/news/2026/10/06/four-weeks-before-election-day-mail-ballot-returns-are-up-30-over-same-point-in-2022"],
        "format":"press release HTML; no public daily file found this session","cadence":"periodic press releases"},
 "OH": {"name":"Ohio SOS election dashboards (absentee)","urls":["https://data.ohiosos.gov/portal/election-dashboards"],
        "format":"dashboard (HTML/JS); cited by UF; not fetched this session","cadence":"daily/weekly"},
 "IA": {"name":"Iowa SOS absentee statistics (file provided to UF)","urls":[],"format":"unverified; UF lists 'Iowa Secretary of State'","cadence":"daily"},
 "NV": {"name":"Nevada SOS 'Vivid' turnout dashboard","urls":["https://www.nvsos.gov/elections/election-information/vivid-project"],
        "format":"dashboard backed by two public JSON files (per UF notes); not fetched this session","cadence":"daily"},
 "AZ": {"name":"Arizona: no statewide official daily file; UF uses Stealth Analytics aggregator of county data",
        "urls":["https://www.stealth-analytics.com/early-ballots"],"format":"HTML (unofficial aggregator); not fetched this session","cadence":"daily"},
 "PA": {"name":"Pennsylvania Dept of State 2026 General Election mail ballot requests (Socrata open data)",
        "urls":["https://data.pa.gov/Government-Efficiency-Citizen-Engagement/2026-General-Election-Mail-Ballot-Requests-Departm/nbwd-pfn4/about_data"],
        "format":"Socrata dataset (CSV/JSON export; individual-level); cited by UF; not fetched this session","cadence":"daily"},
 "WI": {"name":"Wisconsin Elections Commission absentee ballot report, Nov 3 2026 general",
        "urls":["https://elections.wi.gov/resources/statistics/absentee-ballot-report-november-3-2026-general-election-0"],
        "format":"HTML report page (statewide + county); cited by UF; not fetched this session","cadence":"daily (weekdays)"},
 "AK": {"name":"Alaska Division of Elections absentee/early statistics","urls":["https://www.elections.alaska.gov/research/statistics/#aeqstats"],
        "format":"HTML/xlsx; cited by UF; not fetched this session","cadence":"periodic"},
 "ME": {"name":"Maine SOS absentee ballot data files","urls":["https://www.maine.gov/sos/cec/elec/data/index.html"],
        "format":"downloadable data files; cited by UF; not fetched this session","cadence":"daily"},
 "NH": {"name":"New Hampshire: not tracked by UF (no row in US.csv)","urls":[],"format":"n/a","cadence":"n/a"},
 "KS": {"name":"Kansas SOS (data provided to UF directly)","urls":[],"format":"unverified","cadence":"unverified"},
 "NE": {"name":"Nebraska SOS (data file provided to UF directly)","urls":[],"format":"unverified","cadence":"unverified"},
 "MN": {"name":"Minnesota SOS absentee data","urls":["https://www.sos.mn.gov/election-administration-campaigns/data-maps/absentee-data/"],
        "format":"HTML report; cited by UF; not fetched this session","cadence":"daily (weekdays)"},
 "VA": {"name":"Virginia: UF uses VPAP early-voting tracker (nonpartisan, unofficial)","urls":["https://www.vpap.org/elections/early-voting/"],
        "format":"HTML; not fetched this session","cadence":"daily"},
 "NJ": {"name":"New Jersey Secretary of State (data provided to UF)","urls":[],"format":"unverified","cadence":"unverified"},
 "NY": {"name":"New York State Board of Elections (UF: no data yet, source TBD as of 10/23)","urls":[],"format":"unverified","cadence":"unverified"},
 "CA": {"name":"California SOS general election page (+PDI)","urls":["https://www.sos.ca.gov/elections/upcoming-elections/general-election-november-3-2026"],
        "format":"HTML; cited by UF; not fetched this session","cadence":"daily"},
 "CO": {"name":"Colorado Secretary of State (data provided to UF)","urls":[],"format":"unverified","cadence":"daily"},
}

def read_psv(path):
    with open(path, encoding="utf-8") as f:
        rows = [l.rstrip("\n").split("|") for l in f if l.strip()]
    h = rows[0]
    return [dict(zip(h, r)) for r in rows[1:]]

def num(v):
    try:
        return int(v)
    except Exception:
        return None

def iso(mdy):
    try:
        return datetime.strptime(mdy, "%m/%d/%Y").strftime("%Y-%m-%d")
    except Exception:
        return ""

d26 = {r["state_abbv"]: r for r in read_psv(os.path.join(WORK, "uf2026_us.psv"))}
d24 = {r["state_abbv"]: r for r in read_psv(os.path.join(WORK, "uf2024_us.psv"))}

KEY = ["OH","GA","NC","ME","IA","MI","AK","TX","NH","KS","NE","MN","FL","AZ","WI","PA","NV","VA","NJ","NY","CA","CO"]

states = {}
nat = {"req":0,"acc":0,"inp":0,"vot":0,"d":0,"r":0,"n":0,"reporting":0,"party":0}
for ab, name in STATES.items():
    r = d26.get(ab)
    f24 = d24.get(ab)
    final2024 = num(f24["voted_all"]) if f24 else None
    entry = {
        "name": name,
        "totalBallots": None, "mailReturned": None, "inPerson": None, "mailRequested": None,
        "byParty": None, "byPartyBasis": None,
        "asOf": "", "source": US_CSV_2026,
        "ufStatePage": UF_STATE_PAGE.format(slug=name.lower().replace(" ", "-")) if ab in UF_STATE_PAGES else None,
        "officialSource": None,
        "earlyInPersonStart": None, "earlyInPersonEnd": None,
        "mailRequestDeadline": "", "mailReturnDeadline": "",
        "final2022": None,
        "final2024": final2024,
        "final2024Detail": ({"inPerson": num(f24["inperson_all"]), "mailReturned": num(f24["accept_all"]),
                              "mailRequested": num(f24["request_all"]), "asOf": iso(f24["last_update"]),
                              "source": US_CSV_2024} if f24 else None),
        "pctOf2022Final": None,
        "turnout2022Total": num(r["turn_2022"]) if r else None,
        "pctOf2022Turnout": None,
        "pctOf2024Final": None,
        "updatesToday": None,
        "notes": "",
    }
    notes = []
    if r is None:
        notes.append("Not included in the UF Election Lab 2026 US.csv (no row for this state as of 2026-10-23).")
    else:
        entry["officialSource"] = r["data_source"]
        vot = num(r["voted_all"]); acc = num(r["accept_all"]); inp = num(r["inperson_all"]); req = num(r["request_all"])
        has_data = (vot or 0) > 0 or (req or 0) > 0
        if has_data:
            entry.update({"totalBallots": vot, "mailReturned": acc, "inPerson": inp, "mailRequested": req,
                          "asOf": iso(r["last_update"]), "updatesToday": num(r["updates_today"])})
            dem, rep, non = num(r["voted_dem"]), num(r["voted_rep"]), num(r["voted_none"])
            if (dem or 0) + (rep or 0) > 0:
                entry["byParty"] = {"D": dem, "R": rep, "other": non}
                entry["byPartyBasis"] = "registration"
                nat["party"] += 1; nat["d"] += dem; nat["r"] += rep; nat["n"] += non
            nat["req"] += req or 0; nat["acc"] += acc or 0; nat["inp"] += inp or 0; nat["vot"] += vot or 0
            if (vot or 0) > 0:
                nat["reporting"] += 1
            t22 = num(r["turn_2022"])
            if t22 and vot:
                entry["pctOf2022Turnout"] = round(100.0 * vot / t22, 1)
            if final2024 and vot:
                entry["pctOf2024Final"] = round(100.0 * vot / final2024, 1)
            if inp == 0:
                notes.append("UF reports 0 in-person early votes (in-person early voting not started, not offered, or not reported separately).")
            if acc == 0 and (inp or 0) > 0:
                notes.append("UF reports 0 mail ballots returned (mail figures not published or not yet loaded).")
        else:
            entry["asOf"] = iso(r["last_update"])
            notes.append("UF row present but no 2026 data yet (all counts 0; last_update %s; source '%s')." % (r["last_update"], r["data_source"]))
        if ab in UF_NOTES:
            notes.append("UF note: " + UF_NOTES[ab])
    if ab == "GA":
        entry["earlyInPersonStart"] = "2026-10-13"
        entry["earlyInPersonEnd"] = "2026-10-30"
        notes.append("Early in-person voting dates from Atlanta News First (2026-10-19) citing Georgia SOS: opened Oct 13, runs through Oct 30; Election Day Nov 3. GA SOS reported 1,005,130 total ballots (960,707 in person) as of 5:50 p.m. Oct 19.")
    if ab in STATE_SOURCES:
        entry["dailyReport"] = STATE_SOURCES[ab]
    entry["notes"] = " ".join(notes)
    states[ab] = entry

final2024_national = sum(num(r["voted_all"]) or 0 for r in d24.values())

out = {
  "asOf": "2026-10-23",
  "primarySource": {
    "name": "UF Election Lab 2026 Early Voting tracker (Michael McDonald)",
    "url": UF_NATIONAL,
    "dataUrl": US_CSV_2026,
    "format": "csv",
    "updateCadence": "Intraday as states post; page showed 'Last updated: Oct 23, 2026 @ 3:25pm Eastern Time' and later '@ 5:44pm Eastern Time' on the same day. Some states do not provide daily updates; the 'updates_today' column counts how many times a state was refreshed that day; 'last_update' is per state (M/D/YYYY).",
    "notes": ("The national page is a JavaScript dashboard: a plain HTTP fetch of the HTML shows placeholder 'X' values. "
              "All numbers come from one CSV, /data-downloads/earlyvote/2026/US.csv (one row per state + DC, 49 rows on 2026-10-23: no AL or NH rows). "
              "Columns: state,state_abbv,turn_2022,last_update,data_source,notes,request_*,accept_*,inperson_*,voted_* (each with _all,_dem,_rep,_none, age_1..4, nh_white/nh_black/nh_asian/nh_native_american/nh_other/hispanic, male/female/gender_unknown) and updates_today. "
              "voted_all = total early votes; accept_all = mail ballots returned; inperson_all = in-person early votes; request_all = mail ballots requested (for all-mail states this is active registrants or ballots issued; see per-state notes). "
              "National totals on the page equal the column sums of US.csv (verified: 23,590,165 / 10,787,246 / 12,802,919 / 59,216,745). Party figures are voter registration, only for states with party registration (27 states on 10/23). "
              "Per-state pages exist at /early-vote/2026-early-voting/2026-general-election-early-vote-{state-slug}/ for 32 states (linked from the national page) and load {ST}_county.csv, {ST}_cd.csv, {ST}_sdl.csv, {ST}_sdu.csv from the same /data-downloads/earlyvote/2026/ folder; house_tossup_races.csv is also there. "
              "Directory listing is forbidden (403); {ST}.csv does not exist (404). The 2024 final file is at /data-downloads/earlyvote/2024/US.csv (same layout, turn_2020 column); /2022/US.csv returns 404 (2022 tracker lived on RPubs). "
              "License: CC BY-NC-ND 4.0 - attribution required, no commercial use without permission. Fields with 0 mean 'not published/not applicable' as often as 'zero'."),
    "scriptHint": "GET https://election.lab.ufl.edu/data-downloads/earlyvote/2026/US.csv once or twice daily (cache-bust with a query string); parse CSV; sum voted_all/accept_all/inperson_all/request_all for national; per state use voted_all, accept_all, inperson_all, request_all, voted_dem/voted_rep/voted_none, last_update, updates_today."
  },
  "national": {
    "totalBallots": nat["vot"], "mailReturned": nat["acc"], "inPerson": nat["inp"], "mailRequested": nat["req"],
    "statesReporting": nat["reporting"],
    "byParty": {"D": nat["d"], "R": nat["r"], "other": nat["n"], "statesWithPartyData": nat["party"],
                "note": "registration, not vote choice. States with party registration data on 10/23: AZ, AR, CA, CO, CT, DE, FL, ID, IA, KS, KY, LA, ME, MD, NE, NV, NJ, NM, NC, OK, OR, PA, RI, SD, UT, WV, WY. Shares: D 45.5%, R 30.6%, None/Minor 23.9% of 11,612,628."},
    "comparison": {
      "text": ("The UF 2026 page publishes no same-point 2022 or 2024 comparison text; it offers a map option '2026 Early Vote to 2022 Total Turnout Ratio' (early votes divided by each state's total 2022 turnout, the turn_2022 column). "
               "Final 2024 early+mail total across the 49 UF-tracked jurisdictions = sum of voted_all in the archived 2024 US.csv. "
               "AP (via Fox 10 Phoenix, 2026-10-17) reported about 6 million early/mail ballots cast across 39 states as of Thursday Oct 15, 2026; no 2022 comparison given. "
               "Michigan SOS press release of 2026-10-06 is titled 'Four weeks before Election Day, mail ballot returns are up 30% over same point in 2022' (title only; body not fetched)."),
      "final2022": None,
      "final2024": final2024_national,
      "final2024Source": US_CSV_2024,
      "turnout2022TotalTrackedStates": sum(num(r["turn_2022"]) or 0 for r in d26.values())
    },
    "asOf": "2026-10-23T17:44:00-04:00",
    "source": UF_NATIONAL,
    "altSources": [
      {"name": "AP early-vote count (as reported by Fox 10 Phoenix)", "url": "https://www.fox10phoenix.com/news/no-kings-rallies-across-us-push-voting-early-heres-how-many-voters-already-have",
       "asOf": "2026-10-15", "totalBallots": 6000000, "statesReporting": 39, "note": "about 6 million; in-person early + mail returned; state figures CA 757,000+, FL ~669,000, VA 604,000+, MI ~573,000, PA 391,000+"}
    ]
  },
  "states": states,
  "keyStates": KEY,
  "headlines": [
    {"date": "2026-10-23", "text": "UF Election Lab tracker shows 23,590,165 early votes nationally (10,787,246 in person, 12,802,919 mail returned, 59,216,745 mail ballots requested) across 47 reporting states/DC as of 5:44 p.m. ET.", "source": UF_NATIONAL},
    {"date": "2026-10-23", "text": "Texas leads all states with 2,858,285 early votes (2,735,900 in person) per UF Election Lab; California 2,478,771 (all mail), Florida 2,285,310, Georgia 1,613,269, North Carolina 1,269,920.", "source": US_CSV_2026},
    {"date": "2026-10-19", "text": "Georgia passed 1 million ballots cast (1,005,130 total, 960,707 in person) as of 5:50 p.m. Oct 19, six days into early voting that runs Oct 13-30.", "source": "https://www.atlantanewsfirst.com/2026/10/19/more-than-1-million-votes-cast-georgias-midterm-election-so-far/"},
    {"date": "2026-10-13", "text": "Georgia's first day of early in-person voting drew more than 190,000 voters, over 53,000 above the first-day total in 2022, per the Georgia Secretary of State's office.", "source": "https://www.atlantanewsfirst.com/2026/10/19/more-than-1-million-votes-cast-georgias-midterm-election-so-far/"},
    {"date": "2026-10-17", "text": "AP counted about 6 million early and mail ballots cast across 39 states as of Thursday Oct 15; California (757,000+), Florida (~669,000), Virginia (604,000+), Michigan (~573,000) and Pennsylvania (391,000+) led.", "source": "https://www.fox10phoenix.com/news/no-kings-rallies-across-us-push-voting-early-heres-how-many-voters-already-have"},
    {"date": "2026-10-06", "text": "Michigan SOS press release: 'Four weeks before Election Day, mail ballot returns are up 30% over same point in 2022' (headline figure; release body not fetched).", "source": "https://www.michigan.gov/sos/resources/news/2026/10/06/four-weeks-before-election-day-mail-ballot-returns-are-up-30-over-same-point-in-2022"}
  ],
  "gaps": [
    "Early-voting calendars (earlyInPersonStart/End, mailRequestDeadline, mailReturnDeadline) are null for every state except Georgia's in-person dates: the session was stopped before fetching the Vote.org early voting calendar (https://www.vote.org/early-voting-calendar/), Vote.org absentee deadlines (https://www.vote.org/absentee-ballot-deadlines/) or NCSL's early in-person voting table (https://www.ncsl.org/elections-and-campaigns/early-in-person-voting). Next run should fetch one of these and fill all 51.",
    "final2022 (per state and national) is null: UF's 2022 tracker is on RPubs (https://rpubs.com/ElectProject/early_vote_2022), which WebFetch refused (not on allowlist); browser access to rpubs.com was granted but not used before the stop order. /data-downloads/earlyvote/2022/US.csv returns 404. pctOf2022Final therefore null; pctOf2022Turnout (vs total 2022 turnout, UF's own ratio) and pctOf2024Final are provided instead.",
    "Alabama and New Hampshire have no row in UF's US.csv; no early/mail counts were found for them this session.",
    "Missouri and New York have UF rows with all-zero counts (data_source 'TBD' / 'New York State Board of Elections', last_update 8/12/2026): no 2026 figures yet.",
    "National 'same point in 2022/2024' comparison: UF publishes none on the 2026 page; only the AP ~6M (Oct 15) figure and the Michigan +30% press-release headline were found. Day-by-day 2022/2024 series were not located.",
    "State official daily reports: URLs are taken from UF's data_source column and known agency pages; formats are marked 'not fetched this session' where not inspected. Pennsylvania (Socrata nbwd-pfn4), North Carolina (dl.ncsbe.gov CSVs) and Nevada (Vivid JSON) are the ones most likely to be machine-readable; Michigan, Kansas, Nebraska, Iowa, New Jersey, Colorado supply data to UF directly and no public daily file was confirmed.",
    "Georgia SOS 'record first day' press releases (https://sos.ga.gov/news/first-day-early-voting-sees-record-turnout, https://sos.ga.gov/news/georgians-shatter-first-day-early-voting-record) surfaced in search but were not fetched; the first-day figure here comes from Atlanta News First citing the SOS.",
    "Party breakdown for the national total covers only the 27 party-registration states (11.6M of 23.6M votes); GA, TX, MI, OH, VA, WI, MN publish no party registration.",
    "Texas, Florida, Georgia, Nevada show updates_today of 3-4, meaning UF refreshed them several times on 10/23; numbers in this file are the 5:44 p.m. ET state of US.csv."
  ]
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
print("wrote", OUT)
print("national", nat, "final2024_national", final2024_national)
