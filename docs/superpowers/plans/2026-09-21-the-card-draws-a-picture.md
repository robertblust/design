# The card draws a picture implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `rbCard.render` draws a round 64-pixel picture beside the name of an entity that carries an `image`, on a page that says it serves the model's images, and the package ships the step that writes those images into a site.

**Architecture:** A page opts in on the link that already names its data: `<link … data-stage data-images="../images/">`. `card.js` reads that attribute itself, so none of the four places that call `rbCard.render` — `stage.js`, the `model card` and `surfaces lineage` fences, and blust.ch's timeline — changes, and a page that declares nothing draws the card it always drew, which is what lets a site re-pin before it has taken the copy step. The file is addressed as `<base><entity id>.<extension>`, the name `imagesOf` in companygraph-meta-model gives it. `lib/images.mjs` writes and checks a site's `images/` folder from those entries and knows nothing about a model, so this package takes no dependency on the parser.

**Tech Stack:** Node 22+, no runtime dependencies; `node:test`; `card.js` is plain ES5 run in the browser and, in tests, under `node:vm` against a stub document.

**Spec:** `docs/superpowers/specs/2026-09-21-a-profile-carries-an-image-design.md` in companygraph/meta-model (sections “The card” and “From the model to a page”). One departure, decided while prototyping and recorded here: the spec has each caller pass `images` in the options; the page's data link carries it instead, and `opts.images` stays as an override. Four callers would otherwise each learn where a site keeps its images, and two of them are fences inlined in three sites.

Every code block and expected output below was run once in a throwaway clone of `main` at b11a2ec, wired into a scratch copy of blust.ch with the owner's own photo: the avatar drew at 64 by 64 from a 1000-pixel source in both themes and at phone width, with `alt` set, no request failed and no `image` row in the field list.

## Global Constraints

- **Scope is this repository only.** The sites take the release afterwards, each in its own pull request.
- **Branch and worktree:** `the-card-draws-a-picture`, in `~/git/robertblust/design-the-card-draws-a-picture`, which holds this plan. The clone at `~/git/robertblust/design` stays on `main`.
- **`export PATH=/opt/homebrew/bin:$PATH`** before any `node`, `npm` or `gh` command. A push names the credential helper: `git -c credential.helper='!/opt/homebrew/bin/gh auth git-credential' push -u origin the-card-draws-a-picture`.
- **`npm ci` once in the worktree before the full suite**: `test/links-site.test.mjs` imports Playwright and fails with `ERR_MODULE_NOT_FOUND` in a tree that has no `node_modules`.
- **`card.js` is ES5**: `var`, `function`, no arrow functions, no template strings, as the rest of the file is.
- **The picture is 64 CSS pixels, round, `alt` the entity's name, `loading="lazy"`, `width` and `height` set**, and `image` is never listed as a field, with a picture or without.
- **The address is `<base><entity id>.<extension>`**, the extension taken from the field's value; a value that is not `.jpg`, `.jpeg` or `.png` draws nothing.
- **American English in everything the package ships**; `test/spelling.test.mjs` holds it.
- **Never commit on the default branch.** Never chain a branch delete after a merge. Merging and tagging each wait for the owner's word.
- **Commit messages** follow the git register: a subject that is a sentence under seventy characters with no prefix and no trailing period, a body of one to three short paragraphs with no headers and no bullets, one line beginning `Verified:` naming what ran and passed after the last edit, then the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **The release is a minor**: a synced file changes, and a site needs nothing beyond `npm run design` to take it. When this plan was written `package.json` read `0.73.0`, which makes it `0.74.0`; if another release has landed, take the next minor after what it reads now.

---

### Task 1: The card draws the picture

**Files:**

- Modify: `assets/card.js` (the header comment, two helpers above `function render`, the head of `render`, the field filter)
- Modify: `assets/stage.css` (three rules above `.cbody .tag`)
- Create: `test/card-avatar.test.mjs`

**Interfaces:**

- Consumes: nothing new.
- Produces: `rbCard.render(entity, bodyEl, footEl, { data, lang, link, note, images })`; the markup `div.chead > img.avatar + h3` where a picture is drawn, and the bare `h3` where none is.

