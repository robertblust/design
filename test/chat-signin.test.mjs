// Signing in and out from the chat's command line, in Chromium, against a stand-in for ZITADEL on
// an origin of its own (fixtures/issuer.mjs): /login goes to the hosted login with a PKCE
// challenge and comes back to the page it left, signed in; every message after carries the access
// token; /logout forgets both tokens and ends the session; a token that has lapsed is not sent,
// and the question goes as a visitor's under a line that Sonnet 5 answers.
// Without data-issuer the four words are not the panel's and nothing of this happens.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { TERMINAL } from "./fixtures/terminal.mjs";
import { startIssuer } from "./fixtures/issuer.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const asset = (f) => fs.readFileSync(path.join(PKG, "assets", f));
const page = (attrs) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${TERMINAL}</style><link rel="stylesheet" href="/chat.css"></head>
<body><p>A page.</p><script src="/chat.js" data-chat="/chat" data-model="/model/"${attrs} defer></script></body></html>`;

// What each POST to the chat carried, its body and its Authorization header; `answer` is what the
// next one gets, an answer or a refusal.
const posted = [];
let answer = null;
let server, base, browser, issuer;

before(async () => {
  issuer = await startIssuer();
  const signIn = ` data-issuer="${issuer.url}" data-client="client-1" data-org="org-1" data-project="project-1"`;
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (url === "/chat" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => { body += c; });
      req.on("end", () => {
        posted.push({ body: JSON.parse(body), authorization: req.headers.authorization || null });
        if (answer) { res.writeHead(answer.status, { "content-type": "application/json" }); res.end(JSON.stringify(answer.body)); answer = null; return; }
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end('event: text\ndata: {"text":"An answer."}\n\nevent: done\ndata: {"model":null,"spent":1,"dayLeft":1}\n\n');
      });
      return;
    }
    const files = { "/": ["text/html", page(signIn)], "/deep/page": ["text/html", page(signIn)], "/plain": ["text/html", page("")], "/chat.js": ["text/javascript", asset("chat.js")], "/chat.css": ["text/css", asset("chat.css")] };
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": hit[0] }); res.end(hit[1]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); await issuer.close(); });

async function arrive(address) {
  posted.length = 0; answer = null; issuer.reset();
  const context = await browser.newContext();
  const p = await context.newPage();
  await p.goto(base + address);
  await p.waitForSelector(".rbchat-open", { state: "attached" });
  if (await p.$("section.rbchat:not([hidden])") === null) await p.click(".rbchat-open");
  await p.waitForSelector("section.rbchat:not([hidden]) textarea");
  return { page: p, context };
}
async function type(p, text) {
  await p.fill("section.rbchat textarea", text);
  await p.press("section.rbchat textarea", "Enter");
}
async function ask(p, text) {
  const before = await p.$$eval(".rbchat-assistant, .rbchat-refusal", (a) => a.length);
  await type(p, text);
  await p.waitForFunction((n) => document.querySelectorAll(".rbchat-assistant, .rbchat-refusal").length > n, before);
}
const signin = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("chat-signin") || "null"));
const where = (p) => p.evaluate(() => location.pathname + location.search + location.hash);
// /login, through the stand-in's login and back, until the keys line names the reader.
async function login(p) {
  await type(p, "/login");
  await p.waitForFunction(() => /Tëst Reader/.test((document.querySelector(".rbchat-keys") || {}).textContent || ""), null, { timeout: 10000 });
}

test("/login signs in at the issuer and lands back on the same page, the code gone and the reader named", async () => {
  const { page: p, context } = await arrive("/deep/page?x=1#here");
  await login(p);
  assert.equal(await where(p), "/deep/page?x=1#here");
  assert.doesNotMatch(await p.evaluate(() => location.href), /code=|state=/);
  const a = issuer.seen.authorize[0];
  assert.equal(a.client_id, "client-1");
  assert.equal(a.redirect_uri, base + "/");
  assert.equal(a.scope, "openid profile urn:zitadel:iam:org:project:id:project-1:aud urn:zitadel:iam:org:projects:roles");
  assert.equal(issuer.seen.token.length, 1);
  assert.equal(issuer.seen.token[0].type, "application/x-www-form-urlencoded");
  assert.equal(issuer.seen.token[0].form.redirect_uri, base + "/");
  const s = await signin(p);
  assert.ok(s && s.access && s.id, "both tokens kept");
  assert.equal(await p.evaluate(() => sessionStorage.getItem("chat-pkce")), null, "the verifier is spent");
  assert.equal(await p.$eval("section.rbchat", (x) => x.hidden), false, "the panel is open");
  await context.close();
});

// While the browser waits for the issuer, the page that left cannot be read from here, so the page
// itself notes each spinner as it is drawn, with whether the line still takes anything, in the tab,
// which the round trip keeps.
function noteSpinners() {
  new MutationObserver((ms) => {
    for (const m of ms) for (const n of m.addedNodes) {
      if (!n.classList || !n.classList.contains("rbchat-spin")) continue;
      const seen = JSON.parse(sessionStorage.getItem("spun") || "[]");
      seen.push([n.textContent, document.querySelector("section.rbchat textarea").disabled]);
      sessionStorage.setItem("spun", JSON.stringify(seen));
    }
  }).observe(document, { childList: true, subtree: true });
}

test("/login and /logout show a spinner naming the identity service while the browser waits for it, and the line takes nothing meanwhile", async () => {
  const { page: p, context } = await arrive("/");
  await p.addInitScript(noteSpinners);
  await p.evaluate(noteSpinners);
  const host = new URL(issuer.url).host;
  await login(p);
  await type(p, "/logout");
  await p.waitForFunction(() => location.pathname === "/" && !!document.querySelector(".rbchat-open") && !localStorage.getItem("chat-signin"));
  await p.waitForSelector("section.rbchat:not([hidden]) textarea");
  assert.deepEqual(await p.evaluate(() => JSON.parse(sessionStorage.getItem("spun"))), [["| signing in at " + host + "\u2026 ", true], ["| signing out at " + host + "\u2026 ", true]]);
  assert.equal(await p.$$eval(".rbchat-spin", (s) => s.length), 0, "the page arrived without it");
  await context.close();
});

test("a message signed in carries the access token as a Bearer", async () => {
  const { page: p, context } = await arrive("/");
  await login(p);
  await ask(p, "What is an owner?");
  assert.equal(posted.length, 1);
  assert.equal(posted[0].authorization, "Bearer " + (await signin(p)).access);
  assert.deepEqual(posted[0].body.messages, [{ role: "user", content: "What is an owner?" }]);
  await context.close();
});

test("without data-issuer /login is sent as a question and /help names none of the four words", async () => {
  const { page: p, context } = await arrive("/plain");
  await type(p, "/help");
  await p.waitForSelector(".rbchat-help");
  const help = await p.$eval(".rbchat-help", (h) => h.textContent);
  for (const w of ["/login", "/logout", "/model", "/effort"]) assert.ok(!help.includes(w), w + " offered");
  assert.match(help, /\/new/);
  await ask(p, "/login");
  assert.equal(await where(p), "/plain");
  assert.deepEqual(posted.map((x) => x.body.messages.at(-1).content), ["/login"]);
  assert.equal(posted[0].authorization, null);
  assert.equal(issuer.seen.authorize.length, 0);
  await context.close();
});

test("with data-issuer /help lists the four words, and none of them reaches the chat host", async () => {
  const { page: p, context } = await arrive("/");
  await type(p, "/help");
  await p.waitForSelector(".rbchat-help");
  const help = await p.$eval(".rbchat-help", (h) => h.textContent);
  for (const w of ["/login", "/logout", "/model", "/effort"]) assert.ok(help.includes(w), w + " missing");
  await type(p, "/model");
  await p.waitForSelector(".rbchat-hint");
  assert.equal(await p.$eval(".rbchat-hint", (h) => h.textContent), "Sign in with /login to choose a model.");
  await type(p, "/effort");
  await p.waitForTimeout(200);
  assert.equal(posted.length, 0);
  await context.close();
});

test("in /help every word stands apart from what it does, and every description starts in one column", async () => {
  const { page: p, context } = await arrive("/");
  await type(p, "/help");
  await p.waitForSelector(".rbchat-help");
  // The key's own text, measured by a range: its box fills the grid cell, so its edge would hide an overlap.
  const rows = await p.$$eval(".rbchat-help p", (ps) => ps.map((r) => {
    const k = r.querySelector(".rbchat-help-k"), range = document.createRange();
    range.selectNodeContents(k);
    return { key: k.textContent, keyRight: range.getBoundingClientRect().right, descLeft: r.querySelector(".rbchat-help-d").getBoundingClientRect().left };
  }));
  assert.ok(rows.some((r) => r.key === "/logout") && rows.some((r) => r.key === "/effort"), "the long words are listed");
  for (const r of rows) assert.ok(r.descLeft - r.keyRight >= 4, `${r.key} runs into its description (${r.descLeft - r.keyRight}px apart)`);
  assert.equal(new Set(rows.map((r) => Math.round(r.descLeft))).size, 1, "the descriptions start in one column");
  await context.close();
});

test("/logout forgets the tokens, ends the session at the issuer, and the next message carries none", async () => {
  const { page: p, context } = await arrive("/deep/page");
  await login(p);
  const id = (await signin(p)).id;
  await type(p, "/logout");
  await p.waitForFunction(() => location.pathname === "/" && !!document.querySelector(".rbchat-open"));
  assert.equal(await signin(p), null);
  const e = issuer.seen.endSession[0];
  assert.deepEqual([e.client_id, e.id_token_hint, e.post_logout_redirect_uri], ["client-1", id, base + "/"]);
  await p.waitForSelector("section.rbchat:not([hidden]) textarea");
  assert.doesNotMatch(await p.$eval(".rbchat-keys", (k) => k.textContent), /Tëst Reader/);
  await ask(p, "What is an owner?");
  assert.equal(posted.at(-1).authorization, null);
  await context.close();
});

test("a lapsed token is not sent: the sign-in is forgotten, a line says Sonnet 5 answers, the question goes as a visitor's, and the conversation outlives signing in again", async () => {
  const { page: p, context } = await arrive("/deep/page");
  await login(p);
  await p.evaluate(() => localStorage.setItem("chat-choice", JSON.stringify({ model: "claude-opus-5-5", effort: "low" })));
  await ask(p, "What is an owner?");
  const lapsed = issuer.mint(-60);
  await p.evaluate((t) => { const s = JSON.parse(localStorage.getItem("chat-signin")); s.access = t; localStorage.setItem("chat-signin", JSON.stringify(s)); }, lapsed);
  await ask(p, "And who leads it?");
  assert.equal(posted.length, 2, "the question is sent");
  assert.equal(posted[1].authorization, null, "without the lapsed token");
  assert.equal(posted[1].body.model, undefined, "as a visitor's, with no model");
  assert.equal(await signin(p), null);
  assert.equal(await p.$$eval(".rbchat-refusal", (r) => r.length), 0);
  assert.equal(await p.$eval(".rbchat-hint", (h) => h.textContent), "Your sign-in has expired, so Sonnet 5 answers now. Sign in again with /login to choose a model.");
  assert.doesNotMatch(await p.$eval(".rbchat-keys", (k) => k.textContent), /Tëst Reader|Opus/);
  assert.deepEqual(await p.$$eval(".rbchat-user[data-turn]", (u) => u.map((x) => x.textContent)), ["What is an owner?", "And who leads it?"]);
  await login(p);
  // The return lands on / and then goes back to the page it left; the name shows on both, so the
  // address is read only once the page has arrived, or the read meets the navigation.
  await p.waitForURL((u) => u.pathname === "/deep/page");
  await p.waitForSelector("section.rbchat:not([hidden]) textarea");
  assert.equal(await where(p), "/deep/page");
  assert.equal(await p.$$eval(".rbchat-assistant", (a) => a.length), 2);
  await ask(p, "Once more?");
  assert.equal(posted.length, 3);
  assert.equal(posted[2].authorization, "Bearer " + (await signin(p)).access);
  assert.notEqual((await signin(p)).access, lapsed);
  assert.deepEqual(posted[2].body.messages.map((m) => m.content), ["What is an owner?", "An answer.", "And who leads it?", "An answer.", "Once more?"]);
  await context.close();
});

test("a 401 signed_out from the chat forgets the sign-in, says Sonnet 5 answers, and sends the question again as a visitor's", async () => {
  const { page: p, context } = await arrive("/");
  await login(p);
  await ask(p, "What is an owner?");
  answer = { status: 401, body: { error: { code: "signed_out" } } };
  await ask(p, "And who leads it?");
  assert.equal(await signin(p), null);
  assert.equal(await p.$$eval(".rbchat-refusal", (r) => r.length), 0);
  assert.match(await p.$eval(".rbchat-hint", (h) => h.textContent), /Your sign-in has expired, so Sonnet 5 answers now\./);
  assert.equal(posted.length, 3, "refused once, then sent again");
  assert.match(posted[1].authorization, /^Bearer /);
  assert.equal(posted[2].authorization, null);
  assert.deepEqual(posted[2].body.messages.map((m) => m.content), ["What is an owner?", "An answer.", "And who leads it?"]);
  assert.deepEqual(await p.$$eval(".rbchat-user", (u) => u.map((x) => x.textContent)), ["What is an owner?", "And who leads it?"], "the question shows once");
  await context.close();
});

test("a return whose state does not match is discarded: no exchange, the code gone from the address", async () => {
  const { page: p, context } = await arrive("/");
  await p.evaluate(() => sessionStorage.setItem("chat-pkce", JSON.stringify({ verifier: "v".repeat(43), state: "mine", path: "/deep/page" })));
  await p.goto(base + "/?code=stolen&lang=de&state=theirs#top");
  await p.waitForSelector(".rbchat-open", { state: "attached" });
  await p.waitForFunction(() => !/code=/.test(location.search));
  await p.waitForTimeout(200);
  assert.equal(await where(p), "/?lang=de#top", "the page's own parameters stay");
  assert.equal(issuer.seen.token.length, 0);
  assert.equal(await signin(p), null);
  assert.equal(await p.evaluate(() => sessionStorage.getItem("chat-pkce")), null, "the verifier is dropped with the return");
  await context.close();
});

test("a canceled login comes back to the page it left, says the reader is signed out, and leaves nothing behind", async () => {
  const { page: p, context } = await arrive("/deep/page?x=1#here");
  await ask(p, "What is an owner?");
  issuer.set({ deny: true });
  await type(p, "/login");
  await p.waitForFunction(() => location.pathname === "/deep/page" && !!document.querySelector(".rbchat-refusal"), null, { timeout: 10000 });
  assert.equal(await where(p), "/deep/page?x=1#here");
  assert.match(await p.$eval(".rbchat-refusal", (r) => r.textContent), /You are signed out; sign in again with \/login\./);
  assert.equal(await p.evaluate(() => sessionStorage.getItem("chat-pkce")), null);
  assert.equal(await signin(p), null);
  assert.equal(issuer.seen.token.length, 0);
  assert.deepEqual(await p.$$eval(".rbchat-user[data-turn]", (u) => u.map((x) => x.textContent)), ["What is an owner?"]);
  await context.close();
});

test("a canceled login from the root says so in place, and one with another tab's state does too, without leaving the page", async () => {
  const { page: p, context } = await arrive("/");
  issuer.set({ deny: true });
  await type(p, "/login");
  await p.waitForSelector(".rbchat-refusal", { timeout: 10000 });
  assert.equal(await where(p), "/");
  assert.equal(await p.evaluate(() => sessionStorage.getItem("chat-pkce")), null);
  await p.goto(base + "/?error=access_denied&error_description=No&state=theirs&lang=de");
  await p.waitForSelector(".rbchat-refusal");
  assert.equal(await where(p), "/?lang=de");
  await context.close();
});

test("a kept path that is not a path on this site lands on the root", async () => {
  for (const odd of ["@evil.example/x", "//evil.example/x", "https://evil.example/x"]) {
    const { page: p, context } = await arrive("/");
    await p.evaluate((path) => sessionStorage.setItem("chat-pkce", JSON.stringify({ verifier: "v".repeat(43), state: "mine", path })), odd);
    await p.goto(base + "/deep/page?error=access_denied&state=mine");
    await p.waitForFunction(() => location.pathname === "/" && !!document.querySelector(".rbchat-refusal"), null, { timeout: 10000 });
    assert.equal(await p.evaluate(() => location.origin), base, odd);
    assert.equal(await where(p), "/", odd);
    assert.equal(await p.evaluate(() => sessionStorage.getItem("chat-pkce")), null, odd);
    await context.close();
  }
});
