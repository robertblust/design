# The model pages are shared — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move blust.ch's Principles, Team and Surfaces renderers and page code into `@robertblust/design`, teach Team to draw a second instance, and prove the move by blust.ch rendering unchanged.

**Architecture:** The renderers become package exports under `lib/render/`, taking the artifact and the site root as arguments. The page code that is not already a fence becomes new fences under `blocks/`, registered in `lib/fences.mjs` and `versions.json`, which a page opts into by carrying the markers. Team gains a board per process and a seat no profile holds, both behind a one-process path that emits exactly today's markup.

**Tech Stack:** Node 22 ES modules, built-ins only; `node --test`; the package's existing `design sync` and fence machinery; blust.ch's `pages:check` and page suite as the acceptance test.

**Spec:** [`docs/superpowers/specs/2026-09-21-the-model-pages-are-shared-design.md`](../specs/2026-09-21-the-model-pages-are-shared-design.md)

## Global constraints

- Package version after this work: **0.68.0** (minor). The tag is the owner's to cut; no task tags or releases.
- A renderer's signature stays `(data, { check, root })` and returns the list of files it would change. **`root` becomes required**: inside the package, a default resolved from `import.meta.url` would point at the package, not the site.
- **With one process in the model, Team's output is byte-identical to what blust.ch's `build/team.mjs` renders today.** Every new behavior sits behind the one-process path.
- A seat named by no profile is drawn as `human`, with no name beside it.
- Boards stack in the order the artifact lists the processes. No ordering field is added.
- Where a seat links is declared by the page as `STAGE_PAGE`, a string ending in `/`, above the card-glue fence. No shared code carries a site's URL.
- Every new fence types its version into its own first line and has an entry in `versions.json`; `test/fences.test.mjs` binds the two.
- Shipped files are American English; `test/spelling.test.mjs` holds them.
- A Markdown paragraph is one line.
- Work in a sibling worktree named `<repository>-<branch>`; the clone stays on `main`. The design work continues on `the-model-pages-are-shared`, already checked out at `~/git/robertblust/design-the-model-pages-are-shared`.
- Commits and pull request bodies are in the git register, ending `Verified:` then the trailers.
- **Merging and tagging are the owner's.** Every task ends at a commit; the pull request is opened once, after Task 5.
- `export PATH=/opt/homebrew/bin:$PATH` before any command: `node`, `npm` and `gh` live there.

---

### Task 1: The three renderers are package exports, unchanged in behavior

**Files:**

- Create: `lib/render/note.mjs`, `lib/render/principles.mjs`, `lib/render/team.mjs`, `lib/render/surfaces.mjs`
- Create: `test/render.test.mjs`
- Modify: `package.json` (`exports`)

**Interfaces:**

- Consumes: blust.ch `build/note.mjs`, `build/principles.mjs`, `build/team.mjs`, `build/surfaces.mjs` at `b97bd1d`, and the tests for them in `build/renderers.test.mjs`
- Produces: `writePrinciples(data, { check, root })`, `writeTeam(data, { check, root })`, `writeSurfaces(data, { check, root })`, each returning `string[]`; `NOTE_EN`, `NOTE_DE` from `render/note`; and Team's helpers `phasesOf`, `seatsOf`, `marksOf` with their current signatures

This task moves code and changes nothing it does, apart from `root` becoming required. Tasks 2 and 3 change Team's behavior, and a reviewer should be able to tell the move from the change.

- [ ] **Step 1: Copy the four files in**

```bash
export PATH=/opt/homebrew/bin:$PATH
cd ~/git/robertblust/design-the-model-pages-are-shared
mkdir -p lib/render
git -C ~/git/robertblust/robertblust.github.io show b97bd1d:build/note.mjs       > lib/render/note.mjs
git -C ~/git/robertblust/robertblust.github.io show b97bd1d:build/principles.mjs > lib/render/principles.mjs
git -C ~/git/robertblust/robertblust.github.io show b97bd1d:build/team.mjs       > lib/render/team.mjs
git -C ~/git/robertblust/robertblust.github.io show b97bd1d:build/surfaces.mjs   > lib/render/surfaces.mjs
```

