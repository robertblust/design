# The chat as a terminal — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw the chat widget as the companygraph.io `/cli/` terminal: a lockup intro with numbered asks, questions at a prompt, answers held until whole and shown at once, numbered menus, and a command line that takes numbers, `/new`, `/clear`, `/help` and ↑.

**Architecture:** Every change stays in the `chat` group of this package: `assets/chat.js`, `assets/chat.css`, the chat paragraphs of `README.md`, and the chat tests. New pure functions sit in the pure section of `chat.js`, are exported on `window.rbChat`, and are tested on the stub in `test/chat.test.mjs`. The page section changes how the panel is built and how a turn is drawn, and a new browser test drives it in Chromium. The terminal's colors are declared on `.rbchat` as `--t-*` values. The page tokens are redefined inside `.rbchat` from those values, so every existing token-based rule inside the panel, and Mermaid through `tokenReader`, picks the terminal up without a second copy of each rule.

**Tech Stack:** Plain ES5-style browser JavaScript (no build), CSS, `node --test` with `node:assert/strict`, Playwright Chromium for the browser tests.

**Spec:** `docs/superpowers/specs/2026-09-28-the-chat-is-a-terminal-design.md`. Read it before any task. The prototype the owner approved is https://claude.ai/artifact/PiPyVYAovQs27YDX33i3uq. It shows every behavior, but its code is throwaway and is not to be copied.

## Global constraints

- Work in the worktree `~/git/robertblust/design-the-chat-is-a-terminal` on branch `the-chat-is-a-terminal`. Export `/opt/homebrew/bin` onto `PATH` before running `node`, `npm` or `gh`.
- Run the suite with `npm test`. It must end with every test passing before each commit. `node --test` reports with spec marks in a terminal and TAP in CI, so read the summary lines, not the marks.
- `sh conventions/conventions-check` and `sh conventions/conventions-format` must pass before the pull request.
- Shipped text is American English, and `test/spelling.test.mjs` holds it: color, behavior, center.
- Every sentence the widget writes is in `STRINGS`, in `en` and `de`. The German strings are drafts for the translator of `conventions/TRANSLATOR.md`, marked as such by the comment already above `de`.
- Nothing may reach the chat host before the visitor sends. `/new`, `/clear`, `/help`, a number that picks and ↑ never cause a request and never become a turn.
- The request body is unchanged: `{ messages: messages.slice(-SENT), lang: langNow() }`. `LIMIT = 1000`, `SENT = 7` and `TIMEOUT = 90000` are unchanged.
- The class names the browser tests and `verify/pages.mjs` select stay: `section.rbchat`, `.rbchat-open`, `.rbchat-log`, `.rbchat-user`, `.rbchat-assistant` (with `aria-live` set once the answer is finished), and `textarea` inside the panel. Only their rules change.
- The launcher button `.rbchat-open` is unchanged.
- Timing: the mark's parts appear 35 ms apart, the name types at 22 ms a character, the hello's two lines fade in, and the rows print 30 ms apart. The whole intro takes about a second. An answer has no animation.
- Commit messages are in the git register of `conventions/WRITING.md`: a plain sentence subject under seventy characters, one to three prose paragraphs, a `Verified:` line naming what ran, then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. After each commit, `git log -1 --format='[%s]'` must show the subject alone.

## Review focus

1. **A phone has no Enter key that sends.** The spec takes the Send button away. On a touch screen, the keyboard's return key in a `textarea` inserts a line break for many keyboards, so a visitor there could not send at all. Task 3 keeps a `↵` button beside the prompt that shows only under `(pointer: coarse)`. Its test is in Task 3. **This goes beyond the spec, so the owner confirms it in review.**
2. **The stream fails after some text has arrived.** While the answer is held, a network drop or the 90-second abort after partial text must behave as today: the held answer is dropped, the message is unsent, and the `network` refusal is printed as a `✗` line. The spinner must not be left behind. Its test is in Task 5.
3. **A number that is not a pick.** A visitor types `2` while no menu stands, or `9` against a six-row menu, or ` 3 ` with spaces. The first two are sent as typed and the third picks row 3. The tests are in Task 1 (`picked`) and Task 6.
4. **The language switches while the intro or a menu is on screen.** Every intro line, both group labels, the prompt line, the keys line and a spent menu's label follow `<html lang>` on the next tick, as `relabel()` does for the rest. Its test is in Task 4.
5. **A page with no `header a.brand`, or a model file that fails.** The intro still draws, without the lockup, with the hello naming the page's host, and with only the meta-model Try row. Its tests are in Task 1 (`lockupOf`, `tryRows`) and Task 4.

---

### Task 1: The pure parts and the strings

**Files:**

- Modify: `assets/chat.js` (the `STRINGS` table, the pure section before `window.rbChat = {…}`, and the `window.rbChat` line)
- Test: `test/chat.test.mjs`

**Interfaces:**

- Produces:
  - `lockupOf(doc) → { mark: SVGElement, first: string, accent: string } | null`
  - `command(text) → "new" | "help" | null`
  - `picked(text, rows: string[]) → string`
  - `tryRows(facts: { processes: string[], counts: {[type]: number} } | null, lang, random?) → [question: string, gets: string][]`
  - `commitOf(cites) → string | null`
  - `seconds(ms) → string`
  - New keys on `strings(lang)`: `hello`, `helloHost`, `sub`, `bar`, `prompt`, `asking`, `answered`, `model`, `keys`, `help`, `tryLabel`, `try`.

- [ ] **Step 1: Write the failing tests.** Add `lockupOf, command, picked, tryRows, commitOf, seconds` to the destructuring at the top of `test/chat.test.mjs`, then append:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `npm test -- --test-name-pattern="lockup|slash commands|bare number|Try rows|process or a long|commit is the first|spinner's seconds|every new sentence"`

Expected: FAIL. `lockupOf` and the others are `undefined`, so each test throws `TypeError: … is not a function`.

- [ ] **Step 3: Add the strings.** In `STRINGS.en`, after `fresh: "New conversation",`, add:

```js
      // The terminal: the intro, the prompt, the spinner, the head of a finished answer, and
      // the keys and commands the command line takes. {name} is the lockup's text, {host} the
      // page's own host.
      hello: ["Hello. I answer from {name}’s model, and link", "every entity I name back to where it is written."],
      helloHost: ["Hello. I answer from the model of {host}, and link", "every entity I name back to where it is written."],
      sub: "chat · {host}", bar: "ask · {host}",
      prompt: "Type a question, a number, or /help",
      asking: "asking the model", answered: "answered", model: "model {sha} · {secs}s",
      keys: { send: "enter send", last: "↑ last question", pick: "1-{n} pick", help: "/help" },
      help: [["/new", "start a new conversation (also /clear)"], ["/help", "this list"], ["1-{n}", "pick from the menu above"], ["↑", "your last question back into the line"]],
      tryLabel: "Try",
      try: {
        metaModel: "Show me the meta-model", metaModelGets: "a diagram of the types and how they refer to each other",
        process: "Walk me through the {name} process", processGets: "its steps as a flow, the loops back included",
        list: "List {list} as a table", listGets: "one row each, every name a link into the model",
        lists: { kpi: "the KPIs", role: "the roles", product: "the products", decision: "the decisions", value: "the values" }
      },
```

In `STRINGS.de`, after `fresh: "Neues Gespräch",`, add:

```js
      hello: ["Hallo. Ich antworte aus dem Modell von {name}", "und verlinke jede Entität, die ich nenne."],
      helloHost: ["Hallo. Ich antworte aus dem Modell von {host}", "und verlinke jede Entität, die ich nenne."],
      sub: "Chat · {host}", bar: "fragen · {host}",
      prompt: "Frage, Nummer oder /help tippen",
      asking: "frage das Modell", answered: "beantwortet", model: "Modell {sha} · {secs}s",
      keys: { send: "Enter senden", last: "↑ letzte Frage", pick: "1-{n} wählen", help: "/help" },
      help: [["/new", "ein neues Gespräch beginnen (auch /clear)"], ["/help", "diese Liste"], ["1-{n}", "aus dem Menü darüber wählen"], ["↑", "Ihre letzte Frage zurück in die Zeile"]],
      tryLabel: "Probieren Sie",
      try: {
        metaModel: "Zeig mir das Meta-Modell", metaModelGets: "ein Diagramm der Typen und ihrer Verweise",
        process: "Zeig mir den Prozess {name} Schritt für Schritt", processGets: "die Schritte als Ablauf, samt Rücksprüngen",
        list: "Liste {list} als Tabelle", listGets: "eine Zeile je Eintrag, jeder Name ein Link ins Modell",
        lists: { kpi: "die KPIs", role: "die Rollen", product: "die Produkte", decision: "die Entscheidungen", value: "die Werte" }
      },
```

- [ ] **Step 4: Add the pure functions.** In `assets/chat.js`, directly above `window.rbChat = {`, add:

```js
  // ─── The terminal ─────────────────────────────────────────────────────────────────────────
  // The lockup the intro opens on is the page's own, as its header draws it: every site writes
  // `<a class="brand"><svg>…</svg><b>Company<span>Graph</span></b></a>`, so the tag needs no
  // attribute to name it. The accent is the span; the first half is what comes before it, its
  // trailing space kept, since blust.ch writes "Robert <span>Blust</span>".
  function lockupOf(doc){
    var a = doc && doc.querySelector && doc.querySelector("header a.brand");
    var svg = a && a.querySelector("svg"), b = a && a.querySelector("b");
    if (!svg || !b) return null;
    var span = b.querySelector("span"), accent = span ? span.textContent : "";
    return { mark: svg, first: b.textContent.slice(0, b.textContent.length - accent.length), accent: accent };
  }
  // The three words the command line keeps for itself. They never reach the host.
  function command(text){
    var t = String(text == null ? "" : text).trim().toLowerCase();
    return t === "/new" || t === "/clear" ? "new" : t === "/help" ? "help" : null;
  }
  // A number alone picks that row of the menu standing last, as the tooling takes "Pick 1-5";
  // a number with no such row, or anything else, is sent as the visitor typed it.
  function picked(text, rows){
    var t = String(text == null ? "" : text).trim();
    if (!/^\d{1,2}$/.test(t) || !rows) return t;
    var i = +t - 1;
    return i >= 0 && i < rows.length ? rows[i] : t;
  }
  // The Try rows: what the chat is built to answer, each with what comes back. The meta-model
  // always; a process only where the model holds one, picked at random; a list only of a kind
  // the model holds at least three of, the first in this order, so no row names what is not there.
  var LIST_TYPES = ["kpi", "role", "product", "decision", "value"];
  function tryRows(facts, lang, random){
    var t = strings(lang).try, rows = [[t.metaModel, t.metaModelGets]];
    var ps = facts && Array.isArray(facts.processes) ? facts.processes : [];
    if (ps.length) rows.push([t.process.replace("{name}", pick(ps, 1, random)[0]), t.processGets]);
    var counts = facts && facts.counts || {};
    for (var i = 0; i < LIST_TYPES.length; i++) {
      if ((counts[LIST_TYPES[i]] || 0) >= 3) { rows.push([t.list.replace("{list}", t.lists[LIST_TYPES[i]]), t.listGets]); break; }
    }
    return rows;
  }
  // The commit the answer was read at: the first cite whose URL names one.
  function commitOf(cites){
    for (var i = 0; cites && i < cites.length; i++) {
      var m = cites[i] && typeof cites[i].url === "string" && /\/blob\/([0-9a-f]{7,40})\//.exec(cites[i].url);
      if (m) return m[1].slice(0, 7);
    }
    return null;
  }
  // The spinner's count: whole seconds, and nothing in the first, so a quick answer shows none.
  function seconds(ms){ var n = Math.floor(ms / 1000); return n > 0 ? n + "s" : ""; }
```

Then add the six names to the `window.rbChat = { … }` object, after `placed: placed`:

```js
, lockupOf: lockupOf, command: command, picked: picked, tryRows: tryRows, commitOf: commitOf, seconds: seconds
```

- [ ] **Step 5: Run the tests to verify they pass.**

Run: `npm test`

Expected: every test passes, the eight new ones included.

- [ ] **Step 6: Commit.**

