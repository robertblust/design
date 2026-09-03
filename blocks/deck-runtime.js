  /* ─── deck runtime · v6 · {{variant}} ───────────────────────────────────
     The deck's whole runtime — slide navigation, language switching, the notes panel
     and narration — generated from @robertblust/design. Editing it here does nothing,
     because the next `npm run design` overwrites it. Change it in the package.

     ~349 of ~420 lines were already identical on all four decks before this block
     existed; an earlier pass made the rest agree. What was left that genuinely
     differs is four strings: each talk's own title and description, in German and
     English. Everything else about the deck's chrome — every other UI string, every
     control — belongs to this block and is not the page's to change.

     v4 removed a narration fallback that could not run. `startNarration()` opened on
     `if (!pickVoice() && !hasClips())`, which put "No voice" in the transport's display
     window and refused to start. That gate is synchronous and every way to learn whether
     a slide has a recording is asynchronous — a HEAD request, a `loadedmetadata` event,
     a decode — and under `file://` a request is not available at all. So `hasClips()`
     had nowhere to get an answer, and two independent versions of this runtime both
     settled on `return true`: the gate could only ever decide one way, and the branch
     behind it never ran on any deck. Gone with it: `lcdMessage`, `msgTimer`, `lcdn`,
     both `novoice` strings, and `deck transport`'s `.lcd:has(.n.msg)` rule, which existed
     only to reveal that message below 400px. What actually handles a missing recording is
     `clip.onerror` in `narrateCurrent()` — reactive, per slide, and correct under
     `file://` too, because it waits for the failure instead of predicting it.

     This block has a contract with the page around it that `design:check` cannot see,
     because the check only compares bytes between the markers. The page must declare,
     above this fence:

       var TALK = { de:{ title:'…', desc:'…' }, en:{ title:'…', desc:'…' } };

     Rename `TALK` or drop that declaration and the fence still matches byte for byte,
     but the page throws a `ReferenceError` at load — caught by `opensFromFile`, armed on
     all four decks, which fails on the page's own `pageerror`. The identical sentence in
     `blocks/lang.js` describes a genuinely silent failure there — a click-time throw on a
     prose page nothing watches — but a deck is not a prose page, and this is not silent.

     `TALK` is not the whole of this block's contract, only the part a missing declaration
     makes loud. The block also depends on roughly twenty DOM ids and several data
     attributes existing on the page around it; `transport` and `opensFromFile` are what
     actually hold that larger contract, between them, not this comment.

     A `language` fence lives inside this one, parameterized exactly as it is anywhere
     else it appears — its own `LANG_KEY` line is filled from the site's configured key
     rather than frozen at extraction. This block declares the same `langKey` parameter
     for the same reason: the sync tool's pass over this outer fence fills in the
     site's key here, its separate pass over the nested fence fills in the identical
     value there, and the two agree.
     v1 shipped the nested line already substituted with a real value — whichever site
     this block was extracted from — frozen at the moment of extraction. That value was
     correct for the origin site and wrong for every other one, and it could never
     converge: the nested fence's own pass would correct the visible text to each
     site's real key, while this outer fence kept re-emitting the frozen one forever
     after — a permanent `design:check` failure with no fixed point. Declaring
     `langKey` here, matching the nested fence's own declaration, is what makes both
     passes agree instead.
  */
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  // slide numbering is zero-based everywhere the viewer can see it: the kicker on each
  // slide, the transport's display window, and the audio filenames all say the same number.
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  // The language choice is shared with the other pages on this origin, so arriving from
  // the talks index keeps the language the reader already picked. Storage is guarded:
  // file:// is an opaque origin in some browsers and throws, and a deck that cannot read
  // a preference must still open — in English, its default.
  /* ─── language · v2 · deck ─────────────────────────────────────────────
     One language across three domains, and where it is remembered. Generated
     from @robertblust/design — editing it here does nothing, because the next
     `npm run design` overwrites it. Change it in the package.

     This block has a contract with the page around it that `design:check` cannot see, because
     the check only compares bytes between the markers. The page must declare a `lang` variable
     in scope before this fence, and must call `langStored()` and `langRemember(v)` from
     wherever it reads and writes the visitor's saved choice. Rename `lang` or drop those calls
     and the fence still matches byte for byte — every check stays green — while a click throws
     ReferenceError and the language silently stops crossing domains.
  */
  var LANG_KEY = "{{langKey}}";
  function langStored(){ try { return localStorage.getItem(LANG_KEY); } catch (e) { return null; } }
  function langRemember(v){ try { localStorage.setItem(LANG_KEY, v); } catch (e) {} }

  /* One language across three domains. Each origin keeps its own localStorage, so a
     visitor reading German here and following a link to a sibling site would arrive in
     English — three copies of one preference, none of which can see the others. The
     language rides along instead: a link to a family domain gets ?lang= at the moment it
     is clicked, and a page that arrives with one adopts it, stores it, and takes it back
     out of the address bar.

     Decorated at click time, never at load. A family link can sit inside a data-de
     attribute, and switching language replaces that element whole — an href rewritten at
     load would be discarded by the first toggle. It also means no link in the served
     markup carries the param, so nothing crawlable, copyable or bookmarkable does either;
     the address bar is cleaned by replaceState the moment the page reads it. */
  var FAMILY = /^(www\.)?(blust\.ch|companygraph\.io|guestgraph\.io)$/;
  function langFromUrl(){
    var m = /[?&]lang=(de|en)(&|$)/.exec(location.search);
    if (!m) return null;
    try {
      var q = location.search.replace(/([?&])lang=(de|en)(&|$)/, "$1").replace(/[?&]$/, "");
      history.replaceState(null, "", location.pathname + q + location.hash);
    } catch (e) {}
    return m[1];
  }
  function carryLang(e){
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var u; try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin === location.origin || !FAMILY.test(u.hostname)) return;
    u.searchParams.set("lang", lang);
    a.href = u.toString();
  }
  // mousedown as well as click, so a middle-click or a cmd-click opening a new tab
  // carries the language too; both fire before the browser follows the href.
  document.addEventListener("mousedown", carryLang, true);
  document.addEventListener("click", carryLang, true);
  /* ─── end language ─────────────────────────────────────────────────── */


  var urlLang = langFromUrl();
  if (urlLang) langRemember(urlLang);
  var i = 0, notesOpen = false, lang = urlLang || (langStored() === 'de' ? 'de' : 'en');
  var deck = document.getElementById('deck');
  var bar = document.getElementById('bar'), cur = document.getElementById('cur');
  var notes = document.getElementById('notes'), ntext = document.getElementById('ntext'), ntime = document.getElementById('ntime');
  var chrome = document.getElementById('chrome');
  var cliplen = document.getElementById('cliplen');
  var btn = { first:document.getElementById('tFirst'), prev:document.getElementById('tPrev'),
              play:document.getElementById('tPlay'),  next:document.getElementById('tNext'),
              full:document.getElementById('tFull'),  notes:document.getElementById('tNotes') };
  var langDe = document.getElementById('langDe'), langEn = document.getElementById('langEn');
  document.getElementById('tot').textContent = pad(slides.length - 1);

  var i18n = Array.prototype.slice.call(document.querySelectorAll('[data-de]'));
  i18n.forEach(function(el){ el.setAttribute('data-en', el.innerHTML); });

  var UI = {
    de:{ label:'Sprecher-Notiz', close:'Notizen schliessen',
         title:TALK.de.title, desc:TALK.de.desc,
         play:'Vortrag abspielen', pause:'Vortrag pausieren', first:'Zurück zum Anfang',
         prev:'Vorherige Folie', next:'Nächste Folie', full:'Vollbild', unfull:'Vollbild verlassen',
         notes:'Sprecher-Notizen', de:'Auf Deutsch', en:'Auf Englisch', up:'Zurück zu allen Vorträgen' },
    en:{ label:'Speaker note', close:'Close notes',
         title:TALK.en.title, desc:TALK.en.desc,
         play:'Play the talk', pause:'Pause the talk', first:'Back to the start',
         prev:'Previous slide', next:'Next slide', full:'Fullscreen', unfull:'Leave fullscreen',
         notes:'Speaker notes', de:'In German', en:'In English', up:'Back to all talks' }
  };

  function applyLang(){
    i18n.forEach(function(el){ el.innerHTML = el.getAttribute('data-' + lang); });
    var t = UI[lang];
    document.title = t.title;
    document.getElementById('metadesc').setAttribute('content', t.desc);
    document.getElementById('noteslabel').textContent = t.label;
    document.getElementById('notesclose').textContent = t.close;
    langDe.setAttribute('aria-pressed', lang === 'de' ? 'true' : 'false');
    langEn.setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false');
    langDe.setAttribute('aria-label', t.de);
    langEn.setAttribute('aria-label', t.en);
    btn.first.setAttribute('aria-label', t.first);
    btn.prev.setAttribute('aria-label', t.prev);
    btn.next.setAttribute('aria-label', t.next);
    btn.notes.setAttribute('aria-label', t.notes);
    var up = document.getElementById('tUp');
    up.setAttribute('aria-label', t.up);
    up.setAttribute('title', t.up);
    labelPlay();
    labelFull();
    document.documentElement.lang = lang;
    if (playing) {
      if (synth) synth.cancel();
      clip.pause();
      setTimeout(narrateCurrent, 120);
    }
    render();
  }

  // aria-disabled, read by both render() and the handlers below — see the comment in
  // render() for why this is not the `disabled` property.
  function setInert(el, on){ el.setAttribute('aria-disabled', on ? 'true' : 'false'); }
  function isInert(el){ return el.getAttribute('aria-disabled') === 'true'; }

  /* The transport is a real element with a measured height, and two other things have to
     land exactly on top of it: the notes sheet, and the progress bar on mobile. */
  function measureChrome(){
    document.documentElement.style.setProperty('--chromeH', chrome.offsetHeight + 'px');
  }

  function fitNotes(){
    var s = slides[i];
    s.style.transform = '';
    if(!notesOpen) return;
    var avail = notes.getBoundingClientRect().top - 20;
    var need  = s.scrollHeight;
    if(need > avail){ s.style.transform = 'scale(' + Math.max(0.5, avail/need) + ')'; }
  }

  function render(){
    slides.forEach(function(s,n){ if(n!==i) s.style.transform=''; s.classList.toggle('active', n===i); });
    bar.style.width = ((i+1)/slides.length*100) + '%';
    cur.textContent = pad(i);
    if(notesOpen){
      var d = slides[i].dataset;
      /* `data-notes` is English and `data-notes-de` the translation, which is `data-de`'s
         pairing and the page's: the source markup is English and German is what an
         attribute carries. It used to be the other way round for notes alone — the base
         attribute held German while English was the suffixed one — so the base attribute
         meant a different language depending on which of the two you were reading. */
      ntext.innerHTML = (lang === 'de' && d.notesDe) ? d.notesDe : d.notes;
      ntime.textContent = d.time || '';
    }
    /* The ends of the deck, made visible. go() has always clamped, so these controls
       were already no-ops here — this is the state saying so rather than a click that
       does nothing. `first` goes with `prev`: at slide zero it is equally inert, and
       dimming one while the other stays lit next to it reads as a bug.

       `aria-disabled`, not `disabled`: a real `disabled` removes the control from the
       tab order the instant it takes effect, and it can take effect while the control
       holds focus — the user's own Enter, at slide zero, disables `tPrev` under itself
       and the browser drops focus to <body>. `aria-disabled` keeps the same look (see
       `deck transport`'s `.tbtn[aria-disabled="true"]`) and the same announced state
       without moving focus anywhere; the click and keydown handlers below check it and
       return early, so the control still does nothing while it is inert. */
    setInert(btn.prev, i === 0);
    setInert(btn.first, i === 0);
    setInert(btn.next, i === slides.length - 1);
    fitNotes();
  }
  window.addEventListener('resize', function(){ measureChrome(); fitNotes(); });
  function go(n){ i = Math.max(0, Math.min(slides.length-1, n)); render(); }

  /* Turning the page by hand does not end the talk — the voice follows to the slide you
     landed on. JUMP_MS is why: it lets someone click through five slides and hear only the
     fifth, instead of a syllable of each one on the way. Back to the start is the exception,
     because going back to slide zero is leaving the talk, not moving inside it. */
  var JUMP_MS = 400;

  function manual(n){
    if (!playing) { go(n); return; }
    stopVoice();
    go(n);
    gapTimer = setTimeout(function(){ if (playing) narrateCurrent(); }, JUMP_MS);
  }

  function restart(){ if (playing) stopNarration(); go(0); }

  function setNotes(open){
    notesOpen = open;
    notes.classList.toggle('show', notesOpen);
    // the closed sheet is only translated off-screen, so its close button would otherwise
    // still be a tab stop for something nobody can see
    notes.toggleAttribute('inert', !notesOpen);
    deck.classList.toggle('notes-open', notesOpen);
    btn.notes.setAttribute('aria-pressed', notesOpen ? 'true' : 'false');
    render();
  }

  function labelFull(){
    var on = !!document.fullscreenElement;
    btn.full.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.full.setAttribute('aria-label', on ? UI[lang].unfull : UI[lang].full);
  }
  function toggleFull(){
    if(!document.fullscreenElement){
      var r = document.documentElement.requestFullscreen();
      if (r && r.catch) r.catch(function(){});
    } else { document.exitFullscreen(); }
  }
  document.addEventListener('fullscreenchange', function(){ labelFull(); measureChrome(); });

  function setLang(next){ if (next === lang) return; lang = next; langRemember(next); applyLang(); }

  // Each guard reads the control's own aria-disabled rather than the i===0 / last-slide
  // condition directly: the control's state, set once in render(), is the single source
  // both the click and the paint read, rather than two places computing the same thing.
  btn.first.addEventListener('click', function(){ if (isInert(btn.first)) return; restart(); });
  btn.prev .addEventListener('click', function(){ if (isInert(btn.prev))  return; manual(i-1); });
  btn.next .addEventListener('click', function(){ if (isInert(btn.next))  return; manual(i+1); });
  btn.play .addEventListener('click', function(){ toggleNarration(); });
  btn.full .addEventListener('click', toggleFull);
  btn.notes.addEventListener('click', function(){ setNotes(!notesOpen); });
  document.getElementById('notesclose').addEventListener('click', function(){ setNotes(false); });
  langDe.addEventListener('click', function(){ setLang('de'); });
  langEn.addEventListener('click', function(){ setLang('en'); });

  /* The deck is driven by the buttons. These keys stay because a presenter remote sends
     them — it is a clicker pretending to be a keyboard — and are deliberately not
     advertised anywhere on screen. */
  document.addEventListener('keydown', function(e){
    if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown'){ manual(i+1); e.preventDefault(); }
    else if(e.key==='ArrowLeft'||e.key==='PageUp'){ manual(i-1); e.preventDefault(); }
    else if(e.key==='Home'){ restart(); e.preventDefault(); }
    else if(e.key==='End'){ manual(slides.length-1); e.preventDefault(); }
  });

  /* Swipe turns the page on touch. A mostly-vertical drag is someone scrolling a long
     slide, which portrait layout makes routine, so only a decisively horizontal one counts. */
  var tx = 0, ty = 0, tt = 0;
  deck.addEventListener('touchstart', function(e){
    if (e.touches.length !== 1) { tt = 0; return; }
    tx = e.touches[0].clientX; ty = e.touches[0].clientY; tt = Date.now();
  }, {passive:true});
  deck.addEventListener('touchend', function(e){
    if (!tt || Date.now() - tt > 700) return;
    var t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    manual(dx < 0 ? i + 1 : i - 1);
  }, {passive:true});

  measureChrome();
  setNotes(false);
  applyLang();

  /* ---------- narration ----------
     The speaker notes mix stage directions with what is actually said: the <em class='cue'>
     spans are Regie-Instruktionen, the rest is Sprechtext. Only the latter is spoken.

     A recorded clip is played when one exists (audio/<lang>/<nn>.mp3), and the browser's own
     voice reads the note when one does not — so a half-recorded deck still plays end to end.

     Nothing is timed either way. Each slide advances on the end event of whichever source spoke,
     so the deck follows the voice rather than a clock, and stays correct when a note is edited or
     a clip is re-recorded. The data-time cues are untouched: they are the presenter's pacing for
     the live talk, which runs about three times longer than the narration and is a different
     timeline entirely. */
  var synth = window.speechSynthesis;
  var clip = new Audio();
  clip.preload = 'auto';
  var playing = false, utter = null, gapTimer = null;

  // audio needs no speech synthesis, so the control stays even where synthesis is missing

  function labelPlay(){
    var l = playing ? UI[lang].pause : UI[lang].play;
    btn.play.setAttribute('aria-label', l);
    btn.play.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.play.classList.toggle('on', !!playing);
  }

  // the hairline under the track number: how far into this slide's clip the voice is
  function setClipProgress(f){ cliplen.style.width = Math.max(0, Math.min(1, f)) * 100 + '%'; }
  clip.addEventListener('timeupdate', function(){
    if (playing && clip.duration) setClipProgress(clip.currentTime / clip.duration);
  });

  /* The headline, read as the spoken lead-in. On screen it is the thing the eye lands on
     first; in audio nothing announced it, so the argument arrived before its own point. */
  function slideTitle(slide){
    if (slide.dataset.sayTitle === 'no') return '';
    var h = slide.querySelector('h1');
    if (!h) return '';
    var raw = (lang === 'en' && h.dataset.en) ? h.dataset.en : h.innerHTML;
    var d = document.createElement('div'); d.innerHTML = raw;
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function spokenText(slide){
    var raw = (lang === 'de' && slide.dataset.notesDe) ? slide.dataset.notesDe : slide.dataset.notes;
    if (!raw) return '';
    var d = document.createElement('div');
    d.innerHTML = raw;
    // only the directions: a bare <em> is emphasis inside the sentence and must be spoken,
    // or the voice loses the word the line turns on
    d.querySelectorAll('em.cue').forEach(function(e){ e.remove(); });
    var body = (d.textContent || '').replace(/\s+/g, ' ').trim();
    var title = slideTitle(slide);
    return title ? title + '\n\n' + body : body;
  }

  function pickVoice(){
    var want = lang === 'de' ? 'de' : 'en';
    var voices = synth.getVoices() || [];
    var exact = voices.filter(function(v){ return v.lang && v.lang.toLowerCase().indexOf(want) === 0; });
    if (!exact.length) return null;
    // prefer a local voice: network voices stall the onend event the deck advances on
    return exact.filter(function(v){ return v.localService; })[0] || exact[0];
  }

  function say(text, whenDone){
    utter = new SpeechSynthesisUtterance(text);
    var v = pickVoice();
    if (v) utter.voice = v;
    utter.lang = v ? v.lang : (lang === 'de' ? 'de-DE' : 'en-GB');
    utter.rate = 0.98;
    utter.onend = function(){ if (playing) whenDone(); };
    utter.onerror = function(){ stopNarration(); };
    // a throwing speak() would otherwise leave the deck stuck in a playing state that
    // never advances, because onend can no longer fire
    try { synth.speak(utter); } catch (e) { stopNarration(); }
  }

  function clipUrl(n){
    var k = slides[n].querySelector('.kicker');
    var id = k && k.dataset.n ? k.dataset.n : ('0' + n).slice(-2);
    return 'audio/' + lang + '/' + id + '.mp3';
  }

  /* Fetch the next clip while this one plays, so the gap between slides is the pause we
     intended rather than a download. */
  function preloadNext(){
    if (i + 1 >= slides.length) return;
    var a = new Audio(); a.preload = 'auto'; a.src = clipUrl(i + 1);
  }

  function narrateCurrent(){
    if (!playing) return;
    setClipProgress(0);
    var text = spokenText(slides[i]);
    if (!text) { advanceOrStop(); return; }

    clip.onended = function(){ if (playing) advanceOrStop(); };
    clip.onerror = function(){
      // no recording for this slide or this language — read the note instead
      if (playing) say(text, advanceOrStop);
    };
    clip.src = clipUrl(i);
    var started = clip.play();
    if (started && started.catch) {
      started.then(preloadNext).catch(function(){ if (playing) say(text, advanceOrStop); });
    } else {
      preloadNext();
    }
  }

  /* Two pauses, doing different jobs. SETTLE sits on the slide that was just narrated, so the
     point has a moment to land before it is taken away. READ sits on the new slide before the
     voice starts, so it can be read first — a listener has no presenter to watch, and a slide
     talked over from the first frame is a slide nobody reads. */
  var SETTLE_MS = 5000;
  var READ_MS   = 2000;

  function advanceOrStop(){
    if (!playing) return;
    if (i >= slides.length - 1) { stopNarration(); return; }
    gapTimer = setTimeout(function(){
      if (!playing) return;
      go(i + 1);
      gapTimer = setTimeout(function(){ if (playing) narrateCurrent(); }, READ_MS);
    }, SETTLE_MS);
  }

  function startNarration(){
    // synthesis is only the fallback now, so its absence is not a reason to refuse
    if (!synth) { playing = true; labelPlay(); narrateCurrent(); return; }
    playing = true;
    labelPlay();
    narrateCurrent();
  }

  // silence whatever is speaking, without deciding whether the talk is over
  function stopVoice(){
    clearTimeout(gapTimer);
    clip.pause();
    clip.onended = clip.onerror = null;
    if (synth) synth.cancel();
    setClipProgress(0);
  }

  function stopNarration(){
    playing = false;
    stopVoice();
    labelPlay();
  }

  function toggleNarration(){ playing ? stopNarration() : startNarration(); }

  // voices load asynchronously in some browsers
  if (synth && typeof synth.onvoiceschanged !== 'undefined') {
    synth.addEventListener('voiceschanged', function(){ /* refresh list */ });
  }
  window.addEventListener('beforeunload', function(){ if (synth) synth.cancel(); });
  /* ─── end deck runtime ──────────────────────────────────────────────── */
