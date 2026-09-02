// The recipe machinery, against throwaway trees rather than a real site's pages — a real site's
// pages change, and a test that reads them stops meaning anything the day one does.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { sources, recipe, stampOf, state, stamp, recipeFor } from "../cards/recipe.mjs";

// A throwaway site root, seeded with files.
function tree(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cards-recipe-"));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
}

test("root has no default on any of the five raw functions", () => {
  // The SITE_ROOT defect: a package module that works out where it is points into
  // node_modules. `Function.prototype.length` excludes a parameter that has a default value, so
  // this is unspoofable by whatever the default's downstream failure happens to say — a message
  // regex here previously let `root = "/root"` through, since the resulting
  // `ENOENT: open '/root/index.html'` happens to contain the word "root".
  for (const [name, fn] of Object.entries({ sources, recipe, stampOf, state, stamp }))
    assert.equal(fn.length, 2, `${name} has grown a default value on root`);
});

test("root is a required parameter, not derived", () => {
  // The SITE_ROOT defect: a package module that works out where it is points into
  // node_modules. If this ever passes with root omitted, the module has grown a default.
  assert.throws(() => sources("."), /path|root|undefined/i);
});

test("recipeFor defaults the root but does not swallow it", () => {
  const treeA = tree({ "index.html": "<html></html>" });
  const treeB = tree({
    "index.html": '<html><link href="x.css"></html>',
    "x.css": "body{}",
  });
  const bound = recipeFor(treeA);
  assert.deepEqual(bound.sources("."), ["index.html"]);                 // uses the default
  assert.deepEqual(bound.sources(".", treeB), ["index.html", "x.css"]); // override still works
});

// The test above exercises `sources` alone. Task 4's shared suite passes an explicit throwaway
// tmp root to all five bindings, not just `sources` — a binder that got that right for one and
// swallowed it for the rest would still pass the test above, and would break every other test
// that suite writes against `recipe`, `stampOf`, `state` or `stamp`. So each of the remaining
// four gets the same default-vs-override comparison here, against the raw (unbound) function
// called with the same root by hand.
test("recipeFor's override reaches recipe, stampOf, state and stamp too, not only sources", () => {
  const treeA = tree({ "index.html": "<html>A</html>" });
  const treeB = tree({ "index.html": "<html>B</html>" });
  const card = { dir: "." };
  const bound = recipeFor(treeA);

  assert.equal(bound.recipe(card), recipe(card, treeA));
  assert.equal(bound.recipe(card, treeB), recipe(card, treeB));
  assert.notEqual(bound.recipe(card, treeB), bound.recipe(card));

  assert.equal(bound.stampOf("."), stampOf(".", treeA));
  assert.equal(bound.stampOf(".", treeB), stampOf(".", treeB));
  assert.notEqual(bound.stampOf(".", treeB), bound.stampOf("."));

  assert.equal(bound.state(card).state, state(card, treeA).state);
  assert.equal(bound.state(card, treeB).want, state(card, treeB).want);
  assert.notEqual(bound.state(card, treeB).want, bound.state(card).want);

  bound.stamp(card, treeB);
  assert.equal(fs.readFileSync(stampOf(".", treeB), "utf8").trim(), recipe(card, treeB));
});

test("a link target is not a source but an asset is", () => {
  // The talks index links each deck's multi-megabyte PDF. Hashing link targets reported that
  // card stale on every `npm run pdf`, over a page that had not moved a pixel.
  // <link>, <img> and url() all count; <a href> does not.
  const t = tree({
    "index.html":
      '<html><link href="style.css"><a href="linked.pdf">talk</a></html>',
    "style.css": "body{}",
    "linked.pdf": "%PDF-1.4",
  });
  assert.deepEqual(sources(".", t), ["index.html", "style.css"]);   // not linked.pdf
});

test("an uppercase <A> tag is excluded from sources just like lowercase", () => {
  // The exception is spelled tag.toLowerCase() === "a" for exactly this reason: a page whose
  // markup (or a template's) writes <A href="deck.pdf"> would otherwise re-enter the recipe on
  // the tag-name check alone, bringing back "stale on every npm run pdf" for that page. The
  // href attribute itself stays lowercase here on purpose — ATTR only ever matches a lowercase
  // "href=", in every one of the three sites this module came from, so what's under test is
  // exactly the tag-name comparison, not attribute casing.
  const t = tree({
    "index.html": '<html><A href="deck.pdf">talk</A></html>',
    "deck.pdf": "%PDF-1.4",
  });
  assert.deepEqual(sources(".", t), ["index.html"]);
});

