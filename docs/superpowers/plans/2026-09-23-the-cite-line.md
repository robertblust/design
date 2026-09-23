# The links in an answer: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A chat answer has one link treatment, the card's; a cited entity is linked in the text like a name; and the line under the answer opens with the site's own icon and gives each cite a GitHub mark to the file at the commit.

**Architecture:** `citeLine` becomes a pure part on `rbChat`, taking the cites, the model page, the icon's address or null and a document, so the Node suite holds it on the stub. The page reads its icon once from `<link rel="icon">` and passes it. `nameLinks` is called with the cites beside the names. `chat.css` gains the card's link rule for the body and the line, and the two glyph rules. Nothing outside the `chat` group moves.

**Tech Stack:** `assets/chat.js` (ES5-style IIFE), `assets/chat.css`, `test/chat.test.mjs` on `node --test`, the Octicon `mark-github` inlined as SVG.

**Spec:** `docs/superpowers/specs/2026-09-23-the-cite-line-design.md` in this repository. Read it before any task.

## Global constraints

- A `cite` arrives on the stream as `{ id, title, type, url }`; `url` is the file on GitHub at the commit the host serves, of the form `https://github.com/<org>/<repo>/blob/<sha>/<path>`, and may be null. A `name` arrives as `{ id, title }`. The server keeps the two sets disjoint.
- One link treatment: `.cbody a.go` in `assets/stage.css` is the model, `color:var(--c-mid); text-decoration:none; border-bottom:1px solid var(--c-weak)`, and on hover or focus-visible `border-bottom-color:var(--c-mid)`. Tokens only, so both themes follow.
- The icon stands once, at the head of the line, sixteen pixels; the words "From the model" / "Aus dem Modell" are its accessible name and tooltip. A page with no icon keeps the words, so the line is never a bare list.
- The GitHub mark is the Octicon `mark-github`, MIT, inlined as SVG, fourteen pixels, `--dim`, `--ink` on hover; its accessible name and tooltip are the title, "on GitHub" and the commit's first seven characters read from the URL's `blob/<sha>/` segment. A cite whose `url` is null gets no mark.
- Not a change to the chat server or the MCP server; not a GitHub mark on names in the text.
- Every string lives in `STRINGS` in both languages; the German is a draft for the translator. Swiss Standard German: `ss` never `ß`, Sie never du.
- `assets/chat.js` and `assets/chat.css` are scanned by `test/spelling.test.mjs` for American English.
- Commits in the git register of `conventions/WRITING.md`, a `Verified:` line, then `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Author is the owner: `git config user.email` reads `robert.blust@flatland.ch`.
- Work in `/Users/rob/git/robertblust/design-the-cite-line` on branch `the-cite-line`, already merged up to main at v0.81.0. `export PATH=/opt/homebrew/bin:$PATH` first. Never touch the clone at `design/`.
- The build was cleared by the owner on 2026-09-23 although companygraph.io has not yet taken the files design; only blust.ch re-pins from this release, and companygraph.io's `data-model="/"` change waits for its own migration.

---

### Task 1: `citeLine` is a pure part, and the line carries the icon and the marks

**Files:**

- Modify: `assets/chat.js` — `STRINGS.en`, `STRINGS.de`, `citeLine` (currently inside the page section, after `reset`), the `window.rbChat` line, the opening comment, and the two callers in `finish()` and `restore()`.
- Test: `test/chat.test.mjs`.

**Interfaces:**

- Produces: `rbChat.citeLine(cites, model, icon, doc)` → an element `p.rbchat-cites`. `cites` is the array of `{ id, title, url }`; `model` the model page path; `icon` the icon's address or null; `doc` a document with `createElement`, `createTextNode` and `documentElement.lang`. The language is read from `doc.documentElement.lang`.
- Produces: `STRINGS.<lang>.github`, a template with `{title}`, and `STRINGS.<lang>.commit`, a template with `{sha}`; the mark's name is `github` alone when the URL carries no `blob/<sha>/`, else `github + ", " + commit`.
- Produces: `rbChat.iconOf(doc)` → the `href` of the first `link[rel~="icon"]` in `doc`, or null.

- [ ] **Step 1: Write the failing tests**

Change the destructuring line in `test/chat.test.mjs` to:

```js
const { md, readEvents, strings, link, refocus, nameLinks, when, refusalText, citeLine, iconOf } = globalThis.rbChat;
```

Append at the end of the file:

```js
// citeLine builds elements, so this stub records what a browser would: a tag, its attributes,
// its text and its children, enough to read the line back as a tree.
function domDoc(lang = "en") {
  const make = (tag) => {
    const e = { tag, attrs: {}, children: [], className: "", href: "", _text: "", _html: "" };
    e.appendChild = (c) => { e.children.push(c); return c; };
    e.setAttribute = (k, v) => { e.attrs[k] = String(v); };
    Object.defineProperty(e, "textContent", { get: () => e._text, set: (v) => { e._text = v; } });
    Object.defineProperty(e, "innerHTML", { get: () => e._html, set: (v) => { e._html = v; } });
    return e;
  };
  return { documentElement: { lang }, createElement: make, createTextNode: (v) => ({ text: v }) };
}
const kids = (e) => e.children;
const CITES = [
  { id: "skills/data-modeling", title: "Data modeling", url: "https://github.com/robertblust/mental-model/blob/4d14ec2a1b2c3d4e5f60718293a4b5c6d7e8f901/skills/data-modeling.md" },
  { id: "roles/cdo", title: "CDO", url: null },
];

