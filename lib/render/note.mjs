// The one sentence that says why a generated region does not translate, and the only copy of
// it. Every renderer that writes a generated page's note takes it from here, and a note explaining
// why a page does not translate is exactly the note that must not say two different things on
// two pages.
export const NOTE_EN = "Generated from the model, so the words below are its own — and in the one " +
  "language it is written in. The rest of this site is bilingual; a translated copy would be a " +
  "second thing to keep true, which is what this page argues against.";
export const NOTE_DE = "Aus dem Modell erzeugt: Die Worte unten sind seine eigenen – und in der einen " +
  "Sprache, in der es geschrieben ist. Der Rest dieser Website ist zweisprachig; eine übersetzte " +
  "Kopie wäre eine zweite Fassung, die ebenfalls stimmen müsste – und genau dagegen argumentiert " +
  "diese Seite.";

// The same note for a page whose model strings carry a German translation beside them. The
// model is still written in one language; what changes is that the site holds a translation of
// it to that English, and the build fails the moment the English moves.
export const NOTE_TRANSLATED_EN = "Generated from the model, so the words below are its own. The model is " +
  "written in English; the German is a translation held to that English by a check, which stops " +
  "the build the moment the English moves.";
export const NOTE_TRANSLATED_DE = "Aus dem Modell erzeugt: Die Worte unten sind seine eigenen, " +
  "übersetzt aus dem Englischen, in dem es geschrieben ist. Eine Prüfung bindet die Übersetzung " +
  "an den englischen Text: Ändert sich das Englische, stoppt die Prüfung den Build.";
