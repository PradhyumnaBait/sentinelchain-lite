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

  /* ── Stat counter ───────────────────────────────── */
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
        if (val >= target) { el.textContent = `${target}${suffix}`; return; }
        el.textContent = `${val.toFixed(1)}${suffix}`;
        requestAnimationFrame(tick);
      }
      tick();
    });
  }
  animateStats();

  /* ── Phase 6: AI Typing System ──────────────────── */
  function initAITyping() {
    if (window.__aiTypingBound) return;
    window.__aiTypingBound = true;

    const typingEl  = document.getElementById('ai-typing');
    const chipsEl   = document.getElementById('ai-chips');
    const resolvedEl = document.getElementById('ai-resolved');
    if (!typingEl || !chipsEl) return;

    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const msg     = 'AI analyzing route conditions...';

    if (reduced) {
      typingEl.textContent = msg;
      chipsEl.classList.add('visible');
      chipsEl.querySelectorAll('.ai-chip').forEach(c => c.classList.add('show'));
      if (resolvedEl) resolvedEl.classList.add('show');
      return;
    }

    // Phase 9: typing starts at 0.5s
    let i = 0;
    setTimeout(() => {
      const timer = setInterval(() => {
        if (i >= msg.length) {
          clearInterval(timer);
          setTimeout(showChips, 2000); // chips at ~2.5s
          return;
        }
        typingEl.textContent = msg.slice(0, ++i);
      }, 30);
    }, 500);

    function showChips() {
      chipsEl.classList.add('visible');
      const chips = chipsEl.querySelectorAll('.ai-chip');
      chips.forEach((chip, idx) => {
        setTimeout(() => chip.classList.add('show'), idx * 150);
      });
      // Phase 3: resolved line appears 800ms after last chip
      setTimeout(showResolved, chips.length * 150 + 800);
    }

    function showResolved() {
      if (resolvedEl) resolvedEl.classList.add('show');
    }
  }

  /* ── Route SVG init ─────────────────────────────── */
  function injectHeroSvgRoutes() {
    const mock = document.getElementById('hero-map-mock');
    if (!mock) return;
    if (mock.querySelector('.hero-routes')) {
      mock.classList.add('hero-map-mock--routes');
    }
  }

  /* ── Section 5+6: Mover RAF using transform translate ── */
  function animateRoutes() {
    if (window.__heroRoutesAnimBound) return;
    window.__heroRoutesAnimBound = true;

    injectHeroSvgRoutes();
    initAITyping();

    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const configs = [
      { id: '#route-low',  dot: '.mover.low',  speed: 0.012 },
      { id: '#route-med',  dot: '.mover.med',  speed: 0.008 },
      { id: '#route-high', dot: '.mover.high', speed: 0.005 }
    ];

    const runners = configs.map(cfg => {
      const poly = document.querySelector(cfg.id);
      const dot  = document.querySelector(cfg.dot);
      if (!poly || !dot) return null;
      // <g> groups use transform="translate(x,y)"; circles use cx/cy; rects use x/y
      const tag = dot.tagName.toLowerCase();
      const isGroup      = tag === 'g';
      const isPositional = tag === 'image' || tag === 'rect';
      return { pts: poly.points, dot, speed: cfg.speed, i: 0, t: 0, isGroup, isPositional };
    }).filter(Boolean);

    if (!runners.length) return;

    if (reduced) {
      // Place icons at start of their routes
      runners.forEach(r => {
        const p = r.pts.getItem(0);
        if (!p) return;
        if (r.isGroup)      r.dot.setAttribute('transform', `translate(${p.x},${p.y})`);
        else if (r.isPositional) { r.dot.setAttribute('x', p.x - 5); r.dot.setAttribute('y', p.y - 3); }
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
        if (r.i >= total - 1) { r.i = 0; r.t = 0; }
        const p1 = r.pts.getItem(r.i);
        const p2 = r.pts.getItem(r.i + 1);
        const x  = p1.x + (p2.x - p1.x) * r.t;
        const y  = p1.y + (p2.y - p1.y) * r.t;
        // Move group icons via translate; fallback for other element types
        if (r.isGroup)           r.dot.setAttribute('transform', `translate(${x},${y})`);
        else if (r.isPositional) { r.dot.setAttribute('x', x - 5); r.dot.setAttribute('y', y - 3); }
        else                     { r.dot.setAttribute('cx', x); r.dot.setAttribute('cy', y); }
      });
      rafId = requestAnimationFrame(frame);
    }

    // Phase 9: movers start at 6s (after draw animation completes)
    setTimeout(() => {
      rafId = requestAnimationFrame(frame);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) cancelAnimationFrame(rafId);
        else rafId = requestAnimationFrame(frame);
      });
    }, 6000);
  }

  animateRoutes();

  /* ── Phase 4: Mousemove parallax on hero box ────── */
  (function initParallax() {
    const preview = document.querySelector('.hero__map-preview');
    if (!preview) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Perspective must be on the parent for rotateX/Y to show depth
    const parent = preview.parentElement;
    if (parent) parent.style.perspective = '1200px';

    preview.style.transition = 'transform 0.12s ease-out';
    preview.style.willChange = 'transform';

    preview.addEventListener('mousemove', e => {
      const rect = preview.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width  - 0.5;
      const y = (e.clientY - rect.top)  / rect.height - 0.5;
      preview.style.transform = `rotateX(${y * -4}deg) rotateY(${x * 4}deg) scale(1.01)`;
    });

    preview.addEventListener('mouseleave', () => {
      preview.style.transition = 'transform 0.5s ease';
      preview.style.transform  = 'rotateX(0) rotateY(0) scale(1)';
      setTimeout(() => { preview.style.transition = 'transform 0.12s ease-out'; }, 500);
    });
  })();

  /* ── Phase 5: Route shimmer (after draw completes at ~7s) ── */
  setTimeout(() => {
    document.querySelectorAll('#route-low, #route-med, #route-high').forEach(el => {
      el.classList.add('route-shimmer');
    });
  }, 7200);

  /* ── Section 11: UI sanity check + auto-heal ─ */
  window.addEventListener('load', function uiSanityCheck() {
    const issues = [];
    const aiEl   = document.querySelector('.ai-status');
    const wxEl   = document.querySelector('.map-insights');

    if (aiEl && wxEl) {
      const a = aiEl.getBoundingClientRect();
      const w = wxEl.getBoundingClientRect();
      if (!(a.right < w.left || a.left > w.right)) {
        issues.push('Overlap: .ai-status vs .map-insights');
      }
    }

    if (getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)') {
      issues.push('Harsh white background detected');
    }

    if (issues.length) {
      console.warn('[SCL] UI issues detected:', issues);
      document.body.classList.add('ui-autofix');
    }
  });

})();
