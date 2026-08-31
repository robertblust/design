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