- [ ] **Step 1: Write the failing test**

Create `test/card-avatar.test.mjs`:

```js
// card.js run under node against a stub document, as card-resolve.test.mjs does: when a card
// draws a picture. A site serves the model's images only once it has taken the copy step, and
// says so on its data link, so a card on a page that says nothing draws what it always drew.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function El(tag) { this.tag = tag; this.kids = []; this.className = ""; this.attrs = {}; this.style = {}; }
El.prototype.appendChild = function (c) { this.kids.push(c); return c; };
El.prototype.removeChild = function (c) { this.kids = this.kids.filter((k) => k !== c); };
El.prototype.setAttribute = function (k, v) { this.attrs[k] = v; };
El.prototype.getAttribute = function (k) { return k in this.attrs ? this.attrs[k] : null; };
El.prototype.removeAttribute = function (k) { delete this.attrs[k]; };
El.prototype.addEventListener = function () {};
Object.defineProperty(El.prototype, "firstChild", { get() { return this.kids[0]; } });
Object.defineProperty(El.prototype, "textContent", {
  set(v) { this.kids = [{ text: String(v) }]; },
  get() { return this.kids.map((k) => (k.tag ? k.textContent : k.text)).join(""); },
});

function load(dataImages) {
  const link = new El("link");
  if (dataImages != null) link.attrs["data-images"] = dataImages;
  const document = { createElement: (t) => new El(t), createTextNode: (t) => ({ text: t }),
    addEventListener() {}, body: new El("body"), querySelector: (q) => (q === "link[data-stage]" ? link : null) };
  const window = { addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(new URL("../assets/card.js", import.meta.url), "utf8"), { window, document, console, setTimeout });
  return window.rbCard;
}
const find = (n, pred, out = []) => { if (n.tag && pred(n)) out.push(n); (n.kids || []).forEach((k) => find(k, pred, out)); return out; };

const mira = (image) => ({ id: "profiles/mira", type: "profile", name: "Mira Halvorsen", tagline: "t", path: "m.md",
  fields: { source: "Local", nature: "human", ...(image ? { image } : {}) }, sections: [] });

function draw(entity, { dataImages, images } = {}) {
  const rbCard = load(dataImages);
  const body = new El("div"), foot = new El("span");
  rbCard.render(entity, body, foot, { data: { entities: [entity], edges: [], commit: "abc", repo: "o/r" }, lang: "en", link: null, images });
  return body;
}

test("a page that serves images draws the picture beside the name, addressed by the entity's id", () => {
  const body = draw(mira("mira.jpg"), { dataImages: "../images/" });
  const [img] = find(body, (n) => n.tag === "img");
  assert.ok(img, "no img drawn");
  assert.equal(img.attrs.src, "../images/profiles/mira.jpg");
  assert.equal(img.attrs.alt, "Mira Halvorsen");
  assert.equal(img.attrs.width, "64");
  assert.equal(img.attrs.height, "64");
  assert.equal(img.attrs.loading, "lazy");
  const [head] = find(body, (n) => n.className === "chead");
  assert.deepEqual(head.kids.map((k) => k.tag), ["img", "h3"]);
});

test("a base without its slash, and one handed in opts, address the same file", () => {
  assert.equal(find(draw(mira("mira.png"), { dataImages: "../images" }), (n) => n.tag === "img")[0].attrs.src, "../images/profiles/mira.png");
  assert.equal(find(draw(mira("mira.png"), { images: "/images/" }), (n) => n.tag === "img")[0].attrs.src, "/images/profiles/mira.png");
});

test("a page that declares no images draws the card it always drew", () => {
  const body = draw(mira("mira.jpg"));
  assert.equal(find(body, (n) => n.tag === "img").length, 0);
  assert.equal(find(body, (n) => n.className === "chead").length, 0);
  assert.equal(find(body, (n) => n.tag === "h3").length, 1);
});

test("an entity without an image draws no picture on a page that serves them", () => {
  assert.equal(find(draw(mira(null), { dataImages: "../images/" }), (n) => n.tag === "img").length, 0);
});

test("the file name is never listed as a field, with a picture or without", () => {
  for (const opts of [{ dataImages: "../images/" }, {}]) {
    const terms = find(draw(mira("mira.jpg"), opts), (n) => n.tag === "dt").map((n) => n.textContent);
    assert.ok(!terms.includes("image"), terms.join(", "));
    assert.ok(terms.includes("nature"), terms.join(", "));
  }
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/card-avatar.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)"`

