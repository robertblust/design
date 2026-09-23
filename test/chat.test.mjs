// The widget's pure parts, run in Node with a stub window: the Markdown subset it renders and
// the event stream it reads. The button and the panel need a browser and are looked at, not
// tested here; the rendering check in the review does that.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(PKG, "assets", "chat.js"), "utf8");

// No document.currentScript, so the script attaches its pure parts and touches no DOM.
globalThis.window = globalThis;
globalThis.document = { currentScript: null, documentElement: { lang: "en" } };
new Function(src)();
const { md, readEvents, strings, link, refocus, nameLinks, when } = globalThis.rbChat;

test("the subset renders, and everything is escaped first", () => {
  assert.equal(md("One **bold** and *it* and `x<y`."), "<p>One <strong>bold</strong> and <em>it</em> and <code>x&lt;y</code>.</p>");
  assert.equal(md("a\n\nb"), "<p>a</p><p>b</p>");
  assert.equal(md("- one\n- two"), "<ul><li>one</li><li>two</li></ul>");
  assert.equal(md("1. one\n2. two"), "<ol><li>one</li><li>two</li></ol>");
  assert.equal(md("| a | b |\n| --- | --- |\n| 1 | 2 |"), "<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>");
  assert.equal(md("<script>x</script>"), "<p>&lt;script&gt;x&lt;/script&gt;</p>");
  assert.equal(md("# not a heading"), "<p># not a heading</p>");
  // Markdown link syntax is still no syntax here: the brackets stay text. The address inside
  // is a bare URL like any other, so it is clickable and the visitor sees where it goes.
  assert.equal(md("[a link](https://x)"), '<p>[a link](<a href="https://x">https://x</a>)</p>');
  assert.equal(md("a * b * c"), "<p>a * b * c</p>", "a lone star is a star");
  assert.equal(md(""), "");
});

test("a table with no delimiter row is prose, and a half-typed table is prose until it closes", () => {
  assert.equal(md("| a | b |"), "<p>| a | b |</p>");
  assert.equal(md("| a | b |\n| ---"), "<p>| a | b | | ---</p>");
});

test("an underscore inside a word is a letter, not a mark, and a lone one still is", () => {
  assert.equal(md("snake_case_name"), "<p>snake_case_name</p>");
  assert.equal(md("a _b_ c"), "<p>a <em>b</em> c</p>");
});

test("the stream is read event by event, across chunk boundaries", async () => {
  const chunks = ['event: text\ndata: {"text":"Hel', 'lo"}\n\nevent: cite\ndata: {"id":"i","title":"T","type":"skill","url":"u"}\n\nevent: do', 'ne\ndata: {"spent":1}\n\n'];
  const enc = new TextEncoder();
  let i = 0;
  const body = { getReader: () => ({ read: async () => (i < chunks.length ? { value: enc.encode(chunks[i++]), done: false } : { value: undefined, done: true }) }) };
  const got = [];
  await readEvents({ body }, (name, data) => got.push([name, data]));
  assert.deepEqual(got, [["text", { text: "Hello" }], ["cite", { id: "i", title: "T", type: "skill", url: "u" }], ["done", { spent: 1 }]]);
});

test("a stream that uses CRLF line endings is read the same as LF, even when a \\r\\n splits across chunks", async () => {
  const chunks = ['event: text\r\ndata: {"text":"Hello"}\r', '\n\r\n'];
  const enc = new TextEncoder();
  let i = 0;
  const body = { getReader: () => ({ read: async () => (i < chunks.length ? { value: enc.encode(chunks[i++]), done: false } : { value: undefined, done: true }) }) };
  const got = [];
  await readEvents({ body }, (name, data) => got.push([name, data]));
  assert.deepEqual(got, [["text", { text: "Hello" }]]);
});

test("every code has a sentence in both languages, and the language falls back to English", () => {
  const codes = ["too_long", "busy", "over_day", "over_month", "closed", "host_down", "foreign", "bad_request", "internal", "network"];
  for (const lang of ["en", "de"]) for (const c of codes) assert.equal(typeof strings(lang).refusal[c], "string", `${lang} ${c}`);
  assert.equal(strings("fr").send, strings("en").send);
  assert.notEqual(strings("de").send, strings("en").send);
});

