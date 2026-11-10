// ==UserScript==
// @name         AmazonPlus
// @namespace    disenshittify-amazon
// @version      0.10.6
// @description  Rates Amazon search results by trustworthiness, tints them green to red, and sorts the junk to the bottom.
// @match        https://www.amazon.com/s*
// @match        https://amazon.com/s*
// @match        https://www.amazon.com/dp/*
// @match        https://www.amazon.com/*/dp/*
// @match        https://www.amazon.com/gp/product/*
// @match        https://amazon.com/dp/*
// @match        https://amazon.com/*/dp/*
// @match        https://amazon.com/gp/product/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @connect      api.upcitemdb.com
// @inject-into  content
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  const style = document.createElement("style");
  style.id = "dsa-styles";
  style.textContent = "/* AmazonPlus \u2014 injected styles. Everything is prefixed dsa- to stay out of Amazon's way. */\n\n/* ---------- toggle ---------- */\n#dsa-toggle {\n  box-sizing: border-box;\n  margin: 0 0 14px;\n  padding: 10px 12px;\n  border: 2px solid #8bc34a;\n  border-radius: 10px;\n  background: #fbfdf7;\n  font-family: \"Amazon Ember\", Arial, sans-serif;\n  color: #0f1111;\n}\n#dsa-toggle.dsa-inline { max-width: 360px; margin: 8px 0 12px; }\n/* Floating at the top of the window once its place in the column has scrolled away */\n#dsa-toggle.dsa-float {\n  position: fixed;\n  top: 8px;\n  z-index: 300;\n  margin: 0;\n  max-height: calc(100vh - 16px);\n  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);\n}\n#dsa-toggle.dsa-float.dsa-float-tall { overflow-y: auto; }\n\n/* The logo button: only shown while the box is shrunk (phones, while scrolling). */\n#dsa-toggle .dsa-logo { display: none; }\n#dsa-toggle.dsa-mini {\n  width: auto !important;\n  padding: 0;\n  border: 0;\n  background: none;\n  box-shadow: none;\n  overflow: visible;\n}\n#dsa-toggle.dsa-mini > :not(.dsa-logo) { display: none !important; }\n#dsa-toggle.dsa-mini .dsa-logo {\n  display: block;\n  padding: 0;\n  margin: 0;\n  border: 0;\n  background: none;\n  cursor: pointer;\n  line-height: 0;\n}\n#dsa-toggle.dsa-mini .dsa-logo img {\n  display: block;\n  width: var(--dsa-logo-w, 40px);\n  height: auto;\n  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 1px rgba(255, 255, 255, 0.9));\n}\n#dsa-toggle.dsa-mini .dsa-logo-text {\n  display: block;\n  width: var(--dsa-logo-w, 40px);\n  font: 700 30px/1 Arial, sans-serif;\n  color: #2e7d32;\n  text-shadow: 0 0 2px #fff, 0 1px 3px rgba(0, 0, 0, 0.5);\n}\n#dsa-toggle.dsa-mini .dsa-logo-text b { color: #f5a623; font-size: 22px; vertical-align: top; }\n#dsa-toggle.dsa-mini.dsa-off .dsa-logo-text, #dsa-toggle.dsa-mini.dsa-off .dsa-logo-text b { color: #767676; }\n/* AmazonPlus off: the logo in grey. */\n#dsa-toggle.dsa-mini.dsa-off .dsa-logo img {\n  filter: grayscale(1) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 1px rgba(255, 255, 255, 0.9));\n}\n/* The tap target stays a comfortable size even though the logo is small. */\n#dsa-toggle.dsa-mini .dsa-logo { padding: 4px; margin: -4px; }\n\n.dsa-switch {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  cursor: pointer;\n  user-select: none;\n}\n.dsa-switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }\n.dsa-track {\n  position: relative;\n  flex: none;\n  width: 40px;\n  height: 22px;\n  border-radius: 11px;\n  background: #b9bdbd;\n  transition: background 0.15s;\n}\n.dsa-thumb {\n  position: absolute;\n  top: 3px;\n  left: 3px;\n  width: 16px;\n  height: 16px;\n  border-radius: 50%;\n  background: #fff;\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);\n  transition: transform 0.15s;\n}\n.dsa-switch input:checked + .dsa-track { background: #2e7d32; }\n.dsa-switch input:checked + .dsa-track .dsa-thumb { transform: translateX(18px); }\n.dsa-switch input:focus-visible + .dsa-track { outline: 2px solid #007185; outline-offset: 2px; }\n.dsa-label { font-size: 16px; font-weight: 700; }\n.dsa-unit { margin-bottom: 6px; }\n\n.dsa-status { margin: 6px 0 0 50px; font-size: 12px; color: #565959; }\n.dsa-legend { margin: 8px 0 0 50px; }\n.dsa-legend span {\n  display: block;\n  height: 6px;\n  border-radius: 3px;\n  background: linear-gradient(90deg, hsl(120 70% 40%), hsl(60 70% 45%), hsl(0 70% 45%));\n}\n\n/* ---------- rated cards ---------- */\n.dsa-paint {\n  background: var(--dsa-bg) !important;\n  box-shadow: inset 6px 0 0 var(--dsa-edge) !important;\n  border-radius: 8px;\n}\n/* Amazon paints white boxes inside the card; let the tint show through. */\n.dsa-paint .a-section,\n.dsa-paint .s-card-border,\n.dsa-paint .puis-card-border,\n.dsa-paint .s-card-container,\n.dsa-paint .puis-padding-left-small {\n  background: transparent !important;\n}\n/* Keep product photos true to colour: a plain white box behind the image, no blending. */\n.dsa-paint .s-product-image-container {\n  background: #fff !important;\n  border-radius: 6px;\n}\n.dsa-paint .s-image { mix-blend-mode: normal !important; }\n\n.dsa-dupe { display: none !important; }\n\n/* ---------- trust badge: a small pill over the card's top-right corner ---------- */\n.dsa-rated { position: relative; }\n.dsa-rated:has(.dsa-badge[open]) { z-index: 60; }\n.dsa-wide [data-cy=\"title-recipe\"] { padding-right: 130px; }       /* open popover sits above neighbouring cards */\n.dsa-badge {\n  position: absolute;\n  top: 6px;\n  right: 6px;\n  z-index: 30;\n  font: 12px/1.35 \"Amazon Ember\", Arial, sans-serif;\n  color: var(--dsa-ink);\n  text-align: left;\n}\n.dsa-badge > summary {\n  display: inline-block;\n  padding: 2px 8px;\n  border-radius: 11px;\n  background: var(--dsa-pill, var(--dsa-edge));\n  color: #fff;\n  font-weight: 700;\n  white-space: nowrap;\n  cursor: pointer;\n  list-style: none;\n  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);\n}\n.dsa-badge > summary::-webkit-details-marker { display: none; }\n.dsa-badge > summary::marker { content: \"\"; }\n.dsa-badge > summary::after { content: \" \\25BE\"; font-weight: 400; }\n.dsa-badge[open] > summary::after { content: \" \\25B4\"; }\n.dsa-badge .dsa-score { font-weight: 400; opacity: 0.85; }\n.dsa-badge li { margin: 1px 0; white-space: pre-wrap; padding-left: 2.2em; text-indent: -2.2em; }\n.dsa-badge li.dsa-good { color: #1e6b25; }\n.dsa-badge li.dsa-bad { color: #9b1c1c; }\n\n/* ---------- brand buttons (badge + manager) ---------- */\n.dsa-badge-body {\n  position: absolute;\n  top: calc(100% + 4px);\n  right: 0;\n  width: 280px;\n  max-width: 80vw;\n  max-height: 60vh;\n  overflow-y: auto;\n  padding: 10px 12px;\n  border: 1px solid var(--dsa-edge);\n  border-radius: 8px;\n  background: #fff;\n  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);\n}\n\n.dsa-badge .dsa-badge-body ul { margin: 0; padding: 0; list-style: none; background: none; }\n.dsa-brandrow {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 6px;\n  margin-top: 8px;\n  padding-top: 8px;\n  border-top: 1px solid rgba(0, 0, 0, 0.12);\n}\n.dsa-brandname { font-weight: 700; color: #0f1111; margin-right: auto; }\n.dsa-muted { color: #565959; font-size: 12px; }\n.dsa-btn {\n  font: 12px/1 \"Amazon Ember\", Arial, sans-serif;\n  padding: 5px 9px;\n  border: 1px solid #b9bdbd;\n  border-radius: 12px;\n  background: #fff;\n  color: #0f1111;\n  cursor: pointer;\n}\n.dsa-btn:hover { background: #f3f3f3; }\n.dsa-btn.dsa-trust { border-color: #2e7d32; color: #1e6b25; }\n.dsa-btn.dsa-block { border-color: #b71c1c; color: #9b1c1c; }\n.dsa-btn.dsa-on.dsa-trust { background: #2e7d32; color: #fff; }\n.dsa-btn.dsa-on.dsa-block { background: #b71c1c; color: #fff; }\n.dsa-btn.dsa-x { padding: 3px 8px; font-size: 14px; }\n.dsa-btn.dsa-reset { margin-left: auto; }\n\n.dsa-manage {\n  display: block;\n  margin: 8px 0 0 50px;\n  padding: 0;\n  border: 0;\n  background: none;\n  color: #007185;\n  font: 12px \"Amazon Ember\", Arial, sans-serif;\n  cursor: pointer;\n  text-align: left;\n}\n.dsa-manage:hover { text-decoration: underline; }\n.dsa-panel {\n  margin-top: 8px;\n  max-height: 360px;\n  overflow-y: auto;\n  font: 12px/1.4 \"Amazon Ember\", Arial, sans-serif;\n}\n.dsa-panel[hidden] { display: none; }\n.dsa-phead { margin: 8px 0 4px; font-weight: 700; font-size: 12px; }\n.dsa-plist { margin: 0; padding: 0; list-style: none; }\n.dsa-pitem {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 4px 6px;\n  padding: 4px 0;\n  border-bottom: 1px solid #eee;\n}\n.dsa-pname { font-weight: 700; margin-right: auto; word-break: break-word; }\n.dsa-ptag { font-size: 11px; padding: 1px 6px; border-radius: 8px; color: #fff; }\n.dsa-ptag.dsa-trust { background: #2e7d32; }\n.dsa-ptag.dsa-block { background: #b71c1c; }\n.dsa-pactions { display: flex; gap: 4px; width: 100%; justify-content: flex-end; }\n.dsa-pitem .dsa-btn { padding: 3px 7px; font-size: 11px; }\n.dsa-pfoot { display: flex; align-items: center; gap: 6px; margin-top: 10px; }\n\n/* ---------- promos / ad blocks between results ---------- */\n.dsa-clutter,\n.dsa-stray-head { display: none !important; }\n\n/* ---------- product page panel ---------- */\n.dsa-checked { font-weight: 700; }\n.dsa-product {\n  margin: 8px 0 10px;\n  padding: 8px 12px 8px 14px;\n  border-radius: 8px;\n  background: var(--dsa-bg);\n  box-shadow: inset 6px 0 0 var(--dsa-edge);\n  font: 13px/1.4 \"Amazon Ember\", Arial, sans-serif;\n  color: #0f1111;\n}\n.dsa-ph-head { display: flex; align-items: center; gap: 8px; }\n.dsa-ph-pill {\n  padding: 2px 9px;\n  border-radius: 11px;\n  background: var(--dsa-pill, var(--dsa-edge));\n  color: #fff;\n  font-weight: 700;\n}\n.dsa-ph-title { font-weight: 700; color: var(--dsa-ink); margin-left: auto; }\n.dsa-ph-delta { font-weight: 700; font-size: 15px; cursor: help; }\n.dsa-ph-delta.dsa-up { color: #1e6b25; }\n.dsa-ph-delta.dsa-down { color: #9b1c1c; }\n.dsa-ph-delta.dsa-same { color: #565959; }\n.dsa-ph-compare { margin-top: 6px; }\n.dsa-delta { font-weight: 700; padding: 1px 6px; border-radius: 8px; }\n.dsa-delta.dsa-up { color: #1e6b25; background: rgba(46, 125, 50, 0.12); }\n.dsa-delta.dsa-down { color: #9b1c1c; background: rgba(183, 28, 28, 0.1); }\n.dsa-delta.dsa-same { color: #565959; background: rgba(0, 0, 0, 0.06); }\n.dsa-ph-details { margin-top: 6px; }\n.dsa-ph-details > summary { cursor: pointer; color: #007185; }\n.dsa-ph-list { margin: 6px 0; padding: 0; list-style: none; }\n.dsa-ph-list li { margin: 1px 0; padding-left: 2.6em; text-indent: -2.6em; }\n.dsa-ph-list li.dsa-good { color: #1e6b25; }\n.dsa-ph-list li.dsa-bad { color: #9b1c1c; }\n.dsa-product-error { --dsa-bg: #f3f3f3; --dsa-edge: #888; --dsa-ink: #565959; }\n\n/* \"Found at MERCHANT for PRICE\" box, to the right of the price */\n.dsa-found {\n  float: right;\n  clear: right;\n  width: 44%;\n  max-width: 220px;\n  margin: 0 0 6px 8px;\n  padding: 6px 8px;\n  border-radius: 6px;\n  background: #00aaff;\n  font: 12px/1.35 \"Amazon Ember\", Arial, sans-serif;\n  position: relative;\n  z-index: 2;\n}\n.dsa-found a { color: #0f1111 !important; text-decoration: none; }\n.dsa-found a:hover { text-decoration: underline; }\n.dsa-found .dsa-found-main { display: block; font-weight: 700; }\n.dsa-found .dsa-found-google { display: block; margin-top: 3px; font-size: 10.5px; text-decoration: underline; }\n\n/* \"Scan for off-Amazon prices\" */\n.dsa-scanbox { margin: 8px 0 0 50px; }\n.dsa-scan {\n  display: block; width: 100%; padding: 5px 8px; border: 1px solid #00aaff; border-radius: 6px;\n  background: #e6f6ff; color: #0f1111; font: 12px/1.3 \"Amazon Ember\", Arial, sans-serif; text-align: left; cursor: pointer;\n}\n.dsa-scan:hover:not(:disabled) { background: #ccecff; }\n.dsa-scan:disabled { cursor: progress; opacity: 0.8; }\n.dsa-scan-note { margin-top: 4px; font-size: 11px; color: #565959; }\n.dsa-scan-note:empty { display: none; }\n\n/* ---------- Amazon's dark mode (html.dsa-dark, set when the page behind the results is dark) ---------- */\n/* Every text colour below is at least 4.5:1 on its background. */\n.dsa-dark #dsa-toggle { background: #1d2421; border-color: #6a9f3a; color: #e3e6e6; }\n.dsa-dark #dsa-toggle.dsa-float:not(.dsa-mini) { box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6); }\n.dsa-dark .dsa-track { background: #5f6363; }\n.dsa-dark .dsa-status,\n.dsa-dark .dsa-scan-note,\n.dsa-dark .dsa-muted { color: #b9bdbd; }\n.dsa-dark .dsa-manage,\n.dsa-dark .dsa-ph-details > summary { color: #4fc3e0; }\n.dsa-dark .dsa-scan { background: #0b3a52; color: #e3e6e6; }\n.dsa-dark .dsa-scan:hover:not(:disabled) { background: #0e4a68; }\n.dsa-dark .dsa-badge-body { background: #22272a; color: #e3e6e6; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6); }\n.dsa-dark .dsa-badge li.dsa-good,\n.dsa-dark .dsa-ph-list li.dsa-good,\n.dsa-dark .dsa-ph-delta.dsa-up,\n.dsa-dark .dsa-delta.dsa-up { color: #86e08f; }\n.dsa-dark .dsa-badge li.dsa-bad,\n.dsa-dark .dsa-ph-list li.dsa-bad,\n.dsa-dark .dsa-ph-delta.dsa-down,\n.dsa-dark .dsa-delta.dsa-down { color: #ff9a8f; }\n.dsa-dark .dsa-ph-delta.dsa-same,\n.dsa-dark .dsa-delta.dsa-same { color: #b9bdbd; }\n.dsa-dark .dsa-brandname { color: #e3e6e6; }\n.dsa-dark .dsa-brandrow { border-top-color: rgba(255, 255, 255, 0.15); }\n.dsa-dark .dsa-pitem { border-bottom-color: #3a4044; }\n.dsa-dark .dsa-btn { background: #2b3134; border-color: #5f6363; color: #e3e6e6; }\n.dsa-dark .dsa-btn:hover { background: #363d41; }\n.dsa-dark .dsa-btn.dsa-trust { border-color: #4caf50; color: #86e08f; }\n.dsa-dark .dsa-btn.dsa-block { border-color: #e57373; color: #ff9a8f; }\n.dsa-dark .dsa-btn.dsa-on.dsa-trust { background: #2e7d32; color: #fff; }\n.dsa-dark .dsa-btn.dsa-on.dsa-block { background: #b71c1c; color: #fff; }\n.dsa-dark .dsa-product { color: #e3e6e6; }\n.dsa-dark .dsa-product-error { --dsa-bg: #2b3134; --dsa-edge: #8a9093; --dsa-ink: #b9bdbd; }\n\n/* ---------- tile view (html.dsa-tiles) ----------\n   Amazon's row-by-row list becomes a grid of cards: each result's picture-left/text-right row is\n   stacked into a column, and everything else in the results area (headings, pagination) spans the\n   full width. Amazon's own tile searches come through unchanged in shape. */\nhtml.dsa-tiles .s-main-slot {\n  display: grid !important;\n  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)) !important;\n  grid-template-rows: none !important;\n  grid-auto-flow: row !important;\n  grid-auto-columns: auto !important;\n  gap: 12px 10px;\n  align-items: stretch;\n  margin: 0 !important;\n}\n@media (max-width: 600px) {\n  html.dsa-tiles .s-main-slot { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)) !important; gap: 8px 6px; }\n}\nhtml.dsa-tiles .s-main-slot > * { grid-column: 1 / -1; min-width: 0; }\nhtml.dsa-tiles .s-main-slot > div[data-component-type=\"s-search-result\"] {\n  grid-column: auto;\n  width: auto !important;\n  max-width: none !important;\n  padding: 0 !important;\n  margin: 0 !important;\n}\nhtml.dsa-tiles .s-main-slot > div[data-component-type=\"s-search-result\"] > .sg-col-inner { height: 100%; padding: 0 !important; margin: 0 !important; }\nhtml.dsa-tiles div[data-component-type=\"s-search-result\"] .s-widget-container,\nhtml.dsa-tiles div[data-component-type=\"s-search-result\"] .s-card-container,\nhtml.dsa-tiles div[data-component-type=\"s-search-result\"] .s-card-container > .a-section { height: 100%; box-sizing: border-box; }\nhtml.dsa-tiles div[data-component-type=\"s-search-result\"] .puisg-row { flex-direction: column; flex-wrap: nowrap; margin: 0 !important; width: 100% !important; }\nhtml.dsa-tiles div[data-component-type=\"s-search-result\"] .puisg-col {\n  width: 100% !important;\n  max-width: 100% !important;\n  min-width: 0 !important;\n  flex: none !important;\n  padding: 0 6px !important;\n  display: block !important;\n}\n/* Every tile's photo gets the same box, and Amazon's \"Best Seller\" / \"Overall Pick\" label sits over\n   its top-left corner instead of above it, so titles and prices line up across a row. */\nhtml.dsa-tiles div[data-component-type=\"s-search-result\"] .puisg-col-inner { position: relative; }\nhtml.dsa-tiles div[data-component-type=\"s-search-result\"] .s-list-status-badge-container,\nhtml.dsa-tiles div[data-component-type=\"s-search-result\"] .puis-status-badge-container {\n  position: absolute !important;\n  top: 4px;\n  left: 0;\n  z-index: 3;\n  width: auto !important;\n  height: auto !important;\n  margin: 0 !important;\n}\nhtml.dsa-tiles div[data-component-type=\"s-search-result\"] .s-product-image-container {\n  height: 206px !important;\n  box-sizing: border-box;\n  overflow: hidden;\n  padding: 26px 0 0 !important;\n}\nhtml.dsa-tiles div[data-component-type=\"s-search-result\"] .s-product-image-container img.s-image {\n  max-height: 180px !important;\n  width: auto !important;\n  max-width: 100% !important;\n  margin: 0 auto;\n  display: block;\n}\nhtml.dsa-tiles div[data-component-type=\"s-search-result\"] h2 { font-size: 14px !important; line-height: 1.35 !important; }\nhtml.dsa-tiles div[data-component-type=\"s-search-result\"] [data-cy=\"title-recipe\"] { padding-right: 0 !important; }\nhtml.dsa-tiles .dsa-found { float: none; width: auto; max-width: none; margin: 4px 0 6px; }\n";
  (document.head || document.documentElement).appendChild(style);
})();

