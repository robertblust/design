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
const { md, readEvents, strings, link, refocus, asked, nameLinks, heard, when, refusalText, citeLine, iconOf, pick, unasked, spread, mentioned, mermaidConfig, nodeElement, diagramCaption, nodeHref, oriented, follow, place, placed, lockupOf, command, picked, tryRows, commitOf, seconds, rangeOf, versionsOf, graphHref, entityOf, graphTarget, sayIn, asTitles } = globalThis.rbChat;

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

test("a name written twice, the same words bold and again in parentheses, is written once", () => {
  assert.equal(md("verweist auf den **Master** (Master)."), "<p>verweist auf den <strong>Master</strong>.</p>");
  assert.equal(md("Die Konzepte **Company of one** (Company of one) und **Beleg** (Evidence)."), "<p>Die Konzepte <strong>Company of one</strong> und <strong>Beleg</strong> (Evidence).</p>");
  assert.equal(md("Shape (Shape), Spec (Spec): Plan (Plan)"), "<p>Shape, Spec: Plan</p>");
  assert.equal(md("| MLOps (MLOps) | x |\n| --- | --- |\n| **CI/CD** (CI/CD) | y |"), "<table><thead><tr><th>MLOps</th><th>x</th></tr></thead><tbody><tr><td><strong>CI/CD</strong></td><td>y</td></tr></tbody></table>");
  assert.equal(md("- **Plan** (Plan)"), "<ul><li><strong>Plan</strong></li></ul>");
  // Only the same words: a rendering or another case stays, and a name not in bold folds only
  // where a name begins, since the words before "Plan (Plan)" may be a rendering, Business Plan.
  assert.equal(md("**Plan** (plan) and Business Plan (Plan) and **Planung** (Plan)"), "<p><strong>Plan</strong> (plan) and Business Plan (Plan) and <strong>Planung</strong> (Plan)</p>");
});

test("a table with no delimiter row is prose, and a half-typed table is prose until it closes", () => {
  assert.equal(md("| a | b |"), "<p>| a | b |</p>");
  assert.equal(md("| a | b |\n| ---"), "<p>| a | b | | ---</p>");
});

test("a blank line between two rows keeps the table, and a table after a blank line is its own", () => {
  const one = "<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody></table>";
  assert.equal(md("| a | b |\n| --- | --- |\n| 1 | 2 |\n\n| 3 | 4 |"), one);
  assert.equal(md("| a | b |\n| --- | --- |\n| 1 | 2 |\n\n\n| 3 | 4 |\n\nafter"), one + "<p>after</p>");
  assert.equal(md("| a | b |\n| --- | --- |\n| 1 | 2 |\n\n| c | d |\n| --- | --- |\n| 3 | 4 |"),
    "<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>"
    + "<table><thead><tr><th>c</th><th>d</th></tr></thead><tbody><tr><td>3</td><td>4</td></tr></tbody></table>");
});

test("a cell whose every line is an item is a list, and any other cell keeps its lines as lines", () => {
  const row = (c) => md(`| a | b |\n| --- | --- |\n| x | ${c} |`).replace(/^.*<td>x<\/td><td>/, "").replace(/<\/td>.*$/, "");
  assert.equal(row("- one<br>- **two**"), "<ul><li>one</li><li><strong>two</strong></li></ul>");
  assert.equal(row("• one<br/>• two"), "<ul><li>one</li><li>two</li></ul>", "the bullet the model reaches for unasked is a bullet");
  assert.equal(row("1. one<BR />2. two"), "<ol><li>one</li><li>two</li></ol>");
  assert.equal(row("- one"), "<ul><li>one</li></ul>");
  assert.equal(row("one<br>two"), "one<br>two");
  assert.equal(row("- one<br>two"), "- one<br>two", "a list is every line or none");
  assert.equal(row("<br>"), "");
  assert.equal(md("a<br>b"), "<p>a&lt;br&gt;b</p>", "outside a cell a <br> is text");
  assert.equal(row("<script>x</script>"), "&lt;script&gt;x&lt;/script&gt;", "a cell is still escaped first");
});

