# The Watch: how the paper gets made

The Watch (`news/index.html`, served at <https://bboldt86.github.io/lanscape-navigator/news/> and as
`www.thewatch.com` inside LANscape) is one static page that reads `news/data/edition.json`. Everything that
changes during the day lives in that file.

## Six editions a day

One edition per ship's watch, Eastern time:

| watch | opens |
| --- | --- |
| Middle | 12 a.m. |
| Morning | 4 a.m. |
| Forenoon | 8 a.m. |
| Afternoon | 12 p.m. |
| Dog | 4 p.m. |
| First | 8 p.m. |

`.github/workflows/news.yml` runs `news/updater/run.py` at :11 past the EDT hour and the EST hour of each watch
(GitHub's cron is UTC). The script builds an edition only when the current watch has none yet, so the second run of
each pair does nothing unless the first one was late or failed. **Run workflow** on the Actions tab (a manual run)
always builds, and replaces the current watch's edition.

## What a run does

1. Reads every feed in `news/data/feeds.json` (about 195, 35 of them in Portuguese or German; 20 at a time, 18-second timeout, one retry).
   Google News items take the outlet from the feed's `<source>`. Opinion, video, podcast, shopping and puzzle pages are skipped.
2. Merges with the last edition's stories, so a feed that is down for a watch does not empty its section.
   News desks keep 36 hours; Cars, Travel, Food and Long reads keep 96.
3. Sorts each story into a desk: its feed's desk, or for a general feed, the outlet's URL path and then its words.
4. Tags names (learned from sentence-case headlines in the same edition) and topics (a fixed list in `run.py`).
5. Groups stories that several outlets are covering (shared headline words, names weighted double), ranks the groups
   by how many outlets have them and how recent they are, and marks groups that are new or gaining outlets since the
   last watch.
6. Writes `edition.json`, a copy in `editions/` (the last seven are kept, which the dial uses for earlier watches),
   and `latest.json`, which an open page checks every 10 minutes.

Headlines are the outlets' own; summaries are the feeds' own descriptions, clipped to about 200 characters. Nothing is
invented. Failed feeds are listed in the edition and shown in the page's footer.

## Desks

U.S., World, Europe, Brazil, Politics, Business, Household, Home, Tech, Science, Health, Sports, Culture, Cars, Travel,
Food and Long reads, plus four pages that are not feed desks: Reports, Pictures, Video and the Epstein files.
Europe and Brazil have sources of their own; stories about either region from the general and world feeds also file
there (`region()` in `run.py`), unless a stronger topic (a match, a market) claims them. World is everywhere else.

## Markets (`markets.py` -> `data/markets.json`)

Runs after the edition in the same workflow, with a four-minute limit that can't hold up the edition's commit.

- Quotes and charts: CNBC's public quote service (one request per 40 symbols) and chart data (today's minute bars for
  the board and sectors, a year of daily closes for everything). Indices, futures, world markets, Treasury yields,
  currencies, commodities, crypto, the 11 sector funds and about 75 large companies.
- Economy: inflation, core inflation, unemployment and payrolls (BLS), GDP growth (BEA) and gas prices (EIA), all
  through DBnomics' public mirror; the Fed's target range (New York Fed); 30-year mortgage rates (Freddie Mac);
  consumer sentiment (University of Michigan); the yield curve from the 10-year and 2-year quotes.
- Calendars: Nasdaq's earnings and economic-event calendars for the next five weekdays.

Yahoo Finance, Stooq, FRED and the BLS's own API refuse GitHub's runners, so they are not used. A block that fails
keeps its last good version and is listed under `stale`; individual misses are in `errors`. The page's Business desk
writes its plain-English summary from these numbers only.

## Power (`power.py` -> `data/power.json`; `data/datacenters.json`)

