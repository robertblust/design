# The privacy page draws the model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** robertblust/design gains a renderer that writes a site's privacy page's "Where your data goes" lineage from its model artifact, the German command and checks around it, and a `storageKeys` check held to the model instead of the page's prose.

**Architecture:** `lib/render/privacy.mjs` computes the lineage (root, storage groups, activity groups, entries) as data with `pathOf`, renders it as the same `.lineage` markup `lib/render/surfaces.mjs` writes, and writes it between `<!-- privacy:start -->` and `<!-- privacy:end -->` in `privacy/index.html`, with every model string's German from the site's `build/privacy.de.json`. The page draws and opens cards with the existing `surfaces lineage` block and the `surfaces` rules `page.css` already carries, so no new block or fence is added. `verify/model-pages.mjs` gains `path`; `verify/pages.mjs`'s `storageKeys` reads the stored items from the artifact the privacy page names.

**Tech Stack:** Node ESM, `node --test`, Playwright (the checks run in the sites' suites), the package's own `render/german` loader.

**Spec:** `docs/superpowers/specs/2026-10-05-the-privacy-page-draws-the-model-design.md`

## Scope

This plan is the design repository's half of the spec. Two other pieces are not in it and each comes as its own change: the optional `processing` field on `data-processor` in companygraph/meta-model (spec §6), released before this repository's release; and the three sites' pull requests (spec §8), made after this repository is released. The renderer reads `processing` where it is present and treats it as `fixed` where it is not, so nothing here waits for meta-model.

**One departure from the spec, for the owner to confirm at plan review.** Spec §7 asks for `blocks/privacy.css`, fences `privacy` and `privacy path`, and the drawing made a shared `lineage` behavior. The approved prototype showed none of that is needed: `page.css` already carries the `surfaces` rules on every prose page, and the `surfaces lineage` block already draws any root → group → entry lineage and opens any entity's card, keyed only by `data-maker`, `.ln-s`, `#lnpanel`, `#lnhint` and `#srclink`. So the privacy page carries the existing `surfaces lineage` fence, as /surfaces/ does, and this plan adds no block, fence or `versions.json` entry. Task 5 documents that the block serves both pages. If the owner prefers the spec's separate fences, that is a follow-up with no effect on Tasks 1–4.

## Global Constraints

- Region markers, exactly: `<!-- privacy:start -->` and `<!-- privacy:end -->`, in `privacy/index.html`.
- Storage group order and words, exactly: `local-storage` "Kept in your browser" / "until you clear it · never sent"; `session-storage` "Kept in this tab" / "until the tab closes · never sent"; `cookie` "Cookies"; `indexeddb` "IndexedDB"; `cache` "Cache". German: "In Ihrem Browser gehalten" / "bis Sie ihn löschen · nie gesendet"; "In diesem Tab gehalten" / "bis der Tab schliesst · nie gesendet"; "Cookies"; "IndexedDB"; "Cache".
- Root, exactly: label "On <site>" (German "Auf <site>"), name "Your visit" (German "Ihr Besuch"), and `@` plus the artifact's commit's first seven characters.
- Legal basis words: `consent` consent / Einwilligung; `contract` contract / Vertrag; `legal-obligation` legal obligation / rechtliche Pflicht; `vital-interests` vital interests / lebenswichtige Interessen; `public-task` public task / öffentliche Aufgabe; `legitimate-interests` legitimate interests / berechtigte Interessen.
- Retention words: the number of days the retention states, in digits, "<n> days" / "<n> Tage"; "in your tab only" / "nur in Ihrem Tab" where it says the data stays in the tab; otherwise the retention as written, through `de`.
- A processor's line: its `countries` joined with ", ", then " · " and the row's `Receives`; where `fields.processing === "any"`, "any country · stored " before the countries (German "jedes Land · gespeichert ").
- Every string that comes from a model page goes through `de` where the caller passes one: activity names, stored items' taglines, the `Receives` cells, and a retention drawn as written. Keys, processor names and country codes are not translated.
- No number that moves in prose; American English (R14 of the conventions); commits authored `Implementer <implementer@blust.ch>` with `Process: Delivery`, `Phase: Implement`, `Track: Code`.
- A change here is at least a minor release; the release itself is the owner's.

## Review Focus

- A site with no stored item of a mechanism draws no group for it; a site whose model holds stored items but no processing activity draws only the storage groups. Task 1 tests both.
- One processor named by two activities (Google Cloud in "Answering in the chat" and "Keeping the chat's questions") is two entries with distinct button ids and the same `data-id`; the `path` check matches by id and group, not by id alone. Tasks 1 and 3 test it.
- A `$&` or a `<` in a model string must render as itself, escaped, never as a replacement pattern or markup. Task 1 tests it.
- A retention written "Ninety days, and …" yields "90 days"; one written "Within 30 days …" also yields "30 days". Task 1 tests both.
- `storageKeys` on a page with no chat (a deck, say) must still pass on its theme and language keys and not fail for lack of a chat button. Task 4 tests it.

---

### Task 1: The renderer

**Files:**

- Create: `lib/render/privacy.mjs`
- Create: `test/fixtures/privacy.mjs` (the fixture, shared by Tasks 2 and 3)
- Create: `test/privacy.test.mjs`
- Modify: `package.json` (exports: add `"./render/privacy": "./lib/render/privacy.mjs"` after `"./render/surfaces"`)

**Interfaces:**

- Produces: `pathOf(data, { site })` → `{ root: { site, commit }, groups: [{ key, hand, who, how, entries: [{ id, slug, name, line }] }] }` where `who`, `how`, `line` are `{ en, de }` pairs (`de` is `null` until `writePrivacy` looks it up); `privacyStrings(data)` → `string[]`; `writePrivacy(data, { root, site, de, check })` → `string[]` (the files that would change, in check mode).

- [ ] **Step 1: Write the failing test** — `test/privacy.test.mjs`

```js
// The privacy renderer is a pure function of the artifact, tested on a fixture shaped like the
// three instances' models: stored items in two mechanisms, two activities, three processors, one
// of them named by both activities.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathOf, privacyStrings, writePrivacy } from "../lib/render/privacy.mjs";
import { PRIVACY_FIXTURE, act } from "./fixtures/privacy.mjs";
```

`test/fixtures/privacy.mjs`:

```js
// A model shaped like the three instances': stored items in two mechanisms, two activities, three
// processors, one of them named by both activities.
export const item = (name, mechanism, tagline, extra = {}) => ({ id: `id-${name}`, address: `stored-items/${name}`, type: "stored-item", name, tagline,
  fields: { mechanism, necessity: "optional", surfaces: ["Site"], ...extra }, sections: [] });
export const proc = (name, countries, extra = {}) => ({ id: `id-${name}`, address: `data-processors/${name}`, type: "data-processor", name, tagline: `${name} does a thing.`,
  fields: { "legal-name": `${name} Ltd`, countries, ...extra }, sections: [] });
export const act = (name, basis, retention, rows) => ({ id: `id-${name}`, address: `processing-activities/${name}`, type: "processing-activity", name, tagline: `${name}.`,
  fields: { "legal-basis": basis, retention }, sections: [{ heading: "Processors", text: "", tables: [{ columns: ["Processor", "Receives"], rows }] }] });

export const PRIVACY_FIXTURE = {
  commit: "abcdef0123456789", repo: "example/model",
  entities: [
    item("theme", "local-storage", "Light or dark."),
    item("lang", "local-storage", "The language you chose."),
    item("chat", "session-storage", "The conversation in this tab."),
    proc("Google Cloud", ["CH"]),
    proc("Anthropic", ["US"], { processing: "any" }),
    act("Answering in the chat", "legitimate-interests", "The conversation is kept only in the visitor's browser tab and ends when the tab closes",
      [["Google Cloud", "The messages"], ["Anthropic", "The conversation"]]),
    act("Keeping the chat's questions", "legitimate-interests", "Ninety days, and the weekly report is gone before them",
      [["Google Cloud", "The question, no address"]]),
  ],
};
```

The rest of `test/privacy.test.mjs`:

```js

test("storage groups come first, in mechanism order, each item sorted by key", () => {
  const p = pathOf(PRIVACY_FIXTURE, { site: "example.test" });
  assert.deepEqual(p.groups.map((g) => g.key), ["local-storage", "session-storage", "activity:id-Answering in the chat", "activity:id-Keeping the chat's questions"]);
  assert.deepEqual(p.groups[0].entries.map((e) => e.name), ["lang", "theme"]);
  assert.equal(p.groups[0].hand, true);
  assert.equal(p.groups[2].hand, false);
  assert.deepEqual(p.root, { site: "example.test", commit: "abcdef0" });
});

test("an activity's group line is its legal basis and its retention, in words", () => {
  const p = pathOf(PRIVACY_FIXTURE, { site: "example.test" });
  assert.equal(p.groups[2].how.en, "legitimate interests · in your tab only");
  assert.equal(p.groups[3].how.en, "legitimate interests · 90 days");
});

test("a retention in digits gives its number of days too", () => {
  const data = { ...PRIVACY_FIXTURE, entities: PRIVACY_FIXTURE.entities.map((e) => e.name === "Keeping the chat's questions"
    ? { ...e, fields: { ...e.fields, retention: "Within 30 days of receipt" } } : e) };
  assert.equal(pathOf(data, { site: "x" }).groups[3].how.en, "legitimate interests · 30 days");
});

test("a processor that may process anywhere says so before its countries", () => {
  const p = pathOf(PRIVACY_FIXTURE, { site: "x" });
  const [google, anthropic] = p.groups[2].entries;
  assert.equal(google.line.en, "CH · The messages");
  assert.equal(anthropic.line.en, "any country · stored US · The conversation");
});

test("one processor named by two activities is two entries, distinct ids, one data-id", () => {
  const p = pathOf(PRIVACY_FIXTURE, { site: "x" });
  const a = p.groups[2].entries.find((e) => e.name === "Google Cloud");
  const b = p.groups[3].entries.find((e) => e.name === "Google Cloud");
  assert.equal(a.id, b.id);
  assert.notEqual(a.slug, b.slug);
});

test("a model with stored items and no activity draws only the storage groups", () => {
  const data = { ...PRIVACY_FIXTURE, entities: PRIVACY_FIXTURE.entities.filter((e) => e.type !== "processing-activity") };
  assert.deepEqual(pathOf(data, { site: "x" }).groups.map((g) => g.key), ["local-storage", "session-storage"]);
});

test("a model with none of the three types stops the build", () => {
  assert.throws(() => pathOf({ ...PRIVACY_FIXTURE, entities: [] }, { site: "x" }), /holds no stored item, processing activity or data processor/);
});

test("a Processors row naming a processor the model lacks stops the build, naming the activity", () => {
  const data = { ...PRIVACY_FIXTURE, entities: [...PRIVACY_FIXTURE.entities, act("Mail", "contract", "A year", [["Postbote", "x"]])] };
  assert.throws(() => pathOf(data, { site: "x" }), /processing-activities\/Mail.*Postbote/);
});

test("an activity with no legal basis stops the build, naming it", () => {
  const data = { ...PRIVACY_FIXTURE, entities: [...PRIVACY_FIXTURE.entities, { ...act("Bare", "contract", "A year", []), fields: { retention: "A year" } }] };
  assert.throws(() => pathOf(data, { site: "x" }), /processing-activities\/Bare.*legal-basis/);
});

test("privacyStrings lists every model string the region translates, once each", () => {
  const s = privacyStrings(PRIVACY_FIXTURE);
  for (const want of ["Light or dark", "The language you chose", "The conversation in this tab", "Answering in the chat", "Keeping the chat's questions",
    "The messages", "The conversation", "The question, no address"]) assert.ok(s.includes(want), `missing ${want}`);
  assert.equal(new Set(s).size, s.length);
  assert.ok(!s.includes("Anthropic"), "a processor's name is not translated");
});

const PAGE = `<html><body><main><section><h2>Where your data goes</h2>\n      <!-- privacy:start -->\n      <!-- privacy:end -->\n</section></main></body></html>\n`;
function into(data, opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "privacy-"));
  fs.mkdirSync(path.join(dir, "privacy"));
  fs.writeFileSync(path.join(dir, "privacy/index.html"), PAGE);
  writePrivacy(data, { root: dir, site: "example.test", ...opts });
  return fs.readFileSync(path.join(dir, "privacy/index.html"), "utf8");
}
const DE = (en) => `DE:${en}`;

test("the region is the surfaces lineage's markup, with the root, groups, wires and entries", () => {
  const html = into(PRIVACY_FIXTURE, { de: DE });
  assert.match(html, /<div class="lineage" id="lineage">/);
  assert.match(html, /<svg class="wires" id="wires" aria-hidden="true"><\/svg>/);
  assert.match(html, /<div class="ln-model" id="lnmodel"><div class="lbl" data-de="Auf example.test">On example.test<\/div><div class="nm" data-de="Ihr Besuch">Your visit<\/div><div class="at mono">@abcdef0<\/div><\/div>/);
  assert.match(html, /<li class="ln-group hand">\s*<div class="ln-maker" data-maker="local-storage">/);
  assert.match(html, /<button class="ln-s" type="button" id="key-lang" data-id="id-lang" data-maker="local-storage"[^>]*><span class="nm">lang<\/span><span class="host" data-de="DE:The language you chose">The language you chose<\/span><\/button>/);
  assert.match(html, /id="answering-in-the-chat-anthropic" data-id="id-Anthropic" data-maker="activity:id-Answering in the chat"/);
});

test("without de the region renders English only and names no data-de on model strings", () => {
  const html = into(PRIVACY_FIXTURE);
  assert.doesNotMatch(html, /data-de="DE:/);
  assert.match(html, /<span class="host">The language you chose<\/span>/);
});

test("a $& or a < in a model string renders as itself", () => {
  const data = { ...PRIVACY_FIXTURE, entities: PRIVACY_FIXTURE.entities.map((e) => e.name === "lang" ? { ...e, tagline: "a $& and a <b>" } : e) };
  const html = into(data);
  assert.match(html, /a \$&amp; and a &lt;b&gt;/);
});

test("a missing German string stops the build with the caller's message", () => {
  assert.throws(() => into(PRIVACY_FIXTURE, { de: (en) => { throw new Error(`no German for: "${en}"`); } }), /no German for/);
});

test("check mode writes nothing and names the page when it differs", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "privacy-"));
  fs.mkdirSync(path.join(dir, "privacy"));
  fs.writeFileSync(path.join(dir, "privacy/index.html"), PAGE);
  assert.deepEqual(writePrivacy(PRIVACY_FIXTURE, { root: dir, site: "x", check: true }), ["privacy/index.html"]);
  assert.equal(fs.readFileSync(path.join(dir, "privacy/index.html"), "utf8"), PAGE);
  writePrivacy(PRIVACY_FIXTURE, { root: dir, site: "x" });
  assert.deepEqual(writePrivacy(PRIVACY_FIXTURE, { root: dir, site: "x", check: true }), []);
});

test("a page without the markers stops the build", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "privacy-"));
  fs.mkdirSync(path.join(dir, "privacy"));
  fs.writeFileSync(path.join(dir, "privacy/index.html"), "<html></html>");
  assert.throws(() => writePrivacy(PRIVACY_FIXTURE, { root: dir, site: "x" }), /privacy\/index\.html has no <!-- privacy:start -->/);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/privacy.test.mjs`. Expected: FAIL, `Cannot find module '../lib/render/privacy.mjs'`.

- [ ] **Step 3: Write `lib/render/privacy.mjs`**

```js
// Renders "Where your data goes" into privacy/index.html from the artifact: the visit, the keys
// the browser keeps grouped by how long they last, each processing activity with the data
// processors it hands data to, in the lineage /surfaces/ draws, so the same block draws its wires
// and opens each entry's card. The model's words carry their German from the site's
// build/privacy.de.json, held to the exact English by loadGerman, because a privacy page is where
// a German-speaking visitor most needs the German; the words this file writes itself carry theirs
// here, as NOTE_DE does.
//
// No line is typed. A key sits under its mechanism and a processor under each activity whose
// Processors table names it, so a model that changes moves the page on the next build, and a page
// that names less than the model holds fails pages:check.
import fs from "node:fs";
import path from "node:path";

const START = "<!-- privacy:start -->";
const END = "<!-- privacy:end -->";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const trimDot = (s) => String(s).trim().replace(/\.$/, "");

// The mechanisms in the order the drawing stacks them, each with the words its group line carries.
const MECHANISMS = [
  ["local-storage", { en: "Kept in your browser", de: "In Ihrem Browser gehalten" }, { en: "until you clear it · never sent", de: "bis Sie ihn löschen · nie gesendet" }],
  ["session-storage", { en: "Kept in this tab", de: "In diesem Tab gehalten" }, { en: "until the tab closes · never sent", de: "bis der Tab schliesst · nie gesendet" }],
  ["cookie", { en: "Cookies", de: "Cookies" }, { en: "never sent on their own", de: "nie von sich aus gesendet" }],
  ["indexeddb", { en: "IndexedDB", de: "IndexedDB" }, { en: "never sent on its own", de: "nie von sich aus gesendet" }],
  ["cache", { en: "Cache", de: "Cache" }, { en: "never sent on its own", de: "nie von sich aus gesendet" }],
];

const BASIS = {
  "consent": { en: "consent", de: "Einwilligung" },
  "contract": { en: "contract", de: "Vertrag" },
  "legal-obligation": { en: "legal obligation", de: "rechtliche Pflicht" },
  "vital-interests": { en: "vital interests", de: "lebenswichtige Interessen" },
  "public-task": { en: "public task", de: "öffentliche Aufgabe" },
  "legitimate-interests": { en: "legitimate interests", de: "berechtigte Interessen" },
};

const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fourteen: 14, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

// A retention in the words of the group line: its number of days in digits where it states one,
// "in your tab only" where it keeps the data in the tab, and otherwise the retention as written.
export function retentionWords(retention) {
  const r = String(retention || "");
  const m = r.match(/\b(\d+|[a-z]+)\s+days?\b/i);
  const n = m && (/^\d+$/.test(m[1]) ? Number(m[1]) : NUMBERS[m[1].toLowerCase()]);
  if (n) return { en: `${n} days`, de: `${n} Tage`, fixed: true };
  if (/\btab\b/i.test(r)) return { en: "in your tab only", de: "nur in Ihrem Tab", fixed: true };
  return { en: trimDot(r), de: null, fixed: false };
}

const rowsOf = (activity) => {
  const s = (activity.sections || []).find((x) => x.heading === "Processors");
  return s && s.tables && s.tables[0] ? s.tables[0].rows : [];
};

export function pathOf(data, { site } = {}) {
  const items = data.entities.filter((e) => e.type === "stored-item");
  const activities = data.entities.filter((e) => e.type === "processing-activity");
  const processors = data.entities.filter((e) => e.type === "data-processor");
  if (!items.length && !activities.length && !processors.length)
    throw new Error("the model holds no stored item, processing activity or data processor; the page would say the site keeps and sends nothing");
  const byName = new Map(processors.map((p) => [p.name, p]));
  const groups = [];
  for (const [mechanism, who, how] of MECHANISMS) {
    const mine = items.filter((i) => i.fields.mechanism === mechanism)
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const i of mine) if (!(i.fields.surfaces || []).length) throw new Error(`${i.address} names no surface`);
    if (!mine.length) continue;
    groups.push({ key: mechanism, hand: true, who: { ...who }, how: { ...how },
      entries: mine.map((i) => ({ id: i.id, slug: `key-${slugify(i.name)}`, name: i.name, line: { en: trimDot(i.tagline), de: null, model: true } })) });
  }
  for (const a of activities) {
    const basis = BASIS[a.fields["legal-basis"]];
    if (!basis) throw new Error(`${a.address} has no legal-basis this page can draw: ${a.fields["legal-basis"]}`);
    const ret = retentionWords(a.fields.retention);
    const entries = rowsOf(a).map(([name, receives]) => {
      const p = byName.get(name);
      if (!p) throw new Error(`${a.address} names ${name} in its Processors, and the model holds no such data processor`);
      const countries = (p.fields.countries || []).join(", ");
      const any = p.fields.processing === "any";
      return { id: p.id, slug: `${slugify(a.name)}-${slugify(p.name)}`, name: p.name,
        line: { prefix: { en: `${any ? "any country · stored " : ""}${countries} · `, de: `${any ? "jedes Land · gespeichert " : ""}${countries} · ` },
          en: trimDot(receives), de: null, model: true } };
    });
    groups.push({ key: `activity:${a.id}`, hand: false,
      who: { en: a.name, de: null, model: true },
      how: { en: `${basis.en} · ${ret.en}`, basis, ret },
      entries });
  }
  return { root: { site, commit: String(data.commit).slice(0, 7) }, groups };
}

export function privacyStrings(data) {
  const p = pathOf(data, { site: "" });
  const out = [];
  for (const g of p.groups) {
    if (g.who.model) out.push(g.who.en);
    if (g.how.ret && !g.how.ret.fixed && g.how.ret.en) out.push(g.how.ret.en);
    for (const e of g.entries) out.push(e.line.en);
  }
  return [...new Set(out)];
}

// One attribute: the German beside the English where the caller translates, nothing otherwise.
const deAttr = (de) => (de == null ? "" : ` data-de="${esc(de)}"`);

const MARK_HAND = '<svg class="mk hand" aria-hidden="true"><use href="#m-hand"/></svg>';
const MARK_BUILD = '<svg class="mk build" aria-hidden="true"><use href="#m-build"/></svg>';

function render(p, de) {
  const t = (en) => (de ? de(en) : null);
  const out = [];
  out.push(`      <div class="lineage" id="lineage">`);
  out.push(`        <svg class="wires" id="wires" aria-hidden="true"></svg>`);
  out.push(`        <div class="ln-model" id="lnmodel"><div class="lbl"${deAttr(de ? `Auf ${p.root.site}` : null)}>On ${esc(p.root.site)}</div>` +
    `<div class="nm"${deAttr(de ? "Ihr Besuch" : null)}>Your visit</div><div class="at mono">@${esc(p.root.commit)}</div></div>`);
  out.push(`        <ul class="ln-groups">`);
  for (const g of p.groups) {
    let who, how;
    if (g.hand) {
      who = `<span${deAttr(de ? g.who.de : null)}>${esc(g.who.en)}</span>`;
      how = `<span class="how"${deAttr(de ? g.how.de : null)}>${esc(g.how.en)}</span>`;
    } else {
      const retDe = g.how.ret.fixed ? g.how.ret.de : t(g.how.ret.en);
      who = `<span${deAttr(t(g.who.en))}>${esc(g.who.en)}</span>`;
      how = `<span class="how"${deAttr(de ? `${g.how.basis.de} · ${retDe}` : null)}>${esc(`${g.how.basis.en} · ${g.how.ret.en}`)}</span>`;
    }
    out.push(`          <li class="ln-group${g.hand ? " hand" : ""}">`);
    out.push(`            <div class="ln-maker" data-maker="${esc(g.key)}">${g.hand ? MARK_HAND : MARK_BUILD}<span class="who">${who}${how}</span></div>`);
    out.push(`            <ul class="ln-surfaces">`);
    for (const e of g.entries) {
      const lineEn = `${e.line.prefix ? e.line.prefix.en : ""}${e.line.en}`;
      const lineDe = de ? `${e.line.prefix ? e.line.prefix.de : ""}${t(e.line.en)}` : null;
      out.push(`              <li><button class="ln-s" type="button" id="${esc(e.slug)}" data-id="${esc(e.id)}" data-maker="${esc(g.key)}" ` +
        `aria-pressed="false" aria-controls="lnpanel"><span class="nm">${esc(e.name)}</span><span class="host"${deAttr(lineDe)}>${esc(lineEn)}</span></button></li>`);
    }
    out.push(`            </ul>`);
    out.push(`          </li>`);
  }
  out.push(`        </ul>`);
  out.push(`      </div>`);
  return out.join("\n");
}

export function writePrivacy(data, { check = false, root, site, de } = {}) {
  if (!root) throw new Error("writePrivacy needs the site's root: the page it writes is the site's, not this package's");
  if (!site) throw new Error("writePrivacy needs the site's host, which the drawing's root names");
  const rel = "privacy/index.html";
  const file = path.join(root, rel);
  const page = fs.readFileSync(file, "utf8");
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (!re.test(page)) throw new Error(`${rel} has no ${START} … ${END} block`);
  const body = render(pathOf(data, { site }), de);
  // The function form, so a `$&` in a model string is two characters and not a reference.
  const next = page.replace(re, () => `${START}\n${body}\n      ${END}`);
  if (next === page) return [];
  if (check) return [rel];
  fs.writeFileSync(file, next);
  return [];
}
```

In `package.json`'s `exports`, after `"./render/surfaces": "./lib/render/surfaces.mjs",` add:

```json
    "./render/privacy": "./lib/render/privacy.mjs",
```

- [ ] **Step 4: Run the test and the suite**

Run: `node --test test/privacy.test.mjs`. Expected: PASS, all cases. Then `npm test`. Expected: PASS; `test/verify-exports.test.mjs` may list the package's exports — if it fails naming `./render/privacy`, add the export to the list it holds and say so in the report.

- [ ] **Step 5: Commit**

```bash
git add lib/render/privacy.mjs test/privacy.test.mjs test/fixtures/privacy.mjs package.json
git commit --author "Implementer <implementer@blust.ch>" -F - <<'EOF'
The privacy page's lineage is written from the model

A site's privacy page restated by hand what its model holds about personal data, and drifted from it. render/privacy computes the visit, the keys the browser keeps by mechanism and each processing activity with the processors it hands data to, and writes them between privacy markers in the lineage markup /surfaces/ draws, so the same block draws the wires and opens each card; the model's words carry the German the site passes, held to the English.

Verified: node --test test/privacy.test.mjs failed first and passes; npm test passes.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: <the model that wrote this commit> <noreply@anthropic.com>
EOF
```

### Task 2: `design german privacy`

**Files:**

- Modify: `bin/design.mjs` (usage lines 23–26 and 38–42, and the `german` branch beside `questions`, lines 70–81)
- Test: `test/german-cli.test.mjs` if it exists (`ls test | grep german`); otherwise create `test/german-privacy-cli.test.mjs`

**Interfaces:**

- Consumes: `privacyStrings(data)` from Task 1.
- Produces: `design german privacy <model.json>` prints `privacyStrings` of the artifact as a JSON array, exit 0; exits 2 with a message for a file that is not JSON or holds no model.

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PRIVACY_FIXTURE } from "./fixtures/privacy.mjs";

