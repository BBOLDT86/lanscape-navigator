# LANscape Navigator

A serverless, 1990s-style web browser for the files on your own computer. Point it at a folder and it builds you a private little Internet: every page and document gets a domain name, similar pages are linked into web rings, a search engine indexes every word, and documents, music, video and photos open in programs of their own.

**Open it: <https://bboldt86.github.io/lanscape-navigator/>**

Everything runs in your browser. Your files are read on your own device and never uploaded; the index lives in your browser's own storage.

## What it does

- **Domain names for your files.** A page titled "Cayenne Tracker" lives at `www.cayennetracker.com`; a folder with an `index.html` becomes a multi-page website; every folder is also an FTP server.
- **Web rings.** Pages about the same thing are grouped and named automatically, with Prev / Random / Next to surf them (RingHub).
- **Search.** HyperHound ranks every word, with `"phrases"`, `-exclude`, `site:`, `ring:`, `intitle:` and spelling suggestions.
- **Copies and versions fold into one.** `v2`, `Rev 3`, `_final`, `(1)`, "Copy of", dated saves, copied website folders, the same song in MP3 and FLAC, a picture and its resized copy. The newest leads; older ones stay one click away at `/versions/`, with a **Compare** view. Fix anything in the Duplicate Finder.
- **Programs.** Write (`.docx`, `.rtf`, `.md`), Ledger (`.xlsx`, `.csv`), Reader (PDF with mark-ups), Jukebox and LANamp, Rewind (video, MKV included), Photo Album, Slide Show (`.pptx`), ZIP and Font viewers, Calculator, Notepad, and RingHub Pinball.
- **The Spider** reads pages that build their text with JavaScript and paints a preview of each one.

## Using it

1. Open the link above. Chrome or Edge on a computer works best.
2. **File › Add Folder…**, or drag a folder onto the window.
3. Surf from the home page: the Directory, Web Rings, HyperHound, What's New.

It also works offline: save `index.html` and open it from your disk.

| Browser | Notes |
| --- | --- |
| Chrome, Edge | Everything, including re-reading folders by themselves (**Re-sync**). |
| Firefox, Safari | Add folders with the folder picker or drag and drop; pick a folder again to bring in changes. |

## Building from source

The app is a single HTML file assembled from the pieces in `src/`:

```sh
node build.js        # writes index.html
```

`build.js` joins `src/*.js` in name order inside `src/00-head.html` and adds `libs/embedded-libs.html` (pdf.js and pdf-lib, compressed). GitHub Pages serves the `index.html` at the top of the repository, so rebuild and commit it after changing `src/`.

### Tests

The tests drive the app in Chromium with Playwright. They also need Python 3 (Pillow, python-docx, openpyxl, python-pptx, reportlab) and ffmpeg to make their test folders.

```sh
npm install
npx playwright install chromium
npm test
```

## Layout

```
index.html               the app: built, and what GitHub Pages serves
src/                     the source, joined in name order by build.js
libs/embedded-libs.html  pdf.js and pdf-lib, gzipped and base64-encoded
test/                    browser and Node tests, and the scripts that make their test folders
the-hinge/index.html     The Hinge, a separate page (see below); www.thehinge.com inside the app
inbox-atlas/             Inbox Atlas, a separate site (see below); www.inboxatlas.com inside the app
wx-center/index.html     WX Center, a separate page (see below); not part of the app
meridian/index.html      Meridian Flight Control, a separate page (see below); not part of the app
meridian/updater/        Meridian's weather-feed updater (run by .github/workflows/meridian.yml; see meridian/UPDATER.md)
election2026/            Election Desk 2026, a separate site (see below); www.electiondesk2026.com inside the app
pinfall/                 Pinfall, a separate page with its home-screen icons (see below); not part of the app
news/                    The Watch, a news site that updates six times a day (see below); www.thewatch.com inside the app
barnlife/index.html      Central Ohio Barn Hunt, a separate page (see below); not part of the app
```

