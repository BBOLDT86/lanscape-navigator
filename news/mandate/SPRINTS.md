# The Mandate: the sprints

The section was built in one night (Nov. 8, 2026) from seven research passes whose shared search budget ran out before
every item was sourced. The weekly scheduled task ("The Watch: The Mandate (weekly sprint)") works through this list:
it does the first sprint that is not ticked, ticks it (`- [x]`) with the date, then does the standing maintenance.
Nothing is published without a URL the writer actually read; gaps stay gaps.

## Standards (every sprint)
- The record is `data/*.json`; the pages are built from it by `build.py` (the Action rebuilds on push). Edit the data,
  never the HTML. `python3 news/mandate/build.py check` must print `ok` before a commit.
- Every item carries at least one source URL that was fetched or appeared in a search result. Primary sources first
  (court opinions, dockets, Federal Register, agency pages, filings, CBO, BLS, ICE's own death notices, TRAC, KFF);
  then AP, Reuters, NYT, WaPo, Politico, ProPublica, Bloomberg, NPR, the Guardian. Replace a Wikipedia hub or a mirror
  with the primary source whenever one can be read, and say in the item when sources disagree.
- Statuses: scorecard `done | in progress | partial | blocked by courts | reversed | not attempted`; courts
  `administration won | administration lost | mixed | pending | blocked (injunction in force) | settled/dropped`;
  promises `kept | partly kept | broken | stalled | reversed | too early`; departures
  `fired | resigned | pushed out | reassigned | term ended | died | withdrawn`. Judge against what stands today.
- Officials in `people`/`officials` fields are named as the roster names them (`people.json` roster `name`), so the
  chips link. A new senior official gets a roster card; a departure gets a `departures` row with reason and successor.
- Quotes verbatim, under 25 words, with the transcript or recording as `quote_source`. Nothing about private people.
- The written analysis (`analysis.json` sections) is revised, not rewritten: fix what changed, add a sentence for what
  is new, keep the citations pointing at the numbered `sources`. Update `asof` and the hero's `dateline`.
- Write files with a short Python script (`json.dump(..., ensure_ascii=False, indent=1)`), then `build.py`, then
  `render.py share` if the 3-D changed (the MP4 renders are optional and slow; skip them if time is short).

## The sprints
- [ ] **Sprint 2 — Musk and the election (the documentary page).** `markets.json["tesla"]`: `musk_spending` from FEC
  filings/OpenSecrets (2024 total via America PAC, RBG PAC and others; the $1M voter checks and the Philadelphia DA's
  suit; the Wisconsin Supreme Court race of April 1, 2025 and its result; 2026 midterm spending); `events` for the DOGE
  tenure (Jan. 20–May 30, 2025), the June 5, 2025 break with Trump and that day's Tesla fall, the America Party
  (July 5, 2025), the xAI/Starlink government contracts; `claims`: the vote-count theories (what was claimed, by whom,
  the data cited) and what county and state election officials, courts and fact-checkers found — neutral, precise,
  sourced; `documentaries` (title, maker, date, URL) and `videos.json` entries for official-channel YouTube videos
  (`youtube` id, `channel`, `title`, `date`, `where: "musk"`). Also GEO's and CoreCivic's donations and lobbying
  (`geo.donations`, `cxw.donations`), the Fort Bliss (Camp East Montana) and Alligator Alcatraz contractors, and the
  ISAP/BI monitoring numbers.
- [ ] **Sprint 3 — Courts, departures and promises refresh.** Every `pending` case re-checked; the D.C. Circuit en banc
  contempt ruling, the Fourth Circuit on Comey/James, Bolton's sentence, D.V.D. after the Dec. 9 argument, the law-firm
  appeals, Harvard at the First Circuit; add the cases the first pass could not source (CPB/NPR, Alligator Alcatraz,
  Delaney Hall, sanctuary-city funding, New York v. Trump, the Qatar jet, Wilcox/Boyle/Harris). Departures since the
  last run, including the post-midterm shake-up, and the roster for every new principal. Every promise re-scored,
  the quotes flagged `quote_verbatim: false` replaced with verbatim ones from transcripts, and the unverified items
  (“dictator on day one”, “retribution”, RFK Jr.’s “autism by September”, the JFK/MLK/RFK files, daylight saving time)
  sourced or dropped.
- [ ] **Sprint 4 — The human cost, updated.** The names: every death in ICE custody since the last entry, from ICE's
  detainee-death page and the trackers (name, age, nationality, facility, date, cause); the detention population from
  TRAC; the Iran war's toll (HRANA, Iran's health ministry, Pentagon DCAS) and the Minab report if the Pentagon releases
  it; measles cases and elimination status; unemployment, CPI, the deficit for FY2026; the Texas Hill Country flood and
  FEMA/NWS staffing; the No Kings crowd counts; Charlie Kirk's killing and the response; Jan. 6 pardon recidivism.
  Replace the Wikipedia-hub figures in dossiers 4–6 with primary sources.
- [ ] **Sprint 5 — The scorecard, chapter by chapter.** Every chapter with fewer than three tracked proposals gets its
  most consequential ones scored (Ch. 7 intelligence, 23 Ex-Im, 25 SBA, 29 FEC especially), with the 2026 completions
  the trackers list since August; the `tour` captions in `analysis.json` revised for the new blocks; a Watch piece per
  section of the Mandate (five, 600–900 words each, cited) as `analysis.json["chapters_essays"]` if time allows.
- [ ] **Sprint 6 — Renders and the reel.** `render.py` for `reel-vertical.mp4`, `reel-wide.mp4`, `tour.mp4`,
  `share.png`; the reel's cards refreshed from the record; the front page's card text checked.

## Standing maintenance (every run, after the sprint)
- Departures and appointments of the week → `people.json`; court rulings of the week → `courts.json`; new deaths in
  ICE custody → `impact.json["dossiers"][ice]`; any new tracker figure → `chapters.json["trackers"]`.
- `data/prices.json` is the Action's (fetch.py); if it has `errors`, note them in the report, don't hand-edit.
- `python3 news/mandate/build.py check && python3 news/mandate/build.py`, commit `news/mandate` only, push.
