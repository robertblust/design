// The model card block run under node against a stub page: a seat's card links where the seat
// sits on the stage. Since meta-model 0.65.0 an entity's id may be a stable UUID and where it
// sits is its address, so the link's hash is the address; data-role stays the id, since it
// names which entity the row is. A model with no address has its path as its id.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { withStableIds } from "./fixtures/stable-ids.mjs";

const BLOCK = fs.readFileSync(new URL("../blocks/model-card.js", import.meta.url), "utf8");

// One seat on one board, opened on arrival by its row's id in the hash, and the href its card's
// link to `id` is given.
function hrefFor(data, role, id) {
  let link = null;
  const el = (attrs = {}) => ({ attrs, open: false, id: attrs.id, tagName: attrs.tag,
    getAttribute: (k) => attrs[k] ?? null, setAttribute() {}, addEventListener() {}, querySelector: () => ({}),
    querySelectorAll: () => [] });
  const row = el({ id: "boss", tag: "DETAILS", "data-role": role });
  const byId = { srclink: el({ "data-src": "model" }), srccommit: el(), boss: row };
  const document = { getElementById: (x) => byId[x] || null, querySelectorAll: (q) => (q === ".grid details" ? [row] : []),
    documentElement: { lang: "en" }, createElement: () => ({ className: "", textContent: "" }) };
  const rbCard = { data: (name, cb) => cb(data), render: (e, body, foot, opts) => { link = opts.link; } };
  function MutationObserver() { this.observe = () => {}; }
  vm.runInNewContext(`var STAGE_PAGE = "../model/", MODEL_CARD = "team";\n${BLOCK}`,
    { document, rbCard, MutationObserver, location: { hash: "#boss" }, window: { addEventListener() {} } });
  assert.ok(link, "the seat's card was not rendered on arrival");
  const a = link(id);
  return a.href;
}

const MODEL = (entities) => ({ commit: "0".repeat(40), repo: "o/r", entities, edges: [] });

test("a seat's card links the stage at the address of what it names", () => {
  const [boss, maker] = withStableIds(MODEL([{ id: "roles/boss", type: "role", name: "Boss" },
    { id: "roles/maker", type: "role", name: "Maker" }])).entities;
  assert.equal(hrefFor(MODEL([boss, maker]), boss.id, maker.id), "../model/?stage=expanded#roles/maker");
});

test("a model with no address links the stage at the id, which is its path", () => {
  const boss = { id: "roles/boss", type: "role", name: "Boss" };
  assert.equal(hrefFor(MODEL([boss]), boss.id, boss.id), "../model/?stage=expanded#roles/boss");
});
