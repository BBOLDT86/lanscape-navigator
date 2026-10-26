# Finds: the curated picks

One file per section, `shop/picks/<section>.json`. Written by Claude (research with sources), refreshed weekly by a
scheduled task. `shop/updater/shop.py` reads these, adds live prices, pictures and eBay listings, and writes
`shop/data/feed.json`, which the page loads. Never edit `shop/data/` by hand.

```json
{
  "section": "coffee",                       // one of the section ids below
  "title": "Coffee & Barista",
  "dek": "One sentence on what this section is for.",
  "updated": "2026-10-26",                   // the day the research was done
  "boards": [                                // 3-5 small collections inside the section
    { "id": "bambino-upgrades", "title": "Upgrades for a 54 mm Breville", "dek": "One sentence." }
  ],
  "items": [
    {
      "id": "normcore-v4-tamper-54",         // unique within the file, lowercase-hyphenated
      "name": "V4 Spring-Loaded Tamper, 53.3 mm",
      "brand": "Normcore",
      "board": "bambino-upgrades",           // a board id above
      "why": "One or two plain, specific sentences: what it is and why it earns a place. No hype.",
      "url": "https://www.normcorewares.com/products/...",   // the product page itself, verified to exist; no tracking or affiliate parameters
      "store": "Normcore",                   // who sells it at that url
      "shopify": true,                        // true only if <url>.json returned Shopify product JSON
      "price": 39.99,                         // as seen on the page, or null if not seen
      "currency": "USD",
      "priceSeen": "2026-10-26",
      "image": "https://cdn.shopify.com/...", // a direct image URL actually seen (Shopify JSON, og:image), or null
      "ebay": "normcore tamper 53.3mm",       // a short eBay search that finds this exact item, new or used
      "tags": ["espresso", "under-50"],       // lowercase; include a price band: under-25, under-50, under-100, under-250, splurge
      "trend": { "where": "TikTok", "note": "What the trend is, one sentence.", "src": "https://dated article documenting it" },  // trending items only
      "sources": ["https://review or report backing the 'why'"],
      "cond": "Pre-owned"                     // optional: for a used, refurbished, open-box or vintage pick; leave out for new
    }
  ],
  "stores": [                                 // brand stores on Shopify worth pulling a live 'selling now' row from
    { "name": "Fellow", "url": "https://fellowproducts.com", "collection": "best-sellers" }   // a collection handle verified at <url>/collections/<handle>
  ]
}
```

Sections: fashion, trending, gifts, coffee, kitchen, home, remodel, tech, garage, outdoors, wellness, equestrian.

Blend new and used: about a quarter of picks can be pre-owned. Prefer the brands' own certified pre-owned, refurbished or
vintage programs (Fellow Rebrew, Clive's certified pre-owned, Weber Renewed, Patagonia Worn Wear and the like); a single
resale listing (eBay, Poshmark) works for a hard-to-find piece, with "cond" set and the price including shipping. Fashion
also blends in Pinfall's resale finds (pinfall/index.html) automatically.

Rules: real products on sale now, each URL checked; prices and pictures only as seen, never estimated; claims in `why`
backed by `sources` (reviews, trend reporting); trending items need a dated source documenting the trend on TikTok or
Instagram; no affiliate links; nothing about any private person.
