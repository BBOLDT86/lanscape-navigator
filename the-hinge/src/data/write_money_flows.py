# Curated money flows for the Money tab's diagram and ledger: one figure per flow, with its basis and source.
# Every amount is looked up in the research files (money_*.json) so each link carries the same URL and date
# as the research; nothing here is a new number except sums that are labeled as sums.
import json, os, re, glob
DD = os.path.dirname(os.path.abspath(__file__)) + "/"
R = {}
NAT = json.load(open(DD + "money_national.json"))
for f in [x for x in glob.glob(DD + "money_*.json") if not x.endswith("money_flows.json")]:
    for r in json.load(open(f)).get("races", []):
        R[r["race_id"]] = r


def find_out(race, pat, amount=None):
    for o in R.get(race, {}).get("outside_spending", []):
        if re.search(pat, o.get("group") or "", re.I) and (amount is None or (o.get("amount") and abs(o["amount"] - amount) < 1)):
            return o
    raise KeyError((race, pat, amount))


def find_ad(race, side=None, amount=None):
    for o in R.get(race, {}).get("ad_spending", []):
        if (side is None or o.get("side") == side) and (amount is None or (o.get("amount") and abs(o["amount"] - amount) < 1)):
            return o
    raise KeyError((race, side, amount))


def find_donor(pat, amount):
    for x in NAT["donors"]:
        if re.search(pat, x.get("donor") or "", re.I) and x.get("amount") and abs(x["amount"] - amount) < 1:
            return x
    raise KeyError((pat, amount))


def group(pat):
    for g in NAT["groups"]:
        if re.search(pat, g["group"], re.I):
            return g
    raise KeyError(pat)


nodes, links = [], []
MUSK_NOTE = "Amount from summaries of the Times’s Oct 12 report (Time News, Memesita); not confirmed by the Times article itself, another major outlet or FEC filings. The itemized gifts add up to the Times’s $276M headline, and the Daily Beast names the same recipients without amounts."


SHORT = {"slf": "SLF + One Nation", "texaspac": "Texas PAC", "maga": "MAGA Inc. + NGB", "america": "America PAC", "afp": "AFP Action", "vpac": "V-PAC",
         "clf": "CLF", "otherR": "Other R groups", "smp": "SMP + WinSenate", "hmp": "HMP (House)", "lsr": "Lone Star Rising", "votevets": "VoteVets",
         "otherD": "Other D groups", "OH-SP": "Ohio Senate", "TX-S": "Texas", "ME-S": "Maine", "MI-S": "Michigan", "NC-S": "N. Carolina", "GA-S": "Georgia",
         "IA-S": "Iowa", "NH-S": "N. Hampshire", "AK-S": "Alaska", "OH-GOV": "Ohio governor", "MN-S": "Minnesota", "KS-S": "Kansas", "NE-S": "Nebraska", "HOUSE": "House races"}


def node(id, label, col, side, note=None):
    nodes.append(dict(id=id, label=label, col=col, side=side, note=note, short=SHORT.get(id)))


def L(s, t, v, basis, src=None, entry=None, note=None, side=None, as_of=None, url=None, unconfirmed=False):
    e = entry or {}
    d = dict(s=s, t=t, v=round(v), basis=basis, asOf=as_of or e.get("as_of"), src=src or e.get("source"), url=url or e.get("url"), note=note, side=side)
    if unconfirmed:
        d["unconfirmed"] = True
    links.append(d)


# ------------------------------------------------------------------ groups (middle column)
node("slf", "Senate Leadership Fund + One Nation", 1, "R", "The main Republican Senate super PAC and its affiliated nonprofit, which does not disclose donors.")
node("texaspac", "Texas PAC", 1, "R", "Pro-Paxton super PAC described in coverage as linked to Senate Leadership Fund and Majority Leader John Thune; its donors were not itemized in the sources found.")
node("maga", "MAGA Inc. + No Going Back", 1, "R", "The Trump-aligned super PAC and No Going Back PAC, which Reuters describes as closely tied to it.")
node("america", "America PAC (Musk)", 1, "R", "Elon Musk’s super PAC.")
node("afp", "AFP Action", 1, "R", "Americans for Prosperity’s super PAC (Koch network).")
node("vpac", "V-PAC (backs Ramaswamy)", 1, "R")
node("clf", "Congressional Leadership Fund", 1, "R", "The main Republican House super PAC.")
node("otherR", "Other Republican-aligned groups", 1, "R")
node("smp", "Senate Majority PAC + WinSenate", 1, "D", "The main Democratic Senate super PAC and its affiliate; Majority Forward is its nonprofit arm, which does not disclose donors.")
node("hmp", "House Majority PAC", 1, "D", "The main Democratic House super PAC.")
node("lsr", "Lone Star Rising (backs Talarico)", 1, "D")
node("votevets", "VoteVets", 1, "D")
node("otherD", "Other Democratic-aligned groups", 1, "D")

