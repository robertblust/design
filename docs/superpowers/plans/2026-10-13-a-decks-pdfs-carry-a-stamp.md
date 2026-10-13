# A deck's PDFs carry a stamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** robertblust/design gains a stamp for a deck's PDFs, a check that reads it without a browser, and an exporter that leaves a PDF alone when every page of it came out as it was.

**Architecture:** `decks/recipe.mjs` holds the exporter's knobs and hashes them with the deck's entry and the files the card recipe's walk finds, `mermaid.min.js` beside `chat.js` among them, into `pdf.sha` beside the deck. `decks/check.mjs` reads that stamp and returns a count. `decks/export.mjs` reads its knobs from the recipe, compares each PDF it renders with the file on disk page by page through pdf-lib's own loaded document, writes only a file that differs, and stamps the deck last. `assets/chat.js` gives Mermaid a fixed seed, so a drawn picture is the same on every render and a slide that holds one can compare equal at all.

**Tech Stack:** Node ESM, `node --test`, Playwright (the browser suite), pdf-lib as a development dependency for one test file.

**Spec:** `docs/superpowers/specs/2026-10-13-a-decks-pdfs-carry-a-stamp-design.md`

## Scope

This plan is the design repository's half of the spec. companygraph.io's adoption (spec, "What a site holds") is its own change after this repository is released, and is described under "After this plan"; blust.ch and guestgraph.io take it when the owner says.

**Every code block below was run before it was written here.** All five tasks were applied to a throwaway copy of this repository at `main`: `npm test` passes there with them, the state after Task 1 alone passes the exporter's own tests, and Task 4's two tests were seen to fail before the seed was set. The exporter was also run on two decks of companygraph.io without writing into the site: the intro deck's two PDFs were kept, and the requirements deck's, whose drawn slide the site's `chat.js` still draws from a random seed, were written. Type the blocks as they stand.

**Three departures from the spec, for the owner to confirm at plan review.** The spec is amended for the first, in the commit before this plan's.

1. **Mermaid gets a fixed seed (Task 4).** The spec accepted that one drawn picture "moves by a hair" and left making it still out. Measured on 2026-10-13, it is not occasional: a picture holding a rounded node or a cylinder is drawn with a few pixels different on every render, because Mermaid draws those shapes from a seed and picks a random one where the configuration leaves it at 0. The requirements deck's drawn slide came out differently in each of three exports, in both languages, so both of that deck's PDFs and both of the landscape deck's would be written on every `npm run pdf`, which is the cost the exporter's comparison exists to remove. With `handDrawnSeed: 1` in `mermaidConfig`, the same slide was byte for byte the same across three loads, and the landscape deck's across six. So the seed is set, in `assets/chat.js`.
2. **pdf-lib becomes a development dependency (Task 3).** The exporter's tests use a fake `PDFDocument`, which proves the calls made and nothing about what pdf-lib stores. Reading a picture and a link back out of a loaded document is the one part that depends on pdf-lib's own objects, so one test file runs it on real ones. The package still has no dependencies; `playwright` is already a development dependency for the same kind of reason.
3. **The two waits are knobs too (Task 1).** The spec names the frame, the scale, the languages and the hide rule. How long the exporter waits after the language switch and after each slide decides what a screenshot catches as much as those do, so `SETTLE` is hashed with them.

One limit stays, and the amended spec says so: on one slide of the levels deck a transition is still running when the screenshot is taken at 500 ms, and the shot differs in some runs (two of six, measured); at 1500 ms it never did. Waiting longer on every slide of every deck is not in this plan.

## Global Constraints

- The stamp is `pdf.sha` in the deck's directory, one line, the hash and a newline. A deck's PDFs are `<slug>-de.pdf` and `<slug>-en.pdf` beside it.
- The hash opens with the mark `pdf-recipe/1`.
- `root` is a required parameter of every function of `decks/recipe.mjs`, never derived from `import.meta.url` and never defaulted.
- `decks/check.mjs` imports `./recipe.mjs` and nothing else, and never calls `process.exit`.
- The exporter's log lines, exactly: `  ✓ <path>  (<n> slides)` for a file written, `  = <path>  (<n> slides, kept)` for a file left alone.
- The check's log lines, exactly: `  ✓ <dir>`; `  ✗ <dir>  never stamped`; `  ✗ <dir>  the deck has changed since its PDFs were rendered`; `  ✗ <path>  is not on disk`; and the closing lines in Task 2's code.
- The comparison of two PDFs is exact. No tolerance is added.
- American English in everything the package ships; `test/spelling.test.mjs` holds `decks/` to it.
- No number that moves in prose.
- Commits are authored `Implementer <implementer@blust.ch>` with `Process: Delivery`, `Phase: Implement`, `Track: Code`, and end `Verified:` with what ran.
- A change here is at least a minor release; the release itself is the owner's.

## Review Focus

- A file on disk that cannot be read as a PDF, one a dead run left half written, is written again and nothing throws. Task 3 tests it.
- A PDF whose pages hold no picture the reader can find, one some other tool made, is never called the same as anything, itself included. Task 3 tests it on a real pdf-lib document.
- A run that dies in its second deck has stamped the first and not the second. Task 3 tests it.
- A deck that names `chat.js` with a query string, a deck that names no `chat.js`, and a `chat.js` with no `mermaid.min.js` beside it each give the right sources and none throws. Task 1 tests all three.
- A stamp an editor left spaces or a blank line around is still read, and a deck whose stamp is current but whose PDF was deleted is still a problem. Tasks 1 and 2 test them.

---

### Task 1: The recipe

**Files:**

- Create: `decks/recipe.mjs`
- Create: `test/decks-recipe.test.mjs`
- Modify: `decks/export.mjs` (its imports and the four places it uses a knob)
- Modify: `package.json` (`exports`)

**Interfaces:**

- Consumes: `sources(dir, root)` from `cards/recipe.mjs`, which returns the page and every file of the repository it names, sorted, as paths relative to `root`.
- Produces, from `decks/recipe.mjs`: `FRAME` `{ width, height, deviceScaleFactor }`, `LANGS` `["de", "en"]`, `HIDE` (the CSS string), `SETTLE` `{ language, slide }`, `KNOBS`; `pdfOf(deck, lang)` → a path relative to the root; `stampOf(dir, root)` → an absolute path; `sourcesOf(dir, root)` → sorted relative paths; `recipe(deck, root, knobs = KNOBS)` → a hex string; `state(deck, root)` → `{ dir, want, have, missing, state }` with `state` one of `"unstamped"`, `"current"`, `"stale"` and `missing` the relative paths of PDFs not on disk; `stamp(deck, root)` writes the stamp.

- [ ] **Step 1: Install**

Run: `npm ci`. Expected: it ends without an error. The worktree has no `node_modules` until then.

- [ ] **Step 2: Write the failing test**

Create `test/decks-recipe.test.mjs`:

