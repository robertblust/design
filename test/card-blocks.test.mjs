// card.js run under node against a stub document. This package has no DOM, and the other card
// tests guard source shape; this one executes render() and reads the tree it builds, because
// what a section looks like on a card is what these rules are for, and a regex over the source
// cannot tell a heading drawn from a heading printed with its hashes. The stub implements only
// what card.js calls; each site's Playwright suite is still what proves it in a browser.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function El(tag) { this.tag = tag; this.kids = []; this.className = ""; this.attrs = {}; this.style = {}; }
El.prototype.appendChild = function (c) { this.kids.push(c); return c; };
El.prototype.removeChild = function (c) { this.kids = this.kids.filter((k) => k !== c); };
El.prototype.setAttribute = function (k, v) { this.attrs[k] = v; };
El.prototype.removeAttribute = function (k) { delete this.attrs[k]; };
Object.defineProperty(El.prototype, "firstChild", { get() { return this.kids[0]; } });
Object.defineProperty(El.prototype, "textContent", {
  set(v) { this.kids = [{ text: String(v) }]; },
  get() { return this.kids.map((k) => (k.tag ? k.textContent : k.text)).join(""); },
});

function load() {
  const document = { createElement: (t) => new El(t), createTextNode: (t) => ({ text: t }),
    addEventListener() {}, body: new El("body"), querySelector: () => null };
  const window = { addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(new URL("../assets/card.js", import.meta.url), "utf8"),
    { window, document, console, setTimeout });
  return window.rbCard;
}

const ser = (n) => (n.tag ? `<${n.tag}${n.className ? "." + n.className.replace(/ /g, ".") : ""}>${n.kids.map(ser).join("")}</${n.tag}>` : n.text);

function draw(text, extra = []) {
  const rbCard = load();
  const e = { id: "p/spec", type: "phase", name: "Spec", tagline: "t", path: "spec.md", fields: {},
    sections: [{ heading: "Activities", text, tables: [] }] };
  const shape = { id: "p/shape", type: "phase", name: "Shape", tagline: "s", path: "shape.md", fields: {}, sections: [] };
  const body = new El("div"), foot = new El("span");
  const link = (id) => { const a = new El("a"); a.className = "go"; a.textContent = id; return a; };
  rbCard.render(e, body, foot, { data: { entities: [e, shape, ...extra], commit: "abc" }, lang: "en", link });
  const all = ser(body).replace(/<\/div>$/, "");
  return all.slice(all.indexOf("<h4>Activities</h4>") + "<h4>Activities</h4>".length);
}

test("a ### line is a subheading, not a paragraph starting with hashes", () => {
  const out = draw("### Code\n\nFirst.\n\n### Prose\nSecond.");
  assert.ok(!out.includes("###"), `hashes printed: ${out}`);
  assert.match(out, /<h5\.sub>Code<\/h5><p>First\.<\/p><h5\.sub>Prose<\/h5><p>Second\.<\/p>/);
});

test("a numbered block is an ol, one item per number, with wrapped lines joined", () => {
  const out = draw("1. The first\n   continues.\n2. The second.");
  assert.equal(out, "<ol.prose><li>The first continues.</li><li>The second.</li></ol>");
});

test("a Markdown link to another file becomes the entity it names, or its text", () => {
  const out = draw("1. [Shape](phases/shape.md)\n2. [Nothing](phases/nothing.md)\n3. [Site](https://example.org/)");
  assert.match(out, /<li><a\.go>p\/shape<\/a><\/li>/, `not resolved: ${out}`);
  assert.match(out, /<li>Nothing<\/li>/, `unresolved link not plain text: ${out}`);
  assert.match(out, /<li><a\.ext>Site<\/a><\/li>/, `web link not external: ${out}`);
  assert.ok(!/\]\(/.test(out), `brackets printed: ${out}`);
});

test("the - list, bold and code still draw as before", () => {
  assert.equal(draw("- **A** — `x`\n- b"), "<ul.prose><li><b>A</b> — <code.mono>x</code></li><li>b</li></ul>");
});
