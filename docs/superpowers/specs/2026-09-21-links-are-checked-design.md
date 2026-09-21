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
| How a page names the data it draws | a `<link data-stage>` whose `href` is the data file, on every page that reads the model: the stage pages, Team, Surfaces and blust.ch's timeline; guestgraph.io carries none |
| How a stage page reads a hash | as a node id, with or without `?stage=`; a hash that names no node focuses the root, so a wrong id still draws a page ([`assets/stage.js`](../../../assets/stage.js)). Only a page that loads `stage.js` reads it so: Team, Surfaces and the timeline read theirs as an element id, a row or a surface |
| Who else writes stage links | blust.ch's timeline, from its own script, as `../model/?stage=expanded#` + id; it carries neither card fence |
| Model files a site publishes | blust.ch `model.json`; companygraph.io `model.json` and `example.json`; guestgraph.io none |
| How every site's CI verifies | `python3 -m http.server 8000`, then `npm run verify`, a Playwright suite, as the job's last step |
| A scheduled workflow on any site | none; each carries `ci.yml`, `conventions.yml` and `indexnow.yml` |

Three rows decide the work.

**A relative link to a page that does not exist ships green.** Every existing check either forbids a shape of link or asserts that a named link is present. None asks whether the target is there, so a renamed folder, a typo in a nav entry or a wrong `STAGE_PAGE` passes every check in the family.

**The links that matter most are not in the HTML.** A card's links are written by a script when the card opens, and their fragment names a model entity. Reading the markup finds none of them, and checking that the target page exists is not enough: the entity has to be in the data that page draws, because a stage shown an id it does not hold draws its root and looks fine.

**The model is a second source of links.** References, Also at rows and evidence documents are URLs in the model, drawn onto cards and published as `model.json`. They are the family's claims about the world, and they rot on someone else's schedule.

## 2. What was decided

**One engine, two modes, in this package.** A new module, `verify/links.mjs`, collects every link a site carries and sorts each into one of two kinds. A link is **own** when it is relative, or absolute on the site's own domain as its `CNAME` names it; every other `http` or `https` link is **external**. `mailto:`, `tel:` and `javascript:` links are neither and are skipped, and so is a link onto a host RFC 2606 and RFC 6761 reserve for documentation and never delegate — `.example`, `.invalid`, `.test`, `.localhost`, `example.com`, `example.net`, `example.org` — since a link onto one of those names is never a claim about a real site. The package's bin gains `design links`, which checks the own links and fails, and `design links --external`, which checks the external ones and reports.

**What is collected, from where.**

- Each page the site's `sitemap.xml` names, loaded in a browser: every `href` and `src` in the document, every `url()` in a stylesheet the page can read, every absolute URL in a `<meta content>` (`og:image`, `og:url`) and every absolute URL string in its JSON-LD, read without its fragment since a JSON-LD `@id` such as `https://blust.ch/#person` identifies a node and is not an anchor a visitor's browser would follow, and every own page those links reach, followed until no new page appears. A deck is reached this way from the talks index without the sitemap naming it. The head is read because it is what crawlers and link previews follow, and none of it is an `href` a visitor clicks.
- On every page that carries a `<link data-stage>`, the links its cards write: the page's `#openall` or `.openall` pressed where it has one — Team carries one per board — which opens every card on Team and on the timeline, each item that opens a card clicked in turn where it has none, as on Surfaces, and on a page that draws a stage each entity focused in turn by its hash. Every card is read, not one of each type, because a page with an Open all makes every card one click.
- Every string that is an absolute `http` or `https` URL in each model file, where a model file is any file a `<link data-stage href>` on a crawled page names. That needs no list: blust.ch's crawl finds `model.json`, companygraph.io's finds `model.json` and `example.json`, and guestgraph.io's finds none.

**How an own link resolves.** The engine answers from the checkout and the served copy, never from the internet.

