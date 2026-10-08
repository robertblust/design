// The renderers are pure functions of the artifact, so they are tested on a fixture rather
// than on the real model: a test that reads model.json would pass for the wrong reason the
// day the model changes.
//
// Principles and Processes move here with the tests that cover them. The jsonld renderer is not
// moving and its tests stay in blust.ch. Surfaces moves as source in this task; its own tests
// do not move with it, apart from the one test below that reads all three renderers together:
// left in blust.ch it would fail with ENOENT the day a later task deletes blust.ch's copies.
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

import { valuesOf, slugOf } from "../lib/render/principles.mjs";

const princInto = (data, opts = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-princ-"));
  fs.mkdirSync(path.join(dir, "principles"), { recursive: true });
  const file = path.join(dir, "principles", "index.html");
  fs.writeFileSync(file, "<div>\n    <!-- principles:start -->\n    old\n    <!-- principles:end -->\n</div>\n");
  writePrinciples(data, { check: false, root: dir, ...opts });
  return fs.readFileSync(file, "utf8");
};

test("each value is an article with its slug as an id", () => {
  const page = princInto(PRINCIPLES_FIXTURE);
  assert.match(page, /<article class="value" id="a">/);
  assert.match(page, /<article class="value" id="b">/);
  assert.equal(slugOf("values/decide-well"), "decide-well");
  assert.deepEqual(valuesOf(PRINCIPLES_FIXTURE).map((v) => v.id), ["values/a", "values/b"]);
});

// Since meta-model 0.65.0 an entity's id may be a stable UUID, and where it sits is its address.
// An anchor is where the reader lands, so it is built from the address.

test("a value with a stable id is an article with its address's slug as an id", () => {
  const page = princInto(withStableIds(PRINCIPLES_FIXTURE));
  assert.match(page, /<article class="value" id="a">/);
  assert.match(page, /<article class="value" id="b">/);
});

test("without German the page renders as before: no data-de on the model's words, the one-language note", () => {
  const page = princInto(PRINCIPLES_FIXTURE);
  assert.ok(!/<h3 data-de/.test(page), "a value name carries no German");
  assert.ok(page.includes("in the one language it is written in"), "the untranslated note");
});

test("with German every model string carries its data-de, and the note says the German is held to the English", () => {
  const de = (en) => "DE:" + en;
  const page = princInto(PRINCIPLES_FIXTURE, { de });
  assert.match(page, /<h3 data-de="DE:Ay">Ay<\/h3>/);
  assert.match(page, /<p class="tagline" data-de="DE:Ay tagline\.">Ay tagline\.<\/p>/);
  assert.match(page, /<p data-de="DE:Ay body\.">Ay body\.<\/p>/);
  assert.match(page, /<p class="lede" data-de="DE:First para wrapped\.">/);
  assert.match(page, /<h2 data-de="DE:What it means">What it means<\/h2>/);
  assert.ok(page.includes("The model is written in English"), "the translated note");
  assert.ok(!page.includes("in the one language it is written in"));
});

test("German markup inside data-de is single-quoted and its text escaped", () => {
  const data = { ...PRINCIPLES_FIXTURE, entities: PRINCIPLES_FIXTURE.entities.map((e) => e.id !== "values/a" ? e
    : { ...e, tagline: "A & b" }) };
  const page = princInto(data, { de: (en) => en === "A & b" ? "«A» & `c` \"d\" <e>" : "x" });
  assert.ok(page.includes(`data-de="«A» &amp;amp; <code class='mono'>c</code> &quot;d&quot; &amp;lt;e&amp;gt;"`), page);
});

test("a missing German string stops the build, with the caller's message", () => {
  assert.throws(() => princInto(PRINCIPLES_FIXTURE, { de: () => { throw new Error("no German for: Ay"); } }), /no German for: Ay/);
});

// ── the Processes board ────────────────────────────────────────────────────────────────────
import { writeProcesses, marksOf, phasesOf, processesOf, seatsOf } from "../lib/render/processes.mjs";
import { writeSurfaces } from "../lib/render/surfaces.mjs";

import { PROCESSES_FIXTURE, PROCESSES_BY_ADDRESS, idAt } from "./fixtures/processes.mjs";
import { withStableIds, uuidOf } from "./fixtures/stable-ids.mjs";
export { PROCESSES_FIXTURE };

export function renderProcessesInto(fixture, opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-processes-"));
  fs.mkdirSync(path.join(dir, "processes"));
  fs.writeFileSync(path.join(dir, "processes/index.html"),
    "<html><body><p class=\"tagline\">t</p>\n<!-- processes-note:start -->\n<!-- processes-note:end -->\n" +
    "<div class=\"lbl\">The processes</div>\n<!-- processes:start -->\n<!-- processes:end --></body></html>");
  writeProcesses(fixture, { ...opts, root: dir });
  return fs.readFileSync(path.join(dir, "processes/index.html"), "utf8");
}

