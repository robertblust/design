// checkDecks against throwaway trees, as test/cards-check.test.mjs checks the cards.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { checkDecks } from "../decks/check.mjs";
import { stamp } from "../decks/recipe.mjs";

// Armed at module scope for the reason test/cards-check.test.mjs gives: a real `process.exit`
// inside a test ends the run, and the tests after it are never reported.
process.exit = (code) => {
  throw new Error(`checkDecks must return a count, not process.exit(${code})`);
};

const DECK = { dir: "talks/intro", slug: "intro" };

// A throwaway site with one deck, both of its PDFs on disk and its stamp current.
function site() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "decks-check-"));
  fs.mkdirSync(path.join(root, "talks/intro"), { recursive: true });
  fs.writeFileSync(path.join(root, "talks/intro/index.html"), "<html></html>");
  for (const lang of ["de", "en"]) fs.writeFileSync(path.join(root, `talks/intro/intro-${lang}.pdf`), "pdf");
  stamp(DECK, root);
  return root;
}

function run(root, decks = [DECK]) {
  const logs = [];
  return { problems: checkDecks({ decks, root }, (m) => logs.push(m)), logs };
}

test("a deck whose stamp is its hash and whose PDFs are there passes", () => {
  const { problems, logs } = run(site());
  assert.equal(problems, 0);
  assert.deepEqual(logs, ["  ✓ talks/intro", "\n  every deck's PDFs match the deck they render"]);
});

test("a deck never stamped is counted and named, with the command that clears it", () => {
  const root = site();
  fs.rmSync(path.join(root, "talks/intro/pdf.sha"));
  const { problems, logs } = run(root);
  assert.equal(problems, 1);
  assert.equal(logs[0], "  ✗ talks/intro  never stamped");
  assert.ok(logs.some((l) => l.includes("run: npm run pdf")));
  assert.ok(logs.some((l) => l.includes("commit each pdf.sha with the PDFs that changed")));
});

test("a deck that moved since its PDFs were rendered is counted and named", () => {
  const root = site();
  fs.appendFileSync(path.join(root, "talks/intro/index.html"), "<!-- edited -->");
  const { problems, logs } = run(root);
  assert.equal(problems, 1);
  assert.equal(logs[0], "  ✗ talks/intro  the deck has changed since its PDFs were rendered");
});

test("a PDF that is not on disk is counted and named, though the stamp is current", () => {
  const root = site();
  fs.rmSync(path.join(root, "talks/intro/intro-en.pdf"));
  const { problems, logs } = run(root);
  assert.equal(problems, 1);
  assert.equal(logs[0], "  ✗ talks/intro/intro-en.pdf  is not on disk");
  assert.ok(!logs.includes("  ✓ talks/intro"));
});

test("a stale deck with neither PDF is three problems, each named", () => {
  const root = site();
  fs.appendFileSync(path.join(root, "talks/intro/index.html"), "<!-- edited -->");
  for (const lang of ["de", "en"]) fs.rmSync(path.join(root, `talks/intro/intro-${lang}.pdf`));
  assert.equal(run(root).problems, 3);
});

test("a site with no decks has nothing wrong with it", () => {
  assert.equal(run(site(), []).problems, 0);
});

// The property a site's CI leans on: `pdf:check` runs before the browser is installed. The
// check and the two recipes it reads are copied into a directory with no node_modules above it
// and imported there, which is what CI does, where a grep for import lines would miss a
// `createRequire` or a module-scope `await import`.
test("decks/check.mjs loads with no node_modules anywhere above it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "decks-check-isolated-"));
  for (const rel of ["decks/check.mjs", "decks/recipe.mjs", "cards/recipe.mjs"]) {
    fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
    fs.copyFileSync(new URL("../" + rel, import.meta.url), path.join(dir, rel));
  }
  fs.writeFileSync(path.join(dir, "loader.mjs"),
    'import("./decks/check.mjs").then(() => process.exit(0), () => process.exit(1));\n');
  assert.equal(spawnSync(process.execPath, ["loader.mjs"], { cwd: dir }).status, 0);
});
