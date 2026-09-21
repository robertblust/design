// The one issue a site keeps about its external links. It is the only place a broken reference is
// reported, so each way it can go wrong (a second issue, a stale body, one left open after the
// links were fixed) is a way the report stops being read.
import { test } from "node:test";
import assert from "node:assert/strict";

import { ISSUE_TITLE, issueBody, syncIssue } from "../verify/links/issue.mjs";

const REPORT = {
  ok: [],
  broken: [{ url: "https://example.org/gone|x", kind: "broken", answer: "404", from: ["/", "model.json · a"] }],
  unverifiable: [{ url: "https://www.linkedin.com/in/x", kind: "unverifiable", answer: "999", from: ["/"] }],
};
const CLEAN = { ok: [{ url: "https://example.org/", kind: "ok", answer: "200", from: ["/"] }], broken: [], unverifiable: [] };

// A GitHub that records every call and answers from `issues`.
function github(issues) {
  const calls = [];
  const apiFetch = async (url, init = {}) => {
    const method = init.method ?? "GET";
    calls.push({ method, path: new URL(url).pathname + new URL(url).search, body: init.body && JSON.parse(init.body), auth: init.headers?.authorization });
    const json = method === "GET" ? issues : method === "POST" && url.endsWith("/issues") ? { number: 7 } : {};
    return new Response(JSON.stringify(json), { status: method === "POST" ? 201 : 200 });
  };
  return { calls, apiFetch };
}

const opts = (apiFetch) => ({ repo: "o/r", token: "t", runUrl: "https://github.com/o/r/actions/runs/1", date: "2026-09-28", apiFetch, log: () => {} });

test("the body lists what is broken and what could not be verified, with where each was found", () => {
  const body = issueBody(REPORT, { runUrl: "https://github.com/o/r/actions/runs/1", date: "2026-09-28" });
  assert.match(body, /2026-09-28/);
  assert.match(body, /\[the run\]\(https:\/\/github\.com\/o\/r\/actions\/runs\/1\)/);
  assert.match(body, /## Broken\n/);
  assert.match(body, /\| https:\/\/example\.org\/gone\\\|x \| 404 \| \/<br>model\.json · a \|/, "a pipe in a URL is escaped");
  assert.match(body, /## Unverifiable\n/);
  assert.match(body, /\| https:\/\/www\.linkedin\.com\/in\/x \| 999 \| \/ \|/);
  assert.doesNotMatch(issueBody({ broken: REPORT.broken, unverifiable: [] }, { date: "d" }), /Unverifiable/);
});

test("a broken link opens the issue when there is none", async () => {
  const gh = github([{ number: 3, title: "Something else" }, { number: 4, title: ISSUE_TITLE, pull_request: {} }]);
  assert.deepEqual(await syncIssue({ report: REPORT, ...opts(gh.apiFetch) }), { action: "opened", number: 7 });
  assert.deepEqual(gh.calls.map((c) => [c.method, c.path]), [["GET", "/repos/o/r/issues?state=open&per_page=100"], ["POST", "/repos/o/r/issues"]]);
  assert.equal(gh.calls[1].body.title, ISSUE_TITLE);
  assert.equal(gh.calls[1].auth, "Bearer t");
});

test("a broken link rewrites the issue that is open", async () => {
  const gh = github([{ number: 5, title: ISSUE_TITLE }]);
  assert.deepEqual(await syncIssue({ report: REPORT, ...opts(gh.apiFetch) }), { action: "updated", number: 5 });
  assert.deepEqual(gh.calls.map((c) => [c.method, c.path]), [["GET", "/repos/o/r/issues?state=open&per_page=100"], ["PATCH", "/repos/o/r/issues/5"]]);
  assert.match(gh.calls[1].body.body, /## Broken/);
});

test("a run with nothing broken closes the open issue with a comment, and otherwise touches nothing", async () => {
  const gh = github([{ number: 5, title: ISSUE_TITLE }]);
  assert.deepEqual(await syncIssue({ report: CLEAN, ...opts(gh.apiFetch) }), { action: "closed", number: 5 });
  assert.deepEqual(gh.calls.map((c) => [c.method, c.path]), [
    ["GET", "/repos/o/r/issues?state=open&per_page=100"],
    ["POST", "/repos/o/r/issues/5/comments"],
    ["PATCH", "/repos/o/r/issues/5"],
  ]);
  assert.match(gh.calls[1].body.body, /2026-09-28/);
  assert.deepEqual(gh.calls[2].body, { state: "closed", state_reason: "completed" });

  const quiet = github([]);
  assert.deepEqual(await syncIssue({ report: CLEAN, ...opts(quiet.apiFetch) }), { action: "none" });
  assert.equal(quiet.calls.length, 1);
});

test("a refusal from GitHub is an error, not a quiet run", async () => {
  const apiFetch = async () => new Response("Resource not accessible by integration", { status: 403 });
  await assert.rejects(syncIssue({ report: REPORT, ...opts(apiFetch) }), /GitHub answered 403 to GET/);
});
