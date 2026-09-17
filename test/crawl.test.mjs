// Both ways of getting these wrong are silent. A page left out of a ping is never recrawled and a
// stale lastmod is never noticed, while unchanged pages sent on every deploy, or dates a page does
// not bear, teach the engines to distrust the site. Nothing anywhere shows either as an error, so
// the rule for what changed is held here, against real git history in a throwaway repository.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  sitemapLocs, pageFile, stageData, pageInputs, changedUrls, withLastmod, findKey, indexnow, sitemapDates,
} from "../lib/crawl.mjs";

const CLI = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "bin", "design.mjs");
const KEY = "0123456789abcdef0123456789abcdef";
const S = "https://x.test";

test("the sitemap's URLs are read in order", () => {
  const xml = `<urlset>\n  <url><loc>${S}/</loc></url>\n  <url><loc> ${S}/talks/ </loc><priority>1</priority></url>\n</urlset>`;
  assert.deepEqual(sitemapLocs(xml), [`${S}/`, `${S}/talks/`]);
});

test("a URL is served from its directory's index.html", () => {
  assert.equal(pageFile(`${S}/`), "index.html");
  assert.equal(pageFile(`${S}/talks/intro/`), "talks/intro/index.html");
});

test("a page's stage data is whatever its link names, resolved from the page", () => {
  // companygraph.io's /example/ draws example.json, not model.json: a rule naming the model file
  // would have missed every change to that page's data.
  const link = (href) => `<link rel="preload" as="fetch" href="${href}" data-stage crossorigin>`;
  assert.equal(stageData("example/index.html", link("../example.json")), "example.json");
  assert.equal(stageData("model/index.html", link("../model.json")), "model.json");
  assert.equal(stageData("index.html", link("data/model.json")), "data/model.json");
  assert.equal(stageData("model/index.html", link("https://cdn.test/model.json")), null);
  assert.equal(stageData("index.html", `<link rel="preload" href="../model.json">`), null,
    "a preload without data-stage is not the page's data");
  assert.deepEqual(pageInputs(`${S}/`, "<main>prose</main>"), ["index.html"]);
  assert.deepEqual(pageInputs(`${S}/`, null), ["index.html"], "a page whose HTML is gone is dated by its file alone");
});

test("a URL changed when any of its inputs did, in sitemap order and once", () => {
  const inputs = {
    [`${S}/`]: ["index.html"],
    [`${S}/model/`]: ["model/index.html", "model.json"],
    [`${S}/example/`]: ["example/index.html", "example.json"],
  };
  assert.deepEqual(changedUrls({ changed: ["stage.css", "og.png"], inputs }), []);
  assert.deepEqual(changedUrls({ changed: ["example.json"], inputs }), [`${S}/example/`]);
  assert.deepEqual(changedUrls({ changed: ["model.json", "index.html", "model/index.html"], inputs }), [`${S}/`, `${S}/model/`]);
  assert.deepEqual(changedUrls({ changed: ["docs/index.html"], inputs }), [], "a page outside the sitemap is not sent");
});

test("lastmod goes right after loc, and writing it again changes nothing", () => {
  const xml = `<urlset>\n  <url><loc>${S}/</loc><priority>1.0</priority></url>\n  <url><loc>${S}/a/</loc></url>\n</urlset>\n`;
  const once = withLastmod(xml, { [`${S}/`]: "2026-09-01" });
  assert.equal(once, `<urlset>\n  <url><loc>${S}/</loc><lastmod>2026-09-01</lastmod><priority>1.0</priority></url>\n  <url><loc>${S}/a/</loc></url>\n</urlset>\n`);
  assert.equal(withLastmod(once, { [`${S}/`]: "2026-09-01" }), once);
  const moved = withLastmod(once, { [`${S}/`]: "2026-09-05" });
  assert.equal((moved.match(/<lastmod>/g) || []).length, 1);
  assert.ok(moved.includes("<lastmod>2026-09-05</lastmod>"));
});

