// assemble() turns the blocks a fence already trusts into the bytes of a whole file — the
// shape README.md's *Fences* section says a file never needed: no gap in a page to bound, so
// no markers and no generated-file warning repeated once per block.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assemble, FILE_NAMES } from "../lib/assemble.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("names exactly the five files this release assembles", () => {
  assert.deepEqual([...FILE_NAMES].sort(),
    ["deck.css", "deck.js", "page.css", "page.js", "tokens.css"]);
});

test("page.css with a plain footer carries the reset's and the header's own rules", () => {
  const css = assemble("page.css", { footer: "plain" });
  assert.match(css, /\*\{box-sizing:border-box; margin:0; padding:0\}/);
  assert.match(css, /nav\{display:flex; align-items:center; gap:1\.9rem;/);
});

test("page.css with a plain footer carries no credit lockup", () => {
  const css = assemble("page.css", { footer: "plain" });
  assert.doesNotMatch(css, /footer \.credit/);
});

test("page.css with a credit footer carries the credit lockup", () => {
  const css = assemble("page.css", { footer: "credit" });
  assert.match(css, /footer \.credit\{/);
});

test("page.css carries no fence marker, opening or closing", () => {
  const css = assemble("page.css", { footer: "plain" });
  assert.doesNotMatch(css, /─── prose reset/);
  assert.doesNotMatch(css, /─── end prose reset/);
  assert.doesNotMatch(css, /─── header contract/);
  assert.doesNotMatch(css, /─── end header contract/);
});

test("an unknown or missing footer names the file and the key", () => {
  assert.throws(() => assemble("page.css", {}), (e) => /page\.css/.test(e.message) && /footer/.test(e.message));
  assert.throws(() => assemble("page.css", { footer: "loud" }), /footer/);
});

test("deck.css with the one-tier lockup carries the namemark and not the rbmark", () => {
  const css = assemble("deck.css", { lockup: "one" });
  assert.match(css, /\.name \.namemark\{/);
  assert.doesNotMatch(css, /\.name \.rbmark/);
});

// blocks/deck-lockup-two.css carries both marks — the product's own namemark in its first
// tier and the person's rbmark in the second, "· ROBERT BLUST" — so unlike the "one" variant
// above, "two" is not a plain mirror image: it gains the rbmark rather than losing the
// namemark. Read directly off blocks/deck-lockup-two.css; see the task report.
test("deck.css with the two-tier lockup carries the rbmark", () => {
  const css = assemble("deck.css", { lockup: "two" });
  assert.match(css, /\.name \.rbmark\{/);
});

test("an unknown or missing lockup names the file and the key", () => {
  assert.throws(() => assemble("deck.css", {}), (e) => /deck\.css/.test(e.message) && /lockup/.test(e.message));
});

test("tokens.css closes its own :root rule", () => {
  const css = assemble("tokens.css", {});
  const lines = css.split("\n").filter((l) => l.length > 0);
  assert.equal(lines[lines.length - 1], "}");
});

test("tokens.css carries no fence marker", () => {
  const css = assemble("tokens.css", {});
  assert.doesNotMatch(css, /─── design tokens/);
  assert.doesNotMatch(css, /─── end design tokens/);
});

test("page.js and deck.js are one IIFE each", () => {
  const page = assemble("page.js", {});
  const deck = assemble("deck.js", { lockup: "one" });
  for (const js of [page, deck]) {
    assert.match(js, /\(function \(\) \{\n/);
    assert.match(js, /\n\}\)\(\);\n$/);
  }
});

test("every assembled file opens with a comment naming the package and the release", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG, "package.json"), "utf8"));
  for (const name of FILE_NAMES) {
    const config = { footer: "plain", lockup: "one" };
    const text = assemble(name, config);
    assert.match(text, new RegExp(`@robertblust/design v${pkg.version.replace(/\./g, "\\.")}`));
    assert.match(text, /npm run design/);
  }
});

test("every assembled file ends in exactly one newline", () => {
  for (const name of FILE_NAMES) {
    const config = { footer: "plain", lockup: "one" };
    const text = assemble(name, config);
    assert.ok(text.endsWith("\n"), `${name} does not end in a newline`);
    assert.ok(!text.endsWith("\n\n"), `${name} ends in more than one newline`);
  }
});
