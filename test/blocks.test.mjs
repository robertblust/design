import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockFor, FENCES } from "../lib/fences.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const versions = JSON.parse(fs.readFileSync(path.join(PKG, "versions.json"), "utf8"));

test("the prose reset block defines .mono, which two landing pages had lost", () => {
  assert.match(blockFor("prose reset", null),
    /\.mono\{font-family:"Plex Mono", ui-monospace, "SF Mono", Menlo, monospace\}/);
});

test("the prose reset block names no font family the sites do not ship", () => {
  const shipped = new Set([
    "instrument sans", "plex mono", "bricolage grotesque",                    // @font-face'd
    "ui-sans-serif", "system-ui", "sans-serif", "ui-monospace", "monospace",  // generic
    "-apple-system", "sf mono", "menlo",                                      // platform
  ]);
  const named = [...blockFor("prose reset", null).matchAll(/font-family:([^;}\n]+)/g)]
    .flatMap((m) => m[1].split(",").map((f) => f.trim().replace(/^["']|["']$/g, "").toLowerCase()));
  const unknown = named.filter((f) => !shipped.has(f));
  assert.deepEqual(unknown, [], `names ${unknown.join(", ")}`);
});

test("the prose reset block balances every brace it opens", () => {
  // `closes` is null: unlike the token block, this one opens and closes every rule it
  // contains. Counted rather than eyeballed at the last line — an earlier assertion of this
  // shape compared the penultimate line against "}" and passed for a trailing newline.
  const css = blockFor("prose reset", null);
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
});

test("the prose reset fence declares no variants and no parameters", () => {
  assert.equal(FENCES["prose reset"].variants, null);
  assert.equal(FENCES["prose reset"].params, undefined);
  assert.equal(FENCES["prose reset"].closes, null);
  assert.equal(FENCES["prose reset"].version, versions.reset);
});

test("a fence with no variants refuses one", () => {
  assert.throws(() => blockFor("prose reset", "page"), /takes no variant/);
});

test("the two prose footer variants emit different bytes", () => {
  const credit = blockFor("prose footer", "credit");
  const plain  = blockFor("prose footer", "plain");
  assert.notEqual(credit, plain);
  assert.match(credit, /footer \.credit\{/);
  assert.doesNotMatch(plain, /\.credit/);
});

test("both prose footer variants agree on everything but the credit", () => {
  // Dropped by exact line, not by an ".credit" substring test: the credit rules wrap across
  // lines (a font-family and font-size continuation neither name ".credit"), and a substring
  // filter leaves those two lines behind to fail the comparison for a reason that has nothing
  // to do with the credit slot.
  const creditLines = new Set(
    fs.readFileSync(path.join(PKG, FENCES["prose footer"].parts.credit.file), "utf8")
      .replace(/\n$/, "").split("\n"));
  const strip = (s) => s.split("\n")
    .filter((l) => !creditLines.has(l))
    .filter((l) => !/· (credit|plain) ·|· (credit|plain) ─/.test(l))
    .join("\n");
  assert.equal(strip(blockFor("prose footer", "credit")),
               strip(blockFor("prose footer", "plain")));
});

test("the plain prose footer leaves no blank line where the credit was", () => {
  // An empty replacement that keeps its own newline makes the two variants differ by
  // whitespace on every page taking `plain`, and that difference is invisible in review and
  // permanent in the diff. Scoped past the header comment's closing `*/`: the comment's own
  // paragraph breaks are blank lines too, the same shape every block in this package carries,
  // and they have nothing to do with the credit slot the block's CSS rules hold.
  const plain = blockFor("prose footer", "plain");
  const rules = plain.slice(plain.indexOf("*/") + 2);
  assert.doesNotMatch(rules, /\n\s*\n/);
});

test("no slot is left unsubstituted in either variant", () => {
  // The failure this catches is a part declared in FENCES but never reached by blockFor:
  // the literal "{{credit}}" ships into sixteen pages as a CSS parse error that error
  // recovery swallows, and design:check then reports every page as matching.
  for (const v of ["credit", "plain"])
    assert.doesNotMatch(blockFor("prose footer", v), /\{\{[a-z]+\}\}/i);
});

test("a prose footer variant that does not exist is refused", () => {
  assert.throws(() => blockFor("prose footer", "page"), /needs a variant/);
});

test("a part is supplied only to the variants that declare it", () => {
  // The mechanism, asserted independently of this one fence's content.
  assert.deepEqual(FENCES["prose footer"].parts.credit.variants, ["credit"]);
});