```bash
git add assets/chat.js test/chat.test.mjs
git commit -F - <<'EOF'
The chat knows its lockup, commands, picks and Try rows

The terminal the chat becomes needs a handful of pure answers before any of it is drawn: the lockup the page's header already writes, which words the command line keeps for itself, which row a bare number picks, which asks the model can back, and the commit and seconds a finished answer names. They sit with the widget's other pure parts, exported on rbChat and tested on the stub, together with every sentence they need in English and, as drafts for the translator, German.

Verified: npm test passes, including the eight new cases in chat.test.mjs.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

---

### Task 2: The model file gives the facts for the Try rows

**Files:**

- Modify: `assets/chat.js` (`function questions(cb)` and the `var qList = null, …` line)
- Test: `test/chat.test.mjs`

**Interfaces:**

- Consumes: `tryRows(facts, lang, random)` from Task 1.
- Produces: `qFacts` (page-section variable) `= { processes: string[], counts: {[type]: number} }`, set by the same single fetch `questions()` makes and read through `facts(cb)`, which calls `cb(qFacts)` once that fetch has resolved. It is `{ processes: [], counts: {} }` when the tag has no `data-questions` or the fetch fails.

- [ ] **Step 1: Write the failing test.** Append to `test/chat.test.mjs`:

```js
test("the one read of the model file also keeps its process names and how many of each type it holds", () => {
  const fn = src.slice(src.indexOf("function questions(cb)"), src.indexOf("function offerQuestions()"));
  assert.match(fn, /qFacts = \{ processes: entities\.filter\(function\(e\)\{ return e && e\.type === "process" && typeof e\.name === "string" && e\.name\.length > 0; \}\)\.map\(function\(e\)\{ return e\.name; \}\), counts: counts \};/, "the process names are not kept");
  assert.match(fn, /if \(e && typeof e\.type === "string"\) counts\[e\.type\] = \(counts\[e\.type\] \|\| 0\) \+ 1;/, "the counts per type are not kept");
  assert.match(src, /function facts\(cb\)\{ questions\(function\(\)\{ cb\(qFacts\); \}\); \}/, "facts() does not share the one fetch");
  assert.equal((src.match(/fetch\(QUESTIONS/g) || []).length, 1, "the model file is read twice");
});
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `npm test -- --test-name-pattern="one read of the model file"`

Expected: FAIL on "the process names are not kept".

- [ ] **Step 3: Implement.** In the page section, change `var qList = null, qFetch = null, qBox = null, qNext = false;` to:

```js
  var qList = null, qFetch = null, qBox = null, qNext = false, qFacts = { processes: [], counts: {} };
```

In `questions(cb)`, inside `return r.json().then(function(j){`, after the line `entities.forEach(function(e){ if (e && typeof e.id === "string") types[e.id] = e.type; });`, add:

```js
            // The same read gives the Try rows their facts: the processes by name, and how many
            // of each type the model holds, so a row never names what the model does not have.
            var counts = {};
            entities.forEach(function(e){ if (e && typeof e.type === "string") counts[e.type] = (counts[e.type] || 0) + 1; });
            qFacts = { processes: entities.filter(function(e){ return e && e.type === "process" && typeof e.name === "string" && e.name.length > 0; }).map(function(e){ return e.name; }), counts: counts };
```

Directly after the closing `}` of `function questions(cb)`, add:

```js
  // The Try rows' facts, from the one fetch questions() makes: a tag without data-questions, or
  // a read that failed, leaves them empty, and the rows fall back to the meta-model alone.
  function facts(cb){ questions(function(){ cb(qFacts); }); }
```

- [ ] **Step 4: Run the tests.**

Run: `npm test`

Expected: every test passes.

- [ ] **Step 5: Commit** with the subject `The model file read also gives the Try rows their facts`. The body says the read is the one the chips already make, same origin and after the panel opens, and that it now also keeps the process names and the count per type. `Verified:` names `npm test`.

---

### Task 3: The panel is a terminal window with a prompt

**Files:**

- Modify: `assets/chat.css` (the `.rbchat`, `.rbchat-head`, `.rbchat-form` rules and the new terminal rules)
- Modify: `assets/chat.js` (`build()`, `relabel()`, `tokenReader()`, `drawFigure()`)
- Create: `test/chat-terminal.test.mjs`
- Test: `test/chat.test.mjs`

**Interfaces:**

- Consumes: `strings(lang).bar`, `.prompt`, `.keys` from Task 1.
- Produces:
  - The DOM `section.rbchat > header.rbchat-head` holding `span.rbchat-dots` (three `i`), `h2#rbchat-title`, `button.rbchat-new`, `button.rbchat-close`.
  - `form.rbchat-form` holding `span.rbchat-p` (the `›`), `textarea`, and `button.rbchat-send` (the `↵`, shown only under a coarse pointer), then `p.rbchat-keys` after the form.
  - `keysLine(n)`, a page-section function that writes the keys line and shows `1-n pick` only when `n > 0`.
  - `menuRows`, a page-section `string[]` that is empty until Task 4.
  - `tokenReader(el)`, which now reads from `el` when given.
  - The browser test harness `test/chat-terminal.test.mjs`, with `open(tab)` and a stub `/chat` endpoint whose events and delay each test sets.

- [ ] **Step 1: Write the failing browser test.** Create `test/chat-terminal.test.mjs`:

```js
// The chat as a terminal, in Chromium: the window, the intro, a held answer, the menus and the
// command line, driven as a visitor drives them. The pure parts are in chat.test.mjs.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const asset = (f) => fs.readFileSync(path.join(PKG, "assets", f));

const BRAND = `<header><a class="brand" href="./"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"><rect x="2" y="6.75" width="10.5" height="10.5" rx="1.5"/><rect x="4.75" y="9.5" width="5" height="5" fill="currentColor" stroke="none"/><path d="M12.5 12 h4.5"/><rect x="17" y="9.5" width="5" height="5" fill="currentColor" stroke="none"/></svg><b>Company<span>Graph</span></b></a></header>`;
const page = (header) => `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><link rel="stylesheet" href="/chat.css"></head>
<body>${header}<p>A page.</p><script src="/chat.js" data-chat="/chat" data-model="/model/" data-questions="/model.json" defer></script></body></html>`;
const MODEL = { entities: [
  { id: "processes/answering", type: "process", name: "Answering" },
  { id: "kpis/a", type: "kpi", name: "A" }, { id: "kpis/b", type: "kpi", name: "B" }, { id: "kpis/c", type: "kpi", name: "C" },
  { id: "questions/owner", type: "question", name: "What is an owner?" },
  { id: "questions/chat", type: "question", name: "How does the chat answer a question?" },
  { id: "questions/rules", type: "question", name: "Which rules does every instance pass?" }
], edges: [] };
const sse = (events) => events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");

// What the stub /chat answers: set per test. `delay` holds the whole body back, `split` sends the
// first event at once and the rest after `delay`, as a slow stream does; `fail` drops the socket
// after the first event.
export const reply = { events: [], delay: 0, split: false, fail: false, asked: [] };
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (req.method === "POST" && url === "/chat") {
      let body = ""; req.on("data", (c) => body += c); req.on("end", () => {
        reply.asked.push(JSON.parse(body));
        res.writeHead(200, { "content-type": "text/event-stream" });
        const all = sse(reply.events), first = sse(reply.events.slice(0, 1)), rest = sse(reply.events.slice(1));
        if (reply.fail) { res.write(first); setTimeout(() => res.destroy(), reply.delay); return; }
        if (reply.split) { res.write(first); setTimeout(() => res.end(rest), reply.delay); return; }
        setTimeout(() => res.end(all), reply.delay);
      });
      return;
    }
    const files = { "/": ["text/html", page(BRAND)], "/bare": ["text/html", page("")], "/model.json": ["application/json", JSON.stringify(MODEL)],
      "/broken": ["text/html", page(BRAND).replace("/model.json", "/missing.json")],
      "/chat.js": ["text/javascript", asset("chat.js")], "/chat.css": ["text/css", asset("chat.css")] };
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": hit[0], "cache-control": "no-store" }); res.end(hit[1]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

export async function tab(address = "/", options = {}){
  const context = await browser.newContext(options);
  const p = await context.newPage();
  await p.goto(base + address);
  await p.waitForSelector(".rbchat-open", { state: "attached" });
  return { p, close: () => context.close() };
}
export async function open(p){ await p.click(".rbchat-open"); await p.waitForSelector("section.rbchat:not([hidden])"); }

test("the panel is a terminal window: three dots, the host in the bar, a prompt and the keys under it", async () => {
  const { p, close } = await tab();
  await open(p);
  const s = await p.evaluate(() => {
    const panel = document.querySelector("section.rbchat");
    return {
      dots: panel.querySelectorAll(".rbchat-head .rbchat-dots i").length,
      bar: panel.querySelector("#rbchat-title").textContent,
      label: panel.getAttribute("aria-label"),
      prompt: panel.querySelector(".rbchat-form .rbchat-p").textContent,
      keys: panel.querySelector(".rbchat-keys").textContent,
      mono: getComputedStyle(panel).fontFamily,
      send: getComputedStyle(panel.querySelector(".rbchat-send")).display
    };
  });
  assert.equal(s.dots, 3);
  assert.equal(s.bar, "ask · 127.0.0.1:" + new URL(base).port);
  assert.equal(s.label, "Ask the model");
  assert.equal(s.prompt, "›");
  assert.match(s.keys, /enter send/);
  assert.match(s.keys, /\/help/);
  assert.doesNotMatch(s.keys, /pick/, "the pick key shows with no menu standing");
  assert.match(s.mono, /Plex Mono/);
  assert.equal(s.send, "none", "the send button shows on a fine pointer");
  await close();
});

test("a touch screen keeps a send button beside the prompt", async () => {
  const { p, close } = await tab("/", { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  await open(p);
  assert.notEqual(await p.$eval(".rbchat-send", (b) => getComputedStyle(b).display), "none");
  await close();
});
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `npm test -- test/chat-terminal.test.mjs`

Expected: FAIL. `dots` is 0, and `.rbchat-p` is null, so `$eval` throws.

- [ ] **Step 3: Rebuild the head and the form.** In `build()`, replace the lines from `var head = el("header", "rbchat-head");` through `head.appendChild(title); head.appendChild(newBtn); head.appendChild(closeBtn);` so that the head is:

```js
    var head = el("header", "rbchat-head");
    // The terminal's title bar, as /cli/ draws its .term: three dots, then the page's host.
    var dots = el("span", "rbchat-dots"); dots.setAttribute("aria-hidden", "true");
    dots.appendChild(el("i")); dots.appendChild(el("i")); dots.appendChild(el("i"));
    title = el("h2"); title.id = "rbchat-title"; closeBtn = el("button", "rbchat-close"); closeBtn.type = "button"; closeBtn.addEventListener("click", close);
```

Keep the existing `newBtn` lines unchanged, then:

```js
    head.appendChild(dots); head.appendChild(title); head.appendChild(newBtn); head.appendChild(closeBtn);
```

Replace the form construction, from `var form = el("form", "rbchat-form");` through `form.appendChild(input); form.appendChild(sendBtn);`, with:

```js
    var form = el("form", "rbchat-form");
    // The command line: a prompt, the field, and a ↵ that only a touch screen shows, where the
    // keyboard's return key breaks a line rather than sending. It opens at one row and grows
    // to four as the visitor writes more.
    var p = el("span", "rbchat-p", "›"); p.setAttribute("aria-hidden", "true");
    input = el("textarea"); input.rows = 1; input.maxLength = LIMIT;
    input.addEventListener("keydown", function(e){ if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : send(); } });
    input.addEventListener("input", grow);
    sendBtn = el("button", "rbchat-send", "↵"); sendBtn.type = "submit";
    form.appendChild(p); form.appendChild(input); form.appendChild(sendBtn);
    keysEl = el("p", "rbchat-keys");
```

Change `panel.appendChild(head); panel.appendChild(notice); panel.appendChild(log); panel.appendChild(form);` to `panel.appendChild(head); panel.appendChild(notice); panel.appendChild(log); panel.appendChild(form); panel.appendChild(keysEl);`. The notice moves into the log in Task 4, not here.

Add `keysEl = null` to the `var messages = [], …` line, and add these beside `build()`:

```js
  // The rows a bare number picks: the menu standing last. Empty until a menu is drawn.
  var menuRows = [];
  function grow(){ input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 4 * parseFloat(getComputedStyle(input).lineHeight || 20)) + "px"; }
  // The keys line under the prompt, as the tooling prints its hints; the pick key only while a menu stands.
  function keysLine(){
    if (!keysEl) return;
    var k = strings(langNow()).keys;
    var parts = [k.send, k.last].concat(menuRows.length ? [k.pick.replace("{n}", menuRows.length)] : []).concat([k.help]);
    keysEl.textContent = parts.join("  ·  ");
  }
```

- [ ] **Step 4: Relabel the new parts.** In `relabel()`, replace `title.textContent = s.title;` with:

```js
    title.textContent = s.bar.replace("{host}", location.host); panel.setAttribute("aria-label", s.title);
```

Replace `input.placeholder = s.placeholder; sendBtn.textContent = s.send;` with:

```js
    input.placeholder = s.prompt; sendBtn.setAttribute("aria-label", s.send); keysLine();
```

In `build()`, change `panel.setAttribute("aria-labelledby", "rbchat-title");` to set nothing there: `relabel()` now sets `aria-label` to "Ask the model", because the visible bar reads `ask · host`.

- [ ] **Step 5: Let Mermaid read the panel's colors.** Change `tokenReader()` to take the element whose computed style to read:

```js
  function tokenReader(at){
    var root = getComputedStyle(at || document.documentElement), body = document.body ? getComputedStyle(document.body) : null;
    return function(name){ return name === "font" ? (body ? body.fontFamily : "") : root.getPropertyValue(name); };
  }
```

In `drawFigure(fig)`, change `m.initialize(mermaidConfig(tokenReader()));` to `m.initialize(mermaidConfig(tokenReader(fig.isConnected ? fig : null)));`. A figure inside the panel then reads the terminal's redefined tokens, and a page's own figure reads the page's.

- [ ] **Step 6: Write the terminal's CSS.** In `assets/chat.css`, replace the `.rbchat{…}` rule, the `.rbchat-grip{…}` rule, `.rbchat-head{…}`, `.rbchat-head h2{…}`, `.rbchat-close{…}`, `.rbchat-new{…}`, `.rbchat-form{…}`, `.rbchat-form textarea{…}`, `.rbchat-form textarea:focus-visible{…}`, `.rbchat-send{…}` and `.rbchat-send:disabled{…}` with the following. Keep every other rule, the notes (`[data-tip]::after`) included.

```css
/* The chat is the tooling's terminal, as companygraph.io's /cli/ draws its .term. Its colors are
   its own and not the page's, because a terminal is not a page surface. The page's tokens are
   defined again inside the panel from the terminal's, so every rule below that reads a token,
   and Mermaid, which reads them from the figure, draws in the terminal's colors with no second
   copy of each rule. Dark by default and light where the page is, as the tokens are. */
.rbchat{--t-bg:#0E141C;--t-top:#161E29;--t-dot:#2B3645;--t-ink:#D5DCE6;--t-dim:#8793A3;--t-accent:#7FA3D8;--t-strong:#FFFFFF;
  --t-good:#86C79A;--t-bad:#E0705E;--t-line:#243041;--t-sel:#18263A;--t-edge:#2B3645}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]) .rbchat{--t-bg:#FDFCF9;--t-top:#EFECE5;--t-dot:#D6D1C6;--t-ink:#1D232C;--t-dim:#676152;
  --t-accent:#3A6DA6;--t-strong:#0C0E13;--t-good:#2E7A45;--t-bad:#B3412E;--t-line:#E3DFD6;--t-sel:#E7ECF4;--t-edge:#CFC9BC}}
:root[data-theme="light"] .rbchat{--t-bg:#FDFCF9;--t-top:#EFECE5;--t-dot:#D6D1C6;--t-ink:#1D232C;--t-dim:#676152;
  --t-accent:#3A6DA6;--t-strong:#0C0E13;--t-good:#2E7A45;--t-bad:#B3412E;--t-line:#E3DFD6;--t-sel:#E7ECF4;--t-edge:#CFC9BC}
.rbchat{--ground:var(--t-bg);--raise:var(--t-top);--rule:var(--t-line);--ink:var(--t-ink);--dim:var(--t-dim);--c-mid:var(--t-accent);--c-firm:var(--t-strong);--press:var(--t-sel);
  position:fixed;right:max(1rem,env(safe-area-inset-right));bottom:max(1rem,env(safe-area-inset-bottom));z-index:61;
  width:min(31rem,calc(100vw - 2rem));height:min(46rem,calc(100vh - 2rem));display:flex;flex-direction:column;
  background:var(--t-bg);color:var(--t-ink);border:1.5px solid var(--t-edge);border-radius:12px;
  box-shadow:0 18px 60px var(--deck-drop);overflow:hidden;
  font-family:"Plex Mono",ui-monospace,Menlo,monospace;font-size:.8rem;line-height:1.55}
.rbchat[hidden]{display:none}
/* The corner that sizes the panel: the top left, the one corner that can move while the panel
   stays pinned to the bottom right. Drag, arrow keys when focused, double-click back to the default. */
.rbchat-grip{position:absolute;top:0;left:0;width:18px;height:18px;z-index:2;cursor:nwse-resize;
  border-top:2px solid var(--t-dot);border-left:2px solid var(--t-dot);border-top-left-radius:12px;background:none;touch-action:none}
.rbchat-grip:hover,.rbchat-grip.dragging{border-color:var(--t-accent)}
.rbchat-grip:focus-visible{outline:2px solid var(--t-accent);outline-offset:2px}
.rbchat-head{display:flex;align-items:center;gap:.45rem;padding:.6rem .8rem .6rem 1.2rem;background:var(--t-top)}
.rbchat-dots{display:flex;gap:.45rem}
.rbchat-dots i{width:.7rem;height:.7rem;border-radius:50%;background:var(--t-dot)}
.rbchat-head h2{margin:0 auto 0 .5rem;font:inherit;font-size:.78rem;font-weight:400;color:var(--t-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rbchat-close{border:0;background:none;color:var(--t-dim);font:inherit;font-size:1rem;line-height:1;cursor:pointer;padding:.15rem .4rem;border-radius:5px}
.rbchat-new{border:0;background:none;color:var(--t-dim);line-height:0;cursor:pointer;padding:.3rem;border-radius:5px;margin-left:auto;margin-right:.2rem}
.rbchat-new[hidden]{display:none}
.rbchat-new:hover,.rbchat-new:focus-visible,.rbchat-close:hover,.rbchat-close:focus-visible{color:var(--t-ink);outline:1.5px solid var(--t-accent);outline-offset:1px}
/* The command line: the prompt, the field in the terminal's strong ink, and the keys under it. */
.rbchat-form{display:flex;align-items:flex-start;gap:.6em;padding:.55rem 1.1rem .1rem;border-top:1px solid var(--t-line)}
.rbchat-p{color:var(--t-accent);font-weight:600;line-height:1.55;padding-top:.05rem}
.rbchat-form textarea{flex:1;min-width:0;resize:none;border:0;background:none;padding:0;margin:0;outline:none;
  font:inherit;font-size:.85rem;line-height:1.55;color:var(--t-strong);caret-color:var(--t-accent)}
.rbchat-form textarea::placeholder{color:var(--t-dim)}
.rbchat-form textarea:disabled{opacity:.6}
.rbchat-send{display:none;border:1px solid var(--t-line);background:none;color:var(--t-accent);font:inherit;font-size:.9rem;line-height:1;padding:.25rem .5rem;border-radius:5px;cursor:pointer}
.rbchat-send:disabled{opacity:.5;cursor:default}
@media (pointer:coarse){.rbchat-send{display:inline-block}}
.rbchat-keys{margin:0;padding:.2rem 1.1rem .55rem;font-size:.72rem;color:var(--t-dim);white-space:pre-wrap}
```

In the `@media (max-width:600px)` block, change `.rbchat{…}` to also drop the border radius and border it already drops, and keep `width:100vw!important;height:100dvh!important`. It needs no other change.

- [ ] **Step 7: Update the source assertions this changes.** In `test/chat.test.mjs`, the test "the new-conversation control is an arrow come back round with a note, not a bare plus" still passes unchanged. Run the suite. For each failure that names a rule this task replaced, change the assertion to the new rule rather than deleting it, and keep what it guards. For example, where a test matches `\.rbchat-new\[data-tip\]::after`, that rule is kept and still passes.

- [ ] **Step 8: Run the tests.**

Run: `npm test`

Expected: every test passes, the two in `chat-terminal.test.mjs` included.

- [ ] **Step 9: Commit** with the subject `The chat panel is drawn as the tooling's terminal`. The body says the window takes `/cli/`'s title bar, colors and Plex Mono. It says the page tokens are redefined inside the panel so existing rules and Mermaid follow, that the form becomes a prompt with a keys line, and that a `↵` shows only under a coarse pointer, which is a review-focus item for the owner. `Verified:` names `npm test` with the new file.

---

### Task 4: A fresh conversation opens on the intro

**Files:**

- Modify: `assets/chat.js` (new `intro(play)` and `rows()` in the page section; `open()`, `reset()`, `restore()`, `relabel()`, `offerQuestions()`, `canOffer()` callers; the notice)
- Modify: `assets/chat.css` (intro rules and menu rules)
- Test: `test/chat-terminal.test.mjs`, `test/chat.test.mjs`

**Interfaces:**

- Consumes: `lockupOf`, `tryRows`, `strings(lang).hello/helloHost/sub/tryLabel/prompt/from/next`, `facts(cb)`, `questions(cb)`, `spread`, `unasked`, `menuRows`, `keysLine()`.
- Produces:
  - `intro(play: boolean)` draws `div.rbchat-intro` as the log's first child, once per conversation, and returns nothing.
  - `menu(parent, items: [q, gets?][], start: number) → HTMLElement`, which draws `div.rbchat-menu` of `button.rbchat-row` (with `span.rbchat-n`, `span.rbchat-q`, and optional `span.rbchat-g`) and sets `menuRows`.
  - `spend()` adds `.rbchat-spent` to every menu in the log.

- [ ] **Step 1: Write the failing browser tests.** Append to `test/chat-terminal.test.mjs`:

```js
test("a fresh conversation opens on the lockup, the hello, the notice and six numbered rows", async () => {
  const { p, close } = await tab();
  await open(p);
  await p.waitForFunction(() => document.querySelectorAll(".rbchat-intro .rbchat-row").length === 6);
  const s = await p.evaluate(() => {
    const i = document.querySelector(".rbchat-log > .rbchat-intro");
    return {
      first: document.querySelector(".rbchat-log").firstElementChild === i,
      mark: !!i.querySelector(".rbchat-lock svg"),
      name: i.querySelector(".rbchat-lock .rbchat-name").textContent,
      hello: i.querySelector(".rbchat-hello").textContent,
      notice: i.querySelector(".rbchat-notice").textContent,
      rows: [...i.querySelectorAll(".rbchat-row")].map((r) => r.querySelector(".rbchat-n").textContent + " " + r.querySelector(".rbchat-q").textContent),
      gets: i.querySelectorAll(".rbchat-row .rbchat-g").length,
      keys: document.querySelector(".rbchat-keys").textContent
    };
  });
  assert.equal(s.first, true);
  assert.equal(s.mark, true);
  assert.equal(s.name, "CompanyGraph");
  assert.match(s.hello, /^Hello\. I answer from CompanyGraph’s model/);
  assert.match(s.notice, /Nothing is sent until you press send/);
  assert.deepEqual(s.rows.slice(0, 3), ["1 Show me the meta-model", "2 Walk me through the Answering process", "3 List the KPIs as a table"]);
  assert.equal(s.gets, 3, "only the Try rows say what comes back");
  assert.deepEqual(s.rows.slice(3).map((r) => r.slice(0, 2)), ["4 ", "5 ", "6 "]);
  assert.match(s.keys, /1-6 pick/);
  await close();
});

test("the intro plays in about a second, and a key finishes it at once", async () => {
  const { p, close } = await tab();
  await open(p);
  const early = await p.$eval(".rbchat-intro", (i) => i.classList.contains("rbchat-still"));
  assert.equal(early, false, "the intro did not play");
  await p.keyboard.press("a");
  assert.equal(await p.$eval(".rbchat-intro", (i) => i.classList.contains("rbchat-still")), true, "a key did not finish it");
  await close();
  const again = await tab();
  await open(again.p);
  await again.p.waitForFunction(() => document.querySelector(".rbchat-intro.rbchat-still"), null, { timeout: 2000 });
  await again.close();
});

test("reduced motion shows the intro finished from the start", async () => {
  const { p, close } = await tab("/", { reducedMotion: "reduce" });
  await open(p);
  assert.equal(await p.$eval(".rbchat-intro", (i) => i.classList.contains("rbchat-still")), true);
  await close();
});

test("a page without a brand names its host, and a failed model file leaves the meta-model row alone", async () => {
  const bare = await tab("/bare");
  await open(bare.p);
  await bare.p.waitForSelector(".rbchat-intro.rbchat-still, .rbchat-intro");
  assert.equal(await bare.p.$(".rbchat-lock"), null);
  assert.match(await bare.p.$eval(".rbchat-hello", (h) => h.textContent), /the model of 127\.0\.0\.1/);
  await bare.close();
  const broken = await tab("/broken");
  await open(broken.p);
  await broken.p.waitForFunction(() => document.querySelectorAll(".rbchat-intro .rbchat-row").length >= 1);
  assert.deepEqual(await broken.p.$$eval(".rbchat-intro .rbchat-row .rbchat-q", (q) => q.map((x) => x.textContent)), ["Show me the meta-model"]);
  await broken.close();
});

test("the intro follows a language switch, rows and keys included", async () => {
  const { p, close } = await tab();
  await open(p);
  await p.waitForFunction(() => document.querySelectorAll(".rbchat-intro .rbchat-row").length === 6);
  await p.evaluate(() => { document.documentElement.lang = "de"; });
  await p.waitForFunction(() => /^Hallo/.test(document.querySelector(".rbchat-hello").textContent));
  assert.equal(await p.$eval(".rbchat-intro .rbchat-row .rbchat-q", (q) => q.textContent), "Zeig mir das Meta-Modell");
  assert.match(await p.$eval(".rbchat-keys", (k) => k.textContent), /1-6 wählen/);
  await close();
});
```

- [ ] **Step 2: Run them to verify they fail.**

Run: `npm test -- test/chat-terminal.test.mjs`

Expected: the five new tests FAIL, because there is no `.rbchat-intro`.

- [ ] **Step 3: Draw the menus.** In the page section, beside `offerQuestions()`, add:

```js
  // A numbered menu, as the tooling prints one: each row a button that sends its question, the
  // number in the accent because a number is what the command line picks it by, and under a Try
  // row, dim, what comes back. The rows drawn last are the ones a bare number picks.
  function menu(parent, items, start){
    var m = el("div", "rbchat-menu");
    items.forEach(function(it, i){
      var b = el("button", "rbchat-row"); b.type = "button";
      b.appendChild(el("span", "rbchat-n", String(start + i + 1)));
      b.appendChild(el("span", "rbchat-q", it[0]));
      if (it[1]) b.appendChild(el("span", "rbchat-g", it[1]));
      b.addEventListener("click", function(){ input.value = it[0]; send(); });
      m.appendChild(b);
    });
    parent.appendChild(m);
    return m;
  }
  // A menu the conversation has moved past stays, dimmed, and its rows still send.
  function spend(){ var ms = log.querySelectorAll(".rbchat-menu"); for (var i = 0; i < ms.length; i++) ms[i].classList.add("rbchat-spent"); }
```

- [ ] **Step 4: Draw the intro.** Add:

```js
  // The intro: the page's lockup, a hello, the notice as a comment, then two numbered groups,
  // the asks the chat is built for with what each brings back, and three of the model's own
  // questions. It opens every conversation and stays at the top of the log once it starts.
  // Played on a fresh conversation, drawn finished on a restored one, a reduced-motion visitor
  // or a key pressed while it plays. The text is in the DOM whole from the start, so a screen
  // reader reads it whole; only the name is typed, and it carries its text as a label meanwhile.
  var introEl = null, introRun = 0;
  function intro(play){
    introRun++;
    var mine = introRun, s = strings(langNow()), lock = lockupOf(document);
    var host = location.host, name = lock ? (lock.first + lock.accent).trim() : "";
    introEl = el("div", "rbchat-intro");
    if (lock) {
      var l = el("div", "rbchat-lock"), mark = lock.mark.cloneNode(true), word = el("div", "rbchat-word"), n = el("span", "rbchat-name");
      mark.setAttribute("aria-hidden", "true");
      n.setAttribute("aria-label", name);
      n.appendChild(el("b", "rbchat-first")); n.appendChild(el("b", "rbchat-accent"));
      word.appendChild(n); word.appendChild(el("span", "rbchat-sub", s.sub.replace("{host}", host)));
      l.appendChild(mark); l.appendChild(word); introEl.appendChild(l);
    }
    var hello = el("p", "rbchat-hello"), lines = lock ? s.hello : s.helloHost;
    hello.appendChild(el("span", "rbchat-h1", lines[0].replace("{name}", name).replace("{host}", host)));
    hello.appendChild(el("br"));
    hello.appendChild(el("span", "rbchat-h2", lines[1]));
    introEl.appendChild(hello);
    notice = el("p", "rbchat-notice"); introEl.appendChild(notice); writeNotice();
    var groups = el("div", "rbchat-groups"); introEl.appendChild(groups);
    introEl.appendChild(el("p", "rbchat-prompt-line", "› " + s.prompt));
    log.insertBefore(introEl, log.firstChild);
    facts(function(f){
      questions(function(list){
        if (mine !== introRun || !introEl) return;
        var t = strings(langNow()), rows = tryRows(f, langNow());
        groups.appendChild(el("p", "rbchat-label", t.tryLabel));
        menu(groups, rows, 0);
        var picked = spread(list.filter(function(q){ return unasked([q.title], messages).length; }), 3).map(function(q){ return [q.title]; });
        if (picked.length) { groups.appendChild(el("p", "rbchat-label", t.from)); menu(groups, picked, rows.length); }
        // A restored conversation has moved past the intro: its menus are spent, and the rows a
        // number picks stay those of the menu after the last answer.
        if (messages.length) spendIntro(); else { menuRows = rows.concat(picked).map(function(r){ return r[0]; }); keysLine(); }
        if (!play || still()) finishIntro(); else playIntro(mine);
      });
    });
  }
  function spendIntro(){ var ms = introEl.querySelectorAll(".rbchat-menu"); for (var i = 0; i < ms.length; i++) ms[i].classList.add("rbchat-spent"); }
  function still(){ return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function finishIntro(){
    if (!introEl) return;
    introRun++;
    introEl.classList.add("rbchat-still");
    var lock = lockupOf(document);
    if (lock) { introEl.querySelector(".rbchat-first").textContent = lock.first; introEl.querySelector(".rbchat-accent").textContent = lock.accent; }
  }
  // About a second: the mark's parts 35 ms apart, the name typed at 22 ms a character, then
  // the hello, the notice and each row coming in 30 ms apart, as /cli/'s menu prints.
  function playIntro(mine){
    var steps = [], lock = lockupOf(document), at = 0;
    var parts = introEl.querySelectorAll(".rbchat-lock svg > *");
    for (var i = 0; i < parts.length; i++) (function(x){ steps.push([at += 35, function(){ x.classList.add("rbchat-on"); }]); })(parts[i]);
    if (lock) {
      var f = introEl.querySelector(".rbchat-first"), a = introEl.querySelector(".rbchat-accent");
      Array.from(lock.first).forEach(function(c){ steps.push([at += 22, function(){ f.textContent += c; }]); });
      Array.from(lock.accent).forEach(function(c){ steps.push([at += 22, function(){ a.textContent += c; }]); });
    }
    var ins = introEl.querySelectorAll(".rbchat-sub, .rbchat-h1, .rbchat-h2, .rbchat-notice, .rbchat-label, .rbchat-row, .rbchat-prompt-line");
    for (var j = 0; j < ins.length; j++) (function(x){ steps.push([at += 30, function(){ x.classList.add("rbchat-on"); }]); })(ins[j]);
    steps.push([at + 30, finishIntro]);
    steps.forEach(function(s){ setTimeout(function(){ if (mine === introRun) s[1](); }, s[0]); });
  }
```

- [ ] **Step 5: Wire it in.**
  - In `relabel()`, move the line that writes `notice.innerHTML` into its own function beside `relabel()`, `function writeNotice(){ if (!notice) return; var s = strings(langNow()); notice.innerHTML = esc(s.notice).replace("{host}", "<code>" + esc(HOST) + "</code>") + ' <a href="' + esc(s.privacyHref) + '">' + esc(s.privacy) + "</a>"; }`, and call `writeNotice();` where the line was. `intro()` calls `writeNotice()` too and never calls `relabel()`, so the two cannot call each other in a loop. Then add to `relabel()`:

    ```js
    if (introEl && introEl.classList.contains("rbchat-still")) { var keep_ = log.scrollTop; introEl.remove(); introEl = null; intro(false); log.scrollTop = keep_; }
    ```

    so a language switch redraws the finished intro in the new language. An intro still playing is finished first by that redraw, since `intro(false)` draws it still.
  - In `build()`, remove `notice = el("p", "rbchat-notice");` and `panel.appendChild(notice)`. The notice now lives in the intro.
  - `open()` becomes:

    ```js
    function open(){ hideQuestions(); if (!panel) build(); panel.hidden = false; button.hidden = true; if (!introEl) intro(!messages.length); settle(); input.focus(); keep(); if (messages.length) offerQuestions(); linkWaiting(); }
    ```

  - `reset()` becomes:

    ```js
    function reset(){ reading = null; messages = []; turns = []; log.innerHTML = ""; introEl = null; menuRows = []; qBox = null; busy = false; input.disabled = false; sendBtn.disabled = false; intro(true); input.focus(); keep(); }
    ```

  - In `restore()`, directly after `if (!panel) build();`, add `intro(false);`.
  - Any key in the field, or a pointer down in the log, finishes a playing intro. In `build()`, after the log's listeners, add:

    ```js
    ["pointerdown", "keydown"].forEach(function(k){ panel.addEventListener(k, function(){ if (introEl && !introEl.classList.contains("rbchat-still")) finishIntro(); }, true); });
    ```

  - `canOffer()` and `offerQuestions()` stay for the menu after an answer (Task 5). The empty-conversation chips are gone, because the intro's From-the-model group replaces them. So `offerQuestions()` returns at once when `!messages.length`: add `if (!messages.length) return;` as its first line.

- [ ] **Step 6: Write the intro and menu CSS.** Append to `assets/chat.css`:

```css
/* The intro: the lockup as /cli/ prints its banner, a hello, the notice as a comment, and the menus. */
.rbchat-intro{display:flex;flex-direction:column}
.rbchat-lock{display:flex;align-items:center;gap:1rem;margin:.2rem 0 .9rem .2rem}
.rbchat-lock svg{width:4em;height:4em;flex:0 0 auto;color:var(--t-accent)}
/* blust.ch's mark draws its plate and letters by class, as the header's own rules do. */
.rbchat-lock .plate{fill:var(--raise);stroke:var(--rule);stroke-width:1.5}
.rbchat-lock .rb{fill:var(--c-mid)}
.rbchat-word{display:flex;flex-direction:column;font-size:1.05rem;line-height:1.35}
.rbchat-first{color:var(--t-strong);font-weight:600}
.rbchat-accent{color:var(--t-accent);font-weight:600}
.rbchat-sub{font-size:.8rem;color:var(--t-dim)}
.rbchat-hello{margin:0 0 .5rem}
.rbchat-h2{color:var(--t-dim)}
.rbchat-notice{margin:0 0 .9rem;color:var(--t-dim)}
.rbchat-notice::before{content:"# "}
.rbchat-notice a{color:var(--t-accent)}
.rbchat-label{margin:.5rem 0 0;color:var(--t-dim)}
.rbchat-prompt-line{margin:.6rem 0 0;color:var(--t-strong)}
.rbchat-menu{display:flex;flex-direction:column}
.rbchat-row{all:unset;display:grid;grid-template-columns:1.6em 1fr;padding:.22rem .45rem;margin:0 -.45rem;border-radius:5px;cursor:pointer;overflow-wrap:anywhere}
.rbchat-row .rbchat-n{color:var(--t-accent)}
.rbchat-row .rbchat-q{color:var(--t-ink)}
.rbchat-row .rbchat-g{grid-column:2;color:var(--t-dim)}
.rbchat-row:hover,.rbchat-row:focus-visible{background:var(--t-sel)}
.rbchat-row:hover .rbchat-q{color:var(--t-accent)}
.rbchat-row:focus-visible{outline:1.5px solid var(--t-accent)}
.rbchat-spent .rbchat-row{opacity:.55}
/* Played: each piece stands still until its moment. Finished, or for reduced motion, all stand. */
.rbchat-intro:not(.rbchat-still) :is(.rbchat-sub,.rbchat-h1,.rbchat-h2,.rbchat-notice,.rbchat-label,.rbchat-row,.rbchat-prompt-line):not(.rbchat-on){opacity:0}
.rbchat-intro:not(.rbchat-still) .rbchat-lock svg > :not(.rbchat-on){opacity:0}
.rbchat-intro .rbchat-on{transition:opacity .2s ease}
@media (prefers-reduced-motion:reduce){.rbchat-intro *{transition:none!important;opacity:1!important}}
```

- [ ] **Step 7: Update the chip assertions.** In `test/chat.test.mjs`, change these to the new code rather than deleting them:
  - "a message clears the chips, and reopening or resetting an empty conversation offers a fresh three": the `open()` pattern becomes the new `open()` line, and the `reset()` pattern becomes `/introEl = null; menuRows = \[\]; qBox = null;.*intro\(true\);/`.
  - "open() clears any standing chips before asking for a fresh set": keep the `hideQuestions()`-first assertion, and assert `offerQuestions()` runs only `if (messages.length)`.
  - "a finished answer and a restored open panel offer the next three": unchanged here; Task 5 changes it.

- [ ] **Step 8: Run the tests.**

Run: `npm test`

Expected: every test passes.

- [ ] **Step 9: Commit** with the subject `A fresh conversation opens on the site's lockup and its asks`. `Verified:` names `npm test`, including the five intro cases in `chat-terminal.test.mjs`.

---

### Task 5: A question at the prompt, an answer held until whole

**Files:**

- Modify: `assets/chat.js` (`bubble()`, `refuse()`, `send()` with its `finish()`, `render()` and stream handler, `offerQuestions()`, `restore()`)
- Modify: `assets/chat.css` (turn, spinner, answer panel, lists, tables, cite line, refusal)
- Test: `test/chat-terminal.test.mjs`, `test/chat.test.mjs`

**Interfaces:**

- Consumes: `strings(lang).asking/answered/model/next`, `commitOf`, `seconds`, `menu()`, `spend()`, `citeLine()`.
- Produces:
  - A user turn: `div.rbchat-msg.rbchat-user` whose text is the question, with a `›` drawn by CSS.
  - The spinner: `p.rbchat-spin`, holding `span.rbchat-frame` and `span.rbchat-secs`.
  - The answer: `div.rbchat-msg.rbchat-assistant` holding `p.rbchat-done`, then `div.rbchat-body`, the figure, `p.rbchat-cites`, `p.rbchat-model`, then the next menu. It is appended only in `finish()`.
  - A refusal: `div.rbchat-msg.rbchat-refusal` whose text starts with `✗ `.

- [ ] **Step 1: Write the failing browser tests.** Append to `test/chat-terminal.test.mjs`:

```js
const ANSWER = [["text", { text: "An **owner** is the entity another is nested under.\n\n- one\n- two\n\n| Owner | Owns |\n| --- | --- |\n| process | step |" }],
  ["cite", { id: "concepts/owner", title: "owner", url: "https://github.com/o/r/blob/3f2a1c9e0b/concepts/owner.md" }],
  ["done", { model: null, spent: 1, dayLeft: 1 }]];

test("a slow answer shows only the spinner, counting, until the stream ends, then the whole answer at once", async () => {
  Object.assign(reply, { events: ANSWER, delay: 2600, split: true, fail: false });
  const { p, close } = await tab();
  await open(p);
  await p.fill("section.rbchat textarea", "What is an owner?");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".rbchat-spin");
  await p.waitForTimeout(1300);
  const mid = await p.evaluate(() => ({
    answer: document.querySelectorAll(".rbchat-assistant").length,
    secs: document.querySelector(".rbchat-spin .rbchat-secs").textContent,
    you: document.querySelector(".rbchat-user").textContent
  }));
  assert.equal(mid.answer, 0, "some of the answer showed before the stream ended");
  assert.equal(mid.secs, "1s");
  assert.equal(mid.you, "What is an owner?");
  await p.waitForSelector(".rbchat-assistant[aria-live]");
  const done = await p.evaluate(() => {
    const a = document.querySelector(".rbchat-assistant");
    return {
      spin: document.querySelectorAll(".rbchat-spin").length,
      head: a.querySelector(".rbchat-done").textContent,
      strong: !!a.querySelector(".rbchat-body strong"),
      list: a.querySelectorAll(".rbchat-body ul li").length,
      table: !!a.querySelector(".rbchat-body table"),
      cite: a.querySelector(".rbchat-cites a.rbchat-cite").textContent,
      model: a.querySelector(".rbchat-model").textContent,
      animations: document.getAnimations().filter((x) => a.contains(x.effect && x.effect.target)).length,
      face: getComputedStyle(a.querySelector(".rbchat-body p")).fontFamily,
      tableFace: getComputedStyle(a.querySelector(".rbchat-body table")).fontFamily
    };
  });
  assert.equal(done.spin, 0, "the spinner stayed");
  assert.equal(done.head, "✓ answered");
  assert.equal(done.strong, true);
  assert.equal(done.list, 2);
  assert.equal(done.table, true);
  assert.equal(done.cite, "owner");
  assert.match(done.model, /^model 3f2a1c9 · \d+s$/);
  assert.equal(done.animations, 0, "the answer animates");
  assert.match(done.face, /Instrument Sans/, "the answer's text is not in today's face");
  assert.match(done.tableFace, /Plex Mono/, "a table is not in mono");
  await close();
});

test("a stream that drops after some text leaves no answer, no spinner, and a ✗ network line", async () => {
  Object.assign(reply, { events: ANSWER, delay: 300, split: false, fail: true });
  const { p, close } = await tab();
  await open(p);
  await p.fill("section.rbchat textarea", "What is an owner?");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".rbchat-refusal");
  const s = await p.evaluate(() => ({
    refusal: document.querySelector(".rbchat-refusal").textContent,
    answer: document.querySelectorAll(".rbchat-assistant").length,
    spin: document.querySelectorAll(".rbchat-spin").length,
    enabled: !document.querySelector("section.rbchat textarea").disabled
  }));
  assert.match(s.refusal, /^✗ The chat could not be reached/);
  assert.equal(s.answer, 0);
  assert.equal(s.spin, 0);
  assert.equal(s.enabled, true);
  await close();
});

test("the next questions are a numbered menu, and the intro's menu dims once a question is sent", async () => {
  Object.assign(reply, { events: ANSWER, delay: 0, split: false, fail: false });
  const { p, close } = await tab();
  await open(p);
  await p.waitForFunction(() => document.querySelectorAll(".rbchat-intro .rbchat-row").length === 6);
  await p.click(".rbchat-intro .rbchat-row");
  await p.waitForSelector(".rbchat-assistant[aria-live]");
  await p.waitForSelector(".rbchat-next .rbchat-row");
  const s = await p.evaluate(() => ({
    spent: document.querySelectorAll(".rbchat-intro .rbchat-menu.rbchat-spent").length,
    next: [...document.querySelectorAll(".rbchat-next .rbchat-n")].map((n) => n.textContent),
    sent: document.querySelector(".rbchat-user").textContent
  }));
  assert.ok(s.spent >= 1, "the intro's menu did not dim");
  assert.deepEqual(s.next, ["1", "2", "3"]);
  assert.equal(s.sent, "Show me the meta-model");
  await close();
});
```

- [ ] **Step 2: Run them to verify they fail.**

Run: `npm test -- test/chat-terminal.test.mjs`

Expected: the three new tests FAIL. There is no `.rbchat-spin`, and the answer shows as it streams.

- [ ] **Step 3: Hold the answer until `finish()`.** In `send()`:
  - After `hideQuestions();`, add `spend();`.
  - Replace `var ans = bubble("assistant"), body = el("div", "rbchat-body"), wait = el("p", "rbchat-wait", s.waiting);` and the three lines after it (`ans.setAttribute("aria-busy", "true"); ans.appendChild(wait); ans.appendChild(body);`) with:

    ```js
    // Nothing of the answer is drawn until the stream ends: the spinner stands for the whole
    // wait, counting the seconds, and the finished answer arrives in one piece. The answer's
    // element is made now and filled as the stream comes, but joins the log only in finish().
    var ans = el("div", "rbchat-msg rbchat-assistant"), body = el("div", "rbchat-body"), t0 = Date.now();
    var wait = el("p", "rbchat-spin"), frame = el("span", "rbchat-frame", "|"), secs = el("span", "rbchat-secs");
    wait.appendChild(frame); wait.appendChild(document.createTextNode(" " + s.asking + "… ")); wait.appendChild(secs);
    log.appendChild(wait); log.scrollTop = log.scrollHeight;
    var spin = setInterval(function(){ frame.textContent = "|/-\\"[Math.floor((Date.now() - t0) / 90) % 4]; secs.textContent = seconds(Date.now() - t0); }, 90);
    ans.appendChild(body);
    ```

  - `render()` becomes `function render(){ body.innerHTML = md(acc); }`. It no longer scrolls, because the answer is not in the log yet.
  - In the `"text"` branch of the stream handler, change `if (wait.parentNode) wait.parentNode.removeChild(wait); acc += data.text || ""; render();` to `acc += data.text || "";`.
  - In the `"diagram"` branch, change `ans.insertBefore(fig, body.nextSibling);` to keep the figure until `finish()`: `fig = figure(data);`, and in `finish()` insert it (below). `figure(d)` calls `drawFigure`, which needs the figure in the document for its width, so move the `figure(data)` call into `finish()`: in the branch keep only `picture = data;`, the modal guard, and the removal of an old `fig`.
  - Every place that stops the request without an answer (`r.status !== 200`, the in-stream `error` with no text, `.catch`, and `finish()` with no text) calls `stopSpin()` first, and `ans.parentNode` checks keep working because `ans` is simply not in the log. Add beside `render()`:

    ```js
    function stopSpin(){ clearInterval(spin); if (wait.parentNode) wait.parentNode.removeChild(wait); }
    ```

    and in each of the four places replace `if (wait.parentNode) wait.parentNode.removeChild(wait);`, or add where it is missing, `stopSpin();`.
  - `finish()`, after its empty-answer branch and the `cut` line, draws the answer whole:

    ```js
      stopSpin();
      render();
      var head = el("p", "rbchat-done"); head.appendChild(el("span", "rbchat-tick", "✓")); head.appendChild(document.createTextNode(" " + strings(langNow()).answered));
      ans.insertBefore(head, body);
      if (picture) { fig = figure(picture); ans.insertBefore(fig, body.nextSibling); }
      log.appendChild(ans);
      ans.setAttribute("aria-live", "polite");
    ```

    Remove the old `ans.removeAttribute("aria-busy");`, `ans.setAttribute("aria-live", "polite");` and `render();` lines that this replaces. After the `citeLine` line, add:

    ```js
      var sha = commitOf(cites);
      if (sha) ans.appendChild(el("p", "rbchat-model", strings(langNow()).model.replace("{sha}", sha).replace("{secs}", String(Math.max(1, Math.round((Date.now() - t0) / 1000))))));
      log.scrollTop = log.scrollHeight;
    ```

  - Since `figure()` must now run after `ans` is in the log for its width, move `log.appendChild(ans);` above the `if (picture)` line. The order in `finish()` is: stopSpin, render, head, `log.appendChild(ans)`, figure, aria-live, nameLinks, linkQuestions, citeLine, model line.

- [ ] **Step 4: Draw the user turn and the refusal as the terminal does.** `bubble(role)` stays. The `›` of a user turn is CSS (`.rbchat-user::before`), so `textContent` stays exactly the question, which `turns` and the restore rely on. `refuse()` becomes:

```js
  function refuse(code, retryAt){ bubble("refusal").textContent = "✗ " + refusalText(code, retryAt, Date.now(), langNow()); keysLine(); if (panel && !panel.hidden && refocus(window)) input.focus(); }
```

- [ ] **Step 5: The next questions are a numbered menu.** In `offerQuestions()`, replace the chip construction, from `qBox = el("div", "rbchat-questions");` through `log.appendChild(qBox);`, with:

```js
      qBox = el("div", "rbchat-next");
      qBox.setAttribute("role", "group");
      qBox.setAttribute("aria-label", strings(langNow())[qNext ? "next" : "questions"]);
      qBox.appendChild(el("p", "rbchat-label", strings(langNow()).next));
      menu(qBox, picked.map(function(t){ return [t]; }), 0);
      log.appendChild(qBox);
      menuRows = picked.slice(); keysLine();
```

`hideQuestions()` is unchanged: it removes `qBox`, the wrapper. It still runs in `open()`, so a reopened panel draws a fresh three. In `send()`, remove the `hideQuestions();` call. A menu the conversation moved past stays in the log, dimmed by `spend()`, and its rows still send. Then set `qBox = null;` in `send()` where the call was, so the next answer's menu is drawn.

- [ ] **Step 6: The restore draws answers the same way.** In `restore()`, for an assistant turn, add the `p.rbchat-done` head before the body, and after the cite line add the `rbchat-model` line from `commitOf(cites)` without seconds. A restored turn has no timing, so use `strings(lang).model` with ` · {secs}s` cut: `.replace(/ · \{secs\}s$/, "")`.

- [ ] **Step 7: Write the CSS.** In `assets/chat.css`, replace `.rbchat-log{…}`, `.rbchat-msg{…}`, `.rbchat-user{…}`, `.rbchat-assistant{…}`, `.rbchat-refusal{…}`, `.rbchat-questions{…}`, `.rbchat-q{…}` and its two state rules, `.rbchat-body p{…}`, `.rbchat-body ul,.rbchat-body ol{…}`, `.rbchat-body li::marker{…}`, `.rbchat-body code{…}`, `.rbchat-body table{…}`, `.rbchat-body th,.rbchat-body td{…}`, `.rbchat-body th{…}`, `.rbchat-wait{…}` with its `::after`, its keyframes and its reduced-motion rule, `.rbchat-cites{…}`, and the `.rbchat-cites a.rbchat-cite` pair with:

```css
.rbchat-log{flex:1;overflow-y:auto;padding:1rem 1.1rem .5rem;display:flex;flex-direction:column;gap:.15rem}
.rbchat-msg{overflow-wrap:anywhere}
/* A question is a prompt line, in the terminal's strong ink. */
.rbchat-user{margin-top:1rem;color:var(--t-strong);white-space:pre-wrap}
.rbchat-user::before{content:"\203a  ";color:var(--t-accent)}
.rbchat-spin{margin:.3rem 0 0;color:var(--t-dim)}
.rbchat-frame{display:inline-block;width:1ch;color:var(--t-accent)}
/* A finished answer, as the tooling prints a finished step: a rail in the terminal's green and a
   head line with the tick. It has no animation of any kind. */
.rbchat-assistant{margin:.4rem 0 0 .35rem;padding:.05rem 0 .15rem .85rem;border-left:1.5px solid var(--t-good)}
.rbchat-done{margin:0 0 .35rem;color:var(--t-dim)}
.rbchat-tick{color:var(--t-good)}
/* The answer's text reads as it always has: the page's own face, dim as every page's prose is,
   a bold run in the strong ink and a link in the accent. Everything around it is mono. */
.rbchat-body{font-family:"Instrument Sans",ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:.95rem;line-height:1.5;color:var(--t-dim)}
.rbchat-body p{margin:0 0 .6rem}.rbchat-body p:last-child{margin-bottom:0}
.rbchat-body strong{color:var(--t-strong)}
.rbchat-body code{font-family:"Plex Mono",ui-monospace,Menlo,monospace;font-size:.88em;background:var(--t-sel);padding:.05em .3em;border-radius:4px;color:var(--t-ink)}
/* A list's marker is dim, never the accent: in the terminal an accent number is a row to pick. */
.rbchat-body ul,.rbchat-body ol{list-style:none;margin:0 0 .6rem;padding:0}
.rbchat-body ol{counter-reset:rbchat-n}
.rbchat-body li{display:grid;grid-template-columns:2.2ch 1fr;margin:.12rem 0}
.rbchat-body ul > li::before{content:"\00b7";color:var(--t-dim);font-family:"Plex Mono",ui-monospace,Menlo,monospace;font-weight:600}
.rbchat-body ol > li{counter-increment:rbchat-n}
.rbchat-body ol > li::before{content:counter(rbchat-n) ".";color:var(--t-dim);font-family:"Plex Mono",ui-monospace,Menlo,monospace}
/* A table stays in mono whatever the answer's face: columns are what a terminal draws best. */
.rbchat-body table{border-collapse:collapse;margin:.2rem 0 .6rem;display:block;overflow-x:auto;max-width:100%;
  font-family:"Plex Mono",ui-monospace,Menlo,monospace;font-size:.78rem;color:var(--t-ink)}
.rbchat-body th{color:var(--t-dim);font-weight:400;text-align:left;border-bottom:1px solid var(--t-line);padding:.15rem .8rem .25rem 0;vertical-align:top}
.rbchat-body td{padding:.2rem .8rem .2rem 0;vertical-align:top;border-bottom:1px dotted var(--t-line);overflow-wrap:break-word}
.rbchat-body tbody tr:hover td{background:var(--t-sel)}
.rbchat-body td:first-child a{white-space:nowrap}
.rbchat-body td br ~ *,.rbchat-body td li + li{color:var(--t-dim)}
.rbchat-body td ul,.rbchat-body td ol{margin:0;padding:0}
.rbchat-refusal{margin-top:.4rem;color:var(--t-bad)}
.rbchat-cites{margin:.5rem 0 0;font-size:.78rem;line-height:1.7;color:var(--t-dim)}
.rbchat-cites a.rbchat-cite{color:var(--t-accent);text-decoration:none;border-bottom:1px solid transparent}
.rbchat-cites a.rbchat-cite:hover,.rbchat-cites a.rbchat-cite:focus-visible{border-bottom-color:var(--t-accent)}
.rbchat-model{margin:.1rem 0 0;font-size:.74rem;color:var(--t-dim)}
```

A column of numbers aligned right: `md()` knows nothing of columns. In `finish()` and in `restore()`, after `render()`, add `numberColumns(body);`, defined beside `menu()`:

```js
  // A column whose cells are all numbers aligns right, in figures of one width.
  function numberColumns(root){
    var tables = root.querySelectorAll("table");
    for (var t = 0; t < tables.length; t++) {
      var rows = tables[t].querySelectorAll("tbody tr"), n = rows.length && rows[0].children.length;
      for (var c = 0; c < n; c++) {
        var all = rows.length > 0;
        for (var r = 0; r < rows.length && all; r++) all = /^[\d\s.,'’%+\-]+$/.test((rows[r].children[c] || {}).textContent || "");
        if (!all) continue;
        var cells = tables[t].querySelectorAll("tr > :nth-child(" + (c + 1) + ")");
        for (var k = 0; k < cells.length; k++) cells[k].classList.add("rbchat-num");
      }
    }
  }
```

and add to the CSS: `.rbchat-body .rbchat-num{text-align:right;font-variant-numeric:tabular-nums}`.

- [ ] **Step 8: Update the source assertions.** In `test/chat.test.mjs`:
  - "a message clears the chips, and reopening or resetting an empty conversation offers a fresh three": its `send()` assertion becomes `assert.match(sendFn, /spend\(\);/, …)` with the message "send() does not dim the menus it moves past".
  - "a chip's label is set with textContent, and activating it sends exactly its title" becomes an assertion on `menu()`: `/el\("span", "rbchat-q", it\[0\]\)/` and `/b\.addEventListener\("click", function\(\)\{ input\.value = it\[0\]; send\(\); \}\)/`.
  - "a finished answer and a restored open panel offer the next three" keeps both patterns. The first becomes `/if \(refocus\(window\)\) input\.focus\(\); offerQuestions\(\);\n/`, which is unchanged in `finish()`.
  - "the chip container carries an accessible name…" keeps `strings(...)` checks, and its `qBox.setAttribute("aria-label", …)` pattern matches the new line in `offerQuestions()`.
  - "a conversation has no length limit…" stays as is.
  - In `test/chat-place.test.mjs` and `test/chat-diagram.test.mjs`, the selectors `.rbchat-user`, `.rbchat-assistant` and `.rbchat-assistant[aria-live]` still hold. `chat-place` measures turns by `data-turn`, which `ans` still carries, and it only gains that once it is in the log.

- [ ] **Step 9: Run the tests.**

Run: `npm test`

Expected: every test passes, `chat-place`, `chat-diagram` and `chat-arrive` included.

- [ ] **Step 10: Commit** with the subject `An answer is held until whole and shown as a finished step`. `Verified:` names `npm test` and the three new cases.

---

### Task 6: The command line takes numbers, commands and ↑

**Files:**

- Modify: `assets/chat.js` (`send()` head, `build()` key handler, new `help()`)
- Test: `test/chat-terminal.test.mjs`, `test/chat.test.mjs`

**Interfaces:**

- Consumes: `command`, `picked`, `menuRows`, `keysLine`, `strings(lang).help`, `reset()`.
- Produces: `help()` prints `div.rbchat-help` into the log.

- [ ] **Step 1: Write the failing tests.** Append to `test/chat-terminal.test.mjs`:

```js
test("a bare number sends its row, /help prints the keys, /new starts over, and none of them is sent as typed", async () => {
  Object.assign(reply, { events: ANSWER, delay: 0, split: false, fail: false, asked: [] });
  const { p, close } = await tab();
  await open(p);
  await p.waitForFunction(() => document.querySelectorAll(".rbchat-intro .rbchat-row").length === 6);
  await p.fill("section.rbchat textarea", "/help");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".rbchat-help");
  assert.equal(reply.asked.length, 0, "/help reached the host");
  assert.match(await p.$eval(".rbchat-help", (h) => h.textContent), /\/new/);
  await p.fill("section.rbchat textarea", "1");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".rbchat-assistant[aria-live]");
  assert.equal(reply.asked.length, 1);
  assert.equal(reply.asked[0].messages.at(-1).content, "Show me the meta-model", "the number was sent instead of its row");
  await p.fill("section.rbchat textarea", "/new");
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => !document.querySelector(".rbchat-user") && document.querySelector(".rbchat-intro"));
  assert.equal(reply.asked.length, 1, "/new reached the host");
  await close();
});

test("a number with no such row is sent as typed, and ↑ brings back the last question", async () => {
  Object.assign(reply, { events: ANSWER, delay: 0, split: false, fail: false, asked: [] });
  const { p, close } = await tab();
  await open(p);
  await p.waitForFunction(() => document.querySelectorAll(".rbchat-intro .rbchat-row").length === 6);
  await p.fill("section.rbchat textarea", "9");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".rbchat-assistant[aria-live]");
  assert.equal(reply.asked[0].messages.at(-1).content, "9");
  await p.focus("section.rbchat textarea");
  await p.keyboard.press("ArrowUp");
  assert.equal(await p.$eval("section.rbchat textarea", (t) => t.value), "9");
  await close();
});
```

- [ ] **Step 2: Run them to verify they fail.**

Run: `npm test -- test/chat-terminal.test.mjs`

Expected: FAIL. `/help` is sent to the stub, so `reply.asked.length` is 1.

- [ ] **Step 3: Implement.** At the top of `send()`, replace `var text = input.value.trim();` and `if (!text) return;` with:

```js
    var typed = input.value.trim();
    if (!typed) return;
    // The command line's own words never reach the host and never become a turn.
    var cmd = command(typed);
    if (cmd === "new") { input.value = ""; reset(); return; }
    if (cmd === "help") { input.value = ""; help(); return; }
    var text = picked(typed, menuRows);
```

Add beside `menu()`:

```js
  // The keys and commands, printed into the log as the tooling prints its usage.
  function help(){
    var s = strings(langNow()), box = el("div", "rbchat-help");
    s.help.forEach(function(r){
      var line = el("p");
      line.appendChild(el("span", "rbchat-help-k", r[0].replace("{n}", String(menuRows.length || 1))));
      line.appendChild(el("span", "rbchat-help-d", r[1]));
      box.appendChild(line);
    });
    log.appendChild(box); log.scrollTop = log.scrollHeight;
  }
```

In `build()`'s `keydown` handler on `input`, before the Enter branch, add:

```js
      if (e.key === "ArrowUp" && !input.value) {
        for (var i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") { e.preventDefault(); input.value = messages[i].content; grow(); return; }
      }
```

CSS: append

```css
.rbchat-help{margin:.4rem 0 0;color:var(--t-dim)}
.rbchat-help p{margin:0;display:grid;grid-template-columns:7ch 1fr}
.rbchat-help-k{color:var(--t-accent)}
```

- [ ] **Step 4: Add a source guard.** Append to `test/chat.test.mjs`:

```js
test("the command line's words are settled before anything is pushed or sent", () => {
  const fn = src.slice(src.indexOf("function send(){"), src.indexOf("fetch(ENDPOINT,"));
  const cmdAt = fn.indexOf("var cmd = command(typed);"), pushAt = fn.indexOf("messages.push(");
  assert.ok(cmdAt > 0 && pushAt > cmdAt, "a command is pushed as a message before it is recognized");
  assert.match(fn, /var text = picked\(typed, menuRows\);/, "a number does not pick from the standing menu");
});
```

- [ ] **Step 5: Run the tests.**

Run: `npm test`

Expected: every test passes.

- [ ] **Step 6: Commit** with the subject `The chat's command line takes numbers, /new, /clear, /help and ↑`. `Verified:` names `npm test`.

---

### Task 7: The README, the checks and the rendering review

**Files:**

- Modify: `README.md` (the chat paragraphs, lines that begin "A site takes the chat" and "A tag may also carry `data-questions`")

- [ ] **Step 1: Rewrite the two chat paragraphs** in the prose register of `conventions/WRITING.md`, one line per paragraph and forward-written. They say:
  - The panel is drawn as the tooling's terminal, with colors of its own and the page's tokens redefined inside it.
  - A fresh conversation opens on the lockup the header's `a.brand` already writes, so a site adds nothing to the tag.
  - The Try rows come from the same model file `data-questions` names, from its processes and from a kind it holds three of.
  - The model's own questions follow them, and the intro stays at the top of the log.
  - An answer is held until the stream ends and shown whole, with no animation, while the spinner counts the seconds.
  - A bare number picks from the menu standing last, and `/new`, `/clear`, `/help` and ↑ stay in the browser.
  - On a touch screen, a `↵` beside the prompt sends.

  Keep every sentence that is still true: the one runtime call, the seven turns, the cite line's icon and GitHub mark, the pictures and Expand, the refusal's moment. Write no count or version.

- [ ] **Step 2: Run every check.**

Run: `npm test && sh conventions/conventions-check && sh conventions/conventions-format`

Expected: every test passes and both convention scripts exit 0. Check each exit code on its own, without piping to `tail`.

- [ ] **Step 3: The rendering review.** Build a scratch page for each site from its own header markup, as `test/chat-terminal.test.mjs` builds `/`, with blust.ch's `rb` mark, companygraph.io's mark, and guestgraph.io's mark. Serve it with the stub, and screenshot the panel in dark and light, in English and German, at 1280×900 and at 390×844. Take shots of a fresh conversation, a restored one, an answer with a diagram (from `test/fixtures/diagrams.json`), one with a table, and a refusal. Look at each shot once. Fix what is visibly wrong, then look once more.

- [ ] **Step 4: Commit** with the subject `The README says what the terminal chat does`. `Verified:` names the three commands and the rendering review's shots.

- [ ] **Step 5: Push and open the pull request.**

```bash
git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push
```

The spec's pull request, #182, is this branch. Retitle it `The chat is drawn as the CLI's terminal`, and rewrite its body in the git register as prose, with no headings or bullets. The body opens with what the owner asked for, then says what changed for a visitor, then what a site does to take it: re-pin and `npm run design`, nothing else. It names the `↵` under a coarse pointer as the one addition beyond the spec. It ends with `Release notes to write at tagging: …` naming this as a minor, then `Verified:`, then the 🤖 line. Then stop. Merging, the tag and the three re-pins each wait for the owner's word.
