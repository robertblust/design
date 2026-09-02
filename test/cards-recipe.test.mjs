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

test("root is a required parameter, not derived", () => {
  // The SITE_ROOT defect: a package module that works out where it is points into
  // node_modules. If this ever passes with root omitted, the module has grown a default.
  assert.throws(() => sources("."), /root|undefined/i);
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

test("key order in a card does not change the recipe", () => {
  const t = tree({ "index.html": "<html></html>" });
  const a = recipe({ dir: ".", width: 1200, height: 630 }, t);
  const b = recipe({ dir: ".", height: 630, width: 1200 }, t);
  assert.equal(a, b);
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
