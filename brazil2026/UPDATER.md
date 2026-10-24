# Brazil 2026 runoff desk: the updater's runbook

The page (`brazil2026/index.html`, served at <https://bboldt86.github.io/lanscape-navigator/brazil2026/>) is rebuilt
from the JSON files in `brazil2026/data/` by `brazil2026/build.py`. It covers the presidential runoff of Sunday,
Oct. 25, 2026: Luiz Inácio Lula da Silva (PT, ballot 13) vs. Flávio Bolsonaro (PL, ballot 22). Two things keep it current:

1. **The automated feed pull** (`.github/workflows/brazil2026.yml`): every 30 minutes on Oct. 24–25, every 5 minutes
   from 20:00 UTC Oct. 25 (17:00 BRT, when the TSE count starts) to 06:00 UTC Oct. 26, then every 2 hours through
   Oct. 31. It runs `updater/fetch_tse.py` (the official count for Brazil, the 27 units and abroad), `fetch_markets.py`
   and `fetch_news.py`, rebuilds and commits. It only touches `results.json`, `markets.json`, `news.json`,
   `status.json`, `model.json` and `index.html`.
2. **The editorial pass** (scheduled Claude runs): one on the evening of Oct. 24 (the final polls), then hourly from
   5:40 p.m. ET on Oct. 25 until the TSE proclaims the result. It does what a script cannot: records the final polls,
   checks the count against the TSE's public page, records the TSE's proclamation, writes the alerts and the log.

The page also reads the TSE's result files directly from the browser every minute on election night (the TSE serves
them with CORS), so viewers see the latest file even when the Action lags.

## Ground rules

- Never invent a number. Every figure carries its as-of time and a source URL. If a source cannot be read, leave
  the old value and say so in the run log.
- Only the TSE decides the race. `set_result.py declare` records the TSE's proclamation (or a court certification);
  the desk never calls the race itself. "Leading" means more valid votes counted so far.
- Neutral wording, in both languages. Headlines are the outlets' own.
- Candidate keys are `lula` and `flavio`; units are the 27 UFs plus `ZZ` (abroad) and `BR`.
- Change only data files (`brazil2026/data/*.json`) in a scheduled run. Never edit page source or scripts; if
  something is broken, log it and report it.

## Files

| file | what | who writes it |
| --- | --- | --- |
| `data/election.json` | candidates, dates, polling hours, first-round result (national + 28 units, TSE), 2022 runoff baseline by state, endorsements, calendar | editorial (rarely) |
| `data/polls.json` | runoff polls (valid-vote shares where published), pending and unverified lists | editorial, through `set_result.py poll` |
| `data/markets.json` | Polymarket / Kalshi prices + history | `fetch_markets.py` (Action), `set_result.py market` |
| `data/results.json` | the TSE count: national, units, alerts, history (one point per TSE file) | `fetch_tse.py` (Action); `set_result.py result` as a manual fallback |
| `data/status.json` | `mode` (pre / night / post), `updated`, `declared`, the run log | `set_result.py`, `auto_status.py` |
| `data/news.json` | headlines | `fetch_news.py` |
| `data/feeds.json` | TSE URL pattern and codes, market ids, news feeds | editorial (rarely) |
| `data/geo.json` | the state map (`work/make_geo.py`) | static |

TSE result files: `https://resultados.tse.jus.br/oficial/ele2026/6258/dados/{uf}/{uf}-c0001-e006258-u.json`
(`br`, `ac` … `to`, `zz`). Fields: `carg[0].agr[].par[].cand[] {n, nm, vap, pvap, st}`, `s.pst` (% of sections
totalled), `v.vv/vb/tvn`, `e.a/pa`, `dg` + `hg` (file time, Brasília). A candidate's `st` reads "Eleito" when the TSE
proclaims; `build.py` and the page turn that into the declaration banner.

## The final-polls pass (Oct. 24 evening)

1. `git pull`. Read `data/status.json` and `data/polls.json` → `pending` (Datafolha, Quaest, AtlasIntel are due).
2. Search for each final poll. Record it with the figures the pollster published:
   ```sh
   python3 brazil2026/updater/set_result.py poll --pollster Quaest --sponsor Globo --start 2026-10-23 --end 2026-10-24 \
       --n 3702 --method in-person --lula 45 --flavio 47 --blank-null 6 --undecided 2 --basis total \
       --lula-valid 49 --flavio-valid 51 --tse BR-09158/2026 --released 2026-10-24 --url https://...
   ```
   (`--basis valid` when only valid-vote shares were published; then `--lula/--flavio` are the valid shares.)
3. Markets: if the Action's last pull has errors, record a manual read: `set_result.py market --flavio 0.83 --lula 0.17 --venue Polymarket --as-of 2026-10-24T23:00Z --url ... --source ...`.
4. `set_result.py log "final polls: Datafolha 49/51, Quaest 49/51, AtlasIntel 48.9/51.1"` then
   `brazil2026/updater/publish.sh "Brazil desk: final polls"`.

## Election night (Oct. 25, from 5:40 p.m. ET = 6:40 p.m. BRT) and after

1. `git pull`. Read `data/results.json` (what the Action pulled) and `data/status.json`. If `results.national` is
   empty or older than 10 minutes while the TSE page shows a count, run `python3 brazil2026/updater/fetch_tse.py`
   yourself; if the shell cannot reach the TSE, record the national count by hand from the TSE's public page or
   a wire report (AP/Reuters/G1), with the time shown there:
   `set_result.py result BR --lula 60100000 --flavio 61200000 --pct-counted 92.5 --as-of 2026-10-25T19:40-03:00 --src "https://resultados.tse.jus.br/..."`
   (and the same for any state you can read: `set_result.py result SP ...`).
2. Mode: `set_result.py mode night` if status still says `pre` (the Action flips it on its own once the file has a count).
3. Alerts at round numbers (`set_result.py alert "TSE: 50% of sections counted; Flávio 51.4, Lula 48.6" --at 2026-10-25T18:20-03:00`).
4. When the TSE proclaims: `set_result.py declare flavio|lula --by TSE --at 2026-10-25T20:05-03:00 --note "..."`, then
   when the count is at 100% and the proclamation is recorded: `set_result.py mode post`.
5. `set_result.py log "..."` and `brazil2026/updater/publish.sh "Brazil desk: results 19:40 BRT"`.
6. Confirm the push landed (`git log -1 origin/main`). Report in two or three lines.

Once `mode` is `post` and the declaration is recorded, the desk is final: say so and the scheduled tasks can be deleted
(a run that finds `mode post` does nothing but confirm).

## If something is broken

- `build.py --check` refuses a results file with an unknown unit or candidate key.
- If the TSE changes the file layout, `fetch_tse.py` records the error in `results.json → errors` and keeps the last
  values; the page shows the TSE's own page link. Record the national count by hand with `set_result.py result`.
- If the Action's push conflicts, `publish.sh` rebases on it; conflicts can only be in generated files, rebuilt.
