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
    const mock = document.getElementById('hero-map-mock');
    if (!mock || mock.dataset.svgRoutes === 'true') return;
    mock.dataset.svgRoutes = 'true';
    mock.classList.add('hero-map-mock--routes');

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'hero-routes');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');

    const paths = [
      { id: 'route-low', d: 'M 8 48 C 22 34, 38 58, 52 50 S 78 44, 92 52' },
      { id: 'route-med', d: 'M 8 58 C 26 72, 44 48, 58 56 S 76 64, 92 54' },
      { id: 'route-high', d: 'M 8 68 C 28 50, 46 72, 62 58 S 84 50, 92 62' }
    ];
    paths.forEach((p) => {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('id', p.id);
      path.setAttribute('d', p.d);
      svg.appendChild(path);
    });

    const movers = [
      { class: 'mover low', fill: '#10b981' },
      { class: 'mover med', fill: '#f59e0b' },
      { class: 'mover high', fill: '#ef4444' }
    ];
    movers.forEach((m) => {
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('class', m.class);
      c.setAttribute('r', '1.8');
      c.setAttribute('fill', m.fill);
      svg.appendChild(c);
    });

    const grid = mock.querySelector('.map-mock__grid');
    if (grid) mock.insertBefore(svg, grid.nextSibling);
    else mock.appendChild(svg);
  }

  function animateRoutes() {
    if (window.__heroRoutesAnimBound) return;
    window.__heroRoutesAnimBound = true;

    injectHeroSvgRoutes();

    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const configs = [
      { path: '#route-low', dot: '.mover.low', speed: 0.003 },
      { path: '#route-med', dot: '.mover.med', speed: 0.002 },
      { path: '#route-high', dot: '.mover.high', speed: 0.0015 }
    ];

    const runners = configs.map((cfg) => {
      const path = document.querySelector(cfg.path);
      const dot = document.querySelector(cfg.dot);
      if (!path || !dot) return null;
      const length = path.getTotalLength();
      let t = 0;
      return { path, dot, length, speed: cfg.speed, t };
    }).filter(Boolean);

    if (!runners.length) return;

    if (reduced) {
      runners.forEach((r) => {
        const pt = r.path.getPointAtLength(0);
        r.dot.setAttribute('cx', pt.x);
        r.dot.setAttribute('cy', pt.y);
      });
      return;
    }

    let rafId = 0;
    function frame() {
      runners.forEach((r) => {
        r.t += r.speed;
        if (r.t > 1) r.t = 0;
        const point = r.path.getPointAtLength(r.t * r.length);
        r.dot.setAttribute('cx', point.x);
        r.dot.setAttribute('cy', point.y);
      });
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(rafId);
      else rafId = requestAnimationFrame(frame);
    });
  }

  animateRoutes();

})();
