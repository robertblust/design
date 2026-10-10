# Tokens

The tokens are one set for the whole family, declared once in [blocks/tokens.css](../../blocks/tokens.css) for the dark theme and again, re-picked, under `data-theme="light"`. That file holds every value and the reason each was picked, contrast figures included; this page holds what a color means and what a face sets.

## Color roles

Color is one hue at four brightnesses, and brightness is confidence: the dimmer a line, the less settled what it says. On the light theme the axis flips, and depth is confidence instead. Two roles stand beside that ramp with jobs of their own.

```text
             ┌─────────── one hue, four stops ───────────┐
  dark:      dim ──────────────────────────────────► bright
  light:     pale ─────────────────────────────────► deep
             --c-weak      --c-mid      --c-firm      --c-flag
             candidate     interactive  resolved      reversal

  beside the ramp:   --c-sum   a conclusion, its own hue
                     --c-path  the way back to the root, --c-firm's value under its own name
```

| Name | Means | Never |
| --- | --- | --- |
| `--c-weak` | A candidate: considered, not accepted | Text, a border or an outline on its own, in either theme |
| `--c-mid` | Anything interactive: a link, a control, the brand accent | The resolved thing, which would then read as still open |
| `--c-firm` | The resolved thing: the thesis, the current page | A link, which would then read as settled |
| `--c-flag` | A reversal | Decoration |
| `--c-sum` | A conclusion: what the figures before it add up to | Text |
| `--c-path` | Where you are and how you got here: the ancestors of the focused node and the line through them | The resolved thing, which only happens to look alike |

Where a page may draw a line in these colors, and how often, is the [lines](blocks.md#lines) block's.

## Token families

Every other token is a surface, not a meaning, and belongs to one family.

| Family | Tokens | Painted by |
| --- | --- | --- |
| Page | `--ground`, `--raise`, `--rule`, `--sky`, `--ink`, `--dim`, `--press` | every prose page and deck |
| Deck chrome | `--deck-*`, `--slab`, `--lcd*`, `--warn` | the [transport](decks.md#transport) and each deck's own slides |
| Terminal | `--t-*` | the [chat](assets.md#chat), the [modal](assets.md#modal) and the [header row](blocks.md#header-row)'s bar |

A page reads the page family and never defines a token of its own; the modal re-points the page family at the terminal's, so whatever it holds draws in the terminal's colors.

In the terminal family `--t-good` and `--t-bad` say an answer's state, and `--t-part`, between them, underlines a claim of an answer that its evidence carries only in part. It is a mark and never text, so it is held to 3:1 against `--t-card`, the answer's ground; every other claim the evidence does not carry is underlined in `--t-bad`. A question a link carries, waiting for the visitor to send it, is a thing to act on, so it takes `--t-accent`, the terminal's interactive color, and stands out by an edge wider than an answer's and a single ring as it arrives rather than by a second hue. It never takes `--t-part`: in the panel that color already marks a claim its evidence carries only in part, and a question is not a claim.

## Faces

Three faces, each with one job, self-hosted from the [fonts](assets.md#fonts) group. The [prose reset](blocks.md#prose-reset) sets Instrument Sans and Plex Mono on a prose page, each block that marks a section sets Bricolage Grotesque, and a deck's lockup and transport set their own.

| Face | Job |
| --- | --- |
| Instrument Sans | Prose: the body of every page and every deck |
| Plex Mono | The ledger and the chrome: the footer, the stage and a deck's transport |
| Bricolage Grotesque | A section's mark: the small heading that names a principle, a seat or a surface |

Mono means data. A line set in Plex Mono says it is a record, a path, a commit or a figure, which is why an instruction, a hint or a control is never set in it.
