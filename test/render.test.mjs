// The renderers are pure functions of the artifact, so they are tested on a fixture rather
// than on the real model: a test that reads model.json would pass for the wrong reason the
// day the model changes.
//
// Principles and Team move here with the tests that cover them. The jsonld renderer is not
// moving and its tests stay in blust.ch. Surfaces moves as source in this task; its tests do
// not move with it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FIXTURE = {
  commit: "0".repeat(40),
  repo: "example/model",
  root: "Someone",
  rootId: "identity",
  types: [],
  entities: [],
  edges: [],
};

import { writePrinciples, paragraphs } from "../lib/render/principles.mjs";

test("paragraphs splits on blank lines and unwraps each paragraph", () => {
  const text = "One line\nwrapped here.\n\nA second\nparagraph.";
  assert.deepEqual(paragraphs(text), ["One line wrapped here.", "A second paragraph."]);
});

test("paragraphs drops the empty trailing paragraph", () => {
  assert.deepEqual(paragraphs("Only this.\n\n"), ["Only this."]);
});

const PRINCIPLES_FIXTURE = {
  ...FIXTURE,
  entities: [
    { id: "vision", type: "vision", name: "One thing, everywhere",
      tagline: "A `tagline` with code.", path: "model/vision.md",
      sections: [{ heading: "What it means", text: "First para\nwrapped.\n\nSecond para." }] },
    { id: "values/b", type: "value", name: "Bee", tagline: "Bee tagline.",
      path: "model/values/b.md", sections: [{ heading: "In practice", text: "Bee body." }] },
    { id: "values/a", type: "value", name: "Ay", tagline: "Ay tagline.",
      path: "model/values/a.md", sections: [{ heading: "In practice", text: "Ay body." }] },
  ],
};

test("writePrinciples orders values by path, not by entity order", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-princ-"));
  fs.mkdirSync(path.join(dir, "principles"), { recursive: true });
  fs.writeFileSync(path.join(dir, "principles", "index.html"),
    "<div>\n    <!-- principles:start -->\n    old\n    <!-- principles:end -->\n</div>\n");
  writePrinciples(PRINCIPLES_FIXTURE, { check: false, root: dir });
  const page = fs.readFileSync(path.join(dir, "principles", "index.html"), "utf8");
  assert.ok(page.indexOf("Ay") < page.indexOf("Bee"), "a/ sorts before b/");
  assert.ok(page.includes('<code class="mono">tagline</code>'), "backticks become code");
  assert.ok(page.includes('<p class="lede">First para wrapped.</p>'));
  assert.ok(page.includes('<p class="lede">Second para.</p>'));
});

test("writePrinciples writes a $& in a section's text as itself", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-princ-"));
  fs.mkdirSync(path.join(dir, "principles"), { recursive: true });
  const file = path.join(dir, "principles", "index.html");
  fs.writeFileSync(file,
    "<div>\n    <!-- principles:start -->\n    old\n    <!-- principles:end -->\n</div>\n");
  const dollars = {
    ...PRINCIPLES_FIXTURE,
    entities: PRINCIPLES_FIXTURE.entities.map((e) => e.type !== "vision" ? e
      : { ...e, sections: [{ heading: "What it means", text: "A $& sign, kept." }] }),
  };
  writePrinciples(dollars, { check: false, root: dir });
  const page = fs.readFileSync(file, "utf8");
  assert.ok(page.includes("A $&amp; sign, kept."), "the model's text reaches the page as itself");
  assert.equal(page.split("<!-- principles:start -->").length - 1, 1, "one start marker, not two");
});

// ── the team board ────────────────────────────────────────────────────────────────────
import { writeTeam, marksOf, phasesOf, seatsOf } from "../lib/render/team.mjs";

