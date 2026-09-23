import { test } from "node:test";
import assert from "node:assert/strict";
import { DESIGN_CHECKS, SYSTEM_FACES, TOKENS, TOKEN_VERSION } from "@robertblust/design/verify/design";
import { httpStatus } from "@robertblust/design/verify/http";
import { FENCES } from "../lib/fences.mjs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// design.mjs and http.mjs are imported here through the package's own `exports` map
// (Node's self-reference resolution, since this package's own package.json declares
// both entries) rather than by relative path. The deliverable of this file's suite is
// that export map: a typo in it, or a dropped entry, must fail these tests exactly the
// way it would fail a site that consumes the package. `../lib/fences.mjs` stays
// relative — that boundary is genuinely internal to the package, never crossed by a site.

test("the design checks arrive as callables, not as a shape that merely looks right", () => {
  // A `{}` default export would satisfy "is an object" and silently check nothing on every
  // site at once, which is the failure mode that matters when one file feeds three suites.
  const names = Object.keys(DESIGN_CHECKS);
  assert.ok(names.length >= 8, `only ${names.length} design checks`);
  for (const n of names) assert.equal(typeof DESIGN_CHECKS[n], "function", `${n} is not callable`);
});

test("the moved file reads its token version from the package, not from a frozen copy", () => {
  // It used to import FENCES across the package boundary from inside a site. In here that is a
  // self-import; if it is ever replaced by a literal, this drifts silently on the next bump.
  assert.equal(TOKEN_VERSION, FENCES["design tokens"].version);
  assert.match(TOKEN_VERSION, /^v\d+$/);
});

test("the token table is not empty and every value is a string", () => {
  const entries = Object.entries(TOKENS);
  assert.ok(entries.length > 0, "TOKENS is empty");
  for (const [k, v] of entries) assert.equal(typeof v, "string", `${k} is ${typeof v}`);
});

test("SYSTEM_FACES is a Set, so `.has` means what the checks think it means", () => {
  // An array would make `.has` undefined and every font check throw rather than fail.
  assert.ok(SYSTEM_FACES instanceof Set);
  assert.ok(SYSTEM_FACES.size > 0);
});