# ------------------------------------------------------------------ donors (left column)
node("musk", "Elon Musk", 0, "R", "The New York Times reported on Oct 12 that Musk has given more than $276M to Republican groups and his own super PAC since July. How that splits among the groups shown here comes from summaries of the Times report (Time News, Memesita), not from the Times article itself, another major outlet or FEC filings; the groups’ reports due Oct 15 will show the filed amounts.")
node("onenation", "One Nation (donors undisclosed)", 0, "R", "Transfers from One Nation, a nonprofit that does not disclose donors, to Senate Leadership Fund.")
node("aan", "American Action Network (donors undisclosed)", 0, "R")
node("yass", "Jeff Yass", 0, "R")
node("adelson", "Miriam Adelson", 0, "R")
node("brockman", "Greg & Anna Brockman", 0, "R")
node("hendricks", "Diane Hendricks", 0, "R")
node("warren", "Kelcy Warren", 0, "R")
node("a16z", "Marc Andreessen & Ben Horowitz", 0, "R", "Most of their $115M went to AI and crypto super PACs that back both parties; only their MAGA Inc. gift feeds a group shown here.")
node("isaacman", "Jared Isaacman", 0, "R")
node("majfwd", "Majority Forward (donors undisclosed)", 0, "D", "Transfers from Majority Forward, a nonprofit that does not disclose donors, to Senate Majority PAC.")
node("hmf", "House Majority Forward (donors undisclosed)", 0, "D")
node("hoffman", "Reid Hoffman", 0, "D")
node("others", "All other donors (latest FEC filings)", 0, "X", "Everything else each group reported raising through its latest filing (June 30 or Aug 31), minus the named gifts shown.")

# ------------------------------------------------------------------ races (right column)
RACES = [("OH-SP", "Ohio Senate (special)"), ("TX-S", "Texas Senate"), ("ME-S", "Maine Senate"), ("MI-S", "Michigan Senate"), ("NC-S", "North Carolina Senate"),
         ("GA-S", "Georgia Senate"), ("IA-S", "Iowa Senate"), ("NH-S", "New Hampshire Senate"), ("AK-S", "Alaska Senate"), ("OH-GOV", "Ohio governor"),
         ("MN-S", "Minnesota Senate"), ("KS-S", "Kansas Senate"), ("NE-S", "Nebraska Senate"), ("HOUSE", "House battlegrounds")]
for rid, lab in RACES:
    node(rid, lab, 2, "X")

# ------------------------------------------------------------------ donor -> group
slf = group(r"^Senate Leadership Fund"); maga = group(r"^MAGA Inc"); smp = group(r"^Senate Majority PAC"); hmp = group(r"^House Majority PAC"); clf = group(r"^Congressional Leadership Fund"); amer = group(r"^America PAC")
m158 = find_donor(r"^Elon Musk$", 158000000); m76 = find_donor(r"^Elon Musk$", 76000000); m5v = find_donor(r"^Elon Musk$", 5000000)
on = find_donor(r"^One Nation", 70740000); aan = find_donor(r"^American Action Network", 44200000); mf = find_donor(r"^Majority Forward", 61000000); hmf = find_donor(r"^House Majority Forward", 21700000)
L("musk", "slf", 158e6, "gifts since July, as reported Oct 12", entry=m158, note=MUSK_NOTE, unconfirmed=True)
L("onenation", "slf", 70.74e6, "nonprofit transfers to the super PAC, cycle through the July filing", entry=on)
L("others", "slf", slf["raised"] - 70.74e6, "all other money raised through June 30 (FEC), minus One Nation’s transfers", src="FEC", url=slf.get("url"), as_of=slf.get("as_of"))
L("musk", "america", 76e6, "gifts since July, as reported Oct 12", entry=m76, note=MUSK_NOTE, unconfirmed=True)
L("musk", "america", amer["raised"], "raised through June 30 (FEC); the NYT’s Aug 28 ranking attributes the same $50.3M to Musk", src="FEC", url=amer.get("url"), as_of=amer.get("as_of"))
for pat, who, amt in [(r"Adelson", "adelson", 25e6), (r"Brockman", "brockman", 25e6), (r"Hendricks", "hendricks", 25e6), (r"Warren", "warren", 25e6), (r"Andreessen", "a16z", 12e6), (r"Isaacman", "isaacman", 10e6)]:
    d = next(x for x in NAT["donors"] if re.search(pat, x["donor"]))
    L(who, "maga", amt, "gift to MAGA Inc. reported in coverage of FEC filings", entry=d,
      note=("Wikipedia’s MAGA Inc. page lists $12.5M from Warren in the first half of 2025; the two figures have not been reconciled." if who == "warren" else None))