// ---- src/config.js ----
// AmazonPlus \u2014 tunable lists and weights.
// Edit these to adjust how listings are scored. All matching is case-insensitive.

globalThis.DSA_CONFIG = {
  // Hide promo / ad blocks between results (Haul carousels, brand banners, video ads\u2026) while on.
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
    asinVintage: 10,      // listing 10+ years old (ASIN B00\u2026)
    asinOld: 6,           // ~2015\u20132018
    asinRecent: 2,        // ~2018\u20132020
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
    bulletBrackets: -6,     // \u3010BRACKETED\u3011 bullet headings
    bulletFlorid: -4,       // 3+ marketing phrases in the bullets
    bulletServicePush: -4,  // "contact us", "risk-free", "100% satisfaction"\u2026
    bulletObfuscated: -10,  // "baguett-e", "safe-ty"
    bulletWall: -6,         // bullets over 1,800 characters
    bulletLong: -3,         // 1,300\u20131,800
    bulletConcise: 3,       // under 600 characters
    frequentlyReturned: -12
  },

  // When a brand gets learned. "Evidence" is a listing's score with all brand points removed,
  // so a brand's own rating can't feed back into what's learned about it.
  learning: {
    blockMinListings: 2,       // different products from the brand
    blockMinSearches: 2,       // different search terms it showed up in
    blockMaxAvgEvidence: 42,   // average evidence at or below this \u2192 learned junk
    blockFlaggedShare: 0.5,    // \u2026or at least this share of its listings carry serious red flags
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

  // Score \u2192 tier (1\u20135) cutoffs.
  tiers: [76, 60, 42, 24] // >=76 \u2192 5, >=60 \u2192 4, >=42 \u2192 3, >=24 \u2192 2, else 1
};

if (typeof module !== "undefined") module.exports = DSA_CONFIG;

