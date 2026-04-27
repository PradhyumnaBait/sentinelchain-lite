/* ═══════════════════════════════════════════════════
   SENTINELCHAIN LITE — Landing Page JS
═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Hamburger toggle ───────────────────────────── */
  const hamburger = document.getElementById('hamburger-btn');
  const navLinks = document.querySelector('.navbar__nav');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!isOpen));
      navLinks.classList.toggle('nav--open', !isOpen);
    });
  }

  /* ── Active nav link ────────────────────────────── */
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath) link.classList.add('is-active');
  });

  /* ── Intersection Observer: fade-in on scroll ───── */
  const fadeEls = document.querySelectorAll(
    '.feature-card, .how-step, .hero__content, .hero__map-preview'
  );

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    fadeEls.forEach(el => {
      el.classList.add('fade-init');
      io.observe(el);
    });
  } else {
    fadeEls.forEach(el => el.classList.add('is-visible'));
  }

  /* ── Inject fade CSS ────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    .fade-init { opacity: 0; transform: translateY(16px); transition: opacity 0.5s ease, transform 0.5s ease; }
    .fade-init.is-visible { opacity: 1; transform: none; }
  `;
  document.head.appendChild(style);

  function animateStats() {
    if (window.__statsAnimated) return;
    window.__statsAnimated = true;
    document.querySelectorAll('.stat-value').forEach((el) => {
      const raw = (el.textContent || '').trim();
      const suffix = raw.replace(/[0-9.]/g, '');
      const target = parseFloat(raw);
      if (Number.isNaN(target)) return;
      let val = 0;
      function tick() {
        val += target / 30;
        if (val >= target) {
          el.textContent = `${target}${suffix}`;
          return;
        }
        el.textContent = `${val.toFixed(1)}${suffix}`;
        requestAnimationFrame(tick);
      }
      tick();
    });
  }

  animateStats();

  function injectHeroSvgRoutes() {
    // SVG polylines are now baked into index.html — just ensure CSS class
    const mock = document.getElementById('hero-map-mock');
    if (!mock) return;
    if (mock.querySelector('.hero-routes')) {
      mock.classList.add('hero-map-mock--routes');
      return; // SVG already present in DOM
    }
  }


  function animateRoutes() {

    if (window.__heroRoutesAnimBound) return;
    window.__heroRoutesAnimBound = true;

    injectHeroSvgRoutes();

    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Part 1: segment-based interpolation (works with SVGPointList on <polyline>)
    const configs = [
      { id: '#route-low',  dot: '.mover.low',  speed: 0.012 },
      { id: '#route-med',  dot: '.mover.med',  speed: 0.008 },
      { id: '#route-high', dot: '.mover.high', speed: 0.005 }
    ];

    const runners = configs.map(cfg => {
      const poly = document.querySelector(cfg.id);
      const dot  = document.querySelector(cfg.dot);
      if (!poly || !dot) return null;
      const isImage = dot.tagName.toLowerCase() === 'image';
      return { pts: poly.points, dot, speed: cfg.speed, i: 0, t: 0, isImage };
    }).filter(Boolean);

    if (!runners.length) return;

    if (reduced) {
      runners.forEach(r => {
        const p = r.pts.getItem(0);
        if (!p) return;
        // Icon (image) uses x/y; circle uses cx/cy
        if (r.isImage) { r.dot.setAttribute('x', p.x - 7); r.dot.setAttribute('y', p.y - 7); }
        else { r.dot.setAttribute('cx', p.x); r.dot.setAttribute('cy', p.y); }
      });
      return;
    }

    let rafId = 0;
    function frame() {
      runners.forEach(r => {
        const total = r.pts.numberOfItems;
        if (total < 2) return;

        r.t += r.speed;
        if (r.t >= 1) { r.i++; r.t = 0; }
        if (r.i >= total - 1) { r.i = 0; r.t = 0; }   // loop back

        const p1 = r.pts.getItem(r.i);
        const p2 = r.pts.getItem(r.i + 1);
        const x = p1.x + (p2.x - p1.x) * r.t;
        const y = p1.y + (p2.y - p1.y) * r.t;
        // Icon (image) uses x/y with centering offset; circle uses cx/cy
        if (r.isImage) { r.dot.setAttribute('x', x - 7); r.dot.setAttribute('y', y - 7); }
        else { r.dot.setAttribute('cx', x); r.dot.setAttribute('cy', y); }
      });
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(rafId);
      else rafId = requestAnimationFrame(frame);
    }, { once: false });
  }

  animateRoutes();

})();
