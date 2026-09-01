import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { blockFor, FENCES } from "@robertblust/design/fences";
import { FAMILY } from "@robertblust/design/family";
import { pageChecks } from "@robertblust/design/verify/pages";

// WCAG 2.1 relative luminance. Inlined rather than imported: the package has no dependencies,
// and a contrast test that trusts a helper it also ships proves less than one that does not.
const hex = (h) => { h = h.replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
const lum = (h) => { const [r, g, b] = hex(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Parse `--name:#value` pairs out of one rule of the emitted block.
function palette(css, selector) {
  // `selector` arrives already regex-escaped by its callers (":root" needs none,
  // ':root\[data-theme="light"\]' escapes its own brackets) — escaping again here would
  // double the backslashes and never match the real, unescaped CSS.
  const m = css.match(new RegExp(selector + "\\{([\\s\\S]*?)\\n  \\}"));
  assert.ok(m, `no ${selector} rule in the emitted block`);
  return Object.fromEntries([...m[1].matchAll(/--([a-z-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)].map((x) => [x[1], x[2]]));
}

const TEXT = ["ink", "dim", "c-mid", "c-firm", "c-flag"];

test("both themes define the same token names", () => {
  // A name present in one theme and missing in the other is invisible until someone switches
  // on the one page that uses it — the palette must be total, not mostly total.
  const css = blockFor("design tokens", "page");
  const dark = palette(css, ":root");
  const light = palette(css, ':root\\[data-theme="light"\\]');
  assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort());
});

test("every text token clears AA against its own ground, in both themes", () => {
  // The reason this plan exists: reusing the dark ramp on light put --c-mid, which paints
  // every link, at 2.47:1. This is the gate that stops that shipping again.
  const css = blockFor("design tokens", "page");
  for (const [name, sel] of [["dark", ":root"], ["light", ':root\\[data-theme="light"\\]']]) {
    const p = palette(css, sel);
    for (const t of TEXT) {
      const r = ratio(p[t], p.ground);
      assert.ok(r >= 4.5, `${name}: --${t} is ${r.toFixed(2)}:1 on --ground, needs 4.5`);
    }
  }
});

test("the confidence ramp is ordered in both themes, in opposite directions", () => {
  // The block's grammar, asserted rather than described. Dark: brighter is firmer.
  // Light: darker is firmer. A ramp that is not monotonic means the stops stopped meaning
  // anything, which no contrast check would catch.
  const css = blockFor("design tokens", "page");
  const d = palette(css, ":root"), l = palette(css, ':root\\[data-theme="light"\\]');
  assert.ok(lum(d["c-weak"]) < lum(d["c-mid"]) && lum(d["c-mid"]) < lum(d["c-firm"]),
    "dark ramp is not brighter-is-firmer");
  assert.ok(lum(l["c-weak"]) > lum(l["c-mid"]) && lum(l["c-mid"]) > lum(l["c-firm"]),
    "light ramp is not darker-is-firmer");
});

test("--sky is derived, so it follows the theme without being restated", () => {
  // If someone ever writes literal colours into --sky, the light theme keeps the dark
  // gradient and nobody notices until they look at the top of a light page.
  const css = blockFor("design tokens", "page");
  assert.match(css, /--sky:radial-gradient\([^;]*var\(--raise\)[^;]*var\(--ground\)[^;]*\);/);
  const light = css.match(/:root\[data-theme="light"\]\{([\s\S]*?)\n  \}/)[1];
  assert.doesNotMatch(light, /--sky:/, "the light half restates --sky instead of deriving it");
});

test("--c-weak stays below the 3:1 UI threshold against --ground, in both themes", () => {
  // Every other assertion here is a floor. This one is a ceiling, because --c-weak's job is
  // the opposite of the other stops': "a candidate, considered but not accepted" only reads as
  // tentative while it stays under the threshold that would make it usable as a UI colour in
  // its own right. Raising it — even to keep the ramp monotonic, even while every other test
  // stays green — reverses that decision silently. A comment saying so does not enforce it;
  // this does.
  const css = blockFor("design tokens", "page");
  for (const [name, sel] of [["dark", ":root"], ["light", ':root\\[data-theme="light"\\]']]) {
    const p = palette(css, sel);
    const r = ratio(p["c-weak"], p.ground);
    assert.ok(r < 3, `${name}: --c-weak is ${r.toFixed(2)}:1 on --ground, must stay below 3`);
  }
});

test("--press clears AA against --c-mid, the text token it actually carries, in both themes", () => {
  // `.seg button[aria-pressed="true"]` paints --c-mid on --press — the pressed EN and the
  // pressed sun/moon, the only things telling a reader which language and which theme is
  // active. Light's pair was #3A6DA6 on #E2E8F2, 4.35:1, under the 4.5 floor this test pins.
  // Run this against that value and it fails; it must stay failing if --press is ever moved
  // back there.
  const css = blockFor("design tokens", "page");
  for (const [name, sel] of [["dark", ":root"], ["light", ':root\\[data-theme="light"\\]']]) {
    const p = palette(css, sel);
    const r = ratio(p["c-mid"], p.press);
    assert.ok(r >= 4.5, `${name}: --c-mid on --press is ${r.toFixed(2)}:1, needs 4.5`);
  }
});

test("--press exists in both themes and is not --raise", () => {
  // #1b2231 and #1b2333 were one colour typed twice; --press is the single name. It is blue-
  // tinted where --raise is neutral, and folding them together would change three pages'
  // primary button.
  const css = blockFor("design tokens", "page");
  for (const sel of [":root", ':root\\[data-theme="light"\\]']) {
    const p = palette(css, sel);
    assert.ok(p.press, `no --press in ${sel}`);
    assert.notEqual(p.press, p.raise, `--press equals --raise in ${sel}`);
  }
});

const TP = { themeKey: "x-theme" };

test("neither theme block hardcodes a site's storage key", () => {
  // The defect this exact shape caused once before, in `language` v1: a real key was baked in
  // at extraction, correct for one site and wrong for the other two, with no fixed point —
  // the sync tool corrected the visible bytes forever while the block re-emitted the frozen
  // value. The parameter is what makes both passes agree.
  for (const f of ["theme boot", "theme"]) {
    const js = blockFor(f, null, TP);
    assert.match(js, /x-theme/, `${f} did not substitute themeKey`);
    assert.doesNotMatch(js, /rb-theme|cg-theme|gg-theme/, `${f} carries a real site's key`);
  }
});

test("the boot block reads the URL as well as storage", () => {
  // A visitor arriving from a sibling domain with ?theme=light must paint light on the first
  // frame. Reading only localStorage would give them one frame of dark on every crossing.
  const js = blockFor("theme boot", null, TP);
  assert.match(js, /location\.search/);
  assert.match(js, /localStorage\.getItem/);
});

test("the boot block lets the URL win over storage, not the other way round", () => {
  // A visitor with theme=dark stored on companygraph.io who arrives from blust.ch on a link
  // carrying ?theme=light must paint light — the URL is the more recent, more specific choice.
  // `stored || (m && m[1])` would let the older, unrelated-site value win instead; this pins
  // the ternary so storage is only ever the fallback when the URL carries nothing.
  const js = blockFor("theme boot", null, TP);
  assert.match(js, /var t = m \? m\[1\] : localStorage\.getItem\(/,
    "the URL match must be read before storage, as the ternary's condition, not merely present");
});

test("the boot block never reads prefers-color-scheme", () => {
  // Spec decision 4: dark is the default and the OS is not consulted. This is the assertion
  // that stops a later "helpful" change from quietly making light the default for most
  // visitors — which would also stop the share cards matching the pages.
  //
  // Stripped of its block comments first, the same way `carriesLang` is checked in
  // test/verify-pages.test.mjs (there with `.replace(/\/\/.*$/gm, "")` for // comments) — an
  // assertion over raw text otherwise conflates code and prose. The block's own doc comment is
  // allowed, and needs, to name `prefers-color-scheme`: saying what the code deliberately does
  // not do is the whole value of that sentence. Only the code is forbidden from reading it.
  const js = blockFor("theme boot", null, TP);
  const code = js.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(code, /prefers-color-scheme|matchMedia/);
});

test("the boot block is guarded, because file:// throws", () => {
  // localStorage on an opaque origin throws rather than returning null. A deck must still open.
  // Asserting only that a `try { ... } catch` exists somewhere is satisfied by a stray, unrelated
  // guard — `localStorage.getItem` moved outside any try and a decoy `try{void 0}catch(e){}` left
  // behind passes that check while throwing synchronously in the only <head> script on the page.
  // So the read itself has to be found inside the try it is claimed to be guarded by.
  const js = blockFor("theme boot", null, TP);
  const m = /try\s*\{([\s\S]*?)\}\s*catch/.exec(js);
  assert.ok(m, "no try/catch found");
  assert.match(m[1], /localStorage\.getItem/,
    "the localStorage read is not inside the try block that is supposed to guard it");
});

test("theme carries the param to family domains only", () => {
  const js = blockFor("theme", null, TP);
  assert.match(js, /THEME_FAMILY\s*=\s*\/\^\(www\\\.\)\?\(blust\\\.ch\|companygraph\\\.io\|guestgraph\\\.io\)\$\//);
  assert.match(js, /u\.origin === location\.origin \|\| !THEME_FAMILY\.test\(u\.hostname\)/);
});

test("the theme block carries FAMILY's source text, so page and check agree", () => {
  // lib/family.mjs exists because this pattern was hardcoded in twenty-three places, and a
  // fourth domain added there once left one of the copies behind with nothing to notice. The
  // language block is pinned to it by test/params.test.mjs's identically named test; THEME_FAMILY
  // in blocks/theme.js is a second literal copy, and this is what pins that one the same way —
  // add a domain to lib/family.mjs and this test is what fails instead of theme.js silently
  // going on carrying the theme to only three of the four.
  const js = blockFor("theme", null, TP);
  assert.ok(js.includes(FAMILY.source),
    "theme.js's inline THEME_FAMILY regex has drifted from lib/family.mjs");
});

test("theme decorates on mousedown as well as click", () => {
  // A middle-click or cmd-click opens a new tab without ever firing click.
  const js = blockFor("theme", null, TP);
  assert.match(js, /addEventListener\("mousedown", carryTheme, true\)/);
  assert.match(js, /addEventListener\("click", carryTheme, true\)/);
});

// carryTheme's own defect could not be caught by a `.toString()` match: the broken code and
// the fixed code both mention `theme`, `searchParams.set` and `THEME_FAMILY` in source, so a
// regex over the text cannot tell "always carries" from "carries only when chosen" apart. The
// block is executed for real instead, in a small vm sandbox standing in for the page it is
// normally injected into — the same reasoning `test/verify-pages.test.mjs`'s fix-round-1 suite
// gives for running check bodies against a fake `page` rather than grepping them.
function runThemeBlock() {
  const js = blockFor("theme", null, TP);
  const store = {};
  const localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
  };
  const sandbox = {
    console, URL,
    localStorage,
    location: { href: "https://blust.ch/", origin: "https://blust.ch", search: "", pathname: "/", hash: "" },
    history: { replaceState() {} },
    document: { addEventListener() {} },
    theme: "dark",
  };
  vm.createContext(sandbox);
  vm.runInContext(js, sandbox);
  return sandbox;
}

test("carryTheme decorates a family link only when a theme is actually stored", () => {
  // The failure this closes: Alice sets light on companygraph.io, later opens blust.ch fresh
  // (dark, correct, untouched), then clicks the CompanyGraph link. Carrying `theme` from the
  // in-memory default — indistinguishable from an actual choice — would overwrite her real,
  // stored preference with a value she never chose. `themeStored()` returning null must
  // therefore leave every link alone.
  const sandbox = runThemeBlock();
  const untouched = { href: "https://companygraph.io/" };
  sandbox.carryTheme({ target: { closest: () => untouched } });
  assert.equal(untouched.href, "https://companygraph.io/",
    "a visitor with nothing stored must have no link decorated — a default is not a choice");

  sandbox.localStorage.setItem("x-theme", "light");
  const decorated = { href: "https://companygraph.io/" };
  sandbox.carryTheme({ target: { closest: () => decorated } });
  assert.match(decorated.href, /[?&]theme=light(&|$)/,
    "a visitor who stored a theme must have it carried onto a family link");
});

test("theme cleans the address bar after adopting a param", () => {
  const js = blockFor("theme", null, TP);
  assert.match(js, /history\.replaceState/);
});

test("both theme fences declare themeKey and no variants", () => {
  for (const f of ["theme boot", "theme"]) {
    assert.deepEqual(FENCES[f].params, ["themeKey"]);
    assert.equal(FENCES[f].variants, null);
  }
});

// Fix round 1: every test below used to assert over `.toString()` of a check body — matching
// source text rather than running it. A reviewer defeated all three by writing check bodies
// that contained the matched tokens (in code or in a comment) while doing nothing: a
// comment-only body plus `return null`, a token loop narrowed to a single passing token, and
// a click guarded by `&& false`. `Function.prototype.toString()` includes comments that sit
// *inside* the body, so a broken implementation can spell out the exact regex a test greps
// for. The fix below runs each check against a fake `page` — the same object these checks
// already receive and the only thing that makes them testable without Playwright — and
// asserts on what the check actually does, the way `httpStatus`'s `bodyUsed` test and
// `opensFromFile`'s spawned-process test already do in this package.
const THEME_OPTS = { SITE: "https://x.test", BASE: "http://x.local" };

test("storageKeys actually clicks the theme control, not merely names it behind a dead guard", async () => {
  // A guard written as `if (await page.$("#thLight") && false)` still contains the string
  // "#thLight" and the literal click call in source, so a `.toString()` test cannot tell it
  // from working code. Recording what `page.click` is actually called with can.
  const clicks = [];
  const fakePage = {
    addInitScript: async () => {},
    goto: async () => {},
    $: async () => true,               // every control is "present"
    click: async (sel) => { clicks.push(sel); },
    focus: async () => {},
    keyboard: { press: async () => {} },
    evaluate: async () => [],
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ text: async () => "" });
  try {
    await pageChecks(THEME_OPTS).storageKeys(fakePage, { absolute: "https://x.test/" });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.ok(clicks.includes("#thLight"), `#thLight was never clicked; clicks were ${JSON.stringify(clicks)}`);
  assert.ok(clicks.includes("#thDark"), `#thDark was never clicked; clicks were ${JSON.stringify(clicks)}`);
});

test("storageKeys reports an undeclared key, and passes when every written key is named", async () => {
  // Fix round 2: the fake above always returns [] from evaluate, so `written` is empty
  // inside the real check no matter what was clicked — the undeclared-key branch, which is
  // the entire point of this check (the check exists to catch /privacy/ omitting a key a
  // real visitor's browser writes), was never exercised. A reviewer replaced the check's
  // whole tail with an unconditional `return null;` and the click test above stayed green,
  // because it never looks at the return value. This fake instead returns a realistic
  // written-key list from `evaluate`, and `fetch` is stubbed to return a `/privacy/` document
  // that names some keys and not others, so both directions of the real comparison run.
  //
  // `storageKeys` calls `page.evaluate` twice — once to read the written keys, once to clear
  // storage afterward — so the fake has to answer the first call with the key list and the
  // second with something the check does not inspect.
  async function run(writtenKeys, declaredText) {
    let evalCalls = 0;
    const fakePage = {
      addInitScript: async () => {},
      goto: async () => {},
      $: async () => true,
      click: async () => {},
      focus: async () => {},
      keyboard: { press: async () => {} },
      async evaluate() {
        evalCalls += 1;
        return evalCalls === 1 ? writtenKeys : undefined;
      },
    };
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ text: async () => declaredText });
    try {
      return await pageChecks(THEME_OPTS).storageKeys(fakePage, { absolute: "https://x.test/" });
    } finally {
      globalThis.fetch = realFetch;
    }
  }

  const clean = await run(["rb-lang", "rb-theme"], "<p>This site stores rb-lang and rb-theme.</p>");
  assert.equal(clean, null, `every written key is declared; expected null, got ${JSON.stringify(clean)}`);

  const dirty = await run(["rb-lang", "rb-theme", "rb-secret"], "<p>This site stores rb-lang and rb-theme.</p>");
  assert.ok(dirty, "an undeclared key should have been reported, got null");
  assert.match(dirty, /rb-secret/);
});

// contrast's page.evaluate callback is self-contained — it reads document.documentElement,
// getComputedStyle and the token values, and closes over nothing from pages.mjs's module
// scope. That makes it possible to hand the real callback a stubbed document/getComputedStyle
// and run it for real, rather than mocking the check itself.
function makeContrastPage(palettes) {
  return {
    async evaluate(fn) {
      let theme = null; // null: no data-theme attribute, i.e. dark
      const documentElement = {
        setAttribute(name, v) { if (name === "data-theme") theme = v; },
        removeAttribute(name) { if (name === "data-theme") theme = null; },
      };
      const getComputedStyle = () => {
        const vals = palettes[theme === "light" ? "light" : "dark"];
        return { getPropertyValue: (name) => vals[name] ?? "" };
      };
      const hadDoc = "document" in globalThis, prevDoc = globalThis.document;
      const hadGCS = "getComputedStyle" in globalThis, prevGCS = globalThis.getComputedStyle;
      globalThis.document = { documentElement };
      globalThis.getComputedStyle = getComputedStyle;
      try { return fn(); }
      finally {
        if (hadDoc) globalThis.document = prevDoc; else delete globalThis.document;
        if (hadGCS) globalThis.getComputedStyle = prevGCS; else delete globalThis.getComputedStyle;
      }
    },
  };
}

test("contrast passes a fully AA palette and fails one where only --c-flag is under 4.5:1", async () => {
  const PASS_DARK = { "--ground": "#000000", "--ink": "#ffffff", "--dim": "#ffffff",
    "--c-mid": "#ffffff", "--c-firm": "#ffffff", "--c-flag": "#ffffff" };
  const PASS_LIGHT = { "--ground": "#ffffff", "--ink": "#000000", "--dim": "#000000",
    "--c-mid": "#000000", "--c-firm": "#000000", "--c-flag": "#000000" };

  const ok = await pageChecks(THEME_OPTS).contrast(makeContrastPage({ dark: PASS_DARK, light: PASS_LIGHT }));
  assert.equal(ok, null, `a fully passing palette should clear, got ${JSON.stringify(ok)}`);

  // Only --c-flag fails, at ~1.66:1 against the same ground the other four tokens clear
  // easily. A check whose token loop was narrowed to, say, just --ink would still see a
  // passing palette here and return null — a test that only ever fails --ink could not tell
  // the difference. Failing the token that everything else ignores is what tells them apart.
  const failing = { ...PASS_DARK, "--c-flag": "#333333" };
  const bad = await pageChecks(THEME_OPTS).contrast(makeContrastPage({ dark: failing, light: PASS_LIGHT }));
  assert.ok(bad, "a --c-flag under 4.5:1 should have been reported, got null");
  assert.match(bad, /--c-flag/);
});

// noFlash no longer drives a browser at all — its whole input is the page's served HTML, so
// these fakes are documents, not a Playwright page. `wrap` builds one the way a real page
// carries the fence: a <script> holding the theme-boot marker (with the site's storage key
// baked in, the way blockFor substitutes {{themeKey}}), positioned and tagged however each
// case needs, followed by a stylesheet.
function wrap({ scriptTag = "<script>", beforeStyle = true, includeKey = true } = {}) {
  const key = includeKey ? "rb-theme" : "rb-something-else";
  const boot = `${scriptTag}
    /* ─── theme boot · v1 · shared ───
       Set the theme before anything paints.
    */
    (function(){
      try {
        var t = localStorage.getItem("${key}");
        if (t === "light") document.documentElement.setAttribute("data-theme", "light");
      } catch (e) {}
    })();
    /* ─── end theme boot ─── */
  </script>`;
  const style = `<style>body{color:red}</style>`;
  return `<!doctype html><html><head><title>x</title>${beforeStyle ? boot + style : style + boot}</head><body></body></html>`;
}

async function runNoFlash(html, spec = { absolute: "https://x.test/", noFlash: "rb-theme" }) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ text: async () => html });
  try {
    return await pageChecks(THEME_OPTS).noFlash({}, spec);
  } finally {
    globalThis.fetch = realFetch;
  }
}

