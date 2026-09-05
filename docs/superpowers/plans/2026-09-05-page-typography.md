# Page Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** design v0.28.0 with a `typography` page check and a per-language range dash, and the three sites green under it after one sweep each of their German and English text.

**Architecture:** `typography` joins the shared page checks in `verify/pages.mjs`, before `translates`. It reads English from the rendered page with code removed, and German from the cold-fetched source, every `data-de` and `data-notes-de` value with tags and code removed. Its British stems come from the site's vendored `conventions/conventions-check`, fetched at run time, so the family keeps one list. The runner refuses a page that has not opted in. `fmtPeriod` in `stage.js` sets the range dash per language. Each site then takes the release, opts every page in, sweeps its text with one script plus one reading pass, regenerates the German clips whose notes moved, re-exports PDFs and cards, and rewrites its quote rule.

**Tech Stack:** Node ESM, Playwright page objects, `node --test`; Python 3 for the one-off sweep; ElevenLabs via each site's `generate.py`.

**Spec:** `docs/superpowers/specs/2026-09-05-page-typography-design.md`. The rules are `conventions/WRITING.md`'s *English* and *German* sections; nothing here restates them.

## Global Constraints

- `verify/pages.mjs` exports exactly the checks `test/verify-pages.test.mjs` lists; a new check is added to that list in the same commit.
- Every check returns a string naming what is wrong, or `null`; it never throws for a finding.
- `stage.js` is a synced asset: changing it makes every site's copy stale and the release at least a minor.
- Commit messages in the git register with a `Verified:` line and the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Pull request bodies are plain paragraphs: no headers, no bullets, no checkboxes, no test plan, no generated-with footer.
- Every exit code is read on its own, never through `| tail`.
- Merges and the tag wait for the owner's word. So does the first narration run that bills.
- In a site, nothing inside a `<code>`, `<pre>` or `<script>` element and nothing in a `data-de` value's nested markup attributes is rewritten by the sweep; only text is.
- German narration clips are regenerated only for notes whose text changed; English clips do not move, and a `--dry-run` that names an English clip is a sign that English text was touched by mistake.

---

### Task 1: The `typography` check, test-first

**Files:**
- Modify: `test/verify-pages.test.mjs` (EXPECTED list; new tests)
- Modify: `verify/pages.mjs` (new check before `translates`)

**Interfaces:**
- Produces: `typography(page, spec)` in the object `pageChecks({ SITE, BASE })` returns, keyed `typography`, positioned immediately before `translates`. Uses `spec.absolute` for the cold fetch, `BASE` for the stems file at `${BASE}/conventions/conventions-check`. Returns `null` when clean, otherwise one string: every hit as `[en] <what> in "<40 chars>…<40 chars>"` or `[de] <what> in "…"`, joined by `; `. Fails with `no vendored conventions-check at <url> — this site is not a member` when the stems file or its `STEMS=` line is missing.

- [ ] **Step 1: Add the check to EXPECTED and write the tests**

In `test/verify-pages.test.mjs`, change the EXPECTED array to include `"typography"` (keep it sorted as the others are), and append:

