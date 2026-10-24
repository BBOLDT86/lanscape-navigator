# Curated "Information age" content and extra sources, merged into v2_overrides.json.
# Every item is drawn from info_env.json or markets.json (research files with sources).
import json, os
SP = os.path.dirname(os.path.abspath(__file__)) + "/"
O = json.load(open(SP + "v2_overrides.json"))

PEW_TOP = "https://www.pewresearch.org/wp-content/uploads/sites/20/2025/09/PJ_2025.09.25_news-information-fact-sheets_topline.pdf"
WES = "https://mediaproject.wesleyan.edu/?p=56458"
ADI = "https://adimpact.com/hubfs/Reports/updated%20projections%202026/AdImpact%20Updated%20Political%20Projection%20Report_2025-2026.pdf"

info = {}
info["news_chart"] = [
    dict(label="Facebook", a=36, b=38, src="Pew Research Center"),
    dict(label="YouTube", a=23, b=35, src="Pew Research Center"),
    dict(label="Instagram", a=11, b=20, src="Pew Research Center"),
    dict(label="TikTok", a=3, b=20, src="Pew Research Center"),
    dict(label="X (Twitter)", a=15, b=12, src="Pew Research Center"),
    dict(label="Reddit", a=6, b=9, src="Pew Research Center"),
]
info["news_chart_note"] = "Share of U.S. adults who regularly get news on each platform. Pew Research Center surveys, Aug–Sept 2020 and Aug 2025."
info["often_chart"] = [
    dict(label="Television", a=40, b=32, src="Pew Research Center"),
    dict(label="News websites and apps", a=34, b=27, src="Pew Research Center"),
    dict(label="Social media", a=23, b=21, src="Pew Research Center"),
    dict(label="Search engines", a=23, b=19, src="Pew Research Center"),
    dict(label="Podcasts", a=6, b=10, src="Pew Research Center"),
]
info["often_chart_note"] = "Share of U.S. adults who often get news from each kind of source. Pew asked about AI chatbots for the first time in 2025: 2% often get news from them."

info["news_diet"] = [
    dict(value_short="53%", stat_short="of U.S. adults get news from social media at least sometimes, the same share as in 2020", year=2025, source="Pew Research Center", url="https://www.pewresearch.org/journalism/fact-sheet/social-media-and-news-fact-sheet/"),
    dict(value_short="54%", stat_short="of Americans reached news weekly through social and video networks, ahead of television (50%) for the first time", year=2025, source="Reuters Institute, via Nieman Lab", url="https://niemanlab.org/2025/06/for-the-first-time-social-media-overtakes-tv-as-americans-top-news-source"),
    dict(value_short="21%", stat_short="regularly get news from news influencers, including 37% of adults under 30; of the influencers studied, 27% leaned right and 21% left", year=2024, source="Pew Research Center", url="https://www.pewresearch.org/journalism/2024/11/18/americas-news-influencers/"),
    dict(value_short="9%", stat_short="get news from AI chatbots at least sometimes; 75% never do", year=2025, source="Pew Research Center", url=PEW_TOP),
    dict(value_short="1 in 5", stat_short="voters say they consult AI chatbots for election news and voting information, at similar rates in both parties (industry survey; sample size not published)", year=2026, source="AAPC Foundation, via NPR", url="https://www.wunc.org/politics/2026-10-05/people-are-asking-chatgpt-to-help-them-decide-how-to-vote-in-the-midterms"),
    dict(value_short="33%", stat_short="trust the mass media a great deal or a fair amount, up from a record-low 28% in 2025: Republicans 22%, independents 31%, Democrats 50%", year=2026, source="Gallup", url="https://news.gallup.com/poll/714938/trust-news-media-edges-slightly-higher.aspx"),
]

