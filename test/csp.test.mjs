// The content policy a page carries: what it names, where it stands, and that Chromium agrees with
// it, running every inline script the page was written with and refusing one that was not, and
// letting a script send only to the origins the page's chat tag names.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { chromium } from "playwright";

import { policyFor, policyIn, withPolicy, scriptHash } from "../lib/csp.mjs";
import { watchPolicy } from "./fixtures/policy.mjs";

const head = (inner) => `<!doctype html><html lang="en"><head><meta charset="utf-8">${inner}</head><body></body></html>`;

test("a page that runs no script carries no policy, and a JSON or JSON-LD block is no script", () => {
  const page = head('<script type="application/ld+json">{"@type":"Person"}</script><script type="application/json">{}</script>');
  assert.equal(policyFor(page), null);
  assert.equal(withPolicy(page), page);
});

test("each inline script the page runs is named by its hash, once, and a script from a file by 'self'", () => {
  const page = head('<script>var a = 1;</script><script type="module" blocking="render">var b;</script><script>var a = 1;</script><script src="page.js" defer></script>');
  const p = policyFor(page);
  const script = p.split("; ").find((d) => d.startsWith("script-src "));
  assert.equal(script, `script-src 'self' ${[scriptHash("var a = 1;"), scriptHash("var b;")].sort().join(" ")}`);
  assert.match(p, /^default-src 'self'; /);
  assert.match(p, /; object-src 'none'; base-uri 'self'; form-action 'self'$/);
  assert.equal(policyFor(head('<script src="page.js"></script>')).split("; ")[1], "script-src 'self'");
});

test("a script's hash is over its text as the parser hands it on, with every line ending a LF", () => {
  assert.equal(scriptHash("a();\r\nb();\rc();"), scriptHash("a();\nb();\nc();"));
});

test("a script may send to the page's own origin and to the chat host and the identity service its chat tag names, and nowhere else", () => {
  const chat = '<script src="chat.js" data-chat="https://chat.example.test/chat" data-issuer="https://id.example.test" data-client="1"></script>';
  assert.match(policyFor(head(chat)), /; connect-src 'self' https:\/\/chat\.example\.test https:\/\/id\.example\.test; /);
  assert.match(policyFor(head('<script src="chat.js" data-chat="/chat"></script>')), /; connect-src 'self'; /);
  assert.match(policyFor(head('<script src="page.js"></script>')), /; connect-src 'self'; /);
});

test("the policy is written right after <meta charset>, replaced in place, and taken out once the page runs no script", () => {
  const page = head("<title>T</title><script>go();</script>");
  const once = withPolicy(page);
  assert.ok(once.startsWith('<!doctype html><html lang="en"><head><meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="'));
  assert.equal(policyIn(once), policyFor(page));
  assert.equal(withPolicy(once), once, "a second run changes nothing");
  const edited = once.replace("go();", "went();");
  assert.equal(policyIn(withPolicy(edited)), policyFor(edited));
  assert.notEqual(policyIn(withPolicy(edited)), policyIn(once));
  assert.equal(withPolicy(once.replace("<script>go();</script>", "")), page.replace("<script>go();</script>", ""));
});

test("a page that runs a script and has no <meta charset> is refused, since the policy would have no place before the scripts", () => {
  assert.throws(() => withPolicy("<!doctype html><html><head><script>go();</script></head></html>"), /meta charset/);
  assert.throws(() => withPolicy('<!doctype html><html><head><script>go();</script><meta charset="utf-8"></head></html>'), /before <meta charset>/);
});

let server, other, base, elsewhere, browser, refused;
const served = new Map();
before(async () => {
  const listen = (s) => new Promise((r) => s.listen(0, "127.0.0.1", r)).then(() => `http://127.0.0.1:${s.address().port}`);
  server = http.createServer((req, res) => {
    const hit = served.get(req.url);
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": hit[0] }); res.end(hit[1]);
  });
  other = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" }); res.end("ok");
  });
  base = await listen(server);
  elsewhere = await listen(other);
  browser = await chromium.launch();
  refused = watchPolicy(browser);
});
after(async () => {
  await browser.close();
  await new Promise((r) => server.close(r));
  await new Promise((r) => other.close(r));
});

test("Chromium runs the page's own inline and file scripts and refuses a script the policy does not name", async () => {
  const page = withPolicy(head('<script>window.ran = ["inline"];</script><script src="/own.js"></script>'));
  served.set("/", ["text/html", page.replace("</body>", "<script>window.ran.push(\"injected\");</script></body>")]);
  served.set("/own.js", ["text/javascript", 'window.ran.push("file");']);
  refused.length = 0;
  const p = await browser.newPage();
  await p.goto(base + "/");
  assert.deepEqual(await p.evaluate(() => window.ran), ["inline", "file"]);
  assert.equal(refused.length, 1);
  assert.match(refused[0], /inline script/);
  await p.close();
});

test("Chromium lets a script send to an origin the chat tag names and refuses one it does not", async () => {
  const tag = (chat) => `<script src="/chat.js" data-chat="${chat}/chat"></script>`;
  served.set("/chat.js", ["text/javascript", ""]);
  const send = (to) => `<script>fetch(${JSON.stringify(to)}).then(() => document.title = "sent", () => document.title = "refused");</script>`;
  for (const [named, expect] of [[elsewhere, "sent"], ["https://chat.example.test", "refused"]]) {
    served.set("/send", ["text/html", withPolicy(head(tag(named) + send(elsewhere + "/x")))]);
    refused.length = 0;
    const p = await browser.newPage();
    await p.goto(base + "/send");
    await p.waitForFunction(() => document.title !== "");
    assert.equal(await p.title(), expect);
    assert.equal(refused.some((m) => /connect-src/.test(m)), expect === "refused");
    await p.close();
  }
});