test("the key is the one root file named for its contents", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "crawl-key-"));
  fs.writeFileSync(path.join(dir, "robots.txt"), "User-agent: *");
  assert.throws(() => findKey(dir), /found 0/);
  fs.writeFileSync(path.join(dir, `${KEY}.txt`), `${KEY}\n`);
  assert.equal(findKey(dir), KEY);
  fs.writeFileSync(path.join(dir, "fedcba9876543210fedcba9876543210.txt"), "something else");
  assert.equal(findKey(dir), KEY, "a file whose contents are not its name is not a key");
});

// A site in a throwaway repository, committed on fixed days so every date is known.
function site() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crawl-site-"));
  const git = (args, date) => execFileSync("git", args, {
    cwd: root, encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@x.test", GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@x.test", GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  }).trim();
  const write = (rel, body) => {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  };
  const commit = (date) => { git(["add", "-A"], date); git(["commit", "-qm", date], date); return git(["rev-parse", "HEAD"], date); };
  git(["init", "-q"], "2026-09-01T12:00:00Z");
  write("CNAME", "x.test\n");
  write(`${KEY}.txt`, KEY);
  write("sitemap.xml", `<urlset>\n  <url><loc>${S}/</loc></url>\n  <url><loc>${S}/example/</loc></url>\n</urlset>\n`);
  write("index.html", "<main>one</main>");
  write("example/index.html", `<link rel="preload" as="fetch" href="../example.json" data-stage crossorigin>`);
  write("example.json", "{}");
  write("stage.css", "a{}");
  const first = commit("2026-09-01T12:00:00Z");
  write("example.json", `{"v":2}`);
  const second = commit("2026-09-03T23:30:00+02:00"); // 21:30 UTC, still the 3rd
  write("stage.css", "b{}");
  const third = commit("2026-09-05T12:00:00Z");
  return { root, write, first, second, third };
}

test("indexnow sends a page when its data changed, and nothing for a shared file", async () => {
  const { root, first, second, third } = site();
  const log = () => {};
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { status: 202, text: async () => "" }; };

  assert.deepEqual(await indexnow({ root, base: first, head: second, fetchImpl, log }), [`${S}/example/`]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, { host: "x.test", key: KEY, keyLocation: `https://x.test/${KEY}.txt`, urlList: [`${S}/example/`] });

  assert.deepEqual(await indexnow({ root, base: second, head: third, fetchImpl, log }), []);
  assert.equal(calls.length, 1, "a range that touches no page sends nothing");

  assert.deepEqual(await indexnow({ root, base: first, head: second, dryRun: true, fetchImpl, log }), [`${S}/example/`]);
  assert.equal(calls.length, 1, "a dry run sends nothing");
});

test("indexnow fails on a refusal rather than reporting success", async () => {
  const { root, first, second } = site();
  const fetchImpl = async () => ({ status: 403, text: async () => "key not found" });
  await assert.rejects(indexnow({ root, base: first, head: second, fetchImpl, log: () => {} }), /403: key not found/);
});

test("each page is dated by its last change in UTC, and an uncommitted edit by today", () => {
  const { root, write } = site();
  const { dates } = sitemapDates({ root, today: "2026-09-17" });
  assert.deepEqual(dates, { [`${S}/`]: "2026-09-01", [`${S}/example/`]: "2026-09-03" });
  write("index.html", "<main>two</main>");
  assert.equal(sitemapDates({ root, today: "2026-09-17" }).dates[`${S}/`], "2026-09-17");
});

test("sitemap --check is red until the dates are written, then green", () => {
  const { root } = site();
  const run = (...args) => { try { return { code: 0, out: execFileSync("node", [CLI, ...args], { cwd: root, encoding: "utf8" }) }; } catch (e) { return { code: e.status, out: e.stdout }; } };
  const red = run("sitemap", "--check");
  assert.equal(red.code, 1);
  assert.match(red.out, /https:\/\/x\.test\/example\/ {2}last changed 2026-09-03/);
  assert.equal(run("sitemap").code, 0);
  assert.equal(run("sitemap", "--check").code, 0);
});

test("dates refuse a shallow clone, where every page would share one commit", () => {
  const { root } = site();
  const shallow = fs.mkdtempSync(path.join(os.tmpdir(), "crawl-shallow-"));
  execFileSync("git", ["clone", "-q", "--depth", "1", `file://${root}`, shallow]);
  assert.throws(() => sitemapDates({ root: shallow }), /full history/);
});
