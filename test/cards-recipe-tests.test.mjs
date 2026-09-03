// The shared suite, tested the only way a test suite can be: by running it, and by breaking the
// code underneath it and watching it go red.
//
// A `checkRecipe` that registers 32 tests which all trivially pass is indistinguishable from a
// correct one until something underneath it is broken. So a throwaway site is staged with its own
// copy of `cards/recipe.mjs`, the shared suite is run against it in a child process, and each
// mutation below deletes one line of that copy and names the shared tests that must fail. A
// mutation that leaves the suite green means the shared suite is not gating that line.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { SHARED_TEST_COUNT } from "../cards/recipe-tests.mjs";

const RECIPE = new URL("../cards/recipe.mjs", import.meta.url);
// `.href` and not `pathToFileURL(...pathname)`: a URL's pathname is already percent-encoded, so
// the round trip encodes it twice and the child cannot resolve the module from a repository
// checked out under a path containing a space.
const SHARED = new URL("../cards/recipe-tests.mjs", import.meta.url).href;

// A site, as small as one can be and still have the two "this repository" tests mean something:
// one page, one card, one og.png beside it. `import.meta.dirname` stands in for the site's
// REPO_ROOT, which is how a real site's og-recipe.mjs derives it.
const RUNNER = `
import { recipeFor } from "./recipe.mjs";
import { checkRecipe } from ${JSON.stringify(SHARED)};

const REPO_ROOT = import.meta.dirname;
const cards = [{ dir: ".", hide: ".x{display:none}", width: 1200, height: 630, clipY: 23 }];

checkRecipe({ cards, REPO_ROOT, ...recipeFor(REPO_ROOT) });
`;

// Runs the shared suite against a staged site whose recipe.mjs has been through `mutate`.
const staged = [];
after(() => {
  for (const root of staged) fs.rmSync(root, { recursive: true, force: true });
});

function runShared(mutate = (src) => src) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shared-recipe-"));
  staged.push(root);
  const mutated = mutate(fs.readFileSync(RECIPE, "utf8"));

  fs.writeFileSync(path.join(root, "index.html"), "<p>the page</p>");
  fs.writeFileSync(path.join(root, "og.png"), "a card, as far as these tests care");
  fs.writeFileSync(path.join(root, "recipe.mjs"), mutated);
  fs.writeFileSync(path.join(root, "shared.test.mjs"), RUNNER);

  // A child `node --test` that inherits NODE_TEST_CONTEXT decides it is already inside a test
  // run, prints "run() is being called recursively", runs nothing and exits 0 — which reads here
  // as a suite of zero tests that nothing can break.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;

  const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "shared.test.mjs"],
    { cwd: root, encoding: "utf8", env });
  const out = run.stdout + run.stderr;

  // Top-level results only: node's TAP reporter indents subtests, and these have none. Counting
  // these lines counts registrations that actually ran — `Function.prototype.toString()` includes
  // comments, so a source scan for `test(` is defeated by a comment, which is how three tests in
  // this project were defeated before.
  const results = [...out.matchAll(/^(not )?ok \d+ - (.*)$/gm)].map((m) => ({
    failed: Boolean(m[1]),
    name: m[2].trim(),
  }));
  return { status: run.status, out, results, failed: results.filter((r) => r.failed).map((r) => r.name) };
}

// Deleting a line rather than editing one: an edit that still compiles to the same behavior
// would report a false negative here, and every line below is load-bearing on its own.
const cut = (needle) => (src) => {
  assert.ok(src.includes(needle), `cards/recipe.mjs no longer contains ${JSON.stringify(needle)}`);
  return src.replace(needle, "");
};

const MUTATIONS = [
  {
    what: "the <a> skip is deleted, so a page's link targets are hashed",
    mutate: cut(`if (tag.toLowerCase() === "a") continue;`),
    red: [
      "a file the page only links to is not a source",
      "a file the page draws is a source even next to a link",
      "an uppercase link is still a link",
    ],
  },
  {
    what: "the key sort is deleted, so a card's hash follows the order its keys were typed in",
    mutate: cut(`.sort(([a], [b]) => (a < b ? -1 : 1))`),
    red: ["reordering a card's keys does not change the recipe"],
  },
  {
    what: "file contents stop being hashed, so only the list of source paths counts",
    mutate: cut(`h.update(fs.readFileSync(path.join(root, rel)));`),
    red: [
      "editing the page changes the recipe",
      "swapping a font the page never mentions by name changes the recipe",
      "a card whose page moved after it was stamped is stale",
    ],
  },
  {
    what: "the is-it-a-file guard is deleted, so a directory reference becomes a source",
    mutate: cut(` && fs.statSync(abs).isFile()`),
    red: ["a directory the page links to is not a source"],
  },
  {
    what: "the escape guard is deleted, so a reference climbing above the root is hashed",
    mutate: cut(`if (rel.startsWith("..")) continue;`),
    red: ["a reference climbing above the repository root is not a source"],
  },
];

test("checkRecipe registers exactly SHARED_TEST_COUNT tests", () => {
  const { results, out } = runShared();
  assert.equal(results.length, SHARED_TEST_COUNT, out);
});

// Two tests merged during the union carried the same assertion under two names. A third name
// colliding with an existing one would keep the count at 32 while quietly costing a test, so the
// names are asserted distinct rather than merely counted.
test("no two of the shared tests share a name", () => {
  const { results } = runShared();
  const names = results.map((r) => r.name);
  // The floor matters: at zero registrations both sides are 0 and this passes vacuously, which is
  // exactly what it did while a broken module specifier had the child running nothing at all.
  assert.equal(names.length, SHARED_TEST_COUNT);
  assert.equal(names.length, new Set(names).size, "two shared tests answer to the same name");
});

test("the shared suite passes against an intact site", () => {
  const { status, failed, out } = runShared();
  assert.deepEqual(failed, [], out);
  assert.equal(status, 0, out);
});

for (const { what, mutate, red } of MUTATIONS) {
  test(`the shared suite goes red when ${what}`, () => {
    const { status, failed, results, out } = runShared(mutate);
    assert.notEqual(status, 0, `the suite stayed green:\n${out}`);
    assert.equal(results.length, SHARED_TEST_COUNT, out);
    for (const name of red) {
      assert.ok(failed.includes(name), `"${name}" stayed green with ${what}:\n${failed.join("\n")}`);
    }
  });
}
