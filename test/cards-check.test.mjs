// checkCards against throwaway trees, exactly like test/cards-recipe.test.mjs — a real site's
// pages and cards change, and a test that reads them stops meaning anything the day one does.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";

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

// CI runs og:check BEFORE npm ci, so cards/check.mjs must load with no node_modules anywhere on
// disk. A source grep for `^import ... from "..."` is defeated by three real forms that reach a
// third-party package at module scope without ever writing a matching import line:
// `createRequire(import.meta.url)("dep")` (its only *import* line is "node:module"), a
// module-scope `await import("dep")`, and `export { x } from "dep"`. All three would crash the
// real og:check in CI exactly like a static import would, so the gate has to be the thing CI
// actually does — resolve the module with no node_modules above it — not a grep of the source
// text. `Function.prototype.toString()` including comments is the same shape of problem: a
// textual check can be satisfied by text that isn't the behaviour it claims to guard.
//
// `mutate` prepends a line to a copy of the real cards/check.mjs, written into a fresh directory
// under os.tmpdir() — which has no node_modules in any parent directory, matching the state of a
// checkout before `npm ci` has ever run. A tiny loader in the same directory imports that copy by
// relative path (always resolvable, so it never itself throws) and exits 0 if the import settles,
// 1 if it rejects. The exit code is the observable: it is exactly what a shell sees when CI runs
// `npm run og:check` today.
function tryImportIsolated(mutate = (src) => src) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cards-check-isolated-"));
  const src = mutate(fs.readFileSync(new URL("../cards/check.mjs", import.meta.url), "utf8"));
  fs.writeFileSync(path.join(dir, "check.mjs"), src);
  fs.writeFileSync(path.join(dir, "loader.mjs"),
    'import("./check.mjs").then(() => process.exit(0), () => process.exit(1));\n');
  return spawnSync(process.execPath, ["loader.mjs"], { cwd: dir }).status;
}

test("cards/check.mjs resolves with no node_modules anywhere above it", () => {
  assert.equal(tryImportIsolated(), 0);
});

test("a plain static import of a foreign package is caught", () => {
  const mutate = (src) => `import { chromium } from "playwright";\n` + src;
  assert.notEqual(tryImportIsolated(mutate), 0);
});

test("createRequire(import.meta.url)(\"dep\") is caught though its only import is node:module", () => {
  const mutate = (src) =>
    'import { createRequire } from "node:module";\n' +
    'createRequire(import.meta.url)("some-dep");\n' + src;
  assert.notEqual(tryImportIsolated(mutate), 0);
});

test("a module-scope await import(...) of a foreign package is caught", () => {
  const mutate = (src) => 'await import("some-dep");\n' + src;
  assert.notEqual(tryImportIsolated(mutate), 0);
});