yass = next(x for x in NAT["donors"] if x["donor"] == "Jeff Yass")
L("yass", "maga", 16e6, "gifts to MAGA Inc. in the first half of 2025 (per Wikipedia, citing FEC)", entry=yass, url="https://en.wikipedia.org/wiki/MAGA_Inc.", src="Wikipedia, citing FEC")
named_maga = 25e6 * 4 + 12e6 + 10e6 + 16e6
L("others", "maga", maga["raised"] - named_maga, "all other money raised through Aug 31 (FEC), minus the named gifts", src="FEC", url=maga.get("url"), as_of=maga.get("as_of"))
L("yass", "vpac", 20e6, "gift to the pro-Ramaswamy super PAC (Forbes)", entry=yass, url=yass.get("corroborating_url"), src="Forbes")
L("musk", "vpac", 5e6, "gift reported in a summary of the Times’s Oct 12 report; date not stated", entry=m5v, note="Appears only in Time News’s summary of the Times report. Not yet confirmed by a filing or a major outlet.", unconfirmed=True)
L("aan", "clf", 44.2e6, "nonprofit transfers to the super PAC, cycle through the July filing", entry=aan)
L("others", "clf", clf["raised"] - 44.2e6, "all other money raised through June 30 (FEC), minus AAN’s transfers", src="FEC", url=clf.get("url"), as_of=clf.get("as_of"))
L("majfwd", "smp", 61e6, "nonprofit transfers to the super PAC, cycle through the July filing", entry=mf)
L("others", "smp", smp["raised"] - 61e6, "all other money raised through June 30 (FEC), minus Majority Forward’s transfers", src="FEC", url=smp.get("url"), as_of=smp.get("as_of"))
L("hmf", "hmp", 21.7e6, "nonprofit transfers to the super PAC, cycle through the July filing", entry=hmf)
L("others", "hmp", hmp["raised"] - 21.7e6, "all other money raised through Aug 31 (FEC), minus House Majority Forward’s transfers through June 30", src="FEC", url=hmp.get("url"), as_of=hmp.get("as_of"), note="House Majority Forward had given $45.2M by the Times’s Aug 28 count, so up to about $23.5M of this band may also be its money.")
hof = next(x for x in NAT["donors"] if x["donor"] == "Reid Hoffman")
L("hoffman", "lsr", hof["amount"], "gift to the pro-Talarico super PAC", entry=hof)

