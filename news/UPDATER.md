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
   News desks keep 36 hours; Cars, Travel, Food, Lifestyle and Long reads keep 96; Hobbies keeps a week.
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
Food, Lifestyle, Hobbies and Long reads, plus pages that are not feed desks: Reports, Pictures, Video, Shopping (Finds' feed, `shop/data/feed.json`) and the Epstein files. Travel and Shopping also read Weekender's `travel/` data; pins go to Vision (`vision/`) through the browser.
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

## Sports (`sports.py` -> `data/sports/`; the page's part in `news/sports/`)

The Sports desk opens with the day's games across the leagues, and each league has its own page: the NFL, NBA, MLB,
NHL, WNBA, MLS and soccer (the Premier League, the Champions League, LaLiga, the Bundesliga, Serie A, Ligue 1, the
Europa League and the Brasileirão). On every news run `sports.py` reads ESPN's public scoreboard, standings, teams and
news service (`site.api.espn.com`), which answers GitHub's runners, and writes one file per league:
- the games: a few days back to a week or more ahead, one day at a time (ESPN takes one date per request); the NFL by
  week, last week to two weeks on, with the season's week calendar and the teams on a bye. Each game carries the score
  and line score, the status, the series or round ("World Series - Game 3", "MIL leads series 2-0"), the venue, the
  national TV and streaming services and the teams' local channels, ESPN's lowest ticket price and how many are for
  sale with its ticket partner's link, the betting line before kickoff, the recap headline after, and while it's on the
  count and runners (baseball) or the down and distance (football);
- the standings (the NFL, NBA, NHL and MLB by division; soccer tables with ESPN's qualification and relegation notes);
- the teams (names, colors, logos, which competition);
- the league's news: ESPN's own list, CBS Sports, The Athletic, Yahoo Sports and a few others per league (Pro Football
  Talk, MLB.com, the Guardian and BBC Sport for soccer, a Google News search for MLS kept to sports outlets), deduplicated,
  tagged with the teams they name, no outlet more than half the list.

`data/sports/index.json` has every league's state in a line (the phase of the season, live and today's games, the
next game, a champion once a final is over), today's games across the leagues, and the big ones (finals and playoff
games, the NFL's night games, the Champions League). A league that fails keeps its last good file; `python3
news/updater/sports.py check` validates them, and `--record DIR` / `--replay DIR` save and replay every answer for tests.

The page loads `news/sports/sports.js` and `sports.css` only when a Sports page opens (`ensureSports()` in
`index.html` hands them the page's helpers as `window.WatchKit`). ESPN lets browsers read it, so while a page is open
the scores come live from ESPN, every 30 seconds while a game is on, and the edition's files are what draws first and
what shows, dated, if ESPN can't be reached. Pages: `#/s/sports` (the desk), `#/sports/<league>/<scores|schedule|
standings|news|teams>`, `#/sports/soccer/<competition>/...`, a game at `#/sports/<league>/g/<id>` (live from ESPN's
game summary: line score, win probability, scoring plays or goals and cards, leaders, team stats, the box score,
injuries, the last five games) and a team at `#/sports/<league>/t/<id>` (its schedule and results from ESPN, its
standing and its news). Readers can follow teams (kept in their browser, `watch.teams`): their games come first on the
desk and the schedule and news can be narrowed to them. Ticket buttons list ESPN's price and links to search Vivid
Seats, SeatGeek, StubHub, Ticketmaster and Gametime for that game; nothing is bought or collected here.

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

## Film Room: fantasy football (`fantasy.py` -> `news/sports/fantasy/data/film.json`)

The Sports desk opens with Film Room (`news/sports/fantasy/index.html`), one static page that reads `film.json` and does
all the scoring-dependent math in the browser (fantasy points, expected points, matchups, projections, tiers,
replacement level, lineups and trades), so every reader's own scoring applies. `.github/workflows/fantasy.yml` runs
`python3 news/updater/fantasy.py` every three hours (and by hand), then `fantasy.py check`, and commits the data folder.
What it reads, all public and keyless:
- nflverse (GitHub releases, CC-BY 4.0): weekly player and team stats, play-by-play (red-zone, inside-10, end-zone and
  deep targets and carries per player-week; pace, neutral pass rate, pass rate over expected and red-zone trips per
  team-week), Pro Football Reference snap counts, the official injury report (a player counts as listed only on his
  team's newest report), current rosters and ids, and the newest depth-chart snapshot (the file holds every daily
  snapshot, newest first, so only the first one is read); the schedule with Vegas spreads and totals from nfldata.