info["ai_note"] = "Documented uses of generative AI by campaigns, party committees, officials and foreign operations, with the responses. By the Wesleyan Media Project’s count, pro-Republican sponsors paid for about four in five of the AI-made ads it tracked; examples from both parties are listed."
info["ai_events"] = [
    dict(date="2025-09-29", actor="President Trump", event="Posted an AI-made video of Senate Democratic leader Chuck Schumer saying profanities he never said, beside House Democratic leader Hakeem Jeffries in a sombrero, on the eve of the government shutdown.", response="Jeffries called it disgusting; a White House spokeswoman called it a perfect meme.", url="https://spectrumlocalnews.com/us/snplus/politics/2025/10/01/trump-jeffries-sombrero-mustache-meme"),
    dict(date="2025-09-30", actor="Gov. Gavin Newsom’s press office", event="Posted an AI-made video mocking Vice President JD Vance, one of many AI parodies of the president and his team from the account.", response="Reuters called Newsom the most notable Democratic user of AI video.", url="https://www.thewrap.com/gavin-newsom-trump-jd-vance-ai-deepfake-meme-video/"),
    dict(date="2025-10-17", actor="National Republican Senatorial Committee", event="Ran an ad in which an AI-made Chuck Schumer speaks a line he was quoted saying in print but never said on camera.", response="It carried a small “AI generated” mark; the committee said the words were Schumer’s own.", url="https://www.wyso.org/2025-10-17/a-gop-attack-ad-deepfakes-chuck-schumer-with-ai"),
    dict(date="2025-12-11", actor="Rep. Jasmine Crockett (D-TX)", event="Posted an AI parody video showing herself and the president as babies, with “Baby Trump” accused of rigging Texas elections.", response="YouTube labeled it altered or synthetic content.", url="https://www.texastribune.org/2026/02/19/texas-2026-primaries-ai-ads-candidates-crockett-cornyn-paxton/"),
    dict(date="2026-01-21", actor="Texas Republican Senate primary", event="The Paxton and Cornyn campaigns both used AI videos of their rivals and of Democrats, some with no disclosure.", response="Texas has no disclosure law for AI in political ads.", url="https://www.texastribune.org/2026/02/19/texas-2026-primaries-ai-ads-candidates-crockett-cornyn-paxton/"),
    dict(date="2026-03-13", actor="National Republican Senatorial Committee", event="Ran an 85-second ad with an AI-made James Talarico, the Democratic Senate nominee in Texas, reading his old posts along with lines he never said.", response="Talarico’s campaign called it a deepfake; the committee said they were his real words.", url="https://keyt.com/?p=1405233"),
    dict(date="2026-06-04", actor="North Star Dawn PAC (alignment not disclosed)", event="During the Minnesota Democratic Senate primary, the super PAC’s ad showed Peggy Flanagan in an apparently altered image; she called it a deepfake.", response="The PAC called the claim baseless; Minnesota’s deepfake ban is being challenged in court.", url="https://kstp.com/?p=3946134"),
    dict(date="2026-08-05", actor="States United Democracy Center", event="Tested ChatGPT and Google’s AI on election questions. Factual errors fell from about 7–8% of answers in 2025 to none in 2026 tests in Arizona, Michigan and Pennsylvania, but ChatGPT usually gave incomplete candidate lists.", response="Fewer than 40% of answers linked to an official state election site.", url="https://cyberscoop.com/ai-chatbots-2026-midterm-elections/"),
    dict(date="2026-08-27", actor="Iran-linked network", event="Meta removed 35 Facebook and Instagram accounts posing as U.S. activists that posted anti-Republican and immigration memes, some AI-made, to about 79,000 followers.", response="Meta says it finds generative AI in virtually every influence network it disrupts.", url="https://axios.com/2026/08/27/facebook-instagram-iran-ai-disinformation"),
    dict(date="2026-09-10", actor="Russia-linked “Operation Overload”", event="Spread celebrity videos with cloned voices, and fake TV reports wearing CNN, BBC and New York Times branding, attacking Democrats and Democratic Senate candidates.", response="Fact-checkers rated them false; X, Bluesky and TikTok removed some posts.", url="https://dnyuz.com/2026/09/18/russia-aims-to-inject-chaos-into-elections-u-s-intelligence-finds/"),
    dict(date="2026-09-18", actor="Chinese and Iranian state-backed operators", event="The New York Times reported influence campaigns run end to end by AI agents operating fake-account networks; the Iranian accounts posed as Americans critical of the Republican Party.", response="Officials described them as crude but among the first of their kind.", url="https://www.aa.com.tr/en/middle-east/iran-china-used-ai-agents-in-novel-influence-campaigns-report/4061665"),
    dict(date="2026-09-30", actor="Rep. Derrick Van Orden (R-WI)", event="Ran online ads showing an AI likeness of his challenger, Rebecca Cooke, in invented scenes.", response="Cooke’s lawyers sent a cease-and-desist letter; Wisconsin’s deepfake law may not reach federal candidates.", url="https://truthout.org/articles/dem-candidate-sends-cease-and-desist-order-to-republican-over-deepfake-ads/"),
    dict(date="2026-10-06", actor="Wesleyan Media Project", event="Counted almost 170 AI-made or AI-enhanced political ads, about $80 million of airtime, an undercount. Pro-Republican sponsors ran 80% of them and pro-Democratic sponsors 11%; 69% carried no AI disclaimer.", response="", url=WES),
]