;
// ---- src/logo.js ----
// AmazonPlus logo (the "a+" mark), shown on phones when the box shrinks while you scroll.
// Embedded so the script makes no request to fetch it.
(function (root) {
  root.DSA_LOGO = "data:image/webp;base64,UklGRmgXAABXRUJQVlA4WAoAAAAQAAAAaQAAbwAAQUxQSIUJAAABCQaRJMWpWX6y519wDrAQ0f8J4Cj/KzhJQ+SyfahAMsMGJQ7OklTKUwGUuaBiHyRkl5sKpznhptbkgy/pgAO+T2IoaNtGcvnD3nfHICImgMzI0uEju9dIgqbXP5rVxVfGbdsGcu/2H/ku31jqABETMAGesG0/JMn/v+t+XhGRmZXVpakez7Q+tm3bto2djRWXNla2bfvzGc+0u6tVTgRer2dRVZkRWfXZR8QEZFxRfvEbchekcO9bOdvFE5+EACP+nPxMg6bquSDZiDNfxonRcD/TZgwr5nVZO06SHMfx44SQ3FNronhTfLJzEEGSwBPtB0jeBuSX3Ku9w0WRpIajS888cf7JJzY3V5aHRS6a6nB/Z+vu7ds3rwFk7qkFGyCvm0SQrAG4dPGt3/6tlqe0/HDrpb/5lxf2IPh8WBkRssvv+oFvYxwfHYFOcnAyjr7yL7/+Nw9QOBWmCCvv8rHv/i45EAEJ0aY7jglu/O7PeZQtXPBE8cEf/xEXgORYRufJZfDbH+opaKGCJ97y0z7jLcATJhbVU/jYP/71d4puiwTv+5Ufcw6aIBY88ol/931LKSyM8g/8ho+AxozFD8T+t/7Jm+xqQQIfVOHJxOkM3rzH333mZEFg+72iB3F6Y2CIFuT+M8E51U7Gggbf4pTNbIDmibMYN5rgZ4RPwOM8c169qrOieFOnt1yUM/m/TWcJk7/3s0GsfT5h7crTvZn0mTctnWT8gTgrE+DM6poOmNX4l72QzggDNBMQZ8Ku/hfekp+kRWl1UOee6YTgf8n8Di4xo4NOhy4UXq5mJzh/hM3kII42VdMkNwt5z4DkiyfsSj/VjxcnwP+9oXSCuwFpvLu9M5qWdRPdLOv1lzee3shtAXwe4DEjDbOTwt7fc5wLGG1tPdwp3SWTkOOekmzj4gHyrjRf3jgSJ4s/xwAXHNy4ea9sQjCOOscLPMYXXk1027yx8+gwzab0MatRzJj4i9LcId589c5YmcmdGcWxLuWHd6bd2N7uaHc6m9u7DROzOjf/OaLJay8/SrnhnOzu0ZM7kiwoBVUBtefhfN1vpnEmGDuzZ375YvkvvzpdW8kiJ6bYVHVVN01MEYWs6B+t3/KD6IDVSeHTxmcz5k2283U/e2OZyLEeq3IymZZ1jI6TkOVFf7iyvrHR+4QLvgZD96KczgG4NIP71R/+5f4546g31Xg0GtfRQ8iyPITgILNQDFYee3bzvT5DBRuUveluNZf1ihmAsLo+yIFUjrb3xxVW9Isg5rSsv/bMm/7g+bHmGo6L/XujebxYnYOwfG5ALHcf3N1K+aAItJwN13/sw/dgUHt8uJvmUJFrDlte61W7d+/cezgqjA6z5vu+9bcm+jW9Zr+eo82ix8Obd3cnzvwCCQQia77kR6LYr31o5bQzDnfu7ZTMKUkemfPjfmsUgjX9Xjn1jjRYttE4zmKWEsfm/ZXzj22sLC/3i16W3vzDkrVHQXFuKdC1hDvHmzwBnHvTK5efv/jMU6u5saC558sLMKOJCNnbvO07vcubrRWc6I474BY6cDLC0jBbEBkRLr37h77XhQGARySBWNDg1l8QhQYufNinvNMm0GBCLHhART9fAFmk90Gf/2Hr0EgSp9FQ1s/VWYgsf/aXvAtETJxWOVmvMyMNvvDr3wxPJk635Zl1o8RHfOfbkzBOvRUZXcq58GlvT5RxBlqwLuS8zwcTZZyJFkwduL3zeTDOSFkHYv3NSeL/QafYJBlnqrdFFThLozttu0ZjztJ6VLfmNn0dqgN+RAVnule1Bv/EIrpLLGgsm7acvzowLzkC8GYyKsu6ial5KkYBF+2m8MrfWqLqCMoH2zu7B01MKeFU7xDK+JN07GJ8+9r9SSUzCYFUvY1B+r1/D7ELF7v/d31Pwcxxjlf1tgarvhfRpZp/f2GSBXBOlJ8W/80/sdjJ9l/eyw3nePfoMUafvGsMXnrrDaw91/1DBXeOeqqralpXdZNS/YRBH06Tt6f9PzaOj+VkNJ5OY3RJ1jwbQv8oN9r3vz3g2GZ0sD8qE3le5FlmGW54+jxqzbl6o38klbu3D2Lo9YM4XsnwLon25S/igFd7W7eLvjGrB8Pb0uRtOQf382Omu9uHxpwDw5sh2r9fC4TXVZ2Yd81wuQPnIIGKXnBafN7wRAdQJoh7j0KYK+oL/9GwSdfT7abH3OJTHsXBG6IOCpFGh7nmSuH2t/J58AraF8tGGtV95rOf+78Qlz2feVOl3lxu5U/DSzDuQKxtRq/I54I/2ZeHcBtvDdebR5KYf+u6OcY7XYg3e7YcRp9NwB6n9LUugIMH//jPL5UzKDQ8v4p3JXk7L9Kpk376F16pLTlISon8/Z6je9Hyf8TQBVD+0ve/wsmrn/Q1a6i71v/xAd6NePgbf/Hq1sjOPfNm7/vhT5NE99bWo3/w1A3JoDyo1FsNkBCdCwnUhn5TdO2JwNFGJhZXms//+EFIHQGOI8Simrkk5g9bv4p3t+hBIDQf3HxrdMaYAWL+yL21wnW2ZHLalb9yiTM2GMjacD047Lsu45LUAq4Xl8x5HjuhLaheHNgBc/3Ja3hLIg9OCC3Z7ush6Ksv7NJ+biBrKWnr6uMAufD+0jZqLctcFloiW31qJS2O00w8r/diaMvVc5lZSxRrm1QL4uLwAA823V93tQMDlwW1Zb31jXIHeWeOuLdrIKt2aX+IQnuEpZXlye0aubpwxIOrEwNc1Tbe2rIr5NYaYdAv6us3AEftOILtF+54AEheXnW8HfcjWWhPFmT26P/e6kIODmgGPyLw269en+T4kVje/RsZ7Rqrfc+KoNZAkAw2Ll7YDBx1BySOrbZv3nzU5OYcTeWtF1975813eKtzbUACy7MuIJXjeugx29h84rGlXsbxqSxHDx9s7zWWyTnqcXr44tWH1bn3eq/H1QoZoZd3dXAw7GUhHj68sTTs5ZmRYl1NxhVYBs6x9Xh7tzlE1h+sLod2nNArrBOayf5SP89CyCwldwckmQlwjvU4Ptgeh6GBp2J1OW8HZf1eR56mFvIsM0PM6MyY6sn+/iHLuQA8LA+XWsJD1hGklJInpCLYSSd6qsvR9uHElwpxrDfRh201W2PvCjw2ZVVV6+cGeRZMAtxTaupyvL/78IEtFeLkye6jXltx/17dHaSmnIxW11eHS/0iM+GxqcvJ+GBvb+9gnIlZq/1dtUXT+CJAaqa9fn8w6Bf5MXU9LSfTsmyiM2dqOP2OZCEzM3BPqUkpOaccAFZQOCC8DQAA0DIAnQEqagBwAD5dJI5FI6IhF92vCDgFxLUAZzYVoNvevyg9l60/5n+v8GUZvl59wHzO/0v+u9j/6P/3XuAc7PzE/rV+xvvH+j3+6eoB0ovoNfrd6dfshf3v/rfuB7Wmae/0DtU/wfg34sfembhj3tS+reM7kg8Q9QL1v5sPzfZt2l9AL3F+v99ZqR+FPNb8bTwPqAH5z/5H6ifsr9MH9946Pqf2CP129OH2d+jp+2Sm9XxIK0GaVtQI1xbumveWGiAMTjYI9pEho4SPmpt7whvC690CxPoDMmTxDlrXFxLGZ/v2IiJltJl6gU8rR0JJzR2+yqGhkSkFRln5kLGe2LmDygRYDiI6Y38eH88OzRyLnybPtvIFD+4hGDFc/WY3Au3rqFuUeWC3W/xIkim234aqfeenjxcr8tNFQOiPYRi0pvA+F7Yxzkg/VEGpzWieL/ZzuoAVOxrYcRItQkRrj4Fu7LZUQqowXCxwlBlqLvdw6bXJ5DhRyR7Z8w3nIuVnAzrfnevhC2Er5zTjen9pYvRyn2T8hWp+nsz7Cj7ZBAD+8J7/LaEOQPry5UmWLlR8sHuyfvKYc27/+X6pLkhnrEjxaPRYOCc9MKOXOxnJ8RR+RUBQbFC4T1hBy3SxtMw1d17vysZB7zAFNxGDWbOqJvi6THoBN6EilnclVyUxqNJFdaPjyb4SiWTmm2gtzfhMpWDQU0qKebhyOneAfbi/9G5bbKFLlHxmJJu6p6L2Zj+1ke6oXGuk0qiU+Ztlfswc59MfLZGqFZaS09K7A1tVZuZcIz+xNPs2vN8/JMooiwXXJnql0L34yDj+XPdLJFLoXkhiWSqsAQW4ZkTivjJKnRrLeGCf2Knsf4Ij1BnCOcVz7g0ZXckCyEAL0HgkmNUO6jQzzZLzk4Y4cs3Rbotv27S2AvLdxuhYSrNVVU2uqj3uOinY8UOL010zxYh8WBlojxe+mgY//8ODGpoJGYRDH/B/+/MSzvl3KVz/yF8EN0TPbhdHW4sovthivNP/Kz6HHn5pVj3rsNJAfBe6jf50D9+X34GfqKKatdm/wY6v1+Pzv+9St/BrCAApI40MbhYk/4nZZyvo2TX4l6y6pXheR0YHcjOXcDoXL946ryMxMLH/550D2Qk9gtsYneJyqs6hezgDZE8k7o6/LRrX4XT75yetWwUwsouD7iGv9qm5kDUIIYVh9O6uNwcTeBJaCvdNY6mXJ4rVgWMQGwSTHdGoQovrarGL3Nw+ZoWT/Gms5ps+M2CFA1ZKSGFZhyOoAGgF8k1G2EPlpA/9E18x37xwGZExyWFguy1ap7qTxG1bPB0nrdE+BxmZWeYhOh0ZKVObQBaYfV8GNMbhsHRJgZLcrSt6L8auB7j5yHtkTyeMtaVcWFrdI17F0pp0a+c4Z/ICE/eh/3iNpBj+mmEdruCTnAESkoAJxy4CL3MNQJ21Ns1Ad/5e/MCDT1hwkKCGLZM5jPqW09JLO9+XqmoVGDcMkQp6EIDS6z1vcINvtO2qM11XHEz90MLwdtjAm2aipGpeyWYavFZLJvOkvvwstvr0jd2Hr/enMBjl/OQDFKVv1v0geWh7+H9sdAcsEoYEGcOod/lxZZDLjkGeOu9xS86bfo1seZWNXmhD+/wTQP5g3YDeeHucLkKKx000LpN+Q0fT+SfGUqZLlphRXKe4kyJKz/7h9c6Y3fQpPoGaxJQtxs9rfAZqi11VfoXj4NVnq+GfbYMOi6PyqVyPGnXggmV6IChJdeTPlJP6NhvPxrUTf3d3mmZPn4tfjTTn/SJfb/P/xLmk37bNmiL+je86kY3xWdlKhPr2CyEiOv69hh3IcQ4PS/WotcJcQUhBDf9NMm7h84qOulhJlotZsnoWCmhP0iHVyYtGpRhJ5xHGdAFoBkBzxEBiRAagUY/LFBv8b5YRYsdnOh4DG+GH6Lw1T2nvFaChNvKPJx2ttrZ/wPXiYfWObrNZ4zHJXbMI03zi9f6nZuppdMG7bzgvk5H4bypSj66FT72YeE0eJosVUTEjuNNMd4KShokzeRwi2+sW7gTL2YcV91EuoUuhX850cg2TUqjcsN2gH5i9A5OBNN/ayNld67kp3pwulNKOsolh/6uskmok1+qEtAHIGjVPtfmszAZRL2xXjUORRjgF6bL53OIRurDiY7/d/OH2jkGInltNGF1hRjUgs12jAahSmtZB2s8p53KBM+yOEN93JBFUqF/rBvXmoqDlosjU4PL+Mn1L/OFykl8A87mc1E1DmcURb/+DKSOQmBbHNeZPnkxIR0yHuURJaraFKPIpzy8XZOSxzCm6q5V32Zc96BRCo1jlCkcSjiXRQjuH26isF08coyKRIkBElUh+tWsMIXfBQ3iTZkxI/bV7KHaqlXwOlnLu/3zt37X5Prf6vghBcVtu0MMSz9zPtT+7rvAYHU1hJLQhBsfje/Xs4Ak01sboESyVhP9RCGfSH04cOHu0nFj3NrZZ14XZHvBdE/ZcoewvVf4vmypcujaS0Cmpt9kNlzHMayhmEX9yfExC/oxhASE6xl9g128VAL4jq84zAa2zj3CbFWfR17gobA/xeYEyE7l5at3PcR14uL88YfJGSZssqRg3+2262WFFD4fuivz0h/MgbzyjJiRK0mY871KaUL59WoHOAZYsVftcgsbvwVUAf4Xk43kj46BuLS5f5dPJ2QB5hzkIf2RTbJfLD7N+i/gRZjhZ9lZnNNd50XZIpKdNn1k6JBInwt9KR7YVQnGc/zffzeeFbJrv/HSoEzduIw/XTOwIspTSoDr7324eqnu+42qvDrv55e3eTrK1npQTQNu/QkcHrH/kJMkeyGXAPweb4Ev/RO8o9XhrDOs3Ic6GarW1WdNmgVokT+UMcOjjwWLnuF7myVLuooEPOWSu7BchTY7gQoQSnXagZCDD9UDzcZKfGNOfeHUAqcaL9MAobaCJ0zpHIs/JZzdT+u86JMWL2YnqVNLrgHpcGX7OcF+51rlqkqftVxd5zaVthTNvVcNUmRYD4J1QPBaYrVZIVXXqunNGUHVqEdGYWQLTlJM3tpju6H1Ol1pi0DA/uACIpgNc/o7Ah1goiYtDS8bszne0ta9cHdJOtXOjfst2u7LD4oSFfMDCx5dTDv58dnZFRhzoTubVVhIUys6sds1nipOVwpWyqyfGE/UDWz/KCvHIZ5hNliyeid2vQkfKzP30xsy+XPP4vsfFQHxOn9cbDItmfbO7d8zSOTj0SRtqfsdnaLEUWfFo0JAAnrcygjEF2XDNHHZKGkH9oDjX+4ijb6Rfq8AJWmp3C36GtAE9ybPM1XupB/PrPoEfWILGoTyQ1TP9TG3/uZM9pAkHddeYU0XmoMJUyZz0zNMTWEA48Ph+GB9B9IVJiyGbnbYMOWSLpejIqqa5v0mImLecxSWqGhIpMLPm7bR3D/FzxArR3psO0oQDHK0lgxBvR36p+eF6SuOa0Ujb6g+hmDwTZ0Y/+TCBYpAcTRX259txpHYt4nSw4NJI7d0h/afXzEbOXCDjD3CxSxzI0us/lX88sTTxaRPdh3pTuvdK4JUtf2AF3qPg2B96e9//3cNWUvpWPPg/8frha2SVvkALP/MLyj3JkBC5z1ayyonQqgF1pQCVfSEZzh33yYhiUfvf2/vbUwyC3vZA3MqEbAtCnL9HZ+Jpe59p0GX4cE5bolNl2A1jleQ3Qd4qte1JT0ksFooGKs4wFuRn8WKkMmGFzzYlDImhi9eaMdyssl58wLsV3XGszCJyDKkdkc+WHnC2zN5V9vtsCZeAx6fdOsbQhM2Bj43/czOHzs1QaY8BnoMOUKn/GZ5NcBt7sT51rZVljxeBp7kYEZzTOJJO0SJGN0rjQ1m67TVotsI5hjktd/eaAd2lLOPmGFEiDxw0WZ2jX5TpUP3npsXZugv0Do6/Bkz+TqhqkQV/y33ewpYJkwdcnrMcNkGbe7fqFSuKA+zmd9giFFJvYAZKU4DWheFCA6vaNfQDxyN8VK9EmOH99JKTOlJ2VW0NF0Cu3e32BeVn5BPZviYZMCRtjcbAUuPyJWv9z1NtrNejxpUAd5+sW83rS7CpLzgxQZwKQtJuX1AEXm2gXp4MpxuKoB++Rr/JwyNG5qvJVCavS1WHYlkB9rlZcOK1vwAINir7oNPsvt2uj8swv+uKrYbHYTFFXiPtCWQqdwAp2knSf7IKNjk9vSsOlgxwtmIM3WywurW38Yqrrg07QeuVnB4zWi8rg2NC7ioYRfURSEixKY+8uCLXhMGY+rE8zKcjv/LjpEjS77rY8TRJPR5goKV9nRPzPKV9pJlkNZ/MesKxXgxlHLdXL5xlpt+/QWvnwVkU+AQL29Ks6DbcuJcHmg6gbwPyR1iWI3IyZicq0nYpV2bWuY+hJUahdpjiZtBr3nG6Cqj698UE556Gw2iKj7j5+rAC3eImmAM8wtHwyd4Tza15nibRUa+bnI+NrG1He+FJjxRwOqtgibZrtH07P5LxhPvHIzrSRqhgE94SsQQXfXkB/ueqJYxEJeWEOabrgVkLCUXJqbjwYiTc15pirJdZ6HzESrt8DUGGQ32M85hx2UWv9nf6Llh4o/sqzSf7hiTll0XIqz/drnClAk6mQscgx+xAP0SqPfyiZ5bTgsPsjrxNrjqdIVIKUtz7rdY6yWj8gff+Jf07ttPVfvYt+C8sCdJU9NBgF6eAAAAA";
})(typeof globalThis !== "undefined" ? globalThis : this);