// Fix round 2: a decoy occurrence of the marker text earlier in <head> — the kind of thing a
// JSON-LD description or a <meta> tag could carry once these repositories started describing
// the mechanism in prose — used to make the old substring search (`html.indexOf(MARKER)`)
// find that decoy first and walk backward to the <script> carrying *it*, not the real boot
// script. `realAfterStyle`/`realDefer` break the genuine fence exactly the way fix round 1's
// suite already proves the check must catch; the decoy is what round 1 could not see coming.
function decoyThenReal({ realAfterStyle = false, realDefer = false } = {}) {
  const decoy = '<script type="application/ld+json">{"@type":"WebPage","description":' +
    '"See the ─── theme boot fence and the rb-theme storage key for how this ' +
    'page avoids a flash of the wrong theme."}</script>';
  const real = `<script${realDefer ? " defer" : ""}>
    /* ─── theme boot · v1 · shared ───
       Set the theme before anything paints.
    */
    (function(){
      try {
        var t = localStorage.getItem("rb-theme");
        if (t === "light") document.documentElement.setAttribute("data-theme", "light");
      } catch (e) {}
    })();
    /* ─── end theme boot ─── */
  </script>`;
  const style = `<style>body{color:red}</style>`;
  const body = realAfterStyle ? decoy + style + real : decoy + real + style;
  return `<!doctype html><html><head><title>x</title>${body}</head><body></body></html>`;
}

