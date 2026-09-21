# Links are checked — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every link a site owns is resolved before it ships and fails the build when it does not land, and every link to someone else's site is checked weekly and reported in one issue per repository.

**Architecture:** One engine under `verify/links/` in four modules with one job each: `resolve.mjs` decides (pure, no browser, no network), `collect.mjs` reads a served site in a browser it is handed, `judge.mjs` asks the web about an external link, `issue.mjs` keeps the one GitHub issue. `verify/links.mjs` composes them into `checkOwn` and `checkExternal`, and `bin/design.mjs` gains `design links [--external] [--base <url>]`, importing the site's own Playwright. Each site adds one CI step and a hand-written `links.yml`.

**Tech Stack:** Node 22 ES modules; `node --test`; Playwright (`chromium`, passed in as a parameter, a devDependency of this package for its own tests only); the GitHub REST API through `fetch`.

**Spec:** [`docs/superpowers/specs/2026-09-21-links-are-checked-design.md`](../specs/2026-09-21-links-are-checked-design.md)

## Global constraints

- A link is **own** when it is relative (resolved onto the served origin) or its host is the site's `CNAME`; any other `http`/`https` link is **external**; every other scheme (`mailto:`, `tel:`, `javascript:`, `data:`) is skipped.
- An own path must name a file in the checkout; a path ending in `/` must name a folder with an `index.html`; a path without the slash naming such a folder lands too, because GitHub Pages redirects it.
- A `#fragment` on a page that **loads `stage.js`** must name a node in the file its `<link data-stage>` names: an entity id, the data's `rootId`, or any leading `/`-separated part of an entity id. A stage page whose `<link data-stage>` has no `href` fails. A fragment on any other page must be an element `id` after scripts ran, or `top`. A fragment on a file that is not a page is ignored. Every query string, `?stage=` among them, is ignored.
- External verdicts: `HEAD`, then `GET` whenever `HEAD` is not 2xx/3xx, and the `GET` is what is judged; timeout **10 seconds**; at most **4** requests in flight and **1 per host**; **one retry** of a link whose first verdict is not ok. **ok** 2xx/3xx; **broken** 404, 410, or a host name that does not resolve (`ENOTFOUND`); **unverifiable** everything else (401, 403, 429, 999, 5xx, timeout, refused).
- `--base` defaults to `http://127.0.0.1:8000`, the address every site's CI already waits on.
- Neither mode passes on nothing: a crawl that loads no page, or a run that finds no own link, exits 1. `--external` exits 0 whatever it finds and 1 only when the check could not run.
- The issue title is exactly `Broken external links`, one per repository.
- **This package's `dependencies` stay empty.** Playwright is its one devDependency, for the fixture site's tests; `collect.mjs` never imports it.
- Shipped files (`verify/`, `bin/`, `README.md`) are American English; `test/spelling.test.mjs` holds them.
- A Markdown paragraph is one line; tables are compact.
- Never write a count or version of something that still moves, in prose. Program output may print counts.
- Work in `~/git/robertblust/design-links-are-checked` on `links-are-checked`; each site in a sibling worktree `<repo>-links-are-checked`. The clones stay on `main`.
- Commits and pull request bodies are in the git register of `conventions/WRITING.md`: prose, no headings or bullets, a `Verified:` line, then `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Pull request bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Merging and tagging are the owner's.** An agent opens a pull request, reports its checks and stops. Merge with `gh pr merge --merge`, never squash, and only on the owner's word.
- `export PATH=/opt/homebrew/bin:$PATH` before any command. Check an exit code on its own, never through a pipe. Shell state does not carry from one command to the next: a `TAG`, `PORT` or `SERVER_PID` printed in one step is written into the next by its value.
- A local server starts on a free port, and only the PID that was started is stopped.
- companygraph/companygraph.github.io is not touched before Task 8.

---

### Task 1: The resolver decides whether an own link lands

**Files:**

- Create: `verify/links/resolve.mjs`
- Create: `test/links-resolve.test.mjs`
- Modify: `package.json` (`scripts.test`)

**Interfaces:**

- Consumes: nothing.
- Produces, from `verify/links/resolve.mjs`:
  - `URL_STRING: RegExp` — an absolute http(s) URL and nothing else
  - `classify(href: string, { host: string, origin: string }) → { kind: "own"|"external", url: URL } | { kind: "skip" }`
  - `shown(c: { kind, url }) → string` — path+search+hash for own, full href for external
  - `pageKey(pathname: string, root: string) → string | null` — `/`, `/about/`, `/x.html`; `/about` becomes `/about/` when `about/index.html` exists; null for a file that is not a page
  - `pageExists(key: string, root: string) → boolean`
  - `stageIds(data: { rootId?, entities? }) → Set<string>`
  - `modelUrls(data: any, file: string) → { url: string, from: string }[]` — `from` is `file` or `` `${file} · ${id}` `` for the nearest enclosing object with a string `id`
  - `resolveOwn(url: URL, { root: string, pages: Map<string, { ids: Set<string>, stage: boolean, data: string|null }>, idsOf: (file: string) => Set<string> }) → string | null` — the reason it does not land, or null

The fixture pages of Task 2 carry `.js` files, and `node --test` with no argument runs every `.js` under a `test/` folder as a test. So this task narrows the test script to the suite's own files first; today every test file already matches `test/*.test.mjs`, so the set run does not change.

- [ ] **Step 1: Narrow the test script**

In `package.json`, change `scripts.test`:

```json
"test": "node --test \"test/*.test.mjs\""
```

Before editing, run `export PATH=/opt/homebrew/bin:$PATH; cd ~/git/robertblust/design-links-are-checked; node --test; echo "exit=$?"` and note the `# tests` line. After editing, run `npm test; echo "exit=$?"`. Expected: `exit=0` both times, and the same `# tests` count.

- [ ] **Step 2: Write the failing tests**

Create `test/links-resolve.test.mjs`:

```js
// The part of the link checker that decides, with no browser and no network. Every answer the
// command gives about an own link comes from here, so a rule that is wrong is wrong in these
// tests first, against a folder built for the purpose.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  URL_STRING, classify, shown, pageKey, pageExists, stageIds, modelUrls, resolveOwn,
} from "../verify/links/resolve.mjs";

const SITE = { host: "fixture.test", origin: "http://127.0.0.1:8000" };

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "design-links-"));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
}

test("a link is own on the served origin or the CNAME's host, external elsewhere, skipped otherwise", () => {
  assert.equal(classify("http://127.0.0.1:8000/about/", SITE).kind, "own");
  assert.equal(classify("https://fixture.test/about/", SITE).kind, "own");
  assert.equal(classify("http://fixture.test/", SITE).kind, "own");
  assert.equal(classify("http://127.0.0.1:9000/x", SITE).kind, "external", "another port is another site");
  assert.equal(classify("https://example.org/x", SITE).kind, "external");
  assert.equal(classify("https://www.fixture.test/", SITE).kind, "external", "only the CNAME's own host");
  for (const href of ["mailto:a@example.org", "tel:+41", "javascript:void(0)", "data:font/woff2;base64,AA", "not a url"])
    assert.equal(classify(href, SITE).kind, "skip", href);
});

test("an own link is shown by its path, an external one in full", () => {
  assert.equal(shown(classify("https://fixture.test/model/?stage=expanded#a/b", SITE)), "/model/?stage=expanded#a/b");
  assert.equal(shown(classify("http://127.0.0.1:8000/model/?stage=expanded#a/b", SITE)), "/model/?stage=expanded#a/b");
  assert.equal(shown(classify("https://example.org/x?y=1", SITE)), "https://example.org/x?y=1");
});

test("a path is keyed as the page it is, or not a page at all", () => {
  const root = tree({ "index.html": "", "about/index.html": "", "x.html": "", "model.json": "{}" });
  assert.equal(pageKey("/", root), "/");
  assert.equal(pageKey("/about/", root), "/about/");
  assert.equal(pageKey("/about/index.html", root), "/about/");
  assert.equal(pageKey("/about", root), "/about/", "GitHub Pages redirects a folder to its slash");
  assert.equal(pageKey("/x.html", root), "/x.html");
  assert.equal(pageKey("/model.json", root), null);
  assert.equal(pageKey("/missing", root), null);
  assert.equal(pageExists("/about/", root), true);
  assert.equal(pageExists("/missing/", root), false);
  assert.equal(pageExists("/x.html", root), true);
});

test("a stage finds a node for every entity, the root, and every folder above an entity", () => {
  const ids = stageIds({ rootId: "identity", entities: [{ id: "identity" }, { id: "skills/a" }, { id: "profiles/rb/skills/b" }] });
  for (const id of ["identity", "skills/a", "skills", "profiles", "profiles/rb", "profiles/rb/skills", "profiles/rb/skills/b"])
    assert.ok(ids.has(id), id);
  assert.ok(!ids.has("skills/z"));
  assert.ok(!ids.has("profiles/rb/skill"), "a folder is a whole segment, not a string prefix");
});

test("every absolute URL string in a model is found, with the entity it sits in", () => {
  const data = {
    repo: "robertblust/mental-model",
    entities: [
      { id: "a", fields: { url: "https://example.org/a" }, sections: [{ rows: [["x", "https://example.org/ref"]] }] },
      { id: "b", name: "not a url", tagline: "see https://example.org/in prose" },
    ],
    home: "https://fixture.test/",
  };
  assert.deepEqual(modelUrls(data, "model.json"), [
    { url: "https://example.org/a", from: "model.json · a" },
    { url: "https://example.org/ref", from: "model.json · a" },
    { url: "https://fixture.test/", from: "model.json" },
  ]);
  assert.ok(URL_STRING.test("https://x.test/a?b#c"));
  assert.ok(!URL_STRING.test("see https://x.test"));
});

test("an own link lands only where the checkout and the page it names say it does", () => {
  const root = tree({
    "index.html": "", "about/index.html": "", "model/index.html": "", "nodata/index.html": "",
    "slides.pdf": "", "model.json": "{}",
  });
  const pages = new Map([
    ["/", { ids: new Set(), stage: false, data: null }],
    ["/about/", { ids: new Set(["team", "late"]), stage: false, data: null }],
    ["/model/", { ids: new Set(["stage"]), stage: true, data: "model.json" }],
    ["/nodata/", { ids: new Set(), stage: true, data: null }],
  ]);
  const idsOf = (file) => (file === "model.json" ? new Set(["root", "things", "things/a"]) : new Set());
  const at = (href) => resolveOwn(new URL(href, "http://127.0.0.1:8000/"), { root, pages, idsOf });

  assert.equal(at("/"), null);
  assert.equal(at("/about/"), null);
  assert.equal(at("/about"), null);
  assert.equal(at("/slides.pdf"), null);
  assert.equal(at("/slides.pdf#page=2"), null, "a fragment on a file that is not a page is not looked for");
  assert.equal(at("/missing/"), "no page here");
  assert.equal(at("/missing.pdf"), "no file here");
  assert.equal(at("/about/#team"), null);
  assert.equal(at("/about/#late"), null);
  assert.equal(at("/about/#top"), null);
  assert.equal(at("/about/#nobody"), "no element with id nobody on /about/");
  assert.equal(at("/model/?stage=expanded#things/a"), null);
  assert.equal(at("/model/#things/a"), null, "the stage reads a hash with or without ?stage=");
  assert.equal(at("/model/#things"), null, "a folder is a node");
  assert.equal(at("/model/#stage"), "no node stage in model.json", "on a stage page an element id is not a node");
  assert.equal(at("/model/?stage=expanded#things/ghost"), "no node things/ghost in model.json");
  assert.equal(at("/nodata/#things/a"), "/nodata/ draws a stage and names no data, so #things/a cannot be drawn");
  assert.equal(at("/about/?lang=de#team"), null, "a query string is ignored");
  assert.equal(at("/x.html#a"), "no file here");
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `node --test test/links-resolve.test.mjs; echo "exit=$?"` Expected: `exit=1`, `Cannot find module '…/verify/links/resolve.mjs'`.

- [ ] **Step 4: Write the resolver**

Create `verify/links/resolve.mjs`:

```js
// Which links a site owns, and whether an own link lands. Nothing here touches the network or a
// browser: every answer comes from the checkout and from what collect.mjs read off the served
// pages, so the part of the link checker that decides is tested with plain `node --test`.
import fs from "node:fs";
import path from "node:path";

// An absolute http(s) URL and nothing else, the form a model's references and Also at rows take.
export const URL_STRING = /^https?:\/\/\S+$/;

function isFile(root, rel) {
  return fs.statSync(path.join(root, rel), { throwIfNoEntry: false })?.isFile() ?? false;
}

function decoded(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// Own: on the origin the site is served from, which is where the browser resolved every relative
// link, or on the host its CNAME names. External: any other http(s) URL. Skip: mailto:, tel:,
// javascript:, data: and anything else that is not a page on the web.
export function classify(href, { host, origin }) {
  let url;
  try { url = new URL(href); } catch { return { kind: "skip" }; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "skip" };
  if (url.origin === origin || url.hostname === host) return { kind: "own", url };
  return { kind: "external", url };
}

// How a link is named in a report: an own link by its path, so the served origin and the domain
// spell the same link the same way; an external one in full.
export function shown(c) {
  return c.kind === "own" ? c.url.pathname + c.url.search + c.url.hash : c.url.href;
}

// The page a path is, keyed the way the crawl keys what it loaded, or null for a file that is not
// a page. `/about` is the page `/about/` when that folder has an index.html, because GitHub Pages
// redirects the one to the other.
export function pageKey(pathname, root) {
  const p = decoded(pathname);
  if (p.endsWith("/")) return p;
  if (p.endsWith("/index.html")) return p.slice(0, -"index.html".length);
  if (p.endsWith(".html")) return p;
  if (isFile(root, `${p.slice(1)}/index.html`)) return `${p}/`;
  return null;
}

// Whether the checkout holds the file a page key is served from.
export function pageExists(key, root) {
  return isFile(root, key.endsWith("/") ? `${key.slice(1)}index.html` : key.slice(1));
}

// Every id a stage finds a node for in its data: each entity, the root, and every leading part of
// an entity's id, which the stage draws as the folder holding it. assets/stage.js walks an id down
// from the root one segment at a time, so every prefix of an id is a node.
export function stageIds(data) {
  const ids = new Set();
  if (data?.rootId) ids.add(data.rootId);
  for (const e of data?.entities ?? []) {
    ids.add(e.id);
    const parts = e.id.split("/");
    for (let i = 1; i < parts.length; i++) ids.add(parts.slice(0, i).join("/"));
  }
  return ids;
}

// Every absolute URL string in a model file, with where it was found: the file, and the id of the
// nearest object around it that has one, which in a model is the entity. Generic on purpose: the
// model's shape is the parser's to change, and a URL is a URL wherever it sits.
export function modelUrls(data, file) {
  const out = [];
  (function walk(v, where) {
    if (typeof v === "string") { if (URL_STRING.test(v)) out.push({ url: v, from: where }); return; }
    if (!v || typeof v !== "object") return;
    const here = !Array.isArray(v) && typeof v.id === "string" ? `${file} · ${v.id}` : where;
    for (const x of Object.values(v)) walk(x, here);
  })(data, file);
  return out;
}

// Why an own link does not land, or null when it does. `pages` maps a page key to what the crawl
// read off that page: its element ids after its scripts ran, whether it loads stage.js, and the
// data file its <link data-stage> names as a path from the root. `idsOf` gives stageIds for a file.
//
// A stage page is judged by its data, not its markup, because a stage shown an id it does not hold
// draws its root and looks fine: the one place a wrong link cannot be seen by looking at it.
export function resolveOwn(url, { root, pages, idsOf }) {
  const p = decoded(url.pathname);
  if (p.endsWith("/")) {
    if (!isFile(root, `${p.slice(1)}index.html`)) return "no page here";
  } else if (!isFile(root, p.slice(1)) && !isFile(root, `${p.slice(1)}/index.html`)) {
    return "no file here";
  }
  const id = decoded(url.hash.slice(1));
  if (!id) return null;
  const key = pageKey(url.pathname, root);
  if (!key) return null;
  const page = pages.get(key);
  if (!page) return `${key} was never loaded, so #${id} could not be looked for`;
  if (page.stage) {
    if (!page.data) return `${key} draws a stage and names no data, so #${id} cannot be drawn`;
    return idsOf(page.data).has(id) ? null : `no node ${id} in ${page.data}`;
  }
  return id === "top" || page.ids.has(id) ? null : `no element with id ${id} on ${key}`;
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test test/links-resolve.test.mjs; echo "exit=$?"` then `npm test; echo "exit=$?"` Expected: both `exit=0`. `test/spelling.test.mjs` scans `verify/`, so a British spelling in a comment fails here.

- [ ] **Step 6: Commit**

```bash
git add package.json verify/links/resolve.mjs test/links-resolve.test.mjs
git commit -F - <<'EOF'
The link checker can tell whether an own link lands

A link lands when the checkout holds what it names, and a fragment lands when the page it names holds the id. On a page that loads stage.js the id has to be a node in the page's data, an entity, the root or a folder above one, because a stage shown an id it does not hold draws its root and looks fine. This part decides with no browser and no network, so every rule is held by plain tests against a folder built for them. The test script names the suite's own files, since the fixture site that follows carries scripts node --test would otherwise run as tests.

Verified: npm test exits 0, with the new resolver tests among it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: The site is read the way a visitor's browser meets it

**Files:**

- Create: `verify/links/collect.mjs`
- Create: `test/fixtures/links/` (the fixture site, files listed in Step 3)
- Create: `test/links-site.test.mjs`
- Create: `package-lock.json` (by npm)
- Modify: `package.json` (`devDependencies`)
- Modify: `.github/workflows/ci.yml`
- Modify: the comments at `test/cards-export.test.mjs:1-3`, `test/decks-export.test.mjs:1-2`, `test/theme.test.mjs:740-741`

**Interfaces:**

- Consumes: `sitemapLocs` from `lib/crawl.mjs`; `classify`, `pageKey`, `pageExists`, `stageIds`, `modelUrls` from Task 1.
- Produces, from `verify/links/collect.mjs`:
  - `collect({ root: string, base: string, chromium, settleMs?: number = 150, stepMs?: number = 25 }) → Promise<Site>` where `Site = { host: string, origin: string, pages: Map<string, { ids: Set<string>, stage: boolean, data: string|null }>, found: Map<string, Set<string>>, problems: { link: string, reason: string, from: string[] }[], idsOf: (file: string) => Set<string> }`. `found` maps each absolute href to where it was found: a page key, `` `${key} (card)` ``, `sitemap.xml`, or a `modelUrls` `from`.
  - Throws `nothing answers at <origin>; serve the site there first` after ten seconds without an answer, a message naming `CNAME and sitemap.xml` when either is missing, and `no page named by sitemap.xml is in this checkout…` when nothing was loaded.

The owner chose a real browser for these tests over a fake one. That reverses a line four test comments and the CI comment state as a hard rule, that this package takes no dependency even for its tests, so this task rewrites those comments rather than leaving them false: the package still ships no dependency, and a site that installs it never installs Playwright through it, because npm installs a dependency's dependencies and not its devDependencies.

- [ ] **Step 1: Take Playwright as the one devDependency**

```bash
export PATH=/opt/homebrew/bin:$PATH
cd ~/git/robertblust/design-links-are-checked
npm install --save-dev "playwright@^1.63.0"; echo "exit=$?"
npx playwright install chromium; echo "exit=$?"
node -e 'const p=require("./package.json"); if (p.dependencies && Object.keys(p.dependencies).length) process.exit(1); console.log(p.devDependencies)'; echo "exit=$?"
```

Expected: three `exit=0`, and `{ playwright: '^1.63.0' }`.

- [ ] **Step 2: Rewrite CI and the four comments**

In `.github/workflows/ci.yml`, replace the `test` job's `timeout-minutes` and steps with:

```yaml
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: "22"
          cache: npm
      # This package has no dependencies, and having none is a property worth keeping: three
      # sites install it, and every transitive dependency it took would land in all three. Its
      # one devDependency, Playwright, loads the link checker's fixture site in a real browser,
      # and never reaches a site, because npm installs a dependency's dependencies and not its
      # devDependencies.
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: The sync tool still does what it says
        run: npm test
```

In `test/cards-export.test.mjs`, lines 1–3 become:

```js
// exportCards against a fake browser, never Playwright. The package has no dependencies, and the
// one devDependency it has, Playwright, is for the link checker's fixture site; these tests stay on
// a fake because what they assert is the record of calls made to the browser, not what it drew.
```

In `test/decks-export.test.mjs`, lines 1–2 become:

```js
// exportDecks against a fake browser and a fake PDFDocument, never Playwright and never pdf-lib.
// The package has no dependencies; what these tests assert is the calls made, which a fake records.
```

`test/theme.test.mjs:10-11` says the package has no dependencies, which stays true, and is left alone. Lines 740–741 become:

```js
  // not a bigger pattern. No dependency: this package ships none, and its one devDependency is
  // Playwright for the link checker's tests; a CSS parser here would be a second, for one check.
```

Run: `npm test; echo "exit=$?"` Expected: `exit=0`.

- [ ] **Step 3: Build the fixture site**

The fixture is a site with one of each thing the spec's §4 names. Every file below is created under `test/fixtures/links/`.

`CNAME`:

```text
fixture.test
```

`sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://fixture.test/</loc></url>
  <url><loc>https://fixture.test/about/</loc></url>
  <url><loc>https://fixture.test/model/</loc></url>
  <url><loc>https://fixture.test/ledger/</loc></url>
  <url><loc>https://fixture.test/lineage/</loc></url>
</urlset>
```

`style.css`:

```css
@font-face { font-family: Present; src: url(fonts/present.woff2) format("woff2"); }
@font-face { font-family: Absent; src: url(fonts/missing.woff2) format("woff2"); }
body { font-family: Present, Absent, sans-serif; }
```

`fonts/present.woff2`:

```text
not a real font; the checker asks only that the file is there
```

`model.json`:

```json
{
  "rootId": "root",
  "entities": [
    { "id": "root", "see": [] },
    { "id": "things/a", "see": ["things/b"], "url": "https://example.org/reference" },
    { "id": "things/b", "see": ["things/void"], "home": "https://fixture.test/gone/" }
  ]
}
```

`stage.js` (a stand-in for the family's stage: it reads the data its page names and, on each hash, writes the focused node's links into `#card`):

```js
(function () {
  var link = document.querySelector("link[data-stage]");
  var card = document.getElementById("card");
  if (!link || !link.getAttribute("href")) return;
  fetch(link.href).then(function (r) { return r.json(); }).then(function (data) {
    var byId = {};
    data.entities.forEach(function (e) { byId[e.id] = e; });
    function show() {
      var e = byId[decodeURIComponent(location.hash.slice(1))];
      card.innerHTML = "";
      if (e) e.see.forEach(function (id) {
        var a = document.createElement("a"); a.href = "#" + id; a.textContent = id; card.appendChild(a);
      });
    }
    window.addEventListener("hashchange", show);
    show();
  });
})();
```

`index.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Fixture</title>
<link rel="stylesheet" href="style.css">
<link rel="canonical" href="https://fixture.test/">
<meta property="og:url" content="https://fixture.test/">
<meta property="og:image" content="https://fixture.test/og.png">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Person","url":"https://fixture.test/about/","sameAs":["https://example.org/elsewhere"]}</script>
</head>
<body>
<a href="about/">a page that is there</a>
<a href="missing/">a page that is not</a>
<a href="about/#team">an element that is there</a>
<a href="about/#nobody">an element that is not</a>
<a href="about/#late">an element a script makes</a>
<a href="model/?stage=expanded#things/a">an entity in the data</a>
<a href="model/?stage=expanded#things/ghost">an entity not in the data</a>
<a href="model/#things">a folder in the data</a>
<a href="model/#things/nope">a bare hash naming no entity</a>
<a href="nodata/#things/a">a stage that names no data</a>
<a href="ledger/#row-1">a row on a page that reads the model without a stage</a>
<a href="noopener/">a page that reads the model and opens no card</a>
<a href="https://fixture.test/about/">an own link written absolute</a>
<a href="https://example.org/page">an external link</a>
<a href="mailto:someone@example.org">mail</a>
<a href="talks/deck/">a deck the sitemap does not name</a>
</body>
</html>
```

`about/index.html`:

```html
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>About</title></head>
<body>
<h2 id="team">Team</h2>
<a href="../">home</a>
<script>var p = document.createElement("p"); p.id = "late"; document.body.appendChild(p);</script>
</body>
</html>
```

`model/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><title>Model</title>
<link rel="preload" as="fetch" href="../model.json" data-stage crossorigin>
</head>
<body>
<div id="stage"></div>
<div id="card"></div>
<script src="../stage.js"></script>
</body>
</html>
```

`nodata/index.html`:

```html
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>No data</title><link data-stage></head>
<body>
<div id="stage"></div>
<div id="card"></div>
<script src="../stage.js"></script>
</body>
</html>
```

`ledger/index.html` (the timeline's shape: it reads the model, has an Open all, and writes stage links from its own script):

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><title>Ledger</title>
<link rel="preload" as="fetch" href="../model.json" data-stage crossorigin>
</head>
<body>
<button type="button" id="openall">Open all</button>
<details id="row-1"><summary>One</summary><div class="cbody"></div></details>
<details id="row-2"><summary>Two</summary><div class="cbody"></div></details>
<script>
  var targets = { "row-1": "things/b", "row-2": "things/lost" };
  document.getElementById("openall").addEventListener("click", function () {
    [].forEach.call(document.querySelectorAll("details"), function (d) {
      d.open = true;
      var a = document.createElement("a");
      a.href = "../model/?stage=expanded#" + targets[d.id];
      a.textContent = targets[d.id];
      d.querySelector(".cbody").appendChild(a);
    });
  });
</script>
</body>
</html>
```

`lineage/index.html` (Surfaces's shape: one card per chosen item, its links going to `STAGE_PAGE`):

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><title>Lineage</title>
<link rel="preload" as="fetch" href="../model.json" data-stage crossorigin>
</head>
<body>
<button type="button" class="ln-s" data-id="things/a">A</button>
<button type="button" class="ln-s" data-id="things/b">B</button>
<div id="lnpanel"></div>
<script>
  var STAGE_PAGE = "../model/";
  [].forEach.call(document.querySelectorAll(".ln-s"), function (b) {
    b.addEventListener("click", function () {
      var panel = document.getElementById("lnpanel"), a = document.createElement("a");
      a.href = STAGE_PAGE + "?stage=expanded#" + b.getAttribute("data-id");
      a.textContent = b.getAttribute("data-id");
      panel.innerHTML = ""; panel.appendChild(a);
    });
  });
</script>
</body>
</html>
```

`noopener/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><title>No opener</title>
<link rel="preload" as="fetch" href="../model.json" data-stage crossorigin>
</head>
<body><p>Reads the model and offers nothing that opens a card.</p></body>
</html>
```

`talks/deck/index.html`:

```html
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Deck</title></head>
<body><a href="../../slides.pdf">the slides</a></body>
</html>
```

- [ ] **Step 4: Write the failing tests**

Create `test/links-site.test.mjs`:

```js
// The link checker against a site served over http and read by a real browser. A card's links
// exist only after a script wrote them and a fragment may name an element a script made, so a fake
// browser would test a fake site. The fixture under test/fixtures/links holds one of each case the
// spec names; the expectations below are the whole of what it should find.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { collect } from "../verify/links/collect.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, "fixtures", "links");

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };

// A static server shaped like GitHub Pages: a folder is served from its index.html, a folder asked
// for without its slash is redirected to it, and anything missing is a 404.
export function serve(root) {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(root, p);
    const st = fs.statSync(file, { throwIfNoEntry: false });
    if (st?.isDirectory() && !p.endsWith("/")) { res.writeHead(301, { location: `${p}/` }); res.end(); return; }
    if (st?.isDirectory()) file = path.join(file, "index.html");
    if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
  })));
}

let site, served;
before(async () => {
  served = await serve(FIXTURE);
  site = await collect({ root: FIXTURE, base: served.base, chromium });
});
after(() => served.close());

const where = (href) => [...(site.found.get(href) ?? [])].sort();

test("every page the sitemap names is loaded, and every own page they reach", () => {
  assert.deepEqual([...site.pages.keys()].sort(), [
    "/", "/about/", "/ledger/", "/lineage/", "/model/", "/nodata/", "/noopener/", "/talks/deck/",
  ]);
  assert.ok(!site.pages.has("/missing/"), "a page not in the checkout is not loaded");
});

test("what a page says about itself is kept for the resolver", () => {
  assert.ok(site.pages.get("/about/").ids.has("late"), "ids are read after scripts ran");
  assert.deepEqual({ ...site.pages.get("/model/"), ids: undefined }, { ids: undefined, stage: true, data: "model.json" });
  assert.deepEqual({ ...site.pages.get("/nodata/"), ids: undefined }, { ids: undefined, stage: true, data: null });
  assert.equal(site.pages.get("/ledger/").stage, false, "reading the model is not drawing a stage");
  assert.equal(site.pages.get("/ledger/").data, "model.json");
});

test("links are read from the markup, the head, JSON-LD and the stylesheets", () => {
  const o = served.base;
  assert.deepEqual(where(`${o}/missing/`), ["/"]);
  assert.deepEqual(where("https://fixture.test/og.png"), ["/"]);
  assert.deepEqual(where("https://example.org/elsewhere"), ["/"]);
  assert.deepEqual(where(`${o}/fonts/missing.woff2`), ["/"]);
  assert.deepEqual(where(`${o}/fonts/present.woff2`), ["/"]);
  assert.deepEqual(where(`${o}/slides.pdf`), ["/talks/deck/"], "a deck the sitemap does not name is still read");
  assert.deepEqual(where("https://fixture.test/"), ["/", "sitemap.xml"]);
  assert.ok(site.found.has("mailto:someone@example.org"), "found, and left to the resolver to skip");
});

test("every card is opened, by Open all, by each item, and by each node of a stage", () => {
  const o = served.base;
  assert.deepEqual(where(`${o}/model/?stage=expanded#things/b`), ["/ledger/ (card)", "/lineage/ (card)"]);
  assert.deepEqual(where(`${o}/model/?stage=expanded#things/lost`), ["/ledger/ (card)"]);
  assert.deepEqual(where(`${o}/model/?stage=expanded#things/a`), ["/", "/lineage/ (card)"]);
  assert.deepEqual(where(`${o}/model/#things/b`), ["/model/ (card)"]);
  assert.deepEqual(where(`${o}/model/#things/void`), ["/model/ (card)"]);
});

test("a page that reads the model and opens no card is a problem, not a silence", () => {
  assert.deepEqual(site.problems, [{
    link: "/noopener/",
    reason: "carries a <link data-stage> and none of #openall, .openall, .ln-s or #stage, so its cards cannot be opened",
    from: ["/noopener/"],
  }]);
});

test("the model's URL strings are found, with the entity each sits in", () => {
  assert.deepEqual(where("https://example.org/reference"), ["model.json · things/a"]);
  assert.deepEqual(where("https://fixture.test/gone/"), ["model.json · things/b"]);
  assert.ok(site.idsOf("model.json").has("things"));
});

test("a site that is not served, or whose sitemap names nothing here, is an error", async () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "design-links-empty-"));
  fs.writeFileSync(path.join(empty, "CNAME"), "fixture.test\n");
  fs.writeFileSync(path.join(empty, "sitemap.xml"), "<urlset><url><loc>https://fixture.test/gone/</loc></url></urlset>");
  const s = await serve(empty);
  await assert.rejects(collect({ root: empty, base: s.base, chromium }), /no page named by sitemap\.xml is in this checkout/);
  await s.close();
  await assert.rejects(collect({ root: FIXTURE + "-nowhere", base: served.base, chromium }), /CNAME and sitemap\.xml/);
});
```

- [ ] **Step 5: Run the tests to see them fail**

Run: `node --test test/links-site.test.mjs; echo "exit=$?"` Expected: `exit=1`, `Cannot find module '…/verify/links/collect.mjs'`.

- [ ] **Step 6: Write the collector**

Create `verify/links/collect.mjs`:

```js
// What a site links to, read the way a visitor's browser meets it: every page the sitemap names
// and every own page those pages reach, loaded and run, its cards opened, and the model files its
// pages read searched for the URLs they carry. The browser is a parameter, as it is in
// cards/export: this module never imports Playwright, and the bin hands it the site's own.
import fs from "node:fs";
import path from "node:path";

import { sitemapLocs } from "../../lib/crawl.mjs";
import { classify, pageKey, pageExists, stageIds, modelUrls } from "./resolve.mjs";

const NO_OPENER = "carries a <link data-stage> and none of #openall, .openall, .ln-s or #stage, so its cards cannot be opened";

// Runs in the page, so it is self-contained: Playwright sends it as source. It reads every link a
// visitor's browser would follow or fetch, the head included, since that is what crawlers and link
// previews read, and what the resolver needs to know about the page itself.
function readPage() {
  const links = [];
  const add = (raw, base) => {
    if (raw == null || !raw.trim()) return;
    try { links.push(new URL(raw.trim(), base).href); } catch {}
  };
  const isUrl = (s) => /^https?:\/\/\S+$/.test(s);
  for (const el of document.querySelectorAll("[href], [src]")) {
    add(el.getAttribute("href"), document.baseURI);
    add(el.getAttribute("src"), document.baseURI);
  }
  for (const m of document.querySelectorAll("meta[content]")) {
    const c = m.getAttribute("content").trim();
    if (isUrl(c)) add(c, document.baseURI);
  }
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    let parsed;
    try { parsed = JSON.parse(s.textContent); } catch { continue; }
    (function walk(v) {
      if (typeof v === "string") { if (isUrl(v)) add(v, document.baseURI); }
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    })(parsed);
  }
  // A rule's own declarations are read from its style, and a rule that holds rules is walked into:
  // a style rule can do both once CSS nests, and an @font-face's src is only in its style.
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    const base = sheet.href || document.baseURI;
    (function walk(list) {
      for (const r of list) {
        const text = r.style ? r.style.cssText : (r.cssRules ? "" : r.cssText);
        for (const m of text.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) add(m[2], base);
        if (r.cssRules) walk(r.cssRules);
      }
    })(rules);
  }
  const stageLink = document.querySelector("link[data-stage]");
  return {
    links,
    ids: [...document.querySelectorAll("[id]")].map((e) => e.id),
    hasDataStage: !!stageLink,
    data: stageLink ? stageLink.getAttribute("href") : null,
    stage: [...document.scripts].some((s) => s.src && /\/stage\.js$/.test(new URL(s.src).pathname)),
  };
}

// Runs in the page: opens every card the page offers and returns the links the cards wrote that
// were not on the page before. Team and the timeline have an Open all, one per board on Team, and
// each is pressed once; Surfaces opens a card per surface; a stage opens one per node, by the hash
// it reads. Null when the page offers none of these.
async function openCards({ ids, settleMs, stepMs }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const hrefs = () => [...document.querySelectorAll("a[href]")]
    .map((a) => { try { return new URL(a.getAttribute("href"), document.baseURI).href; } catch { return null; } })
    .filter(Boolean);
  const before = new Set(hrefs()), out = new Set();
  const take = () => { for (const h of hrefs()) if (!before.has(h)) out.add(h); };
  const alls = [...document.querySelectorAll("#openall, .openall")];
  const items = [...document.querySelectorAll(".ln-s")];
  if (alls.length) { alls.forEach((b) => b.click()); await wait(settleMs); take(); }
  else if (items.length) for (const b of items) { b.click(); await wait(stepMs); take(); }
  else if (document.getElementById("stage")) for (const id of ids) { location.hash = id; await wait(stepMs); take(); }
  else return null;
  return [...out];
}

// The served copy has to answer before a browser is pointed at it. CI starts the server in the
// background a step earlier, so this waits for it the way the sites' own wait step does.
async function waitFor(origin, { tries = 20, delayMs = 500 } = {}) {
  for (let i = 0; i < tries; i++) {
    try { const res = await fetch(`${origin}/`); await res.body?.cancel(); return; }
    catch { await new Promise((r) => setTimeout(r, delayMs)); }
  }
  throw new Error(`nothing answers at ${origin}; serve the site there first`);
}

export async function collect({ root, base, chromium, settleMs = 150, stepMs = 25 }) {
  const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
  let host, sitemap;
  try { host = read("CNAME").trim(); sitemap = read("sitemap.xml"); }
  catch (e) { throw new Error(`the link checker reads CNAME and sitemap.xml at the site root: ${e.message}`); }
  const origin = new URL(base).origin;
  await waitFor(origin);

  // A data file a page names but the checkout lacks is not read here: the link naming it is in
  // `found` like any other, and the resolver reports it missing.
  const parsed = new Map();
  const model = (file) => {
    if (!parsed.has(file)) {
      if (!fs.existsSync(path.join(root, file))) parsed.set(file, null);
      else {
        try { parsed.set(file, JSON.parse(read(file))); }
        catch (e) { throw new Error(`could not read ${file}, the data a page names: ${e.message}`); }
      }
    }
    return parsed.get(file);
  };
  const nodes = new Map();
  const site = {
    host, origin, pages: new Map(), found: new Map(), problems: [],
    idsOf: (file) => { if (!nodes.has(file)) nodes.set(file, stageIds(model(file))); return nodes.get(file); },
  };

  const queue = [], queued = new Set();
  const found = (href, from) => {
    if (!site.found.has(href)) site.found.set(href, new Set());
    site.found.get(href).add(from);
    const c = classify(href, site);
    if (c.kind !== "own") return;
    const key = pageKey(c.url.pathname, root);
    if (key && !queued.has(key) && pageExists(key, root)) { queued.add(key); queue.push(key); }
  };
  for (const loc of sitemapLocs(sitemap)) found(loc, "sitemap.xml");

  const models = new Set();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    while (queue.length) {
      const key = queue.shift();
      await page.goto(origin + encodeURI(key), { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(settleMs);
      const got = await page.evaluate(readPage);
      const named = got.data ? new URL(got.data, origin + encodeURI(key)) : null;
      const data = named && named.origin === origin ? decodeURIComponent(named.pathname.slice(1)) : null;
      site.pages.set(key, { ids: new Set(got.ids), stage: got.stage, data });
      for (const href of got.links) found(href, key);
      if (data && !models.has(data)) {
        models.add(data);
        for (const m of modelUrls(model(data), data)) found(m.url, m.from);
      }
      if (got.hasDataStage) {
        const ids = data ? (model(data)?.entities ?? []).map((e) => e.id) : [];
        const cards = await page.evaluate(openCards, { ids, settleMs, stepMs });
        if (cards === null) site.problems.push({ link: key, reason: NO_OPENER, from: [key] });
        else for (const href of cards) found(href, `${key} (card)`);
      }
    }
  } finally {
    await browser.close();
  }
  if (!site.pages.size) throw new Error(`no page named by sitemap.xml is in this checkout, so nothing was loaded from ${origin}`);
  return site;
}
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `node --test test/links-site.test.mjs; echo "exit=$?"` then `npm test; echo "exit=$?"` Expected: both `exit=0`. If a card test fails on timing alone, raise `stepMs` in the test's `collect` call, not in the default, and say so in the commit.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .github/workflows/ci.yml verify/links/collect.mjs test/fixtures/links test/links-site.test.mjs test/cards-export.test.mjs test/decks-export.test.mjs test/theme.test.mjs
git commit -F - <<'EOF'
The link checker reads a site the way a browser meets it

A card's links exist only after a script wrote them, and a fragment may name an element a script made, so the site is loaded in a browser: every page the sitemap names and every own page they reach, every href and src, the head's meta and JSON-LD, the stylesheets' url()s, every card opened by Open all, by each surface or by each node of a stage, and the URL strings in the model files the pages read. A page that reads the model and offers nothing that opens a card is reported rather than passed over.

The browser is a parameter, and the tests hand it a real one against a fixture site with one of each case. That makes Playwright this package's one devDependency, by the owner's decision; the comments that said the package takes none even for its tests now say what holds, that it ships none and that a site never installs Playwright through it.

Verified: npm test exits 0, with the fixture site read in Chromium.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: `design links` fails a site whose own link does not land

**Files:**

- Create: `verify/links.mjs`
- Modify: `bin/design.mjs` (usage text and a `links` branch before the `sync` check)
- Modify: `package.json` (`exports`)
- Modify: `test/links-site.test.mjs` (append)

**Interfaces:**

- Consumes: `collect` (Task 2); `classify`, `shown`, `resolveOwn` (Task 1).
- Produces, from `verify/links.mjs` (exported as `@robertblust/design/verify/links`):
  - `BASE = "http://127.0.0.1:8000"`
  - `checkOwn({ root, base = BASE, chromium, log = console.log }) → Promise<{ failures: { link: string, reason: string, from: string[] }[], pages: number, links: number }>`; throws `no own link was found on <origin>, so nothing was checked` when it resolved none.
- CLI: `design links [--base <url>]` exits 0 when every own link lands, 1 when one does not or the check could not run, 2 on a usage error.

- [ ] **Step 1: Write the failing tests**

Append to `test/links-site.test.mjs`:

```js
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { checkOwn } from "@robertblust/design/verify/links";

const CLI = path.join(path.dirname(HERE), "bin", "design.mjs");

// Async, so the server in this process keeps answering while the CLI runs.
async function cli(args, cwd, env = {}) {
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [CLI, ...args], { cwd, env: { ...process.env, ...env } });
    return { code: 0, stdout, stderr };
  } catch (e) {
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

function copyFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "design-links-site-"));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

test("every own link that does not land is named once, with where it was found", async () => {
  const lines = [];
  const { failures } = await checkOwn({ root: FIXTURE, base: served.base, chromium, log: (l) => lines.push(l) });
  assert.deepEqual(failures.map((f) => [f.link, f.reason, f.from]), [
    ["/fonts/missing.woff2", "no file here", ["/"]],
    ["/gone/", "no page here", ["model.json · things/b"]],
    ["/missing/", "no page here", ["/"]],
    ["/model/#things/nope", "no node things/nope in model.json", ["/"]],
    ["/model/#things/void", "no node things/void in model.json", ["/model/ (card)"]],
    ["/model/?stage=expanded#things/ghost", "no node things/ghost in model.json", ["/"]],
    ["/model/?stage=expanded#things/lost", "no node things/lost in model.json", ["/ledger/ (card)"]],
    ["/nodata/#things/a", "/nodata/ draws a stage and names no data, so #things/a cannot be drawn", ["/"]],
    ["/noopener/", "carries a <link data-stage> and none of #openall, .openall, .ln-s or #stage, so its cards cannot be opened", ["/noopener/"]],
    ["/og.png", "no file here", ["/"]],
    ["/slides.pdf", "no file here", ["/talks/deck/"]],
    ["/about/#nobody", "no element with id nobody on /about/", ["/"]],
  ].sort((a, b) => a[0].localeCompare(b[0])));
  assert.match(lines.join("\n"), /12 own link\(s\) do not resolve/);
});

test("the CLI fails on a wrong STAGE_PAGE and passes once it is set back", async () => {
  // The spec's positive control, on the fixture: Surfaces's card links are the gap v0.68.0 left.
  const dir = copyFixture();
  for (const drop of ["missing", "nodata", "noopener", "talks"]) fs.rmSync(path.join(dir, drop), { recursive: true, force: true });
  fs.writeFileSync(path.join(dir, "og.png"), "");
  fs.writeFileSync(path.join(dir, "fonts", "missing.woff2"), "");
  fs.mkdirSync(path.join(dir, "gone")); fs.writeFileSync(path.join(dir, "gone", "index.html"), "<!doctype html><title>Gone</title>");
  const html = (rel) => path.join(dir, rel);
  fs.writeFileSync(html("index.html"), `<!doctype html><title>Clean</title><link rel="stylesheet" href="style.css"><a href="about/#team">about</a><a href="lineage/">lineage</a><a href="model/#things">model</a><a href="og.png">card</a><a href="gone/">gone</a>`);
  fs.writeFileSync(html("model.json"), JSON.stringify({ rootId: "root", entities: [{ id: "root", see: [] }, { id: "things/a", see: ["things/b"] }, { id: "things/b", see: [] }] }));
  fs.writeFileSync(html("ledger/index.html"), fs.readFileSync(html("ledger/index.html"), "utf8").replace("things/lost", "things/a"));
  const s = await serve(dir);
  try {
    const clean = await cli(["links", "--base", s.base], dir);
    assert.equal(clean.code, 0, clean.stdout + clean.stderr);
    assert.match(clean.stdout, /✓ every own link resolves/);

    const lineage = html("lineage/index.html");
    fs.writeFileSync(lineage, fs.readFileSync(lineage, "utf8").replace('var STAGE_PAGE = "../model/";', 'var STAGE_PAGE = "../nowhere/";'));
    const wrong = await cli(["links", "--base", s.base], dir);
    assert.equal(wrong.code, 1);
    assert.match(wrong.stdout, /✗ \/nowhere\/\?stage=expanded#things\/a {2}no page here\n {6}from \/lineage\/ \(card\)/);

    fs.writeFileSync(lineage, fs.readFileSync(lineage, "utf8").replace('"../nowhere/"', '"../model/"'));
    assert.equal((await cli(["links", "--base", s.base], dir)).code, 0);
  } finally {
    await s.close();
  }
});

test("the CLI fails when it checked nothing, and names why", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "design-links-bare-"));
  fs.writeFileSync(path.join(dir, "CNAME"), "fixture.test\n");
  fs.writeFileSync(path.join(dir, "sitemap.xml"), "<urlset></urlset>");
  const s = await serve(dir);
  try {
    const none = await cli(["links", "--base", s.base], dir);
    assert.equal(none.code, 1);
    assert.match(none.stderr, /no page named by sitemap\.xml is in this checkout/);
  } finally {
    await s.close();
  }
  const down = await cli(["links", "--base", "http://127.0.0.1:9"], FIXTURE);
  assert.equal(down.code, 1);
  assert.match(down.stderr, /nothing answers at http:\/\/127\.0\.0\.1:9/);
  assert.equal((await cli(["links", "--base"], FIXTURE)).code, 2);
});
```

Move the three new `import` lines to the top of the file with the others; ES modules allow imports only at the top level, and keeping them together is this repository's form.

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test test/links-site.test.mjs; echo "exit=$?"` Expected: `exit=1`, `ERR_PACKAGE_PATH_NOT_EXPORTED` for `./verify/links`.

- [ ] **Step 3: Write `checkOwn` and export it**

Create `verify/links.mjs`:

```js
// The link checker: `design links` and `design links --external`. A link on the site itself must
// land or the build fails; a link to someone else's site is checked on a schedule and reported,
// because a dead page elsewhere is news and not a reason to stop a deploy. What is read, what
// decides and what asks the web live in verify/links/; this file puts them together.
import { collect } from "./links/collect.mjs";
import { classify, shown, resolveOwn } from "./links/resolve.mjs";

export const BASE = "http://127.0.0.1:8000";

// Every own link the site carries, resolved against the checkout. A link found in several places
// is reported once, with all of them.
export async function checkOwn({ root, base = BASE, chromium, log = console.log }) {
  const site = await collect({ root, base, chromium });
  const failures = new Map();
  const fail = (link, reason, from) => {
    const f = failures.get(link) ?? { link, reason, from: new Set() };
    for (const x of from) f.from.add(x);
    failures.set(link, f);
  };
  for (const p of site.problems) fail(p.link, p.reason, p.from);
  let resolved = 0;
  for (const [href, from] of site.found) {
    const c = classify(href, site);
    if (c.kind !== "own") continue;
    resolved++;
    const reason = resolveOwn(c.url, { root, pages: site.pages, idsOf: site.idsOf });
    if (reason) fail(shown(c), reason, from);
  }
  // A check that resolved nothing has not passed, it has not run.
  if (!resolved) throw new Error(`no own link was found on ${site.origin}, so nothing was checked`);
  const list = [...failures.values()]
    .map((f) => ({ link: f.link, reason: f.reason, from: [...f.from].sort() }))
    .sort((a, b) => a.link.localeCompare(b.link));
  if (!list.length) log(`  ✓ every own link resolves: ${resolved} link(s) from ${site.pages.size} page(s) and the model`);
  else {
    for (const f of list) log(`  ✗ ${f.link}  ${f.reason}\n      from ${f.from.join(", ")}`);
    log(`\n  ${list.length} own link(s) do not resolve.`);
  }
  return { failures: list, pages: site.pages.size, links: resolved };
}
```

In `package.json` `exports`, after `"./verify/pin": "./verify/pin.mjs",` add:

```json
"./verify/links": "./verify/links.mjs",
```

- [ ] **Step 4: Add the command to the bin**

In `bin/design.mjs`, replace the `USAGE` constant with:

```js
const USAGE = `usage: design sync [--check] [--site <dir>]
       design sitemap [--check]
       design indexnow <base> <head> [--dry-run]
       design links [--external] [--base <url>]

  sync            copy this package's files into the site
  sync --check    compare only, exit 1 if a copy has drifted (this is what CI runs)
  --site <dir>    the site root (default: the current directory)
  sitemap         date each sitemap URL from its page's last commit
  sitemap --check compare only, exit 1 if a date has moved
  indexnow        send the pages changed between two commits to IndexNow
  links           resolve every link the site owns, exit 1 if one does not land
  links --external
                  check every link to another site and report it, exit 1 only if the check could not run
  --base <url>    where the site is served (default: http://127.0.0.1:8000)`;
```

Directly before the line `if (argv[0] !== "sync") fail(USAGE, 2);`, add:

```js
// The link checker drives a browser, and the browser is the site's: every site already installs
// Playwright for its own suite, and this package ships no dependency to bring a second copy.
if (argv[0] === "links") {
  const at = argv.indexOf("--base");
  if (at !== -1 && (!argv[at + 1] || argv[at + 1].startsWith("--"))) fail(USAGE, 2);
  const { BASE, checkOwn, checkExternal } = await import("../verify/links.mjs");
  const base = at === -1 ? BASE : argv[at + 1];
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    fail("  ✗ design links drives a browser and needs Playwright in the site: npm install --save-dev playwright", 1);
  }
  try {
    if (argv.includes("--external")) {
      await checkExternal({ root: process.cwd(), base, chromium });
      process.exit(0);
    }
    const { failures } = await checkOwn({ root: process.cwd(), base, chromium });
    process.exit(failures.length ? 1 : 0);
  } catch (e) {
    fail(`  ✗ ${e.message}`, 1);
  }
}
```

`checkExternal` arrives in Task 5; until then its import is `undefined` and the `--external` branch is not reached by any test.

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test test/links-site.test.mjs; echo "exit=$?"` then `npm test; echo "exit=$?"` Expected: both `exit=0`. `test/cli.test.mjs` asserts only that the usage text says “usage”, which it still does.

- [ ] **Step 6: Commit**

```bash
git add verify/links.mjs bin/design.mjs package.json test/links-site.test.mjs
git commit -F - <<'EOF'
design links fails a site whose own link does not land

The command reads the served site, resolves every own link it found against the checkout, and names each one that does not land once, with every place it was found, before exiting 1. It exits 1 as well when it could not run or resolved nothing, because a check that read nothing has not passed. The spec's positive control is held on the fixture: a wrong STAGE_PAGE on the lineage page fails the command, and setting it back passes it.

Verified: npm test exits 0, with the fixture's own links reported and the CLI's exit codes held.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: An external link is judged ok, broken or unverifiable

**Files:**

- Create: `verify/links/judge.mjs`
- Create: `test/links-judge.test.mjs`

**Interfaces:**

- Consumes: nothing.
- Produces, from `verify/links/judge.mjs`:
  - `verdict(status: number) → "ok"|"broken"|"unverifiable"`
  - `judge(url: string, { fetchImpl = fetch, timeoutMs = 10000 }?) → Promise<{ url, kind, answer: string }>` — `answer` is the status as a string, `no such host`, `timeout`, or an error code such as `ECONNREFUSED`
  - `judgeAll(urls: string[], { judgeOne: (url) => Promise<T>, limit = 4 }) → Promise<T[]>` — sorted by `url`; one request per host at a time, at most `limit` hosts at once

- [ ] **Step 1: Write the failing tests**

Create `test/links-judge.test.mjs`:

```js
// How an external link is judged. The web answers a script in more ways than a browser sees, and
// a checker that calls a working page broken is a checker whose issue gets closed unread, so every
// answer that says nothing about the page is kept apart from the few that do.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { verdict, judge, judgeAll } from "../verify/links/judge.mjs";

let base, server, refused;
const hits = new Map();
before(async () => {
  server = http.createServer((req, res) => {
    const n = (hits.get(req.url) ?? 0) + 1;
    hits.set(req.url, n);
    const send = (status) => { res.writeHead(status); res.end(); };
    switch (req.url) {
      case "/ok": return send(200);
      case "/moved": res.writeHead(301, { location: "/ok" }); return res.end();
      case "/gone": return send(404);
      case "/removed": return send(410);
      case "/forbidden": return send(403);
      case "/linkedin": return send(999);
      case "/head-405": return send(req.method === "HEAD" ? 405 : 200);
      case "/head-404": return send(req.method === "HEAD" ? 404 : 200);
      case "/flaky": return send(n <= 2 ? 500 : 200);
      case "/down": return send(503);
      case "/never": return; // holds the request open
      default: return send(404);
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  const closed = http.createServer();
  await new Promise((r) => closed.listen(0, "127.0.0.1", r));
  refused = `http://127.0.0.1:${closed.address().port}/`;
  await new Promise((r) => closed.close(r));
});
after(() => new Promise((r) => { server.closeAllConnections(); server.close(r); }));

test("a status is ok, broken or unverifiable", () => {
  for (const s of [200, 204, 301, 304]) assert.equal(verdict(s), "ok", String(s));
  for (const s of [404, 410]) assert.equal(verdict(s), "broken", String(s));
  for (const s of [400, 401, 403, 405, 429, 500, 503, 999]) assert.equal(verdict(s), "unverifiable", String(s));
});

test("each kind of answer is sorted into its kind", async () => {
  const at = async (p, o) => { const v = await judge(base + p, o); return [v.kind, v.answer]; };
  assert.deepEqual(await at("/ok"), ["ok", "200"]);
  assert.deepEqual(await at("/moved"), ["ok", "200"], "judged after redirects");
  assert.deepEqual(await at("/gone"), ["broken", "404"]);
  assert.deepEqual(await at("/removed"), ["broken", "410"]);
  assert.deepEqual(await at("/forbidden"), ["unverifiable", "403"]);
  assert.deepEqual(await at("/linkedin"), ["unverifiable", "999"]);
  assert.deepEqual(await at("/down"), ["unverifiable", "503"]);
  assert.deepEqual(await at("/head-405"), ["ok", "200"], "a host that refuses HEAD is asked with GET");
  assert.deepEqual(await at("/head-404"), ["ok", "200"], "broken is the GET's word, never HEAD's");
  assert.deepEqual(await at("/never", { timeoutMs: 200 }), ["unverifiable", "timeout"]);
  const r = await judge(refused);
  assert.deepEqual([r.kind, r.answer], ["unverifiable", "ECONNREFUSED"]);
  const n = await judge("http://no-such-host.invalid/");
  assert.deepEqual([n.kind, n.answer], ["broken", "no such host"]);
});

test("a link that fails once is asked once more, and a link that is fine is asked once", async () => {
  hits.clear();
  assert.equal((await judge(`${base}/flaky`)).kind, "ok");
  assert.equal(hits.get("/flaky"), 3, "HEAD and GET, then HEAD again, which says yes");
  await judge(`${base}/ok`);
  assert.equal(hits.get("/ok"), 1);
});

test("one request per host at a time, and no more than four at once", async () => {
  let now = 0, most = 0;
  const perHost = new Map(), mostPerHost = new Map();
  const judgeOne = async (url) => {
    const host = new URL(url).host;
    now++; most = Math.max(most, now);
    perHost.set(host, (perHost.get(host) ?? 0) + 1);
    mostPerHost.set(host, Math.max(mostPerHost.get(host) ?? 0, perHost.get(host)));
    await new Promise((r) => setTimeout(r, 5));
    now--; perHost.set(host, perHost.get(host) - 1);
    return { url };
  };
  const urls = [];
  for (let h = 0; h < 7; h++) for (let i = 0; i < 3; i++) urls.push(`https://h${h}.test/${i}`);
  const out = await judgeAll(urls.reverse(), { judgeOne });
  assert.equal(most, 4);
  for (const [host, m] of mostPerHost) assert.equal(m, 1, host);
  assert.deepEqual(out.map((v) => v.url), [...urls].sort());
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test test/links-judge.test.mjs; echo "exit=$?"` Expected: `exit=1`, `Cannot find module '…/verify/links/judge.mjs'`.

- [ ] **Step 3: Write the judge**

Create `verify/links/judge.mjs`:

```js
// How a link to someone else's site is judged. Broken is a claim the checker makes about another
// site, so it is made only on an answer that says the page is gone: a 404 or a 410 to a GET, or a
// host name that no longer resolves. Every other refusal (a login wall, a rate limit, LinkedIn's 999
// to anything that is not a browser, a server having a bad day) says nothing about the page, and
// is reported as unverifiable rather than called broken.
const UA = "robertblust-design-links (+https://github.com/robertblust/design)";

export function verdict(status) {
  if (status >= 200 && status < 400) return "ok";
  if (status === 404 || status === 410) return "broken";
  return "unverifiable";
}

// The body is always cancelled: Node 22's bundled undici can crash on a socket that ends with a
// body nobody read (see verify/http.mjs), and nothing here reads one.
async function ask(url, method, { fetchImpl, timeoutMs }) {
  const res = await fetchImpl(url, { method, redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(timeoutMs) });
  await res.body?.cancel();
  return res.status;
}

function failed(err) {
  const code = err?.cause?.code ?? err?.code;
  if (code === "ENOTFOUND") return { kind: "broken", answer: "no such host" };
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return { kind: "unverifiable", answer: "timeout" };
  return { kind: "unverifiable", answer: code ?? String(err?.message ?? err) };
}

// HEAD first, because it is cheap for both sides; GET whenever HEAD did not say yes, because
// some hosts answer HEAD with a 403, a 404 or a 405 for a page a GET serves.
async function once(url, opts) {
  try {
    let status = await ask(url, "HEAD", opts);
    if (verdict(status) !== "ok") status = await ask(url, "GET", opts);
    return { kind: verdict(status), answer: String(status) };
  } catch (err) {
    return failed(err);
  }
}

export async function judge(url, { fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  const first = await once(url, { fetchImpl, timeoutMs });
  return { url, ...(first.kind === "ok" ? first : await once(url, { fetchImpl, timeoutMs })) };
}

// Each host is one queue, asked in order, and at most `limit` queues are worked at once: one
// request per host at a time, so no host sees this checker as a burst, and `limit` overall.
export async function judgeAll(urls, { judgeOne, limit = 4 }) {
  const byHost = new Map();
  for (const url of urls) {
    const host = new URL(url).host;
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(url);
  }
  const queues = [...byHost.values()], out = [];
  let next = 0;
  const worker = async () => {
    while (next < queues.length) for (const url of queues[next++]) out.push(await judgeOne(url));
  };
  await Promise.all(Array.from({ length: Math.min(limit, queues.length) }, worker));
  return out.sort((a, b) => a.url.localeCompare(b.url));
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test test/links-judge.test.mjs; echo "exit=$?"` then `npm test; echo "exit=$?"` Expected: both `exit=0`. The `.invalid` name is reserved and never resolves (RFC 6761); on a machine with no network at all it may answer `EAI_AGAIN` instead, which the test would report — run it with the network up.

- [ ] **Step 5: Commit**

```bash
git add verify/links/judge.mjs test/links-judge.test.mjs
git commit -F - <<'EOF'
An external link is judged ok, broken or unverifiable

Broken is a claim about someone else's site, so it is made only on a 404 or 410 to a GET or a host name that no longer resolves. Every other refusal, a login wall, a rate limit, LinkedIn's 999, a timeout, says nothing about the page and is kept apart as unverifiable. HEAD is asked first and GET whenever HEAD does not say yes, a link that fails is asked once more, and no host is asked twice at the same time.

Verified: npm test exits 0, with each answer from a local server sorted into its kind.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: `design links --external` keeps one issue up to date

**Files:**

- Create: `verify/links/issue.mjs`
- Create: `test/links-issue.test.mjs`
- Modify: `verify/links.mjs` (add `checkExternal`)
- Modify: `test/links-site.test.mjs` (append)

**Interfaces:**

- Consumes: `collect` (Task 2), `classify` (Task 1), `judge`, `judgeAll` (Task 4).
- Produces:
  - from `verify/links/issue.mjs`: `ISSUE_TITLE = "Broken external links"`; `issueBody({ broken, unverifiable }, { runUrl?: string|null, date: string }) → string`; `syncIssue({ report, repo, token, api = "https://api.github.com", runUrl, date, apiFetch = fetch, log = console.log }) → Promise<{ action: "opened"|"updated"|"closed"|"none", number?: number }>`
  - from `verify/links.mjs`: `checkExternal({ root, base = BASE, chromium, env = process.env, fetchImpl = fetch, apiFetch = fetch, timeoutMs = 10000, log = console.log, today }) → Promise<{ ok, broken, unverifiable, issue? }>`, each list of `{ url, kind, answer, from: string[] }`

- [ ] **Step 1: Write the failing tests for the issue**

Create `test/links-issue.test.mjs`:

```js
// The one issue a site keeps about its external links. It is the only place a broken reference is
// reported, so each way it can go wrong (a second issue, a stale body, one left open after the
// links were fixed) is a way the report stops being read.
import { test } from "node:test";
import assert from "node:assert/strict";

import { ISSUE_TITLE, issueBody, syncIssue } from "../verify/links/issue.mjs";

const REPORT = {
  ok: [],
  broken: [{ url: "https://example.org/gone|x", kind: "broken", answer: "404", from: ["/", "model.json · a"] }],
  unverifiable: [{ url: "https://www.linkedin.com/in/x", kind: "unverifiable", answer: "999", from: ["/"] }],
};
const CLEAN = { ok: [{ url: "https://example.org/", kind: "ok", answer: "200", from: ["/"] }], broken: [], unverifiable: [] };

// A GitHub that records every call and answers from `issues`.
function github(issues) {
  const calls = [];
  const apiFetch = async (url, init = {}) => {
    const method = init.method ?? "GET";
    calls.push({ method, path: new URL(url).pathname + new URL(url).search, body: init.body && JSON.parse(init.body), auth: init.headers?.authorization });
    const json = method === "GET" ? issues : method === "POST" && url.endsWith("/issues") ? { number: 7 } : {};
    return new Response(JSON.stringify(json), { status: method === "POST" ? 201 : 200 });
  };
  return { calls, apiFetch };
}

const opts = (apiFetch) => ({ repo: "o/r", token: "t", runUrl: "https://github.com/o/r/actions/runs/1", date: "2026-09-28", apiFetch, log: () => {} });

test("the body lists what is broken and what could not be verified, with where each was found", () => {
  const body = issueBody(REPORT, { runUrl: "https://github.com/o/r/actions/runs/1", date: "2026-09-28" });
  assert.match(body, /2026-09-28/);
  assert.match(body, /\[the run\]\(https:\/\/github\.com\/o\/r\/actions\/runs\/1\)/);
  assert.match(body, /## Broken\n/);
  assert.match(body, /\| https:\/\/example\.org\/gone\\\|x \| 404 \| \/<br>model\.json · a \|/, "a pipe in a URL is escaped");
  assert.match(body, /## Unverifiable\n/);
  assert.match(body, /\| https:\/\/www\.linkedin\.com\/in\/x \| 999 \| \/ \|/);
  assert.doesNotMatch(issueBody({ broken: REPORT.broken, unverifiable: [] }, { date: "d" }), /Unverifiable/);
});

test("a broken link opens the issue when there is none", async () => {
  const gh = github([{ number: 3, title: "Something else" }, { number: 4, title: ISSUE_TITLE, pull_request: {} }]);
  assert.deepEqual(await syncIssue({ report: REPORT, ...opts(gh.apiFetch) }), { action: "opened", number: 7 });
  assert.deepEqual(gh.calls.map((c) => [c.method, c.path]), [["GET", "/repos/o/r/issues?state=open&per_page=100"], ["POST", "/repos/o/r/issues"]]);
  assert.equal(gh.calls[1].body.title, ISSUE_TITLE);
  assert.equal(gh.calls[1].auth, "Bearer t");
});

test("a broken link rewrites the issue that is open", async () => {
  const gh = github([{ number: 5, title: ISSUE_TITLE }]);
  assert.deepEqual(await syncIssue({ report: REPORT, ...opts(gh.apiFetch) }), { action: "updated", number: 5 });
  assert.deepEqual(gh.calls.map((c) => [c.method, c.path]), [["GET", "/repos/o/r/issues?state=open&per_page=100"], ["PATCH", "/repos/o/r/issues/5"]]);
  assert.match(gh.calls[1].body.body, /## Broken/);
});

test("a run with nothing broken closes the open issue with a comment, and otherwise touches nothing", async () => {
  const gh = github([{ number: 5, title: ISSUE_TITLE }]);
  assert.deepEqual(await syncIssue({ report: CLEAN, ...opts(gh.apiFetch) }), { action: "closed", number: 5 });
  assert.deepEqual(gh.calls.map((c) => [c.method, c.path]), [
    ["GET", "/repos/o/r/issues?state=open&per_page=100"],
    ["POST", "/repos/o/r/issues/5/comments"],
    ["PATCH", "/repos/o/r/issues/5"],
  ]);
  assert.match(gh.calls[1].body.body, /2026-09-28/);
  assert.deepEqual(gh.calls[2].body, { state: "closed", state_reason: "completed" });

  const quiet = github([]);
  assert.deepEqual(await syncIssue({ report: CLEAN, ...opts(quiet.apiFetch) }), { action: "none" });
  assert.equal(quiet.calls.length, 1);
});

test("a refusal from GitHub is an error, not a quiet run", async () => {
  const apiFetch = async () => new Response("Resource not accessible by integration", { status: 403 });
  await assert.rejects(syncIssue({ report: REPORT, ...opts(apiFetch) }), /GitHub answered 403 to GET/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/links-issue.test.mjs; echo "exit=$?"` Expected: `exit=1`, `Cannot find module '…/verify/links/issue.mjs'`.

- [ ] **Step 3: Write the issue module**

Create `verify/links/issue.mjs`:

```js
// The one issue a site keeps about its external links: opened when a run finds a link broken,
// rewritten by every run while it stays open, closed with a comment by the first run that finds
// none. One issue and not one a week, because a reader who has to compare issues to learn what
// changed stops reading them. It speaks to GitHub's REST API with fetch and the workflow's token.
export const ISSUE_TITLE = "Broken external links";

const esc = (s) => String(s).replace(/\|/g, "\\|");

function table(items) {
  return [
    "| Link | Answer | Found on |",
    "| --- | --- | --- |",
    ...items.map((v) => `| ${esc(v.url)} | ${esc(v.answer)} | ${v.from.map(esc).join("<br>")} |`),
  ].join("\n");
}

export function issueBody({ broken, unverifiable }, { runUrl, date }) {
  const run = runUrl ? ` ([the run](${runUrl}))` : "";
  const out = [
    `The weekly check of every link this site carries to another site, run on ${date}${run}. Every run rewrites this issue and the first run that finds nothing broken closes it, so an edit made here does not last.`,
    "",
    "## Broken",
    "",
    "Each of these answered a GET with 404 or 410, or its host name does not resolve.",
    "",
    table(broken),
  ];
  if (unverifiable.length) {
    out.push(
      "",
      "## Unverifiable",
      "",
      "Each of these answered in a way that says nothing about the page — 401, 403, 429, 999, a 5xx, a timeout or a refused connection — and is listed to be looked at, not because it is known to be wrong.",
      "",
      table(unverifiable),
    );
  }
  return `${out.join("\n")}\n`;
}

export async function syncIssue({ report, repo, token, api = "https://api.github.com", runUrl, date, apiFetch = fetch, log = console.log }) {
  const call = async (method, p, body) => {
    const res = await apiFetch(`${api}/repos/${repo}${p}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`GitHub answered ${res.status} to ${method} ${p}: ${await res.text()}`);
    return res.json();
  };
  const open = (await call("GET", "/issues?state=open&per_page=100"))
    .find((i) => i.title === ISSUE_TITLE && !i.pull_request);
  if (report.broken.length) {
    const body = issueBody(report, { runUrl, date });
    if (open) {
      await call("PATCH", `/issues/${open.number}`, { body });
      log(`  Issue #${open.number} rewritten.`);
      return { action: "updated", number: open.number };
    }
    const made = await call("POST", "/issues", { title: ISSUE_TITLE, body });
    log(`  Issue #${made.number} opened.`);
    return { action: "opened", number: made.number };
  }
  if (!open) return { action: "none" };
  const run = runUrl ? ` ([the run](${runUrl}))` : "";
  await call("POST", `/issues/${open.number}/comments`, { body: `The run of ${date}${run} found no external link broken.` });
  await call("PATCH", `/issues/${open.number}`, { state: "closed", state_reason: "completed" });
  log(`  Issue #${open.number} closed.`);
  return { action: "closed", number: open.number };
}
```

Run: `node --test test/links-issue.test.mjs; echo "exit=$?"` Expected: `exit=0`.

- [ ] **Step 4: Write the failing end-to-end tests**

Append to `test/links-site.test.mjs` (imports moved to the top with the others: `import { checkExternal } from "@robertblust/design/verify/links";` beside `checkOwn`):

```js
// A site whose external links point at a second local server, so the external mode is run from
// crawl to issue without the network.
async function externalSite() {
  const web = http.createServer((req, res) => { res.writeHead(req.url === "/gone" ? 404 : 200); res.end(); });
  await new Promise((r) => web.listen(0, "127.0.0.1", r));
  const other = `http://127.0.0.1:${web.address().port}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "design-links-ext-"));
  fs.writeFileSync(path.join(dir, "CNAME"), "fixture.test\n");
  fs.writeFileSync(path.join(dir, "sitemap.xml"), "<urlset><url><loc>https://fixture.test/</loc></url></urlset>");
  fs.writeFileSync(path.join(dir, "index.html"), `<!doctype html><title>Ext</title><a href="${other}/fine">fine</a><a href="${other}/gone">gone</a>`);
  const s = await serve(dir);
  return { dir, other, s, close: async () => { await s.close(); await new Promise((r) => { web.closeAllConnections(); web.close(r); }); } };
}

test("the external mode reports what it found and keeps the issue", async () => {
  const x = await externalSite();
  try {
    const calls = [];
    const apiFetch = async (url, init = {}) => {
      calls.push(init.method ?? "GET");
      return new Response(JSON.stringify((init.method ?? "GET") === "GET" ? [] : { number: 1 }), { status: 200 });
    };
    const report = await checkExternal({
      root: x.dir, base: x.s.base, chromium, apiFetch, log: () => {}, today: "2026-09-28",
      env: { GITHUB_TOKEN: "t", GITHUB_REPOSITORY: "o/r", GITHUB_SERVER_URL: "https://github.com", GITHUB_RUN_ID: "1" },
    });
    assert.deepEqual(report.broken.map((v) => [v.url, v.answer, v.from]), [[`${x.other}/gone`, "404", ["/"]]]);
    assert.deepEqual(report.ok.map((v) => v.url), [`${x.other}/fine`]);
    assert.deepEqual(report.issue, { action: "opened", number: 1 });
    assert.deepEqual(calls, ["GET", "POST"]);
  } finally {
    await x.close();
  }
});

test("the external CLI exits 0 on what it finds and 1 when it could not run", async () => {
  const x = await externalSite();
  try {
    const run = await cli(["links", "--external", "--base", x.s.base], x.dir, { GITHUB_TOKEN: "", GITHUB_REPOSITORY: "" });
    assert.equal(run.code, 0, run.stderr);
    assert.match(run.stdout, new RegExp(`✗ ${x.other}/gone {2}404`));
    assert.match(run.stdout, /no issue was touched/);
  } finally {
    await x.close();
  }
  const down = await cli(["links", "--external", "--base", "http://127.0.0.1:9"], FIXTURE, { GITHUB_TOKEN: "" });
  assert.equal(down.code, 1);
});
```

Run: `node --test test/links-site.test.mjs; echo "exit=$?"` Expected: `exit=1`, `checkExternal` is not exported.

- [ ] **Step 5: Write `checkExternal`**

In `verify/links.mjs`, extend the imports:

```js
import { judge, judgeAll } from "./links/judge.mjs";
import { syncIssue } from "./links/issue.mjs";
```

and append:

```js
// Every link to another site, from the pages, the cards and the model, judged and reported. It
// returns whatever it finds: a dead page elsewhere is news, and the workflow that runs this never
// fails on it. It throws only when the check itself could not run, so a broken weekly job does not
// look like a clean one.
export async function checkExternal({
  root, base = BASE, chromium, env = process.env, fetchImpl = fetch, apiFetch = fetch,
  timeoutMs = 10_000, log = console.log, today = new Date().toISOString().slice(0, 10),
}) {
  const site = await collect({ root, base, chromium });
  const where = new Map();
  for (const [href, from] of site.found) {
    const c = classify(href, site);
    if (c.kind !== "external") continue;
    const all = where.get(c.url.href) ?? new Set();
    for (const x of from) all.add(x);
    where.set(c.url.href, all);
  }
  const verdicts = await judgeAll([...where.keys()], { judgeOne: (url) => judge(url, { fetchImpl, timeoutMs }) });
  const report = { ok: [], broken: [], unverifiable: [] };
  for (const v of verdicts) report[v.kind].push({ ...v, from: [...where.get(v.url)].sort() });
  for (const [kind, mark] of [["broken", "✗"], ["unverifiable", "?"]])
    for (const v of report[kind]) log(`  ${mark} ${v.url}  ${v.answer}\n      from ${v.from.join(", ")}`);
  log(`  ${report.ok.length} ok, ${report.broken.length} broken, ${report.unverifiable.length} unverifiable, of ${verdicts.length} external link(s).`);

  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, GITHUB_SERVER_URL: server, GITHUB_RUN_ID: runId, GITHUB_API_URL: api } = env;
  if (token && repo) {
    const runUrl = server && runId ? `${server}/${repo}/actions/runs/${runId}` : null;
    report.issue = await syncIssue({ report, repo, token, api: api || undefined, runUrl, date: today, apiFetch, log });
  } else {
    log("  No GITHUB_TOKEN and GITHUB_REPOSITORY in the environment, so no issue was touched.");
  }
  return report;
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `node --test test/links-site.test.mjs; echo "exit=$?"` then `npm test; echo "exit=$?"` Expected: both `exit=0`.

- [ ] **Step 7: Commit**

```bash
git add verify/links.mjs verify/links/issue.mjs test/links-issue.test.mjs test/links-site.test.mjs
git commit -F - <<'EOF'
design links --external keeps one issue about links elsewhere

Every link to another site, from the pages, the cards and the model, is judged and printed, and when the workflow's token is there the run keeps one issue titled Broken external links: opened when a link is broken, rewritten while it stays open, closed with a comment by the first run that finds none. The command exits 0 on whatever it finds and 1 only when the check itself could not run, so a weekly job that stopped working does not read as one that found nothing.

Verified: npm test exits 0, with the external mode run from crawl to issue against local servers.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: The README says how a site takes the checker, and the pull request is ready for review

**Files:**

- Modify: `README.md` (a new section after *Crawlers*)
- Modify: `package.json` (`version`)

**Interfaces:**

- Consumes: everything above.
- Produces: the section a site copies its CI step and `links.yml` from; `version` set to the next minor.

- [ ] **Step 1: Write the section**

In `README.md`, directly before `## A warning about \`stage.js\` and \`card.js\``, insert:

````markdown
## Links

A link either lands or it does not, and the checks above never ask: they forbid a shape of link or require a named one to be present. `design links` asks it of every link the site owns and fails the build when one does not land. `design links --external` asks it of every other link once a week and reports what it finds, because a dead page elsewhere is news and not a reason to stop a deploy.

What is read is what a visitor meets. The command crawls from `sitemap.xml` in a browser and follows every own page it reaches, so a deck linked from a talks index is read without the sitemap naming it. It reads every `href` and `src`, every `url()` in a stylesheet, and every absolute URL in a `<meta content>` and in JSON-LD. On every page carrying a `<link data-stage>` it opens the cards: each Open all is pressed, each surface on Surfaces is clicked, each node of a stage is focused by its hash. The data files those pages name are read for every absolute URL string in them.

A link is own when it is relative or on the host the site's `CNAME` names, and it lands when the checkout holds its file, or a folder's `index.html` for a path ending in `/`. **A fragment on a page that loads `stage.js` must name a node in that page's data** — an entity, the root, or a folder holding one — because a stage shown an id it does not hold draws its root and looks fine. A fragment anywhere else must name an element on the page after its scripts ran. A run that loads no page or finds no own link fails too, since a check that read nothing has not passed.

An external link is asked with `HEAD`, then with `GET` whenever `HEAD` does not say yes, ten seconds each, one request per host at a time and four at once, with one retry. It is broken on a 404 or 410 to the `GET` or a host name that does not resolve, and unverifiable on anything else, a 401, 403, 429, 999, a 5xx, a timeout or a refused connection, which is how some hosts answer every script. The run keeps one issue titled “Broken external links”: opened when something is broken, rewritten by every run, closed with a comment by the first run that finds nothing broken. It fails only when the check itself could not run.

Both modes drive the site's own Playwright, which the bin imports, and read the site served at `--base`, by default `http://127.0.0.1:8000`, where the site's CI already serves it. In `ci.yml`, after the step that runs `npm run verify`:

```yaml
      - name: Every own link resolves
        run: npx design links
```

And a workflow of its own, written by hand as `indexnow.yml` is, since a group only copies page assets:

```yaml
# .github/workflows/links.yml
name: links
on:
  schedule: [{ cron: "0 6 * * 1" }]
  workflow_dispatch:
permissions: { contents: read, issues: write }
jobs:
  links:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: "22", cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: python3 -m http.server 8000 > /dev/null 2>&1 &
      - env: { GITHUB_TOKEN: "${{ github.token }}" }
        run: npx design links --external
```

The last step needs no wait before it: the command waits for the server itself.
````

- [ ] **Step 2: Set the version**

Read the version on `main`: `git fetch -q origin && git show origin/main:package.json | grep '"version"'`. Set `version` in `package.json` to the next minor of that (0.69.0 if main is still at 0.68.0), because `design sync --check` in every site compares a pin's tag with this field.

- [ ] **Step 3: Run every check**

```bash
npm test; echo "exit=$?"
sh conventions/conventions-format; echo "exit=$?"
sh conventions/conventions-check; echo "exit=$?"
sh conventions/conventions-sync check; echo "exit=$?"
```

Expected: four `exit=0`. The spelling test scans `README.md`.

- [ ] **Step 4: Commit and push**

```bash
git add README.md package.json
git commit -F - <<'EOF'
The README says how a site takes the link checker

A site takes the checker with one CI step after its page suite and one hand-written workflow, the way it took IndexNow, because a group only copies page assets. The section says what is read, when an own link lands, how an external one is judged and what the weekly run does with the one issue, and the version moves to the release this branch becomes.

Verified: npm test, conventions-format, conventions-check and conventions-sync check each exit 0.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
git push
```

- [ ] **Step 5: Rewrite #100's description and stop**

Read the last two merged pull requests first (`gh pr list -R robertblust/design --state merged -L 2 --json number,body`). Rewrite #100's body with `gh pr edit 100 --body-file <file>` in the git register: what the branch now holds (the spec, this plan, the engine and the command), the owner's choice of Playwright as the one devDependency, and a paragraph headed in bold as **Release notes for vX.Y.0, a minor.** in #99's form, saying that a site that re-pins changes in nothing until it adds the CI step and `links.yml`, that `links.yml` needs `issues: write`, and that the site's first run may find own links to fix. End with the `Verified:` line and the Claude Code line. Then `gh pr checks 100 --watch; echo "exit=$?"`, report both checks, and stop: the merge and the tag are the owner's.

---

### Task 7: blust.ch checks its links

Starts only after the owner has tagged the release.

**Files (in `~/git/robertblust/robertblust.github.io-links-are-checked`):**

- Modify: `package.json`, `package-lock.json` (the pin)
- Modify: `.github/workflows/ci.yml` (one step)
- Create: `.github/workflows/links.yml`
- Modify: whatever pages the first run finds own links broken on, and `sitemap.xml` with them

- [ ] **Step 1: Branch and re-pin**

```bash
export PATH=/opt/homebrew/bin:$PATH
TAG=$(gh release view -R robertblust/design --json tagName --jq .tagName); echo "$TAG"
cd ~/git/robertblust/robertblust.github.io && git switch main && git pull --ff-only
git worktree add ../robertblust.github.io-links-are-checked -b links-are-checked
cd ../robertblust.github.io-links-are-checked
npm ci; echo "exit=$?"
npm install --save-dev "@robertblust/design@github:robertblust/design#$TAG"; echo "exit=$?"
grep '"@robertblust/design"' package.json
npm run design; echo "exit=$?"
npm run design:check; echo "exit=$?"
test ! -e node_modules/@robertblust/design/node_modules/playwright; echo "no second playwright: exit=$?"
```

Install the package by name: a bare `npm install` after editing `package.json` leaves a stale lockfile, which has happened on this family three times. Every `exit=0`.

- [ ] **Step 2: Add the CI step and the workflow**

In `.github/workflows/ci.yml`, after the step named `Assert what it renders`, add:

```yaml
      - name: Every own link resolves
        run: npx design links
```

Create `.github/workflows/links.yml` with the workflow from the design README's *Links* section, byte for byte.

- [ ] **Step 3: Run the checker on a free port**

```bash
PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
python3 -m http.server "$PORT" --bind 127.0.0.1 > /dev/null 2>&1 & echo "SERVER_PID=$! PORT=$PORT"
```

Keep the PID and the port. Then:

```bash
time npx design links --base "http://127.0.0.1:$PORT"; echo "exit=$?"
```

- [ ] **Step 4: Fix every own link it reports**

Fix each failure where it lives. A page edited here is committed with `npm run sitemap` run after the edit, so its date moves with it. A failure whose source is `model.json` is a link in robertblust/mental-model, and one inside a fenced block is this package's: do not fix those here; stop and report them to the owner with the line the checker printed. Re-run Step 3's command until it exits 0.

- [ ] **Step 5: Show the positive control**

```bash
grep -n 'var STAGE_PAGE' surfaces/index.html
sed -i '' 's#var STAGE_PAGE = "../model/";#var STAGE_PAGE = "../nowhere/";#' surfaces/index.html
npx design links --base "http://127.0.0.1:$PORT"; echo "exit=$?"
git checkout -- surfaces/index.html
npx design links --base "http://127.0.0.1:$PORT"; echo "exit=$?"
```

Expected: the first run `exit=1` naming `/nowhere/?stage=expanded#…` from `/surfaces/ (card)`; the second `exit=0`. Keep both outputs for the PR body. If the `grep` shows a different line, adapt the `sed` to it.

- [ ] **Step 6: Run the external mode once, and stop the server**

```bash
GITHUB_TOKEN= npx design links --external --base "http://127.0.0.1:$PORT"; echo "exit=$?"
kill "$SERVER_PID"
```

Expected: `exit=0`. Keep every `✗` line for the PR body. Kill only the PID Step 3 printed.

- [ ] **Step 7: Time the job**

If Step 3's `time` shows more than three minutes, raise the `verify` job's `timeout-minutes` in `ci.yml` so the job keeps its margin, and say so in the commit.

- [ ] **Step 8: Commit, push, open the PR, stop**

Read the repository's last two merged PRs first. Commit in the git register (subject such as `Every link blust.ch owns is checked before it ships`), with `Verified:` naming `design:check`, the `design links` run and the positive control. Push, open the PR with `gh pr create`, its body naming the release it takes, the positive control's two results, each own link fixed, and every broken external link by URL and where it was found, in prose. `gh pr checks <n> --watch; echo "exit=$?"`, report, stop.

---

### Task 8: companygraph.io checks its links

Starts after Task 7's PR is merged. Another session works on this repository's landing stage; its plan is `docs/superpowers/plans/2026-09-21-the-landing-page-draws-the-company.md` there.

- [ ] **Step 1: Look before touching**

```bash
export PATH=/opt/homebrew/bin:$PATH
gh pr list -R companygraph/companygraph.github.io --state open --json number,title,headRefName
cd ~/git/companygraph/companygraph.github.io && git status -sb && git switch main && git pull --ff-only
git worktree list
```

Branch from `main` as it stands, which holds whatever the landing-stage work has merged; never from its branch, and never in its worktree. If its pull request is still open, go on and tell the owner that this branch will need a rebase once it merges.

- [ ] **Step 2: Branch, re-pin, and take every release between**

```bash
git worktree add ../companygraph.github.io-links-are-checked -b links-are-checked
cd ../companygraph.github.io-links-are-checked
grep '"@robertblust/design"' package.json
```

This site's pin is older than the previous release. Read the notes of every design release between its pin and `$TAG` (`gh release view -R robertblust/design <tag>`) and do what each asks beyond `npm run design`. Then follow Task 7 Step 1 from `npm ci` on.

- [ ] **Step 3: Steps 2–4, 6, 7 and 8 of Task 7, here**

The CI step, `links.yml`, the run on a free port, fixing own links (the same limits: a `model.json` or `example.json` link belongs to companygraph/mental-model, stop and report it), the external run, the timing, and the PR. This site draws two stages, `/model/` and `/example/`, each from its own file, and the checker reads both. The positive control is blust.ch's and is not repeated. Stop after reporting the checks.

---

### Task 9: guestgraph.io checks its links

Starts after Task 8's PR is merged.

- [ ] **Step 1: Branch and re-pin**

```bash
export PATH=/opt/homebrew/bin:$PATH
cd ~/git/guestgraph/guestgraph.github.io && git switch main && git pull --ff-only
git worktree add ../guestgraph.github.io-links-are-checked -b links-are-checked
cd ../guestgraph.github.io-links-are-checked
grep '"@robertblust/design"' package.json
```

Read the notes of every design release between its pin and `$TAG` and do what each asks, then Task 7 Step 1 from `npm ci` on.

- [ ] **Step 2: Steps 2–4, 6, 7 and 8 of Task 7, here**

guestgraph.io reads no model and publishes none, so the checker opens no card and reads no data file, and its links are its pages' own. Stop after reporting the checks.

---

## After this plan

Once the owner has merged all three site pull requests: remove each site worktree with `git worktree remove` and delete its branch by name, locally and on the remote if GitHub has not; then the same for `~/git/robertblust/design-links-are-checked`, whose ledger under `.superpowers/sdd/` goes with it. Never with `--force`. The first Monday run of each `links.yml` is worth reading: it is the first time the issue is written by the workflow's own token, and the one thing the tests could not show.
