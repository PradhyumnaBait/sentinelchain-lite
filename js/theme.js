/* ═══════════════════════════════════════════════════
   SENTINELCHAIN LITE — Theme Toggle (shared)
   Manages light/dark mode across all pages.
   Default = light. Saves to localStorage.
═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  const STORAGE_KEY = 'scl-theme';
  const DEFAULT_THEME = 'light';

  /* ── Apply theme to <html> ──────────────────── */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);

    // Update all toggle buttons on page
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.textContent = theme === 'dark' ? '☀' : '🌙';
    });
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  /* ── Init: load saved preference ────────────── */
  function init() {
    const saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
    applyTheme(saved);

    // Wire up all theme toggle buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-theme-toggle]')) {
        toggleTheme();
      }
    });
  }

  // Run immediately so there's no flash
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose globally for page scripts
  window.SCLTheme = { apply: applyTheme, toggle: toggleTheme };
})();