;
// ---- src/brands.js ----
// AmazonPlus \u2014 starter brand lists.
// These seed the scorer. The extension also learns brands as you browse, and your own
// Trust/Block choices (from the badge on each card) override everything here.
//
// Matching is case-insensitive against the brand line, or the start of the title.
// Single common words and platform names ("Apple", "Ring", "Xbox", "Kindle", "Lifetime") are left
// out on purpose: knock-off listings often start with them ("Xbox Controller Charger\u2026").

globalThis.DSA_BRANDS = {
  known: [
    // Bakeware & cookware
    "Chicago Metallic", "USA Pan", "CHEFMADE", "Nordic Ware", "Nordicware", "Wilton",
    "Fat Daddio's", "Lodge", "Calphalon", "Simply Calphalon", "Cuisinart", "KitchenAid",
    "Le Creuset", "Staub", "All-Clad", "Emile Henry", "Rachael Ray", "Farberware", "Anolon",
    "Circulon", "GoodCook", "Pyrex", "Anchor Hocking", "CorningWare", "Corelle", "OXO",
    "OXO Good Grips", "Mauviel", "de Buyer", "Matfer", "Matfer Bourgeat", "Made In Cookware",
    "Hestan", "Scanpan", "T-fal", "Tefal", "Zwilling", "Henckels", "Wusthof", "W\u00fcsthof",
    "Victorinox", "Mercer Culinary", "Winco", "Vollrath", "Libbey", "Lenox", "Ball Mason",
    "Bakers Mark", "Mrs. Anderson's", "Harold Import", "HIC Harold Import", "Norpro",
    "Fox Run", "Bellemain", "Silpat", "Ateco", "Paderno", "Cuisipro", "Microplane",
    "Joseph Joseph", "Great Jones", "Caraway", "GreenPan", "Our Place", "Misen", "Zyliss",
    "Brod & Taylor", "King Arthur", "Sassafras", "Ooni", "Baking Steel", "Doughmakers",
    "Kaiser Bakeware", "Birkmann", "Reynolds", "Reynolds Wrap", "Hefty", "Saran", "Kirkland Signature", "Hormel",
    "Vitafusion", "Olly", "SmartyPants", "Florsheim", "Allen Edmonds", "Woodlore", "Rockport", "Levi's", "Dockers", "St\u00e4dter", "Stadter", "RBV Birkmann", "Zenker", "Dr. Oetker", "L\u00e9ku\u00e9", "Lekue", "R\u00f6sle", "Rosle", "Tramontina",
    "Cuisinox", "Demeyere", "Viking Culinary", "Cook N Home", "Prepworks", "Chef'n", "Ninja", "Instant Pot", "Instant Brands", "Crock-Pot", "Hamilton Beach",
    "Proctor Silex", "Breville", "De'Longhi", "DeLonghi", "Nespresso", "Keurig", "Mr. Coffee",
    "Bodum", "Hario", "Chemex", "Baratza", "Bonavita", "Zojirushi", "Vitamix", "Blendtec", "NutriBullet", "Magic Bullet", "Oster", "Sunbeam", "Black+Decker",
    "Black & Decker", "Chefman", "COSORI", "Philips", "Smeg", "Rubbermaid",
    "Tupperware", "Weck", "Ziploc", "Stasher", "Weber", "Traeger",
    "Char-Broil", "Solo Stove", "Blackstone", "ThermoWorks", "Thermapen", "Taylor Precision",
    "Escali", "Etekcity", "Ozeri", "Polder",

    // Drinkware & food storage
    "Stanley", "Thermos", "Yeti", "Hydro Flask", "Owala", "Contigo", "CamelBak", "Nalgene",
    "Klean Kanteen", "S'well", "Simple Modern", "Brita", "PUR", "ZeroWater",

    // Home & cleaning
    "Amazon Basics", "AmazonBasics", "Amazon Commercial", "Amazon Brand", "Bissell", "Dyson",
    "Hoover", "Eureka", "iRobot", "Roomba", "Shark Ninja", "SharkNinja", "Miele", "K\u00e4rcher",
    "Karcher", "O-Cedar", "Libman", "Swiffer", "Clorox", "Lysol", "Mrs. Meyer's",
    "Seventh Generation", "Scotch-Brite", "3M", "Post-it", "Sterilite", "IRIS USA", "mDesign", "SimpleHuman", "Umbra", "Honeywell",
    "Levoit", "Coway", "Winix", "Blueair", "Vornado", "Lasko", "Dreo", "Frigidaire", "GE", "Whirlpool", "LG", "Samsung", "Panasonic", "Toshiba", "Brother", "Singer", "Janome", "Fiskars", "Westcott", "Duck Brand", "Gorilla Glue", "Loctite", "Elmer's", "WD-40", "Rust-Oleum", "Krylon", "Minwax",
    "Purdy", "Wooster", "Hampton Bay", "Moen", "Delta Faucet", "Kohler", "American Standard",
    "Waterpik", "Brondell", "Philips Hue", "Lutron", "Leviton", "Kasa", "TP-Link", "Wyze",
    "Eufy", "Arlo", "Blink", "Govee", "Feit Electric", "Cree", "Sylvania", "GE Lighting",
    "Energizer", "Duracell", "Rayovac", "Panasonic Eneloop", "EBL",

    // Bedding, bath, furniture
    "Mellanni", "Bedsure", "California Design Den", "Cozy Earth", "Boll & Branch", "Coyuchi",
    "Riley Home", "Snowe", "Quince", "Magic Linen", "Sleep Number", "Tempur", "Nectar", "Saatva",
    "Pottery Barn Kids", "Threshold", "Hearth & Hand", "Room Essentials", "Brielle Home",
    "Brooklinen", "Parachute", "Pottery Barn", "West Elm", "Casper", "Tempur-Pedic",
    "Zinus", "Linenspa", "Sealy", "Serta", "Beautyrest", "Utopia Bedding",
    "Utopia Towels", "Pinzon", "Martex", "Mainstays", "Better Homes & Gardens", "Sauder",
    "South Shore", "Ashley", "Signature Design by Ashley", "Stone & Beam",
    "Flash Furniture", "HON", "Herman Miller", "Steelcase", "FlexiSpot", "VIVO", "Ergotron", "Bush Furniture", "Nathan James",

    // Electronics & computing
    "Sony", "Bose", "Sennheiser", "Audio-Technica", "Shure", "JBL", "Harman Kardon",
    "Ultimate Ears", "Skullcandy", "Jabra", "Plantronics", "Poly", "Anker",
    "Soundcore", "Belkin", "Mophie", "Zagg", "OtterBox", "Spigen", "Incipio",
    "Case-Mate", "Logitech", "Razer", "Corsair", "SteelSeries", "HyperX", "Turtle Beach",
    "ASUS", "Acer", "Dell", "HP", "Lenovo", "Microsoft", "MSI", "Gigabyte", "Intel", "AMD",
    "NVIDIA", "EVGA", "Crucial", "Kingston", "SanDisk", "Western Digital", "Seagate",
    "Lexar", "PNY", "Netgear", "Linksys", "Ubiquiti", "Eero", "Synology",
    "QNAP", "APC", "CyberPower", "Tripp Lite", "Monoprice", "Cable Matters", "UGREEN",
    "Baseus", "Satechi", "Twelve South", "Native Union", "Peak Design",
    "Elgato", "Blue Yeti", "Rode", "R\u00d8DE", "Canon", "Nikon", "Fujifilm", "Olympus",
    "OM System", "Panasonic Lumix", "GoPro", "DJI", "Insta360", "Garmin", "Fitbit",
    "Suunto", "Amazfit", "Withings", "Google Nest", "Apple AirPods", "Apple iPad", "Apple iPhone", "Apple MacBook",
    "Apple Watch Series", "Apple Watch SE", "Apple Watch Ultra", "Apple AirTag",
    "Apple Magic", "Apple Pencil", "Apple TV", "Vizio", "TCL", "Hisense", "LG Electronics",
    "Epson", "Xerox", "Kodak", "Polaroid", "Fujifilm Instax", "Texas Instruments",
    "Casio", "8BitDo", "PowerA", "Hori",
    "Raspberry Pi", "Arduino", "Adafruit", "SparkFun", "Elegoo", "Creality", "Prusa",
    "Bambu Lab", "Chipolo", "Ring Video", "Ring Doorbell", "Ring Spotlight",
    "Nest Thermostat", "Nest Cam", "ecobee", "Philips Sonicare", "Oral-B", "Braun",
    "Remington", "Wahl", "Conair", "BaBylissPRO", "Revlon", "Dyson Supersonic",
    "Panasonic Arc", "Norelco", "Gillette",

    // Tools, hardware, auto
    "DeWalt", "Milwaukee", "Makita", "Bosch", "Ryobi", "Ridgid", "Craftsman",
    "Stanley Tools", "Kobalt", "Metabo", "Metabo HPT", "Hitachi", "Festool",
    "Klein Tools", "Knipex", "Wera", "Wiha", "Channellock", "Irwin", "Vise-Grip",
    "Gearwrench", "Tekton", "Crescent", "Estwing", "Leatherman", "Gerber",
    "Benchmade", "Kershaw", "Spyderco", "Buck Knives", "Fluke", "Dremel",
    "Porter-Cable", "Skil", "WORX", "Greenworks", "EGO", "Husqvarna",
    "Stihl", "Toro", "Sun Joe", "Scotts", "Miracle-Gro", "Ortho", "Rain Bird",
    "Gilmour", "Flexzilla", "Melnor", "Suncast", "Keter", "Chamberlain", "LiftMaster", "Master Lock", "Kwikset", "Schlage", "Yale", "August",
    "Armor All", "Meguiar's", "Chemical Guys", "Turtle Wax", "Rain-X",
    "Mobil 1", "Castrol", "Valvoline", "Pennzoil", "Bosch Automotive", "NOCO",
    "Schumacher", "Michelin", "Thule", "Yakima", "WeatherTech", "Husky Liners",
    "Lasfit", "Sylvania Automotive", "Philips Automotive", "Fram", "K&N", "Motorcraft",
    "ACDelco", "Gates", "Dorman", "Moog", "Monroe", "Bilstein", "Uniden",
    "Midland", "Garmin DriveSmart",

    // Outdoor, sports, travel
    "Coleman", "REI Co-op", "Patagonia", "The North Face", "Columbia", "Marmot",
    "Arc'teryx", "Osprey", "Deuter", "Gregory", "Kelty", "Big Agnes", "MSR", "Jetboil",
    "Black Diamond", "Petzl", "Nite Ize", "Fenix", "Streamlight", "Olight", "Maglite",
    "Goal Zero", "Jackery", "EcoFlow", "Bluetti", "Anker SOLIX", "Sawyer", "LifeStraw",
    "Katadyn", "Therm-a-Rest", "Sea to Summit", "Nemo", "Igloo",
    "RTIC", "Pelican", "Oakley", "Ray-Ban", "Maui Jim", "Garmin Forerunner",
    "Bowflex", "NordicTrack", "Peloton", "Schwinn", "Sunny Health & Fitness", "CAP Barbell",
    "Rogue", "Titan Fitness", "Gaiam", "Manduka", "Lululemon", "Hyperice", "Theragun",
    "TriggerPoint", "Wilson", "Spalding", "Rawlings", "Easton", "Franklin Sports",
    "Callaway", "TaylorMade", "Titleist", "Bushnell", "Vortex", "Leupold",
    "Samsonite", "Travelpro", "Briggs & Riley", "Tumi", "Delsey", "American Tourister",
    "Eagle Creek", "Herschel", "JanSport", "Eastpak", "Matein", "Swiss Gear", "SwissGear",

    // Clothing & shoes
    "Nike", "Adidas", "Under Armour", "Puma", "Reebok", "New Balance", "ASICS",
    "Brooks", "Hoka", "Saucony", "On Running", "Merrell", "Salomon", "Keen",
    "Teva", "Chaco", "Birkenstock", "Crocs", "Vans", "Skechers", "Clarks",
    "Dr. Martens", "Timberland", "Wolverine", "Red Wing", "Carhartt", "Dickies", "Levi's",
    "Wrangler", "Hanes", "Fruit of the Loom", "Gildan", "Jockey", "Calvin Klein",
    "Tommy Hilfiger", "Ralph Lauren", "Polo Ralph Lauren", "Lacoste", "Columbia Sportswear",
    "L.L.Bean", "Eddie Bauer", "Smartwool", "Darn Tough", "Bombas", "Injinji", "Amazon Essentials",
    "Goodthreads", "Daily Ritual", "Champion Athletic", "Russell Athletic", "Jerzees",
    "Wigwam", "Thorlo", "Uniqlo",

    // Health, beauty, personal care
    "Neutrogena", "CeraVe", "Cetaphil", "La Roche-Posay", "Aveeno", "Olay", "Eucerin",
    "Vanicream", "The Ordinary", "Paula's Choice", "Burt's Bees", "Aquaphor", "Vaseline",
    "Nivea", "Pantene", "Head & Shoulders", "Garnier", "L'Or\u00e9al", "L'Oreal",
    "Maybelline", "e.l.f.", "NYX", "Colgate", "Crest", "Sensodyne", "Listerine",
    "Philips Norelco", "Schick", "Bic", "Tylenol", "Advil", "Motrin",
    "Aleve", "Bayer", "Benadryl", "Zyrtec", "Claritin", "Allegra", "Flonase", "Mucinex",
    "Vicks", "Nature Made", "Nature's Bounty", "Centrum", "One A Day", "Garden of Life", "Pure Encapsulations", "Thorne", "Solgar", "Life Extension", "Doctor's Best",
    "Jarrow Formulas", "Nordic Naturals", "Kirkland Signature", "Nutricost", "NatureWise", "Natrol",
    "Rainbow Light", "MegaFood", "New Chapter", "Swanson", "Bluebonnet", "Country Life", "Klaire Labs",
    "NOW Foods", "NOW Supplements", "Optimum Nutrition", "Vital Proteins", "Orgain",
    "Omron", "Braun ThermoScan", "iHealth", "Band-Aid", "Nexcare", "Curad",
    "Johnson & Johnson", "Kleenex", "Charmin", "Cottonelle", "Huggies", "Pampers",

    // Pets
    "Purina", "Purina Pro Plan", "Blue Buffalo", "Hill's Science Diet", "Royal Canin",
    "Merrick", "Taste of the Wild", "Greenies", "Nylabone", "KONG", "Chuckit!", "Outward Hound", "Frisco", "PetSafe", "Petmate", "Kurgo", "Ruffwear",
    "Furminator", "Tidy Cats", "Fresh Step", "Arm & Hammer", "Dr. Elsey's",
    "Seresto", "Frontline", "Nature's Miracle", "Tetra", "Fluval", "Zilla",
    "Zoo Med", "Kaytee", "Oxbow", "Vitakraft",

    // Shop vacs & cleaning equipment
    "Shop-Vac", "Shop Vac Corporation", "Vacmaster", "Koblenz", "Dustless Technologies", "Prolux",
    "WORKSHOP Wet/Dry", "Fein", "Nilfisk", "Hoover Commercial",
    "Sanitaire", "ProTeam", "Oreck", "Rug Doctor", "Bissell Commercial", "Tineco", "Roborock", "Ecovacs",
    "Dreame", "Vax", "Kenmore", "Electrolux", "Dirt Devil",

    // Musical instruments & audio gear
    "Hohner", "Fender", "Seydel", "Lee Oskar", "Suzuki Music", "Suzuki", "Special 20",
    "Yamaha", "Gibson", "Epiphone", "Ibanez", "Squier", "Gretsch", "PRS", "Taylor Guitars",
    "Martin", "C.F. Martin", "Cordoba", "Kala", "Lanikai", "D'Addario", "Ernie Ball", "Elixir",
    "Dunlop", "Jim Dunlop", "Boss", "Roland", "Korg", "Behringer", "Marshall", "Vox", "Orange Amps",
    "Peavey", "Pearl", "Ludwig", "Zildjian", "Sabian", "Meinl", "Paiste", "Vic Firth", "Promark",
    "Remo", "Evans", "Hal Leonard", "Snark", "Planet Waves", "Levy's", "Gator", "Hercules",
    "K&M", "On-Stage", "Alesis", "M-Audio", "Akai", "Novation", "Arturia", "Native Instruments",
    "Focusrite", "PreSonus", "Universal Audio", "Steinberg", "Kawai", "Nord", "Electro-Harmonix",
    "MXR", "TC Electronic", "Line 6", "Positive Grid", "Fishman", "LR Baggs", "Seymour Duncan",
    "Gemeinhardt", "Selmer", "Bach", "Jupiter", "Buffet Crampon", "Vandoren", "Rico", "Hohner Kids",
    // Fans, heaters, air conditioning
    "Bionaire", "Holmes", "Comfort Zone", "Air King", "Pelonis", "Midea", "Haier", "Whynter",
    "Hurricane", "Rowenta", "Dyson Pure", "Boneco", "Stadler Form", "Hunter Fan", "Hunter",
    "Westinghouse", "Minka-Aire", "Emerson", "Friedrich", "Keystone", "Danby", "TOSOT", "Mr. Heater",
    "Dr. Infrared Heater", "Duraflame", "Broan", "Broan-NuTone", "Panasonic WhisperCeiling",
    "iLIVING", "Air King America",
    // Strollers, car seats, nursery
    "Chicco", "Graco", "Britax", "Joie", "Bugaboo", "BOB Gear", "BOB", "Baby Jogger", "Veer",
    "Cosco", "Cosco Kids", "Safety 1st", "Maxi-Cosi", "Nuna", "Cybex", "Doona", "UPPAbaby",
    "Evenflo", "Summer Infant", "Baby Trend", "hauck", "Zoe", "Delta Children", "Dream On Me",
    "Kolcraft", "Joovy", "Diono", "Clek", "Mockingbird", "Silver Cross", "Stokke",
    "Babyzen", "Ergobaby", "BabyBj\u00f6rn", "BabyBjorn", "Fisher-Price", "Skip Hop", "Munchkin",
    "Boppy", "4moms", "Nanit", "Owlet", "Hatch Baby", "Frida", "FridaBaby", "NoseFrida",

    // Toys, kids, baby
    "LEGO", "Mattel", "Hasbro", "Melissa & Doug", "Hot Wheels", "Barbie",
    "Nerf", "Play-Doh", "Crayola", "Ravensburger", "Magna-Tiles", "Learning Resources",
    "VTech", "LeapFrog", "Philips Avent", "Dr. Brown's", "Tommee Tippee", "Infant Optics", "Little Tikes", "Step2",
    "Radio Flyer", "Schleich", "Playmobil", "Funko", "Bandai", "Spin Master",

    // Office & school
    "Sharpie", "Uni-ball", "Pentel", "Paper Mate", "BIC Cristal", "Staedtler", "Faber-Castell", "Prismacolor", "Moleskine", "Leuchtturm1917", "Rhodia",
    "Five Star", "Mead", "Avery", "Swingline", "Bostitch", "Fellowes", "Smead", "Pendaflex",
    "Rocketbook", "Quartet", "Scotch Brand", "Elmer's Glue", "Texas Instruments TI"
  ],

  // Real brands whose names are ordinary words or other companies' platforms. They count as
  // established only when the page isn't using the word as ordinary vocabulary, and never on
  // accessory titles ("Kindle Case Compatible with Kindle\u2026").
  ambiguous: [
    "Shark", "Apple", "Ring", "Nest", "Kindle", "Echo", "Roku", "Google", "Purple", "Tiger",
    "Lifetime", "Method", "Command", "Halo", "Hatch", "Fellow", "Dash", "Away", "Branch", "Tile",
    "Polar", "Lucid", "Pilot", "Zebra", "Expo", "Orbit", "Cobra", "Smith", "Costa", "Ping",
    "Nomad", "Rivet", "Uplift", "Beats", "Lee", "Hart", "Sharp", "Klein", "Gorilla", "Scotch",
    "Mothers", "Optima", "Champion", "Converse", "Coach", "Glad", "Dove", "Bounty", "Tide",
    "Dawn", "Cascade", "Scott", "Dixie", "Solo", "Kiwi"
  ],

  // Throwaway / nonsense names confirmed by hand.
  blocked: [
    "Pavsrmy", "Gicyiit", "HOOMIL", "Tiawudi", "Coukre", "Yupjlia"
  ]
};

