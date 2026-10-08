// The Processes board's fixture, shared by render.test.mjs and pictures.test.mjs. It sits here, not in
// either test file, since importing a test file runs its tests a second time.
import { withStableIds } from "./stable-ids.mjs";

const FIXTURE = { commit: "0".repeat(40), repo: "example/model", root: "Someone", rootId: "identity", types: [], entities: [], edges: [] };

// Two phases, three seats, and every relation the board draws. Deliberately not the real
// model: this asserts the derivation, and the real model's shape is asserted by pages:check.
// Written here by address, the way a model before meta-model 0.65.0 wrote its ids; PROCESSES_FIXTURE
// is this with stable ids, as an instance carries them once backfilled.
export const PROCESSES_BY_ADDRESS = {
  ...FIXTURE,
  entities: [
    { id: "profiles/p", type: "profile", name: "A Person", tagline: "One line.",
      path: "model/profiles/p/p.md", fields: { nature: "human", seats: ["Boss"] }, sections: [] },
    { id: "profiles/a", type: "profile", name: "An Agent", tagline: "Another line.",
      path: "model/profiles/a/a.md", fields: { nature: "agent", seats: ["Maker", "Checker"] }, sections: [] },
    { id: "seats/boss", type: "seat", name: "Boss", tagline: "Decides.",
      path: "model/seats/boss.md", fields: { requires: ["Deciding"] }, sections: [] },
    { id: "seats/maker", type: "seat", name: "Maker", tagline: "Makes.",
      path: "model/seats/maker.md", fields: { requires: [] }, sections: [] },
    { id: "seats/checker", type: "seat", name: "Checker", tagline: "Checks.",
      path: "model/seats/checker.md", fields: { requires: [] }, sections: [] },
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

// PROCESSES_BY_ADDRESS with stable ids, through the shared helper; a fixture that appends entities to
// PROCESSES_BY_ADDRESS keeps every id PROCESSES_FIXTURE gives, so the two can be compared.
export const PROCESSES_FIXTURE = withStableIds(PROCESSES_BY_ADDRESS);
// The id of the entity at an address, read off the data.
export const idAt = (data, address) => data.entities.find((e) => e.address === address).id;