// A second process beside PROCESSES_FIXTURE's "Doing": one phase, naming Boss, whom Doing names too,
// and Helper, whom Doing does not and no profile holds. So a seat on two boards and a seat no
// profile holds both occur.
const TWO_PROCESS_FIXTURE = withStableIds({
  ...PROCESSES_BY_ADDRESS,
  entities: [
    ...PROCESSES_BY_ADDRESS.entities,
    { id: "seats/helper", type: "seat", name: "Helper", tagline: "Helps.",
      path: "model/seats/helper.md", fields: {}, sections: [] },
    { id: "processes/e", type: "process", name: "Else", tagline: "Another way.",
      path: "model/processes/e/e.md", fields: { owner: "Boss" },
      sections: [{ heading: "Phases", text: "", tables: [{ caption: null, columns: ["Phase"], rows: [["Three"]] }] }] },
    { id: "processes/e/phases/three", type: "phase", name: "Three", tagline: "Third.",
      path: "model/processes/e/phases/three.md", owner: "processes/e",
      fields: { owner: "Boss", "executed-by": ["Helper"], "gate-approvers": ["Boss"] }, sections: [] },
  ],
});
const PROCESS_IDS = ["processes/d", "processes/e"].map((a) => idAt(TWO_PROCESS_FIXTURE, a));
export const regionOf = (page) => page.slice(page.indexOf("<!-- processes:start -->"), page.indexOf("<!-- processes:end -->"));

// What the renderer drew for PROCESSES_FIXTURE at c365772, before it could draw more than one
// process: captured from that commit's code, not written by hand. A row's data-seat is its
// seat's id, which was its address then and is read off the data now; the attribute's name is today's.
const BEFORE_ONE_PROCESS = "<!-- processes:start -->\n      <div class=\"hdrail\"><div class=\"whos\">\n        <div class=\"hw\"><svg class=\"mk human\" aria-hidden=\"true\"><use href=\"#m-human\"/></svg><div><div class=\"nm\">A Person</div><div class=\"lbl\">human · holds 1 of 3</div></div></div>\n        <div class=\"hw\"><svg class=\"mk agent\" aria-hidden=\"true\"><use href=\"#m-agent\"/></svg><div><div class=\"nm\">An Agent</div><div class=\"lbl\">agent · holds 2 of 3</div></div></div>\n      </div><button class=\"openall\" id=\"openall\" type=\"button\" data-de=\"Alle öffnen\">Open all</button></div>\n      <div class=\"grid\" id=\"board\">\n        <div class=\"ghead\"><span class=\"lbl\">Seat</span><span><span class=\"phnum\">01</span><span class=\"phname\">One</span></span><span><span class=\"phnum\">02</span><span class=\"phname\">Two</span></span></div>\n        <details class=\"human\" id=\"boss\" data-seat=\"seats/boss\">\n          <summary aria-label=\"Boss, human. executes Two. approves the gate of One, Two.\"><span class=\"sname\"><svg class=\"mk human\" aria-hidden=\"true\"><use href=\"#m-human\"/></svg><span class=\"tw\">Boss</span></span><span><i class=\"g ga\"></i></span><span><i class=\"g ex\"></i><i class=\"g ga\"></i></span></summary>\n          <div class=\"drawer\"><div class=\"card\"><div class=\"cbody\"></div><div class=\"cfoot\"><span></span></div></div></div>\n        </details>\n        <details id=\"maker\" data-seat=\"seats/maker\">\n          <summary aria-label=\"Maker, agent. executes One. approves no gate.\"><span class=\"sname\"><svg class=\"mk agent\" aria-hidden=\"true\"><use href=\"#m-agent\"/></svg><span class=\"tw\">Maker</span></span><span><i class=\"g ex\"></i></span><span></span></summary>\n          <div class=\"drawer\"><div class=\"card\"><div class=\"cbody\"></div><div class=\"cfoot\"><span></span></div></div></div>\n        </details>\n        <details id=\"checker\" data-seat=\"seats/checker\">\n          <summary aria-label=\"Checker, agent. executes Two. supports One. approves no gate.\"><span class=\"sname\"><svg class=\"mk agent\" aria-hidden=\"true\"><use href=\"#m-agent\"/></svg><span class=\"tw\">Checker</span></span><span><i class=\"g su\"></i></span><span><i class=\"g ex\"></i></span></summary>\n          <div class=\"drawer\"><div class=\"card\"><div class=\"cbody\"></div><div class=\"cfoot\"><span></span></div></div></div>\n        </details>\n      </div>\n      <div class=\"legend\"><span><i class=\"g ex\"></i> <span data-de=\"führt die Phase aus\">executes the phase</span></span><span><i class=\"g su\"></i> <span data-de=\"unterstützt sie\">supports it</span></span><span><i class=\"g ga\"></i> <span data-de=\"gibt ihr Gate frei\">approves its gate</span></span><span><svg class=\"mk human\" aria-hidden=\"true\"><use href=\"#m-human\"/></svg> <span data-de=\"Mensch\">human</span></span><span><svg class=\"mk agent\" aria-hidden=\"true\"><use href=\"#m-agent\"/></svg> <span data-de=\"Agent\">agent</span></span></div>\n      <dl class=\"phases\">\n        <dt><span class=\"phnum\">01</span><span class=\"phname\">One</span></dt>\n        <dd>First.</dd>\n        <dt><span class=\"phnum\">02</span><span class=\"phname\">Two</span></dt>\n        <dd>Second.</dd>\n      </dl>\n      "
  .replace(/data-seat="([^"]+)"/g, (m, address) => `data-seat="${idAt(PROCESSES_FIXTURE, address)}"`);