if (typeof module !== "undefined") module.exports = DSA_BRANDS;

;
// ---- src/bigrams.js ----
// Letter-pair log probabilities for English words (generated by tools/train_bigrams.py).
// Row = first letter ('^' = word start); columns = 'abcdefghijklmnopqrstuvwxyz$' ('$' = word end).
globalThis.DSA_BIGRAMS = {"^":[-2.84,-3.25,-2.65,-2.94,-3.22,-3.23,-2.94,-3.55,-3.16,-3.98,-3.79,-3.08,-2.91,-3.46,-3.59,-2.83,-3.66,-2.95,-2.47,-3.07,-3.66,-3.9,-3.68,-4.33,-4.48,-4.49,-12.22],"a":[-5.06,-3.31,-2.79,-3.21,-5.29,-4.99,-3.65,-5.06,-3.4,-5.52,-4.11,-2.28,-3.01,-2.15,-5.51,-3.32,-6.16,-2.12,-2.78,-2.08,-3.64,-3.98,-4.75,-4.99,-3.89,-5.71,-2.86],"b":[-2.28,-4.03,-3.82,-4.42,-2.24,-4.91,-4.85,-4.86,-2.54,-3.57,-4.95,-2.16,-4.26,-4.81,-2.52,-4.14,-5.42,-2.81,-2.99,-4.3,-2.5,-5.06,-5.58,-5.05,-3.68,-4.78,-2.24],"c":[-2.36,-5.29,-3.8,-4.68,-2.32,-5.26,-5.48,-2.27,-3.19,-5.91,-2.85,-3.07,-4.36,-5.34,-1.72,-4.69,-5.52,-3.23,-4.05,-2.49,-3.22,-5.26,-5.46,-6.08,-4.63,-5.48,-2.36],"d":[-2.8,-4.19,-4.46,-3.93,-1.57,-4.5,-4.68,-5.11,-2.04,-5.24,-5.28,-3.88,-4.67,-4.81,-2.87,-4.35,-5.92,-3.23,-3.34,-4.34,-3.55,-4.86,-5.32,-5.89,-4.6,-5.43,-1.35],"e":[-3.38,-4.77,-3.06,-2.62,-3.95,-4.01,-4.12,-5.37,-4.37,-6.13,-5.18,-3.02,-3.51,-2.27,-4.56,-3.97,-5.17,-1.87,-2.37,-2.94,-5.3,-4.0,-4.81,-3.49,-4.68,-5.38,-1.8],"f":[-2.81,-4.62,-4.45,-3.98,-2.59,-2.52,-4.86,-5.16,-1.85,-5.54,-5.42,-2.96,-4.32,-4.75,-2.22,-4.51,-5.21,-2.58,-3.45,-3.24,-3.05,-5.33,-4.9,-5.13,-4.3,-5.31,-2.0],"g":[-3.07,-4.78,-4.67,-4.54,-1.89,-5.17,-3.94,-3.48,-2.89,-6.03,-5.65,-3.21,-4.11,-3.38,-3.29,-4.66,-5.78,-2.75,-2.09,-4.44,-3.34,-5.15,-5.31,-5.44,-5.21,-5.16,-1.37],"h":[-1.78,-5.09,-4.99,-4.52,-1.77,-4.84,-5.4,-4.93,-2.3,-5.23,-4.84,-4.07,-4.18,-4.06,-2.15,-4.91,-5.26,-3.34,-4.32,-3.41,-3.42,-5.4,-4.96,-5.41,-4.04,-5.15,-1.77],"i":[-3.37,-3.43,-2.72,-3.31,-3.16,-3.97,-3.49,-6.03,-5.4,-5.76,-4.56,-2.8,-3.24,-1.51,-2.58,-3.86,-6.05,-3.38,-2.61,-2.57,-5.65,-3.72,-6.19,-4.56,-6.0,-3.97,-2.96],"j":[-2.28,-3.98,-3.57,-3.76,-2.26,-3.97,-4.62,-4.35,-3.01,-3.91,-4.0,-4.06,-4.02,-3.78,-2.32,-3.49,-4.24,-4.37,-3.67,-4.0,-2.61,-4.28,-4.35,-4.72,-3.91,-4.33,-1.64],"k":[-2.46,-4.74,-4.22,-4.17,-1.93,-4.5,-4.24,-3.81,-2.48,-4.76,-4.17,-3.38,-4.07,-3.88,-2.84,-4.42,-5.31,-3.63,-2.92,-4.13,-3.33,-5.06,-4.07,-5.16,-4.13,-5.0,-1.41],"l":[-2.26,-4.8,-4.69,-3.55,-1.74,-4.53,-4.95,-5.31,-1.9,-6.11,-5.0,-2.53,-4.05,-4.98,-2.49,-4.57,-6.14,-4.9,-3.39,-3.37,-3.55,-4.71,-5.9,-6.09,-3.11,-5.69,-2.06],"m":[-1.68,-3.44,-4.77,-4.21,-1.7,-4.32,-5.27,-5.57,-2.44,-5.49,-4.94,-3.98,-3.37,-4.8,-2.49,-2.54,-5.63,-4.71,-3.38,-4.33,-3.26,-5.02,-5.32,-5.27,-4.66,-5.6,-2.25],"n":[-2.75,-5.18,-2.93,-2.57,-2.51,-3.94,-2.21,-5.15,-2.99,-5.48,-4.04,-4.68,-5.21,-3.97,-3.18,-4.83,-5.86,-4.64,-2.62,-2.13,-4.01,-4.31,-5.59,-5.32,-4.86,-5.24,-1.76],"o":[-4.34,-3.79,-3.19,-3.06,-4.69,-4.21,-3.79,-5.01,-4.28,-5.54,-4.3,-2.94,-2.87,-1.68,-3.59,-3.09,-6.56,-2.04,-3.03,-3.19,-2.99,-3.58,-3.45,-4.97,-5.05,-5.32,-2.6],"p":[-2.02,-4.86,-4.3,-4.39,-1.95,-4.6,-5.07,-3.53,-3.09,-5.88,-5.01,-2.55,-4.84,-4.86,-2.54,-3.0,-5.6,-2.19,-3.46,-3.04,-3.5,-5.09,-5.13,-5.71,-3.9,-5.67,-2.26],"q":[-3.38,-3.82,-3.43,-3.4,-3.92,-4.17,-4.23,-3.46,-3.84,-4.15,-4.51,-3.94,-3.29,-3.37,-3.8,-3.54,-2.98,-3.57,-3.17,-3.16,-1.58,-4.1,-3.75,-4.28,-4.48,-4.23,-1.85],"r":[-2.28,-4.79,-3.52,-3.74,-1.73,-4.81,-4.06,-5.55,-2.39,-6.02,-4.41,-4.18,-3.64,-3.96,-2.52,-4.62,-6.28,-3.61,-2.91,-2.97,-4.03,-4.72,-5.33,-6.48,-3.92,-5.63,-1.71],"s":[-3.48,-5.64,-3.33,-4.92,-2.24,-4.91,-5.15,-3.25,-2.71,-6.23,-4.34,-4.16,-4.5,-5.13,-3.33,-3.41,-5.73,-4.15,-2.98,-1.81,-3.26,-5.39,-5.17,-6.04,-4.3,-5.4,-1.28],"t":[-2.53,-4.91,-3.92,-4.37,-1.78,-4.51,-5.62,-2.97,-1.98,-6.0,-5.44,-4.12,-4.44,-5.29,-2.82,-4.15,-6.41,-2.47,-3.03,-3.46,-3.76,-5.04,-4.86,-5.71,-3.68,-4.95,-1.87],"u":[-3.46,-3.14,-3.53,-3.38,-3.07,-3.82,-3.79,-4.89,-3.18,-5.66,-4.47,-2.62,-2.81,-2.08,-4.14,-3.2,-5.82,-2.31,-2.52,-2.27,-5.13,-5.06,-5.2,-4.21,-5.19,-5.05,-2.77],"v":[-2.07,-4.62,-4.38,-4.0,-1.16,-4.75,-4.62,-5.03,-1.86,-5.13,-4.92,-4.6,-4.39,-4.4,-3.09,-4.48,-5.28,-3.93,-4.2,-4.25,-4.59,-4.49,-4.77,-4.78,-4.82,-4.99,-2.06],"w":[-1.94,-4.46,-4.08,-3.87,-2.33,-4.24,-4.4,-3.28,-2.13,-5.55,-4.92,-3.63,-4.31,-3.15,-2.85,-4.41,-4.7,-2.93,-3.04,-4.43,-4.59,-4.69,-4.01,-4.49,-4.87,-4.9,-1.73],"x":[-3.16,-3.85,-3.01,-3.91,-2.71,-3.58,-4.41,-4.04,-2.94,-4.98,-4.85,-3.89,-3.6,-4.36,-4.14,-2.69,-4.56,-4.07,-3.51,-2.14,-4.24,-4.18,-4.4,-3.89,-3.78,-4.44,-1.36],"y":[-3.25,-4.47,-4.28,-4.37,-3.56,-4.45,-4.45,-4.79,-3.69,-5.06,-4.82,-3.73,-3.62,-3.39,-3.58,-2.65,-5.27,-3.62,-2.91,-3.24,-4.12,-4.73,-4.46,-4.94,-4.47,-4.55,-0.8],"z":[-2.67,-4.2,-4.16,-4.23,-1.71,-4.49,-4.52,-3.85,-2.75,-4.57,-4.15,-3.98,-3.93,-4.02,-3.29,-4.79,-4.19,-4.23,-4.02,-4.3,-4.07,-4.44,-4.22,-4.61,-3.94,-3.75,-1.16]};
if (typeof module !== 'undefined') module.exports = DSA_BIGRAMS;

