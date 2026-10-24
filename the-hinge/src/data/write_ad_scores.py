# Ad summaries and scores for the Money tab, keyed by the stable ad id from build_money.py.
#
# RUBRIC (applied identically to both sides)
# Summaries quote each ad's central charge verbatim, whichever side it comes from, and add nothing the sources don't say.
# Swing pull, 0-10, from the published wording and news descriptions of the ad. Not scored: ads whose published wording
#   states none of their claims, and turnout appeals to a party's own supporters.
#   focus    0-3  one clear message carried through (3), a main message plus a second thread (2), several messages (1)
#   concrete 0-3  specific, checkable facts carry the ad: numbers, votes, records, the opponent's own words (3); one
#                 or two specific claims (2); mostly labels or assertions (1); no factual claims at all (0)
#   issues   0-2  the ad's main issue is one of the three issues most voters call very important to their vote in
#                 Pew's Sept 28-Oct 4 survey (2): the economy, including prices, jobs, taxes and wages (84%); the future
#                 of democracy (73%); health care, including Medicare and Medicaid (68%). Any other policy issue (1):
#                 Social Security, education, immigration, foreign policy and war, energy, crime, guns, abortion,
#                 ethics and corruption, gender policy, pandemic policy, job performance. No policy issue (0):
#                 character, personal or party-unity appeals only.
#   reach    0-2  aimed past the sponsor's base: a cross-party validator, a break with one's own party or a bipartisan
#                 record as the core message (2); some cross-pressure framing, or a nonpartisan hook such as a
#                 testimonial or pocketbook appeal (1); a partisan label, party tie or base cue as the hook (0).
#                 Labels count the same in both directions: "liberal", "socialist" or "extremist" on one side,
#                 "in lockstep with Trump" or "for you, not Trump" on the other. A label used only as an adjective
#                 before a nonpartisan hook (e.g. "liberal Josh Turek doesn't bother showing up for work") does not
#                 set reach to 0.
# Accuracy, 0-10: from an independent fact-check, newsroom ad watch or records-based news report on the ad's main claim,
#   or on the same claim made elsewhere by the same side (the candidate or an allied group), when the check gives a
#   verdict or a clear finding. Ads whose wording was never published are not graded. PolitiFact: True 10, Mostly
#   True 8, Half True 5, Mostly False 3, False 1, Pants on Fire 0. Other findings map to the same steps: supported 10,
#   largely supported 8, mixed or misleading without context 5, largely contradicted 3, contradicted or false 1.
# Money behind it: dollars only (the page adds stakes from the live forecast). In order: the ad's own reported buy
#   (or the campaign it was reported as part of); else the sponsor's own total in that race; else not rated. A partial
#   figure for one platform (such as YouTube alone) does not count as the ad's buy, and combined figures for a
#   candidate "and allies" are not used for a single sponsor. "race" sets which forecast supplies the stakes when an
#   ad sits under the national Senate or House entry but runs in one state.
import json, os
DD = os.path.dirname(os.path.abspath(__file__)) + "/"

S = {}
TURNOUT = "Not scored: a turnout appeal to the party’s own supporters, not an ad built to persuade."
FRAGMENT = "Not scored: the only published words, “remember in November,” don’t state what the ad says."


def ad(id, summary, swing=None, acc=None, money=None, basis=None, race=None, head=None, swing_note=None):
    S[id] = dict(summary=summary,
                 swing=(dict(zip(("focus", "concrete", "issues", "reach"), swing)) if swing else None),
                 acc=acc, money=(dict(amount=money, basis=basis, race=race) if money else (dict(amount=None, basis=None, race=race) if race else None)))
    if head:
        S[id]["head"] = head
    if swing_note:
        S[id]["swingNote"] = swing_note


def A(score, rating, by, url, note=None):
    return dict(score=score, rating=rating, by=by, url=url, note=note)


# ------------------------------------------------------------------ national entries (party committees)
ad("senate-902f597d",
   "A national rallying call from the NRSC to Republican supporters: with Senate control decided on thin margins, “work your tail off,” because “we will win.” It is a mobilization message rather than an attack on a candidate.",
   None, head="A rallying call to Republican volunteers", swing_note=TURNOUT)
ad("senate-a9ee9c52",
   "A streaming-TV ad against Ohio’s Jon Husted: grocery bills already took a balancing act and now take “a magic trick,” and Husted “supported the tariffs that are jacking up prices” and “voted to raise health care costs and cut Medicaid.” It dates from Sept 2025, the newest DSCC ad found.",
   (2, 2, 2, 1), race="OH-SP")
