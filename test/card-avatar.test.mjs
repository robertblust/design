// card.js run under node against a stub document, as card-resolve.test.mjs does: when a card
// draws a picture. A site serves the model's images only once it has taken the copy step, and
// says so on its data link, so a card on a page that says nothing draws what it always drew.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { uuidOf } from "./fixtures/stable-ids.mjs";

function El(tag) { this.tag = tag; this.kids = []; this.className = ""; this.attrs = {}; this.style = {}; this.listeners = {}; this.parentNode = null; }
El.prototype.appendChild = function (c) { this.kids.push(c); if (c && typeof c === "object") c.parentNode = this; return c; };
El.prototype.removeChild = function (c) { this.kids = this.kids.filter((k) => k !== c); if (c && typeof c === "object") c.parentNode = null; };
El.prototype.setAttribute = function (k, v) { this.attrs[k] = v; };
El.prototype.getAttribute = function (k) { return k in this.attrs ? this.attrs[k] : null; };
El.prototype.removeAttribute = function (k) { delete this.attrs[k]; };
El.prototype.addEventListener = function (type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); };
Object.defineProperty(El.prototype, "firstChild", { get() { return this.kids[0]; } });
Object.defineProperty(El.prototype, "textContent", {
  set(v) { this.kids = [{ text: String(v) }]; },
  get() { return this.kids.map((k) => (k.tag ? k.textContent : k.text)).join(""); },
});

function load(dataImages) {
  const link = new El("link");
  if (dataImages != null) link.attrs["data-images"] = dataImages;
  const document = { createElement: (t) => new El(t), createTextNode: (t) => ({ text: t }),
    addEventListener() {}, body: new El("body"), querySelector: (q) => (q === "link[data-stage]" ? link : null) };
  const window = { addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(new URL("../assets/card.js", import.meta.url), "utf8"), { window, document, console, setTimeout });
  return window.rbCard;
}
const find = (n, pred, out = []) => { if (n.tag && pred(n)) out.push(n); (n.kids || []).forEach((k) => find(k, pred, out)); return out; };

const mira = (image) => ({ id: "profiles/mira", type: "profile", name: "Mira Halvorsen", tagline: "t", path: "m.md",
  fields: { source: "Local", nature: "human", ...(image ? { image } : {}) }, sections: [] });

function draw(entity, { dataImages, images } = {}) {
  const rbCard = load(dataImages);
  const body = new El("div"), foot = new El("span");
  rbCard.render(entity, body, foot, { data: { entities: [entity], edges: [], commit: "abc", repo: "o/r" }, lang: "en", link: null, images });
  return body;
}

test("a page that serves images draws the picture beside the name, addressed by the entity's id", () => {
  const body = draw(mira("mira.jpg"), { dataImages: "../images/" });
  const [img] = find(body, (n) => n.tag === "img");
  assert.ok(img, "no img drawn");
  assert.equal(img.attrs.src, "../images/profiles/mira.jpg");
  assert.equal(img.attrs.alt, "Mira Halvorsen");
  assert.equal(img.attrs.width, "64");
  assert.equal(img.attrs.height, "64");
  assert.equal(img.attrs.loading, "lazy");
  const [head] = find(body, (n) => n.className === "chead");
  assert.deepEqual(head.kids.map((k) => k.tag), ["img", "h3"]);
});

test("a base without its slash, and one handed in opts, address the same file", () => {
  assert.equal(find(draw(mira("mira.png"), { dataImages: "../images" }), (n) => n.tag === "img")[0].attrs.src, "../images/profiles/mira.png");
  assert.equal(find(draw(mira("mira.png"), { images: "/images/" }), (n) => n.tag === "img")[0].attrs.src, "/images/profiles/mira.png");
});

test("a page that declares no images draws the card it always drew", () => {
  const body = draw(mira("mira.jpg"));
  assert.equal(find(body, (n) => n.tag === "img").length, 0);
  assert.equal(find(body, (n) => n.className === "chead").length, 0);
  assert.equal(find(body, (n) => n.tag === "h3").length, 1);
});