test("heard gathers every answer's names and cites, oldest first, and a question brings none", () => {
  const turns = [
    { role: "user", content: "q" },
    { role: "assistant", content: "a", names: [{ id: "n/1", title: "One" }], cites: [{ id: "c/1", title: "Cited" }] },
    { role: "user", content: "q2" },
    { role: "assistant", content: "b" }
  ];
  assert.deepEqual(heard(turns).map((n) => n.id), ["n/1", "c/1"]);
  assert.deepEqual(heard([]), []);
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
  assert.equal(strings("fr").close, strings("en").close);
  assert.notEqual(strings("de").close, strings("en").close);
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

test("asked gives the address without ?chat=open, and null where the address never asked", () => {
  assert.equal(asked("?chat=open"), "");
  assert.equal(asked("?chat=open&lang=de"), "?lang=de");
  assert.equal(asked("?lang=de&chat=open"), "?lang=de");
  assert.equal(asked("?lang=de&chat=open&theme=dark"), "?lang=de&theme=dark");
  assert.equal(asked(""), null);
  assert.equal(asked("?lang=de"), null);
  assert.equal(asked("?chat=closed"), null);
  assert.equal(asked("?chatter=open"), null, "a longer name is another parameter");
  assert.equal(asked(undefined), null);
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

// spread() is what makes the three chips show the range of what the model answers: one
// question from each of three kinds, picked at random, where the model groups its questions.
const Q = (title, kind) => ({ title, kind });
const KINDED = [Q("a1", "A"), Q("a2", "A"), Q("a3", "A"), Q("b1", "B"), Q("b2", "B"), Q("c1", "C"), Q("d1", "D")];

test("spread names three different kinds wherever three exist, however the random falls", () => {
  const kindOf = Object.fromEntries(KINDED.map((q) => [q.title, q.kind]));
  for (let i = 0; i < 200; i++) {
    const got = spread(KINDED, 3);
    assert.equal(got.length, 3);
    assert.equal(new Set(got.map((t) => kindOf[t])).size, 3, `three kinds in ${got}`);
  }
});

test("spread fills from the rest when fewer kinds than chips exist, never repeating a title", () => {
  const two = [Q("a1", "A"), Q("a2", "A"), Q("a3", "A"), Q("b1", "B")];
  for (let i = 0; i < 100; i++) {
    const got = spread(two, 3);
    assert.equal(got.length, 3);
    assert.equal(new Set(got).size, 3);
    assert.ok(got.includes("b1"), "the smaller kind is always represented");
  }
});

test("spread with no kinds is pick under the same random, so a model without kinds is offered as before", () => {
  const plain = ["a", "b", "c", "d", "e"].map((t) => Q(t, null));
  const seq = () => { let s = 0; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
  assert.deepEqual(spread(plain, 3, seq()), pick(["a", "b", "c", "d", "e"], 3, seq()));
});

test("spread of an empty or missing list is empty", () => {
  assert.deepEqual(spread([], 3), []);
  assert.deepEqual(spread(undefined, 3), []);
});

test("the widget keeps each question's kind from the model file and offers through spread", () => {
  const fn = src.slice(src.indexOf("function questions(cb)"), src.indexOf("function offerQuestions()"));
  assert.match(fn, /e\.fields && typeof e\.fields\.kind === "string"/, "a question's kind is not read from fields.kind");
  const offer = src.slice(src.indexOf("function offerQuestions()"), src.indexOf("function hideQuestions()"));
  assert.match(offer, /spread\(/, "the chips are not picked across kinds");
});

// follow() is what makes the three after an answer about one type follow that answer: its
// type's schema, its first entity's neighbors, and a question resting on that entity or type.
const R = (title, kind, ...rests) => ({ title, kind, rests: rests.map(([id, type]) => ({ id, type })) });
const FOLLOW_QS = [
  R("On CG?", "A", ["experiences/cg", "experience"]),
  R("On another experience?", "B", ["experiences/other", "experience"]),
  R("On a skill?", "C", ["skills/java", "skill"]),
  R("On nothing?", "D")
];
const CG = { id: "experiences/cg", title: "CompanyGraph", type: "experience" };

test("follow offers the type's schema, the entity's neighbors and a question resting on the entity", () => {
  assert.deepEqual(follow([CG], FOLLOW_QS, [], "en"), ["Show me the schema of CompanyGraph (experience)", "Show me the neighbors of CompanyGraph", "On CG?"]);
});

test("follow writes the first two in German with the type under its own name", () => {
  assert.deepEqual(follow([CG], FOLLOW_QS, [], "de").slice(0, 2), ["Zeig mir das Schema von CompanyGraph (experience)", "Zeig mir die Nachbarn von CompanyGraph"]);
});

test("follow takes a question resting on the type when none rests on the entity, and any question when none rests on the type", () => {
  const noCg = FOLLOW_QS.slice(1);
  for (let i = 0; i < 50; i++) assert.equal(follow([CG], noCg, [], "en")[2], "On another experience?");
  const got = follow([CG], [R("On a skill?", "C", ["skills/java", "skill"])], [], "en");
  assert.deepEqual(got, ["Show me the schema of CompanyGraph (experience)", "Show me the neighbors of CompanyGraph", "On a skill?"]);
});

test("follow names the first cited entity when several of one type are cited", () => {
  const other = { id: "experiences/other", title: "Other", type: "experience" };
  assert.deepEqual(follow([other, CG], FOLLOW_QS, [], "en").slice(1), ["Show me the neighbors of Other", "On another experience?"]);
});

test("follow is null with no cite, or with cites of more than one type", () => {
  assert.equal(follow([], FOLLOW_QS, [], "en"), null);
  assert.equal(follow(undefined, FOLLOW_QS, [], "en"), null);
  assert.equal(follow([CG, { id: "skills/java", title: "Java", type: "skill" }], FOLLOW_QS, [], "en"), null);
  assert.equal(follow([{ id: "x", title: "X" }], FOLLOW_QS, [], "en"), null, "a cite without a type follows nothing");
});

test("follow leaves out what the conversation asked and fills from the questions still open", () => {
  const messages = [{ role: "user", content: "Show me the schema of CompanyGraph (experience)" }, { role: "assistant", content: "…" }, { role: "user", content: " On CG? " }];
  const got = follow([CG], FOLLOW_QS, messages, "en");
  assert.equal(got.length, 3);
  assert.equal(got[0], "Show me the neighbors of CompanyGraph");
  assert.equal(got[1], "On another experience?", "the type's question steps in for the entity's asked one");
  assert.ok(!got.includes("On CG?") && !got.includes("Show me the schema of CompanyGraph (experience)"));
  assert.equal(new Set(got).size, 3);
});

test("follow leaves out a neighbors chip too long for the box", () => {
  const long = { id: "x", title: "x".repeat(1000), type: "experience" };
  const got = follow([long], FOLLOW_QS, [], "en");
  assert.ok(got.every((t) => t.length <= 1000));
  assert.equal(got.length, 3);
});

// The conversation of 2026-09-29 that asked for these: an answer that names a decision, a value
// and a concept while it cites only the questions it matched.
const DECISION = { id: "decisions/apache", title: "Everything under Apache 2.0, and consulting billed by the day", type: "decision" };
const VALUE = { id: "values/adoption", title: "Adoption is not taxed", type: "value" };
const INSTANCE = { id: "concepts/instance", title: "Instance", type: "concept" };
const Q_COST = { id: "questions/cost", title: "Do I need your service to run CompanyGraph, and what does it cost?", type: "question" };
const Q_BIZ = { id: "questions/business", title: "Is CompanyGraph a business, or a side project?", type: "question" };
const ANSWER = "This question matches \"Do I need your service to run CompanyGraph, and what does it cost?\" in this model.\n\nThe decision Everything under Apache 2.0, and consulting billed by the day says why. The value **Adoption is not taxed** says what is free. The concept Instance says where the model runs.";
const ASKED = [{ role: "user", content: "why is the core of company graph public" }];
const QS_CG = [R(Q_COST.title, "A", [VALUE.id, "value"]), R(Q_BIZ.title, "B", [VALUE.id, "value"]), R("How do you know CompanyGraph is working?", "C")];

test("mentioned finds the entities an answer writes, in its order, leaving out questions and what was asked", () => {
  const names = [INSTANCE, VALUE, DECISION, Q_COST, Q_BIZ];
  assert.deepEqual(mentioned(ANSWER, names, QS_CG, ASKED), [DECISION.title, VALUE.title, INSTANCE.title]);
  assert.deepEqual(mentioned(ANSWER, names, QS_CG, [{ role: "user", content: "tell me more about adoption is not taxed" }]), [DECISION.title, INSTANCE.title], "an entity the visitor asked about is offered again");
  assert.deepEqual(mentioned("Instances run anywhere.", [INSTANCE], [], []), [], "a title inside a word is a mention");
  assert.deepEqual(mentioned("", [INSTANCE], [], []), []);
  assert.deepEqual(mentioned(undefined, undefined, undefined, undefined), []);
});

test("mentioned takes the longer title where a shorter one sits inside it", () => {
  const short = { id: "c/x", title: "Adoption", type: "concept" };
  assert.deepEqual(mentioned("The value Adoption is not taxed holds.", [short, VALUE], [], []), [VALUE.title]);
  assert.deepEqual(mentioned("Adoption, and then Adoption is not taxed.", [short, VALUE], [], []), [short.title, VALUE.title]);
});

test("follow shares the three: two to hear more about the answer's entities, then the cited entity's neighbors", () => {
  const named = mentioned(ANSWER, [INSTANCE, VALUE, DECISION, Q_COST], QS_CG, ASKED);
  assert.deepEqual(follow([Q_COST, Q_BIZ], QS_CG, ASKED, "en", null, named), [
    "Tell me more about Everything under Apache 2.0, and consulting billed by the day",
    "Tell me more about Adoption is not taxed",
    "Show me the neighbors of " + Q_COST.title
  ]);
  assert.equal(follow([Q_COST], QS_CG, ASKED, "de", null, named)[0], "Erzähl mir mehr über Everything under Apache 2.0, and consulting billed by the day");
});

test("follow with one entity named fills with the neighbors and the type's schema", () => {
  assert.deepEqual(follow([CG], FOLLOW_QS, [], "en", null, ["Java"]), ["Tell me more about Java", "Show me the neighbors of CompanyGraph", "Show me the schema of CompanyGraph (experience)"]);
});

test("follow offers the answer's entities where its cites are of several types or none, and fills from the questions", () => {
  const got = follow([CG, { id: "skills/java", title: "Java", type: "skill" }], FOLLOW_QS, [], "en", null, ["Java"]);
  assert.equal(got[0], "Tell me more about Java");
  assert.equal(got.length, 3);
  assert.ok(got.slice(1).every((t) => FOLLOW_QS.some((q) => q.title === t)));
  assert.equal(follow([], FOLLOW_QS, [], "en", null, ["Java", "Go", "Rust"]).length, 3);
  assert.deepEqual(follow([], FOLLOW_QS, [], "en", null, ["Java", "Go", "Rust"]).slice(0, 2), ["Tell me more about Java", "Tell me more about Go"]);
  assert.equal(follow([], FOLLOW_QS, [], "en", null, []), null, "an answer that names nothing and cites nothing follows nothing");
});

test("follow leaves out a tell-me-more the conversation already sent", () => {
  const messages = [{ role: "user", content: "Tell me more about Java" }, { role: "assistant", content: "…" }, { role: "user", content: "and?" }];
  assert.deepEqual(follow([CG], FOLLOW_QS, messages, "en", null, ["Java", "Go"]).slice(0, 2), ["Tell me more about Go", "Show me the neighbors of CompanyGraph"]);
});

test("the widget keeps what each question rests on and offers follow() after an answer, with the entities it writes", () => {
  const fn = src.slice(src.indexOf("function questions(cb)"), src.indexOf("function offerQuestions()"));
  assert.match(fn, /g\.via\.indexOf\("Rests on\."\) !== 0/, "a question's rests-on edges are not read");
  const offer = src.slice(src.indexOf("function offerQuestions()"), src.indexOf("function hideQuestions()"));
  assert.match(offer, /follow\(last\.cites, list, seen, langNow\(\), null, mentioned\(last\.content, heard\(turns\), list, messages\)\)/, "the chips do not follow the last answer");
  assert.match(offer, /!list\.length\) return;/, "a site with no question still offers chips");
});

test("an answer's question titles are linked from the chips' own list, and only once the panel is shown", () => {
  const fn = src.slice(src.indexOf("function linkQuestions(body)"), src.indexOf("function canOffer()"));
  assert.match(fn, /if \(!QUESTIONS\) return;/, "a tag without data-questions still reads something");
  assert.match(fn, /if \(!panel \|\| panel\.hidden\) \{ unlinked\.push\(body\); return; \}/, "a closed panel still reads the model file");
  assert.match(fn, /questions\(function\(list\)\{ nameLinks\(body, list\.filter\(function\(q\)\{ return q\.id; \}\), MODEL, document\); \}\)/, "the titles are not linked from the one list, by id");
  assert.equal((src.match(/linkQuestions\(body\);/g) || []).length, 2, "a finished answer and a restored one do not both link their question titles");
  assert.match(src, /function open\(\)\{[^\n]*linkWaiting\(\); \}/, "opening the panel does not link what waited");
  assert.match(src, /if \(was\.open\) \{[^\n]*linkWaiting\(\); \}/, "a restored open panel does not link what waited");
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
  assert.match(fn, /map\(function\(e\)\{ return \{ id: typeof e\.id === "string" \? e\.id : null, title: e\.name, kind: e\.fields && typeof e\.fields\.kind === "string" \? e\.fields\.kind : null, rests: rests\[e\.id\] \|\| \[\] \}; \}\)/, "the title is not the entity's own name, kept with its id, its kind and what it rests on");
  assert.match(fn, /filter\(function\(q\)\{ return q\.title\.length <= LIMIT; \}\)/, "a title longer than the send limit is not dropped");
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

// unasked() is what keeps the three after an answer from offering the question it answered.
test("unasked drops every title a visitor message asked, trimmed, and keeps the rest in order", () => {
  const list = ["What is Robert strongest at?", "Where has he worked?", "What does he write?"];
  const messages = [
    { role: "user", content: "  What is Robert strongest at?  " },
    { role: "assistant", content: "Where has he worked?" }
  ];
  assert.deepEqual(unasked(list, messages), ["Where has he worked?", "What does he write?"], "an answer's own words are not a question asked");
  assert.deepEqual(unasked(list, []), list);
  assert.deepEqual(unasked(undefined, messages), []);
  assert.deepEqual(unasked(list, undefined), list);
});

test("chips are offered only where the visitor can ask next, and a second race does not double them", () => {
  const can = src.slice(src.indexOf("function canOffer()"), src.indexOf("function offerQuestions()"));
  assert.match(can, /!busy/, "chips are offered while an answer is still on its way");
  assert.doesNotMatch(can, /messages\.length </, "chips are still held back at a conversation length");
  assert.match(can, /messages\[messages\.length - 1\]\.role === "assistant"/, "chips are offered after a message that has no answer yet");
  const fn = src.slice(src.indexOf("function offerQuestions()"), src.indexOf("function hideQuestions()"));
  assert.match(fn, /if \(!canOffer\(\)\) return;/, "chips are offered without asking whether the visitor can ask next");
  assert.match(fn, /if \(!canOffer\(\) \|\| qBox\) return;/, "chips are rebuilt once a message went out while the fetch was in flight, or while chips are already up");
  assert.match(fn, /var seen = asTitles\(list, messages\);/, "a question asked in the page's language is not read back to its title");
  assert.match(fn, /var open = unasked\(list\.map\(function\(q\)\{ return q\.title; \}\), seen\);/, "a title the conversation already asked can be offered again");
  assert.match(fn, /spread\(list\.filter\(function\(q\)\{ return open\.indexOf\(q\.title\) !== -1; \}\), 3\)/, "the chips are not picked across kinds from the titles still open");
  assert.match(fn, /if \(!picked\.length\) return;/, "an empty pick still builds a box");
});

test("a finished answer and a restored open panel offer the next three", () => {
  const finish = src.slice(src.indexOf("function finish(){"), src.indexOf("fetch(ENDPOINT,"));
  assert.match(finish, /if \(refocus\(window\)\) input\.focus\(\); offerQuestions\(\);\n/, "a finished answer offers no next questions");
  assert.match(src, /if \(was\.open\) \{ panel\.hidden = false; button\.hidden = true; offerQuestions\(\); linkWaiting\(\); \}/, "a panel restored open offers no next questions");
});

test("the chip container carries an accessible name from the strings, in both languages, and follows a language switch", () => {
  assert.equal(strings("en").questions, "Questions to start with");
  assert.equal(strings("de").questions, "Fragen für den Einstieg");
  assert.equal(strings("en").next, "Questions to ask next");
  assert.equal(strings("de").next, "Weitere Fragen");
  assert.match(src, /qBox\.setAttribute\("aria-label", strings\(langNow\(\)\)\[qNext \? "next" : "questions"\]\)/, "the container's name is not read off the strings, or not by whether it follows an answer");
  assert.match(src, /if \(qBox\) qBox\.setAttribute\("aria-label", qNext \? s\.next : s\.questions\);/, "relabel() does not carry a language switch to an open set of chips");
});

test("a row's label is set with textContent, and activating it sends exactly its question", () => {
  assert.match(src, /b\.appendChild\(el\("span", "rbchat-q", it\[0\]\)\);/, "a row's label is not textContent, through el()");
  assert.match(src, /b\.addEventListener\("click", function\(\)\{ input\.value = it\[0\]; send\(\); \}\)/, "a row does not send its own question through send()");
});

test("a message clears the chips, and reopening or resetting an empty conversation offers a fresh three", () => {
  const sendFn = src.slice(src.indexOf("function send(){"), src.indexOf("fetch(ENDPOINT,"));
  assert.match(sendFn, /spend\(\); qBox = null;/, "send() does not dim the menus it moves past, or lets the next answer reuse the old one");
  assert.match(src, /function open\(\)\{ hideQuestions\(\); if \(!panel\) build\(\); panel\.hidden = false; button\.hidden = true; fit\(\); if \(!introEl\) intro\(!messages\.length\); settle\(\); input\.focus\(\); keep\(\); if \(messages\.length\) offerQuestions\(\); linkWaiting\(\); \}/, "open() no longer clears the old set, draws the intro once, or offers a fresh next three after an answer");
  assert.match(src, /introEl = null; introPick = null; menuRows = \[\]; qBox = null;.*intro\(true\);/, "reset() does not clear the stale menus and play a fresh intro");
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

test("the new-conversation control is an arrow come back round with a note, not a bare plus", () => {
  assert.doesNotMatch(src, /d="M12 6v12M6 12h12"/, "the plus is back beside the close cross");
  assert.match(src, /newBtn\.setAttribute\("aria-label", s\.fresh\); newBtn\.setAttribute\("data-tip", s\.fresh\);/, "the button's note does not follow the language");
  assert.match(src, /closeBtn\.setAttribute\("data-tip", s\.modalClose\)/, "the close cross has no note");
  const css = fs.readFileSync(path.join(PKG, "assets", "chat.css"), "utf8");
  assert.match(css, /\.rbchat-new\[data-tip\]::after,\.rbchat-close\[data-tip\]::after\{content:attr\(data-tip\)/, "the note is not drawn");
  assert.match(css, /\.rbchat-new:focus-visible::after/, "the note does not show on keyboard focus");
});

test("Mermaid is configured strict, from the tokens, and never from an empty one", () => {
  const tokens = { "--ground": "#FAF9F5", "--raise": "#F2F0EA", "--ink": "#16181D", "--dim": "#5F6058", "--c-mid": "#3A6DA6", "--press": "#E7ECF4", font: '"Instrument Sans", sans-serif' };
  const c = mermaidConfig((n) => tokens[n]);
  assert.deepEqual([c.startOnLoad, c.securityLevel, c.theme, c.look], [false, "strict", "base", "classic"]);
  assert.deepEqual([c.flowchart.useMaxWidth, c.class.useMaxWidth, c.class.hideEmptyMembersBox], [false, false, true]);
  assert.deepEqual([c.themeVariables.primaryColor, c.themeVariables.primaryTextColor, c.themeVariables.primaryBorderColor, c.themeVariables.lineColor, c.themeVariables.background], ["#F2F0EA", "#16181D", "#3A6DA6", "#5F6058", "#FAF9F5"]);
  assert.equal(c.fontFamily, '"Instrument Sans", sans-serif');
  assert.ok(c.dompurifyConfig.FORBID_TAGS.includes("img"), "an <img> label would be a request to another host");
  assert.equal(c.themeVariables.edgeLabelBackground, "#F2F0EA", "an edge label sits on the panel's raise, not the ground it once did");
  const bare = mermaidConfig(() => "  ");
  assert.equal(bare.themeVariables.primaryColor, "#171A21", "an undefined token falls back to the dark theme's value");
  assert.match(bare.fontFamily, /sans-serif/);
});

test("a node is found by the id Mermaid gives it, in either kind of diagram, and a name that is no node finds nothing", () => {
  const svg = { querySelectorAll: () => [{ id: "rbchat-diagram-3-flowchart-n1-1" }, { id: "rbchat-diagram-3-flowchart-n10-10" }, { id: "rbchat-diagram-4-classId-n2-7" }] };
  assert.equal(nodeElement(svg, "n1").id, "rbchat-diagram-3-flowchart-n1-1");
  assert.equal(nodeElement(svg, "n10").id, "rbchat-diagram-3-flowchart-n10-10");
  assert.equal(nodeElement(svg, "n2").id, "rbchat-diagram-4-classId-n2-7");
  assert.equal(nodeElement(svg, "n3"), null);
  assert.equal(nodeElement(svg, "n1.*"), null, "a name is a node's name, never a pattern");
  assert.equal(nodeElement(null, "n1"), null);
});

test("a flow runs top to bottom in a panel narrower than a phone's, and nothing else changes", () => {
  const flow = 'flowchart LR\n  n0["A"]\n  n0 --> n1';
  assert.equal(oriented(flow, 390), 'flowchart TB\n  n0["A"]\n  n0 --> n1');
  assert.equal(oriented(flow, 760), flow);
  assert.equal(oriented(flow, 0), flow, "an unmeasured panel keeps the host's direction");
  assert.equal(oriented("classDiagram\n  class n0[\"A\"]", 390), "classDiagram\n  class n0[\"A\"]");
});

test("the caption names the shape in the page's language, then what it was drawn of", () => {
  assert.equal(diagramCaption({ shape: "process", title: "Delivery" }, "en"), "Process · Delivery");
  assert.equal(diagramCaption({ shape: "concepts", title: null }, "en"), "Concepts");
  assert.equal(diagramCaption({ shape: "neighborhood", title: "Claim" }, "de"), "Verbindungen · Claim");
  assert.equal(diagramCaption({ shape: "later", title: "X" }, "en"), "X");
  assert.equal(diagramCaption({ shape: "schema", title: null }, "en"), "Meta-model");
  assert.equal(diagramCaption({ shape: "schema", title: "phase" }, "de"), "Meta-Modell · phase");
  for (const lang of ["en", "de"]) assert.deepEqual(Object.keys(strings(lang).diagram).sort(), ["concepts", "expand", "failed", "fit", "fitTip", "neighborhood", "process", "schema", "shut", "zoomIn", "zoomOut"]);
});

test("any element carrying data-chat-open opens the panel, and the header says so", () => {
  assert.match(src, /closest\("\[data-chat-open\]"\)/, "the click is delegated to [data-chat-open]");
  assert.match(src, /document\.addEventListener\("click"[\s\S]{0,200}data-chat-open[\s\S]{0,120}open\(\)/,
    "the delegated click calls open()");
  assert.match(src.slice(0, 3000), /data-chat-open/, "the header comment names the attribute");
});

test("a node links to its entity on the model page, or to the https address the host names for it", () => {
  assert.equal(nodeHref("/model/", { id: "concepts/invoice" }), "/model/?stage=expanded#concepts/invoice");
  assert.equal(nodeHref("/model/", { id: "core/phase", url: "https://github.com/o/r/blob/c/meta/core/phase-schema.md" }), "https://github.com/o/r/blob/c/meta/core/phase-schema.md");
  assert.equal(nodeHref("/model/", { id: "core/phase", url: null }), "/model/?stage=expanded#core/phase");
  assert.equal(nodeHref("/model/", { id: "core/phase", url: "javascript:alert(1)" }), "/model/?stage=expanded#core/phase");
});

// A log standing in for the panel's: bubbles of the given heights, one under the other, each
// carrying the turn it shows, and a box of the given height scrolled to `top`.
function fakeLog(heights, height, top) {
  const log = { scrollTop: top, clientHeight: height, scrollHeight: heights.reduce((a, b) => a + b, 0) };
  const kids = heights.map((h, i) => ({ turn: String(i), h, getAttribute: () => String(i),
    getBoundingClientRect() { const at = heights.slice(0, i).reduce((a, b) => a + b, 0); return { top: at - log.scrollTop, height: h }; } }));
  log.getBoundingClientRect = () => ({ top: 0 });
  log.querySelectorAll = () => kids;
  log.querySelector = (sel) => kids.find((k) => sel === '[data-turn="' + k.turn + '"]') || null;
  return log;
}

test("the reading place is the turn the log's top edge stands in, and how far into it", () => {
  assert.deepEqual(place(fakeLog([100, 300, 200], 150, 250)), { turn: 1, by: 150 });
  assert.deepEqual(place(fakeLog([100, 300, 200], 150, 0)), { turn: 0, by: 0 });
  assert.equal(place(fakeLog([100, 300, 200], 150, 450)), null, "a log read to its end keeps no place, so it opens at its end");
  assert.equal(place(fakeLog([], 0, 0)), null, "a hidden log keeps no place");
});

test("a kept place is found again when the turns above it have grown, and a place with no turn is not", () => {
  // The picture in turn 0 drew taller after the page came back: the place follows its turn.
  const log = fakeLog([400, 300, 200], 150, 0);
  assert.equal(placed(log, { turn: 1, by: 150 }), true);
  assert.equal(log.scrollTop, 550);
  assert.equal(placed(fakeLog([100], 150, 0), { turn: 4, by: 0 }), false);
  assert.equal(placed(fakeLog([100], 150, 0), null), false);
  const end = fakeLog([400, 300], 150, 0);
  assert.equal(placed(end, { end: true }), true, "the end is no place");
  assert.equal(end.scrollTop, 700);
});

test("the place is kept as the page goes and given back where the conversation is drawn again", () => {
  const keep = src.slice(src.indexOf("function keep(){"), src.indexOf("// ─── The picture"));
  assert.match(keep, /at: reading \|\| \(panel && !panel\.hidden \? place\(log\) : null\)/, "the stored conversation carries no place");
  assert.match(src, /window\.addEventListener\("pagehide", keep\)/, "leaving the page does not keep the place");
  const restore = src.slice(src.indexOf("(function restore(){"));
  assert.match(restore, /reading = was\.at && typeof was\.at\.turn === "number" \? was\.at : \{ end: true \};/, "a restore does not read the place back");
  assert.match(restore, /log\.scrollTop = log\.scrollHeight; settle\(\);/, "a restore does not go to the place");
  assert.match(src, /if \(qNext && !reading\) log\.scrollTop = log\.scrollHeight; else settle\(\);/, "the chips a restore offers send the log to its end");
  assert.match(src, /function open\(\)\{[^\n]*settle\(\);/, "a panel opened later does not go to the place");
  assert.match(src, /function close\(\)\{ if \(!reading\) reading = place\(log\); panel\.hidden = true;/, "a closed panel forgets where it was read");
  // An answer's picture calls back once drawn, and the call is settle: a page's own picture,
  // with no conversation to keep a place in, has none.
  const draw = src.slice(src.indexOf("function drawFigure(fig){"), src.indexOf("function labelFigure(fig){"));
  assert.match(draw, /if \(fig\.rbDrawn\) fig\.rbDrawn\(\);/, "a picture drawn late does not call back");
  const answer = src.slice(src.indexOf("function figure(d){"), src.indexOf("function hydrate(){"));
  assert.match(answer, /fig\.rbDrawn = settle;/, "a picture drawn late moves the place away");
});

test("the visitor's own scrolling, a new message and a fresh conversation let the place go", () => {
  assert.match(src, /\["wheel", "pointerdown", "keydown", "touchstart"\]\.forEach\(function\(k\)\{ log\.addEventListener\(k, function\(\)\{ reading = null; \}/);
  const send = src.slice(src.indexOf("function send(){"), src.indexOf("function finish(){"));
  assert.match(send, /reading = null;/, "a new message is scrolled back to a place");
  assert.match(src, /function reset\(\)\{ reading = null;/, "a fresh conversation keeps the old place");
});

test("every bubble that shows a kept turn carries its turn, and one that lost its turn does not", () => {
  const send = src.slice(src.indexOf("function send(){"));
  assert.match(send, /mine\.setAttribute\("data-turn", turns\.length - 1\);/);
  assert.match(send, /ans\.setAttribute\("data-turn", turns\.length - 1\);/);
  assert.match(send, /function unsend\(\)\{ messages\.pop\(\); turns\.pop\(\); mine\.removeAttribute\("data-turn"\); keep\(\); \}/);
  assert.equal((send.match(/messages\.pop\(\); turns\.pop\(\); keep\(\);/g) || []).length, 0, "a failed message still pops without unmarking its bubble");
  const restore = src.slice(src.indexOf("(function restore(){"));
  assert.equal((restore.match(/setAttribute\("data-turn", turns\.length\)/g) || []).length, 2, "a restored bubble carries no turn");
});

// The server reads the last eight turns and gives the model seven, so the widget sends seven: the
// model's input is the same as for the whole conversation, and a long one never reaches 64 KB.
test("a conversation has no length limit, and only the tail the server reads is sent", () => {
  assert.match(src, /var LIMIT = 1000, SENT = 7,/, "the tail sent is not the seven turns the server reads");
  assert.match(src, /body: JSON\.stringify\(\{ messages: messages\.slice\(-SENT\), lang: langNow\(\) \}\)/, "the whole conversation is sent");
  assert.doesNotMatch(src, /TURNS|fullNote|rbchat-full/, "a conversation still stops at a length");
  const css = fs.readFileSync(path.join(PKG, "assets", "chat.css"), "utf8");
  assert.doesNotMatch(css, /rbchat-full|rbchat-fresh/, "the full note's style is still shipped");
});

// ─── The terminal's pure parts ─────────────────────────────────────────────────────────────
// A stub of the header each site writes: `<a class="brand"><svg>…</svg><b>Company<span>Graph</span></b></a>`.
function brandDoc(first, accent){
  const svg = { tagName: "svg" };
  const span = accent === null ? null : { textContent: accent };
  const b = { textContent: first + (accent || ""), querySelector: (q) => q === "span" ? span : null };
  const a = { querySelector: (q) => q === "svg" ? svg : q === "b" ? b : null };
  return { svg, doc: { querySelector: (q) => q === "header a.brand" ? a : null } };
}

test("the lockup is the header's own mark and name, split where the page splits it", () => {
  const cg = brandDoc("Company", "Graph");
  assert.deepEqual(lockupOf(cg.doc), { mark: cg.svg, first: "Company", accent: "Graph" });
  const rb = brandDoc("Robert ", "Blust");
  assert.deepEqual(lockupOf(rb.doc), { mark: rb.svg, first: "Robert ", accent: "Blust" });
  const plain = brandDoc("Acme", null);
  assert.deepEqual(lockupOf(plain.doc), { mark: plain.svg, first: "Acme", accent: "" });
});

test("a page without a brand in its header has no lockup", () => {
  assert.equal(lockupOf({ querySelector: () => null }), null);
  assert.equal(lockupOf({}), null);
});

test("only the three slash commands are commands, whatever their case and spaces", () => {
  assert.equal(command("/new"), "new");
  assert.equal(command("  /CLEAR "), "new");
  assert.equal(command("/help"), "help");
  for (const t of ["/newer", "new", "/ new", "/help me", "", null, undefined]) assert.equal(command(t), null, String(t));
});

test("a bare number picks its row, and anything else is sent as typed", () => {
  const rows = ["Show me the meta-model", "Walk me through the Answering process", "What is an owner?"];
  assert.equal(picked("1", rows), rows[0]);
  assert.equal(picked(" 3 ", rows), rows[2]);
  assert.equal(picked("0", rows), "0");
  assert.equal(picked("4", rows), "4");
  assert.equal(picked("2", []), "2");
  assert.equal(picked("2", null), "2");
  assert.equal(picked("2 please", rows), "2 please");
  assert.equal(picked("  What is an owner?  ", rows), "What is an owner?");
});

test("the Try rows are the meta-model, a process the model holds, and a list it holds three of", () => {
  const facts = { processes: ["Answering"], counts: { role: 4, kpi: 5, product: 1 } };
  assert.deepEqual(tryRows(facts, "en", () => 0), [
    ["Show me the meta-model", "a diagram of the types and how they refer to each other"],
    ["Walk me through the Answering process", "its steps as a flow, the loops back included"],
    ["List the KPIs as a table", "one row each, every name a link into the model"]
  ]);
  assert.deepEqual(tryRows(facts, "de", () => 0).map((r) => r[0]),
    ["Zeig mir das Meta-Modell", "Zeig mir den Prozess Answering Schritt für Schritt", "Liste die KPIs als Tabelle"]);
});

test("a model without a process or a long enough list leaves those rows out, and no model leaves the meta-model alone", () => {
  assert.deepEqual(tryRows({ processes: [], counts: { kpi: 2, role: 3 } }, "en", () => 0).map((r) => r[0]),
    ["Show me the meta-model", "List the roles as a table"]);
  assert.deepEqual(tryRows(null, "en").map((r) => r[0]), ["Show me the meta-model"]);
  assert.deepEqual(tryRows({}, "en").map((r) => r[0]), ["Show me the meta-model"]);
});

test("the commit is the first cite URL's blob segment, cut to seven, and no URL means none", () => {
  assert.equal(commitOf([{ url: null }, { url: "https://github.com/o/r/blob/3f2a1c9e0b1d/x.md" }]), "3f2a1c9");
  assert.equal(commitOf([{ url: "https://github.com/o/r/tree/main/x" }]), null);
  assert.equal(commitOf([]), null);
  assert.equal(commitOf(undefined), null);
});

test("the spinner's seconds are whole seconds, and none before the first", () => {
  assert.equal(seconds(0), "");
  assert.equal(seconds(999), "");
  assert.equal(seconds(1000), "1s");
  assert.equal(seconds(10400), "10s");
});

test("every new sentence exists in both languages", () => {
  for (const lang of ["en", "de"]) {
    const s = strings(lang);
    for (const k of ["hello", "helloHost", "sub", "bar", "prompt", "asking", "answered", "model", "tryLabel"]) assert.ok(s[k], `${lang}.${k}`);
    assert.equal(s.hello.length, 2);
    assert.equal(s.helloHost.length, 2);
    for (const k of ["send", "last", "pick", "help"]) assert.ok(s.keys[k], `${lang}.keys.${k}`);
    assert.equal(s.help.length, 4);
    for (const k of ["metaModel", "metaModelGets", "process", "processGets", "list", "listGets"]) assert.ok(s.try[k], `${lang}.try.${k}`);
    for (const t of ["kpi", "role", "product", "decision", "value"]) assert.ok(s.try.lists[t], `${lang}.try.lists.${t}`);
  }
});

test("the one read of the model file also keeps its process names and how many of each type it holds", () => {
  const fn = src.slice(src.indexOf("function questions(cb)"), src.indexOf("function offerQuestions()"));
  assert.match(fn, /qFacts = \{ processes: entities\.filter\(function\(e\)\{ return e && e\.type === "process" && typeof e\.name === "string" && e\.name\.length > 0; \}\)\.map\(function\(e\)\{ return e\.name; \}\), counts: counts, versions: versionsOf\(j\) \};/, "the process names are not kept");
  assert.match(fn, /if \(e && typeof e\.type === "string"\) counts\[e\.type\] = \(counts\[e\.type\] \|\| 0\) \+ 1;/, "the counts per type are not kept");
  assert.match(src, /function facts\(cb\)\{ questions\(function\(\)\{ cb\(qFacts\); \}\); \}/, "facts() does not share the one fetch");
  assert.equal((src.match(/fetch\(QUESTIONS,/g) || []).length, 1, "the model file is read twice");
  assert.equal((src.match(/fetch\(QUESTIONS_DE,/g) || []).length, 1, "the German file is read other than once, beside the model file");
});

test("the command line's words are settled before anything is pushed or sent", () => {
  const fn = src.slice(src.indexOf("function send(){"), src.indexOf("fetch(ENDPOINT,"));
  const cmdAt = fn.indexOf("var cmd = command(typed);"), pushAt = fn.indexOf("messages.push(");
  assert.ok(cmdAt > 0 && pushAt > cmdAt, "a command is pushed as a message before it is recognized");
  assert.match(fn, /var text = picked\(typed, menuRows\);/, "a number does not pick from the standing menu");
});

test("the pick range names the rows a number picks, and none when there are none", () => {
  assert.equal(rangeOf(0), "");
  assert.equal(rangeOf(1), "1");
  assert.equal(rangeOf(6), "1-6");
});

test("the versions are the model file's core, commit and repository, and none without a commit or a repository", () => {
  assert.deepEqual(versionsOf({ commit: "1d1b4e646fe21686bf854e6b464cf94c9a34d3dd", repo: "robertblust/mental-model", core: "0.46.0" }),
    { core: "0.46.0", commit: "1d1b4e646fe21686bf854e6b464cf94c9a34d3dd", sha: "1d1b4e6", repo: "robertblust/mental-model" });
  assert.deepEqual(versionsOf({ commit: "1d1b4e646fe2", repo: "r/m" }), { core: null, commit: "1d1b4e646fe2", sha: "1d1b4e6", repo: "r/m" });
  assert.equal(versionsOf({ repo: "r/m" }), null);
  assert.equal(versionsOf({ commit: "abc1234" }), null);
  assert.equal(versionsOf(null), null);
  assert.deepEqual(versionsOf({ commit: "abc1234def", repo: "r/m", core: 46 }).core, null);
});

test("the graph's address is the model link with embed, and a model link gives back its entity", () => {
  assert.equal(graphHref("/model/", "people/rob"), "/model/?stage=expanded&embed#people/rob");
  assert.equal(graphHref("/", "identity"), "/?stage=expanded&embed#identity");
  assert.equal(entityOf("/model/?stage=expanded#people/rob", "/model/"), "people/rob");
  assert.equal(entityOf("https://example.org/model/?stage=expanded#x", "/model/"), null);
  assert.equal(entityOf("/model/", "/model/"), null);
  assert.equal(entityOf("/?stage=expanded#concepts/owner%20x", "/"), "concepts/owner x");
});

test("the versions line and the graph's head exist in both languages", () => {
  assert.equal(strings("en").versions, "meta-model {core} · model {sha}");
  assert.equal(strings("de").versions, "Meta-Modell {core} · Modell {sha}");
  assert.equal(strings("en").versionsModel, "model {sha}");
  assert.equal(strings("de").versionsModel, "Modell {sha}");
  for (const l of ["en", "de"]) for (const k of ["head", "failed"]) assert.ok(strings(l).graph[k], l + ".graph." + k);
  // The modal knows nothing of the model page, and its close is the one modal's own.
  for (const l of ["en", "de"]) for (const k of ["page", "close"]) assert.equal(strings(l).graph[k], undefined, l + ".graph." + k);
});

// WCAG relative luminance and contrast, from two #RRGGBB values.
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
test("the answer card keeps the answer's text, links and rail readable in both palettes", () => {
  // The terminal's colors are the family's tokens, which the chat and the one modal both read.
  assert.doesNotMatch(fs.readFileSync(path.join(PKG, "assets", "chat.css"), "utf8"), /--t-bg:/, "chat.css still defines the terminal's colors itself");
  const css = fs.readFileSync(path.join(PKG, "blocks", "tokens.css"), "utf8");
  const blocks = [...css.matchAll(/--t-card:(#[0-9A-Fa-f]{6})[^}]*/g)].map((m) => m[0]);
  assert.equal(blocks.length >= 2, true, "the card is not defined in both palettes");
  for (const b of blocks) {
    const v = (k) => (new RegExp("--t-" + k + ":(#[0-9A-Fa-f]{6})").exec(b) || [])[1];
    const card = v("card");
    assert.ok(contrast(v("dim"), card) >= 4.5, "dim prose on the card: " + contrast(v("dim"), card).toFixed(2));
    assert.ok(contrast(v("accent"), card) >= 4.5, "links on the card: " + contrast(v("accent"), card).toFixed(2));
    assert.ok(contrast(v("good"), card) >= 3, "the rail on the card: " + contrast(v("good"), card).toFixed(2));
  }
});

test("every link into the graph opens it on the page, from anywhere on it, and a page's own picture too", () => {
  const i = src.indexOf("// Every link into the graph on this page");
  assert.ok(i > 0 && i < src.indexOf("if (!tag.dataset.chat"), "the graph opener waits for a chat, so a page without one leaves");
  const fn = src.slice(i, i + 1400);
  assert.doesNotMatch(fn, /closest\("\.rbchat"\)/, "only a link inside the chat opens the graph");
  assert.match(fn, /graphTarget\(/, "the link is not read as a place in the graph");
});

test("a link names a place in the graph where it resolves to the model page, expanded, from any other page of the site", () => {
  const here = "https://blust.ch/timeline/";
  assert.equal(graphTarget("../model/?stage=expanded#people/rob", "/model/", here), "people/rob");
  assert.equal(graphTarget("/model/?stage=expanded#skills/java%20programming", "/model/", here), "skills/java programming");
  assert.equal(graphTarget("https://blust.ch/model/?lang=de&stage=expanded#x", "/model/", here), "x");
  assert.equal(graphTarget("/?stage=expanded#identity", "/", "https://companygraph.io/team/"), "identity");
  assert.equal(graphTarget("../model/#people/rob", "/model/", here), null, "a link that does not ask for the stage expanded");
  assert.equal(graphTarget("../model/?stage=expanded", "/model/", here), null, "no place named");
  assert.equal(graphTarget("https://example.org/model/?stage=expanded#x", "/model/", here), null, "another site");
  assert.equal(graphTarget("/blog/?stage=expanded#x", "/model/", here), null, "another page");
  assert.equal(graphTarget("/model/?stage=expanded#x", "/model/", "https://blust.ch/model/"), null, "the model page itself moves its own stage");
  assert.equal(graphTarget("/?stage=expanded#identity", "/", "https://companygraph.io/"), null);
  assert.equal(graphTarget(null, "/model/", here), null);
});

test("no dialog but the one modal is drawn, and it names no model page", () => {
  const css = fs.readFileSync(path.join(PKG, "assets", "chat.css"), "utf8");
  assert.doesNotMatch(src, /el\("dialog"|createElement\("dialog"\)/, "chat.js still draws a dialog of its own");
  assert.doesNotMatch(src, /rbchat-graph-page|model page \u2197|model page ↗/, "the graph's modal still names the model page");
  assert.doesNotMatch(css, /dialog\.rbchat-graph|dialog\.rbchat-modal/, "chat.css still styles a dialog of its own");
});

const DE_QS = [{ title: "What is it?", de: "Was ist es?" }, { title: "Who answers?" }];

test("sayIn offers a question's German on a German page where the site has one, and its title otherwise", () => {
  assert.equal(sayIn(DE_QS, "de", "What is it?"), "Was ist es?");
  assert.equal(sayIn(DE_QS, "en", "What is it?"), "What is it?");
  assert.equal(sayIn(DE_QS, "de", "Who answers?"), "Who answers?", "a title the file lacks stays English");
  assert.equal(sayIn(DE_QS, "de", "Show me the neighbors of X"), "Show me the neighbors of X", "a chip that is no model question is its own text");
  assert.equal(sayIn(null, "de", "What is it?"), "What is it?");
});

test("asTitles reads a German question back as its title, whoever typed it, and leaves the rest", () => {
  const messages = [{ role: "user", content: " Was ist es? " }, { role: "assistant", content: "Was ist es?" }, { role: "user", content: "Something else" }];
  assert.deepEqual(asTitles(DE_QS, messages), [{ role: "user", content: "What is it?" }, messages[1], messages[2]]);
  assert.deepEqual(unasked(["What is it?", "Who answers?"], asTitles(DE_QS, messages)), ["Who answers?"]);
  assert.deepEqual(asTitles(null, messages), messages);
});