info["rules"] = [
    dict(level="federal", item="No federal law or FEC rule is written specifically for AI in political ads.", status="The FEC says its ban on fraudulent misrepresentation applies to AI case by case, and it has lacked a quorum since April 30, 2025, so it cannot make rules or open enforcement cases.", date="2026", source="FEC; Reuters", url="https://www.fec.gov/updates/commission-approves-notification-of-disposition-interpretive-rule-on-artificial-intelligence-in-campaign-ads"),
    dict(level="federal", item="The FCC’s 2024 proposal to require AI disclosures in broadcast political ads has not been adopted.", status="Its current chairman, Brendan Carr, voted against it.", date="2024", source="Radio World", url="https://radioworld.com/news-and-business/headlines/fcc-proposal-to-regulate-ai-generated-political-ads-gets-the-go-ahead"),
    dict(level="federal", item="Federal teams that tracked foreign influence were cut back in 2025.", status="The FBI’s Foreign Influence Task Force was disbanded, the State Department’s counter-disinformation office closed, and the intelligence community’s Foreign Malign Influence Center is being wound down. Officials called the center redundant; critics said it was being ended in all but name.", date="2025", source="Associated Press", url="https://www.ky3.com/2025/08/20/gabbard-slashing-intelligence-office-workforce-cutting-budget-by-more-than-700-million/"),
    dict(level="states", item="33 states have enacted at least one law on deepfakes in election messages, by Public Citizen’s count, which still includes struck-down laws in California and Hawaii and an expired one in Massachusetts.", status="Most require a disclosure rather than a ban. A federal court struck down California’s two laws in 2025; Minnesota’s ban is still being challenged.", date="Oct 2026", source="Public Citizen tracker", url="https://www.citizen.org/article/tracker-legislation-on-deepfakes-in-elections/"),
    dict(level="states", item="California and Texas require paid influencers to say a campaign paid them.", status="Federal rules don’t: paid posts on a creator’s own account are exempt.", date="2026", source="Boston Globe", url="https://www.bostonglobe.com/2026/06/13/nation/california-influencers-midterm-elections/"),
    dict(level="Meta", item="Ended U.S. third-party fact-checking in April 2025 in favor of Community Notes.", status="For 2026 it labels AI content, requires advertisers to disclose AI-made political ads, and takes no new political ads in the final week.", date="2026", source="Meta", url="https://about.fb.com/news/2026/02/meta-prepares-for-2026-us-midterms/"),
    dict(level="Google", item="Election advertisers must disclose synthetic content, and YouTube labels AI video.", status="In 2025 YouTube offered a way back for creators banned under its retired election-misinformation rules.", date="Sept 2026", source="Google; TechCrunch", url="https://blog.google/company-news/outreach-and-initiatives/civics/midterm-elections-2026/"),
    dict(level="X", item="Allows U.S. political ads again since 2023 and relies on Community Notes rather than professional fact-checkers.", status="", date="", source="Al Jazeera", url="https://www.aljazeera.com/news/2023/8/29/social-media-company-x-to-allow-political-ads-reversing-previous-ban"),
    dict(level="TikTok", item="U.S. operations moved in January 2026 to a new joint venture with a majority-American board; the ByteDance algorithm is licensed and is to be retrained on U.S. data.", status="Days later, users said posts about an immigration-agent shooting in Minneapolis were being suppressed; TikTok blamed a data-center power outage.", date="2026", source="Gray DC; AP", url="https://www.wkyt.com/2026/01/23/tiktok-deal-finalized-shifting-us-operations-new-joint-venture-group"),
]

