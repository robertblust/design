import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { staleGerman, staleRange } from "../lib/german-stale.mjs";

const page = (h1, nav = "Model") => `<nav><a data-de="Modell">${nav}</a></nav><h1 data-de="Zwei Ideen.">${h1}</h1><p data-de="Modell">Model</p>`;

test("an English edit under unchanged German is stale; a pair whose German also changed is not", () => {
  assert.deepEqual(staleGerman({ before: page("Two ideas."), after: page("Two ideas, tested.") }).map((s) => s.de), ["Zwei Ideen."]);
  assert.deepEqual(staleGerman({ before: page("Two ideas."), after: page("Two ideas, tested.").replace("Zwei Ideen.", "Zwei Ideen, geprüft.") }), []);
});

test("German repeated for the same English is paired with every English it had, not the first", () => {
  assert.deepEqual(staleGerman({ before: page("Two ideas."), after: page("Two ideas.") }), []);
  assert.equal(staleGerman({ before: page("Two ideas."), after: page("Two ideas.", "Models") }).length, 1);
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
