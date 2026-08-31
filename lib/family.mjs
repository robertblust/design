// The three domains that carry a reader's language between them, in one place.
//
// This regex was hardcoded in twenty-three places — every page's language block, and the
// `carriesLang` check in all three verify suites. Adding a fourth site was a twenty-three-file
// edit, and a partial one produced a site that silently dropped the language on the way out.
//
// The pages get it substituted into their block; the checks import it from here. Both read the
// same source, so a page and the check that guards it cannot disagree.
export const FAMILY = /^(www\.)?(blust\.ch|companygraph\.io|guestgraph\.io)$/;
