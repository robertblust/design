// pagesOf and samePages against real pdf-lib documents, built the way exportDecks builds one.
// The exporter's own tests drive it with a fake PDFDocument, which proves the calls it makes and
// nothing about what pdf-lib stores; reading a picture and a link back out of a loaded document
// is the one part that depends on pdf-lib's own objects, so it is tested on them.
import { test } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { PDFDocument, PDFString } from "pdf-lib";

import { pagesOf, samePages, annotation } from "../decks/export.mjs";

// A small but real PNG in one color, as test/cards-check.test.mjs builds one.
function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function makePNG([r, g, b], size = 8) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8);  // bit depth
  ihdr.writeUInt8(2, 9);  // color type 2: RGB
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = y * (size * 3 + 1) + 1 + x * 3;
    raw[p] = r; raw[p + 1] = g; raw[p + 2] = b;
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const DARK = [12, 14, 19], LIGHT = [250, 249, 245];
const LINK = { x: 100, y: 50, w: 200, h: 20, url: "https://companygraph.io/?lang=en" };

// One page per slide, the picture drawn full frame and each link an annotation over it, saved
// and loaded again: what exportDecks writes, and what it later reads from disk.
async function saved(slides, at = new Date("2026-01-01T00:00:00Z")) {
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(at);
  pdf.setModificationDate(at);
  for (const { color, links = [] } of slides) {
    const page = pdf.addPage([1280, 720]);
    if (color) page.drawImage(await pdf.embedPng(makePNG(color)), { x: 0, y: 0, width: 1280, height: 720 });
    for (const l of links) page.node.addAnnot(pdf.context.register(pdf.context.obj(annotation(l, PDFString))));
  }
  return Buffer.from(await pdf.save());
}
const read = async (bytes) => pagesOf(await PDFDocument.load(bytes));

const DECK = [{ color: DARK, links: [LINK] }, { color: LIGHT }];

test("each page gives its picture's digest and its links as the PDF writes them", async () => {
  const pages = await read(await saved(DECK));
  assert.equal(pages.length, 2);
  assert.match(pages[0].picture, /^[0-9a-f]{64}$/);
  assert.notEqual(pages[0].picture, pages[1].picture);
  assert.equal(pages[0].links.length, 1);
  assert.ok(pages[0].links[0].includes("(https://companygraph.io/?lang=en)"));
  assert.ok(pages[0].links[0].includes("/Rect [ 100 650 300 670 ]"));
  assert.deepEqual(pages[1].links, []);
});

test("two files saved at different times from the same slides hold the same pages", async () => {
  const a = await saved(DECK, new Date("2026-01-01T00:00:00Z"));
  const b = await saved(DECK, new Date("2026-06-01T00:00:00Z"));
  assert.ok(!a.equals(b), "the two files must differ as bytes, or this proves nothing");
  assert.equal(samePages(await read(a), await read(b)), true);
});

test("a changed picture, a changed address, a moved link, a new link and a lost page each differ", async () => {
  const base = await read(await saved(DECK));
  const differs = async (slides) => assert.equal(samePages(base, await read(await saved(slides))), false);
  await differs([{ color: LIGHT, links: [LINK] }, { color: LIGHT }]);
  await differs([{ color: DARK, links: [{ ...LINK, url: "https://companygraph.io/?lang=de" }] }, { color: LIGHT }]);
  await differs([{ color: DARK, links: [{ ...LINK, x: 101 }] }, { color: LIGHT }]);
  await differs([{ color: DARK, links: [LINK, LINK] }, { color: LIGHT }]);
  await differs([{ color: DARK, links: [LINK] }]);
});

test("a page with no picture on it is read as null and is the same as nothing", async () => {
  const pages = await read(await saved([{ links: [LINK] }]));
  assert.equal(pages[0].picture, null);
  assert.equal(samePages(pages, pages), false);
});
