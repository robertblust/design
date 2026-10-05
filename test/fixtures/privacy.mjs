// A model shaped like the three instances': stored items in two mechanisms, two activities, three
// processors, one of them named by both activities.
export const item = (name, mechanism, tagline, extra = {}) => ({ id: `id-${name}`, address: `stored-items/${name}`, type: "stored-item", name, tagline,
  fields: { mechanism, necessity: "optional", surfaces: ["Site"], ...extra }, sections: [] });
export const proc = (name, countries, extra = {}) => ({ id: `id-${name}`, address: `data-processors/${name}`, type: "data-processor", name, tagline: `${name} does a thing.`,
  fields: { "legal-name": `${name} Ltd`, countries, ...extra }, sections: [] });
export const act = (name, basis, retention, rows) => ({ id: `id-${name}`, address: `processing-activities/${name}`, type: "processing-activity", name, tagline: `${name}.`,
  fields: { "legal-basis": basis, retention }, sections: [{ heading: "Processors", text: "", tables: [{ columns: ["Processor", "Receives"], rows }] }] });

export const PRIVACY_FIXTURE = {
  commit: "abcdef0123456789", repo: "example/model",
  entities: [
    item("theme", "local-storage", "Light or dark."),
    item("lang", "local-storage", "The language you chose."),
    item("chat", "session-storage", "The conversation in this tab."),
    proc("Google Cloud", ["CH"]),
    proc("Anthropic", ["US"], { processing: "any" }),
    act("Answering in the chat", "legitimate-interests", "The conversation is kept only in the visitor's browser tab and ends when the tab closes",
      [["Google Cloud", "The messages"], ["Anthropic", "The conversation"]]),
    act("Keeping the chat's questions", "legitimate-interests", "Ninety days, and the weekly report is gone before them",
      [["Google Cloud", "The question, no address"]]),
  ],
};