test("the line opens with the page's icon where it has one, and with the words where it has none", () => {
  const withIcon = citeLine(CITES, "/model/", "/favicon.svg", domDoc());
  assert.equal(withIcon.className, "rbchat-cites");
  const head = kids(withIcon)[0];
  assert.equal(head.tag, "img");
  assert.equal(head.attrs.src, "/favicon.svg");
  assert.equal(head.attrs.alt, "From the model");
  assert.equal(head.attrs.title, "From the model");
  assert.equal(head.attrs.width, "16");
  const noIcon = citeLine(CITES, "/model/", null, domDoc());
  assert.equal(kids(noIcon)[0].tag, "span");
  assert.equal(kids(noIcon)[0].textContent, "From the model: ");
  const de = citeLine(CITES, "/model/", "/favicon.svg", domDoc("de"));
  assert.equal(kids(de)[0].attrs.alt, "Aus dem Modell");
});

test("every cite is a title link to the model page, and a cite with a URL carries the GitHub mark after it", () => {
  const line = citeLine(CITES, "/model/", null, domDoc());
  const links = kids(line).filter((c) => c.tag === "a" && c.className === "rbchat-cite");
  assert.deepEqual(links.map((a) => [a.textContent, a.href]), [
    ["Data modeling", "/model/?stage=expanded#skills/data-modeling"],
    ["CDO", "/model/?stage=expanded#roles/cdo"],
  ]);
  const marks = kids(line).filter((c) => c.tag === "a" && c.className === "rbchat-gh");
  assert.equal(marks.length, 1, "one cite has a URL, one has none");
  assert.equal(marks[0].href, CITES[0].url);
  assert.equal(marks[0].attrs["aria-label"], "Data modeling on GitHub, commit 4d14ec2");
  assert.equal(marks[0].attrs.title, "Data modeling on GitHub, commit 4d14ec2");
  assert.match(marks[0].innerHTML, /<svg[^>]*aria-hidden="true"/);
  const order = kids(line).map((c) => c.tag || "text");
  assert.deepEqual(order, ["span", "a", "a", "text", "a"], "icon-or-words, title, mark, separator, title");
});

