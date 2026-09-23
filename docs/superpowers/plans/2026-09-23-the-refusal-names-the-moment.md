# The refusal names the moment: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The chat widget's refusal for `busy`, `over_day` and `over_month` ends with the moment the limit lifts, written from the server's `error.retryAt` in the visitor's language and local time.

**Architecture:** One pure function, `when(retryAt, now, lang, zone)`, turns an ISO moment into the sentence "You can ask again in 12 minutes." or its German, and a second pure one, `refusalText(code, retryAt, now, lang, zone)`, composes the refusal sentence with it. Both hang on `rbChat` so the Node suite holds them on a fixed clock and a fixed zone. The widget's two refusal readers keep `retryAt` beside the code and hand both to `refuse`. Nothing else in the package moves.

**Tech Stack:** `assets/chat.js` (ES5-style IIFE, no build), `test/chat.test.mjs` on `node --test`, `Intl.DateTimeFormat` for the time and the day name.

**Spec:** `docs/superpowers/specs/2026-09-23-the-refusal-names-the-moment-design.md` in this repository, and `docs/superpowers/specs/2026-09-23-the-refusal-names-the-moment-design.md` in companygraph/chat-server for the field's shape. Both are read before any task.

## Global constraints

- `error.retryAt` is an ISO 8601 time in UTC, sent by the chat server only on `busy`, `over_day` and `over_month` (chat-server v0.8.0 and later, live on both hosts). No other code carries it. The widget never guesses a moment.
- Every string the widget writes lives in `STRINGS` in both languages; the German is a draft for the translator of `conventions/TRANSLATOR.md`, marked by the comment already above the `de` block. Swiss Standard German: `ss` never `ß`, Sie never du.
- The clause says "at", never "exactly at": the bucket is per instance and the chat may open earlier than the moment, never later.
- Not a retry the widget makes, not a countdown: the sentence is written once, when the refusal arrives.
- A widget that meets a server without the field, or a body that could not be read, refuses as today, except that `busy` without a moment says "try again later" and no longer promises a minute.
- `assets/chat.js` is scanned by `test/spelling.test.mjs` for American English: comments say color, behavior, organization.
- Every commit is in the git register of `conventions/WRITING.md`: a plain-sentence subject, one to three paragraphs cause before mechanism, a `Verified:` line, then the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. The commit author is the owner; run `git config user.email` once and read `robert.blust@flatland.ch`.
- Work in the worktree `/Users/rob/git/robertblust/design-the-refusal-names-the-moment` on branch `the-refusal-names-the-moment`. Never touch the clone at `design/`.
- `export PATH=/opt/homebrew/bin:$PATH` before `node`, `npm` or `gh`.

---

### Task 1: The branch catches up with main

The branch was cut at v0.80.2 and main is at v0.80.3. The branch is pushed and its pull request is open, so it is not rebased; main is merged into it.

**Files:**

- No file edited by hand.

- [ ] **Step 1: Merge main**

```bash
export PATH=/opt/homebrew/bin:$PATH
cd /Users/rob/git/robertblust/design-the-refusal-names-the-moment
git fetch origin
git merge origin/main
```

Expected: a merge commit with no conflict (the branch holds one spec file main does not).

- [ ] **Step 2: Run the suite as the baseline**

```bash
npm test 2>&1 | tail -5; echo "exit=${PIPESTATUS[0]}"
```

Expected: every test passes, exit 0. Note the count: the spec's last paragraph in the pull request will name it.

- [ ] **Step 3: Read the version main carries**

```bash
grep '"version"' package.json
```

Expected: `"version": "0.80.3"`. The lockfile carries its own older number and is not touched by a release.

---

### Task 2: `when` writes the moment in the visitor's terms

**Files:**

- Modify: `assets/chat.js` — `STRINGS.en`, `STRINGS.de`, a new function `when` after `sentence`, and the `window.rbChat` line.
- Test: `test/chat.test.mjs`.

**Interfaces:**

- Produces: `rbChat.when(retryAt, now, lang, zone)` → string. `retryAt` is the ISO string; `now` is milliseconds since the epoch; `lang` is `"en"` or `"de"` (anything else falls back to English); `zone` is an IANA time zone name or `undefined` for the browser's. Returns the full sentence, or `""` for an unreadable moment or one at or before `now`.
- Produces: `STRINGS.<lang>.again`, an object with the keys `sentence`, `minute`, `minutes`, `at`, `tomorrow`, `day`, each a template with `{when}`, `{n}`, `{time}` or `{day}`.