test("a cite opens the entity expanded, with the id's slash as it is, since the stage reads the hash raw", () => {
  assert.equal(link("/model/", "products/companygraph-core"), "/model/?stage=expanded#products/companygraph-core");
  assert.equal(link("../model/", "skills/data-modeling"), "../model/?stage=expanded#skills/data-modeling");
  assert.equal(link("/model/?lang=de", "a/b"), "/model/?lang=de&stage=expanded#a/b");
  assert.equal(link("/model/#old", "a/b"), "/model/?stage=expanded#a/b");
  assert.ok(!link("/model/", "a/b").includes("%2F"));
});

test("the cursor goes back after an answer only where there is a fine pointer, so a phone's keyboard stays closed", () => {
  const win = (fine) => ({ matchMedia: (q) => ({ matches: q === "(pointer: fine)" && fine }) });
  assert.equal(refocus(win(true)), true);
  assert.equal(refocus(win(false)), false);
  assert.equal(refocus({}), true, "a browser without matchMedia keeps the old behavior");
});

test("a bare URL in an answer is a link, its trailing punctuation is not, and one in a code span is left alone", () => {
  assert.equal(md("See https://blust.ch/model/ for more."),
    '<p>See <a href="https://blust.ch/model/">https://blust.ch/model/</a> for more.</p>');
  assert.equal(md("At https://mcp.blust.ch/mcp, ask."),
    '<p>At <a href="https://mcp.blust.ch/mcp">https://mcp.blust.ch/mcp</a>, ask.</p>');
  assert.match(md("**https://blust.ch**"), /<strong><a href="https:\/\/blust\.ch">https:\/\/blust\.ch<\/a><\/strong>/);
  assert.equal(md("`https://blust.ch`"), "<p><code>https://blust.ch</code></p>");
  assert.ok(!md('https://blust.ch/?a=1&b=2').includes('&b=2"'), "the escaped ampersand stays escaped inside the href");
  assert.ok(!md('<script>https://x.example</script>').includes("<script>"), "markup is still escaped first");
});

// The linker walks a real DOM, so this test builds one with jsdom-free primitives: a tiny
// document standing in for the browser's, with the four calls nameLinks makes.
function fakeDoc(html) {
  const text = (v) => ({ nodeType: 3, nodeValue: v, parentNode: null });
  const root = { children: [], nodeType: 1 };
  const nodes = [];
  for (const part of html) nodes.push(typeof part === "string" ? text(part) : part);
  for (const n of nodes) n.parentNode = { closest: (sel) => (n.inA && sel.includes("a") ? {} : n.inCode && sel.includes("code") ? {} : null), replaceChild(frag, old) { root.children.push(frag); } };
  const doc = {
    createTreeWalker: () => { let i = -1; return { nextNode: () => (++i < nodes.length ? nodes[i] : null) }; },
    createDocumentFragment: () => ({ parts: [], appendChild(x) { this.parts.push(x); } }),
    createTextNode: (v) => ({ text: v }),
    createElement: () => ({ href: "", textContent: "", tag: "a" }),
  };
  return { doc, root };
}
const rendered = (root) => root.children.flatMap((f) => f.parts).map((p) => (p.tag === "a" ? `[${p.textContent}](${p.href})` : p.text)).join("");

test("a name a tool answered with is linked where the answer writes it, longest first and whole words only", () => {
  const names = [{ id: "skills/data-engineering", title: "Data engineering" }, { id: "skills/java", title: "Java" }, { id: "skills/e", title: "Engineering" }];
  const { doc, root } = fakeDoc(["Skills drawn on: Data engineering, Java."]);
  nameLinks({}, names, "/model/", doc);
  assert.equal(rendered(root),
    "Skills drawn on: [Data engineering](/model/?stage=expanded#skills/data-engineering), [Java](/model/?stage=expanded#skills/java).");
});

