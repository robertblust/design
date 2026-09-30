// The redirect pages a site publishes at /id/<uuid>/, one per entity that carries a stable id:
// what each page says, which entities get none, and how the folder is kept to the model. Imported
// through the package's own `exports` map, as a site imports it, so a dropped entry fails here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { idPages, writeIdPages, idUrl, UUID_V7 } from "@robertblust/design/render/ids";
import { uuidOf } from "./fixtures/stable-ids.mjs";
import { redirectLinks } from "../verify/links/collect.mjs";

const ORIGIN = "https://blust.ch";
const MODEL = (entities) => ({ commit: "0".repeat(40), repo: "o/r", entities, edges: [] });
const A = uuidOf(1);
const B = uuidOf(2);
const entity = (id, address, name, extra = {}) => ({ id, address, name, type: "decision", ...extra });

const pageOf = (files, id) => files.find((f) => f.path === `id/${id}/index.html`)?.html;

test("an entity with a stable id gets one page at id/<uuid>/index.html", () => {
  const files = idPages(MODEL([entity(A, "decisions/2026-four-months", "Four months")]), { origin: ORIGIN, stage: "/model/" });
  assert.deepEqual(files.map((f) => f.path), [`id/${A}/index.html`]);
  const html = files[0].html;
  assert.match(html, /^<!doctype html>\n<html lang="en">/);
  assert.match(html, /<meta charset="utf-8">/);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /<title>Four months<\/title>/);
  assert.match(html, /<a href="[^"]+">Four months<\/a>/, "the fallback link names the entity");
  assert.ok(html.endsWith("</html>\n"));
});

test("the refresh and the fallback link are relative to the stage, and no canonical mixes signals with noindex", () => {
  const e = entity(A, "decisions/2026-four-months", "Four months");
  const model = pageOf(idPages(MODEL([e]), { origin: ORIGIN, stage: "/model/" }), A);
  assert.ok(!/rel="canonical"/.test(model), "a redirect page names no canonical");
  assert.match(model, /<meta http-equiv="refresh" content="0; url=\.\.\/\.\.\/model\/\?stage=expanded#decisions\/2026-four-months">/);
  assert.match(model, /<a href="\.\.\/\.\.\/model\/\?stage=expanded#decisions\/2026-four-months">/);

  // companygraph.io draws its own company on the home page.
  const home = pageOf(idPages(MODEL([e]), { origin: "https://companygraph.io", stage: "/" }), A);
  assert.match(home, /<meta http-equiv="refresh" content="0; url=\.\.\/\.\.\/\?stage=expanded#decisions\/2026-four-months">/);
});

test("an entity whose id is still its address gets no page, since it has no stable id to publish", () => {
  const files = idPages(MODEL([
    entity("decisions/old", "decisions/old", "Old"),
    { id: "roles/owner", name: "Owner", type: "role" },
    entity(A, "roles/maker", "Maker"),
  ]), { origin: ORIGIN, stage: "/model/" });
  assert.deepEqual(files.map((f) => f.path), [`id/${A}/index.html`]);
});

test("an id that is not a UUID v7 is skipped, so no path is ever written from unchecked data", () => {
  const bad = [
    "../../etc/passwd",
    "0199a3c2-7f00-4000-8000-000000000001", // v4
    "0199a3c2-7f00-7000-c000-000000000001", // wrong variant
    "0199A3C2-7F00-7000-8000-000000000001", // not the lowercase form an @id is compared in
    `${A}/x`,
    ` ${A}`,
    "",
  ];
  const files = idPages(MODEL([...bad.map((id, i) => entity(id, `things/t${i}`, `T${i}`)), entity(B, "things/ok", "Ok")]),
    { origin: ORIGIN, stage: "/model/" });
  assert.deepEqual(files.map((f) => f.path), [`id/${B}/index.html`]);
  for (const id of bad) assert.equal(UUID_V7.test(id), false, id);
  assert.equal(UUID_V7.test(A), true);
});

