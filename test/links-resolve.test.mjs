// The part of the link checker that decides, with no browser and no network. Every answer the
// command gives about an own link comes from here, so a rule that is wrong is wrong in these
// tests first, against a folder built for the purpose.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  URL_STRING, classify, shown, pageKey, pageExists, stageIds, modelUrls, resolveOwn,
} from "../verify/links/resolve.mjs";

const SITE = { host: "fixture.test", origin: "http://127.0.0.1:8000" };

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "design-links-"));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
}

test("a link is own on the served origin or the CNAME's host, external elsewhere, skipped otherwise", () => {
  assert.equal(classify("http://127.0.0.1:8000/about/", SITE).kind, "own");
  assert.equal(classify("https://fixture.test/about/", SITE).kind, "own");
  assert.equal(classify("http://fixture.test/", SITE).kind, "own");
  assert.equal(classify("http://127.0.0.1:9000/x", SITE).kind, "external", "another port is another site");
  assert.equal(classify("https://elsewhere.org/x", SITE).kind, "external");
  assert.equal(classify("https://www.fixture.test/", SITE).kind, "skip", "not the CNAME's own host, and .test is reserved besides");
  for (const href of ["mailto:a@example.org", "tel:+41", "javascript:void(0)", "data:font/woff2;base64,AA", "not a url"])
    assert.equal(classify(href, SITE).kind, "skip", href);
});

test("a host reserved for documentation is skipped, never a claim about a real site", () => {
  for (const href of [
    "https://example.org/x", "https://beacon.example/", "https://a.example.invalid/x",
    "https://docs.example.com/", "https://example.com/", "https://example.net/x",
    "https://sub.example.net/", "https://localhost/x", "https://a.localhost/x",
    "https://example/", "https://a.invalid/", "https://a.test/",
  ]) assert.equal(classify(href, SITE).kind, "skip", href);
  assert.equal(classify("https://fixture.test/", SITE).kind, "own", "own is checked first");
});

test("an own link is shown by its path, an external one in full", () => {
  assert.equal(shown(classify("https://fixture.test/model/?stage=expanded#a/b", SITE)), "/model/?stage=expanded#a/b");
  assert.equal(shown(classify("http://127.0.0.1:8000/model/?stage=expanded#a/b", SITE)), "/model/?stage=expanded#a/b");
  assert.equal(shown(classify("https://elsewhere.org/x?y=1", SITE)), "https://elsewhere.org/x?y=1");
});

test("a path is keyed as the page it is, or not a page at all", () => {
  const root = tree({ "index.html": "", "about/index.html": "", "x.html": "", "model.json": "{}" });
  assert.equal(pageKey("/", root), "/");
  assert.equal(pageKey("/about/", root), "/about/");
  assert.equal(pageKey("/about/index.html", root), "/about/");
  assert.equal(pageKey("/about", root), "/about/", "GitHub Pages redirects a folder to its slash");
  assert.equal(pageKey("/x.html", root), "/x.html");
  assert.equal(pageKey("/model.json", root), null);
  assert.equal(pageKey("/missing", root), null);
  assert.equal(pageExists("/about/", root), true);
  assert.equal(pageExists("/missing/", root), false);
  assert.equal(pageExists("/x.html", root), true);
});

test("a stage finds a node for every entity, the root, and every folder above an entity", () => {
  const ids = stageIds({ rootId: "identity", entities: [{ id: "identity" }, { id: "skills/a" }, { id: "profiles/rb/skills/b" }] });
  for (const id of ["identity", "skills/a", "skills", "profiles", "profiles/rb", "profiles/rb/skills", "profiles/rb/skills/b"])
    assert.ok(ids.has(id), id);
  assert.ok(!ids.has("skills/z"));
  assert.ok(!ids.has("profiles/rb/skill"), "a folder is a whole segment, not a string prefix");
});

test("every absolute URL string in a model is found, with the entity it sits in", () => {
  const data = {
    repo: "robertblust/mental-model",
    entities: [
      { id: "a", fields: { url: "https://example.org/a" }, sections: [{ rows: [["x", "https://example.org/ref"]] }] },
      { id: "b", name: "not a url", tagline: "see https://example.org/in prose" },
    ],
    home: "https://fixture.test/",
  };
  assert.deepEqual(modelUrls(data, "model.json"), [
    { url: "https://example.org/a", from: "model.json · a" },
    { url: "https://example.org/ref", from: "model.json · a" },
    { url: "https://fixture.test/", from: "model.json" },
  ]);
  assert.ok(URL_STRING.test("https://x.test/a?b#c"));
  assert.ok(!URL_STRING.test("see https://x.test"));
});

test("an own link lands only where the checkout and the page it names say it does", () => {
  const root = tree({
    "index.html": "", "about/index.html": "", "model/index.html": "", "nodata/index.html": "",
    "slides.pdf": "", "model.json": "{}",
  });
  const pages = new Map([
    ["/", { ids: new Set(), stage: false, data: null }],
    ["/about/", { ids: new Set(["team", "late"]), stage: false, data: null }],
    ["/model/", { ids: new Set(["stage"]), stage: true, data: "model.json" }],
    ["/nodata/", { ids: new Set(), stage: true, data: null }],
  ]);
  const idsOf = (file) => (file === "model.json" ? new Set(["root", "things", "things/a"]) : new Set());
  const at = (href) => resolveOwn(new URL(href, "http://127.0.0.1:8000/"), { root, pages, idsOf });

  assert.equal(at("/"), null);
  assert.equal(at("/about/"), null);
  assert.equal(at("/about"), null);
  assert.equal(at("/slides.pdf"), null);
  assert.equal(at("/slides.pdf#page=2"), null, "a fragment on a file that is not a page is not looked for");
  assert.equal(at("/missing/"), "no page here");
  assert.equal(at("/missing.pdf"), "no file here");
  assert.equal(at("/about/#team"), null);
  assert.equal(at("/about/#late"), null);
  assert.equal(at("/about/#top"), null);
  assert.equal(at("/about/#nobody"), "no element with id nobody on /about/");
  assert.equal(at("/model/?stage=expanded#things/a"), null);
  assert.equal(at("/model/#things/a"), null, "the stage reads a hash with or without ?stage=");
  assert.equal(at("/model/#things"), null, "a folder is a node");
  assert.equal(at("/model/#stage"), "no node stage in model.json", "on a stage page an element id is not a node");
  assert.equal(at("/model/?stage=expanded#things/ghost"), "no node things/ghost in model.json");
  assert.equal(at("/nodata/#things/a"), "/nodata/ draws a stage and names no data, so #things/a cannot be drawn");
  assert.equal(at("/about/?lang=de#team"), null, "a query string is ignored");
  assert.equal(at("/x.html#a"), "no file here");
});
