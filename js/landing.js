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
    svg.setAttribute('viewBox', '0 0 600 300');          // Part 1: sharp segment viewBox
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');

    // Part 1: polylines (sharp segments — NOT bezier curves)
    const routes = [
      { id: 'route-low',  pts: '40,200 150,150 280,180 400,140 540,180' },
      { id: 'route-med',  pts: '40,220 180,210 300,160 420,200 540,210' },
      { id: 'route-high', pts: '40,250 160,220 300,230 420,180 540,250' }
    ];
    routes.forEach(r => {
      const poly = document.createElementNS(svgNS, 'polyline');
      poly.setAttribute('id', r.id);
      poly.setAttribute('points', r.pts);
      svg.appendChild(poly);
    });

    // Mover dots
    [{ cls:'mover low', fill:'#10b981' },
     { cls:'mover med', fill:'#f59e0b' },
     { cls:'mover high',fill:'#ef4444' }].forEach(m => {
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('class', m.cls);
      c.setAttribute('r', '5');
      c.setAttribute('fill', m.fill);
      svg.appendChild(c);
    });

    // A / B labels
    [{ x:16, y:210, t:'A' }, { x:548, y:178, t:'B' }].forEach(l => {
      const txt = document.createElementNS(svgNS, 'text');
      txt.setAttribute('x', l.x); txt.setAttribute('y', l.y);
      txt.setAttribute('class', 'svg-label');
      txt.textContent = l.t;
      svg.appendChild(txt);
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

    // Part 1: segment-based interpolation (works with SVGPointList on <polyline>)
    const configs = [
      { id: '#route-low',  dot: '.mover.low',  speed: 0.008 },
      { id: '#route-med',  dot: '.mover.med',  speed: 0.006 },
      { id: '#route-high', dot: '.mover.high', speed: 0.004 }
    ];

    const runners = configs.map(cfg => {
      const poly = document.querySelector(cfg.id);
      const dot  = document.querySelector(cfg.dot);
      if (!poly || !dot) return null;
      return { pts: poly.points, dot, speed: cfg.speed, i: 0, t: 0 };
    }).filter(Boolean);

    if (!runners.length) return;

    if (reduced) {
      runners.forEach(r => {
        const p = r.pts.getItem(0);
        if (p) { r.dot.setAttribute('cx', p.x); r.dot.setAttribute('cy', p.y); }
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
        r.dot.setAttribute('cx', p1.x + (p2.x - p1.x) * r.t);
        r.dot.setAttribute('cy', p1.y + (p2.y - p1.y) * r.t);
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