# ------------------------------------------------------------------ group -> race (one commitment per group per race)
SP = "spent to date"
L("slf", "OH-SP", 93e6, "total announced commitment (reservations); One Nation’s Ohio ads come on top and were not totaled", entry=find_out("OH-SP", r"^Senate Leadership Fund", 93e6))
L("slf", "NC-S", 30e6, "spent to date (more than $30M); it pulled its remaining North Carolina reservations on Oct 2, canceled per The New York Times, paused per AP and CBS", entry=find_out("NC-S", r"^Senate Leadership Fund", 30e6))
ga1 = find_out("GA-S", r"Senate Leadership Fund \+ One Nation", 25.9e6)
L("slf", "GA-S", 25.9e6 + 17.3e6, "spent ($25.9M, SLF and One Nation) plus remaining TV reservations ($17.3M); both figures from the Collins campaign", entry=ga1)
L("slf", "ME-S", 42e6 + 30e6, "announced: SLF $42M plus One Nation $30M", entry=find_out("ME-S", r"^Senate Leadership Fund", 42e6))
L("slf", "NH-S", 17e6 + 6e6, "pledged: SLF $17M plus One Nation’s $6M buy", entry=find_out("NH-S", r"^Senate Leadership Fund", 17e6))
L("slf", "MI-S", 22e6 + 17.5e6, "spent (about $22M, FEC) plus October–November reservations ($17.5M)", entry=find_out("MI-S", r"^Senate Leadership Fund", 22e6), note="SLF announced a $51M Michigan commitment in September (Axios, Sept 16).")
L("slf", "AK-S", 15e6, "announced plan", entry=find_out("AK-S", r"^Senate Leadership Fund", 15e6))
L("slf", "IA-S", 29e6 + 11e6, "fall reservation ($29M) plus One Nation’s planned $11M", entry=find_out("IA-S", r"^Senate Leadership Fund", 29e6))
L("texaspac", "TX-S", 131e6, SP + " (federal filings)", entry=find_out("TX-S", r"^Texas PAC", 131e6))
L("maga", "TX-S", 24e6, SP, entry=find_out("TX-S", r"^MAGA Inc", 24e6))
L("maga", "MI-S", 13e6 + 9.9e6, "No Going Back: spent (more than $13M, FEC) plus reservations ($9.9M)", entry=find_out("MI-S", r"^No Going Back", 13e6))
L("maga", "OH-SP", 13.4e6, "No Going Back: ad spending (AdImpact)", entry=find_out("OH-SP", r"^No Going Back", 13.4e6))
L("maga", "NC-S", 8e6, "No Going Back: close to $8M in September", entry=find_out("NC-S", r"^No Going Back", 8e6))
L("america", "TX-S", 6.3e6, "independent expenditures (FEC)", entry=find_out("TX-S", r"^America PAC", 6.3e6))
L("america", "MI-S", 3.9e6, "independent expenditures (FEC)", entry=find_out("MI-S", r"^America PAC", 3.9e6))
L("america", "OH-SP", 3.7e6, "independent expenditures (FEC)", entry=find_out("OH-SP", r"^America PAC", 3.7e6))
L("america", "ME-S", 0.17e6, "independent expenditures (FEC)", entry=find_out("ME-S", r"^America PAC", 170000))
L("afp", "OH-SP", 15e6, "reported total for the cycle", entry=find_out("OH-SP", r"^Americans for Prosperity Action", 15e6))
L("afp", "NC-S", 1.05e6, "spent Aug 1–Sept 22", entry=find_out("NC-S", r"^Americans For Prosperity", 1050000))
L("vpac", "OH-GOV", 25e6, "at least $25M for a series of attack ads (announced in June)", entry=find_out("OH-GOV", r"^V-PAC", 25e6))
L("otherR", "NC-S", 14.5e6, "Old North Action: reservations after its October cut", entry=find_out("NC-S", r"^Old North Action", 14.5e6))
L("otherR", "ME-S", 9e6, "Pine Tree Results: spent so far", entry=find_out("ME-S", r"^Pine Tree", 9e6))
L("otherR", "TX-S", 15e6, "Lone Star Liberty PAC: ad effort launched in September", entry=find_out("SENATE", r"^Lone Star Liberty", 15e6))
L("otherR", "MI-S", 59.3e6 - 22e6 - 13e6 - 3.9e6, "all Republican-aligned groups’ spending (FEC, $59.3M) minus SLF, No Going Back and America PAC", entry=find_out("MI-S", r"^All Republican-aligned", 59.3e6), note="Includes about $10M from the Great Lakes Conservatives Fund (Axios, Sept 16).")
L("otherR", "GA-S", 2e6 + 4.5e6, "a Trump-aligned super PAC ($2M) and Susan B. Anthony Pro-Life America ($4.5M, announced in 2025)", entry=find_out("GA-S", r"^Trump-aligned", 2e6))
L("otherR", "OH-SP", 3e6, "Ohio Flyer PAC and Buckeyes PAC, one week in mid-September", entry=find_out("OH-SP", r"^Ohio Flyer", 3e6))
L("otherR", "AK-S", 0.6e6 + 0.152e6, "Last Frontier PAC ($600K from Sept 29) and Fair Deal Alaska ($152K against Peltola, July 30–Aug 8, before the top-four primary)", entry=find_out("AK-S", r"^Last Frontier", 0.6e6))
L("clf", "HOUSE", 175e6, "announced fall reservations", entry=find_out("HOUSE", r"^Congressional Leadership Fund", 175e6), note="Separately, AdImpact counts $11.2M of CLF ad spending in Michigan’s 7th District this cycle (WKAR).")
L("smp", "OH-SP", 64e6, "TV reservations announced", entry=find_out("OH-SP", r"^Senate Majority PAC", 64e6))
L("smp", "NC-S", 42e6, "announced commitments (WinSenate’s spending counts toward them)", entry=find_out("NC-S", r"^Senate Majority PAC", 42e6))
L("smp", "ME-S", 33.4e6, "initial TV reservation", entry=find_out("ME-S", r"^Senate Majority PAC", 33.4e6))
L("smp", "MI-S", 30e6, "commitment announced (WinSenate’s $16.2M reservation is part of the Democratic total)", entry=find_out("MI-S", r"^Senate Majority PAC", 30e6))
L("smp", "IA-S", 13.4e6 + 17e6, "TV reservation ($13.4M) plus a later TV and radio investment ($17M)", entry=find_out("IA-S", r"^Senate Majority PAC", 13.4e6))
L("smp", "GA-S", 20e6, "initial fall TV reservation", entry=find_out("GA-S", r"^Senate Majority PAC", 20e6))
L("smp", "AK-S", 10.6e6, "initial TV reservation", entry=find_out("AK-S", r"^Senate Majority PAC", 10.6e6))
L("smp", "NH-S", 10.2e6, "initial TV reservation", entry=find_out("NH-S", r"^Senate Majority PAC", 10.2e6))
L("hmp", "HOUSE", 284e6, "announced TV and digital reservations", entry=find_out("HOUSE", r"^House Majority PAC", 284e6), note="Separately, AdImpact counts $12.2M of House Majority PAC ad spending in Michigan’s 7th District this cycle (WKAR).")
L("lsr", "TX-S", 3.7e6, "ad spending to mid-September; the PAC calls its fall effort “eight-figure”", entry=find_out("TX-S", r"^Lone Star Rising", 3.7e6))
L("votevets", "AK-S", 0.225e6, "ad buy on Aug 11, described as the start of a larger campaign; Alaska’s top-four primary on Aug 18 advanced both candidates", entry=find_out("AK-S", r"^VoteVets", 225000))
L("otherD", "NC-S", 0.624e6, "Planned Parenthood Votes North Carolina", entry=find_out("NC-S", r"^Planned Parenthood", 624000))
L("otherD", "ME-S", 0.6e6, "Planned Parenthood Votes", entry=find_out("ME-S", r"^Planned Parenthood", 600000))
L("otherD", "AK-S", 0.574e6, "Right For Alaska, against Sullivan, July 30–Aug 7, before the top-four primary", entry=find_out("AK-S", r"^Right For Alaska", 574000))
L("slf", "KS-S", 9.8e6, "reserved as of Oct 2 (AdImpact via CBS); AP puts the next-month reservation at $8.2M", entry=find_out("KS-S", r"^Senate Leadership Fund", 9.8e6))
L("otherR", "KS-S", 0.5e6, "other pro-Marshall groups, airtime for the month from Oct 2 (AdImpact via AP)", entry=find_out("KS-S", r"^Other pro-Marshall", 500000))
lcn = find_out("KS-S", r"^Lower Costs Now", 700000); pop = find_out("KS-S", r"^People over Politics", 313000)
L("otherD", "KS-S", 0.7e6 + 0.313e6, "Lower Costs Now ($700K, Oct 1) and People over Politics Action Fund (about $313K booked)", entry=lcn)
L("otherR", "NE-S", 2e6, "Win It Back PAC: announced statewide campaign against Osborn", entry=find_out("NE-S", r"^Win It Back", 2e6))

