// The manifest is the only place that knows where a shared file belongs inside a site.
// GitHub Pages serves the repository tree, so a destination path IS the file's public URL:
// getting one wrong does not fail a build, it 404s in production. Hence the assertions on
// shape — no absolute paths, no escapes, no duplicates.
//
// "files" is not a [from, to] pair like every other group: there is no source file on disk to
// copy, only a name lib/assemble.mjs turns into bytes. Its entries are compared and iterated
// separately below rather than folded into the generic [from, to] loops, which would otherwise
// destructure a plain string into its own characters and pass by accident.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GROUPS, GROUP_NAMES } from "../lib/groups.mjs";
import { FILE_NAMES } from "../lib/assemble.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COPIED_GROUPS = GROUP_NAMES.filter((n) => n !== "files");

test("names exactly the groups this release ships", () => {
  assert.deepEqual([...GROUP_NAMES].sort(), ["chat", "files", "fonts", "stage"]);
});

test("the chat group carries the widget's script and stylesheet", () => {
  const dests = GROUPS.chat.map(([, to]) => to).sort();
  assert.deepEqual(dests, ["chat.css", "chat.js"]);
});

test("every listed source file exists in the package", () => {
  for (const name of COPIED_GROUPS)
    for (const [from] of GROUPS[name])
      assert.ok(fs.existsSync(path.join(PKG, from)), `${name}: missing ${from}`);
});

test("no destination is absolute or escapes the site root", () => {
  for (const name of COPIED_GROUPS)
    for (const [, to] of GROUPS[name]) {
      assert.ok(!path.isAbsolute(to), `${name}: ${to} is absolute`);
      assert.ok(!to.split("/").includes(".."), `${name}: ${to} escapes the site root`);
    }
  for (const to of GROUPS.files) {
    assert.ok(!path.isAbsolute(to), `files: ${to} is absolute`);
    assert.ok(!to.split("/").includes(".."), `files: ${to} escapes the site root`);
  }
});

test("no destination is claimed by two groups", () => {
  const seen = new Map();
  for (const name of COPIED_GROUPS)
    for (const [, to] of GROUPS[name]) {
      assert.equal(seen.get(to), undefined, `${to} is claimed by ${seen.get(to)} and ${name}`);
      seen.set(to, name);
    }
  for (const to of GROUPS.files) {
    assert.equal(seen.get(to), undefined, `${to} is claimed by ${seen.get(to)} and files`);
    seen.set(to, "files");
  }
});

test("the stage group carries the card, the script, the stylesheet and the vendored d3", () => {
  const dests = GROUPS.stage.map(([, to]) => to).sort();
  assert.deepEqual(dests, ["card.js", "d3.v7.min.js", "stage.css", "stage.js"]);
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

test("the files group names exactly the files lib/assemble.mjs knows how to write", () => {
  assert.deepEqual([...GROUPS.files].sort(), [...FILE_NAMES].sort());
});

test("every file in the files group lands at the site's root, like chat.css does", () => {
  for (const name of GROUPS.files) assert.ok(!name.includes("/"), `${name} is not at the root`);
});
