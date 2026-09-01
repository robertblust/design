  /* ─── deck runtime · v1 · {{variant}} ───────────────────────────────────
     The deck's whole runtime — slide navigation, language switching, the notes panel
     and narration — generated from @robertblust/design. Editing it here does nothing,
     because the next `npm run design` overwrites it. Change it in the package.

     ~349 of ~420 lines were already identical on all four decks before this block
     existed; an earlier pass made the rest agree. What was left that genuinely
     differs is four strings: each talk's own title and description, in German and
     English. Everything else about the deck's chrome — every other UI string, every
     control — belongs to this block and is not the page's to change.

     This block has a contract with the page around it that `design:check` cannot see,
     because the check only compares bytes between the markers. The page must declare,
     above this fence:

       var TALK = { de:{ title:'…', desc:'…' }, en:{ title:'…', desc:'…' } };

     Rename `TALK` or drop that declaration and the fence still matches byte for byte —
     every check stays green — while the page throws a ReferenceError on load. The same
     class of unstated seam had to be corrected once already, in blocks/lang.js.

     A `language` fence lives inside this one, parameterised exactly as it is anywhere
     else it appears. The sync tool finds and replaces it independently of this outer
     fence, so its own markers and its own `{{langKey}}` substitution are untouched by
     anything here.
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
  var LANG_KEY = "rb-lang";
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
  var lcdn = document.getElementById('lcdn'), cliplen = document.getElementById('cliplen');
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
         notes:'Sprecher-Notizen', de:'Auf Deutsch', en:'Auf Englisch', novoice:'Keine Stimme', up:'Zurück zu allen Vorträgen' },
    en:{ label:'Speaker note', close:'Close notes',
         title:TALK.en.title, desc:TALK.en.desc,
         play:'Play the talk', pause:'Pause the talk', first:'Back to the start',
         prev:'Previous slide', next:'Next slide', full:'Fullscreen', unfull:'Leave fullscreen',
         notes:'Speaker notes', de:'In German', en:'In English', novoice:'No voice', up:'Back to all talks' }
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
      ntext.innerHTML = (lang === 'en' && d.notesEn) ? d.notesEn : d.notes;
      ntime.textContent = d.time || '';
    }
    /* The ends of the deck, made visible. go() has always clamped, so these controls
       were already no-ops here — this is the state saying so rather than a click that
       does nothing. `first` goes with `prev`: at slide zero it is equally inert, and
       dimming one while the other stays lit next to it reads as a bug. */
    btn.prev.disabled = btn.first.disabled = (i === 0);
    btn.next.disabled = (i === slides.length - 1);
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

  btn.first.addEventListener('click', restart);
  btn.prev .addEventListener('click', function(){ manual(i-1); });
  btn.next .addEventListener('click', function(){ manual(i+1); });
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
  var playing = false, utter = null, gapTimer = null, msgTimer = null;

  // audio needs no speech synthesis, so the control stays even where synthesis is missing

  function labelPlay(){
    var l = playing ? UI[lang].pause : UI[lang].play;
    btn.play.setAttribute('aria-label', l);
    btn.play.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.play.classList.toggle('on', !!playing);
  }

  /* The display window is where a player says NO DISC. A refusal that shows up there reads
     as the machine answering, and needs no second label on the button. */
  function lcdMessage(text){
    clearTimeout(msgTimer);
    lcdn.dataset.keep = lcdn.dataset.keep || lcdn.innerHTML;
    lcdn.textContent = text;
    lcdn.classList.add('msg');
    msgTimer = setTimeout(function(){
      lcdn.innerHTML = lcdn.dataset.keep;
      lcdn.classList.remove('msg');
      delete lcdn.dataset.keep;
      cur = document.getElementById('cur');
      render();
    }, 2600);
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
    var raw = (lang === 'en' && slide.dataset.notesEn) ? slide.dataset.notesEn : slide.dataset.notes;
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
    if (!pickVoice() && !hasClips()) {
      lcdMessage(UI[lang].novoice);
      return;
    }
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

  /* Optimistic, and correct now that this deck has recorded clips: if a clip exists we
     never need a voice installed, and clip.onerror handles the case where one is missing
     by falling back to the browser voice. Reporting false here would refuse to play for
     a viewer with no installed voice even though the recordings would play fine. */
  var clipsSeen = true;
  function hasClips(){ return clipsSeen; }

  function toggleNarration(){ playing ? stopNarration() : startNarration(); }

  // voices load asynchronously in some browsers
  if (synth && typeof synth.onvoiceschanged !== 'undefined') {
    synth.addEventListener('voiceschanged', function(){ /* refresh list */ });
  }
  window.addEventListener('beforeunload', function(){ if (synth) synth.cancel(); });
  /* ─── end deck runtime ──────────────────────────────────────────────── */