test("an <img src> and a CSS url() both count as sources", () => {
  const t = tree({
    "index.html": '<html><img src="pic.png"><style>.x{background:url(bg.png)}</style></html>',
    "pic.png": "png-bytes",
    "bg.png": "png-bytes-2",
  });
  assert.deepEqual(sources(".", t), ["bg.png", "index.html", "pic.png"]);
});

test("an absolute, protocol-relative, data: or mailto: reference is not a source", () => {
  const t = tree({
    "index.html": `<html>
      <link href="https://cdn.example.com/x.css">
      <link href="//cdn.example.com/y.css">
      <img src="data:image/png;base64,AAAA">
      <a href="mailto:a@b.com"></a>
    </html>`,
  });
  assert.deepEqual(sources(".", t), ["index.html"]);
});

test("a reference that escapes the site root is not a source", () => {
  const t = tree({ "index.html": '<html><link href="../../etc/passwd"></html>' });
  assert.deepEqual(sources(".", t), ["index.html"]);
});

test("a reference that escapes the site root is rejected even when the target exists", () => {
  // The previous test's target, ../../etc/passwd from an os.tmpdir() root, never exists, so
  // fs.existsSync a few lines below the ".." check was the thing actually rejecting it — deleting
  // the ".." check outright left that test green. This fixture puts a real file exactly one level
  // above the site root, where the escaping href points, so the ".." check is the only thing that
  // can keep it out: path.normalize("./" + "../secret.css") is "../secret.css", which genuinely
  // starts with "..", unlike a reference that merely climbs back out of a subdirectory.
  const container = fs.mkdtempSync(path.join(os.tmpdir(), "cards-recipe-escape-"));
  fs.writeFileSync(path.join(container, "secret.css"), "body{}");
  const root = path.join(container, "site");
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, "index.html"), '<html><link href="../secret.css"></html>');
  assert.deepEqual(sources(".", root), ["index.html"]);
});

test("key order in a card does not change the recipe", () => {
  const t = tree({ "index.html": "<html></html>" });
  const a = recipe({ dir: ".", width: 1200, height: 630 }, t);
  const b = recipe({ dir: ".", height: 630, width: 1200 }, t);
  assert.equal(a, b);
});

test("the recipe hashes what each source is named, not only its concatenated bytes", () => {
  // h.update(rel + "\0") runs ahead of each file's bytes precisely so the hash can't be fooled by
  // where one file's content ends and the next begins. Both trees below share one identical
  // index.html (so the difference isn't "the page changed") and reference the same two filenames,
  // a.css and b.css — only how many bytes landed in each file differs, and the two files'
  // contents concatenate to the same string ("XYZ") either way. Without a rel-name separator
  // ahead of each file's bytes, these two trees would hash identically despite genuinely
  // different files on disk.
  const page = '<html><link href="a.css"><link href="b.css"></html>';
  const treeA = tree({ "index.html": page, "a.css": "XY", "b.css": "Z" });
  const treeB = tree({ "index.html": page, "a.css": "X", "b.css": "YZ" });
  assert.notEqual(recipe({ dir: "." }, treeA), recipe({ dir: "." }, treeB));
});

test("a new knob on the card changes the recipe", () => {
  const t = tree({ "index.html": "<html></html>" });
  const a = recipe({ dir: ".", width: 1200 }, t);
  const b = recipe({ dir: ".", width: 1200, hide: ".chrome{display:none}" }, t);
  assert.notEqual(a, b);
});

test("stampOf names og.sha beside the card's own directory", () => {
  const t = tree({});
  assert.equal(stampOf("talks", t), path.join(t, "talks", "og.sha"));
});

test("state reports unstamped when no stamp has ever been written", () => {
  const t = tree({ "index.html": "<html></html>" });
  const card = { dir: ".", width: 1200 };
  assert.equal(state(card, t).state, "unstamped");
});

test("state reports current right after stamp writes, and stale once the page moves", () => {
  const t = tree({ "index.html": "<html>v1</html>" });
  const card = { dir: ".", width: 1200 };
  stamp(card, t);
  assert.equal(state(card, t).state, "current");

  fs.writeFileSync(path.join(t, "index.html"), "<html>v2</html>");
  assert.equal(state(card, t).state, "stale");
});
