# AmazonPlus

*(Formerly "Disenshittify Amazon".)*

**[⬇ Install](https://github.com/hraesvilgr/disenshittify-amazon/raw/main/dist/disenshittify-amazon.user.js)** — needs the [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) browser extension. Click the link, then **Install**.

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/K4R529MTQE)

A userscript (and Firefox extension) for Amazon search results. It adds a **AmazonPlus** toggle at the top of the left-hand filter column. Turning it on:

- gives every listing a trust score (0–100) and tier (1–5),
- tints each card from green (trusted) through yellow to red (junk), with a coloured edge,
- re-sorts the results so the most trustworthy listings come first — only on Amazon's default **Featured** order; if you pick another sort (Avg. Customer Review, price, newest, best sellers) your order is kept and the cards are just coloured and rated,
- hides repeat placements of the same product (keeps the organic one, drops the sponsored copy),
- removes the promo blocks Amazon mixes into results (sponsored brand banners and videos, Amazon Haul "Crazy-good finds", "Explore the collection", "Brands related to your search", "Today's deals", "Trending now", "Customers frequently viewed", "Related searches"…). Everything in the results grid that isn't a product card, a section heading, "Narrow your search", pagination or help is removed from the page, with videos stopped and ad frames unloaded first, so their memory is freed. They come back on the next page load. Set `hideClutter: false` in `src/config.js` to keep them,
- adds a small **Trust n/5** pill in each card's top-right corner — click it for a pop-over listing exactly which signals added or removed points.

Inside each badge are **Trust** and **Block** buttons for that listing's brand. Under the toggle, **Brands** opens a manager listing your ratings and the brands it has learned.

**Sort by menu.** While the toggle is on, Amazon's own **Sort by** menu gets two extra entries:

- **AmazonPlus: Trust** — most trusted first. A fresh search shows this by default.
- **AmazonPlus: $/count** — cheapest per unit first, using Amazon's "($0.13/count)", "($2.99/ounce)". Compatible units are converted (pounds and grams → per ounce, millilitres and litres → per fl oz, inches → per foot); listings in the page's most common unit come first, then other units, then listings with no unit price. Subscription prices ("/month") are ignored.

Picking either stays in effect on later searches until you pick one of Amazon's sorts. Amazon's sorts keep Amazon's order with the colours and badges; picking **Featured** shows Amazon's real Featured order for that search. Unlike Amazon's sorts, the AmazonPlus ones re-order the results already on the page (each results page separately) and don't change the URL.

**Product pages.** Click through to a listing and a panel under the title gives a better rating from what only the product page shows, compared with the search-results estimate. Next to the Trust pill, ▲12 / ▼17 / – shows how far the score moved (hover for from → to); opened without searching first, it compares against the rating from the title, stars and review count alone — and lists what changed:

- the brand Amazon states for the listing (instead of the guess from the title), and the exact review count and, where shown, the "Date First Available";
- **Sold by Amazon.com** (+5), or sold by an anonymous trading account such as "luoyanggezhibushangmaoyouxiangongsi" (−6);
- bullet points: 【bracketed】 headings (−6), marketing phrases (−4), deliberately broken words like "baguett-e" (−10), customer-service hard sell (−4), walls of text over 1,300 / 1,800 characters (−3 / −6), or short factual bullets under 600 characters (+3);
- extreme rating spreads only (15%+ 1-star, or 85%+ 5-star with under 6% 4-star) — ordinary spreads don't separate junk from real brands;
- Amazon's own "Frequently returned item" warning (−12).

If Amazon opens a different size or colour than the result you clicked (it often reopens the size you picked last time), or you switch variants on the page, the comparison is with the result you clicked. If a page can't be read, the panel says so and shows the error.

Back on the search results, a checked listing uses the refined rating for 30 days and its pill gets a ✓. Settings live in `productWeights` in `src/config.js`.

