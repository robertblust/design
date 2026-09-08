# The stage fetches its data — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The stage fetches the artifact a page names instead of reading one inlined into it, so
a page that draws the model stops carrying it.

**Architecture:** A page names its data with `<link rel="preload" as="fetch" href="…" data-stage>`.
`assets/stage.js` keeps its 905-line body untouched and gains a bootstrap that fetches that href.
`verify/stage.mjs`'s `graph` check reads the same file. `cards/export.mjs` starts its own static
server, because `fetch` is blocked from `file://` and that is where cards render today.

**Tech Stack:** Node 22 ESM, **no dependencies** — `node:http` is built in, which is the only
reason the exporter can serve at all. `node --test` for the package's suite.

**Spec:** `docs/superpowers/specs/2026-09-08-stage-fetches-its-data-design.md`

## Global constraints

- Branch is `stage-fetches-its-data`, already created, spec already committed as `0cf5a00`.
- **No dependencies may be added.** This package has no `dependencies` block and three sites
  import it. `node:http` and `node:fs` are built in and are the whole toolkit for the server.
- `assets/stage.js` runs in a browser with no build step. **ES5-compatible syntax only** — the
  file uses `var` and `function` throughout, and nothing may introduce syntax its neighbours do
  not already use.
- **The 905 lines inside the stage's IIFE must not move.** Task 1 says how; a diff that reindents
  them is a failed task, not a stylistic choice.
- Commit messages follow the git register: subject under seventy characters, no type prefix, no
  trailing period, one to three short paragraphs, a final line beginning `Verified:`, then the
  `Co-Authored-By` trailer.
- **Do not tag and do not merge.** The plan ends at a pull request; the release is the owner's.
- Do not touch `versions.json` — it versions fenced blocks and nothing here is a fence.
- Do not change any site. This plan is the design package alone; the two site changes follow the
  release and are their own work.

## File structure

```
assets/stage.js            modify  the entry becomes a fetch; the body is untouched
verify/stage.mjs           modify  the graph check reads the file the page names
cards/export.mjs           modify  serves the site instead of using file://
test/cards-export.test.mjs modify  two tests assert the file URL and must follow
test/stage-checks.test.mjs modify  coverage for the new failure paths
package.json               modify  version 0.55.0
```

## Measured facts this plan relies on

Counted on 2026-09-08.

| Fact | Value |
|---|---|
| `assets/stage.js` | 922 lines; the IIFE opens at 18 and closes at 922; 905 lines inside |
| Its body's indentation | already two spaces, so `function rbStage(data) {` needs no reindent |
| `fetch` from `file://` | blocked; a classic `<script src>` loads; over `http` both work |
| A card rendered over `http` | byte-identical to `file://` — 199,262 bytes, same SHA-256 |
| `cards/recipe.mjs`'s `sources()` | walks every `src` and `href` outside an `<a>`, so a preload link is hashed |
| `test/cards-export.test.mjs` | 23 tests, two of which assert the file URL |
| The package's suite today | `node --test` passes 329 |

---

### Task 1: The stage fetches what the page names

**Files:**
- Modify: `assets/stage.js`

**Interfaces:**
- Consumes: nothing.
- Produces: a global `rbStage(data)`, matching `card.js`'s `rbCard`; and the contract that a page
  names its data with `<link rel="preload" as="fetch" href="…" data-stage>`.

- [ ] **Step 1: Turn the IIFE into a named function without moving its body**

The body is already indented two spaces inside `(function(){`, so replacing the opening line with
a function declaration leaves all 905 lines exactly where they are. Replace lines 18 to 21:

```js
(function(){
  var block = document.querySelector('script[type="application/json"][data-stage]');
  var data = JSON.parse(block.textContent);
  if (!data.entities) return;             // the page's data block is empty until the site's build has written it
```

with:

```js
function rbStage(data) {
  if (!data.entities) return;             // the artifact is empty until the site's build has written it
```

and replace the file's last line, `})();`, with `}` alone.

- [ ] **Step 2: Prove the body did not move**

Run: `git diff --stat assets/stage.js`
Expected: a small number of changed lines — the four replaced at the top and the one at the
bottom, not hundreds.

Run: `git diff -w --numstat assets/stage.js`
Expected: the same small numbers. If ignoring whitespace collapses a large diff to a small one,
the body was reindented and the task has failed. Stop and report BLOCKED.

- [ ] **Step 3: Add the bootstrap at the end of the file**

Append after the closing `}`:

