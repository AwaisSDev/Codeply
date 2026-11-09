(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the glass cards on the scene come in one after the other
  document.querySelectorAll('.gcard').forEach(function (c, i) {
    setTimeout(function () { c.classList.add('on'); }, reduce ? 0 : 900 + i * 650);
  });
  // mark the page you're on
  var here = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  document.querySelectorAll('.links a, .mnav a').forEach(function (a) {
    if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
  });
})();

// the film: the play pill follows the cursor around the window and goes back to the middle when it leaves
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var win = document.getElementById('hello'), vid = document.getElementById('helloVid');
  var area = document.getElementById('playArea'), pill = document.getElementById('play');
  if (!win || !vid || !area || !pill) return;
  var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function center() { tx = (area.clientWidth - pill.offsetWidth) / 2; ty = (area.clientHeight - pill.offsetHeight) / 2; }
  function draw() { pill.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)'; }
  function loop() {
    var k = reduce ? 1 : .18; cx += (tx - cx) * k; cy += (ty - cy) * k; draw();
    raf = Math.abs(tx - cx) + Math.abs(ty - cy) > .3 ? requestAnimationFrame(loop) : null;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  function snap() { center(); cx = tx; cy = ty; draw(); }
  snap(); addEventListener('load', snap); addEventListener('resize', snap);
  area.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var r = area.getBoundingClientRect();
    tx = clamp(e.clientX - r.left - pill.offsetWidth / 2, 12, r.width - pill.offsetWidth - 12);
    ty = clamp(e.clientY - r.top - pill.offsetHeight / 2, 12, r.height - pill.offsetHeight - 12);
    kick();
  });
  area.addEventListener('pointerleave', function () { center(); kick(); });
  area.addEventListener('click', function () {
    vid.controls = true; win.classList.add('playing');
    var p = vid.play(); if (p && p.catch) p.catch(function () {});
  });
  vid.addEventListener('ended', function () { win.classList.remove('playing'); vid.controls = false; });
})();

// what it can do: the section pins while you scroll and each stretch of scrolling shows the next item,
// so nothing gets skipped. Without pinning (small screens), pick an item or let it move on by itself.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wide = matchMedia('(min-width: 981px)');
  document.querySelectorAll('[data-tabs]').forEach(function (box) {
    var items = [].slice.call(box.querySelectorAll('[data-tab]')), panes = box.querySelectorAll('[data-pane]');
    var outer = box.closest('[data-tabs-scroll]'), timer = null, auto = !reduce, seen = false, cur = -1;
    function show(i) {
      if (i === cur) return; cur = i;
      var k = items[i].dataset.tab;
      items.forEach(function (b) { var on = b.dataset.tab === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      panes.forEach(function (p) { p.classList.toggle('on', p.dataset.pane === k); });
      var list = items[i].parentNode; if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: items[i].offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
      fit();
    }
    function pinned() { return !!outer; }
    function onScroll() {
      if (!pinned()) return;
      var r = outer.getBoundingClientRect(), range = outer.offsetHeight - innerHeight;
      var p = Math.min(.999, Math.max(0, -r.top / Math.max(1, range)));
      show(Math.floor(p * items.length));
    }
    function next() {
      clearTimeout(timer); if (pinned() || !auto || !seen) return;
      timer = setTimeout(function () { show((cur + 1) % items.length); next(); }, 9000);
    }
    items.forEach(function (b, i) {
      b.addEventListener('click', function () {
        auto = false; clearTimeout(timer);
        if (pinned()) {
          var top = outer.getBoundingClientRect().top + scrollY, range = outer.offsetHeight - innerHeight;
          scrollTo({ top: top + range * (i + .5) / items.length, behavior: reduce ? 'auto' : 'smooth' });
        } else show(i);
      });
    });
    function layout() { if (outer) outer.style.setProperty('--n', items.length); onScroll(); }
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', layout);
    wide.addEventListener && wide.addEventListener('change', layout);
    new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen) next(); else clearTimeout(timer); }, { threshold: .4 }).observe(box);
    show(0); layout();
  });
})();

// big app windows scaled down to fit the panel they sit in
function fit() {
  document.querySelectorAll('.scaler').forEach(function (sc) {
    var inner = sc.firstElementChild, w = (inner && inner.offsetWidth) || +sc.dataset.w || 1160;
    if (!inner || !sc.offsetWidth) return;
    var k = Math.min(1, sc.offsetWidth / w);
    inner.style.transform = 'scale(' + k + ')';
    sc.style.height = (inner.offsetHeight * k) + 'px';
  });
}
addEventListener('resize', fit); addEventListener('load', fit); fit();

// phones and tablets: size the app window and phones in "See what Codeply can do" to the panel's height,
// so on a short screen (browser bars showing) the whole mockup stays inside the panel instead of being cut off
function fitTabs() {
  var small = window.matchMedia('(max-width: 980px)').matches;
  document.querySelectorAll('.tf-pane').forEach(function (pane) {
    var cs = getComputedStyle(pane);
    var availH = pane.clientHeight - parseFloat(cs.paddingTop) - 18;
    var availW = pane.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    pane.querySelectorAll('.pv-wrap').forEach(function (w) {
      if (!small) { w.style.removeProperty('--s'); return; }
      var s = Math.min(.72, availH / (820 * .918), availW / (390 * .918));
      w.style.setProperty('--s', Math.max(.4, s).toFixed(3), 'important');
    });
    var sc = pane.querySelector('.scaler'), ap = sc && sc.firstElementChild, body = ap && ap.querySelector('.ap-body');
    if (!body) return;
    body.style.removeProperty('height');
    if (!small || !sc.offsetWidth || !ap.offsetWidth) return;
    var k = Math.min(1, sc.offsetWidth / ap.offsetWidth);
    var chrome = ap.offsetHeight - body.offsetHeight;
    body.style.setProperty('height', Math.max(300, availH / k - chrome) + 'px', 'important');
  });
  fit();
}
addEventListener('resize', fitTabs); addEventListener('load', fitTabs); fitTabs();

// desktop: the panel's contents sit on a fixed 908 x 660 canvas, scaled to whatever size the panel ends up
function fitStage() {
  document.querySelectorAll('.tf-stage').forEach(function (st) {
    var panel = st.parentElement;
    if (window.matchMedia('(max-width: 980px)').matches || !panel.offsetWidth) { st.style.removeProperty('--k'); return; }
    st.style.setProperty('--k', (panel.offsetWidth / 908).toFixed(4));
  });
}
addEventListener('resize', fitStage); addEventListener('load', fitStage); fitStage();

// the rotating word: the pill grows or shrinks to the word that's showing
(function fitRot() {
  var rot = document.getElementById('rot'); if (!rot) return;
  function size() { var on = rot.querySelector('.on'); if (on) rot.style.width = on.offsetWidth + 'px'; }
  new MutationObserver(size).observe(rot, { subtree: true, attributes: true, attributeFilter: ['class'] });
  addEventListener('load', size); size();
})();
