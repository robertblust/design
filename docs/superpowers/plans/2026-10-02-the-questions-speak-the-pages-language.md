# The questions speak the page's language implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A site can ship reviewed German for its model's question titles, and the chat widget offers and sends that German on a German page.

**Architecture:** A new renderer, `lib/render/questions.mjs`, lists the model's question titles for the translator and writes the served `questions.de.json` from a `loadGerman` lookup, failing where a title has no German. `bin/design.mjs` gains `design german questions <file>`, which prints those titles. `assets/chat.js` gains an optional `data-questions-de`, read in the same fetch as `data-questions`; each question in the widget's list carries its German as `de`, chips show and send it where `langNow()` is `de`, and the conversation is read back to titles before anything compares titles.

**Tech Stack:** Node 22+, `node:test`, Playwright Chromium for the widget's browser tests, the widget in ES5 (`var`, `function`, no arrow functions). No dependency is added.

**Spec:** `docs/superpowers/specs/2026-10-02-the-questions-speak-the-pages-language-design.md`, on branch `the-questions-speak-the-pages-language` (pull request #224). Read it before any task.

## Global Constraints

- **One repository, one branch.** Implementation runs in a fresh worktree from `main` once #224 and this plan are merged: `~/git/robertblust/design-the-questions-speak-the-pages-language-build`, branch `the-questions-speak-the-pages-language-build`. The clone at `~/git/robertblust/design` stays on `main` and is never edited.
- **`export PATH=/opt/homebrew/bin:$PATH`** before any `node`, `npm`, `npx`, `gh` or `sh conventions/…` command. A push names the helper: `git -c credential.helper= -c credential.helper='!gh auth git-credential' push -u https://github.com/robertblust/design.git the-questions-speak-the-pages-language-build`.
- **Every command's exit code is read on its own**, never through a pipe into `tail` or `head`.
- **A single test file runs as** `node --test test/<name>.test.mjs`; the whole suite as `npm test`. `sh conventions/conventions-check` and `sh conventions/conventions-format check` exit 0 before every commit.
- **The served file** is `questions.de.json` at the site's root: a JSON array of `{ title, text }`, one per question title the model holds, in the model's order, each title once, written as `JSON.stringify(entries, null, 2)` followed by one line break.
- **The site's source file** is `build/questions.de.json`, an array of `{ en, de }`, read with `loadGerman`; this package never writes it.
- **The attribute** is `data-questions-de`, read as `tag.dataset.questionsDe`. Without it, on an English page, when its file fails to load, or for a title the file lacks, the widget behaves exactly as on `main`.
- **Nothing reaches the chat host before send:** the German file is read only when the panel opens, in the same `questions()` call as the model file, with the same `Q_TIMEOUT`.
- **Which questions to offer is chosen by `title`**, as on `main`; only what a chip shows and sends changes.
- **Commits are the Implementer's:** `git commit --author "Implementer <implementer@blust.ch>"`, trailers `Process: Delivery`, `Phase: Implement`, `Track: Code`, then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. A fresh worktree runs `sh conventions/conventions-sync sync` once before its first commit, so the seat hook runs.
- **Commit messages** in the git register of `conventions/WRITING.md`: a sentence subject under seventy characters with no prefix and no trailing period, one to three prose paragraphs with no headers, no bullets and no plan task numbers, and a `Verified:` line naming what ran, before the trailers. The pull request body the same register, ending `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **A finding against a committed task is a new commit**, never an amend of a commit a reviewer has read.
- **Nothing is merged, tagged, released or deleted by an agent.** The last task pushes, opens the pull request and stops. `package.json`'s version is not moved.
- **No count or version of something that still moves** in any prose or comment.
- **Comments in code say why**, in the register the surrounding files use: a short paragraph above the thing, present tense, no history.

## Review Focus

- **A conversation restored on the next page** draws its follow-up chips in German at once, before the model file is read again, because the kept list carries `de`. Task 2 holds it.
- **A German question the visitor typed by hand, word for word the reviewed German,** counts as asked, and its title is not offered again. Task 2 holds it, since `asTitles` reads any user message back, not only one a chip sent.
- **A German text longer than the input's limit** is not offered, and the English title is offered in its place. Task 2 holds it.
- **A model whose question titles repeat** writes each title once in the served file. Task 1 holds it.
- **`company.json`'s shape** (`{ company: { entities } }`) is read by `design german questions` as `model.json`'s is. Task 1 holds it.

---

### Task 1: The served file and the translator's list

**Files:**

- Create: `lib/render/questions.mjs`
- Modify: `package.json` (`exports`), `bin/design.mjs` (usage, the `german` branch)
- Test: `test/questions-de.test.mjs`

**Interfaces:**

- Consumes: `loadGerman(file)` from `lib/render/german.mjs`, whose `de(en)` throws `no German for: "<en>" — add it to <file>` and whose `unused()` lists entries nobody asked for.
- Produces: `questionTitles(data) => string[]` and `writeQuestionsDe(data, { check, root, de }) => string[]` (the stale paths under `check`, `[]` otherwise), exported as `@robertblust/design/render/questions`; the command `design german questions <file>`.

- [ ] **Step 1: Write the failing tests**

Create `test/questions-de.test.mjs`:

```js
// The served German of the model's question titles: a pure function of the model and of the
// site's reviewed file, tested on fixtures for the reason german-loader.test.mjs gives — a test
// that reads a real site's file passes for the wrong reason the day that file moves.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadGerman } from "../lib/render/german.mjs";
import { questionTitles, writeQuestionsDe } from "../lib/render/questions.mjs";

const CLI = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "bin", "design.mjs");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "rb-q-"));
const germanFile = (entries) => {
  const f = path.join(tmp(), "questions.de.json");
  fs.writeFileSync(f, JSON.stringify(entries));
  return f;
};
const DATA = { entities: [
  { id: "q/a", type: "question", name: "What is it?" },
  { id: "v/a", type: "value", name: "Not a question" },
  { id: "q/b", type: "question", name: "Who answers?" },
  { id: "q/c", type: "question", name: "" },
  { id: "q/d", type: "question", name: "What is it?" },
] };
const GERMAN = [{ en: "What is it?", de: "Was ist es?" }, { en: "Who answers?", de: "Wer antwortet?" }];