ad("house-82e23511",
   "Congressional Leadership Fund introduces Democratic challenger JoAnna Mendoza in Arizona’s 6th District: “Her job — an extreme liberal lobbyist,” who “is not looking out for you.”",
   (3, 2, 1, 1), None, 2.9e6, "CLF’s reservation in Arizona’s 6th District, which this ad opened (AdImpact via Axios)", head="JoAnna Mendoza as a “liberal lobbyist”")
ad("house-cde96298",
   "An NRCC digital ad from early November 2025, run in 49 battleground districts, 29 of them held by Democrats: New York’s Zohran Mamdani “built his movement on defunding the police and abolishing ICE,” and “This is the future House Democrats want. And your city could be next.” It closes: “Stop socialism. Stop Democrats. Vote Republican.”",
   (3, 1, 1, 0), head="Mamdani as the Democrats’ future")
ad("house-8fe55b1c",
   "A DCCC digital ad marking 100 days to the midterms, run against 25 Republican-held districts, that urges viewers to “remember in November.” Coverage quotes only that line.",
   None, head="“Remember in November”", swing_note=FRAGMENT)
# ------------------------------------------------------------------ Texas
ad("tx-s-8e29b848",
   "Talarico speaks to camera to answer attacks on his record (“No, I’m not a member of the Chinese Communist Party. No, I don’t support sex-change surgeries for kids”), then criticizes Paxton: “I don’t have to use AI because the truth about Ken Paxton is bad enough.”",
   (2, 1, 1, 1), None, 67e6, "the Talarico campaign’s general-election ad spending through Oct 5 (Texas Tribune)", head="Talarico answers the attacks")
ad("tx-s-d8edcaf9",
   "Former Republican state Rep. Glenn Rogers, who voted to impeach Paxton in 2023, says: “I’ll never trust Ken Paxton, I’ll never support Ken Paxton and the last place he should be is the United States Senate.”",
   (3, 0, 1, 2), None, 3.7e6, "Lone Star Rising’s ad spending in the race to mid-September (AdImpact)", head="A Republican who voted to impeach Paxton")
ad("tx-s-9953a571",
   "Paxton’s daughter, Mattie Hayworth, says “My dad has never backed down from a fight, especially when it comes to standing up for families,” and that when “liberal politicians” come after voters, “my dad goes after them to bring down prices.” Images of Rep. Alexandria Ocasio-Cortez and Talarico appear.",
   (2, 1, 2, 0), None, 20e6, "the Paxton campaign’s general-election ad spending through Oct 5 (Texas Tribune)", head="Paxton’s daughter on her father")
ad("tx-s-9d0db337",
   "State Sen. Angela Paxton, who filed for divorce from Ken Paxton in 2025, never names him; she says the general election is about “getting the whole team across the finish line” and “That’s why I’m voting for the Republican ticket on November 3rd.”",
   (3, 0, 0, 0), None, 131e6, "Texas PAC’s spending in the race to date (federal filings)", head="Angela Paxton on the Republican ticket")
# ------------------------------------------------------------------ Iowa
ad("ia-s-301b816a",
   "A positive record ad: lower-cost bills, tax cuts and gun-rights protections are “just some of the more than 700 times Josh Turek voted with Republicans,” and in the Senate he “will work with anyone to clean up corruption and secure the border, including President Trump.”",
   (3, 3, 2, 2))
ad("ia-s-2c871530",
   "Senate Majority PAC says Hinson has “missed nearly 200 votes in Congress,” including “votes to crack down on child pornography, reduce crime, and lower health care costs,” wrote a law that gives “massive tax breaks to her own family’s business,” and grew her net worth “by up to ten times.”",
   (2, 3, 1, 1), None, 1.45e6, "the ad’s reported buy (a $1.45M TV and digital campaign)", head="Hinson’s missed votes and net worth")
ad("ia-s-a32e05c6",
   "Hinson’s campaign says “Liberal Josh Turek doesn’t bother showing up for work” and plays his recorded words: “I ended up missing about 50 percent of the votes in the Iowa legislature this year … I don’t know if that necessarily matters to Iowans.”",
   (3, 3, 1, 1),
   A(8, "Largely supported", "Media Bias/Fact Check (citing PolitiFact)", "https://mediabiasfactcheck.com/fact-check-did-josh-turek-miss-58-of-iowa-house-votes-in-2026/",
     "The ad’s figure comes from Turek’s own words, and a related Hinson claim, that he missed 58% of Statehouse votes this year, was rated True. The ad’s line that “he thinks you don’t care” was not checked."),
   1e6, "the ad’s reported buy (“seven figures,” per the campaign)")
ad("ia-s-71915dea",
   "Senate Leadership Fund says “Liberal politician Josh Turek supports amnesty for illegals,” followed by a clip of Turek saying “We need an easier pathway to citizenship.”",
   (3, 3, 1, 1), A(5, "Half True", "PolitiFact", "https://politifact.com/factchecks/2026/oct/07/senate-leadership-fund/fact-checking-gop-ad-in-iowa-senate-race-does-josh-turek-support-amnesty-for-immigrants/"),
   29e6, "Senate Leadership Fund’s fall reservation in Iowa")
