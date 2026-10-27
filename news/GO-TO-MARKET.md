# The Watch: go-to-market plan

Written October 27, 2026. A working plan for getting The Watch read, shared, and found by Google and AI assistants.
It is meant to be revised as sections ship.

**Assumption:** the home market is Central Ohio. The Home desk's examples use Columbus and 43215, and the Barn Hunt
page is Central Ohio. Swap the local names if that is wrong; the plan holds for any metro.

---

## 1. The one-line pitch

**The Sunday paper, six times a day.** Everything the fat 1998 Sunday paper had (the front page, the inserts, the
comics and puzzles, the classifieds, the box scores, the weekly ads) rebuilt as one free, private, interactive site
that refreshes every four hours.

Supporting lines for different audiences:

| Audience | Line |
| --- | --- |
| General reader | Every outlet's take on a story, side by side, plus everything else the Sunday paper used to carry. |
| Local reader | Your town's scores, shows, sales and stuff for sale, next to the world's news. |
| Tech crowd | A whole newspaper that rebuilds itself six times a day on static hosting. No server, no accounts, no tracking. |
| Privacy-minded | No sign-up. What it learns about you stays in your browser. |

**Don't market "everything."** "Everything" is the retention story, not the acquisition story. Each channel gets one
sharp hook (a chart, a game, a hot toy, a box score, a salary). The bundle is what keeps them once they arrive.

---

## 2. The blocking problem: search engines and AIs can barely see the site

This has to be fixed before any promotion, or the traffic spikes leave nothing behind.

What a crawler finds today:

- **One page, and hash routes.** The paper is a single 500 KB `news/index.html` that draws everything with
  JavaScript from `edition.json`. Every desk, story, game and team lives behind a `#/...` address. Google treats
  everything after `#` as the same page, so there is effectively **one indexable URL** for the whole paper.
- **AI crawlers mostly don't run JavaScript.** GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot and most others read
  the raw HTML. They see an empty shell.
- **The report share pages are stubs.** `news/r/<id>.html` holds a headline, a two-line summary and a link onward.
  Only 8 English reports exist that way. The full text never appears as plain HTML.
- **Missing basics:** no `sitemap.xml`, no `robots.txt`, no RSS or Atom feed, no structured data (JSON-LD), no
  `llms.txt`, no web-app manifest.
- **The address works against it.** `bboldt86.github.io/lanscape-navigator/news/` gives no brand signal. A
  `robots.txt` only counts at the root of a host, and the root of `bboldt86.github.io` is a different repository.
- **The name collides.** "The Watch" is shared with a TV series, watch brands and watch-news sites. Searching
  "the watch news" will not find it. The domain needs a distinctive form (for example a "-daily" or "-paper"
  modifier, or a local name).

### Phase 0 fixes, in order

1. **Buy a domain and set it as this repository's GitHub Pages custom domain.** That puts `robots.txt` and the
   sitemap under your control. The paper can stay at `/news/` for now. If it outgrows LANscape, move it to its own
   repository later with redirects.
2. **Pre-render real pages.** Add a step to `news/updater/run.py` (or a new `render.py` in the same workflow) that
   writes plain HTML files from the same JSON the page already reads:
   - `/news/report/<slug>/index.html` with the **full report text**, sources and byline, then loads the app on top.
   - `/news/desk/<desk>/index.html` for each desk: the current top stories as plain links and summaries.
   - `/news/story/<slug>/index.html` only for big stories (say five or more outlets): the "how every outlet covered
     it" comparison. That side-by-side is original; a bare list of other people's headlines is not, so smaller
     clusters stay unindexed.
   - Data pages that change daily and get searched daily: gas prices, mortgage rates, the power grid, electricity
     price by state, the markets summary, the data center tracker.
   Have the app read these clean paths (the History API instead of `#`) so a shared link and a crawled link are the
   same URL. GitHub Pages has no rewrite rules, so each path needs its own `index.html`, which the render step
   writes.
