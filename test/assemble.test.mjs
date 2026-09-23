// assemble() turns the blocks a fence already trusts into the bytes of a whole file — the
// shape README.md's *Fences* section says a file never needed: no gap in a page to bound, so
// no markers and no generated-file warning repeated once per block.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assemble, FILE_NAMES } from "../lib/assemble.mjs";
import { blockFor, FENCES } from "../lib/fences.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// The exact algorithm assemble()'s own stripMarkersAndDedent uses, written independently here
// rather than imported, so this test still means something if that private function regresses:
// it scans for the block's first "*/" to end the opening comment and drops the block's last
// line, the "end <fence>" marker, dedenting two spaces on everything in between.
function shadowStripAndDedent(block) {
  const lines = block.split("\n");
  let start = 0;
  for (; start < lines.length; start++)
    if (lines[start].includes("*/")) { start++; break; }
  const end = lines.length - 1;
  return lines.slice(start, end)
    .map((l) => (l.startsWith("  ") ? l.slice(2) : l))
    .join("\n");
}

// The parts each assembled file carries, read off lib/assemble.mjs's own FILES table (and
// README's "Whole files, assembled from a block"), so this test is pinned to what the package
// actually ships rather than to a copy nobody updates when a part is added or removed.
const FILE_PARTS = {
  "tokens.css": [["design tokens", () => "page"]],
  "page.css": [
    ["prose reset", () => null],
    ["header contract", () => null],
    ["title contract", () => null],
    ["prose footer", (c) => c.footer],
    ["principles", () => null],
    ["team", () => null],
    ["surfaces", () => null],
  ],
  "page.js": [
    ["language", () => "page"],
    ["theme", () => "page"],
    ["nav fit", () => "page"],
  ],
  "deck.css": [
    ["deck lockup", (c) => c.lockup],
    ["deck transport", () => null],
  ],
  "deck.js": [
    ["theme", () => "deck"],
    ["deck runtime", () => null],
    ["deck fit", () => null],
  ],
};

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

// Pinned to a real deck's own order, not a preference invented here: robertblust.github.io's
// talks/mental-model/index.html (commit 88e3391) carries the `deck lockup` fence at line 441
// and `deck transport` at line 490 — the page puts the lockup first. Both fences carry a
// `.name` rule at equal specificity, and a media query adds none, so whichever one this file
// emits second wins the cascade at a narrow viewport — design.mjs's own `lockupCollapses`
// comment tells the story of a release that shipped the lockup visible on mobile because two
// sites emitted the two fences in opposite order. Anchored on `.name{grid-column:1` (the
// lockup part's own opening selector, present only in blocks/deck-lockup-one.css and
// blocks/deck-lockup-two.css) rather than on `.name{` alone, because `deck transport` also
// carries a `.name{display:none}` rule of its own inside a mobile breakpoint, and a plain
// `.name{` search would find that one first regardless of which block actually came first.
test("deck.css carries the lockup's own rules before the transport's, the page's own order", () => {
  const css = assemble("deck.css", { lockup: "one" });
  const lockupAt = css.indexOf(".name{grid-column:1");
  const transportAt = css.indexOf(".transport{");
  assert.ok(lockupAt !== -1, "expected the lockup's own .name{grid-column:1 rule in deck.css");
  assert.ok(transportAt !== -1, "expected the transport's own .transport{ rule in deck.css");
  assert.ok(lockupAt < transportAt,
    `the lockup's first selector is at ${lockupAt}, the transport's at ${transportAt} — a real ` +
    "deck (talks/mental-model/index.html, commit 88e3391) carries the lockup fence before the " +
    "transport fence, and reversing that order lets the transport's mobile `.name{display:none}` " +
    "lose to the lockup's `.name{...display:flex...}` at equal specificity, breaking the " +
    "lockup's narrow-viewport collapse");
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

// The spec's first constraint for this shape — a file carries exactly the fenced bytes, markers
// removed and dedented — had nothing asserting it: every test above checks a symptom (a
// selector present, an order, a wrapper) rather than the bytes themselves. This checks every
// part of every file, both configured variants where a file takes one, against an independent
// strip-and-dedent of the same blockFor() call assemble() itself reads.
test("every part of every assembled file is exactly its block, markers removed and dedented", () => {
  const configs = [
    { footer: "plain", lockup: "one" },
    { footer: "credit", lockup: "two" },
  ];
  for (const name of FILE_NAMES) {
    for (const config of configs) {
      const text = assemble(name, config);
      for (const [fence, variantFn] of FILE_PARTS[name]) {
        const variant = variantFn(config);
        const expected = shadowStripAndDedent(blockFor(fence, variant));
        assert.ok(text.includes(expected),
          `${name} (${JSON.stringify(config)}) is missing the exact "${fence}" · ${variant ?? "shared"} ` +
          "block — its assembled bytes have drifted from blockFor() plus strip-and-dedent");
      }
    }
  }
});

// The other half of the guard above: a part with no closing "*/" anywhere strips to nothing,
// and assemble() must refuse to ship the gap rather than emit an empty part silently. Simulated
// by feeding blockFor's own source read a block with an opening comment that never closes —
// fs.readFileSync is the one seam both lib/fences.mjs and lib/assemble.mjs share, so patching it
// for the one path under test reaches the real assemble()/blockFor() call, not a rewritten copy.
test("assemble refuses a part that assembles to nothing, naming the fence and its source", () => {
  const real = fs.readFileSync;
  const tokensPath = path.join(PKG, "blocks/tokens.css");
  fs.readFileSync = (p, enc) => {
    if (p === tokensPath)
      return "/* ─── design tokens · v11 · {{variant}}\n   this comment never closes\n" +
        "/* ─── end design tokens ───\n";
    return real(p, enc);
  };
  try {
    assert.throws(() => assemble("tokens.css", {}), (e) =>
      /design tokens/.test(e.message) && /blocks\/tokens\.css/.test(e.message) &&
      /assembled to nothing/.test(e.message));
  } finally {
    fs.readFileSync = real;
  }
});
