// Codeply home v4: nav border on scroll, reveal on scroll, and a typing composer in the hero.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var nav = document.getElementById('nv');
  function onScroll() { nav.classList.toggle('scrolled', scrollY > 8); }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  var items = document.querySelectorAll('.rv');
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    items.forEach(function (el) { io.observe(el); });
  }

  // the composer types a few things you might ask
  var el = document.getElementById('typed');
  if (!el || reduce) return;
  var lines = ['Remind me to call mum at 6', 'Reply to Sam: 3pm works', 'Write the release notes for 3.0', 'Find a dentist near me on Saturday'];
  var li = 0, ci = lines[0].length, del = true;
  function tick() {
    var s = lines[li];
    if (del) { ci--; el.textContent = s.slice(0, ci); if (ci <= 0) { del = false; li = (li + 1) % lines.length; } return setTimeout(tick, 28); }
    s = lines[li]; ci++; el.textContent = s.slice(0, ci);
    if (ci >= s.length) { del = true; return setTimeout(tick, 2200); }
    setTimeout(tick, 55 + Math.random() * 45);
  }
  setTimeout(tick, 2600);
})();