```js

// The page names the file this stage draws, and the stage fetches it. It used to read a
// <script type="application/json"> the build had inlined, which meant a page carried the whole
// model in order to draw it — three hundred kilobytes on blust.ch, in each of two pages, of a
// file that site already commits and serves at a stable URL. The marker is still an attribute
// rather than an id, so one script still serves every page that names one.
//
// A preload link rather than a bare href, for two reasons that happen to agree: the browser
// starts the request before this script runs, and `cards/recipe.mjs` walks every href outside an
// <a>, so the artifact enters each card's hash by being named and a model that changes still
// reports its card stale.
//
// The failure is loud on purpose. A site takes this release by re-pinning, syncing and changing
// its pages in one commit; one that does the first two and not the third has a page naming no
// data, and the message is where that mistake is found.
(function(){
  var link = document.querySelector("link[data-stage]");
  if (!link) {
    console.error('stage.js: this page names no data. Add <link rel="preload" as="fetch" ' +
      'href="…" data-stage> and rebuild the page.');
    return;
  }
  fetch(link.href).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }).then(rbStage).catch(function (err) {
    console.error("stage.js: could not read " + link.href + " — " + err.message);
  });
})();
```

`rbStage` is a function declaration, so it is hoisted and available to the bootstrap regardless of
order. It is global, which matches `card.js`'s `rbCard` — the file already runs at global scope
and the family already reads one such name.

- [ ] **Step 4: Confirm the package's own assertions about this file still hold**

Run: `node --test test/assets.test.mjs`
Expected: pass. Three tests hold this file — on `markH`, on spine termination, and on it reading
its data from something marked `data-stage`. The third still passes because the bootstrap queries
`link[data-stage]`; if it fails, read it before changing anything, because it is asserting the
contract this task is changing and the review should hear about it.

- [ ] **Step 5: Commit**

```bash
git add assets/stage.js
git commit -F - <<'MSG'
The stage fetches the file the page names

A page that draws the model carried the whole model to do it: three hundred kilobytes inlined
into each of two pages on blust.ch, of a file that site already commits and serves at a stable
URL its Dataset node names as a download. One parse existed three times in one repository.

The page now names its data with a preload link and the stage fetches it. The marker stays an
attribute rather than an id, so one script still serves every page that names one, and a
preload link is a tag cards/recipe.mjs already walks — so the artifact enters each card's hash
by being named, and a model that changes still reports its card stale.

The body of the stage is untouched. Its IIFE became a named function, which needed no
reindentation because the body was already indented inside it, and the bootstrap that fetches
is new code at the end.

Verified: git diff -w shows the same small change as git diff, so the 905 lines inside did not
move; node --test test/assets.test.mjs passes.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
```

---

### Task 2: The check reads the file the page names

**Files:**
- Modify: `verify/stage.mjs`
- Modify: `test/stage-checks.test.mjs`

**Interfaces:**
- Consumes: Task 1's `link[data-stage]` contract.
- Produces: `STAGE_CHECKS.graph` no longer reads `spec.graph`, so a site's spec entry becomes a
  plain flag rather than an element id. That is a site-side change and belongs to the sites' own
  work, not here.

- [ ] **Step 1: Write the failing test**

Append to `test/stage-checks.test.mjs`:

```js
test("graph reads the file the page names, not an inlined element", () => {
  const src = fs.readFileSync(new URL("../verify/stage.mjs", import.meta.url), "utf8");
  assert.ok(!/getElementById\(id\)/.test(src),
    "the graph check still reads an inlined element by id");
  assert.match(src, /link\[data-stage\]/,
    "the graph check does not look for the link the page names its data with");
});

test("graph distinguishes a page that names no data from one whose data is missing", () => {
  const src = fs.readFileSync(new URL("../verify/stage.mjs", import.meta.url), "utf8");
  assert.match(src, /names no data/, "no message for a page that names no data");
  assert.match(src, /HTTP/, "no message for a named file that does not load");
});
```

If `test/stage-checks.test.mjs` does not already import `fs`, add `import fs from "node:fs";` at
the top with the other imports.

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/stage-checks.test.mjs`
Expected: FAIL — two new tests, on `getElementById(id)` still being present and on the messages
being absent.

- [ ] **Step 3: Rewrite the check's first three lines**

In `verify/stage.mjs`, replace:

```js
    const data = await page.evaluate((id) => JSON.parse(document.getElementById(id).textContent), spec.graph);
    if (!data.entities) return "the data block is empty — the site's build has not written it";
```

with:

```js
    // The same file the stage reads, found the same way, so the check and the page cannot
    // disagree about where the data is. It used to parse an element the build had inlined; a
    // page now names its data and both of us fetch it.
    const found = await page.evaluate(async () => {
      const link = document.querySelector("link[data-stage]");
      if (!link) return { error: "names no data" };
      const res = await fetch(link.href);
      if (!res.ok) return { error: "HTTP " + res.status + " for " + link.href };
      return { data: await res.json() };
    });
    if (found.error) return `the page ${found.error} — run the site's build`;
    const data = found.data;
    if (!data.entities) return "the data the page names is empty — the site's build has not written it";