```js
// The deck recipe, against throwaway trees rather than a real site's decks — a real deck
// changes, and a test that reads one stops meaning anything the day it does.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { KNOBS, FRAME, LANGS, pdfOf, stampOf, sourcesOf, recipe, state, stamp } from "../decks/recipe.mjs";

// A throwaway site root, seeded with files.
function tree(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "decks-recipe-"));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
}

const DECK = { dir: "talks/intro", slug: "intro" };
// The query on chat.js is what a cache-busting site writes; the walk strips it.
const PAGE = '<html><link rel="stylesheet" href="../../deck.css">' +
  '<script src="../../chat.js?v=2"></script><script src="scenes.js"></script></html>';
const site = (over = {}) => tree({
  "talks/intro/index.html": PAGE, "deck.css": "a{}", "chat.js": "chat", "mermaid.min.js": "mermaid",
  "talks/intro/scenes.js": "scenes", "unnamed.css": "b{}", ...over,
});

test("root has no default on any raw function", () => {
  // The SITE_ROOT defect, as test/cards-recipe.test.mjs guards it: `length` leaves out a
  // parameter that has a default, so a root that grew one shows as a shorter function.
  for (const [name, fn] of Object.entries({ stampOf, sourcesOf, recipe, state, stamp }))
    assert.equal(fn.length, 2, `${name} has grown a default value on root`);
});

test("the sources are the page, what it names, and mermaid beside the chat.js it names", () => {
  assert.deepEqual(sourcesOf("talks/intro", site()),
    ["chat.js", "deck.css", "mermaid.min.js", "talks/intro/index.html", "talks/intro/scenes.js"]);
});

test("mermaid is not a source of a deck that names no chat.js", () => {
  const root = site({ "talks/intro/index.html": '<html><link rel="stylesheet" href="../../deck.css"></html>' });
  assert.deepEqual(sourcesOf("talks/intro", root), ["deck.css", "talks/intro/index.html"]);
});

test("a chat.js with no mermaid beside it is still a source, and nothing throws", () => {
  const root = site();
  fs.rmSync(path.join(root, "mermaid.min.js"));
  assert.deepEqual(sourcesOf("talks/intro", root),
    ["chat.js", "deck.css", "talks/intro/index.html", "talks/intro/scenes.js"]);
});

for (const rel of ["talks/intro/index.html", "deck.css", "chat.js", "mermaid.min.js", "talks/intro/scenes.js"]) {
  test(`the hash moves when ${rel} moves`, () => {
    const root = site();
    const before = recipe(DECK, root);
    fs.appendFileSync(path.join(root, rel), " ");
    assert.notEqual(recipe(DECK, root), before);
  });
}

test("the hash does not move when a file the page does not name moves", () => {
  const root = site();
  const before = recipe(DECK, root);
  fs.appendFileSync(path.join(root, "unnamed.css"), " ");
  assert.equal(recipe(DECK, root), before);
});

test("the hash moves when a knob moves", () => {
  const root = site();
  assert.notEqual(recipe(DECK, root, { ...KNOBS, settle: { language: 400, slide: 600 } }), recipe(DECK, root));
});

test("the hash moves when the deck's entry moves, and not when its keys change order", () => {
  const root = site();
  assert.notEqual(recipe({ dir: "talks/intro", slug: "other" }, root), recipe(DECK, root));
  assert.equal(recipe({ slug: "intro", dir: "talks/intro" }, root), recipe(DECK, root));
});

test("the knobs are the frame, the languages, the hide rule and the waits the exporter reads", () => {
  assert.deepEqual(FRAME, { width: 1280, height: 720, deviceScaleFactor: 2 });
  assert.deepEqual(LANGS, ["de", "en"]);
  assert.deepEqual(Object.keys(KNOBS).sort(), ["frame", "hide", "langs", "settle"]);
});

test("a deck is unstamped, then current once stamped, then stale once its page moves", () => {
  const root = site();
  assert.equal(state(DECK, root).state, "unstamped");
  stamp(DECK, root);
  assert.equal(fs.readFileSync(stampOf("talks/intro", root), "utf8"), recipe(DECK, root) + "\n");
  assert.equal(state(DECK, root).state, "current");
  fs.appendFileSync(path.join(root, "talks/intro/index.html"), "<!-- edited -->");
  assert.equal(state(DECK, root).state, "stale");
});

test("a stamp an editor left spaces or a blank line around is still read", () => {
  const root = site();
  fs.writeFileSync(stampOf("talks/intro", root), "  " + recipe(DECK, root) + "  \n\n");
  assert.equal(state(DECK, root).state, "current");
});

test("missing names each PDF the deck should have and does not", () => {
  const root = site();
  assert.deepEqual(state(DECK, root).missing, ["talks/intro/intro-de.pdf", "talks/intro/intro-en.pdf"]);
  fs.writeFileSync(path.join(root, pdfOf(DECK, "de")), "pdf");
  assert.deepEqual(state(DECK, root).missing, ["talks/intro/intro-en.pdf"]);
  fs.writeFileSync(path.join(root, pdfOf(DECK, "en")), "pdf");
  assert.deepEqual(state(DECK, root).missing, []);
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `node --test test/decks-recipe.test.mjs`. Expected: FAIL, `Cannot find module` naming `decks/recipe.mjs`.

- [ ] **Step 4: Write the module**

Create `decks/recipe.mjs`:

```js
// What went into a deck's PDFs, and how to tell whether they still show it.
//
// A deck's PDFs are one screenshot per slide: a copy that has to be rendered again whenever the
// deck moves, and nothing about a stale one looks wrong. A share card is the same kind of copy,
// and cards/recipe.mjs is how a card's staleness is told. This is the same answer for a deck,
// and it reads the card recipe's source walk rather than keeping a second one.
//
// The comparison is the recipe, never the pixels, for the card's reason: two machines rasterize
// the same slide differently, and a hash of what went *into* a PDF needs no browser.
//
// `root` is required on every function below, never derived from `import.meta.url`: this module
// sits inside `node_modules` once it ships, and the site owns its root.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { sources } from "../cards/recipe.mjs";

// What exportDecks does to every slide of every deck. These are the package's and not a site's,
// and they live here rather than in export.mjs so that the recipe hashes the very values the
// exporter reads: a knob that changes moves every deck's hash by being changed, rather than by
// someone remembering to say so.
export const FRAME = { width: 1280, height: 720, deviceScaleFactor: 2 };
export const LANGS = ["de", "en"];
// Hide the controls, not the credit: .name lives inside .chrome, and hiding the whole bar took
// the byline off every printed page. A transport in a PDF advertises buttons that do nothing; a
// byline is the one part of that bar a printed page still wants.
export const HIDE = `.transport,.bar,.notes{display:none!important}\n     /* a still image should not be waiting out a transition it does not want */\n     .slide.active > *{animation:none!important}`;
// Milliseconds: after the language switch, and after each slide is made the one shown.
export const SETTLE = { language: 400, slide: 500 };
export const KNOBS = { frame: FRAME, langs: LANGS, hide: HIDE, settle: SETTLE };

// Raised by hand for a change to what a PDF holds that no knob above carries, such as how a
// link is written onto a page.
const MARK = "pdf-recipe/1";

export const pdfOf = (deck, lang) => path.join(deck.dir, `${deck.slug}-${lang}.pdf`);
export const stampOf = (dir, root) => path.join(root, dir, "pdf.sha");

// The card recipe's walk, and one file it cannot find: chat.js fetches mermaid.min.js from
// beside itself when a slide holds a picture, and no tag names it. They are the two files a
// drawn picture's own stamp reads, in lib/pictures.mjs, for the same reason.
export function sourcesOf(dir, root) {
  const found = new Set(sources(dir, root));
  for (const rel of [...found]) {
    if (path.basename(rel) !== "chat.js") continue;
    const mermaid = path.join(path.dirname(rel), "mermaid.min.js");
    if (fs.existsSync(path.join(root, mermaid))) found.add(mermaid);
  }
  return [...found].sort();
}

// Key order in a deck literal is not a change to the deck.
const canonical = (deck) =>
  JSON.stringify(Object.fromEntries(Object.entries(deck).sort(([a], [b]) => (a < b ? -1 : 1))));

// `knobs` is a parameter so that a test can move one; every caller leaves it alone.
export function recipe(deck, root, knobs = KNOBS) {
  const h = crypto.createHash("sha256");
  h.update(MARK + "\n" + JSON.stringify(knobs) + "\n" + canonical(deck) + "\n");
  for (const rel of sourcesOf(deck.dir, root)) {
    h.update(rel + "\0");
    h.update(fs.readFileSync(path.join(root, rel)));
  }
  return h.digest("hex");
}

// One stamp covers both languages: a deck's page holds both, so nothing that moves one PDF's
// inputs leaves the other's alone. `missing` names each PDF the deck should have and does not.
export function state(deck, root) {
  const file = stampOf(deck.dir, root);
  const want = recipe(deck, root);
  const have = fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : "";
  return {
    dir: deck.dir,
    want,
    have,
    missing: LANGS.map((lang) => pdfOf(deck, lang)).filter((rel) => !fs.existsSync(path.join(root, rel))),
    state: !have ? "unstamped" : have === want ? "current" : "stale",
  };
}

