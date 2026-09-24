import { test } from "node:test";
import assert from "node:assert/strict";
import { germanValues, applyGerman, unescapeJs } from "../lib/german.mjs";

const PAGE = `<!doctype html><html lang="en"><head>
<meta name="description" id="metadesc" content="Over twenty-five years." data-de="Über fünfundzwanzig Jahre.">
</head><body>
<h1 data-de="Zwei Ideen, <em class='x'>öffentlich</em> geprüft.">Two ideas, <em>tested</em> in public.</h1>
<p data-de="a &gt; b, «so»">a &gt; b, “so”</p>
<button aria-label="Dark" data-de-aria="Dunkel">◐</button>
<section class="slide" data-notes="Say it." data-notes-de="Sagen Sie es."><p>Slide</p></section>
<script>
  if (a < b && c > d) {}
  var UI = {
    de:{ title:"Robert Blust – Titel", desc:"Deutsche Beschreibung." },
    en:{ title:"Robert Blust — Title", desc:"English description." }
  };
</script>
</body></html>`;

test("germanValues finds every German value in source order, each with its English", () => {
  const v = germanValues(PAGE);
  assert.deepEqual(v.map((e) => e.id), ["a0", "a1", "a2", "a3", "a4", "js.title", "js.desc"]);
  assert.deepEqual(v.map((e) => e.kind), ["data-de", "data-de", "data-de", "data-de-aria", "data-notes-de", "title", "description"]);
  assert.equal(v[0].en, "Over twenty-five years.");
  assert.equal(v[1].en, "Two ideas, tested in public.");
  assert.equal(v[1].de, "Zwei Ideen, <em class='x'>öffentlich</em> geprüft.");
  assert.equal(v[2].en, "a > b, “so”");
  assert.equal(v[3].en, "Dark");
  assert.equal(v[4].en, "Say it.");
  assert.equal(v[5].de, "Robert Blust – Titel");
  assert.equal(v[5].en, "Robert Blust — Title");
  assert.equal(v[6].en, "English description.");
});

test("a script's < and > are not read as tags", () => {
  const v = germanValues(PAGE);
  assert.equal(v.filter((e) => e.kind === "data-de").length, 3);
});

test("applyGerman writes values back by id and leaves everything else byte for byte", () => {
  const out = applyGerman(PAGE, { a2: "a &gt; b, «ja»", "js.desc": "Neue Beschreibung." });
  assert.equal(out, PAGE.replace("a &gt; b, «so»", "a &gt; b, «ja»").replace("Deutsche Beschreibung.", "Neue Beschreibung."));
  assert.equal(applyGerman(PAGE, {}), PAGE);
});

test("applyGerman refuses an unknown id and a value holding its own quote", () => {
  assert.throws(() => applyGerman(PAGE, { a99: "x" }), /^Error: refused: a99/);
  assert.throws(() => applyGerman(PAGE, { a1: 'ein "Zitat"' }), /^Error: refused: a1/);
});

test("de:{...} and en:{...} need a left boundary, so mode:{...} is not read as German", () => {
  const src = `<script>var UI = { mode:{ title:"M", desc:"D" } };</script>`;
  const v = germanValues(src);
  assert.equal(v.find((e) => e.id === "js.title"), undefined);
  assert.equal(v.find((e) => e.id === "js.desc"), undefined);
});

// The real case this guards: companygraph.io's talks/intro/index.html carries an escaped
// apostrophe inside a single-quoted en desc — "a company's knowledge" — and a non-greedy
// [\s\S]*? used to stop at that escaped quote, truncating the value at "a company".
test("germanValues keeps a js description whole across an escaped apostrophe", () => {
  const src = `<script>var UI = {
    de:{ title:"T", desc:"Ein Vortrag ueber das Wissen einer Firma als Graph." },
    en:{ title:"T", desc:'A talk on the graph — a company\\'s knowledge as a graph.' }
  };</script>`;
  const v = germanValues(src);
  const desc = v.find((e) => e.id === "js.desc");
  assert.equal(desc.en, "A talk on the graph — a company\\'s knowledge as a graph.");
});

test("applyGerman edits the js description without disturbing a title that carries an escaped apostrophe", () => {
  const src = `<script>
  var UI = {
    de:{ title:'Robert\\'s Talk', desc:"Alte Beschreibung." },
    en:{ title:"Robert's Talk", desc:"Old description." }
  };
</script>`;
  const out = applyGerman(src, { "js.desc": "Neue Beschreibung." });
  assert.equal(out, src.replace("Alte Beschreibung.", "Neue Beschreibung."));
});

test("applyGerman accepts an escaped quote in a js value and refuses a bare one", () => {
  const src = `<script>
  var UI = {
    de:{ title:'Titel', desc:'Alte Beschreibung.' },
    en:{ title:"Title", desc:"Old description." }
  };
</script>`;
  const out = applyGerman(src, { "js.desc": "Das ist\\'s so." });
  assert.equal(out, src.replace("Alte Beschreibung.", "Das ist\\'s so."));
  assert.throws(() => applyGerman(src, { "js.desc": "Das ist's bare." }), /^Error: refused: js\.desc$/);
});

test("applyGerman still refuses a quote in an HTML attribute, even preceded by a backslash", () => {
  assert.throws(() => applyGerman(PAGE, { a1: 'ein "Zitat"' }), /^Error: refused: a1$/);
  // An HTML attribute has no backslash escape, so a backslash before the quote is just a
  // character and the quote still ends the attribute early; a2's own quote is ".
  assert.throws(() => applyGerman(PAGE, { a2: 'a &gt; b, «ja\\"»' }), /^Error: refused: a2$/);
});

test("unescapeJs resolves the escapes a JS string carries, leaving other backslashes alone", () => {
  assert.equal(unescapeJs("Robert\\'s Titel"), "Robert's Titel");
  assert.equal(unescapeJs('Eine \\"Sache\\".'), 'Eine "Sache".');
  assert.equal(unescapeJs("a\\\\b"), "a\\b");
  assert.equal(unescapeJs("no escapes here"), "no escapes here");
});
