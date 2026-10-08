// The surfaces lineage block run under node against a stub page: a card's own link, to the
// entity it names inside the panel a chosen surface renders, opens the stage at that entity's
// address. Since meta-model 0.65.0 an entity's id may be a stable UUID and where it sits is its
// address, so the link's hash is the address, mirroring test/model-card.test.mjs. A model with
// no address has its path as its id.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { withStableIds } from "./fixtures/stable-ids.mjs";

const BLOCK = fs.readFileSync(new URL("../blocks/surfaces.js", import.meta.url), "utf8");

// One surface, chosen on arrival by its button's id in the hash, and the href its card's link to
// `id` is given.
function hrefFor(data, surfaceId, id) {
  let link = null;
  const el = (attrs = {}) => ({ attrs, hidden: false, id: attrs.id, tagName: attrs.tag,
    classList: { contains: (c) => c === "ln-s" && attrs.ln === true },
    getAttribute: (k) => attrs[k] ?? null, setAttribute() {}, addEventListener() {},
    querySelector: () => ({}), querySelectorAll: () => [] });
  const btn = el({ id: surfaceId, ln: true, "data-maker": "hand", "data-id": surfaceId });
  const byId = { lineage: el(), wires: el(), lnmodel: el(), lnpanel: el(), lnhint: el(),
    srclink: el({ "data-src": "model" }), srccommit: el(), [surfaceId]: btn };
  const document = {
    getElementById: (x) => byId[x] || null,
    querySelectorAll: (q) => (q === ".ln-s" ? [btn] : []),
    documentElement: { lang: "en" },
    createElement: () => ({ className: "", textContent: "" }),
  };
  const rbCard = { data: (name, cb) => cb(data), render: (e, body, foot, opts) => { link = opts.link; } };
  function MutationObserver() { this.observe = () => {}; }
  const getComputedStyle = () => ({ display: "none" });
  vm.runInNewContext(`var STAGE_PAGE = "../model/";\n${BLOCK}`,
    { document, rbCard, MutationObserver, getComputedStyle, location: { hash: "#" + surfaceId },
      window: { addEventListener() {} } });
  assert.ok(link, "the chosen surface's card was not rendered on arrival");
  const a = link(id);
  return a.href;
}

const MODEL = (entities) => ({ commit: "0".repeat(40), repo: "o/r", entities, edges: [] });

test("a surface's card links the stage at the address of what it names", () => {
  const [boss, maker] = withStableIds(MODEL([{ id: "seats/boss", type: "seat", name: "Boss" },
    { id: "seats/maker", type: "seat", name: "Maker" }])).entities;
  assert.equal(hrefFor(MODEL([boss, maker]), boss.id, maker.id), "../model/?stage=expanded#seats/maker");
});

test("a model with no address links the stage at the id, which is its path", () => {
  const boss = { id: "seats/boss", type: "seat", name: "Boss" };
  assert.equal(hrefFor(MODEL([boss]), boss.id, boss.id), "../model/?stage=expanded#seats/boss");
});