test("the mark's name carries no commit when the URL has no blob segment, and the German mark reads auf GitHub", () => {
  const cites = [{ id: "a/b", title: "T", url: "https://github.com/x/y" }];
  const en = citeLine(cites, "/model/", null, domDoc());
  assert.equal(kids(en).find((c) => c.className === "rbchat-gh").attrs["aria-label"], "T on GitHub");
  const de = citeLine(CITES.slice(0, 1), "/model/", null, domDoc("de"));
  assert.equal(kids(de).find((c) => c.className === "rbchat-gh").attrs["aria-label"], "Data modeling auf GitHub, Commit 4d14ec2");
});

test("nameLinks links a cite's title in the text exactly as it links a name's", () => {
  const { doc, root } = fakeDoc(["Read Data modeling first."]);
  nameLinks({}, CITES, "/model/", doc);
  assert.equal(rendered(root), "Read [Data modeling](/model/?stage=expanded#skills/data-modeling) first.");
});

test("the page's icon is the first icon link's address, and a page without one gives null", () => {
  const doc = { querySelector: (sel) => (sel === 'link[rel~="icon"]' ? { href: "https://blust.ch/favicon.svg" } : null) };
  assert.equal(iconOf(doc), "https://blust.ch/favicon.svg");
  assert.equal(iconOf({ querySelector: () => null }), null);
});
```

- [ ] **Step 2: Run the tests to see them fail**

```bash
export PATH=/opt/homebrew/bin:$PATH
node --test test/chat.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)|not a function" | sort | uniq -c
```

Expected: four tests fail with `citeLine is not a function` or `iconOf is not a function`; the `nameLinks` one passes already, since a cite has an id and a title, and is kept as the contract.

- [ ] **Step 3: The strings**

In `STRINGS.en`, after the `again: { … },` line:

```js
      github: "{title} on GitHub", commit: "commit {sha}",
```

In `STRINGS.de`, after its `again: { … },` line:

```js
      github: "{title} auf GitHub", commit: "Commit {sha}",
```

- [ ] **Step 4: Move `citeLine` into the pure parts and give it the icon and the marks**

Delete the current `citeLine` (the four lines beginning `// The cites under an answer, drawn the same way` down to its closing `}`) from the page section. In the pure parts, after `refusalText`, add:

```js
  // The page's own icon, for the head of the cite line: the first `<link rel="icon">`, or
  // null, and then the words stand instead. Read once, on the page; the suite passes a stub.
  function iconOf(doc){
    var l = doc.querySelector && doc.querySelector('link[rel~="icon"]');
    return l && l.href ? l.href : null;
  }

  // GitHub's own mark, the Octicon `mark-github` (MIT), inlined so the page loads nothing.
  var GH = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

  // The line under an answer: the receipt for the rule that every claim comes from a tool's
  // answer. It opens with the site's icon where the page declares one, the words "From the
  // model" as its name and tooltip, and with the words themselves where it does not, so the
  // line is never a bare list. Each cite is its title, linked where a name in the text links,
  // and after it GitHub's mark to the file at the commit the host serves, the one address
  // that lets a reader check the answer without trusting the chat; its name carries the
  // title and the commit's first seven characters, read from the URL's `blob/<sha>/`. A cite
  // without a URL gets no mark. The icon stands once, at the head: a line that repeated it
  // before every title was drawn and declined for the width it costs in a panel that is
  // twenty-six rem on a desk and the whole screen on a phone.
  function citeLine(cites, model, icon, doc){
    var lang = doc.documentElement && doc.documentElement.lang === "de" ? "de" : "en", s = strings(lang);
    var c = doc.createElement("p"); c.className = "rbchat-cites";
    if (icon) {
      var img = doc.createElement("img"); img.className = "rbchat-from";
      img.setAttribute("src", icon); img.setAttribute("alt", s.from); img.setAttribute("title", s.from);
      img.setAttribute("width", "16"); img.setAttribute("height", "16");
      c.appendChild(img);
    } else {
      var words = doc.createElement("span"); words.textContent = s.from + ": "; c.appendChild(words);
    }
    cites.forEach(function(x, i){
      var a = doc.createElement("a"); a.className = "rbchat-cite"; a.href = link(model, x.id); a.textContent = x.title || x.id;
      c.appendChild(a);
      if (x.url) {
        var m = /\/blob\/([0-9a-f]{7,40})\//.exec(x.url);
        var name = s.github.replace("{title}", x.title || x.id) + (m ? ", " + s.commit.replace("{sha}", m[1].slice(0, 7)) : "");
        var g = doc.createElement("a"); g.className = "rbchat-gh"; g.href = x.url;
        g.setAttribute("aria-label", name); g.setAttribute("title", name); g.innerHTML = GH;
        c.appendChild(g);
      }
      if (i < cites.length - 1) c.appendChild(doc.createTextNode(", "));
    });
    return c;
  }
```

