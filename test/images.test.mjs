// The copy step a site runs beside its model build, against a temporary site root.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncImages } from "../lib/images.mjs";

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
