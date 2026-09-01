import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockFor, FENCES } from "../lib/fences.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const versions = JSON.parse(fs.readFileSync(path.join(PKG, "versions.json"), "utf8"));

// Fixture fences for the tests below: registered directly on the live `FENCES` object rather
// than added to lib/fences.mjs, and always removed in a `finally` — they exist only for the
// duration of one test and must never leak into FENCE_NAMES or any other test file. `files` are
// written under test/fixtures/ before the fence is registered and unlinked again afterward,
// whether the test's callback throws or not.
function withFixtureFence(name, spec, files, run) {
  fs.mkdirSync(path.join(PKG, "test/fixtures"), { recursive: true });
  for (const [rel, body] of Object.entries(files)) fs.writeFileSync(path.join(PKG, rel), body);
  FENCES[name] = spec;
  try {
    run();
  } finally {
    delete FENCES[name];
    for (const rel of Object.keys(files)) fs.unlinkSync(path.join(PKG, rel));
    try { fs.rmdirSync(path.join(PKG, "test/fixtures")); } catch { /* not empty; other test's fixture is mid-flight */ }
  }
}

test("the prose reset block defines .mono, which two landing pages had lost", () => {
  assert.match(blockFor("prose reset", null),
    /\.mono\{font-family:"Plex Mono", ui-monospace, "SF Mono", Menlo, monospace\}/);
});