- [ ] **Step 5: The page passes its icon, and the cites reach `nameLinks`**

After the `var ENDPOINT = …` line in the page section, add:

```js
  var ICON = iconOf(document);
```

In `finish()`, replace:

```js
      nameLinks(body, names, MODEL, document);
      if (cites.length) ans.appendChild(citeLine(cites));
```

with:

```js
      // A cited entity is linked in the text too, so no title stands plain above the line
      // that cites it; the server keeps cites and names disjoint, so nothing is linked twice.
      nameLinks(body, names.concat(cites), MODEL, document);
      if (cites.length) ans.appendChild(citeLine(cites, MODEL, ICON, document));
```

In `restore()`, replace:

```js
      nameLinks(body, t.names || [], MODEL, document);
      var cites = t.cites || [];
      if (cites.length) ans.appendChild(citeLine(cites));
```

with:

```js
      var cites = t.cites || [];
      nameLinks(body, (t.names || []).concat(cites), MODEL, document);
      if (cites.length) ans.appendChild(citeLine(cites, MODEL, ICON, document));
```

`nameLinks` sorts and matches by `title`, so a cite without a title would match nothing; the server always sends one, and `citeLine` falls back to the id as it did.

- [ ] **Step 6: Export and document**

```js
  window.rbChat = { md: md, readEvents: readEvents, strings: strings, link: link, refocus: refocus, nameLinks: nameLinks, when: when, refusalText: refusalText, citeLine: citeLine, iconOf: iconOf };
```

In the opening comment, after the `rbChat.refusalText` line:

```js
//   rbChat.citeLine(cites, model, icon, doc)  the line under an answer: the icon, each title, each mark
//   rbChat.iconOf(doc)                 the page's icon, for the head of that line
```

- [ ] **Step 7: Run the tests to see them pass**

```bash
node --test test/chat.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)|^not ok"; npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
```

Expected: every test passes, including `test/spelling.test.mjs`.

- [ ] **Step 8: Commit**

```bash
git add assets/chat.js test/chat.test.mjs
git commit -F- <<'EOF'
The cite line opens with the site's icon and marks each file on GitHub

Every cite the chat server sends names the file on GitHub at the commit the host serves, the one address that lets a reader check an answer without trusting the chat, and the widget threw it away; and a cited entity's title stood plain in the text above the line that cited it, which a reader sees as an inconsistency rather than a distinction. `citeLine` is now a pure part on `rbChat`: it opens with the page's own icon where the page declares one, the words "From the model" as its name and tooltip, and with the words where it does not; each cite is its title linked to the model page, and after it GitHub's mark to the file, named by the title and the commit's first seven characters. A cite with no URL gets no mark. The page reads its icon once from its own `<link rel="icon">`, and `nameLinks` now walks the answer for the cites beside the names.

Verified: node --test test/chat.test.mjs and npm test exit 0; the new tests fail before the change and pass after.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: One link, the card's, and the two glyphs

**Files:**

- Modify: `assets/chat.css` — the `.rbchat-cites` rules (currently lines 52 and 53) and one new rule for links in the body.

- [ ] **Step 1: Replace the cite rules and add the body rule**

Replace the two lines:

```css
.rbchat-cites{margin:.5rem 0 0;font-size:.82rem;color:var(--dim)}
.rbchat-cites a{color:var(--c-mid);text-decoration:none}.rbchat-cites a:hover,.rbchat-cites a:focus-visible{text-decoration:underline}
```

with:

```css
/* One link, the card's: a name or a cited title in the answer and a title on the line under it
   take the treatment of a card's model link, .cbody a.go in stage.css, because that is the
   nearest sibling, a body of prose linking into the model. Written in tokens, so both themes
   follow. Before this, a link in the body fell through to the browser's default. */
