# Weekender: how it gets made

Weekender (`travel/index.html`, served at <https://bboldt86.github.io/lanscape-navigator/travel/> and as
`www.weekender.travel` inside LANscape) is one static page. It plans three days in eight cities for the coming
weekend, every week, and sends flight and hotel searches to the big travel sites with the trip filled in.

## The guides (`travel/guides/`, `guides.py`)

One guide per city per weekend, `travel/guides/<Friday>/<city>.json`, for San Francisco (`sf`), Los Angeles (`la`),
Miami, New York (`nyc`), Paris, London, Prague and Las Vegas (`vegas`). Two scheduled Claude tasks write them early
each Monday for the weekend that follows (Friday to Sunday): one does San Francisco, Los Angeles, Las Vegas and
Miami; the other New York, Paris, London and Prague. Each guide has:

- a title, a summary and an opening picture (an English Wikipedia article);
- an introduction about that weekend (the season, what's on, anything changing such as a clock change or a holiday);
- three days, each with 4 to 7 stops in time order (eat, drink, see, do, walk, shop, night), each with its
  neighborhood, a paragraph, and, where they exist, its website, a booking link and a Wikipedia title;
- three hotels: a splurge, a classic and a good value, priced as $ to $$$$, never as a figure;
- 2 to 8 things on only that weekend, with dates, places and links;
- practical tips, and at least six sources from four sites.

`python3 travel/updater/guides.py check <file>` enforces all of that (1,300 to 3,000 words, the dates matching the
weekend, no quotation over 25 words, no HTML) and `guides.py index` rebuilds `guides/index.json`, which the page
reads. `guides.py weekend` prints the coming weekend. Old weekends stay, under Past weekends.

## Live data (`live.py`, every three hours and when a guide lands)

`.github/workflows/travel.yml` writes, in `travel/data/`:

- `live.json`: the weather for the eight cities, now and for 16 days (Open-Meteo); exchange rates (the European
  Central Bank's, via Frankfurter); U.S. airport delays, ground stops and closures (the FAA's National Airspace System
  status; notices that only close an airport to private planes are left out); and the travel headlines from The
  Watch's latest edition, with each city's stories.
- `photos.json`: for every Wikipedia title the current guides name, the article's lead picture from Wikimedia Commons
  (free licenses only, with its author and license, which the page shows under each picture) and its coordinates.
- `places.json`: coordinates for stops without a Wikipedia article, from OpenStreetMap's Nominatim (cached, one
  request a second, at most 60 new places a run). Together these place the pins on each guide's map.
- `s/<id>.png` and `s/<id>.html` (`share.py`): each guide's link-preview card and share page.

The page reads the weather and the exchange rates live from the same services as well; the copies make it open fast
and keep it working when they don't answer.

**Optional fares:** add a Travelpayouts (Aviasales) API token as the repository secret `TRAVELPAYOUTS_TOKEN` and each
run also records the lowest round-trip fare Aviasales travelers found in the last two days for the coming weekend
(out Friday, or Thursday, back Monday) from 20 U.S. airports to each city. The board and the guides then show
"from $412" with the time it was found. Without it, they show the distance and the flying time.

## Searches

Nothing is scraped and nothing is sold. A search opens the site you pick with your trip filled in:

- Flights: KAYAK, Google Flights, Skyscanner, Expedia and momondo (round trip or one way, travelers, cabin,
  nonstop). Airports come from OurAirports (`data/airports.json`, public domain: large and medium airports with
  scheduled service, plus city codes such as NYC, LON and PAR).
- Hotels: KAYAK (for the eight cities, by KAYAK's own city id in `data/cities.json`), Booking.com, Expedia,
  Hotels.com, Google Hotels and Airbnb. A guide's hotel picks search for that hotel by name.

Next to the buttons: the distance, a rough nonstop flying time (35 minutes plus 500 mph), the time difference from
the reader, the forecast for the trip's dates (Open-Meteo, up to 16 days out), today's exchange rate, and FAA delays
at either end. The reader's airport, units and party size stay in their browser (`localStorage`, `wk.*`).

## Changing it

- **A city:** `data/cities.json` (its airports, KAYAK hotel id, time zone, currency, color and a Wikipedia title),
  then the scheduled tasks' prompts.
- **The page:** `travel/index.html`, one file. It shares The Watch's look: Instrument Serif and Instrument Sans,
  navy and brass (the cards use The Watch's font files in `news/updater/fonts/`, SIL Open Font License). Maps: Leaflet with CARTO's OpenStreetMap tiles.

## Points Hacker (`#/points`)

The cards a points hobbyist carries (Amex Platinum and Gold, the Chase Sapphires, Freedoms and Ink, Capital One
Venture X and Venture, Citi Strata Elite and Premier, the Bilt cards, and the Hilton, Marriott, Hyatt, Delta and
United cards): fees, earning, every recurring credit with its period, current public welcome offers (dated), the hotel
programs (Amex Fine Hotels + Resorts and The Hotel Collection, Chase's The Edit, Capital One's Premier and Lifestyle
Collections), transfer partners and ratios, and The Points Guy's monthly valuations. All of it is in
`travel/points/points.json`, researched from the issuers' own pages first, then The Points Guy, One Mile at a Time,
Frequent Miler, Doctor of Credit and AwardWallet, with sources on each card. A scheduled task re-checks it monthly.

- **My credits**: readers tick the cards they carry; every credit then shows for its current month, quarter, half or
  year with the days left, and a checkbox to mark it used. Kept in the browser (`wk.wallet`, `wk.used`).
- **The lululemon shopper**: items at or under the Platinum's $75 quarterly lululemon credit, and the pairs that use
  the most of it.
- **Hotels by city**: the program hotels in the eight Weekender cities, each with a source showing membership
  (`hotels` in points.json; filled by research, never guessed).
- **Points news**: `live.py` reads the feeds of The Points Guy, One Mile at a Time, Frequent Miler, Doctor of Credit,
  View from the Wing, Upgraded Points, Thrifty Traveler and AwardWallet every three hours (last 7 days, into
  `live.json` as `points`).