```

`spec.graph` is no longer read. Leave the parameter in the signature: the runner passes it to
every check and a site's spec still carries the key to opt in.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/stage-checks.test.mjs`
Expected: pass, all tests.

Run: `node --test`
Expected: the whole package passes.

- [ ] **Step 5: Commit**

```bash
git add verify/stage.mjs test/stage-checks.test.mjs
git commit -F - <<'MSG'
The graph check reads what the page reads

It parsed an element the build had inlined, found by an id the site's own spec carried. The
stage no longer reads that element, so the check was asserting against a thing the page had
stopped using — it would have passed on a page whose stage drew nothing, as long as the block
was still there.

It now finds the link the page names its data with and fetches the same file, which is how the
check and the page come to agree about where the data is by construction rather than by two
copies of one convention. A page naming no data and a named file that does not load report
differently, because those are different mistakes with different fixes.

Verified: node --test passes; the new tests fail against the old check.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
```

---

### Task 3: The exporter serves the site

The task that makes the rest possible: `fetch` is blocked from `file://`, and every card is
rendered there today.

**Files:**
- Modify: `cards/export.mjs`
- Modify: `test/cards-export.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: no exported surface. `exportCards`'s signature does not change.

- [ ] **Step 1: Write the failing tests**

Two existing tests in `test/cards-export.test.mjs` assert the file URL — `"a card's hash is
appended to the file URL it opens"` and `"a card with no hash opens the page's own URL with
nothing appended"`. Find them and change what they expect: the URL is now
`http://127.0.0.1:<port>/<dir>/` with the hash appended, and the port is whatever the server took.
Assert the shape rather than a fixed port — that it starts with `http://127.0.0.1:`, that it ends
with the card's directory and hash, and that it is not a `file:` URL.

Add one test asserting the server is closed after the run, whatever happens: a card that throws
must not leave a listening socket behind.

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test test/cards-export.test.mjs`
Expected: FAIL on the two rewritten tests, which still see a `file:` URL, and on the new one.

- [ ] **Step 3: Add the server**

At the top of `cards/export.mjs`, beside the existing imports:

```js
import http from "node:http";
```

Then, above `exportCards`:

```js
// Served rather than opened from disk, because a page that fetches its own data cannot do it
// from file:// — the origin is opaque and both fetch and a JSON module import are blocked. The
// stated reason for file:// was that no card should need a server and `npm run og` should need
// no second terminal, and that survives: the exporter starts one itself and stops it when it is
// done. A card rendered this way was measured byte-identical to one rendered from disk, so no
// committed card moves.
//
// Types are named rather than guessed. A page whose script is served as the wrong type does not
// error — it silently does not run, which is the failure this whole family keeps finding.
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".pdf": "application/pdf",
  ".mp3": "audio/mpeg", ".xml": "application/xml", ".txt": "text/plain",
};

function serve(root) {
  const srv = http.createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(req.url.split("?")[0].split("#")[0]));
    if (file.endsWith(path.sep)) file = path.join(file, "index.html");
    try {
      res.setHeader("content-type", TYPES[path.extname(file)] || "application/octet-stream");
      res.end(fs.readFileSync(file));
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  // Port 0 asks the OS for a free one, so two runs cannot collide and nothing has to be reserved.
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv)));
}
```

If `fs` or `path` are not already imported in this file, add them.

- [ ] **Step 4: Navigate to the served page**

Start the server before the card loop and close it in a `finally`, so a card that throws does not
leave a socket listening. Replace:

```js
      await page.goto(pathToFileURL(path.join(REPO_ROOT, c.dir, "index.html")).href + (c.hash || ""),
        { waitUntil: "networkidle" });
```

with a navigation to `` `${base}/${c.dir}/${c.hash || ""}` `` where `base` is
`` `http://127.0.0.1:${srv.address().port}` ``, keeping `{ waitUntil: "networkidle" }`.

Remove the now-unused `pathToFileURL` import if nothing else in the file uses it — check before
deleting.

- [ ] **Step 5: Run the tests**

Run: `node --test test/cards-export.test.mjs`
Expected: pass, including the three from step 1.

Run: `node --test`
Expected: the whole package passes.

- [ ] **Step 6: Prove no card moves**

The design rests on this and it has been measured once against a replica. Measure it against the
real exporter, in a site, without committing anything there:

The site installs this package from GitHub, so running its `npm run og` unchanged would test the
released version rather than this branch and prove nothing. Point it at this working copy first,
and put it back afterwards:

```bash
cd ../robertblust.github.io
npm install --no-save ../design            # take this working copy, not the pinned release
node -p 'require("fs").readFileSync("node_modules/@robertblust/design/cards/export.mjs","utf8").includes("node:http")'
```

