// AmazonPlus — brand memory.
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

  // Map of brand key → "trust" | "block" for every brand that has earned a verdict.
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
