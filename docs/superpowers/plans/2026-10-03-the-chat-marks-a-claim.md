# The chat marks a claim its evidence does not carry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The widget reads the chat server's `verdict` event and, once an answer has finished, marks each claim its evidence does not carry and whose probability passes the deployment's threshold: a dotted underline, the panel's own tooltip box with a name and one line, and one line under the answer; the Terminal family gains `--t-part`, and the design system's pages change with it.

**Architecture:** `assets/chat.js` keeps the `verdict` event beside the answer, and `finish()` and the restore of a kept conversation call one `markClaims` after the names are linked: it finds each claim by its rendered text, wraps it text node by text node, and gives the first piece a note. The note is one element per panel drawn by the same rule as the header buttons' `::after` in `assets/chat.css`. `--t-part` joins `blocks/tokens.css`, whose fence moves to v16. The German words pass the German pipeline before the plan ends.

**Tech Stack:** Vanilla JS and CSS shipped as assets, `node --test`, Playwright Chromium against a local server, the family's conventions for German.

**Spec:** `docs/superpowers/specs/2026-10-03-the-chat-marks-a-claim-design.md` (this branch, #228).

## Global Constraints

- A claim is marked only where its verdict is `partial`, `contradicted`, `absent`, `unnamed`, `withheld` or `unsourced`, its `p` is a number at or above `threshold`, and `threshold` is a number. With `threshold` null, no `verdict` event, or an answer that ended in `error`, nothing changes.
- Marks are drawn in `finish()` after `nameLinks` and `linkQuestions`, never while the answer streams, and again when a kept conversation is restored, from the `verdict` kept on its turn.
- A claim is found by its rendered text; one that cannot be found is not marked.
- The note is the panel's own tooltip box, defined once in `chat.css` and shared with the header buttons' notes; it shows on hover and keyboard focus, never on a tap's focus, never where `(hover: none)`.
- `--t-part` is `#9A6A00` in light and `#E3B453` in dark, held to 3:1 against `--t-card`, and never used for text. The tokens fence moves from v15 to v16 in `versions.json` and the block's header together.
- Every German word passes the German pipeline of `conventions/WRITING.md`: translator, editor, back-reader.
- No release and no site re-sync in this plan: those are the owner's.
- Commits are prose in the git register, ending `Verified: …`, authored by the seat at `blust.ch` (Implementer for code and the English, Translator for the German), with `Process: Delivery`, `Phase: Implement`, the `Track` and the `Co-Authored-By` line.
- Before any `node`, `npm` or `gh`: `export PATH="/opt/homebrew/bin:$PATH"`. Run `npm ci` once in the worktree.

## Rulings this plan makes

- The spec says the box is defined once; the header's rule already holds it, so `.rbchat-note` joins that rule's selector list and a short rule after it lets the note wrap and be placed by the script. `test/chat.test.mjs` pins the header rule's selector and is widened to accept the list.
- The widget's German strings carry `Teilweise`, which the spelling test reads as a British `-ise`; it joins the allow list with a comment saying it is German. If the German pipeline replaces the word, the entry goes with it.
- The plan's code was written and run before the plan, in a scratch copy of this repository at `4ae1a6b`: `npm test` passed 914 of 914 with it.

## Review Focus

- An answer whose claims run through links and code spans the widget made after rendering: each piece is marked, the note hangs under the first. Task 2 tests a code span; `nameLinks` makes links the same way.
- A restored conversation on another page: the marks come back from the kept turn without a new request. Task 2 tests it.
- A German page with an English answer that a threshold covers: the note and the line are German. Task 2 tests the German page.
- A phone: no note opens on a tap, and the line under the answer stands. Task 2 tests a tap.
- A site still on tokens v15 that takes the new `chat.css`: `--t-part` is undefined there, so a partly backed claim's underline falls back to the text color. The sites take the tokens fence and the chat group together at a re-sync, and the release notes say so.

---

### Task 1: The Terminal family's amber, --t-part

**Files:**

- Modify: `blocks/tokens.css`, `versions.json`, `docs/design-system/tokens.md`
- Test: `test/theme.test.mjs`

**Interfaces:**

- Produces `--t-part` in both halves of the tokens block, and the tokens fence at v16.

- [ ] **Step 1: Write the failing test**

Apply to `test/theme.test.mjs` (`git apply` takes it as written):

````diff
diff --git a/test/theme.test.mjs b/test/theme.test.mjs
index 2be48e7..a92482a 100644
--- a/test/theme.test.mjs
+++ b/test/theme.test.mjs
@@ -667,6 +667,18 @@ test("--warn clears AA against its own ground, in both themes", () => {
   }
 });
 
