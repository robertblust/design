// The terminal's colors as the family's tokens define them, read from the tokens block itself,
// for a test page that links chat.css or opens the modal without the site's whole tokens.css:
// the dark set on :root and the light set under data-theme="light", as a site's page has them.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const lines = fs.readFileSync(path.join(PKG, "blocks", "tokens.css"), "utf8").split("\n").filter((l) => /^\s*--t-card:/.test(l)).map((l) => l.trim());
if (lines.length !== 2) throw new Error("the tokens block does not carry a light and a dark terminal palette");
export const TERMINAL = `:root{${lines[1]}} :root[data-theme="light"]{${lines[0]}}`;
