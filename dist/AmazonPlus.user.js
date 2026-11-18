// ==UserScript==
// @name         AmazonPlus
// @namespace    disenshittify-amazon
// @version      0.15.1
// @description  Rates Amazon search results by trustworthiness, tints them green to red, and sorts the junk to the bottom.
// @match        https://www.amazon.com/s*
// @match        https://amazon.com/s*
// @match        https://www.amazon.com/dp/*
// @match        https://www.amazon.com/*/dp/*
// @match        https://www.amazon.com/gp/product/*
// @match        https://amazon.com/dp/*
// @match        https://amazon.com/*/dp/*
// @match        https://amazon.com/gp/product/*
// @match        https://www.amazon.com/gp/cart/*
// @match        https://www.amazon.com/cart*
// @match        https://amazon.com/gp/cart/*
// @match        https://amazon.com/cart*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @connect      api.upcitemdb.com
// @connect      raw.githubusercontent.com
// @inject-into  content
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  const style = document.createElement("style");
  style.id = "dsa-styles";
  style.textContent = "/* AmazonPlus \u2014 injected styles. Everything is prefixed dsa- to stay out of Amazon's way. */\n\n/* ---------- toggle ---------- */\n#dsa-toggle {\n  position: relative;\n  box-sizing: border-box;\n  margin: 0 0 14px;\n  padding: 10px 12px;\n  border: 2px solid #8bc34a;\n  border-radius: 10px;\n  background: #fbfdf7;\n  font-family: \"Amazon Ember\", Arial, sans-serif;\n  color: #0f1111;\n}\n/* The Prime and eco buttons, under the on/off switch, lined up with the status. Off: light grey,\n   pressed in; on: white, standing out a little. */\n/* Below the switch, desktop: a left column (Prime and eco buttons, stacked; the a+ logo at the\n   bottom, as wide as the switch) beside the main column. Phones (.dsa-inline): one column, the\n   buttons in a row lined up with the status (the logo there sits under the switch). */\n#dsa-toggle .dsa-body { display: flex; align-items: stretch; gap: 10px; margin-top: 8px; }\n#dsa-toggle .dsa-side { flex: none; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }\n/* Desktop: a fixed width (fits \"Showing eco\"), so switching a button doesn't shift the main column. */\n#dsa-toggle:not(.dsa-inline) .dsa-side { width: 52px; }\n#dsa-toggle:not(.dsa-inline) .dsa-side .dsa-prefs { align-self: stretch; }\n.dsa-pref-text { white-space: nowrap; }\n.dsa-pref-eco { font-size: 9.5px; gap: 3px; }\n#dsa-toggle .dsa-col-main { flex: 1; min-width: 0; }\n#dsa-toggle:not(.dsa-inline) .dsa-col-main > .dsa-status,\n#dsa-toggle:not(.dsa-inline) .dsa-col-main > .dsa-legend,\n#dsa-toggle:not(.dsa-inline) .dsa-col-main > .dsa-manage,\n#dsa-toggle:not(.dsa-inline) .dsa-col-main > .dsa-scanbox { margin-left: 0; }\n#dsa-toggle:not(.dsa-inline) .dsa-col-main > .dsa-status { margin-top: 0; }\n#dsa-toggle:not(.dsa-inline) > .dsa-scanbox { margin-left: 0; }\n.dsa-prefs { display: flex; flex-direction: column; align-items: stretch; gap: 6px; }\n#dsa-toggle .dsa-side-logo { position: absolute; top: calc(6px + var(--dsa-upd, 0px)); right: 7px; display: block; width: auto; height: 18px; pointer-events: none; }\n#dsa-toggle.dsa-off .dsa-side-logo { filter: grayscale(1); }\n#dsa-toggle.dsa-inline .dsa-body { display: block; margin-top: 0; }\n#dsa-toggle.dsa-inline .dsa-prefs { flex-direction: row; flex-wrap: wrap; margin: 8px 0 2px 50px; }\n#dsa-toggle.dsa-inline .dsa-side-logo { display: none; }\n.dsa-pref {\n  display: inline-flex; align-items: center; justify-content: center; gap: 4px;\n  padding: 3px 3px; border: 1px solid #c4c9c9; border-radius: 7px;\n  background: #e3e6e6; color: #4d5151; font: 600 10.5px/1.2 \"Amazon Ember\", Arial, sans-serif; cursor: pointer;\n  box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.22); transition: background 0.12s, box-shadow 0.12s, transform 0.12s;\n}\n.dsa-pref[aria-pressed=\"true\"] {\n  background: #ffffff; color: #0f1111; border-color: #b7bcbc;\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25), 0 2px 5px rgba(0, 0, 0, 0.12); transform: translateY(-1px);\n}\n.dsa-pref-prime { flex-direction: column; gap: 2px; font-size: 9px; }\n/* Same icon box for both arrows (the slashed one is drawn taller), so both states are the same height. */\n.dsa-pref-prime .dsa-pref-icon { display: block; width: 30px; height: 11px; object-fit: contain; }\n.dsa-pref-eco .dsa-pref-icon { display: block; width: 12px; height: 12px; }\n.dsa-pref-eco[aria-pressed=\"false\"] .dsa-pref-icon { filter: grayscale(1) opacity(0.75); }\n.dsa-dark .dsa-pref { background: #2a2f2f; color: #c4c9c9; border-color: #4a5050; box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.6); }\n.dsa-dark .dsa-pref-prime[aria-pressed=\"false\"] .dsa-pref-icon { filter: brightness(1.6); }\n.dsa-dark .dsa-pref[aria-pressed=\"true\"] { background: #ffffff; color: #0f1111; border-color: #ffffff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.5); }\n/* The version, small and light grey, in the top-right corner. */\n#dsa-toggle .dsa-version { position: absolute; top: calc(4px + var(--dsa-upd, 0px)); right: 8px; font-size: 10px; line-height: 1; color: #a3a8a8; pointer-events: none; }\n#dsa-toggle:not(.dsa-inline) .dsa-version { top: calc(26px + var(--dsa-upd, 0px)); }\n/* \"New version available\", at the very top: centred, underlined, dark red, a small \u2715 after it.\n   Everything placed from the top (logo, version) moves down by its height while it shows. */\n#dsa-toggle.dsa-has-update { --dsa-upd: 16px; }\n#dsa-toggle .dsa-update { margin: -4px 0 4px; text-align: center; font: 600 11.5px/16px \"Amazon Ember\", Arial, sans-serif; white-space: nowrap; }\n#dsa-toggle .dsa-update[hidden] { display: none; }\n#dsa-toggle .dsa-update a { color: #8b0000; text-decoration: underline; }\n#dsa-toggle .dsa-update a:hover { color: #b00000; }\n#dsa-toggle .dsa-update sup { vertical-align: super; font-size: 9px; line-height: 0; }\n#dsa-toggle .dsa-update-x { margin: 0 0 0 2px; padding: 0 2px; border: 0; background: none; color: #8b0000; font: 700 9px/1 Arial, sans-serif; cursor: pointer; }\n.dsa-dark #dsa-toggle .dsa-update a, .dsa-dark #dsa-toggle .dsa-update-x { color: #ff8a80; }\n.dsa-dark #dsa-toggle .dsa-version { color: #6f7575; }\n/* Phones: only as wide as what's in it (up to 360px). */\n#dsa-toggle.dsa-inline { width: -moz-fit-content; width: fit-content; max-width: min(360px, 100%); margin: 8px 0 12px; }\n/* The scan button and the brand list wrap to that width rather than widening the box. */\n#dsa-toggle.dsa-inline .dsa-scanbox, #dsa-toggle.dsa-inline .dsa-panel { contain: inline-size; }\n/* Floating at the top of the window once its place in the column has scrolled away */\n#dsa-toggle.dsa-float {\n  position: fixed;\n  top: 8px;\n  z-index: 300;\n  margin: 0;\n  max-height: calc(100vh - 16px);\n  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);\n}\n#dsa-toggle.dsa-float.dsa-float-tall { overflow-y: auto; }\n\n/* ---------- phones (no left column: the box sits above the results, .dsa-inline) ----------\n   The logo sits in the box's left column, under the on/off switch, as wide as the switch (its\n   picture includes a 2px light grey outline, hence the 1.132). While scrolling, the box shrinks to\n   just that logo, left exactly where it is: everything else is hidden in place, so tapping the logo\n   opens the box around it without the logo moving. */\n#dsa-toggle .dsa-logo { display: none; }\n#dsa-toggle.dsa-inline { min-height: calc(92px + var(--dsa-upd, 0px)); }\n#dsa-toggle.dsa-inline:not(.dsa-float) { position: relative; }\n#dsa-toggle.dsa-inline .dsa-logo {\n  display: block;\n  position: absolute;\n  left: 9px;\n  top: calc(35px + var(--dsa-upd, 0px));\n  padding: 0;\n  margin: 0;\n  border: 0;\n  background: none;\n  line-height: 0;\n  cursor: default;\n}\n#dsa-toggle.dsa-inline .dsa-logo img,\n#dsa-toggle.dsa-inline .dsa-logo-text { display: block; width: calc(var(--dsa-logo-w, 40px) * 1.132); height: auto; }\n#dsa-toggle.dsa-inline .dsa-logo-text {\n  font: 700 30px/1 Arial, sans-serif;\n  color: #2e7d32;\n  text-shadow: -2px 0 #d6d6d6, 2px 0 #d6d6d6, 0 -2px #d6d6d6, 0 2px #d6d6d6;\n}\n#dsa-toggle.dsa-inline .dsa-logo-text b { color: #f5a623; font-size: 22px; vertical-align: top; }\n#dsa-toggle.dsa-inline.dsa-off .dsa-logo-text, #dsa-toggle.dsa-inline.dsa-off .dsa-logo-text b { color: #767676; }\n/* AmazonPlus off: the logo in grey. */\n#dsa-toggle.dsa-inline.dsa-off .dsa-logo img { filter: grayscale(1); }\n/* Shrunk: only the logo shows; the rest keeps its place, invisible and not in the way of taps. */\n#dsa-toggle.dsa-mini {\n  border-color: transparent !important;\n  background: transparent !important;\n  box-shadow: none !important;\n  pointer-events: none;\n}\n#dsa-toggle.dsa-mini > :not(.dsa-logo) { visibility: hidden; }\n/* Dragging: the box (desktop) or its logo (phones) can be moved; the cursor says so. */\n#dsa-toggle:not(.dsa-inline) { cursor: grab; touch-action: pinch-zoom; }\n#dsa-toggle:not(.dsa-inline) :is(input, button, a, label, select, summary, .dsa-scan, .dsa-pref, .dsa-switch) { cursor: pointer; }\n#dsa-toggle[data-dragging] { cursor: grabbing; user-select: none; -webkit-user-select: none; }\n#dsa-toggle.dsa-float .dsa-logo { touch-action: none; }\n#dsa-toggle .dsa-logo img { -webkit-user-drag: none; }\n#dsa-toggle.dsa-mini .dsa-logo { pointer-events: auto; cursor: pointer; }\n#dsa-toggle.dsa-mini .dsa-logo img { filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45)); }\n#dsa-toggle.dsa-mini.dsa-off .dsa-logo img { filter: grayscale(1) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45)); }\n/* Less room taken: no colour scale, and the status stays on one line (the script shrinks its text to fit). */\n#dsa-toggle.dsa-inline .dsa-legend { display: none; }\n#dsa-toggle.dsa-inline .dsa-status { white-space: nowrap; overflow: hidden; font-size: 12px; }\n\n.dsa-switch {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  cursor: pointer;\n  user-select: none;\n}\n.dsa-switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }\n.dsa-track {\n  position: relative;\n  flex: none;\n  width: 40px;\n  height: 22px;\n  border-radius: 11px;\n  background: #b9bdbd;\n  transition: background 0.15s;\n}\n.dsa-thumb {\n  position: absolute;\n  top: 3px;\n  left: 3px;\n  width: 16px;\n  height: 16px;\n  border-radius: 50%;\n  background: #fff;\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);\n  transition: transform 0.15s;\n}\n.dsa-switch input:checked + .dsa-track { background: #2e7d32; }\n.dsa-switch input:checked + .dsa-track .dsa-thumb { transform: translateX(18px); }\n.dsa-switch input:focus-visible + .dsa-track { outline: 2px solid #007185; outline-offset: 2px; }\n.dsa-label { font-size: 16px; font-weight: 700; }\n.dsa-unit { margin-bottom: 6px; }\n\n.dsa-status { margin: 6px 0 0 50px; font-size: 12px; color: #565959; }\n.dsa-legend { margin: 8px 0 0 50px; }\n.dsa-legend span {\n  display: block;\n  height: 6px;\n  border-radius: 3px;\n  background: linear-gradient(90deg, hsl(120 70% 40%), hsl(60 70% 45%), hsl(0 70% 45%));\n}\n\n/* ---------- rated cards ---------- */\n.dsa-paint {\n  background: var(--dsa-bg) !important;\n  box-shadow: inset 6px 0 0 var(--dsa-edge) !important;\n  border-radius: 8px;\n}\n/* Amazon paints white boxes inside the card; let the tint show through. */\n.dsa-paint .a-section,\n.dsa-paint .s-card-border,\n.dsa-paint .puis-card-border,\n.dsa-paint .s-card-container,\n.dsa-paint .puis-padding-left-small {\n  background: transparent !important;\n}\n/* Keep product photos true to colour: a plain white box behind the image, no blending. */\n.dsa-paint .s-product-image-container {\n  background: #fff !important;\n  border-radius: 6px;\n}\n.dsa-paint .s-image { mix-blend-mode: normal !important; }\n\n.dsa-dupe { display: none !important; }\n\n/* ---------- trust badge: a small pill over the card's top-right corner ---------- */\n.dsa-rated { position: relative; }\n.dsa-rated:has(.dsa-badge[open]) { z-index: 60; }\n.dsa-wide [data-cy=\"title-recipe\"] { padding-right: 130px; }       /* open popover sits above neighbouring cards */\n.dsa-badge {\n  position: absolute;\n  top: 6px;\n  right: 6px;\n  z-index: 30;\n  font: 12px/1.35 \"Amazon Ember\", Arial, sans-serif;\n  color: var(--dsa-ink);\n  text-align: left;\n}\n.dsa-badge > summary {\n  display: inline-block;\n  padding: 2px 8px;\n  border-radius: 11px;\n  background: var(--dsa-pill, var(--dsa-edge));\n  color: #fff;\n  font-weight: 700;\n  white-space: nowrap;\n  cursor: pointer;\n  list-style: none;\n  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);\n}\n.dsa-badge > summary::-webkit-details-marker { display: none; }\n.dsa-badge > summary::marker { content: \"\"; }\n.dsa-badge > summary::after { content: \" \\25BE\"; font-weight: 400; }\n.dsa-badge[open] > summary::after { content: \" \\25B4\"; }\n.dsa-badge .dsa-score { font-weight: 400; opacity: 0.85; }\n.dsa-badge li { margin: 1px 0; white-space: pre-wrap; padding-left: 2.2em; text-indent: -2.2em; }\n.dsa-badge li.dsa-good { color: #1e6b25; }\n.dsa-badge li.dsa-bad { color: #9b1c1c; }\n\n/* ---------- brand buttons (badge + manager) ---------- */\n.dsa-badge-body {\n  position: absolute;\n  top: calc(100% + 4px);\n  right: 0;\n  width: 280px;\n  max-width: 80vw;\n  max-height: 60vh;\n  overflow-y: auto;\n  padding: 10px 12px;\n  border: 1px solid var(--dsa-edge);\n  border-radius: 8px;\n  background: #fff;\n  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);\n}\n\n.dsa-badge .dsa-badge-body ul { margin: 0; padding: 0; list-style: none; background: none; }\n.dsa-brandrow {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 6px;\n  margin-top: 8px;\n  padding-top: 8px;\n  border-top: 1px solid rgba(0, 0, 0, 0.12);\n}\n.dsa-brandname { font-weight: 700; color: #0f1111; margin-right: auto; }\n.dsa-muted { color: #565959; font-size: 12px; }\n.dsa-btn {\n  font: 12px/1 \"Amazon Ember\", Arial, sans-serif;\n  padding: 5px 9px;\n  border: 1px solid #b9bdbd;\n  border-radius: 12px;\n  background: #fff;\n  color: #0f1111;\n  cursor: pointer;\n}\n.dsa-btn:hover { background: #f3f3f3; }\n.dsa-btn.dsa-trust { border-color: #2e7d32; color: #1e6b25; }\n.dsa-btn.dsa-block { border-color: #b71c1c; color: #9b1c1c; }\n.dsa-btn.dsa-on.dsa-trust { background: #2e7d32; color: #fff; }\n.dsa-btn.dsa-on.dsa-block { background: #b71c1c; color: #fff; }\n.dsa-btn.dsa-x { padding: 3px 8px; font-size: 14px; }\n.dsa-btn.dsa-reset { margin-left: auto; }\n\n.dsa-manage {\n  display: block;\n  margin: 8px 0 0 50px;\n  padding: 0;\n  border: 0;\n  background: none;\n  color: #007185;\n  font: 12px \"Amazon Ember\", Arial, sans-serif;\n  cursor: pointer;\n  text-align: left;\n}\n.dsa-manage:hover { text-decoration: underline; }\n.dsa-panel {\n  margin-top: 8px;\n  max-height: 360px;\n  overflow-y: auto;\n  font: 12px/1.4 \"Amazon Ember\", Arial, sans-serif;\n}\n.dsa-panel[hidden] { display: none; }\n.dsa-phead { margin: 8px 0 4px; font-weight: 700; font-size: 12px; }\n.dsa-plist { margin: 0; padding: 0; list-style: none; }\n.dsa-pitem {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 4px 6px;\n  padding: 4px 0;\n  border-bottom: 1px solid #eee;\n}\n.dsa-pname { font-weight: 700; margin-right: auto; word-break: break-word; }\n.dsa-ptag { font-size: 11px; padding: 1px 6px; border-radius: 8px; color: #fff; }\n.dsa-ptag.dsa-trust { background: #2e7d32; }\n.dsa-ptag.dsa-block { background: #b71c1c; }\n.dsa-pactions { display: flex; gap: 4px; width: 100%; justify-content: flex-end; }\n.dsa-pitem .dsa-btn { padding: 3px 7px; font-size: 11px; }\n.dsa-pfoot { display: flex; align-items: center; gap: 6px; margin-top: 10px; }\n\n/* ---------- promos / ad blocks between results ---------- */\n.dsa-clutter,\n.dsa-stray-head { display: none !important; }\n\n/* ---------- product page panel ---------- */\n.dsa-checked { font-weight: 700; }\n.dsa-product {\n  margin: 8px 0 10px;\n  padding: 8px 12px 8px 14px;\n  border-radius: 8px;\n  background: var(--dsa-bg);\n  box-shadow: inset 6px 0 0 var(--dsa-edge);\n  font: 13px/1.4 \"Amazon Ember\", Arial, sans-serif;\n  color: #0f1111;\n}\n.dsa-ph-head { display: flex; align-items: center; gap: 8px; }\n.dsa-ph-pill {\n  padding: 2px 9px;\n  border-radius: 11px;\n  background: var(--dsa-pill, var(--dsa-edge));\n  color: #fff;\n  font-weight: 700;\n}\n.dsa-ph-title { font-weight: 700; color: var(--dsa-ink); margin-left: auto; }\n.dsa-ph-delta { font-weight: 700; font-size: 15px; cursor: help; }\n.dsa-ph-delta.dsa-up { color: #1e6b25; }\n.dsa-ph-delta.dsa-down { color: #9b1c1c; }\n.dsa-ph-delta.dsa-same { color: #565959; }\n.dsa-ph-compare { margin-top: 6px; }\n.dsa-delta { font-weight: 700; padding: 1px 6px; border-radius: 8px; }\n.dsa-delta.dsa-up { color: #1e6b25; background: rgba(46, 125, 50, 0.12); }\n.dsa-delta.dsa-down { color: #9b1c1c; background: rgba(183, 28, 28, 0.1); }\n.dsa-delta.dsa-same { color: #565959; background: rgba(0, 0, 0, 0.06); }\n.dsa-ph-details { margin-top: 6px; }\n.dsa-ph-details > summary { cursor: pointer; color: #007185; }\n.dsa-ph-list { margin: 6px 0; padding: 0; list-style: none; }\n.dsa-ph-list li { margin: 1px 0; padding-left: 2.6em; text-indent: -2.6em; }\n.dsa-ph-list li.dsa-good { color: #1e6b25; }\n.dsa-ph-list li.dsa-bad { color: #9b1c1c; }\n.dsa-product-error { --dsa-bg: #f3f3f3; --dsa-edge: #888; --dsa-ink: #565959; }\n\n/* \"Found at MERCHANT for PRICE\" box, to the right of the price */\n.dsa-found {\n  float: right;\n  clear: right;\n  width: 44%;\n  max-width: 220px;\n  margin: 0 0 6px 8px;\n  padding: 6px 8px;\n  border-radius: 6px;\n  background: #00aaff;\n  font: 12px/1.35 \"Amazon Ember\", Arial, sans-serif;\n  position: relative;\n  z-index: 2;\n}\n.dsa-found a { color: #0f1111 !important; text-decoration: none; }\n.dsa-found a:hover { text-decoration: underline; }\n.dsa-found .dsa-found-main { display: block; font-weight: 700; }\n.dsa-found .dsa-found-google { display: block; margin-top: 3px; font-size: 10.5px; text-decoration: underline; }\n\n/* \"Scan for off-Amazon prices\" */\n.dsa-scanbox { margin: 8px 0 0 50px; }\n.dsa-scan {\n  display: block; width: 100%; padding: 5px 8px; border: 1px solid #00aaff; border-radius: 6px;\n  background: #e6f6ff; color: #0f1111; font: 12px/1.3 \"Amazon Ember\", Arial, sans-serif; text-align: left; cursor: pointer;\n}\n.dsa-scan:hover { background: #ccecff; }\n/* The price scan is experimental: a little bubbling flask on its button. */\n/* A one-line title (\"\u25be Scan off-Amazon prices\"; the flask in the top-right corner), then the radar\n   in the top-left corner of what's below it, the count and progress note wrapping round it. The\n   caret (as for Brands) folds the box to its title. */\n.dsa-scan { position: relative; display: block; box-sizing: border-box; padding: 5px 18px 5px 5px; font-size: 11px; line-height: 1.35; }\n.dsa-scan-head { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700; }\n.dsa-scan-body { margin-top: 4px; }\n.dsa-scan-body::after { content: \"\"; display: block; clear: both; }\n.dsa-radar { float: left; display: block; width: 32px; height: 32px; margin: 0 6px 2px 0; }\n.dsa-scan-caret {\n  display: inline; padding: 0 3px 0 0; margin: 0; border: 0; background: none;\n  color: #007185; font: inherit; font-weight: 400; line-height: inherit; cursor: pointer;\n}\n.dsa-scan-label { display: block; }\n.dsa-scan-note { display: block; margin-top: 2px; font-size: 9px; color: #4d5151; }\n.dsa-scan.dsa-fold .dsa-scan-body { display: none; }\n.dsa-flask-wrap { position: absolute; top: 3px; right: 4px; display: inline-flex; }\n.dsa-flask { width: 9px; height: 14px; }\n.dsa-flask { display: block; overflow: visible; }\n.dsa-flask-glass { fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }\n.dsa-flask-liquid { fill: #29a3e0; }\n.dsa-bub { fill: #ffffff; transform-box: fill-box; animation: dsa-bubble 2.4s ease-in infinite; }\n.dsa-bub3 { fill: currentColor; animation-name: dsa-bubble-out; animation-delay: 1.2s; }\n.dsa-bub2 { animation-delay: 0.8s; }\n@keyframes dsa-bubble { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 70% { opacity: 1; } 100% { transform: translateY(-4px); opacity: 0; } }\n@keyframes dsa-bubble-out { 0% { transform: translateY(2px); opacity: 0; } 25% { opacity: 0.8; } 100% { transform: translateY(-7px); opacity: 0; } }\n@media (prefers-reduced-motion: reduce) { .dsa-bub { animation: none; } .dsa-bub3 { opacity: 0.7; } }\n.dsa-scan:disabled { cursor: progress; opacity: 0.8; }\n.dsa-scan-note:empty { display: none; }\n\n/* ---------- Amazon's dark mode (html.dsa-dark, set when the page behind the results is dark) ---------- */\n/* Every text colour below is at least 4.5:1 on its background. */\n.dsa-dark #dsa-toggle { background: #1d2421; border-color: #6a9f3a; color: #e3e6e6; }\n.dsa-dark #dsa-toggle.dsa-float:not(.dsa-mini) { box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6); }\n.dsa-dark .dsa-track { background: #5f6363; }\n.dsa-dark .dsa-status,\n.dsa-dark .dsa-scan-note,\n.dsa-dark .dsa-muted { color: #b9bdbd; }\n.dsa-dark .dsa-manage,\n.dsa-dark .dsa-ph-details > summary { color: #4fc3e0; }\n.dsa-dark .dsa-scan { background: #0b3a52; color: #e3e6e6; }\n.dsa-dark .dsa-scan:hover { background: #0e4a68; }\n.dsa-dark .dsa-scan-caret { color: #6cc5ff; }\n.dsa-dark .dsa-badge-body { background: #22272a; color: #e3e6e6; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6); }\n.dsa-dark .dsa-badge li.dsa-good,\n.dsa-dark .dsa-ph-list li.dsa-good,\n.dsa-dark .dsa-ph-delta.dsa-up,\n.dsa-dark .dsa-delta.dsa-up { color: #86e08f; }\n.dsa-dark .dsa-badge li.dsa-bad,\n.dsa-dark .dsa-ph-list li.dsa-bad,\n.dsa-dark .dsa-ph-delta.dsa-down,\n.dsa-dark .dsa-delta.dsa-down { color: #ff9a8f; }\n.dsa-dark .dsa-ph-delta.dsa-same,\n.dsa-dark .dsa-delta.dsa-same { color: #b9bdbd; }\n.dsa-dark .dsa-brandname { color: #e3e6e6; }\n.dsa-dark .dsa-brandrow { border-top-color: rgba(255, 255, 255, 0.15); }\n.dsa-dark .dsa-pitem { border-bottom-color: #3a4044; }\n.dsa-dark .dsa-btn { background: #2b3134; border-color: #5f6363; color: #e3e6e6; }\n.dsa-dark .dsa-btn:hover { background: #363d41; }\n.dsa-dark .dsa-btn.dsa-trust { border-color: #4caf50; color: #86e08f; }\n.dsa-dark .dsa-btn.dsa-block { border-color: #e57373; color: #ff9a8f; }\n.dsa-dark .dsa-btn.dsa-on.dsa-trust { background: #2e7d32; color: #fff; }\n.dsa-dark .dsa-btn.dsa-on.dsa-block { background: #b71c1c; color: #fff; }\n.dsa-dark .dsa-product { color: #e3e6e6; }\n/* Product pages: Amazon's sale badges, list prices and sign-up offers, hidden while the a+ bug is in colour. */\nhtml.dsa-pdp-tidy .dsa-pdp-clutter { display: none !important; }\n#dsa-pdp-bug {\n  position: absolute; z-index: 50; height: 28px; margin: 0; padding: 0; border: 0; background: none; cursor: pointer; line-height: 0;\n  touch-action: none; user-select: none; -webkit-user-select: none;\n}\n#dsa-pdp-bug img { display: block; height: 100%; width: auto; pointer-events: none; }\n#dsa-pdp-bug[data-dragging] { cursor: grabbing; filter: drop-shadow(0 3px 6px rgba(0,0,0,.35)); }\n#dsa-pdp-bug.dsa-off img { filter: grayscale(1); opacity: .75; }\n#dsa-pdp-bug:focus-visible { outline: 2px solid #007185; outline-offset: 2px; border-radius: 4px; }\n.dsa-dark .dsa-product-error { --dsa-bg: #2b3134; --dsa-edge: #8a9093; --dsa-ink: #b9bdbd; }\n\n/* ---------- tile view (html.dsa-tiles) ----------\n   Amazon's row-by-row list becomes a grid of cards: each result's picture-left/text-right row is\n   stacked into a column, and everything else in the results area (headings, pagination) spans the\n   full width. Amazon's own tile searches come through unchanged in shape. */\nhtml.dsa-tiles .s-main-slot {\n  display: grid !important;\n  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)) !important;\n  grid-template-rows: none !important;\n  grid-auto-flow: row !important;\n  grid-auto-columns: auto !important;\n  gap: 12px 10px;\n  align-items: stretch;\n  margin: 0 !important;\n}\n@media (max-width: 600px) {\n  html.dsa-tiles .s-main-slot { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)) !important; gap: 8px 6px; }\n}\n/* Everything that isn't a tile spans the whole row, and each tile takes one column. !important:\n   Amazon's own grid classes say otherwise for some items (e.g. a banner it shows signed-in shoppers,\n   sg-col-20-of-24, \"span 20\"), which would add a run of hairline columns and squash every tile. */\nhtml.dsa-tiles .s-main-slot > * { grid-column: 1 / -1 !important; grid-row: auto !important; min-width: 0; }\nhtml.dsa-tiles .s-main-slot > .dsa-tile {\n  grid-column: auto / span 1 !important;\n  width: auto !important;\n  max-width: none !important;\n  padding: 0 !important;\n  margin: 0 !important;\n}\nhtml.dsa-tiles .s-main-slot > .dsa-tile > .sg-col-inner { height: 100%; padding: 0 !important; margin: 0 !important; }\nhtml.dsa-tiles .dsa-tile .s-widget-container:not(.dsa-tile div[data-component-type=\"s-search-result\"] *),\nhtml.dsa-tiles .dsa-tile .s-card-container:not(.dsa-tile div[data-component-type=\"s-search-result\"] *),\nhtml.dsa-tiles .dsa-tile .s-card-container > .a-section:not(.dsa-tile div[data-component-type=\"s-search-result\"] *) { height: 100%; box-sizing: border-box; }\nhtml.dsa-tiles .dsa-tile .puisg-row:not(.dsa-tile div[data-component-type=\"s-search-result\"] *) { flex-direction: column; flex-wrap: nowrap; margin: 0 !important; width: 100% !important; }\nhtml.dsa-tiles .dsa-tile .puisg-col:not(.dsa-tile div[data-component-type=\"s-search-result\"] *) {\n  width: 100% !important;\n  max-width: 100% !important;\n  min-width: 0 !important;\n  flex: none !important;\n  padding: 0 6px !important;\n  display: block !important;\n}\n/* Every tile's photo gets the same box, and Amazon's \"Best Seller\" / \"Overall Pick\" label sits over\n   its top-left corner instead of above it, so titles and prices line up across a row. */\nhtml.dsa-tiles .dsa-tile .puisg-col-inner:not(.dsa-tile div[data-component-type=\"s-search-result\"] *) { position: relative; }\nhtml.dsa-tiles .dsa-tile .s-list-status-badge-container:not(.dsa-tile div[data-component-type=\"s-search-result\"] *),\nhtml.dsa-tiles .dsa-tile .puis-status-badge-container:not(.dsa-tile div[data-component-type=\"s-search-result\"] *) {\n  position: absolute !important;\n  top: 4px;\n  left: 0;\n  z-index: 3;\n  width: auto !important;\n  height: auto !important;\n  margin: 0 !important;\n}\nhtml.dsa-tiles .dsa-tile .s-product-image-container:not(.dsa-tile div[data-component-type=\"s-search-result\"] *) {\n  height: 206px !important;\n  box-sizing: border-box;\n  overflow: hidden;\n  padding: 26px 0 0 !important;\n}\nhtml.dsa-tiles .dsa-tile .s-product-image-container img.s-image:not(.dsa-tile div[data-component-type=\"s-search-result\"] *) {\n  max-height: 180px !important;\n  width: auto !important;\n  max-width: 100% !important;\n  margin: 0 auto;\n  display: block;\n}\nhtml.dsa-tiles .dsa-tile h2:not(.dsa-tile div[data-component-type=\"s-search-result\"] *) { font-size: 14px !important; line-height: 1.35 !important; }\nhtml.dsa-tiles .dsa-tile [data-cy=\"title-recipe\"]:not(.dsa-tile div[data-component-type=\"s-search-result\"] *) { padding-right: 0 !important; }\n/* The trust stripe down a tile's left edge (6px) gets room of its own: text never runs into it,\n   whatever spacing Amazon's own card markup has (signed-out grid cards have almost none). */\nhtml.dsa-tiles .s-main-slot > .dsa-tile.dsa-paint,\nhtml.dsa-tiles .dsa-tile .dsa-paint:not(.dsa-tile div[data-component-type=\"s-search-result\"] *) { padding-left: 10px !important; box-sizing: border-box; }\nhtml.dsa-tiles .dsa-found { float: none; width: auto; max-width: none; margin: 4px 0 6px; }\n\n/* ---------- tidier result cards ----------\n   Hidden while AmazonPlus is on (put back when it's off): the long delivery wording (replaced by one\n   short \"Delivery DATE\" line), sustainability badges and their leaf, \"90-day low\" labels, and\n   crossed-out List/Typical/Was prices. */\n.dsa-trim { display: none !important; }\n.dsa-delivery { margin: 1px 0; font-size: 12px; line-height: 1.3; color: inherit; }\n/* The Prime line: the Prime arrow (about 30px) instead of \"Prime:\", kept to one line. */\n.dsa-delivery-prime { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.dsa-prime { display: inline-block; width: 30px; height: auto; margin: 0 4px 0 0; vertical-align: middle; }\n/* The Prime button decides which delivery line and prices show; the eco button, sustainability badges. */\nhtml:not(.dsa-has-prime) .dsa-delivery-prime,\nhtml:not(.dsa-has-prime) .dsa-prime-only,\nhtml.dsa-has-prime .dsa-delivery-noprime,\nhtml:not(.dsa-eco-on) .dsa-eco { display: none !important; }\n/* Non-Prime: the same arrow in dark red, slashed; a brighter red on Amazon's dark pages. */\n.dsa-dark .dsa-noprime { filter: brightness(1.6); }\n/* Amazon's \"Add to compare\" button: in the photo's bottom-left corner, white with black lines. */\n.dsa-photo { position: relative !important; }\n.dsa-compare {\n  position: absolute !important;\n  left: 6px !important;\n  bottom: 6px !important;\n  top: auto !important;\n  right: auto !important;\n  margin: 0 !important;\n  z-index: 5;\n  filter: invert(1) grayscale(1);\n}\n";
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
    requestTimeoutMs: 25000, // give up on a lookup the userscript manager never answers
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
    newListing: -8,
    sharedReviewPool: -8,
    sharedImage: -12,
    // Listing age (from the ASIN in search results; from "Date First Available" on product pages)
    asinPre2014: 20,      // before ~2014 (ASIN B000\u2026\u2013B00H\u2026)
    asin2014: 12,         // ~2014\u20132017 (B00I\u2026\u2013B06\u2026)
    asin2018: 8,          // ~2018\u20132019 (B07\u2026)
    asin2020: 4,          // ~2020\u20132022 (B08\u2026\u2013B0B\u2026)
                          // ~2023\u20132024 (B0C\u2026\u2013B0E\u2026): 0
    asinNew: -8,          // created in the last year or so (B0F\u2026 onward)
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
  root.DSA_LOGO = "data:image/webp;base64,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";
  // The Prime arrow (supplied by the project owner), shown before the Prime delivery line on result cards.
  root.DSA_PRIME_ARROW = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAAQCAYAAABKkhw/AAAEy0lEQVR42tWXX4hV1xnFf2ufe869M000tmpMC7HBJkWb1hQEH/JSbPLUgKBMzYMgfbLQpFJsdWYUrgOpZtKWSv/kJVRICU06EpKXllCSQh8EQwqtKSpWCialKk6hrdSZe/7t1Yd75no1Y60RWrvhHDZnH/be6/vW+vbaouvAlCIAM074smr+D9tHdntl1WHM5gngYUVWAjhwSYETqjja+xMvqT3hXygljfN8rfiOztJ1iylqkO9siBYGBNl4/Q1aydcVWA1AbB5jhGgBATzPy8ExBkZ5nJTjI3vLrUypApkxJ3c03i5CcnucV8K9yfdCm9UYKIjUlEQqWogEKKjJsQJPqr3Paxw5rpTlGKjj9/M0TDKlHjNOOIkHlL+jEuw+4Ak/7YwHVXAGczaaWYkr1EiB+5wwqYTHqTAwJ4Bsb7lZ7dbrVJS0SSk4QWR3fkhvDbR9pwK/SWuP+yuMcIQcbM6pr1lV2V7v0iiH6dGjRaevhfgzl+GZ4jmd7tPIgc8gxojof61xizEC60iYUgHQ/qbX+C6eDPP8ptfhOBCznOfVYSc1puR1NUD6oMc9oREO0qPEBEZIyOlZvOSKH5XTOjFYb6bR+H8z87Y4SgAYPk2y/f60zE4iO7SCj3qWH+SHtIuuR7OCkwp8kgAq2a6rRaABPeFdSjlMDVQUJGS0gZwK8YYjLxYZbzKlv18T7S4LRS5yAN82A2xxAPXrK3CA+po5ux7NajYpsh3YTIsOCZBzJsAX5w/qL9mEtyjjVWqiq/he8bHwWV1b+QagtyjhCAlLySmhKe7tZi8F5zFvOvBGUs0f602Pvr/opsecsA7dEtBTmKOLe4HRrldVJRuBL2EeU8YDAOREOgTK+C5V2JxP6xxANu5jStlIiyTO1TvK6dZPP7iZBdB7vJaUF9TmUXpApGqAQ0JCChjI+SfiJHBckXdqc6oU53hWf7utDI97WWruJ7A2KG4wYYNgPSn3EICyYaDI6AAFr+QVX2Va/wDIJr1ZgdfIEHNxJn822caMk8Wj34BmzEn2IHskxslYQg8wVUOzCIhAQgtImgAU4Mis4ALiPZvzEpeAWZnLNfRQYwkgBOgY7pZYbrNKYhVmteE+BVaQNav1JQZ10xMZI8gFF1WzPz+knwz2Dlm74HdaykO+zC/zlK1AwQF8Y7oNWc72uD/lFpOC7aSk5IOMhybrETe+RySEJgD9UQAksJugDDcNjdGMxwZg3y3VzfxAFElokQEl84Yjrci35w7qAl33tT6leFfXy4uC3yJ+VZw9+RRHHy4Wzu2b62vIX6eTfkSBpxQZo80S6oZapkIIE9AAlIeeYYBX1/TQe7E/3IyJ1kKmXfBXYIbIj4tDOnXDO8DTbvND5cMmhavxv5mNc+AUWigmnX1eHQPbFBkDNqgNjgPKgYlDtF2AcKO1PARswf2GgUwC0KM2vA38vFUwM/ddXRwA/XeeoOvAFB6+F9xaBb0OOEC6359XzSaJLxgekfkEWTOvB7RcLNcMwhCG+gZKahPfVwi/x/zagbeKZxrz8x87P2uxC5A+VAXt6yX0LxrXfL+nE1nrmvWOfA7iQ1L4uM1ywVJENpxY7DkTLgtmCfwZxz9iv1uH5A/VMk7zLV257lxOPnAe32L7F9gRRi/pf4G9AAAAAElFTkSuQmCC";
  // The same arrow in dark red with a slash through it: the Non-Prime delivery line.
  root.DSA_NOPRIME_ARROW = "data:image/png;base64,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";
  // The leaf (supplied by the project owner) on the "Showing eco" / "Hiding eco" button.
  root.DSA_LEAF = "data:image/png;base64,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";
})(typeof globalThis !== "undefined" ? globalThis : this);

