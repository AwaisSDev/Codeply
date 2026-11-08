// Wisp: a flat blue hexagon with two white pill eyes. The eyes follow your cursor and blink, and the
// mood changes the eyes and how it moves. Only the Meet Wisp showcase morphs between shapes. Drawn in SVG, one animation loop for every Wisp on the page.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var N = 144, TAU = Math.PI * 2, CX = 50, CY = 54, R = 40;

  // ---- shapes: a radius for every angle, all with the same number of points so they can morph ----
  function smooth(r, w) {
    if (w < 2) return r;
    var out = [], h = Math.floor(w / 2);
    for (var i = 0; i < N; i++) { var s = 0; for (var k = -h; k <= h; k++) s += r[(i + k + N) % N]; out.push(s / (2 * h + 1)); }
    return out;
  }
  function norm(r) { var m = Math.max.apply(null, r); return r.map(function (v) { return v / m; }); }
  function polar(fn, w) { var r = []; for (var i = 0; i < N; i++) r.push(fn(-Math.PI / 2 + TAU * i / N)); return norm(smooth(r, w)); }
  function poly(n, turn) {
    return function (t) { var seg = TAU / n, phi = ((t + Math.PI / 2 - (turn || 0)) % seg + seg) % seg - seg / 2; return Math.cos(Math.PI / n) / Math.cos(phi); };
  }
  var SHAPES = {
    pentagon: polar(poly(5), 11),
    circle: polar(function () { return 1; }, 1),
    square: polar(poly(4, Math.PI / 4), 13),
    triangle: polar(poly(3), 15),
    hexagon: polar(poly(6, Math.PI / 6), 9), // flat top and base, rounded like the logo
    star: polar(function (t) { return .8 + .2 * Math.cos(5 * (t + Math.PI / 2)); }, 5),
    spiky: polar(function (t) { var c = Math.cos(8 * (t + Math.PI / 2)); return .84 + .16 * Math.sign(c) * Math.pow(Math.abs(c), .6); }, 3),
    blob: polar(function (t) { return 1 + .07 * Math.sin(3 * t + 1) + .05 * Math.cos(5 * t - .4); }, 5),
    cloud: polar(function (t) { return .9 + .1 * Math.abs(Math.cos(3.5 * (t + Math.PI / 2))); }, 5)
  };

  // ---- moods: eyes, a shape, and a colour (flat: one colour, no gradient) ----
  var MOODS = {
    neutral: { shape: 'hexagon', c: ['#2F6BFF', '#2F6BFF'], blink: true },
    happy: { shape: 'circle', c: ['#2F6BFF', '#2F6BFF'], blink: false, bounce: true },
    sad: { shape: 'hexagon', c: ['#2F6BFF', '#2F6BFF'], blink: true, sag: true },
    angry: { shape: 'spiky', c: ['#E5484D', '#E5484D'], blink: false, shake: true },
    sleepy: { shape: 'blob', c: ['#2F6BFF', '#2F6BFF'], blink: false },
    surprised: { shape: 'hexagon', c: ['#2F6BFF', '#2F6BFF'], blink: true },
    thinking: { shape: 'hexagon', c: ['#2F6BFF', '#2F6BFF'], blink: true }
  };
  var EYES = {
    // white pills, 7 x 14 (the logo's 8 x 16 on this smaller body)
    neutral: function (s) { return '<rect x="-3.5" y="-7" width="7" height="14" rx="3.5"/>'; },
    surprised: function (s) { return '<circle r="4"/>'; },
    thinking: function (s) { return '<rect x="-3.3" y="-6.2" width="6.6" height="12.4" rx="3.3"/>'; },
    happy: function (s) { return '<path d="M-4.8 2.2Q0 -5.2 4.8 2.2" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>'; },
    sleepy: function (s) { return '<path d="M-4.6 0Q0 3 4.6 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'; },
    // sorry: small eyes looking down, brows tilted up in the middle
    sad: function (s) { return '<rect x="-3" y="-3.4" width="6" height="10" rx="3"/><path d="' + (s < 0 ? 'M-4.4 -6.2L2 -8.6' : 'M4.4 -6.2L-2 -8.6') + '" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'; },
    angry: function (s) { return s < 0 ? '<path d="M-4.4 -3L4.2 .8L-3.8 3Z"/>' : '<path d="M4.4 -3L-4.2 .8L3.8 3Z"/>'; }
  };

  var all = [], uid = 0, px = null, py = null, lastMove = 0;

  function Wisp(el) {
    var id = 'wg' + (++uid), size = el.dataset.wisp || 'md';
    // Wisp is a hexagon everywhere. Only the Meet Wisp showcase lets a mood or a topic change its shape.
    var morphs = !!el.closest('[data-wisp-stage]');
    el.classList.add('wisp-el');
    el.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="' + id + '" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></linearGradient></defs>' +
      '<g class="w-body"><path class="w-shape" fill="url(#' + id + ')"/><g class="w-eyes"><g class="w-eye l" transform="translate(41 51)"></g><g class="w-eye r" transform="translate(59 51)"></g></g></g></svg>';
    var w = {
      el: el, svg: el.firstChild, path: el.querySelector('.w-shape'), eyes: el.querySelector('.w-eyes'),
      eyeL: el.querySelector('.w-eye.l'), eyeR: el.querySelector('.w-eye.r'), stops: el.querySelectorAll('stop'),
      r: SHAPES.hexagon.slice(), from: null, to: SHAPES.hexagon, t0: 0, dur: 560,
      lx: 0, ly: 0, tx: 0, ty: 0, blinkAt: performance.now() + 1500 + Math.random() * 3000, blink: 0,
      mood: null, phase: Math.random() * 10, visible: true, small: size === 'sm', kick: 0
    };
    w.setShape = function (name) {
      if (!morphs && name !== 'hexagon') return;
      var target = SHAPES[name]; if (!target || target === w.to) return;
      w.from = w.r.slice(); w.to = target; w.t0 = performance.now();
    };
    w.setMood = function (m, keepShape) {
      var M = MOODS[m] || MOODS.neutral; w.mood = m;
      el.dataset.mood = m;
      w.eyeL.innerHTML = EYES[m] ? EYES[m](-1) : EYES.neutral(-1);
      w.eyeR.innerHTML = EYES[m] ? EYES[m](1) : EYES.neutral(1);
      w.stops[0].style.stopColor = M.c[0]; w.stops[1].style.stopColor = M.c[1];
      if (!keepShape && morphs) w.setShape(M.shape);
      w.kick = performance.now();
    };
    w.setMood(el.dataset.mood || 'neutral');
    if (el.dataset.shape) w.setShape(el.dataset.shape);
    new IntersectionObserver(function (es) { w.visible = es[0].isIntersecting; }).observe(el);
    el.addEventListener('click', function () {
      if (el.closest('[data-wisp-stage]')) return;
      var prev = w.mood; w.setMood('happy');
      setTimeout(function () { w.setMood(prev); }, 1400);
    });
    all.push(w); el.wisp = w;
    return w;
  }

  function ease(t) { var c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }

  function frame(now) {
    for (var j = 0; j < all.length; j++) {
      var w = all[j]; if (!w.visible) continue;
      // morph
      if (w.from) {
        var k = Math.min(1, (now - w.t0) / w.dur), e = reduce ? 1 : ease(k);
        for (var i = 0; i < N; i++) w.r[i] = w.from[i] + (w.to[i] - w.from[i]) * e;
        if (k >= 1) w.from = null;
      }
      // body: a slow breath, a bounce when happy, a shake when angry
      var M = MOODS[w.mood] || MOODS.neutral, since = (now - w.kick) / 1000;
      var breathe = reduce ? 0 : Math.sin(now / 900 + w.phase) * .018;
      var sx = 1 - breathe * .6, sy = 1 + breathe, ox = 0, oy = 0;
      if (!reduce && M.bounce) { oy = -Math.abs(Math.sin(now / 260)) * 3.2; sy += Math.abs(Math.sin(now / 260)) * .025; }
      if (!reduce && M.shake && since < 1.6) ox = Math.sin(now / 28) * 1.6 * (1 - since / 1.6);
      if (!reduce && w.mood === 'sleepy') { sy -= .03; oy = 2; }
      if (!reduce && M.sag) { sy -= .045; sx += .02; oy = 2.6; }
      var d = '';
      for (i = 0; i < N; i++) {
        var a = -Math.PI / 2 + TAU * i / N, rr = R * w.r[i];
        var x = CX + ox + rr * Math.cos(a) * sx, y = CY + oy + rr * Math.sin(a) * sy;
        d += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
      }
      w.path.setAttribute('d', d + 'Z');
      // eyes: follow the cursor, wander when it's still, look up when thinking
      var tx = 0, ty = 0;
      if (w.mood === 'thinking') { tx = 4; ty = -4; }
      else if (w.mood === 'sleepy') { tx = 0; ty = 2; }
      else if (w.mood === 'sad') { tx = -1; ty = 2.6; }
      else if (px !== null && now - lastMove < 4000) {
        var b = w.svg.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height * .51;
        var dx = px - cx, dy = py - cy, dist = Math.hypot(dx, dy) || 1, reach = Math.min(1, dist / (b.width * 2.2 + 120));
        tx = dx / dist * 6 * reach; ty = dy / dist * 4.5 * reach;
      } else if (!reduce) { tx = Math.sin(now / 1700 + w.phase) * 3; ty = Math.sin(now / 2300 + w.phase) * 1.5; }
      var lerp = reduce ? 1 : .14; w.lx += (tx - w.lx) * lerp; w.ly += (ty - w.ly) * lerp;
      // blink
      var sc = 1;
      if (M.blink && !reduce) {
        if (now > w.blinkAt) { w.blink = now; w.blinkAt = now + 2200 + Math.random() * 3800; }
        var bt = (now - w.blink) / 150; if (bt < 1) sc = Math.max(.08, Math.abs(1 - 2 * bt));
      }
      w.eyes.setAttribute('transform', 'translate(' + (w.lx + ox).toFixed(2) + ' ' + (w.ly + oy).toFixed(2) + ') translate(50 51) scale(1 ' + sc.toFixed(3) + ') translate(-50 -51)');
    }
    requestAnimationFrame(frame);
  }

  addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; lastMove = performance.now(); }, { passive: true });

  window.Wisp = { mount: function (root) { (root || document).querySelectorAll('[data-wisp]').forEach(function (el) { if (!el.wisp) Wisp(el); }); }, SHAPES: Object.keys(SHAPES), MOODS: Object.keys(MOODS) };
  window.Wisp.mount();
  requestAnimationFrame(frame);

  // ---- the showcase: talk to Wisp. It reads the mood, and changes shape only when what you say calls for it ----
  document.querySelectorAll('[data-wisp-stage]').forEach(function (stage) {
    var w = stage.querySelector('[data-wisp]').wisp, say = stage.querySelector('.ws-say'), input = stage.querySelector('.ws-input input');
    var typing = null;
    var REPLY = {
      neutral: "I'm listening.", happy: 'Glad that helped. What next?',
      sad: "Sorry. That's on me, fixing it right now.",
      angry: 'Nobody talks to you like that. Want me to draft a reply?',
      sleepy: "Still here. I'll keep going while you rest.", surprised: "Oh. Didn't see that coming.", thinking: 'Good question. Give me a second.'
    };
    // things you might describe, and the shape Wisp takes for them
    var TOPICS = [
      [/\b(stars?|rating|favou?rite|shine|shiny|sparkle)\b/i, 'star', 'A star, coming up.'],
      [/\b(clouds?|sky|weather|rain|fluffy)\b/i, 'cloud', 'Very fluffy. Very cloud.'],
      [/\b(water|slime|liquid|melt|wobbly|jelly|chill)\b/i, 'blob', 'Going with the flow.'],
      [/\b(ball|round|circle|bubble|planet|moon)\b/i, 'circle', 'Round and ready.'],
      [/\b(bees?|honey|hexagon|hive)\b/i, 'hexagon', 'Hexagons. My favourite shape.'],
      [/\b(pyramid|triangle|mountain|pointy)\b/i, 'triangle', 'Pointy. On purpose.'],
      [/\b(box|square|cube|block|lego)\b/i, 'square', 'Squared away.']
    ];
    function show(text) { if (!say) return; say.classList.remove('on'); void say.offsetWidth; say.textContent = text; say.classList.add('on'); }
    // Wisp reads who the feeling is aimed at. Upset with Wisp: it's sorry, not defensive.
    // Someone else being mean to you: it's on your side.
    var OTHERS = /\b(my )?(boss|manager|client|customer|teacher|coworker|co-worker|colleague|teammate|friend|ex|mom|dad|brother|sister|someone|somebody|people|he|she|they|this guy|that guy|some guy|reviewer)\b/i;
    var MEAN = /\b(yelled|shouted|screamed|was (so )?(mean|rude)|were (so )?(mean|rude)|(is|are) (so )?(mean|rude)|insulted|bull(y|ied|ying)|called me|laughed at me|blamed me|ignored me|made fun|mocked|disrespected|roasted me|hates? me|dissed)\b/i;
    var AT_WISP = /\b(you|your|u|ur|wisp)\b|\b(it'?s|this is|that'?s) (broken|wrong|bad|useless|garbage|trash)\b|\b(broke|broken|failed|wrong|again|useless|stupid|ugh|wtf)\b/i;
    function read(t) {
      var letters = t.replace(/[^a-z]/gi, ''), caps = letters.replace(/[^A-Z]/g, '').length;
      var shouting = (letters.length > 3 && caps / letters.length > .6) || /!!/.test(t);
      if (OTHERS.test(t) && MEAN.test(t)) return 'angry';
      if (shouting || (AT_WISP.test(t) && /\b(broke|broken|failed|wrong|again|useless|stupid|ugh|wtf|hate|bad|garbage|trash|annoying|slow)\b/i.test(t))) return 'sad';
      if (/\b(thanks|thank you|love|great|nice|awesome|good job|perfect|amazing|cool|lol|yay)\b|:\)|❤/i.test(t)) return 'happy';
      if (/\b(sleep|sleepy|tired|night|bed|later|bye)\b/i.test(t)) return 'sleepy';
      if (/\b(wow|omg|whoa|no way|really)\b/i.test(t)) return 'surprised';
      if (/\?|\b(what|how|why|can you|could you)\b/i.test(t)) return 'thinking';
      return 'neutral';
    }
    function react(t, line) {
      var m = read(t), topic = null;
      for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i][0].test(t)) { topic = TOPICS[i]; break; }
      var moody = m === 'angry' || m === 'sad';
      w.setMood(m, !!topic && !moody);
      if (topic && !moody) w.setShape(topic[1]);
      show(line || (topic && m === 'neutral' ? topic[2] : REPLY[m]));
    }
    // the box is read-only: Wisp types a fixed script into it, and Next skips to the following line
    if (input && input.form) input.form.addEventListener('submit', function (e) { e.preventDefault(); stop(); step(); });
    var demo = [
      ['hey wisp', "Hi, I'm Wisp."],
      ['thanks for fixing checkout', 'Glad that helped. What next?'],
      ['WHY IS THE BUILD BROKEN AGAIN', "Sorry. That's on me, fixing it right now."],
      ['my client was so rude to me today', 'Rude? To you? Want me to draft a reply?'],
      ['make the hero feel like a cloud', 'Very fluffy. Very cloud.'],
      ['can you check the tests?', 'Good question. Give me a second.'],
      ['ok im going to sleep', "Still here. I'll keep going while you rest."],
      ['wow, all green', "Oh. Didn't see that coming."]
    ], di = 0, dt = null, seen = false;
    function stop() { clearTimeout(dt); clearInterval(typing); }
    function step() {
      if (!seen) return;
      var d = demo[di++ % demo.length], k = 0;
      input.value = '';
      typing = setInterval(function () {
        input.value = d[0].slice(0, ++k);
        if (k >= d[0].length) { clearInterval(typing); react(d[0], d[1]); dt = setTimeout(function () { input.value = ''; step(); }, 2600); }
      }, 45);
    }
    new IntersectionObserver(function (es) { seen = es[0].isIntersecting; stop(); if (seen) dt = setTimeout(step, 700); }, { threshold: .4 }).observe(stage);
    w.setMood('neutral'); show("Hi, I'm Wisp.");
  });
})();
