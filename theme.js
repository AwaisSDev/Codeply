/* ==========================================================
   Codeply — shared motion
   Scroll choreography (fade + rise on entry, staggered within
   a group) and the sticky-header hairline. Safe to load on any
   page: every selector is optional.
   ========================================================== */
(function () {
    'use strict';

    var prefersReducedMotion =
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        typeof IntersectionObserver === 'undefined';

    var animObserver = prefersReducedMotion ? null : new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-in');
            animObserver.unobserve(entry.target);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    // [selector, motion, delay ms, fixed?]
    // fixed = every match waits the same amount (used when one
    // selector spans several sections); otherwise delay * index.
    var ANIM_PLAN = [
        // Home page
        ['.hero h1', 'rise-lg', 0],
        ['.hero p', 'rise', 120],
        ['.hero-ctas', 'rise', 200],
        ['.cp-mockup', 'scale', 280],
        ['.section-head h2', 'rise-lg', 0, true],
        ['.section-head .section-sub', 'rise', 110, true],
        ['.steps .step', 'scale', 110],
        ['.features-grid .feature-card', 'scale', 90],
        ['.who-grid .who-tag', 'rise', 80],
        ['#how-codeply-helps .split-grid > *', 'rise', 120],
        ['#stats .split-grid > *', 'rise', 120],
        ['#stats .split-grid > div:last-child > div > div', 'rise', 100],
        ['#faq h2', 'rise-lg', 0],
        ['#faq-list > *', 'rise', 70],
        ['.footer-cta', 'scale', 0],
        // Standalone pages
        ['.page .hero .eyebrow', 'rise', 0],
        ['.page .hero h1', 'rise-lg', 90],
        ['.page .hero p', 'rise', 180],
        ['.page .content-wrap .entry', 'rise', 90],
        ['.page .content-wrap > *:not(.entry)', 'rise', 0, true]
    ];

    function choreograph(root) {
        if (prefersReducedMotion) return;
        root = root || document;
        ANIM_PLAN.forEach(function (rule) {
            var selector = rule[0], motion = rule[1], step = rule[2], fixed = rule[3];
            var group;
            try {
                group = root.querySelectorAll(selector);
            } catch (err) {
                return;
            }
            // One match means "hold this long"; several means "stagger",
            // unless the entry is explicitly marked fixed.
            var hold = fixed || group.length === 1;
            Array.prototype.forEach.call(group, function (el, i) {
                if (el.hasAttribute('data-anim')) return;
                el.setAttribute('data-anim', motion);
                var delay = hold ? step : step * i;
                if (delay) el.style.setProperty('--anim-delay', delay + 'ms');
                animObserver.observe(el);
            });
        });
    }

    function start() {
        choreograph();

        // Some lists (FAQ rows) are rendered by page scripts; re-scan.
        window.addEventListener('load', function () {
            choreograph();
        });

        // Failsafe: never let a stalled observer leave content invisible.
        window.addEventListener('load', function () {
            setTimeout(function () {
                document.querySelectorAll('[data-anim]:not(.is-in)').forEach(function (el) {
                    var box = el.getBoundingClientRect();
                    if (box.top < window.innerHeight && box.bottom > 0) {
                        el.classList.add('is-in');
                    }
                });
            }, 1500);
        });

        // Ambient glow drifts slower than the page for a little depth
        var ambientGlow = document.querySelector('.ambient-glow');
        if (ambientGlow && !prefersReducedMotion) {
            var glowTicking = false;
            window.addEventListener('scroll', function () {
                if (glowTicking) return;
                glowTicking = true;
                requestAnimationFrame(function () {
                    var shift = Math.min(window.scrollY * 0.12, 120);
                    ambientGlow.style.transform =
                        'translate(-50%, calc(-50% + ' + shift + 'px))';
                    glowTicking = false;
                });
            }, { passive: true });
        }

        // Header gains a hairline + shadow only once the page has scrolled
        var siteHeader = document.querySelector('header');
        if (siteHeader) {
            var syncHeader = function () {
                siteHeader.classList.toggle('is-stuck', window.scrollY > 8);
            };
            syncHeader();
            window.addEventListener('scroll', syncHeader, { passive: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
