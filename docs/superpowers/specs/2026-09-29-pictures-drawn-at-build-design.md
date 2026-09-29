# Pictures drawn at build

Status: the owner asked on 2026-09-29 whether the team page's pictures should be drawn when the site builds rather than in the visitor's browser. This spec answers yes, on three conditions, and the owner approved building it the same day; it describes what was built. Decided against `robertblust/design` at `main` after #202 and the three sites as read that day, which are the source of every fact below about what exists.

## Why

Each site's team page carries one picture per process board, the figure `renderPicture` in `lib/render/team.mjs` writes: a `figure[data-diagram]` with the picture as JSON and an empty box. `chat.js` fetches Mermaid, several megabytes, once the figure nears the screen, and draws it there. So the page grows when the picture arrives, a visitor without JavaScript sees an empty box, and every visit draws again the same picture that changes only when the model does. The site is built exactly when the model changes, so that is when the picture should be drawn.

The chat's answers stay as they are. They exist only in the browser, and #202 already keeps a drawn answer's picture for the tab.

## The shape

**Drawn by the site, once, in a browser.** A new module, `@robertblust/design/pictures`, exports `drawPictures({ chromium, root })`, which each site calls from a script of its own run as `npm run pictures`, since the package never imports Playwright and the site hands its browser in, as it does for the share cards. It serves the site, opens the team page in headless Chromium, and lets the site's own `chat.js` draw every figure the way it draws one today, links and wrapped names included. What it draws is harvested from the box and written to a file beside the page, one per picture: `team/pictures/<process>.svg`, the board's slug naming it. The sites already run Playwright for their checks, so nothing new is installed.

**One SVG for both themes.** Mermaid writes fixed colors into what it draws, and a picture drawn in the dark theme would stay dark on a light page. So the build draws with a placeholder color for each token the picture reads, `--ground`, `--raise`, `--press`, `--ink`, `--c-mid` and `--dim`, and replaces every placeholder in the result with `var(--token)`, and a translucent one with `color-mix(in srgb, var(--token) N%, transparent)`, which the edge labels' background is. The picture then takes the page's colors in either theme. The one modal already sets the terminal's colors on those tokens, so the same SVG shows in the terminal's colors at full screen, and Expand draws nothing. Mermaid derives some colors of its own from the ones it is given, and its style block carries rules for elements a picture does not have, which paint nothing. **The build refuses a picture that paints a color it cannot name as a token,** read off what each element paints in the browser, not off the SVG's text, so a derived shade shows up as a failed build and never as a wrong color on one theme.

**A check that reads no pixels.** Mermaid measures text with the fonts where it runs, so a picture drawn on a Mac and one drawn in Linux CI differ by a pixel here and there, and a check that drew again and compared would fail at random. The share cards solved the same problem: each `.svg` gets a stamp beside it, `<process>.sha`, the hash of what went into it — the picture's source and nodes and the site's own copies of `chat.js` and `mermaid.min.js`, the two files that draw it. `npm run pages` inlines the committed SVG into its figure when the stamp matches and marks the box `data-drawn`. Where it does not, the box stays empty for `chat.js` to draw at runtime, and `pages:check` fails with "run: npm run pictures, then npm run pages". CI never draws.

**One direction.** In a panel narrower than 560px, the chat turns a left-to-right flow top to bottom. A page's picture is scaled to fit its column, so it keeps the direction it was drawn in.

**What `chat.js` does with it.** A figure whose box already holds an SVG is left alone: no Mermaid, no drawing, the node links already in the markup. Expand moves the box into the modal as today, and zoom, pan and the node links work on the SVG as they do on a drawn one. A figure without an SVG, a stale stamp in a local build, is drawn at runtime as now.

## What it costs

- **A design minor:** `drawPictures`, `renderPicture` inlining a stamped SVG, `chat.js` leaving a drawn figure alone, and the check. `pages:check` fails on every site until it has drawn its pictures, so the re-pin that takes this release draws them.
- **Each site:** a `pictures` script, running it and committing the files, and a step in its build notes: after `npm run pages`, `npm run pictures`, then `npm run pages` again. Every re-pin that changes `chat.js` or `mermaid.min.js` draws them again, as it renders the share cards again. `drawPictures` takes a `pages` list, the team page by default, so a later page with a picture names itself there.

## Not in this

- The model page's graph, which is D3 and no Mermaid picture.
- A reserved size without the SVG, the cheaper route: it stops the page growing, but keeps the download and the drawing.