.rbchat-body a,.rbchat-cites a.rbchat-cite{color:var(--c-mid);text-decoration:none;border-bottom:1px solid var(--c-weak)}
.rbchat-body a:hover,.rbchat-body a:focus-visible,.rbchat-cites a.rbchat-cite:hover,.rbchat-cites a.rbchat-cite:focus-visible{border-bottom-color:var(--c-mid)}
.rbchat-cites{margin:.5rem 0 0;font-size:.82rem;line-height:1.7;color:var(--dim)}
/* The site's icon at the head of the line, once, and GitHub's mark after each title: quiet
   until pointed at, and both sized so the line stays one line on a phone. */
.rbchat-from{width:16px;height:16px;vertical-align:-3px;margin-right:.4rem}
.rbchat-gh{color:var(--dim);margin-left:.25rem;text-decoration:none;border:0}
.rbchat-gh svg{width:14px;height:14px;vertical-align:-2px}
.rbchat-gh:hover,.rbchat-gh:focus-visible{color:var(--ink);outline:none}
.rbchat-gh:focus-visible{box-shadow:0 0 0 2px var(--press)}
```

- [ ] **Step 2: Run the suite**

```bash
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
```

Expected: pass; `test/spelling.test.mjs` scans the comment.

- [ ] **Step 3: Look at it in a browser**

The suite cannot see the line. Copy `assets/chat.js` and `assets/chat.css` beside a scratch page in the scratchpad that links blust.ch's `tokens.css` (from `/Users/rob/git/robertblust/robertblust.github.io/tokens.css`, copied too), declares `<link rel="icon" href="favicon.svg">` (copy `/Users/rob/git/robertblust/robertblust.github.io/favicon.svg`), sets `data-chat="http://chat.test/chat"` and `data-model="/model/"`. Under Playwright from the worktree's `node_modules`, route the endpoint to a stream:

```
event: text
data: {"text":"Skills drawn on: Data modeling and Integration architecture."}

event: cite
data: {"id":"skills/data-modeling","title":"Data modeling","type":"skill","url":"https://github.com/robertblust/mental-model/blob/4d14ec2a1b2c3d4e5f60718293a4b5c6d7e8f901/skills/data-modeling.md"}

event: names
data: {"names":[{"id":"skills/integration-architecture","title":"Integration architecture"}]}

event: done
data: {"spent":1}

```

Send a message and take four screenshots: a 1280×800 viewport and a 390×844 one, each with `<html data-theme="light">` and `<html data-theme="dark">` (read how blust.ch's pages set the theme attribute in `tokens.css` and use the same). Read the screenshots with the Read tool. Expect: both "Data modeling" and "Integration architecture" in the accent with a hairline under them and no underline; the line under the answer opening with the favicon, then "Data modeling" as a link, then a small GitHub mark; hovering the mark is not checked. Name in the commit's `Verified:` line what was seen.

- [ ] **Step 4: Commit**

```bash
git add assets/chat.css
git commit -F- <<'EOF'
An answer has one link, the card's

The names in an answer were white with an underline, no link the family draws: a page sets a{color:inherit} and styles every link by its place, and chat.css had no rule for a link in the body, so a name fell through to the browser's default over the page's inherited ink. A link in the body and a title on the cite line now take the treatment of a card's model link, the accent over a hairline in --c-weak that firms to --c-mid under the pointer, the nearest sibling in the family; the icon and the GitHub mark get their two sizes and the mark its dim-to-ink hover.