// Written after both PDFs are decided, so an exporter that dies half way leaves its deck
// reported stale rather than reported current on a file it never finished.
export function stamp(deck, root) {
  fs.writeFileSync(stampOf(deck.dir, root), recipe(deck, root) + "\n");
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `node --test test/decks-recipe.test.mjs`. Expected: PASS, every test.

- [ ] **Step 6: The exporter reads its knobs from the recipe**

Change `decks/export.mjs` as this difference shows. Nothing it does changes: the frame, the languages, the hide rule and the two waits are the values they were, read from the recipe, and the comment on the hide rule has moved there with it.

```diff
@@ -35,9 +35,10 @@
 import { writeFileSync } from "node:fs";
 import path from "node:path";
 import { serve } from "../cards/export.mjs";
+import { FRAME, LANGS, HIDE, SETTLE } from "./recipe.mjs";
 
-const W = 1280, H = 720;
-const LANGS = ["de", "en"];
+// The frame, the languages, the hide rule and the waits are recipe.mjs's, which hashes them.
+const W = FRAME.width, H = FRAME.height;
 
 // The vocabulary a deck may use. Borrowed from cards/export.mjs and for the same reason: an
 // unknown key is a knob that silently does nothing, and a deck list is edited by hand.
@@ -84,19 +85,16 @@
     const browser = await chromium.launch();
     try {
       for (const deck of decks) {
-        const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
+        const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: FRAME.deviceScaleFactor });
         await page.goto(`${siteBase}/${deck.dir}/`, { waitUntil: "networkidle" });
-        // Hide the controls, not the credit: .name lives inside .chrome, and hiding the whole
-        // bar took the byline off every printed page. A transport in a PDF advertises buttons
-        // that do nothing; a byline is the one part of that bar a printed page still wants.
-        await page.addStyleTag({ content: `.transport,.bar,.notes{display:none!important}\n     /* a still image should not be waiting out a transition it does not want */\n     .slide.active > *{animation:none!important}` });
+        await page.addStyleTag({ content: HIDE });
         const count = await page.evaluate(() => document.querySelectorAll(".slide").length);
 
         for (const lang of LANGS) {
           // the decks have no keyboard shortcuts any more — click the transport's language
           // toggle. The rule above hides it, so click it through the DOM, not the pointer.
           await page.evaluate(l => document.getElementById(l === "de" ? "langDe" : "langEn").click(), lang);
-          await page.waitForTimeout(400);
+          await page.waitForTimeout(SETTLE.language);
 
           const pdf = await PDFDocument.create();
           for (let i = 0; i < count; i++) {
@@ -104,7 +102,7 @@
               const s = Array.from(document.querySelectorAll(".slide"));
               s.forEach((el, k) => el.classList.toggle("active", k === n));
             }, i);
-            await page.waitForTimeout(500);        // let the rise animation settle
+            await page.waitForTimeout(SETTLE.slide);   // let the rise animation settle
             const links = PDFString ? await page.evaluate(linksOnSlide, { n: i, lang, W, H }) : [];
             const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } });
             const img = await pdf.embedPng(png);
```

- [ ] **Step 7: The entry in `exports`**

In `package.json`, after the line `"./decks/export": "./decks/export.mjs",` add:

```json
    "./decks/recipe": "./decks/recipe.mjs",
```

- [ ] **Step 8: Run the exporter's own tests and the suite**

Run: `node --test test/decks-export.test.mjs`. Expected: PASS, unchanged: the frame, the hide rule and the waits are what they were, read from another module.

Run: `npm test`. Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add decks/recipe.mjs decks/export.mjs test/decks-recipe.test.mjs package.json
git commit --author "Implementer <implementer@blust.ch>" -F - <<'EOF'
A deck's PDFs have a recipe

A deck's PDFs are a copy of its slides with nothing to say what they were rendered from. The recipe hashes the deck's page and every file of its repository the page names, by the card recipe's own walk, with mermaid.min.js where the page names the chat.js that fetches it, the deck's entry, and the exporter's knobs, which move here so that the exporter reads the very values the hash holds. One stamp, pdf.sha beside the deck, covers both languages.

Verified: node --test test/decks-recipe.test.mjs and npm test pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: <the model that wrote this commit> <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

Expected: the subject alone between the brackets.

### Task 2: The check

**Files:**

- Create: `decks/check.mjs`
- Create: `test/decks-check.test.mjs`
- Create: `test/decks-packaging.test.mjs`
- Modify: `package.json` (`exports`)

**Interfaces:**

- Consumes: `state(deck, root)` and `stamp(deck, root)` from `decks/recipe.mjs`, as Task 1 gives them.
- Produces: `checkDecks({ decks, root }, log = console.log)` → the number of problems. It never exits.

- [ ] **Step 1: Write the failing tests**

Create `test/decks-check.test.mjs`:

```js
// checkDecks against throwaway trees, as test/cards-check.test.mjs checks the cards.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { checkDecks } from "../decks/check.mjs";
import { stamp } from "../decks/recipe.mjs";

// Armed at module scope for the reason test/cards-check.test.mjs gives: a real `process.exit`
// inside a test ends the run, and the tests after it are never reported.
process.exit = (code) => {
  throw new Error(`checkDecks must return a count, not process.exit(${code})`);
};

const DECK = { dir: "talks/intro", slug: "intro" };

// A throwaway site with one deck, both of its PDFs on disk and its stamp current.
function site() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "decks-check-"));
  fs.mkdirSync(path.join(root, "talks/intro"), { recursive: true });
  fs.writeFileSync(path.join(root, "talks/intro/index.html"), "<html></html>");
  for (const lang of ["de", "en"]) fs.writeFileSync(path.join(root, `talks/intro/intro-${lang}.pdf`), "pdf");
  stamp(DECK, root);
  return root;
}

function run(root, decks = [DECK]) {
  const logs = [];
  return { problems: checkDecks({ decks, root }, (m) => logs.push(m)), logs };
}

test("a deck whose stamp is its hash and whose PDFs are there passes", () => {
  const { problems, logs } = run(site());
  assert.equal(problems, 0);
  assert.deepEqual(logs, ["  ✓ talks/intro", "\n  every deck's PDFs match the deck they render"]);
});

test("a deck never stamped is counted and named, with the command that clears it", () => {
  const root = site();
  fs.rmSync(path.join(root, "talks/intro/pdf.sha"));
  const { problems, logs } = run(root);
  assert.equal(problems, 1);
  assert.equal(logs[0], "  ✗ talks/intro  never stamped");
  assert.ok(logs.some((l) => l.includes("run: npm run pdf")));
  assert.ok(logs.some((l) => l.includes("commit each pdf.sha with the PDFs that changed")));
});

test("a deck that moved since its PDFs were rendered is counted and named", () => {
  const root = site();
  fs.appendFileSync(path.join(root, "talks/intro/index.html"), "<!-- edited -->");
  const { problems, logs } = run(root);
  assert.equal(problems, 1);
  assert.equal(logs[0], "  ✗ talks/intro  the deck has changed since its PDFs were rendered");
});

test("a PDF that is not on disk is counted and named, though the stamp is current", () => {
  const root = site();
  fs.rmSync(path.join(root, "talks/intro/intro-en.pdf"));
  const { problems, logs } = run(root);
  assert.equal(problems, 1);
  assert.equal(logs[0], "  ✗ talks/intro/intro-en.pdf  is not on disk");
  assert.ok(!logs.includes("  ✓ talks/intro"));
});

test("a stale deck with neither PDF is three problems, each named", () => {
  const root = site();
  fs.appendFileSync(path.join(root, "talks/intro/index.html"), "<!-- edited -->");
  for (const lang of ["de", "en"]) fs.rmSync(path.join(root, `talks/intro/intro-${lang}.pdf`));
  assert.equal(run(root).problems, 3);
});

test("a site with no decks has nothing wrong with it", () => {
  assert.equal(run(site(), []).problems, 0);
});

// The property a site's CI leans on: `pdf:check` runs before the browser is installed. The
// check and the two recipes it reads are copied into a directory with no node_modules above it
// and imported there, which is what CI does, where a grep for import lines would miss a
// `createRequire` or a module-scope `await import`.
test("decks/check.mjs loads with no node_modules anywhere above it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "decks-check-isolated-"));
  for (const rel of ["decks/check.mjs", "decks/recipe.mjs", "cards/recipe.mjs"]) {
    fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
    fs.copyFileSync(new URL("../" + rel, import.meta.url), path.join(dir, rel));
  }
  fs.writeFileSync(path.join(dir, "loader.mjs"),
    'import("./decks/check.mjs").then(() => process.exit(0), () => process.exit(1));\n');
  assert.equal(spawnSync(process.execPath, ["loader.mjs"], { cwd: dir }).status, 0);
});
```

Create `test/decks-packaging.test.mjs`:

```js
// A module under decks/ that is missing from `exports` or from `files` is invisible to a site,
// and the error names the package rather than the file. Both lists are kept by hand, so both
// get a test, as test/cards-packaging.test.mjs gives the cards.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("every module under decks/ is published", () => {
  assert.ok(pkg.files.includes("decks"), "`files` must include decks/ or npm packs without it");
  for (const f of fs.readdirSync(new URL("../decks/", import.meta.url))) {
    if (!f.endsWith(".mjs")) continue;
    assert.equal(pkg.exports["./decks/" + path.basename(f, ".mjs")], "./decks/" + f,
      `${f} has no \`exports\` entry, so no site can import it`);
  }
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/decks-check.test.mjs test/decks-packaging.test.mjs`. Expected: FAIL. The first cannot find `decks/check.mjs`. The second passes for now, since every module under `decks/` is in `exports`; it fails once `check.mjs` exists without its entry, which Step 4 shows.

- [ ] **Step 3: Write the module**

Create `decks/check.mjs`:

```js
// Do each deck's PDFs still show the deck they were rendered from?
//
// It renders nothing and imports nothing outside node's standard library and this package's own
// recipes, so it needs no browser: a site's `pdf:check` runs beside its `og:check`, after
// `npm ci` and before `npx playwright install`. A site's `pdf-check.mjs` calls `checkDecks` and
// exits on what it returns; this module never exits on its own, for the reason `checkCards`
// does not.
//
// It over-reports and never under-reports, as the card check does: an edit to a comment in a
// deck marks its PDFs stale. Clearing that is `npm run pdf` and a commit, and the exporter
// leaves a PDF alone when every page of it came out as it was, so the commit is the stamp.
import { state } from "./recipe.mjs";