info["persuasion_note"] = "The strongest recent experiments find that a conversation with an AI moves opinions more than typical ads do in similar tests: about 1.5–4 points on a 0–100 scale in the 2024 U.S. study and about 9–10 in Britain, Canada and Poland, measured right after a chat people agreed to have. About a third of the effect remained a month later, and three in four Americans say they never get news from AI chatbots. Scales differ from study to study, so read each row on its own terms."
info["persuasion_table"] = [
    dict(label="AI chat about the 2024 presidential race", measure="Candidate preference, 0–100 scale (U.S. adults)", now="+3.9 for the pro-Harris bot among Trump-leaning voters; +1.5 for the pro-Trump bot among Harris-leaning voters", later="About a third remained a month later", src="Lin et al., Nature (2025)", url="https://pure.uva.nl/ws/files/295900960/AI_chatbots_can_persuade_voters.pdf", ai=True),
    dict(label="AI chat about the 2025 Canadian and Polish elections", measure="Candidate preference among opposing voters, 0–100 scale", now="About 10 points", later="Not reported", src="Lin et al., Nature (2025)", url="https://www.news.cornell.edu/stories/2025/12/ai-chatbots-can-effectively-sway-voters-either-direction", ai=True),
    dict(label="AI chat on 707 British policy issues", measure="Agreement with a position, 0–100 scale (about 77,000 adults)", now="About 9 points on average; about 16 for the most persuasive setup, which also made more inaccurate claims (about 30% of its claims, against 16% on average)", later="36–42% remained a month later", src="Hackenburg et al., Science (2025)", url="https://arxiv.org/html/2507.13919v1", ai=True),
    dict(label="AI chat with believers in a conspiracy theory", measure="Belief in the theory each person chose", now="About 20% lower", later="Undiminished after two months", src="Costello, Pennycook & Rand, Science (2024)", url="https://www.niemanlab.org/2024/09/an-ai-chatbot-helped-americans-who-believe-in-conspiracy-theories-exit-the-rabbit-hole/", ai=True),
    dict(label="TV ads in a Texas governor’s race, randomized by market", measure="Support for the candidate, percentage points", now="+4.7 during the weeks the ads ran", later="Gone within about a week", src="Gerber, Gimpel, Green & Shaw, APSR (2011)", url="https://www.povertyactionlab.org/evaluation/persuasive-effects-televised-campaign-ads", ai=False),
    dict(label="49 ads from the 2016 presidential race, 59 experiments", measure="Vote choice, percentage points", now="+0.7, not statistically significant", later="Not measured", src="Coppock, Hill & Vavreck, Science Advances (2020)", url="https://escholarship.org/content/qt5rs420rb/qt5rs420rb.pdf", ai=False),
    dict(label="Campaign contact and ads in general elections, 49 field experiments", measure="Candidate choice", now="About zero", later="Early effects decayed before Election Day", src="Kalla & Broockman, APSR (2018)", url="https://ideas.repec.org/a/cup/apsrev/v112y2018i01p148-166_00.html", ai=False),
]