3. **Add `robots.txt`** that allows Googlebot, Bingbot, OAI-SearchBot, GPTBot, ChatGPT-User, ClaudeBot,
   Claude-SearchBot, Claude-User, PerplexityBot and Applebot, and points to the sitemap.
4. **Add sitemaps.** A full `sitemap.xml`, plus a **news sitemap** of articles from the last 48 hours, regenerated
   every edition.
5. **Add RSS feeds**: one for the front and one per desk, plus one for reports and columns. Feeds reach Feedly,
   NewsBlur, Inoreader and Flipboard, and they are an easy way for AI search tools to find fresh items.
6. **Add JSON-LD structured data.** `NewsArticle` on reports and columns, with the AI authorship stated plainly.
   `Dataset` on the data pages. `SportsEvent` on game pages. Later, `Event` for arts listings, `JobPosting` for
   jobs and `Product` with `Offer` for classifieds. Each of those three unlocks a free Google surface (events, jobs,
   shopping listings).
7. **Register and ping.** Google Search Console and Bing Webmaster Tools, sitemap submitted to both. Add an
   **IndexNow** ping at the end of each edition, which tells Bing and others about new pages within minutes. Bing
   matters more than it used to, because ChatGPT search and Microsoft Copilot lean on its index.
8. **Add `llms.txt` and plain-Markdown copies of reports.** Cheap to do. The standard is young and nobody can prove
   it moves traffic yet, so treat it as a bonus, not the plan.
9. **Add the trust pages Google News and AI systems look for**: About, How this paper is made (feeds, ranking,
   what Claude writes, what it never invents), Corrections, Contact, and a privacy page. The site's honesty about
   how it works is a real advantage here; put it on a page instead of only in `UPDATER.md`.
10. **Add privacy-respecting analytics** so the plan can be measured: GoatCounter or Cloudflare Web Analytics,
    page counts only, no cookies, consistent with the site's privacy promise.

### What actually gets a site cited by AI assistants

- The text is in the HTML, at a stable URL, with a date.
- Facts are stated plainly with numbers and sources. Reports and data pages already do this.
- The site is in Bing's and Google's indexes, and is fresh. Six editions a day is a strength once it is crawlable.
- Other sites link to it. The data pages (the power grid, the data center tracker, the "what everyone makes"
  issue) are what reporters and bloggers will cite. Pitch them directly.

---

## 3. Make every edition produce things that travel

The updater already runs six times a day. Have it also write the marketing.

- **Share cards for everything.** `share.py` already draws report cards. Extend it to a "number of the day" card
  (gas, mortgage rate, a market move, grid carbon), a final-score card, an F1 race chart and a fantasy start/sit
  chart. These are your own charts from public data, so they are clean to post anywhere.
- **Short-form video, generated.** Turn the cards into 20 to 45 second vertical clips with ffmpeg: "The Dog Watch in
  40 seconds," "Today's markets in 30," "This week's power bill." Post to TikTok, Instagram Reels and YouTube Shorts.
  YouTube Shorts also show up in Google results.
  **Rights rule:** use only your own charts, text and maps. News photos and clips from outlets are theirs; showing
  them on the site with credit is one thing, re-cutting them into your own videos is not.
- **The Sunday zine.** Once a week, the paper's best as a colorful, flippable issue: the week in pictures (your own
  graphics), the columns, the puzzle, the hunt list, a local spread. Publish it as a web page with its own URL and
  a PDF. It becomes the link in every social profile and the thing people forward.
- **A newsletter.** Email is the only channel you own. Feed a free newsletter tool (Buttondown, beehiiv or Substack)
  from the RSS feeds: a Sunday zine send, plus an optional morning brief. Substack's and beehiiv's recommendation
  networks bring readers from other newsletters.
- **An installable app with alerts.** A web-app manifest and service worker make "Add to Home Screen" work. Push
  alerts for followed teams or big stories need a small push service (OneSignal's free tier works with static
  sites).