# ------------------------------------------------------------------ Kansas
ad("ks-s-6bbdd58d",
   "A former patient, Meischa Zimmerman, says “Roger Marshall preyed on the low-income families of Kansas”; news reports describe her account of being arrested while pregnant over a missed $50 payment to the practice where he worked. Marshall’s lawyers call the ad defamatory.",
   (3, 2, 2, 1),
   A(5, "Mixed", "Kansas Reflector, citing court records and The New York Times", "https://www.kcur.org/politics-elections-and-government/2026-09-29/roger-marshall-defamation-patient-arrested-adam-hamilton",
     "Court records show Marshall’s former practice took her to court over a medical debt of nearly $3,600, which she was paying off at about $50 a month. Her arrest was for failing to appear in court, the point Marshall’s lawyers stress. The Times reported that Marshall sued more than 700 patients for medical debt."),
   0.59e6, "the Hamilton campaign’s airtime reserved for the month from Oct 2 (AdImpact via AP); the ad’s own TV buy was not reported", head="A former patient on Marshall’s debt suits")
ad("ks-s-4f2b4575",
   "Marshall’s campaign says Hamilton, senior pastor of the Church of the Resurrection, failed to act on 2005 abuse allegations against a church volunteer: “Parents were ignored and Hamilton never called police.” Hamilton calls it dirty politics.",
   (3, 2, 1, 1),
   A(3, "Largely contradicted", "Kansas City Star investigation, via CBS News; Kansas News Service", "https://cbsnews.com/news/senate-gop-group-kansas-north-carolina-midterms",
     "Church leaders reported the volunteer to police in 2006, after he was identified; the Star’s review of court records backed Hamilton’s account. Hamilton says he should have gone to police after the 2005 incident."),
   1.2e6, "the ad’s reported buy", head="Hamilton and the 2005 abuse allegations")
ad("ks-s-314acef5",
   "Senate Leadership Fund calls Hamilton “a two-faced extremist,” faults his immigration record, says he founded “a radical group promoting the idea that all white people are racist,” and ties him to Democrats such as Kamala Harris and Hillary Clinton.",
   (1, 2, 1, 0), None, 9.8e6, "Senate Leadership Fund’s Kansas reservations as of Oct 2 (AdImpact via CBS News)", head="Hamilton as a “two-faced extremist”")
# ------------------------------------------------------------------ Nebraska
ad("ne-s-8b5c8e0b",
   "A 60-second testimonial: a rape survivor, Jody S., says “Pete Ricketts cast the deciding vote to pardon this man,” that she found out “just totally by accident,” and that because of the pardon her attacker “is now allowed to own a gun and had his name removed from the sex offender registry.”",
   (3, 3, 1, 1),
   A(8, "Largely supported", "New York Times ad watch", "https://dnyuz.com/?p=284913",
     "The board voted 2–1, with Ricketts in the majority; the pardon removed the man from the registry; the victim says she was not notified. The gun claim was not addressed. Ricketts notes the pardon came nearly three decades after the crime."),
   head="A survivor on Ricketts’s pardon vote")
ad("ne-s-ef64b02f",
   "Win It Back PAC calls Osborn “so liberal he’d give Social Security benefits to illegal aliens,” then plays clips of him saying “They’re our friends and neighbors. Let’s give ’em a damn Social Security card already” and “There definitely needs to be a clear path to citizenship too.” The release does not say when or where Osborn said these lines.",
   (3, 3, 1, 1), None, 2e6, "the ad’s reported buy (a $2M statewide campaign)")
# ------------------------------------------------------------------ Michigan
ad("mi-s-2b3d5f3c",
   "Michiganders say “Thirty years of Mike Rogers is killing us,” that he “Took a million from Big Pharma,” “Voted to keep prescription prices high” and is “The Opioid Industry Champion,” while El-Sayed, a doctor, “has never taken corporate money” and “canceled medical debt.”",
   (3, 3, 2, 1),
   A(5, "Mixed", "PolitiFact, checking the same claims in the Oct 7 debate", "https://politifact.com/article/2026/oct/08/michigan-senate-debate-fact-check-el-sayed-rogers/",
     "PolitiFact gave no rating. It found that Rogers “did use the word champion, in a specific context,” and that the $1 million figure appears to come from an analysis of OpenSecrets data counting industry PACs, employees’ donations and his leadership PAC."),
   2.3e6, "the statewide campaign this ad ran in that week (Semafor); the campaign did not state the ad’s own buy")
