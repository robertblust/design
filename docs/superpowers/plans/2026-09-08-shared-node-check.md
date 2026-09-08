# A node is identical wherever its @id appears — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One site-wide check in the shared suite — two pages of a site may not describe the
same `@id` differently — and a comment in `assets/stage.js` that stops naming one site's build
command in a file three sites copy.

**Architecture:** The page loop in `verify/suite.mjs` gains one line collecting each page's
`ld+json` text into a map. The block after the loop, which already holds the checks that are not
about any one page, gains a comparison keyed on `@id`. `runSuite`'s signature does not change,
so a site adopts the check by re-pinning and doing nothing else.

**Tech Stack:** Node 22 ESM, no dependencies — this package cannot import Playwright and takes a
browser from its caller. `node --test` against `test/suite.test.mjs`'s existing fake browser.

**Spec:** `docs/superpowers/specs/2026-09-08-shared-node-check-design.md`

## Global constraints

- Branch is `shared-node-check`, already created, spec already committed as `3c5ef93`.
- **No dependencies.** `verify/suite.mjs` imports only `./http.mjs` today and must keep it that
  way; this package is imported by three sites and has no `dependencies` block.
- `runSuite`'s signature stays `{ browser, SITE, BASE, PAGES, CHECKS, systemFaces }`. Changing it
  would make every site edit `verify/check.mjs`, and the spec promises a re-pin and nothing else.
- The runner returns a failure count and never calls `process.exit` — `test/suite.test.mjs` stubs
  `process.exit` for the whole file and asserts on that.
- Comments explain *why* before *how*, per `conventions/WRITING.md`. American English, spaced
  em-dash, no serial comma. Run `sh conventions/conventions-check` before committing Markdown.
- Commit messages follow the git register: subject under seventy characters, no type prefix, no
  trailing period, one to three short paragraphs, a final line beginning `Verified:`, then the
  `Co-Authored-By` trailer.
- **Do not tag a release and do not merge.** The plan ends at a pull request. The release and the
  three re-syncs are the owner's, and are described at the end.
- Do not touch `versions.json`. It versions fenced blocks; `"stage": "v2"` is `blocks/stage.css`,
  and neither file this plan edits is a fence.

## File structure

```
verify/suite.mjs      modify   one line in the page loop, one block after it
test/suite.test.mjs   modify   the fake page learns to answer with a graph; four new tests
assets/stage.js       modify   one comment
```

## Measured facts this plan relies on

Counted on 2026-09-08.

| Fact | Value |
|---|---|
| `verify/suite.mjs` | 172 lines: opt-in guards at 19-58, the page loop at 69-108, the site-wide block after it |
| The site-wide block already holds | the sitemap, the favicon and the `robots.txt` sitemap references |
| Repeated nodes, live | blust.ch 27 (held by its own `pages:check`), companygraph.io 14, guestgraph.io 10 |
| Nodes with more than one shape, any site | **none** — the check lands green everywhere |
| `fakePage().evaluate()` | returns `null`, and the runner calls `evaluate` once per page today |
| `test/suite.test.mjs` today | 14 tests, all passing; this plan adds 4 |
| The stage comment | `assets/stage.js:21` |
| Pages loading the stage | 4: blust.ch `/model/` `/timeline/`, companygraph.io `/model/` `/example/` |

---

### Task 1: The check