test("a site that passes no diagram draws no picture, and the board is what it was", () => {
  assert.ok(!renderProcessesInto(PROCESSES_FIXTURE).includes("data-diagram"));
});

test("each process's picture sits under its tagline and before its head rail, in its own section, as the chat's figure with the picture as JSON", () => {
  const seen = [];
  const diagram = (data, proc) => {
    seen.push(proc.id);
    return { title: proc.name, mermaid: `flowchart LR\n  n0["<b>${proc.name}</b>"]`, nodes: [{ node: "n0", id: proc.id, title: proc.name, type: "phase" }], links: [], edges: 0 };
  };
  const html = regionOf(renderProcessesInto(TWO_PROCESS_FIXTURE, { diagram }));
  assert.deepEqual(seen, PROCESS_IDS);
  const sections = html.split('<section class="proc"').slice(1);
  sections.forEach((sec, i) => {
    const name = ["Doing", "Else"][i];
    assert.ok(sec.indexOf('class="proctag"') < sec.indexOf("<figure") && sec.indexOf("<figure") < sec.indexOf('class="hdrail"'), "the picture comes between the tagline and the head rail");
    assert.ok(sec.includes(`<figcaption><span>Process · ${name}</span><button class="rbchat-diagram-full" type="button"`), sec);
    assert.ok(sec.includes('<div class="rbchat-diagram-box"></div>'));
    // The board's name names the picture's file, for the drawing at build to find it by.
    assert.ok(sec.includes(`<figure class="rbchat-diagram" data-diagram data-model="../model/" data-picture="${name.toLowerCase()}">`), "the model page, relative to the Processes page");
    const json = JSON.parse(sec.match(/<script type="application\/json">(.*)<\/script>/)[1]);
    assert.deepEqual(json, { shape: "process", title: name, mermaid: `flowchart LR\n  n0["<b>${name}</b>"]`,
      nodes: [{ node: "n0", id: ["processes/d", "processes/e"][i], title: name }] });
  });
});

// The host names a node by its entity's id, a UUID once the instance carries stable ids, and
// chat.js links a node to the stage by what the figure's JSON names it. The stage takes either,
// but a UUID after the hash is unreadable on hover and when copied, so the renderer, which holds
// the site's model, writes the node's address where the model gives one; a node the model does
// not hold, or a model with no addresses yet, keeps the id the host gave.
test("a picture's node links by its entity's address, and by the host's id where the model gives none", () => {
  const phase = idAt(PROCESSES_FIXTURE, "processes/d/phases/one");
  const diagram = () => ({ title: "Doing", mermaid: "flowchart LR", nodes: [
    { node: "n0", id: phase, title: "One" },
    { node: "n1", id: "0199a3c2-7f00-7000-8000-ffffffffffff", title: "Elsewhere" },
  ] });
  const nodesOf = (fixture) => {
    const html = regionOf(renderProcessesInto(fixture, { diagram }));
    return JSON.parse(html.match(/<script type="application\/json">(.*)<\/script>/)[1]).nodes;
  };
  assert.notEqual(phase, "processes/d/phases/one", "the fixture's id is not its address");
  assert.deepEqual(nodesOf(PROCESSES_FIXTURE).map((n) => n.id), ["processes/d/phases/one", "0199a3c2-7f00-7000-8000-ffffffffffff"]);
  // Before stable ids the id is the address, and no entity carries `address`: the id stands.
  const byAddress = () => ({ title: "Doing", mermaid: "flowchart LR", nodes: [{ node: "n0", id: "processes/d/phases/one", title: "One" }] });
  const html = regionOf(renderProcessesInto(PROCESSES_BY_ADDRESS, { diagram: byAddress }));
  assert.equal(JSON.parse(html.match(/<script type="application\/json">(.*)<\/script>/)[1]).nodes[0].id, "processes/d/phases/one");
});