info["polling"] = [
    dict(item="A bot passed 99.8% of quality checks", finding="A Dartmouth study built an AI respondent that mimicked human reading times, mouse movement and typos for about 5 cents an answer. In final-week national polls in 2024, 10 to 52 such fakes could have flipped which candidate led.", date="Nov 2025", source="Westwood, PNAS", url="https://campaignsandelections.com/industry-news/new-research-shows-how-ai-can-manipulate-online-polls/"),
    dict(item="Bogus respondents are hard to screen out", finding="In a Pew opt-in survey after the 2024 election, 18% of respondents claimed an impossible activity. No screening method removed the bias; probability-based panels were largely unaffected.", date="Aug 2026", source="Pew Research Center", url="https://pewresearch.org/methods/2026/08/27/no-easy-fix-for-bogus-respondents-in-online-opt-in-polls"),
    dict(item="The pollsters’ code now covers AI", finding="AAPOR’s 2026 code says AI-generated answers are not research participants, and requires pollsters to disclose AI use and whether a sample is probability-based, opt-in or synthetic.", date="June 2026", source="AAPOR", url="https://aapor.org/wp-content/uploads/2026/06/AAPOR-2026-Code-of-Ethics-Final-.pdf"),
    dict(item="2024 polls missed toward Democrats again", finding="Final-fortnight polls overstated Democratic margins by 2.7 points on average across offices, the third presidential cycle in a row, though their average error fell to 3.3 points from 5.3 in 2020.", date="Oct 2025", source="AAPOR task force", url="https://aapor.org/wp-content/uploads/2025/10/Task-Force-on-2024-Pre-Election-Polling-Report-Executive-Summary.pdf"),
    dict(item="Most polls had moved online by 2020", finding="AAPOR estimated that 84% of polls before the 2020 election used online methods, up from 56% in 2016; by 2022 a third of national pollsters used probability-based panels.", date="2023", source="Pew Research Center", url="https://www.pewresearch.org/methods/2023/04/19/how-public-polling-has-changed-in-the-21st-century/"),
]

info["polarization"] = [
    dict(value="16", measure="House districts that split their tickets in 2024", trend="13 Democrats won Trump districts and 3 Republicans won Harris districts, near the post-war low; the 2000s saw five dozen or more per cycle.", source="Sabato’s Crystal Ball", url="https://www.rasmussenreports.com/public_content/political_commentary/commentary_by_kyle_kondik/the_2024_crossover_house_seats_overall_number_remains_low_with_few_harris_district_republicans"),
    dict(value="4 of 34", measure="Senate races in 2024 won by the party that lost the state for president", trend="All four were Democrats in Trump states. Since 2012, 91% of Senate races went the way the state voted for president.", source="Pew Research Center", url="https://www.pewresearch.org/short-reads/2024/11/26/2024-elections-show-more-partisan-splits-between-states-presidential-and-senate-votes-than-in-recent-past/"),
    dict(value="0.987", measure="Correlation of House and presidential margins across districts, 2020", trend="Close to one-to-one: House races now track the national parties.", source="Sabato’s Crystal Ball", url="https://centerforpolitics.org/crystalball/?p=25436"),
    dict(value="7%", measure="House districts that are highly competitive for president", trend="About a third were in the 1970s.", source="Alan Abramowitz, Crystal Ball", url="https://www.rasmussenreports.com/public_content/political_commentary/commentary_by_alan_i_abramowitz/it_don_t_mean_a_thing_if_it_ain_t_got_that_swing_the_outlook_for_electoral_accountability_in_2026"),
    dict(value="20.6", measure="Average warmth toward the other party, 0–100 (2024)", trend="Down from 48.0 in 1978, while warmth toward one’s own party held near 70.", source="American National Election Studies", url="https://voterproject.arizona.edu/anes"),
    dict(value="85%", measure="Share of 2020 Trump voters who voted for him again in 2024", trend="79% of 2020 Biden voters backed Harris. Few switched sides; who turned out mattered more.", source="Pew Research Center", url="https://www.pewresearch.org/politics/2025/06/26/behind-trumps-2024-victory-a-more-racially-and-ethnically-diverse-voter-coalition/"),
    dict(value="45%", measure="Americans calling themselves independents in 2025, a record", trend="Even as voting itself stays highly partisan.", source="Gallup, via Semafor", url="https://www.semafor.com/article/01/12/2026/record-number-of-americans-identify-as-independents-poll-finds"),
]

