# Meridian Flight Control: the live feed

The page (`meridian/index.html`, served at <https://bboldt86.github.io/lanscape-navigator/meridian/>) can't fetch
aviationweather.gov itself, because AWC doesn't allow browser cross-origin requests. A GitHub Action fetches
the data on GitHub's servers instead and publishes it where any browser can read it.

## How it runs

- **Workflow:** `.github/workflows/meridian.yml`. GitHub's own cron fires scheduled runs late or skips them (here,
  often by an hour or more), so the feed keeps its own time instead. Each run is a **relay**: it does one cycle every
  5 minutes for about 5 h 20 min (`meridian/updater/run_feed.sh`), then starts the next run itself before it ends
  (GitHub caps a job at 6 hours). An hourly cron is only a **backstop**: it restarts the relay if it ever stops, and
  exits within seconds when one is already running. If two relays ever overlap, the older one stops.
- **Stopping it:** cancelling the running job stops the relay until the next backstop restarts it; **Actions ›
  Meridian live feed › ⋯ › Disable workflow** stops it for good (enable it again and press **Run workflow** to
  restart). The relay keeps one GitHub-hosted runner busy around the clock, which costs nothing in a public
  repository. The earlier plain-schedule workflow (commit 902d5ae) is in the history if you'd rather go back to it
  and take updates whenever GitHub gets round to the schedule.
- **Scripts:** `meridian/updater/fetch_wx.py` (weather) and `meridian/updater/fetch_live.py` (fleet and FAA programs),
  standard-library Python 3. Both read the station list from the `STATION_DATA` block in `meridian/index.html`, so
  adding a station to the page adds it to the feed.
- **Output:** `wx.json`, `notams.json` and `live.json` on the **`meridian-feed`** branch (plus `live_state.json`, the
  updater's own cache, which the page never loads), published as one commit that is force-pushed every cycle. That
  keeps main's history and the Pages build untouched, and the repository doesn't grow.
- **The page** reads
  `https://raw.githubusercontent.com/BBOLDT86/lanscape-navigator/meridian-feed/` (raw.githubusercontent.com sends
  `Access-Control-Allow-Origin: *` and caches about 5 minutes) when it opens: weather every 5 minutes, `live.json`
  every 2. The base URL is in Settings › Weather. A downloaded copy of the HTML file reads the same feed.

## Sources

| data | source | cadence |
| --- | --- | --- |
| METAR (latest of the last 3 h, SPECI marked) | aviationweather.gov Data API, `api/data/metar?format=json` | every cycle (5 min) |
| TAF (latest issue, amendments included) | aviationweather.gov Data API, `api/data/taf?format=json` | every cycle |
| D-ATIS | datis.clowd.io `api/all`, with atis.info / clowd.io per airport as a fallback | every cycle |
| NOTAMs (runway, nav/ILS, taxiway, aerodrome, IAP, service, apron, comm; up to 60 per airport) | FAA NOTAM API (needs keys, see below) | every 3 hours |

| Southwest fleet: every SWA#### callsign with position, altitude, speed, track, squawk | OpenSky Network `/states/all` (one request over North America, Hawaii, Mexico and the Caribbean) | every 15 min (free tier); adsb.fi tiles if OpenSky fails |
| Tail numbers | computed from each aircraft's Mode S code (US codes map one-to-one to N-numbers) | every cycle |
| Aircraft types | adsb.fi `/v2/hex/…`, about 50 new tails a cycle, cached for good | until every tail is known |
| Routes | vradarserver/standing-data `SWA-all.csv` (community), airports placed with OurAirports; shown only when the aircraft's position and track fit the leg. Near an airport, a low descending or climbing aircraft gets a "likely" destination or origin | file refreshed daily |
| FAA programs: ground stops, ground delay and airspace flow programs, delays, closures (GA-only closures dropped) | FAA NAS Status `api/airport-status-information` | every cycle |

OpenSky's free (anonymous) tier allows 400 credits a day and a request this size costs 4, so the fleet refreshes every
15 minutes (96 requests, 384 credits). A free OpenSky account (add `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` as
repository secrets, from the API client in your OpenSky account) raises that to 4,000 a day, and the fleet then
refreshes every 5 minutes. adsb.fi and the route data are free for personal, non-commercial use.

Live positions are not matched to Meridian's schedule: that schedule is representative, so its flight numbers don't
correspond to Southwest's real ones.

AWC asks clients to stay under 100 requests a minute and to send a descriptive User-Agent. One cycle makes 2
requests to AWC (4 if it falls back to raw text).

## Turning on NOTAMs

FAA NOTAM Search (notams.aim.faa.gov) refuses requests from GitHub's servers (HTTP 403), and the older DINS service
is gone, so NOTAMs need the FAA's official NOTAM API. Its keys are free:

1. Register at <https://api.faa.gov> and request access to the **NOTAM API**. You get a client ID and a client secret.
2. In the repository: **Settings › Secrets and variables › Actions › New repository secret**. Add `FAA_CLIENT_ID`
   and `FAA_CLIENT_SECRET`.
3. **Actions › Meridian live feed › Run workflow**, with "Refresh NOTAMs now" ticked. (With the relay running, this
   does one extra cycle that pulls NOTAMs; leave "handoff" unticked.)

From then on `notams.json` appears on the feed branch and refreshes every 3 hours. Until it exists, the page says
NOTAMs aren't in the feed and links each airport to FAA NOTAM Search. NOTAMs can also be pasted in by hand.

## When something fails

A source that fails keeps its last good values and is listed in `errors` in `wx.json`. The page shows the feed's age
in the WX pill and on the Weather page, flags METARs older than 90 minutes and TAFs older than 7 hours, and falls back
to simulated weather (labeled SIM) only for a station that has no report less than 3 hours old. Nothing is invented.

GitHub turns off scheduled workflows in a public repository after 60 days without any commits, which takes the
backstop away; the relay itself keeps going. If the feed ever goes stale, open **Actions › Meridian live feed**,
enable the workflow if it's disabled, and press **Run workflow**.
