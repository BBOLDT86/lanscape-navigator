# Election Desk 2026: the updater's runbook

This page (`election2026/index.html`, served at <https://bboldt86.github.io/lanscape-navigator/election2026/>)
is rebuilt from the JSON files in `election2026/data/` by `election2026/build.py`. Two things keep it current:

1. **The automated feed pull** (`.github/workflows/election2026.yml`): every 3 hours, and every 15 minutes on
   Nov. 3–6, GitHub Actions runs `updater/fetch_markets.py`, `updater/fetch_rss.py` and `updater/fetch_earlyvote.py`,
   rebuilds, and commits. It only touches `markets.json`, `news.json`, `earlyvote_auto.json`, `status.json`,
   `model.json` and `index.html`.
2. **The editorial pass** (scheduled Claude runs, set up Oct. 23, 2026 from the owner's Claude account): daily at
   7:48 a.m. ET; hourly at :40 from 6:40 p.m. ET on election night (the scheduler's minimum interval is one hour);
   then every three hours (12:40, 3:40, 6:40 … ET) Nov. 4–20 while races are called. It does what a script cannot:
   reads the polls, the ratings, the early-vote reports and, on election night, the results pages, and writes them
   into the data files with sources. This file is its instructions; each run's prompt points here.

Everything it needs is in the repo. Nothing depends on a particular machine.

## Ground rules

- Never invent a number. Every figure carries its as-of date and a source URL. If a source cannot be read, leave
  the old value and say so in the run log.
- Calls come from the Associated Press (or the state's official certification). The desk never calls a race itself.
  A "leader" is just the candidate with more counted votes.
- Neutral wording. Headlines are the outlets' own; the desk does not editorialize.
- Candidate names in results must match `data/races.json` exactly (`set_result.py` refuses anything else).
- Keep the run short: do the pass, publish, report. A run that cannot finish should still publish what it verified.

## Files

| file | what | who writes it |
| --- | --- | --- |
| `data/races.json` | every Senate and governor race: candidates, ratings (+ as-of), polls, averages, 2024 result, poll-close time; House ratings and competitive districts; balance of power; the `markets` snapshot | editorial pass |
| `data/earlyvote.json` | early and mail voting: national and by state, deadlines, headlines | editorial pass (the Action writes `earlyvote_auto.json`; the newer per-state entry wins) |
| `data/feeds.json` | RSS feeds, results pages, market ids, calendar | editorial pass (rarely) |
| `data/results.json` | election-night results, calls, county results, House counts, alerts | editorial pass, through `updater/set_result.py` |
| `data/status.json` | `mode` (pre / night / post), `updated`, `turnoutFactor`, the run log | `set_result.py log …` and the Action |
| `data/hinge.json` | The Hinge's win probabilities by race id | `updater/hinge_numbers.py` after a Hinge rebuild |
| `data/markets.json`, `data/news.json` | prices and headlines | the Action (`fetch_markets.py`, `fetch_rss.py`) |
| `data/geo.json`, `data/baseline.json` | the map and the 2024/2020 county votes | static |

Race ids are `XX-S` (Senate) and `XX-G` (governor), e.g. `OH-S`, `OH-G`, `GA-S`.

## The daily pass (until Election Day)

1. `git pull`. Read `data/status.json` (last run) and `data/races.json` (`asOf`).
2. Try the feed scripts: `python3 election2026/updater/fetch_markets.py; python3 election2026/updater/fetch_rss.py;
   python3 election2026/updater/fetch_earlyvote.py`. If the network refuses (the shell may not reach those hosts),
   skip them: the Action runs them anyway.
3. **Polls.** Search for polls released since `asOf` in every race rated Toss Up, Lean or Likely by any of the three
   raters, and the generic ballot. Add each to the race's `polls` list in the poll shape already in the file
   (pollster, sponsor, partisan, start, end, n, pop, d, r, other, url). Update `average` from the aggregator named in
   the file when it has moved. Do not re-add a poll that is already there.
4. **Ratings.** Check Cook, Sabato's Crystal Ball and Inside Elections (270toWin republishes all three) for
   changes since each race's `ratingsAsOf`; update the rating and its as-of date; add a line to `recentChanges`.
5. **Early vote.** Update `data/earlyvote.json` from the UF Election Lab tracker and the state pages listed in
   `data/feeds.json` → `earlyVote`: national totals and every state that publishes daily (at least GA, NC, TX, FL,
   OH, MI, IA, AZ, NV, PA, WI, ME, NH, KS, NE, MN, AK, VA, CO). Set each state's `asOf` and `source`; compute
   `pctOf2022Final` where `final2022` is known. Add a `headlines` line for anything notable (a record, a court ruling).
6. **The Hinge.** Add the same new polls to `the-hinge/src/data/polls_compact.txt` (one JSON object per line, the
   format is in the file: race = the state abbreviation of the 12 modeled races) and update the market prices in
   `the-hinge/src/data/markets.json` → `current` if they moved by more than 3 points. Then publish with
   `REBUILD_HINGE=1` so the forecast and `data/hinge.json` refresh.
7. **Calendar.** On the day something happens (early voting opens or closes, a deadline, a debate), nothing to
   do; the calendar in `feeds.json` already lists it. Add missing items.
8. Log and publish:
   ```sh
   python3 election2026/updater/set_result.py log "daily pass: 6 polls, 1 rating change (NC-S Cook → Likely D), early vote 19 states"
   REBUILD_HINGE=1 election2026/updater/publish.sh "Election Desk: daily update $(date +%b\ %-d)"
   ```
9. Confirm the push landed (`git log -1 origin/main`) and that GitHub Pages built
   (`gh api repos/BBOLDT86/lanscape-navigator/pages/builds/latest --jq .status`). Report in two or three lines.

## Election Day and election night (Nov. 3)

**Morning run:** do the daily pass, then `python3 election2026/updater/set_result.py mode night`, publish. Also
confirm the results pages in `data/feeds.json` → `resultsNight.states` resolve to the 2026 general-election results
(replace any 2024 placeholder with the live 2026 URL) and that AP's and NYT's hubs are up.

**Every run from 6:30 p.m. ET:** polls close from 6 p.m. ET (parts of IN and KY), 7 p.m. (GA, SC, VA, VT, the rest
of IN and KY), 7:30 (NC, OH, WV), 8 (most of the East and Midwest, including ME, NH, MA, RI, DE, NJ, MD, PA, FL*, AL,
MS, TN, IL, MO, OK, TX*, KS*, SD*, ND*, MI*), 9 (NY, MN, WI, IA, NE*, CO, NM, AZ, WY, LA, MT*), 10 (NV, UT, ID*, OR*),
11 (CA, WA, HI*, ID*), 1 a.m. (AK). (* split time zones.)

1. `git pull`. For each Senate and governor race whose polls have closed, read the AP results page (or NYT, or the
   state's official results site from `feeds.json`) and record the statewide count:
   ```sh
   python3 election2026/updater/set_result.py race OH-S --cand "Sherrod Brown=1612345" --cand "Jon Husted=1598210" \
       --pct-in 74 --as-of 2026-11-03T23:40-05:00 --src "AP"
   ```
   `--pct-in` is AP's "% of expected vote" when shown; otherwise omit it and the script estimates from 2024
   turnout × `turnoutFactor` (0.75; adjust in `status.json` if the night's turnout runs higher or lower).
2. When AP calls a race: add `--call D|R|I --call-by AP --call-at <time>` and an alert:
   `set_result.py alert "AP calls the Ohio Senate race for Sherrod Brown" --id OH-S --at 2026-11-04T01:10-05:00`.
3. Counties: for the competitive races (OH, GA, NC, ME, IA, MI, AK, TX, NH, KS, NE, MN, and any governor's race
   within 5 points), record the ten largest counties from the state's results site:
   `set_result.py county 39049 --d 320000 --r 190000 --pct-in 71 --as-of … --src "Ohio SOS"`.
   FIPS codes: `data/baseline.json` → `c` keys; names are in `data/geo.json`. Alaska has no county map (House
   districts); Connecticut's map is 2020 counties.
4. House: `set_result.py house --called-d 171 --called-r 183 --lead-d 22 --lead-r 19 --as-of … --src "AP"` from AP's
   balance-of-power page.
5. `set_result.py log "11:40 PM: 14 Senate, 9 governor races updated; calls: GA-S (Ossoff), …"` then
   `election2026/updater/publish.sh "Election Desk: results 11:40 PM ET"`. The page shows the time of every number.

Keep going until the run budget is spent; prefer breadth (every race with results) over county depth, then add
counties for the closest races. A run should take under 15 minutes: pull, record, publish.

## After Election Day (Nov. 4 onward)

Same as election night, every few hours: update the uncalled races and their counties, record calls and alerts,
update the House count. When every Senate and governor race is called, set `mode post`, write a final log line
and tell the owner the desk is final. The scheduled tasks can then be deleted.

## The scheduled tasks

| task (in the owner's Claude scheduled tasks) | when (ET) | does |
| --- | --- | --- |
| Election Desk 2026: daily editorial pass | 7:48 a.m. daily, Oct.–Nov. | the daily pass; on Nov. 3 also switches `mode night`; from Nov. 4 a results pass |
| Election Desk 2026: election night | Nov. 3, 6:40–11:40 p.m. hourly | the results pass |
| Election Desk 2026: during the count | Nov. 4–20, every 3 hours at :40 | the results pass; sets `mode post` and reports when every race is called |

The runs act without asking for approval, in the cloud (no computer needed). They commit through `publish.sh`,
which appends `$COMMIT_TRAILER` (attribution lines) to its commit messages when a run exports it. Once the desk is
final the tasks can be deleted; a run that finds `mode post` and a final log line does nothing.

## If something is broken

- `build.py --check` refuses a results file that names a candidate not in `races.json`: fix the name.
- `publish.sh` rebases on what the Action pushed; conflicts can only be in generated files and are rebuilt.
- If a feed in `feeds.json` dies, mark it in `gaps` and move on; the page shows what it has.
- If The Hinge fails to rebuild, publish without `REBUILD_HINGE=1` and note it in the log.