ad("mi-s-4370d711",
   "WinSenate says Rogers is “right in lockstep with Donald Trump every time,” that “Everything Trump’s done, Rogers has cheered for all of it,” and that he “doesn’t have the guts to put Michigan before Trump.” Its release ties the ad to Trump’s Iran war and tariffs.",
   (3, 1, 1, 0), None,
   16.2e6, "WinSenate’s Michigan reservation (AdImpact via Newsweek)")
ad("mi-s-b090023c",
   "Rogers breaks with President Trump on trade with Canada (“We need to end this tariff war now”), promises to “bring both parties together to lower your prices,” and says El-Sayed “wants to hit Michigan families with a $3,000 tax increase, the biggest in history.”",
   (2, 2, 2, 2), None, 1e6, "the ad’s reported buy (“seven-figure,” coordinated with the NRSC)", head="Rogers on the tariff war with Canada")
ad("mi-s-7600197d",
   "Senate Leadership Fund’s newest Michigan ad (Oct 12). Its release says El-Sayed took more than $1.2M from a donor network that SLF links to radical Islamist groups; the ad’s own wording was not published, and no fact-check of the claim was found.",
   None, None, 39.5e6, "Senate Leadership Fund’s Michigan spending plus its October–November reservations")
ad("mi-s-4203970c",
   "Senate Leadership Fund’s newest Michigan ad. Its release says El-Sayed “wants to defund and disarm police” and backs efforts to “get people out of jails and prisons”; the ad’s own wording was not published.",
   None, None, 39.5e6, "Senate Leadership Fund’s Michigan spending plus its October–November reservations")
# ------------------------------------------------------------------ Alaska
ad("ak-s-4e944977",
   "Peltola says she will “take on anyone, including Democrats,” who doesn’t understand what Alaska needs: resource development “is about our survival,” firearms are “for feeding our families and protecting ourselves,” and “a secure border keeps all Americans safe.” “When both parties are attacking you, you’re doing something right.”",
   (3, 1, 1, 2))
ad("ak-s-23c1cebc",
   "Senate Majority PAC says Sullivan “took thousands in cash from Epstein associates” and “voted to keep the files hidden from the public, even after he knew 14-year-old girls were raped,” and that “he protected the donors and his friends.”",
   (3, 2, 1, 1),
   A(5, "Mixed", "FactCheck.org, checking the same claims in a Peltola campaign ad", "https://factcheck.org/2026/08/alaska-senate-candidates-attempt-to-link-each-other-to-epstein",
     "Sullivan voted in Sept 2025 to table a Democratic amendment requiring release (51–49), then backed the Epstein Files Transparency Act with the rest of the Senate. FactCheck.org notes the donations came after that vote and that one donor “has never been accused of wrongdoing in connection with Epstein.” Media Bias/Fact Check rated the Peltola version Misleading."),
   10.6e6, "Senate Majority PAC’s initial Alaska TV reservation")
ad("ak-s-48d2bbf9",
   "Sullivan calls Peltola’s attacks “Desperate lies about me and my family,” says he “voted to force Trump’s DOJ to release the Epstein files” while “Mary Peltola took huge checks from Epstein’s associates,” and says she cashed in as a Washington lobbyist “after Alaskans fired her.”",
   (2, 2, 1, 1),
   A(5, "Mixed", "FactCheck.org, checking the same claims in August", "https://factcheck.org/2026/08/alaska-senate-candidates-attempt-to-link-each-other-to-epstein",
     "Sullivan did back the Epstein Files Transparency Act, which the whole Senate supported, though he had voted to table an earlier release amendment. On the donor claim, FactCheck.org found that none of the “associates” named “have been accused of wrongdoing in connection with Epstein.” The lobbying line was not checked."),
   head="Sullivan answers Peltola on Epstein")
ad("senate-1647a4c5",
   "Senate Leadership Fund’s newest Alaska ad (Oct 12). Its release says Peltola earned more than $340,000 at a Washington lobbying firm and took another $80,000 from groups SLF calls dark-money organizations; the ad’s own wording was not published.",
   None, None, 15e6, "Senate Leadership Fund’s announced plan in Alaska", race="AK-S")
ad("ak-s-7a1ff3d0",
   "Senate Leadership Fund’s Alaska ad from Sept 29. Its release says “Mary Peltola sold out Alaska to appease her Far-Left California liberal donors”; the ad’s own wording was not published.",
   None, None, 15e6, "Senate Leadership Fund’s announced plan in Alaska")
# ------------------------------------------------------------------ Minnesota
ad("mn-s-58133bda",
   "A Flanagan campaign video posted Oct 1. Its caption says Tafoya would “protect” Trump’s 2025 tax-and-spending law and that Flanagan will fight to restore its Medicaid and SNAP cuts. No script was published, and TV airing is not confirmed.",
   None, head="Flanagan on Medicaid and SNAP cuts")