+test("--t-part, a partly backed claim's underline, holds 3:1 against the answer's ground in both themes", () => {
+  // A mark and never text, so it is held to the 3:1 of a non-text contrast against --t-card,
+  // the answer's ground in the chat, and is defined in both halves.
+  const css = deckCss();
+  for (const [name, sel] of [["dark", ":root"], ["light", ':root\\[data-theme="light"\\]']]) {
+    const p = palette(css, sel);
+    assert.ok(p["t-part"], `${name}: no --t-part`);
+    const r = ratio(p["t-part"], p["t-card"]);
+    assert.ok(r >= 3, `${name}: --t-part is ${r.toFixed(2)}:1 on --t-card, needs 3`);
+  }
+});
+
 test("--lcd reads as a recess, not a merge — darker than --slab by a stated margin, in both themes", () => {
   // The transport's whole metaphor depends on the readout being unambiguously the darker of
   // the two surfaces it's nested in. Dark's own pair is both near-black (~1.11:1) — the recess
````

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/theme.test.mjs`

Expected: FAIL: `dark: no --t-part`.

- [ ] **Step 3: Write the code**

Apply to `blocks/tokens.css` (`git apply` takes it as written):

````diff
diff --git a/blocks/tokens.css b/blocks/tokens.css
index f2f927c..9dc1bfd 100644
--- a/blocks/tokens.css
+++ b/blocks/tokens.css
@@ -1,4 +1,4 @@
-  /* ─── design tokens · v15 · {{variant}} ───────────────────────────────
+  /* ─── design tokens · v16 · {{variant}} ───────────────────────────────
      These sites share no stylesheet by design — a deck has to open from
      file:// — so this block is a copy, generated from @robertblust/design.
      Editing it here has no effect: the next `npm run design` overwrites it
@@ -61,7 +61,7 @@
        is deck-only chrome that must not be left for a page to restate. */
     --slab:#EDEAE2; --warn:#BC3924;
     /* The terminal's light colors, the pair of the dark ones below. */
-    --t-card:#F3F1EB; --t-bg:#FDFCF9; --t-top:#EFECE5; --t-dot:#D6D1C6; --t-ink:#1D232C; --t-dim:#676152; --t-accent:#3A6DA6; --t-strong:#0C0E13; --t-good:#2E7A45; --t-bad:#B3412E; --t-line:#E3DFD6; --t-sel:#E7ECF4; --t-edge:#CFC9BC;
+    --t-card:#F3F1EB; --t-bg:#FDFCF9; --t-top:#EFECE5; --t-dot:#D6D1C6; --t-ink:#1D232C; --t-dim:#676152; --t-accent:#3A6DA6; --t-strong:#0C0E13; --t-good:#2E7A45; --t-part:#9A6A00; --t-bad:#B3412E; --t-line:#E3DFD6; --t-sel:#E7ECF4; --t-edge:#CFC9BC;
   }
   :root{
     --ground:#0C0E13; --raise:#171A21; --rule:#232833;
@@ -91,5 +91,5 @@
     --slab:#16181d; --warn:#e0705e;
     /* The terminal's own colors, which the chat panel and the one modal read: a terminal is
        not a page surface, so these are not the page's tokens but a set of their own. */
-    --t-card:#141D29; --t-bg:#0E141C; --t-top:#161E29; --t-dot:#2B3645; --t-ink:#D5DCE6; --t-dim:#8793A3; --t-accent:#7FA3D8; --t-strong:#FFFFFF; --t-good:#86C79A; --t-bad:#E0705E; --t-line:#243041; --t-sel:#18263A; --t-edge:#2B3645;
+    --t-card:#141D29; --t-bg:#0E141C; --t-top:#161E29; --t-dot:#2B3645; --t-ink:#D5DCE6; --t-dim:#8793A3; --t-accent:#7FA3D8; --t-strong:#FFFFFF; --t-good:#86C79A; --t-part:#E3B453; --t-bad:#E0705E; --t-line:#243041; --t-sel:#18263A; --t-edge:#2B3645;
   /* ─── end design tokens ─────────────────────────────────────────────── */
````

Apply to `versions.json` (`git apply` takes it as written):

````diff
diff --git a/versions.json b/versions.json
index 96f1312..82f2781 100644
--- a/versions.json
+++ b/versions.json
@@ -1,5 +1,5 @@
 {
-  "tokens": "v15",
+  "tokens": "v16",
   "header": "v17",
   "stage": "v2",
   "title": "v2",
````

Apply to `docs/design-system/tokens.md` (`git apply` takes it as written):

````diff
diff --git a/docs/design-system/tokens.md b/docs/design-system/tokens.md
index 5219cc2..2eadbec 100644
--- a/docs/design-system/tokens.md
+++ b/docs/design-system/tokens.md
@@ -40,6 +40,8 @@ Every other token is a surface, not a meaning, and belongs to one family.
 
 A page reads the page family and never defines a token of its own; the modal re-points the page family at the terminal's, so whatever it holds draws in the terminal's colors.
 
+In the terminal family `--t-good` and `--t-bad` say an answer's state, and `--t-part`, between them, underlines a claim of an answer that its evidence carries only in part. It is a mark and never text, so it is held to 3:1 against `--t-card`, the answer's ground; every other claim the evidence does not carry is underlined in `--t-bad`.
+
 ## Faces
 
 Three faces, each with one job, self-hosted from the [fonts](assets.md#fonts) group. The [prose reset](blocks.md#prose-reset) sets Instrument Sans and Plex Mono on a prose page, each block that marks a section sets Bricolage Grotesque, and a deck's lockup and transport set their own.
````

- [ ] **Step 4: Run it to see it pass**

Run: `node --test test/theme.test.mjs`

Expected: PASS; then `node --test test/fences.test.mjs test/design-system-docs.test.mjs` passes.

- [ ] **Step 5: Commit**

```bash
git add blocks/tokens.css versions.json docs/design-system/tokens.md test/theme.test.mjs
git commit --author "Implementer <implementer@blust.ch>" -F - <<'EOF'
The Terminal family has an amber for a partly backed claim

A claim the evidence carries only in part is marked in amber, between the terminal's green and red, so the tokens block gains --t-part: #9A6A00 in light and #E3B453 in dark, 4.19:1 and 8.82:1 against --t-card, where a mark needs 3:1. It is never text. The tokens fence moves to v16, and the design system's Token families section says what the token is for.

Verified: node --test test/theme.test.mjs, test/fences.test.mjs and test/design-system-docs.test.mjs pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: <the model that wrote this commit>
EOF
git log -1 --format='[%s]'
```

---

### Task 2: The marks, the note and the line

**Files:**

- Modify: `assets/chat.js`, `assets/chat.css`, `test/chat.test.mjs`, `test/spelling.test.mjs`
- Test: `test/chat-claims.test.mjs`

**Interfaces:**

- Consumes `--t-part` (Task 1). Produces `markClaims(root, text, verdict, lang)` and `claimLine(n)` inside `chat.js`, the classes `rbchat-claim part|off`, `rbchat-note` and `rbchat-claims`, the `STRINGS` entries `claim`, `claimsOne` and `claimsMany` in both languages (the German a draft until Task 3), and `verdict` kept on an assistant turn.

- [ ] **Step 1: Write the failing test**

Create `test/chat-claims.test.mjs`:

````js
// The answer check in Chromium: a `verdict` event with a threshold marks the claims it does not
// carry once the answer has finished, with the panel's own note and one line under the answer;
// with no threshold, or no event, the answer is as it always was.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { TERMINAL } from "./fixtures/terminal.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const asset = (f) => fs.readFileSync(path.join(PKG, "assets", f));
const page = (lang) => `<!doctype html><html lang="${lang}" data-theme="dark"><head><meta charset="utf-8">
<style>${TERMINAL}</style><link rel="stylesheet" href="/chat.css"></head><body><p>A page.</p>
<script src="/chat.js" data-chat="/chat" data-model="/model/" data-questions="/model.json" defer></script></body></html>`;
const MODEL = JSON.stringify({ entities: [], edges: [] });
const sse = (events) => events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");

// One answer of three claims: a supported one, a partial one that runs through a code span, and
// a contradicted one. The offsets count the Markdown, as the server's do.
const TEXT = "Experience is one dated period. It holds a `start` date and a title only. A writing rule is a numbered convention.";
const at = (s) => [TEXT.indexOf(s), TEXT.indexOf(s) + s.length];
const claim = (s, verdict, p) => { const [from, to] = at(s); return { from, to, ids: [], verdict, p }; };
const CLAIMS = [claim("Experience is one dated period.", "supported", 0.99), claim("It holds a `start` date and a title only.", "partial", 0.9), claim("A writing rule is a numbered convention.", "contradicted", 0.85)];
let stream = [];
const answer = (verdict) => [["text", { text: TEXT }], ...(verdict ? [["verdict", verdict]] : []), ["done", { model: null, spent: 1, dayLeft: 1 }]];

let server, base, browser;
before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (req.method === "POST" && url === "/chat") { req.resume(); req.on("end", () => { res.writeHead(200, { "content-type": "text/event-stream" }); res.end(sse(stream)); }); return; }
    const files = { "/en/": ["text/html", page("en")], "/de/": ["text/html", page("de")], "/model.json": ["application/json", MODEL], "/chat.js": ["text/javascript", asset("chat.js")], "/chat.css": ["text/css", asset("chat.css")] };
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": hit[0], "cache-control": "no-store" }); res.end(hit[1]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

async function asked(path, events, { hover = true } = {}) {
  stream = events;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: !hover });
  const p = await context.newPage();
  await p.goto(base + path);
  await p.click(".rbchat-open");
  await p.fill(".rbchat-form textarea", "What does experience hold?");
  await p.press(".rbchat-form textarea", "Enter");
  await p.waitForSelector(".rbchat-assistant .rbchat-done");
  return { p, context };
}
const marks = (p) => p.$$eval(".rbchat-assistant .rbchat-claim", (m) => m.map((x) => [x.className.replace("rbchat-claim", "").trim(), x.textContent]));

test("a threshold marks the claims it does not carry, each piece of one that runs through code, and says how many", async () => {
  const { p, context } = await asked("/en/", answer({ claims: CLAIMS, threshold: 0.8 }));
  assert.deepEqual(await marks(p), [["part", "It holds a "], ["part", "start"], ["part", " date and a title only."], ["off", "A writing rule is a numbered convention."]]);
  assert.equal(await p.$eval(".rbchat-claims", (e) => e.textContent), "2 statements here aren't fully backed by the model's pages.");
  await context.close();
});

test("a claim under the threshold, a supported one, and one outside the answer's text are not marked", async () => {
  const outside = { from: TEXT.length + 5, to: TEXT.length + 40, ids: [], verdict: "absent", p: 0.95 };
  const { p, context } = await asked("/en/", answer({ claims: [{ ...CLAIMS[1], p: 0.5 }, CLAIMS[0], outside], threshold: 0.8 }));
  assert.deepEqual(await marks(p), []);
  assert.equal(await p.$(".rbchat-claims"), null);
  await context.close();
});

test("with no threshold, or no verdict, the answer is drawn as it always was", async () => {
  for (const events of [answer({ claims: CLAIMS, threshold: null }), answer(null)]) {
    const { p, context } = await asked("/en/", events);
    assert.deepEqual(await marks(p), []);
    assert.equal(await p.$(".rbchat-claims"), null);
    await context.close();
  }
});

test("hover and keyboard focus show the panel's note with the verdict's name and line, Escape closes it, and a tap does not open it", async () => {
  const { p, context } = await asked("/en/", answer({ claims: CLAIMS, threshold: 0.8 }));
  await p.hover(".rbchat-claim.off");
  await p.waitForSelector(".rbchat-note.show");
  assert.equal(await p.$eval(".rbchat-note", (e) => e.textContent), "Contradicted The model's pages say otherwise.");
  await p.mouse.move(0, 0);
  await p.waitForSelector(".rbchat-note.show", { state: "detached" }).catch(() => {});
  assert.equal(await p.$(".rbchat-note.show"), null);
  await p.focus(".rbchat-form textarea");
  await p.keyboard.press("Shift+Tab");
  for (let i = 0; i < 40 && !(await p.evaluate(() => document.activeElement?.classList.contains("rbchat-claim"))); i++) await p.keyboard.press("Shift+Tab");
  await p.waitForSelector(".rbchat-note.show");
  assert.match(await p.$eval(".rbchat-note", (e) => e.textContent), /^(Partly backed|Contradicted) /);
  await p.keyboard.press("Escape");
  assert.equal(await p.$(".rbchat-note.show"), null);
  await context.close();
  const touch = await asked("/en/", answer({ claims: CLAIMS, threshold: 0.8 }), { hover: false });
  await touch.p.tap(".rbchat-claim.off");
  await touch.p.waitForTimeout(200);
  assert.equal(await touch.p.$(".rbchat-note.show"), null);
  await touch.context.close();
});

test("on a German page the note and the line are German", async () => {
  const { p, context } = await asked("/de/", answer({ claims: CLAIMS, threshold: 0.8 }));
  await p.hover(".rbchat-claim.off");
  await p.waitForSelector(".rbchat-note.show");
  assert.doesNotMatch(await p.$eval(".rbchat-note", (e) => e.textContent), /model's pages/);
  assert.doesNotMatch(await p.$eval(".rbchat-claims", (e) => e.textContent), /statement/);
  await context.close();
});

test("an answer that ended in an error is never marked", async () => {
  const { p, context } = await asked("/en/", [["text", { text: TEXT }], ["verdict", { claims: CLAIMS, threshold: 0.8 }], ["error", { error: { code: "host_down", message: "down" } }]]);
  assert.deepEqual(await marks(p), []);
  assert.equal(await p.$(".rbchat-claims"), null);
  await context.close();
});

test("a restored conversation marks its answer again", async () => {
  const { p, context } = await asked("/en/", answer({ claims: CLAIMS, threshold: 0.8 }));
  await p.reload();
  await p.waitForSelector(".rbchat-assistant .rbchat-body");
  assert.equal((await marks(p)).length, 4);
  assert.ok(await p.$(".rbchat-claims"));
  await context.close();
});
````

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/chat-claims.test.mjs`

Expected: FAIL on the four tests that expect marks, a note or German; the three that expect nothing to change pass on the old code, as negative tests should.

- [ ] **Step 3: Write the code**

Apply to `assets/chat.js` (`git apply` takes it as written):

````diff
diff --git a/assets/chat.js b/assets/chat.js
index 4a7c5b3..7f17cd4 100644
--- a/assets/chat.js
+++ b/assets/chat.js
@@ -108,6 +108,8 @@
       sub: "chat · {host}", bar: "ask · {host}",
       prompt: "Type a question, a number, or /help",
       asking: "asking the model", answered: "answered", model: "model {sha} · {secs}s",
+      claim: { partial: ["Partly backed", "The model's pages say only part of this."], contradicted: ["Contradicted", "The model's pages say otherwise."], absent: ["Not backed", "The model's pages don't say this."], unsourced: ["Not backed", "No page the chat read says this."] },
+      claimsOne: "1 statement here isn't fully backed by the model's pages.", claimsMany: "{n} statements here aren't fully backed by the model's pages.",
       keys: { send: "enter send", last: "↑ last question", pick: "{range} pick", help: "/help" },
       help: [["/new", "start a new conversation (also /clear)"], ["/help", "this list"], ["{range}", "pick from the menu above"], ["↑", "your last question back into the line"]],
       tryLabel: "Try", askNext: "Ask next",
@@ -153,6 +155,8 @@
       sub: "Chat · {host}", bar: "fragen · {host}",
       prompt: "Frage, Nummer oder /help tippen",
       asking: "frage das Modell", answered: "beantwortet", model: "Modell {sha} · {secs}s",
+      claim: { partial: ["Teilweise belegt", "Die Seiten des Modells belegen nur einen Teil davon."], contradicted: ["Widersprochen", "Die Seiten des Modells sagen etwas anderes."], absent: ["Nicht belegt", "Die Seiten des Modells sagen das nicht."], unsourced: ["Nicht belegt", "Keine Seite, die der Chat gelesen hat, sagt das."] },
+      claimsOne: "1 Aussage hier ist durch die Seiten des Modells nicht ganz belegt.", claimsMany: "{n} Aussagen hier sind durch die Seiten des Modells nicht ganz belegt.",
       keys: { send: "Enter senden", last: "↑ letzte Frage", pick: "{range} wählen", help: "/help" },
       help: [["/new", "ein neues Gespräch beginnen (auch /clear)"], ["/help", "diese Liste"], ["{range}", "aus dem Menü darüber wählen"], ["↑", "Ihre letzte Frage zurück in die Zeile"]],
       tryLabel: "Probieren Sie", askNext: "Fragen Sie weiter",
@@ -1534,6 +1538,80 @@
   }
   // An answer's head and commit lines, written from the strings, and written again by relabel()
   // when the language switches; a restored answer has no timing, so its line names the commit alone.
+  // ─── The answer check ─────────────────────────────────────────────────────────────────────
+  // A deployment that checks its answers sends a `verdict` before `done`: each claim's place in
+  // the answer's Markdown, its verdict and that verdict's probability, and the probability above
+  // which a claim is to be marked, null where none is measured. A claim the evidence does not
+  // carry is marked once the answer is drawn, found by its rendered text, since the offsets count
+  // Markdown the body no longer shows; one that cannot be found is not marked at all, since a
+  // mark on the wrong sentence is worse than none. A claim that runs through a code span or a
+  // link is marked in each of its pieces.
+  var MARKED = { partial: "part", contradicted: "off", absent: "off", unnamed: "off", withheld: "off", unsourced: "off" };
+  var NOTE_OF = { partial: "partial", contradicted: "contradicted", absent: "absent", unnamed: "absent", withheld: "absent", unsourced: "unsourced" };
+  function plainOf(s){ return s.replace(/`/g, "").replace(/\*\*|__/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim(); }
+  function textOf(root){
+    var walk = root.ownerDocument.createTreeWalker(root, 4), n, str = "", map = [], space = true;
+    while ((n = walk.nextNode())) for (var i = 0; i < n.data.length; i++) {
+      var ch = n.data.charAt(i), sp = /\s/.test(ch);
+      if (sp && space) continue;
+      str += sp ? " " : ch; map.push([n, i]); space = sp;
+    }
+    return { str: str, map: map };
+  }
+  function markClaims(root, text, verdict, lang){
+    if (!verdict || !Array.isArray(verdict.claims) || typeof verdict.threshold !== "number") return 0;
+    var s = strings(lang), count = 0, from = 0;
+    verdict.claims.forEach(function(c){
+      var kind = MARKED[c.verdict];
+      if (!kind || typeof c.p !== "number" || c.p < verdict.threshold || typeof c.from !== "number" || typeof c.to !== "number") return;
+      var want = plainOf(text.slice(c.from, c.to)), t = textOf(root), at = want ? t.str.indexOf(want, from) : -1;
+      if (at < 0) return;
+      var pieces = [], i = at, end = at + want.length;
+      while (i < end) {
+        var node = t.map[i][0], j = i;
+        while (j + 1 < end && t.map[j + 1][0] === node) j++;
+        var r = root.ownerDocument.createRange(); r.setStart(node, t.map[i][1]); r.setEnd(node, t.map[j][1] + 1);
+        var span = root.ownerDocument.createElement("span"); span.className = "rbchat-claim " + kind;
+        try { r.surroundContents(span); pieces.push(span); } catch (e) {}
+        i = j + 1;
+      }
+      if (!pieces.length) return;
+      noted(pieces, s.claim[NOTE_OF[c.verdict]]);
+      from = at + want.length; count++;
+    });
+    return count;
+  }
+  function claimLine(n){ var s = strings(langNow()); return el("p", "rbchat-claims", n === 1 ? s.claimsOne : s.claimsMany.replace("{n}", n)); }
+  // The note is the panel's own, the box chat.css draws under the header's buttons: one element
+  // for the panel, hung under the claim's first line and kept within the panel's sides. It shows
+  // on hover and on keyboard focus, never on a tap's focus, and not where there is no hover.
+  var note = null;
+  function noted(pieces, words){
+    pieces[0].tabIndex = 0;
+    pieces[0].setAttribute("aria-describedby", "rbchat-note");
+    function show(keyed){
+      if (!keyed && window.matchMedia && window.matchMedia("(hover: none)").matches) return;
+      pieces.forEach(function(q){ q.classList.add("on"); });
+      if (!note) { note = el("div", "rbchat-note"); note.id = "rbchat-note"; note.setAttribute("role", "tooltip"); note.appendChild(el("b", "n")); note.appendChild(document.createTextNode(" ")); note.appendChild(el("span", "d")); }
+      var home = pieces[0].closest(".rbchat") || document.body;
+      if (note.parentNode !== home) home.appendChild(note);
+      note.firstChild.textContent = words[0]; note.lastChild.textContent = words[1];
+      var r = pieces[0].getBoundingClientRect(), box = home.getBoundingClientRect();
+      note.style.left = "0px"; note.classList.add("show");
+      var x = Math.max(box.left + 8, Math.min(r.left, box.right - note.offsetWidth - 8));
+      note.style.left = (x - box.left) + "px"; note.style.top = (r.bottom - box.top + 7) + "px";
+    }
+    function hide(){ pieces.forEach(function(q){ q.classList.remove("on"); }); if (note) note.classList.remove("show"); }
+    pieces.forEach(function(q){
+      q.addEventListener("mouseenter", function(){ show(false); });
+      q.addEventListener("mouseleave", hide);
+    });
+    pieces[0].addEventListener("focus", function(){ var keyed = true; try { keyed = pieces[0].matches(":focus-visible"); } catch (e) {} if (keyed) show(true); });
+    pieces[0].addEventListener("blur", hide);
+  }
+  document.addEventListener("keydown", function(e){ if (e.key === "Escape" && note) note.classList.remove("show"); });
+  document.addEventListener("scroll", function(){ if (note) note.classList.remove("show"); }, true);
+
   function doneLine(){ var h = el("p", "rbchat-done"); h.appendChild(el("span", "rbchat-tick", "\u2713")); h.appendChild(document.createTextNode(" " + strings(langNow()).answered)); return h; }
   function modelText(sha, secs){ var m = strings(langNow()).model; return (secs ? m.replace("{secs}", secs) : m.replace(/ \u00b7 \{secs\}s$/, "")).replace("{sha}", sha); }
   function modelLine(sha, secs){ var l = el("p", "rbchat-model", modelText(sha, secs)); l.setAttribute("data-sha", sha); if (secs) l.setAttribute("data-secs", secs); return l; }
@@ -1946,7 +2024,7 @@
     log.appendChild(wait); log.scrollTop = log.scrollHeight;
     var spin = setInterval(function(){ frame.textContent = "|/-\\"[Math.floor((Date.now() - t0) / 90) % 4]; secs.textContent = seconds(Date.now() - t0); }, 90);
     ans.appendChild(body);
-    var acc = "", cites = [], names = [], cut = false, picture = null, fig = null;
+    var acc = "", cites = [], names = [], cut = false, picture = null, fig = null, verdict = null, errored = false;
     function render(){ body.innerHTML = md(acc); numberColumns(body); }
     function stopSpin(){ clearInterval(spin); if (wait.parentNode) wait.parentNode.removeChild(wait); }
     // A stream that never ends — a dropped connection the browser does not notice — would
@@ -1987,6 +2065,8 @@
       // An earlier turn's names are linked too, which a follow-up that called no tool needs.
       nameLinks(body, names.concat(cites, heard(turns)), MODEL, document);
       linkQuestions(body);
+      var marked = markClaims(body, acc, errored ? null : verdict, langNow());
+      if (marked) ans.appendChild(claimLine(marked));
       if (cites.length) ans.appendChild(citeLine(cites, MODEL, ICON, document));
       var sha = commitOf(cites);
       if (sha) ans.appendChild(modelLine(sha, String(Math.max(1, Math.round((Date.now() - t0) / 1000)))));
@@ -1996,7 +2076,7 @@
       setTimeout(function(){ if (say) say.textContent = said; }, 60);
       stopRequest = null;
       messages.push({ role: "assistant", content: acc });
-      turns.push({ role: "assistant", content: acc, cites: cites, names: names, diagram: picture });
+      turns.push({ role: "assistant", content: acc, cites: cites, names: names, diagram: picture, verdict: errored ? null : verdict });
       ans.setAttribute("data-turn", turns.length - 1);
       keep();
       busy = false;
@@ -2027,6 +2107,7 @@
             // It is drawn in finish(), with the rest of the answer.
             picture = data;
           }
+          else if (name === "verdict" && data && Array.isArray(data.claims)) verdict = data;
           else if (name === "done") cut = !!data.cut;
           else if (name === "error") {
             var code = data && data.error && data.error.code, at = data && data.error && data.error.retryAt;
@@ -2038,6 +2119,9 @@
               refuse(code || "internal", at);
               return;
             }
+            // An answer cut short by an error is not marked: the check spoke of an answer that
+            // did not finish as it was checked.
+            errored = true;
             acc += "\n\n" + refusalText(code, at, Date.now(), langNow());
           }
         }).then(function(){ if (gen === reqGen && busy) finish(); });
@@ -2082,12 +2166,14 @@
       nameLinks(body, (t.names || []).concat(cites, heard(turns)), MODEL, document);
       linkQuestions(body);
       if (diagram) ans.appendChild(figure(diagram));
+      var restored = markClaims(body, t.content, t.verdict || null, langNow());
+      if (restored) ans.appendChild(claimLine(restored));
       if (cites.length) ans.appendChild(citeLine(cites, MODEL, ICON, document));
       // A restored answer has no timing to name, so its line names the commit alone.
       var sha = commitOf(cites);
       if (sha) ans.appendChild(modelLine(sha, null));
       messages.push({ role: "assistant", content: t.content });
-      turns.push({ role: "assistant", content: t.content, cites: cites, names: t.names || [], diagram: diagram });
+      turns.push({ role: "assistant", content: t.content, cites: cites, names: t.names || [], diagram: diagram, verdict: t.verdict || null });
     });
     // The rows the last answer offered, drawn now with the rest: read again from the model file
     // they would stand a moment after the page shows, push the log up, and differ on every page.
````

Apply to `assets/chat.css` (`git apply` takes it as written):

````diff
diff --git a/assets/chat.css b/assets/chat.css
index 54d884d..84e6f90 100644
--- a/assets/chat.css
+++ b/assets/chat.css
@@ -62,13 +62,25 @@ html[data-chat-waiting]::after{content:"ask \00b7  " attr(data-chat-waiting);pos
    left of its button, since the panel clips above its header and the buttons sit at its right
    edge. It shows on hover and on keyboard focus, never on a tap's focus. */
 .rbchat-new,.rbchat-close{position:relative}
-.rbchat-new[data-tip]::after,.rbchat-close[data-tip]::after{content:attr(data-tip);position:absolute;top:calc(100% + .45rem);right:0;z-index:3;
+.rbchat-new[data-tip]::after,.rbchat-close[data-tip]::after,.rbchat-note{content:attr(data-tip);position:absolute;top:calc(100% + .45rem);right:0;z-index:3;
   white-space:nowrap;pointer-events:none;opacity:0;transform:translateY(-2px);transition:opacity .12s ease,transform .12s ease;
   background:var(--raise);border:1px solid var(--rule);border-radius:6px;padding:.42rem .62rem;
   box-shadow:0 6px 18px var(--deck-drop);font-family:inherit;font-size:.8rem;font-weight:400;line-height:1.35;letter-spacing:0;color:var(--ink)}
 .rbchat-new:hover::after,.rbchat-new:focus-visible::after,.rbchat-close:hover::after,.rbchat-close:focus-visible::after{opacity:1;transform:none}
 @media (hover:none){.rbchat-new[data-tip]::after,.rbchat-close[data-tip]::after{display:none}}
-@media (prefers-reduced-motion:reduce){.rbchat-new[data-tip]::after,.rbchat-close[data-tip]::after{transition:none}}
+@media (prefers-reduced-motion:reduce){.rbchat-new[data-tip]::after,.rbchat-close[data-tip]::after,.rbchat-note{transition:none}}
+/* The same box as a claim's note: one element, placed by chat.js under the claim it describes,
+   in the panel, so it wraps where the header's note keeps one line. */
+.rbchat-note{right:auto;white-space:normal;max-width:min(20rem,calc(100% - 1.5rem))}
+.rbchat-note.show{opacity:1;transform:none}
+.rbchat-note .n{font-weight:600}
+/* A claim the evidence does not carry: a dotted underline, tinted while it is hovered or focused.
+   --t-part is a partly backed claim's and never text's; every other mark is --t-bad. */
+.rbchat-claim{text-decoration:underline dotted 1.5px;text-underline-offset:3px;cursor:help;border-radius:2px}
+.rbchat-claim.part{text-decoration-color:var(--t-part)}.rbchat-claim.off{text-decoration-color:var(--t-bad)}
+.rbchat-claim.part.on{background:color-mix(in srgb,var(--t-part) 14%,transparent)}.rbchat-claim.off.on{background:color-mix(in srgb,var(--t-bad) 14%,transparent)}
+.rbchat-claim:focus-visible{outline:1px solid var(--t-accent);outline-offset:1px}
+.rbchat-claims{margin:.45rem 0 0;padding-top:.4rem;border-top:1px dashed var(--t-line);font-size:.74rem;color:var(--t-dim)}
 .rbchat-notice code{font-family:"Plex Mono",ui-monospace,Menlo,monospace;font-size:.95em;color:var(--ink)}
 .rbchat-log{flex:1;overflow-y:auto;padding:1rem 1.1rem .5rem;display:flex;flex-direction:column;gap:.15rem}
 .rbchat-msg{overflow-wrap:anywhere}
````

Apply to `test/chat.test.mjs` (`git apply` takes it as written):

````diff
diff --git a/test/chat.test.mjs b/test/chat.test.mjs
index cb704d2..7277b89 100644
--- a/test/chat.test.mjs
+++ b/test/chat.test.mjs
@@ -629,7 +629,7 @@ test("the new-conversation control is an arrow come back round with a note, not
   assert.match(src, /newBtn\.setAttribute\("aria-label", s\.fresh\); newBtn\.setAttribute\("data-tip", s\.fresh\);/, "the button's note does not follow the language");
   assert.match(src, /closeBtn\.setAttribute\("data-tip", s\.modalClose\)/, "the close cross has no note");
   const css = fs.readFileSync(path.join(PKG, "assets", "chat.css"), "utf8");
-  assert.match(css, /\.rbchat-new\[data-tip\]::after,\.rbchat-close\[data-tip\]::after\{content:attr\(data-tip\)/, "the note is not drawn");
+  assert.match(css, /\.rbchat-new\[data-tip\]::after,\.rbchat-close\[data-tip\]::after(,\.rbchat-note)?\{content:attr\(data-tip\)/, "the note is not drawn");
   assert.match(css, /\.rbchat-new:focus-visible::after/, "the note does not show on keyboard focus");
 });
 
````

Apply to `test/spelling.test.mjs` (`git apply` takes it as written):

````diff
diff --git a/test/spelling.test.mjs b/test/spelling.test.mjs
index 5e8d3b7..6e9b3bb 100644
--- a/test/spelling.test.mjs
+++ b/test/spelling.test.mjs
@@ -38,6 +38,8 @@ const ALLOW = new Set([
   "paradise", "unwise", "sunrise", "moonrise", "user", "users", "browser", "browsers", "parser",
   "parsers", "loser", "closer", "chooser", "eraser", "geyser", "laser", "lasers", "miser", "poser",
   "teaser", "visor", "denoiser", "analysis", "analyses", "hydrolysis",
+  // German the widget's STRINGS carry, which only looks like a British -ise
+  "teilweise",
   // -our that is American
   "our", "ours", "hour", "hours", "four", "fours", "your", "yours", "tour", "tours", "pour", "poured",
   "pouring", "sour", "flour", "scour", "dour", "detour", "contour", "contours", "velour", "devour",
````

- [ ] **Step 4: Run it to see it pass**

Run: `node --test test/chat-claims.test.mjs`

Expected: PASS, 7 tests; then `npm test`, the whole suite, passes.

- [ ] **Step 5: Commit**

```bash
git add assets/chat.js assets/chat.css test/chat-claims.test.mjs test/chat.test.mjs test/spelling.test.mjs
git commit --author "Implementer <implementer@blust.ch>" -F - <<'EOF'
The chat marks a claim its evidence does not carry

The widget now keeps the verdict event beside the answer and, once the answer is drawn, marks each claim whose verdict the evidence does not carry and whose probability passes the deployment's threshold: a dotted underline, the panel's own tooltip box with a name and one line, and a line under the answer saying how many statements are not fully backed. A claim is found by its rendered text and marked in each piece it runs through; one that cannot be found, an answer cut by an error, and every answer with no threshold are left as they were. A restored conversation marks its answers again from the verdict kept on each turn. The German is a draft that the next commit replaces with the German pipeline's.

Verified: npm test passes, test/chat-claims.test.mjs 7 of 7.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: <the model that wrote this commit>
EOF
git log -1 --format='[%s]'
```

---

### Task 3: The German, through the German pipeline

**Files:**

- Modify: `assets/chat.js` (the `de` entries `claim`, `claimsOne`, `claimsMany`)
- Modify: `test/spelling.test.mjs` (only if `Teilweise` goes)

- [ ] **Step 1: The translator**

Dispatch the translator of `conventions/TRANSLATOR.md` with the six English strings of Task 2 (`claim.partial`, `claim.contradicted`, `claim.absent`, `claim.unsourced`, each a name and a line, and `claimsOne`, `claimsMany` with `{n}`), the draft German beside them, and where they stand: the name in bold before the line in a tooltip, and the line under a chat answer. It works from `conventions/GLOSSARY.md` (a visitor's claim is «Aussage») and `conventions/GERMAN.md`, Swiss Standard German, and keeps `{n}`.

- [ ] **Step 2: The editor and the back-reader**

Dispatch the editor of `conventions/EDITOR.md` on the German alone, then the back-reader of `conventions/BACKREADER.md`, which renders it into literal English; put a meaning the back-reading changes to the owner as one question with a proposal, and apply the owner's answer.

- [ ] **Step 3: Apply, test, commit**

Replace the draft `de` entries with the reviewed German. If `Teilweise` is no longer in them, remove it from the allow list in `test/spelling.test.mjs`.

Run: `node --test test/chat-claims.test.mjs test/spelling.test.mjs`

Expected: PASS.

```bash
git add assets/chat.js test/spelling.test.mjs
git commit --author "Translator <translator@blust.ch>" -F - <<'EOF'
The claim notes and the line under an answer are reviewed German

The German of the claim notes and of the line under a marked answer was a draft. The translator drafted it from the glossary, the editor read it without the English, and the back-reader rendered it into literal English; this is the reviewed text.

Verified: node --test test/chat-claims.test.mjs and test/spelling.test.mjs pass.

Process: Delivery
Phase: Implement
Track: Prose
Co-Authored-By: <the model that wrote this commit>
EOF
git log -1 --format='[%s]'
```

---


### Task 4: The design system's Chat section

**Files:**

- Modify: `docs/design-system/assets.md`

- [ ] **Step 1: The paragraph and the drawing**

Apply to `docs/design-system/assets.md` (`git apply` takes it as written):

````diff
diff --git a/docs/design-system/assets.md b/docs/design-system/assets.md
index 928dc9e..8daae1f 100644
--- a/docs/design-system/assets.md
+++ b/docs/design-system/assets.md
@@ -69,6 +69,8 @@ The family's one modal: everything a page opens over itself opens here, the grap
 
 A button at the foot of a prose page and the terminal it opens over the site's chat service, a card on a desk and a sheet on a phone. The endpoint and the model page are named on the script's own tag. Source: [assets/chat.css](../../assets/chat.css), [assets/chat.js](../../assets/chat.js), whose header gives the tag.
 
+Where the chat service checks its answers, a claim the evidence does not carry is marked once the answer has finished, and only where its probability passes the threshold the service sends: a dotted underline, `--t-part` for a claim carried in part and `--t-bad` for the rest. Hover or keyboard focus shows its note in the panel's own tooltip box, the one under the header's buttons, with a name and one line; a tap does not, and on a phone the line under the answer says how many statements are not fully backed. With no threshold nothing is marked.
+
 ```text
 Desk                                            Phone
                 ┌───────────────────────────┐   ┌──────────────────────────┐
@@ -77,8 +79,15 @@ Desk                                            Phone
                 │ > the visitor's question  │   │ > question               │
                 │                           │   │                          │  ← .rbchat-log
                 │ The answer, drawn whole:  │   │ The answer …             │
-                │ prose, lists, tables,     │   │                          │
+                │ prose, lists, tables,     │   │ a claim not backed       │
+                │ a claim not backed        │   │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄       │  ← .rbchat-claim
+                │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄        │   │                          │
+                │ ┌─────────────────────┐   │   │                          │
+                │ │ Contradicted  The   │   │   │                          │  ← .rbchat-note,
+                │ │ model's pages say … │   │   │                          │    never on a phone
+                │ └─────────────────────┘   │   │                          │
                 │ a picture [⤢]             │   │                          │
+                │ 1 statement here isn't …  │   │ 1 statement here isn't … │  ← .rbchat-claims
                 │ sources · next questions  │   │                          │
                 ├───────────────────────────┤   ├──────────────────────────┤
                 │ > Ask about the model…    │   │ > Ask about the model…   │  ← .rbchat-form
````

- [ ] **Step 2: Check and commit**

Run: `node --test test/design-system-docs.test.mjs && sh conventions/conventions-format && sh conventions/conventions-check`

Expected: PASS; no hex and no version in the page, every link resolving.

```bash
git add docs/design-system/assets.md
git commit --author "Implementer <implementer@blust.ch>" -F - <<'EOF'
The design system draws a marked claim in the chat

The Chat section says when a claim is marked, how the mark looks, where its note shows and where it does not, and its drawing gains a marked claim, its note and the line under the answer, at desk and phone width.

Verified: node --test test/design-system-docs.test.mjs, conventions-format and conventions-check pass.

Process: Delivery
Phase: Implement
Track: Prose
Co-Authored-By: <the model that wrote this commit>
EOF
git log -1 --format='[%s]'
```

---

### Task 5: Look at it

- [ ] **Step 1: Render it the way the mockup did**

Serve a page that links this worktree's `assets/chat.css` and `assets/chat.js` with the Terminal tokens of `test/fixtures/terminal.mjs`, answer `POST /chat` with the recorded stream of `test/chat-claims.test.mjs` and a threshold, and screenshot with Playwright at 1280×860 and 390×844, dark and light, with the pointer resting on a marked claim. Kill the server by its PID.

Expected: the dotted underline in amber and red, the note in the panel's box under the claim on a desk and none on a phone, and the line under the answer; nothing overlaps the input. Compare with the approved mockup at https://claude.ai/artifact/LE4q4mpwSb43RnTNVSfFPR, and fix what differs in a commit of its own with a test where one can hold it.

---

## After the last task

Run `npm test` once more and the conventions checks, bring the branch up to date with main, open the pull request and stop. The release, the sites' re-sync that takes tokens v16 and the chat group together, and the first threshold are the owner's.
