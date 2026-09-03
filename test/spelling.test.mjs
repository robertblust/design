import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Every file this package ships is American English — core's R14, and the sites' own rule that
// every word of a page is en-US. The blocks and stage.js are copied into sixteen pages, so a
// British spelling in a comment here ships to three domains and no site check can see it: the
// sites' suites read the rendered DOM, and a comment renders as nothing. PR #30 swept the
// package once and this file exists because a second sweep found ten more. A list, not a
// dictionary: only the forms that have actually appeared or are likely to, so a false positive
// costs a line here rather than a workaround in prose.
const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCAN = ["blocks", "lib", "verify", "cards", "decks", "bin", "assets/stage.js", "README.md", "NOTICE"];
const BRITISH = new RegExp("\\b(" + [
  // -ise / -yse
  "\\w*is(?:e|ed|es|ing|ation|ations|er|ers)", "\\w*ys(?:e|ed|es|ing)",
  // -our, -re, -ogue, -ence, -ll-
  "\\w+our(?:s|ed|ing|ite|ful)?", "\\w+(?:tre|bre)(?:s|d)?", "\\w+ogue(?:s|d)?",
  "(?:lic|def|off|pret)ence", "\\w+ll(?:ed|ing|er)",
  // the odd ones
  "grey", "aluminium", "judgement", "artefacts?", "whilst", "amongst", "learnt", "spelt", "cheque",
  "programme", "catalogue", "kerb", "tyre", "storey", "mould", "plough", "draught", "sceptic\\w*",
  "instalments?", "enrol(?:ment)?", "fulfil(?:ment)?", "skilful", "ageing", "cosy", "focuss\\w*",
].join("|") + ")\\b", "gi");
// Words the patterns above catch that are correct American English, or are not English at all.
const ALLOW = new Set([
  // -ise / -ys- that are simply spelled that way
  "advertise", "advertised", "advertises", "advertising", "arise", "arises", "comprise", "comprises", "compromise", "concise",
  "devise", "disguise", "enterprise", "exercise", "exercised", "expertise", "franchise", "improvise",
  "otherwise", "likewise", "clockwise", "stepwise", "pairwise", "piecewise", "bitwise", "elementwise",
  "lengthwise", "premise", "premises", "precise", "promise", "promised", "promises", "raise", "raised",
  "raises", "rise", "rises", "riser", "supervise", "surprise", "surprised", "surprises", "revise",
  "revised", "wise", "noise", "noises", "praise", "poise", "cruise", "bruise", "demise", "reprise",
  "appraise", "advise", "advised", "advises", "adviser", "excise", "incise", "chastise", "despise",
  "merchandise", "televise", "guise", "anise", "treatise", "turquoise", "tortoise", "porpoise",
  "paradise", "unwise", "sunrise", "moonrise", "user", "users", "browser", "browsers", "parser",
  "parsers", "loser", "closer", "chooser", "eraser", "geyser", "laser", "lasers", "miser", "poser",
  "teaser", "visor", "denoiser", "analysis", "analyses", "hydrolysis",
  // -our that is American
  "our", "ours", "hour", "hours", "four", "fours", "your", "yours", "tour", "tours", "pour", "poured",
  "pouring", "sour", "flour", "scour", "dour", "detour", "contour", "contours", "velour", "devour",
  "amour", "glamour", "troubadour", "paramour", "fourth",
  // -re that is American
  "are", "were", "here", "there", "where", "anywhere", "everywhere", "nowhere", "somewhere",
  "elsewhere", "before", "therefore", "more", "core", "store", "restore", "score", "shore", "ignore",
  "explore", "bore", "wore", "tore", "fore", "sore", "chore", "adore", "genre", "acre", "mediocre",
  "massacre", "ogre", "cadre", "lucre", "entire", "fire", "hire", "wire", "tire", "desire", "require",
  "acquire", "inquire", "inspire", "expire", "retire", "empire", "admire", "aspire", "umpire",
  "satire", "attire", "squire", "sure", "ensure", "secure", "insecure", "pure", "cure", "endure",
  "mature", "obscure", "figure", "configure", "measure", "feature", "future", "nature", "picture",
  "mixture", "texture", "capture", "culture", "failure", "pressure", "procedure", "closure",
  "exposure", "literature", "signature", "temperature", "architecture", "infrastructure", "fixture",
  "gesture", "creature", "venture", "adventure", "departure", "furniture", "manufacture", "treasure",
  "pleasure", "leisure", "tenure", "structure", "lecture", "sculpture", "posture", "fracture",
  "puncture", "rupture", "nurture", "torture", "moisture", "pasture", "juncture", "conjecture",
  "brochure", "tincture", "aperture", "overture", "erasure", "enclosure", "disclosure", "composure",
  "allure", "lure", "manure", "demure", "immature", "premature", "insure", "assure", "reassure",
  "bare", "care", "share", "spare", "square", "rare", "dare", "stare", "glare", "flare", "scare",
  "snare", "aware", "beware", "compare", "declare", "prepare", "welfare", "software", "hardware",
  "firmware", "middleware", "malware", "nightmare", "fare", "hare", "mare", "pare", "blare", "ware",
  "insertbefore", "orderbefore", "widthbefore", "findfence", "replacefence", "fence", "fences",
  "sentence", "sentences", "hence", "whence", "thence", "once", "since", "pre", "ihre", "jahre",
  "dereference", "reference", "references", "preference", "preferences", "difference", "differences",
  "inference", "conference", "occurrence", "presence", "absence", "evidence", "confidence",
  "audience", "experience", "silence", "sequence", "consequence", "existence", "essence",
  "influence", "convenience", "patience", "science", "conscience", "independence", "dependence",
  "correspondence", "residence", "incidence", "coincidence", "providence", "precedence",
  "competence", "persistence", "consistence", "resilience", "prominence", "permanence",
  "excellence", "violence", "intelligence", "diligence", "negligence", "emergence", "divergence",
  "convergence", "indulgence", "defense", "offense", "license", "pretense",
  "measurement", "replacement", "statement",
  // -ll- that is American (double l before a vowel suffix when the stem already ends in ll, or stressed)
  "billed", "billing", "called", "calling", "filled", "filling", "milled", "milling", "killed",
  "killing", "rolled", "rolling", "scrolled", "scrolling", "polled", "polling", "pulled", "pulling",
  "stalled", "stalling", "installed", "installing", "spilled", "spilling", "selling", "seller",
  "telling", "teller", "dwelling", "swelling", "spelling", "speller", "smelling", "yelling",
  "falling", "controlled", "controlling", "controller", "controllers", "compelled", "compelling",
  "expelled", "propelled", "dispelled", "repelled", "excelled", "rebelled", "fulfilled", "distilled",
  "instilled", "enrolled", "patrolled", "trolled", "tolled", "lulled", "dulled", "culled", "mulled",
  "chilled", "grilled", "drilled", "thrilled", "willed", "stilled", "tilled", "walled", "balled",
  "galled", "hauled", "appalled", "enthralled", "recalled", "forestalled", "snowballed", "handled",
  "bundled", "unfilled", "prefilled", "refilled", "labeled", "modeled", "traveled", "canceled",
  "caller", "callers", "filler", "fillers", "roller", "rollers", "poller", "puller", "killer",
  "smaller", "taller", "fuller", "duller", "installer", "installers", "propeller", "stroller",
  "misspelled", "misspelling",
]);
const seen = new Map();
function scan(rel) {
  const abs = path.join(PKG, rel);
  const st = fs.statSync(abs);
  if (st.isDirectory()) { for (const f of fs.readdirSync(abs)) if (!f.endsWith(".min.js")) scan(path.join(rel, f)); return; }
  if (!/\.(mjs|js|css|md)$/.test(rel) && rel !== "NOTICE") return;
  const lines = fs.readFileSync(abs, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(BRITISH)) {
      const w = m[0].toLowerCase();
      if (ALLOW.has(w)) continue;
      // Every -ise hit is British only when an -ize form exists; the allow list carries the
      // exceptions, so anything left is reported and the list is what gets extended.
      seen.set(`${rel}:${i + 1}`, [...(seen.get(`${rel}:${i + 1}`) || []), m[0]]);
    }
  });
}

test("everything the package ships is American English", () => {
  for (const rel of SCAN) scan(rel);
  const report = [...seen].map(([at, ws]) => `${at}  ${ws.join(", ")}`).join("\n");
  assert.equal(seen.size, 0, "British spellings:\n" + report);
});
