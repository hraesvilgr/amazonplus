// AmazonPlus — content script for search results pages.
// Adds a toggle above the left-hand filters. When on, every result card is scored,
// tinted green → yellow → red by trust, and the results are re-sorted most-trusted first.
// Each card's badge lets you trust or block its brand; brands are also learned across searches.

(function () {
  "use strict";

  const ext = globalThis.browser || globalThis.chrome;
  const CFG = globalThis.DSA_CONFIG;
  const BRANDS = globalThis.DSA_BRANDS;
  const BIGRAMS = globalThis.DSA_BIGRAMS;
  const SCORER = globalThis.DSA_SCORER;
  const MEMORY = globalThis.DSA_MEMORY;
  const PRODUCT = globalThis.DSA_PRODUCT;
  const PRICECHECK = globalThis.DSA_PRICECHECK;
  const CARD_SEL = 'div[data-component-type="s-search-result"]';
  const KEY_ENABLED = "dsaEnabled";
  const KEY_SORT = "dsaSort";                 // "trust" | "unit" | null (Amazon's own sort)
  const KEY_FEATURED_FOR = "dsaFeaturedFor";  // search where you picked Amazon's raw "Featured"
  const KEY_OLD_UNIT_SORT = "dsaUnitSort";    // v0.4.x
  const KEY_LISTINGS = "dsaListings";         // per-ASIN: search-results estimate + product-page check
  const KEY_LAST_CLICK = "dsaLastClick";      // the search result you last clicked through: {a: ASIN, at}
  const KEY_PRICES = "dsaOffPrices";          // off-Amazon price scans: query → { at, f: {m, p, u, at} | 0 }
  const KEY_PRICE_USAGE = "dsaUpcUsage";      // UPCitemdb free-plan use today: { used, limit, resetAt }
  const KEY_SCAN_FOLD = "dsaScanFold";        // true: the scan box is folded down to its title
  const KEY_PRIME = "dsaPrime";               // true: you have Prime (cards show Prime delivery and prices)
  const KEY_ECO = "dsaEco";                   // true: show sustainability badges on cards
  const KEY_PANEL_AT = "dsaPanelAt";          // desktop: where the box was dragged to (window position); null: its place
  const KEY_LOGO_AT = "dsaLogoAt";            // phones: where the shrunk logo's box was dragged to
  const KEY_PDP_BUG = "dsaPdpBugAt";          // where the a+ bug was dragged to: {x, y} from the main photo's top-left
  const KEY_PDP_TIDY = "dsaPdpTidy";          // false: product pages keep Amazon's sales clutter (the a+ bug, greyed)
  const KEY_SCAN_FOLD_VER = "dsaScanFoldVer"; // the version that fold choice was made in (new version: folded again)
  // This version: written in by the userscript build; the add-on reads it from its manifest.
  const VERSION = (() => {
    const built = "__AMAZONPLUS_VERSION__";
    if (!/^__/.test(built)) return built;
    try { return chrome.runtime.getManifest().version; } catch (e) { return ""; }
  })();
  // New-version notice (userscript only): once a day at most, the version number in the project's
  // manifest on GitHub; if it's newer, a link to install it at the top of the box.
  const KEY_UPDATE = "dsaUpdate";
  const UPDATE_URL = "https://github.com/hraesvilgr/amazonplus/raw/main/dist/AmazonPlus.user.js";
  const UPDATE_CHECK_URL = "https://raw.githubusercontent.com/hraesvilgr/amazonplus/main/manifest.json";
  const LISTINGS_MAX = 300;                   // most recently seen listings kept
  const CHECK_TTL = 30 * 864e5;               // product-page checks are reused for 30 days
  const KEY_MEMORY = "dsaMemory";

  let enabled = false;
  let lastClick = null;     // { a: ASIN, at } — the search result last clicked through
  let listings = {};        // ASIN → { s, t, r: [[pts, text, tag]], q, at, p?: { s, t, at, ch: [[pts, text]] } }
  let lastResults = null;   // last scoring, for refreshing the status line
  let lastPromoCount = 0;
  let sortChoice = null;    // "trust" | "unit" chosen in the Sort by menu (kept across searches), or null
  let featuredFor = "";     // you picked Amazon's "Featured" for this search term
  let memory = MEMORY.emptyMemory();
  let learned = {};
  let snapshot = null;      // { order: Map(container → children), cards: Set } — for restoring
  let applying = false;
  let reopenAsin = null;    // keep a badge open after a vote re-renders the page
  let panelOpen = false;
  let resetArmed = false;

  // ---------- storage ----------
  // Extension storage as an add-on; Tampermonkey/Violentmonkey storage as a userscript;
  // localStorage as a last resort. Values are stored as plain JSON-able objects.

  // As a userscript, the manager's storage always wins: GM_getValue/GM_setValue (Tampermonkey,
  // Violentmonkey) or GM.getValue/GM.setValue (Greasemonkey 4). Some managers run scripts where an
  // extension API object is visible too; that storage belongs to the manager, not to this script.
  const hasGM = typeof GM_getValue === "function" && typeof GM_setValue === "function";
  const GM4 = typeof GM !== "undefined" && GM && typeof GM.getValue === "function" && typeof GM.setValue === "function" ? GM : null;
  const isUserscript = hasGM || !!GM4 || typeof GM_info !== "undefined";
  const hasExtStorage = !isUserscript && !!(ext && ext.storage && ext.storage.local);

  async function storeGet(key, fallback) {
    try {
      if (hasExtStorage) {
        const r = await ext.storage.local.get(key);
        return r && key in r ? r[key] : fallback;
      }
      if (hasGM || GM4) {
        // Private script storage only; amazon.com's own localStorage is never read or written here.
        // (Greasemonkey 4 stores only strings, numbers and booleans, so objects go in as JSON there.)
        const v = hasGM ? await GM_getValue(key, undefined) : await GM4.getValue(key, undefined);
        if (v === undefined) return fallback;
        if (!hasGM && typeof v === "string" && v.startsWith("\u0001")) return JSON.parse(v.slice(1));
        return v;
      }
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      if (raw === "1" || raw === "0") return raw === "1";   // older versions stored the toggle this way
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function storeSet(key, value) {
    try {
      if (hasExtStorage) return ext.storage.local.set({ [key]: value });
      if (hasGM) return GM_setValue(key, value);
      if (GM4) return GM4.setValue(key, value !== null && typeof value === "object" ? "\u0001" + JSON.stringify(value) : value);
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage full or blocked — carry on without saving */ }
  }

  function saveMemory() {
    storeSet(KEY_MEMORY, memory);
  }

  function refreshLearned() {
    learned = MEMORY.learnedBrands(memory, CFG.learning);
  }

  function scoringConfig() {
    return Object.assign({}, CFG, {
      knownBrands: BRANDS.known,
      ambiguousBrands: BRANDS.ambiguous || [],
      blockedBrands: BRANDS.blocked,
      userBrands: memory.votes,
      learnedBrands: learned
    });
  }

  function currentQuery() {
    try { return new URLSearchParams(location.search).get("k") || ""; } catch (e) { return ""; }
  }

  // ---------- scraping ----------

  function text(el) { return el ? (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim() : ""; }

  // Amazon writes the unit price as "(" <price, printed twice: hidden + visible> "/count)", so the
  // card's plain text reads "($0.13$0.13/count)". Rebuild it from the hidden price and what follows.
  function scrapeUnitPrice(card) {
    for (const p of card.querySelectorAll(".a-price.a-text-price")) {
      const parent = p.parentElement;
      if (!parent) continue;
      let after = "", seen = false;
      for (const n of parent.childNodes) {
        if (n === p) { seen = true; continue; }
        if (seen) after += n.textContent;
      }
      after = after.replace(/\s+/g, " ").trim();
      if (!after.startsWith("/")) continue;
      const amount = (p.querySelector(".a-offscreen") || p).textContent.trim();
      const parsed = SCORER.parseUnitPrice("(" + amount + after + (after.endsWith(")") ? "" : ")"));
      if (parsed) return parsed;
    }
    return null;
  }

  function scrapeCard(card) {
    const recipe = card.querySelector('[data-cy="title-recipe"]');
    // Fashion layouts put the brand in its own small <h2> above the title; the title is the longest one.
    const h2 = [...(recipe || card).querySelectorAll("h2")]
      .sort((a, b) => (b.getAttribute("aria-label") || text(b)).length - (a.getAttribute("aria-label") || text(a)).length)[0] ||
      card.querySelector("h2");
    let brandLine = "";
    // The product title is the <h2>. Amazon sometimes adds a grey subtitle line under it inside the
    // same block ("Vinyl Record Player, Fully Automatic…"); that isn't part of the title.
    let title = (h2 && (h2.getAttribute("aria-label") || text(h2))) || text(recipe);

    // Some categories show the brand on its own line above the product name.
    if (recipe && h2) {
      const brandEl = [...recipe.querySelectorAll(".a-size-base-plus.a-color-base, .a-size-mini")]
        .find(el => !h2.contains(el) && !el.contains(h2) && text(el).length > 0 && text(el).length < 40);
      if (brandEl && !/^sponsored$/i.test(text(brandEl))) {
        brandLine = text(brandEl);
        if (title.startsWith(brandLine + " ")) title = title.slice(brandLine.length).trim();
      }
    }

    const sponsored = !!card.querySelector(
      '.puis-sponsored-label-text, .s-sponsored-label-text, [data-component-type="sp-sponsored-result"], ' +
      'a[aria-label*="Sponsored" i]') || /^sponsored\b/i.test(title);

    const reviewsBlock = card.querySelector('[data-cy="reviews-block"]');
    const reviews = text(reviewsBlock);

    // Exact review count from the ratings link label ("1,523 ratings"), when present.
    let reviewCount, reviewExact;
    const countEl = card.querySelector('[aria-label$="ratings" i], [aria-label$="rating" i]');
    const cm = countEl && /([\d,]+)\s+ratings?/i.exec(countEl.getAttribute("aria-label"));
    if (cm) { reviewCount = parseInt(cm[1].replace(/,/g, ""), 10); reviewExact = true; }

    const priceEl = card.querySelector('.a-price:not([data-a-strike="true"]) .a-offscreen');
    const unitPrice = scrapeUnitPrice(card);
    const img = card.querySelector("img.s-image");
    const ratingEl = card.querySelector(".a-icon-alt");

    return {
      asin: card.dataset.asin,
      title,
      brandLine,
      sponsored,
      rating: text(ratingEl),
      reviews,
      reviewCount,
      reviewExact,
      price: text(priceEl),
      unitPrice,
      img: img ? img.currentSrc || img.src : ""
    };
  }

  // ---------- small DOM helper ----------

  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (k === "class") node.className = v;
        else if (k === "on") for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
        else if (k === "data") Object.assign(node.dataset, v);
        else node.setAttribute(k, v);
      }
    }
    for (const c of children) if (c != null) node.append(c);
    return node;
  }

  function button(label, cls, onClick) {
    return el("button", {
      type: "button",
      class: "dsa-btn " + (cls || ""),
      on: {
        click: e => { e.preventDefault(); e.stopPropagation(); onClick(); }
      }
    }, label);
  }

  // ---------- votes ----------

  function vote(key, name, choice) {
    memory = MEMORY.setVote(memory, key, name, choice);
    refreshLearned();
    storeSet(KEY_MEMORY, memory);
    if (enabled) apply();
    renderPanel();
  }

  function forgetBrand(key) {
    memory = MEMORY.forget(memory, key);
    refreshLearned();
    storeSet(KEY_MEMORY, memory);
    if (enabled) apply();
    renderPanel();
  }

  // ---------- decoration ----------

  // Tints for a score: card background, edge stripe, text ink, and the Trust pill (white text on it).
  // All text/background pairs are at least 4.5:1. On a dark page (Amazon's dark mode), dark tints
  // with light text, so Amazon's own light text stays readable on the card.
  function colorsFor(score) {
    const hue = Math.round(Math.max(0, Math.min(100, score)) * 1.2); // 0 red → 60 yellow → 120 green
    return darkPage
      ? { bg: `hsl(${hue} 30% 17%)`, edge: `hsl(${hue} 60% 45%)`, ink: `hsl(${hue} 70% 78%)`, pill: `hsl(${hue} 70% 27%)` }
      : { bg: `hsl(${hue} 78% 94%)`, edge: `hsl(${hue} 70% 40%)`, ink: `hsl(${hue} 60% 22%)`, pill: `hsl(${hue} 75% 27%)` };
  }

  // Is Amazon showing a dark page? Judged from the colour actually behind the results (or the
  // product page), so it follows Amazon's own dark mode whatever triggered it.
  let darkPage = false;
  function checkDark() {
    let node = document.querySelector(CARD_SEL + ", #dp, #ppd") || document.body;
    let bg = null;
    for (; node && node.nodeType === 1; node = node.parentElement) {
      const c = getComputedStyle(node).backgroundColor;
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c || "");
      if (m && (m[4] === undefined || +m[4] > 0.5)) { bg = [+m[1], +m[2], +m[3]]; break; }
    }
    if (!bg) { const c = getComputedStyle(document.documentElement).backgroundColor; const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c || ""); bg = m && (m[4] === undefined || +m[4] > 0.5) ? [+m[1], +m[2], +m[3]] : [255, 255, 255]; }
    const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const was = darkPage;
    darkPage = 0.2126 * lin(bg[0]) + 0.7152 * lin(bg[1]) + 0.0722 * lin(bg[2]) < 0.2;
    document.documentElement.classList.toggle("dsa-dark", darkPage);
    return darkPage !== was;
  }

  function paintTarget(card) {
    return card.querySelector(".s-card-container, .puis-card-container") || card;
  }

  function brandRow(result) {
    const b = result.brand || {};
    if (!b.key) return el("div", { class: "dsa-brandrow dsa-muted" }, "No brand to rate on this listing.");
    const current = memory.votes[b.key];
    const row = el("div", { class: "dsa-brandrow" },
      el("span", { class: "dsa-brandname" }, b.name));
    row.append(
      button(current === "trust" ? "Trusted ✓" : "Trust", current === "trust" ? "dsa-on dsa-trust" : "dsa-trust",
        () => { reopenAsin = result.asin; vote(b.key, b.name, current === "trust" ? null : "trust"); }),
      button(current === "block" ? "Blocked ✓" : "Block", current === "block" ? "dsa-on dsa-block" : "dsa-block",
        () => { reopenAsin = result.asin; vote(b.key, b.name, current === "block" ? null : "block"); })
    );
    return row;
  }

  function decorate(card, result) {
    const c = colorsFor(result.score);
    card.dataset.dsaScored = "1";
    card.dataset.dsaTier = result.tier;
    card.classList.add("dsa-rated");
    const target = paintTarget(card);
    target.classList.add("dsa-paint");
    for (const node of [card, target]) {
      node.style.setProperty("--dsa-bg", c.bg);
      node.style.setProperty("--dsa-edge", c.edge);
      node.style.setProperty("--dsa-ink", c.ink);
      node.style.setProperty("--dsa-pill", c.pill);
    }

    const up = result.listing && result.listing.unitPrice;
    if (up) card.dataset.dsaUnit = up.label; else delete card.dataset.dsaUnit;

    const badge = el("details", { class: "dsa-badge" },
      el("summary", null, `Trust ${result.tier}/5`, el("span", { class: "dsa-score" }, ` · ${result.score}`),
        result.checked ? el("span", { class: "dsa-checked", title: "Checked on its product page" }, " ✓") : null));
    // The pop-over (reasons, unit price, Trust/Block) is only built when the badge is first opened,
    // so a page of 50 closed badges costs a few dozen elements instead of ~2,000.
    let built = false;
    const build = () => {
      if (built) return;
      built = true;
      const body = el("div", { class: "dsa-badge-body" });
      const ul = el("ul");
      for (const r of result.reasons) {
        ul.append(el("li", { class: r.pts > 0 ? "dsa-good" : "dsa-bad" },
          `${r.pts > 0 ? "+" : "−"}${Math.abs(r.pts)}  ${r.text}`));
      }
      if (up) body.append(el("div", { class: "dsa-unit dsa-muted" }, "Unit price: " + up.label));
      body.append(ul, brandRow(result));
      badge.append(body);
    };
    if (reopenAsin && reopenAsin === result.asin) { build(); badge.open = true; }
    // Keep clicks on the badge from reaching the product link; only one badge open at a time.
    badge.addEventListener("click", e => { e.stopPropagation(); build(); });
    badge.addEventListener("toggle", () => {
      if (!badge.open) return;
      build();
      // Keep the pop-up on screen: on a phone, a card in the left column would push it off the left edge.
      const body = badge.querySelector(".dsa-badge-body");
      if (body) {
        body.style.transform = "";
        const r = body.getBoundingClientRect(), vw = document.documentElement.clientWidth;
        const dx = r.left < 8 ? 8 - r.left : (r.right > vw - 8 ? vw - 8 - r.right : 0);
        if (dx) body.style.transform = `translateX(${Math.round(dx)}px)`;
      }
      document.querySelectorAll(".dsa-badge[open]").forEach(b => { if (b !== badge) b.open = false; });
    });
    // On the card itself, not the inner container: Amazon clips overflow there, which would cut off the popover.
    card.appendChild(badge);
    // List layout (one wide row per product): keep the title clear of the corner pill.
    card.classList.toggle("dsa-wide", card.getBoundingClientRect().width > 600);
  }

  function undecorate(card) {
    delete card.dataset.dsaScored;
    delete card.dataset.dsaTier;
    delete card.dataset.dsaUnit;
    card.classList.remove("dsa-rated", "dsa-dupe", "dsa-wide");
    card.querySelectorAll(".dsa-badge, .dsa-found").forEach(b => b.remove());
    card.querySelectorAll(".dsa-paint").forEach(t => t.classList.remove("dsa-paint"));
    if (card.classList.contains("dsa-paint")) card.classList.remove("dsa-paint");
  }

  // ---------- tidier result cards ----------
  // While AmazonPlus is on, each card loses wording that's noise for comparing listings (put back when
  // it's turned off; hidden with a class, never deleted): the delivery lines become one short
  // "Delivery DATE" (the date for non-Prime members when Amazon gives both, plus the fee if it isn't
  // free); sustainability badges ("Carbon impact", "Recycled materials", with their leaf),
  // "90-day low" labels, "1K+ bought in past month", "Top reviewed for …", and crossed-out
  // List / Typical / Was prices go. Found by their wording and
  // Amazon's strike-through marker, so it works with both the desktop and phone layouts.
  const TRIM = "dsa-trim";
  const txt = n => (n.textContent || "").replace(/\s+/g, " ").trim();
  const DELIVERY_LINE = /^(?:Join Prime to get |Or Non-members get |Or fastest delivery|Or Prime members get |FREE delivery|\$[\d.,]+ delivery|Delivery\b|Arrives\b)/i;
  // Amazon's sustainability badges ("Forestry practices ⌄", "Recycled materials +2 more ⌄", …).
  const SUSTAIN = /^(?:Carbon impact|Recycled materials|Forestry practices|Safer chemicals|Organic content|Climate Pledge Friendly|Sustainability features?|\d+ sustainability features?|Compact by design|Reduced carbon|Water (?:conservation|efficiency)|Energy efficiency|Responsible packaging|Reduced packaging|Pre-owned certified|Remanufactured|Sustainable materials?|Fair trade|Social responsibility)\b/i;
  // …and anything Amazon's own code labels as sustainability / Climate Pledge.
  const SUSTAIN_SEL = '[class*="sustainab" i], [class*="climate-pledge" i], [class*="cpf-" i], [data-csa-c-content-id*="sustainab" i], [data-csa-c-content-id*="climate" i], [aria-label*="sustainab" i]';
  const LOW_PRICE = /^(?:\d+-day low(?: price)?|Lowest price in \d+ days)$/i;
  // "1K+ bought in past month", "Top reviewed for durability": popularity labels, not about the product.
  const POPULARITY = /^(?:[\d.,]+[KkMm]?\+? bought in (?:the )?past (?:month|week)|[\d.,]+[KkMm]?\+? bought this (?:month|week)|Top reviewed for\b.*)$/i;
  const STRUCK_LABEL = /^(?:List(?: Price)?|Typical(?: price)?|Was|New Price|Price)\s*:?$/i;

  // The largest element around `n` (inside the card) whose text still passes `test`.
  function widen(n, card, test) {
    while (n.parentElement && n.parentElement !== card && test(txt(n.parentElement))) n = n.parentElement;
    return n;
  }
  function trimMatching(card, re, maxLen, cls) {
    cls = cls || TRIM;
    for (const n of card.querySelectorAll("div, span, a, i")) {
      if (n.classList.contains(cls) || n.closest("." + TRIM + ", ." + cls + ", .dsa-badge, .dsa-found, .dsa-delivery")) continue;
      const t = txt(n);
      if (!t || t.length > maxLen || !re.test(t)) continue;
      widen(n, card, p => p.length <= maxLen && re.test(p)).classList.add(cls);
    }
  }
  // Prices only Prime members get ("Join Prime to buy this item at $X", "Prime Member Price", …):
  // shown only with the Prime button on.
  // Not "Exclusive Prime price": there the card's main price is itself the Prime-only one, and the label
  // is the only sign of it, so it always stays.
  const PRIME_ONLY = /^(?:Join Prime to buy this item at\b|Prime Member (?:Price|price)\b|Lower price with Prime\b|With Prime\b).{0,60}$/i;

  // Amazon's delivery rows → our short lines:
  //   "Join Prime to get FREE delivery Tomorrow, Nov 16"             → Prime: Free Delivery Tomorrow, Nov 16
  //   "Or Non-members get FREE delivery Fri, Nov 20 on $35 of items…" → Non-Prime: Free Delivery Fri, Nov 20 on $35+ orders
  //   "$5.99 delivery Nov 6 - 10" (no Prime/non-member split)         → $5.99 Delivery Nov 6 - 10
  // "Or fastest delivery …" is left out.
  function deliveryPart(t) {
    const m = /(?:delivery|arrives)\s+(.+?)(?=\s+(?:on \$|on orders|on eligible|if you|or\b|for\b|when\b|with\b)|[.]?\s*$)/i.exec(t);
    if (!m) return null;
    const when = m[1].replace(/[\s,.]+$/, "");
    if (!/\d|today|tomorrow|overnight/i.test(when)) return null;
    const fee = /\$([\d.,]+)\s+delivery/i.exec(t);
    const price = fee ? "$" + fee[1] : (/free delivery/i.test(t) ? "Free" : "");
    const min = /\bon (?:orders (?:over|of) |eligible orders over )?\$([\d.,]+)/i.exec(t);
    return { price, when, min: min ? "$" + min[1].replace(/\.00$/, "") : "" };
  }
  function deliveryOf(lines) {
    const out = [];
    for (const t of lines) {
      if (/^or fastest/i.test(t)) continue;
      const d = deliveryPart(t);
      if (!d) continue;
      const who = /non-?members|without prime/i.test(t) ? "Non-Prime" : /\bprime\b/i.test(t) ? "Prime" : "";
      if (out.some(o => o.who === who)) continue;
      out.push(Object.assign({ who }, d));
    }
    // Prime first, then Non-Prime, then an unlabelled line.
    const rank = w => (w === "Prime" ? 0 : w === "Non-Prime" ? 1 : 2);
    return out.length ? out.sort((a, b) => rank(a.who) - rank(b.who)) : null;
  }

  function tidyCard(card) {
    if (card.dataset.dsaTidy) return;
    card.dataset.dsaTidy = "1";
    // Delivery: Amazon's message rows, or (other layouts) the smallest elements reading like one.
    let rows = [...card.querySelectorAll(".udm-primary-delivery-message, .udm-secondary-delivery-message")];
    if (!rows.length) {
      rows = [...card.querySelectorAll("div, span")].filter(n => {
        const t = txt(n);
        return t.length < 160 && DELIVERY_LINE.test(t) && ![...n.children].some(c => DELIVERY_LINE.test(txt(c)));
      });
      rows = rows.map(n => widen(n, card, p => p.length < 160 && DELIVERY_LINE.test(p)));
      rows = rows.filter((n, i) => rows.indexOf(n) === i && !rows.some(o => o !== n && o.contains(n)));
    }
    const ds = rows.length ? deliveryOf(rows.map(txt)) : null;
    if (ds) {
      for (const d of ds) {
        // Prime: the Prime arrow instead of the word, on one line.
        // Non-Prime: the arrow in dark red with a slash through it.
        const tag = d.who === "Prime" && globalThis.DSA_PRIME_ARROW
          ? el("img", { class: "dsa-prime", src: globalThis.DSA_PRIME_ARROW, alt: "Prime" })
          : d.who === "Non-Prime" && globalThis.DSA_NOPRIME_ARROW
          ? el("img", { class: "dsa-prime dsa-noprime", src: globalThis.DSA_NOPRIME_ARROW, alt: "Non-Prime" })
          : d.who ? d.who + ": " : "";
        const line = el("div", { class: "dsa-delivery" + (d.who === "Prime" ? " dsa-delivery-prime" : d.who === "Non-Prime" ? " dsa-delivery-noprime" : "") },
          tag, (d.price ? d.price + " " : "") + "Delivery ", el("b", {}, d.when), d.min ? ` on ${d.min}+ orders` : "");
        rows[0].parentElement.insertBefore(line, rows[0]);
      }
      rows.forEach(r => r.classList.add(TRIM));
      requestAnimationFrame(() => fitDelivery(card));
    }
    // Crossed-out prices, with their "List:" / "Typical:" / "Was:" label.
    for (const p of card.querySelectorAll('.a-price[data-a-strike="true"], .a-text-price[data-a-strike="true"]')) {
      if (p.closest("." + TRIM)) continue;
      const box = p.parentElement;
      const rest = box ? txt(box).replace(txt(p), "").trim() : "";
      if (box && box !== card && STRUCK_LABEL.test(rest)) { box.classList.add(TRIM); continue; }
      p.classList.add(TRIM);
      const label = p.previousElementSibling;
      if (label && STRUCK_LABEL.test(txt(label))) label.classList.add(TRIM);
    }
    trimMatching(card, SUSTAIN, 60, "dsa-eco");          // hidden unless the eco button is on
    for (const n of card.querySelectorAll(SUSTAIN_SEL)) {
      if (n.closest(".dsa-eco, .dsa-badge, .dsa-delivery") || txt(n).length > 80) continue;
      widen(n, card, p => p.length <= 80 && !/\$|add to cart|delivery/i.test(p)).classList.add("dsa-eco");
    }
    trimMatching(card, PRIME_ONLY, 90, "dsa-prime-only"); // hidden unless the Prime button is on
    trimMatching(card, LOW_PRICE, 30);
    trimMatching(card, POPULARITY, 60);
    moveCompare(card);
  }

  // Amazon's "Add to compare" button (phone site: a dark disc with two stacked cards and a "+") is
  // pinned to the card's bottom-left corner, where it can cover the price. It goes to the bottom-left
  // corner of the product photo instead, white with black lines (its colours inverted, whatever the
  // icon is drawn with). Found by "compare" in its label, title, class or data; put back when off.
  const COMPARE_SEL = '[aria-label*="compare" i], [title*="compare" i], [class*="compare" i], [data-action*="compare" i], [data-csa-c-content-id*="compare" i], [data-csa-c-type*="compare" i]';
  const compareHome = new WeakMap();
  function moveCompare(card) {
    const img = card.querySelector("img.s-image");
    let photo = card.querySelector(".s-product-image-container");
    if (!photo && img && img.parentElement !== card && img.parentElement.getBoundingClientRect().height <= img.getBoundingClientRect().height * 1.5 + 20) photo = img.parentElement;
    if (!photo) return;
    const own = n => n.closest(".dsa-badge, .dsa-found, .dsa-delivery, #dsa-toggle") || compareHome.has(n) || photo.contains(n);
    let found = null;
    for (let btn of card.querySelectorAll(COMPARE_SEL)) {
      if (own(btn)) continue;
      // The whole control: up to the largest wrapper that holds nothing else visible (no text).
      while (btn.parentElement && btn.parentElement !== card && !txt(btn.parentElement) && !btn.parentElement.contains(photo)) btn = btn.parentElement;
      if (txt(btn).length > 40 || btn.contains(photo)) continue;
      found = btn;
      break;
    }
    // Phones, if it has no "compare" label: a small round icon button pinned near the card's
    // bottom-left corner.
    if (!found && !document.querySelector("#s-refinements, #s-filters-content")) {
      const cr = card.getBoundingClientRect();
      for (const n of card.querySelectorAll("div, span, a, button")) {
        if (own(n) || !n.querySelector("svg, img, i") || txt(n).length > 2) continue;
        const r = n.getBoundingClientRect();
        if (r.width < 24 || r.width > 64 || Math.abs(r.width - r.height) > 6) continue;
        if (r.left - cr.left > cr.width / 3 || cr.bottom - r.bottom > cr.height / 4) continue;
        const cs = getComputedStyle(n);
        if (cs.position !== "absolute" || parseFloat(cs.borderTopLeftRadius) < r.width / 3) continue;
        found = n;
        break;
      }
    }
    if (!found) return;
    compareHome.set(found, { parent: found.parentElement, next: found.nextSibling });
    found.classList.add("dsa-compare");
    photo.classList.add("dsa-photo");
    photo.appendChild(found);
  }

  // A delivery line's text gets smaller (12px down to 10px) until it fits on one line. The Prime line
  // always stays on one line; the others may wrap if even 10px is too wide.
  function fitLine(line) {
    if (!line.isConnected || !line.clientWidth) return;
    const wrap = !line.classList.contains("dsa-delivery-prime");
    line.style.whiteSpace = "nowrap";
    let size = 12;
    line.style.fontSize = size + "px";
    while (line.scrollWidth > line.clientWidth + 0.5 && size > 10) line.style.fontSize = (size -= 0.5) + "px";
    line.style.whiteSpace = wrap && line.scrollWidth > line.clientWidth + 0.5 ? "normal" : "";
  }
  // Whichever delivery lines show (the Prime button decides).
  function fitDelivery(card) {
    card.querySelectorAll(".dsa-delivery").forEach(fitLine);
  }
  window.addEventListener("resize", () => cards().forEach(fitDelivery), { passive: true });

  function untidyCard(card) {
    delete card.dataset.dsaTidy;
    card.querySelectorAll(".dsa-compare").forEach(btn => {
      const home = compareHome.get(btn);
      btn.classList.remove("dsa-compare");
      if (home && home.parent.isConnected) home.parent.insertBefore(btn, home.next && home.next.parentNode === home.parent ? home.next : null);
      compareHome.delete(btn);
    });
    card.querySelectorAll(".dsa-photo").forEach(n => n.classList.remove("dsa-photo"));
    card.querySelectorAll(".dsa-delivery").forEach(n => n.remove());
    card.querySelectorAll("." + TRIM).forEach(n => n.classList.remove(TRIM));
    card.querySelectorAll(".dsa-eco, .dsa-prime-only").forEach(n => n.classList.remove("dsa-eco", "dsa-prime-only"));
    card.querySelectorAll(".dsa-compare").forEach(n => n.classList.remove("dsa-compare"));
  }

  // ---------- search-results estimates and product-page checks ----------

  // Keep each listing's search-results estimate so its product page can show what changed.
  function rememberEstimates(results) {
    const now = Date.now();
    const q = currentQuery();
    for (const r of results.values()) {
      if (!r.asin || r.listing.sponsored && listings[r.asin]) continue;
      const prev = listings[r.asin] || {};
      listings[r.asin] = Object.assign(prev, {
        s: r.score, t: r.tier, q, at: now,
        r: r.reasons.map(x => [x.pts, x.text, x.tag || ""])
      });
    }
    pruneListings();
    storeSet(KEY_LISTINGS, listings);
  }

  function pruneListings() {
    const keys = Object.keys(listings);
    if (keys.length <= LISTINGS_MAX) return;
    keys.sort((a, b) => (listings[b].at || 0) - (listings[a].at || 0));
    for (const k of keys.slice(LISTINGS_MAX)) delete listings[k];
  }

  // A listing checked on its product page carries that result back to the search results, as the
  // difference it made (so your later votes and learning still apply on top).
  function applyProductChecks(results) {
    const now = Date.now();
    for (const r of results.values()) {
      const rec = listings[r.asin];
      if (!rec || !rec.p || now - rec.p.at > CHECK_TTL) continue;
      const delta = rec.p.s - rec.p.base;
      r.reasons.push({ pts: delta, text: delta ? `Checked on its product page (${delta > 0 ? "+" : "−"}${Math.abs(delta)})` : "Checked on its product page (no change)", tag: "checked" });
      r.score = Math.max(0, Math.min(100, r.score + delta));
      const t = CFG.tiers;
      r.tier = r.score >= t[0] ? 5 : r.score >= t[1] ? 4 : r.score >= t[2] ? 3 : r.score >= t[3] ? 2 : 1;
      r.checked = true;
      r.reasons.sort((a, b) => a.pts - b.pts);
    }
  }

  // ---------- product pages ----------

  function productPanel(refined, product) {
    const c = colorsFor(refined.score);
    const init = refined.initial;
    // What the product page added up to, before the 0–100 limits. If the score was already pinned at
    // 0 or 100, say so instead of claiming "no change".
    const delta = refined.changes.reduce((a, x) => a + x.pts, 0);
    const pinned = delta && refined.baseScore != null && refined.score === refined.baseScore ? (refined.score === 0 ? " — already at the bottom of the scale" : " — already at the top of the scale") : "";
    const panel = el("div", { id: "dsa-product", class: "dsa-product" });
    panel.style.setProperty("--dsa-bg", c.bg);
    panel.style.setProperty("--dsa-edge", c.edge);
    panel.style.setProperty("--dsa-ink", c.ink);
    panel.style.setProperty("--dsa-pill", c.pill);

    // The change in score from the estimate this page started from: the search-results rating, or,
    // for a page opened directly, the rating from its title, stars and review count alone.
    const from = refined.baseScore != null ? refined.baseScore : refined.score;
    const moved = refined.score - from;
    const cls = moved > 0 ? "dsa-up" : moved < 0 ? "dsa-down" : "dsa-same";
    const deltaText = moved > 0 ? `▲${moved}` : moved < 0 ? `▼${Math.abs(moved)}` : "–";
    const deltaTip = (init ? "Change from the search-results estimate" : "Change from the estimate from the title, stars and reviews alone") +
      ` (${from} → ${refined.score})`;
    const head = el("div", { class: "dsa-ph-head" },
      el("span", { class: "dsa-ph-pill" }, `Trust ${refined.tier}/5`, el("span", { class: "dsa-score" }, ` · ${refined.score}`)),
      el("span", { class: "dsa-ph-delta " + cls, title: deltaTip }, deltaText),
      el("span", { class: "dsa-ph-title" }, "AmazonPlus"));
    let compare;
    if (!init) {
      compare = el("div", { class: "dsa-ph-compare" }, "Not in your recent search results — rated from this page.",
        pinned ? el("span", { class: "dsa-muted" }, pinned) : null);
    } else {
      compare = el("div", { class: "dsa-ph-compare" },
        refined.variantOf ? "Search results (another size/colour): " : "Search results: ", el("b", null, `${init.tier}/5 · ${init.score}`),
        "  →  this page: ", el("b", null, `${refined.tier}/5 · ${refined.score}`),
        pinned ? el("span", { class: "dsa-muted" }, pinned) : null,
        init.tier !== refined.tier ? el("span", { class: "dsa-muted" }, `  (tier ${init.tier} → ${refined.tier})`) : null);
    }

    const details = el("details", { class: "dsa-ph-details" }, el("summary", null, "What the product page showed"));
    const ch = el("ul", { class: "dsa-ph-list" });
    for (const x of refined.changes) {
      ch.append(el("li", { class: x.pts > 0 ? "dsa-good" : x.pts < 0 ? "dsa-bad" : "dsa-muted" },
        `${x.pts > 0 ? "+" + x.pts : x.pts < 0 ? "−" + Math.abs(x.pts) : "±0"}  ${x.text}`));
    }
    if (!refined.changes.length) ch.append(el("li", { class: "dsa-muted" }, "Nothing here changes the estimate."));
    const all = el("ul", { class: "dsa-ph-list" });
    for (const x of refined.reasons) {
      if (!x.pts) continue;
      all.append(el("li", { class: x.pts > 0 ? "dsa-good" : "dsa-bad" }, `${x.pts > 0 ? "+" : "−"}${Math.abs(x.pts)}  ${x.text}`));
    }
    details.append(ch, el("div", { class: "dsa-phead" }, "All reasons"), all);

    const key = product.brand ? SCORER.brandKey(product.brand) : null;
    if (key) {
      const current = memory.votes[key];
      details.append(el("div", { class: "dsa-brandrow" },
        el("span", { class: "dsa-brandname" }, product.brand),
        button(current === "trust" ? "Trusted ✓" : "Trust", current === "trust" ? "dsa-on dsa-trust" : "dsa-trust",
          () => { memory = MEMORY.setVote(memory, key, product.brand, current === "trust" ? null : "trust"); refreshLearned(); storeSet(KEY_MEMORY, memory); runProductPage(true); }),
        button(current === "block" ? "Blocked ✓" : "Block", current === "block" ? "dsa-on dsa-block" : "dsa-block",
          () => { memory = MEMORY.setVote(memory, key, product.brand, current === "block" ? null : "block"); refreshLearned(); storeSet(KEY_MEMORY, memory); runProductPage(true); })));
    }
    panel.append(head, compare, details);
    return panel;
  }

  // Which search-results estimate this page belongs to. The page's own ASIN often isn't the one you
  // clicked: Amazon opens the size or colour you picked last time, or you switch variants here. So also
  // try the page's other variants (the size/colour swatches) and the result you last clicked.
  function findInitial(asin) {
    const tries = [asin];
    for (const e of document.querySelectorAll('[id*="twister" i] [data-asin], [id*="twister" i] [data-defaultasin], [id*="twister" i] [data-csa-c-item-id]')) {
      const a = e.getAttribute("data-asin") || e.getAttribute("data-defaultasin") || e.getAttribute("data-csa-c-item-id") || "";
      if (/^[A-Z0-9]{10}$/.test(a) && !tries.includes(a)) tries.push(a);
    }
    const fromSearch = /\/s(\?|$)|[?&]k=/.test((() => { try { return new URL(document.referrer).pathname + new URL(document.referrer).search; } catch (e) { return ""; } })());
    if (lastClick && lastClick.a && Date.now() - lastClick.at < 30 * 60e3 && (fromSearch || tries.includes(lastClick.a)) && !tries.includes(lastClick.a)) tries.push(lastClick.a);
    // A record for this exact ASIN wins; otherwise the most recently seen variant.
    let best = null;
    for (const a of tries) {
      const rec = listings[a];
      if (!rec || !rec.r) continue;
      if (a === asin) return { asin: a, rec };
      if (!best || rec.at > best.rec.at) best = { asin: a, rec };
    }
    return best;
  }

  // ---------- Product pages: hiding the sales clutter ----------
  // While AmazonPlus is on, product pages lose: the "-41%" and "Lowest price in 30 days" badges, the
  // crossed-out List / Typical price, monthly-payment plans, Store Card offers, "Save up to 5% with business pricing", "Join Prime to get FREE delivery …" (the non-member
  // date stays), and the Prime and Amazon Business sign-up boxes. The a+ bug in the photo's top-left corner
  // turns this off (bug in grey, everything back) and on again; the choice is kept.
  let pdpTidy = true;
  let pdpBugAt = null;          // null: the photo's top-left corner (8, 8)
  const squash = t => (t || "").replace(/\s+/g, " ").trim();
  // Things a hidden block must never take with it.
  const PDP_KEEP = "#add-to-cart-button, #buy-now-button, #productTitle, .priceToPay, .apexPriceToPay, #dsa-product, " +
    "#mir-layout-DELIVERY_BLOCK-slot-SECONDARY_DELIVERY_MESSAGE_LARGE, #olpLinkWidget_feature_div, #olpLinkWidget, #availability, #tabular-buybox";
  const keepsWith = keep => n => n.matches(keep) || !!n.querySelector(keep);
  const keepsSomething = keepsWith(PDP_KEEP);
  // From a piece of text, the block it belongs to: up until the block's text reads as `whole`, then on
  // through wrappers that add almost nothing (a logo, a button label), stopping at anything bigger.
  function clutterBlock(node, whole, scope, keeps = keepsSomething, extra = 30) {
    let cur = node.parentElement;
    for (let i = 0; i < 6 && cur && cur !== scope && !whole.test(squash(cur.textContent)); i++) {
      if (keeps(cur.parentElement)) break;
      cur = cur.parentElement;
    }
    if (!cur || cur === scope || keeps(cur)) return null;
    while (cur.parentElement && cur.parentElement !== scope && !keeps(cur.parentElement)
           && squash(cur.parentElement.textContent).length - squash(cur.textContent).length <= extra) cur = cur.parentElement;
    return cur;
  }
  const PDP_CLUTTER = [
    { find: /business pricing/i, whole: /business pricing.*Amazon Business account/i },
    { find: /to get FREE delivery/i, whole: /^Join Prime to get FREE delivery/i, needs: /Join Prime/i },
    { find: /Enjoy fast, free delivery, exclusive deals/i, whole: /Enjoy fast, free delivery, exclusive deals.*Join Prime/i },
    { find: /Create a free account/i, whole: /business.*Create a free account/i },          // the Amazon Business box, whatever its offer
    { find: /Lowest price in \d+ days/i, whole: /Lowest price in \d+ days/i },                // red deal badges
    { find: /0% APR/i, whole: /\/mo.*0% APR/i },                                               // "Or $25.05/mo (3 mo) at 0% APR. Select plan"
    { find: /approv/i, whole: /(Gift Card|off|\$\d).*approv|approv.*(Store Card|Visa|Card)/i },  // Store Card / Visa sign-up offers
  ];
  // Amazon's own containers for the same offers, where they have them
  const PDP_CLUTTER_IDS = "#dealBadge_feature_div, #dealBadgeSupportingText_feature_div, #installmentCalculator_feature_div, " +
    "#issuancePriceblockAmabot_feature_div, #issuancePriceblockAmabot_csm_feature_div";
  function markProductClutter() {
    const scope = document.querySelector("#ppd") || document.querySelector("#dp") || document.body;
    const found = new Set();
    for (const n of scope.querySelectorAll(PDP_CLUTTER_IDS)) if (!keepsSomething(n)) found.add(n);
    // Sale badge and crossed-out prices next to the price
    for (const n of scope.querySelectorAll('[id^="corePrice"] .savingsPercentage, #apex_desktop .savingsPercentage')) found.add(n);
    for (const n of scope.querySelectorAll('[id^="corePrice"] .basisPrice, #apex_desktop .basisPrice, [id^="corePrice"] [data-a-strike="true"], #apex_desktop [data-a-strike="true"]')) {
      const row = n.closest("tr");
      const box = row || n.closest(".a-section") || n;
      found.add(keepsSomething(box) ? (n.closest(".basisPrice") || n) : box);
    }
    // Sign-up lines and boxes, found by their wording
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      // (never the product's own words: title, bullets, overview, highlights)
      if (t.parentElement && t.parentElement.closest("#dsa-product, script, style, noscript, #titleSection, #title_feature_div, " +
        "#feature-bullets, #productOverview_feature_div, #productFactsDesktop_feature_div, #productDescription")) continue;
      for (const c of PDP_CLUTTER) {
        if (!c.find.test(t.nodeValue)) continue;
        const block = clutterBlock(t, c.whole, scope);
        if (block && (!c.needs || c.needs.test(block.textContent))) found.add(block);
      }
    }
    for (const n of found) n.classList.add("dsa-pdp-clutter");
  }
  function placePdpBug() {
    let bug = document.getElementById("dsa-pdp-bug");
    const photo = document.querySelector("#leftCol, #imageBlock_feature_div, #imageBlock, #main-image-container");
    if (!photo) { if (bug) bug.remove(); return; }
    if (!bug) {
      bug = el("button", { id: "dsa-pdp-bug", type: "button", on: { click: e => {
        e.preventDefault(); e.stopPropagation();
        if (bug.dataset.dragged) { delete bug.dataset.dragged; return; }   // the end of a drag isn't a click
        pdpTidy = !pdpTidy; storeSet(KEY_PDP_TIDY, pdpTidy); renderPdpTidy();
      } } }, el("img", { src: globalThis.DSA_LOGO || "", alt: "", draggable: "false" }));
      document.body.appendChild(bug);
      dragPdpBug(bug);
    }
    bug.classList.toggle("dsa-off", !pdpTidy);
    bug.setAttribute("aria-pressed", String(pdpTidy));
    const tip = pdpTidy ? "AmazonPlus is hiding sale badges, list prices and sign-up offers. Click to show them."
                        : "AmazonPlus is showing Amazon's sale badges, list prices and sign-up offers. Click to hide them.";
    bug.title = tip; bug.setAttribute("aria-label", tip);
    // In the top-left corner of the main photo (right of the thumbnails), clear of its edge, or
    // wherever it was last dragged to (kept as a distance from that corner, so it follows the photo).
    if (bug.dataset.dragging) return;
    const r = pdpPhotoBox(photo);
    const at = pdpBugAt || { x: 8, y: 8 };
    bug.style.height = "44px";
    bug.style.left = Math.round(r.left + at.x + scrollX) + "px";
    bug.style.top = Math.round(r.top + at.y + scrollY) + "px";
  }
  function pdpPhotoBox(photo) {
    const visible = n => n && n.getClientRects().length && n.getBoundingClientRect().width > 40;
    const main = ["#main-image-container", "#imgTagWrapperId", "#imageBlock"].map(q => document.querySelector(q)).find(visible)
      || photo || document.querySelector("#leftCol, #imageBlock_feature_div, #imageBlock, #main-image-container");
    return main.getBoundingClientRect();
  }
  // Drag the bug anywhere (mouse, pen or finger); a press that moves under 5px is still a click.
  function dragPdpBug(bug) {
    const at = () => { const b = bug.getBoundingClientRect(); return { x: b.left, y: b.top }; };
    draggable(bug, {
      start: at,
      move: (x, y) => {
        const b = bug.getBoundingClientRect();
        bug.style.left = Math.round(Math.min(Math.max(x, 0), document.documentElement.clientWidth - b.width) + scrollX) + "px";
        bug.style.top = Math.round(Math.min(Math.max(y, 0), innerHeight - b.height) + scrollY) + "px";
      },
      end: () => {
        const b = bug.getBoundingClientRect(), r = pdpPhotoBox();
        pdpBugAt = { x: Math.round(b.left - r.left), y: Math.round(b.top - r.top) };
        storeSet(KEY_PDP_BUG, pdpBugAt);
      },
    });
  }
  function renderPdpTidy() {
    document.documentElement.classList.toggle("dsa-pdp-tidy", enabled && pdpTidy);
    if (enabled) placePdpBug();
  }
  function tidyProductPage() {
    const on = enabled && PRODUCT.isProductPage(location) && !PRODUCT.isMediaPage(document);
    if (!on) {
      document.documentElement.classList.remove("dsa-pdp-tidy");
      const bug = document.getElementById("dsa-pdp-bug"); if (bug) bug.remove();
      return;
    }
    markProductClutter();
    renderPdpTidy();
  }
  // ---------- Cart: the Store Card offer above the cart, and Join Prime under Proceed to checkout ----------
  const isCartPage = loc => /^\/(gp\/cart\/|cart(\/|$))/.test(loc.pathname);
  const CART_KEEP = "#sc-active-cart, #activeCartViewForm, .sc-list-item, [data-name=\"Active Items\"], #sc-buy-box, " +
    "[name=\"proceedToRetailCheckout\"], #sc-buy-box-ptc-button, #sc-subtotal-amount-buybox, #sc-subtotal-label-buybox, #navbar, #nav-main, #nav-belt, header";
  const cartKeeps = keepsWith(CART_KEEP);
  const CART_CLUTTER = [
    { find: /upon approval/i, whole: /upon approval/i },
    { find: /Join Prime|Try Prime/i, whole: /Join Prime|Try Prime/i },
  ];
  function tidyCart() {
    const on = enabled && isCartPage(location);
    document.documentElement.classList.toggle("dsa-pdp-tidy", on);
    if (!on) return;
    const scope = document.querySelector("#a-page") || document.body;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      // (lines inside the cart's own items are left alone)
      if (!t.parentElement || t.parentElement.closest("script, style, noscript, #navbar, header, .sc-list-item")) continue;
      for (const c of CART_CLUTTER) {
        if (!c.find.test(t.nodeValue)) continue;
        const block = clutterBlock(t, c.whole, scope, cartKeeps, 80);
        if (block) block.classList.add("dsa-pdp-clutter");
      }
    }
  }

  let pdpResize = 0;
  addEventListener("resize", () => { cancelAnimationFrame(pdpResize); pdpResize = requestAnimationFrame(() => { if (document.getElementById("dsa-pdp-bug")) placePdpBug(); }); });

  function runProductPage(reopen) {
    const old = document.getElementById("dsa-product");
    tidyProductPage();
    if (!enabled) { if (old) old.remove(); return; }
    const anchor = document.querySelector("#titleSection, #title_feature_div, #title");
    if (!anchor || !PRODUCT.productTitle(document)) return;
    checkDark();
    if (PRODUCT.isMediaPage(document)) { if (old) old.remove(); return; }   // books, films, TV, music, games
    try {
      const product = PRODUCT.extractProduct(document);
      const urlAsin = (/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/.exec(location.pathname) || [])[1];
      if (!product.asin) product.asin = urlAsin;
      const found = findInitial(product.asin);
      const rec = found && found.rec;
      const initial = rec ? { score: rec.s, tier: rec.t, reasons: rec.r.map(([pts, text, tag]) => ({ pts, text, tag: tag || undefined })) } : null;
      const refined = PRODUCT.refineScore(initial, product, scoringConfig(), BIGRAMS, SCORER);
      refined.variantOf = found && found.asin !== product.asin ? found.asin : null;
      // Remember the check for the search results, under this ASIN and the one the estimate came from.
      const check = { s: refined.score, t: refined.tier, base: refined.baseScore != null ? refined.baseScore : refined.score, at: Date.now(),
                      ch: refined.changes.map(x => [x.pts, x.text]) };
      listings[product.asin] = Object.assign(listings[product.asin] || { q: rec ? rec.q : "", at: Date.now() }, { p: check });
      if (found && found.asin !== product.asin) listings[found.asin].p = check;
      pruneListings();
      storeSet(KEY_LISTINGS, listings);

      const panel = productPanel(refined, product);
      if (reopen) panel.querySelector(".dsa-ph-details").open = true;
      if (old) old.replaceWith(panel); else anchor.insertAdjacentElement("afterend", panel);
    } catch (e) {
      // Never fail silently: say so on the page, with the error, so it can be reported.
      console.error("[AmazonPlus] product page:", e);
      const panel = el("div", { id: "dsa-product", class: "dsa-product dsa-product-error" },
        el("div", { class: "dsa-ph-head" }, el("span", { class: "dsa-ph-title" }, "AmazonPlus")),
        el("div", { class: "dsa-ph-compare" }, "Couldn't rate this page: " + (e && e.message || e)));
      if (old) old.replaceWith(panel); else anchor.insertAdjacentElement("afterend", panel);
    }
  }

  // ---------- "Found at MERCHANT for PRICE" (off-Amazon price scan, UPCitemdb) ----------
  // Nothing is looked up automatically. "Scan for off-Amazon prices" in the AmazonPlus box looks up
  // listings anywhere on Amazon that have a manufacturer model number (any price), one at a time,
  // on UPCitemdb's free plan (100 requests a day per connection, no sign-up), as they scroll into view,
  // and shows the cheapest identical item sold new elsewhere. Results are kept for 72 hours.
  // Userscript only (GM_xmlhttpRequest).

  const PC = CFG.priceCheck || {};
  const xhr = typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest
    : typeof GM !== "undefined" && GM && typeof GM.xmlHttpRequest === "function" ? o => GM.xmlHttpRequest(o) : null;   // Greasemonkey 4
  const canFetch = !!xhr;
  let prices = {};
  let usage = { used: 0, limit: 100, resetAt: 0 };
  let scanning = false;
  let scanNote = "";
  const pqByQ = new Map();

  // ---- New version available ----
  // Checked the first time AmazonPlus rates a results page each day (days start at 4 am Pacific
  // time), and never sooner than 24 hours after the last check. What it finds is kept, so the notice
  // stays, page after page and day after day, until its ✕ is tapped (or the new version is installed).
  let update = { checkedAt: 0, day: "", latest: "", dismissed: "" };
  let updateChecking = false;
  const versionParts = v => String(v || "").split(".").map(n => parseInt(n, 10) || 0);
  function isNewer(a, b) {
    const x = versionParts(a), y = versionParts(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
    return false;
  }
  const updateDay = now => new Date(now - 4 * 36e5).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const updateWanted = () => !!(VERSION && update.latest && isNewer(update.latest, VERSION) && update.dismissed !== update.latest);
  function renderUpdate() {
    const t = document.getElementById("dsa-toggle");
    const box = t && t.querySelector(".dsa-update");
    if (!box) return;
    const show = updateWanted();
    box.hidden = !show;
    t.classList.toggle("dsa-has-update", show);
  }
  function dismissUpdate(e) {
    e.preventDefault(); e.stopPropagation();
    update.dismissed = update.latest;
    storeSet(KEY_UPDATE, update);
    renderUpdate();
  }
  async function checkForUpdate() {
    if (!canFetch || !VERSION || updateChecking) return;
    const now = Date.now();
    if (update.day === updateDay(now) || now - (update.checkedAt || 0) < 864e5) return;
    updateChecking = true;
    update.checkedAt = now; update.day = updateDay(now);
    storeSet(KEY_UPDATE, update);                 // counts as today's check even if GitHub doesn't answer
    try {
      const res = await gmGet(UPDATE_CHECK_URL);
      if (res.status === 200) {
        const v = String((JSON.parse(res.text) || {}).version || "");
        if (/^\d+(\.\d+)*$/.test(v)) { update.latest = v; storeSet(KEY_UPDATE, update); }
      }
    } catch (e) { /* not JSON: try again tomorrow */ }
    updateChecking = false;
    renderUpdate();
  }

  function priceAvailable() { return !!(PC.enabled && canFetch && PRICECHECK); }

  // One request through the userscript manager. Always settles: an answer, an error, or — if the
  // manager never calls back at all (seen in testing: "Checking…" forever; e.g. Tampermonkey holding
  // the request while it asks permission to connect, or a manager that ignores `timeout`) — our own
  // time limit. `why` says which.
  function gmGet(url) {
    return new Promise(resolve => {
      let settled = false, req = null;
      const done = (r, why) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(Object.assign({ status: 0, headers: "", text: "", why }, r));
      };
      const limit = PC.requestTimeoutMs || 25000;
      const timer = setTimeout(() => { try { req && req.abort && req.abort(); } catch (e) {} done({}, "no-callback"); }, limit);
      try {
        req = xhr({
          method: "GET", url, timeout: limit - 2000, headers: { Accept: "application/json" },
          onload: r => done({ status: r.status, headers: r.responseHeaders || "", text: r.responseText || "" }, "answer"),
          onerror: r => done({ status: (r && r.status) || 0, text: (r && (r.error || r.statusText)) || "" }, "error"),
          ontimeout: () => done({}, "timeout"),
          onabort: () => done({}, "aborted")
        });
        // Greasemonkey 4's GM.xmlHttpRequest returns a promise that can reject without calling back.
        if (req && typeof req.then === "function") req.then(null, e => done({ text: String(e && e.message || e) }, "error"));
      } catch (e) {
        done({ text: String(e && e.message || e) }, "error");
      }
    });
  }
  const header = (h, name) => { const m = new RegExp("^" + name + ":\\s*(.+)$", "im").exec(h); return m ? m[1].trim() : null; };

  // Today's use of the free plan, from UPCitemdb's own rate-limit headers.
  function usedToday() {
    if (usage.resetAt && Date.now() > usage.resetAt) usage = { used: 0, limit: usage.limit || 100, resetAt: 0 };
    return usage;
  }
  function noteUsage(res) {
    const limit = parseInt(header(res.headers, "X-RateLimit-Limit"), 10);
    const remaining = parseInt(header(res.headers, "X-RateLimit-Remaining"), 10);
    const reset = parseInt(header(res.headers, "X-RateLimit-Reset"), 10);
    if (!isNaN(limit) && !isNaN(remaining)) usage = { used: Math.max(0, limit - remaining), limit, resetAt: !isNaN(reset) ? reset * 1000 : usage.resetAt };
    else usage = { used: usedToday().used + 1, limit: usage.limit || 100, resetAt: usage.resetAt || Date.now() + 864e5 };
    storeSet(KEY_PRICE_USAGE, usage);
  }

  function priceQuery(raw, result) {
    const price = PRICECHECK.priceValue(raw.price);
    if (price == null || price <= (PC.minPrice || 0)) return null;
    const title = (result.listing && result.listing.title) || raw.title.replace(/^sponsored( ad)?\s*[-–:]\s*/i, "");
    const model = PRICECHECK.modelFromTitle(title);
    if (!model) return null;
    let brand = (result.brand && result.brand.name) || raw.brandLine || "";
    // Spell the brand the way the listing does ("DEWALT", not the brand list's "DeWalt").
    if (brand && title.toUpperCase().startsWith(brand.toUpperCase())) brand = title.slice(0, brand.length);
    const q = (brand && !model.toUpperCase().includes(brand.toUpperCase()) ? brand + " " : "") + model;
    return { q, model, title };
  }

  function renderFound(card, q, f) {
    card.querySelectorAll(".dsa-found").forEach(n => n.remove());
    if (!f || !f.u) return;   // nothing identical found: leave the card exactly as it is
    const recipe = card.querySelector('[data-cy="price-recipe"]') ||
      (card.querySelector(".a-price") && card.querySelector(".a-price").parentElement);
    if (!recipe) return;
    const when = f.at ? new Date(f.at * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
    const box = el("div", { class: "dsa-found" },
      el("a", { class: "dsa-found-main", href: f.u, target: "_blank", rel: "noopener noreferrer nofollow",
        title: `Price seen ${when ? "on " + when + " " : ""}by UPCitemdb; check the store's page for today's price` },
        `Found at ${f.m} for ${f.p}`),
      el("a", { class: "dsa-found-google", href: PRICECHECK.shoppingUrl(q), target: "_blank", rel: "noopener noreferrer" },
        "View Google Shopping results"));
    box.addEventListener("click", e => e.stopPropagation());
    recipe.insertBefore(box, recipe.firstChild);
  }

  function renderPriceFor(q) {
    const hit = prices[q];
    for (const card of cards()) if (card.dataset.dsaPriceQ === q) renderFound(card, q, hit && hit.f);
  }

  // On every scoring pass: note which listings can be scanned, and show results already in hand.
  function preparePriceChecks(rated, raws, results) {
    if (!priceAvailable()) return;
    rated.forEach((card, i) => {
      const pq = priceQuery(raws[i], results.get(i));
      if (!pq) { delete card.dataset.dsaPriceQ; return; }
      card.dataset.dsaPriceQ = pq.q;
      pqByQ.set(pq.q, pq);
      if (priceFresh(pq.q)) renderFound(card, pq.q, prices[pq.q].f);
      watchForScan(card);
    });
    updateScanButton();
  }

  // Scanning is switched on with the button and then follows your scrolling: each listing is looked up
  // when it comes into view, so results you never reach cost nothing. One request per listing.
  let scanOn = false;
  const scanQueue = [];
  const scanQueued = new Set();
  const scanTally = { found: 0, none: 0 };
  const priceFresh = q => { const hit = prices[q]; return hit && Date.now() - hit.at < (PC.cacheHours || 72) * 36e5; };

  const scanObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
    if (!scanOn) return;
    for (const e of entries) if (e.isIntersecting) queueCard(e.target);
    runScan();
  }, { threshold: 0.4 }) : null;

  function watchForScan(card) { if (scanObserver && card.dataset.dsaPriceQ) scanObserver.observe(card); }

  function queueCard(card) {
    const q = card.dataset.dsaPriceQ;
    if (!q || card.classList.contains("dsa-dupe") || scanQueued.has(q) || priceFresh(q)) return;
    scanQueued.add(q);
    scanQueue.push(q);
  }

  function inView(card) {
    const r = card.getBoundingClientRect();
    return r.bottom > 0 && r.top < (window.innerHeight || document.documentElement.clientHeight) && r.width > 0;
  }

  // ---------- Prime / eco preferences ----------
  // Prime off ("No Prime"): cards show the Non-Prime delivery line and hide Prime-only prices.
  // Prime on: the Prime delivery line and Prime prices; the Non-Prime line is hidden.
  // Eco off: sustainability badges hidden (with their leaf); on: shown. Classes on <html>; styles.css.
  let hasPrime = false, showEco = false;
  let panelAt = null, logoAt = null;

  // Drag something with mouse, pen or finger. A press that moves under 5px stays a click; after a
  // real drag, the click that follows is swallowed (handle.dataset.dragged), so it doesn't toggle anything.
  //   o.can(e): whether this press may start a drag; o.start(): the dragged element's window {x, y};
  //   o.move(x, y) while dragging; o.end(x, y) once, at the end.
  function draggable(handle, o) {
    let st = null;
    // Moves are followed on the whole page: a quick first move can already be off the handle.
    const move = e => {
      if (!st || e.pointerId !== st.id) return;
      if (!st.on) {
        if (Math.hypot(e.clientX - st.x, e.clientY - st.y) < 5) return;
        st.on = true; st.from = o.start();
        try { getSelection().removeAllRanges(); } catch (err) { /* nothing selected */ }
        handle.dataset.dragging = "1";
      }
      e.preventDefault();
      st.last = { x: st.from.x + e.clientX - st.x, y: st.from.y + e.clientY - st.y };
      o.move(st.last.x, st.last.y);
    };
    const end = e => {
      if (!st || e.pointerId !== st.id) return;
      const was = st; st = null;
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", end, true);
      document.removeEventListener("pointercancel", end, true);
      if (!was.on) return;
      delete handle.dataset.dragging;
      handle.dataset.dragged = "1";
      setTimeout(() => { delete handle.dataset.dragged; }, 0);
      o.end(was.last.x, was.last.y);
    };
    handle.addEventListener("pointerdown", e => {
      if (e.button !== 0 || (o.can && !o.can(e))) return;
      st = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false };
      document.addEventListener("pointermove", move, true);
      document.addEventListener("pointerup", end, true);
      document.addEventListener("pointercancel", end, true);
    });
    // A drag that ended over a link mustn't follow it.
    handle.addEventListener("click", e => { if (handle.dataset.dragged) { e.preventDefault(); e.stopPropagation(); delete handle.dataset.dragged; } }, true);
  }
  function setPrefs(prime, eco, save) {
    hasPrime = !!prime; showEco = !!eco;
    const root = document.documentElement;
    root.classList.toggle("dsa-has-prime", hasPrime);
    root.classList.toggle("dsa-eco-on", showEco);
    if (save) { storeSet(KEY_PRIME, hasPrime); storeSet(KEY_ECO, showEco); }
    const t = document.getElementById("dsa-toggle");
    if (t) {
      const pb = t.querySelector(".dsa-pref-prime"), eb = t.querySelector(".dsa-pref-eco");
      if (pb) {
        pb.setAttribute("aria-pressed", String(hasPrime));
        const img = pb.querySelector("img"), want = (hasPrime ? globalThis.DSA_PRIME_ARROW : globalThis.DSA_NOPRIME_ARROW) || "";
        if (img.getAttribute("src") !== want) img.setAttribute("src", want);
        pb.querySelector(".dsa-pref-text").textContent = hasPrime ? "Prime" : "No Prime";
        pb.title = hasPrime ? "Showing Prime delivery and prices — tap if you don't have Prime" : "Showing delivery and prices without Prime — tap if you have Prime";
      }
      if (eb) {
        eb.setAttribute("aria-pressed", String(showEco));
        eb.querySelector(".dsa-pref-text").textContent = showEco ? "Show" : "Hide";
        eb.title = showEco ? "Showing sustainability badges — tap to hide them" : "Sustainability badges hidden — tap to show them";
      }
    }
    requestAnimationFrame(() => cards().forEach(fitDelivery));
  }

  let scanFold = false;
  function onScanBox(e) {
    e.preventDefault();
    if (e.target.closest && e.target.closest(".dsa-scan-caret") || scanFold) {
      scanFold = !scanFold;
      storeSet(KEY_SCAN_FOLD, scanFold);
      storeSet(KEY_SCAN_FOLD_VER, VERSION);
      updateScanButton();
      return;
    }
    scanPrices();
  }

  // The scan box title stays on one line: in a narrow box its text gets smaller (11px down to 9px)
  // until it fits.
  function fitScanTitle() {
    // Desktop: the scan box sits in the main column, beside the buttons and logo; if that column is
    // too narrow for its title (Amazon's left column is narrow in smaller windows), it goes below
    // both columns, full width, instead.
    const t = document.getElementById("dsa-toggle");
    const main = t && t.querySelector(".dsa-col-main"), body = t && t.querySelector(".dsa-body"), box = t && t.querySelector(".dsa-scanbox");
    if (main && body && box && !t.classList.contains("dsa-inline") && main.clientWidth) {
      const roomy = main.clientWidth >= 165;
      if (roomy && box.parentElement !== main) main.appendChild(box);
      else if (!roomy && box.parentElement === main) body.after(box);
    }
    const head = document.querySelector("#dsa-toggle .dsa-scan-head");
    if (!head || !head.clientWidth) return;
    let size = 11;
    head.style.fontSize = size + "px";
    while (head.scrollWidth > head.clientWidth + 0.5 && size > 9) head.style.fontSize = (size -= 0.5) + "px";
  }
  window.addEventListener("resize", fitScanTitle, { passive: true });

  function updateScanButton() {
    const btn = document.querySelector("#dsa-toggle .dsa-scan");
    const note = document.querySelector("#dsa-toggle .dsa-scan-note");
    if (!btn) return;
    const box = btn.parentElement;
    box.hidden = !enabled || !priceAvailable();
    const u = usedToday();
    // The free plan allows 100 requests a day, but only 20 of them can be searches, and every scan
    // request is a search, so count against 20.
    const cap = PC.searchLimit || 20;
    const label = btn.querySelector(".dsa-scan-label") || btn;
    btn.classList.toggle("dsa-fold", scanFold);
    requestAnimationFrame(fitScanTitle);
    const caret = btn.querySelector(".dsa-scan-caret");
    if (caret) { caret.textContent = scanFold ? "▸" : "▾"; caret.setAttribute("aria-expanded", scanFold ? "false" : "true"); }
    label.textContent = (scanOn ? "Tap to stop · " : "") + `${Math.min(u.used, cap)}/${cap} used today`;
    btn.setAttribute("aria-pressed", scanOn ? "true" : "false");
    const radar = btn.querySelector(".dsa-radar");
    const want = (scanOn ? globalThis.DSA_RADAR_SCAN : globalThis.DSA_RADAR_IDLE) || "";
    if (radar && radar.getAttribute("src") !== want) radar.setAttribute("src", want);   // only on change: keeps the sweep smooth
    if (note) note.textContent = scanNote;
  }

  function scanPrices() {
    if (!priceAvailable()) return;
    if (scanOn) { scanOn = false; scanQueue.length = 0; scanQueued.clear(); scanNote = scanSummary("Stopped."); updateScanButton(); return; }
    const eligible = cards().filter(c => c.dataset.dsaPriceQ && !c.classList.contains("dsa-dupe"));
    if (!eligible.length) {
      scanNote = PC.minPrice ? "No listings here have a manufacturer model number and a price over $" + PC.minPrice + "."
        : "No listings here have a manufacturer model number.";
      updateScanButton();
      return;
    }
    scanOn = true;
    scanNoAnswer = 0;
    scanTally.found = scanTally.none = 0;
    eligible.filter(inView).forEach(queueCard);
    scanNote = scanQueue.length ? "" : "Listings in view are already checked. Scroll to check more.";
    updateScanButton();
    runScan();
  }

  function scanSummary(prefix) {
    const n = scanTally.found + scanTally.none;
    return (prefix ? prefix + " " : "") + (n ? `Checked ${n}: found ${scanTally.found} elsewhere, ${scanTally.none} not found.` : "");
  }

  let scanNoAnswer = 0;
  async function runScan() {
    if (scanning) return;
    scanning = true;
    try {
      while (scanOn && enabled && scanQueue.length) {
        const q = scanQueue.shift();
        const pq = pqByQ.get(q);
        if (!pq || priceFresh(q)) continue;
        scanNote = `Checking ${q}…` + (scanQueue.length ? ` (${scanQueue.length} more in view)` : "");
        updateScanButton();
        let res = await gmGet(PRICECHECK.searchUrl(q));
        if (res.status) noteUsage(res);           // nothing reached UPCitemdb: nothing to count
        if (res.status === 429 && /TOO_FAST/i.test(res.text)) {   // too many in a short burst: wait and retry once
          await new Promise(r => setTimeout(r, 31000));
          res = await gmGet(PRICECHECK.searchUrl(q));
          if (res.status) noteUsage(res);
        }
        if (!res.status) {
          // No answer from UPCitemdb at all. Twice in a row: stop and say what's likely wrong.
          scanQueued.delete(q);
          console.warn(`[AmazonPlus] price scan: ${q} — no answer (${res.why}${res.text ? ": " + res.text : ""})`);
          if (++scanNoAnswer >= 2) {
            scanOn = false; scanQueue.length = 0; scanQueued.clear();
            scanNote = res.why === "no-callback"
              ? "UPCitemdb didn't answer: your userscript manager is holding the requests. In Tampermonkey, look for a tab or prompt asking to let AmazonPlus connect to api.upcitemdb.com and choose Always allow (or check the script's settings), then scan again."
              : `UPCitemdb couldn't be reached (${res.why === "timeout" ? "no reply in time" : res.why === "aborted" ? "request cancelled" : "connection error"}${res.text ? ": " + res.text.slice(0, 80) : ""}). Check your connection, or whether your userscript manager blocks api.upcitemdb.com, then scan again.`;
            break;
          }
          continue;
        }
        scanNoAnswer = 0;
        if (res.status === 429) {
          const after = parseInt(header(res.headers, "Retry-After"), 10);
          if (!isNaN(after)) usage.resetAt = Date.now() + after * 1000;
          usage.used = Math.max(usage.limit, PC.searchLimit || 20); storeSet(KEY_PRICE_USAGE, usage);
          scanOn = false; scanQueue.length = 0; scanQueued.clear();
          scanNote = scanSummary(`UPCitemdb's free daily limit is used up${!isNaN(after) ? ` (resets in about ${Math.ceil(after / 3600)} h)` : ""}.`);
          console.info("[AmazonPlus] price scan: daily limit reached", res.text.slice(0, 200));
          break;
        }
        let json = null;
        try { json = JSON.parse(res.text); } catch (e) { /* not JSON */ }
        if (res.status !== 200 || !json || json.code !== "OK") {
          scanQueued.delete(q);   // try again if it comes back into view
          console.info(`[AmazonPlus] price scan: ${q} — no answer (HTTP ${res.status}${json && json.code ? ", " + json.code : ""})`);
        } else {
          const f = PRICECHECK.pickOffer(json, pq.model, pq.title, Date.now(), PC.maxOfferAgeDays || 60);
          prices[q] = { at: Date.now(), f: f ? { m: f.m, p: f.p, u: f.u, at: f.at } : 0 };
          if (f) scanTally.found++; else scanTally.none++;
          console.info(`[AmazonPlus] price scan: ${q} — ${(json.items || []).length} products; ` + (f ? `cheapest identical: ${f.m} ${f.p}` : "no identical item sold new elsewhere"));
          renderPriceFor(q);
          savePrices();
        }
        if (scanQueue.length) await new Promise(r => setTimeout(r, PC.delayMs || 3000));
      }
      if (scanOn) scanNote = scanSummary("") + (scanSummary("") ? " " : "") + "Scroll to check more.";
    } catch (e) {
      console.error("[AmazonPlus] price scan failed", e);
      scanOn = false; scanQueue.length = 0; scanQueued.clear();
      scanNote = "The scan stopped on an error: " + String(e && e.message || e).slice(0, 100);
    } finally {
      scanning = false;
      updateScanButton();
    }
  }

  function savePrices() {
    const keys = Object.keys(prices);
    if (keys.length > 500) keys.sort((a, b) => prices[a].at - prices[b].at).slice(0, keys.length - 500).forEach(k => delete prices[k]);
    storeSet(KEY_PRICES, prices);
  }

  // ---------- promos and ad blocks ----------
  // Amazon fills the results grid with full-width blocks that aren't results: sponsored brand
  // banners and videos, "Explore the collection", Amazon Haul's "Crazy-good finds", "Brands related
  // to your search", stray "Sponsored Ad" boxes… Rather than chase each one, everything in the
  // results grid is hidden except product cards, section headings, the "Narrow your search"
  // filters, pagination and help.

  function isKeeper(node) {
    if (node.nodeType !== 1) return true;
    if (/^(SCRIPT|LINK|STYLE|TEMPLATE|NOSCRIPT)$/.test(node.tagName)) return true;
    if (node.matches(CARD_SEL)) return true;
    const KEEP = '[data-component-type="s-messaging-widget-results-header"], [data-component-type="s-pagination"], ' +
                 '[data-component-type="s-result-info-bar"], .s-pagination-strip, .s-pagination-container';
    if (node.matches(KEEP) || node.querySelector(KEEP)) return true;
    if (node.id === "dsa-toggle") return true;
    const head = (node.innerText || node.textContent || "").trim().slice(0, 40);
    if (/^(Results|More results|Narrow your search|Need help\?|Previous\b)/i.test(head)) return true;
    // Empty spacers: leave them; hiding them changes nothing.
    if (!head && !node.querySelector("img, video, iframe")) return true;
    return false;
  }

  // Promo blocks are removed from the page outright (not just hidden), after stopping any video and
  // unloading any embedded frame, so their images, video and ad frames can be freed. Nothing keeps a
  // reference to them; they come back on the next page load.
  let promosRemoved = 0;

  function unloadMedia(node) {
    for (const v of node.querySelectorAll("video, audio")) {
      try { v.pause(); v.removeAttribute("src"); v.srcObject = null; v.load(); } catch (e) { /* ignore */ }
    }
    for (const f of node.querySelectorAll("iframe")) {
      try { f.src = "about:blank"; } catch (e) { /* ignore */ }
    }
  }

  function removeClutter() {
    const slots = new Set([...document.querySelectorAll(".s-main-slot")]);
    for (const c of cards()) if (c.parentElement) slots.add(c.parentElement);
    const gone = new Set();
    for (const slot of slots) {
      for (const node of [...slot.children]) {
        if (isKeeper(node)) continue;
        unloadMedia(node);
        node.remove();
        gone.add(node);
        promosRemoved++;
      }
    }
    // Drop our own references to them too (the saved original order), so they can be freed.
    if (gone.size && snapshot) {
      for (const [parent, children] of snapshot.order) snapshot.order.set(parent, children.filter(n => !gone.has(n)));
    }
    return promosRemoved;
  }

  // ---------- apply / restore ----------

  // Top-level results only: a result can hold others (a group block, or hidden size/colour variants);
  // those are left exactly as Amazon draws them.
  function cards() { return [...document.querySelectorAll(CARD_SEL)].filter(c => c.dataset.asin && !(c.parentElement && c.parentElement.closest(CARD_SEL))); }

  // Books, films, TV, music and games aren't rated. A search where nearly everything (80%+) is
  // media gets no AmazonPlus at all; on mixed pages the media results are just left alone.
  function isMedia(card) {
    if (card.dataset.dsaMedia === undefined) card.dataset.dsaMedia = PRODUCT.isMediaCard(card) ? "1" : "";
    return card.dataset.dsaMedia === "1";
  }
  function isMediaSearch() {
    const list = cards();
    return list.length > 0 && list.filter(isMedia).length >= list.length * 0.8;
  }

  function apply() {
    const list = cards();
    if (!list.length) return;
    applying = true;
    try {
      list.forEach(undecorate);
      checkDark();

      // Amazon can split results across several containers; the main slot receives the sorted list.
      const slot = document.querySelector(".s-main-slot") || list[0].parentElement;
      const parents = new Set(list.map(c => c.parentElement).concat(slot));
      // Snapshot the original order of every container involved, unless we already hold one for these cards.
      // (Also when Amazon swapped the results in place, e.g. going to page 2: its old cards are gone.)
      if (!snapshot || list.some(c => !snapshot.cards.has(c)) || [...snapshot.cards].some(c => !c.isConnected)) {
        // A new set of results (e.g. page 2 swapped in, most cards new): the promo count starts again.
        if (snapshot && list.filter(c => !snapshot.cards.has(c)).length >= list.length / 3) promosRemoved = 0;
        snapshot = { order: new Map([...parents].map(p => [p, [...p.children]])), cards: new Set(list) };
      }
      setTiles(true);

      const media = list.filter(isMedia);
      const rated = list.filter(c => !isMedia(c));
      const raws = rated.map(scrapeCard);
      const results = SCORER.scorePage(raws, scoringConfig(), BIGRAMS);
      rememberEstimates(results);
      applyProductChecks(results);

      // Learn from this page (uses brand-free evidence, so it can't reinforce itself).
      memory = MEMORY.recordPage(memory, results, currentQuery(), CFG.learning);
      refreshLearned();
      saveMemory();

      // Decorate every card, and hide repeat placements of the same product
      // (keeping the organic copy over the sponsored one).
      const keep = new Map();
      rated.forEach((card, i) => {
        const r = results.get(i);
        decorate(card, r);
        const prev = keep.get(r.asin);
        if (!prev) keep.set(r.asin, { card, sponsored: r.listing.sponsored });
        else if (prev.sponsored && !r.listing.sponsored) {
          prev.card.classList.add("dsa-dupe");
          keep.set(r.asin, { card, sponsored: false });
        } else {
          card.classList.add("dsa-dupe");
        }
      });

      // Order: price per unit when that switch is on; otherwise by trust, but only on Amazon's
      // default order — a sort you picked on Amazon is left alone (colours and badges stay either way).
      restoreOrder();
      const mode = currentMode();
      if (mode !== "amazon") {
        const sorted = mode === "unit"
          ? unitOrder(rated, raws, results)
          : rated.map((card, i) => ({ card, i, score: results.get(i).score })).sort((a, b) => b.score - a.score || a.i - b.i);
        // Unrated media (games, books, films) keep the places Amazon gave them — a search for a game
        // keeps the game on top; the rated listings are sorted around them.
        const order = [];
        let next = 0;
        for (const card of cards()) {
          if (media.includes(card)) order.push({ card });
          else if (next < sorted.length) order.push(sorted[next++]);
        }
        while (next < sorted.length) order.push(sorted[next++]);
        const firstResult = [...slot.children].find(node => node.matches(CARD_SEL));
        const anchor = document.createComment("dsa-sorted");
        slot.insertBefore(anchor, firstResult);
        for (const { card } of order) slot.insertBefore(card, anchor);
        anchor.remove();
      }
      // Once everything is one re-sorted list, a "More results" heading would sit stranded at the end.
      for (const node of slot.children) {
        if (/^More results/i.test((node.innerText || node.textContent || "").trim())) node.classList.toggle("dsa-stray-head", mode !== "amazon");
      }

      preparePriceChecks(rated, raws, results);
      const hidden = CFG.hideClutter === false ? 0 : removeClutter();
      lastResults = results;
      lastPromoCount = promosRemoved;
      cards().forEach(tidyCard);
      cards().forEach(tileClass);
      updateStatus(results, mode, hidden);
      checkForUpdate();
    } finally {
      applying = false;
      reopenAsin = null;
    }
  }

  // Tile view: the results grid becomes rows of cards (styles.css, html.dsa-tiles), whatever layout
  // Amazon chose for the search. Off again when AmazonPlus is switched off.
  // Which results become tiles: each top-level result, except one that shows several products side
  // by side (Amazon's group blocks), which keeps the full width of the results. Products nested in a
  // result (shown or not) are never restyled: styles.css scopes every tile rule to .dsa-tile and
  // keeps it out of nested results.
  function tileClass(card) {
    if (card.classList.contains("dsa-tile") || card.classList.contains("dsa-group")) return;
    const shown = [...card.querySelectorAll(CARD_SEL)].filter(n => { const r = n.getBoundingClientRect(); return r.width > 40 && r.height > 40; });
    card.classList.add(shown.length >= 2 ? "dsa-group" : "dsa-tile");
  }

  function setTiles(on) {
    document.documentElement.classList.toggle("dsa-tiles", !!on && CFG.tiles !== false);
  }

  // Put every result back where Amazon had it (without touching colours or badges).
  function restoreOrder() {
    if (!snapshot) return;
    for (const [parent, children] of snapshot.order) {
      if (!parent.isConnected) continue;
      // Only nodes still on the page: cards Amazon has taken away (page 2 replacing page 1) stay gone.
      for (const node of children) if (node.isConnected) parent.appendChild(node);
    }
  }

  // Price-per-unit order. Listings priced in the page's most common unit come first (cheapest per
  // unit first), then other units, each group cheapest first; listings with no unit price go last,
  // in Amazon's order. Equal unit prices fall back to trust.
  function unitOrder(list, raws, results) {
    const groups = new Map();
    raws.forEach(r => { if (r.unitPrice) groups.set(r.unitPrice.unit, (groups.get(r.unitPrice.unit) || 0) + 1); });
    const rank = new Map([...groups.entries()].sort((a, b) => b[1] - a[1]).map(([u], i) => [u, i]));
    return list
      .map((card, i) => ({ card, i, u: raws[i].unitPrice, score: results.get(i).score }))
      .sort((a, b) => {
        if (!a.u || !b.u) return (a.u ? 0 : 1) - (b.u ? 0 : 1) || a.i - b.i;
        return rank.get(a.u.unit) - rank.get(b.u.unit) || a.u.value - b.u.value || b.score - a.score || a.i - b.i;
      });
  }

  function restore() {
    applying = true;
    try {
      cards().forEach(undecorate);
      cards().forEach(untidyCard);
      cards().forEach(c => c.classList.remove("dsa-tile", "dsa-group"));
      document.querySelectorAll(".dsa-stray-head").forEach(n => n.classList.remove("dsa-stray-head"));
      if (snapshot) {
        for (const [parent, children] of snapshot.order) {
          if (!parent.isConnected) continue;
          // Only nodes still on the page: cards Amazon has taken away (page 2 replacing page 1) stay gone.
      for (const node of children) if (node.isConnected) parent.appendChild(node);
        }
      }
      setTiles(false);
      snapshot = null;
      lastResults = null;
      updateStatus(null);
    } finally {
      applying = false;
    }
  }

  // ---------- AmazonPlus entries in Amazon's Sort by menu ----------
  // Amazon's menu is a hidden <select id="s-result-sort-select"> whose options Amazon copies into
  // the visible pop-up list each time it opens, so adding <option>s puts entries in the menu.
  // Picking one is caught before Amazon navigates; it re-orders the results already on the page.
  //
  //   AmazonPlus: Trust   — most trusted first. Also what a fresh search shows by default.
  //   AmazonPlus: $/count — cheapest per unit first.
  //   Amazon's own sorts       — Amazon's order, with colours and badges. Picking "Featured" shows
  //                              Amazon's real Featured order for that search.
  // A AmazonPlus choice stays until you pick one of Amazon's sorts.
  const SORTS = { trust: { value: "dsa-trust", label: "AmazonPlus: Trust" },
                  unit:  { value: "dsa-unit",  label: "AmazonPlus: $/count" } };
  const OUR_VALUES = new Set(Object.values(SORTS).map(x => x.value));

  function sortSelect() { return document.getElementById("s-result-sort-select"); }

  // Amazon's sort for this page, from the URL ("" = none given, i.e. Featured).
  function urlSort() {
    try { return new URLSearchParams(location.search).get("s") || ""; } catch (e) { return ""; }
  }
  function isFeatured(value) { return !value || /^(relevanceblender|relevance-rank|featured-rank)$/i.test(value); }

  function currentMode() {
    if (sortChoice === "unit") return "unit";
    if (sortChoice === "trust") return "trust";
    if (!isFeatured(urlSort())) return "amazon";
    return featuredFor && featuredFor === currentQuery().toLowerCase() ? "amazon" : "trust";
  }

  function amazonSortValue(sel) {
    if (!sel.dataset.dsaAmazon) {
      const chosen = [...sel.options].find(o => o.defaultSelected && !OUR_VALUES.has(o.value)) || sel.options[0];
      sel.dataset.dsaAmazon = chosen ? chosen.value : "";
    }
    return sel.dataset.dsaAmazon;
  }

  function setPrompt(sel, label) {
    const prompt = sel.parentElement && sel.parentElement.querySelector(".a-dropdown-prompt");
    if (prompt) prompt.textContent = label;
  }

  // Add our entries (once) and make the menu show the order that's actually on screen.
  function installSortOption() {
    const sel = sortSelect();
    if (!sel) return;
    const amazonValue = amazonSortValue(sel);
    for (const key of ["trust", "unit"]) {
      if (![...sel.options].some(o => o.value === SORTS[key].value)) {
        const opt = document.createElement("option");
        opt.value = SORTS[key].value;
        opt.textContent = SORTS[key].label;
        sel.appendChild(opt);
      }
    }
    const mode = currentMode();
    if (mode === "amazon") {
      if (OUR_VALUES.has(sel.value)) sel.value = amazonValue;
      setPrompt(sel, (sel.selectedOptions[0] || {}).textContent || "");
    } else {
      sel.value = SORTS[mode].value;
      setPrompt(sel, SORTS[mode].label);
    }
  }

  function removeSortOption() {
    const sel = sortSelect();
    if (!sel) return;
    if (OUR_VALUES.has(sel.value)) sel.value = amazonSortValue(sel);
    setPrompt(sel, (sel.selectedOptions[0] || {}).textContent || "");
    [...sel.options].filter(o => OUR_VALUES.has(o.value)).forEach(o => o.remove());
  }

  function closeSortMenu(from) {
    (from || document.body).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, which: 27, bubbles: true }));
  }

  function setSortChoice(choice) {
    sortChoice = choice;
    storeSet(KEY_SORT, choice);
  }
  function setFeaturedFor(query) {
    featuredFor = query;
    storeSet(KEY_FEATURED_FOR, query);
  }

  // The value of an entry in Amazon's pop-up list: data-value='{"stringVal":"review-rank"}'.
  function entryValue(a) {
    try { return JSON.parse(a.getAttribute("data-value") || "{}").stringVal || null; } catch (e) { return null; }
  }

  function chooseSort(value, label) {
    const sel = sortSelect();
    const q = currentQuery().toLowerCase();
    const ours = Object.keys(SORTS).find(k => SORTS[k].value === value || SORTS[k].label === label);
    if (ours) {
      setSortChoice(ours);
      setFeaturedFor("");
      return true;                                   // handled here, no page load
    }
    // One of Amazon's sorts: hand over to Amazon.
    setSortChoice(null);
    if (isFeatured(value)) setFeaturedFor(q);
    // If it's the sort this page already has, Amazon won't reload, so update in place.
    return !!sel && value === amazonSortValue(sel);
  }

  function onSortEntry(e) {
    if (!enabled) return;
    const a = e.target.closest && e.target.closest('a[id^="s-result-sort-select_"], .a-dropdown-link');
    if (!a || !a.closest(".a-popover, .a-dropdown-common, [role=listbox]")) return;
    const sel = sortSelect();
    if (!sel) return;
    const label = a.textContent.trim();
    const value = entryValue(a) || ([...sel.options].find(o => o.textContent.trim() === label) || {}).value;
    if (chooseSort(value, label)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeSortMenu(a);
      installSortOption();
      apply();
    }
  }


  // ---------- phone site: the "Sort by" chips in Amazon's Filters sheet ----------
  // The phone site has no sort menu; sorting lives as a row of chips ("Featured", "Price: Low to
  // High", …) inside the Filters sheet. Our two sorts are added as chips of the same look, and the
  // chip that's lit up follows the order actually on screen. Found by its labels, not Amazon's class
  // names, so a restyle doesn't break it; if the row isn't recognised, nothing is added.
  const MOBILE_SORT_LABELS = ["Price: Low to High", "Price: High to Low", "Avg. Customer Review", "Best Sellers", "Newest Arrivals"];
  const isOn = el => /^(true|page|step|location|date)$/i.test(el.getAttribute("aria-checked") || el.getAttribute("aria-selected") ||
    el.getAttribute("aria-pressed") || el.getAttribute("aria-current") || "");
  let mobileSort = null;     // { row, chips: [Amazon's chips], plain, lit, litChip, litOriginal, ours: {trust, unit} }

  function findMobileSortRow() {
    if (sortSelect() && sortSelect().offsetParent) return null;          // desktop: the menu handles it
    let hit = null;
    try {
      const x = document.evaluate("//*[normalize-space(text())='Price: Low to High']", document.body, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      for (let i = 0; i < x.snapshotLength && !hit; i++) {
        const n = x.snapshotItem(i);
        if (n.closest("select, option, .a-popover, .a-dropdown-common, #dsa-toggle") || !n.getClientRects().length) continue;
        hit = n;
      }
    } catch (e) { return null; }
    if (!hit) return null;
    // The chip: the largest ancestor whose text is still just this label; the row: its parent.
    let chip = hit;
    while (chip.parentElement && chip.parentElement.textContent.trim() === "Price: Low to High") chip = chip.parentElement;
    const row = chip.parentElement;
    if (!row) return null;
    const chips = [...row.children].filter(c => !c.dataset.dsaSort);
    const labels = chips.map(c => c.textContent.trim());
    if (labels.filter(l => MOBILE_SORT_LABELS.includes(l) || l === "Featured").length < 3) return null;
    return { row, chips };
  }

  // Which chip looks selected, and what a plain one looks like.
  function chipLooks(chips) {
    let lit = chips.find(c => isOn(c) || c.querySelector("[aria-checked=true],[aria-selected=true],[aria-pressed=true],[aria-current]:not([aria-current=false])"));
    if (!lit) {
      const count = new Map();
      chips.forEach(c => count.set(c.className, (count.get(c.className) || 0) + 1));
      if (count.size === 2) lit = chips.find(c => count.get(c.className) === 1 && chips.length > 2);
    }
    const plainChip = chips.find(c => c !== lit && c.className !== (lit && lit.className)) || chips[chips.length - 1];
    return { lit, plainChip };
  }

  // Copy the look (classes and aria state, recursively) of one chip onto another of the same shape.
  function copyLook(from, to) {
    to.className = from.className;
    for (const a of ["aria-checked", "aria-selected", "aria-pressed", "aria-current"]) {
      if (from.hasAttribute(a)) to.setAttribute(a, from.getAttribute(a)); else to.removeAttribute(a);
    }
    const f = [...from.children], t = [...to.children];
    if (f.length === t.length) f.forEach((c, i) => copyLook(c, t[i]));
  }

  function makeChip(template, label, key) {
    const chip = template.cloneNode(true);
    // Strip everything that could make it act like Amazon's chip (links, ids, data, form fields).
    for (const e of [chip, ...chip.querySelectorAll("*")]) {
      for (const a of [...e.attributes]) if (!/^(class|style|aria-(checked|selected|pressed|current|hidden)|role)$/.test(a.name)) e.removeAttribute(a.name);
    }
    chip.querySelectorAll("input, img, svg").forEach(n => n.remove());
    let leaf = chip;
    while (leaf.children.length) leaf = [...leaf.children].find(c => c.textContent.trim()) || leaf.children[0];
    leaf.textContent = label;
    chip.dataset.dsaSort = key;
    chip.setAttribute("role", "button");
    chip.setAttribute("tabindex", "0");
    chip.style.cursor = "pointer";
    const go = e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      setSortChoice(key);
      setFeaturedFor("");
      showMobileSort();
      apply();
      closeSheet(chip);
    };
    chip.addEventListener("click", go, true);
    chip.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") go(e); }, true);
    return chip;
  }

  // The sheet's close (✕) button: the nearest one up from the chips.
  function closeSheet(from) {
    for (let e = from.parentElement; e && e !== document.body; e = e.parentElement) {
      const btn = [...e.querySelectorAll('button, [role=button], a')].find(b =>
        /^(close|dismiss)/i.test(b.getAttribute("aria-label") || b.getAttribute("title") || "") || /^[✕×✖xX]$/.test(b.textContent.trim()));
      if (btn) { btn.click(); return; }
    }
  }

  // Light up the chip for the order on screen: ours, or Amazon's own as Amazon left it.
  function showMobileSort() {
    const m = mobileSort;
    if (!m || !m.row.isConnected) return;
    const mode = currentMode();
    for (const key of Object.keys(m.ours)) copyLook(mode === key && m.lit ? m.lit : m.plainChip, m.ours[key]);
    if (m.litChip) {
      if (mode === "amazon") { if (m.litChip.className !== m.litOriginal.className) copyLook(m.litOriginal, m.litChip); }
      else copyLook(m.plainChip, m.litChip);
    }
  }

  function installMobileSort() {
    if (mobileSort && mobileSort.row.isConnected) return;
    mobileSort = null;
    const found = findMobileSortRow();
    if (!found) return;
    const { lit, plainChip } = chipLooks(found.chips);
    const ours = {};
    for (const key of ["trust", "unit"]) {
      ours[key] = makeChip(plainChip, SORTS[key].label, key);
      found.row.appendChild(ours[key]);
    }
    mobileSort = { row: found.row, chips: found.chips, lit: lit && lit.cloneNode(true), plainChip: plainChip.cloneNode(true),
      litChip: lit, litOriginal: lit && lit.cloneNode(true), ours };
    showMobileSort();
  }

  function removeMobileSort() {
    if (!mobileSort) return;
    Object.values(mobileSort.ours).forEach(c => c.remove());
    if (mobileSort.litChip && mobileSort.litChip.isConnected) copyLook(mobileSort.litOriginal, mobileSort.litChip);
    mobileSort = null;
  }

  // Tapping one of Amazon's chips: Amazon's sort from now on ("Featured" = Amazon's real Featured order).
  document.addEventListener("click", e => {
    if (!enabled || !mobileSort || !e.target.closest) return;
    const chip = mobileSort.chips.find(c => c.contains(e.target));
    if (!chip) return;
    setSortChoice(null);
    const featured = chip.textContent.trim() === "Featured";
    setFeaturedFor(featured ? currentQuery().toLowerCase() : "");
    // Already on Featured: Amazon won't reload, so show its order here.
    if (featured && isFeatured(urlSort())) setTimeout(() => { showMobileSort(); apply(); }, 0);
  }, true);

  document.addEventListener("click", onSortEntry, true);
  document.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") onSortEntry(e); }, true);
  // Keyboard / native-select changes: keep Amazon from navigating to our entries.
  document.addEventListener("change", e => {
    if (!enabled || e.target !== sortSelect()) return;
    const sel = e.target;
    const value = sel.value;
    if (OUR_VALUES.has(value) || value === amazonSortValue(sel)) {
      e.stopImmediatePropagation();
      chooseSort(value, "");
      installSortOption();
      apply();
    } else {
      chooseSort(value, "");
    }
  }, true);

  // ---------- toggle + brand manager ----------

  function brandCounts() {
    const yours = Object.keys(memory.votes).length;
    const learnedKeys = Object.keys(learned).filter(k => !memory.votes[k]);
    return { yours, learned: learnedKeys.length };
  }

  function updateStatus(results, mode, hidden) {
    const status = document.querySelector("#dsa-toggle .dsa-status");
    if (!status) return;
    if (!results) {
      status.textContent = promosRemoved ? "Off · reload to bring back the hidden promos" : "Off";
    }
    else {
      // Count what's actually on screen: hidden repeat placements don't count, and neither do cards an
      // ad blocker hides (uBlock Origin hides sponsored results with display:none; they're still rated).
      const shown = c => c.getClientRects().length > 0;
      const visible = cards().filter(c => c.dataset.dsaScored && !c.classList.contains("dsa-dupe") && shown(c));
      const tiers = [0, 0, 0, 0, 0, 0];
      for (const c of visible) tiers[+c.dataset.dsaTier]++;
      const extras = [];
      const media = cards().filter(c => c.dataset.dsaMedia === "1" && shown(c)).length;
      // Phones: less room, so the media and promo notes are left out.
      const narrow = !!status.closest(".dsa-inline");
      if (media && !narrow) extras.push(`${media} book${media === 1 ? "" : "s"}/media not rated`);
      if (hidden && !narrow) extras.push(`${hidden} promo${hidden === 1 ? "" : "s"} removed`);
      if (mode === "amazon") extras.push("Amazon's order");
      if (mode === "unit") extras.push("ordered by $/count");
      status.textContent = `${visible.length} rated · ${tiers[5] + tiers[4]} trusted · ${tiers[1]} junk` +
        (extras.length ? " · " + extras.join(" · ") : "");
    }
    updateManageLabel();
    fitStatus();
  }

  // Phones: the status is one line; its text gets smaller (down to 9px) until it fits.
  function fitStatus() {
    const status = document.querySelector("#dsa-toggle.dsa-inline .dsa-status");
    if (!status || !status.clientWidth) return;
    let size = 12;
    status.style.fontSize = size + "px";
    while (status.scrollWidth > status.clientWidth + 0.5 && size > 9) status.style.fontSize = (size -= 0.5) + "px";
  }

  function updateManageLabel() {
    const mb = document.querySelector("#dsa-toggle .dsa-manage");
    if (mb) {
      const c = brandCounts();
      mb.textContent = `${panelOpen ? "▾" : "▸"} Brands: ${c.yours} yours · ${c.learned} learned`;
    }
  }

  function panelItem(key, name, label, cls, actions) {
    return el("li", { class: "dsa-pitem" },
      el("span", { class: "dsa-pname" }, name),
      el("span", { class: "dsa-ptag " + cls }, label),
      el("span", { class: "dsa-pactions" }, ...actions));
  }

  function renderPanel() {
    const panel = document.querySelector("#dsa-toggle .dsa-panel");
    updateManageLabel();
    if (!panel) return;
    panel.hidden = !panelOpen;
    if (!panelOpen) return;
    panel.replaceChildren();

    // Your ratings
    const votes = Object.entries(memory.votes).sort((a, b) => (memory.names[a[0]] || a[0]).localeCompare(memory.names[b[0]] || b[0]));
    panel.append(el("div", { class: "dsa-phead" }, "Your ratings"));
    if (!votes.length) panel.append(el("div", { class: "dsa-muted" }, "None yet. Open a card's Trust badge to trust or block its brand."));
    else {
      const ul = el("ul", { class: "dsa-plist" });
      for (const [k, v] of votes) {
        ul.append(panelItem(k, memory.names[k] || k, v === "trust" ? "trusted" : "blocked", v === "trust" ? "dsa-trust" : "dsa-block",
          [button("×", "dsa-x", () => vote(k, null, null))]));
      }
      panel.append(ul);
    }

    // Learned
    const learnedList = Object.entries(learned).filter(([k]) => !memory.votes[k])
      .sort((a, b) => (memory.brands[a[0]].name || a[0]).localeCompare(memory.brands[b[0]].name || b[0]));
    panel.append(el("div", { class: "dsa-phead" }, "Learned from your searches"));
    if (!learnedList.length) panel.append(el("div", { class: "dsa-muted" }, "Nothing yet. Brands are learned after they show up across several different searches."));
    else {
      const ul = el("ul", { class: "dsa-plist" });
      for (const [k, v] of learnedList) {
        const e = memory.brands[k];
        const j = MEMORY.judge(e, CFG.learning);
        const item = panelItem(k, e.name, v === "trust" ? "trusted" : "junk", v === "trust" ? "dsa-trust" : "dsa-block", [
          button("Trust", "dsa-trust", () => vote(k, e.name, "trust")),
          button("Block", "dsa-block", () => vote(k, e.name, "block")),
          button("Forget", "", () => forgetBrand(k))
        ]);
        item.title = `${j.why || ""} — ${j.stats.listings} listings across ${j.stats.searches} searches, average ${j.stats.avgEvidence} before brand points`;
        ul.append(item);
      }
      panel.append(ul);
    }

    const tracked = Object.keys(memory.brands).length;
    panel.append(el("div", { class: "dsa-pfoot" },
      el("span", { class: "dsa-muted" }, `${tracked} brand${tracked === 1 ? "" : "s"} being watched`),
      button(resetArmed ? "Click again to reset" : "Reset learning", "dsa-reset", () => {
        if (!resetArmed) { resetArmed = true; renderPanel(); setTimeout(() => { resetArmed = false; renderPanel(); }, 4000); return; }
        resetArmed = false;
        const votesKept = memory.votes, namesKept = memory.names;
        memory = MEMORY.emptyMemory();
        memory.votes = votesKept; memory.names = namesKept;
        refreshLearned();
        storeSet(KEY_MEMORY, memory);
        if (enabled) apply();
        renderPanel();
      })));
  }

  // A small bubbling flask on the price-scan button: the feature is experimental. Drawn in the text
  // colour (works in dark mode); built node by node, no innerHTML.
  function flaskIcon() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
    const icon = svg("svg", { class: "dsa-flask", viewBox: "0 -6 16 24", width: "14", height: "21", "aria-hidden": "true", focusable: "false" });
    icon.append(
      svg("path", { class: "dsa-flask-liquid", d: "M4.6 11 H11.4 L13.1 14.7 A1.1 1.1 0 0 1 12.1 16.3 H3.9 A1.1 1.1 0 0 1 2.9 14.7 Z" }),
      svg("path", { class: "dsa-flask-glass", d: "M5.5 1 H10.5 M6.8 1 V6.2 L2.4 14.6 A1.6 1.6 0 0 0 3.8 17 H12.2 A1.6 1.6 0 0 0 13.6 14.6 L9.2 6.2 V1" }),
      svg("circle", { class: "dsa-bub dsa-bub1", cx: "6.6", cy: "14.2", r: "0.9" }),
      svg("circle", { class: "dsa-bub dsa-bub2", cx: "9.4", cy: "13.4", r: "0.7" }),
      svg("circle", { class: "dsa-bub dsa-bub3", cx: "8", cy: "4", r: "0.7" }));
    const wrap = el("span", { class: "dsa-flask-wrap", title: "Experimental" });
    wrap.append(icon);
    return wrap;
  }

  function buildToggle() {
    const input = el("input", { type: "checkbox", role: "switch", class: "dsa-main" });
    input.checked = enabled;
    input.addEventListener("change", () => {
      enabled = input.checked;
      wrap.classList.toggle("dsa-off", !enabled);
      storeSet(KEY_ENABLED, enabled);
      if (enabled) { installSortOption(); installMobileSort(); apply(); } else { removeSortOption(); removeMobileSort(); restore(); }
      updateScanButton();
    });
    const wrap = el("div", { id: "dsa-toggle" },
      // At the very top, only when there's a newer version: a link to install it, and a ✕ to put it away.
      el("div", { class: "dsa-update", hidden: "" },
        el("a", { href: UPDATE_URL, target: "_blank", rel: "noopener" }, "New version available"),
        el("sup", {}, el("button", { type: "button", class: "dsa-update-x", "aria-label": "Dismiss the new-version notice", on: { click: dismissUpdate } }, "✕"))),
      // Desktop: the a+ logo in the top-right corner, no taller than the title line, the version under it.
      el("img", { class: "dsa-side-logo", src: globalThis.DSA_LOGO || "", alt: "" }),
      VERSION ? el("span", { class: "dsa-version", "aria-hidden": "true" }, "v" + VERSION) : "",
      el("label", { class: "dsa-switch" },
        input,
        el("span", { class: "dsa-track" }, el("span", { class: "dsa-thumb" })),
        el("span", { class: "dsa-label" }, "AmazonPlus")),
      // Below the switch: a left column (the Prime and eco buttons; on desktop the a+ logo at its
      // bottom) beside the main column (status, Brands, the price scan). Phones: one column.
      el("div", { class: "dsa-body" },
        el("div", { class: "dsa-side" },
          // Two preferences, both off to start: Prime (which delivery line and prices the cards show) and
          // eco (sustainability badges shown or hidden). Off looks pressed in, on stands out.
          el("div", { class: "dsa-prefs" },
            el("button", { type: "button", class: "dsa-pref dsa-pref-prime", "aria-pressed": "false", on: { click: e => { e.preventDefault(); setPrefs(!hasPrime, showEco, true); } } },
              el("img", { class: "dsa-pref-icon", alt: "" }), el("span", { class: "dsa-pref-text" })),
            el("button", { type: "button", class: "dsa-pref dsa-pref-eco", "aria-pressed": "false", on: { click: e => { e.preventDefault(); setPrefs(hasPrime, !showEco, true); } } },
              el("img", { class: "dsa-pref-icon", src: globalThis.DSA_LEAF || "", alt: "" }), el("span", { class: "dsa-pref-text" }))),
          ),
        el("div", { class: "dsa-col-main" },
      el("div", { class: "dsa-status" }, "Off"),
      el("div", { class: "dsa-legend", "aria-hidden": "true" }, el("span")),
      el("button", {
        type: "button", class: "dsa-manage",
        on: { click: e => { e.preventDefault(); panelOpen = !panelOpen; renderPanel(); } }
      }, ""),
      el("div", { class: "dsa-panel", hidden: "" }),
      // The price scan, below Brands: a one-line title ("▾ Scan off-Amazon prices", flask in the
      // corner: experimental), then the radar (grey and still; green and sweeping while scanning)
      // with today's count and what the scan is doing. Tapping the box starts or stops a scan; the
      // caret (like Brands') folds it to its title, and a tap on the folded box opens it again
      // rather than starting a scan.
      el("div", { class: "dsa-scanbox", hidden: "" },
        el("div", { class: "dsa-scan", role: "button", tabindex: "0", on: { click: onScanBox, keydown: e => { if (e.key === "Enter" || e.key === " ") onScanBox(e); } } },
          el("div", { class: "dsa-scan-head" },
            el("button", { type: "button", class: "dsa-scan-caret", "aria-label": "Show or hide the price scan" }, "▾"),
            el("span", { class: "dsa-scan-title" }, "Scan off-Amazon prices")),
          el("div", { class: "dsa-scan-body" },
            el("img", { class: "dsa-radar", src: globalThis.DSA_RADAR_IDLE || "", alt: "" }),
            el("span", { class: "dsa-scan-label" }),
            el("span", { class: "dsa-scan-note" })),
          flaskIcon())))),
      // Phones: while the box floats it shrinks to this logo; a tap opens it again.
      el("button", { type: "button", class: "dsa-logo", "aria-label": "Open AmazonPlus" },
        el("img", { src: globalThis.DSA_LOGO || "", alt: "AmazonPlus", draggable: "false",
          // If the page won't show embedded images, a text "a+" mark stands in.
          on: { error: e => e.target.replaceWith(el("span", { class: "dsa-logo-text" }, "a", el("b", {}, "+"))) } })));
    wrap.classList.toggle("dsa-off", !enabled);      // the logo shows in grey while AmazonPlus is off
    const showUpdate = updateWanted();
    wrap.querySelector(".dsa-update").hidden = !showUpdate;
    wrap.classList.toggle("dsa-has-update", showUpdate);
    return wrap;
  }

  function placeToggle() {
    if (document.getElementById("dsa-toggle")) return;
    if (!document.querySelector(CARD_SEL) || isMediaSearch()) return;
    const toggle = buildToggle();
    const sidebar = document.querySelector("#s-refinements, #s-filters-content");
    if (sidebar) {
      sidebar.prepend(toggle);
    } else {
      // No left column (narrow window): put it above the results instead.
      toggle.classList.add("dsa-inline");
      const slot = document.querySelector(CARD_SEL).parentElement;
      slot.parentElement.insertBefore(toggle, slot);
    }
    updateStatus(null);
    setPrefs(hasPrime, showEco, false);
    requestAnimationFrame(fitScanTitle);
    updateScanButton();
    floatToggle(toggle);
  }

  // Keep the AmazonPlus box in view: once its place in the column scrolls off the top of the
  // window, it floats at the top of the window over the filter column (same position and width),
  // and settles back into place when you scroll up again.
  function floatToggle(toggle) {
    const spot = el("div", { class: "dsa-spot" });
    toggle.parentElement.insertBefore(spot, toggle);
    // Amazon shows a sticky search bar at the top of the window when you scroll back up; the box
    // sits just below it instead of covering it.
    const headerBottom = x => {
      let bottom = 0;
      for (const n of document.elementsFromPoint ? document.elementsFromPoint(x, 2) : []) {
        if (n === toggle || toggle.contains(n) || n === document.documentElement || n === document.body) continue;
        for (let e = n; e && e !== document.body; e = e.parentElement) {
          const pos = getComputedStyle(e).position;
          if (pos === "fixed" || pos === "sticky") {
            const r = e.getBoundingClientRect();
            if (r.top <= 2 && r.height < innerHeight / 3) bottom = Math.max(bottom, r.bottom);
            break;
          }
        }
      }
      return bottom;
    };
    // On phones (no left column, the box sits above the results) the floating box would cover a
    // third of the screen, so it shrinks to the logo; tapping the logo opens the full box, and
    // tapping elsewhere or scrolling on shrinks it again.
    let expanded = false;
    const mini = () => {
      const want = toggle.classList.contains("dsa-float") && toggle.classList.contains("dsa-inline") && !expanded;
      // The logo is as wide as the on/off switch (measured while the switch is still showing).
      const track = toggle.querySelector(".dsa-track");
      if (want && !toggle.classList.contains("dsa-mini") && track && track.offsetWidth) toggle.style.setProperty("--dsa-logo-w", track.offsetWidth + "px");
      toggle.classList.toggle("dsa-mini", want);
    };
    toggle.querySelector(".dsa-logo").addEventListener("click", e => {
      e.preventDefault();
      if (e.currentTarget.dataset.dragged) return;             // the end of a drag
      if (!toggle.classList.contains("dsa-float")) return;     // in its place, the logo is just a logo
      expanded = !expanded;                                     // opens the box; tapped again, closes it
      mini(); place();
    });
    document.addEventListener("click", e => {
      if (!expanded || toggle.contains(e.target)) return;
      expanded = false; mini(); place();
    }, true);
    const inlineNow = () => toggle.classList.contains("dsa-inline");
    // Dragged somewhere: desktop, the whole box (it then stays put in the window, page scrolling
    // under it, and gives its place in the left column back); phones, the floating box by its logo.
    const pin = () => inlineNow() ? logoAt : panelAt;
    const place = () => {
      if (!toggle.classList.contains("dsa-float")) return;
      const r = spot.getBoundingClientRect();
      // Phones: as far from the left edge of the screen as from the top (8px).
      const inline = inlineNow(), at = pin();
      let left = inline ? Math.max(r.left, 8) : r.left;
      if (at) left = at.x;
      // Phones: as narrow as its contents allow (styles.css), never past the right edge.
      if (inline) { toggle.style.width = ""; toggle.style.maxWidth = Math.min(360, innerWidth - 16) + "px"; }
      else toggle.style.width = r.width + "px";
      const hb = Math.round(headerBottom(r.left + r.width / 2));
      let top = hb + 8;
      if (at) {
        // Keep what can be seen (the logo alone, when shrunk) inside the window.
        const logo = toggle.querySelector(".dsa-logo");
        const shrunk = toggle.classList.contains("dsa-mini") && logo;
        const box = { ox: shrunk ? logo.offsetLeft : 0, oy: shrunk ? logo.offsetTop : 0,
                      w: shrunk ? logo.offsetWidth : toggle.offsetWidth, h: shrunk ? logo.offsetHeight : Math.min(toggle.offsetHeight, 160) };
        left = Math.min(Math.max(at.x, 4 - box.ox), innerWidth - box.ox - box.w - 4);
        top = Math.min(Math.max(at.y, hb + 4 - box.oy), innerHeight - box.oy - box.h - 4);
      }
      toggle.style.left = left + "px";
      if (inline && !at) toggle.style.maxWidth = Math.min(360, innerWidth - left - 8) + "px";
      toggle.style.top = top + "px";
      // Scrolls inside only when it's taller than the room left (e.g. the brand list is open).
      toggle.style.maxHeight = (innerHeight - top - 8) + "px";
      toggle.classList.toggle("dsa-float-tall", toggle.scrollHeight > innerHeight - top - 8);
    };
    // Float or dock, from where the box's place in the page is. The floating box (or its logo)
    // gives way to the box itself as soon as any of that place scrolls back into view, and it
    // floats again only once the place is 8px clear above the window: the band between keeps the
    // two from taking turns (they flickered on phones when scrolling up).
    // `expanded` is the user's choice: once they've reopened the shrunk box with the logo, it stays
    // open while they scroll (also after it docks and floats again) until they close it.
    const dock = () => {
      toggle.classList.remove("dsa-float", "dsa-float-tall", "dsa-mini");
      toggle.style.left = toggle.style.width = toggle.style.top = toggle.style.maxHeight = toggle.style.maxWidth = "";
      spot.style.height = "";
    };
    const float = () => {
      // Hold the box's place exactly, margins included: if the content below moves even a few
      // pixels, the browser shifts the scroll position to compensate (scroll anchoring), the
      // place comes back into view, the box docks, and it flickers on and off.
      const below = toggle.nextElementSibling || toggle.parentElement;
      // Page coordinates, not window ones: the browser may adjust the scroll position mid-measurement.
      const edge = () => (below === toggle.parentElement ? below.getBoundingClientRect().bottom : below.getBoundingClientRect().top) + window.scrollY;
      const before = edge(), height = toggle.offsetHeight;
      spot.style.height = height + "px";
      toggle.classList.add("dsa-float");
      const shift = before - edge();
      if (Math.abs(shift) > 0.5) spot.style.height = (height + shift) + "px";
      if (!inlineNow() && panelAt) spot.style.height = "0px";     // dragged away: the left column closes up
      mini();
      place();
    };
    const placeBottom = () => {
      const top = spot.getBoundingClientRect().top;
      if (toggle.classList.contains("dsa-float")) return top + spot.offsetHeight;
      const cs = getComputedStyle(toggle);
      return top + toggle.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    };
    const check = () => {
      if (!inlineNow() && panelAt) { if (!toggle.classList.contains("dsa-float")) float(); else place(); return; }
      const floating = toggle.classList.contains("dsa-float"), bottom = placeBottom();
      if (floating && bottom > 0) dock();
      else if (!floating && bottom < -8) float();
      else if (floating) place();
    };
    check();
    window.addEventListener("resize", () => { check(); place(); fitStatus(); }, { passive: true });
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; check(); });
    }, { passive: true });
    // Desktop: drag the box by any part that isn't a control; double-click it to put it back in its place.
    const controls = "input, button, a, label, select, textarea, summary, details, .dsa-scan, .dsa-pref, .dsa-switch, .dsa-update";
    draggable(toggle, {
      can: e => !inlineNow() && !e.target.closest(controls),
      start: () => { const b = toggle.getBoundingClientRect(); return { x: b.left, y: b.top }; },
      move: (x, y) => { panelAt = { x, y }; if (!toggle.classList.contains("dsa-float")) float(); else place(); },
      end: () => { const b = toggle.getBoundingClientRect(); panelAt = { x: Math.round(b.left), y: Math.round(b.top) }; storeSet(KEY_PANEL_AT, panelAt); },
    });
    toggle.addEventListener("dblclick", e => {
      if (inlineNow() || !panelAt || e.target.closest(controls)) return;
      panelAt = null; storeSet(KEY_PANEL_AT, null);
      dock(); check();
    });
    // Phones: drag the floating box by its logo.
    draggable(toggle.querySelector(".dsa-logo"), {
      can: () => inlineNow() && toggle.classList.contains("dsa-float"),
      start: () => { const b = toggle.getBoundingClientRect(); return { x: b.left, y: b.top }; },
      move: (x, y) => { logoAt = { x, y }; place(); },
      end: () => { const b = toggle.getBoundingClientRect(); logoAt = { x: Math.round(b.left), y: Math.round(b.top) }; storeSet(KEY_LOGO_AT, logoAt); },
    });
    // Opening the brand list makes the box taller.
    new MutationObserver(() => requestAnimationFrame(place)).observe(toggle, { attributes: true, subtree: true, attributeFilter: ["hidden", "open"] });
  }

  // ---------- keep up with Amazon's in-page updates ----------

  let pending = null;
  // Waits for Amazon to settle (350 ms without changes), but never more than 800 ms after the first
  // change: Amazon keeps the page busy (lazy images, ads) after swapping in page 2, and a pure
  // "wait for quiet" left new results unrated until you scrolled.
  let firstChangeAt = 0;
  function onMutations() {
    if (applying) return;
    clearTimeout(pending);
    const now = Date.now();
    if (!firstChangeAt) firstChangeAt = now;
    const wait = Math.max(0, Math.min(350, 800 - (now - firstChangeAt)));
    pending = setTimeout(() => {
      firstChangeAt = 0;
      if (isMediaSearch()) { leaveMediaSearch(); return; }
      placeToggle();
      const input = document.querySelector("#dsa-toggle .dsa-main");
      if (input) { input.checked = enabled; input.closest("#dsa-toggle").classList.toggle("dsa-off", !enabled); }
      if (enabled) { installSortOption(); installMobileSort(); }
      if (enabled && cards().some(c => !c.dataset.dsaScored && !isMedia(c))) apply();
      else if (enabled && CFG.hideClutter !== false && removeClutter() !== lastPromoCount) {
        lastPromoCount = promosRemoved;
        updateStatus(lastResults, currentMode(), promosRemoved);
      }
    }, wait);
  }

  // A search that turned into a media search (Amazon swapped the results in place): undo everything.
  function leaveMediaSearch() {
    const t = document.getElementById("dsa-toggle");
    if (!t && !lastResults) return;
    if (lastResults) restore();
    removeSortOption();
    removeMobileSort();
    if (t) t.remove();
    lastResults = null;
  }

  // Clicking anywhere else closes an open badge.
  document.addEventListener("click", e => {
    if (!e.target.closest || !e.target.closest(".dsa-badge")) {
      document.querySelectorAll(".dsa-badge[open]").forEach(b => { b.open = false; });
    }
  });

  // Remember which result you clicked through (left or middle click), so its product page can find
  // the search-results estimate even when Amazon opens another size or colour.
  const noteClick = e => {
    if (!enabled || PRODUCT.isProductPage(location)) return;
    const a = e.target.closest && e.target.closest("a[href]");
    const card = a && a.closest(CARD_SEL);
    if (!card || !card.dataset.asin || a.closest(".dsa-badge, .dsa-found")) return;
    lastClick = { a: card.dataset.asin, at: Date.now() };
    storeSet(KEY_LAST_CLICK, lastClick);
  };
  document.addEventListener("click", noteClick, true);
  document.addEventListener("auxclick", noteClick, true);

  // Amazon switching between light and dark while the page is open.
  try {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => setTimeout(() => {
      if (!enabled) return;
      if (PRODUCT.isProductPage(location)) runProductPage(false); else apply();
    }, 300));
  } catch (e) { /* old browsers */ }

  const INFO = typeof GM_info !== "undefined" ? GM_info : typeof GM !== "undefined" && GM && GM.info ? GM.info : null;
  console.info("[AmazonPlus] running on this page (v" + ((INFO && INFO.script && INFO.script.version) || "add-on") +
    (INFO ? ", " + (INFO.scriptHandler || "userscript manager") + (INFO.injectInto ? ", " + INFO.injectInto + " mode" : "") : "") + ")");
  // v0.1 kept the on/off flag in amazon.com's own localStorage, where Amazon's scripts can see it.
  // Move it into the script's private storage and delete it from the site.
  async function migrateOldSettings() {
    if (!hasExtStorage && !hasGM && !GM4) return;
    try {
      const old = localStorage.getItem(KEY_ENABLED);
      if (old !== null) {
        if ((await storeGet(KEY_ENABLED, undefined)) === undefined) storeSet(KEY_ENABLED, old === "1" || old === "true");
        localStorage.removeItem(KEY_ENABLED);
      }
    } catch (e) { /* site storage blocked — nothing to clean */ }
    if ((await storeGet(KEY_OLD_UNIT_SORT, false)) === true && (await storeGet(KEY_SORT, undefined)) === undefined) {
      storeSet(KEY_SORT, "unit");
    }
    storeSet(KEY_OLD_UNIT_SORT, false);
    for (const old of ["dsaPrices", "dsaPrices2", "dsaPrices3", "dsaPricePause"]) if ((await storeGet(old, null)) !== null) storeSet(old, null);   // v0.8.0–0.8.5 Google price checks
  }

  migrateOldSettings().then(() => Promise.all([storeGet(KEY_ENABLED, false), storeGet(KEY_MEMORY, null),
    storeGet(KEY_SORT, null), storeGet(KEY_FEATURED_FOR, ""), storeGet(KEY_LISTINGS, {}), storeGet(KEY_LAST_CLICK, null), storeGet(KEY_PRICES, {}), storeGet(KEY_PRICE_USAGE, null), storeGet(KEY_SCAN_FOLD, false), storeGet(KEY_SCAN_FOLD_VER, ""), storeGet(KEY_PRIME, false), storeGet(KEY_ECO, false), storeGet(KEY_UPDATE, null), storeGet(KEY_PDP_TIDY, true), storeGet(KEY_PDP_BUG, null), storeGet(KEY_PANEL_AT, null), storeGet(KEY_LOGO_AT, null)]))
    .then(([on, mem, choice, featured, seen, clicked, priceCache, use, fold, foldVer, prime, eco, upd, pdp, bugAt, pAt, lAt]) => {
    const okAt = a => a && Number.isFinite(a.x) && Number.isFinite(a.y) ? a : null;
    panelAt = okAt(pAt); logoAt = okAt(lAt);
    pdpTidy = pdp !== false;
    pdpBugAt = bugAt && Number.isFinite(bugAt.x) && Number.isFinite(bugAt.y) ? bugAt : null;
    if (upd && typeof upd === "object") update = Object.assign(update, upd);
    hasPrime = prime === true; showEco = eco === true;
    // The scan box starts folded after each install or update; opening or folding it is then kept.
    scanFold = foldVer === VERSION ? fold === true : true;
    prices = priceCache && typeof priceCache === "object" ? priceCache : {};
    if (use && typeof use === "object") usage = Object.assign(usage, use);
    lastClick = clicked && typeof clicked === "object" ? clicked : null;
    enabled = !!on;
    sortChoice = choice === "trust" || choice === "unit" ? choice : null;
    featuredFor = typeof featured === "string" ? featured : "";
    memory = MEMORY.sanitize(mem);
    listings = seen && typeof seen === "object" ? seen : {};
    refreshLearned();
    if (isCartPage(location)) {
      // The cart redraws itself (quantities, saved for later): mark the offers again after each change.
      let timer = null;
      new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(tidyCart, 400); })
        .observe(document.body, { childList: true, subtree: true });
      tidyCart();
      return;
    }
    if (PRODUCT.isProductPage(location)) {
      // Picking another colour or size swaps the product in place (new ASIN in the address, no reload).
      let lastPath = location.pathname;
      let timer = null;
      new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const panelGone = enabled && !document.getElementById("dsa-product");
          if (location.pathname !== lastPath || panelGone) { lastPath = location.pathname; runProductPage(false); }
          else tidyProductPage();     // delivery lines and sign-up boxes arrive late, and change with the variant
        }, 600);
      }).observe(document.body, { childList: true, subtree: true });
      runProductPage(false);
      return;
    }
    if (!isMediaSearch()) {
      placeToggle();
      if (enabled) { installSortOption(); apply(); }
    }
    new MutationObserver(onMutations).observe(document.body, { childList: true, subtree: true });
  });
})();