// Two phases, three roles, and every relation the board draws. Deliberately not the real
// model: this asserts the derivation, and the real model's shape is asserted by pages:check.
export const TEAM_FIXTURE = {
  ...FIXTURE,
  entities: [
    { id: "profiles/p", type: "profile", name: "A Person", tagline: "One line.",
      path: "model/profiles/p/p.md", fields: { nature: "human", roles: ["Boss"] }, sections: [] },
    { id: "profiles/a", type: "profile", name: "An Agent", tagline: "Another line.",
      path: "model/profiles/a/a.md", fields: { nature: "agent", roles: ["Maker", "Checker"] }, sections: [] },
    { id: "roles/boss", type: "role", name: "Boss", tagline: "Decides.",
      path: "model/roles/boss.md", fields: { requires: ["Deciding"] }, sections: [] },
    { id: "roles/maker", type: "role", name: "Maker", tagline: "Makes.",
      path: "model/roles/maker.md", fields: { requires: [] }, sections: [] },
    { id: "roles/checker", type: "role", name: "Checker", tagline: "Checks.",
      path: "model/roles/checker.md", fields: { requires: [] }, sections: [] },
    { id: "processes/d", type: "process", name: "Doing", tagline: "How.",
      path: "model/processes/d/d.md", fields: { owner: "Boss" },
      sections: [{ heading: "Phases", text: "", tables: [{ caption: null, columns: ["Phase"], rows: [["One"], ["Two"]] }] }] },
    { id: "processes/d/phases/one", type: "phase", name: "One", tagline: "First.",
      path: "model/processes/d/phases/one.md", owner: "processes/d",
      fields: { owner: "Maker", "executed-by": ["Maker"], "supported-by": ["Checker"],
                "gate-approvers": ["Boss"], "gate-to": "Two" }, sections: [] },
    { id: "processes/d/phases/two", type: "phase", name: "Two", tagline: "Second.",
      path: "model/processes/d/phases/two.md", owner: "processes/d",
      fields: { owner: "Boss", "executed-by": ["Boss", "Checker"], "gate-approvers": ["Boss"] },
      sections: [] },
  ],
};

export function renderTeamInto(fixture) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-team-"));
  fs.mkdirSync(path.join(dir, "team"));
  fs.writeFileSync(path.join(dir, "team/index.html"),
    "<html><body><p class=\"tagline\">t</p>\n<!-- team-note:start -->\n<!-- team-note:end -->\n" +
    "<div class=\"lbl\">The team</div>\n<!-- team:start -->\n<!-- team:end --></body></html>");
  writeTeam(fixture, { root: dir });
  return fs.readFileSync(path.join(dir, "team/index.html"), "utf8");
}

test("phasesOf follows the rows of the process's Phases table, not the folder listing", () => {
  assert.deepEqual(phasesOf(TEAM_FIXTURE).map((p) => p.name), ["One", "Two"]);
});

test("a Phases section with no table of phases is an error, not an empty board", () => {
  const f = structuredClone(TEAM_FIXTURE);
  f.entities.find((e) => e.type === "process").sections = [{ heading: "Phases", text: "", tables: [] }];
  assert.throws(() => phasesOf(f), /lists no phase/);
});

test("phasesOf reads a phase's name within its own process", () => {
  // Core 0.31.0: a name of an owned type is unique within its owner, so another process may hold
  // a phase of the same name. Placed first, it is what an unscoped lookup would find.
  const f = structuredClone(TEAM_FIXTURE);
  f.entities.unshift({ id: "processes/x/phases/one", type: "phase", name: "One", tagline: "Elsewhere.",
    path: "model/processes/x/phases/one.md", owner: "processes/x", fields: {}, sections: [] });
  assert.deepEqual(phasesOf(f).map((p) => p.id), ["processes/d/phases/one", "processes/d/phases/two"]);
});

test("seatsOf puts the human profile's seats first", () => {
  assert.deepEqual(seatsOf(TEAM_FIXTURE).map((s) => s.role.name), ["Boss", "Maker", "Checker"]);
});

test("marksOf reads executes, supports and approves off each phase", () => {
  const m = marksOf(TEAM_FIXTURE);
  assert.deepEqual(m.Maker, [["ex"], []]);
  assert.deepEqual(m.Checker, [["su"], ["ex"]]);
  assert.deepEqual(m.Boss, [["ga"], ["ex", "ga"]]);
});

