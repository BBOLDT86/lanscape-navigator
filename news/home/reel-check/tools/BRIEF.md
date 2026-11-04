# Reel Check: brief for writing a build

Reel Check is a series on The Watch (Home desk). Each piece takes a kind of viral, often AI-generated, DIY build video
(the satisfying "I built X in my backyard" reel), describes what such a clip shows, tests it against physics, building
practice and code, scores it, and then lays out a version a reader could actually build, with a build kit: a sizer,
a bill of materials with prices, and a phased schedule with go/no-go gates.

The first one, already written, is the model to match in tone, depth and structure:

- the text: `news/home/reel-check/tools/pool.md`
- the generator that turns text + numbers into the build file: `news/home/reel-check/tools/pool.py`
- the result: `news/home/reel-check/builds/2026-11-02-plastic-bottle-pool.json`
- the format and the checker: `python3 news/home/reel-check/reel.py format` and `... reel.py check <file>`

## For each build you are given (topic, publish date, category)

1. **Research.** Use WebSearch and WebFetch to find real sources: engineering or extension guides, building codes or
   code summaries, manufacturer specs, academic or trade write-ups, credible journalism, forum threads from real
   builders only when nothing better exists. Open every page you cite (a search snippet is not a source). At least 5
   sources from at least 4 different outlets, each cited in the body as [n]. Never invent a URL or a fact.
2. **Run the numbers** in a small Python generator `tools/<slug>.py` (copy pool.py's shape): the loads, volumes,
   weights, flows, temperatures or whatever decides feasibility, the kit's configs for every combination of 1-2
   options (for example size x depth, 3-5 values each), and material quantities per combination with waste. Prices
   are rough US retail ranges for late 2026 (say so in `assumptions`); a fee (permit, engineer) is a flat row.
3. **Write** `tools/<slug>.md` the way pool.md is written: open with the verdict in bold in one or two sentences;
   then `## What the video shows` (the typical clip, its tells of AI generation where they are typical, what never
   appears), `## The physics` (headline with the key number), `## <N> ways it fails` (a numbered list),
   `## The verdict`, `## How to build a version that works` (a numbered plan). 1,100 to 1,800 words. Plain words,
   numbers with units, sentences under 25 words where you can, no quotation over 25 words (paraphrase; at most one
   short quote per source), no emoji. Imperial units first (US readers). Do not name a specific creator or account.
   Safety: where the real risk is death or injury (drowning, suffocation, collapse, carbon monoxide, electrocution,
   fire), say so plainly and make the fixed version address it; if no safe DIY version exists, say that, score
   `fixed` low, and make the kit a professional-led version or the closest safe alternative.
4. **Fields:** `id` = `<publish>-<slug>`, `publish` as given, `written` = the actual current time in
   America/New_York with offset (run `TZ=America/New_York date -Iseconds`), `byline` "Claude", `model`
   "Claude Opus 5.5", `category` as given, `scores` 5-6 rows, `verdict.shown` and `.fixed` honest integers.
   The title is sentence case and ends with a question or a claim, like the model's; the dek one sentence.
5. **Write the file to `news/home/reel-check/queue/<id>.json`** (not builds/), then run
   `python3 news/home/reel-check/reel.py check news/home/reel-check/queue/<id>.json` and fix until it says ok.
   Also sanity-check your own numbers (a second calculation by hand or a different method for the key figure).

Do not edit any other file in the repo, do not run git, and do not touch other writers' builds.