;
// ---- src/radar.js ----
// AmazonPlus radar icons for the "Scan for off-Amazon prices" button: grey and still while idle,
// green and sweeping while a scan is on. Embedded so the script makes no request to fetch them.
(function (root) {
  root.DSA_RADAR_IDLE = "data:image/webp;base64,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";
  root.DSA_RADAR_SCAN = "data:image/webp;base64,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";
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
    if (era === "pre2014") add(reasons, W.asinPre2014, "Listed on Amazon since before ~2014", "age");
    else if (era === "2014") add(reasons, W.asin2014, "Listed on Amazon since ~2014\u20132017", "age");
    else if (era === "2018") add(reasons, W.asin2018, "Listed on Amazon since ~2018\u20132019", "age");
    else if (era === "2020") add(reasons, W.asin2020, "Listed on Amazon since ~2020\u20132022", "age");
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
    const c = asin[2], d = asin[3];
    if (c === "0") return d <= "H" ? "pre2014" : "2014";  // B000\u2026\u2013B00H\u2026: before ~2014; B00I\u2026\u2013B00Z\u2026: ~2014\u20132015
    if (c >= "1" && c <= "6") return "2014";         // B01\u2026\u2013B06\u2026: ~2015\u20132017
    if (c === "7") return "2018";                    // B07\u2026: ~2018\u20132019 (from mid-2017)
    if (c === "8" || c === "9" || c === "A" || c === "B") return "2020";  // B08\u2026\u2013B0B\u2026: ~2020\u20132022
    if (c >= "F") return "new";                      // B0F\u2026, B0G\u2026, B0H\u2026: 2025 onward
    return "mid";                                    // B0C\u2026\u2013B0E\u2026: ~2023\u20132024 (no points)
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
      const years = (now - first.getTime()) / (365.25 * 864e5), y = first.getFullYear();
      // The same bands as the ID estimate, by the year it was listed; recent ones by how long ago.
      const pts = years < 0.25 ? PW.veryNew : years < 1 ? W.asinNew :
                  y < 2014 ? W.asinPre2014 : y <= 2017 ? W.asin2014 : y <= 2019 ? W.asin2018 : y <= 2022 ? W.asin2020 : 0;
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
    const built = "0.15.1";
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
  // "90-day low" labels, "1K+ bought in past month", "Top reviewed for \u2026", and crossed-out
  // List / Typical / Was prices go. Found by their wording and
  // Amazon's strike-through marker, so it works with both the desktop and phone layouts.
  const TRIM = "dsa-trim";
  const txt = n => (n.textContent || "").replace(/\s+/g, " ").trim();
  const DELIVERY_LINE = /^(?:Join Prime to get |Or Non-members get |Or fastest delivery|Or Prime members get |FREE delivery|\$[\d.,]+ delivery|Delivery\b|Arrives\b)/i;
  // Amazon's sustainability badges ("Forestry practices \u2304", "Recycled materials +2 more \u2304", \u2026).
  const SUSTAIN = /^(?:Carbon impact|Recycled materials|Forestry practices|Safer chemicals|Organic content|Climate Pledge Friendly|Sustainability features?|\d+ sustainability features?|Compact by design|Reduced carbon|Water (?:conservation|efficiency)|Energy efficiency|Responsible packaging|Reduced packaging|Pre-owned certified|Remanufactured|Sustainable materials?|Fair trade|Social responsibility)\b/i;
  // \u2026and anything Amazon's own code labels as sustainability / Climate Pledge.
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
  // Prices only Prime members get ("Join Prime to buy this item at $X", "Prime Member Price", \u2026):
  // shown only with the Prime button on.
  // Not "Exclusive Prime price": there the card's main price is itself the Prime-only one, and the label
  // is the only sign of it, so it always stays.
  const PRIME_ONLY = /^(?:Join Prime to buy this item at\b|Prime Member (?:Price|price)\b|Lower price with Prime\b|With Prime\b).{0,60}$/i;

  // Amazon's delivery rows \u2192 our short lines:
  //   "Join Prime to get FREE delivery Tomorrow, Nov 16"             \u2192 Prime: Free Delivery Tomorrow, Nov 16
  //   "Or Non-members get FREE delivery Fri, Nov 20 on $35 of items\u2026" \u2192 Non-Prime: Free Delivery Fri, Nov 20 on $35+ orders
  //   "$5.99 delivery Nov 6 - 10" (no Prime/non-member split)         \u2192 $5.99 Delivery Nov 6 - 10
  // "Or fastest delivery \u2026" is left out.
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

  // ---------- Product pages: hiding the sales clutter ----------
  // While AmazonPlus is on, product pages lose: the "-41%" and "Lowest price in 30 days" badges, the
  // crossed-out List / Typical price, monthly-payment plans, Store Card offers, "Save up to 5% with business pricing", "Join Prime to get FREE delivery \u2026" (the non-member
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
  // stays, page after page and day after day, until its \u2715 is tapped (or the new version is installed).
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

  // One request through the userscript manager. Always settles: an answer, an error, or \u2014 if the
  // manager never calls back at all (seen in testing: "Checking\u2026" forever; e.g. Tampermonkey holding
  // the request while it asks permission to connect, or a manager that ignores `timeout`) \u2014 our own
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
    // The browser's own drag-and-drop (of an image or a link underneath) would take the pointer away.
    const noNativeDrag = e => { if (st) e.preventDefault(); };
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
      document.removeEventListener("dragstart", noNativeDrag, true);
      if (!was.on) return;
      delete handle.dataset.dragging;
      handle.dataset.dragged = "1";
      setTimeout(() => { delete handle.dataset.dragged; }, 0);
      o.end(was.last.x, was.last.y);
    };
    handle.addEventListener("pointerdown", e => {
      if (e.button !== 0 || (o.can && !o.can(e))) return;
      st = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false };
      document.addEventListener("dragstart", noNativeDrag, true);
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
        pb.title = hasPrime ? "Showing Prime delivery and prices \u2014 tap if you don't have Prime" : "Showing delivery and prices without Prime \u2014 tap if you have Prime";
      }
      if (eb) {
        eb.setAttribute("aria-pressed", String(showEco));
        eb.querySelector(".dsa-pref-text").textContent = showEco ? "Show" : "Hide";
        eb.title = showEco ? "Showing sustainability badges \u2014 tap to hide them" : "Sustainability badges hidden \u2014 tap to show them";
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
    if (caret) { caret.textContent = scanFold ? "\u25b8" : "\u25be"; caret.setAttribute("aria-expanded", scanFold ? "false" : "true"); }
    label.textContent = (scanOn ? "Tap to stop \u00b7 " : "") + `${Math.min(u.used, cap)}/${cap} used today`;
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
        scanNote = `Checking ${q}\u2026` + (scanQueue.length ? ` (${scanQueue.length} more in view)` : "");
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
          console.warn(`[AmazonPlus] price scan: ${q} \u2014 no answer (${res.why}${res.text ? ": " + res.text : ""})`);
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
      // Phones: less room, so the media and promo notes are left out.
      const narrow = !!status.closest(".dsa-inline");
      if (media && !narrow) extras.push(`${media} book${media === 1 ? "" : "s"}/media not rated`);
      if (hidden && !narrow) extras.push(`${hidden} promo${hidden === 1 ? "" : "s"} removed`);
      if (mode === "amazon") extras.push("Amazon's order");
      if (mode === "unit") extras.push("ordered by $/count");
      status.textContent = `${visible.length} rated \u00b7 ${tiers[5] + tiers[4]} trusted \u00b7 ${tiers[1]} junk` +
        (extras.length ? " \u00b7 " + extras.join(" \u00b7 ") : "");
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
      // At the very top, only when there's a newer version: a link to install it, and a \u2715 to put it away.
      el("div", { class: "dsa-update", hidden: "" },
        el("a", { href: UPDATE_URL, target: "_blank", rel: "noopener" }, "New version available"),
        el("sup", {}, el("button", { type: "button", class: "dsa-update-x", "aria-label": "Dismiss the new-version notice", on: { click: dismissUpdate } }, "\u2715"))),
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
      // The price scan, below Brands: a one-line title ("\u25be Scan off-Amazon prices", flask in the
      // corner: experimental), then the radar (grey and still; green and sweeping while scanning)
      // with today's count and what the scan is doing. Tapping the box starts or stops a scan; the
      // caret (like Brands') folds it to its title, and a tap on the folded box opens it again
      // rather than starting a scan.
      el("div", { class: "dsa-scanbox", hidden: "" },
        el("div", { class: "dsa-scan", role: "button", tabindex: "0", on: { click: onScanBox, keydown: e => { if (e.key === "Enter" || e.key === " ") onScanBox(e); } } },
          el("div", { class: "dsa-scan-head" },
            el("button", { type: "button", class: "dsa-scan-caret", "aria-label": "Show or hide the price scan" }, "\u25be"),
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
    } catch (e) { /* site storage blocked \u2014 nothing to clean */ }
    if ((await storeGet(KEY_OLD_UNIT_SORT, false)) === true && (await storeGet(KEY_SORT, undefined)) === undefined) {
      storeSet(KEY_SORT, "unit");
    }
    storeSet(KEY_OLD_UNIT_SORT, false);
    for (const old of ["dsaPrices", "dsaPrices2", "dsaPrices3", "dsaPricePause"]) if ((await storeGet(old, null)) !== null) storeSet(old, null);   // v0.8.0\u20130.8.5 Google price checks
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
