# Team in the nav, and one data reader — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** design v0.58.0 — `Team` at the head of the nav order, the header contract corrected
to the order the check actually enforces, and the reader that turns `<link data-stage>` into a
parsed model reduced from two copies to one, in `card.js`, called by `stage.js`.

**Architecture:** Three independent changes in one minor release. `verify/pages.mjs` owns the
order the suites enforce; `blocks/header.css` owns the order the contract states; they
disagree today and the test meant to hold them together compares literal strings. The test is
repaired first, which makes it fail, which is what proves it was not doing its job. `card.js`
gains `rbCard.data(who, cb)` and `stage.js` calls it — safe because `card.js` already loads
before `stage.js` on every page that draws a stage, a rule `README.md` states and
`cards-packaging` guards.

**Tech Stack:** plain ES5 browser files under `assets/`, ES modules under `lib/`, `verify/`
and `test/`; `node --test` for everything, with no DOM harness — asset behavior is guarded by
source shape here and proved by each site's Playwright suite.

**Spec:** `robertblust.github.io`, `docs/superpowers/specs/2026-09-16-team-page-design.md`,
§7. The consuming plan is `robertblust.github.io`,
`docs/superpowers/plans/2026-09-16-team-page.md`, and it starts by taking this release.

## Global Constraints

- Every word is en-US: spaced em-dash, curly quotes in prose, no serial comma, "organization"
  and "behavior". `conventions/conventions-check` holds this repository's Markdown.
- A fenced block under `blocks/` is generated into sixteen pages across three sites. Changing
  one byte of it means bumping its version in `versions.json` in the same commit; `fences` and
  `blocks` tests fail otherwise.
- `assets/` files are copied verbatim into a site. They are ES5 — no `let`, no `const`, no
  arrow functions, no template literals — because a deck opens from `file://` in whatever the
  visitor has.
- This package has no DOM. An assertion about `card.js` or `stage.js` behavior is a source
  guard here and a Playwright assertion in a site's suite. Say which is which in the test's
  own comment.
- Commits are authored by Rob with the tool in a `Co-Authored-By` trailer. The subject is a
  sentence under seventy characters, no type prefix, no trailing period. The body is prose,
  no headers and no bullets, ending with one `Verified:` line naming what ran.
- One branch, `team-nav-and-data-reader`, off `main`. One pull request, opened and not merged.
  Never chain a branch delete after a merge.

---

### Task 1: Make the order test compare the two lists

The test named "the header contract's order comment agrees with navOrder" passes today while
the two disagree: `ORDER` names API and the contract comment does not. It matches two literal
strings. Repair it before changing either list, so that the repair is what exposes the drift
rather than the drift being fixed silently under a green test.

**Files:**
- Modify: `test/verify-pages.test.mjs:618-622`

**Interfaces:**
- Consumes: `pageChecks(OPTS).navOrder`, already imported in this file.
- Produces: nothing other tasks import. Task 2 makes this test pass again.

- [ ] **Step 1: Replace the string-matching test with one that parses both lists**

Replace the whole `test("the header contract's order comment agrees with navOrder", …)` block
with this:

```js
// Both lists, parsed and compared — not two strings matched. The previous form asserted that
// header.css contained the words "order Ideas, Principles, …" and that navOrder contained a
// literal ORDER line, and both held while API sat in one list and not the other. A contract
// that disagrees with the check enforcing it is worse than no contract, and this is the test
// that has to notice.
test("the header contract's order comment names exactly what navOrder enforces", () => {
  const src = pageChecks(OPTS).navOrder.toString();
  const m = /const ORDER = \[([^\]]+)\]/.exec(src);
  assert.ok(m, "navOrder has no ORDER list");
  const enforced = m[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);

  const css = fs.readFileSync(path.join(PKG, "blocks/header.css"), "utf8");
  const c = /·\s*order\s+([^·]+?)\s*then the language control/s.exec(css);
  assert.ok(c, "the header contract states no order");
  const stated = c[1].replace(/\s+/g, " ").replace(/,\s*$/, "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  assert.deepEqual(stated, enforced,
    `the contract states ${stated.join(", ")}; navOrder enforces ${enforced.join(", ")}`);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/verify-pages.test.mjs`
Expected: FAIL, one test, with a message of the form
`the contract states Ideas, Principles, Model, Timeline, Example, Talks, Billing, Privacy; navOrder enforces API, Ideas, Principles, Model, Timeline, Example, Talks, Billing, Privacy`

