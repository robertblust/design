// The team board's fixture, shared by render.test.mjs and pictures.test.mjs. It sits here, not in
// either test file, since importing a test file runs its tests a second time.
const FIXTURE = { commit: "0".repeat(40), repo: "example/model", root: "Someone", rootId: "identity", types: [], entities: [], edges: [] };

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
