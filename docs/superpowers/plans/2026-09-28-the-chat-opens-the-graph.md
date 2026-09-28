# The chat opens the graph — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A link into the model from the chat opens the model page's own graph in a dialog over the page. An answer sits on a card. The banner names the meta-model's core and the model's commit.

**Architecture:** Two repositories.

- **`companygraph/meta-model`:** its instance export gains a `core` field, read from the vendored core's `manifest.json`.
- **`robertblust/design`:** four changes.
  - The model page learns an `embed` mode, set by `theme-boot.js`. In it, `stage.css` shows only the expanded stage, and `stage.js` keeps its history in memory and talks to its parent through two same-origin messages.
  - `chat.js` opens that page in an iframe inside a dialog of its own, lazily, and moves an open graph's focus by message.
  - `chat.css` sets the answer on a card.
  - The intro reads the versions from the model file the widget already fetches.

Each site then takes both releases in one pull request.

**Tech Stack:** Plain browser JavaScript, CSS, `node --test`, and Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-09-28-the-chat-opens-the-graph-design.md`. Read it first. The prototype the owner chose from is https://claude.ai/artifact/PiPyVYAovQs27YDX33i3uq, variant B; its code is throwaway.

## Global constraints

- **Environment:** export `/opt/homebrew/bin` onto `PATH` before `node`, `npm` or `gh`. Push with `git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push`.
- **Worktrees:** every branch lives in a sibling worktree named `<repo>-<branch>`. The design work is on `the-chat-opens-the-graph` in `~/git/robertblust/design-the-chat-opens-the-graph`, which holds the spec. The meta-model work is on `the-export-names-its-core` in `~/git/companygraph/meta-model-the-export-names-its-core`.
- **Checks:**
  - design: `npm test` passes, and so do `sh conventions/conventions-check` and `sh conventions/conventions-format`.
  - meta-model: every `test:*` script in its `package.json` and `npm run verify` pass.
- **Language:** shipped text is American English, which `test/spelling.test.mjs` holds. Every sentence the widget writes is in `STRINGS`, in `en` and in `de`; German strings are drafts for the translator.
- **Nothing reaches the chat host before send.** The graph's iframe and messages are same-origin only, and the parent ignores a message whose `event.origin` is not `location.origin`.
- **Tab history:** the embedded stage never writes to the tab's history. Opening, moving and closing the graph leaves `history.length` of the chat page unchanged, and Back afterwards goes where it went before.
- **Released surfaces:** the existing ids and classes the sites' checks and the tests select stay: `section.rbchat`, `.rbchat-assistant[aria-live]`, `dialog.rbchat-modal`, and `#stagemodal`, `#stage`, `#stagehead`, `#modalclose` and `#expand` on a model page.
- **Commits:** in the git register of `conventions/WRITING.md`, ending `Verified:` with what ran, then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Check `git log -1 --format='[%s]'` after each commit.
- **Merges, tags and site pull requests** wait for the owner's word. This plan builds and opens pull requests only.

## Review focus

1. **Tab history after using the graph.** A visitor opens the graph, clicks three nodes, uses the stage's back arrow, closes the dialog, then presses the browser's Back. They expect to leave the chat page exactly as they would have without the graph. Test in Task 6 (`history.length` unchanged) and Task 7 (Back after closing).
2. **The graph opened from inside the diagram's full-screen dialog.** Two modal dialogs are then open. The graph must sit on top, and closing it must leave the diagram dialog open with focus back on the node that opened it. Test in Task 7.
3. **A model page whose model file fails, or an id the model does not hold.** The embedded stage focuses the root, as its own page does for an unknown hash, and the dialog still closes. Test in Task 6.
4. **A second open while the frame is still loading.** Its focus message must not be lost: the parent queues it until the frame posts `rb-graph-ready`. Test in Task 7.
5. **Theme or language switched on the chat page while the graph is open.** The frame reads the same storage keys but does not observe the parent's `data-theme` or `lang`. The parent posts `rb-graph-look` with both, and the frame applies them. Test in Task 7.

---

## Part A: companygraph/meta-model

### Task 1: The instance export names its core

**Files:**