test("questionTitles lists every question's title once, in the model's order", () => {
  assert.deepEqual(questionTitles(DATA), ["What is it?", "Who answers?"]);
  assert.deepEqual(questionTitles({ entities: [] }), []);
});

test("writeQuestionsDe writes each title with its reviewed German, and every entry is asked", () => {
  const root = tmp();
  const g = loadGerman(germanFile(GERMAN));
  assert.deepEqual(writeQuestionsDe(DATA, { root, de: g.de }), []);
  assert.equal(fs.readFileSync(path.join(root, "questions.de.json"), "utf8"),
    JSON.stringify([{ title: "What is it?", text: "Was ist es?" }, { title: "Who answers?", text: "Wer antwortet?" }], null, 2) + "\n");
  assert.deepEqual(g.unused(), []);
});

test("under check a file that differs is reported and left alone, and a matching one is not", () => {
  const root = tmp();
  const { de } = loadGerman(germanFile(GERMAN));
  fs.writeFileSync(path.join(root, "questions.de.json"), "[]\n");
  assert.deepEqual(writeQuestionsDe(DATA, { root, de, check: true }), ["questions.de.json"]);
  assert.equal(fs.readFileSync(path.join(root, "questions.de.json"), "utf8"), "[]\n");
  writeQuestionsDe(DATA, { root, de });
  assert.deepEqual(writeQuestionsDe(DATA, { root, de, check: true }), []);
  const fresh = tmp();
  assert.deepEqual(writeQuestionsDe(DATA, { root: fresh, de, check: true }), ["questions.de.json"], "a file not yet written is stale");
});