```js
test("typography sits immediately before translates", () => {
  const keys = Object.keys(pageChecks(OPTS));
  assert.equal(keys.indexOf("typography"), keys.indexOf("translates") - 1);
});

test("typography reads the stems from the vendored conventions-check, not a literal", () => {
  // One list in the family. A literal here would be the second copy the conventions
  // repository exists to remove; the check fetches the site's own vendored script.
  const src = pageChecks(OPTS).typography.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /conventions\/conventions-check/);
  assert.match(src, /STEMS=/);
  assert.doesNotMatch(src, /colour|behaviour/);
});

test("typography reads German cold and English rendered, and drops code on both sides", () => {
  const src = pageChecks(OPTS).typography.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /fetch\(spec\.absolute\)/);
  assert.match(src, /data-(?:de|notes-de)|data-\(\?:de\|notes-de\)/);
  assert.match(src, /innerText/);
  assert.match(src, /code/);
});

test("typography names each hit with its side and its context", async () => {
  // A stub page and a stub fetch: the check must work from what it reads, not from Playwright.
  const html = `<html lang="en"><body><p data-de="Der Weg — „hier“ ist es.">The way – it is.</p>
    <p data-de="Die Strasse ist grösser.">Fine.</p></body></html>`;
  const stems = "#!/bin/sh\nSTEMS='colour|behaviour|grey([^a-z]|$)'\n";
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({
    ok: true,
    text: async () => (String(url).endsWith("conventions-check") ? stems : html),
  });
  try {
    const page = { evaluate: async () => "The way – it is. The colour of it. Fine." };
    const out = await pageChecks(OPTS).typography(page, { absolute: "https://example.test/" });
    assert.ok(out, "expected findings");
    assert.match(out, /\[de\] em-dash/);
    assert.match(out, /\[de\] „/);
    assert.match(out, /\[en\] spaced en-dash/);
    assert.match(out, /\[en\] colour/);
    assert.doesNotMatch(out, /Strasse/);
  } finally { globalThis.fetch = realFetch; }
});

test("typography passes a clean page and fails a site with no vendored stems", async () => {
  const realFetch = globalThis.fetch;
  const clean = `<html><body><p data-de="Der Weg – «hier» ist es.">The way — it is.</p></body></html>`;
  globalThis.fetch = async (url) => ({
    ok: true, text: async () => (String(url).endsWith("conventions-check") ? "STEMS='colour'\n" : clean) });
  try {
    const page = { evaluate: async () => "The way — it is. May 2012–Oct 2016." };
    assert.equal(await pageChecks(OPTS).typography(page, { absolute: "https://example.test/" }), null);
  } finally { globalThis.fetch = realFetch; }
  globalThis.fetch = async (url) => (String(url).endsWith("conventions-check") ? { ok: false, text: async () => "" } : { ok: true, text: async () => clean });
  try {
    const page = { evaluate: async () => "" };
    const out = await pageChecks(OPTS).typography(page, { absolute: "https://example.test/" });
    assert.match(out, /no vendored conventions-check/);
  } finally { globalThis.fetch = realFetch; }
});
```

- [ ] **Step 2: Run and watch them fail**

```bash
node --test test/verify-pages.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"
```
Expected: the EXPECTED test and the five new tests fail; the count of failures is 6.

- [ ] **Step 3: Write the check**

In `verify/pages.mjs`, insert before `    async translates(page, spec) {` (keep the comment block above `translates` where it is; this goes above that comment):

```js
    // The two languages, each read from where it lives, held to WRITING.md's marks. English
    // is what the visitor sees, so it comes from the rendered text; German is markup in
    // `data-de` and `data-notes-de` that the DOM never shows, so it comes from the cold
    // source, as sourceLang and noNewTab already read it. Code is not prose on either side:
    // mono means data, and a record value or a URL says nothing about how the page is set.
    //
    // The British stems are not written here. Every member vendors conventions/conventions-check,
    // whose STEMS= line is the family's one list; this check fetches that file from the site
    // under test and fails when it is not there, because a site without it is not a member.
    async typography(page, spec) {
      const stemsUrl = `${BASE}/conventions/conventions-check`;
      const stemsRes = await fetch(stemsUrl).catch(() => null);
      const stemsSrc = stemsRes && stemsRes.ok ? await stemsRes.text() : "";
      const stemsLine = stemsSrc.match(/^STEMS='(.*)'$/m);
      if (!stemsLine) return `no vendored conventions-check at ${stemsUrl} — this site is not a member`;
      const stems = new RegExp(`(${stemsLine[1]})`, "i");

      const ctx = (text, i, len) => {
        const a = Math.max(0, i - 40), b = Math.min(text.length, i + len + 40);
        return `"${(a ? "…" : "") + text.slice(a, b).replace(/\s+/g, " ") + (b < text.length ? "…" : "")}"`;
      };
      const hits = [];
      const scan = (side, text, rules) => {
        for (const [what, re] of rules) {
          const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
          let m;
          while ((m = g.exec(text))) {
            const word = what === "stem" ? m[0].replace(/[^a-z]+$/i, "") : what;
            hits.push(`[${side}] ${word} in ${ctx(text, m.index, m[0].length)}`);
            if (g.lastIndex === m.index) g.lastIndex++;
          }
        }
      };

      // English: the rendered page, minus code, scripts and styles.
      const english = await page.evaluate(() => {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll("code, pre, script, style").forEach(el => el.remove());
        return clone.innerText;
      });
      scan("en", english, [
        ["spaced en-dash", / – /],
        ["„", /„/], ["«", /«/], ["»", /»/],
        ["stem", stems],
      ]);

      // German: every translated value in the source, decoded, with tags and code removed.
      const src = await (await fetch(spec.absolute)).text();
      const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      const values = [...src.matchAll(/data-(?:de|notes-de)="([^"]*)"/g)]
        .map(m => decode(m[1]).replace(/<code[\s\S]*?<\/code>/g, " ").replace(/<[^>]+>/g, " "));
      const german = values.join("\n");
      scan("de", german, [
        ["ß", /ß/],
        ["„", /„/], ["“", /“/], ["”", /”/],
        ["em-dash", /—/],
        ["du-form", /\b(du|dich|dir|dein|deine|deinen|deinem|deiner|deines)\b/i],
      ]);

      return hits.length ? hits.join("; ") : null;
    },
```

