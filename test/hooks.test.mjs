// A fenced block sits inside the page's own <script> and sees whatever the page declared
// above it; a file loaded as page.js or deck.js is its own scope and sees nothing of the
// page at all. window.rbPage = { lang, applyLang } and window.rbDeck = { talk, ui } are the
// only way a shared script can still reach the page once it ships as a whole file — see
// "The hook object" in docs/superpowers/plans/2026-09-23-shared-css-as-files.md.
//
// Each of the four names — rbPage.lang, rbPage.applyLang, rbDeck.talk, rbDeck.ui — resolves
// as: the hook object if it declares the name, else whatever a fenced page still declares in
// scope, else a default, read with `typeof x !== "undefined"` rather than a bare reference so
// the check itself cannot throw when a name is simply absent. blocks/lang.js and
// blocks/theme.js are tested directly, at the block level, with vm — the same technique
// test/theme.test.mjs's runThemeBlock already uses — because that is where the resolution
// lives and it exposes the resolved value without needing a full deck's DOM. blocks/deck-
// runtime.js is tested through the fully assembled deck.js instead, because reading TALK
// safely needs the same DOM stub the assembled file needs anyway, and running the real
// artifact is the more honest test of what a deck actually loads.
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

import { blockFor } from "../lib/fences.mjs";
import { assemble } from "../lib/assemble.mjs";

function storage() {
  const store = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
  };
}

const LOCATION = { href: "https://blust.ch/", origin: "https://blust.ch", search: "", pathname: "/", hash: "" };

// ---------- blocks/lang.js, at the block level ----------

function runLang(extra) {
  const sandbox = Object.assign({
    console, URL,
    localStorage: storage(),
    location: { ...LOCATION },
    history: { replaceState() {} },
    document: { addEventListener() {}, readyState: "complete", querySelectorAll: () => [], documentElement: { lang: "en" } },
    window: {},
  }, extra);
  vm.createContext(sandbox);
  vm.runInContext(blockFor("language", "page"), sandbox);
  return sandbox;
}

test("lang: window.rbPage.lang wins when a page declares the hook", () => {
  const calls = [];
  const sandbox = runLang({ window: { rbPage: { lang: "de", applyLang: (l) => calls.push(l) } } });
  assert.equal(sandbox.lang, "de");
  assert.deepEqual(calls, ["de"], "applyLang was not called with the decided language");
});

test("lang: falls back to a scope lang when a fenced page still declares its own, and calls no applyLang", () => {
  assert.doesNotThrow(() => runLang({ window: {}, lang: "de" }));
  const sandbox = runLang({ window: {}, lang: "de" });
  assert.equal(sandbox.lang, "de");
});

test("lang: defaults to en and throws nothing when neither the hook nor a scope lang exists", () => {
  assert.doesNotThrow(() => runLang({ window: {} }));
  const sandbox = runLang({ window: {} });
  assert.equal(sandbox.lang, "en");
});

test("lang: a hook with no applyLang throws nothing", () => {
  assert.doesNotThrow(() => runLang({ window: { rbPage: { lang: "de" } } }));
});

test("lang: the family key is what is actually read and written", () => {
  const sandbox = runLang({ window: {} });
  assert.equal(sandbox.LANG_KEY, "lang");
  sandbox.langRemember("de");
  assert.equal(sandbox.localStorage.getItem("lang"), "de");
  assert.equal(sandbox.langStored(), "de");
});

// ---------- blocks/theme.js, at the block level ----------

function runTheme(extra) {
  const sandbox = Object.assign({
    console, URL,
    localStorage: storage(),
    location: { ...LOCATION },
    history: { replaceState() {} },
    document: { addEventListener() {}, documentElement: { getAttribute: () => null } },
  }, extra);
  vm.createContext(sandbox);
  vm.runInContext(blockFor("theme", "page"), sandbox);
  return sandbox;
}

