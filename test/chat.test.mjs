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
const { md, readEvents, strings, link, refocus, nameLinks, when, refusalText, citeLine, iconOf, pick } = globalThis.rbChat;

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

test("a refusal without the field is the plain sentence, and with it the sentence ends with the moment", () => {
  assert.equal(refusalText("over_day", undefined, NOW, "en", ZH), strings("en").refusal.over_day);
  assert.equal(refusalText("over_day", "2026-09-24T00:00:00Z", NOW, "en", ZH), strings("en").refusal.over_day + " You can ask again tomorrow at 02:00.");
  assert.equal(refusalText("busy", plus(12 * 60 * 1000), NOW, "de", ZH), strings("de").refusal.busy + " Sie können in 12 Minuten wieder fragen.");
  assert.equal(refusalText("busy", "soon", NOW, "en", ZH), strings("en").refusal.busy, "an unreadable moment is no moment");
  assert.equal(refusalText("foreign", plus(60000), NOW, "en", ZH), strings("en").refusal.foreign + " You can ask again in a minute.", "the field is trusted wherever the server sends it");
  assert.equal(refusalText("no_such_code", undefined, NOW, "en", ZH), strings("en").refusal.internal, "an unknown code still falls back");
});

test("busy no longer promises a minute where the server named none", () => {
  for (const lang of ["en", "de"]) assert.ok(!/minute/i.test(strings(lang).refusal.busy), `${lang}: ${strings(lang).refusal.busy}`);
});

// citeLine builds elements, so this stub records what a browser would: a tag, its attributes,
// its text and its children, enough to read the line back as a tree.
function domDoc(lang = "en") {
  const make = (tag) => {
    const e = { tag, attrs: {}, children: [], className: "", href: "", _text: "", _html: "" };
    e.appendChild = (c) => { e.children.push(c); return c; };
    e.setAttribute = (k, v) => { e.attrs[k] = String(v); };
    Object.defineProperty(e, "textContent", { get: () => e._text, set: (v) => { e._text = v; } });
    Object.defineProperty(e, "innerHTML", { get: () => e._html, set: (v) => { e._html = v; } });
    return e;
  };
  return { documentElement: { lang }, createElement: make, createTextNode: (v) => ({ text: v }) };
}
const kids = (e) => e.children;
const CITES = [
  { id: "skills/data-modeling", title: "Data modeling", url: "https://github.com/robertblust/mental-model/blob/4d14ec2a1b2c3d4e5f60718293a4b5c6d7e8f901/skills/data-modeling.md" },
  { id: "roles/cdo", title: "CDO", url: null },
];

test("the line opens with the page's icon where it has one, and with the words where it has none", () => {
  const withIcon = citeLine(CITES, "/model/", "/favicon.svg", domDoc());
  assert.equal(withIcon.className, "rbchat-cites");
  const head = kids(withIcon)[0];
  assert.equal(head.tag, "img");
  assert.equal(head.attrs.src, "/favicon.svg");
  assert.equal(head.attrs.alt, "From the model");
  assert.equal(head.attrs.title, "From the model");
  assert.equal(head.attrs.width, "16");
  const noIcon = citeLine(CITES, "/model/", null, domDoc());
  assert.equal(kids(noIcon)[0].tag, "span");
  assert.equal(kids(noIcon)[0].textContent, "From the model: ");
  const de = citeLine(CITES, "/model/", "/favicon.svg", domDoc("de"));
  assert.equal(kids(de)[0].attrs.alt, "Aus dem Modell");
});

test("every cite is a title link to the model page, and a cite with a URL carries the GitHub mark after it", () => {
  const line = citeLine(CITES, "/model/", null, domDoc());
  const links = kids(line).filter((c) => c.tag === "a" && c.className === "rbchat-cite");
  assert.deepEqual(links.map((a) => [a.textContent, a.href]), [
    ["Data modeling", "/model/?stage=expanded#skills/data-modeling"],
    ["CDO", "/model/?stage=expanded#roles/cdo"],
  ]);
  const marks = kids(line).filter((c) => c.tag === "a" && c.className === "rbchat-gh");
  assert.equal(marks.length, 1, "one cite has a URL, one has none");
  assert.equal(marks[0].href, CITES[0].url);
  assert.equal(marks[0].attrs["aria-label"], "Data modeling on GitHub, commit 4d14ec2");
  assert.equal(marks[0].attrs.title, "Data modeling on GitHub, commit 4d14ec2");
  assert.match(marks[0].innerHTML, /<svg[^>]*aria-hidden="true"/);
  const order = kids(line).map((c) => c.tag || "text");
  assert.deepEqual(order, ["span", "a", "a", "text", "a"], "icon-or-words, title, mark, separator, title");
});