test("everything taken from the model is escaped: the name as text, the address as a URL fragment", () => {
  const e = entity(A, `things/a"b<c>&d e'f#g`, `Tom & "Jerry" <b>'s</b>`);
  const html = pageOf(idPages(MODEL([e]), { origin: ORIGIN, stage: "/model/" }), A);
  assert.ok(!html.includes("<b>"), "no markup from a name reaches the page");
  assert.match(html, /<title>Tom &amp; &quot;Jerry&quot; &lt;b&gt;&#39;s&lt;\/b&gt;<\/title>/);
  const frag = "things/a%22b%3Cc%3E%26d%20e%27f%23g";
  assert.ok(html.includes(`href="../../model/?stage=expanded#${frag}"`), html);
  assert.ok(html.includes(`content="0; url=../../model/?stage=expanded#${frag}"`), html);
  // Every attribute value closes where it should: no quote from the data survives inside one.
  for (const m of html.matchAll(/="([^"]*)"/g)) assert.ok(!/[<>]/.test(m[1]), m[0]);
});

test("a name missing from the data falls back to the address", () => {
  const html = pageOf(idPages(MODEL([{ id: A, address: "things/nameless", type: "concept" }]), { origin: ORIGIN, stage: "/model/" }), A);
  assert.match(html, /<title>things\/nameless<\/title>/);
});

test("an origin or a stage page the renderer cannot build a link from is refused", () => {
  const m = MODEL([entity(A, "things/a", "A")]);
  for (const origin of [undefined, "blust.ch", "https://blust.ch/", "https://blust.ch/x", "javascript:alert(1)"])
    assert.throws(() => idPages(m, { origin, stage: "/model/" }), /origin/, String(origin));
  for (const stage of [undefined, "model/", "/model", "/../x/", "//evil.example/", "/a b/"])
    assert.throws(() => idPages(m, { origin: ORIGIN, stage }), /stage/, String(stage));
});

test("two entities claiming one id stop the build rather than overwrite each other's page", () => {
  assert.throws(() => idPages(MODEL([entity(A, "things/a", "A"), entity(A, "things/b", "B")]), { origin: ORIGIN, stage: "/model/" }),
    new RegExp(A));
});

test("idUrl is the @id a site's JSON-LD names, and null where the entity has no stable id", () => {
  assert.equal(idUrl(entity(A, "things/a", "A"), ORIGIN), `https://blust.ch/id/${A}`);
  assert.equal(idUrl(entity("things/a", "things/a", "A"), ORIGIN), null);
  assert.equal(idUrl(entity("nope", "things/a", "A"), ORIGIN), null);
  for (const origin of [undefined, "https://blust.ch/", "blust.ch"]) assert.throws(() => idUrl(entity(A, "things/a", "A"), origin), /origin/);
});

// The writer, against a site root in a temporary folder.
function site() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "design-ids-"));
}
const OPTS = { origin: ORIGIN, stage: "/model/" };

test("the writer writes every page, and its check then finds nothing to change", () => {
  const root = site();
  const data = MODEL([entity(A, "things/a", "A"), entity(B, "things/b", "B")]);
  assert.deepEqual(writeIdPages(data, { ...OPTS, root }), []);
  assert.ok(fs.existsSync(path.join(root, "id", A, "index.html")));
  assert.ok(fs.existsSync(path.join(root, "id", B, "index.html")));
  assert.deepEqual(writeIdPages(data, { ...OPTS, root, check: true }), []);
});

test("its check names a page that is missing or no longer what the model says, and writes nothing", () => {
  const root = site();
  const data = MODEL([entity(A, "things/a", "A"), entity(B, "things/b", "B")]);
  writeIdPages(data, { ...OPTS, root });
  const moved = MODEL([entity(A, "things/renamed", "A"), entity(B, "things/b", "B"), entity(uuidOf(3), "things/c", "C")]);
  const before = fs.readFileSync(path.join(root, "id", A, "index.html"), "utf8");
  assert.deepEqual(writeIdPages(moved, { ...OPTS, root, check: true }).sort(),
    [`id/${A}/index.html`, `id/${uuidOf(3)}/index.html`].sort());
  assert.equal(fs.readFileSync(path.join(root, "id", A, "index.html"), "utf8"), before, "check wrote");
  assert.ok(!fs.existsSync(path.join(root, "id", uuidOf(3))), "check wrote");
});

