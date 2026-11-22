// Yune home: floating pill nav on scroll, reveal on scroll, and the "Everything in one place" tabs.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nav = document.getElementById('nv');
  function onScroll() { nav.classList.toggle('scrolled', scrollY > 40); }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  var items = document.querySelectorAll('.rv');
  if (reduce || !('IntersectionObserver' in window)) items.forEach(function (el) { el.classList.add('in'); });
  else {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: .06 });
    items.forEach(function (el) { io.observe(el); });
  }

  // tabs: pick one to see it in the window; cycles on its own until you click
  var tabs = [].slice.call(document.querySelectorAll('.tab')), panes = document.querySelectorAll('.pane'), timer = null, i = 0;
  function show(name) {
    tabs.forEach(function (t) { var on = t.dataset.tab === name; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
    panes.forEach(function (p) { p.classList.toggle('on', p.dataset.pane === name); });
  }
  tabs.forEach(function (t, k) { t.addEventListener('click', function () { clearInterval(timer); i = k; show(t.dataset.tab); }); });
  if (!reduce && tabs.length) timer = setInterval(function () { i = (i + 1) % tabs.length; show(tabs[i].dataset.tab); }, 3600);

  // Yune Code in the terminal: the same window as the real site, a task typed, then step by step
  function loop(box, steps, total) {
    var timers = [], on = false;
    function run() { steps.forEach(function (st) { timers.push(setTimeout(st[1], st[0])); }); timers.push(setTimeout(run, total)); }
    function stop() { timers.forEach(clearTimeout); timers = []; }
    if (reduce) { steps.forEach(function (st) { st[1](); }); return; }
    new IntersectionObserver(function (es) { var v = es[0].isIntersecting; if (v && !on) { on = true; run(); } else if (!v && on) { on = false; stop(); } }).observe(box);
  }
  document.querySelectorAll('[data-cli]').forEach(function (box) {
    box.innerHTML = '<div class="term-live' + (box.dataset.cli === 'short' ? ' short' : '') + '"><div class="tb"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span>yune code · ~/code/lumen-site</span></div>' +
      '<div class="tty" role="img" aria-label="Yune Code fixing a failing test in the terminal"><div class="cb"><div class="cb-top"><span class="tball" aria-hidden="true"></span><div><b class="t-text">Hey there, I&#39;m Yune Code. What are we building?</b><div><span class="t-sec">Send </span>/help<span class="t-sec"> for help, </span>?<span class="t-sec"> for shortcuts</span></div><div><span class="t-acc">Build mode</span><span class="t-dim"> · tab to switch</span></div></div></div>' +
      '<div class="cb-info"><span class="t-dim">Directory: </span><span class="t-sec">~/code/lumen-site</span><br><span class="t-dim">Account:   </span><span class="t-sec">you@yourmail.com</span><br><span class="t-dim">Model:     </span><span class="t-sec">Auto</span></div></div>' +
      '<div class="tl"></div><div class="cmp"><span class="t-acc">›</span> <span class="tin"></span><span class="tcur"></span><span class="ph">Ask for a change, a fix, or an explanation</span></div>' +
      '<div class="cft"><span><span class="t-acc">Build mode</span><span class="t-dim"> (tab to switch) · ? for shortcuts</span></span><span class="t-sec">Auto</span></div></div></div>';
    var PIX = ['...XXXX...', '.XXXXXXXX.', '.XXXXXXXX.', 'XXX.XX.XXX', 'XXX.XX.XXX', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.', '.XXXXXXXX.', '...XXXX...'];
    var A = [0x6f, 0xa3, 0xff], B = [0x1f, 0x56, 0xe0], html = '';
    PIX.forEach(function (r, y) { var t = y / (PIX.length - 1), c = 'rgb(' + A.map(function (v, k) { return Math.round(v + (B[k] - v) * t); }).join(',') + ')';
      r.split('').forEach(function (ch) { html += '<i' + (ch === 'X' ? ' style="background:' + c + '"' : '') + '></i>'; }); });
    box.querySelector('.tball').innerHTML = html;
    var tty = box.querySelector('.tty'), log = box.querySelector('.tl'), input = box.querySelector('.tin'), cmp = box.querySelector('.cmp'), spin = null;
    function line(h) { var d = document.createElement('div'); d.innerHTML = h; log.appendChild(d); tty.scrollTop = tty.scrollHeight; return d; }
    var PROMPT = 'fix the failing test in math.js';
    var steps = [[0, function () { log.innerHTML = ''; input.textContent = ''; cmp.classList.remove('typing'); tty.scrollTop = 0; }]];
    for (var i = 1; i <= PROMPT.length; i++) (function (i) { steps.push([700 + i * 55, function () { cmp.classList.add('typing'); input.textContent = PROMPT.slice(0, i); }]); })(i);
    var t0 = 700 + PROMPT.length * 55 + 500;
    steps.push([t0, function () { input.textContent = ''; cmp.classList.remove('typing'); line('<span class="t-dim">›</span> <span class="t-sec">' + PROMPT + '</span>'); spin = line('<span class="t-acc">✻</span> <span class="t-sec">Untangling…</span><span class="t-faint"> (2s · esc to interrupt)</span>'); }]);
    steps.push([t0 + 1400, function () { if (spin) spin.remove(); }]);
    [[1500, '<span class="t-ok">●</span> <span class="t-b">Read</span> <span class="t-sec">src/math.js</span>'],
     [2300, '<span class="t-ok">●</span> <span class="t-b">Update</span> <span class="t-sec">src/math.js</span><span class="br">⎿  1 line changed</span>'],
     [3300, '<span class="t-ok">●</span> <span class="t-b">Run</span> <span class="t-sec">npm test</span><span class="br">⎿  Tests: 12 passed, 12 total</span>'],
     [4300, '<span class="t-text" style="font-weight:400">●</span> Fixed. sum() rounded before adding, so totals were a cent off. All 12 tests pass.'],
     [4900, '<span class="t-faint">── Worked for 14s · 3 steps · changed src/math.js ─────────</span>']
    ].forEach(function (st) { steps.push([t0 + st[0], function () { line(st[1]); }]); });
    loop(box, steps, t0 + 9000);
  });
})();