;
// ---- src/scorer.js ----
// AmazonPlus \u2014 trust scorer.
// Pure functions: no DOM access, so the same code runs in the extension and in Node tests.
//
// scorePage(listings, config, bigrams) takes the listings on one results page and returns
// a Map of listing index \u2192 { score (0\u2013100), tier (1\u20135), brand, reasons: [{ pts, text }] }.
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
      .replace(/[\u2010-\u2015\u2212]/g, "-")
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

  // ---------- raw card data \u2192 normalized listing ----------
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

  // Accessory titles that lead with someone else's brand: "Kindle Case Compatible with Kindle\u2026".
  // Only counts when the compatibility phrase points back at the title's own first word, so
  // "Anker Charger \u2026 Compatible with iPhone" still belongs to Anker.
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
      // A word that other titles on this page use mid-title is ordinary vocabulary, not a brand \u2014
      // unless a capitalised word nobody else uses follows it ("Air King", "Comfort Zone").
      const key = first.toLowerCase().replace(/[^a-z]/g, "");
      if (!key) return { kind: "none", name: null };
      // \u2026but a seller writing an ordinary word in capitals at the very start is naming its brand.
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
    const phraseBrands = new Map(); // phrase \u2192 Set of established brands using it
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
    const brandPhrases = new Map(); // phrase \u2192 brand
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

    // Bracket spam \u3010\u3011[]
    const brackets = (t.match(/[\u3010\[\u300c\u3014]/g) || []).length;
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
    if (/[\u2011\u200b-\u200d\ufeff\uff01-\uff5e]/.test(t)) add(reasons, W.oddCharacters, "Unusual characters in title");

    // Sentences instead of a title
    const deAbbr = t.replace(/\b(Jr|Sr|Dr|Mr|Mrs|Ms|St|No|Vol|vs|oz|fl|ft|in|lb|lbs|Inc|Co|Ltd|approx|Pk|Qt|Gal)\./gi, "$1");
    if (/;/.test(deAbbr) || /[a-z]\.\s+[A-Z]/.test(deAbbr) || /[a-z\u00b0]\.$/.test(deAbbr)) {
      add(reasons, W.sentenceTitle, "Title written as sentences");
    }

    // Keyword stuffing: lots of "for X" uses or comma-separated fragments
    const fors = (t.match(/\bfor\b/gi) || []).length;
    const commas = (t.replace(/\([^)]*\)/g, "").match(/,/g) || []).length;
    if (fors >= 3 || commas >= 6) add(reasons, W.keywordStuffing, "Keyword stuffing");

    // Concrete specs
    let specs = 0;
    if (/\d+(?:\.\d+)?\s*(?:["\u201d\u2033]|in(?:ch(?:es)?)?\b|cm\b|mm\b)?\s*[x\u00d7]\s*\d/i.test(t) ||
        /\d+(?:\.\d+)?\s*[LWH]\s*x\s*\d/i.test(t)) specs++;
    if (/\d+(?:\.\d+)?\s*mm\s+thick|\bgauge\b|\d+\s*ga\b/i.test(t)) specs++;
    if (/\d+\s*\u00b0\s*[FC]\b/.test(t)) specs++;
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
        add(reasons, W.tooPerfect, `Near-perfect ${l.rating}\u2605 on very few reviews`, "reviews");
      }
      if (l.rating != null && l.rating < 4.0 && rc >= 20) add(reasons, W.lowRating, `Low rating (${l.rating}\u2605)`, "reviews");
    }
    if (l.newListing) add(reasons, W.newListing, "New on Amazon this month");

    // Listing age. Amazon hands out product IDs (ASINs) in sequence, so the ID dates the listing.
    // Throwaway sellers churn new listings; long-running products keep their old ones.
    const era = asinEra(l.asin);
    if (era === "vintage") add(reasons, W.asinVintage, "Listed on Amazon for 10+ years", "age");
    else if (era === "old") add(reasons, W.asinOld, "Listed on Amazon since ~2015\u20132018", "age");
    else if (era === "recent") add(reasons, W.asinRecent, "Listed on Amazon since ~2018\u20132020", "age");
    else if (era === "new") add(reasons, W.asinNew, "Listing created in the last year or so", "age");

    // Price far below the page median
    if (l.price && ctx.medianPrice && l.price < 0.45 * ctx.medianPrice) {
      add(reasons, W.cheapOutlier, `Priced far below similar listings ($${l.price} vs ~$${ctx.medianPrice.toFixed(0)})`);
    }

    return reasons;
  }

  // Rough age of a listing from its ASIN (B00\u2026 oldest, B0H\u2026 newest). Books (ISBNs) return null.
  function asinEra(asin) {
    if (!asin || !/^B0[0-9A-Z]{8}$/.test(asin)) return null;
    const c = asin[2];
    if (c === "0") return "vintage";                 // B00\u2026: before ~2015
    if (c >= "1" && c <= "6") return "old";          // B01\u2026\u2013B06\u2026: ~2015\u20132018
    if (c === "7" || c === "8") return "recent";     // B07\u2026, B08\u2026: ~2018\u20132020
    if (c >= "F") return "new";                      // B0F\u2026, B0G\u2026, B0H\u2026: 2025 onward
    return "mid";                                    // B09\u2026, B0B\u2026\u2013B0D\u2026: 2021\u20132024
  }

  // Amazon's unit price, e.g. "($0.13/count)", "($2.99/ounce)", "($1.01/feet)", "($0.16/fluid ounce)".
  // Returns { value, unit, label } with compatible units converted (pounds/grams \u2192 per ounce,
  // litres/millilitres \u2192 per fl oz, inches \u2192 per foot\u2026), or null when there isn't one.
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
      // Evidence: the score without any brand points \u2014 what learning is allowed to use.
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