info["money"] = [
    dict(value="$11.6B", item="Projected political ad spending for 2025–26, a record (2023–24: $11.2B)", date="June 2026", source="AdImpact", url=ADI),
    dict(value="48%", item="Share going to broadcast TV; streaming TV gets 23% and online digital about 14%", date="June 2026", source="AdImpact", url=ADI),
    dict(value="$197M", item="Ad spending in Ohio’s Senate special election, the most of any 2026 race (Texas Senate about $140M, Maine about $110M)", date="Sept 22, 2026", source="AdImpact, via Deseret News", url="https://www.deseret.com/politics/2026/10/06/where-parties-are-spending-the-most-in-midterm-races/"),
    dict(value="$80M", item="Spent airing almost 170 AI-made or AI-enhanced ads tracked so far, an undercount", date="Oct 2026", source="Wesleyan Media Project", url=WES),
    dict(value="$120K+", item="Paid by the NRCC to the conservative creator network Creator Grid in 2025–26, reported as “media”", date="June 2026", source="Boston Globe", url="https://www.bostonglobe.com/2026/06/13/nation/california-influencers-midterm-elections/"),
    dict(value="$100K", item="Paid by Democrat Tom Steyer’s California governor campaign to one creator as a consultant; a state complaint says paid posts went undisclosed", date="June 2026", source="Boston Globe", url="https://www.bostonglobe.com/2026/06/13/nation/california-influencers-midterm-elections/"),
]

info["markets_media"] = [
    dict(date="2025-06-06", item="X named Polymarket its official prediction-market partner, with a planned product in which Grok annotates market moves.", source="TechCrunch", url="https://techcrunch.com/2025/06/06/x-names-polymarket-as-its-official-prediction-market-partner/"),
    dict(date="2025-12-02", item="CNN made Kalshi its exclusive prediction-market data partner, with odds in an on-air ticker.", source="Axios", url="https://www.axios.com/2025/12/02/cnn-kalshi-prediction-market-data"),
    dict(date="2025-12-04", item="CNBC signed a multi-year deal to show Kalshi data on air from 2026.", source="TheWrap", url="https://www.thewrap.com/cnbc-kalshi-prediction-deal-ms-now-versant/"),
    dict(date="2026-01-08", item="Polymarket agreed to supply odds to Dow Jones outlets, including The Wall Street Journal and Barron’s.", source="Crowdfund Insider", url="https://www.crowdfundinsider.com/2026/01/257185-prediction-markets-platform-polymarket-secures-data-partnership-with-dow-jones/"),
    dict(date="2026-06-08", item="In the Los Angeles mayoral primary, paid exchange affiliates on X cited shifting odds as evidence of fraud during a slow count. Kalshi then barred affiliates from questioning election integrity.", source="NPR", url="https://www.tpr.org/2026-06-07/kalshi-and-polymarket-crack-down-on-paid-influencers-claiming-election-fraud"),
    dict(date="2026-08-28", item="Polls from a fake firm were reported as real by several outlets. Kalshi said its markets barely reacted.", source="NPR", url="https://www.kunc.org/npr-news/2026-08-28/what-a-fake-poll-reveals-about-worries-around-prediction-markets-and-the-midterms"),
]

info["gaps"] = [
    "a probability-sample estimate of how many voters use chatbots for election information",
    "documented 2026 cases of AI giving false voting instructions",
    "public 2026 election-threat assessments from the FBI, CISA or the intelligence community",
    "any measured effect of AI ads on actual 2026 votes",
    "total 2026 spending on paid influencers",
]
O["info"] = info

