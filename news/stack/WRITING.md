# The Stack: how it is written

The Stack (news/stack/) is an app-style feed of five-minute ideas. Brad asked for it on Nov. 19, 2026: a launch library of 12 hours, then 3 more hours every day for 30 days (Nov. 20 through Dec. 19, 2026), covering electronics and poker plus general topics. A daily scheduled Claude session does the writing; there is no API spend.

## The daily job

1. `python3 news/stack/tools/build.py titles` and read it. Never write a title that is already there; continue the series that are under way and open new ones from the lists below.
2. Make `news/stack/src/<today, YYYY-MM-DD, America/Chicago>/` and write the day's pieces into `.txt` files there (six or seven pieces a file, named `<topic>-<n>-<series>.txt`). If the folder already has pieces, top it up; do not start a second folder for the same day.
3. Write until `python3 news/stack/tools/build.py day <today>` reports **at least 3.0 hours** with no problems. That is about 40 pieces. Spread them: about 7 electronics, 7 poker, and 6 or 7 each of money, mind, world and life.
4. `python3 news/stack/tools/build.py` (builds `data/`; exit 1 means fix the listed lines and run again). Commit `news/stack` only and push to `main`. Commit message: `The Stack: <date>, <n> pieces, <h> hours`.
5. After Dec. 19, 2026, write nothing; say the 30 days are done.

## File format

```
=== topic | Title of the piece | Name of the series
> One or two sentences that say what the reader gets. Shown on the cover card and read aloud first.
# Card heading
One paragraph, 85 to 125 words. Plain sentences.
# Next card heading
...
```

- `topic` is one of: `electronics`, `poker`, `money`, `mind`, `world` (history and science), `life` (health and home).
- Seven cards a piece (5 to 8 allowed), each 55 to 135 words; a piece is 620 to 900 words. The build counts and refuses anything outside that. Hours are words divided by 150; they are counted, never estimated.
- A card must fit one phone screen and stand on its own: someone may save or share just that card.
- No markdown, no bullet lists, no links, no emoji. Write numbers the way a voice can read them ("10 kilohms", "about 35 percent", "9 to 2"), because the phone reads the text aloud. Avoid symbols a voice stumbles on (Ω, µ, ≈, ×, /); spell them out.
- An optional line `+ Further reading: ...` names a real book or source for the piece. Only name one you are sure exists and says this.

## What the writing is

- Original lessons on the subject. **Not summaries of books, courses, videos or anyone's article.** A piece may mention where an idea comes from in a clause (who showed it, when), never walk through a book's chapters or reproduce its phrases.
- Each piece teaches one thing a person can use or repeat: a first card that sets the picture, cards that build with real numbers and one worked example, a last card that says what to do with it.
- Concrete and specific. A number, a name, a date or an example on almost every card. No filler openers, no "in today's fast-paced world", no cliffhangers, no questions to the reader as section endings.
- Voice: a knowledgeable friend explaining across a table. Second person is fine. Short sentences. No em dashes.

## Accuracy

- Stable knowledge (how a capacitor works, pot odds, compound interest, what happened in 1929) can be written from what you know. **Any figure, date, name or record you are not certain of: look it up with web search, or leave it out.** Do not round a guess into a fact.
- Nothing about the present state of the world (current prices, rates, laws, records, rankings, who holds a title) unless searched that day, and then say "as of <month year>".
- Studies that failed to replicate or are disputed (ego depletion, power posing, the 10,000-hour rule as a law, learning styles, the marshmallow test as destiny) are described as disputed.
- Poker: no-limit hold'em unless the piece says otherwise. Odds and equities must be right; compute them, do not recall them loosely. Poker and money pieces teach how to think; they do not promise winnings or returns.
- Health pieces: general, mainstream guidance only. No doses, no diagnosis, no treatment of a condition; say when something is a reason to see a clinician. Home and car pieces: say when a job needs a licensed trade (mains wiring, gas) and put safety first.
- Electronics: low-voltage bench work. Mains voltage is described, never taught as a first project.

## Series to draw on (open new ones freely; these are seeds, not a schedule)

- **electronics**: Analog building blocks (filters, amplifiers, comparators, oscillators, the 555) · Famous chips and how they work · Sensors · Motors and how to drive them · Power (regulators, converters, battery management, solar) · Microcontroller projects step by step · Radio and wireless (antennas, modulation, Bluetooth, Wi-Fi, LoRa, amateur radio) · Audio · Reading and designing circuit boards · Test gear · Repair and fault-finding stories · How it works (touchscreens, hard drives, displays, cameras, GPS receivers, chargers) · Computer architecture from gates up · The history of electronics · Home and car electrics explained · Safety.
- **poker**: Preflop by position · Postflop by board type · Hand-reading walk-throughs · Tournament play (stages, bubble, final table, ICM) · Pot-limit Omaha basics · Probability for card players · Game theory ideas in plain words · The mental game · Live play (etiquette, tells, hosting a home game) · Bankroll and record keeping · Poker history and famous hands (searched and sourced) · Other games' maths (blackjack, craps, roulette, sports betting) and why the house wins.
- **money**: Personal finance mechanics · Investing ideas · Reading financial statements · How businesses make money (one business model a piece) · Negotiation · Economics in plain words · Careers and pay · Famous manias and crashes · Taxes and retirement accounts (U.S.; say so) · Small-business basics.
- **mind**: Biases one at a time · Learning and memory · Habits and attention · Decisions under uncertainty · Communication and persuasion · Emotions and stress · Classic experiments and what held up · Mental models · Writing and thinking clearly · Philosophy for daily life (Stoics, Aristotle and others, from the public-domain sources).
- **world**: Inventions that changed things · Turning points in history (one event a piece) · Lives in five minutes · Physics, chemistry, biology and earth science ideas · Space · Mathematics ideas · How we know (the evidence behind a big claim) · Engineering feats · Medicine's history · Maps and places.
- **life**: Sleep, strength, cardio, mobility · Food and cooking technique · Kitchen science · House systems (water, heat, power, roof) · Repairs a homeowner can do · Car care · Tools · Cleaning and laundry science · First aid and preparedness (general) · Outdoors · Everyday skills (knots, sharpening, packing, tipping, maps).

## The app, briefly

- `index.html`, `stack.css`, `stack.js`, `manifest.webmanifest`, icons. No build step for the app itself.
- `tools/build.py` reads `src/` and writes `data/index.json` (every piece: id, topic, title, dek, series, cards, words, minutes, day, pack) and `data/packs/<day>-<n>.json` (the cards, 24 pieces a pack).
- Listening: the device's own voice (Web Speech) reads the card on screen. `data/audio.json` is the slot for recorded audio: `{"<piece id>": {"src": "audio/<id>.m4a", "marks": [seconds at which the cover and each card start]}}`. When a piece has an entry the app plays the recording instead. Nothing fills it yet; it is meant for a voice rendered on Brad's Mac mini once that machine is connected.
- Reader state is `localStorage watch.stack.v1` (topics, seen, done, saved, seconds per day, goal, rate, voice).