const WHY = {
  unstamped: "never stamped",
  stale: "the deck has changed since its PDFs were rendered",
};

export function checkDecks({ decks, root }, log = console.log) {
  let problems = 0;
  for (const deck of decks) {
    const s = state(deck, root);
    if (s.state !== "current") {
      problems += 1;
      log(`  ✗ ${s.dir}  ${WHY[s.state]}`);
    }
    for (const rel of s.missing) {
      problems += 1;
      log(`  ✗ ${rel}  is not on disk`);
    }
    if (s.state === "current" && !s.missing.length) log(`  ✓ ${s.dir}`);
  }
  if (problems) {
    log(`\n  ${problems} problem(s) with the decks' PDFs — run: npm run pdf`);
    log("  then commit each pdf.sha with the PDFs that changed.");
  } else {
    log("\n  every deck's PDFs match the deck they render");
  }
  return problems;
}
```

- [ ] **Step 4: See the packaging test catch the missing entry**

Run: `node --test test/decks-packaging.test.mjs`. Expected: FAIL, "check.mjs has no `exports` entry, so no site can import it".

- [ ] **Step 5: The entry in `exports`**

In `package.json`, after the line `"./decks/recipe": "./decks/recipe.mjs",` add:

```json
    "./decks/check": "./decks/check.mjs",
```

- [ ] **Step 6: Run the tests and the suite**

Run: `node --test test/decks-check.test.mjs test/decks-packaging.test.mjs`. Expected: PASS.

Run: `npm test`. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add decks/check.mjs test/decks-check.test.mjs test/decks-packaging.test.mjs package.json
git commit --author "Implementer <implementer@blust.ch>" -F - <<'EOF'
A check reads a deck's stamp without a browser

The recipe says what a deck's PDFs should have been rendered from, and nothing read it. checkDecks takes a site's decks and its root, names each deck whose stamp is missing or is not its hash and each PDF that is not on disk, and returns the count for the site's own script to exit on, as checkCards does. It imports the recipe and nothing else, so it runs before the browser is installed, and a test loads it where no node_modules exists.

Verified: node --test test/decks-check.test.mjs test/decks-packaging.test.mjs and npm test pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: <the model that wrote this commit> <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

Expected: the subject alone between the brackets.

### Task 3: The exporter keeps what did not change

**Files:**

- Modify: `decks/export.mjs`
- Modify: `test/decks-export.test.mjs`
- Create: `test/decks-pages.test.mjs`
- Modify: `package.json`, `package-lock.json` (pdf-lib as a development dependency)

**Interfaces:**

- Consumes: `pdfOf(deck, lang)` and `stamp(deck, root)` from `decks/recipe.mjs`; `PDFDocument.load(bytes)`, which pdf-lib has and the caller's `PDFDocument` therefore carries.
- Produces, from `decks/export.mjs`: `pagesOf(doc)` → one `{ picture, links }` per page, `picture` a hex digest or `null` and `links` strings; `samePages(a, b)` → boolean; `exportDecks` takes three more optional parameters, `read(file)` → a Buffer or `null`, `stamp(deck, root)` and `readPages(doc)`, and each entry of what it returns gains `kept`.

- [ ] **Step 1: pdf-lib for the tests**

Run: `npm install --save-dev pdf-lib@^1.17.1`. Expected: `package.json` lists `pdf-lib` under `devDependencies` beside `playwright`, and `package-lock.json` changes. `dependencies` stays absent.

- [ ] **Step 2: Write the failing tests**

Create `test/decks-pages.test.mjs`:

```js
// pagesOf and samePages against real pdf-lib documents, built the way exportDecks builds one.
// The exporter's own tests drive it with a fake PDFDocument, which proves the calls it makes and
// nothing about what pdf-lib stores; reading a picture and a link back out of a loaded document
// is the one part that depends on pdf-lib's own objects, so it is tested on them.
import { test } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { PDFDocument, PDFString } from "pdf-lib";

import { pagesOf, samePages, annotation } from "../decks/export.mjs";

// A small but real PNG in one color, as test/cards-check.test.mjs builds one.
function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function makePNG([r, g, b], size = 8) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8);  // bit depth
  ihdr.writeUInt8(2, 9);  // color type 2: RGB
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = y * (size * 3 + 1) + 1 + x * 3;
    raw[p] = r; raw[p + 1] = g; raw[p + 2] = b;
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const DARK = [12, 14, 19], LIGHT = [250, 249, 245];
const LINK = { x: 100, y: 50, w: 200, h: 20, url: "https://companygraph.io/?lang=en" };

// One page per slide, the picture drawn full frame and each link an annotation over it, saved
// and loaded again: what exportDecks writes, and what it later reads from disk.
async function saved(slides, at = new Date("2026-01-01T00:00:00Z")) {
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(at);
  pdf.setModificationDate(at);
  for (const { color, links = [] } of slides) {
    const page = pdf.addPage([1280, 720]);
    if (color) page.drawImage(await pdf.embedPng(makePNG(color)), { x: 0, y: 0, width: 1280, height: 720 });
    for (const l of links) page.node.addAnnot(pdf.context.register(pdf.context.obj(annotation(l, PDFString))));
  }
  return Buffer.from(await pdf.save());
}
const read = async (bytes) => pagesOf(await PDFDocument.load(bytes));

const DECK = [{ color: DARK, links: [LINK] }, { color: LIGHT }];

