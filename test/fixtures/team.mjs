// The team board's fixture, shared by render.test.mjs and pictures.test.mjs. It sits here, not in
// either test file, since importing a test file runs its tests a second time.
const FIXTURE = { commit: "0".repeat(40), repo: "example/model", root: "Someone", rootId: "identity", types: [], entities: [], edges: [] };

// Two phases, three roles, and every relation the board draws. Deliberately not the real
// model: this asserts the derivation, and the real model's shape is asserted by pages:check.
// Written here by address, the way a model before meta-model 0.65.0 wrote its ids; TEAM_FIXTURE
// is this with stable ids, as an instance carries them once backfilled.
export const TEAM_BY_ADDRESS = {
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

// Every entity gets a UUID-shaped id, numbered in the order it is listed, keeps its path as its
// address, and names its owner by id. A fixture that appends entities to TEAM_BY_ADDRESS keeps
// every id TEAM_FIXTURE gives, so the two can be compared.
export const uuidOf = (n) => `0199a3c2-7f00-7000-8000-${String(n).padStart(12, "0")}`;
export function withStableIds(data) {
  const ids = new Map(data.entities.map((e, i) => [e.id, uuidOf(i + 1)]));
  return { ...data, entities: data.entities.map((e) => ({ ...e, id: ids.get(e.id), address: e.id,
    ...(e.owner ? { owner: ids.get(e.owner) ?? e.owner } : {}) })) };
}
export const TEAM_FIXTURE = withStableIds(TEAM_BY_ADDRESS);
// The id of the entity at an address, read off the data.
export const idAt = (data, address) => data.entities.find((e) => e.address === address).id;
