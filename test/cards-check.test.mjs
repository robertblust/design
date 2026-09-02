// checkCards against throwaway trees, exactly like test/cards-recipe.test.mjs — a real site's
// pages and cards change, and a test that reads them stops meaning anything the day one does.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

import { checkCards } from "../cards/check.mjs";
import { recipeFor } from "../cards/recipe.mjs";

// A `process.exit` stub at module scope, not inside a test body. A real `process.exit(0)` inside
// a test truncated a run in this project into a green 199/199 — the run simply stopped and every
// test that hadn't executed yet was never reported as failing. Module scope means it is armed
// before the first test runs and stays armed for the whole file, so a `checkCards` that regresses
// to exiting instead of returning fails loudly rather than quietly ending the process.
process.exit = (code) => {
  throw new Error(`checkCards must return a count, not process.exit(${code})`);
};

// A throwaway site root, seeded with files.
function tree(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cards-check-"));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
}

// A minimal but real PNG, built with node's own zlib rather than faked — decodePNG is the thing
// under test, and a fake buffer would only prove the fake decodes, not that a real one does. The
// decoder reads corner pixels INSET (4) from each edge, so anything smaller than 2*INSET+2 has no
// interior left for the corners to be distinct pixels; 12x12 is comfortably bigger.
function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePNG(width, height, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);  // bit depth
  ihdr.writeUInt8(2, 9);  // color type 2: RGB
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter method
  ihdr.writeUInt8(0, 12); // interlace: none
  const rowBytes = width * 3;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0; // filter type 0 (none), for every row
    for (let x = 0; x < width; x++) {
      const p = rowStart + 1 + x * 3;
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const DARK = [12, 14, 19];    // ~0.05 luminance, same as this family's dark ground (#0C0E13)
const LIGHT = [250, 249, 245]; // ~0.98 luminance, same as this family's light ground (#FAF9F5)

test("cards/check.mjs imports nothing outside node's standard library", () => {
  // CI runs og:check BEFORE npm ci, so it is the cheapest step in the job. One non-node: import
  // moves a stale card's detection from that step to whoever notices the preview.
  const src = fs.readFileSync(new URL("../cards/check.mjs", import.meta.url), "utf8");
  let seen = 0;
  for (const [, spec] of src.matchAll(/^import[^"']*["']([^"']+)["']/gm)) {
    seen++;
    assert.ok(spec.startsWith("node:"), `${spec} is not a node: builtin`);
  }
  assert.ok(seen > 0, "no import lines matched — the regex itself may be broken");
});

test("an unstamped card counts as one problem and names itself never stamped", () => {
  const root = tree({ "index.html": "<html>v1</html>" });
  const { state } = recipeFor(root);
  const card = { dir: "." };
  const logs = [];
  const problems = checkCards({ cards: [card], state, REPO_ROOT: root }, (m) => logs.push(m));
  assert.equal(problems, 1);
  assert.ok(logs.some((l) => l.includes("never stamped")));
});

test("a card whose page changed since it was stamped counts as one problem", () => {
  const root = tree({ "index.html": "<html>v1</html>" });
  const { state, stamp } = recipeFor(root);
  const card = { dir: "." };
  stamp(card);
  fs.writeFileSync(path.join(root, "index.html"), "<html>v2</html>");
  const logs = [];
  const problems = checkCards({ cards: [card], state, REPO_ROOT: root }, (m) => logs.push(m));
  assert.equal(problems, 1);
  assert.ok(logs.some((l) => l.includes("the page has changed since it was rendered")));
});

test("a stamped card with a light-corner og.png counts as one problem", () => {
  const root = tree({ "index.html": "<html>v1</html>" });
  const { state, stamp } = recipeFor(root);
  const card = { dir: "." };
  stamp(card); // current, so the staleness pass reports nothing — isolates the dark-check pass
  fs.writeFileSync(path.join(root, "og.png"), makePNG(12, 12, LIGHT));
  const logs = [];
  const problems = checkCards({ cards: [card], state, REPO_ROOT: root }, (m) => logs.push(m));
  assert.equal(problems, 1);
  assert.ok(logs.some((l) => l.includes("light background")));
});

test("a current, dark card counts as zero problems and checkCards returns a number", () => {
  const root = tree({ "index.html": "<html>v1</html>" });
  const { state, stamp } = recipeFor(root);
  const card = { dir: "." };
  stamp(card);
  fs.writeFileSync(path.join(root, "og.png"), makePNG(12, 12, DARK));
  const logs = [];
  const problems = checkCards({ cards: [card], state, REPO_ROOT: root }, (m) => logs.push(m));
  // A returned number, not a process exit — the stub at module scope above throws if checkCards
  // ever calls process.exit instead, which would otherwise truncate this run silently green.
  assert.equal(typeof problems, "number");
  assert.equal(problems, 0);
  assert.ok(logs.some((l) => l.includes("every card matches the page it renders")));
  assert.ok(logs.some((l) => l.includes("every card renders dark")));
});
