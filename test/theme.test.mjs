import { test } from "node:test";
import assert from "node:assert/strict";
import { blockFor } from "@robertblust/design/fences";

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