const BIN = new URL("../bin/design.mjs", import.meta.url).pathname;
const run = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8" });

test("design german privacy prints every model string the privacy region translates", () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gp-")), "model.json");
  fs.writeFileSync(f, JSON.stringify(PRIVACY_FIXTURE));
  const r = run("german", "privacy", f);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.ok(out.includes("Answering in the chat"));
  assert.ok(out.includes("The conversation"));
});

test("design german privacy refuses a file that holds no model", () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gp-")), "de.json");
  fs.writeFileSync(f, "[]");
  const r = run("german", "privacy", f);
  assert.equal(r.status, 2);
  assert.match(r.stderr + r.stdout, /holds no model/);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/german-privacy-cli.test.mjs`. Expected: FAIL, the command prints the usage and exits 2.

- [ ] **Step 3: Add the subcommand**

In the usage, after `design german questions <model.json>` add `       design german privacy <model.json>`, and after the `german questions` line add `  german privacy   every model string the privacy page's lineage translates, as JSON, for the translator`. Beside the `questions` branch add:

```js
  if (sub === "privacy") {
    if (!a) fail(USAGE, 2);
    const { privacyStrings } = await import("../lib/render/privacy.mjs");
    let j;
    try { j = JSON.parse(readPage(a)); } catch { fail(`  ✗ design german privacy: ${a} is not JSON`, 2); }
    const model = j && Array.isArray(j.entities) ? j : j && j.company && Array.isArray(j.company.entities) ? j.company : null;
    if (!model) fail(`  ✗ design german privacy: ${a} holds no model — pass the model.json or company.json the site's pages are built from`, 2);
    console.log(JSON.stringify(privacyStrings(model), null, 2));
    process.exit(0);
  }