Taken from the commit rather than the working tree, so what moves is what the spec measured.

- [ ] **Step 2: Make `root` required in all three writers**

In each of `lib/render/principles.mjs`, `lib/render/team.mjs` and `lib/render/surfaces.mjs`, delete the `HERE` constant and its now-unused `fileURLToPath` import, and change the writer's options so `root` has no default:

```js
export function writeTeam(data, { check = false, root } = {}) {
  if (!root) throw new Error("writeTeam needs the site's root: the page it writes is the site's, not this package's");
```

Use the writer's own name in each message — `writePrinciples`, `writeSurfaces`. Keep every other line of each file as it is.

- [ ] **Step 3: Point the imports at the package's own copy**

In `lib/render/principles.mjs`, `lib/render/team.mjs` and `lib/render/surfaces.mjs`, the import of the note stays relative, which is now correct:

```js
import { NOTE_EN, NOTE_DE } from "./note.mjs";
```

In `lib/render/surfaces.mjs`, the error that names `model.json` names the artifact instead:

```js
if (!name) throw new Error(`the artifact names no repository to draw as the model: ${data.repo}`);
```

- [ ] **Step 4: Export them**

In `package.json`, add to `exports`, keeping the existing entries and their order:

```json
"./render/note": "./lib/render/note.mjs",
"./render/principles": "./lib/render/principles.mjs",
"./render/team": "./lib/render/team.mjs",
"./render/surfaces": "./lib/render/surfaces.mjs",
```

- [ ] **Step 5: Move the tests that cover them**

Create `test/render.test.mjs` from the Team and Principles tests in blust.ch's `build/renderers.test.mjs` at `b97bd1d` — every test whose import line names `./principles.mjs` or `./team.mjs`, with its fixtures. Change each import to the package path:

```js
import { writePrinciples, paragraphs } from "../lib/render/principles.mjs";
import { writeTeam, marksOf, phasesOf, seatsOf } from "../lib/render/team.mjs";
```

Every call to a writer passes `root`, since it no longer has a default. The `jsonld` tests stay in blust.ch: that renderer is not moving.

- [ ] **Step 6: Add the test the move depends on**

```js
test("a writer refuses to run without the site's root", () => {
  const data = { entities: [], commit: "0".repeat(40), repo: "x/y" };
  assert.throws(() => writeTeam(data, {}), /needs the site's root/);
  assert.throws(() => writePrinciples(data, {}), /needs the site's root/);
});
```

- [ ] **Step 7: Run the suite**

Run: `npm test`

Expected: PASS, including every test that moved. A moved test that fails here is a move that changed behavior; stop and find out why rather than editing the test.

- [ ] **Step 8: Commit**

The subject says the renderers are the package's now. The body says the only change is that `root` is required, and why. `Verified:` names `npm test`.

---

### Task 2: Team draws one board per process

**Files:**

- Modify: `lib/render/team.mjs`
- Test: `test/render.test.mjs`

**Interfaces:**

- Consumes: Task 1's `lib/render/team.mjs`
- Produces: `processesOf(data) → process[]`, `phasesOf(data, proc) → phase[]`, `marksOf(data, proc) → { [roleName]: string[][] }`; `writeTeam` unchanged in signature

- [ ] **Step 1: Write the failing tests**

Task 1 moved `TEAM_FIXTURE` and `renderTeamInto(fixture)` into `test/render.test.mjs`. `TEAM_FIXTURE` holds one process, `Doing`, with two phases, and every seat is held by a profile. Add a second process beside it, and a helper that returns the generated region:

```js
// A second process beside TEAM_FIXTURE's "Doing": one phase, naming Boss, whom Doing names too,
// and Helper, whom Doing does not and no profile holds. So a seat on two boards and a seat no
// profile holds both occur.
const TWO_PROCESS_FIXTURE = {
  ...TEAM_FIXTURE,
  entities: [
    ...TEAM_FIXTURE.entities,
    { id: "roles/helper", type: "role", name: "Helper", tagline: "Helps.",
      path: "model/roles/helper.md", fields: {}, sections: [] },
    { id: "processes/e", type: "process", name: "Else", tagline: "Another way.",
      path: "model/processes/e/e.md", fields: { owner: "Boss" },
      sections: [{ heading: "Phases", text: "", tables: [{ caption: null, columns: ["Phase"], rows: [["Three"]] }] }] },
    { id: "processes/e/phases/three", type: "phase", name: "Three", tagline: "Third.",
      path: "model/processes/e/phases/three.md", owner: "processes/e",
      fields: { owner: "Boss", "executed-by": ["Helper"], "gate-approvers": ["Boss"] }, sections: [] },
  ],
};
const regionOf = (page) => page.slice(page.indexOf("<!-- team:start -->"), page.indexOf("<!-- team:end -->"));
```

Before changing any code, capture what one process renders today — at Task 1's commit, so the constant is the old renderer's output and not anyone's guess. Export `TEAM_FIXTURE`, `renderTeamInto` and `regionOf` from `test/render.test.mjs`, then run:

```bash
node --input-type=module -e '
  const t = await import("./test/render.test.mjs");
  console.log(JSON.stringify(t.regionOf(t.renderTeamInto(t.TEAM_FIXTURE))));
' > /tmp/before-one-process.json
```

Paste the printed string into `test/render.test.mjs` as `const BEFORE_ONE_PROCESS = <the JSON string>;`. It is a JSON string literal, so every quote and newline is already escaped correctly for JavaScript. That constant is the spec's claim, written down.

```js
test("a model with two processes draws two boards, in the order the artifact lists them", () => {
  const html = regionOf(renderTeamInto(TWO_PROCESS_FIXTURE));
  const boards = [...html.matchAll(/<div class="grid" id="([a-z-]*)board">/g)].map((m) => m[1]);
  assert.deepEqual(boards, ["doing-", "else-"]);
});

test("each board carries only the phases of its own process", () => {
  const html = regionOf(renderTeamInto(TWO_PROCESS_FIXTURE));
  const elseBoard = html.slice(html.indexOf('id="else"'));
  assert.match(elseBoard, /Three/);
  assert.doesNotMatch(elseBoard, /<span class="phname">One<\/span>/);
});

test("no two elements share an id when a seat sits on two boards", () => {
  const html = regionOf(renderTeamInto(TWO_PROCESS_FIXTURE));
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids}`);
});

