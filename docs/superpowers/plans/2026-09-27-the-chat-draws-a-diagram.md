# The chat draws a diagram implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The chat widget draws the picture a `diagram` event carries under its answer, with Mermaid vendored in the `chat` group and fetched from the site's own origin only when a first picture arrives, each node a link to where its entity lives.

**Architecture:** `assets/mermaid.min.js` (Mermaid 12.0.0, unmodified) and its license join the `chat` sync group. `assets/chat.js` gains three pure helpers on `rbChat` (`mermaidConfig`, `nodeElement`, `diagramCaption`) and, on the page, a lazy loader, a `figure` per picture, the event in `send`, the picture in the stored turn and in `restore`, a redraw on theme change, a relabel on language change, and full screen with Escape. `assets/chat.css` styles the figure from the tokens.

**Tech Stack:** plain browser JavaScript (ES5 style, as `chat.js` is), `node:test`, Playwright's Chromium (already a devDependency and installed in CI). No dependency is added; Mermaid is a vendored file, as d3 is.

**Spec:** `companygraph/chat-server`, branch `an-answer-can-show-a-diagram`, `docs/superpowers/specs/2026-09-27-an-answer-can-show-a-diagram-design.md`, section 5. The event's data is `{ shape, title, mermaid, nodes: [{ node, id, title, type }], omitted }` (its section 3).

## Global Constraints

- **One repository, one branch.** The worktree exists: `~/git/robertblust/design-the-chat-draws-a-diagram`, branch `the-chat-draws-a-diagram`, carrying this plan. The clone at `~/git/robertblust/design` stays on `main` and is never edited.
- **`export PATH=/opt/homebrew/bin:$PATH`** before any `node`, `npm`, `npx`, `gh` or `sh conventions/…` command. A push names the helper: `git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push -u origin the-chat-draws-a-diagram`. Run `npm ci` once in the fresh worktree, and `npx playwright install chromium` if Chromium is missing.
- **Every command's exit code is read on its own**, never through a pipe into `tail` or `head`.
- **A single test file runs as** `node --test test/<name>.test.mjs`; the whole suite as `npm test`. `sh conventions/conventions-check` and `sh conventions/conventions-format check` exit 0 before every commit.
- **Mermaid is 12.0.0's `dist/mermaid.min.js`, unmodified**, sha256 `28fca7ae6ebc7ed7bb63bde63136a74bfef14f296a57e403657eeb8b32836073`; its `LICENSE` is sha256 `ec9fb67dcb25eccc416ed56e1aab819222c805a2a4bfe4cb19e7556bf2ffde80`. The bundle sets `globalThis.mermaid` and carries its dependencies' notices inline.
- **Mermaid is configured** `startOnLoad: false`, `securityLevel: "strict"`, `theme: "base"`, `useMaxWidth: false` for flowchart and class, colors from the tokens. A node's border is `--c-mid`, since every link in the family is.
- **Nodes are found** by the group id Mermaid 12 gives them, `…-flowchart-n<k>-<i>` and `…-classId-n<k>-<i>`, and nowhere but `nodeElement`. Each is wrapped in an SVG `<a href>` to `link(MODEL, id)`, `aria-label` its title.
- **No request leaves the page's origin.** Mermaid is fetched from `new URL("mermaid.min.js", tag.src)`, once per page, only when a `diagram` event arrives or a stored turn carries one.
- **Words:** English `Concepts`, `Process`, `Connections`, `Open full screen`, `Close full screen`, `The diagram could not be drawn; this is its source.`; German `Konzepte`, `Prozess`, `Verbindungen`, `Im Vollbild öffnen`, `Vollbild schliessen`, `Das Diagramm konnte nicht gezeichnet werden; dies ist seine Quelle.` The German stands as the translator's draft under the file's existing comment; `Im Vollbild öffnen` is the stage's approved string. Swiss Standard German, ss and never ß.
- **Commit messages** in the git register of `conventions/WRITING.md`: a sentence subject under seventy characters with no prefix and no trailing period, one to three prose paragraphs with no headers, no bullets and no plan task numbers, a `Verified:` line naming what ran, then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. After every commit, `git log -1 --format='[%s]'` shows the subject alone. The pull request body in the same register, ending `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **A finding against a committed task is a new commit**, never an amend.
- **Nothing is merged, tagged, synced into a site or deleted by an agent.** `package.json`'s version is not moved; the release and the three sites' re-pins are the owner's.
- **No count or version of something that still moves** in any prose or comment.
- **Comments in code say why**, in the register of the surrounding file.

### Rulings the plan makes where the spec is silent

- **The picture is drawn when its event arrives**, into a figure after the answer's body, so it is ready by the time the text ends; the streaming render replaces only the body and never touches the figure. A second event in one message replaces the first figure.
- **Full screen** is a class on the figure (`rbchat-diagram-open`), fixed over the page; Escape closes it before it would close the panel.
- **A failed fetch is not remembered**: the next picture tries again.
- **An unknown shape** captions with the title alone, so a fourth shape a later host draws still reads.

## Review Focus

1. **A title holding markup** (`<b>`, quotes, `-->`): drawn as its text, no element made from it. Task 3's `odd` fixture.
2. **The vendored script missing or failing**: the source in a `<pre>` under one sentence, the answer standing. Task 3 serves no `mermaid.min.js`.
3. **A theme switched after the picture is drawn**: redrawn in the new colors. Task 3 switches to light and reads a node's fill.
4. **A conversation read back from the tab**: the picture drawn again from the stored turn. Task 3 reloads.
5. **An answer with no picture**: Mermaid never fetched, and no request leaves the origin with one. Task 3 records every request.

---

### Task 1: Mermaid travels in the chat group with its license

**Files:**

- Create: `assets/mermaid.min.js`, `assets/mermaid.LICENSE.txt`
- Modify: `lib/groups.mjs`, `NOTICE`, `README.md`
- Test: `test/groups.test.mjs`, `test/assets.test.mjs`

**Interfaces:**

- Produces: the `chat` group's destinations `chat.css`, `chat.js`, `mermaid.LICENSE.txt`, `mermaid.min.js`, `octicons.LICENSE.txt`; `mermaid.min.js` beside `chat.js` in every site that takes the group.

- [ ] **Step 1: Write the failing tests**

In `test/groups.test.mjs`, the chat test becomes:

```js
test("the chat group carries the widget's script and stylesheet, the Octicon's license, and Mermaid with its license", () => {
  const dests = GROUPS.chat.map(([, to]) => to).sort();
  assert.deepEqual(dests, ["chat.css", "chat.js", "mermaid.LICENSE.txt", "mermaid.min.js", "octicons.LICENSE.txt"]);
});
```

and the `covered` map in `every third-party file travels in a group beside its license` gains:

```js
    "mermaid.min.js": "mermaid.LICENSE.txt",