Expected: `pass 2`, `fail 3`. The two that pass are the cases where no picture is drawn, which today's card satisfies; the three that fail are the picture, its address and the field list.

- [ ] **Step 3: Draw it**

In `assets/card.js`, in the header comment, change the signature line to `//   rbCard.render(entity, bodyEl, footEl, { data, lang, link, note, images })` and insert before the line `//   rbCard.fmtPeriod(stamp, lang), rbCard.fmtDate(value, lang)`:

```js
//     images optional; the base the page serves the model's images at. Left out, it is what
//            the page's data link declares in `data-images`, and no picture where it declares none
```

Insert directly above `function render(e, bodyEl, footEl, opts){`:

```js
  // Where the page serves the model's images, or null where it serves none. A site copies each
  // image beside its model.json as `<entity id>.<extension>` and says so on the link that names
  // its data — `data-images="../images/"` — so a page that has not taken the copy step draws no
  // broken picture: it draws the card it always drew.
  function imagesBase(){
    var link = document.querySelector("link[data-stage]");
    return link && link.getAttribute ? link.getAttribute("data-images") : null;
  }
  // The size is set on the element so nothing shifts when the file arrives, and the name is
  // the text a reader without the picture gets.
  function avatar(e, base){
    var name = e.fields && e.fields.image;
    if (!base || typeof name !== "string" || !/\.(jpe?g|png)$/.test(name)) return null;
    var img = h("img", null, "avatar");
    img.setAttribute("src", base.replace(/\/?$/, "/") + e.id + "." + name.split(".").pop());
    img.setAttribute("alt", e.name);
    img.setAttribute("width", "64"); img.setAttribute("height", "64");
    img.setAttribute("loading", "lazy"); img.setAttribute("decoding", "async");
    return img;
  }

```

In `render`, replace the line `bodyEl.appendChild(h("h3", e.name));` that follows the eyebrow with:

```js
    // A picture of what the card names, where the entity carries one and the page serves it:
    // the name sits beside it in one row, and without it the name stands alone as it always did.
    var pic = avatar(e, opts.images != null ? opts.images : imagesBase());
    if (pic) {
      var head = h("div", null, "chead");
      head.appendChild(pic); head.appendChild(h("h3", e.name));
      bodyEl.appendChild(head);
    } else bodyEl.appendChild(h("h3", e.name));
```

And replace the field filter line with:

```js
    // `image` is a third: a file name under the picture it names says nothing.
    var keys = Object.keys(e.fields).filter(function(k){ return k !== "source" && k !== "skills" && k !== "image"; });
```

In `assets/stage.css`, insert above the rule `.cbody .tag{…}`:

```css
  .cbody .chead{margin-top:.35rem; display:flex; align-items:center; gap:.85rem}
  .cbody .chead h3{margin-top:0; min-width:0}
  .cbody .avatar{flex:none; width:64px; height:64px; border-radius:50%; object-fit:cover; background:var(--raise); box-shadow:0 0 0 1px var(--rule)}
```

The ring is a shadow in `--rule` so a picture on a light ground keeps an edge in the light theme; `--raise` is what shows until the file arrives.

- [ ] **Step 4: Run the tests**

```bash
export PATH=/opt/homebrew/bin:$PATH
cd ~/git/robertblust/design-the-card-draws-a-picture
node --test test/card-avatar.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)"
node --test test/card-resolve.test.mjs test/card-blocks.test.mjs test/spelling.test.mjs test/assets.test.mjs > /dev/null 2>&1; echo "neighbors $?"
```