test("each page gives its picture's digest and its links as the PDF writes them", async () => {
  const pages = await read(await saved(DECK));
  assert.equal(pages.length, 2);
  assert.match(pages[0].picture, /^[0-9a-f]{64}$/);
  assert.notEqual(pages[0].picture, pages[1].picture);
  assert.equal(pages[0].links.length, 1);
  assert.ok(pages[0].links[0].includes("(https://companygraph.io/?lang=en)"));
  assert.ok(pages[0].links[0].includes("/Rect [ 100 650 300 670 ]"));
  assert.deepEqual(pages[1].links, []);
});

test("two files saved at different times from the same slides hold the same pages", async () => {
  const a = await saved(DECK, new Date("2026-01-01T00:00:00Z"));
  const b = await saved(DECK, new Date("2026-06-01T00:00:00Z"));
  assert.ok(!a.equals(b), "the two files must differ as bytes, or this proves nothing");
  assert.equal(samePages(await read(a), await read(b)), true);
});

test("a changed picture, a changed address, a moved link, a new link and a lost page each differ", async () => {
  const base = await read(await saved(DECK));
  const differs = async (slides) => assert.equal(samePages(base, await read(await saved(slides))), false);
  await differs([{ color: LIGHT, links: [LINK] }, { color: LIGHT }]);
  await differs([{ color: DARK, links: [{ ...LINK, url: "https://companygraph.io/?lang=de" }] }, { color: LIGHT }]);
  await differs([{ color: DARK, links: [{ ...LINK, x: 101 }] }, { color: LIGHT }]);
  await differs([{ color: DARK, links: [LINK, LINK] }, { color: LIGHT }]);
  await differs([{ color: DARK, links: [LINK] }]);
});

test("a page with no picture on it is read as null and is the same as nothing", async () => {
  const pages = await read(await saved([{ links: [LINK] }]));
  assert.equal(pages[0].picture, null);
  assert.equal(samePages(pages, pages), false);
});
```

Change `test/decks-export.test.mjs` as this difference from `main` shows. The harness gains a fake `load`, a `disk`, the `io` every call now spreads, and a shot that can fail; every call's `log: h.log, write: h.write` becomes `...h.io`, since with the real `stamp` a call would read a site that is not there; and the new tests follow the last one.

```diff
@@ -11,15 +11,17 @@
 import http from "node:http";
 import { pathToFileURL } from "node:url";
 
-import { exportDecks, validate, annotation } from "../decks/export.mjs";
+import { exportDecks, validate, annotation, samePages } from "../decks/export.mjs";
 
 const ROOT = "/tmp/a-site-that-is-never-read";
 const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
 
-function harness({ slides = 3, links = [] } = {}) {
+function harness({ slides = 3, links = [], failShot = 0 } = {}) {
   const calls = [];
   const logs = [];
   const written = [];
+  const events = [];
+  let shots = 0;
   let inFlight = null;
   const record = async (...entry) => {
     if (inFlight) throw new Error(`${entry[0]} began while ${inFlight} was still in flight — a missing await`);
@@ -39,7 +41,9 @@
                                   return arg && typeof arg === "object" && "n" in arg ? links : slides; },
     addStyleTag: (o) => record("style", o.content),
     waitForTimeout: (ms) => record("wait", ms),
-    screenshot: async (o) => { await record("shot", o); return Buffer.from("png"); },
+    screenshot: async (o) => { await record("shot", o);
+                               if (++shots === failShot) throw new Error("the browser died");
+                               return Buffer.from("png"); },
     close: () => record("closePage"),
   };
   const browser = {
@@ -56,15 +60,33 @@
                              return { drawImage: (img, box) => { p.drawn = { img, box }; },
                                       node: { addAnnot: (ref) => p.annots.push(ref) } }; },
         context: { obj: (o) => o, register: (o) => ({ ref: o }) },
-        save: async () => { written.push(pages); return Buffer.from(`pdf:${pages.length}`); },
+        // What a saved file holds, as the fake `load` and `readPages` below give it back: each
+        // page's picture and the addresses of its links.
+        save: async () => { written.push(pages); return pdfBytes(pages.map((p) => ({
+          picture: p.drawn.img.png, links: p.annots.map((a) => a.ref.A.URI.str) }))); },
       };
     },
+    load: async (buf) => ({ held: JSON.parse(buf.toString()) }),
   };
   const files = [];
-  return { calls, logs, written, files, chromium, PDFDocument,
-           log: (m) => logs.push(m), write: (file, buf) => files.push({ file, buf }) };
+  const stamps = [];
+  // The files already on disk when a run starts, by absolute path. Empty unless a test fills it.
+  const disk = new Map();
+  // Everything exportDecks would otherwise do to a real filesystem or a real pdf-lib document.
+  const io = {
+    log: (m) => logs.push(m),
+    write: (file, buf) => { files.push({ file, buf }); events.push("write:" + path.basename(file)); },
+    read: (file) => disk.get(file) ?? null,
+    stamp: (deck) => { stamps.push(deck.dir); events.push("stamp:" + deck.dir); },
+    readPages: (doc) => doc.held,
+  };
+  return { calls, logs, written, files, stamps, disk, events, io, chromium, PDFDocument };
 }
 
+// A PDF as the fake holds one: its pages, each a picture and its links' addresses.
+const pdfBytes = (pages) => Buffer.from(JSON.stringify(pages));
+const onDisk = (rel) => path.join(ROOT, rel);
+
 test("a deck with an unknown key is rejected rather than silently ignored", () => {
   assert.throws(() => validate([{ dir: "talks/intro", slug: "intro", scale: 2 }]),
                 /unknown key "scale"/);
@@ -79,7 +101,7 @@
   const h = harness({ slides: 3 });
   const written = await exportDecks({
     chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
-    decks: [{ dir: "talks/intro", slug: "guestgraph" }], log: h.log, write: h.write,
+    decks: [{ dir: "talks/intro", slug: "guestgraph" }], ...h.io,
   });
   assert.deepEqual(written.map((w) => path.relative(ROOT, w.file)),
                    ["talks/intro/guestgraph-de.pdf", "talks/intro/guestgraph-en.pdf"]);
@@ -90,7 +112,7 @@
 test("the frame is 1280x720 at deviceScaleFactor 2, and the clip matches it", async () => {
   const h = harness({ slides: 1 });
   await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
-                      decks: [{ dir: "talks/intro", slug: "g" }], log: h.log, write: h.write });
+                      decks: [{ dir: "talks/intro", slug: "g" }], ...h.io });
   const [, opts] = h.calls.find((c) => c[0] === "newPage");
   assert.deepEqual(opts, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
   const [, clip] = h.calls.find((c) => c[0] === "shot");
@@ -101,7 +123,7 @@
   const h = harness({ slides: 1 });
   await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
                       decks: [{ dir: "talks/intro", slug: "guestgraph" }],
-                      base: "http://x.test", log: h.log, write: h.write });
+                      base: "http://x.test", ...h.io });
   const [, url, opts] = h.calls.find((c) => c[0] === "goto");
   assert.equal(url, "http://x.test/talks/intro/");
   assert.deepEqual(opts, { waitUntil: "networkidle" });
@@ -112,7 +134,7 @@
   await assert.rejects(
     exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
                   decks: [{ dir: "talks/intro", slug: "g" }],
-                  base: pathToFileURL(ROOT).href, log: h.log, write: h.write }),
+                  base: pathToFileURL(ROOT).href, ...h.io }),
     /serves.*over http|no longer opens from file:\/\//i);
   // Nothing was launched at all: the refusal happens before the browser or the deck loop.
   assert.equal(h.calls.length, 0);
@@ -121,7 +143,7 @@
 test("with no base at all, the exporter serves root itself and closes the server once done", async () => {
   const h = harness({ slides: 1 });
   await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
-                      decks: [{ dir: "talks/intro", slug: "guestgraph" }], log: h.log, write: h.write });
+                      decks: [{ dir: "talks/intro", slug: "guestgraph" }], ...h.io });
   const [, url] = h.calls.find((c) => c[0] === "goto");
   const m = /^http:\/\/127\.0\.0\.1:(\d+)\/talks\/intro\/$/.exec(url);
   assert.ok(m, `expected a served base, got ${JSON.stringify(url)}`);