test("theme: falls back to a scope theme when a fenced page still declares one", () => {
  const sandbox = runTheme({ theme: "light" });
  assert.equal(sandbox.theme, "light");
});

test("theme: falls back to the document's own data-theme attribute when nothing is in scope", () => {
  const sandbox = runTheme({ document: { addEventListener() {}, documentElement: { getAttribute: () => "light" } } });
  assert.equal(sandbox.theme, "light");
});

test("theme: defaults to dark and throws nothing when neither scope nor the attribute says light", () => {
  assert.doesNotThrow(() => runTheme({}));
  const sandbox = runTheme({});
  assert.equal(sandbox.theme, "dark");
});

test("theme: the family key is what storageKeys stores under", () => {
  const sandbox = runTheme({});
  assert.equal(sandbox.THEME_KEY, "theme");
  sandbox.themeRemember("light");
  assert.equal(sandbox.localStorage.getItem("theme"), "light");
});

// ---------- the assembled files, loaded as page.js and deck.js actually ship ----------
//
// A file has no page scope at all, so these load the real bytes assemble() produces with
// `new Function`, a global window and document, and no lexical scope of the test's own to
// leak in — the same shape a site's own <script src> gives it. globalThis is restored after
// each load so this file leaves no trace on any test run alongside it.

function fakeElement() {
  return {
    dataset: {},
    style: { setProperty() {} },
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    setAttribute() {}, getAttribute: () => null, removeAttribute() {}, hasAttribute: () => false,
    toggleAttribute() {}, addEventListener() {}, removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
  };
}

function fakeDocument({ slides = [] } = {}) {
  const bar = fakeElement();
  const listeners = {};
  return {
    documentElement: fakeElement(),
    readyState: "complete",
    fullscreenElement: null,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    getElementById: () => fakeElement(),
    // nav fit throws on purpose when a page carrying it has no `.bar` yet — unrelated to the
    // hook, and a real page always has one, so the stub must too.
    querySelector: (sel) => (sel === ".bar" ? bar : null),
    querySelectorAll: (sel) => (sel === ".slide" ? slides : []),
    createElement: () => fakeElement(),
    _listeners: listeners,
  };
}

// Runs `src` (the bytes assemble() returns) as a whole file would load: `window` and
// `document` are the only two names a site's own page ever gives it, plus the handful of
// bare browser globals every block already assumed when it ran fenced (MutationObserver,
// Audio, localStorage, location, history) — none of which are page scope, all of which a
// real browser always supplies. Restores globalThis afterward either way.
// `after`, when given, runs before globalThis is restored — carryLang and carryTheme read
// `localStorage` as a bare global at call time, not as a value they closed over, so a click
// simulated once the real globalThis.localStorage is back reads the wrong store entirely.
function loadAssembled(src, { rb, seedTheme, after } = {}) {
  function MutationObserverStub() { this.observe = function () {}; this.disconnect = function () {}; }
  function AudioStub() { this.preload = ""; this.addEventListener = function () {}; this.pause = function () {}; }
  const win = {
    addEventListener() {}, MutationObserver: MutationObserverStub,
    // deck fit's own concern, unrelated to any hook — a deck always has these in a browser.
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    innerWidth: 1280, innerHeight: 720,
  };
  if (rb) Object.assign(win, rb);
  const doc = fakeDocument({ slides: [fakeElement()] });
  const localStorageStub = storage();
  if (seedTheme) localStorageStub.setItem("theme", seedTheme);
  const prev = {
    window: globalThis.window, document: globalThis.document,
    MutationObserver: globalThis.MutationObserver, Audio: globalThis.Audio,
    localStorage: globalThis.localStorage, location: globalThis.location, history: globalThis.history,
  };
  Object.assign(globalThis, {
    window: win, document: doc, MutationObserver: MutationObserverStub, Audio: AudioStub,
    localStorage: localStorageStub, location: { ...LOCATION }, history: { replaceState() {} },
  });
  try {
    new Function(src)();
    if (after) after({ win, doc });
  } finally {
    Object.assign(globalThis, prev);
  }
  return { win, doc };
}