That failure is the finding. Do not fix it in this task — Task 2 fixes it, and the two commits
read as "the test was wrong" then "the contract was wrong", which is the order they happened in.

- [ ] **Step 3: Commit the failing test**

```bash
git add test/verify-pages.test.mjs
git commit -m "The order test compares the two lists instead of matching strings"
```

Body, as prose ending in a `Verified:` line:

```
A test named for agreement between the header contract and navOrder matched two literal
strings, so it passed while ORDER named API and the contract did not. It now parses both
lists and compares them, and it fails on the disagreement it was written to catch.

The failure is left standing in this commit. The contract is corrected in the next one, so
that the history says the test was wrong before it says the contract was.

Verified: node --test test/verify-pages.test.mjs fails on one test, naming both lists.
```

---

### Task 2: Team at the head of both orders, and the header contract to v9

**Files:**
- Modify: `verify/pages.mjs:522`
- Modify: `blocks/header.css:12-15`
- Modify: `versions.json:3`
- Modify: `test/verify-pages.test.mjs` (the Timeline-after-Model test, and the fence version it asserts)

**Interfaces:**
- Consumes: the failing test from Task 1.
- Produces: `ORDER` = `["Team", "API", "Ideas", "Principles", "Model", "Timeline", "Example", "Talks", "Billing", "Privacy"]`, and header contract `v9`. The site plan's Task 1 asserts both.

- [ ] **Step 1: Write the failing test for Team's position**

Add this beside the existing `navOrder's rule names Timeline after Model` test in
`test/verify-pages.test.mjs`:

```js
// Team is first because the order is read right to left: the switcher sits at the edge and
// each step left is more the site's own subject. Nothing is more the site's own subject than
// who does the work, so nothing may be inserted before it.
test("navOrder's rule puts Team first", () => {
  const src = pageChecks(OPTS).navOrder.toString();
  const m = /const ORDER = \[([^\]]+)\]/.exec(src);
  assert.ok(m, "navOrder has no ORDER list");
  const order = m[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
  assert.equal(order[0], "Team");
  assert.equal(order.indexOf("API"), 1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/verify-pages.test.mjs`
Expected: FAIL on two tests — the new one with `expected 'Team' to equal 'API'`, and Task 1's,
still reporting the two lists disagree.

- [ ] **Step 3: Put Team at the head of ORDER**

In `verify/pages.mjs`, line 522, replace:

```js
      const ORDER = ["API", "Ideas", "Principles", "Model", "Timeline", "Example", "Talks", "Billing", "Privacy"];
```

with:

```js
      const ORDER = ["Team", "API", "Ideas", "Principles", "Model", "Timeline", "Example", "Talks", "Billing", "Privacy"];
```

- [ ] **Step 4: Correct the header contract to the same list**

In `blocks/header.css`, replace these four lines:

```
       · order      Ideas, Principles, Model, Timeline, Example, Talks, Billing, Privacy,
                    then the language control. A site skips what it does not have and
                    reorders nothing. Read right to left, the switcher is at the edge and
                    each step left is more the site's own subject.
```

with:

```
       · order      Team, API, Ideas, Principles, Model, Timeline, Example, Talks, Billing,
                    Privacy, then the language control. A site skips what it does not have
                    and reorders nothing. Read right to left, the switcher is at the edge
                    and each step left is more the site's own subject. API was missing from
                    this list for one release while the check enforced it; the test that
                    compares the two lists is what stops that happening again.
```

- [ ] **Step 5: Bump the fence version, because the fenced bytes changed**

In `blocks/header.css`, line 1, change `header contract · v8 · shared` to
`header contract · v9 · shared`.

In `versions.json`, change `"header": "v8"` to `"header": "v9"`.

In `test/verify-pages.test.mjs`, the assertion `assert.match(css, /header contract · v8 · shared/)`
was removed with the old test in Task 1; confirm no other test names v8:

Run: `grep -rn "header contract · v8\|\"header\": \"v8\"" test/ lib/ blocks/ versions.json`
Expected: no output.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS, all tests, including Task 1's comparison and the new Team test.

- [ ] **Step 7: Commit**

```bash
git add verify/pages.mjs blocks/header.css versions.json test/verify-pages.test.mjs
git commit -m "Team leads the nav order, and the contract says what the check enforces"
```

Body:

