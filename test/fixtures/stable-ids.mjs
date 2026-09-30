// The stage's fixture model as a parser from meta-model 0.65.0 on writes it once an instance
// carries stable ids: every entity's `id` a UUID v7, its `address` the folder-and-slug path it
// sits at, and every edge, owner, qualifier value and the rootId naming entities by id. The id
// and the address are different strings here on purpose, so a test passes only where the code
// reads the right one of the two. stage-model.json itself stays as a parser before 0.65.0 wrote
// it, with no address, which is the fallback every consumer keeps.
import { STAGE_MODEL } from "./stage-page.mjs";

// UUID-shaped and sorted as the entities are numbered, and nothing like a path: no slash in it.
export const uuidOf = (n) => `0199a3c2-7f00-7000-8000-${String(n).padStart(12, "0")}`;

// A process with two phases beside the concepts, so an owned folder is three levels down and a
// phase's address is not its id's prefix of anything. The shape phase refers to a concept, gates
// to the build phase, and the process lists both phases, so an owner refers to what it owns.
function withProcess(model) {
  const e = (address, type, name, extra = {}) => ({ id: address, type, name, tagline: `${name}, the tagline.`,
    path: `model/${address}.md`, owner: null, fields: { source: "Local" }, sections: [], ...extra });
  return {
    ...model,
    entities: [
      ...model.entities,
      e("processes/delivery", "process", "Delivery"),
      e("processes/delivery/phases/shape", "phase", "Shape", { owner: "processes/delivery",
        fields: { source: "Local", "gate-to": "Build", uses: ["Guest"] } }),
      e("processes/delivery/phases/build", "phase", "Build", { owner: "processes/delivery" }),
    ],
    edges: [
      ...model.edges,
      { from: "processes/delivery", to: "processes/delivery/phases/shape", via: "Phases.Phase", attrs: {} },
      { from: "processes/delivery", to: "processes/delivery/phases/build", via: "Phases.Phase", attrs: {} },
      { from: "processes/delivery/phases/shape", to: "processes/delivery/phases/build", via: "gate-to", attrs: {} },
      { from: "processes/delivery/phases/shape", to: "concepts/guest", via: "uses", attrs: {} },
    ],
  };
}

// Every entity gets a stable id and keeps its path as its address; every reference follows.
export function withStableIds(model) {
  const ids = new Map(model.entities.map((e, i) => [e.id, uuidOf(i + 1)]));
  const to = (v) => (typeof v === "string" && ids.has(v) ? ids.get(v) : v);
  return {
    ...model,
    rootId: to(model.rootId),
    entities: model.entities.map((e) => ({ ...e, id: to(e.id), address: e.id, ...(e.owner ? { owner: to(e.owner) } : {}) })),
    edges: model.edges.map((x) => ({ ...x, from: to(x.from), to: to(x.to),
      attrs: Object.fromEntries(Object.entries(x.attrs || {}).map(([k, v]) => [k, to(v)])) })),
  };
}

export const STABLE_MODEL = withStableIds(withProcess(JSON.parse(STAGE_MODEL)));
// The id an address carries in STABLE_MODEL, read off the data.
export const idAt = (address) => STABLE_MODEL.entities.find((e) => e.address === address).id;
