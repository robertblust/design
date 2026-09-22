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
const { md, readEvents, strings, link, refocus } = globalThis.rbChat;

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
