import { test } from "node:test";
import assert from "node:assert/strict";
import { DESIGN_CHECKS, SYSTEM_FACES, TOKENS, TOKEN_VERSION } from "@robertblust/design/verify/design";
import { httpStatus } from "@robertblust/design/verify/http";
import { FENCES } from "../lib/fences.mjs";

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
  // gets the string ".body" into the file while never reading or cancelling the stream,
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
