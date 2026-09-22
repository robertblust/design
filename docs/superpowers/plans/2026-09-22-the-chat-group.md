# The Chat Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the chat widget as a `chat` group of this package, two whole files a site copies, so that a prose page on blust.ch or companygraph.io shows a button at the bottom right that opens a panel over the site's chat service, streams the answer as a rendered Markdown subset, links the cites into the model page, and stores nothing; release it as v0.75.0.

**Architecture:** `assets/chat.js` is one script with no dependency, in the style of `card.js`: an IIFE that reads its own tag's `data-chat` (the endpoint) and `data-model` (the model page the cites link into), builds the button and, on first open, the panel; holds the conversation in memory only; posts to the endpoint with the `X-Chat` header and reads the answer's server-sent events from the response stream; renders the accumulated text through a Markdown-subset renderer that escapes first; takes the language from `<html lang>` at every render and the theme from the tokens. Its pure parts, the renderer and the event reader, hang on `window.rbChat` so the suite tests them in Node with a stub `window`. `assets/chat.css` styles it from the tokens. `lib/groups.mjs` names the group; the README's rule gains the exception the spec states.

**Tech Stack:** plain ES5-style browser JavaScript as `card.js` is written, `fetch` with a streamed body and `TextDecoder`; the family's tokens; `node:test`.

**Spec:** `companygraph/chat-server`'s `docs/superpowers/specs/2026-09-22-chat-server-design.md`, §3 (the events and the codes), §7 (the widget), §8 (the README rule); the chat server's `docs/INTERFACE.md` at v0.4.0 is the contract the widget reads.

## Global Constraints