test("noFlash is not fooled by a decoy marker occurrence earlier in <head>", async () => {
  // Both scenarios here would return `null` — a false pass — against the substring-search
  // implementation fix round 1 shipped: the decoy sits inside a <script type="application/
  // ld+json"> with none of the disqualifying attributes, positioned before <style>, and its
  // own text happens to include the storage key too (exactly what a page's own prose might
  // do once it starts describing this mechanism by name). The genuine fence's real defect —
  // misplaced or deferred — sat unexamined behind it. findFence's line-anchored grammar
  // cannot be satisfied by a JSON string on one line, so it must still find and judge the
  // one true fence, wherever the decoy sits.
  const cases = [
    {
      label: "decoy before a genuinely misplaced boot script (after <style>)",
      html: decoyThenReal({ realAfterStyle: true }),
      match: /appears after a stylesheet/,
    },
    {
      label: "decoy before a genuinely deferred boot script",
      html: decoyThenReal({ realDefer: true }),
      match: /\bdefer\b/,
    },
  ];
  for (const { label, html, match } of cases) {
    const result = await runNoFlash(html);
    assert.equal(typeof result, "string", `${label}: expected a failure message, got ${JSON.stringify(result)}`);
    assert.match(result, match, `${label}: got ${JSON.stringify(result)}`);
  }
});