test("no block the package ships names a font family the sites do not ship", () => {
  // Generalised from a check that covered only "prose reset": blocks/footer.css and
  // blocks/footer-credit.css each name a family too, and the latter is never a fence source in
  // its own right — it only reaches a page through a part — so driving this off FENCE_NAMES
  // and blockFor would still miss it. Reads every file under blocks/ directly instead.
  const shipped = new Set([
    "instrument sans", "plex mono", "bricolage grotesque",                    // @font-face'd
    "ui-sans-serif", "system-ui", "sans-serif", "ui-monospace", "monospace",  // generic
    "-apple-system", "sf mono", "menlo",                                      // platform
  ]);
  const blocksDir = path.join(PKG, "blocks");
  const files = fs.readdirSync(blocksDir).filter((f) => /\.(css|js)$/.test(f));
  assert.ok(files.length > 0, "found no block files under blocks/ to check");
  for (const file of files) {
    const text = fs.readFileSync(path.join(blocksDir, file), "utf8");
    const named = [...text.matchAll(/font-family:([^;}\n]+)/g)]
      .flatMap((m) => m[1].split(",").map((f) => f.trim().replace(/^["']|["']$/g, "").toLowerCase()));
    const unknown = named.filter((f) => !shipped.has(f));
    assert.deepEqual(unknown, [], `${file} names ${unknown.join(", ")}`);
  }
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

test("a part is substituted before params, so a param slot inside a part's text is filled", () => {
  // Pins the order the parts loop must run in relative to the params loop: parts after
  // {{variant}}, before params. Moving either loop leaves npm test at the same total everywhere
  // else, because "prose footer" (the only shipped fence with a part) has no params — nothing
  // else in this file can tell the two orders apart. Needs a fixture fence that declares both a
  // part and a param, built here rather than added to the shipped manifest for one test.
  const sourceRel = "test/fixtures/ordering-source.css";
  const partRel = "test/fixtures/ordering-part.css";
  withFixtureFence("ordering fixture", {
    key: "orderingFixture", source: sourceRel, version: "v0",
    variants: ["on"], closes: null, params: ["p"],
    parts: { slot: { file: partRel, variants: ["on"] } },
  }, {
    [sourceRel]: "before\n{{slot}}after\n",
    [partRel]: "part-has-{{p}}-inside\n",
  }, () => {
    const out = blockFor("ordering fixture", "on", { p: "X" });
    assert.match(out, /part-has-X-inside/);
  });
});

test("a duplicated part slot is refused rather than shipping the part twice", () => {
  // The reviewer found this by hand: adding a second "{{credit}}" to blocks/footer.css shipped
  // the nine credit rules twice and still passed 104/104, because "both prose footer variants
  // agree on everything but the credit" strips credit lines by set membership from both sides
  // and cannot see how many times the part was actually spliced in.
  const sourceRel = "test/fixtures/duplicate-slot-source.css";
  withFixtureFence("duplicate slot fixture", {
    key: "dupFixture", source: sourceRel, version: "v0",
    variants: ["on"], closes: null,
    parts: { slot: { file: FENCES["prose footer"].parts.credit.file, variants: ["on"] } },
  }, {
    [sourceRel]: "before\n{{slot}}middle\n{{slot}}after\n",
  }, () => {
    assert.throws(() => blockFor("duplicate slot fixture", "on"), /appears 2 times/);
  });
});

test("the deck transport block is one form — it never drifted", () => {
  const css = blockFor("deck transport", null);
  assert.match(css, /\.transport\{/);
  // `.name{display:none}` is the one `.name` rule that belongs here rather than in `deck
  // lockup`: it is the bar's own statement that the lockup drops out of a collapsed,
  // single-column bar, not the lockup's identity, and it is byte-identical on all four
  // decks like the rest of this block. Everything else naming `.name` belongs to the
  // lockup's own fence, so it is the only `.name` rule this block may carry.
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const nameRules = withoutComments.match(/\.name\b[^{]*\{[^}]*\}/g) || [];
  assert.deepEqual(nameRules, [".name{display:none}"],
    "only the bar's own mobile-hide statement about the lockup belongs here");
});

test("the two-tier lockup carries a second tier's worth of rules the one-tier form has no use for", () => {
  // Keyed on rule count rather than a class name: the two families genuinely differ (a
  // presenter tier the product sites need and blust.ch does not), and a future rename of
  // `.nperson` or `.rbmark` must not make this test pass for the wrong reason — or stop
  // catching the real one, which is that a second, distinct tier of markup exists at all.
  const one = blockFor("deck lockup", "one");
  const two = blockFor("deck lockup", "two");
  assert.notEqual(one, two);
  const ruleCount = (css) => (css.match(/\{/g) || []).length;
  assert.ok(ruleCount(two) > ruleCount(one),
    "the two-tier form must declare more rules than the one-tier form — it renders a second, " +
    "independent element the one-tier form's markup does not have");
});

test("the one-tier lockup leaves no blank line where the second tier was", () => {
  assert.doesNotMatch(blockFor("deck lockup", "one").split("*/")[1] ?? "", /\n\s*\n/);
});

test("a deck lockup variant that does not exist is refused", () => {
  assert.throws(() => blockFor("deck lockup", "credit"), /only knows|needs a variant/);
});

test("both new deck fences carry balanced braces", () => {
  for (const [n, v] of [["deck transport", null], ["deck lockup", "one"], ["deck lockup", "two"]]) {
    const css = blockFor(n, v);
    assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, `${n} ${v}`);
  }
});

test("the deck fit block describes the canvas that exists, not the one that was removed", () => {
  const js = blockFor("deck fit", null);
  assert.match(js, /fixed-height/);
  assert.doesNotMatch(js, /1600×900|1600x900/,
    "a fixed 16:9 canvas was the bug — it letterboxed a 4:3 screen");
});

test("a disabled transport button does not light up under the pointer", () => {
  // :hover sets colour and background, so opacity alone leaves a disabled button
  // looking clickable. Both halves or neither.
  const css = blockFor("deck transport", null);
  assert.match(css, /\.tbtn:disabled\{[^}]*opacity/);
  assert.match(css, /\.tbtn:disabled:hover\{/);
});

test("the narrow-screen transport can still show a message", () => {
  // .lcd is hidden below 400px to make room; lcdMessage() puts transient text in the
  // same element, so it has to come back when there is something to say.
  const css = blockFor("deck transport", null);
  const narrow = css.match(/@media \(max-width: ?400px\)\{[\s\S]*?\n  \}/)[0];
  assert.match(narrow, /\.lcd\{display:none\}/);
  assert.match(narrow, /\.lcd:has\(\.n\.msg\)\{display:flex\}/);
});

test("the deck runtime reads its per-talk strings from TALK, not from literals", () => {
  const js = blockFor("deck runtime", null);
  assert.match(js, /title:TALK\.de\.title/);
  assert.match(js, /desc:TALK\.en\.desc/);
});

// The `UI` object literal's own text, isolated from the surrounding comments and code.
// Both tests below check something true of UI specifically, and a phrase that happens to
// recur in an unrelated comment elsewhere in the block must not be able to satisfy either.
function uiSource(js) {
  const m = js.match(/var UI = \{[\s\S]*?\n  \};/);
  assert.ok(m, "could not find the UI object literal in the deck runtime block");
  return m[0];
}

test("the deck runtime hardcodes no talk's own title", () => {
  // Not an enumeration of four remembered titles — that list named only English strings,
  // so putting a German literal back in TALK.de.title's place still passed. The property
  // that must hold is general: every `title:` and `desc:` inside UI is a `TALK.*`
  // reference, never a literal, in either language, for any deck's words at all.
  const ui = uiSource(blockFor("deck runtime", null));
  assert.doesNotMatch(ui, /\b(?:title|desc):\s*['"]/,
    "UI's title or desc is a literal string, not a TALK.* reference");
  // Non-vacuous: the reference form is actually present in both languages, not merely
  // absent of literals because the keys themselves are missing.
  assert.match(ui, /title:TALK\.de\.title/);
  assert.match(ui, /desc:TALK\.de\.desc/);
  assert.match(ui, /title:TALK\.en\.title/);
  assert.match(ui, /desc:TALK\.en\.desc/);
});

test("the deck runtime keeps the transport's own labels", () => {
  // The 28 UI keys that are identical on all four decks describe the transport, not
  // the talk, and stay in the block. Checked against UI's own text, not the whole file:
  // "Back to the start" also appears, coincidentally, in an unrelated comment elsewhere
  // in this block, which let a broken UI.en.first ("Return to start") pass this test's
  // earlier, unscoped form.
  const ui = uiSource(blockFor("deck runtime", null));
  for (const s of ["Sprecher-Notiz", "Speaker note", "Back to the start", "No voice"])
    assert.match(ui, new RegExp(s));
});

test("the deck runtime block declares no variants and no parameters", () => {
  assert.equal(FENCES["deck runtime"].variants, null);
  assert.equal(FENCES["deck runtime"].params, undefined);
  assert.equal(FENCES["deck runtime"].closes, null);
});