- [ ] **Step 4: Run the tests until they pass**

```bash
node --test test/verify-pages.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"; npm test 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: no `not ok`; the whole suite passes. If the stub tests fail on `page.evaluate`, the check called it with arguments the stub ignores; that is fine, the stub returns its string regardless.

- [ ] **Step 5: Commit**

```bash
git checkout -b page-typography
git add verify/pages.mjs test/verify-pages.test.mjs
git commit -F - <<'EOF'
typography: the shared page check that reads both halves of a page

English comes from the rendered text with code removed, German from the cold source's
data-de and data-notes-de values with tags and code removed, each held to WRITING.md's
marks: no ß, no „ “ ”, no em-dash and no du-form on the German side; no spaced en-dash, no
German quote and no British stem on the English side. The stems are not written here — the
check fetches the site's vendored conventions-check and reads its STEMS= line, so the
family keeps one list and a site without it fails as a non-member. Every hit names its
side, the mark or word, and forty characters of context each way.

It sits before translates, which is the one check that changes what the others read.

Verified: node --test, all pass, including five new tests over a stub page and stub fetch.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: The runner requires it, and `fmtPeriod` sets the dash per language

**Files:**
- Modify: `verify/suite.mjs` (one guard beside the `seo` guard)
- Modify: `test/suite.test.mjs` (one test)
- Modify: `assets/stage.js` (`fmtPeriod`)
- Modify: `package.json` (version)

**Interfaces:**
- Produces: `runSuite` fails naming pages whose spec lacks `typography: true`. `fmtPeriod` renders `May 2012–Oct 2016` in English and `Mai 2012 – Okt 2016` in German; the open range keeps its spaced dash before *now* in both, since *now* is a word, not a date.

- [ ] **Step 1: The failing suite test**

In `test/suite.test.mjs`, after the test named "a page that has not opted into tokenVersion is a failure", add:

```js
test("a page that has not opted into typography is a failure", async (t) => {
  const o = OPTS(); o.PAGES = [{ path: "/", seo: true, tokenVersion: true, fences: ["design tokens"] }];
  assert.ok(await runSuite(o) > 0, "a page without typography passed");
});
```
Look at how the tokenVersion test builds `OPTS()` and stubs its browser; mirror it exactly.

- [ ] **Step 2: Run it, watch it fail, add the guard**

```bash
node --test test/suite.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"
```
Then in `verify/suite.mjs`, after the `fences` guard block, add:

```js
  // And every page must opt into typography, for the same reason as seo: the runner skips a
  // check whose key is undefined, so a page left out of this one is a page whose German half
  // no test reads. WRITING.md binds every page; the guard is what makes that true here.
  {
    const off = PAGES.filter(p => !p.typography).map(p => p.path);
    if (off.length) { console.log("✗ PAGES  typography is not enabled on: " + off.join(", ")); failures++; }
  }
```
Rerun: the new test passes. Then update every existing `PAGES` fixture in `test/suite.test.mjs` that is meant to pass so it carries `typography: true` (the ones asserting `=== 0` failures), and run the whole file again until green.

- [ ] **Step 3: `fmtPeriod`**

In `assets/stage.js`, replace the function with:

```js
  function fmtPeriod(st){
    if (!st || !st.start) return "";
    if (!st.end) return fmtDate(st.start) + " – " + t("now");
    if (st.end === st.start) return fmtDate(st.start);
    // A range between two dates: English closes the en-dash, German spaces it. The open range
    // above keeps its spaces in both, because "now" is a word and not a date.
    return fmtDate(st.start) + (lang() === "de" ? " – " : "–") + fmtDate(st.end);
  }
```
Prove it the way `fmtDate` was proven for 0.26.0:
```bash
node -e '
const src = require("fs").readFileSync("assets/stage.js","utf8");
const m = src.match(/var MONTHS = \{[\s\S]*?\};/)[0], d = src.match(/function fmtDate\(v\)\{[\s\S]*?\n  \}/)[0], p = src.match(/function fmtPeriod\(st\)\{[\s\S]*?\n  \}/)[0];
for (const L of ["en","de"]) { const lang = () => L, t = () => (L==="de"?"heute":"now"); eval(m + d + p + "; console.log(L, fmtPeriod({start:\"2012-05\",end:\"2016-10\"}), \"|\", fmtPeriod({start:\"2012-05\"}))"); }'
```
Expected: `en May 2012–Oct 2016 | May 2012 – now` and `de Mai 2012 – Okt 2016 | Mai 2012 – heute`.

- [ ] **Step 4: Version, tests, commit**

`package.json` version `0.27.0` → `0.28.0`. Then:
```bash
npm test 2>&1 | grep -E "^ℹ (pass|fail)"; sh conventions/conventions-check; echo "exit $?"
git add verify/suite.mjs test/suite.test.mjs assets/stage.js package.json
git commit -F - <<'EOF'
Every page opts into typography, and a date range takes its language's dash

The runner refuses a PAGES entry without typography: true, as it refuses one without seo,
because a page left out is a page whose German half no test reads. fmtPeriod closes the
en-dash between two English dates and spaces it between two German ones; the open range
before "now" keeps its spaces in both, since now is a word.

stage.js is a synced asset, so every site's copy is stale: 0.28.0.

Verified: npm test all pass; fmtPeriod proven in both languages from the file's own source.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: Pull request, merge, tag

- [ ] **Step 1: Push and open**

```bash
git push -u origin page-typography
gh pr create --title "Design 0.28.0: the typography check, and a date range's dash per language" --body "$(cat <<'EOF'
`typography` joins the shared page checks before `translates`. It reads English from the rendered page with code removed and German from the cold source's `data-de` and `data-notes-de` values, holds each to WRITING.md's marks, and fetches the British stems from the site's own vendored `conventions-check` so the family keeps one list. The runner refuses a page that has not opted in. `fmtPeriod` closes the en-dash between two English dates and spaces it between two German ones.

After the merge: tag v0.28.0. Each site then takes the release, opts every page in, and sweeps its text in one pull request; the spec's counts are 22 German quote pairs, 163 German em-dashes, 81 English spaced en-dashes and 34 German clips across the three.

Verified: `npm test` all pass, five new checks over a stub page; `fmtPeriod` proven in both languages.
EOF
)"
gh pr checks --watch
```

- [ ] **Step 2: Stop for the owner's word; then merge and tag**

```bash
gh pr merge --merge && git checkout main && git pull && git branch -d page-typography
gh release create v0.28.0 --target main --title "v0.28.0" --notes "$(cat <<'EOF'
A `typography` page check joins the shared checks, before `translates`: it reads English from the rendered page and German from the `data-de` and `data-notes-de` values in the source, drops code on both sides, and holds each to `WRITING.md`'s marks, with the British stems read from the site's vendored `conventions-check`. `verify` refuses a page in `PAGES` that does not carry `typography: true`. `fmtPeriod` in `stage.js` closes the en-dash between two English dates and spaces it between two German ones.