test("the mark's name carries no commit when the URL has no blob segment, and the German mark reads auf GitHub", () => {
  const cites = [{ id: "a/b", title: "T", url: "https://github.com/x/y" }];
  const en = citeLine(cites, "/model/", null, domDoc());
  assert.equal(kids(en).find((c) => c.className === "rbchat-gh").attrs["aria-label"], "T on GitHub");
  const de = citeLine(CITES.slice(0, 1), "/model/", null, domDoc("de"));
  assert.equal(kids(de).find((c) => c.className === "rbchat-gh").attrs["aria-label"], "Data modeling auf GitHub, Commit 4d14ec2");
});

test("nameLinks links a cite's title in the text exactly as it links a name's", () => {
  const { doc, root } = fakeDoc(["Read Data modeling first."]);
  nameLinks({}, CITES, "/model/", doc);
  assert.equal(rendered(root), "Read [Data modeling](/model/?stage=expanded#skills/data-modeling) first.");
});

test("the page's icon is the first icon link's address, and a page without one gives null", () => {
  const doc = { querySelector: (sel) => (sel === 'link[rel~="icon"]' ? { href: "https://blust.ch/favicon.svg" } : null) };
  assert.equal(iconOf(doc), "https://blust.ch/favicon.svg");
  assert.equal(iconOf({ querySelector: () => null }), null);
});

// pick() is the picker behind the empty panel's three questions: a Fisher-Yates shuffle of a
// copy, cut to n, so it is deterministic once the caller supplies the random source.
test("pick takes n items of a longer list, all distinct and drawn from it", () => {
  const list = ["a", "b", "c", "d", "e"];
  const got = pick(list, 3);
  assert.equal(got.length, 3);
  assert.equal(new Set(got).size, 3, "no duplicates");
  for (const t of got) assert.ok(list.includes(t));
});

test("pick gives back the whole list, shuffled, when asked for more than it holds", () => {
  const list = ["x", "y"];
  const got = pick(list, 3);
  assert.equal(got.length, 2);
  assert.deepEqual([...got].sort(), ["x", "y"]);
});

test("pick of an empty list is empty, however many are asked for", () => {
  assert.deepEqual(pick([], 3), []);
  assert.deepEqual(pick(undefined, 3), []);
});

test("pick is deterministic with an injected random, and it is a Fisher-Yates shuffle cut to n", () => {
  // rnd() => 0 always picks index 0 to swap with, at every step: arr walks
  // [a,b,c,d,e] -> [e,b,c,d,a] -> [d,b,c,e,a] -> [c,b,d,e,a] -> [b,c,d,e,a], cut to 3.
  const rnd = () => 0;
  assert.deepEqual(pick(["a", "b", "c", "d", "e"], 3, rnd), ["b", "c", "d"]);
  // A different constant still walks the same algorithm to a different, but reproducible, order.
  const half = () => 0.5;
  const first = pick(["a", "b", "c", "d"], 4, half);
  const second = pick(["a", "b", "c", "d"], 4, half);
  assert.deepEqual(first, second, "the same random source gives the same order every time");
});

test("pick never returns a negative or fractional count", () => {
  assert.deepEqual(pick(["a", "b"], 0), []);
  assert.deepEqual(pick(["a", "b"], -1), []);
});

