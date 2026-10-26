(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMac = /Mac/i.test(navigator.platform || navigator.userAgent);
  function onView(el, fn, threshold) {
    new IntersectionObserver(function (es) { fn(es[0].isIntersecting); }, { threshold: threshold || .3 }).observe(el);
  }

  // nav: shrinks on scroll, live clock, products launchpad, phone menu
  var nav = document.getElementById('nav');
  function onScroll() { nav.classList.toggle('scrolled', scrollY > 24); }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  var clock = document.getElementById('clock');
  function tick() { try { clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) {} }
  tick(); setInterval(tick, 15000);

  var pad = document.getElementById('pad'), prodBtn = document.getElementById('prodBtn');
  function setPad(open) { pad.classList.toggle('open', open); prodBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  prodBtn.addEventListener('click', function (e) { e.stopPropagation(); setPad(!pad.classList.contains('open')); });
  document.addEventListener('click', function (e) { if (!pad.contains(e.target)) setPad(false); });

  var mb = document.getElementById('menuBtn'), mn = document.getElementById('mnav');
  mn.innerHTML = '<div class="pad">' + pad.innerHTML + '<div class="extra"><a href="/docs">Docs</a><a href="/changelog">Changelog</a><a href="/download">Download</a></div></div>';
  function setMenu(open) {
    mn.classList.toggle('open', open);
    mb.setAttribute('aria-expanded', open ? 'true' : 'false');
    mb.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  mb.addEventListener('click', function () { setMenu(!mn.classList.contains('open')); });
  mn.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setPad(false); if (mn.classList.contains('open')) { setMenu(false); mb.focus(); } } });
  addEventListener('resize', function () { if (innerWidth > 980) setMenu(false); });

  // Mac visitors: the Mac button leads
  var mac = document.getElementById('macBtn'), win = document.getElementById('winBtn');
  if (isMac && mac && win) {
    mac.parentNode.parentNode.insertBefore(mac.parentNode, win.parentNode);
    mac.classList.add('blue'); win.classList.remove('blue');
  }

  // reveal on scroll
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });

  // bots, drawn by the same code the Crew app uses
  var BOTS = {
    orion: { shape: 'burst9', eyes: 'pills', color: 'graphite' },
    vera: { shape: 'drop', eyes: 'big', color: 'blue' },
    remy: { shape: 'cloud', eyes: 'happy', color: 'pink', cheeks: true },
    quinn: { shape: 'squircle', eyes: 'ovals', color: 'teal', glasses: 'round' },
    wren: { shape: 'star', eyes: 'dots', color: 'orange', accessory: 'sprout' },
    shella: { shape: 'cloud', eyes: 'pills', color: 'graphite', glasses: 'visor' },
    penny: { shape: 'flower', eyes: 'pills', color: 'yellow', accessory: 'sparkles' },
    cloudy: { shape: 'cloud', eyes: 'happy', color: 'sky', cheeks: true },
    sleepy: { shape: 'cloud', eyes: 'sleepy', color: 'sky', cheeks: true }
  };
  if (window.CraftAvatar) {
    try { if (CraftAvatar.injectAvatarStyles) CraftAvatar.injectAvatarStyles(); } catch (e) {}
    document.querySelectorAll('[data-avatar]').forEach(function (el) {
      var a = BOTS[el.dataset.avatar]; if (!a) return;
      try { el.innerHTML = CraftAvatar.renderAvatar(a, 96, reduce ? { still: true } : {}); } catch (e) {}
    });
  }

  // things on the desktop can be picked up and moved
  var z = 5;
  document.querySelectorAll('.prop').forEach(function (el) {
    var sx, sy, ox, oy, moved, id = null;
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || getComputedStyle(el).position !== 'absolute') return;
      id = e.pointerId; moved = false; sx = e.clientX; sy = e.clientY;
      ox = parseFloat(el.dataset.x || 0); oy = parseFloat(el.dataset.y || 0);
      el.setPointerCapture(id); el.classList.add('held');
    });
    el.addEventListener('pointermove', function (e) {
      if (e.pointerId !== id) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      el.dataset.x = ox + dx; el.dataset.y = oy + dy;
      el.style.translate = (ox + dx) + 'px ' + (oy + dy) + 'px';
    });
    function drop(e) {
      if (e.pointerId !== id) return;
      id = null; el.classList.remove('held'); if (moved) el.classList.add('moved');
      el.style.zIndex = ++z;
    }
    el.addEventListener('pointerup', drop);
    el.addEventListener('pointercancel', drop);
  });

  // the film
  var hello = document.getElementById('hello'), vid = document.getElementById('helloVid');
  if (hello && vid) document.getElementById('play').addEventListener('click', function () {
    vid.controls = true; hello.classList.add('playing');
    var p = vid.play(); if (p && p.catch) p.catch(function () {});
  });
  if (vid) vid.addEventListener('ended', function () { hello.classList.remove('playing'); vid.controls = false; });

  // live app windows: children with data-at appear on a timeline that loops,
  // data-flag adds .flag, data-type types its text out
  function Scene(root) {
    var timers = [], loop = +root.dataset.loop || 10000, running = false;
    var items = [].slice.call(root.querySelectorAll('[data-at]'));
    var flags = [].slice.call(root.querySelectorAll('[data-flag]'));
    var types = [].slice.call(root.querySelectorAll('[data-type]'));
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function reset() {
      timers.forEach(clearTimeout); timers = [];
      items.forEach(function (el) { el.classList.remove('on'); });
      flags.forEach(function (el) { el.classList.remove('flag'); });
      types.forEach(function (el) { el.textContent = ''; });
    }
    function play() {
      reset();
      if (reduce) {
        items.forEach(function (el) { el.classList.add('on'); });
        flags.forEach(function (el) { el.classList.add('flag'); });
        types.forEach(function (el) { el.textContent = el.dataset.type; });
        return;
      }
      items.forEach(function (el) { later(function () { el.classList.add('on'); }, +el.dataset.at); });
      flags.forEach(function (el) { later(function () { el.classList.add('flag'); if (el.classList.contains('keys')) later(function () { el.classList.remove('flag'); }, 240); }, +el.dataset.flag); });
      types.forEach(function (el) {
        var text = el.dataset.type, k = 0;
        later(function step() { el.textContent = text.slice(0, ++k); if (k < text.length) later(step, 32 + Math.random() * 36); }, +el.dataset.at + 150);
      });
      later(function () { if (running) play(); }, loop);
    }
    return {
      start: function () { if (running) return; running = true; play(); },
      stop: function () { running = false; reset(); },
      restart: function () { running = true; play(); }
    };
  }
  var dockScenes = {};
  document.querySelectorAll('.scene').forEach(function (root) {
    var s = Scene(root), pw = root.closest('.pc-win');
    if (pw) { dockScenes[pw.dataset.app] = s; return; }
    onView(root, function (v) { if (v) s.start(); else s.stop(); }, .35);
  });

  // real app screens: step through their states while they're on screen
  document.querySelectorAll('[data-frames]').forEach(function (box) {
    var imgs = [].slice.call(box.querySelectorAll('img')), i = 0, timer = null;
    if (imgs.length < 2 || reduce) return;
    var clicks = box.hasAttribute('data-click');
    function step() {
      imgs[i].classList.remove('on'); i = (i + 1) % imgs.length; imgs[i].classList.add('on');
      timer = setTimeout(next, i === imgs.length - 1 ? 4200 : 2800);
    }
    // a cursor glides to the button and clicks it, then the next state shows
    function next() {
      if (!clicks || i !== 0) return step();
      box.classList.add('clicking');
      timer = setTimeout(function () { box.classList.add('press'); timer = setTimeout(function () { box.classList.remove('press'); step(); setTimeout(function () { box.classList.remove('clicking'); }, 500); }, 220); }, 900);
    }
    onView(box, function (v) {
      clearTimeout(timer);
      if (v) timer = setTimeout(next, 2400);
      else { imgs.forEach(function (im, k) { im.classList.toggle('on', k === 0); }); i = 0; }
    }, .3);
  });

  // the CLI: the same mascot, colours and glyphs as codeply-cli's tui.mjs
  (function () {
    if (!document.getElementById('ball')) return;
    var PIX = ['...XXXX...', '.XXXXXXXX.', '.XXXXXXXX.', 'XXX.XX.XXX', 'XXX.XX.XXX', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.', '.XXXXXXXX.', '...XXXX...'];
    var A = [0x6f, 0xa3, 0xff], B = [0x1f, 0x56, 0xe0], ball = document.getElementById('ball'), html = '';
    PIX.forEach(function (row, y) {
      var t = y / (PIX.length - 1), c = 'rgb(' + A.map(function (v, k) { return Math.round(v + (B[k] - v) * t); }).join(',') + ')';
      row.split('').forEach(function (ch) { html += '<i' + (ch === 'X' ? ' style="background:' + c + '"' : '') + '></i>'; });
    });
    ball.innerHTML = html;
    var log = document.getElementById('ttyLog'), input = document.getElementById('ttyIn'), cmp = input.parentNode, timers = [], running = false;
    var esc = function (x) { return x.replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
    var tty = document.getElementById('tty');
    var line = function (h) { var d = document.createElement('div'); d.innerHTML = h; log.appendChild(d); tty.scrollTop = tty.scrollHeight; return d; };
    var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };
    var PROMPT = 'fix the failing test in math.js';
    var STEPS = [
      [1500, '<span class="t-ok">●</span> <span class="t-b">Read</span> <span class="t-sec">src/math.js</span>'],
      [2300, '<span class="t-ok">●</span> <span class="t-b">Update</span> <span class="t-sec">src/math.js</span><span class="br">⎿  1 line changed</span>'],
      [3300, '<span class="t-ok">●</span> <span class="t-b">Run</span> <span class="t-sec">npm test</span><span class="br">⎿  Tests: 12 passed, 12 total</span>'],
      [4300, '<span class="t-text" style="font-weight:400">●</span> Fixed. sum() rounded before adding, so totals were a cent off. All 12 tests pass.'],
      [4900, '<span class="t-faint">── Worked for 14s · 3 steps · changed src/math.js ─────────</span>'],
    ];
    function reset() { timers.forEach(clearTimeout); timers = []; log.innerHTML = ''; input.textContent = ''; cmp.classList.remove('typing'); tty.scrollTop = 0; }
    function play() {
      reset();
      if (reduce) { line('<span class="t-dim">›</span> <span class="t-sec">' + PROMPT + '</span>'); STEPS.forEach(function (s) { line(s[1]); }); return; }
      var k = 0;
      later(function type() {
        cmp.classList.add('typing'); input.textContent = PROMPT.slice(0, ++k);
        if (k < PROMPT.length) return later(type, 38 + Math.random() * 40);
        later(function () {
          reset(); cmp.classList.remove('typing');
          line('<span class="t-dim">›</span> <span class="t-sec">' + esc(PROMPT) + '</span>');
          var spin = line('<span class="t-acc">✻</span> <span class="t-sec">Untangling…</span><span class="t-faint"> (2s · esc to interrupt)</span>');
          later(function () { spin.remove(); }, 1400);
          STEPS.forEach(function (st) { later(function () { line(st[1]); }, st[0]); });
          later(function () { if (running) play(); }, 10500);
        }, 500);
      }, 700);
    }
    dockScenes.cli = {
      start: function () { if (running) return; running = true; play(); },
      stop: function () { running = false; reset(); },
      restart: function () { running = true; play(); }
    };
    // on its own page (no dock) it plays whenever it's on screen
    if (!document.getElementById('pc')) onView(tty, function (v) { if (v) dockScenes.cli.start(); else dockScenes.cli.stop(); }, .3);
  })();

  // moments: the waveform never stops, the bubble types a few things in turn
  document.querySelectorAll('.moment[data-say]').forEach(function (m) {
    var wave = m.querySelector('.wave'), t = m.querySelector('.bubble .t'), lines = m.dataset.say.split('|');
    for (var i = 0; i < 13; i++) { var b = document.createElement('i'); b.style.setProperty('--i', (i * 7) % 13); wave.appendChild(b); }
    m.querySelector('.bubble').setAttribute('aria-label', (m.dataset.who || 'You') + ': ' + lines[0]);
    if (reduce) { t.textContent = lines[0]; return; }
    var n = 0, visible = false, busy = false;
    function say() {
      if (!visible) { busy = false; return; }
      busy = true;
      var text = lines[n++ % lines.length], k = t.textContent.length;
      (function erase() {
        if (k > 0) { t.textContent = t.textContent.slice(0, --k); return setTimeout(erase, 14); }
        (function type() {
          t.textContent = text.slice(0, ++k);
          if (k < text.length) setTimeout(type, 34 + Math.random() * 40);
          else setTimeout(say, 2600);
        })();
      })();
    }
    onView(m.querySelector('.bubble'), function (v) { visible = v; if (v && !busy) say(); }, .5);
  });

  // call waveform
  document.querySelectorAll('.vwave').forEach(function (w) {
    for (var i = 0; i < 15; i++) { var b = document.createElement('i'); b.style.setProperty('--i', (i * 5) % 15); w.appendChild(b); }
  });

  // everywhere else: a dock that opens one app at a time
  var pc = document.getElementById('pc'), copy = document.getElementById('pcCopy');
  if (pc) (function () {
  var tabs = [].slice.call(pc.querySelectorAll('.dock button')), current = null, auto = true, autoTimer = null, pcVisible = false;
  function open(app) {
    if (current && dockScenes[current]) dockScenes[current].stop();
    current = app;
    pc.querySelectorAll('.pc-win').forEach(function (w) {
      var on = w.dataset.app === app; w.classList.toggle('open', on);
      if (on) copy.innerHTML = '<h3 class="h3">' + w.dataset.title + '</h3><p class="p">' + w.dataset.text + '</p><a class="more" href="' + w.dataset.href + '">' + w.dataset.link + '</a>';
    });
    tabs.forEach(function (b) { b.setAttribute('aria-selected', b.dataset.open === app ? 'true' : 'false'); });
    if (pcVisible && dockScenes[app]) dockScenes[app].restart();
  }
  function cycle() {
    clearTimeout(autoTimer);
    if (!auto || !pcVisible || reduce) return;
    autoTimer = setTimeout(function () {
      var i = tabs.findIndex(function (b) { return b.dataset.open === current; });
      open(tabs[(i + 1) % tabs.length].dataset.open); cycle();
    }, 7000);
  }
  tabs.forEach(function (b) { b.addEventListener('click', function () { auto = false; clearTimeout(autoTimer); open(b.dataset.open); }); });
  open('cli');
  onView(pc, function (v) {
    pcVisible = v;
    if (v) { if (dockScenes[current]) dockScenes[current].restart(); cycle(); }
    else { clearTimeout(autoTimer); if (dockScenes[current]) dockScenes[current].stop(); }
  }, .3);
  })();

  // CLI install line
  var CMDS = { win: 'irm https://codeply.online/install.ps1 | iex', nix: 'curl -fsSL https://codeply.online/install.sh | sh' };
  var osBtns = document.querySelectorAll('.inst [data-os]'), cmd = document.getElementById('cmd');
  function pickOs(os) {
    osBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.os === os ? 'true' : 'false'); });
    cmd.textContent = CMDS[os];
  }
  osBtns.forEach(function (b) { b.addEventListener('click', function () { pickOs(b.dataset.os); }); });
  if (isMac && cmd) pickOs('nix');
  var copyBtn = document.getElementById('copy');
  if (copyBtn && cmd) copyBtn.addEventListener('click', function () {
    var b = this;
    (navigator.clipboard ? navigator.clipboard.writeText(cmd.textContent) : Promise.reject()).then(
      function () { b.textContent = 'Copied'; }, function () { b.textContent = 'Select it'; });
    setTimeout(function () { b.textContent = 'Copy'; }, 1600);
  });

  // questions
  document.querySelectorAll('.q button').forEach(function (b) {
    b.addEventListener('click', function () {
      var open = b.parentNode.classList.toggle('open');
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  // the footer wordmark, built from little tiles
  var G = {
    c: ['....', '....', '.###', '#...', '#...', '#...', '.###', '....', '....'],
    o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.', '.....', '.....'],
    d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####', '.....', '.....'],
    e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.####', '.....', '.....'],
    p: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '####.', '#....', '#....'],
    l: ['#.', '#.', '#.', '#.', '#.', '#.', '.#', '..', '..'],
    y: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####', '....#', '####.']
  };
  var word = 'codeply', cols = 0, cells = [];
  word.split('').forEach(function (ch, n) {
    G[ch].forEach(function (row, r) { row.split('').forEach(function (v, c) { if (v === '#') cells.push([cols + c, r]); }); });
    cols += G[ch][0].length + (n < word.length - 1 ? 1 : 0);
  });
  var SHADES = ['#2f6bff', '#4a7dff', '#5f8dff', '#7fa4ff', '#1d4fd8'];
  var u = 10, gap = 1.4, svg = '<svg viewBox="0 0 ' + (cols * u) + ' ' + (9 * u) + '" aria-hidden="true">';
  cells.forEach(function (p, k) {
    svg += '<rect x="' + (p[0] * u + gap / 2) + '" y="' + (p[1] * u + gap / 2) + '" width="' + (u - gap) + '" height="' + (u - gap) + '" rx="2.4" fill="' + SHADES[(p[0] * 7 + p[1] * 3) % SHADES.length] + '" style="--k:' + k + '"/>';
  });
  var px = document.getElementById('pixels');
  if (px) {
  px.insertAdjacentHTML('afterbegin', svg + '</svg>');
  if (!reduce) {
    px.style.visibility = 'hidden';
    var pio = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      pio.disconnect(); px.style.visibility = ''; px.classList.add('drop');
    }, { threshold: .2 });
    pio.observe(px);
  }
  }

  document.querySelectorAll('[data-year]').forEach(function (e) { e.textContent = new Date().getFullYear(); });
})();
