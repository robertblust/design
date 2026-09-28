# The chat as a terminal

Status: the direction was approved by the owner on 2026-09-28 from a working prototype, played on all three sites' lockups in both languages. One choice is open and listed at the end, with a proposal. The build waits for this spec's review. Decided on 2026-09-28 against `robertblust/design` at v0.115.0, and against `robertblust/robertblust.github.io`, `companygraph/companygraph.github.io` and `guestgraph/guestgraph.github.io` as read that day. Those are the source of every fact below about what exists.

## Why now

The companygraph.io `/cli/` page plays the tooling in a drawn terminal. It shows the lockup, a prompt typed a character at a time, the numbered menu, and the green panel a finished step prints. The owner wants a fresh chat conversation to open the same way, the lockup first and then a short hello. From there it offers something to type, or a question to click, and hints at what comes back, such as "Show me the meta-model". Seen in a prototype, the owner asked for the whole chat in that style, not just its first screen.

The widget already has most of what a terminal needs. It has a log that grows downward, an answer that streams in, cites that name their commit, and three questions offered after each answer. Today these are drawn as a messaging app draws them: bubbles, a band of notice above the log, chips. Redrawn as the tooling's terminal, they make the chat read as part of CompanyGraph's own tools and not as a support widget, on every site that carries it.

## The shape

All changes stay in the `chat` group: `chat.js`, `chat.css`, their strings, the README's chat paragraph and the chat tests. A site's markup does not change.

**The window.** The panel keeps its size, its corner grip, its place and its phone sheet. It takes the look of `/cli/`'s `.term`: a title bar with three dots, the title `ask · <host>` in the dim ink, and New conversation (↻) and Close (×) at the right, with their notes as today. The colors are the terminal's own, declared in `chat.css` under `--t-*` as `/cli/` declares them. A terminal is not a page surface, as the `/cli/` comment says. It gets a dark palette and a light one, following `data-theme` and `prefers-color-scheme` as the tokens do. The panel is set in Plex Mono, already served by every site the chat runs on, with one exception: the answer's text, as **The answer** below says.

**The intro.** An empty conversation opens on the site's lockup, read from the page's own header: the SVG and the `<b>Name<span>Accent</span></b>` inside `header a.brand`, which all three sites write the same way. The widget clones it, as `/cli/` clones its logo. So the tag needs no new attribute, and a page without that header gets the intro without the lockup. Under the name, a dim line reads `chat · <host>`. Then comes a two-line hello in the page's language, naming the model it answers from by the lockup's text. Next, the privacy notice moves into the log as a dim `# ` comment line, with its link. After that come two numbered groups:

- **Try:** three asks the chat is built to answer, each with a dim second line saying what comes back. They are the meta-model as a diagram, a process as a flow, and a list as a table. The process and the list are picked from the model file `data-questions` already names, so no row names what the model does not hold. A model without a process leaves that row out.
- **From the model:** the three random questions that are chips today.

Last comes the prompt line, `› Type a question, a number, or /help`, with a block cursor that hands over to the command line.

On a fresh conversation the intro plays, short, as the owner asked on 2026-09-28: the text should appear fast, with just a short animation. The mark comes in one child element at a time, 35 ms apart, and the name types at 22 ms a character. The hello's two lines fade in rather than type, and the rows print 30 ms apart, as `/cli/`'s menu does. The whole intro takes about a second. A key press, a pointer down in the log, or typing in the field finishes it at once. Reduced motion shows it finished from the start. A conversation restored from the tab draws the intro finished and without motion, above the restored turns. The intro's text is in the DOM in full from the start for a screen reader, with only its visibility animated. The one exception is the typed name, which carries its whole text in an `aria-label` while the typing runs.

**Your turn.** A sent question prints as a prompt line, `› the question`, in the terminal's strong ink, with no bubble.

