# Every home page shows its vision — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** companygraph.io and guestgraph.io show their vision with three checking tiles and their values with each "We never" line under their own openings, and their /principles/ reads in German; the parts blust.ch built for itself become the design package's.

**Architecture:** robertblust/design ships one minor: `render/home` accepts "We never", `render/german` (moved from blust.ch), a `home` CSS fence in `page.css`, and the `home` check in the shared page checks. blust.ch re-pins and drops its three copies. Then each site re-pins, gets its model words translated by the roles, renders German /principles/, adds the two sections, translates its own words and holds the page with the shared check.

**Tech Stack:** Node 22 ESM, `node:test`, Playwright, plain HTML/CSS.

**Spec:** `docs/superpowers/specs/2026-09-27-every-home-shows-its-vision-design.md` in robertblust/design (commit 3cd002d, branch `every-home-shows-its-vision`).

**Reference implementation:** blust.ch at main (`~/git/robertblust/robertblust.github.io`): `index.html` (sections `#vision`, `#values`, `#latest`, `#now`), `build/german.mjs`, `build/pages.mjs`, `build/principles.de.json`, the `home` check in `verify/check.mjs`, and the home rules in `index.html`'s `<style>`. Port from it; do not reinvent.

## Global Constraints

- Each site's opening is unchanged byte for byte: headline, tagline, buttons, and companygraph.io's graph and its notes.
- Tiles: Ask (`<button class="tile" type="button" data-chat-open>`), See the model (`model/`), and the third: companygraph.io *See the example* (`example/`), guestgraph.io *Read the API* (`api/`). Every link same-tab.
- Values heading "{n} values, each with the thing <em>we never do</em>." with the number word from the renderer; kicker "What we hold to". Vision kicker "The vision".
- No newest-post section on companygraph.io or guestgraph.io.
- German of model words lives in each site's `build/principles.de.json` (`[{ "en", "de" }]`, looked up by the exact English); the models stay English.
- German is made by the roles of `conventions/WRITING.md` (translator, editor, back-reader, then a comparison against the English); the owner picks flagged choices. Site words are translated only after the owner has reviewed the English on the rendered page.
- Swiss Standard German (ss, never ß; guillemets; spaced en-dash); no straight `"` inside a German value; nested markup in `data-de` single-quoted. en-US English.
- Commits and PR bodies in the git register, ending `Verified: …`, then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` (PR bodies: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`).
- Merging, tagging and releasing wait for the owner's word. Worktrees beside each clone, named `<repo>-<branch>`. `export PATH=/opt/homebrew/bin:$PATH`; push over https with `git -c credential.helper= -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push`.
- A local server on port 8000 may be someone else's: never stop it; serve on another port and set `BASE`.

## Review Focus

- A model whose value ends in neither "I never" nor "We never": the build refuses with the value's id. Pinned in D1.
- companygraph.io's model lives under `company` in its combined artifact and is served as `/company.json`: the loader, the renderers and the check must read that one, not `example.json`. Pinned in C3 and C5.
- blust.ch after dropping its copies renders byte-identical pages. Pinned in B1 (`pages:check` and `og:check` clean without `npm run og` moving a picture).
- A home page with no blog: the shared check must not look for one. Pinned in D4.
- German heading grammar with "wir": must read for any plural count. Pinned in C5 and G5 by the roles.

---

## Part D — robertblust/design (worktree `~/git/robertblust/design-every-home-shows-its-vision`, branch `every-home-shows-its-vision`)

### Task D1: "We never" beside "I never"

**Files:** `lib/render/home.mjs`, `test/home.test.mjs`.

- [ ] Add a failing test: a value whose first section ends "We never ship a thing." renders its row with that line; a value ending "They never…" still throws naming its id.
- [ ] In `neverOf`, accept a last paragraph that begins "I never" or "We never" (`/^(I|We) never/`); keep the error form, changing its wording to `does not begin "I never" or "We never"`. Update the existing error-message test if it pins the old wording.
- [ ] `npm test` passes; commit "The home renderer takes a company's never as well as a person's".

### Task D2: The German loader moves into the package

**Files:** create `lib/render/german.mjs`, `test/german-loader.test.mjs`; modify `package.json` exports (`"./render/german": "./lib/render/german.mjs"`).

- [ ] Copy blust.ch's `build/german.mjs` and its four `loadGerman`/`strings` tests from `build/renderers.test.mjs` (they are the source of truth). Imports become relative (`./principles.mjs`). The error messages name the file the site passed in rather than the literal `build/principles.de.json`: `loadGerman(file)` uses `path.relative(process.cwd(), file)` or the given string.
- [ ] Tests first against the new path; see them fail; add the module; pass. `npm test`; commit "The German loader is the package's, for every site".

### Task D3: The home rules as a fence

**Files:** create `blocks/home.css`; modify `versions.json` (`"home": "v1"`), `lib/assemble.mjs` (a `{ fence: "home", variant: () => null }` part at the end of `page.css`), whatever `test/blocks.test.mjs` and `test/assemble.test.mjs` pin about the list of fences.