- [ ] **Step 1: Write the failing tests**

Add to `test/chat.test.mjs`, after the `strings` destructuring line, `when` to the destructured names:

```js
const { md, readEvents, strings, link, refocus, nameLinks, when } = globalThis.rbChat;
```

Append at the end of the file:

```js
// The clock is fixed at 10:00 UTC on Wednesday, September 23, 2026, which is 12:00 in Zürich,
// and the zone is Zürich, so the four distances the spec names each have one expected sentence.
const NOW = Date.parse("2026-09-23T10:00:00Z");
const ZH = "Europe/Zurich";
const plus = (ms) => new Date(NOW + ms).toISOString();

test("the moment is written in minutes within the hour, and a minute or less is a minute", () => {
  assert.equal(when(plus(30 * 1000), NOW, "en", ZH), "You can ask again in a minute.");
  assert.equal(when(plus(60 * 1000), NOW, "en", ZH), "You can ask again in a minute.");
  assert.equal(when(plus(12 * 60 * 1000), NOW, "en", ZH), "You can ask again in 12 minutes.");
  assert.equal(when(plus(11 * 60 * 1000 + 30 * 1000), NOW, "en", ZH), "You can ask again in 12 minutes.", "a part of a minute rounds up");
  assert.equal(when(plus(60 * 60 * 1000), NOW, "en", ZH), "You can ask again in 60 minutes.", "the hour itself is still minutes");
});

test("later the same local day is a time, tomorrow is named, and a later day carries its name", () => {
  assert.equal(when(plus(2 * 60 * 60 * 1000 + 35 * 60 * 1000), NOW, "en", ZH), "You can ask again at 14:35.");
  assert.equal(when("2026-09-24T00:00:00Z", NOW, "en", ZH), "You can ask again tomorrow at 02:00.", "midnight UTC is two in the morning in Zürich");
  assert.equal(when("2026-10-01T00:00:00Z", NOW, "en", ZH), "You can ask again on Thursday at 02:00.", "the month's ceiling lifts on the first");
});

test("the moment is written in German the same way, and an unknown language reads as English", () => {
  assert.equal(when(plus(30 * 1000), NOW, "de", ZH), "Sie können in einer Minute wieder fragen.");
  assert.equal(when(plus(12 * 60 * 1000), NOW, "de", ZH), "Sie können in 12 Minuten wieder fragen.");
  assert.equal(when(plus(2 * 60 * 60 * 1000 + 35 * 60 * 1000), NOW, "de", ZH), "Sie können um 14:35 wieder fragen.");
  assert.equal(when("2026-09-24T00:00:00Z", NOW, "de", ZH), "Sie können morgen um 02:00 wieder fragen.");
  assert.equal(when("2026-10-01T00:00:00Z", NOW, "de", ZH), "Sie können am Donnerstag um 02:00 wieder fragen.");
  assert.equal(when(plus(12 * 60 * 1000), NOW, "fr", ZH), when(plus(12 * 60 * 1000), NOW, "en", ZH));
});

test("a moment in the past, an unreadable one and a missing one give no sentence", () => {
  assert.equal(when(plus(-1000), NOW, "en", ZH), "");
  assert.equal(when(new Date(NOW).toISOString(), NOW, "en", ZH), "", "now itself is not a wait");
  assert.equal(when("soon", NOW, "en", ZH), "");
  assert.equal(when(undefined, NOW, "en", ZH), "");
  assert.equal(when(null, NOW, "en", ZH), "");
});
```

- [ ] **Step 2: Run the tests to see them fail**

```bash
node --test test/chat.test.mjs 2>&1 | tail -20
```

Expected: the four new tests fail with `when is not a function`.

- [ ] **Step 3: Add the strings**

In `assets/chat.js`, inside `STRINGS.en`, after the `fresh: "New conversation",` line and before `refusal: {`, add:

```js
      again: { sentence: "You can ask again {when}.", minute: "in a minute", minutes: "in {n} minutes", at: "at {time}", tomorrow: "tomorrow at {time}", day: "on {day} at {time}" },
```