**Files:**
- Modify: `verify/suite.mjs`
- Modify: `test/suite.test.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: no exported surface. `runSuite` gains behavior, not parameters.

- [ ] **Step 1: Teach the fake page to answer with a graph**

In `test/suite.test.mjs`, `fakePage()` currently answers `evaluate` with `null` and
`fakeBrowser()` hands out identical pages. The runner calls `newPage()` once per entry in
`PAGES`, in order, so the fake can hand out a different payload per page by counting.

Replace both helpers:

```js
// A page that answers the handful of calls the runner makes of it, and records nothing else.
// Checks themselves are supplied by the test, so this only has to be good enough to get the
// loop running.
//
// `ld` is what this page's `evaluate` answers. The runner calls evaluate twice per page — once
// to await document.fonts, once to collect the page's JSON-LD — and discards the first result,
// so one answer serves both. A page given no `ld` answers null, which is what a page carrying
// no JSON-LD looks like to the collector.
function fakePage(ld) {
  return {
    // The runner's own gate is `if (!res || !res.ok())`, so the stub's response must satisfy
    // it — an empty goto() answers "no response" on every single run, which is not the clean
    // pass the "clean site" test needs.
    async goto() { return { ok: () => true, status: () => 200 }; },
    async close() {}, async evaluate() { return ld ?? null; },
    async $() { return null; }, on() {}, context: () => ({ browser: () => fakeBrowser() }),
  };
}
// Pages are handed out in the order the runner asks for them, which is the order of PAGES, so
// a test can give one page a different graph from its neighbour by position.
function fakeBrowser(lds = []) {
  let i = 0;
  return { async newPage() { return fakePage(lds[i++]); }, async close() {} };
}
```

- [ ] **Step 2: Write the failing tests**

Append to `test/suite.test.mjs`:

```js
// One node, described the same way twice. `node()` builds the JSON-LD text a page would carry.
const node = (over = {}) => ({
  "@type": "WebSite", "@id": "https://x.test/#website", name: "X", ...over,
});
const graph = (...nodes) => [JSON.stringify({ "@context": "https://schema.org", "@graph": nodes })];

const TWO_PAGES = (a, b) => {
  const o = OPTS();
  o.PAGES = [
    { path: "/", seo: true, tokenVersion: true, fences: ["design tokens"], typography: true },
    { path: "/two/", seo: true, tokenVersion: true, fences: ["design tokens"], typography: true },
  ];
  o.browser = fakeBrowser([a, b]);
  return o;
};

const TWO_PAGE_FETCH = () => fakeFetch({
  "/two/": "<html></html>",
  "/sitemap.xml": `<urlset><loc>https://x.test/</loc><loc>https://x.test/two/</loc></urlset>`,
});

test("two pages describing one id the same way pass", async (t) => {
  const real = globalThis.fetch;
  globalThis.fetch = TWO_PAGE_FETCH();
  t.after(() => { globalThis.fetch = real; });
  assert.equal(await runSuite(TWO_PAGES(graph(node()), graph(node()))), 0);
});

test("two pages describing one id differently is a failure", async (t) => {
  // The drift this exists to catch: one page's copy of a shared node gained a field and the
  // other's did not, which no per-page check can see because neither page is wrong alone.
  const real = globalThis.fetch;
  globalThis.fetch = TWO_PAGE_FETCH();
  t.after(() => { globalThis.fetch = real; });
  const o = TWO_PAGES(graph(node()), graph(node({ sameAs: ["https://elsewhere.test/"] })));
  assert.ok(await runSuite(o) > 0, "a split node passed");
});

test("key order alone is not a disagreement", async (t) => {
  // Compared on a canonical form, because two pages that order one node's keys differently
  // describe the same thing and failing that would be noise rather than a finding.
  const real = globalThis.fetch;
  globalThis.fetch = TWO_PAGE_FETCH();
  t.after(() => { globalThis.fetch = real; });
  const a = [JSON.stringify({ "@context": "https://schema.org", "@graph": [
    { "@type": "WebSite", "@id": "https://x.test/#website", name: "X" }] })];
  const b = [JSON.stringify({ "@context": "https://schema.org", "@graph": [
    { name: "X", "@id": "https://x.test/#website", "@type": "WebSite" }] })];
  assert.equal(await runSuite(TWO_PAGES(a, b)), 0);
});