## Also hosted here: The Watch

**Open it: <https://bboldt86.github.io/lanscape-navigator/news/>**

The news six times a day, one edition for each ship's watch, Eastern time: Middle (12 a.m.), Morning (4 a.m.), Forenoon (8 a.m.), Afternoon (12 p.m.), Dog (4 p.m.) and First (8 p.m.). Each edition reads about 120 public news feeds across 13 desks (U.S., World, Politics, Business, Tech, Science, Health, Sports, Culture, Cars, Travel, Food and Long reads), groups the stories that several outlets are covering, and ranks them by how widely and how recently they're covered. Open any story to see how every outlet is covering it, side by side.

It learns from its reader. The For You picks and the order of the desks on the front follow what you open, how long you stay with it, what you search for, and what you tell it (More or Less like this, Follow a topic, Hide an outlet), with a reason under each pick and, now and then, something outside your usual. That record stays in your browser; Your compass shows it and lets you change it. The watch dial at the top opens the day's earlier editions.

A GitHub Actions workflow (`.github/workflows/news.yml`) runs `news/updater/run.py` once per watch and commits `news/data/edition.json`. Standard-library Python, no keys. See [news/UPDATER.md](news/UPDATER.md).

## Also hosted here: The Hinge

**Open it: <https://bboldt86.github.io/lanscape-navigator/the-hinge/>**

The forecast is built from source: `the-hinge/src/` holds the data files and the Python that turns them into the page (`cd the-hinge/src && python3 v2/build_data2.py && python3 v2/build_html2.py` rewrites `the-hinge/index.html`); the Election Desk's updater rebuilds it when it adds polls.

A single-file, serverless forecast of the 2026 U.S. Senate, House and Ohio governor races. It blends three independent reads — a calibrated polling model, a history-only model built on presidential approval, real incomes and war, and live prices from Kalshi, Polymarket and PredictIt — and lets you change how much each one counts. Data were gathered on October 11, 2026; new polls can be added in the page's Tracker tab and are kept in your browser. A Money tab follows the money in every race on the page: who gives to the groups doing the spending (a flow diagram), ad spending and outside money race by race, and each side's main ads with a video link, the published script, a summary and three scores (how the ad is built to persuade, what fact-checks found, and the money behind it). Money figures run through October 12, 2026. It is not part of the LANscape app and is not affiliated with any campaign, party or exchange.

## Also hosted here: Election Desk 2026

**Open it: <https://bboldt86.github.io/lanscape-navigator/election2026/>**

A live desk for the 2026 midterms. The map drills from the country to the states to every county (3,142 of them, pre-projected from the Census boundaries via us-atlas), colored by the consensus of the Cook, Sabato and Inside Elections ratings, the polling margin, the prediction markets, the early vote or the 2024 presidential vote; on election night, by the results. Click a state for its Senate and governor races: candidates, the three ratings, the poll average and the latest polls, the market price, The Hinge's forecast, early and mail voting, and the largest counties with their 2024 margin and, as results come in, the 2026 margin, the swing and the share of the expected vote counted. Below the map: the balance of power, early voting by state, the polls and ratings for every race, the House ratings and competitive districts, the markets, the news feed and the calendar of poll closings.

It keeps itself current. `election2026/build.py` turns the JSON files in `election2026/data/` into `data/model.json` (which the open page refetches) and `index.html` (with the model, the county baselines and the map inlined, so it also works offline). A GitHub Actions workflow (`.github/workflows/election2026.yml`) pulls the prediction markets, the RSS headlines and the early-vote reports every three hours, and every 15 minutes on Nov. 3–6. A scheduled editorial pass reads the polls, the ratings, the early-vote pages and, on election night, the results, and records them with `election2026/updater/set_result.py`; its instructions are in `election2026/UPDATER.md`. Every number on the page carries the time it was read and its source; calls are the Associated Press's, never the page's own.

## Also hosted here: Inbox Atlas

**Open it: <https://bboldt86.github.io/lanscape-navigator/inbox-atlas/>**

