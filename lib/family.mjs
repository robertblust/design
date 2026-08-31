// The three domains that carry a reader's language between them, in one place.
//
// This regex was hardcoded in twenty-three places — every page's language block, and the
// `carriesLang` check in all three verify suites. Adding a fourth site was a twenty-three-file
// edit, and a partial one produced a site that silently dropped the language on the way out.
//
// There is no `{{family}}` slot: `blocks/lang.js` carries its own literal copy of this pattern,
// not a substitution from here, because blockFor has nothing to substitute it with. The checks
// in all three sites import FAMILY from this module directly, so those agree with each other by
// construction — but the copy inside the block is bound to it only by a test,
// `test/params.test.mjs`'s "the block carries FAMILY's source text, so page and check agree",
// which asserts the block's text contains this regex's exact source. Change one without the
// other and that test catches it; nothing else does.
export const FAMILY = /^(www\.)?(blust\.ch|companygraph\.io|guestgraph\.io)$/;