test("a site whose model is drawn elsewhere names that page, and the picture links there", () => {
  const diagram = () => ({ title: "Doing", mermaid: "flowchart LR", nodes: [] });
  assert.ok(regionOf(renderProcessesInto(PROCESSES_FIXTURE, { diagram, model: "../" })).includes('<figure class="rbchat-diagram" data-diagram data-model="../" data-picture="doing">'));
});

test("no title can close the script a picture's JSON sits in", () => {
  const diagram = () => ({ title: "</script><b>x", mermaid: "flowchart LR", nodes: [] });
  const html = regionOf(renderProcessesInto(PROCESSES_FIXTURE, { diagram }));
  const script = html.slice(html.indexOf('<script type="application/json">'));
  assert.equal(script.indexOf("</script>"), script.lastIndexOf("</script>"));
  assert.equal(JSON.parse(script.slice(script.indexOf(">") + 1, script.indexOf("</script>"))).title, "</script><b>x");
});

test("a model with two processes draws two boards, in the order the artifact lists them", () => {
  const html = regionOf(renderProcessesInto(TWO_PROCESS_FIXTURE));
  const boards = [...html.matchAll(/<div class="grid" id="([a-z-]*)board">/g)].map((m) => m[1]);
  assert.deepEqual(boards, ["doing-", "else-"]);
});

test("each board carries only the phases of its own process", () => {
  const html = regionOf(renderProcessesInto(TWO_PROCESS_FIXTURE));
  const elseBoard = html.slice(html.indexOf('id="else"'));
  assert.match(elseBoard, /Three/);
  assert.doesNotMatch(elseBoard, /<span class="phname">One<\/span>/);
});