test("page.js runs with no hook object at all: nothing throws", () => {
  assert.doesNotThrow(() => loadAssembled(assemble("page.js", {})));
});

test("page.js: applyLang is called once with the decided language when a page declares the hook", () => {
  const calls = [];
  loadAssembled(assemble("page.js", {}), { rb: { rbPage: { lang: "de", applyLang: (l) => calls.push(l) } } });
  assert.deepEqual(calls, ["de"]);
});

test("page.js: the language is carried onto a family link under the family key", () => {
  // carryLang reads `location` and builds a URL as a bare global at call time, exactly as
  // themeStored() reads `localStorage` — see loadAssembled's own comment on `after`.
  let anchor;
  loadAssembled(assemble("page.js", {}), {
    rb: { rbPage: { lang: "de", applyLang() {} } },
    after: ({ doc }) => {
      const handlers = doc._listeners.mousedown || [];
      assert.ok(handlers.length > 0, "no mousedown handler was registered");
      anchor = { href: "https://companygraph.io/" };
      for (const fn of handlers) fn({ target: { closest: () => anchor } });
    },
  });
  assert.match(anchor.href, /[?&]lang=de(&|$)/);
});

test("page.js: carryLang follows a language switched after load, not the one captured when the file ran", () => {
  // The bug measured on blust.ch's /ideas/: assemble() wraps every part in one IIFE, so
  // page.js's own `var lang` is a private copy read once from window.rbPage.lang when the
  // file first runs. A page's own toggle — the real mechanism a visitor's click drives — sets
  // document.documentElement.lang directly; that is the whole point of the hook contract. A
  // carryLang that still reads the private copy never sees that switch, so a link to a sibling
  // site keeps carrying the language the page arrived with forever after. The fix reads
  // document.documentElement.lang at click time instead, which is what every page's own
  // applyLang sets, so this must see "de" here even though the file was loaded with "en".
  let anchor;
  loadAssembled(assemble("page.js", {}), {
    rb: { rbPage: { lang: "en", applyLang() {} } },
    after: ({ doc }) => {
      // The visitor's own toggle, after the file has already run and captured "en".
      doc.documentElement.lang = "de";
      const handlers = doc._listeners.mousedown || [];
      assert.ok(handlers.length > 0, "no mousedown handler was registered");
      anchor = { href: "https://companygraph.io/" };
      for (const fn of handlers) fn({ target: { closest: () => anchor } });
    },
  });
  assert.match(anchor.href, /[?&]lang=de(&|$)/,
    `expected the link to carry the language the page now shows (de), got ${anchor.href}`);
});

test("page.js: carryLang falls back to the language it loaded with when the live attribute is neither de nor en", () => {
  // The live document.documentElement.lang is trusted only when it is actually one of the two
  // languages the family carries; anything else (empty, a page that has not run its own
  // applyLang at all, a stray value) falls back to what this file decided at load, exactly as
  // it always has.
  let anchor;
  loadAssembled(assemble("page.js", {}), {
    rb: { rbPage: { lang: "de", applyLang() {} } },
    after: ({ doc }) => {
      doc.documentElement.lang = "";
      const handlers = doc._listeners.mousedown || [];
      anchor = { href: "https://companygraph.io/" };
      for (const fn of handlers) fn({ target: { closest: () => anchor } });
    },
  });
  assert.match(anchor.href, /[?&]lang=de(&|$)/,
    `expected the fallback to the loaded language (de), got ${anchor.href}`);
});

