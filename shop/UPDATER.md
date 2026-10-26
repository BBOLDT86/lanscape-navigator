# Finds: how the shop fills itself

Finds (`shop/`, <https://bboldt86.github.io/lanscape-navigator/shop/>) is a Pinterest-style board of real products in
twelve sections: Trending (TikTok and Instagram), Fashion, Coffee & Barista, Kitchen, Home, Remodel, Gifts, Tech,
Garage, Outdoors & Travel, Wellness and Equestrian, plus Deals, Saved and a For You feed that learns from what each
reader saves and opens (in their browser only, `localStorage` key `finds.v1`).

## Where the products come from

`shop/updater/shop.py` builds `shop/data/feed.json`. `.github/workflows/shop.yml` runs it every six hours and whenever
`shop/picks/`, `shop/sources.json` or the updater change. Nothing is scraped from a web page:

1. **Store catalogs** (`shop/sources.json`). Every store listed runs on Shopify, which publishes each collection as JSON
   (`/collections/<handle>/products.json`). The updater reads the collection named for each store (its best sellers,
   usually; `"auto"` lets it find the best-seller or newest collection itself) and keeps the name, picture, price,
   sale price and stock. Add a store by adding a line; drop one by deleting it. A store that fails keeps its last
   products. The list was checked from GitHub's servers on Oct 26, 2026 (about 80 of 90 candidates publish their catalog).
2. **Picks** (`shop/picks/<section>.json`, format in `shop/picks/README.md`). Claude's researched choices, each with a
   reason and the reviews or reporting behind it. When a pick's store is on Shopify, its price, picture and stock are
   refreshed from `<product url>.json`; otherwise it shows what research saw, dated. `python3 shop/updater/shop.py check`
   validates the files; the workflow runs it first.
3. **eBay**, through eBay's official Browse API, only when the repository secrets `EBAY_CLIENT_ID` and
   `EBAY_CLIENT_SECRET` are set (free at <https://developer.ebay.com>: create an application, use its Production App ID
   and Cert ID). With them: new and used listings on every pick, and a Pre-owned row in each section from the searches
   in `sources.json`. Without them, the page links to eBay's own search instead.
4. **Trend reporting**: Google News searches about TikTok and Instagram trends, kept only from established outlets.

## Keeping it fresh

A weekly scheduled task refreshes the picks: new trending items with dated sources, seasonal gifts, and sold-out picks
replaced. The page says when prices were last checked and links every product to its store.
