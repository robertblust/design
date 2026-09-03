// pinDrift against a fake fetch, never the network: a test that reaches GitHub fails on an
// aeroplane and passes for the wrong reason behind a proxy.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { pinDrift, pinReport } from "../verify/pin.mjs";

function site(commit = "abc1234def", repo = "robertblust/mental-model") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pin-"));
  fs.writeFileSync(path.join(root, "source.json"), JSON.stringify({ repo, commit }));
  return root;
}
const reply = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });
// The compare URL contains the repo path too, so a fake that matched on the repo fragment
// answered both calls with the metadata reply and reported every pin as current. It dispatches
// on the more specific path first.
function fakeFetch({ repo, compare }) {
  return async (url) => {
    if (url.includes("/compare/")) return compare ?? reply({}, false, 404);
    return repo ?? reply({}, false, 404);
  };
}
const lines = () => { const out = []; return { out, log: (s) => out.push(s) }; };

test("a pin level with its upstream reports no drift", async () => {
  const d = await pinDrift({ root: site(), env: {}, fetchImpl: fakeFetch({ repo: reply({ default_branch: "main" }), compare: reply({ ahead_by: 0, html_url: "https://x/compare", commits: [] }) })});
  assert.equal(d.behind, 0);
  const { out, log } = lines();
  assert.equal(pinReport(d, log), 0);
  assert.match(out[0], /pin is current/);
  assert.equal(out.some((l) => l.startsWith("::notice")), false);
});

test("a pin behind its upstream reports how far, and never fails", async () => {
  const d = await pinDrift({ root: site(), env: {}, fetchImpl: fakeFetch({ repo: reply({ default_branch: "main" }), compare: reply({ ahead_by: 3, html_url: "https://x/compare",
      commits: [{ commit: { message: "one" } }, { commit: { message: "two" } },
                { commit: { message: "Correct the UBS chronology\n\nbody" } }] }) })});
  assert.equal(d.behind, 3);
  const { out, log } = lines();
  // Reports the distance; the caller decides what to do, and CI is told to do nothing.
  assert.equal(pinReport(d, log), 3);
  assert.match(out[0], /^::notice title=Model pin is 3 commits behind::/);
  // The newest subject only — a commit body in an annotation is a wall of text.
  assert.match(out[0], /Newest: Correct the UBS chronology/);
  assert.equal(out[0].includes("body"), false);
});

test("one commit behind says commit, not commits", async () => {
  const d = await pinDrift({ root: site(), env: {}, fetchImpl: fakeFetch({ repo: reply({ default_branch: "main" }), compare: reply({ ahead_by: 1, html_url: "https://x/c", commits: [{ commit: { message: "one" } }] }) })});
  const { out, log } = lines();
  pinReport(d, log);
  assert.match(out[0], /1 commit behind/);
});

test("a pin the upstream no longer holds is said out loud, not reported as current", async () => {
  const d = await pinDrift({ root: site(), env: {}, fetchImpl: fakeFetch({ repo: reply({ default_branch: "main" }) })});  // the compare 404s: a force-push, a rewritten history
  assert.match(d.unreachable, /HTTP 404 comparing abc1234/);
  const { out, log } = lines();
  assert.equal(pinReport(d, log), 0);
  assert.match(out[0], /could not be checked/);
});

test("an unreachable API is a notice and a pass, never a failure", async () => {
  const d = await pinDrift({ root: site(), env: {}, fetchImpl: async () => reply({}, false, 503) });
  assert.match(d.unreachable, /HTTP 503/);
  assert.equal(pinReport(d, () => {}), 0);
});

test("a token is sent when the environment has one, and never otherwise", async () => {
  const seen = [];
  const spy = async (url, opts) => { seen.push(opts.headers.authorization); return reply({ default_branch: "main" }); };
  await pinDrift({ root: site(), env: { GITHUB_TOKEN: "t0ken" }, fetchImpl: spy });
  assert.equal(seen[0], "Bearer t0ken");
  seen.length = 0;
  await pinDrift({ root: site(), env: {}, fetchImpl: spy });
  assert.equal(seen[0], undefined);
});