@@ -140,7 +162,7 @@
 test("the hide rule hides the transport, the bar and the notes, and nothing else", async () => {
   const h = harness({ slides: 1 });
   await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
-                      decks: [{ dir: "talks/intro", slug: "g" }], log: h.log, write: h.write });
+                      decks: [{ dir: "talks/intro", slug: "g" }], ...h.io });
   const [, css] = h.calls.find((c) => c[0] === "style");
   assert.ok(css.includes(".transport,.bar,.notes{display:none!important}"));
   assert.ok(css.includes(".slide.active > *{animation:none!important}"));
@@ -153,7 +175,7 @@
 test("400ms settles the language switch and 500ms settles each slide", async () => {
   const h = harness({ slides: 2 });
   await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
-                      decks: [{ dir: "talks/intro", slug: "g" }], log: h.log, write: h.write });
+                      decks: [{ dir: "talks/intro", slug: "g" }], ...h.io });
   const waits = h.calls.filter((c) => c[0] === "wait").map((c) => c[1]);
   // per language: one 400 after the toggle, then one 500 per slide
   assert.deepEqual(waits, [400, 500, 500, 400, 500, 500]);
@@ -165,7 +187,7 @@
     chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
     decks: [{ dir: "talks/mental-model", slug: "mental-model" },
             { dir: "talks/essential-complexity", slug: "essential-complexity" }],
-    log: h.log, write: h.write,
+    ...h.io,
   });
   assert.deepEqual(written.map((w) => path.relative(ROOT, w.file)), [
     "talks/mental-model/mental-model-de.pdf",
@@ -181,7 +203,7 @@
 test("every page drawn is the full frame at the origin", async () => {
   const h = harness({ slides: 2 });
   await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
-                      decks: [{ dir: "talks/intro", slug: "g" }], log: h.log, write: h.write });
+                      decks: [{ dir: "talks/intro", slug: "g" }], ...h.io });
   for (const pages of h.written) {
     assert.equal(pages.length, 2);
     for (const p of pages) {
@@ -194,7 +216,7 @@
 test("each written file is logged with its slide count", async () => {
   const h = harness({ slides: 4 });
   await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
-                      decks: [{ dir: "talks/intro", slug: "g" }], log: h.log, write: h.write });
+                      decks: [{ dir: "talks/intro", slug: "g" }], ...h.io });
   assert.deepEqual(h.logs, ["  ✓ talks/intro/g-de.pdf  (4 slides)",
                             "  ✓ talks/intro/g-en.pdf  (4 slides)"]);
 });
@@ -204,7 +226,7 @@
 test("without PDFString the slides are not asked for links and no page carries one", async () => {
   const h = harness({ slides: 2, links: [{ x: 0, y: 0, w: 10, h: 10, url: "https://blust.ch/" }] });
   await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
-                      decks: [{ dir: "talks/intro", slug: "g" }], log: h.log, write: h.write });
+                      decks: [{ dir: "talks/intro", slug: "g" }], ...h.io });
   assert.equal(h.calls.filter((c) => c[0] === "eval" && c[2] && typeof c[2] === "object").length, 0);
   for (const pages of h.written) for (const p of pages) assert.deepEqual(p.annots, []);
 });
@@ -214,7 +236,7 @@
                  { x: 1200, y: 680, w: 40, h: 30, url: "https://companygraph.io/talks/x/?chat=open&lang=en" }];
   const h = harness({ slides: 2, links });
   await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, PDFString: FakeString, root: ROOT,
-                      decks: [{ dir: "talks/intro", slug: "g" }], log: h.log, write: h.write });
+                      decks: [{ dir: "talks/intro", slug: "g" }], ...h.io });
   const asks = h.calls.filter((c) => c[0] === "eval" && c[2] && typeof c[2] === "object");
   assert.deepEqual(asks.map((c) => [c[2].n, c[2].lang]), [[0, "de"], [1, "de"], [0, "en"], [1, "en"]]);
   const order = h.calls.map((c) => c[0]).filter((k) => k === "eval" || k === "shot");
@@ -230,4 +252,84 @@
     Type: "Annot", Subtype: "Link", Rect: [100, 650, 300, 670], Border: [0, 0, 0],
     A: { Type: "Action", S: "URI", URI: { str: "https://blust.ch/" } },
   });
+});
+
+// The fake screenshot is always the bytes "png", so a slide's picture is "png" unless a test
+// says the file on disk held something else.
+const still = (n, links = []) => Array.from({ length: n }, () => ({ picture: "png", links }));
+const ONE = [{ dir: "talks/intro", slug: "g" }];
+
+test("a PDF whose pages match the file on disk is not written, and the deck is still stamped", async () => {
+  const h = harness({ slides: 2 });
+  h.disk.set(onDisk("talks/intro/g-de.pdf"), pdfBytes(still(2)));
+  h.disk.set(onDisk("talks/intro/g-en.pdf"), pdfBytes(still(2)));
+  const out = await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT, decks: ONE, ...h.io });
+  assert.deepEqual(h.files, []);
+  assert.deepEqual(out.map((o) => o.kept), [true, true]);
+  assert.deepEqual(h.logs, ["  = talks/intro/g-de.pdf  (2 slides, kept)", "  = talks/intro/g-en.pdf  (2 slides, kept)"]);
+  assert.deepEqual(h.stamps, ["talks/intro"]);
 });
+
+test("one language is kept and the other written when only one file on disk matches", async () => {
+  const h = harness({ slides: 2 });
+  h.disk.set(onDisk("talks/intro/g-de.pdf"), pdfBytes(still(2)));
+  h.disk.set(onDisk("talks/intro/g-en.pdf"), pdfBytes([{ picture: "png", links: [] }, { picture: "old", links: [] }]));
+  const out = await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT, decks: ONE, ...h.io });
+  assert.deepEqual(out.map((o) => o.kept), [true, false]);
+  assert.deepEqual(h.files.map((f) => path.basename(f.file)), ["g-en.pdf"]);
+});
+
+test("a file with one changed link is written", async () => {
+  const links = [{ x: 0, y: 0, w: 10, h: 10, url: "https://companygraph.io/?lang=en" }];
+  const h = harness({ slides: 1, links });
+  for (const lang of ["de", "en"])
+    h.disk.set(onDisk(`talks/intro/g-${lang}.pdf`), pdfBytes(still(1, ["https://companygraph.io/old/"])));
+  const out = await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, PDFString: FakeString,
+                                  root: ROOT, decks: ONE, ...h.io });
+  assert.deepEqual(out.map((o) => o.kept), [false, false]);
+});
+
+test("a file with a different number of pages is written", async () => {
+  const h = harness({ slides: 2 });
+  for (const lang of ["de", "en"]) h.disk.set(onDisk(`talks/intro/g-${lang}.pdf`), pdfBytes(still(3)));
+  const out = await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT, decks: ONE, ...h.io });
+  assert.deepEqual(out.map((o) => o.kept), [false, false]);
+});
+
+test("a file on disk that cannot be read as a PDF is written again, and nothing throws", async () => {
+  const h = harness({ slides: 1 });
+  h.disk.set(onDisk("talks/intro/g-de.pdf"), Buffer.from("half a PDF, from a run that died"));
+  const out = await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT, decks: ONE, ...h.io });
+  assert.deepEqual(out.map((o) => o.kept), [false, false]);
+  assert.equal(h.files.length, 2);
+});
+
+test("the stamp is written after both of a deck's PDFs, once", async () => {
+  const h = harness({ slides: 1 });
+  await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT, decks: ONE, ...h.io });
+  assert.deepEqual(h.events, ["write:g-de.pdf", "write:g-en.pdf", "stamp:talks/intro"]);
+});
+
+test("a run that dies in its second deck has stamped the first and not the second", async () => {
+  // One slide a deck, so two shots a deck: the third shot is the second deck's first.
+  const h = harness({ slides: 1, failShot: 3 });
+  await assert.rejects(
+    exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
+                  decks: [{ dir: "talks/a", slug: "a" }, { dir: "talks/b", slug: "b" }], ...h.io }),
+    /the browser died/);
+  assert.deepEqual(h.stamps, ["talks/a"]);
+});
+
+test("pages are the same only when each holds the same picture and the same links in order", () => {
+  const a = [{ picture: "p1", links: ["x", "y"] }];
+  assert.equal(samePages(a, [{ picture: "p1", links: ["x", "y"] }]), true);
+  assert.equal(samePages(a, [{ picture: "p2", links: ["x", "y"] }]), false);
+  assert.equal(samePages(a, [{ picture: "p1", links: ["y", "x"] }]), false);
+  assert.equal(samePages(a, [{ picture: "p1", links: ["x"] }]), false);
+  assert.equal(samePages(a, [...a, ...a]), false);
+});
+
+test("a page whose picture could not be read is the same as nothing, itself included", () => {
+  const blank = [{ picture: null, links: [] }];
+  assert.equal(samePages(blank, blank), false);
+});
```

- [ ] **Step 3: Run them to see them fail**

Run: `node --test test/decks-export.test.mjs test/decks-pages.test.mjs`. Expected: FAIL. Both files import `samePages` or `pagesOf`, which `decks/export.mjs` does not export yet.

- [ ] **Step 4: The exporter**

Change `decks/export.mjs` as this difference from the file as Task 1 left it shows: `pagesOf`, `samePages` and `unchanged` above `validate`, three more parameters, and the end of the language loop.

```diff
@@ -32,14 +32,66 @@
 // than reimplemented, exactly as its own comment there already invites: the routing this run
 // depends on — a type served wrong, a path kept inside root — is a static-file server this
 // package already ships and already tests, not a second copy of one.