**Waiting.** Until the whole answer is there, a spinner line reads `| asking the model… 4s`, counting the whole seconds since the question was sent, so a long wait reads as work going on rather than as a chat that stopped. The spinner is the four ASCII frames `| / - \`, not braille or box glyphs, which Plex Mono as served does not carry.

**The answer.** An answer is shown whole and at once, the owner's choice on 2026-09-28 from a sample of a ten-second answer played both ways. The request stays a stream, as the server sends it: the widget gathers the text, the cites, the names and the picture as they arrive and draws nothing until `finish()`, so the spinner stands for the whole wait, and then the finished answer, its picture, its cite line and the menu after it appear together. It has no animation: nothing is typed out or faded in, and no cursor blinks after it. The timeout, the cut line and an error inside the stream keep today's rules; an error that comes after some text still ends that text with its sentence. The answer stands in a panel with a rail, a left border in the terminal's green, as the CLI's `╭─ │ ╰─` panel draws a finished step, and its head line reads `✓ answered`. The box-drawing characters are left out for the same glyph reason. The intro keeps its short play. The answer's text keeps the face and tone it has today, the owner's choice on 2026-09-28: the page's own Instrument Sans at the size `.rbchat-log` sets, dim as every page's prose and the card's are, with a bold run in the terminal's strong ink and a link in the accent. Everything around it is in mono: the question at the prompt, the spinner, the head line, the cite line and the menus. So what the visitor types and what the chat prints read as the terminal, and what the model writes reads as prose. The Markdown subset, links into the model, tables, diagrams with Expand, the cut line and an error inside a stream all render as they do today, restyled to the terminal's colors. A table keeps its rules, thinned. A diagram sits in a dashed frame with its caption, and Mermaid keeps reading its colors through `mermaidConfig`, now from the `--t-*` values.

**Lists and tables.** Both are styling on what `md()` already writes, so the Markdown the model is told to write is unchanged. A bullet list's marker is a dim `·`, and a numbered list's is a dim `1.`. Each marker sits in a fixed column two characters wide, so a wrapped line aligns under its text. A marker is never in the accent: in the terminal, an accent number means a row a visitor can pick, as in the Try and Ask next menus, and a list in an answer is not one. A list follows the answer's face. A table stays in mono whatever the answer's face, since columns that align are what a terminal draws best. Its head row is in the dim ink over a solid rule in the terminal's line color, with a dotted rule between rows and the terminal's selection color on a hovered row. A link in the first column does not wrap. A column whose cells are all numbers aligns right in tabular figures. In a cell holding a break or a list, which `cell()` already writes, each line after the first is in the dim ink. A table wider than the panel scrolls sideways inside the answer, as it does today. The owner approved this on 2026-09-28 from the prototype's answer with a bullet list, a numbered list and a table.

**The cite line.** Under the finished answer, the line keeps the form the owner decided on 2026-09-23. The site's icon stands once at its head, then each title linked into the model, each with its GitHub mark. It is restyled to the terminal's dim ink and accent. A second dim line reads `model <sha> · <seconds>s`. The commit is the one the cites' URLs name, and the seconds are measured in the browser from send to `finish()`. An answer without cites prints no second line, since it has no commit to name.

**Ask next.** The three questions after an answer print as a numbered menu under a dim `Ask next`, with the same picking rules `follow()` and `spread()` apply today. Once a new question is sent, every earlier menu dims to show it is spent. The rows stay clickable.

**Refusals.** A refusal prints as `✗` and its sentence, in the terminal's red, not as a centered italic line. The sentences and the moment a limit lifts are as today.

**The command line.** The form becomes a prompt: a `›` in the accent, then the field in mono, with no Send button. Enter sends, and Shift+Enter still breaks a line, since the field stays a `textarea`. It opens at one row and grows to four. Under it, a dim keys line names what works: `enter send · ↑ last question · 1-n pick · /help`. The `1-n` part shows only while a menu stands. What those keys do:

- **A number** alone, within the range of the latest menu, sends that row's question. Anything else is sent as typed.
- **↑** in an empty field brings back the visitor's last question.
- **`/new`** and **`/clear`** start over as ↻ does. **`/help`** prints the list of keys and commands into the log. None of the three is ever sent to the host or kept as a turn.

The strings gain every new sentence in English and, as drafts for the translator of `conventions/TRANSLATOR.md`, in German.

## What has to change with it

**The README** chat paragraph says what the panel looks like now, that the intro reads the header's `a.brand`, and what the command line takes.

**The tests.** `test/chat.test.mjs` holds the pure parts. The new ones are exported on `rbChat` beside the existing functions:

- `lockupOf(doc)` returns the mark and the two halves of the name from `header a.brand`, or null where there is none.
- `command(text)` returns `new`, `help` or null, for the slash commands only.
- `picked(text, rows)` returns the row's question for a bare number within range and the text otherwise.
- `tryRows(items, lang)` returns the Try rows from the model file, leaving out any the model cannot fill.
- `commitOf(cites)` returns the seven-character commit, or null.

Each gets its cases on the stub, including the negatives: a number out of range, `/newer`, a header without a brand, and a model file with no process. The existing tests for bubbles and chips move to the new classes and keep their assertions about behavior. The review's rendering check looks at the panel on all three sites, in both themes and both languages, at the desk's width and the phone's. It covers a fresh conversation, a restored one, an answer with a diagram, one with a table, and a refusal. `chat-arrive.test.mjs`, which already drives the panel in Chromium, gains a case with a stubbed stream sent slowly: the log holds only the spinner, its seconds counting, until the stream ends, and then the whole answer at once.

## What this is not

Not a change to the chat server or either MCP server: nothing here needs a field the stream does not carry. Not a change to what is sent, when, or to whom. The privacy page stays true as written, since only the notice's place changes. Not a change to the launcher button at the foot of the page. Not a terminal emulator: there are no history files, no tab completion, and no commands beyond the three.

## The order

First this spec's review. Then an implementation plan. Then one pull request in this package, and one release, the next minor after whatever `main` carries. After that the re-pins of blust.ch, companygraph.io and guestgraph.io, each measured locally against its own chat before its pull request, as the chat's other changes have been. Merging, the tag and the re-pins each wait for the owner's word.

## Decisions

Taken by the owner on 2026-09-28 from the prototype: the whole chat as the terminal, not only its first screen; lists and tables as the section above says; an answer shown whole and at once when it is finished, behind a spinner that counts the seconds, with no animation of any kind; the answer's text in today's face and tone, with the question and everything the chat prints around the answer in mono.

## Open for the owner

1. **The intro once the conversation starts.** Should it stay at the top of the log and scroll away, or clear on the first send? The proposal is to keep it, as a terminal keeps its banner above what follows. That leaves the Try rows there to click again.
