# Shared CSS as Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** What this package shares becomes five files a site copies and its pages name, rather than blocks copied into every page, and blust.ch proves it before the other two sites follow.

**Architecture:** `design sync` keeps writing every fence it writes today and gains a second output: whole files assembled from the same blocks, with each variant chosen once in `design.config.json` rather than once per page. A page then links `tokens.css` and `page.css` and loads `page.js`; a deck links `tokens.css` and `deck.css` and loads `deck.js`. The theme boot stays a fence. The shared scripts stop sharing scope with the page and take their hooks through one object the page declares before loading them.

**Tech Stack:** `@robertblust/design` (Node, no bundler), the three sites' Playwright suites, `design sync` and its fence machinery in `lib/`.

**Spec:** `docs/superpowers/specs/2026-09-23-shared-css-as-files-design.md`

## Global Constraints

- The theme boot stays a fence and stays first in the head: nothing that can block or repaint may precede it, which `noFlash` asserts on every page.
- A release may not need the file and the page at once. The file ships first and the page follows, so every step here leaves both halves green on their own.
- The package keeps writing the fences until all three sites have moved; nothing is deleted from `lib/fences.mjs` in this plan.
- Every rendered byte stays what it is: no rule is rewritten, renamed or reordered while it moves, so a card's picture never changes, only its stamp.
- No build step, no bundler, no hash in a file name, no CDN: files are copied and named by path.
- Commits in the git register with the trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`; a pull request is opened and stops there.
- `export PATH=/opt/homebrew/bin:$PATH` before every `node`, `npm` or `gh` command.

## The files, and where each variant is chosen

| File | Assembled from | Variant, and who chooses it |
| --- | --- | --- |
| `tokens.css` | `blocks/tokens.css` | none: the file always closes `:root`, and a deck's own tokens move into `deck.css` as a second `:root` rule |
| `page.css` | `blocks/reset.css`, `blocks/header.css`, `blocks/title.css`, `blocks/footer.css`, `blocks/footer-credit.css`, `blocks/principles.css`, `blocks/team.css`, `blocks/surfaces.css` | the footer's credit: `design.config.json` says `"footer": "credit"` or `"plain"`, and the credit rules are written only for `credit` |
| `page.js` | `blocks/lang.js` (page), `blocks/theme.js` (page), `blocks/nav-fit.js` | none |
| `deck.css` | `blocks/deck-transport.css`, `blocks/deck-lockup.css`, one of `blocks/deck-lockup-one.css` or `-two.css`, and the deck's own `:root` tokens | the lockup: `design.config.json` says `"lockup": "one"` or `"two"` |
| `deck.js` | `blocks/lang.js` (deck), `blocks/theme.js` (deck), `blocks/deck-runtime.js`, `blocks/deck-fit.js` | none |

## The hook object

A fenced script sees the page's variables; a file does not. `blocks/lang.js` reads a `lang` variable the page declares and calls the page's `applyLang()`, and `blocks/deck-runtime.js` reads the page's `TALK` and `UI`. So a page declares one object before it loads the file, and the file reads only that:

```html
<script>window.rbPage = { lang: "en", applyLang: applyLang };</script>
<script src="page.js" defer></script>
```

- `rbPage.applyLang(lang)` — the page's own swap of its `data-de` elements. `page.js` calls it after it has decided the language and whenever the language changes, and sets `document.documentElement.lang` itself.
- `rbPage.lang` — what the page rendered as. `page.js` reads it once and owns the value afterwards.
- A deck declares `window.rbDeck = { talk: TALK, ui: UI }` for the same reason, and `deck.js` reads those two.
- A page that declares nothing gets the defaults and no error: `page.js` runs its own language and theme, calls nobody, and a page with no `data-de` needs nothing more.

---

### Task 1: The files are assembled and written

**Files:**

- Modify: `lib/groups.mjs`, `lib/sync.mjs`, `README.md`
- Create: `lib/assemble.mjs`, `test/assemble.test.mjs`

**Interfaces:**

- Consumes: `FENCES` and the block sources in `blocks/`, unchanged.
- Produces: `assemble(name, config)` returning the bytes of one of the five files, and a `files` group whose entries are written by `design sync` exactly as `chat.css` is.

- [ ] **Step 1: Write the failing test.** In `test/assemble.test.mjs`, assert that `assemble("page.css", { footer: "plain" })` contains the reset's first rule and the header's, does not contain a `footer .credit` rule, and carries no fence marker; that `assemble("page.css", { footer: "credit" })` does contain one; that `assemble("deck.css", { lockup: "one" })` contains `.name .namemark` and not `.name .rbmark`, and the reverse for `"two"`; that `assemble("tokens.css", {})` closes its `:root` rule; and that every file ends in exactly one newline.
- [ ] **Step 2: Run it and read the failure.** `npm test` names the missing module.
- [ ] **Step 3: Write `lib/assemble.mjs`.** One exported function, a table of the five files and their sources in the order the table above gives, each block read from `blocks/`, dedented by the two spaces a fenced block carries, joined by one blank line, with a header comment naming the package and the release and saying that editing the file in a site does nothing. Variants come from the config object and nowhere else; an unknown variant is an error naming the file and the key.
- [ ] **Step 4: Run the test.** Green.
- [ ] **Step 5: Add the group.** In `lib/groups.mjs` a `files` group whose entries are the five names, written through `assemble` rather than copied from `assets/`. `design sync` writes them when a site names the group; `design sync --check` compares the bytes it would write with what is there, which is what it already does for `chat.css`.
- [ ] **Step 6: Commit.** Subject: `The shared blocks can be written as whole files`.

---

### Task 2: The scripts take their hooks from one object

**Files:**

- Modify: `blocks/lang.js`, `blocks/theme.js`, `blocks/deck-runtime.js`
- Test: `test/hooks.test.mjs`

- [ ] **Step 1: Write the failing test.** Load each assembled script in a Node stub with a `window` and a `document`, once with `window.rbPage` declared and once without, and assert: the language is read and written through the family key, `applyLang` is called when it is declared and nothing throws when it is not, and `deck.js` reads `rbDeck.talk` rather than a bare `TALK`.
- [ ] **Step 2: Run it and read the failure.**
- [ ] **Step 3: Make each block read the object.** In `blocks/lang.js`, replace the page-scope contract in its header comment with the hook, read `window.rbPage && window.rbPage.lang` for the initial value, and call `window.rbPage.applyLang` where the block calls `applyLang()` today, guarded. The same for `blocks/theme.js` where it touches the page, and for `blocks/deck-runtime.js`'s `TALK` and `UI`.
- [ ] **Step 4: Run the test.** Green, and `npm test` still green: the fenced form has to keep working, because no site has moved yet.
- [ ] **Step 5: Commit.** Subject: `A shared script takes what it needs from one object`.

---

### Task 3: The checks know the files

**Files:**

- Modify: `verify/design.mjs` (`noFlash`, `fontsAvailable`), `README.md`
- Test: the package's own tests for those checks

- [ ] **Step 1: Write the failing tests.** `noFlash` passes a page whose boot fence precedes every `<link>` and `<script src>` and fails one where a stylesheet link precedes it. `fontsAvailable` reads the faces from a linked `tokens.css` as well as from a fenced block.
- [ ] **Step 2: Run them and read the failures.**
- [ ] **Step 3: Make the checks read both shapes.**
- [ ] **Step 4: Run the suite.** Green.
- [ ] **Step 5: Commit.** Subject: `The page checks read a linked stylesheet too`.

---

### Task 4: The deck exporter serves the tree

**Files:**

- Modify: `decks/export.mjs`
- Test: `test/decks-export.test.mjs`

- [ ] **Step 1: Write the failing test.** The exporter takes a base URL and asks for `<base>/<deck>/`, and refuses a `file://` base with a sentence naming this change.
- [ ] **Step 2: Run it and read the failure.**
- [ ] **Step 3: Serve.** Start a static server on a free port over the site root, as `cards/export.mjs` does, and pass the base through; close it in a `finally`.
- [ ] **Step 4: Run the test, and export a real deck.** `npm run pdf` in blust.ch against this checkout produces both PDFs and they open.
- [ ] **Step 5: Commit.** Subject: `A deck is exported from a served page`.

