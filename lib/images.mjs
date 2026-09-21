// Writes the images a site's model names into the site, or checks that what is there is still
// what the pinned model holds. A site serves its own copy, pinned as its model.json is, so a
// visitor's browser asks no third party for a picture — and a copy is a second thing to keep
// true, which is what `check` is for: a file that differs, one that is missing and one that
// stands although nothing names it each fail by name.
//
// What to copy is the parser's to say (`imagesOf` in companygraph-meta-model/instance): each
// entry carries `to`, the entity's id and the image's extension, and `bytes`. This file knows
// the folder and nothing about a model, so the design system takes no dependency on the parser.
import fs from "node:fs";
import path from "node:path";

export const IMAGES_DIR = "images";

const under = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(path.join(dir, d), { withFileTypes: true })) {
      const child = d ? `${d}/${e.name}` : e.name;
      if (e.isDirectory()) walk(child); else out.push(child);
    }
  };
  if (fs.existsSync(dir)) walk("");
  return out.sort();
};

// → { wanted, problems }: `problems` is what `check` found or, without it, empty, since the
// folder has then been made right. The folder belongs to this step whole: a file in it that no
// entry names is removed, and the folder itself when the model names no image at all.
export function syncImages({ root, images, check = false, dir = IMAGES_DIR }) {
  const target = path.join(root, dir);
  const wanted = new Map(images.map((i) => [i.to, Buffer.from(i.bytes)]));
  const problems = [];
  for (const [to, bytes] of wanted) {
    const at = path.join(target, to);
    const current = fs.existsSync(at) ? fs.readFileSync(at) : null;
    if (current && current.equals(bytes)) continue;
    if (check) problems.push(`${dir}/${to} ${current ? "is not the image the pinned model holds" : "is missing"}`);
    else { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, bytes); }
  }
  for (const rel of under(target)) {
    if (wanted.has(rel)) continue;
    if (check) problems.push(`${dir}/${rel} is named by nothing in the pinned model`);
    else fs.rmSync(path.join(target, rel));
  }
  if (!check) {
    // Folders the removals emptied, deepest first, and the folder itself with them.
    const dirs = [];
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) { walk(path.join(d, e.name)); dirs.push(path.join(d, e.name)); } };
    if (fs.existsSync(target)) { walk(target); dirs.push(target); }
    for (const d of dirs) if (!fs.readdirSync(d).length) fs.rmdirSync(d);
  }
  return { wanted: [...wanted.keys()].sort(), problems };
}