A serverless reading room for the Jeffrey Epstein emails released by the U.S. House Oversight Committee (November 2025) and the Department of Justice under the Epstein Files Transparency Act: 5,775 emails, 104 recovered text-message logs and 2,020 documents, parsed from the open-source `epstein_text_messages` corpus, with every document linked to its page on jmail.world and to its source PDF. On top of the archive sit 28 sourced long reads and 11 Shorts (sixty-to-ninety-second films: one hook, five or six documents, a caption each) whose every quotation is pinned to a document, reading trails with saved progress, films that replay the conversations on simulated phone and desktop mail screens (with browser scenes that open the press coverage and book cards for the books in a story), one edition per year, maps (network, orbit, timeline, calendar, clock, reply speed, devices, topics, matrix), Sankey flows, and a Story Studio for writing your own stories from the documents. The page fetches `data/atlas.json.gz` and decodes it in the browser; reading progress and drafts stay in the browser. It is built for phones as well: the films play full-screen on an iPhone or Android (the simulated Messages and Mail screens fill the display), the header folds into a menu, and the page can be added to the home screen as an app (`manifest.webmanifest`). Reader stories can be published by adding a JSON file exported from the Studio to `inbox-atlas/stories/` and listing it in `stories/index.json`. Sensitive categories are hidden by default and no victims are profiled. It is also on the LANscape intranet: inside the app it lives at `www.inboxatlas.com` (The Hinge at `www.thehinge.com`), listed on the home page under "Also on This Server", in the Directory, on the Hotlist and in HyperHound. A hosted site can take the whole window: the Full screen chip, F11 or View › Full Screen hide LANscape's chrome, and Inbox Atlas asks for it itself when a film starts.

## Also hosted here: WX Center

**Open it: <https://bboldt86.github.io/lanscape-navigator/wx-center/>**

A single-file weather board for an airline dispatch desk: METAR, TAF, D-ATIS and NOTAMs for every airport on the desk, in one alphabetical list. Paste the desk's data dump and it picks out the airport pairs (DAL-HOU, DAL/HOU, DALHOU), ignoring flight numbers, times and delays. Each airport gets a flight-category dot, highlighted gusts, ceilings, visibility and thunderstorms, a TAF split into FM / TEMPO / PROB / BECMG lines with a timeline, the D-ATIS with runways in use and closed runways marked, a wind rose over its runways, and its runway, ILS and taxiway NOTAMs. Changed reports stay outlined until Ack All; old METARs (over 90 minutes) and TAFs (over 7 hours) are flagged. It refreshes every 2 minutes, with Zulu and Central clocks, three color schemes and an optional new-weather chime. Data comes from aviationweather.gov, datis.clowd.io / atis.info and the FAA NOTAM Search when the browser is allowed to reach them; otherwise the page shows a clearly marked sample desk, and reports can be pasted in by hand. Settings and the desk list stay in your browser. It is not part of the LANscape app. For situational awareness only; always verify against official sources.

## Also hosted here: Meridian Flight Control

**Open it: <https://bboldt86.github.io/lanscape-navigator/meridian/>**

A single-file, serverless dispatch desk built for a Southwest Airlines (WN / LUV) flight-control operator. The Desk shows your flights as lines of flying against a now-line, with a "Needs you" stack for releases due or overdue, new weather, curfew risk (SNA, SAN), takeoff alternates and the end of your duty. Every open release is checked against the destination TAF at ETA ±1 hour under the 1-2-3 rule (14 CFR 121.619), and the page shows the TAF group that triggered it. Weather follows WX Center's pattern: METAR, TAF and D-ATIS together, flight-category dots, ACK ALL, outlined changes, stale warnings and a two-minute refresh, with Zulu and Central clocks. The Schedule is a calendar database of a representative LUV network (about 580 flights a day), marked with AIRAC cycles, the daylight-saving change, IATA seasons and your duty days, plus a lines view and CSV export. Floor is a peer-to-peer add-on: windows on one computer find each other automatically, and desks on other machines pair once with a short code. Messages then relay from desk to desk, so the floor can share posts, acks, direct messages, weather and flight handoffs with no server. Shift tracks duty against 14 CFR 121.465 and writes the handoff brief. Ask Meridian answers brief, alternate and handoff questions offline, or sends open questions to your own Azure OpenAI endpoint. There is also a joke terminal skin (LUV-DOS 6.22 / tty1, with a boot sequence): cycle the moon button to reach it, or use ⌘K › Terminal skin.