```

- [ ] **Step 4: Run the test and the suite**

Run: `node --test test/german-privacy-cli.test.mjs` then `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add bin/design.mjs test/german-privacy-cli.test.mjs
git commit --author "Implementer <implementer@blust.ch>" -F - <<'EOF'
design german privacy hands the translator the privacy region's strings

The privacy region's model strings are translated and held to the English, so the translator needs the list a site's build will ask for. design german privacy prints it from the site's artifact, as design german questions does for the question titles.

Verified: node --test test/german-privacy-cli.test.mjs failed first and passes; npm test passes.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: <the model that wrote this commit> <noreply@anthropic.com>
EOF
```

### Task 3: The `path` check

**Files:**

- Modify: `verify/model-pages.mjs` (import `pathOf`; add `pathEntriesOf`; generalize the in-page comparison the `lineage` check runs; add `path`)
- Modify: `test/model-pages.test.mjs`

**Interfaces:**

- Consumes: `pathOf(data, { site })` from Task 1.
- Produces: `pathEntriesOf(data)` → `[{ id, name, maker }]`, one per drawn entry in drawing order; `MODEL_PAGE_CHECKS.path(page, spec)` → `null` or a failure string.

- [ ] **Step 1: Write the failing test** — append to `test/model-pages.test.mjs`

```js
import { pathEntriesOf } from "../verify/model-pages.mjs";
import { PRIVACY_FIXTURE } from "./fixtures/privacy.mjs";

