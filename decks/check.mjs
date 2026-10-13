// Do each deck's PDFs still show the deck they were rendered from?
//
// It renders nothing and imports nothing outside node's standard library and this package's own
// recipes, so it needs no browser: a site's `pdf:check` runs beside its `og:check`, after
// `npm ci` and before `npx playwright install`. A site's `pdf-check.mjs` calls `checkDecks` and
// exits on what it returns; this module never exits on its own, for the reason `checkCards`
// does not.
//
// It over-reports and never under-reports, as the card check does: an edit to a comment in a
// deck marks its PDFs stale. Clearing that is `npm run pdf` and a commit, and the exporter
// leaves a PDF alone when every page of it came out as it was, so the commit is the stamp.
import { state } from "./recipe.mjs";

const WHY = {
  unstamped: "never stamped",
  stale: "the deck has changed since its PDFs were rendered",
};

export function checkDecks({ decks, root }, log = console.log) {
  let problems = 0;
  for (const deck of decks) {
    const s = state(deck, root);
    if (s.state !== "current") {
      problems += 1;
      log(`  ✗ ${s.dir}  ${WHY[s.state]}`);
    }
    for (const rel of s.missing) {
      problems += 1;
      log(`  ✗ ${rel}  is not on disk`);
    }
    if (s.state === "current" && !s.missing.length) log(`  ✓ ${s.dir}`);
  }
  if (problems) {
    log(`\n  ${problems} problem(s) with the decks' PDFs — run: npm run pdf`);
    log("  then commit each pdf.sha with the PDFs that changed.");
  } else {
    log("\n  every deck's PDFs match the deck they render");
  }
  return problems;
}
