# The Watch: go-to-market plan

First written October 27, 2026; revised the same day. A working plan for getting The Watch read, shared, and found by
search engines and AI assistants. Revise it as sections ship.

**Current focus: get the right pages into Bing.** Social and in-app browsers come second. The new-section backlog
(section 5) is ordered so each build also feeds one of those two channels.

**Assumption:** the home market is Central Ohio. The Home desk's examples use Columbus and 43215, and the Barn Hunt
page is Central Ohio.

---

## 1. The pitch

**The Sunday paper, six times a day.** Everything the fat 1998 Sunday paper had (the front page, the inserts, the
comics and puzzles, the classifieds, the box scores, the weekly ads), rebuilt as one free, private, interactive site
that refreshes every four hours.

| Audience | Line |
| --- | --- |
| General reader | Every outlet's take on a story, side by side, plus everything else the Sunday paper used to carry. |
| Local reader | Your town's scores, shows, sales and stuff for sale, next to the world's news. |
| Pinterest and TikTok | Gift guides, recipes, date nights and home projects that are tools, not just pictures. |
| Tech crowd | A whole newspaper that rebuilds itself six times a day on static hosting. No server, no accounts, no tracking. |

Each channel gets one sharp hook. The everything-bundle is what keeps readers once they arrive.

---

## 2. Bing first

### Why Bing

| AI or search product | Relationship to Bing |
| --- | --- |
| Microsoft Copilot and Bing's AI answers | Built on Bing's index. If Bing hasn't indexed a page, Copilot can't cite it. Confirmed. |
| ChatGPT search | OpenAI runs its own crawler, OAI-SearchBot, and says it "sometimes partners with other search providers" without naming them. Bing is widely assumed to be one. Not confirmed, so let OAI-SearchBot in as well. |
| DuckDuckGo, Yahoo | Draw heavily on Bing's results. |

Bing also gives the only first-party view of AI citations: the **AI Performance** report in Bing Webmaster Tools
(public preview since February 2026). It shows which URLs Copilot and Bing's AI answers cite and the "grounding
queries" that pulled them in. That is the scoreboard for this plan.

### Today's blockers (unchanged from the first draft)

- The paper is one JavaScript page with `#/...` routes, so there is effectively one URL. Bing's crawler can run
  JavaScript, but it still treats everything after `#` as the same page.
- No sitemap, no robots file, no structured data, no IndexNow.
- The address is `bboldt86.github.io/lanscape-navigator/news/`, which carries no brand. The name "The Watch" alone
  collides with a TV series and watch brands.

### Order of work

1. **Custom domain first, before any URL goes to Bing.** Bing builds trust per site. Pushing a thousand URLs at the
   github.io address and then moving means Bing re-learns everything through redirects. A domain on GitHub Pages
   takes a day at most. GitHub then redirects the old github.io links to it automatically.
2. **Pre-render real pages** from the JSON the updater already writes (inventory below).
3. **Deploy through GitHub Actions** (the Pages artifact) instead of committing the generated HTML. See "Size
   limits" below.
4. **Verify the site in Bing Webmaster Tools.** Submit the sitemap index, turn on IndexNow, and open the AI
   Performance report. Do Google Search Console at the same time; it is the same work.
5. **Release in waves.** Wave 1 is about 260 pages of the most original material. Wave 2 follows once Bing reports
   most of wave 1 as indexed. A new site that opens with a thousand thin pages gets judged on them.

### URL inventory: exactly what goes to Bing

Counts are from the data files as of October 27, 2026.

