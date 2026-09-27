/* ==========================================================
   Codeply — shared site behaviour
   Header hairline, mobile menu, scroll reveal, copy buttons,
   OS tabs for install commands. Every hook is optional.
   ========================================================== */
(function () {
    'use strict';

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function start() {
        // Header hairline once scrolled
        var header = document.querySelector('.site-header');
        if (header) {
            var sync = function () { header.classList.toggle('is-stuck', window.scrollY > 4); };
            sync();
            window.addEventListener('scroll', sync, { passive: true });

            var toggle = header.querySelector('.nav-toggle');
            if (toggle) {
                toggle.addEventListener('click', function () {
                    var open = header.classList.toggle('menu-open');
                    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
                });
                header.querySelectorAll('.mobile-menu a').forEach(function (a) {
                    a.addEventListener('click', function () { header.classList.remove('menu-open'); });
                });
            }
        }

        // Reveal on scroll
        var items = document.querySelectorAll('[data-reveal]');
        if (reduced || !('IntersectionObserver' in window)) {
            items.forEach(function (el) { el.classList.add('is-in'); });
        } else {
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (!e.isIntersecting) return;
                    e.target.classList.add('is-in');
                    io.unobserve(e.target);
                });
            }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
            items.forEach(function (el) { io.observe(el); });
            // Never leave content invisible if the observer stalls
            window.addEventListener('load', function () {
                setTimeout(function () {
                    items.forEach(function (el) {
                        var r = el.getBoundingClientRect();
                        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in');
                    });
                }, 1200);
            });
        }

        // OS tabs: <div data-os-tabs> buttons[data-os] + [data-os-cmd] target
        document.querySelectorAll('[data-os-tabs]').forEach(function (group) {
            var target = document.getElementById(group.getAttribute('data-target'));
            var buttons = group.querySelectorAll('button[data-os]');
            function set(os) {
                buttons.forEach(function (b) {
                    var on = b.getAttribute('data-os') === os;
                    b.classList.toggle('active', on);
                    b.setAttribute('aria-selected', on ? 'true' : 'false');
                    if (on && target) target.textContent = b.getAttribute('data-cmd');
                });
            }
            buttons.forEach(function (b) {
                b.addEventListener('click', function () { set(b.getAttribute('data-os')); });
            });
            var isWin = /win/i.test(navigator.platform || navigator.userAgent || '');
            set(isWin ? 'win' : 'unix');
        });

        // Copy buttons: data-copy="#id" copies that element's text
        var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
        document.querySelectorAll('[data-copy]').forEach(function (btn) {
            var original = btn.innerHTML;
            btn.addEventListener('click', function () {
                var src = document.querySelector(btn.getAttribute('data-copy'));
                if (!src || !navigator.clipboard) return;
                navigator.clipboard.writeText(src.textContent.trim()).then(function () {
                    btn.classList.add('copied');
                    if (btn.classList.contains('nav-pill')) {
                        setTimeout(function () { btn.classList.remove('copied'); }, 1400);
                        return;
                    }
                    btn.innerHTML = CHECK;
                    setTimeout(function () {
                        btn.classList.remove('copied');
                        btn.innerHTML = original;
                    }, 1400);
                });
            });
        });

        // Typing composer in mockups: <span data-type="text">
        document.querySelectorAll('[data-type]').forEach(function (el) {
            var text = el.getAttribute('data-type');
            if (reduced) { el.textContent = text; return; }
            var i = 0;
            var run = function () {
                el.textContent = text.slice(0, i);
                if (i < text.length) { i++; setTimeout(run, 38 + Math.random() * 40); }
                else setTimeout(function () { i = 0; run(); }, 4200);
            };
            var io2 = new IntersectionObserver(function (entries) {
                if (entries[0].isIntersecting) { io2.disconnect(); setTimeout(run, 600); }
            });
            io2.observe(el);
        });

        // Real app snapshots: scale the full window to the frame width
        var frames = document.querySelectorAll('.app-frame');
        var fit = function (el) {
            var w = parseFloat(getComputedStyle(el).getPropertyValue('--w')) || 1113;
            el.style.setProperty('--s', el.clientWidth / w);
        };
        frames.forEach(fit);
        if ('ResizeObserver' in window) {
            var ro = new ResizeObserver(function (entries) { entries.forEach(function (e) { fit(e.target); }); });
            frames.forEach(function (el) { ro.observe(el); });
        } else {
            window.addEventListener('resize', function () { frames.forEach(fit); });
        }

        // Open rows start in view, as they would after clicking them in the app
        document.querySelectorAll('.craft .tool-row.expanded').forEach(function (row) {
            var scroller = row.closest('.chat-scroll');
            if (scroller) scroller.scrollTop = Math.max(0, row.offsetTop - 140);
        });

        // Recreated Craft windows behave like the app: tool rows expand on click
        document.querySelectorAll('.craft .tool-row.expandable .tool-row-head').forEach(function (head) {
            head.addEventListener('click', function () {
                var row = head.parentElement;
                var detail = row.querySelector('.tool-detail');
                row.classList.toggle('expanded');
                if (detail) detail.classList.toggle('hidden');
            });
        });

        // Nav pill shows the install command for this OS
        var isWinOS = /win/i.test(navigator.platform || navigator.userAgent || '');
        document.querySelectorAll('[data-os-cmd]').forEach(function (el) {
            el.textContent = isWinOS
                ? 'irm https://codeply.online/install.ps1 | iex'
                : 'curl -fsSL https://codeply.online/install.sh | sh';
        });

        // Feature index: highlight the section in view
        var tocLinks = document.querySelectorAll('.tour-nav a');
        if (tocLinks.length && 'IntersectionObserver' in window) {
            var spy = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (!e.isIntersecting) return;
                    tocLinks.forEach(function (a) {
                        a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id);
                    });
                });
            }, { rootMargin: '-40% 0px -55% 0px' });
            document.querySelectorAll('.tour-item[id]').forEach(function (el) { spy.observe(el); });
        }

        // Footer year
        document.querySelectorAll('[data-year]').forEach(function (el) {
            el.textContent = new Date().getFullYear();
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