;
// ---- src/memory.js ----
// AmazonPlus \u2014 brand memory.
// Remembers how each brand's listings have looked across your searches, and turns that into
// learned "trust" / "block" decisions. Pure functions over a plain object, so it runs in Node tests.
//
// Memory shape (stored as JSON):
// {
//   v: 1,
//   brands: {
//     "<brand key>": {
//       name: "Display Name",
//       seen: 1698000000000,                 // last time seen (ms)
//       gib: 0|1,                            // brand name looked like gibberish
//       queries: ["baguette tray", ...],     // distinct searches it appeared in
//       items: { "<ASIN>": [evidence, reviews, flags] }
//     }
//   },
//   votes: { "<brand key>": "trust" | "block" },   // your choices, never overwritten by learning
//   names: { "<brand key>": "Display Name" }       // display names for voted brands
// }

(function (root) {
  "use strict";

  function emptyMemory() {
    return { v: 1, brands: {}, votes: {}, names: {} };
  }

  function sanitize(mem) {
    if (!mem || typeof mem !== "object" || mem.v !== 1) return emptyMemory();
    mem.brands = mem.brands || {};
    mem.votes = mem.votes || {};
    mem.names = mem.names || {};
    return mem;
  }

  function normQuery(q) {
    return (q || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
  }

  // Record one scored results page. `results` is the Map returned by scorePage.
  function recordPage(mem, results, query, rules, now) {
    mem = sanitize(mem);
    const q = normQuery(query);
    now = now || Date.now();
    for (const r of results.values()) {
      const b = r.brand;
      if (!b || !b.key || !r.asin) continue;
      const base = b.base || b.kind;           // what the brand looked like before votes/learning
      if (base === "none") continue;
      let e = mem.brands[b.key];
      if (!e) e = mem.brands[b.key] = { name: b.name, seen: now, gib: 0, queries: [], items: {} };
      e.name = e.name || b.name;
      e.seen = now;
      if (base === "gibberish") e.gib = 1;
      if (q && !e.queries.includes(q)) {
        e.queries.push(q);
        if (e.queries.length > 20) e.queries.shift();
      }
      const reviews = r.listing && r.listing.reviewCount != null ? r.listing.reviewCount : 0;
      e.items[r.asin] = [r.evidence, reviews, r.flags];
      const asins = Object.keys(e.items);
      if (asins.length > rules.maxListingsPerBrand) delete e.items[asins[0]];
    }
    prune(mem, rules);
    return mem;
  }

  function prune(mem, rules) {
    const keys = Object.keys(mem.brands);
    if (keys.length <= rules.maxBrands) return;
    keys.sort((a, b) => mem.brands[a].seen - mem.brands[b].seen);
    for (const k of keys.slice(0, keys.length - rules.maxBrands)) {
      if (!mem.votes[k]) delete mem.brands[k];
    }
  }

  // Decide what a brand has earned from what's been seen. Returns "trust" | "block" | null
  // and a short explanation.
  function judge(entry, rules) {
    const items = Object.values(entry.items || {});
    const n = items.length;
    const searches = (entry.queries || []).length;
    if (!n) return { verdict: null };
    const avg = items.reduce((s, it) => s + it[0], 0) / n;
    const flagged = items.filter(it => it[2] > 0).length;
    const minReviews = Math.min(...items.map(it => it[1]));
    const stats = { listings: n, searches, avgEvidence: Math.round(avg), flagged, minReviews };

    if (n >= rules.blockMinListings && searches >= rules.blockMinSearches) {
      if (avg <= rules.blockMaxAvgEvidence) return { verdict: "block", why: "low ratings", stats };
      if (flagged / n >= rules.blockFlaggedShare) return { verdict: "block", why: "repeated red flags", stats };
    }
    if (!entry.gib && n >= rules.trustMinListings && searches >= rules.trustMinSearches &&
        avg >= rules.trustMinAvgEvidence && flagged === 0 && minReviews >= rules.trustMinReviews) {
      return { verdict: "trust", why: "consistently solid", stats };
    }
    return { verdict: null, stats };
  }

  // Map of brand key \u2192 "trust" | "block" for every brand that has earned a verdict.
  function learnedBrands(mem, rules) {
    mem = sanitize(mem);
    const out = {};
    for (const [k, e] of Object.entries(mem.brands)) {
      const j = judge(e, rules);
      if (j.verdict) out[k] = j.verdict;
    }
    return out;
  }

  function setVote(mem, key, name, vote) {
    mem = sanitize(mem);
    if (vote === "trust" || vote === "block") {
      mem.votes[key] = vote;
      mem.names[key] = name || mem.names[key] || key;
    } else {
      delete mem.votes[key];
      delete mem.names[key];
    }
    return mem;
  }

  // Forget what was learned about a brand (keeps your vote, if any).
  function forget(mem, key) {
    mem = sanitize(mem);
    delete mem.brands[key];
    return mem;
  }

  const api = { emptyMemory, sanitize, recordPage, judge, learnedBrands, setVote, forget };
  if (typeof module !== "undefined") module.exports = api;
  else root.DSA_MEMORY = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

;
// ---- src/product.js ----
// AmazonPlus \u2014 product pages.
// extractProduct(document) reads what a product page offers beyond the search results card;
// refineScore(initial, product, cfg, bigrams) turns the search-results estimate into a better one
// and says exactly what changed. extractProduct needs a DOM; refineScore is pure (runs in Node tests).

(function (root) {
  "use strict";

  const T = el => el ? (el.textContent || "").replace(/[\s\u200e\u200f]+/g, " ").trim() : "";

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
    // (The mobile site uses "mobile-\u2026" names, and puts the value in an offer-display-attribute-name element.)
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
      if (product.rating >= 4.9 && rc > 0 && rc < 30) r.push({ pts: W.tooPerfect, text: `Near-perfect ${product.rating}\u2605 on very few reviews` });
      if (product.rating < 4.0 && rc >= 20) r.push({ pts: W.lowRating, text: `Low rating (${product.rating}\u2605)` });
      replace("reviews", r, () => `Exact review count: ${rc.toLocaleString("en-US")}`);
    }

    // 4. How the stars are spread. Only the extremes count: on real pages a 6\u20139% share of 1\u2605 is normal
    //    for appliances (Bionaire, Amazon Basics), and junk and real brands both sit around 10\u201313% 4\u2605.
    const h = product.histogram;
    if (h && (product.reviewCount || 0) >= 30) {
      if (h[1] >= 15) addProduct(PW.manyOneStar, `${h[1]}% of reviews are 1-star`);
      if (h[5] >= 85 && h[4] < 6) addProduct(PW.thinMiddle, `Ratings pile up at 5\u2605 (${h[5]}%) with only ${h[4]}% 4\u2605 \u2014 typical of padded reviews`);
    }

    // 5. Who sells it.
    const seller = (product.soldBy || "").trim();
    if (/^amazon(\.com)?$/i.test(seller)) addProduct(PW.soldByAmazon, "Sold by Amazon.com");
    else if (seller && isAnonymousSeller(seller)) addProduct(PW.anonymousSeller, `Sold by an anonymous trading account ("${seller}")`);

    // 6. Bullet points. On real pages, junk listings ran 1,400\u20132,000 characters with 4\u20137 marketing
    //    phrases; established brands ran 200\u20131,200 with at most 2.
    const bullets = product.bullets || [];
    if (bullets.length) {
      const all = bullets.join(" \n ");
      const chars = product.bulletChars || all.length;
      const brackets = (all.match(/[\u3010\[\u300c\u3014]/g) || []).length;
      if (brackets >= 2) addProduct(PW.bulletBrackets, `Bullet points use \u3010bracketed\u3011 headings (${brackets})`);
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
    // (textContent runs words together \u2014 "Nov 9, 2022ESRB Rating" \u2014 so no \b before these.)
    if (/Starring:/.test(t)) return true;                                          // films and TV
    // Games carry an age rating, but so do controllers and consoles on Amazon: those stay rated.
    const title = [...card.querySelectorAll("h2")].map(T).join(" ") || t.slice(0, 200);
    if (GAME_HARDWARE.test(title)) return false;
    if (/ESRB Rating:|PEGI \d/.test(t)) return true;
    for (const a of card.querySelectorAll("a.a-text-bold, span.a-text-bold")) if (PLATFORM.test(T(a))) return true;
    // "Elden Ring - PlayStation 5", "Mario Kart World (Nintendo Switch 2)" \u2014 but not "\u2026 for PS5".
    return GAME_TITLE.test(title) && !/\bfor (the )?(PlayStation|PS[45]|Xbox|Nintendo|Switch|Steam Deck)/i.test(title);
  }
  const PLATFORM = /^(PlayStation ?[2-5]|PS[2-5]|PS Vita|Xbox( Series [XS]| One| 360)?|Nintendo Switch( 2)?|Nintendo 3DS|Wii U?|PC|Mac|Steam Deck|PC Download|Online Game Code)$/i;
  const GAME_TITLE = /[-\u2013(]\s*(PlayStation ?[45]|PS[45]|Xbox (Series [XS]|One)|Nintendo Switch( 2)?|Steam Deck|PC)\b/i;
  const GAME_HARDWARE = /\b(controllers?|gamepads?|game ?pads?|(joy|thumb|arcade|fight|fighting|flight|control) ?sticks?|joypads?|leverless|hitbox|hotas|throttle|steering|console|system|bundle|headsets?|headphones?|earbuds|speakers?|charg\w*|case|cables?|adapters?|receiver|dongle|stand|docks?|docking|grips?|skins?|triggers?|memory card|sd card|capture card|micro ?sd|ssd|hard drive|storage|mount|keyboard|mouse|mice|wheel|pedals?|joy-?cons?|amiibo|figure|remote|batter(y|ies)|cover|protector|accessor(y|ies)|camera|webcam|microphone|vr|fan|cooling|gift card|subscription|membership|renewed|\d+ ?(TB|GB))\b/i;

  const api = { extractProduct, productTitle, refineScore, parseDate, isProductPage, isAnonymousSeller, isMediaPage, isMediaCard };
  if (typeof module !== "undefined") module.exports = api;
  else root.DSA_PRODUCT = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

;
// ---- src/pricecheck.js ----
// AmazonPlus \u2014 "Found at MERCHANT for PRICE" (off-Amazon price scan, via UPCitemdb).
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
  // bundled in ("\u2026 W/ DCBL722B Handheld Blower", "DCB245-2C \u2026 W/ DCF787D1").
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
    // "dewalt-dcf787d1-impact-driver\u2026" does).
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
  // Stores outside the US (prices in other currencies): walmart.ca, *.co.uk, \u2026
  const FOREIGN = /\.(ca|uk|au|de|fr|it|es|nl|mx|jp|in|ie|nz|eu|cn|br)$/i;

  // UPCitemdb search response \u2192 the cheapest identical offer, or null.
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

;
// ---- src/content.js ----
// AmazonPlus \u2014 content script for search results pages.
// Adds a toggle above the left-hand filters. When on, every result card is scored,
// tinted green \u2192 yellow \u2192 red by trust, and the results are re-sorted most-trusted first.
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
  const KEY_PRICES = "dsaOffPrices";          // off-Amazon price scans: query \u2192 { at, f: {m, p, u, at} | 0 }
  const KEY_PRICE_USAGE = "dsaUpcUsage";      // UPCitemdb free-plan use today: { used, limit, resetAt }
  const LISTINGS_MAX = 300;                   // most recently seen listings kept
  const CHECK_TTL = 30 * 864e5;               // product-page checks are reused for 30 days
  const KEY_MEMORY = "dsaMemory";

  let enabled = false;
  let lastClick = null;     // { a: ASIN, at } \u2014 the search result last clicked through
  let listings = {};        // ASIN \u2192 { s, t, r: [[pts, text, tag]], q, at, p?: { s, t, at, ch: [[pts, text]] } }
  let lastResults = null;   // last scoring, for refreshing the status line
  let lastPromoCount = 0;
  let sortChoice = null;    // "trust" | "unit" chosen in the Sort by menu (kept across searches), or null
  let featuredFor = "";     // you picked Amazon's "Featured" for this search term
  let memory = MEMORY.emptyMemory();
  let learned = {};
  let snapshot = null;      // { order: Map(container \u2192 children), cards: Set } \u2014 for restoring
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
    } catch (e) { /* storage full or blocked \u2014 carry on without saving */ }
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
    // same block ("Vinyl Record Player, Fully Automatic\u2026"); that isn't part of the title.
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
    const hue = Math.round(Math.max(0, Math.min(100, score)) * 1.2); // 0 red \u2192 60 yellow \u2192 120 green
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
      button(current === "trust" ? "Trusted \u2713" : "Trust", current === "trust" ? "dsa-on dsa-trust" : "dsa-trust",
        () => { reopenAsin = result.asin; vote(b.key, b.name, current === "trust" ? null : "trust"); }),
      button(current === "block" ? "Blocked \u2713" : "Block", current === "block" ? "dsa-on dsa-block" : "dsa-block",
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
      el("summary", null, `Trust ${result.tier}/5`, el("span", { class: "dsa-score" }, ` \u00b7 ${result.score}`),
        result.checked ? el("span", { class: "dsa-checked", title: "Checked on its product page" }, " \u2713") : null));
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
          `${r.pts > 0 ? "+" : "\u2212"}${Math.abs(r.pts)}  ${r.text}`));
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
      r.reasons.push({ pts: delta, text: delta ? `Checked on its product page (${delta > 0 ? "+" : "\u2212"}${Math.abs(delta)})` : "Checked on its product page (no change)", tag: "checked" });
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
    // What the product page added up to, before the 0\u2013100 limits. If the score was already pinned at
    // 0 or 100, say so instead of claiming "no change".
    const delta = refined.changes.reduce((a, x) => a + x.pts, 0);
    const pinned = delta && refined.baseScore != null && refined.score === refined.baseScore ? (refined.score === 0 ? " \u2014 already at the bottom of the scale" : " \u2014 already at the top of the scale") : "";
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
    const deltaText = moved > 0 ? `\u25b2${moved}` : moved < 0 ? `\u25bc${Math.abs(moved)}` : "\u2013";
    const deltaTip = (init ? "Change from the search-results estimate" : "Change from the estimate from the title, stars and reviews alone") +
      ` (${from} \u2192 ${refined.score})`;
    const head = el("div", { class: "dsa-ph-head" },
      el("span", { class: "dsa-ph-pill" }, `Trust ${refined.tier}/5`, el("span", { class: "dsa-score" }, ` \u00b7 ${refined.score}`)),
      el("span", { class: "dsa-ph-delta " + cls, title: deltaTip }, deltaText),
      el("span", { class: "dsa-ph-title" }, "AmazonPlus"));
    let compare;
    if (!init) {
      compare = el("div", { class: "dsa-ph-compare" }, "Not in your recent search results \u2014 rated from this page.",
        pinned ? el("span", { class: "dsa-muted" }, pinned) : null);
    } else {
      compare = el("div", { class: "dsa-ph-compare" },
        refined.variantOf ? "Search results (another size/colour): " : "Search results: ", el("b", null, `${init.tier}/5 \u00b7 ${init.score}`),
        "  \u2192  this page: ", el("b", null, `${refined.tier}/5 \u00b7 ${refined.score}`),
        pinned ? el("span", { class: "dsa-muted" }, pinned) : null,
        init.tier !== refined.tier ? el("span", { class: "dsa-muted" }, `  (tier ${init.tier} \u2192 ${refined.tier})`) : null);
    }

    const details = el("details", { class: "dsa-ph-details" }, el("summary", null, "What the product page showed"));
    const ch = el("ul", { class: "dsa-ph-list" });
    for (const x of refined.changes) {
      ch.append(el("li", { class: x.pts > 0 ? "dsa-good" : x.pts < 0 ? "dsa-bad" : "dsa-muted" },
        `${x.pts > 0 ? "+" + x.pts : x.pts < 0 ? "\u2212" + Math.abs(x.pts) : "\u00b10"}  ${x.text}`));
    }
    if (!refined.changes.length) ch.append(el("li", { class: "dsa-muted" }, "Nothing here changes the estimate."));
    const all = el("ul", { class: "dsa-ph-list" });
    for (const x of refined.reasons) {
      if (!x.pts) continue;
      all.append(el("li", { class: x.pts > 0 ? "dsa-good" : "dsa-bad" }, `${x.pts > 0 ? "+" : "\u2212"}${Math.abs(x.pts)}  ${x.text}`));
    }
    details.append(ch, el("div", { class: "dsa-phead" }, "All reasons"), all);

    const key = product.brand ? SCORER.brandKey(product.brand) : null;
    if (key) {
      const current = memory.votes[key];
      details.append(el("div", { class: "dsa-brandrow" },
        el("span", { class: "dsa-brandname" }, product.brand),
        button(current === "trust" ? "Trusted \u2713" : "Trust", current === "trust" ? "dsa-on dsa-trust" : "dsa-trust",
          () => { memory = MEMORY.setVote(memory, key, product.brand, current === "trust" ? null : "trust"); refreshLearned(); storeSet(KEY_MEMORY, memory); runProductPage(true); }),
        button(current === "block" ? "Blocked \u2713" : "Block", current === "block" ? "dsa-on dsa-block" : "dsa-block",
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
    const title = (result.listing && result.listing.title) || raw.title.replace(/^sponsored( ad)?\s*[-\u2013:]\s*/i, "");
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
    btn.textContent = (scanOn ? "Stop scanning for off-Amazon prices" : "Scan for off-Amazon prices") + `: ${Math.min(u.used, cap)}/${cap} used so far today`;
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
        scanNote = `Checking ${q}\u2026` + (scanQueue.length ? ` (${scanQueue.length} more in view)` : "");
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
          console.info(`[AmazonPlus] price scan: ${q} \u2014 no answer (HTTP ${res.status}${json && json.code ? ", " + json.code : ""})`);
        } else {
          const f = PRICECHECK.pickOffer(json, pq.model, pq.title, Date.now(), PC.maxOfferAgeDays || 60);
          prices[q] = { at: Date.now(), f: f ? { m: f.m, p: f.p, u: f.u, at: f.at } : 0 };
          if (f) scanTally.found++; else scanTally.none++;
          console.info(`[AmazonPlus] price scan: ${q} \u2014 ${(json.items || []).length} products; ` + (f ? `cheapest identical: ${f.m} ${f.p}` : "no identical item sold new elsewhere"));
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
  // to your search", stray "Sponsored Ad" boxes\u2026 Rather than chase each one, everything in the
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
      // default order \u2014 a sort you picked on Amazon is left alone (colours and badges stay either way).
      restoreOrder();
      const mode = currentMode();
      if (mode !== "amazon") {
        const sorted = mode === "unit"
          ? unitOrder(rated, raws, results)
          : rated.map((card, i) => ({ card, i, score: results.get(i).score })).sort((a, b) => b.score - a.score || a.i - b.i);
        // Unrated media (games, books, films) keep the places Amazon gave them \u2014 a search for a game
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
  //   AmazonPlus: Trust   \u2014 most trusted first. Also what a fresh search shows by default.
  //   AmazonPlus: $/count \u2014 cheapest per unit first.
  //   Amazon's own sorts       \u2014 Amazon's order, with colours and badges. Picking "Featured" shows
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
  // High", \u2026) inside the Filters sheet. Our two sorts are added as chips of the same look, and the
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

  // The sheet's close (\u2715) button: the nearest one up from the chips.
  function closeSheet(from) {
    for (let e = from.parentElement; e && e !== document.body; e = e.parentElement) {
      const btn = [...e.querySelectorAll('button, [role=button], a')].find(b =>
        /^(close|dismiss)/i.test(b.getAttribute("aria-label") || b.getAttribute("title") || "") || /^[\u2715\u00d7\u2716xX]$/.test(b.textContent.trim()));
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
      status.textContent = promosRemoved ? "Off \u00b7 reload to bring back the hidden promos" : "Off";
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
      status.textContent = `${visible.length} rated \u00b7 ${tiers[5] + tiers[4]} trusted \u00b7 ${tiers[1]} junk` +
        (extras.length ? " \u00b7 " + extras.join(" \u00b7 ") : "");
    }
    updateManageLabel();
  }

  function updateManageLabel() {
    const mb = document.querySelector("#dsa-toggle .dsa-manage");
    if (mb) {
      const c = brandCounts();
      mb.textContent = `${panelOpen ? "\u25be" : "\u25b8"} Brands: ${c.yours} yours \u00b7 ${c.learned} learned`;
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
          [button("\u00d7", "dsa-x", () => vote(k, null, null))]));
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
        item.title = `${j.why || ""} \u2014 ${j.stats.listings} listings across ${j.stats.searches} searches, average ${j.stats.avgEvidence} before brand points`;
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
        el("button", { type: "button", class: "dsa-scan", on: { click: e => { e.preventDefault(); scanPrices(); } } }, "Scan for off-Amazon prices"),
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
    } catch (e) { /* site storage blocked \u2014 nothing to clean */ }
    if ((await storeGet(KEY_OLD_UNIT_SORT, false)) === true && (await storeGet(KEY_SORT, undefined)) === undefined) {
      storeSet(KEY_SORT, "unit");
    }
    storeSet(KEY_OLD_UNIT_SORT, false);
    for (const old of ["dsaPrices", "dsaPrices2", "dsaPrices3", "dsaPricePause"]) if ((await storeGet(old, null)) !== null) storeSet(old, null);   // v0.8.0\u20130.8.5 Google price checks
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
