# A key line — design

> The family gets a third form beside a paragraph. The yellow line under a page's title is the caveat and the green line is the conclusion; a key line is a section's one point in a sentence, lifted out of its paragraph and said once, in `--c-firm` text with no line of its own.

Status: agreed with the owner on 2026-09-26, answer by answer, against a rendered preview of blust.ch's first post, and revised after a design review of that preview. It came from that post, "Deciding well is solved. For me.", whose sentences that carry it, the question the career break began with first among them, sat in dim prose at the same weight as everything around them.

## What was decided

**Lifted, not repeated.** The sentence leaves its paragraph and follows it, either completing a lead-in that ends in a colon or closing the section after a whole paragraph, so a reader and a screen reader meet it once, in the reading order. A magazine pull quote, the same sentence repeated beside the text, was refused: six repeats in a five-minute post is heavy, and the copy would have to be hidden from assistive technology. Marking the sentence in place was refused too, because a skimming reader would not see it, and seeing it is the point.

**The body face, brought forward.** Instrument Sans at weight 500, about 1.2rem, in `--c-firm`. `--c-firm` already means the thesis, and the principles page already sets a value's statement in it (`.value .tagline`), so the key line uses a meaning the family has. Bricolage was refused: beside a Bricolage section heading of nearly the same size, a key line reads as a subheading. It draws no line, so it never competes with the caveat's yellow or the conclusion's green.

**Bound to what precedes it.** A key line is `--c-firm` like a link, and the site's links carry no underline, so color alone would let it read as clickable. Its spacing tells them apart: 0.6rem above, tighter than the 1rem between two paragraphs, and 1.4rem below, so it reads as the completion of the sentence before it, which a link never is. Its lines are balanced, so a short last line never hangs under a long one.

**Once per section, and not beside a conclusion.** At most one key line per section, and none in a section that carries a `.conclusion`, so a section brings forward one thing. A section may have none, and a line that repeats a point made elsewhere is left out. The limit matches the conclusion's own, and it is what keeps a key line standing out on the next post too.

**A plain paragraph.** The element is `<p class="keyline">`. It is not a `<blockquote>`, because it quotes no one.

## What changes in the design

- `blocks/lines.css`, v2: `.keyline` joins `.title .note` and `.conclusion`, and the fence's comment names the three and their rules together: `margin:.6rem 0 1.4rem; max-width:54ch; font-size:1.2rem; font-weight:500; line-height:1.45; color:var(--c-firm); text-wrap:balance`, in the body face.
- `blocks/tokens.css`: `--c-firm`'s line in the comment names the key line beside the thesis. No value changes.
- `test/assemble.test.mjs` holds the `.keyline` rule in `page.css`. `--c-firm` is already held to its contrast in both themes.
- A minor release, because `page.css` and `tokens.css` are synced files. A site takes it with a re-pin and `npm run design`.

## What changes on blust.ch

The post `blog/deciding-well-solved/` takes the release and uses it. These are the post's own styles and text, not the design's.

- Five key lines. "The facts were kept in one place" and "What the evidence said" have none:
  1. The claim, closing the section: "An outcome says nothing about how a decision was made; a coin toss ends well half the time."
  2. The question came first, after a lead-in with a colon: "What do I like doing, rather than what am I used to being hired for?"
  3. The agents, after a lead-in with a colon: "An agent that rates is useful exactly as long as its rubric is not its own."
  4. The decision, closing the section: "The criterion was written before the offers arrived, not after."
  5. Why that is deciding well, after "So the claim stands as the talk made it.": "Deciding well is not solved. Mine was."
- The facts section keeps its paragraph whole: its "On paper that costs … In the room it buys the opposite" is the same point as the evidence section's "what it cost on paper it paid back in every room", and one point is brought forward once or not at all.
- The evidence section's figures sentence, the split by track and the offer from the architect track, becomes its `.conclusion`. The sentence that says where the figures stand, on the timeline, follows it as a plain paragraph, because it is a source and not what the figures add up to.
- The paragraphs a key line leaves are reworded at their edges only: "The claim" ends "It is not closed because the outcome was good." before its line, and "The decision" opens its last paragraph "Values over pay, a product company, a day kept free: that was the criterion." The writer drafts these on the branch, the owner reviews the English on the rendered page, and the German roles then run on the values that changed.
- The post's prose rule becomes `.post p:where(:not(.keyline,.conclusion))`, which keeps its weight so that the smaller rules under it, such as the gap under a "Rests on" entry's title, still apply.
- The rules between the post's sections go, and so do the rules between the entries in "Rests on". Space and the section headings separate them. The only rules left are a 1px rule under each group label, "Decisions" and "Experiences".
- "Rests on" is quieter: its heading keeps the headings' face at about 1.05rem, weight 600, in `--dim`, with more space above it and no rule. Its group labels, "Decisions" and "Experiences", stay in mono but drop to about 0.74rem, weight 400, in `--dim`. Its entries are a step smaller, titles at 0.94rem and lines at 0.88rem. A dim mono label was tried and refused, because it made "Rests on" read weaker than the group labels under it.

## Order

The design pull request merges on the owner's go and the release is cut, then the blust.ch pull request re-pins, and it too merges on the owner's go.