test("page.js: the theme still applies with no hook object at all — a stored theme is carried", () => {
  // theme has no rbPage key at all; this loads with no hook object whatsoever and relies
  // entirely on the document's own data-theme attribute and a visitor's stored choice.
  let anchor;
  loadAssembled(assemble("page.js", {}), {
    seedTheme: "light",
    after: ({ doc }) => {
      const handlers = doc._listeners.mousedown || [];
      assert.ok(handlers.length > 0, "no mousedown handler was registered");
      anchor = { href: "https://companygraph.io/" };
      for (const fn of handlers) fn({ target: { closest: () => anchor } });
    },
  });
  assert.match(anchor.href, /[?&]theme=light(&|$)/);
});

test("deck.js still throws when a deck supplies talk neither way — loud, as designed, never silent", () => {
  // Unlike lang and theme, a deck genuinely cannot render with no title or description at
  // all; blocks/deck-runtime.js's own header says so, and opensFromFile relies on exactly
  // this throw to fail a deck that forgot TALK. The hook only changes what throws
  // (TypeError reading TALK.de, not ReferenceError on a bare TALK) and how the check for
  // its absence is made (typeof, so the check itself is what never throws) — not whether a
  // page supplying neither still fails loudly.
  assert.throws(() => loadAssembled(assemble("deck.js", { lockup: "one" })), /Cannot read propert/);
});

test("deck runtime: falls back to a scope TALK when no rbDeck hook is declared, at the block level", () => {
  // assemble() wraps every js file's parts in one IIFE, so inside the assembled deck.js a
  // `var TALK` always shadows anything of the same name declared outside it — there is no
  // scope left for the file itself to fall back to, and there should not be: a deck that
  // has adopted the hook has no reason to also declare a bare TALK beside it. The fallback
  // exists for the fenced form, which carries no such wrapper, so it is exercised here
  // directly on the raw block instead of through assemble()'s own IIFE.
  const talk = { de: { title: "T-de", desc: "D-de" }, en: { title: "T-en", desc: "D-en" } };
  function MutationObserverStub() { this.observe = function () {}; }
  const sandbox = {
    console, URL,
    localStorage: storage(),
    location: { ...LOCATION }, history: { replaceState() {} },
    window: { addEventListener() {}, MutationObserver: MutationObserverStub },
    MutationObserver: MutationObserverStub,
    Audio: function () { this.preload = ""; this.addEventListener = function () {}; this.pause = function () {}; },
    document: fakeDocument({ slides: [fakeElement()] }),
    TALK: talk,
  };
  vm.createContext(sandbox);
  vm.runInContext(blockFor("deck runtime", null), sandbox);
  assert.equal(sandbox.UI.en.title, "T-en");
});

test("deck.js reads window.rbDeck.talk rather than a bare TALK", () => {
  const talk = { de: { title: "T-de", desc: "D-de" }, en: { title: "T-en", desc: "D-en" } };
  const { doc } = loadAssembled(assemble("deck.js", { lockup: "one" }), { rb: { rbDeck: { talk } } });
  // applyLang() runs once at setup and writes document.title from UI[lang].title, which is
  // built from TALK — so a correct title is proof the hook's talk was actually read, not
  // just that nothing threw.
  assert.equal(doc.title, "T-en");
});

test("deck.js: window.rbDeck.ui overrides the computed UI when a page supplies one", () => {
  const talk = { de: { title: "T-de", desc: "D-de" }, en: { title: "T-en", desc: "D-en" } };
  const ui = { de: { title: "override-de" }, en: { title: "override-en" } };
  const { doc } = loadAssembled(assemble("deck.js", { lockup: "one" }), { rb: { rbDeck: { talk, ui } } });
  assert.equal(doc.title, "override-en");
});

test("the assembled deck.js carries the language block exactly once", () => {
  const deck = assemble("deck.js", { lockup: "one" });
  const keyLines = deck.match(/var LANG_KEY = "lang";/g) || [];
  assert.equal(keyLines.length, 1, `expected exactly one LANG_KEY assignment, found ${keyLines.length}`);
});
