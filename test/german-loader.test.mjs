// The German loader is a pure function of the file it is given, tested on a fixture for the
// same reason as the others: a test that reads a real site's principles.de.json passes for the
// wrong reason the day that file moves. Ported from blust.ch's build/renderers.test.mjs, whose
// four tests here are the source of truth; the two after them are new, pinning down the one
// thing that changed in the move — the message now names the file the caller passed rather
// than a literal `build/principles.de.json`.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadGerman, strings } from "../lib/render/german.mjs";

const germanFile = (entries) => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rb-de-")), "de.json");
  fs.writeFileSync(f, JSON.stringify(entries));
  return f;
};

test("de returns the German for the exact English, and nothing for a near miss", () => {
  const g = loadGerman(germanFile([{ en: "One.", de: "Eins." }]));
  assert.equal(g.de("One."), "Eins.");
  assert.throws(() => g.de("One"), /no German for: "One"/);
});

test("an entry no English asked for is reported, because the model's English moved", () => {
  const g = loadGerman(germanFile([{ en: "Old words.", de: "Alte Worte." }, { en: "Kept.", de: "Behalten." }]));
  g.de("Kept.");
  assert.deepEqual(g.unused(), ["Old words."]);
});

test("the file refuses two entries for the same English", () => {
  assert.throws(() => loadGerman(germanFile([{ en: "A", de: "B" }, { en: "A", de: "C" }])), /twice/);
});

test("strings lists what the two pages translate, once each", () => {
  const data = { entities: [
    { id: "vision", type: "vision", name: "V, w", tagline: "T.", path: "model/vision.md", sections: [{ heading: "H", text: "P1.\n\nP2." }] },
    { id: "values/a", type: "value", name: "A", tagline: "At.", path: "model/values/a.md", sections: [{ heading: "In practice", text: "B.\n\nI never x." }] },
  ] };
  assert.deepEqual(strings(data), ["V, w", "T.", "H", "P1.", "P2.", "A", "At.", "B.", "I never x."]);
});

// The two below are new to the move: blust.ch's loader named its own literal path in every
// message, which was correct only because blust.ch was the only caller. A package three sites
// share cannot bake in one of their filenames, so the message names whichever file the caller
// passed, relative to the working directory the build actually ran from.
const relFile = (entries) => {
  const dir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-german-loader-"));
  const f = path.join(dir, "site.de.json");
  fs.writeFileSync(f, JSON.stringify(entries));
  return f;
};
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("a missing German names the file it should be added to, not build/principles.de.json", () => {
  const file = relFile([{ en: "One.", de: "Eins." }]);
  try {
    const g = loadGerman(file);
    const rel = path.relative(process.cwd(), file);
    assert.throws(() => g.de("Two."), new RegExp(`add it to ${escapeRe(rel)}$`));
  } finally {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  }
});

test("two entries for the same English name the file that holds them, not a hard-coded path", () => {
  const file = relFile([{ en: "A", de: "B" }, { en: "A", de: "C" }]);
  try {
    const rel = path.relative(process.cwd(), file);
    assert.throws(() => loadGerman(file), new RegExp(`${escapeRe(rel)} holds the English twice`));
  } finally {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  }
});