test("an entity without an image draws no picture on a page that serves them", () => {
  assert.equal(find(draw(mira(null), { dataImages: "../images/" }), (n) => n.tag === "img").length, 0);
});

test("the file name is never listed as a field, with a picture or without", () => {
  for (const opts of [{ dataImages: "../images/" }, {}]) {
    const terms = find(draw(mira("mira.jpg"), opts), (n) => n.tag === "dt").map((n) => n.textContent);
    assert.ok(!terms.includes("image"), terms.join(", "));
    assert.ok(terms.includes("nature"), terms.join(", "));
  }
});

test("a picture that does not load removes itself, and the row keeps the name where it was", () => {
  const body = draw(mira("mira.jpg"), { dataImages: "../images/" });
  const [img] = find(body, (n) => n.tag === "img");
  assert.ok(img, "no img drawn");
  const fns = img.listeners.error;
  assert.ok(fns && fns.length === 1, "no error listener recorded on the img");
  fns[0]();
  const [head] = find(body, (n) => n.className === "chead");
  assert.deepEqual(head.kids.map((k) => k.tag), ["h3"]);
  assert.equal(head.kids[0].textContent, "Mira Halvorsen");
});

test("each segment of the id is encoded in the address, and a plain id reads as it did", () => {
  const odd = mira("mira.jpg");
  odd.id = "profiles/mi ra#x";
  const [img] = find(draw(odd, { dataImages: "../images/" }), (n) => n.tag === "img");
  assert.equal(img.attrs.src, "../images/profiles/mi%20ra%23x.jpg");
  assert.equal(find(draw(mira("mira.jpg"), { dataImages: "../images/" }), (n) => n.tag === "img")[0].attrs.src, "../images/profiles/mira.jpg");
});

// ── stable ids ─────────────────────────────────────────────────────────────────────────
// Since meta-model 0.65.0 an entity's id may be a stable UUID and its address the path it sits
// at. Pictures are published under the address, and which entity holds another's levels is a
// matter of where the two sit, so both read the address; a model with no address reads the id.

test("a stable id draws the picture published under the entity's address, each segment encoded", () => {
  const e = { ...mira("mira.jpg"), id: uuidOf(1), address: "profiles/mira" };
  assert.equal(find(draw(e, { dataImages: "../images/" }), (n) => n.tag === "img")[0].attrs.src, "../images/profiles/mira.jpg");
  const odd = { ...mira("mira.png"), id: uuidOf(2), address: "profiles/mi ra#x" };
  assert.equal(find(draw(odd, { dataImages: "/images/" }), (n) => n.tag === "img")[0].attrs.src, "/images/profiles/mi%20ra%23x.png");
});

test("a skill chip carries the level claimed by the entity above it on disk, found by address", () => {
  const ent = (n, address, type, name, extra = {}) => ({ id: uuidOf(n), address, type, name, tagline: "t",
    path: `model/${address}.md`, fields: { source: "Local" }, sections: [], ...extra });
  const profile = ent(1, "profiles/rb", "profile", "Rob", { sections: [{ heading: "Skills", text: "",
    tables: [{ caption: null, columns: ["Skill", "Level"], rows: [["Java", "Expert"]] }] }] });
  const role = ent(2, "profiles/rb/roles/dev", "role", "Developer", { owner: uuidOf(1),
    fields: { source: "Local", skills: ["Java"] } });
  const skill = ent(3, "skills/java", "skill", "Java", { fields: { source: "Local", group: "Languages" } });
  const lv = [ent(4, "levels/basic", "level", "Basic", { fields: { rank: "1" } }),
    ent(5, "levels/expert", "level", "Expert", { fields: { rank: "2" } })];
  const rbCard = load("../images/");
  const body = new El("div"), foot = new El("span");
  rbCard.render(role, body, foot, { data: { entities: [profile, role, skill, ...lv], edges: [], commit: "abc", repo: "o/r" }, lang: "en", link: () => new El("a") });
  const marks = find(body, (n) => n.className === "lv");
  assert.equal(marks.length, 1, "the chip carries no level marks");
  assert.deepEqual(marks[0].kids.map((k) => k.className), ["on", "on"]);
});
