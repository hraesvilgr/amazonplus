// AmazonPlus — tunable lists and weights.
// Edit these to adjust how listings are scored. All matching is case-insensitive.

var DSA_CONFIG = {
  // Hide promo / ad blocks between results (Haul carousels, brand banners, video ads…) while on.
  hideClutter: true,

  // Show search results as tiles (a grid of cards) whatever layout Amazon picked, while on.
  tiles: true,

  // "Scan for off-Amazon prices" (button in the AmazonPlus box): looks up listings with a manufacturer
  // model number on UPCitemdb's free plan and shows "Found at MERCHANT for PRICE". Userscript only.
  priceCheck: {
    enabled: true,
    minPrice: 0,           // only listings over this price (0 = any price)
    searchLimit: 20,       // UPCitemdb's free plan: 100 requests a day, of which 20 can be searches
    delayMs: 3000,         // between requests, one at a time
    cacheHours: 72,        // results (found or not) are reused for this long
    maxOfferAgeDays: 60    // ignore store prices UPCitemdb hasn't seen for longer than this
  },

  // Brand lists live in src/brands.js. Learned brands and your own Trust/Block choices
  // are kept in browser storage (see src/memory.js).

  // Marketing / overwrought phrases (regex source strings). Each hit costs points.
  floridPhrases: [
    "\\bunleash\\b", "\\belevate\\b", "inner chef", "\\bultimate\\b", "\\bpremium\\b",
    "perfect for", "perfect gift", "ideal gift", "gifts? for (?:mom|dad|men|women|him|her|every)",
    "every occasion", "must[- ]have", "game[- ]changer", "\\bupgraded?\\b", "\\bgifts?\\b",
    "mother's gifts?", "effortless(?:ly)?", "say goodbye", "next level", "revolutioni[sz]e",
    "masterpiece", "exquisite", "\\bdelight", "\\bhealth homemade\\b", "\\bperfectly\\b"
  ],

  // Words that look like ALL-CAPS shouting but are just acronyms or units.
  capsWhitelist: [
    "PFOA", "PTFE", "BPA", "USA", "LED", "USB", "FDA", "LFGB", "NSF", "UV", "XL", "XXL",
    "HD", "AC", "DC", "II", "III", "IV", "PRO", "MAX", "MINI", "TV"
  ],

  // Points. Positive = more trustworthy.
  weights: {
    base: 55,
    knownBrand: 22,
    blockedBrand: -26,
    gibberishBrand: -18,
    unrecognizedBrand: -6,
    noBrand: -10,
    titleOver120: -3,
    titleOver150: -6,
    titleOver200: -10,
    conciseTitle: 3,
    brackets: -4,         // per bracket symbol pair beyond the first
    bracketsCap: -15,
    florid: -5,           // per phrase
    floridCap: -15,
    shouting: -8,
    obfuscatedWord: -20,
    oddCharacters: -6,
    sentenceTitle: -5,
    keywordStuffing: -4,
    specs: 4,             // per spec type (dimensions, thickness, temperature, model no.)
    specsCap: 8,
    materialConflict: -12,
    copiedPhrase: -12,
    noReviews: -12,
    under10Reviews: -8,
    under50Reviews: -4,
    over200Reviews: 3,
    over1000Reviews: 6,
    over3000Reviews: 8,
    tooPerfect: -5,
    lowRating: -6,
    newListing: -4,
    sharedReviewPool: -8,
    sharedImage: -12,
    asinVintage: 10,      // listing 10+ years old (ASIN B00…)
    asinOld: 6,           // ~2015–2018
    asinRecent: 2,        // ~2018–2020
    asinNew: -4,          // created in the last year or so
    cheapOutlier: 0,      // off: on pages mixing accessories with main products (or sorted by price) it was noise
    // Brands you rated from the badge (replace the normal brand points)
    userTrusted: 25,
    userBlocked: -40,
    // Brands learned from your searches (replace the normal brand points)
    learnedTrusted: 10,
    learnedBlocked: -20
  },

  // Product-page signals (see src/product.js).
  productWeights: {
    veryNew: -8,            // listing under 3 months old (Date First Available)
    manyOneStar: -6,        // 15%+ of reviews are 1-star
    thinMiddle: -5,         // 85%+ 5-star but under 6% 4-star
    soldByAmazon: 5,
    anonymousSeller: -6,    // seller is a run-together trading-company registration
    bulletBrackets: -6,     // 【BRACKETED】 bullet headings
    bulletFlorid: -4,       // 3+ marketing phrases in the bullets
    bulletServicePush: -4,  // "contact us", "risk-free", "100% satisfaction"…
    bulletObfuscated: -10,  // "baguett-e", "safe-ty"
    bulletWall: -6,         // bullets over 1,800 characters
    bulletLong: -3,         // 1,300–1,800
    bulletConcise: 3,       // under 600 characters
    frequentlyReturned: -12
  },

  // When a brand gets learned. "Evidence" is a listing's score with all brand points removed,
  // so a brand's own rating can't feed back into what's learned about it.
  learning: {
    blockMinListings: 2,       // different products from the brand
    blockMinSearches: 2,       // different search terms it showed up in
    blockMaxAvgEvidence: 42,   // average evidence at or below this → learned junk
    blockFlaggedShare: 0.5,    // …or at least this share of its listings carry serious red flags
    trustMinListings: 3,
    trustMinSearches: 3,
    trustMinAvgEvidence: 60,
    trustMinReviews: 500,      // every listing needs at least this many reviews
    maxListingsPerBrand: 40,   // memory cap per brand
    maxBrands: 3000            // memory cap overall (least recently seen dropped first)
  },

  // Gibberish threshold for the average letter-pair log probability of a brand name.
  // English-looking words score about -2.4 to -3.0; random strings score lower.
  gibberishThreshold: -3.2,

  // Score → tier (1–5) cutoffs.
  tiers: [76, 60, 42, 24] // >=76 → 5, >=60 → 4, >=42 → 3, >=24 → 2, else 1
};

if (typeof module !== "undefined") module.exports = DSA_CONFIG;
