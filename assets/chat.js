// The chat: a button at the foot of a prose page and the panel it opens over the site's chat
// service. Synced whole, like card.js, and it knows no page: the endpoint and the model page
// come off its own tag, the language off <html lang> at every render, the colors off the tokens.
//
//   <script src="chat.js" data-chat="https://chat.example/chat" data-model="/model/"
//     data-questions="/model.json" data-questions-de="/questions.de.json" defer>
//
// Any element carrying `data-chat-open` opens the panel on click, as the button does, and an
// address carrying `?chat=open` opens it when the page loads, then drops the parameter.
//
// Opening the panel may read the site's own model file, when `data-questions` names one, but
// nothing is sent to the chat host until the visitor presses send. The conversation lives in
// this closure and in the tab's own `sessionStorage`, under the key
// `chat`, so that following a link does not throw it away; it goes when the tab goes, and it
// reaches no server but the one the tag names. The answer
// arrives as server-sent events, is gathered until the stream ends while a spinner counts the
// seconds, and is then drawn whole, through a Markdown subset the
// model is told to write and nothing outside it — paragraphs, emphasis, code spans, lists,
// tables, with a bare URL made clickable — after every character has been escaped, so text that
// looks like markup stays text.
// The panel is drawn as the tooling's terminal: a fresh conversation opens on the page's own
// lockup, a hello and numbered menus, a question prints at a prompt, and the command line takes a
// number, /new, /clear, /help and the up arrow, none of which reaches the chat host.
// Each picture the host drew arrives as its own event; all of them are drawn under the answer by
// Mermaid, in order and fitted to the log when there are several. Mermaid is fetched from beside
// this file the first time a picture arrives; each node links where the cite line would, or a
// type to its schema's file where the host names one, and the picture is kept with its answer
// in the tab like the rest of the turn.
// A page may carry a picture of its own too, written when its site builds: a figure with
// `data-diagram` and the picture as JSON inside it, drawn the same way once it nears the
// screen, whether or not the tag names a chat. Expanded, any picture zooms and pans.
// Every sentence the widget writes is here, in both languages, so a refusal costs no tokens.
//
// Where the tag also names `data-questions-de`, the same read takes the site's reviewed German
// for its question titles, and a German page offers and sends that German, as do the chips under
// an answer the chat host says it wrote in German, whatever the page's language; which questions
// are offered is still chosen by their titles.
//
//   rbChat.md(text)                    the subset, rendered
//   rbChat.readEvents(response, fn)    the stream, one fn(name, data) per event
//   rbChat.strings(lang)               the sentences
//   rbChat.link(model, id)             where a cite points
//   rbChat.nameLinks(root, names, …)   the model's names, linked in a rendered answer
//   rbChat.heard(turns)                every name and cite the conversation's answers brought
//   rbChat.refocus(window)             whether the cursor goes back after an answer
//   rbChat.asked(location.search)      the address without ?chat=open, or null if it has none
//   rbChat.linkQuestion(location.search)  the question ?ask= carries and the address without it, or null
//   rbChat.when(retryAt, now, lang)    when a limit lifts, in the visitor's language and time
//   rbChat.refusalText(code, retryAt, …)  the refusal sentence, ending with that moment where there is one
//   rbChat.citeLine(cites, model, icon, doc)  the line under an answer: the icon, each title, each mark
//   rbChat.iconOf(doc)                 the page's icon, for the head of that line
//   rbChat.pick(list, n, random)       n items of list, uniformly at random and without repeats
//   rbChat.unasked(list, messages)     the titles no visitor message in the conversation has asked
//   rbChat.spread(items, n, random)    the titles offered, one per kind where the model groups them, its first-ranked kind first
//   rbChat.mentioned(content, names, items, messages)  the entities an answer writes, in its order, not yet asked about
//   rbChat.follow(cites, items, messages, lang, random, named)  the three that follow an answer, or null
//   rbChat.answerLang(turns, page)     the language what follows the last answer is offered in
//   rbChat.mermaidConfig(read)         Mermaid's configuration, from the tokens `read` gives
//   rbChat.nodeElement(svg, node)      the group Mermaid drew a node as, or null
//   rbChat.diagramCaption(d, lang)     a picture's caption in the page's language
//   rbChat.oriented(source, width)     a flow turned top to bottom in a panel narrower than a phone's
//   rbChat.lockupOf(doc)               the header's mark and name, split as the page splits it, or null
//   rbChat.command(text)               "new", "help", "login", "logout", "model", "effort" or null, for the command line's own words
//   rbChat.CHAT_MODELS, CHAT_EFFORTS   the models a signed-in reader may pick and the efforts, chat-server's table
//   rbChat.grantedModels(claims, org, prefix)  the model ids the sign-in's roles grant in this org, Sonnet 5 first
//   rbChat.authorizeUrl(site, challenge, state, redirect)  where the sign-in at ZITADEL begins, with PKCE
//   rbChat.returnOf(href)              the { code, state } a sign-in returns to the page with, or null
//   rbChat.lapsed(token, now)          whether the token's exp has passed (now in ms), or it cannot be read
//   rbChat.claimsOf(token)             a JWT's payload, read as UTF-8 JSON, or null
//   rbChat.picked(text, rows)          the row a bare number picks, or the text as typed
//   rbChat.tryPick(facts, random)      what an opening offers after the meta-model, two of what the model holds
//   rbChat.connected(entities, edges)  the systems a landscape row may name
//   rbChat.tryRows(facts, lang, random)  the intro's asks, each with what comes back
//   rbChat.commitOf(cites)             the commit the answer was read at, or null
//   rbChat.seconds(ms)                 the spinner's count
//   rbChat.rangeOf(n)                  the rows a number picks, as the keys line names them
//   rbChat.versionsOf(file)            the model file's core, commit and repository, or null
//   rbChat.graphHref(model, id)        the embedded graph's address
//   rbChat.entityOf(href, model)       the entity a link into the model names, or null
//   rbChat.graphTarget(href, model, here)  the place a link on any page names in the graph, or null
//
// An empty conversation, once the panel is shown, offers three questions as a way in in its
// intro, three of the site's own model's entities of type `question`, picked at random for that
// conversation, and every finished answer offers three more the conversation has not asked
// yet, so a visitor who liked the first answer has somewhere to go next. Where that answer
// writes the titles of entities the visitor has not asked about, two of the three ask to be told
// more about the first two of them. Where it cited entities of one type only, the three follow it
// too: the first cited entity's neighbors, then its type's schema and a question of the model's
// that rests on that entity or its type as far as room is left. `data-questions` names a same-origin path to that model, the file `card.js`
// and `stage.js` already read the same way, asked once and cached for the page's life; a tag
// without it offers none and asks nothing. Nothing here ever reaches the chat host — the one
// runtime call this family's pages make to a service of their own is still the POST on send,
// unmoved by any of this — and a read that 404s, times out, answers something that is not JSON,
// or names no question reads the same as one that named none: no questions, nothing else different.
//
// On a desk the panel is sized by its top left corner and the size is kept in the tab beside
// the conversation, under `chat-size`; on a phone it is the whole screen and has no corner.
//
// A tag that names the site's identity service lets a reader sign in from the command line:
//
//   <script src="chat.js" data-chat="…" data-issuer="https://id.example" data-client="<client id>"
//     data-org="<org id>" data-project="<project id>" data-role-prefix="" defer>
//
// `/login` goes to the hosted login with a PKCE challenge, the verifier, a random `state` and the
// page's path kept in the tab under `chat-pkce`. The login sends the reader back to the site's
// root with a code; wherever the widget then runs, it checks the state, exchanges the code and
// returns to that path. The access token and the ID token are kept in the browser under
// `chat-signin`, every message after carries the access token as `Authorization: Bearer`, and
// `/logout` forgets both and ends the session at the service. A tag without `data-issuer` offers
// none of the four words, `/login`, `/logout`, `/model` and `/effort`, and sends them as it
// sends any question.
//
// Signed in, `/model` offers Sonnet 5 and the models the reader's roles grant on this site, and
// `/effort` the five efforts, each a numbered menu a number picks from; a reader with no role is
// answered at `low` alone, so `/effort` tells them in a line that effort comes with a model
// grant, and a remembered effort goes as `low`. The choice is kept in the
// browser under `chat-choice`, and every message the reader sends carries it as `model` and
// `effort`; a visitor's message carries neither. The host's own address, where the tag names one
// as `data-chat-direct` (an absolute https URL), takes a signed-in message above `low`, whose
// answer may outlast what the site's front door allows; every other message goes to `data-chat`.
(function(){
  // SENT is the tail of the conversation the server reads: its last eight turns, less the
  // assistant turn that would open them, since a conversation ends with the visitor. Sending only
  // that tail gives the model exactly what the whole would give it, so a conversation runs as long
  // as the visitor likes and the request stays far under the server's 64 KB, however long it runs.
  // TIMEOUT is how long a message at `low` may take, LONG one above it, since a high effort
  // thinks for minutes before it writes.
  var LIMIT = 1000, SENT = 7, TIMEOUT = 90000, LONG = 900000;

  var STRINGS = {
    en: {
      open: "Ask the model", close: "Close", title: "Ask the model", size: "Resize the chat",
      placeholder: "Ask about the model…", waiting: "Asking…",
      ai: "An AI answers here, not a person.", notice: "Your message and the conversation so far go to {host}, which asks the model and Claude through Anthropic's API. Nothing is sent until you press send. The conversation stays in this tab, so it is still here on the next page, and closing the tab ends it.",
      privacy: "Privacy", privacyHref: "/privacy/", from: "From the model",
      questions: "Questions to start with", next: "Questions to ask next",
      follow: { schema: "Show me the schema of {title} ({type})", neighbors: "Show me the neighbors of {title}", more: "Tell me more about {title}" },
      cut: "… the answer stopped at its length limit.",
      fresh: "New conversation",
      // The terminal: the intro, the prompt, the spinner, the head of a finished answer, and
      // the keys and commands the command line takes. {name} is the lockup's text, {host} the
      // page's own host.
      hello: ["Hello. I answer from {name}’s model, and link", "every entity I name back to where it is written."],
      helloHost: ["Hello. I answer from the model of {host}, and link", "every entity I name back to where it is written."],
      sub: "chat · {host}", bar: "ask · {host}",
      prompt: "Type a question, a number, or /help",
      asking: "asking the model", answered: "answered", model: "model {sha} · {secs}s",
      claim: { partial: ["Partly backed", "The model's pages say only part of this."], contradicted: ["Contradicted", "The model's pages say otherwise."], absent: ["Not backed", "The model's pages don't say this."], unsourced: ["Not backed", "No page the chat read says this."] },
      claimsOne: "1 statement here isn't fully backed by the model's pages.", claimsMany: "{n} statements here aren't fully backed by the model's pages.",
      keys: { send: "enter send", last: "↑ last question", pick: "{range} pick", help: "/help", chosen: "{model} · {effort}" },
      menu: { model: "Choose a model", effort: "Choose an effort" },
      signInHint: "Sign in with /login to choose a model.",
      effortHint: "The effort can be chosen once your sign-in grants a model.",
      help: [["/new", "start a new conversation (also /clear)"], ["/login", "sign in, to choose a model"], ["/logout", "sign out"], ["/model", "choose the model that answers"], ["/effort", "choose how long it thinks"], ["/help", "this list"], ["{range}", "pick from the menu above"], ["↑", "your last question back into the line"]],
      tryLabel: "Try", askNext: "Ask next",
      versions: "meta-model {core} · model {sha}", versionsModel: "model {sha}",
      graph: { head: "graph · {title}", failed: "The graph could not be drawn here; the model page has it." },
      try: {
        metaModel: "Show me the meta-model", metaModelGets: "a diagram of the types and how they refer to each other",
        process: "Walk me through the {name} process", processGets: "its steps as a flow, the loops back included",
        organization: "Show me the organization", organizationGets: "its units as a chart, with who leads each and who sits in it",
        landscape: "Show me the landscape of {name}", landscapeGets: "what it runs on, what it connects to and the data it keeps",
        usecase: "Show me the use case {name}", usecaseGets: "who it serves, what it includes and what it asks of the product",
        requirements: "Show me the requirements of {name}", requirementsGets: "what it is held to, every requirement a link into the model",
        list: "List {list} as a table", listGets: "one row each, every name a link into the model",
        lists: { kpi: "the KPIs", seat: "the seats", product: "the products", decision: "the decisions", value: "the values" }
      },
      again: { sentence: "You can ask again {when}.", minute: "in a minute", minutes: "in {n} minutes", at: "at {time}", tomorrow: "tomorrow at {time}", day: "on {day} at {time}" },
      github: "{title} on GitHub", commit: "commit {sha}",
      modalClose: "Close \u00b7 Esc",
      ask: { from: "The link you opened asks:", label: "A question from the link you opened", send: "Send", edit: "Edit", discard: "Discard" },
      diagram: { concepts: "Concepts", process: "Process", neighborhood: "Connections", schema: "Meta-model", context: "Context map", aggregate: "Aggregate", flow: "Flow", lifecycle: "Lifecycle", organization: "Organization", system: "Landscape", holds: "Data held", usecase: "Use case", scenario: "Scenario", requirements: "Requirements", reading: { context: "One-way arrows run from upstream to downstream; each arrow names the pattern between the two contexts.", aggregate: "The root holds what the diamonds join; the dashed arrows are the events it emits.", flow: "Solid arrows are commands sent to the aggregate, dashed arrows the events it emits; a box names the condition of each branch.", lifecycle: "Each arrow is a step from one state to the next, labeled with the command that takes it where there is one.", organization: "Solid arrows run from a lead to the leads below; a dashed line joins staff to the head they serve; a dashed box is an open position, beside a lead the search for a successor; agents stand in the shaded frame, and a dotted arrow from a person to an agent says who directs it, where an agent with no arrow is directed by everyone in the frame.", system: "Solid arrows run from the system the data comes from to the one that takes it, labeled with the interface, what is carried and how; a dotted line joins a system to what it runs on; a rounded box is a service the system provides; a cylinder is data it holds, by a heavy arrow where its copy leads, a solid one where it writes and a dotted one where it only reads.", holds: "Each cylinder is data kept of the concept named under it; a heavy arrow marks the system whose copy leads, a solid one a system that writes a copy of its own, a dotted one a system that only reads.", usecase: "The actor stands outside the frame, which is the use case's scope; a dashed arrow runs from a use case to one its steps include, a solid one to a feature it asks something of; a hexagon is a requirement it is held to, with a heavy border where it must and a dashed one where it may.", scenario: "The rounded box is the trigger; each box is a step, in order, with who acts; a dashed box is an extension, the condition first and what happens then.", requirements: "A hexagon is a requirement, with a heavy border where it must and a dashed one where it may, in a frame for its kind; an arrow runs to what it applies to, a dotted one to a rule it follows." }, expand: "Open full screen", shut: "Close full screen", zoomIn: "Zoom in", zoomOut: "Zoom out", fit: "Fit", fitTip: "Fit to the screen", failed: "The diagram could not be drawn; this is its source." },
      refusal: {
        too_long: "That message is over 1,000 characters.",
        too_much: "The conversation has grown too long to send; start a new one.",
        busy: "Too many messages for the moment; try again later.",
        over_day: "Today's share of answers is spent; there is more tomorrow.",
        over_month: "This month's share of answers is spent.",
        closed: "The chat is switched off for now.",
        host_down: "The model's host did not answer; try again shortly.",
        foreign: "This page may not use the chat.",
        bad_request: "That could not be sent as a message.",
        internal: "Something went wrong on the way; try again.",
        network: "The chat could not be reached; check the connection and try again.",
        not_granted: "Your sign-in does not grant that model.",
        signed_out: "You are signed out; sign in again with /login.",
        over_user_month: "Your share of answers this month is spent; sign out with /logout to keep asking as a visitor.",
        declined: "That model declined to answer this message; try rephrasing it."
      }
    },
    // German: drafts for the translator of conventions/TRANSLATOR.md, to be made from the
    // reviewed English.
    de: {
      open: "Das Modell fragen", close: "Schliessen", title: "Das Modell fragen", size: "Grösse des Chats ändern",
      placeholder: "Fragen Sie das Modell…", waiting: "Wird gefragt…",
      ai: "Hier antwortet eine KI, keine Person.", notice: "Ihre Nachricht und der bisherige Verlauf gehen an {host}, das das Modell und Claude über Anthropics API fragt. Gesendet wird erst, wenn Sie auf Senden drücken. Das Gespräch bleibt in diesem Tab, ist also auf der nächsten Seite noch da, und endet, wenn Sie den Tab schliessen.",
      privacy: "Datenschutz", privacyHref: "/privacy/", from: "Aus dem Modell",
      questions: "Fragen für den Einstieg", next: "Weitere Fragen",
      follow: { schema: "Zeig mir das Schema von {title} ({type})", neighbors: "Zeig mir die Nachbarn von {title}", more: "Erzähl mir mehr über {title}" },
      cut: "… die Antwort endete an ihrer Längengrenze.",
      fresh: "Neues Gespräch",
      hello: ["Hallo. Ich antworte aus dem Modell von {name}", "und verlinke jede Entität, die ich nenne."],
      helloHost: ["Hallo. Ich antworte aus dem Modell von {host}", "und verlinke jede Entität, die ich nenne."],
      sub: "Chat · {host}", bar: "fragen · {host}",
      prompt: "Frage, Nummer oder /help tippen",
      asking: "frage das Modell", answered: "beantwortet", model: "Modell {sha} · {secs}s",
      claim: { partial: ["Teilweise belegt", "Die Seiten des Modells sagen das nur zum Teil."], contradicted: ["Widerspricht dem Modell", "Die Seiten des Modells sagen etwas anderes."], absent: ["Nicht belegt", "Die Seiten des Modells sagen das nicht."], unsourced: ["Nicht belegt", "Keine Seite, die der Chat gelesen hat, sagt das."] },
      claimsOne: "Eine Aussage in dieser Antwort ist durch die Seiten des Modells nicht vollständig belegt.", claimsMany: "{n} Aussagen in dieser Antwort sind durch die Seiten des Modells nicht vollständig belegt.",
      keys: { send: "Enter senden", last: "↑ letzte Frage", pick: "{range} wählen", help: "/help", chosen: "{model} · {effort}" },
      menu: { model: "Modell wählen", effort: "Aufwand wählen" },
      signInHint: "Melden Sie sich mit /login an, um ein Modell zu wählen.",
      effortHint: "Den Aufwand können Sie wählen, sobald Ihre Anmeldung ein Modell erlaubt.",
      help: [["/new", "ein neues Gespräch beginnen (auch /clear)"], ["/login", "anmelden, um ein Modell zu wählen"], ["/logout", "abmelden"], ["/model", "das antwortende Modell wählen"], ["/effort", "wählen, wie lange es nachdenkt"], ["/help", "diese Liste"], ["{range}", "aus dem Menü darüber wählen"], ["↑", "Ihre letzte Frage zurück in die Zeile"]],
      tryLabel: "Probieren Sie", askNext: "Fragen Sie weiter",
      versions: "Meta-Modell {core} · Modell {sha}", versionsModel: "Modell {sha}",
      graph: { head: "Graph · {title}", failed: "Der Graph liess sich hier nicht zeichnen; die Modellseite zeigt ihn." },
      try: {
        metaModel: "Zeig mir das Meta-Modell", metaModelGets: "ein Diagramm der Typen und wie sie aufeinander verweisen",
        process: "Zeig mir den Prozess {name} Schritt für Schritt", processGets: "die Schritte als Ablauf, samt Rücksprüngen",
        organization: "Zeig mir die Organisation", organizationGets: "die Einheiten als Organigramm: wer sie jeweils leitet und wer dazugehört",
        landscape: "Zeig mir die Landschaft von {name}", landscapeGets: "worauf das System läuft, womit es verbunden ist und welche Daten es hält",
        usecase: "Zeig mir den Anwendungsfall {name}", usecaseGets: "wem er dient, was er einbindet und was er vom Produkt verlangt",
        requirements: "Zeig mir die Anforderungen an {name}", requirementsGets: "woran das Produkt gemessen wird, jede Anforderung ein Link ins Modell",
        list: "Liste {list} als Tabelle auf", listGets: "eine Zeile je Eintrag, jeder Name ein Link ins Modell",
        lists: { kpi: "die KPIs", seat: "die Sitze", product: "die Produkte", decision: "die Entscheide", value: "die Werte" }
      },
      again: { sentence: "Sie können {when} wieder fragen.", minute: "in einer Minute", minutes: "in {n} Minuten", at: "um {time}", tomorrow: "morgen um {time}", day: "am {day} um {time}" },
      github: "{title} auf GitHub", commit: "Commit {sha}",
      modalClose: "Schliessen \u00b7 Esc",
      ask: { from: "Der Link, den Sie geöffnet haben, enthält diese Frage:", label: "Eine Frage aus dem Link, den Sie geöffnet haben", send: "Senden", edit: "Bearbeiten", discard: "Verwerfen" },
      diagram: { concepts: "Konzepte", process: "Prozess", neighborhood: "Verbindungen", schema: "Meta-Modell", context: "Context Map", aggregate: "Aggregat", flow: "Ablauf", lifecycle: "Lebenszyklus", organization: "Organisation", system: "Landschaft", holds: "Datenbestand", usecase: "Anwendungsfall", scenario: "Szenario", requirements: "Anforderungen", reading: { context: "Einfache Pfeile laufen vom Upstream- zum Downstream-Kontext; jeder Pfeil nennt das Muster zwischen den beiden Kontexten.", aggregate: "Die Wurzel des Aggregats hält, was die Rauten verbinden; die gestrichelten Pfeile sind die Ereignisse, die sie auslöst.", flow: "Durchgezogene Pfeile sind Befehle an das Aggregat, gestrichelte die Ereignisse, die es auslöst; ein Kasten nennt die Bedingung jedes Zweigs.", lifecycle: "Jeder Pfeil ist ein Schritt von einem Zustand zum nächsten, beschriftet mit dem Befehl, der ihn auslöst, wo es einen gibt.", organization: "Durchgezogene Pfeile laufen von einer Führungskraft zu den Führungskräften darunter; eine gestrichelte Linie verbindet eine Stabsstelle mit der Leitung, der sie zuarbeitet; ein gestrichelter Kasten ist eine offene Stelle, neben einer Führungskraft die Suche nach ihrer Nachfolge; Software-Agenten stehen im farbig hinterlegten Rahmen, und ein gepunkteter Pfeil von einer Person zu einem Agenten sagt, wer ihn steuert; ein Agent ohne Pfeil wird von allen im Rahmen gesteuert.", system: "Durchgezogene Pfeile laufen vom System, aus dem die Daten stammen, zum System, das sie übernimmt, beschriftet mit der Schnittstelle und mit dem, was übertragen wird und wie; eine gepunktete Linie verbindet ein System mit dem, worauf es läuft; ein abgerundeter Kasten ist ein Service, den das System bereitstellt; ein Zylinder ist ein Datenbestand, den es hält – mit einem dicken Pfeil, wo seine Kopie führend ist, einem durchgezogenen, wo es schreibt, und einem gepunkteten, wo es nur liest.", holds: "Jeder Zylinder ist ein Datenbestand zum darunter genannten Konzept; ein dicker Pfeil markiert das System, dessen Kopie führend ist, ein durchgezogener ein System, das eine eigene Kopie schreibt, ein gepunkteter ein System, das nur liest.", usecase: "Der Rahmen ist der Geltungsbereich des Anwendungsfalls, und der Akteur steht ausserhalb; ein gestrichelter Pfeil läuft von einem Anwendungsfall zu einem anderen, den seine Schritte einbinden, ein durchgezogener zu einem Feature, von dem er etwas verlangt; ein Sechseck ist eine Anforderung, die für den Anwendungsfall gilt, mit dickem Rand, wo sie «muss» sagt, und gestricheltem, wo sie «darf» sagt.", scenario: "Der abgerundete Kasten ist der Auslöser; die Kästen sind die Schritte in ihrer Reihenfolge, und jeder nennt, wer handelt; ein gestrichelter Kasten ist eine Erweiterung: zuerst die Bedingung, dann, was geschieht.", requirements: "Ein Sechseck ist eine Anforderung, mit dickem Rand, wo sie «muss» sagt, und gestricheltem, wo sie «darf» sagt; der Rahmen um sie nennt ihre Art; ein Pfeil läuft zu dem, wofür sie gilt, ein gepunkteter zu einer Regel, der sie folgt." }, expand: "Im Vollbild öffnen", shut: "Vollbild schliessen", zoomIn: "Vergrössern", zoomOut: "Verkleinern", fit: "Einpassen", fitTip: "Auf den Bildschirm einpassen", failed: "Das Diagramm konnte nicht gezeichnet werden; dies ist seine Quelle." },
      refusal: {
        too_long: "Diese Nachricht ist länger als 1’000 Zeichen.",
        too_much: "Das Gespräch ist zu lang geworden, um es zu senden; beginnen Sie ein neues.",
        busy: "Im Moment zu viele Nachrichten; versuchen Sie es später wieder.",
        over_day: "Der heutige Anteil an Antworten ist aufgebraucht; morgen gibt es mehr.",
        over_month: "Der Anteil dieses Monats an Antworten ist aufgebraucht.",
        closed: "Der Chat ist zurzeit abgeschaltet.",
        host_down: "Der Host des Modells hat nicht geantwortet; versuchen Sie es gleich wieder.",
        foreign: "Diese Seite darf den Chat nicht nutzen.",
        bad_request: "Das konnte nicht als Nachricht gesendet werden.",
        internal: "Unterwegs ist etwas schiefgegangen; versuchen Sie es noch einmal.",
        network: "Der Chat war nicht erreichbar; prüfen Sie die Verbindung und versuchen Sie es wieder.",
        not_granted: "Ihre Anmeldung erlaubt dieses Modell nicht.",
        signed_out: "Sie sind abgemeldet; melden Sie sich mit /login wieder an.",
        over_user_month: "Ihr Anteil an Antworten in diesem Monat ist aufgebraucht; melden Sie sich mit /logout ab, um als Gast weiterzufragen.",
        declined: "Dieses Modell hat die Antwort auf diese Nachricht abgelehnt; formulieren Sie sie anders."
      }
    }
  };
  function strings(lang){ return STRINGS[lang] || STRINGS.en; }
  function langNow(){ return document.documentElement && document.documentElement.lang === "de" ? "de" : "en"; }
  // A code the table does not carry — or one that only exists on Object.prototype, `toString`
  // and the like, walked by a bare `[code]` lookup — falls back to `internal` rather than
  // printing whatever the prototype chain hands back.
  function sentence(code, lang){
    var r = strings(lang || langNow()).refusal;
    return Object.prototype.hasOwnProperty.call(r, code) ? r[code] : r.internal;
  }

  // When a limit lifts, in the visitor's terms. The server sends the moment as an ISO time in
  // UTC on `busy`, `over_day`, `over_month` and `over_user_month`, and the widget writes it against the visitor's
  // clock and zone: within the hour in minutes, later the same local day as a time, tomorrow
  // by name, and beyond that by the day's name, so midnight UTC reads as the local hour it is.
  // Under a minute is "a minute", the one case where the old sentence was right. The sentence
  // says "at" and never "exactly at": the bucket is per instance, and a visitor may find the
  // chat open earlier than the moment says, never later. `zone` is for the suite; the page
  // passes nothing and gets the browser's. An unreadable moment or one already past gives an
  // empty string, and the caller writes the plain sentence. `en-CA` writes a date as
  // 2026-09-23, which two moments can be compared by; `en-GB` and `de-CH` both write a
  // 24-hour time as 14:35, where `en-US` would write 2:35 PM.
  function when(retryAt, now, lang, zone){
    var t = Date.parse(retryAt);
    if (isNaN(t) || t <= now) return "";
    var s = strings(lang).again, clause;
    var minutes = Math.ceil((t - now) / 60000);
    if (minutes <= 60) clause = minutes <= 1 ? s.minute : s.minutes.replace("{n}", String(minutes));
    else {
      var opts = zone ? { timeZone: zone } : {};
      var day = function(ms){ return new Intl.DateTimeFormat("en-CA", Object.assign({ year: "numeric", month: "2-digit", day: "2-digit" }, opts)).format(new Date(ms)); };
      var time = new Intl.DateTimeFormat(lang === "de" ? "de-CH" : "en-GB", Object.assign({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, opts)).format(new Date(t));
      var then = day(t);
      if (then === day(now)) clause = s.at.replace("{time}", time);
      else if (then === day(now + 86400000)) clause = s.tomorrow.replace("{time}", time);
      else clause = s.day.replace("{day}", new Intl.DateTimeFormat(lang === "de" ? "de-CH" : "en-US", Object.assign({ weekday: "long" }, opts)).format(new Date(t))).replace("{time}", time);
    }
    return s.sentence.replace("{when}", clause);
  }

  // The refusal as the visitor reads it: the code's sentence, and where the server named the
  // moment its limit lifts, that moment after it. A response without the field, or one whose
  // body could not be read, gives the sentence alone, so a widget meeting an older server
  // degrades to what it said before.
  function refusalText(code, retryAt, now, lang, zone){
    var base = sentence(code, lang);
    var moment = retryAt ? when(retryAt, now, lang, zone) : "";
    return moment ? base + " " + moment : base;
  }

  // The page's own icon, for the head of the cite line: the first `<link rel="icon">`, or
  // null, and then the words stand instead. Read once, on the page; the suite passes a stub.
  function iconOf(doc){
    var l = doc.querySelector && doc.querySelector('link[rel~="icon"]');
    return l && l.href ? l.href : null;
  }

  // GitHub's own mark, the Octicon `mark-github` (MIT, notice in octicons.LICENSE.txt beside this
  // file), inlined so the page loads nothing.
  var GH = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

  // The line under an answer: the receipt for the rule that every claim comes from a tool's
  // answer. It opens with the site's icon where the page declares one, the words "From the
  // model" as its name and tooltip, and with the words themselves where it does not, so the
  // line is never a bare list. Each cite is its title, linked where a name in the text links,
  // and after it GitHub's mark to the file at the commit the host serves, the one address
  // that lets a reader check the answer without trusting the chat; its name carries the
  // title and the commit's first seven characters, read from the URL's `blob/<sha>/`. A cite
  // without a URL gets no mark. The icon stands once, at the head: a line that repeated it
  // before every title was drawn and declined for the width it costs in a panel that is
  // twenty-six rem on a desk and the whole screen on a phone.
  function citeLine(cites, model, icon, doc){
    var lang = doc.documentElement && doc.documentElement.lang === "de" ? "de" : "en", s = strings(lang);
    var c = doc.createElement("p"); c.className = "rbchat-cites";
    if (icon) {
      var img = doc.createElement("img"); img.className = "rbchat-from";
      img.setAttribute("src", icon); img.setAttribute("alt", s.from); img.setAttribute("title", s.from);
      img.setAttribute("width", "16"); img.setAttribute("height", "16");
      c.appendChild(img);
    } else {
      var words = doc.createElement("span"); words.textContent = s.from + ": "; c.appendChild(words);
    }
    cites.forEach(function(x, i){
      var a = doc.createElement("a"); a.className = "rbchat-cite"; a.href = link(model, x.id); a.textContent = x.title || x.id;
      c.appendChild(a);
      if (x.url) {
        var m = /\/blob\/([0-9a-f]{7,40})\//.exec(x.url);
        var name = s.github.replace("{title}", x.title || x.id) + (m ? ", " + s.commit.replace("{sha}", m[1].slice(0, 7)) : "");
        var g = doc.createElement("a"); g.className = "rbchat-gh"; g.href = x.url;
        g.setAttribute("aria-label", name); g.setAttribute("title", name); g.innerHTML = GH;
        c.appendChild(g);
      }
      if (i < cites.length - 1) c.appendChild(doc.createTextNode(", "));
    });
    return c;
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
  // Every name the conversation has heard, each answer's names and cites, oldest first. A
  // follow-up that only reshapes an earlier answer, the same entities as a table, calls no
  // tool, so its own turn brings no names; the names an earlier turn brought are still names
  // the server sent, so they are linked wherever a later answer writes them.
  function heard(turns){
    var out = [];
    turns.forEach(function(t){ if (t.role === "assistant") out = out.concat(t.names || [], t.cites || []); });
    return out;
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
  function cells(line){ return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(function(c){ return cell(c.trim()); }); }
  // A table row is one line, so a cell cannot hold a list the way the body does. The model is
  // told to write one as `- first<br>- second`, and that is the one place a `<br>` means
  // anything: it arrives escaped like every other character, and it is read back only here. A
  // cell whose every line is an item is a list, bulleted or numbered as the body's lists are, and
  // the bullet the model reaches for unasked, `•`, counts as one; any other cell keeps its
  // lines as lines.
  var BR = /&lt;br\s*\/?&gt;/i, CELL_BULLET = /^(?:[-*•])\s+(.*)$/, CELL_NUMBER = /^\d+\.\s+(.*)$/;
  function cell(c){
    var parts = c.split(BR).map(function(p){ return p.trim(); }).filter(Boolean);
    if (!parts.length) return "";
    var re = parts.every(function(p){ return CELL_BULLET.test(p); }) ? CELL_BULLET : parts.every(function(p){ return CELL_NUMBER.test(p); }) ? CELL_NUMBER : null;
    if (!re) return parts.map(inline).join("<br>");
    var tag = re === CELL_NUMBER ? "ol" : "ul";
    return "<" + tag + ">" + parts.map(function(p){ return "<li>" + inline(re.exec(p)[1].trim()) + "</li>"; }).join("") + "</" + tag + ">";
  }
  // A name the answer's language keeps unchanged comes back twice, **Master** (Master), because
  // the model is told to follow every name with its exact title and follows that past its own
  // sense; no wording of that instruction stopped it. The pair is the same words, so it is
  // written once, and the name still links, since the title is what it links by. A bold name
  // folds wherever it stands. One not in bold folds only where a name begins, at the head of a
  // line, a cell or an item or after a comma, colon or semicolon, because the words before
  // "Plan (Plan)" may be the name's own rendering, Business Plan.
  var TWICE_BOLD = /\*\*([^*\n]+?)\*\* \(\1\)/g,
    TWICE_PLAIN = /(^[ \t]*(?:(?:[-*•]|\d+\.)[ \t]+)?|[|:;,][ \t]*|<br>[ \t]*(?:[-*•][ \t]+)?)([^\s*()|<][^*()|\n<]*?) \(\2\)/gm;
  function once(text){ return text.replace(TWICE_BOLD, "**$1**").replace(TWICE_PLAIN, "$1$2"); }
  // Blocks, line by line: a table needs its delimiter row before it is a table, so one still
  // arriving is a paragraph until its second line lands; a list is consecutive items; the rest
  // is paragraphs split at blank lines. The model sometimes leaves a blank line between two rows
  // of one table, and the rows after it, with no header of their own, would run together as one
  // paragraph of pipes; so a blank line inside a table is skipped when a row follows it that
  // does not open a table of its own.
  function md(text){
    if (!text) return "";
    var lines = esc(once(text)).split(/\r?\n/), out = "", i = 0, n = lines.length;
    while (i < n) {
      var line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (ROW.test(line) && i + 1 < n && DELIM.test(lines[i + 1])) {
        var head = cells(line); i += 2; var rows = [];
        for (;;) {
          while (i < n && ROW.test(lines[i])) { rows.push(cells(lines[i])); i++; }
          var j = i; while (j < n && !lines[j].trim()) j++;
          if (j === i || j === n || !ROW.test(lines[j]) || (j + 1 < n && DELIM.test(lines[j + 1]))) break;
          i = j;
        }
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
  // expanded. The stage takes an id or an address after the hash and writes the address back
  // once it has found the entity. An id may still be a path — a model whose instance has no
  // stable ids yet carries its address as its id — and the stage reads a path's slashes as
  // they are; encoded, the slash is a hash the page does not hold, and the page drops it and
  // shows the root. So nothing here is encoded. `?stage=expanded` is the
  // request the stage already answers, the one blust.ch's timeline makes for a skill: a reader
  // following a cite came for that entity's card, not for the graph around it, and the page
  // takes the parameter back out of the address once it has read it.
  function link(model, id){
    var base = model, cut = base.indexOf("#");
    if (cut >= 0) base = base.slice(0, cut);
    return base + (base.indexOf("?") >= 0 ? "&" : "?") + "stage=expanded#" + id;
  }
  // The graph's own address: the model link, embedded, so the page draws the stage alone.
  function graphHref(model, id){ return link(model, id).replace("?stage=expanded#", "?stage=expanded&embed#").replace("&stage=expanded#", "&stage=expanded&embed#"); }
  // The entity a link into the model names, read back from the address link() wrote; null for
  // any address that is not one, so a link to anywhere else is left to the browser.
  function entityOf(href, model){
    var base = model, cut = base.indexOf("#"); if (cut >= 0) base = base.slice(0, cut);
    var at = String(href || ""), hash = at.indexOf("#");
    if (hash < 0 || at.slice(0, hash) !== base + (base.indexOf("?") >= 0 ? "&" : "?") + "stage=expanded") return null;
    var id = decodeURIComponent(at.slice(hash + 1));
    return id || null;
  }
  // The place in the graph a link on any page of the site names: an address that resolves, on
  // this site, to the model page with its stage expanded and a place after the hash. The model
  // page itself names none, since its own stage is right there to move.
  function graphTarget(href, model, here){
    if (!href || !model || !here) return null;
    try {
      var to = new URL(href, here), page = new URL(model, here), at = new URL(here);
      if (to.origin !== at.origin || to.pathname !== page.pathname || page.pathname === at.pathname) return null;
      if (!/(^|&)stage=expanded(&|$)/.test(to.search.slice(1))) return null;
      var id = decodeURIComponent(to.hash.slice(1));
      return id || null;
    } catch (e) { return null; }
  }
  // What the chat answers from, read from the model file it already fetched: the core the model
  // is written in, and the model's repository at one commit.
  function versionsOf(file){
    if (!file || typeof file.commit !== "string" || !file.commit || typeof file.repo !== "string" || !file.repo) return null;
    return { core: typeof file.core === "string" && file.core ? file.core : null, commit: file.commit, sha: file.commit.slice(0, 7), repo: file.repo };
  }

  // Whether the cursor goes back to the input after an answer or a refusal. On a touch screen
  // focusing the input opens the keyboard over the answer the visitor is about to read, a
  // change nobody asked for, so the cursor goes back only where there is a fine pointer, a mouse
  // or a trackpad, and no keyboard to open. A screen reader hears the answer either way: the
  // finished answer is a polite live region. Opening the panel and starting a new conversation
  // still focus the input everywhere, because the visitor asked for those.
  function refocus(win){ var mm = win && win.matchMedia; return !mm || mm.call(win, "(pointer: fine)").matches; }

  // A link may ask for the panel open — a post that sends a reader to the chat does — with
  // ?chat=open, as a link asks for the stage expanded with ?stage=expanded. The page opens the
  // panel and takes the parameter back out of the address, the way it takes lang and theme, so
  // a reload or a shared address does not open it again. This gives the query string without
  // the parameter, "" where it was the only one, or null where the address never asked.
  function asked(search){
    var re = /([?&])chat=open(&|$)/;
    if (!re.test(search || "")) return null;
    return search.replace(re, "$1").replace(/[?&]$/, "");
  }

  // A link may carry a question too, with ?ask=, so a post can send a reader to one answer. The
  // question is never sent on arrival: the panel opens with it waiting under the notice that says
  // nothing is sent until the visitor sends, and the visitor sends, edits or discards it. Read
  // once and taken out of the address, as chat=open is. This gives the question, trimmed, and the
  // query string without the parameter; the question is null where it is empty, longer than a
  // message may be, or not decodable, and the whole is null where the address carries no ask.
  function linkQuestion(search){
    var re = /([?&])ask=([^&#]*)(&|$)/, m = re.exec(search || "");
    if (!m) return null;
    var question = null;
    try { question = decodeURIComponent(m[2].replace(/\+/g, " ")).trim(); } catch (e) { question = null; }
    if (!question || question.length > LIMIT) question = null;
    return { question: question, rest: search.replace(re, "$1").replace(/[?&]$/, "") };
  }

  // n items of a list, at random and without repeats: a Fisher–Yates shuffle of a copy, cut to
  // n, which is uniform over every ordering and never picks the same item twice even where the
  // caller asks for more than the list holds — it then gives back the whole list, shuffled.
  // `random` is `Math.random` unless a caller passes its own, which is how the suite gets a
  // deterministic answer to check.
  function pick(list, n, random){
    var rnd = typeof random === "function" ? random : Math.random;
    var arr = (list || []).slice();
    var count = Math.max(0, Math.min(Number(n) || 0, arr.length));
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr.slice(0, count);
  }

  // The titles still worth offering: every one no visitor message in the conversation asked in
  // those words. A chip sends its title as it stands and a typed question is trimmed on send, so
  // a title matches the message it became once both are trimmed; a question put in other words
  // is not recognized and may come back, which costs a visitor one chip they can ignore.
  function unasked(list, messages){
    var asked = {};
    (messages || []).forEach(function(m){ if (m && m.role === "user" && typeof m.content === "string") asked[m.content.trim()] = true; });
    return (list || []).filter(function(t){ return !asked[String(t).trim()]; });
  }
  // A question as the page offers it: its German where the page is German and the site's
  // reviewed file holds one, else the model's own title. A chip shows and sends this; which
  // questions to offer is still chosen by title, and a chip that is no model question, such as
  // "tell me more", is its own text in either language.
  function sayIn(list, lang, title){
    if (lang !== "de") return title;
    for (var i = 0; i < (list || []).length; i++) if (list[i] && list[i].title === title && typeof list[i].de === "string" && list[i].de) return list[i].de;
    return title;
  }

  // The language what follows an answer is offered in: the answer's own, which the server names
  // on done, since a German question on the English page is answered in German and its chips
  // should not switch back. Only an answer standing last speaks for what follows it; with none,
  // or one from a server that names no language the widget has words for, the page's.
  function answerLang(turns, page){
    var last = turns && turns.length ? turns[turns.length - 1] : null;
    return last && last.role === "assistant" && typeof last.lang === "string" && Object.prototype.hasOwnProperty.call(STRINGS, last.lang) ? last.lang : page;
  }

  // The conversation with every visitor message that is a question's German read back as its
  // title, so unasked() and follow(), which compare titles, know the question was asked —
  // whether a chip sent it or the visitor typed the same words.
  function asTitles(list, messages){
    var back = {};
    (list || []).forEach(function(q){ if (q && typeof q.de === "string" && q.de) back[q.de.trim()] = q.title; });
    return (messages || []).map(function(m){
      return m && m.role === "user" && typeof m.content === "string" && back[m.content.trim()] ? { role: m.role, content: back[m.content.trim()] } : m;
    });
  }


  // The chips as a span of what the model answers: where its questions name a kind, three kinds
  // are picked at random and one question from each, so a visitor sees three sorts of question
  // rather than three that may all be about one thing. Where the model ranks its kinds, the first
  // chip is of the kind it ranks first among those still open, the one its owner says a visitor
  // asks first, and the others span the rest at random. Fewer kinds than chips fill from what is
  // left, and a model whose questions name no kind is offered exactly as pick() offers it, so a
  // site that takes this before its model groups anything loses nothing.
  function spread(items, n, random){
    var rnd = typeof random === "function" ? random : Math.random;
    var list = (items || []).filter(function(q){ return q && typeof q.title === "string"; });
    var kinded = list.filter(function(q){ return typeof q.kind === "string" && q.kind; });
    if (!kinded.length) return pick(list.map(function(q){ return q.title; }), n, rnd);
    var byKind = {}, kinds = [], rankOf = Object.create(null), first = null;
    kinded.forEach(function(q){
      if (!byKind[q.kind]) { byKind[q.kind] = []; kinds.push(q.kind); }
      byKind[q.kind].push(q.title);
      if (typeof q.rank === "number" && isFinite(q.rank) && !(rankOf[q.kind] <= q.rank)) rankOf[q.kind] = q.rank;
    });
    kinds.forEach(function(k){ if (k in rankOf && (first === null || rankOf[k] < rankOf[first])) first = k; });
    var count = Math.max(0, Number(n) || 0);
    var order = first !== null && count > 0 ? [first].concat(pick(kinds.filter(function(k){ return k !== first; }), count - 1, rnd)) : pick(kinds, n, rnd);
    var chosen = order.map(function(k){ return pick(byKind[k], 1, rnd)[0]; });
    var taken = {};
    chosen.forEach(function(t){ taken[t] = true; });
    var rest = list.map(function(q){ return q.title; }).filter(function(t){ return !taken[t]; });
    return chosen.concat(pick(rest, Math.max(0, (Number(n) || 0) - chosen.length), rnd));
  }

  // The entities an answer writes, by exact title and whole, as nameLinks() links them, in the
  // order the answer first writes them, each once. `names` is every name and cite the
  // conversation has heard, so an answer that reshapes an earlier one still finds its entities.
  // Left out: a question of the model's, which is offered as itself and never as something to
  // hear more about, and an entity whose title a visitor message already carries, since the
  // visitor asked about it and the answer is about it.
  function mentioned(content, names, items, messages){
    var text = typeof content === "string" ? content : "";
    var questions = {};
    (items || []).forEach(function(q){ if (q && typeof q.title === "string") questions[q.title] = true; });
    var said = (messages || []).filter(function(m){ return m && m.role === "user" && typeof m.content === "string"; }).map(function(m){ return m.content.toLowerCase(); });
    var seen = {}, found = [];
    (names || []).forEach(function(n){
      if (!n || typeof n.title !== "string" || !n.title || seen[n.title] || questions[n.title]) return;
      seen[n.title] = true;
      var title = n.title, low = title.toLowerCase();
      if (said.some(function(m){ return m.indexOf(low) !== -1; })) return;
      var at = text.indexOf(title);
      while (at >= 0 && !edged(text, at, title.length)) at = text.indexOf(title, at + 1);
      if (at >= 0) found.push({ title: title, at: at });
    });
    // A title inside a longer one is the longer one's word, not a mention of its own.
    found = found.filter(function(f){ return !found.some(function(g){ return g !== f && g.title.length > f.title.length && f.at >= g.at && f.at < g.at + g.title.length; }); });
    return found.sort(function(a, b){ return a.at - b.at; }).map(function(f){ return f.title; });
  }

  // The three that follow an answer. Two ask to be told more about the first two entities the
  // answer writes and the visitor has not asked about, `named`, as mentioned() finds them. Where
  // the answer cited entities of one type only, T, the first of them E, the third is E's
  // neighbors (with nothing named, T's schema comes before them), and what room the answer's entities leave goes to T's schema, then to a question
  // of the model's that rests on E, else one that rests on anything of type T. The schema chip
  // names E with T after it, "Owner (seat)", so a visitor reads which schema it is without
  // knowing the type's name; the type is written as its own name in both languages, as the chat
  // writes it. Each is offered only where no visitor message asked it and it fits the box; a
  // chip left out that way is filled from spread() over the questions still open, so three show
  // wherever three exist. An answer that writes no entity left to ask about and cites none, or
  // cites more than one type, follows nothing: null, and the caller offers spread() as before.
  // `items` are the model's questions, each with the ids and types of what it rests on.
  function follow(cites, items, messages, lang, random, named){
    var rnd = typeof random === "function" ? random : Math.random;
    var s = strings(lang).follow;
    var fits = function(t){ return t.length <= LIMIT; };
    var more = unasked((named || []).map(function(t){ return s.more.replace("{title}", t); }), messages).filter(fits).slice(0, 2);
    var cs = (cites || []).filter(function(c){ return c && typeof c.id === "string" && typeof c.type === "string" && c.type; });
    var one = cs.length && !cs.some(function(c){ return c.type !== cs[0].type; });
    if (!one && !more.length) return null;
    var chosen = more.slice();
    var titles = (items || []).filter(function(q){ return q && typeof q.title === "string"; }).map(function(q){ return q.title; });
    var open = unasked(titles, messages);
    if (one) {
      var type = cs[0].type, e = cs[0];
      var schema = s.schema.replace("{title}", e.title || e.id).replace("{type}", type), neighbors = s.neighbors.replace("{title}", e.title || e.id);
      // With nothing named the three read as before, schema first; beside the answer's own
      // entities the neighbors come first, since they are E's and the schema is only its type's.
      var own = unasked(more.length ? [neighbors, schema] : [schema, neighbors], messages).filter(fits);
      chosen = chosen.concat(own).slice(0, 3);
      if (chosen.length < 3) {
        var rest0 = (items || []).filter(function(q){ return q && open.indexOf(q.title) !== -1 && chosen.indexOf(q.title) === -1; });
        var on = function(test){ return rest0.filter(function(q){ return (q.rests || []).some(test); }).map(function(q){ return q.title; }); };
        var third = pick(on(function(r){ return r.id === e.id; }), 1, rnd);
        if (!third.length) third = pick(on(function(r){ return r.type === type; }), 1, rnd);
        chosen = chosen.concat(third);
      }
    }
    var rest = (items || []).filter(function(q){ return q && open.indexOf(q.title) !== -1 && chosen.indexOf(q.title) === -1; });
    return chosen.concat(spread(rest, Math.max(0, 3 - chosen.length), rnd));
  }

  // Where an open conversation lives while the visitor reads on. A page is a document, so
  // following a link throws the panel and everything in it away, and a visitor who asked a
  // question and clicked the answer's link lost the conversation. `sessionStorage` is the tab:
  // it survives a page and dies with the tab, which is the lifetime the chat already claims.
  // The key is `chat`, the family's, made once by the package as `lang` and `theme` are, and
  // the value is this widget's shape: whether the panel was open, and the turns as they were
  // rendered, each answer with the entities it cited. Every access is wrapped, because a
  // browser with site data blocked throws on the first read and the chat still has to work.
  var STORE_KEY = "chat";
  // How big the panel is, kept in `localStorage` as `lang` and `theme` are: a size is a choice
  // about how this visitor reads the chat on this screen, so it holds in every tab and on the
  // next visit, where the conversation it frames goes when its tab goes. Its own key, because it
  // is no part of any conversation: a link opened in a new tab finds the panel at the size the
  // visitor gave it, with nothing else carried over.
  var SIZE_KEY = "chat-size";
  var MIN_W = 320, MIN_H = 260, STEP = 24;
  function stored(){
    try { var raw = sessionStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function storedSize(){
    try { var raw = localStorage.getItem(SIZE_KEY); var v = raw ? JSON.parse(raw) : null; return v && v.w && v.h ? v : null; }
    catch (e) { return null; }
  }
  function keepSize(w, h){ try { localStorage.setItem(SIZE_KEY, JSON.stringify({ w: w, h: h })); } catch (e) {} }

  // Where the visitor was reading, kept with the conversation so the back button returns them
  // to it and not to the end. A place is a turn and a distance into its bubble, not a pixel
  // offset: a picture drawn again after the page comes back takes its height a moment late,
  // and a pixel counted from the top would land in the wrong answer. A log read to its end
  // keeps no place, and opens at its end as it always did; so does a hidden one, having none.
  // The end is a place placed() knows too, since a picture drawing late moves the end as well.
  function place(log){
    if (log.scrollHeight - log.scrollTop - log.clientHeight < 2) return null;
    var top = log.scrollTop, box = log.getBoundingClientRect().top, kids = log.querySelectorAll("[data-turn]");
    for (var i = 0; i < kids.length; i++) {
      var r = kids[i].getBoundingClientRect(), at = r.top - box + top;
      if (at + r.height > top) return { turn: +kids[i].getAttribute("data-turn"), by: top - at };
    }
    return null;
  }
  function placed(log, at){
    if (at && at.end) { log.scrollTop = log.scrollHeight; return true; }
    var b = at && log.querySelector('[data-turn="' + at.turn + '"]');
    if (!b) return false;
    log.scrollTop = b.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop + at.by;
    return true;
  }

  // Every place the conversation changes calls keep(), so the control follows it from here and
  // no caller has to remember a second line.
  function keep(){
    if (newBtn) newBtn.hidden = !messages.length;
    try {
      // A panel left open with nothing asked yet, fresh or just reset, is kept too, so the next
      // page shows it open; only an empty conversation behind a closed panel leaves nothing.
      if (!messages.length && !(panel && !panel.hidden)) { sessionStorage.removeItem(STORE_KEY); return; }
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ open: !!(panel && !panel.hidden), turns: turns, at: reading || (panel && !panel.hidden ? place(log) : null), next: qBox ? qPicked : null, pick: introPick }));
    } catch (e) {}
  }

  // ─── The picture ──────────────────────────────────────────────────────────────────────────
  // A diagram the host drew arrives whole, as Mermaid source with each node named by the entity
  // it is, and is drawn under the answer by Mermaid, vendored beside this file. The colors are
  // the tokens', read when the picture is drawn, so it follows the theme; a token a page does
  // not define falls back to the dark theme's value, since Mermaid derives its shades from
  // real colors and an empty one would stop the drawing.
  var DARK = { "--ground": "#0C0E13", "--raise": "#171A21", "--ink": "#EFEDE8", "--dim": "#8A8B86", "--c-mid": "#7FA3D8", "--press": "#1b2231" };
  function mermaidConfig(read){
    function v(name){ var x = String(read(name) || "").trim(); return x || DARK[name]; }
    var font = String(read("font") || "").trim() || "ui-sans-serif, system-ui, sans-serif";
    return {
      // The classic look is flat, as the family draws: the default draws shadows and gradients.
      startOnLoad: false, securityLevel: "strict", theme: "base", look: "classic", fontFamily: font,
      // Mermaid draws a rounded node and a cylinder from a seed, and where this is left at its
      // default of 0 it takes a random one for each render, so the same picture came out a few
      // pixels different every time. A fixed seed makes a picture the same wherever and whenever
      // it is drawn, which a deck's PDF is compared by.
      handDrawnSeed: 1,
      // At its own size in a box that scrolls: fitted to a bubble, a wide picture's words shrink
      // below reading. A concept carries no attributes or methods, so its class has no empty bars.
      flowchart: { useMaxWidth: false }, class: { useMaxWidth: false, hideEmptyMembersBox: true },
      // A sequence diagram keeps its own size, its actors only above, wide enough that a branch's
      // condition stays whole; a state diagram keeps its own size like the others.
      sequence: { useMaxWidth: false, mirrorActors: false, actorFontSize: 13, messageFontSize: 13, noteFontSize: 12, actorMargin: 24, width: 150, height: 40, boxMargin: 6, messageMargin: 26, diagramMarginX: 8, diagramMarginY: 8 },
      state: { useMaxWidth: false },
      // `strict` alone still lets DOMPurify pass an `<img src>` through a label; a label writes
      // only `b`, `br` and `small`, so an image is never a label and would be a request to
      // another host, which "no request leaves the page's origin" promises never happens.
      dompurifyConfig: { FORBID_TAGS: ["img"] },
      themeVariables: {
        fontFamily: font, fontSize: "13px", background: v("--ground"),
        primaryColor: v("--raise"), mainBkg: v("--raise"), secondaryColor: v("--press"), tertiaryColor: v("--ground"),
        primaryTextColor: v("--ink"), textColor: v("--ink"), nodeTextColor: v("--ink"), classText: v("--ink"),
        // A node is a link, and every link in the family is --c-mid; its own text color is set
        // in chat.css instead, scoped to a linked node, because this variable also colors an
        // edge label's text and an unlinked overflow bubble's, which stay --ink.
        primaryBorderColor: v("--c-mid"), nodeBorder: v("--c-mid"), lineColor: v("--dim"),
        // An edge label's own background: Mermaid draws it from this one variable in every
        // diagram kind this file uses, so the panel's raise reaches it without a CSS rule.
        edgeLabelBackground: v("--raise"),
        // A note is the panel's own box, not Mermaid's yellow.
        noteBkgColor: v("--raise"), noteBorderColor: v("--dim"), noteTextColor: v("--ink")
      }
    };
  }
  // Where Mermaid put a node in its SVG: a group whose id ends in the node's name and a number,
  // after `classId` in a class diagram and `flowchart` in a flowchart; a scenario's step is `s0`
  // and on and is listed where its actor is a seat. The one place that knows
  // it, so a Mermaid release that names them otherwise is fixed here and nowhere else.
  function nodeElement(svg, node){
    if (!svg || !/^[ns]\d+$/.test(String(node))) return null;
    var re = new RegExp("-(?:classId|flowchart)-" + node + "-\\d+$"), all = svg.querySelectorAll("g[id]");
    for (var i = 0; i < all.length; i++) if (re.test(all[i].id)) return all[i];
    return null;
  }
  // A node's name alone reads as the link: every run of a label's children that is neither the
  // host's own <small> line (a neighborhood's «type», a phase's seats) nor the <br> that sets it
  // apart is gathered into one span.rbchat-node-name, so chat.css can underline the name on hover
  // and focus without a text-decoration on the label propagating into the quieter line beside it.
  // A label with no <small> has nothing to keep apart from, so it is wrapped whole, <br> and all.
  // Tolerant of a label Mermaid renders differently: an empty run is left unwrapped.
  function wrapNodeName(p){
    var kids = [].slice.call(p.childNodes), hasSmall = false, i;
    for (i = 0; i < kids.length; i++) if (kids[i].nodeType === 1 && (kids[i].tagName === "SMALL" || (kids[i].classList && kids[i].classList.contains("label-icon")))) { hasSmall = true; break; }
    function wrap(run){
      if (!run.length) return;
      var span = document.createElement("span");
      span.className = "rbchat-node-name";
      p.insertBefore(span, run[0]);
      for (var j = 0; j < run.length; j++) span.appendChild(run[j]);
    }
    if (!hasSmall) { wrap(kids); return; }
    var run = [];
    for (i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k.nodeType === 1 && (k.tagName === "SMALL" || k.tagName === "BR")) { wrap(run); run = []; }
      // A nature's mark Mermaid set before the name stays outside the span a hover underlines.
      else if (k.nodeType === 1 && k.classList && k.classList.contains("label-icon")) { wrap(run); run = []; }
      else run.push(k);
    }
    wrap(run);
  }
  // A flow drawn left to right is wider than a phone: in a narrow panel it runs top to bottom.
  // Only the direction changes; every node and arrow is the host's.
  var NARROW = 560;
  function oriented(source, width){
    return width && width < NARROW ? String(source).replace(/^flowchart LR\b/, "flowchart TB") : source;
  }
  // The caption: the shape in the page's language, then what the host drew it of.
  function nodeHref(model, n){
    return typeof n.url === "string" && /^https:\/\//.test(n.url) ? n.url : link(model, n.id);
  }
  // A shape is a key the host sends, so only a word the widget itself wrote for it counts: a
  // shape named "reading" or "toString" finds an object or a function, and neither is a word.
  function shapeWord(map, shape){
    return typeof shape === "string" && Object.prototype.hasOwnProperty.call(map, shape) && typeof map[shape] === "string" ? map[shape] : "";
  }
  function diagramCaption(d, lang){
    var name = shapeWord(strings(lang).diagram, d && d.shape);
    return d && d.title ? (name ? name + " · " + d.title : d.title) : name;
  }

  // ─── The terminal ─────────────────────────────────────────────────────────────────────────
  // The lockup the intro opens on is the page's own, as its header draws it: every site writes
  // `<a class="brand"><svg>…</svg><b>Company<span>Graph</span></b></a>`, so the tag needs no
  // attribute to name it. The accent is the span; the first half is what comes before it, its
  // trailing space kept, since blust.ch writes "Robert <span>Blust</span>".
  function lockupOf(doc){
    var a = doc && doc.querySelector && doc.querySelector("header a.brand");
    var svg = a && a.querySelector("svg"), b = a && a.querySelector("b");
    if (!svg || !b) return null;
    var span = b.querySelector("span"), accent = span ? span.textContent : "";
    return { mark: svg, first: b.textContent.slice(0, b.textContent.length - accent.length), accent: accent };
  }
  // The words the command line keeps for itself. They never reach the host. `/clear` is the
  // second name of `/new`, as in Claude Code; the other four stand alone.
  function command(text){
    var t = String(text == null ? "" : text).trim().toLowerCase();
    if (t === "/new" || t === "/clear") return "new";
    return t === "/help" || t === "/login" || t === "/logout" || t === "/model" || t === "/effort" ? t.slice(1) : null;
  }

  // ─── Sign-in ──────────────────────────────────────────────────────────────────────────────
  // The pure parts of signing in at ZITADEL and choosing the model. The table is chat-server's
  // (lib/models.mjs), in its order: the default first, which every signed-in reader may pick;
  // `role` is the name a sign-in grants for the rest. The server checks every grant itself, so
  // what the widget offers is a courtesy and never the fence.
  var CHAT_MODELS = [
    { id: "claude-sonnet-5", label: "Sonnet 5", role: null },
    { id: "claude-sonnet-5-5", label: "Sonnet 5.5", role: "sonnet-5-5" },
    { id: "claude-opus-5-5", label: "Opus 5.5", role: "opus" },
    { id: "claude-fable-5-1", label: "Fable 5.1", role: "fable" },
    { id: "claude-haiku-5-5", label: "Haiku 5.5", role: "haiku" }
  ];
  var CHAT_EFFORTS = ["low", "medium", "high", "xhigh", "max"];
  var ROLES_CLAIM = "urn:zitadel:iam:org:project:roles";
  function own(o, k){ return o !== null && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k); }

  // The models the sign-in grants. ZITADEL writes the roles claim as { "<role>": { "<orgId>":
  // "<org domain>" } }: a role counts where it is held in this site's org, and, where one
  // project serves several sites, under the site's `prefix` ahead of the role's name. Own
  // properties only, so no role or org is read off Object.prototype. A claim that is absent or
  // not an object grants the default alone.
  function grantedModels(claims, org, prefix){
    var roles = own(claims, ROLES_CLAIM) ? claims[ROLES_CLAIM] : null;
    return CHAT_MODELS.filter(function(m){
      if (m.role === null) return true;
      var key = (prefix || "") + m.role;
      return own(roles, key) && own(roles[key], org);
    }).map(function(m){ return m.id; });
  }

  // Where the sign-in begins: the authorize endpoint with the PKCE challenge, the `state` the
  // page will check on the way back, and the audience and roles scopes ZITADEL needs to put the
  // project's roles in the token. Every value is encoded, whatever it holds.
  function authorizeUrl(site, challenge, state, redirect){
    var scope = "openid profile urn:zitadel:iam:org:project:id:" + site.project + ":aud urn:zitadel:iam:org:projects:roles";
    var q = [["client_id", site.client], ["redirect_uri", redirect], ["response_type", "code"], ["scope", scope], ["code_challenge", challenge], ["code_challenge_method", "S256"], ["state", state]];
    return site.issuer + "/oauth/v2/authorize?" + q.map(function(p){ return p[0] + "=" + encodeURIComponent(p[1]); }).join("&");
  }

  // What the identity service sends the page back with: `code` and `state`, in the query
  // string and only there, both non-empty. Anything less is no return.
  function returnOf(href){
    var h = String(href == null ? "" : href), hash = h.indexOf("#");
    if (hash >= 0) h = h.slice(0, hash);
    var at = h.indexOf("?");
    if (at < 0) return null;
    var got = {};
    h.slice(at + 1).split("&").forEach(function(pair){
      var eq = pair.indexOf("="), k = eq < 0 ? pair : pair.slice(0, eq);
      if (k !== "code" && k !== "state" || own(got, k)) return;
      try { got[k] = decodeURIComponent((eq < 0 ? "" : pair.slice(eq + 1)).replace(/\+/g, " ")); } catch (e) { got[k] = ""; }
    });
    return got.code && got.state ? { code: got.code, state: got.state } : null;
  }
  // One parameter of a query string, decoded, the first where it repeats; null where it is absent.
  function param(search, key){
    var parts = String(search == null ? "" : search).replace(/^\?/, "").split("&");
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf("="), k = eq < 0 ? parts[i] : parts[i].slice(0, eq);
      if (k !== key) continue;
      try { return decodeURIComponent((eq < 0 ? "" : parts[i].slice(eq + 1)).replace(/\+/g, " ")); } catch (e) { return ""; }
    }
    return null;
  }

  // Whether a token is no longer good: its `exp` (seconds) is at or before `now` (milliseconds,
  // Date.now()), or the token is not a JWT whose payload, the base64url middle segment, says a
  // numeric `exp`. A token the page cannot read is treated as spent, so it asks to sign in again
  // rather than send what the server will refuse.
  function lapsed(token, now){
    var c = claimsOf(token), exp = c && c.exp;
    return typeof exp !== "number" || !isFinite(exp) || exp * 1000 <= now;
  }
  // What a JWT says: its payload, the base64url middle segment, read as UTF-8 JSON, so a name
  // with an umlaut reads as written; null for anything that is not one. Nothing here checks the
  // signature: what the page reads off a token only decides what it offers, and the server
  // checks the access token on every message.
  function claimsOf(token){
    try {
      var b = String(token).split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      while (b.length % 4) b += "=";
      var bin = atob(b), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var c = JSON.parse(new TextDecoder().decode(bytes));
      return c !== null && typeof c === "object" && !Array.isArray(c) ? c : null;
    } catch (e) { return null; }
  }
  // A number alone picks that row of the menu standing last, as the tooling takes "Pick 1-5";
  // a number with no such row, or anything else, is sent as the visitor typed it.
  function picked(text, rows){
    var t = String(text == null ? "" : text).trim();
    if (!/^\d{1,2}$/.test(t) || !rows) return t;
    var i = +t - 1;
    return i >= 0 && i < rows.length ? rows[i] : t;
  }
  // The Try rows: what the chat is built to answer, each with what comes back. The meta-model
  // always, then two of what the model holds, picked at random: one of its processes, its
  // organization where it holds a group, the landscape of one of its systems, one of its use
  // cases, what one of its products is held to where it holds a requirement, and a list of a
  // kind it holds at least three of, the first in LIST_TYPES' order. No row names what the model
  // does not have, and a model that holds only a process and a list is offered both, as before.
  var LIST_TYPES = ["kpi", "seat", "product", "decision", "value"];
  var TRY_ROWS = 3;
  // What a row asks about by name, a name short enough to stand in a row: a use case and a
  // product as the model names them, and a system as connected() chooses it.
  var NAMED_TYPES = ["use-case", "product"], NAME_LIMIT = 120;
  // The systems a landscape row may name: those the model writes a connection on, since a
  // landscape is what a system takes its data from and one that takes none draws alone; where
  // the model writes no connection at all, every system.
  function connected(entities, edges){
    var nameOf = {}, all = [], on = {};
    (Array.isArray(entities) ? entities : []).forEach(function(e){
      if (!e || e.type !== "system" || typeof e.name !== "string" || !e.name.length || e.name.length > NAME_LIMIT) return;
      all.push(e.name);
      if (typeof e.id === "string") nameOf[e.id] = e.name;
    });
    (Array.isArray(edges) ? edges : []).forEach(function(g){
      if (g && typeof g.via === "string" && g.via.indexOf("Connects to.") === 0 && typeof nameOf[g.from] === "string") on[nameOf[g.from]] = true;
    });
    var linked = all.filter(function(n){ return on[n] === true; });
    return linked.length ? linked : all;
  }
  // What an opening offers after the meta-model, as { key, name }: `key` names the row's words in
  // strings().try and `name` what it asks about, so the picks are kept with the conversation and
  // drawn again in either language. They stand in one order however the random falls.
  function tryPick(facts, random){
    var rnd = typeof random === "function" ? random : Math.random;
    var f = facts || {}, counts = f.counts || {}, names = f.names || {}, pool = [];
    function named(type){ return Array.isArray(names[type]) ? names[type] : []; }
    function one(list){ return pick(list, 1, rnd)[0]; }
    var ps = Array.isArray(f.processes) ? f.processes : [];
    if (ps.length) pool.push({ key: "process", name: one(ps) });
    if ((counts.group || 0) >= 1) pool.push({ key: "organization" });
    if (named("system").length) pool.push({ key: "landscape", name: one(named("system")) });
    if (named("use-case").length) pool.push({ key: "usecase", name: one(named("use-case")) });
    if ((counts.requirement || 0) >= 1 && named("product").length) pool.push({ key: "requirements", name: one(named("product")) });
    for (var i = 0; i < LIST_TYPES.length; i++) {
      if ((counts[LIST_TYPES[i]] || 0) >= 3) { pool.push({ key: "list", name: LIST_TYPES[i] }); break; }
    }
    var at = pick(pool.map(function(_, n){ return n; }), TRY_ROWS - 1, rnd).sort(function(x, y){ return x - y; });
    return at.map(function(n){ return pool[n]; });
  }
  // The rows as the page's language words them. `facts.tries` is the picks an opening already
  // made, drawn as they stand; without it the picks are made here. A pick this widget has no
  // words for, kept in the tab by another release, is left out rather than drawn half.
  function tryRows(facts, lang, random){
    var t = strings(lang).try, rows = [[t.metaModel, t.metaModelGets]];
    var tries = facts && Array.isArray(facts.tries) ? facts.tries : tryPick(facts, random);
    tries.forEach(function(p){
      if (!p || typeof p.key !== "string") return;
      var ask = t[p.key], gets = t[p.key + "Gets"];
      if (typeof ask !== "string" || typeof gets !== "string") return;
      if (p.key === "list") {
        if (typeof t.lists[p.name] !== "string") return;
        ask = ask.replace("{list}", function(){ return t.lists[p.name]; });
      } else if (ask.indexOf("{name}") >= 0) {
        if (typeof p.name !== "string" || !p.name) return;
        ask = ask.replace("{name}", function(){ return p.name; });
      }
      rows.push([ask, gets]);
    });
    return rows;
  }
  // The commit the answer was read at: the first cite whose URL names one.
  function commitOf(cites){
    for (var i = 0; cites && i < cites.length; i++) {
      var m = cites[i] && typeof cites[i].url === "string" && /\/blob\/([0-9a-f]{7,40})\//.exec(cites[i].url);
      if (m) return m[1].slice(0, 7);
    }
    return null;
  }
  // The spinner's count: whole seconds, and nothing in the first, so a quick answer shows none.
  function seconds(ms){ var n = Math.floor(ms / 1000); return n > 0 ? n + "s" : ""; }
  // The rows a number picks, as the keys line and /help name them: none, one, or a range.
  function rangeOf(n){ return n > 1 ? "1-" + n : n === 1 ? "1" : ""; }

  window.rbChat = { md: md, readEvents: readEvents, strings: strings, link: link, refocus: refocus, asked: asked, linkQuestion: linkQuestion, nameLinks: nameLinks, heard: heard, when: when, refusalText: refusalText, citeLine: citeLine, iconOf: iconOf, pick: pick, unasked: unasked, sayIn: sayIn, asTitles: asTitles, answerLang: answerLang, spread: spread, mentioned: mentioned, mermaidConfig: mermaidConfig, nodeElement: nodeElement, diagramCaption: diagramCaption, nodeHref: nodeHref, oriented: oriented, follow: follow, place: place, placed: placed, lockupOf: lockupOf, command: command, CHAT_MODELS: CHAT_MODELS, CHAT_EFFORTS: CHAT_EFFORTS, grantedModels: grantedModels, authorizeUrl: authorizeUrl, returnOf: returnOf, lapsed: lapsed, claimsOf: claimsOf, picked: picked, tryPick: tryPick, connected: connected, tryRows: tryRows, commitOf: commitOf, seconds: seconds, rangeOf: rangeOf, versionsOf: versionsOf, graphHref: graphHref, entityOf: entityOf, graphTarget: graphTarget };

  // ─── The page ─────────────────────────────────────────────────────────────────────────────
  var tag = document.currentScript;
  // Loaded some other way than by a tag, as the unit tests load it, it only exports.
  if (!tag || !tag.dataset) return;
  // The model page a node links to, off this tag, which is the one place a page names it.
  var MODEL = tag.dataset.model || "/model/";

  // ─── The pictures ─────────────────────────────────────────────────────────────────────────
  // Before the chat's own gate, because a picture is not only an answer's: a page may carry one
  // it was built with, written as a figure the widget draws (see `hydrate()` below), and a page
  // like that needs the drawing, the Expand and the zoom whether or not it names a chat.
  // Mermaid is fetched from the folder this file came from, the site's own, the first time a
  // picture arrives and never before, so a visitor who asks for none never downloads it and no
  // host but the page's own is asked. `figures` are the pictures drawn, redrawn when the theme
  // changes and relabeled when the language does.
  var mermaidLoad = null, figures = [], drawCount = 0;
  // The dialog Expand opens, the stage's own pattern (assets/stage.js `expand()`): one <dialog>,
  // made once per page, that a figure's picture box moves into and back out of — never a copy —
  // so the same element and the links Mermaid drew into it keep working on both sides of the move.
  // The picture the one modal holds, its handle, and the zoom controls it carries in its head.
  var modalFig = null, modalHandle = null, zoomBar = null, zoomIn = null, zoomOut = null, zoomFit = null;

  // The marks, lib/marks.mjs's own, which a test holds this copy to: the two natures', and the six
  // ArchiMate elements a system's kind names, at the firm brightness. The host writes `fak:fa-human`
  // or `fak:fa-agent` before a person's name and `fak:fa-<element>` before a system's, and Mermaid
  // swaps the token for the mark before it measures the label, so the box fits it. Registered once
  // per Mermaid, whoever loaded it; each body is wrapped in a group whose class chat.css colors.
  var MARKS = {
    human: '<circle cx="8" cy="4.6" r="3.1" fill="currentColor"/><path d="M1.6 15.4a6.4 6.4 0 0 1 12.8 0z" fill="currentColor"/>',
    agent: '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="5.4" width="12" height="8.6" rx="2.6"/><path d="M8 5.4V3.2"/></g><circle cx="8" cy="2.1" r="1.1" fill="currentColor"/><circle cx="5.7" cy="9.6" r="1.05" fill="currentColor"/><circle cx="10.3" cy="9.6" r="1.05" fill="currentColor"/>',
    actor: '<circle cx="8" cy="4.6" r="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2.2 15.2a5.8 5.8 0 0 1 11.6 0" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    "application-component": '<rect x="4.5" y="2" width="9.5" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="4.6" width="5" height="2.4" fill="currentColor"/><rect x="2" y="9" width="5" height="2.4" fill="currentColor"/>',
    node: '<path d="M2.5 5.5L5.5 2.5H13.5V10.5L10.5 13.5H2.5ZM2.5 5.5H10.5V13.5M10.5 5.5L13.5 2.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
    "system-software": '<circle cx="7" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="10.5" cy="5.5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    device: '<rect x="2" y="2.5" width="12" height="8.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 14h6M8 11v3" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    equipment: '<circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.5v2.3M8 12.2v2.3M1.5 8h2.3M12.2 8h2.3M3.4 3.4l1.6 1.6M11 11l1.6 1.6M3.4 12.6l1.6-1.6M11 5l1.6-1.6" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    "communication-network": '<circle cx="3.2" cy="11.5" r="2.1" fill="currentColor"/><circle cx="12.8" cy="4.5" r="2.1" fill="currentColor"/><circle cx="12.8" cy="11.5" r="2.1" fill="currentColor"/><path d="M5 10.2L11 5.8M5.3 11.5h5.4" stroke="currentColor" stroke-width="1.3"/>'
  };
  function withMarks(m){
    if (m && typeof m.registerIconPacks === "function" && !m.rbMarks) {
      var icons = {};
      Object.keys(MARKS).forEach(function(k){ icons[k] = { body: '<g class="rbchat-mark ' + (k === "human" || k === "agent" || k === "actor" ? k : "element " + k) + '">' + MARKS[k] + "</g>" }; });
      m.registerIconPacks([{ name: "fak", icons: { prefix: "fak", width: 16, height: 16, icons: icons } }]);
      m.rbMarks = true;
    }
    return m;
  }
  function loadMermaid(){
    if (window.mermaid) return Promise.resolve(withMarks(window.mermaid));
    if (!mermaidLoad) mermaidLoad = new Promise(function(resolve, reject){
      var s = document.createElement("script");
      s.src = new URL("mermaid.min.js", tag.src).href;
      s.onload = function(){ if (window.mermaid) resolve(withMarks(window.mermaid)); else reject(new Error("mermaid.min.js set no mermaid")); };
      // A failed fetch is not remembered: the next picture tries again.
      s.onerror = function(){ mermaidLoad = null; reject(new Error("mermaid.min.js did not load")); };
      document.head.appendChild(s);
    });
    return mermaidLoad;
  }
  function tokenReader(at){
    var root = getComputedStyle(at || document.documentElement), body = document.body ? getComputedStyle(document.body) : null;
    return function(name){ return name === "font" ? (body ? body.fontFamily : "") : root.getPropertyValue(name); };
  }
  // Each node becomes a link to where the cite line would send it. Mermaid's own click lines
  // are off under `strict`, and the host writes none; the widget links from `nodes`. A type is
  // no entity the model page holds, so the host names its schema's file as `url`, and an https
  // address alone is taken, since a node's link is the one place the host's words become an href.
  // A picture once drawn is kept for the tab, finished and linked, under what it was drawn from:
  // its source as oriented and the colors it was drawn in. A page that shows it again, the
  // answer restored after a page change, puts it back at once, where drawing it again waited
  // for Mermaid and grew the log a moment after the page showed. A theme or a place with other
  // colors, the modal's, is another key and draws afresh. The newest few are kept, since a
  // picture is tens of kilobytes and the tab's storage is small.
  var PICTURES_KEY = "chat-pictures", PICTURES_MAX = 12;
  function keptPictures(){
    try { var v = JSON.parse(sessionStorage.getItem(PICTURES_KEY) || "[]"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function keepPicture(key, id, html){
    var list = keptPictures().filter(function(p){ return p && p.key !== key; });
    list.push({ key: key, id: id, html: html });
    while (list.length > PICTURES_MAX) list.shift();
    // A full storage gives up the oldest pictures first, and the picture itself last.
    while (list.length) {
      try { sessionStorage.setItem(PICTURES_KEY, JSON.stringify(list)); return; } catch (e) { list.shift(); }
    }
  }
  function drawFigure(fig){
    // A picture the site drew at build is finished, and its colors are the page's tokens, so a
    // theme or the modal's colors reach it without a drawing; the modal still fits it to the sheet.
    if (fig.rbBuilt) {
      Promise.resolve().then(function(){ if (view && view.box === fig.rbBox) viewTake(); if (fig.rbDrawn) fig.rbDrawn(); });
      return;
    }
    // fig.rbBox, not a query, because while the dialog holds this figure the box is not
    // inside it: a theme change redraws into the box wherever it currently stands.
    var box = fig.rbBox, d = fig.rbDiagram, id = "rbchat-diagram-" + (++drawCount), cfg, source, key;
    // A moment later, still before the page paints: a restored answer's figure is made before
    // it stands in the log, and its colors and width are read where it stands.
    Promise.resolve().then(function(){
      // The colors are read where the box stands: in the modal, the terminal's; on the page, the page's.
      cfg = mermaidConfig(tokenReader(box.isConnected ? box : null));
      // The width the picture is drawn for: an answer's is the log's, which the chat gives it,
      // and a page's the figure's own.
      source = oriented(d.mermaid, (fig.rbWidth && fig.rbWidth()) || fig.clientWidth || window.innerWidth);
      key = JSON.stringify(cfg) + "\n" + source;
      var kept = keptPictures().filter(function(p){ return p && p.key === key && typeof p.html === "string" && typeof p.id === "string"; })[0];
      if (kept) {
        // Its ids are this page's own, so a picture drawn later here cannot take the same one.
        box.innerHTML = kept.html.split(kept.id).join(id);
        if (view && view.box === box) viewTake();
        if (fig.rbDrawn) fig.rbDrawn();
        return null;
      }
      return loadMermaid().then(function(m){
        m.initialize(cfg);
        return m.render(id, source);
      });
    }).then(function(out){
      if (!out) return;
      box.innerHTML = out.svg;
      var svg = box.querySelector("svg");
      (Array.isArray(d.nodes) ? d.nodes : []).forEach(function(n){
        if (!n || !n.id) return;
        var g = nodeElement(svg, n.node);
        if (!g) return;
        var a = document.createElementNS("http://www.w3.org/2000/svg", "a");
        // A page's own picture names the model page relative to itself, as a site writes every
        // link in its markup; an answer's picture takes the tag's.
        a.setAttribute("href", nodeHref(fig.getAttribute("data-model") || MODEL, n));
        a.setAttribute("aria-label", n.title || n.id);
        g.parentNode.insertBefore(a, g); a.appendChild(g);
      });
      // After the nodes are linked, so the selector below reaches only a linked node's label.
      var names = svg.querySelectorAll("a .nodeLabel > p");
      for (var ni = 0; ni < names.length; ni++) { try { wrapNodeName(names[ni]); } catch (e) {} }
      keepPicture(key, id, box.innerHTML);
      // A picture the dialog holds keeps the view the visitor zoomed it to across a redraw.
      if (view && view.box === box) viewTake();
      if (fig.rbDrawn) fig.rbDrawn();
    }).catch(function(){
      // Mermaid leaves what it could not finish in the body; it goes, and the source stands in.
      [id, "d" + id].forEach(function(x){ var left = document.getElementById(x); if (left && !box.contains(left)) left.parentNode.removeChild(left); });
      box.textContent = "";
      box.appendChild(el("p", "rbchat-diagram-failed", strings(langNow()).diagram.failed));
      box.appendChild(el("pre", null, d.mermaid));
    });
  }
  function labelFigure(fig){
    var s = strings(langNow()).diagram, b = fig.querySelector(".rbchat-diagram-full");
    var caption = diagramCaption(fig.rbDiagram, langNow());
    fig.querySelector("figcaption span").textContent = caption;
    var reading = fig.querySelector(".rbchat-diagram-reading");
    if (reading) reading.textContent = shapeWord(s.reading, fig.rbDiagram && fig.rbDiagram.shape);
    // The control always reads as Expand: what it opens is a dialog now, and the × that
    // closes it lives on the dialog, not here, so the button never toggles.
    b.textContent = "⤢"; b.setAttribute("aria-label", s.expand); b.setAttribute("data-tip", s.expand);
    // A figure that fell back to its source carries the failure sentence too, and a language
    // switch has to reach it exactly as it reaches the caption and the control.
    var failed = fig.querySelector(".rbchat-diagram-failed");
    if (failed) failed.textContent = s.failed;
    // The dialog holds this figure's box while it is open, so a language switch has to reach
    // its caption and its × exactly as it reaches the figure's own.
    if (modalHandle && modalFig === fig) {
      modalHandle.title(caption);
      // Each zoom control names the key that does the same, the way the modal's × names Escape.
      zoomIn.setAttribute("aria-label", s.zoomIn); zoomIn.setAttribute("data-tip", s.zoomIn + " · +");
      zoomOut.setAttribute("aria-label", s.zoomOut); zoomOut.setAttribute("data-tip", s.zoomOut + " · −");
      zoomFit.textContent = s.fit; zoomFit.setAttribute("aria-label", s.fitTip); zoomFit.setAttribute("data-tip", s.fitTip + " · 0");
    }
  }
  // The zoom controls, built once and carried in the one modal's head by whichever picture it holds.
  function zoomControls(){
    if (zoomBar) return zoomBar;
    zoomBar = el("div", "rbchat-modal-zoom");
    zoomOut = el("button", null, "\u2212"); zoomIn = el("button", null, "+"); zoomFit = el("button", "rbchat-modal-fit");
    [zoomOut, zoomIn, zoomFit].forEach(function(b){ b.type = "button"; zoomBar.appendChild(b); });
    zoomOut.addEventListener("click", function(){ viewStep(1 / STEP_ZOOM); });
    zoomIn.addEventListener("click", function(){ viewStep(STEP_ZOOM); });
    zoomFit.addEventListener("click", function(){ viewFit(); });
    return zoomBar;
  }
  // A picture's full screen is the family's one modal, fetched from beside this file the first
  // time anything opens, like Mermaid. Its box moves in and back, the zoom rides in its head, and
  // a page's own picture is drawn again in the terminal's colors while it is there and in the
  // page's once it is back, so it never sits in the modal in colors that fight it.
  var modalLoad = null;
  function loadModal(){
    window.rbModalWords = window.rbModalWords || { en: strings("en").modalClose, de: strings("de").modalClose };
    // A modal another script has fetched, stage.js on the model page, is used once its
    // stylesheet has arrived too, so a picture is fitted to the modal it will be seen in.
    if (window.rbModal) return window.rbModal.ready.then(function(){ return window.rbModal; });
    if (!modalLoad) modalLoad = new Promise(function(resolve, reject){
      var sc = document.createElement("script"); sc.src = new URL("modal.js", tag.src).href;
      sc.onload = function(){ if (window.rbModal) window.rbModal.ready.then(function(){ resolve(window.rbModal); }); else reject(new Error("modal.js set no rbModal")); };
      // A failed fetch is not remembered: the next open tries again.
      sc.onerror = function(){ modalLoad = null; reject(new Error("modal.js did not load")); };
      document.head.appendChild(sc);
    });
    return modalLoad;
  }
  // One Expand at a time: a second press while the modal is still on its way is the same one.
  var figPending = false;
  function expandFigure(fig){
    if (figPending || modalFig) return;
    figPending = true;
    loadModal().then(function(M){
      figPending = false;
      var own = !(fig.closest && fig.closest(".rbchat"));
      modalFig = fig;
      modalHandle = M.open({ key: "diagram", kind: "diagram", title: diagramCaption(fig.rbDiagram, langNow()), body: fig.rbBox, controls: zoomControls(), opener: document.activeElement,
        onClose: function(){
          var was = modalFig; modalFig = null; modalHandle = null; viewDrop();
          if (was) { if (own && !was.rbWaiting) drawFigure(was); labelFigure(was); }
        } });
      if (!modalHandle.el.rbZoomKeys) { modalHandle.el.rbZoomKeys = true; modalHandle.el.addEventListener("keydown", function(ev){ if (modalFig) viewKey(ev); }); }
      labelFigure(fig);
      // A page's picture not yet scrolled to is drawn now; a page's picture already drawn is
      // drawn again, now in the modal's colors; an answer's picture is already in them.
      if (fig.rbWaiting) { fig.rbWaiting = false; drawFigure(fig); }
      else if (own) drawFigure(fig);
      viewOpen(fig.rbBox);
    }, function(){ figPending = false; });
  }

  // ─── The zoom ─────────────────────────────────────────────────────────────────────────────
  // In the dialog a picture is looked at, not read in passing, so it behaves as a viewer does:
  // it opens fitted to the sheet, Ctrl or ⌘ with the wheel and a trackpad's pinch zoom at the
  // pointer, two fingers pinch on a phone, a drag or the plain wheel moves it, and −, + and Fit
  // in the head, or the keys -, + and 0, do the same from the keyboard. The picture is moved by
  // a transform on its own SVG, never redrawn, so the links Mermaid drew stay the same elements;
  // a drag that has moved is a pan and swallows the click it ends in, and a press that has not
  // still follows the node's link. Nothing is kept once the dialog closes: the box goes back to
  // the page as it came, scrolling as it did.
  var view = null, STEP_ZOOM = 1.25, MOVED = 4;
  function viewOpen(box){
    view = { box: box, k: 1, x: 0, y: 0, fit: 1, moved: false, pointers: {}, pinch: null, touched: false };
    box.classList.add("rbchat-zoom");
    box.addEventListener("wheel", viewWheel, { passive: false });
    box.addEventListener("pointerdown", viewDown);
    box.addEventListener("pointermove", viewMove);
    box.addEventListener("pointerup", viewUp);
    box.addEventListener("pointercancel", viewUp);
    box.addEventListener("click", viewClick, true);
    box.addEventListener("dragstart", viewNoDrag);
    window.addEventListener("resize", viewResize);
    viewTake();
  }
  function viewDrop(){
    if (!view) return;
    var box = view.box, svg = box.querySelector("svg");
    box.classList.remove("rbchat-zoom", "rbchat-panning");
    box.removeEventListener("wheel", viewWheel, { passive: false });
    box.removeEventListener("pointerdown", viewDown);
    box.removeEventListener("pointermove", viewMove);
    box.removeEventListener("pointerup", viewUp);
    box.removeEventListener("pointercancel", viewUp);
    box.removeEventListener("click", viewClick, true);
    box.removeEventListener("dragstart", viewNoDrag);
    window.removeEventListener("resize", viewResize);
    if (svg) { svg.style.transform = ""; svg.style.transformOrigin = ""; svg.style.width = ""; svg.style.height = ""; }
    view = null;
  }
  // The picture's own size, from the box Mermaid gave it, which a transform leaves alone.
  function viewSize(svg){
    var vb = svg.viewBox && svg.viewBox.baseVal;
    if (vb && vb.width && vb.height) return { w: vb.width, h: vb.height };
    var r = svg.getBoundingClientRect(), k = view ? view.k : 1;
    return { w: r.width / k || 1, h: r.height / k || 1 };
  }
  // A fresh SVG, after Expand or after the theme drew the picture again: fitted the first time,
  // and at the view the visitor left it at every time after.
  function viewTake(){
    if (!view) return;
    var svg = view.box.querySelector("svg");
    if (!svg) return;
    var size = viewSize(svg);
    svg.style.width = size.w + "px"; svg.style.height = size.h + "px";
    svg.style.transformOrigin = "0 0";
    if (view.touched) viewApply(); else viewFit();
  }
  function viewFit(){
    if (!view) return;
    var svg = view.box.querySelector("svg");
    if (!svg) return;
    var size = viewSize(svg), bw = view.box.clientWidth, bh = view.box.clientHeight;
    // Fitted, but never blown up past twice its size: a small picture filling a whole screen
    // reads as a mistake, not as a view.
    view.fit = Math.min(bw / size.w, bh / size.h, 2) || 1;
    view.k = view.fit;
    view.x = (bw - size.w * view.k) / 2; view.y = (bh - size.h * view.k) / 2;
    view.touched = false;
    viewApply();
  }
  function viewApply(){
    var svg = view && view.box.querySelector("svg");
    if (svg) svg.style.transform = "translate(" + view.x + "px," + view.y + "px) scale(" + view.k + ")";
  }
  // Zoom by `f` about the point (px, py) of the box, which stays where it is on the screen. The
  // range runs from a quarter of the fitted size to eight times the picture's own.
  function viewZoom(f, px, py){
    var k = Math.max(view.fit / 4, Math.min(8, view.k * f));
    view.x = px - (px - view.x) * (k / view.k);
    view.y = py - (py - view.y) * (k / view.k);
    view.k = k; view.touched = true;
    viewApply();
  }
  function viewStep(f){ if (view) viewZoom(f, view.box.clientWidth / 2, view.box.clientHeight / 2); }
  function viewPan(dx, dy){ view.x += dx; view.y += dy; view.touched = true; viewApply(); }
  function viewAt(ev){ var r = view.box.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
  function viewWheel(ev){
    ev.preventDefault();
    var unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? view.box.clientHeight : 1;
    // A trackpad's pinch arrives as a wheel with ctrlKey set, so one branch serves both.
    if (ev.ctrlKey || ev.metaKey) { var at = viewAt(ev); viewZoom(Math.exp(-ev.deltaY * unit * 0.01), at.x, at.y); }
    else viewPan(-ev.deltaX * unit, -ev.deltaY * unit);
  }
  function viewDown(ev){
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    view.pointers[ev.pointerId] = viewAt(ev);
    var ids = Object.keys(view.pointers);
    if (ids.length === 1) { view.moved = false; view.start = viewAt(ev); }
    if (ids.length === 2) {
      var a = view.pointers[ids[0]], b = view.pointers[ids[1]];
      view.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      view.moved = true;
    }
  }
  function viewMove(ev){
    var was = view.pointers[ev.pointerId];
    if (!was) return;
    var now = viewAt(ev), ids = Object.keys(view.pointers);
    view.pointers[ev.pointerId] = now;
    if (ids.length === 1) {
      if (!view.moved && Math.hypot(now.x - view.start.x, now.y - view.start.y) < MOVED) return;
      // Captured only once it is a drag: captured on the press, the click a still press ends
      // in would land on the box and not on the node's link.
      if (!view.moved) { view.moved = true; view.box.classList.add("rbchat-panning"); try { view.box.setPointerCapture(ev.pointerId); } catch (e) {} }
      viewPan(now.x - was.x, now.y - was.y);
    } else if (ids.length === 2 && view.pinch) {
      var a = view.pointers[ids[0]], b = view.pointers[ids[1]];
      var d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      viewPan(mx - view.pinch.x, my - view.pinch.y);
      viewZoom(d / view.pinch.d, mx, my);
      view.pinch = { d: d, x: mx, y: my };
    }
  }
  function viewUp(ev){
    if (!view.pointers[ev.pointerId]) return;
    delete view.pointers[ev.pointerId];
    if (Object.keys(view.pointers).length < 2) view.pinch = null;
    if (!Object.keys(view.pointers).length) view.box.classList.remove("rbchat-panning");
  }
  function viewClick(ev){ if (view.moved) { ev.preventDefault(); ev.stopPropagation(); view.moved = false; } }
  function viewNoDrag(ev){ ev.preventDefault(); }
  // A sheet that changes size, a phone turned or a window dragged, fits again unless the
  // visitor has zoomed, whose view is theirs.
  function viewResize(){ if (view && !view.touched) viewFit(); }
  function viewKey(ev){
    if (!view || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    var k = ev.key, PAN = 60;
    if (k === "+" || k === "=") viewStep(STEP_ZOOM);
    else if (k === "-" || k === "_") viewStep(1 / STEP_ZOOM);
    else if (k === "0") viewFit();
    else if (k === "ArrowLeft") viewPan(PAN, 0);
    else if (k === "ArrowRight") viewPan(-PAN, 0);
    else if (k === "ArrowUp") viewPan(0, PAN);
    else if (k === "ArrowDown") viewPan(0, -PAN);
    else return;
    ev.preventDefault();
  }
  // A click anywhere on a picture's box but a node's link opens it to be read; the link keeps
  // its own meaning, and a picture already open has nothing more to open.
  function openOnClick(fig){
    fig.rbBox.addEventListener("click", function(ev){
      if (modalFig === fig || (ev.target.closest && ev.target.closest("a"))) return;
      expandFigure(fig);
    });
  }
  function figure(d, fit){
    var fig = el("figure", "rbchat-diagram"), cap = el("figcaption"), full = el("button", "rbchat-diagram-full");
    full.type = "button"; full.addEventListener("click", function(){ expandFigure(fig); });
    cap.appendChild(el("span")); cap.appendChild(full);
    fig.rbBox = el("div", "rbchat-diagram-box");
    fig.appendChild(cap); fig.appendChild(fig.rbBox);
    // Under a picture whose shape needs reading, one line says how; it is the widget's sentence,
    // in the page's language, never the host's or the model's.
    if (shapeWord(strings(langNow()).diagram.reading, d.shape)) fig.appendChild(el("p", "rbchat-diagram-reading"));
    // Several pictures under one answer are each fitted to the log, so the whole answer is seen
    // at once, and a click anywhere but a node's link opens one to be read, as a page's does.
    if (fit) {
      fig.classList.add("rbchat-diagram-fit");
      openOnClick(fig);
    }
    fig.rbDiagram = d;
    // An answer's picture is drawn for the log's width, and once drawn, a picture above the
    // kept place has taken its height, so the place is found again.
    fig.rbWidth = function(){ return log && log.clientWidth; };
    fig.rbDrawn = settle;
    figures = figures.filter(function(f){ return document.documentElement.contains(f); });
    figures.push(fig);
    labelFigure(fig); drawFigure(fig);
    return fig;
  }
  // An answer's pictures, in the order the host drew them, each after the one before.
  function placeFigures(ans, after, list){
    var at = after, fit = list.length > 1;
    list.forEach(function(d){ var f = figure(d, fit); ans.insertBefore(f, at.nextSibling); at = f; });
    return at;
  }
  if (window.MutationObserver) new MutationObserver(function(){
    figures = figures.filter(function(f){ return document.documentElement.contains(f); });
    figures.forEach(function(f){ if (!f.rbWaiting) drawFigure(f); });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  function el(tagName, cls, text){ var e = document.createElement(tagName); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  // A picture a page was built with: a figure carrying `data-diagram`, its caption, its Expand
  // and an empty box, with the picture itself as JSON in a script inside it, the shape an
  // answer's picture arrives in. The page is written when its site builds, from the commit it
  // pins, so the picture changes when the model does and never between two visits. It is drawn
  // once it is near the screen, so a page whose picture sits below the fold fetches Mermaid
  // only for a visitor who scrolls to it or opens it.
  function hydrate(){
    var found = document.querySelectorAll("figure[data-diagram]");
    for (var i = 0; i < found.length; i++) (function(fig){
      if (fig.rbDiagram) return;
      var src = fig.querySelector('script[type="application/json"]'), d = null;
      try { d = JSON.parse(src.textContent); } catch (e) { return; }
      if (!d || typeof d.mermaid !== "string") return;
      fig.rbDiagram = d;
      fig.rbBox = fig.querySelector(".rbchat-diagram-box");
      var full = fig.querySelector(".rbchat-diagram-full");
      if (!fig.rbBox || !full) return;
      full.addEventListener("click", function(){ expandFigure(fig); });
      // On the page the picture is a preview, fitted to the column however wide the flow is,
      // so a click anywhere on it but a node's link opens it to be read, as Expand does.
      fig.classList.add("rbchat-diagram-fit");
      openOnClick(fig);
      figures.push(fig);
      labelFigure(fig);
      // Drawn when the site built, links and all: nothing to fetch and nothing to wait for.
      if (fig.rbBox.hasAttribute("data-drawn") && fig.rbBox.querySelector("svg")) { fig.rbBuilt = true; return; }
      fig.rbWaiting = true;
      function draw(){ if (fig.rbWaiting) { fig.rbWaiting = false; drawFigure(fig); } }
      if (!window.IntersectionObserver) { draw(); return; }
      var near = new IntersectionObserver(function(seen){
        if (seen.some(function(x){ return x.isIntersecting; })) { near.disconnect(); draw(); }
      }, { rootMargin: "400px 0px" });
      near.observe(fig);
    })(found[i]);
  }
  // A page's figures are in the markup, so they are there once the document is parsed.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hydrate); else hydrate();
  // The language a page switches to reaches its figures here, since a page without a chat has
  // no panel whose relabel would.
  if (window.MutationObserver) new MutationObserver(function(){ figures.forEach(labelFigure); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  // An embedded page is the graph itself, inside the dialog on another page: it opens no graph
  // and takes no chat of its own.
  var EMBEDDED = document.documentElement.hasAttribute("data-embed");

  // ─── The graph ────────────────────────────────────────────────────────────────────────────
  // A link into the model opens the model page's own stage over the page, in the family's one
  // modal, rather than taking the visitor to the page, on every page that loads this file,
  // whether or not it offers the chat. The page is embedded: it draws its stage alone and keeps
  // its history to itself (see stage.js), so the chat page's address and its Back stay the
  // visitor's. The frame is made on the first open and lives in a keyed modal for the page's
  // life, since moving an iframe reloads it; a later open moves its focus by message, queued
  // until the frame says it is ready.
  var graph = null, graphFrame = null, graphHandle = null, graphReady = false, graphQueue = null;
  // The name of the place the graph stands on, which titles the modal in the page's language,
  // and the wait for a frame that never says it is ready: its model file failed, or is empty.
  var graphName = "", graphWait = null, GRAPH_WAIT = 6000, graphFailed = null;
  function setGraphTitle(name){
    graphName = name;
    var head = strings(langNow()).graph.head.replace("{title}", name);
    if (graphHandle) graphHandle.title(head);
    if (graphFrame) graphFrame.setAttribute("title", head);
  }
  function graphFails(on){
    if (graphFailed) { graphFailed.parentNode.removeChild(graphFailed); graphFailed = null; }
    if (!on) return;
    graphFailed = el("p", "rbchat-graph-failed", strings(langNow()).graph.failed);
    graph.insertBefore(graphFailed, graphFrame);
    // The next open tries again from the start.
    graphFrame.removeAttribute("src"); graphReady = false;
  }
  function ensureGraph(){
    if (graph) return;
    // What the modal holds for the graph: the frame, and the line that says when it failed.
    graph = el("div", "rbchat-graph");
    graphFrame = el("iframe", "rbchat-graph-frame");
    // A frame that has loaded and still not said it is ready never will: its model file failed.
    graphFrame.addEventListener("load", function(){
      clearTimeout(graphWait);
      if (graphFrame.getAttribute("src") && !graphReady) graphWait = setTimeout(function(){ if (!graphReady) graphFails(true); }, GRAPH_WAIT);
    });
    graph.appendChild(graphFrame);
  }
  function lookOf(){ return { type: "rb-graph-look", theme: document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark", lang: langNow() }; }
  function tellGraph(m){ if (graphFrame && graphFrame.contentWindow) graphFrame.contentWindow.postMessage(m, location.origin); }
  // Where the modal cannot be fetched, the link leads where it points, to the whole model page.
  function openGraph(id, title, opener){
    loadModal().then(function(M){
      ensureGraph();
      graphHandle = M.open({ key: "graph", kind: "graph", title: "", body: graph, opener: opener || document.activeElement });
      setGraphTitle(title || id);
      graphFails(false);
      if (!graphFrame.getAttribute("src")) { graphReady = false; graphFrame.setAttribute("src", graphHref(MODEL, id)); }
      else if (graphReady) tellGraph({ type: "rb-graph-focus", id: id });
      else graphQueue = id;
      // The keyboard goes into the graph on every open, so its keys walk the trail at once.
      if (graphReady) graphFrame.focus();
    }, function(){ location.href = link(MODEL, id); });
  }
  function graphOpen(){ return !!(graphHandle && graphHandle.showing()); }
  window.addEventListener("message", function(ev){
    if (ev.origin !== location.origin || !graphFrame || ev.source !== graphFrame.contentWindow || !ev.data) return;
    if (ev.data.type === "rb-graph-ready") {
      graphReady = true; clearTimeout(graphWait); graphFails(false); tellGraph(lookOf());
      if (graphQueue) { tellGraph({ type: "rb-graph-focus", id: graphQueue }); graphQueue = null; }
      if (graphOpen()) graphFrame.focus();
    }
    else if (ev.data.type === "rb-graph-at" && typeof ev.data.title === "string" && ev.data.title) setGraphTitle(ev.data.title);
    else if (ev.data.type === "rb-graph-close" && graphOpen()) graphHandle.close();
  });
  if (window.MutationObserver) new MutationObserver(function(){ if (graphReady) tellGraph(lookOf()); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "lang"] });
  // Every link into the graph on this page opens it here, the one rule for every page: a name,
  // a cite title or a node in the chat, a card on the timeline, a node in a page's own picture or
  // in any picture opened full screen, a link in a post. Any address that resolves to the model
  // page with its stage expanded counts, whatever page wrote it and however relative; the model
  // page itself moves its own stage instead, and a modified click (a new tab) is the browser's.
  // An embedded page is the graph itself, and opens none.
  document.addEventListener("click", function(ev){
    if (EMBEDDED || ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target && ev.target.closest && ev.target.closest("a[href], a[*|href]");
    if (!a) return;
    var id = graphTarget(a.getAttribute("href") || a.getAttribute("xlink:href"), MODEL, document.baseURI);
    if (!id) return;
    ev.preventDefault();
    openGraph(id, a.getAttribute("aria-label") || a.textContent.trim(), a);
  });
  // The graph's words follow the page's language on a page with no chat to relabel them.
  function relabelGraph(){
    if (!graph) return;
    if (graphName) setGraphTitle(graphName);
    if (graphFailed) graphFailed.textContent = strings(langNow()).graph.failed;
  }
  if (window.MutationObserver) new MutationObserver(relabelGraph).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  // The panel's empty frame theme boot asked chat.css to paint, for a page arriving with the
  // chat open: taken off once the panel stands over it, or once there is no panel to stand.
  function unwait(){
    var r = document.documentElement;
    r.removeAttribute("data-chat-waiting"); r.style.removeProperty("--rbchat-kept-w"); r.style.removeProperty("--rbchat-kept-h");
  }
  if (!tag.dataset.chat || EMBEDDED) { unwait(); return; }

  var ENDPOINT = tag.dataset.chat, QUESTIONS = tag.dataset.questions || null, QUESTIONS_DE = tag.dataset.questionsDe || null;
  var ICON = iconOf(document);
  var HOST = (function(){ try { return new URL(ENDPOINT).host; } catch (e) { return ENDPOINT; } })();
  // The site's sign-in, off the tag, or null where the tag names no identity service, and then
  // nothing below reads or writes a token. The login sends every reader back to the site's root,
  // the one redirect the site's client registers, so `came` is read wherever the widget runs.
  var SITE = tag.dataset.issuer ? { issuer: tag.dataset.issuer.replace(/\/+$/, ""), client: tag.dataset.client || "", org: tag.dataset.org || "", project: tag.dataset.project || "", prefix: tag.dataset.rolePrefix || "" } : null;
  var REDIRECT = location.origin + "/", SIGNIN_KEY = "chat-signin", PKCE_KEY = "chat-pkce", CHOICE_KEY = "chat-choice";
  // The host's own address, for a signed-in message above `low`; null where the tag names none or
  // names something that is not an absolute https URL, and then every message goes to ENDPOINT.
  var DIRECT = (function(d){ try { return d && new URL(d).protocol === "https:" ? d : null; } catch (e) { return null; } })(tag.dataset.chatDirect);
  var SIGN_WORDS = ["/login", "/logout", "/model", "/effort"];
  // A reader who cancels at the login, or whom it refuses, comes back with `error` and the state
  // instead of a code, and that is a return too.
  var came = !SITE ? null : param(location.search, "error") !== null ? { error: param(location.search, "error"), state: param(location.search, "state") } : returnOf(location.href);

  // `messages` is what the server sees, `turns` the same exchange as the panel shows it: an
  // answer's cites are the widget's to draw and are no part of a message.
  var linkAsk = null, askEl = null;
  var messages = [], turns = [], busy = false, panel = null, log = null, input = null, notice = null, title = null, closeBtn = null, grip = null, newBtn = null, keysEl = null, say = null;
  // The place a restore owes the visitor, held until the log is shown and every picture above it
  // has drawn, and let go the moment the visitor scrolls, sends or starts afresh: from then on
  // the log is where they put it, and place() reads it there.
  var reading = null;
  function settle(){ if (reading && panel && !panel.hidden && !placed(log, reading)) reading = null; }
  // The questions the site's own model is built to answer, offered as a way into an empty
  // conversation. `qList` is null until `questions` has resolved once, `qFetch` is that one
  // fetch, kept so a second open before it lands does not ask twice, and `qBox` is the chip
  // container currently in the log, if any, and `qNext` whether it follows an answer rather than
  // opening an empty conversation, which is all that tells its two names apart. `qPicked` is
  // the titles that box offers, kept with the conversation while it stands.
  var qList = null, qFetch = null, qBox = null, qPicked = null, qNext = false, qFacts = { processes: [], counts: {}, names: {}, versions: null };
  var Q_TIMEOUT = 8000;

  // The titles to offer, read from the site's own parsed model rather than asked of the chat
  // host — nothing here may reach it before a visitor presses send. `data-questions` names a
  // same-origin path to that model, the same shape `card.js` and `stage.js` already read,
  // `{ entities: [{ id, type, name, … }, …] }`; a title is the `name` of every entity whose
  // `type` is `question`, kept only where it is a non-empty string no longer than the box's own
  // limit — a title too long to send is not a title to offer. A tag without `data-questions`
  // asks nothing and resolves to an empty list on its own. Asked once for the page's life, kept
  // whatever the answer was — an empty list on a 404, a timeout, a body that is not JSON, or a
  // model with no question in it. A caller gets the same list back whether it asked first or
  // fifth; `cb` runs once resolved, and a second call while the first is still in flight shares
  // its one fetch rather than starting another. The timeout covers the whole response, headers
  // and body: the timer is cleared only once the JSON has been read, so a body that stalls after
  // its headers arrive is still aborted, and reading it is what raises the abort as a rejection.
  // What that read gave is kept for the tab, beside the conversation: the next page draws the
  // intro whole before it paints, where waiting for the file again drew it a moment late and
  // pushed the conversation down. Only what the chat takes from the file, never the file.
  var FACTS_KEY = "chat-facts";
  function questions(cb){
    if (!QUESTIONS) { qList = qList || []; cb([]); return; }
    if (!qList) keptList();
    if (qList) { cb(qList); return; }
    if (!qFetch) {
      var ac = new AbortController();
      var timer = setTimeout(function(){ ac.abort(); }, Q_TIMEOUT);
      var modelRead = fetch(QUESTIONS, { signal: ac.signal })
        .then(function(r){
          if (!r.ok) { clearTimeout(timer); return []; }
          return r.json().then(function(j){
            clearTimeout(timer);
            var entities = j && Array.isArray(j.entities) ? j.entities : [];
            var types = {}, rests = {};
            entities.forEach(function(e){ if (e && typeof e.id === "string") types[e.id] = e.type; });
            // The same read gives the Try rows their facts: the processes by name, and how many
            // of each type the model holds, so a row never names what the model does not have.
            var counts = {};
            entities.forEach(function(e){ if (e && typeof e.type === "string") counts[e.type] = (counts[e.type] || 0) + 1; });
            // What a row asks about by name, and the rank the model gives each kind of question.
            var names = {}, ranks = Object.create(null);
            entities.forEach(function(e){
              if (!e || typeof e.name !== "string" || !e.name.length) return;
              if (NAMED_TYPES.indexOf(e.type) >= 0 && e.name.length <= NAME_LIMIT) (names[e.type] = names[e.type] || []).push(e.name);
              if (e.type === "question-kind" && e.fields && e.fields.rank != null && String(e.fields.rank).trim() !== "" && isFinite(Number(e.fields.rank))) ranks[e.name] = Number(e.fields.rank);
            });
            names.system = connected(entities, j && j.edges);
            qFacts = { processes: entities.filter(function(e){ return e && e.type === "process" && typeof e.name === "string" && e.name.length > 0; }).map(function(e){ return e.name; }), counts: counts, names: names, versions: versionsOf(j) };
            (j && Array.isArray(j.edges) ? j.edges : []).forEach(function(g){
              if (!g || types[g.from] !== "question" || typeof g.via !== "string" || g.via.indexOf("Rests on.") !== 0) return;
              (rests[g.from] = rests[g.from] || []).push({ id: g.to, type: types[g.to] || null });
            });
            return entities
              .filter(function(e){ return e && e.type === "question" && typeof e.name === "string" && e.name.length > 0; })
              .map(function(e){ var kind = e.fields && typeof e.fields.kind === "string" ? e.fields.kind : null; return { id: typeof e.id === "string" ? e.id : null, title: e.name, kind: kind, rank: kind !== null && kind in ranks ? ranks[kind] : null, rests: rests[e.id] || [] }; })
              .filter(function(q){ return q.title.length <= LIMIT; });
          });
        })
        .catch(function(){ clearTimeout(timer); return []; });
      qFetch = Promise.all([modelRead, germanRead()]).then(function(r){
        var de = r[1];
        // A German file named and read as empty failed — a 404 or a timeout, since a site's build
        // writes German for every title — so the list made without it is not kept for the tab,
        // and the next page reads both files again rather than offering English for good.
        germanMissed = !!QUESTIONS_DE && !Object.keys(de).length;
        return r[0].map(function(q){ return de[q.title] ? Object.assign({}, q, { de: de[q.title] }) : q; });
      });
    }
    qFetch.then(function(list){
      if (!qList) {
        qList = list;
        if (list.length && !germanMissed) { try { sessionStorage.setItem(FACTS_KEY, JSON.stringify({ from: keptFrom(), list: list, facts: qFacts })); } catch (e) {} }
      }
      cb(qList);
    });
  }
  // Which files a kept list was made from: the model's and, where the tag names one, the German.
  var germanMissed = false;
  function keptFrom(){ return QUESTIONS + (QUESTIONS_DE ? " " + QUESTIONS_DE : ""); }
  // The list the tab kept from an earlier page, taken where it was made from the same files, so a
  // conversation drawn again before the files are read offers its chips in the page's language.
  function keptList(){
    try {
      var kept = JSON.parse(sessionStorage.getItem(FACTS_KEY) || "null");
      if (kept && kept.from === keptFrom() && Array.isArray(kept.list) && kept.facts) { qList = kept.list; qFacts = kept.facts; }
    } catch (e) {}
    return qList;
  }
  // The site's reviewed German for its question titles, read with the model under the same
  // timeout and the same rules: a tag without `data-questions-de`, a 404, a timeout or a body that
  // is not the file's shape gives no German, and the titles are offered as they stand. A German
  // text longer than the box's limit is not one a chip may send, so its title is offered instead.
  function germanRead(){
    if (!QUESTIONS_DE) return Promise.resolve({});
    var ac = new AbortController();
    var timer = setTimeout(function(){ ac.abort(); }, Q_TIMEOUT);
    return fetch(QUESTIONS_DE, { signal: ac.signal })
      .then(function(r){
        if (!r.ok) { clearTimeout(timer); return {}; }
        return r.json().then(function(j){
          clearTimeout(timer);
          var map = {};
          (Array.isArray(j) ? j : []).forEach(function(x){
            if (x && typeof x.title === "string" && typeof x.text === "string" && x.text && x.text.length <= LIMIT) map[x.title] = x.text;
          });
          return map;
        });
      })
      .catch(function(){ clearTimeout(timer); return {}; });
  }
  // A question as this page offers it now, from the list the widget holds or the tab kept.
  function asOffered(title, lang){ return sayIn(qList || keptList() || [], typeof lang === "string" ? lang : langNow(), title); }
  // The Try rows' facts, from the one fetch questions() makes: a tag without data-questions, or
  // a read that failed, leaves them empty, and the rows fall back to the meta-model alone.
  function facts(cb){ questions(function(){ cb(qFacts); }); }

  // The questions are entities too, and an answer names them by title: asked what the model
  // answers, the chat reads the titles off its prompt rather than a tool, so no answer's names
  // carry them and they would stand unlinked. The same list the chips come from links them, a
  // title only where its entity has an id, and only once the panel is shown, because that is
  // when this read is allowed to happen at all: an answer drawn into a closed panel, a restored
  // one, waits in `unlinked` until the panel opens.
  var unlinked = [];
  function linkQuestions(body){
    if (!QUESTIONS) return;
    if (!panel || panel.hidden) { unlinked.push(body); return; }
    questions(function(list){ nameLinks(body, list.filter(function(q){ return q.id; }), MODEL, document); });
  }
  function linkWaiting(){ unlinked.splice(0).forEach(linkQuestions); }

  // A numbered menu, as the tooling prints one: each row a button that sends its question, the
  // number in the accent because a number is what the command line picks it by, and under a Try
  // row, dim, what comes back. The rows drawn last are the ones a bare number picks. A row of
  // the model or effort menu carries `{ pick, current }` third: a click picks it rather than
  // sending its words, and the current one is ticked.
  function menu(parent, items, start){
    var m = el("div", "rbchat-menu");
    items.forEach(function(it, i){
      var b = el("button", "rbchat-row"); b.type = "button";
      b.appendChild(el("span", "rbchat-n", String(start + i + 1)));
      var q = el("span", "rbchat-q", it[0]);
      if (it[2] && it[2].current) { b.setAttribute("aria-current", "true"); q.appendChild(el("span", "rbchat-tick", " \u2713")); }
      b.appendChild(q);
      if (it[1]) b.appendChild(el("span", "rbchat-g", it[1]));
      b.addEventListener("click", function(){ if (it[2]) { it[2].pick(); input.focus(); return; } input.value = it[0]; send(); });
      m.appendChild(b);
    });
    parent.appendChild(m);
    return m;
  }
  // The keys and commands, printed into the log as the tooling prints its usage.
  function help(){
    var s = strings(langNow()), box = el("div", "rbchat-help");
    s.help.forEach(function(r){
      // The pick line only while a menu stands: with none, there is nothing a number picks.
      if (r[0] === "{range}" && !menuRows.length) return;
      // The sign-in's four words only where the tag names an identity service.
      if (!SITE && SIGN_WORDS.indexOf(r[0]) >= 0) return;
      var line = el("p");
      line.appendChild(el("span", "rbchat-help-k", r[0].replace("{range}", rangeOf(menuRows.length))));
      line.appendChild(el("span", "rbchat-help-d", r[1]));
      box.appendChild(line);
    });
    log.appendChild(box); log.scrollTop = log.scrollHeight;
  }
  // An answer's head and commit lines, written from the strings, and written again by relabel()
  // when the language switches; a restored answer has no timing, so its line names the commit alone.
  // ─── The answer check ─────────────────────────────────────────────────────────────────────
  // A deployment that checks its answers sends a `verdict` before `done`: each claim's place in
  // the answer's Markdown, its verdict and that verdict's probability, and the probability above
  // which a claim is to be marked, null where none is measured. A claim the evidence does not
  // carry is marked once the answer is drawn. It is found by its text as the answer renders it,
  // since the offsets count Markdown the body no longer shows: the claim's Markdown is rendered
  // the way md() renders a line, and its text is looked for in the body's, every claim in order
  // so a sentence the answer repeats is found where the claim stands. One that cannot be found is
  // not marked at all, since a mark on the wrong sentence is worse than none. A claim that runs
  // through a code span or a link is marked in each of its pieces.
  var MARKED = { partial: "part", contradicted: "off", absent: "off", unnamed: "off", withheld: "off", unsourced: "off" };
  var NOTE_OF = { partial: "partial", contradicted: "contradicted", absent: "absent", unnamed: "absent", withheld: "absent", unsourced: "unsourced" };
  var collapse = function(s){ return s.replace(/\s+/g, " ").trim(); };
  function renderedText(markdown){
    var box = document.createElement("div"), line = once(markdown).replace(/^\s*(?:[-*•]|\d+\.)\s+/, "");
    box.innerHTML = /^\s*\|/.test(line) ? cells(line).join(" ") : inline(esc(line));
    return collapse(box.textContent);
  }
  function textOf(root){
    var walk = root.ownerDocument.createTreeWalker(root, 4), n, str = "", map = [], space = true;
    while ((n = walk.nextNode())) for (var i = 0; i < n.data.length; i++) {
      var ch = n.data.charAt(i), sp = /\s/.test(ch);
      if (sp && space) continue;
      str += sp ? " " : ch; map.push([n, i]); space = sp;
    }
    return { str: str, map: map };
  }
  var described = 0;
  function markClaims(root, text, verdict){
    if (!verdict || !Array.isArray(verdict.claims) || typeof verdict.threshold !== "number") return 0;
    var count = 0, from = 0, notes = root.parentNode;
    verdict.claims.forEach(function(c){
      if (typeof c.from !== "number" || typeof c.to !== "number") return;
      var want = renderedText(text.slice(c.from, c.to)), t = textOf(root), at = want ? t.str.indexOf(want, from) : -1;
      if (at < 0) return;
      from = at + want.length;
      var kind = MARKED[c.verdict];
      if (!kind || typeof c.p !== "number" || c.p < verdict.threshold) return;
      var pieces = [], i = at, end = at + want.length;
      while (i < end) {
        var node = t.map[i][0], j = i;
        while (j + 1 < end && t.map[j + 1][0] === node) j++;
        var r = root.ownerDocument.createRange(); r.setStart(node, t.map[i][1]); r.setEnd(node, t.map[j][1] + 1);
        var span = root.ownerDocument.createElement("span"); span.className = "rbchat-claim " + kind;
        try { r.surroundContents(span); pieces.push(span); } catch (e) {}
        i = j + 1;
      }
      if (!pieces.length) return;
      noted(pieces, NOTE_OF[c.verdict], notes);
      count++;
    });
    return count;
  }
  // The line under a marked answer, and the words of every claim's note, read from the strings
  // when they are shown, so a language switch rewords them as it rewords the panel's other words.
  function claimWords(key){ return strings(langNow()).claim[key]; }
  function claimLine(n){ var s = strings(langNow()), l = el("p", "rbchat-claims", n === 1 ? s.claimsOne : s.claimsMany.replace("{n}", n)); l.setAttribute("data-n", n); return l; }
  function reclaim(){
    if (!log) return;
    var s = strings(langNow());
    log.querySelectorAll(".rbchat-claims").forEach(function(l){ var n = +l.getAttribute("data-n"); l.textContent = n === 1 ? s.claimsOne : s.claimsMany.replace("{n}", n); });
    log.querySelectorAll(".rbchat-claim-words").forEach(function(d){ var w = claimWords(d.getAttribute("data-claim")); d.textContent = w[0] + " " + w[1]; });
    if (note && noteAt) fillNote(noteAt.getAttribute("data-claim"));
  }
  if (window.MutationObserver) new MutationObserver(reclaim).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  // The note is the panel's own, the box chat.css draws under the header's buttons: one element
  // for the panel, hung under the claim, its last line, so it never covers the words it explains,
  // and kept within the panel's sides. It is
  // seen and never read: each claim is described to a screen reader by words of its own, kept
  // beside the answer, since one shared box would describe whichever claim it last showed. It
  // shows on hover and on keyboard focus, never on a tap's focus, and not where there is no
  // hover. A scroll under it moves it with its claim, as the family's tooltip does, and it goes
  // once its claim has left the log.
  var note = null, noteAt = null;
  function fillNote(key){ var w = claimWords(key); note.firstChild.textContent = w[0]; note.lastChild.textContent = w[1]; }
  function placeNote(){
    if (!note || !noteAt) return;
    var pieces = noteAt.rbPieces || [noteAt], last = pieces[pieces.length - 1], rects = last.getClientRects(), r = rects[rects.length - 1] || last.getBoundingClientRect();
    var first = pieces[0].getClientRects()[0] || r, home = note.parentNode, box = home.getBoundingClientRect(), view = log ? log.getBoundingClientRect() : box;
    if (r.bottom < view.top || first.top > view.bottom) { hideNote(); return; }
    var x = Math.max(box.left + 8, Math.min(first.left, box.right - note.offsetWidth - 8));
    note.style.left = (x - box.left) + "px"; note.style.top = (r.bottom - box.top + 7) + "px";
  }
  function hideNote(){
    if (noteAt) noteAt.parentNode && (noteAt.rbPieces || [noteAt]).forEach(function(q){ q.classList.remove("on"); });
    if (note) note.classList.remove("show");
    noteAt = null;
  }
  function noted(pieces, key, home){
    var desc = el("span", "rbchat-sr rbchat-claim-words");
    desc.id = "rbchat-claim-" + (++described); desc.setAttribute("data-claim", key);
    var w = claimWords(key); desc.textContent = w[0] + " " + w[1];
    if (home) home.appendChild(desc);
    // A claim that begins inside a linked name is reached by that link, so it is one stop.
    var link = pieces[0].closest("a"), stop = link || pieces[0];
    if (!link) stop.tabIndex = 0;
    stop.setAttribute("aria-describedby", desc.id);
    pieces.forEach(function(q){ q.setAttribute("data-claim", key); });
    pieces[0].rbPieces = pieces;
    function show(keyed){
      if (!keyed && window.matchMedia && window.matchMedia("(hover: none)").matches) return;
      pieces.forEach(function(q){ q.classList.add("on"); });
      if (!note) { note = el("div", "rbchat-note"); note.setAttribute("aria-hidden", "true"); note.appendChild(el("b", "n")); note.appendChild(document.createTextNode(" ")); note.appendChild(el("span", "d")); }
      var panelEl = pieces[0].closest(".rbchat") || document.body;
      if (note.parentNode !== panelEl) panelEl.appendChild(note);
      noteAt = pieces[0]; fillNote(key);
      note.style.left = "0px"; note.classList.add("show"); placeNote();
    }
    pieces.forEach(function(q){
      q.addEventListener("mouseenter", function(){ show(false); });
      q.addEventListener("mouseleave", hideNote);
    });
    stop.addEventListener("focus", function(){ var keyed = true; try { keyed = stop.matches(":focus-visible"); } catch (e) {} if (keyed) show(true); });
    stop.addEventListener("blur", hideNote);
  }
  // Escape takes a showing note away and nothing else: added before the panel's own handler, it
  // stops the key there, so the panel stays open under a note the reader only meant to dismiss.
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && note && note.classList.contains("show")) { hideNote(); e.stopImmediatePropagation(); }
  });
  document.addEventListener("scroll", placeNote, true);

  function doneLine(){ var h = el("p", "rbchat-done"); h.appendChild(el("span", "rbchat-tick", "\u2713")); h.appendChild(document.createTextNode(" " + strings(langNow()).answered)); return h; }
  function modelText(sha, secs){ var m = strings(langNow()).model; return (secs ? m.replace("{secs}", secs) : m.replace(/ \u00b7 \{secs\}s$/, "")).replace("{sha}", sha); }
  function modelLine(sha, secs){ var l = el("p", "rbchat-model", modelText(sha, secs)); l.setAttribute("data-sha", sha); if (secs) l.setAttribute("data-secs", secs); return l; }
  // A column whose cells are all numbers aligns right, in figures of one width.
  function numberColumns(root){
    var tables = root.querySelectorAll("table");
    for (var t = 0; t < tables.length; t++) {
      var rows = tables[t].querySelectorAll("tbody tr"), n = rows.length && rows[0].children.length;
      for (var c = 0; c < n; c++) {
        var all = rows.length > 0;
        for (var r = 0; r < rows.length && all; r++) all = /^[\d\s.,'\u2019%+\-]+$/.test((rows[r].children[c] || {}).textContent || "");
        if (!all) continue;
        var cells = tables[t].querySelectorAll("tr > :nth-child(" + (c + 1) + ")");
        for (var k = 0; k < cells.length; k++) cells[k].classList.add("rbchat-num");
      }
    }
  }
  // A menu the conversation has moved past stays, dimmed, and its rows still send.
  function spend(){ var ms = log.querySelectorAll(".rbchat-menu"); for (var i = 0; i < ms.length; i++) ms[i].classList.add("rbchat-spent"); }

  // The intro: the page's lockup, a hello, the notice as a comment, then two numbered groups,
  // the asks the chat is built for with what each brings back, and three of the model's own
  // questions. It opens every conversation and stays at the top of the log once it starts.
  // Played on a fresh conversation, drawn finished on a restored one, a reduced-motion visitor
  // or a key pressed while it plays. The text is in the DOM whole from the start, so a screen
  // reader reads it whole; only the name is typed, and it carries its text as a label meanwhile.
  // `introRun` names the intro now drawn, so a late fetch fills only its own; `playRun` names
  // the play, so finishing it cancels the steps still to come and nothing else.
  var introEl = null, introRun = 0, playRun = 0;
  // What the intro drew at random, kept for its conversation, so a language switch redraws the
  // same process and questions in the other language rather than drawing again.
  var introPick = null;
  // The question a link carries, waiting: a card the visitor acts on, built from the strings and
  // never from markup, so whatever the link says is shown as text. Send hands it to send() as if
  // typed, Edit puts it in the input to change, and Discard drops it. It stands right after the
  // intro's prompt line, where a question the visitor typed would stand, so the hello, the notice
  // and what the panel offers read in the order they always do and the question is the last thing
  // in the log; at the end of a conversation the tab already holds, for the same reason.
  function askCard(){
    var s = strings(langNow()).ask, card = el("div", "rbchat-ask"), row = el("div", "rbchat-ask-row");
    card.setAttribute("role", "group"); card.setAttribute("aria-label", s.label);
    card.appendChild(el("p", "rbchat-ask-from", s.from));
    card.appendChild(el("p", "rbchat-ask-q", linkAsk));
    var go = el("button", "rbchat-ask-go", s.send), edit = el("button", "", s.edit), drop = el("button", "", s.discard);
    go.type = edit.type = drop.type = "button";
    go.appendChild(el("span", "rbchat-ask-key", " \u23ce")).setAttribute("aria-hidden", "true");
    edit.setAttribute("data-ask", "edit"); drop.setAttribute("data-ask", "discard");
    row.appendChild(go); row.appendChild(edit); row.appendChild(drop); card.appendChild(row);
    function done(){ var q = linkAsk; linkAsk = null; askEl = null; if (card.parentNode) card.parentNode.removeChild(card); return q; }
    go.addEventListener("click", function(){ input.value = done(); send(); });
    edit.addEventListener("click", function(){ input.value = done(); input.focus(); });
    drop.addEventListener("click", function(){ done(); if (refocus(window)) input.focus(); });
    askEl = card;
    return card;
  }
  // Wherever the card stands it is the last thing in the log, so the log's end is where it shows.
  function showAsk(){
    if (!linkAsk) return;
    if (!(askEl && askEl.isConnected)) log.appendChild(askCard());
    log.scrollTop = log.scrollHeight;
  }

  function intro(play){
    introRun++;
    var mine = introRun, s = strings(langNow()), lock = lockupOf(document);
    var host = location.host, name = lock ? (lock.first + lock.accent).trim() : "";
    introEl = el("div", "rbchat-intro");
    if (lock) {
      var l = el("div", "rbchat-lock"), mark = lock.mark.cloneNode(true), word = el("div", "rbchat-word"), n = el("span", "rbchat-name");
      mark.setAttribute("aria-hidden", "true"); unclash(mark);
      // The name is said whole, once, while its two halves are typed where only eyes read them.
      var first = el("b", "rbchat-first"), accent = el("b", "rbchat-accent");
      first.setAttribute("aria-hidden", "true"); accent.setAttribute("aria-hidden", "true");
      n.appendChild(el("span", "rbchat-sr", name)); n.appendChild(first); n.appendChild(accent);
      word.appendChild(n); word.appendChild(el("span", "rbchat-sub", s.sub.replace("{host}", host)));
      l.appendChild(mark); l.appendChild(word); introEl.appendChild(l);
    }
    var hello = el("p", "rbchat-hello"), lines = lock ? s.hello : s.helloHost;
    hello.appendChild(el("span", "rbchat-h1", lines[0].replace("{name}", name).replace("{host}", host)));
    hello.appendChild(el("br"));
    hello.appendChild(el("span", "rbchat-h2", lines[1]));
    introEl.appendChild(hello);
    notice = el("p", "rbchat-notice"); introEl.appendChild(notice); writeNotice();
    var groups = el("div", "rbchat-groups"); introEl.appendChild(groups);
    var promptLine = el("p", "rbchat-prompt-line", "› " + s.prompt + " ");
    // The block cursor waits here while the intro plays, and hands over to the command line.
    promptLine.appendChild(el("span", "rbchat-cur")); introEl.appendChild(promptLine);
    if (linkAsk && !messages.length) introEl.appendChild(askCard());
    log.insertBefore(introEl, log.firstChild);
    if (!play || still()) finishIntro();
    facts(function(f){
      questions(function(list){
        if (mine !== introRun || !introEl) return;
        var t = strings(langNow());
        var seen = asTitles(list, messages);
        if (!introPick) introPick = { tries: tryPick(f), questions: spread(list.filter(function(q){ return unasked([q.title], seen).length; }), 3) };
        // Picks kept by a release that kept a process alone are made again, once.
        if (!Array.isArray(introPick.tries)) introPick.tries = tryPick(f);
        var rows = tryRows({ tries: introPick.tries }, langNow());
        groups.appendChild(el("p", "rbchat-label", t.tryLabel));
        menu(groups, rows, 0);
        var picked = introPick.questions.map(function(q){ return [asOffered(q)]; });
        if (picked.length) { groups.appendChild(el("p", "rbchat-label", t.from)); menu(groups, picked, rows.length); }
        // What the chat answers from, under the lockup: the core the model is written in and the
        // model at its commit, each linked to exactly that on GitHub.
        if (f.versions) {
          var v = f.versions, t2 = strings(langNow()), line = el("span", "rbchat-versions");
          var words = (v.core ? t2.versions : t2.versionsModel).split(/(\{core\}|\{sha\})/);
          words.forEach(function(w){
            if (w === "{core}") { var a1 = el("a", null, v.core); a1.href = "https://github.com/" + v.repo + "/tree/" + v.commit + "/meta/core"; line.appendChild(a1); }
            else if (w === "{sha}") { var a2 = el("a", null, v.sha); a2.href = "https://github.com/" + v.repo + "/tree/" + v.commit; line.appendChild(a2); }
            else if (w) line.appendChild(document.createTextNode(w));
          });
          var word = introEl.querySelector(".rbchat-word");
          if (word) word.appendChild(line); else introEl.insertBefore(line, introEl.querySelector(".rbchat-hello").nextSibling);
          line.classList.add("rbchat-on");
        }
        // A restored conversation has moved past the intro: its menus are spent, and the rows a
        // number picks stay those of the menu after the last answer.
        if (messages.length) spendIntro(); else { menuRows = rows.concat(picked).map(function(r){ return r[0]; }); keysLine(); }
        // The menus are drawn above a waiting question and would push it out of sight.
        if (askEl && askEl.parentNode === introEl) log.scrollTop = log.scrollHeight;
        if (!introEl.classList.contains("rbchat-still")) playIntro();
      });
    });
  }
  function spendIntro(){ var ms = introEl.querySelectorAll(".rbchat-menu"); for (var i = 0; i < ms.length; i++) ms[i].classList.add("rbchat-spent"); }
  // A cloned mark keeps its ids, which the header's own copy already holds; each is given a
  // name of its own, and every reference inside the clone, url(#id) or #id, follows it.
  function unclash(svg){
    var map = {}, withId = svg.querySelectorAll("[id]");
    for (var i = 0; i < withId.length; i++) { map[withId[i].id] = "rbchat-" + withId[i].id; withId[i].id = map[withId[i].id]; }
    if (!withId.length) return;
    var all = svg.querySelectorAll("*");
    for (var j = 0; j < all.length; j++) {
      for (var k = 0; k < all[j].attributes.length; k++) {
        var at = all[j].attributes[k], v = at.value;
        var w = v.replace(/url\(#([^)]+)\)/g, function(m, id){ return map[id] ? "url(#" + map[id] + ")" : m; }).replace(/^#(.+)$/, function(m, id){ return map[id] ? "#" + map[id] : m; });
        if (w !== v) all[j].setAttribute(at.name, w);
      }
    }
  }
  function still(){ return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function finishIntro(){
    if (!introEl) return;
    playRun++;
    introEl.classList.add("rbchat-still");
    var cur = introEl.querySelector(".rbchat-cur"); if (cur) cur.parentNode.removeChild(cur);
    var lock = lockupOf(document);
    if (lock) { introEl.querySelector(".rbchat-first").textContent = lock.first; introEl.querySelector(".rbchat-accent").textContent = lock.accent; }
  }
  // About a second: the mark's parts 35 ms apart, the name typed at 22 ms a character, then
  // the hello, the notice and each row coming in 30 ms apart, as /cli/'s menu prints.
  function playIntro(){
    var mine = ++playRun, steps = [], lock = lockupOf(document), at = 0;
    var parts = introEl.querySelectorAll(".rbchat-lock svg > *");
    for (var i = 0; i < parts.length; i++) (function(x){ steps.push([at += 35, function(){ x.classList.add("rbchat-on"); }]); })(parts[i]);
    if (lock) {
      var f = introEl.querySelector(".rbchat-first"), a = introEl.querySelector(".rbchat-accent");
      Array.from(lock.first).forEach(function(c){ steps.push([at += 22, function(){ f.textContent += c; }]); });
      Array.from(lock.accent).forEach(function(c){ steps.push([at += 22, function(){ a.textContent += c; }]); });
    }
    var ins = introEl.querySelectorAll(".rbchat-sub, .rbchat-h1, .rbchat-h2, .rbchat-notice, .rbchat-label, .rbchat-row, .rbchat-prompt-line");
    for (var j = 0; j < ins.length; j++) (function(x){ steps.push([at += 30, function(){ x.classList.add("rbchat-on"); }]); })(ins[j]);
    steps.push([at + 30, finishIntro]);
    steps.forEach(function(s){ setTimeout(function(){ if (mine === playRun) s[1](); }, s[0]); });
  }

  // Three of them, tappable, at the end of the log: under whatever the empty panel already
  // shows, or under the answer just finished. Offered only where the visitor can ask next — no
  // answer on its way, the last message an answer or none at all — and checked again once the
  // fetch lands, since a visitor may have typed and sent by then. A title the conversation already asked is left out, so the three after an answer are
  // never the question it answered. After an answer that writes entities not yet asked about,
  // or cites one type, the three follow it, as follow() picks them; a site whose model offers no question offers no chip of either sort.
  // A second call while chips are already up does nothing — the race is two opens before the
  // one fetch resolves, not two different sets.
  function canOffer(){
    return !busy && (!messages.length || messages[messages.length - 1].role === "assistant");
  }
  function offerQuestions(){
    if (!messages.length) return;
    if (!canOffer()) return;
    questions(function(list){
      if (!canOffer() || qBox) return;
      if (!list.length) return;
      var seen = asTitles(list, messages);
      var open = unasked(list.map(function(q){ return q.title; }), seen);
      var last = turns[turns.length - 1];
      var picked = (last && last.role === "assistant" && follow(last.cites, list, seen, answerLang(turns, langNow()), null, mentioned(last.content, heard(turns), list, messages))) || spread(list.filter(function(q){ return open.indexOf(q.title) !== -1; }), 3);
      if (!picked.length) return;
      offer(picked);
      if (qNext && !reading) log.scrollTop = log.scrollHeight; else settle();
    });
  }
  function offer(picked){
    qNext = messages.length > 0;
    // The chips follow the answer's language, the rest of the panel the page's.
    var lang = answerLang(turns, langNow()), say = function(t){ return asOffered(t, lang); };
    qBox = el("div", "rbchat-next");
    qBox.setAttribute("role", "group");
    qBox.setAttribute("aria-label", strings(lang)[qNext ? "next" : "questions"]);
    qBox.appendChild(el("p", "rbchat-label", strings(lang).askNext));
    menu(qBox, picked.map(function(t){ return [say(t)]; }), 0);
    log.appendChild(qBox);
    qPicked = picked.slice(); menuRows = picked.map(say); keysLine();
  }
  // A message on its way makes any chips standing stale: the ones it answered are asked, and
  // the answer it brings is followed by a fresh three of its own.
  function hideQuestions(){ if (qBox && qBox.parentNode) qBox.parentNode.removeChild(qBox); qBox = null; }

  var button = el("button", "rbchat-open");
  button.type = "button";
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" d="M4 5.5h16v10H9l-5 4z"/></svg><span></span>';
  button.addEventListener("click", open);
  // Any element on the page opens the panel by carrying `data-chat-open`: a home page's tile,
  // a link in a post. Delegated from the document, so an element written after this script ran
  // opens it too, and the attribute is the whole contract.
  document.addEventListener("click", function(e){
    var t = e.target && e.target.closest && e.target.closest("[data-chat-open]");
    if (!t) return;
    e.preventDefault(); open();
  });
  document.body.appendChild(button);

  // The notice, in the intro, under its rail: first that an AI answers and not a person, the sentence
  // the EU AI Act asks a chat to say before the first message, then where the message goes, and the
  // privacy page.
  function writeNotice(){ if (!notice) return; var s = strings(langNow()); notice.innerHTML = '<b class="rbchat-ai">' + esc(s.ai) + "</b> " + esc(s.notice).replace("{host}", "<code>" + esc(HOST) + "</code>") + ' <a href="' + esc(s.privacyHref) + '">' + esc(s.privacy) + "</a>"; }
  function relabel(){
    var s = strings(langNow());
    button.querySelector("span").textContent = s.open; button.setAttribute("aria-label", s.open);
    if (!panel) return;
    title.textContent = s.bar.replace("{host}", location.host); panel.setAttribute("aria-label", s.title); closeBtn.setAttribute("aria-label", s.close); closeBtn.setAttribute("data-tip", s.modalClose); closeBtn.textContent = "×";
    input.placeholder = s.prompt; keysLine();
    if (grip) grip.setAttribute("aria-label", s.size);
    if (newBtn) { newBtn.setAttribute("aria-label", s.fresh); newBtn.setAttribute("data-tip", s.fresh); }
    writeNotice();
    if (log) {
      var heads = log.querySelectorAll(".rbchat-done");
      for (var h = 0; h < heads.length; h++) heads[h].lastChild.textContent = " " + s.answered;
      var lines = log.querySelectorAll(".rbchat-model");
      for (var m = 0; m < lines.length; m++) lines[m].textContent = modelText(lines[m].getAttribute("data-sha"), lines[m].getAttribute("data-secs"));
      var labels = log.querySelectorAll(".rbchat-next > .rbchat-label");
      for (var b = 0; b < labels.length; b++) labels[b].textContent = strings(answerLang(turns, langNow())).askNext;
      var heads_ = log.querySelectorAll(".rbchat-choose > [data-menu]");
      for (var c = 0; c < heads_.length; c++) heads_[c].textContent = s.menu[heads_[c].getAttribute("data-menu")];
    }
    // A language switch redraws the intro in the new language, finished, where the log holds one.
    // A waiting question is redrawn with it, and the button that held the focus holds it again:
    // a page sets its language after the panel has opened, and Enter still has to send.
    if (introEl && log) {
      var keep_ = log.scrollTop, held = askEl && askEl.contains(document.activeElement) ? Array.prototype.indexOf.call(askEl.querySelectorAll("button"), document.activeElement) : -1;
      introEl.parentNode && introEl.parentNode.removeChild(introEl); introEl = null; intro(false); log.scrollTop = keep_;
      if (held >= 0 && askEl) askEl.querySelectorAll("button")[held].focus({ preventScroll: true });
    }
    // The chips standing under an answer are drawn again from the titles they were picked as, so a
    // model question reads in the new language and a number key sends what its row now shows.
    if (qBox && qPicked && qPicked.length) { var was_ = qPicked.slice(); hideQuestions(); offer(was_); }
    if (qBox) qBox.setAttribute("aria-label", strings(answerLang(turns, langNow()))[qNext ? "next" : "questions"]);
  }
  relabel();
  // The language control swaps <html lang>; every string follows on the next tick.
  if (window.MutationObserver) new MutationObserver(relabel).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  // The rows a bare number picks: the menu standing last. Empty until a menu is drawn.
  // `menuChoice` is the model or effort menu while it is that one: `rows` is the very array it
  // put in menuRows, so any other menu drawn since, which puts its own, ends it without being
  // told; `was` is what menuRows held before it, given back once a row is picked.
  var menuRows = [], menuChoice = null;
  function grow(){ input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 4 * parseFloat(getComputedStyle(input).lineHeight || 20)) + "px"; }
  // The keys line under the prompt, as the tooling prints its hints; the pick key only while a menu stands.
  function keysLine(){
    if (!keysEl) return;
    var k = strings(langNow()).keys;
    var who = readerName(), c = chosen(false);
    var parts = (who ? [who] : []).concat(c ? [chosenText(c.model, c.effort)] : []).concat([k.send, k.last]).concat(menuRows.length ? [k.pick.replace("{range}", rangeOf(menuRows.length))] : []).concat([k.help]);
    keysEl.textContent = parts.join("  \u00b7  ");
  }

  function build(){
    panel = el("section", "rbchat"); panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "false"); panel.hidden = true;
    var head = el("header", "rbchat-head");
    // The bar is headed as the one modal's is, the page's host where the modal puts its title,
    // so every head in the family reads one way.
    title = el("h2"); title.id = "rbchat-title"; closeBtn = el("button", "rbchat-close"); closeBtn.type = "button"; closeBtn.addEventListener("click", close);
    // Starting over is the header's one door, beside the way out, and only once there is
    // something to clear: an empty panel shows no control for emptying it. A conversation has no
    // length at which it must start over, so this is the only door; its reset takes the turns,
    // the log and the tab's copy together; the panel's size stays, being a choice
    // about how the visitor reads rather than part of the conversation.
    newBtn = el("button", "rbchat-new"); newBtn.type = "button"; newBtn.hidden = true;
    // The glyph is an arrow come back round, not a plus: a plus beside the cross read as "add",
    // and what the button does is start over. The note under it names the action for a pointer
    // and for a keyboard, which a bare glyph never did.
    newBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M5 12a7 7 0 1 0 2.05-4.95L5 9M5 5v4h4"/></svg>';
    newBtn.addEventListener("click", reset);
    head.appendChild(title); head.appendChild(newBtn); head.appendChild(closeBtn);
    // No aria-live here: the log used to re-announce the growing answer on every token. The
    // finished answer gets its own aria-live, set once in finish(), after it stops changing.
    log = el("div", "rbchat-log");
    ["wheel", "pointerdown", "keydown", "touchstart"].forEach(function(k){ log.addEventListener(k, function(){ reading = null; }, { passive: true }); });
    var form = el("form", "rbchat-form");
    // The command line: a prompt and the field, and no button. Enter sends, on a desk and on a
    // phone alike, where the keyboard's return key is labeled for it by `enterkeyhint`; a ↵
    // beside the field was one more thing on a narrow line doing what that key already does.
    // The field opens at one row and grows to four as the visitor writes more.
    var p = el("span", "rbchat-p", "\u203a"); p.setAttribute("aria-hidden", "true");
    input = el("textarea"); input.rows = 1; input.maxLength = LIMIT; input.enterKeyHint = "send";
    input.addEventListener("keydown", function(e){
      // An Enter that confirms an input method's composition belongs to the composition.
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "ArrowUp" && !input.value) {
        for (var i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") { e.preventDefault(); input.value = messages[i].content; grow(); return; }
      }
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : send(); }
    });
    input.addEventListener("input", grow);
    form.appendChild(p); form.appendChild(input);
    keysEl = el("p", "rbchat-keys");
    // What a screen reader is told once an answer is whole: the answer arrives in one piece,
    // already in the log, so the log itself would announce nothing.
    say = el("p", "rbchat-say"); say.setAttribute("aria-live", "polite");
    form.addEventListener("submit", function(e){ e.preventDefault(); send(); });
    // The corner that sizes the panel. The panel is pinned to the bottom right, so the top left
    // corner is the one that can move without moving the panel: dragging it out makes the panel
    // bigger. It is a handle like the stage's gutter and behaves like one — drag, arrow keys
    // when focused, double-click back to the default — and it is not there on a phone, where
    // the panel is the whole screen and there is nothing to size.
    grip = el("div", "rbchat-grip"); grip.tabIndex = 0; grip.setAttribute("role", "separator"); grip.setAttribute("aria-orientation", "vertical");
    panel.appendChild(grip);
    panel.appendChild(head); panel.appendChild(log); panel.appendChild(form); panel.appendChild(keysEl); panel.appendChild(say);
    document.body.appendChild(panel);
    // Escape is native to <dialog> and needs no handler here, but its own "close" runs after
    // this keydown, not before: while a modal dialog is still open the panel must not close
    // behind it too. The guard asks the document rather than naming this page's own `modal`,
    // because a modal dialog is what the family opens everywhere, and a page carrying the
    // stage's own dialog as well needs Escape kept from the panel by that one too.
    document.addEventListener("keydown", function(e){
      if (e.key !== "Escape" || panel.hidden) return;
      if (document.querySelector("dialog[open]")) return;
      close();
    });
    // A key or a pointer anywhere in the panel finishes an intro still playing.
    ["pointerdown", "keydown"].forEach(function(k){ panel.addEventListener(k, function(){ if (introEl && !introEl.classList.contains("rbchat-still")) finishIntro(); }, true); });
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
      try { localStorage.removeItem(SIZE_KEY); } catch (e) {}
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

  // hideQuestions() first, always: a set of chips already up is stale the moment the panel is
  // shown again, so every open draws a fresh random three rather than repeating what closing the
  // panel left behind. It only drops the box the DOM holds — `qList`/`qFetch` are untouched, so
  // two opens ahead of the one fetch landing still share it rather than asking twice.
  // On a phone the panel is the screen, and the screen is what the visual viewport says it is.
  // An open keyboard shrinks that and not the layout viewport, so a panel sized to `100dvh`
  // ran on under the keyboard and the browser scrolled the page to show the field, taking the
  // title bar and its close button off the top. The panel follows the visual viewport instead:
  // its top where the visible area starts, its height what is visible, so the bar stays at the
  // top and the command line sits on the keyboard. Where there is no `visualViewport` the
  // stylesheet's `100dvh` stands.
  var vv = window.visualViewport, PHONE = window.matchMedia ? window.matchMedia("(max-width:600px)") : null;
  function fit(){
    if (!panel || panel.hidden || !vv || !PHONE) return;
    if (!PHONE.matches) { panel.style.removeProperty("--rbchat-top"); panel.style.removeProperty("--rbchat-h"); return; }
    panel.style.setProperty("--rbchat-top", vv.offsetTop + "px");
    panel.style.setProperty("--rbchat-h", vv.height + "px");
  }
  if (vv) { vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); }
  function open(){ hideQuestions(); if (!panel) build(); panel.hidden = false; button.hidden = true; fit(); if (!introEl) intro(!messages.length); settle(); input.focus(); keep(); if (messages.length) offerQuestions(); linkWaiting(); }
  function close(){ if (!reading) reading = place(log); panel.hidden = true; button.hidden = false; button.focus(); keep(); }
  function reset(){ reading = null; reqGen++; if (stopRequest) { stopRequest(); stopRequest = null; } messages = []; turns = []; log.innerHTML = ""; introEl = null; introPick = null; menuRows = []; qBox = null; busy = false; input.disabled = false; intro(true); input.focus(); keep(); }

  function bubble(role){ var b = el("div", "rbchat-msg rbchat-" + role); log.appendChild(b); log.scrollTop = log.scrollHeight; return b; }
  // A refusal always leaves the visitor able to try again: the sentence is on the table's own
  // keys, never a bare lookup, and focus goes back to the box once the panel is still open —
  // every call site re-enables the form before calling this, so the box is never focused
  // while disabled. The moment the server named, if any, comes with the code and ends the
  // sentence.
  function refuse(code, retryAt){ bubble("refusal").textContent = "\u2717 " + refusalText(code, retryAt, Date.now(), langNow()); keysLine(); if (panel && !panel.hidden && refocus(window)) input.focus(); }

  // ─── Signing in ───────────────────────────────────────────────────────────────────────────
  // The tokens are kept in `localStorage` under the site's origin, since one sign-in is good in
  // every tab until it lapses; the verifier only in the tab, across the one trip to the login and
  // back. Every access is wrapped, as the conversation's is. A page whose tag names no identity
  // service reads no token, so a sign-in another page left behind never goes with its messages.
  function signedIn(){
    if (!SITE) return null;
    try { var v = JSON.parse(localStorage.getItem(SIGNIN_KEY) || "null"); return v && typeof v.access === "string" && v.access ? v : null; }
    catch (e) { return null; }
  }
  function forget(){ try { localStorage.removeItem(SIGNIN_KEY); } catch (e) {} keysLine(); }
  // The reader's name, from the ID token: `name`, else `preferred_username`.
  function readerName(){
    var s = signedIn(), c = s && claimsOf(s.id);
    if (!c) return "";
    return typeof c.name === "string" && c.name ? c.name : typeof c.preferred_username === "string" ? c.preferred_username : "";
  }
  function hint(text){ var h = el("p", "rbchat-hint", text); log.appendChild(h); log.scrollTop = log.scrollHeight; return h; }

  // ─── Choosing the model and the effort ────────────────────────────────────────────────────
  // What the reader's next message goes with, or null for a visitor, who sends no choice. The
  // remembered choice holds only while the sign-in still grants its model, so a role taken away
  // since goes back to Sonnet 5, and an effort that is not one of the five to `low`. Effort comes
  // with a model grant, as the server decides, so a reader who holds no role goes at `low` too.
  // With `fix` a remembered choice that no longer holds is written back as what it fell to.
  function chosen(fix){
    var s = signedIn();
    if (!s) return null;
    var c = null;
    try { c = JSON.parse(localStorage.getItem(CHOICE_KEY) || "null"); } catch (e) {}
    var held = grantedModels(claimsOf(s.id), SITE.org, SITE.prefix);
    var got = { model: own(c, "model") && held.indexOf(c.model) >= 0 ? c.model : CHAT_MODELS[0].id, effort: hasRole(held) && own(c, "effort") && CHAT_EFFORTS.indexOf(c.effort) >= 0 ? c.effort : CHAT_EFFORTS[0] };
    if (fix && c && (c.model !== got.model || c.effort !== got.effort)) { try { localStorage.setItem(CHOICE_KEY, JSON.stringify(got)); } catch (e) {} }
    return got;
  }
  // Sonnet 5 is in every reader's list, so a list of more is a reader who holds a role.
  function hasRole(held){ return held.length > 1; }
  // A model by its label where the table knows it, by its id where it does not, and the effort.
  function chosenText(model, effort){
    var m = CHAT_MODELS.filter(function(x){ return x.id === model; })[0];
    return strings(langNow()).keys.chosen.replace("{model}", m ? m.label : model).replace("{effort}", effort);
  }
  function choose(kind, value){
    var c = chosen(false);
    if (!c) return;
    c[kind] = value;
    try { localStorage.setItem(CHOICE_KEY, JSON.stringify(c)); } catch (e) {}
    keysLine();
  }
  // /model or /effort, signed in: the menu, headed as the intro heads its groups, the current
  // row ticked. A row picked, by its number or a click, is the choice; the menu is then spent
  // and a number picks from whatever menu stood before it.
  function chooser(kind){
    var c = chosen(false), s = strings(langNow());
    var values = kind === "model" ? grantedModels(claimsOf(signedIn().id), SITE.org, SITE.prefix) : CHAT_EFFORTS;
    var labels = values.map(function(v){ return kind === "model" ? CHAT_MODELS.filter(function(m){ return m.id === v; })[0].label : v; });
    var box = el("div", "rbchat-choose"), head = el("p", "rbchat-label", s.menu[kind]);
    head.setAttribute("data-menu", kind);
    box.appendChild(head);
    var was = menuChoice && menuChoice.rows === menuRows ? menuChoice.was : menuRows;
    var m = menu(box, values.map(function(v, i){ return [labels[i], null, { current: v === c[kind], pick: function(){ picks(v); } }]; }), 0);
    function picks(v){
      choose(kind, v);
      m.classList.add("rbchat-spent");
      if (menuChoice && menuChoice.rows === menuRows && menuChoice.menu === m) { menuRows = menuChoice.was; menuChoice = null; }
      keysLine();
    }
    log.appendChild(box); log.scrollTop = log.scrollHeight;
    menuRows = labels;
    menuChoice = { rows: labels, was: was, menu: m, values: values, pick: picks };
    keysLine();
  }
  // The model and effort that answered, beside the cite line, or on a line of their own under an
  // answer that cited nothing; the server names them in `done.by`, and an older one names none.
  function byOf(data){ return data && data.by && typeof data.by.model === "string" && typeof data.by.effort === "string" ? { model: data.by.model, effort: data.by.effort } : null; }
  function byMark(ans, line, by){
    var b = el("span", "rbchat-by", chosenText(by.model, by.effort));
    if (!line) { line = el("p", "rbchat-cites"); ans.appendChild(line); }
    else line.appendChild(document.createTextNode(" \u00b7 "));
    line.appendChild(b);
  }
  function b64url(bytes){
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  // To the hosted login: a verifier of 32 random bytes, its SHA-256 as the challenge, a random
  // state, and the path the reader is on, all kept in the tab for the way back. The conversation
  // is kept first, so the page the reader returns to draws it again. A tab that cannot keep the
  // verifier could not finish the sign-in, so it does not start one.
  // The verifier is kept only once its challenge is made, so a /login that fails leaves nothing.
  function login(){
    var verifier, state, digest, path = location.pathname + location.search + location.hash;
    try {
      verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
      state = b64url(crypto.getRandomValues(new Uint8Array(16)));
      digest = crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    } catch (e) { refuse("internal"); return; }
    digest.then(function(h){
      try { sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier: verifier, state: state, path: path })); }
      catch (e) { refuse("internal"); return; }
      keep();
      location.assign(authorizeUrl(SITE, b64url(new Uint8Array(h)), state, REDIRECT));
    }, function(){ refuse("internal"); });
  }
  // Both tokens forgotten here, then the session ended at the service, which sends the reader
  // back to the site's root, where the conversation is drawn again from the tab.
  function logout(){
    var s = signedIn();
    forget();
    keep();
    var q = [["client_id", SITE.client]].concat(s && s.id ? [["id_token_hint", s.id]] : []).concat([["post_logout_redirect_uri", REDIRECT]]);
    location.assign(SITE.issuer + "/oidc/v1/end_session?" + q.map(function(p){ return p[0] + "=" + encodeURIComponent(p[1]); }).join("&"));
  }
  // The address without what the login came back with: the code and state, or the error.
  function unreturned(){
    var rest = location.search.replace(/^\?/, "").split("&").filter(function(p){ return p && !/^(?:code|state|error|error_description|error_uri)(?:=|$)/.test(p); });
    return location.pathname + (rest.length ? "?" + rest.join("&") : "") + location.hash;
  }
  // Where the reader signed in from, on this site: a kept path that is not a path on this
  // origin, `@host/…` or `//host/…`, which joined to the origin would name another host, is
  // the root instead.
  function keptTarget(path){
    var to = location.origin + (typeof path === "string" && /^\/(?!\/)/.test(path) ? path : "/");
    try { if (new URL(to).origin === location.origin) return to; } catch (e) {}
    return location.origin + "/";
  }
  // Back to that path: in place where it is this page, by a new load where it is another. A
  // canceled sign-in is said on the page the reader lands on, so where that is another page
  // the tab carries the word there in `chat-pkce`, which that page reads and removes.
  function toKept(path, canceled){
    var to = keptTarget(path);
    if (new URL(to).pathname !== location.pathname) {
      if (canceled) { try { sessionStorage.setItem(PKCE_KEY, JSON.stringify({ canceled: true })); } catch (e) {} }
      location.replace(to);
      return;
    }
    try { history.replaceState(null, "", to); } catch (e) {}
    if (!panel || panel.hidden) open();
    keysLine();
    if (canceled) refuse("signed_out");
  }
  // A canceled sign-in another page sent the reader here from, said once.
  function owedCancel(){
    try {
      var k = JSON.parse(sessionStorage.getItem(PKCE_KEY) || "null");
      if (!k || k.canceled !== true) return false;
      sessionStorage.removeItem(PKCE_KEY);
      return true;
    } catch (e) { return false; }
  }
  // Back from the login. A return whose state is not the one this tab sent is no sign-in of
  // this reader's: it is dropped, the code with it, and nothing is exchanged. One that matches
  // is exchanged once at the token endpoint, the verifier proving it is the page that asked, and
  // the reader is taken back to the path they signed in from: in place where the login sent them
  // back to that page, by a new load where it is another, as it is from any page but the root.
  // An error return is the reader not signed in: it is said, and where its state is this tab's
  // the reader goes back to where they were.
  function back(got){
    var kept = null;
    try { kept = JSON.parse(sessionStorage.getItem(PKCE_KEY) || "null"); sessionStorage.removeItem(PKCE_KEY); } catch (e) {}
    try { history.replaceState(null, "", unreturned()); } catch (e) {}
    var ours = !!kept && typeof kept.state === "string" && kept.state === got.state;
    if (got.error !== undefined) {
      if (ours) { toKept(kept.path, true); return; }
      if (!panel || panel.hidden) open();
      refuse("signed_out");
      return;
    }
    if (!ours || typeof kept.verifier !== "string") return;
    var form = [["grant_type", "authorization_code"], ["code", got.code], ["redirect_uri", REDIRECT], ["client_id", SITE.client], ["code_verifier", kept.verifier]];
    fetch(SITE.issuer + "/oauth/v2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form.map(function(p){ return p[0] + "=" + encodeURIComponent(p[1]); }).join("&") })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){
        if (!j || typeof j.access_token !== "string" || !j.access_token) throw new Error("no token");
        try { localStorage.setItem(SIGNIN_KEY, JSON.stringify({ access: j.access_token, id: typeof j.id_token === "string" ? j.id_token : "" })); } catch (e) {}
        toKept(kept.path, false);
      })
      .catch(function(){ if (!panel || panel.hidden) open(); refuse("signed_out"); });
  }

  // The request on its way, so starting over can end it: `reqGen` names the latest, and a
  // request that is no longer it touches nothing when it answers, fails or times out.
  var reqGen = 0, stopRequest = null;
  function send(){
    if (busy) return;
    var typed = input.value.trim();
    if (!typed) return;
    // The command line's own words never reach the host and never become a turn.
    var cmd = command(typed);
    if (cmd === "new") { input.value = ""; reset(); return; }
    if (cmd === "help") { input.value = ""; help(); return; }
    // The sign-in's words are the panel's only where the tag names an identity service; without
    // one they are sent as any question is, as they were before there was a sign-in.
    if (SITE && cmd === "login") { input.value = ""; login(); return; }
    if (SITE && cmd === "logout") { input.value = ""; logout(); return; }
    if (SITE && (cmd === "model" || cmd === "effort")) {
      input.value = "";
      // /effort is offered only to a reader a role grants a model, since the server answers a
      // reader with none at `low` alone; they are told so in a line, and nothing is drawn.
      var signer = signedIn();
      if (!signer) hint(strings(langNow()).signInHint);
      else if (cmd === "effort" && !hasRole(grantedModels(claimsOf(signer.id), SITE.org, SITE.prefix))) hint(strings(langNow()).effortHint);
      else chooser(cmd);
      return;
    }
    var text = picked(typed, menuRows);
    // A number that picks a row of the model or effort menu is the choice, and nothing is sent.
    if (menuChoice && menuChoice.rows === menuRows && text !== typed) { input.value = ""; menuChoice.pick(menuChoice.values[menuRows.indexOf(text)]); return; }
    if (text.length > LIMIT) { refuse("too_long"); return; }
    // A sign-in whose access token has lapsed is not sent, nor sent without it: the reader is
    // asked to sign in again, and the question stays in the line and the conversation as it was.
    var token = signedIn();
    if (token && lapsed(token.access, Date.now())) { refuse("signed_out"); return; }
    // The model and effort it goes with, a visitor's none; above `low` to the host's own address
    // where the tag names one, and given the time a long answer takes.
    var choice = token ? chosen(true) : null, high = !!choice && choice.effort !== CHAT_EFFORTS[0];
    var to = high && DIRECT ? DIRECT : ENDPOINT;
    // The menus above stay, dimmed, and their rows still send; the next answer draws its own.
    spend(); qBox = null;
    reading = null;
    var s = strings(langNow());
    messages.push({ role: "user", content: text });
    turns.push({ role: "user", content: text });
    var mine = bubble("user");
    mine.textContent = text; mine.setAttribute("data-turn", turns.length - 1);
    // A message that goes unanswered leaves the conversation, and its bubble stops naming a turn.
    function unsend(){ messages.pop(); turns.pop(); mine.removeAttribute("data-turn"); keep(); }
    input.value = ""; busy = true; input.disabled = true;
    // Nothing of the answer is drawn until the stream ends: the spinner stands for the whole
    // wait, counting the seconds, and the finished answer arrives in one piece. The answer's
    // element is made now and filled as the stream comes, but joins the log only in finish().
    var ans = el("div", "rbchat-msg rbchat-assistant"), body = el("div", "rbchat-body"), t0 = Date.now();
    var wait = el("p", "rbchat-spin"), frame = el("span", "rbchat-frame", "|"), secs = el("span", "rbchat-secs");
    wait.appendChild(frame); wait.appendChild(document.createTextNode(" " + s.asking + "\u2026 ")); wait.appendChild(secs);
    log.appendChild(wait); log.scrollTop = log.scrollHeight;
    var spin = setInterval(function(){ frame.textContent = "|/-\\"[Math.floor((Date.now() - t0) / 90) % 4]; secs.textContent = seconds(Date.now() - t0); }, 90);
    ans.appendChild(body);
    var acc = "", cites = [], names = [], cut = false, pictures = [], verdict = null, errored = false, ended = false, spoke = null, by = null;
    function render(){ body.innerHTML = md(acc); numberColumns(body); }
    function stopSpin(){ clearInterval(spin); if (wait.parentNode) wait.parentNode.removeChild(wait); }
    // A stream that never ends — a dropped connection the browser does not notice — would
    // otherwise lock the panel forever: nothing else re-enables the form. Ninety seconds after
    // the request goes out, fifteen minutes above `low`, the controller aborts it, and the abort
    // reaches the existing .catch below exactly as a network failure does.
    var ac = new AbortController();
    var timer = setTimeout(function(){ ac.abort(); }, high ? LONG : TIMEOUT);
    var gen = ++reqGen;
    stopRequest = function(){ clearTimeout(timer); stopSpin(); ac.abort(); };
    function finish(){
      clearTimeout(timer);
      stopSpin();
      // An answer with no text is not a turn: pushing an empty assistant message would break
      // the server's alternating-turns rule on the visitor's next message, so this is a
      // refusal instead, and the exchange leaves no trace in the conversation. Whitespace
      // alone is no text either; rendered, it is an empty bubble.
      if (!acc.trim()) {
        if (ans.parentNode) ans.parentNode.removeChild(ans);
        unsend();
        busy = false; input.disabled = false;
        refuse("internal");
        return;
      }
      if (cut) acc += "\n\n" + strings(langNow()).cut;
      render();
      var head = doneLine();
      ans.insertBefore(head, body);
      log.appendChild(ans);
      // The pictures are drawn once the answer is in the log, since they are drawn for the
      // log's width.
      placeFigures(ans, body, pictures);
      ans.setAttribute("aria-live", "polite");
      // Once, on the finished answer: the names are linked in the text the visitor reads, not
      // in the Markdown, so nothing about the answer itself changes and the next render — a
      // language switch, a redraw — would simply do it again.
      // A cited entity is linked in the text too, so no title stands plain above the line
      // that cites it; the server keeps cites and names disjoint, so nothing is linked twice.
      // An earlier turn's names are linked too, which a follow-up that called no tool needs.
      nameLinks(body, names.concat(cites, heard(turns)), MODEL, document);
      linkQuestions(body);
      // Only an answer that reached `done` whole is marked: one cut by an error, or a stream that
      // closed without its last event, did not finish as it was checked.
      var checked = ended && !errored ? verdict : null;
      var marked = markClaims(body, acc, checked);
      if (marked) ans.appendChild(claimLine(marked));
      var line = cites.length ? ans.appendChild(citeLine(cites, MODEL, ICON, document)) : null;
      if (by) byMark(ans, line, by);
      var sha = commitOf(cites);
      if (sha) ans.appendChild(modelLine(sha, String(Math.max(1, Math.round((Date.now() - t0) / 1000)))));
      log.scrollTop = log.scrollHeight;
      // Emptied first and filled a moment later, so the same words twice are still said twice.
      say.textContent = ""; var said = body.textContent;
      setTimeout(function(){ if (say) say.textContent = said; }, 60);
      stopRequest = null;
      messages.push({ role: "assistant", content: acc });
      turns.push({ role: "assistant", content: acc, cites: cites, names: names, diagrams: pictures, verdict: checked, lang: spoke, by: by });
      ans.setAttribute("data-turn", turns.length - 1);
      keep();
      busy = false;
      input.disabled = false; if (refocus(window)) input.focus(); offerQuestions();
    }
    var headers = { "content-type": "application/json", "X-Chat": "1" };
    if (token) headers.Authorization = "Bearer " + token.access;
    var sent = { messages: messages.slice(-SENT), lang: langNow() };
    if (choice) { sent.model = choice.model; sent.effort = choice.effort; }
    fetch(to, { method: "POST", headers: headers, signal: ac.signal, body: JSON.stringify(sent) })
      .then(function(r){
        if (r.status !== 200) {
          // The body is read for its code and, on the three limits, the moment the limit
          // lifts; a body that cannot be read refuses by the status alone and names no moment.
          return r.json().then(function(j){ var e = j && j.error; return { code: (e && e.code) || "internal", retryAt: e && e.retryAt }; }, function(){ return { code: r.status === 413 ? "too_much" : "internal" }; })
            .then(function(got){
              clearTimeout(timer); stopSpin();
              if (gen !== reqGen) return;
              if (ans.parentNode) ans.parentNode.removeChild(ans);
              unsend();
              busy = false; input.disabled = false;
              // The server no longer takes the token: it is forgotten, and the next message goes
              // as a visitor's until the reader signs in again.
              if (got.code === "signed_out") forget();
              // A model the sign-in does not grant: the question goes back into the line, to be
              // sent again once another is chosen.
              if (got.code === "not_granted" && !input.value) input.value = text;
              refuse(got.code, got.retryAt);
            });
        }
        return readEvents(r, function(name, data){
          if (gen !== reqGen) return;
          if (name === "text") acc += data.text || "";
          else if (name === "cite") cites.push(data);
          else if (name === "names") (data && data.names || []).forEach(function(n){ if (n && n.id && n.title) names.push(n); });
          else if (name === "diagram" && data && typeof data.mermaid === "string") {
            // Every picture a message brings is drawn, in the order it came, in finish().
            pictures.push(data);
          }
          else if (name === "verdict" && data && Array.isArray(data.claims)) verdict = data;
          else if (name === "done") { cut = !!data.cut; ended = true; spoke = data && typeof data.lang === "string" ? data.lang : null; by = byOf(data); }
          else if (name === "error") {
            var code = data && data.error && data.error.code, at = data && data.error && data.error.retryAt;
            if (!acc.trim()) {
              clearTimeout(timer); stopSpin();
              if (ans.parentNode) ans.parentNode.removeChild(ans);
              unsend();
              busy = false; input.disabled = false;
              refuse(code || "internal", at);
              return;
            }
            // An answer cut short by an error is not marked: the check spoke of an answer that
            // did not finish as it was checked.
            errored = true;
            acc += "\n\n" + refusalText(code, at, Date.now(), langNow());
          }
        }).then(function(){ if (gen === reqGen && busy) finish(); });
      })
      .catch(function(){
        clearTimeout(timer); stopSpin();
        if (gen !== reqGen) return;
        if (ans.parentNode) ans.parentNode.removeChild(ans);
        if (messages[messages.length - 1] && messages[messages.length - 1].role === "user") { unsend(); }
        busy = false; input.disabled = false;
        refuse("network");
      });
  }

  // What the tab kept, drawn again. A conversation is read back whether or not the panel was
  // open, so the visitor who closed it and followed a link finds it where they left it; only a
  // panel that was open is shown. Nothing is sent by a restore: the turns are what the page
  // already showed, and the next message carries them to the server as any message does.
  // A link followed, the back button, a tab put away: the page going is the last moment the log
  // can be read, and keep() reads the place from it then.
  window.addEventListener("pagehide", keep);
  (function restore(){
    var was = stored();
    if (!was || !Array.isArray(was.turns) || (!was.turns.length && !was.open)) return;
    if (!panel) build();
    // Only a panel restored open shows its intro now; a closed one gets it from open(), since
    // the intro reads the model file and that read waits for the panel.
    reading = was.at && typeof was.at.turn === "number" ? was.at : { end: true };
    // The intro's picks, so it offers the same rows and questions it offered on the last page.
    if (was.pick && Array.isArray(was.pick.questions)) introPick = was.pick;
    was.turns.forEach(function(t){
      if (t.role === "user") { var u = bubble("user"); u.textContent = t.content; u.setAttribute("data-turn", turns.length); messages.push({ role: "user", content: t.content }); turns.push({ role: "user", content: t.content }); return; }
      var ans = bubble("assistant"), body = el("div", "rbchat-body");
      ans.setAttribute("data-turn", turns.length);
      body.innerHTML = md(t.content); numberColumns(body);
      var head = doneLine();
      ans.appendChild(head); ans.appendChild(body);
      var cites = t.cites || [];
      // A turn keeps its pictures as `diagrams`; one kept by an earlier release carries a single
      // `diagram`, read as a list of one. The same gate as a live picture: one that is not a
      // picture is dropped rather than thrown on.
      var diagrams = (Array.isArray(t.diagrams) ? t.diagrams : t.diagram ? [t.diagram] : []).filter(function(d){ return d && typeof d.mermaid === "string"; });
      nameLinks(body, (t.names || []).concat(cites, heard(turns)), MODEL, document);
      linkQuestions(body);
      placeFigures(ans, body, diagrams);
      var restored = markClaims(body, t.content, t.verdict || null);
      if (restored) ans.appendChild(claimLine(restored));
      var line = cites.length ? ans.appendChild(citeLine(cites, MODEL, ICON, document)) : null, by = byOf(t);
      if (by) byMark(ans, line, by);
      // A restored answer has no timing to name, so its line names the commit alone.
      var sha = commitOf(cites);
      if (sha) ans.appendChild(modelLine(sha, null));
      messages.push({ role: "assistant", content: t.content });
      turns.push({ role: "assistant", content: t.content, cites: cites, names: t.names || [], diagrams: diagrams, verdict: t.verdict || null, lang: typeof t.lang === "string" ? t.lang : null, by: by });
    });
    // The rows the last answer offered, drawn now with the rest: read again from the model file
    // they would stand a moment after the page shows, push the log up, and differ on every page.
    // Only titles a message may carry, and only under an answer, where the rows were offered.
    var next = Array.isArray(was.next) ? was.next.filter(function(t){ return typeof t === "string" && t && t.length <= LIMIT; }) : [];
    if (next.length && canOffer()) offer(next);
    // After the turns, so the intro knows the conversation has moved past it, whether its
    // menus are filled now or once the model file is read.
    if (was.open) intro(false);
    if (was.open) { panel.hidden = false; button.hidden = true; offerQuestions(); linkWaiting(); }
    if (newBtn) newBtn.hidden = !messages.length;
    log.scrollTop = log.scrollHeight; settle();
  })();
  unwait();

  // After the restore, so a panel the tab kept open is not opened twice. The address is not a
  // click: open() focuses the input, which on a touch screen would raise the keyboard over a page
  // the visitor has not read yet, so there the focus is taken back at once, where refocus says.
  (function arrive(){
    var rest = asked(location.search), link = linkQuestion(rest === null ? location.search : rest);
    if (rest === null && !link) return;
    if (link) { rest = link.rest; linkAsk = link.question; }
    try { history.replaceState(null, "", location.pathname + rest + location.hash); } catch (err) {}
    if (!panel || panel.hidden) open();
    showAsk();
    // A waiting question takes the focus on a desk, so Enter sends it; on a touch screen nothing
    // keeps it, as the panel opened by an address never raises the keyboard.
    if (!refocus(window)) { input.blur(); return; }
    if (askEl) askEl.querySelector(".rbchat-ask-go").focus({ preventScroll: true });
  })();
  // Last, once the conversation the tab kept is drawn, so the panel it opens holds it.
  if (came) back(came);
  else if (SITE && owedCancel()) { if (!panel || panel.hidden) open(); refuse("signed_out"); }
})();