- ffverse ffopportunity: expected receptions, yards and touchdowns for every player-week.
- DynastyProcess: FantasyPros expert consensus ranks (weekly, rest of season), rostered share, dynasty values and the
  player-id crosswalk. The page uses the weekly ranks only when they were scraped for the week being studied.
- Sleeper: trending adds and drops and Sleeper's projections for the study week, when the runner can reach it.
- Headlines: Google News searches for fantasy football, waivers, start/sit and injuries, Rotoballer's feed, and The
  Watch's own NFL stories (`news/data/edition.json`), each tied to the players it names.
The study week is the week whose last Sunday kickoff hasn't happened yet, so Monday is already next week's homework.
If a core source (stats, schedule, rosters, play-by-play, snaps) fails, the last `film.json` is kept; the optional
ones keep their last copy where they can, and failures are listed in `errors` and in the page's footer. The page
checks `latest.json` every ten minutes. Live scores during a game come from ESPN's public scoreboard and kickoff
forecasts from Open-Meteo, both fetched by the reader's browser.

The projection: each player's recent games, weighted toward the latest (×0.9 per game back; early exits and games for
another team count less), volume taken as is and efficiency blended with expected points (yards 60/40 own/expected,
touchdowns 40/60), expected points recalibrated to the season's league-wide scoring, then the Vegas implied total
against the team's average, game script from the spread (±12% pass or run volume), and the opponent's
defense-versus-position ratio (adjusted for offenses faced, shrunk by sample size, capped at ±18%). Players with under
about three games are blended with what their depth-chart role produces. The weights in `TUNE` were set by
backtesting weeks 4–7 (each week projected from the weeks before it); the Study hall's projections lesson reruns that
backtest in the browser.

## Formula 1 (`f1.py` -> `data/f1.json`, `data/f1/`; `news/f1/`)

