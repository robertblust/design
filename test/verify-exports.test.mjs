import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DESIGN_CHECKS, SYSTEM_FACES, TOKENS, TOKEN_VERSION } from "../verify/design.mjs";
import { httpStatus } from "../verify/http.mjs";
import { FENCES } from "../lib/fences.mjs";

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

test("httpStatus reads the body it does not want", () => {
  // The whole point of the helper. If someone simplifies it back to returning r.status without
  // consuming the body, Node 22 crashes intermittently in CI and this test is the warning.
  const src = readFileSync(new URL("../verify/http.mjs", import.meta.url), "utf8");
  assert.match(src, /arrayBuffer\(\)|\.text\(\)|\.body/,
    "httpStatus does not consume the response body");
  assert.equal(typeof httpStatus, "function");
});