Inside `STRINGS.de`, after `fresh: "Neues Gespräch",` and before `refusal: {`, add:

```js
      again: { sentence: "Sie können {when} wieder fragen.", minute: "in einer Minute", minutes: "in {n} Minuten", at: "um {time}", tomorrow: "morgen um {time}", day: "am {day} um {time}" },
```

- [ ] **Step 4: Write `when`**

In `assets/chat.js`, after the `sentence` function (after its closing `}` on the line following `return Object.prototype.hasOwnProperty.call(r, code) ? r[code] : r.internal;`), add:

```js

  // When a limit lifts, in the visitor's terms. The server sends the moment as an ISO time in
  // UTC on `busy`, `over_day` and `over_month`, and the widget writes it against the visitor's
  // clock and zone: within the hour in minutes, later the same local day as a time, tomorrow
  // by name, and beyond that by the day's name, so midnight UTC reads as the local hour it is.
  // Under a minute is "a minute", the one case where the old sentence was right. The sentence
  // says "at" and never "exactly at": the bucket is per instance, and a visitor may find the
  // chat open earlier than the moment says, never later. `zone` is for the suite; the page
  // passes nothing and gets the browser's. An unreadable moment or one already past gives an
  // empty string, and the caller writes the plain sentence.
  function when(retryAt, now, lang, zone){
    var t = Date.parse(retryAt);
    if (isNaN(t) || t <= now) return "";
    var s = strings(lang).again, clause;
    var minutes = Math.ceil((t - now) / 60000);
    if (minutes <= 60) clause = minutes <= 1 ? s.minute : s.minutes.replace("{n}", String(minutes));
    else {
      var opts = zone ? { timeZone: zone } : {};
      var day = function(ms){ return new Intl.DateTimeFormat("en-CA", Object.assign({ year: "numeric", month: "2-digit", day: "2-digit" }, opts)).format(new Date(ms)); };
      var time = new Intl.DateTimeFormat(lang === "de" ? "de-CH" : "en-GB", Object.assign({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, opts)).format(new Date(t));
      var then = day(t);
      if (then === day(now)) clause = s.at.replace("{time}", time);
      else if (then === day(now + 86400000)) clause = s.tomorrow.replace("{time}", time);
      else clause = s.day.replace("{day}", new Intl.DateTimeFormat(lang === "de" ? "de-CH" : "en-US", Object.assign({ weekday: "long" }, opts)).format(new Date(t))).replace("{time}", time);
    }
    return s.sentence.replace("{when}", clause);
  }
```

Two facts behind the locales: `en-CA` writes a date as `2026-09-23`, which is a string two moments can be compared by; `en-GB` and `de-CH` both write a 24-hour time as `14:35`, where `en-US` would write `2:35 PM`, and the spec's examples are 24-hour in both languages. The `hourCycle` of `h23` keeps midnight as `00:00` and never `24:00`.

- [ ] **Step 5: Export it**

Change the `window.rbChat = { … }` line to:

```js
  window.rbChat = { md: md, readEvents: readEvents, strings: strings, link: link, refocus: refocus, nameLinks: nameLinks, when: when };
```

And in the file's opening comment, after the `rbChat.refocus(window)` line, add:

```js
//   rbChat.when(retryAt, now, lang)     when a limit lifts, in the visitor's language and time
```

- [ ] **Step 6: Run the tests to see them pass**

```bash
node --test test/chat.test.mjs 2>&1 | tail -20; npm test 2>&1 | tail -3
```

Expected: all of `test/chat.test.mjs` passes, and the whole suite passes, including `test/spelling.test.mjs`.

- [ ] **Step 7: Commit**

