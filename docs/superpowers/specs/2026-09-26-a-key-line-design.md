# A key line — design

> The family gets a third form beside a paragraph. The yellow line under a page's title is the caveat and the green line is the conclusion; a key line is a section's one point in a sentence, lifted out of its paragraph and said once, in `--c-firm` text with no line of its own.

Status: agreed with the owner on 2026-09-26, answer by answer, against a rendered preview of blust.ch's first post. It came from that post, "Deciding well is solved. For me.", whose sentences that carry it, the question the career break began with first among them, sat in dim prose at the same weight as everything around them.

## What was decided

**Lifted, not repeated.** The sentence leaves its paragraph and stands between the two halves of it, so a reader and a screen reader meet it once, in the reading order. A magazine pull quote, the same sentence repeated beside the text, was refused: seven repeats in a five-minute post is heavy, and the copy would have to be hidden from assistive technology. Marking the sentence in place was refused too, because a skimming reader would not see it, and seeing it is the point.

**The body face, brought forward.** Instrument Sans at weight 500, about 1.2rem, in `--c-firm`. `--c-firm` already means the thesis, and the principles page already sets a value's statement in it (`.value .tagline`), so the key line uses a meaning the family has. Bricolage was refused: beside a Bricolage section heading of nearly the same size, a key line reads as a subheading. It draws no line, so it never competes with the caveat's yellow or the conclusion's green.

**Once per section, and not beside a conclusion.** At most one key line per section, and none in a section that carries a `.conclusion`, so a section brings forward one thing. The limit matches the conclusion's own, and it is what keeps a key line standing out on the next post too.

**A plain paragraph.** The element is `<p class="keyline">`. It is not a `<blockquote>`, because it quotes no one.

## What changes in the design

- `blocks/lines.css`, v2: `.keyline` joins `.title .note` and `.conclusion`, and the fence's comment names the three and their rules together: `margin-block:1.4rem; max-width:54ch; font-size:1.2rem; font-weight:500; line-height:1.45; color:var(--c-firm)`, in the body face.
- `blocks/tokens.css`: `--c-firm`'s line in the comment names the key line beside the thesis. No value changes.
- `test/assemble.test.mjs` holds the `.keyline` rule in `page.css`. `--c-firm` is already held to its contrast in both themes.
- A minor release, because `page.css` and `tokens.css` are synced files. A site takes it with a re-pin and `npm run design`.

## What changes on blust.ch

The post `blog/deciding-well-solved/` takes the release and uses it. These are the post's own styles and text, not the design's.

- Six key lines, one per section except the evidence section:
  1. The claim: "An outcome says nothing about how a decision was made; a coin toss ends well half the time."
  2. The question came first: "What do I like doing, rather than what am I used to being hired for?"
  3. The facts: "On paper that costs. In the room it buys the opposite."
  4. The agents: "An agent that rates is useful exactly as long as its rubric is not its own."
  5. The decision: "The criterion was written before the offers arrived, not after."
  6. Why that is deciding well: "Deciding well is not solved. Mine was."
- The evidence section's figures sentence, the split by track and the offer from the architect track, becomes its `.conclusion`.
- A paragraph a key line is lifted from splits in two around it. The writer rewords only the edges, such as a lead-in that ends in a colon or a continuation that no longer starts with the lifted sentence, and the owner reviews the English on the rendered page. The German roles then run on the values that changed.
- The post's prose rule becomes `.post p:where(:not(.keyline,.conclusion))`, which keeps its weight so that the smaller rules under it, such as the gap under a "Rests on" entry's title, still apply.
- The rules between the post's sections go, and so do the rules between the entries in "Rests on". Space and the section headings separate them. The only rules left are a 1px rule under each group label, "Decisions" and "Experiences".
- "Rests on" is quieter: its heading keeps the headings' face at about 1.05rem, weight 600, in `--dim`, with more space above it and no rule. Its entries are a step smaller, titles at 0.94rem and lines at 0.88rem. A dim mono label was tried and refused, because it made "Rests on" read weaker than the group labels under it.

## Order

The design pull request merges on the owner's go and the release is cut, then the blust.ch pull request re-pins, and it too merges on the owner's go.
