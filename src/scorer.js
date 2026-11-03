// AmazonPlus — trust scorer.
// Pure functions: no DOM access, so the same code runs in the extension and in Node tests.
//
// scorePage(listings, config, bigrams) takes the listings on one results page and returns
// a Map of listing index → { score (0–100), tier (1–5), brand, reasons: [{ pts, text }] }.
// Several signals are page-relative (shared review pools, reused photos, phrases copied
// from established brands, price outliers), so every listing on the page is scored together.

(function (root) {
  "use strict";

  const STOPWORDS = new Set(("a an and or the of for to with in on by from at as is are " +
    "your you our it its this that be can into up").split(" "));
  const MATERIALS = ["stainless steel", "carbon steel", "alloy steel", "cast iron", "aluminum",
    "aluminium", "silicone", "ceramic", "glass", "stoneware", "copper", "titanium", "bamboo",
    "plastic", "wood", "porcelain", "enamel"];
  const TOOL_NOUNS = /^(scraper|scrapers|blade|blades|cutter|cutters|lame|knife|knives|whisk|spatula|handle|handles|rack|lid|lids|utensils?)$/i;

  // ---------- small helpers ----------

  function norm(s) {
    return (s || "")
      .replace(/[‐-―−]/g, "-")
      .replace(/non-?stick/gi, "nonstick")
      .toLowerCase();
  }

  function words(s) {
    return norm(s).replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  }

  function contentWords(s) {
    return words(s).filter(w => !STOPWORDS.has(w) && !/^\d/.test(w));
  }

  function median(arr) {
    if (!arr.length) return null;
    const a = arr.slice().sort((x, y) => x - y);
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  // tag: "brand" for brand points (left out of learning evidence), "flag" for serious red flags.
  function add(reasons, pts, text, tag) {
    if (pts) reasons.push(tag ? { pts, text, tag } : { pts, text });
  }

  // Average log-probability of the letter pairs in a word, using the English model.
  function letterScore(word, bigrams) {
    const s = "^" + word.toLowerCase().replace(/[^a-z]/g, "") + "$";
    if (s.length < 4) return 0;
    const cols = "abcdefghijklmnopqrstuvwxyz$";
    let sum = 0, n = 0;
    for (let i = 0; i < s.length - 1; i++) {
      const row = bigrams[s[i]];
      const j = cols.indexOf(s[i + 1]);
      if (!row || j < 0) continue;
      sum += row[j]; n++;
    }
    return n ? sum / n : 0;
  }

  // ---------- raw card data → normalized listing ----------
  // Accepts the strings scraped from a result card. Used by both content.js and the tests.
  function normalizeListing(raw) {
    let title = (raw.title || "").replace(/\s+/g, " ").trim();
    let sponsored = !!raw.sponsored;
    if (/^sponsored\b/i.test(title)) { sponsored = true; title = title.replace(/^sponsored(\s+ad)?\s*[-\u2013\u2014:]?\s*/i, ""); }

    const rm = /([\d.]+) out of 5/.exec(raw.rating || raw.reviews || "");
    const rating = rm ? parseFloat(rm[1]) : null;

    let reviewCount = null, reviewExact = false;
    if (typeof raw.reviewCount === "number") {
      reviewCount = raw.reviewCount; reviewExact = raw.reviewExact !== false;
    } else {
      const cm = /\(([\d.,]+)\s*([KM])?\)/i.exec(raw.reviews || "");
      if (cm) {
        const n = parseFloat(cm[1].replace(/,/g, ""));
        const mult = cm[2] ? (cm[2].toUpperCase() === "K" ? 1e3 : 1e6) : 1;
        reviewCount = Math.round(n * mult);
        reviewExact = !cm[2];
      } else if (rating == null) {
        reviewCount = 0; reviewExact = true;
      }
    }

    const pm = /[\d,]+(?:\.\d+)?/.exec((raw.price || "").replace(/^[^\d]*/, ""));
    const price = pm ? parseFloat(pm[0].replace(/,/g, "")) : null;

    const im = /\/images\/I\/([^._/]+)/.exec(raw.img || "");
    const imageId = im ? im[1] : null;

    return {
      _normalized: true,
      asin: raw.asin || null,
      title,
      brandLine: (raw.brandLine || "").trim() || null,
      sponsored,
      rating,
      reviewCount,
      reviewExact,
      newListing: /new on amazon/i.test(raw.reviews || "") || !!raw.newListing,
      price,
      imageId,
      unitPrice: raw.unitPrice || null
    };
  }

  // ---------- brand detection ----------

  function matchKnown(title, list) {
    const t = norm(title);
    for (const b of list) {
      const nb = norm(b);
      if (t === nb || t.startsWith(nb + " ") || t.startsWith(nb + ",")) return b;
    }
    return null;
  }

  // Lower-case key used for remembered / voted brands.
  function brandKey(name) {
    return name ? norm(name).replace(/[^a-z0-9&'+ -]/g, "").trim() : null;
  }

  // Accessory titles that lead with someone else's brand: "Kindle Case Compatible with Kindle…".
  // Only counts when the compatibility phrase points back at the title's own first word, so
  // "Anker Charger … Compatible with iPhone" still belongs to Anker.
  function isAccessoryTitle(title) {
    const lead = (title.match(/^[^\s,(]+/) || [""])[0].replace(/[^A-Za-z0-9]/g, "");
    if (lead.length < 2) return false;
    const re = new RegExp("\\b(?:compatible(?: with)?|replacement(?: for)?|fits?|for use with|works with|for)\\s+(?:[\\w-]+\\s+){0,2}?" + lead + "\\b", "i");
    return re.test(title.slice(lead.length));
  }

  // Returns { kind, name, key }. kind is one of:
  //   user-trusted | user-blocked | known | blocked | learned-trusted | learned-blocked |
  //   gibberish | unrecognized | none
  function detectBrand(listing, ctx, cfg, bigrams) {
    const b = detectBaseBrand(listing, ctx, cfg, bigrams);
    if (!b.name) return b;
    b.key = brandKey(b.name);
    const vote = cfg.userBrands && cfg.userBrands[b.key];
    if (vote === "trust" || vote === "block") return Object.assign(b, { base: b.kind, kind: "user-" + (vote === "trust" ? "trusted" : "blocked") });
    if (b.kind === "known" || b.kind === "blocked") return b;
    const learned = cfg.learnedBrands && cfg.learnedBrands[b.key];
    if (learned === "trust" || learned === "block") return Object.assign(b, { base: b.kind, kind: "learned-" + (learned === "trust" ? "trusted" : "blocked") });
    return b;
  }

  function detectBaseBrand(listing, ctx, cfg, bigrams) {
    const source = listing.brandLine || listing.title;
    if (!listing.brandLine && isAccessoryTitle(listing.title)) {
      return { kind: "none", name: null, accessory: true };
    }

    const known = matchKnown(source, cfg.knownBrands || []);
    if (known) return { kind: "known", name: known };
    const amb = matchKnown(source, cfg.ambiguousBrands || []);
    if (amb && (ctx.midTitleVocab.get(brandKey(amb).replace(/[^a-z]/g, "")) || 0) < 2) {
      return { kind: "known", name: amb };
    }
    const blocked = matchKnown(source, cfg.blockedBrands || []);
    if (blocked) return { kind: "blocked", name: blocked };

    let first;
    if (listing.brandLine) {
      first = listing.brandLine.split(/\s+/)[0];
    } else {
      first = (listing.title.match(/^[^\s,(]+/) || [""])[0];
      // Numbers / pack counts first ("3 Pcs", "2-Pack") mean no brand is named.
      if (!first || /^\d/.test(first)) return { kind: "none", name: null };
      // Amazon's own labels are never brands.
      if (/^(sponsored|new|best|top|limited|deal|overall|amazon's)$/i.test(first)) return { kind: "none", name: null };
      // A word that other titles on this page use mid-title is ordinary vocabulary, not a brand —
      // unless a capitalised word nobody else uses follows it ("Air King", "Comfort Zone").
      const key = first.toLowerCase().replace(/[^a-z]/g, "");
      if (!key) return { kind: "none", name: null };
      // …but a seller writing an ordinary word in capitals at the very start is naming its brand.
      const capsBrand = /^[A-Z][A-Z0-9&+'-]{3,}$/.test(first) &&
        !/^(PACK|PCS|SET|NEW|BEST|PREMIUM|UPGRADED|HEAVY|LARGE|SMALL|MINI)$/.test(first);
      if ((ctx.midTitleVocab.get(key) || 0) >= 2 && !capsBrand) {
        const second = (listing.title.split(/\s+/)[1] || "").replace(/[,.:;]+$/, "");
        const k2 = second.toLowerCase().replace(/[^a-z]/g, "");
        if (/^[A-Z][A-Za-z]+$/.test(second) && k2.length >= 3 && !ctx.midTitleVocab.get(k2) && !ctx.docFreq.get(k2 + "s")) {
          first = first + " " + second;
        } else {
          return { kind: "none", name: null };
        }
      }
    }

    const letters = first.split(/\s+/)[0].replace(/[^A-Za-z]/g, "");
    if (letters.length < 2) return { kind: "none", name: null };
    const g = gibberishCheck(letters, bigrams, cfg);
    if (g) return { kind: "gibberish", name: first, why: g };
    return { kind: "unrecognized", name: first };
  }

  // Only names that can't be pronounced count as gibberish (Pavsrmy, Yupjlia, Cadpxs, ABuff).
  // Pronounceable inventions (Tiawudi, Qiaoxi) look exactly like real foreign brands (Suzuki,
  // Xiaomi, Zojirushi), so those are left to the other evidence rather than guessed at.
  function gibberishCheck(letters, bigrams, cfg) {
    if (/^[A-Z]{2,4}$/.test(letters)) return null;                 // acronyms: JBL, LG, JDR, RTIC
    if (/^[A-Z]{2}[a-z]{2,}$/.test(letters)) return "odd capitals";  // ABuff
    const lower = letters.toLowerCase();
    const run = Math.max(0, ...(lower.match(/[bcdfghjklmnpqrstvwxz]+/g) || []).map(x => x.length));
    if (run >= 4 && !/(sch|tch|ght|str|nst|rst|ngst)/.test(lower)) return "unpronounceable";
    if (run >= 3 && letterScore(lower, bigrams) < cfg.gibberishThreshold) return "unpronounceable";
    return null;
  }

  // ---------- page context ----------

  function buildContext(listings, cfg) {
    // Vocabulary that appears after the first word of titles (document frequency).
    const midTitleVocab = new Map();
    const docFreq = new Map();
    for (const l of listings) {
      const ws = words(l.title);
      const mid = new Set(ws.slice(1).map(w => w.replace(/[^a-z]/g, "")).filter(Boolean));
      for (const w of mid) midTitleVocab.set(w, (midTitleVocab.get(w) || 0) + 1);
      for (const w of new Set(contentWords(l.title))) docFreq.set(w, (docFreq.get(w) || 0) + 1);
    }

    // Distinctive 4-word phrases from established brands' titles on this page.
    const n = listings.length || 1;
    // A phrase used by two or more different established brands is just how the category is
    // described ("2.5-Gal 2 Peak HP Wet/Dry"), not anyone's signature, so it's dropped.
    const phraseBrands = new Map(); // phrase → Set of established brands using it
    for (const l of listings) {
      const kb = matchKnown(l.brandLine || l.title, cfg.knownBrands || []);
      if (!kb) continue;
      const cw = contentWords(l.title);
      for (let i = 0; i + 4 <= cw.length; i++) {
        const g = cw.slice(i, i + 4);
        const rare = g.filter(w => (docFreq.get(w) || 0) / n < 0.25).length;
        if (rare < 2) continue;
        const key = g.join(" ");
        if (!phraseBrands.has(key)) phraseBrands.set(key, new Set());
        phraseBrands.get(key).add(brandKey(kb));
      }
    }
    const brandPhrases = new Map(); // phrase → brand
    for (const [phrase, set] of phraseBrands) {
      if (set.size === 1) {
        const owner = listings.map(l => matchKnown(l.brandLine || l.title, cfg.knownBrands || [])).find(b => b && brandKey(b) === [...set][0]);
        brandPhrases.set(phrase, owner);
      }
    }

    // Review pools and photos shared between different ASINs.
    const pools = new Map(), images = new Map();
    for (const l of listings) {
      if (l.reviewExact && l.reviewCount >= 20 && l.rating != null) {
        const k = l.rating + "|" + l.reviewCount;
        if (!pools.has(k)) pools.set(k, new Set());
        pools.get(k).add(l.asin);
      }
      if (l.imageId) {
        if (!images.has(l.imageId)) images.set(l.imageId, new Set());
        images.get(l.imageId).add(l.asin);
      }
    }

    const prices = [...new Map(listings.filter(l => l.price).map(l => [l.asin, l.price])).values()];

    return { midTitleVocab, docFreq, brandPhrases, pools, images, medianPrice: median(prices), n };
  }

  // ---------- per-listing scoring ----------

  function scoreListing(l, ctx, cfg, bigrams, brandsByAsin) {
    const W = cfg.weights;
    const reasons = [];
    const t = l.title;
    const brand = detectBrand(l, ctx, cfg, bigrams);
    brandsByAsin.set(l.asin, brand);

    // Brand
    const B = "brand";
    if (brand.kind === "user-trusted") add(reasons, W.userTrusted, "You trust " + brand.name, B);
    else if (brand.kind === "user-blocked") add(reasons, W.userBlocked, "You blocked " + brand.name, B);
    else if (brand.kind === "known") add(reasons, W.knownBrand, "Established brand: " + brand.name, B);
    else if (brand.kind === "blocked") add(reasons, W.blockedBrand, "Brand on the junk-name list: " + brand.name, B);
    else if (brand.kind === "learned-trusted") add(reasons, W.learnedTrusted, "Learned: " + brand.name + " has looked solid across your searches", B);
    else if (brand.kind === "learned-blocked") add(reasons, W.learnedBlocked, "Learned: " + brand.name + " keeps rating as junk across your searches", B);
    else if (brand.kind === "gibberish") add(reasons, W.gibberishBrand, "Brand looks like a random string: " + brand.name, B);
    else if (brand.kind === "unrecognized") add(reasons, W.unrecognizedBrand, "Unrecognized brand: " + brand.name, B);
    else if (brand.accessory) add(reasons, W.noBrand, "No brand of its own (title leads with the product it fits)", B);
    else add(reasons, W.noBrand, "No brand named", B);

    // Title length
    const len = t.length;
    if (len > 200) add(reasons, W.titleOver200, `Very long title (${len} chars)`);
    else if (len > 150) add(reasons, W.titleOver150, `Long title (${len} chars)`);
    else if (len > 120) add(reasons, W.titleOver120, `Wordy title (${len} chars)`);
    else if (len < 90) add(reasons, W.conciseTitle, "Concise title");

    // Bracket spam 【】[]
    const brackets = (t.match(/[【\[「〔]/g) || []).length;
    if (brackets > 1) add(reasons, Math.max(W.bracketsCap, W.brackets * (brackets - 1)), `${brackets} bracketed callouts`);

    // Florid marketing language
    const florid = [];
    for (const p of cfg.floridPhrases) {
      const m = new RegExp(p, "i").exec(t);
      if (m) florid.push(m[0]);
    }
    if (florid.length) {
      add(reasons, Math.max(W.floridCap, W.florid * florid.length),
        "Marketing language: " + [...new Set(florid.map(f => f.toLowerCase()))].map(f => `"${f}"`).join(", "));
    }

    // ALL-CAPS shouting (ignoring the brand itself and acronyms)
    // Skip the first few words: brand names are often written in caps ("AMAGABELI GARDEN & HOME").
    const afterBrand = t.split(/\s+/).slice(4).join(" ");
    const caps = (afterBrand.match(/\b[A-Z]{4,}\b/g) || []).filter(w => !cfg.capsWhitelist.includes(w));
    if (caps.length >= 3) add(reasons, W.shouting, "ALL-CAPS phrases: " + caps.slice(0, 3).join(" "));

    // Obfuscated words like "Baguet-te" (a hyphen splitting a normal word)
    const ob = /\b([A-Za-z]{3,})-([A-Za-z]{1,2})\b/.exec(t);
    if (ob) {
      const joined = (ob[1] + ob[2]).toLowerCase();
      if ((ctx.midTitleVocab.get(joined) || 0) >= 1 || ctx.docFreq.has(joined)) {
        add(reasons, W.obfuscatedWord, `Deliberately broken word: "${ob[0]}"`, "flag");
      }
    }

    // Odd characters (non-breaking hyphens, zero-width, full-width punctuation)
    if (/[‑​-‍﻿！-～]/.test(t)) add(reasons, W.oddCharacters, "Unusual characters in title");

    // Sentences instead of a title
    const deAbbr = t.replace(/\b(Jr|Sr|Dr|Mr|Mrs|Ms|St|No|Vol|vs|oz|fl|ft|in|lb|lbs|Inc|Co|Ltd|approx|Pk|Qt|Gal)\./gi, "$1");
    if (/;/.test(deAbbr) || /[a-z]\.\s+[A-Z]/.test(deAbbr) || /[a-z°]\.$/.test(deAbbr)) {
      add(reasons, W.sentenceTitle, "Title written as sentences");
    }

    // Keyword stuffing: lots of "for X" uses or comma-separated fragments
    const fors = (t.match(/\bfor\b/gi) || []).length;
    const commas = (t.replace(/\([^)]*\)/g, "").match(/,/g) || []).length;
    if (fors >= 3 || commas >= 6) add(reasons, W.keywordStuffing, "Keyword stuffing");

    // Concrete specs
    let specs = 0;
    if (/\d+(?:\.\d+)?\s*(?:["”″]|in(?:ch(?:es)?)?\b|cm\b|mm\b)?\s*[x×]\s*\d/i.test(t) ||
        /\d+(?:\.\d+)?\s*[LWH]\s*x\s*\d/i.test(t)) specs++;
    if (/\d+(?:\.\d+)?\s*mm\s+thick|\bgauge\b|\d+\s*ga\b/i.test(t)) specs++;
    if (/\d+\s*°\s*[FC]\b/.test(t)) specs++;
    if (/\b[A-Z]{1,3}\d{3,}\b/.test(t)) specs++;
    if (specs) add(reasons, Math.min(W.specsCap, W.specs * specs), "Gives concrete specs");

    // Self-contradicting material (Amazon appends the listed material at the end of the title)
    const nt = norm(t);
    const trailing = MATERIALS.find(m => nt.endsWith(" " + m));
    if (trailing) {
      const body = nt.slice(0, nt.length - trailing.length);
      for (const m of MATERIALS) {
        if (m === trailing || trailing.includes(m) || m.includes(trailing)) continue;
        const idx = body.indexOf(m);
        if (idx < 0) continue;
        const after = body.slice(idx + m.length).trim().split(/\s+/).slice(0, 2);
        if (after.some(w => TOOL_NOUNS.test(w.replace(/[^a-z]/g, "")))) continue; // "stainless steel scraper"
        if (!/steel|aluminum|aluminium|cast iron/.test(m + trailing)) continue;   // only flag metal mix-ups
        add(reasons, W.materialConflict, `Says both "${m}" and "${trailing}"`);
        break;
      }
    }

    // Phrase lifted from an established brand's title on this page
    // (A brand you voted on keeps its original identity here, so it can't "copy" itself.)
    if ((brand.base || brand.kind) !== "known") {
      const cw = contentWords(t);
      for (let i = 0; i + 4 <= cw.length; i++) {
        const g = cw.slice(i, i + 4).join(" ");
        if (ctx.brandPhrases.has(g) && brandKey(ctx.brandPhrases.get(g)) !== brand.key) {
          add(reasons, W.copiedPhrase, `Copies phrasing from ${ctx.brandPhrases.get(g)}'s listing`, "flag");
          break;
        }
      }
    }

    // Reviews and rating
    const rc = l.reviewCount;
    if (rc === 0 || rc == null && l.rating == null) add(reasons, W.noReviews, "No reviews", "reviews");
    else if (rc != null) {
      if (rc < 10) add(reasons, W.under10Reviews, `Only ${rc} review${rc === 1 ? "" : "s"}`, "reviews");
      else if (rc < 50) add(reasons, W.under50Reviews, `Few reviews (${rc})`, "reviews");
      else if (rc >= 3000) add(reasons, W.over3000Reviews, `Many reviews (${fmt(rc)})`, "reviews");
      else if (rc >= 1000) add(reasons, W.over1000Reviews, `Many reviews (${fmt(rc)})`, "reviews");
      else if (rc >= 200) add(reasons, W.over200Reviews, `Solid review count (${rc})`, "reviews");
      if (l.rating != null && l.rating >= 4.9 && rc > 0 && rc < 30) {
        add(reasons, W.tooPerfect, `Near-perfect ${l.rating}★ on very few reviews`, "reviews");
      }
      if (l.rating != null && l.rating < 4.0 && rc >= 20) add(reasons, W.lowRating, `Low rating (${l.rating}★)`, "reviews");
    }
    if (l.newListing) add(reasons, W.newListing, "New on Amazon this month");

    // Listing age. Amazon hands out product IDs (ASINs) in sequence, so the ID dates the listing.
    // Throwaway sellers churn new listings; long-running products keep their old ones.
    const era = asinEra(l.asin);
    if (era === "vintage") add(reasons, W.asinVintage, "Listed on Amazon for 10+ years", "age");
    else if (era === "old") add(reasons, W.asinOld, "Listed on Amazon since ~2015–2018", "age");
    else if (era === "recent") add(reasons, W.asinRecent, "Listed on Amazon since ~2018–2020", "age");
    else if (era === "new") add(reasons, W.asinNew, "Listing created in the last year or so", "age");

    // Price far below the page median
    if (l.price && ctx.medianPrice && l.price < 0.45 * ctx.medianPrice) {
      add(reasons, W.cheapOutlier, `Priced far below similar listings ($${l.price} vs ~$${ctx.medianPrice.toFixed(0)})`);
    }

    return reasons;
  }

  // Rough age of a listing from its ASIN (B00… oldest, B0H… newest). Books (ISBNs) return null.
  function asinEra(asin) {
    if (!asin || !/^B0[0-9A-Z]{8}$/.test(asin)) return null;
    const c = asin[2];
    if (c === "0") return "vintage";                 // B00…: before ~2015
    if (c >= "1" && c <= "6") return "old";          // B01…–B06…: ~2015–2018
    if (c === "7" || c === "8") return "recent";     // B07…, B08…: ~2018–2020
    if (c >= "F") return "new";                      // B0F…, B0G…, B0H…: 2025 onward
    return "mid";                                    // B09…, B0B…–B0D…: 2021–2024
  }

  // Amazon's unit price, e.g. "($0.13/count)", "($2.99/ounce)", "($1.01/feet)", "($0.16/fluid ounce)".
  // Returns { value, unit, label } with compatible units converted (pounds/grams → per ounce,
  // litres/millilitres → per fl oz, inches → per foot…), or null when there isn't one.
  const UNIT_TABLE = [
    [/^(count|ct|each|ea|piece|pieces|pc|pcs|item|items|unit|units|tablet|tablets|capsule|capsules|softgel|softgels|gummy|gummies|serving|servings|pack|packs)$/, "count", 1],
    [/^(fl\.?\s*oz|fluid\s*ounces?|fl\s*ounces?)$/, "fl oz", 1],
    [/^(ml|milliliters?|millilitres?)$/, "fl oz", 29.5735],
    [/^(l|liters?|litres?)$/, "fl oz", 0.0295735],
    [/^(gal|gallons?)$/, "fl oz", 1 / 128],
    [/^(oz|ounces?)$/, "oz", 1],
    [/^(lb|lbs|pounds?)$/, "oz", 1 / 16],
    [/^(g|grams?)$/, "oz", 28.3495],
    [/^(kg|kilograms?)$/, "oz", 0.0283495],
    [/^(mg|milligrams?)$/, "oz", 28349.5],
    [/^(ft|foot|feet)$/, "foot", 1],
    [/^(in|inch|inches)$/, "foot", 12],
    [/^(yd|yards?)$/, "foot", 1 / 3],
    [/^(m|meters?|metres?)$/, "foot", 0.3048],
    [/^(sq\.?\s*ft|square\s*feet|square\s*foot)$/, "sq ft", 1],
    [/^(load|loads)$/, "load", 1],
    [/^(sheet|sheets)$/, "sheet", 1],
    [/^(roll|rolls)$/, "roll", 1],
    [/^(set|sets)$/, "set", 1],
    [/^(pair|pairs)$/, "pair", 1],
    [/^(dozen|doz)$/, "count", 1 / 12],
    [/^(box|boxes)$/, "box", 1],
    [/^(bottle|bottles)$/, "bottle", 1],
    [/^(bag|bags)$/, "bag", 1]
  ];
  function parseUnitPrice(text) {
    const m = /\(\s*\$\s*([\d,]+(?:\.\d+)?)\s*\/\s*(?:(\d+(?:\.\d+)?)\s*)?([A-Za-z][A-Za-z. ]{0,20}?)\s*\)/.exec(text || "");
    if (!m) return null;
    const qty = m[2] ? parseFloat(m[2]) || 1 : 1;                  // "$12.00/100 gram"
    const price = parseFloat(m[1].replace(/,/g, "")) / qty;
    const raw = m[3].toLowerCase().replace(/\s+/g, " ").trim();
    if (/^(month|mo|year|yr|week|wk|day)s?$/.test(raw)) return null;   // subscription / instalment prices
    m[1] = m[1] + "/" + (m[2] ? m[2] + " " : "");
    for (const [re, unit, perBase] of UNIT_TABLE) {
      // perBase = how many of the listed unit make one base unit (1 oz = 28.35 g, = 1/16 lb).
      if (re.test(raw)) return { value: price * perBase, unit, label: "$" + m[1] + raw };
    }
    return { value: price, unit: raw, label: "$" + m[1] + raw };
  }

  function fmt(n) {
    return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K" : String(n);
  }

  // ---------- page-level ----------

  function scorePage(rawListings, cfg, bigrams) {
    // Always normalize scraped cards (strip "Sponsored", parse rating/price/photo), unless already done.
    const listings = rawListings.map(r => (r && r._normalized) ? r : normalizeListing(r));
    const ctx = buildContext(listings, cfg);
    const brandsByAsin = new Map();
    const reasonsByIndex = listings.map(l => scoreListing(l, ctx, cfg, bigrams, brandsByAsin));

    // Cross-listing signals need every brand resolved first.
    listings.forEach((l, i) => {
      const reasons = reasonsByIndex[i];
      const brand = brandsByAsin.get(l.asin) || { kind: "none" };

      // Same exact rating + review count on different ASINs that aren't one brand's variants
      if (l.reviewExact && l.reviewCount >= 20 && l.rating != null) {
        const group = ctx.pools.get(l.rating + "|" + l.reviewCount);
        if (group && group.size > 1) {
          const others = [...group].filter(a => a !== l.asin);
          const sameBrand = brand.name && brand.kind !== "none" &&
            others.every(a => { const b = brandsByAsin.get(a); return b && b.name === brand.name; });
          if (!sameBrand) {
            add(reasons, cfg.weights.sharedReviewPool,
              `Review count (${l.reviewCount}) pooled with ${others.length} other listing${others.length > 1 ? "s" : ""} on this page`, "flag");
          }
        }
      }

      // Main photo reused by different ASINs
      if (l.imageId) {
        const group = ctx.images.get(l.imageId);
        const others = group ? [...group].filter(a => a !== l.asin) : [];
        const sameBrand = brand.name && brand.kind !== "none" &&
          others.every(a => { const b = brandsByAsin.get(a); return b && b.key === brand.key; });
        if (group && group.size > 1 && !sameBrand) {
          add(reasons, cfg.weights.sharedImage, `Main photo reused by ${group.size - 1} other listing${group.size > 2 ? "s" : ""}`, "flag");
        }
      }
    });

    const out = new Map();
    listings.forEach((l, i) => {
      const reasons = reasonsByIndex[i];
      const raw = cfg.weights.base + reasons.reduce((s, r) => s + r.pts, 0);
      // Evidence: the score without any brand points — what learning is allowed to use.
      const evidence = Math.max(0, Math.min(100, Math.round(
        cfg.weights.base + reasons.filter(r => r.tag !== "brand").reduce((s, r) => s + r.pts, 0))));
      const flags = reasons.filter(r => r.tag === "flag").length;
      const score = Math.max(0, Math.min(100, Math.round(raw)));
      const tier = score >= cfg.tiers[0] ? 5 : score >= cfg.tiers[1] ? 4 : score >= cfg.tiers[2] ? 3 : score >= cfg.tiers[3] ? 2 : 1;
      reasons.sort((a, b) => a.pts - b.pts);
      out.set(i, { asin: l.asin, score, tier, evidence, flags, brand: brandsByAsin.get(l.asin), reasons, listing: l });
    });
    return out;
  }

  const api = { scorePage, normalizeListing, letterScore, detectBrand, brandKey, isAccessoryTitle, asinEra, gibberishCheck, parseUnitPrice };
  if (typeof module !== "undefined") module.exports = api;
  else root.DSA_SCORER = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