---

## 4. Channels, section by section

Lead each channel with the section that fits it. Reddit and most communities ban drive-by self-promotion: take part
for weeks first, post your own work rarely, and always say it is yours.

| Section | Who it is for | Where they are | The hook to lead with |
| --- | --- | --- | --- |
| The whole paper, LANscape, ScrollOS | Builders, tinkerers | Hacker News (Show HN), r/selfhosted, r/LocalLLaMA, Product Hunt, Lobsters | "A newspaper that rebuilds itself six times a day with no server." ScrollOS's P40 build guide for r/LocalLLaMA. |
| Election Desk, The Hinge | Politics watchers | X, Bluesky, Threads, r/fivethirtyeight, local subreddits | Prediction markets against the forecast; the closest races. |
| Business, impact maps, "The week, three ways" | Investors | X fintwit, StockTwits, LinkedIn | The impact Sankey for a big report day; the bull, bear and machinist columns. |
| Power and data centers | Energy and tech people, reporters | LinkedIn, Hacker News, energy newsletters | The data center tracker with megawatts; your state's power bill. Pitch reporters. |
| Film Room (fantasy) | Fantasy players | r/fantasyfootball (follow its rules), FF X and Bluesky, league group chats | The weekly usage and start/sit chart in custom scoring. |
| Formula 1 | F1 fans | r/formula1 (strict), F1 Discords, X | Lap-by-lap position and tyre strategy charts right after each race. |
| Plus One | Pop-culture fans | TikTok, Instagram, Threads | "Celebrity news without the rumors." The no-rumor rule is the brand. |
| Weekender, Points Hacker | Travelers | r/churning (strict), FlyerTalk, travel Facebook groups | The credit tracker; "three perfect days" for the coming weekend. |
| Finds, deals, hunt list | Shoppers | Pinterest, TikTok, Slickdeals forums | Price drops and the restock tracker (see section 5). |
| Hobbies | Dressage, woodworking, poker | Hobby forums, Facebook groups, YouTube comments | The free tools: test scorer, board-foot calculator, pot odds. |
| Portuguese and German editions | Brazilian and German readers | r/brasil, X in Brazil, r/de | The Brazil election desk; the translated reports. |
| Local (to build) | Central Ohio | r/Columbus, Nextdoor, school booster groups, local Facebook groups | Friday-night scores, this weekend's shows, free classifieds. |

---

## 5. New sections, ranked by how much growth they bring

Most of the paper is built. These are the gaps from the Sunday-paper list, ordered by acquisition power, not by
size of build.

1. **Games: a daily word game, a mini crossword, sudoku.** Puzzles are the strongest daily habit a paper has, and a
   spoiler-free share grid (the Wordle trick) turns every player into a promoter. Start with one original daily
   word game with a share grid, then the mini crossword. Generate puzzles ahead of time and check each one by
   program before it goes out.
2. **The hunt list: hard-to-find and sold-out gifts.** The Tickle Me Elmo column, rebuilt. Track this season's hot
   toys and gadgets with in-stock checks, price history and restock alerts, built on Finds. Searches like "where to
   buy [toy] in stock" spike every November and December, and affiliate links pay for it. **Ship before Black
   Friday, November 27, 2026.**
3. **"What everyone makes."** The annual salary issue, like the Parade "What People Earn" insert that rode in Sunday
   papers. Build it from public data: the BLS's wage estimates by metro and occupation, and Ohio's public-employee
   salary records. Real people's stories need their consent. Publish in late January or February, when raises and
   tax season have people thinking about pay. This is the single best link-earning piece on the list: local TV,
   radio and r/dataisbeautiful all pick these up.
4. **Local high school sports.** Parents and grandparents share every score. Start with what the state association
   and schools publish (schedules, scores, brackets), then let athletic directors and booster clubs submit scores.
   **Guardrail:** these are minors. Report teams and published results only, no photos of kids without the school's
   permission, and nothing about individual students beyond what the school itself publishes.
