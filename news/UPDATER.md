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

1. Reads every feed in `news/data/feeds.json` (about 120; 20 at a time, 18-second timeout, one retry).
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
Food and Long reads, plus two pages that are not feed desks: Reports and the Epstein files.
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
words, at least six sources from four outlets, each cited, the date matching the time written. Then
`articles.py index` rebuilds `articles/index.json`, which the page reads. The page shows the newest on the front for
four days and keeps all of them under Reports.

## The Epstein files (`files.py` -> `data/files.json`)

A compact index of Inbox Atlas's archive (`inbox-atlas/data/atlas.json.gz`): the counts, its sourced stories, the
timeline, emails by year, the people who wrote most, and the 900 newest emails Inbox Atlas marks as notable, with
excerpts and links to jmail.world and the source PDF. Emails Inbox Atlas files under sensitive categories, and
duplicates, are left out. Run `python3 news/updater/files.py` again when Inbox Atlas's archive changes. The desk also
lists the current edition's stories tagged Epstein.

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

## The For You picks

All in the page, in the reader's own browser (`localStorage` key `watch.v1`): opening a story's sheet, opening the
outlet's page, staying there more than about 35 seconds, time on a desk's page, searches, More / Less like this,
Follow and Hide. Each adds weight to the story's desk, outlet and tags; weights halve every two weeks. Nothing about
reading leaves the browser. Your compass (top right) shows and edits it; Start over clears it.

## Size

Each edition is about 450 KB of JSON (about 110 KB over the wire); the markets file about 150 KB; the Epstein files
index about 380 KB; Zillow's ZIP table about 2.2 MB (about 700 KB over the wire), read only on the Home desk. Six commits a day add a few hundred KB to the
repository's history per day after compression.
