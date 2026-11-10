// Builds dist/disenshittify-amazon.user.js — the same extension as a single userscript
// for Violentmonkey / Tampermonkey / Greasemonkey (no Mozilla signing needed).
// Run: node tools/build_userscript.js
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const manifest = JSON.parse(read("manifest.json"));

// Userscript managers wrap the script in a function, so top-level `var`s wouldn't be global.
const js = ["src/config.js", "src/logo.js", "src/brands.js", "src/bigrams.js", "src/scorer.js", "src/memory.js", "src/product.js", "src/pricecheck.js", "src/content.js"]
  .map(f => `// ---- ${f} ----\n` + read(f))
  .join("\n;\n")
  .replace("var DSA_CONFIG =", "globalThis.DSA_CONFIG =")
  .replace("var DSA_BIGRAMS =", "globalThis.DSA_BIGRAMS =")
  .replace("var DSA_BRANDS =", "globalThis.DSA_BRANDS =");

const header = `// ==UserScript==
// @name         AmazonPlus
// @namespace    disenshittify-amazon
// @version      ${manifest.version}
// @description  ${manifest.description}
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
`;
const css = `(function () {
  const style = document.createElement("style");
  style.id = "dsa-styles";
  style.textContent = ${JSON.stringify(read("src/styles.css"))};
  (document.head || document.documentElement).appendChild(style);
})();
`;
// Escape every non-ASCII character so the script survives being opened or pasted
// with the wrong text encoding (a mangled character inside a regex breaks the whole script).
const toAscii = str => str.replace(/[^\x00-\x7f]/g, ch =>
  "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
const out = path.join(root, "dist", "disenshittify-amazon.user.js");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, toAscii(header + "\n" + css + "\n" + js));
console.log("wrote", out, fs.statSync(out).size, "bytes");