```

Append to `test/assets.test.mjs` (add `import crypto from "node:crypto";` to its imports):

```js
// The vendored Mermaid is the release's own file, byte for byte: its license and NOTICE speak for
// that file, and a copy edited here would be a fork nobody reviews.
test("mermaid.min.js is Mermaid 12.0.0's dist file, unmodified, and its license is the upstream text", () => {
  const sha = (rel) => crypto.createHash("sha256").update(fs.readFileSync(path.join(PKG, rel))).digest("hex");
  assert.equal(sha("assets/mermaid.min.js"), "28fca7ae6ebc7ed7bb63bde63136a74bfef14f296a57e403657eeb8b32836073");
  assert.equal(sha("assets/mermaid.LICENSE.txt"), "ec9fb67dcb25eccc416ed56e1aab819222c805a2a4bfe4cb19e7556bf2ffde80");
  assert.match(asset("assets/mermaid.min.js"), /globalThis\["mermaid"\]/);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test test/groups.test.mjs test/assets.test.mjs`

Expected: FAIL, the chat group's destinations and `ENOENT` for `assets/mermaid.min.js`.

- [ ] **Step 3: Vendor the two files**

```bash
curl -sf -o assets/mermaid.min.js https://cdn.jsdelivr.net/npm/mermaid@12.0.0/dist/mermaid.min.js
curl -sf -o assets/mermaid.LICENSE.txt https://cdn.jsdelivr.net/npm/mermaid@12.0.0/LICENSE
shasum -a 256 assets/mermaid.min.js assets/mermaid.LICENSE.txt
```

Expected: the two hashes of the Global Constraints.

- [ ] **Step 4: The group, the NOTICE, the README**

In `lib/groups.mjs`, the `chat` group becomes:

```js
  chat: [
    ["assets/chat.js",  "chat.js"],
    ["assets/chat.css", "chat.css"],
    // chat.js inlines GitHub's Octicon mark, and the MIT license asks for its notice in every copy.
    ["assets/octicons.LICENSE.txt", "octicons.LICENSE.txt"],
    // The picture under an answer. chat.js fetches it from beside itself only when a first
    // picture arrives, so a page pays for it only once a visitor asks for one.
    ["assets/mermaid.min.js", "mermaid.min.js"],
    ["assets/mermaid.LICENSE.txt", "mermaid.LICENSE.txt"],
  ],
```

In `NOTICE`, after the d3 entry:

```text
- assets/mermaid.min.js, unmodified
  Upstream: Mermaid 12.0.0, dist/mermaid.min.js — https://mermaid.js.org
  Copyright (c) 2014 - 2022 Knut Sveidqvist
  License: MIT, in assets/mermaid.LICENSE.txt. The bundle carries the notices of the packages
  it includes inline, under "Bundled license information".
```

In `README.md`, in the paragraph that begins `A site takes the chat by naming \`chat\``, replace `` `npm run design` then copies the two files, `chat.js` and `chat.css`, into the site. `` with `` `npm run design` then copies `chat.js`, `chat.css`, `mermaid.min.js` and the two license files into the site. ``

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test test/groups.test.mjs test/assets.test.mjs`, then `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
sh conventions/conventions-check && sh conventions/conventions-format check
git add assets/mermaid.min.js assets/mermaid.LICENSE.txt lib/groups.mjs NOTICE README.md test/groups.test.mjs test/assets.test.mjs
git commit -F - <<'EOF'
Mermaid travels in the chat group beside its license

The chat is to draw the picture a host builds from the model's edges, and a picture drawn from a third-party host would send every visitor who asks for one to that host. Mermaid 12.0.0's own bundle is vendored unmodified in the chat group, as d3 is in the stage group, with its license beside it and its entry in NOTICE, and a test holds both files to the release's bytes.

Verified: node --test test/groups.test.mjs test/assets.test.mjs and npm test pass; conventions-check and conventions-format check pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

---

### Task 2: The picture's pure parts

**Files:**

- Modify: `assets/chat.js` (strings; three helpers; `window.rbChat`)
- Test: `test/chat.test.mjs`

**Interfaces:**

- Produces: `rbChat.mermaidConfig(read) → config` where `read(name)` returns a token's value or, for `"font"`, the body's font family; `rbChat.nodeElement(svg, node) → Element | null`; `rbChat.diagramCaption(d, lang) → string`; `strings(lang).diagram` with keys `concepts`, `process`, `neighborhood`, `expand`, `shut`, `failed`.

- [ ] **Step 1: Write the failing tests**

In `test/chat.test.mjs`, extend the destructuring from `globalThis.rbChat` with `mermaidConfig, nodeElement, diagramCaption`, and append:

```js
test("Mermaid is configured strict, from the tokens, and never from an empty one", () => {
  const tokens = { "--ground": "#FAF9F5", "--raise": "#F2F0EA", "--ink": "#16181D", "--dim": "#5F6058", "--c-mid": "#3A6DA6", "--press": "#E7ECF4", font: '"Instrument Sans", sans-serif' };
  const c = mermaidConfig((n) => tokens[n]);
  assert.deepEqual([c.startOnLoad, c.securityLevel, c.theme], [false, "strict", "base"]);
  assert.deepEqual([c.flowchart.useMaxWidth, c.class.useMaxWidth], [false, false]);
  assert.deepEqual([c.themeVariables.primaryColor, c.themeVariables.primaryTextColor, c.themeVariables.primaryBorderColor, c.themeVariables.lineColor, c.themeVariables.background], ["#F2F0EA", "#16181D", "#3A6DA6", "#5F6058", "#FAF9F5"]);
  assert.equal(c.fontFamily, '"Instrument Sans", sans-serif');
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

test("the caption names the shape in the page's language, then what it was drawn of", () => {
  assert.equal(diagramCaption({ shape: "process", title: "Delivery" }, "en"), "Process · Delivery");
  assert.equal(diagramCaption({ shape: "concepts", title: null }, "en"), "Concepts");
  assert.equal(diagramCaption({ shape: "neighborhood", title: "Claim" }, "de"), "Verbindungen · Claim");
  assert.equal(diagramCaption({ shape: "later", title: "X" }, "en"), "X");
  for (const lang of ["en", "de"]) assert.deepEqual(Object.keys(strings(lang).diagram).sort(), ["concepts", "expand", "failed", "neighborhood", "process", "shut"]);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test test/chat.test.mjs`

Expected: FAIL, `mermaidConfig is not a function`.

- [ ] **Step 3: The strings**

In `STRINGS.en`, after the line `github: "{title} on GitHub", commit: "commit {sha}",`:

```js
      diagram: { concepts: "Concepts", process: "Process", neighborhood: "Connections", expand: "Open full screen", shut: "Close full screen", failed: "The diagram could not be drawn; this is its source." },
```

In `STRINGS.de`, after the line `github: "{title} auf GitHub", commit: "Commit {sha}",`:

```js
      diagram: { concepts: "Konzepte", process: "Prozess", neighborhood: "Verbindungen", expand: "Im Vollbild öffnen", shut: "Vollbild schliessen", failed: "Das Diagramm konnte nicht gezeichnet werden; dies ist seine Quelle." },
```

- [ ] **Step 4: The three helpers**

Directly before the line `window.rbChat = { md: md, …`, insert:

```js
  // ─── The picture ──────────────────────────────────────────────────────────────────────────
  // A diagram the host drew arrives whole, as Mermaid source with each node named by the entity
  // it is, and is drawn under the answer by Mermaid, vendored beside this file. The colors are
  // the tokens', read when the picture is drawn, so it follows the theme; a token a page does
  // not define falls back to the dark theme's value, since Mermaid derives its shades from
  // real colors and an empty one would stop the drawing.
  var DARK = { "--ground": "#0C0E13", "--raise": "#171A21", "--ink": "#EFEDE8", "--dim": "#8A8B86", "--c-mid": "#7FA3D8", "--press": "#1b2231" };
  function mermaidConfig(read){
    function v(name){ var x = String(read(name) || "").trim(); return x || DARK[name]; }
    var font = String(read("font") || "").trim() || "ui-sans-serif, system-ui, sans-serif";
    return {
      startOnLoad: false, securityLevel: "strict", theme: "base", fontFamily: font,
      // At its own size in a box that scrolls: fitted to a bubble, a wide picture's words shrink
      // below reading.
      flowchart: { useMaxWidth: false }, class: { useMaxWidth: false },
      themeVariables: {
        fontFamily: font, fontSize: "13px", background: v("--ground"),
        primaryColor: v("--raise"), mainBkg: v("--raise"), secondaryColor: v("--press"), tertiaryColor: v("--ground"),
        primaryTextColor: v("--ink"), textColor: v("--ink"), nodeTextColor: v("--ink"), classText: v("--ink"),
        // A node is a link, and every link in the family is --c-mid.
        primaryBorderColor: v("--c-mid"), nodeBorder: v("--c-mid"), lineColor: v("--dim"), edgeLabelBackground: v("--ground")
      }
    };
  }
  // Where Mermaid put a node in its SVG: a group whose id ends in the node's name and a number,
  // after `classId` in a class diagram and `flowchart` in a flowchart. The one place that knows
  // it, so a Mermaid release that names them otherwise is fixed here and nowhere else.
  function nodeElement(svg, node){
    if (!svg || !/^n\d+$/.test(String(node))) return null;
    var re = new RegExp("-(?:classId|flowchart)-" + node + "-\\d+$"), all = svg.querySelectorAll("g[id]");
    for (var i = 0; i < all.length; i++) if (re.test(all[i].id)) return all[i];
    return null;
  }
  // The caption: the shape in the page's language, then what the host drew it of.
  function diagramCaption(d, lang){
    var name = strings(lang).diagram[d && d.shape] || "";
    return d && d.title ? (name ? name + " · " + d.title : d.title) : name;
  }

```

and at the end of the `window.rbChat = { … }` object, after `spread: spread`, add `, mermaidConfig: mermaidConfig, nodeElement: nodeElement, diagramCaption: diagramCaption`. In the header comment's list of `rbChat` members, after the `rbChat.spread` line, add:

```js
//   rbChat.mermaidConfig(read)         Mermaid's configuration, from the tokens `read` gives
//   rbChat.nodeElement(svg, node)      the group Mermaid drew a node as, or null
//   rbChat.diagramCaption(d, lang)     a picture's caption in the page's language
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test test/chat.test.mjs`

Expected: PASS, every test in the file, the three new ones among them.

- [ ] **Step 6: Commit**

```bash
sh conventions/conventions-check && sh conventions/conventions-format check
git add assets/chat.js test/chat.test.mjs
git commit -F - <<'EOF'
The widget knows how a picture is configured, found and captioned

Before the widget draws a picture it needs three answers that hold in Node: Mermaid's configuration, strict and colored from the tokens with the dark theme's values where a page defines none; which group of Mermaid's SVG is a given node, known in one place so a Mermaid release that renames them is fixed there; and the caption, the shape in the page's language followed by what it was drawn of. The words stand in both languages, the German as the translator's draft.

Verified: node --test test/chat.test.mjs passes; conventions-check and conventions-format check pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

---

### Task 3: The picture on the page

**Files:**

- Modify: `assets/chat.js` (the header comment, the loader, the figure, `send`, `restore`, `relabel`, Escape, the theme observer)
- Modify: `assets/chat.css`
- Modify: `README.md` (one sentence)
- Create: `test/fixtures/diagrams.json`
- Test: `test/chat-diagram.test.mjs`

**Interfaces:**

- Consumes: `mermaidConfig`, `nodeElement`, `diagramCaption`, `strings(lang).diagram` from Task 2; `link(model, id)`, `el`, `langNow`, `tag`, `MODEL`, `keep` already in `chat.js`; the `diagram` event.
- Produces: `<figure class="rbchat-diagram">` with `figcaption > span`, `button.rbchat-diagram-full`, `div.rbchat-diagram-box`; a stored turn's `diagram` field.

- [ ] **Step 1: The fixtures**

Create `test/fixtures/diagrams.json`: `process` and `concepts` are what the host's `diagram` tool answers over the meta-model's worked example; `odd` carries a label with every escaped character, in the host's escaping.

```json
{
 "process": {
  "shape": "process",
  "title": "Delivery",
  "mermaid": "flowchart LR\n  n0[\"Specify<br/>Backend Engineer\"]\n  n1[\"Build<br/>Backend Engineer, Reviewer\"]\n  n2[\"Release<br/>Reviewer\"]\n  n0 -->|\"Reviewer\"| n1\n  n1 -->|\"Reviewer\"| n2",
  "nodes": [
   { "node": "n0", "id": "processes/delivery/phases/specify", "title": "Specify", "type": "phase" },
   { "node": "n1", "id": "processes/delivery/phases/build", "title": "Build", "type": "phase" },
   { "node": "n2", "id": "processes/delivery/phases/release", "title": "Release", "type": "phase" }
  ],
  "omitted": 0
 },
 "odd": {
  "shape": "neighborhood",
  "title": "Loop",
  "mermaid": "flowchart LR\n  n0[\"A #quot;quoted#quot; #lt;b#gt;bold#lt;/b#gt; #35;1 --#gt; [x] {y} (z) | pipe ; semi & amp<br/>Exec #lt;A#gt;\"]\n  n1[\"B\"]\n  n0 -->|\"gate #quot;x#quot; #lt;y#gt; #35;z | w\"| n1\n  more[\"+3: Evidence.Skill\"]\n  n0 -.- more",
  "nodes": [
   { "node": "n0", "id": "concepts/odd", "title": "odd", "type": "concept" },
   { "node": "n1", "id": "concepts/b", "title": "B", "type": "concept" }
  ],
  "omitted": 3
 },
 "concepts": {
  "shape": "concepts",
  "title": null,
  "mermaid": "classDiagram\n  class n0[\"Billing period\"]\n  class n1[\"Contract\"]\n  class n2[\"Credit note\"]\n  class n3[\"Customer\"]\n  class n4[\"Invoice\"]\n  class n5[\"Invoice line\"]\n  class n6[\"Pricing rule\"]\n  class n7[\"Usage record\"]\n  n1 --> n3 : one, signing customer\n  n1 --> n3 : maybe one, paying customer\n  n1 --> n6 : one to many, terms\n  n2 --> n4 : one, corrected invoice\n  n2 --> n5 : one to many, lines\n  n4 --> n0 : one\n  n4 --> n3 : one, billed customer\n  n4 --> n5 : one to many, lines\n  n5 --> n6 : one, rule\n  n5 --> n7 : many, usage read\n  n7 --> n1 : one",
  "nodes": [
   { "node": "n0", "id": "concepts/billing-period", "title": "Billing period", "type": "concept" },
   { "node": "n1", "id": "concepts/contract", "title": "Contract", "type": "concept" },
   { "node": "n2", "id": "concepts/credit-note", "title": "Credit note", "type": "concept" },
   { "node": "n3", "id": "concepts/customer", "title": "Customer", "type": "concept" },
   { "node": "n4", "id": "concepts/invoice", "title": "Invoice", "type": "concept" },
   { "node": "n5", "id": "concepts/invoice-line", "title": "Invoice line", "type": "concept" },
   { "node": "n6", "id": "concepts/pricing-rule", "title": "Pricing rule", "type": "concept" },
   { "node": "n7", "id": "concepts/usage-record", "title": "Usage record", "type": "concept" }
  ],
  "omitted": 0
 }
}
```

- [ ] **Step 2: Write the failing tests**

Create `test/chat-diagram.test.mjs`:

```js
// The widget drawing a picture, in Chromium: a page carrying chat.js is served with a chat
// endpoint that answers from a script, so what is tested is the widget and Mermaid, the real
// vendored file, and nothing of a chat host. The pure parts are in chat.test.mjs.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const asset = (f) => fs.readFileSync(path.join(PKG, "assets", f));
const PICTURES = JSON.parse(fs.readFileSync(path.join(PKG, "test", "fixtures", "diagrams.json"), "utf8"));

const PAGE = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><style>
:root{--ground:#0C0E13;--raise:#171A21;--rule:#232833;--ink:#EFEDE8;--dim:#8A8B86;--c-mid:#7FA3D8;--press:#1b2231;--deck-drop:rgba(0,0,0,.4)}
:root[data-theme="light"]{--ground:#FAF9F5;--raise:#F2F0EA;--rule:#DFDCD3;--ink:#16181D;--dim:#5F6058;--c-mid:#3A6DA6;--press:#E7ECF4}
body{background:var(--ground);color:var(--ink)}
</style><link rel="stylesheet" href="/chat.css"></head><body><p>A page.</p>
<script src="/chat.js" data-chat="/chat" data-model="/model/" defer></script></body></html>`;

// What the next POST answers, and whether the vendored script is served at all.
const state = { events: [], mermaid: true };
const sse = (events) => events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (req.method === "POST" && url === "/chat") { res.writeHead(200, { "content-type": "text/event-stream" }); res.end(sse(state.events)); return; }
    const files = { "/": ["text/html", PAGE], "/chat.js": ["text/javascript", asset("chat.js")], "/chat.css": ["text/css", asset("chat.css")] };
    if (state.mermaid) files["/mermaid.min.js"] = ["text/javascript", asset("mermaid.min.js")];
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": hit[0] }); res.end(hit[1]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

// A fresh tab, the panel opened, one question asked and its answer finished.
async function asked(events, { mermaid = true } = {}) {
  state.events = [...events, ["done", { model: null, spent: 1, dayLeft: 1 }]];
  state.mermaid = mermaid;
  const page = await browser.newPage();
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(base + "/");
  await page.click(".rbchat-open");
  await page.fill(".rbchat-form textarea", "show me");
  await page.press(".rbchat-form textarea", "Enter");
  await page.waitForSelector(".rbchat-assistant[aria-live]");
  return { page, requests };
}
const nodeFill = (page) => page.$eval(".rbchat-diagram svg a", (a) => getComputedStyle(a.querySelector("rect, path, polygon")).fill);

test("a picture is drawn under its answer, captioned, each node a link to where it lives", async () => {
  const p = PICTURES.process;
  const { page, requests } = await asked([["diagram", p], ["text", { text: "Delivery runs in three phases." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  assert.equal(await page.textContent(".rbchat-diagram figcaption span"), "Process · Delivery");
  for (const n of p.nodes) {
    const href = await page.$eval(`.rbchat-diagram svg a[aria-label="${n.title}"]`, (a) => a.getAttribute("href"));
    assert.equal(href, `/model/?stage=expanded#${n.id}`);
  }
  assert.equal(requests.filter((u) => u.endsWith("/mermaid.min.js")).length, 1);
  assert.ok(requests.every((u) => u.startsWith(base)), `only the page's own origin: ${requests.filter((u) => !u.startsWith(base))}`);
  await page.close();
});

test("an answer with no picture never fetches Mermaid", async () => {
  const { page, requests } = await asked([["text", { text: "No picture." }]]);
  assert.equal(await page.$(".rbchat-diagram"), null);
  assert.ok(!requests.some((u) => u.endsWith("/mermaid.min.js")));
  await page.close();
});

test("a title holding markup and arrows is drawn as its text", async () => {
  const { page } = await asked([["diagram", PICTURES.odd], ["text", { text: "Loop." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  const text = await page.textContent('.rbchat-diagram svg a[aria-label="odd"]');
  assert.ok(text.includes('A "quoted" <b>bold</b> #1 --> [x]'), text);
  assert.equal(await page.$(".rbchat-diagram svg b"), null, "no element was made from a title");
  await page.close();
});

test("the picture is drawn again in the theme the page switches to", async () => {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]]);
  await page.waitForSelector(".rbchat-diagram svg a");
  assert.equal(await nodeFill(page), "rgb(23, 26, 33)");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.waitForFunction(() => { const a = document.querySelector(".rbchat-diagram svg a"); return a && getComputedStyle(a.querySelector("rect, path, polygon")).fill === "rgb(242, 240, 234)"; });
  await page.close();
});

test("a caption and its control follow the page's language", async () => {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]]);
  await page.evaluate(() => { document.documentElement.lang = "de"; });
  await page.waitForFunction(() => document.querySelector(".rbchat-diagram figcaption span").textContent === "Prozess · Delivery");
  assert.equal(await page.getAttribute(".rbchat-diagram-full", "aria-label"), "Im Vollbild öffnen");
  await page.close();
});