ad("mn-s-8b778bc9",
   "A Tafoya campaign video posted Sept 10. Its caption blames Flanagan, as lieutenant governor, for fraud in state programs and says she “deserves a pink slip.” No script was published, and TV airing is not confirmed.",
   None, head="Tafoya on state program fraud")
# ------------------------------------------------------------------ Ohio Senate
ad("oh-sp-cc11b1ac",
   "Brown answers Senate Leadership Fund’s ads: “Seen these ads? They’re a complete lie,” saying records show the woman in them is “actually from Texas” and “didn’t have any surgery as a minor.” He then says Husted “protected men who abused young girls by voting in the Senate to block the release of the Epstein files” and “took over $116,000 from associates of Jeffrey Epstein.”",
   (2, 3, 1, 1),
   A(5, "Mixed", "News 5 Cleveland; FactCheck.org and PolitiFact on the same claims in Brown’s May ad", "https://www.factcheck.org/2026/06/ohio-senate-candidates-spar-over-donations-tied-loosely-or-not-to-epstein/",
     "News 5’s review of records supports the rebuttal: she lived and was treated in Texas and had the surgery at 19. FactCheck.org found the $116,892 came from one donor, Les Wexner, and included $36,992 given to Gov. DeWine’s campaign or transition fund; PolitiFact said the claim “is correct that Husted received donations from Wexner, but it is missing context.” Husted voted to table a release amendment in Sept 2025; the release law later passed without objection."),
   37.5e6, "the Brown campaign’s ad spending through Sept 30 (AdImpact via Deseret News)")
ad("oh-sp-29368d74",
   "Senate Majority PAC’s ad on the FirstEnergy scandal: Husted was mentioned 386 times in the FirstEnergy trial, the company spent $1 million “to help elect him,” Ohio electric bills went up 61% “after Husted got them a bailout,” and “Golden Boy” is “What FirstEnergy called Husted.”",
   (3, 3, 1, 1),
   A(5, "Half True", "PolitiFact, checking Brown’s matching claim about House Bill 6", "https://politifact.com/factchecks/2026/jul/20/sherrod-brown/sherrod-brown-blames-hb-6-for-electric-bill-spike-experts-say-the-law-wasnt-the-main-cause/",
     "Experts told PolitiFact the House Bill 6 bailout was a factor in higher bills but not the main cause, and its nuclear surcharge was repealed before any was collected. Trial records do show FirstEnergy executives called Husted their “golden boy.”"),
   6e6, "the ad’s reported buy (statewide TV, digital and streaming, per SMP)")
ad("oh-sp-4c048c20",
   "A Husted campaign ad first reported by AdImpact on July 15, the newest Husted campaign ad that could be identified. Its one published line: “As Senator, liberal Sherrod Brown rolled out the red carpet for illegal immigrants.”",
   (3, 1, 1, 1), head="Husted on Brown and immigration")
ad("oh-sp-86792650",
   "Soren Aldaco describes gender-transition treatment that led to “hormone shots, a botched double mastectomy, and years of trauma” and says “Sherrod Brown supports sex changes for minors, irreversible surgery on kids like me.” Quoted lines may come from this spot and a Sept 28 companion.",
   (3, 2, 1, 1),
   A(1, "False", "PolitiFact (as listed by Media Bias/Fact Check); News 5 Cleveland", "https://mediabiasfactcheck.com/2026/10/06/mbfcs-daily-vetted-fact-checks-for-10-06-2026/",
     "PolitiFact rated False Senate Leadership Fund’s claim that Brown supports “forcing childhood sex change surgery”; Metro Weekly reports the claim rests largely on a 2023 interview in which Brown said such decisions belong to families and doctors. News 5 found records show Aldaco lived and was treated in Texas, and her attorneys say the mastectomy came at 19."),
   93e6, "Senate Leadership Fund’s announced Ohio commitment")
# ------------------------------------------------------------------ Ohio governor
ad("oh-gov-50304227",
   "A positive ad on Acton’s record: as health director she “worked with republicans to hold big drug companies accountable for the opioid crisis,” and “her expert leadership saved lives during the pandemic”; as governor she “will work with both parties to lower costs, cut taxes, and fight corruption.”",
   (3, 2, 2, 2))
ad("oh-gov-34f3cc54",
   "An ICU nurse, Helen, says Ramaswamy “knows how desperate sick people are” and “tried to take advantage of that”: he “backed one drug called ‘garbage’ by a medical expert and peddled another drug to Alzheimer’s patients that didn’t work. Walking away from it all a billionaire.”",
   (3, 2, 2, 1),
   A(5, "Mixed", "WKRC Local 12, checking the Acton campaign’s matching claim", "https://local12.com/news/local/truth-squad-fact-checking-attack-ads-race-ohio-governor-heats-up-election-day-absentee-voting-candidate-candidates-politics-political-tv-online-internet-amy-acton-vivek-ramaswamy-cincinnati",
     "Local 12 reported that Ramaswamy’s company bought the Alzheimer’s drug after it had failed four clinical trials, that he promoted it on TV and that it never reached the market. His campaign says his companies brought four drugs to market."))