// The rest of offering the three questions lives in the page section, built only once a real
// `document.currentScript` carries `data-chat` — the same boundary the file's own top comment
// draws around build() and open(): not run here, only read, as assets.test.mjs already does for
// card.js and stage.js.
test("the widget reads a same-origin data-questions path, never the chat endpoint, once, and keeps what it got", () => {
  assert.match(src, /QUESTIONS = tag\.dataset\.questions \|\| null/, "the path is not read off the tag's own data-questions");
  assert.doesNotMatch(src, /new URL\("questions", ENDPOINT\)/, "a route is still resolved against the chat endpoint");
  assert.match(src, /if \(!QUESTIONS\) \{ qList = qList \|\| \[\]; cb\(\[\]\); return; \}/, "a tag without data-questions still asks somewhere");
  assert.match(src, /if \(qList\) \{ cb\(qList\); return; \}/, "a second ask does not reuse the first list");
  assert.match(src, /if \(!qFetch\) \{/, "a second ask before the first resolves starts its own fetch");
  assert.match(src, /fetch\(QUESTIONS, \{ signal: ac\.signal \}\)/, "the fetch does not read QUESTIONS");
});

test("a title is a question entity's name, filtered to a non-empty string no longer than the box's own limit", () => {
  const fn = src.slice(src.indexOf("function questions(cb)"), src.indexOf("function offerQuestions()"));
  assert.match(fn, /Array\.isArray\(j\.entities\)/, "a body without an entities array is not read as no questions");
  assert.match(fn, /e\.type === "question"/, "a title is not drawn from an entity of type question");
  assert.match(fn, /typeof e\.name === "string" && e\.name\.length > 0/, "an empty or non-string name is not filtered out");
  assert.match(fn, /map\(function\(e\)\{ return e\.name; \}\)/, "the title is not the entity's own name");
  assert.match(fn, /filter\(function\(t\)\{ return t\.length <= LIMIT; \}\)/, "a title longer than the send limit is not dropped");
});

test("a fetch that fails, times out or is not JSON resolves to an empty list, not a throw, and the timeout covers the whole response", () => {
  const fn = src.slice(src.indexOf("function questions(cb)"), src.indexOf("function offerQuestions()"));
  assert.match(fn, /AbortController/, "the fetch has no timeout");
  assert.match(fn, /if \(!r\.ok\) \{ clearTimeout\(timer\); return \[\]; \}/, "a non-2xx answer is not read as no questions, or clears the timer past a bad status");
  // The timer is cleared only inside the JSON branch, after r.json() has resolved — not
  // alongside the fetch's own .then — so a stalled body is still aborted, not left running past
  // its own headers.
  const success = fn.slice(fn.indexOf("return r.json()"), fn.indexOf(".catch("));
  assert.match(success, /clearTimeout\(timer\);/, "the timer is not cleared once the body is read");
  assert.ok(success.indexOf("clearTimeout(timer)") > success.indexOf("function(j)"), "the timer is cleared before the body is actually read");
  assert.match(fn, /\.catch\(function\(\)\{ clearTimeout\(timer\); return \[\]; \}\)/, "a rejected fetch, an aborted body read or a JSON parse failure is not caught");
});

test("chips are offered only on an empty conversation, and a second race does not double them", () => {
  const fn = src.slice(src.indexOf("function offerQuestions()"), src.indexOf("function hideQuestions()"));
  assert.match(fn, /if \(messages\.length\) return;/, "chips are offered on a conversation that already has a message");
  assert.match(fn, /if \(messages\.length \|\| qBox\) return;/, "chips are rebuilt once a message arrived while the fetch was in flight, or while chips are already up");
  assert.match(fn, /if \(!picked\.length\) return;/, "an empty pick still builds a box");
});

test("the chip container carries an accessible name from the strings, in both languages, and follows a language switch", () => {
  assert.equal(strings("en").questions, "Questions to start with");
  assert.equal(strings("de").questions, "Fragen für den Einstieg");
  assert.match(src, /qBox\.setAttribute\("aria-label", strings\(langNow\(\)\)\.questions\)/, "the container's name is not read off the strings");
  assert.match(src, /if \(qBox\) qBox\.setAttribute\("aria-label", s\.questions\);/, "relabel() does not carry a language switch to an open set of chips");
});

test("a chip's label is set with textContent, and activating it sends exactly its title", () => {
  assert.match(src, /el\("button", "rbchat-q", t\)/, "a chip's label is not textContent, through el()");
  assert.match(src, /b\.addEventListener\("click", function\(\)\{ input\.value = t; send\(\); \}\)/, "a chip does not send its own title through send()");
});

test("a message clears the chips, and reopening or resetting an empty conversation offers a fresh three", () => {
  const sendFn = src.slice(src.indexOf("function send(){"), src.indexOf("fetch(ENDPOINT,"));
  assert.match(sendFn, /hideQuestions\(\);/, "send() no longer clears the chips before pushing a message");
  assert.match(src, /function open\(\)\{ hideQuestions\(\); if \(!panel\) build\(\); panel\.hidden = false; button\.hidden = true; input\.focus\(\); keep\(\); offerQuestions\(\); \}/, "open() no longer clears the old set before offering a fresh one");
  assert.match(src, /qBox = null; fullNote\.hidden = true;.*offerQuestions\(\); \}/, "reset() does not clear the stale box and offer a fresh set");
});

// The bug the review found: closing and reopening an empty conversation showed the same three
// chips, because offerQuestions()'s own `qBox` guard — there to stop a race between two opens
// from drawing two boxes — also stopped a genuine reopen from drawing again. open() now clears
// the box itself, first, every time, so the guard only ever catches the race it was meant to.
test("open() clears any standing chips before asking for a fresh set, so a reopen never repeats the last draw", () => {
  const openFn = src.slice(src.indexOf("function open(){"), src.indexOf("function close()"));
  assert.match(openFn, /^function open\(\)\{ hideQuestions\(\);/, "open() does not clear the chips before anything else");
  const hideAt = openFn.indexOf("hideQuestions();"), offerAt = openFn.indexOf("offerQuestions();");
  assert.ok(hideAt >= 0 && offerAt > hideAt, "open() does not clear before it offers again");
});
