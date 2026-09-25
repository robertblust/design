# A line for a conclusion — design

> The family gets a second line beside a paragraph. The yellow `--c-flag` line under a page's title already marks the caveat; a green `--c-sum` line now marks a conclusion, what the figures above add up to. Both live in one new block, `lines`, so a line's color means the same thing on every page.

Status: approved by the owner on 2026-09-25. It came from blust.ch's cost page, whose two concluding callouts carried a blue line the family does not use. The owner asked for a greenish conclusion line and for the colors to carry named meanings; red was left out until a page needs it.

## What was decided

**Yellow is the caveat, green is the conclusion.** `--c-flag` keeps its rule, once per page, and is named as the caveat the title note carries. `--c-sum` is new: a conclusion drawn from the figures above, at most once per section, used only as a line and never as text.

**Red waits.** `--warn` and `--c-flag` measured a CVD distance of 3.4 in light and are below the normal-vision floor in both themes, so a red risk line would be read as a caveat by a reader with red-green color blindness. A risk line comes with a second carrier, a dash or a label, when a page first needs one.

**The values.** `--c-sum` is #1E9A4B on the light ground and #34D399 on the dark, each above the 3:1 WCAG asks of a non-text mark and saturated enough to stand beside the amber: the owner found a first, bluer pair, #2A8C5A and #7AD0B2, too faint next to the yellow. Measured against the amber and `--c-mid`, the closest pair is the amber in both themes, at a CVD distance of 9.4 and a normal-vision distance of 19.5 in light and 8.6 and 19.0 in dark, all above the palette check's floors of 8 and 15. A purer green was tried in dark and refused: every one fell below 5 against the amber for a reader with red-green color blindness, the classic green–yellow confusion, so the dark green keeps a trace of blue. The first greens of all, #2F7A4A and #6FBF8A, sat below both floors against the amber.

## What changes

- `blocks/tokens.css`, v12: `--c-sum` in both themes, and its job beside the four the comment already names.
- `blocks/lines.css`, v1, a new fence `lines` appended to `page.css` after the title contract: `.title .note` in `--c-flag` and `.conclusion` in `--c-sum`. The title note's rule is the one every site already carries in its own page styles, so taking it changes nothing a visitor sees.
- `test/theme.test.mjs` holds `--c-sum` to 3:1 in both themes; `test/assemble.test.mjs` holds the two rules in `page.css`.
- A minor release, v0.88.0, because `tokens.css` and `page.css` are synced files. A site takes it with a re-pin and `npm run design`; nothing else is asked of it.