ad("oh-gov-91b39a23",
   "Linda Caudill says that weeks after she placed her mother in a nursing home, “Amy Acton shut down the state”; her mother “didn’t know why her family couldn’t come visit her. Two months later she died. Amy Acton is to blame for this.”",
   (3, 2, 1, 1),
   A(3, "Largely contradicted", "WKRC Local 12 and News 5 Cleveland, checking this ad", "https://www.news5cleveland.com/news/politics/ohio-politics/dr-amy-acton-responds-to-attack-ads-about-alcohol-covid-death",
     "Public records show the mother lived and died in Kentucky, about six weeks after Acton left as health director. Gov. DeWine has said closing the state was his decision, and News 5 notes the stay-at-home order had exceptions for people caring for elderly relatives. The Ramaswamy campaign says the ad refers to an Ohio order that kept Caudill from visiting."))
ad("oh-gov-80cdee5d",
   "V-PAC’s first TV ad against Acton says “she is the liberal who shut down Ohio … during the COVID pandemic six years ago … closing your child’s school and your friend’s business,” and warns, “trust us, it gets worse from here.”",
   (3, 2, 1, 1),
   A(5, "Misleading without context", "TiffinOhio.net", "https://tiffinohio.net/posts/fact-check-ramaswamy-pac-acton-attacks-misleading/",
     "Acton signed the orders as health director under authority delegated by the governor, and Gov. DeWine has said, “The decisions that were made during COVID, they were my decisions.”"),
   8.2e6, "V-PAC’s June spending on a 30-second ad against Acton, most likely this one (TiffinOhio; Ohio Capital Journal)", head="Acton as “the liberal who shut down Ohio”")
ad("oh-09-6cf99798",
   "Rep. Marcy Kaptur, speaking to camera: “I voted with Republicans to keep transgender ideology out of our schools because parents know what’s best for their kids, and boys should not play in girls’ sports.” The ad drew criticism from members of both parties (The Daily Signal).",
   (3, 2, 1, 2), head="Kaptur on transgender policy")
ad("oh-09-8904fadd",
   "Derek Merrin’s answer to Kaptur’s ad, which coverage quotes as saying she “voted to let biological men compete against girls in their sports.” Only that fragment of the script was published.",
   (3, 2, 1, 1), head="Merrin answers Kaptur")
# ------------------------------------------------------------------ North Carolina
ad("nc-s-01162db4",
   "Cooper plays clips of Whatley saying “Grocery prices are down. Gasoline prices are down. Housing prices are down. Inflation is down” and “There is no inflation,” then says he knows “costs are way up” and points viewers to his “plan to make stuff cost less.”",
   (3, 3, 2, 1),
   A(5, "Mixed", "FactCheck.org; Media Bias/Fact Check", "https://www.factcheck.org/2026/09/ad-attacking-n-c-republican-senate-candidate-uses-his-own-dated-words-against-him/",
     "The quotes are Whatley’s own, but FactCheck.org says they are dated and some were more defensible when he said them; Media Bias/Fact Check rated the ad Misleading for leaving out their timing."),
   1e6, "the ad’s reported buy (“seven-figure,” per the campaign)")
ad("nc-s-61062747",
   "WinSenate says Whatley “got rich lobbying for Big Oil, while they jack up prices on you,” argued for Duke Energy rate increases on homeowners, “and now owns nearly half a million in Duke Stock. So now, the more you pay, the more Whatley makes.”",
   (3, 3, 2, 1), None, 5e6, "the ad’s reported buy (statewide TV, per the sponsor)")
ad("nc-s-8694cf04",
   "Whatley’s first general-election ad, a seven-figure buy focused on streaming services (Carolina Journal). Its wording was not published, and no newer Whatley ad was found; his campaign briefly pulled its TV ads in early October (News & Observer).",
   None, None, 1e6, "the ad’s reported buy (“seven-figure,” per Carolina Journal)", head="Whatley’s first general-election ad")
