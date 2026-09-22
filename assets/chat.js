// The chat: a button at the foot of a prose page and the panel it opens over the site's chat
// service. Synced whole, like card.js, and it knows no page: the endpoint and the model page
// come off its own tag, the language off <html lang> at every render, the colors off the tokens.
//
//   <script src="chat.js" data-chat="https://chat.example/chat" data-model="/model/" defer>
//
// Nothing loads and nothing is sent until a visitor opens the panel and presses send, and
// nothing is stored: the conversation lives in this closure and goes with the page. The answer
// arrives as server-sent events and is rendered as it comes, through a Markdown subset the
// model is told to write and nothing outside it — paragraphs, emphasis, code spans, lists,
// tables — after every character has been escaped, so text that looks like markup stays text.
// Every sentence the widget writes is here, in both languages, so a refusal costs no tokens.
//
//   rbChat.md(text)                    the subset, rendered
//   rbChat.readEvents(response, fn)    the stream, one fn(name, data) per event
//   rbChat.strings(lang)               the sentences
//   rbChat.link(model, id)             where a cite points
(function(){
  var LIMIT = 1000, TURNS = 20, TIMEOUT = 90000;

  var STRINGS = {
    en: {
      open: "Ask the model", close: "Close", send: "Send", title: "Ask the model",
      placeholder: "Ask about the model…", waiting: "Asking…",
      notice: "Your message and the conversation so far go to {host}, which asks the model and Claude through Anthropic's API. Nothing is sent until you press send, and nothing is kept.",
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
      open: "Das Modell fragen", close: "Schliessen", send: "Senden", title: "Das Modell fragen",
      placeholder: "Fragen Sie das Modell…", waiting: "Wird gefragt…",
      notice: "Ihre Nachricht und der bisherige Verlauf gehen an {host}, das das Modell und Claude über Anthropics API fragt. Gesendet wird erst, wenn Sie auf Senden drücken, und gespeichert wird nichts.",
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
  function inline(s){
    var out = "", i = 0, m;
    var re = /`([^`]+)`|\*\*(\S(?:[^*]*?\S)?)\*\*|\*(\S(?:[^*]*?\S)?)\*|(?<!\w)_(\S(?:[^_]*?\S)?)_(?!\w)/g;
    while ((m = re.exec(s))) {
      out += s.slice(i, m.index);
      if (m[1] !== undefined) out += "<code>" + m[1] + "</code>";
      else if (m[2] !== undefined) out += "<strong>" + inline(m[2]) + "</strong>";
      else out += "<em>" + inline(m[3] !== undefined ? m[3] : m[4]) + "</em>";
      i = m.index + m[0].length;
    }
    return out + s.slice(i);
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

  // Where a cite points: the model page with the entity's id as the hash. An id is `type/slug`,
  // and the stage writes its own hashes with that slash as it is and reads them the same way;
  // encoded, the slash is a hash the page does not hold, and the page drops it and shows the
  // root. So nothing here is encoded.
  function link(model, id){ return model + "#" + id; }

  window.rbChat = { md: md, readEvents: readEvents, strings: strings, link: link };

  // ─── The page ─────────────────────────────────────────────────────────────────────────────
  var tag = document.currentScript;
  if (!tag || !tag.dataset || !tag.dataset.chat) return;
  var ENDPOINT = tag.dataset.chat, MODEL = tag.dataset.model || "/model/";
  var HOST = (function(){ try { return new URL(ENDPOINT).host; } catch (e) { return ENDPOINT; } })();

  var messages = [], busy = false, panel = null, log = null, input = null, sendBtn = null, notice = null, fullNote = null, title = null, closeBtn = null;

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
    panel.appendChild(head); panel.appendChild(notice); panel.appendChild(log); panel.appendChild(fullNote); panel.appendChild(form);
    document.body.appendChild(panel);
    document.addEventListener("keydown", function(e){ if (e.key === "Escape" && !panel.hidden) close(); });
    relabel();
  }
  function open(){ if (!panel) build(); panel.hidden = false; button.hidden = true; input.focus(); }
  function close(){ panel.hidden = true; button.hidden = false; button.focus(); }
  function reset(){ messages = []; log.innerHTML = ""; fullNote.hidden = true; busy = false; input.disabled = false; sendBtn.disabled = false; input.focus(); }

  function bubble(role){ var b = el("div", "rbchat-msg rbchat-" + role); log.appendChild(b); log.scrollTop = log.scrollHeight; return b; }
  // A refusal always leaves the visitor able to try again: the sentence is on the table's own
  // keys, never a bare lookup, and focus goes back to the box once the panel is still open —
  // every call site re-enables the form before calling this, so the box is never focused
  // while disabled.
  function refuse(code){ bubble("refusal").textContent = sentence(code); if (panel && !panel.hidden) input.focus(); }

  function send(){
    if (busy) return;
    var text = input.value.trim();
    if (!text) return;
    if (text.length > LIMIT) { refuse("too_long"); return; }
    var s = strings(langNow());
    messages.push({ role: "user", content: text });
    bubble("user").textContent = text;
    input.value = ""; busy = true; input.disabled = true; sendBtn.disabled = true;
    var ans = bubble("assistant"), body = el("div", "rbchat-body"), wait = el("p", "rbchat-wait", s.waiting);
    // Streaming, from the moment the request goes out until finish() has the whole answer.
    ans.setAttribute("aria-busy", "true");
    ans.appendChild(wait); ans.appendChild(body);
    var acc = "", cites = [], cut = false;
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
        messages.pop();
        busy = false; input.disabled = false; sendBtn.disabled = false;
        refuse("internal");
        return;
      }
      if (cut) acc += "\n\n" + strings(langNow()).cut;
      ans.removeAttribute("aria-busy");
      ans.setAttribute("aria-live", "polite");
      render();
      if (cites.length) {
        var c = el("p", "rbchat-cites"); c.appendChild(el("span", null, strings(langNow()).from + ": "));
        cites.forEach(function(x, i){ var a = el("a", null, x.title || x.id); a.href = link(MODEL, x.id); c.appendChild(a); if (i < cites.length - 1) c.appendChild(document.createTextNode(", ")); });
        ans.appendChild(c);
      }
      messages.push({ role: "assistant", content: acc });
      busy = false;
      if (messages.length >= TURNS) { fullNote.hidden = false; input.disabled = true; sendBtn.disabled = true; }
      else { input.disabled = false; sendBtn.disabled = false; input.focus(); }
    }
    fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json", "X-Chat": "1" }, signal: ac.signal, body: JSON.stringify({ messages: messages, lang: langNow() }) })
      .then(function(r){
        if (r.status !== 200) {
          return r.json().then(function(j){ return (j && j.error && j.error.code) || "internal"; }, function(){ return r.status === 413 ? "too_much" : "internal"; })
            .then(function(code){
              clearTimeout(timer);
              if (ans.parentNode) ans.parentNode.removeChild(ans);
              messages.pop();
              busy = false; input.disabled = false; sendBtn.disabled = false;
              refuse(code);
            });
        }
        return readEvents(r, function(name, data){
          if (name === "text") { if (wait.parentNode) wait.parentNode.removeChild(wait); acc += data.text || ""; render(); }
          else if (name === "cite") cites.push(data);
          else if (name === "done") cut = !!data.cut;
          else if (name === "error") {
            var code = data && data.error && data.error.code;
            if (!acc.trim()) {
              clearTimeout(timer);
              if (ans.parentNode) ans.parentNode.removeChild(ans);
              messages.pop();
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
        if (messages[messages.length - 1] && messages[messages.length - 1].role === "user") messages.pop();
        busy = false; input.disabled = false; sendBtn.disabled = false;
        refuse("network");
      });
  }
})();
