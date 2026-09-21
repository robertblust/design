import { test } from "node:test";
import assert from "node:assert/strict";
import { boardsOf } from "../verify/model-pages.mjs";

// Two processes, so the ids take the slug. The one profile is an agent holding no seat, so both
// seats are drawn as held by a person. The shapes are the parser's: a process lists its phases in
// a table with a Phase column, and a phase names its process as its owner.
const role = (name) => ({ id: `roles/${name.toLowerCase()}`, type: "role", name, fields: {}, sections: [] });
const proc = (name, phases) => ({
  id: `processes/${name.toLowerCase().replace(/ /g, "-")}`, type: "process", name,
  path: `model/processes/${name}.md`, fields: { owner: "Owner" },
  sections: [{ heading: "Phases", text: "", tables: [{ columns: ["Phase"], rows: phases.map((p) => [p]) }] }],
});
const phase = (procName, name, f) => ({
  id: `phases/${name.toLowerCase()}`, type: "phase", name, fields: f, sections: [],
  owner: `processes/${procName.toLowerCase().replace(/ /g, "-")}`,
});
const DATA = { entities: [
  role("Owner"), role("Requestor"),
  { id: "profiles/ai-agent", type: "profile", name: "AI agent", path: "model/profiles/ai-agent.md",
    fields: { nature: "agent", roles: [] }, sections: [] },
  proc("Feature request", ["Raise", "Answer"]),
  phase("Feature request", "Raise", { owner: "Requestor" }),
  phase("Feature request", "Answer", { owner: "Owner", "gate-approvers": ["Owner"] }),
  proc("Delivery", ["Ship"]),
  phase("Delivery", "Ship", { owner: "Owner", "gate-approvers": ["Owner"] }),
] };

test("boardsOf reads each board's ids, headings, rows and gates from the data", () => {
  const boards = boardsOf(DATA);
  assert.deepEqual(boards.map((b) => b.prefix), ["feature-request-", "delivery-"]);
  const fr = boards[0];
  assert.equal(fr.name, "Feature request");
  assert.deepEqual(fr.phases, ["Raise", "Answer"]);
  assert.deepEqual(fr.rows.map((r) => r.name), ["Owner", "Requestor"]);
  assert.equal(fr.rows.find((r) => r.name === "Owner").gates, 1);
  assert.equal(fr.rows.find((r) => r.name === "Requestor").gates, 0);
  assert.deepEqual(boards[1].rows, [{ name: "Owner", gates: 1 }]);
});

test("a single process draws unprefixed ids, as a one-process board has them", () => {
  const one = { entities: DATA.entities.filter((e) => e.name !== "Delivery" && e.name !== "Ship") };
  assert.deepEqual(boardsOf(one).map((b) => b.prefix), [""]);
});
