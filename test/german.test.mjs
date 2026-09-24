import { test } from "node:test";
import assert from "node:assert/strict";
import { germanValues, applyGerman } from "../lib/german.mjs";

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
