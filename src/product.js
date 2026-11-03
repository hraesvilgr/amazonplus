// AmazonPlus — product pages.
// extractProduct(document) reads what a product page offers beyond the search results card;
// refineScore(initial, product, cfg, bigrams) turns the search-results estimate into a better one
// and says exactly what changed. extractProduct needs a DOM; refineScore is pure (runs in Node tests).

(function (root) {
  "use strict";

  const T = el => el ? (el.textContent || "").replace(/[\s‎‏]+/g, " ").trim() : "";

  // ---------- reading the page ----------

  function detailRows(doc) {
    const rows = {};
    // Table layouts: <tr><th>Brand Name</th><td>Pavsrmy</td></tr>
    for (const tr of doc.querySelectorAll("tr")) {
      const th = tr.querySelector("th"), td = tr.querySelector("td");
      if (th && td) rows[T(th).toLowerCase()] = T(td);
    }
    // Bullet layouts: <li><span class="a-text-bold">Date First Available :</span> <span>March 3, 2014</span></li>
    for (const li of doc.querySelectorAll("#detailBullets_feature_div li, #detailBulletsWrapper_feature_div li")) {
      const m = /^([^:]{2,60}?)\s*:\s*(.+)$/.exec(T(li));
      if (m) rows[m[1].trim().toLowerCase()] = m[2].trim();
    }
    return rows;
  }

  // Desktop: #productTitle. Mobile site: <span id="title"> inside the title section.
  function productTitle(doc) {
    return T(doc.querySelector("#productTitle")) || T(doc.querySelector("#titleSection #title, #title_feature_div #title, h1#title"));
  }

  function extractProduct(doc) {
    const q = s => doc.querySelector(s);
    const rows = detailRows(doc);
    const get = (...names) => { for (const n of names) if (rows[n]) return rows[n]; return null; };

    const asin = (get("asin") || (/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/.exec(doc.location ? doc.location.pathname : "") || [])[1] ||
      (q("#ASIN") && q("#ASIN").value) || "").trim() || null;

    const byline = q("#bylineInfo");
    const bylineText = T(byline);
    const bylineHref = byline ? byline.getAttribute("href") || "" : "";
    let brand = get("brand name", "brand");
    if (!brand) {
      const m = /^(?:Visit the (.+?) Store|Brand:\s*(.+))$/i.exec(bylineText);
      if (m) brand = (m[1] || m[2]).trim();
    }

    const histogram = {};
    for (const el of doc.querySelectorAll('[aria-label*="percent of reviews have"]')) {
      const m = /(\d+)\s*percent of reviews have\s*(\d)\s*star/i.exec(el.getAttribute("aria-label"));
      if (m && histogram[m[2]] === undefined) histogram[m[2]] = +m[1];
    }

    // Desktop: #acrPopover title "4.4 out of 5 stars" + #acrCustomerReviewText "(2,764)".
    // Mobile site: one link, "#acrCustomerReviewLink", reading "4.4 4.4 out of 5 stars (2,764)".
    const mobileAcr = T(q("#acrCustomerReviewLink"));
    const ratingM = /([\d.]+) out of 5/.exec((q("#acrPopover") && q("#acrPopover").getAttribute("title")) || T(q("#acrPopover")) || mobileAcr);
    const countM = /([\d,]+)/.exec(T(q("#acrCustomerReviewText"))) || /\(([\d,]+)\)/.exec(mobileAcr);

    // Seller: "Ships from Amazon / Sold by Pavsrmy" boxes, or the older "Sold by X and Fulfilled by Amazon" line.
    // (The mobile site uses "mobile-…" names, and puts the value in an offer-display-attribute-name element.)
    const feature = name => T(q(`[offer-display-feature-name="desktop-${name}"] .offer-display-feature-text-message, ` +
      `[offer-display-attribute-name="desktop-${name}"] .offer-display-feature-text-message, ` +
      `[offer-display-attribute-name="mobile-${name}"] .offer-display-feature-text-message, ` +
      `[offer-display-feature-name="mobile-${name}"] .offer-display-feature-text-message`));
    let soldBy = feature("merchant-info") || T(q("#sellerProfileTriggerId"));
    let shipsFrom = feature("fulfiller-info");
    const merchantLine = T(q("#merchant-info, #merchantInfo"));
    if (!soldBy) { const m = /Sold by (.+?)(?: and | \.|$)/i.exec(merchantLine); if (m) soldBy = m[1]; }
    if (!shipsFrom && /Fulfilled by Amazon|Ships from (and sold by )?Amazon/i.test(merchantLine)) shipsFrom = "Amazon";

    const bullets = [...doc.querySelectorAll("#feature-bullets li")].map(T).filter(Boolean);

    return {
      asin,
      title: productTitle(doc),
      brand: brand || null,
      bylineText,
      brandStore: /\/stores\//.test(bylineHref),
      manufacturer: get("manufacturer"),
      dateFirstAvailable: get("date first available"),
      rating: ratingM ? +ratingM[1] : null,
      reviewCount: countM ? +countM[1].replace(/,/g, "") : null,
      histogram: Object.keys(histogram).length === 5 ? histogram : null,
      soldBy: soldBy || null,
      shipsFrom: shipsFrom || null,
      bullets,
      bulletChars: bullets.join(" \n ").length,
      frequentlyReturned: /Frequently returned item/i.test(T(q("#centerCol, #ppd")) || "")
    };
  }

  // ---------- refining the score ----------

  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function parseDate(s) {
    const m = /([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s || "");
    if (m && MONTHS[m[1].toLowerCase()] !== undefined) return new Date(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
    const d = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/.exec(s || "");
    if (d && MONTHS[d[2].toLowerCase()] !== undefined) return new Date(+d[3], MONTHS[d[2].toLowerCase()], +d[1]);
    return null;
  }

  const CS_PUSH = /(contact us|customer service|100% satisfaction|satisfaction guarantee|risk[- ]free|worry[- ]free|money[- ]back|no questions asked|after-sales|after sales)/i;

  // initial: { score, tier, reasons: [{pts, text, tag}] } from the search results page (or null).
  // product: from extractProduct. Returns { score, tier, reasons, changes: [{pts, text}], initial }.
  function refineScore(initial, product, cfg, bigrams, scorer, now) {
    const W = cfg.weights;
    const PW = cfg.productWeights;
    now = now || Date.now();

    // Start from the search-results reasons. Without them (page opened directly), score the product
    // page's own title/rating as a one-listing page.
    let base = initial && initial.reasons ? initial.reasons.map(r => Object.assign({}, r)) : null;
    let baseScore = initial && initial.reasons ? initial.score : null;
    if (!base) {
      const one = scorer.scorePage([{
        asin: product.asin, title: product.title, brandLine: product.brand || "",
        rating: product.rating != null ? product.rating + " out of 5 stars" : "",
        reviewCount: product.reviewCount != null ? product.reviewCount : undefined,
        reviewExact: product.reviewCount != null ? true : undefined
      }], cfg, bigrams);
      base = one.get(0).reasons.map(r => Object.assign({}, r));
      baseScore = one.get(0).score;
    }

    const changes = [];
    const replace = (tag, newReasons, why) => {
      const old = base.filter(r => r.tag === tag);
      const oldPts = old.reduce((s, r) => s + r.pts, 0);
      const newPts = newReasons.reduce((s, r) => s + r.pts, 0);
      base = base.filter(r => r.tag !== tag).concat(newReasons.map(r => Object.assign({ tag }, r)));
      // Confirmations count too: "Brand confirmed as Hohner" with 0 points still tells you the estimate held.
      changes.push({ pts: newPts - oldPts, text: why(old, newReasons) });
    };
    const addProduct = (pts, text) => {
      if (!pts) return;
      base.push({ pts, text, tag: "product" });
      changes.push({ pts, text });
    };

    // 1. The real brand, stated by Amazon, instead of a guess from the title.
    if (product.brand) {
      const b = scorer.detectBrand({ title: product.title || product.brand, brandLine: product.brand },
        { midTitleVocab: new Map(), docFreq: new Map() }, cfg, bigrams);
      const B = W;
      const text =
        b.kind === "user-trusted" ? "You trust " + b.name :
        b.kind === "user-blocked" ? "You blocked " + b.name :
        b.kind === "known" ? "Established brand: " + b.name :
        b.kind === "blocked" ? "Brand on the junk-name list: " + b.name :
        b.kind === "learned-trusted" ? "Learned: " + b.name + " has looked solid across your searches" :
        b.kind === "learned-blocked" ? "Learned: " + b.name + " keeps rating as junk across your searches" :
        b.kind === "gibberish" ? "Brand looks like a random string: " + b.name :
        "Unrecognized brand: " + b.name;
      const pts =
        b.kind === "user-trusted" ? B.userTrusted : b.kind === "user-blocked" ? B.userBlocked :
        b.kind === "known" ? B.knownBrand : b.kind === "blocked" ? B.blockedBrand :
        b.kind === "learned-trusted" ? B.learnedTrusted : b.kind === "learned-blocked" ? B.learnedBlocked :
        b.kind === "gibberish" ? B.gibberishBrand : B.unrecognizedBrand;
      replace("brand", [{ pts, text }], (old) => {
        const guess = old.length ? old[0].text : "";
        const same = guess && guess.toLowerCase().includes(product.brand.toLowerCase());
        return `Brand confirmed as ${product.brand}` + (guess && !same ? ` (search results guessed: ${guess.replace(/^[^:]*:\s*/, "")})` : "");
      });
    }

    // 2. Exact listing date, when Amazon shows it, instead of the estimate from the product ID.
    const first = parseDate(product.dateFirstAvailable);
    if (first) {
      const years = (now - first.getTime()) / (365.25 * 864e5);
      const pts = years >= 10 ? W.asinVintage : years >= 5 ? W.asinOld : years >= 2 ? W.asinRecent :
                  years < 0.25 ? PW.veryNew : years < 1 ? W.asinNew : 0;
      const label = years >= 1 ? `${Math.floor(years)} year${Math.floor(years) === 1 ? "" : "s"}` : `${Math.max(1, Math.round(years * 12))} month${Math.round(years * 12) === 1 ? "" : "s"}`;
      replace("age", pts ? [{ pts, text: `On Amazon since ${product.dateFirstAvailable} (${label})` }] : [],
        () => `Listing date confirmed: ${product.dateFirstAvailable}`);
    }

    // 3. Exact review count (search results round to "1.5K").
    if (product.reviewCount != null && product.rating != null) {
      const rc = product.reviewCount;
      const r = [];
      if (rc === 0) r.push({ pts: W.noReviews, text: "No reviews" });
      else if (rc < 10) r.push({ pts: W.under10Reviews, text: `Only ${rc} review${rc === 1 ? "" : "s"}` });
      else if (rc < 50) r.push({ pts: W.under50Reviews, text: `Few reviews (${rc})` });
      else if (rc >= 3000) r.push({ pts: W.over3000Reviews, text: `Many reviews (${rc.toLocaleString("en-US")})` });
      else if (rc >= 1000) r.push({ pts: W.over1000Reviews, text: `Many reviews (${rc.toLocaleString("en-US")})` });
      else if (rc >= 200) r.push({ pts: W.over200Reviews, text: `Solid review count (${rc})` });
      if (product.rating >= 4.9 && rc > 0 && rc < 30) r.push({ pts: W.tooPerfect, text: `Near-perfect ${product.rating}★ on very few reviews` });
      if (product.rating < 4.0 && rc >= 20) r.push({ pts: W.lowRating, text: `Low rating (${product.rating}★)` });
      replace("reviews", r, () => `Exact review count: ${rc.toLocaleString("en-US")}`);
    }

    // 4. How the stars are spread. Only the extremes count: on real pages a 6–9% share of 1★ is normal
    //    for appliances (Bionaire, Amazon Basics), and junk and real brands both sit around 10–13% 4★.
    const h = product.histogram;
    if (h && (product.reviewCount || 0) >= 30) {
      if (h[1] >= 15) addProduct(PW.manyOneStar, `${h[1]}% of reviews are 1-star`);
      if (h[5] >= 85 && h[4] < 6) addProduct(PW.thinMiddle, `Ratings pile up at 5★ (${h[5]}%) with only ${h[4]}% 4★ — typical of padded reviews`);
    }

    // 5. Who sells it.
    const seller = (product.soldBy || "").trim();
    if (/^amazon(\.com)?$/i.test(seller)) addProduct(PW.soldByAmazon, "Sold by Amazon.com");
    else if (seller && isAnonymousSeller(seller)) addProduct(PW.anonymousSeller, `Sold by an anonymous trading account ("${seller}")`);

    // 6. Bullet points. On real pages, junk listings ran 1,400–2,000 characters with 4–7 marketing
    //    phrases; established brands ran 200–1,200 with at most 2.
    const bullets = product.bullets || [];
    if (bullets.length) {
      const all = bullets.join(" \n ");
      const chars = product.bulletChars || all.length;
      const brackets = (all.match(/[【\[「〔]/g) || []).length;
      if (brackets >= 2) addProduct(PW.bulletBrackets, `Bullet points use 【bracketed】 headings (${brackets})`);
      const florid = new Set();
      for (const p of cfg.floridPhrases) { const hit = all.match(new RegExp(p, "gi")); if (hit) hit.forEach(x => florid.add(x.toLowerCase())); }
      if (florid.size >= 3) addProduct(PW.bulletFlorid, `Marketing language in bullet points: ${[...florid].slice(0, 4).map(x => `"${x}"`).join(", ")}`);
      const push = CS_PUSH.exec(all);
      if (push) addProduct(PW.bulletServicePush, `Bullet points push customer-service promises ("${push[0]}")`);
      const broken = (all.match(/\b[a-z]{3,}-[a-z]{1,2}\b/gi) || []).filter(w => !/^(non|pre|re|co|anti|multi|semi|over|under|self)-/i.test(w) && !/-(in|on|up|of|to|by)$/i.test(w));
      if (broken.length >= 2) addProduct(PW.bulletObfuscated, `Deliberately broken words in bullet points: ${[...new Set(broken)].slice(0, 3).map(x => `"${x}"`).join(", ")}`);
      if (chars > 1800) addProduct(PW.bulletWall, `Very long bullet points (${chars.toLocaleString("en-US")} characters)`);
      else if (chars > 1300) addProduct(PW.bulletLong, `Long bullet points (${chars.toLocaleString("en-US")} characters)`);
      else if (chars < 600 && bullets.length >= 2) addProduct(PW.bulletConcise, "Short, factual bullet points");
    }

    // 7. Amazon's own warning.
    if (product.frequentlyReturned) addProduct(PW.frequentlyReturned, "Amazon marks this a frequently returned item");

    const raw = W.base + base.reduce((s, r) => s + r.pts, 0);
    const score = Math.max(0, Math.min(100, Math.round(raw)));
    const t = cfg.tiers;
    const tier = score >= t[0] ? 5 : score >= t[1] ? 4 : score >= t[2] ? 3 : score >= t[3] ? 2 : 1;
    base.sort((a, b) => a.pts - b.pts);
    return { score, tier, reasons: base, changes, initial: initial || null, baseScore, at: now };
  }

  // Seller names that are a run-together romanised company registration ("junshengshangmaodian",
  // "luoyanggezhibushangmaoyouxiangongsi") rather than a shop name.
  function isAnonymousSeller(name) {
    const n = name.toLowerCase();
    if (/(shangmao|maoyi|youxian|gongsi|keji|dianzi|jingying|zhuanmai|shangmaodian|baihuo|wujin)/.test(n)) return true;
    return /^[a-z]{16,}$/.test(n);
  }

  function isProductPage(loc) {
    return /\/(dp|gp\/product)\/[A-Z0-9]{10}/.test(loc.pathname);
  }

  // ---------- books, films, TV, music and games: not rated ----------
  // Trust signals are for physical goods; media is left alone. Game controllers, consoles and other
  // accessories are still rated.
  const MEDIA_DP = /\b(book|ebooks|audible|dvd|music|digital_music\w*|digital_video_games|digital_video|kindle\w*|magazines?)\b/;
  const MEDIA_ROOT = /^(Books|Kindle Store|Audible Books & Originals|Movies & TV|Prime Video|CDs & Vinyl|Digital Music|Magazine Subscriptions)$/;
  function isMediaPage(doc) {
    const dp = doc.getElementById("dp");
    const cls = dp ? dp.className || "" : "";
    const crumbs = [...doc.querySelectorAll("#wayfinding-breadcrumbs_feature_div a, #wayfinding-breadcrumbs_container a")].map(T);
    if (MEDIA_DP.test(cls) || (crumbs[0] && MEDIA_ROOT.test(crumbs[0]))) return true;
    // Video games: the games themselves, not controllers, consoles or accessories.
    if (/\bvideo_games\b/.test(cls) || crumbs[0] === "Video Games") return crumbs.includes("Games") && !crumbs.some(c => /^(Accessories|Consoles)$/.test(c));
    return false;
  }
  const MEDIA_FORMATS = /^(Paperback|Hardcover|Mass Market Paperback|Kindle|Kindle Edition|Audiobook|Audible Audiobook|Audio CD|MP3 CD|Board book|Spiral-bound|Library Binding|Comics|Vinyl|Audio Cassette|DVD|Blu-ray|4K|4K Ultra HD|Prime Video|MP3 Music|Streaming Music|Magazine)$/i;
  function isMediaCard(card) {
    const asin = card.getAttribute("data-asin") || "";
    if (/^\d{9}[\dX]$/.test(asin)) return true;                                    // an ISBN: a book
    for (const a of card.querySelectorAll("a.a-text-bold, span.a-text-bold")) if (MEDIA_FORMATS.test(T(a))) return true;
    const t = T(card);
    // (textContent runs words together — "Nov 9, 2022ESRB Rating" — so no \b before these.)
    if (/Starring:/.test(t)) return true;                                          // films and TV
    // Games carry an age rating, but so do controllers and consoles on Amazon: those stay rated.
    const title = [...card.querySelectorAll("h2")].map(T).join(" ") || t.slice(0, 200);
    if (GAME_HARDWARE.test(title)) return false;
    if (/ESRB Rating:|PEGI \d/.test(t)) return true;
    for (const a of card.querySelectorAll("a.a-text-bold, span.a-text-bold")) if (PLATFORM.test(T(a))) return true;
    // "Elden Ring - PlayStation 5", "Mario Kart World (Nintendo Switch 2)" — but not "… for PS5".
    return GAME_TITLE.test(title) && !/\bfor (the )?(PlayStation|PS[45]|Xbox|Nintendo|Switch|Steam Deck)/i.test(title);
  }
  const PLATFORM = /^(PlayStation ?[2-5]|PS[2-5]|PS Vita|Xbox( Series [XS]| One| 360)?|Nintendo Switch( 2)?|Nintendo 3DS|Wii U?|PC|Mac|Steam Deck|PC Download|Online Game Code)$/i;
  const GAME_TITLE = /[-–(]\s*(PlayStation ?[45]|PS[45]|Xbox (Series [XS]|One)|Nintendo Switch( 2)?|Steam Deck|PC)\b/i;
  const GAME_HARDWARE = /\b(controllers?|gamepads?|game ?pads?|(joy|thumb|arcade|fight|fighting|flight|control) ?sticks?|joypads?|leverless|hitbox|hotas|throttle|steering|console|system|bundle|headsets?|headphones?|earbuds|speakers?|charg\w*|case|cables?|adapters?|receiver|dongle|stand|docks?|docking|grips?|skins?|triggers?|memory card|sd card|capture card|micro ?sd|ssd|hard drive|storage|mount|keyboard|mouse|mice|wheel|pedals?|joy-?cons?|amiibo|figure|remote|batter(y|ies)|cover|protector|accessor(y|ies)|camera|webcam|microphone|vr|fan|cooling|gift card|subscription|membership|renewed|\d+ ?(TB|GB))\b/i;

  const api = { extractProduct, productTitle, refineScore, parseDate, isProductPage, isAnonymousSeller, isMediaPage, isMediaCard };
  if (typeof module !== "undefined") module.exports = api;
  else root.DSA_PRODUCT = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
