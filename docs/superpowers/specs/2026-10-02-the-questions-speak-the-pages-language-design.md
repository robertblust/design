# The questions speak the page's language — design

> On a German page the chat's intro reads German down to its last section, and then offers the model's own questions in English, as the follow-ups after an answer are. The model is written in English and stays so. This design gives each site a reviewed German for the model's question titles, held to the exact English the way the principles' German already is, so the widget offers and sends a question in the language the rest of the panel speaks, and a visitor who presses one is answered in German.

Status: proposed. Decided on 2026-10-02 with the owner against this repository at `f89b525` (v0.131.0). It replaces `companygraph/chat-server#70`, which had the chat server render the titles with its model at build; the owner chose instead that every German word a site ships passes the German pipeline, and with that the chat server has nothing left to do. The model is not changed: since meta-model #219 a model is written in one language, and a reader who wants another reads a rendering of it.

---

## 1. The gap

The widget builds its intro from two sources. The sentences it writes itself are in `STRINGS` in both languages. The section "Aus dem Modell" is the `name` of every entity of type `question` in the file `data-questions` names, offered as it stands, and the follow-ups after an answer come from the same list through `follow()`. Those titles are the model's, and the model is English, so on a German page three lines of six are English, and a visitor who presses one sends English and is answered in English.

The answer already crosses the language: the chat matches a visitor's question to one of the model's in any language, and names every entity in German with its title beside it. Only the questions the widget offers stay behind.

**What the change buys is an intro and follow-ups in the page's language on every site, with every German word in them read by the German pipeline before it ships.**

## 2. The pattern it follows

blust.ch already ships German for the model's own words. `build/principles.de.json` holds pairs of `en` and `de`, made by the roles of `conventions/WRITING.md`: the translator drafts from the glossary, an editor reads the German without the English, and a back-reader renders it into literal English. `loadGerman` in `lib/render/german.mjs` looks each entry up by its exact English, so a sentence reworded in the model finds no German and stops the build, and an entry whose English the model no longer says is reported as unused. The question titles take the same path, in a file of their own, because they change on their own: a question added to the model is a new entry, and nothing else moves.

Two other ways were weighed and set aside. German titles in the model are ruled out by meta-model #219. German rendered by the chat's model, at build or when the panel opens, ships words nobody has read, the glossary's terms included, and the owner declined that on 2026-10-02.

## 3. The site's file and its check

Each site with a German page keeps `build/questions.de.json`, an array of `{ en, de }`, one entry per question title of its model, `en` the title exactly as the model writes it. It is made and changed only by the German pipeline.

The site's build reads it with `loadGerman` and writes `questions.de.json` at the site's root, beside the model file the widget already reads: an array of `{ title, text }`, one per question the model holds, in the model's order, `title` the English and `text` its German. The build fails, as it does for the principles, where a question of the model has no German, naming the title and the file to add it to, and where the file holds German for a title the model no longer has. So a new or renamed question stops the site's next content re-pin until its German is reviewed. That is the cost the owner accepted: the same one the principles carry.

The writer is one function in this package, `writeQuestionsDe(data, { de, check, root })` in `lib/render/`, beside the other renderers, so the three sites write the same file the same way. It takes the `de` of a loader, as `writePrinciples` does, and under `check` reports the file as stale where it differs from what it would write. Which of a site's renderers calls it, and from which artifact, `model.json` or `company.json`, is the site's own line.

The translator's input is every question title of the model, printed by a command the plan names beside the one that prints the principles' strings, so the pipeline starts from the list the build will hold it to.

## 4. The widget

`assets/chat.js` gains one optional attribute, `data-questions-de`, a same-origin path to the site's `questions.de.json`. The widget reads it under the rules `data-questions` already keeps: only when the panel opens, once per page, with the same timeout, and never from another origin, so the promise the panel makes in its first lines holds and nothing reaches the chat's host before the visitor presses send. It keeps a map from `title` to `text`.

Wherever the widget offers a model question, the intro's "Aus dem Modell" and the follow-ups `follow()` and `spread()` choose, it shows and sends `text` where `langNow()` is `de` and the map holds the title, and `title` otherwise. Which questions to offer is still chosen by `title`, since the widget keys rests and kinds by the model's own entities. `unasked()` compares what was sent with what would be offered in the page's language, so a German question already asked is not offered again. A tag without the attribute, an English page, a file that fails to load, or a title the map lacks reads exactly as today.

## 5. What this changes nowhere

The model, the MCP server and the chat server. The chat's rules already match a German question to its English entity, and the question the chat keeps is the one the visitor sent, now German where a chip sent German. The principles' file and its loader are untouched; the questions' file is a second caller of the same loader.

## 6. Parked

**Follow-ups in the answer's language.** The widget offers the page's language and the answer follows the visitor's message, so a visitor writing English on a German page is answered in English and offered German follow-ups. The design lets the page's language decide until the owner says this case matters.

## 7. Releases

This repository: a minor, carrying `writeQuestionsDe`, the translator's command and `data-questions-de`. Each site then takes the release, adds the call to its renderers and the attribute to its tag, and commits `build/questions.de.json` with its reviewed German; that first file is a German-pipeline job of its own, over every question title the site's model holds. `companygraph/chat-server#70` is closed with a pointer here. Merging, the release and each site's adoption wait for the owner's word.