test("a page for an entity the model no longer holds is named by the check and removed by the writer", () => {
  const root = site();
  writeIdPages(MODEL([entity(A, "things/a", "A"), entity(B, "things/b", "B")]), { ...OPTS, root });
  fs.writeFileSync(path.join(root, "id", "stray.html"), "x");
  fs.writeFileSync(path.join(root, "id", ".DS_Store"), "x");
  const after = MODEL([entity(A, "things/a", "A")]);
  assert.deepEqual(writeIdPages(after, { ...OPTS, root, check: true }).sort(), [`id/${B}`, "id/stray.html"].sort());
  assert.ok(fs.existsSync(path.join(root, "id", B, "index.html")), "check removed");
  assert.deepEqual(writeIdPages(after, { ...OPTS, root }), []);
  assert.deepEqual(fs.readdirSync(path.join(root, "id")).sort(), [".DS_Store", A].sort(), "a dotfile is never the writer's");
  assert.deepEqual(writeIdPages(after, { ...OPTS, root, check: true }), []);
});

test("a model with no stable id leaves no id/ folder behind", () => {
  const root = site();
  writeIdPages(MODEL([entity(A, "things/a", "A")]), { ...OPTS, root });
  const unbackfilled = MODEL([entity("things/a", "things/a", "A")]);
  assert.deepEqual(writeIdPages(unbackfilled, { ...OPTS, root, check: true }), [`id/${A}`]);
  writeIdPages(unbackfilled, { ...OPTS, root });
  assert.ok(!fs.existsSync(path.join(root, "id")));
  assert.deepEqual(writeIdPages(unbackfilled, { ...OPTS, root, check: true }), []);
});

test("the writer refuses to run without the site's root", () => {
  assert.throws(() => writeIdPages(MODEL([]), OPTS), /root/);
});

test("the link checker reads a page this renderer writes as a redirect to the entity's place", () => {
  const e = entity(A, `things/a b"c`, "A");
  const html = pageOf(idPages(MODEL([e]), OPTS), A);
  const base = `http://127.0.0.1:8000/id/${A}/`;
  assert.deepEqual(redirectLinks(html, base), [
    "http://127.0.0.1:8000/model/?stage=expanded#things/a%20b%22c",
    "http://127.0.0.1:8000/model/?stage=expanded#things/a%20b%22c",
  ]);
});

test("only a page that leaves at once for a url, from its head, and is noindex is read as a redirect", () => {
  const base = "http://127.0.0.1:8000/p/";
  const NOINDEX = '<meta name="robots" content="noindex">';
  const page = (head, body = '<a href="a/">a</a>') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
  assert.deepEqual(redirectLinks(page(`${NOINDEX}<meta http-equiv='refresh' content='0;URL="/x/"'>`), base),
    ["http://127.0.0.1:8000/x/", "http://127.0.0.1:8000/p/a/"], "the positive control");
  assert.equal(redirectLinks("<!doctype html><title>x</title><a href=\"a/\">a</a>", base), null, "no refresh");
  assert.equal(redirectLinks(page(`${NOINDEX}<meta http-equiv="refresh" content="5; url=/x/">`), base), null, "a delay");
  assert.equal(redirectLinks(page(`${NOINDEX}<meta http-equiv="refresh" content="0">`), base), null, "no url");
  assert.equal(redirectLinks(page(`${NOINDEX}<noscript><meta http-equiv="refresh" content="0; url=/x/"></noscript>`), base), null, "inside noscript");
  assert.equal(redirectLinks(page(`${NOINDEX}<!-- <meta http-equiv="refresh" content="0; url=/x/"> -->`), base), null, "inside a comment");
  assert.equal(redirectLinks(page(`${NOINDEX}<script>const s = '<meta http-equiv="refresh" content="0; url=/x/">';</script>`), base), null, "inside a script");
  assert.equal(redirectLinks(page(NOINDEX, '<meta http-equiv="refresh" content="0; url=/x/">'), base), null, "in the body");
  assert.equal(redirectLinks(page('<meta http-equiv="refresh" content="0; url=/x/">'), base), null, "not noindex");
  assert.equal(redirectLinks(page(`<meta data-name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=/x/">`), base), null, "a data-name is not a name");
  assert.equal(redirectLinks(page(`${NOINDEX}<meta data-http-equiv="refresh" content="0; url=/x/">`), base), null, "a data-http-equiv is not an http-equiv");
  assert.equal(redirectLinks(page(`<title><meta name="robots" content="noindex"></title><meta http-equiv="refresh" content="0; url=/x/">`), base), null, "a title's text is not a tag");
});

