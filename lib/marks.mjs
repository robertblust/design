// The two natures' marks, as the Processes page draws them: a filled figure for a person and an
// outlined machine for an agent, on a 16-unit square, each in currentColor. After them the six
// ArchiMate elements a system's kind may name, drawn as the standard's own icons: a component
// with its two tabs, a node as a cube, system software as a disc with a circle on its rim, a
// device as a screen on a stand, equipment as a gear and a network as joined nodes. The chat
// widget carries the same bodies, since it is a script a page loads and imports nothing, and a
// test holds its copy to this one.
export const MARKS = {
  human: '<circle cx="8" cy="4.6" r="3.1" fill="currentColor"/><path d="M1.6 15.4a6.4 6.4 0 0 1 12.8 0z" fill="currentColor"/>',
  agent: '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="5.4" width="12" height="8.6" rx="2.6"/><path d="M8 5.4V3.2"/></g><circle cx="8" cy="2.1" r="1.1" fill="currentColor"/><circle cx="5.7" cy="9.6" r="1.05" fill="currentColor"/><circle cx="10.3" cy="9.6" r="1.05" fill="currentColor"/>',
  "application-component": '<rect x="4.5" y="2" width="9.5" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="4.6" width="5" height="2.4" fill="currentColor"/><rect x="2" y="9" width="5" height="2.4" fill="currentColor"/>',
  node: '<path d="M2.5 5.5L5.5 2.5H13.5V10.5L10.5 13.5H2.5ZM2.5 5.5H10.5V13.5M10.5 5.5L13.5 2.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  "system-software": '<circle cx="7" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="10.5" cy="5.5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  device: '<rect x="2" y="2.5" width="12" height="8.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 14h6M8 11v3" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  equipment: '<circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.5v2.3M8 12.2v2.3M1.5 8h2.3M12.2 8h2.3M3.4 3.4l1.6 1.6M11 11l1.6 1.6M3.4 12.6l1.6-1.6M11 5l1.6-1.6" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  "communication-network": '<circle cx="3.2" cy="11.5" r="2.1" fill="currentColor"/><circle cx="12.8" cy="4.5" r="2.1" fill="currentColor"/><circle cx="12.8" cy="11.5" r="2.1" fill="currentColor"/><path d="M5 10.2L11 5.8M5.3 11.5h5.4" stroke="currentColor" stroke-width="1.3"/>',
};
