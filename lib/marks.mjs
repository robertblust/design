// The two natures' marks, as the Processes page draws them: a filled figure for a person and an
// outlined machine for an agent, on a 16-unit square, each in currentColor. The chat widget carries
// the same two bodies, since it is a script a page loads and imports nothing, and a test holds its
// copy to this one.
export const MARKS = {
  human: '<circle cx="8" cy="4.6" r="3.1" fill="currentColor"/><path d="M1.6 15.4a6.4 6.4 0 0 1 12.8 0z" fill="currentColor"/>',
  agent: '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="5.4" width="12" height="8.6" rx="2.6"/><path d="M8 5.4V3.2"/></g><circle cx="8" cy="2.1" r="1.1" fill="currentColor"/><circle cx="5.7" cy="9.6" r="1.05" fill="currentColor"/><circle cx="10.3" cy="9.6" r="1.05" fill="currentColor"/>',
};