test("a re-export from a foreign package is caught", () => {
  const mutate = (src) => 'export { x } from "some-dep";\n' + src;
  assert.notEqual(tryImportIsolated(mutate), 0);
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

test("a stale card whose og.png is also light counts as two problems, not one", () => {
  // The base script this was ported from process.exit(1)s right after the staleness pass, so the
  // dark-background pass never runs on a stale tree — a card that is both stale and light was
  // reported once, by whichever pass ran first. checkCards keeps no such early return (Step 2:
  // "replace every process.exit(1) with an accumulated count"), so the two passes are independent
  // and additive. That is a deliberate behaviour change, not an accident, and nothing else in this
  // file exercises a card that trips both passes at once.
  const root = tree({ "index.html": "<html>v1</html>" });
  const { state, stamp } = recipeFor(root);
  const card = { dir: "." };
  stamp(card);
  fs.writeFileSync(path.join(root, "og.png"), makePNG(12, 12, LIGHT));
  fs.writeFileSync(path.join(root, "index.html"), "<html>v2</html>"); // now stale too
  const problems = checkCards({ cards: [card], state, REPO_ROOT: root }, () => {});
  assert.equal(problems, 2);
});

// decodePNG's real input is Chromium's screenshot() output: 8-bit RGBA (colorType 6, 4
// channels), five different row filters depending on what compresses best, never just filter 0.
// The fixtures above are uniform RGB with filter 0 on every row, which exercises exactly one of
// four colour types and one of five filter branches. This fixture instead hand-encodes a PNG
// whose four corners are four distinct, independently-computed colours, whose filler pixels
// (everywhere else, including the very edge — one pixel inside of each corner) are a different,
// much lighter colour, and whose rows cycle through all five PNG filter types. The unfiltered
// pixel values are known up front (they're what this function chooses to encode), so decodePNG's
// output can be checked against an independently-computed expected average luminance rather than
// merely against light/dark — a bug that reads the wrong corner, drops INSET, mishandles the
// fourth channel, or botches any one filter changes that number.
function encodeFilteredRGBA(width, height, cornerAt, corners, filler) {
  const channels = 4;
  const stride = width * channels;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      const [r, g, b, a] = cornerAt.has(key) ? corners[cornerAt.get(key)] : filler;
      const p = y * stride + x * channels;
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b; raw[p + 3] = a;
    }
  }
  const filtered = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const filterType = y % 5; // cycles None, Sub, Up, Average, Paeth across the image
    filtered[y * (stride + 1)] = filterType;
    for (let x = 0; x < stride; x++) {
      const cur = raw[y * stride + x];
      const a = x >= channels ? raw[y * stride + x - channels] : 0;
      const b = y > 0 ? raw[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? raw[(y - 1) * stride + x - channels] : 0;
      let pred;
      switch (filterType) {
        case 0: pred = 0; break;
        case 1: pred = a; break;
        case 2: pred = b; break;
        case 3: pred = (a + b) >> 1; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
      }
      filtered[y * (stride + 1) + 1 + x] = (cur - pred) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);  // bit depth
  ihdr.writeUInt8(6, 9);  // color type 6: RGBA — what Chromium's screenshot() actually writes
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter method
  ihdr.writeUInt8(0, 12); // interlace: none
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(filtered)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

test("decodePNG's real shape — RGBA, mixed filters, four distinct corners — is checked exactly", () => {
  const INSET = 4; // must match cards/check.mjs's own INSET; there is no export to read it from
  const width = 12, height = 12;
  const TL = [10, 12, 14, 255];
  const TR = [20, 22, 24, 255];
  const BL = [30, 28, 26, 255];
  const BR = [5, 6, 7, 255];
  const filler = [230, 225, 235, 255]; // bright — leaks into the average if INSET or the corner
                                        // coordinates are wrong, or if only one corner is sampled
  const cornerAt = new Map([
    [`${INSET},${INSET}`, "TL"],
    [`${width - 1 - INSET},${INSET}`, "TR"],
    [`${INSET},${height - 1 - INSET}`, "BL"],
    [`${width - 1 - INSET},${height - 1 - INSET}`, "BR"],
  ]);
  const png = encodeFilteredRGBA(width, height, cornerAt, { TL, TR, BL, BR }, filler);

  const root = tree({ "index.html": "<html>v1</html>" });
  const { state, stamp } = recipeFor(root);
  const card = { dir: "." };
  stamp(card);
  fs.writeFileSync(path.join(root, "og.png"), png);

  const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const expected = (lum(TL) + lum(TR) + lum(BL) + lum(BR)) / 4;
  assert.ok(expected < 0.5, "fixture sanity: all four corners must be below LIGHT_THRESHOLD");

  const logs = [];
  const problems = checkCards({ cards: [card], state, REPO_ROOT: root }, (m) => logs.push(m));
  assert.equal(problems, 0);
  assert.ok(logs.some((l) => l.includes(`background luminance ${expected.toFixed(2)}`)),
    `expected a logged luminance of ${expected.toFixed(2)}; got: ${logs.join(" | ")}`);
});
