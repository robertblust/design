# Links are checked — design

> Every link a site carries is followed before it ships: the ones in its pages, the ones its scripts write into a card, and the ones in the model it publishes. A link on the site itself must resolve or the build fails. A link to someone else's site is checked on a schedule and reported, because a dead page elsewhere is news and not a reason to stop a deploy.

Status: proposed. Decided on 2026-09-21 against this repository at `cedd728` (v0.68.0), blust.ch, companygraph.io and guestgraph.io at their main branches of that day.

---

## 1. What is true today, measured

| Fact | Value |
| --- | --- |
| A check that resolves a relative link | none. `internalLinks` in `verify/pages.mjs` fails a path that starts with `/` and follows nothing |
| A check that follows an absolute link | none. `links` fails when a page lacks an outbound link its spec names, and never requests it |
| A check of the links a card writes | none. The stage suite clicks cards and reads what they show, not where their links go |
| Where the family's generated links are written | `blocks/model-card.js` and `blocks/surfaces.js`, as `STAGE_PAGE + "?stage=expanded#" + id`, with `STAGE_PAGE` declared by the page |
| What the `#id` of such a link names | an entity in the data the target page draws, not an element of that page |
| How a page names the data it draws | a `<link data-stage>` whose `href` is the data file; guestgraph.io's carries no `href` and draws what its page script builds |
| Model files a site publishes | blust.ch `model.json`; companygraph.io `model.json` and `example.json`; guestgraph.io none |
| How every site's CI verifies | `python3 -m http.server 8000`, then `npm run verify`, a Playwright suite, as the job's last step |
| A scheduled workflow on any site | none; each carries `ci.yml`, `conventions.yml` and `indexnow.yml` |

Three rows decide the work.

**A relative link to a page that does not exist ships green.** Every existing check either forbids a shape of link or asserts that a named link is present. None asks whether the target is there, so a renamed folder, a typo in a nav entry or a wrong `STAGE_PAGE` passes every check in the family.

**The links that matter most are not in the HTML.** A card's links are written by a script when the card opens, and their fragment names a model entity. Reading the markup finds none of them, and checking that the target page exists is not enough: the entity has to be in the data that page draws.

**The model is a second source of links.** References, Also at rows and evidence documents are URLs in the model, drawn onto cards and published as `model.json`. They are the family's claims about the world, and they rot on someone else's schedule.

## 2. What was decided

**One engine, two modes, in this package.** A new module, `verify/links.mjs`, collects every link a site carries and sorts each into one of two kinds. A link is **own** when it is relative, or absolute on the site's own domain as its `CNAME` names it; every other `http` or `https` link is **external**. `mailto:`, `tel:` and `javascript:` links are neither and are skipped. The package's bin gains `design links`, which checks the own links and fails, and `design links --external`, which checks the external ones and reports.

**What is collected, from where.**

- Each page the site's `sitemap.xml` names, loaded in a browser: every `href` and `src` in the document, every `url()` in a stylesheet the page can read, and every own page those links reach, followed until no new page appears. A deck is reached this way from the talks index without the sitemap naming it.
- On every page that carries `model card` or `surfaces lineage`, the links a card writes: one card opened for each entity type the page draws, and its links collected the same way.
- Every string in each model file the site publishes that is an absolute `http` or `https` URL.

**How an own link resolves.** The engine answers from the checkout and the served copy, never from the internet.

- A path must name a file in the served copy; a path ending in `/` must name a folder with an `index.html`.
- A `#fragment` on a plain page must name an element `id` on the target page after its scripts have run.
- A `?stage=…#id` link must name a page that carries a `<link data-stage>` with an `href`, and `id` must be an entity in that data file. A target page whose stage names no file fails, because nothing could draw the entity.
- Any other query string is ignored; the path and fragment are what resolve.

**How an external link is judged.** A `HEAD` request, with a `GET` when the host answers `HEAD` with 405 or 501, a timeout of ten seconds, at most four requests in flight and at most one per host at a time, and one retry after a failure. The answer is one of three:

- **ok**: a 2xx or 3xx, after redirects.
- **broken**: 404 or 410, or a name that does not resolve.
- **unverifiable**: 401, 403, 429, 999, any 5xx, a timeout, or a refused connection. Hosts such as LinkedIn answer every script this way, so these are listed but never called broken.

**Where the modes run.** `design links` becomes a step in each site's `ci.yml`, after `npm run verify` and against the same server, and fails the build on the first run where any own link does not resolve; it prints every failure, not the first. `design links --external` runs in a new workflow, `links.yml`, weekly on Monday and on demand. It never fails the job. It keeps one issue per repository titled "Broken external links": it opens the issue when a run finds a broken link, rewrites its body on every run to list the broken links and the unverifiable ones with the page or model entry each was found in, and closes it with a comment when a run finds none broken. Each site writes its own `links.yml`, as each wrote its own `indexnow.yml`: the logic is in this package and the workflow only calls it, so the file is a few lines and a group, which copies page assets, is the wrong vehicle for it.

**What is not covered.** mcp.blust.ch has no pages, and the model it serves is the one blust.ch publishes, whose links blust.ch's own run already checks. The decks' PDF exports and audio are files, and are checked as files only: a link inside a PDF is not read.

## 3. Rollout

1. This package: `verify/links.mjs` with its tests against fixtures under `test/`, the `design links` command, and the README section with the workflow a site copies. Released as a minor, because a site that takes the release changes in nothing until it adds the step and the workflow.
2. Each of the three sites, one PR each: the re-pin, the CI step and `links.yml`. Every own link the first run finds broken is fixed in the same PR; every external link the first run finds broken is named in the PR body and left to the issue.

## 4. How it is known to work

- The engine's tests hold a fixture site with one of each: a good and a missing relative page, a good and a missing fragment, a stage link to an entity that is and one that is not in the data, a stage link to a page with no stage, a CSS `url()` to a missing font, and an absolute link on the site's own domain.
- A positive control on a real site before its PR merges: `STAGE_PAGE` on Surfaces set to a page that does not exist makes `design links` fail, and set back makes it pass. This is the gap v0.68.0 left open.
- The external mode against a local server that answers 200, 404, 403, 405 to `HEAD` and never, each sorted into its kind.
