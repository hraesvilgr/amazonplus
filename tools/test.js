// One command for the checks.
//   node tools/test.js                 build, then the scoring tests and the full page test side by side
//   node tools/test.js --only=phone    build, then just those page-test sections (no scoring tests),
//                                      for quick checks while changing the page code or styles
//   node tools/test.js --unit          build, then just the scoring tests (after changing the scoring)
// Extra arguments (a screenshot folder, --only=...) go to test/ui.test.js.
const { spawn } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const args = process.argv.slice(2);
const unitOnly = args.includes("--unit");
const quick = args.some(a => a.startsWith("--only="));
const uiArgs = args.filter(a => a !== "--unit");
const UNIT = ["score", "memory", "product", "pricecheck", "live"];

const run = (file, a = []) => new Promise(done => {
  const started = Date.now();
  const child = spawn(process.execPath, [path.join(root, file), ...a], { cwd: root });
  let out = "";
  child.stdout.on("data", d => out += d);
  child.stderr.on("data", d => out += d);
  child.on("close", code => done({ file, code, out, secs: ((Date.now() - started) / 1000).toFixed(1) }));
});

(async () => {
  const started = Date.now();
  const build = await run("tools/build_userscript.js");
  if (build.code) { process.stdout.write(build.out); process.exit(1); }

  const jobs = [];
  if (!quick) jobs.push(...UNIT.map(t => run(`test/${t}.test.js`)));
  if (!unitOnly) jobs.push(run("test/ui.test.js", uiArgs));
  const results = await Promise.all(jobs);

  let failed = 0;
  for (const r of results) {
    const fails = r.out.split("\n").filter(l => /^FAIL|Error/.test(l));
    const passes = (r.out.match(/^PASS/gm) || []).length;
    if (r.code) failed++;
    console.log(`${r.code ? "FAIL" : "ok  "}  ${r.file}  (${r.secs}s${passes ? `, ${passes} passed` : ""})`);
    if (r.code) console.log((fails.length ? fails : r.out.split("\n").slice(-15)).map(l => "      " + l).join("\n"));
  }
  console.log(`${failed ? failed + " failed" : "All passed"} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  process.exit(failed ? 1 : 0);
})();