test("a name inside a word is not a name, and a name inside a link or a code span is left alone", () => {
  const { doc, root } = fakeDoc(["Javascript is not Java."]);
  nameLinks({}, [{ id: "skills/java", title: "Java" }], "/model/", doc);
  assert.equal(rendered(root), "Javascript is not [Java](/model/?stage=expanded#skills/java).");
  const inA = { nodeType: 3, nodeValue: "Java", inA: true };
  const inCode = { nodeType: 3, nodeValue: "Java", inCode: true };
  const two = fakeDoc([inA, inCode]);
  nameLinks({}, [{ id: "skills/java", title: "Java" }], "/model/", two.doc);
  assert.equal(two.root.children.length, 0, "neither node was touched");
});

test("no names means no walk at all", () => {
  const { doc, root } = fakeDoc(["Nothing to link."]);
  nameLinks({}, [], "/model/", doc);
  assert.equal(root.children.length, 0);
});

// The clock is fixed at 10:00 UTC on Wednesday, September 23, 2026, which is 12:00 in Zürich,
// and the zone is Zürich, so the four distances the spec names each have one expected sentence.
const NOW = Date.parse("2026-09-23T10:00:00Z");
const ZH = "Europe/Zurich";
const plus = (ms) => new Date(NOW + ms).toISOString();

test("the moment is written in minutes within the hour, and a minute or less is a minute", () => {
  assert.equal(when(plus(30 * 1000), NOW, "en", ZH), "You can ask again in a minute.");
  assert.equal(when(plus(60 * 1000), NOW, "en", ZH), "You can ask again in a minute.");
  assert.equal(when(plus(12 * 60 * 1000), NOW, "en", ZH), "You can ask again in 12 minutes.");
  assert.equal(when(plus(11 * 60 * 1000 + 30 * 1000), NOW, "en", ZH), "You can ask again in 12 minutes.", "a part of a minute rounds up");
  assert.equal(when(plus(60 * 60 * 1000), NOW, "en", ZH), "You can ask again in 60 minutes.", "the hour itself is still minutes");
});

test("later the same local day is a time, tomorrow is named, and a later day carries its name", () => {
  assert.equal(when(plus(2 * 60 * 60 * 1000 + 35 * 60 * 1000), NOW, "en", ZH), "You can ask again at 14:35.");
  assert.equal(when("2026-09-24T00:00:00Z", NOW, "en", ZH), "You can ask again tomorrow at 02:00.", "midnight UTC is two in the morning in Zürich");
  assert.equal(when("2026-10-01T00:00:00Z", NOW, "en", ZH), "You can ask again on Thursday at 02:00.", "the month's ceiling lifts on the first");
});

test("the moment is written in German the same way, and an unknown language reads as English", () => {
  assert.equal(when(plus(30 * 1000), NOW, "de", ZH), "Sie können in einer Minute wieder fragen.");
  assert.equal(when(plus(12 * 60 * 1000), NOW, "de", ZH), "Sie können in 12 Minuten wieder fragen.");
  assert.equal(when(plus(2 * 60 * 60 * 1000 + 35 * 60 * 1000), NOW, "de", ZH), "Sie können um 14:35 wieder fragen.");
  assert.equal(when("2026-09-24T00:00:00Z", NOW, "de", ZH), "Sie können morgen um 02:00 wieder fragen.");
  assert.equal(when("2026-10-01T00:00:00Z", NOW, "de", ZH), "Sie können am Donnerstag um 02:00 wieder fragen.");
  assert.equal(when(plus(12 * 60 * 1000), NOW, "fr", ZH), when(plus(12 * 60 * 1000), NOW, "en", ZH));
});

test("a moment in the past, an unreadable one and a missing one give no sentence", () => {
  assert.equal(when(plus(-1000), NOW, "en", ZH), "");
  assert.equal(when(new Date(NOW).toISOString(), NOW, "en", ZH), "", "now itself is not a wait");
  assert.equal(when("soon", NOW, "en", ZH), "");
  assert.equal(when(undefined, NOW, "en", ZH), "");
  assert.equal(when(null, NOW, "en", ZH), "");
});
