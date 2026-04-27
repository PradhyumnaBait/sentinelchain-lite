/* ═══════════════════════════════════════════════════
   SENTINELCHAIN LITE — global.js
   Cross-page: history, alerts, settings, home map,
   data-action bindings. Works on ALL pages.
═══════════════════════════════════════════════════ */

/* ── Utilities (safe even if dashboard.js not loaded) ── */
function _clamp(v) { return Math.max(0, Math.min(100, Number(v) || 0)); }
function _getSettings() {
  try { return JSON.parse(localStorage.getItem('scl-settings') || '{}'); } catch(_) { return {}; }
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
  } catch(e) { showModal('📋 Route History', 'Error loading history.'); }
}

/* ── Alerts ──────────────────────────────────────── */
function updateAlertBadge() {
  try {
    const count = JSON.parse(localStorage.getItem('scl-alerts') || '[]').length;
    document.querySelectorAll('[data-action="alerts"] .sidebar-nav__badge, #sidebar-alerts .sidebar-nav__badge')
      .forEach(b => { b.textContent = count > 0 ? Math.min(count, 99) : ''; });
  } catch(_) {}
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
  } catch(e) { showModal('🔔 Alerts', 'Error loading alerts.'); }
}

/* ── Settings ────────────────────────────────────── */
function openSettings() {
  const s = _getSettings();
  const defaults = { weather:25, congestion:25, geopolitical:30, piracy:20 };
  const rows = ['weather','congestion','geopolitical','piracy'].map(k => `
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
    ['weather','congestion','geopolitical','piracy'].forEach(k => {
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
  } catch(e) { console.error('[SCL global] saveSettings failed:', e); }
}

/* ── Home map (index.html) ───────────────────── */
function initHomeMap() {
  const el = document.getElementById('home-map');
  if (!el) return;
  if (typeof L === 'undefined') {
    console.warn('[SCL global] Leaflet not loaded — home map skipped');
    el.style.cssText = 'display:flex;align-items:center;justify-content:center;background:#f1f5f9;color:#64748b;font-size:14px';
    el.textContent = 'Map unavailable offline';
    return;
  }
  try {
    const map = L.map('home-map').setView([20, 80], 3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    // 3 major trade routes
    const routes = [
      [[19.08,72.88],[1.35,103.82],[22.32,114.17],[31.23,121.47]],    // Asia-Europe
      [[19.08,72.88],[12.36,43.15],[51.51,-0.13],[40.71,-74.01]],     // Trans-Atlantic
      [[22.32,114.17],[35.69,139.69],[-33.87,151.21]]                 // Asia-Pacific
    ];
    const colors = ['#3B82F6','#8B5CF6','#10B981'];
    routes.forEach((r,i) => L.polyline(r, { color:colors[i], weight:3 }).addTo(map));
    // Port markers
    [[19.08,72.88,'Mumbai'],[1.35,103.82,'Singapore'],[22.32,114.17,'Hong Kong'],[51.51,-0.13,'London'],[40.71,-74.01,'New York']]
      .forEach(([lat,lng,name]) => {
        L.circleMarker([lat,lng],{radius:5,color:'#3B82F6',fillColor:'#93C5FD',fillOpacity:1,weight:2})
         .bindTooltip(name,{permanent:false,direction:'top'}).addTo(map);
      });
    setTimeout(() => { try { map.invalidateSize(); } catch(_){} }, 400);
  } catch(e) { console.warn('[SCL global] home map failed:', e); }
}

/* ── Bind data-action, AI panel, sidebar links ───── */
function bindGlobalActions() {
  // data-action elements
  document.querySelectorAll("[data-action='history']").forEach(el =>  { el.onclick = e => { e.preventDefault(); openHistory(); }; });
  document.querySelectorAll("[data-action='alerts']").forEach(el =>   { el.onclick = e => { e.preventDefault(); openAlerts(); }; });
  document.querySelectorAll("[data-action='settings']").forEach(el => { el.onclick = e => { e.preventDefault(); openSettings(); }; });

  // Fallback: ID-based sidebar links
  document.getElementById('sidebar-history') ?.addEventListener('click', e => { e.preventDefault(); openHistory(); });
  document.getElementById('sidebar-alerts')  ?.addEventListener('click', e => { e.preventDefault(); openAlerts(); });
  document.getElementById('sidebar-settings')?.addEventListener('click', e => { e.preventDefault(); openSettings(); });

  // AI panel — bind ALL possible button IDs
  const aiPanel = document.getElementById('ai-panel');
  if (aiPanel) {
    ['open-ai-panel','ai-button','ai-panel-toggle'].forEach(btnId => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        aiPanel.classList.toggle('is-open');
        aiPanel.classList.toggle('open');
      });
    });
    // Close button
    document.getElementById('ai-panel-close')?.addEventListener('click', () => {
      aiPanel.classList.remove('is-open','open');
    });
  }

  // Home map
  initHomeMap();

  // Sync alert badge
  updateAlertBadge();
}

/* ── Entry point ─────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindGlobalActions);
} else {
  bindGlobalActions();
}