-import { writeFileSync } from "node:fs";
+import crypto from "node:crypto";
+import fs from "node:fs";
 import path from "node:path";
 import { serve } from "../cards/export.mjs";
-import { FRAME, LANGS, HIDE, SETTLE } from "./recipe.mjs";
+import { FRAME, LANGS, HIDE, SETTLE, pdfOf, stamp as stampDeck } from "./recipe.mjs";
 
 // The frame, the languages, the hide rule and the waits are recipe.mjs's, which hashes them.
 const W = FRAME.width, H = FRAME.height;
 
+const readIfThere = (file) => (fs.existsSync(file) ? fs.readFileSync(file) : null);
+
+// What each page of a deck PDF holds, read from a document pdf-lib has loaded: the picture, as a
+// digest of the bytes the PDF stores for it, and the links over it, each as the PDF writes it.
+// Nothing but the document is used, so no class of pdf-lib's is needed beside the PDFDocument a
+// caller already hands in: a dictionary is walked by its entries, and a name is compared as the
+// string it prints. A page whose picture cannot be found has `picture: null`, which samePages
+// never calls the same as anything, so a PDF some other tool made is written again rather than
+// kept on the strength of two empty digests.
+export function pagesOf(doc) {
+  const ctx = doc.context;
+  const named = (dict, name) => {
+    for (const [key, value] of dict.entries()) if (String(key) === "/" + name) return ctx.lookup(value);
+    return undefined;
+  };
+  return doc.getPages().map((page) => {
+    const resources = named(page.node, "Resources");
+    const xobjects = resources && named(resources, "XObject");
+    const h = crypto.createHash("sha256");
+    let pictures = 0;
+    for (const [, ref] of xobjects ? xobjects.entries() : []) {
+      const stream = ctx.lookup(ref);
+      if (!stream || !stream.contents) continue;
+      h.update(stream.contents);
+      pictures += 1;
+    }
+    const annots = named(page.node, "Annots");
+    return {
+      picture: pictures ? h.digest("hex") : null,
+      links: annots ? annots.asArray().map((ref) => String(ctx.lookup(ref)).replace(/\s+/g, " ")) : [],
+    };
+  });
+}
+
+// Exact, on purpose: a machine that rasterizes a slide differently writes the file again, which
+// costs a commit and misleads nobody. A looser comparison could keep a file that had changed.
+export function samePages(a, b) {
+  return a.length === b.length && a.every((p, i) =>
+    p.picture !== null && p.picture === b[i].picture &&
+    p.links.length === b[i].links.length && p.links.every((l, k) => l === b[i].links[k]));
+}
+
+// Is the PDF on disk, page for page, the one just rendered? A file that is not there, or that
+// cannot be read as a PDF — one a dead run left half written — is not, and is written again.
+async function unchanged(PDFDocument, had, bytes, readPages) {
+  if (had === null) return false;
+  let before;
+  try { before = readPages(await PDFDocument.load(had)); } catch (e) { return false; }
+  return samePages(before, readPages(await PDFDocument.load(bytes)));
+}
+
 // The vocabulary a deck may use. Borrowed from cards/export.mjs and for the same reason: an
 // unknown key is a knob that silently does nothing, and a deck list is edited by hand.
 const KNOWN = new Set(["dir", "slug"]);
