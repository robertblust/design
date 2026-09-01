import { test } from "node:test";
import assert from "node:assert/strict";
import { pageChecks } from "../verify/pages.mjs";

const OPTS = { SITE: "https://example.test", BASE: "http://127.0.0.1:8000" };

// The nineteen this module is responsible for. A body that quietly stops being exported takes
// its coverage from three suites at once, and every one of them still reports "all checks
// pass" — nothing else in the system would notice.
const EXPECTED = ["carriesLang", "card", "contains", "footer", "headerBaseline", "internalLinks",
  "landing", "lang", "links", "mobileNav", "navOrder", "noNewTab", "sameOrigin", "sameTab",
  "seo", "sourceLang", "storageKeys", "title", "wayOut"];

test("every shared check is present and callable", () => {
  const checks = pageChecks(OPTS);
  assert.deepEqual(Object.keys(checks).sort(), [...EXPECTED].sort());
  for (const n of EXPECTED) assert.equal(typeof checks[n], "function", `${n} is not callable`);
});

test("the factory refuses to build without the two values its bodies close over", () => {
  // Called with nothing, seo and card would compare against `undefined` and pass everything.
  assert.throws(() => pageChecks({}), /SITE/);
  assert.throws(() => pageChecks({ SITE: "https://example.test" }), /BASE/);
});

test("title holds the reconciled 65-character limit", () => {
  // Ruling 1. The number is the decision; if someone relaxes it back to 70 this says so.
  assert.match(pageChecks(OPTS).title.toString(), /length > 65/);
});

test("internalLinks inspects [src] and CSS url(), not only a[href]", () => {
  // The drift named at the top of the spec: the weaker version let a root-absolute [src]
  // through, which breaks under file://.
  const src = pageChecks(OPTS).internalLinks.toString();
  assert.match(src, /\[href\], \[src\]/);
  assert.match(src, /styleSheets/);
  assert.match(src, /url\\\(/);
});

test("card rewrites onto BASE, never onto location.origin", () => {
  // An origin carries no path. The weaker version dropped a /talks prefix and called a good
  // card unfetchable.
  //
  // Comments stripped before matching: the moved body's own explanatory comment names
  // "location.origin" in prose (to say the code does NOT use it), which would otherwise
  // trip this exact assertion on the correct, verbatim code. Stripped, this checks what it
  // is meant to — an actual code reference, not a word in an explanation of its absence.
  const src = pageChecks(OPTS).card.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /testBase/);
  assert.doesNotMatch(src, /location\.origin/);
});

test("two independently built check sets do not share mutable state", () => {
  // Each site calls the factory once; if the bodies were hoisted onto one shared object, the
  // last site to import would silently win SITE and BASE for all of them.
  const a = pageChecks({ SITE: "https://a.test", BASE: "http://a.local" });
  const b = pageChecks({ SITE: "https://b.test", BASE: "http://b.local" });
  assert.notEqual(a.seo, b.seo);
});
