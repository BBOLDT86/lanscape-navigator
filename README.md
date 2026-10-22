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
```

## Also hosted here: The Hinge

**Open it: <https://bboldt86.github.io/lanscape-navigator/the-hinge/>**

A single-file, serverless forecast of the 2026 U.S. Senate, House and Ohio governor races. It blends three independent reads — a calibrated polling model, a history-only model built on presidential approval, real incomes and war, and live prices from Kalshi, Polymarket and PredictIt — and lets you change how much each one counts. Data were gathered on October 11, 2026; new polls can be added in the page's Tracker tab and are kept in your browser. A Money tab follows the money in every race on the page: who gives to the groups doing the spending (a flow diagram), ad spending and outside money race by race, and each side's main ads with a video link, the published script, a summary and three scores (how the ad is built to persuade, what fact-checks found, and the money behind it). Money figures run through October 12, 2026. It is not part of the LANscape app and is not affiliated with any campaign, party or exchange.

## Also hosted here: Inbox Atlas

**Open it: <https://bboldt86.github.io/lanscape-navigator/inbox-atlas/>**

A serverless reading room for the Jeffrey Epstein emails released by the U.S. House Oversight Committee (November 2025) and the Department of Justice under the Epstein Files Transparency Act: 5,775 emails, 104 recovered text-message logs and 2,020 documents, parsed from the open-source `epstein_text_messages` corpus, with every document linked to its page on jmail.world and to its source PDF. On top of the archive sit 28 sourced long reads and 11 Shorts (sixty-to-ninety-second films: one hook, five or six documents, a caption each) whose every quotation is pinned to a document, reading trails with saved progress, films that replay the conversations on simulated phone and desktop mail screens (with browser scenes that open the press coverage and book cards for the books in a story), one edition per year, maps (network, orbit, timeline, calendar, clock, reply speed, devices, topics, matrix), Sankey flows, and a Story Studio for writing your own stories from the documents. The page fetches `data/atlas.json.gz` and decodes it in the browser; reading progress and drafts stay in the browser. It is built for phones as well: the films play full-screen on an iPhone or Android (the simulated Messages and Mail screens fill the display), the header folds into a menu, and the page can be added to the home screen as an app (`manifest.webmanifest`). Reader stories can be published by adding a JSON file exported from the Studio to `inbox-atlas/stories/` and listing it in `stories/index.json`. Sensitive categories are hidden by default and no victims are profiled. It is also on the LANscape intranet: inside the app it lives at `www.inboxatlas.com` (The Hinge at `www.thehinge.com`), listed on the home page under "Also on This Server", in the Directory, on the Hotlist and in HyperHound. A hosted site can take the whole window: the Full screen chip, F11 or View › Full Screen hide LANscape's chrome, and Inbox Atlas asks for it itself when a film starts.

## Also hosted here: WX Center

**Open it: <https://bboldt86.github.io/lanscape-navigator/wx-center/>**

A single-file weather board for an airline dispatch desk: METAR, TAF, D-ATIS and NOTAMs for every airport on the desk, in one alphabetical list. Paste the desk's data dump and it picks out the airport pairs (DAL-HOU, DAL/HOU, DALHOU), ignoring flight numbers, times and delays. Each airport gets a flight-category dot, highlighted gusts, ceilings, visibility and thunderstorms, a TAF split into FM / TEMPO / PROB / BECMG lines with a timeline, the D-ATIS with runways in use and closed runways marked, a wind rose over its runways, and its runway, ILS and taxiway NOTAMs. Changed reports stay outlined until Ack All; old METARs (over 90 minutes) and TAFs (over 7 hours) are flagged. It refreshes every 2 minutes, with Zulu and Central clocks, three color schemes and an optional new-weather chime. Data comes from aviationweather.gov, datis.clowd.io / atis.info and the FAA NOTAM Search when the browser is allowed to reach them; otherwise the page shows a clearly marked sample desk, and reports can be pasted in by hand. Settings and the desk list stay in your browser. It is not part of the LANscape app. For situational awareness only; always verify against official sources.

## Also hosted here: Meridian Flight Control

**Open it: <https://bboldt86.github.io/lanscape-navigator/meridian/>**

A single-file, serverless dispatch desk built for a Southwest Airlines (WN / LUV) flight-control operator. The Desk shows your flights as lines of flying against a now-line, with a "Needs you" stack for releases due or overdue, new weather, curfew risk (SNA, SAN), takeoff alternates and the end of your duty. Every open release is checked against the destination TAF at ETA ±1 hour under the 1-2-3 rule (14 CFR 121.619), and the page shows the TAF group that triggered it. Weather follows WX Center's pattern: METAR, TAF and D-ATIS together, flight-category dots, ACK ALL, outlined changes, stale warnings and a two-minute refresh, with Zulu and Central clocks. The Schedule is a calendar database of a representative LUV network (about 580 flights a day), marked with AIRAC cycles, the daylight-saving change, IATA seasons and your duty days, plus a lines view and CSV export. Floor is a peer-to-peer add-on: windows on one computer find each other automatically, and desks on other machines pair once with a short code. Messages then relay from desk to desk, so the floor can share posts, acks, direct messages, weather and flight handoffs with no server. Shift tracks duty against 14 CFR 121.465 and writes the handoff brief. Ask Meridian answers brief, alternate and handoff questions offline, or sends open questions to your own Azure OpenAI endpoint. There is also a joke terminal skin (LUV-DOS 6.22 / tty1, with a boot sequence): cycle the moon button to reach it, or use ⌘K › Terminal skin.

The schedule and its delays are representative, not Southwest's timetable. Weather is simulated (and labeled SIM) until you connect a source, because aviationweather.gov does not allow browser cross-origin requests. You can connect a proxy in Settings, paste the raw feed, or let a peer on the floor share theirs. Simulated NOTAMs are illustrative only. Everything stays in your browser. Meridian is an independent tool, not affiliated with or endorsed by Southwest Airlines, and is for situational awareness only. It is not part of the LANscape app.

## Credits

PDF viewing uses [PDF.js](https://github.com/mozilla/pdf.js) (Apache 2.0) and mark-up export uses [pdf-lib](https://github.com/Hopding/pdf-lib) (MIT). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