- Modify: `lib/instance.mjs` (`parseInstance`'s return, and a helper above it)
- Modify: `README.md`, wherever it lists the fields of the parsed instance (find with `grep -n "rootId" README.md`)
- Test: `verify/instance.test.mjs`

**Interfaces:**

- Produces: `parseInstance(files, { sub, schemas })` returns `{ commit: null, core: string | null, root, rootId, types, entities, edges }`. `core` is the `version` in `schemas.get("manifest.json")`, and null when that entry is missing, not JSON, or has no string `version`.

- [ ] **Step 1: Set up the worktree.**

```bash
export PATH="/opt/homebrew/bin:$PATH"
cd ~/git/companygraph/meta-model && git fetch -q && git worktree add ../meta-model-the-export-names-its-core -b the-export-names-its-core origin/main
cd ../meta-model-the-export-names-its-core && npm ci --no-audit --no-fund
```

- [ ] **Step 2: Write the failing test.** Read how `verify/instance.test.mjs` builds its schema map, the `schema(...)` helper near its top, and append a test that parses a minimal valid instance three ways. Reuse the file's own smallest passing fixture, and the `valid` map and whatever schemas map its first `parseInstance` test uses:

```js
test("the export names the core its instance vendors, and null where the core carries no manifest", () => {
  const base = /* the schemas Map the first parseInstance test in this file passes */;
  const withManifest = new Map([...base, ["manifest.json", JSON.stringify({ version: "0.46.0", shape: 3 })]]);
  assert.equal(parseInstance(valid, { schemas: withManifest }).core, "0.46.0");
  assert.equal(parseInstance(valid, { schemas: base }).core, null);
  assert.equal(parseInstance(valid, { schemas: new Map([...base, ["manifest.json", "{ not json"]]) }).core, null);
  assert.equal(parseInstance(valid, { schemas: new Map([...base, ["manifest.json", JSON.stringify({ version: 46 })]]) }).core, null);
});
```

Replace the comment with the file's actual variable names; the plan cannot name them without the file open.

- [ ] **Step 3: Run it to verify it fails.** `npm run test:instance`. Expected: FAIL, `undefined !== '0.46.0'`.

- [ ] **Step 4: Implement.** Above `export function parseInstance`, add:

```js
// The version of the vocabulary an instance is written in, as it vendors it: the `version` in
// the core's own manifest, which a site hands the parser with the schemas it reads from
// `meta/core/`. A reader of the export can then say which core it answers from without a second
// fetch. Null where the core carries no readable manifest, so an old export's shape still holds.
function coreVersionOf(schemas) {
  const raw = schemas && typeof schemas.get === "function" ? schemas.get("manifest.json") : undefined;
  if (typeof raw !== "string") return null;
  try {
    const v = JSON.parse(raw).version;
    return typeof v === "string" && v ? v : null;
  } catch {
    return null;
  }
}
```

and change the return of `parseInstance` to:

```js
  return { commit: null, core: coreVersionOf(schemas), root: identity.name, rootId: identity.id, types, entities, edges };
```

- [ ] **Step 5: Run every suite.** Each `test:*` script and `npm run verify`. Expected: all pass. A test that compares the whole export with `deepEqual` now sees `core: null`; update it to expect `core`, and record the change in the commit body.

- [ ] **Step 6: Document** the field wherever the README lists the export's fields, in one sentence: the version of the vendored core, read from its `manifest.json`, or null.

- [ ] **Step 7: Commit, push and open the PR.** Subject: `The instance export names the core it is written in`. Body: why (the chat's banner names the core, read from the model file the sites already publish) and what (one field, `core`, null where the core carries no manifest). Say that nothing else in the export changes. End with `Verified:` naming the suites. The PR body is the commit body plus the 🤖 line, with no headings or bullets. Stop at the green PR.

### Task 2: The meta-model release (after the owner merges Task 1)

- [ ] **Step 1:** Read `conventions/WORKING.md` §Releases and the last release PR (`gh pr list --state merged --search "released as" -L 1`). The release moves `package.json`'s `version` and, per the family's rule, the `ref:` in `.github/workflows/instance-check.yml` to the same version, in one PR named `The meta-model is released as <next minor>`.
- [ ] **Step 2:** Once the owner merges it: tag `v<next minor>` as an annotated tag on the merge commit, push the tag, and publish a GitHub Release. The notes say the export gains `core`, nothing breaks, and a site takes it with a re-pin and a rebuilt model file.

---

## Part B: robertblust/design

### Task 3: The pure parts and the strings

**Files:**

- Modify: `assets/chat.js` (STRINGS, the pure section, the `window.rbChat` export and the file header's API list)
- Test: `test/chat.test.mjs`

**Interfaces:**

- Produces:
  - `versionsOf(file) → { core: string | null, commit: string, sha: string, repo: string } | null`. It returns null when `file.commit` or `file.repo` is not a non-empty string. `sha` is `commit.slice(0, 7)`.
  - `graphHref(model, id) → string`, which is `link(model, id)` with `embed` added to its query, for example `/model/?stage=expanded&embed#people/rob`.
  - `entityOf(href, model) → string | null`, the entity id a link into the model names, and null for any other href.
  - New strings: `versions`, `versionsModel`, `graph: { head, page, close }`, in both languages.

- [ ] **Step 1: Write the failing tests.** Add `versionsOf, graphHref, entityOf` to the destructuring and append:

```js
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
  for (const l of ["en", "de"]) for (const k of ["head", "page", "close"]) assert.ok(strings(l).graph[k], l + ".graph." + k);
});
```

- [ ] **Step 2: Run to fail.** `node --test test/chat.test.mjs`. Expected: three failures, each a TypeError or undefined.

- [ ] **Step 3: Implement.** Strings, in `en` after `askNext: …`:

```js
      versions: "meta-model {core} · model {sha}", versionsModel: "model {sha}",
      graph: { head: "graph · {title}", page: "model page ↗", close: "Close the graph" },
```

and in `de`:

```js
      versions: "Meta-Modell {core} · Modell {sha}", versionsModel: "Modell {sha}",
      graph: { head: "Graph · {title}", page: "Modellseite ↗", close: "Graph schliessen" },
```

Pure functions, beside `link()`:

```js
  // The graph's own address: the model link, embedded, so the page draws the stage alone.
  function graphHref(model, id){ return link(model, id).replace("?stage=expanded#", "?stage=expanded&embed#").replace("&stage=expanded#", "&stage=expanded&embed#"); }
  // The entity a link into the model names, read back from the address link() wrote; null for
  // any address that is not one, so a link to anywhere else is left to the browser.
  function entityOf(href, model){
    var base = model, cut = base.indexOf("#"); if (cut >= 0) base = base.slice(0, cut);
    var at = String(href || ""), hash = at.indexOf("#");
    if (hash < 0 || at.slice(0, hash) !== base + (base.indexOf("?") >= 0 ? "&" : "?") + "stage=expanded") return null;
    var id = decodeURIComponent(at.slice(hash + 1));
    return id || null;
  }
  // What the chat answers from, read from the model file it already fetched: the core the model
  // is written in, and the model's repository at one commit.
  function versionsOf(file){
    if (!file || typeof file.commit !== "string" || !file.commit || typeof file.repo !== "string" || !file.repo) return null;
    return { core: typeof file.core === "string" && file.core ? file.core : null, commit: file.commit, sha: file.commit.slice(0, 7), repo: file.repo };
  }
```

Export all three on `window.rbChat` and list them in the header's API comment.

- [ ] **Step 4: Run the whole suite and commit.** `npm test`, all pass. Subject: `The chat reads its versions and addresses the embedded graph`.

### Task 4: The answer on a card

**Files:**

- Modify: `assets/chat.css` (the three `--t-*` palette blocks, and `.rbchat-assistant`)
- Test: `test/chat.test.mjs` (contrast) and `test/chat-terminal.test.mjs` (computed background)

- [ ] **Step 1: Write the failing tests.** In `test/chat.test.mjs`:

```js
// WCAG relative luminance and contrast, from two #RRGGBB values.
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
test("the answer card keeps the answer's text, links and rail readable in both palettes", () => {
  const css = fs.readFileSync(path.join(PKG, "assets", "chat.css"), "utf8");
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
```

In `test/chat-terminal.test.mjs`, in the slow-answer test's `done` object, add `card: getComputedStyle(a).backgroundColor`, and assert `done.card === "rgb(20, 29, 41)"`.

- [ ] **Step 2: Run to fail.** Both fail: there is no `--t-card`, and the background is transparent.

- [ ] **Step 3: Implement.** Each of the three palette blocks in `chat.css` must carry every `--t-*` value on one rule so the test can read it. Append `--t-card:#141D29` to the dark block and `--t-card:#F3F1EB` to both light blocks. Then change `.rbchat-assistant`:

```css
.rbchat-assistant{margin:.4rem 0 0 .35rem;padding:.55rem .9rem .55rem .95rem;border-left:1.5px solid var(--t-good);background:var(--t-card);border-radius:0 8px 8px 0}
```

- [ ] **Step 4: Run and commit.** `npm test`, all pass. Subject: `An answer sits on a card a step lighter than the terminal`.

### Task 5: The banner names the versions

**Files:**

- Modify: `assets/chat.js` (`questions()` keeps the versions; `intro()` draws the line)
- Modify: `assets/chat.css` (`.rbchat-versions`)
- Test: `test/chat-terminal.test.mjs` (add `commit`, `repo` and `core` to `MODEL`; `/broken` has none)

- [ ] **Step 1: Write the failing tests.** At the top of `chat-terminal.test.mjs`, give `MODEL` `commit: "ffb11a52dc8a5ff2a46cbbd43ab8be8930797f6f", repo: "companygraph/mental-model", core: "0.46.0"`, and give `MANY` the same without `core`. Append:

```js
test("the banner names the core and the model's commit, each linked, and the model alone where the file names no core", async () => {
  const { p, close } = await tab();
  await open(p);
  await p.waitForSelector(".rbchat-versions a");
  const s = await p.$eval(".rbchat-versions", (v) => ({ text: v.textContent, links: [...v.querySelectorAll("a")].map((a) => a.getAttribute("href")) }));
  assert.equal(s.text, "meta-model 0.46.0 · model ffb11a5");
  assert.deepEqual(s.links, ["https://github.com/companygraph/mental-model/tree/ffb11a52dc8a5ff2a46cbbd43ab8be8930797f6f/meta/core", "https://github.com/companygraph/mental-model/tree/ffb11a52dc8a5ff2a46cbbd43ab8be8930797f6f"]);
  await p.evaluate(() => { document.documentElement.lang = "de"; });
  await p.waitForFunction(() => /^Meta-Modell 0\.46\.0/.test(document.querySelector(".rbchat-versions").textContent));
  await close();
  const many = await tab("/many");
  await open(many.p);
  await many.p.waitForSelector(".rbchat-versions");
  assert.equal(await many.p.$eval(".rbchat-versions", (v) => v.textContent), "model ffb11a5");
  await many.close();
  const broken = await tab("/broken");
  await open(broken.p);
  await broken.p.waitForSelector(".rbchat-intro .rbchat-row");
  assert.equal(await broken.p.$(".rbchat-versions"), null);
  await broken.close();
});
```

- [ ] **Step 2: Run to fail.** There is no `.rbchat-versions`.

- [ ] **Step 3: Implement.** In `questions()`, next to `qFacts = { … }`, add `versions: versionsOf(j)` to the object, and give `qFacts`'s initial value `versions: null`. In `intro()`'s fill callback, after the `menu(…)` calls, insert the line under the lockup's sub line, or under the hello where there is no lockup:

```js
        if (f.versions) {
          var v = f.versions, t2 = strings(langNow()), line = el("span", "rbchat-versions");
          var words = (v.core ? t2.versions : t2.versionsModel).split(/(\{core\}|\{sha\})/);
          words.forEach(function(w){
            if (w === "{core}") { var a1 = el("a", null, v.core); a1.href = "https://github.com/" + v.repo + "/tree/" + v.commit + "/meta/core"; line.appendChild(a1); }
            else if (w === "{sha}") { var a2 = el("a", null, v.sha); a2.href = "https://github.com/" + v.repo + "/tree/" + v.commit; line.appendChild(a2); }
            else if (w) line.appendChild(document.createTextNode(w));
          });
          var word = introEl.querySelector(".rbchat-word");
          if (word) word.appendChild(line); else introEl.insertBefore(line, introEl.querySelector(".rbchat-hello").nextSibling);
          line.classList.add("rbchat-on");
        }
```

`facts(cb)` passes `qFacts`, so `f.versions` is there. The intro is redrawn on a language switch, so the line follows it with no relabel of its own. In `chat.css`:

```css
.rbchat-versions{display:block;font-size:.8rem;color:var(--t-dim)}
.rbchat-versions a{color:inherit}
```

The link colour comes from the page's link block, as for every unclassed link in the panel; do not give `a` a color of its own, since `assets.test.mjs` forbids it. Remove the `color:inherit` rule if that test objects.

- [ ] **Step 4: Run and commit.** `npm test`, all pass. Subject: `The chat's banner names the core and the model it answers from`.

### Task 6: A model page can be embedded

**Files:**

- Modify: `blocks/theme-boot.js` (set `data-embed`), `versions.json` (`themeBoot` → `v4`)
- Modify: `assets/stage.css` (the embed rules), `assets/stage.js` (embed behavior)
- Modify: `assets/chat.js` (return before the button on an embedded page)
- Create: `test/fixtures/stage-model.json` (generated below), `test/stage-embed.test.mjs`

**Interfaces:**

- Produces, on a page whose address carries `embed`:
  - `<html data-embed>`, set before first paint.
  - The stage opens expanded on arrival, as `?stage=expanded` does.
  - The stage posts `{ type: "rb-graph-ready" }` to `parent` once it has focused.
  - It posts `{ type: "rb-graph-close" }` on its × and on Escape, and does not close its own dialog.
  - It listens for `{ type: "rb-graph-focus", id }` and `{ type: "rb-graph-look", theme, lang }` from `location.origin` only.
  - Its focus changes use `history.replaceState`, and its arrows and keys move along its trail in memory.

- [ ] **Step 1: Generate the fixture.** This is a small real model: the identity plus up to 24 entities, and the edges among them.

```bash
node -e '
const j = require(process.env.HOME + "/git/guestgraph/guestgraph.github.io/model.json");
const keep = new Set([j.rootId]); for (const e of j.entities) { if (keep.size >= 25) break; keep.add(e.id); }
const out = { ...j, entities: j.entities.filter((e) => keep.has(e.id)), edges: j.edges.filter((g) => keep.has(g.from) && keep.has(g.to)) };
require("fs").writeFileSync("test/fixtures/stage-model.json", JSON.stringify(out));
console.log(out.entities.length, out.edges.length, out.entities.slice(0, 5).map((e) => e.id).join(" "));'
```

The printed ids are the ones the tests below name as `ID_A` and `ID_B`. Take two ids that are not the root and put them in the test as constants.

- [ ] **Step 2: Write the failing browser test.** `test/stage-embed.test.mjs` serves:
  - a model page built from blust.ch's stage markup: the `.stagehead`, `.stage` and `#stagemodal` block of `robertblust.github.io/model/index.html`, copied into the test as a string, plus a `<header><p>Header</p></header>` and a `<footer>` to prove they hide;
  - the page's `<link rel="preload" as="fetch" href="/model.json" data-stage crossorigin>`;
  - the scripts `/d3.v7.min.js`, `/card.js` and `/stage.js`, and `/stage.css`, from `assets/`;
  - the theme-boot block, inlined into the page's `<head>` with its `{{variant}}` placeholder removed;
  - a parent page at `/parent` that holds `<iframe src="/model/?stage=expanded&embed#ID_A">` and records every `message` event into `window.got`.

  The cases:

```js
test("an embedded page shows the expanded stage alone, focused where its address says", async () => {
  // Open /parent; in the frame: data-embed on <html>, #stagemodal open, the header and footer not displayed, #path names ID_A's path, the expand button not displayed.
});
test("the stage's × and Escape ask the parent to close, and leave the stage open", async () => {
  // Click #modalclose in the frame: window.got holds {type:"rb-graph-close"} and #stagemodal is still open; press Escape in the frame: a second close message.
});
test("the parent moves the focus by message, and nothing the stage does adds to the tab's history", async () => {
  // Record history.length in /parent; post {type:"rb-graph-focus", id: ID_B} to the frame from the parent; #path now names ID_B; click two nodes in #fig; click the stage's back control (.history .back); history.length in /parent is unchanged, and the frame's location.hash names the focus.
});
test("the frame is ready once it has focused, and an unknown id focuses the root", async () => {
  // window.got holds {type:"rb-graph-ready"}; post {type:"rb-graph-focus", id:"nothing/here"}: the focus is the root.
});
test("a message from another origin is ignored", async () => {
  // In the frame, dispatch new MessageEvent("message", { data: { type: "rb-graph-focus", id: ID_B }, origin: "https://elsewhere.example" }): the focus does not move.
});
test("the parent's look reaches the frame", async () => {
  // Post {type:"rb-graph-look", theme:"light", lang:"de"}: the frame's <html> has data-theme="light" and lang="de".
});
```

Write each body in full, with Playwright's `frameLocator`/`frame()` API and `page.evaluate`, in the style of `test/chat-terminal.test.mjs`. The comments above say exactly what each asserts.

- [ ] **Step 3: Run to fail.** `node --test test/stage-embed.test.mjs`. Expected: the first fails because `data-embed` is missing.

- [ ] **Step 4: Implement the head block.** In `blocks/theme-boot.js`, inside the `try`, after the theme lines:

```js
      // A page asked for `embed` draws its stage alone, inside another page's dialog; the flag
      // is set here so the page never paints its header first.
      if (/[?&]embed(&|$)/.test(location.search)) document.documentElement.setAttribute("data-embed", "");
```

Update the header comment's version marker to `v4`, set `versions.json`'s `themeBoot` to `"v4"`, and add a sentence to the header comment saying why the block also carries the embed flag. Run `npm test`: the blocks and sync tests say what else a block version bump touches. Follow them.

- [ ] **Step 5: Implement the stage rules.** Append to `assets/stage.css`:

```css
/* Embedded: another page's dialog holds this one, and only the expanded stage is drawn. The
   page around it, its expand button and its chat stand down, and the stage's dialog fills the
   frame with no backdrop, since the frame is already the dialog. */
:root[data-embed] body > :not(dialog){display:none!important}
:root[data-embed] main > :not(section.figure-section), :root[data-embed] header, :root[data-embed] footer{display:none!important}
:root[data-embed] #stagemodal{width:100vw;height:100vh;max-width:none;max-height:none;margin:0;border:0;border-radius:0}
:root[data-embed] #stagemodal::backdrop{background:none}
:root[data-embed] #expand{display:none}
```

The page's `<dialog>` sits inside `main`, not directly in `body`. Open the fixture page in the test browser, read which of these rules are needed for the header and footer to disappear while `#stagemodal` stays shown, and keep only those. A shown modal dialog is in the top layer and shows even if an ancestor is `display:none`? No: an ancestor with `display:none` hides it. Hide siblings, never ancestors. Verify by the first test.

- [ ] **Step 6: Implement the stage's behavior.** In `assets/stage.js`, near the top of `rbStage`:

```js
  // Embedded in another page's dialog (see theme-boot): the stage talks to its parent, never to
  // the tab's history, and opens expanded.
  var EMBED = document.documentElement.hasAttribute("data-embed");
  function tell(type, extra){ if (EMBED && window.parent !== window) { var m = { type: type }; for (var k in extra || {}) m[k] = extra[k]; window.parent.postMessage(m, location.origin); } }
```

Then make these changes:

- **Focus:** in `focus()`, replace `if (hash) location.hash = hash;` with `if (hash) { if (EMBED) history.replaceState(null, "", location.pathname + location.search + hash); else location.hash = hash; }`.
- **Arrows:** the history arrows and keys call `history.back()`, `forward()` and `go(-pos)`. Route every one through a new `step(delta)`:

  ```js
  function step(delta){
    if (!EMBED) { if (delta === -1) history.back(); else if (delta === 1) history.forward(); else history.go(delta); return; }
    var to = pos + delta; if (to < 0 || to >= trail.length) return;
    pos = to; var n = nodeById(trail[pos]) || nRoot(); focus(n, true); renderHist();
  }
  ```

  Replace `history.back()` with `step(-1)`, `history.forward()` with `step(1)`, and `history.go(-pos)` with `step(-pos)`, in the four places `grep -n "history\.\(back\|forward\|go\)" assets/stage.js` lists. Keep `expect = 0;` where it stands. Read `trailMove` and `renderHist` first. On a page that is not embedded nothing changes, so the model page's own behavior stays byte for byte the same in effect.
- **Close:** in the `closeBtn` click handler, `if (EMBED) { tell("rb-graph-close"); return; }` before `modal.close()`. Add `modal.addEventListener("cancel", function(ev){ if (EMBED) { ev.preventDefault(); tell("rb-graph-close"); } });`, and in the backdrop click handler return early `if (EMBED)`.
- **Open expanded:** where the page reads `?stage=expanded`, also expand `if (EMBED)`. After the first focus, `tell("rb-graph-ready")`.
- **Messages:** add a listener:

  ```js
  if (EMBED) window.addEventListener("message", function(ev){
    if (ev.origin !== location.origin || !ev.data || typeof ev.data.type !== "string") return;
    if (ev.data.type === "rb-graph-focus") { var n = nodeById(String(ev.data.id || "")) || nRoot(); focus(n); }
    else if (ev.data.type === "rb-graph-look") {
      if (ev.data.theme === "light") document.documentElement.setAttribute("data-theme", "light"); else document.documentElement.removeAttribute("data-theme");
      if (ev.data.lang === "de" || ev.data.lang === "en") document.documentElement.lang = ev.data.lang;
    }
  });
  ```

  `focus(n)` without `fromAddress` pushes onto the trail, as a click does.

- [ ] **Step 7: The chat stands down on an embedded page.** In `assets/chat.js`, directly after `if (!tag.dataset.chat) return;`, add `if (document.documentElement.hasAttribute("data-embed")) return;` with a one-line comment saying why.
- [ ] **Step 8: Run to pass.** `node --test test/stage-embed.test.mjs`, then `npm test`. All pass.
- [ ] **Step 9: Commit.** Subject: `A model page can be embedded, its stage alone and its history its own`.

### Task 7: The chat opens the graph

**Files:**

- Modify: `assets/chat.js` (a graph dialog, a delegated click handler, messages)
- Modify: `assets/chat.css` (`dialog.rbchat-graph`)
- Create: `test/chat-graph.test.mjs`

**Interfaces:**

- Consumes: `graphHref`, `entityOf`, `strings().graph`, and the frame's messages from Task 6.
- Produces:
  - `dialog.rbchat-graph`, made on the first open, holding `.rbchat-graph-head` (title span, `a.rbchat-graph-page`, `button.rbchat-graph-close`) and `iframe.rbchat-graph-frame`.
  - `openGraph(id, title, opener)`.

- [ ] **Step 1: Write the failing browser test.** `test/chat-graph.test.mjs` serves:
  - a chat page with `data-model="/model/"`, carrying `chat.js` and `chat.css`;
  - the embeddable model page from Task 6 at `/model/`, with the same markup, fixture and assets (import the page builder by moving it into `test/fixtures/stage-page.mjs` in this task, and use it from both tests);
  - a stub `/chat` that answers with text naming `ID_A`'s title, a `names` event for `ID_A`, a `cite` for `ID_B`, and a diagram from `test/fixtures/diagrams.json` whose node is `ID_A`.

  The cases:

```js
test("a name in an answer opens the graph over the chat, focused on it, and the page does not change", async () => {
  // Ask; click the linked name; dialog.rbchat-graph is open; the head reads "graph · <title>"; the frame's #path names ID_A; location.pathname of the chat page is unchanged.
});
test("a cite title and a picture's node open it too, and a second open moves the focus without reloading", async () => {
  // Count the frame's "load" events; close; click the cite title: the focus is ID_B and loads is still 1; close; click the picture's node: the focus is ID_A.
});
test("the frame's × and Escape close the dialog, focus goes back to the link, and Back leaves the chat page as it would have", async () => {
  // Note history.length before opening; open, click two nodes in the frame, close with the frame's ×; history.length is unchanged; document.activeElement is the link that opened it; open again, press Escape: closed.
});
test("opened from the picture's full screen, the graph sits on top and closing it leaves the picture open", async () => {
  // Expand the picture; click its node in dialog.rbchat-modal; both dialogs open, the graph last in the top layer; close the graph: dialog.rbchat-modal still open.
});
test("a second open before the frame is ready is not lost", async () => {
  // Delay /model.json by 800 ms in the stub; click the name then at once the cite; once ready, the focus is ID_B.
});
test("a switch of theme or language while the graph is open reaches it, and a close from another origin is ignored", async () => {
  // Set data-theme="light" and lang="de" on the chat page: the frame's <html> follows. Dispatch a MessageEvent rb-graph-close with origin https://elsewhere.example on the chat window: the dialog stays open.
});
```

Write each body in full, as in Task 6.

- [ ] **Step 2: Run to fail.** Clicking a name still navigates, so the dialog never opens.
- [ ] **Step 3: Implement.** In `chat.js`, beside `ensureModal()`, add the graph dialog:

```js
  // ─── The graph ────────────────────────────────────────────────────────────────────────────
  // A link into the model from the chat opens the model page's own stage over the page, in a
  // dialog like a picture's Expand, rather than taking the visitor to the page. The page is
  // embedded: it draws its stage alone and keeps its history to itself (see stage.js), so the
  // chat page's address and its Back stay the visitor's. The frame is made on the first open;
  // a later open moves its focus by message, queued until the frame says it is ready.
  var graph = null, graphFrame = null, graphTitle = null, graphPage = null, graphReady = false, graphQueue = null, graphOpener = null;
  function ensureGraph(){
    if (graph) return;
    var s = strings(langNow());
    graph = el("dialog", "rbchat-graph"); graph.setAttribute("aria-label", s.graph.head.replace("{title}", ""));
    var head = el("div", "rbchat-graph-head");
    graphTitle = el("span", "rbchat-graph-title");
    graphPage = el("a", "rbchat-graph-page", s.graph.page);
    var shut = el("button", "rbchat-graph-close", "×"); shut.type = "button"; shut.setAttribute("aria-label", s.graph.close); shut.setAttribute("data-tip", s.graph.close + " · Esc");
    shut.addEventListener("click", function(){ graph.close(); });
    head.appendChild(graphTitle); head.appendChild(graphPage); head.appendChild(shut);
    graphFrame = el("iframe", "rbchat-graph-frame"); graphFrame.setAttribute("title", s.graph.head.replace("{title}", ""));
    graph.appendChild(head); graph.appendChild(graphFrame);
    graph.addEventListener("click", function(ev){ if (ev.target === graph) graph.close(); });
    graph.addEventListener("close", function(){ if (graphOpener && graphOpener.focus) graphOpener.focus(); graphOpener = null; });
    document.body.appendChild(graph);
  }
  function lookOf(){ return { type: "rb-graph-look", theme: document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark", lang: langNow() }; }
  function tellGraph(m){ if (graphFrame && graphFrame.contentWindow) graphFrame.contentWindow.postMessage(m, location.origin); }
  function openGraph(id, title, opener){
    ensureGraph();
    var s = strings(langNow());
    graphOpener = opener || document.activeElement;
    graphTitle.textContent = s.graph.head.replace("{title}", title || id);
    graphPage.href = link(MODEL, id);
    if (!graphFrame.getAttribute("src")) { graphReady = false; graphFrame.setAttribute("src", graphHref(MODEL, id)); }
    else if (graphReady) tellGraph({ type: "rb-graph-focus", id: id });
    else graphQueue = id;
    if (!graph.open) graph.showModal();
  }
  window.addEventListener("message", function(ev){
    if (ev.origin !== location.origin || !graphFrame || ev.source !== graphFrame.contentWindow || !ev.data) return;
    if (ev.data.type === "rb-graph-ready") { graphReady = true; tellGraph(lookOf()); if (graphQueue) { tellGraph({ type: "rb-graph-focus", id: graphQueue }); graphQueue = null; } }
    else if (ev.data.type === "rb-graph-close" && graph && graph.open) graph.close();
  });
  if (window.MutationObserver) new MutationObserver(function(){ if (graphReady) tellGraph(lookOf()); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "lang"] });
  // Any link into the model inside the chat, whether a name, a cite title or a picture's node,
  // on the panel or in the picture's full screen, opens the graph instead of leaving the page.
  // A modified click (a new tab) is left to the browser.
  document.addEventListener("click", function(ev){
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target && ev.target.closest && ev.target.closest("a[href]");
    if (!a || !(a.closest(".rbchat") || a.closest("dialog.rbchat-modal"))) return;
    var id = entityOf(a.getAttribute("href"), MODEL);
    if (!id) return;
    ev.preventDefault();
    openGraph(id, a.getAttribute("aria-label") || a.textContent.trim(), a);
  });
```

The ready message must come from the frame's own window (`ev.source`), and a close from any other window is ignored. The origin test is the first gate. `relabel()` also relabels the graph's head, link and close when `graph` exists.

A figure node's `<a>` is the SVG `a` Mermaid draws, and its `href` may be `xlink:href`. Read `getAttribute("href") || getAttribute("xlink:href")` in the handler, and check `nodeHref` in `drawFigure` for which attribute it sets. A page's own figure outside the chat is not inside `.rbchat` or `dialog.rbchat-modal` while on the page; while it is open full screen it is, and there its node opening the graph is right too.

- [ ] **Step 4: CSS.** Append to `assets/chat.css`, using the terminal palette the way `dialog.rbchat-modal.rbchat-term` does. Add `dialog.rbchat-graph` to the three palette selectors and to the token-redefining rule, as Task 3 of the previous plan did for the modal:

```css
dialog.rbchat-graph{width:min(1200px,94vw);height:min(820px,90vh);max-width:94vw;max-height:90vh;padding:0;margin:auto;
  border:1.5px solid var(--t-edge);border-radius:12px;background:var(--t-bg);color:var(--t-ink);overflow:hidden;flex-direction:column;
  font-family:"Plex Mono",ui-monospace,Menlo,monospace;font-size:.8rem}
dialog.rbchat-graph[open]{display:flex}
dialog.rbchat-graph::backdrop{background:rgba(0,0,0,.6)}
.rbchat-graph-head{display:flex;align-items:center;gap:.6rem;padding:.6rem .8rem .6rem 1.2rem;background:var(--t-top)}
.rbchat-graph-title{margin-right:auto;color:var(--t-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rbchat-graph-page{color:var(--t-dim);text-decoration:none;padding:.15rem .4rem;border-radius:5px}
.rbchat-graph-close{position:relative;border:0;background:none;color:var(--t-dim);font:inherit;font-size:1rem;line-height:1;cursor:pointer;padding:.15rem .4rem;border-radius:5px}
.rbchat-graph-page:hover,.rbchat-graph-page:focus-visible,.rbchat-graph-close:hover,.rbchat-graph-close:focus-visible{color:var(--t-ink);outline:1.5px solid var(--t-accent)}
.rbchat-graph-frame{flex:1;width:100%;border:0;background:var(--t-bg)}
@media (max-width:860px){dialog.rbchat-graph{width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;margin:0;border:0;border-radius:0}}
```

`.rbchat-graph-page` is a classed link, so `assets.test.mjs`'s link rule applies. Give it the family's link treatment, as `.rbchat-cites a.rbchat-cite` has, if that test demands it.

- [ ] **Step 5: Run to pass,** then `npm test`. All pass. Update any `chat-place`, `chat-diagram` or `chat.test` assertion that expected a cite or node click to navigate. Keep the `href`s themselves, since they still name the model page for a new tab.
- [ ] **Step 6: Commit.** Subject: `The chat opens the graph over the page`.

### Task 8: README, the checks, the rendering review and the pull request

- [ ] **Step 1:** The README.
  - **Chat paragraph:** a link into the model opens the embedded graph over the page, and a modified click still opens the page. An answer sits on a card. The banner names the core and the commit, from the model file's `core`, `commit` and `repo`.
  - **Stage paragraphs:** the `embed` mode and its two messages each way (`rb-graph-ready` and `rb-graph-close` from the frame, `rb-graph-focus` and `rb-graph-look` to it).
  - **For a site:** its model page, companygraph.io's home page, must carry the stage markup; nothing else is needed.
- [ ] **Step 2:** `npm test && sh conventions/conventions-check && sh conventions/conventions-format`. Check each exit code on its own.
- [ ] **Step 3: The rendering review.** Reuse the review page of the previous plan (a scratch page per site header) and add the embeddable model page from Task 6. Take one screenshot each of:
  - a fresh chat with the versions line;
  - an answer on its card, dark and light;
  - the graph open over the chat, dark and light, English and German;
  - the graph open on a phone at 390×844;
  - the graph over a picture's full screen.

  Look once, fix what is visibly wrong, then look once more.
- [ ] **Step 4:** Commit. Push `the-chat-opens-the-graph`, retitle PR #185 `The chat opens the graph over the page`, and rewrite its body in the git register, with the release-notes line and `Verified:`. Stop.

---

## Part C: releases and sites (each step on the owner's word)

- [ ] **design release:** a PR moving `package.json` to the next minor, then the tag and the Release, as for v0.116.0.
- [ ] **each site, one PR:**
  - Take both tags.
  - Prove the lockfile for both git dependencies (`resolved` ends in each tag's commit).
  - Rebuild the model file (`npm run model`, or `npm run build` on companygraph.io), and confirm it carries `core`.
  - Run `npm run design`, then `npm run og`, then every check and `npm run verify`.
  - Open `/model/?stage=expanded&embed#<an id>` (companygraph.io: `/?…`) in the served worktree and confirm only the stage shows.
