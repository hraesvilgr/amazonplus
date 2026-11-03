// Measures the userscript's memory footprint on the stand-in results page, and checks for leaks.
// Run: node test/memory-footprint.js
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, "..");
const { page: html, GM_SHIM } = require("./standin.js");
const userscript = fs.readFileSync(path.join(root, "dist/disenshittify-amazon.user.js"), "utf8");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.route("https://www.amazon.com/**", r => r.fulfill({ contentType: "text/html", body: html }));
  await ctx.route(/media-amazon\.com/, r => r.abort());
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Performance.enable");
  const measure = async label => {
    await cdp.send("HeapProfiler.collectGarbage");
    const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(x => [x.name, x.value]));
    console.log(label.padEnd(44), "JS heap", (m.JSHeapUsedSize / 1048576).toFixed(2), "MB  DOM nodes", m.Nodes, " listeners", m.JSEventListeners);
    return m;
  };
  await p.goto("https://www.amazon.com/s?k=baguette+tray");
  await p.evaluate(() => localStorage.setItem("gm:dsaEnabled", "true"));
  const base = await measure("Page alone");
  await p.evaluate(GM_SHIM);
  await p.addScriptTag({ content: `(function(){${userscript}\n})();` });
  await p.waitForSelector(".dsa-badge");
  const after = await measure("With AmazonPlus on");
  // Simulate a busy page: 300 bursts of DOM churn (ads, carousels), plus 40 sort switches / toggles.
  for (let i = 0; i < 300; i++) await p.evaluate(() => { const d = document.createElement("div"); d.textContent = "x"; document.body.appendChild(d); d.remove(); });
  await p.waitForTimeout(500);
  for (let i = 0; i < 20; i++) {
    await p.click("#dsa-toggle .dsa-switch"); await p.click("#dsa-toggle .dsa-switch");
  }
  await p.waitForTimeout(500);
  const churn = await measure("After 300 page changes + 40 toggles");
  console.log(`\nScript's own footprint: ${((after.JSHeapUsedSize - base.JSHeapUsedSize) / 1048576).toFixed(2)} MB JS heap, ${after.Nodes - base.Nodes} DOM nodes`);
  console.log(`Growth after churn: ${((churn.JSHeapUsedSize - after.JSHeapUsedSize) / 1048576).toFixed(2)} MB, ${churn.Nodes - after.Nodes} nodes, ${churn.JSEventListeners - after.JSEventListeners} listeners`);
  await browser.close();
})();