# ------------------------------------------------------------------ per-race ad totals for the ledger
def adinfo(rid, total=None, d=None, r=None, basis="", entry=None, headline=None, kind="senate", label=None):
    e = entry or {}
    return dict(adTotal=total, adD=d, adR=r, adBasis=basis, adAsOf=e.get("as_of"), adSrc=e.get("source"), adUrl=e.get("url"), headline=headline, kind=kind, **({"label": label} if label else {}))


races = {
    "OH-SP": adinfo("OH-SP", 250e6, None, None, "spent through Sept 30; $140M more reserved", find_ad("OH-SP", "total", 250e6), "The most expensive race of 2026"),
    "TX-S": adinfo("TX-S", 259e6, 67e6 + 3.7e6, 175e6 + 20e6, "general election through Sept 30; the sides come from Oct 5 reports (Lone Star Rising’s from Sept 17), so they add to more than the total", find_ad("TX-S", "total", 259e6)),
    "ME-S": adinfo("ME-S", 137.6e6, 55.5e6, 82.1e6, "TV since July 26, through Sept 17", find_ad("ME-S", "total", 137.6e6)),
    "MI-S": adinfo("MI-S", 59e6 + 43.8e6, 43.8e6, 59e6, "spent to about Oct 1; $65M more reserved", find_ad("MI-S", "R", 59e6)),
    "NC-S": adinfo("NC-S", 53e6 + 44e6, 44e6, 53e6, "September only", find_ad("NC-S", "R", 53e6)),
    "IA-S": adinfo("IA-S", 90e6, None, None, "through September", find_ad("IA-S", "total", 90e6)),
    "AK-S": adinfo("AK-S", 45e6 + 32e6, 32e6, 45e6, "reserved Aug 1 through Election Day", find_ad("AK-S", "R", 45e6)),
    "NH-S": adinfo("NH-S", 27e6 + 15.9e6, 15.9e6, 27e6, "TV through Sept 14", find_ad("NH-S", "R", 27e6)),
    "OH-GOV": adinfo("OH-GOV", 83e6, None, None, "spent through Sept 22", find_ad("OH-GOV", "total", 83e6), "Ramaswamy’s side outspent Acton’s more than 3 to 1 (NYT, Oct 5)", kind="gov"),
    "GA-S": adinfo("GA-S", None, None, None, "general-election totals not found"),
    "MN-S": adinfo("MN-S", None, None, None, "general-election totals not found"),
    "SENATE": adinfo("SENATE", 3.4e9, None, None, "AdImpact projection for all Senate races, 2025–26", find_ad("SENATE", "total", 3.4e9), kind="national", label="Senate control (all Senate races)"),
    "HOUSE": adinfo("HOUSE", 2.0e9, None, None, "AdImpact projection for all House races, 2025–26", find_ad("HOUSE", "total", 2.0e9), kind="national", label="House control (all House races)"),
    "FL-25": adinfo("FL-25", 42.2e6, None, None, "spent and reserved, Aug 1 through Election Day", find_ad("FL-25", "total", 42.2e6), kind="house"),
    "NC-01": adinfo("NC-01", 38.8e6, None, None, "spent and reserved, Aug 1 through Election Day", find_ad("NC-01", "total", 38.8e6), kind="house"),
    "IA-01": adinfo("IA-01", 37.4e6, None, None, "spent and reserved, Aug 1 through Election Day", find_ad("IA-01", "total", 37.4e6), kind="house"),
    "MI-07": adinfo("MI-07", 35.4e6, 14.9e6, 17.7e6, "spent and reserved, Aug 1 through Election Day; the split by side covers a window not stated and adds to $32.6M", find_ad("MI-07", "total", 35.4e6), kind="house"),
    "NY-17": adinfo("NY-17", 32.7e6, 7.5e6, 18.2e6, "spent and reserved, Aug 1 through Election Day; split from Sept 1", find_ad("NY-17", "total", 32.7e6), kind="house"),
    "WI-03": adinfo("WI-03", 31.6e6, None, None, "spent and reserved, Aug 1 through Election Day", find_ad("WI-03", "total", 31.6e6), kind="house"),
}
races["KS-S"] = adinfo("KS-S", 11.0e6 + 1.146e6, 1.146e6, 11.0e6, "airtime reserved for the month from Oct 2 (AdImpact via AP)", find_ad("KS-S", "R", 11.0e6))
races["NE-S"] = adinfo("NE-S", None, None, None, "totals not found")
for rid in ("OH-01", "OH-07", "OH-09", "OH-13"):
    races.setdefault(rid, adinfo(rid, None, None, None, "not found", kind="house"))
