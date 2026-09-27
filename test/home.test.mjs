// The home renderer is a pure function of the artifact, tested on a fixture for the same
// reason as the others: a test that reads a real model passes for the wrong reason the day it moves.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeHome, numberWord, neverOf } from "../lib/render/home.mjs";

const value = (slug, name, last) => ({ id: `values/${slug}`, type: "value", name, tagline: `${name} tagline.`,
  path: `model/values/${slug}.md`, sections: [{ heading: "In practice", text: `Body of ${name}.\n\n${last}` }] });
const DATA = {
  commit: "0".repeat(40), repo: "example/model", root: "Someone", rootId: "identity", types: [], edges: [],
  entities: [
    { id: "vision", type: "vision", name: "One model, true everywhere", tagline: "Whoever asks & gets it.", path: "model/vision.md", sections: [] },
    value("b", "Bee", "I never sting."),
    value("a", "Ay", "I never <shout>."),
  ],
};
const PAGE = "<main>\n      <!-- vision:start -->\n      old\n      <!-- vision:end -->\n" +
  "      <!-- values:start -->\n      old\n      <!-- values:end -->\n</main>\n";
const HEADING = { en: "{n} values, each with the thing <em>I never do</em>.", de: "{n} Werte, jeder mit dem, was ich <em>nie tue</em>." };
const de = (en) => "DE:" + en;
const into = (data, opts = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-home-"));
  fs.writeFileSync(path.join(dir, "index.html"), PAGE);
  writeHome(data, { root: dir, de, heading: HEADING, ...opts });
  return fs.readFileSync(path.join(dir, "index.html"), "utf8");
};

test("the vision is its name, turned at the comma, and its tagline", () => {
  const page = into(DATA);
  assert.ok(page.includes(`<h2 data-de="DE:One model, <em>true everywhere</em>.">One model, <em>true everywhere</em>.</h2>`), page);
  assert.ok(page.includes(`<p class="lede" data-de="DE:Whoever asks &amp;amp; gets it.">Whoever asks &amp; gets it.</p>`), page);
});

test("a vision with no comma stops the build rather than guess where to turn", () => {
  const data = { ...DATA, entities: DATA.entities.map((e) => e.type === "vision" ? { ...e, name: "One model" } : e) };
  assert.throws(() => into(data), /no comma/);
});

test("the values follow the path order, each linking its anchor and showing its I never line", () => {
  const page = into(DATA);
  assert.ok(page.indexOf("Ay") < page.indexOf("Bee"));
  assert.ok(page.includes(`<a href="principles/#a"><b data-de="DE:Ay">Ay</b><span data-de="DE:I never &amp;lt;shout&amp;gt;.">I never &lt;shout&gt;.</span></a>`), page);
});

test("the heading's number is written from the model, in both languages", () => {
  const page = into(DATA);
  assert.ok(page.includes(`<h2 data-de="Zwei Werte, jeder mit dem, was ich <em>nie tue</em>.">Two values, each with the thing <em>I never do</em>.</h2>`), page);
  assert.equal(numberWord(5, "en"), "Five");
  assert.equal(numberWord(5, "de"), "Fünf");
  assert.throws(() => numberWord(1, "en"), /between two and twelve/);
});

test("a heading without German is written without data-de", () => {
  const page = into(DATA, { heading: { en: HEADING.en } });
  assert.ok(page.includes(`<h2>Two values, each with the thing <em>I never do</em>.</h2>`));
});

test("a value whose last paragraph is not an I never line stops the build, naming it", () => {
  assert.equal(neverOf(DATA.entities[1]), "I never sting.");
  const data = { ...DATA, entities: [...DATA.entities, value("c", "Sea", "Always swim.")] };
  assert.throws(() => into(data), /values\/c/);
});

test("the home page needs German for the model's words", () => {
  assert.throws(() => into(DATA, { de: undefined }), /needs de/);
});

test("check mode reports the page and writes nothing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-home-"));
  fs.writeFileSync(path.join(dir, "index.html"), PAGE);
  assert.deepEqual(writeHome(DATA, { root: dir, de, heading: HEADING, check: true }), ["index.html"]);
  assert.equal(fs.readFileSync(path.join(dir, "index.html"), "utf8"), PAGE);
  writeHome(DATA, { root: dir, de, heading: HEADING });
  assert.deepEqual(writeHome(DATA, { root: dir, de, heading: HEADING, check: true }), []);
});

test("a page missing a region is an error, not a page half written", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-home-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<main></main>\n");
  assert.throws(() => writeHome(DATA, { root: dir, de, heading: HEADING }), /vision:start/);
});
