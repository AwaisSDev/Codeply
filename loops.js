// Live product loops: play while on screen, pause when not, never for reduced motion.
(function () {
  var vids = [].slice.call(document.querySelectorAll('video[data-loop]'));
  if (!vids.length) return;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return; // posters only
  function load(v) {
    if (v._ready) return;
    v._ready = true;
    [].slice.call(v.querySelectorAll('source[data-src]')).forEach(function (s) { s.src = s.getAttribute('data-src'); });
    v.load();
  }
  function play(v) { load(v); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  if (!('IntersectionObserver' in window)) { vids.forEach(play); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      var idle = v.closest('.switch-stage .shot:not(.on)');
      v._seen = e.isIntersecting;
      if (e.isIntersecting && !idle) play(v); else if (v._ready) v.pause();
    });
  }, { threshold: 0.2 });
  vids.forEach(function (v) { io.observe(v); });
  // Videos inside a tab switcher start when their tab is shown.
  // The home switcher shows one app at a time: only its video plays, from the start.
  document.addEventListener('loops:show', function (e) {
    vids.forEach(function (v) { if (v.closest('.switch-stage') && v._ready) v.pause(); });
    var v = e.target.querySelector && e.target.querySelector('video[data-loop]');
    if (v) { load(v); v.currentTime = 0; play(v); }
  });
})();
