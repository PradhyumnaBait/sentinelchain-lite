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

/* ── Home map: emergency route overview ───────────── */
function initHomeMap() {
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
    const map = L.map('home-map').setView([21.1, 78.5], 5);
    window.map = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    const routeCoords = [
      [[19.076, 72.8777], [18.7041, 73.1025], [18.5204, 73.8567]],
      [[28.6139, 77.2090], [28.4595, 77.0266], [27.1767, 78.0081]],
      [[13.0827, 80.2707], [12.9165, 79.1325], [11.0168, 76.9558]]
    ];
    const colors = ['#3B82F6', '#F59E0B', '#10B981'];
    routeCoords.forEach((r, i) => L.polyline(r, {
      color: colors[i],
      weight: i === 0 ? 4 : 3,
      opacity: i === 0 ? 0.85 : 0.65
    }).addTo(map));

    [[19.076, 72.8777, 'Mumbai Medical Hub'], [18.5204, 73.8567, 'Pune Relief Depot'],
    [28.6139, 77.2090, 'Delhi Command Center'], [27.1767, 78.0081, 'Agra Aid Zone'],
    [13.0827, 80.2707, 'Chennai Emergency Store'], [11.0168, 76.9558, 'Coimbatore Relief Base']]
      .forEach(([lat, lng, name]) =>
        L.circleMarker([lat, lng], { radius: 5, color: '#3B82F6', fillColor: '#93C5FD', fillOpacity: 1, weight: 2 })
          .bindTooltip(name, { permanent: false, direction: 'top' }).addTo(map));

    const convoyRoute = routeCoords[0];
    let progress = 0;
    const convoy = L.circleMarker(convoyRoute[0], {
      radius: 6, color: '#ffffff', fillColor: '#3b82f6',
      fillOpacity: 1, weight: 2, className: 'ship-marker'
    }).addTo(map);
    function interpolate(t) {
      const total = convoyRoute.length - 1;
      const i = Math.min(Math.floor(t * total), total - 1);
      const frac = (t * total) - i;
      const [la1, lo1] = convoyRoute[i];
      const [la2, lo2] = convoyRoute[i + 1] || convoyRoute[i];
      return [la1 + (la2 - la1) * frac, lo1 + (lo2 - lo1) * frac];
    }
    let rafId;
    function animateConvoy() {
      progress = (progress + 0.0015) % 1;
      convoy.setLatLng(interpolate(progress));
      rafId = requestAnimationFrame(animateConvoy);
    }
    animateConvoy();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(rafId); }
      else { animateConvoy(); }
    });

    if (!window.__statusInitialized) {
      window.__statusInitialized = true;
      const status = document.createElement('div');
      status.className = 'live-status';
      el.appendChild(status);
      // Subtle static label to avoid "empty right-box" feel.
      const label = document.createElement('div');
      label.className = 'map-label';
      label.textContent = 'Live Emergency Route Network';
      el.appendChild(label);
      const msgs = [
        'Scanning flood and storm alerts…',
        'Analyzing traffic bottlenecks…',
        'Evaluating route resilience…',
        'Optimizing safest emergency path…',
        'AI recommendation ready ✔'
      ];
      let mi = 0;
      status.textContent = msgs[0];
      setInterval(() => { mi = (mi + 1) % msgs.length; status.textContent = msgs[mi]; }, 2500);
    }
    setTimeout(() => { try { map.invalidateSize(); } catch (_) { } }, 400);
  } catch (e) { console.warn('[SCL global] home map failed:', e); }
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
        // Leaflet recalculate container after panel animation
        setTimeout(() => { try { if (window._sclMap) window._sclMap.invalidateSize(); } catch (_) {} }, 350);
      }
      if (action === 'close-ai' && panel) {
        e.preventDefault();
        panel.classList.remove('is-open', 'open');
        layout?.classList.remove('ai-open');
        document.getElementById('ai-panel-toggle')?.setAttribute('aria-expanded', 'false');
        setTimeout(() => { try { if (window._sclMap) window._sclMap.invalidateSize(); } catch (_) {} }, 350);
      }
      if (action === 'history')  { e.preventDefault(); document.body.classList.add('panel-open'); openHistory();  }
      if (action === 'alerts')   { e.preventDefault(); document.body.classList.add('panel-open'); openAlerts();   }
      if (action === 'settings') { e.preventDefault(); document.body.classList.add('panel-open'); openSettings(); }
    });

    // Remove panel-open class when any modal overlay is dismissed
    const overlayObserver = new MutationObserver(() => {
      if (!document.querySelector('.notify-modal-overlay')) {
        document.body.classList.remove('panel-open');
      }
    });
    overlayObserver.observe(document.body, { childList: true, subtree: false });
  }
  // Fallback ID-based sidebar links (for pages without data-action)
  if (!window.__sidebarFallbackBound) {
    window.__sidebarFallbackBound = true;
    document.getElementById('sidebar-history')?.addEventListener('click', e  => { e.preventDefault(); document.body.classList.add('panel-open'); openHistory();  });
    document.getElementById('sidebar-alerts')?.addEventListener('click',  e  => { e.preventDefault(); document.body.classList.add('panel-open'); openAlerts();   });
    document.getElementById('sidebar-settings')?.addEventListener('click', e => { e.preventDefault(); document.body.classList.add('panel-open'); openSettings(); });
  }
  // Home map
  initHomeMap();
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
