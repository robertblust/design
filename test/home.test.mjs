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

test("a value's never line may begin We never as well as I never", () => {
  const weNever = value("we", "Effluvium", "We never ship a thing.");
  assert.equal(neverOf(weNever), "We never ship a thing.");
  const data = { ...DATA, entities: [...DATA.entities, weNever] };
  const page = into(data);
  assert.ok(page.includes("We never ship a thing."), page);
});

test("a value ending They never still stops the build, naming it", () => {
  const theyNever = value("they", "Effluvium", "They never notice.");
  assert.throws(() => neverOf(theyNever), /values\/they/);
  const data = { ...DATA, entities: [...DATA.entities, theyNever] };
  assert.throws(() => into(data), /values\/they/);
});

test("a line that only starts with the letters of never is not a never line", () => {
  const nevertheless = value("nevertheless", "Onward", "We nevertheless ship.");
  assert.throws(() => neverOf(nevertheless), /values\/nevertheless/);
});

test("neverOf reads the last paragraph of the first section, not the last section", () => {
  const twoSection = {
    id: "values/two", type: "value", name: "Sea", tagline: "Sea tagline.", path: "model/values/two.md",
    sections: [
      { heading: "In practice", text: "Body one.\n\nI never skip section one." },
      { heading: "Also", text: "Body two.\n\nI never read section two, and neither should this." },
    ],
  };
  assert.equal(neverOf(twoSection), "I never skip section one.");
  const data = { ...DATA, entities: [...DATA.entities, twoSection] };
  const page = into(data);
  assert.ok(page.includes("I never skip section one."), page);
  assert.ok(!page.includes("I never read section two"), page);
});

test("a value with no sections stops the build, naming it, rather than throw a raw TypeError", () => {
  const sectionless = { id: "values/none", type: "value", name: "None", tagline: "None tagline.",
    path: "model/values/none.md", sections: [] };
  assert.throws(() => neverOf(sectionless), /values\/none/);
  const data = { ...DATA, entities: [...DATA.entities, sectionless] };
  assert.throws(() => into(data), /values\/none/);
});

test("a backtick in a value's name and its German renders as code, quoted for where it sits", () => {
  const backticked = value("d", "Dee `code`", "I never break the mono span.");
  const data = { ...DATA, entities: [...DATA.entities, backticked] };
  const page = into(data);
  assert.ok(page.includes('Dee <code class="mono">code</code>'), page);
  assert.ok(page.includes(`data-de="DE:Dee <code class='mono'>code</code>"`), page);
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

test("a value with a stable id links the anchor its address names", () => {
  let n = 0;
  const data = { ...DATA, entities: DATA.entities.map((e) => ({ ...e, id: `0199a3c2-7f00-7000-8000-${String(++n).padStart(12, "0")}`, address: e.id })) };
  data.rootId = data.entities.find((e) => e.address === "vision").id;
  const page = into(data);
  assert.ok(page.includes(`<a href="principles/#a"><b data-de="DE:Ay">Ay</b>`), page);
  assert.ok(page.includes(`<a href="principles/#b"><b data-de="DE:Bee">Bee</b>`), page);
});
