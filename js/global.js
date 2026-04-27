/* ═══════════════════════════════════════════════════
   SENTINELCHAIN LITE — global.js
   Cross-page: history, alerts, settings, home map,
   data-action bindings. Works on ALL pages.
═══════════════════════════════════════════════════ */

/* ── Utilities (safe even if dashboard.js not loaded) ── */
function _clamp(v) { return Math.max(0, Math.min(100, Number(v) || 0)); }
function _getSettings() {
  try { return JSON.parse(localStorage.getItem('scl-settings') || '{}'); } catch (_) { return {}; }
}

/* ── Modal (HTML-safe, used by all pages) ────────── */
function showModal(title, content, isHtml) {
  document.querySelector('.notify-modal-overlay')?.remove();
  const ov = document.createElement('div');
  ov.className = 'notify-modal-overlay';
  const body = isHtml
    ? `<div class="notify-modal__body" style="max-height:55vh;overflow-y:auto;text-align:left">${content}</div>`
    : `<p class="notify-modal__body">${content}</p>`;
  ov.innerHTML = `<div class="notify-modal" style="max-width:480px;width:90%">
    <p class="notify-modal__title">${title}</p>
    ${body}
    <div class="notify-modal__footer">
      <button class="btn btn--primary btn--sm" id="g-nmc">Close</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('#g-nmc').addEventListener('click', close);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

/* ── Route History ───────────────────────────────── */
function openHistory() {
  try {
    const data = JSON.parse(localStorage.getItem('scl-history') || '[]');
    const body = data.length
      ? data.map(r => `<div style="padding:10px 0;border-bottom:1px solid var(--clr-border,#e2e8f0)">
          <strong>${r.route || '—'}</strong><br>
          <span style="font-size:12px;color:var(--clr-text-secondary,#64748b)">
            ${r.origin || ''} → ${r.destination || ''}
            &nbsp;|&nbsp; Risk: <b>${r.risk || '?'}</b> (${r.score || 0})
            &nbsp;|&nbsp; ${r.ts || ''}
          </span>
        </div>`).join('')
      : '<p style="color:#94a3b8">No history yet. Analyze a route on the Dashboard first.</p>';
    showModal('📋 Route History', body, true);
  } catch (e) { showModal('📋 Route History', 'Error loading history.'); }
}

/* ── Alerts ──────────────────────────────────────── */
function updateAlertBadge() {
  try {
    const count = JSON.parse(localStorage.getItem('scl-alerts') || '[]').length;
    document.querySelectorAll('[data-action="alerts"] .sidebar-nav__badge, #sidebar-alerts .sidebar-nav__badge')
      .forEach(b => { b.textContent = count > 0 ? Math.min(count, 99) : ''; });
  } catch (_) { }
}
function openAlerts() {
  try {
    const alerts = JSON.parse(localStorage.getItem('scl-alerts') || '[]');
    let body = alerts.length
      ? alerts.map(a => `<div style="padding:8px 0;border-bottom:1px solid var(--clr-border,#e2e8f0);color:#ef4444">⚠ ${a}</div>`).join('')
      : '<p style="color:#94a3b8">No active alerts. System nominal. ✓</p>';
    if (alerts.length) {
      body += `<div style="margin-top:12px">
        <button class="btn btn--ghost btn--sm"
          onclick="localStorage.removeItem('scl-alerts');updateAlertBadge();this.closest('.notify-modal-overlay').remove()">
          Clear All Alerts
        </button></div>`;
    }
    showModal('🔔 Active Alerts', body, true);
  } catch (e) { showModal('🔔 Alerts', 'Error loading alerts.'); }
}

/* ── Settings ────────────────────────────────────── */
function openSettings() {
  const s = _getSettings();
  const defaults = { weather: 25, congestion: 25, geopolitical: 30, piracy: 20 };
  const rows = ['weather', 'congestion', 'geopolitical', 'piracy'].map(k => `
    <label style="display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13px;padding:6px 0">
      <span style="text-transform:capitalize;font-weight:500">${k} Weight (%)</span>
      <input id="g-set-${k}" type="number" min="0" max="100"
        value="${s[k] !== undefined ? s[k] : defaults[k]}"
        style="width:72px;padding:5px 8px;border:1px solid var(--clr-border,#e2e8f0);border-radius:6px;
               background:var(--clr-bg-surface,#fff);color:var(--clr-text-primary,#0f172a);font-size:13px">
    </label>`).join('');
  showModal('⚙ Settings', `
    <div style="display:flex;flex-direction:column;gap:4px;margin-top:8px">
      ${rows}
      <p style="font-size:11px;color:#94a3b8;margin-top:8px">
        Weights affect the risk score. Ideally sum to 100. Re-analyze to apply.
      </p>
      <button class="btn btn--primary btn--sm" style="margin-top:12px" onclick="saveSettings()">
        Save Settings
      </button>
    </div>`, true);
}
function saveSettings() {
  try {
    const s = {};
    ['weather', 'congestion', 'geopolitical', 'piracy'].forEach(k => {
      const el = document.getElementById('g-set-' + k);
      s[k] = el ? _clamp(Number(el.value)) : 25;
    });
    localStorage.setItem('scl-settings', JSON.stringify(s));
    document.querySelector('.notify-modal-overlay')?.remove();
    // Show success feedback
    const banner = document.getElementById('alert-banner');
    if (banner) {
      const t = document.getElementById('alert-text');
      if (t) t.textContent = 'Settings saved — re-analyze a route to apply new weights.';
      banner.className = 'alert-banner alert-banner--info';
      banner.hidden = false;
    } else {
      alert('Settings saved. Re-analyze a route to apply.');
    }
  } catch (e) { console.error('[SCL global] saveSettings failed:', e); }
}

/* ── Home map: re-init guard + ship + live status ── */
function initHomeMap() {
  // Part 3: prevent re-initialization on re-run
  if (window.__homeMapInitialized) return;
  const el = document.getElementById('home-map');
  if (!el) return;
  if (typeof L === 'undefined') {
    el.style.cssText = 'display:flex;align-items:center;justify-content:center;background:#f1f5f9;color:#64748b;font-size:14px';
    el.textContent = 'Map unavailable (Leaflet not loaded)';
    return;
  }
  window.__homeMapInitialized = true;
  try {
    const map = L.map('home-map').setView([20, 80], 3);
    window.map = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    // Zigzag trade route lines (less artificial than straight segments)
    const routeCoords = [
      [[20, 60], [18, 70], [22, 80], [19, 90], [23, 100]],
      [[15, 50], [18, 65], [16, 85], [20, 105]],
      [[22, 78], [26, 92], [24, 108], [29, 122]]
    ];
    const colors = ['#3B82F6', '#F59E0B', '#10B981'];
    const weights = [3, 2, 2];
    const opacities = [0.8, 0.6, 0.55];
    routeCoords.forEach((r, i) => L.polyline(r, {
      color: colors[i],
      weight: weights[i],
      opacity: opacities[i]
    }).addTo(map));
    // Port markers
    [[19.08, 72.88, 'Mumbai'], [1.35, 103.82, 'Singapore'], [22.32, 114.17, 'Hong Kong'],
    [51.51, -0.13, 'London'], [40.71, -74.01, 'New York']]
      .forEach(([lat, lng, name]) =>
        L.circleMarker([lat, lng], { radius: 5, color: '#3B82F6', fillColor: '#93C5FD', fillOpacity: 1, weight: 2 })
          .bindTooltip(name, { permanent: false, direction: 'top' }).addTo(map));
    // Part 3: animated ship along primary route
    const shipRoute = [[19.08, 72.88], [1.35, 103.82], [22.32, 114.17], [31.23, 121.47]];
    let progress = 0;
    const ship = L.circleMarker(shipRoute[0], {
      radius: 6, color: '#ffffff', fillColor: '#3b82f6',
      fillOpacity: 1, weight: 2, className: 'ship-marker'
    }).addTo(map);
    function interpolate(t) {
      const total = shipRoute.length - 1;
      const i = Math.min(Math.floor(t * total), total - 1);
      const frac = (t * total) - i;
      const [la1, lo1] = shipRoute[i];
      const [la2, lo2] = shipRoute[i + 1] || shipRoute[i];
      return [la1 + (la2 - la1) * frac, lo1 + (lo2 - lo1) * frac];
    }
    let rafId;
    function animateShip() {
      progress = (progress + 0.0006) % 1;
      ship.setLatLng(interpolate(progress));
      rafId = requestAnimationFrame(animateShip);
    }
    animateShip();
    // Stop RAF when page is hidden (memory/CPU efficiency)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(rafId); }
      else { animateShip(); }
    });
    // Part 4: live intelligence status overlay
    if (!window.__statusInitialized) {
      window.__statusInitialized = true;
      const status = document.createElement('div');
      status.className = 'live-status';
      el.appendChild(status);
      // Subtle static label to avoid "empty right-box" feel.
      const label = document.createElement('div');
      label.className = 'map-label';
      label.textContent = 'Live Route Network';
      el.appendChild(label);
      const msgs = [
        'Scanning weather systems…',
        'Analyzing congestion nodes…',
        'Evaluating geopolitical risks…',
        'Optimizing safest route…',
        'AI recommendation ready ✔'
      ];
      let mi = 0;
      status.textContent = msgs[0];
      setInterval(() => { mi = (mi + 1) % msgs.length; status.textContent = msgs[mi]; }, 2500);
    }
    setTimeout(() => { try { map.invalidateSize(); } catch (_) { } }, 400);
  } catch (e) { console.warn('[SCL global] home map failed:', e); }
}

function initHomeEnhancements() {
  const mapEl = document.getElementById('home-map');
  if (!mapEl) return;
  if (window.__homeEnhanced) return;
  window.__homeEnhanced = true;

  if (typeof L === 'undefined' || !window.map) return;

  const route1 = [
    [20, 60],
    [18, 72],
    [22, 85],
    [19, 98],
    [23, 110]
  ];
  const route2 = [
    [15, 55],
    [19, 68],
    [17, 82],
    [21, 100]
  ];

  L.polyline(route1, {
    color: '#3b82f6',
    weight: 3,
    opacity: 0.85
  }).addTo(window.map);

  L.polyline(route2, {
    color: '#f59e0b',
    weight: 2,
    opacity: 0.65
  }).addTo(window.map);

  if (!window.__homePulseRunning) {
    window.__homePulseRunning = true;
    const pulse = L.circleMarker([20, 60], {
      radius: 5,
      color: '#3b82f6'
    }).addTo(window.map);

    let t = 0;
    function animate() {
      t += 0.002;
      if (t > 1) t = 0;
      const lat = 20 + (3 * Math.sin(t * Math.PI));
      const lng = 60 + (40 * t);
      pulse.setLatLng([lat, lng]);
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }
}

function initHomeVisualFix() {
  const box = document.querySelector('.hero-visual, #home-map');
  if (!box) return;
  if (box.dataset.enhanced) return;
  box.dataset.enhanced = 'true';
  const overlay = document.createElement('div');
  overlay.className = 'hero-overlay-lines';
  box.appendChild(overlay);
}

function bindMapPopEffect() {
  if (window.__mapAnimDone) return;
  window.__mapAnimDone = true;

  document.addEventListener('click', function (e) {
    const trigger = e.target.closest('[data-action="open-ai"]');
    if (!trigger) return;
    const map = document.querySelector('.map-container');
    if (!map) return;
    map.classList.remove('settle');
    setTimeout(function () {
      map.classList.add('settle');
    }, 260);
  });
}

/* ── Bind actions: event delegation (no duplicate listeners) */
function bindGlobalActions() {
  // Part 1: single delegated listener for ALL data-action clicks
  if (!window.__globalActionsInitialized) {
    window.__globalActionsInitialized = true;
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.dataset.action;
      const panel = document.getElementById('ai-panel');
      const layout = document.querySelector('.dashboard-layout');
      if (action === 'open-ai' && panel) {
        e.preventDefault();
        panel.classList.toggle('open');
        panel.classList.toggle('is-open', panel.classList.contains('open'));
        layout?.classList.toggle('ai-open', panel.classList.contains('open'));
        document.getElementById('ai-panel-toggle')?.setAttribute('aria-expanded', String(panel.classList.contains('open')));
      }
      if (action === 'close-ai' && panel) {
        e.preventDefault();
        panel.classList.remove('is-open', 'open');
        layout?.classList.remove('ai-open');
        document.getElementById('ai-panel-toggle')?.setAttribute('aria-expanded', 'false');
      }
      if (action === 'history') { e.preventDefault(); openHistory(); }
      if (action === 'alerts') { e.preventDefault(); openAlerts(); }
      if (action === 'settings') { e.preventDefault(); openSettings(); }
    });
  }
  // Fallback ID-based sidebar links (for pages without data-action)
  if (!window.__sidebarFallbackBound) {
    window.__sidebarFallbackBound = true;
    document.getElementById('sidebar-history')?.addEventListener('click', e => { e.preventDefault(); openHistory(); });
    document.getElementById('sidebar-alerts')?.addEventListener('click', e => { e.preventDefault(); openAlerts(); });
    document.getElementById('sidebar-settings')?.addEventListener('click', e => { e.preventDefault(); openSettings(); });
  }
  // Home map
  initHomeMap();
  initHomeVisualFix();
  initHomeEnhancements();
  bindMapPopEffect();
  // Keep dashboard state deterministic on load/re-run
  const panel = document.getElementById('ai-panel');
  const layout = document.querySelector('.dashboard-layout');
  if (panel && layout) {
    layout.classList.toggle('ai-open', panel.classList.contains('open'));
  }
  // Sync alert badge
  updateAlertBadge();
}

/* ── Entry point ─────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindGlobalActions);
} else {
  bindGlobalActions();
}
