// A model page as the sites write one, cut to what the stage needs: the stage's markup from
// blust.ch's model page, a header and a footer that an embedded page must hide, the head block
// that sets the embed flag, and the stage's scripts. Served by the embed and graph tests.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TERMINAL } from "./terminal.mjs";

const PKG = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
export const asset = (f) => fs.readFileSync(path.join(PKG, "assets", f));
export const STAGE_MODEL = fs.readFileSync(path.join(PKG, "test", "fixtures", "stage-model.json"));
const BOOT = fs.readFileSync(path.join(PKG, "blocks", "theme-boot.js"), "utf8");
const TOKENS = `:root{--ground:#0C0E13;--raise:#171A21;--rule:#232833;--ink:#EFEDE8;--dim:#8A8B86;--c-weak:#3E5878;--c-mid:#7FA3D8;--c-firm:#B8D0FF;--press:#1b2231;--deck-drop:rgba(0,0,0,.5)}
:root[data-theme="light"]{--ground:#FAF9F5;--raise:#F2F0EA;--rule:#DFDCD3;--ink:#16181D;--dim:#5F6058;--c-mid:#3A6DA6;--press:#E7ECF4}
body{background:var(--ground);color:var(--ink);margin:0}`;

export function modelPage({ chat = false, extra = "" } = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script>${BOOT}</script>
<style>${TOKENS} ${TERMINAL}</style>
<link rel="stylesheet" href="/stage.css">${chat ? '<link rel="stylesheet" href="/chat.css">' : ""}
<link rel="preload" as="fetch" href="/model.json" data-stage crossorigin></head>
<body><header id="siteheader"><p>Header</p></header>
<main>
  <section class="figure-section">
    <div class="stagehead" id="stagehead">
      <p class="path mono" id="path"></p>
      <button type="button" class="expand" id="expand">Expand</button>
    </div>
    <div class="stage" id="stage">
      <div class="canvas">
        <svg id="fig" role="group" aria-label="The model"></svg>
        <button class="recenter" id="recenter" type="button">recenter</button>
      </div>
      <button class="gutter" id="gutter" type="button" aria-label="Resize the details panel"></button>
      <aside class="card" id="card" aria-live="polite">
        <div class="cbody" id="cbody"></div>
        <div class="cfoot" id="cfoot"><span id="cfootlink"></span></div>
      </aside>
    </div>
    <dialog id="stagemodal" class="modal" aria-label="The model, expanded">
      <button type="button" class="close" id="modalclose" aria-label="Close">×</button>
    </dialog>
  </section>
  <section><p>More of the page.</p>${extra}</section>
</main>
<footer id="sitefooter"><p class="derived">Generated from <a id="srclink" data-src="model" href="#">the model</a> at <span id="srccommit"></span></p></footer>
<script>window.rbPage = { applyLang: function(l){ document.documentElement.setAttribute("data-applied", l); } };</script>
<script src="/d3.v7.min.js"></script><script src="/card.js"></script><script src="/stage.js"></script>
${chat ? '<script src="/chat.js" data-chat="/chat" data-model="/model/" defer></script>' : ""}
</body></html>`;
}

// The files a model page loads, by address.
export function stageFiles() {
  return {
    "/model.json": ["application/json", STAGE_MODEL],
    "/stage.css": ["text/css", asset("stage.css")], "/stage.js": ["text/javascript", asset("stage.js")],
    "/card.js": ["text/javascript", asset("card.js")], "/d3.v7.min.js": ["text/javascript", asset("d3.v7.min.js")],
    "/chat.js": ["text/javascript", asset("chat.js")], "/chat.css": ["text/css", asset("chat.css")],
  };
}
