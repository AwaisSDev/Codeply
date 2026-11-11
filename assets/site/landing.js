// Codeply landing page: the intro, scroll motion, Wisp on its cloud, the morphing nav and the model logo strip.
// The scroll motion follows the way Apple pages move: lines slide up, the product sits up as you scroll,
// a sentence lights up word by word, a pinned section steps through the day, the film grows into place.

(function () {
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // start once the fonts are in, so the headline doesn't jump; never wait more than half a second
  var go = function () { root.classList.add('lp-go'); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
  setTimeout(go, 500);

  // ---- Wisp on its cloud: says something now and then; click it and it hops ----
  var buddy = document.getElementById('lpBuddy'), bubble = document.getElementById('lpBubble');
  if (buddy && bubble) {
    var LINES = ['Already on it!', 'Inbox: zero.', 'PR is ready to merge.', 'Calling you at 5:30.', 'Checked it in a real browser.', 'Tests pass. All 24.'];
    var n = 0, hide = null, seen = true;
    var say = function (text, ms) {
      bubble.textContent = text; buddy.classList.add('talk');
      clearTimeout(hide); hide = setTimeout(function () { buddy.classList.remove('talk'); }, ms || 2600);
    };
    buddy.addEventListener('click', function () {
      n = (n + 1) % LINES.length;
      if (!reduce) { buddy.classList.remove('hop'); void buddy.offsetWidth; buddy.classList.add('hop'); }
      say(LINES[n]);
    });
    buddy.addEventListener('animationend', function (e) { if (e.animationName === 'lp-hop') buddy.classList.remove('hop'); }, true);
    setTimeout(function () { say(LINES[0], 3200); }, reduce ? 300 : 2200);
    new IntersectionObserver(function (es) { seen = es[0].isIntersecting; }).observe(buddy);
    setInterval(function () {
      if (!seen || document.hidden || buddy.classList.contains('talk')) return;
      n = (n + 1) % LINES.length; say(LINES[n]);
    }, 8000);
  }

  // ---- the sentence: split into words so they can light up one by one ----
  var fill = document.getElementById('lpFill'), words = [];
  if (fill) {
    var HI = { 'Wisp': 1 };
    fill.innerHTML = fill.textContent.trim().split(/\s+/).map(function (w) {
      return '<span class="w' + (HI[w] ? ' hi' : '') + '">' + w + '</span>';
    }).join(' ');
    words = [].slice.call(fill.querySelectorAll('.w'));
  }

  var hero = document.getElementById('lpHero');
  var depthEls = [].slice.call(document.querySelectorAll('.lp-hero [data-depth]'));
  depthEls.forEach(function (el) { el.style.setProperty('--dep', el.dataset.depth + 'px'); });
  var day = document.getElementById('day');
  var steps = day ? [].slice.call(day.querySelectorAll('.lp-steps li')) : [];
  var scenes = day ? [].slice.call(day.querySelectorAll('.lp-scene')) : [];
  var grow = document.getElementById('lpGrow');
  var lastStep = -1, lastLit = -1;

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function update() {
    ticking = false;
    var vh = innerHeight;
    if (hero) {
      var hp = clamp(scrollY / Math.max(1, hero.offsetHeight));
      hero.style.setProperty('--hp', hp.toFixed(4));
      // the window lies back at the top and is flat by the time it's in the middle of the screen
      hero.style.setProperty('--tilt', reduce ? 1 : clamp(scrollY / (vh * .45)).toFixed(4));
    }
    if (words.length) {
      var r = fill.getBoundingClientRect();
      var p = clamp((vh * .85 - r.top) / (r.height + vh * .45));
      var lit = Math.round(p * words.length);
      if (lit !== lastLit) { words.forEach(function (w, i) { w.classList.toggle('on', i < lit); }); lastLit = lit; }
    }
    if (day) {
      var d = day.getBoundingClientRect();
      var dp = clamp(-d.top / Math.max(1, d.height - vh));
      day.style.setProperty('--dp', dp.toFixed(4));
      var st = Math.min(steps.length - 1, Math.floor(dp * steps.length * .999));
      // how far through the current step you are, so the scene keeps drifting while you scroll
      day.style.setProperty('--sf', (dp * steps.length - st).toFixed(4));
      if (st !== lastStep) {
        steps.forEach(function (li, i) { li.classList.toggle('on', i === st); });
        scenes.forEach(function (sc, i) { sc.classList.toggle('on', i === st); sc.classList.toggle('past', i < st); });
        lastStep = st;
      }
    }
    if (grow) {
      var g = grow.getBoundingClientRect();
      fpTarget = reduce ? 1 : clamp((vh - g.top) / (vh * .8));
      if (!fpRaf) fpRaf = requestAnimationFrame(fpLoop);
    }
  }
  // the film doesn't follow the scrollbar one to one: it glides towards where it should be and eases out as it lands
  var fpTarget = 0, fpNow = 0, fpRaf = null;
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function fpLoop() {
    fpNow += (fpTarget - fpNow) * (reduce ? 1 : .085);
    if (Math.abs(fpTarget - fpNow) < .0005) fpNow = fpTarget;
    grow.style.setProperty('--fp', easeOut(fpNow).toFixed(4));
    fpRaf = fpNow === fpTarget ? null : requestAnimationFrame(fpLoop);
  }
  var ticking = false;
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
})();

// ---- highlights: the section pins while you scroll; scrolling down pages the tiles to the left, scrolling up brings
// them back. The rail moves with every bit you scroll, eased by CSS so it glides. The dots follow along,
// the active one fills as you get closer to the next page, and clicking a dot scrolls you to that page ----
(function () {
  var sec = document.getElementById('what'), rail = document.getElementById('lpRail'), dotsBox = document.getElementById('lpDots');
  if (!sec || !rail || !dotsBox) return;
  var tiles = [].slice.call(rail.querySelectorAll('.lp-tile'));
  var dots = [].slice.call(dotsBox.querySelectorAll('button'));
  var n = tiles.length, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EDGE = .03; // a hair of rest at the very start and end of the section
  var target = 0, active = -1;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function step() { return tiles.length > 1 ? tiles[1].offsetLeft - tiles[0].offsetLeft : 0; }

  // where the rail should be for how far down the section you are
  function read() {
    var r = sec.getBoundingClientRect(), span = Math.max(1, sec.offsetHeight - innerHeight);
    var p = clamp(-r.top / span, 0, 1);
    var q = clamp((p - EDGE) / (1 - EDGE * 2), 0, 1) * (n - 1);
    var i = Math.min(n - 1, Math.floor(q)), f = q - i;
    // the rail follows every bit of scrolling; CSS smooths it out
    target = q;
    dotsBox.style.setProperty('--fill', (i >= n - 1 ? 1 : f).toFixed(3));
    var a = Math.round(target);
    if (a !== active) {
      active = a;
      tiles.forEach(function (t, k) { t.classList.toggle('on', k === a); });
      dots.forEach(function (d, k) { d.classList.toggle('on', k === a); d.classList.toggle('done', k < a); });
    }
    // CSS eases the rail to this spot (see .lp-rail's transition), so it glides even if the scroll jumps
    rail.style.setProperty('--hx', (target * step()).toFixed(1));
  }
  // a dot takes you to the scroll position where its page sits still
  dots.forEach(function (d, k) {
    d.addEventListener('click', function () {
      var span = Math.max(1, sec.offsetHeight - innerHeight);
      var p = EDGE + (k / (n - 1)) * (1 - EDGE * 2);
      scrollTo({ top: sec.offsetTop + p * span + (k > 0 && k < n - 1 ? 2 : 0), behavior: reduce ? 'auto' : 'smooth' });
    });
  });
  var ticking = false;
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; read(); }); } }, { passive: true });
  addEventListener('resize', read);
  read();
})();