test("marksOf falls back to owner when a phase names no executed-by", () => {
  const f = structuredClone(TEAM_FIXTURE);
  const two = f.entities.find((e) => e.id === "processes/d/phases/two");
  delete two.fields["executed-by"];
  assert.deepEqual(marksOf(f).Boss, [["ga"], ["ex", "ga"]]);
});

test("marksOf orders a cell executes, supports, approves — never file order", () => {
  assert.deepEqual(marksOf(TEAM_FIXTURE).Boss[1], ["ex", "ga"]);
});

test("a phase the model does not hold is an error, not a missing column", () => {
  const f = structuredClone(TEAM_FIXTURE);
  f.entities = f.entities.filter((e) => e.id !== "processes/d/phases/two");
  assert.throws(() => phasesOf(f), /names a phase the model does not hold: Two/);
});

test("every row says itself in words, because the grid is not a table", () => {
  const html = renderTeamInto(TEAM_FIXTURE);
  assert.match(html, /aria-label="Boss, human\. executes Two\. approves the gate of One, Two\."/);
  assert.match(html, /aria-label="Maker, agent\. executes One\. approves no gate\."/);
  assert.match(html, /aria-label="Checker, agent\. executes Two\. supports One\. approves no gate\."/);
});

test("the board carries one details per seat, with its slug as an address", () => {
  const html = renderTeamInto(TEAM_FIXTURE);
  assert.equal((html.match(/<details/g) || []).length, 3);
  assert.match(html, /<details class="human" id="boss" data-role="roles\/boss">/);
  assert.match(html, /<details id="checker" data-role="roles\/checker">/);
});

test("the note lands in the title block, above the section label and the board", () => {
  const html = renderTeamInto(TEAM_FIXTURE);
  // It is about the page, not about the figure, so it reads before the label rather than under
  // it — where /model/ and /principles/ put theirs. Written from here and not typed into the
  // page, so the sentence keeps one home.
  const note = html.indexOf('<p class="note"');
  const label = html.indexOf('class="lbl">The team');
  const board = html.indexOf('<div class="grid"');
  assert.ok(note > 0, "the note was not written");
  assert.ok(note < label, "the note reads after the section label");
  assert.ok(label < board, "the section label reads after the board");
});

test("a page missing either marker is an error, not a page half-generated", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-team-"));
  fs.mkdirSync(path.join(dir, "team"));
  fs.writeFileSync(path.join(dir, "team/index.html"),
    "<html><body><!-- team:start -->\n<!-- team:end --></body></html>");
  assert.throws(() => writeTeam(TEAM_FIXTURE, { root: dir }), /team-note:start/);
});

test("the board is followed by what each phase is, in the model's own words", () => {
  const html = renderTeamInto(TEAM_FIXTURE);
  // The columns name the phases; until this block nothing on the page said what any of them
  // was for, because the page carries no tooltip.
  assert.match(html, /<dl class="phases">/);
  assert.match(html, /<dt><span class="phnum">01<\/span><span class="phname">One<\/span><\/dt>\n\s*<dd>First\.<\/dd>/);
  assert.match(html, /<dt><span class="phnum">02<\/span><span class="phname">Two<\/span><\/dt>\n\s*<dd>Second\.<\/dd>/);
  // In the process's order, not the folder's, and every phase present.
  assert.equal((html.match(/<dd>/g) || []).length, 2);
  // The model's words, so no data-de on them — the note above the board says why.
  const block = html.slice(html.indexOf('<dl class="phases">'));
  assert.ok(!/data-de/.test(block), "a phase tagline carries a translation it should not");
});

test("a writer refuses to run without the site's root", () => {
  const data = { entities: [], commit: "0".repeat(40), repo: "x/y" };
  assert.throws(() => writeTeam(data, {}), /needs the site's root/);
  assert.throws(() => writePrinciples(data, {}), /needs the site's root/);
});