The Power desk: news from the power-industry and data center press (Utility Dive, DCD, Canary Media, Latitude Media,
Heatmap, POWER Magazine and three Google News searches), plus stories from every other feed about grids, utilities,
electric bills and data centers. Above the stories, from `power.py` on every news run:
- the grid: the Lower 48 and the EIA's 13 regions, hour by hour (the EIA's Hourly Electric Grid Monitor, Form
  EIA-930): demand against the day-ahead forecast, generation by fuel, and carbon intensity from the EIA's average
  emission rates per fuel (coal 1,048 g/kWh, gas 440, oil 1,080; power bought from neighbors isn't counted);
- wholesale prices where the operator publishes them openly (ERCOT, NYISO);
- what households pay: each state's average residential price (EIA Form 861M, once a day), the BLS's U.S. average and
  the electricity line of the CPI (the BLS's own API, or DBnomics; anything older than nine months is dropped), and
  Henry Hub natural gas from `markets.json`.
The EIA's API takes a key: add a free one (eia.gov/opendata) as the repository secret `EIA_API_KEY`; without it the
shared `DEMO_KEY` is used, which allows only a few requests an hour.

The data center tracker (`data/datacenters.json`) is kept by a weekly Claude task from filings and reporting: the
biggest U.S. projects with their power need in megawatts, status, how they're powered, the grid they sit on and
sources, plus a short summary of the week. `dctrack.py check` validates it. The page maps the projects on
`data/usmap.json` (the states, Albers USA, built from the Election Desk's map).

## The garage and FSD (`garage.py` -> `data/garage.json`; `news/garage/`; `data/fsd.json`)

The Cars desk opens with the garage. On every news run `garage.py` reads, from the feeds the sites publish:
- the last two months of uploads from YouTube builders who buy salvage, insurance write-offs and abandoned cars and fix
  them (Goonzquad, Tavarish, Rich Rebuilds, Mat Armstrong, Hoovies Garage, Niko Brothers, Vice Grip Garage and more;
  the list is `BUILDERS` in `garage.py`, each id checked against the channel's own name; Shorts are left out);
- the auctions: Bring a Trailer and Cars & Bids sales in the news (Google News), what's on the block at Bring a
  Trailer (its RSS feed: titles and links only, no prices or pictures copied), Hagerty's market stories, and the
  Cars & Bids, Doug DeMuro and Hagerty channels;
- Tesla FSD news: Google News, Teslarati, Not a Tesla App and Electrek, kept to FSD, Autopilot and robotaxi stories.

A weekly scheduled Claude task writes the rest:
- project files, `news/garage/<id>.json`, one per build: the car, where it came from and what it cost (prices said on
  camera marked "stated", Claude's reckoning "estimate"), the damage, the episodes, the parts, the time, the money in
  against a value range from comparable public sales with links, a verdict and a cited write-up. `garage.py check`
  enforces the format (`python3 news/updater/garage.py format` prints it); `garage.py index` rebuilds
  `garage/index.json`. They open at `#/build/<id>`; `#/garage` has every project, video and auction headline.
- `data/fsd.json`, the FSD guide at `#/fsd`: price, the latest version for each computer, which computer every model
  year has (HW2.5, HW3, AI4), how to tell, transfers, where it's offered, robotaxis, buying tips and the week's
  changes. `garage.py fsdcheck` enforces it. The page builds searches on Tesla's used inventory, Cars.com,
  Autotrader and eBay Motors from the reader's ZIP, model and computer; nothing from those sites is copied.

## What's for dinner (the Food desk; all in the page)

The Food desk opens with a fridge camera. Nothing runs on the server and nothing is stored here:
- With the reader's own Anthropic API key (entered on the page, kept in that browser's `localStorage` as
  `watch.akey`), the picture is shrunk to 1,568 pixels on its long side and sent from the browser straight to
  Anthropic's Messages API (`anthropic-dangerous-direct-browser-access`), with the reader's servings, time, diet and
  things to leave out. Claude lists what it sees and writes three dinners as JSON, in the reader's language; the
  reader can strike what it got wrong, tick or add what it missed, and ask again from the list. Sonnet 5.5 by
  default; Haiku 5.5 and Opus 5.5 are offered.
- Without a key, what the reader ticks or types is matched to TheMealDB's free recipe collection (its public test
  key, `1`, which TheMealDB allows for educational and non-commercial use): up to six ingredients are searched, the
  meals that share the most are looked up, and each shows what the reader has and what to buy.

## Late Night (`latenight.py` -> `data/latenight.json`; `news/latenight/`)

`#/latenight`, in the bar after Video. On every news run `latenight.py` reads the official YouTube channels of The
Daily Show, Last Week Tonight, Late Night with Seth Meyers and Jimmy Kimmel Live (the last ten days; Shorts and
celebrity interviews left out) and ties each segment to the edition's story cluster it covers, with the same matcher
as the Video page.

Receipts: every Monday, after the weekend's shows, a scheduled Claude task writes two pieces in the spirit of the
shows' segments: The Main Story (`kind: main`, 1,300 to 2,400 words on one subject, like Last Week Tonight's) and The
Week, Unwrapped (`kind: desk`, 600 to 1,200 words through the week's headlines, like The Daily Show's desk). They are
sharp and funny, and sourced like a report: every section is cited, about one citation per 110 words, every source
is used, and the sources show as "The receipts". They aim at institutions and the powerful, never private people,
and rotate their targets across parties and sectors. `latenight.py check` enforces the format
(`latenight.py format` prints it); `latenight.py index` rebuilds `latenight/index.json`. Pieces open at `#/ln/<id>`.

## The week, three ways (`news/columns/`, `columns.py`)

Every weekend a scheduled Claude task writes three market columns about the same week, in the voices of three
fictional characters (`python3 news/updater/columns.py who`): Cal Mercer, the Bull, a former Wall Street equity
strategist; Ruth Voss, the Bear, who has run money through three crashes; and June Kowalski, the Outsider, who runs a
machine shop in Ohio and checks Wall Street's story against her order book. One file a week,
`news/columns/<Sunday>.json`: the shared facts, the three columns (550 to 950 words each, cited), the sources, and
Portuguese and German translations. `columns.py check` enforces it, including that no character tells a reader to
buy or sell a particular security; `columns.py index` rebuilds `columns/index.json`. The Business desk shows the
latest three side by side; each opens at `#/col/<week>/<bull|bear|outsider>`, and `#/columns` keeps every week.

## What the week's reports move (`impact.py` -> `data/impact.json`)

Every U.S. release on the week's calendar is grouped into a family (PCE, jobless claims, GDP, housing, an auction)
and every company worth $60 billion or more that reports gets a map: from the report, through the channels it works
on (Fed rate expectations, bond yields, the dollar, valuations, peers, suppliers), to the markets it usually moves,
with the usual first direction when the number comes in above or below forecast. The rules are in `impact.py`
(`CATS`, `FAMILIES`); who moves with whom is in `data/peers.json` (sector fund, peers, suppliers, customers), with
Nasdaq's company profile (`data/profiles.json`, cached) for companies not listed there.

The size comes from the options market: Cboe's delayed quotes (`cdn.cboe.com`), the at-the-money straddle on the
first expiry after the event, as a percentage of the price, next to a normal stretch of the same length from the 30-day
implied volatility. Option prices are fetched at most every five hours (a manual run always fetches). The page
draws each map as a Sankey diagram (`#/impact/<id>`, and the week at `#/impact`); the calendar rows and the
companies link to them. Directions are the usual reactions, not forecasts; the options give size, not direction.

## Household and Home (`home.py` -> `data/home/`)

Household is the cost-of-living desk: gas and diesel, 30- and 15-year mortgage rates, the Fed's rate, inflation and
consumer sentiment from `markets.json`, the typical U.S. home value and rent, and news from the personal-finance feeds.

Home searches for homes in plain English. The page reads a request like "4BR homes in 43215 under 750k" (bedrooms,
baths, a price limit or range, a ZIP code or a city and state, the kind of home, square feet, features) into filters,
shows that ZIP's market from `zips.json` (the typical home overall and by bedroom count against the budget, the typical
rent, the change over a year) and links straight to the matching search on Zillow, Realtor.com and Redfin.

- **Market numbers:** `home.py` reads Zillow's public research files (the Zillow Home Value Index by ZIP, overall and
  for 1 to 5 bedrooms, and the Zillow Observed Rent Index). It checks them with a HEAD request on every run and
  downloads them only when Zillow publishes new ones, about once a month. `zips.json` has one row per ZIP;
  `market.json` the national figures and a three-year series for each saved search's ZIP.
