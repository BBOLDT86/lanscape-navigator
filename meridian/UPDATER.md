# Meridian Flight Control: the weather feed

The page (`meridian/index.html`, served at <https://bboldt86.github.io/lanscape-navigator/meridian/>) can't fetch
aviationweather.gov itself, because AWC doesn't allow browser cross-origin requests. A scheduled GitHub Action fetches
the data on GitHub's servers instead and publishes it where any browser can read it.

## How it runs

- **Workflow:** `.github/workflows/meridian.yml`, every 30 minutes at :08 and :38 UTC, plus **Run workflow** by hand.
  GitHub sometimes starts scheduled runs a few minutes late.
- **Script:** `meridian/updater/fetch_wx.py`, standard-library Python 3. It reads the station list from the
  `STATION_DATA` block in `meridian/index.html`, so adding a station to the page adds it to the feed.
- **Output:** `wx.json` and `notams.json` on the **`meridian-feed`** branch, published as one commit that is
  force-pushed every run. That keeps main's history and the Pages build untouched, and the repository doesn't grow.
- **The page** reads
  `https://raw.githubusercontent.com/BBOLDT86/lanscape-navigator/meridian-feed/wx.json` (raw.githubusercontent.com
  sends `Access-Control-Allow-Origin: *`) when it opens and re-checks every 5 minutes, so an open page picks up each
  run within minutes. The URL is in Settings › Weather. A downloaded copy of the HTML file reads the same feed.

## Sources

| data | source | cadence |
| --- | --- | --- |
| METAR (latest of the last 3 h, SPECI marked) | aviationweather.gov Data API, `api/data/metar?format=json` | every run |
| TAF (latest issue, amendments included) | aviationweather.gov Data API, `api/data/taf?format=json` | every run |
| D-ATIS | datis.clowd.io `api/all`, with atis.info / clowd.io per airport as a fallback | every run |
| NOTAMs (runway, nav/ILS, taxiway, aerodrome, IAP, service, apron, comm; up to 60 per airport) | FAA NOTAM Search | every 3 hours |

AWC asks clients to stay under 100 requests a minute and to send a descriptive User-Agent. One run makes 2 requests
to AWC (4 if it falls back to raw text).

## When something fails

A source that fails keeps its last good values and is listed in `errors` in `wx.json`. The page shows the feed's age
in the WX pill and on the Weather page, flags METARs older than 90 minutes and TAFs older than 7 hours, and falls back
to simulated weather (labeled SIM) only for a station that has no report less than 3 hours old. Nothing is invented.

GitHub turns off scheduled workflows in a public repository after 60 days without any commits. If the feed goes
stale after a quiet stretch, re-enable it under Actions › Meridian weather feed.
