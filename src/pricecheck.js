// AmazonPlus — "Found at MERCHANT for PRICE" (off-Amazon price scan, via UPCitemdb).
// For a listing with a manufacturer model number, search UPCitemdb's product database for that brand +
// model and look for a 100%-identical item: the same model number with nothing else bundled, sold new
// and in stock by a US store other than Amazon or eBay, with a recently checked price. Pure functions;
// the requests are made in content.js, only when you press "Scan for off-Amazon prices".

(function (root) {
  "use strict";

  const T = el => el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Units and specs that look like codes but aren't model numbers.
  const NOT_MODEL = /^(\d+\s*-?\s*(FT|IN)-?LBS?|\d+-?(PORT|SPEED|PACK|PIECE|PC|PCS|IN-1|WAY|GANG|TON|PLY)|\d+(\.\d+)?(V|VOLTS?|AH|MAH|W|WATTS?|RPM|BPM|IPM|MM|CM|IN|INCH|FT|LBS?|NM|N\.M|PCS?|PK|PACK|GB|TB|MP|HZ|DB|OZ|ML|L|G|KG|PSI|CFM|GPM|AMP|AMPS|A)|\d+X\d+|[A-Z]?\d{1,3}V|V\d{1,3}|M\d{2}|USB\w*|LED\w*|MAX\w*|XR\w*|\d+(ST|ND|RD|TH))$/i;

  // The manufacturer's model number: "(DCF787D1)", "(BDCI20C)", "3453-20", "DCF887B".
  function modelFromTitle(title) {
    const t = title || "";
    for (const m of t.matchAll(/\(([A-Z0-9][A-Z0-9-]{3,20})\)/gi)) {
      const c = m[1].toUpperCase();
      if (/\d/.test(c) && /[A-Z]/.test(c) && !NOT_MODEL.test(c)) return c;
      if (/^\d{4}-\d{2}$/.test(c)) return c;
    }
    const milwaukee = /\b(\d{4}-\d{2})\b/.exec(t);
    if (milwaukee) return milwaukee[1];
    for (const m of t.matchAll(/\b([A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]*(?:-[A-Z0-9]+)?)\b/g)) {
      const c = m[1];
      if (c.length >= 5 && !NOT_MODEL.test(c)) return c;
    }
    return null;
  }

  // Other model numbers in a Google title that the Amazon title doesn't have mean something else is
  // bundled in ("… W/ DCBL722B Handheld Blower", "DCB245-2C … W/ DCF787D1").
  function otherCodes(title, model) {
    const out = [];
    for (const m of (title || "").matchAll(/\b([A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]*(?:-[A-Z0-9]+)?|\d{2}-\d{2}-\d{3,5}|\d{4}-\d{2})\b/gi)) {
      const c = m[1].toUpperCase();
      if (c === model || c.startsWith(model + "-") || c.length < 5 || NOT_MODEL.test(c)) continue;
      out.push(c);
    }
    return out;
  }

  // Is this listing the identical item? (With requireModel false, for a store's own title of an item
  // already matched on its model number: only the bundle, part and kind checks apply.)
  function isIdentical(gTitle, model, amazonTitle, requireModel) {
    if (!gTitle || !model) return false;
    // The exact model number, not a longer one ("DCF787D1" in "DCF787D1-DWAFE100SET" doesn't count;
    // "dewalt-dcf787d1-impact-driver…" does).
    const re = new RegExp("(^|[^A-Z0-9])" + esc(model) + "(?![A-Z0-9])(?!-[A-Z0-9]*\\d)", "i");
    if (requireModel !== false && !re.test(gTitle)) return false;
    const amazonCodes = new Set(otherCodes(amazonTitle || "", model));
    if (otherCodes(gTitle, model).some(c => !amazonCodes.has(c))) return false;
    // Bundles, multi-packs and accessory sets.
    const bundle = /\b(bundle|free\b|bonus|\d+\s*-?\s*(pc|pcs|piece)\b|accessor(y|ies)\s+(kit|set)|bit set|\d+\s*-?\s*(pack|pk)\b|pack of \d+|set of \d+|\(\d+\)|x\s?\d\b|personali[sz]ed|custom)/i;
    if (bundle.test(gTitle) && !bundle.test(amazonTitle || "")) return false;
    // Parts and accessories that mention the model: "Dewalt DCF850P1 Battery Replacement 4.0Ah",
    // "Ryobi PCL235B Battery", "Charger for DCF787D1".
    const a = amazonTitle || "";
    if (PART_WORDS.test(gTitle) && !PART_WORDS.test(a)) return false;
    if (new RegExp("\\b(for|fits?|with|w/)\\s+(the\\s+)?([A-Z+&-]+\\s+){0,2}" + esc(model) + "\\b", "i").test(gTitle)) return false;
    // It has to be the same kind of thing: if the Amazon title names a tool, so must Google's.
    const nouns = t => new Set((t.match(PRODUCT_NOUNS) || []).map(w => w.toLowerCase().replace(/s$/, "")));
    const an = nouns(a), gn = nouns(gTitle);
    if (an.size && ![...an].some(w => gn.has(w)) && !(gn.has("tool") || gn.has("kit"))) return false;
    if (an.size && !gn.size && requireModel !== false) return false;
    return true;
  }
  const PART_WORDS = /\b(replacement|compatible|for use with|fits|repair|spare|parts?\b|oem part|housing|brushes|decal|sticker|skin|holster|belt clip)/i;
  const PRODUCT_NOUNS = /\b(drivers?|drills?|wrench(es)?|saws?|sanders?|grinders?|hammers?|nailers?|staplers?|routers?|planers?|vacuums?|blowers?|trimmers?|mowers?|guns?|tools?|kits?|combos?|multi-?tools?|lights?|radios?)\b/gi;

  const SKIP_CONDITION = /(pre-?owned|\bused\b|refurbished|renewed|open box|reconditioned|for parts|wholesale)/i;
  // Amazon itself, auction and resale marketplaces, pawn and liquidation shops: not a like-for-like new item.
  const SKIP_MERCHANT = /^(amazon|ebay)\b|etsy|alibaba|aliexpress|temu|\bwish\b|mercari|poshmark|offerup|facebook|craigslist|walmart - seller|pawn|paymore|liquidat|surplus|thrift|resale|second ?hand|cash ?converters|backmarket|back market/i;

  function priceValue(s) {
    if (typeof s === "number") return s;
    const m = /\$\s?([\d,]+(?:\.\d{2})?)/.exec(s || "");
    return m ? parseFloat(m[1].replace(/,/g, "")) : null;
  }

  const norm = s => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Stores outside the US (prices in other currencies): walmart.ca, *.co.uk, …
  const FOREIGN = /\.(ca|uk|au|de|fr|it|es|nl|mx|jp|in|ie|nz|eu|cn|br)$/i;

  // UPCitemdb search response → the cheapest identical offer, or null.
  // items[].model / items[].title identify the product; items[].offers[] are stores' prices.
  function pickOffer(json, model, amazonTitle, now, maxAgeDays) {
    const items = (json && json.items) || [];
    const cutoff = (now || Date.now()) / 1000 - (maxAgeDays || 60) * 86400;
    const offers = [];
    for (const it of items) {
      const sameModel = norm(it.model) === norm(model) || isIdentical(it.title || "", model, amazonTitle);
      if (!sameModel || !isIdentical(it.title || "", model, amazonTitle, false)) continue;
      for (const o of it.offers || []) {
        const price = priceValue(o.price);
        if (!price || !o.link || !/^https?:\/\//.test(o.link)) continue;
        if (o.currency && o.currency !== "USD") continue;
        if (FOREIGN.test(o.domain || "")) continue;
        if (o.condition && !/^new$/i.test(o.condition)) continue;
        if (/out of stock|unavailable|discontinued/i.test(o.availability || "")) continue;
        if (o.updated_t && o.updated_t < cutoff) continue;
        if (SKIP_MERCHANT.test(o.merchant || "") || SKIP_MERCHANT.test(o.domain || "")) continue;
        if (o.title && !isIdentical(o.title, model, amazonTitle, false)) continue;
        offers.push({ m: (o.merchant || o.domain || "").replace(/^Wal-Mart\.com$/i, "Walmart"), p: "$" + price.toFixed(2), price, u: o.link, at: o.updated_t || null });
      }
    }
    offers.sort((a, b) => a.price - b.price);
    return offers[0] || null;
  }

  function searchUrl(query) {
    return "https://api.upcitemdb.com/prod/trial/search?s=" + encodeURIComponent(query) + "&match_mode=0&type=product";
  }
  function shoppingUrl(query) { return "https://www.google.com/search?udm=28&q=" + encodeURIComponent(query); }

  const api = { modelFromTitle, otherCodes, isIdentical, pickOffer, searchUrl, shoppingUrl, priceValue };
  if (typeof module !== "undefined") module.exports = api;
  else root.DSA_PRICECHECK = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
