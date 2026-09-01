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

test("storageKeys exercises the theme control, not only the language one", () => {
  // The theme key is written by every visitor who switches. If the check never clicks the
  // control, the key is never observed and /privacy/ can omit it with every suite green.
  const src = pageChecks({ SITE: "https://x.test", BASE: "http://x.local" }).storageKeys.toString();
  assert.match(src, /#thLight/);
  assert.match(src, /#thDark/);
  // The two ids alone would also match a stray comment naming them. Requiring the actual
  // click calls is what a comment could not satisfy.
  assert.match(src, /page\.click\("#thLight"\)/);
  assert.match(src, /page\.click\("#thDark"\)/);
});

test("contrast reads the live page and checks both themes", () => {
  const src = pageChecks({ SITE: "https://x.test", BASE: "http://x.local" }).contrast.toString();
  assert.match(src, /getComputedStyle/);
  assert.match(src, /\["dark", "light"\]/);
  // The two assertions above are satisfied by a body that names both themes and calls
  // getComputedStyle without ever comparing anything — which would always return null and
  // never fail on a real regression. These two close that gap: the check must actually flip
  // data-theme between iterations and compare a real ratio against the 4.5 floor.
  assert.match(src, /setAttribute\("data-theme", "light"\)/);
  assert.match(src, /removeAttribute\("data-theme"\)/);
  assert.match(src, /r < 4\.5/);
});

test("noFlash reads the attribute before the body scripts run", () => {
  // waitUntil "commit" is the point: "load" would let the body script set the attribute and
  // the check would pass on a page that flashes.
  const src = pageChecks({ SITE: "https://x.test", BASE: "http://x.local" }).noFlash.toString();
  assert.match(src, /waitUntil: "commit"/);
  assert.doesNotMatch(src, /waitUntil: "load"|networkidle/);
  // The line above only proves the right wait mode is named somewhere in the body — a
  // version that gotos with "commit" and then always returns null without reading anything
  // would still pass it. This proves the check actually reads the attribute and can fail.
  assert.match(src, /getAttribute\("data-theme"\)/);
  assert.match(src, /!== "light"/);
});
