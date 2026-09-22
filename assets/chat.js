// The chat: a button at the foot of a prose page and the panel it opens over the site's chat
// service. Synced whole, like card.js, and it knows no page: the endpoint and the model page
// come off its own tag, the language off <html lang> at every render, the colors off the tokens.
//
//   <script src="chat.js" data-chat="https://chat.example/chat" data-model="/model/" defer>
//
// Nothing loads and nothing is sent until a visitor opens the panel and presses send. The
// conversation lives in this closure and in the tab's own `sessionStorage`, under the key
// `chat`, so that following a link does not throw it away; it goes when the tab goes, and it
// reaches no server but the one the tag names. The answer
// arrives as server-sent events and is rendered as it comes, through a Markdown subset the
// model is told to write and nothing outside it — paragraphs, emphasis, code spans, lists,
// tables, with a bare URL made clickable — after every character has been escaped, so text that
// looks like markup stays text.
// Every sentence the widget writes is here, in both languages, so a refusal costs no tokens.
//
//   rbChat.md(text)                    the subset, rendered
//   rbChat.readEvents(response, fn)    the stream, one fn(name, data) per event
//   rbChat.strings(lang)               the sentences
//   rbChat.link(model, id)             where a cite points
//   rbChat.nameLinks(root, names, …)   the model's names, linked in a rendered answer
//   rbChat.refocus(window)             whether the cursor goes back after an answer
//
// On a desk the panel is sized by its top left corner and the size is kept in the tab beside
// the conversation, under `chat-size`; on a phone it is the whole screen and has no corner.
(function(){
  var LIMIT = 1000, TURNS = 20, TIMEOUT = 90000;

  var STRINGS = {
    en: {
      open: "Ask the model", close: "Close", send: "Send", title: "Ask the model", size: "Resize the chat",
      placeholder: "Ask about the model…", waiting: "Asking…",
      notice: "Your message and the conversation so far go to {host}, which asks the model and Claude through Anthropic's API. Nothing is sent until you press send. The conversation stays in this tab, so it is still here on the next page, and closing the tab ends it.",
      privacy: "Privacy", privacyHref: "/privacy/", from: "From the model",
      cut: "… the answer stopped at its length limit.",
      full: "This conversation has reached twenty messages.", fresh: "New conversation",
      refusal: {
        too_long: "That message is over 1,000 characters.",
        too_much: "The conversation has grown too long to send; start a new one.",
        busy: "Too many messages for the moment; try again in a minute.",
        over_day: "Today's share of answers is spent; there is more tomorrow.",
        over_month: "This month's share of answers is spent.",
        closed: "The chat is switched off for now.",
        host_down: "The model's host did not answer; try again shortly.",
        foreign: "This page may not use the chat.",
        bad_request: "That could not be sent as a message.",
        internal: "Something went wrong on the way; try again.",
        network: "The chat could not be reached; check the connection and try again."
      }
    },
    // German: drafts for the translator of conventions/TRANSLATOR.md, to be made from the
    // reviewed English.
    de: {
      open: "Das Modell fragen", close: "Schliessen", send: "Senden", title: "Das Modell fragen", size: "Grösse des Chats ändern",
      placeholder: "Fragen Sie das Modell…", waiting: "Wird gefragt…",
      notice: "Ihre Nachricht und der bisherige Verlauf gehen an {host}, das das Modell und Claude über Anthropics API fragt. Gesendet wird erst, wenn Sie auf Senden drücken. Das Gespräch bleibt in diesem Tab, ist also auf der nächsten Seite noch da, und endet, wenn Sie den Tab schliessen.",
      privacy: "Datenschutz", privacyHref: "/privacy/", from: "Aus dem Modell",
      cut: "… die Antwort endete an ihrer Längengrenze.",
      full: "Dieses Gespräch hat zwanzig Nachrichten erreicht.", fresh: "Neues Gespräch",
      refusal: {
        too_long: "Diese Nachricht ist länger als 1’000 Zeichen.",
        too_much: "Das Gespräch ist zu lang geworden, um es zu senden; beginnen Sie ein neues.",
        busy: "Im Moment zu viele Nachrichten; versuchen Sie es in einer Minute wieder.",
        over_day: "Der heutige Anteil an Antworten ist aufgebraucht; morgen gibt es mehr.",
        over_month: "Der Anteil dieses Monats an Antworten ist aufgebraucht.",
        closed: "Der Chat ist zurzeit abgeschaltet.",
        host_down: "Der Host des Modells hat nicht geantwortet; versuchen Sie es gleich wieder.",
        foreign: "Diese Seite darf den Chat nicht nutzen.",
        bad_request: "Das konnte nicht als Nachricht gesendet werden.",
        internal: "Unterwegs ist etwas schiefgegangen; versuchen Sie es noch einmal.",
        network: "Der Chat war nicht erreichbar; prüfen Sie die Verbindung und versuchen Sie es wieder."
      }
    }
  };
  function strings(lang){ return STRINGS[lang] || STRINGS.en; }
  function langNow(){ return document.documentElement && document.documentElement.lang === "de" ? "de" : "en"; }
  // A code the table does not carry — or one that only exists on Object.prototype, `toString`
  // and the like, walked by a bare `[code]` lookup — falls back to `internal` rather than
  // printing whatever the prototype chain hands back.
  function sentence(code){
    var r = strings(langNow()).refusal;
    return Object.prototype.hasOwnProperty.call(r, code) ? r[code] : r.internal;
  }

  // ─── The subset ───────────────────────────────────────────────────────────────────────────
  function esc(s){ return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  // Inline marks on escaped text: code first, so nothing inside a span is read as emphasis;
  // bold before italic, so ** is not two stars. Bold's own content excludes `*` outright, so a
  // single star never nests inside it — the price of reading `**` as one token rather than two.
  // A lone star or a lone underscore stays what it is, and an underscore inside a word (a
  // variable name, `snake_case`) is a letter, not a mark: `_` only opens and closes at a
  // boundary no word character sits against.
  // A URL in an answer is a place the visitor wants to go, and one they would otherwise have to
  // select and copy, so a bare http or https address becomes a link. Bare is the only form the
  // model may write — the subset has no link syntax — which is what keeps the text and the
  // target the same string: a reader sees where a link goes before following it, and nothing
  // can point one word at another address. Trailing punctuation belongs to the sentence, not to
  // the address, and a link stays in this tab, as every link of this family does.
  var URL_RE = /https?:\/\/[^\s<>"']+/g;
  function links(s){
    return s.replace(URL_RE, function(u){
      var tail = "";
      var cut = /[.,;:!?)\]]+$/.exec(u);
      if (cut) { tail = cut[0]; u = u.slice(0, -tail.length); }
      return '<a href="' + u + '">' + u + "</a>" + tail;
    });
  }

  // The names a tool answered with, linked where the answer writes them. The model is told to
  // name the entity a claim rests on, so an answer reads "Skills drawn on: Integration
  // architecture, Solution architecture, …" and every one of those is an entity the visitor may
  // want to open. The server sends what it showed the model, so nothing here guesses: a name is
  // linked only if it arrived, and it is matched whole, longest first, so that "Data
  // engineering" wins over a shorter name inside it. The walk is over text nodes of the rendered
  // answer, so a name inside a link, a code span or an attribute is left alone.
  function nameLinks(root, names, model, doc){
    if (!names.length) return;
    var byLength = names.slice().sort(function(a, b){ return b.title.length - a.title.length; });
    var nodes = [], walk = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */, null);
    for (var n = walk.nextNode(); n; n = walk.nextNode()) if (!n.parentNode.closest("a, code")) nodes.push(n);
    nodes.forEach(function(node){
      var text = node.nodeValue, out = null, at = 0, piece = doc.createDocumentFragment();
      while (at < text.length) {
        var hit = null, where = -1;
        for (var i = 0; i < byLength.length; i++) {
          var idx = text.indexOf(byLength[i].title, at);
          // A name is a word, not a string inside one: what sits on either side has to be
          // something other than a letter or a digit.
          while (idx >= 0 && !edged(text, idx, byLength[i].title.length)) idx = text.indexOf(byLength[i].title, idx + 1);
          if (idx >= 0 && (where < 0 || idx < where)) { where = idx; hit = byLength[i]; }
        }
        if (!hit) break;
        out = true;
        piece.appendChild(doc.createTextNode(text.slice(at, where)));
        var a = doc.createElement("a"); a.href = link(model, hit.id); a.textContent = hit.title;
        piece.appendChild(a);
        at = where + hit.title.length;
      }
      if (!out) return;
      piece.appendChild(doc.createTextNode(text.slice(at)));
      node.parentNode.replaceChild(piece, node);
    });
  }
  function edged(text, at, len){
    var before = at > 0 ? text.charAt(at - 1) : " ", after = at + len < text.length ? text.charAt(at + len) : " ";
    return !/[0-9A-Za-z]/.test(before) && !/[0-9A-Za-z]/.test(after);
  }

  function inline(s){
    var out = "", i = 0, m;
    var re = /`([^`]+)`|\*\*(\S(?:[^*]*?\S)?)\*\*|\*(\S(?:[^*]*?\S)?)\*|(?<!\w)_(\S(?:[^_]*?\S)?)_(?!\w)/g;
    while ((m = re.exec(s))) {
      out += links(s.slice(i, m.index));
      // A URL inside a code span is being shown, not offered: it stays as it is.
      if (m[1] !== undefined) out += "<code>" + m[1] + "</code>";
      else if (m[2] !== undefined) out += "<strong>" + inline(m[2]) + "</strong>";
      else out += "<em>" + inline(m[3] !== undefined ? m[3] : m[4]) + "</em>";
      i = m.index + m[0].length;
    }
    return out + links(s.slice(i));
  }
  var ROW = /^\s*\|(.+)\|\s*$/, DELIM = /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/, BULLET = /^\s*[-*]\s+(.*)$/, NUMBER = /^\s*\d+\.\s+(.*)$/;
  function cells(line){ return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(function(c){ return inline(c.trim()); }); }
  // Blocks, line by line: a table needs its delimiter row before it is a table, so one still
  // arriving is a paragraph until its second line lands; a list is consecutive items; the rest
  // is paragraphs split at blank lines.
  function md(text){
    if (!text) return "";
    var lines = esc(text).split(/\r?\n/), out = "", i = 0, n = lines.length;
    while (i < n) {
      var line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (ROW.test(line) && i + 1 < n && DELIM.test(lines[i + 1])) {
        var head = cells(line); i += 2; var rows = [];
        while (i < n && ROW.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        out += "<table><thead><tr>" + head.map(function(c){ return "<th>" + c + "</th>"; }).join("") + "</tr></thead><tbody>"
          + rows.map(function(r){ return "<tr>" + r.map(function(c){ return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
        continue;
      }
      if (BULLET.test(line) || NUMBER.test(line)) {
        var ordered = NUMBER.test(line), items = [], re = ordered ? NUMBER : BULLET, m;
        while (i < n && (m = re.exec(lines[i]))) { items.push("<li>" + inline(m[1].trim()) + "</li>"); i++; }
        out += (ordered ? "<ol>" : "<ul>") + items.join("") + (ordered ? "</ol>" : "</ul>");
        continue;
      }
      var para = [];
      while (i < n && lines[i].trim() && !(ROW.test(lines[i]) && i + 1 < n && DELIM.test(lines[i + 1])) && !BULLET.test(lines[i]) && !NUMBER.test(lines[i])) { para.push(lines[i].trim()); i++; }
      out += "<p>" + inline(para.join(" ")) + "</p>";
    }
    return out;
  }

  // ─── The stream ───────────────────────────────────────────────────────────────────────────
  // Server-sent events off a fetch body: an event is an `event:` line, a `data:` line of JSON
  // and a blank line, and a chunk may end anywhere, so the buffer keeps the tail. The buffer is
  // normalized to `\n` after every append, not per chunk, so a CRLF split across two chunks —
  // a trailing `\r` in one, the `\n` in the next — still collapses to one line ending.
  function readEvents(response, onEvent){
    var reader = response.body.getReader(), dec = new TextDecoder(), buf = "";
    function emit(block){
      var name = null, data = "";
      block.split("\n").forEach(function(l){
        if (l.indexOf("event:") === 0) name = l.slice(6).trim();
        else if (l.indexOf("data:") === 0) data += l.slice(5).trim();
      });
      if (name) { var parsed; try { parsed = JSON.parse(data); } catch (e) { parsed = { raw: data }; } onEvent(name, parsed); }
    }
    return reader.read().then(function step(r){
      if (r.done) { if (buf.trim()) emit(buf); return; }
      buf += dec.decode(r.value, { stream: true });
      buf = buf.replace(/\r\n/g, "\n");
      var at;
      while ((at = buf.indexOf("\n\n")) >= 0) { emit(buf.slice(0, at)); buf = buf.slice(at + 2); }
      return reader.read().then(step);
    });
  }

  // Where a cite points: the model page with the entity's id as the hash, asking for the stage
  // expanded. An id is `type/slug`, and the stage writes its own hashes with that slash as it
  // is and reads them the same way; encoded, the slash is a hash the page does not hold, and
  // the page drops it and shows the root. So nothing here is encoded. `?stage=expanded` is the
  // request the stage already answers, the one blust.ch's timeline makes for a skill: a reader
  // following a cite came for that entity's card, not for the graph around it, and the page
  // takes the parameter back out of the address once it has read it.
  function link(model, id){
    var base = model, cut = base.indexOf("#");
    if (cut >= 0) base = base.slice(0, cut);
    return base + (base.indexOf("?") >= 0 ? "&" : "?") + "stage=expanded#" + id;
  }

  // Whether the cursor goes back to the input after an answer or a refusal. On a touch screen
  // focusing the input opens the keyboard over the answer the visitor is about to read, a
  // change nobody asked for, so the cursor goes back only where there is a fine pointer, a mouse
  // or a trackpad, and no keyboard to open. A screen reader hears the answer either way: the
  // finished answer is a polite live region. Opening the panel and starting a new conversation
  // still focus the input everywhere, because the visitor asked for those.
  function refocus(win){ var mm = win && win.matchMedia; return !mm || mm.call(win, "(pointer: fine)").matches; }

  // Where an open conversation lives while the visitor reads on. A page is a document, so
  // following a link throws the panel and everything in it away, and a visitor who asked a
  // question and clicked the answer's link lost the conversation. `sessionStorage` is the tab:
  // it survives a page and dies with the tab, which is the lifetime the chat already claims.
  // The key is `chat`, the family's, made once by the package as `lang` and `theme` are, and
  // the value is this widget's shape: whether the panel was open, and the turns as they were
  // rendered, each answer with the entities it cited. Every access is wrapped, because a
  // browser with site data blocked throws on the first read and the chat still has to work.
  var STORE_KEY = "chat";
  // How big the panel is, kept beside the conversation and for the same lifetime: a size is a
  // choice about this tab's reading, not a preference to carry to the next visit, and the
  // conversation it frames goes when the tab goes. Its own key, because it outlives any one
  // conversation: a visitor who sizes the panel, empties it and asks again keeps the size.
  var SIZE_KEY = "chat-size";
  var MIN_W = 320, MIN_H = 260, STEP = 24;
  function stored(){
    try { var raw = sessionStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function storedSize(){
    try { var raw = sessionStorage.getItem(SIZE_KEY); var v = raw ? JSON.parse(raw) : null; return v && v.w && v.h ? v : null; }
    catch (e) { return null; }
  }
  function keepSize(w, h){ try { sessionStorage.setItem(SIZE_KEY, JSON.stringify({ w: w, h: h })); } catch (e) {} }

  function keep(){
    try {
      if (!messages.length) { sessionStorage.removeItem(STORE_KEY); return; }
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ open: !!(panel && !panel.hidden), turns: turns }));
    } catch (e) {}
  }

  window.rbChat = { md: md, readEvents: readEvents, strings: strings, link: link, refocus: refocus, nameLinks: nameLinks };

  // ─── The page ─────────────────────────────────────────────────────────────────────────────
  var tag = document.currentScript;
  if (!tag || !tag.dataset || !tag.dataset.chat) return;
  var ENDPOINT = tag.dataset.chat, MODEL = tag.dataset.model || "/model/";
  var HOST = (function(){ try { return new URL(ENDPOINT).host; } catch (e) { return ENDPOINT; } })();

  // `messages` is what the server sees, `turns` the same exchange as the panel shows it: an
  // answer's cites are the widget's to draw and are no part of a message.
  var messages = [], turns = [], busy = false, panel = null, log = null, input = null, sendBtn = null, notice = null, fullNote = null, title = null, closeBtn = null, grip = null;

  function el(tagName, cls, text){ var e = document.createElement(tagName); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  var button = el("button", "rbchat-open");
  button.type = "button";
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" d="M4 5.5h16v10H9l-5 4z"/></svg><span></span>';
  button.addEventListener("click", open);
  document.body.appendChild(button);

  function relabel(){
    var s = strings(langNow());
    button.querySelector("span").textContent = s.open; button.setAttribute("aria-label", s.open);
    if (!panel) return;
    title.textContent = s.title; closeBtn.setAttribute("aria-label", s.close); closeBtn.textContent = "×";
    input.placeholder = s.placeholder; sendBtn.textContent = s.send;
    if (grip) grip.setAttribute("aria-label", s.size);
    notice.innerHTML = esc(s.notice).replace("{host}", "<code>" + esc(HOST) + "</code>") + ' <a href="' + esc(s.privacyHref) + '">' + esc(s.privacy) + "</a>";
    fullNote.querySelector("span").textContent = s.full; fullNote.querySelector("button").textContent = s.fresh;
  }
  relabel();
  // The language control swaps <html lang>; every string follows on the next tick.
  if (window.MutationObserver) new MutationObserver(relabel).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  function build(){
    panel = el("section", "rbchat"); panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "false"); panel.setAttribute("aria-labelledby", "rbchat-title"); panel.hidden = true;
    var head = el("header", "rbchat-head");
    title = el("h2"); title.id = "rbchat-title"; closeBtn = el("button", "rbchat-close"); closeBtn.type = "button"; closeBtn.addEventListener("click", close);
    head.appendChild(title); head.appendChild(closeBtn);
    notice = el("p", "rbchat-notice");
    // No aria-live here: the log used to re-announce the growing answer on every token. The
    // finished answer gets its own aria-live, set once in finish(), after it stops changing.
    log = el("div", "rbchat-log");
    fullNote = el("p", "rbchat-full"); fullNote.hidden = true; fullNote.appendChild(el("span")); var fresh = el("button", "rbchat-fresh"); fresh.type = "button"; fresh.addEventListener("click", reset); fullNote.appendChild(fresh);
    var form = el("form", "rbchat-form");
    input = el("textarea"); input.rows = 2; input.maxLength = LIMIT;
    input.addEventListener("keydown", function(e){ if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : send(); } });
    sendBtn = el("button", "rbchat-send"); sendBtn.type = "submit";
    form.appendChild(input); form.appendChild(sendBtn);
    form.addEventListener("submit", function(e){ e.preventDefault(); send(); });
    // The corner that sizes the panel. The panel is pinned to the bottom right, so the top left
    // corner is the one that can move without moving the panel: dragging it out makes the panel
    // bigger. It is a handle like the stage's gutter and behaves like one — drag, arrow keys
    // when focused, double-click back to the default — and it is not there on a phone, where
    // the panel is the whole screen and there is nothing to size.
    grip = el("div", "rbchat-grip"); grip.tabIndex = 0; grip.setAttribute("role", "separator"); grip.setAttribute("aria-orientation", "vertical");
    panel.appendChild(grip);
    panel.appendChild(head); panel.appendChild(notice); panel.appendChild(log); panel.appendChild(fullNote); panel.appendChild(form);
    document.body.appendChild(panel);
    document.addEventListener("keydown", function(e){ if (e.key === "Escape" && !panel.hidden) close(); });
    sizing();
    applyStoredSize();
    relabel();
  }
  // What the panel may be: never smaller than a readable column, never wider or taller than the
  // window it sits in, whatever a visitor dragged on a bigger screen or a window resized since.
  function sizeLimit(){
    return { w: Math.max(MIN_W, window.innerWidth - 32), h: Math.max(MIN_H, window.innerHeight - 32) };
  }
  function setSize(w, h, remember){
    var lim = sizeLimit();
    var W = Math.round(Math.min(lim.w, Math.max(MIN_W, w))), H = Math.round(Math.min(lim.h, Math.max(MIN_H, h)));
    panel.style.width = W + "px"; panel.style.height = H + "px";
    if (remember) keepSize(W, H);
    return { w: W, h: H };
  }
  // The default is the stylesheet's, which is where a size that has never been dragged belongs.
  function unsize(){ panel.style.width = ""; panel.style.height = ""; }
  function panelBox(){ var r = panel.getBoundingClientRect(); return { w: r.width, h: r.height }; }
  function applyStoredSize(){
    var was = storedSize();
    if (was) setSize(was.w, was.h, false);
  }
  function sizing(){
    var from = null;
    grip.addEventListener("pointerdown", function(ev){
      from = { x: ev.clientX, y: ev.clientY, box: panelBox() };
      grip.setPointerCapture(ev.pointerId); grip.classList.add("dragging"); ev.preventDefault();
    });
    grip.addEventListener("pointermove", function(ev){
      if (!from) return;
      // The panel grows towards the top left, so moving the corner left and up makes it bigger.
      setSize(from.box.w - (ev.clientX - from.x), from.box.h - (ev.clientY - from.y), false);
    });
    function end(){ if (!from) return; from = null; grip.classList.remove("dragging"); var b = panelBox(); setSize(b.w, b.h, true); }
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
    // Double-click gives the stylesheet's size back and forgets the stored one, as the stage's
    // gutter does: otherwise the only way back is to drag until it looks right again.
    grip.addEventListener("dblclick", function(){
      try { sessionStorage.removeItem(SIZE_KEY); } catch (e) {}
      unsize();
    });
    grip.addEventListener("keydown", function(ev){
      var b = panelBox(), dw = 0, dh = 0;
      if (ev.key === "ArrowLeft") dw = STEP; else if (ev.key === "ArrowRight") dw = -STEP;
      else if (ev.key === "ArrowUp") dh = STEP; else if (ev.key === "ArrowDown") dh = -STEP;
      else return;
      ev.preventDefault(); setSize(b.w + dw, b.h + dh, true);
    });
    // A window made smaller than the panel leaves it hanging off the screen, so the clamp runs
    // again on resize, and a panel that was never sized stays the stylesheet's.
    window.addEventListener("resize", function(){ if (panel.style.width) { var b = panelBox(); setSize(b.w, b.h, false); } });
  }

  function open(){ if (!panel) build(); panel.hidden = false; button.hidden = true; input.focus(); keep(); }
  function close(){ panel.hidden = true; button.hidden = false; button.focus(); keep(); }
  function reset(){ messages = []; turns = []; log.innerHTML = ""; fullNote.hidden = true; busy = false; input.disabled = false; sendBtn.disabled = false; input.focus(); keep(); }

  // The cites under an answer, drawn the same way whether the answer just arrived or is being
  // read back from the tab.
  function citeLine(cites){
    var c = el("p", "rbchat-cites"); c.appendChild(el("span", null, strings(langNow()).from + ": "));
    cites.forEach(function(x, i){ var a = el("a", null, x.title || x.id); a.href = link(MODEL, x.id); c.appendChild(a); if (i < cites.length - 1) c.appendChild(document.createTextNode(", ")); });
    return c;
  }

  function bubble(role){ var b = el("div", "rbchat-msg rbchat-" + role); log.appendChild(b); log.scrollTop = log.scrollHeight; return b; }
  // A refusal always leaves the visitor able to try again: the sentence is on the table's own
  // keys, never a bare lookup, and focus goes back to the box once the panel is still open —
  // every call site re-enables the form before calling this, so the box is never focused
  // while disabled.
  function refuse(code){ bubble("refusal").textContent = sentence(code); if (panel && !panel.hidden && refocus(window)) input.focus(); }

  function send(){
    if (busy) return;
    var text = input.value.trim();
    if (!text) return;
    if (text.length > LIMIT) { refuse("too_long"); return; }
    var s = strings(langNow());
    messages.push({ role: "user", content: text });
    turns.push({ role: "user", content: text });
    bubble("user").textContent = text;
    input.value = ""; busy = true; input.disabled = true; sendBtn.disabled = true;
    var ans = bubble("assistant"), body = el("div", "rbchat-body"), wait = el("p", "rbchat-wait", s.waiting);
    // Streaming, from the moment the request goes out until finish() has the whole answer.
    ans.setAttribute("aria-busy", "true");
    ans.appendChild(wait); ans.appendChild(body);
    var acc = "", cites = [], names = [], cut = false;
    function render(){ body.innerHTML = md(acc); log.scrollTop = log.scrollHeight; }
    // A stream that never ends — a dropped connection the browser does not notice — would
    // otherwise lock the panel forever: nothing else re-enables the form. Ninety seconds after
    // the request goes out, the controller aborts it, and the abort reaches the existing
    // .catch below exactly as a network failure does.
    var ac = new AbortController();
    var timer = setTimeout(function(){ ac.abort(); }, TIMEOUT);
    function finish(){
      clearTimeout(timer);
      if (wait.parentNode) wait.parentNode.removeChild(wait);
      // An answer with no text is not a turn: pushing an empty assistant message would break
      // the server's alternating-turns rule on the visitor's next message, so this is a
      // refusal instead, and the exchange leaves no trace in the conversation. Whitespace
      // alone is no text either; rendered, it is an empty bubble.
      if (!acc.trim()) {
        if (ans.parentNode) ans.parentNode.removeChild(ans);
        messages.pop(); turns.pop(); keep();
        busy = false; input.disabled = false; sendBtn.disabled = false;
        refuse("internal");
        return;
      }
      if (cut) acc += "\n\n" + strings(langNow()).cut;
      ans.removeAttribute("aria-busy");
      ans.setAttribute("aria-live", "polite");
      render();
      // Once, on the finished answer: the names are linked in the text the visitor reads, not
      // in the Markdown, so nothing about the answer itself changes and the next render — a
      // language switch, a redraw — would simply do it again.
      nameLinks(body, names, MODEL, document);
      if (cites.length) ans.appendChild(citeLine(cites));
      messages.push({ role: "assistant", content: acc });
      turns.push({ role: "assistant", content: acc, cites: cites, names: names });
      keep();
      busy = false;
      if (messages.length >= TURNS) { fullNote.hidden = false; input.disabled = true; sendBtn.disabled = true; }
      else { input.disabled = false; sendBtn.disabled = false; if (refocus(window)) input.focus(); }
    }
    fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json", "X-Chat": "1" }, signal: ac.signal, body: JSON.stringify({ messages: messages, lang: langNow() }) })
      .then(function(r){
        if (r.status !== 200) {
          return r.json().then(function(j){ return (j && j.error && j.error.code) || "internal"; }, function(){ return r.status === 413 ? "too_much" : "internal"; })
            .then(function(code){
              clearTimeout(timer);
              if (ans.parentNode) ans.parentNode.removeChild(ans);
              messages.pop(); turns.pop(); keep();
              busy = false; input.disabled = false; sendBtn.disabled = false;
              refuse(code);
            });
        }
        return readEvents(r, function(name, data){
          if (name === "text") { if (wait.parentNode) wait.parentNode.removeChild(wait); acc += data.text || ""; render(); }
          else if (name === "cite") cites.push(data);
          else if (name === "names") (data && data.names || []).forEach(function(n){ if (n && n.id && n.title) names.push(n); });
          else if (name === "done") cut = !!data.cut;
          else if (name === "error") {
            var code = data && data.error && data.error.code;
            if (!acc.trim()) {
              clearTimeout(timer);
              if (ans.parentNode) ans.parentNode.removeChild(ans);
              messages.pop(); turns.pop(); keep();
              busy = false; input.disabled = false; sendBtn.disabled = false;
              refuse(code || "internal");
              return;
            }
            acc += "\n\n" + sentence(code);
          }
        }).then(function(){ if (busy) finish(); });
      })
      .catch(function(){
        clearTimeout(timer);
        if (ans.parentNode) ans.parentNode.removeChild(ans);
        if (messages[messages.length - 1] && messages[messages.length - 1].role === "user") { messages.pop(); turns.pop(); keep(); }
        busy = false; input.disabled = false; sendBtn.disabled = false;
        refuse("network");
      });
  }

  // What the tab kept, drawn again. A conversation is read back whether or not the panel was
  // open, so the visitor who closed it and followed a link finds it where they left it; only a
  // panel that was open is shown. Nothing is sent by a restore: the turns are what the page
  // already showed, and the next message carries them to the server as any message does.
  (function restore(){
    var was = stored();
    if (!was || !was.turns || !was.turns.length) return;
    if (!panel) build();
    was.turns.forEach(function(t){
      if (t.role === "user") { bubble("user").textContent = t.content; messages.push({ role: "user", content: t.content }); turns.push({ role: "user", content: t.content }); return; }
      var ans = bubble("assistant"), body = el("div", "rbchat-body");
      body.innerHTML = md(t.content); ans.appendChild(body);
      nameLinks(body, t.names || [], MODEL, document);
      var cites = t.cites || [];
      if (cites.length) ans.appendChild(citeLine(cites));
      messages.push({ role: "assistant", content: t.content });
      turns.push({ role: "assistant", content: t.content, cites: cites, names: t.names || [] });
    });
    // A conversation read back at its length is as full as one that reached it here.
    if (messages.length >= TURNS) { fullNote.hidden = false; input.disabled = true; sendBtn.disabled = true; }
    if (was.open) { panel.hidden = false; button.hidden = true; }
    log.scrollTop = log.scrollHeight;
  })();
})();