```
The order is read right to left, the switcher at the edge and each step left more the site's
own subject, so Team leads it: nothing a site says about itself comes before who does the
work. blust.ch takes it as a sixth item; a site without a team page is unaffected, because
the check filters the order by what the page shows.

The contract in header.css is corrected to the same list in the same commit. It had lost API
a release ago and would have lost Team now. The comment sits inside the fence, so the block
is v9 and every page of every site rewrites that comment on its next sync; nothing but the
comment changes.

Verified: npm test, 55 tests, all pass.
```

---

### Task 3: One reader, in card.js

`assets/stage.js` and blust.ch's `timeline/index.html` each carry a near-identical copy of
"find `link[data-stage]`, fetch it, hand the parsed block over from a timeout". The team page
would be the third. Move it into `card.js`, which every page that reads the model already
loads, and which loads before `stage.js` by a rule `README.md` states.

**Files:**
- Modify: `assets/card.js` (add `rbCard.data`, export it beside `render`)
- Modify: `assets/stage.js:938-965` (call it instead of repeating it)
- Modify: `test/assets.test.mjs`
- Modify: `README.md` (the paragraph describing what a stage page loads)

**Interfaces:**
- Consumes: nothing from Tasks 1 and 2.
- Produces: `rbCard.data(who, cb)` — `who` is a string naming the caller for the error
  messages, `cb` is called with the parsed JSON. It throws synchronously when the page names
  no data; it logs and does not throw when the fetch fails. Both the site plan's team page and
  the timeline call it.

- [ ] **Step 1: Write the failing source guards**

Add to `test/assets.test.mjs`:

```js
// A source guard, not a unit test: this package has no DOM and nothing here executes the
// bootstrap. The behavior is proved by each site's Playwright suite, which loads the page.
test("card.js owns the data reader, and names the caller in what it throws", () => {
  const js = asset("assets/card.js");
  assert.match(js, /rbCard = \{[^}]*data: data/, "rbCard does not export data");
  assert.match(js, /function data\(who, cb\)/, "card.js has no data(who, cb)");
  assert.match(js, /querySelector\("link\[data-stage\]"\)/, "data() does not find the link");
  assert.match(js, /who \+ ": this page names no data/,
    "the throw does not name the caller, so the message cannot say which script wanted it");
  assert.match(js, /crossorigin/, "the message does not spell the markup it wants");
});

test("stage.js calls the shared reader rather than carrying its own", () => {
  const js = asset("assets/stage.js");
  assert.match(js, /rbCard\.data\("stage\.js"/, "stage.js does not call the shared reader");
  assert.ok(!/querySelector\("link\[data-stage\]"\)/.test(js),
    "stage.js still finds the link itself — that is the second copy this release removed");
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test test/assets.test.mjs`
Expected: FAIL on both new tests — `card.js has no data(who, cb)` and
`stage.js does not call the shared reader`.

- [ ] **Step 3: Add the reader to card.js**

In `assets/card.js`, immediately above the final `window.rbCard = …` line, add:

```js
  // ── the data a page names ───────────────────────────────────────────────────────────
  // One copy of "find the block this page names, fetch it, hand it over". It lived in
  // stage.js and was copied into blust.ch's timeline, which is how the card itself drifted
  // in seven places a week earlier; a third page wanting the model is what made one copy
  // worth the release. Callers name themselves, so the message says which script wanted the
  // data rather than leaving the reader to guess.
  //
  // The throw is deliberate and the log is deliberate, and they are not the same case. A
  // page that names no data is a mistake in the page, found at build time by whoever forgot
  // the link, and an uncaught exception is what every site's suite reports through its
  // pageerror listener. A fetch that fails is a network or a deploy, and a throw inside a
  // promise chain would become an unhandled rejection, which nothing here listens for.
  //
  // The callback runs from a timeout rather than from the chain, so a throw inside the
  // drawing stays an uncaught exception too.
  function data(who, cb){
    var link = document.querySelector("link[data-stage]");
    if (!link) {
      throw new Error(who + ": this page names no data. Add <link rel=\"preload\" as=\"fetch\" " +
        "href=\"…\" data-stage crossorigin> and rebuild the page.");
    }
    fetch(link.href).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (parsed) {
      setTimeout(function () { cb(parsed); }, 0);
    }, function (err) {
      console.error(who + ": could not read " + link.href + " — " + err.message);
    });
  }
```

Then change the export line from:

```js
  window.rbCard = { render: render, fmtPeriod: fmtPeriod, fmtDate: fmtDate, describe: describe };
```

to:

```js
  window.rbCard = { render: render, fmtPeriod: fmtPeriod, fmtDate: fmtDate, describe: describe, data: data };
```

- [ ] **Step 4: Make stage.js call it**