Taking it: `npm run design`, `typography: true` on every page, then a sweep of the pages the check names — German quotes to «…», German em-dashes to spaced en-dashes, English spaced en-dashes to spaced em-dashes — with the German narration clips whose notes moved regenerated, both PDFs and every card re-exported, and the agent file's quote rule rewritten for guillemets. Sites in `REPOSITORIES.md` order.
EOF
)"
```

---

### Task 4: blust.ch takes the release and sweeps

**Files (in `~/git/robertblust/robertblust.github.io`):**
- Modify: `package.json`, `package-lock.json`, `verify/check.mjs`, `AGENTS.md`, every `index.html` the check names, `talks/*/audio/de/*.mp3`, `talks/*/*.pdf`, every `og.png` and `og.sha`, and the fenced copies `npm run design` writes.

**Interfaces:**
- Consumes: design v0.28.0 on the remote.
- Produces: a green `verify` with `typography` on all eight pages.

- [ ] **Step 1: Take the release, opt in, see what the check says**

```bash
cd ~/git/robertblust/robertblust.github.io && git checkout main && git pull && git checkout -b page-typography
sed -i.bak 's|design#v0.27.0|design#v0.28.0|' package.json && rm package.json.bak
rm -rf node_modules/@robertblust/design && npm install --save-dev --no-audit --no-fund "@robertblust/design@github:robertblust/design#v0.28.0"
grep -A1 '"node_modules/@robertblust/design"' package-lock.json | grep version
npm run design
python3 - <<'EOF'
import re,pathlib
p=pathlib.Path("verify/check.mjs"); s=p.read_text()
s2,n=re.subn(r'(\{ path: "[^"]+",)', r'\1 typography: true,', s)
p.write_text(s2); print("pages opted in:", n)
EOF
(python3 -m http.server 8000 >/dev/null 2>&1 & echo $! > /tmp/srv.pid); until curl -s -o /dev/null http://localhost:8000/; do python3 -c "import time; time.sleep(0.2)"; done
npm run verify > /tmp/verify.txt 2>&1; echo "verify exit $?"; grep -E "typography|✗|checks pass" /tmp/verify.txt > /tmp/typo-before.txt; wc -l /tmp/typo-before.txt
```
Expected: `pages opted in: 8`; verify fails with `typography` findings on most pages. Keep `/tmp/typo-before.txt`; it is the list the sweep must clear.

- [ ] **Step 2: The mechanical sweep, German then English**

Save this as `/tmp/sweep.py` and run it from the repository root; it edits every `index.html` in place, reports counts, and touches nothing inside `<script>`, `<style>`, `<code>`, `<pre>` or inside a tag's attributes other than `data-de` and `data-notes-de` values.

```python
import re, pathlib, sys

def sweep_german(v):
    # „…“ → «…»; a pair nested inside another becomes ‹…›.
    out, depth = [], 0
    for ch in v:
        if ch == "„":
            out.append("«" if depth == 0 else "‹"); depth += 1
        elif ch == "“" and depth > 0:
            depth -= 1; out.append("»" if depth == 0 else "›")
        else:
            out.append(ch)
    v = "".join(out)
    v = re.sub(r"\s*—\s*", " – ", v)          # em-dash, however spaced, → spaced en-dash
    return v

def sweep_english_text(t):
    # spaced en-dash between words → spaced em-dash; between two digits or dates → closed en-dash
    t = re.sub(r"(?<=\d) – (?=\d)", "–", t)
    t = re.sub(r"(?<=[A-Za-z]{3} \d{4}) – (?=[A-Za-z]{3} \d{4})", "–", t)
    t = t.replace(" – ", " — ")
    return t

for f in sorted(pathlib.Path(".").rglob("index.html")):
    if "node_modules" in f.parts or ".superpowers" in f.parts: continue
    s = f.read_text()
    before = s
    # 1. German values
    s = re.sub(r'(data-(?:de|notes-de)=")([^"]*)(")', lambda m: m.group(1) + sweep_german(m.group(2)) + m.group(3), s)
    # 2. English text nodes outside script/style/code/pre and outside tags
    parts = re.split(r"(<script[\s\S]*?</script>|<style[\s\S]*?</style>|<code[\s\S]*?</code>|<pre[\s\S]*?</pre>|<!--[\s\S]*?-->|<[^>]+>)", s)
    for i in range(0, len(parts), 2):
        parts[i] = sweep_english_text(parts[i])
    s = "".join(parts)
    if s != before:
        f.write_text(s)
        print(f, "changed:", sum(1 for a, b in zip(before.split("\n"), s.split("\n")) if a != b), "lines")
```

```bash
python3 /tmp/sweep.py
grep -c "„" $(git ls-files '*.html'); grep -o -c "—" talks/mental-model/index.html
npm run verify > /tmp/verify.txt 2>&1; echo "verify exit $?"; grep -E "typography|✗|checks pass" /tmp/verify.txt
```
Expected: the German quote count is 0; `typography` hits drop to whatever the script could not decide — read each remaining one, fix it by hand, rerun until `all checks pass`. A `<title>` is a text node and is swept; a `content="…"` attribute is not, and English `data-notes` values are not either — the 49 English spaced en-dashes in blust.ch's `data-notes` stay by ruling, because the check does not read them and moving them regenerates English clips; check `og:description` and `meta description` by hand for spaced en-dashes and fix them the same way.

- [ ] **Step 3: The serial comma, by reading**

```bash
python3 - <<'EOF'
import re,pathlib,html
for f in sorted(pathlib.Path(".").rglob("index.html")):
    if "node_modules" in f.parts or ".superpowers" in f.parts: continue
    s=f.read_text()
    s=re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>|<!--[\s\S]*?-->|data-(?:de|notes-de)=\"[^\"]*\"","",s)
    text=html.unescape(re.sub(r"<[^>]+>"," ",s))
    for m in re.finditer(r"[^.!?]*\b\w+, \w+(?: \w+){0,4}, and\b[^.!?]*[.!?]",text):
        print(f, "::", " ".join(m.group(0).split())[:160])
