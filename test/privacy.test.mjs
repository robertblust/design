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