# district outside money: the House flows above go to "House battlegrounds" as a whole, so districts carry their own notes
hp = lambda rid, pat, amt: find_out(rid, pat, amt)
races["MI-07"].update(outD=12.2e6, outR=11.2e6, outBasis="House Majority PAC and Congressional Leadership Fund ad spending this cycle (AdImpact via WKAR)",
                      headline="Second only to Iowa’s 1st this cycle, primaries included: $51.5M (AdImpact via WKAR)")
races["IA-01"].update(headline="The most expensive House race of the cycle, primaries included (AdImpact via WKAR)",
                      outNote="American Action Network: more than $1M across Iowa’s 1st and 3rd Districts. Other groups’ amounts were not found.")
races["NC-01"].update(outNote="Congressional Leadership Fund reserved nearly $10M (The Center Square, undated), and a nonprofit, apparently American Action Network, bought $1.3M of ads against Davis. Democratic groups’ amounts were not found.")
races["FL-25"].update(outNote="Defending Our Values PAC has reported $857,426 backing Singer and Think Big $321,574 backing Moskowitz, cycle to date (FEC, via the Transformer tracker). House Majority PAC added nearly $5M in the Miami and West Palm Beach markets, not specific to this district.")
races["NY-17"].update(outNote="VoteVets spent $1M for Conley before the June primary. General-election spending by named groups was not found.")
races["WI-03"].update(outNote="AdImpact counted more than $15M from Cooke and her backers by Sept 15 (period not stated) and $3M reserved by Van Orden’s campaign alone after his Aug 11 primary (as of Aug 27). Republican groups’ amounts, and group-by-group figures on either side, were not found.")
races["OH-01"].update(outNote="House Majority PAC reserved $1.9M of TV and digital time in April for the fall (Signal Ohio). Republican-side and DCCC spending were not found.")
races["OH-07"].update(outNote="A new Democratic group, Affordable Ohio, spent $131,700 in one July week in the Cleveland market, the race’s first ad money (Medium Buying, via Andrew Tobias). Other spending was not found.")
races["OH-09"].update(outNote="House Majority PAC reserved $3M of TV and digital time in April for the fall (Signal Ohio). Congressional Leadership Fund posted about Kaptur’s ad, but no Republican-side spending figure was found.")
races["OH-13"].update(outNote="House Majority PAC reserved $1.175M of TV and digital time in April for the fall (Signal Ohio). Republican-side and DCCC spending were not found.")
hp("MI-07", r"^House Majority PAC", 12.2e6); hp("MI-07", r"^Congressional Leadership Fund", 11.2e6)

