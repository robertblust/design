// How an external link is judged. The web answers a script in more ways than a browser sees, and
// a checker that calls a working page broken is a checker whose issue gets closed unread, so every
// answer that says nothing about the page is kept apart from the few that do.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { verdict, judge, judgeAll } from "../verify/links/judge.mjs";

let base, server, refused;
const hits = new Map();
before(async () => {
  server = http.createServer((req, res) => {
    const n = (hits.get(req.url) ?? 0) + 1;
    hits.set(req.url, n);
    const send = (status) => { res.writeHead(status); res.end(); };
    switch (req.url) {
      case "/ok": return send(200);
      case "/moved": res.writeHead(301, { location: "/ok" }); return res.end();
      case "/gone": return send(404);
      case "/removed": return send(410);
      case "/forbidden": return send(403);
      case "/linkedin": return send(999);
      case "/head-405": return send(req.method === "HEAD" ? 405 : 200);
      case "/head-404": return send(req.method === "HEAD" ? 404 : 200);
      case "/flaky": return send(n <= 2 ? 500 : 200);
      case "/down": return send(503);
      case "/never": return; // holds the request open
      default: return send(404);
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  const closed = http.createServer();
  await new Promise((r) => closed.listen(0, "127.0.0.1", r));
  refused = `http://127.0.0.1:${closed.address().port}/`;
  await new Promise((r) => closed.close(r));
});
after(() => new Promise((r) => { server.closeAllConnections(); server.close(r); }));

test("a status is ok, broken or unverifiable", () => {
  for (const s of [200, 204, 301, 304]) assert.equal(verdict(s), "ok", String(s));
  for (const s of [404, 410]) assert.equal(verdict(s), "broken", String(s));
  for (const s of [400, 401, 403, 405, 429, 500, 503, 999]) assert.equal(verdict(s), "unverifiable", String(s));
});

test("each kind of answer is sorted into its kind", async () => {
  const at = async (p, o) => { const v = await judge(base + p, o); return [v.kind, v.answer]; };
  assert.deepEqual(await at("/ok"), ["ok", "200"]);
  assert.deepEqual(await at("/moved"), ["ok", "200"], "judged after redirects");
  assert.deepEqual(await at("/gone"), ["broken", "404"]);
  assert.deepEqual(await at("/removed"), ["broken", "410"]);
  assert.deepEqual(await at("/forbidden"), ["unverifiable", "403"]);
  assert.deepEqual(await at("/linkedin"), ["unverifiable", "999"]);
  assert.deepEqual(await at("/down"), ["unverifiable", "503"]);
  assert.deepEqual(await at("/head-405"), ["ok", "200"], "a host that refuses HEAD is asked with GET");
  assert.deepEqual(await at("/head-404"), ["ok", "200"], "broken is the GET's word, never HEAD's");
  assert.deepEqual(await at("/never", { timeoutMs: 200 }), ["unverifiable", "timeout"]);
  const r = await judge(refused);
  assert.deepEqual([r.kind, r.answer], ["unverifiable", "ECONNREFUSED"]);
  const n = await judge("http://no-such-host.invalid/");
  assert.deepEqual([n.kind, n.answer], ["broken", "no such host"]);
});

test("a link that fails once is asked once more, and a link that is fine is asked once", async () => {
  hits.clear();
  assert.equal((await judge(`${base}/flaky`)).kind, "ok");
  assert.equal(hits.get("/flaky"), 3, "HEAD and GET, then HEAD again, which says yes");
  await judge(`${base}/ok`);
  assert.equal(hits.get("/ok"), 1);
});

test("one request per host at a time, and no more than four at once", async () => {
  let now = 0, most = 0;
  const perHost = new Map(), mostPerHost = new Map();
  const judgeOne = async (url) => {
    const host = new URL(url).host;
    now++; most = Math.max(most, now);
    perHost.set(host, (perHost.get(host) ?? 0) + 1);
    mostPerHost.set(host, Math.max(mostPerHost.get(host) ?? 0, perHost.get(host)));
    await new Promise((r) => setTimeout(r, 5));
    now--; perHost.set(host, perHost.get(host) - 1);
    return { url };
  };
  const urls = [];
  for (let h = 0; h < 7; h++) for (let i = 0; i < 3; i++) urls.push(`https://h${h}.test/${i}`);
  const out = await judgeAll(urls.reverse(), { judgeOne });
  assert.equal(most, 4);
  for (const [host, m] of mostPerHost) assert.equal(m, 1, host);
  assert.deepEqual(out.map((v) => v.url), [...urls].sort());
});