EOF
```
Each line is a candidate. Remove the comma before `and` only where the sentence lists three or more parallel items; leave it where `and` joins two independent clauses. Edit the source by hand. Report the count changed and the count left.

- [ ] **Step 4: Narration**

```bash
./tts/generate.py --dry-run
```
Expected: it names German clips only, one per note the sweep touched, and no English clip. If it names an English clip, find the English text the sweep changed in that note and decide whether the change was right; do not generate until the dry run is understood. Then, on the owner's word, since this bills:
```bash
export ELEVENLABS_API_KEY="$(zsh -ic 'printf %s "$ELEVENLABS_API_KEY"' 2>/dev/null)"
./tts/generate.py
./tts/generate.py --dry-run   # expect nothing to write
```

- [ ] **Step 5: PDFs, cards, the agent file**

```bash
npm run pdf && npm run og && npm run og:check && npm run design:check && npm run verify 2>&1 | tail -1
```
In `AGENTS.md`, the bullet *German quotes must be typographic* becomes:
```
- **German quotes are guillemets**, `«…»` with `‹…›` inside — the Swiss form WRITING.md sets. They
  also cannot end an attribute: one straight ASCII `"` inside a note ends it early and dumps the
  rest of the note onto the slide, which is what the old „…“ rule existed to prevent.
```
Run `sh conventions/conventions-check` and `./tts/generate.py --dry-run` once more.

- [ ] **Step 6: Commit, push, pull request; stop for the merge**

```bash
kill $(cat /tmp/srv.pid)
git add -A
git commit -F - <<'EOF'
Design 0.28.0, and the pages set the way WRITING.md says

The typography check runs on all eight pages. German quotes are guillemets and German
dashes are spaced en-dashes, in every data-de and data-notes-de; English spaced en-dashes
in page text are spaced em-dashes, the 49 in data-notes stay where the check does not read
them, and date ranges close theirs. The serial comma left <N> lists after a reading pass.
<M> German clips regenerated because their notes moved; no English clip did.
Both PDFs of both decks and every card are re-exported, and the quote rule in this file is
written for guillemets.

Verified: npm run verify all checks pass with typography on every page; og:check,
design:check and the narration dry run report nothing stale.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
git push -u origin page-typography
gh pr create --title "Design 0.28.0, and the pages set the way WRITING.md says" --body "<the commit body reread for a reviewer, plain paragraphs, with the real numbers>"
gh pr checks --watch
```
Fill `<N>` and `<M>` with the measured numbers before committing. Stop; the merge is the owner's.

---

### Task 5: guestgraph.io, the same

Repeat Task 4 in `~/git/guestgraph/guestgraph.github.io` with these differences: five pages; the narration generator is `talks/intro/tts/generate.py` and is run from `talks/intro/tts/`; there is no `tts/` at the root; the agent file's quote rule is the bullet under *Notes live inside HTML attributes*; there are no English spaced en-dashes expected, so Step 2's English pass should report no change and Step 3's list is short. One British stem the sweep cannot clear: `instalments` in `billing/index.html` (line 604 at the time of writing) becomes `installments`, by hand, before the check is rerun. Same commit and pull request shape with its own numbers. Stop for the merge.

---

### Task 6: companygraph.io, the same

Repeat Task 4 in `~/git/companygraph/companygraph.github.io` with these differences: seven pages; the narration generator is `talks/intro/tts/generate.py`; the agent file's quote rule is inside the bullet *Notes are `data-notes` (English) and `data-notes-de` (German)* under *The deck and the talks index*, and the parenthesis there is rewritten for guillemets; `npm run example:check` and `npm run pin:check` join the checks in Step 5. Same commit and pull request shape with its own numbers. Stop for the merge.

---

### Task 7: Read-through, then stop

Report in the reply register: v0.28.0 released; per site, the counts swept, the clips regenerated, the lists read; every check green. Update the project memory: the page typography work is done, WRITING.md's German and English rules are enforced on every page, and what remains in the family is nothing queued.
