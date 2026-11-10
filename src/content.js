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

  function runProductPage(reopen) {
    const old = document.getElementById("dsa-product");
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

  function priceAvailable() { return !!(PC.enabled && canFetch && PRICECHECK); }

  function gmGet(url) {
    return new Promise(resolve => {
      xhr({
        method: "GET", url, timeout: 20000, headers: { Accept: "application/json" },
        onload: r => resolve({ status: r.status, headers: r.responseHeaders || "", text: r.responseText || "" }),
        onerror: () => resolve({ status: 0, headers: "", text: "" }),
        ontimeout: () => resolve({ status: 0, headers: "", text: "" })
      });
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
    label.textContent = (scanOn ? "Stop scanning for off-Amazon prices" : "Scan for off-Amazon prices") + `: ${Math.min(u.used, cap)}/${cap} used so far today`;
    btn.setAttribute("aria-pressed", scanOn ? "true" : "false");
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
        noteUsage(res);
        if (res.status === 429 && /TOO_FAST/i.test(res.text)) {   // too many in a short burst: wait and retry once
          await new Promise(r => setTimeout(r, 31000));
          res = await gmGet(PRICECHECK.searchUrl(q));
          noteUsage(res);
        }
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

  function cards() { return [...document.querySelectorAll(CARD_SEL)].filter(c => c.dataset.asin); }

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
      updateStatus(results, mode, hidden);
    } finally {
      applying = false;
      reopenAsin = null;
    }
  }

  // Tile view: the results grid becomes rows of cards (styles.css, html.dsa-tiles), whatever layout
  // Amazon chose for the search. Off again when AmazonPlus is switched off.
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
      if (media) extras.push(`${media} book${media === 1 ? "" : "s"}/media not rated`);
      if (hidden) extras.push(`${hidden} promo${hidden === 1 ? "" : "s"} removed`);
      if (mode === "amazon") extras.push("Amazon's order");
      if (mode === "unit") extras.push("ordered by $/count");
      status.textContent = `${visible.length} rated · ${tiers[5] + tiers[4]} trusted · ${tiers[1]} junk` +
        (extras.length ? " · " + extras.join(" · ") : "");
    }
    updateManageLabel();
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
      el("label", { class: "dsa-switch" },
        input,
        el("span", { class: "dsa-track" }, el("span", { class: "dsa-thumb" })),
        el("span", { class: "dsa-label" }, "AmazonPlus")),
      el("div", { class: "dsa-status" }, "Off"),
      el("div", { class: "dsa-legend", "aria-hidden": "true" }, el("span")),
      el("div", { class: "dsa-scanbox", hidden: "" },
        el("button", { type: "button", class: "dsa-scan", on: { click: e => { e.preventDefault(); scanPrices(); } } },
          flaskIcon(), el("span", { class: "dsa-scan-label" }, "Scan for off-Amazon prices")),
        el("div", { class: "dsa-scan-note" })),
      el("button", {
        type: "button", class: "dsa-manage",
        on: { click: e => { e.preventDefault(); panelOpen = !panelOpen; renderPanel(); } }
      }, ""),
      el("div", { class: "dsa-panel", hidden: "" }),
      // Phones: while the box floats it shrinks to this logo; a tap opens it again.
      el("button", { type: "button", class: "dsa-logo", "aria-label": "Open AmazonPlus" },
        el("img", { src: globalThis.DSA_LOGO || "", alt: "AmazonPlus",
          // If the page won't show embedded images, a text "a+" mark stands in.
          on: { error: e => e.target.replaceWith(el("span", { class: "dsa-logo-text" }, "a", el("b", {}, "+"))) } })));
    wrap.classList.toggle("dsa-off", !enabled);      // the logo shows in grey while AmazonPlus is off
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
    updateScanButton();
    floatToggle(toggle);
  }

  // Keep the AmazonPlus box in view: once its place in the column scrolls off the top of the
  // window, it floats at the top of the window over the filter column (same position and width),
  // and settles back into place when you scroll up again.
  function floatToggle(toggle) {
    if (typeof IntersectionObserver !== "function") return;
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
    let expanded = false, expandedAt = 0;
    const mini = () => {
      const want = toggle.classList.contains("dsa-float") && toggle.classList.contains("dsa-inline") && !expanded;
      // The logo is as wide as the on/off switch (measured while the switch is still showing).
      const track = toggle.querySelector(".dsa-track");
      if (want && !toggle.classList.contains("dsa-mini") && track && track.offsetWidth) toggle.style.setProperty("--dsa-logo-w", track.offsetWidth + "px");
      toggle.classList.toggle("dsa-mini", want);
    };
    toggle.querySelector(".dsa-logo").addEventListener("click", e => {
      e.preventDefault();
      expanded = true; expandedAt = window.scrollY;
      mini(); place();
    });
    document.addEventListener("click", e => {
      if (!expanded || toggle.contains(e.target)) return;
      expanded = false; mini(); place();
    }, true);
    const place = () => {
      if (!toggle.classList.contains("dsa-float")) return;
      if (expanded && Math.abs(window.scrollY - expandedAt) > 150) { expanded = false; mini(); }
      const r = spot.getBoundingClientRect();
      toggle.style.left = r.left + "px";
      toggle.style.width = r.width + "px";
      const top = Math.round(headerBottom(r.left + r.width / 2)) + 8;
      toggle.style.top = top + "px";
      // Scrolls inside only when it's taller than the room left (e.g. the brand list is open).
      toggle.style.maxHeight = (innerHeight - top - 8) + "px";
      toggle.classList.toggle("dsa-float-tall", toggle.scrollHeight > innerHeight - top - 8);
    };
    new IntersectionObserver(([e]) => {
      const off = !e.isIntersecting && e.boundingClientRect.top < 0;
      if (off === toggle.classList.contains("dsa-float")) return;
      if (off) {
        expanded = false;
        // Hold the box's place exactly, margins included: if the content below moves even a few
        // pixels, the browser shifts the scroll position to compensate (scroll anchoring), the
        // place comes back into view, the box docks, and it flickers on and off (seen on phones,
        // where the box sits in the results column).
        const below = toggle.nextElementSibling || toggle.parentElement;
        // Page coordinates, not window ones: the browser may adjust the scroll position mid-measurement.
        const edge = () => (below === toggle.parentElement ? below.getBoundingClientRect().bottom : below.getBoundingClientRect().top) + window.scrollY;
        const before = edge(), height = toggle.offsetHeight;
        spot.style.height = height + "px";
        toggle.classList.add("dsa-float");
        const shift = before - edge();
        if (Math.abs(shift) > 0.5) spot.style.height = (height + shift) + "px";
        mini();
        place();
      } else {
        expanded = false;
        toggle.classList.remove("dsa-float", "dsa-float-tall", "dsa-mini");
        toggle.style.left = toggle.style.width = toggle.style.top = toggle.style.maxHeight = "";
        spot.style.height = "";
      }
    }, { threshold: 0 }).observe(spot);
    window.addEventListener("resize", place, { passive: true });
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking || !toggle.classList.contains("dsa-float")) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; place(); });
    }, { passive: true });
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
    storeGet(KEY_SORT, null), storeGet(KEY_FEATURED_FOR, ""), storeGet(KEY_LISTINGS, {}), storeGet(KEY_LAST_CLICK, null), storeGet(KEY_PRICES, {}), storeGet(KEY_PRICE_USAGE, null)]))
    .then(([on, mem, choice, featured, seen, clicked, priceCache, use]) => {
    prices = priceCache && typeof priceCache === "object" ? priceCache : {};
    if (use && typeof use === "object") usage = Object.assign(usage, use);
    lastClick = clicked && typeof clicked === "object" ? clicked : null;
    enabled = !!on;
    sortChoice = choice === "trust" || choice === "unit" ? choice : null;
    featuredFor = typeof featured === "string" ? featured : "";
    memory = MEMORY.sanitize(mem);
    listings = seen && typeof seen === "object" ? seen : {};
    refreshLearned();
    if (PRODUCT.isProductPage(location)) {
      // Picking another colour or size swaps the product in place (new ASIN in the address, no reload).
      let lastPath = location.pathname;
      let timer = null;
      new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const panelGone = enabled && !document.getElementById("dsa-product");
          if (location.pathname !== lastPath || panelGone) { lastPath = location.pathname; runProductPage(false); }
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