- **Saved searches:** Save this search opens a GitHub issue titled "Home search: ..." with the filters as JSON.
  `.github/workflows/home-search.yml` runs only for issues opened by the repository's owner, saves the search to
  `searches.json`, comments and closes the issue. "Home search remove: <id>" removes one. Issues in this repository
  are public.
- **Listings:** filled in only when a RentCast API key is stored as the repository secret `RENTCAST_API_KEY` (their
  free tier is 50 requests a month; `home.py` refreshes one search per run, each every few days, to stay under it).
  Listing sites' own search pages are not collected: their terms forbid it, and this site is public.

## Reports (`news/articles/`, `articles.py`)

One in-depth report a day, written by Claude through a scheduled task. Each is a JSON file named for its id
(`2026-10-25-some-slug.json`): title, dek, desk, `byline: "Claude"`, the exact model name, the time written (with its
UTC offset), a Markdown body with numbered citations, and the sources. Before committing, the writer runs
`python3 news/updater/articles.py check <file>`: 1,100 to 3,200 words, at least three sections, no quotation over 25
words, at least six sources from four outlets, each cited, the date matching the time written, and, when the report
carries Portuguese and German translations (`i18n`), that each is complete and keeps the sections and citations. Then
`articles.py index` rebuilds `articles/index.json`, which the page reads. The page shows the newest on the front for
four days and keeps all of them under Reports.