test("a title without German stops the write, and German for a title the model lost is unused", () => {
  const g = loadGerman(germanFile([{ en: "What is it?", de: "Was ist es?" }, { en: "Gone?", de: "Weg?" }]));
  assert.throws(() => writeQuestionsDe(DATA, { root: tmp(), de: g.de }), /no German for: "Who answers\?"/);
  assert.ok(g.unused().includes("Gone?"));
});

test("the writer refuses to run without a root or a lookup", () => {
  assert.throws(() => writeQuestionsDe(DATA, { de: () => "" }), /root/);
  assert.throws(() => writeQuestionsDe(DATA, { root: tmp() }), /de/);
});

test("design german questions prints the titles of a model file and of a company file", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "model.json"), JSON.stringify(DATA));
  fs.writeFileSync(path.join(dir, "company.json"), JSON.stringify({ company: DATA }));
  for (const f of ["model.json", "company.json"]) {
    const r = spawnSync(process.execPath, [CLI, "german", "questions", path.join(dir, f)], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), ["What is it?", "Who answers?"], f);
  }
  const missing = spawnSync(process.execPath, [CLI, "german", "questions", path.join(dir, "none.json")], { encoding: "utf8" });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /cannot read/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/questions-de.test.mjs` Expected: FAIL, `Cannot find module` naming `lib/render/questions.mjs`.

- [ ] **Step 3: The renderer**

Create `lib/render/questions.mjs`:

```js
// The German of the model's question titles, as the chat widget offers them on a German page.
// The model is written in English and stays so; a site's own `build/questions.de.json` is its
// translation of the titles, made by the roles of conventions/WRITING.md and read with
// `loadGerman`, so a title the model adds or rewords finds no German and stops the build, as a
// principle does. What this writes is the file the widget reads through `data-questions-de`:
// every title with its German, in the model's order, beside the model file it came from.
import fs from "node:fs";
import path from "node:path";

// Every question's title, once, in the order the model holds them: what the translator is given,
// and what the served file holds. A question with no title is not one the widget can offer.
export function questionTitles(data) {
  const titles = (data.entities || []).filter((e) => e && e.type === "question" && typeof e.name === "string" && e.name).map((e) => e.name);
  return [...new Set(titles)];
}

export function writeQuestionsDe(data, { check = false, root, de } = {}) {
  if (!root) throw new Error("writeQuestionsDe needs the site's root: the file it writes is the site's, not this package's");
  if (typeof de !== "function") throw new Error("writeQuestionsDe needs de, the lookup loadGerman gives for the site's build/questions.de.json");
  const rel = "questions.de.json";
  const file = path.join(root, rel);
  const next = JSON.stringify(questionTitles(data).map((title) => ({ title, text: de(title) })), null, 2) + "\n";
  const now = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (now === next) return [];
  if (check) return [rel];
  fs.writeFileSync(file, next);
  return [];
}
```

In `package.json`'s `exports`, add after the `"./render/principles"` entry:

```json
"./render/questions": "./lib/render/questions.mjs",
```

- [ ] **Step 4: The command**

In `bin/design.mjs`, add a usage line after `design german stale <base> <head>`:

```text
       design german questions <model.json>
```

and a description line after the `german stale` one:

```text
  german questions every question title of a model or company file, as JSON, for the translator
```

In the `if (argv[0] === "german")` branch, before `if (sub === "extract" || sub === "german")`, add:

```js
  // The translator's list for a site's build/questions.de.json: every title the build will hold
  // the file to, from the same artifact the site's pages are built from. A company file carries
  // the model under `company`, as companygraph.io's does.
  if (sub === "questions") {
    if (!a) fail(USAGE, 2);
    const { questionTitles } = await import("../lib/render/questions.mjs");
    const j = JSON.parse(readPage(a));
    console.log(JSON.stringify(questionTitles(j.entities ? j : j.company || { entities: [] }), null, 2));
    process.exit(0);
  }
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test test/questions-de.test.mjs` Expected: PASS, six tests.

Run: `npm test` Expected: PASS. If `test/cli.test.mjs` holds the usage text verbatim, update it to the new lines and nothing else, and ledger that as a ruling.

- [ ] **Step 6: Commit**

```bash
sh conventions/conventions-check && sh conventions/conventions-format check
git add lib/render/questions.mjs package.json bin/design.mjs test/questions-de.test.mjs
git commit --author "Implementer <implementer@blust.ch>" -F - <<'EOF'
A site can serve the reviewed German of its question titles