Verified: npm test exits 0; under Playwright on a scratch page with blust.ch's tokens and icon, at 1280 and 390 wide in both themes, the names and the cited title in the text and the title on the line share one treatment, the line opens with the favicon and the cited file carries the mark.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: The README, the NOTICE and 0.82.0

**Files:**

- Modify: `README.md`, the chat paragraph beginning `A site takes the chat by naming`.
- Modify: `NOTICE`, the list of third-party files.
- Modify: `package.json` line 3.

- [ ] **Step 1: The README's chat paragraph**

After the sentence ending `a site adds nothing but the tag.` and before `Where the chat host names the moment`, insert:

```
The line under an answer is the receipt for the rule that every claim comes from a tool's answer: it opens with the page's own icon, read from its `<link rel="icon">`, so a site that wants one there declares one in its head and adds nothing to the tag, and after each cited title stands GitHub's mark to the file at the commit the host serves; a page that declares no icon keeps the words "From the model".
```

- [ ] **Step 2: The NOTICE names the Octicon**

Append to the list in `NOTICE`:

```

- assets/chat.js, the `mark-github` glyph inlined as SVG
  Upstream: Octicons — https://github.com/primer/octicons
  Copyright (c) GitHub Inc.
  License: MIT
```

- [ ] **Step 3: The version**

```bash
export PATH=/opt/homebrew/bin:$PATH
npm version minor --no-git-tag-version >/dev/null; git checkout package-lock.json; grep '"version"' package.json
```

Expected: `"version": "0.82.0"`, lockfile untouched.

- [ ] **Step 4: The checks**

```bash
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"; sh conventions/conventions-check; echo "check exit=$?"; sh conventions/conventions-format; echo "format exit=$?"
```

Expected: all pass. If `conventions-format` reports the plan file, run `sh conventions/conventions-format fix` and add the plan to the commit.

- [ ] **Step 5: Commit, push, update the pull request**

```bash
git add README.md NOTICE package.json docs/superpowers/plans/2026-09-23-the-cite-line.md
git commit -F- <<'EOF'
The README says what the line shows, and this is 0.82.0

The chat paragraph says what the line under an answer is and shows, and that the icon is the page's own, so a site that wants one there declares one in its head. The NOTICE names the Octicon the mark is, MIT, as it names every third-party file the package ships. The package moves to 0.82.0: chat.js and chat.css are synced files, and a site takes them by re-pin alone. The plan the branch was built from sits beside the spec.

Verified: npm test, sh conventions/conventions-check and sh conventions/conventions-format exit 0.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
git push
```

Then rewrite the description of robertblust/design #121 with `gh pr edit 121 -R robertblust/design --body-file -`, in the git register, ending with a `Verified:` line and `🤖 Generated with [Claude Code](https://claude.com/claude-code)`, report the checks, and stop. The merge, the tag and the re-pin wait for the owner's word; only blust.ch re-pins from this release, and companygraph.io's `data-model="/"` change waits for its own migration.

---

## Self-review

Spec coverage: one link, the card's (Task 2); a cited entity linked in the text through `nameLinks` (Task 1 step 5 and the test); the line with the icon at its head, the words as name and tooltip, the words kept where no icon is declared, each title linked, the mark after each title with the URL, its name from the title and the seven-character commit, no mark for a null URL (Task 1); the mark inlined as SVG, MIT, named in the NOTICE (Tasks 1 and 3); the README (Task 3); the strings in both languages (Task 1 step 3); `citeLine` exported and tested on the stub with the spec's cases (Task 1); the rendering look at two widths in both themes (Task 2 step 3); companygraph.io's `data-model` change is that site's own pull request and is out of this package (constraints).

Placeholders: none. Types: `citeLine(cites, model, icon, doc)` and `iconOf(doc)` carry the same shape in every task; `.rbchat-cite`, `.rbchat-gh` and `.rbchat-from` are the same class names in the JS, the CSS and the tests.
