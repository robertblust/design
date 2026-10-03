# The chat marks a claim its evidence does not carry — design

> The chat server can now say, for each claim of an answer, whether the tool answers the model was given carry it: a `verdict` event before `done`, with a probability per claim and a threshold the deployment measured. The widget ignores that event. This design has it mark the claims a reader should doubt, quietly and only after the answer has finished, with the note the panel's own controls already use, and records the change in the design system.

Status: proposed. Written on 2026-10-03 against this repository at `4ae1a6b` (v0.132.0), from a mockup the owner approved the same day: companygraph.io's own page and widget replaying two recorded answers, at https://claude.ai/artifact/LE4q4mpwSb43RnTNVSfFPR. The event it reads is chat-server v0.23.2's, specified in `companygraph/chat-server` `docs/INTERFACE.md`. The owner asked that the design system's pages change with the widget.

---

## 1. The gap

Since chat-server v0.23.0 a deployment can check its answers. The event carries `{ claims: [{ from, to, ids, verdict, p }], threshold }`: each claim's place in the answer's text, the entities it names, one of `supported`, `partial`, `contradicted`, `absent`, `says-nothing`, `withheld`, `unnamed` or `unsourced`, the probability of that verdict, and the probability above which a claim is to be marked. `readEvents` hands every event to the answer's handler, and that handler knows `text`, `cite`, `names`, `diagram`, `done` and `error`, so `verdict` falls through and nothing a visitor sees changes.

**What the change buys is a reader who can tell, without leaving the answer, which of its statements the model's own pages do not back.**

## 2. What is marked

A claim is marked where its verdict is `partial`, `contradicted`, `absent`, `unnamed`, `withheld` or `unsourced` and its `p` is at or above `threshold`. A `supported` claim and the honest `says-nothing` are never marked, so an answer the evidence carries reads exactly as it does today. Where `threshold` is null, which the server sends for every answer until a deployment sets one and for every answer written in German until a German one is measured, nothing is marked. Where no `verdict` event comes, nothing is marked.

Marks are drawn once the answer has finished, after `done`, so no text moves while it streams and a mark never lands on a sentence still being written. A message the visitor stopped, or one that ended in `error`, is never marked.

## 3. How a mark looks

A marked claim gets a dotted underline, 1.5px, three pixels under the baseline: `--t-part` for `partial`, `--t-bad` for every other marked verdict. Hovering one, or focusing it from the keyboard, tints the whole claim faintly in the same color, across every line it wraps onto.

`--t-part` is a new token of the Terminal family, an amber that reads as partly, set between `--t-good` and `--t-bad` in `blocks/tokens.css`: `#9A6A00` in light and `#E3B453` in dark. An underline is a mark and not text, so it is held to 3:1 against `--t-card`, the answer's ground; it clears that at 4.19:1 in light and 8.82:1 in dark. It is never used for text.

Where an answer has a marked claim, one line follows the answer's body, above the cites: "1 statement here isn't fully backed by the model's pages.", or the plural, in `--t-dim` at the size of `.rbchat-model`, under a dashed `--t-line` rule. With nothing marked there is no line, so an answer is never stamped as checked.

## 4. The note

A marked claim carries a note in the chat's own tooltip, the box `chat.css` draws under the header's buttons: `--raise` with a `--rule` border, a six-pixel radius, the `--deck-drop` shadow, `.8rem` in `--ink`. The family's `.tip` from `card.js` cannot be used: it sits at `z-index` 20 under a panel at 61, and `card.js` is not on every page the chat is, which is why the panel draws its own. The note leads with a name in 600 and follows with one line, as `.tip` writes a name and its line:

| Verdict | Name | Line |
| --- | --- | --- |
| `partial` | Partly backed | The model's pages say only part of this. |
| `contradicted` | Contradicted | The model's pages say otherwise. |
| `absent`, `unnamed`, `withheld` | Not backed | The model's pages don't say this. |
| `unsourced` | Not backed | No page the chat read says this. |

It shows on hover and on keyboard focus, never on a tap's focus, and not at all where `(hover: none)`, the same rules the header's notes keep; on a phone the line under the answer is what tells the reader. It hangs under the claim's first line, inside the panel, kept within the panel's sides, and closes on Escape and on scroll. The box is defined once in `chat.css`, the header's `::after` and the claim's note element both reading it, so the two cannot drift.

The English is above. The German is the German pipeline's, as every German word a site ships is: the translator drafts from the glossary, an editor reads it without the English, and a back-reader renders it into literal English. Both languages live in `STRINGS`, chosen by `langNow()`, as the panel's other words are.

## 5. Finding the claim in the rendered answer

`from` and `to` count characters of the answer's text as it streamed, which is Markdown; the body the widget shows is that Markdown rendered by `md()`, so backticks, emphasis and link syntax are gone and code is its own element. A claim is found by its rendered text: the Markdown of `from` to `to`, with backticks, emphasis markers and link targets removed and white space collapsed, matched against the body's text with its white space collapsed the same way, in the order the claims come. A match is wrapped text node by text node, so a claim that crosses an inline element, a code span or a link, is marked in each of its pieces. A claim whose text cannot be found is not marked at all: a mark on the wrong sentence is worse than none.

## 6. Reaching it

The first piece of a marked claim is focusable, with `tabindex="0"`, and is described by the note through `aria-describedby`; the line under the answer is ordinary text, so a screen reader reads it with the answer. Reduced motion drops the note's fade, as the header's does.

## 7. The design system

The pages under `docs/design-system/` change in the same pull request:

- `assets.md`, Chat: a paragraph on the marks and the note, what is marked and when, with the anatomy drawing extended to an answer holding a marked claim, its note, and the line under the answer, at desk and phone width, where the phone shows no note.
- `tokens.md`, Token families: `--t-part` joins the Terminal family, and the section says it is for a partly backed claim's underline and never for text.

The README's map does not change, since no file or group is added; `test/design-system-docs.test.mjs` still holds every link and the rule of no hex and no version in the pages.

## 8. Tests

In the suite that drives the widget in a browser, with a fake chat endpoint answering a recorded stream:

- A `verdict` with a threshold marks exactly the claims that pass it, with the right class per verdict, and adds the line with its count.
- A `verdict` with `threshold` null, or no `verdict` at all, leaves the answer and its DOM as they are today.
- A claim spanning a code span is marked in both of its pieces; a claim whose text is not in the body is not marked.
- Hover and keyboard focus show the note with the verdict's name and line, in the page's language; a tap does not; Escape closes it.
- Marks appear only after `done`, and a stopped or failed message has none.
- `--t-part` is defined in both themes and holds 3:1 against `--t-card`.

## 9. Release and order

A minor release of this package. The sites and the MCP hosts take it at their next resync, as they take any widget change. Until a deployment's chat server sends a threshold it marks nothing, so it can ship before the first threshold is measured, and the day one is set the marks appear with no further change here.

## Out of scope

A note a phone can open with a tap: the panel's notes do not open on a tap today, and changing that is the panel's own design. Marks in German answers, which wait on a German threshold the server sends. Any change to how the chat server decides a verdict.