// ---- mockups in the pinned sections are sized to fit the box they sit in, so none of them is ever cropped.
// Phones change their --s; everything else uses zoom (text is laid out again at the smaller size, so it stays sharp) ----
(function () {
  var stack = matchMedia('(max-width: 760px)'), narrow = matchMedia('(max-width: 900px)');
  var PH = 820 * .918, PW = 390 * .918;
  function phone(w, aw, ah, max) {
    var s = Math.min(max, ah / PH, aw / PW);
    w.style.setProperty('--s', Math.max(.2, s).toFixed(3), 'important');
  }
  function fitDay() {
    var stage = document.querySelector('.lp-day-stage');
    if (!stage) return;
    var aw = stage.clientWidth - 32, ah = stage.clientHeight - 48;
    stage.querySelectorAll('.pv-wrap').forEach(function (w) { phone(w, aw, ah, narrow.matches ? .5 : .68); });
    var pad = stage.querySelector('.lp-scene-pad');
    if (pad) {
      pad.style.zoom = '';
      var k = Math.min(1, aw / pad.offsetWidth, ah / pad.offsetHeight);
      if (k < 1) pad.style.zoom = k.toFixed(3);
    }
  }
  function fitTiles() {
    document.querySelectorAll('.lp-tvis').forEach(function (v) {
      var el = v.firstElementChild;
      if (!el) return;
      var isPhone = el.classList.contains('pv-wrap');
      if (isPhone && el.dataset.s0 === undefined) el.dataset.s0 = el.style.getPropertyValue('--s');
      el.style.zoom = '';
      if (stack.matches) { if (isPhone) el.style.setProperty('--s', el.dataset.s0, 'important'); return; }
      var aw = v.clientWidth - 40, ah = v.clientHeight - 20;
      if (isPhone) { phone(el, aw, ah, .72); return; }
      var k = Math.min(1, aw / el.offsetWidth, ah / el.offsetHeight);
      if (k < 1) el.style.zoom = k.toFixed(3);
    });
  }
  function fitAll() { fitDay(); fitTiles(); }
  addEventListener('resize', fitAll); addEventListener('load', fitAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
  fitAll();
})();

// ---- the app mockup in the hero: a year of activity, a prompt typing itself, this month's bars growing in ----
(function () {
  var app = document.querySelector('.lp-app');
  if (!app) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the activity grid: 40 weeks by 7 days, busier towards today
  var heat = document.getElementById('laHeat');
  if (heat) {
    var seed = 7, html = '';
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var d = 0; d < 7; d++) for (var w = 0; w < 40; w++) {
      var busy = .25 + w / 40 * .7, r = rnd(), lvl = r < busy * .45 ? 3 : r < busy * .75 ? 2 : r < busy ? 1 : 0;
      html += '<i' + (lvl ? ' data-l="' + lvl + '"' : '') + '></i>';
    }
    heat.innerHTML = html;
  }
  var dots = heat ? [].slice.call(heat.querySelectorAll('i[data-l]')) : [];
  var typed = document.getElementById('laTyped');
  var ASKS = ['Make the pricing page work on phones', 'Plan my week around the launch', 'Summarize today’s inbox and draft replies'];
  var k = 0, started = false;
  function light() { dots.forEach(function (el, i) { setTimeout(function () { el.className = 'l' + el.dataset.l; }, reduce ? 0 : i * 4); }); }
  function type() {
    if (!typed || reduce) return;
    var t = ASKS[k++ % ASKS.length], i = 0;
    app.classList.add('typing'); typed.textContent = '';
    (function next() {
      if (i <= t.length) { typed.textContent = t.slice(0, i++); setTimeout(next, 45); return; }
      setTimeout(function () { app.classList.remove('typing'); typed.textContent = ''; setTimeout(type, 1200); }, 2600);
    })();
  }
  new IntersectionObserver(function (es) {
    if (!es[0].isIntersecting || started) return;
    started = true; app.classList.add('shown'); light(); setTimeout(type, 900);
  }, { threshold: .25 }).observe(app);
})();

