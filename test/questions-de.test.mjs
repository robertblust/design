// The served German of the model's question titles: a pure function of the model and of the
// site's reviewed file, tested on fixtures for the reason german-loader.test.mjs gives — a test
// that reads a real site's file passes for the wrong reason the day that file moves.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadGerman } from "../lib/render/german.mjs";
import { questionTitles, writeQuestionsDe } from "../lib/render/questions.mjs";

const CLI = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "bin", "design.mjs");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "rb-q-"));
const germanFile = (entries) => {
  const f = path.join(tmp(), "questions.de.json");
  fs.writeFileSync(f, JSON.stringify(entries));
  return f;
};
const DATA = { entities: [
  { id: "q/a", type: "question", name: "What is it?" },
  { id: "v/a", type: "value", name: "Not a question" },
  { id: "q/b", type: "question", name: "Who answers?" },
  { id: "q/c", type: "question", name: "" },
  { id: "q/d", type: "question", name: "What is it?" },
] };
const GERMAN = [{ en: "What is it?", de: "Was ist es?" }, { en: "Who answers?", de: "Wer antwortet?" }];

test("questionTitles lists every question's title once, in the model's order", () => {
  assert.deepEqual(questionTitles(DATA), ["What is it?", "Who answers?"]);
  assert.deepEqual(questionTitles({ entities: [] }), []);
});

test("writeQuestionsDe writes each title with its reviewed German, and every entry is asked", () => {
  const root = tmp();
  const g = loadGerman(germanFile(GERMAN));
  assert.deepEqual(writeQuestionsDe(DATA, { root, de: g.de }), []);
  assert.equal(fs.readFileSync(path.join(root, "questions.de.json"), "utf8"),
    JSON.stringify([{ title: "What is it?", text: "Was ist es?" }, { title: "Who answers?", text: "Wer antwortet?" }], null, 2) + "\n");
  assert.deepEqual(g.unused(), []);
});

test("under check a file that differs is reported and left alone, and a matching one is not", () => {
  const root = tmp();
  const { de } = loadGerman(germanFile(GERMAN));
  fs.writeFileSync(path.join(root, "questions.de.json"), "[]\n");
  assert.deepEqual(writeQuestionsDe(DATA, { root, de, check: true }), ["questions.de.json"]);
  assert.equal(fs.readFileSync(path.join(root, "questions.de.json"), "utf8"), "[]\n");
  writeQuestionsDe(DATA, { root, de });
  assert.deepEqual(writeQuestionsDe(DATA, { root, de, check: true }), []);
  const fresh = tmp();
  assert.deepEqual(writeQuestionsDe(DATA, { root: fresh, de, check: true }), ["questions.de.json"], "a file not yet written is stale");
});

test("a title without German stops the write, and German for a title the model lost is unused", () => {
  const g = loadGerman(germanFile([{ en: "What is it?", de: "Was ist es?" }, { en: "Gone?", de: "Weg?" }]));
  assert.throws(() => writeQuestionsDe(DATA, { root: tmp(), de: g.de }), /no German for: "Who answers\?"/);
  assert.ok(g.unused().includes("Gone?"));
});

test("the writer refuses to run without a root or a lookup", () => {
  assert.throws(() => writeQuestionsDe(DATA, { de: () => "" }), /root/);
  assert.throws(() => writeQuestionsDe(DATA, { root: tmp() }), /de/);
});

test("design german questions prints the titles of a model file and of a company file", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "model.json"), JSON.stringify(DATA));
  fs.writeFileSync(path.join(dir, "company.json"), JSON.stringify({ company: DATA }));
  for (const f of ["model.json", "company.json"]) {
    const r = spawnSync(process.execPath, [CLI, "german", "questions", path.join(dir, f)], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), ["What is it?", "Who answers?"], f);
  }
  const missing = spawnSync(process.execPath, [CLI, "german", "questions", path.join(dir, "none.json")], { encoding: "utf8" });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /cannot read/);
});

// Two titles under one German could not be told apart on a German page: a chip would show the
// same words for both, and the widget, which reads German back to a title, would mark the wrong
// one asked. The build refuses it, as it refuses a title with no German.
test("two titles with the same German stop the write, naming both", () => {
  const { de } = loadGerman(germanFile([{ en: "What is it?", de: "Was ist es?" }, { en: "Who answers?", de: "Was ist es?" }]));
  assert.throws(() => writeQuestionsDe(DATA, { root: tmp(), de }), /"What is it\?" and "Who answers\?" share the German "Was ist es\?"/);
});

test("design german questions refuses a file that is not JSON, or holds no model, in one line at exit 2", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "broken.json"), "{ not json");
  fs.writeFileSync(path.join(dir, "null.json"), "null");
  fs.writeFileSync(path.join(dir, "german.json"), JSON.stringify([{ en: "What is it?", de: "Was ist es?" }]));
  for (const f of ["broken.json", "null.json", "german.json"]) {
    const r = spawnSync(process.execPath, [CLI, "german", "questions", path.join(dir, f)], { encoding: "utf8" });
    assert.equal(r.status, 2, `${f}: ${r.stderr}`);
    assert.equal(r.stderr.trim().split("\n").length, 1, `${f}: ${r.stderr}`);
    assert.match(r.stderr, /design german questions/, f);
  }
});
