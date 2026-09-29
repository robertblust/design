// docs/design-system/ is the design system's map, and a map is only worth reading while it is
// whole and says nothing the source does not. Nothing generates it, so these are the checks
// that keep it honest: every block and every shipped file has an entry, every link lands, and
// no page restates a value or a version, which the source masters and a page would let go
// stale. The last check is the other direction: what a color role means is stated once, on
// the tokens page, and no block or asset may say it again.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GROUPS, GROUP_NAMES } from "../lib/groups.mjs";
import { FILE_NAMES } from "../lib/assemble.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DOCS = path.join(PKG, "docs", "design-system");
const PAGES = fs.readdirSync(DOCS).filter((f) => f.endsWith(".md")).sort();
const read = (f) => fs.readFileSync(path.join(DOCS, f), "utf8");
const MAP = read("README.md");

// Every [text](target) on a page, with the page it sits on.
function links() {
  const out = [];
  for (const page of PAGES) {
    for (const m of read(page).matchAll(/\]\(([^)\s]+)\)/g)) out.push({ page, target: m[1] });
  }
  return out;
}

// The repository files the pages link, as paths from the package root.
function linkedFiles() {
  return new Set(links()
    .filter(({ target }) => !/^[a-z]+:/.test(target) && !target.startsWith("#"))
    .map(({ page, target }) => path.relative(PKG, path.resolve(DOCS, path.dirname(page), target.split("#")[0])))
    .map((p) => p.replace(/\/$/, "")));
}

// GitHub's anchor for a heading: lowercased, punctuation dropped, spaces to hyphens.
const slug = (h) => h.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s/g, "-");
const anchors = (page) => new Set([...read(page).matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1])));

test("the map links every block", () => {
  const linked = linkedFiles();
  const missing = fs.readdirSync(path.join(PKG, "blocks"))
    .map((f) => `blocks/${f}`)
    .filter((f) => !linked.has(f));
  assert.deepEqual(missing, [], `blocks with no entry in docs/design-system: ${missing.join(", ")}`);
});

test("the pages link every file a group ships, and the fonts as their folder", () => {
  const linked = linkedFiles();
  const shipped = GROUP_NAMES.filter((n) => n !== "files")
    .flatMap((n) => GROUPS[n].map(([from]) => from))
    .filter((from) => !from.startsWith("assets/fonts/"))
    .filter((from) => !from.endsWith(".LICENSE.txt") || from.includes("octicons"));
  const missing = shipped.filter((f) => !linked.has(f));
  assert.deepEqual(missing, [], `shipped files with no entry in docs/design-system: ${missing.join(", ")}`);
  assert.ok(linked.has("assets/fonts"), "the fonts folder is linked");
});

test("the map names every group and every whole file", () => {
  for (const name of GROUP_NAMES.filter((n) => n !== "files")) {
    assert.match(MAP, new RegExp("`" + name + "`"), `group ${name} is named in the map`);
  }
  for (const name of FILE_NAMES) {
    assert.match(MAP, new RegExp("`" + name.replace(".", "\\.") + "`"), `file ${name} is named in the map`);
  }
});

test("every link on the pages lands, anchors included", () => {
  for (const { page, target } of links()) {
    if (/^[a-z]+:/.test(target)) continue;
    const [file, anchor] = target.split("#");
    const dest = file ? path.resolve(DOCS, path.dirname(page), file) : path.join(DOCS, page);
    assert.ok(fs.existsSync(dest), `${page} links ${target}, which does not exist`);
    if (anchor && dest.endsWith(".md") && dest.startsWith(DOCS)) {
      assert.ok(anchors(path.basename(dest)).has(anchor), `${page} links ${target}, a heading that does not exist`);
    }
  }
});

test("no page restates a value or a version", () => {
  for (const page of PAGES) {
    const text = read(page).replace(/\]\([^)]*\)/g, "]()");
    const hex = text.match(/#[0-9a-fA-F]{3,8}\b/);
    assert.equal(hex, null, `${page} carries a color value, ${hex && hex[0]}; the tokens master values`);
    const version = text.match(/(?<![.\w])v\d+(\.\d+)*\b/);  // not d3.v7, a file name
    assert.equal(version, null, `${page} carries a version, ${version && version[0]}; versions.json masters versions`);
  }
});

test("what a color role means is stated on the tokens page and nowhere in the source", () => {
  const norm = (s) => s.toLowerCase().replace(/[—–:;,."“”'’()]/g, " ").replace(/\s+/g, " ").trim();
  const table = read("tokens.md").split("## Color roles")[1].split("\n## ")[0];
  const means = [...table.matchAll(/^\| `(--c-[a-z]+)` \| ([^|]+) \|/gm)].map((m) => ({ role: m[1], text: norm(m[2]) }));
  assert.ok(means.length > 0, "the tokens page's Color roles table was read");
  const sources = ["blocks", "assets"].flatMap((d) => fs.readdirSync(path.join(PKG, d))
    .filter((f) => /\.(css|js)$/.test(f))
    .map((f) => ({ file: `${d}/${f}`, text: norm(fs.readFileSync(path.join(PKG, d, f), "utf8")) })));
  for (const { role, text } of means) {
    for (const src of sources) {
      assert.ok(!src.text.includes(text), `${src.file} restates what ${role} means; it is stated once, in docs/design-system/tokens.md`);
    }
  }
});