| Group | URL | Pages now | New per day | Wave | What makes it worth indexing |
| --- | --- | --- | --- | --- | --- |
| Reports | `/news/report/<slug>/` | 8, plus 16 translations | 1 to 3 | 1 | Full text, cited, original. Portuguese and German versions linked with `hreflang`. |
| Columns ("The week, three ways") | `/news/columns/<date>/` | 1 a week | | 1 | Original writing. |
| Desk fronts | `/news/desk/<desk>/` | 20 | | 1 | The desk's top stories as plain text, linking down to everything below. |
| Numbers pages | `/news/numbers/<topic>/` | about 100 | updated, not new | 1 | Gas and diesel, mortgage rates, the Fed rate, inflation, jobs, home prices and rent, today's markets, sectors, the earnings and economic calendars, the grid (Lower 48 plus 13 regions), electricity price for each state and D.C., and the data center tracker with a page per project (20). People search these every day. |
| Tools and apps | `/news/tools/<app>/` | about 30 | | 1 | One landing page per app with a real explanation and an FAQ above or below it. Covers LANscape and its Duplicate Finder and PDF Reader, ScrollOS's 8 tools, Create's 3 apps, Voyage Planner, Home Saver, Budget, Craftmas, Carte, Together/90, Date Night, Meridian, WX Center, Easy Remote, the dressage test scorer, the board-foot calculator and the pot-odds tool. |
| Gift guides | `/news/gifts/<guide>/` | 0 (build now) | | 1 | Seasonal searches peak in November and December. See section 5. |
| Election 2026 | `/election2026/<state>/<race>/` | about 75 (35 Senate, 36 governor, plus the House) | | 1 | Ship before November 3. Keep them afterwards as results pages. |
| Weekender | `/travel/<city>/`, `/travel/points/` | 9 | refreshed weekly | 1 | Original weekly guides. |
| Hobbies | `/news/hobbies/<hobby>/` | 3 | | 1 | Guides, calendars and tools. |
| Formula 1 | `/news/f1/<race or driver or team>/` | about 65 | after each race | 2 | Original charts: lap-by-lap position, tyre strategy. |
| Sports leagues and teams | `/news/sports/<league>/`, `/news/sports/<league>/<team>/` | about 30 league pages, 324 teams | | 2 | The angle ESPN doesn't own: where to watch every game and the ticket price across sellers. |
| Fantasy players | `/news/sports/fantasy/<player>/` | about 200 of 584 | updated weekly | 2 | Usage against expected points, in the reader's scoring. |
| Story comparisons | `/news/story/<slug>/` | about 9 per edition | 15 to 25 | 2 | Only stories five or more outlets are covering: every outlet's headline and angle side by side. |
| Finds collections | `/shop/<section or trend>/` | 36 | | 2 | Sections and trends, never single products. |

**Never index:** single headlines, individual games outside the postseason, single products, the six-per-day
edition archive, For You and other personal views, search results, the Reel player, or app screens with someone's
saved state. Give them a `noindex` tag, or don't render them as pages at all.

**Totals:** wave 1 is about 260 pages, wave 2 about 650 more, then roughly 20 to 30 new pages a day.

### What every indexed page needs

- The real text in the HTML before any script runs: a heading, the date, the byline, the body and the sources.
- A unique title that leads with what people search, such as "Gas prices today: national average and every state".
- A visible "Updated" time and a matching `dateModified` in the structured data.
- One canonical URL. Tracking parameters on shared links point back to it.
- Structured data: `NewsArticle` for reports and columns, `Dataset` for numbers pages, `SoftwareApplication` for
  apps, `Recipe`, `Product` lists and `Event` as those sections arrive.
- A short answer at the top ("The national average is $3.07, down 4 cents this week"), then the detail. AI answers
  tend to cite pages that state the fact plainly near the top.
- Links in from the desk front and from an "Inside today's paper" index page. That page is the old Sunday-paper
  "Inside" box, and it doubles as a map of the whole site for crawlers.

### Sitemaps and IndexNow, specifically

- **A sitemap index** pointing to one sitemap per group: reports, numbers, tools, gifts, election, travel, sports,
  fantasy, stories and shop. Each sitemap holds at most 50,000 URLs.
- **Accurate `lastmod`.** Change it only when the visible content changes. Bing uses it to decide what to recrawl,
  so a date that changes on every run teaches Bing to ignore it.
- **IndexNow at the end of each edition.** Send one request listing only the pages that are new, or whose content
  actually changed. A request can carry up to 10,000 URLs. Bing sets a daily quota per site, based on the site's age
  and traffic, and Bing Webmaster Tools shows it. Numbers pages get pinged at most once a day, unless a figure moves
  enough to change the headline. The key file sits at the domain root, and the same request also reaches the other
  IndexNow engines.
- **robots.txt** allows Bingbot, OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot, Claude-SearchBot, Claude-User,
  PerplexityBot, Applebot and Googlebot, and names the sitemap index. Leave out `Crawl-delay`, because Bing obeys it
  and it would slow everything down. Don't block the JSON files the pages read.
- **Bing News:** check whether Bing's publisher application, Bing News PubHub, is taking submissions. Apply once
  the About, How this paper is made, Corrections and Contact pages exist.

### Size limits (the 1 GB question)

- **The published site is capped at 1 GB.** It is about 65 MB today.
- **Images are the real risk.** A report's share card is a PNG of several hundred kilobytes. Pinterest images will be
  larger. Save cards as JPEG or WebP at about 100 KB. Make Pinterest images only for wave 1 pages and gift guides.
  Delete or move images older than 90 days. Cloudflare R2's free tier is a good place to move them.