Expected: `pass 5`, `fail 0`; `neighbors 0`.

- [ ] **Step 5: Commit**

```bash
cd ~/git/robertblust/design-the-card-draws-a-picture && git add assets/card.js assets/stage.css test/card-avatar.test.mjs && git commit -F - <<'MSG'
The card draws a picture beside the name of what carries one

A card that names a person showed a name and a tagline and nothing a
reader recognizes them by. A profile may now carry an image, and the card
draws it round, 64 pixels, beside the name, with the name as its text and
its size set so nothing shifts when the file arrives.

A page says it serves the model's images on the link that already names
its data, data-images, and the card reads it there. None of the four
places that draw a card changes, and a page that says nothing draws the
card it always drew, so a site can take this release before it copies a
single image. The file name is never listed as a field.

Verified: node --test test/card-avatar.test.mjs passes and three of its
five cases fail on the card before this; card-resolve, card-blocks,
spelling and assets pass.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

### Task 2: The package writes a site's images

**Files:**

- Create: `lib/images.mjs`
- Create: `test/images.test.mjs`
- Modify: `package.json` (`exports`, after the `./crawl` line)

**Interfaces:**

- Consumes: nothing from Task 1. Its input is the array `imagesOf` returns in companygraph-meta-model, of which it reads `to` (string) and `bytes` (`Uint8Array` or `ArrayBuffer`).
- Produces: `@robertblust/design/images` exporting `syncImages({ root, images, check = false, dir = "images" }) → { wanted: string[], problems: string[] }` and `IMAGES_DIR`. With `check`, nothing is written and `problems` holds one line per file that differs, is missing, or stands unnamed; without it the folder is made right and `problems` is empty.

- [ ] **Step 1: Write the failing test**

Create `test/images.test.mjs`:

```js
// The copy step a site runs beside its model build, against a temporary site root.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncImages } from "../lib/images.mjs";

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "design-images-"));
const image = (to, text) => ({ to, bytes: new TextEncoder().encode(text) });

test("it writes each image under images/ at the entity's id, and a second run changes nothing", () => {
  const root = temp();
  const images = [image("profiles/mira.jpg", "mira"), image("identity.png", "mark")];
  assert.deepEqual(syncImages({ root, images }), { wanted: ["identity.png", "profiles/mira.jpg"], problems: [] });
  assert.equal(fs.readFileSync(path.join(root, "images/profiles/mira.jpg"), "utf8"), "mira");
  assert.deepEqual(syncImages({ root, images, check: true }).problems, []);
});

test("check names a copy that differs, one that is missing and one nothing names, and writes nothing", () => {
  const root = temp();
  syncImages({ root, images: [image("profiles/mira.jpg", "mira"), image("profiles/old.png", "old")] });
  fs.writeFileSync(path.join(root, "images/profiles/mira.jpg"), "edited");
  const { problems } = syncImages({ root, check: true, images: [image("profiles/mira.jpg", "mira"), image("profiles/tomas.png", "tomas")] });
  assert.deepEqual(problems, [
    "images/profiles/mira.jpg is not the image the pinned model holds",
    "images/profiles/tomas.png is missing",
    "images/profiles/old.png is named by nothing in the pinned model",
  ]);
  assert.equal(fs.readFileSync(path.join(root, "images/profiles/mira.jpg"), "utf8"), "edited");
  assert.ok(!fs.existsSync(path.join(root, "images/profiles/tomas.png")));
});

test("a run removes what nothing names, and the folder when the model names no image", () => {
  const root = temp();
  syncImages({ root, images: [image("profiles/mira.jpg", "mira")] });
  syncImages({ root, images: [] });
  assert.ok(!fs.existsSync(path.join(root, "images")));
  assert.deepEqual(syncImages({ root, images: [], check: true }).problems, []);
});

