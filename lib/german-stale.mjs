// German left behind an English edit. Nothing on a page says when its German was made, so a
// sentence reworded in English keeps a German that now says something else, and every check
// that reads the rendered page reads one language and passes. Two versions of a page are
// compared by their German: a German value identical in both whose English changed is stale.
// Pairing by the German, not by position, is what survives an element inserted above.
import { execFileSync } from "node:child_process";
import { germanValues } from "./german.mjs";

export function staleGerman({ before, after }) {
  const had = new Map();
  for (const e of germanValues(before)) {
    if (!had.has(e.de)) had.set(e.de, new Set());
    had.get(e.de).add(e.en);
  }
  return germanValues(after)
    .filter((e) => had.has(e.de) && !had.get(e.de).has(e.en))
    .map((e) => ({ id: e.id, de: e.de, was: [...had.get(e.de)].join(" | "), now: e.en }));
}

// An English edit whose German is right on purpose is named in a commit of the range, in a
// trailer, so the reason sits in the commit that made the decision.
export function staleRange({ root, base, head }) {
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
  const allowed = new Set(git("log", "--format=%B", `${base}..${head}`).split("\n")
    .map((l) => /^German-unchanged:\s*(\S+)\s*$/.exec(l)).filter(Boolean).map((m) => m[1]));
  // A file added or deleted within the range is a normal case here, not an error: git writes
  // "fatal: path … does not exist" to stderr for the end that lacks it, and that line would
  // otherwise surface on an entirely clean run. Only this call's stderr is silenced; every
  // other git call above still surfaces its own errors.
  const show = (rev, file) => {
    try {
      return execFileSync("git", ["-C", root, "show", `${rev}:${file}`],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return null;
    }
  };
  const out = [];
  for (const file of git("diff", "--name-only", base, head, "--", "*.html").split("\n").filter(Boolean)) {
    const before = show(base, file), after = show(head, file);
    if (before === null || after === null) continue;
    for (const s of staleGerman({ before, after })) if (!allowed.has(`${file}#${s.id}`)) out.push({ file, ...s });
  }
  return out;
}