test("a model with one process draws exactly the board it drew before this change", () => {
  assert.equal(regionOf(renderTeamInto(TEAM_FIXTURE)), BEFORE_ONE_PROCESS);
});
```

The tests Task 1 moved call `phasesOf(data)` and `marksOf(data)`. Both now take the process as well. Change each call to pass `processesOf(data)[0]`, and import `processesOf`.

- [ ] **Step 2: Run them and watch the first three fail**

Run: `npm test`

Expected: the two-process tests FAIL, with `the model holds 2 processes; the board draws one`. The one-process test PASSES, since nothing has changed yet.

- [ ] **Step 3: Replace `processOf` with `processesOf`, and pass the process in**

```js
// The processes the page draws, in the order the artifact lists them. No process carries a rank,
// so that order is the parser's; a site cannot choose another without a field core does not
// declare.
export function processesOf(data) {
  const all = data.entities.filter((e) => e.type === "process");
  if (!all.length) throw new Error("the model holds no process; the board would be empty");
  return all;
}
```

`phasesOf(data)` becomes `phasesOf(data, proc)`, reading `proc` where it called `processOf(data)`. `marksOf(data)` becomes `marksOf(data, proc)`, calling `phasesOf(data, proc)`. Their bodies are otherwise unchanged.

- [ ] **Step 4: Render a board per process, with the one-process path left as it is**

Rename today's `render(data)` to `renderBoard(data, proc, prefix)`. Inside it, read phases and marks for `proc`, and prefix every id it writes — `board`, `openall` and each seat's slug — with `prefix`:

```js
out.push(`      </div><button class="openall" id="${prefix}openall" type="button" data-de="Alle öffnen">Open all</button></div>`);
out.push(`      <div class="grid" id="${prefix}board">`);
out.push(`        <details${cls} id="${prefix}${slug(role.name)}" data-role="${esc(role.id)}">`);
```

Then:

```js
function render(data) {
  const procs = processesOf(data);
  // One process draws exactly the board this renderer drew before a second process was
  // possible, ids and all, so a site with one process sees nothing change.
  if (procs.length === 1) return renderBoard(data, procs[0], "");
  // Several draw a board each under the process's own name. The ids take the process's slug,
  // because a seat that sits in two processes is two rows and one page cannot hold two elements
  // with one id.
  return procs.map((p) => [
    `      <section class="proc" id="${slug(p.name)}">`,
    `        <h3 class="procname">${esc(p.name)}</h3>`,
    p.tagline ? `        <p class="proctag">${esc(p.tagline)}</p>` : null,
    renderBoard(data, p, `${slug(p.name)}-`),
    `      </section>`,
  ].filter((l) => l !== null).join("\n")).join("\n");
}
```

The process's name and tagline are the model's own words, so they stay English under the note, as the phase taglines already do.

- [ ] **Step 5: Run the suite**

Run: `npm test`

Expected: PASS. If the one-process test fails, compare the two strings character by character. A difference there is a change blust.ch would render, and the one-process path is not allowed one.

- [ ] **Step 6: Commit**

---

### Task 3: Team draws a seat no profile holds as held by a person

**Files:**

- Modify: `lib/render/team.mjs`
- Test: `test/render.test.mjs`

**Interfaces:**

- Consumes: Task 2's `processesOf`, `phasesOf(data, proc)`, `marksOf(data, proc)`
- Produces: `seatsOf(data, proc) → { role, holder }[]`, where `holder` is a profile entity or `null` for a seat no profile holds

- [ ] **Step 1: Write the failing tests**

`TWO_PROCESS_FIXTURE` from Task 2 already names `Helper`, whom no profile holds, on the `Else` board.

```js
test("a seat the process names and no profile holds is drawn as human, with no name", () => {
  const html = regionOf(renderTeamInto(TWO_PROCESS_FIXTURE));
  const at = html.indexOf('id="else-helper"');
  assert.ok(at > 0, "the seat no profile holds is on its board");
  const row = html.slice(html.lastIndexOf("<details", at), html.indexOf("</details>", at));
  assert.match(row, /<details class="human"/);
  assert.match(row, /aria-label="Helper, human\./);
});

test("a board shows only the seats its own process names", () => {
  const html = regionOf(renderTeamInto(TWO_PROCESS_FIXTURE));
  const elseBoard = html.slice(html.indexOf('id="else"'));
  assert.doesNotMatch(elseBoard, /id="else-maker"/);
  assert.match(elseBoard, /id="else-helper"/);
});

test("a person's seats come first, then the seats no profile holds, then an agent's", () => {
  const html = regionOf(renderTeamInto(TWO_PROCESS_FIXTURE));
  const elseBoard = html.slice(html.indexOf('id="else"'));
  const order = [...elseBoard.matchAll(/<details[^>]* id="else-([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ["boss", "helper"]);
});

test("the board no longer needs a profile to hold a seat", () => {
  const noProfiles = { ...TEAM_FIXTURE, entities: TEAM_FIXTURE.entities.filter((e) => e.type !== "profile") };
  assert.doesNotThrow(() => renderTeamInto(noProfiles));
});
```

Task 2's one-process test must still pass. `TEAM_FIXTURE` holds every seat by a profile, so nothing it renders changes.

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test`

Expected: FAIL. The unheld seat is missing, or the renderer throws `no profile in the model holds a role`.

- [ ] **Step 3: Rewrite `seatsOf` for a process, keeping today's order where every seat is held**

```js
// The seats a process names — its own owner and supported-by, and every phase's owner,
// executed-by, supported-by, gate-approvers and escalation-authority.
function rolesNamedBy(data, proc) {
  const names = new Set();
  const add = (v) => [].concat(v || []).forEach((n) => names.add(n));
  add(proc.fields.owner); add(proc.fields["supported-by"]);
  for (const ph of phasesOf(data, proc)) {
    const f = ph.fields || {};
    add(f.owner); add(f["executed-by"]); add(f["supported-by"]);
    add(f["gate-approvers"]); add(f["escalation-authority"]);
  }
  return names;
}

// The rows of one board, in the order the page argues: a person's seats first, then the seats no
// profile holds — which a model says are held by a person — then an agent's. Within a profile the
// order is the profile's own. A seat no profile holds is drawn with no name beside it, because
// which person holds it is a fact the model does not carry.
export function seatsOf(data, proc) {
  const named = rolesNamedBy(data, proc);
  const roleOf = (name) => data.entities.find((e) => e.type === "role" && e.name === name);
  const profiles = data.entities.filter((e) => e.type === "profile");
  const human = profiles.filter((p) => p.fields.nature === "human");
  const agent = profiles.filter((p) => p.fields.nature !== "human");
  const seats = [], placed = new Set();
  const take = (p) => {
    for (const name of p.fields.roles || []) {
      if (!named.has(name) || placed.has(name)) continue;
      const role = roleOf(name);
      if (!role) throw new Error(`${p.path} holds a role the model does not hold: ${name}`);
      seats.push({ role, holder: p }); placed.add(name);
    }
  };
  human.forEach(take);
  const held = new Set(profiles.flatMap((p) => p.fields.roles || []));
  for (const role of data.entities.filter((e) => e.type === "role")) {
    if (named.has(role.name) && !held.has(role.name)) { seats.push({ role, holder: null }); placed.add(role.name); }
  }
  agent.forEach(take);
  if (!seats.length) throw new Error(`${proc.path} names no seat the model holds; its board would be empty`);
  return seats;
}
```

`marksOf(data, proc)` builds its keys from `seatsOf(data, proc)` now, and not from the whole model's profiles.

- [ ] **Step 4: Draw a seat with no holder**

In `renderBoard`, every place that reads `profile` reads `holder`, and a missing holder reads as human:

```js
const natureOf = (h) => (h ? h.fields.nature : "human");
const markFor = (h) => (natureOf(h) === "human" ? MARK_HUMAN : MARK_AGENT);
```

`rowLabel` names `natureOf(holder)` instead of `profile.fields.nature`. The row's class is `human` when `natureOf(holder) === "human"`. The head rail lists each profile that holds a seat on the board as it does today. When any seat has no holder, it adds one more entry after the human profiles, with the human mark and no name:

```js
out.push(`        <div class="hw">${MARK_HUMAN}<div><div class="lbl">human · holds ${unheld} of ${seats.length}</div></div></div>`);
```

- [ ] **Step 5: Run the suite**

Run: `npm test`

Expected: PASS, and Task 2's one-process test still PASSES. Its fixture holds every seat by a profile, so nothing about it changed.

- [ ] **Step 6: Commit**

---

### Task 4: The page code becomes fences

**Files:**

- Create: `blocks/principles.css`, `blocks/team.css`, `blocks/surfaces.css`, `blocks/surfaces.js`, `blocks/model-card.js`
- Modify: `lib/fences.mjs`, `versions.json`
- Test: `test/fences.test.mjs` (existing — it must pass with the new fences in it)

**Interfaces:**

- Consumes: blust.ch's `team/index.html`, `surfaces/index.html` and `principles/index.html` at `b97bd1d`
- Produces: fences named `principles`, `team`, `surfaces`, `surfaces lineage` and `model card`; and the page contract that a page declares `STAGE_PAGE` above `model card`

- [ ] **Step 1: Find the code that moves, and nothing else**

Each page carries two scripts outside the fences. The first is the page's own init — language, theme, menu, and a `UI` object with the page's title and description. **It does not move**: it is on every prose page, and its title and description are the site's own words. The second, on Team and Surfaces, begins with the comment `// The seats are in the markup; the cards are not.` or its Surfaces equivalent, and wraps `rbCard.data(...)`. That is the card glue, and it moves.

Of each page's `<style>`, the rules that move are the ones whose selectors name what the renderer writes: `.hdrail`, `.whos`, `.hw`, `.openall`, `.grid`, `.ghead`, `.phnum`, `.phname`, `.sname`, `.tw`, `.g`, `.drawer`, `.legend`, `.phases` and `.mk` on Team; `.lineage`, `.ln-groups`, `.ln-maker`, `.ln-model`, `.ln-s`, `.ln-surfaces`, `.wires`, `.who`, `.host`, `.how`, `.at` and `.mk.build`, `.mk.hand` on Surfaces; and `.value`, `.lede` and `.derived` on Principles. Principles also writes `.title`, `.tagline` and `.rcl`, but those belong to the existing `title contract` fence and do not move. `.note`, `.nm`, `.lbl` and `.mono` are shared across pages; leave them where they are rather than copying them into a page's fence. A rule for the title block, the header or the footer is page shell, and stays.

List the selectors you are moving in the task report, one line each, so the review can check the division.

- [ ] **Step 2: Write each block**

Each block's first line is its marker, in the form the existing blocks use, with the version it ships at:

```css
/* ─── team · v1 · shared ───────────────────────────────────────────────── */
```

End each block with its end marker, `/* ─── end team ─── */` in the form the existing blocks use. The CSS inside is the rules Step 1 identified, in their page order, unchanged.

`blocks/model-card.js` is the card glue, generalized in exactly three places and no others:

```js
// Where a seat links: the page that draws this model on the stage. A site declares it, because
// on one site that is /model/ and on another the landing page, and a shared file carrying either
// would send the other site's visitors to the wrong page.
a.href = STAGE_PAGE + "?stage=expanded#" + id;
```

```js
var rows = [].slice.call(document.querySelectorAll(".grid details"));
```

and the Open-all button, wired per board rather than once:

```js
[].slice.call(document.querySelectorAll(".openall")).forEach(function (all) {
  var board = all.closest(".hdrail").nextElementSibling;
  var mine = [].slice.call(board.querySelectorAll("details"));
  all.addEventListener("click", function(){
    var shut = mine.some(function (d) { return !d.open; });
    mine.forEach(function (d) { d.open = shut; if (shut) ensure(d); });
    all.textContent = label(shut);
    all.setAttribute("data-de", shut ? "Alle schliessen" : "Alle öffnen");
  });
});
```

The `rbCard.data(name, …)` call reads its name from the page as `MODEL_CARD`, which is `"team"` on Team and `"surfaces"` on Surfaces, so one block serves both.

- [ ] **Step 3: Register them**

In `lib/fences.mjs`, add an entry for each, in the style of `stage contract`, with a comment above each saying what it holds and why it is a fence:

```js
"team": { key: "team", source: "blocks/team.css", version: versions.team, variants: null, closes: null },
"surfaces": { key: "surfaces", source: "blocks/surfaces.css", version: versions.surfaces, variants: null, closes: null },
"surfaces lineage": { key: "lineage", source: "blocks/surfaces.js", version: versions.lineage, variants: null, closes: null },
"principles": { key: "principles", source: "blocks/principles.css", version: versions.principles, variants: null, closes: null },
"model card": { key: "modelCard", source: "blocks/model-card.js", version: versions.modelCard, variants: null, closes: null },
```

In `versions.json`, add `"team": "v1"`, `"surfaces": "v1"`, `"lineage": "v1"`, `"principles": "v1"`, `"modelCard": "v1"`.

- [ ] **Step 4: Run the suite**

Run: `npm test`

Expected: PASS, including `test/fences.test.mjs`'s "every fence emits the version versions.json declares, for every fence", and `test/spelling.test.mjs` over the new blocks.

- [ ] **Step 5: Commit**

---

### Task 5: The README says what ships, and the release notes are drafted

**Files:**

- Modify: `README.md`, `package.json` (`version`)
- No notes file: a release here is a tag and a GitHub Release, and its notes go in the Release

**Interfaces:**

- Consumes: Tasks 1–4
- Produces: the pull request, and notes for the owner to release from

- [ ] **Step 1: Read `README.md`'s *Releasing* section and follow it**

It is the manual; this plan does not repeat it. The one file that moves is `package.json`'s `version`, to `0.68.0`, because `design sync --check` in every site compares the tag its pin names with the installed package's version and goes red when they differ.

- [ ] **Step 2: Add the renderers and fences to the README's account of what ships**

Name the four exports and the five fences where the README lists the others, each with one line saying what it is for. Say that a page opts into a fence by carrying its markers, and that the card glue needs `STAGE_PAGE` and `MODEL_CARD` declared above it.

- [ ] **Step 3: Draft the release notes, in the pull request body**

In the prose register, for a consumer: what is added; that nothing reaches a site until one of its pages carries the markers; and what blust.ch does to adopt it, which is Task 6, including moving the two CI steps that run `test:build` and `pages:check` below `npm ci`, since once `pages.mjs` imports the renderers from the package they need it installed. The owner copies them into the GitHub Release when tagging.

It is a **minor**, and the notes say why, because the README's rule reads the other way at first glance: *"A change needing a site edit beyond `npm run design` is a major."* Adopting these pages takes site edits, but **no site needs to adopt them.** A site that re-pins and runs `npm run design` receives nothing new and nothing breaks, so the release needs no site edit, and adoption is a separate change each site chooses. The CI move is one of those adoption edits: a site that keeps its own renderers keeps its CI as it is.

- [ ] **Step 4: Verify everything and open the pull request**

```bash
npm test; echo "test: $?"
sh conventions/conventions-format; echo "format: $?"
sh conventions/conventions-check; echo "check: $?"
```

All three must exit 0. Open the pull request, with the spec's pull request linked as its sibling. **Do not merge and do not tag.** The owner merges, cuts v0.68.0, and only then can Task 6 begin.

---

### Task 6: blust.ch takes the release and renders unchanged

**Files:**

- Modify, in `robertblust/robertblust.github.io`: `package.json`, `.github/workflows/ci.yml`, `build/pages.mjs`, `build/renderers.test.mjs`, `team/index.html`, `surfaces/index.html`, `principles/index.html`
- Delete: `build/principles.mjs`, `build/team.mjs`, `build/surfaces.mjs`, `build/note.mjs`

**Interfaces:**

- Consumes: `@robertblust/design` at v0.68.0, tagged by the owner
- Produces: the proof the spec names in §6

**This task cannot start until v0.68.0 exists.** Check with `git -C ~/git/robertblust/design tag -l v0.68.0`, and stop if it prints nothing.

- [ ] **Step 1: Branch, in a sibling worktree**

```bash
export PATH=/opt/homebrew/bin:$PATH
cd ~/git/robertblust/robertblust.github.io && git fetch origin --quiet
git worktree add -b the-model-pages-come-from-design \
  ~/git/robertblust/robertblust.github.io-the-model-pages-come-from-design origin/main
cd ~/git/robertblust/robertblust.github.io-the-model-pages-come-from-design && npm ci
```

- [ ] **Step 2: Record the proof's baseline before touching anything**

```bash
npm run pages:check; echo "baseline pages:check: $?"
npm run verify >/dev/null 2>&1; echo "baseline verify: $?"
```

Both must be 0. If either is not, the site is not in a state this task can prove anything against; stop and report it.

- [ ] **Step 3: Take the release**

Set `@robertblust/design` to `github:robertblust/design#v0.68.0` in `package.json`, then install the package by name so the lockfile moves with it. A stale lockfile has pinned the old release silently before:

```bash
npm install @robertblust/design@github:robertblust/design#v0.68.0
node -e "console.log(require('@robertblust/design/package.json').version)"
```

Expected: `0.68.0`.

- [ ] **Step 4: Import the renderers from the package, and delete the local copies**

In `build/pages.mjs`:

```js
import { writePrinciples } from "@robertblust/design/render/principles";
import { writeTeam } from "@robertblust/design/render/team";
import { writeSurfaces } from "@robertblust/design/render/surfaces";
```

and pass the root, which the writers now require:

```js
const stale = RENDERERS.flatMap((write) => write(data, { check, root: ROOT }));
```

`writeJsonLd` accepts and ignores `root`; confirm that by reading it, and if it does not, pass it only to the three.

```bash
git rm build/principles.mjs build/team.mjs build/surfaces.mjs build/note.mjs
```

Remove the Team and Principles tests from `build/renderers.test.mjs`. They live in the package now. Remove also the test "the note that says why a region does not translate has one home": it moved into the package with them, and it reads `build/note.mjs` and the three renderers by path, so left here it fails with ENOENT once they are deleted. Keep the `jsonld` tests. Keep the Surfaces tests too, which did not move, and change their import from `./surfaces.mjs` to `@robertblust/design/render/surfaces`, since the file they imported is deleted above.

- [ ] **Step 4a: Run the renderer tests and the page check after `npm ci` in CI**

In `.github/workflows/ci.yml`, move the two steps "The renderers still say what the model says" (`npm run test:build`) and "The derived pages still match the model" (`npm run pages:check`) from above `- run: npm ci` to below it, and rewrite their comments to match. Both sit above it today on the ground that `pages.mjs`, its renderers and their tests import nothing outside `node:`. After Step 4 that is no longer true: `pages.mjs` and the Surfaces tests import `@robertblust/design/render/*`, which exists only once `npm ci` has installed the package, so left where they are both fail every push with ERR_MODULE_NOT_FOUND. The same move was made once already in that file, for the card harness, and its comment says so. Leave "The duplication sweep still knows what the package owns" (`npm run test:dupes`) where it is; nothing in this task changes what it imports.

- [ ] **Step 5: The generated regions are byte-identical — the spec's first proof**

Run this before rebuilding anything:

```bash
npm run pages:check; echo "pages:check: $?"
```

Expected: `0`, meaning every region the shared renderers would write is byte for byte what is committed. If it is not 0, the move changed behavior. Do not run `npm run pages` to make it pass; find which region differs and why.

- [ ] **Step 6: Put the markers round the page code, and declare what the card glue needs**

On each of the three pages, wrap the code Task 4 moved in its fence's markers, in place, so `design sync` writes it. Team carries `team` and `model card`; Surfaces carries `surfaces` and `surfaces lineage`, and never `model card`, because its card glue is inside `surfaces lineage` beside the drawing it shares state with; Principles carries `principles`.

Each behavior fence reads what it needs from values the page declares, and its block header says where: above the fence, in the same script. So on Team, in the `<script>` that holds the `model card` fence and above its opening marker:

```js
var STAGE_PAGE = "../model/";   // the page that draws this model on the stage
var MODEL_CARD = "team";        // the name card.js reports a failed read under
```

On Surfaces, in the `<script>` that holds the `surfaces lineage` fence and above its opening marker, `STAGE_PAGE` alone:

```js
var STAGE_PAGE = "../model/";   // the page that draws this model on the stage
```

Then run:

```bash
npm run design
```

It rewrites the fenced code from the package.

- [ ] **Step 7: The pages behave as they did — the spec's second proof**

```bash
npm run design:check; echo "design:check: $?"
npm run pages:check;  echo "pages:check: $?"
npm run verify;       echo "verify: $?"
npm run sitemap
```

Expected: `0`, `0`, `0`. `verify` clicks through the board, the lineage and the cards, so a fence that changed behavior fails there.

- [ ] **Step 8: Commit and open the pull request, and stop**

The body names both proofs and says the regions were compared before anything was rebuilt. Do not merge.

---

## After this plan

companygraph.io adopting the three pages is its own plan, and it needs this release and its instance artifact `company.json` first. Its landing stage and second pin are companygraph/companygraph.github.io#163, which is independent of this plan and can proceed alongside it.