## The Epstein files (`files.py` -> `data/files.json`)

A compact index of Inbox Atlas's archive (`inbox-atlas/data/atlas.json.gz`): the counts, its sourced stories, the
timeline, emails by year, the people who wrote most, and the 900 newest emails Inbox Atlas marks as notable, with
excerpts and links to jmail.world and the source PDF. Emails Inbox Atlas files under sensitive categories, and
duplicates, are left out. Run `python3 news/updater/files.py` again when Inbox Atlas's archive changes. The desk also
lists the current edition's stories tagged Epstein.

## Pictures and video (`media.py` -> `data/media.json`)

Runs after the edition, with a four-minute limit that can't hold up the edition's commit.

- **Pictures:** about half the stories arrive with a picture in their feed. For the leading stories and desks that
  arrive without one, `media.py` reads the article page's own share image (`og:image`, the picture the outlet picks
  for link previews). A share image the same outlet uses on two different stories is a logo and is dropped. Pictures
  stay on the outlets' servers; the page asks a few image servers (NYT, BBC, Fox) for a larger size where the URL says
  how, and falls back to the feed's picture.
- **Video:** the public YouTube feeds of about 30 news channels (`CHANNELS`), the last two days of uploads. Each feed
  is checked against the channel's own name, so a wrong id can't slip in; YouTube's feed answers 404 now and then for
  real channels, so a failed channel is tried twice and keeps its videos from the last run. Each video is filed under
  a desk with the edition's own classifier and tied to the story cluster whose headlines share its distinctive words.
  Shorts are flagged. The page plays them in YouTube's privacy-enhanced embedded player (youtube-nocookie.com).
- **Slideshows** are built in the page from the edition, so they follow the reader: the day in pictures (the leading
  stories), For you (once the page has learned what you read), one per desk and per busy topic, today's video and
  news shorts, and one per story from every outlet's picture. On a phone they play as stories (tap the right side for
  the next, the left for the last, hold to pause, swipe down to close); on a computer as a wide gallery with a
  filmstrip and the arrow keys. ⇆ switches either way.

## Link previews (`share.py`)

What iMessage, X, Facebook, LinkedIn, Slack and WhatsApp show when someone shares a link. The page's Open Graph and
Twitter tags carry the pitch and the site's card, `news/share.png` (1200 x 630, redrawn with `share.py --site`). Each
report gets its own card and share page, `news/r/<id>.png` and `news/r/<id>.html`, with its headline, summary and
byline; the share page sends a person straight on to the report, and lets link-preview bots read its tags. The Share
buttons (top of the page, each report, each slideshow) open the phone's share sheet, or copy the link on a computer.
`.github/workflows/share.yml` draws the cards when a report is pushed, and the news workflow does it too as a backstop.
Pillow draws them with Instrument Serif and Instrument Sans (`updater/fonts/`, SIL Open Font License).

