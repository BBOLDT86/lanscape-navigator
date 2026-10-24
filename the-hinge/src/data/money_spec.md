# "Follow the money" research spec (shared by all research agents)

Today is Monday, October 12, 2026; Election Day is Tuesday, November 3, 2026. This research feeds a nonpartisan
2026 midterm forecast page. Every fact must carry a source URL. Never invent numbers, dates, URLs or ad wording:
if something isn't found, record it in `gaps` as "not found".

## What to collect for each race

1. **Fundraising by candidate** (both major candidates; Osborn in Nebraska): total raised, spent, cash on hand, and
   the reporting basis. FEC Q3 reports (through Sept 30) are due Oct 15, so most filed figures run through June 30
   (Q2) or a pre-primary report; many campaigns have *announced* Q3 totals in press releases or to reporters. Record
   whichever is latest and label it ("FEC filing through 2026-06-30" vs "campaign-announced Q3, not yet filed").
   Sources: fec.gov (candidate pages; the API at api.open.fec.gov works with api_key=DEMO_KEY), OpenSecrets, news.
2. **Outside spending** by side: independent expenditures by super PACs, party committees and other groups
   (FEC 24/48-hour reports via fec.gov or OpenSecrets "outside spending" race pages), and **ad reservations** by
   outside groups (news reports citing AdImpact, Medium Buying, etc.). Name the biggest groups on each side with
   amounts. Count spending *against* a candidate on the other side (e.g., an attack on the Democrat counts for R).
3. **Ad spending** totals by side (AdImpact via news is the standard; also Wesleyan Media Project / Kantar CMAG):
   spent to date and/or reserved through Election Day, with the as-of date. Say which basis each figure uses.
4. **Big donors** behind the race-specific money when reported (e.g., Elon Musk → Senate Leadership Fund / America
   PAC; Democratic megadonors → Senate Majority PAC, etc.).
5. **Ads**: for each side, the ad(s) that matter most, chosen by the SAME rule for both sides:
   (a) the ad with the most reported spending or airings (AdImpact "top ad" style reporting), else
   (b) the candidate campaign's most recent general-election TV ad, plus the largest allied outside group's most
   recent ad. Statewide races: 2 ads per side when available (1 candidate, 1 outside group). House districts: 1 per side.
   For each ad record:
   - `youtube_url`: the exact YouTube URL of the ad (official channel upload preferred). WebFetch cannot open
     youtube.com in this session, so find video URLs through WebSearch (e.g. `site:youtube.com "<ad title>"` or
     `site:youtube.com <campaign> ad`), and through campaign press releases / news stories that link or embed the
     video. Confirm the search result's title/channel matches the ad. If no YouTube upload exists, use the
     official X/Facebook/campaign-site video link in `video_url` and set `youtube_url` to null.
   - `transcript`: the ad's words, VERBATIM, from a published source: campaign press releases (often headed
     "SCRIPT" or "TRANSCRIPT"), news "ad watch" stories, fact-checks, AdImpact/Medium Buying write-ups, or articles
     that quote the full ad. Never paraphrase into the transcript field and never reconstruct it from memory.
     `transcript_completeness`: "full" or "partial" (partial = only quoted portions; keep the quotes exact and mark
     omissions with "…"). Do NOT use third-party YouTube caption/transcript mirror sites (they copy YouTube content
     that this session's fetch tool declines). Record `transcript_source` (URL).
   - `title`, `sponsor`, `sponsor_type` (candidate | party committee | super PAC | other group), `side` (D/R/I),
     `date` (first aired/released, YYYY-MM-DD), `length_sec` if known, `spend_behind` (reported buy size, with
     source) if known, `on_screen_sources` (citations shown on screen, if reported), `tone_reported` (how coverage
     describes it: positive bio / contrast / attack), `issues` (main topics), `fact_checks`
     ([{claim, rating, by, url}] from PolitiFact, FactCheck.org, AP, WaPo, local outlets — if any), `coverage_url`.
6. **Gaps**: everything you looked for and didn't find.

## Neutrality

Give both sides equal effort and the same selection rule. Describe ads and groups in neutral words; when coverage
uses loaded language, quote it and attribute it. Note who funds groups only when a source documents it.

## Output

Write one JSON file (UTF-8, valid JSON) at the path given in your task, shaped:

{
  "compiled": "2026-10-12",
  "races": [
    {
      "race_id": "OH-SP",
      "race": "Ohio U.S. Senate special",
      "candidates": {"D": "Sherrod Brown", "R": "Jon Husted"},
      "fundraising": [{"candidate": "", "party": "D", "raised": 0, "spent": 0, "cash_on_hand": 0, "basis": "", "as_of": "YYYY-MM-DD", "source": "", "url": ""}],
      "outside_spending": [{"group": "", "side": "D|R", "supports_or_opposes": "supports X / opposes Y", "amount": 0, "basis": "FEC IEs through YYYY-MM-DD | reservation | ...", "as_of": "", "source": "", "url": ""}],
      "ad_spending": [{"side": "D|R|total", "amount": 0, "basis": "spent to date | reserved through Election Day | ...", "as_of": "", "source": "", "url": ""}],
      "donors": [{"donor": "", "amount": 0, "to": "", "side": "D|R", "as_of": "", "source": "", "url": ""}],
      "ads": [{"side": "D", "sponsor": "", "sponsor_type": "", "title": "", "date": "", "length_sec": null, "youtube_url": "", "video_url": null, "url_found_via": "", "transcript": "", "transcript_completeness": "full|partial", "transcript_source": "", "spend_behind": null, "on_screen_sources": [], "tone_reported": "", "issues": [], "fact_checks": [], "coverage_url": "", "notes": ""}],
      "notes": "",
      "gaps": []
    }
  ],
  "gaps": []
}

Amounts are plain numbers in U.S. dollars (no strings like "$2.1M"). Keep notes short. When done, reply with a
brief summary: what you found per race, the biggest gaps, and anything surprising.
