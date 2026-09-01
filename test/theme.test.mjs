import { test } from "node:test";
import assert from "node:assert/strict";
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

function makeNoFlashProbe({ early, calls }) {
  return {
    async addInitScript(fn, arg) { calls.addInit.push(arg); },
    async goto(url, opts) { calls.goto.push({ url, opts }); },
    async evaluate() { return early; },   // stands in for the real page reading data-theme
    async close() { calls.closed = true; },
  };
}

test("noFlash returns null only for a genuinely light first paint, and always waits on \"commit\"", async () => {
  // A body that reads `waitUntil: "commit"` in its source and then always `return null` (a
  // comment standing in for the actual read, or the `if` commented out) satisfied the old
  // string-matching tests outright. Driving the real check with a fake probe that reports
  // different first-paint states, and checking both the returned value and what goto was
  // actually called with, does not have that hole.
  const spec = { absolute: "https://x.test/", noFlash: "rb-theme" };
  for (const [early, shouldPass] of [["light", true], ["dark", false], [null, false]]) {
    const calls = { addInit: [], goto: [], closed: false };
    const probe = makeNoFlashProbe({ early, calls });
    const fakePage = { context: () => ({ browser: () => ({ newPage: async () => probe }) }) };
    const result = await pageChecks(THEME_OPTS).noFlash(fakePage, spec);
    if (shouldPass) {
      assert.equal(result, null, `data-theme ${JSON.stringify(early)} at first paint should pass, got ${JSON.stringify(result)}`);
    } else {
      assert.equal(typeof result, "string",
        `data-theme ${JSON.stringify(early)} at first paint should have failed with a message, got ${JSON.stringify(result)}`);
    }
    assert.equal(calls.goto.length, 1, "goto was not called exactly once");
    assert.equal(calls.goto[0].opts && calls.goto[0].opts.waitUntil, "commit",
      `goto must be called with waitUntil: "commit", got ${JSON.stringify(calls.goto[0].opts)}`);
    assert.ok(calls.closed, "the probe page was never closed");
  }
});