test("no two elements share an id when a seat sits on two boards", () => {
  const html = regionOf(renderProcessesInto(TWO_PROCESS_FIXTURE));
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids}`);
});

test("a model with one process draws exactly the board it drew before this change", () => {
  assert.equal(regionOf(renderProcessesInto(PROCESSES_FIXTURE)), BEFORE_ONE_PROCESS);
});

test("a seat the process names and no profile holds is drawn as human, with no name", () => {
  const html = regionOf(renderProcessesInto(TWO_PROCESS_FIXTURE));
  const at = html.indexOf('id="else-helper"');
  assert.ok(at > 0, "the seat no profile holds is on its board");
  const row = html.slice(html.lastIndexOf("<details", at), html.indexOf("</details>", at));
  assert.match(row, /<details class="human"/);
  assert.match(row, /aria-label="Helper, human\./);
});

test("a board shows only the seats its own process names", () => {
  const html = regionOf(renderProcessesInto(TWO_PROCESS_FIXTURE));
  const elseBoard = html.slice(html.indexOf('id="else"'));
  assert.doesNotMatch(elseBoard, /id="else-maker"/);
  assert.match(elseBoard, /id="else-helper"/);
});

test("a person's seats come first, then the seats no profile holds, then an agent's", () => {
  const html = regionOf(renderProcessesInto(TWO_PROCESS_FIXTURE));
  const elseBoard = html.slice(html.indexOf('id="else"'));
  const order = [...elseBoard.matchAll(/<details[^>]* id="else-([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ["boss", "helper"]);
});

test("the seat that owns the process leads its board, before a person's seats", () => {
  // Else names Boss, whom a person holds, and Helper, whom nobody holds; by holder alone Boss
  // comes first. Made Else's owner, Helper leads instead.
  const f = structuredClone(TWO_PROCESS_FIXTURE);
  f.entities.find((e) => e.address === "processes/e").fields.owner = "Helper";
  const elseBoard = regionOf(renderProcessesInto(f)).slice(regionOf(renderProcessesInto(f)).indexOf('id="else"'));
  const order = [...elseBoard.matchAll(/<details[^>]* id="else-([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ["helper", "boss"]);
});

test("a site's order draws the processes it names first, in that order", () => {
  const html = regionOf(renderProcessesInto(TWO_PROCESS_FIXTURE, { order: ["Else"] }));
  const boards = [...html.matchAll(/<div class="grid" id="([a-z-]*)board">/g)].map((m) => m[1]);
  assert.deepEqual(boards, ["else-", "doing-"]);
});

test("an order naming a process the model does not hold is an error", () => {
  assert.throws(() => renderProcessesInto(TWO_PROCESS_FIXTURE, { order: ["Elsewhere"] }), /does not hold: Elsewhere/);
});

test("the board no longer needs a profile to hold a seat", () => {
  const noProfiles = { ...PROCESSES_FIXTURE, entities: PROCESSES_FIXTURE.entities.filter((e) => e.type !== "profile") };
  assert.doesNotThrow(() => renderProcessesInto(noProfiles));
});

test("phasesOf follows the rows of the process's Phases table, not the folder listing", () => {
  assert.deepEqual(phasesOf(PROCESSES_FIXTURE, processesOf(PROCESSES_FIXTURE)[0]).map((p) => p.name), ["One", "Two"]);
});

test("a Phases section with no table of phases is an error, not an empty board", () => {
  const f = structuredClone(PROCESSES_FIXTURE);
  f.entities.find((e) => e.type === "process").sections = [{ heading: "Phases", text: "", tables: [] }];
  assert.throws(() => phasesOf(f, processesOf(f)[0]), /lists no phase/);
});

test("phasesOf reads a phase's name within its own process", () => {
  // Core 0.31.0: a name of an owned type is unique within its owner, so another process may hold
  // a phase of the same name. Placed first, it is what an unscoped lookup would find.
  const f = structuredClone(PROCESSES_FIXTURE);
  f.entities.unshift({ id: uuidOf(255), address: "processes/x/phases/one", type: "phase", name: "One",
    tagline: "Elsewhere.", path: "model/processes/x/phases/one.md", owner: uuidOf(254), fields: {}, sections: [] });
  assert.deepEqual(phasesOf(f, processesOf(f)[0]).map((p) => p.id),
    [idAt(PROCESSES_FIXTURE, "processes/d/phases/one"), idAt(PROCESSES_FIXTURE, "processes/d/phases/two")]);
});

test("seatsOf puts the human profile's seats first", () => {
  assert.deepEqual(seatsOf(PROCESSES_FIXTURE, processesOf(PROCESSES_FIXTURE)[0]).map((s) => s.seat.name), ["Boss", "Maker", "Checker"]);
});

test("marksOf reads executes, supports and approves off each phase", () => {
  const m = marksOf(PROCESSES_FIXTURE, processesOf(PROCESSES_FIXTURE)[0]);
  assert.deepEqual(m.Maker, [["ex"], []]);
  assert.deepEqual(m.Checker, [["su"], ["ex"]]);
  assert.deepEqual(m.Boss, [["ga"], ["ex", "ga"]]);
});

test("marksOf falls back to owner when a phase names no executed-by", () => {
  const f = structuredClone(PROCESSES_FIXTURE);
  const two = f.entities.find((e) => e.address === "processes/d/phases/two");
  delete two.fields["executed-by"];
  assert.deepEqual(marksOf(f, processesOf(f)[0]).Boss, [["ga"], ["ex", "ga"]]);
});

test("marksOf orders a cell executes, supports, approves — never file order", () => {
  assert.deepEqual(marksOf(PROCESSES_FIXTURE, processesOf(PROCESSES_FIXTURE)[0]).Boss[1], ["ex", "ga"]);
});

test("a phase the model does not hold is an error, not a missing column", () => {
  const f = structuredClone(PROCESSES_FIXTURE);
  f.entities = f.entities.filter((e) => e.address !== "processes/d/phases/two");
  assert.throws(() => phasesOf(f, processesOf(f)[0]), /names a phase the model does not hold: Two/);
});

test("every row says itself in words, because the grid is not a table", () => {
  const html = renderProcessesInto(PROCESSES_FIXTURE);
  assert.match(html, /aria-label="Boss, human\. executes Two\. approves the gate of One, Two\."/);
  assert.match(html, /aria-label="Maker, agent\. executes One\. approves no gate\."/);
  assert.match(html, /aria-label="Checker, agent\. executes Two\. supports One\. approves no gate\."/);
});

test("the board carries one details per seat, with its slug as an address", () => {
  const html = renderProcessesInto(PROCESSES_FIXTURE);
  assert.equal((html.match(/<details/g) || []).length, 3);
  assert.ok(html.includes(`<details class="human" id="boss" data-seat="${idAt(PROCESSES_FIXTURE, "seats/boss")}">`), html);
  assert.ok(html.includes(`<details id="checker" data-seat="${idAt(PROCESSES_FIXTURE, "seats/checker")}">`), html);
});

test("the note that says why a region does not translate has one home", () => {
  const princ = fs.readFileSync(new URL("../lib/render/principles.mjs", import.meta.url), "utf8");
  const processes = fs.readFileSync(new URL("../lib/render/processes.mjs", import.meta.url), "utf8");
  const surf = fs.readFileSync(new URL("../lib/render/surfaces.mjs", import.meta.url), "utf8");
  for (const [name, src] of [["principles.mjs", princ], ["processes.mjs", processes], ["surfaces.mjs", surf]]) {
    assert.match(src, /from "\.\/note\.mjs"/, `${name} does not import the note`);
    assert.ok(!/Generated from the model, so the words below/.test(src),
      `${name} carries its own copy of the note`);
  }
});

test("the note lands in the title block, above the section label and the board", () => {
  const html = renderProcessesInto(PROCESSES_FIXTURE);
  // It is about the page, not about the figure, so it reads before the label rather than under
  // it — where /model/ and /principles/ put theirs. Written from here and not typed into the
  // page, so the sentence keeps one home.
  const note = html.indexOf('<p class="note"');
  const label = html.indexOf('class="lbl">The processes');
  const board = html.indexOf('<div class="grid"');
  assert.ok(note > 0, "the note was not written");
  assert.ok(note < label, "the note must read before the section label");
  assert.ok(label < board, "the section label must read before the board");
});

test("a page missing either marker is an error, not a page half-generated", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-processes-"));
  fs.mkdirSync(path.join(dir, "processes"));
  fs.writeFileSync(path.join(dir, "processes/index.html"),
    "<html><body><!-- processes:start -->\n<!-- processes:end --></body></html>");
  assert.throws(() => writeProcesses(PROCESSES_FIXTURE, { root: dir }), /processes-note:start/);
});

test("the board is followed by what each phase is, in the model's own words", () => {
  const html = renderProcessesInto(PROCESSES_FIXTURE);
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

const surfacesInto = (data) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-surf-"));
  fs.mkdirSync(path.join(dir, "surfaces"));
  const file = path.join(dir, "surfaces/index.html");
  fs.writeFileSync(file, "<div>\n    <!-- surfaces-note:start -->\n    <!-- surfaces-note:end -->\n" +
    "      <!-- surfaces:start -->\n      <!-- surfaces:end -->\n</div>\n");
  writeSurfaces(data, { root: dir });
  return fs.readFileSync(file, "utf8");
};
const SURFACES_FIXTURE = {
  ...FIXTURE,
  entities: [
    { id: "surfaces/linkedin-profile", type: "surface", name: "LinkedIn profile", tagline: "t", path: "model/surfaces/linkedin-profile.md",
      fields: { production: "written", url: "https://www.linkedin.com/in/someone/" }, sections: [] },
    { id: "surfaces/model-page", type: "surface", name: "Model page", tagline: "t", path: "model/surfaces/model-page.md",
      fields: { production: "built", "built-by": "https://github.com/example/site", url: "https://example.org/model/" }, sections: [] },
  ],
};

test("a surface's button is anchored by its address, and carries its id to open its card", () => {
  for (const data of [SURFACES_FIXTURE, withStableIds(SURFACES_FIXTURE)]) {
    const page = surfacesInto(data);
    for (const e of data.entities) {
      const slug = (e.address ?? e.id).split("/")[1];
      assert.ok(page.includes(`id="${slug}" data-id="${e.id}"`), page);
    }
  }
});

test("a writer refuses to run without the site's root", () => {
  const data = { entities: [], commit: "0".repeat(40), repo: "x/y" };
  assert.throws(() => writeProcesses(data, {}), /needs the site's root/);
  assert.throws(() => writePrinciples(data, {}), /needs the site's root/);
  assert.throws(() => writeSurfaces(data, {}), /needs the site's root/);
});

import { NOTE_DE } from "../lib/render/note.mjs";

test("the generated note says the rest of the site is bilingual, not the rest of the page", () => {
  assert.match(NOTE_DE, /Der Rest dieser Website ist zweisprachig/);
  assert.doesNotMatch(NOTE_DE, /Der Rest dieser Seite/);
});

// ── a seat held by more than one profile ──────────────────────────────────────────────────────
// A seat names nobody and any number of profiles may list it, so a seat can have several
// holders. PROCESSES_FIXTURE's agent holds Maker and Checker; each case below adds a holder.
const withProfile = (fields, name = "Another Agent", address = "profiles/b") => {
  const f = structuredClone(PROCESSES_FIXTURE);
  f.entities.splice(2, 0, { id: uuidOf(187), address, type: "profile", name, tagline: "A third line.",
    path: `model/${address}/${address.split("/")[1]}.md`, fields, sections: [] });
  return f;
};
const rowOf = (html, id) => {
  const at = html.indexOf(`id="${id}"`);
  return html.slice(html.lastIndexOf("<details", at), html.indexOf("</details>", at));
};
const railOf = (html) => html.slice(html.indexOf('<div class="whos">'), html.indexOf("</div><button"));

test("seatsOf keeps every profile that holds a seat, not only the first", () => {
  const f = withProfile({ nature: "agent", seats: ["Maker"] });
  const maker = seatsOf(f, processesOf(f)[0]).find((s) => s.seat.name === "Maker");
  assert.deepEqual(maker.holders.map((p) => p.name), ["An Agent", "Another Agent"]);
});

test("a seat no profile holds has no holders", () => {
  const f = structuredClone(TWO_PROCESS_FIXTURE);
  const helper = seatsOf(f, processesOf(f)[1]).find((s) => s.seat.name === "Helper");
  assert.deepEqual(helper.holders, []);
});

test("profiles holding the same seats on a board share one entry on its rail", () => {
  const html = regionOf(renderProcessesInto(withProfile({ nature: "agent", seats: ["Maker", "Checker"] })));
  const rail = railOf(html);
  assert.match(rail, /<div class="nm">An Agent, Another Agent<\/div><div class="lbl">agents · share 2 of 3<\/div>/);
  assert.match(rail, /<span class="stack"><svg class="mk agent"[^>]*><use href="#m-agent"\/><\/svg><svg class="mk agent"/);
  assert.equal((rail.match(/class="hw"/g) || []).length, 2, "the person and the two agents together");
});

test("profiles holding different seats keep an entry each, and each counts a shared seat", () => {
  const html = regionOf(renderProcessesInto(withProfile({ nature: "agent", seats: ["Maker"] })));
  const rail = railOf(html);
  assert.match(rail, /<div class="nm">An Agent<\/div><div class="lbl">agent · holds 2 of 3<\/div>/);
  assert.match(rail, /<div class="nm">Another Agent<\/div><div class="lbl">agent · holds 1 of 3<\/div>/);
  assert.doesNotMatch(rail, /class="stack"/);
});

test("a shared seat's row carries a stacked mark and names its holders in words", () => {
  const html = regionOf(renderProcessesInto(withProfile({ nature: "agent", seats: ["Maker"] })));
  const row = rowOf(html, "maker");
  assert.match(row, /<span class="sname"><span class="stack"><svg class="mk agent"[^>]*><use href="#m-agent"\/><\/svg><svg class="mk agent"[^>]*><use href="#m-agent"\/><\/svg><\/span><span class="tw">Maker<\/span>/);
  assert.match(row, /aria-label="Maker, agent, held by An Agent and Another Agent\. executes One\. approves no gate\."/);
  assert.doesNotMatch(rowOf(html, "checker"), /class="stack"/);
});

test("a seat a person shares with an agent is a person's row, the person's mark in front", () => {
  const f = structuredClone(PROCESSES_FIXTURE);
  f.entities.find((e) => e.address === "profiles/p").fields.seats = ["Boss", "Checker"];
  const html = regionOf(renderProcessesInto(f));
  const row = rowOf(html, "checker");
  assert.match(row, /<details class="human" id="checker"/);
  assert.match(row, /<span class="stack"><svg class="mk agent"[^>]*><use href="#m-agent"\/><\/svg><svg class="mk human"[^>]*><use href="#m-human"\/><\/svg><\/span>/);
  assert.match(row, /aria-label="Checker, human and agent, held by A Person and An Agent\./);
  assert.deepEqual(seatsOf(f, processesOf(f)[0]).map((s) => s.seat.name), ["Boss", "Checker", "Maker"]);
  const rail = railOf(html);
  assert.match(rail, /<div class="nm">A Person<\/div><div class="lbl">human · holds 2 of 3<\/div>/);
  assert.match(rail, /<div class="nm">An Agent<\/div><div class="lbl">agent · holds 2 of 3<\/div>/);
});

// ── pictures drawn at build ───────────────────────────────────────────────────────────
import { pictureStamp, picturePath, keptPicture, tokenized, PLACEHOLDERS } from "../lib/pictures.mjs";

const ONE_PICTURE = () => ({ title: "Doing", mermaid: "flowchart LR\n  n0[Doing]", nodes: [{ node: "n0", id: idAt(PROCESSES_FIXTURE, "processes/d"), title: "Doing" }] });
// The picture as the page writes it, and so as it is drawn and stamped: its node by the address.
const ONE_WRITTEN = () => ({ mermaid: ONE_PICTURE().mermaid, nodes: [{ node: "n0", id: "processes/d", title: "Doing" }] });
// A site root with a Processes page, and a chat.js and mermaid.min.js whose bytes the stamp reads.
function siteWithProcesses() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-pictures-"));
  fs.mkdirSync(path.join(dir, "processes"));
  fs.writeFileSync(path.join(dir, "processes/index.html"),
    "<html><body><p class=\"tagline\">t</p>\n<!-- processes-note:start -->\n<!-- processes-note:end -->\n<!-- processes:start -->\n<!-- processes:end --></body></html>");
  fs.writeFileSync(path.join(dir, "chat.js"), "// chat");
  fs.writeFileSync(path.join(dir, "mermaid.min.js"), "// mermaid");
  return dir;
}
function drawnFor(dir, svg = '<svg id="rbchat-picture-doing"><rect fill="var(--raise)"/></svg>') {
  const d = ONE_WRITTEN();
  const file = path.join(dir, picturePath("processes/index.html", "doing"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, svg + "\n");
  fs.writeFileSync(file.replace(/\.svg$/, ".sha"), pictureStamp(d, dir) + "\n");
  return svg;
}
const quiet = (fn) => { const was = console.error; console.error = () => {}; try { return fn(); } finally { console.error = was; } };

test("a picture's stamp moves with its source, its nodes and either file that draws it, and nothing else", () => {
  const dir = siteWithProcesses(), d = { mermaid: "flowchart LR", nodes: [{ node: "n0", id: "x" }] };
  const was = pictureStamp(d, dir);
  assert.equal(pictureStamp({ ...d, title: "a caption is no input" }, dir), was);
  assert.notEqual(pictureStamp({ ...d, mermaid: "flowchart TB" }, dir), was);
  assert.notEqual(pictureStamp({ ...d, nodes: [] }, dir), was);
  fs.writeFileSync(path.join(dir, "chat.js"), "// chat, changed");
  assert.notEqual(pictureStamp(d, dir), was);
  const again = pictureStamp(d, dir);
  fs.writeFileSync(path.join(dir, "mermaid.min.js"), "// mermaid, changed");
  assert.notEqual(pictureStamp(d, dir), again);
});

test("the placeholders come back as the tokens, a translucent one as a mix, and the ids as the board's", () => {
  const [r, g, b] = PLACEHOLDERS["--raise"], hex = "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
  const html = `<svg id="rbchat-diagram-7"><style>#rbchat-diagram-7 .a{fill:${hex};stroke:rgb(${PLACEHOLDERS["--ink"].join(", ")})} #rbchat-diagram-7 .b{background-color:rgba(${r}, ${g}, ${b}, 0.5)}</style><marker id="rbchat-diagram-7_end"/></svg>`;
  const out = tokenized(html, "rbchat-diagram-7", "delivery");
  assert.ok(!out.includes("rbchat-diagram-7"), out);
  assert.ok(out.includes('id="rbchat-picture-delivery"') && out.includes('id="rbchat-picture-delivery_end"'));
  assert.ok(out.includes("fill:var(--raise)") && out.includes("stroke:var(--ink)"), out);
  assert.ok(out.includes("background-color:color-mix(in srgb, var(--raise) 50%, transparent)"), out);
});