```bash
git add assets/chat.js test/chat.test.mjs
git commit -F- <<'EOF'
The widget can say when a limit lifts

The chat server sends the moment a limit lifts, `error.retryAt`, on `busy`, `over_day` and `over_month`, and until now nothing in the widget could read it into a sentence. `rbChat.when` takes the moment, the clock, the language and a zone and writes the wait in the visitor's terms: in minutes within the hour, as a time later the same local day, as tomorrow by name, and beyond that by the day's name and the time, so midnight UTC reads as the local hour it is. The German stands beside the English as a draft for the translator.

The function is pure and takes its clock and zone as arguments so the suite holds it in Node on a fixed clock in Zürich; the page passes the browser's. Nothing calls it yet.

Verified: node --test test/chat.test.mjs and npm test exit 0; the four new tests fail before the function exists and pass after.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: The refusal keeps the moment and ends with it

**Files:**

- Modify: `assets/chat.js` — `STRINGS.*.refusal.busy`, a new `refusalText` after `when`, `refuse`, the two refusal readers in `send`, and the `window.rbChat` line.
- Test: `test/chat.test.mjs`.

**Interfaces:**

- Consumes: `when(retryAt, now, lang, zone)` from Task 2, `sentence(code)` as it is.
- Produces: `rbChat.refusalText(code, retryAt, now, lang, zone)` → string: the refusal sentence for `code` in `lang`, followed by a space and `when(...)` where that is not empty. `refuse(code, retryAt)` in the page calls it with `Date.now()`, `langNow()` and no zone.

- [ ] **Step 1: Write the failing tests**

Change the destructuring line to:

```js
const { md, readEvents, strings, link, refocus, nameLinks, when, refusalText } = globalThis.rbChat;
```

Append at the end of the file:

```js
test("a refusal without the field is the plain sentence, and with it the sentence ends with the moment", () => {
  assert.equal(refusalText("over_day", undefined, NOW, "en", ZH), strings("en").refusal.over_day);
  assert.equal(refusalText("over_day", "2026-09-24T00:00:00Z", NOW, "en", ZH), strings("en").refusal.over_day + " You can ask again tomorrow at 02:00.");
  assert.equal(refusalText("busy", plus(12 * 60 * 1000), NOW, "de", ZH), strings("de").refusal.busy + " Sie können in 12 Minuten wieder fragen.");
  assert.equal(refusalText("busy", "soon", NOW, "en", ZH), strings("en").refusal.busy, "an unreadable moment is no moment");
  assert.equal(refusalText("foreign", plus(60000), NOW, "en", ZH), strings("en").refusal.foreign + " You can ask again in a minute.", "the field is trusted wherever the server sends it");
  assert.equal(refusalText("no_such_code", undefined, NOW, "en", ZH), strings("en").refusal.internal, "an unknown code still falls back");
});

test("busy no longer promises a minute where the server named none", () => {
  for (const lang of ["en", "de"]) assert.ok(!/minute/i.test(strings(lang).refusal.busy), `${lang}: ${strings(lang).refusal.busy}`);
});
```

- [ ] **Step 2: Run the tests to see them fail**

```bash
node --test test/chat.test.mjs 2>&1 | tail -20
```

Expected: the first new test fails with `refusalText is not a function`; the second fails on both languages, whose `busy` sentence still says "minute".

- [ ] **Step 3: Change the `busy` sentences**

In `STRINGS.en.refusal`:

```js
        busy: "Too many messages for the moment; try again later.",
```

In `STRINGS.de.refusal`:

```js
        busy: "Im Moment zu viele Nachrichten; versuchen Sie es später wieder.",
```

- [ ] **Step 4: Write `refusalText` and change `refuse`**

After the `when` function, add:

```js
  // The refusal as the visitor reads it: the code's sentence, and where the server named the
  // moment its limit lifts, that moment after it. A response without the field, or one whose
  // body could not be read, gives the sentence alone, so a widget meeting an older server
  // degrades to what it said before.
  function refusalText(code, retryAt, now, lang, zone){
    var base = Object.prototype.hasOwnProperty.call(strings(lang).refusal, code) ? strings(lang).refusal[code] : strings(lang).refusal.internal;
    var moment = retryAt ? when(retryAt, now, lang, zone) : "";
    return moment ? base + " " + moment : base;
  }
```

Replace the `refuse` function:

```js
  function refuse(code, retryAt){ bubble("refusal").textContent = refusalText(code, retryAt, Date.now(), langNow()); if (panel && !panel.hidden && refocus(window)) input.focus(); }
