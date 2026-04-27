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

})();