test("a picture drawn from what the page shows now is written into its box, and the box says it is drawn", () => {
  const dir = siteWithProcesses(), svg = drawnFor(dir);
  const html = quiet(() => { writeProcesses(PROCESSES_FIXTURE, { root: dir, diagram: ONE_PICTURE }); return fs.readFileSync(path.join(dir, "processes/index.html"), "utf8"); });
  assert.ok(html.includes(`<div class="rbchat-diagram-box" data-drawn>${svg}</div>`), html);
  assert.deepEqual(quiet(() => writeProcesses(PROCESSES_FIXTURE, { root: dir, diagram: ONE_PICTURE, check: true })), []);
});

test("a picture not drawn, or drawn from something else, leaves its box empty and fails the check", () => {
  const dir = siteWithProcesses();
  const said = [];
  const was = console.error; console.error = (m) => said.push(m);
  try {
    writeProcesses(PROCESSES_FIXTURE, { root: dir, diagram: ONE_PICTURE });
    assert.ok(fs.readFileSync(path.join(dir, "processes/index.html"), "utf8").includes('<div class="rbchat-diagram-box"></div>'));
    // The page matches what would be written, and the check still fails: only the drawing can
    // bring the picture back, and nothing else would say so.
    assert.deepEqual(writeProcesses(PROCESSES_FIXTURE, { root: dir, diagram: ONE_PICTURE, check: true }), ["processes/index.html"]);
    drawnFor(dir);
    fs.writeFileSync(path.join(dir, "chat.js"), "// a chat.js the picture was not drawn with");
    assert.equal(keptPicture(dir, "processes/index.html", "doing", ONE_WRITTEN()), null);
    assert.deepEqual(writeProcesses(PROCESSES_FIXTURE, { root: dir, diagram: ONE_PICTURE, check: true }), ["processes/index.html"]);
  } finally { console.error = was; }
  assert.ok(said.every((m) => /processes\/pictures\/doing\.svg .*run: npm run pictures/.test(m)), said.join("\n"));
});