## Elections

The Politics and Brazil desks, and the front page around an election, read the Election Desk
(`election2026/data/model.json`, `markets.json`) and the Brazil desk (`brazil2026/data/model.json`) live from this
site, so they are as fresh as those desks' own updaters. On count night the Brazil card also reads the TSE's national
file straight from the TSE every minute.

## Changing it

- **Add or drop a source:** one line in `feeds.json` (`name`, `url`, `section`; `domain` for the outlet; `lean` for a
  general feed whose stories default to World rather than U.S.). Then Run workflow.
- **Tune sorting or tags:** `run.py` (`SECTION_WORDS`, `PATH_SECTION`, `TOPICS`). Rebuild the last edition without the
  network to see the effect: `python3 news/updater/run.py --offline`.
- **The page:** `news/index.html`, one file.

## Languages: English, Portuguese, German

- **The interface** is translated in the page: `T('English text')` looks the phrase up in `news/i18n/<lang>.json`
  (`t`: phrase to translation, `"text|context"` keys when one English word needs two translations, `{slots}` filled
  in; `re`: patterns for text with numbers in it, `{N}` a number and `{X}` any text). Whatever the page draws without
  `T()` is caught by a watcher that translates text and the `aria-label`, `placeholder` and `title` attributes as they
  appear, skipping headlines, summaries and outlet names (the `SKIP` list). The language comes from `?lang=pt|de|en`,
  then the reader's last choice (`localStorage` `watch.lang`), then the browser's languages. `?lang=xx` is a test mode
  that records every phrase with no translation in `window.__watchMissing`.
- **Adding a phrase:** add it to both files. A phrase missing from a file shows in English; nothing breaks.
- **Dates and numbers** use `Intl` with the reader's locale (`pt-BR`, `de-DE`). The markets summary is written from the
  numbers in whole sentences per language, never assembled word by word.
- **Sources:** feeds with `"lang": "pt"` or `"de"` in `feeds.json` (about 35: g1, Folha, Estadão, UOL, BBC News Brasil,
  CNN Brasil, Agência Brasil, Poder360, Valor, InfoMoney, ge, Público, Observador; tagesschau, Spiegel, Zeit, FAZ, SZ,
  DW, Tagesspiegel, Handelsblatt, heise, kicker, NZZ, ORF). Their items carry `l`, file by the URL path and their
  feed's desk (the topic and name learners are English-only), and lead their own lists, `topLang.pt` and `topLang.de`,
  which head the front page for readers in that language; everywhere else a reader's own language weighs 1.7 and
  other non-English items 0.3. Headlines and summaries are never machine-translated: they stay the outlet's own.
- **Reports** carry `i18n.pt` and `i18n.de` (title, dek, the whole body, the translating model), written by the
  daily report task and checked by `articles.py check` (complete, same sections, same citations). The page shows the
  translation with a link to the English original, and the index carries the translated titles.
- **Link previews:** `share.py --site` draws `share-pt.png` and `share-de.png` and writes `pt.html` and `de.html`,
  whose tags carry the pitch in that language and which send people on to `./?lang=pt` or `de`; a translated report gets
  `r/<id>.pt.html` and `.de.html` with their own cards. The Share buttons use them when the reader's language is pt or de.

## The For You picks

All in the page, in the reader's own browser (`localStorage` key `watch.v1`): opening a story's sheet, opening the
outlet's page, staying there more than about 35 seconds, time on a desk's page, searches, More / Less like this,
Follow and Hide. Each adds weight to the story's desk, outlet and tags; weights halve every two weeks. Nothing about
reading leaves the browser. Your compass (top right) shows and edits it; Start over clears it.

## Size

Each edition is about 450 KB of JSON (about 110 KB over the wire); the markets file about 150 KB; the Epstein files
index about 380 KB; Zillow's ZIP table about 2.2 MB (about 700 KB over the wire), read only on the Home desk. Six commits a day add a few hundred KB to the
repository's history per day after compression.
