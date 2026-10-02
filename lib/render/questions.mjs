// The German of the model's question titles, as the chat widget offers them on a German page.
// The model is written in English and stays so; a site's own `build/questions.de.json` is its
// translation of the titles, made by the roles of conventions/WRITING.md and read with
// `loadGerman`, so a title the model adds or rewords finds no German and stops the build, as a
// principle does. What this writes is the file the widget reads through `data-questions-de`:
// every title with its German, in the model's order, beside the model file it came from.
import fs from "node:fs";
import path from "node:path";

// Every question's title, once, in the order the model holds them: what the translator is given,
// and what the served file holds. A question with no title is not one the widget can offer.
export function questionTitles(data) {
  const titles = (data.entities || []).filter((e) => e && e.type === "question" && typeof e.name === "string" && e.name).map((e) => e.name);
  return [...new Set(titles)];
}

export function writeQuestionsDe(data, { check = false, root, de } = {}) {
  if (!root) throw new Error("writeQuestionsDe needs the site's root: the file it writes is the site's, not this package's");
  if (typeof de !== "function") throw new Error("writeQuestionsDe needs de, the lookup loadGerman gives for the site's build/questions.de.json");
  const rel = "questions.de.json";
  const file = path.join(root, rel);
  const next = JSON.stringify(questionTitles(data).map((title) => ({ title, text: de(title) })), null, 2) + "\n";
  const now = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (now === next) return [];
  if (check) return [rel];
  fs.writeFileSync(file, next);
  return [];
}