- A path must name a file in the served copy; a path ending in `/` must name a folder with an `index.html`, and a path naming that folder without its closing `/` lands the same way, since GitHub Pages redirects the one to the other.
- A `#fragment` on a page that loads `stage.js` must name a node in the file its `<link data-stage>` names, whether or not the link carries `?stage=`, because the stage reads any hash as a node. A node is an entity, the root, or a folder, which is any leading part of an entity's id, since the stage draws every prefix of an id as the folder holding it. A stage page whose `<link data-stage>` names no file fails, because nothing could draw the node.
- A `#fragment` on any other page must name an element `id` on the target page after its scripts have run, or be `#top`, which a browser always finds.
- A query string, `?stage=` among them, is ignored; the path and fragment are what resolve.

The command takes `--base`, the address of the served copy, which defaults to `http://127.0.0.1:8000`, the server every site's CI already starts and waits for at that address.

**How an external link is judged.** A `HEAD` request, with a `GET` whenever the host answers `HEAD` with anything but a 2xx or 3xx, because some hosts answer `HEAD` with 403 or 404 for a page a `GET` serves; the `GET`'s answer is the one judged. A timeout of ten seconds, at most four requests in flight and at most one per host at a time, and one retry after a failure. The answer is one of three:

- **ok**: a 2xx or 3xx, after redirects.
- **broken**: 404 or 410, or a name that does not resolve.
- **unverifiable**: 401, 403, 429, 999, any 5xx, a timeout, or a refused connection. Hosts such as LinkedIn answer every script this way, so these are listed but never called broken.

**Where the modes run.** `design links` becomes a step in each site's `ci.yml`, after `npm run verify` and against the same server, and fails the build on the first run where any own link does not resolve; it prints every failure, not the first. `design links --external` runs in a new workflow, `links.yml`, weekly on Monday and on demand. It never fails the job on what it finds. It does fail when the check itself did not run: when the engine throws, when the served copy does not answer, or when the crawl collects no page, because a weekly job that is broken and one that is clean would otherwise look the same. `design links` holds the same floor, and a run that resolves no link fails rather than passing on nothing. It keeps one issue per repository titled "Broken external links": it opens the issue when a run finds a broken link, rewrites its body on every run to list the broken links and the unverifiable ones with the page or model entry each was found in, and closes it with a comment when a run finds none broken. Each site writes its own `links.yml`, as each wrote its own `indexnow.yml`: the logic is in this package and the workflow only calls it, so the file is a few lines and a group, which copies page assets, is the wrong vehicle for it.

**What is not covered.** mcp.blust.ch has no pages, and the model it serves is the one blust.ch publishes, whose links blust.ch's own run already checks. The decks' PDF exports and audio are files, and are checked as files only: a link inside a PDF is not read.

## 3. Rollout

1. This package: `verify/links.mjs` with its tests against fixtures under `test/`, the `design links` command, and the README section with the workflow a site copies. Released as a minor, because a site that takes the release changes in nothing until it adds the step and the workflow.
2. Each of the three sites, one PR each: the re-pin, the CI step and `links.yml`. Every own link the first run finds broken is fixed in the same PR; every external link the first run finds broken is named in the PR body and left to the issue.

## 4. How it is known to work

- The engine has two parts, tested apart. The part that needs no browser, sorting links, resolving them against a folder and a data file, and judging answers, runs under `node --test` alone. The part that loads pages takes a `chromium` as a parameter, as `cards/export` does, and the bin imports `playwright` from the site, which already has it. This package takes `playwright` as a devDependency and installs Chromium in its own CI, so the fixture site below is loaded in a real browser rather than a fake, because a fragment made by a script and a link written by a card exist only after scripts have run.
- The engine's tests hold a fixture site with one of each: a good and a missing relative page, a good and a missing fragment, a stage link to an entity that is and one that is not in the data, a stage link to a stage page that names no data, a bare `#id` on a stage page naming an entity that is not in its data and one naming a folder that is, a row's `#id` on a page that reads the model without drawing a stage, a card behind an Open all whose link names a missing entity, an `og:image` naming a missing file, a CSS `url()` to a missing font, and an absolute link on the site's own domain.
- A positive control on a real site before its PR merges: `STAGE_PAGE` on Surfaces set to a page that does not exist makes `design links` fail, and set back makes it pass. This is the gap v0.68.0 left open.
- The external mode against a local server that answers 200, 404, 403, 405 to `HEAD` and never, and one that answers `HEAD` with 404 and `GET` with 200, each sorted into its kind.
- Both modes against a site whose crawl finds no page, which fails.
