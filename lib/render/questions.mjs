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
  const entries = questionTitles(data).map((title) => ({ title, text: de(title) }));
  // Two titles under one German would read as one question on a German page, and the widget,
  // which reads a German question back to its title, would mark the wrong one asked.
  const byText = new Map();
  for (const { title, text } of entries) {
    if (byText.has(text)) throw new Error(`"${byText.get(text)}" and "${title}" share the German "${text}" — give each its own in the site's build/questions.de.json`);
    byText.set(text, title);
  }
  const next = JSON.stringify(entries, null, 2) + "\n";
  const now = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (now === next) return [];
  if (check) return [rel];
  fs.writeFileSync(file, next);
  return [];
}