**Scan for off-Amazon prices.** A button in the AmazonPlus box — "Scan for off-Amazon prices: 2/20 used so far today" — starts a scan: every listing that has a manufacturer model number (e.g. "(DCF787D1)", "3453-20") — at any price, in any department — is looked up in [UPCitemdb](https://www.upcitemdb.com)'s product database as it comes into view, one at a time, one request per listing, so results you never scroll to cost nothing. The button then reads "Stop scanning…"; the scan lasts until you stop it, leave the page, or reach the daily limit. If an identical item is sold elsewhere — the same model number with nothing else bundled (no accessory sets, no "W/ blower", no 2-packs, no batteries or parts that merely mention the model), new, in stock, by a US store other than Amazon or eBay, at a price UPCitemdb has seen in the last 60 days — the cheapest appears in a blue box beside the Amazon price: "Found at MERCHANT for PRICE", linked to that store's listing (through UPCitemdb's redirect), with "View Google Shopping results" underneath. Listings with nothing identical are left exactly as they are. Nothing is looked up unless you start a scan. UPCitemdb's free plan allows 100 requests a day per internet connection, but only 20 of them can be searches, and each listing takes one search, so the button counts against 20 (about 20 listings a day), with no sign-up; the count comes from UPCitemdb's own replies. Results are kept for 72 hours, so repeat searches don't spend requests on listings already checked. UPCitemdb's store prices can lag behind the stores' own — hover the box to see when the price was seen. Settings are in `priceCheck` in `src/config.js`.

**Books, films, TV, music and games are left alone.** The trust signals are for physical goods, so books (print, Kindle, audiobooks), films and TV (DVD, Blu-ray, Prime Video), music (CDs, vinyl) and video games get no rating. Their product pages get no panel; a search where nearly all the results (80%+) are media gets no AmazonPlus at all (no toggle, nothing re-ordered or removed); on mixed searches the media results get no badge or colour and keep the places Amazon gave them, with the rated listings sorted around them — so a search for a game keeps the game on top. Game controllers, consoles, headsets, chargers and other accessories are still rated.

**On phones,** where Amazon has no sort menu, "AmazonPlus: Trust" and "AmazonPlus: $/count" are added as chips to the Sort by row of Amazon's Filters sheet, and the lit chip shows the order that's actually on screen. Tapping "Featured" there gives Amazon's own order.

On a phone the floating box shrinks to the AmazonPlus logo (as wide as the on/off switch; in colour when AmazonPlus is on, grey when it's off) while you scroll, so it doesn't cover the results; tap the logo to open the full box, and it shrinks again when you tap elsewhere or keep scrolling.

**Tile view.** Search results always show as a grid of cards (as Amazon does for clothing or home decor), even on searches where Amazon would list them row by row — more listings fit on screen, which makes the colours easy to compare. The number of columns follows the window width (two on a phone). Settings: `tiles` in `src/config.js`.

The AmazonPlus box stays in view: once you scroll past it, it floats at the top of the window over the filter column (below Amazon's sticky search bar when that's showing), and settles back into place when you scroll up.

Turning it off puts the page back the way Amazon served it, layout included. The toggle state is remembered, so it stays on as you move between searches and pages.

**Dark mode.** When Amazon shows a dark page, AmazonPlus switches to dark tints with light text, so Amazon's own light text stays readable on the coloured cards; every text the script draws is at least 4.5:1 against its background in both modes.

## Permissions and privacy

- **Userscript:** runs only on Amazon search results pages (`https://www.amazon.com/s*`) and product pages (`/dp/…`, `/gp/product/…`), on www.amazon.com and amazon.com, not in frames. Not on cart, checkout, account or order pages. Grants: `GM_getValue` / `GM_setValue` (the script's private storage) and `GM_xmlhttpRequest` limited by `@connect` to `api.upcitemdb.com` (the off-Amazon price scan).
- **Add-on:** `storage`, and content scripts on the same search and product-page URLs only (no broader host access).
- **What is sent, and where:** only while a scan you started is running: the brand and model number of each listing that has one and scrolls into view (e.g. "DEWALT DCF787D1"), sent to `api.upcitemdb.com`, one request per listing. No cookies, account or key are involved. Nothing else leaves your browser, and nothing is sent anywhere unless you press the button. Set `priceCheck.enabled: false` in `src/config.js` to remove the button. The add-on version doesn't have the price scan and makes no requests at all.
- **Stored locally, in the script's private storage:** whether it's on, your Sort by choice, the search term where you last picked "Featured", the product ID of the search result you last clicked, your brand votes, learned brand data (product IDs, scores, review counts, and up to 20 search terms per brand, capped at 3,000 brands), and the price-scan results (store, price and link per model number, up to 500, for 72 hours) and today's UPCitemdb request count and the ratings of the 300 most recently seen listings — their search-results reasons, the search term they came from, and any product-page check. "Reset learning" under Brands clears the learned data; removing the script clears everything. Nothing is written to amazon.com's own storage (a v0.1 leftover there is migrated and deleted on first run).
- Listing text is only ever inserted as plain text (no `innerHTML`/`eval`), so a listing title can't inject code.
- **Updates:** installed from the link above, Tampermonkey/Violentmonkey check this repository for newer versions and update automatically when `@version` goes up. Installed by pasting the script in by hand, it never updates on its own.

## Browsers and userscript managers

| | Desktop | Mobile |
|---|---|---|
| **Firefox** | Tampermonkey, Violentmonkey or Greasemonkey | Firefox for Android with Tampermonkey or Violentmonkey |
| **Chrome / Edge / Brave** | Tampermonkey (turn on **Allow user scripts** on its extension details page — Chrome 138+). Violentmonkey's stable version no longer runs on Chrome (Manifest V2 was removed); its Manifest V3 version is a beta | Chrome for Android has no extensions |
| **Safari** | Userscripts (free) or Tampermonkey for Safari | iPhone/iPad: the Userscripts app (free) |

- Uses `GM_*` functions where available (Tampermonkey, Violentmonkey) and Greasemonkey 4's `GM.*` functions otherwise. Runs in the manager's isolated script context (`@inject-into content` for Violentmonkey).
- On Amazon's mobile site there is no filter column, so the AmazonPlus box sits above the results, and there is no Sort by menu, so the AmazonPlus sorts aren't offered (the default trust order still applies). Product-page ratings read the mobile layout too.
- The Amazon app is not a browser and can't run userscripts.

## Install

**Userscript (no signing needed):** install Tampermonkey or Violentmonkey, then open the **[Install](https://github.com/hraesvilgr/disenshittify-amazon/raw/main/dist/disenshittify-amazon.user.js)** link and click **Install**. (Or create a new script and paste in `dist/disenshittify-amazon.user.js` by hand.) Reload Amazon afterwards. Rebuild it with `node tools/build_userscript.js` after changing anything in `src/`, and raise the version in `manifest.json` (the userscript's `@version` comes from it) so installed copies pick up the update.

**Temporary add-on (for testing)**

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on…** and pick `manifest.json` in this folder (or the `.xpi`).
3. Open an Amazon search. If the toggle doesn't appear, open `about:addons` → AmazonPlus → **Permissions** and allow access to amazon.com (Firefox lets you switch site access off for Manifest V3 extensions).

Temporary add-ons are removed when Firefox restarts. For a permanent install, sign it through addons.mozilla.org (it can be an unlisted, self-distributed add-on).

## Brands: starter list, learning, and your votes

Brand points come from, in order of priority:

1. **Your votes** (Trust +25 / Block −40), from the badge or the manager. Never overridden.
2. **The starter lists** in `src/brands.js`: ~775 established brands across kitchen, home, electronics, tools, auto, outdoor, clothing, health, pets, toys and office, plus a short junk-name list. Ordinary words and platform names (Apple, Xbox, Kindle, Ring…) are left out because knock-offs lead with them. Titles like "Kindle Case Compatible with Kindle…" are recognised as accessories with no brand of their own.
3. **Learned brands** (trusted +10 / junk −20), built up as you search with the toggle on:
   - Each listing's *evidence* is its score with all brand points removed, so what's learned can't feed back on itself.
   - **Learned junk:** 2+ products from the brand, seen in 2+ different searches, averaging 42 or less, or with half its listings carrying serious red flags (reused photos, pooled review counts, copied phrasing, deliberately broken words).
   - **Learned trusted:** 3+ products across 3+ different searches, averaging 60+, no serious red flags, and every listing with 500+ reviews. Names that look like gibberish are never auto-trusted.
   - Learning only adjusts brands that aren't on the starter lists.
4. Otherwise the brand is judged by its name (gibberish → −18, unrecognized → −6, none → −10).

All thresholds are in `learning` in `src/config.js`. Memory is kept in your browser (extension storage, or Tampermonkey/Violentmonkey storage for the userscript) and is capped at 3,000 brands. **Reset learning** in the manager clears what's learned but keeps your votes.

## How listings are scored

Scoring reads everything from the results page itself — no product pages are fetched and nothing is sent anywhere for it. Each listing starts at 55 points.

| Signal | Points |
|---|---|
| Established brand (allowlist in `src/config.js`) | +22 |
| Brand on the junk-name list (Pavsrmy, Tiawudi, Yupjlia, HOOMIL…) | −26 |
| Brand name is unpronounceable (Pavsrmy, Yupjlia, Cadpxs, ABuff). Pronounceable invented names can't be told from real foreign brands (Suzuki, Xiaomi) by spelling, so those are judged on the other evidence | −18 |
| Unrecognized brand | −6 |
| Your Trust / Block vote | +25 / −40 |
| Listing age from its ASIN: B00… (10+ years) / B01–B06 (~2015–18) / B07–B08 (~2018–20) / B0F+ (last year) | +10 / +6 / +2 / −4 |
| Learned trusted / learned junk | +10 / −20 |
| No brand named at all | −10 |
| Title length over 120 / 150 / 200 characters (under 90 earns +3) | −3 / −6 / −10 |
| Bracketed callouts `【】[]` beyond the first | −4 each, up to −15 |
| Marketing language ("premium", "perfect for", "unleash", "ideal gift", "every occasion"…) | −5 each, up to −15 |
| ALL-CAPS shouting after the brand | −8 |
| Deliberately broken words (`Baguet-te`) | −20 |
| Unusual characters (non-breaking hyphens, zero-width, full-width) | −6 |
| Title written as sentences (semicolons, full stops) | −5 |
| Keyword stuffing (3+ "for …" clauses or 6+ commas) | −4 |
| Concrete specs (dimensions, thickness, temperature, model number) | +4 each, up to +8 |
| Says two different metals ("Carbon Steel … Stainless Steel") | −12 |
| Copies a distinctive phrase from an established brand's title on the same page | −12 |
| No reviews / under 10 / under 50 | −12 / −8 / −4 |
| 200+ / 1,000+ / 3,000+ reviews | +3 / +6 / +8 |
| 4.9★+ on fewer than 30 reviews | −5 |
| Under 4.0★ on 20+ reviews | −6 |
| New on Amazon this month | −4 |
| Exact review count shared with other listings that aren't the same brand's variants | −8 |
| Main photo reused by a different brand's listing (one brand's variants sharing a photo is fine) | −12 |
| Priced under 45% of the page median | −4 |

Tiers: 76+ → 5, 60+ → 4, 42+ → 3, 24+ → 2, below 24 → 1. All weights, thresholds and word lists live in `src/config.js`.

**Not yet covered:** AI-generated product images. That needs either a model or the full-size images, which the results page doesn't provide.

## Files

```
manifest.json          Firefox MV3 manifest
src/config.js          phrase lists, weights, learning thresholds, tier cutoffs
src/brands.js          starter known-brand and junk-brand lists
src/memory.js          brand learning (pure functions)
src/bigrams.js         English letter-pair model for gibberish detection
src/scorer.js          scoring logic (pure, no DOM — runs in Node too)
src/product.js         product-page reading and refined ratings
src/pricecheck.js      model numbers and identical-item matching for the price scan (pure)
src/content.js         toggle, scraping, colouring, sorting, restore, price scan
src/styles.css         injected styles
tools/train_bigrams.py rebuilds src/bigrams.js from local English text
tools/build_userscript.js  builds dist/disenshittify-amazon.user.js (ASCII-only)
test/                  captured "baguette tray" results page + hand ratings
```

## Tests

```
node test/score.test.js            # scoring vs. hand ratings
node test/score.test.js --verbose  # every listing with its reasons
node test/memory.test.js           # learning across several searches
node test/live.test.js             # captured live pages: harmonica, window fans, baby strollers, shop vacs
node test/product.test.js          # product-page refinement on 16 captured live product pages
node test/pricecheck.test.js       # identical-item matching on real Amazon, Google and UPCitemdb titles
node test/memory-footprint.js      # the script's own memory use, and a leak check
node test/ui.test.js               # full userscript in headless Chromium (needs Playwright)
```

Against the 51 hand-rated listings from the baguette tray page: 73% land on the exact tier and 100% within one tier.