# short context for each race card, condensed from the research notes (sources named in the text)
STORY = {
    "SENATE": "Senate Leadership Fund, Senate Majority PAC and America PAC file quarterly, so their July–September money appears with the Oct 15 reports. Entering July, Democratic candidates in seven key races held $74.7M in cash to Republicans’ $36.8M, while conservative super PACs outspent Democratic ones $310M to $174M from Labor Day to Sept 25 (CNBC).",
    "HOUSE": "Through Aug 31 the DCCC had out-raised the NRCC by about $0.9M this cycle, but the NRCC held about $13M more cash (FEC). House Majority PAC had $135.2M on hand at Aug 31; Congressional Leadership Fund’s last filed figure was $141.8M at June 30. House Majority PAC cut some planned buys in Nebraska’s 2nd and California’s 48th, and CLF was reported to be pulling out of Nebraska (Deseret News, Oct 6).",
    "TX-S": "Talarico’s campaign has far outspent Paxton’s on ads, but Republicans spent $122M on ads in September, all but $1.2M of it from outside groups, and more than 98% of the $205M-plus in general-election outside spending backed Paxton (Texas Tribune, Oct 1). Through September, Republicans had 72% of broadcast ad dollars but 54% of the ratings points those dollars bought (AdImpact).",
    "IA-S": "An open seat: Sen. Joni Ernst is retiring. Senate Majority PAC has committed more than $30M to Iowa TV, against a $29M Senate Leadership Fund reservation and $11M planned by One Nation. Ad spending passed $90M by the end of September (Iowa Capital Dispatch, citing the Washington Post).",
    "KS-S": "Senate Leadership Fund moved money into Kansas after pulling its North Carolina ads, which AP called a pause (AP; Semafor). For the month from Oct 2, pro-Marshall advertisers had reserved about $11.0M of airtime to about $1.15M on Hamilton’s side (AdImpact via AP).",
    "NE-S": "No Democrat is on the ballot (Nebraska Examiner), so Osborn, an independent, faces Ricketts head to head. Dollar figures for most groups in the race were not reported; The Wall Street Journal, via Raw Story, says a new Republican super PAC has reserved more airtime than any other advertiser (AdImpact).",
    "MI-S": "More than $205M had been disclosed in the race, about $157M of it from outside groups, primary included (Bridge Michigan, Oct 2). AIPAC’s United Democracy Project spent about $20.1M against El-Sayed in the August primary (Newsweek, citing FEC filings) but reported no general-election spending.",
    "AK-S": "Of more than $31M in independent spending since the Aug 18 primary, groups backing Sullivan outspent those backing Peltola by nearly $7M (Alaska Public Media, Oct 2). The NRSC asked donors for an extra $1.2M for Alaska (Axios).",
    "MN-S": "Little outside money so far: outside groups had not stepped in as of late September, and both campaigns had bought TV time around news and football (MPR, Sept 21). In the DFL primary, Craig outspent Flanagan on ads $9.6M to $1.9M (AdImpact).",
    "OH-SP": "About $250M had been spent through Sept 30, with about $140M more reserved for October and November (AdImpact via Statehouse News Bureau). Other tallies differ by basis, from $197M by Sept 22 (Washington Post) to $298M (Reuters, Sept 18). No dollar split by party was found; AdImpact data show Republicans generally outspending Democrats (Statehouse News Bureau, Oct 9), and Brown’s campaign was the race’s top single advertiser at about $37.5M, with One Nation, a nonprofit allied with Senate Republicans, close behind (AdImpact via Deseret News). Issue-ad campaigns by nonprofits are not in the flow chart: One Nation’s amount was not given, and three environmental groups announced $9M of FirstEnergy ads aimed at Husted that E&E News calls “not explicitly an election ad.”",
    "OH-GOV": "Billionaires had given V-PAC $37M, more than 88% of its money, by mid-2026 (Ohio Capital Journal). The DGA-backed Ohioans for Lower Costs released its first ads for Acton on Aug 19 and booked TV time from Sept 8 (WVXU); its spending has not been disclosed. Candidate figures come from Ohio Secretary of State filings, not the FEC.",
    "NC-S": "Senate Leadership Fund pledged $71M in April, spent more than $30M, then pulled its remaining North Carolina reservations on Oct 2; The New York Times reported them canceled, while AP and CBS called it a pause. Old North Action cut $6.5M of its October reservations, and WinSenate trimmed $1.1M but still had $18.8M scheduled as of Oct 8. In September, Republicans outspent Democrats on ads $53M to $44M (AdImpact via Axios Raleigh).",
    "GA-S": "Ossoff held a large cash edge at June 30, $42.6M to Collins’s $2.1M (FEC). Republican groups vowed about $60M, but less had materialized by mid-September (Atlanta Journal-Constitution), and Georgia was the only competitive Senate race where Republicans were not outspending Democrats on September ads (Axios, via the AJC). Senate Majority PAC has reserved $20M but had announced no Georgia ads on its website as of Oct 12.",
    "ME-S": "Republicans led TV spending after Jackson’s nomination, $82.1M to $55.5M, but Democrats paid about $263 per rating point to Republicans’ $323, and reservations after Sept 15 narrowed the Republican edge in airtime to 7% (AdImpact via the Bangor Daily News). Graham Platner won the June 9 primary but withdrew; Troy Jackson was nominated at the July 25 state convention.",
    "NH-S": "Republicans led on TV, $27M to $15.9M, as of Sept 14 (AdImpact via New Hampshire Bulletin). About 81% of Pappas’s and 86% of Sununu’s itemized donations in their latest reports came from out of state (OpenSecrets). No ad from Sununu’s own campaign was found; Punchbowl reported that the NRSC was running joint ads for him.",
    "FL-25": "A newly redrawn seat that Trump won 54% to 45% inside the new lines. First in AdImpact spending among House races from Aug 1 (Punchbowl, Oct 6); spending to date rose from $8.4M to $14M in the week ending Oct 6 (Washington Post).",
    "NC-01": "Second in AdImpact House spending from Aug 1 (Punchbowl, Oct 6). Davis had about twice Buckhout’s cash at June 30, $3.57M to $1.83M (FEC).",
    "IA-01": "Miller-Meeks won in 2024 by 799 votes. Third in AdImpact spending from Aug 1 but first for the whole cycle; about 98% of the money through May 10 came from outside groups (Wesleyan Media Project).",
    "MI-07": "Democrats lead for the cycle because of their contested primary, while the later-window split shows Republicans slightly ahead (Punchbowl). More than $39M of broadcast TV was booked in the Lansing–Jackson market by late September (WKAR).",
    "NY-17": "A district Kamala Harris won that a Republican holds. Fifth in AdImpact House spending from Aug 1 (Punchbowl, Oct 6), which says the Republican edge in bookings is partly exaggerated because Democrats buy airtime week to week.",
    "WI-03": "Sixth in AdImpact House spending from Aug 1 (Punchbowl, Oct 6). Cooke spent heavily before her Aug 11 primary ($6.78M spent, $1.83M cash at July 22) while Van Orden held $4.68M (FEC).",
}
for k, v in STORY.items():
    races.setdefault(k, adinfo(k, None, None, None, "not found")).update(story=v)