- **HTML is cheap.** About 900 pages at roughly 30 KB each is about 30 MB, and 25 new pages a day adds roughly
  275 MB a year. Old story pages can fold into monthly archive pages after 90 days.
- **The repository itself** is about 64 MB after 16 days, because every edition commits JSON. GitHub recommends
  keeping repositories under 1 GB. If the generated HTML were also committed six times a day, the repository would
  pass that within months. Build the pages in the workflow and publish them with the Pages deploy action, so they
  never enter git history. Re-measure every month. If the JSON alone gets heavy, move it to a data branch that is
  squashed periodically.

### Measuring Bing

| Signal | Where | Target |
| --- | --- | --- |
| Wave 1 indexed | Bing Webmaster Tools, Site Explorer and URL Inspection | Most of wave 1 within a month |
| AI citations and grounding queries | Bing Webmaster Tools, AI Performance | Any citations within six weeks, then growth |
| Clicks and impressions | Bing Webmaster Tools, Search Performance | Rising week over week |
| Crawled but not indexed | Bing Webmaster Tools | Fix or `noindex` whatever lands here |
| Referrals from chatgpt.com, copilot.microsoft.com, perplexity.ai and claude.ai | Site analytics | Any at all within two months |

---

## 3. Social, and apps that work inside the Pinterest, Instagram and TikTok apps

### The in-app browser problem

A link tapped inside Pinterest, Instagram, Facebook, TikTok or X opens in that app's own browser, not in Safari or
Chrome. Nobody can install an app inside Pinterest. The goal is that a tapped pin opens a tool that works right
there, fast. In-app browsers have known gaps:

| Gap | What breaks | What to do |
| --- | --- | --- |
| Separate, short-lived storage | Saved lists, checklists and plans vanish, or never reach the reader's real browser. | Keep small state in the URL so a shared link carries it. Add "Send to my browser" and "Save link" buttons, and export to a file or calendar. |
| Google sign-in is blocked | Google refuses sign-in from embedded browsers, so Drive features can't work. | Detect it and offer "Open in Safari or Chrome" only for that feature. |
| No service workers, often | Offline mode and install prompts don't work. | Never require them. |
| Downloads and pop-ups blocked | PDF export and new windows fail. | Use the system share sheet, and fall back to copying. |
| Camera and microphone often refused | P2P calls and photo-based tools fail. | Detect it before starting, and offer to open in the browser. |
| Slow first load | People back out after a few seconds. | Keep each app's first load under about 300 KB. The paper is about 500 KB and LANscape is 2.2 MB, so neither should be the landing page for a pin. |

Detect in-app browsers from the user agent (Pinterest, Instagram, Facebook, TikTok, X). Show a slim "Open in your
browser" bar only when the reader taps something that needs it. Test each app on a real phone inside each app before
promoting it there. Desktop emulation doesn't catch these.

### Platform by platform

| Platform | What works | The Watch's play |
| --- | --- | --- |
| **Pinterest** | A visual search engine. Pins keep sending traffic for months, and links are clickable. Article, Product and Recipe Rich Pins fill in automatically from the page's metadata. | The best fit for most new sections: gift guides, recipes, coffee, date nights and picnics, home projects and cost calculators, houseplants, fall style, photo books, dressage. Use tall 2:3 images (1000 x 1500) made by `share.py`. Give each section its own board. Pin seasonal content 30 to 45 days ahead, which means holiday guides go up now. |
| **TikTok** | Short video, and photo carousels. A bio link needs a Business account, or about 1,000 followers on a personal one, so start as a Business account. | Auto-made clips from your own charts and text. Carousels of gift guides and zine pages. BookTok for the book section. |
| **Instagram** | No clickable links in posts or Reels. Links go in the bio and in Story link stickers. Comment-for-link replies through Meta's messaging API also work. | Carousels (the zine, gift guides, recipes) and Reels cross-posted from TikTok. The bio points at a links page on your own site, which stays indexable, rather than a third-party link page. |
| **Facebook** | Pages, local Groups, and links with full previews. Clear cached previews with Meta's Sharing Debugger. | Local first: high school scores, events, classifieds and lost pets in Central Ohio groups. Cruise and dressage groups are large and active. |
| **X** | Large-image cards. Posts with links are widely reported to get less reach. | Put the chart in the post and the link in the first reply. Lead with markets, elections, F1 and fantasy charts. |
| **YouTube Shorts** | Shorts also show up in Google and Bing video results. | The same clips as TikTok. |