writeQuestionsDe writes the questions.de.json the widget will read: every question title of the model, once and in its order, with the German a site's build/questions.de.json holds for it, looked up by loadGerman so a title without German stops the build as a principle does. design german questions prints the same titles from a model or company file, as the translator's list.

Verified: node --test test/questions-de.test.mjs failed on the missing module first and passes now; npm test passes; conventions-check and conventions-format pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

---

### Task 2: The widget offers and sends the German

**Files:**

- Modify: `assets/chat.js` (the header comment, beside `unasked`, `questions()`, the intro's picks, `offerQuestions`, `offer`, the config line, `window.rbChat`)
- Modify: `README.md` (after the paragraph on `data-questions`)
- Test: `test/chat.test.mjs`, new `test/chat-questions-de.test.mjs`

**Interfaces:**

- Consumes: the served `questions.de.json` shape from Task 1, `[{ title, text }]`.
- Produces: `rbChat.sayIn(list, lang, title) => string` and `rbChat.asTitles(list, messages) => messages`; each item `questions()` resolves may carry `de`.

- [ ] **Step 1: Write the failing unit tests**

In `test/chat.test.mjs`, add `sayIn, asTitles` to the destructuring from `globalThis.rbChat`, and add:

```js
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
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/chat.test.mjs` Expected: FAIL, `sayIn is not a function`.

- [ ] **Step 3: The two helpers**

In `assets/chat.js`, directly after the `unasked` function, add:

```js
  // A question as the page offers it: its German where the page is German and the site's
  // reviewed file holds one, else the model's own title. A chip shows and sends this; which
  // questions to offer is still chosen by title, and a chip that is no model question, such as
  // "tell me more", is its own text in either language.
  function sayIn(list, lang, title){
    if (lang !== "de") return title;
    for (var i = 0; i < (list || []).length; i++) if (list[i] && list[i].title === title && typeof list[i].de === "string" && list[i].de) return list[i].de;
    return title;
  }

  // The conversation with every visitor message that is a question's German read back as its
  // title, so unasked() and follow(), which compare titles, know the question was asked —
  // whether a chip sent it or the visitor typed the same words.
  function asTitles(list, messages){
    var back = {};
    (list || []).forEach(function(q){ if (q && typeof q.de === "string" && q.de) back[q.de.trim()] = q.title; });
    return (messages || []).map(function(m){
      return m && m.role === "user" && typeof m.content === "string" && back[m.content.trim()] ? { role: m.role, content: back[m.content.trim()] } : m;
    });
  }
```

Add `sayIn: sayIn, asTitles: asTitles` to the object assigned to `window.rbChat`, after `unasked: unasked`.

Run: `node --test test/chat.test.mjs` Expected: PASS.

- [ ] **Step 4: Write the failing browser tests**

Create `test/chat-questions-de.test.mjs`:

```js
// The model's questions in the page's language, in Chromium: a German page whose tag names the
// site's reviewed German offers and sends it, an English page and a German page without the file
// offer the model's titles, and a question asked in German is not offered again.
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

const page = (lang, de) => `<!doctype html><html lang="${lang}" data-theme="dark"><head><meta charset="utf-8">
<style>${TERMINAL}</style><link rel="stylesheet" href="/chat.css"></head><body><p>A page.</p>
<script src="/chat.js" data-chat="/chat" data-model="/model/" data-questions="/model.json"${de ? ` data-questions-de="${de}"` : ""} defer></script></body></html>`;

const TITLES = ["What is it?", "Who answers?", "Can I trust it?"];
const GERMAN = { "What is it?": "Was ist es?", "Who answers?": "Wer antwortet?", "Can I trust it?": "Kann ich dem trauen?", };
const TOO_LONG = "Q".repeat(5000);
const MODEL = JSON.stringify({ entities: TITLES.map((name, i) => ({ id: `question/q${i}`, type: "question", name, fields: {} })), edges: [] });
const SERVED = JSON.stringify(TITLES.map((title) => ({ title, text: title === "Can I trust it?" ? TOO_LONG : GERMAN[title] })));
const sse = (events) => events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");
let sent = [], slow = false, server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (req.method === "POST" && url === "/chat") {
      let body = "";
      req.on("data", (c) => { body += c; });
      req.on("end", () => {
        sent.push(JSON.parse(body));
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end(sse([["text", { text: "An answer." }], ["done", { model: null, spent: 1, dayLeft: 1 }]]));
      });
      return;
    }
    const files = {
      "/de/": ["text/html", page("de", "/questions.de.json")], "/de/other/": ["text/html", page("de", "/questions.de.json")], "/en/": ["text/html", page("en", "/questions.de.json")],
      "/de-nofile/": ["text/html", page("de", "/missing.json")], "/de-noattr/": ["text/html", page("de", null)],
      "/model.json": ["application/json", MODEL], "/questions.de.json": ["application/json", SERVED],
      "/chat.js": ["text/javascript", asset("chat.js")], "/chat.css": ["text/css", asset("chat.css")],
    };
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    const send = () => { res.writeHead(200, { "content-type": hit[0], "cache-control": "no-store" }); res.end(hit[1]); };
    // A slow model and German file stand for a page on which neither has been read yet.
    if (slow && (url === "/model.json" || url === "/questions.de.json")) setTimeout(send, 1500); else send();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

// The intro's model questions: every row text that is a title or a German of one.
const KNOWN = new Set([...TITLES, ...Object.values(GERMAN)]);
const introQuestions = (p) => p.$$eval(".rbchat-intro .rbchat-q", (q) => q.map((x) => x.textContent.trim())).then((t) => t.filter((x) => KNOWN.has(x)).sort());
const nextQuestions = (p) => p.$$eval(".rbchat-next .rbchat-q", (q) => q.map((x) => x.textContent.trim()));

async function opened(path) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await context.newPage();
  await p.goto(base + path);
  await p.click(".rbchat-open");
  await p.waitForFunction(() => document.querySelectorAll(".rbchat-intro .rbchat-q").length > 0);
  await p.waitForTimeout(300);
  return { p, context };
}

test("a German page offers the reviewed German, keeps a title whose German is too long, and sends what it shows", async () => {
  sent = [];
  const { p, context } = await opened("/de/");
  assert.deepEqual(await introQuestions(p), ["Can I trust it?", "Was ist es?", "Wer antwortet?"]);
  await p.click(".rbchat-intro .rbchat-q >> text=Was ist es?");
  await p.waitForSelector(".rbchat-next .rbchat-q");
  const last = sent.at(-1).messages.filter((m) => m.role === "user").at(-1);
  assert.equal(last.content, "Was ist es?");
  assert.equal(sent.at(-1).lang, "de");
  await context.close();
});

test("a question asked in German is not offered again after the answer", async () => {
  const { p, context } = await opened("/de/");
  await p.click(".rbchat-intro .rbchat-q >> text=Was ist es?");
  await p.waitForSelector(".rbchat-next .rbchat-q");
  const next = await nextQuestions(p);
  assert.ok(next.length > 0);
  assert.ok(!next.includes("Was ist es?") && !next.includes("What is it?"), next.join(" | "));
  await context.close();
});

test("the follow-ups come back in German with the conversation on the next page, before the files are read", async () => {
  slow = false;
  const { p, context } = await opened("/de/");
  await p.click(".rbchat-intro .rbchat-q >> text=Was ist es?");
  await p.waitForSelector(".rbchat-next .rbchat-q");
  const next = await nextQuestions(p);
  assert.ok(next.every((q) => Object.values(GERMAN).includes(q)), next.join(" | "));
  slow = true;
  await p.goto(base + "/de/other/", { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => document.querySelector(".rbchat") && !document.querySelector(".rbchat").hidden);
  assert.deepEqual(await nextQuestions(p), next, "the chips were not drawn in German from the kept list");
  slow = false;
  await context.close();
});

test("an English page, a German page whose file is missing and one without the attribute offer the titles", async () => {
  for (const path of ["/en/", "/de-nofile/", "/de-noattr/"]) {
    const { p, context } = await opened(path);
    assert.deepEqual(await introQuestions(p), [...TITLES].sort(), path);
    await context.close();
  }
});
```

The third test moves to a second German page whose model and German files answer only after a second and a half: the follow-ups it shows at once can only be German if the list the tab kept carried `de` across the page. The first test's third question has a German text longer than the widget's `LIMIT` of 1000 characters, so its English title is what the page offers.

- [ ] **Step 5: Run them to see them fail**

Run: `node --test test/chat-questions-de.test.mjs` Expected: FAIL. The first test finds the English titles where it expects German; the fourth passes, since an English page is today's behavior.

- [ ] **Step 6: Read the German file in the same fetch**

In `assets/chat.js`:

Change the config line `var ENDPOINT = tag.dataset.chat, QUESTIONS = tag.dataset.questions || null;` to:

```js
  var ENDPOINT = tag.dataset.chat, QUESTIONS = tag.dataset.questions || null, QUESTIONS_DE = tag.dataset.questionsDe || null;
```

Replace the body of `questions(cb)` with the following, which keeps every rule of `main` and adds the German read beside the model read. The kept list's key names both files, so a page whose tag names another German file does not take a list made with the wrong one:

```js
  function questions(cb){
    if (!QUESTIONS) { qList = qList || []; cb([]); return; }
    if (!qList) keptList();
    if (qList) { cb(qList); return; }
    if (!qFetch) {
      var ac = new AbortController();
      var timer = setTimeout(function(){ ac.abort(); }, Q_TIMEOUT);
      var modelRead = fetch(QUESTIONS, { signal: ac.signal })
        .then(function(r){
          if (!r.ok) { clearTimeout(timer); return []; }
          return r.json().then(function(j){
            clearTimeout(timer);
            var entities = j && Array.isArray(j.entities) ? j.entities : [];
            var types = {}, rests = {};
            entities.forEach(function(e){ if (e && typeof e.id === "string") types[e.id] = e.type; });
            // The same read gives the Try rows their facts: the processes by name, and how many
            // of each type the model holds, so a row never names what the model does not have.
            var counts = {};
            entities.forEach(function(e){ if (e && typeof e.type === "string") counts[e.type] = (counts[e.type] || 0) + 1; });
            qFacts = { processes: entities.filter(function(e){ return e && e.type === "process" && typeof e.name === "string" && e.name.length > 0; }).map(function(e){ return e.name; }), counts: counts, versions: versionsOf(j) };
            (j && Array.isArray(j.edges) ? j.edges : []).forEach(function(g){
              if (!g || types[g.from] !== "question" || typeof g.via !== "string" || g.via.indexOf("Rests on.") !== 0) return;
              (rests[g.from] = rests[g.from] || []).push({ id: g.to, type: types[g.to] || null });
            });
            return entities
              .filter(function(e){ return e && e.type === "question" && typeof e.name === "string" && e.name.length > 0; })
              .map(function(e){ return { id: typeof e.id === "string" ? e.id : null, title: e.name, kind: e.fields && typeof e.fields.kind === "string" ? e.fields.kind : null, rests: rests[e.id] || [] }; })
              .filter(function(q){ return q.title.length <= LIMIT; });
          });
        })
        .catch(function(){ clearTimeout(timer); return []; });
      qFetch = Promise.all([modelRead, germanRead()]).then(function(r){
        var de = r[1];
        return r[0].map(function(q){ return de[q.title] ? Object.assign({}, q, { de: de[q.title] }) : q; });
      });
    }
    qFetch.then(function(list){
      if (!qList) {
        qList = list;
        if (list.length) { try { sessionStorage.setItem(FACTS_KEY, JSON.stringify({ from: keptFrom(), list: list, facts: qFacts })); } catch (e) {} }
      }
      cb(qList);
    });
  }
  // Which files a kept list was made from: the model's and, where the tag names one, the German.
  function keptFrom(){ return QUESTIONS + (QUESTIONS_DE ? " " + QUESTIONS_DE : ""); }
  // The list the tab kept from an earlier page, taken where it was made from the same files, so a
  // conversation drawn again before the files are read offers its chips in the page's language.
  function keptList(){
    try {
      var kept = JSON.parse(sessionStorage.getItem(FACTS_KEY) || "null");
      if (kept && kept.from === keptFrom() && Array.isArray(kept.list) && kept.facts) { qList = kept.list; qFacts = kept.facts; }
    } catch (e) {}
    return qList;
  }
  // The site's reviewed German for its question titles, read with the model under the same
  // timeout and the same rules: a tag without `data-questions-de`, a 404, a timeout or a body that
  // is not the file's shape gives no German, and the titles are offered as they stand. A German
  // text longer than the box's limit is not one a chip may send, so its title is offered instead.
  function germanRead(){
    if (!QUESTIONS_DE) return Promise.resolve({});
    var ac = new AbortController();
    var timer = setTimeout(function(){ ac.abort(); }, Q_TIMEOUT);
    return fetch(QUESTIONS_DE, { signal: ac.signal })
      .then(function(r){
        if (!r.ok) { clearTimeout(timer); return {}; }
        return r.json().then(function(j){
          clearTimeout(timer);
          var map = {};
          (Array.isArray(j) ? j : []).forEach(function(x){
            if (x && typeof x.title === "string" && typeof x.text === "string" && x.text && x.text.length <= LIMIT) map[x.title] = x.text;
          });
          return map;
        });
      })
      .catch(function(){ clearTimeout(timer); return {}; });
  }
  // A question as this page offers it now, from the list the widget holds or the tab kept.
  function say(title){ return sayIn(qList || keptList() || [], langNow(), title); }
```

The restored conversation reads `was.next` before `questions()` has run; `keptList()` lets `say` find the kept German there, which is what the third browser test holds.

- [ ] **Step 7: Show and send it, and read the conversation back to titles**

In the intro, change:

```js
        if (!introPick) introPick = { processes: f.processes.length ? pick(f.processes, 1) : [], questions: spread(list.filter(function(q){ return unasked([q.title], messages).length; }), 3) };
```

to:

```js
        if (!introPick) introPick = { processes: f.processes.length ? pick(f.processes, 1) : [], questions: spread(list.filter(function(q){ return unasked([q.title], asTitles(list, messages)).length; }), 3) };
```

and:

```js
        var picked = introPick.questions.map(function(q){ return [q]; });
```

to:

```js
        var picked = introPick.questions.map(function(q){ return [say(q)]; });
```

In `offerQuestions`, change the two lines that compute `open` and `picked` to:

```js
      var seen = asTitles(list, messages);
      var open = unasked(list.map(function(q){ return q.title; }), seen);
      var last = turns[turns.length - 1];
      var picked = (last && last.role === "assistant" && follow(last.cites, list, seen, langNow(), null, mentioned(last.content, heard(turns), list, messages))) || spread(list.filter(function(q){ return open.indexOf(q.title) !== -1; }), 3);
```

In `offer(picked)`, change:

```js
    menu(qBox, picked.map(function(t){ return [t]; }), 0);
    log.appendChild(qBox);
    qPicked = picked.slice(); menuRows = picked.slice(); keysLine();
```

to:

```js
    menu(qBox, picked.map(function(t){ return [say(t)]; }), 0);
    log.appendChild(qBox);
    qPicked = picked.slice(); menuRows = picked.map(say); keysLine();
```

`qPicked` keeps the titles, so the tab keeps titles and the next page says them in its own language.

In the header comment, change the tag example to:

```js
//   <script src="chat.js" data-chat="https://chat.example/chat" data-model="/model/"
//     data-questions="/model.json" data-questions-de="/questions.de.json" defer>
```

and after the paragraph that begins `// Opening the panel may read the site's own model file`, add:

```js
// Where the tag also names `data-questions-de`, the same read takes the site's reviewed German
// for its question titles, and a German page offers and sends that German; which questions are
// offered is still chosen by their titles.
```

- [ ] **Step 8: The README**

In `README.md`, after the paragraph that begins ``A tag may also carry `data-questions`,`` add:

```markdown
A tag may carry `data-questions-de` beside it, a same-origin path to the site's `questions.de.json`, which `writeQuestionsDe` from `@robertblust/design/render/questions` writes from the site's reviewed `build/questions.de.json`. It is read in the same read and under the same rules as `data-questions`, so nothing reaches the chat host before send. On a page whose `<html lang>` is `de`, every model question the intro and the follow-ups offer shows and sends its German, and a title the file lacks, or whose German is longer than the box takes, stays as the model writes it. A question asked in German counts as asked, so it is not offered again. `design german questions <model.json>` prints the titles the site's file has to hold, for the translator.
```

- [ ] **Step 9: Run everything**

Run: `node --test test/chat.test.mjs test/chat-questions-de.test.mjs test/chat-next-kept.test.mjs test/chat-terminal.test.mjs` Expected: PASS.

Run: `npm test` Expected: PASS.

- [ ] **Step 10: Commit**

```bash
sh conventions/conventions-check && sh conventions/conventions-format check
git add assets/chat.js README.md test/chat.test.mjs test/chat-questions-de.test.mjs
git commit --author "Implementer <implementer@blust.ch>" -F - <<'EOF'
The chat offers the model's questions in the page's language

A tag may name data-questions-de, the site's reviewed German for its question titles, and the widget reads it in the same read as the model file, before anything reaches the chat host. On a German page every model question the intro and the follow-ups offer shows and sends its German, while which questions to offer is still chosen by title, and a German question asked, by a chip or typed, is read back to its title so it is not offered again. A conversation drawn again on the next page says its chips in German from the list the tab kept.

Verified: the new unit tests in test/chat.test.mjs and the browser tests in test/chat-questions-de.test.mjs failed first and pass now; the chat browser tests and npm test pass; conventions-check and conventions-format pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

- [ ] **Step 11: Push and open the pull request, then stop**

```bash
git -c credential.helper= -c credential.helper='!gh auth git-credential' push -u https://github.com/robertblust/design.git the-questions-speak-the-pages-language-build
gh pr create -R robertblust/design --base main --head the-questions-speak-the-pages-language-build --title "The chat offers the model's questions in the page's language" --body-file - <<'EOF'
A site can now ship reviewed German for its model's question titles, and the chat offers and sends it on a German page. writeQuestionsDe, from @robertblust/design/render/questions, writes the served questions.de.json from the site's build/questions.de.json, looked up by loadGerman, so a title without German stops the build as a principle does; design german questions prints the titles for the translator. The widget reads the file through data-questions-de, in the same read as the model file, and a German page shows and sends the German while still choosing questions by title.

Each site adopts it after the release: the renderer call, the attribute, and a first build/questions.de.json made by the German pipeline.

Verified: npm test passes, the new tests having failed first; conventions-check and conventions-format pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

Report the pull request's URL and its checks. Merging, the release and each site's adoption are the owner's.
