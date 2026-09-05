# The card leaves the stage, and the nav gains Timeline — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release v0.30.0 of `@robertblust/design`: the entity card and the date formatting move
out of `stage.js` into a `card.js` every stage page loads, `stage.css` gains the ledger's
rules, and the header contract names Timeline after Model.

**Architecture:** `card.js` is a whole-file asset in the `stage` group, like `stage.js`, and
defines one global, `rbCard`, with `render`, `fmtPeriod` and `fmtDate`. `stage.js` keeps the
drawing and the root and folder cards and calls `rbCard` for an entity. The header block and the
shared `navOrder` check change one word each. Nothing is fenced; every changed file is synced
whole.

**Tech Stack:** plain browser JavaScript in an IIFE, no modules, no build; `node --test` for the
package's own tests; a git tag and a GitHub Release.

**Spec:** `robertblust/robertblust.github.io`, `docs/superpowers/specs/2026-09-05-timeline-page-design.md`,
§5 (the card) and §6 (this release). The site's plan, which takes this release, is
`docs/superpowers/plans/2026-09-05-timeline-page.md` in that repository.

## Global Constraints

- Every word in a shipped file is en-US; `test/spelling.test.mjs` scans what ships and must
  scan `assets/card.js` too.
- A change to a synced file is at least a minor; a change needing a site edit beyond
  `npm run design` is a major. This release needs one script line on every stage page, so the
  notes say **breaking** and the number is v0.30.0, the family's habit below 1.0.
- `versions.json`'s `header` and the `header contract · vN` line in `blocks/header.css` move
  together; `test/fences.test.mjs` fails if they disagree.
- Commits are authored by Rob, with the tool in a `Co-Authored-By` trailer; the subject is a
  sentence with no type prefix; the body ends with a `Verified:` line. Nothing is merged
  without his word.
- Work on a branch named for the change, off `main`.

---

### Task 1: `card.js`, the entity card and the dates, moved out of `stage.js`

**Files:**
- Create: `assets/card.js`
- Modify: `assets/stage.js` (lines 39–83 the strings and dates; 578–727 `renderInto` and its helpers)
- Modify: `lib/groups.mjs:22-26`
- Modify: `test/groups.test.mjs:41-44`
- Modify: `test/assets.test.mjs:60-68`
- Modify: `test/spelling.test.mjs:15`

**Interfaces:**
- Produces: `window.rbCard.render(entity, bodyEl, footEl, opts)` where `opts` is
  `{ data, lang, link, note }`: `data` the parsed block (needs `data.entities`, `data.commit`,
  `data.repo`); `lang` `"en"` or `"de"`; `link(id)` a function returning an Element for a
  reference that resolved to the entity `id`; `note` an optional string appended after the
  tagline as `p.empty`. Also `window.rbCard.fmtPeriod(stamp, lang)` for
  `{start, end}` in `YYYY`, `YYYY-MM` or `YYYY-MM-DD`, and `window.rbCard.fmtDate(value, lang)`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing tests**

Append to `test/assets.test.mjs`:

```js
test("card.js is in the stage group and defines rbCard with render, fmtPeriod and fmtDate", () => {
  const dests = GROUPS.stage.map(([, to]) => to);
  assert.ok(dests.includes("card.js"), "card.js is not shipped with the stage");
  const js = asset("assets/card.js");
  assert.match(js, /window\.rbCard\s*=\s*\{/);
  for (const fn of ["render", "fmtPeriod", "fmtDate"])
    assert.match(js, new RegExp(fn + ":\\s*" + fn), `rbCard exposes no ${fn}`);
});

test("stage.js no longer carries the card or the dates — it calls rbCard", () => {
  const js = asset("assets/stage.js");
  assert.ok(!/function fmtPeriod\(/.test(js), "fmtPeriod still lives in stage.js");
  assert.ok(!/function fmtDate\(/.test(js), "fmtDate still lives in stage.js");
  assert.ok(!/function extLink\(/.test(js), "extLink still lives in stage.js");
  assert.match(js, /rbCard\.render\(/);
  assert.match(js, /rbCard\.fmtPeriod\(/);
});
```