test("noFlash asserts document order and script form, not timing", async () => {
  // Fix round 1 replaced a check that drove a browser and raced Playwright's "commit" event
  // against the page's own scripts. On a loopback static server the whole document — every
  // synchronous script included — has already run by the time "commit" fires, so that
  // version always observed the corrected state, wherever the boot script actually sat: it
  // passed a page a reviewer had broken by moving the real boot script below <style>. These
  // cases drive the replacement with fake HTML documents instead — its entire input now —
  // and each failing one is asserted to return a string, not merely a non-null value, so a
  // check narrowed to `return "broken"` unconditionally could not hide behind a loose
  // assertion the way the old, browser-driven version hid behind a race it always won.
  const cases = [
    {
      label: "boot block before <style>, inline script",
      html: wrap({ beforeStyle: true }),
      pass: true,
    },
    {
      label: "boot block after <style>",
      html: wrap({ beforeStyle: false }),
      pass: false,
      match: /appears after a stylesheet/,
    },
    {
      label: "boot block before <style> but on a module script",
      html: wrap({ beforeStyle: true, scriptTag: '<script type="module">' }),
      pass: false,
      match: /type="module"/,
    },
    {
      label: "boot block before <style> but on a deferred script",
      html: wrap({ beforeStyle: true, scriptTag: "<script defer>" }),
      pass: false,
      match: /\bdefer\b/,
    },
    {
      label: "boot block before <style> but on an async script",
      html: wrap({ beforeStyle: true, scriptTag: "<script async>" }),
      pass: false,
      match: /\basync\b/,
    },
    {
      label: "no theme-boot fence at all",
      html: `<!doctype html><html><head><title>x</title><style>body{}</style></head><body></body></html>`,
      pass: false,
      match: /no theme-boot fence/,
    },
    {
      label: "boot block present and well formed, but references the wrong key",
      html: wrap({ beforeStyle: true, includeKey: false }),
      pass: false,
      match: /does not reference/,
    },
  ];

  for (const { label, html, pass, match } of cases) {
    const result = await runNoFlash(html);
    if (pass) {
      assert.equal(result, null, `${label}: expected a pass, got ${JSON.stringify(result)}`);
    } else {
      // The vacuous-suite failure mode this replaces: a test that only checked
      // `result !== null` would pass for an unconditional `return "broken"`. Requiring a
      // string, and requiring it name the specific problem, closes both doors at once.
      assert.equal(typeof result, "string", `${label}: expected a failure message, got ${JSON.stringify(result)}`);
      assert.match(result, match, `${label}: got ${JSON.stringify(result)}`);
    }
  }
});