test("a symlink in id/ is removed as a link, never followed, and a symlinked id/ is refused", () => {
  const root = site();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "design-ids-outside-"));
  fs.writeFileSync(path.join(outside, "keep.txt"), "keep");
  fs.mkdirSync(path.join(root, "id"));
  fs.symlinkSync(outside, path.join(root, "id", A));
  fs.symlinkSync(outside, path.join(root, "id", B));
  const data = MODEL([entity(A, "things/a", "A")]);
  assert.deepEqual(writeIdPages(data, { ...OPTS, root, check: true }).sort(), [`id/${A}`, `id/${A}/index.html`, `id/${B}`].sort());
  writeIdPages(data, { ...OPTS, root });
  assert.deepEqual(fs.readdirSync(outside), ["keep.txt"], "nothing written or removed through a link");
  assert.ok(fs.lstatSync(path.join(root, "id", A)).isDirectory(), "the wanted page is a real folder now");
  assert.ok(!fs.existsSync(path.join(root, "id", B)));
  assert.deepEqual(writeIdPages(data, { ...OPTS, root, check: true }), []);

  const linked = site();
  fs.symlinkSync(outside, path.join(linked, "id"));
  assert.throws(() => writeIdPages(data, { ...OPTS, root: linked }), /symbolic link/);
  assert.throws(() => writeIdPages(data, { ...OPTS, root: linked, check: true }), /symbolic link/);
  assert.deepEqual(fs.readdirSync(outside), ["keep.txt"]);
});

test("a file where an entity's folder belongs is replaced, so the writer heals", () => {
  const root = site();
  fs.mkdirSync(path.join(root, "id"));
  fs.writeFileSync(path.join(root, "id", A), "not a folder");
  const data = MODEL([entity(A, "things/a", "A")]);
  assert.deepEqual(writeIdPages(data, { ...OPTS, root, check: true }).sort(), [`id/${A}`, `id/${A}/index.html`].sort());
  writeIdPages(data, { ...OPTS, root });
  assert.ok(fs.existsSync(path.join(root, "id", A, "index.html")));
  assert.deepEqual(writeIdPages(data, { ...OPTS, root, check: true }), []);
});

test("an id/ that is a file is named once by the check and replaced by the writer, the two agreeing", () => {
  const root = site();
  fs.writeFileSync(path.join(root, "id"), "not a folder");
  const data = MODEL([entity(A, "things/a", "A")]);
  assert.deepEqual(writeIdPages(data, { ...OPTS, root, check: true }).sort(), ["id", `id/${A}/index.html`].sort());
  writeIdPages(data, { ...OPTS, root });
  assert.ok(fs.lstatSync(path.join(root, "id", A, "index.html")).isFile());
  assert.deepEqual(writeIdPages(data, { ...OPTS, root, check: true }), []);
});

test("a page that is a symbolic link is named once, and replaced by a real file", () => {
  const root = site();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "design-ids-outside-"));
  fs.writeFileSync(path.join(outside, "page.html"), "elsewhere");
  fs.mkdirSync(path.join(root, "id", A), { recursive: true });
  fs.symlinkSync(path.join(outside, "page.html"), path.join(root, "id", A, "index.html"));
  const data = MODEL([entity(A, "things/a", "A")]);
  assert.deepEqual(writeIdPages(data, { ...OPTS, root, check: true }), [`id/${A}/index.html`]);
  writeIdPages(data, { ...OPTS, root });
  assert.equal(fs.readFileSync(path.join(outside, "page.html"), "utf8"), "elsewhere", "nothing written through the link");
  assert.ok(fs.lstatSync(path.join(root, "id", A, "index.html")).isFile());
});