COV = "https://covers.com/industry/polymarket-removes-waitlist-launches-for-american-ios-users-may-12-2026"
O["landscape"] = [
    dict(date="2022", fact="Polymarket paid a $1.4 million penalty to the CFTC for offering unregistered contracts and cut off U.S. users.", source="Covers", url=COV),
    dict(date="2024-09-12", fact="A federal judge ruled that the CFTC had exceeded its authority in blocking Kalshi’s contracts on control of Congress.", source="The Block", url="https://www.theblock.co/post/319206/federal-court-clears-kalshi-to-list-election-betting-contracts-denies-cftcs-motion"),
    dict(date="2024-11-02", fact="A French trader put about $30 million on Trump through several Polymarket accounts, raising fears that one bettor could move the odds.", source="Fortune", url="https://fortune.com/2024/11/02/french-whale-polymarket-30-million-donald-trump-election-bet-kamala-harris"),
    dict(date="2025-05-07", fact="The CFTC dropped its appeal, leaving the ruling for Kalshi in place.", source="Covers", url="https://www.covers.com/industry/kalshi-cftc-lawsuit-appeal-election-betting-contracts-drop-may-2025"),
    dict(date="2025-07", fact="Polymarket bought a CFTC-licensed exchange to return to the U.S.; its U.S. app opened to everyone on the waitlist in May 2026.", source="Covers", url=COV),
    dict(date="2025-12-04", fact="CNN, then CNBC, signed data deals with Kalshi. Kalshi and Polymarket together traded more than $45 billion in 2025.", source="The Block", url="https://www.theblock.co/post/381415/kalshi-exclusive-cnbc-deal-prediction-markets-surge-mainstream-media"),
    dict(date="2026-03-16", fact="Both exchanges showed Democrats about 51% to win the Senate, the first time Democrats were favored on Kalshi’s contract.", source="Decrypt", url="https://decrypt.co/361190/democrats-overtake-republicans-kalshi-polymarket"),
    dict(date="2026-04-22", fact="Kalshi fined three congressional candidates for betting on their own races and suspended them for five years.", source="Associated Press", url="https://www.wsls.com/news/politics/2026/04/22/kalshi-fines-and-suspends-three-congressional-candidates-for-wagering-on-their-own-elections/"),
    dict(date="2026-07-02", fact="After a New York Times/Siena poll, Kalshi priced a Republican Senate at 60% and Polymarket at 57%.", source="DeFi Rate", url="https://defirate.com/news/senate-control-play-polls-tighten-prediction-markets-mixed-messages/"),
    dict(date="2026-08-17", fact="By Aug 10, $133 million had been bet on 2026 congressional races, more than in the whole 2024 cycle. On Polymarket, the top 1% of wallets accounted for 68% of the volume.", source="Anti-Corruption Data Collective; Reuters", url="https://gvwire.com/2026/08/17/us-midterm-election-betting-races-past-2024-congressional-total-data-shows/"),
    dict(date="2026-09-17", fact="Kalshi’s “Democrats win both chambers” contract reached a record 58%.", source="Newsweek", url="https://www.newsweek.com/democrats-chances-of-taking-control-of-congress-reach-record-high-12455052"),
    dict(date="2026-09-24", fact="CNN reported more than $750 million traded on 2026 U.S. election markets, as election officials in Los Angeles County and Michigan raised integrity concerns.", source="Bonus.com, citing CNN", url="https://www.bonus.com/news/kalshi-polymarket-top-750m-in-midterm-trading-as-election-officials-raise-integrity-concer/"),
    dict(date="2026-10-11", fact="Lifetime trading on control of Congress: about 53 million Kalshi contracts on the House and 14 million on the Senate (each pays $1; aggregators report these counts as dollars), and about $16 million and $6 million on Polymarket.", source="Kalshi and Polymarket data", url="https://gamma-api.polymarket.com/events?slug=which-party-will-win-the-senate-in-2026"),
]

S = []
def add(group, label, url, note=None):
    d = dict(group=group, label=label, url=url)
    if note: d["note"] = note
    S.append(d)
