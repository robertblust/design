// The manifest is the only place that knows where a shared file belongs inside a site.
// GitHub Pages serves the repository tree, so a destination path IS the file's public URL:
// getting one wrong does not fail a build, it 404s in production. Hence the assertions on
// shape — no absolute paths, no escapes, no duplicates.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GROUPS, GROUP_NAMES } from "../lib/groups.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("names exactly the two groups this release ships", () => {
  assert.deepEqual([...GROUP_NAMES].sort(), ["fonts", "stage"]);
});

test("every listed source file exists in the package", () => {
  for (const name of GROUP_NAMES)
    for (const [from] of GROUPS[name])
      assert.ok(fs.existsSync(path.join(PKG, from)), `${name}: missing ${from}`);
});

test("no destination is absolute or escapes the site root", () => {
  for (const name of GROUP_NAMES)
    for (const [, to] of GROUPS[name]) {
      assert.ok(!path.isAbsolute(to), `${name}: ${to} is absolute`);
      assert.ok(!to.split("/").includes(".."), `${name}: ${to} escapes the site root`);
    }
});

test("no destination is claimed by two groups", () => {
  const seen = new Map();
  for (const name of GROUP_NAMES)
    for (const [, to] of GROUPS[name]) {
      assert.equal(seen.get(to), undefined, `${to} is claimed by ${seen.get(to)} and ${name}`);
      seen.set(to, name);
    }
});

test("the stage group carries the script, the stylesheet and the vendored d3", () => {
  const dests = GROUPS.stage.map(([, to]) => to).sort();
  assert.deepEqual(dests, ["d3.v7.min.js", "stage.css", "stage.js"]);
});

test("the fonts group carries all four faces, under fonts/", () => {
  const dests = GROUPS.fonts.map(([, to]) => to).sort();
  assert.deepEqual(dests, [
    "fonts/Bricolage-var.woff2",
    "fonts/InstrumentSans-var.woff2",
    "fonts/PlexMono-400.woff2",
    "fonts/PlexMono-600.woff2",
  ]);
});