ad("nc-s-b2438dd1",
   "Ronald Hayes, whose son Shemar was murdered in Charlotte, says “As the governor, Mr. Cooper was allowing these criminals back on the streets”; on-screen text says Cooper agreed “to release 3500 state prison inmates early.”",
   (3, 2, 1, 1),
   A(3, "Largely contradicted", "PolitiFact; NC Newsline", "https://politifact.com/article/2026/sep/09/in-ncs-us-senate-race-political-ads-misleadingly-link-coopers-covid-era-inmate-release-to-unrelated-murders/",
     "PolitiFact found no evidence the killer was affected by the 2021 early-release settlement, and NC Newsline reports he was 18, had not been in prison and had no adult record when Shemar Hayes was killed in March 2024."),
   17e6, "Senate Leadership Fund’s $17M summer North Carolina campaign, which this ad was part of (NC Newsline)", head="A father on Cooper and early releases")
# ------------------------------------------------------------------ Georgia
ad("ga-s-f67e7155",
   "Ossoff’s ad says “Mike Collins voted to gut Social Security” and “says he wants to push you off Social Security and back to work,” then plays audio of Collins: “Get off of Social Security. Get, get back into the workforce.”",
   (3, 3, 1, 1),
   A(3, "Mostly False", "PolitiFact; FactCheck.org; Media Bias/Fact Check", "https://politifact.com/factchecks/2026/sep/15/jon-ossoff/social-security-georgia-mike-collins-retirement/",
     "PolitiFact rated “voted to gut Social Security” Mostly False: the ad splices a partial radio quote in which Collins was discussing tax cuts and work incentives. FactCheck.org said the ad takes his quote out of context, and Media Bias/Fact Check rated it Misleading."))
ad("ga-s-3e5b866d",
   "Collins, who calls himself “a trucker, not a talker,” says “Ossoff talks healthcare, but voted to gut rural hospitals,” “voted for higher taxes on tips, overtime, even social security,” and has delivered only “higher prices and unaffordable healthcare.”",
   (3, 2, 2, 1))
ad("ga-s-ae8dedcf",
   "Senate Leadership Fund says Ossoff “spends more money than any Washington politician on hair and makeup. … Yes, even more than the ladies,” and that he “voted to raise taxes by two grand, and to tax overtime too.” The Daily Signal reports it shows AI-made images of Ossoff at a salon.",
   (2, 2, 1, 1), None, 44e6, "Senate Leadership Fund’s Georgia pledge (April)", head="Ossoff’s hair and makeup spending")
# ------------------------------------------------------------------ Maine
ad("me-s-dadc836f",
   "Jackson, “a fifth-generation logger from Allagash,” says “People in this country work so damn hard and still feel so damn broke,” and “Susan Collins keeps telling us that everything’s fine, but we know it’s not.”",
   (3, 1, 2, 1))
ad("me-s-8fc06396",
   "A Mainer, Larry, says “Susan voted for Trump’s war in Iran five times, driving up our gas prices,” while she “is off getting rich from stock trading. She increased her wealth over $10 million.”",
   (2, 3, 2, 1), None, 2.5e6, "the ad’s reported buy (TV, digital and streaming, per SMP)")
ad("me-s-b5ff76be",
   "Collins’s latest positive ad as of mid-August. The Bangor Daily News says it covers federal funding for Maine, the Sept. 11 attacks, the Paycheck Protection Program, lobster, health care, Social Security and her role as Appropriations chair; its wording was not published.",
   None, head="Collins on her record for Maine")
ad("me-s-b1e69134",
   "Senate Leadership Fund’s launch ad against Jackson: “A volatile personality, anger issues with women, verbal abuse. It’s not Graham Platner. It’s Troy Jackson,” who “has a history of conflicts with women, bullying, even intimidation.” On-screen text says he hit a female colleague.",
   (3, 2, 0, 1),
   A(1, "False", "PolitiFact", "https://politifact.com/factchecks/2026/jul/28/senate-leadership-fund/troy-jackson-water-bottle-maine-gop-ad/",
     "PolitiFact rated the on-screen claim False: the water bottle Jackson threw struck no one, and the original allegation was deleted as unverified."),
   0.1e6, "the ad’s reported buy (“six-figure,” per SLF)")
# ------------------------------------------------------------------ New Hampshire
ad("nh-s-7edf89d7",
   "Pappas faults Sununu for “huge tax breaks to pharma companies” and siding “with the insurance industry,” and says “In Washington, I’m taking on this kind of corruption, refusing corporate PAC money and fighting to lower costs.”",
   (2, 2, 2, 1), None, 7.73e6, "the Pappas campaign’s general-election ad spending slated as of Sept 3 (AdImpact via Blaze News)")
ad("nh-s-2f6f7326",
   "Senate Majority PAC says that in the Senate, Sununu “voted to cut Medicare and block lower drug prices” and “like Trump … even invested $100,000 in the companies that benefited from his votes,” while Pappas is “taking on Big Pharma and health insurance companies.” It closes: “Chris Pappas is for you, not Trump.”",
   (3, 3, 2, 1), None, 2.2e6, "the ad’s reported buy (TV and digital, per SMP)")