test("full screen opens and Escape closes it, leaving the panel open", async () => {
  const { page } = await asked([["diagram", PICTURES.concepts], ["text", { text: "Concepts." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  assert.equal(await page.textContent(".rbchat-diagram figcaption span"), "Concepts");
  await page.click(".rbchat-diagram-full");
  assert.ok(await page.$(".rbchat-diagram.rbchat-diagram-open"));
  await page.keyboard.press("Escape");
  assert.equal(await page.$(".rbchat-diagram.rbchat-diagram-open"), null);
  assert.equal(await page.$eval(".rbchat", (p) => p.hidden), false);
  await page.close();
});

test("a conversation read back from the tab draws its picture again", async () => {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  await page.reload();
  await page.waitForSelector(".rbchat-diagram svg a");
  assert.equal(await page.textContent(".rbchat-diagram figcaption span"), "Process · Delivery");
  await page.close();
});

test("where Mermaid cannot be fetched, the source stands in with a sentence", async () => {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]], { mermaid: false });
  await page.waitForSelector(".rbchat-diagram pre");
  assert.equal(await page.textContent(".rbchat-diagram pre"), PICTURES.process.mermaid);
  assert.match(await page.textContent(".rbchat-diagram-failed"), /could not be drawn/);
  await page.close();
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `node --test --test-timeout=10000 test/chat-diagram.test.mjs`

Expected: FAIL: the first test times out waiting for `.rbchat-diagram svg`; `an answer with no picture never fetches Mermaid` passes already, which is right, since it guards what must not change.

- [ ] **Step 4: The loader, the figure, the theme observer**

In `assets/chat.js`, after the line `var qList = null, qFetch = null, qBox = null, qNext = false;`:

```js
  // Mermaid is fetched from the folder this file came from, the site's own, the first time a
  // picture arrives and never before, so a visitor who asks for none never downloads it and no
  // host but the page's own is asked. `figures` are the pictures drawn, redrawn when the theme
  // changes and relabeled when the language does.
  var mermaidLoad = null, figures = [], drawCount = 0;
```

Directly before `function el(tagName, cls, text){`:

```js
  function loadMermaid(){
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (!mermaidLoad) mermaidLoad = new Promise(function(resolve, reject){
      var s = document.createElement("script");
      s.src = new URL("mermaid.min.js", tag.src).href;
      s.onload = function(){ if (window.mermaid) resolve(window.mermaid); else reject(new Error("mermaid.min.js set no mermaid")); };
      // A failed fetch is not remembered: the next picture tries again.
      s.onerror = function(){ mermaidLoad = null; reject(new Error("mermaid.min.js did not load")); };
      document.head.appendChild(s);
    });
    return mermaidLoad;
  }
  function tokenReader(){
    var root = getComputedStyle(document.documentElement), body = document.body ? getComputedStyle(document.body) : null;
    return function(name){ return name === "font" ? (body ? body.fontFamily : "") : root.getPropertyValue(name); };
  }
  // Each node becomes a link to where the cite line would send it. Mermaid's own click lines
  // are off under `strict`, and the host writes none; the widget links from `nodes`.
  function drawFigure(fig){
    var box = fig.querySelector(".rbchat-diagram-box"), d = fig.rbDiagram, id = "rbchat-diagram-" + (++drawCount);
    loadMermaid().then(function(m){
      m.initialize(mermaidConfig(tokenReader()));
      return m.render(id, d.mermaid);
    }).then(function(out){
      box.innerHTML = out.svg;
      var svg = box.querySelector("svg");
      (d.nodes || []).forEach(function(n){
        var g = nodeElement(svg, n.node);
        if (!g || !n.id) return;
        var a = document.createElementNS("http://www.w3.org/2000/svg", "a");
        a.setAttribute("href", link(MODEL, n.id));
        a.setAttribute("aria-label", n.title || n.id);
        g.parentNode.insertBefore(a, g); a.appendChild(g);
      });
    }).catch(function(){
      // Mermaid leaves what it could not finish in the body; it goes, and the source stands in.
      [id, "d" + id].forEach(function(x){ var left = document.getElementById(x); if (left && !box.contains(left)) left.parentNode.removeChild(left); });
      box.textContent = "";
      box.appendChild(el("p", "rbchat-diagram-failed", strings(langNow()).diagram.failed));
      box.appendChild(el("pre", null, d.mermaid));
    });
  }
  function labelFigure(fig){
    var s = strings(langNow()).diagram, open = fig.classList.contains("rbchat-diagram-open"), b = fig.querySelector(".rbchat-diagram-full");
    fig.querySelector("figcaption span").textContent = diagramCaption(fig.rbDiagram, langNow());
    b.textContent = open ? "×" : "⤢"; b.setAttribute("aria-label", open ? s.shut : s.expand); b.setAttribute("data-tip", open ? s.shut : s.expand);
  }
  function toggleFigure(fig){ fig.classList.toggle("rbchat-diagram-open"); labelFigure(fig); }
  function figure(d){
    var fig = el("figure", "rbchat-diagram"), cap = el("figcaption"), full = el("button", "rbchat-diagram-full");
    full.type = "button"; full.addEventListener("click", function(){ toggleFigure(fig); });
    cap.appendChild(el("span")); cap.appendChild(full);
    fig.appendChild(cap); fig.appendChild(el("div", "rbchat-diagram-box"));
    fig.rbDiagram = d;
    figures = figures.filter(function(f){ return document.documentElement.contains(f); });
    figures.push(fig);
    labelFigure(fig); drawFigure(fig);
    return fig;
  }
  if (window.MutationObserver) new MutationObserver(function(){
    figures = figures.filter(function(f){ return document.documentElement.contains(f); });
    figures.forEach(drawFigure);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

```

- [ ] **Step 5: Language, Escape**

In `relabel`, directly after `if (!panel) return;`:

```js
    figures.forEach(labelFigure);
```

In `build`, replace

```js
    document.addEventListener("keydown", function(e){ if (e.key === "Escape" && !panel.hidden) close(); });
```

with

```js
    // A picture opened full screen takes Escape first, and the panel stays open behind it.
    document.addEventListener("keydown", function(e){
      if (e.key !== "Escape" || panel.hidden) return;
      var open = panel.querySelector(".rbchat-diagram-open");
      if (open) toggleFigure(open); else close();
    });
```

- [ ] **Step 6: The event, the stored turn, the read-back**

In `send`, the line `var acc = "", cites = [], names = [], cut = false;` becomes:

```js
    var acc = "", cites = [], names = [], cut = false, picture = null, fig = null;
```

In its `readEvents` callback, before `else if (name === "done") cut = !!data.cut;`:

```js
          else if (name === "diagram" && data && typeof data.mermaid === "string") {
            // The last picture a message brings is the one drawn: a second replaces the first.
            picture = data;
            if (fig && fig.parentNode) fig.parentNode.removeChild(fig);
            fig = figure(data);
            ans.insertBefore(fig, body.nextSibling);
          }
```

In `finish`, the line `turns.push({ role: "assistant", content: acc, cites: cites, names: names });` becomes:

```js
      turns.push({ role: "assistant", content: acc, cites: cites, names: names, diagram: picture });
```

In `restore`, the lines

```js
      linkQuestions(body);
      if (cites.length) ans.appendChild(citeLine(cites, MODEL, ICON, document));
      messages.push({ role: "assistant", content: t.content });
      turns.push({ role: "assistant", content: t.content, cites: cites, names: t.names || [] });
```

become

```js
      linkQuestions(body);
      if (t.diagram) ans.appendChild(figure(t.diagram));
      if (cites.length) ans.appendChild(citeLine(cites, MODEL, ICON, document));
      messages.push({ role: "assistant", content: t.content });
      turns.push({ role: "assistant", content: t.content, cites: cites, names: t.names || [], diagram: t.diagram || null });
```

In the file's header comment, after the paragraph that ends `…so text that looks like markup stays text.`, add:

```js
// A picture the host drew arrives as its own event and is drawn under the answer by Mermaid,
// fetched from beside this file the first time one arrives; each node links where the cite
// line would, and the picture is kept with its answer in the tab like the rest of the turn.
```

- [ ] **Step 7: The stylesheet**

Append to `assets/chat.css`:

```css
/* A picture the host drew, under the answer and above the cite line: at its own size in a box
   that scrolls, captioned in the page's language, each node a link. Opened full screen it
   covers the page and the panel stays behind it. */
.rbchat-diagram{margin:.6rem 0 0;padding:.5rem 0 0;border-top:1px solid var(--rule)}
.rbchat-diagram figcaption{display:flex;align-items:center;gap:.5rem;margin:0 0 .4rem;font-size:.8rem;color:var(--dim)}
.rbchat-diagram figcaption span{margin-right:auto}
.rbchat-diagram-full{position:relative;border:0;background:none;color:var(--dim);font:inherit;font-size:1rem;line-height:1;cursor:pointer;padding:.2rem .35rem;border-radius:6px}
.rbchat-diagram-full:hover,.rbchat-diagram-full:focus-visible{color:var(--ink);outline:2px solid var(--c-mid);outline-offset:2px}
.rbchat-diagram-full[data-tip]::after{content:attr(data-tip);position:absolute;top:calc(100% + .45rem);right:0;z-index:3;
  white-space:nowrap;pointer-events:none;opacity:0;transform:translateY(-2px);transition:opacity .12s ease,transform .12s ease;
  background:var(--raise);border:1px solid var(--rule);border-radius:6px;padding:.42rem .62rem;
  box-shadow:0 6px 18px var(--deck-drop);font-size:.8rem;line-height:1.35;color:var(--ink)}
.rbchat-diagram-full:hover::after,.rbchat-diagram-full:focus-visible::after{opacity:1;transform:none}
@media (hover:none){.rbchat-diagram-full[data-tip]::after{display:none}}
@media (prefers-reduced-motion:reduce){.rbchat-diagram-full[data-tip]::after{transition:none}}
.rbchat-diagram-box{overflow:auto;max-width:100%}
.rbchat-diagram-box svg{display:block;max-width:none;height:auto}
.rbchat-diagram-box a{cursor:pointer}
.rbchat-diagram-box a:hover :is(rect,polygon,path),.rbchat-diagram-box a:focus-visible :is(rect,polygon,path){stroke-width:2px}
.rbchat-diagram-failed{margin:0;font-size:.85rem}
.rbchat-diagram-box pre{margin:.3rem 0 0;white-space:pre-wrap;font-family:"Plex Mono",ui-monospace,Menlo,monospace;font-size:.78rem;color:var(--ink)}
.rbchat-diagram-open{position:fixed;inset:0;z-index:70;margin:0;padding:1rem max(1rem,env(safe-area-inset-right)) 1rem max(1rem,env(safe-area-inset-left));
  background:var(--ground);border:0;display:flex;flex-direction:column}
.rbchat-diagram-open .rbchat-diagram-box{flex:1}
```

- [ ] **Step 8: The README**

In `README.md`, at the end of the paragraph that begins `A site takes the chat by naming \`chat\``, add one sentence: `A picture the chat host drew arrives as its own event and is drawn under the answer by the vendored Mermaid, fetched from beside \`chat.js\` only when a first picture arrives, each node a link to where its entity lives; where the script cannot be fetched, the picture's source stands in.`

- [ ] **Step 9: Run the tests to see them pass**

Run: `node --test test/chat-diagram.test.mjs test/chat.test.mjs`, then `npm test`

Expected: PASS, the eight browser tests and every test in the suite.

- [ ] **Step 10: Commit**

```bash
sh conventions/conventions-check && sh conventions/conventions-format check
git add assets/chat.js assets/chat.css README.md test/fixtures/diagrams.json test/chat-diagram.test.mjs
git commit -F - <<'EOF'
A picture the chat host drew is drawn under its answer

A visitor who asked to see how the concepts relate got a table of titles. The widget now draws the picture a diagram event carries, under the answer and above the cite line, with Mermaid fetched from beside chat.js the first time a picture arrives and never from another host, each node a link to where the cite line would send it, the caption in the page's language, a full screen that Escape closes before the panel, a redraw when the theme changes, and the picture kept with its answer in the tab. Where Mermaid cannot be fetched, the source stands in under one sentence.

A browser test drives the widget against a scripted chat endpoint with the vendored file, including a title holding markup and arrows, which is drawn as its text.

Verified: node --test test/chat-diagram.test.mjs test/chat.test.mjs and npm test pass; conventions-check and conventions-format check pass.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
git log -1 --format='[%s]'
```

---

### Task 4: Seen in both themes, then the pull request

**Files:** none committed.

- [ ] **Step 1: Screenshots for the owner**

With the server of `test/chat-diagram.test.mjs` as the model, write a scratch script outside the repository that opens the page at 1280×800, asks for the `concepts` and the `process` fixtures, and saves a screenshot of the panel in dark and in light, and one of the `concepts` picture full screen: five images. Read each image. Look for: text in `--ink` on `--raise` nodes, `--c-mid` borders, lines in `--dim`, the caption dim and small, nothing clipped by the bubble except what the box scrolls.

- [ ] **Step 2: The whole suite once more**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Push and open the pull request**

```bash
git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push -u origin the-chat-draws-a-diagram
gh pr list --repo robertblust/design --state merged --limit 2 --json number
```

Read both bodies with `gh pr view <n> --repo robertblust/design --json body` and write this one in their register: prose, no headings, no bullets, no checkboxes. It says the gap (the chat said it cannot paint); what changed (Mermaid vendored in the chat group, the figure, the links, the theme, the fallback); the cost downstream: a **minor** release (synced files change and a file is added to a group, no site edit is needed for the build), then each of the three sites re-pins with `npm run design`, and each site's README License paragraph names `mermaid.min.js` among the files it does not write, guestgraph.io's list of the chat group's files too; the widget draws nothing until the chat host sends the event, so the order of releases does not matter to a visitor; the five screenshots described in words; a line `Release notes to write at tagging: …`; `Verified:` naming what ran; the `🤖 Generated with [Claude Code](https://claude.com/claude-code)` line.

```bash
gh pr create --repo robertblust/design --base main --head the-chat-draws-a-diagram --title "A picture the chat host drew is drawn under its answer" --body-file <file>
```

- [ ] **Step 4: Stop**

Report the pull request's URL, the test counts, and the five screenshots' paths. Do not merge, tag or re-pin.