- [ ] Read how `blocks/index.css` is written (header comment naming the pages that carry it and why, version marker line) and write `blocks/home.css` the same way, carrying blust.ch's rules verbatim: `.sec`, `.kicker`, `.sec h2`, `.values…`, `.tiles`, `.tile…`, the 760px query, plus the two rules the sections rely on that blust.ch keeps in its own page style, scoped so they cannot touch another page's `h2` or `.lede`: `.sec h2{font-weight:600; letter-spacing:-.025em; line-height:1.06; font-size:clamp(1.9rem,3.7vw,3rem)}`, `.sec h2 em{font-style:normal; color:var(--c-mid)}`, `.sec .lede{margin-top:1.5rem; font-size:clamp(1rem,1.35vw,1.18rem); color:var(--dim); max-width:52ch}`, and a reduced-motion rule dropping the transitions. Leave out `.sec .index` (blust.ch's blog row, which stays its own).
- [ ] Tests first where the suite pins fences; `npm test`; commit "The home sections' rules are one fence".

### Task D4: The home check is shared

**Files:** `verify/pages.mjs` (inside `pageChecks`), its test file (`test/verify-pages.test.mjs`, following how other page checks are tested there).

- [ ] Move blust.ch's `home` check into `pageChecks` as `async home(page, spec)`, reading `spec.home`: `{ model: "/model.json" | "/company.json", blog?: "/blog/" }`. It fetches `BASE + spec.home.model`, compares value rows (names, order by `path`, count) and each anchor against `BASE + "/principles/"`, the vision heading, opens the chat from `[data-chat-open]`, checks stacking at 390px; the newest-post comparison runs only when `spec.home.blog` is set. Keep blust.ch's comments on why.
- [ ] A fixture test where the suite tests DOM checks: a page with two value rows against a two-value model passes; a row out of order fails naming it; no `blog` key means no blog request.
- [ ] `npm test`; commit "The home check holds any site's home page".

### Task D5: Release

- [ ] Bump `package.json` version to the next minor; README: `render/german`, the `home` fence, the shared `home` check with its spec shape, and "We never". `npm test`, conventions checks. Commit, push, open the PR, report checks, **stop** for the owner's merge; then, on the owner's word, tag and release with notes (what a site gains; blust.ch drops its copies; a re-pin needs `npm run design` and `npm run pages`).

---

## Part B — blust.ch (worktree `robertblust.github.io-home-from-the-package`)

### Task B1: blust.ch takes the release and drops its copies

- [ ] Re-pin to the new tag (`npm install --save-dev "github:robertblust/design#<tag>"`, `npm run design`).
- [ ] `build/pages.mjs` and `build/german-strings.mjs` import `loadGerman`/`strings` from `@robertblust/design/render/german`; delete `build/german.mjs`; move its tests out of `build/renderers.test.mjs` (they live in the package now).
- [ ] Delete the home rules from `index.html`'s `<style>` that the fence now carries; keep `.sec .index` and anything the fence does not carry.
- [ ] Replace the site's own `home` check with the shared one: delete it from `verify/check.mjs` and set the `/` spec's `home: { model: "/model.json", blog: "/blog/" }`.
- [ ] `npm run pages:check`, `test:build`, `design:check`, `og:check` (run `npm run og` only if it reports stale, and confirm no `og.png` bytes changed), `sitemap:check`, conventions checks, `BASE=… npm run verify`. Screenshot `/` at 1440 and 390 and compare with the live page: nothing may move. Commit, PR, stop.

---

## Part C — companygraph.io (worktree `companygraph.github.io-home-shows-its-vision`)

### Task C1: Re-pin

- [ ] Re-pin design to the new tag, `npm run design`, `npm run pages` (the principles ids arrive), `npm run og`/`sitemap` as needed, the site's full gate. Commit.

### Task C2: The German of the model's words (controller, with the owner)

- [ ] `strings(d.company)` over the site's artifact gives the English list; run translator, editor, back-reader, comparison; the owner picks flags; write `build/principles.de.json`. Commit.

### Task C3: /principles/ in German

- [ ] In `build/pages.mjs`, `loadGerman(path.join(ROOT, "build", "principles.de.json"))` and pass `de: german.de` to `writePrinciples(d.company, …)`; fail on `german.unused()` as blust.ch does. Update the `/principles/` `translates` spec (a German value name shown, the English hidden, «übersetzt aus dem Englischen» shown). `npm run pages`, gate, cards. Commit.

### Task C4: The two sections, in English (owner reviews)

- [ ] Under the opening in `index.html`, the `#vision` section (kicker, `<!-- vision:start/end -->`, three tiles) and the `#values` section (kicker, `<!-- values:start/end -->`), markup as blust.ch's. `build/pages.mjs` adds `writeHome(d.company, { ...o, root: ROOT, de: german.de, heading: { en: "{n} values, each with the thing <em>we never do</em>." } })`. Check the regions' anchors resolve (/principles/ ids). Gate; screenshots at 1440 and 390. The owner reviews the English on the rendered page before C5. Commit.

### Task C5: The site's words in German, and the check

- [ ] Roles on the kickers, tiles and heading template (with "wir"); owner picks flags; `data-de` on each element, `heading.de` in `build/pages.mjs`.
- [ ] `/` spec: `home: { model: "/company.json" }`; `translates` shows «DIE VISION» and the German heading's opening words, hides the English ones.
- [ ] Prove the check can fail (a deliberate wrong selector, run, restore). `npm run og`, `npm run sitemap`, full gate, `npx design german stale origin/main HEAD`, verify. Commit, push, PR, stop.

---

## Part G — guestgraph.io (worktree `guestgraph.github.io-home-shows-its-vision`)

### Tasks G1–G5

Exactly Part C for guestgraph.io, with these differences: the artifact is `model.json` with the model at its root (`writePrinciples(d, …)`, `writeHome(d, …)`, `strings(d)`); the third tile is *Read the API* linking `api/`; the check's spec is `home: { model: "/model.json" }`; the heading's number word is Seven. Its seven values make C2's translation the larger one.