The schedule and its delays are representative, not Southwest's timetable. Everything else is real. A scheduled GitHub Action (`.github/workflows/meridian.yml`) runs every 5 minutes and force-pushes its results to the `meridian-feed` branch, where the page reads them from raw.githubusercontent.com. Weather: METAR and TAF from aviationweather.gov and D-ATIS from datis.clowd.io; NOTAMs join once free FAA NOTAM API keys are added as repository secrets (until then each airport links to FAA NOTAM Search). Live: a Live page with a map and list of every airborne Southwest jet (ADS-B from OpenSky every 15 minutes, with tails from each Mode S code, types from adsb.fi and routes from community data checked against position and track), squawk 7500/7600/7700 alerts, and FAA ground stops, ground delay programs, delays and closures from NAS Status on the Desk, the airport tiles and in "Needs you". See `meridian/UPDATER.md`. If the feed can't be reached, the page keeps its last copy, or shows simulated weather labeled SIM. Everything stays in your browser. Meridian is an independent tool, not affiliated with or endorsed by Southwest Airlines, and is for situational awareness only. It is not part of the LANscape app.

## Also hosted here: Pinfall

**Open it: <https://bboldt86.github.io/lanscape-navigator/pinfall/>**

A Pinterest-style wall of secondhand fall layers, $20 to $100 an item, from eBay, Poshmark, Mercari and Grailed: Scotch & Soda and TravisMathew men's tops, Scotch & Soda women's tops in size M, and closet matches (Levi's 505 and 501 in 30–32 × 30, cashmere hoodies and sweaters, Buck Mason and Patagonia basics) picked to match the owner's closet. Every pin is at least 40% under what the brand charges new. Its closeup shows the all-in price with shipping, how far under new it is (against the retail printed in the listing when there is one, otherwise a labeled estimate), how to wear it, what layers with it, and a link to the live listing. Filter by department, category, color, marketplace, condition, price and size; 18 looks pair two pieces from the wall and refill in your size; boards are saved in your browser. On a phone the wall runs two columns, the closeup swipes from piece to piece, and the page can be added to the home screen as an app (`manifest.webmanifest`). It is one HTML file with the listings inlined, so it also opens from disk (the photos load from the marketplaces). Listings were read on October 23, 2026 and sell fast, so check the listing before you buy. It is not part of the LANscape app and is not affiliated with Scotch & Soda, TravisMathew or any marketplace.

## Also hosted here: Central Ohio Barn Hunt

**Open it: <https://bboldt86.github.io/lanscape-navigator/barnlife/>**

A single-file shopping guide for horse properties around Johnstown, Sunbury, Delaware, Dublin and Pickerington, priced $750k to $4M and catalogued Oct 24, 2026. Each listing is a numbered "hip" with photos, list price against my own valuation, stalls, arena, and what it would cost to add an arena, build or convert stalls, and refresh the house. Sliders set board per stall, occupancy, down payment, rate and the housing-to-income ratio, and every card, the ledger and the comps recalculate. Photos load from the listing sites, so the page needs a connection. Listing facts come from the MLS feed on LandSearch, HorseProperties.net, Compass and LandWatch; check status with the agent before acting. It is not part of the LANscape app.

## Credits

PDF viewing uses [PDF.js](https://github.com/mozilla/pdf.js) (Apache 2.0) and mark-up export uses [pdf-lib](https://github.com/Hopding/pdf-lib) (MIT). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
