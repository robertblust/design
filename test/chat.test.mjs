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
const { md, readEvents, strings } = globalThis.rbChat;

test("the subset renders, and everything is escaped first", () => {
  assert.equal(md("One **bold** and *it* and `x<y`."), "<p>One <strong>bold</strong> and <em>it</em> and <code>x&lt;y</code>.</p>");
  assert.equal(md("a\n\nb"), "<p>a</p><p>b</p>");
  assert.equal(md("- one\n- two"), "<ul><li>one</li><li>two</li></ul>");
  assert.equal(md("1. one\n2. two"), "<ol><li>one</li><li>two</li></ol>");
  assert.equal(md("| a | b |\n| --- | --- |\n| 1 | 2 |"), "<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>");
  assert.equal(md("<script>x</script>"), "<p>&lt;script&gt;x&lt;/script&gt;</p>");
  assert.equal(md("# not a heading"), "<p># not a heading</p>");
  assert.equal(md("[a link](https://x)"), "<p>[a link](https://x)</p>");
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