ad("nh-s-dc5675c9",
   "An NRSC ad for John E. Sununu from before the Sept 8 primary, which The Daily Wire says criticizes Pappas over taxes and his voting record. Its published closing lines: “John Sununu spent his career solving problems. Chris Pappas followed the crowd. New Hampshire needs a leader, not a lightweight.”",
   (3, 1, 2, 1), head="Sununu as “a leader, not a lightweight”")
ad("nh-s-fbd67fc8",
   "One Nation says “Congress badly needs ethics reform,” replays a 2020 debate clip in which Matt Mowers accuses Pappas of voting on bills lobbied by an Amazon lobbyist he was dating and Pappas answers “It’s not true,” then says Pappas “dated an Amazon lobbyist and voted on multiple bills that Jeff Bezos and Amazon lobbied on.”",
   (3, 3, 1, 1), None, 6e6, "the ad’s reported buy (broadcast, cable, satellite, radio and digital, per NH Journal)", head="Pappas and an Amazon lobbyist")
# ------------------------------------------------------------------ House districts
ad("fl-25-a0f68d73",
   "Moskowitz’s first TV ad of the race recounts his bipartisan school-safety law after the 2018 Parkland shooting (raising the gun-purchase age, a waiting period and a red-flag process): “It shouldn’t take our worst moment to bring out our best.”",
   (3, 2, 1, 2), head="Moskowitz on school safety after Parkland")
ad("nc-01-5899b92f",
   "Buckhout’s first TV ad pairs her farm and combat-service biography with an attack on Rep. Don Davis: “When the vote is hard, Don Davis doesn’t show up. Not on the border, for the farmers or our kids.”",
   (2, 1, 1, 1))
ad("ia-01-c65c5f7f",
   "Bohannan recalls waiting tables to help her family get by, says “Washington has forgotten the hardworking people who built this country,” and promises, “I’ll fight for Iowa families, not insurance companies.”",
   (3, 1, 2, 1), None, 1e6, "the ad campaign’s reported size (“seven-figure,” per the campaign)")
ad("ia-01-071807cf",
   "American Action Network credits Rep. Mariannette Miller-Meeks with tax cuts and says she “secured millions for our rural hospitals, so Iowans get quality health care, no matter where we live.”",
   (2, 2, 2, 1), None, 1e6, "AAN’s buy for this ad and a companion ad in Iowa’s 3rd District combined (“more than $1 million”)")
ad("mi-07-ffbdd761",
   "Will Lawrence’s first general-election ad. No wording or description was published; the video is linked.",
   None, None, 2.32e6, "the Lawrence campaign’s own ad spending this cycle (AdImpact via WKAR)", head="Lawrence’s first general-election ad")
ad("mi-07-fc56b0be",
   "Rep. Tom Barrett says “Michigan water, Michigan land, and Michigan’s future belong to Michiganders,” that “I stood up to my own party and voted against giving your tax dollars to data centers,” and that voters, not Washington, should decide on data centers.",
   (3, 2, 1, 2), None, 2.97e6, "the Barrett campaign’s own ad spending this cycle (AdImpact via WKAR)", head="Barrett on data centers")
ad("ny-17-8c396b8d",
   "Conley urges viewers to call Rep. Mike Lawler “and tell him to stop cutting Medicaid”; coverage says her ads attack his voting record.",
   (3, 2, 2, 1), None, 0.27e6, "the Conley campaign’s TV bookings by late August (about $270,000, by one unattributed calculation in The Hudson Independent)", head="Conley on Medicaid cuts")
ad("ny-17-76c82b20",
   "Lawler’s Sept 16 ad, which NY1 says targets Conley over a data center. No script was published.",
   None, None, 10e6, "the Lawler campaign’s TV bookings by late August (“nearly $10 million,” by one unattributed calculation in The Hudson Independent)", head="Lawler on Conley and a data center")
ad("wi-03-134a99a6",
   "A testimonial ad: a former prosecutor with 32 years in the justice system and a voter from a family of veterans vouch for Cooke’s support of law enforcement: “You’ve got our back and we’ve got your back too.”",
   (3, 1, 1, 1), head="A former prosecutor vouches for Cooke")
ad("wi-03-ff947969",
   "Rep. Derrick Van Orden warns that “socialists are trying to tear our country apart” and says “Some things are worth fighting for: faith, family, freedom and the Second Amendment to protect them.”",
   (2, 1, 1, 0), None, 3e6, "the Van Orden campaign’s airtime reserved after the Aug 11 primary (AdImpact via WisPolitics)", head="Van Orden on “socialists”")

if __name__ == "__main__":
    p = DD + "ad_scores.json"
    json.dump(S, open(p, "w"), ensure_ascii=False, indent=1)
    print("scored", len(S))