@@ -71,7 +123,8 @@
 // may pass its base directly instead, but never a `file://` one: that is the one shape this
 // module used to open and no longer can, for the reason in the comment above the imports.
 export async function exportDecks({ chromium, PDFDocument, PDFString, root, decks, base,
-                                    log = console.log, write = writeFileSync }) {
+                                    log = console.log, write = fs.writeFileSync,
+                                    read = readIfThere, stamp = stampDeck, readPages = pagesOf }) {
   validate(decks);
   if (typeof base === "string" && base.startsWith("file://")) {
     throw new Error("exportDecks serves root over http itself now and no longer opens a " +
@@ -110,11 +163,25 @@
             p.drawImage(img, { x: 0, y: 0, width: W, height: H });
             for (const l of links) p.node.addAnnot(pdf.context.register(pdf.context.obj(annotation(l, PDFString))));
           }
-          const file = path.join(root, deck.dir, `${deck.slug}-${lang}.pdf`);
-          write(file, await pdf.save());
-          log(`  ✓ ${path.relative(root, file)}  (${count} slides)`);
-          written.push({ file, pages: count });
+          const file = path.join(root, pdfOf(deck, lang));
+          const bytes = await pdf.save();
+          // A PDF whose every page holds the picture and the links the file on disk already
+          // has is left alone: nearly every release of this package moves a file every deck
+          // links, and writing each PDF again would put megabytes into a site's history for a
+          // change most of them do not show.
+          const kept = await unchanged(PDFDocument, read(file), bytes, readPages);
+          if (kept) {
+            log(`  = ${path.relative(root, file)}  (${count} slides, kept)`);
+          } else {
+            write(file, bytes);
+            log(`  ✓ ${path.relative(root, file)}  (${count} slides)`);
+          }
+          written.push({ file, pages: count, kept });
         }
+        // After both languages are decided and never before: a run that dies half way leaves
+        // the deck reported stale. Written whether or not either file was, since the stamp says
+        // what the PDFs were checked against, not when they were written.
+        stamp(deck, root);
         await page.close();
       }
     } finally {
```

- [ ] **Step 5: Run the tests and the suite**

Run: `node --test test/decks-export.test.mjs test/decks-pages.test.mjs`. Expected: PASS.

Run: `npm test`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add decks/export.mjs test/decks-export.test.mjs test/decks-pages.test.mjs package.json package-lock.json
git commit --author "Implementer <implementer@blust.ch>" -F - <<'EOF'
The exporter leaves a PDF alone when its pages came out as they were

Nearly every release of this package moves a file every deck links, so every re-pin marks every deck stale, and writing each PDF again would put all of them into a site's history for a change most do not show. The exporter now reads the file on disk with the PDFDocument it is handed and compares it with what it rendered page by page, the picture as the PDF stores it and each link over it, and writes only a file that differs. It stamps the deck after both languages are decided, so a run that dies leaves the deck stale. Reading a page back depends on pdf-lib's own objects, so pdf-lib is a development dependency and one test file runs on real documents.

Verified: node --test test/decks-export.test.mjs test/decks-pages.test.mjs and npm test pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: <the model that wrote this commit> <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

Expected: the subject alone between the brackets.

### Task 4: A drawn picture is the same on every render

**Files:**

- Modify: `assets/chat.js` (`mermaidConfig`)
- Modify: `test/chat.test.mjs`
- Modify: `test/chat-diagram.test.mjs`

**Interfaces:**

- Consumes: nothing from the tasks before it.
- Produces: `mermaidConfig(read).handDrawnSeed === 1`. Task 3's comparison depends on it for a slide that holds a drawn picture.

- [ ] **Step 1: Write the failing tests**

In `test/chat.test.mjs`, after the test "Mermaid is configured strict, from the tokens, and never from an empty one", add:

```js
test("Mermaid draws from a fixed seed, so a picture is the same on every render", () => {
  // Left at Mermaid's default of 0, each render takes a random seed, and a picture holding a
  // rounded node or a cylinder came out a few pixels different every time it was drawn.
  assert.equal(mermaidConfig(() => "").handDrawnSeed, 1);
});
```

In `test/chat-diagram.test.mjs`, after the test "a picture is drawn under its answer, captioned, each node a link to where it lives", add:

```js
test("the same picture drawn in two tabs is the same markup", async () => {
  // A use case holds a rounded node, the shape Mermaid draws from its seed. A deck's PDF is kept
  // only when its slides come out as they were, so a picture that differed on every render
  // would have its deck's PDFs written again on every export.
  const drawn = [];
  for (let i = 0; i < 2; i++) {
    const { page } = await asked([["diagram", PICTURES.usecase], ["text", { text: "One use case." }]]);
    await page.waitForSelector(".rbchat-diagram svg");
    drawn.push(await page.$eval(".rbchat-diagram .rbchat-diagram-box", (box) => box.innerHTML));
    await page.close();
  }
  assert.equal(drawn[0], drawn[1]);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/chat.test.mjs test/chat-diagram.test.mjs`. Expected: FAIL in both new tests: `undefined !== 1`, and two markups that differ.

- [ ] **Step 3: The seed**

In `assets/chat.js`, in `mermaidConfig`, after the line that begins `startOnLoad: false, securityLevel: "strict"`, add:

```js
      // Mermaid draws a rounded node and a cylinder from a seed, and where this is left at its
      // default of 0 it takes a random one for each render, so the same picture came out a few
      // pixels different every time. A fixed seed makes a picture the same wherever and whenever
      // it is drawn, which a deck's PDF is compared by.
      handDrawnSeed: 1,
```

- [ ] **Step 4: Run the tests and the suite**

Run: `node --test test/chat.test.mjs test/chat-diagram.test.mjs`. Expected: PASS.

Run: `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/chat.js test/chat.test.mjs test/chat-diagram.test.mjs
git commit --author "Implementer <implementer@blust.ch>" -F - <<'EOF'
A drawn picture is the same on every render

Mermaid draws a rounded node and a cylinder from a seed and takes a random one where the configuration leaves it at 0, so a picture holding either came out a few pixels different every time it was drawn. Nobody could see it, but a deck's PDF is kept only when its slides come out as they were, and a slide that holds such a picture never did: measured on companygraph.io, the requirements deck's drawn slide differed in each of three exports and was the same in each once the seed was fixed. mermaidConfig sets the seed to 1.

Verified: node --test test/chat.test.mjs test/chat-diagram.test.mjs and npm test pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: <the model that wrote this commit> <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

Expected: the subject alone between the brackets.

### Task 5: The documents

**Files:**

- Modify: `README.md` (the table under "The card harness" and the paragraphs after it)
- Modify: `docs/design-system/decks.md` (the section "Export")

**Interfaces:**

- Consumes: the names Tasks 1 to 3 give. Produces nothing a task reads.

- [ ] **Step 1: README**

In the table under "The card harness", replace the `decks/export` row with these three:

```markdown
| `decks/export` | `exportDecks({ chromium, PDFDocument, root, decks })` — renders each deck to a 16:9 PDF fallback, leaves a PDF alone when every page of it came out as it was, and stamps the deck; takes a `chromium` and a `PDFDocument`, never imports either |
| `decks/recipe` | `sourcesOf`, `recipe`, `stampOf`, `state`, `stamp`, `pdfOf`, and the exporter's knobs, `FRAME`, `LANGS`, `HIDE` and `SETTLE`; `root` is always a parameter |
| `decks/check` | `checkDecks({ decks, root })` — a stamp that is missing or stale and a PDF that is not on disk; returns a count |
```

After the paragraph that begins "**`og:check` and `test:og` run after `npm ci`.**", add:

````markdown
**A deck's PDFs carry a stamp too.** `npm run pdf` writes `pdf.sha` beside each deck, the hash of the deck's page, every file of the repository the page names, `mermaid.min.js` where it names `chat.js`, the deck's entry and the exporter's own knobs, and `checkDecks` fails a deck whose stamp is not that hash. A site keeps its decks in one file, `decks.mjs`, which its `export-pdf.mjs` and its `pdf-check.mjs` both import, because a list kept twice is a deck added to one and not the other:

```js
// pdf-check.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkDecks } from "@robertblust/design/decks/check";
import { decks } from "./decks.mjs";

if (checkDecks({ decks, root: path.dirname(fileURLToPath(import.meta.url)) })) process.exit(1);
```

`pdf:check` runs where `og:check` does, after `npm ci` and before the browser is installed. The exporter compares each PDF it renders with the file on disk page by page and writes only one that differs, so a re-pin that moves a file every deck links commits the stamps and the PDFs that changed, not every PDF. The comparison is exact, and it holds for a slide with a drawn picture only because `chat.js` gives Mermaid a fixed seed.
````

- [ ] **Step 2: The design system's documents**

In `docs/design-system/decks.md`, at the end of the paragraph under "## Export", before "Source:", add:

```markdown
Each deck gets a stamp beside its PDFs, `pdf.sha`, the hash of what went into them, which a site's `pdf:check` reads without a browser; and a PDF whose every page came out as the file on disk already holds it is left as it is.
```

and change the paragraph's last sentence to:

```markdown
Source: [decks/export.mjs](../../decks/export.mjs), [decks/recipe.mjs](../../decks/recipe.mjs), [decks/check.mjs](../../decks/check.mjs).
```

- [ ] **Step 3: Check and commit**

Run: `sh conventions/conventions-format check && sh conventions/conventions-check && npm test`. Expected: PASS, all three.

```bash
git add README.md docs/design-system/decks.md
git commit --author "Implementer <implementer@blust.ch>" -F - <<'EOF'
The documents name the deck's stamp

The README's table names decks/recipe and decks/check and says what the exporter now does, with the one file a site keeps its decks in and the script that checks them, and the design system's page on decks says a deck's PDFs carry a stamp.

Verified: conventions-format check, conventions-check and npm test pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: <the model that wrote this commit> <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

Expected: the subject alone between the brackets.

## After this plan

The owner's: the pull request's merge, and the release, a minor (`version` in `package.json`, notes saying that `npm run pdf` now writes `pdf.sha` beside each deck and leaves an unchanged PDF alone, that `decks/check` is there for a site to call, that nothing breaks for a site that re-pins, and that `chat.js` moves, so a site draws its pictures again as after any release that moves it).

Then companygraph.io, in a pull request of its own that takes the release: `decks.mjs` at the root holding the list `export-pdf.mjs` holds today, imported by `export-pdf.mjs` and by a new `pdf-check.mjs` as the README shows; `"pdf:check": "node pdf-check.mjs"` in `package.json`; in `pins.json`, `npm run pdf` beside `npm run og` in each `after` list and `npm run pdf:check` in `verify`; a step in `.github/workflows/ci.yml` after `og:check`; a line in `AGENTS.md`'s build notes. Its first `npm run pdf` stamps every deck. With the seed in `chat.js`, every slide that holds a drawn picture is drawn anew once, so those decks' PDFs are written in that pull request and not again until they change.

blust.ch and guestgraph.io take it when the owner says.