(function () {
  var shell = document.getElementById('lpShell');
  if (!shell) return;
  var bar = shell.querySelector('.lp-bar');
  var triggers = shell.querySelectorAll('[data-panel]');
  var panels = shell.querySelectorAll('.lp-panel');
  var open = null, closeTimer = null;

  // the pill's size is set in pixels so it can animate between the bar and an open panel
  function size() {
    var w = bar.scrollWidth, h = bar.offsetHeight;
    var p = open && shell.querySelector('.lp-panel[data-for="' + open + '"]');
    if (p) { w = Math.max(w, p.scrollWidth); h += p.offsetHeight; }
    if (innerWidth <= 900) shell.style.removeProperty('width'); else shell.style.width = w + 'px';
    shell.style.height = h + 'px';
  }
  function show(name) {
    clearTimeout(closeTimer);
    open = name;
    panels.forEach(function (p) { p.classList.toggle('on', p.dataset.for === name); });
    triggers.forEach(function (t) { t.setAttribute('aria-expanded', t.dataset.panel === name ? 'true' : 'false'); });
    var burger = shell.querySelector('.lp-burger');
    if (burger) burger.setAttribute('aria-label', name === 'menu' ? 'Close menu' : 'Open menu');
    size();
  }
  function hide() { show(null); }
  function later() { clearTimeout(closeTimer); closeTimer = setTimeout(hide, 220); }

  var openedAt = 0;
  triggers.forEach(function (t) {
    t.addEventListener('click', function (e) {
      e.stopPropagation();
      // a hover just opened it: the click that follows shouldn't shut it again
      if (open === t.dataset.panel && Date.now() - openedAt < 600) return;
      show(open === t.dataset.panel ? null : t.dataset.panel);
      openedAt = Date.now();
      // opened from the keyboard (Enter/Space): move into the menu
      if (e.detail === 0 && open === 'products') focusFirst();
    });
    if (t.classList.contains('lp-dd')) {
      t.addEventListener('mouseenter', function () {
        if (!matchMedia('(hover: hover)').matches || open === t.dataset.panel) return;
        show(t.dataset.panel); openedAt = Date.now();
      });
      t.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowDown') return;
        e.preventDefault();
        if (open !== t.dataset.panel) show(t.dataset.panel);
        focusFirst();
      });
    }
  });
  function focusFirst() {
    var a = shell.querySelector('.lp-panel[data-for="products"] a');
    if (a) requestAnimationFrame(function () { a.focus(); });
  }
  // tabbing out of the nav closes the menu
  shell.addEventListener('focusout', function (e) {
    if (open && e.relatedTarget && !shell.contains(e.relatedTarget)) hide();
  });
  shell.addEventListener('mouseenter', function () { clearTimeout(closeTimer); });
  shell.addEventListener('mouseleave', function () { if (open === 'products') later(); });
  document.addEventListener('click', function (e) { if (open && !shell.contains(e.target)) hide(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !open) return;
    var was = open;
    hide();
    var back = shell.querySelector('[data-panel="' + was + '"]');
    if (back && shell.contains(document.activeElement)) back.focus();
  });
  shell.addEventListener('click', function (e) { if (e.target.closest('.lp-panel a')) hide(); });
  addEventListener('resize', size);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
  size();
  // only animate once the starting size is known
  requestAnimationFrame(function () { shell.classList.add('ready'); });

  // the model logos, white on the sky, scrolling
  var track = document.getElementById('lpLogos');
  if (track) {
    var CDN = '/assets/logos/';
    var L = [['openai', 'OpenAI'], ['claude', 'Claude'], ['gemini', 'Gemini'], ['meta', 'Meta'], ['mistral', 'Mistral'], ['deepseek', 'DeepSeek'],
      ['xai', 'xAI'], ['qwen', 'Qwen'], ['perplexity', 'Perplexity'], ['ollama', 'Ollama'], ['openrouter', 'OpenRouter'], ['huggingface', 'Hugging Face'], ['groq', 'Groq']];
    var html = L.map(function (l) { return '<span><img src="' + CDN + l[0] + '.svg" alt="" width="24" height="24" onerror="this.remove()">' + l[1] + '</span>'; }).join('');
    track.innerHTML = html + html;
  }
})();
