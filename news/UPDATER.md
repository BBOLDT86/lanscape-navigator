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

Each edition is about 450 KB of JSON (about 110 KB over the wire). Six commits a day add a few hundred KB to the
repository's history per day after compression.