test("pathEntriesOf lists every entry the privacy lineage draws, a processor once per activity naming it", () => {
  const e = pathEntriesOf(PRIVACY_FIXTURE);
  assert.deepEqual(e.map((x) => [x.name, x.maker]), [
    ["lang", "local-storage"], ["theme", "local-storage"], ["chat", "session-storage"],
    ["Google Cloud", "activity:id-Answering in the chat"], ["Anthropic", "activity:id-Answering in the chat"],
    ["Google Cloud", "activity:id-Keeping the chat's questions"],
  ]);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/model-pages.test.mjs`. Expected: FAIL, `pathEntriesOf` is not exported.

- [ ] **Step 3: Add `pathEntriesOf`, share the lineage comparison, add `path`**

At the top of `verify/model-pages.mjs` add `import { pathOf } from "../lib/render/privacy.mjs";` and:

```js
// Every entry the privacy lineage draws, in drawing order: a key under its mechanism, a processor
// under each activity whose Processors table names it. A processor named twice is two entries
// with one id, so the drawing is compared by id and group together.
export function pathEntriesOf(data) {
  return pathOf(data, { site: "" }).groups.flatMap((g) => g.entries.map((e) => ({ id: e.id, name: e.name, maker: g.key })));
}
```

Move the body of the `page.evaluate(async (want) => { … }, want)` call in `lineage` into a module-level `async function drawnAgainst(page, want, noun)` that runs the same evaluation, with two changes: an entry is found with `btns.find((x) => x.getAttribute("data-id") === s.id && x.getAttribute("data-maker") === s.maker)`, and every message that says "surface" or "surfaces" says `noun` instead (`"surface"` for /surfaces/, `"entry"` for privacy) and its plural with an `s`. `lineage` calls `drawnAgainst(page, want, "surface")` with the `want` it builds today, so its behavior and messages are unchanged. Then add, after `lineage`:

```js
  // The privacy page's lineage, held to the stored items, activities and processors the artifact
  // holds: every entry drawn under its group, the wires, the card a choice opens, a hash landing.
  async path(page, spec) {
    await page.goto(spec.absolute, { waitUntil: "networkidle" });
    const art = await artifact(page);
    if (!art) return "the page names no data";
    const bad = await provenance(page, art.data);
    bad.push(...sameArtifact(await stageTarget(page), art));
    const inPage = await drawnAgainst(page, pathEntriesOf(art.data), "entry");
    bad.push(...inPage.bad);
    if (inPage.id) {
      await page.goto(spec.absolute + "#" + inPage.id, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      const landed = await page.evaluate((id) => document.getElementById(id).getAttribute("aria-pressed") === "true"
        && !!document.querySelector("#lnpanel .cbody h3"), inPage.id);
      if (!landed) bad.push(`arriving on #${inPage.id} did not choose it`);
    }
    return bad.length ? bad.join("; ") : null;
  },
```

Update the file's header comment: "the team board, the surfaces lineage and the privacy path".

- [ ] **Step 4: Run the tests and the suite**

Run: `node --test test/model-pages.test.mjs test/privacy.test.mjs test/german-privacy-cli.test.mjs` then `npm test`. Expected: PASS. The browser half of `path` is exercised by each site's `verify` with `path: true`, as `lineage`'s is; this repository's suite tests the pure half, as it does for `boardsOf`.

- [ ] **Step 5: Commit**

```bash
git add verify/model-pages.mjs test/model-pages.test.mjs
git commit --author "Implementer <implementer@blust.ch>" -F - <<'EOF'
A privacy page is held to its model by the path check

The privacy lineage is generated, and a page that falls behind its model must fail where a reader would see it. path reads the stored items, activities and processors from the artifact the page names and checks each entry is drawn under its group, the wires are drawn, a choice opens its card and a hash lands. It shares the lineage check's comparison, which now finds an entry by id and group, because one processor is drawn once per activity that names it.

Verified: node --test test/model-pages.test.mjs failed first and passes; npm test passes.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: <the model that wrote this commit> <noreply@anthropic.com>
EOF
```

### Task 4: `storageKeys` reads the model

**Files:**

- Modify: `verify/pages.mjs:370-411` (the `storageKeys` check and its comment)
- Modify: `test/theme.test.mjs:259-320` (the two `storageKeys` tests)

**Interfaces:**

- Produces: `storageKeys(page, spec)` — records `[key, mechanism]` pairs written to `localStorage` (`local-storage`) and `sessionStorage` (`session-storage`) while it switches language and theme, moves the divider and opens the chat; fetches `/privacy/`, follows its `link[data-stage]` to the artifact; fails on a pair with no stored item of that name and mechanism; logs, without failing, each stored item it did not see written.

- [ ] **Step 1: Rewrite the two tests in `test/theme.test.mjs`**

Replace the click test's `globalThis.fetch` stub and the second test's `run` helper so the fake page and fetch answer the new shape:

```js
const PRIVACY_HTML = `<link rel="preload" as="fetch" href="../company.json" data-stage crossorigin>`;
const artifactWith = (pairs) => ({ entities: pairs.map(([name, mechanism]) => ({ type: "stored-item", name, fields: { mechanism } })) });
function stubFetch(pairs) {
  return async (url) => String(url).endsWith("/privacy/")
    ? { ok: true, text: async () => PRIVACY_HTML }
    : { ok: true, json: async () => artifactWith(pairs) };
}

test("storageKeys actually clicks the theme control and opens the chat, not merely names them", async () => {
  const clicks = [];
  const fakePage = {
    addInitScript: async () => {}, goto: async () => {}, $: async () => true,
    click: async (sel) => { clicks.push(sel); }, focus: async () => {}, keyboard: { press: async () => {} },
    waitForTimeout: async () => {}, evaluate: async () => [["theme", "local-storage"]],
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = stubFetch([["theme", "local-storage"]]);
  try {
    await pageChecks(THEME_OPTS).storageKeys(fakePage, { absolute: "https://x.test/" });
  } finally { globalThis.fetch = realFetch; }
  for (const sel of ["#thLight", "#thDark", ".rbchat-open"]) assert.ok(clicks.includes(sel), `${sel} was never clicked; clicks were ${JSON.stringify(clicks)}`);
});

test("storageKeys fails on a key the model does not hold, by name and by mechanism, and passes when it holds each", async () => {
  async function run(written, held, { chat = true } = {}) {
    let evalCalls = 0;
    const fakePage = {
      addInitScript: async () => {}, goto: async () => {},
      $: async (sel) => (sel === ".rbchat-open" ? chat : true),
      click: async () => {}, focus: async () => {}, keyboard: { press: async () => {} }, waitForTimeout: async () => {},
      async evaluate() { evalCalls += 1; return evalCalls === 1 ? written : undefined; },
    };
    const realFetch = globalThis.fetch;
    globalThis.fetch = stubFetch(held);
    try { return await pageChecks(THEME_OPTS).storageKeys(fakePage, { absolute: "https://x.test/" }); }
    finally { globalThis.fetch = realFetch; }
  }
  const held = [["lang", "local-storage"], ["theme", "local-storage"], ["chat", "session-storage"]];
  assert.equal(await run([["lang", "local-storage"], ["chat", "session-storage"]], held), null);
  assert.match(await run([["chat-facts", "session-storage"]], held), /chat-facts/);
  assert.match(await run([["chat", "local-storage"]], held), /chat.*local-storage/);
  assert.equal(await run([["theme", "local-storage"]], held, { chat: false }), null, "a page with no chat still passes on its own keys");
});

test("storageKeys fails when /privacy/ names no model", async () => {
  const fakePage = { addInitScript: async () => {}, goto: async () => {}, $: async () => true, click: async () => {},
    focus: async () => {}, keyboard: { press: async () => {} }, waitForTimeout: async () => {}, evaluate: async () => [["theme", "local-storage"]] };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, text: async () => "<p>no link</p>" });
  try {
    assert.match(await pageChecks(THEME_OPTS).storageKeys(fakePage, { absolute: "https://x.test/" }), /\/privacy\/ names no model/);
  } finally { globalThis.fetch = realFetch; }
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test test/theme.test.mjs`. Expected: FAIL — `.rbchat-open` is never clicked, and the check compares against prose rather than the artifact.

- [ ] **Step 3: Rewrite `storageKeys`**

Replace the check's comment and body with:

```js
    // The privacy page draws the keys a browser keeps from the model, so the model is what a key
    // has to be promised in. This drives the page instead of reading it: every write to
    // localStorage and sessionStorage is recorded with its mechanism, the page is made to do the
    // things that write — switch language and theme, move the divider, open the chat without
    // sending — and each key that turns up must be a stored item of that name and mechanism in
    // the artifact /privacy/ names. A stored item never seen written is reported and not failed,
    // because some keys are written only after a visitor acts: a figure an answer draws, a panel
    // resized. The chat was the gap the prose version never closed: it did not open the chat, so
    // a key the chat writes went unseen.
    async storageKeys(page, spec) {
      const privacyUrl = new URL("/privacy/", spec.absolute).href;
      const html = await (await fetch(privacyUrl)).text();
      const href = (html.match(/<link\b[^>]*\bdata-stage\b[^>]*>/) || [""])[0].match(/\bhref="([^"]+)"/);
      if (!href) return "/privacy/ names no model — it carries no link[data-stage] to the artifact its lineage is drawn from";
      const data = await (await fetch(new URL(href[1], privacyUrl).href)).json();
      const held = new Set(data.entities.filter((e) => e.type === "stored-item").map((e) => `${e.name}\u0000${e.fields.mechanism}`));
      await page.addInitScript(() => {
        window.__keys = [];
        const real = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          window.__keys.push([k, this === window.sessionStorage ? "session-storage" : "local-storage"]);
          return real.call(this, k, v);
        };
      });
      await page.goto(spec.absolute, { waitUntil: "networkidle" });
      if (await page.$("#lde")) { await page.click("#lde"); await page.click("#len"); }
      if (await page.$("#langDe")) { await page.click("#langDe"); await page.click("#langEn"); }
      if (await page.$("#thLight")) { await page.click("#thLight"); await page.click("#thDark"); }
      if (await page.$("#gutter")) { await page.focus("#gutter"); await page.keyboard.press("ArrowLeft"); }
      if (await page.$(".rbchat-open")) { await page.click(".rbchat-open"); await page.waitForTimeout(500); }
      const written = await page.evaluate(() => {
        const seen = new Map();
        for (const [k, m] of window.__keys) seen.set(`${k}\u0000${m}`, [k, m]);
        return [...seen.values()];
      });
      await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
      await page.goto(spec.absolute, { waitUntil: "networkidle" });
      if (!written.length)
        return "no write path was exercised — none of #lde/#len, #langDe/#langEn, " +
               "#thLight/#thDark, #gutter or .rbchat-open produced a write on this page; add its control to the list above";
      const seen = new Set(written.map(([k, m]) => `${k}\u0000${m}`));
      const unseen = [...held].filter((x) => !seen.has(x)).map((x) => x.replace("\u0000", " in "));
      if (unseen.length) console.log(`  · storageKeys: ${spec.absolute} did not write ${unseen.join(", ")} in this run`);
      const undeclared = written.filter(([k, m]) => !held.has(`${k}\u0000${m}`)).map(([k, m]) => `${k} in ${m}`);
      return undeclared.length
        ? `writes ${undeclared.join(", ")}, which the model /privacy/ is drawn from holds no stored item for`
        : null;
    },
```

- [ ] **Step 4: Run the tests and the suite**

Run: `node --test test/theme.test.mjs test/hooks.test.mjs` then `npm test`. Expected: PASS. `test/hooks.test.mjs:112` ("the family key is what storageKeys stores under") reads the key names, not the check's comparison; if it fails, adjust its expectation to the recorded `[key, mechanism]` pairs and say so in the report.

- [ ] **Step 5: Commit**

```bash
git add verify/pages.mjs test/theme.test.mjs
git commit --author "Implementer <implementer@blust.ch>" -F - <<'EOF'
storageKeys holds the code to the model, with the chat opened

The check looked for each written key in the privacy page's prose and never opened the chat, so a key the chat wrote went unseen. It now records each key with its mechanism while it also opens the chat, follows /privacy/'s data-stage link to the model the page is drawn from, and fails on a key with no stored item of that name and mechanism; a stored item never seen written is reported, since some keys wait for a visitor to act.

Verified: node --test test/theme.test.mjs failed first and passes; npm test passes.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: <the model that wrote this commit> <noreply@anthropic.com>
EOF
```

### Task 5: The documents

**Files:**

- Modify: `README.md` (the generated-pages table after the `render/surfaces` row; the paragraph naming `verify/model-pages`; the paragraph on `storageKeys` if one names the privacy prose)
- Modify: `docs/design-system/README.md` (the table row "Surfaces lineage")
- Modify: `docs/design-system/blocks.md` (a section after "Surfaces lineage")

- [ ] **Step 1: README**

After the `render/surfaces` row add:

```markdown
| `render/privacy` | `writePrivacy` — the visit, the keys the browser keeps and each processing activity with its data processors into `privacy/index.html`, in the surfaces lineage's markup; takes `site`, the host its root names, and an optional `de` that translates the model's words; `pathOf` and `privacyStrings` return the drawing and its strings without writing |
```

In the paragraph on `verify/model-pages`, after "a page opts in with `board: true` on Team or `lineage: true` on Surfaces", add ", or `path: true` on Privacy", and one sentence: "`path` holds the privacy lineage to the stored items, activities and processors of the artifact the page names, an entry found by its id and its group, because one processor is drawn under each activity that names it." Where the README describes `storageKeys`, say it now reads the stored items of the artifact `/privacy/` names and opens the chat.

- [ ] **Step 2: Design-system documents**

In `docs/design-system/README.md`, change the "Surfaces lineage" row's name cell to "Surfaces lineage, privacy path" and its last cell to link both sections. In `docs/design-system/blocks.md`, after the "Surfaces lineage" section add:

```markdown
## Privacy path

The lineage a privacy page draws under "Where your data goes": the visit on the left, the keys the browser keeps grouped by how long they last and each processing activity in the middle, and under each its keys or the data processors it hands data to, with what each receives. It is the surfaces lineage's markup and behavior, so the page carries the `surfaces lineage` fence, `card.js`, `STAGE_PAGE`, a `link[data-stage]` to the artifact, `#lnpanel`, `#lnhint` and `#srclink` as /surfaces/ does, and `render/privacy` writes the drawing between `<!-- privacy:start -->` and `<!-- privacy:end -->`. A page's own `.card` rules must not reach `#lnpanel .card`; give a page's own boxes a class of their own.
```

- [ ] **Step 3: Check and commit**

Run: `sh conventions/conventions-format check && sh conventions/conventions-check && npm test`. Expected: PASS.

```bash
git add README.md docs/design-system
git commit --author "Implementer <implementer@blust.ch>" -F - <<'EOF'
The documents name the privacy path

render/privacy, the path check and storageKeys' new reading join the README, and the design system's documents say the privacy page draws with the surfaces lineage's block and what it must carry for it.

Verified: conventions-format check, conventions-check and npm test pass.

Process: Delivery
Phase: Implement
Track: Code
Co-Authored-By: <the model that wrote this commit> <noreply@anthropic.com>
EOF
```

## After this plan

The owner's: the release, a minor (`version` in `package.json`, notes naming `render/privacy`, `path`, `design german privacy` and that `storageKeys` now needs `/privacy/` to carry a `link[data-stage]`, which breaks a site that takes the release without the privacy region — so the three sites take it together with their privacy change). Then, each its own change: meta-model's `processing` field (spec §6) and the three sites (spec §8).