The rest of the social engine is unchanged from the first draft. Every edition writes share cards and short clips
from your own charts. A Sunday zine goes out every week. A newsletter is fed from the RSS feeds. **Rights rule:**
re-post only your own charts, text and maps, never the outlets' photos or clips. Embedding Instagram, TikTok and
YouTube posts with their official embed codes is fine; copying them is not.

---

## 4. Launch timing

| When | What |
| --- | --- |
| This week (to November 2) | Domain. Render step and Actions deploy. Wave 1 pages. Bing Webmaster Tools, IndexNow, robots.txt. Election race pages. |
| November 3 | Election night: live share cards for close races, posted to state and local communities. |
| Week of November 2 | Gift guides and the Pinterest account with boards. In-app browser fixes. Tall pin images. |
| Week of November 9 | Landing pages for the PDF tool and the Duplicate Finder. Hardwood floor cost calculator. Coffee guide. Show HN launch of the paper. |
| By November 27 (Black Friday) | Hunt list and restock alerts. Swipe to Style, first version. Fall shopping and wedding-guest guides refreshed for holiday parties. |
| Late November to December | Wave 2 pages. Holiday-dinner recipes. Party planner. Holiday reading list. Watch with Me and the buddy list ("read the paper with Grandma"). Year-in-review zine. |
| January | "What everyone makes," resume help and career paths. House to-do tracker. Old Mac to Linux guide. |
| February to March | High school tournaments. Spring home projects. |

---

## 5. Section backlog

Status: **Built** means it is live; **Partial** means something to build on exists in the repo; **New** means
nothing yet. "Best channel" is where the section should be promoted first.

### Gifts, style and shopping (Finds)

| Idea | Status | Best channel | Notes |
| --- | --- | --- | --- |
| Gift guides: for him under $100, DIY gifts for him, up to $1,000, no limit; for parents, friends, a special someone | New, on Finds | Pinterest, Bing | **First priority.** One page per guide, priced live from Finds, with reasons for each pick. Each guide gets several pins, one per price tier. |
| Fall shopping guide and fall wedding-guest outfits | New, on Finds | Pinterest, TikTok | Refresh it for holiday parties in December. |
| Swipe to Style | New (never built) | Pinterest, TikTok | Swipe right or left on Finds items. It learns the reader's style in the browser and builds a board, which can be pinned to Pinterest. |
| Hunt list for sold-out gifts | New, on Finds | Bing, TikTok | Restock checks and price history. Ship before Black Friday. |
| DIY photo books and self-print options | New | Pinterest | A comparison of print services, plus a layout tool that exports a print-ready PDF with pdf-lib, which is already in the repo. |
| Weekly ad | New | Facebook, Pinterest | Flippable deal pages, from Finds' markdowns first and local advertisers later. |

### Home, DIY and the house

| Idea | Status | Best channel | Notes |
| --- | --- | --- | --- |
| Property Brothers-style renovation section | New | Pinterest, Bing | Before-and-after budgets, "what that reno costs in Columbus," and episode guides. Use your own pictures and charts, not the network's. Name the show, but don't imply any tie to it. |
| DIY cost estimators, starting with hardwood floors | New | Bing, Pinterest | Calculators rank well in Bing and pin well. Follow with paint, tile, deck and fence. |
| House to-do list and tracker | New | Pinterest | Reminders go out as calendar files (`.ics`), which works with no server and inside in-app browsers. |
| Fixes for common household problems | New | Bing, TikTok | The reader describes the problem, lists the parts they have or attaches a photo, and gets a prompt to paste into their own AI. Voyage Planner already works this way. Each common fix also gets a written guide page for Bing. |
| Houseplant log with reminders | New | Pinterest, TikTok | Reminders as calendar files. Plant care guides as pages. |
| Apple Home setups | New | Bing, Pinterest | Guides and Shortcuts recipes. |
| Stereo receiver controller and audio settings | New | r/hometheater, Bing | **Constraint:** a secure (HTTPS) page can't call plain-HTTP devices on the home network. Browsers block it. Plan for a saved local copy, or a small local bridge such as Home Assistant. Easy Remote has the same limit, so check whether it works from the hosted page. |
| Custom TV apps | Partial: Easy Remote | Bing | A big-screen "TV mode" of the paper for TV browsers, then the remote. |
| Photo frame | New | Pinterest, Facebook | Turns an old tablet into a frame. It shows the reader's own photos (which stay on the device) between the day's headlines and weather. |

