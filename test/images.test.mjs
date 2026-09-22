// The copy step a site runs beside its model build, against a temporary site root.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncImages } from "@robertblust/design/images";

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "design-images-"));
const image = (to, text) => ({ to, bytes: new TextEncoder().encode(text) });

test("it writes each image under images/ at the entity's id, and a second run changes nothing", () => {
  const root = temp();
  const images = [image("profiles/mira.jpg", "mira"), image("identity.png", "mark")];
  assert.deepEqual(syncImages({ root, images }), { wanted: ["identity.png", "profiles/mira.jpg"], problems: [] });
  assert.equal(fs.readFileSync(path.join(root, "images/profiles/mira.jpg"), "utf8"), "mira");
  assert.deepEqual(syncImages({ root, images, check: true }).problems, []);
});

test("check names a copy that differs, one that is missing and one nothing names, and writes nothing", () => {
  const root = temp();
  syncImages({ root, images: [image("profiles/mira.jpg", "mira"), image("profiles/old.png", "old")] });
  fs.writeFileSync(path.join(root, "images/profiles/mira.jpg"), "edited");
  const { problems } = syncImages({ root, check: true, images: [image("profiles/mira.jpg", "mira"), image("profiles/tomas.png", "tomas")] });
  assert.deepEqual(problems, [
    "images/profiles/mira.jpg is not the image the pinned model holds",
    "images/profiles/tomas.png is missing",
    "images/profiles/old.png is named by nothing in the pinned model",
  ]);
  assert.equal(fs.readFileSync(path.join(root, "images/profiles/mira.jpg"), "utf8"), "edited");
  assert.ok(!fs.existsSync(path.join(root, "images/profiles/tomas.png")));
});

test("a run removes what nothing names, and the folder when the model names no image", () => {
  const root = temp();
  syncImages({ root, images: [image("profiles/mira.jpg", "mira")] });
  syncImages({ root, images: [] });
  assert.ok(!fs.existsSync(path.join(root, "images")));
  assert.deepEqual(syncImages({ root, images: [], check: true }).problems, []);
});

test("an ArrayBuffer is written as the bytes it holds", () => {
  const root = temp();
  syncImages({ root, images: [{ to: "profiles/mira.png", bytes: new Uint8Array([1, 2, 3]).buffer }] });
  assert.deepEqual([...fs.readFileSync(path.join(root, "images/profiles/mira.png"))], [1, 2, 3]);
});

test("an entry that would land outside the folder is refused, and nothing is written", () => {
  const tempRoot = temp();
  const root = path.join(tempRoot, "site");
  fs.mkdirSync(root);
  const outside = path.join(root, "..", "outside.txt");
  fs.writeFileSync(outside, "kept");
  assert.throws(() => syncImages({ root, images: [image("../outside.txt", "x")] }), /outside images\//);
  assert.equal(fs.readFileSync(outside, "utf8"), "kept");
  assert.ok(!fs.existsSync(path.join(root, "images")));
  fs.writeFileSync(outside, "kept");
  assert.throws(() => syncImages({ root, images: [{ to: path.join(root, "abs.png"), bytes: new TextEncoder().encode("y") }] }), /outside images\//);
  assert.equal(fs.readFileSync(outside, "utf8"), "kept");
  assert.ok(!fs.existsSync(path.join(root, "images")));
  assert.throws(() => syncImages({ root, check: true, images: [image("../outside.txt", "z")] }), /outside images\//);
  assert.equal(fs.readFileSync(outside, "utf8"), "kept");
  assert.ok(!fs.existsSync(path.join(root, "images")));
});

test("a dir that resolves to the site root is refused, in write and in check mode, and the site is untouched", () => {
  const root = temp();
  const sentinel = path.join(root, "sentinel.txt");
  fs.writeFileSync(sentinel, "kept");
  for (const dir of ["", ".", ".."]) {
    assert.throws(() => syncImages({ root, dir, images: [image("mira.jpg", "mira")] }), /is not inside the site/);
    assert.throws(() => syncImages({ root, dir, check: true, images: [image("mira.jpg", "mira")] }), /is not inside the site/);
  }
  assert.equal(fs.readFileSync(sentinel, "utf8"), "kept");
});

test("a to that is not its own normal form is refused, and a legitimate leading-dot name is written", () => {
  const root = temp();
  assert.throws(() => syncImages({ root, images: [image("a/../b.png", "b")] }), /is not a plain path under images\//);
  assert.throws(() => syncImages({ root, images: [image("./b.png", "b")] }), /is not a plain path under images\//);
  assert.throws(() => syncImages({ root, images: [image("a\\b.png", "b")] }), /is not a plain path under images\//);
  assert.ok(!fs.existsSync(path.join(root, "images")));
  syncImages({ root, images: [image("..a.png", "dotdot")] });
  assert.equal(fs.readFileSync(path.join(root, "images/..a.png"), "utf8"), "dotdot");
});

test("a dotfile beside a named image is not the step's: no problem in check mode, and it survives a write run", () => {
  const root = temp();
  syncImages({ root, images: [image("profiles/mira.jpg", "mira")] });
  fs.writeFileSync(path.join(root, "images/.DS_Store"), "finder");
  assert.deepEqual(syncImages({ root, check: true, images: [image("profiles/mira.jpg", "mira")] }).problems, []);
  syncImages({ root, images: [image("profiles/mira.jpg", "mira")] });
  assert.equal(fs.readFileSync(path.join(root, "images/.DS_Store"), "utf8"), "finder");
});