test("httpStatus drains the response body it does not want", async () => {
  // A source-text match here would pass on `const b = res.body; return res.status;` — that
  // gets the string ".body" into the file while never reading or canceling the stream,
  // which is exactly the shape that crashes Node 22's bundled undici about half the time in
  // CI. Instrumenting the stream's own `pull`/`cancel` hooks turned out to be just as
  // foolable: a `ReadableStream` calls `pull` to fill its queue the moment it is
  // constructed, before anything ever reads from it, so that signal fires even when
  // `httpStatus` touches nothing. What the Fetch spec actually tracks for "was this body
  // read or cancelled" is `Response.prototype.bodyUsed` — false until a reader is acquired
  // or `.cancel()` is called, true after `.text()`, `.arrayBuffer()` or `.body.cancel()`
  // settle. That is the one signal here, checked on the exact Response instance `httpStatus`
  // was handed.
  const realFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async () => {
    const body = new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });
    captured = new Response(body, { status: 200 });
    return captured;
  };
  try {
    const status = await httpStatus("http://example.invalid/probe");
    assert.equal(status, 200, "httpStatus did not return the response status");
    assert.ok(captured.bodyUsed,
      "httpStatus returned without the response body ever being read or cancelled (bodyUsed is false)");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("opensFromFile roots its file:// probe at process.cwd(), not at design.mjs's own directory", () => {
  // The regression this guards: design.mjs used to compute its site root as
  // `path.dirname(path.dirname(fileURLToPath(import.meta.url)))` — two directories up from
  // wherever this module's own file happens to sit. That was correct while the file lived at
  // <site>/verify/design.mjs, and silently wrong the moment it moved to
  // <site>/node_modules/@robertblust/design/verify/design.mjs, where two directories up is the
  // package directory, not the site. Every opensFromFile check then failed on all three sites
  // without a single line of site code changing.
  //
  // A test that just calls opensFromFile from here cannot catch a reversion to that pattern:
  // in this repository the module's own directory and process.cwd() are the same tree, so the
  // two derivations agree by coincidence and the bug would hide again. The only way to tell
  // them apart is to run the module from a working directory that is not its own — the same
  // shape as node_modules. This spawns a real Node process rooted at a scratch directory
  // unrelated to this repository, imports design.mjs by its actual file path (as a site's
  // node_modules install would), and asserts the file:// URL opensFromFile builds is rooted at
  // that scratch cwd and nowhere else. Restore the fileURLToPath derivation, or root SITE_ROOT
  // anywhere but process.cwd(), and this fails with the wrong directory baked into the URL —
  // exactly the outage this closes.
  const designPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "verify", "design.mjs");
  // Resolved because a spawned process may report its cwd through a different path than the
  // one this test created it under (e.g. macOS's /var -> /private/var symlink) — the process
  // itself is still rooted where we put it, so compare the two by their real, resolved paths.
  const scratch = realpathSync(mkdtempSync(path.join(tmpdir(), "design-siteroot-")));
  const scriptPath = path.join(scratch, "probe.mjs");
  const script = `
    import { DESIGN_CHECKS } from ${JSON.stringify(pathToFileURL(designPath).href)};
    let captured;
    const fakeProbe = {
      on() {},
      async goto(url) { captured = url; throw new Error("stop-after-goto"); },
      async close() {},
    };
    const fakePage = { context: () => ({ browser: () => ({ newPage: async () => fakeProbe }) }) };
    try { await DESIGN_CHECKS.opensFromFile(fakePage, { path: "/deck/" }); } catch {}
    process.stdout.write(JSON.stringify({ captured, cwd: process.cwd() }));
  `;
  writeFileSync(scriptPath, script);
  try {
    const result = spawnSync(process.execPath, [scriptPath], { cwd: scratch, encoding: "utf8" });
    assert.equal(result.status, 0, `probe process failed: ${result.stderr}`);
    const { captured, cwd } = JSON.parse(result.stdout);
    assert.equal(cwd, scratch, "the spawned probe did not actually run from the scratch directory");
    const expected = "file://" + path.join(scratch, "deck", "index.html");
    assert.equal(captured, expected,
      `opensFromFile built ${captured}, expected a path rooted at the scratch cwd (${expected}) — ` +
      "SITE_ROOT was derived from something other than process.cwd()");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

// fontsAvailable's page.evaluate callbacks close over nothing but `document`,
// `CSSFontFaceRule` and their own arguments, the same shape theme.test.mjs's
// makeContrastPage runs for real against a stubbed document rather than mocking the check
// itself. This fake stands in for both calls the check makes: the first reads only
// `document.querySelectorAll('link[rel="stylesheet"]')` for the page's own linked
// stylesheets' hrefs, and the second reads `document.fonts`, `document.styleSheets` and
// `document.querySelectorAll("[font-family]")`. `hrefs` feeds the first, `fonts`/`sheets`/
// `attrEls` feed the second; nothing here drives a browser or fetches a real file.
function makeFontsPage({ hrefs = [], fonts = [], sheets = [], attrEls = [] } = {}) {
  class FakeCSSFontFaceRule {}
  return {
    async evaluate(fn, arg) {
      const hadDoc = "document" in globalThis, prevDoc = globalThis.document;
      const hadRule = "CSSFontFaceRule" in globalThis, prevRule = globalThis.CSSFontFaceRule;
      globalThis.CSSFontFaceRule = FakeCSSFontFaceRule;
      globalThis.document = {
        fonts,
        styleSheets: sheets.map((s) => ({ href: s.href ?? null, cssRules: s.cssRules ?? [] })),
        querySelectorAll(sel) {
          if (sel === 'link[rel="stylesheet"]') return hrefs.map((href) => ({ href }));
          if (sel === "[font-family]") return attrEls;
          return [];
        },
      };
      try { return fn(arg); }
      finally {
        if (hadDoc) globalThis.document = prevDoc; else delete globalThis.document;
        if (hadRule) globalThis.CSSFontFaceRule = prevRule; else delete globalThis.CSSFontFaceRule;
      }
    },
  };
}

// Fetched from Node rather than through the page, per the comment above fontsAvailable
// itself: a linked stylesheet's text is read over the wire. Stubbed here the same way
// theme.test.mjs stubs `globalThis.fetch` for `noFlash`.
async function runFontsAvailable(page, cssByHref = {}) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (href) => ({ text: async () => cssByHref[href] ?? "" });
  try {
    return await DESIGN_CHECKS.fontsAvailable(page);
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("fontsAvailable reads a linked stylesheet's font-family uses, not only a fenced block's", async () => {
  // The bug this closes: `tokens.css` moved from a fenced block copied into every page to a
  // whole file a page links, and the old implementation walked a linked stylesheet's CSSOM
  // (`sheet.cssRules`) to find these — which throws reading a *linked* stylesheet opened over
  // file://, silently caught, so a page naming a font nowhere self-hosted in its one linked
  // file would have reported nothing wrong. The fix reads a linked stylesheet as fetched text
  // instead, so this asserts that path directly: the family declared by @font-face lives in
  // `document.fonts` (as a browser always populates it, regardless of which stylesheet the
  // rule came from) while the *use* of a name lives only in the linked file's own bytes.
  const page = makeFontsPage({
    hrefs: ["http://x.test/tokens.css"],
    fonts: [{ family: "Plex Sans", status: "loaded" }],
  });
  const bad = await runFontsAvailable(page, {
    "http://x.test/tokens.css": '.brand{font-family:"IBM Plex Mono",monospace}',
  });
  assert.equal(typeof bad, "string", `expected a failure naming IBM Plex Mono, got ${JSON.stringify(bad)}`);
  assert.match(bad, /IBM Plex Mono/);

  const ok = await runFontsAvailable(page, {
    "http://x.test/tokens.css": '.brand{font-family:"Plex Sans",sans-serif}',
  });
  assert.equal(ok, null, `a name @font-face already declares should pass, got ${JSON.stringify(ok)}`);
});

test("fontsAvailable still reads an inline fenced block's font-family uses through the CSSOM", async () => {
  // The shape every page carried before this — an inline <style> block, no <link> at all —
  // must keep working exactly as it did: the CSSOM walk is only skipped for a stylesheet that
  // carries an `href` (a linked one), never for an inline one, whose CSSOM is never
  // cross-origin.
  const page = makeFontsPage({
    fonts: [{ family: "Plex Sans", status: "loaded" }],
    sheets: [{
      href: null,
      cssRules: [{ style: { fontFamily: '"IBM Plex Mono", monospace' }, selectorText: ".brand" }],
    }],
  });
  const bad = await runFontsAvailable(page);
  assert.equal(typeof bad, "string", `expected a failure naming IBM Plex Mono, got ${JSON.stringify(bad)}`);
  assert.match(bad, /IBM Plex Mono/);

  const okPage = makeFontsPage({
    fonts: [{ family: "Plex Sans", status: "loaded" }],
    sheets: [{
      href: null,
      cssRules: [{ style: { fontFamily: '"Plex Sans", sans-serif' }, selectorText: ".brand" }],
    }],
  });
  const ok = await runFontsAvailable(okPage);
  assert.equal(ok, null, `a name @font-face already declares should pass, got ${JSON.stringify(ok)}`);
});