5. **Theatre, arts and local events.** Venues want free promotion and will send listings. Mark each up with `Event`
   data so it can appear in Google's event results, and add ticket links (affiliate where possible).
6. **Classifieds: the open bazaar.** The biggest idea and the hardest. Fix the real pain points: no fees, no shipping,
   and a safe meetup by default (many police stations run public "safe exchange zones"; suggest the nearest one
   automatically). Things to settle before launch:
   - It needs a backend, accounts or verified phone numbers, moderation, and a prohibited-items policy. That breaks
     the "no server" model, so pick a hosted database deliberately.
   - Marketplaces die without enough listings. Launch in one area and a few categories (kids' gear, furniture,
     tools), seed it yourself, then grow outward.
   - Listing pages with `Product` and `Offer` markup can show up in Google's free shopping listings.
7. **Jobs.** Google's job search is the free channel, but it wants postings from employers, not scraped copies.
   Start with direct postings from local businesses (marked up with `JobPosting`; Google's Indexing API accepts job
   pages for fast pickup), tied to the salary issue.
8. **The weekly ad.** Flippable deal pages. Start with Finds' own markdowns. Later, sell local businesses a page in
   the weekly ad: that is the revenue line, and an advertiser's page is also a page they share.

---

## 6. Calendar from today

| When | What |
| --- | --- |
| Now to November 3 | Phase 0 items 1 to 7. Election week is the year's biggest news traffic. Push the Election Desk and The Hinge's closest-race pages to state and local communities, not the big national ones. |
| November 3 (Election Day) | Live share cards for the close races. Don't try to outrank the AP for "election results"; win the shares on the specific races. |
| Early to mid November | Show HN launch of the whole paper on a weekday morning, Eastern time. Product Hunt the same week or the next. Start the Sunday zine and the newsletter. |
| By November 27 (Black Friday) | Hunt list and restock alerts live. Deals in the weekly-ad format. |
| November to early December | High school football playoffs, then basketball season. Pilot local scores in one county. |
| December | Year-in-review zine. Launch the daily word game in time for New Year's resolutions. |
| Late January to February | "What everyone makes." Pitch local TV, radio and papers a week ahead. |
| March | High school tournaments and a bracket game. |
| Every week | The Sunday zine, a few auto-generated videos, one community post somewhere you are already a regular. |

---

## 7. How to know it's working

| Signal | Where | Early target |
| --- | --- | --- |
| Pages indexed | Search Console, Bing Webmaster Tools | Every report, desk and data page within a month of Phase 0 |
| Search impressions and clicks | Search Console, Bing | Rising week over week |
| AI referrals | Analytics referrers from chatgpt.com, perplexity.ai, claude.ai, copilot | Any at all within two months |
| Returning readers | Analytics (aggregate counts only) | The real measure for a paper that updates six times a day |
| Newsletter subscribers | The newsletter tool | The owned audience |
| Shares | Puzzle share grids, card downloads, short-link clicks per channel | Which section travels best |

Tag every link you post with UTM parameters so each channel's results are separate.

---

## 8. Guardrails

- **AI-written content.** Google allows it when it is genuinely useful and not mass-produced to game rankings.
  Keep the bylines, the sources and the "nothing is invented" rule; publish a corrections page; never index thin
  auto-pages.
- **Other outlets' work.** Headlines and short excerpts with links are the aggregator norm. Full text, photos and
  video clips are not yours to republish, especially in social posts.
- **Community rules.** Read each subreddit's self-promotion rules first. One ban on r/Columbus would cost the local
  launch.
- **Minors** in high school sports, as above.
- **Classifieds** need fraud, safety and prohibited-items handling before the first listing.
- **Privacy promise.** Analytics, push and the newsletter must not quietly break "no sign-up, nothing leaves your
  browser." Say plainly what each one collects.