G = "Prediction markets"
add(G, "Kalshi public market data (Senate control)", "https://api.elections.kalshi.com/trade-api/v2/events/CONTROLS-2026?with_nested_markets=true", "the page also asks this feed for live prices")
add(G, "Polymarket market data (Senate control)", "https://gamma-api.polymarket.com/events?slug=which-party-will-win-the-senate-in-2026", "the page also asks this feed for live prices")
add(G, "ElectionBettingOdds.com", "https://electionbettingodds.com/", "PredictIt and Betfair prices for House and Senate control")
add(G, "Anti-Corruption Data Collective: the midterms on prediction markets", "https://acdatacollective.org/wp-content/uploads/2026/08/ACDC-%E2%80%94-Gambling-on-Democracy_1_The-Midterms-on-Prediction-Markets.pdf")
add(G, "Berg, Nelson & Rietz (2008), prediction market accuracy in the long run", "https://ideas.repec.org/a/eee/intfor/v24y2008i2p285-300.html")
add(G, "Erikson & Wlezien (2008), are political markets really superior to polls?", "https://statmodeling.stat.columbia.edu/wp-content/uploads/2024/08/Erikson-and-Wlezien-POQ-2008.pdf")
add(G, "Rothschild (2009), forecasting elections with markets and polls", "https://researchdmr.com/files/ForecastingElectionMarketsPolls.pdf")
add(G, "Page & Clemen (2013), are prediction markets well calibrated?", "https://scholars.duke.edu/publication/765630")
add(G, "Clinton & Huang on 2024 market accuracy, via DL News", "https://www.dlnews.com/articles/markets/polymarket-kalshi-prediction-markets-not-so-reliable-says-study")
add(G, "Le (2026), calibration of Kalshi and Polymarket prices (preprint)", "https://arxiv.org/html/2602.19520v1")
G = "War and the economy"
add(G, "Brookings, Vital Statistics on Congress: House popular vote, 1946–2024", "https://www.brookings.edu/wp-content/uploads/2026/04/Chapter-2-Full.pdf")
add(G, "BEA via FRED: real disposable income per person", "https://fred.stlouisfed.org/series/A229RX0Q048SBEA")
add(G, "BLS via FRED: unemployment rate", "https://fred.stlouisfed.org/series/UNRATE")
add(G, "BLS via FRED: consumer prices", "https://fred.stlouisfed.org/series/CPIAUCNS")
add(G, "University of Michigan via FRED: consumer sentiment", "https://fred.stlouisfed.org/series/UMCSENT")
add(G, "Congressional Research Service: American war and military operations casualties", "https://www.everycrsreport.com/files/20190924_RL32492_75dc0f1f826404a4728a7a3eb43ec2f8cb67905d.html")
add(G, "National Archives: Vietnam War casualty statistics", "https://www.archives.gov/research/vietnam-war/casualty-statistics")
G = "Information age"
add(G, "Pew Research Center: social media and news fact sheet", "https://www.pewresearch.org/journalism/fact-sheet/social-media-and-news-fact-sheet/")
add(G, "Pew Research Center: 2025 news platform topline", PEW_TOP)
add(G, "Pew Research Center: America’s news influencers", "https://www.pewresearch.org/journalism/2024/11/18/americas-news-influencers/")
add(G, "Gallup: trust in news media, 2026", "https://news.gallup.com/poll/714938/trust-news-media-edges-slightly-higher.aspx")
add(G, "Wesleyan Media Project: AI in 2026 political ads", WES)
add(G, "Public Citizen: state deepfake legislation tracker", "https://www.citizen.org/article/tracker-legislation-on-deepfakes-in-elections/")
add(G, "Lin et al. and Hackenburg et al. on AI persuasion: Nature commentary", "https://pure.uva.nl/ws/files/295900960/AI_chatbots_can_persuade_voters.pdf")
add(G, "Hackenburg et al., the levers of political persuasion with conversational AI", "https://arxiv.org/html/2507.13919v1")
add(G, "Kalla & Broockman (2018), the minimal persuasive effects of campaign contact", "https://ideas.repec.org/a/cup/apsrev/v112y2018i01p148-166_00.html")
add(G, "Pew Research Center: no easy fix for bogus respondents in opt-in polls", "https://pewresearch.org/methods/2026/08/27/no-easy-fix-for-bogus-respondents-in-online-opt-in-polls")
add(G, "AAPOR: 2026 code of professional ethics", "https://aapor.org/wp-content/uploads/2026/06/AAPOR-2026-Code-of-Ethics-Final-.pdf")
add(G, "AAPOR: task force on 2024 pre-election polling", "https://aapor.org/wp-content/uploads/2025/10/Task-Force-on-2024-Pre-Election-Polling-Report-Executive-Summary.pdf")
add(G, "AdImpact: 2025–26 political ad projections", ADI)
O["sources"] = S

json.dump(O, open(SP + "v2_overrides.json", "w"), ensure_ascii=False, indent=1)
print("info keys", list(info), "sources", len(S))
