// card.js run under node against a stub document, as card-blocks.test.mjs does: which entity a
// name on a card links to. The parser resolves a reference by its declared type and, for an owned
// type, within its owner, and it hands the result over as edges and their attributes. A card that
// looked the name up again against every entity took the first of that name, which is another
// type's entity where two types share a name and another owner's where two owners do.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function El(tag) { this.tag = tag; this.kids = []; this.className = ""; this.attrs = {}; this.style = {}; }
El.prototype.appendChild = function (c) { this.kids.push(c); return c; };
El.prototype.removeChild = function (c) { this.kids = this.kids.filter((k) => k !== c); };
El.prototype.setAttribute = function (k, v) { this.attrs[k] = v; };
El.prototype.removeAttribute = function (k) { delete this.attrs[k]; };
El.prototype.addEventListener = function () {};
Object.defineProperty(El.prototype, "firstChild", { get() { return this.kids[0]; } });
Object.defineProperty(El.prototype, "textContent", {
  set(v) { this.kids = [{ text: String(v) }]; },
  get() { return this.kids.map((k) => (k.tag ? k.textContent : k.text)).join(""); },
});

function load() {
  const document = { createElement: (t) => new El(t), createTextNode: (t) => ({ text: t }),
    addEventListener() {}, body: new El("body"), querySelector: () => null };
  const window = { addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(new URL("../assets/card.js", import.meta.url), "utf8"), { window, document, console, setTimeout });
  return window.rbCard;
}
const links = (n, out = []) => { if (n.tag === "a" && n.attrs["data-id"]) out.push(n.attrs["data-id"]); (n.kids || []).forEach((k) => links(k, out)); return out; };

const TITLE = "Splitting the billing domain";
const theirs = { id: "profiles/tomas/experiences/2022-billing", type: "experience", name: TITLE, fields: {}, sections: [], path: "t.md", owner: "profiles/tomas" };
const mine = { id: "profiles/mira/experiences/2022-billing", type: "experience", name: TITLE, fields: {}, sections: [], path: "m.md", owner: "profiles/mira" };
const java = { id: "skills/java", type: "skill", name: "Java", fields: {}, sections: [], path: "j.md" };
const mira = { id: "profiles/mira", type: "profile", name: "Mira", tagline: "t", path: "mira.md", fields: {},
  sections: [{ heading: "Evidence", text: "", tables: [{ caption: null, columns: ["Skill", "What it shows", "Experience"], rows: [["Java", "Split it.", TITLE]] }] }] };

function draw(data) {
  const rbCard = load();
  const body = new El("div"), foot = new El("span");
  const link = (id) => { const a = new El("a"); a.attrs["data-id"] = id; a.textContent = id; return a; };
  rbCard.render(mira, body, foot, { data, lang: "en", link });
  return links(body);
}

test("a cell links to the entity the parser resolved it to, not to the first of that name", () => {
  const edges = [{ from: "profiles/mira", to: "skills/java", via: "Evidence.Skill", attrs: { "What it shows": "Split it.", Experience: mine.id } }];
  const linked = draw({ entities: [mira, theirs, java, mine], edges, commit: "abc" });
  assert.ok(linked.includes(mine.id), linked.join(", "));
  assert.ok(!linked.includes(theirs.id), linked.join(", "));
  assert.ok(linked.includes("skills/java"));
});

test("with no edge to follow, a name links only where exactly one entity holds it", () => {
  const linked = draw({ entities: [mira, theirs, java, mine], edges: [], commit: "abc" });
  assert.ok(linked.includes("skills/java"), "one entity is called Java");
  assert.ok(!linked.includes(mine.id) && !linked.includes(theirs.id), "two are called " + TITLE);
});