ctx = []
def agg(pat):
    return next(x for x in NAT["donors"] if x["donor"].startswith("AGGREGATE") and re.search(pat, x["donor"] + " " + (x.get("to") or ""), re.I))
a = agg(r"top 20"); ctx.append(dict(v="14 of 20", text="of the 20 biggest donors and donor groups gave only or almost only to Republican candidates and groups.", src=a["source"], url=a["url"]))
a = agg(r"Republican-leaning vs"); ctx.append(dict(v="$880M : $290M", text="from Republican-leaning and Democratic-leaning big donors in the first half of 2026, per a Washington Post analysis.", src=a["source"], url=a["url"]))
a = agg(r"affiliated nonprofits"); ctx.append(dict(v="$198M", text="moved into the four congressional super PACs through June 30 from affiliated nonprofits that don’t disclose their donors: One Nation $70.7M and American Action Network $44.2M on the Republican side, Majority Forward $61M and House Majority Forward $21.7M on the Democratic side.", src=a["source"], url=a["url"]))
cn = next(x for x in NAT["ad_totals"] if "conservative" in x["measure"]); cd = next(x for x in NAT["ad_totals"] if "Democratic" in x["measure"] and "Labor Day" in x["measure"])
ctx.append(dict(v="$310M : $174M", text="in super PAC spending from Labor Day to Sept 25, conservative and Democratic groups respectively (all spending, not only ads).", src=cn["source"], url=cn["url"]))
ctx.append(dict(v="$366M", text="from Musk to groups backing Republicans this cycle, by the Daily Beast’s reading of the Times; about $290M in 2024.", src="Daily Beast, citing the NYT (Oct 12)", url=find_donor(r"^Elon Musk$", 366000000)["url"]))

GAPS = [
    "Third-quarter filings (July–September) are due Oct 15, so most filed totals end June 30 or Aug 31, and only Musk’s reported gifts run later.",
    "How Musk’s reported $276M since July splits among groups, as filed.",
    "Ad spending split by party in the Ohio Senate and governor races, Iowa, Georgia, Minnesota, Nebraska and most House districts.",
    "Full scripts for most ads. Many were published only in part, and YouTube’s own captions could not be read for this pass.",
    "Scripts for Senate Leadership Fund’s newest ads, since its releases print none.",
    "Ads from Senate Majority PAC in Georgia, House Majority PAC anywhere, Sununu’s own campaign, either Nebraska campaign, either side in Ohio’s 1st, 7th and 13th Districts, the Republican side in Florida’s 25th and the Democratic side in North Carolina’s 1st.",
    "Group-by-group outside spending in most House districts.",
]
out = dict(nodes=nodes, links=links, races=races, context=ctx, gaps=GAPS,
           note="Left: documented gifts from the biggest donors (and, for each group, all its other reported money) to the groups spending in these races. Right: what each group has spent or reserved in each race. Band width is dollars. A group’s money in and money out need not match: the rest is in the bank or spent in other races. Bases differ (FEC filings through June 30 or Aug 31, gifts reported since, reservations and announced commitments) and every band says which on hover. Only Musk’s gifts run past June or August; the groups’ July–September money appears with the Oct 15 reports.",
           donorNote="Largest reported individual and corporate donors to federal races in 2025–26, cycle totals, colored by the side their money mostly backs. Musk’s bar is the Times’s $366M cycle tally (via the Daily Beast), $276M of it since July.")
json.dump(out, open(DD + "money_flows.json", "w"), ensure_ascii=False, indent=1)
print("nodes", len(nodes), "links", len(links), "races", len(races))