---

### Task 5: The release

- [ ] **Step 1:** Set `version` in `package.json` to `0.80.0`.
- [ ] **Step 2:** Write the release notes in the prose register: what the files are, that the fences still ship, that a site takes them by naming the `files` group and editing its pages, that this is a major, and that the deck exporter now serves.
- [ ] **Step 3:** Commit, open the pull request, report the checks and stop.

---

### Task 6: blust.ch takes the files

**Files:**

- Modify: `package.json` (pin), `design.config.json`, every page and both decks, `AGENTS.md`
- Create (by sync): `tokens.css`, `page.css`, `page.js`, `deck.css`, `deck.js`

- [ ] **Step 1: The pin and the config.** Pin design v0.80.0 by name, add `"files"` to `groups` and `"footer": "plain"`, `"lockup": "one"`. Run `npm run design`; the five files appear at the root.
- [ ] **Step 2: One page first.** In `privacy/index.html`, delete the fenced blocks the files now carry, leave the theme boot fence where it is, and add after it `<link rel="stylesheet" href="../tokens.css">`, `<link rel="stylesheet" href="../page.css">`, and before `</body>` the hook object and `<script src="../page.js" defer></script>`. Run the suite against a served copy: every check that page declares passes, the language control still switches, the theme control still switches, and nothing flashes.
- [ ] **Step 3: The rest of the pages,** one commit for all of them once the first is green.
- [ ] **Step 4: The decks.** The same for `talks/mental-model/` and `talks/essential-complexity/` with `deck.css` and `deck.js` and the `rbDeck` object, then `npm run pdf` and both PDFs read.
- [ ] **Step 5: Cards, sitemap, checks.** `npm run og`, `npm run og:check`, `npm run sitemap`, `npm run design:check`, the two conventions checks.
- [ ] **Step 6: AGENTS.md.** Rewrite what it says about fences and about `file://`: the decks are served now, the shared CSS is a file, and the boot fence is the one copy left.
- [ ] **Step 7: Commit, open the pull request, report and stop.**

---

## Self-review

Spec coverage: the five files, the surviving fence, the exporter, the four checks and the site adoption each have a task. The other two sites are deliberately out of this plan: they take the same release once blust.ch is live, and their own pages differ enough that a fresh brief is honest.

Placeholders: none. Every task names its files, its test and its commit subject.

Type consistency: `assemble(name, config)` is produced in Task 1 and consumed in Tasks 1 and 3; `window.rbPage` and `window.rbDeck` are defined in Task 2 and written into pages in Task 6.