- The group is two files, `assets/chat.js` → `chat.js` and `assets/chat.css` → `chat.css` at a site's root. A page that carries no `data-chat` on the script tag shows nothing.
- The widget loads nothing and sends nothing until the visitor opens it and presses send; it writes no key to `localStorage`, `sessionStorage` or a cookie, since the sites' privacy pages list every key and a page check drives the page and fails on an undeclared write.
- The request is `POST <data-chat>` with `content-type: application/json` and `X-Chat: 1`, body `{ messages: [{ role, content }…], lang }`; a user message is at most 1,000 characters; the conversation sent is the whole one held; the widget offers a new conversation after 20 messages.
- The events are `text` `{ text }`, `cite` `{ id, title, type, url }`, `done` `{ model, spent, dayLeft, cut? }`, `error` `{ error: { code, message } }`; a refusal before the stream is JSON with a status and the same error shape; a 413 is plain text. Every code has a sentence in both languages inside the block: `too_long`, `busy`, `over_day`, `over_month`, `closed`, `host_down`, `foreign`, `bad_request`, `internal`, and one for a network failure.
- The Markdown subset rendered: paragraphs, `**bold**`, `*italic*` and `_italic_`, `` `code` ``, bulleted (`- `, `* `) and numbered (`1. `) lists, pipe tables with a delimiter row. Everything is HTML-escaped before any of it is applied; no raw HTML, no links, no images, no headings, no code blocks are rendered, and text that looks like them stays text.
- Cites are rendered under the answer as links to `<data-model>#<id>`, in the order received.
- The language is `document.documentElement.lang === "de" ? "de" : "en"`, read at every render; German strings are drafts for the translator's review, marked as such in the report.
- Every file's header comment says why in the family's voice; every Markdown paragraph is one line; `sh conventions/conventions-check` and `sh conventions/conventions-format check` exit 0 before each commit; commits in the git register with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- `npm test` (this package's suite) passes; `export PATH=/opt/homebrew/bin:$PATH` before every `node` or `npm` command; work in `/Users/rob/git/robertblust/design-the-chat-group` on branch `the-chat-group` (`npm ci` first).
- The pull request is opened and it stops there.

---

### Task 1: The group is named, and the rule gains its exception

**Files:**

- Modify: `lib/groups.mjs`, `test/groups.test.mjs`, `README.md`

- [ ] **Step 1: Failing tests.** In `test/groups.test.mjs` change the first test to expect `["chat", "fonts", "stage"]` and add:

```js
test("the chat group carries the widget's script and stylesheet", () => {
  const dests = GROUPS.chat.map(([, to]) => to).sort();
  assert.deepEqual(dests, ["chat.css", "chat.js"]);
});
```

Run `npm test`: the two fail.

- [ ] **Step 2: lib/groups.mjs.** After the `stage` entry add:

```js
  // The chat: a button at the foot of a prose page and the panel it opens over the site's chat
  // service. Two whole files and no fence, since the page adds one script tag and nothing inside
  // it. guestgraph.io serves no chat and takes no group; a site that does names the endpoint on
  // the tag, `<script src="chat.js" data-chat="https://chat.example/chat" data-model="/model/" defer>`.
  chat: [
    ["assets/chat.js",  "chat.js"],
    ["assets/chat.css", "chat.css"],
  ],
```

Create empty placeholders `assets/chat.js` and `assets/chat.css` so the existence test passes; Tasks 2 and 3 fill them. Run `npm test`: green.

- [ ] **Step 3: README.md.** In "In a site", after the paragraph about the stage's three scripts, add one paragraph: "A page that offers the chat loads one more script, `chat.js`, with the endpoint and the model page on its own tag, `<script src="chat.js" data-chat="https://chat.blust.ch/chat" data-model="/model/" defer>`, and links `chat.css` beside its stylesheet; a tag without `data-chat` shows nothing. The button, the panel and every sentence the widget writes are the package's, in both languages; a site adds nothing but the tag." Under "The rule", after the sentence "So this package is never a runtime dependency of a published page", add: "A page may call a service, and one does: the chat's script posts to the chat host the site names on its tag, and only after a visitor has opened the panel and pressed send. It is the one runtime call a page of this family makes, it goes to a host the family runs, and it is written down here so that it stays the one."

- [ ] **Step 4: Commit.**

```sh
git add lib/groups.mjs test/groups.test.mjs README.md assets/chat.js assets/chat.css
git commit -F - <<'EOF'
The chat is a group a site takes

A prose page on a site that runs the chat shows a button that opens a panel over the site's chat service, and the button, the panel and every sentence they write are the package's, so that two sites carry identical bytes and guestgraph.io, which serves no chat, takes no group. The group is named, with the two files it will hold, and the README's rule that a page never depends on this package at runtime gains its one exception, written down: a page may call the chat host the site names on the tag, after a visitor acts.

Verified: npm test passes; conventions-check and conventions-format check exit 0.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: The script

**Files:**

- Create: `assets/chat.js` (replacing the placeholder)
- Test: `test/chat.test.mjs`

**Interfaces:**

- Produces: `window.rbChat = { md, readEvents, strings }` where `md(text) → html`, `readEvents(response, onEvent) → Promise` reading a `text/event-stream` body and calling `onEvent(name, data)` per event, `strings(lang) → object`.

- [ ] **Step 1: Failing tests.** `test/chat.test.mjs`:

```js
// The widget's pure parts, run in Node with a stub window: the Markdown subset it renders and
// the event stream it reads. The button and the panel need a browser and are looked at, not
// tested here; the rendering check in the review does that.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(PKG, "assets", "chat.js"), "utf8");

// No document.currentScript, so the script attaches its pure parts and touches no DOM.
globalThis.window = globalThis;
globalThis.document = { currentScript: null, documentElement: { lang: "en" } };
new Function(src)();
const { md, readEvents, strings } = globalThis.rbChat;

test("the subset renders, and everything is escaped first", () => {
  assert.equal(md("One **bold** and *it* and `x<y`."), "<p>One <strong>bold</strong> and <em>it</em> and <code>x&lt;y</code>.</p>");
  assert.equal(md("a\n\nb"), "<p>a</p><p>b</p>");
  assert.equal(md("- one\n- two"), "<ul><li>one</li><li>two</li></ul>");
  assert.equal(md("1. one\n2. two"), "<ol><li>one</li><li>two</li></ol>");
  assert.equal(md("| a | b |\n| --- | --- |\n| 1 | 2 |"), "<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>");
  assert.equal(md("<script>x</script>"), "<p>&lt;script&gt;x&lt;/script&gt;</p>");
  assert.equal(md("# not a heading"), "<p># not a heading</p>");
  assert.equal(md("[a link](https://x)"), "<p>[a link](https://x)</p>");
  assert.equal(md("a * b * c"), "<p>a * b * c</p>", "a lone star is a star");
  assert.equal(md(""), "");
});

test("a table with no delimiter row is prose, and a half-typed table is prose until it closes", () => {
  assert.equal(md("| a | b |"), "<p>| a | b |</p>");
  assert.equal(md("| a | b |\n| ---"), "<p>| a | b | | ---</p>");
});

test("the stream is read event by event, across chunk boundaries", async () => {
  const chunks = ['event: text\ndata: {"text":"Hel', 'lo"}\n\nevent: cite\ndata: {"id":"i","title":"T","type":"skill","url":"u"}\n\nevent: do', 'ne\ndata: {"spent":1}\n\n'];
  const enc = new TextEncoder();
  let i = 0;
  const body = { getReader: () => ({ read: async () => (i < chunks.length ? { value: enc.encode(chunks[i++]), done: false } : { value: undefined, done: true }) }) };
  const got = [];
  await readEvents({ body }, (name, data) => got.push([name, data]));
  assert.deepEqual(got, [["text", { text: "Hello" }], ["cite", { id: "i", title: "T", type: "skill", url: "u" }], ["done", { spent: 1 }]]);
});

test("every code has a sentence in both languages, and the language falls back to English", () => {
  const codes = ["too_long", "busy", "over_day", "over_month", "closed", "host_down", "foreign", "bad_request", "internal", "network"];
  for (const lang of ["en", "de"]) for (const c of codes) assert.equal(typeof strings(lang).refusal[c], "string", `${lang} ${c}`);
  assert.equal(strings("fr").send, strings("en").send);
  assert.notEqual(strings("de").send, strings("en").send);
});
```

Run `npm test`: fails (`rbChat` undefined).

- [ ] **Step 2: assets/chat.js.** Write it whole:

```js
// The chat: a button at the foot of a prose page and the panel it opens over the site's chat
// service. Synced whole, like card.js, and it knows no page: the endpoint and the model page
// come off its own tag, the language off <html lang> at every render, the colors off the tokens.
//
//   <script src="chat.js" data-chat="https://chat.example/chat" data-model="/model/" defer>
//
// Nothing loads and nothing is sent until a visitor opens the panel and presses send, and
// nothing is stored: the conversation lives in this closure and goes with the page. The answer
// arrives as server-sent events and is rendered as it comes, through a Markdown subset the
// model is told to write and nothing outside it — paragraphs, emphasis, code spans, lists,
// tables — after every character has been escaped, so text that looks like markup stays text.
// Every sentence the widget writes is here, in both languages, so a refusal costs no tokens.
//
//   rbChat.md(text)                    the subset, rendered
//   rbChat.readEvents(response, fn)    the stream, one fn(name, data) per event
//   rbChat.strings(lang)               the sentences
(function(){
  var LIMIT = 1000, TURNS = 20;

  var STRINGS = {
    en: {
      open: "Ask the model", close: "Close", send: "Send", title: "Ask the model",
      placeholder: "Ask about the model…", waiting: "Asking…",
      notice: "Your message and the conversation so far go to {host}, which asks the model and Claude through Anthropic's API. Nothing is sent until you press send, and nothing is kept.",
      privacy: "Privacy", privacyHref: "/privacy/", from: "From the model",
      cut: "… the answer stopped at its length limit.",
      full: "This conversation has reached twenty messages.", fresh: "New conversation",
      tooLong: "A message is at most 1,000 characters.",
      refusal: {
        too_long: "That message is over 1,000 characters.",
        busy: "Too many messages for the moment; try again in a minute.",
        over_day: "Today's share of answers is spent; there is more tomorrow.",
        over_month: "This month's share of answers is spent.",
        closed: "The chat is switched off for now.",
        host_down: "The model's host did not answer; try again shortly.",
        foreign: "This page may not use the chat.",
        bad_request: "That could not be sent as a message.",
        internal: "Something went wrong on the way; try again.",
        network: "The chat could not be reached; check the connection and try again."
      }
    },
    de: {
      open: "Das Modell fragen", close: "Schliessen", send: "Senden", title: "Das Modell fragen",
      placeholder: "Fragen Sie das Modell…", waiting: "Wird gefragt…",
      notice: "Ihre Nachricht und der bisherige Verlauf gehen an {host}, das das Modell und Claude über Anthropics API fragt. Gesendet wird erst, wenn Sie auf Senden drücken, und gespeichert wird nichts.",
      privacy: "Datenschutz", privacyHref: "/privacy/", from: "Aus dem Modell",
      cut: "… die Antwort endete an ihrer Längengrenze.",
      full: "Dieses Gespräch hat zwanzig Nachrichten erreicht.", fresh: "Neues Gespräch",
      tooLong: "Eine Nachricht hat höchstens 1000 Zeichen.",
      refusal: {
        too_long: "Diese Nachricht ist länger als 1000 Zeichen.",
        busy: "Im Moment zu viele Nachrichten; versuchen Sie es in einer Minute wieder.",
        over_day: "Der heutige Anteil an Antworten ist aufgebraucht; morgen gibt es mehr.",
        over_month: "Der Anteil dieses Monats an Antworten ist aufgebraucht.",
        closed: "Der Chat ist zurzeit abgeschaltet.",
        host_down: "Der Host des Modells hat nicht geantwortet; versuchen Sie es gleich wieder.",
        foreign: "Diese Seite darf den Chat nicht nutzen.",
        bad_request: "Das konnte nicht als Nachricht gesendet werden.",
        internal: "Unterwegs ist etwas schiefgegangen; versuchen Sie es noch einmal.",
        network: "Der Chat war nicht erreichbar; prüfen Sie die Verbindung und versuchen Sie es wieder."
      }
    }
  };
  function strings(lang){ return STRINGS[lang] || STRINGS.en; }
  function langNow(){ return document.documentElement && document.documentElement.lang === "de" ? "de" : "en"; }

  // ─── The subset ───────────────────────────────────────────────────────────────────────────
  function esc(s){ return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  // Inline marks on escaped text: code first, so nothing inside a span is read as emphasis;
  // bold before italic, so ** is not two stars; a lone star or underscore stays what it is.
  function inline(s){
    var out = "", i = 0, m;
    var re = /`([^`]+)`|\*\*(\S(?:[^*]*?\S)?)\*\*|\*(\S(?:[^*]*?\S)?)\*|_(\S(?:[^_]*?\S)?)_/g;
    while ((m = re.exec(s))) {
      out += s.slice(i, m.index);
      if (m[1] !== undefined) out += "<code>" + m[1] + "</code>";
      else if (m[2] !== undefined) out += "<strong>" + inline(m[2]) + "</strong>";
      else out += "<em>" + inline(m[3] !== undefined ? m[3] : m[4]) + "</em>";
      i = m.index + m[0].length;
    }
    return out + s.slice(i);
  }
  var ROW = /^\s*\|(.+)\|\s*$/, DELIM = /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/, BULLET = /^\s*[-*]\s+(.*)$/, NUMBER = /^\s*\d+\.\s+(.*)$/;
  function cells(line){ return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(function(c){ return inline(c.trim()); }); }
  // Blocks, line by line: a table needs its delimiter row before it is a table, so one still
  // arriving is a paragraph until its second line lands; a list is consecutive items; the rest
  // is paragraphs split at blank lines.
  function md(text){
    if (!text) return "";
    var lines = esc(text).split(/\r?\n/), out = "", i = 0, n = lines.length;
    while (i < n) {
      var line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (ROW.test(line) && i + 1 < n && DELIM.test(lines[i + 1])) {
        var head = cells(line); i += 2; var rows = [];
        while (i < n && ROW.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        out += "<table><thead><tr>" + head.map(function(c){ return "<th>" + c + "</th>"; }).join("") + "</tr></thead><tbody>"
          + rows.map(function(r){ return "<tr>" + r.map(function(c){ return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
        continue;
      }
      if (BULLET.test(line) || NUMBER.test(line)) {
        var ordered = NUMBER.test(line), items = [], re = ordered ? NUMBER : BULLET, m;
        while (i < n && (m = re.exec(lines[i]))) { items.push("<li>" + inline(m[1].trim()) + "</li>"); i++; }
        out += (ordered ? "<ol>" : "<ul>") + items.join("") + (ordered ? "</ol>" : "</ul>");
        continue;
      }
      var para = [];
      while (i < n && lines[i].trim() && !(ROW.test(lines[i]) && i + 1 < n && DELIM.test(lines[i + 1])) && !BULLET.test(lines[i]) && !NUMBER.test(lines[i])) { para.push(lines[i].trim()); i++; }
      out += "<p>" + inline(para.join(" ")) + "</p>";
    }
    return out;
  }

  // ─── The stream ───────────────────────────────────────────────────────────────────────────
  // Server-sent events off a fetch body: an event is an `event:` line, a `data:` line of JSON
  // and a blank line, and a chunk may end anywhere, so the buffer keeps the tail.
  function readEvents(response, onEvent){
    var reader = response.body.getReader(), dec = new TextDecoder(), buf = "";
    function emit(block){
      var name = null, data = "";
      block.split("\n").forEach(function(l){
        if (l.indexOf("event:") === 0) name = l.slice(6).trim();
        else if (l.indexOf("data:") === 0) data += l.slice(5).trim();
      });
      if (name) { var parsed; try { parsed = JSON.parse(data); } catch (e) { parsed = { raw: data }; } onEvent(name, parsed); }
    }
    return reader.read().then(function step(r){
      if (r.done) { if (buf.trim()) emit(buf); return; }
      buf += dec.decode(r.value, { stream: true });
      var at;
      while ((at = buf.indexOf("\n\n")) >= 0) { emit(buf.slice(0, at)); buf = buf.slice(at + 2); }
      return reader.read().then(step);
    });
  }

  window.rbChat = { md: md, readEvents: readEvents, strings: strings };

  // ─── The page ─────────────────────────────────────────────────────────────────────────────
  var tag = document.currentScript;
  if (!tag || !tag.dataset || !tag.dataset.chat) return;
  var ENDPOINT = tag.dataset.chat, MODEL = tag.dataset.model || "/model/";
  var HOST = (function(){ try { return new URL(ENDPOINT).host; } catch (e) { return ENDPOINT; } })();

  var messages = [], busy = false, panel = null, log = null, input = null, sendBtn = null, notice = null, fullNote = null, title = null, closeBtn = null;

  function el(tagName, cls, text){ var e = document.createElement(tagName); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  var button = el("button", "rbchat-open");
  button.type = "button";
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" d="M4 5.5h16v10H9l-5 4z"/></svg><span></span>';
  button.addEventListener("click", open);
  document.body.appendChild(button);

  function relabel(){
    var s = strings(langNow());
    button.querySelector("span").textContent = s.open; button.setAttribute("aria-label", s.open);
    if (!panel) return;
    title.textContent = s.title; closeBtn.setAttribute("aria-label", s.close); closeBtn.textContent = "×";
    input.placeholder = s.placeholder; sendBtn.textContent = s.send;
    notice.innerHTML = esc(s.notice).replace("{host}", "<code>" + esc(HOST) + "</code>") + ' <a href="' + esc(s.privacyHref) + '">' + esc(s.privacy) + "</a>";
    fullNote.querySelector("span").textContent = s.full; fullNote.querySelector("button").textContent = s.fresh;
  }
  relabel();
  // The language control swaps <html lang>; every string follows on the next tick.
  if (window.MutationObserver) new MutationObserver(relabel).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  function build(){
    panel = el("section", "rbchat"); panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "false"); panel.hidden = true;
    var head = el("header", "rbchat-head");
    title = el("h2"); closeBtn = el("button", "rbchat-close"); closeBtn.type = "button"; closeBtn.addEventListener("click", close);
    head.appendChild(title); head.appendChild(closeBtn);
    notice = el("p", "rbchat-notice");
    log = el("div", "rbchat-log"); log.setAttribute("aria-live", "polite");
    fullNote = el("p", "rbchat-full"); fullNote.hidden = true; fullNote.appendChild(el("span")); var fresh = el("button", "rbchat-fresh"); fresh.type = "button"; fresh.addEventListener("click", reset); fullNote.appendChild(fresh);
    var form = el("form", "rbchat-form");
    input = el("textarea"); input.rows = 2; input.maxLength = LIMIT; input.required = true;
    input.addEventListener("keydown", function(e){ if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : send(); } });
    sendBtn = el("button", "rbchat-send"); sendBtn.type = "submit";
    form.appendChild(input); form.appendChild(sendBtn);
    form.addEventListener("submit", function(e){ e.preventDefault(); send(); });
    panel.appendChild(head); panel.appendChild(notice); panel.appendChild(log); panel.appendChild(fullNote); panel.appendChild(form);
    document.body.appendChild(panel);
    document.addEventListener("keydown", function(e){ if (e.key === "Escape" && !panel.hidden) close(); });
    relabel();
  }
  function open(){ if (!panel) build(); panel.hidden = false; button.hidden = true; input.focus(); }
  function close(){ panel.hidden = true; button.hidden = false; button.focus(); }
  function reset(){ messages = []; log.innerHTML = ""; fullNote.hidden = true; input.disabled = false; sendBtn.disabled = false; input.focus(); }

  function bubble(role){ var b = el("div", "rbchat-msg rbchat-" + role); log.appendChild(b); log.scrollTop = log.scrollHeight; return b; }
  function refuse(code){ var s = strings(langNow()); var b = bubble("refusal"); b.textContent = s.refusal[code] || s.refusal.internal; }

  function send(){
    if (busy) return;
    var text = input.value.trim(), s = strings(langNow());
    if (!text) return;
    if (text.length > LIMIT) { refuse("too_long"); return; }
    messages.push({ role: "user", content: text });
    bubble("user").textContent = text;
    input.value = ""; busy = true; input.disabled = true; sendBtn.disabled = true;
    var ans = bubble("assistant"), body = el("div", "rbchat-body"), wait = el("p", "rbchat-wait", s.waiting);
    ans.appendChild(wait); ans.appendChild(body);
    var acc = "", cites = [], cut = false, ended = false;
    function render(){ body.innerHTML = md(acc); log.scrollTop = log.scrollHeight; }
    function finish(){
      if (wait.parentNode) wait.parentNode.removeChild(wait);
      if (cut) acc += "\n\n" + strings(langNow()).cut;
      render();
      if (cites.length) {
        var c = el("p", "rbchat-cites"); c.appendChild(el("span", null, strings(langNow()).from + ": "));
        cites.forEach(function(x, i){ var a = el("a", null, x.title || x.id); a.href = MODEL + "#" + encodeURIComponent(x.id); c.appendChild(a); if (i < cites.length - 1) c.appendChild(document.createTextNode(", ")); });
        ans.appendChild(c);
      }
      messages.push({ role: "assistant", content: acc });
      busy = false;
      if (messages.length >= TURNS) { fullNote.hidden = false; input.disabled = true; sendBtn.disabled = true; }
      else { input.disabled = false; sendBtn.disabled = false; input.focus(); }
    }
    fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json", "X-Chat": "1" }, body: JSON.stringify({ messages: messages, lang: langNow() }) })
      .then(function(r){
        if (r.status !== 200) {
          return r.json().then(function(j){ return (j && j.error && j.error.code) || "internal"; }, function(){ return r.status === 413 ? "too_long" : "internal"; })
            .then(function(code){ ans.parentNode.removeChild(ans); messages.pop(); refuse(code); busy = false; input.disabled = false; sendBtn.disabled = false; });
        }
        return readEvents(r, function(name, data){
          if (name === "text") { if (wait.parentNode) wait.parentNode.removeChild(wait); acc += data.text || ""; render(); }
          else if (name === "cite") cites.push(data);
          else if (name === "done") { cut = !!data.cut; ended = true; }
          else if (name === "error") { ended = true; var code = data && data.error && data.error.code; if (!acc) { ans.parentNode.removeChild(ans); messages.pop(); refuse(code || "internal"); busy = false; input.disabled = false; sendBtn.disabled = false; return; } acc += "\n\n" + (strings(langNow()).refusal[code] || strings(langNow()).refusal.internal); }
        }).then(function(){ if (busy) finish(); });
      })
      .catch(function(){ if (ans.parentNode) ans.parentNode.removeChild(ans); if (messages[messages.length - 1] && messages[messages.length - 1].role === "user") messages.pop(); refuse("network"); busy = false; input.disabled = false; sendBtn.disabled = false; });
  }
})();
```

Run `npm test`: green. Then look at the code once more for the two hazards named in the header: nothing stored, nothing fetched before send.

- [ ] **Step 3: Commit.**

```sh
git add assets/chat.js test/chat.test.mjs
git commit -F - <<'EOF'
The widget asks the chat and renders what it answers

One script with no dependency, in card.js's shape: it reads the endpoint and the model page off its own tag, shows a button, and builds the panel on first open; the conversation lives in the closure and nothing is stored. A message goes with the whole conversation and the language, the answer is read event by event off the response stream and rendered as it comes through the Markdown subset the model is told to write, after every character is escaped, and the cites link into the model page. Every sentence the widget writes is inside it, in both languages, so a refusal costs nothing; the German is a draft for the translator.

Verified: npm test passes with the renderer, the reader and the sentences covered; conventions-check and conventions-format check exit 0.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: The stylesheet, the version, the pull request

**Files:**

- Create: `assets/chat.css` (replacing the placeholder)
- Modify: `package.json` (version 0.75.0)

- [ ] **Step 1: assets/chat.css.** Written against the tokens; a phone gets the panel as a sheet.

```css
/* The chat: a button at the foot of the page and the panel it opens. Colors and faces are the
   tokens', so the widget follows the theme where an image could not; the accent is --c-mid,
   what every control in the family is. The panel is a sheet on a phone, a card on a desk. */
.rbchat-open{position:fixed;right:max(1rem,env(safe-area-inset-right));bottom:max(1rem,env(safe-area-inset-bottom));z-index:60;
  display:inline-flex;align-items:center;gap:.5rem;padding:.6rem .95rem;border-radius:999px;
  border:1px solid var(--rule);background:var(--raise);color:var(--ink);cursor:pointer;
  font:inherit;font-size:.92rem;box-shadow:0 6px 24px rgba(0,0,0,.14)}
.rbchat-open svg{color:var(--c-mid)}
.rbchat-open:hover,.rbchat-open:focus-visible{border-color:var(--c-mid);outline:none}
.rbchat-open:focus-visible{box-shadow:0 0 0 3px var(--press)}
.rbchat{position:fixed;right:max(1rem,env(safe-area-inset-right));bottom:max(1rem,env(safe-area-inset-bottom));z-index:61;
  width:min(26rem,calc(100vw - 2rem));height:min(70vh,40rem);display:flex;flex-direction:column;
  background:var(--ground);color:var(--ink);border:1px solid var(--rule);border-radius:14px;
  box-shadow:0 18px 60px rgba(0,0,0,.22);overflow:hidden}
.rbchat[hidden]{display:none}
.rbchat-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.75rem 1rem;border-bottom:1px solid var(--rule);background:var(--raise)}
.rbchat-head h2{margin:0;font-family:"Bricolage Grotesque",ui-sans-serif,system-ui,sans-serif;font-weight:700;letter-spacing:-.02em;font-size:1.05rem}
.rbchat-close{border:0;background:none;color:var(--dim);font-size:1.4rem;line-height:1;cursor:pointer;padding:.2rem .4rem;border-radius:6px}
.rbchat-close:hover,.rbchat-close:focus-visible{color:var(--ink);outline:2px solid var(--c-mid);outline-offset:2px}
.rbchat-notice{margin:0;padding:.6rem 1rem;font-size:.8rem;line-height:1.4;color:var(--dim);border-bottom:1px solid var(--rule)}
.rbchat-notice code{font-family:"Plex Mono",ui-monospace,Menlo,monospace;font-size:.95em;color:var(--ink)}
.rbchat-notice a{color:var(--c-mid)}
.rbchat-log{flex:1;overflow-y:auto;padding:.75rem 1rem;display:flex;flex-direction:column;gap:.6rem;font-size:.95rem;line-height:1.5}
.rbchat-msg{max-width:92%;padding:.55rem .8rem;border-radius:12px;overflow-wrap:anywhere}
.rbchat-user{align-self:flex-end;background:var(--press);color:var(--ink);white-space:pre-wrap}
.rbchat-assistant{align-self:flex-start;background:var(--raise);border:1px solid var(--rule)}
.rbchat-refusal{align-self:center;color:var(--dim);font-size:.88rem;font-style:italic}
.rbchat-body p{margin:0 0 .6rem}.rbchat-body p:last-child{margin-bottom:0}
.rbchat-body ul,.rbchat-body ol{margin:0 0 .6rem 1.2rem;padding:0}
.rbchat-body code{font-family:"Plex Mono",ui-monospace,Menlo,monospace;font-size:.88em;background:var(--press);padding:.05em .3em;border-radius:4px}
.rbchat-body table{border-collapse:collapse;margin:.2rem 0 .6rem;font-size:.9em;display:block;overflow-x:auto;max-width:100%}
.rbchat-body th,.rbchat-body td{border:1px solid var(--rule);padding:.3rem .5rem;text-align:left;vertical-align:top}
.rbchat-body th{background:var(--press);font-weight:600}
.rbchat-wait{margin:0;color:var(--dim);font-style:italic}
.rbchat-wait::after{content:"";display:inline-block;width:1.2em;text-align:left;animation:rbchat-dots 1.2s steps(4,end) infinite}
@keyframes rbchat-dots{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}
@media (prefers-reduced-motion:reduce){.rbchat-wait::after{animation:none;content:"\2026"}}
.rbchat-cites{margin:.5rem 0 0;font-size:.82rem;color:var(--dim)}
.rbchat-cites a{color:var(--c-mid);text-decoration:none}.rbchat-cites a:hover,.rbchat-cites a:focus-visible{text-decoration:underline}
.rbchat-full{margin:0;padding:.5rem 1rem;font-size:.85rem;color:var(--dim);border-top:1px solid var(--rule);display:flex;justify-content:space-between;align-items:center;gap:.6rem}
.rbchat-full[hidden]{display:none}
.rbchat-fresh,.rbchat-send{font:inherit;font-size:.9rem;padding:.45rem .85rem;border-radius:8px;border:1px solid var(--c-mid);background:var(--c-mid);color:var(--ground);cursor:pointer}
.rbchat-fresh:disabled,.rbchat-send:disabled{opacity:.55;cursor:default}
.rbchat-form{display:flex;gap:.5rem;padding:.6rem 1rem;border-top:1px solid var(--rule);background:var(--raise)}
.rbchat-form textarea{flex:1;resize:none;font:inherit;font-size:.95rem;padding:.5rem .6rem;border-radius:8px;border:1px solid var(--rule);background:var(--ground);color:var(--ink)}
.rbchat-form textarea:focus-visible{outline:2px solid var(--c-mid);outline-offset:1px}
@media (max-width:600px){
  .rbchat{right:0;bottom:0;width:100vw;height:100dvh;border-radius:0;border:0}
}
```

- [ ] **Step 2: A look at it.** With Playwright, which this package has (`node_modules/playwright`), write a scratch page under a git-ignored path (`/tmp/claude-501/` or the worktree's `.superpowers/`) that inlines `blocks/tokens.css` (page variant, via `blockFor("design tokens", "page")` from `lib/fences.mjs`) and `blocks/reset.css`, links the font files from `assets/fonts/`, links `assets/chat.css`, and loads `assets/chat.js` with `data-chat` pointing at a scratch Node server you start on a free port that answers `POST /chat` with a scripted event stream: two `text` events forming a paragraph and a table, one `cite`, one `done`. Drive it: click the button, type a question, press Enter, wait for the cite link; screenshot at 1400×900 and 360×640 to the scratch directory, and again with `data-theme="light"` on the html element, and once with `lang="de"` for the strings. Look at the four images and describe them in the report: the button, the panel, the notice with the host and the privacy link, the user bubble, the rendered paragraph and table, the cite link, the disabled state while waiting, the sheet on the phone. Fix what is wrong in `chat.css` and say what you fixed. Nothing scratch is committed.

- [ ] **Step 3: Version, checks, commit, pull request.** `npm version 0.75.0 --no-git-tag-version` (a new group is a minor). `npm test`; `sh conventions/conventions-check && sh conventions/conventions-format check`.

```sh
git add assets/chat.css package.json package-lock.json
git commit -F - <<'EOF'
The chat is styled from the tokens, and this is 0.75.0

The button and the panel take their colors from the tokens, so they follow the theme; the panel is a card on a desk and a sheet on a phone, the answer's paragraphs, lists and tables sit in the family's faces, and the cites read as the family's links. A new group is a minor.

Verified: npm test passes; the panel was rendered in Chromium at desk and phone width, in both themes and both languages, and looked at; conventions-check and conventions-format check exit 0.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
git push -u origin the-chat-group
gh pr create --repo robertblust/design --base main --head the-chat-group --title "The chat is a group a site takes" --body-file - <<'EOF'
blust.ch and companygraph.io each run a chat over their MCP host now, and no page opens it. This is the widget, as a group of this package so that both sites carry identical bytes and guestgraph.io, which serves no chat, takes none: `chat.js`, one script with no dependency in card.js's shape, and `chat.css`, written from the tokens. A page adds one tag with the endpoint and the model page on it, and the button appears at the foot of the page.

Nothing loads and nothing is sent until a visitor opens the panel and presses send, and nothing is stored, which the sites' privacy pages will say. The answer is read event by event off the response stream and rendered as it comes through the Markdown subset the model is told to write, paragraphs, emphasis, code spans, lists and tables, after every character has been escaped; the cites link into the model page by id; every sentence the widget writes is inside it in both languages, so a refusal costs no tokens. The German is a draft for the translator's review. The README's rule that a page never depends on this package at runtime gains its one written exception: a page may call the chat host the site names, after a visitor acts.

Release notes to write at tagging: the group, the tag a page adds, what is and is not stored, the subset, and that a site takes it by adding `chat` to its `design.config.json` and the tag to its prose pages.

Verified: npm test passes with the renderer, the reader and the sentences covered; the panel was rendered in Chromium at desk and phone width, in both themes and both languages, and looked at; conventions-check and conventions-format check exit 0.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

The pull request is opened and it stops there.

---

## Self-review

Spec §7 line by line: the group of two files, the tag with the endpoint, no attribute no button, bottom right in the tokens, the notice every time the panel opens with the privacy link, `lang` and theme followed, the waiting mark, streaming, cites linked by id, refusal sentences in both languages, twenty messages then a new conversation, nothing stored, and the README's exception. §3's events and codes are the reader's and the strings' tables. The spec's "de-duplicated already" is the server's. What this plan leaves to the sites' plan: the tag on each page, `chat` in each `design.config.json`, the privacy sections, the sitemap. What it leaves to the translator: the German strings, drafted here.