test("a pointer is not compared against the node it points at", async (t) => {
  // A bare { "@id": … } describes nothing, and pages.mjs already requires every pointer to
  // resolve inside its own document. Comparing them here would report that twice.
  const real = globalThis.fetch;
  globalThis.fetch = TWO_PAGE_FETCH();
  t.after(() => { globalThis.fetch = real; });
  const withPointer = [JSON.stringify({ "@context": "https://schema.org", "@graph": [
    node(),
    { "@type": "WebPage", "@id": "https://x.test/two/#webpage", isPartOf: { "@id": "https://x.test/#website" } },
  ] })];
  assert.equal(await runSuite(TWO_PAGES(graph(node()), withPointer)), 0);
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `node --test test/suite.test.mjs`
Expected: the "described differently" test FAILS with `a split node passed` — the other three
pass, because nothing compares anything yet and a suite that checks nothing reports zero.

That one failing test is the whole red signal here; a check that does not exist cannot fail the
tests that assert it stays quiet.

- [ ] **Step 4: Collect the graphs in the page loop**

In `verify/suite.mjs`, declare the map immediately before `for (const spec of PAGES) {`:

```js
  // Filled by the loop, read by the site-wide check below: a page cannot see another page, and
  // two pages describing one @id differently is a disagreement neither of them is wrong about
  // alone.
  const graphs = new Map();
```

Inside the loop's `try`, immediately after the `for (const [name, fn] of Object.entries(CHECKS))`
loop closes:

```js
      graphs.set(spec.path, (await page.evaluate(() =>
        [...document.querySelectorAll('script[type="application/ld+json"]')]
          .map((s) => s.textContent))) || []);
```

A page whose `goto` threw never reaches this line and contributes nothing, which is right: it
has already been counted as a failure and its graph is unknown rather than empty.

- [ ] **Step 5: Write the check**

In `verify/suite.mjs`, inside the site-wide block, after the `robots.txt` check and before the
block's closing brace:

```js
    // A node is identical wherever its @id appears. Nothing configures which nodes those are,
    // because the sites already say it themselves: a node belonging to one page carries a
    // page-specific id — /model/#webpage — while a node describing the person, the site or the
    // organization carries one id on every page. So the id is the key, and a second shape under
    // one key is a contradiction rather than a variant.
    //
    // This is the weaker half of a pair, and the note at the top of this file is why that has
    // to be said out loud: the token block's page-against-page check was deleted because
    // design:check compares each page against what this package ships, which is stronger than
    // pages agreeing with each other. That reasoning holds and it locates this check rather than
    // forbidding it — a site that generates its graph from a source has the stronger check and
    // this one is redundant there, while a site that writes these nodes by hand has neither.
    // One of them published two descriptions of one person until someone counted the nodes.
    //
    // Compared on a canonical form rather than on the bytes, because two pages that order one
    // node's keys differently describe the same thing and failing that would be noise. A node
    // without an @type is a pointer rather than a description, and pages.mjs already requires
    // every pointer to resolve inside its own document.
    const canon = (v) => Array.isArray(v) ? v.map(canon)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
        : v;
    const shapes = new Map();
    for (const [path, blocks] of graphs) {
      for (const raw of blocks) {
        let doc;
        // A block that does not parse is the seo check's finding, not this one's. Reporting it
        // here too would name one fault twice in different words.
        try { doc = JSON.parse(raw); } catch { continue; }
        for (const n of (doc["@graph"] || [doc])) {
          if (!n || !n["@id"] || !n["@type"]) continue;
          const byShape = shapes.get(n["@id"]) || new Map();
          const key = JSON.stringify(canon(n));
          byShape.set(key, [...(byShape.get(key) || []), path]);
          shapes.set(n["@id"], byShape);
        }
      }
    }
    const split = [...shapes].filter(([, byShape]) => byShape.size > 1);
    const repeated = [...shapes].filter(([, byShape]) =>
      [...byShape.values()].reduce((n, paths) => n + paths.length, 0) > 1);
    if (split.length) {
      for (const [id, byShape] of split) {
        console.log(`✗ shared nodes  ${id} is described ${byShape.size} ways: ` +
          [...byShape.values()].map((paths) => paths.join(" ")).join(" | "));
        failures++;
      }
    } else if (repeated.length) {
      console.log(`✓ shared nodes  ${repeated.length} id(s) identical across ${graphs.size} pages`);
    } else {
      console.log("✓ shared nodes  no node appears on more than one page");
    }
```

- [ ] **Step 6: Run the tests and make sure they pass**

Run: `node --test test/suite.test.mjs`
Expected: every test passes, including the three that were already green — they assert the check
stays quiet, and a check that fires on key order or on a pointer would break them.

Run: `node --test`
Expected: the whole suite passes. Other test files exercise `runSuite` indirectly and a page
whose fake answers `null` must still work.

- [ ] **Step 7: Run it against the three real sites**

The check has never run against real pages, and the spec claims it lands green on all three. Prove
that before committing, because a failure here means either the rule is wrong or a site has drift
nobody knew about — and both are worth knowing now.

```bash
node --input-type=module -e '
const canon = (v) => Array.isArray(v) ? v.map(canon)
  : v && typeof v === "object"
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
for (const site of ["https://blust.ch", "https://companygraph.io", "https://guestgraph.io"]) {
  const xml = await (await fetch(site + "/sitemap.xml")).text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const shapes = new Map();
  for (const u of urls) {
    const html = await (await fetch(u)).text();
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let doc; try { doc = JSON.parse(m[1]); } catch { continue; }
      for (const n of (doc["@graph"] || [doc])) {
        if (!n || !n["@id"] || !n["@type"]) continue;
        const by = shapes.get(n["@id"]) || new Map();
        const k = JSON.stringify(canon(n));
        by.set(k, [...(by.get(k) || []), u]); shapes.set(n["@id"], by);
      }
    }
  }
  const split = [...shapes].filter(([, by]) => by.size > 1);
  const repeated = [...shapes].filter(([, by]) => [...by.values()].flat().length > 1);
  console.log(`  ${site}: ${urls.length} pages, ${repeated.length} repeated id(s), ` +
    (split.length ? `SPLIT: ${split.map(([id]) => id).join(", ")}` : "none split"));
}'
```
Expected: `none split` for all three, with 3, 2 and 2 repeated ids respectively.

If any site reports a split, **stop and report it** rather than adjusting the check. It would be
a real finding about that site.

- [ ] **Step 8: Commit**

```bash
git add verify/suite.mjs test/suite.test.mjs
git commit -F - <<'MSG'
Two pages of a site may not describe one id differently

Every check in this suite reads one page, so a node repeated across pages is checked by
nothing: neither copy is wrong on its own, and only a reader comparing them can see that they
disagree. blust.ch published two descriptions of one person that way, and twenty-four nodes
across the two sibling sites are written by hand in the same shape today.

The id is the key, and it needs no configuration, because the sites already encode the
distinction: a node belonging to one page carries a page-specific id while a node describing
the site carries one id everywhere. Comparison is on a canonical form, so a node whose keys are
ordered differently on two pages is the same node and not a finding.

This is the weaker half of a pair and the comment says so, because the note about the deleted
token check sits directly above it and would otherwise read as an argument to delete this too.
Where a site generates its graph from a source, that check is stronger and this is redundant.

Verified: node --test passes; run against the three live sites, every repeated id carries one
shape.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
```

---

### Task 2: The stage stops naming a build command

**Files:**
- Modify: `assets/stage.js:21`

**Interfaces:** none.

- [ ] **Step 1: Rewrite the comment**

`assets/stage.js:21` reads:

```js
  if (!data.entities) return;             // the page's data block is empty until npm run example
```

`npm run example` is companygraph.io's command from before that site renamed it, and was never
blust.ch's. The bug is not the stale name — it is that a file three sites copy names any one
site's command at all. Replace it with:

```js
  if (!data.entities) return;             // the page's data block is empty until the site's build has written it
```

Change nothing else in the file. In particular do not reflow the alignment of neighbouring
comments to match the new length.

- [ ] **Step 2: Confirm nothing else in the package names a site's command**

Run: `grep -rn "npm run" assets/ blocks/ | grep -v node_modules`
Expected: no line naming a command that belongs to one site. If another turns up, report it
rather than fixing it — it is a finding for the review, not a step of this task.

- [ ] **Step 3: Confirm the package still tests clean**

Run: `node --test`
Expected: every test passes. `test/assets.test.mjs` holds this file against what the package
ships, so a change here must not break it — and if it does, that test is asserting a comment's
text and the review should hear about it.

- [ ] **Step 4: Commit**

```bash
git add assets/stage.js
git commit -F - <<'MSG'
The stage stops naming one site's build command

This file is copied into three sites, and its comment told a reader the data block is empty
until `npm run example`. That is companygraph.io's command from before it was renamed, and it
was never blust.ch's, so the line was wrong on both sites that carry the stage.

Naming any one site's command in a shared file is the fault rather than naming the wrong one,
so the replacement names none. What a reader needs to know is that the block is written by the
site's build, not which word that site spells it with.

Verified: node --test passes; no other line under assets/ or blocks/ names a site's command.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
```

- [ ] **Step 5: Open the pull request and stop**

```bash
git push -u origin shared-node-check
```

Then open a pull request against `main` with the forge's CLI, describing both commits in the git
register — the commit body reread for a reviewer who has not seen the diff. Report the check and
stop.

**Do not tag a release, do not merge, and do not open the re-sync pull requests.** Those are the
owner's, and what they involve is below.

---

## What follows, for the owner

Not steps in this plan. Recorded so the work is not half-described.

**The release is v0.54.0**, a minor: `WORKING.md` makes any change another repository builds from
at least a minor, and nothing here asks a site to do more than re-pin and re-sync. The tag is the
release; there is no publish step anywhere in this family.

**Then three re-sync pull requests**, in the order `REPOSITORIES.md` gives — the three sites after
design. What each contains differs, and the difference is the point:

`verify/` is imported from `node_modules`, so **the check costs a re-pin and nothing else**. No
site edits a check file, a page or a spec.

`assets/stage.js` is a copied file, so the comment costs `npm run design` — and that changes the
file's bytes, which stales the card of every page naming it. **Four pages do**: blust.ch's
`/model/` and `/timeline/`, companygraph.io's `/model/` and `/example/`. Each needs `npm run og`
and the `og.sha` committed beside its unchanged `og.png`. guestgraph.io loads the stage on no
page and takes only the re-pin.

A site that re-pins without running `npm run design` will pass `pages:check` and fail
`design:check`, which is the check doing its job.

## Self-review

**Spec coverage.** §2's rule, its canonical form, the pointer exemption and the comment about
being the weaker half are Task 1 steps 4 and 5. §2's stage comment is Task 2. §3's adoption costs
and §4's release are the owner's section, deliberately not tasks. §6's four cases are Task 1
step 2, and its note that the fake page answers `null` is step 1.

**Placeholders.** None. Every code step carries the code; every check step carries the command and
its expected output.

**Type consistency.** `graphs` is `Map(path → string[])`, filled in the loop and read once.
`shapes` is `Map(@id → Map(canonical → path[]))`. `canon` is recursive over arrays, objects and
scalars. `fakePage(ld)` and `fakeBrowser(lds)` change signature together, and every existing call
site passes nothing, which is why both arguments are optional.

**One risk worth naming.** Step 1 changes a helper six existing tests already use. They pass no
argument, so `ld` is `undefined` and `evaluate` answers `null` — which is what it answered before.
If any existing test starts failing after step 1 and before step 4, the helper change is wrong and
the task should stop rather than proceed.