The Sports desk opens with a card for the next grand prix, and `#/f1` is a Formula 1 hub with its own tabs:
Overview (the next weekend with a countdown and every session in the reader's time and the track's, the title fight
drawn round by round, the standings, the last race, the calendar, the eleven cars, the season's storylines, news and
video, how to watch), Calendar (`#/f1/calendar`: the season's route on a world map and every round), a page for each
race weekend (`#/f1/race/<round>`: the circuit and its map with corner numbers, the sessions, the podium and a report,
highlights, a lap-by-lap position chart with safety cars and pit stops, tyre strategy, race pace, the full result, pit
stops, race control's messages, weather, qualifying and the sprint), Standings (charts and a points-by-round table),
Drivers (`#/f1/driver/<id>`: season numbers, race-by-race strip, the head-to-head with the teammate, career totals, the
story), Cars (`#/f1/car/<team>`: the car's spec sheet, its ideas, what to look for, the upgrade log round by round, the
season, the people, who powers whom), Rules (the 2026 regulations with their numbers) and News.

The hub's code and look are in `news/f1/app.js`, which `index.html` loads the first time someone opens the hub or
the Sports desk (`loadF1()`, with the page's helpers handed over as `window.WATCH`). Its interface is translated in
`news/f1/i18n.json` (`pt` and `de`, merged into the page's dictionary when it loads); the written text stays in
English, marked so.

`.github/workflows/f1.yml` runs `news/updater/f1.py` every three hours, and every half hour from Friday to Monday
(UTC), committing only when something changed:
- Jolpica F1 (`api.jolpi.ca`, the Ergast-compatible database): the calendar with session times, every race, sprint and
  qualifying classification, the standings, and for each finished race its positions and times lap by lap and its pit
  stops (`data/f1/r<round>.json`, a few races a run, newest first; Jolpica allows 500 requests an hour, so a run spends
  at most 330). Career totals are fetched once a month per driver (six a run) and this season's part is added from
  the classifications on every run.
- OpenF1 (`api.openf1.org`): team colours and driver headshots (the pictures stay on Formula 1's servers), cancelled
  meetings, and for each race its tyre stints, race control's messages (safety cars, red flags, penalties,
  investigations), weather and overtake counts. OpenF1 allows 30 requests a minute, so requests are spaced two seconds.
- MultiViewer's circuit files (linked from OpenF1's meetings): each track's outline and corners, fetched once per
  circuit into `data/f1/tracks.json` (older years are tried for circuits that have no file for this one).
- News from the F1 feeds of Formula1.com, BBC Sport, Autosport, Motorsport.com, The Guardian, Crash.net, Sky Sports, The
  Race and RaceFans (the last two kept to F1), Google News searches in English, Portuguese and German (kept to outlets
  in `GN_OK`), and Motorsport.com's Brazilian and German editions; each story is tied to its race when its headline
  names it. Video from the official Formula 1 YouTube channel; highlights stay all season.

Both Jolpica and OpenF1 allow browsers, so when a session ends before the next run the page asks Jolpica for the
result itself (`topUp()`).

The written half, `news/f1/` (`teams.json`, `drivers.json`, `circuits.json`, `season.json`, `rules.json`), is kept by
a weekly scheduled Claude task on Mondays: a cited report and headline for each finished round, the storylines and
the title arithmetic, each car's concept and upgrade log, each driver's season, circuit guides and tyre choices, the
rules and their in-season changes, how to watch and tickets. Results in `data/f1.json` are the record; written text
must agree with them. `python3 news/updater/f1.py format` prints the format and `python3 news/updater/f1.py check`
enforces it (ids that match the season's, cited text, word counts, no quotation over 25 words).

## Plus One (`plusone.py` -> `data/plusone.json`; `news/plusone/`)

`#/plusone`, in the bar after Late Night, is where the Sports, Lifestyle and Culture desks meet: athletes and the
partners beside them who are public figures in their own right. Each of those three desks carries a card for it, and
the F1 hub's Drivers page and driver pages show the paddock's couples ("Off track"). The section opens with the couples
in the news this week, a calendar of the next two weeks (each athlete's next game or race, from the Sports desk's
`data/sports/<league>.json` and the F1 hub's `data/f1.json`, and the partners' dated releases, premieres and events),
every couple with filters by sport, by the partner's field and by status, the style file (Lifestyle), the culture desk
(the partners' own work, coming up and just out) and the news about them. Each couple has a page (`#/plusone/<id>`):
the athlete's side with the next game, the partner's side with their work, their story, the milestones they made
public, style, culture, the news and the sources. `#/plusone/<league>` opens the list filtered.

The standards, which the weekly task and `plusone.py check` hold to: only couples who are public about their
relationship (they went public themselves, and at least two established outlets reported it), only partners who are
public figures in their own right, both adults; nothing about children, homes, health, pregnancy, money, bodies or
looks; no rumours; established outlets only, never tabloids; a couple that splits up is removed, not written about.

- `news/plusone/couples.json` is written and re-checked by a weekly scheduled Claude task (Tuesdays): it confirms every
  couple is still together (`checked` is that date; `check` fails a couple not checked for three weeks), looks first at
  any couple in `data/plusone.json` "alerts", updates the statuses, milestones and the partners' projects, and adds
  couples. `python3 news/updater/plusone.py format` prints the format.
- `news/updater/plusone.py`, run every three hours by `.github/workflows/plusone.yml`: for each couple, a Google News
  search for both names (and in Portuguese or German for couples with a Brazilian, Portuguese or German side) plus the
  current edition, kept to established outlets (`OK`; tabloids in `NEVER` are never read) and without headlines about
  pregnancies or bodies; headlines about a split go into "alerts" for the weekly task.
- The code and look are in `news/plusone/app.js` (loaded by `loadPlus()` in `index.html`); its interface in Portuguese
  and German is `news/plusone/i18n.json`; the written text stays in English, marked so.

## Lifestyle

Style, relationships, home life and how-to, from the New York Times' Style desk, the Guardian's Life and style and
Relationships, Vogue and GQ directly, and The Cut, Esquire, Real Simple and Well+Good through Google News site
searches. A general feed's story files here when the outlet put it under /style/, /fashion/, /lifestyle/, /relationships/,
/weddings/, /parenting/ or /family/. The desk opens with Together / 90 (`news/lifestyle/together-90/`), a 90-day workbook
for couples that runs entirely in the reader's browser: no account, nothing sent here, answers kept in that browser's
storage and moved between the two partners by a shared folder, a direct browser-to-browser link or a file.

### Date Night (`news/lifestyle/date-night/`)

An evening for two, planned in the reader's browser; nothing runs on the server and nothing is stored here. The card sits
after Together / 90 on the Lifestyle desk, and the Travel desk and every Weekender guide link to it.

- **Where:** a ZIP code, a city or a neighborhood (Open-Meteo's geocoder, and OpenStreetMap's Nominatim for neighborhoods),
  the reader's location, the place The Watch's weather already knows (`watch.wx`), or one of Weekender's eight cities,
  started from the city center or a neighborhood in that weekend's guide.
- **The places:** OpenStreetMap through the Overpass API (four public servers; the next is asked when the last hasn't
  answered in 8 seconds, and the first good answer wins; the last four places are kept in the browser for 12 hours): restaurants, bars, pubs,
  taprooms, cafés, dessert, bookshops, cinemas, theaters, music venues, bowling, escape rooms, arcades, museums, parks,
  viewpoints and piers within a walk (about 1.2 km for food, 1.8 km for things to do) or a drive (4.5 and 9 km); smaller
  radii in Weekender's cities. Where there are fewer than four restaurants within a walk it widens to a drive and says so.
  In a Weekender city the guide's evening stops join in, with their own words and booking links. For walking plans
  in those cities the places are read ahead: `.github/workflows/date-night.yml` runs `prefetch.py` when a guide lands
  (and on Tuesdays) and writes `news/lifestyle/date-night/data/<city>.json`, everything within a walk of the city center
  and of each neighborhood the page offers from that guide; the page falls back to the live servers without it.
- **Open when you get there:** each place's `opening_hours` is read for the night and time it's scheduled (the common
  subset of the syntax: days, months, times past midnight, `off`, `24/7`; anything else, such as sunset or holidays,
  counts as unknown, never as open). Places closed then are left out; places with no hours are allowed but say so.
- **The plans:** three shapes per mood (classic, cozy, playful, cultured, outdoorsy, late, easy), two to four stops,
  each stop scored on being open, being near the last stop, what the map knows about it, the reader's food likes, skips,
  diet and budget, and not being a chain; the three plans don't share a dinner. Rain or cold swaps walks for indoor stops;
  the outdoorsy plan is timed for sunset; after dark, walks go only to viewpoints, piers and lit places. Any stop can be
  swapped or kept for the next shuffle.
- **Around it:** the evening's weather and sunset (Open-Meteo), drawn as the evening's sky behind the stops; what's on
  that night in a Weekender city (the guide's events) or event and film searches; walking and driving directions, rides,
  OpenTable searches; three questions for the walk home.
- **Sending it:** a link that carries the whole plan in its `#/p/...` fragment (no server), an `.ics` file and a Google
  Calendar link with the place's time zone, and a pin to Vision (`vision.inbox`).
- **Claude, optionally:** with the key the Food desk uses (`watch.akey`), the best places for the evening (about 90) go
  from the browser to Anthropic's Messages API and come back as three plans in Claude's words, built only from those
  places; ids that aren't on the list are dropped.
- The reader's choices are kept in `localStorage` as `watch.dn`. The page reads The Watch's theme (`watch.v1`).

## Hobbies (`hobbies.py` -> `data/hobbies.json`; `news/hobbies/`)

`#/s/hobbies`, between Lifestyle and Long reads: dressage, woodworking and poker to start, each with its own page at
`#/hobby/<key>`. A hobby is one entry in `news/hobbies/guide.json`, so adding one is a guide entry plus its feeds.

- **The wire:** feeds in `feeds.json` with `"section": "hobbies"` and `"hobby": "<key>"`. A hobby feed's stories always
  carry the hobby (`it.h`) and its topic (`#dressage`); a broad feed can be narrowed with `"match"` (a regex the title,
  summary or link must hit) and cleaned with `"skip"`. Stories from every other desk join a hobby when the edition tags
  them with its topic (`TOPICS` in `run.py`), so a poker story on the Sports desk shows on the poker page too. The desk
  keeps a week of stories, because the hobby press publishes a few times a week.
- **Videos:** on every news run `hobbies.py` reads the guide's YouTube channels for each hobby (the last 45 days, four
  a channel, each feed checked against the channel's own name, Shorts left out). A channel that covers more than the
  hobby (the FEI's also shows jumping) carries a `"match"` its videos must hit. They play in YouTube's
  privacy-enhanced player.
- **The guide**, curated by Claude: the channels, the calendar (every date with the page that confirms it; past events
  drop off), where to start, the words to know, and Portuguese and German for all of it. `hobbies.py check` enforces the
  format (`hobbies.py format` prints it).
- **Features**, `news/hobbies/features/<id>.json`: in-depth pieces in the Reports format with `"desk": "hobbies"` and a
  `"hobby"`, checked by the same rules as a report (`hobbies.py check <file>`), indexed by `hobbies.py index`, opened at
  `#/hf/<id>`.
- **In the page:** each hobby page has a small tool that runs in the browser and remembers its numbers there
  (`localStorage` `watch.hobt`): a dressage test's percentage from its marks and coefficients, board feet and cost for a
  cut list, and pot odds, minimum defense and stack depth (big blinds and M) for poker. Calendar dates download as
  `.ics` files.

A push that changes `feeds.json`, `run.py`, `hobbies.py` or the guide runs the news workflow, which rebuilds the
current watch's edition, so a new hobby or source is in the paper within minutes.

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

## Reel Check (`news/home/reel-check/`, `reel.py`)

Viral DIY build videos (often AI-made) tested against the physics, linked from the Home desk. Each build is one JSON
file: the article (Markdown body with numbered citations, at least five sources from four outlets), a verdict scored
as shown and done right, and a build kit the page draws: one or two options to size it, metrics per size, a priced
bill of materials, and phases with a go/no-go check each (readers' ticks stay in `localStorage` `watch.reel`).
`python3 news/home/reel-check/reel.py format` prints the format and `check <file>` enforces it. Published builds are in
`builds/` (with `builds/index.json`); scheduled ones wait in `queue/` named for their publish date, and
`.github/workflows/reel-check.yml` runs `reel.py release` each morning to move the day's build live. `tools/` holds
the brief and each build's generator and text.

## Reports (`news/articles/`, `articles.py`)

One in-depth report a day, written by Claude through a scheduled task. Each is a JSON file named for its id
(`2026-10-25-some-slug.json`): title, dek, desk, `byline: "Claude"`, the exact model name, the time written (with its
UTC offset), a Markdown body with numbered citations, and the sources. Before committing, the writer runs
`python3 news/updater/articles.py check <file>`: 1,100 to 3,200 words, at least three sections, no quotation over 25
words, at least six sources from four outlets, each cited, the date matching the time written, and, when the report
carries Portuguese and German translations (`i18n`), that each is complete and keeps the sections and citations. Then
`articles.py index` rebuilds `articles/index.json`, which the page reads. The page shows the newest on the front for
four days and keeps all of them under Reports.

A report can name its companions: `"related": ["<id>", ...]` lists the other reports in the same package, and the page
shows them under the sources as "More on this story". `"package"` is a free label for the set.

## The wave (`news/wave/`; `election2026/updater/fetch_counties.py`, `fetch_night.py`; `news/wave/build.py`)

The front page opens with a 3-D map of every county's move from the 2024 presidential vote to the 2026 Senate or
governor vote (the wave), with the election-night replay one tap away; both open the story at `news/wave/`, which
carries the write-up, five area pieces (`south-texas.html`, `southeast.html`, `midwest.html`, `deep-south.html`,
`moved-right.html`) and a county explorer. Everything is drawn in the browser from the data by `wave/wave.js`
(three.js and earcut, vendored in `wave/lib/`); `wave/wave.css` styles the HUD, `wave/article.css` and `article.js`
the pages.

- `.github/workflows/counties.yml` (every three hours until Nov. 30, 2026, and by hand) runs `fetch_counties.py`,
  which reads The New York Times' public results files, one per state (AP's county-level counts and calls), and
  writes `election2026/data/counties2026.json`; `fetch_night.py` reads the Senate, governor and House files for every
  race's call time, the House districts' counties and the poll-closing times into `night2026.json`. The sandbox cannot
  reach nytimes.com, so these run only on the Action.
- `news/wave/build.py` compares each county with `election2026/data/baseline.json` (2024) and writes
  `wave/data/shift.json` (margin 2024, margin 2026, the move, votes, which race) and `wave/data/night.json` (the
  calls by minute from 6 p.m. ET, each House district's counties, poll closes, and a counting-pace constant per state
  fitted to the "% in" the Election Desk recorded during the night). The left side of a race is the Democrat, or the
  independent who out-polled the Democrat (Osborn, Bodnar, Achilles, Bengs), and the file says so. Connecticut's
  towns are summed into counties; a city AP reports inside a county it also reports whole is skipped.
- `news/wave/tools/make_pages.py` writes the six pages and `wave/pages.json` (the front's hero reads it) from the
  data, so every number in the text follows the count. The Action runs it after the build and commits the pages.
- The link previews (`wave/share.png`, `wave/<area>.png` and the `.mp4`s the `og:video` tags point at) are rendered
  by hand from `wave/render.html` with Playwright (frames at 1200 x 630, ffmpeg); they are not refreshed by the Action.
- The front's hero (`heroHTML()`, `heroMount()` in `index.html`) loads `wave/wave.js` the first time the front draws
  and unmounts it when the reader leaves; the reader's last view (wave or night) is kept in `watch.hero`.

### The wave, written (`news/wave/tools/write.py`; `.github/workflows/wave-write.yml`)

Claude, through Anthropic's API (Claude Opus 5.5), writes two more layers over the data:
- **A piece for every state with a race** (45), `wave/data/reports/<ST>.json`, published as `wave/<state-name>.html`
  with the map turned on that state and four county callouts the piece chose. One Messages call per state, with web
  search (up to 12 searches, `user_location` set to the state) and `output_config.effort` high: the state's data block
  (the races, every county, the biggest moves and counties, Census context) goes in the prompt, every vote number must
  come from it, and every claim from the web carries the search's own citation, which the page renders as a numbered
  source. The reply follows a fixed skeleton (HEADLINE / DEK / SUMMARY / BODY / CALLOUTS); `parse_skeleton()` keeps each
  citation at the end of the text block it supports. About $3–4 a state. A piece is rewritten when a race is called or
  its margin moves more than a point (`state_stale()`).
- **A note for every county** (about 2,775), `wave/data/notes/<ST>.json`, one file per state, shown when a reader taps a
  county on the map (`onPick` in `wave.js`, the card under the map in `article.js`) or a row of the explorer. A Message
  Batch (half price), effort low, from the county's numbers, its rank in its state, three comparable counties and the
  Census figures, nothing else; about a cent each. A note is rewritten when the county's move changes by more than a
  point or its count passes 95% (`note_stale()`). A batch still out is recorded in `data/notes/_batch.json` and picked
  up by `collect`.
- **Census context**, `wave/data/context.json`: population, median household income, Hispanic and Black shares and the
  share of adults with a degree from the ACS 2023 five-year estimates (`api.census.gov`, keyless; `CENSUS_API_KEY` is
  optional). Connecticut's planning regions don't match the map's counties, so it has none.

Every response's usage is priced (`PRICE` in `write.py`: the published rates, batch at half) and appended to
`wave/data/spend.json`; `write.py cost` sums it. A run stops starting new pieces once its `--budget` is spent, and a
batch is sized to fit its budget before it is submitted. The workflow needs the repository secret `ANTHROPIC_API_KEY`.
**Run workflow** with `job: both` writes everything (`budget` for the pieces, `counties_budget` for the notes); the
schedule (every six hours until Nov. 30) runs `refresh`, which collects a pending batch and rewrites what the count
has moved, within $3.50 a day. `write.py check` validates the files (word counts, no quotation over 25 words, callouts
on the map); `--mock` writes made-up pieces to test the pages without the API; `--dry` prints a prompt.
`make_pages.py` builds the state pages from the reports, lists them on the main page (“Every state”) and in
`pages.json` (`states`, `notes`), and tells each page which states have notes (`WAVE_PAGE.notes`, `statePages`).

## The front package (`data/front.json`)

When one story should lead the front page, `news/data/front.json` puts a package above the lead from the feeds: a lead
report with its headline, summary and byline, a short "how it plays out" list, an optional line of arithmetic, the
companion reports, and (with `"count": "us"`) the election count below. The page reads the file when it loads; nothing
is rebuilt. The Politics desk opens with the same package in a compact form.

```json
{"v": 1, "id": "hegseth-impeachment", "from": "2026-11-05T12:00:00Z", "until": "2026-11-10T05:00:00Z",
 "kicker": "After the midterms", "lead": "<report id>", "sides": ["<report id>", ...], "sidesTitle": "More on the vote",
 "hero": {"type": "hemicycle", "seats": [{"n": 214, "c": "dem"}, {"n": 1, "c": "brass", "front": true, "mark": true},
          {"n": 2, "c": "need", "front": true}, {"n": 216, "c": "rep"}], "label": "Thomas Massie", "sub": "+ 2 more Republicans", "alt": "..."},
 "path": {"title": "How it plays out", "steps": [{"when": "Week of Nov. 9", "t": "The House returns", "d": "one or two sentences"}]},
 "math": {"title": "The House math", "terms": [{"n": "214", "l": "Democrats", "c": "dem"}], "sum": {"n": "217", "l": "a majority"}, "note": "..."},
 "count": "us",
 "i18n": {"pt": {"kicker": "...", "sidesTitle": "...", "path": {...}, "math": {...}}, "de": {...}}}
```

- It shows from `from` until `until`, and only while the lead report is in `articles/index.json`. To take it down
  early, delete the file or set `until` to a time in the past. To replace it, write a new one.
- `hero`, `path`, `math`, `sides` and `count` are each optional. A term's `c` is `dem`, `rep` or `brass` (its colour).
- `hero` is the package's picture, drawn in the page so nothing is copied from anyone: `hemicycle` is a chamber seat
  by seat, dots on a half circle, the groups in `seats` laid out left to right (`c`: `dem`, `rep`, `brass`, or `need`
  for a ringed seat). A group with `front` takes the seats nearest the front row at its boundary, and the `mark` group's
  first seat is drawn large with `label` and `sub` under it. With a hero, the picture and the arithmetic sit beside
  the headline and the steps run across below; without one, the steps sit beside the headline. Photographs are not
  used here unless the site holds the rights to them.
- `i18n.pt` and `i18n.de` replace `kicker`, `sidesTitle`, `hero`, `path` and `math` whole for readers in those
  languages; the reports' own titles and summaries come from their translations.
- Every line in `path` and `math` is a claim: keep each one to what the lead report says and cites, with the same
  hedges (who says it, "if every member votes"), and change the file when the facts move.
- While a package is up, Today's report shows the newest report that is not in it.

After Election Day the U.S. election card (the package's count, the Elections section on the front and the Politics
desk) stops showing markets and polls and shows the count instead, worked out in the page from the Election Desk's
`model.json`: for the Senate and the governors, the seats that were not on the ballot plus every race the desk has
recorded as called; for the House, the desk's count of AP's calls with its time; then the seats that changed party and
each uncalled race with its leader and margin. It is as fresh as the Election Desk's last pass and never calls a race
itself. The front keeps the count for three days after the election, or two weeks while a race is still uncalled.

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
- **The Reel** is the same viewer in a third mode (`reel-<context>` shows, built in the page by `reelVids`): short
  videos first, then the rest, one swipe up to the next, and the next one by itself after the reader's own time
  (`P.reelAuto`: 15, 30, 60 or 90 seconds, or 0 for only when the video ends; `P.reelMute` for the sound). The
  embedded player is opened with `enablejsapi` so it can say when a video ends and take a tap to pause or play; if it
  stays quiet for eight seconds the clock runs anyway. Contexts: `all`, `desk:<k>` (the desk's news videos, plus the
  garage's on Cars and the hobbies' on Hobbies; a desk with fewer than three gets today's reel after its own),
  `garage`, `late` and `hobby:<k>`. The floating Reel button on every page, the reel rows on the front, the desks,
  the video and pictures pages, the garage, Late Night and the hobby pages, Video › Reel in the bar and `#/reel/<context>`
  all open it.

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
- **The page:** `news/index.html`, one file, plus `news/sports/sports.js` and `sports.css` for the Sports pages.

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

### Brazil's runoff, followed up on the front

Readers who looked at Brazil's race get the post-mortem (the report, plus The Hinge's Brazil tab) pinned at the top of
the front page until they open it or close it, for up to three visits (`brFrontCard()`, until Nov. 30, 2026). "Looked at
the race" means any of: `watch.br` (written when the Brazil desk here opens, when a Brazil story or report is opened, by
the Brazil desk at `../brazil2026/` on every visit and by The Hinge's Brazil tab); `br26.*` (the Brazil desk's saved
language or map choice, which covers visits from before this existed); Brazil-desk weight or a Lula / Bolsonaro / TSE
tag in `watch.v1`; or reading The Watch in Portuguese. Someone who has already opened the report or the Hinge tab
(`watch.br.hinge`) sees it once. The count and the closed state live in `watch.brmiss`. While it is pinned, the
Today's report slot skips the same report.

## Weather (`#/weather`)

The reader's forecast (Open-Meteo: now, 24 hours, ten days, air quality), the National Weather Service's warnings,
radar loop and forecaster text for U.S. places, the Storm Prediction Center's outlook for the day (and whether the
reader's spot is inside a risk area), the severe and extreme warnings in force nationwide, the National Hurricane
Center's active storms and seven-day outlooks, the weather news from the edition, and **the airports**: live METARs,
TAFs and FAA ground stops and delay programs from Meridian's feed (`meridian-feed` branch, every 5 minutes), shown as
flight categories with the nearest airport's observation on the forecast card. All of these allow browsers to read
them, so the page fetches them live. Two things don't, so `news/updater/weather.py` writes them into
`news/data/weather.json` with every run of the news workflow: Meridian's station list (from `meridian/index.html`) and
the hurricane center's active storms. The place a reader picks (search, ZIP code, or their device's location) is kept
in their browser (`watch.wx`); until then the page guesses from the time zone and says so. The masthead shows the
temperature there, and the front page carries a red band while a severe or extreme warning is in force for it. Readers can
star up to ten of Meridian's airports (`watch.wxapt`, also in the browser); those sit at the top of the airports section
with the decoded METAR, the TAF and the D-ATIS, and the front page gets a dark band when one of them has an FAA program,
IFR or LIFR conditions, or thunderstorms.

## Size

Each edition is about 450 KB of JSON (about 110 KB over the wire); the markets file about 150 KB; the Epstein files
index about 380 KB; Zillow's ZIP table about 2.2 MB (about 700 KB over the wire), read only on the Home desk. Six commits a day add a few hundred KB to the
repository's history per day after compression.

## My Watch (`news/my/`) and the personal pages

My Watch is the reader's own front page: cards for the sites they use (headlines per outlet, sections, topics),
markets, scores, fantasy, weather, prompt ideas, bills, Runway Rewards (card credits, shared with Points Hacker's
`wk.wallet` / `wk.used`), Together / 90 (reads the workbook's own save), launchers, Ask AI, notes and to-do.
Everything the reader sets lives in their browser (`watch.my.v1`). It reads the same `data/` files as the paper.

A personal page is a preset: `news/my/people/<slug>.json` (title, description, share text, the cards) becomes
`/<slug>/index.html` and `/<slug>/share.png` (the link preview) when you run `python3 news/my/build-people.py`.
Re-run it after changing `news/my/index.html` or a preset. The page keeps its own layout in `watch.my.<slug>`,
and a changed preset nudges a reader who already has the page to load the new layout from Settings.
`node news/my/build-t90.js` refreshes `news/my/t90.json` (the day list the Together / 90 card uses) after the
workbook changes.

## JSON sources

A feed whose response is JSON (`"json": true`, or a body that starts with `{` or `[`) goes through
`read_json_feed()`: a JSON Feed, or any API whose stories are a list of objects with a title. Field names are
tried from short lists (`url`/`link`/`permalink`…, `date_published`/`published_at`/`date`…, `thumbnail`/`image`…),
and `"link": "https://site/blog/{id}/{slug}"` builds links from fields when the items carry none. Barstool's
story API is the first one.