```

Its comment above stays; add one sentence to its end: `The moment the server named, if any, comes with the code and ends the sentence.`

- [ ] **Step 5: Keep the moment where the response is read**

In `send`, the non-200 branch reads the code alone. Replace:

```js
          return r.json().then(function(j){ return (j && j.error && j.error.code) || "internal"; }, function(){ return r.status === 413 ? "too_much" : "internal"; })
            .then(function(code){
              clearTimeout(timer);
              if (ans.parentNode) ans.parentNode.removeChild(ans);
              messages.pop(); turns.pop(); keep();
              busy = false; input.disabled = false; sendBtn.disabled = false;
              refuse(code);
            });
```

with:

```js
          // The body is read for its code and, on the three limits, the moment the limit
          // lifts; a body that cannot be read refuses by the status alone and names no moment.
          return r.json().then(function(j){ var e = j && j.error; return { code: (e && e.code) || "internal", retryAt: e && e.retryAt }; }, function(){ return { code: r.status === 413 ? "too_much" : "internal" }; })
            .then(function(got){
              clearTimeout(timer);
              if (ans.parentNode) ans.parentNode.removeChild(ans);
              messages.pop(); turns.pop(); keep();
              busy = false; input.disabled = false; sendBtn.disabled = false;
              refuse(got.code, got.retryAt);
            });
```

In the stream's `error` event, the model's own minute arrives the same way, mid-answer or before any text. Replace:

```js
          else if (name === "error") {
            var code = data && data.error && data.error.code;
            if (!acc.trim()) {
              clearTimeout(timer);
              if (ans.parentNode) ans.parentNode.removeChild(ans);
              messages.pop(); turns.pop(); keep();
              busy = false; input.disabled = false; sendBtn.disabled = false;
              refuse(code || "internal");
              return;
            }
            acc += "\n\n" + sentence(code);
          }
```

with:

```js
          else if (name === "error") {
            var code = data && data.error && data.error.code, at = data && data.error && data.error.retryAt;
            if (!acc.trim()) {
              clearTimeout(timer);
              if (ans.parentNode) ans.parentNode.removeChild(ans);
              messages.pop(); turns.pop(); keep();
              busy = false; input.disabled = false; sendBtn.disabled = false;
              refuse(code || "internal", at);
              return;
            }
            acc += "\n\n" + refusalText(code, at, Date.now(), langNow());
          }
```

Then `sentence` has one caller left, `refusalText`'s own lookup does the same thing. Replace `refusalText`'s first line with `var base = sentence(code, lang);` and change `sentence` to take the language:

```js
  function sentence(code, lang){
    var r = strings(lang || langNow()).refusal;
    return Object.prototype.hasOwnProperty.call(r, code) ? r[code] : r.internal;
  }
```

- [ ] **Step 6: Export `refusalText`**

```js
  window.rbChat = { md: md, readEvents: readEvents, strings: strings, link: link, refocus: refocus, nameLinks: nameLinks, when: when, refusalText: refusalText };
```

And in the opening comment, after the `rbChat.when` line:

```js
//   rbChat.refusalText(code, retryAt, …)  the refusal sentence, ending with that moment where there is one
```

- [ ] **Step 7: Run the tests to see them pass**

```bash
node --test test/chat.test.mjs 2>&1 | tail -20; npm test 2>&1 | tail -3
```

Expected: everything passes, including the older test that every code has a sentence in both languages, unchanged.

- [ ] **Step 8: Look at it in a browser once**

The suite cannot press send. Serve the fixture that draws the chat and refuse it by hand. In the worktree:

```bash
grep -rl "data-chat" test/fixtures | head -3
```

If a fixture with the tag exists, open it with `node -e` under Playwright (installed as a devDependency) with `page.route` answering the endpoint with `429` and the body `{"error":{"code":"busy","retryAt":"<now plus 12 minutes as ISO>"}}`, press send, and read the refusal bubble's text; expect it to end with "in 12 minutes." in English, then switch `<html lang>` to `de` before sending again and expect "in 12 Minuten wieder fragen.". If no fixture carries the tag, write a one-page HTML in the scratchpad that loads `assets/chat.js` with `data-chat="http://chat.test/chat"` and do the same. Record what was seen in the commit's `Verified:` line; this is the rendering check the spec asks for.

- [ ] **Step 9: Commit**

```bash
git add assets/chat.js test/chat.test.mjs
git commit -F- <<'EOF'
The refusal ends with the moment the limit lifts

