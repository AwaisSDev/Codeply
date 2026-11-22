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
})();
