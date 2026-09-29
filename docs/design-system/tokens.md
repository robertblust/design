# Tokens

The tokens are one set for the whole family, declared once in [blocks/tokens.css](../../blocks/tokens.css) for the dark theme and again, re-picked, under `data-theme="light"`. That file holds every value and the reason each was picked, contrast figures included; this page holds what a color means and what a face sets, which the three brands used to state one copy each.

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
| `--c-flag` | A reversal, at most once per page | Decoration |
| `--c-sum` | A conclusion, what a section's figures add up to, as the line of a conclusion and at most once per section | Text |
| `--c-path` | Where you are and how you got here: the ancestors of the focused node and the line through them | The resolved thing, which only happens to look alike |

The lines a prose page draws in these colors, the caveat, the conclusion and the key line, are the [lines](blocks.md#lines) block's.

## Token families

Every other token is a surface, not a meaning, and belongs to one family.

| Family | Tokens | Painted by |
| --- | --- | --- |
| Page | `--ground`, `--raise`, `--rule`, `--sky`, `--ink`, `--dim`, `--press` | every prose page and deck |
| Deck chrome | `--deck-*`, `--slab`, `--lcd*`, `--warn` | the [transport](decks.md#transport) and the [lockup](decks.md#lockup) |
| Terminal | `--t-*` | the [chat](assets.md#chat) and the [modal](assets.md#modal) |

A page reads the page family and never defines a token of its own; the modal re-points the page family at the terminal's, so whatever it holds draws in the terminal's colors.

## Faces

Three faces, each with one job, self-hosted from the [fonts](assets.md#fonts) group and set by the [prose reset](blocks.md#prose-reset).

| Face | Job |
| --- | --- |
| Instrument Sans | Prose: the body of every page and every deck |
| Plex Mono | The ledger and the chrome: the footer, the stage and a deck's transport |
| Bricolage Grotesque | A section's mark: the small heading that names a principle, a seat or a surface |

Mono means data. A line set in Plex Mono says it is a record, a path, a commit or a figure, which is why an instruction, a hint or a control is never set in it.