That must print `true`. If it prints `false`, the working copy did not install and the rest of
this step proves nothing — stop and report it.

```bash
cp model/og.png /tmp/og-before.png
npm run og >/dev/null 2>&1
cmp /tmp/og-before.png model/og.png && echo "  card byte-identical" || echo "  CARD MOVED"
git checkout model/og.png model/og.sha 2>/dev/null
npm ci --silent                            # restore the pinned release
git status --porcelain
cd ../design
```

Expected: `card byte-identical`, and an empty `git status` in the site afterwards.

`REPOSITORIES.md` scopes an agent to the repository it is working in. This step reaches into
`robertblust/robertblust.github.io` deliberately and for one purpose: it is the only place a real
card can be re-rendered through the changed exporter, and the design rests on that card not
moving. Leave nothing behind there.

If the card moved, **stop and report it**. Every committed card on three sites would need
re-rendering, which is a decision rather than a step.

- [ ] **Step 7: Commit**

```bash
git add cards/export.mjs test/cards-export.test.mjs
git commit -F - <<'MSG'
The exporter serves the site it photographs

Cards were rendered from file://, so that no card needed a server and npm run og needed no
second terminal. That reason is good and it survives: the exporter starts a server itself, on
a port the OS picks, and stops it when the run ends.

What does not survive is the origin. A page that fetches its own data cannot do it from
file://, where the origin is opaque and both fetch and a JSON module import are blocked, so
the stage could not have moved off its inlined block while its photographs were taken there.

A card rendered over http was measured byte-identical to one rendered from disk, so no
committed card on any site moves and no site re-renders anything.

Verified: node --test passes; a real card re-rendered through the changed exporter compares
byte-identical to the committed one.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
```

---

### Task 4: The version, and the pull request

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Set the version**

`package.json`'s `version` becomes `0.55.0`. `README.md` is explicit about why this belongs in
the change rather than at tag time: `design sync --check` at every site compares the tag its pin
names against the version it installed, and a tag made without moving the field turns three sites
red on their next re-pin.

Do not tag. Do not touch `versions.json`.

- [ ] **Step 2: Confirm the whole package**

Run: `node --test`
Expected: pass.

Run: `sh conventions/conventions-check`
Expected: `✓ every Markdown file follows WRITING.md`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -F - <<'MSG'
The release is v0.55.0

A site takes this one by re-pinning, syncing and changing its own pages in one commit, which
this repository's README calls a major. The number does not say so — every release here has
moved the same position — so the notes carry the warning and the stage carries a loud failure
for the site that re-pins and stops there.

The field moves in the change rather than at tag time, because design sync --check compares
the tag a site pins against the version it installed, and a tag cut without it turns three
sites red on their next re-pin.

Verified: node --test passes; conventions-check passes.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
```

- [ ] **Step 4: Open the pull request and stop**

```bash
git push -u origin stage-fetches-its-data
```

Then open a pull request against `main` with the forge's CLI, describing the change in the git
register — the commit body reread for a reviewer who has not seen the diff. It must say plainly
that this is a major by the repository's own rule and that a site cannot take it by re-pinning
alone.

**Do not tag, do not merge, and do not touch any site.** Those are the owner's.

---

## What follows, for the owner

Not steps in this plan.

**The release is v0.55.0**, and its notes must say what breaks and how to take it, because the
number will not. A site adopts by re-pinning, running `npm run design`, and changing its own
pages **in one commit** — splitting those is what leaves a suite red.

**Then two site changes**, each its own work with its own spec. blust.ch's `build/pages.mjs`
writes the preload link where it wrote the block, `/timeline/`'s own reader fetches the same way,
and its `graph` and `ledger` spec entries stop naming an element id. companygraph.io does the
same for `/example/` and `/model/`. guestgraph.io loads no stage and needs only a routine re-pin.

## Self-review

**Spec coverage.** §2's link contract and the stage's fetch are Task 1; the loud failure is Task 1
step 3 and its message is asserted in Task 2. §2's check is Task 2, its exporter is Task 3. §4's
version is Task 4. §3's site work is deliberately not here. §6's card equivalence is Task 3
step 6, run against the real exporter rather than the replica that measured it first.

**Placeholders.** None. Every code step carries the code; every check step carries the command and
what it should print.

**Type consistency.** `rbStage(data)` is the only new global and matches `rbCard`. `serve(root)`
returns a promise of the server, so the caller reads `srv.address().port` and calls `srv.close()`.
`STAGE_CHECKS.graph` keeps its `(page, spec)` signature and stops reading `spec.graph`.

**One risk worth naming.** Task 1 is the only task whose failure mode is invisible in a passing
test run: if the 905 lines are reindented, everything still works and the diff becomes unreviewable.
Step 2 exists solely to catch that, and it is the one step in this plan that should stop the task
rather than be worked around.