The bucket refuses a visitor's twenty-first message in an hour and the widget told them to try again in a minute, a sentence written for the model's minute and wrong for the bucket's hour; a visitor who obeyed it was refused again. The widget now keeps `retryAt` beside the code wherever it reads a refusal, the 429 body and the stream's error event alike, and the sentence for a limit ends with that moment through `rbChat.refusalText`, in the visitor's language and local time. Where the server named no moment the sentences stand, except that `busy` says "try again later" and no longer promises a minute it cannot know.

Verified: node --test test/chat.test.mjs and npm test exit 0; the two new tests fail before the change and pass after; in a browser under Playwright with the endpoint answering 429 and a moment twelve minutes out, the refusal reads "Too many messages for the moment; try again later. You can ask again in 12 minutes." in English and "… Sie können in 12 Minuten wieder fragen." in German.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

If Step 8 was done with a scratch page rather than a fixture, say so in the `Verified:` line; if it was not done, leave it out of the line and say in the pull request that the rendering check is owed.

---

### Task 4: The README says so, and the package moves to 0.81.0

**Files:**

- Modify: `README.md` line 26 (the paragraph beginning `A site takes the chat by naming`).
- Modify: `package.json` line 3.

- [ ] **Step 1: The README's chat paragraph gains one sentence**

At the end of the paragraph that begins `A site takes the chat by naming \`chat\`` (it ends `a site adds nothing but the tag.`), append one sentence:

```
Where the chat host names the moment a limit lifts, the widget's refusal ends with it, in the page's language and the visitor's local time; a host that names none gets the plain sentence.
```

- [ ] **Step 2: The version**

```bash
export PATH=/opt/homebrew/bin:$PATH
npm version minor --no-git-tag-version
grep '"version"' package.json
git status --short
```

Expected: `"version": "0.81.0"`, and `git status` shows only `package.json` and `README.md` changed (the lockfile carries `0.75.0` and npm leaves it, as the prior releases did; if `package-lock.json` shows as changed, run `git checkout package-lock.json`).

- [ ] **Step 3: The checks**

```bash
npm test 2>&1 | tail -3; echo "exit=${PIPESTATUS[0]}"
sh conventions/conventions-check; echo "exit=$?"
sh conventions/conventions-format; echo "exit=$?"
```

Expected: all three exit 0. If `conventions-format` reports the README, run `sh conventions/conventions-format fix` and read the diff before committing.

- [ ] **Step 4: Commit**

```bash
git add README.md package.json
git commit -F- <<'EOF'
The README names the moment, and this is 0.81.0

The chat paragraph says that a refusal ends with the moment a limit lifts where the host names one, and what a host that names none gets, so a site taking the chat knows what the widget writes without reading it. The package moves to 0.81.0: a change to a synced file is a minor, and a site takes it by re-pin alone.

Verified: npm test, sh conventions/conventions-check and sh conventions/conventions-format exit 0.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

- [ ] **Step 5: Push and update the pull request**

```bash
git push
```

The pull request is robertblust/design #125. Its description is rewritten with `gh pr edit 125 -R robertblust/design --body-file -` in the git register: what the widget now says and why, that `busy` without a moment stops promising a minute, that the sentence says "at" and not "exactly at" and why, the release as 0.81.0 with blust.ch and companygraph.io re-pinning and guestgraph.io taking nothing, and a `Verified:` line naming the suite, the checks and the browser look, followed by the line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Then report the check's state and stop: the merge, the tag and the re-pins each wait for the owner's word.

---

## Self-review

Spec coverage: the widget keeps the moment (Task 3 step 5, both readers); the sentence ends with the moment in the visitor's terms for the four distances and "in a minute" under a minute (Task 2); "at" and never "exactly at" (the strings); absent field leaves the sentences, `busy` stops promising a minute (Task 3 step 3); the formatting is a pure part on `rbChat` (Task 2 step 5); the suite holds the four distances in both languages, the past and the unreadable, a refusal without the field, and the existing every-code test stays (Tasks 2 and 3); the README gains one sentence (Task 4). The spec names `when(retryAt, now, lang)`; the plan adds a fourth argument, the zone, because Node's suite cannot otherwise fix the zone, and the page passes none.

Placeholders: none. Types: `when` and `refusalText` carry the same five-argument shape in every task; `refuse(code, retryAt)` matches both callers.
