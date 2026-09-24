import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { staleGerman, staleRange } from "../lib/german-stale.mjs";

const CLI = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "bin", "design.mjs");

const page = (h1, nav = "Model") => `<nav><a data-de="Modell">${nav}</a></nav><h1 data-de="Zwei Ideen.">${h1}</h1><p data-de="Modell">Model</p>`;

test("an English edit under unchanged German is stale; a pair whose German also changed is not", () => {
  assert.deepEqual(staleGerman({ before: page("Two ideas."), after: page("Two ideas, tested.") }).map((s) => s.de), ["Zwei Ideen."]);
  assert.deepEqual(staleGerman({ before: page("Two ideas."), after: page("Two ideas, tested.").replace("Zwei Ideen.", "Zwei Ideen, geprüft.") }), []);
});

test("German repeated for the same English is paired with every English it had, not the first", () => {
  assert.deepEqual(staleGerman({ before: page("Two ideas."), after: page("Two ideas.") }), []);
  assert.equal(staleGerman({ before: page("Two ideas."), after: page("Two ideas.", "Models") }).length, 1);
});

// The same German can be right for two different English strings from the start — a nav
// label and a heading that both happen to read "Modell" — and the before-state has to hold
// both, not just the first one seen, or the second element reads as stale on a page nobody
// touched.
test("German shared by two different English values from the start is paired against both, not just one", () => {
  const nav = '<nav><a data-de="Modell">Model</a></nav>';
  const heading = (en) => `<h1 data-de="Modell">${en}</h1>`;
  const before = `${nav}${heading("The model")}`;

  assert.deepEqual(staleGerman({ before, after: `${nav}${heading("The model")}` }), []);

  const stale = staleGerman({ before, after: `${nav}${heading("The updated model")}` });
  assert.equal(stale.length, 1);
  assert.equal(stale[0].now, "The updated model");
});

test("staleRange reads git and honors a German-unchanged trailer", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stale-"));
  try {
    const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" });
    git("init", "-q"); git("config", "user.email", "t@example.test"); git("config", "user.name", "t");
    fs.writeFileSync(path.join(dir, "index.html"), page("Two ideas."));
    git("add", "."); git("commit", "-qm", "base");
    const base = git("rev-parse", "HEAD").trim();
    fs.writeFileSync(path.join(dir, "index.html"), page("Two ideas, tested."));
    git("commit", "-qam", "English only");
    assert.equal(staleRange({ root: dir, base, head: "HEAD" }).length, 1);
    git("commit", "-q", "--allow-empty", "-m", "Keep the German\n\nGerman-unchanged: index.html#a1");
    assert.equal(staleRange({ root: dir, base, head: "HEAD" }).length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A file that exists on only one end of the range — added at head, or removed by head — has
// no "before" or "after" to compare and is skipped, not an error: git's own "fatal: path …
// does not exist" for the missing end must never reach anyone reading a clean run.
test("staleRange skips a file added or deleted in the range and prints nothing to stderr", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stale-range-"));
  try {
    const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" });
    git("init", "-q"); git("config", "user.email", "t@example.test"); git("config", "user.name", "t");
    fs.writeFileSync(path.join(dir, "stale.html"), page("Two ideas."));
    fs.writeFileSync(path.join(dir, "deleted.html"), page("Gone.", "Deleted"));
    git("add", "."); git("commit", "-qm", "base");
    const base = git("rev-parse", "HEAD").trim();

    fs.writeFileSync(path.join(dir, "stale.html"), page("Two ideas, tested."));
    fs.rmSync(path.join(dir, "deleted.html"));
    fs.writeFileSync(path.join(dir, "added.html"), page("New.", "Added"));
    git("add", "."); git("commit", "-qm", "add, delete and edit");

    const stale = staleRange({ root: dir, base, head: "HEAD" });
    assert.deepEqual(stale.map((s) => s.file), ["stale.html"]);
    assert.equal(stale[0].de, "Zwei Ideen.");

    const result = spawnSync(process.execPath, [CLI, "german", "stale", base, "HEAD"], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /fatal/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