### Food and entertaining

| Idea | Status | Best channel | Notes |
| --- | --- | --- | --- |
| Fine-dining recipes at home ("Michelin at home") | New | Pinterest (Recipe Rich Pins), Bing | Use `Recipe` structured data. Write recipes in your own words and credit inspiration. **Rename it:** Michelin is a trademark, and the name implies a tie that isn't there. |
| The ultimate coffee guide: home barista under $1,000 and with no limit | Partial: Finds has barista items | Pinterest, TikTok, Bing | Short how-to clips, a gear guide priced live, and a dial-in calculator. |
| Birthday and dinner party planner | Partial: Carte | Pinterest | A guest list, a menu, a shopping list and a timeline, with the run-of-show exported to a calendar. |
| Picnic and Bachelor-style date plans | Partial: Date Night | Pinterest, TikTok | Grand-gesture plans with a checklist and a budget. |

### Travel

| Idea | Status | Best channel | Notes |
| --- | --- | --- | --- |
| In-depth cruise news | Partial: Voyage Planner | Facebook cruise groups, Bing, Pinterest | Ship news, itinerary changes, policy and price changes, and port guides. |
| International flight dashboards and notes | Partial: Weekender, Meridian | Bing, X | Route dashboards, fare notes and disruption updates. |
| Amex perks and Fine Hotels + Resorts search | Partial: Points Hacker | r/amex, Bing | A searchable map and table of FHR hotels with their benefits. Pages per city, such as "FHR hotels in Paris", target long-tail searches. |
| The Venetian, in depth | New | Bing | Resort fees, parking, policies and costs, dated and sourced. Then extend it to every big Las Vegas resort as "Vegas hotel fine print." Las Vegas is already a Weekender city. |

### Books, culture and creators

| Idea | Status | Best channel | Notes |
| --- | --- | --- | --- |
| Book reviews: Reese's Book Club picks and nonfiction | New | TikTok (BookTok), Pinterest, Bing | Cover the monthly pick without implying any tie to the club. |
| Book summaries ("Cliff Notes") | New | Bing | Write summaries in your own words with only short quotes. The field is crowded (SparkNotes, Blinkist), so tie summaries to the review section's books. |
| Comedy tour reviews and intros | Partial: Late Night | Bing, Facebook | Tour dates near the reader, with ticket links. Pages like "[comedian] tour 2026 Columbus". |
| Creators by topic: who to follow and their recent posts | New | Pinterest, TikTok | Use official embeds. YouTube channels come through RSS, which the paper already reads. Instagram's and TikTok's own APIs are closed to this use, so a weekly Claude task curates those embeds. |
| WSOP vloggers | Partial: the poker hobby page | Bing, r/poker | Bios, the vlog feed, results (link to The Hendon Mob rather than copying its database), and Plus One-style partner pages. Plus One's rules apply here too: public relationships only, no rumours. |
| Politics on the campaign trail | Partial: Election Desk | X, Bing | After November 3, track 2028 hopefuls' public events and visits. |

### Cars

| Idea | Status | Best channel | Notes |
| --- | --- | --- | --- |
| How to buy a car (with Russ Flips Whips and Bowties and Benzes) | Partial: the garage | Bing, YouTube | A step-by-step guide that embeds their videos and links to their channels. |
| Diesel trade-in negotiation (the 2016 diesel case) | New | Bing, Facebook groups | Value ranges, a checklist and a negotiation script. |
| Recall alerts | New | Bing, Facebook | NHTSA's free recall data by make, model and year. The same pattern works for CPSC product recalls and FDA food recalls. |

### Horses and hobbies

| Idea | Status | Best channel | Notes |
| --- | --- | --- | --- |
| Equine and dressage section | Partial: Barn Hunt, the dressage page, Finals Saturday, the test scorer | Facebook groups, Pinterest | Promote dressage from a hobby page to a desk of its own. |
| Ride video review (Pivo footage through a local preprocessor) | New | Facebook groups, YouTube | Runs on the reader's own Ubuntu machine, like ScrollOS, so ride videos stay private. It marks movements, rhythm and test timing. No poker ingestion code is in this repository yet, so this starts from scratch. |

### Money and work