test("an ArrayBuffer is written as the bytes it holds", () => {
  const root = temp();
  syncImages({ root, images: [{ to: "profiles/mira.png", bytes: new Uint8Array([1, 2, 3]).buffer }] });
  assert.deepEqual([...fs.readFileSync(path.join(root, "images/profiles/mira.png"))], [1, 2, 3]);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/images.test.mjs 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|^ℹ fail"`

Expected: `ERR_MODULE_NOT_FOUND` for `lib/images.mjs`, and `ℹ fail 1`.

- [ ] **Step 3: Write it**

Create `lib/images.mjs`:

```js
// Writes the images a site's model names into the site, or checks that what is there is still
// what the pinned model holds. A site serves its own copy, pinned as its model.json is, so a
// visitor's browser asks no third party for a picture — and a copy is a second thing to keep
// true, which is what `check` is for: a file that differs, one that is missing and one that
// stands although nothing names it each fail by name.
//
// What to copy is the parser's to say (`imagesOf` in companygraph-meta-model/instance): each
// entry carries `to`, the entity's id and the image's extension, and `bytes`. This file knows
// the folder and nothing about a model, so the design system takes no dependency on the parser.
import fs from "node:fs";
import path from "node:path";

export const IMAGES_DIR = "images";

const under = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(path.join(dir, d), { withFileTypes: true })) {
      const child = d ? `${d}/${e.name}` : e.name;
      if (e.isDirectory()) walk(child); else out.push(child);
    }
  };
  if (fs.existsSync(dir)) walk("");
  return out.sort();
};

// → { wanted, problems }: `problems` is what `check` found or, without it, empty, since the
// folder has then been made right. The folder belongs to this step whole: a file in it that no
// entry names is removed, and the folder itself when the model names no image at all.
export function syncImages({ root, images, check = false, dir = IMAGES_DIR }) {
  const target = path.join(root, dir);
  const wanted = new Map(images.map((i) => [i.to, Buffer.from(i.bytes)]));
  const problems = [];
  for (const [to, bytes] of wanted) {
    const at = path.join(target, to);
    const current = fs.existsSync(at) ? fs.readFileSync(at) : null;
    if (current && current.equals(bytes)) continue;
    if (check) problems.push(`${dir}/${to} ${current ? "is not the image the pinned model holds" : "is missing"}`);
    else { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, bytes); }
  }
  for (const rel of under(target)) {
    if (wanted.has(rel)) continue;
    if (check) problems.push(`${dir}/${rel} is named by nothing in the pinned model`);
    else fs.rmSync(path.join(target, rel));
  }
  if (!check) {
    // Folders the removals emptied, deepest first, and the folder itself with them.
    const dirs = [];
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) { walk(path.join(d, e.name)); dirs.push(path.join(d, e.name)); } };
    if (fs.existsSync(target)) { walk(target); dirs.push(target); }
    for (const d of dirs) if (!fs.readdirSync(d).length) fs.rmdirSync(d);
  }
  return { wanted: [...wanted.keys()].sort(), problems };
}
```

In `package.json`, add to `exports` directly after the line `"./crawl": "./lib/crawl.mjs",`:

```json
    "./images": "./lib/images.mjs",
```

- [ ] **Step 4: Run the tests**

```bash
export PATH=/opt/homebrew/bin:$PATH
cd ~/git/robertblust/design-the-card-draws-a-picture
node --test test/images.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)"
node --test test/verify-exports.test.mjs test/cards-packaging.test.mjs test/spelling.test.mjs > /dev/null 2>&1; echo "packaging $?"
```

Expected: `pass 4`, `fail 0`; `packaging 0`.

- [ ] **Step 5: Commit**

```bash
cd ~/git/robertblust/design-the-card-draws-a-picture && git add lib/images.mjs test/images.test.mjs package.json && git commit -F - <<'MSG'
The package writes a site's images and checks them

A site serves its own copy of each picture its model names, pinned as its
model.json is, so a visitor's browser asks no third party for one. A copy
is a second thing to keep true, and all three sites would otherwise carry
their own way of keeping it, so the step is here: it writes images/ from
what the parser says to publish, and with check it names a file that
differs, one that is missing and one nothing names, and writes nothing.

It reads only where a file goes and its bytes, so the design system takes
no dependency on the parser.

Verified: node --test test/images.test.mjs passes, and verify-exports,
cards-packaging and spelling pass with the new export.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

### Task 3: The manual says it, the release is prepared, and the pull request opened

**Files:**

- Modify: `README.md` (the paragraph that opens `A page that draws a stage names the file it draws`, and the list of what the package exports if it names `./crawl`)
- Modify: `package.json` (`version`)

**Interfaces:**

- Consumes: Tasks 1 and 2, committed and green.
- Produces: a pull request, green, waiting for the owner; after the merge and only on the owner's word, the tag `v0.74.0` and a GitHub Release.

- [ ] **Step 1: Say it in the manual**

In `README.md`, append to the end of the paragraph that opens `A page that draws a stage names the file it draws` (same line, since a paragraph is one line):

```markdown
 A page whose site serves the model's images says so on the same link, `data-images="../images/"`, the folder `syncImages` from `@robertblust/design/images` writes beside `model.json`; a card then draws the picture of an entity that carries an `image`, addressed by the entity's id, and a page that declares nothing draws the card without one.
```

Run `grep -n '"./crawl"\|/crawl`' README.md`. If the README lists the package's exports and names `./crawl` there, add `./images` beside it in the same form, with the words “writes and checks a site's `images/` folder”; if it does not, add nothing.

- [ ] **Step 2: Raise the version**

Read `sed -n '3p' package.json`. It read `"version": "0.73.0",` when this plan was written; set it to `"version": "0.74.0",`, or to the next minor after what it reads now.

- [ ] **Step 3: Verify**

```bash
export PATH=/opt/homebrew/bin:$PATH
cd ~/git/robertblust/design-the-card-draws-a-picture
npm ci > /dev/null 2>&1; echo "install $?"
npm test > /dev/null 2>&1; echo "tests $?"
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
sh conventions/conventions-format > /dev/null; echo "format $?"
sh conventions/conventions-check > /dev/null; echo "prose $?"
git status --short
```

Expected: four zeros, `fail 0`, and only `README.md` and `package.json` modified. If `npm ci` changed `package-lock.json`, it should not have: restore it with `git checkout package-lock.json` and say so in the report.

- [ ] **Step 4: Commit**

```bash
cd ~/git/robertblust/design-the-card-draws-a-picture && git add README.md package.json && git commit -F - <<'MSG'
The package is v0.74.0, and the manual names data-images

The card's picture and the images step change synced files, so this is a
minor, and a site takes it with npm run design and nothing else: a page
that declares no images draws the card it drew. The manual says where a
page declares them, on the link that names its data.

Verified: npm test, sh conventions/conventions-format and sh
conventions/conventions-check exit 0 after npm ci.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

- [ ] **Step 5: Push and open the pull request, then stop**

Push with the credential helper named in the constraints. Read the last two merged pull request bodies first — `gh pr list --state merged --limit 2 --json body` — and match their shape: prose, no headers, no bullets, ending with a `Verified:` line, then `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Name companygraph/meta-model#136 and its release v0.42.0 as what this follows. Open it with `gh pr create --base main`, watch `gh pr checks --watch` until `test` and `conventions / conventions` report, and say what they reported. Then stop: merging is the owner's word.

- [ ] **Step 6: Tag and release, after the merge and only on the owner's word**

On a detached `origin/main`, run `npm test`, then `git tag v0.74.0`, push the tag, and `gh release create v0.74.0` with notes in the prose register saying: a card draws a picture where the entity carries an `image` and the page's data link declares `data-images`; nothing changes on a page that declares none; `@robertblust/design/images` exports `syncImages` for a site's model build; to take it, re-pin and run `npm run design`.

---

## What this plan does not do

blust.ch takes the release in its own plan, `docs/superpowers/plans/2026-09-21-the-card-shows-the-person.md` in robertblust.github.io, which also re-pins the parser, copies the images and writes `Person.image`. companygraph.io and guestgraph.io re-pin whenever their next design release is taken and add the copy step only once a profile of theirs carries an image. The `/team/` board names a seat's holder in text; a small picture there is a separate idea and not part of this.