Change the existing test `a \`- \` block becomes a list, and the marker is not printed as text`
so that it reads `asset("assets/card.js")` instead of `asset("assets/stage.js")` — the branch
it guards moves.

In `test/groups.test.mjs`, change the stage group test:

```js
test("the stage group carries the card, the script, the stylesheet and the vendored d3", () => {
  const dests = GROUPS.stage.map(([, to]) => to).sort();
  assert.deepEqual(dests, ["card.js", "d3.v7.min.js", "stage.css", "stage.js"]);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test 2>&1 | grep -E "^not ok|# fail"`
Expected: three failures — the card test, the stage-no-longer test, the group test.

- [ ] **Step 3: Create `assets/card.js`**

The body of `renderInto`'s entity branch and the date functions, moved without change of
behavior. Copy the functions out of `assets/stage.js` as they stand, then apply the edits
below; the file must read exactly like this in structure:

```js
// The card: one entity of a data block, rendered into a body and a foot. Two pages draw it —
// the stage beside its drawing, and a ledger under one of its rows — and the day it lived
// inside stage.js a second page could only copy it, which it did, and drifted in seven places
// within a day. So it is a file of its own, synced whole, loaded before whichever script
// calls it, and it knows no page: what it cannot read off the entity it takes from `opts`.
//
//   rbCard.render(entity, bodyEl, footEl, { data, lang, link, note })
//     data   the parsed block: entities for resolving a reference, commit and repo for the foot
//     lang   "en" or "de" — the caller reads <html lang>; this file never does
//     link   (id) → Element: what a resolved reference becomes. The stage hands back a link
//            that focuses the node; the timeline hands back one that opens the model page on it.
//     note   optional; one line appended after the tagline as p.empty — the stage's page count
//            on the root
//   rbCard.fmtPeriod(stamp, lang), rbCard.fmtDate(value, lang)
//     how a date reads, in which language. Moved here because a ledger's stamps and a stage's
//     have to read the same, and one copy is the only way that stays true.
(function(){
  var STR = {
    view: { en:"View this file on GitHub", de:"Diese Datei auf GitHub ansehen" },
    now:  { en:"present",                 de:"heute" }
  };
  // A date is drawn as prose, not as the ISO the model stores, so the months travel with the
  // script the way every other word here does. The three lengths are core's three precisions:
  // a year, a month, a day — written at the precision the model holds and never padded up.
  var MONTHS = {
    en: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    de: ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"]
  };
  function fmtDate(v, lang){
    var m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(v || "");
    if (!m) return v || "";
    if (!m[2]) return m[1];
    var mon = MONTHS[lang][+m[2] - 1];
    if (!m[3]) return mon + " " + m[1];
    // "May 4, 2012" and "4. Mai 2012". The page is en-US, so the English day follows the
    // month and a comma sets off the year; the German ordinal carries its point and comes
    // first.
    if (lang === "de") return (+m[3]) + ". " + mon + " " + m[1];
    return mon + " " + (+m[3]) + ", " + m[1];
  }
  // Three shapes, and the model says which by what it holds. No end means still running. An
  // end equal to its start is a one-off — a talk, a certification — and printing it twice
  // would say a day lasted from itself to itself.
  function fmtPeriod(st, lang){
    if (!st || !st.start) return "";
    var dash = lang === "de" ? " – " : "–";
    if (!st.end) return fmtDate(st.start, lang) + dash + STR.now[lang];
    if (st.end === st.start) return fmtDate(st.start, lang);
    // A range between two dates, or from one date to now: English closes the en-dash,
    // German spaces it, and an open end is no exception — "now" stands where a date would.
    return fmtDate(st.start, lang) + dash + fmtDate(st.end, lang);
  }

  function h(tag, text, cls){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clear(el){ while (el.firstChild) el.removeChild(el.firstChild); }
  // A link out of the model. `url` on an entry and every URL in a References table point at
  // the web rather than at another node, so they are ordinary hrefs, in the same tab as
  // everything else here: nothing on these sites opens a new one. The scheme is dropped from
  // what is shown and kept in what is followed — a card column is narrow and `https://` is
  // eight characters of no information.
  var URL_RE = /^https?:\/\/\S+$/;
  function extLink(url){
    var a = h("a", url.replace(/^https?:\/\//, "").replace(/\/$/, ""), "ext");
    a.href = url;
    return a;
  }
  function resolve(data, text){ for (var i = 0; i < data.entities.length; i++) if (data.entities[i].name === text) return data.entities[i].id; return null; }
  // Markdown inline code — the one span-level mark the model's fixed shape uses — becomes
  // code.mono; a URL inside a sentence becomes a link. Appended as nodes, never as innerHTML:
  // these strings come out of the data block, and the day a name contains a "<" an innerHTML
  // assignment would start parsing it as markup.
  function inline(el, text){
    String(text).split(/`([^`]+)`/).forEach(function(part, i){
      if (!part) return;
      if (i % 2) { el.appendChild(h("code", part, "mono")); return; }
      part.split(/(https?:\/\/[^\s)\]]+)/).forEach(function(bit, j){
        if (!bit) return;
        el.appendChild(j % 2 ? extLink(bit.replace(/[.,;:]+$/, "")) : document.createTextNode(bit));
      });
    });
    return el;
  }
  function para(text, cls){ return inline(h("p", null, cls), text); }

  function render(e, bodyEl, footEl, opts){
    var data = opts.data, lang = opts.lang === "de" ? "de" : "en", link = opts.link;
    function ref(name){ var id = resolve(data, name); return id && link ? link(id) : document.createTextNode(name); }
    clear(bodyEl); clear(footEl);
    bodyEl.appendChild(h("div", e.type + " · " + e.id, "eyebrow"));
    bodyEl.appendChild(h("h3", e.name));
    if (e.tagline) bodyEl.appendChild(h("p", e.tagline, "tag"));
    if (opts.note) bodyEl.appendChild(h("p", opts.note, "empty"));
    var keys = Object.keys(e.fields);
    if (keys.length) {
      var dl = h("dl");
      keys.forEach(function(k){
        dl.appendChild(h("dt", k));
        var dd = h("dd"), v = e.fields[k];
        // A list is drawn as a list, one entry per line, each link with an edge a pointer
        // can find; comma-joined, three skills read as one run-on sentence.
        if (Array.isArray(v)) {
          var ul = h("ul", null, "items");
          v.forEach(function(name){ var li = h("li"); li.appendChild(ref(name)); ul.appendChild(li); });
          dd.appendChild(ul);
        }
        else if (URL_RE.test(v)) dd.appendChild(extLink(v));
        else dd.textContent = v;
        dl.appendChild(dd);
      });
      bodyEl.appendChild(dl);
    }
    // Every table the section holds, in the order the file wrote them; a caption is quoted
    // from the file and is mono, because it is data, not the page's prose.
    e.sections.forEach(function(s){
      bodyEl.appendChild(h("h4", s.heading));
      (s.tables || []).forEach(function(tab){
        if (tab.caption) bodyEl.appendChild(para(tab.caption, "caption mono"));
        var tbl = h("table"), thead = h("thead"), hr = h("tr");
        tab.columns.forEach(function(c){ hr.appendChild(h("th", c)); });
        thead.appendChild(hr); tbl.appendChild(thead);
        var tb = h("tbody");
        tab.rows.forEach(function(row){
          var tr = h("tr");
          row.forEach(function(cell){
            var td = h("td"), id = resolve(data, cell);
            if (id && link) td.appendChild(link(id));
            else if (URL_RE.test(cell)) td.appendChild(extLink(cell));
            else inline(td, cell);
            tr.appendChild(td);
          });
          tb.appendChild(tr);
        });
        tbl.appendChild(tb); bodyEl.appendChild(tbl);
      });
      // A block whose lines each open with "- " is a list in the file, and is drawn as one,
      // with the marker stripped and a hanging indent.
      if (s.text) s.text.split(/\n\n+/).forEach(function(par){
        if (/^-\s/.test(par)) {
          var ul = h("ul", null, "prose");
          par.split(/\n(?=-\s)/).forEach(function(item){
            ul.appendChild(inline(h("li"), item.replace(/^-\s+/, "").replace(/\n\s*/g, " ")));
          });
          bodyEl.appendChild(ul);
        } else bodyEl.appendChild(para(par.replace(/\n/g, " ")));
      });
    });
    // Mono, so it is data: the file and the commit it is pinned at, which is what the link
    // resolves to. The phrasing a reader needs is on the label, not in the row.
    var a = h("a", e.path.slice(e.path.lastIndexOf("/") + 1) + " @ " + data.commit.slice(0, 7));
    a.href = "https://github.com/" + (data.repo || "companygraph/meta-model") + "/blob/" + data.commit + "/" + e.path;
    a.setAttribute("aria-label", STR.view[lang]);
    footEl.appendChild(a);
  }

  window.rbCard = { render: render, fmtPeriod: fmtPeriod, fmtDate: fmtDate };
})();
```

The `"- "` list branch must keep the exact characters `if (/^-\s/.test(par))`,
`h("ul", null, "prose")` and `replace(/^-\s+/, "")`: `test/assets.test.mjs` finds the branch by
those strings.

- [ ] **Step 4: Take the moved code out of `assets/stage.js` and call `rbCard`**

In `assets/stage.js`:

1. In `STR` (line 39), delete the `view` and `now` entries; `out`, `in` and `pages` stay.
2. Delete `MONTHS` (lines 49–52), `fmtDate` (56–68) and `fmtPeriod` (76–83). Keep `lang()`
   and `t()`.
3. In `stampText` (line 100) replace `var when = fmtPeriod(st);` with
   `var when = rbCard.fmtPeriod(st, lang());`.
4. Delete `goLink`'s neighbours that moved: the `URL_RE` constant, `extLink`, `resolve`,
   `inline` and `para` (lines 587–624). Keep `h`, `clear` and `goLink`.
5. Replace the body of `renderInto` from `var e = n.entity;` to the end of the function
   (lines 647–724) with:

```js
    // An entity's card is the shared one; what the stage adds is the way back into the
    // drawing (a resolved reference focuses its node) and, on the root, the page count.
    rbCard.render(n.entity, bodyEl, footEl, {
      data: data, lang: lang(), link: goLink,
      note: n.kind === "root" ? pagesUnder(n) + " " + t("pages") : null
    });
```

6. Add to the file's opening comment, after the paragraph that says the script reads a
   `data-stage` block: "It calls `rbCard`, from `card.js`, for every entity card and every
   date; a page loads `card.js` before this file, or the first click throws."

- [ ] **Step 5: Ship the file and scan it**

In `lib/groups.mjs`, the `stage` group becomes:

```js
  stage: [
    ["assets/card.js",      "card.js"],
    ["assets/stage.css",    "stage.css"],
    ["assets/stage.js",     "stage.js"],
    ["assets/d3.v7.min.js", "d3.v7.min.js"],
  ],
```

In `test/spelling.test.mjs` line 15, `SCAN` gains `"assets/card.js"` after `"assets/stage.js"`.

- [ ] **Step 6: Run the tests**

Run: `npm test 2>&1 | grep -E "^not ok|# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 7: Check it in a browser, once**

From `~/git/robertblust/robertblust.github.io`, with this package linked
(`npm install ../design` writes it into `node_modules`): run `npm run design`, add
`<script src="../card.js"></script>` above `<script src="../stage.js"></script>` at the foot of
`model/index.html`, `npm run serve`, open `http://localhost:8000/model/`, click into
`profiles` → `robert-blust` → `experiences` → an entry, and read its card: eyebrow, name,
tagline, fields with skills as links, Achievements as a list, the foot link `… @ a535e43`.
Press DE and read the period line change to `Feb 2015 – Mär 2022`. Then `git checkout -- .`
there; the site takes the release by its own plan.

- [ ] **Step 8: Commit**

```bash
git add assets/card.js assets/stage.js lib/groups.mjs test/groups.test.mjs test/assets.test.mjs test/spelling.test.mjs
git commit -F - <<'EOF'
The entity card and the dates leave stage.js for card.js

A second page that shows an entity's card could only copy the renderer out of stage.js,
and the copy drifted in seven places within a day. The card and the date formatting are
one file now, card.js, synced whole with the stage and loaded before it; stage.js keeps
the drawing and the root and folder cards and calls rbCard for the rest. What the card
cannot read off the entity — the language, what a resolved reference becomes — it takes
from the caller.

Verified: npm test passes; the model page on blust.ch renders every card as before with
card.js loaded ahead of stage.js.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: The ledger's rules in `stage.css`

**Files:**
- Modify: `assets/stage.css` (append before the `#fig` figure tokens, after the `dialog.modal` rules)
- Modify: `test/assets.test.mjs`

**Interfaces:**
- Produces: the classes the timeline page's markup uses: `ol.ledger`, `li.k-<kind>` with
  `--lvl`, `details > summary` holding `.when`, `.mark`, `.what > .name + .meta`, `.body >
  .card`, and `li.now`; `.expand[aria-pressed="true"]`.
- Consumes: the `.card`, `.cbody`, `.cfoot` and `.expand` rules already in this file.

- [ ] **Step 1: Write the failing test**

Append to `test/assets.test.mjs`:

```js
test("stage.css carries the ledger and the pressed expand control", () => {
  const css = asset("assets/stage.css");
  for (const sel of [".ledger{", ".ledger summary{", ".ledger .mark::after{", ".ledger .body .card{", '.expand[aria-pressed="true"]{'])
    assert.ok(css.includes(sel), `stage.css lacks ${sel}`);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test 2>&1 | grep -E "^not ok"`
Expected: `not ok … stage.css carries the ledger`.

- [ ] **Step 3: Append the rules**

Insert into `assets/stage.css` directly before the comment `/* figure tokens.`:

```css
  /* The ledger: the timeline page's figure, every experience as a row on one vertical rule,
     each opening into the card above. It is here rather than on that page because the card
     it opens is this file's .card, and a row and its card have to agree on one stylesheet.
     The column widths are the page's own gutter and mark; --lvl on a row is its indent, one
     level when the entry began while a role ran, and the gutter stays flush because a
     ledger keeps its date column. */
  .ledger{--when:6.6rem; list-style:none; position:relative; margin-top:1rem; max-width:80ch}
  .ledger::before{content:""; position:absolute; top:.6rem; bottom:.6rem; left:calc(var(--when) + .6rem); width:2px; background:var(--rule)}
  .ledger li{position:relative}
  .ledger summary{list-style:none; cursor:pointer; display:grid; grid-template-columns:var(--when) 1.25rem minmax(0,1fr);
                  align-items:baseline; gap:0 .8rem; padding:.55rem 0}
  .ledger summary::-webkit-details-marker{display:none}
  .ledger summary:focus-visible{outline:2px solid var(--c-mid); outline-offset:3px; border-radius:3px}
  .ledger .when{font-family:"Plex Mono",monospace; font-size:.78rem; letter-spacing:.06em; color:var(--dim); font-variant-numeric:tabular-nums; white-space:nowrap}
  /* The mark is the square the drawing gives a page, on the rule: the larger one in --c-firm
     for a role or an independent period, the smaller in --c-mid for the rest; while the row
     is open it wears the ring the focused node wears. */
  .ledger .mark{position:relative; align-self:center; width:1.25rem; height:1rem}
  .ledger .mark::after{content:""; position:absolute; left:calc(50% - 5px); top:calc(50% - 5px); width:10px; height:10px; background:var(--c-mid)}
  .ledger .k-role .mark::after, .ledger .k-independent .mark::after{width:13px; height:13px; left:calc(50% - 6.5px); top:calc(50% - 6.5px); background:var(--c-firm)}
  .ledger details[open] > summary .mark::after{outline:2px solid var(--ink); outline-offset:1px}
  .ledger .what{padding-left:calc(var(--lvl, 0) * 1.5rem); min-width:0}
  .ledger .name{font-weight:600; color:var(--ink)}
  .ledger .k-role .name, .ledger .k-independent .name{font-family:"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif; font-weight:700; letter-spacing:-.015em; font-size:1.12rem}
  .ledger .meta{display:block; color:var(--dim); font-size:.88rem; margin-top:.1rem}
  .ledger summary:hover .name{color:var(--c-mid)}
  .ledger details[open] > summary .name{color:var(--c-firm)}
  /* The card opens under its row and takes the row's indent; the rule runs on past it. */
  .ledger .body{padding:.3rem 0 1.3rem calc(var(--when) + 1.25rem + 1.6rem + var(--lvl,0) * 1.5rem); max-width:calc(72ch + 12rem)}
  .ledger .body .card{height:auto}
  .ledger .body .cbody{overflow:visible}
  .ledger .now{margin-top:.6rem; padding-left:calc(var(--when) + 1.25rem + 1.6rem); font-family:"Plex Mono",monospace; font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; color:var(--dim)}
  @media (max-width:640px){
    .ledger{--when:4.2rem}
    .ledger .body{padding-left:0}
  }
  /* Open all is an .expand that stays pressed: the same control the stage puts beside its
     path line, with a state, because it reads Close all once every row is open. */
  .expand[aria-pressed="true"]{color:var(--c-firm); border-color:var(--c-mid); background:var(--press)}
```

- [ ] **Step 4: Run the tests**

Run: `npm test 2>&1 | grep -E "^not ok|# fail"`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add assets/stage.css test/assets.test.mjs
git commit -F - <<'EOF'
stage.css carries the ledger

The timeline page opens the stage's card under each of its rows, so a row and its card
have to agree on one stylesheet; the ledger's rules sit beside the card's rather than on
the page. The one addition outside the ledger is a pressed state for .expand, which the
page's Open all control needs and the stage's Expand never had.

Verified: npm test passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: Timeline after Model, in the header contract and the check

**Files:**
- Modify: `blocks/header.css:1` and `:12`
- Modify: `versions.json` (`"header": "v7"` → `"v8"`)
- Modify: `verify/pages.mjs:485`
- Modify: `test/verify-pages.test.mjs`

**Interfaces:**
- Produces: `ORDER = ["Ideas", "Principles", "Model", "Timeline", "Example", "Talks", "Billing", "Privacy"]` in `navOrder`; the `header contract · v8` fence.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test**

Append to `test/verify-pages.test.mjs`:

```js
test("navOrder's rule names Timeline after Model", () => {
  const src = pageChecks(OPTS).navOrder.toString();
  const m = /const ORDER = \[([^\]]+)\]/.exec(src);
  assert.ok(m, "navOrder has no ORDER list");
  const order = m[1].split(",").map(s => s.trim().replace(/"/g, ""));
  assert.equal(order.indexOf("Timeline"), order.indexOf("Model") + 1);
  assert.equal(order.indexOf("Example"), order.indexOf("Timeline") + 1);
});

test("the header contract's order comment agrees with navOrder", () => {
  const css = fs.readFileSync(path.join(PKG, "blocks/header.css"), "utf8");
  assert.match(css, /order\s+Ideas, Principles, Model, Timeline, Example, Talks, Billing, Privacy/);
  assert.match(css, /header contract · v8 · shared/);
});
```

If `fs`, `path` or `PKG` are not already imported at the top of that test file, add
`import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";`
and `const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));` the way
`test/assets.test.mjs` does.

- [ ] **Step 2: Run it to see it fail**

Run: `npm test 2>&1 | grep -E "^not ok"`
Expected: both new tests fail.

- [ ] **Step 3: Change the two words and the version**

In `blocks/header.css` line 1, `header contract · v7 · shared` → `header contract · v8 · shared`.
Line 12, `· order      Ideas, Principles, Model, Example, Talks, Billing, Privacy, then the` →
`· order      Ideas, Principles, Model, Timeline, Example, Talks, Billing, Privacy, then the`.
Re-wrap the following line if the column moved.

In `versions.json`, `"header": "v7"` → `"header": "v8"`.

In `verify/pages.mjs` line 485:

```js
      const ORDER = ["Ideas", "Principles", "Model", "Timeline", "Example", "Talks", "Billing", "Privacy"];
```

- [ ] **Step 4: Run the tests**

Run: `npm test 2>&1 | grep -E "^not ok|# fail"`
Expected: `# fail 0` — `test/fences.test.mjs` holds the version against `versions.json`.

- [ ] **Step 5: Commit**

```bash
git add blocks/header.css versions.json verify/pages.mjs test/verify-pages.test.mjs
git commit -F - <<'EOF'
The header contract names Timeline after Model

blust.ch gains a timeline page, the person's record read from the same model the model
page draws, and it sits beside that page: read right to left, each step left of the
switcher is more the site's own subject. The contract's order and the shared navOrder
check gain the word; a site that has no timeline skips it, as ever.

Verified: npm test passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 4: The README, the release

**Files:**
- Modify: `README.md` (the `stage` group paragraph near line 23; the warning at line 174)

- [ ] **Step 1: Say what a stage page loads**

In `README.md`, after the `design.config.json` example, add:

```markdown
A page that draws a stage loads three scripts in this order — `d3.v7.min.js`, `card.js`,
`stage.js` — and `card.js` before `stage.js` is not a preference: the stage calls `rbCard` on
the first click and throws without it. A page that only shows cards, blust.ch's timeline,
loads `card.js` alone.
```

Change the warning heading and its first sentence to cover both files:

```markdown
## A warning about `stage.js` and `card.js`

`stage.js` and `card.js` are the shared files no deck loads — a deck draws static SVG and has
to open from `file://` with no network. **Never link a deck to `stage.js`, `card.js` or
`stage.css`.** They are reached only by served prose pages, through a plain `<link>` and
`<script src>`.
```

- [ ] **Step 2: Run the prose and spelling checks**

Run: `npm test 2>&1 | grep -E "^not ok|# fail"; sh conventions/conventions-check`
Expected: `# fail 0` and `✓ every Markdown file follows WRITING.md`.

- [ ] **Step 3: Commit and open the pull request**

```bash
git add README.md
git commit -F - <<'EOF'
The README says a stage page loads card.js before stage.js

Verified: npm test and conventions-check pass.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
git push -u origin card-and-timeline-nav
gh pr create --base main --title "The card leaves the stage, and the nav gains Timeline" --body-file - <<'EOF'
The entity card and the date formatting move out of stage.js into card.js, a whole-file asset in the stage group loaded before the stage; a second page that shows an entity's card no longer copies the renderer, which is how the timeline prototype drifted in seven places within a day. stage.css gains the ledger's rules for that page. The header contract and the shared navOrder check name Timeline after Model.

Breaking for a page that draws a stage: after `npm run design` it adds `<script src="../card.js">` above `<script src="../stage.js">`, or the first click throws. That is two pages on blust.ch and companygraph.io each; guestgraph.io takes only the header order.

Spec: robertblust/robertblust.github.io, docs/superpowers/specs/2026-09-05-timeline-page-design.md, §5 and §6.

Verified: npm test and conventions-check pass; the model page on blust.ch renders every card with card.js loaded ahead of stage.js.
EOF
```

Stop here. Merging is Rob's word.

- [ ] **Step 4: After the merge, tag and release v0.30.0**

```bash
git checkout main && git pull
git tag v0.30.0 && git push origin v0.30.0
gh release create v0.30.0 --title "v0.30.0" --notes-file - <<'EOF'
The entity card and the dates leave `stage.js` for `card.js`, a whole-file asset the `stage` group ships beside it and every stage page loads first. The header contract is v8 and names Timeline after Model; the shared `navOrder` check agrees. `stage.css` carries the ledger, the figure of blust.ch's new timeline page.

**Breaking** for a page that draws a stage. Taking it: `npm run design`; then on every page that loads `stage.js`, add `<script src="../card.js"></script>` directly above it; then `npm run og`, because the model page's recipe now names one more file; then `npm run verify`. A site with no stage takes it with `npm run design` and the suite. The nav order changes nothing on a site without a Timeline item.
EOF
```

---

### Task 5: companygraph.io and guestgraph.io take the release

**Files:**
- `~/git/companygraph/companygraph.github.io`: `package.json:24`, `model/index.html:854`, `example/index.html:852`, every page's header fence, `og.png`/`og.sha` where the recipe moved
- `~/git/guestgraph/guestgraph.github.io`: `package.json`, every page's header fence, cards where the recipe moved

Each is one pull request, opened and not merged. blust.ch takes the release by its own plan.

- [ ] **Step 1: companygraph.io**

```bash
cd ~/git/companygraph/companygraph.github.io && git checkout main && git pull && git checkout -b design-0-30-0
sed -i '' 's|design#v0.29.0|design#v0.30.0|' package.json
npm install @robertblust/design@github:robertblust/design#v0.30.0 && npm run design
```

In `model/index.html` and `example/index.html`, directly above the line
`<script src="../stage.js"></script>`, insert `<script src="../card.js"></script>`.

```bash
npm run og && npm run verify; echo "exit $?"
```

Expected: `exit 0`. Then:

```bash
git add -A && git commit -F - <<'EOF'
Design 0.30.0: the card loads ahead of the stage

The entity card lives in card.js now, synced with the stage and loaded before it; the
model and example pages gain that one script line, and their share cards re-render
because the recipe names one more file. The header contract moves to v8.

Verified: npm run verify passes; npm run og:check passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
git push -u origin design-0-30-0
gh pr create --base main --title "Design 0.30.0: the card loads ahead of the stage" --body "The entity card lives in card.js now, synced with the stage and loaded before it; the model and example pages gain that one script line, and their share cards re-render because the recipe names one more file. The header contract moves to v8. Release notes: https://github.com/robertblust/design/releases/tag/v0.30.0. Verified: npm run verify and npm run og:check pass."
```

- [ ] **Step 2: guestgraph.io**

The same, without the script line: the site takes no `stage` group.

```bash
cd ~/git/guestgraph/guestgraph.github.io && git checkout main && git pull && git checkout -b design-0-30-0
sed -i '' 's|design#v0.29.0|design#v0.30.0|' package.json
npm install @robertblust/design@github:robertblust/design#v0.30.0 && npm run design
npm run og && npm run verify; echo "exit $?"
git add -A && git commit -F - <<'EOF'
Design 0.30.0: the header contract is v8

The contract names Timeline after Model for the site that has one; this one has none and
skips it, so the change here is the fence's version and the cards its bytes are part of.

Verified: npm run verify passes; npm run og:check passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
git push -u origin design-0-30-0
gh pr create --base main --title "Design 0.30.0: the header contract is v8" --body "The contract names Timeline after Model for the site that has one; this one has none and skips it, so the change here is the fence's version and the cards its bytes are part of. Release notes: https://github.com/robertblust/design/releases/tag/v0.30.0. Verified: npm run verify and npm run og:check pass."
```

Report both pull request URLs and the check status of each, and stop.