| Idea | Status | Best channel | Notes |
| --- | --- | --- | --- |
| S&P 500 against the money supply (M2) | New, on Markets | X, r/dataisbeautiful | M2 comes from the Federal Reserve. Take it through DBnomics, because FRED blocks GitHub's runners. |
| Votes, voters and money: a Sankey per bill | Partial: The Hinge's money flows | X, reporters | Roll calls from Congress.gov and the House and Senate clerks, plus money from the FEC's free API. Present it as who voted and who funded them, not as proof of influence. |
| Resume help and job postings | New | Bing, LinkedIn | A private, in-browser resume builder, plus local employers' postings marked up as `JobPosting`. |
| Career paths: who is doing what, and what is in demand | New | LinkedIn, Bing | BLS projections and wages. Pairs with "What everyone makes" in January. |

### Everyday apps and the private network

| Idea | Status | Best channel | Notes |
| --- | --- | --- | --- |
| PDF tool: merge, split, sign, compress | Partial: LANscape's Reader and pdf-lib | Bing | "Your files never leave your device" against iLovePDF and Smallpdf. Searched constantly. |
| File navigator to clean up a hard drive | **Built**: LANscape's Duplicate Finder | Bing, Hacker News, r/DataHoarder | Needs only a landing page. "Find duplicate files free and private" is a large search. |
| Docs, sheets, slides and kanban | Partial: LANscape's Write, Ledger and Slide Show; ScrollOS tools; Create | Bing, Hacker News | Make each a standalone page under 300 KB, so it works from a pin or a search result. |
| Old Macs to Linux | New, pairs with ScrollOS | Hacker News, r/linux, Bing | A guide per Mac model and year. |
| Google Drive and P2P file sharing | Partial: Vision's browser-to-browser link | Bing | Use Drive's narrow `drive.file` permission, which avoids Google's heaviest app review. Remember that Google sign-in fails inside in-app browsers. |
| Buddy list and P2P chat | Partial: Create and Together/90 use PeerJS | Hacker News | An AIM-style buddy list fits LANscape's 90s look. |
| Comments within the P2P network | New | | Comments only your buddies see, so there is no public comment section to moderate. Blocking and reporting are still needed. |
| P2P video calls and meetings | Partial: PeerJS in Create | | Calls on some networks fail without a TURN relay server, which costs money. Budget for one. |
| Watch with Me: read the paper together on a call | New | Facebook, TikTok | Shared scrolling and pointing over the call. A genuinely new take on the Sunday-paper ritual. |

### More Sunday-paper ideas

| Idea | Best channel | Notes |
| --- | --- | --- |
| 100 years ago today | Facebook, Pinterest, Bing | Front pages from 1926, from the Library of Congress's Chronicling America. They are public domain and free to use. Fits the retro look. |
| TV listings: what's on tonight | Bing | TVmaze's free schedule API, with credit as its license requires. |
| Horoscopes | Pinterest, TikTok, Bing | A Sunday staple, and searched daily. Label them as entertainment. |
| Advice column | TikTok, Facebook | Reader questions, Claude's answers reviewed by a person. |
| The Mini Page for kids | Pinterest, Facebook | Puzzles and explainers. Collect nothing from children. |
| Restaurant inspections | Facebook, Bing | Local health departments publish them. Popular local reading. |
| Garage sale map, lost and found pets | Facebook | Low-risk, well-liked starters for the classifieds before full listings. |
| Open houses this weekend | Facebook, Bing | Comes from the Home desk once a RentCast key is added. |
| Daily word game and mini crossword | X, Facebook, TikTok | Still the best habit-forming feature, with a share grid. From the first draft. |
| "What everyone makes" | Reporters, Bing | Still the best link-earning piece. Publish in January. From the first draft. |

---

## 6. Guardrails

- **AI-written content.** Keep the bylines, the sources and the "nothing is invented" rule. Publish a corrections
  page. Never index thin auto-made pages.
- **Other people's work.** Headlines, short excerpts with links, and official embeds are fine. Copying full text,
  photos, videos or databases (The Hendon Mob, recipes word for word) is not.
- **Trademarks.** Michelin, Reese's Book Club, Property Brothers, The Bachelor and WSOP can be named and reviewed.
  Don't use them as section names or logos that suggest a partnership.
- **People.** Plus One's rules (public relationships only, no rumours, nothing about children or homes) apply to
  creators, vloggers and influencers. High school sports report teams, not children.
- **The privacy promise.** Analytics, Pinterest tags, push alerts and P2P features must not quietly break "no
  sign-up, nothing leaves your browser." Say plainly what each one collects. Avoid ad-tracking pixels; use UTM tags
  and the platforms' own analytics instead.
- **Community rules.** Read each subreddit's and group's self-promotion rules before posting.