In `assets/stage.js`, replace the whole bootstrap IIFE that begins `(function(){` at line 943
and ends with its closing `})();` — the block containing `querySelector("link[data-stage]")`,
the throw, and the `fetch(...)` chain — with:

```js
(function(){
  // The reader is card.js's, and card.js is loaded before this file on every page that draws
  // a stage: README.md states the order and the packaging test guards it. A page that loaded
  // this file without it would fail here on rbCard rather than further in, which is the same
  // failure it had before, one line earlier.
  rbCard.data("stage.js", rbStage);
})();
```

`rbStage` is what the old chain called on success, from inside its own timeout; `rbCard.data`
now owns that timeout, so the function is passed rather than wrapped. Keep the comment block
above the IIFE that explains the `data-stage` markup and the loud failure — only the
implementation moves.

Run: `grep -n "setTimeout(function" assets/stage.js`
Expected: the old bootstrap's timeout is gone; any remaining match belongs to the drawing.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS, all tests.

- [ ] **Step 6: Update README.md**

In the paragraph that begins "A page that draws a stage names the file it draws and loads
three scripts in this order", add after the sentence about `card.js` before `stage.js`:

```
`card.js` also owns the reader that finds that link and fetches it, `rbCard.data(who, cb)`, so
a page that shows cards without drawing a graph reads the model with the same call and the
same error message. That is why the order is a requirement and not a preference: `stage.js`
calls into `card.js` on load, not only on the first click.
```

- [ ] **Step 7: Commit**

```bash
git add assets/card.js assets/stage.js test/assets.test.mjs README.md
git commit -m "One reader finds the model, and card.js is where it lives"
```

Body:

```
Finding the link a page names, fetching it and handing the block over existed twice, in
stage.js and in blust.ch's timeline, in near-identical words. A team page would have made it
three, and this family has already paid once for a copied helper: the card drifted in seven
places within a day of being copied out of stage.js.

It moves to card.js, which every page reading the model already loads and which loads before
stage.js on every page that draws one. Callers name themselves so the message says which
script wanted the data. A page that names no data still throws, because that is a mistake in
the page and every suite reports an uncaught exception; a fetch that fails still logs, because
a throw there would be an unhandled rejection nothing listens for.

Verified: npm test, 57 tests, all pass.
```

---

### Task 4: Release v0.58.0

**Files:**
- Modify: `package.json` (version)
- No other file.

**Interfaces:**
- Consumes: Tasks 1 to 3, merged.
- Produces: the tag `v0.58.0`, which the site plan's Task 1 pins.

- [ ] **Step 1: Open the pull request and stop**

```bash
git push -u origin team-nav-and-data-reader
gh pr create --title "Team leads the nav order, and one reader finds the model" --body "$(cat <<'BODY'
Three changes in one minor release, and the first of them is why the other two are in the same
branch. The test that was meant to hold the header contract and the navOrder check to the same
list matched two literal strings, and passed while ORDER named API and the contract did not.
It now parses both lists and compares them.

With that test honest, Team goes at the head of both. The order is read right to left, each
step left more the site's own subject, and nothing a site says about itself comes before who
does the work. The contract's comment is inside the fence, so the block is v9 and every page
of every site rewrites that comment on its next sync; nothing but the comment changes.

Separately, the reader that turns a page's <link data-stage> into a parsed model moves out of
stage.js into card.js as rbCard.data(who, cb). It existed twice and a third page was about to
copy it, which is the same shape of mistake the card made a week ago. stage.js calls it; the
timeline and the coming team page on blust.ch call it too.

Verified: npm test, 57 tests, all pass; conventions-check passes.
BODY
)"
```

Do not merge. Rob merges, tags and publishes; the branch is deleted as its own step, never
chained after the merge.

- [ ] **Step 2: After Rob merges, tag and publish**

This step is Rob's. The release notes are the pull request body reread for a consumer: what
changed for them, what breaks and how to take it. Nothing breaks. A site takes the whole
release with a re-pin and `npm run design`, and gets `card.js`, `stage.js` and the header
fence on every page that carries it.

---

## Self-review

Spec §7 names three things: Team at the head of `ORDER`, the header contract corrected and
bumped, and `rbCard.data`. Tasks 2 and 3 cover all three; Task 1 covers the finding §1 records
and §7 refers to. Nothing in §7 is unassigned.

No task says "similar to" another, every code step carries the code, and the one place a name
could drift — `rbCard.data(who, cb)` — is written identically in Task 3's interface block, its
test, its implementation and `stage.js`'s call.
