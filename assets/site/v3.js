// Codeply 3.0 mockups: the app's icons in [data-oi], the effort slider sliding through its levels,
// the wallpaper switcher and the voice caption line. Each runs only while it is on screen.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function onView(el, fn) { new IntersectionObserver(function (es) { fn(es[0].isIntersecting); }, { threshold: .3 }).observe(el); }

  document.querySelectorAll('[data-oi]').forEach(function (el) { if (window.OI && OI[el.dataset.oi]) el.outerHTML = OI[el.dataset.oi]; });

  // effort: the knob steps through the levels this model's provider reports
  document.querySelectorAll('[data-effort]').forEach(function (card) {
    var levels = card.dataset.effort.split(','), track = card.querySelector('.ef-track'), label = card.querySelector('.ef-head span');
    track.insertAdjacentHTML('afterbegin', '<div class="ef-fill"></div>' + levels.map(function (l, i) { return '<span class="ef-stop" style="--s:' + (i / (levels.length - 1)) + '"></span>'; }).join('') + '<div class="ef-knob"></div>');
    var stops = track.querySelectorAll('.ef-stop'), at = Math.min(2, levels.length - 1), dir = 1, timer = null;
    function draw() {
      track.style.setProperty('--f', String(at / (levels.length - 1)));
      label.textContent = levels[at];
      stops.forEach(function (s, j) { s.classList.toggle('passed', j <= at); });
    }
    draw();
    if (reduce) return;
    onView(card, function (v) {
      clearInterval(timer);
      if (v) timer = setInterval(function () {
        if (at + dir < 0 || at + dir > levels.length - 1) dir = -dir;
        at += dir; draw();
      }, 1400);
    });
  });

  // permissions: the bold row moves down the four modes
  document.querySelectorAll('[data-perm-cycle]').forEach(function (menu) {
    var rows = menu.querySelectorAll('.pm3-row'), k = 0, timer = null;
    if (reduce) return;
    onView(menu, function (v) {
      clearInterval(timer);
      if (v) timer = setInterval(function () { k = (k + 1) % rows.length; rows.forEach(function (r, i) { r.classList.toggle('on', i === k); }); }, 1800);
    });
  });

  // wallpapers: the new picture fades in over the old one (and settles from a slight zoom), like the app
  document.querySelectorAll('[data-wp]').forEach(function (box) {
    var win = box.querySelector('.ap-glass') || box.querySelector('.wp'), dots = box.querySelectorAll('.wp-dots i'), k = -1, timer = null, top = null;
    if (!win) return;
    function pick(i) {
      if (i === k) return; k = i;
      var layer = document.createElement('div');
      layer.className = 'wp-l';
      layer.style.backgroundImage = dots[i].style.backgroundImage;
      win.insertBefore(layer, top ? top.nextSibling : win.firstChild);
      var old = top; top = layer;
      requestAnimationFrame(function () { requestAnimationFrame(function () { layer.classList.add('on'); }); });
      if (old) setTimeout(function () { old.remove(); }, 1300);
      dots.forEach(function (d, j) { d.classList.toggle('on', j === i); });
    }
    dots.forEach(function (d, i) { d.addEventListener('click', function () { pick(i); clearInterval(timer); timer = setInterval(next, 4200); }); });
    function next() { pick((k + 1) % dots.length); }
    pick(0);
    if (reduce) return;
    onView(box, function (v) { clearInterval(timer); if (v) timer = setInterval(next, 4200); });
  });

  // voice: the caption line types in on the right, and Wisp's mood follows the line
  document.querySelectorAll('[data-voice]').forEach(function (box) {
    var cap = box.querySelector('.vo3-cap'), face = box.querySelector('[data-wisp]');
    var LINES = [['neutral', 'Morning! You have two meetings and one email that needs you.'], ['happy', 'The checkout fix shipped last night, all tests green.'], ['thinking', 'Let me look at your calendar for a free hour.'], ['surprised', 'Found one at 3. Want me to block it for the pricing page?']];
    var i = 0, timer = null, typing = null;
    function say() {
      var l = LINES[i % LINES.length], k = 0; i++;
      if (face && face.wisp) face.wisp.setMood(l[0]);
      face && face.setAttribute('data-mood', l[0]);
      clearInterval(typing);
      typing = setInterval(function () { cap.textContent = l[1].slice(0, ++k); if (k >= l[1].length) clearInterval(typing); }, 38);
    }
    if (reduce) { cap.textContent = LINES[0][1]; return; }
    onView(box, function (v) { clearInterval(timer); clearInterval(typing); if (v) { say(); timer = setInterval(say, 4200); } });
  });
})();
